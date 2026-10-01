/**
 * quests.js — the carrier's contract board. Three contracts are always posted;
 * each is a predicate on battle stats, re-tested after every fight. Claiming one
 * posts a fresh one, sized to how far the pilot has come.
 */

import { rewardScale, hpScale } from './enemies.js';
import { fmt } from './format.js';
import { SYMBOLS } from './symbols.js';

const GIVERS = ['Quartermaster Lio', 'Chief Dace', 'Cmdr. Varga', 'Halo (Juno)', 'Academy Registrar', 'Flight Surgeon Imre', 'Signals Officer Pell'];

/** mode 'sum' adds the battle's number, 'max' keeps the best single battle. */
const TEMPLATES = {
    kills:     { mode: 'sum', stat: (s) => s.kills, text: (q) => `Destroy ${q.target} Determinant units`, size: (t) => 8 + 3 * t },
    lines:     { mode: 'sum', stat: (s, q) => s.lines[q.sym] ?? 0, text: (q) => `Land ${q.target} ${SYMBOLS[q.sym].name} lines`, size: (t) => 5 + 2 * t },
    anylines:  { mode: 'sum', stat: (s) => s.linesTotal, text: (q) => `Land ${q.target} paylines`, size: (t) => 18 + 8 * t },
    overdrive: { mode: 'sum', stat: (s) => s.overdrives, text: (q) => `Trigger Overdrive ${q.target} time${q.target > 1 ? 's' : ''}`, size: (t) => 1 + Math.floor(t / 2) },
    chain:     { mode: 'max', stat: (s) => s.maxChain, text: (q) => `Hit a ×${q.target} chain in a single spin`, size: (t) => Math.min(12, 3 + Math.floor(t * 0.8)) },
    bigspin:   { mode: 'max', stat: (s) => s.maxSpin, text: (q) => `Deal ${fmt(q.target)} damage in a single spin`, size: (t) => Math.round(45 * hpScale(t)) },
    flawless:  { mode: 'sum', stat: (s) => s.flawless ?? 0, text: (q) => `Win ${q.target} fight${q.target > 1 ? 's' : ''} without losing hull`, size: (t) => 1 + Math.min(2, Math.floor(t / 3)) },
    elites:    { mode: 'sum', stat: (s) => s.elites, text: (q) => `Destroy ${q.target} elite${q.target > 1 ? 's' : ''}`, size: (t) => 1 + Math.floor(t / 3), min: 1 },
    scrap:     { mode: 'sum', stat: (s) => s.scrap, text: (q) => `Pick up ${fmt(q.target)} scrap from Scrap symbols`, size: (t) => Math.round(60 * rewardScale(t)) },
    crits:     { mode: 'sum', stat: (s) => s.crits, text: (q) => `Land ${q.target} critical hits`, size: (t) => 6 + 3 * t },
    jackpot:   { mode: 'sum', stat: (s) => s.jackpots, text: () => 'Hit the Jackpot', size: () => 1, min: 2 },
    five:      { mode: 'sum', stat: (s) => s.five, text: (q) => `Land ${q.target} five-of-a-kind line${q.target > 1 ? 's' : ''}`, size: (t) => 1 + Math.floor(t / 3), needCols: 5 },
    cascades:  { mode: 'sum', stat: (s) => s.cascades, text: (q) => `Trigger ${q.target} cascades`, size: (t) => 4 + 2 * t, needMod: 'cascade' },
};

export function questTier(profile) {
    return profile.campaign.best + 5 * profile.campaign.threat;
}

export function makeQuest(profile, rng) {
    const t = questTier(profile);
    const cols = profile.mech.reels + 2;
    const owned = new Set(profile.mods.map((m) => m.id));
    const taken = new Set(profile.quests.active.map((q) => q.tpl + (q.sym ?? '')));
    const pool = Object.keys(TEMPLATES).filter((k) => {
        const T = TEMPLATES[k];
        if (T.min && profile.campaign.best < T.min) return false;
        if (T.needCols && cols < T.needCols) return false;
        if (T.needMod && !owned.has(T.needMod)) return false;
        return true;
    });
    let tpl, sym;
    for (let i = 0; i < 10; i++) {
        tpl = rng.pick(pool);
        sym = undefined;
        if (tpl === 'lines') {
            const syms = ['blade', 'cannon', 'shield', 'repair', 'energy'];
            if (profile.mech.missile) syms.push('missile');
            if (profile.mech.arc) syms.push('arc');
            sym = rng.pick(syms);
        }
        if (!taken.has(tpl + (sym ?? ''))) break;
    }
    const T = TEMPLATES[tpl];
    const target = Math.max(1, T.size(t));
    const hard = tpl === 'jackpot' || tpl === 'five' || tpl === 'chain' || tpl === 'flawless';
    const reward = {
        scrap: Math.round((hard ? 160 : 110) * rewardScale(Math.min(t, 7 + 5 * profile.campaign.threat)) * rng.range(0.9, 1.2)),
        xp: Math.round((hard ? 60 : 40) * Math.pow(1.6, t)),
        cores: hard || rng.chance(0.35) ? 1 + Math.floor(t / 3) : 0,
        mod: hard && rng.chance(0.5),
    };
    profile.quests.seq++;
    return {
        uid: profile.quests.seq, tpl, sym, target, progress: 0, done: false, reward,
        giver: rng.pick(GIVERS),
    };
}

export function questText(q) {
    return TEMPLATES[q.tpl].text(q);
}

/** Fill the board to three. */
export function refillQuests(profile, rng) {
    while (profile.quests.active.length < 3) profile.quests.active.push(makeQuest(profile, rng));
}

/** Re-test every active contract against one fight's stats. Returns newly completed quests. */
export function trackBattle(profile, stats) {
    const done = [];
    for (const q of profile.quests.active) {
        if (q.done) continue;
        const T = TEMPLATES[q.tpl];
        const v = T.stat(stats, q) ?? 0;
        q.progress = T.mode === 'max' ? Math.max(q.progress, v) : q.progress + v;
        if (q.progress >= q.target) {
            q.progress = q.target;
            q.done = true;
            done.push(q);
        }
    }
    return done;
}
