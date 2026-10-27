// Grid, stats, movement, targeting and damage. Pure: no DOM, no clock, no Math.random.

import { RULES } from '../config.js';
import { CLASSES, SKILLS, TERRAIN } from './data.js';

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inB = (B, x, y) => x >= 0 && y >= 0 && x < B.w && y < B.h;
export const tileAt = (B, x, y) => (inB(B, x, y) ? B.tiles[y * B.w + x] : null);
export const unitAt = (B, x, y) => B.units.find((u) => u.alive && u.x === x && u.y === y) || null;
export const unitById = (B, id) => B.units.find((u) => u.id === id) || null;
export const stat = (cls, key, lvl) => Math.round(cls[key][0] + cls[key][1] * (lvl - 1));

export function buildTiles(map) {
    const tiles = [];
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const c = map[y][x];
            const t = TERRAIN[c];
            if (!t) throw new Error(`unknown terrain '${c}' at ${x},${y}`);
            tiles.push({ c, h: t.h, cost: t.cost, block: !!t.block, cover: !!t.cover, gap: !!t.gap });
        }
    }
    return tiles;
}

export function makeUnit(id, key, lvl, team, x, y, extra = {}) {
    const c = CLASSES[key];
    const hp = stat(c, 'hp', lvl), mp = stat(c, 'mp', lvl);
    return {
        id, key, lvl, team, x, y, alive: true,
        hp, maxhp: hp, mp, maxmp: mp,
        atk: stat(c, 'atk', lvl), mag: stat(c, 'mag', lvl), def: stat(c, 'def', lvl), res: stat(c, 'res', lvl),
        spd: c.spd, move: c.move, jump: c.jump, fly: !!c.fly, boss: !!c.boss,
        ct: 0, st: {}, items: [], ai: 'hunt', awake: false,
        ...extra,
    };
}

export const skillsOf = (u) => CLASSES[u.key].skills.filter((id) => SKILLS[id].lvl <= u.lvl);
export const basicOf = (u) => CLASSES[u.key].skills[0];
export const isFoe = (u, o) => o.alive && o.team !== u.team && o.team !== 'g';
export const isFriend = (u, o) => o.alive && o.team === u.team;

/** Everywhere `u` can reach this turn: Map(key → { x, y, cost, from }). Allies are passed through, foes block. */
export function reach(B, u) {
    const k = (x, y) => y * B.w + x;
    const out = new Map();
    const start = { x: u.x, y: u.y, cost: 0, from: -1 };
    out.set(k(u.x, u.y), start);
    const open = [start];
    while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].cost < open[bi].cost || (open[i].cost === open[bi].cost && k(open[i].x, open[i].y) < k(open[bi].x, open[bi].y))) bi = i;
        }
        const cur = open.splice(bi, 1)[0];
        if (out.get(k(cur.x, cur.y)) !== cur) continue;
        const ct = tileAt(B, cur.x, cur.y);
        for (const [dx, dy] of DIRS) {
            const nx = cur.x + dx, ny = cur.y + dy;
            const t = tileAt(B, nx, ny);
            if (!t) continue;
            if (t.block && !(u.fly && t.gap)) continue;
            if (Math.abs(t.h - ct.h) > u.jump && !u.fly) continue;
            const o = unitAt(B, nx, ny);
            if (o && o.id !== u.id && o.team !== u.team) continue;
            const cost = cur.cost + (u.fly ? 1 : t.cost);
            if (cost > u.move) continue;
            const kk = k(nx, ny);
            const prev = out.get(kk);
            if (prev && prev.cost <= cost) continue;
            const n = { x: nx, y: ny, cost, from: k(cur.x, cur.y) };
            out.set(kk, n);
            open.push(n);
        }
    }
    return out;
}

/** The tiles `u` can stop on: reachable, not a gap or table, and not occupied by someone else. */
export function standable(B, u, r = reach(B, u)) {
    const res = [];
    for (const n of r.values()) {
        const t = tileAt(B, n.x, n.y);
        if (t.block) continue;
        const o = unitAt(B, n.x, n.y);
        if (o && o.id !== u.id) continue;
        res.push(n);
    }
    return res;
}

export function pathTo(B, r, x, y) {
    const path = [];
    let n = r.get(y * B.w + x);
    while (n) {
        path.push([n.x, n.y]);
        n = n.from >= 0 ? r.get(n.from) : null;
    }
    return path.reverse();
}

/** Tiles within a skill's range from (fx, fy). */
export function rangeTiles(B, sk, fx, fy) {
    const out = [];
    for (let y = Math.max(0, fy - sk.range[1]); y <= Math.min(B.h - 1, fy + sk.range[1]); y++) {
        for (let x = Math.max(0, fx - sk.range[1]); x <= Math.min(B.w - 1, fx + sk.range[1]); x++) {
            const d = Math.abs(x - fx) + Math.abs(y - fy);
            if (d >= sk.range[0] && d <= sk.range[1]) out.push({ x, y });
        }
    }
    return out;
}

export function aoeTiles(B, sk, cx, cy) {
    const out = [];
    const r = sk.aoe;
    for (let y = Math.max(0, cy - r); y <= Math.min(B.h - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(B.w - 1, cx + r); x++) {
            if (Math.abs(x - cx) + Math.abs(y - cy) <= r) out.push({ x, y });
        }
    }
    return out;
}

/** Units a skill used by `u` aimed at (tx, ty) would touch, sorted by id. `from` lets the AI ask "if I stood there". */
export function affected(B, u, sk, tx, ty) {
    const inArea = new Set(aoeTiles(B, sk, tx, ty).map((p) => p.y * B.w + p.x));
    const list = B.units.filter((o) => o.alive && inArea.has(o.y * B.w + o.x) && (sk.tgt === 'foe' ? isFoe(u, o) : isFriend(u, o)));
    return list.sort((a, b) => a.id - b.id);
}

/** Is aiming `sk` at (tx, ty) from (fx, fy) legal and useful? */
export function validTarget(B, u, sk, tx, ty, fx = u.x, fy = u.y) {
    if (!inB(B, tx, ty)) return false;
    const d = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (d < sk.range[0] || d > sk.range[1]) return false;
    if (sk.tgt === 'foe' && sk.aoe === 0) {
        const o = unitAt(B, tx, ty);
        return !!o && isFoe(u, o);
    }
    if (sk.tgt === 'ally') {
        if (sk.aoe === 0) { const o = unitAt(B, tx, ty); return !!o && isFriend(u, o); }
        return affectedFrom(B, u, sk, tx, ty, fx, fy).length > 0;
    }
    return affectedFrom(B, u, sk, tx, ty, fx, fy).length > 0;
}

// like affected(), but with the caster standing at (fx, fy), for the AI's "if I stood there"
export function affectedFrom(B, u, sk, tx, ty, fx, fy) {
    if (fx === u.x && fy === u.y) return affected(B, u, sk, tx, ty);
    const was = [u.x, u.y];
    u.x = fx; u.y = fy;
    const res = affected(B, u, sk, tx, ty);
    u.x = was[0]; u.y = was[1];
    return res;
}

/** Damage `a` (standing at ax, ay) would do to `d` with `sk`, with the reasons. Pure and deterministic. */
export function calcDamage(B, a, d, sk, ax = a.x, ay = a.y) {
    const phys = sk.kind === 'phys';
    const raw = (phys ? a.atk : a.mag) * sk.power - (phys ? d.def : d.res) * 0.5;
    let m = 1;
    const ta = tileAt(B, ax, ay), td = tileAt(B, d.x, d.y);
    const dh = clamp(ta.h - td.h, -2, 2);
    m *= 1 + dh * RULES.heightBonus;
    if (td.cover) m *= RULES.cover;
    if (a.st.cheer > 0) m *= RULES.cheer;
    if (d.st.guard > 0) m *= RULES.guard;
    const mates = B.units.filter((o) => o.alive && o.id !== a.id && o.team === a.team && Math.abs(o.x - d.x) + Math.abs(o.y - d.y) === 1).length;
    m *= 1 + RULES.teamwork * Math.min(2, mates);
    return Math.max(1, Math.round(raw * m));
}

export function healAmount(u, sk) { return Math.round(sk.base + u.mag * sk.power); }
