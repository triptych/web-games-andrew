/**
 * core.js — shared simulation machinery: events, circle-vs-tile collision,
 * line of sight, the flow field every bug follows, the spatial hash, damage,
 * explosions, loot and the entity factories.
 *
 * Pure: no three.js, no DOM, no Math.random (the world carries its rng).
 */

import { ENEMIES, BOSSES, ALPHA, PLAYER, PERKS, SALVAGE_VALUE } from '../config.js';
import { PROPS } from './level.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export function emit(w, type, data = {}) {
    data.type = type;
    w.events.push(data);
}

// ------------------------------------------------------------------ Tiles & collision

export function solidAt(lv, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) return true;
    return lv.solid[ty * lv.w + tx] === 1;
}

/** Push a circle (e.x, e.y, e.r) out of solid tiles. Returns true on contact. */
export function collideCircle(lv, e) {
    let hit = false;
    // Centre buried in a solid tile (a door shut on it, a crowd squeezed it into a corner):
    // step out to the nearest free tile.
    const cx = Math.floor(e.x), cy = Math.floor(e.y);
    if (solidAt(lv, cx, cy) && e.ox !== undefined && !solidAt(lv, Math.floor(e.ox), Math.floor(e.oy))) {
        // Go back the way it came, so nothing slips through a door as it shuts.
        e.x = e.ox; e.y = e.oy; hit = true;
    } else if (solidAt(lv, cx, cy)) {
        let best = null, bd = Infinity;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (solidAt(lv, cx + dx, cy + dy)) continue;
                const px = clamp(e.x, cx + dx + 0.05, cx + dx + 0.95), py = clamp(e.y, cy + dy + 0.05, cy + dy + 0.95);
                const d = (px - e.x) ** 2 + (py - e.y) ** 2;
                if (d < bd) { bd = d; best = [px, py]; }
            }
        }
        if (best) { e.x = best[0]; e.y = best[1]; hit = true; }
    }
    for (let pass = 0; pass < 2; pass++) {
        const r = e.r;
        const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r);
        const y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                if (!solidAt(lv, tx, ty)) continue;
                const nx = clamp(e.x, tx, tx + 1), ny = clamp(e.y, ty, ty + 1);
                const dx = e.x - nx, dy = e.y - ny;
                const d2 = dx * dx + dy * dy;
                if (d2 >= r * r) continue;
                hit = true;
                if (d2 > 1e-10) {
                    const d = Math.sqrt(d2), push = r - d;
                    e.x += (dx / d) * push;
                    e.y += (dy / d) * push;
                } else {
                    // Centre inside the tile: leave by the nearest face.
                    const l = e.x - tx, rr = tx + 1 - e.x, t = e.y - ty, b = ty + 1 - e.y;
                    const m = Math.min(l, rr, t, b);
                    if (m === l) e.x = tx - r; else if (m === rr) e.x = tx + 1 + r;
                    else if (m === t) e.y = ty - r; else e.y = ty + 1 + r;
                }
            }
        }
    }
    return hit;
}

/** Move with sub-steps so nothing tunnels through a 1 m wall. */
export function moveEntity(lv, e, dx, dy) {
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (e.r * 0.8 + 0.05)));
    let hit = false;
    for (let i = 0; i < steps; i++) {
        e.x += dx / steps;
        e.y += dy / steps;
        if (collideCircle(lv, e)) hit = true;
    }
    return hit;
}

/** Distance along (dx, dy) (unit) to the first solid tile, up to max. */
export function raycast(lv, x, y, dx, dy, max) {
    let tx = Math.floor(x), ty = Math.floor(y);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const ddx = dx !== 0 ? Math.abs(1 / dx) : 1e9, ddy = dy !== 0 ? Math.abs(1 / dy) : 1e9;
    let tmx = dx !== 0 ? (dx > 0 ? (tx + 1 - x) : (x - tx)) * ddx : 1e9;
    let tmy = dy !== 0 ? (dy > 0 ? (ty + 1 - y) : (y - ty)) * ddy : 1e9;
    let d = 0;
    while (d < max) {
        if (tmx < tmy) { d = tmx; tmx += ddx; tx += sx; }
        else { d = tmy; tmy += ddy; ty += sy; }
        if (solidAt(lv, tx, ty)) return Math.min(d, max);
    }
    return max;
}

/** Line of sight between two points (walls, closed doors and props block). */
export function los(lv, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return true;
    return raycast(lv, ax, ay, dx / d, dy / d, d) >= d - 1e-6;
}

// ------------------------------------------------------------------ Flow field

/** BFS distance (in tiles) from the player's tile over passable tiles. */
export function buildFlow(w) {
    const lv = w.lv;
    const n = lv.w * lv.h;
    if (!w.flow || w.flow.length !== n) { w.flow = new Uint16Array(n); w.flowQ = new Int32Array(n); }
    const dist = w.flow, q = w.flowQ;
    dist.fill(65535);
    const p = w.player;
    let s = Math.floor(p.y) * lv.w + Math.floor(p.x);
    if (lv.solid[s]) {
        // Player is brushing a wall: start from the nearest free neighbour.
        for (const o of [1, -1, lv.w, -lv.w]) if (!lv.solid[s + o]) { s += o; break; }
    }
    let head = 0, tail = 0;
    dist[s] = 0; q[tail++] = s;
    const W = lv.w;
    while (head < tail) {
        const i = q[head++];
        const d = dist[i] + 1;
        if (d > 90) continue;
        const x = i % W;
        if (x > 0 && !lv.solid[i - 1] && dist[i - 1] > d) { dist[i - 1] = d; q[tail++] = i - 1; }
        if (x < W - 1 && !lv.solid[i + 1] && dist[i + 1] > d) { dist[i + 1] = d; q[tail++] = i + 1; }
        if (i >= W && !lv.solid[i - W] && dist[i - W] > d) { dist[i - W] = d; q[tail++] = i - W; }
        if (i < n - W && !lv.solid[i + W] && dist[i + W] > d) { dist[i + W] = d; q[tail++] = i + W; }
    }
    w.flowTile = Math.floor(p.y) * lv.w + Math.floor(p.x);
    w.flowT = 0.25;
}

export function flowAt(w, x, y) {
    const lv = w.lv;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) return 65535;
    return w.flow[ty * lv.w + tx];
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Unit direction toward the player along the flow field, written into out. */
export function flowDir(w, x, y, out) {
    const lv = w.lv;
    const tx = Math.floor(x), ty = Math.floor(y);
    const W = lv.w;
    const here = (tx >= 0 && ty >= 0 && tx < W && ty < lv.h) ? w.flow[ty * W + tx] : 65535;
    let best = here, bx = 0, by = 0;
    for (let k = 0; k < 8; k++) {
        const dx = NB[k][0], dy = NB[k][1];
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= lv.h) continue;
        if (lv.solid[ny * W + nx]) continue;
        if (k >= 4 && (lv.solid[ty * W + nx] || lv.solid[ny * W + tx])) continue;
        const d = w.flow[ny * W + nx];
        if (d < best) { best = d; bx = nx + 0.5; by = ny + 0.5; }
    }
    if (best === here || best === 65535) {
        const p = w.player;
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
        out.x = dx / d; out.y = dy / d;
        return here;
    }
    const dx = bx - x, dy = by - y, d = Math.hypot(dx, dy) || 1;
    out.x = dx / d; out.y = dy / d;
    return here;
}

// ------------------------------------------------------------------ Spatial hash (enemies)

const HC = 2;
export function buildHash(w) {
    const lv = w.lv;
    const cw = Math.ceil(lv.w / HC), ch = Math.ceil(lv.h / HC);
    if (!w.hHead || w.hHead.length !== cw * ch) { w.hHead = new Int32Array(cw * ch); w.hCW = cw; w.hCH = ch; }
    if (!w.hNext || w.hNext.length < w.enemies.length) w.hNext = new Int32Array(Math.max(256, w.enemies.length * 2));
    w.hHead.fill(-1);
    const E = w.enemies;
    let maxR = 0.5;
    for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.r > maxR) maxR = e.r;
        const cx = clamp(Math.floor(e.x / HC), 0, cw - 1), cy = clamp(Math.floor(e.y / HC), 0, ch - 1);
        const c = cy * cw + cx;
        w.hNext[i] = w.hHead[c];
        w.hHead[c] = i;
    }
    w.hMargin = maxR;
}

/** Call fn(e) for each enemy whose cell is within r of (x, y); stop if fn returns true. */
export function queryHash(w, x, y, r, fn) {
    const cw = w.hCW, ch = w.hCH;
    const m = r + (w.hMargin ?? 1);
    const x0 = clamp(Math.floor((x - m) / HC), 0, cw - 1), x1 = clamp(Math.floor((x + m) / HC), 0, cw - 1);
    const y0 = clamp(Math.floor((y - m) / HC), 0, ch - 1), y1 = clamp(Math.floor((y + m) / HC), 0, ch - 1);
    const E = w.enemies;
    for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
            for (let i = w.hHead[cy * cw + cx]; i >= 0; i = w.hNext[i]) {
                const e = E[i];
                if (e && !e.dead && fn(e)) return;
            }
        }
    }
}

// ------------------------------------------------------------------ Factories

export function spawnEnemy(w, type, x, y, opts = {}) {
    const def = ENEMIES[type];
    const alpha = !!opts.alpha;
    const hpMul = w.diff.enemyHp * w.hpScale * (alpha ? ALPHA.hp : 1);
    const e = {
        id: w.nextId++, type, boss: false, alpha,
        x, y, ox: x, oy: y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: def.r * (alpha ? ALPHA.scale : 1),
        hp: def.hp * hpMul, maxHp: def.hp * hpMul,
        speed: def.speed * (alpha ? ALPHA.speed : 1) * (0.9 + w.rng.next() * 0.2),
        dmg: def.dmg * w.diff.enemyDmg * (alpha ? ALPHA.dmg : 1),
        face: opts.face ?? w.rng.range(0, TAU), anim: w.rng.next() * 10,
        state: 'chase', t: 0, cd: w.rng.range(0.5, 1.8), biteCd: 0,
        flash: 0, burn: 0, burnT: 0, stun: 0, spawnT: opts.instant ? 0 : (opts.emerge ?? 0.75),
        room: opts.room ?? -1, cloak: 0, under: false, mass: def.mass * (alpha ? 2 : 1),
        seed: w.rng.next(), dead: false,
    };
    w.enemies.push(e);
    w.byId.set(e.id, e);
    if (!opts.silent) emit(w, 'spawn', { x, y, kind: type, emerge: e.spawnT, alpha, id: e.id });
    w.seen[type] = (w.seen[type] ?? 0) + 1;
    return e;
}

export function spawnBossEntity(w, type, x, y) {
    const def = BOSSES[type];
    const hp = def.hp * w.diff.enemyHp;
    const e = {
        id: w.nextId++, type, boss: true, alpha: false,
        x, y, ox: x, oy: y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: def.r, hp, maxHp: hp, speed: 0, dmg: 25 * w.diff.enemyDmg,
        face: Math.PI / 2, anim: 0, state: 'intro', t: 1.6, cd: 1, biteCd: 0,
        flash: 0, burn: 0, burnT: 0, stun: 0, spawnT: 0, room: w.activeRoom, cloak: 0, under: false,
        mass: 999, seed: 0.5, dead: false, phase: 1, data: {},
    };
    w.enemies.push(e);
    w.byId.set(e.id, e);
    w.boss = e;
    emit(w, 'bossIntro', { kind: type, id: e.id, x, y });
    return e;
}

/** Enemy bullet. kind: acid | fire | spine | slug | plasma | web */
export function spawnEBullet(w, x, y, ang, speed, opts = {}) {
    if (w.ebullets.length > 1400) return null;
    const s = speed * w.diff.bulletSpeed;
    const b = {
        x, y, ox: x, oy: y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
        r: opts.r ?? 0.2, dmg: (opts.dmg ?? 10) * w.diff.enemyDmg, life: opts.life ?? 5,
        kind: opts.kind ?? 'acid', accel: opts.accel ?? 0, curve: opts.curve ?? 0,
        delay: opts.delay ?? 0, slow: opts.slow ?? 0, t: 0,
    };
    w.ebullets.push(b);
    return b;
}

export function spawnPickup(w, kind, x, y, extra = {}) {
    const a = w.rng.range(0, TAU), sp = extra.pop ?? w.rng.range(1.5, 4.5);
    const pk = {
        id: w.nextId++, kind, x, y, ox: x, oy: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: kind === 'salvage' ? 40 : 9999,
        r: 0.25, ...extra,
    };
    w.pickups.push(pk);
    return pk;
}

export function spawnHazard(w, kind, x, y, r, time, dps) {
    if (w.hazards.length > 60) w.hazards.shift();
    w.hazards.push({ id: w.nextId++, kind, x, y, r, t: time, max: time, dps });
}

// ------------------------------------------------------------------ Damage

function perk(w, id) { return !!w.player.perks[id]; }

/** Player damage multiplier from perks and power-ups. */
export function dmgMul(w) {
    const p = w.player;
    let m = 1;
    if (perk(w, 'kinetic')) m *= 1.18;
    if (p.pow.overdrive > 0) m *= 2;
    if (perk(w, 'adrenal') && p.hp < p.maxHp * 0.35) m *= 1.3;
    return m;
}

/**
 * Damage an enemy. opts: sx, sy (source position, for brute armour and
 * knockback), knock, kind ('bullet'|'explosion'|'fire'|'arc'|'rail'|'melee'),
 * noCrit, burn {dps, t}, stun.
 */
export function damageEnemy(w, e, dmg, opts = {}) {
    if (e.dead || e.spawnT > 0 || e.under || e.hidden) return false;
    if (e.boss && (e.state === 'intro' || e.invuln)) return false;
    let d = dmg;
    if (!opts.noCrit && perk(w, 'crit') && w.rng.chance(0.12)) { d *= 3; opts.crit = true; }
    // Brute front armour.
    if (e.type === 'brute' && e.state !== 'stunned' && opts.sx !== undefined && opts.kind !== 'explosion' && opts.kind !== 'fire') {
        const a = Math.atan2(opts.sy - e.y, opts.sx - e.x);
        if (Math.abs(angDiff(a, e.face)) < 1.05) { d *= 0.3; if (w.rng.chance(0.3)) emit(w, 'ricochet', { x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r }); }
    }
    if (e.type === 'brute' && e.state === 'stunned') d *= 2;
    if (e.armor) d *= e.armor;
    e.hp -= d;
    e.flash = 1;
    if (e.type === 'stalker') e.cloak = 1.5;
    if (opts.burn) { e.burn = Math.max(e.burn, opts.burn.dps); e.burnT = Math.max(e.burnT, opts.burn.t); }
    if (opts.stun && !e.boss) e.stun = Math.max(e.stun, opts.stun);
    if (opts.knock && opts.sx !== undefined && !e.boss) {
        const a = Math.atan2(e.y - opts.sy, e.x - opts.sx);
        const k = opts.knock / Math.max(0.4, e.mass);
        e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k;
    }
    w.stats.dmgDealt += d;
    if (e.hp <= 0) { killEnemy(w, e, opts); return true; }
    return false;
}

export function killEnemy(w, e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const p = w.player;
    w.stats.kills++;
    w.kills[e.type] = (w.kills[e.type] ?? 0) + 1;
    emit(w, 'kill', { kind: e.type, x: e.x, y: e.y, r: e.r, alpha: e.alpha, boss: e.boss, id: e.id, crit: !!opts.crit, by: opts.kind ?? 'bullet' });
    if (e.boss) return; // bosses handle their own death
    // Leech.
    if (perk(w, 'leech')) {
        p.leech = (p.leech ?? 0) + 1;
        if (p.leech >= 6) { p.leech = 0; p.hp = Math.min(p.maxHp, p.hp + 1); }
    }
    // Bloaters burst; volatile biology makes anything burst.
    if (e.type === 'bloater') {
        explode(w, e.x, e.y, 2.6 * (e.alpha ? 1.3 : 1), 26 * w.diff.enemyDmg, { owner: 'enemy', kind: 'acid', hurtsEnemies: true, enemyDmg: 40 });
        spawnHazard(w, 'acid', e.x, e.y, 1.8 * (e.alpha ? 1.3 : 1), 5, 14 * w.diff.enemyDmg);
    } else if (perk(w, 'volatile') && w.rng.chance(0.15)) {
        explode(w, e.x, e.y, 2.4, 35, { owner: 'player', kind: 'bio' });
    }
    dropLoot(w, e);
}

export function dropLoot(w, e) {
    const def = ENEMIES[e.type];
    const rng = w.rng;
    const mul = w.diff.drops * (perk(w, 'scavenger') ? 1.5 : 1) * (e.alpha ? ALPHA.salvage : 1);
    let coins = def.salvage * mul;
    while (coins > 0) {
        if (coins >= 1 || rng.chance(coins)) spawnPickup(w, 'salvage', e.x, e.y, { val: SALVAGE_VALUE });
        coins -= 1;
    }
    if (w.mode === 'escape') return;
    const big = def.cost >= 4 ? 2.2 : 1;
    const dm = w.diff.drops * big * (e.alpha ? 2.5 : 1);
    if (rng.chance(0.022 * dm)) spawnPickup(w, 'health', e.x, e.y);
    if (rng.chance(0.03 * dm * (perk(w, 'scavenger') ? 1.6 : 1))) spawnPickup(w, 'ammo', e.x, e.y);
    if (rng.chance(0.009 * dm)) spawnPickup(w, 'armor', e.x, e.y);
    if (rng.chance(0.008 * dm)) spawnPickup(w, 'grenade', e.x, e.y);
    if (e.alpha && rng.chance(0.25)) spawnPickup(w, 'power', e.x, e.y, { power: randomPower(w) });
}

export function randomPower(w) {
    return w.rng.weighted({ overdrive: 3, hyperfire: 3, aegis: 2, drone: 3, stim: 2, cryo: 2, nova: 1.5 });
}

export function hurtPlayer(w, dmg, src = {}) {
    const p = w.player;
    if (!p.alive || w.god) return false;
    if (p.rollT > 0 && !src.unavoidable) return false;
    if (p.inv > 0 || p.pow.aegis > 0) return false;
    let d = dmg;
    if (perk(w, 'thickhide')) d *= 0.82;
    if (p.armor > 0) {
        const absorbed = Math.min(p.armor, d * 0.67);
        p.armor -= absorbed;
        d -= absorbed;
    }
    p.hp -= d;
    p.inv = PLAYER.hurtInv;
    w.stats.dmgTaken += dmg;
    emit(w, 'hurt', { dmg, x: p.x, y: p.y, sx: src.x ?? p.x, sy: src.y ?? p.y, kind: src.kind ?? 'hit' });
    if (p.hp <= 0) {
        if (perk(w, 'secondwind') && !p.secondWindUsed) {
            p.secondWindUsed = true;
            p.hp = 1;
            p.pow.aegis = 2.5;
            emit(w, 'secondwind', { x: p.x, y: p.y });
            radio(w, 'secondwind');
        } else {
            p.hp = 0;
            p.alive = false;
            w.phase = 'dead';
            w.deathCause = src.kind ?? 'swarm';
            emit(w, 'death', { x: p.x, y: p.y });
        }
    }
    return true;
}

/** owner 'player' hurts enemies (and props); 'enemy' hurts the player (and, if hurtsEnemies, bugs a little). */
export function explode(w, x, y, radius, dmg, opts = {}) {
    const owner = opts.owner ?? 'player';
    let r = radius;
    if (owner === 'player' && perk(w, 'demolition')) r *= 1.3;
    emit(w, 'explode', { x, y, r, kind: opts.kind ?? 'fire', owner });
    if (owner === 'player' || opts.hurtsEnemies) {
        const base = owner === 'player' ? dmg * dmgMul(w) : (opts.enemyDmg ?? dmg);
        queryHash(w, x, y, r + 1.5, (e) => {
            const d = Math.hypot(e.x - x, e.y - y) - e.r;
            if (d > r) return false;
            const f = 1 - 0.55 * Math.max(0, d) / r;
            damageEnemy(w, e, base * f, { sx: x, sy: y, knock: (opts.knock ?? 5) * f, kind: 'explosion', burn: opts.burn, noCrit: owner !== 'player' });
            return false;
        });
    }
    if (owner === 'enemy' || opts.selfDmg) {
        const p = w.player;
        const d = Math.hypot(p.x - x, p.y - y) - p.r;
        const base = owner === 'enemy' ? dmg : opts.selfDmg;
        if (d < r) hurtPlayer(w, base * (1 - 0.4 * Math.max(0, d) / r), { x, y, kind: opts.kind ?? 'blast' });
    }
    // Props in the blast.
    const lv = w.lv;
    const tx0 = Math.floor(x - r), tx1 = Math.floor(x + r), ty0 = Math.floor(y - r), ty1 = Math.floor(y + r);
    for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
            if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) continue;
            const pid = lv.propAt[ty * lv.w + tx];
            if (pid < 0) continue;
            if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r + 0.5) continue;
            damageProp(w, lv.props[pid], owner === 'player' ? dmg : dmg * 0.6);
        }
    }
}

export function damageProp(w, prop, dmg) {
    const def = PROPS[prop.type];
    if (prop.dead || !def.hp) return false;
    prop.hp -= dmg;
    prop.flash = 1;
    if (prop.hp > 0) { emit(w, 'propHit', { id: prop.id, x: prop.x + 0.5, y: prop.y + 0.5, kind: prop.type }); return false; }
    prop.dead = true;
    const lv = w.lv;
    const i = prop.y * lv.w + prop.x;
    lv.propAt[i] = -1;
    lv.solid[i] = 0;
    w.flowT = 0;
    emit(w, 'propBreak', { id: prop.id, x: prop.x + 0.5, y: prop.y + 0.5, kind: prop.type });
    const cx = prop.x + 0.5, cy = prop.y + 0.5;
    if (def.explode) {
        // Chain reactions are the point: delay a touch so barrels pop in sequence.
        w.delayed.push({ t: 0.08, fn: 'barrel', x: cx, y: cy });
    }
    if (def.drop && w.rng.chance(def.drop)) {
        const n = w.rng.int(1, 3);
        for (let k = 0; k < n; k++) spawnPickup(w, 'salvage', cx, cy, { val: SALVAGE_VALUE });
        if (w.rng.chance(0.35)) spawnPickup(w, w.rng.pick(['ammo', 'ammo', 'health', 'grenade', 'armor']), cx, cy);
    }
    if (def.bug && w.rng.chance(prop.type === 'tank' ? 0.6 : 0.5)) {
        const type = prop.type === 'tank' ? w.rng.pick(['drone', 'spitter', 'bloater']) : 'skitter';
        const n = type === 'skitter' ? w.rng.int(2, 4) : 1;
        for (let k = 0; k < n; k++) spawnEnemy(w, type, cx + w.rng.range(-0.3, 0.3), cy + w.rng.range(-0.3, 0.3), { emerge: 0.35, room: w.activeRoom });
    }
    return true;
}

// ------------------------------------------------------------------ Radio

export function radio(w, key) {
    if (!w.run.radio) w.run.radio = {};
    if (w.run.radio[key]) return;
    w.run.radio[key] = 1;
    emit(w, 'radio', { key });
}

export function hasPerk(w, id) { return !!w.player.perks[id]; }
export { PERKS };
