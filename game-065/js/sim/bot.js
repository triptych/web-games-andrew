/**
 * bot.js — plays Worldroot through the real Grove API, for balance runs
 * (dev/simtest.mjs) and the in-browser ?debug=1 autoplay.
 *
 * It is a reasonable, not optimal, player: it compares the payback time of the
 * best spirit, the next Nourish and every upgrade, catches wisps, casts spells,
 * is reborn when that would roughly double its heartwood, spends heartwood by a
 * priority list, runs trials when it can, and binds realms.
 *
 * profile: { cps: clicks per second, wisps: catch them?, spells: cast them?,
 *            every: seconds between shopping trips (an idle player shops rarely) }
 */

import { GENERATORS, UPGRADE_BY_ID, HEARTWOOD, TRIALS, REALMS, SPELLS, REBIRTH_STAGE } from './data.js';

export const ACTIVE = { cps: 4, wisps: true, spells: true, every: 1 };
export const CASUAL = { cps: 1, wisps: true, spells: true, every: 10 };
export const IDLE = { cps: 0.3, wisps: false, spells: false, every: 300 };

const HW_PRIORITY = ['dowry', 'keepers', 'hands', 'roots', 'scribes', 'gardener', 'dream', 'bark', 'kin', 'wells', 'sleep', 'catcher', 'heart'];

export class Bot {
    constructor(grove, profile = ACTIVE) {
        this.g = grove;
        this.p = profile;
        this.shopT = 0;
        this.log = [];
        this.lastLevel = grove.s.tree;
        this.lastLevelT = grove.s.t;
    }

    upgradeGain(u) {
        const g = this.g, d = g.derive(), f = u.fx, mps = g.mps();
        const clickRate = this.p.cps * g.clickValue();
        switch (f.kind) {
            case 'gen': return d.rates[f.gen] * (f.mult - 1);
            case 'global': return mps * (f.mult - 1);
            case 'radiance': return mps * f.k * d.ach;
            case 'synergy': return d.rates[f.gen] * f.pct * g.s.gens[f.from];
            case 'click': return clickRate * (f.mult - 1);
            case 'clickPct': return this.p.cps * f.pct * mps;
            default: return mps * 0.05;   // wisps, sap: small but real
        }
    }

    shop() {
        const g = this.g, s = g.s;
        for (let guard = 0; guard < 600; guard++) {
            const mps = Math.max(g.mps() + this.p.cps * g.clickValue(), 1e-9);
            let best = null, bestPay = Infinity;
            // spirits
            for (let i = 0; i < GENERATORS.length; i++) {
                if (!g.genVisible(i) && !(i > 0 && s.gens[i - 1] > 0 && g.genUnlocked(i))) continue;
                const cost = g.genCost(i);
                let gain = GENERATORS[i].mps * g.derive().genMult[i] * g.derive().global;
                const ms = g.nextMilestone(i);
                if (ms && ms - s.gens[i] <= 5) gain *= 1.6;           // close to a doubling
                const pay = cost / gain + cost / mps * 0.3;
                if (pay < bestPay) { bestPay = pay; best = { k: 'gen', i, cost }; }
            }
            // the tree: 5% of everything, plus a new stage every ten levels
            if (!g.treeMaxed()) {
                const cost = g.treeCost();
                let gain = mps * 0.05;
                if ((s.tree + 1) % 10 === 0) gain *= 3;
                const pay = cost / gain + cost / mps * 0.3;
                if (pay < bestPay) { bestPay = pay; best = { k: 'tree', cost }; }
            }
            // upgrades
            for (const u of g.availableUpgrades()) {
                const gain = Math.max(this.upgradeGain(u), 1e-12);
                const pay = (u.cost / gain + u.cost / mps * 0.3) * 0.8;
                if (pay < bestPay) { bestPay = pay; best = { k: 'up', id: u.id, cost: u.cost }; }
            }
            if (!best || best.cost > s.motes) break;
            if (best.k === 'gen') g.buyGen(best.i, 1);
            else if (best.k === 'tree') g.nourish();
            else g.buyUpgrade(best.id);
        }
    }

    spendHeartwood() {
        const g = this.g;
        for (let guard = 0; guard < 200; guard++) {
            let did = false;
            for (const id of HW_PRIORITY) {
                if (g.buyHeartwood(id)) { did = true; break; }
            }
            if (!did) break;
        }
        for (const k of ['gens', 'ups', 'tree']) g.s.auto[k] = true;
    }

    castSpells() {
        const g = this.g;
        if (!this.p.spells) return;
        for (const sp of ['starfall', 'surge', 'quicken', 'hands', 'lure']) {
            if (sp === 'hands' && this.p.cps < 2) continue;
            if (g.canCast(sp)) { g.cast(sp); break; }
        }
    }

    /** Decide on rebirth / trials / realms. Returns a label if something happened. */
    prestige() {
        const g = this.g, s = g.s;
        if (g.treeMaxed() && !s.trial) {
            const next = REALMS.find((r) => !g.hasRealm(r.id));
            if (next) { g.bindRealm(next.id); this.spendHeartwood(); return `realm ${next.id}`; }
        }
        if (s.trial) {
            if (s.trialsDone[s.trial] || s.runT > 3 * 3600) { const t = s.trial; g.rebirth(); this.spendHeartwood(); return `trial ${t} ${s.trialsDone[t] ? 'done' : 'abandoned'}`; }
            return null;
        }
        if (g.stage < REBIRTH_STAGE) return null;
        const gain = g.hwGain();
        const want = Math.max(10, s.hwEarned * 1.0);
        // a real player is reborn once the tree has stopped growing for a while
        const stalled = s.runT > 1200 && s.t - this.lastLevelT > 900 && gain >= Math.max(3, s.hwEarned * 0.08);
        if (gain >= want || stalled) {
            g.rebirth();
            this.spendHeartwood();
            // try a trial every few rebirths once strong enough
            if (s.rebirths >= 3 && s.rebirths % 3 === 0) {
                const t = TRIALS.find((x) => !s.trialsDone[x.id] && g.trialOpen(x.id));
                if (t) { g.startTrial(t.id); return `rebirth +${gain} → trial ${t.id}`; }
            }
            return `rebirth +${gain}`;
        }
        return null;
    }

    /** Play for `seconds` of game time in 1-second steps. */
    play(seconds, onEvent) {
        const g = this.g;
        for (let t = 0; t < seconds; t++) {
            if (this.p.cps) g.click(this.p.cps);
            g.tick(1);
            if (g.s.tree !== this.lastLevel) { this.lastLevel = g.s.tree; this.lastLevelT = g.s.t; }
            if (this.p.wisps && g.s.wisp.active && g.s.t - g.s.wisp.active.born > 2) g.catchWisp();
            this.shopT += 1;
            if (this.shopT >= this.p.every) {
                this.shopT = 0;
                this.castSpells();
                this.shop();
                const what = this.prestige();
                if (what && onEvent) onEvent(what);
            }
        }
    }
}

export { HW_PRIORITY, UPGRADE_BY_ID, HEARTWOOD, SPELLS };
