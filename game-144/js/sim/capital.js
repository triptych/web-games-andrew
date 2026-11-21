// Capital ships: hulls far bigger than the screen that scroll past (or that you fly inside). Their hull blocks are
// solid walls (js/sim/player.js pushes the ship out of them and crashes it if the scroll pins it); turrets and
// engines are mounted enemies. Break every engine and the whole ship goes down. Pure.
//
// A capital is { id, kind, x, y, speed, len, blocks: [{x,y,w,h}] (local), parts: [{lx,ly,type,id}], engines }.

import { FIELD, SCROLL } from '../config.js';
import { hash3 } from '../rng.js';
import { spawnEnemy, killEnemy, ev, addScore, cancelBullets, dropItem, pickPowerup } from './core.js';

/** The escort frigate: a long hull in the middle of the screen; engines along its back half. */
function frigate(seed) {
    const blocks = [
        { x: 0, y: 6.5, w: 6, h: 5 },            // prow
        { x: 6, y: 5.6, w: 30, h: 6.8 },         // hull
        { x: 12, y: 3.8, w: 7, h: 1.8 },         // bridge tower
        { x: 24, y: 12.4, w: 8, h: 1.4 },        // keel
        { x: 36, y: 6.2, w: 4, h: 5.6 },         // engine block
    ];
    const parts = [
        { lx: 3, ly: 6.2, type: 'turret' }, { lx: 3, ly: 11.8, type: 'turret' },
        { lx: 10, ly: 5.2, type: 'turret' }, { lx: 15.5, ly: 3.3, type: 'bigturret' }, { lx: 21, ly: 5.2, type: 'turret' },
        { lx: 10, ly: 12.8, type: 'turret' }, { lx: 28, ly: 14.2, type: 'bigturret' },
        { lx: 30, ly: 5.0, type: 'engine' }, { lx: 41, ly: 7.4, type: 'engine' }, { lx: 41, ly: 10.6, type: 'engine' },
    ];
    void seed;
    return { len: 42, blocks, parts };
}

/** Inside the mothership: a corridor between a ceiling and a floor of varying depth, pillars, wall turrets and
 *  reactor engines. Deterministic from the seed. The gap is never narrower than MIN_GAP (tested). */
export const MIN_GAP = 5.2;
export function mothership(seed, len = 210) {
    const blocks = [], parts = [];
    const W = 4;
    let engines = 0;
    for (let i = 0; i * W < len; i++) {
        const x = i * W;
        const r1 = hash3(seed, i, 1), r2 = hash3(seed, i, 2);
        const wave = Math.sin(i * 0.37 + seed) * 0.5 + 0.5;
        let top = 0.6 + wave * 4.2 + r1 * 1.2;
        let bot = 0.6 + (1 - wave) * 4.2 + r2 * 1.2;
        if (i < 3) { top = 0.6; bot = 0.6; }              // a clean mouth to enter by
        const gap = FIELD.h - top - bot;
        if (gap < MIN_GAP + 1.5) { const k = (MIN_GAP + 1.5) / gap; top /= k; bot /= k; }
        blocks.push({ x, y: -2, w: W, h: top + 2 });
        blocks.push({ x, y: FIELD.h - bot, w: W, h: bot + 2 });
        // pillars stand in the corridor but always leave room on one side
        if (i > 4 && i % 7 === 3 && FIELD.h - top - bot > 11) {
            const mid = top + (FIELD.h - top - bot) * (r1 < 0.5 ? 0.38 : 0.62);
            blocks.push({ x: x + 1, y: mid - 1.6, w: 1.6, h: 3.2 });
        }
        if (i > 3 && i % 3 === 0) parts.push({ lx: x + 2, ly: r2 < 0.5 ? top + 0.7 : FIELD.h - bot - 0.7, type: i % 9 === 0 ? 'bigturret' : 'turret' });
        if (i > 6 && i % 11 === 5 && engines < 5) {
            engines++;
            parts.push({ lx: x + 2, ly: r1 < 0.5 ? top + 1.2 : FIELD.h - bot - 1.2, type: 'engine' });
        }
    }
    return { len, blocks, parts };
}

export function startCapital(G, kind, o = {}) {
    const def = kind === 'frigate' ? frigate(G.stageSeed) : mothership(G.stageSeed, o.len || 210);
    G.capital = {
        id: G.nextId++, kind, x: o.x ?? FIELD.w + 2, y: 0, vy: 0, speed: o.speed ?? SCROLL, len: def.len,
        blocks: def.blocks, parts: def.parts.map((p) => ({ ...p, id: null, done: false })),
        engines: def.parts.filter((p) => p.type === 'engine').length, enginesDown: 0, broken: false, t: 0,
    };
    ev(G, 'capital', { kind, len: def.len });
}

export function stepCapital(G, dt) {
    const C = G.capital;
    G.walls.length = 0;
    if (!C) return;
    C.t += dt;
    C.x -= C.speed * dt;
    if (C.broken) { C.vy += 2.5 * dt; C.y += C.vy * dt; }
    else {
        for (const b of C.blocks) {
            const x = C.x + b.x;
            if (x > FIELD.w + 6 || x + b.w < -6) continue;
            G.walls.push({ x, y: C.y + b.y, w: b.w, h: b.h });
        }
    }
    // mount parts as they come on screen
    for (const p of C.parts) {
        if (p.done) continue;
        const wx = C.x + p.lx;
        if (p.id == null && wx < FIELD.w + 3 && !C.broken) {
            const e = spawnEnemy(G, p.type, wx, C.y + p.ly, { parent: C.id, ox: p.lx, oy: p.ly, part: 'capital', force: true, delay: 0.4 });
            if (e) p.id = e.id;
        } else if (p.id != null) {
            const e = G.byId.get(p.id);
            if (!e || e.dead) {
                p.done = true;
                if (p.type === 'engine' && e && e.dead && e.hp <= 0 && wx > -1) {
                    C.enginesDown++;
                    ev(G, 'engineDown', { x: wx, y: C.y + p.ly, left: C.engines - C.enginesDown });
                    if (C.enginesDown >= C.engines && !C.broken) breakCapital(G);
                }
            }
        }
    }
    if (C.x + C.len < -4 || C.y > 30) { G.capital = null; G.walls.length = 0; }
}

function breakCapital(G) {
    const C = G.capital;
    C.broken = true;
    G.capitalsBroken++;
    addScore(G, 50000);
    for (const e of G.enemies) if (e.parent === C.id && !e.dead) killEnemy(G, e, 'break');
    cancelBullets(G, () => true, true, 200);
    for (let i = 0; i < 3; i++) dropItem(G, pickPowerup(G), Math.min(28, Math.max(10, C.x + C.len / 2)), 5 + i * 4);
    ev(G, 'capitalBreak', { kind: C.kind, x: C.x, len: C.len });
}

/** For the mothership's bonus: how many of its engines are down (also read by the stage-3 boss). */
export function capitalEnginesDown(G) { return G.capital ? G.capital.enginesDown : G.lastEnginesDown || 0; }
