// Every picture the game draws (art/, painted with fal; see dev/art/README.md). dev/simtest.mjs checks that each
// id here has its file and that every id the data uses is listed.

export const ART = {
    bg: ['thornhaven', 'forge', 'inn', 'thornwood', 'academy', 'grove', 'chapel', 'ruins', 'sanctum'],
    cg: ['prologue', 'korvas', 'seal', 'end-remember', 'end-release'],
    por: ['lyra', 'lyra-happy', 'lyra-sad', 'lyra-fierce', 'orin', 'orin-angry', 'sera', 'sera-smile', 'thane', 'thane-sad',
        'varec', 'varec-worried', 'holt', 'borin', 'marta', 'aldric', 'sylvara', 'sylvara-sad', 'aneth', 'korvas', 'vaelthas'],
    chibi: ['lyra', 'orin', 'sera', 'thane', 'varec', 'holt', 'borin', 'marta', 'aldric', 'sylvara', 'aneth'],
    enemy: ['slime', 'forest_wolf', 'bandit', 'golem', 'lich_shard', 'academy_wisp', 'corrupted_knight'],
    prop: ['elder_house', 'farmhouse', 'inn_house', 'forge_house', 'world_tree', 'seal_gate',
        'tree_oak', 'tree_pine', 'tree_dead', 'tree_glow', 'bush', 'rock', 'flowers', 'mushrooms', 'stump',
        'pillar', 'statue', 'lectern', 'altar', 'crystal', 'anchor', 'rubble', 'brazier', 'bookshelf',
        'anvil', 'barrel', 'crates', 'table', 'chest', 'counter', 'hearth', 'furnace', 'weapon_rack'],
    item: ['potion', 'hi_potion', 'ether', 'antidote', 'phoenix_down', 'iron_dagger', 'mage_staff', 'longbow', 'runic_blade', 'warlock_tome',
        'leather_vest', 'chain_mail', 'mage_robe', 'slime_core', 'wolf_pelt', 'fang', 'stone_heart', 'soul_gem', 'lich_crown', 'elder_scroll'],
    tex: ['grass', 'forest', 'cobble', 'dirt', 'planks', 'ruins', 'water', 'wall'],
};

// Items with no painting of their own borrow one
const ITEM_ART = { steel_sword: 'runic_blade' };

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
