// The auto-battle. Pure: a party and a line of Hollows go in, a result and a timeline come out. The view replays
// the timeline (with speed and skip); the sim has already settled the result. Time is in seconds; each unit acts
// every 10 / SPD seconds, earliest first (allies before Hollows on a tie, then front to back).
//
// Log entries: { t, e, a, b, v, ... } where a and b are unit keys ('a0'–'a3' for the party, 'f0'–'f4' for the
// Hollows). e is one of: act (a, skill?), hit (a→b, v, crit, adv, pierce), miss, dodge, heal (b, v), shield (b, v),
// burn (b, v), stun (b), stunned (a), buff / debuff (b, stat, by), cleanse (b), die (b), rise (b, v), phase (a, name, el),
// taunt (a), wheel (a, v), timeout, end (won).

import { CARDS, ELEMENTS, RARITY_BASE, SUIT_INFO } from './data/cards.js';
import { ENEMIES } from './data/enemies.js';
import { ADVANTAGE, DISADVANTAGE, CRIT_MULT, DEF_CAP, BATTLE_CAP, BEAT, STAR_GROWTH, SHIELD_CAP } from '../config.js';

/** A card's numbers at a star level. */
export function cardStats(id, star = 1) {
    const c = CARDS[id], b = RARITY_BASE[c.rarity], g = 1 + STAR_GROWTH * (star - 1);
    return {
        hp: Math.round(b.hp * c.mod.hp * g), atk: Math.round(b.atk * c.mod.atk * g),
        spd: +(b.spd * c.mod.spd).toFixed(2), def: c.mod.def,
    };
}

/** Suit resonance from the party's cards: two or more of one suit (or of the Major Arcana) lend a bonus. */
export function resonance(ids) {
    const n = { wands: 0, cups: 0, swords: 0, pentacles: 0, major: 0 };
    for (const id of ids) if (id) n[CARDS[id].suit]++;
    const r = { atk: 0, heal: 0, spd: 0, def: 0, crit: 0, shield: 0, charge: 0, regen: 0, list: [] };
    const tier = (k) => (n[k] >= 3 ? 2 : n[k] >= 2 ? 1 : 0);
    const T = { wands: tier('wands'), cups: tier('cups'), swords: tier('swords'), pentacles: tier('pentacles'), major: tier('major') };
    if (T.wands) { r.atk += T.wands === 2 ? 0.2 : 0.1; r.list.push({ suit: 'wands', tier: T.wands, text: T.wands === 2 ? 'ATK +20%' : 'ATK +10%' }); }
    if (T.cups) { r.heal += T.cups === 2 ? 0.5 : 0.25; if (T.cups === 2) r.regen = 0.02; r.list.push({ suit: 'cups', tier: T.cups, text: T.cups === 2 ? 'Healing +50%, regeneration' : 'Healing +25%' }); }
    if (T.swords) { r.spd += T.swords === 2 ? 0.2 : 0.1; if (T.swords === 2) r.crit = 0.1; r.list.push({ suit: 'swords', tier: T.swords, text: T.swords === 2 ? 'SPD +20%, crits +10%' : 'SPD +10%' }); }
    if (T.pentacles) { r.def += T.pentacles === 2 ? 0.12 : 0.06; if (T.pentacles === 2) r.shield = 0.1; r.list.push({ suit: 'pentacles', tier: T.pentacles, text: T.pentacles === 2 ? 'DEF +12, a 10% shield' : 'DEF +6' }); }
    if (T.major) { r.charge = T.major; r.list.push({ suit: 'major', tier: T.major, text: T.major === 2 ? 'Skills start 2 charges in' : 'Skills start 1 charge in' }); }
    r.counts = n;
    return r;
}

/** How an element fares against another: 1.35, 1 or 0.75. */
export function elemMult(a, b) {
    if (!a || !b) return 1;
    if (ELEMENTS[a]?.beats === b) return ADVANTAGE;
    if (ELEMENTS[b]?.beats === a) return DISADVANTAGE;
    return 1;
}

function makeUnit(side, i, src) {
    return {
        key: (side === 0 ? 'a' : 'f') + i, side, i, id: src.id, name: src.name, el: src.el, suit: src.suit || null,
        maxHp: src.hp, hp: src.hp, atk: src.atk, def: src.def, spd: src.spd,
        skill: src.skill || null, cost: src.skill?.cost || 0, charge: src.charge || 0,
        aim: src.aim || 'front', next: 0, alive: true, shield: src.shield || 0, buffs: [], burns: [], stun: false, blind: null,
        dodge: src.dodgeN || 0, dodgeP: src.dodge || 0, taunt: 0, critP: src.crit || 0, healMult: src.healMult || 1,
        regen: src.regen || 0, poison: src.poison || 0, undying: src.undying || 0, rose: false,
        deathBlast: src.deathBlast || 0, thorns: src.thorns || 0, harvest: src.harvest || 0,
        shieldAt: src.shieldAt || null, chargeHit: !!src.chargeHit, phases: src.phases ? src.phases.map((p) => ({ ...p })) : null,
        revived: false, boss: !!src.boss, elite: !!src.elite, opener: src.opener || null,
    };
}

/**
 * Resolve a battle.
 * allies: [{ id, name, el, suit, hp, atk, def, spd, skill, crit, healMult, regen, poison, charge, shieldPct }]
 * foes:   [{ id, name, el, hp, atk, def, spd, skill, aim, dodge, ... }]
 * rng: the run's seeded generator.
 */
export function resolve(allies, foes, rng) {
    const A = allies.map((s, i) => makeUnit(0, i, s));
    const F = foes.map((s, i) => makeUnit(1, i, s));
    const all = [...A, ...F];
    const log = [];
    let t = 0;
    const L = (e) => { e.t = +t.toFixed(3); log.push(e); };
    const side = (u) => (u.side === 0 ? A : F);
    const other = (u) => (u.side === 0 ? F : A);
    const live = (arr) => arr.filter((u) => u.alive);
    const stat = (u, s) => {
        let m = 1;
        for (const b of u.buffs) if (b.stat === s) m += b.by;
        if (s === 'def') return Math.max(0, Math.min(DEF_CAP, u.def + (m - 1)));
        return Math.max(0.2, m) * u[s];
    };
    const interval = (u) => BEAT / Math.max(1, stat(u, 'spd'));

    // stagger the first actions a little so a line doesn't move as one
    for (const u of all) u.next = interval(u) * (0.35 + rng() * 0.4);

    // --- targeting
    function front(arr) {
        const l = live(arr);
        return l.find((u) => u.taunt > 0) || l[0] || null;
    }
    function pick(u, to) {
        const foesOf = other(u), mine = side(u);
        const lf = live(foesOf), lm = live(mine);
        switch (to) {
            case 'front': { const f = front(foesOf); return f ? [f] : []; }
            case 'two': { const f = front(foesOf); if (!f) return []; const n = lf.find((x) => x !== f); return n ? [f, n] : [f]; }
            case 'back': return lf.length ? [lf[lf.length - 1]] : [];
            case 'rand': return lf.length ? [lf[Math.floor(rng() * lf.length)]] : [];
            case 'all': return lf;
            case 'high': return lf.length ? [lf.reduce((a, b) => (b.hp > a.hp ? b : a))] : [];
            case 'lowFoe': return lf.length ? [lf.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))] : [];
            case 'self': return [u];
            case 'allies': return lm;
            case 'low': return lm.length ? [lm.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))] : [];
            default: return [];
        }
    }

    // --- harm and help
    function absorb(tgt, dmg) {
        if (tgt.shield > 0) { const s = Math.min(tgt.shield, dmg); tgt.shield -= s; dmg -= s; }
        return dmg;
    }
    function wound(tgt, amount, src) {
        if (!tgt.alive) return 0;
        const left = absorb(tgt, amount);
        tgt.hp -= left;
        if (tgt.shieldAt && !tgt.shieldAt.used && tgt.hp > 0 && tgt.hp / tgt.maxHp < tgt.shieldAt[0]) {
            tgt.shieldAt.used = true;
            const v = Math.round(tgt.shieldAt[1] * tgt.maxHp);
            tgt.shield += v;
            L({ e: 'shield', a: tgt.key, b: tgt.key, v, why: 'guard' });
        }
        if (tgt.phases && tgt.hp > 0) {
            for (const p of tgt.phases) {
                if (p.done || tgt.hp / tgt.maxHp >= p.below) continue;
                p.done = true;
                tgt.el = p.el;
                L({ e: 'phase', a: tgt.key, name: p.name, el: p.el });
                applyFx(tgt, p.fx, p.name);
            }
        }
        if (tgt.hp <= 0) die(tgt, src);
        return left;
    }
    function die(u, src) {
        u.hp = 0;
        u.alive = false;
        u.buffs = []; u.burns = []; u.shield = 0; u.taunt = 0; u.stun = false;
        L({ e: 'die', b: u.key });
        if (u.undying && !u.rose) {
            u.rose = true;
            u.alive = true;
            u.hp = Math.round(u.undying * u.maxHp);
            L({ e: 'rise', b: u.key, v: u.hp });
            return;
        }
        for (const m of live(side(u))) {
            if (m.harvest) { const v = heal(m, m.harvest * m.maxHp); if (v) L({ e: 'heal', a: m.key, b: m.key, v }); }
        }
        if (u.deathBlast) {
            for (const v of live(other(u))) hit(u, v, u.deathBlast, { blast: true });
        }
    }
    function heal(u, amount) {
        if (!u.alive) return 0;
        const v = Math.max(0, Math.min(Math.round(amount), u.maxHp - u.hp));
        u.hp += v;
        return v;
    }
    function hit(src, tgt, x, opt = {}) {
        if (!tgt || !tgt.alive) return 0;
        if (!opt.blast) {
            if (tgt.dodge > 0) { tgt.dodge--; L({ e: 'dodge', a: src.key, b: tgt.key }); return 0; }
            if (tgt.dodgeP && rng() < tgt.dodgeP) { L({ e: 'dodge', a: src.key, b: tgt.key }); return 0; }
            if (src.blind && rng() < src.blind.p) { L({ e: 'miss', a: src.key, b: tgt.key }); return 0; }
        }
        const adv = elemMult(src.el, tgt.el);
        let dmg = stat(src, 'atk') * x * adv;
        const crit = !opt.blast && src.critP > 0 && rng() < src.critP;
        if (crit) dmg *= CRIT_MULT;
        if (src.chargeHit) { dmg *= 2; src.chargeHit = false; }
        const def = opt.pierce ? 0 : stat(tgt, 'def');
        dmg = Math.max(1, Math.round(dmg * (1 - def)));
        L({ e: 'hit', a: src.key, b: tgt.key, v: dmg, crit, adv: adv > 1 ? 1 : adv < 1 ? -1 : 0, pierce: !!opt.pierce, blast: !!opt.blast });
        const dealt = wound(tgt, dmg, src);
        if (tgt.thorns && src.alive && !opt.blast) {
            const back = Math.max(1, Math.round(dmg * tgt.thorns));
            L({ e: 'hit', a: tgt.key, b: src.key, v: back, thorns: true, adv: 0 });
            wound(src, back, tgt);
        }
        if (opt.drain && src.alive) { const v = heal(src, dmg / 2); if (v) L({ e: 'heal', a: src.key, b: src.key, v }); }
        return dealt;
    }

    function applyFx(u, fx, skillName) {
        for (const f of fx) {
            if (!u.alive && f.k !== 'revive') return;
            switch (f.k) {
                case 'dmg': for (const v of pick(u, f.to === 'low' ? 'lowFoe' : f.to)) hit(u, v, f.x, f); break;
                case 'heal':
                    for (const v of pick(u, f.to)) {
                        const amt = f.pct ? f.pct * v.maxHp : f.x * stat(u, 'atk') * u.healMult;
                        const got = heal(v, amt);
                        L({ e: 'heal', a: u.key, b: v.key, v: got });
                    }
                    break;
                case 'shield':
                    for (const v of pick(u, f.to)) {
                        // shields stack, but never past SHIELD_CAP of the target's max HP
                        const amt = Math.max(0, Math.min(Math.round(f.pct * v.maxHp * (u.side === 0 ? u.healMult : 1)), Math.round(SHIELD_CAP * v.maxHp) - v.shield));
                        v.shield += amt;
                        L({ e: 'shield', a: u.key, b: v.key, v: amt });
                    }
                    break;
                case 'buff':
                    for (const v of pick(u, f.to)) { v.buffs.push({ stat: f.stat, by: f.by, n: f.n }); L({ e: 'buff', a: u.key, b: v.key, stat: f.stat, by: f.by }); }
                    break;
                case 'debuff':
                    for (const v of pick(u, f.to === 'low' ? 'lowFoe' : f.to)) { v.buffs.push({ stat: f.stat, by: f.by, n: f.n }); L({ e: 'debuff', a: u.key, b: v.key, stat: f.stat, by: f.by }); }
                    break;
                case 'burn':
                    for (const v of pick(u, f.to)) { v.burns.push({ v: Math.max(1, Math.round(f.x * stat(u, 'atk'))), n: f.n, src: u.key }); L({ e: 'burn', a: u.key, b: v.key }); }
                    break;
                case 'stun':
                    for (const v of pick(u, f.to)) if (rng() < f.p) { v.stun = true; L({ e: 'stun', a: u.key, b: v.key }); }
                    break;
                case 'blind':
                    for (const v of pick(u, f.to)) { v.blind = { p: f.p, n: f.n }; L({ e: 'debuff', a: u.key, b: v.key, stat: 'blind', by: -f.p }); }
                    break;
                case 'cleanse':
                    for (const v of pick(u, f.to)) {
                        v.burns = []; v.blind = null; v.stun = false;
                        v.buffs = v.buffs.filter((b) => b.by > 0);
                        L({ e: 'cleanse', a: u.key, b: v.key });
                    }
                    break;
                case 'revive': {
                    if (u.revived) break;
                    const fallen = side(u).filter((m) => !m.alive && m !== u);
                    const raise = f.all ? fallen : fallen.slice(0, 1);
                    if (!raise.length) break;
                    u.revived = true;
                    for (const m of raise) {
                        m.alive = true;
                        m.hp = Math.round(f.pct * m.maxHp);
                        m.next = t + interval(m) * 0.5;
                        L({ e: 'rise', a: u.key, b: m.key, v: m.hp });
                    }
                    break;
                }
                case 'execute':
                    for (const v of pick(u, 'lowFoe')) {
                        if (v.hp / v.maxHp < f.below && !v.boss) { L({ e: 'hit', a: u.key, b: v.key, v: v.hp, crit: true, adv: 0, execute: true }); wound(v, v.hp + v.shield, u); }
                        else hit(u, v, f.x);
                    }
                    break;
                case 'delay':
                    for (const v of pick(u, f.to)) { v.next += f.s; L({ e: 'debuff', a: u.key, b: v.key, stat: 'delay', by: -f.s }); }
                    break;
                case 'dodge': u.dodge += f.n; L({ e: 'buff', a: u.key, b: u.key, stat: 'dodge', by: f.n }); break;
                case 'taunt': u.taunt = f.n; L({ e: 'taunt', a: u.key }); break;
                case 'wheel': {
                    const roll = Math.floor(rng() * 3);
                    L({ e: 'wheel', a: u.key, v: roll });
                    if (roll === 0) applyFx(u, [{ k: 'dmg', to: 'all', x: 1.6 }], skillName);
                    else if (roll === 1) applyFx(u, [{ k: 'heal', to: 'allies', x: 1.2 }], skillName);
                    else applyFx(u, [{ k: 'stun', to: 'all', p: 1 }], skillName);
                    break;
                }
                default: break;
            }
        }
    }

    function act(u) {
        // ailments first
        if (u.burns.length) {
            for (const b of u.burns) {
                if (!u.alive) break;
                b.n--;
                L({ e: 'hit', a: b.src, b: u.key, v: b.v, dot: true, adv: 0 });
                wound(u, b.v, null);
            }
            u.burns = u.burns.filter((b) => b.n > 0);
            if (!u.alive) return;
        }
        if (u.poison) {
            const v = Math.max(1, Math.round(u.poison * u.maxHp));
            L({ e: 'hit', a: u.key, b: u.key, v, dot: true, poison: true, adv: 0 });
            wound(u, v, null);
            if (!u.alive) return;
        }
        if (u.regen) { const v = heal(u, u.regen * u.maxHp); if (v) L({ e: 'heal', a: u.key, b: u.key, v, regen: true }); }
        if (u.stun) { u.stun = false; L({ e: 'stunned', a: u.key }); tick(u); return; }
        u.charge++;
        if (u.skill && u.charge >= u.cost) {
            u.charge = 0;
            L({ e: 'act', a: u.key, skill: u.skill.name });
            applyFx(u, u.skill.fx, u.skill.name);
        } else {
            const tg = pick(u, u.side === 0 ? 'front' : (u.aim === 'low' ? 'lowFoe' : u.aim))[0];
            L({ e: 'act', a: u.key, b: tg?.key });
            if (tg) hit(u, tg, 1);
        }
        tick(u);
    }
    function tick(u) {
        for (const b of u.buffs) b.n--;
        u.buffs = u.buffs.filter((b) => b.n > 0);
        if (u.blind && --u.blind.n <= 0) u.blind = null;
        if (u.taunt > 0) u.taunt--;
    }

    // --- the battle
    for (const u of all) if (u.opener) applyFx(u, u.opener, 'opener');
    let won = null;
    let guard = 0;
    while (guard++ < 20000) {
        if (!live(F).length) { won = true; break; }
        if (!live(A).length) { won = false; break; }
        let u = null;
        for (const c of all) if (c.alive && (!u || c.next < u.next - 1e-9)) u = c;
        if (u.next > BATTLE_CAP) { t = BATTLE_CAP; L({ e: 'timeout' }); won = false; break; }
        t = u.next;
        act(u);
        u.next = t + interval(u);
    }
    L({ e: 'end', won: !!won });
    return {
        won: !!won, t: +t.toFixed(2), log,
        allies: A.map((u) => ({ key: u.key, id: u.id, hp: u.hp, maxHp: u.maxHp, alive: u.alive })),
        foes: F.map((u) => ({ key: u.key, id: u.id, hp: u.hp, maxHp: u.maxHp, alive: u.alive })),
        survivors: A.filter((u) => u.alive).length,
    };
}

/** The units as they stand at the start, for the view (names, elements, numbers). */
export function lineup(allies, foes) {
    return {
        allies: allies.map((s, i) => ({ key: 'a' + i, id: s.id, name: s.name, el: s.el, suit: s.suit, hp: s.hp, atk: s.atk, spd: s.spd, def: s.def, shield: s.shield || 0, cost: s.skill?.cost || 0, charge: s.charge || 0 })),
        foes: foes.map((s, i) => ({ key: 'f' + i, id: s.id, name: s.name, el: s.el, hp: s.hp, atk: s.atk, spd: s.spd, def: s.def, shield: s.shield || 0, elite: !!s.elite, boss: !!s.boss, cost: s.skill?.cost || 0, charge: 0 })),
    };
}

export { SUIT_INFO, ENEMIES };
