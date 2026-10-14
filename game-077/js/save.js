// Progress, upgrades and settings in localStorage. Every access is guarded:
// with site data blocked the game still plays, it just forgets.

import { CREW_ORDER, CREW } from './sim/data.js';
import { LEVELS } from './sim/levels.js';

const KEY = 'cuevice.v1';

export function defaults() {
    return {
        settings: { sound: true, music: true, volume: 0.8, quality: 'auto', shake: true, scanlines: true, patrols: true },
        reached: 1,           // highest episode unlocked
        best: {},             // level id -> { grade, score }
        tapes: {},            // level id -> [bool, …]
        rep: 0,
        crewUp: {},           // who -> { hp, charges }
        teamUp: { guide: 0, rewind: 0 },
        finished: false,
        seen: {},             // story scenes already watched
        last: null,           // last squad chosen per level id
    };
}

export function load() {
    const d = defaults();
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return d;
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return d;
        if (s.settings && typeof s.settings === 'object') for (const k of Object.keys(d.settings)) if (typeof s.settings[k] === typeof d.settings[k]) d.settings[k] = s.settings[k];
        d.reached = Math.max(1, Math.min(LEVELS.length, +s.reached || 1));
        d.rep = Math.max(0, Math.min(1e7, +s.rep || 0));
        d.finished = !!s.finished;
        for (const l of LEVELS) {
            const b = s.best?.[l.id];
            if (b && 'SABC'.includes(b.grade)) d.best[l.id] = { grade: b.grade, score: Math.max(0, +b.score || 0) };
            if (Array.isArray(s.tapes?.[l.id])) d.tapes[l.id] = s.tapes[l.id].slice(0, 6).map(Boolean);
        }
        for (const w of CREW_ORDER) {
            const u = s.crewUp?.[w];
            if (u) d.crewUp[w] = { hp: Math.max(0, Math.min(2, +u.hp || 0)), charges: Math.max(0, Math.min(2, +u.charges || 0)) };
        }
        for (const k of ['guide', 'rewind']) d.teamUp[k] = Math.max(0, Math.min(2, +s.teamUp?.[k] || 0));
        if (s.seen && typeof s.seen === 'object') for (const k of Object.keys(s.seen)) d.seen[k] = !!s.seen[k];
        if (s.last && typeof s.last === 'object') {
            d.last = {};
            for (const [k, v] of Object.entries(s.last)) if (Array.isArray(v)) d.last[k] = v.filter((w) => CREW[w]).slice(0, 4);
        }
    } catch { /* blocked or corrupt: defaults */ }
    return d;
}

export function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* blocked */ }
}

export function wipe() {
    try { localStorage.removeItem(KEY); } catch { /* blocked */ }
}

/** Crew available at the start of episode `ep` (recruits found mid-episode are not). */
export function rosterFor(ep) {
    const def = LEVELS[ep - 1];
    return CREW_ORDER.filter((w) => CREW[w].joins < ep || (CREW[w].joins === ep && def.recruit?.who !== w));
}

const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1 };
export function betterGrade(a, b) { return (GRADE_RANK[a] ?? 0) >= (GRADE_RANK[b] ?? 0) ? a : b; }
