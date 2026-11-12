// HOLLOWDEEP — turn-based battles, Wizardry and Etrian style. Pure.
//
// A round: the player gives every hero a command (phase 'input'), then the round resolves whole: every living unit
// acts in initiative order (speed × a little luck), and the sim pushes one event per thing that happened. The view
// plays those events as a queue. Flee is a party command, tried at once; a failed flee gives the foes a free round.
//
// Heroes are the roster characters themselves (hp, mp and lasting statuses live on them); enemies are units in
// G.battle.foes. Unit ids: 'h<cid>' for heroes, 'e<n>' for foes.
//
// Rows: the first three of the party stand in front. The back row takes less physical damage and deals less melee
// damage, unless its weapon or skill is ranged.

import {
    FRONT, CRIT_MUL, BACK_ROW_TAKEN, BACK_ROW_MELEE, WEAK_MUL, RESIST_MUL, FLEE_BASE, POISON_PCT, REGEN_PCT, MAX_ENEMIES,
} from '../config.js';
import { SKILLS, CLASSES } from './data/classes.js';
import { MONSTERS, stratumOf, STRATA } from './data/monsters.js';
import { CONSUMABLES } from './data/items.js';
import { heroStats, monsterAt, knownSkills } from './stats.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TEMP = ['sleep', 'paralyze', 'stun', 'blind', 'curse', 'slow', 'might', 'guard', 'regen', 'taunt', 'marked', 'charm', 'haste'];
const DISABLE = ['sleep', 'paralyze', 'stun'];

// ---------------------------------------------------------------- monster actions
export const MONSTER_ACTS = {
    bite: { name: 'Bite', kind: 'phys', pow: 1.2 },
    drain: { name: 'Life Drain', kind: 'phys', pow: 1.0, drain: 0.5 },
    poison: { name: 'Venom', kind: 'phys', pow: 0.8, st: 'poison', ch: 0.5 },
    paralyze: { name: 'Paralysing Claw', kind: 'phys', pow: 0.8, st: 'paralyze', ch: 0.3 },
    flame: { name: 'Flame', kind: 'mag', pow: 1.3, el: 'fire' },
    frost: { name: 'Frost', kind: 'mag', pow: 1.25, el: 'ice', st: 'slow', ch: 0.3 },
    spark: { name: 'Spark', kind: 'mag', pow: 1.2, el: 'bolt' },
    sleep: { name: 'Lull', kind: 'status', st: 'sleep', ch: 0.5 },
    sleep_all: { name: 'Sleep Spores', kind: 'status', all: true, st: 'sleep', ch: 0.32 },
    poison_all: { name: 'Toxic Cloud', kind: 'mag', all: true, pow: 0.55, el: 'dark', st: 'poison', ch: 0.4 },
    heal_ally: { name: 'Mend', kind: 'heal_ally', pow: 0.3 },
    heal_self: { name: 'Regrow', kind: 'heal_self', pow: 0.12 },
    steal: { name: 'Pilfer', kind: 'phys', pow: 0.7, steal: true },
    bomb: { name: 'Blasting Powder', kind: 'mag', all: true, pow: 0.6, el: 'fire' },
    blind: { name: 'Dazzle', kind: 'status', st: 'blind', ch: 0.6 },
    entangle: { name: 'Entangle', kind: 'phys', pow: 0.9, st: 'stun', ch: 0.35 },
    entangle_all: { name: 'Grasping Roots', kind: 'phys', all: true, pow: 0.65, st: 'stun', ch: 0.22 },
    pierce: { name: 'Piercing Thrust', kind: 'phys', pow: 1.1, pierce: true },
    charm: { name: 'Siren Song', kind: 'status', st: 'charm', ch: 0.4 },
    cleave: { name: 'Cleave', kind: 'phys', all: true, pow: 0.75 },
    warcry: { name: 'War Cry', kind: 'buff_self', st: 'might', turns: 3 },
    howl: { name: 'Howl', kind: 'buff_allies', st: 'might', turns: 3 },
    smash: { name: 'Crushing Blow', kind: 'phys', pow: 1.6, acc: 0.85 },
    burn: { name: 'Searing Touch', kind: 'mag', pow: 1.0, el: 'fire', st: 'poison', ch: 0.4 },
    curse: { name: 'Curse', kind: 'status', st: 'curse', ch: 0.6 },
    darkbolt: { name: 'Dark Bolt', kind: 'mag', pow: 1.5, el: 'dark' },
    holy_light: { name: 'Searing Light', kind: 'mag', all: true, pow: 0.9, el: 'holy' },
    tidal: { name: 'Tidal Crash', kind: 'mag', all: true, pow: 1.0, el: 'ice' },
    eruption: { name: 'Eruption', kind: 'mag', all: true, pow: 1.1, el: 'fire' },
    blizzard: { name: 'Blizzard', kind: 'mag', all: true, pow: 1.1, el: 'ice', st: 'slow', ch: 0.25 },
    thunderstorm: { name: 'Thunderstorm', kind: 'mag', all: true, pow: 1.15, el: 'bolt', st: 'stun', ch: 0.12 },
    eclipse: { name: 'Eclipse', kind: 'mag', all: true, pow: 1.25, el: 'dark', st: 'curse', ch: 0.25 },
    raise: { name: 'Raise Dead', kind: 'summon', summon: 'rime_archer' },
    haste_self: { name: 'Overclock', kind: 'buff_self', st: 'haste', turns: 3 },
};

// ---------------------------------------------------------------- setup
/** The foes for a fight on `floor`. kind: 'random' | 'boss' | 'reaper'. */
export function rollFoes(G, floor, kind) {
    const { stratum } = stratumOf(floor);
    const rng = G.rng;
    if (kind === 'boss') return [stratum.boss];
    if (kind === 'reaper') return ['reaper', rng.pick(stratum.monsters)];
    const inStratum = (floor - 1) % 5;                        // 0..4
    const maxN = Math.min(MAX_ENEMIES, 2 + Math.floor(inStratum / 2) + (floor > 3 ? 1 : 0));
    const n = Math.max(1, Math.min(maxN, 1 + Math.floor(rng() * maxN)));
    // early floors meet the first monsters of the stratum more often
    const pool = stratum.monsters.slice(0, Math.min(6, 3 + inStratum + (floor > 5 ? 1 : 0)));
    const out = [];
    const main = rng.pick(pool);
    for (let i = 0; i < n; i++) out.push(rng() < 0.6 ? main : rng.pick(pool));
    return out;
}

function foeUnit(mid, floor, i) {
    const m = monsterAt(mid, floor);
    return { uid: 'e' + i, ...m, mhp: m.hp, st: {}, alive: true };
}

export function startBattle(G, kind) {
    const floor = G.floor;
    const mids = rollFoes(G, floor, kind);
    const foes = mids.map((mid, i) => foeUnit(mid, floor, i));
    G.battle = {
        kind, floor, round: 0, phase: 'input', foes, cmds: {}, order: [], cursor: 0, nextUid: foes.length,
        once: {}, buffs: {}, defend: {}, log: [], xp: 0, gold: 0, drops: [], kills: [],
    };
    for (const c of party(G)) clearTemp(c);
    G.mode = 'battle';
    G.events.push({ type: 'battle', kind, foes: foes.map((f) => ({ uid: f.uid, mid: f.mid, name: f.name, boss: f.boss, cycle: f.cycle })) });
    beginInput(G);
}

// ---------------------------------------------------------------- helpers
export const party = (G) => G.party.map((id) => G.roster.find((c) => c.id === id)).filter(Boolean);
const heroAlive = (c) => c.hp > 0;
export const canAct = (c) => c.hp > 0 && !DISABLE.some((s) => c.st[s]) && !c.st.charm;
const livingFoes = (B) => B.foes.filter((f) => f.alive);
const rowOf = (G, c) => (G.party.indexOf(c.id) < FRONT ? 'front' : 'back');
const uidOf = (u) => u.uid || 'h' + u.id;
const nameOf = (u) => u.name;

function clearTemp(c) {
    for (const s of TEMP) delete c.st[s];
}

function unitByUid(G, uid) {
    if (!uid) return null;
    if (uid[0] === 'h') return G.roster.find((c) => 'h' + c.id === uid) || null;
    return G.battle.foes.find((f) => f.uid === uid) || null;
}

function stats(G, u) {
    if (u.uid) return u;
    const s = G.battle?.cache?.[u.id] || heroStats(u);
    return s;
}

/** Heroes the player gives commands to this round, in party order. */
export function inputOrder(G) {
    return party(G).filter(canAct).map((c) => c.id);
}

function beginInput(G) {
    const B = G.battle;
    B.round++;
    B.phase = 'input';
    B.cmds = {};
    B.defend = {};
    B.cache = {};
    for (const c of party(G)) B.cache[c.id] = heroStats(c);
    B.order = inputOrder(G);
    B.cursor = 0;
    G.events.push({ type: 'round', n: B.round });
    if (!B.order.length) resolveRound(G);      // nobody can act (all asleep): the round plays out anyway
}

// ---------------------------------------------------------------- commands
/** Give the current hero a command. cmd: { a: 'attack'|'skill'|'defend'|'item', skill, target, item }. */
export function battleCommand(G, cmd) {
    const B = G.battle;
    if (!B || B.phase !== 'input') return false;
    const cid = B.order[B.cursor];
    const c = G.roster.find((x) => x.id === cid);
    if (!c) return false;
    if (!validCommand(G, c, cmd)) return false;
    B.cmds[cid] = { ...cmd };
    B.cursor++;
    if (B.cursor >= B.order.length) resolveRound(G);
    return true;
}

export function battleBack(G) {
    const B = G.battle;
    if (!B || B.phase !== 'input' || B.cursor === 0) return false;
    B.cursor--;
    delete B.cmds[B.order[B.cursor]];
    return true;
}

/** Fill every remaining hero's command with the auto-battle brain and resolve the round. */
export function battleAuto(G) {
    const B = G.battle;
    if (!B || B.phase !== 'input') return false;
    let guard = 0;
    while (B.phase === 'input' && guard++ < 10) {
        const cid = B.order[B.cursor];
        const c = G.roster.find((x) => x.id === cid);
        if (!battleCommand(G, autoCommand(G, c))) battleCommand(G, { a: 'defend' });
    }
    return true;
}

export function validCommand(G, c, cmd) {
    const B = G.battle;
    if (cmd.a === 'defend') return true;
    if (cmd.a === 'attack') return !!B.foes.find((f) => f.uid === cmd.target && f.alive) || !cmd.target;
    if (cmd.a === 'skill') {
        const sk = SKILLS[cmd.skill];
        if (!sk || sk.cls !== c.cls || sk.lv > c.lv) return false;
        if ((sk.mp || 0) > c.mp) return false;
        if (sk.once && B.once[c.id + sk.id]) return false;
        if (sk.kind === 'flee' && B.kind === 'boss') return false;
        if (sk.tgt === 'dead') return party(G).some((x) => x.hp <= 0 && 'h' + x.id === cmd.target);
        return true;
    }
    if (cmd.a === 'item') {
        const it = G.inv.find((e) => e.id === cmd.item && (e.n || 1) > 0);
        if (!it || !CONSUMABLES[cmd.item] || CONSUMABLES[cmd.item].escape) return false;
        // two heroes can't both plan to use the last one
        const planned = Object.values(B.cmds).filter((k) => k.a === 'item' && k.item === cmd.item).length;
        return planned < (it.n || 1);
    }
    return false;
}

/** The party tries to run. Never from a guardian. */
export function battleFlee(G, sure = false) {
    const B = G.battle;
    if (!B || B.phase !== 'input') return false;
    if (B.kind === 'boss') { G.events.push({ type: 'flee', ok: false, why: 'boss' }); return false; }
    const ps = party(G).filter(heroAlive);
    const pspd = ps.reduce((a, c) => a + B.cache[c.id].spd, 0) / Math.max(1, ps.length);
    const fs = livingFoes(B);
    const fspd = fs.reduce((a, f) => a + f.spd, 0) / Math.max(1, fs.length);
    const ch = sure ? 1 : clamp(FLEE_BASE + (pspd - fspd) * 0.025 - (B.kind === 'reaper' ? 0.25 : 0), 0.15, 0.92);
    if (G.rng() < ch) {
        G.events.push({ type: 'flee', ok: true });
        endBattle(G, 'fled');
        return true;
    }
    G.events.push({ type: 'flee', ok: false });
    B.cmds = {};
    for (const id of B.order) B.cmds[id] = { a: 'none' };
    B.order = [];
    resolveRound(G);
    return false;
}

// ---------------------------------------------------------------- the auto-battle brain (also the bot's)
export function autoCommand(G, c) {
    const B = G.battle;
    const foes = livingFoes(B);
    const pty = party(G);
    const sk = knownSkills(c).filter((s) => (s.mp || 0) <= c.mp && !(s.once && B.once[c.id + s.id]));
    const has = (id) => sk.find((s) => s.id === id);
    const plannedHeal = (uid) => Object.values(B.cmds).some((k) => k.target === uid && k.a === 'skill' && SKILLS[k.skill]?.kind === 'heal');
    const st = B.cache[c.id];
    const hpPct = (x) => x.hp / B.cache[x.id].hp;

    // revive the fallen
    const dead = pty.find((x) => x.hp <= 0 && !Object.values(B.cmds).some((k) => k.target === 'h' + x.id));
    if (dead && has('raise')) return { a: 'skill', skill: 'raise', target: 'h' + dead.id };
    // heal
    const hurt = pty.filter((x) => x.hp > 0 && hpPct(x) < 0.5 && !plannedHeal('h' + x.id)).sort((a, b) => hpPct(a) - hpPct(b));
    if (hurt.length >= 2 && has('mass_heal')) return { a: 'skill', skill: 'mass_heal', target: null };
    if (hurt.length && has('heal')) return { a: 'skill', skill: 'heal', target: 'h' + hurt[0].id };
    if (hurt.length && has('lay_hands') && hpPct(hurt[0]) < 0.35) return { a: 'skill', skill: 'lay_hands', target: 'h' + hurt[0].id };
    const ailing = pty.find((x) => x.hp > 0 && (x.st.sleep || x.st.paralyze || x.st.charm || x.st.poison) && !Object.values(B.cmds).some((k) => k.target === 'h' + x.id));
    if (ailing && has('cure') && (ailing.st.sleep || ailing.st.paralyze || ailing.st.charm)) return { a: 'skill', skill: 'cure', target: 'h' + ailing.id };
    if (c.hp > 0 && hpPct(c) < 0.3 && has('second_wind')) return { a: 'skill', skill: 'second_wind', target: null };
    // potions when nobody can heal
    const healer = pty.some((x) => x.hp > 0 && knownSkills(x).some((s) => s.id === 'heal') && x.mp >= 3);
    if (!healer && hurt.length && hpPct(hurt[0]) < 0.35) {
        const pot = ['hipotion', 'potion'].find((id) => validCommand(G, c, { a: 'item', item: id }));
        if (pot) return { a: 'item', item: pot, target: 'h' + hurt[0].id };
    }
    if (dead && !has('raise')) {
        if (validCommand(G, c, { a: 'item', item: 'phoenix' }) && B.kind === 'boss') return { a: 'item', item: 'phoenix', target: 'h' + dead.id };
    }
    // the strongest single foe, weakest-to-our-element first
    const big = foes.slice().sort((a, b) => b.hp - a.hp)[0];
    const worth = B.kind !== 'random' || foes.reduce((a, f) => a + f.hp, 0) > st.atk * 3;
    // area attacks against a crowd
    if (foes.length >= 2) {
        for (const id of ['meteor', 'blizzard', 'storm_arrows', 'thunder', 'turn_undead', 'volley', 'cleave']) {
            const s = has(id);
            if (!s) continue;
            if (id === 'turn_undead' && !foes.some((f) => f.undead)) continue;
            if (id === 'cleave' && hpPct(c) < 0.35) continue;
            if ((s.mp || 0) > 0 && !worth) continue;
            return { a: 'skill', skill: id, target: null };
        }
    }
    if (worth && has('war_cry') && B.kind !== 'random' && !pty.some((x) => x.st.might) && B.round <= 2) return { a: 'skill', skill: 'war_cry', target: null };
    if (worth && has('guard_wall') && B.kind === 'boss' && !pty.some((x) => x.st.guard)) return { a: 'skill', skill: 'guard_wall', target: null };
    if (has('provoke') && B.kind !== 'random' && !c.st.taunt && hpPct(c) > 0.6) return { a: 'skill', skill: 'provoke', target: null };
    // single-target damage: pick the skill with the best expected hit on the biggest foe
    let best = { a: 'attack', target: big.uid }, bestV = expected(G, c, null, big);
    for (const s of sk) {
        if (s.tgt !== 'enemy' || !(s.kind === 'phys' || s.kind === 'mag')) continue;
        if ((s.mp || 0) > 0 && !worth) continue;
        if (s.hpCost && hpPct(c) < 0.4) continue;
        const v = expected(G, c, s, big);
        if (v > bestV) { bestV = v; best = { a: 'skill', skill: s.id, target: big.uid }; }
    }
    if (has('hunters_mark') && B.kind === 'boss' && !big.st.marked) return { a: 'skill', skill: 'hunters_mark', target: big.uid };
    return best;
}

function expected(G, c, s, f) {
    const B = G.battle;
    const st = B.cache[c.id];
    const kind = s ? s.kind : 'phys';
    const pow = s ? s.pow : 1;
    const el = s?.el || (kind === 'phys' ? 'phys' : null);
    const A = kind === 'phys' ? st.atk : st.mag, D = kind === 'phys' ? f.def : f.res;
    let v = pow * A * A / (A + D);
    if (el && f.weak.includes(el)) v *= WEAK_MUL;
    if (el && f.resist.includes(el)) v *= RESIST_MUL;
    if (el === 'holy' && f.undead) v *= 2;
    if (kind === 'phys' && rowOf(G, c) === 'back' && !st.ranged && !s?.ranged) v *= BACK_ROW_MELEE;
    if (s?.st === 'stun') v *= 1.15;
    return v;
}

// ---------------------------------------------------------------- resolving a round
function resolveRound(G) {
    const B = G.battle;
    B.phase = 'resolve';
    const rng = G.rng;
    const actors = [];
    for (const c of party(G)) if (c.hp > 0) {
        const s = B.cache[c.id];
        let ini = s.spd * rng.range(0.8, 1.2) * (c.st.slow ? 0.6 : 1) * (c.st.haste ? 1.5 : 1);
        const cmd = B.cmds[c.id];
        if (cmd?.a === 'defend') { ini += 1000; B.defend[c.id] = true; }
        actors.push({ u: c, ini });
    }
    for (const f of B.foes) if (f.alive) actors.push({ u: f, ini: f.spd * rng.range(0.8, 1.2) * (f.st.slow ? 0.6 : 1) * (f.st.haste ? 1.5 : 1) });
    actors.sort((a, b) => b.ini - a.ini);

    for (const { u } of actors) {
        if (B.phase !== 'resolve') return;
        if (u.uid ? !u.alive : u.hp <= 0) continue;
        if (u.uid) foeAct(G, u); else heroAct(G, u);
        if (checkEnd(G)) return;
    }
    // end of round: poison, regen, statuses wear off
    for (const c of party(G)) {
        if (c.hp <= 0) continue;
        const mhp = B.cache[c.id].hp;
        if (c.st.poison) { const d = Math.max(1, Math.round(mhp * POISON_PCT)); c.hp = Math.max(0, c.hp - d); G.events.push({ type: 'dot', tgt: 'h' + c.id, dmg: d, hp: c.hp }); if (c.hp <= 0) heroDown(G, c); }
        if (c.hp > 0 && c.st.regen) { const h = Math.min(mhp - c.hp, Math.round(mhp * REGEN_PCT)); if (h > 0) { c.hp += h; G.events.push({ type: 'heal', tgt: 'h' + c.id, amt: h, hp: c.hp }); } }
        tickStatuses(G, c, 'h' + c.id);
    }
    for (const f of B.foes) {
        if (!f.alive) continue;
        if (f.st.poison) { const d = Math.max(1, Math.round(f.mhp * POISON_PCT * (f.boss ? 0.4 : 1))); f.hp -= d; G.events.push({ type: 'dot', tgt: f.uid, dmg: d, hp: Math.max(0, f.hp) }); if (f.hp <= 0) foeDown(G, f); }
        tickStatuses(G, f, f.uid);
    }
    if (checkEnd(G)) return;
    beginInput(G);
}

function tickStatuses(G, u, uid) {
    const rng = G.rng;
    for (const s of Object.keys(u.st)) {
        if (s === 'poison') continue;
        if (s === 'sleep' && rng() < 0.3) { delete u.st.sleep; G.events.push({ type: 'status', tgt: uid, id: 'sleep', on: false }); continue; }
        if (s === 'paralyze' && rng() < 0.25) { delete u.st.paralyze; G.events.push({ type: 'status', tgt: uid, id: 'paralyze', on: false }); continue; }
        if (s === 'charm' && rng() < 0.4) { delete u.st.charm; G.events.push({ type: 'status', tgt: uid, id: 'charm', on: false }); continue; }
        if (typeof u.st[s] === 'number') {
            u.st[s]--;
            if (u.st[s] <= 0) { delete u.st[s]; G.events.push({ type: 'status', tgt: uid, id: s, on: false }); }
        }
    }
}

function checkEnd(G) {
    const B = G.battle;
    if (B.phase !== 'resolve') return true;
    if (!livingFoes(B).length) { winBattle(G); return true; }
    if (!party(G).some(heroAlive)) { G.events.push({ type: 'wipe' }); endBattle(G, 'wipe'); return true; }
    return false;
}

// ---------------------------------------------------------------- hero actions
function heroAct(G, c) {
    const B = G.battle;
    const uid = 'h' + c.id;
    const rng = G.rng;
    for (const s of DISABLE) if (c.st[s]) { G.events.push({ type: 'skip', tgt: uid, why: s }); return; }
    if (c.st.charm) {
        // a charmed hero strikes a friend
        const pals = party(G).filter((x) => x.hp > 0 && x !== c);
        if (pals.length) {
            const t = rng.pick(pals);
            G.events.push({ type: 'act', src: uid, name: 'Charmed!', kind: 'attack', tgts: ['h' + t.id] });
            hit(G, c, t, 1, 'phys', 'phys', {});
        }
        return;
    }
    const cmd = B.cmds[c.id] || { a: 'defend' };
    if (cmd.a === 'none') return;
    if (cmd.a === 'defend') { G.events.push({ type: 'act', src: uid, name: 'Defend', kind: 'defend', tgts: [] }); return; }
    if (cmd.a === 'attack') {
        const t = retarget(G, cmd.target);
        if (!t) return;
        G.events.push({ type: 'act', src: uid, name: 'Attack', kind: 'attack', tgts: [t.uid] });
        hit(G, c, t, 1, 'phys', 'phys', {});
        return;
    }
    if (cmd.a === 'item') {
        const e = G.inv.find((x) => x.id === cmd.item);
        if (!e) return;
        const it = CONSUMABLES[cmd.item];
        let tgts;
        if (it.tgt === 'enemies') tgts = livingFoes(B);
        else {
            const t = unitByUid(G, cmd.target) || c;
            if (it.revive ? t.hp > 0 : t.hp <= 0) return;
            tgts = [t];
        }
        takeItem(G, cmd.item);
        G.events.push({ type: 'act', src: uid, name: it.name, kind: 'item', tgts: tgts.map(uidOf) });
        for (const t of tgts) applyConsumable(G, it, t);
        return;
    }
    const sk = SKILLS[cmd.skill];
    if (!sk || c.mp < (sk.mp || 0)) return;
    c.mp -= sk.mp || 0;
    if (sk.hpCost) c.hp = Math.max(1, c.hp - Math.round(B.cache[c.id].hp * sk.hpCost));
    if (sk.once) B.once[c.id + sk.id] = true;
    let tgts = [];
    if (sk.tgt === 'enemy') { const t = retarget(G, cmd.target); if (t) tgts = [t]; }
    else if (sk.tgt === 'enemies') tgts = livingFoes(B);
    else if (sk.tgt === 'ally') { const t = unitByUid(G, cmd.target); tgts = [t && t.hp > 0 ? t : c]; }
    else if (sk.tgt === 'allies') tgts = party(G).filter(heroAlive);
    else if (sk.tgt === 'self') tgts = [c];
    else if (sk.tgt === 'dead') { const t = unitByUid(G, cmd.target); if (t && t.hp <= 0) tgts = [t]; }
    G.events.push({ type: 'act', src: uid, name: sk.name, kind: sk.kind, el: sk.el, skill: sk.id, tgts: tgts.map(uidOf) });
    if (G.events.length && sk.mp) G.events.push({ type: 'mp', tgt: uid, mp: c.mp });
    if (sk.kind === 'flee') { endBattle(G, 'fled'); G.events.push({ type: 'flee', ok: true, smoke: true }); return; }
    for (const t of tgts) {
        if (B.phase !== 'resolve') return;
        if (sk.kind === 'phys' || sk.kind === 'mag') {
            if (!(t.uid ? t.alive : t.hp > 0)) continue;
            if (sk.instaKill && !t.boss && !t.elite && rng() < sk.instaKill) {
                t.hp = 0; G.events.push({ type: 'hit', tgt: t.uid, dmg: t.mhp, crit: true, hp: 0, el: 'phys', instant: true }); foeDown(G, t); continue;
            }
            hit(G, c, t, sk.pow, sk.kind, sk.el || (sk.kind === 'phys' ? 'phys' : null), sk);
            if (sk.st && (t.uid ? t.alive : t.hp > 0)) inflict(G, t, sk.st, sk.ch ?? 1, sk.turns);
        } else if (sk.kind === 'heal') {
            const mhp = B.cache[t.id].hp;
            const amt = sk.tgt === 'self' ? Math.round(mhp * sk.pow) : Math.round(sk.pow * B.cache[c.id].mag * 2.2 + 8);
            healUnit(G, t, amt);
        } else if (sk.kind === 'buff') {
            t.st[sk.st] = sk.turns || 3;
            G.events.push({ type: 'status', tgt: uidOf(t), id: sk.st, on: true });
        } else if (sk.kind === 'status') {
            inflict(G, t, sk.st, sk.ch ?? 1, sk.turns);
        } else if (sk.kind === 'cure') {
            for (const s of ['poison', 'sleep', 'paralyze', 'blind', 'curse', 'charm', 'slow']) if (t.st[s]) { delete t.st[s]; G.events.push({ type: 'status', tgt: uidOf(t), id: s, on: false }); }
        } else if (sk.kind === 'revive') {
            const mhp = B.cache[t.id].hp;
            t.hp = Math.max(1, Math.round(mhp * sk.pow));
            delete t.st.poison;
            G.events.push({ type: 'revive', tgt: uidOf(t), hp: t.hp });
        } else if (sk.kind === 'steal') {
            const s = B.cache[c.id];
            const gold = Math.round((t.gold || 5) * rng.range(0.6, 1.4) * (1 + s.luk * 0.01));
            if (rng() < 0.55 + s.luk * 0.005) { B.gold += gold; G.events.push({ type: 'steal', src: uid, tgt: t.uid, gold }); }
            else G.events.push({ type: 'miss', tgt: t.uid });
        }
    }
}

function retarget(G, uid) {
    const B = G.battle;
    const f = B.foes.find((x) => x.uid === uid && x.alive);
    if (f) return f;
    const alive = livingFoes(B);
    return alive.length ? alive[0] : null;
}

function applyConsumable(G, it, t) {
    const B = G.battle;
    if (it.heal || it.mp) {
        const s = B ? B.cache[t.id] : heroStats(t);
        if (it.heal) healUnit(G, t, Math.min(it.heal, s.hp));
        if (it.mp) { const before = t.mp; t.mp = Math.min(s.mp, t.mp + it.mp); G.events.push({ type: 'mp', tgt: 'h' + t.id, mp: t.mp, amt: t.mp - before }); }
    }
    if (it.cure) for (const s of ['poison', 'sleep', 'paralyze', 'blind', 'curse', 'charm']) if (t.st[s]) { delete t.st[s]; G.events.push({ type: 'status', tgt: 'h' + t.id, id: s, on: false }); }
    if (it.revive) {
        const s = B ? B.cache[t.id] : heroStats(t);
        t.hp = Math.max(1, Math.round(s.hp * it.revive));
        G.events.push({ type: 'revive', tgt: 'h' + t.id, hp: t.hp });
    }
    if (it.dmg) {
        const dmg = Math.round(it.dmg * (1 + 0.25 * (B.floor - 1)) * G.rng.range(0.9, 1.1) * (t.weak.includes(it.el) ? WEAK_MUL : 1) * (t.resist.includes(it.el) ? RESIST_MUL : 1));
        t.hp -= dmg;
        G.events.push({ type: 'hit', tgt: t.uid, dmg, hp: Math.max(0, t.hp), el: it.el, weak: t.weak.includes(it.el) });
        if (t.hp <= 0) foeDown(G, t);
    }
}
export { applyConsumable };

function takeItem(G, id) {
    const i = G.inv.findIndex((e) => e.id === id);
    if (i < 0) return;
    const e = G.inv[i];
    e.n = (e.n || 1) - 1;
    if (e.n <= 0) G.inv.splice(i, 1);
}
export { takeItem };

function healUnit(G, t, amt) {
    const B = G.battle;
    const mhp = t.uid ? t.mhp : (B?.cache?.[t.id] || heroStats(t)).hp;
    const h = Math.max(0, Math.min(mhp - t.hp, amt));
    t.hp += h;
    G.events.push({ type: 'heal', tgt: uidOf(t), amt: h, hp: t.hp });
}

// ---------------------------------------------------------------- damage
function hit(G, src, tgt, pow, kind, el, opts) {
    const B = G.battle;
    const rng = G.rng;
    const S = src.uid ? src : B.cache[src.id];
    const T = tgt.uid ? tgt : B.cache[tgt.id];
    const tuid = uidOf(tgt);
    // accuracy (spells always land)
    if (kind === 'phys' && !opts.sure) {
        let acc = clamp(0.92 + (S.spd - T.spd) * 0.006 - (tgt.uid ? 0 : T.luk * 0.002), 0.55, 0.98) * (opts.acc || 1);
        if (src.st.blind) acc *= 0.6;
        if (tgt.st.sleep || tgt.st.paralyze || tgt.st.stun) acc = 1;
        if (rng() > acc) { G.events.push({ type: 'miss', tgt: tuid }); return 0; }
    }
    const A = kind === 'phys' ? S.atk : S.mag;
    const D = Math.max(1, kind === 'phys' ? T.def : T.res);
    let d = pow * A * A / (A + D) * rng.range(0.9, 1.1);
    let weak = false, resist = false, crit = false;
    if (el && T.weak?.includes(el)) { d *= WEAK_MUL; weak = true; }
    if (el && T.resist?.includes(el)) { d *= RESIST_MUL; resist = true; }
    if (el === 'holy' && tgt.undead) { d *= 2; weak = true; }
    if (src.st.might) d *= 1.3;
    if (src.st.curse) d *= 0.7;
    if (tgt.st.marked) d *= 1.3;
    if (tgt.st.guard) d *= 0.7;
    if (tgt.st.taunt) d *= 0.8;
    if (!tgt.uid && B.defend[tgt.id]) d *= 0.5;
    if (kind === 'phys') {
        if (!tgt.uid && rowOf(G, tgt) === 'back' && !opts.pierce) d *= BACK_ROW_TAKEN;
        if (!src.uid && rowOf(G, src) === 'back' && !S.ranged && !opts.ranged) d *= BACK_ROW_MELEE;
        const critCh = (src.uid ? 0.04 : S.crit) + (opts.critBonus || 0);
        if (rng() < critCh) { d *= CRIT_MUL; crit = true; }
    }
    const dmg = Math.max(1, Math.round(d));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    G.events.push({ type: 'hit', tgt: tuid, src: uidOf(src), dmg, crit, weak, resist, el, hp: tgt.hp });
    if (tgt.st.sleep && rng() < 0.5) { delete tgt.st.sleep; G.events.push({ type: 'status', tgt: tuid, id: 'sleep', on: false }); }
    if (opts.drain) healUnit(G, src, Math.round(dmg * opts.drain));
    if (tgt.hp <= 0) { if (tgt.uid) foeDown(G, tgt); else heroDown(G, tgt); }
    return dmg;
}

function inflict(G, t, st, ch, turns) {
    if (!(t.uid ? t.alive : t.hp > 0)) return;
    const resistMul = t.boss ? 0.25 : t.elite ? 0.6 : 1;
    const luk = t.uid ? 0 : (G.battle.cache[t.id]?.luk || 0) * 0.004;
    if (G.rng() < ch * resistMul - luk) {
        t.st[st] = turns || (st === 'stun' ? 1 : st === 'poison' ? true : 3);
        G.events.push({ type: 'status', tgt: uidOf(t), id: st, on: true });
    } else G.events.push({ type: 'resist', tgt: uidOf(t), id: st });
}

function heroDown(G, c) {
    c.hp = 0;
    for (const s of Object.keys(c.st)) delete c.st[s];
    G.events.push({ type: 'down', tgt: 'h' + c.id });
}

function foeDown(G, f) {
    const B = G.battle;
    if (!f.alive) return;
    f.alive = false;
    f.hp = 0;
    B.xp += f.xp;
    B.gold += f.gold;
    B.kills.push(f.mid);
    G.events.push({ type: 'down', tgt: f.uid });
}

// ---------------------------------------------------------------- monster turns
function foeAct(G, f) {
    const B = G.battle;
    const rng = G.rng;
    for (const s of DISABLE) if (f.st[s]) { G.events.push({ type: 'skip', tgt: f.uid, why: s }); return; }
    const specialCh = f.boss ? 0.55 : f.elite ? 0.45 : 0.32;
    let act = null;
    if (f.acts.length && rng() < specialCh) {
        act = rng.pick(f.acts);
        const a = MONSTER_ACTS[act];
        // don't waste a heal at full health, or a summon with a full field
        if (a.kind === 'heal_self' && f.hp > f.mhp * 0.6) act = null;
        if (a.kind === 'heal_ally' && !livingFoes(B).some((x) => x.hp < x.mhp * 0.6)) act = null;
        if (a.kind === 'summon' && livingFoes(B).length >= MAX_ENEMIES) act = null;
        if (a.kind === 'buff_self' && f.st[a.st]) act = null;
    }
    const heroes = party(G).filter(heroAlive);
    if (!heroes.length) return;
    const pickHero = () => {
        const taunt = heroes.find((c) => c.st.taunt);
        if (taunt && rng() < 0.75) return taunt;
        const w = heroes.map((c) => (rowOf(G, c) === 'front' ? 3 : 1));
        let r = rng() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < heroes.length; i++) { r -= w[i]; if (r <= 0) return heroes[i]; }
        return heroes[heroes.length - 1];
    };
    if (!act) {
        const t = pickHero();
        G.events.push({ type: 'act', src: f.uid, name: 'Attack', kind: 'attack', tgts: ['h' + t.id] });
        hit(G, f, t, 1, f.el === 'phys' ? 'phys' : 'phys', f.el === 'phys' ? 'phys' : f.el, {});
        return;
    }
    const a = MONSTER_ACTS[act];
    if (a.kind === 'heal_self') { G.events.push({ type: 'act', src: f.uid, name: a.name, kind: 'heal', tgts: [f.uid] }); healUnit(G, f, Math.round(f.mhp * a.pow)); return; }
    if (a.kind === 'heal_ally') {
        const t = livingFoes(B).sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0];
        G.events.push({ type: 'act', src: f.uid, name: a.name, kind: 'heal', tgts: [t.uid] });
        healUnit(G, t, Math.round(t.mhp * a.pow));
        return;
    }
    if (a.kind === 'buff_self') { G.events.push({ type: 'act', src: f.uid, name: a.name, kind: 'buff', tgts: [f.uid] }); f.st[a.st] = a.turns; G.events.push({ type: 'status', tgt: f.uid, id: a.st, on: true }); return; }
    if (a.kind === 'buff_allies') {
        G.events.push({ type: 'act', src: f.uid, name: a.name, kind: 'buff', tgts: livingFoes(B).map((x) => x.uid) });
        for (const x of livingFoes(B)) { x.st[a.st] = a.turns; G.events.push({ type: 'status', tgt: x.uid, id: a.st, on: true }); }
        return;
    }
    if (a.kind === 'summon') {
        const uid = 'e' + B.nextUid++;
        const u = { ...foeUnit(a.summon, B.floor, 0), uid };
        u.xp = Math.round(u.xp * 0.5); u.gold = 0;
        B.foes.push(u);
        G.events.push({ type: 'act', src: f.uid, name: a.name, kind: 'summon', tgts: [uid] });
        G.events.push({ type: 'summon', uid, mid: u.mid, name: u.name });
        return;
    }
    const tgts = a.all ? heroes : [pickHero()];
    G.events.push({ type: 'act', src: f.uid, name: a.name, kind: a.kind, el: a.el, tgts: tgts.map((c) => 'h' + c.id) });
    for (const t of tgts) {
        if (B.phase !== 'resolve') return;
        if (t.hp <= 0) continue;
        if (a.kind === 'status') { inflict(G, t, a.st, a.ch, a.turns); continue; }
        const dealt = hit(G, f, t, a.pow, a.kind, a.el || (a.kind === 'phys' ? 'phys' : null), { pierce: a.pierce, drain: a.drain, acc: a.acc });
        if (dealt && a.st && t.hp > 0) inflict(G, t, a.st, a.ch, a.turns);
        if (dealt && a.steal) {
            const g = Math.min(G.gold, Math.round(f.gold * 1.5 + 5));
            if (g > 0) { G.gold -= g; G.events.push({ type: 'stolen', src: f.uid, gold: g }); }
        }
        if (G.battle.phase !== 'resolve') return;
        if (!party(G).some(heroAlive)) return;
    }
}

// ---------------------------------------------------------------- the end
function winBattle(G) {
    const B = G.battle;
    B.phase = 'won';
    const rng = G.rng;
    const { stratum, cycle } = stratumOf(B.floor);
    const tier = Math.min(7, STRATA.indexOf(stratum) + cycle);
    const pty = party(G);
    const luk = Math.max(0, ...pty.filter(heroAlive).map((c) => B.cache[c.id].luk));
    const gold = Math.round(B.gold * (1 + luk * 0.01));
    // drops: each foe may leave something; the guardian always leaves a fine weapon or armour
    const drops = [];
    for (const f of B.foes) {
        if (f.boss) { drops.push({ id: rng.pick(['sword', 'axe', 'dagger', 'mace', 'staff', 'bow', 'heavy', 'light', 'robe', 'shield']) + '_' + Math.min(7, tier + 1), plus: 1 + cycle }); continue; }
        if (f.elite) { drops.push({ id: rng.pick(['sword', 'axe', 'mace', 'staff', 'bow', 'heavy', 'light']) + '_' + tier, plus: 1 }); continue; }
        if (rng() < 0.1) drops.push({ id: rng.pick(['potion', 'potion', 'antidote', 'ether', 'firebomb']) });
        else if (rng() < 0.035) drops.push({ id: rng.pick(['sword', 'axe', 'dagger', 'mace', 'staff', 'bow', 'heavy', 'light', 'robe', 'shield']) + '_' + tier });
    }
    B.xp = Math.round(B.xp);
    B.result = { xp: B.xp, gold, drops: drops.map((d) => d.id) };
    G.events.push({ type: 'won', xp: B.xp, gold, drops: drops.map((d) => ({ ...d })) });
    G.gold += gold;
    B.drops = drops;
    endBattle(G, 'won');
}

function endBattle(G, result) {
    const B = G.battle;
    B.phase = result;
    for (const c of party(G)) {
        clearTemp(c);
        if (c.hp <= 0) c.hp = 0;
    }
    G.lastBattle = { kind: B.kind, result, floor: B.floor, xp: B.xp, kills: B.kills.slice(), drops: B.drops || [], foes: B.foes.map((f) => f.mid) };
    G.battle = null;
    G.mode = 'dungeon';
    G.events.push({ type: 'battle_end', result, kind: B.kind });
}

export const BATTLE_INFO = { DISABLE, TEMP };
export const classRow = (cls) => CLASSES[cls].row;
export { MONSTERS };
