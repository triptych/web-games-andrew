// ============================================================
// The save-able game state (plain JSON) and calendar helpers.
// ============================================================

import { STARTING_RECIPES } from '../data/recipes.js';
import { DAYS_PER_SEASON, SEASONS } from '../data/crops.js';

export const SAVE_VERSION = 1;
export const DAY_START = 6 * 60, DAY_END = 26 * 60, NIGHT_AT = 18 * 60;
export const MIN_PER_SEC = 2;
export const BASE_INV = 24, BIG_INV = 36;

export function newState({ seed, name = 'Farmer', pronoun = 'they', look, villageName, now = 0 }) {
    const inv = new Array(BIG_INV).fill(null);
    const start = [['hoe', 1], ['can', 1], ['axe', 1], ['pick', 1], ['scythe', 1], ['seed_turnip', 8], ['fried_egg', 2]];
    start.forEach(([id, n], i) => { inv[i] = { id, n }; });
    return {
        v: SAVE_VERSION, seed: seed >>> 0, created: now, playtime: 0, villageName: villageName || null,
        player: {
            name, pronoun, look, x: 0, y: 0, dir: 0,
            hp: 50, maxHp: 50, sp: 10, maxSp: 10, energy: 100, maxEnergy: 100, level: 1, xp: 0, gold: 300,
            bonus: { atk: 0, def: 0, spd: 0, hp: 0, en: 0 },
            equip: { weapon: 'wood_sword', armor: 'tunic', charm: null }, weaponElem: 'none',
            tools: { hoe: 0, can: 0, axe: 0, pick: 0, scythe: 0 }, water: 20,
            relics: [], skills: { farming: { lv: 1, xp: 0 }, foraging: { lv: 1, xp: 0 }, mining: { lv: 1, xp: 0 }, cooking: { lv: 1, xp: 0 } },
            buffs: { day: 0 }, companion: null,
            where: 'world', floor: 0, fastTravel: [],
        },
        inv, invSize: BASE_INV, sel: 0,
        storage: new Array(48).fill(null), storehouse: [],
        time: { day: 1, min: DAY_START },
        weather: 'sun',
        known: { recipes: STARTING_RECIPES.slice() },
        world: { removed: {}, placed: {}, tilled: {}, crops: {}, picked: {}, glimmers: {}, explored: '', chests: {}, lots: {}, gates: {} },
        village: { level: 1, xp: 0, board: false, levelReady: false, pendingLevel: 0 },
        villagers: {},
        applicants: [], movingIn: {},
        board: { day: 0, postings: [], taken: [], assigned: [] },
        quests: { main: { ch: 0, step: 0 }, flags: {}, done: [] },
        animals: [], hay: 0, greenhouse: [],
        stations: {},
        dungeons: {},
        flags: {},
        stats: { kills: 0, killsBy: {}, harvested: 0, shipped: 0, cooked: 0, crafted: 0, planted: 0, farmCleared: 0, sleeps: 0, first: {}, steps: 0, gathered: 0, faints: 0, bossKills: 0, questsDone: 0 },
        heartwood: 0,
        blessings: [],
        ship: [],
        report: null,
        moonwell: {},
        log: [],
    };
}

export const seasonOf = day => Math.floor((day - 1) / DAYS_PER_SEASON) % 4;
export const dayOfSeason = day => ((day - 1) % DAYS_PER_SEASON) + 1;
export const yearOf = day => Math.floor((day - 1) / (DAYS_PER_SEASON * 4)) + 1;
export const seasonName = day => SEASONS[seasonOf(day)];
export function clockText(min) {
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60 / 10) * 10;
    const ap = h < 12 ? 'am' : 'pm';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')}${ap}`;
}
export const dateText = day => `${seasonName(day)} ${dayOfSeason(day)}, Year ${yearOf(day)}`;
