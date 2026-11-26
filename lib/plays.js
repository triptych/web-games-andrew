/**
 * plays.js — count a play of this game, for the player counts on the Pocket Garden's cartridges and the classic list.
 *
 * Loaded by ../lib/pwa.js on every game page (game-037, which has its own service worker, loads it directly):
 *
 *   <script src="../lib/plays.js" defer></script>
 *
 * Each device gets a random id (localStorage `web-games.player`, nothing else about the player), and the page calls
 * the Supabase function record_play(game, id) once it has loaded: the device counts once as a player of the game,
 * and again as a play after 30 minutes (the database enforces that too, see dev/supabase/game_stats.sql). It only
 * runs on the published site (not local servers, tests or itch.io builds; `localStorage['web-games.stats'] = 'on'`
 * turns it on anywhere, for testing), it never shows anything, and any failure is silent.
 */
(() => {
    'use strict';
    if (window.__plays) return;
    window.__plays = true;

    // the same project and public key as lib/core/cloud.js
    const API = 'https://zhjcfwrgvwfmjhfibkjc.supabase.co';
    const KEY = 'sb_publishable_6ayGkiwjNSgNbIL_gFoCcw_dgw_Dl3r';
    const PLAYER_KEY = 'web-games.player';
    const SENT_KEY = 'web-games.plays';
    const AGAIN_MS = 30 * 60 * 1000;

    const m = location.pathname.match(/\/(game-\d{3})\//);
    if (!m) return;
    const game = m[1];
    let on = location.hostname === 'triptych.github.io';
    try { on = on || localStorage.getItem('web-games.stats') === 'on'; } catch (e) { return; }
    if (!on) return;

    function uuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        const b = crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
        const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    function send() {
        let player, sent;
        try {
            player = localStorage.getItem(PLAYER_KEY);
            if (!/^[0-9a-f-]{36}$/.test(player || '')) { player = uuid(); localStorage.setItem(PLAYER_KEY, player); }
            sent = JSON.parse(localStorage.getItem(SENT_KEY) || '{}') || {};
            if (Date.now() - (sent[game] || 0) < AGAIN_MS) return;
            sent[game] = Date.now();
            localStorage.setItem(SENT_KEY, JSON.stringify(sent));
        } catch (e) { return; }      // storage blocked: no id to count by
        fetch(`${API}/rest/v1/rpc/record_play`, {
            method: 'POST',
            headers: { apikey: KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_game: game, p_player: player }),
            keepalive: true,
        }).catch(() => {});
    }

    // after the game has loaded, so the request never competes with its own files
    const later = () => setTimeout(send, 2500);
    if (document.readyState === 'complete') later();
    else addEventListener('load', later, { once: true });
})();
