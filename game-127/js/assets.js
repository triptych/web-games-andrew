// The generated art: what exists, where it lives, and a small image cache. Every background, CG and vignette a
// script or activity names must be listed here; the sim test checks that, and that each file is on disk.

export const BGS = ['study', 'garden', 'throne', 'market', 'yard', 'spire', 'library', 'ballroom', 'court', 'temple', 'theater',
    'guild', 'rooftops', 'peaks', 'farm', 'tavern', 'smithy', 'harbor', 'city', 'forest', 'seaside', 'varre', 'ruins', 'hills',
    'wastes', 'shadowmere', 'festival', 'rookery'];

export const CGS = [
    'prologue-war', 'prologue-egg', 'prologue-oath', 'meet-market', 'horns', 'first-flame', 'petition', 'wings', 'dream-ysolde',
    'assassin', 'ashkar', 'heartstone', 'king', 'border', 'duke',
    'isolde-h3', 'isolde-h4', 'rowan-h3', 'rowan-h4', 'pip-h3', 'pip-h4', 'theo-h3', 'theo-h4', 'saffi-h3', 'saffi-h4', 'lumi-h3', 'lumi-h4',
    'starfall-isolde', 'starfall-rowan', 'starfall-pip', 'starfall-theo', 'starfall-saffi', 'starfall-lumi',
    'fest-tourney', 'fest-arts', 'fest-ball', 'fest-arcane', 'fest-debate',
    'end-king', 'end-crown', 'end-archmage', 'end-diplomat', 'end-warrior', 'end-merchant', 'end-entertainer', 'end-overlord',
    'end-assassin', 'end-priest', 'end-scholar', 'end-dragonlord', 'end-adventurer', 'end-ranger', 'end-smith', 'end-exile',
    'end-runaway', 'end-quiet',
    'epi-isolde', 'epi-rowan', 'epi-pip', 'epi-theo', 'epi-saffi', 'epi-lumi',
    'wed-isolde', 'wed-rowan', 'wed-pip', 'wed-theo', 'wed-saffi', 'wed-lumi',
];

// Expedition creatures: one cutout per danger in each region (steps 0-4) and its master.
export const FOE_REGIONS = ['whisperwood', 'ruins', 'hills', 'wastes', 'peaks', 'shadowmere'];
export const FOES = FOE_REGIONS.flatMap((r) => ['0', '1', '2', '3', '4', 'boss'].map((k) => `${r}-${k}`));

export const ART = {
    bg: (id) => `art/bg/${id}.webp`,
    cg: (id) => `art/cg/${id}.webp`,
    act: (id) => `art/act/${id}.webp`,
    por: (id) => `art/por/${id}.webp`,
    foe: (id) => `art/foe/${id}.webp`,
    title: 'art/title.webp',
};

const cache = new Map();
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
