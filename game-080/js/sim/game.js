// EMBERLEAF — the simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the UI and the bot change it only through step() (held
// input, each fixed step) and act() (discrete commands: a dialogue choice, a battle action, a
// purchase).

import { PLAYER, ENEMY, ZW, ZH, DAY_SECONDS } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { T, TILES } from './data/tiles.js';
import { ITEMS, SHOPS, sellPrice } from './data/items.js';
import { GRIMOIRE, COMMON_BOOKS, GENRES, GENRE_REWARD } from './data/books.js';
import { FOE } from './data/enemies.js';
import { NPCS } from './data/npcs.js';
import { getWorld, zoneAt } from './worldgen.js';
import {
    DIRS, tileAt, passable, canFoeWalk, hasBook, maxHp, maxInk, addItem, takeItem, count, gainXp,
} from './rules.js';
import { startBattle, battleAct, closeBattle, useEffects } from './battle.js';
import {
    introScript, meetWickScript, bossIntro, bossWonScript, placeScript, lecternText, hearthScript,
    finalScript, shelveScript,
} from './story.js';

export const SAVE_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function mapOf(G) { return getWorld().maps[G.map]; }

// ------------------------------------------------------------------ a new game
export function newGame(seed = 1, { skipIntro = false } = {}) {
    const { maps } = getWorld();
    const W = maps.world;
    // start in Lantern Square, just in front of the library door
    let door = null;
    for (const k in W.warps) if (W.warps[k].to === 'library') door = { x: k % W.w, y: Math.floor(k / W.w) };
    const G = {
        v: SAVE_VERSION,
        seed,
        rng: makeRng(seed),
        t: 0,
        clock: DAY_SECONDS * 0.3,        // morning
        mode: 'explore',
        map: 'world',
        p: { x: door.x + 0.5, y: door.y + 2.6, dir: 'up', moving: false, swim: false, float: false, small: false, walk: 0 },
        lvl: 1, xp: 0, hp: 0, ink: 0,
        gear: { mark: 'ribbon', knit: 'wool', charm: null },
        bag: { tea: 3 },
        coins: 25,
        books: [],
        placed: [],
        common: {},
        ups: {},
        keys: {},
        opened: {},
        chests: {},
        calmed: {},
        bosses: {},
        flags: {},
        quests: {},
        seen: {},
        rest: { map: 'library', x: 27, y: 10 },
        ents: [],
        npcAt: {},
        dialog: null, battle: null, shop: null, fade: null,
        grace: 1.5,
        zone: null,
        bark: 0,
        stats: { battles: 0, calmed: 0, steps: 0, chests: 0, finds: 0 },
        events: [],
    };
    G.hp = maxHp(G);
    G.ink = maxInk(G);
    enterMap(G, 'world');
    G.zone = zoneAt(G.p.x, G.p.y)?.id || null;
    if (G.zone) G.seen[G.zone] = 1;
    if (!skipIntro) openDialog(G, introScript());
    else { addItem(G, 'libkey'); G.flags.introDone = 1; }
    return G;
}

// ------------------------------------------------------------------ foes on the current map
function spawnFoe(G, M, s) {
    const h = hash3(s.x * 7, s.y * 13, s.id.length);
    const foe = s.foes[Math.floor(h * s.foes.length)];
    return { sid: s.id, foe, x: s.x, y: s.y, hx: s.x, hy: s.y, tx: s.x, ty: s.y, state: 'wander', t: 0, swim: !!s.swim, dir: 'down' };
}

function enterMap(G, id) {
    G.map = id;
    const M = mapOf(G);
    G.ents = M.spawns.filter((s) => !G.calmed[s.id]).map((s) => spawnFoe(G, M, s));
}

// ------------------------------------------------------------------ dialogue
export function openDialog(G, ops, from = null) {
    G.dialog = { ops, pc: 0, line: null, choices: null, then: [], from };
    G.mode = 'dialog';
    runDialog(G);
}

function labelAt(D, name) {
    const i = D.ops.findIndex((op) => op[0] === 'label' && op[1] === name);
    if (i < 0) throw new Error('no label ' + name);
    return i + 1;
}

function runDialog(G) {
    const D = G.dialog;
    while (D.pc < D.ops.length) {
        const op = D.ops[D.pc++];
        switch (op[0]) {
            case 'say':
                D.line = { who: op[1], text: op[2] };
                D.choices = null;
                G.events.push({ type: 'say', who: op[1], text: op[2] });
                return;
            case 'choice':
                D.choices = op[1].map(([label, to]) => ({ label, to }));
                G.events.push({ type: 'choices' });
                return;
            case 'label': break;
            case 'goto': D.pc = labelAt(D, op[1]); break;
            case 'end': D.pc = D.ops.length; break;
            case 'give':
                addItem(G, op[1], op[2] || 1);
                G.events.push({ type: 'gain', item: op[1], n: op[2] || 1 });
                break;
            case 'take': takeItem(G, op[1], op[2] || 1); break;
            case 'coins':
                G.coins = Math.max(0, G.coins + op[1]);
                if (op[1] > 0) G.events.push({ type: 'coins', n: op[1] });
                break;
            case 'common':
                if (!G.common[op[1]]) G.common[op[1]] = 1;
                G.events.push({ type: 'gainBook', id: op[1] });
                break;
            case 'xp': gainXp(G, op[1]); break;
            case 'flag': G.flags[op[1]] = op[2] ?? 1; break;
            case 'quest':
                G.quests[op[1]] = op[2];
                G.events.push({ type: 'quest', id: op[1], state: op[2] });
                break;
            case 'need': {
                const n = op[1];
                const ok = (n.coins == null || G.coins >= n.coins) && (n.item == null || count(G, n.item) > 0);
                if (!ok) D.pc = labelAt(D, op[2]);
                break;
            }
            case 'rest': doRest(G); break;
            case 'shop': D.then.push(['shop', op[1]]); break;
            case 'battle': D.then.push(['battle', op[1]]); break;
            case 'warp': D.then.push(['warp', op[1], op[2], op[3]]); break;
            case 'placeOne':
                if (!G.placed.includes(op[1])) {
                    G.placed.push(op[1]);
                    G.events.push({ type: 'restore', id: op[1], n: G.placed.length });
                }
                break;
            case 'final':
                G.events.push({ type: 'ending' });
                break;
            default: throw new Error('unknown op ' + op[0]);
        }
    }
    closeDialog(G);
}

function closeDialog(G) {
    const D = G.dialog;
    G.dialog = null;
    G.mode = 'explore';
    G.events.push({ type: 'dialogEnd' });
    for (const t of D.then) {
        if (t[0] === 'shop') { G.shop = { id: t[1] }; G.mode = 'shop'; G.events.push({ type: 'shopOpen', id: t[1] }); }
        else if (t[0] === 'battle') {
            const M = mapOf(G);
            startBattle(G, [t[1]], { boss: t[1], dungeon: M.id });
        } else if (t[0] === 'warp') beginWarp(G, { to: t[1], x: t[2], y: t[3], dir: 'down' });
    }
}

// ------------------------------------------------------------------ commands
/** Discrete commands from the UI or the bot. Returns false if it made no sense right now. */
export function act(G, cmd) {
    switch (cmd.type) {
        case 'advance':
            if (G.mode !== 'dialog' || G.dialog.choices) return false;
            runDialog(G);
            return true;
        case 'choose': {
            const D = G.dialog;
            if (G.mode !== 'dialog' || !D.choices || !D.choices[cmd.i]) return false;
            const to = D.choices[cmd.i].to;
            D.choices = null;
            G.events.push({ type: 'chose', i: cmd.i });
            D.pc = labelAt(D, to);
            runDialog(G);
            return true;
        }
        case 'battle':
            if (G.mode !== 'battle') return false;
            return battleAct(G, cmd);
        case 'battleDone': return finishBattle(G);
        case 'buy': return buy(G, cmd.id);
        case 'sell': return sell(G, cmd.id);
        case 'closeShop':
            if (G.mode !== 'shop') return false;
            G.shop = null; G.mode = 'explore';
            G.events.push({ type: 'shopClose' });
            return true;
        case 'home':
            // Wick can always find the way home
            if (G.mode !== 'explore' || G.fade || !G.flags.metWick || G.map === 'library') return false;
            beginWarp(G, { to: 'library', x: 17, y: 12, dir: 'down' });
            G.events.push({ type: 'home' });
            return true;
        case 'use': return useItem(G, cmd.id);
        case 'equip': return equip(G, cmd.id);
        case 'unequip': {
            const id = G.gear[cmd.slot];
            if (!id || cmd.slot === 'mark' || cmd.slot === 'knit') return false;
            G.gear[cmd.slot] = null; addItem(G, id);
            G.hp = Math.min(G.hp, maxHp(G));
            return true;
        }
        default: return false;
    }
}

function buy(G, id) {
    if (G.mode !== 'shop') return false;
    const shop = SHOPS[G.shop.id];
    const it = ITEMS[id];
    if (!shop.stock.includes(id) || G.coins < it.price) return false;
    if (it.kind === 'gear' && (count(G, id) || Object.values(G.gear).includes(id))) return false;
    G.coins -= it.price;
    addItem(G, id);
    G.events.push({ type: 'buy', id });
    return true;
}
function sell(G, id) {
    if (G.mode !== 'shop') return false;
    const it = ITEMS[id];
    if (!it || it.kind === 'key' || !count(G, id) || !it.price) return false;
    takeItem(G, id);
    G.coins += sellPrice(id);
    G.events.push({ type: 'sell', id });
    return true;
}
function useItem(G, id) {
    const it = ITEMS[id];
    if (G.mode !== 'explore' || !it || it.kind !== 'use' || it.flee || !count(G, id)) return false;
    if (it.heal && !it.ink && G.hp >= maxHp(G)) return false;
    if (it.ink && !it.heal && G.ink >= maxInk(G)) return false;
    takeItem(G, id);
    useEffects(G, it, false);
    G.events.push({ type: 'used', id });
    return true;
}
function equip(G, id) {
    const it = ITEMS[id];
    if (!it || it.kind !== 'gear' || !count(G, id)) return false;
    if (G.mode === 'battle') return false;
    const old = G.gear[it.slot];
    takeItem(G, id);
    if (old) addItem(G, old);
    G.gear[it.slot] = id;
    G.hp = Math.min(G.hp, maxHp(G));
    G.events.push({ type: 'equip', id });
    return true;
}

function finishBattle(G) {
    const B = G.battle;
    if (!B || B.phase === 'choose') return false;
    closeBattle(G);
    const how = B.phase;
    G.grace = ENEMY.grace;
    if (how === 'won') {
        if (B.spawn) {
            G.calmed[B.spawn] = 1;
            G.ents = G.ents.filter((e) => e.sid !== B.spawn);
        }
        if (B.boss) {
            const d = FOE[B.boss];
            if (d.final) { openDialog(G, finalScript()); return true; }
            if (d.book) openDialog(G, bossWonScript(G, d.book));
        }
    } else if (how === 'lost') {
        // overwhelmed: Wick leads you home, and nothing is lost
        G.hp = maxHp(G);
        G.ink = maxInk(G);
        G.events.push({ type: 'overwhelmed' });
        beginWarp(G, { to: G.rest.map, x: G.rest.x, y: G.rest.y, dir: 'down', quiet: true });
    } else if (how === 'fled' && B.spawn) {
        const e = G.ents.find((x) => x.sid === B.spawn);
        if (e) { e.state = 'dazed'; e.t = 3; }
    }
    return true;
}

function doRest(G) {
    G.hp = maxHp(G);
    G.ink = maxInk(G);
    G.calmed = {};
    G.rest = { map: G.map, x: Math.floor(G.p.x), y: Math.floor(G.p.y) };
    G.events.push({ type: 'rest' });
    enterMapKeepPlayer(G);
}
function enterMapKeepPlayer(G) {
    const M = mapOf(G);
    G.ents = M.spawns.filter((s) => !G.calmed[s.id]).map((s) => spawnFoe(G, M, s));
}

// ------------------------------------------------------------------ moving between maps
function beginWarp(G, to) {
    G.fade = { t: 0, to, swapped: false };
    G.events.push({ type: 'warpStart', quiet: !!to.quiet });
}

function doWarp(G, to) {
    const from = G.map;
    const M = getWorld().maps[to.to];
    let x = to.x, y = to.y;
    if (x == null) { x = M.arrive.x; y = M.arrive.y; }
    enterMap(G, to.to);
    G.p.x = x + 0.5; G.p.y = y + 0.55;
    G.p.dir = to.dir || 'down';
    G.grace = Math.max(G.grace, 1.0);
    G.events.push({ type: 'warp', from, to: to.to });
    // the first time inside the library, Wick wakes up
    if (to.to === 'library' && !G.flags.metWick) openDialog(G, meetWickScript());
}

// ------------------------------------------------------------------ interacting
function facingPoint(G, d = PLAYER.reach) {
    const [dx, dy] = DIRS[G.p.dir];
    return { x: G.p.x + dx * d, y: G.p.y - 0.15 + dy * d };
}

export function npcsHere(G) {
    const M = mapOf(G);
    return M.npcs.filter((n) => !NPCS[n.id]?.when || NPCS[n.id].when(G));
}

function npcNear(G, pt, r = 0.75) {
    let best = null, bd = r;
    for (const n of npcsHere(G)) {
        const d = Math.hypot(n.x + 0.5 - pt.x, n.y + 0.55 - pt.y);
        if (d < bd) { bd = d; best = n; }
    }
    return best;
}

export function talkTo(G, id) {
    const def = NPCS[id];
    if (!def?.talk) return false;
    G.events.push({ type: 'talk', id });
    openDialog(G, def.talk(G), id);
    return true;
}

function bark(G, text) {
    if (G.bark > 0) return;
    G.bark = 2.5;
    G.events.push({ type: 'bark', who: 'wick', text });
}

const NEED_LINE = {
    gust: 'This fog is thick as porridge. If only we had a good strong wind…',
    ember: 'These brambles are too tangled to push through. Something warm would shrivel them right up.',
    stone: 'A boulder. Stones are very stubborn. Unless you know how to ask them nicely.',
    frost: 'The water\'s far too quick to wade. If it would only hold still… like ice.',
    small: 'A mouse door! Lovely. If only we were mouse-sized.',
    verdant: 'A little sprout at the foot of the cliff. It looks like it wants to climb.',
    tide: 'Deep water. Neither of us can swim, and I\'d go out like a candle.',
    echo: 'A ghostly gate. It\'s whispering… but I can\'t make out the words.',
    key: 'A rune seal. Somewhere there\'s a book full of the words that open things.',
    feather: 'A chasm full of wind. We\'d need to be light as a feather to float across.',
    stars: 'A seal of stars. It\'s waiting for something.',
    lumen: 'It\'s pitch black in there. We need a light. A proper light, not me.',
};

/** What Action would reach right now: a person, or a map tile (with its object, if any). */
function reachable(G) {
    const M = mapOf(G);
    const pt = facingPoint(G);
    // people first
    const n = npcNear(G, pt);
    if (n) return { npc: n };
    // the tile straight ahead of the one you stand on, or failing that, the one you're reaching into
    const [dx, dy] = DIRS[G.p.dir];
    const ax = Math.floor(G.p.x) + dx, ay = Math.floor(G.p.y) + dy;
    const useful = (x, y) => {
        if (x < 0 || y < 0 || x >= M.w || y >= M.h) return false;
        const k = y * M.w + x, d = TILES[tileAt(G, M, k)];
        return !!(M.objs[k] || d.lock || d.keyDoor || tileAt(G, M, k) === T.counter);
    };
    let tx = Math.floor(pt.x), ty = Math.floor(pt.y);
    if (useful(ax, ay) || !useful(tx, ty)) { tx = ax; ty = ay; }
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return null;
    const i = ty * M.w + tx;
    const t = tileAt(G, M, i);
    const obj = M.objs[i];
    // a shop counter: talk to whoever is behind it
    if (t === T.counter && !obj) {
        const far = npcNear(G, facingPoint(G, PLAYER.reach + 1.0), 1.0);
        if (far) return { npc: far };
    }
    return { M, i, tx, ty, t, obj };
}

function interact(G) {
    const r = reachable(G);
    if (!r) return false;
    if (r.npc) return talkTo(G, r.npc.id);
    const { M, i, tx, ty, t, obj } = r;
    if (obj) return useObject(G, M, i, obj);
    const d = TILES[t];
    if (d.lock) return usePower(G, M, i, t);
    if (d.keyDoor) {
        const dg = M.id;
        if ((G.keys[dg] || 0) > 0) {
            G.keys[dg]--;
            openTiles(G, M, [i]);
            G.events.push({ type: 'unlock', x: tx, y: ty });
        } else bark(G, 'Locked. There must be a key somewhere in here.');
        return true;
    }
    return false;
}

const LOCK_VERB = { pass: 'Look' };
/**
 * The little "Z" prompt: what Action would do if pressed now, and where to show it (tile
 * coordinates of the spot to float it over), or null when it would do nothing worth a prompt.
 */
export function prompt(G) {
    if (G.mode !== 'explore' || G.fade) return null;
    const r = reachable(G);
    if (!r) return null;
    if (r.npc) return NPCS[r.npc.id]?.talk ? { verb: 'Talk', x: r.npc.x + 0.5, y: r.npc.y - 0.6 } : null;
    const { M, tx, ty, t, obj } = r;
    const at = (verb) => ({ verb, x: tx + 0.5, y: ty - 0.3 });
    if (obj) {
        switch (obj.kind) {
            case 'chest': return G.chests[obj.id] ? null : at('Open');
            case 'stash': return G.chests[obj.id] ? null : at('Search');
            case 'sign': return at('Read');
            case 'bed': return at('Rest');
            case 'lectern': return at(G.books.some((b) => !G.placed.includes(b)) ? 'Place books' : 'Read');
            case 'hearth': return at('Hearth');
            case 'returns': return at(COMMON_BOOKS.some((b) => G.common[b.id] === 1) ? 'Return books' : 'Look');
            case 'telescope': return at('Look');
            case 'boss': return G.bosses[obj.id] ? null : at('Approach');
            default: return null;
        }
    }
    const d = TILES[t];
    if (d.lock) {
        if (d.mode === 'pass') return hasBook(G, d.lock) ? null : at(LOCK_VERB.pass);
        if (!hasBook(G, d.lock)) return at('Look');
        if (t === T.starseal && G.placed.length < 12) return at('Look');
        return at(GRIMOIRE[d.lock]?.short || 'Use');
    }
    if (d.keyDoor) return at((G.keys[M.id] || 0) > 0 ? 'Unlock' : 'Look');
    return null;
}

const NOOK_LINE = {
    shelf: 'Tucked behind a row of books', table: 'Under the table, in a little drawer', barrel: 'At the bottom of the barrel',
    crate: 'In the crate, under the straw', flowerbox: 'Hidden behind the flowerpot', hearth: 'On the mantelpiece', clutter: 'Among the clutter',
};

function useObject(G, M, i, obj) {
    switch (obj.kind) {
        case 'stash': {
            if (G.chests[obj.id]) { bark(G, 'Nothing else tucked away here.'); return true; }
            G.chests[obj.id] = 1;
            G.stats.finds = (G.stats.finds || 0) + 1;
            const where = NOOK_LINE[obj.nook] || 'Tucked away here';
            if (obj.coins) {
                G.coins += obj.coins;
                G.events.push({ type: 'find', id: obj.id, coins: obj.coins, x: i % M.w, y: Math.floor(i / M.w) });
                openDialog(G, [['say', 'note', `${where}: ${obj.coins} coins! Finders keepers, the owner would surely say.`]]);
            } else {
                addItem(G, obj.item, obj.n || 1);
                G.events.push({ type: 'find', id: obj.id, item: obj.item, x: i % M.w, y: Math.floor(i / M.w) });
                const it = ITEMS[obj.item];
                openDialog(G, [['say', 'note', `${where}: ${(obj.n || 1) > 1 ? obj.n + ' × ' : 'a '}${it.name}!`]]);
            }
            return true;
        }
        case 'chest': {
            if (G.chests[obj.id]) { bark(G, 'Empty. We already peeked.'); return true; }
            G.chests[obj.id] = 1;
            G.stats.chests++;
            if (obj.key) {
                G.keys[obj.dungeon] = (G.keys[obj.dungeon] || 0) + 1;
                G.events.push({ type: 'chest', id: obj.id, key: true, x: i % M.w, y: Math.floor(i / M.w) });
                openDialog(G, [['say', 'note', 'Inside the chest: a small brass key. It must open a door in here.']]);
            } else {
                addItem(G, obj.item, obj.n);
                G.events.push({ type: 'chest', id: obj.id, item: obj.item, n: obj.n, x: i % M.w, y: Math.floor(i / M.w) });
                const it = ITEMS[obj.item];
                openDialog(G, [['say', 'note', `Inside the chest: ${obj.n > 1 ? obj.n + ' × ' : ''}${it.name}! ${it.kind === 'up' ? it.text : ''}`]]);
            }
            return true;
        }
        case 'sign': openDialog(G, [['say', 'note', obj.text]]); return true;
        case 'bed': openDialog(G, [['say', 'note', 'Your bed in the study. Rest a while?'], ['choice', [['Rest', 'r'], ['Not now', 'n']]], ['label', 'r'], ['rest'], ['say', 'wick', 'Sleep well. I\'ll keep the fire going.'], ['end'], ['label', 'n']]); return true;
        case 'lectern':
            if (G.books.some((b) => !G.placed.includes(b))) openDialog(G, placeScript(G));
            else openDialog(G, lecternText(G, obj.n));
            return true;
        case 'hearth': openDialog(G, hearthScript(G)); return true;
        case 'returns': {
            const carried = COMMON_BOOKS.filter((b) => G.common[b.id] === 1);
            for (const b of carried) G.common[b.id] = 2;
            const gifts = [];
            for (const g in GENRES) {
                const all = COMMON_BOOKS.filter((b) => b.genre === g);
                if (!G.flags['shelf_' + g] && all.every((b) => G.common[b.id] === 2)) {
                    G.flags['shelf_' + g] = 1;
                    const r = GENRE_REWARD[g];
                    addItem(G, r.item, r.n);
                    gifts.push({ genre: GENRES[g].name, name: ITEMS[r.item].name });
                }
            }
            if (carried.length) G.events.push({ type: 'shelve', n: carried.length });
            openDialog(G, shelveScript(G, carried.length, gifts));
            return true;
        }
        case 'telescope': openDialog(G, [['say', 'note', 'Through the great telescope, the stars are close enough to read. Every constellation has a story written in the margins of the sky.']]); return true;
        case 'boss':
            if (G.bosses[obj.id]) { bark(G, 'Just an empty pedestal now.'); return true; }
            openDialog(G, bossIntro(G, obj.id));
            return true;
        default: return false;
    }
}

function cluster(G, M, i, t) {
    const out = [i], seen = new Set([i]);
    for (let k = 0; k < out.length && out.length < 64; k++) {
        const c = out[k], x = c % M.w, y = Math.floor(c / M.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) continue;
            const j = ny * M.w + nx;
            if (!seen.has(j) && tileAt(G, M, j) === t) { seen.add(j); out.push(j); }
        }
    }
    return out;
}

function openTiles(G, M, list) {
    const o = (G.opened[M.id] ||= {});
    for (const i of list) o[i] = 1;
}

function usePower(G, M, i, t) {
    const d = TILES[t];
    if (d.mode === 'pass') {
        if (!hasBook(G, d.lock)) bark(G, NEED_LINE[d.lock]);
        return true;
    }
    if (!hasBook(G, d.lock)) { bark(G, NEED_LINE[d.lock]); return true; }
    if (t === T.starseal && G.placed.length < 12) { bark(G, 'The seal won\'t budge until every grimoire is home on its lectern.'); return true; }
    const tiles = cluster(G, M, i, t);
    openTiles(G, M, tiles);
    G.events.push({ type: 'power', book: d.lock, tiles: tiles.map((k) => [k % M.w, k / M.w | 0]) });
    return true;
}

// ------------------------------------------------------------------ the fixed step
/** inp = { x, y, a }: x, y in [-1, 1] (y down); a = Action pressed since the last step. */
export function step(G, inp, dt) {
    G.t += dt;
    G.clock = (G.clock + dt) % DAY_SECONDS;
    if (G.bark > 0) G.bark -= dt;

    if (G.fade) {
        G.fade.t += dt;
        if (!G.fade.swapped && G.fade.t >= 0.32) { G.fade.swapped = true; doWarp(G, G.fade.to); }
        if (G.fade.t >= 0.64) G.fade = null;
        return;
    }
    if (G.mode !== 'explore') return;
    if (G.grace > 0) G.grace -= dt;

    const p = G.p;
    const M = mapOf(G);

    // ---- move
    let ix = inp.x || 0, iy = inp.y || 0;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    p.moving = len > 0.15;
    if (p.moving) {
        if (Math.abs(ix) > Math.abs(iy) * 1.05) p.dir = ix > 0 ? 'right' : 'left';
        else p.dir = iy > 0 ? 'down' : 'up';
        const under = tileAt(G, M, Math.floor(p.y) * M.w + Math.floor(p.x));
        const sp = (TILES[under].swim ? PLAYER.swimSpeed : PLAYER.speed) * (G.gear.charm === 'compass' ? 1.15 : 1);
        moveAxis(G, M, ix * sp * dt, 0);
        moveAxis(G, M, 0, iy * sp * dt);
        p.walk += len * dt;
        G.stats.steps += len * sp * dt;
    }
    const ci = Math.floor(p.y) * M.w + Math.floor(p.x);
    const ct = tileAt(G, M, ci);
    p.swim = !!TILES[ct].swim;
    p.float = ct === T.chasm;
    p.small = ct === T.tiny;

    // ---- doors
    const wp = M.warps[ci];
    if (wp && (!wp.star || G.opened[M.id]?.[ci])) {
        if (wp.need && !hasBook(G, wp.need)) {
            bark(G, NEED_LINE[wp.need]);
            p.y += 0.25;
        } else {
            beginWarp(G, { to: wp.to, x: wp.x, y: wp.y, dir: wp.dir });
            return;
        }
    }

    // ---- which zone are we in
    if (M.id === 'world') {
        const z = zoneAt(p.x, p.y);
        if (z && z.id !== G.zone) {
            G.zone = z.id;
            const first = !G.seen[z.id];
            G.seen[z.id] = 1;
            G.events.push({ type: 'zone', id: z.id, name: z.name, first });
        }
    }

    // ---- bumping into pass-locks you can't pass: Wick says why
    if (p.moving) {
        const fp = facingPoint(G, 0.55);
        const fi = Math.floor(fp.y) * M.w + Math.floor(fp.x);
        const ft = tileAt(G, M, fi);
        if (TILES[ft].lock && !passable(G, M, fi)) bark(G, NEED_LINE[TILES[ft].lock]);
    }

    // ---- Action
    if (inp.a) interact(G);
    if (G.mode !== 'explore' || G.fade) return;

    // ---- foes
    stepFoes(G, M, dt);
}

function blockedAt(G, M, x, y) {
    const hw = PLAYER.hw, hh = PLAYER.hh;
    for (const [cx, cy] of [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]]) {
        const tx = Math.floor(cx), ty = Math.floor(cy);
        if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return true;
        if (!passable(G, M, ty * M.w + tx)) return true;
    }
    for (const n of npcsHere(G)) {
        if (Math.abs(n.x + 0.5 - x) < 0.6 && Math.abs(n.y + 0.55 - y) < 0.4) return true;
    }
    return false;
}

function moveAxis(G, M, dx, dy) {
    const p = G.p;
    if (!dx && !dy) return;
    const nx = p.x + dx, ny = p.y + dy;
    if (!blockedAt(G, M, nx, ny)) { p.x = nx; p.y = ny; return; }
    // slide round corners: nudge sideways if a small shift frees the way
    for (const nudge of [0.12, -0.12, 0.24, -0.24]) {
        if (dx && !blockedAt(G, M, nx, p.y + nudge) && !blockedAt(G, M, p.x, p.y + nudge)) { p.y += Math.sign(nudge) * Math.min(Math.abs(nudge), Math.abs(dx)); return; }
        if (dy && !blockedAt(G, M, p.x + nudge, ny) && !blockedAt(G, M, p.x + nudge, p.y)) { p.x += Math.sign(nudge) * Math.min(Math.abs(nudge), Math.abs(dy)); return; }
    }
}

function stepFoes(G, M, dt) {
    const p = G.p;
    const notice = ENEMY.notice * (G.gear.charm === 'owl' ? 0.6 : 1);
    for (const e of G.ents) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > ENEMY.activeRange) continue;
        e.t -= dt;
        let speed = 0, tx = e.tx, ty = e.ty;
        if (e.state === 'dazed') {
            if (e.t <= 0) e.state = 'wander';
        } else if (e.state === 'chase') {
            if (dist > ENEMY.forget || G.grace > 0) { e.state = 'wander'; e.t = 0; }
            tx = p.x; ty = p.y; speed = ENEMY.chase;
        } else {
            if (dist < notice && G.grace <= 0 && !!p.swim === e.swim) { e.state = 'chase'; G.events.push({ type: 'notice', sid: e.sid }); }
            if (e.t <= 0) {
                e.t = 1.5 + G.rng() * 2.5;
                const a = G.rng() * Math.PI * 2, r = G.rng() * 3;
                e.tx = e.hx + Math.cos(a) * r; e.ty = e.hy + Math.sin(a) * r;
                if (G.rng() < 0.35) { e.tx = e.x; e.ty = e.y; }
            }
            tx = e.tx; ty = e.ty; speed = ENEMY.speed;
        }
        const ex = tx - e.x, ey = ty - e.y, el = Math.hypot(ex, ey);
        if (speed && el > 0.1) {
            const vx = ex / el * speed * dt, vy = ey / el * speed * dt;
            const okX = canFoeWalk(G, M, Math.floor(e.y) * M.w + Math.floor(e.x + vx + Math.sign(vx) * 0.3), e.swim);
            const okY = canFoeWalk(G, M, Math.floor(e.y + vy + Math.sign(vy) * 0.25) * M.w + Math.floor(e.x), e.swim);
            if (okX) e.x += vx;
            if (okY) e.y += vy;
            if (!okX && !okY && e.state !== 'chase') e.t = 0;
            if (Math.abs(vx) > Math.abs(vy)) e.dir = vx > 0 ? 'right' : 'left'; else e.dir = vy > 0 ? 'down' : 'up';
        }
        if (dist < ENEMY.touch && G.grace <= 0 && e.state !== 'dazed') {
            touchFoe(G, M, e);
            return;
        }
    }
}

function touchFoe(G, M, e) {
    const s = M.spawns.find((x) => x.id === e.sid);
    const group = [e.foe];
    const tier = s.tier;
    // company: rarely more than one friend, and only once you've found your feet
    const r = G.rng();
    const extra = G.lvl < 3 ? 0 : r < 0.5 ? 0 : r < 0.88 ? 1 : 2;
    for (let k = 0; k < extra; k++) group.push(s.foes[Math.floor(G.rng() * s.foes.length)]);
    G.events.push({ type: 'encounter', sid: e.sid });
    startBattle(G, group, { spawn: e.sid });
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    if (G.mode === 'battle' || G.mode === 'dialog' || G.fade) throw new Error('save only while exploring');
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function canSave(G) { return G.mode === 'explore' && !G.fade && !G.dialog && !G.battle; }

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (!getWorld().maps[G.map]) throw new Error('save names an unknown map');
    return G;
}

// Debug helpers (dev hooks and tests use them; the game never does).
export const _test = { enterMap, doWarp, interact, openTiles, beginWarp, cluster };
