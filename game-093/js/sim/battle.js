// The turn-based battle engine: shields and Break, Boost Points, turn order, statuses, charged moves, boss phases.
// Pure. A player command resolves at once and every enemy turn that follows it is resolved in the same call; the
// view plays the resulting events (b_*) in order, each carrying a snapshot so the HUD can follow the animation.

import { SKILLS, CHARS, WEAK_TYPES, skillsAt } from './data/classes.js';
import { ENEMIES, MOVES, ZONES, enemyStats, enemyXp, enemyGold } from './data/enemies.js';
import { ITEMS } from './data/items.js';
import { memberStats, immunities, gainXp, clampHpMp, addItem, removeItem, count } from './party.js';
import { MAX_BP, MAX_BOOST, MAX_ACTIVE } from '../config.js';

export const BREAK_MULT = 1.5, WEAK_MULT = 1.25, CRIT_MULT = 1.5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const skillOf = (id) => SKILLS[id] || MOVES[id];

// ---------------------------------------------------------------- setup
function partyUnit(G, m, idx) {
    const s = memberStats(m);
    return {
        id: 'p' + idx, side: 'party', idx, ref: m.id, name: CHARS[m.id].name, lvl: m.lvl, hp: m.hp, mhp: s.mhp, mp: m.mp, mmp: s.mmp,
        atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd, weaponType: s.weaponType, status: {}, bp: 0, broken: false, lostTurn: false,
        shield: 0, mshield: 0, weak: [], resist: [], revealed: new Set(), guard: false, charge: null, imm: immunities(m), scale: 1,
    };
}

function enemyUnit(G, kind, lvl, idx) {
    const e = ENEMIES[kind], s = enemyStats(kind, lvl);
    const known = G.bestiary[kind]?.weak || [];
    return {
        id: 'e' + idx, side: 'enemy', idx, ref: kind, name: e.name, lvl, hp: s.hp, mhp: s.hp, mp: 999, mmp: 999, atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd,
        status: {}, bp: 0, broken: false, lostTurn: false, shield: e.shield, mshield: e.shield, weak: [...e.weak], resist: [...e.resist],
        revealed: new Set(known), guard: false, charge: null, imm: [], scale: e.scale, boss: e.boss, phase: 0, stolen: false, sprite: e.sprite, pal: e.pal,
    };
}

export function makeFormation(G, zone, rng = G.rng) {
    const z = ZONES[zone];
    const kinds = rng.pick(z.forms);
    return kinds.map((k) => ({ kind: k, lvl: rng.int(z.lvl[0], z.lvl[1]) }));
}

/** spec: { enemies:[{kind,lvl}], bg, boss, noFlee, music, script:{endRound}, win:sceneId } */
export function startBattle(G, spec) {
    const units = [];
    G.party.active.forEach((id, i) => units.push(partyUnit(G, G.party.members[id], i)));
    spec.enemies.slice(0, 5).forEach((e, i) => units.push(enemyUnit(G, e.kind, e.lvl, i)));
    const B = {
        units, round: 0, queue: [], actor: null, phase: 'cmd', bg: spec.bg || 'grass', boss: !!spec.boss, noFlee: !!spec.noFlee || !!spec.boss,
        music: spec.music || (spec.boss ? 'boss' : 'battle'), script: spec.script || null, win: spec.win || null, spec,
        log: [], rewards: null, result: null, started: false,
    };
    G.battle = B;
    G.mode = 'battle';
    for (const u of units) if (u.side === 'enemy') { const b = G.bestiary[u.ref] || (G.bestiary[u.ref] = { seen: 0, weak: [] }); b.seen++; }
    G.events.push({ type: 'b_start', boss: B.boss, bg: B.bg, music: B.music, units: units.map(describe), snap: snap(B) });
    for (const u of units) if (u.side === 'party') u.bp = 0;
    advance(G);
    return B;
}

export const describe = (u) => ({ id: u.id, side: u.side, ref: u.ref, name: u.name, lvl: u.lvl, mhp: u.mhp, mmp: u.mmp, mshield: u.mshield, scale: u.scale, boss: !!u.boss, sprite: u.sprite, pal: u.pal, idx: u.idx });

export function snap(B) {
    return B.units.map((u) => ({
        id: u.id, hp: u.hp, mp: u.mp, bp: u.bp, sh: u.shield, msh: u.mshield, br: u.broken, ch: u.charge ? u.charge.turns : 0,
        st: Object.keys(u.status), rev: u.side === 'enemy' ? [...u.revealed] : null, nw: u.side === 'enemy' ? u.weak.length : 0, mhp: u.mhp,
    }));
}

const alive = (u) => u.hp > 0;
export const living = (B, side) => B.units.filter((u) => u.side === side && alive(u));
const unitById = (B, id) => B.units.find((u) => u.id === id);

// ---------------------------------------------------------------- stats with statuses
function sm(u, k) {
    const s = u.status;
    if (k === 'atk' || k === 'mag') return u[k] * (s.atkUp ? 1.3 : 1) * (s.atkDown ? 0.7 : 1);
    if (k === 'def' || k === 'res') return u[k] * (s.defUp ? 1.35 : 1) * (s.defDown ? 0.7 : 1);
    if (k === 'spd') return u.spd * (s.haste ? 1.5 : 1) * (s.slow ? 0.6 : 1);
    return u[k];
}

// ---------------------------------------------------------------- turn order
function newRound(G) {
    const B = G.battle;
    B.round++;
    const order = B.units.filter(alive).map((u) => ({ id: u.id, k: sm(u, 'spd') + G.rng() * 2.5 }));
    order.sort((a, b) => b.k - a.k);
    B.queue = order.map((o) => o.id);
}

/** The next turns, for the timeline: the rest of this round, then the next round's likely order. */
export function turnPreview(B, n = 9) {
    const out = B.queue.filter((id) => alive(unitById(B, id)));
    const next = B.units.filter(alive).sort((a, b) => sm(b, 'spd') - sm(a, 'spd')).map((u) => u.id);
    while (out.length < n && next.length) out.push(...next);
    return out.slice(0, n);
}

function checkEnd(G) {
    const B = G.battle;
    if (B.result) return true;
    if (!living(B, 'enemy').length) return finish(G, 'victory');
    if (!living(B, 'party').length) return finish(G, 'defeat');
    return false;
}

function finish(G, result) {
    const B = G.battle;
    B.result = result;
    B.phase = result;
    let rewards = null;
    if (result === 'victory') {
        let xp = 0, gold = 0; const drops = [];
        for (const u of B.units) {
            if (u.side !== 'enemy' || u.summoned) continue;
            xp += enemyXp(u.ref, u.lvl); gold += enemyGold(u.ref, u.lvl);
            const e = ENEMIES[u.ref];
            for (const [it, p] of e.drops) if (G.rng() < p) drops.push(it);
            if (e.mat && G.rng() < 0.35) drops.push(e.mat);
        }
        if (B.spec.noRewards) { xp = 0; gold = 0; drops.length = 0; }
        rewards = { xp, gold, drops, levelups: [] };
    }
    // write the fight back to the party
    for (const u of B.units) {
        if (u.side !== 'party') continue;
        const m = G.party.members[u.ref];
        m.hp = Math.max(result === 'victory' && u.hp <= 0 ? 0 : u.hp, 0); m.mp = u.mp;
        clampHpMp(m);
    }
    if (rewards) {
        G.gold += rewards.gold;
        const ids = [...G.party.active, ...G.party.reserve];
        for (const id of ids) {
            const m = G.party.members[id];
            const isActive = G.party.active.includes(id);
            if (m.hp <= 0 && isActive) continue;
            const share = Math.round(rewards.xp * (isActive ? 1 : 0.6));
            rewards.levelups.push(...gainXp(m, share));
            if (isActive) m.kills++;
        }
        for (const d of rewards.drops) addItem(G, d, 1);
    }
    B.rewards = rewards;
    G.events.push({ type: 'b_end', result, rewards, snap: snap(B) });
    return true;
}

// ---------------------------------------------------------------- main loop
/** Run turns until a party member must choose, or the fight ends. */
export function advance(G) {
    const B = G.battle;
    let guard = 0;
    while (guard++ < 400) {
        if (checkEnd(G)) return;
        if (!B.queue.length) {
            if (B.script?.endRound && B.round >= B.script.endRound) { finish(G, 'script'); return; }
            newRound(G);
            G.events.push({ type: 'b_round', round: B.round });
        }
        const id = B.queue.shift();
        const u = unitById(B, id);
        if (!u || !alive(u)) continue;
        u.guard = false;
        // sleeping or stunned: the turn is lost
        if (u.status.sleep) {
            G.events.push({ type: 'b_skip', id: u.id, reason: 'sleep', snap: snap(B) });
            endTurn(G, u);
            continue;
        }
        if (u.lostTurn) {
            u.lostTurn = false;
            G.events.push({ type: 'b_skip', id: u.id, reason: 'break', snap: snap(B) });
            u.broken = false; u.shield = u.mshield;
            G.events.push({ type: 'b_recover', id: u.id, snap: snap(B) });
            endTurn(G, u);
            continue;
        }
        // poison and regen tick before acting
        if (!tick(G, u)) { if (checkEnd(G)) return; continue; }
        if (u.side === 'party') {
            u.bp = Math.min(MAX_BP, u.bp + 1);
            B.actor = u.id; B.phase = 'cmd';
            G.events.push({ type: 'b_turn', actor: u.id, order: turnPreview(B), round: B.round, snap: snap(B) });
            return;
        }
        enemyTurn(G, u);
        endTurn(G, u);
    }
    throw new Error('battle loop did not settle');
}

function endTurn(G, u) {
    for (const k of Object.keys(u.status)) {
        u.status[k]--;
        if (u.status[k] <= 0) delete u.status[k];
    }
}

/** poison / regen; false if the unit died of it */
function tick(G, u) {
    const B = G.battle;
    if (u.status.poison) {
        const d = Math.max(1, Math.round(u.mhp * (u.boss ? 0.03 : 0.06)));
        u.hp = Math.max(0, u.hp - d);
        G.events.push({ type: 'b_tick', id: u.id, kind: 'poison', amount: d, snap: snap(B) });
        if (u.hp <= 0) { koCleanup(B, u); return false; }
    }
    if (u.status.regen) {
        const h = Math.round(u.mhp * 0.1);
        u.hp = Math.min(u.mhp, u.hp + h);
        G.events.push({ type: 'b_tick', id: u.id, kind: 'regen', amount: h, snap: snap(B) });
    }
    return true;
}

function koCleanup(B, u) {
    u.status = {}; u.charge = null; u.broken = false;
}

// ---------------------------------------------------------------- statuses
const OPPOSITE = { haste: 'slow', slow: 'haste', atkUp: 'atkDown', atkDown: 'atkUp', defUp: 'defDown', defDown: 'defUp' };
function applyStatus(G, src, tgt, name, chance, turns) {
    if (!alive(tgt)) return false;
    if (tgt.imm.includes(name)) return false;
    let p = chance;
    if (tgt.boss && (name === 'sleep' || name === 'slow' || name === 'poison')) p *= name === 'poison' ? 0.7 : 0.35;
    if (p < 1 && G.rng() >= p) return false;
    if (OPPOSITE[name]) delete tgt.status[OPPOSITE[name]];
    tgt.status[name] = turns + (src === tgt ? 1 : 0);
    return true;
}

// ---------------------------------------------------------------- one strike
function weaponTypeOf(u) { return u.side === 'party' ? u.weaponType : null; }

function dealHit(G, att, tgt, sk, opts) {
    const B = G.battle;
    const hit = { t: tgt.id, dmg: 0, crit: false, weak: false, resist: false, broke: false, ko: false, fx: [] };
    const magic = sk.kind === 'mag';
    let type = sk.type;
    if (type === 'auto') type = tgt.weak.find((w) => !tgt.revealed.has(w)) || tgt.weak[0] || null;
    hit.type = type;
    if (sk.fx === 'gravity') {
        hit.dmg = Math.round(Math.min(9999, tgt.hp * (tgt.boss ? 0.12 : 0.3)));
    } else {
        const A = sm(att, magic ? 'mag' : 'atk'), D = sm(tgt, magic ? 'res' : 'def');
        let d = A * opts.pow * (0.92 + G.rng() * 0.16) * 100 / (100 + D * 0.9);
        if (!magic && !sk.noCrit) {
            const cc = clamp(0.05 + att.spd * 0.0015, 0.05, 0.25);
            if (G.rng() < cc) { hit.crit = true; d *= CRIT_MULT; }
        }
        if (type && tgt.weak.includes(type)) { hit.weak = true; d *= WEAK_MULT; }
        if (type && tgt.resist.includes(type)) { hit.resist = true; d *= 0.5; }
        if (tgt.broken) d *= BREAK_MULT;
        if (tgt.guard) d *= 0.5;
        if (tgt.status.mark) d *= 1.3;
        hit.dmg = Math.max(1, Math.round(d));
    }
    if (opts.fixed) hit.dmg = opts.fixed;
    tgt.hp = Math.max(0, tgt.hp - hit.dmg);
    if (tgt.status.sleep) { delete tgt.status.sleep; hit.woke = true; }
    // shields: a weakness hit chips it, and the last chip breaks the foe
    if (hit.weak && tgt.side === 'enemy') {
        if (!tgt.revealed.has(type)) { tgt.revealed.add(type); hit.revealed = type; }
        const b = G.bestiary[tgt.ref]; if (b && !b.weak.includes(type)) b.weak.push(type);
        if (tgt.shield > 0) {
            tgt.shield = Math.max(0, tgt.shield - 1 - (sk.sh || 0) - (opts.shBonus || 0));
            if (tgt.shield === 0 && !tgt.broken) {
                tgt.broken = true; tgt.lostTurn = true; hit.broke = true;
                if (tgt.charge) { tgt.charge = null; hit.cancelled = true; }
            }
        }
    }
    if (tgt.hp <= 0) { hit.ko = true; koCleanup(B, tgt); }
    if (sk.fx === 'drain' && hit.dmg > 0) att.hp = Math.min(att.mhp, att.hp + Math.round(hit.dmg * 0.4));
    hit.hp = tgt.hp;
    return hit;
}

function addStatusFx(G, att, tgt, sk, hit, boost) {
    if (!sk.st || !alive(tgt)) return;
    for (const [name, ch, turns] of sk.st) {
        const ok = applyStatus(G, att, tgt, name, Math.min(1, ch * (1 + boost * 0.15)), turns);
        hit.fx.push([name, ok]);
    }
}

// ---------------------------------------------------------------- targets
function pickTargets(G, att, sk, targetId) {
    const B = G.battle;
    const foes = living(B, att.side === 'party' ? 'enemy' : 'party');
    const friends = living(B, att.side);
    switch (sk.tgt) {
        case 'all': return foes;
        case 'allies': return sk.fx === 'reviveAll' ? B.units.filter((u) => u.side === att.side) : friends;
        case 'self': return [att];
        case 'dead': { const t = unitById(B, targetId); return t && !alive(t) && t.side === att.side ? [t] : []; }
        case 'ally': { const t = unitById(B, targetId); return t && alive(t) && t.side === att.side ? [t] : []; }
        case 'rand': return foes.length ? [foes[Math.floor(G.rng() * foes.length)]] : [];
        default: {
            let t = unitById(B, targetId);
            if (!t || !alive(t) || t.side === att.side) t = foes[0];
            return t ? [t] : [];
        }
    }
}

function coverFor(B, tgt) {
    if (tgt.side !== 'party') return null;
    return B.units.find((u) => u.side === 'party' && alive(u) && u !== tgt && u.status.cover) || null;
}

// ---------------------------------------------------------------- resolving a skill
function resolve(G, att, sk, targetId, boost, label) {
    const B = G.battle;
    const hits = [];
    const ev = { type: 'b_act', actor: att.id, name: label || sk.name, skill: sk.id, vfx: sk.vfx || (sk.kind === 'phys' ? 'slash' : 'cast'), tgt: sk.tgt, kind: sk.kind, boost, ult: !!sk.ult, hits, atype: sk.type };
    const mul = 1 + 0.6 * boost;
    const nHits = (sk.hits || 1) + (sk.hits > 1 ? boost : 0);
    const targets = pickTargets(G, att, sk, targetId);
    ev.targets = targets.map((t) => t.id);
    if (!targets.length) return null;

    if (sk.kind === 'heal' || (sk.kind === 'buff') || sk.kind === 'util') {
        for (const t0 of targets) {
            const hit = { t: t0.id, heal: 0, fx: [] };
            if (sk.kind === 'heal') {
                if (sk.fx === 'revive' || sk.fx === 'reviveAll') {
                    if (t0.hp <= 0) { t0.hp = Math.max(1, Math.round(t0.mhp * (sk.fx === 'reviveAll' ? 0.5 : 0.3 * sk.pow))); hit.revived = true; }
                }
                if (alive(t0) && sk.fx !== 'revive') {
                    const amt = Math.round(sm(att, 'mag') * sk.pow * mul * (0.95 + G.rng() * 0.1));
                    const before = t0.hp;
                    t0.hp = sk.fx === 'reviveAll' ? t0.mhp : Math.min(t0.mhp, t0.hp + amt);
                    hit.heal = t0.hp - before;
                }
                if (sk.fx === 'cleanse') { for (const s of Object.keys(t0.status)) if (['poison', 'sleep', 'slow', 'atkDown', 'defDown', 'mark'].includes(s)) delete t0.status[s]; hit.cleansed = true; }
            }
            if (sk.fx === 'bp') { t0.bp = Math.min(MAX_BP, t0.bp + 2); hit.bp = 2; }
            if (sk.fx === 'analyze') {
                for (const w of t0.weak) t0.revealed.add(w);
                const b = G.bestiary[t0.ref]; if (b) for (const w of t0.weak) if (!b.weak.includes(w)) b.weak.push(w);
                hit.analyzed = true;
            }
            if (sk.fx === 'steal') {
                if (t0.steal === undefined) t0.steal = ENEMIES[t0.ref]?.steal || null;
                if (t0.steal && !t0.stolen && G.rng() < 0.7) { t0.stolen = true; addItem(G, t0.steal, 1); hit.steal = t0.steal; } else hit.stealFail = true;
            }
            addStatusFx(G, att, t0, sk, hit, boost);
            hit.hp = t0.hp;
            hits.push(hit);
        }
    } else {
        for (let h = 0; h < nHits; h++) {
            let tg = h === 0 || sk.tgt === 'all' ? targets : null;
            if (sk.tgt === 'rand') { const f = living(B, att.side === 'party' ? 'enemy' : 'party'); tg = f.length ? [f[Math.floor(G.rng() * f.length)]] : []; }
            else if (!tg) tg = targets.filter(alive).length ? targets.filter(alive) : [];
            if (sk.tgt === 'one' && h > 0 && !alive(targets[0])) {
                const f = living(B, att.side === 'party' ? 'enemy' : 'party');
                tg = f.length ? [f[Math.floor(G.rng() * f.length)]] : [];
            }
            for (let t of tg) {
                if (!alive(t)) continue;
                let covered = null;
                if (sk.tgt === 'one' || sk.tgt === 'rand') { const c = coverFor(B, t); if (c && att.side === 'enemy') { covered = t.id; t = c; } }
                const hit = dealHit(G, att, t, sk, { pow: sk.pow * (sk.hits > 1 ? 1 : mul) });
                if (covered) hit.covered = covered;
                hit.n = h;
                addStatusFx(G, att, t, sk, hit, boost);
                hits.push(hit);
            }
        }
        if (sk.fx === 'drain') ev.drain = true;
    }
    if (att.side === 'party' && sk.id !== 'attack') { /* mp spent by the caller */ }
    return ev;
}

const ATTACK = { id: 'attack', name: 'Attack', mp: 0, tgt: 'one', kind: 'phys', pow: 1.0, hits: 1, sh: 0 };

function basicAttack(att) {
    const wt = weaponTypeOf(att);
    const magic = wt === 'staff' || wt === 'tome';
    const sk = { ...ATTACK, kind: magic ? 'mag' : 'phys', pow: magic ? 0.85 : 1.0, type: magic ? null : wt, vfx: magic ? 'zap' : wt === 'bow' ? 'arrow' : wt === 'spear' ? 'thrust' : 'slash' };
    return sk;
}

// ---------------------------------------------------------------- player commands
export function canAct(G) { const B = G.battle; return !!B && B.phase === 'cmd' && !!B.actor; }

export function legalSkills(G, u) {
    return skillsAt(u.ref, u.lvl).map((id) => SKILLS[id]).filter(Boolean);
}

/** cmd: { type:'attack'|'skill'|'item'|'defend'|'flee', skill, item, target, boost } */
export function playerAct(G, cmd) {
    const B = G.battle;
    if (!canAct(G)) return false;
    const u = unitById(B, B.actor);
    const boost = clamp(cmd.boost | 0, 0, Math.min(MAX_BOOST, u.bp));
    let ev = null;

    if (cmd.type === 'attack') {
        const sk = basicAttack(u);
        const t = cmd.target;
        u.bp -= boost;
        ev = resolve(G, u, sk, t, boost);
        if (ev) { ev.bpSpent = boost; ev.basic = true; }
    } else if (cmd.type === 'skill') {
        const sk = SKILLS[cmd.skill];
        if (!sk || !legalSkills(G, u).includes(sk)) return false;
        if (u.mp < sk.mp) return false;
        if (sk.tgt === 'dead' && !unitById(B, cmd.target) ) return false;
        u.mp -= sk.mp; u.bp -= boost;
        ev = resolve(G, u, sk, cmd.target, boost);
        if (ev) ev.bpSpent = boost;
    } else if (cmd.type === 'item') {
        const it = ITEMS[cmd.item];
        if (!it?.use || it.fieldOnly || !removeItem(G, cmd.item, 1)) return false;
        ev = useItemInBattle(G, u, it, cmd.target);
    } else if (cmd.type === 'defend') {
        u.guard = true;
        u.mp = Math.min(u.mmp, u.mp + Math.round(u.mmp * 0.1));
        ev = { type: 'b_act', actor: u.id, name: 'Defend', skill: 'defend', vfx: 'guard', tgt: 'self', kind: 'buff', targets: [u.id], hits: [{ t: u.id, fx: [], hp: u.hp }], boost: 0 };
    } else if (cmd.type === 'flee') {
        if (B.noFlee) return false;
        const pa = living(B, 'party'), ea = living(B, 'enemy');
        const avg = (a) => a.reduce((s, x) => s + sm(x, 'spd'), 0) / Math.max(1, a.length);
        const ok = G.rng() < clamp(0.5 + (avg(pa) - avg(ea)) * 0.025, 0.25, 0.92);
        G.events.push({ type: 'b_flee', id: u.id, ok, snap: snap(B) });
        if (ok) { finish(G, 'fled'); return true; }
        ev = null;
    } else return false;

    if (ev === null && cmd.type !== 'flee') return false;
    if (ev) { ev.snap = snap(B); G.events.push(ev); afterHit(G, ev); }
    B.phase = 'run'; B.actor = null;
    endTurn(G, u);
    if (!checkEnd(G)) advance(G);
    return true;
}

function useItemInBattle(G, u, it, targetId) {
    const B = G.battle;
    const U = it.use;
    const ev = { type: 'b_act', actor: u.id, name: it.name, skill: 'item:' + it.id, vfx: U.dmg ? it.id.replace('Orb', '') : 'heal', tgt: it.tgt === 'foe' ? 'one' : 'ally', kind: U.dmg ? 'mag' : 'heal', boost: 0, hits: [], targets: [], item: it.id };
    if (U.flee) { G.events.push({ type: 'b_flee', id: u.id, ok: true, snap: snap(B) }); finish(G, 'fled'); return { type: 'b_noop' }; }
    if (U.dmg) {
        const t = unitById(B, targetId);
        const tg = t && alive(t) && t.side === 'enemy' ? t : living(B, 'enemy')[0];
        ev.targets = [tg.id];
        const sk = { id: 'itemdmg', kind: 'mag', type: U.type, sh: 0, noCrit: true };
        ev.hits.push(dealHit(G, u, tg, sk, { fixed: Math.round(U.dmg * (0.9 + G.rng() * 0.2)), pow: 1 }));
        return ev;
    }
    const t = unitById(B, targetId) || u;
    ev.targets = [t.id];
    const hit = { t: t.id, heal: 0, fx: [] };
    if (U.revive) { if (t.hp <= 0) { t.hp = Math.max(1, Math.round(t.mhp * U.revive)); hit.revived = true; } else { addItem(G, it.id, 1); return null; } }
    if (alive(t)) {
        if (U.hp) { const b = t.hp; t.hp = Math.min(t.mhp, t.hp + U.hp); hit.heal = t.hp - b; }
        if (U.mp) { const b = t.mp; t.mp = Math.min(t.mmp, t.mp + U.mp); hit.mp = t.mp - b; }
        if (U.cleanse) { delete t.status.poison; delete t.status.sleep; hit.cleansed = true; }
    }
    hit.hp = t.hp;
    ev.hits.push(hit);
    return ev;
}

function afterHit(G, ev) {
    const B = G.battle;
    for (const h of ev.hits) {
        const t = unitById(B, h.t);
        if (h.ko && t.side === 'enemy' && t.boss === false) { /* the view handles the fade */ }
    }
    // boss phase changes
    for (const t of B.units) {
        if (t.side !== 'enemy' || !t.boss || !alive(t)) continue;
        const e = ENEMIES[t.ref];
        const p = e.phases?.[t.phase];
        if (p && t.hp / t.mhp <= p.hp) {
            t.phase++;
            const spawned = [];
            for (const k of p.summon || []) {
                const free = [0, 1, 2, 3, 4].find((i) => !B.units.some((u) => u.side === 'enemy' && u.idx === i && alive(u)));
                if (free === undefined || B.units.filter((u) => u.side === 'enemy').length >= 7) break;
                const nu = enemyUnit(G, k, Math.max(1, t.lvl - 4), free); nu.id = 'e' + (B.units.length + 10); nu.summoned = true;
                B.units.push(nu); spawned.push(describe(nu));
            }
            for (const b of p.buff || []) t.status[b] = 99;
            if (p.shield) { t.mshield = p.shield; t.shield = p.shield; t.broken = false; t.lostTurn = false; }
            if (t.broken && !p.shield) { /* stays broken */ }
            G.events.push({ type: 'b_phase', id: t.id, say: p.say, spawn: spawned, phase: t.phase, snap: snap(B) });
        }
    }
}

// ---------------------------------------------------------------- enemies
function condOk(B, u, mvDef, cond) {
    if (!cond) return true;
    const pa = living(B, 'party');
    if (cond === 'phase2') return (u.phase || 0) >= 1;
    if (cond.startsWith('no')) {
        const st = mvDef.st?.[0]?.[0];
        if (!st) return true;
        if (mvDef.tgt === 'self') return !u.status[st];
        return pa.some((p) => !p.status[st]);
    }
    return true;
}

function enemyTurn(G, u) {
    const B = G.battle;
    const e = ENEMIES[u.ref];
    // a charged move goes off
    if (u.charge) {
        u.charge.turns--;
        if (u.charge.turns > 0) { G.events.push({ type: 'b_charge', id: u.id, move: u.charge.move, again: true, turns: u.charge.turns, snap: snap(B) }); return; }
        const mvId = u.charge.move; u.charge = null;
        const ev = resolve(G, u, MOVES[mvId], null, 0);
        if (ev) { ev.snap = snap(B); ev.released = true; G.events.push(ev); afterHit(G, ev); }
        return;
    }
    const opts = e.moves.filter((m) => condOk(B, u, MOVES[m.m], m.c));
    if (!opts.length) return;
    // bosses prefer to charge the big move when the party is healthy
    const pick = G.rng.weighted(opts, (m) => m.w);
    const mvDef = MOVES[pick.m];
    if (mvDef.charge) {
        u.charge = { move: mvDef.id, turns: mvDef.charge };
        G.events.push({ type: 'b_charge', id: u.id, move: mvDef.id, name: mvDef.name, warn: mvDef.warn, turns: mvDef.charge, snap: snap(B) });
        return;
    }
    // choose a target: taunt pulls, marks and low health draw fire
    let targetId = null;
    if (mvDef.tgt === 'one') {
        const pa = living(B, 'party');
        const w = pa.map((p) => (p.status.taunt ? 6 : 1) * (p.status.mark ? 2 : 1) * (1 + (1 - p.hp / p.mhp) * 0.8) * (p.guard ? 0.7 : 1));
        let r = G.rng() * w.reduce((a, b) => a + b, 0), i = 0;
        for (; i < pa.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
        targetId = pa[i].id;
    }
    const ev = resolve(G, u, mvDef, targetId, 0);
    if (ev) { ev.snap = snap(B); G.events.push(ev); afterHit(G, ev); }
}

// ---------------------------------------------------------------- after the fight
export function endBattle(G) {
    const B = G.battle;
    if (!B) return null;
    const result = B.result;
    // KO'd survivors of a won or fled fight stay down; a script ending restores everyone
    if (result === 'script') for (const id of G.party.active) { const m = G.party.members[id]; if (m.hp <= 0) m.hp = 1; }
    G.battle = null;
    G.mode = G.scene ? 'scene' : 'field';
    return { result, win: B.win, spec: B.spec, rewards: B.rewards };
}
