// EMBERSPIRE — the whole game as data and commands. Pure: no DOM, no renderer, no Math.random, no clock.
// Real time (the idle tithe, the daily bonus) comes in as numbers and date strings passed to act().
//
// G.mode   'town' | 'tower'           G.phase 'day' | 'evening'
// G.battle the fight in progress, or null      G.run the climb in progress, or null
// G.scene  an evening scene being played, or null
//
// Everything the player can do is a command: act(G, { t, ... }). It returns true if accepted. The UI, the test bot
// and the browser all go through it. step(G, { hold }, dt) only paces the battle AI and auto-climb.

import { START, PARTY_MAX, EVOLVE_LV, ASCEND_LV, REST, DEFEAT_GOLD_LOSS, IDLE, SHOP_GEAR } from '../config.js';
import { makeRng, hashStr } from '../rng.js';
import { HEROES, HERO, CLASSES, SKILLS } from './data/heroes.js';
import { GEAR, RARITY, GOODS, UNIQUES, MAX_PLUS, MAX_PLUS_UNIQUE } from './data/items.js';
import { SCENES, SMALLTALK, BOND_XP, BOND_EVENING, QUEST_TEMPLATES, MILESTONES, DAILY, BLESSINGS, WATCHER_BOSS } from './data/story.js';
import { gearMult, goldScale, xpScale, xpNext, heroStats, blessing, power, rankOfFloor } from './stats.js';
import { startBattle, command, stepBattle, runAiTurn, unit } from './battle.js';
import { makeGear, gainXp, usefulType, ownsUnique } from './loot.js';

export const SAVE_V = 1;

// ---------------------------------------------------------------- new game
function makeHero(id, joined) {
    const h = HERO[id];
    const first = CLASSES[h.cls].skills[0].id;
    return { id, lv: 1, xp: 0, sp: 1, cls: h.cls, tier: 1, skills: { [first]: 1 }, eq: { weapon: null, armor: null, acc: null }, bond: 0, bondLv: 0, hp: null, mp: null, joined, errand: false };
}

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed), t: 0,
        day: 1, phase: 'day', mode: 'town',
        gold: START.gold, inv: { potion: START.potion, ether: START.ether, phoenix: START.phoenix, ore: 0, shard: 0, core: 0 },
        gear: {}, nextUid: 1,
        heroes: {}, party: ['arin', 'mira'],
        best: 0, run: null, battle: null, scene: null,
        auto: false, autoClimb: false, climbWait: 0,
        quests: [], milestones: {}, counters: { kills: 0, floors: 0, elites: 0, skills: 0, upgrades: 0, weakHits: 0, goldEarned: 0, healed: 0, items: 0, evenings: 0 },
        stats: { kills: 0, elites: 0, bossKills: 0, floorsCleared: 0, defeats: 0, killsBy: {} },
        seen: {}, watcher: [], eveningDone: false,
        daily: { last: null, streak: 0, claimedToday: false }, blessing: null,
        idle: { wall: null, gold: 0, ore: 0, xp: {} },
        shop: { day: 0, gear: [] },
        flags: {},
        events: [],
    };
    for (const h of HEROES) G.heroes[h.id] = makeHero(h.id, h.recruit === 0);
    for (const id of ['arin', 'mira']) outfit(G, id, 1);
    rollQuests(G);
    restock(G);
    return G;
}

function outfit(G, id, lvl) {
    const c = CLASSES[HERO[id].cls];
    const h = G.heroes[id];
    h.eq.weapon = makeGear(G, { type: c.weapon, lvl, rar: 0 });
    h.eq.armor = makeGear(G, { type: c.armor, lvl, rar: 0 });
    G.gear[h.eq.weapon].isNew = G.gear[h.eq.armor].isNew = false;
}

// ---------------------------------------------------------------- saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V || !d.heroes || !d.gear) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

// ---------------------------------------------------------------- queries the UI and bot share
export const joined = (G) => HEROES.map((h) => h.id).filter((id) => G.heroes[id].joined);
export const baseClass = (cls) => CLASSES[cls].from || cls;
export function checkpoints(G) {
    const out = [1];
    for (let f = 10; f <= G.best; f += 10) out.push(f + 1);
    return out;
}
export function recruitable(G) {
    return HEROES.filter((h) => !G.heroes[h.id].joined && G.best >= h.unlock);
}
export function recruitCost(G, id) {
    return Math.round(HERO[id].recruit * Math.max(1, goldScale(Math.max(1, G.best)) / 3));
}
/** Skills this hero's lineage teaches, with whether they can learn or rank one up now. */
export function skillList(G, id) {
    const h = G.heroes[id];
    const lineage = [baseClass(h.cls)];
    if (CLASSES[h.cls].tier >= 2) lineage.push(h.cls);
    const out = [];
    for (const c of lineage) for (const s of CLASSES[c].skills) {
        const rank = h.skills[s.id] || 0;
        const ult = s.lv >= ASCEND_LV;
        const cost = rank === 0 ? 1 : rank;
        const can = rank < 5 && h.lv >= s.lv && h.sp >= cost && (!ult || h.tier >= 3);
        out.push({ ...s, rank, cost, can, locked: h.lv < s.lv || (ult && h.tier < 3) });
    }
    return out;
}
export function upgradeCost(G, it) {
    const off = blessing(G)?.forgeOff || 0;
    const gold = Math.round(22 * goldScale(it.lvl) * Math.pow(it.plus + 1, 1.5) * RARITY[it.rar].mult * (1 - off / 100));
    return { gold, ore: it.plus + 1, shard: it.plus >= 4 ? it.plus - 3 : 0 };
}
export function maxPlus(it) { return it.u ? MAX_PLUS_UNIQUE : MAX_PLUS; }
export function reforgeCost(G, it) {
    const to = Math.max(it.lvl, G.best);
    return { to, gold: Math.round(40 * goldScale(to) * RARITY[it.rar].mult), shard: 1 + Math.floor((to - it.lvl) / 15) };
}
export function shardPrice(G) { return Math.round(160 * goldScale(Math.max(1, G.best))); }
export function gearPrice(it) { return Math.round(30 * goldScale(it.lvl) * Math.pow(RARITY[it.rar].mult, 2.2)); }
export function salvageValue(it) { return { ore: 1 + it.plus + it.rar, gold: Math.round(gearPrice(it) * 0.15) }; }
export function equippedBy(G, uid) {
    for (const id of Object.keys(G.heroes)) for (const s of ['weapon', 'armor', 'acc']) if (G.heroes[id].eq[s] === uid) return { id, slot: s };
    return null;
}
export function slotOf(it) { return GEAR[it.type].kind === 'acc' ? 'acc' : GEAR[it.type].kind; }
export function canEquip(G, id, it) {
    const base = CLASSES[baseClass(G.heroes[id].cls)];
    const slot = slotOf(it);
    if (slot === 'weapon') return it.type === base.weapon;
    if (slot === 'armor') return it.type === base.armor;
    return true;
}
export function questProgress(G, q) {
    if (q.ms) {
        const v = milestoneValue(G, q.kind);
        return { have: Math.min(v, q.need), need: q.need, done: v >= q.need };
    }
    const have = Math.min(q.need, G.counters[q.kind] - q.base);
    return { have, need: q.need, done: have >= q.need };
}
function milestoneValue(G, kind) {
    const js = joined(G);
    if (kind === 'best') return G.best;
    if (kind === 'roster') return js.length;
    if (kind === 'evolved') return js.filter((id) => G.heroes[id].tier >= 2).length;
    if (kind === 'ascended') return js.filter((id) => G.heroes[id].tier >= 3).length;
    if (kind === 'bondMax') return Math.max(0, ...js.map((id) => G.heroes[id].bondLv || 0));
    return 0;
}
export function boardQuests(G) {
    const ms = MILESTONES.filter((m) => !G.milestones[m.id]).slice(0, 2).map((m) => ({ ...m, ms: true, reward: m.reward }));
    return [...ms, ...G.quests.filter((q) => !q.claimed)];
}
export function idlePreview(G) { return { gold: Math.floor(G.idle.gold), ore: Math.floor(G.idle.ore), xp: G.idle.xp }; }

// ---------------------------------------------------------------- day cycle
function rollQuests(G) {
    const rng = G.rng;
    const pool = QUEST_TEMPLATES.slice();
    G.quests = [];
    for (let i = 0; i < 3; i++) {
        const tpl = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        const need = tpl.need(Math.max(1, G.best));
        G.quests.push({ id: `${tpl.id}-${G.day}`, tpl: tpl.id, name: tpl.name, text: tpl.text(need), kind: tpl.kind, need, base: G.counters[tpl.kind], reward: tpl.reward, claimed: false });
    }
}

function restock(G) {
    const rng = G.rng;
    for (const uid of G.shop.gear) if (G.gear[uid]?.shop) delete G.gear[uid];
    G.shop = { day: G.day, gear: [], shards: 0 };
    const lvl = Math.max(1, G.best);
    for (let i = 0; i < SHOP_GEAR; i++) {
        const rar = i === SHOP_GEAR - 1 ? 2 : rng.chance(0.4) ? 1 : 0;
        const uid = makeGear(G, { type: usefulType(G), lvl, rar });
        G.gear[uid].shop = true;
        G.gear[uid].isNew = false;
        G.shop.gear.push(uid);
    }
}

function healAll(G) {
    for (const id of joined(G)) { const h = G.heroes[id]; const s = heroStats(G, id); h.hp = s.hp; h.mp = s.mp; }
}

function dayNumber(day) {
    const [y, m, d] = day.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function giveReward(G, r, scaleGold = true) {
    const got = {};
    for (const [k, v] of Object.entries(r)) {
        if (k === 'gold') { const g = scaleGold ? Math.round(v * 25 * goldScale(Math.max(1, G.best))) : v; G.gold += g; got.gold = g; }
        else if (k === 'gear') { const uid = makeGear(G, { type: usefulType(G), lvl: Math.max(1, G.best), rar: v === 'epic' ? 3 : 2 }); got.gear = uid; }
        else { G.inv[k] = (G.inv[k] || 0) + v; got[k] = v; }
    }
    return got;
}

// ---------------------------------------------------------------- the commands
export function act(G, cmd) {
    const fn = CMDS[cmd.t];
    if (!fn) return false;
    return fn(G, cmd) !== false;
}

const inTown = (G) => G.mode === 'town' && !G.scene;

const CMDS = {
    // ---- the tower
    enter(G, { floor = 1 }) {
        if (!inTown(G) || G.phase !== 'day') return false;
        if (!checkpoints(G).includes(floor)) return false;
        G.party = G.party.filter((id) => G.heroes[id]?.joined).slice(0, PARTY_MAX);
        if (!G.party.length) return false;
        healAll(G);
        G.mode = 'tower';
        G.run = { start: floor, floor, gold: 0, xp: 0, kills: 0, floors: 0 };
        G.events.push({ type: 'enter', floor });
        startBattle(G, floor);
        return true;
    },
    cmd(G, c) {
        if (G.mode !== 'tower' || !G.battle) return false;
        return command(G, c);
    },
    auto(G, { on }) {
        G.auto = !!on;
        if (G.battle && G.auto && G.battle.phase === 'input') { G.battle.phase = 'ai'; G.battle.wait = 0; }
        else if (G.battle && !G.auto && G.battle.phase === 'ai') {
            const u = unit(G.battle, G.battle.turn);
            if (u && u.side === 'p') G.battle.phase = 'input';
        }
        return true;
    },
    autoClimb(G, { on }) { G.autoClimb = !!on; G.climbWait = 0; return true; },
    next(G) {
        const B = G.battle;
        if (G.mode !== 'tower' || !B || (B.phase !== 'won' && B.phase !== 'fled')) return false;
        let floor = B.floor;
        if (B.phase === 'won') {
            if (B.floor > G.best) newBest(G, B);
            G.run.floors++;
            restBetween(G, B.rank);
            floor = B.floor + 1;
        }
        G.run.floor = floor;
        startBattle(G, floor);
        return true;
    },
    leave(G) {
        const B = G.battle;
        if (G.mode !== 'tower') return false;
        if (B && (B.phase === 'input' || B.phase === 'ai')) return false;     // finish the fight (or flee) first
        if (B && B.phase === 'won') { if (B.floor > G.best) newBest(G, B); G.run.floors++; }
        if (B && B.phase === 'lost') {
            const loss = Math.min(G.gold, Math.round(G.run.gold * DEFEAT_GOLD_LOSS));
            G.gold -= loss;
            G.stats.defeats++;
            G.events.push({ type: 'defeat', floor: B.floor, loss });
        }
        G.events.push({ type: 'home', run: { ...G.run } });
        G.battle = null;
        G.run = null;
        G.mode = 'town';
        G.phase = 'evening';
        G.climbWait = 0;
        return true;
    },

    // ---- the tavern
    recruit(G, { id }) {
        if (!inTown(G)) return false;
        const h = G.heroes[id];
        if (!h || h.joined || G.best < HERO[id].unlock) return false;
        const cost = recruitCost(G, id);
        if (G.gold < cost) return false;
        G.gold -= cost;
        h.joined = true;
        // they join near the company's level, kitted for the floors you've reached
        const lvls = joined(G).filter((x) => x !== id).map((x) => G.heroes[x].lv);
        const target = Math.max(1, Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) - 1);
        while (h.lv < target) gainXp(G, id, xpNext(h.lv) - h.xp);
        outfit(G, id, Math.max(1, G.best - 2));
        if (G.party.length < PARTY_MAX) G.party.push(id);
        G.events.push({ type: 'recruit', id });
        return true;
    },
    party(G, { ids }) {
        if (!inTown(G) || !Array.isArray(ids)) return false;
        const clean = [...new Set(ids)].filter((id) => G.heroes[id]?.joined).slice(0, PARTY_MAX);
        if (!clean.length) return false;
        G.party = clean;
        for (const id of clean) G.heroes[id].errand = false;
        return true;
    },
    errand(G, { id, on }) {
        const h = G.heroes[id];
        if (!h?.joined || G.party.includes(id)) return false;
        h.errand = !!on;
        return true;
    },
    evening(G, { id }) {
        if (!inTown(G) || G.phase !== 'evening' || G.eveningDone) return false;
        const h = G.heroes[id];
        if (!h?.joined || HERO[id].hero) return false;
        const bl = blessing(G);
        const mul = bl?.bondMul || 1;
        const threshold = (h.bondLv + 1) * BOND_XP;
        G.counters.evenings++;
        if (h.bondLv < 5 && h.bond >= threshold) {
            G.scene = { id, kind: 'rank', rank: h.bondLv + 1, idx: h.bondLv };
        } else {
            h.bond = Math.min(h.bondLv >= 5 ? h.bond : threshold, h.bond + BOND_EVENING * mul);
            const pool = SMALLTALK[id];
            G.scene = { id, kind: 'talk', line: pool[(G.day + h.bondLv) % pool.length], ready: h.bondLv < 5 && h.bond >= threshold };
        }
        G.events.push({ type: 'scene', id, kind: G.scene.kind });
        return true;
    },
    choose(G, { i = 0 }) {
        const sc = G.scene;
        if (!sc) return false;
        const h = G.heroes[sc.id];
        if (sc.kind === 'rank') {
            const choice = SCENES[sc.id][sc.idx].choices[i];
            if (!choice) return false;
            if (choice[1]) {
                h.bondLv++;
                G.events.push({ type: 'bond', id: sc.id, rank: h.bondLv });
                if (h.bondLv === 3) { h.sp += 2; G.events.push({ type: 'bond-sp', id: sc.id }); }
                if (h.bondLv === 5) {
                    const key = 'keepsake_' + sc.id;
                    if (!ownsUnique(G, key)) G.events.push({ type: 'keepsake', id: sc.id, uid: makeGear(G, { lvl: Math.max(1, G.best), u: key }) });
                }
            } else {
                h.bond = Math.max(h.bondLv * BOND_XP, h.bond - 40);
                G.events.push({ type: 'bond-miss', id: sc.id });
            }
            G.scene = { ...sc, kind: 'reply', reply: choice[2], good: choice[1] };
            return true;
        }
        // talk or reply: done for the evening
        G.scene = null;
        G.eveningDone = true;
        return true;
    },
    rest(G) {
        if (!inTown(G)) return false;
        G.day++;
        G.phase = 'day';
        G.eveningDone = false;
        healAll(G);
        rollQuests(G);
        restock(G);
        G.events.push({ type: 'rest', day: G.day });
        return true;
    },

    // ---- gear: the forge, the shop
    equip(G, { id, uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || it.shop || !G.heroes[id]?.joined || !canEquip(G, id, it)) return false;
        const slot = slotOf(it);
        const was = equippedBy(G, uid);
        if (was) G.heroes[was.id].eq[was.slot] = null;
        G.heroes[id].eq[slot] = uid;
        it.isNew = false;
        clampHp(G, id);
        return true;
    },
    unequip(G, { id, slot }) {
        if (!inTown(G) || !G.heroes[id] || slot === 'weapon') return false;
        G.heroes[id].eq[slot] = null;
        clampHp(G, id);
        return true;
    },
    upgrade(G, { uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || it.shop || it.plus >= maxPlus(it)) return false;
        const c = upgradeCost(G, it);
        if (G.gold < c.gold || G.inv.ore < c.ore || G.inv.shard < c.shard) return false;
        G.gold -= c.gold; G.inv.ore -= c.ore; G.inv.shard -= c.shard;
        it.plus++;
        G.counters.upgrades++;
        G.events.push({ type: 'upgrade', uid, plus: it.plus });
        return true;
    },
    reforge(G, { uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || it.shop) return false;
        const c = reforgeCost(G, it);
        if (c.to <= it.lvl || G.gold < c.gold || G.inv.shard < c.shard) return false;
        G.gold -= c.gold; G.inv.shard -= c.shard;
        it.lvl = c.to;
        G.events.push({ type: 'reforge', uid, lvl: it.lvl });
        return true;
    },
    salvage(G, { uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || it.shop || it.u || equippedBy(G, uid)) return false;
        const v = salvageValue(it);
        G.inv.ore += v.ore; G.gold += v.gold;
        delete G.gear[uid];
        G.events.push({ type: 'salvage', ...v });
        return true;
    },
    buy(G, { id, n = 1 }) {
        if (!inTown(G)) return false;
        const g = GOODS[id];
        if (!g || (g.minFloor && G.best < g.minFloor) || n < 1) return false;
        const cost = g.price * n;
        if (G.gold < cost) return false;
        G.gold -= cost;
        G.inv[id] = (G.inv[id] || 0) + n;
        return true;
    },
    buyGear(G, { uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || !it.shop) return false;
        const price = gearPrice(it);
        if (G.gold < price) return false;
        G.gold -= price;
        delete it.shop;
        it.isNew = true;
        G.shop.gear = G.shop.gear.filter((u) => u !== uid);
        return true;
    },
    sell(G, { uid }) {
        if (!inTown(G)) return false;
        const it = G.gear[uid];
        if (!it || it.shop || it.u || equippedBy(G, uid)) return false;
        G.gold += Math.round(gearPrice(it) * 0.3);
        delete G.gear[uid];
        return true;
    },
    buyShard(G) {
        if (!inTown(G) || G.shop.shards >= 3) return false;
        const cost = shardPrice(G);
        if (G.gold < cost) return false;
        G.gold -= cost;
        G.inv.shard++;
        G.shop.shards = (G.shop.shards || 0) + 1;
        return true;
    },
    coreTrade(G, { type }) {
        if (!inTown(G) || !GEAR[type] || G.inv.core < 3) return false;
        G.inv.core -= 3;
        const uid = makeGear(G, { type, lvl: Math.max(1, G.best), rar: 3 });
        G.events.push({ type: 'trade', uid });
        return true;
    },

    // ---- the temple
    learn(G, { id, skill }) {
        if (!inTown(G)) return false;
        const h = G.heroes[id];
        if (!h?.joined) return false;
        const s = skillList(G, id).find((x) => x.id === skill);
        if (!s || !s.can) return false;
        h.sp -= s.cost;
        h.skills[skill] = s.rank + 1;
        G.events.push({ type: 'learn', id, skill, rank: h.skills[skill] });
        return true;
    },
    evolve(G, { id, cls }) {
        if (!inTown(G)) return false;
        const h = G.heroes[id];
        if (!h?.joined || h.tier !== 1 || h.lv < EVOLVE_LV || !CLASSES[h.cls].evo.includes(cls)) return false;
        h.cls = cls;
        h.tier = 2;
        const first = CLASSES[cls].skills[0].id;
        h.skills[first] = Math.max(1, h.skills[first] || 0);
        clampHp(G, id);
        G.events.push({ type: 'evolve', id, cls });
        return true;
    },
    ascend(G, { id }) {
        if (!inTown(G)) return false;
        const h = G.heroes[id];
        if (!h?.joined || h.tier !== 2 || h.lv < ASCEND_LV || G.inv.shard < 5) return false;
        G.inv.shard -= 5;
        h.tier = 3;
        const ult = CLASSES[h.cls].skills.find((s) => s.lv >= ASCEND_LV);
        if (ult) h.skills[ult.id] = Math.max(1, h.skills[ult.id] || 0);
        G.events.push({ type: 'ascend', id, name: CLASSES[h.cls].asc });
        return true;
    },

    // ---- the guild
    claim(G, { id }) {
        if (G.mode !== 'town') return false;
        const ms = MILESTONES.find((m) => m.id === id);
        if (ms) {
            if (G.milestones[id] || milestoneValue(G, ms.kind) < ms.need) return false;
            G.milestones[id] = true;
            G.events.push({ type: 'claim', id, got: giveReward(G, ms.reward, false) });
            return true;
        }
        const q = G.quests.find((x) => x.id === id);
        if (!q || q.claimed || !questProgress(G, q).done) return false;
        q.claimed = true;
        G.events.push({ type: 'claim', id, got: giveReward(G, q.reward, true) });
        return true;
    },

    // ---- real time: the daily bonus and the idle tithe
    daily(G, { day }) {
        if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
        G.blessing = BLESSINGS[hashStr(day) % BLESSINGS.length].id;
        if (G.daily.last === day) return false;
        const consecutive = G.daily.last && dayNumber(day) - dayNumber(G.daily.last) === 1;
        G.daily.streak = consecutive ? G.daily.streak + 1 : 1;
        G.daily.last = day;
        const r = DAILY[Math.min(DAILY.length, G.daily.streak) - 1];
        const got = {};
        for (const [k, v] of Object.entries(r)) {
            if (k === 'gold') { const g = Math.round(v * 20 * goldScale(Math.max(1, G.best))); G.gold += g; got.gold = g; }
            else if (k === 'gear') got.gear = makeGear(G, { type: usefulType(G), lvl: Math.max(1, G.best), rar: 3 });
            else { G.inv[k] = (G.inv[k] || 0) + v; got[k] = v; }
        }
        G.events.push({ type: 'daily', streak: G.daily.streak, got, blessing: G.blessing });
        return true;
    },
    idle(G, { now }) {
        if (!Number.isFinite(now)) return false;
        if (G.idle.wall == null || now < G.idle.wall) { G.idle.wall = now; return true; }
        const capMin = IDLE.capHours * 60;
        const min = Math.min(capMin, (now - G.idle.wall) / 60000);
        G.idle.wall = now;
        if (min <= 0) return true;
        const b = Math.max(1, G.best);
        const perGold = 3 * goldScale(b) * IDLE.titheFloors * Math.min(1, G.best / 5);
        const cap = (x) => Math.min(x, capMin);
        G.idle.minutes = cap((G.idle.minutes || 0) + min);
        G.idle.gold = Math.min(G.idle.gold + perGold * min, perGold * capMin);
        for (const id of joined(G)) {
            const h = G.heroes[id];
            if (!h.errand || G.party.includes(id)) continue;
            const xpm = 6 * xpScale(b) * IDLE.errandXp;
            G.idle.xp[id] = Math.min((G.idle.xp[id] || 0) + xpm * min, xpm * capMin);
            G.idle.gold += 3 * goldScale(b) * IDLE.errandGold * min;
            G.idle.ore += IDLE.errandOre * min;
        }
        return true;
    },
    collect(G) {
        if (G.mode !== 'town') return false;
        const gold = Math.floor(G.idle.gold), ore = Math.floor(G.idle.ore);
        if (gold <= 0 && ore <= 0 && !Object.values(G.idle.xp).some((x) => x >= 1)) return false;
        G.gold += gold;
        G.inv.ore += ore;
        for (const [id, x] of Object.entries(G.idle.xp)) if (x >= 1) gainXp(G, id, Math.floor(x));
        G.events.push({ type: 'collect', gold, ore, xp: { ...G.idle.xp } });
        G.idle.gold = 0; G.idle.ore = 0; G.idle.xp = {}; G.idle.minutes = 0;
        return true;
    },
    flag(G, { k }) { G.flags[k] = true; return true; },
};

function clampHp(G, id) {
    const h = G.heroes[id], s = heroStats(G, id);
    if (h.hp != null) h.hp = Math.min(h.hp, s.hp);
    if (h.mp != null) h.mp = Math.min(h.mp, s.mp);
}

function newBest(G, B) {
    G.best = B.floor;
    if (B.rank === 'boss') {
        const n = Math.round(B.floor / 10);
        if (!G.watcher.includes(n)) {
            G.watcher.push(n);
            G.events.push({ type: 'watcher', n, line: WATCHER_BOSS[(n - 1) % WATCHER_BOSS.length] });
        }
    }
}

function restBetween(G, rank) {
    const k = rank === 'boss' ? [REST.boss, REST.mpBoss] : rank === 'mini' ? [REST.mini, REST.mpMini] : [REST.floor, REST.mpFloor];
    for (const id of G.party) {
        const h = G.heroes[id];
        const s = heroStats(G, id);
        h.hp = Math.min(s.hp, Math.max(h.hp, 0) + Math.round(s.hp * k[0]));
        h.mp = Math.min(s.mp, h.mp + Math.round(s.mp * k[1]));
    }
}

/** The party's health as a share of its maximum (auto-climb decides on this). */
export function partyHealth(G) {
    let hp = 0, max = 0, dead = 0;
    for (const id of G.party) {
        const h = G.heroes[id], s = heroStats(G, id);
        hp += Math.max(0, h.hp ?? s.hp); max += s.hp;
        if ((h.hp ?? 1) <= 0) dead++;
    }
    return { ratio: max ? hp / max : 0, dead };
}

// ---------------------------------------------------------------- pacing
/** Advance time: the battle AI and auto-climb. inp.hold = the view is still playing the last action. */
export function step(G, inp, dt) {
    G.t += dt;
    const B = G.battle;
    if (G.mode !== 'tower' || !B) return;
    if (B.phase === 'ai') { stepBattle(G, inp.hold, dt); return; }
    if (G.autoClimb && !inp.hold && (B.phase === 'won' || B.phase === 'fled')) {
        // auto-climb never walks into a mini boss or a boss: it stops at the victory screen and lets you choose
        if (B.phase === 'won' && rankOfFloor(B.floor + 1) !== 'normal') return;
        G.climbWait += dt;
        if (G.climbWait < 1.2) return;
        G.climbWait = 0;
        const ph = partyHealth(G);
        if (B.phase === 'fled' || (ph.ratio >= 0.4 && ph.dead === 0) || B.rank !== 'normal') {
            // keep climbing; the floor's rest heals a little
            if (ph.ratio < 0.25 && B.rank === 'normal') act(G, { t: 'leave' }); else act(G, { t: 'next' });
        } else act(G, { t: 'leave' });
    }
}

/** Run the current battle to its end with the AI on both sides (tests, the bot). */
export function autoResolve(G, maxActions = 2000) {
    const B = G.battle;
    if (!B) return null;
    const was = G.auto;
    G.auto = true;
    if (B.phase === 'input') B.phase = 'ai';
    for (let i = 0; i < maxActions && (B.phase === 'ai'); i++) runAiTurn(G);
    G.auto = was;
    return B.phase;
}

export { power, heroStats, UNIQUES, SKILLS };
