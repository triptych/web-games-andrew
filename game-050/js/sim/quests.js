/**
 * quests.js — procedural quests for the notice board / Guild Hall.
 *
 * A quest counts a profile counter (profile.counters, dotted key) from a baseline taken
 * when the quest is posted, so progress made before the quest existed never counts.
 * Bounties are the exception: they spawn a named elite you hunt from the quest itself.
 */

import { GEM_INFO, POTIONS } from './data.js';
import { FAMILIES } from './monsters.js';
import { WINGS } from './regions.js';
import { BUILDINGS, bLevel } from './town.js';

export function counter(profile, key) {
    let v = profile.counters;
    for (const k of key.split('.')) v = v?.[k];
    return v || 0;
}
export function bump(profile, key, n = 1) {
    const parts = key.split('.');
    let o = profile.counters;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] || (o[parts[i]] = {});
    o[parts[parts.length - 1]] = (o[parts[parts.length - 1]] || 0) + n;
}

export function questProgress(profile, q) {
    if (q.kind === 'bounty') return q.done ? 1 : 0;
    return Math.min(q.target, counter(profile, q.key) - q.base);
}
export function questDone(profile, q) { return questProgress(profile, q) >= q.target; }

const FAMILY_ICON = { slime: '🟢', sprite: '🧚', imp: '😈', crab: '🦀', eel: '🐍', wisp: '🔥', gargoyle: '🗿', golem: '🤖', mimic: '📕', mushroom: '🍄', specter: '👻', drake: '🐉', owlbear: '🦉', inkling: '🖤' };

/** Families the player can currently meet (unlocked wings). */
function knownFamilies(profile) {
    const set = new Set();
    for (let i = 0; i <= Math.min(profile.wingOpen, 5); i++) for (const f of WINGS[i].bestiary) set.add(f);
    return [...set];
}

export function makeQuest(profile, rng) {
    const L = profile.level;
    const mult = 1 + 0.12 * bLevel(profile, 'guild');
    const kinds = [['slay', 22], ['gems', 16], ['fours', 9], ['cascades', 9], ['spells', 9], ['wins', 8], ['flawless', 5], ['bounty', 10]];
    const producers = Object.keys(profile.town).filter((id) => BUILDINGS[id].res && BUILDINGS[id].res !== 'xp');
    if (producers.length) kinds.push(['collect', 14]);
    if (Object.keys(profile.town).length) kinds.push(['upgrade', 8]);
    if (bLevel(profile, 'alchemist')) kinds.push(['potions', 6]);
    const kind = rng.weighted(kinds);
    const q = { id: profile.quests.nextId++, kind, target: 1, key: '', base: 0, icon: '📜', title: '', desc: '' };
    switch (kind) {
        case 'slay': {
            const f = rng.pick(knownFamilies(profile));
            q.target = rng.int(3, 5); q.key = `kills.${f}`; q.icon = FAMILY_ICON[f];
            q.title = `${FAMILIES[f].name} Trouble`; q.desc = `Defeat ${q.target} ${FAMILIES[f].name}s.`;
            break;
        }
        case 'gems': {
            const i = rng.int(0, 6);
            q.target = 10 * rng.int(6, 14); q.key = `gems.${i}`; q.icon = GEM_INFO[i].icon;
            q.title = `${GEM_INFO[i].name} Collector`; q.desc = `Match ${q.target} ${GEM_INFO[i].name} gems.`;
            break;
        }
        case 'fours': q.target = rng.int(4, 9); q.key = 'fours'; q.icon = '✨'; q.title = 'Big Matches'; q.desc = `Make ${q.target} matches of 4 or more.`; break;
        case 'cascades': q.target = 5 * rng.int(3, 7); q.key = 'cascades'; q.icon = '🌊'; q.title = 'Chain Reaction'; q.desc = `Trigger ${q.target} cascades.`; break;
        case 'spells': q.target = rng.int(6, 12); q.key = 'spells'; q.icon = '🪄'; q.title = 'Practice Makes Magic'; q.desc = `Cast ${q.target} spells or abilities.`; break;
        case 'wins': q.target = rng.int(3, 6); q.key = 'wins'; q.icon = '🏆'; q.title = 'Clear the Stacks'; q.desc = `Win ${q.target} battles.`; break;
        case 'flawless': q.target = rng.int(1, 3); q.key = 'flawless'; q.icon = '💖'; q.title = 'Barely a Scratch'; q.desc = `Win ${q.target} battle${q.target > 1 ? 's' : ''} with at least 70% HP left.`; break;
        case 'potions': q.target = rng.int(2, 4); q.key = 'potions'; q.icon = '🧪'; q.title = 'Taste Test'; q.desc = `Drink ${q.target} potions in battle.`; break;
        case 'upgrade': q.target = rng.int(1, 3); q.key = 'upgrades'; q.icon = '🔨'; q.title = 'Town Improvements'; q.desc = `Build or upgrade ${q.target} building${q.target > 1 ? 's' : ''}.`; break;
        case 'collect': {
            const id = rng.pick(producers);
            const res = BUILDINGS[id].res;
            q.target = Math.max(20, Math.round((40 + L * 18) * rng.range(0.8, 1.3) / 10) * 10);
            q.key = `collected.${res}`; q.icon = BUILDINGS[id].icon;
            q.title = `Stock Up: ${res[0].toUpperCase() + res.slice(1)}`; q.desc = `Collect ${q.target} ${res} from your buildings.`;
            break;
        }
        case 'bounty': {
            const fams = knownFamilies(profile);
            const f = rng.pick(fams);
            q.target = 1; q.icon = '🎯';
            q.bounty = { family: f, level: Math.max(1, Math.min(L + 1, 40)), seed: rng.int(1, 1e9) };
            q.title = 'Wanted!'; q.desc = `Hunt a notorious ${FAMILIES[f].name} (level ${q.bounty.level}).`;
            break;
        }
        default: break;
    }
    q.base = q.key ? counter(profile, q.key) : 0;
    // Rewards
    const gold = Math.round((30 + L * 16) * mult * (kind === 'bounty' ? 1.6 : 1) * rng.range(0.9, 1.15));
    const xp = Math.round((8 + L * 3.5 + L * L * 0.16) * mult * (kind === 'bounty' ? 1.5 : 1));
    q.reward = { gold, xp };
    const extra = rng.weighted([['res', 40], ['item', 25], ['potion', bLevel(profile, 'alchemist') ? 20 : 0], ['crystal', profile.level >= 8 ? 15 : 0]]);
    if (extra === 'res') {
        const r = rng.pick(['wood', 'stone', ...(profile.town.herbs ? ['herbs'] : [])]);
        q.reward[r] = Math.round((40 + L * 14) * mult);
    } else if (extra === 'item') q.reward.item = true;
    else if (extra === 'potion') q.reward.potion = rng.pick(Object.keys(POTIONS).filter((id) => POTIONS[id].alch <= Math.max(1, bLevel(profile, 'alchemist'))));
    else if (extra === 'crystal') q.reward.crystal = Math.round((10 + L * 2) * mult);
    return q;
}

