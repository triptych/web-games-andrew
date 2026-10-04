// ============================================================
// Bumble Basket — configuration: fruit, traits, jars, levels
// ============================================================
// Pure data. Imported by the sim (Node-safe) and the view.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'bumble-basket.save.v1';

// --- Colours (the body colour of every fruit of that colour) ---
export const COLOURS = {
    red:    { hex: 0xef3b3b, css: '#ef3b3b', label: 'red' },
    orange: { hex: 0xff9a1f, css: '#ff9a1f', label: 'orange' },
    yellow: { hex: 0xffd83b, css: '#ffd83b', label: 'yellow' },
    green:  { hex: 0x78cc35, css: '#78cc35', label: 'green' },
    blue:   { hex: 0x4a72ff, css: '#4a72ff', label: 'blue' },
    purple: { hex: 0x9147d8, css: '#9147d8', label: 'purple' },
    pink:   { hex: 0xff6fb0, css: '#ff6fb0', label: 'pink' },
};
export const COLOUR_IDS = Object.keys(COLOURS);

// --- Families ---
export const FAMILIES = {
    orchard:  { label: 'Orchard',  css: '#5fae3b', icon: '🌳' },
    berry:    { label: 'Berry',    css: '#b0408f', icon: '🫐' },
    citrus:   { label: 'Citrus',   css: '#f39a12', icon: '🍋' },
    tropical: { label: 'Tropical', css: '#1fb5a6', icon: '🌴' },
};
export const FAMILY_IDS = Object.keys(FAMILIES);

// --- Sizes ---
export const SIZES = {
    S: { label: 'small',  scale: 0.68 },
    M: { label: 'medium', scale: 0.86 },
    L: { label: 'large',  scale: 1.06 },
};
export const SIZE_IDS = ['S', 'M', 'L'];

// --- Kinds. colours[0] is the "classic" colour used before Colour sense. ---
export const KINDS = {
    apple:      { label: 'Apple',       plural: 'apples',       family: 'orchard',  colours: ['red', 'green', 'yellow'] },
    pear:       { label: 'Pear',        plural: 'pears',        family: 'orchard',  colours: ['green', 'yellow'] },
    peach:      { label: 'Peach',       plural: 'peaches',      family: 'orchard',  colours: ['orange', 'pink'] },
    cherry:     { label: 'Cherry',      plural: 'cherries',     family: 'orchard',  colours: ['red', 'yellow'] },
    strawberry: { label: 'Strawberry',  plural: 'strawberries', family: 'berry',    colours: ['red'] },
    blueberry:  { label: 'Blueberry',   plural: 'blueberries',  family: 'berry',    colours: ['blue'] },
    grape:      { label: 'Grapes',      plural: 'grapes',       family: 'berry',    colours: ['purple', 'green'] },
    raspberry:  { label: 'Raspberry',   plural: 'raspberries',  family: 'berry',    colours: ['pink', 'yellow'] },
    orange:     { label: 'Orange',      plural: 'oranges',      family: 'citrus',   colours: ['orange'] },
    lemon:      { label: 'Lemon',       plural: 'lemons',       family: 'citrus',   colours: ['yellow'] },
    lime:       { label: 'Lime',        plural: 'limes',        family: 'citrus',   colours: ['green'] },
    grapefruit: { label: 'Grapefruit',  plural: 'grapefruit',   family: 'citrus',   colours: ['pink', 'yellow'] },
    banana:     { label: 'Banana',      plural: 'bananas',      family: 'tropical', colours: ['yellow', 'green'] },
    pineapple:  { label: 'Pineapple',   plural: 'pineapples',   family: 'tropical', colours: ['yellow'] },
    mango:      { label: 'Mango',       plural: 'mangoes',      family: 'tropical', colours: ['orange', 'red'] },
    dragonfruit:{ label: 'Dragon fruit',plural: 'dragon fruit', family: 'tropical', colours: ['pink', 'yellow'] },
};
export const KIND_IDS = Object.keys(KINDS);

/** Every natural kind+colour+size variant — the Fruit Album. */
export function albumVariants() {
    const out = [];
    for (const kind of KIND_IDS) {
        for (const colour of KINDS[kind].colours) {
            for (const size of SIZE_IDS) out.push({ kind, colour, size, key: `${kind}|${colour}|${size}` });
        }
    }
    return out;
}

// --- Senses: the traits the bee can link by ---
export const SENSES = {
    kind:   { label: 'Kind',   icon: '🍎', hop: 'same kind',   blurb: 'Hop between fruit of the same kind.' },
    colour: { label: 'Colour', icon: '🎨', hop: 'same colour', blurb: 'Now your bee can also hop between fruit of the same colour — a red apple links to a strawberry!' },
    size:   { label: 'Size',   icon: '📏', hop: 'same size',   blurb: 'Now fruit of the same size link too — a big lemon can hop to a big grape.' },
    family: { label: 'Family', icon: '🌳', hop: 'same family', blurb: 'Now fruit of the same family link — lemons, limes and oranges are all Citrus.' },
};
export const SENSE_ORDER = ['kind', 'colour', 'size', 'family'];

// --- Jars: one per sense; filling one earns a power-up charge ---
export const JARS = {
    kind:   { power: 'honey',   need: 8 },
    colour: { power: 'paint',   need: 10 },
    size:   { power: 'bomb',    need: 10 },
    family: { power: 'rainbow', need: 12 },
};
export const MAX_CHARGES = 2;

export const POWERS = {
    honey:   { label: 'Honey Dipper',  icon: '🍯', tip: 'Tap a fruit to collect every fruit of that kind.' },
    paint:   { label: 'Paint Pollen',  icon: '🎨', tip: 'Tap a fruit — its neighbours turn its colour.' },
    bomb:    { label: 'Buzz Bomb',     icon: '💥', tip: 'Tap a spot to collect the 3×3 around it.' },
    rainbow: { label: 'Rainbow Wings', icon: '🌈', tip: 'Your next trail can hop between any fruit!' },
};

// --- Rules ---
export const MIN_CHAIN = 3;
export const GOLDEN_CHAIN = 7;       // trail length that grows a golden fruit
export const CONTINUE_MOVES = 5;
export const STAR2_FRAC = 0.20;
export const STAR3_FRAC = 0.40;
export const SCORE = { perChainSq: 10, powerFruit: 20, golden: 100, leftover: 150 };
export const PICNIC_BASKET = 40;     // fruit per basket in Picnic mode

// --- Gardens ---
export const GARDENS = [
    { id: 'orchard', name: 'Sunny Orchard',  senses: ['kind'],                              sky: ['#8fd6ff', '#e8f8ff'], grass: 0x8fd35a, accent: '#ff7a59' },
    { id: 'berry',   name: 'Berry Patch',    senses: ['kind', 'colour'],                    sky: ['#ffb3d1', '#fff1e6'], grass: 0x7fcf62, accent: '#c4479b' },
    { id: 'giant',   name: "Giant's Garden", senses: ['kind', 'colour', 'size'],            sky: ['#a6e3c9', '#fbfbe0'], grass: 0x74c457, accent: '#2d9e6c' },
    { id: 'tropic',  name: 'Tropic Tops',    senses: ['kind', 'colour', 'size', 'family'],  sky: ['#7fe0e6', '#fff6cf'], grass: 0x6ccb5b, accent: '#1aa79a' },
];

// --- Blanket shapes. '.' = cell, ' ' = hole. All 7 wide × 8 tall. ---
const M = {
    full: [
        '.......', '.......', '.......', '.......',
        '.......', '.......', '.......', '.......',
    ],
    heart: [
        ' .. .. ', '.......', '.......', '.......',
        '.......', ' ..... ', '  ...  ', '   .   ',
    ],
    diamond: [
        '   .   ', '  ...  ', ' ..... ', '.......',
        '.......', ' ..... ', '  ...  ', '   .   ',
    ],
    ring: [
        '.......', '.......', '..   ..', '..   ..',
        '..   ..', '..   ..', '.......', '.......',
    ],
    hourglass: [
        '.......', '.......', ' ..... ', '  ...  ',
        '  ...  ', ' ..... ', '.......', '.......',
    ],
    cross: [
        ' ..... ', '.......', '.......', '.. . ..',
        '.. . ..', '.......', '.......', ' ..... ',
    ],
    flower: [
        '  ...  ', ' ..... ', '.......', '... ...',
        '... ...', '.......', ' ..... ', '  ...  ',
    ],
    tall: [
        ' ..... ', ' ..... ', ' ..... ', ' ..... ',
        ' ..... ', ' ..... ', ' ..... ', ' ..... ',
    ],
    bowl: [
        '.     .', '..   ..', '.......', '.......',
        '.......', '.......', ' ..... ', '  ...  ',
    ],
    stripes: [
        '.......', '.......', '.......', '.. . ..',
        '.......', '.......', '.......', '.. . ..',
    ],
};
export const MASKS = M;

// Obstacle layouts: [row, col, layers]
const ring = (rows, cols, n = 1) => rows.flatMap(r => cols.map(c => [r, c, n]));

// ------------------------------------------------------------
// Levels. kinds: [kindId] or [kindId, nColours]. sizes default ['M'].
// goals: { t: kind|colour|size|family|golden|leaf|frost|any, v, n }
// ------------------------------------------------------------
export const LEVELS = [
    // ---------- Sunny Orchard — Kind sense ----------
    { g: 0, name: 'First Pick', moves: 10, mask: 'full', kinds: ['apple', 'orange', 'grape'],
      goals: [{ t: 'kind', v: 'apple', n: 24 }],
      tip: 'Drag the bee across 3 or more apples, then let go to pick them.' },
    { g: 0, name: 'Two Baskets', moves: 14, mask: 'full', kinds: ['apple', 'orange', 'grape', 'banana'],
      goals: [{ t: 'kind', v: 'orange', n: 18 }, { t: 'kind', v: 'grape', n: 18 }],
      tip: 'Trails can bend in any direction — even diagonally.' },
    { g: 0, name: 'Golden Hour', moves: 14, mask: 'full', kinds: ['apple', 'orange', 'grape', 'banana'],
      goals: [{ t: 'golden', n: 2 }, { t: 'kind', v: 'banana', n: 22 }],
      tip: 'A trail of 7 or more grows a golden fruit. Golden fruit links to anything!' },
    { g: 0, name: 'Honey Jar', moves: 16, mask: 'heart', kinds: ['apple', 'orange', 'grape', 'banana', 'pear'],
      goals: [{ t: 'kind', v: 'pear', n: 14 }, { t: 'kind', v: 'apple', n: 14 }],
      tip: 'Fill the jar under the blanket to earn a Honey Dipper. Tap the jar, then tap a fruit.' },
    { g: 0, name: 'Diamond Dew', moves: 17, mask: 'diamond', kinds: ['apple', 'orange', 'grape', 'banana', 'pear'],
      goals: [{ t: 'kind', v: 'orange', n: 18 }, { t: 'golden', n: 2 }] },
    { g: 0, name: 'Cherry Tops', moves: 18, mask: 'full', kinds: ['apple', 'orange', 'grape', 'banana', 'cherry'],
      goals: [{ t: 'kind', v: 'cherry', n: 18 }, { t: 'kind', v: 'banana', n: 16 }] },
    { g: 0, name: 'Orchard Set', moves: 22, mask: 'flower', kinds: ['apple', 'orange', 'grape', 'banana', 'pear'], finale: true,
      goals: [{ t: 'kind', v: 'apple', n: 16 }, { t: 'kind', v: 'orange', n: 16 }, { t: 'kind', v: 'grape', n: 16 }, { t: 'kind', v: 'pear', n: 16 }],
      tip: 'Set level! Collect the whole Orchard Set to teach your bee a new sense.' },

    // ---------- Berry Patch — + Colour sense ----------
    { g: 1, name: 'Seeing Red', moves: 14, mask: 'full', kinds: [['apple', 2], 'strawberry', 'lime', 'lemon'],
      goals: [{ t: 'colour', v: 'red', n: 30 }, { t: 'colour', v: 'green', n: 30 }],
      tip: 'Colour sense! A red apple can hop to a strawberry, a green apple to a lime.' },
    { g: 1, name: 'Berry Mix', moves: 15, mask: 'full', kinds: [['apple', 3], 'strawberry', 'blueberry', ['grape', 2], 'lemon'],
      goals: [{ t: 'kind', v: 'blueberry', n: 14 }, { t: 'colour', v: 'purple', n: 14 }] },
    { g: 1, name: 'Paint Pot', moves: 16, mask: 'hourglass', kinds: [['apple', 3], 'strawberry', 'blueberry', ['grape', 2], 'lime'],
      goals: [{ t: 'colour', v: 'yellow', n: 13 }, { t: 'kind', v: 'strawberry', n: 13 }],
      tip: 'The colour jar earns Paint Pollen: tap a fruit and its neighbours take its colour.' },
    { g: 1, name: 'Pink Picnic', moves: 18, mask: 'heart', kinds: [['raspberry', 2], ['cherry', 2], 'strawberry', ['grape', 2], 'lemon', 'blueberry'],
      goals: [{ t: 'colour', v: 'pink', n: 12 }, { t: 'kind', v: 'cherry', n: 10 }] },
    { g: 1, name: 'Ring a Ring', moves: 17, mask: 'ring', kinds: [['apple', 3], ['banana', 2], 'lime', 'lemon', 'blueberry'],
      goals: [{ t: 'kind', v: 'banana', n: 18 }, { t: 'golden', n: 3 }] },
    { g: 1, name: 'Green Thumbs', moves: 17, mask: 'full', kinds: [['apple', 3], ['grape', 2], ['pear', 2], 'lime', 'blueberry', 'strawberry'],
      goals: [{ t: 'colour', v: 'green', n: 34 }, { t: 'kind', v: 'pear', n: 18 }] },
    { g: 1, name: 'Sunny Side', moves: 18, mask: 'cross', kinds: [['cherry', 2], ['raspberry', 2], 'lemon', ['banana', 2], 'blueberry', 'orange'],
      goals: [{ t: 'colour', v: 'yellow', n: 30 }, { t: 'colour', v: 'blue', n: 16 }] },
    { g: 1, name: 'Berry Set', moves: 22, mask: 'flower', finale: true,
      kinds: ['strawberry', 'blueberry', ['grape', 2], ['raspberry', 2], ['apple', 3], 'lime'],
      goals: [{ t: 'kind', v: 'strawberry', n: 17 }, { t: 'kind', v: 'blueberry', n: 17 }, { t: 'kind', v: 'grape', n: 17 }, { t: 'kind', v: 'raspberry', n: 17 }],
      tip: 'Set level! Gather every berry to learn the next sense.' },

    // ---------- Giant's Garden — + Size sense ----------
    { g: 2, name: 'Big & Small', moves: 12, mask: 'full', sizes: ['S', 'M', 'L'], kinds: [['peach', 2], ['apple', 3], 'blueberry', 'orange', 'lime'],
      goals: [{ t: 'size', v: 'L', n: 30 }, { t: 'size', v: 'S', n: 30 }],
      tip: 'Size sense! Big fruit links to big fruit, small to small.' },
    { g: 2, name: 'Peach Fuzz', moves: 15, mask: 'full', sizes: ['S', 'M', 'L'], kinds: [['peach', 2], ['apple', 3], 'strawberry', 'lemon', ['grape', 2], 'orange'],
      goals: [{ t: 'kind', v: 'peach', n: 22 }, { t: 'size', v: 'M', n: 26 }],
      tip: 'The size jar earns a Buzz Bomb that collects a 3×3 patch.' },
    { g: 2, name: 'Leaf Peepers', moves: 16, mask: 'full', sizes: ['S', 'M', 'L'], kinds: [['peach', 2], ['apple', 3], 'blueberry', 'lemon', ['cherry', 2], 'orange'],
      leaves: ring([2, 5], [1, 3, 5]),
      goals: [{ t: 'leaf', n: 6 }, { t: 'size', v: 'L', n: 30 }],
      tip: 'Leaf piles! Pick fruit next to a pile to rake it away.' },
    { g: 2, name: 'Giant Steps', moves: 16, mask: 'diamond', sizes: ['S', 'M', 'L'], kinds: [['mango', 2], ['pear', 2], 'strawberry', 'lime', ['banana', 2], 'blueberry'],
      goals: [{ t: 'kind', v: 'mango', n: 22 }, { t: 'golden', n: 3 }] },
    { g: 2, name: 'Raking Day', moves: 17, mask: 'full', sizes: ['S', 'M', 'L'], kinds: [['apple', 3], ['peach', 2], 'blueberry', 'lemon', ['raspberry', 2], 'orange'],
      leaves: [...ring([1], [1, 3, 5], 2), ...ring([4], [0, 2, 4, 6], 2), ...ring([7], [1, 5], 2)],
      goals: [{ t: 'leaf', n: 9 }, { t: 'colour', v: 'orange', n: 30 }] },
    { g: 2, name: 'Little Ones', moves: 17, mask: 'bowl', sizes: ['S', 'M', 'L'], kinds: [['cherry', 2], 'blueberry', ['grape', 2], ['raspberry', 2], 'strawberry', 'lime', 'orange'],
      goals: [{ t: 'size', v: 'S', n: 32 }, { t: 'kind', v: 'cherry', n: 20 }, { t: 'family', v: 'berry', n: 32 }] },
    { g: 2, name: 'Pile Up', moves: 18, mask: 'stripes', sizes: ['S', 'M', 'L'], kinds: [['apple', 3], ['pear', 2], ['peach', 2], 'lemon', 'blueberry', ['mango', 2]],
      leaves: [...ring([0], [0, 6], 2), ...ring([4], [1, 2, 4, 5], 2), ...ring([7], [1, 5], 2)],
      goals: [{ t: 'leaf', n: 8 }, { t: 'size', v: 'M', n: 40 }, { t: 'golden', n: 2 }] },
    { g: 2, name: 'Giant Set', moves: 18, mask: 'flower', sizes: ['S', 'M', 'L'], finale: true,
      kinds: [['peach', 2], ['mango', 2], ['apple', 3], 'blueberry', 'lemon', ['pear', 2]],
      goals: [{ t: 'size', v: 'S', n: 40 }, { t: 'size', v: 'M', n: 40 }, { t: 'size', v: 'L', n: 40 }, { t: 'kind', v: 'mango', n: 30 }],
      tip: 'Set level! Gather small, medium and large to learn the last sense.' },

    // ---------- Tropic Tops — + Family sense ----------
    { g: 3, name: 'Family Tree', moves: 14, mask: 'full', sizes: ['S', 'M', 'L'], kinds: ['orange', 'lemon', 'lime', ['grapefruit', 2], ['banana', 2], 'pineapple', 'strawberry', 'blueberry'],
      goals: [{ t: 'family', v: 'citrus', n: 40 }, { t: 'family', v: 'tropical', n: 32 }],
      tip: 'Family sense! Lemons, limes, oranges and grapefruit are all Citrus.' },
    { g: 3, name: 'Frosty Fruit', moves: 15, mask: 'full', sizes: ['S', 'M', 'L'], kinds: ['pineapple', ['dragonfruit', 2], ['mango', 2], 'lemon', 'lime', ['apple', 3], 'blueberry'],
      frost: ring([2, 5], [1, 3, 5], 2),
      goals: [{ t: 'frost', n: 6 }, { t: 'kind', v: 'dragonfruit', n: 20 }],
      tip: 'Frosted fruit can’t join a trail. Pick fruit next to it to thaw it out.' },
    { g: 3, name: 'Rainbow Road', moves: 16, mask: 'hourglass', sizes: ['S', 'M', 'L'], kinds: [['dragonfruit', 2], 'pineapple', ['mango', 2], ['raspberry', 2], 'blueberry', ['grapefruit', 2], 'lime', ['cherry', 2]],
      goals: [{ t: 'family', v: 'berry', n: 24 }, { t: 'colour', v: 'pink', n: 24 }],
      tip: 'The family jar earns Rainbow Wings: your next trail can hop between any fruit.' },
    { g: 3, name: 'Ice Cream', moves: 17, mask: 'full', sizes: ['S', 'M', 'L'], kinds: [['banana', 2], 'pineapple', ['mango', 2], 'orange', 'lemon', ['grapefruit', 2], ['peach', 2], 'strawberry'],
      frost: [...ring([0], [1, 3, 5], 2), ...ring([7], [0, 2, 4, 6], 2), ...ring([3, 4], [3])],
      goals: [{ t: 'frost', n: 9 }, { t: 'family', v: 'tropical', n: 45 }] },
    { g: 3, name: 'Fall & Frost', moves: 18, mask: 'cross', sizes: ['S', 'M', 'L'], kinds: [['apple', 3], ['pear', 2], 'lime', 'lemon', ['dragonfruit', 2], 'blueberry', ['grape', 2], 'pineapple'],
      frost: ring([1, 6], [1, 3, 5]), leaves: ring([3, 4], [0, 6], 2),
      goals: [{ t: 'frost', n: 6 }, { t: 'leaf', n: 4 }, { t: 'family', v: 'orchard', n: 34 }, { t: 'golden', n: 2 }] },
    { g: 3, name: 'Grand Buffet', moves: 18, mask: 'ring', sizes: ['S', 'M', 'L'], kinds: [['apple', 3], ['peach', 2], 'strawberry', ['grape', 2], 'orange', ['grapefruit', 2], ['banana', 2], ['mango', 2], 'pineapple', 'blueberry'],
      goals: [{ t: 'any', n: 120 }, { t: 'golden', n: 4 }] },
    { g: 3, name: 'The Big Picnic', moves: 24, mask: 'flower', sizes: ['S', 'M', 'L'], finale: true,
      kinds: [['apple', 3], ['cherry', 2], 'strawberry', 'blueberry', 'lemon', 'lime', ['banana', 2], 'pineapple', ['dragonfruit', 2], ['mango', 2]],
      frost: ring([3, 4], [1, 5]),
      goals: [{ t: 'family', v: 'orchard', n: 28 }, { t: 'family', v: 'berry', n: 28 }, { t: 'family', v: 'citrus', n: 28 }, { t: 'family', v: 'tropical', n: 28 }],
      tip: 'The grand finale — collect a full set of every family!' },
];

export function levelSenses(level) {
    return GARDENS[level.g].senses;
}

/** Index of the first level of each garden (used for sense-unlock cards). */
export const GARDEN_STARTS = GARDENS.map((_, gi) => LEVELS.findIndex(l => l.g === gi));
export const PICNIC_UNLOCK = GARDEN_STARTS[1];   // after the first garden
