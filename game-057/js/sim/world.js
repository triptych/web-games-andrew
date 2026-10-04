/**
 * world.js — the simulation. A run (loadout, perks, progress) produces a
 * world for one sector; step(world, input) advances it by SIM_DT.
 *
 * Phases: play → perk (boss dead, choosing a field upgrade) → play →
 * complete (took the elevator) | dead | victory.
 *
 * Input (one step): { mx, my, aimX, aimY, fire, roll, grenade, pulse,
 * interact, reload, swap (−1/0/1), slot (−1 or index), assist }.
 */

import {
    SIM_DT, PLAYER, DIFFICULTY, WEAPONS, ENEMIES, PERKS, PERK_ORDER, POWERUPS, SHOP, ESCAPE_TIME, HORDE,
    sectorTheme, WEAPON_SECTOR, SALVAGE_VALUE,
} from '../config.js';
import { makeRng, hashSeed } from './rng.js';
import { generateSector, generateEscape, generateHorde, roomAtPos, pickWeapon } from './level.js';
import {
    TAU, angDiff, emit, moveEntity, collideCircle, buildFlow, flowAt, flowDir, buildHash, queryHash, los,
    spawnEnemy, spawnBossEntity, spawnPickup, explode, hurtPlayer, killEnemy, damageEnemy, randomPower, radio, hasPerk,
    spawnEBullet, spawnHazard,
} from './core.js';
import { updateEnemy, updateEBullets, clearBullets } from './enemies.js';
import { updateBoss } from './bosses.js';
import {
    updateWeapons, updatePBullets, updateGrenades, updateDrones, throwGrenade, firePulse, switchWeapon,
} from './weapons.js';

// ------------------------------------------------------------------ Runs

export function defaultLoadout(difficulty = 'marine') {
    const hp = Math.round(PLAYER.hp * DIFFICULTY[difficulty].playerHp);
    return {
        hp, maxHp: hp, armor: 0,
        weapons: [{ id: 'pulse', mk: 1, mag: WEAPONS.pulse.mag, reserve: Infinity }],
        cur: 0, grenades: PLAYER.grenades, pulses: PLAYER.pulses, salvage: 0,
    };
}

export function newRun({ seed = 1, difficulty = 'marine', mode = 'campaign' } = {}) {
    return {
        v: 1, seed: seed >>> 0, difficulty, mode, sector: 0, attempt: 0,
        loadout: defaultLoadout(difficulty), perks: {},
        stats: { kills: 0, shots: 0, dmgTaken: 0, dmgDealt: 0, time: 0, deaths: 0, grazes: 0, salvage: 0 },
        logs: {}, radio: {}, seen: {}, best: 0,
    };
}

function cloneLoadout(l) {
    return { ...l, weapons: l.weapons.map((x) => ({ ...x })) };
}

// ------------------------------------------------------------------ World

export function newWorld(run, opts = {}) {
    const mode = run.mode === 'horde' ? 'horde' : run.sector >= 5 ? 'escape' : 'campaign';
    const sector = mode === 'horde' ? 'horde' : mode === 'escape' ? 'escape' : run.sector;
    const mapSeed = hashSeed(run.seed, mode === 'escape' ? 99 : mode === 'horde' ? 77 : run.sector);
    const lv = mode === 'horde' ? generateHorde(mapSeed) : mode === 'escape' ? generateEscape(mapSeed) : generateSector(mapSeed, run.sector);
    const theme = sectorTheme(sector);
    const diff = DIFFICULTY[run.difficulty] ?? DIFFICULTY.marine;
    const lo = cloneLoadout(run.loadout);
    const sectorNum = typeof sector === 'number' ? sector : 4;
    const w = {
        run, mode, sector, sectorNum, theme, lv, diff,
        rng: makeRng(hashSeed(run.seed, 1000 + (typeof sector === 'number' ? sector : 9), run.attempt)),
        t: 0, phase: 'play', events: [], delayed: [], nextId: 1,
        enemies: [], pbullets: [], ebullets: [], grenades: [], pickups: [], hazards: [], byId: new Map(),
        items: lv.items.map((it) => ({ ...it })),
        player: null, ellie: null, boss: null, bossDone: false,
        activeRoom: -1, flow: null, flowT: 0, flowTile: -1,
        hpScale: mode === 'escape' ? 1.55 : mode === 'horde' ? 1 : 1 + 0.15 * run.sector,
        alphaChance: (theme.alpha ?? 0) + diff.alpha,
        cap: opts.cap ?? 260, god: false,
        cryoT: 0, ambushT: 30, cleared: 0, prompt: null, perkOptions: null,
        stats: { kills: 0, shots: 0, dmgTaken: 0, dmgDealt: 0, grazes: 0, salvage: 0 },
        kills: {}, seen: {}, deathCause: null, lowWarned: false,
        escape: null, horde: null,
    };
    const p = {
        x: lv.start.x, y: lv.start.y + (mode === 'campaign' ? 1.6 : 0), ox: 0, oy: 0, vx: 0, vy: 0, kx: 0, ky: 0,
        r: PLAYER.r, face: -Math.PI / 2, alive: true,
        hp: lo.hp, maxHp: lo.maxHp, armor: lo.armor, weapons: lo.weapons, cur: Math.min(lo.cur, lo.weapons.length - 1),
        grenades: lo.grenades, pulses: Math.max(lo.pulses, PLAYER.pulses), salvage: lo.salvage,
        perks: { ...run.perks }, pow: {}, drones: [],
        rollT: 0, rollCd: 0, rdx: 0, rdy: 0, inv: 1.2, slowT: 0,
        fireCd: 0, reloadT: 0, reloadDur: 1, charge: 0, spin: 0, shots: 0, anim: 0, moving: 0,
        secondWindUsed: false, leech: 0,
    };
    if (mode === 'horde' || mode === 'escape') p.inv = 2;
    p.ox = p.x; p.oy = p.y;
    w.player = p;
    for (const k in POWERUPS) p.pow[k] = 0;
    if (mode === 'escape') {
        const s = lv.start;
        w.ellie = { x: s.x + 1.2, y: s.y + 0.8, ox: s.x + 1.2, oy: s.y + 0.8, vx: 0, vy: 0, r: 0.3, face: -Math.PI / 2, fireCd: 1, anim: 0 };
        w.escape = { t: ESCAPE_TIME, spawnT: 3, half: false, last: false };
        radio(w, 'escape_start');
    } else if (mode === 'horde') {
        w.horde = { wave: 0, t: 3.5, queue: [], spawned: 0, best: run.best ?? 0 };
        radio(w, 'horde_start');
    } else {
        radio(w, `s${run.sector}_start`);
    }
    buildFlow(w);
    buildHash(w);
    emit(w, 'start', { mode, sector });
    return w;
}

/** The run as it should be saved after taking the elevator. */
export function completeSector(w) {
    const run = w.run, p = w.player;
    run.loadout = {
        hp: p.hp, maxHp: p.maxHp, armor: p.armor, weapons: p.weapons.map((x) => ({ ...x })), cur: p.cur,
        grenades: p.grenades, pulses: p.pulses, salvage: p.salvage,
    };
    run.perks = { ...p.perks };
    mergeStats(w);
    run.sector++;
    run.attempt = 0;
    return run;
}

export function mergeStats(w) {
    const s = w.run.stats;
    for (const k of ['kills', 'shots', 'dmgTaken', 'dmgDealt', 'grazes', 'salvage']) s[k] += w.stats[k];
    s.time += w.t;
    w.stats = { kills: 0, shots: 0, dmgTaken: 0, dmgDealt: 0, grazes: 0, salvage: 0 };
    for (const k in w.seen) w.run.seen[k] = Math.max(w.run.seen[k] ?? 0, 1);
}

// ------------------------------------------------------------------ Step

const NO_INPUT = { mx: 0, my: 0, aimX: 0, aimY: 0, fire: false };

export function step(w, input = NO_INPUT) {
    const dt = SIM_DT;
    if (w.phase === 'perk' || w.phase === 'complete' || w.phase === 'victory') return;
    w.t += dt;
    const p = w.player;
    if (!p.alive) input = { ...NO_INPUT, aimX: p.x, aimY: p.y };
    processDelayed(w, dt);
    updatePlayer(w, input, dt);
    if (p.alive) updateWeapons(w, input, dt);
    w.flowT -= dt;
    const tile = Math.floor(p.y) * w.lv.w + Math.floor(p.x);
    if (w.flowT <= 0 || tile !== w.flowTile) buildFlow(w);
    buildHash(w);
    updateEnemies(w, dt);
    buildHash(w);
    updateDrones(w, dt);
    updatePBullets(w, dt);
    updateGrenades(w, dt);
    updateEBullets(w, dt);
    updateHazards(w, dt);
    updatePickups(w, dt);
    updateDoors(w, dt);
    if (w.ellie) updateEllie(w, dt);
    if (w.mode === 'campaign') updateRooms(w, dt);
    else if (w.mode === 'escape') updateEscape(w, dt);
    else updateHorde(w, dt);
    if (w.boss && w.boss.dead && !w.bossDone) bossDefeated(w);
    // Sweep the dead.
    let n = 0;
    for (const e of w.enemies) { if (!e.dead) w.enemies[n++] = e; else w.byId.delete(e.id); }
    w.enemies.length = n;
    if (w.cryoT > 0) w.cryoT -= dt;
    if (p.alive && !w.lowWarned && p.hp < p.maxHp * 0.3) { w.lowWarned = true; radio(w, 'lowhp'); }
    updatePrompt(w);
}

// ------------------------------------------------------------------ Player

function updatePlayer(w, input, dt) {
    const p = w.player;
    p.ox = p.x; p.oy = p.y;
    p.inv -= dt;
    p.slowT -= dt;
    p.rollCd -= dt * (p.pow.stim > 0 ? 2 : 1);
    for (const k in p.pow) if (p.pow[k] > 0) { p.pow[k] -= dt; if (p.pow[k] <= 0) { p.pow[k] = 0; emit(w, 'powerEnd', { kind: k }); } }
    if (!p.alive) { p.vx *= 0.9; p.vy *= 0.9; return; }
    // Aim.
    let ang = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (!Number.isFinite(ang)) ang = p.face;
    if (input.assist) ang = assistAim(w, ang);
    p.face = ang;
    // Weapons & actions.
    if (input.slot >= 0) switchWeapon(w, input.slot);
    else if (input.swap) switchWeapon(w, (p.cur + input.swap + p.weapons.length) % p.weapons.length);
    if (input.grenade) throwGrenade(w, input.aimX, input.aimY);
    if (input.pulse) firePulse(w);
    if (input.interact) interact(w);
    let mx = input.mx || 0, my = input.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = Math.min(1, ml);
    if (p.rollT > 0) {
        p.rollT -= dt;
        p.vx = p.rdx * PLAYER.rollSpeed; p.vy = p.rdy * PLAYER.rollSpeed;
        if (hasPerk(w, 'combatroll')) {
            queryHash(w, p.x, p.y, 1.4, (e) => {
                if (e.boss || e.spawnT > 0 || e.under) return false;
                if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 0.5 && !(e.rolled > w.t)) {
                    e.rolled = w.t + 0.4;
                    damageEnemy(w, e, 12, { sx: p.x, sy: p.y, knock: 8, kind: 'melee' });
                }
                return false;
            });
        }
        if (p.rollT <= 0) p.vx *= 0.5, p.vy *= 0.5;
    } else {
        let speed = PLAYER.speed;
        if (p.pow.stim > 0) speed *= 1.3;
        if (hasPerk(w, 'adrenal') && p.hp < p.maxHp * 0.35) speed *= 1.3;
        if (p.slowT > 0) speed *= 0.55;
        const wp = p.weapons[p.cur];
        if (wp.id === 'minigun' && p.spin > 0.3) speed *= 0.72;
        if (wp.id === 'rail' && p.charge > 0) speed *= 0.65;
        if (wp.id === 'flame' && input.fire) speed *= 0.85;
        const k = 1 - Math.exp(-16 * dt);
        p.vx += (mx * speed - p.vx) * k;
        p.vy += (my * speed - p.vy) * k;
        if (input.roll && p.rollCd <= 0) {
            let dx = mx, dy = my;
            if (ml < 0.1) { dx = Math.cos(ang); dy = Math.sin(ang); }
            const l = Math.hypot(dx, dy) || 1;
            p.rdx = dx / l; p.rdy = dy / l;
            p.rollT = PLAYER.rollTime;
            p.rollCd = PLAYER.rollTime + PLAYER.rollCd * (hasPerk(w, 'combatroll') ? 0.6 : 1);
            p.reloadT = p.reloadT > 0 ? p.reloadT : 0;
            emit(w, 'roll', { x: p.x, y: p.y, dx: p.rdx, dy: p.rdy });
        }
    }
    const kd = Math.exp(-9 * dt);
    p.kx *= kd; p.ky *= kd;
    moveEntity(w.lv, p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt);
    p.anim += Math.hypot(p.vx, p.vy) * dt;
}

function assistAim(w, ang) {
    const p = w.player;
    let best = null, bs = 1e9;
    queryHash(w, p.x, p.y, 13, (e) => {
        if (e.spawnT > 0 || e.under || e.hidden || (e.type === 'stalker' && e.cloak <= 0)) return false;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > 13) return false;
        const da = Math.abs(angDiff(Math.atan2(dy, dx), ang));
        if (da > 0.38) return false;
        const sc = da * 10 + d * 0.15;
        if (sc < bs) { bs = sc; best = e; }
        return false;
    });
    if (best && los(w.lv, p.x, p.y, best.x, best.y)) return Math.atan2(best.y - p.y, best.x - p.x);
    return ang;
}

// ------------------------------------------------------------------ Enemies

function updateEnemies(w, dt) {
    const lv = w.lv;
    const p = w.player;
    const E = w.enemies;
    for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.dead) continue;
        e.ox = e.x; e.oy = e.y;
        if (e.spawnT > 0) { e.spawnT -= dt; continue; }
        if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
        if (e.burnT > 0) {
            e.burnT -= dt;
            e.hp -= e.burn * dt;
            if (e.hp <= 0) { killEnemy(w, e, { kind: 'fire' }); continue; }
        }
        if (e.stun > 0) { e.stun -= dt; e.dvx = 0; e.dvy = 0; }
        else if (e.boss) updateBoss(w, e, dt);
        else updateEnemy(w, e, dt);
        if (e.dead) continue;
        const k = 1 - Math.exp(-(e.boss ? 8 : 12) * dt);
        e.vx += ((e.dvx || 0) - e.vx) * k;
        e.vy += ((e.dvy || 0) - e.vy) * k;
        const kd = Math.exp(-7 * dt);
        e.kx *= kd; e.ky *= kd;
        if (e.boss && e.hidden) { e.vx = 0; e.vy = 0; continue; }
        e.wallHit = moveEntity(lv, e, (e.vx + e.kx) * dt, (e.vy + e.ky) * dt) && Math.hypot(e.vx, e.vy) > 6;
        e.anim += (Math.hypot(e.vx, e.vy) * 1.2 + 0.6) * dt;
    }
    // Separation between bugs, and bugs crowding the marine.
    for (let i = 0; i < E.length; i++) {
        const a = E[i];
        if (a.dead || a.spawnT > 0 || a.under) continue;
        queryHash(w, a.x, a.y, a.r + 1, (b) => {
            if (b === a || b.id < a.id || b.spawnT > 0 || b.under) return false;
            const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr || d2 < 1e-8) return false;
            const d = Math.sqrt(d2), push = (rr - d) * 0.5;
            const wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
            const nx = dx / d, ny = dy / d;
            a.x -= nx * push * wa * 1.6; a.y -= ny * push * wa * 1.6;
            b.x += nx * push * wb * 1.6; b.y += ny * push * wb * 1.6;
            return false;
        });
        if (p.alive && p.rollT <= 0 && !a.under) {
            const dx = p.x - a.x, dy = p.y - a.y, rr = a.r + p.r;
            const d2 = dx * dx + dy * dy;
            if (d2 < rr * rr && d2 > 1e-8) {
                const d = Math.sqrt(d2), push = rr - d;
                const share = a.boss ? 1 : Math.min(0.5, a.mass * 0.12);
                p.x += (dx / d) * push * share; p.y += (dy / d) * push * share;
                a.x -= (dx / d) * push * (1 - share); a.y -= (dy / d) * push * (1 - share);
            }
        }
    }
    for (const e of E) if (!e.dead && !e.under) collideCircle(lv, e);
    collideCircle(lv, p);
}

// ------------------------------------------------------------------ Delayed actions

function processDelayed(w, dt) {
    const D = w.delayed;
    let n = 0;
    for (let i = 0; i < D.length; i++) {
        const d = D[i];
        d.t -= dt;
        if (d.t > 0) { D[n++] = d; continue; }
        switch (d.fn) {
        case 'barrel':
            explode(w, d.x, d.y, 2.9, 75, { owner: 'player', kind: 'fire', knock: 7, selfDmg: 22 });
            spawnHazard(w, 'fire', d.x, d.y, 1.2, 3, 10);
            break;
        case 'eblast':
            explode(w, d.x, d.y, d.r, d.dmg * w.diff.enemyDmg, { owner: 'enemy', kind: d.kind });
            if (d.hazard) spawnHazard(w, d.hazard, d.x, d.y, d.r * 0.7, 3.5, 12 * w.diff.enemyDmg);
            break;
        case 'egg': {
            explode(w, d.x, d.y, d.r, d.dmg * w.diff.enemyDmg, { owner: 'enemy', kind: 'acid' });
            const n2 = w.rng.int(2, 3);
            for (let k = 0; k < n2 && w.enemies.length < w.cap; k++) spawnEnemy(w, 'skitter', d.x + w.rng.range(-0.4, 0.4), d.y + w.rng.range(-0.4, 0.4), { emerge: 0.25, room: d.room });
            if (w.rng.chance(0.3)) spawnEnemy(w, 'drone', d.x, d.y, { emerge: 0.3, room: d.room });
            break;
        }
        case 'boom':
            emit(w, 'explode', { x: d.x, y: d.y, r: d.r, kind: d.kind ?? 'fire', owner: 'none' });
            break;
        case 'perk':
            w.perkOptions = perkOptions(w);
            if (w.perkOptions.length) { w.phase = 'perk'; emit(w, 'perkChoice', {}); }
            break;
        case 'item':
            w.items.push({ ...d.item, id: w.items.length, used: false });
            emit(w, 'itemSpawn', { kind: d.item.kind, x: d.item.x, y: d.item.y });
            break;
        default: break;
        }
    }
    D.length = n;
}

// ------------------------------------------------------------------ Hazards & pickups

function updateHazards(w, dt) {
    const p = w.player;
    const H = w.hazards;
    let n = 0;
    for (const h of H) {
        h.t -= dt;
        if (h.t <= 0) continue;
        H[n++] = h;
        if (p.alive && Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.5) {
            p.hazT = (p.hazT ?? 0) - dt;
            if (p.hazT <= 0) { p.hazT = 0.5; hurtPlayer(w, h.dps * 0.5, { x: h.x, y: h.y, kind: h.kind }); }
        }
    }
    H.length = n;
}

function upgradable(p) { return p.weapons.some((x) => x.mk < 3); }
function ammoFull(p) { return p.weapons.every((x) => x.reserve === Infinity || x.reserve >= WEAPONS[x.id].reserve); }

export function wants(w, pk) {
    const p = w.player;
    switch (pk.kind) {
    case 'health': case 'bighealth': return p.hp < p.maxHp;
    case 'armor': return p.armor < PLAYER.armorMax;
    case 'ammo': return !ammoFull(p);
    case 'grenade': return p.grenades < grenadeCap(w);
    case 'pulse': return p.pulses < pulseCap(w);
    case 'weapon': return p.weapons.some((x) => x.id === pk.weapon) || p.weapons.length < PLAYER.slots;
    default: return true;
    }
}

const grenadeCap = (w) => PLAYER.grenadeMax + (hasPerk(w, 'demolition') ? 1 : 0);
const pulseCap = (w) => PLAYER.pulseMax + (hasPerk(w, 'capacitor') ? 1 : 0);

function updatePickups(w, dt) {
    const p = w.player;
    const P = w.pickups;
    const magR = PLAYER.magnetR * (hasPerk(w, 'magnet') ? 3 : 1);
    let n = 0;
    for (const pk of P) {
        pk.ox = pk.x; pk.oy = pk.y;
        pk.t += dt;
        pk.life -= dt;
        if (pk.life <= 0) continue;
        const dx = p.x - pk.x, dy = p.y - pk.y, d = Math.hypot(dx, dy);
        const want = p.alive && pk.t > 0.35 && wants(w, pk);
        if (want && d < magR && pk.kind !== 'weapon') {
            const sp = 9 + pk.t * 2;
            pk.vx += ((dx / d) * sp - pk.vx) * Math.min(1, dt * 8);
            pk.vy += ((dy / d) * sp - pk.vy) * Math.min(1, dt * 8);
        } else {
            const f = Math.exp(-4 * dt);
            pk.vx *= f; pk.vy *= f;
        }
        moveEntity(w.lv, pk, pk.vx * dt, pk.vy * dt);
        if (want && d < PLAYER.pickupR * 0.75 && collect(w, pk)) continue;
        P[n++] = pk;
    }
    P.length = n;
}

function addAmmo(p, frac) {
    for (const x of p.weapons) {
        if (x.reserve === Infinity) continue;
        const max = WEAPONS[x.id].reserve;
        x.reserve = Math.min(max, x.reserve + Math.ceil(max * frac));
    }
}

function upgradeWeapon(w, wp) {
    if (wp.mk >= 3) return false;
    wp.mk++;
    const def = WEAPONS[wp.id];
    wp.mag = def.mag;
    emit(w, 'upgrade', { weapon: wp.id, mk: wp.mk });
    return true;
}

/** Apply a pickup; returns true if it was consumed. */
function collect(w, pk) {
    const p = w.player;
    let ok = true;
    switch (pk.kind) {
    case 'salvage': p.salvage += pk.val ?? SALVAGE_VALUE; w.stats.salvage += pk.val ?? SALVAGE_VALUE; break;
    case 'health': p.hp = Math.min(p.maxHp, p.hp + 25); break;
    case 'bighealth': p.hp = Math.min(p.maxHp, p.hp + 60); break;
    case 'armor': p.armor = Math.min(PLAYER.armorMax, p.armor + 25); break;
    case 'ammo': addAmmo(p, 0.3); break;
    case 'grenade': p.grenades = Math.min(grenadeCap(w), p.grenades + 1); break;
    case 'pulse': p.pulses = Math.min(pulseCap(w), p.pulses + 1); break;
    case 'mod': {
        const cur = p.weapons[p.cur];
        if (!upgradeWeapon(w, cur)) {
            const other = p.weapons.find((x) => x.mk < 3);
            if (other) upgradeWeapon(w, other);
            else { p.salvage += 30; w.stats.salvage += 30; }
        }
        break;
    }
    case 'power': activatePower(w, pk.power); break;
    case 'weapon': ok = takeWeapon(w, pk.weapon, false); break;
    default: break;
    }
    if (ok) emit(w, 'pickup', { kind: pk.kind, x: pk.x, y: pk.y, power: pk.power, weapon: pk.weapon, val: pk.val });
    return ok;
}

/** Take a weapon: upgrade a duplicate, fill a free slot, or (if swap) replace the current gun. */
function takeWeapon(w, id, swap) {
    const p = w.player;
    const have = p.weapons.find((x) => x.id === id);
    if (have) {
        if (!upgradeWeapon(w, have)) { addAmmo(p, 1); p.salvage += 20; }
        else addAmmo(p, 0.25);
        return true;
    }
    const fresh = { id, mk: 1, mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    if (p.weapons.length < PLAYER.slots) {
        p.weapons.push(fresh);
        switchWeapon(w, p.weapons.length - 1);
        emit(w, 'newWeapon', { weapon: id });
        return true;
    }
    if (!swap) return false;
    const old = p.weapons[p.cur];
    if (old.id === 'pulse') {
        // The rifle never leaves; swap the next slot instead.
        const j = p.cur === 0 ? 1 : p.cur;
        const dropped = p.weapons[j];
        p.weapons[j] = fresh;
        spawnPickup(w, 'weapon', p.x, p.y, { weapon: dropped.id, pop: 2 });
        switchWeapon(w, j);
    } else {
        p.weapons[p.cur] = fresh;
        spawnPickup(w, 'weapon', p.x, p.y, { weapon: old.id, pop: 2 });
        p.reloadT = 0;
    }
    emit(w, 'newWeapon', { weapon: id });
    return true;
}

export function activatePower(w, kind) {
    const p = w.player;
    const def = POWERUPS[kind];
    if (kind === 'nova') {
        explode(w, p.x, p.y, 7, 160, { owner: 'player', kind: 'nova', knock: 12 });
        clearBullets(w, p.x, p.y, 8);
    } else if (kind === 'cryo') {
        w.cryoT = def.dur;
        p.pow.cryo = def.dur;
    } else {
        p.pow[kind] = def.dur;
    }
    emit(w, 'power', { kind, x: p.x, y: p.y });
}

// ------------------------------------------------------------------ Items & interaction

const INTERACT_R = 1.9;

function updatePrompt(w) {
    const p = w.player;
    w.prompt = null;
    if (!p.alive) return;
    let best = null, bd = INTERACT_R;
    for (const it of w.items) {
        if (it.used || it.kind === 'pad' || it.kind === 'dropship' || it.kind === 'shopterm') continue;
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < bd) { bd = d; best = it; }
    }
    if (best) {
        const can = best.kind !== 'shopitem' || best.item === 'weapon' ? true : p.salvage >= best.price;
        w.prompt = { kind: best.kind, id: best.id, item: best.item, weapon: best.weapon, price: shopPrice(w, best), can: best.kind === 'shopitem' ? p.salvage >= shopPrice(w, best) : can, log: best.log };
        return;
    }
    // A gun on the floor while every slot is full.
    for (const pk of w.pickups) {
        if (pk.kind !== 'weapon' || pk.t < 0.4) continue;
        if (Math.hypot(pk.x - p.x, pk.y - p.y) < 1.4 && !wants(w, pk)) {
            w.prompt = { kind: 'swap', id: pk.id, weapon: pk.weapon, current: p.weapons[p.cur].id === 'pulse' ? p.weapons[1]?.id : p.weapons[p.cur].id, can: true };
            return;
        }
    }
}

function shopPrice(w, it) {
    if (it.kind !== 'shopitem') return 0;
    if (it.item === 'weapon') return WEAPONS[it.weapon].price;
    return it.price;
}

function interact(w) {
    const pr = w.prompt;
    if (!pr) return;
    const p = w.player;
    if (pr.kind === 'swap') {
        const i = w.pickups.findIndex((x) => x.id === pr.id);
        if (i >= 0) {
            const pk = w.pickups[i];
            w.pickups.splice(i, 1);
            takeWeapon(w, pk.weapon, true);
            emit(w, 'pickup', { kind: 'weapon', weapon: pk.weapon, x: pk.x, y: pk.y });
        }
        return;
    }
    const it = w.items[pr.id];
    if (!it || it.used) return;
    switch (it.kind) {
    case 'chest':
        it.used = true;
        spawnPickup(w, 'weapon', it.x, it.y + 0.9, { weapon: it.weapon, pop: 0.5 });
        if (w.rng.chance(0.5)) spawnPickup(w, 'ammo', it.x, it.y + 0.5);
        emit(w, 'chest', { x: it.x, y: it.y, weapon: it.weapon });
        break;
    case 'shopitem': {
        const price = shopPrice(w, it);
        if (p.salvage < price) { emit(w, 'denied', { x: it.x, y: it.y }); return; }
        p.salvage -= price;
        it.used = true;
        buy(w, it);
        emit(w, 'buy', { x: it.x, y: it.y, item: it.item, weapon: it.weapon });
        break;
    }
    case 'med':
        if (p.hp >= p.maxHp) { emit(w, 'denied', { x: it.x, y: it.y }); return; }
        it.used = true;
        p.hp = Math.min(p.maxHp, p.hp + 60);
        emit(w, 'heal', { x: it.x, y: it.y });
        break;
    case 'terminal':
        it.used = true;
        w.run.logs[`${w.sectorNum}-${it.log}`] = 1;
        emit(w, 'log', { sector: w.sectorNum, log: it.log });
        break;
    case 'elevator':
        it.used = true;
        w.phase = 'complete';
        emit(w, 'elevator', { x: it.x, y: it.y });
        break;
    case 'cocoon':
        it.used = true;
        w.phase = 'complete';
        emit(w, 'freeEllie', { x: it.x, y: it.y });
        break;
    default: break;
    }
}

function buy(w, it) {
    const p = w.player;
    switch (it.item) {
    case 'medkit': p.hp = Math.min(p.maxHp, p.hp + 40); break;
    case 'armor': p.armor = Math.min(PLAYER.armorMax, p.armor + 50); break;
    case 'ammo': addAmmo(p, 0.5); break;
    case 'grenade': p.grenades = Math.min(grenadeCap(w) + 1, p.grenades + 2); break;
    case 'pulse': p.pulses = Math.min(pulseCap(w), p.pulses + 1); break;
    case 'mod': if (!upgradeWeapon(w, p.weapons[p.cur])) { const o = p.weapons.find((x) => x.mk < 3); if (o) upgradeWeapon(w, o); } break;
    case 'stim': activatePower(w, w.rng.pick(['overdrive', 'hyperfire', 'drone', 'stim'])); break;
    case 'weapon': {
        if (!takeWeapon(w, it.weapon, false)) spawnPickup(w, 'weapon', it.x, it.y + 0.8, { weapon: it.weapon, pop: 0.5 });
        break;
    }
    default: break;
    }
}

// ------------------------------------------------------------------ Doors & rooms

function setDoor(w, door, open) {
    door.target = open ? 1 : 0;
    const lv = w.lv;
    for (let y = door.y; y < door.y + door.h; y++) for (let x = door.x; x < door.x + door.w; x++) lv.solid[y * lv.w + x] = open ? 0 : 1;
    w.flowT = 0;
    emit(w, 'door', { id: door.id, open });
}

function updateDoors(w, dt) {
    for (const d of w.lv.doors) {
        if (d.open !== d.target) d.open = d.target > d.open ? Math.min(d.target, d.open + dt * 3.5) : Math.max(d.target, d.open - dt * 5);
    }
}

function inside(room, x, y, m) {
    return x > room.x + m && y > room.y + m && x < room.x + room.w - m && y < room.y + room.h - m;
}

function updateRooms(w, dt) {
    const p = w.player;
    const lv = w.lv;
    const ri = roomAtPos(lv, p.x, p.y);
    if (ri >= 0) {
        const room = lv.rooms[ri];
        if (!room.visited) {
            room.visited = true;
            emit(w, 'visit', { room: ri, type: room.type });
            if (room.type === 'shop') radio(w, 'shop');
            if (room.type === 'med') radio(w, 'medbay');
            if (room.type === 'treasure') radio(w, 'weapon');
        }
        if (w.activeRoom < 0 && (room.type === 'combat' || room.type === 'boss') && !room.state && inside(room, p.x, p.y, 1.1) && p.alive) {
            activateRoom(w, room);
        }
    }
    if (w.activeRoom >= 0) {
        const room = lv.rooms[w.activeRoom];
        if (room.type === 'combat') runWaves(w, room, dt);
        else if (room.type === 'boss' && !w.boss && w.t >= room.bossAt) {
            const mother = lv.theme.boss === 'mother';
            spawnBossEntity(w, lv.theme.boss, room.cx, room.y + (mother ? 3.6 : 4.5));
            radio(w, `s${w.sectorNum}_boss`);
        }
    } else if (p.alive) {
        // Corridor ambushes keep the walk between rooms tense.
        if (w.cleared > 0 || w.sectorNum > 0) w.ambushT -= dt;
        if (w.ambushT <= 0) {
            w.ambushT = w.rng.range(22, 38) - w.sectorNum * 2.5;
            ambush(w);
        }
    }
}

function activateRoom(w, room) {
    room.state = 'active';
    w.activeRoom = room.id;
    for (const id of room.doors) setDoor(w, w.lv.doors[id], false);
    emit(w, 'lock', { room: room.id, boss: room.type === 'boss' });
    if (room.type === 'boss') {
        room.bossAt = w.t + 1.4;
        return;
    }
    if (w.sectorNum === 0) radio(w, 's0_firstlock');
    room.waves = buildWaves(w, room);
    room.wave = -1;
    room.queue = [];
    nextWave(w, room);
}

function buildWaves(w, room) {
    const th = w.theme, rng = w.rng;
    const area = room.w * room.h;
    let budget = th.budget * w.diff.budget * Math.pow(area / 180, 0.75) * rng.range(0.9, 1.15) * (1 + 0.06 * room.depth);
    if (w.sectorNum === 0 && w.cleared === 0) budget *= 0.55;
    const nWaves = w.sectorNum === 0 ? 2 : budget > 30 ? 3 : 2;
    const pool = { ...th.pool };
    if (room.depth >= 3 || w.cleared >= 3) Object.assign(pool, th.late);
    const shares = nWaves === 2 ? [0.42, 0.58] : [0.28, 0.34, 0.38];
    const waves = [];
    let sacs = 0;
    for (let i = 0; i < nWaves; i++) {
        let wb = budget * shares[i];
        const list = [];
        const swarm = rng.chance(i === nWaves - 1 ? 0.45 : 0.3);
        if (swarm) {
            const n = Math.floor(wb * 0.8);
            for (let k = 0; k < n; k++) list.push({ type: 'skitter', alpha: false });
            wb -= n;
            if (w.sectorNum === 0) radio(w, 's0_swarm');
        }
        let guard = 0;
        while (wb > 0.5 && guard++ < 200) {
            const type = rng.weighted(pool);
            const def = ENEMIES[type];
            if (def.cost > wb + 1.5) continue;
            if (type === 'sac' && (sacs >= 1 || i > 0)) continue;
            if (type === 'sac') sacs++;
            const alpha = type !== 'skitter' && type !== 'sac' && rng.chance(w.alphaChance);
            list.push({ type, alpha });
            wb -= def.cost * (alpha ? 2 : 1);
        }
        waves.push({ list, swarm });
    }
    return waves;
}

function nextWave(w, room) {
    room.wave++;
    const wave = room.waves[room.wave];
    room.waveStart = w.t;
    room.waveSize = wave.list.length;
    let t = w.t + 0.25;
    for (const s of wave.list) {
        room.queue.push({ ...s, at: t });
        t += s.type === 'skitter' ? 0.06 : 0.22;
    }
    emit(w, 'wave', { room: room.id, wave: room.wave, of: room.waves.length, swarm: wave.swarm });
}

function pickVent(w, vents, minD = 4.5) {
    const p = w.player;
    const far = vents.filter((v) => Math.hypot(v.x - p.x, v.y - p.y) > minD);
    return w.rng.pick(far.length ? far : vents);
}

function roomAlive(w, id) {
    let n = 0;
    for (const e of w.enemies) if (!e.dead && e.room === id) n++;
    return n;
}

function runWaves(w, room, dt) {
    // Spawn the queue.
    while (room.queue.length && room.queue[0].at <= w.t && w.enemies.length < w.cap) {
        const s = room.queue.shift();
        const v = pickVent(w, room.vents);
        spawnEnemy(w, s.type, v.x + w.rng.range(-0.25, 0.25), v.y + w.rng.range(-0.25, 0.25), { alpha: s.alpha, room: room.id, emerge: 0.75 });
    }
    if (room.queue.length) return;
    const alive = roomAlive(w, room.id);
    const last = room.wave >= room.waves.length - 1;
    if (!last && (alive <= Math.floor(room.waveSize * 0.18) || w.t - room.waveStart > 26)) nextWave(w, room);
    else if (last && alive === 0) clearRoom(w, room);
}

function clearRoom(w, room) {
    room.state = 'cleared';
    w.activeRoom = -1;
    w.cleared++;
    for (const id of room.doors) setDoor(w, w.lv.doors[id], true);
    emit(w, 'clear', { room: room.id });
    // Rewards.
    const rng = w.rng;
    const cx = room.cx, cy = room.cy;
    const coins = rng.int(4, 8);
    for (let i = 0; i < coins; i++) spawnPickup(w, 'salvage', cx, cy, { val: SALVAGE_VALUE, pop: rng.range(2, 5) });
    const r = rng.next();
    spawnPickup(w, r < 0.38 ? 'health' : r < 0.68 ? 'ammo' : r < 0.86 ? 'armor' : 'grenade', cx, cy);
    if (rng.chance(0.24 * w.diff.drops)) spawnPickup(w, 'power', cx, cy, { power: randomPower(w) });
    if (rng.chance(0.1)) spawnPickup(w, 'mod', cx, cy);
    if (rng.chance(0.07)) spawnPickup(w, 'pulse', cx, cy);
    if (rng.chance(0.08)) w.items.push({ kind: 'chest', x: cx, y: cy, weapon: pickWeapon(rng, w.sectorNum), id: w.items.length, used: false });
    // Story beats tied to progress.
    const s = w.sectorNum;
    if (s === 1 && w.cleared === 1) radio(w, 's1_ellie');
    if (s === 2 && w.cleared === 2) radio(w, 's2_taken');
    if (s === 3 && w.cleared === 1) radio(w, 's3_ellie');
    if (s === 4 && w.cleared === 3) radio(w, 's4_mid');
}

function ambush(w) {
    const p = w.player;
    const lv = w.lv;
    const cands = [];
    for (const room of lv.rooms) {
        if (room.state !== 'cleared' && room.type !== 'start') continue;
        for (const v of room.vents) {
            const d = flowAt(w, v.x, v.y);
            if (d >= 10 && d <= 26) cands.push(v);
        }
    }
    if (!cands.length) { w.ambushT = 6; return; }
    const v = w.rng.pick(cands);
    const n = 5 + w.sectorNum * 2 + w.rng.int(0, 4);
    for (let i = 0; i < n; i++) spawnEnemy(w, 'skitter', v.x + w.rng.range(-0.3, 0.3), v.y + w.rng.range(-0.3, 0.3), { emerge: 0.6 + i * 0.07 });
    if (w.sectorNum >= 1 && w.rng.chance(0.5)) spawnEnemy(w, w.rng.pick(['drone', 'spitter', 'husk']), v.x, v.y, { emerge: 1 });
    emit(w, 'ambush', { x: v.x, y: v.y });
}

// ------------------------------------------------------------------ Bosses

function bossDefeated(w) {
    w.bossDone = true;
    const b = w.boss;
    const room = w.lv.rooms[b.room >= 0 ? b.room : w.lv.bossRoom];
    emit(w, 'bossDead', { kind: b.type, x: b.x, y: b.y });
    // Everything in the arena dies with it.
    for (const e of w.enemies) if (!e.dead && !e.boss) killEnemy(w, e, { kind: 'chain' });
    w.ebullets.length = 0;
    for (const h of w.hazards) if (h.t > 100) h.t = 1;
    for (let i = 0; i < 9; i++) {
        const a = w.rng.range(0, TAU), r = w.rng.range(0, b.r * 1.6);
        w.delayed.push({ t: 0.15 + i * 0.22, fn: 'boom', x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, r: w.rng.range(1.5, 3), kind: i === 8 ? 'nova' : 'fire' });
    }
    for (let i = 0; i < 26; i++) spawnPickup(w, 'salvage', b.x, b.y, { val: SALVAGE_VALUE, pop: w.rng.range(2, 7) });
    spawnPickup(w, 'bighealth', b.x, b.y);
    spawnPickup(w, 'ammo', b.x, b.y);
    spawnPickup(w, 'armor', b.x, b.y);
    room.state = 'cleared';
    w.activeRoom = -1;
    for (const id of room.doors) setDoor(w, w.lv.doors[id], true);
    radio(w, `s${w.sectorNum}_bossdead`);
    if (b.type === 'mother') {
        w.delayed.push({ t: 2.6, fn: 'item', item: { kind: 'cocoon', x: room.cx, y: room.y + 1.6 } });
    } else {
        w.delayed.push({ t: 2.6, fn: 'item', item: { kind: 'elevator', x: room.cx, y: room.cy + 2 } });
    }
    w.delayed.push({ t: 3.2, fn: 'perk' });
}

export function perkOptions(w) {
    const p = w.player;
    const free = PERK_ORDER.filter((k) => !p.perks[k]);
    w.rng.shuffle(free);
    return free.slice(0, 3);
}

export function choosePerk(w, id) {
    const p = w.player;
    if (!PERKS[id] || p.perks[id]) return false;
    p.perks[id] = 1;
    if (id === 'plating') { p.maxHp += 25; p.hp += 25; }
    if (id === 'capacitor') p.pulses++;
    if (id === 'demolition') p.grenades++;
    w.perkOptions = null;
    w.phase = 'play';
    emit(w, 'perk', { id });
    return true;
}

// ------------------------------------------------------------------ Escape

function updateEllie(w, dt) {
    const el = w.ellie, p = w.player;
    el.ox = el.x; el.oy = el.y;
    const d = Math.hypot(p.x - el.x, p.y - el.y);
    if (d > 15) {
        // Lost her: she catches up through a side passage.
        el.x = p.x - Math.cos(p.face) * 1.2; el.y = p.y - Math.sin(p.face) * 1.2;
        collideCircle(w.lv, el);
        el.ox = el.x; el.oy = el.y;
    }
    let tx = 0, ty = 0;
    if (d > 1.8) {
        const dir = { x: 0, y: 0 };
        flowDir(w, el.x, el.y, dir);
        const sp = Math.min(7.6, 3.5 + d * 0.6);
        tx = dir.x * sp; ty = dir.y * sp;
    }
    const k = 1 - Math.exp(-10 * dt);
    el.vx += (tx - el.vx) * k; el.vy += (ty - el.vy) * k;
    moveEntity(w.lv, el, el.vx * dt, el.vy * dt);
    el.anim += Math.hypot(el.vx, el.vy) * dt;
    // She shoots.
    el.fireCd -= dt;
    let tgt = null, td = 8;
    if (el.fireCd <= 0) {
        queryHash(w, el.x, el.y, 8, (e) => {
            if (e.spawnT > 0 || e.under) return false;
            const dd = Math.hypot(e.x - el.x, e.y - el.y);
            if (dd < td) { td = dd; tgt = e; }
            return false;
        });
        if (tgt && los(w.lv, el.x, el.y, tgt.x, tgt.y)) {
            const a = Math.atan2(tgt.y - el.y, tgt.x - el.x);
            el.face = a;
            el.fireCd = 0.42;
            w.pbullets.push({ x: el.x, y: el.y, ox: el.x, oy: el.y, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24, dmg: 10, life: 0.6, r: 0.1, weapon: 'ellie', kind: 'bullet', pierce: 0, bounce: 0, knock: 0.4, homing: 0, hits: null });
            emit(w, 'shot', { weapon: 'ellie', x: el.x, y: el.y, ang: a, mk: 1 });
        } else el.fireCd = 0.15;
    }
    if (!tgt && Math.hypot(el.vx, el.vy) > 0.5) el.face = Math.atan2(el.vy, el.vx);
}

function updateEscape(w, dt) {
    const es = w.escape, p = w.player;
    if (!p.alive) return;
    es.t -= dt;
    if (!es.half && es.t < ESCAPE_TIME / 2) { es.half = true; radio(w, 'escape_half'); }
    if (!es.last && es.t < 30) { es.last = true; radio(w, 'escape_last'); }
    if (es.t <= 0) {
        es.t = 0;
        p.hp = 0; p.alive = false; w.phase = 'dead'; w.deathCause = 'detonation';
        emit(w, 'detonate', { x: p.x, y: p.y });
        emit(w, 'death', { x: p.x, y: p.y });
        return;
    }
    // Jammed bulkheads: the doors lock while Overwatch overrides them.
    const ri = roomAtPos(w.lv, p.x, p.y);
    if (ri >= 0) {
        const room = w.lv.rooms[ri];
        if (room.type === 'holdout' && !room.state && inside(room, p.x, p.y, 1.5)) {
            room.state = 'active';
            room.holdT = 12;
            room.spawnT = 0.5;
            w.activeRoom = room.id;
            for (const id of room.doors) setDoor(w, w.lv.doors[id], false);
            emit(w, 'lock', { room: room.id, holdout: true });
            radio(w, 'escape_holdout');
        }
        if (!room.visited) { room.visited = true; emit(w, 'visit', { room: ri, type: room.type }); }
    }
    if (w.activeRoom >= 0) {
        const room = w.lv.rooms[w.activeRoom];
        room.holdT -= dt;
        room.spawnT -= dt;
        if (room.spawnT <= 0 && w.enemies.length < w.cap * 0.8) {
            room.spawnT = 1.1;
            const v = pickVent(w, room.vents, 4);
            for (let i = 0; i < 5; i++) spawnEnemy(w, 'skitter', v.x + w.rng.range(-0.3, 0.3), v.y + w.rng.range(-0.3, 0.3), { emerge: 0.5 + i * 0.06, room: room.id });
            if (w.rng.chance(0.45)) { const v2 = pickVent(w, room.vents, 4); spawnEnemy(w, w.rng.pick(['drone', 'spitter', 'wasp', 'bloater', 'husk']), v2.x, v2.y, { emerge: 0.7, room: room.id, alpha: w.rng.chance(0.2) }); }
        }
        if (room.holdT <= 0) {
            room.state = 'cleared';
            w.activeRoom = -1;
            for (const id of room.doors) setDoor(w, w.lv.doors[id], true);
            emit(w, 'clear', { room: room.id, holdout: true });
        }
        return;
    }
    // Waves pour out of vents ahead of and behind the marine.
    es.spawnT -= dt;
    const prog = 1 - es.t / ESCAPE_TIME;
    if (es.spawnT <= 0 && w.enemies.length < w.cap * 0.75) {
        es.spawnT = Math.max(1.5, 3.2 - prog * 1.6);
        const cands = [];
        for (const room of w.lv.rooms) for (const v of room.vents) { const d = flowAt(w, v.x, v.y); if (d >= 8 && d <= 24) cands.push(v); }
        if (cands.length) {
            const v = w.rng.pick(cands);
            const n = 6 + Math.floor(prog * 10) + w.rng.int(0, 4);
            for (let i = 0; i < n; i++) spawnEnemy(w, 'skitter', v.x + w.rng.range(-0.3, 0.3), v.y + w.rng.range(-0.3, 0.3), { emerge: 0.5 + i * 0.05 });
            const extra = w.rng.weighted({ drone: 3, spitter: 2, wasp: 2, bloater: 1, stalker: 1, brute: prog > 0.4 ? 0.8 : 0 });
            const v2 = w.rng.pick(cands);
            spawnEnemy(w, extra, v2.x, v2.y, { emerge: 0.8, alpha: w.rng.chance(0.15) });
        }
    }
    // The pad.
    const pad = w.lv.rooms[w.lv.padRoom];
    const el = w.ellie;
    if (Math.hypot(p.x - pad.cx, p.y - pad.cy) < 3.2 && Math.hypot(el.x - pad.cx, el.y - pad.cy) < 5) {
        w.phase = 'victory';
        mergeStats(w);
        emit(w, 'victory', { t: es.t });
    }
}

// ------------------------------------------------------------------ Horde

const HORDE_POOL = [
    { wave: 1, pool: { skitter: 8, drone: 2 } },
    { wave: 3, pool: { spitter: 2 } },
    { wave: 5, pool: { bloater: 1.5, husk: 2 } },
    { wave: 7, pool: { burrower: 1.5, wasp: 2 } },
    { wave: 9, pool: { brute: 1, stalker: 1.5 } },
    { wave: 12, pool: { sac: 0.6 } },
];

function updateHorde(w, dt) {
    const h = w.horde, p = w.player;
    if (!p.alive) return;
    const room = w.lv.rooms[0];
    if (h.t > 0) {
        h.t -= dt;
        if (h.t <= 0) {
            h.wave++;
            w.hpScale = 1 + (h.wave - 1) * 0.07;
            w.alphaChance = Math.min(0.3, 0.01 * h.wave) + w.diff.alpha;
            const pool = {};
            for (const s of HORDE_POOL) if (h.wave >= s.wave) Object.assign(pool, s.pool);
            let budget = HORDE.startBudget * Math.pow(HORDE.growth, h.wave - 1) * w.diff.budget;
            let t = w.t + 0.3;
            h.queue = [];
            const swarm = h.wave % 3 === 0;
            if (swarm) { const n = Math.floor(budget * 0.6); for (let i = 0; i < n; i++) { h.queue.push({ type: 'skitter', alpha: false, at: t }); t += 0.05; } budget *= 0.4; }
            let guard = 0;
            while (budget > 0.5 && guard++ < 400) {
                const type = w.rng.weighted(pool);
                const alpha = type !== 'skitter' && type !== 'sac' && w.rng.chance(w.alphaChance);
                h.queue.push({ type, alpha, at: t });
                t += type === 'skitter' ? 0.12 : 0.45;
                budget -= ENEMIES[type].cost * (alpha ? 2 : 1);
            }
            h.queue.sort((a, b) => a.at - b.at);
            emit(w, 'hordeWave', { wave: h.wave, swarm });
        }
        return;
    }
    while (h.queue.length && h.queue[0].at <= w.t && w.enemies.length < w.cap) {
        const s = h.queue.shift();
        const v = pickVent(w, room.vents, 6);
        spawnEnemy(w, s.type, v.x + w.rng.range(-0.25, 0.25), v.y + w.rng.range(-0.25, 0.25), { alpha: s.alpha, room: 0, emerge: 0.75 });
    }
    if (!h.queue.length && w.enemies.length === 0) {
        h.t = 4;
        h.best = Math.max(h.best, h.wave);
        emit(w, 'hordeClear', { wave: h.wave });
        const rng = w.rng;
        spawnPickup(w, rng.pick(['health', 'ammo', 'armor', 'grenade']), room.cx, room.cy);
        if (h.wave % HORDE.crateEvery === 0) {
            w.items.push({ kind: 'chest', x: room.cx, y: room.cy, weapon: pickWeapon(rng, Math.min(4, Math.floor(h.wave / 3)), w.player.weapons.map((x) => x.id)), id: w.items.length, used: false });
            spawnPickup(w, 'power', room.cx, room.cy, { power: randomPower(w) });
            spawnPickup(w, 'pulse', room.cx, room.cy);
        }
        if (h.wave % 2 === 0) spawnPickup(w, 'ammo', room.cx, room.cy);
        if (h.wave % 4 === 0) spawnPickup(w, 'mod', room.cx, room.cy);
    }
}

// ------------------------------------------------------------------ Queries for the view & UI

export function objective(w) {
    if (w.mode === 'horde') return w.horde.t > 0 ? `Wave ${w.horde.wave + 1} incoming` : `Wave ${w.horde.wave} — ${w.enemies.length + w.horde.queue.length} hostiles`;
    if (w.mode === 'escape') {
        if (w.activeRoom >= 0) return `Bulkhead override — hold out ${Math.ceil(Math.max(0, w.lv.rooms[w.activeRoom].holdT))}s`;
        return 'Reach the dropship with Ellie';
    }
    if (w.activeRoom >= 0) {
        const room = w.lv.rooms[w.activeRoom];
        if (room.type === 'boss') return w.boss ? `Kill ${w.boss.type === 'mother' ? 'the Brood Mother' : 'the ' + w.boss.type}` : 'Brace';
        return `Clear the room — wave ${room.wave + 1}/${room.waves.length}`;
    }
    if (w.items.some((it) => it.kind === 'cocoon' && !it.used)) return 'Free Ellie from the cocoon';
    if (w.items.some((it) => it.kind === 'elevator' && !it.used)) return 'Take the elevator down';
    return 'Find the sector boss';
}

export { SHOP, POWERUPS, WEAPON_SECTOR };
