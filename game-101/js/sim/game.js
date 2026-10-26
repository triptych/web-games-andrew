// PIXELCRYPT's simulation entry points: newGame(seed), act(G, cmd), serialize / deserialize.
// Pure: no DOM, no three.js, no Math.random, no clock. The view reads G and drains G.events.
//
// Everything the player or the bot does is a command:
//   dungeon  { t:'move', m:'f'|'b'|'l'|'r'|'sl'|'sr' }  { t:'search' }  { t:'interact' }  { t:'dlg', id }
//   battle   { t:'round', cmds:[...] }  { t:'flee' }  { t:'endBattle' }
//   town     { t:'enter', depth }  { t:'buy', shop, sid, qty }  { t:'sell', id, qty }  { t:'sellJunk' }  { t:'recharge', id }
//            { t:'rest' }  { t:'recruit', idx }  { t:'dismiss', idx }  { t:'church', svc, who }  { t:'eat', meal }
//            { t:'invest', biz }  { t:'collect' }  { t:'accept', id }  { t:'turnin', id }  { t:'abandon', id }
//   camp     { t:'equip', who, item }  { t:'unequip', who, slot }  { t:'use', item, who }  { t:'skill', who, skill, target }
//            { t:'row', who, row }  { t:'swap', who, dir }  { t:'autoequip', who }  { t:'drop', item }

import { makeRng } from '../rng.js';
import { say } from './core.js';
import { makeMember, CLASS_IDS, clampVitals } from './party.js';
import { personName } from './names.js';
import { newJournal } from './journal.js';
import { give } from './inv.js';
import { genPotion, genScroll } from './items.js';
import { newBiz, restock, refreshRecruits, refreshBoard, kitOut, buy, sell, sellJunk, recharge, rest, recruit, dismiss, church, eat, invest, collect, autoEquip, tickIdle } from './town.js';
import { accept, abandon, turnIn } from './quests.js';
import { startBattle, resolveRound, tryFlee } from './battle.js';
import { packFloor, unpackFloor } from './dungeon.js';
import { move, search, interact, dlgChoose, endBattle, enterDungeon, returnToTown } from './world.js';
import { equip, unequip, useItem, fieldSkill, setRow, moveMember, drop } from './camp.js';

export const SAVE_V = 1;
export const DEFAULT_PARTY = ['warrior', 'rogue', 'cleric', 'mage'];

export function newGame(seed = 1, classes = DEFAULT_PARTY, names = []) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed ^ 0x9e3779b9), uid: 0, day: 1, steps: 0, stepAcc: 0, idleAcc: 0, gold: 300,
        party: [], inv: [], depth: 0, maxDepth: 1, cleared: 0, floor: null, floors: {}, floorOrder: [], pos: { x: 0, y: 0, d: 0 },
        town: { stock: null, recruits: [] }, quests: { active: [], board: [], done: 0, nextId: 1 }, biz: newBiz(), guildBonus: 0,
        bless: null, feast: null, journal: newJournal(), danger: 0, arrived: false,
        stats: { kills: 0, goldEarned: 0, goldSpent: 0, days: 0, deaths: 0, steps: 0 },
        dialog: null, battle: null, events: [],
    };
    classes.forEach((cls, i) => {
        const m = makeMember(G.rng, cls, 1, names[i] || personName(G.rng));
        kitOut(G.rng, m, 1);
        for (const k of Object.keys(m.eq)) m.eq[k].id = ++G.uid;
        m.id = ++G.uid;
        G.party.push(m);
    });
    for (let i = 0; i < 3; i++) give(G, genPotion(G.rng, 1, 'heal'), 'reward');
    give(G, genPotion(G.rng, 1, 'antidote'), 'reward');
    give(G, genScroll(G.rng, 1, 'escape'), 'reward');
    restock(G); refreshRecruits(G); refreshBoard(G);
    G.events.length = 0;
    say(G, 'Welcome to PixelCrypt. The dungeon waits below the town.', 11);
    return G;
}

export function act(G, c) {
    dispatch(G, c);
    // gear, curses and level-ups all move the maximums: keep every member's pools inside them
    for (const m of G.party) clampVitals(m);
}

function dispatch(G, c) {
    if (G.battle) return actBattle(G, c);
    if (G.dialog) {
        if (c.t === 'dlg') dlgChoose(G, c.id);
        else if (c.t === 'closeDlg') G.dialog = null;
        return;
    }
    switch (c.t) {
        case 'move': if (G.floor) move(G, c.m); break;
        case 'search': search(G); break;
        case 'interact': interact(G); break;
        case 'enter': if (!G.floor && enterDungeon(G, c.depth)) { /* arrived */ } break;
        case 'leave': if (G.floor) returnToTown(G); break;
        // town
        case 'buy': if (!G.floor) buy(G, c.shop, c.sid, c.qty || 1); break;
        case 'sell': if (!G.floor) sell(G, c.id, c.qty || 1); break;
        case 'sellJunk': if (!G.floor) sellJunk(G); break;
        case 'recharge': if (!G.floor) recharge(G, c.id); break;
        case 'rest': if (!G.floor) rest(G); break;
        case 'recruit': if (!G.floor) recruit(G, c.idx); break;
        case 'dismiss': if (!G.floor) dismiss(G, c.idx); break;
        case 'church': if (!G.floor) church(G, c.svc, c.who); break;
        case 'eat': if (!G.floor) eat(G, c.meal); break;
        case 'invest': if (!G.floor) invest(G, c.biz); break;
        case 'collect': if (!G.floor) collect(G); break;
        case 'accept': if (!G.floor) accept(G, c.id); break;
        case 'turnin': if (!G.floor) turnIn(G, c.id); break;
        case 'abandon': abandon(G, c.id); break;
        // camp
        case 'equip': equip(G, c.who, c.item); break;
        case 'unequip': unequip(G, c.who, c.slot); break;
        case 'use': useItem(G, c.item, c.who); break;
        case 'skill': fieldSkill(G, c.who, c.skill, c.target); break;
        case 'row': setRow(G, c.who, c.row); break;
        case 'swap': moveMember(G, c.who, c.dir); break;
        case 'autoequip': { const m = G.party[c.who]; if (m) autoEquip(G, m); break; }
        case 'drop': drop(G, c.item); break;
        case 'debugBattle': startBattle(G, c.enemies, c.opts || {}); break;
    }
}

function actBattle(G, c) {
    const B = G.battle;
    if (c.t === 'endBattle') { endBattle(G); return; }
    if (B.over) return;
    if (c.t === 'round') {
        if (G.feast?.left > 0 && B.round === 0) feastBuff(G);
        resolveRound(G, c.cmds || []);
    } else if (c.t === 'flee') tryFlee(G);
}
function feastBuff(G) {
    for (const m of G.party) if (m.hp > 0) { m.cb.buf.atk = { m: 1.15, t: 99 }; m.cb.buf.def = { m: 1.15, t: 99 }; }
    G.feast.left--;
    if (G.feast.left <= 0) G.feast = null;
}

export { tickIdle };

// ------------------------------------------------------------------ save
export function serialize(G) {
    const rest = { ...G };
    for (const k of ['rng', 'events', 'floor', 'floors']) delete rest[k];
    const out = JSON.parse(JSON.stringify(rest));
    out.floors = {};
    for (const d of Object.keys(G.floors)) out.floors[d] = JSON.parse(JSON.stringify(packFloor(G.floors[d])));
    out.rngState = G.rng.state();
    return out;
}
export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, floors, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [], floors: {}, floor: null };
    G.rng.setState(rngState);
    for (const k of Object.keys(floors)) G.floors[k] = unpackFloor(floors[k]);
    G.floor = G.depth > 0 ? G.floors[G.depth] || null : null;
    if (G.depth > 0 && !G.floor) G.depth = 0;
    return G;
}
export { CLASS_IDS };
