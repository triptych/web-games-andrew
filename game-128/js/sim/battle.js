// Gemheart Saga — the real-time match-3 battle. Pure.
//
// The board runs all the time (sim/board.js). Each resolved match or blast on the board becomes damage, mana or
// healing here; the foe attacks on its own timer and uses its abilities on the board (stone, chains, doom gems) and on
// the hero (drain, poison). The hero spends mana on skills and uses items from the bag.
//
// G.battle = { foe, hero, board, phase: 'intro'|'fight'|'won'|'lost', t, introT, foeIdx, rewards }

import { BATTLE, GEM, KINDS, MANA_OF, GEM_OF, MANA, REWARD } from '../config.js';
import { NODE } from './data/heroes.js';
import { ITEM, EQUIP } from './data/items.js';
import { REGION } from './data/world.js';
import * as Bd from './board.js';
import { heroStats, foeStats, gainOf, skillAt } from './stats.js';

const RANK_MULT = { normal: 1, elite: 2, boss: 4 };

/** Start a fight with foe id at level lv. carry = { hp } from the previous fight of the same quest; ease = { hp, atk }
 * factors for the foe (the first chapters of a tale). */
export function startBattle(G, id, lv, carry = null, ease = null) {
    const s = heroStats(G);
    const f = foeStats(id, lv, ease);
    const mana = {};
    for (const p of MANA) mana[p] = Math.min(BATTLE.manaCap, s.mods.startMana);
    G.battle = {
        foe: { ...f, hp: f.max, timer: f.every, shield: 0, frozen: 0, attacks: 0, enraged: false, hitFlash: 0 },
        hero: { hp: carry ? Math.min(carry.hp, s.hp) : s.hp, max: s.hp, atk: s.atk, def: s.def, mods: s.mods, mana, shield: 0, poison: 0, summon: null, itemCd: 0 },
        board: Bd.newBoard(G.rng),
        phase: 'intro', t: 0, introT: BATTLE.introSecs,
        rewards: null,
        stats: { swaps: 0, gems: 0, dmg: 0 },
    };
    G.events.push({ type: 'battle', foe: id, rank: f.rank, lv });
}

// ---------------------------------------------------------------- the step
export function stepBattle(G, dt) {
    const Bt = G.battle;
    if (!Bt || Bt.phase === 'won' || Bt.phase === 'lost') {
        if (Bt) Bd.stepBoard(Bt.board, dt, G.rng, G.events);    // let the board settle behind the result screen
        return;
    }
    Bt.t += dt;
    const ev0 = G.events.length;
    Bd.stepBoard(Bt.board, dt, G.rng, G.events);
    for (let i = ev0; i < G.events.length; i++) if (G.events[i].type === 'doomCleared') G.stats.doomCleared++;
    // what the board resolved this step
    const out = Bt.board.out.splice(0);
    for (const o of out) applyGems(G, o);
    if (checkEnd(G)) return;
    const h = Bt.hero, f = Bt.foe;
    h.itemCd = Math.max(0, h.itemCd - dt);
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (h.poison > 0) {
        h.poison = Math.max(0, h.poison - dt);
        hurtHero(G, h.max * BATTLE.poisonPct * dt, 'poison');
        if (checkEnd(G)) return;
    }
    if (h.summon) {
        h.summon.t -= dt; h.summon.left -= dt;
        if (h.summon.t <= 0) {
            h.summon.t += h.summon.every;
            hitFoe(G, h.atk * h.summon.mult, { src: 'wolf' });
            if (checkEnd(G)) return;
        }
        if (h.summon.left <= 0) h.summon = null;
    }
    // doom gems tick
    for (let i = 0; i < Bt.board.cells.length; i++) {
        const t = Bt.board.cells[i];
        if (!t || t.k !== GEM.DOOM || t.st !== 'idle') continue;
        t.doom -= dt;
        if (t.doom <= 0) {
            t.k = GEM.STONE; t.doom = 0;
            G.events.push({ type: 'doomBurst', x: Bd.col(i), y: Bd.row(i) });
            hurtHero(G, f.atk * BATTLE.doomMult, 'doom');
            if (checkEnd(G)) return;
        }
    }
    if (Bt.phase === 'intro') {
        Bt.introT -= dt;
        if (Bt.introT <= 0) Bt.phase = 'fight';
        return;
    }
    if (f.frozen > 0) { f.frozen = Math.max(0, f.frozen - dt); return; }
    const slow = 1 / (1 + h.mods.slow);
    f.timer -= dt * slow;
    if (f.timer <= 0) {
        foeAttack(G);
        if (checkEnd(G)) return;
        let every = f.every;
        if (f.enraged) every *= BATTLE.enrageMult;
        f.timer += every;
    }
}

function checkEnd(G) {
    const Bt = G.battle;
    if (Bt.foe.hp <= 0) { win(G); return true; }
    if (Bt.hero.hp <= 0) {
        const q = G.quest;
        if ((G.bag.feather || 0) > 0) {
            G.bag.feather--;
            Bt.hero.hp = Math.round(Bt.hero.max * ITEM.feather.eff.pct);
            G.events.push({ type: 'revive', by: 'feather' });
            return false;
        }
        if (Bt.hero.mods.revive && q && !q.revived) {
            q.revived = true;
            Bt.hero.hp = Math.round(Bt.hero.max * 0.3);
            G.events.push({ type: 'revive', by: 'temple' });
            return false;
        }
        Bt.phase = 'lost';
        G.stats.battlesLost++;
        G.events.push({ type: 'lost', foe: Bt.foe.id });
        return true;
    }
    return false;
}

// ---------------------------------------------------------------- gems -> effects
function applyGems(G, o) {
    const Bt = G.battle, h = Bt.hero, f = Bt.foe, m = h.mods;
    const chainMult = 1 + (BATTLE.chainBonus + m.chain) * Math.max(0, o.chain - 1);
    Bt.stats.gems += o.n;
    if (o.chain > G.stats.chainMax) G.stats.chainMax = o.chain;
    if (o.special) G.stats.specials++;
    G.stats.gems[o.k] = (G.stats.gems[o.k] || 0) + o.n;
    if (Bt.phase !== 'fight' && Bt.phase !== 'intro') return;
    if (o.k === GEM.SWORD) {
        let dmg = h.atk * BATTLE.swordPerGem * o.n * chainMult * (1 + m.sword);
        let crit = false;
        if (G.rng() < m.crit) { crit = true; dmg *= BATTLE.critMult + m.critDmg; }
        hitFoe(G, dmg, { src: 'sword', crit, x: o.x, y: o.y });
    } else if (o.k === GEM.HEART) {
        const low = h.hp < h.max * 0.3 ? m.lowHeal : 0;
        heal(G, h.max * BATTLE.heartPerGem * o.n * chainMult * (1 + m.heart + low));
        if (m.purify) {
            const bad = Bt.board.cells.map((t, i) => (t && t.st === 'idle' && (t.k === GEM.STONE || t.k === GEM.DOOM) ? i : -1)).filter((i) => i >= 0);
            for (let n = 0; n < m.purify && bad.length; n++) {
                const s = bad.splice(G.rng.int(0, bad.length - 1), 1)[0];
                const t = Bt.board.cells[s];
                if (t.k === GEM.DOOM) { G.stats.doomCleared++; G.events.push({ type: 'doomCleared', x: Bd.col(s), y: Bd.row(s) }); }
                t.k = G.rng.int(0, KINDS - 1); t.doom = 0;
                G.events.push({ type: 'purify', x: Bd.col(s), y: Bd.row(s) });
            }
        }
    } else {
        const pool = MANA_OF[o.k];
        const gain = BATTLE.manaPerGem * o.n * gainOf(m, pool) + (o.n >= 4 ? m.overflow : 0);
        h.mana[pool] = Math.min(BATTLE.manaCap, h.mana[pool] + gain);
        const weak = f.weak === pool;
        hitFoe(G, h.atk * BATTLE.chipPerGem * o.n * chainMult * (weak ? BATTLE.weakMult : 1), { src: pool, weak, x: o.x, y: o.y });
    }
    if (m.flow && o.chain >= 2 && !o.blast) {
        const p = MANA[G.rng.int(0, 3)];
        h.mana[p] = Math.min(BATTLE.manaCap, h.mana[p] + m.flow);
    }
    G.events.push({ type: 'gems', k: o.k, n: o.n, chain: o.chain, blast: o.blast });
}

function hitFoe(G, dmg, info = {}) {
    const Bt = G.battle, f = Bt.foe, m = Bt.hero.mods;
    if (f.hp <= 0 || Bt.phase === 'won' || Bt.phase === 'lost') return 0;
    if (f.hp < f.max * 0.35) dmg *= 1 + m.execute;
    if (f.frozen > 0) dmg *= 1 + m.frozen;
    dmg = Math.max(1, Math.round(dmg));
    if (f.shield > 0) {
        const a = Math.min(f.shield, dmg);
        f.shield -= a; dmg -= a;
        if (a) G.events.push({ type: 'shieldHit', amt: a });
    }
    f.hp = Math.max(0, f.hp - dmg);
    f.hitFlash = 0.15;
    Bt.stats.dmg += dmg;
    G.events.push({ type: 'hit', amt: dmg, ...info });
    if (!f.enraged && f.abil.includes('enrage') && f.hp > 0 && f.hp < f.max * BATTLE.enrageAt) {
        f.enraged = true;
        G.events.push({ type: 'enrage', foe: f.id });
    }
    return dmg;
}

function hurtHero(G, raw, src) {
    const h = G.battle.hero;
    let dmg = src === 'poison' ? raw : raw * BATTLE.defK / (BATTLE.defK + h.def) * (1 - Math.min(0.6, h.mods.defPct));
    if (h.shield > 0 && src !== 'poison') {
        const a = Math.min(h.shield, dmg);
        h.shield -= a; dmg -= a;
        if (a) G.events.push({ type: 'blocked', amt: Math.round(a) });
    }
    h.hp = Math.max(0, h.hp - dmg);
    if (src !== 'poison' && dmg > 0) G.events.push({ type: 'hurt', amt: Math.round(dmg), src });
}

function heal(G, amt) {
    const h = G.battle.hero;
    const before = h.hp;
    h.hp = Math.min(h.max, h.hp + amt);
    if (h.hp > before) G.events.push({ type: 'heal', amt: Math.round(h.hp - before) });
}

// ---------------------------------------------------------------- the foe
/** The ability a foe's n-th attack (1-based) brings, or null: abilities cycle; a heal lands every 3rd attack and a
 * shield every 2nd. The view shows the next one under the foe's attack timer. */
export function abilityOn(f, n) {
    const usable = f.abil.filter((a) => a !== 'enrage' && a !== 'haste');
    if (!usable.length || n < 1) return null;
    const a = usable[(n - 1) % usable.length];
    if (a === 'heal' && n % 3 !== 0) return null;
    if (a === 'shield' && n % 2 !== 0) return null;
    return a;
}
export const nextAbility = (f) => abilityOn(f, f.attacks + 1);

function foeAttack(G) {
    const Bt = G.battle, f = Bt.foe, h = Bt.hero, B = Bt.board;
    f.attacks++;
    G.events.push({ type: 'foeAttack', foe: f.id });
    hurtHero(G, f.atk, 'hit');
    const a = abilityOn(f, f.attacks);
    if (!a) return;
    if (a === 'stone') {
        const s = Bd.convert(B, G.rng, BATTLE.stonePerHit, GEM.STONE);
        if (s.length) G.events.push({ type: 'curse', kind: 'stone', slots: s });
    } else if (a === 'lock') {
        const s = Bd.lockGems(B, G.rng, BATTLE.lockPerHit);
        if (s.length) G.events.push({ type: 'curse', kind: 'lock', slots: s });
    } else if (a === 'doom') {
        const live = B.cells.filter((t) => t && t.k === GEM.DOOM).length;
        if (live < 2) {
            const s = Bd.convert(B, G.rng, 1, GEM.DOOM);
            for (const i of s) B.cells[i].doom = BATTLE.doomSecs;
            if (s.length) G.events.push({ type: 'curse', kind: 'doom', slots: s });
        }
    } else if (a === 'drain') {
        const p = MANA.reduce((best, x) => (h.mana[x] > h.mana[best] ? x : best), 'r');
        const amt = Math.min(h.mana[p], BATTLE.drain);
        h.mana[p] -= amt;
        if (amt) G.events.push({ type: 'drain', pool: p, amt });
    } else if (a === 'heal') {
        const amt = Math.round(f.max * BATTLE.healPct);
        f.hp = Math.min(f.max, f.hp + amt);
        G.events.push({ type: 'foeHeal', amt });
    } else if (a === 'shield') {
        f.shield = Math.round(f.max * BATTLE.shieldPct);
        G.events.push({ type: 'foeShield', amt: f.shield });
    } else if (a === 'poison') {
        h.poison = BATTLE.poisonSecs;
        G.events.push({ type: 'poisoned' });
    }
}

// ---------------------------------------------------------------- the hero's actions
/** Can the hero use this skill now? */
export function canSkill(G, nodeId) {
    const Bt = G.battle;
    if (!Bt || (Bt.phase !== 'fight' && Bt.phase !== 'intro')) return false;
    const n = NODE[nodeId];
    if (!n || n.type !== 'active' || n.hero !== G.hero.id || !(G.hero.ranks[nodeId] > 0)) return false;
    for (const [p, c] of Object.entries(n.cost)) if (Bt.hero.mana[p] < c) return false;
    return true;
}

export function useSkill(G, nodeId) {
    if (!canSkill(G, nodeId)) return false;
    const Bt = G.battle, h = Bt.hero, f = Bt.foe, n = NODE[nodeId], m = h.mods;
    for (const [p, c] of Object.entries(n.cost)) h.mana[p] -= c;
    const s = skillAt(n, G.hero.ranks[nodeId]);
    const weak = n.cost[f.weak] ? BATTLE.weakSkill : 1;
    const power = (1 + m.skill) * weak;
    const e = n.eff;
    G.events.push({ type: 'skill', id: nodeId, kind: e.kind, hero: G.hero.id });
    G.stats.skills++;
    if (e.kind === 'dmg') {
        for (let i = 0; i < (e.hits || 1); i++) hitFoe(G, h.atk * s.mult * power, { src: 'skill', skill: nodeId, weak: weak > 1 });
    } else if (e.kind === 'shield') {
        h.shield += h.max * s.pct;
        G.events.push({ type: 'heroShield', amt: Math.round(h.max * s.pct) });
    } else if (e.kind === 'convert') {
        const slots = Bd.convert(Bt.board, G.rng, Math.round(s.n), e.to, e.from);
        G.events.push({ type: 'convert', slots, to: e.to });
    } else if (e.kind === 'freeze') {
        f.frozen = Math.min(BATTLE.freezeMax, f.frozen + s.secs);
        hitFoe(G, h.atk * e.mult * power, { src: 'skill', skill: nodeId, weak: weak > 1 });
        G.events.push({ type: 'frozen', secs: s.secs });
    } else if (e.kind === 'blast') {
        const cols = [];
        const want = Math.min(Bt.board.w, Math.round(s.cols));
        while (cols.length < want) { const c = G.rng.int(0, Bt.board.w - 1); if (!cols.includes(c)) cols.push(c); }
        Bd.blastColumns(Bt.board, cols, G.events);
        hitFoe(G, h.atk * (e.mult || 0) * power * want, { src: 'skill', skill: nodeId, weak: weak > 1 });
        G.events.push({ type: 'wave', cols });
    } else if (e.kind === 'summon') {
        h.summon = { left: e.secs, every: e.every, t: 0.3, mult: s.mult * power };
    } else if (e.kind === 'heal') {
        heal(G, h.max * s.pct);
    }
    if (e.delay) { f.timer += e.delay; G.events.push({ type: 'delayed', secs: e.delay }); }
    checkEnd(G);
    return true;
}

export function canItem(G, id) {
    const Bt = G.battle;
    if (!Bt || (Bt.phase !== 'fight' && Bt.phase !== 'intro')) return false;
    const it = ITEM[id];
    if (!it || !it.eff || it.eff.kind === 'revive') return false;
    return (G.bag[id] || 0) > 0 && Bt.hero.itemCd <= 0;
}

export function useItem(G, id) {
    if (!canItem(G, id)) return false;
    const Bt = G.battle, h = Bt.hero, e = ITEM[id].eff;
    G.bag[id]--;
    h.itemCd = BATTLE.itemCooldown;
    G.stats.items++;
    G.events.push({ type: 'item', id });
    if (e.kind === 'heal') heal(G, h.max * e.pct);
    else if (e.kind === 'mana') for (const p of MANA) h.mana[p] = Math.min(BATTLE.manaCap, h.mana[p] + e.n);
    else if (e.kind === 'dmg') hitFoe(G, h.atk * e.mult, { src: 'bomb' });
    else if (e.kind === 'shuffle') { Bd.shuffle(Bt.board, G.rng, true); G.events.push({ type: 'shuffle' }); }
    checkEnd(G);
    return true;
}

export function swap(G, a, b) {
    const Bt = G.battle;
    if (!Bt || (Bt.phase !== 'fight' && Bt.phase !== 'intro')) return 'no';
    const r = Bd.trySwap(Bt.board, a, b, G.events);
    if (r === 'ok') Bt.stats.swaps++;
    return r;
}

// ---------------------------------------------------------------- winning
function win(G) {
    const Bt = G.battle, f = Bt.foe, m = Bt.hero.mods;
    Bt.phase = 'won';
    const mult = RANK_MULT[f.rank] || 1;
    const loot = 1 + m.loot;
    const region = f.region || G.quest?.region || 'gloamspire';
    const res = REGION[region]?.res || 'crystal';
    const r = {
        gold: Math.round((REWARD.gold + REWARD.goldLv * f.lv) * mult * loot),
        xp: Math.round((REWARD.xp + REWARD.xpLv * f.lv) * mult * (1 + m.xp)),
        res: {},
        items: [],
    };
    // the region's own material in full, and a share of the common ones (wood, ore, grain) whatever the region
    const base = (REWARD.res + REWARD.resLv * f.lv) * mult * loot;
    for (const [m, k] of Object.entries(REWARD.share)) r.res[m] = Math.round(base * k);
    r.res[res] = (r.res[res] || 0) + Math.round(base * (res === 'crystal' ? 0.2 : 0.6));
    if (f.rank === 'boss') r.res.crystal = (r.res.crystal || 0) + 3 + Math.round(f.lv / 2);
    const dropChance = f.rank === 'boss' ? 1 : f.rank === 'elite' ? REWARD.dropElite : REWARD.dropNormal;
    if (G.rng() < dropChance) {
        const tier = Math.max(1, Math.min(5, Math.ceil(f.lv / 4) + (f.rank === 'boss' ? 1 : 0)));
        const pool = EQUIP.filter((e) => e.tier === tier || e.tier === tier - 1);
        r.items.push(G.rng.pick(pool).id);
    }
    if (G.rng() < REWARD.consumable) r.items.push(f.lv >= 9 && G.rng() < 0.3 ? 'greatpotion' : G.rng() < 0.75 ? 'potion' : 'tonic');
    Bt.rewards = r;
    G.stats.killsTotal++;
    G.stats.battlesWon++;
    if (region) G.stats.kills[region] = (G.stats.kills[region] || 0) + 1;
    G.events.push({ type: 'won', foe: f.id, rank: f.rank, rewards: r });
}

/** Mana a skill still needs, per pool (for the HUD and the bot). */
export function missing(G, nodeId) {
    const n = NODE[nodeId], h = G.battle.hero;
    const out = {};
    for (const [p, c] of Object.entries(n.cost)) if (h.mana[p] < c) out[p] = c - h.mana[p];
    return out;
}
export { GEM_OF };
