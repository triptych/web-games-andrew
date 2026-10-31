// An auto-player. It plays through act(), the same door the UI uses, so the tests, the balance table
// and the attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// In battle it dry-runs every card on every actor and target (battle.preview), scores the events in
// one currency, "damage potential" (health removed × damage per health), and plays the best until
// nothing is worth its ink. Out of battle it follows a short list of habits.

import { makeRng } from '../rng.js';
import { CREATURES, FOES, CARDS, RELICS } from './data.js';
import * as BT from './battle.js';
import { nextNodes, priceOf, armyMax, canUpgrade } from './game.js';
import * as H from './hex.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed) };
}

const potential = (s) => { const d = BT.unitDef(s); return d.dmg / d.hp; };

/** Damage each of your stacks is about to take from the foes' shown intents. */
function incoming(B) {
    const m = new Map();
    for (const e of BT.foes(B)) {
        const it = e.intent;
        if (!it || !it.target || !it.est) continue;
        if (it.k === 'attack' && !it.reach) continue;
        m.set(it.target, (m.get(it.target) || 0) + it.est);
    }
    return m;
}

function valueOf(B, events, inc) {
    let v = 0;
    const before = new Map(B.stacks.map((s) => [s.id, s]));
    for (const e of events) {
        const s = before.get(e.id);
        switch (e.type) {
            case 'hit': {
                if (!s) break;
                const w = potential(s) * 3;
                if (s.side === 'e') v += e.lost * w + (e.count === 0 ? 25 : 0) + e.ward * 0.4 * w;
                else v -= e.lost * w * 1.15 + (e.count === 0 ? 60 : 0);
                break;
            }
            case 'ward': if (s && s.side === 'p') v += Math.min(e.amt, (inc.get(s.id) || 0) * 1.1) * potential(s) * 3 + 2; break;
            case 'heal': if (s && s.side === 'p') v += e.n * BT.unitDef(s).hp * potential(s) * 3; break;
            case 'status': {
                if (!s) break;
                const est = s.side === 'e' && s.intent ? s.intent.est || 0 : 0;
                if (s.side === 'e') {
                    if (e.k === 'weak') v += est * 0.25 * 0.5 + 4;
                    if (e.k === 'vuln') v += 12 + BT.totalHp(s) * 0.05;
                    if (e.k === 'root') v += s.intent?.k === 'attack' ? est * 0.4 : 2;
                    if (e.k === 'stun') v += est * 0.9 + 6;
                    if (e.k === 'burn') v += 6;
                } else if (e.k === 'might') {
                    const st = s.attacked ? 0 : s.count * BT.unitDef(s).dmg;
                    v += st * 0.12;
                } else if (e.k === 'taunt') v += 3;
                else if (e.k === 'brace') v += (inc.get(s.id) || 0) * 0.2;
                break;
            }
            case 'draw': v += e.n * 9; break;
            case 'ink': v += e.n * 16; break;
            default: break;
        }
    }
    return v;
}

function moveValue(B, s, to) {
    const near = (c, r) => Math.min(...BT.foes(B).map((e) => H.dist(c, r, e.c, e.r)));
    const d0 = near(s.c, s.r), d1 = near(to[0], to[1]);
    if (BT.ranged(s)) {
        const adj0 = d0 <= 1, adj1 = d1 <= 1;
        if (adj0 && !adj1) return 30 + d1;
        return -1;
    }
    if (d0 <= 1) return -1;
    // only the sturdy walk into the foe's reach; the rest keep behind them
    const biggest = Math.max(...BT.mine(B).map((m) => BT.totalHp(m)));
    if (BT.totalHp(s) < biggest * 0.4 && d1 <= 3) return -1;
    return (d0 - d1) * 3;
}

/** The free move: walkers close on the nearest foe, archers step out of reach of one at their elbow. */
function freeMove(B) {
    let best = null;
    for (const s of BT.mine(B)) {
        if (!BT.canMove(B, s)) continue;
        for (const at of BT.moveTargets(B, s)) {
            const v = moveValue(B, s, at);
            if (v > 0 && (!best || v > best.v)) best = { v, cmd: { t: 'move', id: s.id, at } };
        }
    }
    return best ? best.cmd : null;
}

/** Every legal play this turn, as commands. */
function options(B) {
    const out = [];
    for (const card of B.hand) {
        if (!BT.playable(B, card)) continue;
        const need = BT.needs(card);
        const actors = BT.cardActors(B, card);
        if (need === 'none') out.push({ uid: card.uid });
        else if (need === 'actor') for (const a of actors) out.push({ uid: card.uid, actor: a });
        else if (need === 'hex') for (const at of BT.cardTargets(B, card, actors[0])) out.push({ uid: card.uid, actor: actors[0], at });
        else for (const a of actors) for (const at of BT.cardTargets(B, card, a)) out.push({ uid: card.uid, actor: a, at });
    }
    return out;
}

/** The bot's next battle command, or null while the foes are moving. */
export function battleCommand(B, bot) {
    if (B.over) return { t: 'finish' };
    if (B.phase === 'deploy') return { t: 'begin' };
    if (B.phase !== 'player') return null;
    const inc = incoming(B);
    let best = null;
    const all = [];
    for (const o of options(B)) {
        const card = B.hand.find((c) => c.uid === o.uid);
        const d = BT.cardDef(card);
        const cost = BT.costOf(B, card);
        let v;
        if (d.kind === 'move') {
            const s = BT.stackById(B, o.actor);
            v = moveValue(B, s, o.at) - (d.free ? 4 : 0);
        } else if (d.kind === 'earthwork') v = -1;
        else {
            const ev = BT.preview(B, o);
            if (!ev) continue;
            v = valueOf(B, ev, inc);
            if (d.refreshAtk) { const s = BT.stackById(B, o.actor); v += s.attacked ? s.count * BT.unitDef(s).dmg * 0.6 : -5; }
            if (d.kind === 'buff' && d.st?.some(([k]) => k === 'haste')) v += 1;
        }
        const score = v - cost * 6;
        all.push({ o, score });
        if (!best || score > best.score) best = { o, score };
    }
    const good = all.filter((x) => x.score > 0);
    if (bot.skill < 1 && good.length && bot.rng() > bot.skill) return { t: 'play', ...good[Math.floor(bot.rng() * good.length)].o };
    if (best && best.score > 0) return { t: 'play', ...best.o };
    const mv = freeMove(B);
    if (mv) return mv;
    return { t: 'end' };
}

// ------------------------------------------------------------------ the rest of the run
const CARD_RANK = {
    onslaught: 6, fury: 9, cleave: 8, chain: 8, meteor: 7, warhost: 8, prayer: 8, entrench: 6, bless: 7, rallycry: 6,
    flankblow: 7, volley: 6, shieldbash: 5, guidingbolt: 6, firebolt: 5, frostbind: 5, sparks: 6, taunt: 5, laststand: 5,
    study: 5, scout: 4, inkreserve: 6, secondwind: 7, resurrect: 7, fielddress: 5, mire: 6, sleep: 6, frailty: 4, enfeeble: 4,
    haste: 3, quickstep: 3, teleport: 2, march: 3, feint: 4, earthwork: 0,
};
const UPGRADE_RANK = ['strike', 'onslaught', 'firebolt', 'holdfast', 'aimed', 'packhunt', 'brace', 'fury', 'cleave', 'chain', 'bless', 'volley'];
const BOON_RANK = ['atk', 'def', 'lore', 'levy', 'ink', 'draw', 'gold'];
const BOSS_RELIC_RANK = ['warhorn', 'astrolabe', 'grail', 'crown'];
const EVENT_PICK = { well: 1, sage: 0, peddler: 0, shrine: 2, knight: 0, ring: 2, armory: 0, riddle: 0, mercs: 0, tome: 2, field: 1, crossroads: 2 };

function armyPower(G) { return G.army.reduce((n, a) => n + a.count * (CREATURES[a.key].hp + CREATURES[a.key].dmg * 4), 0); }
function missing(G) { const f = G.army.reduce((n, a) => n + a.full * CREATURES[a.key].hp, 0); const c = G.army.reduce((n, a) => n + a.count * CREATURES[a.key].hp, 0); return f ? 1 - c / f : 0; }

function pickNode(G, bot) {
    const opts = nextNodes(G);
    if (bot.skill < 1 && bot.rng() > bot.skill) return opts[Math.floor(bot.rng() * opts.length)];
    const pw = armyPower(G), need = 900 * Math.pow(2.6, G.act);
    const score = (n) => ({
        battle: 3,
        elite: pw > need * 1.4 ? 4.5 : 0.5,
        dwelling: G.gold >= 100 ? 8 : 1,
        camp: missing(G) > 0.25 ? 7 : 2,
        shop: G.gold >= 180 ? 3.5 : 1,
        event: 2.5,
        treasure: 6,
        boss: 9,
    })[n.type] ?? 1;
    // look three floors ahead: the best route, not just the best next step
    const look = (n, depth) => {
        const v = score(n);
        if (depth <= 0 || !n.next.length) return v;
        return v + 0.6 * Math.max(...n.next.map((id) => look(G.map.nodes.find((x) => x.id === id), depth - 1)));
    };
    return opts.slice().sort((a, b) => look(b, 3) - look(a, 3) || a.col - b.col)[0];
}

/** Spend gold at a dwelling: the strongest creatures affordable, refilling owned stacks first. */
function recruitCmd(G) {
    // owned stacks first (no slot needed), then strength per gold
    const worth = (k) => (CREATURES[k].hp + CREATURES[k].dmg * 4) * (1 + CREATURES[k].tier * 0.12) / priceOf(G, k);
    const owned = (k) => G.army.some((a) => a.key === k);
    const stock = G.offer.stock.filter((s) => s.n > 0).sort((a, b) => (owned(b.key) - owned(a.key)) || worth(b.key) - worth(a.key));
    for (const s of stock) {
        const owned = G.army.some((a) => a.key === s.key);
        if (!owned && G.army.length >= armyMax(G)) continue;
        const n = Math.min(s.n, Math.floor(G.gold / priceOf(G, s.key)));
        if (n >= 1 && (owned || n * CREATURES[s.key].hp >= 60)) return { t: 'recruit', key: s.key, n };
    }
    return { t: 'leave' };
}

export function botCommand(G, bot) {
    if (G.over) return null;
    if (G.pick) {
        const p = G.pick;
        let c = null;
        if (p.why === 'remove') c = G.deck.find((x) => CARDS[x.id].kind === 'curse') || G.deck.find((x) => x.id === 'march') || G.deck.find((x) => CARDS[x.id].rarity !== 'sig');
        else if (p.why === 'upgrade') { for (const id of UPGRADE_RANK) { c = G.deck.find((x) => x.id === id && canUpgrade(x)); if (c) break; } c = c || G.deck.find(canUpgrade); }
        else c = G.deck.slice().sort((a, b) => (CARD_RANK[b.id] || 0) - (CARD_RANK[a.id] || 0)).find((x) => CARDS[x.id].rarity !== 'sig' && CARDS[x.id].kind !== 'curse');
        return { t: 'pickDeck', uid: c ? c.uid : null };
    }
    switch (G.screen) {
        case 'map': return { t: 'go', id: pickNode(G, bot).id };
        case 'battle': return battleCommand(G.battle, bot);
        case 'reward': {
            const R = G.reward;
            if (R.relic && !R.relicTaken) return { t: 'takeRelic' };
            if (!R.cardTaken) {
                let bi = -1, bv = G.deck.length > 22 ? 6 : 3.5;
                R.cards.forEach((id, i) => { const v = CARD_RANK[id] ?? 3; if (v > bv) { bv = v; bi = i; } });
                return { t: 'pickCard', i: bi };
            }
            return { t: 'leave' };
        }
        case 'boon': {
            const o = G.boon.opts;
            let i = 0, br = 99;
            o.forEach((k, j) => { const r = BOON_RANK.indexOf(k); if (r >= 0 && r < br) { br = r; i = j; } });
            return { t: 'boon', i };
        }
        case 'bossrelic': {
            const o = G.bossrelic.opts;
            let i = 0, br = 99;
            o.forEach((k, j) => { const r = BOSS_RELIC_RANK.indexOf(k); if (r >= 0 && r < br) { br = r; i = j; } });
            return { t: 'pickRelic', i };
        }
        case 'dwelling': return recruitCmd(G);
        case 'shop': {
            const S = G.shop;
            if (!S.removed && G.gold >= G.removeCost && G.deck.some((x) => CARDS[x.id].kind === 'curse')) return { t: 'removeCard' };
            const ri = S.relics.findIndex((r) => !r.sold && r.price <= G.gold - 60);
            if (ri >= 0) return { t: 'buyRelic', i: ri };
            const ci = S.cards.findIndex((c) => !c.sold && c.price <= G.gold - 80 && (CARD_RANK[c.id] || 0) >= 7);
            if (ci >= 0) return { t: 'buyCard', i: ci };
            return { t: 'leave' };
        }
        case 'camp': {
            if (G.camp.done) return { t: 'leave' };
            if (missing(G) > 0.12 || !G.deck.some(canUpgrade)) return { t: 'rest' };
            return { t: 'inscribe' };
        }
        case 'event': {
            if (G.event.result || G.event.fight) return { t: 'leave' };
            const ev = G.event.id;
            const opts = G.event && CARDS ? null : null;
            void opts;
            let i = EVENT_PICK[ev] ?? 0;
            return { t: 'choose', i: chooseEvent(G, ev, i) };
        }
        case 'treasure': return { t: 'leave' };
        default: return null;
    }
}

function chooseEvent(G, ev, i) {
    // never take a gold option you can't pay for
    const cost = { well: [40], peddler: [120], mercs: [150, 50] }[ev];
    if (cost && cost[i] != null && G.gold < cost[i]) return ev === 'well' ? 1 : ev === 'peddler' ? 2 : 2;
    if (ev === 'knight' && G.army.length >= armyMax(G) && !G.army.some((a) => a.key === 'knights')) return 2;
    return i;
}

export { RELICS, FOES };
