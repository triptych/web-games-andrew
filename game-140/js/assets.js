// The generated art and audio: what exists and where it lives, plus a small image cache. Every backdrop, CG,
// portrait, track and effect a script names must be listed here; dev/simtest.mjs checks that, and that each file
// is on disk. Prompts are in dev/art/prompts.mjs and dev/audio/.

import { portrait } from './sim/data/cast.js';

export const BGS = ['ravenmoor', 'library', 'stair', 'road', 'hollowmere', 'edda-house', 'chapel', 'nave', 'cinderhold', 'forge',
    'greatforge', 'merrowgate', 'tavern', 'ship', 'lighthouse', 'eldwood', 'heartwood', 'aurelfield', 'abbey', 'crypt', 'starfall',
    'observatory', 'sanctum', 'nave-colour', 'sanctum-colour', 'camp', 'map'];

export const CGS = ['book', 'geas', 'lanterns', 'ward-rose', 'bloom-rose', 'hierarch', 'caius-forge', 'ward-forge', 'bloom-forge',
    'storm', 'ward-tide', 'bloom-tide', 'ione-stone', 'ward-wood', 'bloom-wood', 'caius-gold', 'ward-sun', 'bloom-sun', 'confession',
    'bridge', 'aldwin-fall', 'ward-star', 'bloom-star', 'odrane-throne', 'ward-dream', 'codex-burns', 'finale', 'odrane-dream',
    'festival', 'edda-sees', 'aldwin-statue', 'kestrel-mother', 'ione-tree', 'caius-paints', 'last-page'];

export const PORS = ['codex', 'edda', 'edda-happy', 'aldwin', 'aldwin-sad', 'kestrel', 'kestrel-happy', 'ione', 'caius', 'caius-soft',
    'odrane', 'tilly', 'knight'];

/** Portraits drawn with additive light (the Codex is a ghost painted on black). */
export const GHOSTS = new Set(['codex']);

export const MUSIC = ['title', 'ravenmoor', 'grey', 'order', 'tension', 'ward', 'bloom', 'camp', 'sorrow', 'wood', 'sea', 'finale', 'glory', 'epilogue'];
export const SFX = ['page', 'click', 'door', 'magic', 'geas', 'bells', 'ward', 'anvil', 'clash', 'storm', 'axe', 'fire', 'thunder', 'turn', 'lock'];

export const ART = {
    bg: (id) => `art/bg/${id}.webp`,
    cg: (id) => `art/cg/${id}.webp`,
    por: (id) => `art/por/${id}.webp`,
    title: 'art/title.webp',
};

export const portraitKey = (id, expr) => portrait(id, expr);

const cache = new Map();
/** A cached Image for a url (starts loading on first ask). */
export function img(src) {
    let im = cache.get(src);
    if (!im) {
        im = new Image();
        im.decoding = 'async';
        im.src = src;
        cache.set(src, im);
    }
    return im;
}
export function preload(urls) { for (const u of urls) img(u); }
