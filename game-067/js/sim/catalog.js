/**
 * catalog.js — everything that can be placed on an island.
 *
 *   w, d   footprint in tiles before rotation (rotation 1 and 3 swap them)
 *   on     'land' (sand, grass, path, meadow, snow), 'water', or 'any'
 *   small  nature and little props: track laid through them clears them away, and people can walk through
 *   res    people who live here (houses spawn residents who wander the island)
 *
 * The 3D model for each id lives in js/view/models.js; the catalog itself is plain data so the
 * simulation and its tests never touch three.js.
 */

export const CATS = [
    { id: 'homes', name: 'Homes', emoji: '🏠' },
    { id: 'town', name: 'Town', emoji: '🏪' },
    { id: 'rail', name: 'Railway', emoji: '🚉' },
    { id: 'fun', name: 'Fun', emoji: '🎡' },
    { id: 'farm', name: 'Farm', emoji: '🚜' },
    { id: 'nature', name: 'Nature', emoji: '🌳' },
    { id: 'deco', name: 'Decor', emoji: '🪑' },
    { id: 'water', name: 'Water', emoji: '⛵' },
];

const I = (id, name, cat, emoji, o = {}) => ({ id, name, cat, emoji, w: 1, d: 1, on: 'land', small: false, res: 0, ...o });

export const ITEMS = [
    // ---------------------------------------------------------------- homes
    I('house_red', 'Red House', 'homes', '🏠', { res: 2 }),
    I('house_blue', 'Blue House', 'homes', '🏠', { res: 2 }),
    I('house_yellow', 'Yellow House', 'homes', '🏠', { res: 2 }),
    I('house_green', 'Green House', 'homes', '🏠', { res: 2 }),
    I('cottage', 'Thatched Cottage', 'homes', '🛖', { res: 2 }),
    I('townhouse', 'Townhouse', 'homes', '🏘️', { res: 3 }),
    I('flats', 'Little Flats', 'homes', '🏢', { res: 4 }),
    I('beach_hut', 'Beach Hut', 'homes', '🏖️', { res: 1 }),
    I('igloo', 'Igloo', 'homes', '🧊', { res: 1 }),
    I('treehouse', 'Treehouse', 'homes', '🌳', { res: 2 }),
    // ---------------------------------------------------------------- town
    I('bakery', 'Bakery', 'town', '🥐', { res: 1 }),
    I('cafe', 'Café', 'town', '☕', { res: 1 }),
    I('toyshop', 'Toy Shop', 'town', '🧸', { res: 1 }),
    I('icecream', 'Ice Cream Parlour', 'town', '🍦', { res: 1 }),
    I('postoffice', 'Post Office', 'town', '📮', { res: 1 }),
    I('library', 'Library', 'town', '📚', { res: 1 }),
    I('clinic', 'Clinic', 'town', '🩺', { res: 1 }),
    I('firestation', 'Fire Station', 'town', '🚒', { w: 2, res: 2 }),
    I('school', 'School', 'town', '🏫', { w: 2, res: 2 }),
    I('townhall', 'Town Hall', 'town', '🏛️', { w: 2, d: 2, res: 2 }),
    I('market', 'Market Stall', 'town', '🍎'),
    I('clocktower', 'Clock Tower', 'town', '🕰️'),
    I('fountain', 'Fountain', 'town', '⛲'),
    // ---------------------------------------------------------------- railway
    I('engineshed', 'Engine Shed', 'rail', '🏚️', { w: 2 }),
    I('watertower', 'Water Tower', 'rail', '🚰'),
    I('signalbox', 'Signal Box', 'rail', '🚦', { res: 1 }),
    I('signal', 'Signal Post', 'rail', '🚥', { small: true }),
    I('crates', 'Cargo Crates', 'rail', '📦', { small: true }),
    I('barrels', 'Barrels', 'rail', '🛢️', { small: true }),
    // ---------------------------------------------------------------- fun
    I('windmill', 'Windmill', 'fun', '🌀'),
    I('lighthouse', 'Lighthouse', 'fun', '🗼'),
    I('ferris', 'Ferris Wheel', 'fun', '🎡', { w: 2, d: 2 }),
    I('carousel', 'Carousel', 'fun', '🎠', { w: 2, d: 2 }),
    I('castle', 'Castle', 'fun', '🏰', { w: 2, d: 2, res: 2 }),
    I('balloon', 'Hot Air Balloon', 'fun', '🎈'),
    I('playground', 'Playground', 'fun', '🛝'),
    I('bandstand', 'Bandstand', 'fun', '🎺'),
    I('sandcastle', 'Sandcastle', 'fun', '🏰', { small: true }),
    I('snowman', 'Snowman', 'fun', '⛄', { small: true }),
    // ---------------------------------------------------------------- farm
    I('barn', 'Barn', 'farm', '🛖', { w: 2, res: 1 }),
    I('silo', 'Silo', 'farm', '🌾'),
    I('greenhouse', 'Greenhouse', 'farm', '🪴'),
    I('haystack', 'Haystack', 'farm', '🌾', { small: true }),
    I('pumpkins', 'Pumpkin Patch', 'farm', '🎃', { small: true }),
    I('veggies', 'Veggie Garden', 'farm', '🥕', { small: true }),
    I('sheep', 'Sheep', 'farm', '🐑', { small: true }),
    I('cow', 'Cow', 'farm', '🐄', { small: true }),
    I('tractor', 'Tractor', 'farm', '🚜', { small: true }),
    // ---------------------------------------------------------------- nature
    I('tree_round', 'Round Tree', 'nature', '🌳', { small: true }),
    I('tree_pine', 'Pine Tree', 'nature', '🌲', { small: true }),
    I('tree_palm', 'Palm Tree', 'nature', '🌴', { small: true }),
    I('tree_blossom', 'Blossom Tree', 'nature', '🌸', { small: true }),
    I('tree_fruit', 'Apple Tree', 'nature', '🍎', { small: true }),
    I('tree_autumn', 'Autumn Tree', 'nature', '🍂', { small: true }),
    I('tree_snowy', 'Snowy Pine', 'nature', '🎄', { small: true }),
    I('bush', 'Bush', 'nature', '🌿', { small: true }),
    I('flowers', 'Flower Bed', 'nature', '🌷', { small: true }),
    I('sunflowers', 'Sunflowers', 'nature', '🌻', { small: true }),
    I('mushroom', 'Giant Mushroom', 'nature', '🍄', { small: true }),
    I('rock', 'Boulder', 'nature', '🪨', { small: true }),
    // ---------------------------------------------------------------- decor
    I('lamp', 'Lamp Post', 'deco', '💡', { small: true }),
    I('bench', 'Bench', 'deco', '🪑', { small: true }),
    I('fence', 'Fence', 'deco', '🚧', { small: true }),
    I('hedge', 'Hedge', 'deco', '🟩', { small: true }),
    I('picnic', 'Picnic Table', 'deco', '🧺', { small: true }),
    I('mailbox', 'Post Box', 'deco', '📫', { small: true }),
    I('statue', 'Statue', 'deco', '🗽', { small: true }),
    I('flag', 'Flag Pole', 'deco', '🚩', { small: true }),
    I('umbrella', 'Beach Umbrella', 'deco', '⛱️', { small: true }),
    I('tent', 'Tent', 'deco', '⛺', { small: true }),
    // ---------------------------------------------------------------- water
    I('sailboat', 'Sailboat', 'water', '⛵', { on: 'water', small: true }),
    I('rowboat', 'Rowing Boat', 'water', '🚣', { on: 'water', small: true }),
    I('ducks', 'Duck Family', 'water', '🦆', { on: 'water', small: true }),
    I('lilypads', 'Lily Pads', 'water', '🪷', { on: 'water', small: true }),
    I('buoy', 'Buoy', 'water', '🛟', { on: 'water', small: true }),
    I('pier', 'Pier', 'water', '🪵', { on: 'water', small: true }),
    I('whale', 'Friendly Whale', 'water', '🐳', { on: 'water', small: true }),
];

export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/** Footprint size after rotation. */
export function footprint(it, rot) {
    return rot & 1 ? [it.d, it.w] : [it.w, it.d];
}
