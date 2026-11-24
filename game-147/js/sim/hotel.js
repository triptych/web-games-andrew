// The inn: rooms and dust, guests, the kitchen, the courtyard, staff, tips, the debt and the day. Pure.
// Everything here runs on the hotel clock, which keeps ticking during expeditions and battles (the idle half of the
// game): staff work, guests tip, rooms gather dust and herbs grow while the party is away.

import { DAY_LEN, HOTEL, COOK } from '../config.js';
import { HEROES, ROOMS, GUESTS, GUEST_REQUESTS, RECIPES, RECIPE_ORDER, ITEMS, CRAFTS, TIERS, LATE, DAILIES, MARKET, RECRUITS, REGIONS, FORAGE } from './data.js';
import { clamp, has, give, take, hasAll, takeAll, joinedHeroes } from './util.js';
import { addBond, bondLevel, dailyBonds } from './bonds.js';

// ------------------------------------------------------------------ state
export function initHotel(G) {
    G.rooms = ROOMS.map((r, i) => ({ id: r.id, open: r.tier === 0, dust: i === 0 ? 70 : 45, guest: null }));
    G.guests = {};                    // id → guest
    G.queue = [];                     // guest ids waiting at the front desk
    G.nextGuest = 1;
    G.arriveT = 12;                   // the first walk-in comes quickly
    G.tipJar = 0;
    G.kitchen = { level: 1 };
    G.cook = null;                    // { r, t0, staff } while a pot is on the stove
    G.pantry = [];                    // cooked meals: { r, q }
    G.garden = { herbs: 3, t: 0 };
    G.staffT = { sweep: 0, forage: 0, desk: 0 };
    G.decor = [];                     // up to decorSlots item ids on display in the lobby
    G.decorSlots = 2;
    G.debt = { tier: 0, paid: 0, due: TIERS[0].due, fees: 0 };
    G.rep = 0;
    G.day = 1;
    G.clock = 0;                      // seconds into the day
    G.daily = { tasks: [], prog: {} };
    G.stats = { swept: 0, checkins: 0, cooked: 0, served: 0, harvested: 0, wins: 0, earned: 0 };
    newDailies(G);
}

export const openRooms = (G) => G.rooms.filter((r) => r.open);
export const bunnies = (room) => Math.ceil(room.dust / HOTEL.bunnyDust - 1e-9);

/** 0–5 stars, in halves, from how dusty the open rooms are. */
export function sparkle(G) {
    const rs = openRooms(G);
    const avg = rs.reduce((a, r) => a + r.dust, 0) / Math.max(1, rs.length);
    return Math.round(10 * (1 - avg / 100)) / 2;
}

/** Is a staff specialty covered right now? A 'both' hero is away while on an expedition. */
export function staffOn(G, role) {
    for (const id of joinedHeroes(G)) {
        if (HEROES[id].staff !== role) continue;
        const h = G.heroes[id];
        if (h.role === 'staff') return id;
        if (h.role === 'both' && !(G.exp && G.party.includes(id))) return id;
    }
    return null;
}

export const recipeUnlocked = (G, r) => {
    const u = RECIPES[r].unlock;
    if (u === 'start') return true;
    if (u === 'tier2') return G.debt.tier >= 2;
    if (u === 'tier3') return G.debt.tier >= 3;
    return G.recruits[u] && G.recruits[u].stage !== 'none';
};
export const unlockedRecipes = (G) => RECIPE_ORDER.filter((r) => recipeUnlocked(G, r));
export const regionUnlocked = (G, reg) => G.debt.tier >= REGIONS[reg].unlock;

// ------------------------------------------------------------------ guests
function rateOf(G, g) {
    const mul = ROOMS.find((r) => r.id === g.room)?.rateMul || 1;
    return Math.round(g.rate * mul * (1 + G.rep / 200));
}

/** A name no one at the inn is using: two guests with one name looked like one person booking two rooms (v1.0.0). */
function freshName(G, names) {
    const used = new Set(Object.values(G.guests).map((g) => g.name));
    const free = names.filter((n) => !used.has(n));
    if (free.length) return G.rng.pick(free);
    const base = G.rng.pick(names);
    for (let i = 2; ; i++) if (!used.has(`${base} ${'I'.repeat(i)}`)) return `${base} ${'I'.repeat(i)}`;
}

function newGuest(G, recruit = null) {
    const id = 'g' + G.nextGuest++;
    if (recruit) {
        G.guests[id] = { id, arch: recruit, recruit, name: HEROES[recruit].short, rate: 0, nights: 99, sat: 70, room: null, req: 'none', reqMeal: null, served: -1, stay: 0 };
    } else {
        const archs = Object.keys(GUESTS).filter((a) => G.rep >= GUESTS[a].minRep);
        const w = archs.map((a) => (a === 'adventurer' ? 3 : a === 'merchant' ? 2 : 1.4));
        let x = G.rng() * w.reduce((a, b) => a + b, 0), arch = archs[0];
        for (let i = 0; i < archs.length; i++) { x -= w[i]; if (x <= 0) { arch = archs[i]; break; } }
        const A = GUESTS[arch];
        const reqRoll = G.rng();
        const meals = RECIPE_ORDER.filter((r) => recipeUnlocked(G, r));
        const req = reqRoll < 0.4 ? 'clean' : reqRoll < 0.75 ? 'meal' : 'none';
        G.guests[id] = {
            id, arch, recruit: null, name: freshName(G, A.names), rate: A.rate, nights: G.rng.int(A.nights[0], A.nights[1]),
            sat: 55, room: null, req, reqMeal: req === 'meal' ? G.rng.pick(meals) : null, served: -1, stay: 0, reqMet: false,
        };
    }
    G.queue.push(id);
    G.events.push({ type: 'guestArrive', guest: id, recruit });
    return id;
}

export function requestText(g) {
    if (g.recruit) return '';
    if (g.req === 'meal') return GUEST_REQUESTS[1].text + RECIPES[g.reqMeal].name;
    return GUEST_REQUESTS.find((q) => q.id === g.req).text;
}

/** Why a guest can't take a room, or null. */
export function checkinBlock(G, gid, rid) {
    const g = G.guests[gid], room = G.rooms.find((r) => r.id === rid);
    if (!g || !G.queue.includes(gid)) return 'No such guest at the desk.';
    if (!room || !room.open) return 'That room isn\'t open yet.';
    if (room.guest) return 'That room is taken.';
    if (g.recruit && RECRUITS[g.recruit].room === 'clean' && bunnies(room) > 1) return `${g.name} wants a cleaner room (1 dust bunny at most).`;
    return null;
}

export function checkin(G, gid, rid, byStaff = false) {
    const why = checkinBlock(G, gid, rid);
    if (why) { G.events.push({ type: 'nope', text: why }); return false; }
    const g = G.guests[gid], room = G.rooms.find((r) => r.id === rid);
    G.queue = G.queue.filter((x) => x !== gid);
    g.room = rid; room.guest = gid;
    g.sat = clamp(g.sat + sparkle(G) * 5, 0, 100);
    G.stats.checkins++;
    G.daily.prog.checkin = (G.daily.prog.checkin || 0) + 1;
    if (g.recruit) G.recruits[g.recruit].stage = 'staying';
    G.events.push({ type: 'checkin', guest: gid, room: rid, byStaff });
    return true;
}

function checkout(G, g) {
    const room = G.rooms.find((r) => r.id === g.room);
    if (g.req === 'clean') g.sat += room && bunnies(room) <= 1 ? 20 : -20;
    if (g.req === 'meal' && !g.reqMet) g.sat -= 10;
    g.sat = clamp(g.sat, 0, 100);
    const pay = rateOf(G, g) * g.stay;
    const tip = Math.max(0, Math.round(pay * (g.sat - 50) / 100));
    const rep = clamp(Math.round((g.sat - 55) / 8), -3, 6);
    G.gold += pay + tip;
    G.stats.earned += pay + tip;
    G.rep = clamp(G.rep + rep, 0, 200);
    if (room) room.guest = null;
    delete G.guests[g.id];
    G.events.push({ type: 'checkout', name: g.name, arch: g.arch, pay, tip, rep, stars: Math.max(1, Math.round(g.sat / 20)) });
}

// ------------------------------------------------------------------ kitchen
export function cookStart(G, r) {
    if (G.cook) return false;
    if (!recipeUnlocked(G, r)) { G.events.push({ type: 'nope', text: 'You don\'t know that recipe yet.' }); return false; }
    if (G.pantry.length >= HOTEL.pantryMax) { G.events.push({ type: 'nope', text: 'The pantry is full. Serve or eat something first.' }); return false; }
    if (!takeAll(G, RECIPES[r].need)) { G.events.push({ type: 'nope', text: 'Not enough ingredients.' }); return false; }
    G.cook = { r, t0: G.t, staff: staffOn(G, 'cook') };
    G.events.push({ type: 'cookStart', r, staff: G.cook.staff });
    return true;
}

/** Where the stir needle is, 0..1 (a triangle wave), and the zone half-widths. */
export function needle(G) {
    if (!G.cook) return null;
    const ph = ((G.t - G.cook.t0) * COOK.needleSpeed) % 1;
    const p = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const k = (G.cook.staff ? 1.4 : 1) * (has(G, 'goldenWhisk') ? 1.3 : 1);
    return { p, perfect: COOK.perfect * k, good: COOK.good * k };
}

export function stir(G, auto = false) {
    if (!G.cook) return false;
    const n = needle(G), d = Math.abs(n.p - 0.5);
    const grade = auto ? 'ok' : d <= n.perfect ? 'perfect' : d <= n.good ? 'good' : 'ok';
    const chef = G.cook.staff;
    let q = 1 + 0.1 * (G.kitchen.level - 1) + (has(G, 'copperPot') ? 0.1 : 0) + (grade === 'perfect' ? 0.2 : grade === 'good' ? 0.1 : 0);
    if (chef) q += 0.15 + 0.04 * bondLevel(G, 'maple', chef);
    q = Math.round(q * 100) / 100;
    const r = G.cook.r;
    G.pantry.push({ r, q });
    G.cook = null;
    G.stats.cooked++;
    G.daily.prog.cook = (G.daily.prog.cook || 0) + 1;
    if (chef) addBond(G, 'maple', chef, grade === 'perfect' ? 9 : 6, 'cooking');
    G.events.push({ type: 'cooked', r, q, grade, stars: mealStars(q), chef });
    return true;
}

export const mealStars = (q) => (q >= 1.5 ? 3 : q >= 1.2 ? 2 : 1);

export function cookCancel(G) {
    if (!G.cook) return false;
    for (const [k, n] of Object.entries(RECIPES[G.cook.r].need)) give(G, k, n);
    G.cook = null;
    return true;
}

export function serve(G, idx, gid) {
    const m = G.pantry[idx], g = G.guests[gid];
    if (!m || !g || !g.room) { G.events.push({ type: 'nope', text: 'Serve meals to guests in their rooms.' }); return false; }
    if (g.served === G.day) { G.events.push({ type: 'nope', text: `${g.name} has already eaten today.` }); return false; }
    const R = RECIPES[m.r];
    G.pantry.splice(idx, 1);
    g.served = G.day;
    let fav = false;
    if (g.recruit) {
        fav = HEROES[g.recruit].fav === m.r || RECRUITS[g.recruit].meal === m.r;
        if (fav) G.recruits[g.recruit].meal = true;
        G.events.push({ type: 'served', guest: gid, name: g.name, r: m.r, gold: 0, fav, recruit: g.recruit });
        checkRecruit(G, g.recruit);
    } else {
        fav = g.req === 'meal' && g.reqMeal === m.r;
        if (fav) g.reqMet = true;
        const gold = Math.round(R.price * m.q * (fav ? 1.5 : 1));
        g.sat = clamp(g.sat + R.sat * (fav ? 2 : 1), 0, 100);
        G.gold += gold;
        G.stats.earned += gold;
        G.events.push({ type: 'served', guest: gid, name: g.name, r: m.r, gold, fav });
    }
    G.stats.served++;
    G.daily.prog.serve = (G.daily.prog.serve || 0) + 1;
    return true;
}

export function craft(G, item) {
    const need = CRAFTS[item];
    if (!need || !takeAll(G, need)) { G.events.push({ type: 'nope', text: 'Not enough ingredients.' }); return false; }
    give(G, item, 1);
    G.events.push({ type: 'crafted', item });
    return true;
}

// ------------------------------------------------------------------ rooms and the courtyard
export function sweep(G, rid, byStaff = false) {
    const room = G.rooms.find((r) => r.id === rid);
    if (!room || !room.open || room.dust <= 0) return false;
    room.dust = Math.max(0, room.dust - HOTEL.bunnyDust);
    if (room.dust < 0.5) room.dust = 0;
    const fluffP = (byStaff ? 0.25 : 0.35) + (has(G, 'turboBroom') ? 0.2 : 0);
    const fluff = G.rng() < fluffP;
    if (fluff) give(G, 'fluff');
    if (!byStaff) {
        G.stats.swept++;
        G.daily.prog.clean = (G.daily.prog.clean || 0) + 1;
        const hk = staffOn(G, 'housekeeper');
        if (hk) addBond(G, 'maple', hk, 1, 'cleaning');
    }
    G.events.push({ type: 'sweep', room: rid, fluff, byStaff, left: bunnies(room) });
    return true;
}

export function harvest(G, byStaff = false) {
    const n = Math.floor(G.garden.herbs);
    if (n <= 0) return false;
    G.garden.herbs -= n;
    give(G, 'herbs', n);
    if (!byStaff) {
        G.stats.harvested += n;
        G.daily.prog.harvest = (G.daily.prog.harvest || 0) + n;
        if (G.recruits.fern.stage === 'staying') { G.recruits.fern.count = (G.recruits.fern.count || 0) + n; checkRecruit(G, 'fern'); }
    }
    G.events.push({ type: 'harvest', n, byStaff });
    return true;
}

// ------------------------------------------------------------------ recruits
export function recruitTaskDone(G, hero) {
    const R = RECRUITS[hero], s = G.recruits[hero];
    if (s.task) return true;
    const t = R.task;
    if (t.kind === 'item') return has(G, t.item, t.n);
    if (t.kind === 'harvest') return (s.count || 0) >= t.n;
    if (t.kind === 'sparkle') return sparkle(G) >= t.n;
    return false;
}

/** When a staying stranger has their room, their favourite meal and their task done, they're ready to join. */
export function checkRecruit(G, hero) {
    const s = G.recruits[hero];
    if (s.stage !== 'staying') return;
    if (!s.task && recruitTaskDone(G, hero)) {
        const t = RECRUITS[hero].task;
        if (t.kind === 'item') take(G, t.item, t.n);
        s.task = true;
        // Ember cooks her grandmother's stew with the pepper you brought, and leaves it in the pantry for you to serve
        if (hero === 'ember' && G.pantry.length < HOTEL.pantryMax + 1) { G.pantry.push({ r: 'emberStew', q: 1.25 }); G.events.push({ type: 'cooked', r: 'emberStew', q: 1.25, grade: 'gift', stars: 2, chef: 'ember' }); }
        G.events.push({ type: 'recruitTask', hero });
    }
    if (s.task && s.meal && s.stage === 'staying') {
        s.stage = 'ready';
        G.events.push({ type: 'recruitReady', hero });
    }
}

export function recruit(G, hero, role) {
    const s = G.recruits[hero];
    if (!s || s.stage !== 'ready') return false;
    s.stage = 'joined';
    const h = G.heroes[hero];
    h.joined = true;
    h.lv = Math.max(h.lv, G.heroes.maple.lv - 1);
    h.role = ['party', 'staff', 'both'].includes(role) ? role : 'both';
    // their guest room frees up; they move into the staff quarters
    for (const g of Object.values(G.guests)) if (g.recruit === hero) {
        const room = G.rooms.find((r) => r.id === g.room);
        if (room) room.guest = null;
        delete G.guests[g.id];
    }
    G.queue = G.queue.filter((id) => G.guests[id]);
    if (h.role !== 'staff' && G.party.length < 4) G.party.push(hero);
    addBond(G, 'maple', hero, 10, 'joined');
    G.scenes.push('joined');
    G.events.push({ type: 'recruited', hero, role: h.role });
    return true;
}

export function setRole(G, hero, role) {
    const h = G.heroes[hero];
    if (!h?.joined || hero === 'maple' || !['party', 'staff', 'both'].includes(role)) return false;
    h.role = role;
    if (role === 'staff') G.party = G.party.filter((x) => x !== hero);
    else if (!G.party.includes(hero) && G.party.length < 4) G.party.push(hero);
    return true;
}

export function toggleParty(G, hero) {
    const h = G.heroes[hero];
    if (!h?.joined || hero === 'maple') return false;
    if (G.party.includes(hero)) { G.party = G.party.filter((x) => x !== hero); return true; }
    if (h.role === 'staff' || G.party.length >= 4) return false;
    G.party.push(hero);
    return true;
}

// ------------------------------------------------------------------ shop, gear, decor
export function buy(G, item) {
    const it = ITEMS[item];
    if (!it || !MARKET.includes(item)) return false;
    if (it.cat === 'tools' && has(G, item)) return false;
    if (G.gold < it.price) { G.events.push({ type: 'nope', text: 'Not enough gold.' }); return false; }
    G.gold -= it.price;
    give(G, item);
    G.events.push({ type: 'bought', item });
    return true;
}

export function sell(G, item) {
    const it = ITEMS[item];
    if (!it || !has(G, item) || it.cat === 'quest' || it.cat === 'tools' || !it.price) return false;
    for (const h of Object.values(G.heroes)) if ((h.weapon === item || h.acc === item) && (G.inv[item] || 0) <= 1) return false;
    take(G, item);
    const g = Math.floor(it.price / 2);
    G.gold += g;
    G.events.push({ type: 'sold', item, gold: g });
    return true;
}

export function sellMeal(G, idx) {
    const m = G.pantry[idx];
    if (!m) return false;
    G.pantry.splice(idx, 1);
    const g = Math.round(RECIPES[m.r].price * m.q * 0.5);
    G.gold += g;
    G.events.push({ type: 'sold', meal: m.r, gold: g });
    return true;
}

/** Gear in the bag that isn't worn by somebody else. */
export function freeCount(G, item, except = null) {
    let n = G.inv[item] || 0;
    for (const [id, h] of Object.entries(G.heroes)) if (id !== except && (h.weapon === item || h.acc === item)) n--;
    return n;
}

export function equip(G, hero, item) {
    const it = ITEMS[item], h = G.heroes[hero];
    if (!it || it.cat !== 'gear' || !h || (it.hero && it.hero !== hero)) return false;
    if (freeCount(G, item, hero) <= 0) return false;
    h[it.slot] = item;
    G.events.push({ type: 'equip', hero, item });
    return true;
}

export function placeDecor(G, item) {
    if (ITEMS[item]?.cat !== 'decor' || !has(G, item)) return false;
    if (G.decor.includes(item)) { G.decor = G.decor.filter((d) => d !== item); return true; }
    if (G.decor.length >= G.decorSlots) G.decor.shift();
    G.decor.push(item);
    G.events.push({ type: 'decor', item });
    return true;
}

export const decorRep = (G) => G.decor.reduce((a, d) => a + (ITEMS[d].rep || 0), 0);

// ------------------------------------------------------------------ the debt
export function pay(G, amount) {
    if (G.debt.tier >= TIERS.length) return false;
    const T = TIERS[G.debt.tier];
    const owe = T.amount + G.debt.fees - G.debt.paid;
    const n = Math.min(Math.floor(amount), G.gold, owe);
    if (n <= 0) return false;
    G.gold -= n;
    G.debt.paid += n;
    G.events.push({ type: 'paid', n });
    if (G.debt.paid >= T.amount + G.debt.fees) tierUp(G);
    return true;
}

export const owed = (G) => (G.debt.tier >= TIERS.length ? 0 : TIERS[G.debt.tier].amount + G.debt.fees - G.debt.paid);
export const totalOwed = (G) => owed(G) + TIERS.slice(G.debt.tier + 1).reduce((a, t) => a + t.amount, 0);

function tierUp(G) {
    const tier = ++G.debt.tier;
    G.debt.paid = 0; G.debt.fees = 0;
    if (tier < TIERS.length) G.debt.due = Math.max(TIERS[tier].due, G.day + 4);
    if (tier === 1) G.kitchen.level = 2;
    if (tier === 2) for (const r of G.rooms) if (ROOMS.find((x) => x.id === r.id).tier <= 2) r.open = true;
    if (tier === 3) { G.kitchen.level = 3; G.decorSlots = 3; }
    if (tier === 4) for (const r of G.rooms) r.open = true;
    G.rep = clamp(G.rep + 5, 0, 200);
    G.scenes.push('tier' + tier);
    G.events.push({ type: 'tierUp', tier });
    if (tier >= TIERS.length) { G.won = true; G.events.push({ type: 'debtFree' }); }
}

function lateCheck(G) {
    if (G.debt.tier >= TIERS.length || G.day <= G.debt.due) return;
    const fee = Math.round(owed(G) * LATE.feePct);
    G.debt.fees += fee;
    G.debt.due = G.day + LATE.graceDays;
    G.late = (G.late || 0) + 1;
    G.scenes.push('late');
    G.events.push({ type: 'late', fee });
}

// ------------------------------------------------------------------ dailies
function newDailies(G) {
    const pool = DAILIES.slice();
    const tasks = [];
    for (let i = 0; i < 3 && pool.length; i++) {
        const d = pool.splice(Math.floor(G.rng() * pool.length), 1)[0];
        const n = G.rng.int(d.n[0], d.n[1]);
        tasks.push({ id: d.id, n, gold: d.gold + (n - d.n[0]) * 10, done: false });
    }
    G.daily = { tasks, prog: {} };
}

function checkDailies(G) {
    for (const t of G.daily.tasks) {
        if (!t.done && (G.daily.prog[t.id] || 0) >= t.n) {
            t.done = true;
            G.gold += t.gold;
            G.rep = clamp(G.rep + 1, 0, 200);
            G.events.push({ type: 'dailyDone', id: t.id, gold: t.gold });
        }
    }
}

// ------------------------------------------------------------------ the clock
function dayEnd(G) {
    for (const g of Object.values(G.guests)) {
        if (!g.room || g.recruit) continue;
        g.stay++;
        g.nights--;
        if (g.nights <= 0) checkout(G, g);
    }
    // walk-ins who waited all day go elsewhere
    G.queue = G.queue.filter((id) => {
        const g = G.guests[id];
        if (g && !g.recruit && g.waited > DAY_LEN * 0.6) { delete G.guests[id]; return false; }
        return true;
    });
    dailyBonds(G);
    G.day++;
    G.clock = 0;
    newDailies(G);
    lateCheck(G);
    G.events.push({ type: 'newDay', day: G.day });
}

/** Advance the inn by dt seconds. */
export function hotelStep(G, dt) {
    G.clock += dt;
    const spray = has(G, 'sparkleSpray') ? 0.75 : 1;
    for (const r of G.rooms) {
        if (!r.open) continue;
        r.dust = Math.min(100, r.dust + (r.guest ? HOTEL.dustOccupied : HOTEL.dustEmpty) * spray * dt);
    }
    // walk-in guests
    G.arriveT -= dt;
    if (G.arriveT <= 0) {
        const free = openRooms(G).some((r) => !r.guest);
        if (G.queue.length < HOTEL.queueMax && free) newGuest(G);
        G.arriveT = HOTEL.arriveBase * (1 - Math.min(0.5, (G.rep + decorRep(G)) / 200)) * (0.8 + 0.4 * G.rng());
    }
    for (const id of G.queue) { const g = G.guests[id]; if (g) g.waited = (g.waited || 0) + dt; }
    // tips trickle in from occupied rooms
    const sp = sparkle(G);
    const concierge = staffOn(G, 'concierge');
    let tips = 0;
    for (const r of G.rooms) {
        const g = r.guest && G.guests[r.guest];
        if (g && !g.recruit) tips += rateOf(G, g) * HOTEL.tipRate * (sp / 5) * (concierge ? 1.25 : 1) * dt;
    }
    G.tipJar += tips;
    if (G.tipJar >= 1) { const n = Math.floor(G.tipJar); G.tipJar -= n; G.gold += n; G.stats.earned += n; G.tipsToday = (G.tipsToday || 0) + n; }
    // the courtyard
    const gardener = staffOn(G, 'gardener');
    if (G.garden.herbs < HOTEL.herbCap) G.garden.herbs = Math.min(HOTEL.herbCap, G.garden.herbs + dt / (HOTEL.herbEvery / (gardener ? 2 : 1)));
    // staff at work
    if (concierge) {
        G.staffT.desk += dt;
        if (G.staffT.desk >= 3) {
            G.staffT.desk = 0;
            const gid = G.queue.find((id) => !G.guests[id]?.recruit);
            const room = openRooms(G).filter((r) => !r.guest).sort((a, b) => a.dust - b.dust)[0];
            if (gid && room) checkin(G, gid, room.id, true);
        }
    }
    const hk = staffOn(G, 'housekeeper');
    if (hk) {
        G.staffT.sweep += dt * (has(G, 'turboBroom') ? 1.5 : 1);
        if (G.staffT.sweep >= HOTEL.staffSweepEvery) {
            G.staffT.sweep = 0;
            const room = openRooms(G).filter((r) => r.dust >= HOTEL.bunnyDust * 0.5).sort((a, b) => b.dust - a.dust)[0];
            if (room) sweep(G, room.id, true);
        }
    }
    if (gardener) {
        if (G.garden.herbs >= 4) harvest(G, true);
        G.staffT.forage += dt;
        if (G.staffT.forage >= HOTEL.forageEvery) {
            G.staffT.forage = 0;
            const pool = [...FORAGE.home];
            if (regionUnlocked(G, 'grove')) pool.push(...FORAGE.grove);
            if (regionUnlocked(G, 'cave') && G.rng() < 0.4) pool.push(...FORAGE.cave);
            const it = G.rng.pick(pool);
            give(G, it);
            G.events.push({ type: 'forage', item: it, hero: gardener });
        }
    }
    // a pot left on the stove stirs itself (no bonus)
    if (G.cook && G.t - G.cook.t0 > 8) stir(G, true);
    for (const h of Object.keys(G.recruits)) if (G.recruits[h].stage === 'staying') checkRecruit(G, h);
    checkDailies(G);
    if (G.clock >= DAY_LEN) dayEnd(G);
}

/** Skip to the next morning (a nap at the desk): the rest of the day passes as idle time. */
export function sleep(G) {
    const left = DAY_LEN - G.clock;
    for (let t = 0; t < left - 1e-6; t += 1) hotelStep(G, Math.min(1, left - t));
    G.events.push({ type: 'slept' });
}

/** Time away (a closed tab): the inn keeps running, capped. Returns what changed for the welcome-back card. */
export function idleCatchUp(G, secs) {
    const cap = HOTEL.idleCapDays * DAY_LEN;
    const s = Math.min(cap, Math.max(0, secs));
    const gold0 = G.gold, day0 = G.day;
    const inv0 = { ...G.inv };
    for (let t = 0; t < s; t += 1) hotelStep(G, Math.min(1, s - t));
    const items = {};
    for (const [k, n] of Object.entries(G.inv)) if (n > (inv0[k] || 0)) items[k] = n - (inv0[k] || 0);
    return { secs: s, gold: G.gold - gold0, days: G.day - day0, items };
}

export { hasAll, newGuest };
