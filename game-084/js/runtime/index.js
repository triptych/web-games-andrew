// The VESTA-8 runtime, assembled. The app, the tests and every exported game run these same parts:
// the app and the tests import them as modules; exportHTML() writes each part's source into one
// standalone HTML file with fn.toString(), so an exported game runs exactly the code that was just
// playtested.

import { font } from './font.js';
import { gfx } from './gfx.js';
import { lang } from './lang.js';
import { sound } from './sound.js';
import { core } from './core.js';
import { host } from './host.js';

export const PARTS = [font, gfx, lang, sound, core];
export const HOST = host;

export function makeVesta() {
    const V = {};
    for (const part of PARTS) part(V);
    return V;
}

export const V = makeVesta();

const escHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// JSON inside a <script> must never contain "</script" or a raw line separator.
const LS = new RegExp('\\u2028', 'g'), PS = new RegExp('\\u2029', 'g');
export const scriptSafeJSON = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');

/** One self-contained HTML file that plays the cart: no network, works from file://. */
export function exportHTML(cart, { version = '' } = {}) {
    const c = V.normalize(cart);
    const parts = PARTS.concat([HOST]).map((fn) => '(' + fn.toString() + ')(V);').join('\n');
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">',
        '<meta name="theme-color" content="#05060c">',
        `<meta name="generator" content="ROMANCER ${escHTML(version)} — VESTA-8">`,
        `<title>${escHTML(c.title)}</title>`,
        '</head>',
        '<body>',
        `<script id="vesta-cart" type="application/json">${scriptSafeJSON(c)}</script>`,
        '<script>',
        '(function () {',
        "'use strict';",
        'var V = {};',
        parts,
        "V.host.boot(JSON.parse(document.getElementById('vesta-cart').textContent));",
        '})();',
        '</script>',
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

/** Read a cart back out of a .vesta.json file or an exported .html file. Returns null if there is none. */
export function importCart(text) {
    if (typeof text !== 'string') return null;
    let json = null;
    const m = text.match(/<script id="vesta-cart" type="application\/json">([\s\S]*?)<\/script>/);
    try {
        json = JSON.parse(m ? m[1] : text);
    } catch { return null; }
    if (json && json.cart && typeof json.cart === 'object') json = json.cart;
    if (!json || typeof json !== 'object' || !Array.isArray(json.sprites)) return null;
    return V.normalize(json);
}
