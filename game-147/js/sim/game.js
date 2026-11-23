// The simulation hub. Pure: no DOM, no rendering library, no Math.random, no clock.
//   newGame(seed) → G;  step(G, dt, { hold });  act(G, cmd) → bool;  serialize / deserialize.
// The view reads G and drains G.events; the UI, the bot and the tests all go through act().

import { HEROES, RECIPES, REGIONS, ITEMS, SCENES, VIGNETTES } from './data.js';
import { makeRng } from '../rng.js';
import { gearScore, joinedHeroes } from './util.js';
import * as H from './hotel.js';
import { startBattle, battleAct, battleStep } from './battle.js';
import { aiPick } from './ai.js';
import { questStep, bossOpen } from './quests.js';

export const SAVE_V = 1;

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed), t: 0,
        mode: 'hotel',                 // hotel | expedition | battle
        gold: 120,
        heroes: {}, party: ['maple'],
        recruits: {}, bonds: {},
        inv: { flour: 4, honey: 2, herbs: 2, honeyDrop: 2, featherDuster: 1 },
        quest: { chapter: 0, goal: 0 }, bossesBeaten: [], flags: {},
        scenes: ['intro'], vignettes: [], seenVignettes: [],
        exp: null, battle: null, auto: false, preset: 'balanced', won: false,
        events: [],
    };
    for (const id of Object.keys(HEROES)) {
        G.heroes[id] = { lv: 1, exp: 0, hp: null, mp: null, joined: id === 'maple', role: id === 'maple' ? 'party' : 'both', weapon: HEROES[id].weapon, acc: null };
        G.inv[HEROES[id].weapon] = 1;
        if (id !== 'maple') G.recruits[id] = { stage: 'none', meal: false, task: false };
    }
    H.initHotel(G);
    return G;
}

/** Advance dt seconds. hold = the view is animating a battle action, so the AI waits. */
export function step(G, dt, { hold = false } = {}) {
    G.t += dt;
    H.hotelStep(G, dt);
    if (G.battle) battleStep(G, dt, hold, aiPick);
    questStep(G);
}

// ------------------------------------------------------------------ expeditions
/** The buffs an expedition starts with: the meal eaten (scaled by its quality) and Fresh Linens. */
export function expeditionBuffs(G, meal) {
    const b = {};
    if (meal) for (const [k, v] of Object.entries(RECIPES[meal.r].buff)) b[k] = Math.round(v * meal.q * 1000) / 1000;
    if (freshLinens(G)) { b.spd = (b.spd || 0) + 0.1; b.eva = (b.eva || 0) + 10; }
    return b;
}
export const freshLinens = (G) => H.openRooms(G).every((r) => H.bunnies(r) <= 1);

function depart(G, region, mealIdx) {
    if (G.mode !== 'hotel' || !REGIONS[region] || !H.regionUnlocked(G, region)) return false;
    const meal = mealIdx != null && mealIdx >= 0 ? G.pantry[mealIdx] : null;
    if (meal) G.pantry.splice(mealIdx, 1);
    for (const id of G.party) { G.heroes[id].hp = null; G.heroes[id].mp = null; }
    G.exp = { region, wins: 0, buffs: expeditionBuffs(G, meal), meal: meal?.r || null, mealQ: meal?.q || 0, linens: freshLinens(G), chain: 0 };
    G.mode = 'expedition';
    G.events.push({ type: 'depart', region, meal: meal?.r || null, linens: G.exp.linens });
    return true;
}

function fight(G, boss) {
    if (G.mode !== 'expedition') return false;
    if (boss && !bossOpen(G, G.exp.region)) return false;
    startBattle(G, !!boss);
    return true;
}

function battleDone(G) {
    const B = G.battle;
    if (!B || !['won', 'lost', 'fled'].includes(B.phase)) return false;
    G.battle = null;
    if (B.phase === 'lost') {
        goHome(G);
        G.events.push({ type: 'wokeUp' });
        return true;
    }
    G.mode = 'expedition';
    // a breather between fights: 20% MP back
    for (const id of G.party) {
        const h = G.heroes[id];
        if (h.mp != null) { const mmp = Math.round(HEROES[id].base.mp + HEROES[id].grow.mp * (h.lv - 1)) + (ITEMS[h.weapon]?.stats?.mp || 0) + (ITEMS[h.acc]?.stats?.mp || 0); h.mp = Math.min(mmp, h.mp + Math.round(mmp * 0.2)); }
    }
    return true;
}

function goHome(G) {
    for (const id of Object.keys(G.heroes)) { G.heroes[id].hp = null; G.heroes[id].mp = null; }
    G.exp = null; G.battle = null; G.mode = 'hotel';
    G.events.push({ type: 'home' });
}

// ------------------------------------------------------------------ gear
function autoEquip(G) {
    for (const id of joinedHeroes(G)) {
        const h = G.heroes[id];
        for (const slot of ['weapon', 'acc']) {
            let best = h[slot], bs = best ? gearScore(id, best) : -1;
            for (const it of Object.keys(G.inv)) {
                const I = ITEMS[it];
                if (I?.cat !== 'gear' || I.slot !== slot || (I.hero && I.hero !== id)) continue;
                if (H.freeCount(G, it, id) <= 0) continue;
                const s = gearScore(id, it);
                if (s > bs) { best = it; bs = s; }
            }
            h[slot] = best;
        }
    }
    G.events.push({ type: 'autoEquip' });
    return true;
}

// ------------------------------------------------------------------ the command dispatcher
const BATTLE_CMDS = new Set(['attack', 'skill', 'chain', 'item', 'defend', 'flee', 'auto']);

export function act(G, cmd) {
    if (!cmd || !cmd.t) return false;
    if (BATTLE_CMDS.has(cmd.t)) {
        if (cmd.t === 'auto' && !G.battle) { G.auto = !!cmd.on; if (cmd.preset) G.preset = cmd.preset; return true; }
        return G.mode === 'battle' && battleAct(G, cmd);
    }
    switch (cmd.t) {
        // the inn
        case 'checkin': return H.checkin(G, cmd.guest, cmd.room);
        case 'sweep': return H.sweep(G, cmd.room);
        case 'harvest': return H.harvest(G);
        case 'cook': return H.cookStart(G, cmd.r);
        case 'stir': return H.stir(G);
        case 'cookCancel': return H.cookCancel(G);
        case 'serve': return H.serve(G, cmd.meal, cmd.guest);
        case 'sellMeal': return H.sellMeal(G, cmd.meal);
        case 'craft': return H.craft(G, cmd.item);
        case 'buy': return H.buy(G, cmd.item);
        case 'sell': return H.sell(G, cmd.item);
        case 'equip': return H.equip(G, cmd.hero, cmd.item);
        case 'autoEquip': return autoEquip(G);
        case 'decor': return H.placeDecor(G, cmd.item);
        case 'pay': return H.pay(G, cmd.amount);
        case 'role': return H.setRole(G, cmd.hero, cmd.role);
        case 'party': return H.toggleParty(G, cmd.hero);
        case 'recruit': return H.recruit(G, cmd.hero, cmd.role);
        case 'sleep': if (G.mode !== 'hotel') return false; H.sleep(G); return true;
        // story
        case 'sceneDone': return G.scenes.length ? (G.scenes.shift(), true) : false;
        case 'seenEnding': G.flags.ending = true; return true;
        case 'vignetteDone': { const v = G.vignettes.shift(); if (v) G.seenVignettes.push(v); return !!v; }
        // expeditions
        case 'depart': return depart(G, cmd.region, cmd.meal);
        case 'fight': return fight(G, cmd.boss);
        case 'battleDone': return battleDone(G);
        case 'return': if (G.mode !== 'expedition') return false; goHome(G); return true;
        default: return false;
    }
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { H as hotel, SCENES, VIGNETTES };
