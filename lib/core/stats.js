// lib/core/stats.js — how many players each game has had (the Supabase table game_stats, filled by lib/plays.js).
//
//   import { playerCounts, playersLabel } from '../lib/core/stats.js';
//   const counts = await playerCounts();          // { 'game-031': { players: 120, plays: 300 }, … } or {} if unknown
//   playersLabel(counts['game-031']?.players)     // '120 players', '1 player', '1.2k players', or '' for none
//
// Public data: read with the publishable key, no sign-in. The answer is kept for an hour in localStorage
// (`web-games.stats.cache`), so pages open without waiting and show the last counts offline. It only asks on the
// published site (`localStorage['web-games.stats'] = 'on'` asks anywhere, for testing); elsewhere it returns the
// cached counts, if any, or {}. Never throws.

// the same project and public key as lib/core/cloud.js (not imported: that module reads sign-in links at import)
const SUPABASE_URL = 'https://zhjcfwrgvwfmjhfibkjc.supabase.co';
const KEY = 'sb_publishable_6ayGkiwjNSgNbIL_gFoCcw_dgw_Dl3r';
const CACHE_KEY = 'web-games.stats.cache';
const FRESH_MS = 60 * 60 * 1000;

function cached() {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && typeof c.counts === 'object' ? c : null; } catch { return null; }
}

/** Is this page allowed to ask Supabase for the counts? */
export function statsOn() {
    try { return location.hostname === 'triptych.github.io' || localStorage.getItem('web-games.stats') === 'on'; } catch { return false; }
}

let pending = null;
/** The counts per game id. `fresh: true` skips the hour-long cache. */
export function playerCounts({ fresh = false } = {}) {
    const c = cached();
    if (!statsOn()) return Promise.resolve(c?.counts || {});
    if (c && !fresh && Date.now() - c.t < FRESH_MS) return Promise.resolve(c.counts);
    pending ??= fetch(`${SUPABASE_URL}/rest/v1/game_stats?select=game,players,plays`, { headers: { apikey: KEY } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((rows) => {
            const counts = {};
            for (const r of Array.isArray(rows) ? rows : []) if (r && typeof r.game === 'string') counts[r.game] = { players: r.players | 0, plays: r.plays | 0 };
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), counts })); } catch { /* blocked */ }
            return counts;
        })
        .catch(() => c?.counts || {})
        .finally(() => { pending = null; });
    return pending;
}

/** The counts already known on this device (no network), or {}. */
export function cachedCounts() { return cached()?.counts || {}; }

/** '1 player', '57 players', '1.2k players', '3.4M players'; '' for none. */
export function playersLabel(n) {
    n = Number(n) || 0;
    if (n <= 0) return '';
    const s = n < 1000 ? String(n) : n < 1e6 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k` : `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    return `${s} player${n === 1 ? '' : 's'}`;
}
