/**
 * state.js — what outlives a run: coins, talent levels, unlocked chapters,
 * best stage per chapter, endless record, settings. Persisted to
 * localStorage, wrapped because private windows and blocked storage throw.
 */

import { TALENTS, CHAPTERS, talentCost } from './config.js';

const KEY = 'quiverspire-v1';

function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

class Persistent {
    constructor() {
        const d = load();
        this.coins = Number(d.coins) || 0;
        this.talents = {};
        for (const k of Object.keys(TALENTS)) this.talents[k] = Math.min(TALENTS[k].max, Number(d.talents?.[k]) || 0);
        this.unlocked = Math.max(1, Math.min(CHAPTERS.length, Number(d.unlocked) || 1));
        this.best = d.best ?? {};            // chapter → best stage index reached (1-based)
        this.cleared = d.cleared ?? {};      // chapter → true
        this.endlessBest = Number(d.endlessBest) || 0;
        this.muted = !!d.muted;
        this.chapter = Math.min(this.unlocked, Number(d.chapter) || 1);
        this.runs = Number(d.runs) || 0;
        this.kills = Number(d.kills) || 0;
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({
                coins: this.coins, talents: this.talents, unlocked: this.unlocked, best: this.best,
                cleared: this.cleared, endlessBest: this.endlessBest, muted: this.muted,
                chapter: this.chapter, runs: this.runs, kills: this.kills,
            }));
        } catch { /* storage unavailable: progress lasts this session only */ }
    }

    talentPrice(id) { return talentCost(this.talents[id]); }

    buyTalent(id) {
        const lvl = this.talents[id];
        if (lvl >= TALENTS[id].max) return false;
        const cost = talentCost(lvl);
        if (this.coins < cost) return false;
        this.coins -= cost;
        this.talents[id] = lvl + 1;
        this.save();
        return true;
    }

    get endlessUnlocked() { return !!this.cleared[1]; }

    /** Bank a finished run. Returns { newBest, unlockedChapter }. */
    recordRun(w, coins) {
        this.coins += coins;
        this.runs++;
        this.kills += w.stats.kills;
        const out = { newBest: false, unlockedChapter: 0 };
        if (w.endless) {
            if (w.stageNum > this.endlessBest) { this.endlessBest = w.stageNum; out.newBest = true; }
        } else {
            const reached = w.result === 'clear' ? 13 : w.stage + 1;
            if (reached > (this.best[w.chapter] ?? 0)) { this.best[w.chapter] = reached; out.newBest = true; }
            if (w.result === 'clear') {
                this.cleared[w.chapter] = true;
                if (w.chapter === this.unlocked && this.unlocked < CHAPTERS.length) {
                    this.unlocked++;
                    out.unlockedChapter = this.unlocked;
                }
            }
        }
        this.save();
        return out;
    }
}

export const state = new Persistent();
