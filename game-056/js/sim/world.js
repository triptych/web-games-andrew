/**
 * world.js — the simulation.
 *
 * One `world` object holds a whole run: castle, party, gold, relics, the
 * current wave and everything on the field. `step(world, dt)` advances a
 * wave by a fixed timestep; actions (place, upgrade, sell, buy, collect,
 * use a powerup, fire the Keepfire, pick a relic) are plain functions that
 * validate and mutate. Everything that the view or the audio needs to
 * react to is pushed onto `world.events` and drained by the caller.
 *
 * Phases: 'prep' (between waves: build, nothing moves) → 'wave' → 'cleared'
 * (relic choice) → next 'prep'; or 'wave' → 'lost'.
 *
 * Pure: no three.js, no DOM, no Math.random. Deterministic from the seed
 * and the sequence of actions.
 */

import { makeRng, hashSeed } from './rng.js';
import {
    LANES, FIELD_END, SPAWN_X, WALL_HIT_X, TOWER_TIERS, START_GOLD,
    laneZ, cellX, wallSlotX, activeLanes, regionIndex, isBossWave, REGIONS,
    UNITS, UNIT_ORDER, UNIT_MAX_LEVEL, unitDmgMul, unitHpMul, unitRateMul, upgradeCost, SELL_REFUND,
    CASTLE, towerCost, wallMaxHp, keepfireDmg, rampartDmg, treasuryIncome, treasuryInterest, interestCap,
    ARCH, hpMul, dmgMul, bountyMul, powerMul, waveClearBonus, POWERS, POWER_ORDER, RARITIES, RELIC_SLOTS,
} from '../config.js';
import { genBestiary } from './species.js';
import { genWave } from './waves.js';
import { genRelicChoices, aggregateMods } from './relics.js';
import { BOSSES, bossSpecies, ICEWALL_SPECIES } from './bosses.js';

const OBSTACLE_KINDS = [
    ['rock', 'stump', 'stones'], ['stump', 'reeds', 'rock'], ['basalt', 'vent', 'rock'],
    ['iceblock', 'rock', 'drift'], ['grave', 'grave', 'bones'], ['spire', 'bones', 'basalt'],
];

// ------------------------------------------------------------------ Creation

export function createWorld({ seed = 1, ember = {}, wave, gold } = {}) {
    const campWave = [1, 6, 11, 16][ember.camp ?? 0];
    const startWave = wave ?? campWave;
    const campGold = [0, 700, 2200, 5200][ember.camp ?? 0];
    const w = {
        seed: seed >>> 0,
        ember: { ...ember },
        wave: startWave,
        best: startWave - 1,
        attempt: 0,
        phase: 'prep',
        time: 0,
        waveT: 0,
        gold: gold ?? Math.round(START_GOLD * (1 + 0.2 * (ember.warmth ?? 0)) + campGold),
        goldFrac: 0,
        castle: {
            walls: 1, bailey: 3, forge: 0, treasury: 0, keepfire: 0, ramparts: 0,
            towers: [0, 0, 1, 0, 0],
        },
        wallHp: 0, wallMax: 0,
        units: [], enemies: [], projectiles: [], orbs: [], zones: [],
        cards: {},
        powers: [],
        powerCap: 3 + (ember.pockets ?? 0),
        kf: 0,
        relics: [],
        mods: null,
        relicOffer: null,
        waveDef: null,
        spawnIdx: 0,
        buffs: { rally: 0, rallyMul: 1, midas: 0, midasMul: 2, warcry: 0 },
        events: [],
        nextId: 1,
        obstacles: [],
        regionIdx: -1,
        moteT: 6,
        rng: makeRng(seed),
        stats: { kills: 0, gold: 0, waves: 0, bosses: 0, placed: 0, powers: 0, keepfires: 0 },
        waveStats: null,
        lastClear: null,
        phoenixUsed: false,
        seen: {},           // species ids met (bestiary)
        graves: [],         // recent death spots (for the lich)
        flags: {},
    };
    for (const k of UNIT_ORDER) w.cards[k] = 0;
    // Masonry: extra towers in from the centre.
    const order = [1, 3, 0, 4];
    for (let i = 0; i < (ember.masonry ?? 0); i++) w.castle.towers[order[i]] = 1;
    w.bestiary = genBestiary(w.seed);
    w.speciesById = {};
    for (const byArch of w.bestiary) for (const k in byArch) w.speciesById[byArch[k].id] = byArch[k];
    for (const k in BOSSES) { const s = bossSpecies(k); w.speciesById[s.id] = s; }
    w.speciesById[ICEWALL_SPECIES.id] = ICEWALL_SPECIES;
    refreshMods(w);
    // The keep starts with one archer on the centre tower.
    const u = makeUnit(w, 'archer', { kind: 'wall', lane: 2, tier: 0 });
    u.invested = UNITS.archer.cost;
    w.units.push(u);
    beginPrep(w);
    return w;
}

export function refreshMods(w) {
    w.mods = aggregateMods(w.relics, w.ember);
    w.flags.shatter = w.units.some((u) => u.type === 'frost' && u.level >= 10);
    const max = Math.round(wallMaxHp(w.castle.walls) * (1 + w.mods.wallhp));
    if (w.wallMax) w.wallHp = Math.min(max, w.wallHp + Math.max(0, max - w.wallMax));
    w.wallMax = max;
    for (const u of w.units) {
        const m = unitMaxHp(w, u);
        if (u.maxHp && m !== u.maxHp) u.hp = Math.min(m, u.hp + Math.max(0, m - u.maxHp));
        u.maxHp = m;
    }
}

const ev = (w, type, data = {}) => { data.type = type; w.events.push(data); return data; };

/** Pay for something (and remember it, so a retry can refund the wave's gross income). */
function spend(w, c) {
    w.gold -= c;
    if (w.phase === 'wave' && w.waveStats) w.waveStats.spent += c;
}

/** Gold earned so far this wave, before spending. */
export const waveIncome = (w) => (w.waveStats ? w.gold - w.waveStats.goldStart + w.waveStats.spent : 0);
export const drainEvents = (w) => { const e = w.events; w.events = []; return e; };

// ------------------------------------------------------------------ Phase flow

export function beginPrep(w) {
    w.phase = 'prep';
    const ri = regionIndex(w.wave);
    if (ri !== w.regionIdx) {
        w.regionIdx = ri;
        w.obstacles = genObstacles(w, ri);
        ev(w, 'region', { regionIdx: ri });
    }
    w.waveDef = genWave(w.seed, w.wave, { treasureSense: w.mods.uniques.has('treasure') });
    refreshMods(w);
    w.wallHp = w.wallMax;
    w.enemies.length = 0; w.projectiles.length = 0; w.orbs.length = 0; w.zones.length = 0;
    for (const k in w.cards) w.cards[k] = 0;
    for (const u of w.units) { u.hp = u.maxHp; u.stunT = 0; u.shield = 0; u.cd = 0.3; u.cd2 = 1; }
    w.buffs.rally = 0; w.buffs.midas = 0; w.buffs.warcry = 0;
    w.relicOffer = null;
    w.phoenixUsed = false;
    ev(w, 'prep', { wave: w.wave });
}

export function startWave(w) {
    if (w.phase !== 'prep') return false;
    w.phase = 'wave';
    w.waveT = 0;
    w.spawnIdx = 0;
    w.moteT = 7;
    w.rng = makeRng(hashSeed(w.seed, w.wave, w.attempt + 1));
    w.waveStats = { kills: 0, gold: 0, goldStart: w.gold, spent: 0, wallDmg: 0, leaked: 0, hordeAnnounced: false };
    for (const u of w.units) u.fresh = false;
    if (w.mods.uniques.has('warhorn')) { w.buffs.rally = 8; w.buffs.rallyMul = 1.6; }
    for (const a of w.waveDef.archs) {
        const sp = a === 'boss' ? `boss:${w.waveDef.boss}` : w.bestiary[w.regionIdx][a]?.id;
        if (sp) w.seen[sp] = (w.seen[sp] ?? 0);
    }
    ev(w, 'waveStart', { wave: w.wave, boss: w.waveDef.boss });
    return true;
}

function clearWave(w) {
    w.phase = 'cleared';
    const goldMul = 1 + w.mods.gold * 0.5;
    const bonus = Math.round(waveClearBonus(w.wave) * goldMul);
    const ledger = w.mods.uniques.has('ledger') ? 2 : 1;
    const interest = Math.round(Math.min(w.gold * treasuryInterest(w.castle.treasury) * ledger, interestCap(w.wave) * ledger));
    w.gold += bonus + interest;
    w.stats.waves++;
    if (w.waveDef.boss) w.stats.bosses++;
    w.best = Math.max(w.best, w.wave);
    w.lastClear = {
        wave: w.wave, bonus, interest, kills: w.waveStats.kills, gold: w.waveStats.gold,
        wallLeft: w.wallHp / w.wallMax, boss: w.waveDef.boss, region: w.regionIdx,
    };
    const unlocked = unlockedUnits(w);
    w.relicOffer = genRelicChoices(w.seed ^ (w.attempt * 7919), w.wave, unlocked, 3 + (w.ember.lore ?? 0), !!w.waveDef.boss);
    ev(w, 'waveClear', { ...w.lastClear });
}

/**
 * Pick a relic (or null to skip for gold) and move to the next wave's prep.
 * With all RELIC_SLOTS full, `replace` is the index of the relic to give up.
 */
export function chooseRelic(w, relic, replace = -1) {
    if (w.phase !== 'cleared') return false;
    if (relic) {
        if (w.relics.length >= RELIC_SLOTS) {
            if (!(replace >= 0 && replace < w.relics.length)) return false;
            const old = w.relics.splice(replace, 1)[0];
            ev(w, 'relicDrop', { relic: old });
        }
        w.relics.push(relic);
        ev(w, 'relic', { relic });
    } else {
        const g = Math.round(40 + 12 * w.wave);
        w.gold += g;
        ev(w, 'relicSkip', { gold: g });
    }
    w.wave++;
    w.attempt = 0;
    refreshMods(w);
    beginPrep(w);
    return true;
}

function lose(w) {
    if (w.phase !== 'wave') return;
    w.phase = 'lost';
    ev(w, 'lost', { wave: w.wave, earned: waveIncome(w) });
}

// ------------------------------------------------------------------ Obstacles

function genObstacles(w, ri) {
    const rng = makeRng(hashSeed(w.seed, ri, 0x0b57));
    const n = ri === 0 ? rng.int(0, 1) : rng.int(1, 3);
    const lanes = rng.shuffle([0, 1, 3, 4, 2]);
    const out = [];
    for (let i = 0; i < n; i++) {
        const lane = lanes[i];
        const col = rng.int(2, 5);
        if (w.units.some((u) => u.kind === 'field' && u.lane === lane && u.col === col)) continue;
        out.push({ lane, col, kind: rng.pick(OBSTACLE_KINDS[ri]), rot: rng.range(0, 6.28) });
    }
    return out;
}

// ------------------------------------------------------------------ Party

export const unlockedUnits = (w) => UNIT_ORDER.filter((k) => UNITS[k].unlock <= Math.max(w.wave, 1));

export function cardCost(w, type) {
    return Math.round(UNITS[type].cost * (1 - w.mods.cost));
}

function makeUnit(w, type, slot) {
    const lv = 1 + (w.ember.veterans ?? 0);
    const u = {
        id: w.nextId++, type, lane: slot.lane, kind: slot.kind,
        col: slot.kind === 'field' ? slot.col : -1,
        tier: slot.kind === 'wall' ? slot.tier : -1,
        x: slot.kind === 'field' ? cellX(slot.col) : wallSlotX(slot.tier),
        z: laneZ(slot.lane),
        level: Math.min(UNIT_MAX_LEVEL, lv), hp: 0, maxHp: 0,
        cd: 0.4, cd2: 1.5, invested: 0, stunT: 0, shield: 0, hitT: 0, fresh: true,
        atkT: 0, kills: 0, dmgDone: 0,
    };
    u.maxHp = unitMaxHp(w, u);
    u.hp = u.maxHp;
    return u;
}

function unitMaxHp(w, u) {
    const d = UNITS[u.type];
    let hp = d.hp * unitHpMul(u.level) * (1 + w.mods.unithp);
    if (u.type === 'palisade' && u.level >= 6) hp *= 1.5;
    if (u.type === 'knight' && u.level >= 10) hp *= 1.25;
    return Math.round(hp);
}

export const slotKey = (s) => s.kind === 'wall' ? `w:${s.lane}:${s.tier}` : `f:${s.lane}:${s.col}`;

export function unitAt(w, slot) {
    return w.units.find((u) => u.lane === slot.lane && u.kind === slot.kind && (slot.kind === 'wall' ? u.tier === slot.tier : u.col === slot.col)) ?? null;
}

export function isObstacle(w, lane, col) {
    return w.obstacles.some((o) => o.lane === lane && o.col === col);
}

/** Why a card can't go in a slot, or null if it can. */
export function canPlace(w, type, slot) {
    const d = UNITS[type];
    if (!d) return 'unknown';
    if (w.phase !== 'prep' && w.phase !== 'wave') return 'not now';
    if (d.unlock > w.wave) return 'locked';
    if (w.phase === 'wave' && w.cards[type] > 0) return 'recharging';
    if (w.gold < cardCost(w, type)) return 'gold';
    if (slot.lane < 0 || slot.lane >= LANES) return 'bad slot';
    if (slot.kind === 'wall') {
        if (d.place === 'field') return 'field only';
        if (!(slot.tier >= 0 && slot.tier < w.castle.towers[slot.lane])) return 'no tower';
    } else {
        if (!(slot.col >= 0 && slot.col < w.castle.bailey)) return 'beyond the bailey';
        if (isObstacle(w, slot.lane, slot.col)) return 'blocked';
    }
    if (unitAt(w, slot)) return 'occupied';
    return null;
}

/** Every slot where the card could go right now (for highlighting). */
export function validSlots(w, type) {
    const out = [];
    for (let lane = 0; lane < LANES; lane++) {
        for (let t = 0; t < TOWER_TIERS; t++) { const s = { kind: 'wall', lane, tier: t }; if (!canPlaceIgnoringGold(w, type, s)) out.push(s); }
        for (let c = 0; c < w.castle.bailey; c++) { const s = { kind: 'field', lane, col: c }; if (!canPlaceIgnoringGold(w, type, s)) out.push(s); }
    }
    return out;
}
function canPlaceIgnoringGold(w, type, slot) {
    const g = w.gold; w.gold = 1e15;
    const r = canPlace(w, type, slot);
    w.gold = g;
    return r === 'recharging' ? null : r;
}

export function placeUnit(w, type, slot) {
    const why = canPlace(w, type, slot);
    if (why) return why;
    const cost = cardCost(w, type);
    spend(w, cost);
    const u = makeUnit(w, type, slot);
    u.invested = cost;
    w.units.push(u);
    if (w.phase === 'wave') w.cards[type] = UNITS[type].recharge * (1 - w.mods.recharge);
    w.stats.placed++;
    refreshMods(w);
    ev(w, 'place', { id: u.id, unit: type, lane: u.lane, x: u.x, kind: u.kind });
    return null;
}

export function unitUpgradeCost(w, u) {
    if (u.level >= UNIT_MAX_LEVEL) return Infinity;
    return Math.round(upgradeCost(UNITS[u.type], u.level) * (1 - w.mods.cost));
}

export function upgradeUnit(w, id) {
    const u = w.units.find((v) => v.id === id);
    if (!u || (w.phase !== 'prep' && w.phase !== 'wave')) return 'not now';
    const c = unitUpgradeCost(w, u);
    if (!isFinite(c)) return 'max level';
    if (w.gold < c) return 'gold';
    spend(w, c);
    u.invested += c;
    u.level++;
    const frac = u.hp / u.maxHp;
    refreshMods(w);
    u.maxHp = unitMaxHp(w, u);
    u.hp = Math.max(u.hp, Math.round(u.maxHp * frac));
    ev(w, 'upgrade', { id: u.id, unit: u.type, level: u.level, perk: [3, 6, 10].includes(u.level) });
    return null;
}

export function sellValue(w, u) {
    return Math.floor(u.invested * (u.fresh && w.phase === 'prep' ? 1 : SELL_REFUND));
}

export function sellUnit(w, id) {
    const i = w.units.findIndex((v) => v.id === id);
    if (i < 0 || (w.phase !== 'prep' && w.phase !== 'wave')) return 'not now';
    const u = w.units[i];
    const g = sellValue(w, u);
    w.gold += g;
    w.units.splice(i, 1);
    refreshMods(w);
    ev(w, 'sell', { id: u.id, unit: u.type, gold: g, lane: u.lane, x: u.x });
    return null;
}

// ------------------------------------------------------------------ Castle

export function castleCost(w, key) {
    const def = CASTLE[key];
    const lv = w.castle[key];
    if (lv >= def.max) return Infinity;
    return def.cost(lv + (key === 'walls' || key === 'bailey' ? 1 : 0));
}

export function buyCastle(w, key) {
    if (w.phase !== 'prep' && w.phase !== 'wave') return 'not now';
    const c = castleCost(w, key);
    if (!isFinite(c)) return 'max';
    if (w.gold < c) return 'gold';
    spend(w, c);
    w.castle[key]++;
    const before = w.wallMax;
    refreshMods(w);
    if (key === 'walls' && w.phase === 'wave') w.wallHp = Math.min(w.wallMax, w.wallHp + (w.wallMax - before));
    ev(w, 'castle', { key, level: w.castle[key] });
    return null;
}

export function towerCostFor(w, lane) {
    const t = w.castle.towers[lane];
    if (t >= TOWER_TIERS) return Infinity;
    const built = w.castle.towers.reduce((a, b) => a + b, 0);
    return towerCost(t + 1, built);
}

export function buyTower(w, lane) {
    if (w.phase !== 'prep' && w.phase !== 'wave') return 'not now';
    const c = towerCostFor(w, lane);
    if (!isFinite(c)) return 'max';
    if (w.gold < c) return 'gold';
    spend(w, c);
    w.castle.towers[lane]++;
    ev(w, 'castle', { key: 'tower', lane, level: w.castle.towers[lane] });
    return null;
}

// ------------------------------------------------------------------ Stats helpers

function critRoll(w, u) {
    let c = 0.05 + w.mods.crit;
    if (u && u.type === 'archer' && u.level >= 10) c += 0.25;
    return w.rng.chance(c) ? 2 + w.mods.critdmg : 1;
}

export function unitDamage(w, u) {
    const d = UNITS[u.type];
    const type = d.atk?.type ?? 'phys';
    return (d.atk?.dmg ?? d.root?.dmg ?? 0) * unitDmgMul(u.level) * (1 + 0.12 * w.castle.forge)
        * (1 + w.mods.dmg + w.mods.unit[u.type] + w.mods.elem[type]);
}

export function unitCooldown(w, u) {
    const d = UNITS[u.type];
    let cd = d.atk.cd;
    if (u.type === 'ballista' && u.level >= 3) cd *= 0.75;
    const rate = unitRateMul(u.level) * (1 + w.mods.rate) * (w.buffs.rally > 0 ? w.buffs.rallyMul : 1);
    return cd / rate;
}

/** A summary for the unit panel. */
export function unitSummary(w, u) {
    const d = UNITS[u.type];
    const out = { hp: Math.round(u.hp), maxHp: u.maxHp, level: u.level };
    if (d.atk) { out.dmg = Math.round(unitDamage(w, u)); out.cd = +unitCooldown(w, u).toFixed(2); out.dps = Math.round(out.dmg / out.cd); }
    if (d.gen) out.brew = Math.round(brewGold(w, u));
    if (d.heal) out.heal = Math.round(d.heal.amt * unitDmgMul(u.level) * (u.level >= 3 ? 1.4 : 1));
    if (d.root) out.dmg = Math.round(unitDamage(w, u));
    return out;
}

const brewGold = (w, u) => UNITS.alchemist.gen.gold * (1 + 0.1 * (u.level - 1)) * (u.level >= 3 ? 1.3 : 1) * (u.level >= 10 ? 1.6 : 1) * (1 + w.mods.gold * 0.5);

// ------------------------------------------------------------------ Enemies

export function speciesOf(w, e) { return w.speciesById[e.species]; }

export function spawnEnemy(w, arch, lane, opts = {}) {
    const ri = opts.regionIdx ?? w.regionIdx;
    let sp;
    if (arch === 'boss') sp = w.speciesById[`boss:${opts.boss}`];
    else if (arch === 'icewall') sp = w.speciesById['boss:icewall'];
    else sp = w.bestiary[ri][arch];
    const A = ARCH[arch];
    const wave = w.wave;
    const rng = w.rng;
    let hp = A.hp * hpMul(wave) * (opts.hpMul ?? 1);
    let size = A.size * (opts.sizeMul ?? 1) * (arch === 'boss' ? 1 : rng.range(0.94, 1.06));
    let speed = A.speed * rng.range(0.94, 1.06);
    let dmg = A.dmg * dmgMul(wave);
    if (arch === 'boss') {
        const B = BOSSES[opts.boss];
        hp = B.hp * hpMul(wave);
        speed = B.speed; size = B.size; dmg = B.dmg * dmgMul(wave);
    }
    const elite = opts.elite ?? null;
    let bountyM = 1;
    if (elite) {
        hp *= 1.9; bountyM = 2.5;
        if (elite.includes('giant')) { hp *= 1.8; size *= 1.25; dmg *= 1.5; speed *= 0.85; }
        if (elite.includes('swift')) speed *= 1.5;
    }
    const e = {
        id: w.nextId++, arch, species: sp.id, boss: opts.boss ?? null,
        lane, z: laneZ(lane), x: opts.x ?? SPAWN_X, y: A.fly ? 1.25 : 0,
        hp, maxHp: hp, speed, dmg, atkCd: A.cd, cd: rng.range(0.2, 0.8), size, r: 0.28 * size,
        elite, bountyM, shield: A.shield ? hp * A.shield : 0, shieldMax: A.shield ? hp * A.shield : 0,
        ward: 0, freezeImm: 0, lastHit: 99, state: 'walk', slow: 0, slowT: 0, frozenT: 0, rootT: 0, stunT: 0, burnT: 0, burnDps: 0,
        hitT: 0, fly: !!A.fly, burrowed: arch === 'burrower' && (opts.x ?? SPAWN_X) > 2.6, leapt: false, leapT: 0,
        dir: -1, child: !!opts.child, marked: false, dead: false, invuln: 0, t: 0,
        seed: Math.floor(rng.next() * 1e6), healT: 2 + rng.range(0, 2), atkAnim: 0, target: null,
    };
    if (arch === 'boss') BOSSES[opts.boss].init?.(w, e);
    w.enemies.push(e);
    w.seen[sp.id] = (w.seen[sp.id] ?? 0) + 1;
    ev(w, 'spawn', { id: e.id, arch, species: sp.id, lane, boss: e.boss, elite });
    return e;
}

function resistMul(w, e, type) {
    const sp = speciesOf(w, e);
    let m = sp.resist?.[type] ?? 1;
    if (e.elite) {
        if (e.elite.includes('armored') && type === 'phys') m *= 0.6;
        if (e.elite.includes('warded') && type !== 'phys') m *= 0.6;
    }
    return m;
}

/**
 * Damage a monster. opts: { src (unit), type, crit, front (projectile from the
 * front: shields soak it), explosive (reaches burrowers), noMark }
 */
export function damageEnemy(w, e, amt, opts = {}) {
    if (e.dead || amt <= 0) return 0;
    if (e.burrowed && !opts.explosive) return 0;
    if (e.invuln > 0) { ev(w, 'immune', { id: e.id }); return 0; }
    const type = opts.type ?? 'phys';
    let a = amt * resistMul(w, e, type) * (opts.crit ?? 1);
    if (w.mods.uniques.has('winter') && e.slowT > 0) a *= 1.25;
    if (w.flags.shatter && e.frozenT > 0) a *= 2;
    if (!e.marked && !opts.noMark) { e.marked = true; if (w.mods.uniques.has('huntmark')) a *= 2; }
    if (e.ward > 0) {
        const s = Math.min(e.ward, a);
        e.ward -= s; a -= s;
        if (e.ward <= 0) ev(w, 'shieldBreak', { id: e.id });
    }
    if (e.shield > 0 && opts.front) {
        const s = Math.min(e.shield, a);
        e.shield -= s; a -= s;
        if (e.shield <= 0) ev(w, 'shieldBreak', { id: e.id });
        else ev(w, 'shieldHit', { id: e.id });
    }
    e.hp -= a;
    e.hitT = 0.12;
    e.lastHit = 0;
    if (opts.src) opts.src.dmgDone += a;
    if (!opts.quiet) ev(w, 'hit', { id: e.id, amt: Math.round(a), crit: (opts.crit ?? 1) > 1, dtype: type, x: e.x, y: e.y, z: e.z });
    if (e.hp <= 0) killEnemy(w, e, opts.src);
    return a;
}

function killEnemy(w, e, src) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const A = ARCH[e.arch];
    const goldMul = (1 + w.mods.gold) * (1 + 0.08 * w.castle.treasury) * (w.buffs.midas > 0 ? w.buffs.midasMul : 1);
    const gold = Math.max(1, Math.round(A.bounty * bountyMul(w.wave) * e.bountyM * goldMul * (e.child ? 0.4 : 1)));
    w.gold += gold;
    w.stats.kills++; w.stats.gold += gold;
    if (w.waveStats) { w.waveStats.kills++; w.waveStats.gold += gold; }
    if (src) src.kills++;
    if (w.castle.keepfire > 0) w.kf = Math.min(100, w.kf + (e.boss ? 30 : 1.6) * (1 + w.mods.keepfire));
    ev(w, 'kill', { id: e.id, gold, x: e.x, y: e.y, z: e.z, arch: e.arch, boss: e.boss, species: e.species });
    w.graves.push({ x: e.x, lane: e.lane });
    if (w.graves.length > 12) w.graves.shift();
    // Drops
    const dropP = e.arch === 'treasure' || e.boss ? 1 : 0.035 * (1 + w.mods.drop) * (e.elite ? 4 : 1) * (e.child ? 0.3 : 1);
    if (w.rng.chance(dropP)) spawnPowerOrb(w, e.x, e.z, e.boss ? 2 : e.arch === 'treasure' ? 1 : 0);
    if (e.arch === 'treasure') spawnPowerOrb(w, e.x + 0.4, e.z, 0);
    if (e.arch === 'splitter' && !e.child) {
        for (const dx of [-0.3, 0.3]) spawnEnemy(w, 'splitter', e.lane, { x: Math.max(0.6, e.x + dx), child: true, hpMul: 0.4, sizeMul: 0.62 });
    }
    if (e.elite?.includes('explosive')) explodeAt(w, e.x, e.lane, 1.1, 30 * dmgMul(w.wave), 'enemyBlast');
    if (e.boss) {
        BOSSES[e.boss].onDeath?.(w, e);
        ev(w, 'bossDown', { id: e.id, boss: e.boss });
    }
}

/** A monster's own blast (sapper, explosive affix): hurts field units nearby. */
function explodeAt(w, x, lane, r, dmg, kind) {
    ev(w, 'explode', { x, z: laneZ(lane), r, kind, y: 0.3 });
    for (const u of w.units) {
        if (u.kind !== 'field') continue;
        if (Math.hypot(u.x - x, u.z - laneZ(lane)) <= r) damageUnit(w, u, dmg, null);
    }
}

export function damageUnit(w, u, dmg, src) {
    if (u.hp <= 0) return;
    let d = dmg;
    if (u.type === 'knight' && u.level >= 3) d *= 0.75;
    if (u.kind === 'field' && w.units.some((k) => k.type === 'knight' && k.level >= 10 && k !== u && Math.abs(k.lane - u.lane) <= 1 && Math.abs(k.x - u.x) <= 1.1)) d *= 0.8;
    if (u.shield > 0) { const s = Math.min(u.shield, d); u.shield -= s; d -= s; }
    u.hp -= d;
    u.hitT = 0.12;
    ev(w, 'unitHit', { id: u.id, amt: Math.round(d) });
    if (src && !src.dead) {
        const def = UNITS[u.type];
        if (def.block && w.mods.uniques.has('bulwark')) damageEnemy(w, src, dmg * 0.3, { type: 'phys', noMark: true });
        if (u.type === 'palisade' && u.level >= 3) {
            damageEnemy(w, src, (u.level >= 10 ? 18 : 6) * powerMul(w.wave) * 0.6, { type: 'phys', noMark: true });
            if (u.level >= 10) { src.slow = Math.max(src.slow, 0.4); src.slowT = Math.max(src.slowT, 1.5); }
        }
        if (src.elite?.includes('vampiric')) src.hp = Math.min(src.maxHp, src.hp + dmg * 0.5);
    }
    if (u.hp <= 0) {
        const i = w.units.indexOf(u);
        if (i >= 0) w.units.splice(i, 1);
        refreshMods(w);
        ev(w, 'unitDie', { id: u.id, unit: u.type, lane: u.lane, x: u.x });
    }
}

export function damageWall(w, dmg, src) {
    if (w.phase !== 'wave' || w.god) return;
    w.wallHp -= dmg;
    if (w.waveStats) w.waveStats.wallDmg += dmg;
    ev(w, 'wallHit', { dmg: Math.round(dmg), lane: src?.lane ?? 2 });
    if (src && !src.dead && w.castle.ramparts > 0 && src.x < 1.2) {
        damageEnemy(w, src, rampartDmg(w.castle.ramparts) * Math.pow(powerMul(w.wave), 0.85), { type: 'phys', noMark: true });
    }
    if (w.wallHp <= 0) {
        if (w.mods.uniques.has('phoenix') && !w.phoenixUsed) {
            w.phoenixUsed = true;
            w.wallHp = w.wallMax * 0.3;
            ev(w, 'phoenix', {});
        } else {
            w.wallHp = 0;
            lose(w);
        }
    }
}

const isTargetable = (e) => !e.dead && !e.burrowed && e.x < FIELD_END && e.leapT <= 0;

/** First monster in a lane in front of x (closest to the wall), optionally ground only. */
function firstInLane(w, lane, x, air, opts = {}) {
    let best = null;
    for (const e of w.enemies) {
        if (e.lane !== lane || e.dead || e.x < x - 0.25 || e.x >= FIELD_END) continue;
        if (e.burrowed && !opts.burrowed) continue;
        if (e.leapT > 0) continue;
        if (e.fly && !air) continue;
        if (opts.maxX !== undefined && e.x > opts.maxX) continue;
        if (!best || e.x < best.x) best = e;
    }
    return best;
}

// ------------------------------------------------------------------ Pickups

function rollRarity(w) {
    const luck = Math.min(1, w.wave / 50);
    const r = w.rng.next() * 100;
    if (r < 1 + 4 * luck) return 3;
    if (r < 6 + 12 * luck) return 2;
    if (r < 26 + 16 * luck) return 1;
    return 0;
}

export function spawnPowerOrb(w, x, z, minRarity) {
    const o = {
        id: w.nextId++, kind: 'power', x: Math.min(9.2, Math.max(0.6, x)), z, y: 0.6, t: 0, life: 11,
        power: w.rng.pick(POWER_ORDER), rarity: Math.max(minRarity, rollRarity(w)),
    };
    w.orbs.push(o);
    ev(w, 'orb', { id: o.id, power: o.power, rarity: o.rarity });
}

export function spawnMote(w) {
    const lanes = activeLanes(w.wave);
    const lane = w.rng.pick(lanes);
    const o = {
        id: w.nextId++, kind: 'mote', x: w.rng.range(1, 8.5), z: laneZ(lane) + w.rng.range(-0.3, 0.3), y: 5, t: 0, life: 10,
        gold: Math.round((8 + w.wave * 2.4) * (1 + w.mods.gold)),
    };
    w.orbs.push(o);
    ev(w, 'mote', { id: o.id });
}

export function collectOrb(w, id) {
    const i = w.orbs.findIndex((o) => o.id === id);
    if (i < 0) return false;
    const o = w.orbs[i];
    w.orbs.splice(i, 1);
    if (o.kind === 'mote') {
        w.gold += o.gold;
        ev(w, 'collect', { id, kind: 'mote', gold: o.gold, x: o.x, y: o.y, z: o.z });
    } else if (w.powers.length < w.powerCap) {
        w.powers.push({ power: o.power, rarity: o.rarity });
        ev(w, 'collect', { id, kind: 'power', power: o.power, rarity: o.rarity, x: o.x, y: o.y, z: o.z });
    } else {
        const g = Math.round((20 + w.wave * 4) * RARITIES[o.rarity].mul);
        w.gold += g;
        ev(w, 'collect', { id, kind: 'power', power: o.power, rarity: o.rarity, gold: g, x: o.x, y: o.y, z: o.z, sold: true });
    }
    return true;
}

// ------------------------------------------------------------------ Powerups & Keepfire

/** target: { x, lane } for 'spot' / 'lane' powers. */
export function usePower(w, idx, target) {
    if (w.phase !== 'wave') return 'not now';
    const p = w.powers[idx];
    if (!p) return 'empty';
    const def = POWERS[p.power];
    if (def.target !== 'none' && !target) return 'target';
    const r = RARITIES[p.rarity].mul;
    const pm = powerMul(w.wave) * r;
    w.powers.splice(idx, 1);
    w.stats.powers++;
    switch (p.power) {
        case 'meteor': w.zones.push({ kind: 'meteor', x: target.x, lane: target.lane, z: laneZ(target.lane), t: 0, dur: 0.75, dmg: 200 * pm, r: 1.5 + 0.2 * p.rarity }); break;
        case 'nova':
            for (const e of w.enemies) if (!e.dead && e.x < FIELD_END) { e.frozenT = Math.max(e.frozenT, (e.boss ? 1.2 : 3) * Math.sqrt(r)); damageEnemy(w, e, 12 * pm, { type: 'frost', noMark: true }); }
            break;
        case 'storm': w.zones.push({ kind: 'storm', t: 0, dur: 99, next: 0, left: Math.round(8 * r), dmg: 95 * powerMul(w.wave) * Math.sqrt(r) }); break;
        case 'rally': w.buffs.rally = 9 * Math.sqrt(r); w.buffs.rallyMul = 1 + 0.6 * Math.sqrt(r); break;
        case 'mend':
            w.wallHp = Math.min(w.wallMax, w.wallHp + w.wallMax * 0.35 * r);
            for (const u of w.units) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5 * r);
            break;
        case 'midas': w.buffs.midas = 12 * Math.sqrt(r); w.buffs.midasMul = 2 + 0.5 * p.rarity; break;
        case 'arrows': w.zones.push({ kind: 'arrows', lane: target.lane, z: laneZ(target.lane), t: 0, dur: 4, dps: 60 * pm }); break;
        case 'quake':
            for (const e of w.enemies) if (!e.dead && !e.fly && e.x < FIELD_END) { e.stunT = Math.max(e.stunT, 2 * Math.sqrt(r)); damageEnemy(w, e, 65 * pm, { type: 'phys', explosive: true, noMark: true }); }
            break;
    }
    ev(w, 'power', { power: p.power, rarity: p.rarity, target });
    return null;
}

export function fireKeepfire(w, lane) {
    if (w.phase !== 'wave' || w.castle.keepfire <= 0 || w.kf < 100) return 'not ready';
    w.kf = 0;
    w.stats.keepfires++;
    w.zones.push({ kind: 'keepfire', lane, z: laneZ(lane), t: 0, dur: 1.1, hit: new Set(), dmg: keepfireDmg(w.castle.keepfire) * powerMul(w.wave) });
    ev(w, 'keepfire', { lane });
    return null;
}

// ------------------------------------------------------------------ Projectiles

function shoot(w, u, kind, opts = {}) {
    const p = {
        id: w.nextId++, kind, from: 'unit', src: u, lane: u.lane, x: u.x + 0.2, z: u.z,
        y: u.kind === 'wall' ? 1.4 + 0.5 * u.tier : 0.55, ty: opts.ty ?? 0.5,
        speed: opts.speed ?? 12, dmg: opts.dmg, type: opts.type ?? 'phys', air: opts.air ?? true,
        pierce: opts.pierce ?? 0, hit: [], crit: opts.crit ?? 1, splash: opts.splash ?? 0, t: 0,
        lob: !!opts.lob, x0: u.x, x1: opts.x1 ?? 0, T: opts.T ?? 1, y0: 0, extra: opts.extra ?? null,
    };
    p.y0 = p.y;
    w.projectiles.push(p);
    ev(w, 'shoot', { unit: u.type, id: u.id, pid: p.id, lane: u.lane, kind });
    return p;
}

function enemyShoot(w, e, kind, target, dmg) {
    const lob = kind !== 'arrow' && kind !== 'hex';
    const tx = target === 'wall' ? 0 : target.x;
    const p = {
        id: w.nextId++, kind, from: 'enemy', srcE: e, lane: e.lane, x: e.x - 0.2, z: e.z, y: e.fly ? 1.3 : 0.6, ty: 0.5,
        speed: kind === 'arrow' ? 9 : 7, dmg, t: 0, lob, x0: e.x, x1: tx, T: lob ? 0.9 + Math.abs(e.x - tx) * 0.09 : 1,
        targetId: target === 'wall' ? 'wall' : target.id, y0: 0, hit: [],
        z0: e.z, z1: target === 'wall' ? e.z : target.z,
    };
    p.y0 = p.y;
    w.projectiles.push(p);
    ev(w, 'eshoot', { kind, id: e.id, pid: p.id, lane: e.lane });
    return p;
}

function splashDamage(w, x, z, r, dmg, type, src, opts = {}) {
    const rr = r * (1 + w.mods.splash);
    ev(w, 'explode', { x, z, r: rr, kind: opts.fx ?? type, y: opts.y ?? 0.3 });
    for (const e of w.enemies) {
        if (e.dead || e === opts.skip) continue;
        if (e.fly && !opts.air) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d > rr + e.r) continue;
        damageEnemy(w, e, dmg, { src, type, explosive: true, noMark: opts.noMark });
        if (opts.knock && !e.boss) e.x = Math.min(SPAWN_X, e.x + opts.knock);
        if (opts.burn) applyBurn(e, opts.burn);
    }
}

const applyBurn = (e, dps) => { e.burnDps = Math.max(e.burnDps, dps); e.burnT = 3; };

function stepProjectiles(w, dt) {
    const keep = [];
    for (const p of w.projectiles) {
        p.t += dt;
        let alive = true;
        if (p.from === 'unit') {
            if (p.lob) {
                const k = Math.min(1, p.t / p.T);
                p.x = p.x0 + (p.x1 - p.x0) * k;
                p.y = p.y0 * (1 - k) + 0.2 * k + Math.sin(Math.PI * k) * (1.6 + 0.08 * Math.abs(p.x1 - p.x0));
                if (k >= 1) {
                    const u = p.src;
                    const big = u.level >= 10 ? 1.6 : 1;
                    const r = UNITS.dwarf.atk.splash * (u.level >= 10 ? 1.2 : 1);
                    splashDamage(w, p.x1, p.z, r, p.dmg * big, 'fire', u, { knock: u.level >= 3 ? 0.35 : 0, fx: 'barrel' });
                    if (u.level >= 6 || w.mods.uniques.has('cluster')) {
                        for (const [dx, dz] of [[0.7, 0], [0.35, 0.8], [0.35, -0.8]]) splashDamage(w, p.x1 + dx, p.z + dz, 0.6, p.dmg * 0.3, 'fire', u, { fx: 'bomblet' });
                    }
                    alive = false;
                }
            } else {
                p.x += p.speed * dt;
                p.y += (p.ty - p.y) * Math.min(1, dt * 8);
                for (const e of w.enemies) {
                    if (e.lane !== p.lane || e.dead || e.burrowed || e.leapT > 0) continue;
                    if (e.fly && !p.air) continue;
                    if (p.hit.includes(e.id)) continue;
                    if (Math.abs(e.x - p.x) > e.r + 0.12) continue;
                    onProjectileHit(w, p, e);
                    p.hit.push(e.id);
                    if (p.hit.length > p.pierce) { alive = false; break; }
                }
                if (p.x > FIELD_END + 0.4) alive = false;
            }
        } else {
            alive = stepEnemyProjectile(w, p, dt);
        }
        if (alive) keep.push(p);
        else ev(w, 'pdone', { pid: p.id, kind: p.kind, x: p.x, y: p.y, z: p.z, from: p.from });
    }
    w.projectiles = keep;
}

function onProjectileHit(w, p, e) {
    const u = p.src;
    switch (p.kind) {
        case 'arrow':
            damageEnemy(w, e, p.dmg, { src: u, type: 'phys', crit: p.crit, front: true });
            if (w.mods.uniques.has('flamefletch')) applyBurn(e, p.dmg * 0.25);
            break;
        case 'fireball': {
            damageEnemy(w, e, p.dmg, { src: u, type: 'fire', crit: p.crit, front: true });
            applyBurn(e, UNITS.pyro.atk.burn * unitDmgMul(u.level));
            const r = p.splash * (u.level >= 3 ? 1.35 : 1);
            splashDamage(w, e.x, e.z, r, p.dmg * 0.55, 'fire', u, { skip: e, air: true, y: e.y + 0.4, noMark: true });
            if (u.level >= 6 || w.mods.uniques.has('emberheart')) w.zones.push({ kind: 'burn', lane: e.lane, x: e.x, z: e.z, t: 0, dur: 3, dps: p.dmg * 0.3, src: u });
            break;
        }
        case 'ice': {
            damageEnemy(w, e, p.dmg, { src: u, type: 'frost', crit: p.crit, front: true });
            const s = Math.min(0.85, UNITS.frost.atk.slow * (1 + w.mods.slow));
            e.slow = Math.max(e.slow, s);
            e.slowT = Math.max(e.slowT, UNITS.frost.atk.slowT * (u.level >= 3 ? 1.6 : 1));
            if (u.level >= 6 && !e.boss && e.freezeImm <= 0 && w.rng.chance(0.15)) { e.frozenT = Math.max(e.frozenT, 1.5); e.freezeImm = 4.5; ev(w, 'freeze', { id: e.id }); }
            break;
        }
        case 'holy':
            damageEnemy(w, e, p.dmg, { src: u, type: 'holy', crit: p.crit, front: true });
            break;
        case 'bolt':
            damageEnemy(w, e, p.dmg, { src: u, type: 'phys', crit: p.crit, front: true });
            if (u.level >= 6 && !e.boss) { e.stunT = Math.max(e.stunT, 0.35); e.x = Math.min(SPAWN_X, e.x + 0.12); }
            break;
    }
}

function stepEnemyProjectile(w, p, dt) {
    if (p.lob) {
        const k = Math.min(1, p.t / p.T);
        p.x = p.x0 + (p.x1 - p.x0) * k;
        p.z = p.z0 + (p.z1 - p.z0) * k;
        p.y = p.y0 * (1 - k) + 0.3 * k + Math.sin(Math.PI * k) * (1.2 + 0.1 * Math.abs(p.x1 - p.x0));
        if (k < 1) return true;
        if (p.targetId === 'wall') damageWall(w, p.dmg, p.srcE);
        else {
            const u = w.units.find((v) => v.id === p.targetId);
            if (u) damageUnit(w, u, p.dmg, p.srcE);
            if (p.kind === 'boulder' || p.kind === 'acid') {
                for (const v of w.units) if (v !== u && v.kind === 'field' && Math.hypot(v.x - p.x, v.z - p.z) < 0.9) damageUnit(w, v, p.dmg * 0.4, null);
            }
        }
        ev(w, 'explode', { x: p.x, z: p.z, r: 0.6, kind: p.kind, y: 0.3 });
        return false;
    }
    p.x -= p.speed * dt;
    for (const u of w.units) {
        if (u.kind !== 'field' || u.lane !== p.lane) continue;
        if (Math.abs(u.x - p.x) < 0.3 && u.x < p.x0) { damageUnit(w, u, p.dmg, p.srcE); return false; }
    }
    if (p.x <= 0.1) { damageWall(w, p.dmg, p.srcE); return false; }
    return true;
}

// ------------------------------------------------------------------ Unit behaviour

function stepUnits(w, dt) {
    const secondWind = w.mods.uniques.has('secondwind');
    for (const u of w.units.slice()) {
        if (u.hp <= 0) continue;
        u.hitT = Math.max(0, u.hitT - dt);
        u.atkT = Math.max(0, u.atkT - dt);
        if (secondWind) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.02 * dt);
        if (u.stunT > 0) { u.stunT -= dt; continue; }
        const d = UNITS[u.type];
        if (d.gen) stepAlchemist(w, u, dt);
        if (d.heal) stepCleric(w, u, dt);
        if (d.root) stepDruid(w, u, dt);
        if (!d.atk) continue;
        u.cd -= dt;
        if (u.cd > 0) continue;
        if (unitAttack(w, u)) { u.cd = unitCooldown(w, u); u.atkT = 0.3; }
        else u.cd = 0.1;
    }
}

function unitAttack(w, u) {
    const d = UNITS[u.type], a = d.atk;
    const dmg = unitDamage(w, u);
    switch (a.kind) {
        case 'arrow': {
            const e = firstInLane(w, u.lane, u.x, true);
            if (!e) return false;
            const crit = critRoll(w, u);
            shoot(w, u, 'arrow', { dmg, speed: a.speed, pierce: u.level >= 3 ? 1 : 0, crit, ty: e.y + 0.45 });
            if (u.level >= 6) w.zones.push({ kind: 'delay', t: 0, dur: 0.12, fn: 'arrow', u, ty: e.y + 0.45 });
            return true;
        }
        case 'fireball': {
            const e = firstInLane(w, u.lane, u.x, true);
            if (!e) return false;
            shoot(w, u, 'fireball', { dmg, speed: a.speed, crit: critRoll(w, u), splash: a.splash, type: 'fire', ty: e.y + 0.45 });
            if (u.level >= 10) w.zones.push({ kind: 'delay', t: 0, dur: 0.2, fn: 'fireball', u, ty: e.y + 0.45 });
            return true;
        }
        case 'ice': {
            const e = firstInLane(w, u.lane, u.x, true);
            if (!e) return false;
            shoot(w, u, 'ice', { dmg, speed: a.speed, crit: critRoll(w, u), type: 'frost', ty: e.y + 0.45 });
            return true;
        }
        case 'holy': {
            const e = firstInLane(w, u.lane, u.x, true);
            if (!e) return false;
            shoot(w, u, 'holy', { dmg, speed: a.speed, crit: critRoll(w, u), type: 'holy', ty: e.y + 0.45 });
            return true;
        }
        case 'bolt': {
            const e = firstInLane(w, u.lane, u.x, true);
            if (!e) return false;
            shoot(w, u, 'bolt', { dmg, speed: a.speed, pierce: 99, crit: critRoll(w, u), ty: 0.5 });
            if (u.level >= 10) w.zones.push({ kind: 'delay', t: 0, dur: 0.18, fn: 'bolt', u, ty: 0.5 });
            return true;
        }
        case 'barrel': {
            const e = firstInLane(w, u.lane, u.x, false, { burrowed: true });
            if (!e) return false;
            const T = 0.85 + 0.05 * Math.abs(e.x - u.x);
            const v = e.burrowed ? e.speed * 1.2 : effSpeed(w, e);
            const x1 = Math.max(u.x + 0.4, e.x - v * T);
            shoot(w, u, 'barrel', { dmg, lob: true, x1, T, air: false, type: 'fire' });
            return true;
        }
        case 'melee': {
            let hit = false;
            for (const e of w.enemies) {
                if (e.lane !== u.lane || e.dead || e.fly || e.burrowed || e.leapT > 0) continue;
                const dx = e.x - u.x;
                if (dx < -0.25 || dx > a.reach + e.r) continue;
                damageEnemy(w, e, dmg, { src: u, type: 'phys', crit: critRoll(w, u) });
                hit = true;
                if (u.level < 6) break;
            }
            if (hit) ev(w, 'swing', { id: u.id });
            return hit;
        }
        case 'chain': {
            let first = null, bd = Infinity;
            for (const e of w.enemies) {
                if (!isTargetable(e) || e.x < u.x - 0.2) continue;
                const dd = Math.hypot(e.x - u.x, e.z - u.z);
                if (dd > a.range) continue;
                const score = dd + Math.abs(e.lane - u.lane) * 1.5;
                if (score < bd) { bd = score; first = e; }
            }
            if (!first) return false;
            const jumps = a.jumps + (u.level >= 3 ? 2 : 0) + (w.mods.uniques.has('stormglass') ? 2 : 0);
            chainLightning(w, u, first, dmg, jumps, a.jumpR);
            if (u.level >= 10) w.zones.push({ kind: 'delay', t: 0, dur: 0.25, fn: 'chain', u });
            return true;
        }
    }
    return false;
}

function chainLightning(w, u, first, dmg, jumps, jumpR) {
    const pts = [{ x: u.x, y: u.kind === 'wall' ? 1.6 + 0.5 * u.tier : 1.0, z: u.z }];
    const hit = new Set();
    let cur = first, d = dmg;
    for (let i = 0; i <= jumps && cur; i++) {
        hit.add(cur.id);
        pts.push({ x: cur.x, y: cur.y + 0.45 * cur.size, z: cur.z });
        damageEnemy(w, cur, d, { src: u, type: 'shock', crit: critRoll(w, u) });
        if (u.level >= 6 && !cur.boss) cur.stunT = Math.max(cur.stunT, 0.4);
        d *= 0.85;
        let next = null, bd = jumpR;
        for (const e of w.enemies) {
            if (!isTargetable(e) || hit.has(e.id)) continue;
            const dd = Math.hypot(e.x - cur.x, e.z - cur.z);
            if (dd < bd) { bd = dd; next = e; }
        }
        cur = next;
    }
    ev(w, 'chain', { pts, id: u.id });
}

function stepAlchemist(w, u, dt) {
    u.cd2 -= dt;
    if (u.cd2 > 0) return;
    u.cd2 = UNITS.alchemist.gen.cd / (1 + 0.03 * (u.level - 1));
    const g = Math.round(brewGold(w, u));
    w.gold += g;
    w.stats.gold += g;
    if (w.waveStats) w.waveStats.gold += g;
    u.atkT = 0.4;
    ev(w, 'brew', { id: u.id, gold: g, x: u.x, z: u.z });
    if (u.level >= 6) {
        for (const v of w.units) if (v !== u && Math.abs(v.lane - u.lane) <= 1 && Math.abs(v.x - u.x) <= 1.2) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.08);
    }
}

function stepCleric(w, u, dt) {
    const h = UNITS.cleric.heal;
    u.cd2 -= dt;
    if (u.level >= 10) for (const v of w.units) if (v.lane === u.lane) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.01 * dt);
    if (u.cd2 > 0) return;
    u.cd2 = h.cd;
    const amt = h.amt * unitDmgMul(u.level) * (u.level >= 3 ? 1.4 : 1) * (1 + w.mods.unithp * 0.5);
    let best = null, bf = 0.999;
    for (const v of w.units) {
        if (Math.hypot(v.x - u.x, v.z - u.z) > h.radius) continue;
        const f = v.hp / v.maxHp;
        if (f < bf) { bf = f; best = v; }
    }
    if (best) {
        best.hp = Math.min(best.maxHp, best.hp + amt);
        if (u.level >= 6 && bf < 0.5) best.shield = Math.max(best.shield, best.maxHp * 0.3);
        ev(w, 'heal', { id: best.id, from: u.id, amt: Math.round(amt) });
    }
    if (u.kind === 'wall' && w.wallHp < w.wallMax) {
        const r = h.wall * unitDmgMul(u.level) * h.cd * (1 + 0.05 * w.wave);
        w.wallHp = Math.min(w.wallMax, w.wallHp + r);
        ev(w, 'repair', { id: u.id, amt: Math.round(r), lane: u.lane });
    }
}

function stepDruid(w, u, dt) {
    const r = UNITS.druid.root;
    u.cd2 -= dt;
    if (u.cd2 > 0) return;
    const reach = u.level >= 10 ? FIELD_END : r.reach;
    const list = w.enemies.filter((e) => e.lane === u.lane && !e.dead && !e.fly && !e.burrowed && e.x > u.x - 0.2 && e.x - u.x <= reach && e.x < FIELD_END)
        .sort((a, b) => a.x - b.x)
        .slice(0, u.level >= 10 ? 99 : u.level >= 6 ? 4 : r.count);
    if (!list.length) { u.cd2 = 0.3; return; }
    u.cd2 = r.cd;
    u.atkT = 0.5;
    const dmg = unitDamage(w, u);
    const dur = r.dur * (u.level >= 3 ? 1.5 : 1) * (list[0].boss ? 0.4 : 1);
    for (const e of list) {
        if (!e.boss) e.rootT = Math.max(e.rootT, dur);
        damageEnemy(w, e, dmg, { src: u, type: 'phys', explosive: false });
    }
    ev(w, 'root', { id: u.id, targets: list.map((e) => ({ x: e.x, z: e.z })) });
}

// ------------------------------------------------------------------ Enemy behaviour

/** Past the end of the wave's schedule the Night-tide grows frantic, so no wave can stall. */
const frenzy = (w) => Math.max(0, w.waveT - w.waveDef.duration - 45) / 30;

function effSpeed(w, e) {
    if (e.frozenT > 0 || e.stunT > 0 || e.rootT > 0) return 0;
    let s = e.speed * (1 - (e.slowT > 0 ? e.slow : 0)) * (1 + frenzy(w));
    if (w.buffs.warcry > 0) s *= 1.4;
    if (e.elite?.includes('frenzied')) s *= 1 + (1 - e.hp / e.maxHp);
    return s;
}

/** The field unit this monster is up against, if any. */
function blockerFor(w, e) {
    let best = null;
    for (const u of w.units) {
        if (u.kind !== 'field' || u.lane !== e.lane || u.hp <= 0) continue;
        const dx = e.x - u.x;
        if (dx < -0.1 || dx > 0.42 + e.r) continue;
        if (!best || u.x > best.x) best = u;
    }
    return best;
}

function stepEnemies(w, dt) {
    for (const e of w.enemies) {
        if (e.dead) continue;
        e.t += dt;
        e.hitT = Math.max(0, e.hitT - dt);
        e.atkAnim = Math.max(0, e.atkAnim - dt);
        e.invuln = Math.max(0, e.invuln - dt);
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
        if (e.frozenT > 0) e.frozenT -= dt;
        e.freezeImm = Math.max(0, e.freezeImm - dt);
        e.lastHit += dt;
        if (frenzy(w) > 0) { e.frozenT = Math.min(e.frozenT, 0); e.rootT = 0; e.stunT = 0; }
        if (e.rootT > 0) e.rootT -= dt;
        if (e.stunT > 0) e.stunT -= dt;
        if (e.burnT > 0) {
            e.burnT -= dt;
            damageEnemy(w, e, e.burnDps * dt, { type: 'fire', noMark: true, quiet: true });
            if (e.dead) continue;
        }
        if (e.elite?.includes('regen') && e.lastHit > 2) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
        // Lane changes (bosses) glide in z.
        const tz = laneZ(e.lane);
        e.z += Math.sign(tz - e.z) * Math.min(Math.abs(tz - e.z), 2.5 * dt);
        if (e.boss) { BOSSES[e.boss].update(w, e, dt, API); continue; }
        if (e.leapT > 0) {
            e.leapT -= dt;
            e.x -= (e.leapDx / 0.6) * dt;
            e.y = Math.sin(Math.PI * Math.max(0, 1 - e.leapT / 0.6)) * 1.1;
            if (e.leapT <= 0) { e.y = 0; ev(w, 'land', { id: e.id }); }
            continue;
        }
        if (e.frozenT > 0 || e.stunT > 0) continue;
        stepEnemyAI(w, e, dt);
    }
}

function attackTarget(w, e, target, dt, mult = 1) {
    e.cd -= dt;
    e.state = 'attack';
    if (e.cd > 0) return;
    e.cd = e.atkCd / (1 + frenzy(w));
    e.atkAnim = 0.35;
    if (target === 'wall') {
        damageWall(w, e.dmg * mult * (e.arch === 'brute' ? 1.3 : 1), e);
    } else {
        damageUnit(w, target, e.dmg * mult * (e.arch === 'brute' ? 2 : 1), e);
    }
    if (e.elite?.includes('vampiric')) e.hp = Math.min(e.maxHp, e.hp + e.dmg * 0.5);
}

function stepEnemyAI(w, e, dt) {
    const v = effSpeed(w, e);
    switch (e.arch) {
        case 'treasure': {
            if (e.dir < 0 && e.x <= 3) { e.dir = 1; ev(w, 'flee', { id: e.id }); }
            e.x += e.dir * v * (e.dir > 0 ? 1.15 : 1) * dt;
            e.state = 'walk';
            if (e.dir > 0 && e.x > SPAWN_X + 0.3) { e.dead = true; e.escaped = true; ev(w, 'escape', { id: e.id }); }
            return;
        }
        case 'icewall': return;
        case 'burrower':
            if (e.burrowed) {
                e.x -= e.speed * 1.2 * dt;
                if (e.x <= 1.7) { e.burrowed = false; ev(w, 'emerge', { id: e.id, x: e.x, z: e.z }); }
                return;
            }
            break;
        case 'shaman':
            e.healT -= dt;
            if (e.healT <= 0 && e.x < FIELD_END) {
                e.healT = 4;
                let any = false;
                for (const o of w.enemies) {
                    if (o.dead || o === e || o.hp >= o.maxHp) continue;
                    if (Math.hypot(o.x - e.x, o.z - e.z) > 2.3) continue;
                    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ARCH.shaman.heal);
                    any = true;
                }
                if (any) { e.atkAnim = 0.5; ev(w, 'ehealed', { id: e.id, x: e.x, z: e.z }); }
            }
            break;
        case 'ranged':
        case 'siege': {
            const range = ARCH[e.arch].range;
            let target = null;
            if (e.arch === 'ranged') {
                let best = null;
                for (const u of w.units) {
                    if (u.kind !== 'field' || u.lane !== e.lane || u.x >= e.x) continue;
                    if (e.x - u.x > range) continue;
                    if (!best || u.x > best.x) best = u;
                }
                target = best;
            }
            if (!target && e.x <= range + 0.3) target = 'wall';
            if (target && e.x < FIELD_END - 0.2) {
                e.state = 'attack';
                e.cd -= dt;
                if (e.cd <= 0) {
                    e.cd = e.atkCd;
                    e.atkAnim = 0.4;
                    const kind = e.arch === 'siege' ? 'boulder' : (speciesOf(w, e).params.weapon === 'staff' ? 'hex' : 'arrow');
                    enemyShoot(w, e, kind, target, e.dmg);
                }
                return;
            }
            break;
        }
    }
    // Walkers: flyers skip blockers.
    if (!e.fly) {
        const b = blockerFor(w, e);
        if (b) {
            if (e.arch === 'leaper' && !e.leapt) {
                e.leapt = true;
                e.leapT = 0.6;
                e.leapDx = Math.max(0.5, e.x - (b.x - 0.75));
                ev(w, 'leap', { id: e.id });
                return;
            }
            if (e.arch === 'sapper') { sapperBlast(w, e, b); return; }
            attackTarget(w, e, b, dt);
            return;
        }
    }
    if (e.x <= WALL_HIT_X + e.r * 0.4 + (e.fly ? 0.1 : 0)) {
        if (e.arch === 'sapper') { sapperBlast(w, e, 'wall'); return; }
        attackTarget(w, e, 'wall', dt);
        return;
    }
    e.state = 'walk';
    e.x -= v * dt;
}

function sapperBlast(w, e, target) {
    e.dead = true;
    if (target === 'wall') damageWall(w, e.dmg, null);
    explodeAt(w, e.x, e.lane, 1.05, e.dmg * 1.4, 'sapper');
    ev(w, 'sapper', { id: e.id, x: e.x, z: e.z });
}

// ------------------------------------------------------------------ Zones

function stepZones(w, dt) {
    const keep = [];
    for (const z of w.zones) {
        z.t += dt;
        let done = z.t >= z.dur;
        switch (z.kind) {
            case 'delay':
                if (done && w.units.includes(z.u)) {
                    const u = z.u, d = unitDamage(w, u);
                    if (z.fn === 'arrow') shoot(w, u, 'arrow', { dmg: d, speed: 14, pierce: u.level >= 3 ? 1 : 0, crit: critRoll(w, u), ty: z.ty });
                    if (z.fn === 'fireball') shoot(w, u, 'fireball', { dmg: d, speed: 9, crit: critRoll(w, u), splash: UNITS.pyro.atk.splash, type: 'fire', ty: z.ty });
                    if (z.fn === 'bolt') shoot(w, u, 'bolt', { dmg: d, speed: 24, pierce: 99, crit: critRoll(w, u), ty: 0.5 });
                    if (z.fn === 'chain') {
                        const e = w.enemies.filter(isTargetable).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0];
                        if (e && Math.hypot(e.x - u.x, e.z - u.z) < UNITS.storm.atk.range) chainLightning(w, u, e, d * 0.6, UNITS.storm.atk.jumps, UNITS.storm.atk.jumpR);
                    }
                }
                break;
            case 'burn':
                for (const e of w.enemies) if (!e.dead && !e.fly && e.lane === z.lane && Math.abs(e.x - z.x) < 0.6) damageEnemy(w, e, z.dps * dt, { type: 'fire', src: z.src, noMark: true, quiet: true });
                break;
            case 'meteor':
                if (done) splashDamage(w, z.x, z.z, z.r, z.dmg, 'fire', null, { air: true, fx: 'meteor', noMark: true });
                break;
            case 'arrows':
                for (const e of w.enemies) if (!e.dead && e.lane === z.lane && e.x < FIELD_END && !e.burrowed) damageEnemy(w, e, z.dps * dt, { type: 'phys', noMark: true, quiet: true });
                break;
            case 'storm':
                z.next -= dt;
                if (z.next <= 0) {
                    z.next = 0.16;
                    const t = w.enemies.filter(isTargetable).sort((a, b) => b.hp - a.hp)[0];
                    if (t) { damageEnemy(w, t, z.dmg, { type: 'shock', noMark: true }); ev(w, 'strike', { x: t.x, z: t.z, y: t.y }); }
                    z.left--;
                    if (z.left <= 0 || !t) done = true;
                }
                break;
            case 'keepfire': {
                const sx = (z.t / z.dur) * (FIELD_END + 0.5);
                for (const e of w.enemies) {
                    if (e.dead || e.lane !== z.lane || e.x > sx || z.hit.has(e.id)) continue;
                    z.hit.add(e.id);
                    damageEnemy(w, e, z.dmg, { type: 'fire', explosive: true, noMark: true });
                    applyBurn(e, z.dmg * 0.08);
                }
                break;
            }
        }
        if (!done) keep.push(z);
    }
    w.zones = keep;
}

// ------------------------------------------------------------------ Main step

/** API handed to the boss behaviours (avoids a circular import). */
const API = {
    spawnEnemy, damageUnit, damageWall, damageEnemy, ev, enemyShoot, attackTarget, blockerFor, effSpeed, speciesOf,
};

export function step(w, dt) {
    if (w.phase !== 'wave') return;
    w.time += dt;
    w.waveT += dt;
    const def = w.waveDef;
    // Spawns
    while (w.spawnIdx < def.entries.length && def.entries[w.spawnIdx].t <= w.waveT) {
        const s = def.entries[w.spawnIdx++];
        spawnEnemy(w, s.arch, s.lane, { elite: s.elite, boss: s.boss });
        if (!w.waveStats.hordeAnnounced && def.flags.length && w.waveT >= def.flags[0] - 0.01) {
            w.waveStats.hordeAnnounced = true;
            ev(w, def.boss ? 'bossArrive' : 'horde', { boss: def.boss });
        }
    }
    // Buffs
    for (const k of ['rally', 'midas', 'warcry']) w.buffs[k] = Math.max(0, w.buffs[k] - dt);
    // Treasury income and the Keepfire's slow charge
    if (w.castle.treasury > 0) {
        w.goldFrac += treasuryIncome(w.castle.treasury) * (1 + 0.06 * w.wave) * dt;
        if (w.goldFrac >= 1) { const g = Math.floor(w.goldFrac); w.goldFrac -= g; w.gold += g; w.stats.gold += g; }
    }
    if (w.castle.keepfire > 0 && w.kf < 100) w.kf = Math.min(100, w.kf + 0.5 * (1 + w.mods.keepfire) * dt);
    for (const k in w.cards) if (w.cards[k] > 0) w.cards[k] = Math.max(0, w.cards[k] - dt);
    // Ember motes
    w.moteT -= dt;
    if (w.moteT <= 0) { w.moteT = w.rng.range(10, 14); spawnMote(w); }

    stepUnits(w, dt);
    stepEnemies(w, dt);
    stepProjectiles(w, dt);
    stepZones(w, dt);

    // Pickups: motes fall, orbs bob; they fade out (or collect themselves with Lodestone).
    const lode = (w.ember.lodestone ?? 0) > 0;
    for (const o of w.orbs.slice()) {
        o.t += dt;
        if (o.kind === 'mote') o.y = Math.max(0.55, 5 - o.t * 2.4);
        if (lode && o.t > 1.4) collectOrb(w, o.id);
        else if (o.t > o.life) { w.orbs.splice(w.orbs.indexOf(o), 1); ev(w, 'orbFade', { id: o.id }); }
    }
    if (w.enemies.some((e) => e.dead)) w.enemies = w.enemies.filter((e) => !e.dead);
    if (w.phase === 'wave' && w.spawnIdx >= def.entries.length && w.enemies.length === 0) clearWave(w);
}

/** Fraction of the wave spawned, for the progress bar. */
export function waveProgress(w) {
    if (!w.waveDef) return 0;
    if (w.phase !== 'wave') return w.phase === 'prep' ? 0 : 1;
    return Math.min(1, w.waveT / w.waveDef.duration);
}

export { isBossWave, REGIONS };

// ------------------------------------------------------------------ Save / restore

/** A JSON-safe snapshot of the run, taken in 'prep' (the start of a wave). */
export function serializeRun(w) {
    return {
        v: 1, seed: w.seed, wave: w.wave, best: w.best, attempt: w.attempt, gold: Math.floor(w.gold),
        castle: { ...w.castle, towers: w.castle.towers.slice() },
        units: w.units.map((u) => ({ type: u.type, lane: u.lane, kind: u.kind, col: u.col, tier: u.tier, level: u.level, invested: u.invested, kills: u.kills })),
        relics: w.relics.map((r) => ({ ...r, affixes: r.affixes.map((a) => ({ ...a })), colors: r.colors.slice() })),
        powers: w.powers.map((p) => ({ ...p })),
        kf: w.kf, stats: { ...w.stats }, seen: { ...w.seen },
        obstacles: w.obstacles.map((o) => ({ ...o })), regionIdx: w.regionIdx,
    };
}

export function restoreRun(data, ember = {}) {
    const w = createWorld({ seed: data.seed, ember, wave: data.wave, gold: data.gold });
    w.best = data.best ?? data.wave - 1;
    w.attempt = data.attempt ?? 0;
    w.castle = { ...w.castle, ...data.castle, towers: data.castle.towers.slice() };
    w.relics = (data.relics ?? []).map((r) => ({ ...r }));
    w.powers = (data.powers ?? []).map((p) => ({ ...p }));
    w.kf = data.kf ?? 0;
    w.stats = { ...w.stats, ...(data.stats ?? {}) };
    w.seen = { ...(data.seen ?? {}) };
    refreshMods(w);
    w.units = [];
    for (const r of data.units ?? []) {
        const slot = r.kind === 'wall' ? { kind: 'wall', lane: r.lane, tier: r.tier } : { kind: 'field', lane: r.lane, col: r.col };
        const u = makeUnit(w, r.type, slot);
        u.level = r.level; u.invested = r.invested; u.kills = r.kills ?? 0; u.fresh = false;
        w.units.push(u);
    }
    refreshMods(w);
    w.regionIdx = -1;
    beginPrep(w);
    if (data.obstacles) w.obstacles = data.obstacles.map((o) => ({ ...o }));
    w.events.length = 0;
    return w;
}

/** After a lost wave: back to that wave's snapshot, keeping all the gold earned in the attempt. */
export function retryFrom(snapshot, earned, ember) {
    const w = restoreRun(snapshot, ember);
    w.attempt = (snapshot.attempt ?? 0) + 1;
    const bonus = Math.max(0, Math.floor(earned));
    w.gold += bonus;
    w.retryBonus = bonus;
    return w;
}
