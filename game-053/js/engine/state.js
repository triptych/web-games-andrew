// Player state, derived stats and the save slots.
import { RACES, SPECIALTIES, titleFor, expForNext } from '../data/classes.js';
import { weaponName, armorName, MOUNTS } from '../data/items.js';
import { GUILDS } from '../data/text.js';

export const SAVE_VERSION = 1;
export const SLOTS = 3;
const KEY = (n) => `jadewyrm.slot.${n}`;
const PREFS_KEY = 'jadewyrm.prefs';

export function newPlayer({ name, sex, race, spec, slot }) {
    const r = RACES[race];
    const p = {
        v: SAVE_VERSION, slot, name, sex, race, spec,
        dk: 0, level: 1, exp: 0, hp: 10,
        weapon: 0, armor: 0,
        gold: 50, bank: 0, gems: 0, charm: (r.charm || 0),
        turns: 0, pvp: 3, alive: true, favor: 0, gravefights: 10,
        spirits: 0, specLevel: 1, specUses: 1, specPoints: {},
        buffs: [], mount: null, drunk: 0,
        flags: {}, // per-day flags, cleared each new day
        dkBonus: { hp: 0, turns: 0, atk: 0, def: 0 }, vitality: 0,
        lodge: { turns: 0, color: '', title: '' }, renown: 0, deeds: {},
        spouse: null, flirt: 0, guild: null,
        day: 0, clock: 360, lastDawn: Date.now(), sleptAt: null, pacing: 'adventurer',
        stats: { kills: 0, deaths: 0, pvpWins: 0, pvpLosses: 0, flawless: 0, events: 0, gems: 0, gold: 0, days: 0, masters: 0, thrill: 0, souls: 0, wyrmTries: 0, bestHit: 0, drinks: 0, flirts: 0 },
        fight: null, event: null,
        mail: [], mailSeq: 1, bio: '',
        created: Date.now(), lastPlayed: Date.now(),
    };
    p.hp = maxHp(p);
    return p;
}

export const race = (p) => RACES[p.race];
export const spec = (p) => SPECIALTIES[p.spec];
export const mount = (p) => MOUNTS.find((m) => m.id === p.mount) || null;
export const guild = (p) => (p.guild ? GUILDS.find((g) => g.tag === p.guild.tag) || p.guild.custom || null : null);

export function maxHp(p) {
    let hp = 10 * p.level + p.dkBonus.hp * 5 + p.vitality;
    const g = guild(p);
    if (g && g.perk === 'hp') hp = Math.round(hp * 1.05);
    return hp;
}
export function attack(p) { return p.level + p.dkBonus.atk + (race(p).atk || 0) + p.weapon; }
export function defense(p) { return p.level + p.dkBonus.def + (race(p).def || 0) + p.armor; }
export function turnsPerDay(p) {
    const m = mount(p);
    return 10 + (race(p).turns || 0) + (m ? m.turns : 0) + p.dkBonus.turns + p.lodge.turns;
}
export function title(p) { return p.lodge.title || titleFor(p.dk, p.sex); }
export function fullName(p) { return `${title(p)} ${p.name}`; }
export function coloredName(p) { return `${p.lodge.color || '`%'}${fullName(p)}\`0`; }
export function weaponLabel(p) { return weaponName(p.weapon, p.dk); }
export function armorLabel(p) { return armorName(p.armor, p.dk); }
export function nextExp(p) { return expForNext(p.level, p.dk); }
export function maxSpecUses(p) { return 1 + Math.floor(p.specLevel / 2); }
export function clockText(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60); const mm = m % 60;
    const ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${String(mm).padStart(2, '0')}${ap}`;
}

// ---------------- saves ----------------
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function safeDel(k) { try { localStorage.removeItem(k); } catch { /* */ } }

export function saveSlot(slot, player, world) {
    player.lastPlayed = Date.now();
    return safeSet(KEY(slot), JSON.stringify({ v: SAVE_VERSION, player, world }));
}
export function loadSlot(slot) {
    const raw = safeGet(KEY(slot));
    if (!raw) return null;
    try { return migrate(JSON.parse(raw)); } catch { return null; }
}
export function deleteSlot(slot) { safeDel(KEY(slot)); }
export function slotSummaries() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
        const d = loadSlot(i);
        out.push(d ? { slot: i, p: d.player, w: d.world } : { slot: i, empty: true });
    }
    return out;
}
export function exportData(player, world) {
    return JSON.stringify({ game: 'legend-of-the-jade-wyrm', v: SAVE_VERSION, exported: new Date().toISOString(), player, world }, null, 1);
}
export function parseImport(text) {
    const d = JSON.parse(text);
    if (!d || !d.player || !d.world || typeof d.player.name !== 'string') throw new Error('That file is not a Jade Wyrm save.');
    return migrate(d);
}
function migrate(d) {
    const p = d.player;
    // fill fields added after a save was made
    const fresh = newPlayer({ name: p.name, sex: p.sex || 'n', race: RACES[p.race] ? p.race : 'human', spec: SPECIALTIES[p.spec] ? p.spec : 'thief', slot: p.slot ?? 0 });
    for (const k of Object.keys(fresh)) if (p[k] === undefined) p[k] = fresh[k];
    for (const k of Object.keys(fresh.stats)) if (p.stats[k] === undefined) p.stats[k] = 0;
    return d;
}

export const DEFAULT_PREFS = { sound: true, music: true, volume: 0.7, quality: 'auto', motion: true, textSize: 1, autoStop: true, colors: true };
export function loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...(JSON.parse(safeGet(PREFS_KEY)) || {}) }; } catch { return { ...DEFAULT_PREFS }; }
}
export function savePrefs(prefs) { safeSet(PREFS_KEY, JSON.stringify(prefs)); }
