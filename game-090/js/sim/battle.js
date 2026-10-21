// The battle engine: Press Turn with knockdowns and All-Out Attacks.
//
//   Each side gets one icon per member standing. A normal action spends an icon (a half icon
//   first, if there is one). Hitting a weakness or landing a critical spends only half an icon
//   and knocks the target down. A miss or a null costs two. A repel or a drain costs the lot.
//   Downed foes lose their next icon getting up, and when every foe is down the party can
//   All-Out Attack. Recoding a Hex into a Daemon is a sub-state of the same battle.
//
// Pure: the battle is plain data in G.battle and every random number comes from G.rs.

import { rand, rint, pick, wpick, chance } from './rand.js';
import { SKILLS, AILMENTS } from './data/skills.js';
import { DAEMONS, RAPPORT, SCRIPTS, PERSONALITIES } from './data/daemons.js';
import { ITEMS, LOOT } from './data/items.js';
import { calc, findUnit, gainXp, offerSkill, newDaemon, partyUnits, nextUid } from './units.js';
import { bondPerk } from './perks.js';
import { tellOf, reactLine, demandLine } from './recode.js';
import { baseline, AFFINITY_MULT, NEED, PATIENCE, STOCK_MAX, FLEE_BASE, TIDES, tideOf, xpToNext, MAX_LEVEL } from '../config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const emit = (G, e) => { G.events.push(e); };
const PHYS = new Set(['strike', 'gun']);

// ================================================================ setup
export function foeSkills(sp, lv) {
    const out = [...sp.skills];
    for (const [l, s] of sp.learn) if (l <= lv && !out.includes(s)) out.push(s);
    return out.slice(-6);
}

function makeUnit(G, B, side, src, o = {}) {
    const c = calc(G, src);
    const sp = src.agent ? null : DAEMONS[src.sp];
    const hpMul = o.hpMul || 1;
    const maxhp = Math.round(c.maxhp * hpMul);
    const u = {
        id: B.units.length, side, ref: side === 'p' ? src.uid : 0, sp: src.sp, name: src.name, lv: src.lv, agent: !!src.agent,
        hp: side === 'p' ? clamp(src.hp, 0, maxhp) : maxhp, maxhp, mp: side === 'p' ? clamp(src.mp, 0, c.maxmp) : c.maxmp, maxmp: c.maxmp,
        st: c.st, ma: c.ma, vi: c.vi, ag: c.ag, lu: c.lu, aff: c.aff, pass: c.pass, gunBonus: c.gunBonus, critBonus: c.critBonus,
        skills: side === 'p' ? [...src.skills] : foeSkills(sp, src.lv),
        buff: { atk: 0, def: 0, agi: 0 }, bt: { atk: 0, def: 0, agi: 0 },
        ail: null, down: false, guard: false, charge: null, alive: src.hp > 0 || side === 'e', endured: false,
        pers: sp ? sp.pers : null, race: sp ? sp.race : 'human', boss: !!o.boss, elite: !!o.elite, atkMul: o.atkMul || 1, rage: false, noRecode: false, turns: 0,
    };
    if (u.hp <= 0) u.alive = false;
    if (src.agent && bondPerk(G, 'dov', 'endure')) u.pass = [...u.pass, { k: 'endure' }];
    B.units.push(u);
    return u;
}

/** spec: { kind, zone, foes: [{id, lv, boss, elite, hpMul}], waves?: [[...]], ambush, canFlee, tag } */
export function startBattle(G, spec) {
    const B = {
        kind: spec.kind || 'normal', zone: spec.zone || null, tag: spec.tag || null, canFlee: spec.canFlee !== false && spec.kind !== 'boss' && spec.kind !== 'final',
        ambush: spec.ambush || null, round: 0, units: [], phase: 'p', icons: { f: 0, h: 0 }, queue: [], actor: -1,
        neg: null, result: null, allOut: false, kills: [], gained: [], waves: (spec.waves || []).map((w) => w.map((f) => ({ ...f }))), wave: 0,
        fleeTries: 0, firstTurn: true, rewardMul: spec.rewardMul || 1, flags: {},
    };
    for (const src of partyUnits(G)) makeUnit(G, B, 'p', src);
    if (!B.units.find((u) => u.side === 'p' && u.agent).alive) B.units.find((u) => u.agent).alive = true;
    for (const f of spec.foes) addFoe(G, B, f);
    G.battle = B;
    G.phase = 'battle';
    emit(G, { type: 'b_start', kind: B.kind, zone: B.zone, ambush: B.ambush, units: B.units.map(brief) });
    if (B.ambush === 'player') {
        for (const f of B.units.filter((u) => u.side === 'e')) f.down = true;
        emit(G, { type: 'b_msg', text: 'Ambush! The Hexes are caught flat.' });
    }
    beginPhase(G, B.ambush === 'enemy' ? 'e' : 'p');
    runEnemies(G);
}

function addFoe(G, B, f) {
    const sp = DAEMONS[f.id];
    const lv = f.lv ?? sp.lv;
    const fake = { sp: f.id, name: sp.name, lv, hp: 1, mp: 0, skills: [], mods: { st: 0, ma: 0, vi: 0, ag: 0, lu: 0 }, uid: 0 };
    const u = makeUnit(G, B, 'e', fake, { hpMul: f.hpMul || (f.elite ? 1.4 : 1), boss: f.boss, elite: f.elite, atkMul: f.atkMul });
    u.alive = true;
    if (f.name) u.name = f.name;
    u.extraIcons = f.boss ? (f.icons ?? 1) : 0;
    const dex = G.dex[f.id] || (G.dex[f.id] = { seen: 0, aff: {}, pers: false, recoded: 0 });
    dex.seen++;
    return u;
}

export const brief = (u) => ({ id: u.id, side: u.side, sp: u.sp, name: u.name, lv: u.lv, hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp, boss: u.boss, elite: u.elite, alive: u.alive, down: u.down, agent: u.agent });
export const alive = (B, side) => B.units.filter((u) => u.side === side && u.alive);
const unitOf = (B, id) => B.units[id];

// ================================================================ phases and icons
function beginPhase(G, side) {
    const B = G.battle;
    B.phase = side;
    B.queue = [];
    if (side === 'p') B.round++;
    const mine = alive(B, side);
    for (const u of mine) phaseTick(G, u);
    // downed members spend their icon standing up
    let standing = 0, rose = 0;
    for (const u of mine) {
        if (u.down) { u.down = false; rose++; emit(G, { type: 'b_stand', id: u.id }); } else standing++;
    }
    B.allOut = false;
    let n = Math.max(1, standing);
    if (side === 'e') n += mine.reduce((t, x) => t + (x.extraIcons || 0), 0);
    B.icons = { f: n, h: side === 'p' ? rose : 0 };
    if (side === 'p' && B.round === 1) B.icons.h += bondPerk(G, 'wren', 'flash');
    emit(G, { type: 'b_phase', side, round: B.round, icons: { ...B.icons } });
    pickActor(G);
}

function agi(B, u) { return u.ag * (1 + 0.25 * u.buff.agi); }

function pickActor(G) {
    const ok = pickActorRaw(G);
    const B = G.battle;
    if (!ok || B.phase !== 'p') return ok;
    // a lagged or panicking party member acts on its own
    const a = unitOf(B, B.actor);
    if (a.ail && a.ail.k === 'lag') {
        emit(G, { type: 'b_skip', id: a.id, why: 'lag' });
        finishAction(G, 'normal');
        return B.phase === 'p' ? B.actor >= 0 : true;
    }
    if (a.ail && a.ail.k === 'panic') {
        const all = B.units.filter((x) => x.alive && x.id !== a.id);
        const r = useSkill(G, B, a, SKILLS.attack, pick(G, all).id);
        finishAction(G, r.cost || 'normal');
        return B.phase === 'p' ? B.actor >= 0 : true;
    }
    return ok;
}

function pickActorRaw(G) {
    const B = G.battle;
    const ready = () => B.queue.filter((id) => B.units[id].alive && !B.units[id].down);
    B.queue = ready();
    if (!B.queue.length) {
        B.queue = alive(B, B.phase).filter((u) => !u.down).sort((a, b) => agi(B, b) - agi(B, a) || a.id - b.id).map((u) => u.id);
    }
    if (!B.queue.length) { B.actor = -1; return false; }
    B.actor = B.queue[0];
    updateAllOut(G);
    return true;
}

function updateAllOut(G) {
    const B = G.battle;
    const foes = alive(B, 'e');
    B.allOut = B.phase === 'p' && foes.length > 0 && foes.every((f) => f.down) && B.icons.f + B.icons.h > 0;
}

/** Once per phase, every unit on the side that is starting: buffs wear down, regen and rot tick. */
function phaseTick(G, u) {
    u.turns++;
    u.guard = false;
    for (const k of ['atk', 'def', 'agi']) {
        if (u.bt[k] > 0) { u.bt[k]--; if (u.bt[k] === 0) { u.buff[k] = 0; emit(G, { type: 'b_buff', id: u.id, stat: k, stage: 0 }); } }
    }
    for (const p of u.pass) {
        if (p.k === 'regen' && u.hp < u.maxhp) heal(G, u, Math.round(u.maxhp * p.v), 'regen');
        if (p.k === 'mpregen') u.mp = Math.min(u.maxmp, u.mp + p.v);
    }
    if (u.ail && u.ail.k === 'rot') {
        const d = Math.max(1, Math.round(u.maxhp * 0.06));
        u.hp = Math.max(1, u.hp - d);
        emit(G, { type: 'b_dot', id: u.id, dmg: d, hp: u.hp });
        u.ail.t--;
        if (u.ail.t <= 0) { emit(G, { type: 'b_ailend', id: u.id, k: 'rot' }); u.ail = null; }
    }
}

function spend(B, kind) {
    const I = B.icons;
    const take = () => { if (I.h > 0) I.h--; else if (I.f > 0) I.f--; };
    if (kind === 'normal') take();
    else if (kind === 'half') { if (I.h > 0) I.h--; else if (I.f > 0) { I.f--; I.h++; } }
    else if (kind === 'two') { take(); take(); }
    else if (kind === 'all') { I.f = 0; I.h = 0; }
}

/** After any action: spend the cost, check the end of the battle, move to the next actor or phase. */
function finishAction(G, cost) {
    const B = G.battle;
    const actor = B.actor >= 0 ? unitOf(B, B.actor) : null;
    spend(B, cost);
    emit(G, { type: 'b_icons', side: B.phase, icons: { ...B.icons }, cost });
    if (actor && actor.alive && actor.ail && actor.ail.k !== 'rot') {
        // lag and panic and hush wear off by turns
        actor.ail.t--;
        if (actor.ail.t <= 0) { emit(G, { type: 'b_ailend', id: actor.id, k: actor.ail.k }); actor.ail = null; }
    }
    // the acting unit has used its slot
    B.queue = B.queue.filter((id) => id !== B.actor);
    if (checkEnd(G)) return;
    if (B.icons.f + B.icons.h <= 0 || !alive(B, B.phase).length) {
        beginPhase(G, B.phase === 'p' ? 'e' : 'p');
    } else if (!pickActor(G)) {
        beginPhase(G, B.phase === 'p' ? 'e' : 'p');
    }
}

function checkEnd(G) {
    const B = G.battle;
    if (B.result) return true;
    const agent = B.units.find((u) => u.agent);
    if (!agent.alive || !alive(B, 'p').length) { endBattle(G, 'lose'); return true; }
    if (!alive(B, 'e').length) {
        if (B.wave + 1 < B.waves.length + 1 && B.waves.length > B.wave) {
            nextWave(G);
            return false;
        }
        endBattle(G, 'win');
        return true;
    }
    return false;
}

function nextWave(G) {
    const B = G.battle;
    const foes = B.waves[B.wave];
    B.wave++;
    for (const f of foes) { const u = addFoe(G, B, f); emit(G, { type: 'b_join', unit: brief(u) }); }
    emit(G, { type: 'b_wave', wave: B.wave, text: foes[0] && foes[0].say });
}

// ================================================================ helpers on units
export function usable(B, u, sk) {
    if (!sk) return 'unknown skill';
    if (sk.kind === 'pass') return 'passive';
    if (u.ail && u.ail.k === 'hush' && sk.id !== 'attack' && (sk.mp || sk.hp)) return 'hushed';
    if (sk.mp && u.mp < sk.mp) return 'not enough MP';
    if (sk.hp && u.hp <= Math.ceil(u.maxhp * sk.hp / 100) + 0) return 'not enough HP';
    return '';
}

function heal(G, u, amt, why) {
    const before = u.hp;
    u.hp = Math.min(u.maxhp, u.hp + amt);
    emit(G, { type: 'b_heal', id: u.id, amt: u.hp - before, hp: u.hp, why });
}

function targetsOf(B, actor, sk, tid) {
    const foes = alive(B, actor.side === 'p' ? 'e' : 'p');
    const mates = B.units.filter((u) => u.side === actor.side);
    switch (sk.tgt) {
        case 'one': { const t = foes.find((u) => u.id === tid); return t ? [t] : null; }
        case 'all': return foes.length ? foes : null;
        case 'rand': return foes.length ? foes : null;
        case 'self': return [actor];
        case 'ally': { const t = mates.find((u) => u.id === tid); return t ? [t] : null; }
        case 'allies': return mates.filter((u) => u.alive);
        default: return null;
    }
}

// ================================================================ damage
function offense(u, sk) {
    if (sk.el === 'gun') return u.st * 0.4 + u.ag * 0.6 + u.gunBonus;
    if (sk.el === 'strike') return u.st;
    return u.ma;
}
function defense(t, sk) {
    if (PHYS.has(sk.el)) return t.vi;
    return t.vi * 0.5 + t.ma * 0.5;
}

function hitChance(B, a, t, sk) {
    if (t.down || sk.acc >= 100) return 1;
    let p = sk.acc + (a.buff.agi - t.buff.agi) * 10 + (a.ag - t.ag) * 0.2 + (a.lu - t.lu) * 0.1;
    for (const q of t.pass) if (q.k === 'dodge') p -= q.v;
    return clamp(p, 20, 99) / 100;
}

function rawDamage(G, a, sk, t, mult = 1) {
    const ratio = clamp((offense(a, sk) + 6) / (defense(t, sk) + 6), 0.35, 2.6);
    let d = baseline(a.lv) * (sk.pow / 40) * Math.pow(ratio, 0.85);
    d *= 1 + 0.25 * a.buff.atk;
    d /= 1 + 0.25 * t.buff.def;
    for (const p of a.pass) if (p.k === 'amp' && p.el === sk.el) d *= 1.25;
    if (a.charge === 'phys' && PHYS.has(sk.el)) d *= 2.2;
    if (a.charge === 'mag' && !PHYS.has(sk.el)) d *= 2.2;
    if (a.side === 'e') d *= TIDES[tideOf(G.day)].foe * (G.diff || 1) * (a.atkMul || 1);
    d *= 0.92 + rand(G) * 0.16;
    return d * mult;
}

/** One hit of an attack on one target. Returns {res, dmg, crit}. Mutates hp and flags. */
function strike(G, B, a, sk, t, o = {}) {
    const el = sk.el;
    const out = { id: t.id, res: 'normal', dmg: 0, crit: false, killed: false, down: false };
    const aff = el === 'root' ? undefined : t.aff[el];
    if (!o.noMiss && rand(G) > hitChance(B, a, t, sk)) { out.res = 'miss'; return out; }
    if (aff === 'n') { out.res = 'null'; return out; }
    let crit = false;
    if (PHYS.has(el)) {
        const keen = a.pass.filter((p) => p.k === 'keen').reduce((s, p) => s + p.v, 0);
        const cc = 5 + a.lu * 0.25 + a.critBonus + (sk.crit || 0) + keen - t.lu * 0.12;
        crit = rand(G) * 100 < cc;
    }
    let dmg = rawDamage(G, a, sk, t, 1);
    if (aff === 'p') {
        out.res = 'repel';
        out.dmg = Math.max(1, Math.round(dmg));
        if (!o.reflected) {
            const back = strike(G, B, t, { ...sk, acc: 100 }, a, { reflected: true, noMiss: true });
            out.reflect = back;
        }
        return out;
    }
    if (aff === 'd') {
        out.res = 'drain';
        out.dmg = Math.max(1, Math.round(dmg));
        t.hp = Math.min(t.maxhp, t.hp + out.dmg);
        out.hp = t.hp;
        return out;
    }
    if (aff === 'w') { dmg *= AFFINITY_MULT.w; out.res = 'weak'; }
    else if (aff === 'r') { dmg *= AFFINITY_MULT.r; out.res = 'resist'; }
    if (crit) { dmg *= 1.5; out.crit = true; if (out.res === 'normal') out.res = 'crit'; }
    if (t.guard) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    out.dmg = dmg;
    t.hp -= dmg;
    if (t.hp <= 0) {
        const endure = t.pass.some((p) => p.k === 'endure') && !t.endured;
        if (endure) { t.hp = 1; t.endured = true; out.endured = true; }
        else { t.hp = 0; t.alive = false; out.killed = true; t.down = false; t.ail = null; }
    }
    out.hp = t.hp;
    if (t.alive && (out.res === 'weak' || out.crit) && !t.down) { t.down = true; out.down = true; }
    if (t.side === 'e' && el !== 'root') G.dex[t.sp].aff[el] = 1;
    // a woken rot or panic stays; damage does not wake Lag, but a killing blow clears everything
    return out;
}

function rank(res) {
    if (res === 'repel' || res === 'drain') return 3;
    if (res === 'null' || res === 'miss') return 2;
    if (res === 'weak' || res === 'crit') return 1;
    return 0;
}
const COSTS = ['normal', 'half', 'two', 'all'];

// ================================================================ using a skill
function applyAilment(G, B, a, t, ail) {
    if (!t.alive || t.ail) return null;
    let p = ail.p;
    if (t.boss) p *= 0.5;
    if (a.side === 'e' && !t.boss) p *= 1;
    if (t.down) p += 15;
    if (rand(G) * 100 >= p) return null;
    t.ail = { k: ail.k, t: AILMENTS[ail.k].turns };
    emit(G, { type: 'b_ail', id: t.id, k: ail.k });
    return ail.k;
}

function useSkill(G, B, a, sk, tid) {
    const targets = targetsOf(B, a, sk, tid);
    if (!targets) return { err: 'no such target' };
    if (sk.hp) {
        const c = Math.ceil(a.maxhp * sk.hp / 100);
        a.hp = Math.max(1, a.hp - c);
        emit(G, { type: 'b_cost', id: a.id, hp: a.hp });
    }
    if (sk.mp && a.side === 'p') { a.mp -= sk.mp; emit(G, { type: 'b_mp', id: a.id, mp: a.mp }); }
    else if (sk.mp) a.mp = Math.max(0, a.mp - Math.floor(sk.mp / 2));
    emit(G, { type: 'b_act', actor: a.id, skill: sk.id, kind: sk.kind, el: sk.el || null, targets: targets.map((t) => t.id), name: sk.name });
    let worst = 0;
    const results = [];
    if (sk.kind === 'atk') {
        let list;
        if (sk.tgt === 'rand') {
            const n = rint(G, sk.hits[0], sk.hits[1]);
            list = [];
            for (let i = 0; i < n; i++) { const alv = targets.filter((t) => t.alive); if (!alv.length) break; list.push(alv[Math.floor(rand(G) * alv.length)]); }
        } else list = targets;
        for (const t of list) {
            if (!t.alive) continue;
            const r = strike(G, B, a, sk, t);
            results.push(r);
            worst = Math.max(worst, rank(r.res));
            emit(G, { type: 'b_hit', actor: a.id, skill: sk.id, el: sk.el, ...r, maxhp: t.maxhp });
            if (r.reflect) {
                emit(G, { type: 'b_hit', actor: t.id, skill: sk.id, el: sk.el, ...r.reflect, maxhp: a.maxhp, reflected: true });
                if (!a.alive) emit(G, { type: 'b_dead', id: a.id });
            }
            if (r.res === 'drain') emit(G, { type: 'b_heal', id: t.id, amt: r.dmg, hp: t.hp, why: 'drain' });
            if (r.killed) emit(G, { type: 'b_dead', id: t.id });
            else if (r.down) emit(G, { type: 'b_down', id: t.id });
            if (!r.killed && r.res !== 'null' && r.res !== 'miss' && r.res !== 'drain' && t.alive && sk.ail && r.res !== 'repel') applyAilment(G, B, a, t, sk.ail);
            if (r.endured) emit(G, { type: 'b_endure', id: t.id });
            // counter: a physical hit on a unit with Counter strikes back
            if (t.alive && PHYS.has(sk.el) && !t.down && a.alive && r.res !== 'miss' && r.res !== 'null' && t.pass.some((p) => p.k === 'counter') && rand(G) < 0.25) {
                const cr = strike(G, B, t, SKILLS.attack, a, { reflected: true });
                emit(G, { type: 'b_hit', actor: t.id, skill: 'attack', el: 'strike', ...cr, maxhp: a.maxhp, counter: true });
                if (cr.killed) emit(G, { type: 'b_dead', id: a.id });
            }
        }
        if (a.charge && ((a.charge === 'phys') === PHYS.has(sk.el))) a.charge = null;
        // a rampaging attacker who dies (repel) ends the chain
    } else if (sk.kind === 'heal') {
        for (const t of targets) {
            if (!t.alive) continue;
            const amt = Math.max(1, Math.round(t.maxhp * sk.pow / 100 * (0.85 + a.ma / 200)));
            heal(G, t, amt, sk.id);
        }
    } else if (sk.kind === 'revive') {
        const t = targets[0];
        if (!t || t.alive) return { err: 'not fallen' };
        t.alive = true; t.down = false; t.ail = null;
        t.hp = Math.max(1, Math.round(t.maxhp * sk.pow / 100));
        emit(G, { type: 'b_revive', id: t.id, hp: t.hp });
    } else if (sk.kind === 'cure') {
        for (const t of targets) if (t.ail) { emit(G, { type: 'b_ailend', id: t.id, k: t.ail.k }); t.ail = null; }
    } else if (sk.kind === 'buff' || sk.kind === 'debuff') {
        for (const t of targets) {
            if (!t.alive) continue;
            if (sk.kind === 'debuff' && !t.down && rand(G) > clamp(0.85 + (a.lu - t.lu) * 0.004, 0.4, 0.95)) { emit(G, { type: 'b_miss', id: t.id }); continue; }
            t.buff[sk.stat] = clamp(t.buff[sk.stat] + sk.stage, -2, 2);
            t.bt[sk.stat] = t.buff[sk.stat] === 0 ? 0 : 3;
            emit(G, { type: 'b_buff', id: t.id, stat: sk.stat, stage: t.buff[sk.stat] });
        }
    } else if (sk.kind === 'ail') {
        for (const t of targets) {
            if (!t.alive) continue;
            const hit = applyAilment(G, B, a, t, sk.ail);
            if (!hit) emit(G, { type: 'b_miss', id: t.id });
            worst = Math.max(worst, hit ? 0 : 0);
        }
    } else if (sk.kind === 'scan') {
        for (const t of targets) {
            if (t.side === 'e') { const d = G.dex[t.sp]; for (const el of Object.keys(t.aff)) d.aff[el] = 1; d.pers = true; d.scanned = 1; }
            emit(G, { type: 'b_scan', id: t.id });
        }
    } else if (sk.kind === 'charge') { a.charge = 'phys'; emit(G, { type: 'b_charge', id: a.id, k: 'phys' }); }
    else if (sk.kind === 'focus') { a.charge = 'mag'; emit(G, { type: 'b_charge', id: a.id, k: 'mag' }); }
    else if (sk.kind === 'dispel') {
        for (const t of targets) { t.buff = { atk: 0, def: 0, agi: 0 }; t.bt = { atk: 0, def: 0, agi: 0 }; emit(G, { type: 'b_buff', id: t.id, stat: 'all', stage: 0 }); }
    }
    return { cost: COSTS[worst], results };
}

// ================================================================ the Agent's and the foes' choices
function foeDecision(G, B, u) {
    const foes = alive(B, 'p');
    const mates = alive(B, 'e');
    if (!foes.length) return null;
    const affW = (t, el) => ({ w: 2.2, r: 0.35, n: 0.05, p: 0.03, d: 0.03 }[el === 'root' ? '' : t.aff[el]] ?? 1);
    const opts = [];
    const ids = u.skills.filter((id) => !usable(B, u, SKILLS[id]));
    if (!ids.includes('attack')) ids.push('attack');
    for (const id of ids) {
        const sk = SKILLS[id];
        const uniq = u.boss && sk.unique ? 1.7 : 1;
        if (sk.kind === 'atk') {
            if (sk.tgt === 'one') {
                for (const t of foes) opts.push({ id, tid: t.id, w: 1.0 * uniq * affW(t, sk.el) * (t.down ? 1.1 : 1) * (t.agent ? 1.15 : 1) * (t.hp / t.maxhp < 0.4 ? 1.3 : 1) });
            } else {
                const avg = foes.reduce((s, t) => s + affW(t, sk.el), 0) / foes.length;
                opts.push({ id, tid: -1, w: 1.0 * uniq * avg * (foes.length > 1 ? 1.5 : 0.9) });
            }
        } else if (sk.kind === 'heal') {
            const hurt = mates.filter((m) => m.hp / m.maxhp < 0.5).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp);
            if (hurt.length && (!u.boss || hurt[0].hp / hurt[0].maxhp < 0.3)) opts.push({ id, tid: sk.tgt === 'allies' ? -1 : hurt[0].id, w: u.boss ? 1.2 : 3.2 });
        } else if (sk.kind === 'revive') {
            const dead = B.units.filter((m) => m.side === 'e' && !m.alive && !m.boss);
            if (dead.length) opts.push({ id, tid: dead[0].id, w: 2.5 });
        } else if (sk.kind === 'buff') {
            const cand = mates.filter((m) => m.buff[sk.stat] < 1);
            if (cand.length && u.turns < 5) opts.push({ id, tid: sk.tgt === 'allies' ? -1 : pick(G, cand).id, w: 0.8 });
        } else if (sk.kind === 'debuff') {
            const cand = foes.filter((m) => m.buff[sk.stat] > -1);
            if (cand.length) opts.push({ id, tid: sk.tgt === 'all' ? -1 : pick(G, cand).id, w: 0.7 });
        } else if (sk.kind === 'ail') {
            const cand = foes.filter((m) => !m.ail);
            if (cand.length) opts.push({ id, tid: sk.tgt === 'all' ? -1 : pick(G, cand).id, w: 0.8 });
        } else if (sk.kind === 'charge' || sk.kind === 'focus') {
            if (!u.charge) opts.push({ id, tid: u.id, w: 0.45 });
        } else if (sk.kind === 'dispel') {
            const cand = foes.filter((m) => m.buff.atk > 0 || m.buff.def > 0 || m.buff.agi > 0);
            if (cand.length) opts.push({ id, tid: cand[0].id, w: 1.6 });
        }
    }
    if (!opts.length) { const t = pick(G, foes); return { id: 'attack', tid: t.id }; }
    const tot = opts.filter((o) => o.w > 0);
    if (!tot.length) return { id: 'attack', tid: pick(G, foes).id };
    return wpick(G, tot.map((o) => [o, o.w]));
}

/** Run the foes' phase, action by action, until the party is up again or the battle ends. */
export function runEnemies(G) {
    const B = G.battle;
    let guard = 0;
    while (B && !B.result && B.phase === 'e' && guard++ < 80) {
        if (B.actor < 0) { beginPhase(G, 'p'); break; }
        const u = unitOf(B, B.actor);
        foeTurn(G, B, u);
    }
    if (B && B.phase === 'p' && !B.result) { updateAllOut(G); emit(G, { type: 'b_ready', actor: B.actor }); }
    else if (B && B.result) { /* ended */ }
}

function foeTurn(G, B, u) {
    // boss rage at half health
    if (u.boss && !u.rage && u.hp / u.maxhp <= 0.5) {
        u.rage = true;
        u.buff.atk = Math.min(2, u.buff.atk + 1); u.bt.atk = 99;
        emit(G, { type: 'b_rage', id: u.id });
        emit(G, { type: 'b_buff', id: u.id, stat: 'atk', stage: u.buff.atk });
    }
    if (u.ail && u.ail.k === 'lag') {
        emit(G, { type: 'b_skip', id: u.id, why: 'lag' });
        finishAction(G, 'normal');
        return;
    }
    if (u.ail && u.ail.k === 'panic') {
        const all = B.units.filter((x) => x.alive && x.id !== u.id);
        const t = pick(G, all);
        const r = useSkill(G, B, u, SKILLS.attack, t.id);
        finishAction(G, r.cost || 'normal');
        return;
    }
    const d = foeDecision(G, B, u);
    if (!d) { finishAction(G, 'normal'); return; }
    const sk = SKILLS[d.id];
    let tid = d.tid;
    if (tid === -1) tid = -1;
    const r = useSkill(G, B, u, sk, tid);
    finishAction(G, r.err ? 'normal' : r.cost);
}

// ================================================================ the party's commands
/**
 * cmd: { kind: 'skill', skill, target } | { kind: 'attack', target } | { kind: 'item', item, target }
 *      | { kind: 'guard' } | { kind: 'swap', out, uid } | { kind: 'allout' } | { kind: 'flee' }
 *      | { kind: 'recode', target } | { kind: 'neg', op: 'script'|'gift'|'accept'|'refuse'|'leave', i, item }
 */
export function battleCommand(G, cmd) {
    const B = G.battle;
    if (!B || B.result) return 'no battle';
    if (B.phase !== 'p') return 'not your turn';
    if (B.neg && cmd.kind !== 'neg') return 'finish the conversation first';
    const a = unitOf(B, B.actor);
    if (!a || !a.alive) return 'no one to act';
    let err = '';
    switch (cmd.kind) {
        case 'attack': return doSkill(G, B, a, SKILLS.attack, cmd.target);
        case 'skill': {
            const sk = SKILLS[cmd.skill];
            if (!a.skills.includes(cmd.skill)) return 'it does not know that';
            err = usable(B, a, sk);
            if (err) return err;
            return doSkill(G, B, a, sk, cmd.target);
        }
        case 'item': return doItem(G, B, a, cmd);
        case 'guard': {
            a.guard = true;
            emit(G, { type: 'b_guard', id: a.id });
            finishAction(G, 'half');
            runEnemies(G);
            return '';
        }
        case 'swap': return doSwap(G, B, a, cmd);
        case 'allout': return doAllOut(G, B);
        case 'flee': return doFlee(G, B, a, false);
        case 'recode': return startRecode(G, B, a, cmd.target);
        case 'neg': return negotiate(G, B, a, cmd);
        default: return 'unknown command';
    }
}

function doSkill(G, B, a, sk, tid) {
    if (a.ail && a.ail.k === 'lag') { emit(G, { type: 'b_skip', id: a.id, why: 'lag' }); finishAction(G, 'normal'); return ''; }
    if (a.ail && a.ail.k === 'panic') {
        const all = B.units.filter((x) => x.alive && x.id !== a.id);
        tid = pick(G, all).id;
        sk = SKILLS.attack;
    }
    // a skill aimed at the wrong side is refused before anything is spent
    if (['one', 'all', 'rand'].includes(sk.tgt)) { if (tid >= 0 && tid !== undefined && sk.tgt === 'one') { const t = unitOf(B, tid); if (!t || !t.alive || t.side !== 'e') { if (!(a.ail && a.ail.k === 'panic')) return 'pick a foe'; } } }
    if (['ally'].includes(sk.tgt)) {
        const t = unitOf(B, tid);
        if (!t || t.side !== 'p') return 'pick an ally';
        if (sk.kind === 'revive' && t.alive) return 'that ally is standing';
        if (sk.kind !== 'revive' && !t.alive) return 'that ally has fallen';
    }
    const r = useSkill(G, B, a, sk, tid);
    if (r.err) return r.err;
    finishAction(G, r.cost);
    runEnemies(G);
    return '';
}

function doItem(G, B, a, cmd) {
    const it = ITEMS[cmd.item];
    if (!it || (G.items[cmd.item] || 0) <= 0) return 'none left';
    if (it.id === 'smoke') return doFlee(G, B, a, true);
    if (it.use === 'field') return 'not usable here';
    const t = unitOf(B, cmd.target);
    if (it.kind === 'heal' || it.kind === 'mp' || it.kind === 'cure') {
        if (!t || t.side !== 'p' || !t.alive) return 'pick a living ally';
        G.items[it.id]--;
        emit(G, { type: 'b_act', actor: a.id, skill: it.id, kind: 'item', el: null, targets: [t.id], name: it.name });
        if (it.kind === 'heal') { heal(G, t, Math.round(t.maxhp * it.pct / 100), it.id); if (it.cure && t.ail) { emit(G, { type: 'b_ailend', id: t.id, k: t.ail.k }); t.ail = null; } }
        else if (it.kind === 'mp') { t.mp = Math.min(t.maxmp, t.mp + it.amt); emit(G, { type: 'b_mp', id: t.id, mp: t.mp }); }
        else if (t.ail) { emit(G, { type: 'b_ailend', id: t.id, k: t.ail.k }); t.ail = null; }
    } else if (it.kind === 'revive') {
        if (!t || t.side !== 'p' || t.alive) return 'pick a fallen ally';
        G.items[it.id]--;
        emit(G, { type: 'b_act', actor: a.id, skill: it.id, kind: 'item', el: null, targets: [t.id], name: it.name });
        t.alive = true; t.down = false; t.ail = null; t.hp = Math.max(1, Math.round(t.maxhp * it.pct / 100));
        emit(G, { type: 'b_revive', id: t.id, hp: t.hp });
    } else if (it.kind === 'bomb') {
        const foes = alive(B, 'e');
        G.items[it.id]--;
        emit(G, { type: 'b_act', actor: a.id, skill: it.id, kind: 'item', el: it.el, targets: foes.map((f) => f.id), name: it.name });
        let worst = 0;
        for (const f of foes) {
            if (it.pow) {
                const fake = { ...SKILLS.attack, el: it.el, pow: it.pow, acc: 100, id: it.id };
                const r = strike(G, B, { ...a, ma: Math.max(a.ma, 10 + a.lv), st: a.st, pass: [], buff: { atk: 0, def: 0, agi: 0 }, charge: null, lv: a.lv, side: 'p', critBonus: 0, lu: a.lu, ag: a.ag, gunBonus: 0 }, fake, f, { noMiss: true });
                worst = Math.max(worst, rank(r.res));
                emit(G, { type: 'b_hit', actor: a.id, skill: it.id, el: it.el, ...r, maxhp: f.maxhp });
                if (r.killed) emit(G, { type: 'b_dead', id: f.id }); else if (r.down) emit(G, { type: 'b_down', id: f.id });
            }
            if (it.ail && f.alive) applyAilment(G, B, a, f, it.ail);
        }
        finishAction(G, COSTS[worst]);
        runEnemies(G);
        return '';
    } else return 'not usable here';
    finishAction(G, 'normal');
    runEnemies(G);
    return '';
}

function doSwap(G, B, a, cmd) {
    const out = unitOf(B, cmd.out);
    if (!out || out.side !== 'p' || out.agent) return 'cannot swap that one';
    const inc = G.stock.find((u) => u.uid === cmd.uid);
    if (!inc || G.party.includes(inc.uid) || inc.hp <= 0) return 'pick a rested daemon';
    // write the leaver back, bring the newcomer in at the same slot
    const src = G.stock.find((u) => u.uid === out.ref);
    if (src) { src.hp = Math.max(out.alive ? 1 : 0, out.hp); src.mp = out.mp; }
    G.party = G.party.map((uid) => (uid === out.ref ? inc.uid : uid));
    const nu = makeUnit(G, B, 'p', inc);
    nu.id = out.id;
    B.units[out.id] = nu;
    nu.alive = true;
    emit(G, { type: 'b_swap', id: out.id, unit: brief(nu) });
    // the newcomer has no turn this cycle
    B.queue = B.queue.filter((id) => id !== out.id);
    const wasActor = B.actor === out.id;
    if (wasActor) B.actor = -1;
    spend(B, 'half');
    emit(G, { type: 'b_icons', side: 'p', icons: { ...B.icons }, cost: 'half' });
    if (B.icons.f + B.icons.h <= 0) { beginPhase(G, 'e'); runEnemies(G); return ''; }
    if (wasActor || !pickActor(G)) { if (!pickActor(G)) { beginPhase(G, 'e'); runEnemies(G); } }
    return '';
}

function doAllOut(G, B) {
    if (!B.allOut) return 'not all foes are down';
    const mine = alive(B, 'p');
    emit(G, { type: 'b_allout', ids: mine.map((u) => u.id) });
    for (const a of mine) {
        for (const t of alive(B, 'e')) {
            const sk = { ...SKILLS.attack, el: 'root', pow: 46, acc: 100, id: 'allout' };
            let d = baseline(a.lv) * (46 / 40) * 0.9 * (0.92 + rand(G) * 0.16);
            d *= Math.pow(clamp((Math.max(a.st, a.ma) + 6) / (t.vi + 6), 0.5, 2), 0.6);
            d = Math.max(1, Math.round(d * (1 + bondPerk(G, 'ilsa', 'allout'))));
            t.hp -= d;
            const r = { id: t.id, res: 'allout', dmg: d, killed: false };
            if (t.hp <= 0) { t.hp = 0; t.alive = false; t.down = false; r.killed = true; }
            r.hp = t.hp;
            emit(G, { type: 'b_hit', actor: a.id, skill: 'allout', el: 'root', ...r, maxhp: t.maxhp });
            if (r.killed) emit(G, { type: 'b_dead', id: t.id });
        }
    }
    for (const t of alive(B, 'e')) { if (t.down) { t.down = false; emit(G, { type: 'b_stand', id: t.id }); } }
    finishAction(G, bondPerk(G, 'ilsa', 'alloutHalf') ? 'half' : 'normal');
    runEnemies(G);
    return '';
}

function doFlee(G, B, a, sure) {
    if (!B.canFlee) return 'there is no running from this';
    if (sure) G.items.smoke--;
    const mine = alive(B, 'p'), theirs = alive(B, 'e');
    const avg = (l) => l.reduce((s, u) => s + u.ag, 0) / l.length;
    const p = FLEE_BASE + (avg(mine) - avg(theirs)) * 0.01 + B.fleeTries * 0.12;
    B.fleeTries++;
    if (sure || rand(G) < clamp(p, 0.2, 0.95)) {
        emit(G, { type: 'b_msg', text: 'Got away safely!' });
        endBattle(G, 'flee');
        return '';
    }
    emit(G, { type: 'b_msg', text: 'Couldn\'t get away!' });
    finishAction(G, 'normal');
    runEnemies(G);
    return '';
}

// ================================================================ recoding
export function recodeInfo(G, B, t) {
    const agent = B.units.find((u) => u.agent);
    if (!t || t.side !== 'e' || !t.alive) return { ok: false, why: 'pick a foe' };
    if (t.boss || DAEMONS[t.sp].boss || DAEMONS[t.sp].special) return { ok: false, why: 'its code is too deep to patch from here' };
    if (t.noRecode) return { ok: false, why: 'the link was cut' };
    if (G.stock.length >= STOCK_MAX) return { ok: false, why: 'the Greenhouse is full' };
    if (t.lv > agent.lv + 6) return { ok: false, why: 'it is far beyond your clearance' };
    return { ok: true, need: NEED + (t.lv > agent.lv + 2 ? 1 : 0) };
}

function startRecode(G, B, a, tid) {
    const t = unitOf(B, tid);
    const info = recodeInfo(G, B, t);
    if (!info.ok) return info.why;
    const start = clamp(TIDES[tideOf(G.day)].recode + (t.down ? 1 : 0) + (t.hp / t.maxhp < 0.5 ? 1 : 0) + bondPerk(G, 'wren', 'rapport') + ((G.dex[t.sp].recoded || 0) > 0 ? 1 : 0), -1, 2);
    const neg = { tid, rapport: start, need: info.need, tries: 0, patience: PATIENCE, demand: null, pers: t.pers, last: null, ended: null, line: tellOf(t.pers), asked: false };
    B.neg = neg;
    if (!G.dex[t.sp].pers && (G.dex[t.sp].recoded || 0) > 0) G.dex[t.sp].pers = true;
    // the first exchange costs the turn
    spend(B, 'normal');
    emit(G, { type: 'b_icons', side: 'p', icons: { ...B.icons }, cost: 'normal' });
    maybeDemand(G, B, t, neg);
    emit(G, { type: 'b_neg', neg: negView(neg) });
    return '';
}

function maybeDemand(G, B, t, neg) {
    if (neg.demand || neg.asked || rand(G) > 0.32) return;
    neg.asked = true;
    const k = wpick(G, [['item', 3], ['scrap', 3], ['hp', 1.5], ['mp', 1.5]]);
    if (k === 'item') neg.demand = { kind: 'item', id: PERSONALITIES[t.pers].likes, n: 1 };
    else if (k === 'scrap') neg.demand = { kind: 'scrap', n: Math.max(20, t.lv * 14) };
    else if (k === 'hp') neg.demand = { kind: 'hp', n: 20 };
    else neg.demand = { kind: 'mp', n: Math.max(6, Math.round(t.lv * 0.8)) };
    neg.line = demandLine(neg.demand);
}

export const negView = (n) => ({ tid: n.tid, rapport: n.rapport, need: n.need, tries: n.tries, patience: n.patience, demand: n.demand, line: n.line, last: n.last, ended: n.ended });

function negotiate(G, B, a, cmd) {
    const neg = B.neg;
    if (!neg || neg.ended) return 'no conversation';
    const t = unitOf(B, neg.tid);
    const agentU = B.units.find((u) => u.agent);
    const react = (delta) => { neg.last = delta; neg.line = reactLine(delta, neg.tries + t.id); };
    const finish = (how) => {
        neg.ended = how;
        emit(G, { type: 'b_neg', neg: negView(neg) });
        B.neg = null;
        if (how === 'success') {
            const u = newDaemon(G, t.sp, t.lv);
            u.hp = u.hp; G.stock.push(u);
            const dex = G.dex[t.sp];
            dex.recoded = (dex.recoded || 0) + 1; dex.pers = true;
            t.alive = false; t.hp = 0; t.recoded = true;
            B.gained.push({ uid: u.uid, sp: t.sp, name: t.name, lv: t.lv });
            emit(G, { type: 'b_recoded', id: t.id, uid: u.uid, sp: t.sp, name: t.name });
        } else if (how === 'severed') {
            t.noRecode = true;
            t.buff.atk = Math.min(2, t.buff.atk + 1); t.bt.atk = 4;
            emit(G, { type: 'b_buff', id: t.id, stat: 'atk', stage: t.buff.atk });
        } else if (how === 'bored') {
            t.alive = false; t.hp = 0; t.fled = true;
            emit(G, { type: 'b_flee', id: t.id });
        }
    };
    const resolve = () => {
        if (neg.rapport >= neg.need) { finish('success'); }
        else if (neg.rapport <= -2) { finish('severed'); }
        else if (neg.tries >= neg.patience) { finish('bored'); }
        else {
            if (rand(G) < 0.12) maybeDemand(G, B, t, neg);
            emit(G, { type: 'b_neg', neg: negView(neg) });
            return;
        }
        // the conversation is over: success or not, the turn has already been paid for
        if (!checkEnd(G)) {
            if (B.icons.f + B.icons.h <= 0) { beginPhase(G, 'e'); runEnemies(G); }
            else if (!B.queue.length || B.queue.every((id) => !B.units[id].alive)) { pickActor(G); }
            else { B.queue = B.queue.filter((id) => B.units[id].alive && !B.units[id].down); if (!B.queue.length) pickActor(G); else { B.actor = B.queue[0]; updateAllOut(G); } }
            if (B.phase === 'e') runEnemies(G);
            else emit(G, { type: 'b_ready', actor: B.actor });
        }
    };
    if (cmd.op === 'leave') { neg.ended = 'left'; emit(G, { type: 'b_neg', neg: negView(neg) }); B.neg = null; finishNegTurn(G, B); return ''; }
    if (neg.demand) {
        if (cmd.op === 'accept') {
            const d = neg.demand;
            if (d.kind === 'item') { if ((G.items[d.id] || 0) < 1) return 'you do not have one'; G.items[d.id]--; }
            else if (d.kind === 'scrap') { if (G.scrap < d.n) return 'not enough Scrap'; G.scrap -= d.n; }
            else if (d.kind === 'hp') { const c = Math.ceil(agentU.maxhp * d.n / 100); if (agentU.hp <= c) return 'you cannot spare it'; agentU.hp -= c; emit(G, { type: 'b_cost', id: agentU.id, hp: agentU.hp }); }
            else if (d.kind === 'mp') { if (agentU.mp < d.n) return 'not enough MP'; agentU.mp -= d.n; }
            neg.demand = null; neg.rapport += 2; neg.tries++;
            react(2);
            resolve();
            return '';
        }
        if (cmd.op === 'refuse') {
            neg.demand = null; neg.rapport -= 1; neg.tries++;
            react(-1);
            resolve();
            return '';
        }
        return 'it wants an answer first';
    }
    if (cmd.op === 'script') {
        const i = cmd.i | 0;
        if (i < 0 || i >= SCRIPTS.length) return 'unknown script';
        const delta = RAPPORT[neg.pers][i];
        neg.rapport += delta; neg.tries++;
        react(delta);
        resolve();
        return '';
    }
    if (cmd.op === 'gift') {
        const it = ITEMS[cmd.item];
        if (!it || it.kind !== 'gift' || (G.items[cmd.item] || 0) < 1) return 'no such gift';
        G.items[cmd.item]--;
        const delta = PERSONALITIES[neg.pers].likes === cmd.item ? 2 : 1;
        neg.rapport += delta; neg.tries++;
        react(delta);
        resolve();
        return '';
    }
    return 'unknown reply';
}

function finishNegTurn(G, B) {
    if (checkEnd(G)) return;
    if (B.icons.f + B.icons.h <= 0) { beginPhase(G, 'e'); runEnemies(G); return; }
    B.queue = B.queue.filter((id) => B.units[id].alive && !B.units[id].down);
    if (!B.queue.length) pickActor(G); else { B.actor = B.queue[0]; updateAllOut(G); }
    emit(G, { type: 'b_ready', actor: B.actor });
}

// ================================================================ the end
export function xpFor(foe, avgLv) {
    const base = 10 + foe.lv * 5.4;
    const catchUp = clamp(Math.pow(foe.lv / Math.max(1, avgLv), 0.8), 0.5, 1.8);
    return Math.round(base * catchUp * (foe.boss ? 2.5 : foe.elite ? 1.6 : 1));
}

function endBattle(G, result) {
    const B = G.battle;
    B.result = result;
    // write hp and mp back
    for (const u of B.units.filter((x) => x.side === 'p')) {
        const src = findUnit(G, u.ref);
        if (!src) continue;
        src.hp = u.alive ? u.hp : 1;
        src.mp = u.mp;
    }
    for (const u of B.units.filter((x) => x.side === 'e' && !x.alive && !x.recoded && !x.fled)) B.kills.push({ sp: u.sp, lv: u.lv, boss: u.boss, elite: u.elite, race: u.race });
    if (result === 'win') {
        const party = partyUnits(G);
        const avgLv = party.reduce((s, u) => s + u.lv, 0) / party.length;
        let xp = 0, scrap = 0;
        const items = {};
        for (const k of B.kills) {
            xp += xpFor(k, avgLv);
            scrap += Math.round((k.lv * 4.2 + 8) * (0.8 + rand(G) * 0.4) * (k.boss ? 3 : k.elite ? 1.8 : 1));
            if (rand(G) < (k.boss ? 1 : k.elite ? 0.4 : 0.16)) { const it = pick(G, LOOT[k.race] || ['patch']); items[it] = (items[it] || 0) + 1; }
        }
        xp = Math.round(xp * B.rewardMul * (1 + bondPerk(G, 'dov', 'xp')));
        scrap = Math.round(scrap * B.rewardMul * (1 + bondPerk(G, 'quill', 'scrap')));
        for (const b of B.gained) xp += 0;
        G.scrap += scrap;
        for (const [k, n] of Object.entries(items)) G.items[k] = (G.items[k] || 0) + n;
        const reward = { xp, scrap, items, units: [], gained: [...B.gained], kind: B.kind, tag: B.tag };
        const active = new Set(party.map((u) => u.uid));
        for (const u of [G.agent, ...G.stock]) {
            const act = active.has(u.uid);
            const bu = B.units.find((x) => x.ref === u.uid);
            const share = act ? (bu && !bu.alive ? 0.5 : 1) : 0.4;
            const amt = Math.round(xp * share);
            if (!amt) continue;
            const before = u.lv;
            const r = gainXp(G, u, amt);
            const learned = [];
            for (const sk of r.learn) { const got = offerSkill(G, u, sk); learned.push({ skill: sk, learned: got }); }
            if (act || r.levels.length) reward.units.push({ uid: u.uid, name: u.name, sp: u.sp, xp: amt, from: before, to: u.lv, learned, active: act });
        }
        G.reward = reward;
        G.phase = 'reward';
        for (const k of B.kills) { const d = G.dex[k.sp]; d.killed = (d.killed || 0) + 1; }
    } else if (result === 'lose') {
        G.phase = 'defeat';
    } else {
        G.phase = 'afterbattle';
        G.reward = null;
    }
    emit(G, { type: 'b_end', result, kind: B.kind });
}
