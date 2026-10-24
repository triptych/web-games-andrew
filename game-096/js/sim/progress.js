// What the player has done across levels: clears, found things, built inventions, what is equipped.
// Pure functions over a plain object, so the tests can run a whole playthrough in Node.

import { LEVELS, levelMeta, INVENTIONS, MAX_EQUIPPED, shellsEarned, PARTS } from './data.js';

export function emptyProgress() {
    return { v: 1, started: false, cleared: {}, parts: {}, built: {}, equipped: [], seen: {}, crafted: 0, plays: 0 };
}

export function validProgress(P) {
    return !!P && typeof P === 'object' && P.v === 1 && P.cleared && P.parts && P.built && Array.isArray(P.equipped);
}

export function isCleared(P, id) { return !!P.cleared[id]; }

/** A level opens when the one before it has been cleared. */
export function isUnlocked(P, id) {
    const i = LEVELS.findIndex((l) => l.id === id);
    if (i < 0) return false;
    return i === 0 || !!P.cleared[LEVELS[i - 1].id];
}
export function nextLevelId(id) {
    const i = LEVELS.findIndex((l) => l.id === id);
    return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}
export function firstOpenLevel(P) {
    for (const l of LEVELS) if (!P.cleared[l.id]) return l.id;
    return LEVELS[LEVELS.length - 1].id;
}
export function shellsOwned(P) { return shellsEarned(P.cleared); }

export function badgesOf(meta, rec) {
    return {
        curios: rec.curios.every(Boolean),
        pearls: rec.pearlTotal > 0 && rec.pearls >= Math.ceil(rec.pearlTotal * 0.9),
        flawless: rec.flawless,
        speed: rec.time > 0 && rec.time <= meta.par,
    };
}

/**
 * Fold a finished run into the progress.
 * run: { pearls, pearlTotal, curios: [0|1,0|1,0|1], time, oopsies }
 * Returns what is new, for the results screen.
 */
export function applyResult(P, levelId, run) {
    const meta = levelMeta(levelId);
    const before = P.cleared[levelId];
    const rec = before || { pearls: 0, pearlTotal: run.pearlTotal, curios: [0, 0, 0], time: 0, oopsies: 99, flawless: false, clears: 0 };
    const newCurios = [];
    run.curios.forEach((got, i) => {
        if (got && !rec.curios[i]) {
            rec.curios[i] = 1; newCurios.push(i);
            const kind = meta.curios[i];
            P.parts[kind] = (P.parts[kind] || 0) + 1;
        }
    });
    const badgesBefore = before ? badgesOf(meta, rec) : { curios: false, pearls: false, flawless: false, speed: false };
    rec.pearlTotal = run.pearlTotal;
    rec.pearls = Math.max(rec.pearls, run.pearls);
    rec.time = rec.time ? Math.min(rec.time, run.time) : run.time;
    rec.oopsies = Math.min(rec.oopsies, run.oopsies);
    rec.flawless = rec.flawless || run.oopsies === 0;
    rec.clears = (rec.clears || 0) + 1;
    const shellsBefore = shellsEarned(P.cleared);
    P.cleared[levelId] = rec;
    const badges = badgesOf(meta, rec);
    const newBadges = Object.keys(badges).filter((k) => badges[k] && !badgesBefore[k]);
    P.started = true;
    return { firstClear: !before, newCurios, newBadges, badges, rec, newShell: shellsEarned(P.cleared) > shellsBefore ? shellsEarned(P.cleared) - 1 : -1 };
}

// ---------------------------------------------------------------- the workshop
export const invById = (id) => INVENTIONS.find((i) => i.id === id);
export function canBuild(P, id) {
    const inv = invById(id);
    if (!inv || P.built[id]) return false;
    return Object.entries(inv.cost).every(([k, n]) => (P.parts[k] || 0) >= n);
}
export function build(P, id) {
    if (!canBuild(P, id)) return false;
    const inv = invById(id);
    for (const [k, n] of Object.entries(inv.cost)) P.parts[k] -= n;
    P.built[id] = 1; P.crafted = (P.crafted || 0) + 1;
    if (P.equipped.length < MAX_EQUIPPED) P.equipped.push(id);
    return true;
}
export function toggleEquip(P, id) {
    if (!P.built[id]) return 'unbuilt';
    const i = P.equipped.indexOf(id);
    if (i >= 0) { P.equipped.splice(i, 1); return 'off'; }
    if (P.equipped.length >= MAX_EQUIPPED) return 'full';
    P.equipped.push(id);
    return 'on';
}
export function totalParts(P) { return Object.values(P.parts).reduce((a, b) => a + b, 0); }
export function totals(P) {
    let pearls = 0, curios = 0, cleared = 0, badges = 0;
    for (const l of LEVELS) {
        const r = P.cleared[l.id];
        if (!r) continue;
        cleared++; pearls += r.pearls; curios += r.curios.filter(Boolean).length;
        badges += Object.values(badgesOf(l, r)).filter(Boolean).length;
    }
    return { pearls, curios, cleared, badges, levels: LEVELS.length };
}
export { PARTS };
