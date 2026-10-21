// The simulation's front door. newGame(seed, opts), act(G, action) for everything the player
// chooses, step(G, inp, dt) for walking about, serialize/deserialize for saves.
// Pure: no DOM, no renderer, no Math.random, no clock.
//
// G.phase: scene | hub | explore | battle | reward | defeat | credits
// Everything the view needs to play back is pushed to G.events and drained once a frame.

import { SCENES, HUB_EVENTS, BOND_GATE, BONDERS, cond } from './data/story.js';
import { ZONES } from './data/zones.js';
import { DAEMONS } from './data/daemons.js';
import { SKILLS } from './data/skills.js';
import { ITEMS, GEAR, SHOP } from './data/items.js';
import { newAgent, newDaemon, calc, findUnit, partyUnits, fullHeal, offerSkill } from './units.js';
import { startBattle, battleCommand } from './battle.js';
import { enterZone, stepExplore, exploreAction, resolveFoe, floorOf } from './explore.js';
import { splicePreview, doSplice } from './splice.js';
import { bondPerk } from './perks.js';
import { healAll, leaveZone } from './world.js';
import { SKILL_SLOTS, AGENT_SKILL_SLOTS, PARTY_SIZE, STOCK_MAX, tideOf } from '../config.js';

const emit = (G, e) => { G.events.push(e); };

export const BOSSES = {
    switchman: { foes: [{ id: 'switchman', boss: true, hpMul: 4.2, atkMul: 0.9 }] },
    motherbloom: { foes: [{ id: 'motherbloom', boss: true, hpMul: 4.2, atkMul: 0.85 }, { id: 'pollenpuff', lv: 11 }] },
    aurelia: { foes: [{ id: 'aurelia', boss: true, hpMul: 4.2, atkMul: 0.72 }, { id: 'cherub', lv: 17 }] },
    leviathan: { foes: [{ id: 'leviathan', boss: true, hpMul: 4.8, atkMul: 0.8 }] },
    windbreaker: { foes: [{ id: 'windbreaker', boss: true, hpMul: 5, atkMul: 0.8 }, { id: 'turret', lv: 28 }] },
    pruner: { foes: [{ id: 'pruner', boss: true, hpMul: 4.5, atkMul: 0.58 }, { id: 'veilwalker', lv: 33 }] },
    meridian: { kind: 'final', foes: [{ id: 'voice', boss: true, hpMul: 3, icons: 1, atkMul: 0.45 }, { id: 'sentinel', lv: 36, atkMul: 0.6 }], waves: [[{ id: 'meridian', boss: true, hpMul: 4, icons: 1, atkMul: 0.36, say: 'Then let it be the lattice itself.' }]] },
};
const STORY_BOSS_ORDER = ['switchman', 'motherbloom', 'aurelia', 'leviathan', 'windbreaker', 'pruner'];

// ================================================================ new game
export function newGame(seed = 1, opts = {}) {
    const name = (opts.name || 'Agent').trim().slice(0, 14) || 'Agent';
    const G = {
        v: 1, seed, rs: seed | 0, uid: 2, name, look: opts.look || 0, diff: opts.diff || 1,
        day: 1, chapter: 0, flags: {}, currents: { hearth: 0, wild: 0, graft: 0 },
        scrap: 250, items: { patch: 3, sap: 1, smoke: 1, beacon: 1, honey: 1 },
        gear: { blade: 'ironblade', sidearm: 'popgun', coat: 'fieldcoat', charm: 'lucky' },
        ownedGear: ['ironblade', 'popgun', 'fieldcoat', 'lucky'],
        agent: newAgent(name), stock: [], party: [], bonds: { wren: 0, dov: 0, ilsa: 0, maple: 0, quill: 0 },
        dex: {}, scene: null, explore: null, battle: null, reward: null, pendingLearn: [], pendingBoss: null, runs: 0,
        phase: 'scene', events: [], ending: null,
    };
    fullHeal(G, G.agent);
    G.agent.hp = calc(G, G.agent).maxhp;
    startScene(G, 'prologue');
    return G;
}

// ================================================================ scenes
export function startScene(G, id) {
    const sc = SCENES[id];
    if (!sc) throw new Error('no scene ' + id);
    G.scene = { id, i: 0, nodes: JSON.parse(JSON.stringify(sc.nodes)), then: sc.then.map((o) => ({ ...o })), back: G.phase === 'scene' ? G.scene?.back : G.phase };
    G.phase = 'scene';
    emit(G, { type: 'scene', id, bg: sc.bg, cast: sc.cast });
    settle(G);
}

export const sceneNode = (G) => (G.scene ? G.scene.nodes[G.scene.i] || null : null);
export const sceneDef = (G) => (G.scene ? SCENES[G.scene.id] : null);

/** Apply effect nodes until a line, a choice or the end. */
function settle(G) {
    const sc = G.scene;
    while (sc.i < sc.nodes.length) {
        const n = sc.nodes[sc.i];
        if (Array.isArray(n) || n.ch) return;
        if (n.fx) for (const [k, v] of Object.entries(n.fx)) G.currents[k] += v;
        if (n.flag) G.flags[n.flag] = true;
        if (n.give) for (const [k, v] of Object.entries(n.give)) G.items[k] = (G.items[k] || 0) + v;
        if (n.scrap) G.scrap += n.scrap;
        sc.i++;
    }
    endScene(G);
}

export function choicesOf(G) {
    const n = sceneNode(G);
    if (!n || !n.ch) return null;
    return n.ch.map((o, i) => ({ i, t: o.t, locked: o.if ? !cond(G, o.if) : false, need: o.if || null }));
}

function sceneAct(G, a) {
    const sc = G.scene;
    if (!sc) return 'no scene';
    const n = sceneNode(G);
    if (a.type === 'next') {
        if (n && n.ch) return 'choose an answer';
        sc.i++;
        settle(G);
        return '';
    }
    if (a.type === 'choose') {
        if (!n || !n.ch) return 'nothing to choose';
        const o = n.ch[a.i];
        if (!o) return 'no such answer';
        if (o.if && !cond(G, o.if)) return 'that door is locked';
        if (o.fx) for (const [k, v] of Object.entries(o.fx)) G.currents[k] += v;
        if (o.end) sc.then = [{ k: 'scene', id: 'ending_' + o.end }];
        sc.nodes.splice(sc.i, 1, ...(o.r || []));
        settle(G);
        return '';
    }
    return 'unknown';
}

function endScene(G) {
    const sc = G.scene;
    const ops = sc.then;
    const back = sc.back;
    G.scene = null;
    emit(G, { type: 'scene_end', id: sc.id });
    for (let k = 0; k < ops.length; k++) {
        const op = ops[k];
        if (op.k === 'hub') { toHub(G); }
        else if (op.k === 'explore') { if (G.explore) G.phase = 'explore'; else toHub(G); }
        else if (op.k === 'flag') G.flags[op.f] = true;
        else if (op.k === 'boss') { beginBoss(G, op.id); }
        else if (op.k === 'join') { joinDaemon(G, op.sp); }
        else if (op.k === 'scene') { startScene(G, op.id); return; }
        else if (op.k === 'bond') { bondUp(G, op.who); }
        else if (op.k === 'credits') { G.ending = op.id; G.phase = 'credits'; emit(G, { type: 'credits', id: op.id }); }
    }
}

function toHub(G) {
    G.phase = 'hub';
    G.explore = null;
    emit(G, { type: 'hub', day: G.day, tide: tideOf(G.day) });
    for (const ev of HUB_EVENTS) {
        if (ev.need.every((f) => G.flags[f]) && !G.flags['seen_' + ev.scene]) {
            G.flags['seen_' + ev.scene] = true;
            startScene(G, ev.scene);
            return;
        }
    }
}

function bondUp(G, who) {
    G.bonds[who]++;
    G.day++;
    healAll(G);
    emit(G, { type: 'bond', who, rank: G.bonds[who] });
}

export function joinDaemon(G, sp) {
    const u = newDaemon(G, sp);
    G.stock.push(u);
    const d = G.dex[sp] || (G.dex[sp] = { seen: 0, aff: {}, pers: false, recoded: 0 });
    d.seen++; d.recoded++; d.pers = true;
    if (G.party.length < PARTY_SIZE) G.party.push(u.uid);
    emit(G, { type: 'join', uid: u.uid, sp, name: u.name });
    return u;
}

// ================================================================ bosses
function beginBoss(G, id) {
    const spec = BOSSES[id];
    const foes = spec.foes.map((f) => ({ ...f }));
    for (const f of foes) f.say = f.say || undefined;
    startBattle(G, { kind: spec.kind || 'boss', zone: G.explore ? G.explore.zone : null, tag: id, foes, waves: spec.waves, canFlee: false });
}

function winBoss(G, id) {
    G.flags['boss_' + id] = true;
    if (STORY_BOSS_ORDER.includes(id)) G.chapter = Math.max(G.chapter, STORY_BOSS_ORDER.indexOf(id) + 1);
    if (G.explore) { const rec = floorOf(G.explore); rec.bossDone = true; G.explore.boss = false; }
    if (id === 'meridian') { G.chapter = 7; startScene(G, 'meridian_choice'); return; }
    startScene(G, `boss_${id}_post`);
}

// ================================================================ the front door
export function act(G, a) {
    switch (G.phase) {
        case 'scene': return sceneAct(G, a);
        case 'battle': {
            const err = battleCommand(G, a);
            afterBattleStep(G);
            return err;
        }
        case 'reward': return rewardAct(G, a);
        case 'defeat': return defeatAct(G, a);
        case 'credits': if (a.type === 'credits_done') { G.flags.cleared = true; toHub(G); return ''; } return 'unknown';
        case 'hub': return hubAct(G, a);
        case 'explore': return fieldAct(G, a);
        default: return 'unknown phase';
    }
}

/** After a battle command: a fled battle has no reward screen. */
function afterBattleStep(G) {
    if (G.phase === 'afterbattle') {
        const B = G.battle;
        G.battle = null;
        if (G.explore) { resolveFoe(G, 'flee'); G.phase = 'explore'; } else toHub(G);
    }
}

export function step(G, inp, dt) {
    if (G.phase !== 'explore') return;
    stepExplore(G, inp, dt);
    if (G.pendingBoss && G.phase === 'explore') {
        const id = G.pendingBoss;
        G.pendingBoss = null;
        startScene(G, `boss_${id}_pre`);
    }
}

// ================================================================ rewards and defeat
function rewardAct(G, a) {
    if (a.type === 'learn') return learnAct(G, a);
    if (a.type !== 'claim') return 'unknown';
    if (G.pendingLearn.length) return 'choose what to learn first';
    const B = G.battle;
    const kind = B.kind, tag = B.tag;
    G.battle = null;
    G.reward = null;
    if (kind === 'normal') { G.phase = 'explore'; resolveFoe(G, 'win'); }
    else winBoss(G, tag);
    return '';
}

function learnAct(G, a) {
    const p = G.pendingLearn[0];
    if (!p) return 'nothing to learn';
    const u = findUnit(G, p.uid);
    if (a.skip || !u) { G.pendingLearn.shift(); return ''; }
    if (a.replace == null || !u.skills[a.replace]) return 'pick a skill to forget';
    u.skills[a.replace] = p.skill;
    G.pendingLearn.shift();
    return '';
}

function defeatAct(G) {
    G.battle = null;
    G.reward = null;
    G.scrap = Math.floor(G.scrap * 0.8);
    leaveZone(G);
    startScene(G, 'defeat');
    return '';
}

// ================================================================ the field menu
function fieldAct(G, a) {
    switch (a.type) {
        case 'closeMenu': case 'anchor': case 'leaveZone': return exploreAction(G, a);
        case 'use': return useItem(G, a);
        case 'party': return setParty(G, a.uids);
        case 'learn': return learnAct(G, a);
        default: return 'not here';
    }
}

// ================================================================ the hub
export function unlockedZones(G) {
    const out = [];
    for (const Z of Object.values(ZONES)) {
        if (Z.id === 'rift') { if (G.chapter >= 2) out.push(Z.id); } else if (Z.chapter <= G.chapter) out.push(Z.id);
    }
    return out;
}

export function shopStock(G) {
    const items = [];
    for (const tier of SHOP) if (G.chapter >= tier.from) items.push(...tier.ids);
    const cap = [500, 500, 1700, 1700, 4000, 4000, 9500, 9500][Math.min(7, G.chapter)];
    const gear = Object.values(GEAR).filter((g) => g.price > 0 && g.price <= cap).map((g) => g.id);
    return { items, gear };
}
export const priceOf = (G, id, buying = true) => {
    const base = ITEMS[id] ? ITEMS[id].price : GEAR[id].price;
    return buying ? Math.max(1, Math.round(base * (1 - bondPerk(G, 'quill', 'shop')))) : Math.floor(base / 2);
};

function hubAct(G, a) {
    switch (a.type) {
        case 'deploy': {
            if (!unlockedZones(G).includes(a.zone)) return 'that zone is locked';
            enterZone(G, a.zone);
            return '';
        }
        case 'rest': G.day++; healAll(G); emit(G, { type: 'hub', day: G.day, tide: tideOf(G.day) }); return '';
        case 'hangout': {
            const who = a.who;
            if (!BONDERS.includes(who)) return 'no such person';
            const rank = G.bonds[who] + 1;
            if (rank > 4) return 'already as close as can be';
            if (G.chapter < BOND_GATE[rank]) return 'not yet; the story has to go further first';
            startScene(G, `bond_${who}_${rank}`);
            return '';
        }
        case 'buy': {
            const id = a.id, n = Math.max(1, a.n | 0 || 1);
            const st = shopStock(G);
            if (ITEMS[id]) {
                if (!st.items.includes(id)) return 'not in stock';
                const cost = priceOf(G, id) * n;
                if (G.scrap < cost) return 'not enough Scrap';
                G.scrap -= cost; G.items[id] = (G.items[id] || 0) + n;
                return '';
            }
            if (GEAR[id]) {
                if (!st.gear.includes(id)) return 'not in stock';
                if (G.ownedGear.includes(id)) return 'you already own it';
                const cost = priceOf(G, id);
                if (G.scrap < cost) return 'not enough Scrap';
                G.scrap -= cost; G.ownedGear.push(id);
                return '';
            }
            return 'no such thing';
        }
        case 'sell': {
            const id = a.id, n = Math.max(1, a.n | 0 || 1);
            if (!ITEMS[id] || (G.items[id] || 0) < n) return 'you do not have that';
            if (ITEMS[id].kind === 'key') return 'that is not for sale';
            G.items[id] -= n; G.scrap += priceOf(G, id, false) * n;
            return '';
        }
        case 'equip': return equip(G, a.slot, a.id);
        case 'use': return useItem(G, a);
        case 'chip': return useChip(G, a);
        case 'party': return setParty(G, a.uids);
        case 'focus': {
            if (!['balanced', 'blade', 'mage', 'quick', 'guard'].includes(a.f)) return 'unknown focus';
            G.agent.focus = a.f; G.agent.foc = a.f;
            return '';
        }
        case 'splice': return doSplice(G, a.a, a.b, a.keep || []);
        case 'release': {
            const u = G.stock.find((x) => x.uid === a.uid);
            if (!u) return 'no such daemon';
            G.stock = G.stock.filter((x) => x !== u);
            G.party = G.party.filter((x) => x !== u.uid);
            G.scrap += 10 + u.lv * 2;
            return '';
        }
        case 'learn': return learnAct(G, a);
        default: return 'not here';
    }
}

function equip(G, slot, id) {
    if (!['blade', 'sidearm', 'coat', 'charm'].includes(slot)) return 'no such slot';
    if (!GEAR[id] || GEAR[id].slot !== slot || !G.ownedGear.includes(id)) return 'you do not own it';
    G.gear[slot] = id;
    return '';
}

function setParty(G, uids) {
    const list = [...new Set(uids)].filter((uid) => G.stock.some((u) => u.uid === uid));
    if (list.length > PARTY_SIZE) return 'the party holds three daemons';
    G.party = list;
    return '';
}

function useChip(G, a) {
    const it = ITEMS[a.item];
    if (!it || it.kind !== 'chip' || (G.items[a.item] || 0) < 1) return 'no such chip';
    const ag = G.agent;
    if (ag.skills.includes(it.skill)) return 'the Agent already knows that';
    if (ag.skills.length >= AGENT_SKILL_SLOTS) {
        if (a.replace == null || !ag.skills[a.replace]) return 'pick a skill to replace';
        ag.skills[a.replace] = it.skill;
    } else ag.skills.push(it.skill);
    G.items[a.item]--;
    return '';
}

/** Items outside battle: healing, MP, revive, cure, Seeds, Beacons (leaves the zone). */
function useItem(G, a) {
    const it = ITEMS[a.item];
    if (!it || (G.items[a.item] || 0) < 1) return 'none left';
    if (it.kind === 'chip') return useChip(G, a);
    if (it.id === 'beacon') {
        if (G.phase !== 'explore') return 'only in a zone';
        G.items.beacon--;
        leaveZone(G);
        return '';
    }
    const u = findUnit(G, a.uid);
    if (!u) return 'pick a unit';
    const c = calc(G, u);
    if (it.kind === 'heal') { if (u.hp <= 0) return 'revive them first'; if (u.hp >= c.maxhp && !it.cure) return 'already at full health'; u.hp = Math.min(c.maxhp, u.hp + Math.round(c.maxhp * it.pct / 100)); }
    else if (it.kind === 'mp') { if (u.mp >= c.maxmp) return 'already full'; u.mp = Math.min(c.maxmp, u.mp + it.amt); }
    else if (it.kind === 'revive') { if (u.hp > 0) return 'they are standing'; u.hp = Math.max(1, Math.round(c.maxhp * it.pct / 100)); }
    else if (it.kind === 'seed') { u.mods[it.stat] += 2; }
    else if (it.kind === 'cure') { /* ailments end with the battle */ }
    else return 'not usable here';
    G.items[a.item]--;
    return '';
}

// ================================================================ saves
export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !d.agent) throw new Error('unknown save version');
    const G = JSON.parse(JSON.stringify(d));
    G.events = [];
    return G;
}

export { startBattle, battleCommand, splicePreview, calc, partyUnits, newDaemon };
