// Exploration: the Agent walks a generated floor in real time, Hexes roam it, and touching one
// starts a battle. Strike a Hex first for an ambush; let one catch you from behind and it ambushes
// you. Pure and deterministic: every random number comes from G.rs, time comes in as dt.

import { rand, rint, pick, wpick, chance } from './rand.js';
import { genFloor, floorSeed, cellAt, FLOOR, bfs } from './gen.js';
import { ZONES, RIFT_WINDOW } from './data/zones.js';
import { DAEMONS, wildList } from './data/daemons.js';
import { ITEMS, GEAR } from './data/items.js';
import { SPEED } from '../config.js';
import { startBattle } from './battle.js';
import { partyUnits } from './units.js';
import { healAll, leaveZone } from './world.js';

const R = 0.3;                       // the Agent's radius, in cells
const SIGHT = 6.5, LOSE = 11, CONTACT = 0.8, REACH = 1.45;
const emit = (G, e) => { G.events.push(e); };

// ================================================================ entering a zone
export function enterZone(G, zoneId) {
    const Z = ZONES[zoneId];
    G.runs++;
    const rift = zoneId === 'rift';
    const run = rift ? G.runs : 0;
    const theme = rift ? ['tunnel', 'hall', 'racks', 'nave', 'rail', 'spire'][Math.abs(Math.imul(G.runs, 2654435761) >>> 7) % 6] : null;
    const X = { zone: zoneId, theme, run, cur: 0, floors: [], p: null, menu: null, battleFoe: -1, t: 0, steps: 0, kills: 0, boss: false };
    G.explore = X;
    G.phase = 'explore';
    loadFloor(G, 0, 'up');
    emit(G, { type: 'x_enter', zone: zoneId });
    return X;
}

export const floorOf = (X) => X.floors[X.cur];

/** The layout for the current floor lives on the floor record so a save carries it. */
function loadFloor(G, idx, from) {
    const X = G.explore;
    const Z = ZONES[X.zone];
    if (!X.floors[idx]) {
        const nFloors = Z.floors;
        const fl = genFloor(X.zone, idx, floorSeed(X.zone, idx, X.run), { theme: X.theme || undefined, floors: nFloors });
        const rec = { fl, foes: [], chests: fl.chests.map((c) => ({ x: c.x, y: c.y, open: false, loot: null })), seen: new Array(fl.w * fl.h).fill(0), anchorUsed: false, bossDone: !!(fl.bossId && G.flags['boss_' + fl.bossId]) };
        X.floors[idx] = rec;
        populate(G, rec, idx);
    }
    X.cur = idx;
    const rec = X.floors[idx];
    const fl = rec.fl;
    const at = from === 'down' ? fl.down : fl.up;
    const near = nearFloor(fl, at.x + 1.5, at.y + 0.5, at);
    X.p = { x: near.x, y: near.y, face: 0, sw: 0, cd: 0, inv: 1.0, run: false, moving: false };
    X.menu = null;
    reveal(rec, X.p.x, X.p.y);
    emit(G, { type: 'x_floor', idx, zone: X.zone });
}

function nearFloor(fl, x, y, at) {
    if (cellAt(fl, x | 0, y | 0) === FLOOR) return { x, y };
    return { x: at.x + 0.5, y: at.y + 1.5 };
}

function wildPool(G, Z, idx) {
    if (Z.id !== 'rift') return Z.pool;
    const lv = G.agent.lv;
    return wildList().filter((d) => d.lv >= lv - RIFT_WINDOW && d.lv <= lv + RIFT_WINDOW * 0.6).map((d) => [d.id, 1]);
}

function populate(G, rec, idx) {
    const X = G.explore;
    const Z = ZONES[X.zone];
    const pool = wildPool(G, Z, idx);
    const fl = rec.fl;
    for (const s of fl.spawns) {
        const grp = [];
        const n = idx === 0 ? wpick(G, [[1, 5], [2, 2]]) : wpick(G, [[1, 3], [2, 4], [3, 2]]);
        const elite = !fl.boss && chance(G, 0.1 + idx * 0.02);
        for (let i = 0; i < (elite ? 1 : n); i++) {
            const id = wpick(G, pool.length ? pool : [['mossling', 1]]);
            const sp = DAEMONS[id];
            let lv = sp.lv + rint(G, 0, 1) + (X.zone === 'rift' ? 0 : idx);
            if (X.zone === 'rift') lv = Math.max(1, Math.min(60, Math.round(G.agent.lv + rint(G, -2, 3))));
            if (elite) lv += 2;
            grp.push({ id, lv: Math.max(1, lv), elite });
        }
        rec.foes.push({ x: s.x + 0.5, y: s.y + 0.5, hx: s.x + 0.5, hy: s.y + 0.5, st: 'idle', face: rand(G) * 6.28, t: rand(G) * 2, grp, elite, alert: 0, dead: false, tx: 0, ty: 0 });
    }
}

// ================================================================ movement
const solid = (fl, x, y) => cellAt(fl, Math.floor(x), Math.floor(y)) !== FLOOR;
function blocked(fl, x, y, r = R) {
    return solid(fl, x - r, y - r) || solid(fl, x + r, y - r) || solid(fl, x - r, y + r) || solid(fl, x + r, y + r);
}
function slide(fl, e, dx, dy, r = R) {
    if (!blocked(fl, e.x + dx, e.y, r)) e.x += dx;
    if (!blocked(fl, e.x, e.y + dy, r)) e.y += dy;
}

function reveal(rec, x, y) {
    const fl = rec.fl;
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        if (dx * dx + dy * dy > 40) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= fl.w || ny >= fl.h) continue;
        rec.seen[ny * fl.w + nx] = 1;
    }
}

export function los(fl, ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let i = 1; i < n; i++) {
        const t = i / n;
        if (solid(fl, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
}

/**
 * Advance exploration by dt. inp = { x, y, run, a } with x and y in [-1, 1]; a is an edge:
 * the action button, which uses what is in reach (chest, stairs, anchor, gate) or else strikes.
 */
export function stepExplore(G, inp, dt) {
    const X = G.explore;
    if (G.phase !== 'explore' || !X || X.menu) return;
    const rec = floorOf(X);
    const fl = rec.fl;
    const p = X.p;
    X.t += dt;
    p.cd = Math.max(0, p.cd - dt);
    p.sw = Math.max(0, p.sw - dt);
    p.inv = Math.max(0, p.inv - dt);
    const len = Math.hypot(inp.x, inp.y);
    p.moving = len > 0.12;
    if (p.moving) {
        const k = len > 1 ? 1 / len : 1;
        const sp = (inp.run ? SPEED.dash : SPEED.walk) * Math.min(1, len);
        const dx = inp.x * k * sp * dt, dy = inp.y * k * sp * dt;
        slide(fl, p, dx, dy);
        p.face = Math.atan2(inp.y, inp.x);
        p.run = !!inp.run;
        X.steps += Math.hypot(dx, dy);
        if (((X.steps * 1.7) | 0) !== (((X.steps - Math.hypot(dx, dy)) * 1.7) | 0)) emit(G, { type: 'x_step' });
        reveal(rec, p.x, p.y);
    }
    if (inp.a) action(G);
    if (G.phase !== 'explore' || X.menu) return;
    updateFoes(G, rec, dt);
    if (G.phase !== 'explore') return;
    checkBoss(G, rec);
}

function near(a, x, y, r) { return Math.hypot(a.x - x, a.y - y) <= r; }

function action(G) {
    const X = G.explore;
    const rec = floorOf(X);
    const fl = rec.fl, p = X.p;
    const here = (c) => near(p, c.x + 0.5, c.y + 0.5, 1.15);
    for (const c of rec.chests) if (!c.open && here(c)) return openChest(G, rec, c);
    if (fl.anchor && here(fl.anchor)) { X.menu = 'anchor'; emit(G, { type: 'x_menu', menu: 'anchor' }); return; }
    if (fl.up && here(fl.up)) {
        if (X.cur === 0) { X.menu = 'gate'; emit(G, { type: 'x_menu', menu: 'gate' }); return; }
        loadFloor(G, X.cur - 1, 'down');
        return;
    }
    if (fl.down && here(fl.down)) {
        if (fl.boss && !rec.bossDone) return;
        loadFloor(G, X.cur + 1, 'up');
        return;
    }
    if (fl.exit && (rec.bossDone || !fl.boss) && here(fl.exit)) { X.menu = 'gate'; emit(G, { type: 'x_menu', menu: 'gate', clear: true }); return; }
    swing(G);
}

function swing(G) {
    const X = G.explore, rec = floorOf(X), p = X.p;
    if (p.cd > 0) return;
    p.sw = 0.28; p.cd = 0.42;
    emit(G, { type: 'x_swing' });
    let best = -1, bd = 1e9;
    rec.foes.forEach((f, i) => {
        if (f.dead) return;
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d > REACH) return;
        let da = Math.atan2(f.y - p.y, f.x - p.x) - p.face;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > 1.25) return;
        if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { emit(G, { type: 'x_hit', idx: best }); engage(G, rec, best, 'player'); }
}

// ================================================================ the Hexes
function updateFoes(G, rec, dt) {
    const X = G.explore, fl = rec.fl, p = X.p;
    rec.foes.forEach((f, i) => {
        if (f.dead) return;
        const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
        f.t -= dt;
        if (f.st === 'stun') { if (f.t <= 0) f.st = 'chase'; return; }
        if (f.st !== 'chase' && d < SIGHT && p.inv <= 0.01 && los(fl, f.x, f.y, p.x, p.y)) {
            f.st = 'chase'; f.alert = 1;
            emit(G, { type: 'x_alert', idx: i });
        } else if (f.st === 'chase' && d > LOSE) { f.st = 'idle'; f.t = 1; }
        if (f.st === 'chase') {
            let tx = p.x, ty = p.y;
            if (!los(fl, f.x, f.y, p.x, p.y)) {
                // round a corner: follow the walking distance toward the Agent
                const target = flowStep(fl, X, f, p);
                if (target) { tx = target.x; ty = target.y; }
            }
            const vx = tx - f.x, vy = ty - f.y, vl = Math.hypot(vx, vy) || 1;
            const sp = SPEED.chase * (f.elite ? 1.1 : 1) * dt;
            f.face = Math.atan2(vy, vx);
            slide(fl, f, (vx / vl) * sp, (vy / vl) * sp, 0.25);
            f.alert = Math.max(0, f.alert - dt);
            if (d < CONTACT && p.inv <= 0.01) {
                // caught from behind?
                let da = Math.atan2(f.y - p.y, f.x - p.x) - p.face;
                da = Math.atan2(Math.sin(da), Math.cos(da));
                engage(G, rec, i, Math.abs(da) > 2.1 ? 'enemy' : null);
            }
        } else {
            // idle: drift between nearby spots
            if (f.t <= 0) {
                f.t = 1.5 + rand(G) * 2.5;
                const a = rand(G) * 6.283, r = rand(G) * 2.2;
                f.tx = f.hx + Math.cos(a) * r; f.ty = f.hy + Math.sin(a) * r;
                f.moving = rand(G) < 0.7;
            }
            if (f.moving) {
                const vx = f.tx - f.x, vy = f.ty - f.y, vl = Math.hypot(vx, vy);
                if (vl > 0.15) { f.face = Math.atan2(vy, vx); slide(fl, f, (vx / vl) * SPEED.patrol * dt, (vy / vl) * SPEED.patrol * dt, 0.25); } else f.moving = false;
            }
        }
    });
}

/** The next cell centre on the shortest walk from a Hex to the Agent. */
function flowStep(fl, X, f, p) {
    const px = Math.floor(p.x), py = Math.floor(p.y);
    if (!X._flow || X._flow.key !== `${X.cur}:${px}:${py}`) X._flow = { key: `${X.cur}:${px}:${py}`, d: bfs(fl, px, py) };
    const d = X._flow.d;
    const cx = Math.floor(f.x), cy = Math.floor(f.y);
    let best = null, bv = d[cy * fl.w + cx];
    if (bv < 0) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = d[(cy + dy) * fl.w + (cx + dx)];
        if (cellAt(fl, cx + dx, cy + dy) === FLOOR && v >= 0 && v < bv) { bv = v; best = { x: cx + dx + 0.5, y: cy + dy + 0.5 }; }
    }
    return best;
}

function engage(G, rec, i, ambush) {
    const X = G.explore, f = rec.foes[i];
    X.battleFoe = i;
    f.st = 'stun'; f.t = 99;
    emit(G, { type: 'x_engage', idx: i, ambush });
    startBattle(G, { kind: 'normal', zone: X.zone, foes: f.grp.map((g) => ({ ...g })), ambush });
}

/** After a battle in the field: clear the Hex that was fought, or push it back if the party ran. */
export function resolveFoe(G, result) {
    const X = G.explore;
    if (!X) return;
    const rec = floorOf(X);
    const f = rec.foes[X.battleFoe];
    if (f) {
        if (result === 'win') { f.dead = true; X.kills++; }
        else { f.st = 'stun'; f.t = 3; }
    }
    X.battleFoe = -1;
    X.p.inv = 1.8;
}

// ================================================================ the boss
function checkBoss(G, rec) {
    const X = G.explore, fl = rec.fl, p = X.p;
    if (!fl.boss || rec.bossDone || X.boss) return;
    if (Math.hypot(p.x - (fl.boss.x + 0.5), p.y - (fl.boss.y + 0.5)) < 3.2) {
        X.boss = true;
        G.scene = null;
        emit(G, { type: 'x_boss', zone: X.zone, boss: fl.bossId });
        G.pendingBoss = fl.bossId;
    }
}

// ================================================================ chests
export function chestLoot(G, zoneId, idx) {
    const Z = ZONES[zoneId];
    const tier = zoneId === 'rift' ? Math.min(5, Math.floor(G.agent.lv / 9)) : Z.chapter;
    const loot = { scrap: Math.round((30 + tier * 45 + idx * 25) * (0.7 + rand(G) * 0.6)), items: {}, gear: null };
    const pickFrom = (arr) => arr[Math.floor(rand(G) * arr.length)];
    const base = ['patch', 'sap', 'antidote', 'honey', 'sparkcell', 'glowfruit', 'lullaby', 'smoke'];
    if (tier >= 1) base.push('kit', 'seed', 'oldcoin', 'grenade', 'froststick', 'arcnade');
    if (tier >= 3) base.push('fullkit', 'elixir', 'hexshard', 'bloom');
    const n = rint(G, 1, 2);
    for (let i = 0; i < n; i++) { const it = pickFrom(base); loot.items[it] = (loot.items[it] || 0) + 1; }
    if (rand(G) < 0.28 + tier * 0.02) {
        const chips = Object.values(ITEMS).filter((i) => i.kind === 'chip' && i.price <= 300 + tier * 520).map((i) => i.id);
        const c = pickFrom(chips); loot.items[c] = (loot.items[c] || 0) + 1;
    }
    if (rand(G) < 0.12) { const s = pickFrom(['seed_st', 'seed_ma', 'seed_vi', 'seed_ag', 'seed_lu']); loot.items[s] = 1; }
    if (rand(G) < 0.16 + idx * 0.06) {
        const pool = Object.values(GEAR).filter((g) => g.price > 0 && g.price <= 400 + tier * 1900 && !G.ownedGear.includes(g.id)).map((g) => g.id);
        if (pool.length) loot.gear = pickFrom(pool);
    }
    return loot;
}

function openChest(G, rec, c) {
    const X = G.explore;
    c.open = true;
    c.loot = chestLoot(G, X.zone, X.cur);
    G.scrap += c.loot.scrap;
    for (const [k, n] of Object.entries(c.loot.items)) G.items[k] = (G.items[k] || 0) + n;
    if (c.loot.gear && !G.ownedGear.includes(c.loot.gear)) G.ownedGear.push(c.loot.gear);
    emit(G, { type: 'x_chest', x: c.x, y: c.y, loot: c.loot });
}

// ================================================================ menus and leaving
export function exploreAction(G, a) {
    const X = G.explore;
    if (!X) return 'not exploring';
    if (a.type === 'closeMenu') { X.menu = null; return ''; }
    if (a.type === 'anchor') {
        const rec = floorOf(X);
        if (X.menu !== 'anchor') return 'no anchor here';
        if (!rec.anchorUsed) {
            rec.anchorUsed = true;
            healAll(G, true);
            emit(G, { type: 'x_anchor', healed: true });
        } else emit(G, { type: 'x_anchor', healed: false });
        return '';
    }
    if (a.type === 'leaveZone') {
        if (X.menu !== 'gate' && X.menu !== 'anchor') return 'not at a gate';
        leaveZone(G);
        return '';
    }
    return 'unknown';
}
