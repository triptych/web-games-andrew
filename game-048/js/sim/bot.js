/**
 * bot.js — a competent player, used by the headless tests, the balance table,
 * and the in-game AUTO toggle (which plays the same policy one step at a time).
 */

import * as C from './combat.js';
import { SYSTEMS, canUpgrade, doUpgrade } from './mech.js';
import { SKILL_IDS, learn, canLearn } from './skills.js';
import { RARITIES } from './mods.js';
import { FACILITIES, facilityCost, upgradeFacility, collectFacilities } from './profile.js';

/** The next action the bot would take, as { kind, ... } — or null if nothing to do. */
export function botNext(st, opts = {}) {
    const a = botChoose(st);
    // the in-game AUTO toggle never spends the player's boosters except to stay alive
    if (opts.saveBoosters && a && a.kind === 'boost' && a.id !== 'nanite') return st.phase === 'ready' ? { kind: 'spin' } : { kind: 'engage' };
    return a;
}

function botChoose(st) {
    const p = st.player;
    if (st.phase === 'ready') {
        if (C.canBoost(st, 'nanite') && p.hp < p.maxHp * 0.3) return { kind: 'boost', id: 'nanite' };
        if (C.canBoost(st, 'patch') && st.reels.some((r) => r.lock > 0) && st.reels.filter((r) => r.lock > 0).length >= 2) return { kind: 'boost', id: 'patch' };
        if (C.canBoost(st, 'chip') && C.alive(st).some((e) => e.boss) && st.overdrive === 0) return { kind: 'boost', id: 'chip' };
        // focus the weakest enemy unless a boss is up
        const a = C.alive(st);
        const weakest = a.slice().sort((x, y) => (x.hp + x.shield) - (y.hp + y.shield))[0];
        if (weakest && st.target !== weakest.id && !a.some((e) => e.boss && e.id === st.target)) return { kind: 'target', id: weakest.id };
        return { kind: 'spin' };
    }
    if (st.phase !== 'landed') return null;
    if (C.canBoost(st, 'nanite') && p.hp < p.maxHp * 0.25) return { kind: 'boost', id: 'nanite' };
    if (C.canBoost(st, 'emp') && C.alive(st).reduce((s, e) => s + e.shield, 0) > p.maxHp * 0.5) return { kind: 'boost', id: 'emp' };
    // purge jammed reels when energy allows
    for (let c = 0; c < st.cols; c++) if (C.canAct(st, 'purge', c) && p.energy >= st.L.purgeCost + 1) return { kind: 'purge', reel: c };
    const best = bestTweak(st);
    if (best) return best;
    if (C.canBoost(st, 'coin') && st.preview.wins.length === 0) return { kind: 'boost', id: 'coin' };
    return { kind: 'engage' };
}

function bestTweak(st) {
    const base = C.estimateGrid(st, st.grid).value;
    let best = null;
    let bestGain = base * 0.08 + 2;
    const free = st.player.freeNudges > 0;
    for (let c = 0; c < st.cols; c++) {
        const reel = st.reels[c];
        if (reel.jammed || !C.canAct(st, 'nudge', c)) continue;
        for (const dir of [-1, 1]) {
            const save = reel.pos;
            reel.pos = ((reel.pos - dir) % reel.strip.length + reel.strip.length) % reel.strip.length;
            const v = C.estimateGrid(st, C.buildGrid(st)).value;
            reel.pos = save;
            const gain = v - base - (free ? 0 : 3);
            if (gain > bestGain) { bestGain = gain; best = { kind: 'nudge', reel: c, dir }; }
        }
    }
    return best;
}

export function applyAction(st, a) {
    switch (a.kind) {
        case 'spin': return C.spin(st);
        case 'engage': return C.engage(st);
        case 'nudge': return C.nudge(st, a.reel, a.dir);
        case 'respin': return C.respin(st, a.reel);
        case 'purge': return C.purge(st, a.reel);
        case 'hold': return C.hold(st, a.reel);
        case 'boost': return C.useBooster(st, a.id);
        case 'target': C.setTarget(st, a.id); return [];
        default: return [];
    }
}

/** Play a whole fight. Returns the number of actions taken. */
export function botFight(st, maxSteps = 4000, onStep = null) {
    let steps = 0;
    while (st.phase !== 'won' && st.phase !== 'lost' && steps < maxSteps) {
        const a = botNext(st);
        if (!a) break;
        const ev = applyAction(st, a);
        if (onStep) onStep(st, a, ev);
        steps++;
    }
    return steps;
}

// ------------------------------------------------------------------ between fights


const MACHINE = ['reels', 'matrix', 'reactor', 'chassis', 'missile', 'arc', 'servos', 'core'];
const LEVELLED = ['blade', 'cannon', 'armor', 'missile', 'arc', 'shield', 'repair'];

/** Spend skill points, equip the best modules, buy upgrades and facilities. */
export function botManage(p) {
    collectFacilities(p);
    for (let guard = 0; guard < 60 && p.pilot.sp > 0; guard++) {
        const id = SKILL_IDS.find((k) => canLearn(p, k).ok);
        if (!id) break;
        learn(p, id);
    }
    const ranked = p.mods.slice().sort((a, b) => (b.rar * 10 + b.lv) - (a.rar * 10 + a.lv));
    p.equipped = ranked.slice(0, p.mech.chassis + 1).map((m) => m.uid);
    for (const m of ranked) {
        if (!p.equipped.includes(m.uid)) continue;
        while (m.lv < RARITIES[m.rar].maxLv) {
            const c = Math.round(90 * (1 + m.rar) * Math.pow(2.1, m.lv - 1));
            if (p.scrap < c * 4) break;
            p.scrap -= c;
            m.lv++;
        }
    }
    // half the purse goes on hull and guns first, so the machine never outgrows the frame
    const budget = p.scrap * 0.5;
    let spent = 0;
    for (let guard = 0; guard < 400; guard++) {
        const id = cheapestLevelled(p);
        if (!id) break;
        const c = canUpgrade(p, id).cost.scrap;
        if (spent + c > budget) break;
        spent += c;
        doUpgrade(p, id);
    }
    for (let guard = 0; guard < 400; guard++) {
        let bought = false;
        for (const id of MACHINE) {
            if ((id === 'missile' || id === 'arc') && p.mech[id] > 0) continue;
            if (canUpgrade(p, id).ok) { doUpgrade(p, id); bought = true; break; }
        }
        if (bought) continue;
        for (const id of ['drones', 'refinery', 'archive', 'forge']) {
            const c = facilityCost(p, id);
            if (c !== null && c < p.scrap * 0.25 && p.campaign.best >= FACILITIES[id].gate) { upgradeFacility(p, id); bought = true; break; }
        }
        if (bought) continue;
        // the cheapest levelled system, keeping a reserve for the next machine upgrade
        let reserve = 0;
        for (const id of MACHINE) {
            const r = canUpgrade(p, id);
            if (r.ok || !r.cost || r.why === 'MAX' || p.cores < r.cost.cores) continue;
            if (r.why === 'scrap' && r.cost.scrap < p.scrap * 3) reserve = Math.max(reserve, r.cost.scrap);
        }
        const best = cheapestLevelled(p);
        if (!best || p.scrap - canUpgrade(p, best).cost.scrap < reserve) break;
        doUpgrade(p, best);
    }
}

function cheapestLevelled(p) {
    let best = null, bestCost = Infinity;
    for (const id of LEVELLED) {
        const r = canUpgrade(p, id);
        if (!r.ok || (SYSTEMS[id].install && p.mech[id] === 0)) continue;
        const weight = id === 'armor' ? 0.8 : id === 'blade' || id === 'cannon' ? 1 : 1.3;
        if (r.cost.scrap * weight < bestCost) { bestCost = r.cost.scrap * weight; best = id; }
    }
    return best;
}
