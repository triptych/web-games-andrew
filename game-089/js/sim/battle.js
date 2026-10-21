// Turn-based battles in the Final Fantasy mould, resolved in the sim and played back by the view.
//
// Turn order is a count-down timer per unit (like FFX's CTB): every unit has `next`, the time of
// its next turn; acting pushes it back by 100 / speed (×1.5 slowed, ×0.67 hasted). The unit with
// the smallest `next` acts. Enemies act at once; when a party member's turn comes up the battle
// stops and waits for a command. command() resolves that command and every enemy turn after it,
// pushing ordered b_* events for the view, until a party member is up again or the battle ends.
//
// Pure: no DOM, no clock, randomness from G.rs.

import { SKILLS, BURSTS, ESKILLS, MONSTERS, ITEMS, STATUS } from './data.js';
import { stats, memberName, skillsOf } from './party.js';
import { rand, rint, wpick, pick } from './rand.js';
import { VALOR_MAX, xpToNext, pace } from '../config.js';

// Global tuning, fitted to the bot (dev/simtest.mjs prints the table).
export const TUNE = {
    eHp: 0.21, eAtk: 0.2, eDef: 0.15, eSpd: 0.022,   // enemy growth per level
    eAtkMul: 1.5, eHpMul: 0.62, bossHpMul: 0.85, dragonHpMul: 1.0,                        // enemy flat multipliers
    defK: 0.7,                                          // how much defence soaks
    xpShare: 0.34, goldMul: 1.35,
    dragonLv: (laps) => 2 + laps * 3,
    flee: 0.7,
};

const BAD = ['poison', 'burn', 'stun', 'slow', 'weak'];

export function enemyUnit(id, lv) {
    const M = MONSTERS[id];
    const b = M.base;
    const L = lv - 1;
    const hp = Math.round(b.hp * (1 + TUNE.eHp * L) * (M.dragon ? TUNE.dragonHpMul : M.boss ? TUNE.bossHpMul : TUNE.eHpMul));
    return {
        side: 'e', eid: id, name: M.name, lv, boss: !!M.boss, dragon: !!M.dragon || id === 'whelp',
        maxhp: hp, hp, maxmp: 0, mp: 0,
        atk: Math.round(b.atk * (1 + TUNE.eAtk * L) * TUNE.eAtkMul),
        mag: Math.round(b.mag * (1 + TUNE.eAtk * L) * TUNE.eAtkMul),
        def: Math.round(b.def * (1 + TUNE.eDef * L)),
        res: Math.round(b.res * (1 + TUNE.eDef * L)),
        spd: Math.round(b.spd * (1 + TUNE.eSpd * L) * 10) / 10,
        crit: 0.04, weak: M.weak || [], resist: M.resist || [], element: null, bane: 1, amp: {},
        regen: 0, fireGuard: 0, onHit: null, valorMul: 1,
        status: {}, next: 0, defending: false, alive: true, phase: 1,
    };
}

function partyUnit(G, mi) {
    const m = G.party[mi];
    const s = stats(G, m);
    return {
        side: 'p', mi, mid: m.id, name: memberName(G, m), lv: G.level,
        maxhp: s.maxhp, hp: m.hp, maxmp: s.maxmp, mp: m.mp,
        atk: s.atk, def: s.def, mag: s.mag, res: s.res, spd: s.spd,
        crit: s.crit, weak: [], resist: s.resist, element: s.element, bane: s.bane, amp: s.amp,
        regen: s.regen, fireGuard: s.fireGuard, onHit: s.onHit, valorMul: 1 + s.valor,
        status: {}, next: 0, defending: false, alive: m.hp > 0,
    };
}

/**
 * spec: { kind, enemies: [{ id, lv }], canFlee, region, dungeon: { id, floor } }
 * kind: encounter | ambush | mimic | dungeon | boss | dragon
 */
export function startBattle(G, spec) {
    const units = G.party.map((_, i) => partyUnit(G, i));
    for (const e of spec.enemies) units.push(enemyUnit(e.id, e.lv));
    const B = {
        kind: spec.kind, region: spec.region, dungeon: spec.dungeon || null,
        canFlee: spec.canFlee !== false, units, roamer: spec.roamer ?? null, turn: -1, time: 0, round: 0, over: null,
        loot: { xp: 0, gold: 0, mats: {}, items: {} }, log: [], whelps: false, dragonShards: spec.shards || 0,
    };
    G.battle = B;
    // the dragon's scales are weaker for every shard you carry
    for (const u of units) if (u.eid === 'pyrrhax') { u.def = Math.round(u.def * (1 - 0.06 * B.dragonShards)); u.res = Math.round(u.res * (1 - 0.06 * B.dragonShards)); }
    if (G.blessing) {
        for (const u of units) if (u.side === 'p' && u.alive) u.status[G.blessing] = 3;
        G.events.push({ type: 'b_blessing', buff: G.blessing });
        G.blessing = null;
    }
    for (const u of units) {
        const k = u.side === 'p' ? 0.75 : 1;
        u.next = (100 / u.spd) * (0.35 + rand(G) * 0.65) * k;
    }
    G.events.push({ type: 'b_start', kind: B.kind, units: units.map(viewUnit) });
    advance(G);
    return B;
}

/** What the view needs to build a unit's model and bars. */
export function viewUnit(u) {
    return { side: u.side, eid: u.eid, mid: u.mid, name: u.name, lv: u.lv, hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp, boss: u.boss, alive: u.alive };
}

const alive = (B, side) => B.units.filter((u) => u.alive && u.side === side);
const idx = (B, u) => B.units.indexOf(u);

function delayOf(u, mul = 1) {
    let d = (100 / Math.max(1, u.spd)) * mul;
    if (u.status.slow) d *= 1.5;
    if (u.status.haste) d *= 0.67;
    return d;
}

/** The next n turns as unit indices, assuming plain actions (for the turn-order bar). */
export function turnOrder(B, n = 8) {
    const sim = B.units.map((u, i) => ({ i, t: u.next, u })).filter((s) => s.u.alive);
    const out = [];
    while (out.length < n && sim.length) {
        sim.sort((a, b) => a.t - b.t || a.i - b.i);
        out.push(sim[0].i);
        sim[0].t += delayOf(sim[0].u);
    }
    return out;
}

function nextUnit(B) {
    let best = null;
    for (const u of B.units) if (u.alive && (!best || u.next < best.next - 1e-9)) best = u;
    return best;
}

function addValor(G, amt, u) {
    const B = G.battle;
    const mul = u?.valorMul ?? 1;
    const before = G.valor;
    G.valor = Math.min(VALOR_MAX, G.valor + amt * mul);
    if (Math.floor(before) !== Math.floor(G.valor)) G.events.push({ type: 'b_valor', v: Math.floor(G.valor) });
    void B;
}

function checkEnd(G) {
    const B = G.battle;
    if (B.over) return true;
    if (!alive(B, 'e').length) { endBattle(G, 'win'); return true; }
    if (!alive(B, 'p').length) { endBattle(G, 'lose'); return true; }
    return false;
}

/** Run turns until a party member must choose, or the battle ends. */
export function advance(G) {
    const B = G.battle;
    let guard = 0;
    while (!checkEnd(G) && guard++ < 500) {
        const u = nextUnit(B);
        B.time = u.next;
        const i = idx(B, u);
        // start of turn: damage over time, regen, statuses run down
        u.defending = false;
        tickStatus(G, u);
        if (!u.alive) { if (checkEnd(G)) return; continue; }
        if (u.status.stun) {
            delete u.status.stun;
            G.events.push({ type: 'b_stunned', u: i });
            u.next += delayOf(u) * 0.8;
            continue;
        }
        if (u.side === 'p') {
            B.turn = i;
            B.round++;
            G.events.push({ type: 'b_turn', u: i, order: turnOrder(B) });
            return;
        }
        enemyTurn(G, u);
        u.next += delayOf(u);
    }
}

function tickStatus(G, u) {
    const B = G.battle;
    const i = idx(B, u);
    for (const st of ['poison', 'burn']) {
        if (!u.status[st]) continue;
        const dmg = Math.max(1, Math.round(u.maxhp * (st === 'poison' ? 0.06 : 0.07) * (u.boss ? 0.35 : 1)));
        hurt(G, u, dmg);
        G.events.push({ type: 'b_dot', t: i, st, dmg, hp: u.hp });
        if (!u.alive) { G.events.push({ type: 'b_ko', t: i }); return; }
    }
    const regen = (u.status.regen ? 0.08 : 0) + u.regen;
    if (regen > 0 && u.hp < u.maxhp) {
        const amt = Math.max(1, Math.round(u.maxhp * regen));
        u.hp = Math.min(u.maxhp, u.hp + amt);
        G.events.push({ type: 'b_heal', t: i, amt, hp: u.hp, regen: true });
    }
    for (const k of Object.keys(u.status)) {
        if (k === 'stun') continue;
        u.status[k]--;
        if (u.status[k] <= 0) { delete u.status[k]; G.events.push({ type: 'b_status', t: i, st: k, on: false }); }
    }
}

function hurt(G, u, dmg) {
    u.hp = Math.max(0, u.hp - dmg);
    if (u.hp <= 0) { u.alive = false; u.status = {}; }
    if (u.side === 'p' && u.alive) addValor(G, (dmg / u.maxhp) * 22, u);
}

function applyStatus(G, t, st, turns, chance = 1) {
    if (!t.alive) return false;
    if (t.boss && st === 'stun') chance *= 0.35;
    if (t.dragon && st === 'stun') chance *= 0.5;
    if (rand(G) >= chance) return false;
    const fresh = !t.status[st];
    t.status[st] = Math.max(t.status[st] || 0, turns);
    if (st === 'haste') delete t.status.slow;
    if (st === 'slow') delete t.status.haste;
    G.events.push({ type: 'b_status', t: idx(G.battle, t), st, on: true, fresh });
    return true;
}

/** Damage from a to t. kind phys|mag. Returns the hit record. */
function calcHit(G, a, t, power, kind, element) {
    const phys = kind === 'phys';
    let atk = phys ? a.atk : a.mag;
    if (phys && a.status.atkUp) atk *= 1.3;
    if (!phys && a.status.atkUp) atk *= 1.15;
    if (a.status.weak) atk *= 0.75;
    let def = phys ? t.def : t.res;
    if (phys ? t.status.defUp : t.status.resUp) def *= 1.5;
    else if (!phys && t.status.defUp) def *= 1.15;
    let dmg = (power * atk * atk) / (atk + def * TUNE.defK);
    const el = element || (phys ? (a.status.imbue ? 'frost' : a.element) : null);
    let weak = false, resist = false;
    if (el && t.weak.includes(el)) { dmg *= 1.5; weak = true; }
    if (el && t.resist.includes(el)) { dmg *= 0.5; resist = true; }
    if (el && a.amp?.[el]) dmg *= a.amp[el];
    if (el === 'fire' && t.fireGuard) dmg *= 1 - t.fireGuard;
    if (t.dragon && a.bane > 1) dmg *= a.bane;
    let crit = false;
    if (phys && rand(G) < a.crit + (a.status.critUp ? 0.25 : 0)) { dmg *= 1.6; crit = true; }
    if (t.defending) dmg *= 0.5;
    dmg *= 0.9 + rand(G) * 0.2;
    return { dmg: Math.max(1, Math.round(dmg)), crit, weak, resist, el };
}

function strike(G, a, t, power, kind, element, extra = {}) {
    const B = G.battle;
    const h = calcHit(G, a, t, power, kind, element);
    hurt(G, t, h.dmg);
    G.events.push({ type: 'b_hit', u: idx(B, a), t: idx(B, t), dmg: h.dmg, crit: h.crit, weak: h.weak, resist: h.resist, el: h.el, hp: t.hp, ...extra });
    if (a.side === 'p') addValor(G, 3 + (h.weak ? 2 : 0) + (h.crit ? 2 : 0), a);
    if (!t.alive) {
        G.events.push({ type: 'b_ko', t: idx(B, t) });
        if (t.side === 'e') { addValor(G, 6, a); lootFrom(G, t); }
    } else if (t.eid === 'pyrrhax' && t.phase === 1 && t.hp <= t.maxhp * 0.5) dragonRises(G, t);
    return h;
}

/** Below half health Pyrrhax takes to the air, hits harder and hatches two whelps. */
function dragonRises(G, u) {
    const B = G.battle;
    u.phase = 2;
    G.events.push({ type: 'b_phase', u: idx(B, u), text: 'Pyrrhax takes to the air, blazing!' });
    u.atk = Math.round(u.atk * 1.12);
    u.mag = Math.round(u.mag * 1.12);
    if (!B.whelps) { B.whelps = true; summon(G, u, 'whelp', 2); }
}

function healUnit(G, t, amt, opts = {}) {
    const B = G.battle;
    if (!t.alive) return 0;
    const before = t.hp;
    t.hp = Math.min(t.maxhp, t.hp + Math.round(amt));
    G.events.push({ type: 'b_heal', t: idx(B, t), amt: t.hp - before, hp: t.hp, ...opts });
    return t.hp - before;
}

function reviveUnit(G, t, frac) {
    const B = G.battle;
    if (t.alive) return false;
    t.alive = true;
    t.hp = Math.max(1, Math.round(t.maxhp * frac));
    t.status = {};
    t.next = B.time + delayOf(t) * 0.5;
    G.events.push({ type: 'b_revive', t: idx(B, t), hp: t.hp });
    return true;
}

function cure(G, t) {
    for (const st of BAD) if (t.status[st]) { delete t.status[st]; G.events.push({ type: 'b_status', t: idx(G.battle, t), st, on: false }); }
}

function lootFrom(G, t) {
    const B = G.battle;
    const M = MONSTERS[t.eid];
    if (t.eid === 'pyrrhax') return;
    // XP is a share of the party's next level, more for tougher foes: progress stays steady
    // however far ahead or behind the party is, and grinding weak monsters pays little.
    const diff = t.lv - G.level;
    const f = Math.max(0.4, Math.min(1.5, 1 + 0.08 * diff));
    // ...and far ahead of the island's pace it slows right down, so a run of dungeons can't
    // carry a party ten levels past the story.
    const over = G.level - (pace(G.lap) + 2);
    const soft = over > 0 ? Math.max(0.08, Math.pow(0.5, over)) : 1;
    B.loot.xp += soft * Math.round(xpToNext(G.level) * TUNE.xpShare * (M.xp / 15) * f * (1 + 1.5 / G.level));
    B.loot.gold += Math.round(M.gold * (1 + 0.22 * (t.lv - 1)) * TUNE.goldMul);
    for (const [mat, ch] of M.drops) {
        if (ch >= 1) B.loot.mats[mat] = (B.loot.mats[mat] || 0) + ch;
        else if (rand(G) < ch) B.loot.mats[mat] = (B.loot.mats[mat] || 0) + 1;
    }
    if (!M.boss && rand(G) < 0.08) B.loot.items.potion = (B.loot.items.potion || 0) + 1;
}

// ------------------------------------------------------------------ the player's commands

/** Can the current party member do this? Returns a reason string or '' when allowed. */
export function whyNot(G, cmd) {
    const B = G.battle;
    if (!B || B.over) return 'no battle';
    const u = B.units[B.turn];
    if (!u || u.side !== 'p') return 'not your turn';
    if (cmd.cmd === 'skill') {
        const S = SKILLS[cmd.skill];
        if (!S) return 'unknown skill';
        if (!skillsOf(G, G.party[u.mi]).includes(cmd.skill)) return 'not learned';
        if (u.mp < S.mp) return 'not enough MP';
    }
    if (cmd.cmd === 'burst' && G.valor < VALOR_MAX) return 'Valor not full';
    if (cmd.cmd === 'item') {
        const I = ITEMS[cmd.item];
        if (!I || !I.use.includes('battle')) return 'not a battle item';
        if (!(G.bag.items[cmd.item] > 0)) return 'none left';
        if (I.flee && !B.canFlee) return 'no escape';
        if (I.target === 'ko' && !B.units.some((x) => x.side === 'p' && !x.alive)) return 'nobody to raise';
    }
    if (cmd.cmd === 'flee' && !B.canFlee) return 'no escape';
    return '';
}

/** Resolve the waiting party member's command and run on to the next decision. */
export function command(G, cmd) {
    const B = G.battle;
    const why = whyNot(G, cmd);
    if (why) return why;
    const u = B.units[B.turn];
    let mul = 1;
    const tgt = cmd.target != null ? B.units[cmd.target] : null;
    switch (cmd.cmd) {
        case 'attack': {
            const t = tgt && tgt.alive && tgt.side === 'e' ? tgt : pick(G, alive(B, 'e'));
            G.events.push({ type: 'b_act', u: B.turn, name: 'Attack', fx: weaponFx(G, u), targets: [idx(B, t)] });
            strike(G, u, t, 1, 'phys', null);
            if (u.onHit && t.alive) applyStatus(G, t, u.onHit.id, u.onHit.turns, u.onHit.chance);
            addValor(G, 3, u);
            break;
        }
        case 'defend':
            u.defending = true;
            G.events.push({ type: 'b_act', u: B.turn, name: 'Defend', fx: 'defend', targets: [B.turn] });
            u.mp = Math.min(u.maxmp, u.mp + Math.max(1, Math.round(u.maxmp * 0.08)));
            G.events.push({ type: 'b_mp', t: B.turn, mp: u.mp });
            addValor(G, 4, u);
            mul = 0.7;
            break;
        case 'skill': {
            const S = SKILLS[cmd.skill];
            u.mp -= S.mp;
            G.events.push({ type: 'b_mp', t: B.turn, mp: u.mp });
            useSkill(G, u, S, tgt, cmd.skill);
            addValor(G, 4, u);
            break;
        }
        case 'burst': {
            const S = BURSTS[cmd.burst || burstOf(G, u)];
            G.valor = 0;
            G.events.push({ type: 'b_valor', v: 0 });
            useSkill(G, u, S, tgt, cmd.burst || burstOf(G, u), true);
            break;
        }
        case 'item':
            useItem(G, u, cmd.item, tgt);
            mul = 0.8;
            break;
        case 'flee': {
            const ok = rand(G) < TUNE.flee;
            G.events.push({ type: 'b_act', u: B.turn, name: 'Run!', fx: 'flee', targets: [] });
            if (ok) { endBattle(G, 'fled'); return ''; }
            G.events.push({ type: 'b_fail', u: B.turn, text: 'Couldn\'t escape!' });
            break;
        }
        default: return 'unknown command';
    }
    if (B.over) return '';
    u.next += delayOf(u, mul);
    B.turn = -1;
    advance(G);
    return '';
}

export function burstOf(G, u) {
    const m = G.party[u.mi];
    return (m.id === 'hero' ? { knight: 'lionheart', ranger: 'starfall', mage: 'cataclysm' }[G.cls] : { pip: 'sanctuary', sylva: 'wildhunt', bram: 'broadside', grumli: 'mountain' }[m.id]);
}

function weaponFx(G, u) {
    const m = G.party[u.mi];
    const w = m.gear.weapon || '';
    if (w.startsWith('bow') || w === 'thornbow' || w === 'rimebow') return 'arrow';
    if (w.startsWith('staff') || w.endsWith('staff')) return 'staff';
    if (w.startsWith('hammer') || w === 'glacier') return 'smash';
    return 'slash';
}

function useSkill(G, u, S, tgt, id, burst = false) {
    const B = G.battle;
    const foes = () => alive(B, u.side === 'p' ? 'e' : 'p');
    const friends = () => alive(B, u.side);
    let targets = [];
    switch (S.target) {
        case 'enemy': targets = [tgt && tgt.alive && tgt.side !== u.side ? tgt : pick(G, foes())]; break;
        case 'enemies': targets = foes(); break;
        case 'random': targets = []; break;
        case 'ally': targets = [tgt && tgt.alive && tgt.side === u.side ? tgt : lowest(friends())]; break;
        case 'allies': targets = S.revive ? B.units.filter((x) => x.side === u.side) : friends(); break;
        case 'self': targets = [u]; break;
        case 'ko': {
            const ko = B.units.filter((x) => x.side === u.side && !x.alive);
            targets = [tgt && !tgt.alive && tgt.side === u.side ? tgt : ko[0]].filter(Boolean);
            break;
        }
    }
    G.events.push({ type: 'b_act', u: idx(B, u), name: S.name, fx: S.fx, skill: id, burst, el: S.element || null, targets: targets.map((t) => idx(B, t)) });
    if (S.kind === 'phys' || S.kind === 'mag') {
        const hits = S.hits || 1;
        for (let h = 0; h < hits; h++) {
            const list = S.target === 'random' ? [pick(G, foes())].filter(Boolean) : targets.filter((t) => t.alive);
            for (const t of list) {
                strike(G, u, t, S.power, S.kind, S.element, { hitNo: h });
                if (S.status && t.alive) applyStatus(G, t, S.status.id, S.status.turns, S.status.chance);
            }
            if (!foes().length) break;
        }
    } else if (S.kind === 'heal') {
        for (const t of targets) {
            if (S.revive && !t.alive) { reviveUnit(G, t, 1); continue; }
            const amt = S.pct ? t.maxhp * S.power : S.power * u.mag * 1.25 + 12 + u.lv * 2;
            healUnit(G, t, amt);
            if (burst) cure(G, t);
        }
    } else if (S.kind === 'revive') {
        for (const t of targets) reviveUnit(G, t, S.power);
    } else if (S.kind === 'cure') {
        for (const t of targets) cure(G, t);
    } else if (S.kind === 'debuff' && S.status) {
        for (const t of targets) applyStatus(G, t, S.status.id, S.status.turns, S.status.chance);
    }
    if (S.buffs) {
        const list = S.kind === 'buff' ? targets : friends();
        for (const t of list) for (const b of S.buffs) applyStatus(G, t, b.id, b.turns, 1);
    }
}

function lowest(list) {
    let best = null;
    for (const t of list) if (!best || t.hp / t.maxhp < best.hp / best.maxhp) best = t;
    return best;
}

function useItem(G, u, id, tgt) {
    const B = G.battle;
    const I = ITEMS[id];
    G.bag.items[id]--;
    if (!G.bag.items[id]) delete G.bag.items[id];
    let targets = [];
    if (I.target === 'ally') targets = [tgt && tgt.alive && tgt.side === 'p' ? tgt : lowest(alive(B, 'p'))];
    else if (I.target === 'ko') targets = [tgt && !tgt.alive && tgt.side === 'p' ? tgt : B.units.find((x) => x.side === 'p' && !x.alive)];
    else if (I.target === 'enemy') targets = [tgt && tgt.alive && tgt.side === 'e' ? tgt : pick(G, alive(B, 'e'))];
    else if (I.target === 'enemies') targets = alive(B, 'e');
    targets = targets.filter(Boolean);
    G.events.push({ type: 'b_act', u: B.turn, name: I.name, fx: 'item', item: id, targets: targets.map((t) => idx(B, t)) });
    if (I.flee) { endBattle(G, 'fled'); return; }
    for (const t of targets) {
        if (I.heal) healUnit(G, t, Math.max(I.min, t.maxhp * I.heal));
        if (I.mp) { t.mp = Math.min(t.maxmp, t.mp + Math.max(I.min, Math.round(t.maxmp * I.mp))); G.events.push({ type: 'b_mp', t: idx(B, t), mp: t.mp, gain: true }); }
        if (I.revive) reviveUnit(G, t, I.revive);
        if (I.cure) cure(G, t);
        if (I.damage) {
            const dmgBase = I.damage + I.perLap * (G.lap - 1);
            let dmg = dmgBase * (0.9 + rand(G) * 0.2);
            let weak = false, resist = false;
            if (t.weak.includes(I.element)) { dmg *= 1.5; weak = true; }
            if (t.resist.includes(I.element)) { dmg *= 0.5; resist = true; }
            dmg = Math.max(1, Math.round(dmg));
            hurt(G, t, dmg);
            G.events.push({ type: 'b_hit', u: B.turn, t: idx(B, t), dmg, weak, resist, el: I.element, hp: t.hp });
            if (!t.alive) { G.events.push({ type: 'b_ko', t: idx(B, t) }); lootFrom(G, t); }
        }
    }
}

// ------------------------------------------------------------------ enemies

function enemyTurn(G, u) {
    const B = G.battle;
    const M = MONSTERS[u.eid];
    const i = idx(B, u);
    let table = (u.phase === 2 && M.skills2) ? M.skills2 : M.skills;
    // only sensible moves: heal when hurt, buff when not buffed, summon when there's room
    table = table.filter(([id]) => {
        const S = ESKILLS[id];
        if (S.kind === 'heal') return u.hp < u.maxhp * 0.6;
        if (S.kind === 'buff') return !u.status[S.buff];
        if (S.kind === 'summon') return alive(B, 'e').length < 3;
        return true;
    });
    const id = wpick(G, table.length ? table : [['hit', 1]]);
    const S = ESKILLS[id];
    const party = alive(B, 'p');
    if (!party.length) return;
    if (S.kind === 'summon') { G.events.push({ type: 'b_act', u: i, name: S.name, fx: S.fx, targets: [] }); summon(G, u, S.summon, S.count || 1); return; }
    if (S.kind === 'heal') {
        G.events.push({ type: 'b_act', u: i, name: S.name, fx: S.fx, targets: [i] });
        healUnit(G, u, u.maxhp * S.power);
        return;
    }
    if (S.kind === 'buff') {
        G.events.push({ type: 'b_act', u: i, name: S.name, fx: S.fx, targets: [i] });
        applyStatus(G, u, S.buff, 3, 1);
        return;
    }
    const targets = S.target === 'all' ? party : [pickTarget(G, party)];
    G.events.push({ type: 'b_act', u: i, name: S.name, fx: S.fx, el: S.element || null, targets: targets.map((t) => idx(B, t)) });
    for (const t of targets) {
        if (S.kind === 'debuff') { applyStatus(G, t, S.status.id, S.status.turns, S.status.chance); continue; }
        strike(G, u, t, S.power, S.kind, S.element);
        if (S.status && t.alive) applyStatus(G, t, S.status.id, S.status.turns, S.status.chance);
        if (S.steal) {
            const g = Math.min(G.gold, rint(G, 8, 16) + G.lap * 6);
            if (g > 0) { G.gold -= g; B.loot.gold += Math.round(g * 0.5); G.events.push({ type: 'b_steal', u: i, gold: g }); }
        }
    }
}

/** Party members with less HP draw more attacks; a defending one draws a little more. */
function pickTarget(G, party) {
    return wpick(G, party.map((t) => [t, 1 + (1 - t.hp / t.maxhp) * 0.8 + (t.defending ? 0.3 : 0)]));
}

function summon(G, u, id, n) {
    const B = G.battle;
    for (let k = 0; k < n; k++) {
        if (alive(B, 'e').length >= 4) break;
        const e = enemyUnit(id, Math.max(1, u.lv - 2));
        e.next = B.time + delayOf(e) * (0.6 + rand(G) * 0.4);
        B.units.push(e);
        G.events.push({ type: 'b_summon', u: B.units.length - 1, unit: viewUnit(e) });
    }
}

// ------------------------------------------------------------------ the end

function endBattle(G, result) {
    const B = G.battle;
    B.over = result;
    B.turn = -1;
    // write HP and MP back; the fallen get up with 1 HP after a win or an escape
    for (const u of B.units) {
        if (u.side !== 'p') continue;
        const m = G.party[u.mi];
        m.hp = u.alive ? u.hp : (result === 'lose' ? 0 : 1);
        m.mp = u.mp;
    }
    G.events.push({ type: 'b_end', result, loot: result === 'win' ? B.loot : null });
}

/** Which statuses a unit has, for the UI. */
export function statusList(u) {
    return Object.keys(u.status).filter((k) => STATUS[k]);
}
