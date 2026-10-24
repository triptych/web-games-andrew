// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the attract-mode demo all exercise the real rules. It follows the route the level
// builder recorded (slab to slab, with the shell each hop needs), and has a tactic for each boss.
// Pure, like the rest of js/sim.

import { PHYS } from '../config.js';
import { reach } from './levels.js';
import { arenaLocal } from './boss.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, idx: 0, stuckT: 0, lastX: 0, lastZ: 0, side: 0, sideT: 0, charge: 0, airT: 0, did: {}, phase: '', swapAt: -9 };
}

const NONE = { x: 0, y: 0, jump: false, jumpHeld: false, spin: false, power: false, powerHeld: false, swap: 0, sel: 0 };

function boxOf(G, n) {
    if (n.t === 's') return G.level.solids[n.i];
    if (n.t === 'm') return G.mbox[n.i];
    if (n.t === 'c') return G.crumbs[n.i].box;
    return null;
}
function nearestPt(b, x, z, inset = 0.45) {
    const ix = Math.min(inset, (b.x1 - b.x0) / 2 - 0.05), iz = Math.min(inset, (b.z1 - b.z0) / 2 - 0.05);
    return [Math.max(b.x0 + ix, Math.min(b.x1 - ix, x)), Math.max(b.z0 + iz, Math.min(b.z1 - iz, z))];
}
function rectDist(p, b) {
    const dx = Math.max(b.x0 - p.x, p.x - b.x1, 0), dz = Math.max(b.z0 - p.z, p.z - b.z1, 0);
    return Math.hypot(dx, dz);
}
const predicted = (G, n, dt) => {
    if (n.t !== 'm') return boxOf(G, n);
    const m = G.level.movers[n.i], t = G.t + dt;
    const k = Math.sin(((t / m.period) + m.phase) * Math.PI * 2);
    return { x0: m.x0 + m.amp[0] * k, x1: m.x1 + m.amp[0] * k, y0: m.y0 + m.amp[1] * k, y1: m.y1 + m.amp[1] * k, z0: m.z0 + m.amp[2] * k, z1: m.z1 + m.amp[2] * k };
};

/** Turn a world-space direction into the stick the sim expects (relative to the camera). */
function stick(G, dx, dz, mag = 1) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return [0, 0];
    dx /= l; dz /= l;
    const c = G.cam.yaw, fx = -Math.sin(c), fz = -Math.cos(c), rx = Math.cos(c), rz = -Math.sin(c);
    return [(dx * rx + dz * rz) * mag, -(dx * fx + dz * fz) * mag];
}

export function botInput(G, bot) {
    const inp = route(G, bot);
    return unstick(G, bot, inp);
}

function route(G, bot) {
    const L = G.level, p = G.p;
    const inp = { ...NONE };
    if (G.status !== 'play' || p.dead > 0) return inp;
    const want = (shell) => { if (p.shell !== shell && G.t - bot.swapAt > 0.3 && p.swapCool <= 0) { inp.sel = shell + 1; bot.swapAt = G.t; } return p.shell === shell; };
    const go = (tx, tz, mag = 1) => { const [x, y] = stick(G, tx - p.x, tz - p.z, mag); inp.x = x; inp.y = y; bot.gx = tx; bot.gz = tz; };

    // ---- fight a boss once the route has reached the arena
    if (G.boss && bot.idx >= L.nav.length) { bossTactic(G, bot, inp, want, go); return inp; }

    // ---- a crate in the way gets a spin
    for (const c of G.crates) {
        if (!c.alive || c.kind === 'iron') continue;
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
        if (d < 1.9 && Math.abs(c.y - p.y) < 1.2 && p.spinCool <= 0 && p.grounded && (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) > 0.5) { inp.spin = true; break; }
    }

    // ---- an enemy in the way gets a spin
    for (const e of G.enemies) {
        if (!e.alive || e.kind === 'cannon' || e.kind === 'knight') continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 2.0 && Math.abs(e.y - p.y) < 1.4 && p.spinCool <= 0) { inp.spin = true; break; }
    }

    // ---- keep our place in the route after a fall or a respawn
    if (p.grounded && p.ground) {
        for (let j = 0; j < L.nav.length; j++) {
            const n = L.nav[j];
            if ((n.t === 's' || n.t === 'm' || n.t === 'c') && boxOf(G, n) === p.ground) { if (j + 1 > bot.idx || bot.idx - j > 6) bot.idx = j + 1; break; }
        }
    }

    // ---- skip finished switches and used barrels
    while (bot.idx < L.nav.length) {
        const n = L.nav[bot.idx];
        if (n.t === 'sw') { const si = L.switches.findIndex((s) => s.gate === n.gate); if (G.switchesDown[si]) { bot.idx++; continue; } }
        if (n.t === 'bar' && (G.barrels[n.i].cool > 0 || p.launch)) { bot.idx++; continue; }
        break;
    }
    if (bot.idx >= L.nav.length) {
        if (L.goal) go(L.goal.x, L.goal.z);
        return inp;
    }
    const n = L.nav[bot.idx];

    // ---- a switch: stand on it and pound
    if (n.t === 'sw') {
        want(2);
        const d = Math.hypot(n.x - p.x, n.z - p.z);
        go(n.x, n.z, d < 0.5 ? 0 : 1);
        if (p.shell === 2 && d < 0.9 && p.grounded && p.slam === 0) inp.power = true;
        return inp;
    }
    // ---- a barrel: walk into it
    if (n.t === 'bar') {
        const b = L.launchers[n.i];
        go(b.x, b.z);
        if (Math.hypot(b.x - p.x, b.z - p.z) < 2.0 && p.grounded && p.y < b.y + 0.2) inp.jump = false;
        return inp;
    }

    // ---- a hop to the next slab
    const target = boxOf(G, n);
    const cur = p.ground;
    const tc = [(target.x0 + target.x1) / 2, (target.z0 + target.z1) / 2];
    const dist = rectDist(p, predicted(G, n, 0.0));
    let via = n.via;
    const moving = n.t === 'm' || (cur && cur.t === 'm');
    if (moving && via === 'walk') via = 'jump';

    // choose the shell this hop needs
    if (via === 'glide' || via === 'vent') want(3);
    else if (via === 'hop') want(4);
    else if (via === 'roll' || via === 'jump' || via === 'walk' || via === 'bounce') want(0);

    // where to run to: the edge of this slab nearest the next one
    let ex, ez;
    if (cur && p.grounded) [ex, ez] = nearestPt(cur, tc[0], tc[1], via === 'walk' ? 0.4 : 0.5);
    else [ex, ez] = nearestPt(target, p.x, p.z, 0.9);
    const aim = nearestPt(predicted(G, n, 0.25), p.x, p.z, 1.0);
    const jumpGo = (mode) => {
        if (!p.grounded) return false;
        return mode;
    };

    if (!p.grounded) {
        bot.airT += 1;
        inp.jumpHeld = true;
        go(aim[0], aim[1]);
        const tgt = predicted(G, n, 0.25);
        if (via === 'roll' && p.shell === 0 && p.rollT <= 0 && p.rollCool <= 0 && !bot.did.roll && dist > 1.5) { inp.power = true; bot.did.roll = true; }
        if (via === 'glide' && p.shell === 3 && p.vy < 3 && !p.glide) { inp.jump = true; inp.jumpHeld = true; }
        if (via === 'glide' || via === 'vent') inp.jumpHeld = true;
        if (via === 'vent' && p.shell === 3) {
            // ride the column up before sliding over
            const col = L.vents.find((v) => Math.hypot(v.x - p.x, v.z - p.z) < v.r + 0.6 && p.y > v.y - 0.3 && p.y < v.y + v.height);
            if (col && p.y < tgt.y1 + 2.0) { go(col.x, col.z, 0.4); if (!p.glide) { inp.jump = true; } }
        }
        if (via === 'bounce') inp.jumpHeld = true;
        return inp;
    }
    bot.did.roll = false; bot.airT = 0;

    // grounded: walk to the edge, then leave
    const dEdge = Math.hypot(ex - p.x, ez - p.z);
    go(ex, ez);
    const tgtPred = predicted(G, n, 0.4);
    const dPred = rectDist(p, tgtPred);
    const dy = tgtPred.y1 - (cur ? cur.y1 : p.y);

    if (via === 'walk') {
        go(tc[0], tc[1]);
    } else if (via === 'bounce') {
        // run onto the nearest sponge on this slab
        let best = null, bd = 1e9;
        for (const s of L.springs) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd && Math.abs(s.y - p.y) < 1.0) { bd = d; best = s; } }
        if (best) { go(best.x + (tc[0] - best.x) * 0.03, best.z + (tc[1] - best.z) * 0.03); }
    } else if (via === 'vent') {
        const v = L.vents.find((q) => Math.abs(q.y - p.y) < 1.0 && Math.hypot(q.x - p.x, q.z - p.z) < 14);
        if (v) {
            go(v.x, v.z, Math.hypot(v.x - p.x, v.z - p.z) < 0.5 ? 0 : 1);
            if (p.shell === 3 && Math.hypot(v.x - p.x, v.z - p.z) < 1.0) { inp.jump = true; inp.jumpHeld = true; }
        }
    } else if (via === 'hop') {
        if (p.shell === 4 && dEdge < 0.5) {
            go(ex, ez, 0);
            bot.charge += 1;
            inp.powerHeld = bot.charge < 100;
            if (!inp.powerHeld) { bot.charge = 0; }
        }
    } else {
        // jump and roll: leave from the edge; a mover is waited for
        const reachNow = Math.min(2.4, reach(via, Math.max(dy, 0)) * 0.5);
        const ready = moving ? dPred <= reachNow : dEdge < 0.4;
        if (ready) { inp.jump = true; inp.jumpHeld = true; }
        else if (moving && dPred > reachNow) { go(ex, ez, dEdge < 0.4 ? 0 : 1); }
    }

    return inp;
}

/** Stuck behind a crate or a wall: hop, then sidestep. */
function unstick(G, bot, inp) {
    const p = G.p;
    if (G.boss && bot.idx >= G.level.nav.length) return inp;
    const moved = Math.hypot(p.x - bot.lastX, p.z - bot.lastZ);
    bot.lastX = p.x; bot.lastZ = p.z;
    if (moved < 0.004 && (inp.x || inp.y) && p.stun <= 0 && !p.launch) bot.stuckT += 1; else bot.stuckT = Math.max(0, bot.stuckT - 3);
    if (bot.stuckT > 80 && !inp.powerHeld) {
        inp.jump = true; inp.jumpHeld = true;
        if (bot.stuckT > 140) { bot.side = (bot.side || 1) * -1; bot.sideT = 60; bot.stuckT = 0; }
    }
    if (bot.sideT > 0) {
        bot.sideT--;
        const [sx, sy] = stick(G, -(bot.gz - p.z) * bot.side, (bot.gx - p.x) * bot.side, 0.8);
        inp.x = inp.x * 0.5 + sx; inp.y = inp.y * 0.5 + sy;
    }
    return inp;
}

// ---------------------------------------------------------------- the boss fights
function bossTactic(G, bot, inp, want, go) {
    const p = G.p, B = G.boss, A = G.level.arena;
    if (!B.alive) { return; }
    const dB = Math.hypot(B.x - p.x, B.z - p.z);

    // hop the rings
    for (const rg of G.rings) {
        const d = Math.hypot(p.x - rg.x, p.z - rg.z);
        if (Math.abs(d - rg.r) < 1.9 && p.grounded && p.y < rg.y + 0.3) { inp.jump = true; inp.jumpHeld = true; }
    }

    if (B.kind === 'coco') {
        want(1);
        if (p.shell === 1) {
            inp.powerHeld = true;
            // stand a good way off, always facing him
            const [la, lb] = arenaLocal(G, p.x, p.z);
            const ideal = A.half * 0.1;
            const dx = B.x - p.x, dz = B.z - p.z;
            if (dB > 9) go(B.x, B.z, 0.9);
            else if (dB < 5) go(p.x - dx, p.z - dz, 0.6);
            else go(B.x, B.z, 0.2);
            void la; void lb; void ideal;
        }
    } else if (B.kind === 'sandy') {
        if (B.state === 'dazed') {
            want(0);
            go(B.x, B.z, dB < 1.8 ? 0.0 : 1);
            if (dB < 3.0 && p.spinCool <= 0) inp.spin = true;
        } else {
            want(2);
            if (p.shell === 2) {
                if (dB > 3.6) go(B.x, B.z, 1); else go(B.x, B.z, 0.1);
                if (dB < 4.2 && p.grounded && p.slam === 0 && (B.state === 'walk' || B.state === 'wind' || B.state === 'recover')) inp.power = true;
            }
        }
    } else {
        // Squawk
        if (B.state === 'stuck') {
            want(0);
            go(B.x, B.z, dB < 1.6 ? 0 : 1);
            if (dB < 3.2 && p.spinCool <= 0) inp.spin = true;
        } else if (B.state === 'dive' || B.state === 'hurtfly') {
            go(p.x - (B.x - p.x), p.z - (B.z - p.z), 0.5);
        } else {
            want(2);
            if (p.shell === 2) {
                go(B.x, B.z, dB < 2.5 ? 0.2 : 1);
                if (dB < 4.8 && p.grounded && p.slam === 0) inp.power = true;
            }
        }
    }
}
