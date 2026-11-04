// An auto-player. It plays through the same act() commands the player's taps make, so the tests,
// the balance table and the attract demo all exercise the real rules. Pure, like the rest of js/sim.
//
// In a fight it plans the longest chain it can see (face-down cards are unknown to it unless
// X-rayed, exactly as for a player), spends charge on gadgets when the chain runs out, then draws.
// skill < 1 makes it pick a random playable card, skip gadgets and wander the map now and then.

import { makeRng } from '../rng.js';
import { GADGETS, EVENTS } from './data.js';
import { intentInfo, playable, rankFits, isWild, isStatic } from './battle.js';
import { choices, optionOk, upgradable, canRemove } from './run.js';
import { GADGET_SLOTS } from '../config.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed) };
}

const CARD_VALUE = { wild: 9, flying_saucer: 9, chain_rx: 7, rocket_fuel: 7, shrink: 6, jet_boots: 6, death_ray: 6, meteor: 6, atomic_pile: 6, force_field: 5, reflector: 5, radar: 5, booster: 5, hypno: 4, ration: 3, plain: 1, static: -5, slime: -5 };
const GADGET_VALUE = { wild_beam: 8, ray_pistol: 6, jetpack: 6, atomic_bomb: 5, force_bubble: 5, freeze_ray: 5, disintegrator: 5, hypno_gun: 4, xray_specs: 4, heat_lamp: 3 };
export const cardValue = (c) => (CARD_VALUE[c.k] ?? 3) + (c.up ? 1.5 : 0);

// ------------------------------------------------------------------ chain planner
/** The best chain from here that the visible table allows: { len, first }. */
export function planChain(B, budget = 4000) {
    const known = new Set(B.tab.filter((c) => c.up || B.xray).map((c) => c.id));
    const beam = B.beam;
    const wild0 = B.wildBeam || (beam && isWild(beam));
    const dead0 = beam && !B.wildBeam && isStatic(beam);
    let nodes = 0;
    const isCovered = (tab, c) => tab.some((o) => o.row === c.row + 1 && Math.abs(o.col - c.col) <= 1);
    const dfs = (tab, r, wild, dead) => {
        let best = { len: 0, first: null, score: 0 };
        if (dead || ++nodes > budget) return best;
        for (const c of tab) {
            if (!known.has(c.id) || c.frozen || isCovered(tab, c)) continue;
            if (!wild && !rankFits(r, c.r)) continue;
            const rest = tab.filter((o) => o !== c);
            // turning over unknown cards is worth a little: they might continue the chain
            let reveal = 0;
            for (const o of rest) if (!known.has(o.id) && isCovered(tab, o) && !isCovered(rest, o)) reveal += 0.35;
            const sub = dfs(rest, c.r, false, false);
            const score = 1 + reveal + sub.score + (rest.length === 0 ? 3 : 0);
            if (score > best.score) best = { len: 1 + sub.len, first: c.id, score };
            if (nodes > budget) break;
        }
        return best;
    };
    return dfs(B.tab, beam ? beam.r : 0, !beam || wild0, dead0);
}

// ------------------------------------------------------------------ the fight
function battleCommand(G, bot) {
    const B = G.battle;
    const careless = () => bot.rng() > bot.skill;
    const g = (k) => G.gadgets.indexOf(k);
    const can = (k) => { const i = g(k); return i >= 0 && B.charge >= GADGETS[k].cost ? i : -1; };
    const e = B.enemy;
    const lethal = e.hp + e.block;

    // a gadget that finishes the creature, any time
    for (const k of ['ray_pistol', 'atomic_bomb']) {
        const i = can(k);
        if (i >= 0 && GADGETS[k].fx.dmg >= lethal) return { t: 'gadget', i };
    }
    if (can('xray_specs') >= 0 && !B.xray && B.tab.some((c) => !c.up) && !careless()) return { t: 'gadget', i: can('xray_specs') };

    const plan = planChain(B);
    if (plan.first != null) {
        if (careless()) {
            const ps = B.tab.filter((c) => playable(B, c));
            if (ps.length) return { t: 'play', id: bot.rng.pick(ps).id };
        }
        return { t: 'play', id: plan.first };
    }

    // the chain has run out: gadgets, then draw
    if (!careless()) {
        const frozen = B.tab.filter((c) => c.frozen).length;
        if (frozen >= 2 && can('heat_lamp') >= 0) return { t: 'gadget', i: can('heat_lamp') };
        const free = B.tab.some((c) => c.up && !c.frozen);
        if (free && can('wild_beam') >= 0 && !B.wildBeam && !(B.beam && isWild(B.beam))) return { t: 'gadget', i: can('wild_beam') };
        if (can('disintegrator') >= 0) {
            let bestC = null, bestN = 0;
            for (const c of B.tab) {
                if (!c.up) continue;
                const rest = B.tab.filter((o) => o !== c);
                const n = rest.filter((o) => !o.up && !rest.some((x) => x.row === o.row + 1 && Math.abs(x.col - o.col) <= 1)).length;
                if (n > bestN) { bestN = n; bestC = c; }
            }
            if (bestC) return { t: 'gadget', i: can('disintegrator'), target: bestC.id };
        }
        if (B.draws <= 0 && can('jetpack') >= 0 && (B.stock.length || B.discard.length)) return { t: 'gadget', i: can('jetpack') };
        if (can('atomic_bomb') >= 0) return { t: 'gadget', i: can('atomic_bomb') };
        const keep = g('wild_beam') >= 0 ? 2 : 0;
        if (can('ray_pistol') >= 0 && B.charge - 3 >= keep) return { t: 'gadget', i: can('ray_pistol') };
        const it = intentInfo(B);
        const incoming = (it.dmg || 0) * (it.hits || 1);
        if (incoming >= 15 && can('freeze_ray') >= 0) return { t: 'gadget', i: can('freeze_ray') };
        if (incoming >= 10 && e.weak === 0 && can('hypno_gun') >= 0) return { t: 'gadget', i: can('hypno_gun') };
        if (incoming > B.block + 4 && can('force_bubble') >= 0) return { t: 'gadget', i: can('force_bubble') };
    }
    if (B.draws > 0 && (B.stock.length || B.discard.length)) return { t: 'draw' };
    return { t: 'end' };
}

// ------------------------------------------------------------------ the map and the panels
function mapCommand(G, bot) {
    const opts = choices(G);
    const h = G.hp / G.maxHp;
    const value = (n) => {
        const t = G.map.nodes[n].type;
        const v = {
            fight: 3, event: 2.6, treasure: 5, boss: 10,
            elite: h > 0.7 ? 4 : h > 0.5 ? 1 : -3,
            rest: h < 0.5 ? 6 : h < 0.75 ? 2.5 : 0.5,
            shop: G.bucks >= 100 ? 4.5 : G.bucks >= 60 ? 2 : 0.5,
        }[t] ?? 1;
        return v + bot.rng() * (bot.skill < 1 ? 4 : 0.6);
    };
    let best = opts[0], bv = -Infinity;
    for (const n of opts) { const v = value(n); if (v > bv) { bv = v; best = n; } }
    return { t: 'go', id: best };
}

function gadgetSlot(G, k) {
    if (G.gadgets.length < GADGET_SLOTS) return { ok: true, slot: undefined };
    let worst = 0;
    G.gadgets.forEach((x, i) => { if (GADGET_VALUE[x] < GADGET_VALUE[G.gadgets[worst]]) worst = i; });
    return { ok: GADGET_VALUE[k] > GADGET_VALUE[G.gadgets[worst]], slot: worst };
}

function rewardCommand(G, bot) {
    const o = G.offer;
    if (!o.relicTaken && o.relics.length) {
        return { t: 'take', what: 'relic', i: 0 };
    }
    if (o.gadget && !o.gadgetTaken) {
        const s = gadgetSlot(G, o.gadget);
        if (s.ok) return { t: 'take', what: 'gadget', slot: s.slot };
    }
    if (!o.cardTaken && o.cards.length) {
        let bi = -1, bv = 4.9;
        o.cards.forEach((c, i) => { const v = cardValue(c); if (v > bv) { bv = v; bi = i; } });
        if (bot.skill < 1 && bi < 0 && bot.rng() > bot.skill) bi = 0;
        if (bi >= 0) return { t: 'take', what: 'card', i: bi };
    }
    return { t: 'done' };
}

function worstCard(G) {
    let w = null;
    for (const c of G.deck) if (!w || cardValue(c) < cardValue(w)) w = c;
    return w;
}
function bestUpgrade(G) {
    let b = null;
    for (const c of G.deck) if (upgradable(c) && (!b || cardValue(c) > cardValue(b))) b = c;
    return b;
}

function shopCommand(G, bot) {
    const o = G.offer;
    if (o.relic && !o.relic.sold && G.bucks >= o.relic.price) return { t: 'buy', what: 'relic' };
    if (!o.removeUsed && G.bucks >= G.removePrice && canRemove(G) && cardValue(worstCard(G)) <= 1) return { t: 'buy', what: 'remove' };
    for (let i = 0; i < o.cards.length; i++) {
        const c = o.cards[i];
        if (!c.sold && G.bucks >= c.price && cardValue(c) >= 6) return { t: 'buy', what: 'card', i };
    }
    if (o.gadget && !o.gadget.sold && G.bucks >= o.gadget.price) {
        const s = gadgetSlot(G, o.gadget.k);
        if (s.ok) return { t: 'buy', what: 'gadget', slot: s.slot };
    }
    return { t: 'done' };
}

function eventCommand(G, bot) {
    const o = G.offer;
    if (o.chosen >= 0) {
        if (o.gadget && !o.gadgetTaken) {
            const s = gadgetSlot(G, o.gadget);
            if (s.ok) return { t: 'take', what: 'gadget', slot: s.slot };
        }
        return { t: 'done' };
    }
    const ev = EVENTS[o.k];
    const missing = G.maxHp - G.hp;
    const score = (opt) => {
        const d = opt.do;
        let s = 0;
        if (d.bucks) s += d.bucks / 10;
        if (d.heal) s += Math.min(d.heal, missing) / 2.5;
        if (d.maxHp) s += d.maxHp / 2;
        if (d.curse) s -= 4;
        if (d.relic) s += 6;
        if (d.dmg) s -= G.hp > d.dmg * 3 ? d.dmg / 3 : 20;
        if (d.card) s += 2.5;
        if (d.rareCard) s += 5;
        if (d.pay) s -= d.pay / 10;
        if (d.gadget) s += 4;
        if (d.remove) s += cardValue(worstCard(G)) <= 1 ? 3.5 : 0;
        if (d.upgradeRandom) s += 3;
        return s + bot.rng() * 0.5;
    };
    let bi = -1, bv = -Infinity;
    ev.options.forEach((opt, i) => { if (!optionOk(G, opt)) return; const v = score(opt); if (v > bv) { bv = v; bi = i; } });
    return { t: 'choose', i: bi };
}

/** The next command the bot would give, or null when there is nothing to do. */
export function botCommand(G, bot) {
    if (G.over) return null;
    if (G.pick) {
        if (G.pick.why === 'remove') return { t: 'pick', uid: worstCard(G).uid };
        const c = bestUpgrade(G);
        return { t: 'pick', uid: c ? c.uid : null };
    }
    switch (G.phase) {
        case 'intro': return { t: 'done' };
        case 'map': return mapCommand(G, bot);
        case 'battle': return battleCommand(G, bot);
        case 'reward': return rewardCommand(G, bot);
        case 'shop': return shopCommand(G, bot);
        case 'rest': return { t: 'rest', what: G.hp < G.maxHp * 0.65 || !G.deck.some(upgradable) ? 'heal' : 'upgrade' };
        case 'event': return eventCommand(G, bot);
    }
    return null;
}


