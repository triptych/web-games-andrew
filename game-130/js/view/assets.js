// Starbase Spooky — the pictures (fal, exported by dev/art/export.py). Loaded once; anything that fails to load is
// simply not drawn, and the game still plays.

import { ROOMS } from '../sim/data/rooms.js';
import { CAST } from '../sim/data/cast.js';

export const ART = { bg: {}, spr: {}, icons: {} };
let pending = 0;

function load(path) {
    const img = new Image();
    pending++;
    img.onload = img.onerror = () => { pending--; };
    img.src = 'art/' + path;
    return img;
}

export function loadArt() {
    for (const id of [...Object.keys(ROOMS), 'station']) ART.bg[id] = load(`bg/${id}.webp`);
    for (const id of Object.keys(CAST)) ART.spr[id] = load(`spr/${id}.webp`);
    ART.icons.items = load('icons/items.webp');
    ART.icons.planets = load('icons/planets.webp');
}

export const artPending = () => pending;
export const ready = (img) => img && img.complete && img.naturalWidth > 0;

/** Icon cells: items are a 4x4 atlas of 40 px, planets a 3x3 atlas of 56 px (sun first). */
export const ICON = { items: { size: 40, cols: 4 }, planets: { size: 56, cols: 3 } };
export const PLANET_CELL = { sun: 0, mercury: 1, venus: 2, earth: 3, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptune: 8 };

export function drawIcon(ctx, sheet, i, x, y, size) {
    const img = ART.icons[sheet];
    if (!ready(img)) return;
    const { size: s, cols } = ICON[sheet];
    ctx.drawImage(img, (i % cols) * s, Math.floor(i / cols) * s, s, s, x, y, size, size);
}

/** CSS for a DOM element showing one icon (the Notebook): background-position into the atlas at a scale. */
export function iconStyle(sheet, i, px = 48) {
    const { size: s, cols } = ICON[sheet];
    const k = px / s;
    const rows = sheet === 'items' ? 4 : 3;
    return `background-image:url(art/icons/${sheet}.webp);background-size:${cols * s * k}px ${rows * s * k}px;background-position:-${(i % cols) * s * k}px -${Math.floor(i / cols) * s * k}px`;
}
