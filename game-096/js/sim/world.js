// The solid world: every box the player can stand on or bump into, and the pieces that move.
// Pure. The player is a short upright cylinder; boxes are axis-aligned, which is why levels turn in
// quarter turns only.

import { PHYS } from '../config.js';
import { moverBox, CELL } from './levels.js';

const E = 1e-4;
let stamp = 0;

/** Set up the moving pieces of a fresh game: boxes for movers, crumbles, crates. */
export function initWorld(G) {
    const L = G.level;
    G.mbox = L.movers.map((m, i) => { const b = moverBox(m, 0); b.t = 'm'; b.ref = i; b.look = m.look; return b; });
    G.mprev = G.mbox.map((b) => ({ x0: b.x0, y1: b.y1, z0: b.z0 }));
    G.crumbs = L.crumbles.map((c, i) => ({ state: 0, t: 0, box: { x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, z0: c.z0, z1: c.z1, t: 'c', ref: i } }));
    G.gatesOpen = {};
}

/** Advance the moving world to time t. Returns nothing; records each mover's step in G.mdelta. */
export function stepWorld(G, dt) {
    const L = G.level;
    for (let i = 0; i < L.movers.length; i++) {
        const b = G.mbox[i], pv = G.mprev[i];
        pv.x0 = b.x0; pv.y1 = b.y1; pv.z0 = b.z0;
        moverBox(L.movers[i], G.t, b);
    }
    const slow = G.perks.crumble || 1;
    for (const c of G.crumbs) {
        if (c.state === 1) {
            c.t += dt;
            if (c.t > 0.62 * slow) { c.state = 2; c.t = 0; }
        } else if (c.state === 2) {
            c.t += dt;
            if (c.t > 3.6) { c.state = 0; c.t = 0; }
        }
    }
}

/** Is the crumble solid right now? It drops away a little while after it is stood on. */
export const crumbSolid = (c) => c.state < 2;

/** Call fn(box) for every solid that might touch the given rectangle. Return true from fn to stop. */
export function forSolids(G, x0, x1, z0, z1, fn) {
    const L = G.level;
    const s = ++stamp;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
            const list = L.grid.get(cx * 4096 + cz);
            if (!list) continue;
            for (let k = 0; k < list.length; k++) {
                const b = L.solids[list[k]];
                if (b._q === s) continue;
                b._q = s;
                if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
                if (fn(b)) return true;
            }
        }
    }
    for (let i = 0; i < G.mbox.length; i++) {
        const b = G.mbox[i];
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
        if (fn(b)) return true;
    }
    for (let i = 0; i < G.crumbs.length; i++) {
        const c = G.crumbs[i];
        if (!crumbSolid(c)) continue;
        const b = c.box;
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
        if (fn(b)) return true;
    }
    for (let i = 0; i < L.gates.length; i++) {
        const g = L.gates[i];
        if (G.gatesOpen[g.id]) continue;
        if (g.x1 < x0 || g.x0 > x1 || g.z1 < z0 || g.z0 > z1) continue;
        if (fn(g)) return true;
    }
    for (let i = 0; i < G.crates.length; i++) {
        const c = G.crates[i];
        if (!c.alive) continue;
        const b = c.box;
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
        if (fn(b)) return true;
    }
    return false;
}

/** The height of the highest solid top at or below `y` under (x, z), within reach `r`. -Infinity if none. */
export function groundBelow(G, x, z, y, r = 0.3) {
    let best = -Infinity;
    forSolids(G, x - r, x + r, z - r, z + r, (b) => {
        if (b.y1 <= y + 0.4 && b.y1 > best && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) best = b.y1;
        return false;
    });
    return best;
}

/** Does a box overlap the player's body at p? */
export function bodyHits(p, b, r = PHYS.radius, h = PHYS.height) {
    return p.x + r > b.x0 + E && p.x - r < b.x1 - E && p.z + r > b.z0 + E && p.z - r < b.z1 - E && p.y + h > b.y0 + E && p.y < b.y1 - E;
}

/**
 * Move the player along one axis, then push it out of whatever it ran into.
 * Sets p.hit to the box it hit; on the y axis, p.ground to the box it landed on.
 */
export function moveAxis(G, p, axis, d) {
    const r = PHYS.radius, h = PHYS.height;
    if (axis === 'x') p.x += d; else if (axis === 'z') p.z += d; else p.y += d;
    const x0 = p.x - r - 0.01, x1 = p.x + r + 0.01, z0 = p.z - r - 0.01, z1 = p.z + r + 0.01;
    forSolids(G, x0, x1, z0, z1, (b) => {
        if (!bodyHits(p, b, r, h)) return false;
        if (axis === 'y') {
            if (d <= 0) {
                if (p.y > b.y1 - 0.9 || true) { p.y = b.y1; if (p.vy < 0) p.vy = 0; p.ground = b; p.landed = true; }
            } else { p.y = b.y0 - h; if (p.vy > 0) p.vy = 0; p.bonk = true; }
            return false;
        }
        // ledges up to stepUp are walked onto
        if (b.y1 - p.y <= PHYS.stepUp && p.vy <= 0.01 && !p.launch) {
            const save = p.y; p.y = b.y1;
            let clear = true;
            forSolids(G, x0, x1, z0, z1, (c) => { if (c !== b && bodyHits(p, c, r, h)) { clear = false; return true; } return false; });
            if (clear) { p.ground = b; p.landed = true; return false; }
            p.y = save;
        }
        if (axis === 'x') { p.x = d > 0 ? b.x0 - r : b.x1 + r; p.vx = 0; } else { p.z = d > 0 ? b.z0 - r : b.z1 + r; p.vz = 0; }
        p.hit = b;
        return false;
    });
}
