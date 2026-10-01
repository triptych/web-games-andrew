/**
 * codex.js — the login calendar and the hero Codex (class × element collection).
 */

import { dayKey } from '../core/time.js';
import { CLASS_IDS } from '../data/classes.js';
import { ELEMENTS } from '../data/core.js';
import { grant } from './state.js';

// ---------------------------------------------------------------- login calendar

export const LOGIN_REWARDS = [
    { gold: 5000 },
    { sigils: { common: 5 } },
    { gems: 50 },
    { items: { xpM: 3 } },
    { sigils: { mystic: 1 } },
    { items: { chest: 1 }, gems: 50 },
    { sigils: { mystic: 2 }, gems: 100 },
];

/** Day index (0–6) of today's reward, or -1 if already claimed today. */
export function loginStatus(S) {
    const L = S.login || (S.login = { last: '', streak: 0 });
    const today = dayKey();
    if (L.last === today) return { claimed: true, idx: (L.streak - 1) % 7, streak: L.streak };
    return { claimed: false, idx: L.streak % 7, streak: L.streak };
}

export function claimLogin(S) {
    const st = loginStatus(S);
    if (st.claimed) return null;
    const L = S.login;
    L.last = dayKey();
    L.streak++;
    return grant(S, LOGIN_REWARDS[st.idx]);
}

// ---------------------------------------------------------------- codex

export const CODEX_STEP = 5;      // a reward every 5 unique class × element pairs
export const CODEX_GEMS = 40;

export function codexGrid(S) {
    const grid = {};
    for (const c of CLASS_IDS) { grid[c] = {}; for (const e of ELEMENTS) grid[c][e] = 0; }
    for (const h of S.heroes) grid[h.cls][h.el] = Math.max(grid[h.cls][h.el], h.star);
    // pairs ever owned stay discovered even after release
    const seen = S.codex || (S.codex = { seen: [], claimed: 0 });
    for (const c of CLASS_IDS) for (const e of ELEMENTS) if (grid[c][e] && !seen.seen.includes(`${c}:${e}`)) seen.seen.push(`${c}:${e}`);
    return grid;
}

export function codexCount(S) { codexGrid(S); return S.codex.seen.length; }
export function codexTotal() { return CLASS_IDS.length * ELEMENTS.length; }
export function codexClaimable(S) { return Math.floor(codexCount(S) / CODEX_STEP) - S.codex.claimed; }

export function claimCodex(S) {
    if (codexClaimable(S) < 1) return null;
    S.codex.claimed++;
    const big = S.codex.claimed % 4 === 0;
    return grant(S, big ? { gems: CODEX_GEMS * 2, sigils: { mystic: 1 } } : { gems: CODEX_GEMS });
}
