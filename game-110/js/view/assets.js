// Generated art. `assets/manifest.json` maps a key to a PNG (a single picture or a row of cells) and the logical size, in
// sprite "pixels", the game scales one picture by (the size of the sprite painted in code that it replaces):
//
//   "minion/imp":      { src: "minions/imp.png",      w: 22, h: 26 }
//   "overlord/cook":   { src: "overlord/cook.png",    w: 58, h: 46, cols: 3 }      idle, craft, cackle
//   "station/sew":     { src: "stations/sew.png",     w: 48, h: 48, cols: 4 }      one cell a tier
//   "pet/bat":         { src: "pets/bat.png",         w: 30, h: 26, cols: 5, map: { happy: 3 } }   idle, happy, sad, blink, flap
//   "tex/brick":       { src: "tiles/brick.png",      w: 256, h: 256, rep: 0.32 }  greyscale, coloured per lair
//
// Everything here is optional. loadAssets() never throws: a missing manifest, a missing file or a slow network just leaves
// the key out, and every caller falls back to the sprite painted in code (art.js, tex.js).

import { mix, hex } from './pixel.js';

const found = new Map();           // key -> { canvas, w, h, cols, rows, map, geom, rep }
const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

function loadImage(url) {
    return new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = url;
    });
}

/** Fetch the manifest and decode every image into a canvas. Resolves (never rejects) after at most `limitMs`. */
export async function loadAssets(base = 'assets/', limitMs = 12000) {
    const work = (async () => {
        let man;
        try {
            const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
            if (!r.ok) return;
            man = await r.json();
        } catch { return; }
        await Promise.all(Object.entries(man).map(async ([key, e]) => {
            const im = await loadImage(base + e.src);
            if (!im || !im.naturalWidth) return;
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
            c.getContext('2d').drawImage(im, 0, 0);
            found.set(key, { canvas: c, w: e.w ?? im.naturalWidth, h: e.h ?? im.naturalHeight, cols: e.cols || 1, rows: e.rows || 1, map: e.map || null, geom: e.geom || null, xpad: e.xpad || 0, rep: e.rep || 1 });
        }));
    })();
    await Promise.race([work, timeout(limitMs)]);
    return found.size;
}

export const hasAsset = (key) => found.has(key);
export const assetCount = () => found.size;
/** The raw canvas of an asset, or null. */
export const assetCanvas = (key) => found.get(key)?.canvas || null;

const cache = new Map();

/** The coverage of a canvas at the sprite's logical size (RGBA, only alpha matters): what hit tests and floor padding read. */
function logicalData(canvas, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(canvas, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
}

/** A pixel-painter lookalike for a picture: `{ w, h, d, smooth, toCanvas(), flipX() }`, so SpriteLib treats painted and generated art alike. */
function dress(canvas, w, h) {
    const px = { w, h, smooth: true, d: logicalData(canvas, w, Math.round(h)), toCanvas: () => px.c, flipX() { px.c = flip(px.c); return px; }, c: canvas };
    px.h = Math.round(h);
    return px;
}
function flip(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    return c;
}

function cellCanvas(a, col, row) {
    const cw = Math.floor(a.canvas.width / a.cols), ch = Math.floor(a.canvas.height / a.rows);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(a.canvas, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
    return c;
}

/** One picture (or one cell of a row of them), dressed as a painted sprite. Null when the asset is absent. */
export function assetPx(key, col = 0, row = 0) {
    const a = found.get(key);
    if (!a) return null;
    const ck = `${key}|${col}|${row}`;
    let px = cache.get(ck);
    if (!px) { px = dress(a.cols * a.rows > 1 ? cellCanvas(a, col, row) : a.canvas, a.w, a.h); cache.set(ck, px); }
    return { ...px, flipX() { return { ...px, c: flip(px.c), toCanvas: function () { return this.c; } }; } };
}

// ---------------------------------------------------------------------------------------------------- pets
const PET_COL = { idle: 0, happy: 1, sad: 2, blink: 3 };
// where an accessory sits on a pet, from the pet's head [x, top] and neck [x, y, width] in the pet's own sprite pixels
const ACC_AT = {
    bow: (g) => [g.head[0] + 4.5, g.head[1] + 2.5],
    bell: (g) => [g.neck[0], g.neck[1] + 2.5],
    hat: (g) => [g.head[0], g.head[1] - 2.2],
    scarf: (g) => [g.neck[0], g.neck[1] + 1.2],
    crown: (g) => [g.head[0], g.head[1] - 0.8],
};

/**
 * A pet in a mood, with its accessory: the cell for the mood from the pet's sheet, the accessory picture drawn over it.
 * `fallback` is the pet's head and neck from the painted version, used when the asset has no geometry of its own.
 */
export function petAssetPx(id, { mood = 'idle', acc = null, frame = 0 } = {}, fallback) {
    const a = found.get('pet/' + id);
    if (!a) return null;
    let i = PET_COL[mood] ?? 0;
    if (frame === 1 && a.cols >= 5 && (id === 'bat' || mood === 'idle')) i = 4;
    const names = ['idle', 'happy', 'sad', 'blink', 'alt'];
    if (a.map && a.map[names[i]] !== undefined) i = a.map[names[i]];
    i = Math.min(i, a.cols - 1);
    const ck = `pet|${id}|${i}|${acc || ''}`;
    let px = cache.get(ck);
    if (px) return px;
    let c = cellCanvas(a, i, 0);
    const ac = acc && found.get('acc/' + acc);
    if (ac) {
        const g = a.geom || fallback, k = c.width / a.w;
        const [cx0, cy] = ACC_AT[acc](g), cx = cx0 + a.xpad;      // xpad: the extra width of a cell wider than the painted pet's
        const w = ac.w * k, h = ac.canvas.height * (w / ac.canvas.width);
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        const bottomAnchored = acc === 'hat' || acc === 'crown';
        x.drawImage(ac.canvas, cx * k - w / 2, bottomAnchored ? cy * k + 0 - h + h * 0.3 : cy * k - h / 2, w, h);
    }
    px = dress(c, a.w, a.h);
    cache.set(ck, px);
    return px;
}

// ---------------------------------------------------------------------------------------------------- textures
/**
 * A greyscale swatch coloured for a lair: dark -> `lo`, middle -> `mid`, light -> `hi`. `{ toCanvas(), smooth, rep }`, where
 * `rep` says how much to scale the painted texture's repeat count by. Null when the swatch is absent.
 */
export function gradientTex(name, lo, mid, hi) {
    const a = found.get('tex/' + name);
    if (!a) return null;
    const ck = `tex|${name}|${[lo, mid, hi].map((c) => hex(c).join(',')).join('|')}`;
    let px = cache.get(ck);
    if (px) return px;
    const L = hex(lo), M = hex(mid), H = hex(hi);
    const c = document.createElement('canvas'); c.width = a.canvas.width; c.height = a.canvas.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(a.canvas, 0, 0);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    const ramp = new Array(256);
    for (let v = 0; v < 256; v++) ramp[v] = v < 128 ? mix(L, M, v / 127) : mix(M, H, (v - 128) / 127);
    for (let i = 0; i < d.length; i += 4) { const r = ramp[d[i]]; d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; }
    x.putImageData(im, 0, 0);
    px = { w: c.width, h: c.height, smooth: true, rep: a.rep, toCanvas: () => c };
    cache.set(ck, px);
    return px;
}
