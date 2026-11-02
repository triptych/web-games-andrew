// An auto-player. It plays through the same inputs the player uses: it walks to whatever objective() points at, talks,
// opens chests, rests at Song Crystals when the band is hurt, rides Otto's route map, and plays the duels at a given skill.
// The tests use it to play the whole story; the title screen could use it for an attract mode. Pure.

import { makeRng } from '../rng.js';
import { MAPS, TILES, WORLD, tileAt, chestsOf, crystalOf } from './data/maps.js';
import { objective } from './story.js';
import { interactables, npcsOf } from './field.js';
import { maxHp } from './party.js';

/** skill 1: every note PERFECT. Lower: timing error grows and some notes are missed. */
export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), plan: {}, hold: [0, 0, 0, 0], path: null, goalKey: '', stuckT: 0, lastPos: null, jiggle: 0, aT: 0 };
}

const NONE = { x: 0, y: 0, a: false, b: false, lanes: [], held: [false, false, false, false], cres: null, pick: null, cmd: null };

export function botInput(G, bot) {
    switch (G.mode) {
        case 'scene': case 'results': return { ...NONE, a: true };
        case 'defeat': return { ...NONE, pick: 'retry' };
        case 'worldmap': {
            const o = objective(G);
            const node = o && Object.keys(WORLD).find((k) => WORLD[k].map === o.map && G.flags[WORLD[k].need]);
            return { ...NONE, pick: node || Object.keys(WORLD).find((k) => G.flags[WORLD[k].need]) };
        }
        case 'battle': return battleInput(G, bot);
        case 'field': return fieldInput(G, bot);
        default: return NONE;
    }
}

// ---------------------------------------------------------------- battle
function battleInput(G, B0bot) {
    const B = G.battle, bot = B0bot;
    const inp = { ...NONE, lanes: [], held: [false, false, false, false] };
    if (B.state === 'talk') { inp.a = true; return inp; }
    if (B.state !== 'run') return inp;
    const s = bot.skill;
    // note ids start again in every duel (and on a retry): forget the last one's plan
    const bid = G.stats.battles + ':' + B.song.seed;
    if (bot.bid !== bid) { bot.bid = bid; bot.plan = {}; bot.hold = [0, 0, 0, 0]; }
    for (const n of B.notes) {
        if (n.t > B.t + 0.3) break;
        if (n.j) continue;
        let pl = bot.plan[n.id];
        if (!pl) {
            const miss = s < 1 && bot.rng() < (1 - s) * 0.5;
            // a rough bell curve of timing error, wider at lower skill
            const g = (bot.rng() + bot.rng() + bot.rng() - 1.5) / 1.5;
            const err = s >= 1 ? 0 : g * (1 - s) * 0.16;
            const early = n.kind === 'hold' && s < 1 && bot.rng() < (1 - s) * 0.4;
            pl = bot.plan[n.id] = { miss, err, early, done: false };
        }
        if (pl.done || pl.miss) continue;
        const at = n.t + pl.err;
        if (B.t < at) continue;
        pl.done = true;
        if (n.kind === 'colossus') { inp.cres = { t: at }; continue; }
        inp.lanes.push({ lane: n.lane, t: at });
        if (n.kind === 'hold') bot.hold[n.lane] = n.t + n.len * (pl.early ? 0.5 : 1) + 0.02;
    }
    for (let l = 0; l < 4; l++) inp.held[l] = B.t < bot.hold[l];
    if (!inp.cres && B.cres >= 100 && B.t >= B.cresUntil && (B.ph.kind === 'play' || B.ph.kind === 'guard')) inp.cres = { t: B.t };
    if (Object.keys(bot.plan).length > 600) bot.plan = {};
    return inp;
}

// ---------------------------------------------------------------- field
const walkable = (map, x, y) => { const t = TILES[tileAt(map, x, y)]; return t && !t.solid; };

/** BFS over tiles from the player's tile to any goal tile. Returns tile centres to walk through, or null. */
function bfs(G, goals, blockedTiles) {
    const m = MAPS[G.map], W = m.rows[0].length, H = m.rows.length;
    const sx = Math.floor(G.p.x), sy = Math.floor(G.p.y);
    const key = (x, y) => y * W + x;
    const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
    const prev = new Map([[key(sx, sy), -1]]);
    const q = [[sx, sy]];
    while (q.length) {
        const [x, y] = q.shift();
        if (goalSet.has(key(x, y))) {
            const path = [];
            let k = key(x, y);
            while (k !== -1) { path.push([(k % W) + 0.5, Math.floor(k / W) + 0.5]); k = prev.get(k); }
            return path.reverse();
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
            if (!walkable(G.map, nx, ny) || blockedTiles.has(key(nx, ny))) continue;
            prev.set(key(nx, ny), key(x, y));
            q.push([nx, ny]);
        }
    }
    return null;
}

/** Walkable tiles from which an object at (ox, oy) (size w × h) is in reach. */
function tilesNear(G, ox, oy, w = 0, h = 0, reach = 1.05) {
    const m = MAPS[G.map], out = [];
    for (let y = 0; y < m.rows.length; y++) for (let x = 0; x < m.rows[0].length; x++) {
        if (!walkable(G.map, x, y)) continue;
        const cx = Math.max(ox - w / 2, Math.min(ox + w / 2, x + 0.5)), cy = Math.max(oy - h / 2, Math.min(oy + h / 2, y + 0.5));
        if (Math.hypot(cx - x - 0.5, cy - y - 0.5) + (w ? 0.3 : 0) <= reach) out.push([x, y]);
    }
    return out;
}

/** What the bot wants on this map: { goals: tiles, at?: (o) => bool to press A at, key } */
function goalFor(G, bot) {
    const m = MAPS[G.map];
    const o = objective(G);
    const hurt = G.party.members.some((id) => G.party.st[id].hp < maxHp(G, id) * 0.45);
    const cr = crystalOf(G.map);
    // a careful player saves at each new place's Song Crystal once
    if (cr && G.flags.metOtto && !(G.lastCrystal && G.lastCrystal.map === G.map) && !(bot.saved || {})[G.map]) {
        return { key: 'save', goals: tilesNear(G, cr.x + 0.5, cr.y + 0.5), act: (it) => it.kind === 'crystal', after: () => { bot.saved = { ...(bot.saved || {}), [G.map]: true }; } };
    }
    if (hurt && cr) return { key: 'crystal', goals: tilesNear(G, cr.x + 0.5, cr.y + 0.5), act: (it) => it.kind === 'crystal' };
    const chest = chestsOf(G.map).find((c) => !G.opened[c.id] && tilesNear(G, c.x + 0.5, c.y + 0.5).length);
    if (chest && G.flags.metOtto) return { key: 'chest' + chest.id, goals: tilesNear(G, chest.x + 0.5, chest.y + 0.5), act: (it) => it.kind === 'chest' };
    if (!o) return null;
    if (o.map !== G.map) {
        if (m.travel && G.flags.metOtto) return { key: 'otto', goals: tilesNear(G, m.travel.x, m.travel.y), act: (it) => it.kind === 'npc' && it.id === 'otto' };
        const ex = m.exits.find((e) => e.to === o.map) || m.exits[0];
        if (ex) return { key: 'exit', goals: rectTiles(ex) };
        return null;
    }
    if (o.kind === 'npc') return { key: 'npc' + o.id, goals: tilesNear(G, o.x, o.y), act: (it) => it.kind === 'npc' && it.id === o.id };
    if (o.kind === 'sign') {
        const s = (m.signs || []).find((x) => o.x >= x.x && o.x <= x.x + x.w && o.y >= x.y && o.y <= x.y + x.h);
        return { key: 'sign', goals: tilesNear(G, s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, 1.15), act: (it) => it.kind === 'sign' && it.s === s };
    }
    const t = m.triggers.find((x) => o.x >= x.x && o.x <= x.x + x.w && o.y >= x.y && o.y <= x.y + x.h);
    return { key: 'trig' + o.x + ',' + o.y, goals: rectTiles(t).filter(([x, y]) => walkable(G.map, x, y)) };
}
const rectTiles = (r) => { const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push([x, y]); return out; };

function fieldInput(G, bot) {
    const inp = { ...NONE };
    // a lozenge for anyone badly hurt, when there's no crystal to rest at
    const low = G.party.members.find((id) => G.party.st[id].hp > 0 && G.party.st[id].hp < maxHp(G, id) * 0.4);
    if (low && !crystalOf(G.map) && G.party.items.lozenge > 0) return { ...inp, cmd: { t: 'use', item: 'lozenge', target: low } };
    const goal = goalFor(G, bot);
    if (!goal) return inp;
    // in reach of what we came for: press A
    if (goal.act) {
        const it = interactables(G)[0];
        if (it && goal.act(it)) { bot.aT = !bot.aT; if (bot.aT && goal.after) goal.after(); return { ...inp, a: !!bot.aT }; }
    }
    const W = MAPS[G.map].rows[0].length;
    const blockedTiles = new Set(npcsOf(G).map((n) => Math.floor(n.y) * W + Math.floor(n.x)));
    if (bot.goalKey !== goal.key + G.map || !bot.path || !bot.path.length) {
        bot.goalKey = goal.key + G.map;
        bot.path = bfs(G, goal.goals, blockedTiles) || [];
    }
    // unstick: if we haven't moved for a while, wiggle and plan again
    const pos = G.p.x + G.p.y * 1000;
    if (bot.lastPos !== null && Math.abs(pos - bot.lastPos) < 1e-4) bot.stuckT++; else bot.stuckT = 0;
    bot.lastPos = pos;
    if (bot.stuckT > 90) { bot.jiggle = 40; bot.stuckT = 0; bot.path = null; bot.jx = bot.rng() * 2 - 1; bot.jy = bot.rng() * 2 - 1; }
    if (bot.jiggle > 0) { bot.jiggle--; return { ...inp, x: bot.jx, y: bot.jy }; }
    while (bot.path.length && Math.hypot(bot.path[0][0] - G.p.x, bot.path[0][1] - G.p.y) < 0.12) bot.path.shift();
    const nx = bot.path[0];
    if (!nx) { bot.path = null; return inp; }
    const dx = nx[0] - G.p.x, dy = nx[1] - G.p.y, l = Math.hypot(dx, dy) || 1;
    return { ...inp, x: dx / l, y: dy / l };
}
