/**
 * battle.js — a deterministic ATB battle between two sides of units.
 *
 * The controller (UI or a test bot) drives it:
 *   const B = createBattle(cfg)
 *   loop: const { unit, skip } = nextTurn(B)      // ticks ATB, start-of-turn effects
 *         if (!skip) act(B, unit, ...aiChoose(B, unit) or the player's choice)
 *         drainEvents(B) → animate
 * Overlord spells may be cast between turns with castSpell(B, id, targetUid).
 */

import { Rng } from '../core/rng.js';
import { advantage, STATUS } from '../data/core.js';
import { SPELLS } from '../data/world.js';

const MAX_TURNS = 400;
const ATB_RATE = 0.0007; // per SPD per tick (SPD × 0.07 %)

// ---------------------------------------------------------------- setup

/**
 * cfg: {
 *   seed, allies: [unitDef], waves: [[unitDef]], spells: [id], spellPower, mods: { manaGain, bossDmg, regen, lifesteal, openAtb }
 * }
 * unitDef (from units.js): { name, el, side, st:{hp,atk,def,spd,cr,cd,res,acc}, flags, skills:[{name,tpl,lvl,kind}], passive:{tpl,lvl}|null, boss, view }
 */
export function createBattle(cfg) {
    const B = {
        rng: new Rng(cfg.seed || 1),
        seed: cfg.seed || 1,
        waves: cfg.waves,
        wave: -1,
        allies: [],
        enemies: [],
        units: new Map(),
        uidSeq: 1,
        turn: 0,
        events: [],
        over: false,
        win: null,
        mana: 25,
        manaMax: 100,
        spells: (cfg.spells || []).filter(Boolean),
        spellPower: cfg.spellPower || 1,
        mods: cfg.mods || {},
        stats: { dealt: {}, healed: {}, taken: {}, kills: {}, spells: 0, turns: 0, deaths: 0 },
        current: null,
        chain: 0,
    };
    for (const d of cfg.allies) B.allies.push(spawn(B, d, 'A'));
    applyAuras(B, B.allies);
    nextWave(B);
    return B;
}

function spawn(B, d, side) {
    const st = { ...d.st };
    const u = {
        uid: B.uidSeq++, side, name: d.name, el: d.el, cls: d.cls, boss: !!d.boss, view: d.view, heroId: d.heroId || 0,
        st, maxHp: st.hp, hp: st.hp, atb: 0, alive: true,
        skills: d.skills.map((s) => ({ ...s, cdLeft: s.kind === 'ult' ? Math.ceil(effCd(s) / 2) : 0 })),
        passive: d.passive || null,
        flags: { ...(d.flags || {}) },
        statuses: [], angelUsed: false, enraged: false, slot: 0,
    };
    if (u.boss) { u.st.res = (u.st.res || 0) + 0.25; }
    B.units.set(u.uid, u);
    return u;
}

function applyAuras(B, team) {
    for (const u of team) {
        const p = u.passive && u.passive.tpl.p;
        if (!p || p.type !== 'teamStat') continue;
        const v = p.v * (1 + 0.15 * (u.passive.lvl - 1));
        for (const a of team) {
            if (p.stat === 'hpP') { a.st.hp = Math.round(a.st.hp * (1 + v)); a.maxHp = a.st.hp; a.hp = a.maxHp; }
            else if (p.stat === 'defP') a.st.def = Math.round(a.st.def * (1 + v));
            else if (p.stat === 'atkP') a.st.atk = Math.round(a.st.atk * (1 + v));
            else if (p.stat === 'spd') a.st.spd += Math.round(v);
            else a.st[p.stat] = (a.st[p.stat] || 0) + v;
        }
    }
}

function nextWave(B) {
    B.wave++;
    const defs = B.waves[B.wave];
    B.enemies = defs.map((d) => spawn(B, d, 'E'));
    applyAuras(B, B.enemies);
    B.enemies.forEach((u, i) => { u.slot = i; });
    B.allies.forEach((u, i) => { u.slot = i; });
    for (const u of B.allies) {
        if (!u.alive) continue;
        u.statuses = u.statuses.filter((s) => false);
        u.atb = 0;
    }
    for (const u of [...B.allies, ...B.enemies]) {
        if (!u.alive) continue;
        let open = (u.flags.openAtb || 0) + (u.side === 'A' ? (B.mods.openAtb || 0) : 0);
        const p = u.passive && u.passive.tpl.p;
        if (p && p.type === 'firstStrike') open += p.v;
        u.atb = Math.min(0.99, open + B.rng.range(0, 0.05));
    }
    B.events.push({ t: 'wave', n: B.wave + 1, of: B.waves.length, enemies: B.enemies.map((u) => u.uid) });
}

// ---------------------------------------------------------------- helpers

export const living = (team) => team.filter((u) => u.alive);
export const foesOf = (B, u) => (u.side === 'A' ? B.enemies : B.allies);
export const friendsOf = (B, u) => (u.side === 'A' ? B.allies : B.enemies);
export const unitById = (B, uid) => B.units.get(uid);

export function has(u, id) { return u.statuses.some((s) => s.id === id); }
function stat(u, id) { return u.statuses.find((s) => s.id === id); }
const debuffCount = (u) => u.statuses.filter((s) => !STATUS[s.id].buff).length;

function effCd(s) { return Math.max(0, (s.tpl.cd || 0) - (s.lvl >= 5 && s.tpl.cd ? 1 : 0)); }
function skillMult(s) { return 1 + 0.06 * (s.lvl - 1); }
function passiveV(u, type) {
    const p = u.passive && u.passive.tpl.p;
    if (!p || p.type !== type) return 0;
    return p.v * (1 + 0.15 * (u.passive.lvl - 1));
}

export function effAtk(u) {
    let m = 1;
    if (has(u, 'atkUp')) m += 0.5;
    if (has(u, 'atkDown')) m -= 0.5;
    const frac = u.hp / u.maxHp;
    if (u.flags.lastStand && frac < 0.35) m += u.flags.lastStand;
    const lh = passiveV(u, 'lowHpAtk');
    if (lh && frac < 0.5) m += lh;
    if (u.enraged) m += 0.3;
    return u.st.atk * Math.max(0.1, m);
}
export function effDef(u) {
    let m = 1;
    if (has(u, 'defUp')) m += 0.7;
    if (has(u, 'defDown')) m -= 0.7;
    return u.st.def * Math.max(0.1, m);
}
export function effSpd(u) {
    let m = 1;
    if (has(u, 'spdUp')) m += 0.3;
    if (has(u, 'slow')) m -= 0.3;
    return Math.max(1, u.st.spd * m + (u.enraged ? 20 : 0));
}
function effCr(u) { return (u.st.cr || 0) + (has(u, 'critUp') ? 0.3 : 0); }

// ---------------------------------------------------------------- turn flow

/** Advances the attack bars to the next actor and runs start-of-turn effects. */
export function nextTurn(B) {
    if (B.over) return { unit: null, skip: true };
    const all = () => [...living(B.allies), ...living(B.enemies)];
    let ready = null;
    for (let guard = 0; guard < 5000 && !ready; guard++) {
        let best = null;
        for (const u of all()) if (u.atb >= 1 && (!best || u.atb > best.atb)) best = u;
        if (best) { ready = best; break; }
        // jump straight to the next unit reaching a full bar
        let minTicks = Infinity;
        for (const u of all()) minTicks = Math.min(minTicks, (1 - u.atb) / (effSpd(u) * ATB_RATE));
        const ticks = Math.max(1, Math.ceil(minTicks));
        for (const u of all()) u.atb += effSpd(u) * ATB_RATE * ticks;
    }
    if (!ready) { finish(B, false); return { unit: null, skip: true }; }
    B.turn++;
    B.stats.turns++;
    B.current = ready;
    const u = ready;
    B.events.push({ t: 'turn', u: u.uid });

    // damage over time
    for (const id of ['burn', 'poison']) {
        const s = stat(u, id);
        if (!s) continue;
        const pct = id === 'burn' ? 0.05 : 0.04;
        const cap = u.boss ? 0.4 : 1; // bosses take reduced DoT
        const v = Math.round(u.maxHp * pct * s.stacks * cap);
        applyDamage(B, null, u, v, { dot: id });
        if (!u.alive) { checkEnd(B); endTurn(B, u, true); return { unit: u, skip: true }; }
    }
    // healing over time
    let regen = 0;
    if (has(u, 'regen')) regen += 0.12;
    regen += u.flags.regen || 0;
    regen += passiveV(u, 'turnHeal');
    if (u.side === 'A') regen += B.mods.regen || 0;
    if (regen > 0 && u.hp < u.maxHp) heal(B, u, u, u.maxHp * regen, true);
    // passive cleanse
    const cl = passiveV(u, 'cleanseTurn');
    if (cl && debuffCount(u) && B.rng.chance(cl)) {
        const d = u.statuses.find((s) => !STATUS[s.id].buff);
        removeStatus(B, u, d.id);
    }
    // cooldowns tick
    for (const s of u.skills) if (s.cdLeft > 0) s.cdLeft--;
    // stun
    if (has(u, 'stun')) {
        B.events.push({ t: 'stunned', u: u.uid });
        tickStatuses(B, u);
        endTurn(B, u, true);
        return { unit: u, skip: true };
    }
    tickStatuses(B, u);
    return { unit: u, skip: false };
}

function tickStatuses(B, u) {
    for (const s of [...u.statuses]) {
        s.turns--;
        if (s.turns <= 0) removeStatus(B, u, s.id);
    }
}

function endTurn(B, u, skipped = false) {
    u.atb = 0;
    if (!skipped && u.alive && !B.over) {
        // extra turn chance (Fervor set), not chained more than twice
        const ex = u.flags.extraTurn || 0;
        if (ex && B.chain < 2 && B.rng.chance(ex)) {
            u.atb = 1.0001;
            B.chain++;
            B.events.push({ t: 'extra', u: u.uid });
        } else B.chain = 0;
    }
    if (u.side === 'A' && !skipped) gainMana(B, 9);
    else gainMana(B, 3);
    B.current = null;
    if (B.turn >= MAX_TURNS && !B.over) finish(B, false);
}

function gainMana(B, v) {
    const before = B.mana;
    B.mana = Math.min(B.manaMax, B.mana + v * (1 + (B.mods.manaGain || 0)) * B.spellPower);
    if (Math.floor(B.mana) !== Math.floor(before)) B.events.push({ t: 'mana', v: B.mana });
}

export function usableSkills(u) {
    return u.skills.map((s, i) => ({ s, i, ok: s.cdLeft <= 0 && (i === 0 || !has(u, 'silence')) && !(has(u, 'provoke') && i !== 0) }));
}

// ---------------------------------------------------------------- AI

const healOf = (tpl) => (tpl.eff || []).some((e) => e.t === 'heal' || e.t === 'revive' || e.t === 'shield' || e.t === 'cleanse');
const damages = (tpl) => !!tpl.m;

function scoreTarget(B, u, t) {
    let s = 0;
    const adv = advantage(u.el, t.el);
    s += adv * 30;
    s += (1 - t.hp / t.maxHp) * 45;
    if (has(t, 'mark')) s += 12;
    if (t.boss) s += 6;
    if (has(t, 'defDown')) s += 10;
    s += B.rng.range(0, 8);
    return s;
}

export function chooseTarget(B, u) {
    const foes = living(foesOf(B, u));
    const prov = stat(u, 'provoke');
    if (prov) {
        const p = unitById(B, prov.src);
        if (p && p.alive) return p;
    }
    let best = foes[0], bs = -Infinity;
    for (const t of foes) { const s = scoreTarget(B, u, t); if (s > bs) { bs = s; best = t; } }
    return best;
}

/** Returns [skillIndex, targetUid]. */
export function aiChoose(B, u) {
    const friends = living(friendsOf(B, u));
    const lowest = Math.min(...friends.map((f) => f.hp / f.maxHp));
    const dead = friendsOf(B, u).some((f) => !f.alive);
    const debuffed = friends.some((f) => debuffCount(f) > 0);
    const opts = usableSkills(u).filter((o) => o.ok);
    let pick = opts[0];
    for (const o of opts.slice().reverse()) {
        const tpl = o.s.tpl;
        if (o.i === 0) continue;
        if (!damages(tpl)) {
            const effs = tpl.eff || [];
            const needsHeal = effs.some((e) => e.t === 'heal') && lowest < 0.72;
            const needsRevive = effs.some((e) => e.t === 'revive') && dead;
            const needsCleanse = effs.some((e) => e.t === 'cleanse') && debuffed;
            const buffs = effs.filter((e) => e.t === 'buff' || e.t === 'atb' || e.t === 'shield');
            const fresh = buffs.length && buffs.some((e) => e.t === 'atb' || e.t === 'shield' || !friends.every((f) => has(f, e.s)));
            if (needsHeal || needsRevive || needsCleanse || (fresh && !effs.some((e) => e.t === 'heal')) || (fresh && lowest < 0.9)) { pick = o; break; }
            continue;
        }
        pick = o; break;
    }
    const tpl = pick.s.tpl;
    let target = null;
    if (tpl.tgt === 'enemy' || tpl.tgt === 'random') target = chooseTarget(B, u);
    return [pick.i, target ? target.uid : 0];
}

// ---------------------------------------------------------------- resolving a skill

export function act(B, u, si, targetUid) {
    if (B.over || !u.alive) return;
    const s = u.skills[si] || u.skills[0];
    const tpl = s.tpl;
    const foes = living(foesOf(B, u));
    let target = targetUid ? unitById(B, targetUid) : null;
    if (!target || !target.alive || target.side === u.side) target = chooseTarget(B, u);
    const prov = stat(u, 'provoke');
    if (prov) { const p = unitById(B, prov.src); if (p && p.alive) target = p; }

    s.cdLeft = effCd(s);
    const targets = [];
    if (tpl.tgt === 'enemy' && target) targets.push(target);
    else if (tpl.tgt === 'enemies') targets.push(...foes);
    else if (tpl.tgt === 'random') for (let h = 0; h < tpl.hits; h++) targets.push(B.rng.pick(foes));

    B.events.push({ t: 'skill', u: u.uid, s: s.name, kind: s.kind, fx: tpl.fx, el: u.el, targets: [...new Set(targets.map((x) => x.uid))], hits: tpl.hits, support: !tpl.m });

    const effs = tpl.eff || [];
    let lifesteal = (u.flags.lifesteal || 0) + passiveV(u, 'lifesteal') + (u.side === 'A' ? B.mods.lifesteal || 0 : 0);
    for (const e of effs) if (e.t === 'lifesteal') lifesteal += e.p;
    const pierce = effs.find((e) => e.t === 'pierce')?.v || 0;
    let dealt = 0, killed = false;

    if (tpl.m) {
        const hitList = tpl.tgt === 'random' ? targets : tpl.tgt === 'enemies' ? targets : Array.from({ length: tpl.hits }, () => targets[0]);
        const touched = new Set();
        for (let h = 0; h < hitList.length; h++) {
            let t = hitList[h];
            if (!t || !t.alive) {
                const alive = living(foesOf(B, u));
                if (!alive.length) break;
                t = B.rng.pick(alive);
            }
            const raw = rawDamage(u, tpl.m) * skillMult(s);
            const bonus = condBonus(B, u, t, effs);
            const r = hit(B, u, t, raw, { pierce, bonus, kind: s.kind });
            dealt += r.dmg;
            if (!t.alive) killed = true;
            // riders (debuffs, ATB pulls, strips) land once per target per skill
            if (!touched.has(t.uid)) {
                touched.add(t.uid);
                for (const e of effs) applyRider(B, u, t, e, s);
                onHitProcs(B, u, t);
            }
            if (B.over) break;
        }
        if (lifesteal > 0 && dealt > 0 && u.alive) heal(B, u, u, dealt * lifesteal, true);
    }

    // self / ally effects
    for (const e of effs) applySupport(B, u, e, s, { killed });

    // counterattacks on the targets that survived
    if (tpl.m && u.alive && !B.over) {
        for (const t of new Set(targets)) {
            if (!t.alive || t.side === u.side) continue;
            const c = (t.flags.counter || 0) + passiveV(t, 'counter') + (has(t, 'counter') ? 1 : 0);
            if (c > 0 && B.rng.chance(Math.min(1, c)) && !has(t, 'stun')) {
                B.events.push({ t: 'counter', u: t.uid, target: u.uid });
                const bs = t.skills[0];
                hit(B, t, u, rawDamage(t, bs.tpl.m || { atk: 2.5 }) * 0.75, { kind: 'counter' });
                if (!u.alive) break;
            }
        }
    }
    checkEnd(B);
    if (!B.over) {
        endTurn(B, u);
        // a granted extra turn (assassin ultimates) applies once the bar was reset
        if (B.pendingExtra === u.uid && u.alive) { u.atb = 1.0001; B.chain++; B.events.push({ t: 'extra', u: u.uid }); }
    } else u.atb = 0;
    B.pendingExtra = 0;
}

function rawDamage(u, m) {
    return effAtk(u) * (m.atk || 0) + effDef(u) * (m.def || 0) + u.maxHp * (m.hp || 0) + effSpd(u) * (m.spd || 0);
}

function condBonus(B, u, t, effs) {
    let b = 0;
    for (const e of effs) {
        if (e.t !== 'bonus') continue;
        if (e.cond === 'debuffed' && debuffCount(t)) b += e.v;
        else if (e.cond === 'lowHp') b += e.v * (1 - t.hp / t.maxHp);
        else if (e.cond === 'perDebuff') b += e.v * Math.min(5, debuffCount(t));
        else if (e.cond === 'boss' && t.boss) b += e.v;
    }
    const ex = (u.flags.execute || 0) + passiveV(u, 'execute');
    if (ex && t.hp / t.maxHp < 0.35) b += ex;
    if (t.boss && u.side === 'A') b += B.mods.bossDmg || 0;
    return b;
}

/** One attack hit with crit/glance/element. Returns { dmg, crit }. */
function hit(B, u, t, raw, o = {}) {
    const adv = advantage(u.el, t.el);
    let glanceP = (adv < 0 ? 0.3 : 0) + (has(u, 'blind') ? 0.5 : 0);
    const glance = B.rng.chance(glanceP);
    const crit = !glance && B.rng.chance(effCr(u) + (adv > 0 ? 0.15 : 0));
    const def = effDef(t) * (1 - (o.pierce || 0));
    const mit = 1 / (1 + 0.6 * def / Math.max(1, effAtk(u)));
    let d = raw * mit;
    d *= adv > 0 ? 1.25 + (u.flags.advDmg || 0) : adv < 0 ? 0.85 : 1;
    if (crit) d *= 1 + (u.st.cd || 0.5);
    if (glance) d *= 0.7;
    d *= 1 + (o.bonus || 0);
    if (has(t, 'mark')) d *= 1.25;
    d *= 1 - passiveV(t, 'reduceDmg');
    d *= B.rng.range(0.95, 1.05);
    d = Math.max(1, Math.round(d));
    const dealt = applyDamage(B, u, t, d, { crit, glance, adv, kind: o.kind });
    if (crit && u.alive) {
        const ca = passiveV(u, 'critAtb');
        if (ca) addAtb(B, u, ca);
    }
    // reflect / thorns
    const refl = (t.flags.reflect || 0) + passiveV(t, 'thorns');
    if (refl && u.alive && o.kind !== 'counter') applyDamage(B, null, u, Math.round(dealt * refl), { reflect: true });
    return { dmg: dealt, crit };
}

function applyDamage(B, src, t, v, o = {}) {
    if (!t.alive) return 0;
    let absorbed = 0;
    const sh = stat(t, 'shield');
    if (sh && !o.dot) {
        absorbed = Math.min(sh.value, v);
        sh.value -= absorbed;
        v -= absorbed;
        if (sh.value <= 0) removeStatus(B, t, 'shield');
    }
    let hp = t.hp - v;
    if (hp <= 0) {
        if (has(t, 'endure')) { hp = 1; B.events.push({ t: 'endure', u: t.uid }); }
        else if (t.flags.angel && !t.angelUsed) { hp = 1; t.angelUsed = true; B.events.push({ t: 'angel', u: t.uid }); }
    }
    const dealt = Math.max(0, t.hp - Math.max(0, hp));
    t.hp = Math.max(0, hp);
    if (src) {
        B.stats.dealt[src.uid] = (B.stats.dealt[src.uid] || 0) + dealt + absorbed;
    }
    B.stats.taken[t.uid] = (B.stats.taken[t.uid] || 0) + dealt;
    B.events.push({ t: 'dmg', u: t.uid, src: src ? src.uid : 0, v: v + absorbed, absorbed, crit: !!o.crit, glance: !!o.glance, adv: o.adv || 0, dot: o.dot, reflect: o.reflect, hp: t.hp, kind: o.kind });
    if (t.boss && !t.enraged && t.hp > 0 && t.hp < t.maxHp * 0.5) {
        t.enraged = true;
        B.events.push({ t: 'enrage', u: t.uid });
    }
    if (t.hp <= 0) die(B, t, src);
    return dealt;
}

function die(B, t, src) {
    t.alive = false;
    t.statuses = [];
    t.atb = 0;
    B.events.push({ t: 'death', u: t.uid });
    if (t.side === 'A') B.stats.deaths++;
    if (src) {
        B.stats.kills[src.uid] = (B.stats.kills[src.uid] || 0) + 1;
        const kh = passiveV(src, 'onKillHeal');
        if (kh && src.alive) heal(B, src, src, src.maxHp * kh, true);
    }
    // revenge passives on the fallen unit's team
    for (const f of living(friendsOf(B, t))) {
        const rv = passiveV(f, 'revenge');
        if (rv) { addAtb(B, f, rv); addStatus(B, f, f, 'atkUp', 2); }
    }
}

function heal(B, src, t, amount, quiet = false) {
    if (!t.alive || has(t, 'healBlock')) return 0;
    let a = amount * (1 + passiveV(src, 'healBoost'));
    if (has(t, 'poison')) a *= 0.5;
    a = Math.round(Math.min(a, t.maxHp - t.hp));
    if (a <= 0) return 0;
    t.hp += a;
    B.stats.healed[src.uid] = (B.stats.healed[src.uid] || 0) + a;
    B.events.push({ t: 'heal', u: t.uid, v: a, hp: t.hp, quiet });
    return a;
}

function addAtb(B, u, v) {
    if (!u.alive) return;
    u.atb = Math.max(0, Math.min(1.5, u.atb + v));
    B.events.push({ t: 'atb', u: u.uid, v, atb: u.atb });
}

function removeStatus(B, u, id) {
    const i = u.statuses.findIndex((s) => s.id === id);
    if (i < 0) return;
    u.statuses.splice(i, 1);
    B.events.push({ t: 'status', u: u.uid, s: id, add: false });
}

/** Applies a status. Debuffs from enemies check immunity and resistance. */
export function addStatus(B, src, t, id, turns, o = {}) {
    if (!t.alive) return false;
    const S = STATUS[id];
    if (!S.buff) {
        if (has(t, 'immunity')) { B.events.push({ t: 'resist', u: t.uid, immune: true }); return false; }
        if (src && src.side !== t.side) {
            const chance = o.chance ?? 1;
            const resist = Math.max(0.15, (t.st.res || 0) - (src.st.acc || 0));
            if (!B.rng.chance(chance)) return false;
            if (B.rng.chance(resist)) { B.events.push({ t: 'resist', u: t.uid }); return false; }
        }
    }
    let s = stat(t, id);
    if (s) {
        s.turns = Math.max(s.turns, turns);
        if (S.stack) s.stacks = Math.min(S.stack, s.stacks + 1);
        if (id === 'shield') s.value = Math.max(s.value, o.value || 0);
        if (id === 'provoke') s.src = src.uid;
    } else {
        s = { id, turns, stacks: 1, value: o.value || 0, src: src ? src.uid : 0 };
        t.statuses.push(s);
    }
    B.events.push({ t: 'status', u: t.uid, s: id, add: true, stacks: s.stacks });
    return true;
}

function applyRider(B, u, t, e, s) {
    if (!t.alive) return;
    const lv = 1 + 0.05 * (s.lvl - 1);
    if (e.t === 'debuff') addStatus(B, u, t, e.s, e.d, { chance: Math.min(1, e.c * lv) });
    else if (e.t === 'atbDown') {
        if (B.rng.chance(Math.min(1, e.c * lv))) {
            const resist = Math.max(0.15, (t.st.res || 0) - (u.st.acc || 0));
            if (has(t, 'immunity') || B.rng.chance(resist)) B.events.push({ t: 'resist', u: t.uid });
            else addAtb(B, t, -e.v);
        }
    } else if (e.t === 'strip') {
        if (B.rng.chance(e.c)) {
            const buffs = t.statuses.filter((x) => STATUS[x.id].buff);
            for (const b of buffs.slice(0, e.n)) removeStatus(B, t, b.id);
        }
    }
}

function onHitProcs(B, u, t) {
    if (!t.alive) return;
    const p = u.passive && u.passive.tpl.p;
    if (p && p.type === 'onHitDebuff') addStatus(B, u, t, p.s, p.d, { chance: p.c });
    if (u.flags.stunOnHit && t.alive) addStatus(B, u, t, 'stun', 1, { chance: u.flags.stunOnHit });
}

function applySupport(B, u, e, s, ctx) {
    const allies = living(friendsOf(B, u));
    const lv = 1 + 0.05 * (s.lvl - 1);
    const who = (to) => to === 'self' ? [u] : to === 'allies' ? allies : to === 'lowest' ? [allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]] : [u];
    switch (e.t) {
        case 'buff': for (const a of who(e.to)) addStatus(B, u, a, e.s, e.d); break;
        case 'heal': for (const a of who(e.to)) heal(B, u, a, (e.by === 'caster' ? u.maxHp : a.maxHp) * e.p * lv); break;
        case 'shield': for (const a of who(e.to)) addStatus(B, u, a, 'shield', e.d, { value: Math.round(u.maxHp * e.p * lv) }); break;
        case 'atb': if (e.to) for (const a of who(e.to)) addAtb(B, a, e.v * lv); break;
        case 'cleanse':
            for (const a of who(e.to)) {
                const ds = a.statuses.filter((x) => !STATUS[x.id].buff).slice(0, e.n);
                for (const d of ds) removeStatus(B, a, d.id);
            }
            break;
        case 'revive': {
            const dead = friendsOf(B, u).filter((f) => !f.alive);
            if (dead.length) {
                const r = B.rng.pick(dead);
                r.alive = true; r.hp = Math.round(r.maxHp * e.p); r.atb = 0; r.statuses = [];
                B.events.push({ t: 'revive', u: r.uid, hp: r.hp });
            }
            break;
        }
        case 'extra':
            if ((!e.onKill || ctx.killed) && B.chain < 2 && B.rng.chance(e.c)) {
                // granted after endTurn resets the bar
                B.pendingExtra = u.uid;
            }
            break;
        default: break;
    }
}

// ---------------------------------------------------------------- overlord spells

export function canCast(B, id) {
    return !B.over && B.spells.includes(id) && B.mana >= SPELLS[id].cost && living(B.enemies).length > 0;
}

function teamAtk(B) {
    const a = living(B.allies);
    if (!a.length) return 0;
    return a.reduce((s, u) => s + effAtk(u), 0) / a.length;
}

export function castSpell(B, id, targetUid) {
    if (!canCast(B, id)) return false;
    const S = SPELLS[id];
    B.mana -= S.cost;
    B.stats.spells++;
    const foes = living(B.enemies), allies = living(B.allies);
    const power = teamAtk(B) * B.spellPower;
    const caster = { uid: 0, side: 'A', el: null, st: { acc: 0.5, cd: 0.5, cr: 0 }, flags: {}, hp: 1, maxHp: 1, alive: true, statuses: [] };
    let target = targetUid ? unitById(B, targetUid) : null;
    if (!target || !target.alive || target.side !== 'E') target = foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    B.events.push({ t: 'spell', id, targets: id === 'smite' ? [target.uid] : (['meteor', 'doom'].includes(id) ? foes : allies).map((x) => x.uid) });
    const spellHit = (t, mult) => {
        const mit = 1 / (1 + 0.6 * effDef(t) / Math.max(1, power));
        let d = Math.round(power * mult * mit * B.rng.range(0.95, 1.05) * (has(t, 'mark') ? 1.25 : 1));
        applyDamage(B, null, t, d, { kind: 'spell' });
    };
    switch (id) {
        case 'smite': {
            spellHit(target, 4.5);
            const b = target.statuses.find((x) => STATUS[x.id].buff);
            if (b && target.alive) removeStatus(B, target, b.id);
            break;
        }
        case 'meteor':
            for (const t of foes) { spellHit(t, 2.6); if (t.alive) addStatus(B, caster, t, 'burn', 2, { chance: 0.6 }); }
            break;
        case 'rally':
            for (const a of allies) { heal(B, a, a, a.maxHp * 0.22); addStatus(B, a, a, 'atkUp', 2); }
            break;
        case 'haste':
            for (const a of allies) addAtb(B, a, 0.35);
            break;
        case 'aegis':
            for (const a of allies) { addStatus(B, a, a, 'shield', 2, { value: Math.round(a.maxHp * 0.2) }); addStatus(B, a, a, 'immunity', 1); }
            break;
        case 'doom':
            for (const t of foes) { addStatus(B, caster, t, 'defDown', 2, { chance: 1 }); addStatus(B, caster, t, 'slow', 2, { chance: 1 }); }
            break;
        default: break;
    }
    B.events.push({ t: 'mana', v: B.mana });
    checkEnd(B);
    return true;
}

/** A sensible auto-cast for auto mode and bots. Returns the spell id cast, or null. */
export function autoSpell(B) {
    const allies = living(B.allies), foes = living(B.enemies);
    if (!foes.length || !allies.length) return null;
    const low = allies.reduce((s, u) => s + u.hp / u.maxHp, 0) / allies.length;
    const order = [];
    if (low < 0.6) order.push('rally', 'aegis');
    order.push('meteor', 'doom', 'haste', 'smite');
    if (low < 0.8) order.push('aegis');
    for (const id of order) {
        if (!canCast(B, id)) continue;
        if (id === 'doom' && foes.every((f) => has(f, 'defDown'))) continue;
        if (id === 'meteor' && foes.length < 2 && B.spells.includes('smite')) continue;
        castSpell(B, id);
        return id;
    }
    return null;
}

// ---------------------------------------------------------------- end

function checkEnd(B) {
    if (B.over) return;
    if (!living(B.allies).length) return finish(B, false);
    if (!living(B.enemies).length) {
        if (B.wave + 1 < B.waves.length) nextWave(B);
        else finish(B, true);
    }
}

function finish(B, win) {
    if (B.over) return;
    B.over = true;
    B.win = win;
    B.events.push({ t: 'end', win });
}

export function drainEvents(B) {
    const e = B.events;
    B.events = [];
    return e;
}

/** Runs a whole battle on auto. Used by tests, bots and "skip". */
export function runAuto(B, { spells = true, maxSteps = 5000 } = {}) {
    for (let i = 0; i < maxSteps && !B.over; i++) {
        if (spells) autoSpell(B);
        if (B.over) break;
        const { unit, skip } = nextTurn(B);
        if (!skip && unit) {
            const [si, tid] = aiChoose(B, unit);
            act(B, unit, si, tid);
        }
        drainEvents(B);
    }
    return B.win;
}
