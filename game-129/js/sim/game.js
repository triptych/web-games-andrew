// HOLLOWDEEP — the game's rules. Pure: no DOM, no rendering library, no Math.random, no clock.
//
// Everything the player can do is a command passed to act(G, cmd); the UI, the bot and the tests all go through it.
// act() validates, changes G and pushes events to G.events (the view plays them; nothing here waits on the view).
//
// G.mode: 'town' | 'dungeon' | 'battle'.
// Town:     rest, buy, sell, equip, unequip, use, hire, dismiss, party, revive, cure, take, turnin, talk, enter
// Dungeon:  move (f b l r), turn (-1 1 2), stairs, use, thread
// Battle:   cmd, back, auto, flee        (js/sim/battle.js)

import {
    START_GOLD, PARTY_MAX, ROSTER_MAX, INV_MAX, HIRE_COST, INN_COST, REVIVE_COST, CURE_COST, WIPE_GOLD_LOSS,
    DANGER_STEP, DANGER_SAFE_STEPS, FOUNTAIN_HEAL, REAPER_SIGHT,
} from '../config.js';
import { makeRng, hashInt } from '../rng.js';
import { CLASSES, CLASS_IDS, PORTRAITS, NAMES } from './data/classes.js';
import { STRATA, MONSTERS, isBossFloor, stratumOf, FLOORS_PER_STRATUM } from './data/monsters.js';
import { itemDef, gearStats, sellPrice, KIND_IDS, CONSUMABLES, ACCESSORIES } from './data/items.js';
import { STORY, NPCS } from './data/town.js';
import { getFloor, open, bfs, DX, DY } from './dungeon.js';
import { heroStats, xpNext, canEquip, knownSkills } from './stats.js';
import { startBattle, battleCommand, battleBack, battleAuto, battleFlee, party, applyConsumable, takeItem } from './battle.js';
import { storyFor, storyQuest, rollBoard, isComplete, spotQuest, onKills, questItemId, MAX_ACTIVE } from './quests.js';

export const SAVE_V = 1;

const KIT = {
    fighter: ['sword_0', 'light_0', null],
    knight: ['sword_0', 'heavy_0', 'shield_0'],
    thief: ['dagger_0', 'light_0', null],
    mage: ['staff_0', 'robe_0', null],
    priest: ['mace_0', 'robe_0', null],
    ranger: ['bow_0', 'light_0', null],
};

// ---------------------------------------------------------------- new game
export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(hashInt(seed, 1, 1)),
        mode: 'town', day: 1, gold: START_GOLD, nextId: 1,
        roster: [], party: [], recruits: [], inv: [],
        deepest: 0, warps: [1], bossDown: {}, floors: {},
        floor: 0, pos: { x: 0, y: 0, d: 0 }, danger: 0, steps: 0, here: null,
        battle: null, lastBattle: null,
        quests: { active: [], done: [], board: [] },
        stats: { battles: 0, wins: 0, kills: 0, wipes: 0, steps: 0, chests: 0, levels: 0 },
        events: [],
    };
    for (const [cls, name, por] of [['fighter', 'Brannoc', 'fighter_a'], ['priest', 'Sela', 'priest_b'], ['mage', 'Corvin', 'mage_a']]) {
        const c = makeHero(G, cls, 1, name, por);
        G.roster.push(c);
        G.party.push(c.id);
    }
    addItem(G, 'potion', 0, 4);
    addItem(G, 'thread', 0, 1);
    rollRecruits(G);
    G.quests.board = rollBoard(G);
    return G;
}

export function makeHero(G, cls, lv, name, por) {
    const rng = G.rng;
    const c = {
        id: G.nextId++, cls, lv, xp: 0, name: name || rng.pick(NAMES),
        por: por || rng.pick(PORTRAITS.filter((p) => p.cls === cls)).id,
        hp: 1, mp: 0, st: {}, eq: { weapon: null, armor: null, shield: null, acc: null },
    };
    const [w, a, s] = KIT[cls];
    const t = Math.min(7, Math.floor((lv - 1) / 4));          // recruits from deeper come better armed
    const tierUp = (id) => id.replace(/_0$/, '_' + Math.min(t, 7));
    c.eq.weapon = { id: tierUp(w), plus: 0 };
    c.eq.armor = { id: tierUp(a), plus: 0 };
    if (s) c.eq.shield = { id: tierUp(s), plus: 0 };
    const st = heroStats(c);
    c.hp = st.hp; c.mp = st.mp;
    return c;
}

function rollRecruits(G) {
    const rng = G.rng;
    const lvs = G.roster.map((c) => c.lv).sort((a, b) => b - a).slice(0, PARTY_MAX);
    const avg = lvs.length ? lvs.reduce((a, b) => a + b, 0) / lvs.length : 1;
    const lv = Math.max(1, Math.round(avg * 0.8));
    G.recruits = [];
    const classes = rng.shuffle(CLASS_IDS.slice());
    for (let i = 0; i < 4; i++) {
        const c = makeHero(G, classes[i], Math.max(1, lv + rng.int(-1, 0)));
        G.recruits.push(c);
    }
}

// ---------------------------------------------------------------- inventory
export function addItem(G, id, plus = 0, n = 1) {
    const d = itemDef(id);
    if (!d) return false;
    if (d.type === 'use' || d.type === 'quest') {
        const e = G.inv.find((x) => x.id === id);
        if (e) { e.n = (e.n || 1) + n; return true; }
        if (G.inv.length >= INV_MAX) { G.events.push({ type: 'full', id }); return false; }
        G.inv.push({ id, n });
        return true;
    }
    for (let i = 0; i < n; i++) {
        if (G.inv.length >= INV_MAX) { G.events.push({ type: 'full', id }); return false; }
        G.inv.push({ id, plus });
    }
    return true;
}

export const hero = (G, cid) => G.roster.find((c) => c.id === cid) || null;
export const deny = (G, why) => { G.events.push({ type: 'deny', why }); return false; };
export const unlockedTier = (G) => Math.min(7, Math.floor(Math.max(0, G.deepest - 1) / FLOORS_PER_STRATUM));

/** What Odo sells today. */
export function shopStock(G) {
    const t = unlockedTier(G);
    const out = [];
    for (const [id, c] of Object.entries(CONSUMABLES)) if ((c.tier || 0) <= t + 1) out.push(id);
    for (const k of KIND_IDS) for (let i = Math.max(0, t - 1); i <= t; i++) out.push(`${k}_${i}`);
    for (const [id, a] of Object.entries(ACCESSORIES)) if (a.tier <= t) out.push(id);
    return out;
}
export const buyPrice = (id) => itemDef(id).price;

// ---------------------------------------------------------------- act
export function act(G, cmd) {
    if (!cmd || typeof cmd.t !== 'string') return false;
    const fn = (G.mode === 'battle' ? BATTLE : G.mode === 'dungeon' ? DUNGEON : TOWN)[cmd.t] || ANY[cmd.t];
    if (!fn) return deny(G, `can't ${cmd.t} here`);
    const wasBattle = G.mode === 'battle';
    const ok = fn(G, cmd);
    if (wasBattle && G.mode !== 'battle') afterBattle(G);
    return ok;
}

const ANY = {
    use(G, { inv, target }) {
        const e = G.inv[inv];
        if (!e) return deny(G, 'no such item');
        const it = CONSUMABLES[e.id];
        if (!it) return deny(G, 'not usable');
        if (it.escape) {
            if (G.mode !== 'dungeon') return deny(G, 'only in the dungeon');
            takeItem(G, e.id);
            G.events.push({ type: 'thread' });
            toTown(G, 'thread');
            return true;
        }
        if (it.tgt === 'enemies') return deny(G, 'only in battle');
        const c = hero(G, target);
        if (!c) return deny(G, 'no target');
        if (it.revive ? c.hp > 0 : c.hp <= 0) return deny(G, it.revive ? 'not fallen' : 'fallen');
        takeItem(G, e.id);
        applyConsumable(G, it, c);
        return true;
    },
    equip(G, { cid, inv }) {
        const c = hero(G, cid), e = G.inv[inv];
        if (!c || !e) return deny(G, 'nothing to equip');
        const d = itemDef(e.id);
        if (!canEquip(c, d)) return deny(G, `${CLASSES[c.cls].name}s can't use that`);
        const slot = d.slot;
        G.inv.splice(inv, 1);
        if (c.eq[slot]) G.inv.push(c.eq[slot]);
        c.eq[slot] = { id: e.id, plus: e.plus || 0 };
        clampHero(c);
        G.events.push({ type: 'equip', cid, id: e.id });
        return true;
    },
    unequip(G, { cid, slot }) {
        const c = hero(G, cid);
        if (!c || !c.eq[slot]) return deny(G, 'nothing there');
        if (G.inv.length >= INV_MAX) return deny(G, 'pack is full');
        G.inv.push(c.eq[slot]);
        c.eq[slot] = null;
        clampHero(c);
        return true;
    },
    /** A healer's spell outside battle: heal, cure or raise. */
    field(G, { cid, skill, target }) {
        const c = hero(G, cid), t = hero(G, target);
        if (!c || !t || c.hp <= 0) return deny(G, 'nobody to cast');
        const sk = knownSkills(c).find((s) => s.id === skill);
        if (!sk || !['heal', 'cure', 'revive'].includes(sk.kind) || sk.tgt === 'self' || sk.tgt === 'allies') return deny(G, 'not a field spell');
        if (c.mp < (sk.mp || 0)) return deny(G, 'not enough MP');
        if (sk.kind === 'revive' ? t.hp > 0 : t.hp <= 0) return deny(G, sk.kind === 'revive' ? 'not fallen' : 'fallen');
        c.mp -= sk.mp || 0;
        const s = heroStats(t);
        if (sk.kind === 'heal') { const h = Math.min(s.hp - t.hp, Math.round(sk.pow * heroStats(c).mag * 2.2 + 8)); t.hp += h; G.events.push({ type: 'heal', tgt: 'h' + t.id, amt: h, hp: t.hp }); }
        else if (sk.kind === 'cure') { for (const k of Object.keys(t.st)) delete t.st[k]; G.events.push({ type: 'status', tgt: 'h' + t.id, id: 'poison', on: false }); }
        else { t.hp = Math.max(1, Math.round(s.hp * sk.pow)); G.events.push({ type: 'revive', tgt: 'h' + t.id, hp: t.hp }); }
        return true;
    },
    discard(G, { inv }) {
        const e = G.inv[inv];
        if (!e) return false;
        if (itemDef(e.id).type === 'quest') return deny(G, 'someone is waiting for that');
        G.inv.splice(inv, 1);
        return true;
    },
};

function clampHero(c) {
    const s = heroStats(c);
    c.hp = Math.min(c.hp, s.hp);
    c.mp = Math.min(c.mp, s.mp);
}

// ---------------------------------------------------------------- town
const TOWN = {
    rest(G) {
        const living = G.roster.filter((c) => c.hp > 0);
        const cost = INN_COST(living.reduce((a, c) => a + c.lv, 0));
        if (G.gold < cost) return deny(G, `a night costs ${cost} gold`);
        G.gold -= cost;
        for (const c of living) { const s = heroStats(c); c.hp = s.hp; c.mp = s.mp; delete c.st.poison; }
        G.day++;
        // the dungeon shifts in the night: the reaper walks again
        for (const f of Object.values(G.floors)) delete f.reaper;
        rollRecruits(G);
        G.quests.board = rollBoard(G).filter((b) => !G.quests.active.some((a) => a.id === b.id));
        G.events.push({ type: 'rest', cost, day: G.day });
        return true;
    },
    buy(G, { id, n = 1 }) {
        if (!shopStock(G).includes(id)) return deny(G, 'not in stock');
        const price = buyPrice(id) * n;
        if (G.gold < price) return deny(G, 'not enough gold');
        if (!addItem(G, id, 0, n)) return deny(G, 'pack is full');
        G.gold -= price;
        G.events.push({ type: 'buy', id, price });
        return true;
    },
    sell(G, { inv }) {
        const e = G.inv[inv];
        if (!e) return deny(G, 'nothing to sell');
        if (itemDef(e.id).type === 'quest') return deny(G, 'someone is waiting for that');
        const price = sellPrice(e);
        if ((e.n || 1) > 1) e.n--; else G.inv.splice(inv, 1);
        G.gold += price;
        G.events.push({ type: 'sell', id: e.id, price });
        return true;
    },
    hire(G, { i }) {
        const c = G.recruits[i];
        if (!c) return deny(G, 'nobody there');
        if (G.roster.length >= ROSTER_MAX) return deny(G, 'the guild hall is full');
        const cost = HIRE_COST(c.lv);
        if (G.gold < cost) return deny(G, `${c.name} wants ${cost} gold`);
        G.gold -= cost;
        G.recruits.splice(i, 1);
        G.roster.push(c);
        if (G.party.length < PARTY_MAX) G.party.push(c.id);
        G.events.push({ type: 'hire', cid: c.id, cost });
        return true;
    },
    dismiss(G, { cid }) {
        const c = hero(G, cid);
        if (!c) return false;
        if (G.roster.length <= 1) return deny(G, 'you need someone');
        for (const s of ['weapon', 'armor', 'shield', 'acc']) if (c.eq[s] && G.inv.length < INV_MAX) G.inv.push(c.eq[s]);
        G.roster = G.roster.filter((x) => x !== c);
        G.party = G.party.filter((id) => id !== cid);
        G.events.push({ type: 'dismiss', cid });
        return true;
    },
    party(G, { ids }) {
        if (!Array.isArray(ids) || ids.length > PARTY_MAX || new Set(ids).size !== ids.length) return deny(G, 'five at most');
        if (!ids.every((id) => hero(G, id))) return deny(G, 'unknown hero');
        G.party = ids.slice();
        return true;
    },
    revive(G, { cid }) {
        const c = hero(G, cid);
        if (!c || c.hp > 0) return deny(G, 'they are alive');
        // the Dawn raises the first of a broken party for nothing
        const free = !G.roster.some((x) => x.hp > 0);
        const cost = free ? 0 : REVIVE_COST(c.lv);
        if (G.gold < cost) return deny(G, `the rite costs ${cost} gold`);
        G.gold -= cost;
        c.hp = 1; c.st = {};
        G.events.push({ type: 'revived', cid, cost });
        return true;
    },
    cure(G, { cid }) {
        const c = hero(G, cid);
        if (!c || !c.st.poison) return deny(G, 'nothing to cure');
        if (G.gold < CURE_COST) return deny(G, 'not enough gold');
        G.gold -= CURE_COST;
        delete c.st.poison;
        return true;
    },
    talk(G, { npc }) {
        if (!NPCS[npc]) return false;
        const line = hashInt(G.day, npc.length, G.stats.battles) % NPCS[npc].lines.length;
        G.events.push({ type: 'talk', npc, line, story: storyFor(G, npc)?.id || null });
        return true;
    },
    take(G, { qid }) {
        if (G.quests.active.length >= MAX_ACTIVE) return deny(G, 'too many quests at once');
        let q = null;
        const s = STORY.find((x) => x.id === qid);
        if (s) { if (storyFor(G, s.npc)?.id !== qid) return deny(G, 'not offered'); q = storyQuest(s); }
        else {
            const i = G.quests.board.findIndex((b) => b.id === qid);
            if (i < 0) return deny(G, 'not on the board');
            q = G.quests.board.splice(i, 1)[0];
        }
        G.quests.active.push(q);
        G.events.push({ type: 'quest', id: q.id, title: q.title, done: isComplete(G, q) });
        return true;
    },
    turnin(G, { qid }) {
        const i = G.quests.active.findIndex((q) => q.id === qid);
        if (i < 0) return deny(G, 'no such quest');
        const q = G.quests.active[i];
        if (!isComplete(G, q)) return deny(G, 'not done yet');
        if (q.kind === 'fetch') takeItem(G, questItemId(q));
        G.quests.active.splice(i, 1);
        G.quests.done.push(q.id);
        G.gold += q.gold;
        const ups = grantXp(G, q.xp || 0, true);
        if (q.item) addItem(G, q.item, 0, q.n || 1);
        G.events.push({ type: 'reward', id: q.id, title: q.title, gold: q.gold, xp: q.xp, item: q.item, n: q.n || 1, ups });
        return true;
    },
    enter(G, { floor = 1 }) {
        if (!G.warps.includes(floor)) return deny(G, 'the warp stone does not know that floor');
        if (!party(G).some((c) => c.hp > 0)) return deny(G, 'nobody in the party can stand');
        G.mode = 'dungeon';
        arrive(G, floor, 'up');
        G.events.push({ type: 'enter', floor });
        return true;
    },
};

// ---------------------------------------------------------------- dungeon
export const floorState = (G, n) => (G.floors[n] ||= { seen: [], opened: [], got: false });

function markSeen(G, f, x, y) {
    const st = floorState(G, f.n);
    const set = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= f.w || cy >= f.h) return;
        const i = cy * f.w + cx;
        st.seen[i >> 5] = (st.seen[i >> 5] | 0) | (1 << (i & 31));
    };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(x + dx, y + dy);
    // and down the corridor ahead, as far as the lantern reaches
    for (let k = 0; k < 4; k++) {
        let cx = x, cy = y;
        for (let s = 0; s < 3; s++) {
            cx += DX[k]; cy += DY[k];
            if (!open(f, cx, cy)) break;
            set(cx - DY[k], cy + DX[k]); set(cx + DY[k], cy - DX[k]); set(cx + DX[k], cy + DY[k]);
        }
    }
}
export const isSeen = (G, n, i) => !!(((G.floors[n]?.seen[i >> 5]) | 0) & (1 << (i & 31)));

function arrive(G, n, from) {
    const f = getFloor(G.seed, n);
    G.floor = n;
    G.deepest = Math.max(G.deepest, n);
    G.pos = from === 'down' ? { x: f.down.x, y: f.down.y, d: dirTo(f.down, f.downApproach) } : { ...f.start };
    G.danger = 0;
    G.steps = 0;
    G.here = { fountain: false };
    const st = floorState(G, n);
    if (!('reaper' in st)) st.reaper = f.reaper ? { ...f.reaper } : null;
    markSeen(G, f, G.pos.x, G.pos.y);
    G.events.push({ type: 'floor', n, stratum: stratumOf(n).stratum.id });
}

function dirTo(a, b) {
    for (let k = 0; k < 4; k++) if (a.x + DX[k] === b.x && a.y + DY[k] === b.y) return k;
    return 0;
}

export function tileAt(G, x, y) {
    const f = getFloor(G.seed, G.floor);
    if (!open(f, x, y)) return 'wall';
    if (x === f.start.x && y === f.start.y) return 'up';
    if (x === f.down.x && y === f.down.y) return 'down';
    if (f.boss && x === f.boss.x && y === f.boss.y && !G.bossDown[G.floor]) return 'boss';
    const st = floorState(G, G.floor);
    const ci = f.chests.findIndex((c) => c.x === x && c.y === y);
    if (ci >= 0) return st.opened.includes(ci) ? 'chest_open' : 'chest';
    if (f.fountain && f.fountain.x === x && f.fountain.y === y) return 'fountain';
    if (f.spot && f.spot.x === x && f.spot.y === y && spotQuest(G, G.floor)) return spotQuest(G, G.floor).kind === 'rescue' ? 'delver' : 'glint';
    return 'floor';
}

const DUNGEON = {
    turn(G, { d }) {
        if (![1, -1, 2].includes(d)) return false;
        G.pos.d = (G.pos.d + d + 4) % 4;
        G.events.push({ type: 'turn', d });
        return true;
    },
    move(G, { dir = 'f' }) {
        const k = { f: 0, r: 1, b: 2, l: 3 }[dir];
        if (k === undefined) return false;
        const f = getFloor(G.seed, G.floor);
        const d = (G.pos.d + k) % 4;
        const nx = G.pos.x + DX[d], ny = G.pos.y + DY[d];
        if (!open(f, nx, ny)) { G.events.push({ type: 'bump' }); return false; }
        G.pos.x = nx; G.pos.y = ny;
        G.steps++;
        G.stats.steps++;
        markSeen(G, f, nx, ny);
        G.events.push({ type: 'step', dir, x: nx, y: ny });
        // poison bites on the march, but never kills
        for (const c of party(G)) if (c.hp > 1 && c.st.poison && G.stats.steps % 3 === 0) { c.hp = Math.max(1, c.hp - Math.max(1, Math.round(heroStats(c).hp * 0.03))); }
        if (onTile(G, f, nx, ny)) return true;
        if (moveReaper(G, f)) return true;
        // the encounter gauge
        if (G.steps > DANGER_SAFE_STEPS) {
            G.danger += G.rng.range(DANGER_STEP[0], DANGER_STEP[1]);
            if (G.danger >= 1) {
                G.danger = 0;
                G.stats.battles++;
                startBattle(G, 'random');
            }
        }
        return true;
    },
    stairs(G) {
        const t = tileAt(G, G.pos.x, G.pos.y);
        if (t === 'down') { arrive(G, G.floor + 1, 'up'); return true; }
        if (t === 'up') {
            if (G.floor === 1) { toTown(G, 'stairs'); return true; }
            arrive(G, G.floor - 1, 'down');
            return true;
        }
        return deny(G, 'no stairs here');
    },
};

function onTile(G, f, x, y) {
    const t = tileAt(G, x, y);
    const st = floorState(G, G.floor);
    if (t === 'boss') {
        G.stats.battles++;
        G.events.push({ type: 'guardian', mid: stratumOf(G.floor).stratum.boss });
        startBattle(G, 'boss');
        return true;
    }
    if (st.reaper && st.reaper.x === x && st.reaper.y === y) { reaperFight(G); return true; }
    if (t === 'chest') { openChest(G, f, f.chests.findIndex((c) => c.x === x && c.y === y)); return false; }
    if (t === 'fountain' && !G.here.fountain) {
        G.here.fountain = true;
        for (const c of party(G)) {
            if (c.hp <= 0) continue;
            const s = heroStats(c);
            c.hp = Math.min(s.hp, c.hp + Math.round(s.hp * FOUNTAIN_HEAL));
            c.mp = Math.min(s.mp, c.mp + Math.round(s.mp * FOUNTAIN_HEAL));
            delete c.st.poison;
        }
        G.events.push({ type: 'fountain' });
        return false;
    }
    if (t === 'glint') {
        const q = spotQuest(G, G.floor);
        addItem(G, questItemId(q), 0, 1);
        G.events.push({ type: 'found', id: questItemId(q), quest: q.id });
        return false;
    }
    if (t === 'delver') {
        const q = spotQuest(G, G.floor);
        q.found = true;
        if (G.roster.length < 12) {
            const lv = Math.max(1, Math.round(party(G).reduce((a, c) => a + c.lv, 0) / Math.max(1, G.party.length)));
            const c = makeHero(G, G.rng.pick(CLASS_IDS), lv, q.who || (q.story ? 'Isla' : null));
            G.roster.push(c);
            q.joined = c.id;
            G.events.push({ type: 'rescued', quest: q.id, cid: c.id, name: c.name });
        } else G.events.push({ type: 'rescued', quest: q.id, cid: null, name: q.who || 'Isla' });
        return false;
    }
    return false;
}

function openChest(G, f, ci) {
    const st = floorState(G, G.floor);
    st.opened.push(ci);
    G.stats.chests++;
    const rng = makeRng(hashInt(G.seed, G.floor * 100 + ci, 4242));
    const { stratum, cycle } = stratumOf(G.floor);
    const tier = Math.min(7, STRATA.indexOf(stratum) + cycle);
    // traps from floor 3: a thief usually disarms them
    if (G.floor >= 3 && rng() < 0.22) {
        const thief = party(G).find((c) => c.hp > 0 && c.cls === 'thief');
        if (thief && rng() < 0.75 + heroStats(thief).luk * 0.01) G.events.push({ type: 'disarm', cid: thief.id });
        else {
            const kind = rng.pick(['blade', 'gas', 'bolt']);
            for (const c of party(G)) {
                if (c.hp <= 0) continue;
                const s = heroStats(c);
                if (kind === 'gas') c.st.poison = true;
                else c.hp = Math.max(1, c.hp - Math.round(s.hp * (kind === 'bolt' ? 0.18 : 0.12)));
            }
            G.events.push({ type: 'trap', kind });
        }
    }
    const roll = rng();
    let got;
    if (roll < 0.45) { const gold = Math.round((20 + G.floor * 14) * rng.range(0.7, 1.4) * Math.pow(2.2, cycle)); G.gold += gold; got = { gold }; }
    else if (roll < 0.75) { const id = rng.pick(['potion', 'potion', 'ether', 'antidote', 'thread', 'firebomb', tier >= 2 ? 'hipotion' : 'potion', tier >= 1 ? 'phoenix' : 'potion']); addItem(G, id); got = { id }; }
    else {
        const kind = rng.pick(KIND_IDS);
        const plus = rng() < 0.15 + 0.03 * tier ? rng.int(1, Math.min(3, 1 + tier)) : 0;
        const id = `${kind}_${Math.min(7, tier + (rng() < 0.2 ? 1 : 0))}`;
        addItem(G, id, plus);
        got = { id, plus };
    }
    G.events.push({ type: 'chest', ...got });
}

function reaperFight(G) {
    G.stats.battles++;
    G.events.push({ type: 'reaper' });
    startBattle(G, 'reaper');
}

/** The Lantern Reaper hunts the party: one step toward them each time they step, once it can see them. */
function moveReaper(G, f) {
    const st = floorState(G, G.floor);
    const r = st.reaper;
    if (!r) return false;
    const d = Math.abs(r.x - G.pos.x) + Math.abs(r.y - G.pos.y);
    if (d === 0) { reaperFight(G); return true; }
    if (d > REAPER_SIGHT) return false;
    const dist = bfs(f, G.pos.x, G.pos.y, (x, y) => (x === f.down.x && y === f.down.y) || (f.boss && x === f.boss.x && y === f.boss.y));
    let best = null, bd = dist[r.y * f.w + r.x];
    if (bd < 0) return false;
    for (let k = 0; k < 4; k++) {
        const nx = r.x + DX[k], ny = r.y + DY[k];
        const v = open(f, nx, ny) ? dist[ny * f.w + nx] : -1;
        if (v >= 0 && v < bd) { bd = v; best = { x: nx, y: ny }; }
    }
    if (best) { r.x = best.x; r.y = best.y; G.events.push({ type: 'reaper_move', x: r.x, y: r.y }); }
    if (r.x === G.pos.x && r.y === G.pos.y) { reaperFight(G); return true; }
    return false;
}

function toTown(G, why) {
    G.mode = 'town';
    G.floor = 0;
    G.here = null;
    G.events.push({ type: 'town', why });
}

// ---------------------------------------------------------------- battle
const BATTLE = {
    cmd: (G, c) => battleCommand(G, c),
    back: (G) => battleBack(G),
    auto: (G) => battleAuto(G),
    flee: (G) => battleFlee(G),
};

function grantXp(G, xp, wholeRoster = false) {
    const ups = [];
    const who = wholeRoster ? G.roster : party(G);
    for (const c of who) {
        if (c.hp <= 0) continue;
        c.xp += xp;
        while (c.xp >= xpNext(c.lv) && c.lv < 99) {
            c.xp -= xpNext(c.lv);
            const before = heroStats(c);
            const known = new Set(knownSkills(c).map((s) => s.id));
            c.lv++;
            G.stats.levels++;
            const after = heroStats(c);
            c.hp += after.hp - before.hp;
            c.mp += after.mp - before.mp;
            const learned = knownSkills(c).filter((s) => !known.has(s.id)).map((s) => s.name);
            ups.push({ cid: c.id, lv: c.lv, learned });
            G.events.push({ type: 'levelup', cid: c.id, lv: c.lv, learned });
        }
    }
    return ups;
}

function afterBattle(G) {
    const L = G.lastBattle;
    if (!L) return;
    if (L.result === 'won') {
        G.stats.wins++;
        G.stats.kills += L.kills.length;
        onKills(G, L.kills);
        grantXp(G, L.xp);
        for (const d of L.drops) addItem(G, d.id, d.plus || 0);
        if (L.kind === 'boss') {
            G.bossDown[L.floor] = true;
            if (!G.warps.includes(L.floor + 1)) G.warps.push(L.floor + 1);
            G.events.push({ type: 'warp', floor: L.floor + 1, mid: stratumOf(L.floor).stratum.boss });
        }
        if (L.kind === 'reaper') floorState(G, L.floor).reaper = null;
    } else if (L.result === 'wipe') {
        G.stats.wipes++;
        const lost = Math.floor(G.gold * WIPE_GOLD_LOSS);
        G.gold -= lost;
        G.events.push({ type: 'rescue_party', lost });
        toTown(G, 'wipe');
    } else if (L.result === 'fled' && L.kind === 'reaper') {
        // the reaper loses the trail for a moment: it steps back
        const st = floorState(G, L.floor);
        const f = getFloor(G.seed, L.floor);
        if (st.reaper && f.reaper) { st.reaper = { ...f.reaper }; if (st.reaper.x === G.pos.x && st.reaper.y === G.pos.y) st.reaper = null; }
    }
}

// ---------------------------------------------------------------- save
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

// handy for the UI and the bot
export { heroStats, knownSkills, canEquip, getFloor, isComplete, storyFor, spotQuest };
export { STRATA, MONSTERS, isBossFloor, stratumOf, CLASSES, gearStats, itemDef };
