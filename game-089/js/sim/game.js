// Dragonroll — the board game. Pure: no DOM, no renderer, no Math.random, no clock.
//
// The game is a phase machine. G.phase says what decision is wanted next ('roll', 'buy',
// 'town', 'battle', ...) and act(G, action) makes it. Everything an action causes is resolved at
// once and recorded as ordered events in G.events (dice, steps, gold, battle hits); the view and
// the UI drain and play them back. G is plain JSON (the random state is the number G.rs), so a
// save is JSON.stringify and a test can copy a game and play both copies on.

import {
    BOARD_SIZE, LENGTHS, START_GOLD, SALARY, MAX_LEVEL, PARTY_MAX, DEFEAT_GOLD_LOSS, FOUNTAIN_START,
    DEED, xpToNext, pace, ROAD_REST, roadGold,
} from '../config.js';
import {
    REGIONS, CLASSES, COMPANIONS, GEAR, ITEMS, RECIPES, TOWNS, DUNGEONS, ENCOUNTERS, FATE, TREASURE,
    MATERIALS, SHARDS, RIVALS, SKILLS,
} from './data.js';
import { SPACES, DEEDS, regionOf, regionDeeds, nextOfType } from './board.js';
import { newMember, stats, clampMember, canEquip, memberDef, ownsSet } from './party.js';
import { startBattle, command, TUNE } from './battle.js';
import { rand, rint, pick, wpick } from './rand.js';

export const SAVE_VERSION = 1;
const REGION_TIER = Object.fromEntries(REGIONS.map((r) => [r.id, r.tier]));
const BLESSINGS = ['atkUp', 'defUp', 'haste', 'regen'];

export function newGame(seed = 1, opts = {}) {
    const len = LENGTHS[opts.length] ? opts.length : 'standard';
    const G = {
        v: SAVE_VERSION,
        seed, rs: (seed * 2654435761) >>> 0,
        cls: CLASSES[opts.cls] ? opts.cls : 'knight',
        heroName: (opts.name || '').trim().slice(0, 14) || 'Rowan',
        length: len, laps: LENGTHS[len].laps, early: LENGTHS[len].early,
        turn: 1, lap: 1, pos: 0, extraRoll: false, rolledDoubles: false,
        gold: START_GOLD, fame: 0, level: 1, xp: 0, valor: 0,
        party: [], bench: [], hired: {},
        bag: { items: { potion: 3, ether: 1 }, gear: {}, mats: {} },
        deeds: Object.fromEntries(DEEDS.map((s) => [s.deed, { owner: null, level: 0 }])),
        rivals: RIVALS.map((r, k) => ({ id: r.id, pos: 0, gold: START_GOLD, lap: 1, fame: 0, lv: 1, skip: k })),
        fountain: FOUNTAIN_START,
        blessing: null, nextRollBonus: 0,
        cleared: Object.fromEntries(Object.keys(DUNGEONS).map((k) => [k, 0])),
        clearedLap: {},              // a cleared dungeon restocks when the next lap begins
        shards: [],
        roamers: [],                 // monsters wandering the board: passing one means a fight
        dragon: { tries: 0, beaten: false },
        phase: 'roll', ctx: {}, after: null, battle: null, move: null,
        over: null,
        stats: { battles: 0, wins: 0, fled: 0, ko: 0, goldEarned: 0, tollsPaid: 0, tollsEarned: 0, rolls: 0, doubles: 0, crafted: 0, chests: 0, cards: 0, maxHit: 0 },
        events: [],
    };
    G.party.push(newMember(G, 'hero'));
    spawnRoamers(G);
    return G;
}

// ================================================================== helpers

const ev = (G, e) => G.events.push(e);
const mats = (G) => G.bag.mats;
export const salaryFor = (G, lap = G.lap) => Math.round((SALARY.base + SALARY.perLap * (lap - 1)) * (ownsSet(G, 'meadow') ? 1.3 : 1));
export const shopDiscount = (G) => (ownsSet(G, 'coast') ? 0.85 : 1);
export const forgeDiscount = (G) => (ownsSet(G, 'frost') ? 0.75 : 1);
export const innCost = (G, town) => Math.round(TOWNS[town].inn + 8 * (G.lap - 1));
export const hireCost = (G, id) => Math.round(COMPANIONS[id].cost * (1 + 0.15 * (G.lap - 1)));
export const completedLaps = (G) => G.lap - 1;
export const space = (G) => SPACES[G.pos];
export const dragonLevel = (G) => Math.round(TUNE.dragonLv(G.laps));

function gainGold(G, amt, why) {
    amt = Math.round(amt);
    if (amt <= 0) return;
    G.gold += amt;
    G.stats.goldEarned += amt;
    ev(G, { type: 'gold', amt, why });
}
function spend(G, amt) {
    amt = Math.round(amt);
    if (G.gold < amt) return false;
    G.gold -= amt;
    return true;
}
function addItem(G, id, n = 1) { G.bag.items[id] = Math.min(99, (G.bag.items[id] || 0) + n); }
function addGear(G, id, n = 1) { G.bag.gear[id] = (G.bag.gear[id] || 0) + n; }
function addMat(G, id, n = 1) { G.bag.mats[id] = (G.bag.mats[id] || 0) + n; }

export function deedToll(G, deedId) {
    const s = DEEDS.find((d) => d.deed === deedId);
    const d = G.deeds[deedId];
    if (!d.owner) return 0;
    const set = regionDeeds(s.region).every((x) => G.deeds[x.deed].owner === d.owner);
    return Math.round(s.price * DEED.toll[d.level] * (set ? DEED.setToll : 1));
}
export const deedIncome = (G, deedId) => Math.round(DEEDS.find((d) => d.deed === deedId).price * DEED.income[G.deeds[deedId].level]);
export const upgradeCost = (G, deedId) => Math.round(DEEDS.find((d) => d.deed === deedId).price * DEED.upgrade * (G.deeds[deedId].level + 1));
export function deedValue(G, deedId) {
    const s = DEEDS.find((d) => d.deed === deedId);
    let v = s.price;
    for (let l = 0; l < G.deeds[deedId].level; l++) v += Math.round(s.price * DEED.upgrade * (l + 1));
    return Math.round(v * DEED.sellBack);
}

function healParty(G, frac = 1, revive = true) {
    for (const m of G.party) {
        const s = stats(G, m);
        if (m.hp <= 0 && !revive) continue;
        m.hp = Math.max(m.hp, Math.round(s.maxhp * frac));
        m.mp = Math.max(m.mp, Math.round(s.maxmp * frac));
        clampMember(G, m);
    }
    ev(G, { type: 'heal', party: G.party.map((m) => m.hp) });
}

export function addXp(G, xp) {
    G.xp += Math.round(xp);
    while (G.level < MAX_LEVEL && G.xp >= xpToNext(G.level)) {
        G.xp -= xpToNext(G.level);
        const before = G.party.map((m) => stats(G, m));
        G.level++;
        G.party.forEach((m, i) => {
            const s = stats(G, m);
            if (m.hp > 0) m.hp += s.maxhp - before[i].maxhp;
            m.mp += s.maxmp - before[i].maxmp;
            clampMember(G, m);
        });
        const learned = [];
        for (const m of [...G.party, ...G.bench]) {
            const d = m.id === 'hero' ? CLASSES[G.cls] : COMPANIONS[m.id];
            for (const sk of d.skills) if (SKILLS[sk].lv === G.level) learned.push({ who: m.id, skill: sk });
        }
        ev(G, { type: 'levelup', level: G.level, learned });
    }
    if (G.level >= MAX_LEVEL) G.xp = 0;
}

/**
 * Monster level: your own level plus the region's danger (Meadowvale is a level gentler,
 * Frostfang two harder), and a little more when you fall behind the island's pace (about 3
 * levels a lap), so every fight is winnable but lagging behind still bites.
 */
export function foeLevel(G, tier) {
    const behind = Math.max(0, pace(G.lap) - G.level);
    return Math.max(1, Math.round(G.level + (tier - 1) * 0.9 + 0.35 * behind));
}

export const dungeonOpen = (G, id) => !(G.clearedLap[id] >= G.lap);

export function shopTier(G, town) {
    return Math.max(1, Math.min(5, G.lap + TOWNS[town].tierBonus));
}

/** What a town sells right now: { items: [id], gear: [id] } with prices. */
export function shopStock(G, town) {
    const T = TOWNS[town];
    const tier = shopTier(G, town);
    const gear = [];
    for (const g of Object.values(GEAR)) {
        if (g.forged || g.slot === 'charm') continue;
        if (g.tier <= tier && g.tier >= tier - 2) gear.push(g.id);
    }
    for (const c of T.charms) gear.push(c);
    return { items: T.items.slice(), gear, tier };
}
export const itemPrice = (G, id) => Math.round(ITEMS[id].price * shopDiscount(G));
export const gearPrice = (G, id) => Math.round(GEAR[id].price * shopDiscount(G));
export const sellPrice = (G, id) => Math.round((GEAR[id].forged ? 120 * GEAR[id].tier : GEAR[id].price * 0.5));

export function canCraft(G, r) {
    for (const [m, n] of Object.entries(r.mats)) if ((mats(G)[m] || 0) < n) return false;
    return G.gold >= Math.round(r.gold * forgeDiscount(G));
}

// ================================================================== the phase machine

/** Every action allowed right now (for the bot, the fuzz test and the UI's enabled states). */
export function options(G) {
    const o = [];
    switch (G.phase) {
        case 'roll':
            o.push({ type: 'roll' });
            if (G.bag.items.boots) o.push({ type: 'roll', item: 'boots' });
            if (G.bag.items.die) for (let n = 2; n <= 12; n++) o.push({ type: 'roll', item: 'die', pick: n });
            if (G.bag.items.warp) for (const s of SPACES) if (s.type === 'town' && s.i !== G.pos) o.push({ type: 'warp', to: s.i });
            break;
        case 'passTown': o.push({ type: 'stop' }, { type: 'go' }); break;
        case 'dragonOffer': o.push({ type: 'climb' }, { type: 'wait' }); break;
        case 'buy': if (G.gold >= SPACES[G.pos].price) o.push({ type: 'buy' }); o.push({ type: 'pass' }); break;
        case 'upgrade': if (G.gold >= upgradeCost(G, SPACES[G.pos].deed)) o.push({ type: 'upgrade' }); o.push({ type: 'pass' }); break;
        case 'dungeonGate': o.push({ type: 'enter' }, { type: 'pass' }); break;
        case 'dungeonCamp': o.push({ type: 'onward' }, { type: 'retreat' }); break;
        case 'portal': for (const s of SPACES) if (s.i !== 30) o.push({ type: 'warpTo', to: s.i }); break;
        case 'reward': case 'defeat': case 'notice': o.push({ type: 'ok' }); break;
        case 'town': {
            const town = G.ctx.town;
            const st = shopStock(G, town);
            for (const id of st.items) if (G.gold >= itemPrice(G, id)) o.push({ type: 'buyItem', item: id });
            for (const id of st.gear) if (G.gold >= gearPrice(G, id)) o.push({ type: 'buyGear', gear: id });
            for (const id of Object.keys(G.bag.gear)) o.push({ type: 'sellGear', gear: id });
            if (G.gold >= innCost(G, town)) o.push({ type: 'inn' });
            const c = TOWNS[town].companion;
            if (!G.hired[c] && G.gold >= hireCost(G, c)) o.push({ type: 'hire', id: c });
            RECIPES.forEach((r, i) => { if (canCraft(G, r)) o.push({ type: 'craft', recipe: i }); });
            o.push({ type: 'leave' });
            break;
        }
        case 'battle': {
            const B = G.battle;
            const u = B?.units[B.turn];
            if (!u) break;
            const foes = B.units.map((x, i) => [x, i]).filter(([x]) => x.side === 'e' && x.alive);
            for (const [, i] of foes) o.push({ type: 'cmd', cmd: 'attack', target: i });
            o.push({ type: 'cmd', cmd: 'defend' });
            break;
        }
    }
    return o;
}

/** Make a decision. Returns '' on success, or why it was refused. */
export function act(G, a) {
    if (G.over) return 'the game is over';
    if (!a || !a.type) return 'no action';
    // things you can do whenever you're not mid-battle or mid-move
    if (['equip', 'unequip', 'use', 'sellDeed', 'swap'].includes(a.type)) {
        if (['battle', 'reward', 'defeat'].includes(G.phase)) return 'not now';
        return fieldAction(G, a);
    }
    switch (G.phase) {
        case 'roll': return a.type === 'roll' ? roll(G, a) : a.type === 'warp' ? warp(G, a.to) : 'roll the dice';
        case 'passTown':
            if (a.type === 'stop') { G.move = null; return land(G); }
            if (a.type === 'go') { G.phase = 'moving'; return walk(G); }
            return 'stop or go';
        case 'dragonOffer':
            if (a.type === 'climb') { G.move = null; return startDragon(G, true); }
            if (a.type === 'wait') { G.dragon.declined = G.lap; G.phase = 'moving'; return G.move ? walk(G) : land(G); }
            return 'climb or wait';
        case 'buy': return a.type === 'buy' ? buyDeed(G) : a.type === 'pass' ? endTurn(G) : 'buy or pass';
        case 'upgrade': return a.type === 'upgrade' ? upgradeDeed(G) : a.type === 'pass' ? endTurn(G) : 'upgrade or pass';
        case 'town': return townAction(G, a);
        case 'dungeonGate':
            if (a.type === 'enter') return dungeonFloor(G, SPACES[G.pos].dungeon, 1);
            if (a.type === 'pass') return endTurn(G);
            return 'enter or pass';
        case 'dungeonCamp':
            if (a.type === 'onward') return dungeonFloor(G, G.ctx.dungeon, G.ctx.floor + 1);
            if (a.type === 'retreat') { ev(G, { type: 'retreat', dungeon: G.ctx.dungeon }); return endTurn(G); }
            return 'onward or retreat';
        case 'battle': {
            if (a.type !== 'cmd') return 'battle command';
            const why = command(G, a);
            if (why) return why;
            if (G.battle.over) afterBattle(G);
            return '';
        }
        case 'reward': case 'defeat': case 'notice':
            if (a.type !== 'ok') return 'ok';
            return resume(G);
        case 'portal':
            if (a.type !== 'warpTo' || !(a.to >= 0 && a.to < BOARD_SIZE) || a.to === 30) return 'pick a space';
            return jump(G, a.to, 'portal');
    }
    return 'nothing to do';
}

// ================================================================== dice and moving

function roll(G, a) {
    let dice;
    if (a.item === 'die') {
        if (!G.bag.items.die) return 'no loaded die';
        const n = Math.max(2, Math.min(12, a.pick | 0));
        G.bag.items.die--;
        const d1 = Math.max(1, Math.min(6, n - Math.min(6, Math.ceil(n / 2))));
        dice = [n - d1, d1];
        if (dice[0] === dice[1] && n !== 12 && n !== 2) dice = [dice[0] + 1, dice[1] - 1];
    } else if (a.item === 'boots') {
        if (!G.bag.items.boots) return 'no boots';
        G.bag.items.boots--;
        dice = [rint(G, 1, 6), rint(G, 1, 6), rint(G, 1, 6)];
    } else dice = [rint(G, 1, 6), rint(G, 1, 6)];
    if (a.item && !G.bag.items[a.item]) delete G.bag.items[a.item];
    let total = dice.reduce((s, d) => s + d, 0);
    const bonus = G.nextRollBonus;
    total += bonus;
    G.nextRollBonus = 0;
    const doubles = dice.length === 2 && dice[0] === dice[1] && !a.item && !G.extraRoll;
    G.stats.rolls++;
    if (doubles) G.stats.doubles++;
    G.rolledDoubles = doubles;
    ev(G, { type: 'dice', who: 'you', dice, bonus, total, doubles });
    G.move = { left: total };
    G.phase = 'moving';
    return walk(G);
}

/** Step along G.move.left spaces, stopping for passing towns, Hearthstone and the end. Every
 *  space walked earns road coins, paid in one go wherever the walk stops, before anything else. */
function walk(G) {
    let coins = 0;
    const pay = () => { gainGold(G, coins, 'road'); coins = 0; };
    while (G.move && G.move.left > 0) {
        const from = G.pos;
        G.pos = (G.pos + 1) % BOARD_SIZE;
        G.move.left--;
        coins += roadGold(G.lap);
        ev(G, { type: 'step', who: 'you', from, to: G.pos, left: G.move.left });
        if (G.pos === 0) {
            pay();
            const r = crossStart(G);
            if (r === 'dragon') { G.move = null; return startDragon(G, false); }
            if (r === 'offer') { G.phase = 'dragonOffer'; G.ctx = { left: G.move.left }; if (!G.move.left) G.move = null; return ''; }
        }
        const foe = G.roamers.find((r) => r.i === G.pos);
        if (foe) {
            pay();
            G.move = null;
            ev(G, { type: 'roamerFight', i: G.pos, id: foe.id });
            return roamerBattle(G, foe);
        }
        const here = SPACES[G.pos];
        if (G.move.left > 0 && (here.type === 'town' || (here.type === 'dungeon' && dungeonOpen(G, here.dungeon)))) {
            pay();
            G.phase = 'passTown';
            G.ctx = { town: here.town || null, dungeon: here.dungeon || null, left: G.move.left };
            return '';
        }
    }
    pay();
    G.move = null;
    return land(G);
}

/** Passing Hearthstone: a lap, a salary, deed income, and perhaps the dragon. */
function crossStart(G) {
    G.lap++;
    const sal = salaryFor(G, G.lap - 1);
    ev(G, { type: 'lap', lap: G.lap, of: G.laps });
    gainGold(G, sal, 'salary');
    let inc = 0;
    for (const s of DEEDS) if (G.deeds[s.deed].owner === 'you') inc += deedIncome(G, s.deed);
    if (inc) gainGold(G, inc, 'income');
    spawnRoamers(G);
    if (completedLaps(G) >= G.laps || G.dragon.tries > 0) return 'dragon';
    if (completedLaps(G) >= G.early) return 'offer';
    return null;
}

/** Move straight to a space (portal, warp scroll, fate card). Passing Hearthstone still counts. */
function jump(G, to, why) {
    const from = G.pos;
    ev(G, { type: 'warp', who: 'you', from, to, why });
    G.pos = to;
    if (to < from || (to === 0 && from !== 0)) {
        const r = crossStart(G);
        if (r === 'dragon') return startDragon(G, false);
    }
    return land(G);
}

function warp(G, to) {
    if (!G.bag.items.warp) return 'no warp scroll';
    if (SPACES[to]?.type !== 'town') return 'warp to a town';
    G.bag.items.warp--;
    if (!G.bag.items.warp) delete G.bag.items.warp;
    return jump(G, to, 'scroll');
}

// ================================================================== landing

function land(G) {
    const s = SPACES[G.pos];
    G.ctx = {};
    ev(G, { type: 'land', who: 'you', i: G.pos, kind: s.type });
    switch (s.type) {
        case 'start': {
            gainGold(G, salaryFor(G) * (SALARY.land - 1), 'feast');
            healParty(G, 1);
            ev(G, { type: 'say', text: 'A feast at Hearthstone! Gold and a full heal.' });
            return endTurn(G);
        }
        case 'shrine': {
            healParty(G, 1);
            G.blessing = pick(G, BLESSINGS);
            ev(G, { type: 'blessing', buff: G.blessing });
            return endTurn(G);
        }
        case 'fountain': {
            const amt = G.fountain;
            G.fountain = 0;
            ev(G, { type: 'fountain', amt });
            gainGold(G, amt, 'fountain');
            return endTurn(G);
        }
        case 'portal':
            G.phase = 'portal';
            return '';
        case 'battle':
            return encounter(G, 'encounter');
        case 'deed': {
            const d = G.deeds[s.deed];
            if (!d.owner) { G.phase = 'buy'; G.ctx = { deed: s.deed }; return ''; }
            if (d.owner === 'you') {
                // the owner collects a little rent from the tenants when visiting
                gainGold(G, deedIncome(G, s.deed) * 0.5, 'rent');
                if (d.level < DEED.maxLevel) { G.phase = 'upgrade'; G.ctx = { deed: s.deed }; return ''; }
                return endTurn(G);
            }
            payToll(G, 'you', d.owner, s.deed);
            return endTurn(G);
        }
        case 'town':
            G.phase = 'town';
            G.ctx = { town: s.town };
            ev(G, { type: 'town', town: s.town });
            return '';
        case 'dungeon':
            if (!dungeonOpen(G, s.dungeon)) {
                ev(G, { type: 'say', text: `${DUNGEONS[s.dungeon].name} is quiet. Its monsters return next lap.` });
                return endTurn(G);
            }
            G.phase = 'dungeonGate';
            G.ctx = { dungeon: s.dungeon };
            return '';
        case 'treasure': return openChest(G);
        case 'fate': return drawFate(G);
    }
    return endTurn(G);
}

function payToll(G, payer, owner, deedId) {
    const toll = deedToll(G, deedId);
    if (payer === 'you') {
        const amt = Math.min(G.gold, toll);
        G.gold -= amt;
        G.stats.tollsPaid += amt;
        rival(G, owner).gold += amt;
        ev(G, { type: 'toll', from: 'you', to: owner, amt, deed: deedId });
    } else {
        const r = rival(G, payer);
        const amt = Math.min(r.gold, toll);
        r.gold -= amt;
        if (owner === 'you') { G.gold += amt; G.stats.tollsEarned += amt; G.stats.goldEarned += amt; }
        else rival(G, owner).gold += amt;
        ev(G, { type: 'toll', from: payer, to: owner, amt, deed: deedId });
    }
}

const rival = (G, id) => G.rivals.find((r) => r.id === id);

function buyDeed(G) {
    const s = SPACES[G.pos];
    if (G.deeds[s.deed].owner) return 'already owned';
    if (!spend(G, s.price)) return 'not enough gold';
    G.deeds[s.deed] = { owner: 'you', level: 0 };
    G.fame += 10;
    ev(G, { type: 'buy', who: 'you', deed: s.deed, price: s.price, set: ownsSet(G, s.region) });
    return endTurn(G);
}

function upgradeDeed(G) {
    const s = SPACES[G.pos];
    const d = G.deeds[s.deed];
    if (d.owner !== 'you' || d.level >= DEED.maxLevel) return 'cannot upgrade';
    if (!spend(G, upgradeCost(G, s.deed))) return 'not enough gold';
    d.level++;
    G.fame += 8;
    ev(G, { type: 'upgrade', who: 'you', deed: s.deed, level: d.level });
    return endTurn(G);
}

// ================================================================== battles

function partyLevelFor(G) { return G.level; }

function pickEnemies(G, region, n, lv) {
    const out = [];
    const table = ENCOUNTERS[region];
    for (let k = 0; k < n; k++) out.push({ id: pick(G, table), lv: Math.max(1, lv + rint(G, -1, 0)) });
    return out;
}

function encounter(G, kind) {
    const region = regionOf(G.pos);
    const tier = REGION_TIER[region];
    const lv = foeLevel(G, tier);
    const r = rand(G);
    let n = G.lap === 1 ? (r < 0.55 ? 1 : 2) : G.lap === 2 ? (r < 0.3 ? 1 : r < 0.85 ? 2 : 3) : (r < 0.15 ? 1 : r < 0.6 ? 2 : 3);
    if (kind === 'ambush' && G.lap > 1) n = Math.max(2, n);   // not two at once while you're still on your own
    G.after = { k: 'endTurn' };
    return battle(G, { kind, region, enemies: pickEnemies(G, region, n, lv), canFlee: true });
}

// ------------------------------------------------------------------ roaming monsters

const ROAM_ON = ['battle', 'deed', 'fate', 'treasure'];
export const roamerCap = (G) => Math.min(4, 1 + Math.floor(G.lap / 2));

/** Top up the wandering monsters, never right in front of the player. */
function spawnRoamers(G) {
    let guard = 0;
    while (G.roamers.length < roamerCap(G) && guard++ < 50) {
        const i = rint(G, 1, BOARD_SIZE - 1);
        const s = SPACES[i];
        if (!ROAM_ON.includes(s.type) || G.roamers.some((r) => r.i === i)) continue;
        const d = (i - G.pos + BOARD_SIZE) % BOARD_SIZE;
        if (d <= 2) continue;
        const r = { i, id: pick(G, ENCOUNTERS[regionOf(i)]) };
        G.roamers.push(r);
        ev(G, { type: 'roamer', i, id: r.id });
    }
}

function roamerBattle(G, foe) {
    const region = regionOf(foe.i);
    const lv = foeLevel(G, REGION_TIER[region]);
    const n = G.lap <= 2 ? rint(G, 0, 1) : rint(G, 1, 2);
    G.after = { k: 'endTurn' };
    return battle(G, { kind: 'roamer', region, roamer: foe.i, enemies: [{ id: foe.id, lv }, ...pickEnemies(G, region, n, lv - 1)], canFlee: true });
}

/** Start a battle (any kind) and handle one that is over before anyone can act. */
export function beginBattle(G, spec, after = { k: 'endTurn' }) {
    if (!G.after) G.after = after;
    return battle(G, spec);
}

function battle(G, spec) {
    G.stats.battles++;
    G.phase = 'battle';
    startBattle(G, spec);
    if (G.battle.over) afterBattle(G);
    return '';
}

/** The level of a dungeon's monsters right now (its boss is one higher). */
export function dungeonLevel(G, id) {
    const D = DUNGEONS[id];
    return Math.max(D.lv, foeLevel(G, REGION_TIER[D.region]) + 1) + G.cleared[id] * 2;
}

function dungeonFloor(G, id, floor) {
    const D = DUNGEONS[id];
    const clears = G.cleared[id];
    const lv = dungeonLevel(G, id);
    G.ctx = { dungeon: id, floor };
    G.after = { k: 'dungeon', dungeon: id, floor };
    if (floor === 1) ev(G, { type: 'dungeon', dungeon: id, floor });
    else ev(G, { type: 'floor', dungeon: id, floor });
    let enemies;
    if (floor < D.floors) enemies = pickEnemies(G, D.region, 3, lv - 1);
    else {
        enemies = [{ id: D.boss, lv }];
        if (G.lap >= 2 || clears) enemies.push(...pickEnemies(G, D.region, 1, lv - 1));
    }
    return battle(G, { kind: floor < D.floors ? 'dungeon' : 'boss', region: D.region, dungeon: { id, floor }, enemies, canFlee: floor < D.floors });
}

export function startDragon(G, early) {
    ev(G, { type: 'dragonWakes', early, tries: G.dragon.tries });
    G.dragon.early = early;
    G.after = { k: 'dragon' };
    G.pos = 0;
    // the villagers of Hearthstone patch you up before the climb
    healParty(G, 1);
    return battle(G, { kind: 'dragon', region: 'dragon', enemies: [{ id: 'pyrrhax', lv: dragonLevel(G) }], canFlee: false, shards: G.shards.length });
}

function afterBattle(G) {
    const B = G.battle;
    const res = B.over;
    if (res === 'win') {
        G.stats.wins++;
        if (B.roamer != null) {
            G.roamers = G.roamers.filter((r) => r.i !== B.roamer);
            ev(G, { type: 'roamerGone', i: B.roamer });
            B.loot.gold = Math.round(B.loot.gold * 1.3);
        }
        const L = B.loot;
        const enemies = B.units.filter((u) => u.side === 'e').length;
        G.fame += 5 * enemies + (B.kind === 'boss' ? 60 : 0);
        gainGold(G, L.gold, 'battle');
        for (const [m, n] of Object.entries(L.mats)) addMat(G, m, n);
        for (const [i, n] of Object.entries(L.items)) addItem(G, i, n);
        const before = G.level;
        addXp(G, L.xp);
        G.ctx = { loot: L, from: before, to: G.level, kind: B.kind };
        if (B.kind === 'boss') {
            const id = B.dungeon.id;
            G.cleared[id]++;
            G.clearedLap[id] = G.lap;
            if (G.cleared[id] === 1) {
                const shard = DUNGEONS[id].shard;
                addMat(G, shard, 1);
                G.shards.push(shard);
                G.fame += 100;
                G.ctx.shard = shard;
                ev(G, { type: 'shard', shard, dungeon: id, count: G.shards.length });
            }
            // the treasure room
            const bonus = Math.round(60 + 40 * G.lap);
            gainGold(G, bonus, 'hoard');
            G.ctx.hoard = bonus;
            const r = DUNGEONS[id].region;
            const pool = Object.keys(MATERIALS).filter((k) => MATERIALS[k].region === r);
            const extra = pick(G, pool);
            addMat(G, extra, 2);
            G.ctx.loot = { ...L, mats: { ...L.mats, [extra]: (L.mats[extra] || 0) + 2 } };
        }
        if (B.kind === 'dragon') {
            G.dragon.beaten = true;
            G.fame += 500 + (G.dragon.early ? 200 : 0) - G.dragon.tries * 100;
            G.over = 'win';
            G.phase = 'victory';
            ev(G, { type: 'victory', score: score(G) });
            return;
        }
        G.phase = 'reward';
        ev(G, { type: 'reward', ...G.ctx });
        return;
    }
    if (res === 'fled') {
        G.stats.fled++;
        ev(G, { type: 'fled' });
        G.battle = null;
        if (G.after?.k === 'dungeon') { ev(G, { type: 'retreat', dungeon: G.after.dungeon }); G.after = { k: 'endTurn' }; }
        resume(G);
        return;
    }
    // defeat
    G.stats.ko++;
    G.stats.koBy = G.stats.koBy || {};
    G.stats.koBy[B.kind] = (G.stats.koBy[B.kind] || 0) + 1;
    if (B.roamer != null) {
        // the monster wanders off, so it can't pin you down
        G.roamers = G.roamers.filter((r) => r.i !== B.roamer);
        ev(G, { type: 'roamerGone', i: B.roamer, fled: true });
    }
    if (B.kind === 'dragon') {
        G.dragon.tries++;
        if (G.dragon.tries >= 2) {
            G.over = 'lose';
            G.phase = 'gameover';
            ev(G, { type: 'gameover', score: score(G) });
            return;
        }
        healParty(G, 0.5);
        G.phase = 'defeat';
        G.ctx = { dragon: true };
        G.after = { k: 'endTurn' };
        ev(G, { type: 'defeat', dragon: true });
        return;
    }
    const lost = Math.round(G.gold * DEFEAT_GOLD_LOSS);
    G.gold -= lost;
    G.fountain += lost;
    const corner = Math.floor(G.pos / 10) * 10;
    G.phase = 'defeat';
    G.ctx = { lost, to: corner };
    G.after = { k: 'endTurn' };
    ev(G, { type: 'defeat', lost, to: corner });
}

/** Carry on after a battle, a reward or a notice. */
function resume(G) {
    if (G.phase === 'defeat' && G.ctx.to != null) {
        const from = G.pos;
        G.pos = G.ctx.to;
        ev(G, { type: 'warp', who: 'you', from, to: G.pos, why: 'rescued' });
        healParty(G, 0.5);
    }
    if (G.phase === 'notice' && G.ctx.then) {
        const then = G.ctx.then;
        G.ctx = {};
        return then.k === 'move' ? (G.move = { left: then.n }, G.phase = 'moving', walk(G))
            : then.k === 'goto' ? jump(G, then.to, 'fate')
                : then.k === 'battle' ? encounter(G, 'ambush')
                    : endTurn(G);
    }
    const after = G.after || { k: 'endTurn' };
    G.after = null;
    G.battle = null;
    if (after.k === 'dungeon') {
        const D = DUNGEONS[after.dungeon];
        if (after.floor >= D.floors) return endTurn(G);
        // a campfire between floors
        for (const m of G.party) {
            const s = stats(G, m);
            if (m.hp > 0) m.hp = Math.min(s.maxhp, m.hp + Math.round(s.maxhp * 0.15));
            m.mp = Math.min(s.maxmp, m.mp + Math.round(s.maxmp * 0.15));
        }
        G.phase = 'dungeonCamp';
        G.ctx = { dungeon: after.dungeon, floor: after.floor };
        ev(G, { type: 'camp', dungeon: after.dungeon, floor: after.floor });
        return '';
    }
    return endTurn(G);
}

// ================================================================== chests and fate

function openChest(G) {
    G.stats.chests++;
    if (G.lap >= 2 && rand(G) < TREASURE.mimicChance) {
        ev(G, { type: 'mimic' });
        G.after = { k: 'endTurn' };
        return battle(G, { kind: 'mimic', region: regionOf(G.pos), enemies: [{ id: 'mimic', lv: foeLevel(G, REGION_TIER[regionOf(G.pos)]) + 1 }], canFlee: true });
    }
    const region = regionOf(G.pos);
    const loot = { gold: 0, items: {}, mats: {}, gear: null };
    const r = rand(G);
    loot.gold = Math.round(rint(G, 30, 70) + 30 * G.lap);
    if (r < 0.45) {
        const it = wpick(G, [['potion', 4], ['hipotion', G.lap >= 2 ? 2 : 0], ['ether', 2], ['phoenix', 1], ['bomb', 1], ['boots', 1], ['die', 1], ['warp', 0.6]]);
        loot.items[it] = 1;
    } else if (r < 0.85) {
        const pool = Object.keys(MATERIALS).filter((k) => MATERIALS[k].region === region);
        const m = pick(G, pool);
        loot.mats[m] = rint(G, 1, 2);
    } else {
        const tier = Math.min(5, G.lap + 1);
        const pool = Object.values(GEAR).filter((g) => !g.forged && g.tier === tier && (g.slot !== 'weapon' || G.party.some((m) => canEquip(G, m, g.id))));
        if (pool.length) loot.gear = pick(G, pool).id;
    }
    gainGold(G, loot.gold, 'chest');
    for (const [k, n] of Object.entries(loot.items)) addItem(G, k, n);
    for (const [k, n] of Object.entries(loot.mats)) addMat(G, k, n);
    if (loot.gear) addGear(G, loot.gear);
    G.phase = 'notice';
    G.ctx = { kind: 'treasure', loot };
    ev(G, { type: 'treasure', loot });
    return '';
}

function drawFate(G) {
    G.stats.cards++;
    const deck = FATE.filter((c) => (c.minLap || 1) <= G.lap);
    const card = wpick(G, deck.map((c) => [c, c.w]));
    const fx = card.fx;
    const res = { card: card.id };
    let then = null;
    if (fx.gold) { const amt = fx.gold[0] + fx.gold[1] * (G.lap - 1); gainGold(G, amt, 'fate'); res.gold = amt; }
    if (fx.fame) G.fame += fx.fame;
    if (fx.healAll) healParty(G, 1);
    if (fx.loseGold) { const amt = Math.round(G.gold * fx.loseGold); G.gold -= amt; G.fountain += amt; res.lost = amt; }
    if (fx.fromRivals) {
        let tot = 0;
        for (const r of G.rivals) { const amt = Math.min(r.gold, fx.fromRivals); r.gold -= amt; tot += amt; }
        gainGold(G, tot, 'festival');
        res.gold = tot;
    }
    if (fx.tax) {
        const n = DEEDS.filter((s) => G.deeds[s.deed].owner === 'you').length;
        const amt = Math.min(G.gold, n * fx.tax);
        G.gold -= amt; G.fountain += amt; res.lost = amt;
    }
    if (fx.blessing) { G.blessing = pick(G, BLESSINGS); res.blessing = G.blessing; }
    if (fx.mats) {
        res.mats = {};
        const region = regionOf(G.pos);
        const pool = Object.keys(MATERIALS).filter((k) => MATERIALS[k].region === region);
        for (let k = 0; k < fx.mats; k++) { const m = pick(G, pool); addMat(G, m); res.mats[m] = (res.mats[m] || 0) + 1; }
    }
    if (fx.items) for (const [k, n] of Object.entries(fx.items)) { addItem(G, k, n); res.items = fx.items; }
    if (fx.hurtAll) for (const m of G.party) { if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.round(stats(G, m).maxhp * fx.hurtAll)); }
    if (fx.nextRoll) G.nextRollBonus += fx.nextRoll;
    if (fx.xp) { const amt = fx.xp[0] + fx.xp[1] * (G.lap - 1); addXp(G, amt); res.xp = amt; }
    if (fx.move) then = { k: 'move', n: fx.move };
    if (fx.goto != null) then = { k: 'goto', to: fx.goto };
    if (fx.toNext) then = { k: 'goto', to: nextOfType(G.pos, fx.toNext) };
    if (fx.battle) then = { k: 'battle' };
    G.phase = 'notice';
    G.ctx = { kind: 'fate', card: card.id, res, then };
    ev(G, { type: 'fate', card: card.id, res });
    return '';
}

// ================================================================== towns

function townAction(G, a) {
    const town = G.ctx.town;
    const T = TOWNS[town];
    switch (a.type) {
        case 'buyItem': {
            const st = shopStock(G, town);
            if (!st.items.includes(a.item)) return 'not sold here';
            const n = Math.max(1, Math.min(9, a.n | 0 || 1));
            if (!spend(G, itemPrice(G, a.item) * n)) return 'not enough gold';
            addItem(G, a.item, n);
            ev(G, { type: 'buyItem', item: a.item, n });
            return '';
        }
        case 'buyGear': {
            const st = shopStock(G, town);
            if (!st.gear.includes(a.gear)) return 'not sold here';
            if (!spend(G, gearPrice(G, a.gear))) return 'not enough gold';
            addGear(G, a.gear);
            ev(G, { type: 'buyGear', gear: a.gear });
            return '';
        }
        case 'sellGear': {
            if (!(G.bag.gear[a.gear] > 0)) return 'not in the bag';
            G.bag.gear[a.gear]--;
            if (!G.bag.gear[a.gear]) delete G.bag.gear[a.gear];
            gainGold(G, sellPrice(G, a.gear), 'sale');
            return '';
        }
        case 'inn': {
            if (!spend(G, innCost(G, town))) return 'not enough gold';
            healParty(G, 1);
            ev(G, { type: 'inn', town });
            return '';
        }
        case 'hire': {
            const id = a.id;
            if (T.companion !== id) return 'they are not here';
            if (G.hired[id]) return 'already hired';
            if (!spend(G, hireCost(G, id))) return 'not enough gold';
            G.hired[id] = true;
            const m = newMember(G, id);
            if (G.party.length < PARTY_MAX) G.party.push(m);
            else G.bench.push(m);
            G.fame += 15;
            ev(G, { type: 'hire', id, benched: G.party.length >= PARTY_MAX && !G.party.includes(m) });
            return '';
        }
        case 'craft': {
            const r = RECIPES[a.recipe];
            if (!r) return 'no such recipe';
            if (!canCraft(G, r)) return 'missing materials or gold';
            for (const [m, n] of Object.entries(r.mats)) { G.bag.mats[m] -= n; if (!G.bag.mats[m]) delete G.bag.mats[m]; }
            spend(G, Math.round(r.gold * forgeDiscount(G)));
            addGear(G, r.out);
            G.stats.crafted++;
            G.fame += 20;
            ev(G, { type: 'craft', gear: r.out });
            return '';
        }
        case 'leave': return endTurn(G);
    }
    return 'not a town action';
}

// ================================================================== equipment and the field

function findMember(G, id) { return G.party.find((m) => m.id === id) || G.bench.find((m) => m.id === id); }

function fieldAction(G, a) {
    switch (a.type) {
        case 'equip': {
            const m = findMember(G, a.member);
            const g = GEAR[a.gear];
            if (!m || !g) return 'who or what?';
            if (!(G.bag.gear[a.gear] > 0)) return 'not in the bag';
            if (!canEquip(G, m, a.gear)) return memberDef(G, m).name || 'cannot use that';
            const old = m.gear[g.slot];
            G.bag.gear[a.gear]--;
            if (!G.bag.gear[a.gear]) delete G.bag.gear[a.gear];
            if (old) addGear(G, old);
            m.gear[g.slot] = a.gear;
            clampMember(G, m);
            ev(G, { type: 'equip', member: m.id, gear: a.gear });
            return '';
        }
        case 'unequip': {
            const m = findMember(G, a.member);
            if (!m || !m.gear[a.slot]) return 'nothing there';
            addGear(G, m.gear[a.slot]);
            m.gear[a.slot] = null;
            clampMember(G, m);
            return '';
        }
        case 'use': {
            const I = ITEMS[a.item];
            if (!I || !I.use.includes('field')) return 'cannot use that here';
            if (!(G.bag.items[a.item] > 0)) return 'none left';
            const list = I.target === 'party' ? G.party : [findMember(G, a.target) || G.party[0]];
            for (const m of list) {
                const s = stats(G, m);
                if (I.target === 'ko' && m.hp > 0) return 'they are standing';
                if (I.target === 'ally' && m.hp <= 0) return 'they are down: use a Phoenix Feather';
                if (I.heal) m.hp = Math.min(s.maxhp, Math.max(m.hp + Math.max(I.min || 0, s.maxhp * I.heal), m.hp));
                if (I.mp) m.mp = Math.min(s.maxmp, m.mp + Math.max(I.min || 0, Math.round(s.maxmp * I.mp)));
                if (I.revive) m.hp = Math.round(s.maxhp * I.revive);
                m.hp = Math.round(m.hp);
            }
            G.bag.items[a.item]--;
            if (!G.bag.items[a.item]) delete G.bag.items[a.item];
            ev(G, { type: 'use', item: a.item, target: a.target });
            return '';
        }
        case 'sellDeed': {
            const d = G.deeds[a.deed];
            if (!d || d.owner !== 'you') return 'not yours';
            const v = deedValue(G, a.deed);
            G.deeds[a.deed] = { owner: null, level: 0 };
            gainGold(G, v, 'deedSale');
            ev(G, { type: 'sellDeed', deed: a.deed, amt: v });
            return '';
        }
        case 'swap': {
            // swap a companion in or out at a tavern (any town)
            if (G.phase !== 'town') return 'only in a town';
            const inIdx = G.bench.findIndex((m) => m.id === a.in);
            const outIdx = G.party.findIndex((m) => m.id === a.out);
            if (a.out === 'hero') return 'you lead the party';
            if (inIdx < 0 && outIdx < 0) return 'who?';
            if (inIdx >= 0 && outIdx >= 0) {
                const [mi] = G.bench.splice(inIdx, 1);
                const [mo] = G.party.splice(outIdx, 1, mi);
                G.bench.push(mo);
            } else if (inIdx >= 0) {
                if (G.party.length >= PARTY_MAX) return 'the party is full';
                G.party.push(G.bench.splice(inIdx, 1)[0]);
            } else G.bench.push(G.party.splice(outIdx, 1)[0]);
            for (const m of G.party) clampMember(G, m);
            ev(G, { type: 'swap', party: G.party.map((m) => m.id) });
            return '';
        }
    }
    return 'unknown';
}

// ================================================================== turns and rivals

function endTurn(G) {
    G.ctx = {};
    G.battle = null;
    G.after = null;
    if (G.over) return '';
    if (G.rolledDoubles && !G.extraRoll) {
        G.extraRoll = true;
        G.rolledDoubles = false;
        G.phase = 'roll';
        ev(G, { type: 'say', text: 'Doubles! Roll again.' });
        return '';
    }
    G.extraRoll = false;
    G.rolledDoubles = false;
    for (const r of G.rivals) rivalTurn(G, r);
    G.turn++;
    for (const m of G.party) {
        if (m.hp <= 0) continue;
        const s = stats(G, m);
        m.hp = Math.min(s.maxhp, m.hp + Math.round(s.maxhp * ROAD_REST.hp));
        m.mp = Math.min(s.maxmp, m.mp + Math.round(s.maxmp * ROAD_REST.mp));
    }
    G.phase = 'roll';
    ev(G, { type: 'turn', turn: G.turn });
    return '';
}

function rivalTurn(G, r) {
    const R = RIVALS.find((x) => x.id === r.id);
    ev(G, { type: 'rivalTurn', who: r.id });
    const dice = [rint(G, 1, 6), rint(G, 1, 6)];
    const total = dice[0] + dice[1];
    ev(G, { type: 'dice', who: r.id, dice, total, bonus: 0 });
    for (let k = 0; k < total; k++) {
        const from = r.pos;
        r.pos = (r.pos + 1) % BOARD_SIZE;
        r.gold += roadGold(r.lap);
        ev(G, { type: 'step', who: r.id, from, to: r.pos, left: total - k - 1 });
        if (r.pos === 0) {
            r.lap++;
            const sal = Math.round(SALARY.base + SALARY.perLap * (r.lap - 2));
            r.gold += sal;
            for (const s of DEEDS) if (G.deeds[s.deed].owner === r.id) r.gold += deedIncome(G, s.deed);
            ev(G, { type: 'rivalLap', who: r.id, lap: r.lap });
        }
    }
    const s = SPACES[r.pos];
    ev(G, { type: 'land', who: r.id, i: r.pos, kind: s.type });
    const foe = G.roamers.find((x) => x.i === r.pos);
    if (foe) {
        const win = rand(G) < 0.5 + R.bravery * 0.3;
        if (win) { G.roamers = G.roamers.filter((x) => x !== foe); r.gold += 30 + 15 * r.lap; r.fame += 10; }
        ev(G, { type: 'rivalFight', who: r.id, win, roamer: foe.i, amt: win ? 30 + 15 * r.lap : 0 });
        if (win) ev(G, { type: 'roamerGone', i: foe.i, by: r.id });
        return;
    }
    const reserve = 60 + 25 * r.lap;
    switch (s.type) {
        case 'deed': {
            const d = G.deeds[s.deed];
            if (!d.owner) {
                if (r.gold >= s.price + reserve * (1.4 - R.greed * 0.6) && rand(G) < 0.35 + R.greed * 0.45) {
                    r.gold -= s.price;
                    G.deeds[s.deed] = { owner: r.id, level: 0 };
                    ev(G, { type: 'buy', who: r.id, deed: s.deed, price: s.price });
                }
            } else if (d.owner === r.id) {
                const cost = upgradeCost(G, s.deed);
                if (d.level < DEED.maxLevel && r.gold >= cost + reserve && rand(G) < 0.4 + R.greed * 0.4) {
                    r.gold -= cost;
                    d.level++;
                    ev(G, { type: 'upgrade', who: r.id, deed: s.deed, level: d.level });
                }
            } else payToll(G, r.id, d.owner, s.deed);
            break;
        }
        case 'battle': case 'dungeon': {
            const win = rand(G) < 0.55 + R.bravery * 0.35;
            const amt = win ? Math.round((s.type === 'dungeon' ? 70 : 25) + 12 * r.lap * (1 + REGION_TIER[s.region] * 0.3)) : 0;
            r.gold += amt;
            if (win) { r.fame += s.type === 'dungeon' ? 30 : 8; r.lv = Math.min(30, r.lv + (s.type === 'dungeon' ? 1 : 0.34)); }
            ev(G, { type: 'rivalFight', who: r.id, win, amt, dungeon: s.type === 'dungeon' });
            break;
        }
        case 'treasure': { const amt = rint(G, 30, 70) + 25 * r.lap; r.gold += amt; ev(G, { type: 'rivalGold', who: r.id, amt }); break; }
        case 'fate': {
            const amt = rint(G, -40, 60);
            if (amt < 0) { const lost = Math.min(r.gold, -amt); r.gold -= lost; G.fountain += lost; ev(G, { type: 'rivalGold', who: r.id, amt: -lost }); }
            else { r.gold += amt; ev(G, { type: 'rivalGold', who: r.id, amt }); }
            break;
        }
        case 'fountain': { const amt = G.fountain; G.fountain = 0; r.gold += amt; ev(G, { type: 'rivalGold', who: r.id, amt, fountain: true }); break; }
        case 'portal': {
            const free = DEEDS.filter((x) => !G.deeds[x.deed].owner);
            const to = free.length ? pick(G, free).i : nextOfType(r.pos, 'town');
            ev(G, { type: 'warp', who: r.id, from: r.pos, to, why: 'portal' });
            if (to < r.pos) { r.lap++; r.gold += Math.round(SALARY.base + SALARY.perLap * (r.lap - 2)); }
            r.pos = to;
            break;
        }
        case 'town': {
            if (r.gold > 300 && rand(G) < 0.3) { r.gold -= 60; r.lv = Math.min(30, r.lv + 0.5); }
            break;
        }
    }
    r.lv = Math.min(30, r.lv);
}

// ================================================================== score and saves

export function score(G) {
    const deeds = DEEDS.filter((s) => G.deeds[s.deed].owner === 'you');
    const deedVal = deeds.reduce((a, s) => a + s.price * (1 + G.deeds[s.deed].level), 0);
    return Math.round(G.fame + G.gold / 5 + deedVal / 5 + G.level * 25 + (G.dragon.beaten ? 1000 : 0));
}

export function rank(G) {
    const s = score(G);
    if (!G.dragon.beaten) return 'C';
    return s >= 2900 ? 'S' : s >= 2400 ? 'A' : s >= 1900 ? 'B' : 'C';
}

/** The richest adventurer on the island, for the HUD's standings. */
export function standings(G) {
    const worth = (gold, owner) => gold + DEEDS.filter((s) => G.deeds[s.deed].owner === owner).reduce((a, s) => a + s.price * (1 + G.deeds[s.deed].level * DEED.upgrade), 0);
    const list = [{ id: 'you', worth: Math.round(worth(G.gold, 'you')) }];
    for (const r of G.rivals) list.push({ id: r.id, worth: Math.round(worth(r.gold, r.id)) });
    return list.sort((a, b) => b.worth - a.worth);
}

export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const G = JSON.parse(JSON.stringify(d));
    G.events = [];
    return G;
}

export { partyLevelFor, SHARDS };
