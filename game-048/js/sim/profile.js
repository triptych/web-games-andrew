/**
 * profile.js — everything that persists: pilot, frame, modules, boosters,
 * campaign progress, the current sector, contracts, facilities, the Sim Ladder.
 * All functions are pure mutations of the profile object; time is passed in.
 */

import { makeStateRng, hashSeed } from './rng.js';
import { newMech } from './mech.js';
import { rollMod, modUpgradeCost, modSalvage, RARITIES } from './mods.js';
import { BOOSTERS, BOOSTER_IDS } from './boosters.js';
import { makeEncounter, rewardScale } from './enemies.js';
import { generateSector, nodeById, nodeX } from './sector.js';
import { refillQuests, trackBattle } from './quests.js';
import { deriveLoadout } from './loadout.js';

export const SAVE_VERSION = 1;
export const CHAPTERS = 7;
export const LEVEL_CAP = 60;

export function newProfile(seed, callsign = 'ACE') {
    const p = {
        v: SAVE_VERSION, seed: seed >>> 0, callsign,
        rngObj: { s: hashSeed(seed, 77) },
        pilot: { level: 1, xp: 0, sp: 0, skills: {} },
        scrap: 0, cores: 0,
        mech: newMech(),
        mods: [], equipped: [], uid: 1,
        boosters: { nanite: 1, battery: 1 },
        campaign: { best: 0, threat: 0, maxThreat: 0, graduated: false },
        sector: null,
        quests: { active: [], seq: 0, claimed: 0 },
        facilities: { refinery: 0, drones: 0, archive: 0, forge: 0, bank: 0, coreBank: 0, last: 0 },
        ladder: { best: 0, run: null },
        story: { seen: [], queue: ['prologue'] },
        stats: { battles: 0, wins: 0, losses: 0, kills: 0, jackpots: 0, overdrives: 0, bestSpin: 0, bestChain: 0, sectors: 0 },
        tutorial: { spin: false, tweak: false, hub: false },
    };
    refillQuests(p, rngOf(p));
    return p;
}

export const rngOf = (p) => makeStateRng(p.rngObj);

// ------------------------------------------------------------------ pilot XP

export const xpNeed = (lv) => Math.round(40 * Math.pow(1.3, lv - 1));

export function addXp(p, xp) {
    const levels = [];
    p.pilot.xp += xp;
    while (p.pilot.level < LEVEL_CAP && p.pilot.xp >= xpNeed(p.pilot.level)) {
        p.pilot.xp -= xpNeed(p.pilot.level);
        p.pilot.level++;
        p.pilot.sp++;
        levels.push(p.pilot.level);
    }
    if (p.pilot.level >= LEVEL_CAP) p.pilot.xp = 0;
    return levels;
}

// ------------------------------------------------------------------ facilities (incremental)

export const FACILITIES = {
    refinery: { name: 'Scrap Refinery', icon: 'refinery', max: 30, desc: 'Refines scrap while you fly — and while you are away (up to 8 hours).', gate: 0,
        cost: (lv) => Math.round(90 * Math.pow(1.8, lv)), effect: (lv) => `${fmtRate(refineryRate(lv))} scrap/s` },
    drones: { name: 'Salvage Drone Bay', icon: 'drones', max: 25, desc: 'Drones sweep every battlefield: more scrap from fights.', gate: 0,
        cost: (lv) => Math.round(160 * Math.pow(1.95, lv)), effect: (lv) => `+${lv * 12}% battle scrap` },
    archive: { name: 'Sim Archive', icon: 'archive', max: 25, desc: 'Replays your fights overnight: more pilot XP.', gate: 1,
        cost: (lv) => Math.round(260 * Math.pow(1.95, lv)), effect: (lv) => `+${lv * 10}% XP` },
    forge: { name: 'Core Forge', icon: 'forge', max: 10, desc: 'Grows Probability Cores in a vat of uncertain foam.', gate: 2,
        cost: (lv) => Math.round(4000 * Math.pow(2.6, lv)), effect: (lv) => `${(lv * 0.25).toFixed(2)} cores/hour` },
};
const fmtRate = (r) => (r >= 100 ? Math.round(r).toString() : r.toFixed(1));

export const refineryRate = (lv) => (lv <= 0 ? 0 : 0.3 * Math.pow(1.55, lv - 1));
export const BANK_HOURS = 8;

export function tickFacilities(p, nowSec) {
    const f = p.facilities;
    if (!f.last) { f.last = nowSec; return 0; }
    const dt = Math.max(0, Math.min(nowSec - f.last, BANK_HOURS * 3600));
    f.last = nowSec;
    const rate = refineryRate(f.refinery);
    const cap = rate * BANK_HOURS * 3600;
    const before = f.bank;
    f.bank = Math.min(cap, f.bank + rate * dt);
    f.coreBank = Math.min(f.forge * 0.25 * BANK_HOURS, f.coreBank + (f.forge * 0.25 * dt) / 3600);
    return f.bank - before;
}

export function collectFacilities(p) {
    const f = p.facilities;
    const scrap = Math.floor(f.bank);
    const cores = Math.floor(f.coreBank);
    p.scrap += scrap;
    p.cores += cores;
    f.bank -= scrap;
    f.coreBank -= cores;
    return { scrap, cores };
}

export function facilityCost(p, id) {
    const F = FACILITIES[id];
    const lv = p.facilities[id];
    if (lv >= F.max) return null;
    return F.cost(lv);
}

export function upgradeFacility(p, id) {
    const F = FACILITIES[id];
    const c = facilityCost(p, id);
    if (c === null || p.scrap < c || p.campaign.best < F.gate) return false;
    p.scrap -= c;
    p.facilities[id]++;
    return true;
}

export const scrapMult = (p) => 1 + 0.12 * p.facilities.drones;
export const xpMult = (p) => 1 + 0.1 * p.facilities.archive;

// ------------------------------------------------------------------ modules

export function addMod(p, mod) {
    p.mods.push(mod);
    const slots = p.mech.chassis + 1;
    if (p.equipped.length < slots) p.equipped.push(mod.uid);
    return mod;
}

export function newMod(p, luck = 0) {
    const m = rollMod(rngOf(p), p.uid++, luck, p.mods);
    return m;
}

export function toggleEquip(p, uid) {
    const i = p.equipped.indexOf(uid);
    if (i >= 0) { p.equipped.splice(i, 1); return true; }
    if (p.equipped.length >= p.mech.chassis + 1) return false;
    p.equipped.push(uid);
    return true;
}

export function upgradeMod(p, uid) {
    const m = p.mods.find((x) => x.uid === uid);
    if (!m) return false;
    const c = modUpgradeCost(m);
    if (c === null || p.scrap < c) return false;
    p.scrap -= c;
    m.lv++;
    return true;
}

export function salvageMod(p, uid) {
    const i = p.mods.findIndex((x) => x.uid === uid);
    if (i < 0) return 0;
    const v = modSalvage(p.mods[i]);
    p.mods.splice(i, 1);
    p.equipped = p.equipped.filter((u) => u !== uid);
    p.scrap += v;
    return v;
}

// ------------------------------------------------------------------ sectors

export function chapterAvailable(p, ch) {
    return ch >= 0 && ch < CHAPTERS && ch <= p.campaign.best;
}

export function startSector(p, chapter, threat = 0) {
    const seed = rngOf(p).int(1, 2 ** 31);
    const map = generateSector(makeStateRng({ s: seed }), chapter);
    const L = deriveLoadout(p);
    p.sector = { chapter, threat, seed, nodes: map.nodes, rows: map.rows, at: null, hp: L.maxHp, done: [], fights: 0, pending: null };
    return p.sector;
}

/** The encounter at a fight node (deterministic per node). */
export function encounterFor(p, node) {
    const s = p.sector;
    const rng = makeStateRng({ s: hashSeed(s.seed, node.id, 31) });
    const kind = node.type === 'elite' ? 'elite' : node.type === 'boss' ? 'boss' : 'battle';
    return makeEncounter(rng, { chapter: s.chapter, x: nodeX(s, node), kind });
}

export function enterNode(p, id) {
    const s = p.sector;
    const n = nodeById(s, id);
    s.at = id;
    s.done.push(id);
    return n;
}

export function combatSeed(p) {
    return rngOf(p).int(1, 2 ** 31);
}

/**
 * Bank a won fight. ctx: { kind: 'battle'|'elite'|'boss'|'ladder', x }.
 * Returns a summary the reward screen shows.
 */
export function applyVictory(p, result, ctx) {
    const rng = rngOf(p);
    const scrap = Math.round(result.loot.scrap * scrapMult(p));
    const xp = Math.round(result.loot.xp * xpMult(p));
    p.scrap += scrap;
    const levels = addXp(p, xp);
    syncBoosters(p, result);
    p.stats.battles++;
    p.stats.wins++;
    p.stats.kills += result.stats.kills;
    p.stats.jackpots += result.stats.jackpots;
    p.stats.overdrives += result.stats.overdrives;
    p.stats.bestSpin = Math.max(p.stats.bestSpin, result.stats.maxSpin);
    p.stats.bestChain = Math.max(p.stats.bestChain, result.stats.maxChain);
    const quests = trackBattle(p, result.stats);
    const out = { scrap, xp, levels, quests, cores: 0, drops: result.loot.boosters.slice(), choices: null, chapterCleared: null };
    if (p.sector && ctx.kind !== 'ladder') {
        p.sector.hp = result.hp;
        p.sector.fights++;
    }
    if (ctx.kind === 'battle' && rng.chance(0.3)) {
        const id = rng.pick(BOOSTER_IDS);
        p.boosters[id] = (p.boosters[id] ?? 0) + 1;
        out.drops.push(id);
    }
    if (ctx.kind === 'elite') {
        out.choices = rewardChoices(p, 0.4 + 0.08 * ctx.x, true);
        p.cores += 1; out.cores += 1;
    }
    if (ctx.kind === 'boss') {
        const s = p.sector;
        const cores = 3 + s.chapter + 3 * s.threat;
        p.cores += cores;
        out.cores += cores;
        out.choices = rewardChoices(p, 0.8 + 0.1 * ctx.x, true);
        out.chapterCleared = s.chapter;
        finishChapter(p, s.chapter, s.threat);
    }
    return out;
}

function finishChapter(p, ch, threat) {
    p.stats.sectors++;
    const first = threat === 0 && ch === p.campaign.best;
    if (threat === 0 && ch + 1 > p.campaign.best) p.campaign.best = ch + 1;
    if (threat > 0 && ch === CHAPTERS - 1 && threat === p.campaign.maxThreat) p.campaign.maxThreat++;
    if (first) {
        p.story.queue.push(`outro${ch}`);
        if (ch === CHAPTERS - 1) {
            p.campaign.graduated = true;
            p.campaign.maxThreat = Math.max(p.campaign.maxThreat, 1);
            p.story.queue.push('ending');
        }
    }
    p.sector = null;
}

export function applyDefeat(p, result) {
    syncBoosters(p, result);
    p.stats.battles++;
    p.stats.losses++;
    p.sector = null;
}

function syncBoosters(p, result) {
    for (const id in result.boostersUsed) p.boosters[id] = Math.max(0, (p.boosters[id] ?? 0) - result.boostersUsed[id]);
    for (const id of result.loot.boosters) p.boosters[id] = (p.boosters[id] ?? 0) + 1;
}

// ------------------------------------------------------------------ reward choices, depot, repair bay

/** Three options; `modHeavy` makes at least two of them modules. */
export function rewardChoices(p, luck, modHeavy) {
    const rng = rngOf(p);
    const x = p.sector ? p.sector.chapter + 5 * p.sector.threat : p.campaign.best;
    const out = [];
    const nMods = modHeavy ? 2 + (rng.chance(0.5) ? 1 : 0) : 1;
    for (let i = 0; i < nMods; i++) out.push({ type: 'mod', mod: newMod(p, luck) });
    while (out.length < 3) {
        const r = rng.int(0, 2);
        if (r === 0) out.push({ type: 'booster', id: rng.pick(BOOSTER_IDS), n: 2 });
        else if (r === 1) out.push({ type: 'scrap', n: Math.round(120 * rewardScale(x) * rng.range(0.8, 1.3)) });
        else out.push({ type: 'cores', n: 1 + Math.floor(x / 3) });
    }
    return out;
}

export function takeChoice(p, choice) {
    if (!choice) return;
    if (choice.type === 'mod') addMod(p, choice.mod);
    else if (choice.type === 'booster') p.boosters[choice.id] = (p.boosters[choice.id] ?? 0) + choice.n;
    else if (choice.type === 'scrap') p.scrap += choice.n;
    else if (choice.type === 'cores') p.cores += choice.n;
}

export function depotStock(p) {
    const rng = rngOf(p);
    const x = p.sector.chapter + 5 * p.sector.threat;
    const scale = rewardScale(x);
    const items = rng.shuffle(BOOSTER_IDS.slice()).slice(0, 4).map((id) => ({ type: 'booster', id, price: Math.round(BOOSTERS[id].price * scale), sold: false }));
    const mods = [0, 1].map(() => {
        const mod = newMod(p, 0.3 + 0.05 * x);
        return { type: 'mod', mod, price: Math.round(140 * Math.pow(2, mod.rar) * scale), sold: false };
    });
    return { items, mods, repair: { price: Math.round(50 * scale), used: false } };
}

export function buy(p, entry) {
    if (entry.sold || p.scrap < entry.price) return false;
    p.scrap -= entry.price;
    entry.sold = true;
    if (entry.type === 'booster') p.boosters[entry.id] = (p.boosters[entry.id] ?? 0) + 1;
    if (entry.type === 'mod') addMod(p, entry.mod);
    return true;
}

export function repairSector(p, pct) {
    const L = deriveLoadout(p);
    const before = p.sector.hp;
    p.sector.hp = Math.min(L.maxHp, p.sector.hp + Math.round(L.maxHp * pct));
    return p.sector.hp - before;
}

/** Tune: a free level for a module (up to its rarity's cap). */
export function tuneMod(p, uid) {
    const m = p.mods.find((x) => x.uid === uid);
    if (!m || m.lv >= RARITIES[m.rar].maxLv) return false;
    m.lv++;
    return true;
}

// ------------------------------------------------------------------ contracts

export function claimQuest(p, uid) {
    const i = p.quests.active.findIndex((q) => q.uid === uid && q.done);
    if (i < 0) return null;
    const q = p.quests.active[i];
    p.quests.active.splice(i, 1);
    p.scrap += q.reward.scrap;
    p.cores += q.reward.cores;
    const levels = addXp(p, q.reward.xp);
    let mod = null;
    if (q.reward.mod) mod = addMod(p, newMod(p, 0.6));
    p.quests.claimed++;
    refillQuests(p, rngOf(p));
    return { quest: q, levels, mod };
}

export function rerollQuest(p, uid) {
    const cost = rerollCost(p);
    const i = p.quests.active.findIndex((q) => q.uid === uid && !q.done);
    if (i < 0 || p.scrap < cost) return false;
    p.scrap -= cost;
    p.quests.active.splice(i, 1);
    refillQuests(p, rngOf(p));
    return true;
}
export const rerollCost = (p) => Math.round(40 * rewardScale(p.campaign.best));

// ------------------------------------------------------------------ Sim Ladder (endless)

export const ladderX = (floor) => 0.4 + floor * 0.42;

export function ladderEncounter(p, floor) {
    const rng = makeStateRng({ s: hashSeed(p.seed, floor, 911) });
    const chapter = Math.min(6, Math.floor(floor / 3));
    const kind = floor % 10 === 0 ? 'boss' : floor % 5 === 0 ? 'elite' : 'battle';
    return makeEncounter(rng, { chapter: Math.max(1, chapter), x: ladderX(floor), kind });
}

export function startLadder(p) {
    const L = deriveLoadout(p);
    p.ladder.run = { floor: 1, hp: L.maxHp };
}

export function ladderWin(p, result) {
    const run = p.ladder.run;
    const floor = run.floor;
    p.ladder.best = Math.max(p.ladder.best, floor);
    run.hp = Math.min(result.maxHp, result.hp + Math.round(result.maxHp * 0.15));
    run.floor++;
    let cores = 0;
    if (floor % 10 === 0) { cores = 1 + Math.floor(floor / 20); p.cores += cores; }
    return { floor, cores };
}

export function ladderEnd(p) {
    p.ladder.run = null;
}
