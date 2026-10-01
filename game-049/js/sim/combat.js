/**
 * combat.js — the hero's derived stats, attack rolls, damage, statuses,
 * deaths, XP and loot. Shared by game.js, ai.js and bosses.js.
 *
 * Cross-module reactions (quests, Warden deaths, story) go through `hooks`,
 * which game.js fills in, so this module never imports them.
 */

import { makeRng } from './rng.js';
import { CLASSES, PERKS, xpToNext } from './classes.js';
import { SPECIES, makeMonster } from './monsters.js';
import { rollItem, makeConsumable } from './items.js';
import { T, TP, DIRS8, cheb } from './tiles.js';

export const hooks = { onKill: null, onPlayerDeath: null, onLevelUp: null };

export const R = (run) => makeRng(run.rng);

const EV_CAP = 900;
export function ev(run, e) {
    run._t.ev.push(e);
    if (run._t.ev.length > EV_CAP) run._t.ev.splice(0, run._t.ev.length - EV_CAP);
}
export function log(run, text, cls = '') {
    run.log.push({ text, cls, turn: run.turn });
    if (run.log.length > 80) run.log.splice(0, run.log.length - 80);
    ev(run, { t: 'msg', text, cls });
}

export const isPlayer = (a) => a && a.id === 0;
export const alive = (a) => a && a.hp > 0 && !a.dead;
export const perk = (run, k) => run.p.perks[k] || 0;

// ------------------------------------------------------------------ Hero stats

/** Everything derived from level, gear, perks and buffs. Cheap: recomputed on demand. */
export function pstats(run) {
    const p = run.p;
    const C = CLASSES[p.cls];
    const A = {};
    for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
        const it = p.eq[slot];
        if (!it) continue;
        for (const k in it.aff) A[k] = (A[k] || 0) + it.aff[k];
    }
    const pk = (k) => p.perks[k] || 0;
    const might = Math.floor(p.base.might) + (A.might || 0) + pk('might') * 2;
    const agi = Math.floor(p.base.agi) + (A.agi || 0) + pk('agi') * 2;
    const will = Math.floor(p.base.will) + (A.will || 0) + pk('will') * 2;
    const W = p.eq.weapon, Ar = p.eq.armor;
    const style = W ? W.style : 'melee';
    const statMul = style === 'ranged' ? agi : style === 'magic' ? will : might;
    const dmgMul = (1 + statMul * 0.04) * (1 + (A.dmg || 0) / 100 + pk('brute') * 0.12);
    const wd = W ? W.dmg : [1, 3];
    const hpMax = Math.round((C.hp + (p.lvl - 1) * C.hpLvl + might * 1.5 + (A.hp || 0) + p.bonusHp) * (1 + pk('tough') * 0.12));
    let light = 3 + Math.floor(p.embers / 2) + (A.light || 0) + pk('bright');
    light = Math.min(9, light);
    if (p.oil <= 0) light = 1;
    else if (p.oil < 25) light = Math.max(2, light - 1);
    if (run.lv && run.lv.boss && run.flags.dark) light = Math.min(light, 2);
    const s = {
        might, agi, will, hpMax, style,
        acc: Math.round(5 + agi * 2 + p.lvl + (W ? W.acc : 0) + (A.acc || 0) + pk('aim') * 8),
        eva: Math.round(3 + agi * 1.5 + p.lvl * 0.5 + (Ar ? Ar.eva : 0) + (A.eva || 0) + pk('nimble') * 6 + (p.st.evade ? 10 : 0)),
        arm: Math.round((Ar ? Ar.arm : 0) + (A.arm || 0) + pk('skin') * (2 + p.lvl / 8)),
        crit: (W ? W.crit : 3) + (A.crit || 0) + pk('keen') * 5,
        critMul: 1.75 + pk('keen') * 0.1,
        dmg: [Math.max(1, Math.round(wd[0] * dmgMul)), Math.max(1, Math.round(wd[1] * dmgMul))],
        range: W && W.range ? W.range : 1,
        spell: (3 + p.lvl * 1.15 + will * 0.9) * (1 + ((W && W.spell) || 0) / 100 + ((Ar && Ar.spell) || 0) / 100 + (A.spell || 0) / 100 + pk('channel') * 0.15),
        light,
        oilRate: Math.max(0.02, 0.08 * (1 - (A.oil || 0) / 100) * (1 - pk('lamp') * 0.25)),
        regen: (A.regen || 0) + pk('regen') * (1.6 + p.lvl / 8),
        rFire: Math.min(80, (A.rFire || 0) + pk('resist') * 20),
        rCold: Math.min(80, (A.rCold || 0) + pk('resist') * 20),
        rPoison: Math.min(80, (A.rPoison || 0) + pk('resist') * 20),
        steal: A.steal || 0, thorns: A.thorns || 0, gold: (A.gold || 0) + pk('gold') * 35, xp: (A.xp || 0) + pk('scholar') * 15,
        burn: A.burn || 0, freeze: A.freeze || 0, poison: A.poison || 0,
        stun: W && W.b === 'mace' ? 10 : 0,
        cdr: (A.cdr || 0) + pk('quick'),
    };
    return s;
}

// ------------------------------------------------------------------ Lookups

export function actorAt(run, x, y) {
    if (run.p.x === x && run.p.y === y && alive(run.p)) return run.p;
    for (const m of run.mons) if (m.x === x && m.y === y && alive(m)) return m;
    return null;
}
export function objAt(run, x, y) {
    for (const o of run.objs) if (o.x === x && o.y === y && !o.gone) return o;
    return null;
}
export const blockingObj = (o) => o && !o.gone && (o.k === 'chest' ? !o.open : o.k !== 'trap');
export const tileAt = (run, x, y) => run.lv.tiles[y * run.lv.w + x];
export const inBounds = (run, x, y) => x >= 0 && y >= 0 && x < run.lv.w && y < run.lv.h;

/** Can actor `a` stand on (x, y)? */
export function canEnter(run, a, x, y, ignoreActors = false) {
    if (!inBounds(run, x, y)) return false;
    const t = tileAt(run, x, y);
    const fly = !isPlayer(a) && SPECIES[a.sp] && SPECIES[a.sp].fly;
    if (!(TP[t].pass || (fly && TP[t].fly))) return false;
    if (blockingObj(objAt(run, x, y))) return false;
    if (!ignoreActors && actorAt(run, x, y)) return false;
    return true;
}

export const hostile = (a, b) => {
    if (!a || !b) return false;
    const ta = isPlayer(a) || a.ally, tb = isPlayer(b) || b.ally;
    return ta !== tb;
};

// ------------------------------------------------------------------ Statuses

export const STATUS = {
    burn: { n: 'Burning', dot: true, kind: 'fire' },
    poison: { n: 'Poisoned', dot: true, kind: 'poison' },
    bleed: { n: 'Bleeding', dot: true, kind: 'phys' },
    frozen: { n: 'Frozen' }, stun: { n: 'Stunned' }, root: { n: 'Rooted' },
    weak: { n: 'Weakened' }, mark: { n: 'Marked' }, haste: { n: 'Hasted' },
    shield: { n: 'Shielded' }, fear: { n: 'Afraid' }, evade: { n: 'Evasive' },
};

/** Apply a status for `turns`. `v` is dot damage per turn or shield strength. */
export function applyStatus(run, a, st, turns, v = 0) {
    if (!alive(a)) return;
    const S = SPECIES[a.sp];
    if (S && S.imm && S.imm.includes(st)) return;
    if (a.boss && (st === 'frozen' || st === 'stun' || st === 'fear')) { turns = Math.min(turns, 1); if (a.ai.ccImmune > 0) return; a.ai.ccImmune = 4; }
    if (st === 'frozen' && isPlayer(a)) { const r = pstats(run).rCold; if (R(run).chance(r / 100)) return; }
    // The hero can't be chain-locked: after a freeze or stun wears off, a short immunity.
    if (isPlayer(a) && (st === 'frozen' || st === 'stun')) {
        if (run.turn < (a.ccImmune || 0) || a.st.frozen || a.st.stun) return;
        turns = Math.min(turns, 2);
        a.ccImmune = run.turn + turns + 3;
    }
    const cur = a.st[st];
    if (cur) {
        cur.t = Math.max(cur.t, turns);
        if (st === 'poison') cur.v = Math.min(cur.v + v, v * 4); else cur.v = Math.max(cur.v, v);
    } else {
        a.st[st] = { t: turns, v };
        ev(run, { t: 'status', id: a.id, st });
    }
    if (st === 'burn' && a.st.frozen) delete a.st.frozen;
}

// ------------------------------------------------------------------ Attacks

const roll = (run, [a, b]) => R(run).int(a, b);

/**
 * One attack from `att` on `def`. opts: mult, ranged, kind ('arrow','fire'…), accBonus, noThorns, skill.
 * Returns the damage dealt (0 on a miss).
 */
export function attack(run, att, def, opts = {}) {
    if (!alive(att) || !alive(def)) return 0;
    const rng = R(run);
    const pa = isPlayer(att), pd = isPlayer(def);
    const as = pa ? pstats(run) : null;
    const ds = pd ? pstats(run) : null;
    let acc = (pa ? as.acc : att.acc) + (opts.accBonus || 0);
    if (!pa && run.p.oil <= 0) acc += 10;
    let eva = pd ? ds.eva : def.eva;
    if (def.st.frozen || def.st.stun || def.st.root || def.dormant) eva = Math.floor(eva / 2);
    if (opts.ranged && pa && cheb(att.x, att.y, def.x, def.y) <= 1 && as.style === 'ranged') acc -= 15;
    const chance = def.dormant ? 100 : Math.max(10, Math.min(97, 75 + acc - eva));
    ev(run, { t: 'atk', id: att.id, tx: def.x, ty: def.y, ranged: !!opts.ranged, kind: opts.kind });
    if (rng.int(1, 100) > chance) {
        ev(run, { t: 'miss', id: def.id });
        return 0;
    }
    let dmg = roll(run, pa ? as.dmg : att.dmg) * (opts.mult || 1);
    let crit = false;
    if (rng.int(1, 100) <= (pa ? as.crit : (att.elite ? 6 : 3))) { crit = true; dmg *= pa ? as.critMul : 1.5; }
    if (pa && perk(run, 'hunter') && opts.ranged && cheb(att.x, att.y, def.x, def.y) >= 3) dmg *= 1 + perk(run, 'hunter') * 0.15;
    if (att.st.weak) dmg *= 0.7;
    if (def.st.mark) dmg *= 1.5;
    if (def.st.shield) dmg *= 1 - def.st.shield.v;
    const arm = pd ? ds.arm : def.arm;
    dmg = Math.round(dmg - rng.int(0, arm));
    dmg = Math.max(1, dmg);
    const dealt = damage(run, def, dmg, { src: att, crit, kind: opts.kind || 'phys' });
    // On-hit effects.
    if (alive(def) && dealt > 0) {
        if (pa) {
            if (as.burn && rng.chance(as.burn / 100)) applyStatus(run, def, 'burn', 3, Math.max(1, Math.round(as.dmg[1] * 0.25)));
            if (as.freeze && rng.chance(as.freeze / 100)) applyStatus(run, def, 'frozen', 1);
            if (as.poison && rng.chance(as.poison / 100)) applyStatus(run, def, 'poison', 4, Math.max(1, Math.round(as.dmg[1] * 0.18)));
            if (as.stun && rng.chance(as.stun / 100)) applyStatus(run, def, 'stun', 1);
        } else {
            const S = SPECIES[att.sp];
            if (S && S.hit && rng.chance(S.hit.ch)) applyStatus(run, def, S.hit.st, S.hit.n, Math.max(1, Math.round(att.dmg[1] * 0.3)));
            if (att.aff.includes('burning') && rng.chance(0.5)) applyStatus(run, def, 'burn', 3, Math.max(1, Math.round(att.dmg[1] * 0.3)));
            if (att.aff.includes('frostbound') && rng.chance(0.2)) applyStatus(run, def, 'frozen', 1);
            if (S && S.oilDrain && pd) { run.p.oil = Math.max(0, run.p.oil - S.oilDrain); log(run, `The ${att.name} gulps your lantern oil!`, 'bad'); ev(run, { t: 'oilDrain' }); }
        }
    }
    if (dealt > 0) {
        // Lifesteal.
        if (pa && as.steal) heal(run, att, Math.round(dealt * as.steal / 100), true);
        if (!pa && att.aff.includes('vampiric')) heal(run, att, Math.round(dealt * 0.35), true);
        // Thorns (melee only).
        if (!opts.ranged && !opts.noThorns && alive(att)) {
            const th = pd ? ds.thorns : (def.aff.includes('thorned') ? 25 : 0);
            if (th) damage(run, att, Math.max(1, Math.round(dealt * th / 100)), { src: def, kind: 'thorns' });
        }
        // Sentinel counter.
        if (pd && !opts.ranged && perk(run, 'sentinel') && alive(att) && rng.chance(perk(run, 'sentinel') * 0.2)) {
            log(run, 'You counter!', 'good');
            attack(run, def, att, { noThorns: true });
        }
    }
    return dealt;
}

/** Deal `n` damage. Resistances and immunities apply. Returns what was dealt. */
export function damage(run, a, n, o = {}) {
    if (!alive(a)) return 0;
    if (isPlayer(a)) {
        const s = pstats(run);
        if (o.kind === 'fire') n *= 1 - s.rFire / 100;
        if (o.kind === 'cold') n *= 1 - s.rCold / 100;
        if (o.kind === 'poison') n *= 1 - s.rPoison / 100;
        if (run.flags.god) n = 0;
    } else {
        const S = SPECIES[a.sp];
        if (o.kind === 'fire' && S && S.imm && S.imm.includes('burn')) n *= 0.25;
        if (o.kind === 'fire' && S && S.weakFire) n *= 1.6;
        if (a.ai.invuln) n = 0;
    }
    n = Math.max(0, Math.round(n));
    if (n <= 0 && !run.flags.god) n = o.kind === 'phys' || o.kind === 'thorns' ? 1 : 0;
    a.hp -= n;
    ev(run, { t: 'dmg', id: a.id, n, crit: !!o.crit, kind: o.kind || 'phys', x: a.x, y: a.y });
    if (a.dormant) { a.dormant = false; a.awake = true; ev(run, { t: 'reveal', id: a.id }); }
    if (!isPlayer(a)) { a.awake = true; if (a.st.frozen && o.kind !== 'cold') delete a.st.frozen; }
    if (isPlayer(a) && o.src) run.p.lastHit = o.src.name || o.src;
    if (a.hp <= 0) kill(run, a, o.src);
    else if (isPlayer(a)) checkSecondWind(run);
    return n;
}

export function heal(run, a, n, quiet = false) {
    if (!alive(a) || n <= 0) return 0;
    const max = isPlayer(a) ? pstats(run).hpMax : a.hpMax;
    const before = a.hp;
    a.hp = Math.min(max, a.hp + Math.round(n));
    const got = a.hp - before;
    if (got > 0) ev(run, { t: 'heal', id: a.id, n: got, quiet, x: a.x, y: a.y });
    return got;
}

function checkSecondWind(run) {
    const p = run.p;
    if (!perk(run, 'second') || p.secondWind) return;
    const s = pstats(run);
    if (p.hp < s.hpMax * 0.25) {
        p.secondWind = true;
        heal(run, p, s.hpMax * 0.4);
        log(run, 'Second wind! You steady yourself.', 'good');
    }
}

// ------------------------------------------------------------------ Death

export function kill(run, a, src) {
    if (a.dead) return;
    if (isPlayer(a)) {
        a.hp = 0;
        ev(run, { t: 'die', id: 0, x: a.x, y: a.y });
        if (hooks.onPlayerDeath) hooks.onPlayerDeath(run, src);
        return;
    }
    a.dead = true; a.hp = 0;
    ev(run, { t: 'die', id: a.id, x: a.x, y: a.y, boss: !!a.boss, elite: !!a.elite });
    const byHero = !src || isPlayer(src) || src.ally || src === 'hero';
    if (a.ally) { log(run, `${a.name} falls!`, 'bad'); }
    else if (byHero || a.boss) {
        const s = pstats(run);
        run.stats.kills++;
        run.stats.killsBy[a.sp] = (run.stats.killsBy[a.sp] || 0) + 1;
        if (a.xp) gainXp(run, a.xp);
        if (perk(run, 'vamp')) heal(run, run.p, s.hpMax * 0.03 * perk(run, 'vamp'), true);
        dropLoot(run, a);
    }
    const rng = R(run);
    if (a.aff.includes('splitting') && !a.split) {
        for (let k = 0; k < 2; k++) {
            const c = freeNear(run, a.x, a.y, a);
            if (!c) break;
            const m = makeMonster(run, a.sp, c[0], c[1], a.lvl, rng);
            m.hpMax = m.hp = Math.max(1, Math.round(a.hpMax * 0.25));
            m.split = true; m.awake = true; m.size = a.size * 0.75;
            m.name = `Shard of ${a.ename}`;
            run.mons.push(m);
            ev(run, { t: 'spawn', id: m.id });
        }
    }
    if (a.aff.includes('volatile')) {
        const tiles = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(run, a.x + dx, a.y + dy)) tiles.push((a.y + dy) * run.lv.w + a.x + dx);
        run.hazards.push({ id: run.nextId++, tiles, t: 1, dmg: Math.round(a.dmg[1] * 1.6), kind: 'fire', owner: a.id, st: { k: 'burn', n: 2 } });
        ev(run, { t: 'hazard', tiles, kind: 'fire' });
        log(run, `${a.name} begins to blaze — get clear!`, 'warn');
    }
    if (hooks.onKill) hooks.onKill(run, a, src);
}

export function freeNear(run, x, y, who, radius = 2) {
    const rng = R(run);
    for (let r = 1; r <= radius; r++) {
        const c = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (canEnter(run, who || { id: -1 }, x + dx, y + dy)) c.push([x + dx, y + dy]);
        }
        if (c.length) return rng.pick(c);
    }
    return null;
}

// ------------------------------------------------------------------ XP & loot

export function gainXp(run, n) {
    const p = run.p;
    n = Math.round(n * (1 + pstats(run).xp / 100));
    p.xp += n;
    while (p.xp >= xpToNext(p.lvl)) {
        p.xp -= xpToNext(p.lvl);
        p.lvl++;
        const C = CLASSES[p.cls];
        for (const k of ['might', 'agi', 'will']) p.base[k] += C.grow[k];
        const s = pstats(run);
        p.hp = Math.min(s.hpMax, p.hp + C.hpLvl + 4);
        run.perkQ++;
        log(run, `You reach level ${p.lvl}!`, 'good');
        ev(run, { t: 'levelup', lvl: p.lvl });
        if (hooks.onLevelUp) hooks.onLevelUp(run);
    }
}

export function dropLoot(run, m) {
    const rng = R(run);
    const f = run.floor;
    const S = SPECIES[m.sp];
    if (m.boss || m.ally || (S && S.a === 'nest')) return;
    const goldMul = 1 + pstats(run).gold / 100;
    if (rng.chance(m.elite ? 1 : 0.28)) dropAt(run, m.x, m.y, { k: 'gold', n: Math.round(rng.int(2, 6) * (1 + f * 0.12) * goldMul * (m.elite ? 3 : 1)), id: run.nextId++ });
    let pItem = m.elite ? 1 : 0.1 + (S.a === 'brute' || S.a === 'tank' ? 0.05 : 0);
    if (m.sp === 'mimic') pItem = 1;
    if (rng.chance(pItem)) dropAt(run, m.x, m.y, rollItem(run, rng, f, m.elite || m.sp === 'mimic' ? 'gear' : undefined, m.elite ? 1 : 0));
    if (m.sp === 'mimic') dropAt(run, m.x, m.y, rollItem(run, rng, f, 'cons'));
    if (rng.chance(0.04 + perk(run, 'potion') * 0.04)) dropAt(run, m.x, m.y, makeConsumable(run, 'heal'));
}

/** Put an item on the floor at (x,y), sliding to a neighbour if that tile can't hold items. */
export function dropAt(run, x, y, it) {
    let tx = x, ty = y;
    const t = tileAt(run, x, y);
    if (!TP[t].pass || t === T.STAIRS_DOWN) {
        for (const [dx, dy] of DIRS8) {
            const X = x + dx, Y = y + dy;
            if (inBounds(run, X, Y) && TP[tileAt(run, X, Y)].pass && tileAt(run, X, Y) !== T.STAIRS_DOWN) { tx = X; ty = Y; break; }
        }
    }
    run.items.push({ id: it.id, x: tx, y: ty, it });
    ev(run, { t: 'drop', id: it.id, x: tx, y: ty });
}
