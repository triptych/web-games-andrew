// Turn-based tactical combat. Pure. A command resolves a whole action at once and pushes events the view plays as a
// queue; step() only paces enemy turns and the auto-battle (hold = the view is still animating).
//
// Turn order is a timeline: every unit has `next`, the time of its next turn; acting adds 100 / SPD. The lowest
// `next` acts. Damage: power × 2 × 50 / (50 + DEF), × element (1.5 weak, 0.5 resist), × crit 1.5, × stagger 1.3,
// × 0.9..1.1. Weakness hits break 2 poise, others 1; at 0 poise an enemy is Staggered: it loses its next turn, takes
// +30%, and opens a free Chain Attack. Hits fill the shared Chain gauge; full, it pays for a Chain Attack any time.

import { BATTLE } from '../config.js';
import { HEROES, SKILLS, CHAINS, COMBOS, MONSTERS, REGIONS, ITEMS, RECIPES, ELEMENTS } from './data.js';
import { clamp, heroStats, has, give, take, gainExp } from './util.js';
import { synergy, chainsFor, addBond } from './bonds.js';

// ------------------------------------------------------------------ setup
function makeHero(G, id) {
    const s = heroStats(G, id);
    const syn = synergy(G, id, G.party);
    const h = G.heroes[id];
    const u = {
        id, side: 'hero', key: id, name: HEROES[id].short, el: HEROES[id].el, weak: [], resist: [],
        mhp: s.hp, mmp: s.mp,
        hp: clamp(h.hp ?? s.hp, 0, s.hp), mp: clamp(h.mp ?? s.mp, 0, s.mp),
        base: { atk: s.atk * (1 + syn), def: s.def * (1 + syn), mag: s.mag * (1 + syn), spd: s.spd, crit: s.crit, eva: s.eva },
        buffs: [], regen: 0, regenT: 0, taunt: 0, guard: false, poise: 0, mpoise: 0, stagger: false, syn,
    };
    u.alive = u.hp > 0;
    return u;
}

function makeEnemy(kind, lv, idx) {
    const M = MONSTERS[kind];
    const k = 1 + 0.12 * (lv - 1);
    const mhp = Math.round(M.base.hp * (1 + 0.16 * (lv - 1)));
    return {
        id: 'e' + idx, side: 'enemy', key: kind, name: M.name, lv, el: M.el, weak: M.weak, resist: M.resist, boss: !!M.boss,
        mhp, hp: mhp, mmp: 0, mp: 0,
        base: { atk: M.base.atk * k, def: M.base.def * k, mag: M.base.mag * k, spd: M.base.spd * (1 + 0.02 * (lv - 1)), crit: M.base.crit, eva: M.base.eva },
        buffs: [], regen: 0, regenT: 0, taunt: 0, guard: false, poise: M.poise, mpoise: M.poise, stagger: false, alive: true, chained: false,
    };
}

/** Start a battle in the current expedition. boss = the region's boss. */
export function startBattle(G, boss = false) {
    const ex = G.exp;
    const R = REGIONS[ex.region];
    const enemies = [];
    if (boss) {
        enemies.push(makeEnemy(R.boss, R.bossLv, 0));
        // a boss brings one friend from the region
        enemies.push(makeEnemy(G.rng.pick(R.pool), R.lv[1], 1));
    } else {
        // the group grows with the party: Maple alone meets one or two, a full party two or three
        const n = Math.min(R.size[1], Math.max(1, G.rng.int(G.party.length >= 3 ? R.size[0] : 1, Math.min(R.size[1], G.party.length + 1))));
        const lvTop = Math.min(R.lv[1], R.lv[0] + Math.floor(ex.wins / 2) + 1);
        for (let i = 0; i < n; i++) enemies.push(makeEnemy(G.rng.pick(R.pool), G.rng.int(R.lv[0], lvTop), i));
    }
    const units = [...G.party.map((id) => makeHero(G, id)), ...enemies];
    for (const u of units) u.next = 100 / Math.max(1, u.base.spd) * (0.6 + 0.4 * G.rng());
    G.battle = {
        region: ex.region, boss, units, chain: ex.chain || 0, phase: 'turn', actor: null, aiT: 0,
        round: 0, log: [], lastHit: {}, auto: G.auto, preset: G.preset, turnCount: 0, fled: false, rewards: null,
    };
    G.mode = 'battle';
    G.events.push({ type: 'battleStart', region: ex.region, boss, enemies: enemies.map((e) => e.key) });
    nextTurn(G);
}

// ------------------------------------------------------------------ stats in battle
const unit = (B, id) => B.units.find((u) => u.id === id);
export const heroesOf = (B) => B.units.filter((u) => u.side === 'hero');
export const enemiesOf = (B) => B.units.filter((u) => u.side === 'enemy');
const living = (arr) => arr.filter((u) => u.alive);

/** A unit's stat with buffs and the expedition's meal and linens. */
export function stat(G, u, k) {
    let v = u.base[k];
    let add = 0;
    for (const b of u.buffs) if (b.stat === k) add += b.v;
    if (u.side === 'hero' && G.exp) {
        const mb = G.exp.buffs;
        if (mb[k] !== undefined) add += k === 'crit' || k === 'eva' ? 0 : mb[k];
        if ((k === 'crit' || k === 'eva') && mb[k]) v += mb[k];
    }
    if (k === 'crit' || k === 'eva') return v + add * 100;
    return Math.max(0.1, v * (1 + add));
}

// ------------------------------------------------------------------ turn order
/** Who acts next, and the preview of the next n turns (for the timeline bar). */
export function timeline(B, n = 8) {
    const sim = living(B.units).map((u) => ({ id: u.id, t: u.next, step: 100 / Math.max(1, u.spdNow || u.base.spd) }));
    const out = [];
    for (let i = 0; i < n && sim.length; i++) {
        sim.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
        out.push(sim[0].id);
        sim[0].t += sim[0].step;
    }
    return out;
}

function nextTurn(G) {
    const B = G.battle;
    if (checkEnd(G)) return;
    for (const u of B.units) u.spdNow = stat(G, u, 'spd');
    const order = living(B.units).sort((a, b) => a.next - b.next || (a.id < b.id ? -1 : 1));
    const u = order[0];
    B.actor = u.id;
    B.turnCount++;
    // start-of-turn upkeep
    u.guard = false;
    if (u.regenT > 0) {
        const heal = Math.round(u.mhp * u.regen);
        u.hp = Math.min(u.mhp, u.hp + heal); u.regenT--;
        G.events.push({ type: 'regen', id: u.id, n: heal });
    }
    if (u.side === 'hero' && G.exp?.buffs.regen) {
        const heal = Math.round(u.mhp * G.exp.buffs.regen);
        if (u.hp < u.mhp) { u.hp = Math.min(u.mhp, u.hp + heal); G.events.push({ type: 'regen', id: u.id, n: heal }); }
    }
    if (u.side === 'hero' && G.exp?.buffs.mpRegen) u.mp = Math.min(u.mmp, u.mp + G.exp.buffs.mpRegen);
    for (const b of u.buffs) b.turns--;
    u.buffs = u.buffs.filter((b) => b.turns > 0);
    if (u.taunt > 0) u.taunt--;
    // a combo window on an enemy closes when it acts
    if (u.side === 'enemy') delete B.lastHit[u.id];
    if (u.stagger) {
        // a staggered enemy spends its turn getting its breath back
        u.stagger = false; u.poise = u.mpoise; u.chained = false;
        u.next += 100 / Math.max(1, u.spdNow);
        G.events.push({ type: 'recover', id: u.id });
        return nextTurn(G);
    }
    B.phase = u.side === 'hero' && !B.auto ? 'command' : 'ai';
    B.aiT = 0;
    G.events.push({ type: 'turn', id: u.id });
}

function endTurn(G, u) {
    const B = G.battle;
    u.next += 100 / Math.max(1, stat(G, u, 'spd'));
    nextTurn(G);
}

function checkEnd(G) {
    const B = G.battle;
    if (B.phase === 'won' || B.phase === 'lost' || B.phase === 'fled') return true;
    if (!living(enemiesOf(B)).length) { win(G); return true; }
    if (!living(heroesOf(B)).length) { lose(G); return true; }
    return false;
}

// ------------------------------------------------------------------ resolving hits
function elemMul(t, el) {
    if (!el || el === 'none') return 1;
    if (t.weak.includes(el)) return BATTLE.weak;
    if (t.resist.includes(el)) return BATTLE.resist;
    return 1;
}

/** One hit. Returns the hit record pushed into the action event. */
function hit(G, a, t, { power, stat: st = 'atk', el = 'none', critAdd = 0, poise = 0, canMiss = true, from = null }) {
    const B = G.battle;
    const atk = stat(G, a, st);
    const def = stat(G, t, 'def');
    if (canMiss && st === 'atk' && G.rng() * 100 < stat(G, t, 'eva') * 0.8) return { id: t.id, miss: true, dmg: 0 };
    let dmg = atk * power * 2 * 50 / (50 + def);
    const em = elemMul(t, el);
    dmg *= em;
    const crit = G.rng() * 100 < stat(G, a, 'crit') + critAdd;
    if (crit) dmg *= BATTLE.crit;
    if (t.stagger) dmg *= BATTLE.staggerTaken;
    if (t.guard) dmg *= BATTLE.defend;
    if (t.side === 'hero' && G.exp?.buffs.resist && el !== 'none') dmg *= 1 - G.exp.buffs.resist;
    dmg *= 0.9 + 0.2 * G.rng();
    dmg = Math.max(1, Math.round(dmg));
    t.hp = Math.max(0, t.hp - dmg);
    const rec = { id: t.id, dmg, crit, weak: em > 1, resist: em < 1, el };
    // chain gauge and poise
    if (a.side === 'hero') {
        B.chain = Math.min(BATTLE.chainMax, B.chain + 6 + (em > 1 ? 6 : 0) + (crit ? 8 : 0));
        if (t.side === 'enemy' && !t.stagger && t.alive) {
            t.poise -= (em > 1 ? 2 : 1) + poise;
            if (t.poise <= 0 && t.hp > 0) {
                t.poise = 0; t.stagger = true; rec.stagger = true;
                B.chain = Math.min(BATTLE.chainMax, B.chain + 15);
            }
        }
    }
    if (t.hp <= 0 && t.alive) { t.alive = false; rec.ko = true; t.stagger = false; }
    // combo links: another hero's element followed by this one on the same enemy
    if (a.side === 'hero' && t.side === 'enemy' && el !== 'none' && !from) {
        const prev = B.lastHit[t.id];
        if (prev && prev.hero !== a.id) {
            const c = COMBOS.find((x) => x.a === prev.el && x.b === el);
            if (c) rec.combo = { name: c.name, effect: c.effect, with: prev.hero };
        }
        B.lastHit[t.id] = { el, hero: a.id };
    }
    return rec;
}

function applyCombo(G, a, t, rec) {
    const B = G.battle;
    const c = rec.combo;
    const extra = Math.max(1, Math.round(rec.dmg * BATTLE.comboBonus));
    if (t.alive) {
        t.hp = Math.max(0, t.hp - extra);
        if (t.hp <= 0) { t.alive = false; rec.ko = true; }
    }
    rec.comboDmg = extra;
    B.chain = Math.min(BATTLE.chainMax, B.chain + 15);
    if (c.effect === 'defDown' && t.alive) t.buffs.push({ stat: 'def', v: -0.25, turns: 2 });
    if (c.effect === 'atkDown' && t.alive) t.buffs.push({ stat: 'atk', v: -0.2, turns: 2 });
    if (c.effect === 'burn' && t.alive) { t.hp = Math.max(1, t.hp - Math.round(extra * 0.5)); }
    if (c.effect === 'poise' && t.alive && !t.stagger) { t.poise -= 2; if (t.poise <= 0) { t.poise = 0; t.stagger = true; rec.stagger = true; } }
    if (c.effect === 'heal') for (const h of living(heroesOf(B))) h.hp = Math.min(h.mhp, h.hp + Math.round(h.mhp * 0.08));
    if (c.effect === 'chain') B.chain = Math.min(BATTLE.chainMax, B.chain + 15);
    addBond(G, a.id, c.with, 3, 'combo');
    G.stats.combos = (G.stats.combos || 0) + 1;
}

function pickTargets(G, a, target, kind) {
    const B = G.battle;
    const foes = living(a.side === 'hero' ? enemiesOf(B) : heroesOf(B));
    const friends = living(a.side === 'hero' ? heroesOf(B) : enemiesOf(B));
    if (kind === 'all' || kind === 'enemies') return foes;
    if (kind === 'allies') return friends;
    if (kind === 'self') return [a];
    if (kind === 'ally') { const t = unit(B, target); return t && t.alive && t.side === a.side ? [t] : [a]; }
    if (kind === 'down') { const t = unit(B, target); return t && !t.alive && t.side === a.side ? [t] : []; }
    // one foe: the chosen one, or (enemy AI) a taunting hero, or the first standing
    let t = unit(B, target);
    if (!t || !t.alive || t.side === a.side) t = foes[0];
    if (a.side === 'enemy') { const taunter = foes.find((h) => h.taunt > 0); if (taunter) t = taunter; }
    return t ? [t] : [];
}

// ------------------------------------------------------------------ actions
function useSkill(G, a, skillId, target) {
    const B = G.battle;
    const S = SKILLS[skillId];
    if (!S) return false;
    if (a.side === 'hero' && a.mp < S.mp) { G.events.push({ type: 'nope', text: 'Not enough MP.' }); return false; }
    if (a.side === 'hero') a.mp -= S.mp;
    const targets = pickTargets(G, a, target, S.target);
    if (!targets.length) return false;
    const ev = { type: 'act', actor: a.id, skill: skillId, name: S.name, el: S.el || 'none', kind: S.kind, hits: [] };
    if (S.kind === 'dmg' || S.kind === 'steal') {
        for (const t of targets) for (let h = 0; h < (S.hits || 1); h++) {
            if (!t.alive) break;
            const rec = hit(G, a, t, { power: S.power, stat: S.stat, el: S.el, critAdd: S.crit || 0, poise: S.poise || 0 });
            if (rec.combo) applyCombo(G, a, t, rec);
            ev.hits.push(rec);
        }
        if (S.kind === 'steal' && ev.hits[0] && !ev.hits[0].miss) {
            const M = MONSTERS[targets[0].key];
            const drop = M.drops.find(([it]) => ITEMS[it]?.cat === 'ingredient');
            if (drop && G.rng() < 0.7) { give(G, drop[0]); ev.stole = drop[0]; }
            else { const g = 5 + targets[0].lv * 3; G.gold += g; ev.stoleGold = g; }
        }
    } else if (S.kind === 'heal') {
        for (const t of targets) {
            const n = Math.round(stat(G, a, S.stat) * S.power + (S.flat || 0));
            t.hp = Math.min(t.mhp, t.hp + n);
            if (S.regen) { t.regen = S.regen; t.regenT = S.turns; }
            ev.hits.push({ id: t.id, heal: n });
        }
    } else if (S.kind === 'buff') {
        for (const t of targets) {
            for (const [k, v] of Object.entries(S.buff)) t.buffs.push({ stat: k, v, turns: S.turns + (t === a ? 1 : 0) });
            if (S.taunt) t.taunt = S.taunt + 1;
            ev.hits.push({ id: t.id, buff: S.buff });
        }
    } else if (S.kind === 'debuff') {
        for (const t of targets) {
            if (S.dmgPower) {
                const rec = hit(G, a, t, { power: S.dmgPower, stat: S.stat, el: S.el, canMiss: false });
                ev.hits.push(rec);
            }
            if (t.alive) for (const [k, v] of Object.entries(S.debuff)) t.buffs.push({ stat: k, v, turns: S.turns });
            ev.hits.push({ id: t.id, debuff: S.debuff });
        }
    }
    G.events.push(ev);
    if (a.side === 'hero') B.log.push(skillId);
    endTurn(G, a);
    return true;
}

function useItem(G, a, item, target) {
    const B = G.battle;
    const it = ITEMS[item];
    if (!it || it.cat !== 'battle' || !has(G, item)) { G.events.push({ type: 'nope', text: 'You don\'t have that.' }); return false; }
    const targets = pickTargets(G, a, target, it.target);
    if (!targets.length) { G.events.push({ type: 'nope', text: 'No one to use that on.' }); return false; }
    take(G, item);
    const ev = { type: 'act', actor: a.id, item, name: it.name, el: it.use.el || 'none', kind: 'item', hits: [] };
    for (const t of targets) {
        if (it.use.heal) { const n = Math.min(t.mhp - t.hp, it.use.heal); t.hp += n; ev.hits.push({ id: t.id, heal: n }); }
        if (it.use.mp) { const n = Math.min(t.mmp - t.mp, it.use.mp); t.mp += n; ev.hits.push({ id: t.id, mpHeal: n }); }
        if (it.use.revive) { t.alive = true; t.hp = Math.round(t.mhp * it.use.revive); ev.hits.push({ id: t.id, heal: t.hp, revive: true }); }
        if (it.use.dmg) {
            let d = Math.round(it.use.dmg * elemMul(t, it.use.el));
            t.hp = Math.max(0, t.hp - d);
            const rec = { id: t.id, dmg: d, weak: elemMul(t, it.use.el) > 1 };
            if (t.hp <= 0) { t.alive = false; rec.ko = true; }
            ev.hits.push(rec);
        }
    }
    G.events.push(ev);
    endTurn(G, a);
    return true;
}

/** Chain Attacks that the acting hero could launch right now, and whether one is affordable. */
export function chainOptions(G) {
    const B = G.battle;
    if (!B || B.phase !== 'command' && B.phase !== 'ai') return { list: [], free: false, ready: false };
    const a = unit(B, B.actor);
    if (!a || a.side !== 'hero') return { list: [], free: false, ready: false };
    const standing = living(heroesOf(B)).map((h) => h.id);
    const free = living(enemiesOf(B)).some((e) => e.stagger && !e.chained);
    const ready = free || B.chain >= BATTLE.chainMax;
    return { list: chainsFor(G, a.id, standing), free, ready };
}

function useChain(G, a, chainId, target) {
    const B = G.battle;
    const C = CHAINS[chainId];
    const opt = chainOptions(G);
    if (!C || !opt.ready || !opt.list.includes(chainId)) { G.events.push({ type: 'nope', text: 'No Chain Attack ready.' }); return false; }
    // pay: a staggered enemy opens one for free; otherwise the full gauge
    const staggered = living(enemiesOf(B)).find((e) => e.stagger && !e.chained);
    if (staggered) { staggered.chained = true; if (!unit(B, target)?.alive || unit(B, target)?.side !== 'enemy') target = staggered.id; }
    else B.chain = 0;
    const ev = { type: 'chain', actor: a.id, chain: chainId, name: C.name, members: C.members, line: C.line, hits: [] };
    for (const [hero, power, st, el, tk] of C.hits) {
        const h = unit(B, hero);
        if (!h || !h.alive) continue;
        const foes = living(enemiesOf(B));
        if (!foes.length) break;
        let ts;
        if (tk === 'all') ts = foes;
        else if (tk === 'rand') ts = [G.rng.pick(foes)];
        else { const t = unit(B, target); ts = [t && t.alive && t.side === 'enemy' ? t : foes[0]]; }
        for (const t of ts) ev.hits.push({ ...hit(G, h, t, { power, stat: st, el, canMiss: false, poise: C.poise || 0, from: 'chain' }), by: hero });
    }
    const af = C.after || {};
    const party = living(heroesOf(B));
    if (af.healPct) for (const h of party) h.hp = Math.min(h.mhp, h.hp + Math.round(h.mhp * af.healPct));
    if (af.regen) for (const h of party) { h.regen = af.regen; h.regenT = af.turns; }
    if (af.buff) for (const h of party) for (const [k, v] of Object.entries(af.buff)) h.buffs.push({ stat: k, v, turns: af.turns || 2 });
    if (af.cleanse) for (const h of party) h.buffs = h.buffs.filter((b) => b.v > 0);
    if (af.chain) B.chain = Math.min(BATTLE.chainMax, B.chain + af.chain);
    for (let i = 0; i < C.members.length; i++) for (let j = i + 1; j < C.members.length; j++) addBond(G, C.members[i], C.members[j], 5, 'chain');
    G.stats.chains = (G.stats.chains || 0) + 1;
    G.events.push(ev);
    endTurn(G, a);
    return true;
}

function defend(G, a) {
    a.guard = true;
    a.mp = Math.min(a.mmp, a.mp + Math.round(a.mmp * 0.08));
    G.events.push({ type: 'act', actor: a.id, kind: 'defend', name: 'Defend', hits: [] });
    endTurn(G, a);
    return true;
}

function flee(G, a) {
    const B = G.battle;
    if (B.boss) { G.events.push({ type: 'fleeFail', boss: true, actor: a.id }); endTurn(G, a); return true; }
    const hs = living(heroesOf(B)), es = living(enemiesOf(B));
    const avg = (arr) => arr.reduce((s, u) => s + stat(G, u, 'spd'), 0) / Math.max(1, arr.length);
    const p = clamp(BATTLE.fleeBase + 0.25 * (avg(hs) / avg(es) - 1) + (B.fleeTries || 0) * 0.15, 0.3, 0.95);
    if (G.rng() < p) {
        B.phase = 'fled';
        saveHp(G);
        G.events.push({ type: 'fled', actor: a.id });
    } else {
        B.fleeTries = (B.fleeTries || 0) + 1;
        G.events.push({ type: 'fleeFail', actor: a.id });
        endTurn(G, a);
    }
    return true;
}

// ------------------------------------------------------------------ the end
function saveHp(G) {
    for (const u of heroesOf(G.battle)) { G.heroes[u.id].hp = Math.max(u.alive ? 1 : 0, u.hp); G.heroes[u.id].mp = u.mp; }
    G.exp.chain = 0;
}

function win(G) {
    const B = G.battle;
    B.phase = 'won';
    let exp = 0, gold = 0;
    const drops = {};
    for (const e of enemiesOf(B)) {
        const M = MONSTERS[e.key];
        exp += M.exp * (1 + 0.15 * (e.lv - 1));
        gold += M.gold * (1 + 0.1 * (e.lv - 1));
        for (const [it, p] of M.drops) {
            if (ITEMS[it]?.cat === 'gear' && (G.inv[it] || 0) > 0) continue;   // one of each weapon
            if (it === 'diary' && (G.inv.diary || G.flags.diary)) continue;
            if (G.rng() < p) drops[it] = (drops[it] || 0) + 1;
        }
    }
    // the lost suitcase turns up in the grove while Kit is waiting for it
    if (B.region === 'grove' && G.recruits.kit.stage === 'staying' && !has(G, 'suitcase')) {
        G.flags.groveWins = (G.flags.groveWins || 0) + 1;
        if (G.flags.groveWins >= 2 || G.rng() < 0.5) drops.suitcase = 1;
    }
    exp = Math.round(exp); gold = Math.round(gold);
    G.gold += gold;
    G.stats.earned += gold;
    for (const [it, n] of Object.entries(drops)) give(G, it, n);
    const standing = living(heroesOf(B)).map((u) => u.id);
    for (const u of heroesOf(B)) gainExp(G, u.id, u.alive ? exp : exp * 0.5);
    // staff at home learn a little too
    for (const id of Object.keys(G.heroes)) if (G.heroes[id].joined && !G.party.includes(id)) gainExp(G, id, exp * 0.4);
    for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++) addBond(G, standing[i], standing[j], 4, 'battle');
    if (B.boss) {
        const k = REGIONS[B.region].boss;
        if (!G.bossesBeaten.includes(k)) G.bossesBeaten.push(k);
        if (k === 'molequeen' && drops.diary) { G.flags.diary = true; G.scenes.push('diary'); }
    }
    saveHp(G);
    G.exp.wins++;
    G.exp.chain = Math.round(B.chain * 0.5);           // half the gauge carries to the next fight
    G.stats.wins++;
    G.daily.prog.wins = (G.daily.prog.wins || 0) + 1;
    B.rewards = { exp, gold, drops };
    G.events.push({ type: 'victory', exp, gold, drops, boss: B.boss });
}

function lose(G) {
    const B = G.battle;
    B.phase = 'lost';
    for (const u of heroesOf(B)) { G.heroes[u.id].hp = null; G.heroes[u.id].mp = null; }
    G.events.push({ type: 'defeat' });
}

// ------------------------------------------------------------------ the command entry point
/** A battle command from the player (or the auto-battle). cmd: { t: 'attack'|'skill'|'chain'|'item'|'defend'|'flee', ... } */
export function battleAct(G, cmd) {
    const B = G.battle;
    if (!B) return false;
    if (cmd.t === 'auto') {
        B.auto = !!cmd.on; G.auto = B.auto;
        if (cmd.preset) { B.preset = cmd.preset; G.preset = cmd.preset; }
        if (B.phase === 'command' && B.auto) { B.phase = 'ai'; B.aiT = 0; }
        else if (B.phase === 'ai' && !B.auto && unit(B, B.actor)?.side === 'hero') B.phase = 'command';
        return true;
    }
    if (B.phase !== 'command' && !cmd.fromAi) return false;
    const a = unit(B, B.actor);
    if (!a || !a.alive || a.side !== 'hero') return false;
    if (cmd.t === 'attack') return useSkill(G, a, 'attack', cmd.target);
    if (cmd.t === 'skill') {
        if (!HEROES[a.id].skills.includes(cmd.skill)) return false;
        return useSkill(G, a, cmd.skill, cmd.target);
    }
    if (cmd.t === 'chain') return useChain(G, a, cmd.chain, cmd.target);
    if (cmd.t === 'item') return useItem(G, a, cmd.item, cmd.target);
    if (cmd.t === 'defend') return defend(G, a);
    if (cmd.t === 'flee') return flee(G, a);
    return false;
}

/** Paces enemy turns and the auto-battle. aiPick is the brain (ai.js), passed in to keep the modules acyclic. */
export function battleStep(G, dt, hold, aiPick) {
    const B = G.battle;
    if (!B || B.phase !== 'ai' || hold) return;
    B.aiT += dt;
    if (B.aiT < BATTLE.aiDelay) return;
    const a = unit(B, B.actor);
    if (!a || !a.alive) { nextTurn(G); return; }
    if (a.side === 'enemy') {
        const M = MONSTERS[a.key];
        const tot = M.skills.reduce((s, [, w]) => s + w, 0);
        let x = G.rng() * tot, sk = M.skills[0][0];
        for (const [s, w] of M.skills) { x -= w; if (x <= 0) { sk = s; break; } }
        // healers only heal when hurt
        if (SKILLS[sk].kind === 'heal' && a.hp > a.mhp * 0.6) sk = 'bonk';
        const foes = living(heroesOf(B));
        const target = G.rng.pick(foes)?.id;
        useSkill(G, a, sk, target);
    } else {
        const cmd = aiPick(G, a, B.preset);
        cmd.fromAi = true;
        if (!battleAct(G, cmd)) defend(G, a);
    }
}

export { unit, living, elemMul };
export const ELEMENT_NAMES = ELEMENTS;
export const RECIPE_TABLE = RECIPES;
