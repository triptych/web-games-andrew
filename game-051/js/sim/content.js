/**
 * content.js — what you fight and what you win: campaign stages, rifts, the
 * Endless Spire and the Arena. Builds battle configs and pays out rewards.
 */

import { Rng, hashStr } from '../core/rng.js';
import { now, dayKey, HOUR } from '../core/time.js';
import { ELEMENTS, MAX_LEVEL } from '../data/core.js';
import { REGIONS, STAGES_PER_REGION, TOTAL_STAGES, RIFTS, BLESSINGS, BLESSING_RARITY, ARENA_RANKS, SPECIES } from '../data/world.js';
import { generateGear } from './gear.js';
import { addXp, generateLook } from './heroes.js';
import { RACE_IDS } from '../data/core.js';
import { heroUnit, enemyUnit, rivalHeroUnit, teamExtras } from './units.js';
import { heroById, grant, bump, maxCounter, rngOf, spend } from './state.js';
import { spellPower, fortune } from './overlord.js';
import { heroPower } from './stats.js';
import { gearLookup } from './state.js';

// ---------------------------------------------------------------- campaign

/**
 * The power ladder: every (star, level) pair in order, 1★ L1 … 6★ L40
 * (165 rungs). Campaign stages and Spire floors are placed on it.
 */
export function ladder(pos) {
    let p = Math.max(1, Math.round(pos));
    for (let s = 1; s <= 6; s++) {
        if (p <= MAX_LEVEL[s] || s === 6) return { star: s, level: Math.min(MAX_LEVEL[s], p) };
        p -= MAX_LEVEL[s];
    }
    return { star: 6, level: 40 };
}

/** enemy stat multiplier standing in for the gear, talents and buffs the player has by then */
export function curveDiff(x) { return x <= 20 ? 1 + x * 0.03 : 1.6 + (x - 20) * 0.012; }

export function stageInfo(idx) {
    const r = Math.floor(idx / STAGES_PER_REGION), n = idx % STAGES_PER_REGION;
    const reg = REGIONS[r];
    const { star, level } = ladder(1 + idx * 2.5);
    const boss = n === STAGES_PER_REGION - 1;
    return {
        idx, r, n, region: reg, boss, label: `${r + 1}-${n + 1}`,
        star, level, diff: curveDiff(idx),
        stamina: 3 + Math.floor(r / 2),
        gold: Math.round(70 * (1 + idx * 0.32) * (boss ? 2 : 1)),
        heroXp: Math.round(45 * (1 + idx * 0.42) * (boss ? 1.6 : 1)),
        olXp: 12 + idx * 2,
        gearTier: Math.min(6, 1 + Math.floor(r * 5 / 7)),
        firstGems: boss ? 60 : 10,
        name: boss ? `${reg.name}: The Lair` : `${reg.name} ${n + 1}`,
    };
}

export function stageWaves(idx) {
    const info = stageInfo(idx);
    const rng = new Rng(hashStr('stage' + idx));
    const reg = info.region;
    const waves = [];
    const size = Math.min(5, 2 + Math.floor(idx / 10) + (info.n >= 4 ? 1 : 0));
    for (let w = 0; w < 3; w++) {
        const wave = [];
        const last = w === 2;
        if (last && info.boss) {
            wave.push({ boss: reg.boss, star: info.star, level: info.level, diff: info.diff });
            for (let i = 0; i < Math.min(2, size - 1); i++) wave.push({ species: rng.pick(reg.species), el: rng.pick(reg.elements), star: info.star, level: Math.max(1, info.level - 2), diff: info.diff });
        } else {
            const count = Math.max(1, size - (w === 0 ? 1 : 0));
            for (let i = 0; i < count; i++) {
                const elite = last && i === 0 && info.n >= 3;
                wave.push({ species: rng.pick(reg.species), el: rng.pick(reg.elements), star: info.star, level: Math.max(1, info.level - (w === 0 ? 2 : 1) + (elite ? 1 : 0)), diff: info.diff, elite });
            }
        }
        waves.push(wave);
    }
    return waves;
}

export function isStageUnlocked(S, idx) { return idx <= S.campaign.cleared && idx < TOTAL_STAGES; }

// ---------------------------------------------------------------- rifts

const RIFT_STAR = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6];
export function riftInfo(id, tier) {
    const R = RIFTS[id];
    const star = RIFT_STAR[tier - 1];
    const level = Math.round(MAX_LEVEL[star] * (0.35 + 0.6 * ((tier - 1) % 2 ? 1 : 0.4)));
    return { id, tier, def: R, star, level, diff: 1 + tier * 0.08, stamina: 6 + tier, name: `${R.name} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][tier - 1]}` };
}

export function riftWaves(id, tier) {
    const info = riftInfo(id, tier);
    const rng = new Rng(hashStr(`rift-${id}-${tier}`));
    const waves = [];
    for (let w = 0; w < 3; w++) {
        const wave = [];
        const n = Math.min(5, 2 + Math.floor(tier / 3) + (w === 2 ? 0 : 0));
        for (let i = 0; i < n; i++) {
            const el = info.def.element || rng.pick(ELEMENTS);
            wave.push({ species: rng.pick(info.def.species), el, star: info.star, level: info.level, diff: info.diff, elite: w === 2 && i === 0 });
        }
        waves.push(wave);
    }
    return waves;
}

export function isRiftUnlocked(S, id, tier) {
    if (S.campaign.cleared < 4) return false;
    return tier === 1 || (S.rifts.best[id] || 0) >= tier - 1;
}

// ---------------------------------------------------------------- spire

export function spireInfo(f) {
    const { star, level } = ladder(4 + (f - 1) * 1.7);
    const over = Math.max(0, f - 100);
    const boss = f % 10 === 0;
    return {
        floor: f, star, level, boss, diff: curveDiff(f) * Math.pow(1.05, over),
        tokens: 5 + Math.floor(f / 4) + (boss ? 20 : 0),
        gold: Math.round(200 * Math.pow(f, 1.25)),
        gems: boss ? 50 : 0,
        legend: f % 50 === 0,
    };
}

const SPIRE_BOSSES = ['thornmaw', 'pyrrhax', 'corallia', 'aurex', 'hollowking', 'rimefang', 'prisma', 'vaelzor'];
export function spireWaves(f) {
    const info = spireInfo(f);
    const rng = new Rng(hashStr('spire' + f));
    const pool = Object.keys(SPECIES);
    const wave = [];
    if (info.boss) {
        wave.push({ boss: SPIRE_BOSSES[(f / 10 - 1) % SPIRE_BOSSES.length], star: info.star, level: info.level, diff: info.diff, hpMult: 0.8 });
        for (let i = 0; i < 2; i++) wave.push({ species: rng.pick(pool), el: rng.pick(ELEMENTS), star: info.star, level: info.level, diff: info.diff });
    } else {
        const n = Math.min(5, 3 + Math.floor(f / 25));
        for (let i = 0; i < n; i++) wave.push({ species: rng.pick(pool), el: rng.pick(ELEMENTS), star: info.star, level: info.level, diff: info.diff, elite: f % 5 === 0 && i === 0 });
    }
    return [wave];
}

export function rollBlessings(S) {
    const rng = rngOf(S);
    const picks = rng.sample(BLESSINGS, 3);
    return picks.map((b) => {
        const rar = rng.weighted(BLESSING_RARITY.map((r, i) => [i, r.w]));
        return { id: b.id, key: b.key, rar, v: b.vals[rar] };
    });
}

export function blessingText(b) {
    const def = BLESSINGS.find((x) => x.id === b.id);
    const v = ['spd'].includes(b.key) ? b.v : Math.round(b.v * 100 * 10) / 10;
    return def.desc.replace('{v}', v);
}

// ---------------------------------------------------------------- arena

const RIVAL_NAMES = ['Morgrath', 'Lady Vex', 'Kaelthas', 'Seraphine', 'Dunmore', 'Ysolde', 'Grimwald', 'Nyx', 'Ashka', 'Thornell', 'Belladra', 'Orrin', 'Zephyrine', 'Halvard', 'Isolde', 'Corvin', 'Mirabel', 'Draven'];
const RIVAL_TITLES = ['the Cruel', 'of the Ninth Sigil', 'Stormcaller', 'the Gilded', 'Spirewalker', 'the Patient', 'Bonelord', 'the Radiant', 'Ironqueen', 'of Ashes'];

export function arenaRank(points) {
    let r = ARENA_RANKS[0];
    for (const x of ARENA_RANKS) if (points >= x.min) r = x;
    return r;
}

export function teamPower(S, ids) {
    const gl = gearLookup(S);
    return ids.map((id) => heroById(S, id)).filter(Boolean).reduce((s, h) => s + heroPower(h, { gearOf: gl, talents: S.overlord.talents }), 0);
}

export function bestTeam(S, n = 5) {
    const gl = gearLookup(S);
    return S.heroes.map((h) => ({ h, p: heroPower(h, { gearOf: gl, talents: S.overlord.talents }) })).sort((a, b) => b.p - a.p).slice(0, n).map((x) => x.h);
}

export function ensureRivals(S, force = false) {
    const day = dayKey();
    if (!force && S.arena.rivalsDay === day && S.arena.rivals.length) return S.arena.rivals;
    const rng = rngOf(S);
    const top = bestTeam(S, 5);
    const avgStar = top.length ? top.reduce((s, h) => s + h.star, 0) / top.length : 2;
    const avgLvl = top.length ? top.reduce((s, h) => s + h.level / MAX_LEVEL[h.star], 0) / top.length : 0.3;
    const rivals = [];
    for (let i = 0; i < 5; i++) {
        const tier = [-1, 0, 0, 0.5, 1][i];
        const star = Math.max(1, Math.min(6, Math.round(avgStar + tier * 0.6 + rng.range(-0.3, 0.3))));
        const level = Math.max(1, Math.min(MAX_LEVEL[star], Math.round(MAX_LEVEL[star] * Math.min(1, avgLvl + rng.range(-0.15, 0.2)))));
        const n = Math.min(5, Math.max(3, top.length));
        const team = [];
        for (let k = 0; k < n; k++) team.push({ seed: rng.seed(), rarity: Math.max(1, Math.min(5, star - (rng.chance(0.5) ? 1 : 0))), star, level });
        const race = rng.pick(RACE_IDS);
        const look = generateLook(rng, race, rng.pick(['warlock', 'knight', 'mage', 'paladin']), rng.pick(ELEMENTS), 5);
        look.cape = 2; look.headwear = rng.pick(['crown', 'circlet', 'helm', 'horns']);
        rivals.push({
            id: i, name: `${rng.pick(RIVAL_NAMES)} ${rng.pick(RIVAL_TITLES)}`, look, team,
            diff: 1.05 + 0.07 * star + tier * 0.08, points: Math.round(S.arena.points + tier * 80 + rng.int(-40, 40)), beaten: false,
        });
    }
    S.arena.rivals = rivals;
    S.arena.rivalsDay = day;
    return rivals;
}

export function rivalPower(rival) {
    let p = 0;
    for (const m of rival.team) {
        const u = rivalHeroUnit(m.seed, m.rarity, m.star, m.level, rival.diff);
        p += u.st.hp / 7 + u.st.atk * 1.7 + u.st.def * 1.3 + u.st.spd * 14 + u.st.cr * 450 + u.st.cd * 260;
    }
    return Math.round(p);
}

// ---------------------------------------------------------------- battle configs

/**
 * mode: 'campaign' {idx} | 'rift' {id, tier} | 'spire' {floor} | 'arena' {rival} | 'demo'
 */
export function buildBattle(S, mode, params, heroIds) {
    const heroes = heroIds.map((id) => heroById(S, id)).filter(Boolean);
    const extras = teamExtras(S, heroes, mode, now());
    const allies = heroes.map((h, i) => heroUnit(S, h, extras[i]));
    const seedBase = hashStr(`${mode}:${JSON.stringify(params)}:${S.counters.battles || 0}:${S.seed}`);
    const rng = new Rng(seedBase);
    let recipes;
    if (mode === 'campaign') recipes = stageWaves(params.idx);
    else if (mode === 'rift') recipes = riftWaves(params.id, params.tier);
    else if (mode === 'spire') recipes = spireWaves(params.floor);
    let waves;
    if (mode === 'arena') {
        const rival = S.arena.rivals[params.rival];
        waves = [rival.team.map((m) => rivalHeroUnit(m.seed, m.rarity, m.star, m.level, rival.diff))];
    } else waves = recipes.map((w) => w.map((r) => enemyUnit(rng, r)));
    const mods = {};
    if (mode === 'spire') {
        for (const b of S.spire.blessings) {
            if (b.key === 'openAtb') mods.openAtb = (mods.openAtb || 0) + b.v;
            if (b.key === 'regen') mods.regen = (mods.regen || 0) + b.v;
            if (b.key === 'bossDmg') mods.bossDmg = (mods.bossDmg || 0) + b.v;
            if (b.key === 'lifesteal') mods.lifesteal = (mods.lifesteal || 0) + b.v;
            if (b.key === 'mana') mods.manaGain = (mods.manaGain || 0) + b.v;
        }
    }
    return {
        seed: seedBase, allies, waves, mods,
        spells: mode === 'arena' ? S.overlord.spells.filter(Boolean) : S.overlord.spells.filter(Boolean),
        spellPower: spellPower(S),
    };
}

export function staminaCost(mode, params) {
    if (mode === 'campaign') return stageInfo(params.idx).stamina;
    if (mode === 'rift') return riftInfo(params.id, params.tier).stamina;
    return 0;
}

// ---------------------------------------------------------------- rewards

function goldMult(S, heroes, t) {
    let m = 1 + fortune(S) * 0.04;
    m += heroes.filter((h) => h.traits.includes('lucky')).length * 0.1;
    if (S.buffs.gold && S.buffs.gold > t) m += 0.25;
    return m;
}
function dropBonus(S, heroes) { return fortune(S) * 0.01 + heroes.filter((h) => h.traits.includes('lucky')).length * 0.05; }
function xpMult(S, t) { return S.buffs.xp && S.buffs.xp > t ? 1.25 : 1; }

/**
 * result: { win, deaths, hpFrac } — applies everything and returns a summary:
 * { stars, first, items: [grant list], heroXp: [{id, xp, levels}], progress }
 */
export function finishBattle(S, mode, params, heroIds, result) {
    const t = now();
    const rng = rngOf(S);
    const heroes = heroIds.map((id) => heroById(S, id)).filter(Boolean);
    bump(S, 'battles');
    const summary = { win: result.win, stars: 0, first: false, items: [], heroXp: [], mode, params };
    if (!result.win) {
        // a consolation: a little XP so a loss is never wasted
        if (mode === 'campaign') {
            const info = stageInfo(params.idx);
            for (const h of heroes) { const lv = addXp(h, info.heroXp * 0.25); summary.heroXp.push({ id: h.id, xp: Math.round(info.heroXp * 0.25), levels: lv }); if (lv) bump(S, 'levelUps', lv); }
        }
        if (mode === 'arena') {
            S.arena.points = Math.max(0, S.arena.points - 12);
            S.arena.losses++;
            summary.items = grant(S, { arenaTokens: 3 });
            bump(S, 'arenaFights');
        }
        return summary;
    }
    bump(S, 'wins');
    const gm = goldMult(S, heroes, t), xm = xpMult(S, t), db = dropBonus(S, heroes);
    const b = { gold: 0, xp: 0 };
    let heroXp = 0;

    if (mode === 'campaign') {
        const info = stageInfo(params.idx);
        const key = String(params.idx);
        const prev = S.campaign.stars[key] || 0;
        const stars = 1 + (result.deaths === 0 ? 1 : 0) + (result.hpFrac >= 0.5 ? 1 : 0);
        summary.stars = stars;
        S.campaign.stars[key] = Math.max(prev, stars);
        if (!prev) {
            summary.first = true;
            b.gems = info.firstGems;
            if (info.boss) b.sigils = { mystic: 1 };
            if (params.idx === S.campaign.cleared) S.campaign.cleared = Math.min(TOTAL_STAGES, params.idx + 1);
        }
        b.gold = Math.round(info.gold * gm);
        b.xp = Math.round(info.olXp * xm);
        heroXp = info.heroXp;
        if (rng.chance(0.38 + db)) b.gear = [generateGear(rng, { tier: info.gearTier, rarityBias: info.boss ? 1 : 0 })];
        if (rng.chance(0.35 + db)) b.shards = rng.int(1, 3);
        if (rng.chance(0.25 + db)) b.essences = { [rng.pick(info.region.elements)]: { lo: rng.int(1, 2) } };
        if (rng.chance(0.08)) b.sigils = { ...(b.sigils || {}), common: 1 };
        if (rng.chance(0.12)) b.seeds = { [rng.pick(['wheat', 'carrot', 'pumpkin', 'sunberry'])]: rng.int(1, 3) };
        bump(S, 'stagesCleared');
        maxCounter(S, 'campaignBest', S.campaign.cleared);
    } else if (mode === 'rift') {
        const info = riftInfo(params.id, params.tier);
        const T = params.tier;
        if ((S.rifts.best[params.id] || 0) < T) { S.rifts.best[params.id] = T; summary.first = true; b.gems = 20 + T * 5; }
        b.xp = Math.round((15 + T * 8) * xm);
        heroXp = 60 + T * 70;
        if (info.def.kind === 'essence') {
            const el = info.def.element;
            b.essences = { [el]: { lo: rng.int(2, 3) + Math.floor(T / 2), mid: T >= 4 ? rng.int(1, 2) + Math.floor((T - 4) / 2) : 0, hi: T >= 7 ? rng.int(0, 1) + Math.floor((T - 6) / 2) : 0 } };
            b.gold = Math.round(300 * T * gm);
        } else if (info.def.kind === 'gold') {
            b.gold = Math.round(1500 * Math.pow(T, 1.5) * gm);
        } else {
            const tier = Math.min(6, 1 + Math.ceil(T / 2));
            b.gear = [generateGear(rng, { tier, rarityBias: Math.floor(T / 3) })];
            if (rng.chance(0.5 + db)) b.gear.push(generateGear(rng, { tier, rarityBias: Math.floor(T / 3) }));
            b.gold = Math.round(400 * T * gm);
        }
        if (rng.chance(0.12)) b.tomes = 1;
        bump(S, 'riftClears');
    } else if (mode === 'spire') {
        const f = params.floor;
        const info = spireInfo(f);
        b.spireTokens = info.tokens;
        b.gold = Math.round(info.gold * gm);
        b.xp = Math.round((20 + f * 3) * xm);
        heroXp = 80 + f * 30;
        if (info.gems) b.gems = info.gems;
        if (info.legend) b.sigils = { legend: 1 };
        else if (info.boss) b.sigils = { mystic: 1 };
        if (rng.chance(0.25 + db)) b.gear = [generateGear(rng, { tier: Math.min(6, 1 + Math.floor(f / 12)), rarityBias: info.boss ? 2 : 0 })];
        S.spire.floor = f + 1;
        S.spire.best = Math.max(S.spire.best, f);
        if (f % 5 === 0) S.spire.offer = rollBlessings(S);
        maxCounter(S, 'spireBest', S.spire.best);
        bump(S, 'spireFloors');
    } else if (mode === 'arena') {
        const rival = S.arena.rivals[params.rival];
        const gain = 18 + Math.max(0, Math.round((rival.points - S.arena.points) / 20));
        S.arena.points += gain;
        S.arena.wins++;
        rival.beaten = true;
        b.arenaTokens = 12 + Math.floor(gain / 3);
        b.gold = Math.round(1200 * gm);
        b.xp = Math.round(25 * xm);
        heroXp = 150;
        summary.points = gain;
        bump(S, 'arenaWins');
        bump(S, 'arenaFights');
    }
    summary.items = grant(S, b);
    if (heroXp) {
        for (const h of heroes) {
            const v = Math.round(heroXp * xm);
            const lv = addXp(h, v);
            summary.heroXp.push({ id: h.id, xp: v, levels: lv });
            if (lv) bump(S, 'levelUps', lv);
        }
    }
    return summary;
}
