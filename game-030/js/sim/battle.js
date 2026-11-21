// Turn-based battles. Every round the living are ordered by speed; a hero's turn waits for a command, a foe's turn
// is played by the AI at once. Every foe plays differently (js/sim/data/enemies.js): Cog Sprites swarm and dodge,
// Rust Crabs shell up and pinch (rust), Lane Bandits pick your pockets (kill one to get the gold back), Gear-Wolves
// howl and go for the weak, and Big Bertha telegraphs a slam, calls her cogs when hurt and loses her temper.
// Statuses: stun, rust, weak, atkup, taunt, guard, dodge. Everything that happens is pushed to G.events for the
// stage to play. Pure.

import { PARTY } from './data/party.js';
import { ENEMIES, GROUPS } from './data/enemies.js';
import { ITEMS } from './data/items.js';
import { stats, abilitiesOf, addXp, give, take, checkQuests } from './rules.js';
import { next, chance, pickWeighted } from '../rng.js';
import {
    CRIT_CHANCE, CRIT_MULT, PHYS_DEF, MAGIC_DEF, VARIANCE, GUARD_MULT,
    WEAK_MULT, ATKUP_MULT, RUST_MULT, DEFEND_MP, FLEE_BASE,
} from '../config.js';

export const STATUS_NAMES = { stun: 'Stun', rust: 'Rust', weak: 'Weak', atkup: 'ATK Up', taunt: 'Taunt', guard: 'Guard', dodge: 'Evade' };
const BAD = new Set(['stun', 'rust', 'weak']);

function makeFoe(id, name) {
    const e = ENEMIES[id];
    return { side: 'e', id, name, hp: e.hp, mhp: e.hp, mp: 0, mmp: 0, atk: e.atk, def: e.def, spd: e.spd, st: {}, cds: {}, boss: !!e.boss, stolen: 0 };
}

export function startBattle(G, groupId, opts = {}) {
    const keys = GROUPS[groupId];
    if (!keys) throw new Error('unknown group ' + groupId);
    const units = [];
    for (const id of G.party) {
        const s = stats(G, id);
        units.push({ side: 'p', id, name: PARTY[id].name, hp: G.hp[id], mhp: s.mhp, mp: G.mp[id], mmp: s.mmp, atk: s.atk, def: s.def, spd: s.spd, st: {}, cds: {} });
    }
    const counts = {};
    for (const k of keys) counts[k] = (counts[k] || 0) + 1;
    const seen = {};
    for (const k of keys) {
        seen[k] = (seen[k] || 0) + 1;
        units.push(makeFoe(k, counts[k] > 1 ? `${ENEMIES[k].name} ${'ABCDEF'[seen[k] - 1]}` : ENEMIES[k].name));
    }
    G.battle = {
        group: groupId, units, round: 0, order: [], turn: 0, await: null, over: null,
        boss: !!opts.boss, eventId: opts.eventId || null, canFlee: !opts.boss, rewards: null,
        snap: { hp: { ...G.hp }, mp: { ...G.mp }, inv: { ...G.inv }, gold: G.gold },
    };
    G.mode = 'battle';
    G.stats.battles++;
    G.events.push({ type: 'battleStart', group: groupId, boss: !!opts.boss });
    newRound(G);
    advance(G);
}

const alive = (u) => u.hp > 0;
export const foesOf = (B, u) => B.units.filter((v) => v.side !== u.side && alive(v));
export const friendsOf = (B, u) => B.units.filter((v) => v.side === u.side && alive(v));
const idx = (B, u) => B.units.indexOf(u);

export function effSpd(u) { return u.spd; }
function effAtk(u) { return u.atk * (u.st.atkup ? ATKUP_MULT : 1) * (u.st.weak ? WEAK_MULT : 1); }
function effDef(u) { return u.def * (u.st.rust ? RUST_MULT : 1); }

function newRound(G) {
    const B = G.battle;
    B.round++;
    const jitter = new Map(B.units.map((u) => [u, next(G.rng) * 0.5]));
    B.order = B.units.map((u, i) => i).filter((i) => alive(B.units[i]))
        .sort((a, b) => (effSpd(B.units[b]) + jitter.get(B.units[b])) - (effSpd(B.units[a]) + jitter.get(B.units[a])));
    // bosses may act twice: their second turn comes half a round after the first
    for (const i of [...B.order]) {
        const u = B.units[i];
        if (u.side === 'e' && (ENEMIES[u.id].acts || 1) > 1) B.order.splice(Math.min(B.order.length, B.order.indexOf(i) + Math.ceil(B.order.length / 2)), 0, i);
    }
    B.turn = -1;
    G.events.push({ type: 'round', round: B.round, order: [...B.order] });
}

/** Run turns until a hero must choose, or the battle is over. */
export function advance(G) {
    const B = G.battle;
    let guard = 0;
    while (!B.over && B.await === null) {
        if (++guard > 500) throw new Error('battle stuck');
        B.turn++;
        if (B.turn >= B.order.length) { newRound(G); continue; }
        const i = B.order[B.turn];
        const u = B.units[i];
        if (!alive(u)) continue;
        if (!startTurn(G, u)) { checkOver(G); continue; }
        if (u.side === 'p') { B.await = i; G.events.push({ type: 'yourTurn', who: i }); return; }
        enemyTurn(G, u);
        checkOver(G);
    }
}

/** Ticks a unit's statuses at the start of its turn. Returns false if it cannot act. */
function startTurn(G, u) {
    const B = G.battle;
    const i = idx(B, u);
    for (const k of Object.keys(u.cds)) if (--u.cds[k] <= 0) delete u.cds[k];
    const stunned = !!u.st.stun;
    for (const k of Object.keys(u.st)) if (--u.st[k] <= 0) { delete u.st[k]; G.events.push({ type: 'statusEnd', target: i, s: k }); }
    if (stunned) { u.charge = null; G.events.push({ type: 'stunned', target: i }); return false; }
    return true;
}

function applyStatus(G, u, fx) {
    for (const f of fx || []) {
        if (!chance(G.rng, f.p)) continue;
        if (u.boss && f.s === 'stun') { G.events.push({ type: 'resist', target: idx(G.battle, u), s: f.s }); continue; }
        u.st[f.s] = Math.max(u.st[f.s] || 0, f.t);
        G.events.push({ type: 'status', target: idx(G.battle, u), s: f.s });
    }
}

function damage(G, user, target, ab) {
    const B = G.battle;
    const ti = idx(B, target);
    if (target.st.dodge) {
        delete target.st.dodge;
        G.events.push({ type: 'hit', target: ti, dmg: 0, miss: true });
        return 0;
    }
    const base = effAtk(user) * (ab.power || 1);
    const armour = effDef(target) * (ab.kind === 'magic' ? MAGIC_DEF : PHYS_DEF);
    let d = Math.max(base * 0.15, base - armour);
    d *= 1 - VARIANCE + next(G.rng) * VARIANCE * 2;
    const crit = ab.kind === 'phys' && chance(G.rng, CRIT_CHANCE);
    if (crit) d *= CRIT_MULT;
    if (target.st.guard) d *= GUARD_MULT;
    d = Math.max(1, Math.round(d));
    target.hp = Math.max(0, target.hp - d);
    G.events.push({ type: 'hit', target: ti, dmg: d, crit, magic: ab.kind === 'magic' });
    if (!alive(target)) {
        target.st = {};
        G.events.push({ type: 'ko', target: ti });
        if (target.stolen) { G.gold += target.stolen; G.events.push({ type: 'recover', who: ti, amt: target.stolen }); target.stolen = 0; }
    }
    return d;
}

const healAmount = (user, ab) => Math.round((22 + user.atk * 1.7) * (ab.power || 1));

function summon(G, user, ab) {
    const B = G.battle;
    const made = [];
    const have = B.units.filter((u) => u.side === 'e' && alive(u)).length;
    for (const id of ab.summon) {
        if (have + made.length >= 5) break;
        const n = B.units.filter((u) => u.id === id).length;
        const unit = makeFoe(id, `${ENEMIES[id].name} ${'ABCDEFGH'[n] || ''}`.trim());
        B.units.push(unit);
        made.push(B.units.length - 1);
    }
    G.events.push({ type: 'summon', who: idx(B, user), targets: made });
}

/** Resolve one ability. `ti` is the chosen target's unit index (for foe / ally abilities). */
function useAbility(G, user, ab, ti) {
    const B = G.battle;
    const ui = idx(B, user);
    user.mp -= ab.mp || 0;
    if (ab.cd) user.cds[ab.id] = ab.cd + 1;
    let targets;
    switch (ab.target) {
        case 'foe': targets = [B.units[ti]]; break;
        case 'foes': targets = foesOf(B, user); break;
        case 'ally': targets = [B.units[ti]]; break;
        case 'self': targets = [user]; break;
        case 'party': targets = friendsOf(B, user); break;
        default: targets = [];
    }
    G.events.push({ type: 'act', who: ui, ability: ab.id, name: ab.name, anim: ab.anim, targets: targets.map((t) => idx(B, t)), side: user.side });
    if (ab.kind === 'summon') { summon(G, user, ab); return; }
    for (const t of targets) {
        if (ab.kind === 'phys' || ab.kind === 'magic') {
            if (!alive(t)) continue;
            const d = damage(G, user, t, ab);
            if (d > 0 && alive(t)) applyStatus(G, t, ab.fx);
            if (d > 0 && ab.steal && G.gold > 0) {
                const amt = Math.min(G.gold, Math.max(3, Math.round(G.gold * ab.steal)));
                G.gold -= amt; user.stolen += amt;
                G.events.push({ type: 'steal', who: ui, amt });
            }
        } else if (ab.kind === 'heal') {
            if (!alive(t)) continue;
            const h = Math.min(t.mhp - t.hp, healAmount(user, ab));
            t.hp += h;
            G.events.push({ type: 'heal', target: idx(B, t), amt: h });
        } else if (ab.kind === 'buff' || ab.kind === 'debuff') {
            if (alive(t)) applyStatus(G, t, ab.fx);
        }
    }
}

// ------------------------------------------------------------------ the foes' brain

function enemyTurn(G, u) {
    const B = G.battle;
    const def = ENEMIES[u.id];
    if (u.charge) {
        const ab = def.abilities.find((a) => a.id === u.charge);
        u.charge = null;
        useAbility(G, u, ab, null);
        return;
    }
    const nFoes = B.units.filter((v) => v.side === 'e' && alive(v)).length;
    const usable = def.abilities.filter((a) => {
        if (u.cds[a.id]) return false;
        if (a.when === 'noBuff') return !(a.fx || []).every((f) => u.st[f.s]);
        if (a.when?.startsWith('below:')) return u.hp / u.mhp < +a.when.slice(6) && (a.kind !== 'summon' || nFoes <= 2);
        return true;
    });
    const ab = pickWeighted(G.rng, usable, (a) => a.w || 1);
    if (ab.tell) {
        u.charge = ab.id;
        u.cds[ab.id] = (ab.cd || 0) + 2;
        G.events.push({ type: 'tell', who: idx(B, u), text: ab.tell, ability: ab.name });
        return;
    }
    let ti = null;
    if (ab.target === 'foe') ti = idx(B, aiTarget(G, u));
    useAbility(G, u, ab, ti);
}

function aiTarget(G, u) {
    const foes = foesOf(G.battle, u);
    const taunter = foes.find((f) => f.st.taunt);
    if (taunter) return taunter;
    const aim = ENEMIES[u.id].aim;
    const weakest = () => foes.reduce((a, b) => (b.hp / b.mhp < a.hp / a.mhp ? b : a));
    if (aim === 'weakest') return weakest();
    if (aim === 'random') return foes[Math.floor(next(G.rng) * foes.length)];
    if (chance(G.rng, 0.4)) return weakest();
    return foes[Math.floor(next(G.rng) * foes.length)];
}

// ------------------------------------------------------------------ the heroes' commands

/** Returns an error string, or null when the command was carried out. */
export function command(G, cmd) {
    const B = G.battle;
    if (B.over || B.await === null) return 'not your turn';
    const u = B.units[B.await];
    if (cmd.t === 'fight') {
        const ab = abilitiesOf(G, u.id).find((a) => a.id === cmd.ability);
        if (!ab) return 'unknown ability';
        if ((ab.mp || 0) > u.mp) return 'not enough SP';
        const t = B.units[cmd.target];
        if (ab.target === 'foe' && !(t && t.side === 'e' && alive(t))) return 'bad target';
        if (ab.target === 'ally' && !(t && t.side === 'p' && alive(t))) return 'bad target';
        useAbility(G, u, ab, cmd.target);
    } else if (cmd.t === 'item') {
        const it = ITEMS[cmd.item];
        if (!it || it.kind !== 'use' || !(G.inv[cmd.item] > 0)) return 'no such item';
        if (it.fx.flee) {
            if (!B.canFlee) return 'cannot flee';
            take(G, { [cmd.item]: 1 });
            G.events.push({ type: 'act', who: B.await, item: cmd.item, name: it.name, anim: 'item', targets: [B.await], side: 'p' });
            B.over = 'fled'; B.await = null;
            G.events.push({ type: 'fled' });
            persist(G);
            return null;
        }
        const t = B.units[cmd.target];
        if (!t || t.side !== 'p') return 'bad target';
        if (it.target === 'fallen' ? alive(t) : !alive(t)) return 'bad target';
        take(G, { [cmd.item]: 1 });
        G.events.push({ type: 'act', who: B.await, item: cmd.item, name: it.name, anim: 'item', targets: [cmd.target], side: 'p' });
        useItemOn(G, it, t, B.units.indexOf(t));
    } else if (cmd.t === 'defend') {
        u.st.guard = 1;
        const m = Math.min(u.mmp - u.mp, Math.max(1, Math.round(u.mmp * DEFEND_MP)));
        u.mp += m;
        G.events.push({ type: 'act', who: B.await, name: 'Defend', anim: 'shield', targets: [B.await], side: 'p' });
        G.events.push({ type: 'status', target: B.await, s: 'guard' });
        if (m > 0) G.events.push({ type: 'mpGain', target: B.await, amt: m });
    } else if (cmd.t === 'flee') {
        if (!B.canFlee) return 'cannot flee';
        const mine = B.units.filter((v) => v.side === 'p' && alive(v)), theirs = B.units.filter((v) => v.side === 'e' && alive(v));
        const avg = (a) => a.reduce((s, v) => s + effSpd(v), 0) / a.length;
        const p = Math.max(0.25, Math.min(0.95, FLEE_BASE + (avg(mine) - avg(theirs)) * 0.04));
        if (chance(G.rng, p)) {
            B.over = 'fled';
            B.await = null;
            G.events.push({ type: 'fled' });
            persist(G);
            return null;
        }
        G.events.push({ type: 'fleeFail', who: B.await });
    } else return 'unknown command';
    B.await = null;
    checkOver(G);
    advance(G);
    return null;
}

export function useItemOn(G, it, t, ti) {
    const fx = it.fx;
    if (fx.heal) { const h = Math.min(t.mhp - t.hp, fx.heal); t.hp += h; G.events.push({ type: 'heal', target: ti, amt: h }); }
    if (fx.mp) { const m = Math.min(t.mmp - t.mp, fx.mp); t.mp += m; G.events.push({ type: 'mpGain', target: ti, amt: m }); }
    if (fx.cure) { for (const s of Object.keys(t.st)) if (BAD.has(s)) delete t.st[s]; G.events.push({ type: 'cure', target: ti }); }
    if (fx.revive) { t.hp = Math.max(1, Math.round(t.mhp * fx.revive)); t.st = {}; G.events.push({ type: 'raise', target: ti }); }
}

// ------------------------------------------------------------------ ending

function checkOver(G) {
    const B = G.battle;
    if (B.over) return;
    if (!B.units.some((u) => u.side === 'e' && alive(u))) win(G);
    else if (!B.units.some((u) => u.side === 'p' && alive(u))) { B.over = 'lose'; B.await = null; G.events.push({ type: 'defeat' }); }
}

/** Write the heroes' HP and MP back to the party. Anyone knocked out gets up with 1 HP. */
export function persist(G) {
    for (const u of G.battle.units) {
        if (u.side !== 'p') continue;
        G.hp[u.id] = Math.max(1, Math.min(u.hp, u.mhp));
        G.mp[u.id] = Math.max(0, Math.min(u.mp, u.mmp));
    }
}

function win(G) {
    const B = G.battle;
    B.over = 'win';
    B.await = null;
    persist(G);
    let xp = 0, gold = 0;
    const items = {};
    for (const u of B.units) {
        if (u.side !== 'e') continue;
        const e = ENEMIES[u.id];
        xp += e.xp; gold += e.gold;
        G.kills[u.id] = (G.kills[u.id] || 0) + 1;
        for (const l of e.loot) if (chance(G.rng, l.p)) items[l.id] = (items[l.id] || 0) + 1;
    }
    G.gold += gold;
    B.rewards = { xp, gold, items, level: G.level };
    G.events.push({ type: 'victory', xp, gold, items });
    addXp(G, xp);
    B.rewards.levelTo = G.level;
    give(G, items);
    checkQuests(G);
}

/** The bot's and the auto button's choice for the hero whose turn it is. `skill` 0..1. */
export function autoCommand(G, skill = 1) {
    const B = G.battle;
    const u = B.units[B.await];
    const foes = foesOf(B, u), friends = friendsOf(B, u);
    const abs = abilitiesOf(G, u.id).filter((a) => (a.mp || 0) <= u.mp);
    const sloppy = next(G.rng) > skill;
    const fallen = B.units.filter((v) => v.side === 'p' && !alive(v));
    if (fallen.length && G.inv.wakeup && !sloppy) return { t: 'item', item: 'wakeup', target: idx(B, fallen[0]) };
    const hurtAll = friends.filter((f) => f.hp / f.mhp < 0.6);
    const partyHeal = abs.find((a) => a.kind === 'heal' && a.target === 'party');
    if (partyHeal && hurtAll.length >= 2 && !sloppy) return { t: 'fight', ability: partyHeal.id };
    const hurt = friends.filter((f) => f.hp / f.mhp < 0.4).sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
    if (hurt && !sloppy) {
        const heal = abs.find((a) => a.kind === 'heal' && a.target === 'ally');
        if (heal) return { t: 'fight', ability: heal.id, target: idx(B, hurt) };
        if (hurt.hp / hurt.mhp < 0.3) {
            const pot = ['scone', 'tea'].find((p) => G.inv[p] && (p === 'tea' || hurt.mhp - hurt.hp > 80));
            if (pot) return { t: 'item', item: pot, target: idx(B, hurt) };
        }
    }
    const charging = foes.some((f) => f.charge);
    const blanket = abs.find((a) => a.id === 'blanket');
    if (charging && blanket && !sloppy) return { t: 'fight', ability: 'blanket' };
    if (charging && !blanket && !sloppy && u.hp / u.mhp < 0.55 && next(G.rng) < 0.5) return { t: 'defend' };
    if (u.mp < 5 && u.mmp > 30 && G.inv.oilcan && !sloppy && B.boss) return { t: 'item', item: 'oilcan', target: idx(B, u) };
    // pick the best damage per turn
    let best = null, bestV = -1;
    for (const a of abs) {
        let v = 0;
        const n = a.target === 'foes' ? foes.length : 1;
        if (a.kind === 'phys' || a.kind === 'magic') v = (a.power || 1) * n * (a.kind === 'magic' ? 1.15 : 1);
        else if (a.id === 'rust_dust') v = foes.some((f) => f.boss && !f.st.rust) ? 1.8 : 0;
        else if (a.id === 'tune_up') v = friends.length >= 2 && !friends.some((f) => f.st.atkup) && (B.boss || foes.length >= 2) ? 2.4 : 0;
        if (a.mp && !B.boss && foes.length === 1 && foes[0].hp < 40) v *= 0.4;   // save SP for real fights
        if (sloppy) v = next(G.rng) * 2;
        if (v > bestV) { bestV = v; best = a; }
    }
    if (!best) return { t: 'defend' };
    let target;
    if (best.target === 'foe') {
        const pool = foes;
        target = idx(B, pool.reduce((a, b) => (b.hp < a.hp ? b : a)));
    }
    if (best.target === 'ally') target = idx(B, u);
    return { t: 'fight', ability: best.id, target };
}
