// Helpers for building and inspecting cartridges in code. Pure.

import { V } from '../runtime/index.js';

/** 8 rows of 8 characters → one sprite string. '.' or ' ' is colour 0; 0-9 a-f are palette indices. */
export function art(rows) {
    if (typeof rows === 'string') rows = rows.trim().split(/\s+/);
    let s = '';
    for (let y = 0; y < 8; y++) {
        const r = rows[y] || '';
        for (let x = 0; x < 8; x++) {
            const ch = (r[x] || '.').toLowerCase();
            s += /[0-9a-f]/.test(ch) ? ch : '0';
        }
    }
    return s;
}

/** A cart from parts: sprites { n: rows }, flags { n: ['solid', …] }, the rest as in V.normalize. */
export function makeCart(spec) {
    const sprites = [], flags = [];
    for (let i = 0; i < 64; i++) { sprites.push('0'.repeat(64)); flags.push(0); }
    for (const k in spec.sprites || {}) sprites[+k] = art(spec.sprites[k]);
    for (const k in spec.flags || {}) {
        let f = 0;
        for (const name of spec.flags[k]) f |= V.FLAG[name];
        flags[+k] = f;
    }
    const types = (spec.types || []).map((t) => ({ ...V.defaultType(t.name), ...t, script: dedent(t.script || '') }));
    return V.normalize({ ...spec, sprites, flags, types, script: dedent(spec.script || '') });
}

/** Strip the common indent from a template-literal script. */
export function dedent(s) {
    const lines = s.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join('\n') + '\n';
}

export const clone = (c) => JSON.parse(JSON.stringify(c));
export const typeOf = (cart, name) => cart.types.find((t) => t.name === name);
export const litPixels = (cart, n) => [...(cart.sprites[n] || '')].filter((c) => c !== '0').length;
export const countTiles = (cart, li, ids) => {
    const L = cart.levels[li];
    if (!L) return 0;
    const want = new Set([].concat(ids).map((i) => V.TILECH[i]));
    let n = 0;
    for (const ch of L.tiles) if (want.has(ch)) n++;
    return n;
};
export const hasFlag = (cart, n, name) => (cart.flags[n] & V.FLAG[name]) !== 0;
/** Does a script compile, and does it have this event handler? */
export function hasHandler(src, ev) {
    const c = V.compile(src || '');
    return !c.error && !!c.handlers[ev];
}
/** Script text without comments, for "does it call spawn("bullet"…)" style checks. */
export const code = (src) => String(src || '').replace(/(--|\/\/).*$/gm, '');
export const usedSprites = (cart) => cart.sprites.filter((s) => /[1-9a-f]/.test(s)).length;
export const paintedTiles = (cart) => cart.levels.reduce((n, L) => n + [...L.tiles].filter((c) => c !== '.').length, 0);

/** Replace every tile id `from` with `to` in a level. */
export function replaceTiles(cart, li, from, to) {
    const L = cart.levels[li];
    L.tiles = [...L.tiles].map((ch) => (ch === V.TILECH[from] ? V.TILECH[to] : ch)).join('');
}
