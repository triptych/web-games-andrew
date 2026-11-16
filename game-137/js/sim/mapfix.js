// Making a generated map fair to walk. The noise that shapes the terrain doesn't know the mech is
// 1.24 cells wide or that a bullet heaven is lost in a cul-de-sac, so after the shapes are laid
// down every map goes through three repairs, round after round until a round changes nothing:
//
//  1. narrow: every open cell must be inside some fully open 3x3 square. Slivers narrower than
//     that are filled in (cells that must stay open get the rock round them carved instead).
//  2. connected: the "core" cells (the middle of an open 3x3, where the mech fits with room) must
//     form one 8-connected region with the landing zone. Small pockets are filled, big ones get
//     a 3-wide tunnel to the rest.
//  3. no dead ends: a core cell is "enclosed" when 26 of 32 rays from it hit rock within 11 cells
//     and the ones that escape all leave through one opening. A cluster of enclosed cells that
//     joins the rest of the map through a single mouth is a cul-de-sac: it is filled in from the
//     back, or, when something that must stay open is inside (a cage, a hive, the landing zone),
//     a tunnel is punched through its back wall to ground that is far away on foot.
//
// Works on the world's h array only (0 = open). Pure. `ctx`: { W, prot, fixed(i), fill(i) }:
// prot[i] = must stay open, fixed(i) = rock that can't be carved (the map edge, hives).

import { MAP } from '../config.js';

const MW = MAP.w, MH = MAP.h, N = MW * MH;
const RAYS = 32, RLEN = 11, RSTEP = 0.5, ENCLOSED = 26;
// rays in bit-reversed order so the first few spread round the circle (early exit when open)
const ORDER = Array.from({ length: RAYS }, (_, k) => k).sort((a, b) => rev5(a) - rev5(b));
function rev5(k) { let r = 0; for (let b = 0; b < 5; b++) r |= ((k >> b) & 1) << (4 - b); return r; }
const RDX = [], RDY = [];
for (let k = 0; k < RAYS; k++) { RDX.push(Math.cos((k / RAYS) * Math.PI * 2)); RDY.push(Math.sin((k / RAYS) * Math.PI * 2)); }
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const inner = (x, y) => x >= 1 && y >= 1 && x < MW - 1 && y < MH - 1;

/** core[i] = 1 when the 3x3 around cell i is open. */
export function coreMask(h) {
    const core = new Uint8Array(N);
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
        let ok = 1;
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (h[(y + dy) * MW + x + dx] > 0) { ok = 0; break; }
        core[y * MW + x] = ok;
    }
    return core;
}
function dilate(core) {
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
        if (!core[i]) continue;
        const x = i % MW, y = (i / MW) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out[(y + dy) * MW + x + dx] = 1;
    }
    return out;
}
/** 8-connected components of the core cells: { label, comps: [[cells]] }. */
function components(core) {
    const label = new Int32Array(N).fill(-1), comps = [];
    for (let s = 0; s < N; s++) {
        if (!core[s] || label[s] >= 0) continue;
        const id = comps.length, cells = [s];
        label[s] = id;
        for (let k = 0; k < cells.length; k++) {
            const i = cells[k], x = i % MW, y = (i / MW) | 0;
            for (const [dx, dy] of N8) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
                const j = ny * MW + nx;
                if (core[j] && label[j] < 0) { label[j] = id; cells.push(j); }
            }
        }
        comps.push(cells);
    }
    return { label, comps };
}
function carve3(ctx, i) {
    const { W, fixed } = ctx, x = i % MW, y = (i / MW) | 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inner(nx, ny)) continue;
        const j = ny * MW + nx;
        if (W.h[j] > 0 && !fixed(j)) { ctx.open(j); n++; }
    }
    return n;
}
const fixedNear = (ctx, i) => {
    const x = i % MW, y = (i / MW) | 0;
    if (!inner(x, y) || !inner(x - 1, y - 1) || !inner(x + 1, y + 1)) return true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ctx.fixed((y + dy) * MW + x + dx)) return true;
    return false;
};

// ------------------------------------------------------------------ 1. narrow
function widen(ctx) {
    // filling every open cell outside the opening is a morphological closing of the rock: after
    // it, all open ground is made of 3x3 open squares. Only cells that must stay open get the
    // rock round them carved instead.
    const { W, prot } = ctx;
    let changed = 0;
    const op = dilate(coreMask(W.h));
    for (let i = 0; i < N; i++) {
        if (W.h[i] > 0 || op[i]) continue;
        if (!prot[i]) { ctx.fill(i); changed++; } else if (carve3(ctx, i)) changed++;
    }
    return changed;
}

// ------------------------------------------------------------------ 2. connected
function connect(ctx, start) {
    const { W, prot } = ctx;
    let changed = 0;
    for (let iter = 0; iter < 60; iter++) {
        const core = coreMask(W.h);
        if (!core[start]) return -1;
        const { label, comps } = components(core);
        if (comps.length === 1) return changed;
        const main = label[start];
        const other = comps.findIndex((_, k) => k !== main);
        const cells = comps[other];
        // the open cells only this pocket uses
        const own = [];
        let guarded = false;
        const seen = new Set();
        for (const i of cells) {
            const x = i % MW, y = (i / MW) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const j = (y + dy) * MW + x + dx;
                if (seen.has(j) || W.h[j] > 0) continue;
                seen.add(j);
                if (nearLabel(label, j, main)) continue;
                own.push(j);
                if (prot[j]) guarded = true;
            }
        }
        if (cells.length < 40 && !guarded) { for (const j of own) ctx.fill(j); changed++; continue; }
        if (!tunnel(ctx, cells, (j) => label[j] === main)) return -1;
        changed++;
    }
    return -1;
}
function nearLabel(label, j, id) {
    const x = j % MW, y = (j / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && label[ny * MW + nx] === id) return true;
    }
    return false;
}
/** Breadth-first from the cells through anything carvable to the first cell `goal` accepts; carve 3 wide. */
function tunnel(ctx, from, goal) {
    const prev = new Int32Array(N).fill(-2), q = [];
    for (const i of from) { prev[i] = -1; q.push(i); }
    for (let k = 0; k < q.length; k++) {
        const i = q[k], x = i % MW, y = (i / MW) | 0;
        for (const [dx, dy] of N8) {
            const nx = x + dx, ny = y + dy;
            if (!inner(nx, ny)) continue;
            const j = ny * MW + nx;
            if (prev[j] !== -2) continue;
            prev[j] = i;
            if (goal(j)) {
                for (let c = i; c >= 0 && prev[c] !== -1; c = prev[c]) carve3(ctx, c);
                return true;
            }
            if (fixedNear(ctx, j)) continue;
            q.push(j);
        }
    }
    return false;
}

// ------------------------------------------------------------------ 3. dead ends
/** Distance (Chebyshev, capped at 6) from every cell to the nearest rock. */
function rockDistance(h) {
    const d = new Uint8Array(N).fill(6), q = [];
    for (let i = 0; i < N; i++) if (h[i] > 0) { d[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
        const i = q[k];
        if (d[i] >= 5) continue;
        const x = i % MW, y = (i / MW) | 0;
        for (const [dx, dy] of N8) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
            const j = ny * MW + nx;
            if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
        }
    }
    return d;
}
/** Rays from the middle of cell i. null when it is open enough; else { hits, arcs, ex, ey } (ex, ey: the way out). */
function scan(h, i) {
    const x0 = (i % MW) + 0.5, y0 = ((i / MW) | 0) + 0.5;
    const esc = new Uint8Array(RAYS);
    let escapes = 0;
    for (const k of ORDER) {
        let hit = false;
        for (let t = RSTEP; t <= RLEN; t += RSTEP) {
            const cx = Math.floor(x0 + RDX[k] * t), cy = Math.floor(y0 + RDY[k] * t);
            if (cx < 0 || cy < 0 || cx >= MW || cy >= MH || h[cy * MW + cx] > 0) { hit = true; break; }
        }
        if (!hit) { esc[k] = 1; if (++escapes > RAYS - ENCLOSED) return null; }
    }
    let arcs = 0, ex = 0, ey = 0;
    for (let k = 0; k < RAYS; k++) {
        if (esc[k] && !esc[(k + RAYS - 1) % RAYS]) arcs++;
        if (esc[k]) { ex += RDX[k]; ey += RDY[k]; }
    }
    return arcs > 1 ? null : { hits: RAYS - escapes, arcs, ex, ey };
}

/**
 * The cul-de-sacs of a map: clusters of enclosed core cells (reachable from `start`) that meet the
 * rest of the walkable ground through one mouth. [{ cells, info: Map(cell -> scan) }].
 */
export function deadEnds(h, start) {
    const core = coreMask(h);
    const { label } = components(core);
    const main = label[start];
    const near = rockDistance(h);
    const flag = new Map();
    for (let i = 0; i < N; i++) {
        if (label[i] !== main || near[i] > 5) continue;
        const s = scan(h, i);
        if (s) flag.set(i, s);
    }
    const out = [], done = new Set();
    for (const s of flag.keys()) {
        if (done.has(s)) continue;
        const cells = [s];
        done.add(s);
        const mouth = new Set();
        for (let k = 0; k < cells.length; k++) {
            const i = cells[k], x = i % MW, y = (i / MW) | 0;
            for (const [dx, dy] of N8) {
                const j = (y + dy) * MW + x + dx;
                if (label[j] !== main) continue;
                if (flag.has(j)) { if (!done.has(j)) { done.add(j); cells.push(j); } } else mouth.add(j);
            }
        }
        if (mouthGroups(mouth) <= 1) out.push({ cells, info: flag });
    }
    return out;
}
function mouthGroups(mouth) {
    let groups = 0;
    const seen = new Set();
    for (const s of mouth) {
        if (seen.has(s)) continue;
        groups++;
        const q = [s];
        seen.add(s);
        while (q.length) {
            const i = q.pop(), x = i % MW, y = (i / MW) | 0;
            for (const [dx, dy] of N8) {
                const j = (y + dy) * MW + x + dx;
                if (mouth.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
            }
        }
    }
    return groups;
}

function fixDeadEnds(ctx, start) {
    const { W, prot } = ctx;
    const list = deadEnds(W.h, start);
    if (!list.length) return 0;
    const core = coreMask(W.h);
    let fixed = 0;
    for (const de of list.slice(0, 40)) {
        const inside = new Set(de.cells);
        // the open cells only the pocket uses: fill them in, unless something must stay open
        const own = new Set();
        let guarded = false;
        for (const i of de.cells) {
            const x = i % MW, y = (i / MW) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const j = (y + dy) * MW + x + dx;
                if (W.h[j] > 0 || own.has(j)) continue;
                let shared = false;
                const jx = j % MW, jy = (j / MW) | 0;
                for (let ey = -1; ey <= 1 && !shared; ey++) for (let ex = -1; ex <= 1; ex++) {
                    const c = (jy + ey) * MW + jx + ex;
                    if (core[c] && !inside.has(c)) { shared = true; break; }
                }
                if (shared) continue;
                own.add(j);
                if (prot[j]) guarded = true;
            }
        }
        if (!guarded && own.size && de.cells.length <= 400) { for (const j of own) ctx.fill(j); fixed++; continue; }
        // the deepest cell: punch through its back wall
        let rep = de.cells[0];
        for (const c of de.cells) if (de.info.get(c).hits > de.info.get(rep).hits) rep = c;
        if (punch(ctx, rep, de.info.get(rep))) { fixed++; continue; }
        // nowhere to punch to (against the map edge): fill the pocket's own middle cells
        let n = 0;
        for (const i of de.cells) if (!prot[i] && W.h[i] === 0) { ctx.fill(i); n++; }
        if (!n) return -1;
        fixed++;
    }
    return fixed;
}

/** A straight 3-wide tunnel from cell `rep` through the thinnest wall to ground far away on foot. */
function punch(ctx, rep, info) {
    const { W } = ctx;
    // walking distance from rep over core cells
    const core = coreMask(W.h);
    const walk = new Int32Array(N).fill(-1);
    const q = [rep];
    walk[rep] = 0;
    for (let k = 0; k < q.length; k++) {
        const i = q[k];
        if (walk[i] >= 90) continue;
        const x = i % MW, y = (i / MW) | 0;
        for (const [dx, dy] of N8) {
            const j = (y + dy) * MW + x + dx;
            if (core[j] && walk[j] < 0) { walk[j] = walk[i] + 1; q.push(j); }
        }
    }
    const x0 = (rep % MW) + 0.5, y0 = ((rep / MW) | 0) + 0.5;
    const back = Math.atan2(-info.ey, -info.ex);
    let best = null;
    for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        let rock = 0, phase = 0, ok = false, last = -1;
        const path = [];
        for (let t = 0.5; t <= 22; t += 0.5) {
            const cx = Math.floor(x0 + Math.cos(a) * t), cy = Math.floor(y0 + Math.sin(a) * t);
            if (!inner(cx, cy)) break;
            const i = cy * MW + cx;
            if (i === last) continue;
            last = i;
            if (fixedNear(ctx, i)) break;
            path.push(i);
            if (W.h[i] > 0) { phase = 1; rock++; if (rock > 14) break; continue; }
            if (phase === 1 && core[i]) {
                const far = walk[i] < 0 || walk[i] > t + 12;
                ok = far;
                break;
            }
        }
        if (!ok) continue;
        let da = Math.abs(a - back) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
        const score = rock + da * 2;
        if (!best || score < best.score) best = { score, path };
    }
    if (!best) return false;
    for (const i of best.path) carve3(ctx, i);
    return true;
}

/** Run the repairs until a round changes nothing. True when the map came out clean. */
export function fixup(ctx, start) {
    for (let round = 0; round < 24; round++) {
        let changed = 0;
        for (let p = 0; p < 6; p++) { const n = widen(ctx); changed += n; if (!n) break; }
        const c = connect(ctx, start);
        if (c < 0) return false;
        changed += c;
        if (c) continue;               // re-check the width of the new tunnels first
        const d = fixDeadEnds(ctx, start);
        if (d < 0) return false;
        changed += d;
        if (!changed) return true;
    }
    return false;
}

/** For the tests: what is still wrong with a finished map. */
export function mapReport(h, start) {
    const core = coreMask(h);
    const op = dilate(core);
    let narrow = 0;
    for (let i = 0; i < N; i++) if (h[i] === 0 && !op[i]) narrow++;
    const { label, comps } = components(core);
    const main = label[start];
    let stray = 0;
    for (let i = 0; i < N; i++) if (h[i] === 0 && !nearLabel(label, i, main)) stray++;
    return { narrow, components: comps.length, stray, startOk: !!core[start], deadEnds: deadEnds(h, start).length };
}
