// The simulation. Pure: no DOM, no canvas, no Math.random, no clock. Time comes in as dt (step) or as a
// number of seconds (advance, for time spent away); the real-world day comes in through checkIn().
// The view reads G and drains G.events; the UI, the tests and the bot change it only through command().

import { LORE, cleanName, DEFAULT_WAGON, TOWN, TOWNS, REGIONS, STORY, CLASSES, TAVERN, MATS, GOODS, UPGRADES, roadBetween, cartUpCost, cartCap, cookTime, forgeTime, brewTime } from './data.js';
import { SPARKLE, TRAVEL, FOOD, REGEN, OFFLINE, PARTY, QUESTS, monsterXp, monsterGold, RARITY } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { emit, log, clamp, plural } from './core.js';
import {
    makeMember, maxHp, partySlots, cartLevel, partyLevel, partyHealth, xpMult, goldMult, addXp, addCaravanXp,
    makeItem, gainItem, equip, unequip, sellItem, sellJunk, equipBest, upgradeCost,
} from './party.js';
import { makeFoe, rollFoes, wardenFoes, resolveBattle, predictOdds } from './battle.js';
import { autoTrade, logTrade, buy, sell, buyRations, larderCap, cargoUsed, cargoCap } from './economy.js';
import { speed, planNext, roadLevel, isNight, miles, dijkstra, nextWarden, regionOpen } from './world.js';
import { stockTown, autoAccept, accept, onArrive, onKill, newDay, claimPost } from './quests.js';
import { newBook, ensureBook, notePerson, noteFoes, noteWarden, gainMat, notePlace, noteLeg, noteLetter, noteGood } from './book.js';

export const SAVE_VERSION = 1;

/** opts.wagon: the name the player gave the wagon. */
export function newGame(seed = 1, opts = {}) {
    const rng = makeRng(seed);
    const G = {
        v: SAVE_VERSION,
        seed,
        rng,
        t: 0,
        acc: 0,
        wagon: cleanName(opts.wagon),
        level: 1, xp: 0,
        sparkle: null,
        gold: 60, rations: 30, potions: 0,
        up: { wheels: 0, hold: 0, lantern: 0, larder: 0, banner: 0 },
        party: [],
        nextId: 1,
        mats: Object.fromEntries(MATS.map((m) => [m.id, 0])),
        cargo: {},
        pack: [],
        at: 'hearthford', road: null, course: null,
        dwell: 30, busy: 0, busyKind: null, camp: false,
        buffs: { rally: 0, rallyCd: 0, shrine: null, storm: 0 },
        lit: [false, false, false, false, false, false],
        tier: 0, ended: false,
        orders: { route: 'quests', autoTrade: true, autoEquip: true, autoSell: true, autoQuests: true, autoChallenge: false, camp: TRAVEL.campBelow },
        quests: [], board: [], tavern: [], offers: [],
        towns: Object.fromEntries(TOWNS.map((t) => [t.id, { visits: 0, press: {} }])),
        daily: { day: -1, streak: 0, claimed: true, contracts: [] },
        stats: { miles: 0, battles: 0, won: 0, lost: 0, kills: 0, goldEarned: 0, goldSpent: 0, profit: 0, trades: 0, arrivals: 0, quests: 0, items: 0, crafted: 0, cooked: 0, brewed: 0, chests: 0, levelUps: 0, events: 0, eaten: 0 },
        log: [], letters: [STORY.intro],
        book: newBook(),
        seenRegion: [true, false, false, false, false, false],
        leg: null, fightIn: 0, eventIn: 0, foodAcc: 0, hungry: false, oddsCache: null, odo: 0,
        events: [],
        quiet: false,
    };
    G.party.push(makeMember(G, 'captain', 1, rng, 'You'));
    G.party.push(makeMember(G, 'guard', 1, rng, 'Old Tam'));
    // Grandmother left a little kit in the wagon
    for (const m of G.party) for (const slot of ['weapon', 'armor']) {
        const it = makeItem(G, rng, 2, { slot });
        m.gear[slot] = it;
    }
    for (const m of G.party) { m.hp = maxHp(m); notePerson(G, m, 'riding', 'hearthford', true); }
    notePlace(G, 'hearthford');
    G.fightIn = drawMiles(G, TRAVEL.encounterMiles);
    G.eventIn = drawMiles(G, TRAVEL.eventMiles);
    G.towns.hearthford.visits = 1;
    stockTown(G, 'hearthford');
    autoAccept(G);
    log(G, 'story', `Old Tam, who guarded your grandmother's wagon for thirty years, climbs up beside you. ${G.wagon} rolls out of Hearthford.`, true);
    return G;
}

const drawMiles = (G, mean) => -Math.log(1 - G.rng() * 0.999) * mean;

// ------------------------------------------------------------------ time
/** Advance by dt seconds of play. inp = { a }: a is the Rally press. */
export function step(G, inp, dt) {
    if (inp && inp.a) command(G, { type: 'rally' });
    G.acc += dt;
    while (G.acc >= 1 - 1e-9) { G.acc = Math.max(0, G.acc - 1); tick(G); }
}

/** Time away: whole seconds, quietly (no events), through exactly the same rules. */
export function advance(G, secs) {
    const q = G.quiet;
    G.quiet = true;
    for (let i = 0; i < secs; i++) tick(G);
    G.quiet = q;
}

export const offlineCap = (G) => (OFFLINE.baseHours + OFFLINE.hoursPerLantern * G.up.lantern) * 3600;

export function tick(G) {
    G.t++;
    regen(G);
    eat(G);
    craft(G);
    if (G.offers.length) G.offers = G.offers.filter((o) => o.until > G.t || (notePerson(G, o.m, 'passed'), false));
    if (G.busy > 0) { if (--G.busy === 0) G.busyKind = null; return; }
    if (G.at) {
        if (G.dwell > 0) G.dwell--;
        if (G.dwell <= 0) depart(G);
        return;
    }
    if (!G.road) return;
    const anyDown = G.party.some((m) => m.down);
    const h = partyHealth(G);
    if (G.camp) {
        if (h >= TRAVEL.campUntil && !anyDown) {
            G.camp = false;
            emit(G, { type: 'breakCamp' });
        }
        return;
    }
    if (h < G.orders.camp || G.party.every((m) => m.down)) {
        G.camp = true;
        G.stats.camps = (G.stats.camps || 0) + 1;
        emit(G, { type: 'camp' });
        return;
    }
    const sp = speed(G);
    G.road.done += sp; G.odo += sp; G.stats.miles += sp;
    G.fightIn -= sp; G.eventIn -= sp;
    // a sparkle on the road ahead: from a hash of the clock, not G.rng, so time away (where nobody can tap one)
    // plays out exactly like watching; it fades once the caravan rolls past it
    if (G.sparkle && G.odo >= G.sparkle.at) G.sparkle = null;
    if (!G.sparkle && hash3(G.t, G.seed, 777) < SPARKLE.chance) {
        const d = SPARKLE.ahead[0] + hash3(G.t, G.seed, 778) * (SPARKLE.ahead[1] - SPARKLE.ahead[0]);
        if (G.road.done + d < G.road.miles - 0.3) {
            G.sparkle = { id: G.t, at: G.odo + d, x: (hash3(G.t, G.seed, 779) - 0.5) * 1.3 };
            G.stats.sparklesSeen = (G.stats.sparklesSeen || 0) + 1;
            emit(G, { type: 'sparkle' });
        }
    }
    if (G.road.done >= G.road.miles) { arrive(G, G.road.to); return; }
    if (G.fightIn <= 0) {
        G.fightIn = drawMiles(G, TRAVEL.encounterMiles / (isNight(G) ? TRAVEL.nightEncounter : 1));
        roadFight(G);
        return;
    }
    if (G.eventIn <= 0) {
        G.eventIn = drawMiles(G, TRAVEL.eventMiles);
        roadEvent(G);
    }
}

function regen(G) {
    let rate = G.at ? REGEN.camp * 2 : G.camp ? REGEN.camp : REGEN.road;
    if (G.busyKind === 'battle') rate = 0;
    const heal = cartLevel(G, 'healer');
    if (heal) rate *= 1 + (60 + 15 * heal) / 100;
    if (G.rations <= 0 && !G.at) rate *= 0.3;
    for (const m of G.party) {
        const max = maxHp(m);
        if (m.hp >= max) continue;
        m.hp = Math.min(max, m.hp + max * rate);
        if (m.down && m.hp >= max * REGEN.downUntil) m.down = false;
    }
}

function eat(G) {
    if (G.at) return;
    G.foodAcc += FOOD.perMember * G.party.length;
    while (G.foodAcc >= 1) {
        G.foodAcc -= 1;
        if (G.rations > 0) {
            G.rations--;
            G.stats.eaten++;
            if (G.rations === 0 && !G.hungry) {
                G.hungry = true;
                log(G, 'warn', 'The rations ran out. The caravan crawls along hungry until the next town.', true);
                emit(G, { type: 'hungry' });
            }
        }
    }
    if (G.rations > 0) G.hungry = false;
}

function craft(G) {
    for (const m of G.party) {
        const c = m.cls;
        if (c !== 'cook' && c !== 'smith' && c !== 'alchemist') continue;
        const time = c === 'cook' ? cookTime(m.cart) : c === 'smith' ? forgeTime(m.cart) : brewTime(m.cart);
        if (m.timer < time) { m.timer++; continue; }
        if (c === 'cook') {
            if (G.mats.meat < 1 || G.rations >= larderCap(G)) continue;
            G.mats.meat--;
            const n = 3 + m.cart;
            G.rations = Math.min(larderCap(G), G.rations + n);
            G.stats.cooked += n;
            emit(G, { type: 'craft', cls: c, id: m.id });
        } else if (c === 'smith') {
            if (G.mats.ore < 2 || (G.mats.hide < 1 && G.mats.timber < 1)) continue;
            G.mats.ore -= 2;
            if (G.mats.hide >= G.mats.timber) G.mats.hide--; else G.mats.timber--;
            const it = makeItem(G, G.rng, Math.round(partyLevel(G)) + Math.floor(m.cart / 3) + 10 * G.tier, { luck: 0.08 * m.cart });
            G.stats.crafted++;
            gainItem(G, it, `${m.name} forged`);
            emit(G, { type: 'craft', cls: c, id: m.id, rarity: it.rarity });
        } else {
            if (G.mats.herb < 2 || G.potions >= 8 + 2 * m.cart) continue;
            G.mats.herb -= 2;
            G.potions++;
            G.stats.brewed++;
            emit(G, { type: 'craft', cls: c, id: m.id });
        }
        m.timer = 0;
    }
}

// ------------------------------------------------------------------ the road
function depart(G) {
    const next = planNext(G);
    if (!next) { G.dwell = 30; return; }
    const road = roadBetween(G.at, next);
    G.road = { id: road.id, from: G.at, to: next, miles: miles(road), done: 0 };
    G.leg = { fights: 0, won: 0, gold: 0, kills: 0 };
    emit(G, { type: 'depart', from: G.at, to: next });
    G.at = null;
}

function arrive(G, town) {
    const T = TOWN[town], from = G.road.from, leg = G.leg, roadMiles = G.road.miles;
    G.at = town; G.road = null; G.camp = false; G.leg = null; G.sparkle = null;
    G.towns[town].visits++;
    notePlace(G, town);
    noteLeg(G, from, town, roadMiles, leg);
    G.stats.arrivals++;
    if (leg) {
        const fights = leg.fights ? `, ${plural(leg.won, 'fight')} won${leg.fights > leg.won ? ` of ${leg.fights}` : ''}${leg.gold ? ` (+${Math.round(leg.gold)}g)` : ''}` : ', a quiet road';
        log(G, 'road', `${TOWN[from].name} → ${T.name}${fights}.`);
    }
    if (!G.seenRegion[T.region]) {
        G.seenRegion[T.region] = true;
        log(G, 'story', `Into ${REGIONS[T.region].name}. ${STORY.regionIntro[T.region] || ''}`, true);
        emit(G, { type: 'region', region: T.region });
    }
    // the inn
    const fee = Math.round(1.5 * partyLevel(G)) * G.party.length;
    if (G.gold >= fee) {
        G.gold -= fee;
        G.stats.goldSpent += fee;
        for (const m of G.party) { m.hp = maxHp(m); m.down = false; }
    } else for (const m of G.party) { m.hp = Math.max(m.hp, maxHp(m) * 0.5); m.down = false; }
    const bard = G.party.filter((m) => m.cls === 'bard').reduce((a, m) => Math.max(a, m.cart), 0);
    if (bard) {
        const g = Math.round(8 * G.level * (1 + 0.25 * (bard - 1)) * goldMult(G));
        G.gold += g; G.stats.goldEarned += g;
    }
    onArrive(G, town);
    stockTown(G, town);
    if (G.orders.autoQuests) autoAccept(G);
    if (G.orders.autoTrade) logTrade(G, town, autoTrade(G));
    else buyRations(G, larderCap(G));
    if (G.course === town) G.course = null;
    G.dwell = TRAVEL.dwell;
    // a Warden here?
    const w = nextWarden(G);
    if (G.orders.autoChallenge || T.capital) refreshOdds(G);
    if (T.capital && T.region === w && (!G.lit[w] || G.ended)) {
        if (G.orders.autoChallenge && G.oddsCache && G.oddsCache.p >= 0.65) challenge(G);
        else if (G.towns[town].visits === 1 || !G.ended) log(G, 'warden', `The Waystone of ${T.name} is dark. ${REGIONS[w].warden.name} waits beside it.`);
    }
    emit(G, { type: 'arrive', town });
}

/** Cache the odds against the next Warden (the planner and the UI both read them). */
export function refreshOdds(G) {
    const w = nextWarden(G);
    G.oddsCache = { r: w, p: predictOdds(G, wardenFoes(G, w, G.ended), 16), t: G.t };
    return G.oddsCache.p;
}

function rewardsFor(G, foes, warden = false) {
    const lvl = partyLevel(G);
    let xp = 0, gold = 0;
    for (const f of foes) {
        const over = clamp(1 - 0.12 * (lvl - f.level - 2), 0.25, 1);
        xp += monsterXp(f.level) * (f.elite ? 2.5 : 1) * (f.warden ? 14 : 1) * over;
        gold += monsterGold(f.level) * (f.elite ? 2 : 1) * (f.warden ? 25 : 1) * (f.shimmer ? 3 : 1);
    }
    return { xp: Math.round(xp * xpMult(G)), gold: Math.round(gold * goldMult(G) * G.rng.range(0.8, 1.2)) };
}

function applyBattle(G, foes, res, { warden = false, shimmer = false } = {}) {
    G.party.forEach((m, i) => { m.hp = res.hp[i]; if (m.hp <= 0) { m.hp = 0; m.down = true; } });
    G.potions -= res.potions;
    G.stats.battles++;
    if (!warden) noteFoes(G, foes, res.won, regionHere(G));
    if (G.leg) G.leg.fights++;
    const out = { won: res.won, lost: res.lost, gold: 0, xp: 0, drops: {}, item: null };
    if (res.won) {
        G.stats.won++;
        G.stats.kills += foes.length;
        const r = rewardsFor(G, foes, warden);
        out.gold = r.gold; out.xp = r.xp;
        G.gold += r.gold; G.stats.goldEarned += r.gold;
        addCaravanXp(G, r.xp);
        for (const m of G.party) addXp(G, m, m.down ? Math.round(r.xp / 2) : r.xp);
        for (const f of foes) {
            const fam = f.warden ? null : f.fam;
            const drops = f.warden ? { crystal: 1, ore: 1, hide: 1 } : (FAMS[fam] || {});
            for (const mat in drops) {
                const n = f.warden ? 3 : (G.rng.chance(drops[mat]) ? 1 : 0) + (f.elite ? 1 : 0);
                if (n) { gainMat(G, mat, n); out.drops[mat] = (out.drops[mat] || 0) + n; }
            }
        }
        const counts = {};
        for (const f of foes) if (!f.warden) counts[f.fam] = (counts[f.fam] || 0) + 1;
        for (const fam in counts) onKill(G, fam, counts[fam]);
        const gearChance = warden || shimmer ? 1 : 0.1 + (foes.some((f) => f.elite) ? 0.5 : 0);
        if (G.rng.chance(gearChance)) {
            const L = Math.max(...foes.map((f) => f.level));
            const it = makeItem(G, G.rng, L, { luck: warden ? 1.2 : foes.some((f) => f.elite) ? 0.4 : 0.05 * (G.tier + regionHere(G)), minRarity: warden ? 3 : shimmer ? 2 : 0 });
            out.item = { name: it.name, rarity: it.rarity };
            gainItem(G, it, warden ? 'The Warden\'s hoard' : 'Loot');
        }
        if (G.leg) { G.leg.won++; G.leg.gold += r.gold; G.leg.kills += foes.length; }
        if (foes.some((f) => f.elite)) log(G, 'win', `Beat ${foes.find((f) => f.elite).name} (level ${foes[0].level}) on the road. +${r.gold}g.`, true);
    } else if (res.lost) {
        G.stats.lost++;
        const guard = cartLevel(G, 'guard');
        const k = 1 - (guard ? Math.min(60, 20 + 4 * guard) / 100 : 0);
        // a tenth of the purse, but never more than a few fights' worth
        const lost = Math.round(Math.min(G.gold * 0.1, 15 + 6 * foes[0].level) * k);
        G.gold -= lost;
        let cargoLost = '';
        const big = Object.keys(G.cargo).sort((a, b) => G.cargo[b].n - G.cargo[a].n)[0];
        if (big && !warden) {
            const c = G.cargo[big], n = Math.ceil(c.n * 0.3 * k);
            const avg = c.cost / c.n;
            c.n -= n; c.cost -= avg * n;
            if (c.n <= 0) delete G.cargo[big];
            cargoLost = ` and ${n} ${GOODS.find((g) => g.id === big).name}`;
        }
        if (!warden) {
            const F = FAMILIES[foes[0].fam];
            log(G, 'loss', `Routed by ${foes.length === 1 ? 'a ' + foes[0].name.toLowerCase() : `${foes.length} ${F ? F.plural : 'foes'}`}! Lost ${lost}g${cargoLost}. The caravan makes camp to lick its wounds.`, true);
            G.camp = true;
        }
    }
    const L = res.rounds;
    G.busy = TRAVEL.battleTime + Math.round(L * 0.4);
    G.busyKind = 'battle';
    emit(G, {
        type: 'battle', warden,
        foes: foes.map((f) => ({ name: f.name, shape: f.shape, col: f.col, deco: f.deco, shimmer: !!f.shimmer, level: f.level, elite: f.elite, warden: f.warden, hp: f.hp })),
        hits: res.hits, rounds: res.rounds, won: res.won, lost: res.lost, gold: out.gold, xp: out.xp, drops: out.drops, item: out.item,
        dur: G.busy,
    });
    return out;
}

import { FAMILIES } from './data.js';
const FAMS = Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, f.drops]));
const regionHere = (G) => TOWN[G.at || G.road?.to || 'hearthford'].region;

function roadFight(G) {
    const r = G.road;
    const region = TOWN[r.done < r.miles / 2 ? r.from : r.to].region;
    const L = roadLevel(G) + 10 * G.tier + (isNight(G) ? 1 : 0);
    const alive = G.party.filter((m) => !m.down).length;
    const foes = rollFoes(G, G.rng, region, L, alive);
    applyBattle(G, foes, resolveBattle(G, foes, G.rng));
}

const STORMS = ['a summer downpour', 'a sandstorm', 'a fen fog', 'a blizzard', 'an ashfall', 'a starless dark'];

function roadEvent(G) {
    const rng = G.rng;
    const scout = cartLevel(G, 'scout');
    const findK = scout ? 1.5 + 0.1 * scout : 1;
    const region = TOWN[G.road.to].region;
    const slotsFree = G.offers.length < 3;
    const kind = rng.weighted([
        { k: 'cache', weight: 30 * findK },
        { k: 'wanderer', weight: slotsFree ? 16 * findK : 0 },
        { k: 'shrine', weight: 15 },
        { k: 'peddler', weight: 14 },
        { k: 'wheel', weight: 10 },
        { k: 'storm', weight: 10 },
    ]).k;
    G.stats.events++;
    const L = roadLevel(G) + 10 * G.tier;
    if (kind === 'cache') {
        const gold = Math.round((10 + 6 * Math.pow(L, 1.1)) * goldMult(G));
        G.gold += gold; G.stats.goldEarned += gold;
        const mats = [];
        for (let i = rng.int(1, 3); i > 0; i--) {
            const m = rng.weighted([{ k: 'hide', weight: 3 }, { k: 'ore', weight: 3 }, { k: 'timber', weight: 3 }, { k: 'herb', weight: 3 }, { k: 'meat', weight: 2 }, { k: 'crystal', weight: 1 + region }]).k;
            gainMat(G, m); mats.push(m);
        }
        let s = `Found a hidden cache by the road: ${gold}g and ${mats.join(', ')}.`;
        if (rng.chance(0.2)) { const it = makeItem(G, rng, L, { luck: 0.3 }); s += ` And a ${it.name}.`; gainItem(G, it, 'A cache'); }
        log(G, 'event', s);
        emit(G, { type: 'event', kind, gold });
    } else if (kind === 'wanderer') {
        const cls = rng.pick(TAVERN[region]);
        const m = makeMember(G, cls, Math.max(1, G.level - rng.int(0, 1)), rng);
        G.offers.push({ m, until: G.t + PARTY.offerLife });
        notePerson(G, m, 'asked');
        log(G, 'recruit', `Met ${m.name}, a ${CLASSES[cls].name.toLowerCase()} with a ${CLASSES[cls].cart}, who asks to ride with you.`, true);
        emit(G, { type: 'event', kind, name: m.name });
    } else if (kind === 'shrine') {
        const k = rng.pick(['xp', 'might', 'swift']);
        G.buffs.shrine = { kind: k, until: G.t + 480 };
        log(G, 'event', `Prayed at a wayside shrine: ${k === 'xp' ? '+25% experience' : k === 'might' ? '+15% attack' : '+25% speed'} for 8 minutes.`);
        emit(G, { type: 'event', kind, buff: k });
    } else if (kind === 'peddler') {
        const goods = GOODS.filter((g) => regionOpen(G, g.region));
        const g = rng.pick(goods), p = Math.max(1, Math.round(g.base * 0.6));
        const n = Math.max(0, Math.min(5, cargoCap(G) - cargoUsed(G), Math.floor((G.gold * 0.3) / p)));
        if (n > 0) {
            G.gold -= n * p; G.stats.goldSpent += n * p;
            const c = G.cargo[g.id] || (G.cargo[g.id] = { n: 0, cost: 0 });
            c.n += n; c.cost += n * p;
            noteGood(G, g.id, { bought: n, spent: n * p });
            log(G, 'trade', `A pedlar sold you ${n} ${g.name} cheap, at ${p}g each.`);
        } else log(G, 'event', 'A pedlar waved from the verge. You had nothing to trade.');
        emit(G, { type: 'event', kind });
    } else if (kind === 'wheel') {
        const smith = cartLevel(G, 'smith');
        G.busy = smith ? 15 : 40;
        G.busyKind = 'wheel';
        log(G, 'event', smith ? 'A wheel cracked; the smith had it mended in no time.' : 'A wheel cracked. It took a while to mend.');
        emit(G, { type: 'event', kind });
    } else {
        G.buffs.storm = G.t + 90;
        log(G, 'event', `Caught in ${STORMS[region]}. The caravan slows.`);
        emit(G, { type: 'event', kind, region });
    }
}

// ------------------------------------------------------------------ sparkles
/**
 * What a grabbed sparkle holds: gold, a piece of gear, a Shimmering monster to fight, or a fragment of lore.
 * kind forces one (for the tests); otherwise it is rolled. Returns the command result.
 */
export function grabSparkle(G, kind = null) {
    const rng = G.rng;
    const L = Math.max(1, Math.round(partyLevel(G))) + 10 * G.tier;
    const region = TOWN[G.at || G.road?.to || 'hearthford'].region;
    const lore = LORE.map((l, i) => ({ ...l, i })).filter((l) => !G.book.lore.includes(l.i) && regionOpen(G, l.region));
    const canFight = !G.at && G.road && !G.busy && G.party.some((m) => !m.down);
    if (!kind) kind = rng.weighted(Object.entries(SPARKLE.kinds).map(([k, weight]) => ({ k, weight: (k === 'monster' && !canFight) || (k === 'lore' && !lore.length) ? 0 : weight }))).k;
    if (kind === 'monster' && !canFight) kind = 'gold';
    if (kind === 'lore' && !lore.length) kind = 'gold';
    G.stats.sparkles = (G.stats.sparkles || 0) + 1;
    if (kind === 'gold') {
        const gold = Math.round((20 + 9 * Math.pow(L, 1.15)) * goldMult(G) * rng.range(1, 2));
        G.gold += gold; G.stats.goldEarned += gold;
        log(G, 'event', `A sparkle on the road: a pouch someone dropped, with ${gold}g in it.`);
        emit(G, { type: 'sparkleGot', kind, gold });
        return ok(`✨ ${gold} gold!`, { kind, gold });
    }
    if (kind === 'item') {
        const it = makeItem(G, rng, L + 1, { luck: 0.5, minRarity: 1 });
        gainItem(G, it, 'A sparkle on the road');
        log(G, 'loot', `A sparkle on the road: a ${RARITY[it.rarity].name} ${it.name}.`, it.rarity >= 2);
        emit(G, { type: 'sparkleGot', kind, name: it.name, rarity: it.rarity });
        return ok(`✨ ${RARITY[it.rarity].name}: ${it.name}`, { kind, item: it.name, rarity: it.rarity });
    }
    if (kind === 'monster') {
        const fams = REGIONS[region].monsters.filter((f) => !FAMILIES[f].rare);
        const fam = rng.pick(fams);
        const foe = makeFoe(fam, (G.road ? roadLevel(G) : L) + 10 * G.tier + 1, { elite: true });
        foe.name = 'Shimmering ' + FAMILIES[fam].name;
        foe.shimmer = true;
        const foes = [foe];
        if (G.party.length >= 3) foes.push(makeFoe(fam, foe.level - 1));
        log(G, 'fight', `The sparkle was a ${foe.name}, and it wasn't pleased to be grabbed!`, true);
        const res = resolveBattle(G, foes, rng);
        applyBattle(G, foes, res, { shimmer: true });
        if (res.won) log(G, 'win', `Beat the ${foe.name}: three times the gold, and its hoard.`, true);
        emit(G, { type: 'sparkleGot', kind, name: foe.name, won: res.won });
        return ok(`✨ A ${foe.name}!`, { kind, won: res.won });
    }
    const pick = rng.pick(lore.filter((l) => l.region === region).length ? lore.filter((l) => l.region === region) : lore);
    G.book.lore.push(pick.i);
    const xp = Math.round(monsterXp(L) * 3 * xpMult(G));
    addCaravanXp(G, xp);
    for (const m of G.party) addXp(G, m, xp);
    log(G, 'story', `A sparkle on the road: ${pick.title}. (+${xp} xp)`, true);
    emit(G, { type: 'sparkleGot', kind: 'lore', lore: pick.i });
    return ok(`✨ Lore: ${pick.title}`, { kind: 'lore', lore: pick.i });
}

// ------------------------------------------------------------------ the Warden
export function wardenHere(G) {
    if (!G.at) return null;
    const T = TOWN[G.at];
    if (!T.capital) return null;
    const w = nextWarden(G);
    if (T.region !== w) return null;
    if (G.lit[w] && !G.ended) return null;
    return w;
}

function challenge(G) {
    const r = wardenHere(G);
    if (r === null) return { ok: false, msg: 'There is no Warden here.' };
    if (G.party.every((m) => m.down)) return { ok: false, msg: 'Nobody is fit to fight.' };
    const night = G.ended;
    const foes = wardenFoes(G, r, night);
    const res = resolveBattle(G, foes, G.rng);
    const W = REGIONS[r].warden;
    applyBattle(G, foes, res, { warden: true });
    noteWarden(G, r, res.won);
    if (res.won) {
        if (!night) {
            G.lit[r] = true;
            G.letters.push(STORY.waystones[r]);
            if (r === 5) G.ended = true;
            log(G, 'warden', `${W.name} is beaten! The Waystone of ${TOWN[W.town].name} burns again${r < 5 ? `, and the roads into ${REGIONS[r + 1].name} are open` : '. Every road in the realm is lit'}.`, true);
        } else {
            G.tier++;
            log(G, 'warden', `${W.name} falls again, and the Night Roads grow darker: Night ${G.tier}. Monsters everywhere are fiercer, and richer.`, true);
        }
        emit(G, { type: 'warden', region: r, won: true });
    } else {
        log(G, 'warden', `${W.name} was too strong. The party limps back to the inn.`, true);
        emit(G, { type: 'warden', region: r, won: false });
    }
    G.oddsCache = null;
    return { ok: true, won: res.won };
}

// ------------------------------------------------------------------ the real-world day
export function checkIn(G, day) {
    if (day > G.daily.day) newDay(G, day);
}

// ------------------------------------------------------------------ commands
const ok = (msg = '', extra = {}) => ({ ok: true, msg, ...extra });
const no = (msg) => ({ ok: false, msg });

export function command(G, c) {
    switch (c.type) {
        case 'rally': {
            if (G.at || !G.road) return no('Rally on the road.');
            if (G.camp || G.busy) return no('Not now.');
            if (G.buffs.rallyCd > G.t) return no(`Ready in ${G.buffs.rallyCd - G.t}s.`);
            G.buffs.rally = G.t + TRAVEL.rally.time;
            G.buffs.rallyCd = G.t + TRAVEL.rally.cooldown;
            emit(G, { type: 'rally' });
            return ok('Hup! The oxen pick up the pace.');
        }
        case 'course': {
            if (!TOWN[c.town]) return no('No such town.');
            const here = G.at || G.road.to;
            if (G.road && c.town === G.road.from) {
                // turn round
                const r = G.road;
                G.road = { ...r, from: r.to, to: r.from, done: r.miles - r.done };
                G.course = null;
                return ok(`Turning back to ${TOWN[c.town].name}.`);
            }
            const { dist } = dijkstra(G, here);
            if (dist[c.town] === undefined) return no(`No open road to ${TOWN[c.town].name} yet.`);
            if (G.at === c.town) { G.course = null; return no(`You're in ${TOWN[c.town].name}.`); }
            G.course = c.town;
            if (G.at) G.dwell = Math.min(G.dwell, 1);
            return ok(`Course set for ${TOWN[c.town].name}.`);
        }
        case 'clearCourse': G.course = null; return ok();
        case 'orders': {
            if (!(c.key in G.orders)) return no('No such order.');
            if (c.key === 'route' && !['quests', 'trade', 'explore', 'hold'].includes(c.value)) return no('No such route.');
            if (c.key === 'camp') c.value = clamp(+c.value, 0.1, 0.8);
            G.orders[c.key] = c.value;
            if (c.key === 'route' && G.at && c.value !== 'hold') G.dwell = Math.min(G.dwell, 5);
            return ok();
        }
        case 'buy': { if (!G.at) return no('Trade in a town.'); const n = buy(G, c.good, c.n || 1); return n ? ok(`Bought ${n}.`) : no(cargoUsed(G) >= cargoCap(G) ? 'The hold is full.' : 'Not enough gold.'); }
        case 'sell': { if (!G.at) return no('Trade in a town.'); const g = sell(G, c.good, c.n || 1); return g ? ok(`Sold for ${g}g.`) : no('Nothing to sell.'); }
        case 'rations': { if (!G.at) return no('Buy rations in a town.'); const n = buyRations(G, c.n || larderCap(G)); return n ? ok(`Bought ${n} rations.`) : no(G.rations >= larderCap(G) ? 'The larder is full.' : 'Not enough gold.'); }
        case 'hire': {
            const o = G.tavern[c.idx];
            if (!G.at || !o) return no('Nobody to hire.');
            if (G.party.length >= partySlots(G.level)) return no('The caravan is full. Level up for more room.');
            if (G.gold < o.cost) return no('Not enough gold.');
            G.gold -= o.cost; G.stats.goldSpent += o.cost;
            G.party.push(o.m);
            notePerson(G, o.m, 'riding');
            G.tavern.splice(c.idx, 1);
            log(G, 'recruit', `${o.m.name} the ${CLASSES[o.m.cls].name.toLowerCase()} joins, bringing a ${CLASSES[o.m.cls].cart}.`, true);
            emit(G, { type: 'recruit', id: o.m.id });
            return ok(`${o.m.name} joins the caravan!`);
        }
        case 'acceptOffer': {
            const i = G.offers.findIndex((o) => o.m.id === c.id);
            if (i < 0) return no('They have moved on.');
            if (G.party.length >= partySlots(G.level)) return no('The caravan is full. Level up for more room.');
            const m = G.offers[i].m;
            G.offers.splice(i, 1);
            m.hp = maxHp(m);
            G.party.push(m);
            notePerson(G, m, 'riding');
            log(G, 'recruit', `${m.name} the ${CLASSES[m.cls].name.toLowerCase()} joins, bringing a ${CLASSES[m.cls].cart}.`, true);
            emit(G, { type: 'recruit', id: m.id });
            return ok(`${m.name} joins the caravan!`);
        }
        case 'declineOffer': {
            const o = G.offers.find((x) => x.m.id === c.id);
            if (o) notePerson(G, o.m, 'passed');
            G.offers = G.offers.filter((x) => x !== o);
            return ok();
        }
        case 'dismiss': {
            const m = G.party.find((x) => x.id === c.id);
            if (!m || m.cls === 'captain') return no('You can\'t dismiss yourself.');
            for (const s in m.gear) if (m.gear[s]) G.pack.push(m.gear[s]);
            G.party = G.party.filter((x) => x !== m);
            notePerson(G, m, 'parted');
            log(G, 'recruit', `${m.name} and the ${CLASSES[m.cls].cart} part ways with the caravan.`);
            return ok(`${m.name} leaves the caravan.`);
        }
        case 'upgrade': {
            const cost = upgradeCost(G, c.key);
            if (cost === null) return no('Fully upgraded.');
            if (G.gold < cost) return no('Not enough gold.');
            G.gold -= cost; G.stats.goldSpent += cost;
            G.up[c.key]++;
            emit(G, { type: 'upgrade', key: c.key });
            return ok(`${UPGRADES[c.key].name} → ${G.up[c.key]}.`);
        }
        case 'cartUp': {
            const m = G.party.find((x) => x.id === c.id);
            if (!m || m.cls === 'captain') return no('No cart to upgrade.');
            if (m.cart >= cartCap(G.level)) return no(`The caravan must reach level ${(m.cart) * 3} first.`);
            const cost = cartUpCost(m.cls, m.cart);
            if (G.gold < cost.gold) return no('Not enough gold.');
            for (const k in cost.mats) if (G.mats[k] < cost.mats[k]) return no(`Needs ${cost.mats[k]} ${k}.`);
            G.gold -= cost.gold; G.stats.goldSpent += cost.gold;
            for (const k in cost.mats) G.mats[k] -= cost.mats[k];
            m.cart++;
            emit(G, { type: 'upgrade', key: 'cart', id: m.id });
            return ok(`${CLASSES[m.cls].cart} → level ${m.cart}.`);
        }
        case 'equip': return equip(G, c.item, c.member) ? ok() : no('Can\'t equip that.');
        case 'unequip': return unequip(G, c.member, c.slot) ? ok() : no('Nothing there.');
        case 'sellItem': { const v = sellItem(G, c.item); return v ? ok(`Sold for ${v}g.`) : no('No such item.'); }
        case 'sellJunk': { const v = sellJunk(G); return v ? ok(`Sold for ${v}g.`) : no('Nothing to sell.'); }
        case 'equipBest': equipBest(G); return ok('Everyone wears their best.');
        case 'accept': {
            if (G.quests.length >= QUESTS.active) return no(`You can carry ${QUESTS.active} quests at once.`);
            return accept(G, c.id) ? ok('Quest accepted.') : no('That notice is gone.');
        }
        case 'abandon': G.quests = G.quests.filter((q) => q.id !== c.id); return ok();
        case 'challenge': return challenge(G);
        case 'claimPost': { const r = claimPost(G); return r ? ok(`Morning post: ${r.gold}g and a ${r.item.name}.`, r) : no('Already opened today.'); }
        case 'read': noteLetter(G, G.letters.shift()); return ok();
        case 'sparkle': {
            const s = G.sparkle;
            if (!s || (c.id !== undefined && c.id !== s.id)) return no('It faded away.');
            G.sparkle = null;
            return grabSparkle(G);
        }
        case 'bookSeen': G.book.seen = c.n | 0; return ok();
        case 'nameWagon': {
            const name = cleanName(c.name);
            if (name === G.wagon) return ok();
            const was = G.wagon;
            G.wagon = name;
            log(G, 'story', `${was} has a new name painted on her tailboard: ${name}.`);
            return ok(`She's ${name} now.`);
        }
        case 'rest': {
            if (G.at || !G.road) return no('You rest at inns in town.');
            G.camp = !G.camp;
            return ok(G.camp ? 'The caravan makes camp.' : 'Breaking camp.');
        }
        case 'odds': return ok('', { p: refreshOdds(G) });
        default: return no('Unknown command.');
    }
}

// ------------------------------------------------------------------ summaries
/** What to compare against after time away. */
export function snapshot(G) {
    return { t: G.t, gold: G.gold, level: G.level, lit: G.lit.filter(Boolean).length, stats: { ...G.stats }, levels: Object.fromEntries(G.party.map((m) => [m.id, m.level])) };
}

export function chronicle(G, snap) {
    const d = {};
    for (const k in G.stats) d[k] = (G.stats[k] || 0) - (snap.stats[k] || 0);
    const ups = G.party.filter((m) => snap.levels[m.id] !== undefined && m.level > snap.levels[m.id]).map((m) => `${m.name} ${snap.levels[m.id]}→${m.level}`);
    return {
        secs: G.t - snap.t,
        miles: Math.round(d.miles),
        towns: d.arrivals,
        battles: d.battles, won: d.won, lost: d.lost, kills: d.kills,
        goldNet: Math.round(G.gold - snap.gold), goldEarned: Math.round(d.goldEarned),
        quests: d.quests, items: d.items, crafted: d.crafted, cooked: d.cooked, brewed: d.brewed,
        levels: G.level - snap.level, levelUps: ups,
        highlights: G.log.filter((e) => e.t > snap.t && e.hi).slice(-30),
    };
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, quiet, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [], quiet: false };
    G.rng.setState(rngState);
    ensureBook(G);
    if (!G.wagon) G.wagon = DEFAULT_WAGON;
    if (!G.book.lore) G.book.lore = [];
    if (G.sparkle === undefined) G.sparkle = null;
    return G;
}

export { RARITY };
