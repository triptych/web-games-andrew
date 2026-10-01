/**
 * bot.js — an automated player, used by dev/simtest.mjs to play the whole campaign
 * (balance tables, invariants) and by the game's hint button (best move).
 *
 *   botBattleAction(bt)        → { cast } | { potion } | { move }
 *   botManage(p, now)          town, gear, stats, quests, potions — the "between battles" turn
 *   botPlan(p)                 what to do next: a node, a patrol, a bounty, or the finale
 */

import { G, MANA, SPELLS, POTION_IDS, POTIONS } from './data.js';
import { findMoves, previewMove, countType } from './board.js';
import { canCast, skullDamage, spellPower } from './battle.js';
import { itemScore, SLOTS } from './items.js';
import { BUILDING_IDS, isUnlocked, potionUnlocked, carryLimit, canAfford, rankCost, maxSpellRank, bLevel, forgeCost } from './town.js';
import { BOOKS, studyCost, studyReq } from './books.js';
import { questDone } from './quests.js';
import { WINGS } from './regions.js';
import {
    collectAll, claimQuest, autoAllocate, equip, sell, canBuild, build, brew, rankUpSpell, study, wingMap, nodeState,
    openTreasure, takeBlessing, shrineOptions, resolveEvent, nodeEvent, heroStats, craft,
} from './game.js';

// ------------------------------------------------------------------ Battle

/** Score every legal move for the side to play (also powers the in-game hint). */
export function bestMove(bt, side = 'p') {
    const me = bt.sides[side], foe = bt.sides[side === 'p' ? 'e' : 'p'];
    const want = {};
    for (const sp of me.spells) {
        const def = SPELLS[sp.id] || sp.def;
        for (const [c, n] of Object.entries(def.cost)) want[c] = (want[c] || 0) + (me.mana[c] < n ? 1 : 0.3);
    }
    const sk = skullDamage(me);
    let best = null, bestV = -Infinity;
    for (const m of findMoves(bt.board)) {
        const pv = previewMove(bt.board, m);
        let v = pv.tally[G.SKULL] * sk * 1.15;
        MANA.forEach((c, i) => {
            v += pv.tally[i] * (want[c] ? 1 + want[c] * 0.7 : 0.3);
            if (pv.tally[i] && foe.mana[c] >= foe.manaCap * 0.5) v += pv.tally[i] * 0.3;
        });
        v += pv.tally[G.COIN] * 0.5 + pv.tally[G.STAR] * 0.6;
        if (pv.extra) v += 10;
        if (pv.make) v += 5;
        if (pv.prism) v += 8;
        v += (pv.specials || 0) * 4;
        // prefer lower moves slightly: more cascades from the refill above
        v += (m.a.y + m.b.y) * 0.05;
        if (v > bestV) { bestV = v; best = m; }
    }
    return best;
}

export function botBattleAction(bt) {
    const p = bt.sides.p, e = bt.sides.e;
    // Potions
    if (bt.potions.heal > 0 && p.hp < p.maxHp * 0.35) return { potion: 'heal' };
    if (bt.turnNo >= 2) for (const id of ['skull', 'bomb', 'prism', 'swift']) if (bt.potions[id] > 0 && e.hp > e.maxHp * 0.4) return { potion: id };
    if (bt.potions.mana > 0 && bt.turnNo >= 3) return { potion: 'mana' };
    // Spells
    let best = -1, bestV = 0;
    p.spells.forEach((sp, i) => {
        if (!canCast(bt, 'p', i)) return;
        const def = SPELLS[sp.id];
        const pw = spellPower(p, def, sp.rank);
        let v = def.quick ? 14 : 0;
        for (const o of def.ops) {
            const elm = o.el && o.el === e.weak ? 1.5 : o.el && o.el === e.resist ? 0.6 : 1;
            if (o.op === 'dmg') { v += o.n * pw * elm; if (o.n * pw * elm >= e.hp + e.shield) v += 500; }
            if (o.op === 'heal') v += p.hp < p.maxHp * 0.6 ? o.n * pw : -20;
            if (o.op === 'shield') v += p.shield < 5 ? o.n * pw * 0.8 : -10;
            if (o.op === 'burn') v += o.n * pw * o.turns * 0.8;
            if (o.op === 'stun') v += 12;
            if (o.op === 'destroyColor') v += countType(bt.board, o.gem) * ((o.per || 0) * pw * elm + (o.collect ? 2 : 0)) + 4;
            if (o.op === 'destroyRows' || o.op === 'destroyArea' || o.op === 'destroyRandom') v += 18;
            if (o.op === 'convert') v += 20;
            if (o.op === 'special') v += 10 * (o.count || 1);
            if (o.op === 'buff') v += 16;
            if (o.op === 'mana') v += 8;
        }
        if (v > bestV) { bestV = v; best = i; }
    });
    if (best >= 0 && bestV >= 8) return { cast: best };
    return { move: bestMove(bt, 'p') };
}

// ------------------------------------------------------------------ Between battles

const BUILD_ORDER = ['lumber', 'market', 'quarry', 'herbs', 'guild', 'forge', 'training', 'alchemist', 'storehouse', 'crystal', 'magetower', 'scriptorium', 'clocktower'];

export function botManage(p, now) {
    const log = [];
    collectAll(p);
    for (const q of p.quests.active.slice()) if (questDone(p, q)) claimQuest(p, q.id);
    autoAllocate(p);
    // Gear: equip the best per slot, sell the rest.
    for (const s of SLOTS) {
        const cands = p.bag.filter((it) => it.slot === s);
        for (const it of cands) if (itemScore(it, p.cls) > itemScore(p.gear[s], p.cls)) equip(p, it.uid);
    }
    for (const it of p.bag.slice()) sell(p, it.uid);
    // Build everything once, then upgrade, cheapest first.
    for (let n = 0; n < 12; n++) {
        let did = false;
        for (const id of BUILD_ORDER) {
            if (!isUnlocked(p, id) || p.town[id]) continue;
            const c = canBuild(p, id);
            if (c.ok) { build(p, id, undefined, now); log.push('build ' + id); did = true; }
        }
        const ups = BUILD_ORDER.filter((id) => p.town[id] && canBuild(p, id).ok)
            .sort((a, b) => sumCost(canBuild(p, a).cost) - sumCost(canBuild(p, b).cost));
        if (ups.length) { build(p, ups[0], undefined, now); did = true; }
        if (!did) break;
    }
    // Spell ranks for slotted spells.
    for (const id of p.slots) {
        while (p.spells[id] < maxSpellRank(p) && canAfford(p, rankCost(p.spells[id]))) rankUpSpell(p, id);
    }
    // Study books.
    for (const b of BOOKS) {
        const t = p.books[b.id];
        if (t && t < 3 && bLevel(p, 'scriptorium') >= studyReq(t + 1) && canAfford(p, studyCost(b, t + 1))) study(p, b.id);
    }
    // Forge: one item per visit if gold is plentiful.
    if (bLevel(p, 'forge') && p.res.gold > forgeCost(p).gold * 4) {
        const worst = SLOTS.slice().sort((a, b) => itemScore(p.gear[a], p.cls) - itemScore(p.gear[b], p.cls))[0];
        const r = craft(p, worst);
        if (r.ok && itemScore(r.item, p.cls) > itemScore(p.gear[worst], p.cls)) equip(p, r.item.uid);
        else if (r.ok) sell(p, r.item.uid);
    }
    // Potions: keep the carry filled with healing + the best attack potion.
    const lim = carryLimit(p);
    const want = ['heal', 'skull', 'bomb', 'mana', 'prism', 'swift'].filter((id) => potionUnlocked(p, id));
    for (const id of want) {
        let guard = 0;
        while (p.potions[id] < 2 && canAfford(p, POTIONS[id].cost) && guard++ < 3) brew(p, id);
    }
    p.loadout = {};
    let left = lim;
    for (const id of want) { const n = Math.min(left, id === 'heal' ? 2 : 1, p.potions[id]); if (n > 0) { p.loadout[id] = n; left -= n; } }
    return log;
}

const sumCost = (c) => Object.values(c || {}).reduce((a, b) => a + b, 0);

/** Decide the next thing to do. Returns { battle: ctx } or { done: true }. Handles non-battle nodes inline. */
export function botPlan(p, opts = {}) {
    // Bounties at or below our level are good XP.
    const bounty = p.quests.active.find((q) => q.kind === 'bounty' && !q.done && q.bounty.level <= p.level);
    if (bounty && !opts.noBounty) return { battle: { type: 'bounty', quest: bounty.id } };
    const wi = p.wingOpen;
    const W = WINGS[wi];
    const map = wingMap(p, wi);
    for (let guard = 0; guard < 20; guard++) {
        const open = map.nodes.filter((n) => nodeState(p, wi, n.id) === 'open');
        if (!open.length) return { done: true };
        const nonBattle = open.find((n) => ['treasure', 'shrine', 'event'].includes(n.kind));
        if (nonBattle) {
            if (nonBattle.kind === 'treasure') openTreasure(p, wi, nonBattle.id);
            else if (nonBattle.kind === 'shrine') takeBlessing(p, wi, nonBattle.id, shrineOptions(p, wi, nonBattle.id)[0]);
            else {
                const r = resolveEvent(p, wi, nonBattle.id, 0);
                if (!r || r.fail) {
                    const r2 = resolveEvent(p, wi, nonBattle.id, 1);
                    if (!r2 || r2.fail) return { done: true, stuck: 'event' };
                }
            }
            continue;
        }
        const plain = open.filter((n) => n.kind === 'battle' || n.kind === 'elite').sort((a, b) => a.level - b.level);
        if (plain.length) {
            const n = plain[0];
            if (n.kind === 'elite' && p.level < n.level - 1 && !W.final) return { battle: { type: 'patrol', wing: wi } };
            return { battle: { type: 'node', wing: wi, node: n.id } };
        }
        const boss = open[0];
        const need = boss.level + (boss.kind === 'guardian' ? 1 : 0) + (boss.kind === 'final' ? 0 : 0);
        if (p.level < need + (opts.margin ?? -1) && !opts.forceBoss) return { battle: { type: 'patrol', wing: Math.min(wi, 5) } };
        return { battle: { type: 'node', wing: wi, node: boss.id } };
    }
    return { done: true };
}

export { heroStats, POTION_IDS };
