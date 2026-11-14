// Share links: a diorama packed by js/sim/share.js, as base64url JSON in the URL hash (#d=…).
// Nothing leaves the browser: the link carries the room itself.

import { pack, unpack } from './sim/share.js';

const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function shareURL(G, caption = '') {
    const u = new URL(location.href);
    u.search = '';
    u.hash = 'd=' + b64(JSON.stringify(pack(G, caption)));
    return u.href;
}

/** The diorama in this page's hash, or null. */
export function fromHash(hash = location.hash) {
    const m = /^#d=([A-Za-z0-9_-]+)$/.exec(hash || '');
    if (!m) return null;
    try { return unpack(JSON.parse(unb64(m[1]))); } catch { return null; }
}
