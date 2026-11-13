// The painted art (fal renders, cut and sized by dev/art/export.py). Loaded in the background; until a
// picture arrives, or if it never does, the view draws the code-made cartoon in its place.

export const BASE = new URL('../../art/', import.meta.url).href;

// Where each backdrop's flat ground strip starts, as a share of its height (from art/manifest.json;
// the desert's was measured by eye: the detector caught a line inside the sand).
export const BACKDROPS = {
    farm: 0.87, night: 0.795, corn: 0.84, town: 0.87, base: 0.83, desert: 0.875, finale: 0.845,
};
export const SPRITES = ['cow', 'chicken', 'pig', 'sheep', 'golden', 'farmer', 'townie', 'gunner', 'agent', 'tinfoil',
    'tank', 'laser', 'boss', 'jet', 'ufo', 'ufo-crash', 'mothership'];
export const ICONS = ['wrench', 'tape', 'turbo', 'mega', 'shield', 'clock', 'star'];
export const PORTRAITS = { '-1': 'mother--1', 0: 'mother-0', 1: 'mother-1' };

const cache = new Map();
let failed = 0;

function load(path) {
    if (cache.has(path)) return cache.get(path);
    const img = new Image();
    img.decoding = 'async';
    const rec = { img, ok: false };
    img.onload = () => { rec.ok = true; };
    img.onerror = () => { failed++; };
    img.src = BASE + path;
    cache.set(path, rec);
    return rec;
}

/** A loaded picture, or null while it is still on its way (or missing). */
export function pic(path) {
    const r = load(path);
    return r.ok ? r.img : null;
}
export const sprite = (name) => pic(`spr/${name}.webp`);
export const icon = (name) => pic(`icons/${name}.webp`);
export const backdrop = (theme) => pic(`bg/${theme}.webp`);
export const portrait = (mood) => pic(`por/${PORTRAITS[mood < 0 ? -1 : mood > 0 ? 1 : 0]}.webp`);

/** Start every download now, so the first frames of an episode have their pictures. */
export function preload() {
    for (const s of SPRITES) load(`spr/${s}.webp`);
    for (const i of ICONS) load(`icons/${i}.webp`);
    for (const b of Object.keys(BACKDROPS)) load(`bg/${b}.webp`);
    for (const p of Object.values(PORTRAITS)) load(`por/${p}.webp`);
}

/** For the tests: how many pictures are in, and how many failed. */
export function status() {
    let ok = 0;
    for (const r of cache.values()) if (r.ok) ok++;
    return { total: cache.size, ok, failed };
}
