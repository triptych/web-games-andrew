/**
 * waves.js — procedural wave composition and spawn schedule.
 *
 * A wave spends a budget (growing with the wave number) on the region's
 * roster, introduced one archetype per wave. Monsters arrive in 3–4 groups
 * with lulls between them, then a dense final horde (the last flag on the
 * progress bar). Boss waves spend half the budget on escorts.
 *
 * Pure: no three.js, no DOM, no Math.random.
 */

import { makeRng, hashSeed } from './rng.js';
import {
    ARCH, REGIONS, AFFIXES, activeLanes, regionIndex, localWave, isBossWave, isLongNight, waveBudget,
} from '../config.js';

const WEIGHT = {
    grunt: 10, runner: 5, shield: 4, ranged: 4, flyer: 4, sapper: 3, shaman: 2.2,
    leaper: 4, burrower: 3, splitter: 3, brute: 2.2, siege: 1.6,
};
const AFFIX_KEYS = Object.keys(AFFIXES);

/** How many of the region's roster are in play on this wave. */
export function rosterCount(wave) {
    const ri = regionIndex(wave), L = localWave(wave), n = REGIONS[ri].roster.length;
    if (isLongNight(wave)) return n;
    if (wave <= 10) return Math.min(n, Math.ceil(L * 0.8));
    return Math.min(n, L + 1);
}

/** Archetypes making their first appearance this wave (for the "New foe" card). */
export function newFoes(wave) {
    if (isLongNight(wave)) return [];
    const roster = REGIONS[regionIndex(wave)].roster;
    const now = rosterCount(wave);
    const before = localWave(wave) === 1 ? 0 : rosterCount(wave - 1);
    return roster.slice(before, now).map(([a]) => a);
}

/**
 * @returns {{ wave, region, lanes, entries: {t, arch, lane, elite, boss?}[], flags: number[], duration, boss, newFoes, treasure }}
 */
export function genWave(seed, wave, opts = {}) {
    const rng = makeRng(hashSeed(seed, wave, 0xa11));
    const ri = regionIndex(wave);
    const region = REGIONS[ri];
    const lanes = activeLanes(wave);
    const boss = isBossWave(wave);
    const count = rosterCount(wave);
    const avail = region.roster.slice(0, count).map(([a]) => a);
    const fresh = newFoes(wave);
    let budget = waveBudget(wave) * (opts.budgetMul ?? 1);
    if (isLongNight(wave)) budget *= 1.1;

    // Lane picker: a shuffled bag so lanes stay evenly loaded.
    let bag = [];
    const nextLane = () => { if (!bag.length) bag = rng.shuffle(lanes.slice()); return bag.pop(); };

    const pickArch = (left) => {
        const w = {};
        for (const a of avail) {
            if (ARCH[a].cost > left + 0.01) continue;
            if ((a === 'brute' || a === 'siege') && ARCH[a].cost * 2.5 > budget) continue;
            w[a] = WEIGHT[a] * (fresh.includes(a) ? 2 : 1);
        }
        const keys = Object.keys(w);
        if (!keys.length) return null;
        return rng.weighted(w);
    };

    const eliteChance = wave < 5 ? 0 : Math.min(0.3, 0.012 * (wave - 4));
    const rollElite = (arch) => {
        if (arch === 'treasure' || !rng.chance(eliteChance)) return null;
        const n = wave > 30 && rng.chance(0.3) ? 2 : 1;
        const pool = AFFIX_KEYS.filter((k) => !(arch === 'brute' && k === 'giant') && !(arch === 'sapper' && k === 'explosive'));
        return rng.shuffle(pool.slice()).slice(0, n);
    };

    const entries = [];
    const flags = [];
    // Make sure each new foe actually shows up (twice) early in the wave.
    const forced = [];
    for (const a of fresh) if (ARCH[a].cost * 2 <= budget) forced.push(a, a);

    const groups = boss ? 2 : (wave >= 20 ? 4 : 3);
    const hordeShare = boss ? 0 : 0.36;
    const groupBudget = (budget * (1 - hordeShare) * (boss ? 0.5 : 1)) / groups;
    let t = 4;
    const fill = (b, start, dur, dense) => {
        let left = b;
        const list = [];
        while (forced.length && left >= ARCH[forced[0]].cost) { const a = forced.shift(); list.push(a); left -= ARCH[a].cost; }
        for (let guard = 0; guard < 400 && left > 0.9; guard++) {
            const a = pickArch(left);
            if (!a) break;
            list.push(a); left -= ARCH[a].cost;
        }
        rng.shuffle(list);
        // Heavy hitters arrive first in a group so the rest shelter behind them.
        list.sort((a, b2) => (ARCH[b2].cost >= 5) - (ARCH[a].cost >= 5));
        const n = list.length;
        list.forEach((a, i) => {
            const tt = start + (n <= 1 ? 0 : (i / (n - 1)) * dur) + rng.range(-0.4, 0.4) * (dense ? 0.4 : 1);
            entries.push({ t: Math.max(0.5, tt), arch: a, lane: nextLane(), elite: rollElite(a) });
        });
        return n;
    };

    for (let g = 0; g < groups; g++) {
        const dur = 8 + Math.min(8, wave * 0.18) + rng.range(-1, 1);
        fill(groupBudget, t, dur, false);
        t += dur + 9 + rng.range(-2, 2);
    }
    if (boss) {
        flags.push(t);
        entries.push({ t, arch: 'boss', lane: 2, elite: null, boss: region.boss.kind });
        fill(budget * 0.25, t + 6, 26, false);
        t += 32;
    } else {
        flags.push(t);
        const dur = 9 + Math.min(6, wave * 0.1);
        fill(budget * hordeShare, t, dur, true);
        t += dur;
    }

    // Treasure carrier somewhere in the middle of the wave.
    let treasure = false;
    if (wave >= 3 && (opts.treasureSense || rng.chance(0.3))) {
        treasure = true;
        entries.push({ t: rng.range(10, Math.max(12, t * 0.6)), arch: 'treasure', lane: rng.pick(lanes), elite: null });
    }

    entries.sort((a, b) => a.t - b.t);
    return {
        wave, regionIdx: ri, region: region.id, lanes, entries, flags,
        duration: t, boss: boss ? region.boss.kind : null, newFoes: fresh, treasure,
        archs: [...new Set(entries.map((e) => e.arch))],
    };
}
