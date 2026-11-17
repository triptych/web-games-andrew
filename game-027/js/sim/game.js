// The alchemist's campaign: the chapter map, the cauldron, Pellerin's shop, the skill tree, the
// story's scenes and the level being played. Pure: no DOM, no rendering library, no Math.random, no
// clock. Everything happens in act(G, cmd); the UI, the view, the bot and the tests only read G
// (and drain G.events and G.level.events).

import { START, RESOLVE, CHAPTERS } from '../config.js';
import { rnd, rint, rpick, rweighted, mix } from '../rng.js';
import { makeMap, node, nextIds } from './map.js';
import { makeLevel, palette } from './levelgen.js';
import { newLevel, actLevel } from './level.js';
import { SHAPES, START_SHAPES, RARITY_TIER, CAULDRONS } from './data/shapes.js';
import { ELEMENTS, ELEMENT_IDS } from './data/elements.js';
import { ITEMS, ENHANCEMENTS, POTIONS, GRADES } from './data/potions.js';
import { SKILLS } from './data/skills.js';
import { CACHE_SCENES } from './data/story.js';

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed: seed | 0,
        rs: mix(seed, 1),
        chapter: 1,
        map: makeMap(seed, 1),
        at: null,                 // the node you stand on (null: before the first)
        path: [],                 // nodes cleared this chapter
        resolve: RESOLVE,
        gold: START.gold,
        xp: 0, xpTotal: 0,
        stores: Object.fromEntries(ELEMENT_IDS.map((e) => [e, 0])),
        shapes: [...START_SHAPES],
        tier: 1,
        skills: [],
        items: { ...START.items },
        potions: {},              // id: { n, best }
        seen: {},                 // scenes played
        queue: ['ch1-intro'],     // scenes waiting to be played
        caches: 0,
        node: null,               // the node being played: { id, type, ... }
        level: null,
        reward: null,             // what the last finished node gave, for the result screen
        shop: null,
        won: false,
        stats: { levels: 0, fails: 0, lines: 0, harvests: 0, foes: 0, potions: 0, score: 0, resets: 0 },
        events: [],
    };
    return G;
}

// ------------------------------------------------------------------ queries

export const inLevel = (G) => !!G.level;
export const choices = (G) => (G.level || G.shop ? [] : nextIds(G.map, G.at));
export const nodeOf = (G, id) => node(G.map, id);
export const cauldron = (G) => CAULDRONS[G.tier];

/** Can this tile type be learned at the cauldron now? */
export function canLearn(G, id) {
    const s = SHAPES[id];
    if (!s || G.shapes.includes(id) || G.level) return false;
    if (RARITY_TIER[s.rarity] > G.tier) return false;
    return Object.entries(s.recipe).every(([e, n]) => G.stores[e] >= n);
}
export function canTrain(G, id) {
    const s = SKILLS[id];
    return !!s && !G.skills.includes(id) && !G.level && G.xp >= s.cost && s.req.every((r) => G.skills.includes(r));
}
export const canAfford = (G, cost) => Object.entries(cost).every(([e, n]) => G.stores[e] >= n);

// ------------------------------------------------------------------ commands

/**
 * cmd: { t: 'go', id, enh? }      travel to a forward node (enh: enhancements for a refinement)
 *      level commands             forwarded to the level: place, item, skill, concede
 *      { t: 'finish' }            leave a finished level: rewards, or a lost point of resolve
 *      { t: 'buy', id }           { t: 'leave' } in the shop
 *      { t: 'learn', id }         learn a tile type at the cauldron
 *      { t: 'train', id }         learn a skill
 *      { t: 'seen', id }          a scene has been played
 */
export function act(G, cmd) {
    if (!cmd) return false;
    if (G.level && ['place', 'item', 'skill', 'concede'].includes(cmd.t)) return actLevel(G.level, cmd);
    let ok = false;
    if (cmd.t === 'go') ok = go(G, cmd);
    else if (cmd.t === 'finish') ok = finish(G);
    else if (cmd.t === 'buy') ok = buy(G, cmd.id);
    else if (cmd.t === 'leave') ok = leave(G);
    else if (cmd.t === 'learn') ok = learn(G, cmd.id);
    else if (cmd.t === 'train') ok = train(G, cmd.id);
    else if (cmd.t === 'seen') ok = seen(G, cmd.id);
    if (!ok) G.events.push({ type: 'invalid', cmd: cmd.t });
    return ok;
}

function queue(G, id) {
    if (!G.seen[id] && !G.queue.includes(id)) G.queue.push(id);
}
function seen(G, id) {
    const k = G.queue.indexOf(id);
    if (k >= 0) G.queue.splice(k, 1);
    G.seen[id] = true;
    return true;
}

function go(G, { id, enh = [] }) {
    if (G.level || G.shop || !choices(G).includes(id)) return false;
    const n = node(G.map, id);
    if (n.type === 'refine' || (n.type === 'elite')) {
        for (const e of enh) if (!ENHANCEMENTS[e]) return false;
        const cost = {};
        for (const e of enh) for (const [k, v] of Object.entries(ENHANCEMENTS[e].cost)) cost[k] = (cost[k] || 0) + v;
        if (!canAfford(G, cost)) return false;
        G.pendingCost = cost;
    }
    if (n.type === 'shop') {
        G.at = id;
        G.path.push(id);
        G.shop = { stock: stock(G, n) };
        queue(G, 'shop-pellerin-intro');
        G.events.push({ type: 'shop', id });
        return true;
    }
    if (n.type === 'cache') {
        G.at = id;
        G.path.push(id);
        cache(G, n);
        return true;
    }
    // a level
    const first = G.chapter === 1 && id === G.map.entry && !G.stats.levels;
    const def = makeLevel({ type: n.type, chapter: G.chapter, seed: mix(n.seed, G.stats.fails), first }, { shapes: G.shapes, enh });
    if (def.kind === 'refine' && G.pendingCost) {
        for (const [k, v] of Object.entries(G.pendingCost)) G.stores[k] -= v;
    } else enh = [];
    G.pendingCost = null;
    G.node = { id, type: n.type, kind: def.kind, enh };
    G.level = newLevel(def, { skills: G.skills, items: G.items, seed: mix(n.seed, G.stats.levels, G.stats.fails, 7) });
    if (def.kind === 'refine') queue(G, 'first-refine');
    if (def.kind === 'battle' && !def.boss) queue(G, 'first-battle');
    if (n.type === 'boss' && G.chapter <= CHAPTERS) queue(G, `ch${G.chapter}-boss-taunt`);
    G.events.push({ type: 'level', id, kind: def.kind });
    return true;
}

function finish(G) {
    const L = G.level;
    if (!L || L.status === 'play' || L.status === 'stuck') return false;
    // items spent in the level are gone whether it was won or lost
    for (const [id, n] of Object.entries(L.used)) G.items[id] = Math.max(0, (G.items[id] || 0) - n);
    for (const id in G.items) if (!G.items[id]) delete G.items[id];
    G.stats.lines += L.lines;
    G.stats.score += L.score;
    const xp = L.xp;
    const ch = G.chapter;
    const n = node(G.map, G.node.id);
    const R = { won: L.status === 'won', reason: L.reason, kind: L.kind, name: L.name, gold: 0, xp, elements: {}, potion: null, grade: null, score: L.score };
    if (R.won) {
        G.stats.levels++;
        const elite = n.type === 'elite', boss = n.type === 'boss';
        const mul = (elite ? 1.8 : boss ? 3 : 1) * (1 + 0.35 * (ch - 1));
        for (const id of L.harvested) {
            const d = L.deposits.find((x) => x.id === id);
            const qty = d.qty + (L.skills.includes('vein') ? 1 : 0);
            R.elements[d.el] = (R.elements[d.el] || 0) + qty;
            G.stats.harvests++;
            queue(G, 'ch1-first-harvest');
        }
        if (L.kind === 'explore') { R.gold = Math.round(18 * mul); R.xp += 30 + 10 * ch; }
        if (L.kind === 'refine') {
            const g = GRADES.indexOf(L.refine.grade);
            R.potion = L.refine.potion; R.grade = L.refine.grade;
            R.gold = Math.round([25, 45, 75, 115][g] * mul);
            R.xp += 40 + 12 * ch + g * 10;
            const p = G.potions[R.potion] || { n: 0, best: 'crude' };
            p.n++;
            if (g > GRADES.indexOf(p.best)) p.best = R.grade;
            G.potions[R.potion] = p;
            G.stats.potions++;
        }
        if (L.kind === 'battle') {
            R.gold = Math.round(30 * mul);
            R.xp += 45 + 15 * ch;
            G.stats.foes += L.battle.foes.length;
            // foes leave something behind: an element of the chapter
            const o = { rs: mix(n.seed, 99) };
            const drops = boss ? 4 : elite ? 3 : rint(o, 1, 2);
            const pal = palette(ch);
            for (let k = 0; k < drops; k++) { const e = rweighted(o, pal); R.elements[e] = (R.elements[e] || 0) + 1; }
        }
        if (elite) { const e = rpick({ rs: mix(n.seed, 5) }, tierElements(G.tier)); R.elements[e] = (R.elements[e] || 0) + 2; }
        for (const [e, q] of Object.entries(R.elements)) G.stores[e] = (G.stores[e] || 0) + q;
        G.gold += R.gold;
        G.at = G.node.id;
        G.path.push(G.node.id);
        if (boss) bossDown(G, R);
    } else {
        G.stats.fails++;
        R.xp = Math.round(xp / 2);
        G.resolve--;
        if (G.resolve <= 0) {
            // the chapter's map is redrawn; you keep everything you learned and own
            G.stats.resets++;
            G.map = makeMap(mix(G.seed, G.stats.resets, 13), G.chapter);
            G.at = null;
            G.path = [];
            G.resolve = RESOLVE;
            R.reset = true;
        }
    }
    G.xp += R.xp;
    G.xpTotal += R.xp;
    G.reward = R;
    G.level = null;
    G.node = null;
    G.events.push({ type: 'finished', reward: R });
    return true;
}

function tierElements(tier) {
    const ok = CAULDRONS[Math.min(4, tier)].elements;
    return ELEMENT_IDS.filter((e) => ok.includes(ELEMENTS[e].tier));
}

function bossDown(G, R) {
    const ch = G.chapter;
    if (G.tier < 4) { G.tier++; R.tier = G.tier; }
    if (ch <= CHAPTERS) {
        queue(G, `ch${ch}-boss-clear`);
        if (ch < CHAPTERS) { queue(G, `ch${ch}-complete`); queue(G, `ch${ch + 1}-intro`); }
        else { queue(G, 'ending'); G.won = true; R.ending = true; }
    } else queue(G, 'open-road');
    G.chapter++;
    G.map = makeMap(mix(G.seed, G.chapter, G.stats.resets), G.chapter);
    G.at = null;
    G.path = [];
    G.resolve = RESOLVE;
    G.caches = 0;
    R.chapter = G.chapter;
    G.events.push({ type: 'chapter', chapter: G.chapter });
}

// ------------------------------------------------------------------ shop, cache, cauldron, skills

function stock(G, n) {
    const o = { rs: mix(n.seed, 3) };
    const ids = Object.keys(ITEMS).filter((id) => id !== 'tonic' || G.chapter >= 1);
    const out = [];
    for (const id of ids) {
        const disc = G.chapter > 1 && rnd(o) < 0.25 ? 0.8 : 1;
        out.push({ id, price: Math.round(ITEMS[id].price * disc * (1 + 0.1 * (G.chapter - 1))), left: 2 });
    }
    return out;
}

function buy(G, id) {
    const s = G.shop?.stock.find((x) => x.id === id);
    if (!s || s.left <= 0 || G.gold < s.price) return false;
    G.gold -= s.price;
    s.left--;
    G.items[id] = (G.items[id] || 0) + 1;
    G.events.push({ type: 'buy', id });
    return true;
}
function leave(G) {
    if (!G.shop) return false;
    G.shop = null;
    G.events.push({ type: 'left' });
    return true;
}

function cache(G, n) {
    const o = { rs: mix(n.seed, 11) };
    const scenes = CACHE_SCENES[Math.min(G.chapter, 3)];
    const scene = scenes[Math.min(G.caches, scenes.length - 1)];
    G.caches++;
    if (!G.seen[scene]) queue(G, scene);
    const R = { cache: true, gold: rint(o, 15, 30) * G.chapter, elements: {}, items: {} };
    const els = tierElements(G.tier);
    for (let k = 0; k < 3; k++) { const e = rpick(o, els); R.elements[e] = (R.elements[e] || 0) + 1; }
    const item = rpick(o, Object.keys(ITEMS));
    R.items[item] = 1;
    G.gold += R.gold;
    for (const [e, q] of Object.entries(R.elements)) G.stores[e] += q;
    G.items[item] = (G.items[item] || 0) + 1;
    G.reward = R;
    G.events.push({ type: 'cache', reward: R, scene });
}

function learn(G, id) {
    if (!canLearn(G, id)) return false;
    for (const [e, n] of Object.entries(SHAPES[id].recipe)) G.stores[e] -= n;
    G.shapes.push(id);
    G.events.push({ type: 'learn', id });
    return true;
}
function train(G, id) {
    if (!canTrain(G, id)) return false;
    G.xp -= SKILLS[id].cost;
    G.skills.push(id);
    G.events.push({ type: 'train', id });
    return true;
}

// ------------------------------------------------------------------ saves

export function serialize(G) {
    const { events, ...rest } = G;
    const out = JSON.parse(JSON.stringify(rest));
    if (out.level) out.level.events = [];
    return out;
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!d.map || !Array.isArray(d.shapes) || typeof d.stores !== 'object') throw new Error('corrupt save');
    if (d.level && (!Array.isArray(d.level.cells) || !Array.isArray(d.level.hand))) throw new Error('corrupt level');
    const G = JSON.parse(JSON.stringify(d));
    G.events = [];
    if (G.level) G.level.events = [];
    return G;
}

export { POTIONS };
