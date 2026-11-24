// Cloud saves with Supabase: sign in with a link emailed to you (no password), keep one save per player online in the
// game_saves table, and carry on from another device. Plain fetch against Supabase's REST endpoints (Auth and
// PostgREST), no client library. Local saves keep working as before; the cloud is an extra copy.
//
// The publishable key below is meant to be in the page: row-level security on game_saves lets each signed-in player
// read and write only their own rows, and anonymous visitors none at all.
// The magic link only returns to addresses on the project's Auth redirect allow-list (Supabase dashboard,
// Authentication → URL Configuration), so the game's address must be listed there.

import { SAVE_KEY } from './config.js';

export const SUPABASE_URL = 'https://zhjcfwrgvwfmjhfibkjc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6ayGkiwjNSgNbIL_gFoCcw_dgw_Dl3r';
const GAME = 'game-147', SLOT = 'main';
const SESSION_KEY = SAVE_KEY + '.cloud';
const KEEPALIVE_MAX = 60000;          // a fetch with keepalive (sent as the page closes) carries at most 64 KB

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, val) { try { if (val == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch { /* blocked */ } }
/** The claims inside a Supabase access token (a JWT): sub (the user id), email, exp. */
function claims(jwt) {
    try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}
async function failure(res, fallback) {
    let msg = fallback;
    let code = '';
    try { const j = await res.json(); code = j.error_code || j.code || ''; msg = j.msg || j.message || j.error_description || j.error || fallback; } catch { /* not JSON */ }
    // Supabase's built-in email only sends to the project's own team until a custom SMTP provider is set up
    if (code === 'email_address_not_authorized') msg = 'Cloud saves are invite-only for now: this email address isn\'t on the list yet.';
    else if (code === 'over_email_send_rate_limit') msg = 'Too many sign-in emails were sent this hour: try again a little later.';
    else if (res.status === 429) msg = 'Too many tries: wait a minute and try again.';
    return new Error(msg);
}

export class Cloud {
    constructor() {
        this.session = read(SESSION_KEY);       // { access_token, refresh_token, expires_at (s), email, user }
        this.busy = false;
    }

    get signedIn() { return !!this.session?.access_token; }
    get email() { return this.session?.email || ''; }

    /**
     * A magic link brings the player back to the game with the session in the address (#access_token=…). Keep it and
     * tidy the address bar. Returns 'signed-in', an error message from Supabase, or null when there was nothing.
     */
    consumeRedirect() {
        const hash = location.hash.slice(1);
        if (!hash) return null;
        const p = new URLSearchParams(hash);
        const clean = () => history.replaceState(null, '', location.pathname + location.search);
        if (p.get('error') || p.get('error_description')) { clean(); return (p.get('error_description') || p.get('error')).replace(/\+/g, ' '); }
        const access = p.get('access_token');
        if (!access) return null;
        const c = claims(access);
        this.session = {
            access_token: access, refresh_token: p.get('refresh_token'),
            expires_at: Number(p.get('expires_at')) || c.exp || Date.now() / 1000 + Number(p.get('expires_in') || 3600),
            email: c.email || '', user: c.sub,
        };
        write(SESSION_KEY, this.session);
        clean();
        return 'signed-in';
    }

    /** Where the magic link should bring the player back to: this page. */
    redirectTo() { return location.origin + location.pathname; }

    /** Email a sign-in link (signing up on first use). */
    async signIn(email) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(this.redirectTo())}`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, create_user: true }),
        });
        if (!res.ok) throw await failure(res, 'The sign-in link could not be sent.');
    }

    async signOut() {
        const s = this.session;
        this.session = null;
        write(SESSION_KEY, null);
        if (s) try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` } }); } catch { /* offline: signed out here anyway */ }
    }

    /** A fresh access token (refreshed a minute before it runs out). */
    async token() {
        const s = this.session;
        if (!s) throw new Error('Not signed in.');
        if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        if (res.status === 400 || res.status === 401) { this.session = null; write(SESSION_KEY, null); throw new Error('Your sign-in has expired: please sign in again.'); }
        if (!res.ok) throw await failure(res, 'Could not reach the cloud.');
        const j = await res.json();
        this.session = { ...s, access_token: j.access_token, refresh_token: j.refresh_token || s.refresh_token, expires_at: j.expires_at || Date.now() / 1000 + (j.expires_in || 3600), email: j.user?.email || s.email };
        write(SESSION_KEY, this.session);
        return this.session.access_token;
    }

    async headers() {
        return { apikey: SUPABASE_KEY, Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' };
    }

    /** Put a save online (replacing the previous one). save is what the local save holds: { savedAt, data }. */
    async upload(save, { version = '', summary = '', keepalive = false } = {}) {
        const body = JSON.stringify({ user_id: this.session?.user || claims(this.session?.access_token || '').sub, game: GAME, slot: SLOT, data: save, version, summary: summary.slice(0, 200) });
        const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?on_conflict=user_id,game,slot`, {
            method: 'POST',
            headers: { ...(await this.headers()), Prefer: 'resolution=merge-duplicates,return=minimal' },
            body,
            keepalive: keepalive && body.length < KEEPALIVE_MAX,
        });
        if (!res.ok) throw await failure(res, 'The cloud save failed.');
    }

    /** The online save: { data: { savedAt, data }, version, summary, updated_at }, or null if there is none. */
    async download() {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/game_saves?select=data,version,summary,updated_at&game=eq.${GAME}&slot=eq.${SLOT}`, { headers: await this.headers() });
        if (!res.ok) throw await failure(res, 'Could not read the cloud save.');
        const rows = await res.json();
        return rows[0] || null;
    }
}
