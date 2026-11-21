// Every picture the game draws (art/, painted with fal; see dev/art/README.md). dev/simtest.mjs checks that each
// id here has its file and that every id the data uses is listed.

export const ART = {
    bg: ['lane', 'wilds', 'gully', 'lair'],
    cg: ['title', 'ending'],
    por: ['wick', 'trina', 'trina-excited', 'mabel', 'pilcrow', 'bertram', 'bertha'],
    chibi: ['wick', 'trina', 'mabel', 'pilcrow', 'bertram'],
    enemy: ['cogsprite', 'rustcrab', 'bandit', 'gearwolf', 'bigbertha'],
    prop: ['workshop', 'bakery', 'hall', 'stall', 'lair_gate', 'kettle',
        'tree_oak', 'tree_pine', 'tree_dead', 'bush', 'rock', 'flowers', 'mushrooms', 'stump', 'fern',
        'barrel', 'crates', 'signpost', 'lamp', 'well', 'scrap_heap', 'pipes', 'gear_big', 'chest'],
    item: ['tea', 'scone', 'oilcan', 'tonic', 'smoke', 'wakeup', 'wrench', 'spanner', 'sparkrod', 'rollingpin', 'skillet',
        'apron', 'brassvest', 'goggles', 'charm', 'cog', 'spring', 'scrap', 'kettle', 'lairkey', 'goldgear'],
    tex: ['grass', 'meadow', 'cobble', 'dirt', 'planks', 'mud', 'plate', 'water', 'wall'],
};

// Items with no painting of their own borrow one
const ITEM_ART = {};

export const artUrl = (kind, id) => `art/${kind}/${id}.webp`;
export const itemUrl = (id) => artUrl('item', ITEM_ART[id] || id);
export const IMG = {};

/** The portrait for a speaker in a mood (falls back to the plain one). */
export function porUrl(who, mood) {
    if (mood && ART.por.includes(`${who}-${mood}`)) return artUrl('por', `${who}-${mood}`);
    return ART.por.includes(who) ? artUrl('por', who) : null;
}

/** Load every image; resolves when all have loaded or failed (a missing file just isn't drawn). */
export function loadArt(onProgress) {
    const list = [];
    for (const [kind, ids] of Object.entries(ART)) for (const id of ids) list.push([kind, id]);
    let done = 0;
    return Promise.all(list.map(([kind, id]) => new Promise((resolve) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => { IMG[`${kind}/${id}`] = im; onProgress?.(++done / list.length); resolve(); };
        im.onerror = () => { onProgress?.(++done / list.length); resolve(); };
        im.src = artUrl(kind, id);
    })));
}

export const img = (kind, id) => IMG[`${kind}/${id}`] || null;
