// lib/core/cloud.js — cloud saves for every game, with one sign-in for all of them (Supabase, plain fetch).
//
//   import { makeCloud } from '../lib/core/cloud.js';
//   const cloud = makeCloud({ game: 'game-031' });          // the game's folder id: its rows in the shared table
//   cloud.consumeRedirect();                                 // once at boot: back from an emailed sign-in link?
//   await cloud.signIn('player@example.com');                // emails a link that opens this page signed in
//   await cloud.upload(save, { version, summary });          // the game's own save, any JSON
//   const row = await cloud.download();                      // { data, version, summary, updated_at } or null
//
// Saves can't collide: each row is (player, game, slot), and each game sends its own folder id. The sign-in is
// shared: every game on the site (one origin, one localStorage) reads the same session from `web-games.cloud`, so
// signing in on one game signs you in on all of them, and signing out signs out everywhere.
// Supabase rotates the refresh token on every refresh, so with several games open in tabs, a refresh holds a
// browser lock and re-reads the stored session first: whichever tab refreshes, the others pick up its tokens.
//
// The backend (project web-games, table game_saves with row-level security) and the dashboard setup are described in
// docs/generic/cloud-saves.md. The publishable key below is meant to be public; RLS decides what each player sees.
// Nothing here throws at import, and with storage blocked the cloud simply stays signed out.

export const SUPABASE_URL = 'https://zhjcfwrgvwfmjhfibkjc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6ayGkiwjNSgNbIL_gFoCcw_dgw_Dl3r';
export const SESSION_KEY = 'web-games.cloud';
const LEGACY_KEYS = ['inn-over-my-head.v1.cloud'];      // game-147's own session before the shared sign-in
const KEEPALIVE_MAX = 60000;
// Where a sign-in link can come back to: the site, and local testing. These match the project's Auth Redirect URLs;
// anywhere else (an itch.io build, another host) the Cloud Save buttons hide themselves (cloud-ui.js boot()).
export const CLOUD_HOSTS = ['triptych.github.io', 'localhost', '127.0.0.1'];                            // a keepalive fetch (sent as a page closes) carries ≤ 64 KB

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, val) { try { if (val == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch { /* blocked */ } }

/** The claims inside a Supabase access token (a JWT): sub (the user id), email, exp. */
export function claims(jwt) {
    try { return JSON.parse(atob(String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}

async function failure(res, fallback) {
    let msg = fallback, code = '';
    try { const j = await res.json(); code = j.error_code || j.code || ''; msg = j.msg || j.message || j.error_description || j.error || fallback; } catch { /* not JSON */ }
    // Supabase's built-in email only sends to the project's own team until a custom SMTP sender is set up
    if (code === 'email_address_not_authorized') msg = 'Cloud saves are invite-only for now: this email address isn\'t on the list yet.';
    else if (code === 'over_email_send_rate_limit') msg = 'Too many sign-in emails were sent this hour: try again a little later.';
    else if (res.status === 429) msg = 'Too many tries: wait a minute and try again.';
    const e = new Error(msg); e.code = code; e.status = res.status;
    return e;
}

/** Run fn holding a cross-tab lock when the browser has the Web Locks API (else just run it). */
function withLock(name, fn) {
    return navigator.locks?.request ? navigator.locks.request(name, fn) : fn();
}

/** The shared session: { access_token, refresh_token, expires_at (s), email, user } or null. */
export function getSession() {
    let s = read(SESSION_KEY);
    if (!s) for (const k of LEGACY_KEYS) { const old = read(k); if (old?.access_token) { s = old; write(SESSION_KEY, s); write(k, null); break; } }
    return s?.access_token ? s : null;
}
function setSession(s) { write(SESSION_KEY, s); }

/**
 * Everything a game keeps under its save key (or several keys, as an array): the key itself and every `key.…` below it
 * (progress, records, …), except
 * settings (volume and the like belong to the device). { [key]: raw string } or null when there's nothing. The usual
 * `getSave` for a game, since it carries whatever the game stores without the game listing it.
 */
export function snapshot(prefix, { exclude = ['.settings'] } = {}) {
    // one prefix, or several for a game whose keys don't all sit under its save key (e.g. 'x.v1' and 'x.album.v1')
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    const out = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!prefixes.some((p) => k === p || k.startsWith(p + '.'))) continue;
            if (exclude.some((x) => k.endsWith(x))) continue;
            out[k] = localStorage.getItem(k);
        }
    } catch { return null; }
    return Object.keys(out).length ? out : null;
}

/**
 * Write a snapshot back (the usual `applySave`, followed by a reload). Keys under the prefix not in it are left alone.
 * Until the page goes away, later writes to those keys are ignored: the reload fires the game's own pagehide /
 * visibilitychange saves, which would otherwise put the game that was on screen straight back over the one just
 * restored (found on Lanternhollow, which saves its dungeon on every pagehide). Pass { freeze: false } to skip that.
 */
export function restore(snap, { freeze = true } = {}) {
    const keys = Object.keys(snap || {});
    try { for (const k of keys) if (typeof snap[k] === 'string') localStorage.setItem(k, snap[k]); }
    catch { return false; }
    if (freeze && keys.length) {
        const kept = new Set(keys), proto = Storage.prototype, set = proto.setItem, del = proto.removeItem;
        proto.setItem = function (k, v) { if (this === localStorage && kept.has(String(k))) return; return set.call(this, k, v); };
        proto.removeItem = function (k) { if (this === localStorage && kept.has(String(k))) return; return del.call(this, k); };
    }
    return true;
}

/** A key's JSON from a snapshot (for a summary line), or null. */
export function snapValue(snap, key) { try { return JSON.parse(snap?.[key]); } catch { return null; } }

/** Read a sign-in (or its error) from the address, keep it and tidy the address bar. */
function takeRedirect() {
    const hash = location.hash.slice(1);
    if (!hash) return null;
    const p = new URLSearchParams(hash);
    const clean = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sandboxed */ } };
    if (p.get('error') || p.get('error_description')) { clean(); return (p.get('error_description') || p.get('error')).replace(/\+/g, ' '); }
    const access = p.get('access_token');
    if (!access) return null;
    const c = claims(access);
    setSession({
        access_token: access, refresh_token: p.get('refresh_token'),
        expires_at: Number(p.get('expires_at')) || c.exp || Date.now() / 1000 + Number(p.get('expires_in') || 3600),
        email: c.email || '', user: c.sub,
    });
    clean();
    return 'signed-in';
}
// taken at import, before any game code can read or rewrite the #fragment; consumeRedirect() reports it once
let early = typeof location === 'undefined' ? null : takeRedirect();

/**
 * A cloud client for one game. `game` is the game's folder id; `slot` defaults to 'main' (games with several save
 * slots pass 'slot-1', 'slot-2', …).
 */
export function makeCloud({ game, slot = 'main' } = {}) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(game || '')) throw new Error(`makeCloud: bad game id "${game}"`);

    const api = {
        game, slot,
        get session() { return getSession(); },
        get signedIn() { return !!getSession(); },
        get email() { return getSession()?.email || ''; },
        /** Can this page sign in? (Is it served from a host on the redirect list?) */
        get available() { return CLOUD_HOSTS.includes(location.hostname); },

        /** Where the emailed link brings the player back to: this page (the game that asked). */
        redirectTo() { return location.origin + location.pathname; },

        /**
         * Back from an emailed link, the page opens with the session in the address (#access_token=…). Keep it (for
         * every game) and tidy the address bar. Returns 'signed-in', an error message, or null if there was nothing.
         * The address is read as soon as this module is imported, before the game's own code runs (some games read
         * the #fragment themselves: Lanternhollow decodes it as a shared dungeon and rewrites it); this reports that.
         */
        consumeRedirect() {
            if (early !== undefined) { const r = early; early = undefined; return r; }
            return takeRedirect();
        },

        /** Email a sign-in link (signing up on first use). */
        async signIn(email) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(api.redirectTo())}`, {
                method: 'POST',
                headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, create_user: true }),
            });
            if (!res.ok) throw await failure(res, 'The sign-in link could not be sent.');
        },

        /** Sign out of every game (the session is shared). */
        async signOut() {
            const s = getSession();
            setSession(null);
            if (s) try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` } }); } catch { /* offline: signed out here anyway */ }
        },

        /** A fresh access token, refreshed a minute before it runs out (once across all open tabs). */
        async token() {
            const fresh = (s) => s && s.expires_at - 60 > Date.now() / 1000;
            let s = getSession();
            if (!s) throw new Error('Not signed in.');
            if (fresh(s)) return s.access_token;
            return withLock('web-games.cloud.refresh', async () => {
                s = getSession();                      // another tab may have refreshed while we waited
                if (!s) throw new Error('Not signed in.');
                if (fresh(s)) return s.access_token;
                const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: s.refresh_token }),
                });
                if (res.status === 400 || res.status === 401) {
                    // a refresh token another tab already used (without the lock API) is refused: take its result
                    const now = getSession();
                    if (now && now.refresh_token !== s.refresh_token && fresh(now)) return now.access_token;
                    setSession(null);
                    throw new Error('Your sign-in has expired: please sign in again.');
                }
                if (!res.ok) throw await failure(res, 'Could not reach the cloud.');
                const j = await res.json();
                const next = { ...s, access_token: j.access_token, refresh_token: j.refresh_token || s.refresh_token, expires_at: j.expires_at || Date.now() / 1000 + (j.expires_in || 3600), email: j.user?.email || s.email };
                setSession(next);
                return next.access_token;
            });
        },

        async headers() {
            return { apikey: SUPABASE_KEY, Authorization: `Bearer ${await api.token()}`, 'Content-Type': 'application/json' };
        },

        /** Put this game's save online, replacing the previous one in this slot. `save` is any JSON. */
        async upload(save, { version = '', summary = '', keepalive = false } = {}) {
            const headers = await api.headers();
            const s = getSession();
            const body = JSON.stringify({ user_id: s?.user || claims(s?.access_token).sub, game, slot, data: save, version: String(version).slice(0, 32), summary: String(summary).slice(0, 200) });
            const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?on_conflict=user_id,game,slot`, {
                method: 'POST',
                headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
                body,
                keepalive: keepalive && body.length < KEEPALIVE_MAX,
            });
            if (!res.ok) throw await failure(res, 'The cloud save failed.');
        },

        /** This game's online save in this slot: { data, version, summary, updated_at }, or null. */
        async download() {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?select=data,version,summary,updated_at&game=eq.${encodeURIComponent(game)}&slot=eq.${encodeURIComponent(slot)}`, { headers: await api.headers() });
            if (!res.ok) throw await failure(res, 'Could not read the cloud save.');
            return (await res.json())[0] || null;
        },

        /** Delete this game's online save in this slot. */
        async remove() {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?game=eq.${encodeURIComponent(game)}&slot=eq.${encodeURIComponent(slot)}`, { method: 'DELETE', headers: await api.headers() });
            if (!res.ok) throw await failure(res, 'Could not delete the cloud save.');
        },

        /** Every cloud save the player has, across all games (no save data): [{ game, slot, summary, version, updated_at }]. */
        async listAll() {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?select=game,slot,summary,version,updated_at&order=updated_at.desc`, { headers: await api.headers() });
            if (!res.ok) throw await failure(res, 'Could not list the cloud saves.');
            return res.json();
        },

        /** Call fn whenever the sign-in changes in another tab or game (the shared session key). Returns an unsubscribe. */
        onChange(fn) {
            const h = (e) => { if (e.key === SESSION_KEY) fn(api.signedIn); };
            window.addEventListener('storage', h);
            return () => window.removeEventListener('storage', h);
        },
    };
    return api;
}
