// The calendar: dawn and dusk, weather, festivals, raiders, the travelling merchant.

import { DAY_LEN, SEASON_DAYS, RAID_FIRST_DAY } from '../config.js';
import { ITEMS } from './data/items.js';
import { BUILDINGS, stat } from './data/buildings.js';
import { SPECIALS } from './data/people.js';
import {
    clamp, dayOf, hourOf, seasonOf, dayOfSeason, push, toast, note, stock, takeItem, addItem, earn, builtOf, vById, cozyOf, bestLv, nextId, hall,
} from './core.js';
import { heroPower, heroStats, refreshRecruits, giveXp } from './heroes.js';
import { refreshBoard } from './quests.js';
import { addRenown } from './journal.js';

export const RAID_KINDS = [
    { upto: 9, name: 'Rats in the granary' }, { upto: 16, name: 'A hungry wolf pack' }, { upto: 26, name: 'Road bandits' },
    { upto: 38, name: 'Goblin raiders' }, { upto: 52, name: 'A troll from the hills' }, { upto: 70, name: 'An ogre warband' }, { upto: 999, name: 'A wyvern' },
];

export function raidPower(G, day) {
    return Math.round((14 + 2.3 * Math.pow(Math.max(0, day - 4), 1.1)) * (G.opts.raidMul || 1));
}

export function defenseOf(G) {
    let d = G.villagers.length * 2;
    for (const h of G.heroes) {
        if (h.st === 'away') continue;
        d += heroPower(G, h) * (h.st === 'sleep' || h.st === 'rest' ? 0.7 : 1) * 0.9;
    }
    for (const b of builtOf(G, 'watchtower')) d += stat('watchtower', b.lv, 'defense');
    return Math.round(d * (1 + G.mods.defenseMul));
}

export function scheduleRaid(G, fromDay) {
    const day = fromDay;
    const kind = RAID_KINDS.find((k) => day <= k.upto) || RAID_KINDS[RAID_KINDS.length - 1];
    G.raid = { day, power: raidPower(G, day), name: kind.name, warned: false };
}

function dawn(G) {
    const day = G.day;
    const season = seasonOf(day);
    if (dayOfSeason(day) === 1 && day > 1) {
        push(G, { type: 'season', season });
        note(G, `A new season began.`);
    }
    // weather
    const r = G.rng();
    G.weather = season === 3 ? (r < 0.45 ? 'snow' : 'clear') : r < (season === 1 ? 0.12 : 0.3) ? 'rain' : 'clear';
    push(G, { type: 'weather', weather: G.weather });
    // festival on the last day of a season
    G.festival = dayOfSeason(day) === SEASON_DAYS;
    if (G.festival) {
        push(G, { type: 'festival' });
        toast(G, 'Festival day! The tavern is packed.', 'good');
        if (builtOf(G, 'tavern').length) addRenown(G, 2);
        note(G, 'A festival filled the square.');
        for (const h of G.heroes) h.mood = clamp(h.mood + 15, 0, 100);
    }
    refreshRecruits(G);
    refreshBoard(G);
    // merchant
    const pip = G.villagers.some((v) => v.special === 'pip');
    if (day >= 3 && (day % 5 === 3 || (pip && day % 5 === 0))) spawnMerchant(G);
    if (G.raid && G.raid.day === day) {
        toast(G, `Scouts report: ${G.raid.name} is coming tonight.`, 'bad');
        push(G, { type: 'raidWarn', power: G.raid.power, name: G.raid.name });
        G.raid.warned = true;
    }
    push(G, { type: 'day', day });
}

const MERCHANT_POOL = ['gem', 'relic', 'steel', 'cloth', 'honey', 'ingot', 'pelt', 'lore', 'plank', 'coal'];
function spawnMerchant(G) {
    const pip = G.villagers.some((v) => v.special === 'pip');
    const pool = MERCHANT_POOL.slice();
    const offers = [];
    for (let i = 0; i < 3; i++) {
        const id = pool.splice(G.rng.int(0, pool.length - 1), 1)[0];
        const base = id === 'lore' ? 55 : ITEMS[id].value;
        offers.push({ item: id, n: G.rng.int(2, 5), price: Math.max(2, Math.round(base * (pip ? 1.7 : 2.2))) });
    }
    G.merchant = { offers, until: G.day };
    push(G, { type: 'merchant' });
    toast(G, 'A travelling merchant has set up in the square.', 'good');
}

export function buyOffer(G, idx, n = 1) {
    const m = G.merchant;
    const o = m && m.offers[idx];
    if (!o || o.n <= 0) return { ok: false, why: 'Sold out.' };
    n = Math.min(n, o.n);
    const cost = o.price * n;
    if (G.gold < cost) return { ok: false, why: `Needs ${cost} gold.` };
    const got = addItem(G, o.item, n);
    if (got <= 0) return { ok: false, why: 'No room in storage.' };
    G.gold -= o.price * got;
    o.n -= got;
    return { ok: true, got };
}

function dusk(G) {
    if (G.merchant) { G.merchant = null; push(G, { type: 'merchantLeft' }); }
}

function resolveRaid(G) {
    const R = G.raid;
    const def = defenseOf(G);
    const win = def >= R.power;
    const frac = clamp(1 - def / R.power, 0, 1);
    if (win) {
        G.stats.raidsHeld++;
        const loot = Math.round(10 + R.power * 0.5);
        earn(G, loot);
        addRenown(G, 1 + Math.floor(G.day / 12));
        for (const h of G.heroes) if (h.st !== 'away') giveXp(G, h, 4 + R.power * 0.08);
        push(G, { type: 'raid', win: true, name: R.name, power: R.power, def, loot });
        toast(G, `${R.name} was driven off! (+${loot} gold)`, 'good');
        note(G, `${R.name} was driven off.`);
    } else {
        const soft = G.quiet ? 0.5 : 1;
        const lostGold = Math.round(G.gold * (0.04 + 0.18 * frac) * soft);
        G.gold -= lostGold;
        const lost = [];
        const raws = Object.keys(G.inv).filter((k) => ITEMS[k].cat === 'raw' && stock(G, k) > 4);
        for (let i = 0; i < 3 && raws.length; i++) {
            const k = raws.splice(G.rng.int(0, raws.length - 1), 1)[0];
            const n = Math.floor(stock(G, k) * (0.05 + 0.2 * frac) * soft);
            if (n > 0) { takeItem(G, k, n); lost.push(`${n} ${ITEMS[k].name}`); }
        }
        for (const h of G.heroes) h.mood = clamp(h.mood - 8, 0, 100);
        G.stats.raidsLost++;
        push(G, { type: 'raid', win: false, name: R.name, power: R.power, def, lostGold, lost });
        toast(G, `${R.name} got in: lost ${lostGold} gold${lost.length ? ' and ' + lost.join(', ') : ''}.`, 'bad');
        note(G, `${R.name} got in and took ${lostGold} gold.`);
    }
    scheduleRaid(G, G.day + G.rng.int(4, 6));
}

/** Advance the calendar by dt and fire dawn, dusk and the evening raid. */
export function tickCalendar(G, dt) {
    const prevDay = G.day, prevHour = hourOf(G.t);
    G.t += dt;
    G.day = dayOf(G.t);
    const h = hourOf(G.t);
    G.hour = h;
    if (G.day !== prevDay) {
        // a long step can cross several dawns; run each so nothing is skipped
        for (let d = prevDay + 1; d <= G.day; d++) {
            G.day = d;
            if (G.merchant) dusk(G);
            if (G.raid && G.raid.day < d) resolveRaid(G);
            dawn(G);
        }
        G.day = dayOf(G.t);
    }
    // evening: the merchant packs up, then the raiders arrive
    const crossed = (hr) => (prevHour < hr && h >= hr) || (G.day !== prevDay && h >= hr);
    if (crossed(19.5) && G.merchant && G.merchant.until <= G.day) dusk(G);
    if (G.raid && G.raid.day === G.day && h >= 20 && !G.raid.done) { G.raid.done = true; resolveRaid(G); }
    G.cozyT -= dt;
    if (G.cozyT <= 0) { G.cozyT = 4; G.cozy = cozyOf(G); }
}
