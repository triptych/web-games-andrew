// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input each step: { x, y, fire, jump, missile }
//   x  steer, −1 … 1 (left … right)        y  throttle, −1 (full throttle) … 1 (brake)
//   fire  held (latched by main.js, so a tap shorter than a step still fires)
//   jump, missile  edges: pressed since the last step

import { BOAT, FUEL, JUMP, GUN, MISSILE, DAMAGE, BOOSTS, PICKUP, COMBO, SECTOR, SECTORS, CORES } from '../config.js';
import { makeRng, mixSeed } from '../rng.js';
import { ENEMIES, BOSSES, SECTOR_DATA } from './data.js';
import { statsFor } from './skills.js';
import { newRiver, extendRiver, riverAt, surface } from './river.js';
import { placeSegment, spawn, stepEnemies, cullEnemies } from './enemies.js';
import { stepEmitters, stepBullets } from './patterns.js';
import { spawnBoss, stepBoss, hitPart, shielded, partPos } from './bosses.js';

export const NONE = { x: 0, y: 0, fire: false, jump: false, missile: false };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MAX_EVENTS = 600;

/** A new run. ranks = the skill tree as bought; sector = where to start (tests). */
export function newGame(seed = 1, ranks = {}, sector = 0) {
    const stats = statsFor(ranks);
    const G = {
        v: 1, seed, rng: makeRng(mixSeed(seed, 77)),
        t: 0, sector, phase: 'run', over: false, won: false, clearT: 0,
        ranks: { ...ranks }, stats,
        score: 0, cores: 0, coresBanked: 0, kills: 0, combo: 0, comboT: 0, mult: 1, bestCombo: 0, jumps: 0,
        log: [],
        boat: newBoat(stats),
        nextId: 1,
        events: [],
    };
    startSector(G, sector);
    return G;
}

function newBoat(stats) {
    return {
        x: 0, y: 0, vx: 0, speed: BOAT.cruise, z: 0, vz: 0,
        hull: stats.maxHull, fuel: FUEL.max, iframes: 0, shield: stats.startShield,
        charge: stats.charges, missiles: stats.missiles, missileT: 0, missileCd: 0, gunT: 0,
        weapon: null, weaponT: 0, overdriveT: 0, magnetT: 0, shieldT: stats.startShield ? 999 : 0,
        onDepot: false, throttle: 0, airT: 0,
    };
}

function startSector(G, s) {
    G.sector = s;
    G.phase = 'run';
    G.sectorT = 0;
    G.sectorKills = 0;
    G.river = newRiver(mixSeed(G.seed, s + 1), s, SECTOR_DATA[s]);
    G.spawnQ = [];
    G.enemies = []; G.shots = []; G.bullets = []; G.lanes = []; G.emitters = []; G.pickups = []; G.bridges = [];
    G.boss = null;
    G.bossDone = { mini: false, boss: false };
    const b = G.boat;
    b.x = 0; b.y = 0; b.vx = 0; b.z = 0; b.vz = 0; b.speed = BOAT.cruise;
    extendRiver(G.river, SECTOR.viewAhead + 400, (seg, rng) => placeSegment(G, seg, rng, SECTOR_DATA[s]));
    G.events.push({ type: 'sector', sector: s, name: SECTOR_DATA[s].name });
}

/**
 * Leave the dock: apply the (possibly new) skill ranks, patch the boat up and start the next sector.
 * Called by main.js after the dock screen, and by the bot/tests directly.
 */
export function nextSector(G, ranks = G.ranks) {
    if (G.phase !== 'dock') return false;
    G.ranks = { ...ranks };
    G.stats = statsFor(G.ranks);
    const b = G.boat;
    b.hull = Math.min(G.stats.maxHull, b.hull + G.stats.maxHull * 0.4);
    b.fuel = FUEL.max;
    b.missiles = G.stats.missiles;
    b.charge = G.stats.charges;
    b.shield = Math.max(b.shield, G.stats.startShield);
    if (b.shield) b.shieldT = Math.max(b.shieldT, 999);
    b.weapon = null; b.weaponT = 0; b.overdriveT = 0; b.magnetT = 0; b.iframes = 0;
    startSector(G, G.sector + 1);
    return true;
}

// ====================================================================== step
export function step(G, inp, dt) {
    if (G.over || G.phase === 'dock') return;
    G.t += dt;
    G.sectorT += dt;
    const b = G.boat, S = G.stats;

    stepBoat(G, inp, dt);
    if (G.over) return;
    stepWeapons(G, inp, dt);

    // the river and what is on it
    extendRiver(G.river, b.y + SECTOR.viewAhead + 300, (seg, rng) => placeSegment(G, seg, rng, SECTOR_DATA[G.sector]));
    while (G.spawnQ.length && G.spawnQ[0].y < b.y + SECTOR.viewAhead) spawn(G, G.spawnQ.shift());
    stepEnemies(G, dt);
    stepEmitters(G, dt);
    stepBullets(G, dt);
    stepBoss(G, dt);
    stepShots(G, dt);
    if (G.over) return;
    hitBoat(G);
    if (G.over) return;
    stepPickups(G, dt);
    cullEnemies(G);

    // a boss arena: the boss comes out when the boat is in it
    if (!G.boss && G.phase === 'run') {
        const arena = G.river.segs.find((s) => s.len === Infinity);
        if (arena && b.y >= arena.y0 - 6) {
            const which = arena.boss;
            if (!G.bossDone[which]) {
                G.bossDone[which] = true;
                // nothing small left in the arena
                G.spawnQ = G.spawnQ.filter((s) => s.y < arena.y0 - 20);
                spawnBoss(G, which === 'mini' ? SECTOR_DATA[G.sector].mini : SECTOR_DATA[G.sector].boss);
            }
        }
    }

    // combo
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.mult = 1; } }

    // sector clear → the dock (or the end)
    if (G.phase === 'clear') {
        G.clearT -= dt;
        if (G.clearT <= 0) {
            G.log.push({ sector: G.sector, name: SECTOR_DATA[G.sector].name, time: G.sectorT, kills: G.sectorKills, score: G.score });
            G.score += Math.round(b.hull) * 10 + Math.round(b.fuel) * 5;
            if (G.sector >= SECTORS - 1) {
                G.over = true; G.won = true;
                G.events.push({ type: 'victory', score: G.score });
            } else {
                G.phase = 'dock';
                G.events.push({ type: 'dock', sector: G.sector });
            }
        }
    }
    if (G.events.length > MAX_EVENTS) G.events.splice(0, G.events.length - MAX_EVENTS);
}

// ---------------------------------------------------------------------- the boat
function stepBoat(G, inp, dt) {
    const b = G.boat, S = G.stats;
    // steering: velocity eases toward the stick; reversing is quicker than starting
    const want = clamp(inp.x, -1, 1) * BOAT.lateralMax;
    const rate = BOAT.accel * (Math.sign(want) !== Math.sign(b.vx) && b.vx !== 0 ? 1.6 : 1);
    b.vx += clamp(want - b.vx, -rate * dt, rate * dt);
    if (!inp.x) b.vx *= Math.max(0, 1 - BOAT.drag * dt * 0.5);
    // throttle
    const thr = clamp(-inp.y, -1, 1);
    b.throttle = thr;
    let target = thr >= 0 ? BOAT.cruise + thr * (BOAT.maxSpeed - BOAT.cruise) : BOAT.cruise + thr * (BOAT.cruise - BOAT.minSpeed);
    if (b.fuel <= 0) target = BOAT.minSpeed;
    if (b.overdriveT > 0) target *= BOOSTS.overdrive.speed;
    b.speed += (target - b.speed) * Math.min(1, dt * BOAT.speedLerp);
    b.x += b.vx * dt;
    b.y += b.speed * dt;

    // timers
    if (b.iframes > 0) b.iframes -= dt;
    if (b.overdriveT > 0) b.overdriveT -= dt;
    if (b.magnetT > 0) b.magnetT -= dt;
    if (b.weaponT > 0) { b.weaponT -= dt; if (b.weaponT <= 0) { b.weapon = null; G.events.push({ type: 'boostend', kind: 'weapon' }); } }
    if (b.shield > 0 && b.shieldT < 900) { b.shieldT -= dt; if (b.shieldT <= 0) { b.shield = 0; G.events.push({ type: 'boostend', kind: 'shield' }); } }
    b.charge = Math.min(S.charges, b.charge + dt / S.jumpRecharge);
    if (b.missiles < S.missiles) { b.missileT += dt; if (b.missileT >= S.missileRegen) { b.missileT = 0; b.missiles++; } } else b.missileT = 0;
    if (b.missileCd > 0) b.missileCd -= dt;

    // jump
    if (inp.jump && b.z <= 0 && b.charge >= 1) {
        b.charge -= 1;
        b.vz = S.jumpV;
        b.airT = 0;
        G.jumps++;
        G.events.push({ type: 'jump', x: b.x, y: b.y });
    }
    if (b.z > 0 || b.vz > 0) {
        b.airT += dt;
        b.vz -= JUMP.gravity * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) { b.z = 0; b.vz = 0; land(G); }
    }

    // fuel
    const R = G.river;
    b.onDepot = false;
    if (b.z < JUMP.clear) {
        for (const e of G.enemies) {
            if (e.kind === 'depot' && Math.abs(e.x - b.x) < 2.4 && Math.abs(e.y - b.y) < 4.5) { b.onDepot = true; break; }
        }
    }
    if (b.onDepot) b.fuel = Math.min(FUEL.max, b.fuel + FUEL.depotRate * dt);
    else if (G.phase !== 'clear') b.fuel = Math.max(0, b.fuel - S.fuelDrain * (b.speed / BOAT.cruise) * dt);
    if (b.fuel <= 0) {
        b.hull -= FUEL.emptyHullDrain * dt;
        if (b.hull <= 0) return die(G, 'fuel');
    }

    // banks and sandbars push back (and scrape the hull), never kill outright
    const s = surface(R, b.x, b.y);
    const r = s.r;
    const lim = r.hw - BOAT.radius;
    if (Math.abs(b.x - r.cx) > lim) {
        const side = Math.sign(b.x - r.cx);
        b.x = r.cx + side * lim;
        if (Math.sign(b.vx) === side) b.vx = -b.vx * 0.35;
        b.speed *= 0.985;
        hurt(G, DAMAGE.bank, 'bank');
    }
    if (r.isl > 0 && b.z < JUMP.clear && Math.abs(b.x - r.cx) < r.isl + BOAT.radius) {
        const side = Math.sign(b.x - r.cx) || 1;
        b.x = r.cx + side * (r.isl + BOAT.radius);
        b.vx = side * Math.abs(b.vx) * 0.4;
        b.speed *= 0.98;
        hurt(G, DAMAGE.sandbar, 'sandbar');
    }
}

function land(G) {
    const b = G.boat, S = G.stats;
    G.events.push({ type: 'land', x: b.x, y: b.y, shock: S.shock });
    if (S.shock) {
        const rad = JUMP.shockRadius[S.shock], dmg = JUMP.shockDamage[S.shock];
        for (const e of G.enemies) if (Math.hypot(e.x - b.x, e.y - b.y) < rad + ENEMIES[e.kind].r) damageEnemy(G, e, dmg);
        for (let i = G.bullets.length - 1; i >= 0; i--) {
            const q = G.bullets[i];
            if (Math.hypot(q.x - b.x, q.y - b.y) < rad) { G.events.push({ type: 'cancel', x: q.x, y: q.y }); G.bullets.splice(i, 1); }
        }
        if (G.boss) for (const p of G.boss.parts) { const pp = partPos(G.boss, p); if (Math.hypot(pp.x - b.x, pp.y - b.y) < rad + p.r) hitPart(G, p, dmg); }
    }
    if (S.barrage) {
        for (let i = 0; i < JUMP.barrageShots; i++) {
            const a = (i / JUMP.barrageShots) * Math.PI * 2;
            G.shots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 40, vy: b.speed + Math.sin(a) * 40, life: 0.6, dmg: S.dmg * 2, pierce: 1, hits: [], kind: 'gun', seek: 0 });
        }
    }
}

// ---------------------------------------------------------------------- the player's guns
function stepWeapons(G, inp, dt) {
    const b = G.boat, S = G.stats;
    b.gunT -= dt;
    if (inp.fire && b.gunT <= 0) {
        const w = b.weapon;
        const rate = GUN.rate * (w === 'rapid' ? 2 : w === 'plasma' ? 0.55 : 1);
        b.gunT += 1 / rate;
        if (b.gunT < 0) b.gunT = 0;
        const life = GUN.range / GUN.speed;
        const shot = (x, a, extra = {}) => G.shots.push({
            x, y: b.y + 1.2, vx: Math.sin(a) * GUN.speed, vy: b.speed + Math.cos(a) * GUN.speed, life,
            dmg: S.dmg, pierce: S.pierce, hits: [], kind: 'gun', seek: S.seeker, ...extra,
        });
        if (w === 'plasma') {
            shot(b.x, 0, { dmg: S.dmg * 5, pierce: 3 + S.pierce, kind: 'plasma', r: 1.2 });
        } else {
            const n = S.barrels;
            for (let i = 0; i < n; i++) shot(b.x + (i - (n - 1) / 2) * GUN.spacing, (i - (n - 1) / 2) * 0.012);
            if (w === 'spread') for (const a of [-0.32, -0.16, 0.16, 0.32]) shot(b.x, a);
        }
        G.events.push({ type: 'shoot', weapon: w || 'gun' });
    }
    if (inp.missile && b.missiles >= 1 && b.missileCd <= 0) {
        b.missiles--;
        b.missileCd = MISSILE.cooldown;
        const tgt = pickTarget(G, b.x, b.y);
        G.shots.push({ x: b.x, y: b.y + 1, vx: 0, vy: b.speed + MISSILE.speed, life: MISSILE.life, dmg: MISSILE.damage, pierce: 0, hits: [], kind: 'missile', target: tgt, a: Math.PI / 2 });
        G.events.push({ type: 'missile' });
    }
}

/** The thing a missile goes after: a live boss part, else the nearest enemy ahead. Stored as an id string. */
export function pickTarget(G, x, y) {
    if (G.boss && !G.boss.entering) {
        const parts = G.boss.parts.filter((p) => !p.dead && !shielded(G, p));
        if (parts.length) return 'b:' + parts[0].id;
    }
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
        if (e.kind === 'depot' || e.kind === 'mine' || e.y < y + 3) continue;
        const d = Math.hypot(e.x - x, (e.y - y) * 0.6);
        if (d < bd && e.y - y < 80) { bd = d; best = e; }
    }
    return best ? 'e:' + best.id : null;
}

function targetPos(G, t) {
    if (!t) return null;
    if (t.startsWith('b:')) {
        if (!G.boss) return null;
        const p = G.boss.parts.find((q) => q.id === t.slice(2));
        return p && !p.dead ? partPos(G.boss, p) : null;
    }
    const id = +t.slice(2);
    const e = G.enemies.find((q) => q.id === id);
    return e ? e : null;
}

function stepShots(G, dt) {
    const b = G.boat;
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        if (s.kind === 'missile') {
            let tp = targetPos(G, s.target);
            if (!tp) { s.target = pickTarget(G, s.x, s.y); tp = targetPos(G, s.target); }
            if (tp) {
                const want = Math.atan2(tp.y - s.y, tp.x - s.x);
                let d = want - s.a;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                s.a += clamp(d, -MISSILE.turn * dt, MISSILE.turn * dt);
            }
            s.vx = Math.cos(s.a) * MISSILE.speed;
            s.vy = b.speed * 0.6 + Math.sin(s.a) * MISSILE.speed;
        } else if (s.seek) {
            // seeker rounds bend toward the nearest enemy ahead
            let best = null, bd = 12 + s.seek * 6;
            for (const e of G.enemies) {
                if (e.kind === 'depot' || e.y < s.y) continue;
                const d = Math.abs(e.x - s.x) + (e.y - s.y) * 0.25;
                if (d < bd) { bd = d; best = e; }
            }
            if (G.boss) for (const p of G.boss.parts) {
                if (p.dead || shielded(G, p)) continue;
                const pp = partPos(G.boss, p);
                if (pp.y < s.y) continue;
                const d = Math.abs(pp.x - s.x) + (pp.y - s.y) * 0.25;
                if (d < bd) { bd = d; best = pp; }
            }
            if (best) s.vx += clamp((best.x - s.x) * 6, -40, 40) * s.seek * dt * 2.2;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0 || collideShot(G, s)) G.shots.splice(i, 1);
    }
}

/** Resolve one player shot against everything. Returns true when the shot is spent. */
function collideShot(G, s) {
    const sr = s.r || (s.kind === 'missile' ? 0.8 : 0.35);
    // enemy missiles can be shot down
    for (let i = G.bullets.length - 1; i >= 0; i--) {
        const q = G.bullets[i];
        if (q.kind !== 'missile') continue;
        if (Math.hypot(q.x - s.x, q.y - s.y) < q.r + sr + 0.3) {
            G.bullets.splice(i, 1);
            G.score += 50 * G.mult;
            G.events.push({ type: 'boom', x: q.x, y: q.y, small: true });
            if (s.kind !== 'plasma') return true;
        }
    }
    for (const e of G.enemies.slice()) {
        if (e.hp <= 0 || s.hits.includes(e.id)) continue;
        const d = ENEMIES[e.kind];
        let hit;
        if (e.kind === 'blockade') hit = Math.abs(s.y - e.y) < 1.2 && blockadeCovers(e, s.x);
        else if (e.kind === 'depot') hit = Math.abs(s.x - e.x) < 2.2 && Math.abs(s.y - e.y) < 4;
        else hit = Math.hypot(e.x - s.x, e.y - s.y) < d.r + sr;
        if (!hit) continue;
        damageEnemy(G, e, s.dmg, s.kind === 'missile');
        if (s.kind === 'missile') { splash(G, s.x, s.y, e.id); return true; }
        s.hits.push(e.id);
        if (s.pierce-- <= 0) return true;
    }
    if (G.boss) {
        const B = G.boss;
        for (const p of B.parts) {
            if (p.dead) continue;
            const pp = partPos(B, p);
            if (Math.hypot(pp.x - s.x, pp.y - s.y) < p.r + sr) {
                hitPart(G, p, s.dmg);
                G.events.push({ type: 'spark', x: s.x, y: s.y });
                if (s.kind === 'missile') { G.events.push({ type: 'boom', x: s.x, y: s.y, small: true }); }
                return true;
            }
        }
    }
    for (const br of G.bridges) {
        if (br.down || Math.abs(s.y - br.y) > 1.5) continue;
        br.hp -= s.dmg;
        G.events.push({ type: 'spark', x: s.x, y: br.y });
        if (br.hp <= 0) {
            br.down = true;
            G.score += 500 * G.mult;
            addCores(G, br.x ?? br.cx, br.y, 3);
            G.events.push({ type: 'bridge', y: br.y, x: br.cx });
            G.events.push({ type: 'hitstop', t: 0.08 });
            for (const e of G.enemies) if (e.onBridge && Math.abs(e.y - br.y) < 2) damageEnemy(G, e, 999);
        }
        return true;
    }
    return false;
}

function blockadeCovers(e, x) {
    if (Math.abs(x - e.x) > e.w) return false;
    if (e.gap == null) return true;
    const gx = e.x + e.gap * e.w;
    return Math.abs(x - gx) > 3.2;
}

function splash(G, x, y, skipId) {
    G.events.push({ type: 'boom', x, y, small: true });
    for (const e of G.enemies) {
        if (e.id === skipId || e.kind === 'depot') continue;
        if (Math.hypot(e.x - x, e.y - y) < MISSILE.splash + ENEMIES[e.kind].r) damageEnemy(G, e, MISSILE.damage * 0.5);
    }
}

/** Damage an enemy; kills award score, combo, cores and drops. */
export function damageEnemy(G, e, dmg, heavy = false) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hit = 0.08;
    G.events.push({ type: 'hit', id: e.id, x: e.x, y: e.y, dmg });
    if (e.hp > 0) return;
    const d = ENEMIES[e.kind];
    const i = G.enemies.indexOf(e);
    if (i >= 0) G.enemies.splice(i, 1);
    G.kills++;
    G.sectorKills++;
    if (G.comboT > 0) G.combo++; else G.combo = 1;
    G.comboT = COMBO.window;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.mult = Math.min(COMBO.max, 1 + Math.floor(G.combo / COMBO.step) * COMBO.perStep);
    const pts = Math.round(d.score * G.mult);
    G.score += pts;
    G.boat.charge = Math.min(G.stats.charges, G.boat.charge + JUMP.killBonus);
    G.events.push({ type: 'kill', kind: e.kind, x: e.x, y: e.y, pts, combo: G.combo, mult: G.mult, big: d.hp >= 10 || heavy });
    if (d.hp >= 10) G.events.push({ type: 'hitstop', t: 0.05 });
    if (d.cores) addCores(G, e.x, e.y, d.cores);
    if (e.kind === 'barge') {
        for (let k = 0; k < 2; k++) G.pickups.push({ id: G.nextId++, kind: 'cell', x: e.x + (k ? 1.5 : -1.5), y: e.y, value: 1, t: 0 });
    } else if (e.kind === 'mine') {
        // a shot mine goes off: anything near it goes with it
        G.events.push({ type: 'boom', x: e.x, y: e.y, big: true });
        for (const o of [...G.enemies]) if (o.kind !== 'depot' && Math.hypot(o.x - e.x, o.y - e.y) < d.blast + ENEMIES[o.kind].r) damageEnemy(G, o, 6);
        const b = G.boat;
        if (b.z < JUMP.clear && Math.hypot(b.x - e.x, b.y - e.y) < d.blast * 0.7) hurt(G, DAMAGE.mine * 0.5, 'mine');
    } else if (e.kind !== 'depot' && e.kind !== 'blockade' && G.rng() < 0.08) {
        G.pickups.push({ id: G.nextId++, kind: G.rng.pick(['cell', 'repair', 'jump', 'spread', 'rapid', 'plasma', 'shield', 'magnet', 'overdrive']), x: e.x, y: e.y, value: 1, t: 0 });
    }
}

function addCores(G, x, y, n) {
    G.pickups.push({ id: G.nextId++, kind: 'core', x, y, value: n, t: 0 });
}

// ---------------------------------------------------------------------- what hits the boat
function hitBoat(G) {
    const b = G.boat;
    const low = b.z < JUMP.clear;
    if (low) {
        for (let i = G.bullets.length - 1; i >= 0; i--) {
            const q = G.bullets[i];
            if (Math.hypot(q.x - b.x, q.y - b.y) < q.r + BOAT.radius * 0.75) {
                G.bullets.splice(i, 1);
                hurt(G, q.kind === 'shell' ? DAMAGE.shell : q.kind === 'missile' ? DAMAGE.shell : DAMAGE.bullet, q.kind);
                if (G.over) return;
            }
        }
        for (const l of G.lanes) {
            if (l.live && Math.abs(b.x - l.x) < l.w / 2 + BOAT.radius * 0.5) { hurt(G, DAMAGE.laser, 'laser'); if (G.over) return; }
        }
        for (const e of [...G.enemies]) {
            const d = ENEMIES[e.kind];
            if (e.kind === 'depot' || d.where === 'bank') continue;
            if (e.kind === 'blockade') {
                if (Math.abs(b.y - e.y) < 1.4 && blockadeCovers(e, b.x)) {
                    if (b.overdriveT > 0) { damageEnemy(G, e, 999); continue; }
                    hurt(G, DAMAGE.blockade, 'blockade');
                    b.speed = Math.min(b.speed, 8);
                    damageEnemy(G, e, 999);         // ramming a boom breaks it, at a price
                }
                continue;
            }
            if (Math.hypot(e.x - b.x, e.y - b.y) < d.r + BOAT.radius) {
                if (b.overdriveT > 0) { damageEnemy(G, e, 30, true); continue; }
                if (e.kind === 'mine') { hurt(G, DAMAGE.mine, 'mine'); G.events.push({ type: 'boom', x: e.x, y: e.y, big: true }); const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1); }
                else { hurt(G, DAMAGE.ram, 'ram'); damageEnemy(G, e, 4, true); }
                if (G.over) return;
            }
        }
    }
    if (G.boss && !G.boss.dying) {
        // ramming a boss hurts the boat (jumping over the hull is fine)
        for (const p of G.boss.parts) {
            const pp = partPos(G.boss, p);
            if (!p.dead && low && Math.hypot(pp.x - b.x, pp.y - b.y) < p.r + BOAT.radius) { hurt(G, DAMAGE.ram, 'ram'); b.speed *= 0.7; }
        }
    }
}

/** The boat takes damage (respecting overdrive, i-frames and the barrier). */
export function hurt(G, dmg, cause) {
    const b = G.boat;
    if (G.over || b.overdriveT > 0 || b.iframes > 0) return false;
    if (b.shield > 0) {
        b.shield--;
        b.iframes = 0.35;
        G.events.push({ type: 'shieldhit', left: b.shield });
        if (b.shield <= 0) b.shieldT = 0;
        return false;
    }
    b.hull -= dmg;
    b.iframes = BOAT.iframes;
    G.combo = 0; G.comboT = 0; G.mult = 1;
    G.events.push({ type: 'hurt', dmg, cause, x: b.x, y: b.y });
    if (dmg >= 12) G.events.push({ type: 'hitstop', t: 0.06 });
    if (b.hull <= 0) die(G, cause);
    return true;
}

function die(G, cause) {
    const b = G.boat;
    b.hull = 0;
    G.over = true; G.won = false;
    G.log.push({ sector: G.sector, name: SECTOR_DATA[G.sector].name, time: G.sectorT, kills: G.sectorKills, score: G.score, died: cause });
    G.events.push({ type: 'over', cause, score: G.score });
    G.events.push({ type: 'boom', x: b.x, y: b.y, big: true });
}

// ---------------------------------------------------------------------- pickups
function stepPickups(G, dt) {
    const b = G.boat, S = G.stats;
    const reach = b.magnetT > 0 ? BOOSTS.magnet.radius : S.reach;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const p = G.pickups[i];
        p.t += dt;
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        // cores always drift to a nearby boat; a magnet pulls everything
        if (d < reach && (p.kind === 'core' || b.magnetT > 0)) {
            const pull = (b.speed + 18) * dt;
            p.x += (dx / (d || 1)) * pull;
            p.y += (dy / (d || 1)) * pull;
        }
        if (Math.hypot(b.x - p.x, b.y - p.y) < PICKUP.radius + BOAT.radius && b.z < 3.5) {
            G.pickups.splice(i, 1);
            collect(G, p);
        }
    }
}

function collect(G, p) {
    const b = G.boat, S = G.stats, m = S.boostMul;
    switch (p.kind) {
        case 'core': G.cores += p.value; G.score += 25 * p.value; break;
        case 'cell': b.fuel = Math.min(FUEL.max, b.fuel + FUEL.cell); break;
        case 'repair': b.hull = Math.min(S.maxHull, b.hull + 30); break;
        case 'jump': b.charge = S.charges; break;
        case 'overdrive': b.overdriveT = BOOSTS.overdrive.time * m; break;
        case 'spread': case 'plasma': case 'rapid': b.weapon = p.kind; b.weaponT = BOOSTS[p.kind].time * m; break;
        case 'shield': b.shield = Math.max(b.shield, BOOSTS.shield.hits); b.shieldT = BOOSTS.shield.time * m; break;
        case 'magnet': b.magnetT = BOOSTS.magnet.time * m; break;
    }
    G.events.push({ type: 'pickup', kind: p.kind, x: p.x, y: p.y, value: p.value });
}

// ---------------------------------------------------------------------- saving
/** Cores earned this run that are not in the bank yet. main.js moves them to the meta save. */
export function unbanked(G) { return G.cores - G.coresBanked; }
export function bank(G) { const n = unbanked(G); G.coresBanked = G.cores; return n; }

export function serialize(G) {
    const { rng, events, stats, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }, (k, v) => (v === Infinity ? 'Infinity' : v)));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest), (k, v) => (v === 'Infinity' ? Infinity : v)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    G.stats = statsFor(G.ranks);
    return G;
}

export { riverAt, BOSSES, SECTOR_DATA, CORES };
