/**
 * bot.js — an auto-player. Used by dev/simtest.mjs for balance, by the
 * browser test, and to play the attract demo behind the title screen.
 *
 * It is greedy and honest (it uses only the public actions a player has):
 * keep an alchemist economy, put a blocker at the front of every lane,
 * cover each lane with enough damage for the coming wave (towers first,
 * then the back of the field), then pour gold into upgrades, the forge and
 * walls. During a wave it picks up everything, fires powerups when monsters
 * get close and aims the Keepfire at the heaviest lane.
 *
 * Pure: no three.js, no DOM, no Math.random.
 */

import {
    RELIC_SLOTS, UNITS, LANES, TOWER_TIERS, activeLanes, hpMul, FIELD_END, POWERS, UNIT_MAX_LEVEL,
} from '../config.js';
import {
    canPlace, placeUnit, upgradeUnit, unitUpgradeCost, buyCastle, castleCost, buyTower, towerCostFor,
    unitDamage, unitCooldown, collectOrb, usePower, fireKeepfire, cardCost, unlockedUnits, isObstacle, unitAt, chooseRelic,
} from './world.js';

const SHOOTERS = ['storm', 'pyro', 'ballista', 'frost', 'dwarf', 'archer'];

function unitDps(w, u) {
    const d = UNITS[u.type];
    if (!d.atk) return d.root ? unitDamage(w, u) / d.root.cd * 2 : 0;
    let dps = unitDamage(w, u) / unitCooldown(w, u);
    if (d.atk.kind === 'fireball' || d.atk.kind === 'barrel') dps *= 1.6;
    if (d.atk.kind === 'chain') dps *= 2.2;
    if (d.atk.kind === 'bolt') dps *= 1.8;
    if (d.atk.kind === 'ice') dps *= 1.4;
    if (u.level >= 6 && (u.type === 'archer' || u.type === 'pyro')) dps *= 1.8;
    return dps;
}

function laneDps(w, lane) {
    let s = 0;
    for (const u of w.units) {
        if (u.type === 'storm') s += unitDps(w, u) * (u.lane === lane ? 0.5 : 0.25);
        else if (u.lane === lane) s += unitDps(w, u);
        else if (u.type === 'dwarf' && Math.abs(u.lane - lane) === 1) s += unitDps(w, u) * 0.25;
    }
    return s;
}

/** The damage a lane needs for the coming wave (empirical). */
const needDps = (w) => 11 * hpMul(w.wave) * (1 + w.wave / 30);

function freeShooterSlot(w, lane, type) {
    for (let t = 0; t < w.castle.towers[lane]; t++) {
        const s = { kind: 'wall', lane, tier: t };
        if (!unitAt(w, s)) return s;
    }
    if (UNITS[type].place === 'any') {
        for (let c = 0; c < w.castle.bailey - 1; c++) {
            if (isObstacle(w, lane, c)) continue;
            const s = { kind: 'field', lane, col: c };
            if (!unitAt(w, s)) return s;
        }
    }
    return null;
}

function frontSlot(w, lane) {
    for (let c = w.castle.bailey - 1; c >= 1; c--) {
        if (isObstacle(w, lane, c)) continue;
        return { kind: 'field', lane, col: c };
    }
    return null;
}

/** A varied lane, like a person would build: one of each before doubling up. */
const LANE_PLAN = ['archer', 'pyro', 'frost', 'storm', 'ballista', 'dwarf', 'pyro', 'archer', 'storm'];
function bestShooter(w, lane) {
    const unlocked = unlockedUnits(w);
    const ready = (t) => unlocked.includes(t) && (w.phase === 'prep' || w.cards[t] <= 0);
    const inLane = {};
    for (const u of w.units) if (u.lane === lane) inLane[u.type] = (inLane[u.type] ?? 0) + 1;
    const want = {};
    for (const t of LANE_PLAN) {
        want[t] = (want[t] ?? 0) + 1;
        if (ready(t) && (inLane[t] ?? 0) < want[t]) return t;
    }
    for (const t of ['storm', 'pyro', 'ballista', 'frost', 'archer']) if (ready(t)) return t;
    return 'archer';
}

/** Spend gold. Returns the number of actions taken. */
export function botSpend(w, opts = {}) {
    const lanes = activeLanes(w.wave + (w.phase === 'prep' ? 0 : 0));
    let acted = 0;
    for (let guard = 0; guard < 30; guard++) {
        const unlocked = unlockedUnits(w);
        const opts2 = [];
        const add = (score, cost, fn, label) => opts2.push({ score, cost, fn, label });
        const alch = w.units.filter((u) => u.type === 'alchemist').length;
        const targetAlch = Math.min(6, 1 + Math.floor(w.wave / 3));
        if (unlocked.includes('alchemist') && alch < targetAlch && (w.phase === 'prep' || w.cards.alchemist <= 0)) {
            const slot = (() => {
                for (const lane of [2, 1, 3, 0, 4]) {
                    for (let c = 0; c < w.castle.bailey - 1; c++) {
                        const s = { kind: 'field', lane, col: c };
                        if (!isObstacle(w, lane, c) && !unitAt(w, s)) return s;
                    }
                }
                return null;
            })();
            if (slot) add(alch < 2 ? 3.2 : 1.6, cardCost(w, 'alchemist'), () => placeUnit(w, 'alchemist', slot), 'alch');
        }
        const need = needDps(w);
        for (const lane of lanes) {
            const dps = laneDps(w, lane);
            const deficit = Math.max(0, need - dps) / need;
            // Blocker at the front
            const blk = w.units.some((u) => u.lane === lane && UNITS[u.type].block);
            if (!blk && w.wave >= 3 && unlocked.includes('knight')) {
                const s = frontSlot(w, lane);
                const t = unlocked.includes('palisade') && w.wave >= 8 && (w.phase === 'prep' || w.cards.palisade <= 0) ? 'palisade' : 'knight';
                if (s && !unitAt(w, s) && (w.phase === 'prep' || w.cards[t] <= 0)) add(2.4, cardCost(w, t), () => placeUnit(w, t, s), 'block');
            }
            if (deficit > 0) {
                const t = bestShooter(w, lane);
                const slot = freeShooterSlot(w, lane, t);
                if (slot && (w.phase === 'prep' || w.cards[t] <= 0)) add(2 + 3 * deficit, cardCost(w, t), () => placeUnit(w, t, slot), `place ${t}`);
                else if (w.castle.towers[lane] < TOWER_TIERS) add(1.7 + 2 * deficit, towerCostFor(w, lane), () => buyTower(w, lane), 'tower');
                const weak = w.units.filter((u) => u.lane === lane && UNITS[u.type].atk && u.level < UNIT_MAX_LEVEL)
                    .sort((a, b) => unitUpgradeCost(w, a) / unitDps(w, a) - unitUpgradeCost(w, b) / unitDps(w, b))[0];
                if (weak) add(1.2 + 2 * deficit, unitUpgradeCost(w, weak), () => upgradeUnit(w, weak.id), 'upg-lane');
            } else if (w.castle.towers[lane] === 0) {
                add(1.2, towerCostFor(w, lane), () => buyTower(w, lane), 'tower0');
            }
        }
        if (w.wave >= 4 && w.castle.keepfire === 0) add(1.8, castleCost(w, 'keepfire'), () => buyCastle(w, 'keepfire'), 'kf');
        if (w.castle.treasury < Math.floor(w.wave / 7)) add(1.3, castleCost(w, 'treasury'), () => buyCastle(w, 'treasury'), 'treasury');
        const lastDmg = w.lastClear ? 1 - w.lastClear.wallLeft : 0;
        if (lastDmg > 0.3 || w.castle.walls < 1 + Math.floor(w.wave / 6)) add(1.5 + lastDmg, castleCost(w, 'walls'), () => buyCastle(w, 'walls'), 'walls');
        add(1.0, castleCost(w, 'forge'), () => buyCastle(w, 'forge'), 'forge');
        if (w.wave >= 12 && w.castle.ramparts < Math.floor(w.wave / 10)) add(0.9, castleCost(w, 'ramparts'), () => buyCastle(w, 'ramparts'), 'ramparts');
        if (w.wave >= 8 && w.castle.keepfire < Math.floor(w.wave / 8)) add(0.95, castleCost(w, 'keepfire'), () => buyCastle(w, 'keepfire'), 'kf+');
        if (w.castle.bailey < 6 && w.wave >= 10 * (w.castle.bailey - 2)) add(1.1, castleCost(w, 'bailey'), () => buyCastle(w, 'bailey'), 'bailey');
        if (unlocked.includes('cleric') && w.units.filter((u) => u.type === 'cleric').length < Math.min(3, Math.floor(w.wave / 12))) {
            const lane = w.rng ? lanes[(w.units.length) % lanes.length] : 2;
            const s = freeShooterSlot(w, lane, 'cleric');
            if (s && (w.phase === 'prep' || w.cards.cleric <= 0)) add(1.3, cardCost(w, 'cleric'), () => placeUnit(w, 'cleric', s), 'cleric');
        }
        if (unlocked.includes('druid') && w.units.filter((u) => u.type === 'druid').length < 2) {
            for (const lane of [1, 3]) {
                const s = { kind: 'field', lane, col: Math.max(1, w.castle.bailey - 2) };
                if (!isObstacle(w, lane, s.col) && !unitAt(w, s) && (w.phase === 'prep' || w.cards.druid <= 0)) { add(1.0, cardCost(w, 'druid'), () => placeUnit(w, 'druid', s), 'druid'); break; }
            }
        }
        const any = w.units.filter((u) => UNITS[u.type].atk && u.level < UNIT_MAX_LEVEL)
            .sort((a, b) => unitUpgradeCost(w, a) / unitDps(w, a) - unitUpgradeCost(w, b) / unitDps(w, b))[0];
        if (any) add(0.95, unitUpgradeCost(w, any), () => upgradeUnit(w, any.id), 'upg');
        // Upgrade blockers a little so they keep up.
        const blk = w.units.filter((u) => UNITS[u.type].block && u.level < Math.min(UNIT_MAX_LEVEL, 1 + Math.floor(w.wave / 6)))[0];
        if (blk) add(1.0, unitUpgradeCost(w, blk), () => upgradeUnit(w, blk.id), 'upg-blk');

        for (let i = opts2.length - 1; i >= 0; i--) if (!isFinite(opts2[i].cost)) opts2.splice(i, 1);
        opts2.sort((a, b) => b.score - a.score);
        const top = opts2[0];
        if (!top) break;
        // Save up for the top choice unless something nearly as good is affordable now.
        const pick = opts2.find((o) => o.cost <= w.gold && o.score >= top.score - 0.6);
        if (!pick) break;
        if (pick.fn()) break; // returned an error string
        acted++;
        if (opts.log) opts.log(pick.label);
    }
    return acted;
}

/** One bot "think" during a wave: pickups, powerups, Keepfire, spending. */
export function botTick(w, opts = {}) {
    for (const o of w.orbs.slice()) if (o.kind === 'mote' ? o.y < 1.5 : o.t > 0.3) collectOrb(w, o.id);
    const near = w.enemies.filter((e) => !e.dead && e.x < 3.2);
    const laneHp = new Array(LANES).fill(0);
    for (const e of w.enemies) if (!e.dead && e.x < FIELD_END) laneHp[e.lane] += e.hp * (e.x < 4 ? 2 : 1);
    const heavy = laneHp.indexOf(Math.max(...laneHp));
    if (w.powers.length && (near.length >= 3 || w.wallHp < w.wallMax * 0.55 || w.enemies.some((e) => e.boss))) {
        const p = w.powers[0];
        const def = POWERS[p.power];
        const tgt = near[0] ?? w.enemies.find((e) => !e.dead && e.x < FIELD_END);
        if (def.target === 'none') usePower(w, 0);
        else if (tgt) usePower(w, 0, { x: tgt.x - 0.3, lane: tgt.lane });
    }
    if (w.castle.keepfire > 0 && w.kf >= 100 && laneHp[heavy] > 0 && (near.length || laneHp[heavy] > 200 * hpMul(w.wave))) fireKeepfire(w, heavy);
    if (!opts.noSpend) botSpend(w, opts);
}

const relicVal = (r) => r.rarity * 10 + r.affixes.reduce((s, a) => s + (['dmg', 'rate', 'unit', 'elem', 'crit'].includes(a.stat) ? 2 : 1), 0) + (r.unique ? 3 : 0);

/** Pick a relic: highest rarity, then damage-ish stats. */
export function botRelic(offer) {
    return offer.slice().sort((a, b) => relicVal(b) - relicVal(a))[0] ?? null;
}

/** Choose (and, with full slots, replace the weakest) — or skip if nothing beats what we hold. */
export function botChooseRelic(w) {
    const r = botRelic(w.relicOffer);
    if (!r) return chooseRelic(w, null);
    if (w.relics.length < RELIC_SLOTS) return chooseRelic(w, r);
    let wi = 0;
    w.relics.forEach((x, i) => { if (relicVal(x) < relicVal(w.relics[wi])) wi = i; });
    if (relicVal(w.relics[wi]) >= relicVal(r)) return chooseRelic(w, null);
    return chooseRelic(w, r, wi);
}
