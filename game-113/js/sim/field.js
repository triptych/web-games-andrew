// Walking around a map: movement with tile collision, talking, chests, Song Crystals, triggers, exits and the roaming
// monsters that start a duel when touched. Pure.

import { PLAYER, ENEMY_FIELD, TALK_RANGE } from '../config.js';
import { MAPS, TILES, tileAt, chestsOf } from './data/maps.js';
import { startScene } from './story.js';
import { startBattle } from './battle.js';
import { giveItem, healAll } from './party.js';

const has = (G, f) => !f || !!G.flags[f];
const lacks = (G, f) => !f || !G.flags[f];
export const okFlags = (G, o) => has(G, o.need) && lacks(G, o.not);

export function loadMap(G, id, x, y) {
    const m = MAPS[id];
    G.map = id;
    const at = x === undefined ? m.spawn : [x, y];
    G.p.x = at[0]; G.p.y = at[1];
    G.p.walking = false;
    G.actors = {};
    G.field = {
        enemies: m.enemies.filter((e) => okFlags(G, e)).map((e, i) => ({ id: i, kind: e.kind, x: e.x, y: e.y, hx: e.x, hy: e.y, tx: e.x, ty: e.y, t: 0, alive: true })),
        inTrig: [],
    };
    // standing on a trigger when you arrive doesn't fire it; stepping into one does (arrival triggers say "once")
    G.field.inTrig = m.triggers.map((t, i) => (inRect(G.p, t) && !t.once ? i : -1)).filter((i) => i >= 0);
    G.safeT = Math.max(G.safeT || 0, 1);
    G.events.push({ type: 'map', id });
}

const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** The people standing on the map right now: its NPCs (by flags) and Otto at his parking spot. */
export function npcsOf(G) {
    const m = MAPS[G.map];
    const out = m.npcs.filter((n) => okFlags(G, n)).map((n) => ({ ...n }));
    if (m.travel && G.flags.metOtto) out.push({ id: 'otto', x: m.travel.x, y: m.travel.y, dir: 'down', mech: true, travel: true });
    return out;
}

export function solidAt(G, x, y) {
    const t = TILES[tileAt(G.map, Math.floor(x), Math.floor(y))];
    return !t || t.solid;
}

function blocked(G, x, y, r, npcs) {
    for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (solidAt(G, x + dx, y + dy)) return true;
    for (const n of npcs) if (Math.hypot(n.x - x, n.y - y) < r + (n.mech ? 0.55 : 0.32)) return true;
    return false;
}

/** Move a body with sliding: try both axes, then each alone. */
function moveBody(G, b, vx, vy, dt, r, npcs) {
    const nx = b.x + vx * dt, ny = b.y + vy * dt;
    if (!blocked(G, nx, ny, r, npcs)) { b.x = nx; b.y = ny; return true; }
    let moved = false;
    if (!blocked(G, nx, b.y, r, npcs)) { b.x = nx; moved = true; }
    else if (!blocked(G, b.x, ny, r, npcs)) { b.y = ny; moved = true; }
    return moved;
}

/** inp = { x, y, a, b }. */
export function stepField(G, inp, dt) {
    const p = G.p, m = MAPS[G.map];
    const npcs = npcsOf(G);
    G.safeT = Math.max(0, (G.safeT || 0) - dt);

    // ---- move
    let vx = inp.x || 0, vy = inp.y || 0;
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    if (len > 0.15) {
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        const before = p.x + p.y;
        moveBody(G, p, vx * PLAYER.speed, vy * PLAYER.speed, dt, PLAYER.radius, npcs);
        p.walking = Math.abs(p.x + p.y - before) > 1e-5;
        if (p.walking) G.stats.steps = (G.stats.steps || 0) + dt;
    } else p.walking = false;

    // ---- exits
    for (const ex of m.exits) {
        if (!inRect(p, ex)) continue;
        if (has(G, ex.need)) { loadMap(G, ex.to, ex.at[0], ex.at[1]); return; }
        // push back out the way we came, then explain
        p.y += ex.dir === 'up' ? 0.6 : ex.dir === 'down' ? -0.6 : 0;
        if (ex.blocked) { startScene(G, ex.blocked); return; }
    }

    // ---- triggers: fire on entering
    const now = [];
    for (let i = 0; i < m.triggers.length; i++) {
        const t = m.triggers[i];
        if (!inRect(p, t)) continue;
        now.push(i);
        if (G.field.inTrig.includes(i)) continue;
        if (!okFlags(G, t) || (t.once && G.flags[t.once])) continue;
        G.field.inTrig = now.concat(m.triggers.map((tt, k) => (k > i && inRect(p, tt) ? k : -1)).filter((k) => k >= 0));
        if (t.once) G.flags[t.once] = true;
        if (t.push) G.pendingPush = t.push.slice();
        startScene(G, t.scene);
        return;
    }
    G.field.inTrig = now;

    // ---- interact
    if (inp.a) { if (interact(G, npcs)) return; }

    // ---- roaming monsters
    for (const e of G.field.enemies) {
        if (!e.alive) continue;
        stepEnemy(G, e, dt, npcs);
        if (G.safeT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < PLAYER.radius + ENEMY_FIELD.radius) {
            G.events.push({ type: 'encounter', kind: e.kind });
            startBattle(G, e.kind, { from: 'field', fieldEnemy: e.id });
            return;
        }
    }
}

function stepEnemy(G, e, dt, npcs) {
    const p = G.p;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.t -= dt;
    let tx = e.tx, ty = e.ty, sp = ENEMY_FIELD.speed;
    if (d < ENEMY_FIELD.sight && G.safeT <= 0 && !p.hidden) { tx = p.x; ty = p.y; sp = ENEMY_FIELD.chase; e.chasing = true; }
    else {
        e.chasing = false;
        if (e.t <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 0.2) {
            e.t = 1.6 + G.rng() * 2.4;
            const a = G.rng() * Math.PI * 2, r = G.rng() * ENEMY_FIELD.wander;
            e.tx = e.hx + Math.cos(a) * r; e.ty = e.hy + Math.sin(a) * r;
            tx = e.tx; ty = e.ty;
        }
    }
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
    if (l < 0.05) { e.walking = false; return; }
    e.walking = moveBody(G, e, (dx / l) * sp, (dy / l) * sp, dt, ENEMY_FIELD.radius * 0.8, npcs);
    e.dir = dx > 0 ? 'right' : 'left';
    if (!e.walking) e.t = 0;
}

/** Everything the player could interact with here, nearest first. Shared with the bot and the HUD prompt. */
export function interactables(G) {
    const p = G.p, m = MAPS[G.map];
    const list = [];
    for (const n of npcsOf(G)) list.push({ kind: 'npc', id: n.id, n, x: n.x, y: n.y });
    for (const s of m.signs || []) list.push({ kind: 'sign', s, x: s.x + s.w / 2, y: s.y + s.h / 2, w: s.w, h: s.h });
    for (const c of chestsOf(G.map)) if (!G.opened[c.id]) list.push({ kind: 'chest', c, x: c.x + 0.5, y: c.y + 0.5 });
    m.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'S') list.push({ kind: 'crystal', x: x + 0.5, y: y + 0.5 }); });
    const dist = (o) => {
        if (o.w) { const cx = Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, p.x)), cy = Math.max(o.y - o.h / 2, Math.min(o.y + o.h / 2, p.y)); return Math.hypot(cx - p.x, cy - p.y) + 0.3; }
        return Math.hypot(o.x - p.x, o.y - p.y);
    };
    return list.map((o) => ({ ...o, d: dist(o) })).filter((o) => o.d <= TALK_RANGE).sort((a, b) => a.d - b.d);
}

function sceneFor(G, talk, fallback) {
    if (!talk) return fallback;
    const t = talk.find((x) => okFlags(G, x));
    return t ? t.scene : fallback;
}

function interact(G, npcs) {
    const o = interactables(G)[0];
    if (!o) return false;
    const p = G.p;
    const dx = o.x - p.x, dy = o.y - p.y;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (o.kind === 'npc') {
        const scene = o.n.travel ? (G.flags.surface ? 'otto' : 'lift') : sceneFor(G, o.n.talk, null);
        if (scene) startScene(G, scene);
    } else if (o.kind === 'sign') {
        const sc = o.s.scene === 'lift' && G.flags.surface ? 'liftAgain' : o.s.scene;
        if (o.s.scene === 'lift' && !G.flags.metOtto) return false;
        startScene(G, sc);
    } else if (o.kind === 'chest') {
        G.opened[o.c.id] = true;
        giveItem(G, o.c.item);
        G.events.push({ type: 'chest', item: o.c.item, x: o.c.x, y: o.c.y });
    } else if (o.kind === 'crystal') {
        healAll(G, 1);
        G.lastCrystal = { map: G.map, x: p.x, y: p.y };
        G.events.push({ type: 'crystal', x: o.x, y: o.y });
    }
    return true;
}
