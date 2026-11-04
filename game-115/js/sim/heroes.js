// Heroes: who they are, what they need (food, sleep, mending, gear) and how they decide what to do
// next. A hero is a small state machine; the view only draws where the sim says they are.

import { WALK_SPEED } from '../config.js';
import { BUILDINGS, stat } from './data/buildings.js';
import { ITEMS, DISH_IDS, canEquip, WEAPON_TYPE } from './data/items.js';
import { HERO_CLASSES, HERO_TRAITS, FIRST_NAMES, HERO_EPITHETS, heroXpNeed } from './data/people.js';
import {
    clamp, nextId, push, toast, note, stock, takeItem, addItem, earn, builtOf, bestLv, hall, locPos, dist, dishPrice, shelfPrice, bedPrice, isNight, hById, bldById,
} from './core.js';
import { makeLook } from './townsfolk.js';

export const QUALITY = [
    { name: 'Common', mul: 1, color: '#9a8c7a' }, { name: 'Fine', mul: 1.08, color: '#6aa84f' },
    { name: 'Rare', mul: 1.17, color: '#4a86c5' }, { name: 'Legendary', mul: 1.3, color: '#e0a030' },
];

export function guildLv(G) { return bestLv(G, 'guild'); }
export function heroCap(G) {
    const gl = guildLv(G);
    return gl ? stat('guild', gl, 'heroes') + G.mods.heroCap : 0;
}
export function heroLvCap(G) { const gl = guildLv(G); return gl ? stat('guild', gl, 'heroLv') : 5; }

export function heroTrait(h) { return HERO_TRAITS[h.trait] || {}; }

export function makeHero(G, cls, lv, quality) {
    const rng = G.rng;
    const h = {
        id: nextId(G), name: `${rng.pick(FIRST_NAMES)}`, epithet: rng.chance(0.5) ? rng.pick(HERO_EPITHETS) : '', cls, look: makeLook(rng), trait: rng.pick(Object.keys(HERO_TRAITS)),
        q: quality, lv, xp: 0, hp: 1, hunger: 85, energy: 90, mood: 60, gold: 10 + lv * 3, equip: { weapon: null, armor: null, charm: null }, pots: [], buffs: [],
        st: 'idle', at: 'plaza', to: null, then: null, t: 0, dur: 0, cool: rng.range(0, 2), shopCool: 0, auto: true, pid: 0, eatN: 0, joined: G.day, quests: 0, spent: 0, earned: 0,
    };
    h.hp = heroStats(G, h).hpMax;
    return h;
}

// ---------------------------------------------------------------- stats
export function heroStats(G, h) {
    const c = HERO_CLASSES[h.cls], L = h.lv - 1, q = QUALITY[h.q].mul;
    const gm = 1 + G.mods.gearMul;
    let hp = (c.base.hp + c.grow.hp * L) * q, atk = (c.base.atk + c.grow.atk * L) * q, def = (c.base.def + c.grow.def * L) * q, luck = (c.base.luck + c.grow.luck * L) + (heroTrait(h).luck || 0);
    for (const slot in h.equip) {
        const it = ITEMS[h.equip[slot]];
        if (!it) continue;
        atk += (it.atk || 0) * gm; def += (it.def || 0) * gm; hp += (it.hp || 0) * gm; luck += (it.luck || 0) * gm;
    }
    return { hpMax: Math.round(hp), atk, def, luck };
}

export function buffPct(h, stat) {
    let p = 0;
    for (const b of h.buffs) if (b.stat === stat || b.stat === 'all') p += b.pct;
    return p;
}

export function heroPower(G, h) {
    const s = heroStats(G, h);
    const t = heroTrait(h);
    let p = s.atk + 0.8 * s.def + 0.12 * s.hpMax + 0.3 * s.luck;
    p *= 1 + (t.power || 0) + G.mods.heroPower + buffPct(h, 'atk') / 100;
    if (h.hunger < 20) p *= 0.8;
    if (h.energy < 15) p *= 0.85;
    if (h.mood > 70) p *= 1.05; else if (h.mood < 30) p *= 0.92;
    p *= 0.55 + 0.45 * clamp(h.hp / s.hpMax, 0.25, 1);
    return p;
}

export function nextXp(h) { return heroXpNeed(h.lv); }
export function giveXp(G, h, xp) {
    if (xp <= 0) return;
    const cap = heroLvCap(G);
    xp *= 1 + G.mods.heroXp + (heroTrait(h).xp || 0) + buffPct(h, 'xp') / 100;
    h.xp += xp;
    while (h.xp >= heroXpNeed(h.lv)) {
        if (h.lv >= cap) { h.xp = Math.min(h.xp, heroXpNeed(h.lv) - 1); break; }
        h.xp -= heroXpNeed(h.lv);
        h.lv++;
        const before = h.hp / heroStats(G, { ...h, lv: h.lv - 1 }).hpMax;
        h.hp = Math.max(h.hp, Math.round(heroStats(G, h).hpMax * clamp(before, 0.3, 1)));
        push(G, { type: 'levelup', hid: h.id, lv: h.lv });
        toast(G, `${h.name} reached level ${h.lv}!`, 'good');
        note(G, `${h.name} reached level ${h.lv}.`);
        if (h.lv > G.stats.maxHeroLv) G.stats.maxHeroLv = h.lv;
    }
}

// ---------------------------------------------------------------- recruiting
export function recruitFee(r) {
    return Math.round((25 + r.lv * r.lv * 3.5) * (1 + (r.q) * 0.35));
}

export function refreshRecruits(G) {
    const gl = guildLv(G);
    if (!gl) { G.recruits = []; return; }
    G.recruits = G.recruits.filter((r) => r.exp > G.day);
    const want = Math.min(6, 2 + gl);
    const classes = Object.keys(HERO_CLASSES);
    let guard = 0;
    while (G.recruits.length < want && guard++ < 20) {
        const rng = G.rng;
        const lv = rng.int(Math.max(1, gl * 3 - 5), gl * 3 + 1);
        const qr = rng();
        const q = qr < 0.04 * gl ? 3 : qr < 0.07 + 0.07 * gl ? 2 : qr < 0.3 + 0.08 * gl ? 1 : 0;
        const h = makeHero(G, rng.pick(classes), lv, q);
        h.epithet = h.epithet || '';
        G.recruits.push({ ...h, exp: G.day + rng.int(2, 4), hero: true });
    }
}

export function hire(G, rid) {
    const i = G.recruits.findIndex((r) => r.id === rid);
    if (i < 0) return { ok: false, why: 'They have moved on.' };
    const r = G.recruits[i];
    if (G.heroes.length >= heroCap(G)) return { ok: false, why: 'The Lodge is full. Upgrade it for more room.' };
    const fee = recruitFee(r);
    if (G.gold < fee) return { ok: false, why: `Needs ${fee} gold.` };
    G.gold -= fee;
    G.recruits.splice(i, 1);
    const { exp, hero, ...h } = r;
    h.st = 'idle'; h.at = 'plaza'; h.cool = 1; h.joined = G.day;
    h.hp = heroStats(G, h).hpMax;
    G.heroes.push(h);
    if (h.lv > G.stats.maxHeroLv) G.stats.maxHeroLv = h.lv;
    push(G, { type: 'hired', hid: h.id });
    toast(G, `${h.name} joined the town!`, 'good');
    return { ok: true, hid: h.id };
}

export function dismiss(G, hid) {
    const h = hById(G, hid);
    if (!h || h.st === 'away') return { ok: false, why: 'Not while they are away.' };
    for (const slot in h.equip) if (h.equip[slot]) addItem(G, h.equip[slot], 1);
    for (const p of h.pots) addItem(G, p, 1);
    G.heroes = G.heroes.filter((x) => x.id !== hid);
    return { ok: true };
}

// ---------------------------------------------------------------- movement
function travel(G, h, loc, then) {
    const a = locPos(G, h.at), b = locPos(G, loc);
    const t = Math.max(0.5, (dist(a, b) * 1.25) / WALK_SPEED);
    h.st = 'walk'; h.to = loc; h.then = then; h.t = t; h.dur = t;
}

function go(G, h, loc, then) {
    if (h.at === loc) beginAction(G, h, then);
    else travel(G, h, loc, then);
}

function idleNow(h, cool = 1) { h.st = 'idle'; h.then = null; h.cool = cool; h.to = null; }

// ---------------------------------------------------------------- what to eat, where to sleep
function pickDish(G, h) {
    let best = null, bs = -1;
    const t = heroTrait(h);
    for (const id of DISH_IDS) {
        if (stock(G, id) <= 0) continue;
        const price = dishPrice(G, id);
        if (price > h.gold) continue;
        const it = ITEMS[id];
        const need = 100 - h.hunger;
        // a drink when only a little hungry; a meal when properly hungry
        const useful = Math.min(it.food, need) + it.mood * 0.6 + (it.buff ? 14 * (t.buffMul || 1) : 0);
        const sc = useful - price * 0.15;
        if (sc > bs) { bs = sc; best = id; }
    }
    return best;
}

function inn(G) { const l = builtOf(G, 'inn'); return l.length ? l[0] : null; }
function bedsFree(G) {
    let total = 0, used = 0;
    for (const b of builtOf(G, 'inn')) total += stat('inn', b.lv, 'beds');
    for (const h of G.heroes) if (h.st === 'sleep' && h.slp === 'inn') used++;
    return total - used;
}

function wantShopItem(G, h) {
    const shop = builtOf(G, 'itemshop')[0];
    if (!shop) return null;
    let best = null, bv = 0;
    const reserve = 14;
    for (const id of G.shelves) {
        if (!id || stock(G, id) <= 0) continue;
        const it = ITEMS[id];
        const price = shelfPrice(G, id);
        if (price + reserve > h.gold) continue;
        let v = 0;
        if (it.cat === 'gear') {
            if (!canEquip(h.cls, it) || it.reqLv > h.lv) continue;
            const cur = ITEMS[h.equip[it.slot]];
            if (cur && cur.tier >= it.tier) continue;
            v = 10 + it.tier * 10 - (cur ? cur.tier * 10 : 0);
        } else if (it.cat === 'potion') {
            if (h.pots.length >= 2) continue;
            v = 8 + it.power * 100;
        } else continue;
        if (v > bv) { bv = v; best = id; }
    }
    return best;
}

// ---------------------------------------------------------------- decisions
function decide(G, h) {
    const s = heroStats(G, h);
    const tv = builtOf(G, 'tavern')[0];
    if (h.hunger < 45) {
        if (tv && h.gold >= 4 && DISH_IDS.some((id) => stock(G, id) > 0 && dishPrice(G, id) <= h.gold)) { h.eatN = 0; return go(G, h, tv.id, { st: 'eat', bid: tv.id }); }
        if (h.hunger < 30) { h.eatN = 0; return go(G, h, 'plaza', { st: 'eat', bid: null }); }
    }
    if (h.hp < s.hpMax * 0.55) {
        const ch = builtOf(G, 'healer')[0];
        if (ch && h.gold >= 3) return go(G, h, ch.id, { st: 'heal', bid: ch.id });
        const nn = inn(G);
        if (nn && bedsFree(G) > 0 && h.gold >= bedPrice(G, nn.lv)) return go(G, h, nn.id, { st: 'sleep', bid: nn.id });
        return go(G, h, 'plaza', { st: 'rest', bid: null });
    }
    const night = isNight(G.t);
    if (h.energy < 32 || (night && h.energy < 72) || (night && h.hp < s.hpMax * 0.8)) {
        const nn = inn(G);
        if (nn && bedsFree(G) > 0 && h.gold >= bedPrice(G, nn.lv)) return go(G, h, nn.id, { st: 'sleep', bid: nn.id });
        if (h.energy < 32 || night) return go(G, h, 'plaza', { st: 'rest', bid: null });
    }
    if (h.shopCool <= 0) {
        const want = wantShopItem(G, h);
        if (want) { const shop = builtOf(G, 'itemshop')[0]; return go(G, h, shop.id, { st: 'shop', bid: shop.id, item: want }); }
        h.shopCool = 25;
    }
    idleNow(h, 1.5);
}

function beginAction(G, h, then) {
    h.at = h.to ?? h.at;
    switch (then.st) {
        case 'eat': return beginEat(G, h, then);
        case 'sleep': {
            const nn = bldById(G, then.bid);
            const price = nn ? bedPrice(G, nn.lv) : 0;
            if (!nn || bedsFree(G) <= 0 || h.gold < price) return go(G, h, 'plaza', { st: 'rest', bid: null });
            h.gold -= price; earn(G, price); G.stats.innGold += price;
            h.st = 'sleep'; h.slp = 'inn'; h.t = 0; h.then = then;
            push(G, { type: 'sleep', hid: h.id });
            return;
        }
        case 'rest': h.st = 'rest'; h.t = 0; h.then = then; return;
        case 'heal': {
            const price = 3;
            if (h.gold >= price) { h.gold -= price; earn(G, price); }
            h.st = 'heal'; h.t = 0; h.then = then; return;
        }
        case 'shop': return beginShop(G, h, then);
        case 'away': h.st = 'away'; h.then = null; return;
        default: idleNow(h);
    }
}

function beginEat(G, h, then) {
    const id = then.bid != null ? pickDish(G, h) : null;
    if (id) {
        const price = dishPrice(G, id);
        h.gold -= price; h.spent += price; earn(G, price); G.stats.tavernGold += price;
        takeItem(G, id, 1);
        h.eatItem = id;
        push(G, { type: 'ate', hid: h.id, item: id });
    } else {
        // nothing to buy: the Guild stew pot, free and plain, so no hero ever starves for good
        const fb = ['berry', 'apple'].find((k) => stock(G, k) > 0);
        if (fb) { takeItem(G, fb, 1); h.eatItem = fb; } else h.eatItem = 'gruel';
    }
    h.st = 'eat'; h.t = 4; h.then = then;
}

function finishEat(G, h) {
    const it = ITEMS[h.eatItem];
    if (h.eatItem === 'gruel') { h.hunger = Math.min(100, h.hunger + 22); h.mood = Math.max(0, h.mood - 2); }
    else {
        h.hunger = Math.min(100, h.hunger + it.food);
        h.mood = Math.min(100, h.mood + (it.mood || 0));
        if (it.buff) {
            const bm = heroTrait(h).buffMul || 1;
            const nb = { stat: it.buff.stat, pct: it.buff.pct * bm, q: it.quests + G.mods.buffDur };
            h.buffs = h.buffs.filter((b) => b.stat !== nb.stat);
            h.buffs.push(nb);
        }
    }
    h.eatItem = null;
    h.eatN++;
    if (h.hunger < 78 && h.eatN < 3 && h.then.bid != null && DISH_IDS.some((id) => stock(G, id) > 0 && dishPrice(G, id) <= h.gold)) return beginEat(G, h, h.then);
    idleNow(h, 1);
}

function beginShop(G, h, then) {
    const id = then.item;
    const it = ITEMS[id];
    const price = shelfPrice(G, id);
    if (!id || stock(G, id) <= 0 || h.gold < price || !G.shelves.includes(id)) { h.shopCool = 15; return idleNow(h); }
    h.gold -= price; h.spent += price; earn(G, price);
    takeItem(G, id, 1);
    G.stats.sold++; G.stats.soldGold += price;
    if (it.cat === 'gear') {
        const old = h.equip[it.slot];
        h.equip[it.slot] = id;
        if (old) addItem(G, old, 1);
        const mx = heroStats(G, h).hpMax;
        h.hp = Math.min(mx, h.hp + (it.hp || 0));
    } else h.pots.push(id);
    push(G, { type: 'sale', hid: h.id, item: id, gold: price });
    h.st = 'shop'; h.t = 3; h.then = then;
}

// ---------------------------------------------------------------- the per-step update
export function tickHeroes(G, dt) {
    const m = G.mods;
    const innLv = bestLv(G, 'inn');
    const chap = builtOf(G, 'healer')[0];
    const moodTarget = clamp(52 + Math.min(22, G.cozy / 12) + m.heroMood + (G.festival ? 15 : 0), 0, 100);
    for (const h of G.heroes) {
        const t = heroTrait(h);
        const sleeping = h.st === 'sleep' || h.st === 'rest';
        h.hunger = Math.max(0, h.hunger - 0.21 * (1 + (t.hungerRate || 0)) * (1 - m.hunger) * dt);
        if (!sleeping) h.energy = Math.max(0, h.energy - 0.17 * (1 + (t.energyRate || 0)) * (h.st === 'away' ? 1.5 : 1) * dt);
        const mt = moodTarget + (t.mood || 0) - (h.hunger < 25 ? 22 : 0) - (h.energy < 20 ? 14 : 0);
        h.mood = clamp(h.mood + clamp(mt - h.mood, -1, 1) * 0.1 * dt, 0, 100);
        h.shopCool -= dt;
        const mx = heroStats(G, h).hpMax;
        switch (h.st) {
            case 'idle':
                h.hp = Math.min(mx, h.hp + mx * 0.0015 * dt);
                h.cool -= dt;
                if (h.cool <= 0) decide(G, h);
                break;
            case 'walk':
                h.t -= dt;
                if (h.t <= 0) { h.at = h.to; const then = h.then; h.to = null; beginAction(G, h, then); }
                break;
            case 'eat':
                h.t -= dt;
                if (h.t <= 0) finishEat(G, h);
                break;
            case 'shop':
                h.t -= dt;
                if (h.t <= 0) idleNow(h, 2);
                break;
            case 'sleep': {
                h.energy = Math.min(100, h.energy + 1.1 * (1 + m.sleep) * dt);
                h.hp = Math.min(mx, h.hp + mx * 0.012 * dt);
                const wake = h.energy >= 96 || (!isNight(G.t) && h.energy >= 72 && h.hp >= mx * 0.85);
                if (wake && h.hp >= mx * 0.8) { h.mood = Math.min(100, h.mood + 4 + innLv * 2); idleNow(h, 1); }
                break;
            }
            case 'rest': {
                h.energy = Math.min(100, h.energy + 0.35 * (1 + m.sleep) * dt);
                h.hp = Math.min(mx, h.hp + mx * 0.004 * dt);
                if ((h.energy >= 85 || (h.energy >= 55 && !isNight(G.t))) && h.hp >= mx * 0.7) idleNow(h, 1);
                break;
            }
            case 'heal': {
                const rate = chap ? stat('healer', chap.lv, 'heal') : 0.03;
                h.hp = Math.min(mx, h.hp + mx * rate * dt);
                if (h.hp >= mx * 0.95) idleNow(h, 1);
                break;
            }
            default: break;
        }
    }
}

export function sendAway(G, h) {
    go(G, h, 'gate', { st: 'away' });
}
export function returnFromQuest(G, h) {
    h.at = 'gate'; h.pid = 0;
    h.shopCool = 0;
    travel(G, h, 'plaza', { st: 'idle' });
}
