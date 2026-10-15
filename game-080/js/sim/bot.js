// An auto-player. It plays through the same input and commands the player uses: it walks with
// step(), talks, fights and shops with act(). The tests use it to play the whole game, the
// balance table comes from it, and ?debug=1's autoplay shows it off.
//
// Strategy: follow Wick's objective; open every chest in a dungeon on the way to its guardian;
// carry new grimoires home; buy better bookmarks and cardigans when it can afford them; hunt
// foes when it's under-levelled for what's next; rest when it's frazzled.

import { ITEMS, SHOPS } from './data/items.js';
import { GRIMOIRE } from './data/books.js';
import { FOE } from './data/enemies.js';
import { TILES } from './data/tiles.js';
import { getWorld } from './worldgen.js';
import { graph, node, unnode, search, pathTo, besideNodes, cross } from './nav.js';
import { objective, BOOK_DUNGEON, nextBook } from './story.js';
import { maxHp, maxInk, focus, count, tileAt } from './rules.js';
import { npcsHere } from './game.js';
import { liveFoes, elemMul } from './battle.js';
import { NPCS } from './data/npcs.js';

const HEALS = ['biscuit', 'jam', 'tea', 'cocoa'];

export function makeBot({ skill = 1, shop = true, hunt = true } = {}) {
    return { skill, shop, hunt, goal: null, path: null, pi: 0, replan: 0, stuckT: 0, last: null, log: [], wantBuy: null, jitter: 0, fails: 0 };
}

function ctxOf(G) {
    const lib = getWorld().maps.library;
    const seal = Object.keys(lib.warps).map(Number).find((k) => lib.warps[k].star);
    return { G, books: G.books, keys: G.keys, placed: G.placed.length, starOpen: !!G.opened.library?.[seal] };
}

function here(G) { return node(G.map, Math.floor(G.p.x), Math.floor(G.p.y)); }

// ------------------------------------------------------------------ goals
// A goal: { kind, nodes: [{k, face?}] (any of these will do), use: true (press Action there), why }

function objNodes(map, x, y) { return besideNodes(map, x, y).map((b) => ({ k: b.k, face: b.face })); }

function findObjs(map, pred) {
    const M = getWorld().maps[map];
    const out = [];
    for (const k in M.objs) if (pred(M.objs[k])) out.push({ x: k % M.w, y: Math.floor(k / M.w), o: M.objs[k] });
    return out;
}

const GEAR_ORDER = {
    mark: ['ribbon', 'leather', 'pressed', 'silver', 'moonsilk', 'quill'],
    knit: ['wool', 'patchwork', 'tweed', 'shawl', 'starweave'],
};

function shopFor(G, bot) {
    // the best affordable upgrade at a shop we can reach, keeping a little back for tea
    const opts = [];
    for (const sid in SHOPS) {
        for (const id of SHOPS[sid].stock) {
            const it = ITEMS[id];
            if (it.kind !== 'gear' || !GEAR_ORDER[it.slot]) continue;
            const order = GEAR_ORDER[it.slot];
            const cur = order.indexOf(G.gear[it.slot]);
            const owned = order.findIndex((g, i) => i > cur && count(G, g));
            if (order.indexOf(id) <= Math.max(cur, owned) || G.coins < it.price + 30) continue;
            opts.push({ sid, id, price: it.price });
        }
        if (G.coins >= 80 && SHOPS[sid].stock.includes('biscuit') && count(G, 'biscuit') + count(G, 'tea') < 4) opts.push({ sid, id: 'biscuit', price: 30, n: 3 });
    }
    return opts;
}

function keeperOf(sid) {
    const { maps } = getWorld();
    for (const id in maps) {
        const M = maps[id];
        if (M.shop === sid || M.def?.shop === sid) for (const n of M.npcs) if (NPCS[n.id]?.talk) return { map: id, x: n.x, y: n.y, npc: n.id };
    }
    for (const id in maps) for (const n of maps[id].npcs) if (n.id === 'thimble' && sid === 'mouse_shop') return { map: id, x: n.x, y: n.y, npc: n.id, counter: true };
    return null;
}

function chooseGoal(G, bot) {
    const ctx = ctxOf(G);
    const start = here(G);
    const goals = [];
    const unplaced = G.books.filter((b) => !G.placed.includes(b));

    if (!G.flags.metWick) {
        const lib = getWorld().maps.world;
        for (const k in lib.warps) if (lib.warps[k].to === 'library') return routeTo(ctx, start, [{ g: { kind: 'travel' }, k: +k + 0 }].map((o) => ({ ...o, k: graph().off.world + o.k })));
    }
    if (unplaced.length) {
        const ls = findObjs('library', (o) => o.kind === 'lectern');
        goals.push({ kind: 'place', nodes: ls.flatMap((l) => objNodes('library', l.x, l.y)), use: true });
    }
    // the story's end
    if (!goals.length && G.books.length === 12 && !G.flags.won) {
        if (G.map === 'undercroft') {
            const chests = findObjs('undercroft', (o) => o.kind === 'chest' && !G.chests[o.id]);
            for (const c of chests) goals.push({ kind: 'chest', nodes: objNodes('undercroft', c.x, c.y), use: true });
            const b = findObjs('undercroft', (o) => o.kind === 'boss')[0];
            goals.push({ kind: 'boss', nodes: objNodes('undercroft', b.x, b.y), use: true });
        } else {
            const lib = getWorld().maps.library;
            const seal = Object.keys(lib.warps).map(Number).find((k) => lib.warps[k].star);
            const sx = seal % lib.w, sy = Math.floor(seal / lib.w);
            if (!G.opened.library?.[seal]) goals.push({ kind: 'seal', nodes: objNodes('library', sx, sy), use: true });
            else goals.push({ kind: 'descend', nodes: [{ k: node('library', sx, sy) }] });
        }
    }
    if (!goals.length) {
        // rest when frazzled and out of treats
        const healing = HEALS.reduce((a, h) => a + count(G, h), 0);
        if (G.hp < maxHp(G) * 0.5 && !healing) {
            const beds = findObjs('library', (o) => o.kind === 'bed');
            goals.push({ kind: 'rest', nodes: beds.flatMap((b) => objNodes('library', b.x, b.y)), use: true });
        }
    }
    // a satchel full of runaway books goes to the Returns Cart
    if (!goals.length && Object.values(G.common).filter((v) => v === 1).length >= 6) {
        const cart = findObjs('library', (o) => o.kind === 'returns')[0];
        goals.push({ kind: 'shelve', nodes: objNodes('library', cart.x, cart.y), use: true });
    }
    if (!goals.length && bot.shop) {
        for (const o of shopFor(G, bot)) {
            const k = keeperOf(o.sid);
            if (!k) continue;
            const nodes = k.counter ? [{ k: node(k.map, k.x, k.y - 2), face: 'down' }] : objNodes(k.map, k.x, k.y + 1).filter(() => true).concat([{ k: node(k.map, k.x, k.y + 2), face: 'up' }]);
            goals.push({ kind: 'shop', nodes, use: true, buy: o });
        }
    }
    const next = nextBook(G);
    const dg = next ? BOOK_DUNGEON[next] : null;
    if (!goals.length && dg && bot.hunt) {
        const tier = getWorld().maps[dg].tier;
        const want = Math.round(2 + tier * 2.6);
        if (G.lvl < want && G.map !== dg) {
            // hunt the nearest foe on this map
            if (G.ents.some((e) => !e.swim) && !(bot.noHunt > G.t)) goals.push({ kind: 'hunt', foe: true });
        }
    }
    if (!goals.length && dg) {
        if (G.map === dg) {
            const chests = findObjs(dg, (o) => o.kind === 'chest' && !G.chests[o.id]);
            for (const c of chests) goals.push({ kind: 'chest', nodes: objNodes(dg, c.x, c.y), use: true });
            const b = findObjs(dg, (o) => o.kind === 'boss')[0];
            goals.push({ kind: 'boss', nodes: objNodes(dg, b.x, b.y), use: true });
        } else {
            const ob = objective(G);
            if (ob.map) goals.push({ kind: 'travel', nodes: [{ k: node(ob.map, ob.x, ob.y - 1) }], enter: true });
        }
    }
    if (!goals.length) {
        const ob = objective(G);
        if (ob.map && ob.x != null) goals.push({ kind: 'travel', nodes: [{ k: node(ob.map, ob.x, ob.y) }] });
    }
    // pick the nearest reachable goal (BFS once to all of them)
    const want = new Map();
    for (const g of goals) for (const n of g.nodes || []) if (!want.has(n.k)) want.set(n.k, { g, face: n.face });
    if (goals.some((g) => g.kind === 'hunt')) return { kind: 'hunt' };
    if (!want.size) return null;
    const res = search(ctx, start, (k) => want.has(k));
    if (res.found < 0) return { kind: 'stuck', goals };
    const hit = want.get(res.found);
    return { ...hit.g, path: pathTo(res, res.found), face: hit.face, at: res.found };
}

function routeTo(ctx, start, list) {
    const want = new Map(list.map((o) => [o.k, o]));
    const res = search(ctx, start, (k) => want.has(k));
    if (res.found < 0) return { kind: 'stuck' };
    return { ...want.get(res.found).g, path: pathTo(res, res.found), at: res.found };
}

// ------------------------------------------------------------------ explore input
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function botInput(G, bot, dt = 1 / 120) {
    if (G.mode !== 'explore' || G.fade) return { x: 0, y: 0, a: false };
    bot.replan -= dt;
    const pos = here(G);
    if (!bot.goal || bot.replan <= 0 || bot.goalMap !== G.map && !bot.goal.path) {
        bot.goal = chooseGoal(G, bot);
        bot.replan = 2.5;
        bot.goalMap = G.map;
        bot.pi = 0;
    }
    const goal = bot.goal;
    if (!goal || goal.kind === 'stuck') { bot.fails++; return { x: 0, y: 0, a: false }; }

    if (goal.kind === 'hunt') {
        // walk at the nearest foe we can actually reach
        if (!bot.huntPath || bot.huntT-- <= 0) {
            const want = new Map();
            for (const e of G.ents) if (e.state !== 'dazed' && !e.swim) want.set(node(G.map, Math.floor(e.x), Math.floor(e.y)), e);
            const res = search(ctxOf(G), pos, (k) => want.has(k), 9000);
            bot.huntPath = res.found >= 0 ? pathTo(res, res.found) : null;
            bot.huntFoe = res.found >= 0 ? want.get(res.found) : null;
            bot.huntT = 90;
            if (!bot.huntPath) { bot.noHunt = G.t + 30; bot.replan = 0; bot.goal = null; return { x: 0, y: 0, a: false }; }
        }
        if (!G.ents.includes(bot.huntFoe)) { bot.huntT = 0; return { x: 0, y: 0, a: false }; }
        return follow(G, bot, bot.huntPath, pos, bot.huntFoe);
    }

    const path = goal.path;
    // arrived?
    if (pos === goal.at) {
        if (goal.use) {
            // press once, then think again (the chest is open, the dialogue has started…)
            const v = DIRV[goal.face || 'up'];
            bot.lastGoal = goal;
            bot.goal = goal.kind === 'shop' ? { ...goal, at: -1, path: [pos], done: true } : null;
            if (goal.kind === 'shop') bot.replan = 1;
            return { x: v[0] * 0.3, y: v[1] * 0.3, a: true };
        }
        bot.replan = 0;
        return { x: 0, y: -1, a: false };
    }
    return follow(G, bot, path, pos, null);
}

function follow(G, bot, path, pos, chase) {
    let i = path.indexOf(pos);
    if (i < 0) {
        // knocked off the path (a battle, a nudge): find the nearest point on it on this map
        let bd = Infinity;
        const px = Math.floor(G.p.x), py = Math.floor(G.p.y);
        path.forEach((k, j) => {
            const u = unnode(k);
            if (u.map !== G.map) return;
            const d = Math.abs(u.x - px) + Math.abs(u.y - py);
            if (d < bd) { bd = d; i = j; }
        });
        if (bd > 3) { bot.replan = 0; bot.huntT = 0; }
        if (i < 0) { bot.replan = 0; return { x: 0, y: 0, a: false }; }
    }
    // stuck?
    const cur = Math.round(G.p.x * 10) + ',' + Math.round(G.p.y * 10);
    if (cur === bot.last) { bot.stuckT += 1; } else { bot.stuckT = 0; bot.last = cur; }
    if (bot.stuckT > 240) { bot.stuckT = 0; bot.replan = 0; bot.huntT = 0; bot.jitter = 60; }

    const nk = path[Math.min(i + 1, path.length - 1)];
    const n = unnode(nk);
    if (chase && i + 1 >= path.length) {
        const dx = chase.x - G.p.x, dy = chase.y - G.p.y, l = Math.hypot(dx, dy) || 1;
        return { x: dx / l, y: dy / l, a: false };
    }
    if (n.map !== G.map) { bot.replan = 0; return { x: 0, y: 1, a: false }; }
    const M = getWorld().maps[G.map];
    const c = cross(ctxOf(G), M, n.i);
    const tx = n.x + 0.5, ty = n.y + 0.55;
    let dx = tx - G.p.x, dy = ty - G.p.y;
    if (c === 2 || c === 3) {
        // a lock to open, or a locked door: face it and press Action
        const u = unnode(pos);
        const fx = n.x - u.x, fy = n.y - u.y;
        // centre first, then face
        const cx = u.x + 0.5 - G.p.x, cy = u.y + 0.55 - G.p.y;
        if (Math.abs(cx) > 0.2 || Math.abs(cy) > 0.2) return { x: clamp(cx * 3), y: clamp(cy * 3), a: false };
        return { x: fx, y: fy, a: true };
    }
    if (bot.jitter > 0) { bot.jitter--; const a = (bot.jitter * 0.37) % (Math.PI * 2); return { x: Math.cos(a), y: Math.sin(a), a: false }; }
    // steer along the segment, correcting towards its centre line
    const u = unnode(pos);
    const sx = n.x - u.x, sy = n.y - u.y;
    let ix = sx, iy = sy;
    if (sx) iy = clamp((u.y + 0.55 - G.p.y) * 4);
    if (sy) ix = clamp((u.x + 0.5 - G.p.x) * 4);
    if (!sx && !sy) { ix = clamp(dx * 3); iy = clamp(dy * 3); }
    return { x: ix, y: iy, a: false };
}
const clamp = (v) => Math.max(-1, Math.min(1, v));

// ------------------------------------------------------------------ dialogue, battle, shop
export function botAct(G, bot) {
    if (G.mode === 'dialog') {
        const D = G.dialog;
        if (D.choices) {
            // rest at an inn only when it helps; always go home with Wick
            const re = bot.goal?.kind === 'shop' ? /^Shop/ : /Rest|Go home/;
            const idx = D.choices.findIndex((c) => re.test(c.label));
            return { type: 'choose', i: idx >= 0 ? idx : 0 };
        }
        return { type: 'advance' };
    }
    if (G.mode === 'shop') {
        const want = bot.goal?.buy;
        if (want && G.shop.id === want.sid) {
            const n = want.n || 1;
            bot.bought = (bot.bought || 0);
            if (bot.bought < n && G.coins >= ITEMS[want.id].price) { bot.bought++; return { type: 'buy', id: want.id }; }
        }
        bot.bought = 0;
        bot.goal = null; bot.replan = 0;
        return { type: 'closeShop' };
    }
    if (G.mode === 'battle') return battleChoice(G, bot);
    if (G.mode === 'explore') {
        // wear the best things we own
        for (const slot of ['mark', 'knit']) {
            const order = GEAR_ORDER[slot];
            const cur = order.indexOf(G.gear[slot]);
            for (let j = order.length - 1; j > cur; j--) if (count(G, order[j])) return { type: 'equip', id: order[j] };
        }
        if (!G.gear.charm) for (const c of ['locket', 'musicbox', 'quillpin', 'teacup', 'glasses', 'acorn']) if (count(G, c)) return { type: 'equip', id: c };
        if (G.hp < maxHp(G) * 0.4) for (const h of HEALS) if (count(G, h)) return { type: 'use', id: h };
    }
    return null;
}

function battleChoice(G, bot) {
    const B = G.battle;
    if (B.phase !== 'choose') return { type: 'battleDone' };
    const live = liveFoes(B);
    const target = live.reduce((a, f) => (f.hp < a.hp ? f : a), live[0]);
    const mh = maxHp(G);
    // frazzled: a treat, or the sea
    if (G.hp < mh * 0.38) {
        for (const h of ['biscuit', 'jam', 'cocoa', 'tea']) if (count(G, h)) return { type: 'battle', act: 'item', id: h };
        if (G.books.includes('tide') && G.ink >= GRIMOIRE.tide.spell.ink) return { type: 'battle', act: 'spell', id: 'tide' };
    }
    if (bot.skill < 1 && G.rng() > bot.skill) return { type: 'battle', act: 'shush', target: target.n };
    // the most calm per turn: Shush, or a spell we can afford
    const sh = focus(G) * 20 / (20 + target.poise);
    let best = { act: 'shush', target: target.n }, bv = sh;
    for (const id of G.books) {
        const sp = GRIMOIRE[id].spell;
        if (sp.kind !== 'calm' || G.ink < sp.ink) continue;
        const base = (focus(G) * 0.55 + G.lvl * 1.5 + sp.power * 1.6) * 30 / (30 + target.poise);
        let v;
        if (sp.target === 'all') v = live.reduce((a, f) => a + Math.min(f.hp, base * 0.72 * elemMul(f.id, sp.elem)), 0);
        else v = Math.min(target.hp, base * elemMul(target.id, sp.elem));
        // spend ink when it's clearly better, or on guardians
        const worth = B.boss ? 1.05 : 1.35;
        if (v > bv * worth) { bv = v; best = { act: 'spell', id, target: target.n }; }
    }
    if (B.boss && G.ink < 4 && count(G, 'inkpot') && G.hp > mh * 0.5) return { type: 'battle', act: 'item', id: 'inkpot' };
    return { type: 'battle', ...best };
}

export { HEALS };
