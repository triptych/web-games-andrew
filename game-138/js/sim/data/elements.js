// Every element a dungeon can hold. Pure data, shared by the generator (js/sim/features.js), the view (models and
// stand-ins), the UI (the stamp palette) and the Meshy prompts (dev/assets/prompts.mjs).
//
// cat:   which "Elements" slider places it (monsters, hoards, lights, cozy, flora)
// model: the Meshy GLB in assets/models/ (dev/assets/README.md); every one also has a code-built stand-in
// size:  footprint in metres (the longest side on the ground); h: height in metres
// where: 'room' (open floor in a chamber), 'nook' (a dead end or a room corner), 'wall' (floor beside a wall),
//        'water' (floor beside water), 'any'
// glow:  a light it gives off, [hex colour, metres]
// art:   what the model looks like (the Meshy prompt is written from this)

export const ELEMENTS = {
    // ------------------------------------------------------------------ monsters (all of them friendly)
    slime:    { cat: 'monsters', name: 'Snoozy Slime', icon: '🟢', model: 'mon-slime', size: 1.1, h: 0.9, where: 'room', glow: [0x7dffb0, 2.5],
        art: 'a round wobbly jelly slime monster, translucent mint green with a lighter belly, a sleepy contented smile and closed eyes, a tiny leaf stuck on top' },
    mushfolk: { cat: 'monsters', name: 'Mushfolk', icon: '🍄', model: 'mon-mushfolk', size: 0.9, h: 1.2, where: 'any',
        art: 'a small friendly mushroom person with a big red cap with white spots, a pale stubby body, little arms holding a tiny lit lantern, rosy cheeks, standing' },
    golem:    { cat: 'monsters', name: 'Moss Golem', icon: '🗿', model: 'mon-golem', size: 1.5, h: 1.6, where: 'room',
        art: 'a gentle stone golem made of rounded grey boulders sitting cross-legged, thick green moss on its shoulders and head with tiny white flowers, a calm kind face with glowing amber eyes' },
    goblin:   { cat: 'monsters', name: 'Goblin Cook', icon: '🥄', model: 'mon-goblin', size: 1.0, h: 1.35, where: 'room',
        art: 'a cheerful little green goblin cook with big ears, wearing a patched cream apron and a floppy chef hat, holding a wooden ladle, standing, smiling' },
    dragon:   { cat: 'monsters', name: 'Drowsy Dragon', icon: '🐉', model: 'mon-dragon', size: 2.6, h: 1.4, where: 'room', boss: true, glow: [0xffa040, 4],
        art: 'a plump sleepy baby dragon curled up asleep like a cat, warm amber-orange scales with a cream belly, small folded wings, tail wrapped around itself, eyes closed, a tiny smoke puff from its nose' },

    // ------------------------------------------------------------------ hoards
    gold:     { cat: 'hoards', name: 'Gold Hoard', icon: '💰', model: 'hoard-gold', size: 1.3, h: 0.7, where: 'nook', glow: [0xffd36b, 2.2], value: 120,
        art: 'a heap of shiny gold coins with a few red and blue gems, a golden goblet and a small crown poking out of the pile' },
    chest:    { cat: 'hoards', name: 'Treasure Chest', icon: '🧰', model: 'hoard-chest', size: 1.0, h: 0.8, where: 'nook', value: 60,
        art: 'a wooden treasure chest with iron bands and a brass lock, the lid half open showing gold coins inside' },

    // ------------------------------------------------------------------ lights
    brazier:  { cat: 'lights', name: 'Brazier', icon: '🔥', model: 'light-brazier', size: 0.7, h: 1.1, where: 'room', glow: [0xff9a3c, 6], fire: 1.0,
        art: 'a wrought iron brazier on three curled legs with a wide shallow bowl full of glowing orange coals, no flames' },
    candles:  { cat: 'lights', name: 'Candle Nook', icon: '🕯️', model: 'light-candles', size: 0.6, h: 0.5, where: 'wall', glow: [0xffc070, 3.5],
        art: 'a cluster of seven cream wax candles of different heights with melted wax dripping over a small flat stone, all lit with small flames' },

    // ------------------------------------------------------------------ cozy furnishings
    campfire: { cat: 'cozy', name: 'Campfire Camp', icon: '🏕️', model: 'cozy-campfire', size: 2.0, h: 0.8, where: 'room', glow: [0xff8a3a, 7], fire: 1.3,
        art: 'a cozy adventurers camp: a ring of stones around stacked logs, two rolled-up patchwork bedrolls beside it and a small iron cooking pot on a stick tripod, no flames' },
    bookshelf:{ cat: 'cozy', name: 'Bookshelf', icon: '📚', model: 'cozy-bookshelf', size: 1.4, h: 1.9, where: 'wall',
        art: 'a slightly crooked tall wooden bookshelf packed with colourful old books, rolled scrolls, a potted fern and a little candle, seen from the front' },
    barrels:  { cat: 'cozy', name: 'Barrels & Crate', icon: '🛢️', model: 'cozy-barrels', size: 1.4, h: 1.2, where: 'wall',
        art: 'two wooden barrels with iron hoops standing side by side and a small wooden crate of apples in front of them' },
    cauldron: { cat: 'cozy', name: 'Bubbling Cauldron', icon: '🧪', model: 'cozy-cauldron', size: 1.0, h: 0.9, where: 'room', glow: [0x9dff6a, 2.5],
        art: 'a round black iron cauldron on three short legs full of bubbling glowing green potion, a wooden spoon leaning in it' },
    table:    { cat: 'cozy', name: 'Tea Table', icon: '🫖', model: 'cozy-table', size: 1.5, h: 0.9, where: 'room',
        art: 'a small round wooden table with two little three-legged stools, a blue teapot, two cups and a plate of biscuits on top' },

    // ------------------------------------------------------------------ flora and curios
    glowcaps: { cat: 'flora', name: 'Glowcaps', icon: '🌟', model: 'flora-mushrooms', size: 0.8, h: 0.6, where: 'water', glow: [0x6ad8ff, 3],
        art: 'a cluster of tall thin glowing cyan-blue mushrooms of different sizes growing from a mossy clump' },
    crystals: { cat: 'flora', name: 'Crystal Cluster', icon: '💎', model: 'flora-crystals', size: 0.9, h: 1.0, where: 'wall', glow: [0xc58bff, 3],
        art: 'a cluster of pointed violet amethyst crystals of different sizes growing out of a small grey rock' },
    statue:   { cat: 'flora', name: 'Fox Statue', icon: '🦊', model: 'deco-statue', size: 0.9, h: 1.3, where: 'room',
        art: 'a weathered grey stone statue of a curled sleeping fox on a short round plinth, patches of green moss and a few small flowers on it' },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

/** The categories, in the order the Elements panel shows them. */
export const CATEGORIES = {
    monsters: { name: 'Monsters', icon: '🐾', hint: 'friendly residents' },
    hoards:   { name: 'Hoards', icon: '💰', hint: 'gold and chests' },
    lights:   { name: 'Lights', icon: '🔥', hint: 'braziers, candles, torches' },
    cozy:     { name: 'Cozy things', icon: '🫖', hint: 'camps, books, tea' },
    flora:    { name: 'Flora & curios', icon: '🌿', hint: 'glowcaps, crystals, statues' },
    windows:  { name: 'Peek windows', icon: '🪟', hint: 'tiny rooms behind the walls' },
};
export const CATEGORY_IDS = Object.keys(CATEGORIES);

/** Interior-mapped rooms seen through barred windows in the walls (js/view/interior.js paints each one). */
export const NOOKS = {
    library: { name: 'a tiny library' },
    cellar:  { name: 'a wine cellar' },
    den:     { name: 'a sleeping den' },
    grotto:  { name: 'a crystal grotto' },
    pantry:  { name: 'a mushroom pantry' },
};
export const NOOK_IDS = Object.keys(NOOKS);
