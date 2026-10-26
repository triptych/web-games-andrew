// Turn-based battles. The party picks a command for each member, then `resolveRound` runs the whole
// round (speed order) and emits events the view plays back. Pure: the rng is G.rng.

import { say, ev, clamp } from './core.js';
import { calc, SKILLS, skillsFor, gainXp } from './party.js';
import { SCROLLS, POTIONS, itemLabel } from './items.js';
import { potionEffect } from './use.js';
import { genDrop } from './items.js';
import { give, take, findItem } from './inv.js';
import { recMon, recItem, misc } from './journal.js';
import { questKill } from './quests.js';

const ELEM_WORD = { fire: 'burns', ice: 'freezes', shock: 'shocks', holy: 'smites', dark: 'corrodes', phys: 'hits' };

// ---------------------------------------------------------------- setup
export function startBattle(G, enemies, o = {}) {
    G.battle = {
        enemies: enemies.map((e, i) => ({ ...e, id: i, status: {}, buf: {}, hp: e.hp, mhp: e.mhp })),
        round: 0, over: null, result: null, boss: !!o.boss, ambush: !!o.ambush, ctx: o.ctx || { kind: 'random' }, fled: false, enraged: false,
    };
    for (const m of G.party) {
        const keep = m.cb?.buf || {};
        m.cb = { guard: false, buf: m.hp > 0 ? keep : {} };
        delete m.st.sleep; delete m.st.stun;
    }
    for (const e of G.battle.enemies) recMon(G, e, 'seen');
    misc(G, 'battles');
    ev(G, 'battleStart', { boss: !!o.boss });
    if (o.boss) say(G, `${enemies[0].name} blocks the way!`, 12);
    else say(G, o.ambush ? 'Ambush! The enemy strikes first!' : `${enemies.length} foe${enemies.length > 1 ? 's' : ''} appear!`, 12);
    return G.battle;
}

const liveE = (B) => B.enemies.map((e, i) => (e.hp > 0 ? i : -1)).filter((i) => i >= 0);
const liveP = (G) => G.party.map((m, i) => (m.hp > 0 ? i : -1)).filter((i) => i >= 0);
export const battleLiveEnemies = liveE;

function bufMul(ent, stat) {
    const b = ent.buf?.[stat] ?? ent.cb?.buf?.[stat];
    return b ? b.m : 1;
}
function pStats(m) {
    const s = calc(m);
    return { ...s, atk: s.atk * bufMul(m, 'atk'), mag: s.mag * bufMul(m, 'atk'), def: s.def * bufMul(m, 'def'), mdef: s.mdef * bufMul(m, 'def'), agi: s.agi * bufMul(m, 'agi'), eva: s.eva + (m.cb?.buf?.eva?.m ? m.cb.buf.eva.m : 0) };
}
function eStats(e) {
    return { atk: e.atk * bufMul(e, 'atk'), mag: e.mag * bufMul(e, 'atk'), def: e.def * bufMul(e, 'def'), mdef: e.mdef * bufMul(e, 'def'), agi: e.agi * bufMul(e, 'agi'), crit: 0.05, eva: 0.04 + e.agi * 0.001, res: {}, elem: e.elem };
}
function setBuf(ent, stat, m, t) {
    if (ent.cb) ent.cb.buf[stat] = { m, t };
    else ent.buf[stat] = { m, t };
}
function tickBufs(ent) {
    const b = ent.cb ? ent.cb.buf : ent.buf;
    for (const k of Object.keys(b)) { b[k].t--; if (b[k].t <= 0) delete b[k]; }
}

function elemMult(target, isEnemy, elem) {
    if (!elem || elem === 'phys') {
        if (isEnemy && target.res.includes('phys')) return 0.6;
        return 1;
    }
    if (isEnemy) return target.weak.includes(elem) ? 1.5 : target.res.includes(elem) ? 0.5 : 1;
    const r = target._s?.res?.[elem] || 0;
    return 1 - clamp(r, 0, 0.75);
}

function dmgCalc(G, att, def, pow, kind, elem, defIsEnemy, defEnt, crit = 0) {
    const A = Math.max(1, (kind === 'm' ? att.mag : att.atk) * pow);
    const D = kind === 'm' ? def.mdef : def.def;
    let d = (A * A) / (A + D * 1.2);
    d *= G.rng.range(0.9, 1.1);
    defEnt._s = def;
    d *= elemMult(defEnt, defIsEnemy, elem);
    const isCrit = G.rng() < (att.crit || 0.05) + crit;
    if (isCrit) d *= 1.6;
    return { d: Math.max(1, Math.round(d)), crit: isCrit, weak: defIsEnemy && elem && elem !== 'phys' && defEnt.weak.includes(elem) };
}

// ---------------------------------------------------------------- damage plumbing
function hurtEnemy(G, B, i, amt, o = {}) {
    const e = B.enemies[i];
    if (e.hp <= 0) return;
    e.hp = Math.max(0, e.hp - amt);
    if (e.status.sleep && G.rng() < 0.6) delete e.status.sleep;
    ev(G, 'b_hit', { side: 'e', i, dmg: amt, crit: !!o.crit, elem: o.elem || 'phys', hp: e.hp, mhp: e.mhp, weak: !!o.weak });
    if (e.hp <= 0) {
        ev(G, 'b_die', { side: 'e', i });
        say(G, `${e.name} is defeated!`, 10);
        recMon(G, e, 'killed');
        misc(G, 'kills');
        G.stats.kills++;
        questKill(G, e);
        if (e.boss) misc(G, 'bossKills');
    } else if (e.boss && !B.enraged && e.hp < e.mhp * 0.4) {
        B.enraged = true;
        e.buf.atk = { m: 1.3, t: 99 };
        say(G, `${e.name} flies into a rage!`, 12);
        ev(G, 'b_rage', { i });
    }
}
function hurtParty(G, B, i, amt, o = {}) {
    const m = G.party[i];
    if (m.hp <= 0) return;
    if (m.cb?.guard) amt = Math.max(1, Math.round(amt * 0.5));
    m.hp = Math.max(0, m.hp - amt);
    if (m.st.sleep && G.rng() < 0.5) delete m.st.sleep;
    ev(G, 'b_hit', { side: 'p', i, dmg: amt, crit: !!o.crit, elem: o.elem || 'phys', hp: m.hp, mhp: calc(m).maxhp });
    if (m.hp <= 0) {
        ev(G, 'b_die', { side: 'p', i });
        say(G, `${m.name} falls!`, 12);
        m.st = {};
        misc(G, 'falls');
    }
}
function healTarget(G, i, amt, side = 'p') {
    const m = G.party[i];
    if (m.hp <= 0) return 0;
    const s = calc(m), before = m.hp;
    m.hp = Math.min(s.maxhp, m.hp + amt);
    ev(G, 'b_heal', { side, i, amt: m.hp - before, hp: m.hp, mhp: s.maxhp });
    return m.hp - before;
}
function inflictOnParty(G, i, st, ch) {
    const m = G.party[i];
    if (m.hp <= 0 || m.st[st]) return false;
    const s = calc(m);
    if (G.rng() > ch * (1 - clamp(s.luk * 0.003, 0, 0.4))) return false;
    m.st[st] = st === 'sleep' ? 2 : st === 'stun' ? 1 : true;
    say(G, `${m.name} is ${{ poison: 'poisoned', sleep: 'put to sleep', stun: 'stunned', curse: 'cursed' }[st]}!`, st === 'curse' ? 5 : 12);
    ev(G, 'b_status', { side: 'p', i, st });
    return true;
}
function inflictOnEnemy(G, B, i, st, ch) {
    const e = B.enemies[i];
    if (e.hp <= 0 || e.status[st]) return false;
    const resist = e.boss ? 0.4 : 1;
    if (G.rng() > ch * resist) return false;
    e.status[st] = st === 'sleep' ? 3 : st === 'stun' ? 1 : 99;
    say(G, `${e.name} is ${{ poison: 'poisoned', sleep: 'asleep', stun: 'stunned', curse: 'cursed' }[st]}!`, 11);
    ev(G, 'b_status', { side: 'e', i, st });
    return true;
}

// ---------------------------------------------------------------- party actions
function enemyTarget(G, B, tg) {
    const L = liveE(B);
    if (!L.length) return -1;
    return tg && tg.side === 'e' && B.enemies[tg.i]?.hp > 0 ? tg.i : L[Math.floor(G.rng() * L.length)];
}
function allyTarget(G, tg, wantDead = false) {
    const L = G.party.map((m, i) => i).filter((i) => (wantDead ? G.party[i].hp <= 0 : G.party[i].hp > 0));
    if (!L.length) return -1;
    return tg && tg.side === 'p' && L.includes(tg.i) ? tg.i : L[Math.floor(G.rng() * L.length)];
}

function physHit(G, B, ai, ti, pow, o = {}) {
    const m = G.party[ai], s = pStats(m), e = B.enemies[ti];
    const es = eStats(e);
    if (G.rng() < clamp(0.04 + Math.max(0, (e.agi - s.agi) * 0.004), 0.04, 0.3) && !e.status.sleep) {
        ev(G, 'b_miss', { side: 'e', i: ti });
        say(G, `${m.name} misses ${e.name}.`, 7);
        return;
    }
    const rowMul = m.row === 1 && !s.ranged && !o.ranged ? 0.7 : 1;
    const elem = o.elem || s.elem;
    const r = dmgCalc(G, { ...s, atk: s.atk * rowMul }, es, pow, 'p', elem, true, e, o.crit || 0);
    let d = r.d;
    if (o.exec && e.hp < e.mhp * 0.35) d = Math.round(d * 1.8);
    hurtEnemy(G, B, ti, d, { crit: r.crit, elem, weak: r.weak });
    say(G, `${m.name} ${ELEM_WORD[elem] || 'hits'} ${e.name} for ${d}${r.crit ? '!' : ''}${r.weak ? ' (weak)' : ''}`, r.crit ? 14 : 15);
    if (e.hp > 0 && s.onhit && G.rng() < 0.3) inflictOnEnemy(G, B, ti, s.onhit, 1);
}
function magHit(G, B, ai, ti, pow, elem, o = {}) {
    const m = G.party[ai], s = pStats(m), e = B.enemies[ti], es = eStats(e);
    const bonus = o.wandPot ? o.wandPot * 3 : 0;
    const r = dmgCalc(G, { ...s, mag: s.mag + bonus }, es, pow, 'm', elem, true, e, 0);
    hurtEnemy(G, B, ti, r.d, { crit: r.crit, elem, weak: r.weak });
    say(G, `${m.name}'s ${elem === 'phys' ? 'spell' : elem} ${ELEM_WORD[elem]} ${e.name} for ${r.d}${r.crit ? '!' : ''}${r.weak ? ' (weak)' : ''}`, r.crit ? 14 : 15);
}

function castSkill(G, B, ai, sk, tg, o = {}) {
    const m = G.party[ai], s = pStats(m);
    const free = !!o.free;
    if (!free) m.mp -= sk.mp;
    ev(G, 'b_cast', { side: 'p', i: ai, skill: sk.id, elem: sk.elem || 'phys' });
    say(G, `${m.name} uses ${sk.name}.`, 11);
    const spellPow = s.mag + (o.wandPot ? o.wandPot * 3 : 0);
    const eachEnemy = (fn) => liveE(B).forEach(fn);
    switch (sk.k) {
        case 'p': {
            const hits = sk.hits || 1;
            const targets = sk.tg === 'ea' ? liveE(B) : [enemyTarget(G, B, tg)];
            for (const t of targets) {
                for (let h = 0; h < hits; h++) {
                    const ti = B.enemies[t].hp > 0 ? t : enemyTarget(G, B, null);
                    if (ti < 0) break;
                    physHit(G, B, ai, ti, sk.pow, { ranged: sk.ranged, crit: sk.crit, exec: sk.exec });
                    if (sk.st && B.enemies[ti].hp > 0) inflictOnEnemy(G, B, ti, sk.st, sk.ch);
                }
            }
            break;
        }
        case 'm': {
            if (sk.tg === 'ea') eachEnemy((t) => magHit(G, B, ai, t, sk.pow, sk.elem || 'phys', o));
            else { const t = enemyTarget(G, B, tg); if (t >= 0) magHit(G, B, ai, t, sk.pow, sk.elem || 'phys', o); }
            break;
        }
        case 'h': {
            const amt = (t) => Math.round((spellPow * sk.pow + m.lvl * 2 + 12) * G.rng.range(0.95, 1.05) * (m.cls === 'alchemist' ? 1 : 1));
            if (sk.tg === 'aa') for (const t of liveP(G)) say(G, `${G.party[t].name} recovers ${healTarget(G, t, amt(t))} HP.`, 10);
            else { const t = allyTarget(G, tg); if (t >= 0) say(G, `${G.party[t].name} recovers ${healTarget(G, t, amt(t))} HP.`, 10); }
            break;
        }
        case 'b': {
            const ts = sk.tg === 's' ? [ai] : liveP(G);
            for (const t of ts) for (const stat in sk.buf) setBuf(G.party[t], stat, sk.buf[stat], sk.turns || 3);
            say(G, sk.tg === 's' ? `${m.name} powers up!` : 'The party is empowered!', 10);
            ev(G, 'b_buff', { side: 'p' });
            break;
        }
        case 'db': {
            const t = enemyTarget(G, B, tg);
            if (t >= 0) { for (const stat in sk.buf) setBuf(B.enemies[t], stat, sk.buf[stat], sk.turns || 3); say(G, `${B.enemies[t].name} is weakened.`, 11); }
            break;
        }
        case 'x': {
            if (sk.fx === 'status') {
                for (const t of liveE(B)) inflictOnEnemy(G, B, t, sk.st, sk.ch);
            } else if (sk.fx === 'steal') {
                const t = enemyTarget(G, B, tg), e = B.enemies[t];
                const g = Math.max(1, Math.round(e.gold * G.rng.range(0.5, 1.5)));
                G.gold += g; G.stats.goldEarned += g;
                say(G, `${m.name} steals ${g}g from ${e.name}!`, 14);
                physHit(G, B, ai, t, 0.6, {});
            } else if (sk.fx === 'cure') {
                const t = allyTarget(G, tg);
                if (t >= 0) { for (const st of ['poison', 'sleep', 'stun']) delete G.party[t].st[st]; say(G, `${G.party[t].name} is cured.`, 10); }
            } else if (sk.fx === 'revive') {
                const t = allyTarget(G, tg, true);
                if (t >= 0) {
                    const tm = G.party[t];
                    tm.hp = Math.max(1, Math.round(calc(tm).maxhp * 0.4)); tm.st = {};
                    ev(G, 'b_heal', { side: 'p', i: t, amt: tm.hp, hp: tm.hp, mhp: calc(tm).maxhp });
                    say(G, `${tm.name} rises again!`, 10);
                } else say(G, 'No one has fallen.', 7);
            }
            break;
        }
    }
}

function doItem(G, B, ai, cmd) {
    const m = G.party[ai], it = findItem(G, cmd.it);
    if (!it) { say(G, `${m.name} fumbles for an item that is not there.`, 7); return; }
    ev(G, 'b_cast', { side: 'p', i: ai, skill: 'item', elem: 'phys' });
    if (it.t === 'p') {
        const tgt = POTIONS[it.eff].k === 'revive' ? allyTarget(G, cmd.tg, true) : allyTarget(G, cmd.tg);
        if (tgt < 0) { say(G, 'No target.', 7); return; }
        const r = potionEffect(it, G.party[tgt], m.cls === 'alchemist');
        say(G, `${m.name} uses ${it.name}. ${r.text}`, r.ok ? 10 : 7);
        if (r.ok) {
            take(G, it.id, 1); recItem(G, it, 'used'); misc(G, 'potionsUsed');
            ev(G, 'b_heal', { side: 'p', i: tgt, amt: r.amt || 0, hp: G.party[tgt].hp, mhp: calc(G.party[tgt]).maxhp });
        }
    } else if (it.t === 's') {
        const S = SCROLLS[it.eff];
        if (S.k === 'dmg') {
            say(G, `${m.name} reads ${it.name}!`, 11);
            for (const t of liveE(B)) {
                const e = B.enemies[t];
                const d = Math.max(1, Math.round((20 + it.ilvl * 5.5) * elemMult(e, true, S.elem) * G.rng.range(0.9, 1.1)));
                hurtEnemy(G, B, t, d, { elem: S.elem, weak: e.weak.includes(S.elem) });
            }
        } else if (S.k === 'status') {
            say(G, `${m.name} reads ${it.name}!`, 11);
            for (const t of liveE(B)) inflictOnEnemy(G, B, t, S.st, 0.7);
        } else if (S.k === 'escape') {
            if (B.boss) { say(G, 'The guardian blocks the way!', 12); return; }
            B.over = 'flee'; say(G, `${m.name} reads ${it.name}. The party escapes!`, 11); B.fled = true;
        } else { say(G, 'It cannot be read in battle.', 7); return; }
        take(G, it.id, 1); recItem(G, it, 'used');
    } else if (it.t === 'm') {
        if (it.charges <= 0) { say(G, `${it.name} is out of charges.`, 7); return; }
        const sk = SKILLS[it.skill];
        it.charges--;
        recItem(G, it, 'used');
        castSkill(G, B, ai, sk, cmd.tg, { free: true, wandPot: it.pot });
    } else say(G, 'That cannot be used now.', 7);
}

// ---------------------------------------------------------------- enemy actions
function enemyAttack(G, B, ei, ti, pow = 1, o = {}) {
    const e = B.enemies[ei], m = G.party[ti];
    if (!m || m.hp <= 0) return;
    const ps = pStats(m);
    if (!o.noMiss && G.rng() < ps.eva * (m.cb?.guard ? 0.5 : 1)) {
        ev(G, 'b_miss', { side: 'p', i: ti });
        say(G, `${m.name} dodges ${e.name}!`, 7);
        return;
    }
    const es = eStats(e);
    const kind = o.kind || 'p';
    const elem = o.elem || e.elem;
    m._s = ps;
    const rowMul = m.row === 1 && kind === 'p' && !o.aoe ? 0.7 : 1;
    const A = { ...es, atk: es.atk * rowMul };
    const r = dmgCalc(G, A, ps, pow, kind, elem, false, m, 0);
    hurtParty(G, B, ti, r.d, { crit: r.crit, elem });
    say(G, `${e.name} ${o.verb || G.rng.pick(e.verbs)} ${m.name} for ${r.d}${r.crit ? '!' : ''}`, 12);
    if (m.hp > 0 && e.st && !o.noStatus && G.rng() < 1) inflictOnParty(G, ti, e.st, e.stc || 0.3);
}
function pickPartyTarget(G) {
    const L = liveP(G);
    if (!L.length) return -1;
    return G.rng.weighted(L, (i) => (G.party[i].row === 0 ? 3 : 1));
}
const SPECIAL_NAMES = { drain: 'drains life', steal: 'steals', web: 'spins a web', howl: 'howls', spore: 'releases spores', firebolt: 'hurls fire', wail: 'wails', gaze: 'gazes', guard: 'hunkers down', breath: 'breathes fire', quake: 'stomps the ground' };
function enemySpecial(G, B, ei, sp) {
    const e = B.enemies[ei];
    ev(G, 'b_cast', { side: 'e', i: ei, skill: sp, elem: sp === 'breath' || sp === 'firebolt' ? 'fire' : 'phys' });
    say(G, `${e.name} ${SPECIAL_NAMES[sp]}!`, 13);
    const t = pickPartyTarget(G);
    switch (sp) {
        case 'drain': {
            if (t < 0) return;
            const before = G.party[t].hp;
            enemyAttack(G, B, ei, t, 0.9, { verb: 'drains', noStatus: true });
            const got = before - G.party[t].hp;
            e.hp = Math.min(e.mhp, e.hp + Math.round(got * 0.5));
            ev(G, 'b_heal', { side: 'e', i: ei, amt: Math.round(got * 0.5), hp: e.hp, mhp: e.mhp });
            break;
        }
        case 'steal': {
            const g = Math.min(G.gold, Math.max(1, Math.round(G.gold * G.rng.range(0.02, 0.05)) + e.lvl));
            G.gold -= g; e.gold += g;
            say(G, `${e.name} steals ${g}g!`, 12);
            break;
        }
        case 'web': if (t >= 0) { enemyAttack(G, B, ei, t, 0.6, { noStatus: true, verb: 'webs' }); inflictOnParty(G, t, 'stun', 0.7); } break;
        case 'howl': for (const i of liveE(B)) setBuf(B.enemies[i], 'atk', 1.3, 3); break;
        case 'spore': for (const i of liveP(G).slice(0, 2)) inflictOnParty(G, i, 'sleep', 0.5); break;
        case 'firebolt': if (t >= 0) enemyAttack(G, B, ei, t, 1.4, { kind: 'm', elem: 'fire', verb: 'burns', noStatus: true }); break;
        case 'wail': for (const i of liveP(G)) { enemyAttack(G, B, ei, i, 0.4, { kind: 'm', elem: 'dark', verb: 'chills', aoe: true, noStatus: true, noMiss: true }); inflictOnParty(G, i, 'curse', 0.18); } break;
        case 'gaze': if (t >= 0) { inflictOnParty(G, t, G.rng() < 0.5 ? 'sleep' : 'stun', 0.8); } break;
        case 'guard': setBuf(e, 'def', 1.8, 2); break;
        case 'breath': for (const i of liveP(G)) enemyAttack(G, B, ei, i, 0.8, { kind: 'm', elem: 'fire', verb: 'scorches', aoe: true, noStatus: true, noMiss: true }); break;
        case 'quake': for (const i of liveP(G)) enemyAttack(G, B, ei, i, 0.6, { verb: 'batters', aoe: true, noStatus: true, noMiss: true }); break;
    }
}
function enemyAct(G, B, ei) {
    const e = B.enemies[ei];
    const useSp = e.sp.length && G.rng() < (e.boss ? 0.5 : 0.28);
    if (useSp) {
        const sp = G.rng.pick(e.sp);
        if (!(sp === 'guard' && e.buf.def)) return enemySpecial(G, B, ei, sp);
    }
    const t = pickPartyTarget(G);
    if (t >= 0) {
        ev(G, 'b_cast', { side: 'e', i: ei, skill: 'attack', elem: 'phys' });
        enemyAttack(G, B, ei, t, 1);
    }
}

// ---------------------------------------------------------------- the round
export function resolveRound(G, cmds, o = {}) {
    const B = G.battle;
    if (!B || B.over) return;
    B.round++;
    ev(G, 'b_round', { round: B.round });
    const acts = [];
    G.party.forEach((m, i) => {
        if (m.hp <= 0) return;
        m.cb.guard = false;
        let c = cmds[i] || { k: 'atk' };
        if (o.idleParty || (B.ambush && B.round === 1)) c = { k: 'none' };
        acts.push({ side: 'p', i, c, spd: calc(m).agi * bufMul(m, 'agi') * G.rng.range(0.8, 1.2) + (c.k === 'def' ? 1000 : 0) });
    });
    B.enemies.forEach((e, i) => { if (e.hp > 0) acts.push({ side: 'e', i, spd: e.agi * bufMul(e, 'agi') * G.rng.range(0.8, 1.2) }); });
    acts.sort((a, b) => b.spd - a.spd);

    for (const a of acts) {
        if (B.over) break;
        if (!liveE(B).length || !liveP(G).length) break;
        if (a.side === 'p') {
            const m = G.party[a.i];
            if (m.hp <= 0) continue;
            if (m.st.sleep) { say(G, `${m.name} is fast asleep.`, 7); continue; }
            if (m.st.stun) { say(G, `${m.name} is stunned and cannot act.`, 7); continue; }
            const c = a.c;
            if (c.k === 'none') continue;
            if (c.k === 'def') { m.cb.guard = true; m.mp = Math.min(calc(m).maxmp, m.mp + Math.ceil(calc(m).maxmp * 0.05)); say(G, `${m.name} guards.`, 7); ev(G, 'b_guard', { i: a.i }); continue; }
            if (c.k === 'item') { doItem(G, B, a.i, c); continue; }
            if (c.k === 'skill') {
                const sk = SKILLS[c.s];
                if (sk && sk.cls === m.cls && sk.lvl <= m.lvl && m.mp >= sk.mp) { castSkill(G, B, a.i, sk, c.tg); continue; }
            }
            const t = enemyTarget(G, B, c.tg);
            if (t >= 0) {
                ev(G, 'b_cast', { side: 'p', i: a.i, skill: 'attack', elem: 'phys' });
                physHit(G, B, a.i, t, 1);
            }
        } else {
            const e = B.enemies[a.i];
            if (e.hp <= 0) continue;
            if (e.status.sleep) { say(G, `${e.name} sleeps.`, 7); continue; }
            if (e.status.stun) { say(G, `${e.name} is stunned.`, 7); continue; }
            enemyAct(G, B, a.i);
        }
    }
    if (B.over === 'flee') { finishFlee(G); return; }

    // end of round
    for (const e of B.enemies) {
        if (e.hp <= 0) continue;
        if (e.status.poison) { const d = Math.max(1, Math.round(e.mhp * 0.06)); e.hp = Math.max(1, e.hp - d); ev(G, 'b_hit', { side: 'e', i: e.id, dmg: d, elem: 'dark', hp: e.hp, mhp: e.mhp }); }
        if (e.status.sleep) { e.status.sleep--; if (e.status.sleep <= 0) delete e.status.sleep; }
        delete e.status.stun;
        tickBufs(e);
    }
    for (const m of G.party) {
        if (m.hp <= 0) continue;
        if (m.st.poison) { const d = Math.max(1, Math.round(calc(m).maxhp * 0.04)); m.hp = Math.max(1, m.hp - d); ev(G, 'b_hit', { side: 'p', i: G.party.indexOf(m), dmg: d, elem: 'dark', hp: m.hp, mhp: calc(m).maxhp }); say(G, `${m.name} suffers ${d} from poison.`, 2); }
        if (typeof m.st.sleep === 'number') { m.st.sleep--; if (m.st.sleep <= 0) delete m.st.sleep; }
        delete m.st.stun;
        tickBufs(m);
    }
    if (!liveE(B).length) return victory(G, B);
    if (!liveP(G).length) { B.over = 'lose'; say(G, 'The party has fallen...', 12); ev(G, 'b_lose'); }
}

function finishFlee(G) {
    const B = G.battle;
    B.over = 'flee';
    for (const m of G.party) delete m.cb;
    misc(G, 'fled');
    ev(G, 'b_flee');
}

export function tryFlee(G) {
    const B = G.battle;
    if (!B || B.over) return;
    if (B.boss) { say(G, 'There is no escape from a guardian!', 12); resolveRound(G, [], { idleParty: true }); return; }
    const pa = G.party.filter((m) => m.hp > 0).reduce((a, m) => a + calc(m).agi, 0) / Math.max(1, liveP(G).length);
    const ea = liveE(B).reduce((a, i) => a + B.enemies[i].agi, 0) / Math.max(1, liveE(B).length);
    const chance = clamp(0.5 + (pa - ea) / (pa + ea + 1) * 0.6, 0.2, 0.92);
    if (G.rng() < chance) { say(G, 'The party flees!', 11); finishFlee(G); }
    else { say(G, 'Could not get away!', 12); resolveRound(G, [], { idleParty: true }); }
}

function victory(G, B) {
    const alive = liveP(G);
    let xp = 0, gold = 0;
    for (const e of B.enemies) { xp += e.xp; gold += e.gold; }
    const each = Math.max(1, Math.round(xp * 2.2 / Math.max(4, alive.length)));
    const luck = G.party.reduce((a, m) => a + calc(m).luk, 0) / Math.max(1, G.party.length) * 0.02;
    const items = [];
    const depth = G.depth || 1;
    for (const e of B.enemies) {
        const drops = e.boss ? genDrop(G.rng, Math.max(depth, e.lvl - 2), true, luck) : genDrop(G.rng, Math.max(1, Math.round(e.lvl * 0.9)), false, luck);
        for (const it of drops) items.push(it);
    }
    if (G.bless?.left > 0) { gold = Math.round(gold * 1.2); }
    gold = Math.round(gold * (1 + G.guildBonus));
    G.gold += gold; G.stats.goldEarned += gold;
    const levelups = [];
    for (const i of alive) {
        const m = G.party[i];
        const before = skillsFor(m).length;
        const n = gainXp(m, each);
        m.kills++;
        if (n) {
            const learned = skillsFor(m).slice(before).map((s) => s.name);
            levelups.push({ name: m.name, lvl: m.lvl, skills: learned });
            ev(G, 'levelup', { name: m.name, lvl: m.lvl });
            say(G, `${m.name} reached level ${m.lvl}!${learned.length ? ' Learned ' + learned.join(', ') + '.' : ''}`, 14);
        }
    }
    const names = [];
    for (const it of items) { if (give(G, it, 'found')) names.push(itemLabel(it)); else names.push(it.name + ' (sold)'); }
    B.result = { xp: each, gold, items: names, levelups, boss: B.boss };
    B.over = 'win';
    if (G.bless?.left > 0) { G.bless.left--; if (G.bless.left <= 0) { G.bless = null; say(G, 'The shrine\'s blessing fades.', 7); } }
    for (const m of G.party) { delete m.cb; delete m.st.sleep; delete m.st.stun; }
    say(G, `Victory! ${each} XP each, ${gold}g.`, 14);
    ev(G, 'b_win', { boss: B.boss });
}

// ---------------------------------------------------------------- automatic commands (Auto button, bot)
export function autoCmd(G, i) {
    const B = G.battle, m = G.party[i], s = calc(m);
    const myMp = m.mp;
    const skills = skillsFor(m).filter((k) => k.mp <= myMp);
    const hurt = G.party.map((p, j) => ({ j, f: p.hp / calc(p).maxhp, dead: p.hp <= 0 })).filter((x) => !x.dead).sort((a, b) => a.f - b.f);
    const down = G.party.findIndex((p) => p.hp <= 0);
    // healers heal
    const healer = skills.find((k) => k.id === 'heal') || skills.find((k) => k.id === 'elixirdose');
    if (healer && hurt[0] && hurt[0].f < 0.5) return { k: 'skill', s: healer.id, tg: { side: 'p', i: hurt[0].j } };
    const ha = skills.find((k) => k.id === 'healall' || k.id === 'tonic');
    if (ha && hurt.filter((x) => x.f < 0.6).length >= 2) return { k: 'skill', s: ha.id, tg: { side: 'p', i: hurt[0].j } };
    const rv = skills.find((k) => k.id === 'revive');
    if (rv && down >= 0 && myMp >= rv.mp) return { k: 'skill', s: rv.id, tg: { side: 'p', i: down } };
    // potions when someone is nearly dead
    if (hurt[0] && hurt[0].f < 0.3) {
        const pot = G.inv.find((x) => x.t === 'p' && x.eff === 'heal');
        if (pot && (m.cls !== 'cleric' || !healer)) return { k: 'item', it: pot.id, tg: { side: 'p', i: hurt[0].j } };
    }
    const alive = liveE(B);
    const many = alive.length >= 3;
    // best attack skill
    let best = null, bv = 0;
    const weakest = alive.map((j) => B.enemies[j]);
    for (const k of skills) {
        if (!['p', 'm'].includes(k.k)) continue;
        if (k.tg === 'ea' && !many && alive.length < 2) continue;
        const nTargets = k.tg === 'ea' ? alive.length : 1;
        let v = (k.pow || 1) * (k.hits || 1) * nTargets * (k.k === 'm' ? s.mag : s.atk);
        if (k.elem) { const e0 = weakest[0]; if (e0.weak.includes(k.elem)) v *= 1.5; else if (e0.res.includes(k.elem)) v *= 0.4; }
        v /= 1 + k.mp * 0.04;
        if (m.cls !== 'mage' && m.cls !== 'cleric' && m.cls !== 'alchemist' && m.mp < s.maxmp * 0.3 && k.mp > 6) v *= 0.5;
        if (v > bv) { bv = v; best = k; }
    }
    if (m.cls === 'cleric' && !hurt.some((x) => x.f < 0.7)) { const sm = skills.find((k) => k.id === 'smite'); if (sm) best = sm; }
    // target: weakest to the skill's element, else lowest hp
    const tgIdx = alive.slice().sort((a, b) => B.enemies[a].hp - B.enemies[b].hp)[0];
    if (best) return { k: 'skill', s: best.id, tg: { side: 'e', i: tgIdx } };
    return { k: 'atk', tg: { side: 'e', i: tgIdx } };
}
export function autoCmds(G) { return G.party.map((m, i) => (m.hp > 0 ? autoCmd(G, i) : null)); }
