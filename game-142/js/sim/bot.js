// An auto-player. It plays through the same input the player uses ({ aim, ammo, a }), so the
// tests, the balance table and the title-screen demo all exercise the real rules. Pure.
//
// Each shot: pick a standing character, pick a ball (a Boom Ball for a crowd, Big Bertha for a
// tall perch), solve the low and the high arc, keep the arc whose predicted flight actually
// reaches the target (or lands closest), then fire. skill < 1 adds aim error.

import { AMMO, AMMO_ORDER } from '../config.js';
import { hash3 } from '../rng.js';
import { solveAim, predict } from './aim.js';

const NONE = { x: 0, y: 0, a: false, aim: null, ammo: null };

export function makeBot({ skill = 1, settle = 2.2 } = {}) {
    return { skill, settle, plan: null };
}

const standing = (G) => G.W.bodies.filter((b) => b.kind === 'char' && !b.bonked);

function pickAmmo(G, target, chars) {
    const has = (k) => G.ammo[k] > 0;
    const crowd = chars.filter((c) => Math.hypot(c.p[0] - target.p[0], c.p[1] - target.p[1], c.p[2] - target.p[2]) < 3.2).length;
    if (crowd >= 2 && has('boom')) return 'boom';
    if (target.p[1] > 5 && has('bertha')) return 'bertha';
    for (const k of ['iron', 'triple', 'boing', 'bertha', 'boom']) if (has(k)) return k;
    return AMMO_ORDER.find(has) || null;
}

function planShot(G, bot) {
    const chars = standing(G);
    if (!chars.length) return null;
    // lowest first: knocking out what is underneath tends to bring the rest down
    const order = [...chars].sort((a, b) => a.p[1] - b.p[1] || a.p[0] - b.p[0]);
    let best = null;
    for (const target of order) {
        const kind = pickAmmo(G, target, chars);
        if (!kind) return null;
        for (const aim of solveAim(target.p, AMMO[kind].speed)) {
            // refine for damping: nudge the pitch until the flight passes through the target
            let a = { ...aim };
            let f = predict(G, a, kind);
            for (let k = 0; k < 3 && f.body !== target; k++) {
                const hit = f.hit || f.pts[f.pts.length - 1];
                const dh = Math.hypot(hit[0], hit[2]) - Math.hypot(target.p[0], target.p[2]);
                if (Math.abs(dh) > 4) break;
                a = { yaw: a.yaw, pitch: a.pitch - dh * 0.012 * (a.pitch > 0.6 ? -1 : 1) };
                f = predict(G, a, kind);
            }
            const hit = f.hit || f.pts[f.pts.length - 1];
            const miss = f.body === target ? 0 : Math.hypot(hit[0] - target.p[0], hit[1] - target.p[1], hit[2] - target.p[2]);
            const score = miss + (aim.pitch > 0.6 ? 0.4 : 0);          // prefer the flatter arc a little
            if (!best || score < best.score) best = { aim: a, kind, target: target.id, score };
            if (miss === 0) break;
        }
        if (best && best.score < 0.5) break;
    }
    if (!best) return null;
    const j = (1 - bot.skill);
    const h1 = hash3(G.seed, G.shots, 1), h2 = hash3(G.seed, G.shots, 2);
    best.aim = { yaw: best.aim.yaw + (h1 - 0.5) * 2 * j * 0.06, pitch: best.aim.pitch + (h2 - 0.5) * 2 * j * 0.05 };
    return best;
}

export function botInput(G, bot) {
    if (G.state !== 'aim') {
        return trick(G, bot) || NONE;
    }
    const t = trick(G, bot);
    if (t) return t;
    if (G.reload > 0 || G.W.bodies.some((b) => b.kind === 'ball' && b.live)) return NONE;
    if (G.t - G.lastShot < bot.settle) return NONE;
    if (!bot.plan || bot.plan.shots !== G.shots) {
        const p = planShot(G, bot);
        if (!p) return NONE;
        bot.plan = { ...p, shots: G.shots, set: false };
    }
    const p = bot.plan;
    if (!p.set) { p.set = true; return { ...NONE, aim: p.aim, ammo: p.kind }; }
    return { ...NONE, aim: p.aim, ammo: p.kind, a: true };
}

/** Triple Trouble splits when it is close to the castle. */
function trick(G, bot) {
    const b = G.W.bodies.find((x) => x.kind === 'ball' && x.live && !x.tricked && AMMO[x.ammo].special === 'split');
    if (!b) return null;
    if (b.p[2] > 18) return { ...NONE, a: true };
    return null;
}
