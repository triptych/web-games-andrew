// A bot that plays the whole game through act(): it follows the guide (js/sim/guide.js), takes the side quests,
// rests at the inn, shops and equips the best gear, grinds to the guide's recommended level before big fights,
// and fights with battle.js's autoCommand at a skill from 0 (random) to 1 (careful). The tests and the balance
// tables run it; ?debug=1 autoplay in the browser uses it too. Pure.

import { act, currentLine } from './game.js';
import { nextGoal, sideGoal } from './guide.js';
import { autoCommand } from './battle.js';
import { stats } from './rules.js';
import { ITEMS, SHOPS } from './data/items.js';
import { MAPS } from './data/maps.js';
import { TREES } from './data/story.js';
import { DIRS, stepToward, findPath, walkable, propAt, personAt, mapRoute } from './world.js';
import { next } from '../rng.js';
import { INN_COST } from '../config.js';

export function newBot({ skill = 1, ending = 'remember', side = true, overlevel = 0 } = {}) {
    return { skill, ending, side, overlevel, errand: null, grindTo: null, retries: 0, wanted: {} };
}

const score = (id) => { const s = ITEMS[id].stats; return (s.atk || 0) * 2 + (s.def || 0) * 1.6 + (s.mp || 0) / 4 + (s.spd || 0) * 2; };

function equipBest(G) {
    for (const who of G.party) {
        for (const slot of ['weapon', 'armor']) {
            const cur = G.equip[who][slot];
            let best = null, bestS = cur ? score(cur) : -1;
            for (const id of Object.keys(G.inv)) {
                const it = ITEMS[id];
                if (it.kind !== slot || !it.who.includes(who)) continue;
                if (score(id) > bestS) { best = id; bestS = score(id); }
            }
            if (best) return { t: 'equip', who, item: best };
        }
    }
    return null;
}

function shoppingList(G, shopId) {
    const shop = SHOPS[shopId];
    const want = [];
    let budget = G.gold - INN_COST * 2;
    for (const who of G.party) for (const slot of ['weapon', 'armor']) {
        const cur = G.equip[who][slot];
        const opts = shop.stock.filter((id) => ITEMS[id].kind === slot && ITEMS[id].who.includes(who) && score(id) > (cur ? score(cur) : -1) && !G.inv[id]);
        opts.sort((a, b) => score(b) - score(a));
        const pick = opts.find((id) => ITEMS[id].buy <= budget);
        if (pick) { want.push(pick); budget -= ITEMS[pick].buy; }
    }
    const keep = { potion: 6, ether: G.chapter >= 2 ? 3 : 1, antidote: 1, hi_potion: G.chapter >= 3 ? 4 : 0, phoenix_down: G.chapter >= 3 ? 2 : 0 };
    for (const [id, n] of Object.entries(keep)) {
        if (!shop.stock.includes(id)) continue;
        for (let have = G.inv[id] || 0; have < n && ITEMS[id].buy <= budget; have++) { want.push(id); budget -= ITEMS[id].buy; }
    }
    return want;
}

const hpRatio = (G) => G.party.reduce((s, id) => s + G.hp[id] / stats(G, id).mhp, 0) / G.party.length;
const mpRatio = (G) => G.party.reduce((s, id) => s + G.mp[id] / Math.max(1, stats(G, id).mmp), 0) / G.party.length;

/** The tile to stand on to talk to someone (beside them, or across a counter). */
function talkSpot(G, mapId, x, y) {
    const m = MAPS[mapId];
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
        const ax = x + dx, ay = y + dy;
        if (walkable(G, ax, ay, m) && !personAt(G, ax, ay, m)) return { x: ax, y: ay, face: opposite(d) };
        const p = propAt(G, ax, ay, m);
        if (p?.counter && walkable(G, ax + dx, ay + dy, m)) return { x: ax + dx, y: ay + dy, face: opposite(d) };
    }
    return null;
}
/** Does following this node (and its choices) soon offer a quest or a recruit? */
function leadsToQuest(tree, id, depth) {
    const n = TREES[tree].nodes[id];
    if (!n || depth < 0) return false;
    if ((n.choices || []).some((c) => (c.act || []).some(([v]) => v === 'quest' || v === 'join'))) return true;
    if (n.choices) return n.choices.some((c) => c.next !== id && leadsToQuest(tree, c.next, depth - 1));
    return n.next && n.next !== 'end' ? leadsToQuest(tree, n.next, depth - 1) : false;
}
const opposite = (d) => ({ up: 'down', down: 'up', left: 'right', right: 'left' }[d]);

/** Walk toward a person or a bump event and, once there, talk / bump. */
function approach(G, goal) {
    if (G.map === goal.map) {
        if (goal.kind === 'talk') {
            const spot = talkSpot(G, goal.map, goal.x, goal.y);
            if (spot && G.x === spot.x && G.y === spot.y) {
                if (G.face !== spot.face) return { t: 'face', dir: spot.face };
                return { t: 'interact' };
            }
            if (spot) {
                const p = findPath(G, G.map, G.x, G.y, spot.x, spot.y);
                if (p && p.length) return { t: 'move', dir: p[0] };
            }
        }
        const dx = goal.x - G.x, dy = goal.y - G.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) return { t: 'move', dir: dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up' };
    }
    const dir = stepToward(G, goal.map, goal.x, goal.y, true);
    return dir ? { t: 'move', dir } : null;
}

function wander(G, bot, mapId) {
    if (G.map !== mapId) {
        const route = mapRoute(G, G.map, mapId);
        if (!route) return null;
        const dir = stepToward(G, mapId, 0, 0, false);
        return dir ? { t: 'move', dir } : null;
    }
    const m = MAPS[mapId];
    for (let tries = 0; tries < 40; tries++) {
        if (!bot.grindTo || (bot.grindTo[0] === G.x && bot.grindTo[1] === G.y)) {
            bot.grindTo = [1 + Math.floor(next(bot.rng) * (m.grid[0].length - 2)), 1 + Math.floor(next(bot.rng) * (m.grid.length - 2))];
        }
        const p = findPath(G, mapId, G.x, G.y, bot.grindTo[0], bot.grindTo[1]);
        if (p && p.length) return { t: 'move', dir: p[0] };
        bot.grindTo = null;
    }
    // boxed in for now: any step that moves
    for (const d of ['up', 'left', 'down', 'right']) if (walkable(G, G.x + DIRS[d][0], G.y + DIRS[d][1])) return { t: 'move', dir: d };
    return { t: 'face', dir: 'down' };
}

const aldric = { map: 'inn', x: 4, y: 1, kind: 'talk' };
const KEEPERS = { forge: { map: 'forge', x: 3, y: 1 }, inn: aldric, borin: { map: 'thornhaven', x: 7, y: 7 }, aneth: { map: 'ruins', x: 11, y: 9 } };

/** The next command, or null when the game is over. */
export function botCommand(G, bot) {
    bot.rng ??= { s: (G.seed * 7919 + 17) >>> 0 };
    switch (G.mode) {
        case 'ending': return null;
        case 'defeat':
            bot.retries++;
            bot.errand = null;
            return bot.retries > 2 ? { t: 'wake' } : { t: 'retry' };
        case 'battle':
            if (G.battle.over) { if (G.battle.over === 'win') bot.retries = 0; return { t: 'end' }; }
            return autoCommand(G, bot.skill);
        case 'shop': {
            const eq = equipBest(G);
            if (eq) return eq;
            for (const id of Object.keys(G.inv)) {
                const it = ITEMS[id];
                if (it.kind === 'loot' && !(id === 'slime_core' && G.quests.slime_infestation?.s !== 'done') && !(id === 'wolf_pelt' && G.quests.pelts_for_the_forge?.s !== 'done')) return { t: 'sell', item: id };
                if ((it.kind === 'weapon' || it.kind === 'armor') && it.sell > 0 && !G.party.some((w) => it.who.includes(w) && score(id) > score(G.equip[w][it.kind] || id) - 0.01) && G.chapter >= 2) return { t: 'sell', item: id };
            }
            const list = shoppingList(G, G.shop);
            if (list.length) return { t: 'buy', item: list[0] };
            if (bot.errand?.shop === G.shop) bot.errand = null;
            return { t: 'close' };
        }
        case 'dialog': {
            const line = currentLine(G);
            if (!line.choices) return { t: 'next' };
            const n = TREES[G.dialog.tree].nodes[G.dialog.node];
            const want = (pred) => line.choices.find((c) => pred(n.choices[c.i]));
            const hasAct = (verb, arg) => (c) => (c.act || []).some(([v, a]) => v === verb && (arg === undefined || a === arg));
            let c;
            if (G.dialog.tree === 'lich_after') c = want(hasAct('ending', bot.ending));
            else if (bot.errand?.rest && G.dialog.tree === 'aldric') c = want(hasAct('rest'));
            else if (bot.errand?.shop) c = want(hasAct('shop', bot.errand.shop));
            c ||= want(hasAct('join')) || want(hasAct('quest'));
            c ||= want((ch) => leadsToQuest(G.dialog.tree, ch.next, 3));
            if (!c && G.dialog.tree === 'aldric' && bot.errand?.shop !== 'inn') c = line.choices[line.choices.length - 1];
            if (!c && G.dialog.tree === 'marta') c = line.choices[line.choices.length - 1];
            if (!c && G.dialog.tree === 'borin_shop') c = line.choices[line.choices.length - 1];
            if (!c && G.dialog.tree === 'aneth') c = line.choices[line.choices.length - 1];
            c ||= line.choices[0];
            if (bot.errand?.rest && hasAct('rest')(n.choices[c.i])) bot.errand = null;
            return { t: 'choose', i: c.i };
        }
        case 'explore': return explore(G, bot);
        default: return null;
    }
}

function explore(G, bot) {
    const eq = equipBest(G);
    if (eq) return eq;
    // patch up in the field when someone is in danger and the inn is far
    for (const id of G.party) {
        const s = stats(G, id);
        if (G.hp[id] / s.mhp < 0.35) {
            const pot = G.inv.hi_potion && s.mhp - G.hp[id] > 120 ? 'hi_potion' : G.inv.potion ? 'potion' : G.inv.hi_potion ? 'hi_potion' : null;
            if (pot && hpRatio(G) > 0.5) return { t: 'use', item: pot, who: id };
        }
    }
    const goal = nextGoal(G);
    const need = (goal?.level || 0) + bot.overlevel;
    // errands: rest when worn down, shop when there is money to spend
    if (!bot.errand) {
        if ((hpRatio(G) < (G.party.length === 1 ? 0.65 : 0.5) || mpRatio(G) < 0.25 || (goal?.level && goal.kind === 'bump' && G.level >= need && hpRatio(G) < 0.95)) && G.gold >= INN_COST) bot.errand = { rest: true };
        else {
            for (const shop of ['forge', 'borin', 'inn', 'aneth']) {
                if (shop === 'borin' && !G.flags.borin_found) continue;
                if (shop === 'aneth' && G.chapter < 4) continue;
                const list = shoppingList(G, shop);
                const worth = list.reduce((s, id) => s + ITEMS[id].buy, 0);
                if (list.length && (worth >= 100 || list.some((id) => ITEMS[id].kind !== 'use'))) { bot.errand = { shop }; break; }
            }
        }
    }
    if (bot.errand?.rest) {
        if (G.gold < INN_COST) bot.errand = null;
        else { const c = approach(G, aldric); if (c) return c; }
    }
    if (bot.errand?.shop) { const c = approach(G, { ...KEEPERS[bot.errand.shop], kind: 'talk' }); if (c) return c; bot.errand = null; }
    if (!goal) return null;
    if (G.level < need) {
        const area = G.chapter === 1 ? 'thornwood' : G.chapter === 2 ? (G.level < 6 ? 'thornwood' : 'chapel') : G.chapter === 3 ? 'ruins' : 'sanctum';
        const c = wander(G, bot, mapRoute(G, G.map, area) ? area : 'thornwood');
        if (c) return c;
    }
    if (bot.side && G.chapter <= 2) {
        const sg = sideGoal(G);
        if (sg && sg.kind === 'grind' && G.chapter === 2) { const c = wander(G, bot, sg.map); if (c) return c; }
        else if (sg && sg.kind !== 'grind') { const c = approach(G, sg); if (c) return c; }
    }
    if (goal.kind === 'grind') return wander(G, bot, goal.map);
    return approach(G, goal) || wander(G, bot, G.map);
}

/** Play until the ending (or a step cap). Returns { G, steps, done }. */
export function playThrough(G, bot, cap = 200000) {
    let steps = 0;
    while (steps < cap) {
        const cmd = botCommand(G, bot);
        if (!cmd) break;
        const err = act(G, cmd);
        G.events.length = 0;
        if (err && cmd.t !== 'move') bot.errand = null;
        steps++;
    }
    return { G, steps, done: G.mode === 'ending' };
}
