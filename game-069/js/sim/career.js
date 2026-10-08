/**
 * career.js — the road to the Dirt Crown: seven circuits of events, the drivers you meet, what each
 * race pays, how events unlock, and how an event's field of opponents is built.
 *
 * Progress lives in a plain profile object (see newProfile) so it saves as JSON.
 */

import { levelsForRating, specFromLevels, emptyLevels, rating, CATS, LEVEL_COST, MAX_LEVEL } from './parts.js';
import { Rng, hashStr } from '../rng.js';

// ------------------------------------------------------------------ drivers
// kind: the body the view builds (buggy, pickup, rally, dune, swamp, ice, trophy, raven).
export const DRIVERS = {
    earl:   { name: 'Big Earl Pruitt',   kind: 'pickup', paint: 0xb53a2a, trim: 0xf2e6c8, livery: 'stripes', num: 4,  bias: ['engine', 'body'],  skill: 0.76, champ: true, title: 'King of the Flats' },
    fern:   { name: 'Fern Calloway',     kind: 'rally',  paint: 0x2f7d4a, trim: 0xf6d55c, livery: 'number',  num: 7,  bias: ['tires', 'susp'],   skill: 0.8, champ: true, title: 'Ranger of the Ridge' },
    sal:    { name: '"Sidewinder" Sal',  kind: 'dune',   paint: 0xe2852b, trim: 0x2a2a2a, livery: 'bolt',    num: 13, bias: ['susp', 'nitro'],   skill: 0.82,  champ: true, title: 'Canyon Daredevil' },
    gator:  { name: 'Gator Boudreaux',   kind: 'swamp',  paint: 0x4b6b2a, trim: 0xd9c27a, livery: 'splatter',num: 9,  bias: ['tires', 'body'],   skill: 0.83,  champ: true, title: 'Mud King of the Bayou' },
    ivanka: { name: 'Ivanka Volkova',    kind: 'ice',    paint: 0xe8f0f8, trim: 0x2d6fd6, livery: 'stripes', num: 1,  bias: ['tires', 'drive'],  skill: 0.85, champ: true, title: 'The Ice Queen' },
    max:    { name: 'Max Volt',          kind: 'trophy', paint: 0x8e2bd9, trim: 0x39f0ff, livery: 'bolt',    num: 99, bias: ['nitro', 'engine'], skill: 0.86, champ: true, title: 'Showman of the Thunderdome' },
    colt:   { name: 'Colt Ravenwood',    kind: 'raven',  paint: 0x15161a, trim: 0xe0b23c, livery: 'checker', num: 1,  bias: ['engine', 'drive', 'tires'], skill: 0.84, rival: true, title: 'Heir to Ravenwood Motors' },
};

// Local racers who fill the grids. Names, styles and colours are fixed so you get to know them.
export const LOCALS = {
    flats:  [['Dusty Rhodes', 'buggy', 0xd9b23a], ['Patsy Cline-Moore', 'pickup', 0x6fa8dc], ['Tex Mudd', 'buggy', 0x8a5a2b], ['Lulu Gravel', 'rally', 0xe86fa8], ['Hank Haybale', 'pickup', 0x9fc65a], ['Wanda Wheatley', 'buggy', 0xf0e2b0]],
    woods:  [['Birch Bjornsen', 'rally', 0xc8d6e0], ['Moss McAllister', 'buggy', 0x5f8f3e], ['Cricket Pine', 'rally', 0xe35d3a], ['Sawyer Stump', 'pickup', 0x8b5e34], ['Juniper Jay', 'buggy', 0x3d7ec2], ['Rowan Fox', 'rally', 0xe08a2c]],
    canyon: [['Dusty Mesa', 'dune', 0xd6603a], ['Coyote Kate', 'buggy', 0xc9a45c], ['Rocco Ridge', 'pickup', 0x4a4f5a], ['Saguaro Sam', 'dune', 0x6c9a4a], ['Ruby Redd', 'rally', 0xc0263a], ['Vulture Vic', 'buggy', 0x2e2e33]],
    bayou:  [['Boudin Billy', 'swamp', 0x9b6b3a], ['Mama Thibodeaux', 'pickup', 0x6d9cc4], ['Crawdad Cal', 'buggy', 0xd64a2e], ['Marie Lafitte', 'rally', 0x7a3fa0], ['Skeeter Doucet', 'swamp', 0x6b8a3a], ['Jolie Blanc', 'buggy', 0xf2ece0]],
    frost:  [['Sven Snowberg', 'rally', 0x2d5fb8], ['Olga Frostova', 'ice', 0xbfd8ee], ['Yuki Sato', 'rally', 0xe23a4a], ['Bjorn Iceberg', 'pickup', 0x405060], ['Nell Northwind', 'buggy', 0x9adfe8], ['Pip Parka', 'ice', 0xf0a020]],
    dome:   [['Dynamo Dee', 'trophy', 0xff3fa4], ['Turbo Tanaka', 'rally', 0x2bd9a0], ['Blaze Bishop', 'buggy', 0xff7a1a], ['Neon Nadia', 'trophy', 0x3fa4ff], ['Rocket Rhonda', 'dune', 0xe8e23a], ['Captain Kaboom', 'pickup', 0xd92b2b]],
    mesa:   [['Vance Ravenwood', 'raven', 0x2a2b30], ['Sterling Gold', 'raven', 0xb08a2a], ['Raven Team Two', 'raven', 0x3a3c44]],
};

// ------------------------------------------------------------------ circuits and events
//   type: race | elim | tt | duel   rating: what the field drives   pay: winner's purse
//   boss: a champion in the field (must win)   reverse: run the track backwards
export const CIRCUITS = [
    {
        id: 'flats', name: 'Dustwater Flats', cup: 'Rookie Cup', env: 'flats', champ: 'earl', icon: '🌾',
        blurb: 'Farm tracks on the flats where Grandpa Gus first raced. Everyone starts here.',
        events: [
            { id: 'flats-1', name: 'Barnyard Brawl', track: 'barnyard', type: 'race', laps: 4, rating: 100, pay: 120 },
            { id: 'flats-2', name: 'Windmill Time Trial', track: 'windmill', type: 'tt', laps: 2, rating: 130, pay: 110 },
            { id: 'flats-3', name: 'Cornfield Classic', track: 'cornfield', type: 'race', laps: 3, rating: 160, pay: 140 },
            { id: 'flats-4', name: 'Harvest Showdown', track: 'cornfield', reverse: true, type: 'race', laps: 3, rating: 200, pay: 280, boss: 'earl' },
        ],
    },
    {
        id: 'woods', name: 'Pinecrest Woods', cup: 'Timberline Trophy', env: 'woods', champ: 'fern', icon: '🌲',
        blurb: 'Logging roads in the misty pines: soft loam, mud holes and blind crests.',
        events: [
            { id: 'woods-1', name: 'Pinecone Scramble', track: 'pinecone', type: 'race', laps: 3, rating: 250, pay: 190 },
            { id: 'woods-2', name: 'Creekside Knockout', track: 'hollow', type: 'elim', laps: 5, rating: 270, pay: 190 },
            { id: 'woods-3', name: 'Ridgeback Rally', track: 'ridgeback', type: 'race', laps: 2, rating: 300, pay: 220 },
            { id: 'woods-4', name: 'Ranger\'s Challenge', track: 'pinecone', reverse: true, type: 'duel', laps: 3, rating: 350, pay: 420, boss: 'fern' },
        ],
    },
    {
        id: 'canyon', name: 'Redrock Canyon', cup: 'Sunset Sizzler', env: 'canyon', champ: 'sal', icon: '🏜️',
        blurb: 'Red rock, big air and a sun that never quite sets.',
        events: [
            { id: 'canyon-1', name: 'Mesa Mayhem', track: 'mesaloop', type: 'race', laps: 3, rating: 390, pay: 300 },
            { id: 'canyon-2', name: 'Gulch Run Time Trial', track: 'gulch', type: 'tt', laps: 2, rating: 410, pay: 300 },
            { id: 'canyon-3', name: 'Arch Rivals', track: 'arch', type: 'race', laps: 3, rating: 440, pay: 340 },
            { id: 'canyon-4', name: 'Sidewinder\'s Leap', track: 'mesaloop', reverse: true, type: 'race', laps: 3, rating: 490, pay: 650, boss: 'sal' },
        ],
    },
    {
        id: 'bayou', name: 'Gatorback Bayou', cup: 'Mudbug Jubilee', env: 'bayou', champ: 'gator', icon: '🐊',
        blurb: 'Swamp roads by lantern light. Deep mud, shallow water and a bridge that creaks.',
        events: [
            { id: 'bayou-1', name: 'Gator Bend Gallop', track: 'gatorbend', type: 'race', laps: 3, rating: 520, pay: 420 },
            { id: 'bayou-2', name: 'Stilt-Shack Shootout', track: 'stilts', type: 'elim', laps: 5, rating: 540, pay: 420 },
            { id: 'bayou-3', name: 'Crossroads at Midnight', track: 'crossroads', type: 'race', laps: 3, rating: 570, pay: 470 },
            { id: 'bayou-4', name: 'The Mud King\'s Court', track: 'crossroads', reverse: true, type: 'duel', laps: 3, rating: 620, pay: 900, boss: 'gator' },
        ],
    },
    {
        id: 'frost', name: 'Frostbite Pass', cup: 'Ice Crown Invitational', env: 'frost', champ: 'ivanka', icon: '❄️',
        blurb: 'Packed snow, sheet ice and mountain air. Grip is a rumour up here.',
        events: [
            { id: 'frost-1', name: 'Frozen Lake Frenzy', track: 'frozenlake', type: 'race', laps: 3, rating: 650, pay: 580 },
            { id: 'frost-2', name: 'Avalanche Time Trial', track: 'avalanche', type: 'tt', laps: 2, rating: 670, pay: 580 },
            { id: 'frost-3', name: 'Summit Sprint', track: 'summit', type: 'race', laps: 3, rating: 700, pay: 640 },
            { id: 'frost-4', name: 'The Ice Queen\'s Gauntlet', track: 'summit', reverse: true, type: 'race', laps: 3, rating: 750, pay: 1200, boss: 'ivanka' },
        ],
    },
    {
        id: 'dome', name: 'The Thunderdome', cup: 'Night of Thunder', env: 'dome', champ: 'max', icon: '🏟️',
        blurb: 'Stadium supercross under the floodlights, in front of twenty thousand fans.',
        events: [
            { id: 'dome-1', name: 'Supercross Snake', track: 'snake', type: 'race', laps: 2, rating: 780, pay: 750 },
            { id: 'dome-2', name: 'Thunder Eight Knockout', track: 'thundereight', type: 'elim', laps: 5, rating: 800, pay: 750 },
            { id: 'dome-3', name: 'Ring of Fire', track: 'ringfire', type: 'race', laps: 3, rating: 830, pay: 820 },
            { id: 'dome-4', name: 'Max Volt\'s Main Event', track: 'snake', reverse: true, type: 'race', laps: 2, rating: 870, pay: 1600, boss: 'max' },
        ],
    },
    {
        id: 'crown', name: 'Ravenwood Mesa', cup: 'The Dirt Crown', env: 'mesa', champ: 'colt', icon: '👑',
        blurb: 'Where the Dirt Crown is decided. Ravenwood ground, Ravenwood rules.',
        events: [
            { id: 'crown-1', name: 'Crown Qualifier', track: 'speedway', type: 'race', laps: 3, rating: 900, pay: 1300, champs: true },
            { id: 'crown-2', name: 'The Dirt Crown', track: 'crownrun', type: 'duel', laps: 3, rating: 940, pay: 5000, boss: 'colt', final: true },
        ],
    },
];

export const EVENTS = {};
CIRCUITS.forEach((c, ci) => c.events.forEach((e, ei) => { EVENTS[e.id] = { ...e, circuit: c.id, ci, ei, env: c.env }; }));

export const POS_PAY = [1, 0.6, 0.4, 0.25, 0.15, 0.1];
export const MEDAL_PAY = { gold: 1, silver: 0.6, bronze: 0.4 };

// ------------------------------------------------------------------ profile
export function newProfile(name = 'Kit') {
    return {
        name,
        coins: 150,
        levels: emptyLevels(),
        paint: 'primer', livery: 'none', trim: 'white', num: 27,
        owned: { paint: ['primer'], livery: ['none'] },
        results: {},           // eventId → { best pos, best time, medal, wins, runs }
        seen: {},              // story scenes already played
        stats: { races: 0, wins: 0, coins: 0, jumps: 0, airtime: 0, drift: 0 },
        done: false,           // won the Dirt Crown
        created: Date.now(),
    };
}

/** An event is cleared on a podium (top 3), a bronze or better, or a win for boss races. */
export function cleared(ev, res) {
    if (!res) return false;
    if (ev.type === 'tt') return !!res.medal;
    if (ev.boss) return res.pos === 1;
    return res.pos > 0 && res.pos <= 3;
}

export function circuitUnlocked(profile, ci) {
    if (ci === 0) return true;
    const prev = CIRCUITS[ci - 1];
    const bossEv = EVENTS[prev.events[prev.events.length - 1].id];
    return cleared(bossEv, profile.results[bossEv.id]);
}

export function eventUnlocked(profile, id) {
    const ev = EVENTS[id];
    if (!circuitUnlocked(profile, ev.ci)) return false;
    if (ev.ei === 0) return true;
    const prev = EVENTS[CIRCUITS[ev.ci].events[ev.ei - 1].id];
    return cleared(prev, profile.results[prev.id]);
}

export function circuitDone(profile, ci) {
    const c = CIRCUITS[ci];
    const last = EVENTS[c.events[c.events.length - 1].id];
    return cleared(last, profile.results[last.id]);
}

/** The next thing to do: first unlocked, uncleared event. */
export function nextEvent(profile) {
    for (const c of CIRCUITS) for (const e of c.events) {
        const ev = EVENTS[e.id];
        if (eventUnlocked(profile, e.id) && !cleared(ev, profile.results[e.id])) return ev;
    }
    return null;
}

/** Coins for a result. First win (or first gold) pays a 50% bonus. */
export function payout(ev, res, prevRes) {
    let share = 0;
    if (ev.type === 'tt') share = res.medal ? MEDAL_PAY[res.medal] : 0.1;
    else share = POS_PAY[res.pos - 1] ?? 0.05;
    let coins = Math.round(ev.pay * share);
    const firstWin = (ev.type === 'tt' ? res.medal === 'gold' && prevRes?.medal !== 'gold' : res.pos === 1 && !(prevRes && prevRes.wins > 0));
    const bonus = firstWin ? Math.round(ev.pay * 0.5) : 0;
    return { purse: coins, bonus, total: coins + bonus, firstWin };
}

/** Record a result in the profile. Returns the payout. */
export function recordResult(profile, ev, res) {
    const prev = profile.results[ev.id];
    const pay = payout(ev, res, prev);
    const r = prev ? { ...prev } : { pos: 0, time: 0, medal: null, wins: 0, runs: 0 };
    r.runs++;
    if (res.pos === 1 && ev.type !== 'tt') r.wins++;
    if (res.pos > 0 && (!r.pos || res.pos < r.pos)) r.pos = res.pos;
    if (res.time > 0 && (!r.time || res.time < r.time) && (ev.type === 'tt' || res.pos > 0)) r.time = res.time;
    const rank = { gold: 3, silver: 2, bronze: 1 };
    if (res.medal && (!r.medal || rank[res.medal] > rank[r.medal])) r.medal = res.medal;
    profile.results[ev.id] = r;
    profile.coins += pay.total + (res.coins || 0);
    profile.stats.races++;
    if (res.pos === 1 && ev.type !== 'tt') profile.stats.wins++;
    profile.stats.coins += pay.total + (res.coins || 0);
    if (ev.final && res.pos === 1) profile.done = true;
    return pay;
}

// ------------------------------------------------------------------ upgrades
export function upgradeCost(profile, cat) {
    const lv = profile.levels[cat];
    return lv >= MAX_LEVEL ? 0 : LEVEL_COST[lv + 1];
}

export function buyUpgrade(profile, cat) {
    const cost = upgradeCost(profile, cat);
    if (!cost || profile.coins < cost) return false;
    profile.coins -= cost;
    profile.levels[cat]++;
    return true;
}

export const playerRating = (profile) => rating(profile.levels);

// ------------------------------------------------------------------ the field
/**
 * Build the grid for an event: entrant 0 is the player. Opponents get cars of the event's rating
 * (the front-runners a little better, the back-markers a little worse), named locals, and the
 * champion where there is one.
 */
export function buildField(ev, profile) {
    const rng = new Rng(hashStr(ev.id));
    const me = {
        name: profile.name, isPlayer: true,
        spec: specFromLevels(profile.levels),
        look: { kind: 'buggy', levels: { ...profile.levels }, paint: profile.paint, livery: profile.livery, trim: profile.trim, num: profile.num },
        ai: null,
    };
    if (ev.type === 'tt') return [me];

    const out = [me];
    const add = (name, kind, paint, rate, skill, bias = [], extra = {}) => {
        const lv = levelsForRating(rate, bias);
        out.push({
            name, spec: specFromLevels(lv),
            look: { kind, levels: lv, paintHex: paint, trimHex: extra.trim ?? 0xf4f1e8, livery: extra.livery || ['none', 'number', 'stripes', 'checker', 'splatter'][rng.int(5)], num: extra.num ?? (2 + rng.int(97)) },
            ai: { skill, lane: rng.range(-0.8, 0.8), nitroHappy: rng.range(0.4, 0.9) },
            champ: extra.champ || null,
        });
    };

    const champField = (ids) => ids.forEach((id, k) => {
        const d = DRIVERS[id];
        add(d.name, d.kind, d.paint, ev.rating - 20 + k * 8, Math.min(0.95, d.skill), d.bias, { trim: d.trim, livery: d.livery, num: d.num, champ: id });
    });

    if (ev.type === 'duel') {
        const d = DRIVERS[ev.boss];
        add(d.name, d.kind, d.paint, ev.rating, d.skill, d.bias, { trim: d.trim, livery: d.livery, num: d.num, champ: ev.boss });
        return out;
    }
    if (ev.champs) {
        champField(['earl', 'fern', 'sal', 'gator', 'max']);
        return out;
    }
    // The grid is seeded like a handicap: the slowest cars start at the front, so a race is a
    // drive through the field. In a champion's race the champion takes pole and the locals are the
    // traffic you have to get through to catch them.
    const env = ev.env || CIRCUITS[ev.ci].env;
    const n = ev.boss ? 4 : 5;
    let picks = (LOCALS[env] || LOCALS.flats).slice();
    if (picks.length < n) picks = picks.concat(LOCALS.flats);
    const spreads = ev.boss ? [-80, -65, -50, -35] : [-30, -15, 0, 15, 30];
    for (let k = 0; k < n; k++) {
        // The champion lines up third, with traffic ahead of them too.
        if (ev.boss && k === 2) {
            const d = DRIVERS[ev.boss];
            add(d.name, d.kind, d.paint, ev.rating + 10, d.skill, d.bias, { trim: d.trim, livery: d.livery, num: d.num, champ: ev.boss });
        }
        const j = rng.int(picks.length);
        const [name, kind, paint] = picks.splice(j, 1)[0];
        const spread = spreads[k];
        const skill = ev.boss ? 0.62 + rng.next() * 0.1 + k * 0.02 : 0.68 + rng.next() * 0.12 + (spread > 0 ? 0.06 : 0) + (k / n) * 0.06;
        // Each local spends their odd levels somewhere different, so their cars differ.
        const start = rng.int(CATS.length);
        const bias = CATS.slice(start).concat(CATS.slice(0, start)).slice(0, 3);
        add(name, kind, paint, Math.max(100, ev.rating + spread), skill, bias);
    }
    return out;
}

/** A sensible spread of upgrades for a given number of coins, for tests and the "auto" button. */
export function autoBuild(coins, start = emptyLevels()) {
    const lv = { ...start };
    let left = coins;
    for (;;) {
        let best = null;
        for (const c of CATS) {
            if (lv[c] >= MAX_LEVEL) continue;
            const cost = LEVEL_COST[lv[c] + 1];
            if (cost <= left && (!best || lv[c] < lv[best] || (lv[c] === lv[best] && CATS.indexOf(c) < CATS.indexOf(best)))) best = c;
        }
        if (!best) break;
        left -= LEVEL_COST[lv[best] + 1];
        lv[best]++;
    }
    return { levels: lv, left };
}
