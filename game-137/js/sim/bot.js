// An auto-pilot for Unit-07. It plays through the same input the player uses ({ x, y, mag, od,
// pick }) and the same hangar commands, so the tests, the balance table and the title-screen
// demo all exercise the real rules. Pure, like the rest of js/sim: it has its own seeded rng.
//
// skill (0..1): how often it notices each monster, how quickly it re-thinks (reaction time), how
// well it picks level-up cards and how cleverly it uses the magnet and Overdrive.

import { makeRng } from '../rng.js';
import { MAP, MECH, COLORS, COLLECTIBLE } from '../config.js';
import { idx, inMap, cellOf, solid } from './world.js';
import { act } from './game.js';
import { PARTS } from './data/parts.js';
import { nextCost, partLevel } from './hangar.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(seed * 7919 + 13), think: 0, last: { x: 0, y: 0, mag: false, od: false, pick: null }, field: null, fieldKey: '', fieldT: 0, orbit: 1 };
}

const PICK_ORDER = ['salvo', 'dmg', 'rate', 'multi', 'blast', 'hp', 'shield', 'regen', 'magnet', 'beam', 'saws', 'speed', 'od'];

/** Walking distance (in cells) to the goal cells, over ground the mech can cross. */
function goalField(R, goals) {
    const N = MAP.w * MAP.h, dist = new Int32Array(N).fill(1e9), q = [];
    for (const g of goals) { if (inMap(g.x, g.y)) { const i = idx(g.x, g.y); dist[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % MAP.w, y = (i / MAP.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!inMap(nx, ny)) continue;
            const j = idx(nx, ny);
            if (dist[j] <= dist[i] + 1 || solid(R.W, j)) continue;
            dist[j] = dist[i] + 1; q.push(j);
        }
    }
    return dist;
}
function followField(R, field, x, y) {
    const cx = cellOf(x), cy = cellOf(y);
    if (!inMap(cx, cy)) return null;
    let best = field[idx(cx, cy)], bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!inMap(nx, ny)) continue;
        if (dx && dy && (solid(R.W, idx(cx + dx, cy)) || solid(R.W, idx(cx, cy + dy)))) continue;
        const d = field[idx(nx, ny)];
        if (d < best) { best = d; bx = nx + 0.5 - x; by = ny + 0.5 - y; }
    }
    const l = Math.hypot(bx, by);
    return l ? { x: bx / l, y: by / l } : null;
}

/** What to do this step. */
export function botInput(G, bot) {
    const R = G.run;
    if (!R) return { x: 0, y: 0, mag: false, od: false, pick: null };
    if (R.choice) return { x: 0, y: 0, mag: false, od: false, pick: pickCard(R, bot) };
    bot.think -= 1 / 120;
    if (bot.think > 0) return bot.last;
    bot.think = 0.04 + (1 - bot.skill) * 0.45;
    const out = decide(R, bot);
    bot.last = out;
    return out;
}

function pickCard(R, bot) {
    if (bot.rng() > bot.skill) return Math.floor(bot.rng() * R.choice.length);
    let best = 0, rank = 99;
    R.choice.forEach((k, i) => { const r = PICK_ORDER.indexOf(k); if (r >= 0 && r < rank) { rank = r; best = i; } });
    return best;
}

function decide(R, bot) {
    const M = R.mech, skill = bot.skill;
    // ---- what threatens us
    let rx = 0, ry = 0, crowd = 0, closest = 99;
    let boss = null;
    for (const e of R.enemies) {
        if (e.boss) { boss = e; continue; }
        const dx = M.x - e.x, dy = M.y - e.y, d = Math.hypot(dx, dy);
        if (d > 5) continue;
        if (d < 3.5) crowd++;
        closest = Math.min(closest, d - e.r);
        if (bot.rng() > 0.15 + 0.85 * skill) continue;           // a careless pilot misses some
        const w = ((5 - d) / 5) ** 2 * (e.kind === 'brute' ? 1.6 : e.kind === 'boomer' ? 2.2 : 1);
        rx += (dx / (d || 1)) * w; ry += (dy / (d || 1)) * w;
    }
    for (const s of R.shots) {
        if (s.k !== 'e') continue;
        const dx = M.x - s.x, dy = M.y - s.y, d = Math.hypot(dx, dy);
        if (d > 3.5 || (s.vx * dx + s.vy * dy) <= 0) continue;
        if (bot.rng() > 0.1 + 0.9 * skill) continue;
        const sp = Math.hypot(s.vx, s.vy) || 1, px = -s.vy / sp, py = s.vx / sp;
        const side = px * dx + py * dy >= 0 ? 1 : -1;
        rx += px * side * 1.4 * (3.5 - d) / 3.5; ry += py * side * 1.4 * (3.5 - d) / 3.5;
    }
    if (boss) {
        const dx = M.x - boss.x, dy = M.y - boss.y, d = Math.hypot(dx, dy) || 1;
        if (boss.st === 'wind' || boss.st === 'act') {
            if (boss.act === 'stomp' && d < 6.5 && bot.rng() < 0.2 + 0.8 * skill) { rx += dx / d * 3.5; ry += dy / d * 3.5; }
            if (boss.act === 'charge') { const px = -Math.sin(boss.dir), py = Math.cos(boss.dir); const side = px * dx + py * dy >= 0 ? 1 : -1; rx += px * side * 4 * skill; ry += py * side * 4 * skill; }
        }
        if (d < boss.r + 4) { rx += dx / d * 2.5; ry += dy / d * 2.5; }
    }

    // ---- where we want to be
    const goal = pickGoal(R, bot, M, crowd);
    let gx = 0, gy = 0;
    if (goal) {
        const key = goal.cells.map((c) => c.x + ',' + c.y).join(';');
        bot.fieldT -= 0.04 + (1 - skill) * 0.3;
        if (key !== bot.fieldKey || bot.fieldT <= 0) { bot.field = goalField(R, goal.cells); bot.fieldKey = key; bot.fieldT = 0.5; }
        const dx = goal.x - M.x, dy = goal.y - M.y, d = Math.hypot(dx, dy) || 1;
        if (d < goal.stand) {
            // close enough: circle it
            if (bot.rng() < 0.01) bot.orbit = -bot.orbit;
            const pull = (d - goal.stand * 0.8) / goal.stand;
            gx = -dy / d * bot.orbit + dx / d * pull; gy = dx / d * bot.orbit + dy / d * pull;
        } else {
            const f = followField(R, bot.field, M.x, M.y);
            if (f) { gx = f.x; gy = f.y; } else { gx = dx / d; gy = dy / d; }
        }
    }
    const urgency = M.hp < M.maxHp * 0.35 ? 3 : 2.2;
    let x = gx + rx * urgency, y = gy + ry * urgency;
    // keep off the walls of the map
    if (M.x < 3) x += 1; if (M.x > MAP.w - 3) x -= 1; if (M.y < 3) y += 1; if (M.y > MAP.h - 3) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 0.01) { x /= l; y /= l; }
    // ---- magnet: only when it's safe and there's something to pull
    let near = 0;
    const r2 = M.magnet * M.magnet;
    for (const v of R.voxels) if (COLLECTIBLE[COLORS[v.c]] && (v.x - M.x) ** 2 + (v.y - M.y) ** 2 < r2) near++;
    const mag = skill > 0.6 && near >= 4 && closest > 2.2 && !(boss && Math.hypot(M.x - boss.x, M.y - boss.y) < 7);
    // ---- overdrive: in a crowd, or near the boss
    const od = M.od >= 1 && (crowd >= 6 || (boss && Math.hypot(M.x - boss.x, M.y - boss.y) < 9) || (skill < 0.5 && bot.rng() < 0.02));
    // the Shard Beam: on the boss, a hive, or a crowd; a careless pilot sometimes wastes it on nothing
    let beam = false;
    if (M.beam >= 1 && M.beamCd <= 0) {
        const hive = R.hives.some((h) => !h.dead && Math.hypot(h.x - M.x, h.y - M.y) < 12);
        beam = !!(boss && Math.hypot(M.x - boss.x, M.y - boss.y) < 16) || hive || crowd >= 5 || (skill < 0.5 && bot.rng() < 0.03);
    }
    return { x, y, mag, od, beam, pick: null };
}

/** The next place to go, as target cells for the path field plus a stand-off distance. */
function pickGoal(R, bot, M, crowd) {
    const skill = bot.skill;
    const ring = (cx, cy, r) => {
        const out = [];
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.max(Math.abs(x), Math.abs(y)) === r) out.push({ x: cx + x, y: cy + y });
        return out;
    };
    const todo = R.objectives.find((o) => !o.done);
    let obj = null;
    if (todo && R.evac == null) {
        if (todo.kind === 'rescue') {
            const c = nearestOf(R.cages.filter((c) => !c.freed), M);
            if (c) obj = { x: c.x, y: c.y, cells: [{ x: cellOf(c.x), y: cellOf(c.y) }], stand: 1.0, hold: true };
        }
        if (todo.kind === 'hives') {
            const h = nearestOf(R.hives.filter((h) => !h.dead), M);
            if (h) obj = { x: h.x, y: h.y, cells: ring(cellOf(h.x), cellOf(h.y), 3), stand: 5 };
        }
        if (todo.kind === 'boss') {
            const b = R.enemies.find((e) => e.boss);
            if (b) obj = { x: b.x, y: b.y, cells: ring(cellOf(b.x), cellOf(b.y), 7), stand: 6 + 3 * skill };
        }
    }
    const objD = obj ? Math.hypot(obj.x - M.x, obj.y - M.y) : 99;
    // freeing a cage: stay in the ring until it opens
    if (obj && obj.hold && objD < 2) return obj;
    // hurt: grab green or blue voxels if any are close
    if (M.hp < M.maxHp * 0.45) {
        const v = nearestVoxel(R, M, ['green', 'blue'], 6);
        if (v) return { x: v.x, y: v.y, cells: [{ x: cellOf(v.x), y: cellOf(v.y) }], stand: 0.3 };
    }
    // goodies right next to us and nothing in the way: sweep them up on the way
    if (crowd < 4) {
        const v = nearestVoxel(R, M, ['gold', 'red'], 1.5 + 2 * bot.skill);
        if (v && (!obj || Math.hypot(obj.x - v.x, obj.y - v.y) < objD + 1)) return { x: v.x, y: v.y, cells: [{ x: cellOf(v.x), y: cellOf(v.y) }], stand: 0.3 };
    }
    if (obj) return obj;
    // holding out: stay near the middle, sweep voxels
    const v = nearestVoxel(R, M, ['red', 'gold', 'green', 'blue'], 9);
    if (v && crowd < 6) return { x: v.x, y: v.y, cells: [{ x: cellOf(v.x), y: cellOf(v.y) }], stand: 0.3 };
    return { x: MAP.w / 2, y: MAP.h / 2, cells: [{ x: MAP.w / 2, y: MAP.h / 2 }], stand: 6 };
}
function nearestOf(list, M) {
    let best = null, bd = Infinity;
    for (const o of list) { const d = (o.x - M.x) ** 2 + (o.y - M.y) ** 2; if (d < bd) { bd = d; best = o; } }
    return best;
}
function nearestVoxel(R, M, colors, range) {
    let best = null, bd = range * range;
    for (const v of R.voxels) {
        if (v.s === 2 || !colors.includes(COLORS[v.c])) continue;
        const d = (v.x - M.x) ** 2 + (v.y - M.y) ** 2;
        if (d < bd) { bd = d; best = v; }
    }
    return best;
}

// ------------------------------------------------------------------ the hangar
/** The order a sensible pilot spends credits in: [part, level wanted, slot to fit it in]. */
const PLAN = [
    ['rockets', 2], ['vulcan', 2], ['scatter', 1, 'armR'], ['barrier', 1, 'core'], ['rockets', 3], ['strider', 2],
    ['vulcan', 3], ['barrier', 2], ['laser', 1, 'armR'], ['laser', 2], ['scatter', 2], ['barrier', 3], ['laser', 3],
    ['mortar', 1], ['strider', 3], ['plating', 2], ['mortar', 2], ['scatter', 3], ['drone', 1], ['mortar', 3], ['plating', 3],
];

/** Between sorties: take the crew's gifts, spend credits down the plan, launch the next sortie. */
export function botHangar(G, bot) {
    if (G.mode === 'debrief') act(G, { t: 'done' });
    if (G.mode !== 'hangar') return;
    act(G, { t: 'collect', crew: 'all' });
    const save = bot.skill < 0.5 ? 0.5 : 0;            // a weak pilot hoards and buys late
    for (const [id, want, slot] of PLAN) {
        if (partLevel(G, id) >= want) { if (slot && G.hangar.loadout[slot] !== id && want === 1) act(G, { t: 'equip', slot, part: id }); continue; }
        const c = nextCost(G, id);
        if (c == null || G.hangar.gold < c * (1 + save)) break;
        act(G, { t: 'buy', part: id });
        if (slot) act(G, { t: 'equip', slot, part: id });
    }
    const next = !G.cleared[G.unlocked] ? G.unlocked : Math.max(...Object.keys(G.cleared).map(Number));
    act(G, { t: 'launch', mission: next });
}
export { PARTS };
