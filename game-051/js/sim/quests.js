/**
 * quests.js — dailies, weeklies, the main questline and achievements.
 *
 * Progress is read from S.counters: when a quest is handed out it remembers
 * the counter's value, so nothing else in the sim has to know about quests.
 */

import { dayKey, weekKey } from '../core/time.js';
import { MAX_LEVEL } from '../data/core.js';
import { grant, counter, rngOf } from './state.js';

export const DAILY_POOL = [
    { id: 'summon',  key: 'summons',      n: 3,  text: 'Summon {n} heroes' },
    { id: 'win',     key: 'wins',         n: 6,  text: 'Win {n} battles' },
    { id: 'stage',   key: 'stagesCleared', n: 4, text: 'Clear {n} campaign stages' },
    { id: 'spire',   key: 'spireFloors',  n: 1,  text: 'Climb {n} Spire floor{s}' },
    { id: 'arena',   key: 'arenaFights',  n: 2,  text: 'Fight {n} Arena battles' },
    { id: 'rift',    key: 'riftClears',   n: 2,  text: 'Clear {n} Rift battles' },
    { id: 'enhance', key: 'enhances',     n: 4,  text: 'Enhance gear {n} times' },
    { id: 'level',   key: 'levelUps',     n: 5,  text: 'Gain {n} hero levels' },
    { id: 'harvest', key: 'harvests',     n: 4,  text: 'Harvest {n} crops' },
    { id: 'mine',    key: 'blocks',       n: 20, text: 'Break {n} blocks in the Mine' },
    { id: 'cook',    key: 'cooks',        n: 1,  text: 'Cook {n} meal{s}' },
    { id: 'exped',   key: 'expeditions',  n: 2,  text: 'Send {n} expeditions' },
    { id: 'collect', key: 'treasury',     n: 1,  text: 'Collect the Treasury' },
    { id: 'wheel',   key: 'wheelSpins',   n: 1,  text: 'Spin the Fortune Wheel' },
    { id: 'spell',   key: 'spellsCast',   n: 4,  text: 'Cast {n} Overlord spells' },
    { id: 'water',   key: 'waters',       n: 3,  text: 'Water crops {n} times' },
];
export const DAILY_COUNT = 6;
export const DAILY_PTS = 20;
export const DAILY_CHESTS = [
    { at: 40, reward: { gold: 3000, items: { xpM: 1 } } },
    { at: 80, reward: { gems: 30, sigils: { common: 2 } } },
    { at: 120, reward: { gems: 50, sigils: { mystic: 1 } } },
];
export const WEEKLY_CHESTS = [
    { at: 60, reward: { gems: 80, items: { xpL: 1 } } },
    { at: 120, reward: { gems: 150, sigils: { mystic: 3 } } },
    { at: 160, reward: { gems: 200, sigils: { ld: 1 }, tomes: 2 } },
];

const dailyReward = (q) => ({ gold: 1500, xp: 30 });

export function ensureQuests(S) {
    const Q = S.quests;
    const d = dayKey();
    if (Q.day !== d) {
        const rng = rngOf(S);
        Q.day = d;
        Q.daily = rng.sample(DAILY_POOL, DAILY_COUNT).map((q) => ({ id: q.id, base: counter(S, q.key), claimed: false }));
        Q.dailyPts = 0;
        Q.dailyChests = [];
    }
    const w = weekKey();
    if (Q.week !== w) {
        const rng = rngOf(S);
        Q.week = w;
        Q.weekly = rng.sample(DAILY_POOL.filter((q) => q.id !== 'collect' && q.id !== 'wheel'), 8).map((q) => ({ id: q.id, base: counter(S, q.key), claimed: false }));
        Q.weeklyPts = 0;
        Q.weeklyChests = [];
    }
}

const def = (id) => DAILY_POOL.find((q) => q.id === id);

export function questView(S, q, weekly = false) {
    const D = def(q.id);
    const target = weekly ? D.n * 5 : D.n;
    const prog = Math.min(target, counter(S, D.key) - q.base);
    const text = D.text.replace('{n}', target).replace('{s}', target === 1 ? '' : 's');
    return { ...q, text, target, prog, done: prog >= target };
}

export function claimQuest(S, idx, weekly = false) {
    const Q = S.quests;
    const list = weekly ? Q.weekly : Q.daily;
    const q = list[idx];
    if (!q || q.claimed) return null;
    const v = questView(S, q, weekly);
    if (!v.done) return null;
    q.claimed = true;
    if (weekly) Q.weeklyPts += 20; else Q.dailyPts += DAILY_PTS;
    return grant(S, weekly ? { gold: 6000, gems: 10, xp: 120 } : dailyReward(q));
}

export function claimChest(S, i, weekly = false) {
    const Q = S.quests;
    const chests = weekly ? WEEKLY_CHESTS : DAILY_CHESTS;
    const got = weekly ? Q.weeklyChests : Q.dailyChests;
    const pts = weekly ? Q.weeklyPts : Q.dailyPts;
    if (!chests[i] || got.includes(i) || pts < chests[i].at) return null;
    got.push(i);
    return grant(S, chests[i].reward);
}

// ---------------------------------------------------------------- main questline

const M = (text, check, reward, hint) => ({ text, check, reward, hint });
export const MAIN_QUESTS = [
    M('Summon your first hero', (S) => counter(S, 'summons') >= 1, { sigils: { mystic: 2 } }, 'summon'),
    M('Clear stage 1-1', (S) => S.campaign.cleared >= 1, { gold: 2000, items: { xpS: 3 } }, 'adventure'),
    M('Field a team of 4 heroes', (S) => S.teams.main.length >= 4, { sigils: { common: 5 } }, 'team'),
    M('Use an XP Elixir on a hero', (S) => counter(S, 'elixirs') >= 1, { gems: 50 }, 'heroes'),
    M('Equip a Sigilstone', (S) => counter(S, 'equips') >= 1, { gold: 3000 }, 'heroes'),
    M('Collect the Treasury', (S) => counter(S, 'treasury') >= 1, { gems: 30 }, 'treasury'),
    M('Plant a seed on the Farm', (S) => counter(S, 'plants') >= 1, { seeds: { pumpkin: 2 } }, 'farm'),
    M('Break 10 blocks in the Mine', (S) => counter(S, 'blocks') >= 10, { ores: { copper: 20 } }, 'mine'),
    M('Clear stage 1-4', (S) => S.campaign.cleared >= 4, { sigils: { mystic: 1 } }, 'adventure'),
    M('Enhance a Sigilstone to +3', (S) => counter(S, 'gearBest') >= 3, { gold: 5000 }, 'forge'),
    M('Spin the Fortune Wheel', (S) => counter(S, 'wheelSpins') >= 1, { gems: 30 }, 'market'),
    M('Defeat Thornmaw (stage 1-8)', (S) => S.campaign.cleared >= 8, { gems: 100, sigils: { mystic: 1 } }, 'adventure'),
    M('Climb to Spire floor 3', (S) => S.spire.best >= 3, { spireTokens: 50 }, 'spire'),
    M('Send an expedition', (S) => counter(S, 'expeditions') >= 1, { gems: 30 }, 'tavern'),
    M('Cook a meal in the Kitchen', (S) => counter(S, 'cooks') >= 1, { items: { xpM: 2 } }, 'kitchen'),
    M('Evolve a hero', (S) => counter(S, 'evolves') >= 1, { gems: 80 }, 'heroes'),
    M('Fight in the Arena', (S) => counter(S, 'arenaFights') >= 1, { arenaTokens: 50 }, 'arena'),
    M('Clear any Rift', (S) => counter(S, 'riftClears') >= 1, { essences: { fire: { lo: 5 }, water: { lo: 5 }, wind: { lo: 5 } } }, 'rifts'),
    M('Reach Overlord level 5', (S) => S.overlord.level >= 5, { gems: 60 }, 'overlord'),
    M('Upgrade a building', (S) => counter(S, 'buildingUps') >= 1, { gold: 8000 }, 'citadel'),
    M('Clear stage 2-8', (S) => S.campaign.cleared >= 16, { gems: 150, sigils: { mystic: 2 } }, 'adventure'),
    M('Craft a Sigilstone at the Forge', (S) => counter(S, 'crafts') >= 1, { jewels: { topaz: 2 } }, 'forge'),
    M('Awaken a hero', (S) => counter(S, 'awakens') >= 1, { gems: 100 }, 'heroes'),
    M('Climb to Spire floor 10', (S) => S.spire.best >= 10, { sigils: { ld: 1 } }, 'spire'),
    M('Clear stage 3-8', (S) => S.campaign.cleared >= 24, { gems: 200 }, 'adventure'),
    M('Own a 5★ hero', (S) => S.heroes.some((h) => h.star >= 5), { tomes: 3 }, 'heroes'),
    M('Reach Overlord level 15', (S) => S.overlord.level >= 15, { gems: 150 }, 'overlord'),
    M('Clear stage 4-8', (S) => S.campaign.cleared >= 32, { sigils: { legend: 1 } }, 'adventure'),
    M('Climb to Spire floor 25', (S) => S.spire.best >= 25, { gems: 300 }, 'spire'),
    M('Clear stage 6-8', (S) => S.campaign.cleared >= 48, { gems: 400, sigils: { ld: 2 } }, 'adventure'),
    M('Defeat Vael\'zor the Usurper (stage 8-8)', (S) => S.campaign.cleared >= 64, { gems: 1000, sigils: { legend: 2 } }, 'adventure'),
];

export function mainQuest(S) {
    const q = MAIN_QUESTS[S.quests.main];
    if (!q) return null;
    return { idx: S.quests.main, text: q.text, done: q.check(S), reward: q.reward, hint: q.hint };
}

export function claimMain(S) {
    const q = mainQuest(S);
    if (!q || !q.done) return null;
    S.quests.main++;
    return grant(S, q.reward);
}

// ---------------------------------------------------------------- achievements

const A = (id, name, key, tiers, gems, title) => ({ id, name, key, tiers, gems, title });
export const ACHIEVEMENTS = [
    A('summoner', 'Summoner', 'summons', [10, 50, 200, 1000], [30, 80, 200, 500], 'Sigil Adept'),
    A('victor', 'Victor', 'wins', [10, 100, 500, 2000], [20, 60, 150, 400]),
    A('conqueror', 'Conqueror', 'campaignBest', [8, 24, 40, 64], [50, 120, 250, 600], 'Throne Reclaimer'),
    A('climber', 'Climber', 'spireBest', [10, 25, 50, 100], [50, 120, 300, 800], 'Spirebreaker'),
    A('legend', 'Legend Seeker', 'fiveStars', [1, 5, 20], [50, 200, 600], 'Mythmaker'),
    A('smith', 'Master Smith', 'gear15', [1, 5, 20], [60, 200, 500]),
    A('farmer', 'Harvester', 'harvests', [20, 100, 500], [30, 100, 300], 'Harvest Lord'),
    A('delver', 'Delver', 'blocks', [100, 1000, 5000], [30, 120, 400], 'Master Delver'),
    A('evolver', 'Evolver', 'evolves', [1, 10, 50], [40, 150, 400]),
    A('awakener', 'Awakener', 'awakens', [1, 5, 25], [40, 150, 400]),
    A('gladiator', 'Gladiator', 'arenaWins', [10, 100, 500], [40, 150, 500], 'Arena Tyrant'),
    A('explorer', 'Explorer', 'expeditionWins', [10, 50, 200], [30, 120, 400]),
    A('radiant', 'Radiant Collector', 'radiants', [1, 3, 10], [100, 300, 1000], 'Radiant Collector'),
    A('hoarder', 'Hoarder', 'goldEarned', [100000, 1000000, 10000000], [30, 100, 300], 'Hoardkeeper'),
    A('chef', 'Chef', 'cooks', [5, 30, 150], [20, 80, 250]),
];

export function achievementView(S, a) {
    const tier = S.quests.ach[a.id] || 0;
    const v = counter(S, a.key);
    const next = a.tiers[tier];
    return { ...a, tier, value: v, next, done: next !== undefined && v >= next, maxed: next === undefined };
}

export function claimAchievement(S, id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    const v = achievementView(S, a);
    if (!v.done) return null;
    S.quests.ach[id] = v.tier + 1;
    if (a.title && v.tier + 1 === a.tiers.length && !S.overlord.titles.includes(a.title)) S.overlord.titles.push(a.title);
    return grant(S, { gems: a.gems[v.tier] });
}

/** Counts used for the red badges. */
export function questBadges(S) {
    ensureQuests(S);
    let n = 0;
    S.quests.daily.forEach((q) => { if (!q.claimed && questView(S, q).done) n++; });
    S.quests.weekly.forEach((q) => { if (!q.claimed && questView(S, q, true).done) n++; });
    DAILY_CHESTS.forEach((c, i) => { if (S.quests.dailyPts >= c.at && !S.quests.dailyChests.includes(i)) n++; });
    WEEKLY_CHESTS.forEach((c, i) => { if (S.quests.weeklyPts >= c.at && !S.quests.weeklyChests.includes(i)) n++; });
    for (const a of ACHIEVEMENTS) if (achievementView(S, a).done) n++;
    const m = mainQuest(S);
    if (m && m.done) n++;
    return n;
}

export { MAX_LEVEL };
