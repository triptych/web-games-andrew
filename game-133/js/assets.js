// The painted art: where each picture lives, and a small image cache. Everything was generated with fal
// (see dev/art/README.md). The sim test checks every backdrop and picture a script names has a file here.

import { CAST } from './sim/data/cast.js';
import { ROSTER_BY_ID } from './sim/data/adventurers.js';

export const EXPRS = ['neutral', 'happy', 'sad', 'angry'];
// story pictures that exist as files (the ending pictures are 'end-<id>')
export const CG_FILES = new Set(/*CGS*/['lantern', 'dragon', 'deep', 'relit', 'end-disgrace', 'end-ruin', 'end-foreclosed', 'end-emissary', 'end-road', 'end-hearth', 'end-puppet', 'end-gilded', 'end-golden', 'end-academy', 'end-wild', 'end-crown', 'end-folk', 'end-keeper', 'end-steady', 'end-quiet']/*CGS*/);

export const ART = {
    bg: (id) => `art/bg/${id}.webp`,
    cg: (id) => `art/cg/${id}.webp`,
    por: (id, expr = 'neutral') => `art/por/${id}-${EXPRS.includes(expr) ? expr : 'neutral'}.webp`,
    giver: (type, face) => `art/giv/${type}-${face % 6}.webp`,      // six painted faces per kind of petitioner
    title: 'art/title.webp',
};

/** A round face for a list: a cast member's portrait, or a roster adventurer's bust. */
export function faceOf(id) {
    if (CAST[id]) return { src: ART.por(id), zoom: CAST[id].look?.kind === 'brownie' ? 120 : 210 };
    const a = ROSTER_BY_ID[id];
    if (a?.face) return faceOf(a.face);
    return { src: `art/por/adv-${id}.webp`, zoom: 125 };
}
export function faceStyle(id) {
    const f = faceOf(id);
    return `background-image:url('${f.src}');background-size:${f.zoom}%;background-position:50% ${f.zoom > 150 ? 4 : 10}%`;
}

const cache = new Map();
export function img(src) {
    let im = cache.get(src);
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = src; cache.set(src, im); }
    return im;
}
export function preload(urls) { for (const u of urls) img(u); }
