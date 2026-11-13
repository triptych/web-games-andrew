// GIANT'S VAULT: damage, crits, armour, stagger, kills, experience and death. Pure.

import { PLAYER, POTION, MON, ARMOR_K, RIFT, SKILL_POINTS_PER_LEVEL, ATTR_POINTS_PER_LEVEL, LEVEL_CAP, xpToNext } from '../config.js';
import { MONSTERS, BOSSES } from './data/monsters.js';
import { skillVal } from './data/masteries.js';
import { dropLoot } from './loot.js';
import { recompute, rankOf } from './stats.js';

const ELEMENT_PCT = { phys: 'physPct', lightning: 'lightningPct', shadow: 'shadowPct', fire: 'firePct', cold: 'physPct' };

export const monDef = (m) => (m.boss ? BOSSES[m.boss] : MONSTERS[m.kind]);
export const buff = (P, k) => P.buffs.find((b) => b.k === k);

/** A weapon damage roll for the player (uniform between the weapon's low and high). */
export function weaponRoll(G) {
    const [lo, hi] = G.player.stats.weapon.dmg;
    return lo + G.rng() * (hi - lo);
}

/**
 * The player's side hits a monster. base: weapon roll × skill multiplier (before bonuses).
 * opts: { el, src: 'player' | 'pet' | 'shade', skill, stagger, stun, noCrit, proc }
 * Returns the damage dealt (0 if the monster was already dead).
 */
export function hitMonster(G, m, base, opts = {}) {
    if (m.life <= 0) return 0;
    const P = G.player, s = P.stats, el = opts.el || 'phys';
    let pct = (s[ELEMENT_PCT[el]] || 0) + s.dmgPct;
    const wc = buff(P, 'warcry');
    if (wc) pct += wc.dmgPct;
    if (opts.src !== 'player') pct += s.minionPct;
    let dmg = base * (1 + pct / 100);
    if (m.shock?.t > 0) dmg *= 1 + (m.shock.n * (s.shockPct || 6)) / 100;
    if (m.curse?.t > 0) dmg *= 1 + m.curse.pct / 100;
    if (el === 'shadow' && m.shock?.t > 0 && P.synergy === 'voidcurrent') dmg *= 1.25;
    if (m.armorBreak?.t > 0) dmg *= 1.2;
    const armor = (monDef(m).armor || 0) + (m.elite?.affixes?.includes('stone') ? 0.4 : 0);
    const shielded = m.shieldT > 0 ? 0.5 : 1;
    dmg *= (1 - Math.min(0.75, armor)) * shielded;
    let crit = false;
    if (!opts.noCrit && G.rng() * 100 < s.critPct) { crit = true; dmg *= 1 + s.critDmgPct / 100; }
    dmg = Math.max(1, Math.round(dmg));
    m.life -= dmg;
    m.aggro = true;
    m.hitT = 0.12;
    G.stats.dealt += dmg;
    G.events.push({ type: 'hit', id: m.id, x: m.x, y: m.y, amt: dmg, crit, el, src: opts.src || 'player' });

    // on-hit effects for the player's own hits
    if (opts.src === 'player' || opts.src === undefined) {
        if (s.lifeOnHit && !opts.proc) heal(G, s.lifeOnHit * (1 + P.level * 0.08));
        if (s.rageOnHit && P.masteries.includes('warfare')) gainRes(G, 'rage', s.rageOnHit);
        if (el === 'shadow' && s.leechPct) heal(G, (dmg * s.leechPct) / 100);
        if (el === 'lightning' && rankOf(G, 'staticcharge')) {
            m.shock = { n: Math.min(3, (m.shock?.t > 0 ? m.shock.n : 0) + 1), t: 3 };
        }
        if (crit && el === 'lightning' && P.synergy === 'galvanic') gainRes(G, 'rage', 3);
    }
    // stagger: a hit bigger than poise × max life interrupts (bosses and sentinels rarely)
    const def = monDef(m);
    const poise = def.poise * m.max * (m.boss ? 1 : m.elite ? 1.5 : 1);
    const staggerMul = 1 + s.staggerPct / 100 + (opts.stagger || 0);
    if (dmg * staggerMul > poise && m.state !== 'stun') {
        m.state = 'stagger'; m.t = MON.staggerTime;
        G.events.push({ type: 'stagger', id: m.id });
    }
    if (opts.stun && !m.boss) { m.state = 'stun'; m.t = Math.min(MON.stunMax, opts.stun); }
    if (m.life <= 0) killMonster(G, m, opts);
    return dmg;
}

export function heal(G, amt) {
    const P = G.player;
    if (amt <= 0 || P.life <= 0) return;
    const before = P.life;
    P.life = Math.min(P.stats.maxLife, P.life + amt);
    if (P.life - before >= 1) G.events.push({ type: 'heal', amt: Math.round(P.life - before) });
}

export function gainRes(G, k, v) {
    const P = G.player;
    if (!P.stats.resMax[k]) return;
    const bonus = v > 0 ? 1 + (P.stats.resRegenPct || 0) / 100 : 1;
    P.res[k] = Math.max(0, Math.min(P.stats.resMax[k], P.res[k] + v * bonus));
}

/** A monster (or trap) hurts the player. Returns the damage taken. */
export function hurtPlayer(G, amt, el = 'phys', srcLevel = 1, attacker = null) {
    const P = G.player, s = P.stats;
    if (P.life <= 0 || G.area.kind === 'town') return 0;
    const armor = s.armorTotal;
    let dmg = amt * (1 - armor / (armor + ARMOR_K * Math.max(1, srcLevel)));
    if (el !== 'phys') dmg *= 1 - s.res / 100;
    const dr = buff(P, 'dr');
    if (dr) dmg *= 1 - dr.pct / 100;
    if (buff(P, 'bulwark')) dmg *= 0.6;
    const sh = buff(P, 'shield');
    if (sh) {
        const take = Math.min(sh.hp, dmg);
        sh.hp -= take; dmg -= take;
        if (sh.hp <= 0) sh.t = 0;
        if (attacker && attacker.life > 0) hitMonster(G, attacker, weaponRoll(G) * sh.zap, { el: 'lightning', noCrit: true, proc: true });
    }
    dmg = Math.max(0, Math.round(dmg));
    if (!dmg) return 0;
    P.life -= dmg;
    P.combatT = 0;
    G.stats.taken += dmg;
    if (s.powers.painToPower) for (const k of ['rage', 'mana', 'essence']) gainRes(G, k, dmg * 0.2);
    if (P.masteries.includes('warfare')) gainRes(G, 'rage', Math.min(8, (dmg / s.maxLife) * 40));
    if (P.portalCast) { P.portalCast = 0; G.events.push({ type: 'denied', reason: 'Portal interrupted' }); }
    G.events.push({ type: 'hurt', amt: dmg, el });
    if (P.life <= 0) playerDies(G);
    return dmg;
}

function playerDies(G) {
    const P = G.player;
    P.life = 0;
    G.mode = 'dead';
    G.deadT = PLAYER.respawn;
    G.stats.deaths++;
    let lost = 0;
    if (G.rift) G.rift.t -= RIFT.deathPenalty;
    else { lost = Math.floor(P.gold * PLAYER.deathGoldLoss); P.gold -= lost; }
    P.buffs = [];
    G.events.push({ type: 'death', lost });
}

export function killMonster(G, m, opts = {}) {
    const P = G.player, def = monDef(m);
    m.life = 0;
    m.state = 'dead'; m.t = MON.corpse;
    G.stats.kills++;
    if (m.elite && !m.elite.minion) G.stats.elites++;
    // experience: a share of the curve, more for elites and bosses
    const xp = Math.round(def.xp * (20 + m.lvl * 9) * (m.elite ? (m.elite.minion ? 2 : 4) : 1));
    gainXp(G, xp);
    gainRes(G, 'essence', PLAYER.essencePerKill);
    if (P.synergy === 'bloodpact') { gainRes(G, 'rage', 4); gainRes(G, 'essence', 3); }
    P.potion.kills++;
    if (P.potion.kills >= POTION.killsPerCharge) {
        P.potion.kills = 0;
        if (P.potion.charges < POTION.charges) { P.potion.charges++; G.events.push({ type: 'potionCharge' }); }
    }
    if (opts.killHeal) heal(G, P.stats.maxLife * opts.killHeal);
    if (opts.skill === 'leap' && P.stats.powers.leapFree) P.cds.leap = 0;
    if (m.elite?.affixes?.includes('molten')) {
        G.zones.push({ id: G.nextId++, x: m.x, y: m.y, r: 2.6, t: MON.telegraph + 0.3, dmg: m.dmg * 1.5, el: 'fire', from: 'mon', lvl: m.lvl, kind: 'molten' });
    }
    dropLoot(G, m, { mf: P.stats.magicFind + (G.rift?.mf || 0) });
    if (G.rift && !G.rift.guardian) {
        G.rift.progress = Math.min(G.rift.need, G.rift.progress + (m.elite ? (m.elite.minion ? RIFT.progress.champion : RIFT.progress.elite) : RIFT.progress.normal));
    }
    G.events.push({ type: 'kill', id: m.id, kind: m.kind, boss: m.boss || null, x: m.x, y: m.y, elite: !!m.elite });
    if (m.boss) G.onBossKilled = m.boss;     // handled by game.js after the step (it can change the area)
}

export function gainXp(G, xp) {
    const P = G.player;
    if (P.level >= LEVEL_CAP) {
        // Ascension: every level's worth of experience past the cap is one free attribute point
        P.xp += xp;
        const need = xpToNext(LEVEL_CAP);
        while (P.xp >= need) { P.xp -= need; P.ascension++; P.unspent.attr++; G.events.push({ type: 'ascend', n: P.ascension }); }
        return;
    }
    P.xp += xp;
    while (P.level < LEVEL_CAP && P.xp >= xpToNext(P.level)) {
        P.xp -= xpToNext(P.level);
        P.level++;
        P.unspent.skill += SKILL_POINTS_PER_LEVEL;
        P.unspent.attr += ATTR_POINTS_PER_LEVEL;
        recompute(G);
        P.life = P.stats.maxLife;
        G.events.push({ type: 'levelup', level: P.level });
    }
}

/** Damage of a monster's hit, with its elite multipliers. */
export function monsterHit(G, m, mult = 1) {
    return m.dmg * mult * (0.85 + G.rng() * 0.3);
}

export { skillVal };
