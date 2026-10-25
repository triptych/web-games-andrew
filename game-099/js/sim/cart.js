// Cartridges: the data a player makes. A cart is plain JSON, so it saves, copies and shares as text.
//
//   { v, name, goal, stickers: { id: def }, scenes: [ { name, bg, items: [ { sid, x, y } ] } ] }
//
// `stickers` holds the cart's own stickers and overrides: a def whose id matches a built-in
// replaces it for this cart only. Pure, like the rest of js/sim.

import { COLS, ROWS, LIMITS, THEMES, ART, HEX } from '../config.js';
import { BUILTIN, byId } from './stickers.js';
import { sanitizeRules, TAGS } from './blocks.js';

export const CART_VERSION = 1;
const ID_RE = /^[a-z0-9_]{1,16}$/i;
const safeId = (id) => ID_RE.test(id) && !(id in Object.prototype);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function cleanText(v, max, fallback = '') {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : fallback;
}

export function newScene(name = 'Scene', bg = 'meadow') { return { name, bg, items: [] }; }

export function newCart(name = 'My Cart') {
    return { v: CART_VERSION, name, goal: 'Make a game!', stickers: {}, scenes: [newScene('Scene 1')] };
}

export function blankArt() { return Array.from({ length: ART }, () => '.'.repeat(ART)); }

export function newSticker(id, name = 'New Sticker') {
    const art = blankArt();
    art[4] = '....3333....'; art[5] = '...333333...'; art[6] = '...3c33c33..'.slice(0, 12);
    art[7] = '...333333...'; art[8] = '....3333....';
    return {
        id, name, cat: 'mine', tags: [], size: 1, solid: false, hp: 3, speed: 2, art,
        rules: [{ hat: { t: 'always' }, body: [{ t: 'wander', secs: 1 }] }],
    };
}

function cleanArt(a) {
    if (!Array.isArray(a) || a.length !== ART) return null;
    const out = [];
    for (const row of a) {
        if (typeof row !== 'string' || row.length !== ART) return null;
        for (const ch of row) if (ch !== '.' && !HEX.includes(ch)) return null;
        out.push(row);
    }
    return out;
}

export function sanitizeSticker(raw, id) {
    if (!raw || typeof raw !== 'object') return null;
    const art = cleanArt(raw.art);
    if (!art) return null;
    const tags = Array.isArray(raw.tags)
        ? [...new Set(raw.tags.filter((t) => typeof t === 'string' && /^[a-z0-9_]{1,12}$/i.test(t)).map((t) => t.toLowerCase()))].slice(0, 8)
        : [];
    return {
        id,
        name: cleanText(raw.name, LIMITS.name, id),
        cat: 'mine',
        tags,
        size: raw.size === 2 ? 2 : 1,
        solid: !!raw.solid,
        hp: clamp(Math.round(num(raw.hp, 3)), 1, 99),
        speed: clamp(num(raw.speed, 2), 0, 9),
        art,
        rules: sanitizeRules(raw.rules),
    };
}

/** Rebuild a cart from untrusted JSON. Throws if there is nothing usable. */
export function sanitizeCart(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== CART_VERSION) throw new Error('not a FABLECART cartridge');
    const cart = {
        v: CART_VERSION,
        name: cleanText(raw.name, LIMITS.name, 'Imported'),
        goal: cleanText(raw.goal, LIMITS.goal),
        stickers: {},
        scenes: [],
    };
    if (raw.stickers && typeof raw.stickers === 'object') {
        for (const id of Object.keys(raw.stickers)) {
            if (!safeId(id) || byId[id]?.hidden || Object.keys(cart.stickers).length >= LIMITS.customStickers) continue;
            const s = sanitizeSticker(raw.stickers[id], id);
            if (s) {
                if (id in byId) { s.cat = byId[id].cat; s.override = true; }
                cart.stickers[id] = s;
            }
        }
    }
    const known = (sid) => Object.hasOwn(cart.stickers, sid) || sid in byId;
    for (const sc of Array.isArray(raw.scenes) ? raw.scenes.slice(0, LIMITS.scenes) : []) {
        if (!sc || typeof sc !== 'object') continue;
        const scene = {
            name: cleanText(sc.name, LIMITS.name, `Scene ${cart.scenes.length + 1}`),
            bg: THEMES.includes(sc.bg) ? sc.bg : 'meadow',
            items: [],
        };
        for (const it of Array.isArray(sc.items) ? sc.items : []) {
            if (scene.items.length >= LIMITS.items) break;
            if (!it || typeof it.sid !== 'string' || !known(it.sid) || byId[it.sid]?.hidden) continue;
            scene.items.push({ sid: it.sid, x: clamp(num(it.x, 1), 0, COLS), y: clamp(num(it.y, 1), 0, ROWS) });
        }
        cart.scenes.push(scene);
    }
    if (!cart.scenes.length) cart.scenes.push(newScene('Scene 1'));
    return cart;
}

// ------------------------------------------------------------------ sharing as text

const b64 = {
    enc: (s) => {
        const bytes = new TextEncoder().encode(s);
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec: (s) => {
        const t = s.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
        return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    },
};

export function encodeCart(cart) { return 'FC1:' + b64.enc(JSON.stringify(cart)); }

export function decodeCart(text) {
    const t = String(text || '').trim();
    if (t.length > LIMITS.importBytes) throw new Error('that code is too long');
    if (!t.startsWith('FC1:')) throw new Error('that is not a FABLECART code');
    let raw;
    try { raw = JSON.parse(b64.dec(t.slice(4))); } catch { throw new Error('that code is damaged'); }
    return sanitizeCart(raw);
}

// ------------------------------------------------------------------ definitions

/** Every sticker a cart can use: the built-ins, with the cart's own stickers and overrides on top. */
export function defsFor(cart) {
    const defs = Object.create(null);
    for (const d of BUILTIN) defs[d.id] = d;
    if (cart) for (const [id, d] of Object.entries(cart.stickers)) defs[id] = { ...d, builtin: false };
    return defs;
}

export function paletteList(cart) {
    return Object.values(defsFor(cart)).filter((d) => !d.hidden);
}

export function uniqueStickerId(cart) {
    for (let i = 1; i < 999; i++) {
        const id = 'u' + i;
        if (!cart.stickers[id] && !byId[id]) return id;
    }
    return 'u' + Object.keys(cart.stickers).length + 1000;
}

export function allTags(cart) {
    const set = new Set(TAGS);
    for (const d of Object.values(defsFor(cart))) for (const t of d.tags) set.add(t);
    set.add('solid');
    return [...set];
}

/** Snap a point to where a sticker of this size sits on the grid. */
export function snap(x, y, size) {
    if (size === 2) return { x: clamp(Math.round(x), 1, COLS - 1), y: clamp(Math.round(y), 1, ROWS - 1) };
    return { x: clamp(Math.floor(x) + 0.5, 0.5, COLS - 0.5), y: clamp(Math.floor(y) + 0.5, 0.5, ROWS - 0.5) };
}

// ------------------------------------------------------------------ the starter cartridge

const it = (sid, x, y) => ({ sid, x, y });

export function starterCart() {
    return {
        v: CART_VERSION,
        name: "Dragon's Hoard",
        goal: 'Slay the dragon, take its key, and open the castle!',
        stickers: {},
        scenes: [
            {
                name: 'The Meadow', bg: 'meadow', items: [
                    it('princess', 2.5, 7.5), it('fairy', 3.5, 6.5),
                    it('tree', 1.5, 1.5), it('tree', 4.5, 1.5), it('tree', 8.5, 1.5), it('tree', 14.5, 1.5), it('tree', 20.5, 1.5),
                    it('tree', 1.5, 12.5), it('tree', 6.5, 12.5), it('tree', 12.5, 12.5), it('tree', 22.5, 12.5),
                    it('rock', 9.5, 5.5), it('rock', 10.5, 5.5), it('rock', 13.5, 9.5),
                    it('sign', 5.5, 7.5),
                    it('chest', 8.5, 11.5),
                    it('goblin', 11.5, 7.5), it('goblin', 15.5, 4.5), it('goblin', 17.5, 10.5),
                    it('slime', 8.5, 3.5), it('slime', 13.5, 11.5),
                    it('hut', 19.5, 6.5),
                    it('heart', 6.5, 4.5), it('coin', 7.5, 9.5), it('coin', 12.5, 3.5), it('coin', 16.5, 8.5),
                    it('door_next', 22.5, 7.5),
                ],
            },
            {
                name: "Dragon's Keep", bg: 'cave', items: [
                    it('door_prev', 1.5, 7.5),
                    it('dragon', 15, 5), it('bat', 10.5, 3.5), it('bat', 12.5, 10.5),
                    it('campfire', 6.5, 4.5), it('campfire', 6.5, 10.5), it('campfire', 18.5, 11.5),
                    it('rock', 9.5, 7.5), it('rock', 3.5, 2.5), it('rock', 20.5, 2.5),
                    it('heart', 4.5, 11.5), it('heart', 19.5, 8.5),
                    it('coin', 9.5, 4.5), it('coin', 9.5, 10.5), it('gem', 21.5, 5.5),
                    it('castle', 21, 11),
                ],
            },
        ],
    };
}

/** The console's own room. A cart like any other, run by the same engine. */
export function roomCart(spawn = { x: 12, y: 9.5 }) {
    return {
        v: CART_VERSION,
        name: 'Console',
        goal: '',
        stickers: {},
        scenes: [
            {
                name: 'Workshop', bg: 'workshop', items: [
                    it('shelf', 3, 3), it('table', 9, 3), it('press', 15, 3), it('tv', 21, 3),
                    it('tree', 1.5, 12.5), it('tree', 22.5, 12.5), it('rock', 4.5, 11.5), it('rock', 19.5, 11.5),
                    it('fairy', spawn.x + 1.5, spawn.y - 1),
                    it('tinker', spawn.x, spawn.y),
                ],
            },
        ],
    };
}
