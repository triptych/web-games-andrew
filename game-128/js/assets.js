// Gemheart Saga — the generated art: paths, an image cache, and atlas cells for the DOM.

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
export const ready = (im) => !!im && im.complete && im.naturalWidth > 0;

export const ART = {
    bg: (id) => `art/bg/${id}.webp`,
    mon: (id) => `art/mon/${id}.webp`,
    hero: (id) => `art/hero/${id}.webp`,
    por: (id) => `art/por/${id}.webp`,
    icons: (sheet) => `art/icons/${sheet}.webp`,
    skills: (hero) => `art/skills/${hero}.webp`,
    buildings: 'art/buildings.webp',
};

/** Put a cell of a cols x rows atlas on an element as its background. */
export function setCell(el, url, i, cols = 4, rows = cols) {
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
    el.style.backgroundPosition = `${cols > 1 ? ((i % cols) / (cols - 1)) * 100 : 0}% ${rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 100 : 0}%`;
    return el;
}

/** An icon element for [sheet, cell]. */
export function iconEl(icon, cls = '') {
    const i = document.createElement('i');
    i.className = 'ico ' + cls;
    if (icon) setCell(i, ART.icons(icon[0]), icon[1]);
    return i;
}

// Fixed icon cells used around the UI.
export const ICON = {
    gold: ['misc', 0], wood: ['misc', 1], ore: ['misc', 2], grain: ['misc', 3], crystal: ['misc', 4],
    chest: ['misc', 10], scroll: ['misc', 11], shield: ['misc', 12], trophy: ['misc', 13], lantern: ['misc', 14], map: ['misc', 15],
    poison: ['misc', 8], wolf: ['misc', 9],
    book: ['goods', 12], xp: ['goods', 13], heart: ['goods', 14], sword: ['goods', 15],
    // board pieces (gems atlas): 0 sword 1 heart 2 ruby 3 sapphire 4 amethyst 5 prism 6 stone 7 doom 8 chain 9 frost 10 bubble 11 flame
    // 12 crossed swords 13 bolt 14 sparkle 15 skull; the emerald lives in the misc atlas (cell 5)
};
// gem kind -> [sheet, cell]
export const GEM_ICON = [['gems', 0], ['gems', 1], ['gems', 2], ['gems', 3], ['misc', 5], ['gems', 4], ['gems', 6], ['gems', 7], ['gems', 5]];

export function preload(urls) { for (const u of urls) img(u); }
