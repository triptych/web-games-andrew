// EMBERSPIRE — the generated art: paths, a small image cache, and icon atlas cells for the DOM.

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
export const ready = (im) => im && im.complete && im.naturalWidth > 0;

export const ART = {
    bg: (id) => `art/bg/${id}.webp`,
    mon: (id) => `art/mon/${id}.webp`,
    hero: (id, evo) => `art/hero/${id}${evo ? '-evo' : ''}.webp`,
    por: (id) => `art/por/${id}.webp`,
    icons: (sheet) => `art/icons/${sheet}.webp`,
};

/** Put atlas cell [sheet, index] on an element as its background (4x4 atlases). */
export function setIcon(el, icon) {
    if (!icon) { el.style.backgroundImage = ''; return el; }
    const [sheet, i] = icon;
    el.style.backgroundImage = `url(${ART.icons(sheet)})`;
    el.style.backgroundPosition = `${(i % 4) * 33.3333}% ${Math.floor(i / 4) * 33.3333}%`;
    return el;
}

export function iconEl(icon, cls = '') {
    const i = document.createElement('i');
    i.className = 'ico ' + cls;
    return setIcon(i, icon);
}

/** Warm the cache for a list of urls (title screen, town). */
export function preload(urls) { for (const u of urls) img(u); }
