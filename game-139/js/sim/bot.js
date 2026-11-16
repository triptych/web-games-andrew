// An auto-player. It plays through act(), the same commands the player's taps make, so the tests,
// the balance table and the attract demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill:  1 always takes its best-scoring move; lower skill sometimes takes a random legal one or
//         ends the round with moves left on the table.
// blades: 'never' (only when about to lose the run), 'trust' (stays within the rival's trust so a
//         partnership is still on offer; more when hurting), 'always' (the old ways, every time).

import { RIVALS } from './data/rivals.js';
import { ROOMS, INTERLUDES } from './data/inn.js';
import { RUN } from '../config.js';
import { legalMoves, cardInfo, exposed, layoutOf, def, priceOf, bladesInDeck } from './game.js';

export function makeBot({ skill = 1, blades = 'trust', seed = 1 } = {}) {
    return { skill, blades, s: (seed * 2654435761) >>> 0 };
}
// the bot's own dice, so a low-skill bot's slips don't touch the game's rng
function roll(bot) {
    bot.s = (bot.s + 0x6D2B79F5) | 0;
    let t = Math.imul(bot.s ^ (bot.s >>> 15), 1 | bot.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The next command for whatever phase the game is in (null when there's nothing to do). */
export function botCommand(G, bot) {
    switch (G.phase) {
        case 'letters': return { t: 'host', id: G.letters[0] };
        case 'night': return nightMove(G, bot);
        case 'won': return { t: G.won.canPartner ? 'partner' : 'farewell' };
        case 'day': return dayMove(G, bot);
        case 'interlude': return { t: 'choose', i: G.resolve < G.maxResolve * 0.5 ? pickHeal(G) : 0 };
        default: return null;
    }
}

function pickHeal(G) {
    const X = INTERLUDES.find((x) => x.id === G.interlude);
    const i = X ? X.options.findIndex((o) => o.fx.heal || o.fx.maxResolve) : -1;
    return Math.max(0, i);
}

function nightMove(G, bot) {
    const F = G.fight, R = RIVALS[F.rival];
    const moves = legalMoves(G);
    const L = layoutOf(F);
    const hurting = G.resolve <= Math.max(8, G.maxResolve * 0.3);
    const desperate = G.resolve <= 6;
    const bladeCost = () => {
        if (bot.blades === 'always') return -2;
        if (bot.blades === 'never') return desperate ? 4 : 60;
        // 'trust': free while still inside the rival's trust; then it costs the partnership
        const left = R.partner ? R.trust - F.blades : 9;
        if (left > 0) return 3;
        return hurting ? 6 : 24;
    };
    const opened = (ids) => {
        const gone = new Set(ids);
        let n = 0;
        for (const id of ids) for (const c of L.slots[id].covers) {
            if (gone.has(c) || F.slots[c].gone) continue;
            if (L.slots[c].coveredBy.every((x) => gone.has(x) || F.slots[x].gone)) n++;
        }
        return n;
    };
    const intentHit = F.intent?.t === 'hit' ? Math.max(0, F.intent.n - F.soothe - F.composure) : 0;
    const fxValue = (ci) => {
        const fx = ci.fx;
        let v = 0;
        if (fx.block) v += Math.min(fx.block, intentHit) * 1.2;
        if (fx.soothe) v += Math.min(fx.soothe, intentHit) * 1.2;
        if (fx.heal) v += Math.min(fx.heal, G.maxResolve - G.resolve) * 1.1;
        if (fx.tips) v += fx.tips * 0.3;
        if (fx.draw) v += fx.draw * 2.5;
        if (fx.reveal) v += 0.5;
        if (fx.streak) v += fx.streak * 0.4;
        return v;
    };
    let best = null, bestV = -Infinity;
    const good = [];
    for (const m of moves) {
        let v;
        if (m.t === 'end') v = 0;
        else if (m.t === 'pour') {
            const ci = cardInfo(F, m.hand);
            if (ci.d.junk) v = 9;
            else {
                // pour a card that can't pair with anything open, if we're otherwise stuck
                const pairs = moves.some((x) => x.t === 'pair' && (x.a.hand === m.hand || x.b.hand === m.hand));
                v = pairs || ci.fx.wild || ci.d.trick || ci.fx.block ? -5 : 0.5;
            }
        } else if (m.t === 'solo' && m.hand) {
            const ci = cardInfo(F, m.hand);
            v = fxValue(ci) - 1 + (ci.d.suit === 'blade' ? -bladeCost() : 0);
        } else {
            const slots = [m.a?.slot, m.b?.slot, m.slot].filter((x) => x != null);
            const uid = m.hand || m.a?.hand || m.b?.hand;
            const ci = uid ? cardInfo(F, uid) : null;
            v = slots.length * 10 + opened(slots) * 4;
            if (m.t === 'cut') v -= 6;                                  // a cut spends a card for one settle
            if (ci) {
                v += fxValue(ci) - 3;                                   // spending a hand card has a cost
                if (ci.fx.wild) v -= 4;                                 // save the wild for a hard spot
                if (ci.d.suit === 'blade') v -= bladeCost();
                for (const id of slots) if (F.slots[id].taint && ci.d.suit !== 'hearth' && m.t !== 'cut') v -= 6;
            } else for (const id of slots) if (F.slots[id].taint) v -= 6;
            for (const id of slots) if (F.slots[id].bounty) v += 2;
        }
        if (v > 0 && m.t !== 'end') good.push(m);
        if (v > bestV) { bestV = v; best = m; }
    }
    if (bot.skill < 1 && good.length) {
        const r = roll(bot);
        if (r > bot.skill + (1 - bot.skill) * 0.6) return { t: 'end' };          // leaves moves on the table
        if (r > bot.skill) return good[Math.floor(roll(bot) * good.length)];     // a fine move, not the best
    }
    return best || { t: 'end' };
}

const ROOM_ORDER = ['snug', 'cellar', 'kitchen', 'fireplace', 'garden', 'sign', 'board'];
const KEEP = { hearth: 1, key: 1, coin: 0.7, blade: 0 };

function dayMove(G, bot) {
    const D = G.day;
    // 1. a room, if the run can afford it
    if (D.room && G.tips >= ROOMS[D.room].price && ROOM_ORDER.indexOf(D.room) < 6) return { t: 'room' };
    // 2. a card: warm ones first; never more than ~22 cards
    if (G.deck.length < 22) {
        let bi = -1, bv = 0;
        D.offers.forEach((id, i) => {
            if (!id || G.tips < priceOf(G, id)) return;
            const d = def(id);
            let v = KEEP[d.suit] ?? 0.5;
            if (d.fx.wild) v += 1.5;
            if (d.suit === 'blade' && bot.blades === 'always') v = 1.2;
            if (v > bv) { bv = v; bi = i; }
        });
        if (bi >= 0 && bv >= 0.7) return { t: 'buy', i: bi };
    }
    // 3. one chore
    if (!D.chore) {
        if (G.resolve < G.maxResolve * 0.6) return { t: 'chore', kind: 'rest' };
        const blade = G.deck.find((c) => def(c.id).suit === 'blade' && !def(c.id).trick);
        const trick = G.deck.find((c) => def(c.id).trick && def(c.id).suit === 'blade');
        if (bot.blades !== 'always' && G.deck.length > RUN.minDeck && (blade || trick) && (G.notoriety > 0 || bot.blades === 'never')) {
            return { t: 'chore', kind: 'letgo', uid: (blade || trick).uid };
        }
        const pol = G.deck.find((c) => !c.up && !def(c.id).junk && def(c.id).suit !== 'blade');
        if (pol) return { t: 'chore', kind: 'polish', uid: pol.uid };
        return { t: 'chore', kind: 'rest' };
    }
    return { t: 'leave' };
}

/** Play until the run ends (or maxActs commands). Returns the game. For tests and the balance table. */
export function playRun(G, bot, { act, maxActs = 4000, onAct } = {}) {
    let n = 0;
    while (!G.over && n++ < maxActs) {
        const cmd = botCommand(G, bot);
        if (!cmd) break;
        const ok = act(G, cmd);
        if (onAct) onAct(G, cmd, ok);
        G.events.length = 0;
        if (!ok) { // a refused command would loop forever: end the round / leave instead
            if (G.phase === 'night') act(G, { t: 'end' });
            else if (G.phase === 'day') act(G, { t: 'leave' });
            G.events.length = 0;
        }
    }
    return G;
}
export { exposed, bladesInDeck };
