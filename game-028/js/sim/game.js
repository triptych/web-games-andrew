// The whole game as data. newGame(seed) makes it; act(G, cmd) is the only way it changes (the UI, the bot and
// the tests all go through it); serialize/deserialize make the save. Everything that happens is pushed to
// G.events for the view, the audio and the UI to answer. Pure: no DOM, no clock, no Math.random.
//
// Modes: explore · dialog · battle · shop · defeat · ending
// Commands:
//   explore  move {dir} · interact · use {item, who} · equip {who, item} · unequip {who, slot} · rest
//   dialog   next · choose {i}
//   battle   fight {ability, target} · item {item, target} · defend · flee · end (after the result)
//   shop     buy {item} · sell {item} · close
//   defeat   retry · wake

import { makeRng, next } from '../rng.js';
import { MAPS } from './data/maps.js';
import { TREES } from './data/story.js';
import { ITEMS, SHOPS } from './data/items.js';
import { PARTY } from './data/party.js';
import { ENCOUNTER_GRACE, INN_COST, DEFEAT_GOLD } from '../config.js';
import { cond, stats, healAll, clampVitals, give, take, giveQuest, completeQuest, checkQuests } from './rules.js';
import { DIRS, mapOf, walkable, personAt, bumpAt, eventsAt, exitAt, propAt, faceTile } from './world.js';
import { startBattle, command as battleCommand, useItemOn } from './battle.js';
import { pickWeighted } from '../rng.js';

export const SAVE_V = 2;

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed),
        mode: 'explore', map: 'thornhaven', x: 10, y: 12, face: 'up', grace: ENCOUNTER_GRACE,
        chapter: 1, flags: {}, done: {}, visited: { thornhaven: true },
        party: ['lyra'], level: 1, xp: 0, gold: 60,
        hp: {}, mp: {}, equip: { lyra: { weapon: null, armor: null } },
        inv: { potion: 3 }, kills: {}, quests: {},
        dialog: null, battle: null, shop: null, pending: [], ending: null, fightEvent: null,
        stats: { steps: 0, battles: 0, saves: 0 },
        events: [],
    };
    healAll(G);
    startTree(G, 'intro');
    return G;
}

// ------------------------------------------------------------------ dialogue

function startTree(G, id) {
    if (!TREES[id]) throw new Error('unknown tree ' + id);
    G.dialog = { tree: id, node: TREES[id].start };
    G.mode = 'dialog';
    settle(G);
    G.events.push({ type: 'dialog', tree: id });
}

/** Follow routes and skip false nodes until the dialogue rests on a line or a choice (or ends). */
function settle(G) {
    let guard = 0;
    while (G.dialog) {
        if (++guard > 200) throw new Error('dialogue loop in ' + G.dialog.tree);
        if (G.dialog.node === 'end') { endTree(G); return; }
        const n = TREES[G.dialog.tree].nodes[G.dialog.node];
        if (!n) throw new Error(`missing node ${G.dialog.tree}.${G.dialog.node}`);
        if (n.routes) { G.dialog.node = (n.routes.find((r) => cond(G, r.cond)) || n).next; continue; }
        if (n.cond && !cond(G, n.cond)) { G.dialog.node = n.next; continue; }
        if (!G.dialog.ran) { G.dialog.ran = true; runActs(G, n.act); if (!G.dialog) return; }
        return;
    }
}

/** The line or choice the player is looking at: { who, mood, text, choices: [{ t, i }], bg, cg, card } or null. */
export function currentLine(G) {
    if (!G.dialog) return null;
    const n = TREES[G.dialog.tree].nodes[G.dialog.node];
    if (!n) return null;
    const choices = n.choices ? n.choices.map((c, i) => ({ t: c.t, i, cond: c.cond })).filter((c) => cond(G, c.cond)) : null;
    return { tree: G.dialog.tree, node: G.dialog.node, who: n.who, mood: n.mood, text: n.text, choices, bg: n.bg, cg: n.cg, card: n.card, music: n.music };
}

function goNode(G, id) {
    G.dialog.node = id;
    G.dialog.ran = false;
    settle(G);
}

function endTree(G) {
    G.dialog = null;
    G.mode = 'explore';
    G.events.push({ type: 'dialogEnd' });
    runPending(G);
}

function runPending(G) {
    while (G.mode === 'explore' && G.pending.length) {
        const p = G.pending.shift();
        if (p.t === 'tree') startTree(G, p.id);
        else if (p.t === 'shop') { G.shop = p.id; G.mode = 'shop'; G.events.push({ type: 'shop', id: p.id }); }
        else if (p.t === 'fight') startBattle(G, p.group, { boss: p.boss, eventId: p.eventId });
        else if (p.t === 'ending') { G.mode = 'ending'; G.events.push({ type: 'ending', id: G.ending }); }
    }
}

function runActs(G, acts) {
    for (const [verb, arg] of acts || []) {
        switch (verb) {
            case 'quest': giveQuest(G, arg); break;
            case 'done': completeQuest(G, arg); break;
            case 'give': give(G, arg); break;
            case 'take': take(G, arg); checkQuests(G); break;
            case 'flag':
                if (arg.startsWith('-')) delete G.flags[arg.slice(1)];
                else { G.flags[arg] = true; checkQuests(G); }
                break;
            case 'chapter': G.chapter = Math.max(G.chapter, arg); G.events.push({ type: 'chapter', n: G.chapter }); break;
            case 'join':
                if (!G.party.includes(arg)) {
                    G.party.push(arg);
                    G.equip[arg] = { weapon: null, armor: null };
                    const s = stats(G, arg);
                    G.hp[arg] = s.mhp; G.mp[arg] = s.mmp;
                    G.events.push({ type: 'join', who: arg });
                }
                break;
            case 'shop': G.pending.push({ t: 'shop', id: arg }); break;
            case 'rest':
                if (G.gold >= INN_COST) { G.gold -= INN_COST; healAll(G); G.flags.rested = true; G.events.push({ type: 'rest' }); }
                break;
            case 'heal': healAll(G); break;
            case 'gold': G.gold += arg; break;
            case 'ending':
                G.ending = arg;
                G.pending.push({ t: 'tree', id: 'end_' + arg }, { t: 'ending' });
                break;
            default: throw new Error('unknown act ' + verb);
        }
    }
}

// ------------------------------------------------------------------ exploration

function enterMap(G, to, x, y) {
    G.map = to; G.x = x; G.y = y;
    G.grace = ENCOUNTER_GRACE;
    G.visited[to] = true;
    G.events.push({ type: 'map', map: to });
    checkQuests(G);
    stepEvents(G);
}

function move(G, dir) {
    if (!DIRS[dir]) return 'bad direction';
    G.face = dir;
    const [dx, dy] = DIRS[dir];
    const nx = G.x + dx, ny = G.y + dy;
    const m = mapOf(G);
    const who = personAt(G, nx, ny);
    if (who) { talk(G, who); return null; }
    const bump = bumpAt(G, nx, ny);
    if (bump) { bumpEvent(G, bump, 'walk'); return null; }
    if (!walkable(G, nx, ny)) { G.events.push({ type: 'bonk' }); return null; }
    const ex = exitAt(m, nx, ny);
    if (ex && !cond(G, ex.cond)) { G.events.push({ type: 'blocked', msg: ex.msg }); return null; }
    G.x = nx; G.y = ny;
    G.stats.steps++;
    G.events.push({ type: 'step', x: nx, y: ny, dir });
    if (ex) { enterMap(G, ex.to, ex.tx, ex.ty); return null; }
    if (stepEvents(G)) return null;
    encounter(G);
    return null;
}

/** Step-on events (scenes). Returns true if one started. */
function stepEvents(G) {
    for (const ev of eventsAt(G, G.x, G.y)) {
        if (ev.type !== 'scene' || (ev.once && G.done[ev.id]) || !cond(G, ev.cond)) continue;
        G.done[ev.id] = true;
        startTree(G, ev.tree);
        return true;
    }
    return false;
}

function encounter(G) {
    const enc = mapOf(G).encounters;
    if (!enc) return;
    if (G.grace > 0) { G.grace--; return; }
    if (next(G.rng) >= enc.rate) return;
    const ch = Object.keys(enc.table).map(Number).filter((c) => c <= G.chapter).pop() ?? Math.min(...Object.keys(enc.table).map(Number));
    const table = enc.table[ch];
    const group = pickWeighted(G.rng, Object.keys(table), (k) => table[k]);
    G.grace = ENCOUNTER_GRACE;
    startBattle(G, group, {});
}

function talk(G, person) {
    G.events.push({ type: 'talk', who: person.who });
    startTree(G, person.talk);
}

/** Walking into an event, or pressing Space at it (how: 'walk' | 'use'). */
function bumpEvent(G, ev, how = 'use') {
    if (ev.type === 'chest') {
        // an opened chest stays solid: walking into it again (a held key does, the next frame) just stops you;
        // Space at it gets a short note, not a dialogue
        if (G.done[ev.id]) { G.events.push(how === 'walk' ? { type: 'bonk' } : { type: 'say', text: 'The chest is empty.' }); return; }
        G.done[ev.id] = true;
        G.events.push({ type: 'chest', id: ev.id, items: ev.items, gold: ev.gold || 0 });
        if (ev.gold) G.gold += ev.gold;
        give(G, ev.items);
        if (ev.tree) startTree(G, ev.tree);
    } else if (ev.type === 'anchor') {
        if (!G.quests.spirit_of_the_wood) { startTree(G, 'anchor_wait'); return; }
        if (!(G.inv.soul_gem > 0)) { startTree(G, 'anchor_need'); return; }
        take(G, { soul_gem: 1 });
        G.flags[ev.flag] = true;
        G.events.push({ type: 'anchor', id: ev.id });
        checkQuests(G);
        startTree(G, 'anchor_done');
    } else if (ev.type === 'fight') {
        G.fightEvent = ev.id;
        if (ev.tree) { G.pending.push({ t: 'fight', group: ev.group, boss: ev.boss, eventId: ev.id }); startTree(G, ev.tree); }
        else startBattle(G, ev.group, { boss: ev.boss, eventId: ev.id });
    }
}

function interact(G) {
    const [fx, fy] = faceTile(G);
    let who = personAt(G, fx, fy);
    if (!who) {
        const p = propAt(G, fx, fy);
        if (p?.counter) { const [dx, dy] = DIRS[G.face]; who = personAt(G, fx + dx, fy + dy); }
    }
    if (who) { talk(G, who); return null; }
    const bump = bumpAt(G, fx, fy);
    if (bump) { bumpEvent(G, bump); return null; }
    const chest = eventsAt(G, fx, fy).find((e) => e.type === 'chest');
    if (chest) { bumpEvent(G, chest); return null; }
    return 'nothing there';
}

// ------------------------------------------------------------------ after a battle

function endBattle(G) {
    const B = G.battle;
    const evId = B.eventId;
    const ev = evId ? findEvent(evId) : null;
    if (B.over === 'win') {
        G.battle = null;
        G.mode = 'explore';
        G.grace = ENCOUNTER_GRACE;
        if (ev) {
            G.done[ev.id] = true;
            if (ev.final) G.flags.lich_defeated = true;
            checkQuests(G);
            if (ev.win) startTree(G, ev.win);
        }
        G.events.push({ type: 'battleEnd', result: 'win' });
        if (G.mode === 'explore') runPending(G);
    } else if (B.over === 'fled') {
        G.battle = null;
        G.mode = 'explore';
        G.grace = ENCOUNTER_GRACE;
        G.events.push({ type: 'battleEnd', result: 'fled' });
        // a fled fixed fight steps you back off its tile
    } else if (B.over === 'lose') {
        G.mode = 'defeat';
        G.events.push({ type: 'battleEnd', result: 'lose' });
    }
}

function findEvent(id) {
    for (const m of Object.values(MAPS)) { const e = m.events.find((x) => x.id === id); if (e) return e; }
    return null;
}

function retry(G) {
    const B = G.battle;
    G.hp = { ...B.snap.hp }; G.mp = { ...B.snap.mp }; G.inv = { ...B.snap.inv };
    const ev = B.eventId ? findEvent(B.eventId) : null;
    G.battle = null;
    G.mode = 'explore';
    G.events.push({ type: 'retry' });
    startBattle(G, B.group, { boss: ev?.boss, eventId: B.eventId });
}

function wake(G) {
    G.battle = null;
    G.gold = Math.floor(G.gold * (1 - DEFEAT_GOLD));
    healAll(G);
    G.pending = [];
    G.mode = 'explore';
    enterMap(G, 'inn', 4, 4);
    G.face = 'up';
    startTree(G, 'defeat');
}

// ------------------------------------------------------------------ menus

function useField(G, item, who) {
    const it = ITEMS[item];
    if (!it || it.kind !== 'use' || !(G.inv[item] > 0)) return 'no such item';
    if (!G.party.includes(who)) return 'not in party';
    const s = stats(G, who);
    const u = { hp: G.hp[who], mhp: s.mhp, mp: G.mp[who], mmp: s.mmp, st: {} };
    if (it.fx.heal && u.hp >= u.mhp) return 'already healthy';
    if (it.fx.mp && !it.fx.heal && u.mp >= u.mmp) return 'MP already full';
    if (it.fx.revive) return 'nobody has fallen';
    if (it.fx.cure) return 'nothing to cure';
    take(G, { [item]: 1 });
    useItemOn(G, it, u, who);
    G.hp[who] = u.hp; G.mp[who] = u.mp;
    return null;
}

function equip(G, who, item) {
    const it = ITEMS[item];
    if (!it || (it.kind !== 'weapon' && it.kind !== 'armor')) return 'not equipment';
    if (!(G.inv[item] > 0)) return 'not carried';
    if (!it.who.includes(who) || !G.party.includes(who)) return `${PARTY[who]?.name || who} can't use that`;
    const slot = it.kind;
    const old = G.equip[who][slot];
    take(G, { [item]: 1 });
    if (old) G.inv[old] = (G.inv[old] || 0) + 1;
    G.equip[who][slot] = item;
    clampVitals(G);
    G.events.push({ type: 'equip', who, item });
    return null;
}

function unequip(G, who, slot) {
    const old = G.equip[who]?.[slot];
    if (!old) return 'nothing equipped';
    G.equip[who][slot] = null;
    G.inv[old] = (G.inv[old] || 0) + 1;
    clampVitals(G);
    return null;
}

export const priceOf = (id) => ITEMS[id].buy;

function buy(G, item) {
    const shop = SHOPS[G.shop];
    if (!shop.stock.includes(item)) return 'not sold here';
    if (G.gold < ITEMS[item].buy) return 'not enough gold';
    G.gold -= ITEMS[item].buy;
    give(G, { [item]: 1 });
    G.events.push({ type: 'buy', item });
    return null;
}

function sell(G, item) {
    const it = ITEMS[item];
    if (!it || it.kind === 'key' || !(it.sell > 0)) return 'won\'t buy that';
    if (!(G.inv[item] > 0)) return 'not carried';
    take(G, { [item]: 1 });
    G.gold += it.sell;
    checkQuests(G);
    G.events.push({ type: 'sell', item });
    return null;
}

// ------------------------------------------------------------------ the one entry point

/** Apply a command. Returns null on success, or a short reason the command did nothing. */
export function act(G, cmd) {
    switch (G.mode) {
        case 'explore':
            if (cmd.t === 'move') return move(G, cmd.dir);
            if (cmd.t === 'face') { if (DIRS[cmd.dir]) G.face = cmd.dir; return null; }
            if (cmd.t === 'interact') return interact(G);
            if (cmd.t === 'use') return useField(G, cmd.item, cmd.who);
            if (cmd.t === 'equip') return equip(G, cmd.who, cmd.item);
            if (cmd.t === 'unequip') return unequip(G, cmd.who, cmd.slot);
            return 'not now';
        case 'dialog': {
            const line = currentLine(G);
            if (!line) return 'no dialogue';
            if (cmd.t === 'next') {
                if (line.choices) return 'choose';
                const n = TREES[G.dialog.tree].nodes[G.dialog.node];
                goNode(G, n.next);
                return null;
            }
            if (cmd.t === 'choose') {
                const c = line.choices?.find((x) => x.i === cmd.i);
                if (!c) return 'no such choice';
                const n = TREES[G.dialog.tree].nodes[G.dialog.node];
                const ch = n.choices[c.i];
                G.events.push({ type: 'choice', text: ch.t });
                runActs(G, ch.act);
                if (G.dialog) goNode(G, ch.next);
                return null;
            }
            return 'not now';
        }
        case 'battle':
            if (cmd.t === 'end') { if (!G.battle.over) return 'battle not over'; endBattle(G); return null; }
            return battleCommand(G, cmd);
        case 'shop':
            if (cmd.t === 'buy') return buy(G, cmd.item);
            if (cmd.t === 'sell') return sell(G, cmd.item);
            if (cmd.t === 'equip') return equip(G, cmd.who, cmd.item);
            if (cmd.t === 'close') { G.shop = null; G.mode = 'explore'; G.events.push({ type: 'shopClose' }); runPending(G); return null; }
            return 'not now';
        case 'defeat':
            if (cmd.t === 'retry') { retry(G); return null; }
            if (cmd.t === 'wake') { wake(G); return null; }
            return 'not now';
        default:
            return 'not now';
    }
}

// ------------------------------------------------------------------ saves

export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(data) {
    if (!data || data.v !== SAVE_V) throw new Error('unknown save version');
    if (!MAPS[data.map]) throw new Error('unknown map in save');
    const G = { ...JSON.parse(JSON.stringify(data)), events: [] };
    return G;
}
