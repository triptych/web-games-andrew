// Gemheart Saga — an auto-player. It plays through the same commands the player uses (act / step), so the tests, the
// balance table and attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// skill in [0, 1]: how fast it moves (reaction = 0.7 s at 1, about 2.2 s at 0.3) and how often it picks a random legal
// move instead of the best one. It sees only what the player sees: the board, the bars and the foe's weakness.

import { GEM, KINDS, MANA_OF, BATTLE, MANA, HOUR } from '../config.js';
import { NODE, HERO } from './data/heroes.js';
import { ITEM, EQUIP } from './data/items.js';
import { BUILDINGS, REQUESTS } from './data/village.js';
import * as Bd from './board.js';
import * as V from './village.js';
import { act, step, actives, chapter, regionsOpen, learnBlock } from './game.js';
import { canSkill, canItem } from './battle.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, think: 0.5, seed: seed >>> 0 };
}

// the bot's own dice, so its choices never consume the game's rng (a player doesn't either)
function roll(bot) {
    bot.seed = (Math.imul(bot.seed ^ (bot.seed >>> 15), 2246822519) + 0x9E3779B9) >>> 0;
    return (bot.seed >>> 8) / 16777216;
}

const reaction = (bot) => 0.7 + (1 - bot.skill) * 2.1;

/** The battle command the bot wants this step, or null. Call once per sim step with dt. */
export function botBattle(G, bot, dt) {
    const Bt = G.battle;
    if (!Bt) return null;
    if (Bt.phase === 'won' || Bt.phase === 'lost') return { t: 'continue' };
    bot.think -= dt;
    if (bot.think > 0) return null;
    bot.think = reaction(bot) * (0.8 + roll(bot) * 0.4);
    const h = Bt.hero, f = Bt.foe;
    // items
    if (h.hp < h.max * 0.3) {
        for (const id of ['greatpotion', 'potion']) if (canItem(G, id)) return { t: 'item', id };
    }
    // skills
    for (const id of actives(G)) {
        if (!canSkill(G, id)) continue;
        const k = NODE[id].eff.kind;
        if (k === 'heal' && h.hp > h.max * 0.55) continue;
        if (k === 'shield' && (h.shield > 0 || h.hp > h.max * 0.8)) continue;
        if (k === 'freeze' && f.frozen > 0) continue;
        if (k === 'summon' && h.summon) continue;
        return { t: 'skill', node: id };
    }
    // a move
    const moves = Bd.findMoves(Bt.board);
    if (!moves.length) return null;
    if (roll(bot) > bot.skill * 0.85 + 0.15) {
        const m = moves[Math.floor(roll(bot) * moves.length)];
        return { t: 'swap', a: m.a, b: m.b };
    }
    const want = wantedPools(G);
    let best = null, bs = -1;
    for (const m of moves) {
        let s = 0;
        for (let k = 0; k < KINDS; k++) {
            if (!m.kinds[k]) continue;
            let w;
            if (k === GEM.SWORD) w = 1.2;
            else if (k === GEM.HEART) w = h.hp < h.max * 0.6 ? 1.6 : 0.15;
            else {
                const p = MANA_OF[k];
                w = 0.5 + (p === f.weak ? 0.7 : 0) + (want[p] ? 0.6 : 0) - (h.mana[p] >= BATTLE.manaCap ? 0.4 : 0);
            }
            s += m.kinds[k] * w;
        }
        if (m.special) s += 3;
        // prefer moves low on the board: they shake loose more cascades
        s += Bd.row(Math.max(m.a, m.b)) * 0.05;
        if (s > bs) { bs = s; best = m; }
    }
    return { t: 'swap', a: best.a, b: best.b };
}

function wantedPools(G) {
    const out = {};
    for (const id of actives(G)) for (const p of Object.keys(NODE[id].cost)) out[p] = true;
    return out;
}

// ---------------------------------------------------------------- the village
// Skill order: each branch's active, then passives, damage first.
function learnOrder(G) {
    const tree = HERO[G.hero.id].tree;
    const order = [];
    for (const b of tree) order.push(b.nodes[0].id);
    for (const b of tree) order.push(b.nodes[1].id);
    for (const b of tree) order.push(b.nodes[2].id);
    return order;
}

/** Everything a sensible player does at home: collect, gift, claim, learn, build, kit out. */
export function botVillage(G, now, day) {
    act(G, { t: 'collect', now });
    act(G, { t: 'daily', day, now });
    for (const rq of REQUESTS) act(G, { t: 'claim', id: rq.id });
    // skill points: spread ranks round-robin over the order
    for (let guard = 0; guard < 40 && G.hero.sp > 0; guard++) {
        const order = learnOrder(G).filter((id) => !learnBlock(G, id));
        if (!order.length) break;
        order.sort((a, b) => (G.hero.ranks[a] || 0) - (G.hero.ranks[b] || 0));
        act(G, { t: 'learn', node: order[0] });
    }
    // buildings: hall first when it gates, then the cheapest useful one
    for (let guard = 0; guard < 6; guard++) {
        const cand = BUILDINGS.map((b) => b.id).filter((id) => !V.buildBlock(G, id));
        if (!cand.length) break;
        const prio = (id) => ({ hall: 0, armory: 1, temple: 2, farm: 3, market: 4, inn: 5, mine: 6, mill: 7, tower: 8 }[id] ?? 9);
        cand.sort((a, b) => prio(a) - prio(b));
        // keep a gold reserve for potions
        const cost = V.buildCost(G, cand[0]);
        if (G.res.gold - (cost.gold || 0) < 60) break;
        act(G, { t: 'build', id: cand[0], now });
    }
    // gear: buy the best affordable piece per slot if it beats what is worn, then upgrade what is worn
    for (const slot of ['weapon', 'armor', 'charm']) {
        const worn = G.inv.find((i) => i.uid === G.hero.eq[slot]);
        const ws = worn ? V.gearScore(worn) : 0;
        const owned = G.inv.filter((i) => ITEM[i.id].slot === slot).sort((a, b) => V.gearScore(b) - V.gearScore(a))[0];
        if (owned && V.gearScore(owned) > ws) act(G, { t: 'equip', uid: owned.uid });
        const shop = V.stock(G).filter((id) => ITEM[id].slot === slot)
            .map((id) => ({ id, s: V.gearScore({ id, plus: 0 }), p: V.price(G, id) }))
            .filter((x) => x.s > ws * 1.15 && x.p <= G.res.gold - 80).sort((a, b) => b.s - a.s)[0];
        if (shop && act(G, { t: 'buy', id: shop.id })) act(G, { t: 'equip', uid: G.inv[G.inv.length - 1].uid });
    }
    for (const slot of ['weapon', 'armor']) {
        const uid = G.hero.eq[slot];
        for (let guard = 0; uid && guard < 3; guard++) if (!act(G, { t: 'upgrade', uid })) break;
    }
    // sell what is not worn
    for (const i of [...G.inv]) if (!Object.values(G.hero.eq).includes(i.uid)) act(G, { t: 'sell', uid: i.uid });
    // potions
    while ((G.bag.potion || 0) < 3 && act(G, { t: 'buy', id: 'potion' })) { /* stock up */ }
    if ((G.bag.feather || 0) < 1 && G.res.gold > 400 && V.stock(G).includes('feather')) act(G, { t: 'buy', id: 'feather' });
}

/** Play one battle-mode stretch to its result and press on. Returns sim seconds spent. */
export function playOut(G, bot, dt = 1 / 30, limit = 900) {
    let t = 0;
    while (G.mode === 'battle' && t < limit) {
        const cmd = botBattle(G, bot, dt);
        if (cmd) act(G, cmd);
        if (G.mode !== 'battle') break;
        step(G, dt);
        t += dt;
    }
    return t;
}

const dayOf = (now) => {
    const d = new Date(now);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Play the whole tale: the village between quests, the story when the hero is ready, patrols to grind when not.
 * Returns a report. now0 is a fixed start time so runs are reproducible.
 */
export function runCampaign(G, bot, { now0 = Date.UTC(2026, 0, 1), maxQuests = 260, minutesPerQuest = 15 } = {}) {
    let now = now0;
    const rep = { quests: 0, patrols: 0, story: 0, losses: 0, chapterLosses: {}, battleSecs: 0, done: false, levelAt: [] };
    let lostStreak = 0;
    for (let q = 0; q < maxQuests && !G.story.done; q++) {
        // scenes are clicked through
        for (let guard = 0; G.mode === 'scene' && guard < 200; guard++) act(G, { t: 'next' });
        if (G.mode !== 'village') break;
        botVillage(G, now, dayOf(now));
        const c = chapter(G);
        const ready = c && G.hero.lv >= c.lv + (lostStreak ? 1 : 0) - 1;
        if (ready) { act(G, { t: 'story' }); rep.story++; }
        else {
            const open = regionsOpen(G);
            const region = c ? (open.includes(c.region) ? c.region : open[open.length - 1]) : open[0];
            act(G, { t: 'patrol', region }); rep.patrols++;
        }
        const ch = G.story.ch;
        const lost0 = G.stats.battlesLost;
        for (let guard = 0; guard < 20 && G.mode !== 'village'; guard++) {
            for (let g2 = 0; G.mode === 'scene' && g2 < 200; g2++) act(G, { t: 'next' });
            if (G.mode === 'battle') {
                rep.battleSecs += playOut(G, bot);
                act(G, { t: 'continue' });
            }
        }
        const lost = G.stats.battlesLost > lost0;
        if (G.story.ch === ch + 1 && ready) rep.levelAt.push(G.hero.lv);
        if (lost) { rep.losses++; if (ready) { rep.chapterLosses[ch] = (rep.chapterLosses[ch] || 0) + 1; lostStreak++; } }
        else if (ready) lostStreak = 0;
        rep.quests++;
        now += minutesPerQuest * 60 * 1000;
    }
    for (let guard = 0; G.mode === 'scene' && guard < 200; guard++) act(G, { t: 'next' });
    rep.done = G.story.done;
    rep.level = G.hero.lv;
    rep.hours = Math.round((now - now0) / HOUR * 10) / 10;
    return rep;
}
export { MANA, EQUIP };
