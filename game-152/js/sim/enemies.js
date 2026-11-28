// Small enemies: where they are placed on a new stretch of river, how they move, when they shoot. Pure.

import { ENEMIES, PICKUPS } from './data.js';
import { riverAt } from './river.js';
import { fire, lockAim } from './patterns.js';
import { SECTOR } from '../config.js';

/** Weighted pick from { kind: weight }. */
export function pickWeighted(rng, table) {
    let sum = 0;
    for (const k in table) sum += table[k];
    let x = rng() * sum;
    for (const k in table) { x -= table[k]; if (x < 0) return k; }
    return Object.keys(table)[0];
}

/**
 * Fill a new segment with spawns. Spawns are queued by y and made real when the boat comes within view.
 * Each spawn says where across the river it sits as a side (-1 / 1) or a fraction f of the open water.
 */
export function placeSegment(G, seg, rng, sd) {
    if (seg.type === 'arena' || seg.type === 'lead') return;
    const len = seg.len;
    const q = G.spawnQ;
    if (seg.y0 < 90) {
        // the opening stretch: a depot and a cell to learn on, two easy patrols
        q.push({ y: 70, kind: 'depot', f: -0.3 }, { y: 120, kind: 'patrol', f: 0.3 }, { y: 135, kind: 'patrol', f: -0.4 });
        q.push({ y: 100, kind: 'pickup', item: 'cell', f: 0.5 });
        return;
    }
    const n = Math.max(1, Math.round((len / 34) * sd.density * (1 + G.sector * 0.08)));
    for (let i = 0; i < n; i++) {
        const kind = pickWeighted(rng, sd.kinds);
        const y = seg.y0 + 10 + rng() * (len - 20);
        const s = { y, kind, f: rng.range(-0.75, 0.75), side: rng() < 0.5 ? -1 : 1 };
        if (kind === 'blockade') {
            // a gap in the boom 40% of the time; otherwise the river is closed: jump it or shoot it
            s.gap = rng() < 0.4 ? rng.range(-0.6, 0.6) : null;
        }
        if (kind === 'raider' && rng() < 0.5) {
            // raiders often come in pairs
            q.push({ ...s, y: y + 6, f: Math.max(-0.8, Math.min(0.8, s.f + 0.35)) });
        }
        q.push(s);
    }
    // fuel: a depot every ~190 m, offset across the river
    for (let y = Math.ceil(seg.y0 / 190) * 190; y < seg.y0 + len; y += 190) {
        if (y > 150) q.push({ y: y + rng.range(-20, 20), kind: 'depot', f: rng.range(-0.55, 0.55) });
    }
    // a floating pickup now and then
    if (rng() < 0.45) {
        const table = {};
        for (const k in PICKUPS) if (PICKUPS[k].weight) table[k] = PICKUPS[k].weight;
        q.push({ y: seg.y0 + rng() * len, kind: 'pickup', item: pickWeighted(rng, table), f: rng.range(-0.6, 0.6) });
    }
    if (seg.bridge) {
        const by = seg.y0 + len / 2;
        q.push({ y: by, kind: 'bridge' });
        q.push({ y: by, kind: 'tank', onBridge: true, f: -0.35 }, { y: by, kind: 'tank', onBridge: true, f: 0.35 });
    }
    q.sort((a, b) => a.y - b.y);
}

/** A spot on open water for fraction f (−1 left bank … 1 right bank), on the right side of any sandbar. */
export function waterX(R, y, f, margin = 1.6) {
    const r = riverAt(R, y);
    if (r.isl > 0) {
        const side = f < 0 ? -1 : 1;
        const inner = r.isl + margin, outer = r.hw - margin;
        const t = Math.abs(f);
        return r.cx + side * (inner + (outer - inner) * Math.min(1, t));
    }
    return r.cx + f * Math.max(0, r.hw - margin);
}

/** Turn a queued spawn into a live enemy (or a bridge / pickup). */
export function spawn(G, s) {
    const R = G.river;
    if (s.kind === 'pickup') {
        G.pickups.push({ id: G.nextId++, kind: s.item, x: waterX(R, s.y, s.f), y: s.y, value: 1, t: 0 });
        return;
    }
    if (s.kind === 'bridge') {
        const r = riverAt(R, s.y);
        G.bridges.push({ id: G.nextId++, y: s.y, cx: r.cx, hw: r.hw + 6, hp: 20, down: false });
        return;
    }
    const d = ENEMIES[s.kind];
    const r = riverAt(R, s.y);
    let x;
    if (s.onBridge) x = r.cx + s.f * r.hw;
    else if (d.where === 'bank' && s.kind === 'tank') x = r.cx + s.side * (r.hw - 1.5);
    else if (d.where === 'bank') x = r.cx + s.side * (r.hw + (s.kind === 'turret' ? 5.5 : 3));
    else x = waterX(R, s.y, s.f, d.r + 0.6);
    const e = {
        id: G.nextId++, kind: s.kind, x, y: s.y, hp: d.hp * (1 + G.sector * 0.15), max: 0, home: x,
        vx: 0, vy: d.speed, t: 0, fireT: d.fire ? d.fire.every * (0.4 + 0.6 * ((G.nextId * 0.618) % 1)) : 0,
        tele: 0, aim: 0, mode: 'idle', onBridge: !!s.onBridge, side: s.side || Math.sign(x - r.cx) || 1, hit: 0,
    };
    e.max = e.hp;
    if (s.kind === 'blockade') {
        e.x = r.cx;
        e.gap = s.gap;                    // null = fully closed
        e.w = r.hw;
    }
    if (s.kind === 'depot') e.vy = 0;
    G.enemies.push(e);
}

/** Move and shoot. Returns nothing; fire goes into G.bullets via patterns.fire. */
export function stepEnemies(G, dt) {
    const b = G.boat, R = G.river;
    for (const e of G.enemies) {
        const d = ENEMIES[e.kind];
        e.t += dt;
        if (e.hit > 0) e.hit -= dt;
        const dy = e.y - b.y;
        // ---- movement
        if (e.kind === 'raider') {
            if (e.mode === 'idle' && dy < 48) { e.mode = 'charge'; G.events.push({ type: 'raider', id: e.id, x: e.x, y: e.y }); }
            if (e.mode === 'charge') {
                e.vy = -d.charge;
                const want = dy > 4 ? Math.max(-9, Math.min(9, (b.x - e.x) * 2.2)) : e.vx;
                e.vx += (want - e.vx) * Math.min(1, dt * 3);
            }
        } else if (e.kind === 'patrol' || e.kind === 'gunboat') {
            const amp = e.kind === 'patrol' ? 4 : 2.5;
            const tx = e.home + Math.sin(e.t * (e.kind === 'patrol' ? 0.9 : 0.55) + e.id) * amp;
            e.vx = (tx - e.x) * 2;
        } else if (e.kind === 'mine') {
            e.vx = 0;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (d.where === 'water' && e.kind !== 'blockade') {
            // stay on open water
            const r = riverAt(R, e.y);
            const lim = r.hw - d.r - 0.4;
            e.x = Math.max(r.cx - lim, Math.min(r.cx + lim, e.x));
            if (r.isl > 0 && Math.abs(e.x - r.cx) < r.isl + d.r) e.x = r.cx + Math.sign(e.x - r.cx || 1) * (r.isl + d.r);
        }
        // ---- shooting: only while the boat is in front of the gun and close enough to see it
        if (!d.fire || dy < 6 || dy > 78) { e.tele = 0; continue; }
        e.fireT -= dt;
        if (e.tele <= 0 && e.fireT <= d.fire.tele) {
            e.tele = d.fire.tele;
            e.aim = lockAim(G, e.x, e.y);
            G.events.push({ type: 'tele', id: e.id, kind: e.kind, laser: !!d.fire.laser });
        }
        if (e.tele > 0) {
            e.tele -= dt;
            if (e.tele <= 0) {
                fire(G, d.fire, e.x, e.y, e.aim, e.vy, 'e:' + e.id);
                e.fireT = d.fire.every * (1 - G.sector * 0.08);
            }
        }
    }
}

/** Drop what is far behind the boat. Raiders that charge past are dropped too. */
export function cullEnemies(G) {
    const lim = G.boat.y - SECTOR.behind;
    for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].y < lim) G.enemies.splice(i, 1);
    for (let i = G.pickups.length - 1; i >= 0; i--) if (G.pickups[i].y < lim) G.pickups.splice(i, 1);
    for (let i = G.bridges.length - 1; i >= 0; i--) if (G.bridges[i].y < lim - 20) G.bridges.splice(i, 1);
}
