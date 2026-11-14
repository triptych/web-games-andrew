// What can be pinched out of clay. Pure data: the sim, the bot, the view and the bench all read it.
//
// layer   floor: stands on floor tiles and blocks walking
//         rug:   lies on the floor under furniture; rugs don't overlap each other
//         small: 1×1, on the floor or on top of a surface (a table, a shelf, a mantel)
//         wall:  hangs on one of the two back walls, in wall cells (u along the wall, v up it)
// fp      footprint per size [w, d] in tiles (wall: [w, h] in wall cells)
// cost    clay lumps per size
// h       height in tiles per size; for a surface it is where small things stand
// tags    what goals and the cosy score look for

export const PALETTE = [
    { id: 'tomato', name: 'Tomato', hex: 0xe8553f, fam: 'warm' },
    { id: 'tangerine', name: 'Tangerine', hex: 0xf28a3a, fam: 'warm' },
    { id: 'butter', name: 'Butter', hex: 0xf6cf57, fam: 'warm' },
    { id: 'blush', name: 'Blush', hex: 0xf3a1a8, fam: 'warm' },
    { id: 'mint', name: 'Mint', hex: 0x8fd6b0, fam: 'green' },
    { id: 'sage', name: 'Sage', hex: 0x8aa66f, fam: 'green' },
    { id: 'moss', name: 'Moss', hex: 0x4f8a4a, fam: 'green' },
    { id: 'teal', name: 'Teal', hex: 0x2e9c9a, fam: 'cool' },
    { id: 'sky', name: 'Sky', hex: 0x86c5ee, fam: 'cool' },
    { id: 'cornflower', name: 'Cornflower', hex: 0x5a7fd6, fam: 'cool' },
    { id: 'lilac', name: 'Lilac', hex: 0xb79be0, fam: 'cool' },
    { id: 'plum', name: 'Plum', hex: 0x7d4a86, fam: 'cool' },
    { id: 'cream', name: 'Cream', hex: 0xf3e6cc, fam: 'neutral' },
    { id: 'oat', name: 'Oat', hex: 0xcdb18b, fam: 'neutral' },
    { id: 'cocoa', name: 'Cocoa', hex: 0x8a5a3c, fam: 'neutral' },
    { id: 'charcoal', name: 'Charcoal', hex: 0x4a4a52, fam: 'neutral' },
];
export const COLOR = Object.fromEntries(PALETTE.map((c) => [c.id, c]));
export const FAMILIES = { warm: 'warm', green: 'green', cool: 'cool', neutral: 'neutral' };

export const SIZES = ['Small', 'Medium', 'Large'];

export const KINDS = {
    bed: {
        name: 'Bed', emoji: '🛏️', group: 'Furniture', layer: 'floor',
        fp: [[1, 2], [2, 2], [2, 3]], cost: [5, 7, 9], h: [0.55, 0.6, 0.65],
        tags: ['sleep', 'soft'], variants: ['Puffy', 'Four-poster', 'Cot'], slots: ['Frame', 'Blanket'],
        colors: ['cocoa', 'sky'],
    },
    sofa: {
        name: 'Sofa', emoji: '🛋️', group: 'Furniture', layer: 'floor',
        fp: [[2, 1], [3, 1], [4, 1]], cost: [5, 7, 9], h: [0.7, 0.75, 0.8],
        tags: ['seat', 'soft'], variants: ['Plump', 'Boxy', 'Curvy'], slots: ['Body', 'Cushions'],
        colors: ['teal', 'butter'],
    },
    armchair: {
        name: 'Armchair', emoji: '💺', group: 'Furniture', layer: 'floor',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [3, 4, 5], h: [0.65, 0.75, 0.85],
        tags: ['seat', 'soft'], variants: ['Wingback', 'Tub', 'Rocker'], slots: ['Body', 'Cushion'],
        colors: ['tomato', 'cream'],
    },
    chair: {
        name: 'Chair', emoji: '🪑', group: 'Furniture', layer: 'floor',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [2, 2, 3], h: [0.5, 0.55, 0.6],
        tags: ['seat'], variants: ['Spindle', 'Stool', 'Ladder'], slots: ['Wood', 'Seat'],
        colors: ['oat', 'tomato'],
    },
    table: {
        name: 'Table', emoji: '🍽️', group: 'Furniture', layer: 'floor', surface: true,
        fp: [[1, 1], [2, 1], [2, 2]], cost: [3, 4, 6], h: [0.5, 0.52, 0.55],
        tags: ['surface', 'table'], variants: ['Square', 'Round', 'Trestle'], slots: ['Top', 'Legs'],
        colors: ['oat', 'cocoa'],
    },
    desk: {
        name: 'Desk', emoji: '🗄️', group: 'Furniture', layer: 'floor', surface: true,
        fp: [[2, 1], [2, 1], [3, 1]], cost: [4, 5, 6], h: [0.55, 0.58, 0.6],
        tags: ['surface', 'work'], variants: ['Drawers', 'Writing', 'Bureau'], slots: ['Wood', 'Knobs'],
        colors: ['cocoa', 'butter'],
    },
    bookshelf: {
        name: 'Bookshelf', emoji: '📚', group: 'Furniture', layer: 'floor', surface: true,
        fp: [[1, 1], [2, 1], [3, 1]], cost: [3, 5, 6], h: [1.0, 1.2, 1.35],
        tags: ['surface', 'books'], variants: ['Tall', 'Cubby', 'Ladder'], slots: ['Wood', 'Books'],
        colors: ['cocoa', 'tomato'],
    },
    nightstand: {
        name: 'Nightstand', emoji: '🗃️', group: 'Furniture', layer: 'floor', surface: true,
        fp: [[1, 1], [1, 1], [1, 1]], cost: [2, 2, 3], h: [0.4, 0.45, 0.5],
        tags: ['surface'], variants: ['Drawer', 'Round', 'Crate'], slots: ['Wood', 'Knob'],
        colors: ['cream', 'cocoa'],
    },
    fireplace: {
        name: 'Fireplace', emoji: '🔥', group: 'Furniture', layer: 'floor', surface: true,
        fp: [[2, 1], [2, 1], [3, 1]], cost: [6, 7, 9], h: [0.85, 0.95, 1.0],
        tags: ['surface', 'fire', 'light', 'warmlight'], variants: ['Brick', 'Stove', 'Cottage'], slots: ['Stone', 'Mantel'],
        colors: ['oat', 'cocoa'],
    },
    floorlamp: {
        name: 'Floor Lamp', emoji: '💡', group: 'Lights', layer: 'floor',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [2, 3, 3], h: [1.1, 1.3, 1.5],
        tags: ['light'], variants: ['Bell', 'Drum', 'Arc'], slots: ['Stand', 'Shade'], glow: ['Warm', 'Cool'],
        colors: ['charcoal', 'butter'],
    },
    tablelamp: {
        name: 'Table Lamp', emoji: '🪔', group: 'Lights', layer: 'small',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [1, 2, 2], h: [0.35, 0.45, 0.55],
        tags: ['light'], variants: ['Mushroom', 'Bell', 'Candle'], slots: ['Base', 'Shade'], glow: ['Warm', 'Cool'],
        colors: ['teal', 'cream'],
    },
    plant: {
        name: 'Plant', emoji: '🪴', group: 'Decor', layer: 'small',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [1, 2, 3], h: [0.35, 0.55, 0.85],
        tags: ['green'], variants: ['Leafy', 'Cactus', 'Flowers'], slots: ['Pot', 'Leaves'],
        colors: ['tomato', 'moss'],
    },
    toy: {
        name: 'Toy', emoji: '🧸', group: 'Toys', layer: 'small',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [1, 1, 2], h: [0.3, 0.38, 0.48],
        tags: ['toy'], variants: ['Teddy', 'Ball', 'Duck', 'Rocket', 'Blocks'], slots: ['Main', 'Trim'],
        colors: ['cocoa', 'blush'],
    },
    rug: {
        name: 'Rug', emoji: '🟫', group: 'Decor', layer: 'rug',
        fp: [[2, 2], [3, 2], [3, 3]], cost: [2, 3, 4], h: [0.04, 0.04, 0.04],
        tags: ['soft', 'rug'], variants: ['Oblong', 'Round', 'Braided'], slots: ['Base', 'Pattern'],
        motifs: ['Plain', 'Stripes', 'Dots', 'Border'], colors: ['blush', 'cream'],
    },
    picture: {
        name: 'Picture', emoji: '🖼️', group: 'Wall', layer: 'wall',
        fp: [[1, 1], [2, 1], [2, 2]], cost: [1, 2, 3], h: [0, 0, 0],
        tags: ['art'], variants: ['Frame', 'Round', 'Pennant'], slots: ['Frame', 'Paint'],
        motifs: ['Sun', 'Flower', 'Cat', 'Hills', 'Heart', 'Boat'], colors: ['butter', 'sky'],
        // the paintings in the frames are painted with fal (dev/art/prompts.mjs); these say what each shows
        motifArt: [
            'a big round golden sun with wavy rays over a pale blue sky, no face on the sun',
            'three bright tulips, red, yellow and pink, with green leaves in a little blue vase',
            'a fat ginger cat curled up asleep on a cushion, eyes closed',
            'rolling green hills with a winding path, a tiny red cottage and fluffy white clouds',
            'a big plump red heart surrounded by little pink dots',
            'a little sailing boat with a white sail on wavy blue sea under a small cloud',
        ],
    },
    clock: {
        name: 'Clock', emoji: '🕰️', group: 'Wall', layer: 'wall',
        fp: [[1, 1], [1, 1], [1, 1]], cost: [1, 1, 2], h: [0, 0, 0],
        tags: ['time'], variants: ['Round', 'Cuckoo', 'Sunburst'], slots: ['Face', 'Hands'],
        colors: ['cream', 'charcoal'],
    },
};

export const KIND_IDS = Object.keys(KINDS);
export const GROUPS = ['Furniture', 'Lights', 'Decor', 'Toys', 'Wall'];

/** Clay a recipe costs. */
export function costOf(kind, size) {
    return KINDS[kind].cost[size];
}

/** True when the recipe has every field it needs, with a value the catalogue knows. */
export function validRecipe(r) {
    const k = r && KINDS[r.kind];
    if (!k) return false;
    if (!(r.size >= 0 && r.size < 3 && Number.isInteger(r.size))) return false;
    if (!(r.variant >= 0 && r.variant < k.variants.length && Number.isInteger(r.variant))) return false;
    if (!Array.isArray(r.colors) || r.colors.length !== 2 || !r.colors.every((c) => COLOR[c])) return false;
    const motifs = k.motifs || k.glow;
    if (motifs && !(r.motif >= 0 && r.motif < motifs.length && Number.isInteger(r.motif))) return false;
    return true;
}

/** A recipe with the catalogue's defaults, for the bench and the bot. */
export function defaultRecipe(kind) {
    const k = KINDS[kind];
    return { kind, size: 1, variant: 0, colors: [...k.colors], motif: k.motifs || k.glow ? 0 : 0 };
}

/** Does this thing match a goal's `of` filter ({ kind } or { tag })? */
export function matches(item, of) {
    if (!of) return true;
    if (of.kind && item.kind !== of.kind) return false;
    if (of.tag && !KINDS[item.kind].tags.includes(of.tag)) return false;
    if (of.layer && KINDS[item.kind].layer !== of.layer) return false;
    return true;
}

/** A lamp or a fire glowing warm? */
export function warmLight(item) {
    const k = KINDS[item.kind];
    if (k.tags.includes('warmlight')) return true;
    return k.tags.includes('light') && (item.motif || 0) === 0;
}
