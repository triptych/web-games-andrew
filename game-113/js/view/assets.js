// Generated art. `assets/manifest.json` maps a key to a PNG and the logical size (in sprite "pixels") the game scales it by:
//
//   "monster/shardcrab":        { src: "monsters/shardcrab.png",  w: 32, h: 32 }
//   "portrait/lyra":            { src: "portraits/lyra.png",      w: 64, h: 80 }
//   "person/lyra/down/0":       { src: "people/lyra/down-0.png",  w: 24, h: 32 }
//
// Everything here is optional. loadAssets() never throws: a missing manifest, a missing file or a slow network just
// leaves the key out, and every caller falls back to the sprite painted in code (pixel.js, people.js, monsters.js, tiles.js).

const found = new Map();           // key -> { canvas, w, h }

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
            found.set(key, { canvas: c, w: e.w ?? im.naturalWidth, h: e.h ?? im.naturalHeight, cols: e.cols || 1, rows: e.rows || 1 });
        }));
    })();
    await Promise.race([work, timeout(limitMs)]);
    return found.size;
}

export const hasAsset = (key) => found.has(key);
export const assetCount = () => found.size;

/** The raw canvas of an asset, or null. */
export const assetCanvas = (key) => found.get(key)?.canvas || null;

function flipped(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    return c;
}

/**
 * An asset dressed like a pixel-painter result: `{ w, h, toCanvas(), flipX() }`, so SpriteLib treats painted and generated
 * sprites the same. `smooth` tells SpriteLib to filter it linearly instead of as hard pixels. Returns null when absent.
 */
export function assetPx(key, flip = false) {
    const a = found.get(key);
    if (!a) return null;
    let f = flip;
    return { w: a.w, h: a.h, smooth: true, toCanvas: () => (f ? flipped(a.canvas) : a.canvas), flipX() { f = !f; return this; } };
}

const cells = new Map();

/**
 * One cell of a sheet asset (cols x rows of equal cells, e.g. a person's 3 views x 3 walk frames), dressed like assetPx's
 * result. Options, all optional: flip (mirror), dim 0..1 (darken towards black, for an unlit O.T.T.O.), lie (turn the sprite
 * on its back, a knocked-out figure with no pose of its own), tilt (radians, a flinch). Returns null when the sheet is absent.
 */
export function assetCell(key, col, row, { flip = false, dim = 0, lie = false, tilt = 0 } = {}) {
    const a = found.get(key);
    if (!a) return null;
    const ck = `${key}|${col}|${row}|${flip ? 1 : 0}|${dim}|${lie ? 1 : 0}|${tilt}`;
    let c = cells.get(ck);
    if (!c) {
        const cw = Math.floor(a.canvas.width / a.cols), ch = Math.floor(a.canvas.height / a.rows);
        c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.save();
        if (lie) { x.translate(cw / 2, ch); x.rotate(Math.PI / 2 * (flip ? -1 : 1)); x.scale(0.78, 0.78); x.translate(-cw / 2, -ch * 0.62); }
        else if (tilt) { x.translate(cw / 2, ch); x.rotate(tilt * (flip ? -1 : 1)); x.translate(-cw / 2, -ch); }
        if (flip && !lie) { x.translate(cw, 0); x.scale(-1, 1); }
        x.drawImage(a.canvas, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
        x.restore();
        if (dim > 0) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(6,4,14,${dim})`; x.fillRect(0, 0, cw, ch); }
        cells.set(ck, c);
    }
    return { w: a.w, h: a.h, smooth: true, toCanvas: () => c, flipX() { return this; } };
}
