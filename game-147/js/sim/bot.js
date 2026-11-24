// A whole-game player for the tests, the balance table and attract mode. It goes through act() like the UI, and
// fights with the same auto-battle brain the player can switch on. Pure.
//
// skill 1: attentive (sweeps often, nails the stir, cooks for requests, pays on time).
// skill 0.5: distracted (fewer clicks per minute, a sloppy stir, no shopping for tools).

import { DAY_LEN } from '../config.js';
import { HEROES, RECIPES, RECIPE_ORDER, REGIONS, REGION_ORDER, RECRUITS, ITEMS, TIERS } from './data.js';
import { has, hasAll, joinedHeroes } from './util.js';
import * as H from './hotel.js';
import { bossOpen, currentGoal } from './quests.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, think: 0, lastTrip: 0, trips: 0, r: seed >>> 0 };
}

function rand(bot) { bot.r = (bot.r * 1664525 + 1013904223) >>> 0; return bot.r / 4294967296; }

const ROLE = { ember: 'both', kit: 'staff', fern: 'both', bru: 'both' };

/** One decision, or null to let time pass. Call every ~0.5 s of sim time (more often at higher skill). */
export function botCmd(G, bot) {
    if (G.scenes.length) return { t: 'sceneDone' };
    if (G.vignettes.length) return { t: 'vignetteDone' };
    for (const h of Object.keys(G.recruits)) if (G.recruits[h].stage === 'ready') return { t: 'recruit', hero: h, role: ROLE[h] };

    if (G.mode === 'battle') {
        const B = G.battle;
        if (['won', 'lost', 'fled'].includes(B.phase)) return { t: 'battleDone' };
        if (!B.auto) return { t: 'auto', on: true, preset: bot.skill >= 1 ? 'balanced' : 'aggressive' };
        return null;
    }
    if (G.mode === 'expedition') {
        const hp = G.party.map((id) => {
            const h = G.heroes[id];
            if (h.hp == null) return 1;
            const mhp = HEROES[id].base.hp + HEROES[id].grow.hp * (h.lv - 1);
            return h.hp / mhp;
        });
        const low = Math.min(...hp);
        const reg = G.exp.region, R = REGIONS[reg];
        const lv = Math.min(...G.party.map((id) => G.heroes[id].lv));
        if (bossOpen(G, reg) && !G.bossesBeaten.includes(R.boss) && lv >= R.bossLv - 1 && low > 0.8 && G.exp.wins >= 1) return { t: 'fight', boss: true };
        if (low < 0.45 || G.exp.wins >= 3) return { t: 'return' };
        return { t: 'fight', boss: false };
    }

    // ---- at the inn
    const T = TIERS[G.debt.tier];
    const owe = H.owed(G);
    if (T && owe > 0 && (G.gold >= owe || G.day >= G.debt.due - 1) && G.gold > 0) return { t: 'pay', amount: G.gold >= owe ? owe : Math.max(1, G.gold - 40) };

    // the front desk
    for (const gid of G.queue) {
        const g = G.guests[gid];
        const free = H.openRooms(G).filter((r) => !r.guest).sort((a, b) => a.dust - b.dust);
        if (!free.length) break;
        if (g.recruit && RECRUITS[g.recruit].room === 'clean' && H.bunnies(free[0]) > 1) return { t: 'sweep', room: free[0].id };
        return { t: 'checkin', guest: gid, room: free[0].id };
    }
    // the cooking pot
    if (G.cook) {
        const n = H.needle(G);
        const aim = bot.skill >= 1 ? n.perfect * 0.9 : n.good * 1.4;
        if (Math.abs(n.p - 0.5) <= aim) return { t: 'stir' };
        return null;
    }
    // dust: an attentive bot sweeps whenever a room has two or more bunnies
    // (any bunny at all while a Sparkle favour is open: Bru wants a 4★ inn)
    const sparkleTask = Object.entries(G.recruits).some(([h, r]) => r.stage === 'staying' && !r.task && RECRUITS[h].task.kind === 'sparkle');
    const dirty = H.openRooms(G).filter((r) => H.bunnies(r) >= (sparkleTask ? 1 : bot.skill >= 1 ? 2 : 3)).sort((a, b) => b.dust - a.dust)[0];
    if (dirty && rand(bot) < 0.5 + 0.5 * bot.skill) return { t: 'sweep', room: dirty.id };
    if (G.garden.herbs >= 3) return { t: 'harvest' };

    // serve: recruits their favourite, guests what they asked for, then anyone if the pantry is full
    for (const g of Object.values(G.guests)) {
        if (!g.room || g.served === G.day) continue;
        let want = g.recruit ? (G.recruits[g.recruit].meal ? null : RECRUITS[g.recruit].meal) : g.req === 'meal' ? g.reqMeal : null;
        const idx = want ? G.pantry.findIndex((m) => m.r === want) : (!g.recruit && G.pantry.length > 3 ? G.pantry.length - 1 : -1);
        if (idx >= 0) return { t: 'serve', meal: idx, guest: g.id };
    }
    // cook what's wanted, else the dearest thing we can make
    if (G.pantry.length < 8) {
        const wants = [];
        for (const g of Object.values(G.guests)) {
            if (g.recruit && !G.recruits[g.recruit].meal) wants.push(RECRUITS[g.recruit].meal);
            else if (g.req === 'meal' && !g.reqMet) wants.push(g.reqMeal);
        }
        const can = RECIPE_ORDER.filter((r) => H.recipeUnlocked(G, r) && hasAll(G, RECIPES[r].need));
        // keep a recruit's quest item: don't cook Ember's only pepper while her task needs it
        const keep = (r) => !(G.recruits.ember.stage === 'staying' && !G.recruits.ember.task && RECIPES[r].need.pepper && (G.inv.pepper || 0) < 2);
        const pick = wants.find((r) => can.includes(r) && keep(r)) || (G.pantry.length < 5 ? can.filter(keep).sort((a, b) => RECIPES[b].price - RECIPES[a].price)[0] : null);
        if (pick) return { t: 'cook', r: pick };
    }
    // shopping
    if ((G.inv.flour || 0) < 3 && G.gold > owe * 0.3 + 20) return { t: 'buy', item: 'flour' };
    if (bot.skill >= 1) {
        for (const tool of ['copperPot', 'sparkleSpray', 'turboBroom', 'goldenWhisk']) {
            if (!has(G, tool) && G.gold > ITEMS[tool].price + owe * 0.6 + 150) return { t: 'buy', item: tool };
        }
        for (const id of joinedHeroes(G)) {
            const d = HEROES[id].favDecor;
            if (!has(G, d) && G.gold > ITEMS[d].price + owe * 0.7 + 200) return { t: 'buy', item: d };
            if (has(G, d) && !G.decor.includes(d) && G.decor.length < G.decorSlots) return { t: 'decor', item: d };
        }
    }
    if ((G.inv.honeyDrop || 0) < 2 && (G.inv.honey || 0) >= 2 && (G.inv.flour || 0) >= 2) return { t: 'craft', item: 'honeyDrop' };
    if (bot.think++ % 40 === 0) return { t: 'autoEquip' };

    // an expedition once a day, mid-morning, with the best meal in the pantry
    const frac = G.clock / DAY_LEN;
    if (bot.lastTrip !== G.day && frac > 0.15 && frac < 0.7) {
        const lv = G.heroes.maple.lv;
        // follow the quest tracker: a boss goal sends the party to that boss's region
        const goal = currentGoal(G);
        const bossReg = goal?.check === 'bossBeaten' ? REGION_ORDER.find((r) => REGIONS[r].boss === goal.arg) : null;
        const taskReg = G.recruits.ember.stage === 'staying' && !G.recruits.ember.task ? 'meadow'
            : G.recruits.kit.stage === 'staying' && !has(G, 'suitcase') ? 'grove' : null;
        const region = (bossReg && H.regionUnlocked(G, bossReg) && lv >= REGIONS[bossReg].bossLv - 2 ? bossReg : null) || taskReg
            || REGION_ORDER.filter((r) => H.regionUnlocked(G, r) && lv >= REGIONS[r].lv[0] - 1).pop() || 'meadow';
        bot.lastTrip = G.day; bot.trips++;
        const meal = G.pantry.length ? G.pantry.reduce((bi, m, i, a) => (RECIPES[m.r].price * m.q > RECIPES[a[bi].r].price * a[bi].q ? i : bi), 0) : -1;
        return { t: 'depart', region, meal };
    }
    return null;
}
