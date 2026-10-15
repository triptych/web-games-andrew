// Foes: the books and odds and ends that escaped the library and ran a little wild. Nobody is
// ever hurt. A battle lowers a foe's MISCHIEF to zero, and then it settles back into what it
// was: a book for the shelves, a few coins, sometimes a treat.
//
// Stats come from the tier (see statsFor). `look` is the sprite recipe the view draws.

export const ELEMENTS = ['light', 'wind', 'fire', 'stone', 'frost', 'water', 'small', 'growth', 'echo', 'unbind', 'sky', 'star'];

// Antics a foe can get up to on its turn.
//   dmg: multiplier on its power. status: inflicted on you. self: buff on itself.
export const ANTICS = {
    flap:    { text: '{n} flaps its pages at you!', dmg: 1.0 },
    nip:     { text: '{n} gives you a papery nip!', dmg: 1.2 },
    bump:    { text: '{n} bumps into your shins!', dmg: 1.1 },
    scatter: { text: '{n} scatters loose pages everywhere!', dmg: 0.7, status: 'muddled' },
    splash:  { text: '{n} splashes you with ink!', dmg: 0.6, status: 'smudged', drainInk: 3 },
    dust:    { text: '{n} kicks up a cloud of dust. Achoo!', dmg: 0.8, status: 'muddled' },
    rustle:  { text: '{n} rustles defensively.', self: 'guard' },
    tidy:    { text: '{n} smooths its crumpled corners.', heal: 0.2 },
    hiss:    { text: '{n} hisses a footnote at you!', dmg: 0.9, drainInk: 4 },
    chill:   { text: '{n} breathes a frosty verse!', dmg: 1.1 },
    snap:    { text: '{n} snaps its covers shut on your sleeve!', dmg: 1.3 },
    swoop:   { text: '{n} swoops past your ears!', dmg: 1.15 },
    wail:    { text: '{n} wails a long, sad sentence.', dmg: 0.9, status: 'muddled' },
    charge:  { text: '{n} is winding up for something big…', charge: true },
    slam:    { text: '{n} comes down with a tremendous THUMP!', dmg: 2.1 },
    call:    { text: '{n} calls for its friends!', call: true },
    blot:    { text: '{n} spreads a creeping blot of ink!', dmg: 1.2, status: 'smudged', drainInk: 5 },
};

// tier → base numbers. A foe's own multipliers scale these.
export function statsFor(tier) {
    return {
        hp: Math.round(18 * Math.pow(tier, 1.3)),
        pow: Math.round(3 + 4.4 * tier + 0.2 * tier * tier),
        poise: Math.round(2 + 2 * tier),
        xp: Math.round(6 * Math.pow(tier, 1.6)),
        coins: Math.round(3 + 4 * tier),
    };
}

const E = (o) => ({ hpMul: 1, powMul: 1, poiseMul: 1, weak: [], resist: [], genre: null, drop: null, ...o });

export const ENEMIES = {
    // ------------------------------------------------------------ tier 1: the home counties
    paperback: E({ name: 'Runaway Paperback', tier: 1, look: { body: 'book', c: '#d65a4a', eyes: 2, wings: 'pages' },
        genre: 'tales', antics: [['flap', 3], ['nip', 2], ['rustle', 1]], weak: ['fire'],
        read: 'A cheap adventure story that got bored of its shelf. It wants to be read, mostly.' }),
    dustbunny: E({ name: 'Dust Bunny', tier: 1, hpMul: 0.8, look: { body: 'fluff', c: '#bdb3a6', eyes: 2, ears: true },
        genre: 'nature', antics: [['bump', 3], ['dust', 2]], weak: ['wind', 'water'], drop: ['tea', 0.3],
        read: 'Born under a reading-room sofa. It sneezes when it\'s nervous, which is always.' }),
    pagemoth: E({ name: 'Page Moth', tier: 1, hpMul: 0.85, look: { body: 'moth', c: '#efe3c2', c2: '#a88f5a', eyes: 2 },
        genre: 'poetry', antics: [['swoop', 3], ['scatter', 1]], weak: ['light'], resist: ['wind'],
        read: 'A moth folded from a page of poetry. Drawn to lamps, and to rhymes.' }),
    inkling: E({ name: 'Inkling', tier: 1.2, look: { body: 'blob', c: '#2c2a4a', c2: '#5b5aa0', eyes: 2 },
        genre: 'mystery', antics: [['splash', 2], ['bump', 2], ['tidy', 1]], weak: ['light', 'water'], resist: ['echo'],
        read: 'A drop of spilled ink that got ideas above its station.' }),
    bookworm: E({ name: 'Bookworm', tier: 1.4, look: { body: 'worm', c: '#9fcf6a', c2: '#e3d27a', eyes: 2, specs: true },
        genre: 'history', antics: [['nip', 3], ['hiss', 1], ['rustle', 1]], weak: ['frost'], drop: ['biscuit', 0.15],
        read: 'It has eaten its way through three encyclopaedias and remembers all of it.' }),

    // ------------------------------------------------------------ tier 2: caves and moors
    quillbat: E({ name: 'Quillbat', tier: 2, hpMul: 0.85, powMul: 1.1, look: { body: 'bat', c: '#4a3f5e', c2: '#d9cfe8', eyes: 2 },
        genre: 'songs', antics: [['swoop', 3], ['hiss', 1]], weak: ['light', 'wind'],
        read: 'Its wings are quill pens. It writes squeaky little songs on the cave walls.' }),
    fogfable: E({ name: 'Fog Fable', tier: 2.2, look: { body: 'cloud', c: '#cfd6dc', eyes: 2 },
        genre: 'tales', antics: [['wail', 2], ['bump', 2], ['tidy', 1]], weak: ['wind', 'fire'], resist: ['water', 'frost'],
        read: 'A ghost story that lost its ghost. Now it\'s just very atmospheric.' }),
    scroll: E({ name: 'Scroll Serpent', tier: 2.4, look: { body: 'serpent', c: '#e4d3a8', c2: '#9a7b4a', eyes: 2 },
        genre: 'history', antics: [['snap', 2], ['rustle', 1], ['hiss', 2]], weak: ['fire', 'unbind'], resist: ['stone'],
        read: 'A royal decree that unrolled itself and slithered off. It is very proud of its seal.' }),

    // ------------------------------------------------------------ tier 3: thorns, quarry, kiln
    bramblebook: E({ name: 'Bramble Book', tier: 3, look: { body: 'book', c: '#4f7a3a', eyes: 2, thorns: true },
        genre: 'nature', antics: [['snap', 2], ['nip', 2], ['rustle', 1]], weak: ['fire'], resist: ['growth'],
        read: 'A gardening manual left out in the rain. Things grew on it. Then it grew on things.' }),
    tortoise: E({ name: 'Tome Tortoise', tier: 3.2, hpMul: 1.4, powMul: 0.85, poiseMul: 1.4, look: { body: 'tortoise', c: '#7d8a4a', c2: '#8a5a3a', eyes: 2 },
        genre: 'maps', antics: [['bump', 2], ['rustle', 2], ['charge', 1]], weak: ['frost', 'unbind'], resist: ['stone', 'wind'],
        read: 'Its shell is a very heavy atlas. It is in no hurry whatsoever.' }),
    cinderimp: E({ name: 'Cinder Imp', tier: 3, hpMul: 0.9, powMul: 1.15, look: { body: 'flame', c: '#ff8a3c', c2: '#ffd66b', eyes: 2 },
        genre: 'cookery', antics: [['swoop', 2], ['nip', 2], ['dust', 1]], weak: ['water', 'frost'], resist: ['fire'],
        read: 'A spark from a cookbook\'s recipe for flambé. It is very pleased with itself.' }),

    // ------------------------------------------------------------ tier 4: peaks and coast
    snowsonnet: E({ name: 'Snow Sonnet', tier: 4, hpMul: 0.9, look: { body: 'flake', c: '#e8f6ff', c2: '#8cc8ee', eyes: 2 },
        genre: 'poetry', antics: [['chill', 3], ['scatter', 1]], weak: ['fire'], resist: ['frost', 'water'],
        read: 'Fourteen lines about snow, which have become snow. It rhymes when it moves.' }),
    atlascrab: E({ name: 'Atlas Crab', tier: 4, hpMul: 1.15, poiseMul: 1.2, look: { body: 'crab', c: '#e0704a', c2: '#e9d9a8', eyes: 2 },
        genre: 'maps', antics: [['snap', 3], ['rustle', 1]], weak: ['frost', 'growth'], resist: ['water'],
        read: 'It wears a sea chart for a shell and walks sideways to read it.' }),
    gullnote: E({ name: 'Gull of Notes', tier: 4.2, hpMul: 0.9, powMul: 1.1, look: { body: 'bird', c: '#f2f2ee', c2: '#f0b84a', eyes: 1 },
        genre: 'songs', antics: [['swoop', 3], ['nip', 1], ['call', 1]], weak: ['wind', 'stone'],
        read: 'A seagull made of sheet music. It steals chips and sings off-key.' }),

    // ------------------------------------------------------------ tier 5: the lake and the small places
    lilylex: E({ name: 'Lily Lexicon', tier: 5, look: { body: 'frog', c: '#5fb86a', c2: '#e6e0a8', eyes: 2 },
        genre: 'nature', antics: [['bump', 2], ['splash', 1], ['tidy', 1]], weak: ['frost', 'fire'], resist: ['water'],
        read: 'A frog-shaped dictionary of pond words. "Ribbit" has eleven definitions.' }),
    footnote: E({ name: 'Footnote', tier: 5, hpMul: 0.7, powMul: 1.2, look: { body: 'tiny', c: '#c9a6e0', eyes: 2 },
        genre: 'mystery', antics: [['nip', 3], ['hiss', 2]], weak: ['small', 'stone'],
        read: 'Very small, very insistent, and always at the bottom of things.' }),
    marginalia: E({ name: 'Marginalia', tier: 5.2, look: { body: 'ghost', c: '#dcd8ff', c2: '#8a84c8', eyes: 2 },
        genre: 'mystery', antics: [['wail', 2], ['hiss', 2], ['tidy', 1]], weak: ['echo', 'light'], resist: ['stone', 'wind'],
        read: 'The scribbles in a book\'s margins, wandering about without the book.' }),

    // ------------------------------------------------------------ tier 6: castle, abbey, sky
    bookend: E({ name: 'Bookend Knight', tier: 6, hpMul: 1.25, poiseMul: 1.3, look: { body: 'knight', c: '#9aa3b5', c2: '#c0392b', eyes: 1 },
        genre: 'history', antics: [['snap', 2], ['rustle', 1], ['charge', 1]], weak: ['unbind', 'water'], resist: ['stone', 'fire'],
        read: 'A marble bookend that took its job as "guard" very seriously.' }),
    origami: E({ name: 'Origami Crane', tier: 6, hpMul: 0.85, powMul: 1.15, look: { body: 'crane', c: '#f4f1ea', c2: '#e05a5a', eyes: 1 },
        genre: 'poetry', antics: [['swoop', 3], ['scatter', 1]], weak: ['fire', 'wind'], resist: ['sky'],
        read: 'Folded from a love letter. It flies wherever the wind is going.' }),
    cometcat: E({ name: 'Comet Catalogue', tier: 6.3, look: { body: 'cat', c: '#3b3f7a', c2: '#ffe08a', eyes: 2 },
        genre: 'maps', antics: [['nip', 2], ['swoop', 2], ['tidy', 1]], weak: ['echo', 'small'], resist: ['star', 'light'],
        read: 'An index of every comet, curled up like a cat. Purrs in hexameter.' }),

    // ------------------------------------------------------------ tier 7: the Undercroft
    blotling: E({ name: 'Blotling', tier: 7, look: { body: 'blob', c: '#14121e', c2: '#3a3460', eyes: 2 },
        genre: 'songs', antics: [['blot', 2], ['bump', 2], ['call', 1]], weak: ['light', 'star'], resist: ['echo', 'water'],
        read: 'A splash of the curse. Under the ink, it is an old songbook that misses being sung.' }),
    erratum: E({ name: 'Erratum', tier: 7.2, hpMul: 1.1, look: { body: 'book', c: '#3a1f3f', eyes: 3, thorns: true },
        genre: 'cookery', antics: [['snap', 2], ['blot', 1], ['charge', 1]], weak: ['unbind', 'star'], resist: ['fire'],
        read: 'A recipe book where every measurement is wrong. It is so sorry about the cake.' }),
};

// ------------------------------------------------------------------ guardians
// Each guardian is a grimoire gone wild. Calming it gives you the book.
const B = (o) => E({ boss: true, hpMul: 3.4, powMul: 1.0, poiseMul: 1.1, ...o });
export const BOSSES = {
    lumen:   B({ name: 'The Flickering Primer', tier: 1.6, book: 'lumen', look: { body: 'bigbook', c: '#e8c45a', emblem: 'sun', eyes: 2 },
        antics: [['flap', 3], ['scatter', 1], ['charge', 1]], weak: ['wind'], resist: ['light'],
        read: 'The Lumen Primer, flickering on and off in a panic. It is afraid of the dark it\'s been lost in.' }),
    gust:    B({ name: 'The Howling Almanac', tier: 2.4, book: 'gust', look: { body: 'bigbook', c: '#6cc7c2', emblem: 'swirl', eyes: 2 },
        antics: [['swoop', 3], ['dust', 1], ['charge', 1]], weak: ['light'], resist: ['wind'],
        read: 'Zephyr\'s Almanac, howling every forecast at once. It just wants someone to listen to the weather.' }),
    ember:   B({ name: 'The Smouldering Lexicon', tier: 3.2, book: 'ember', look: { body: 'bigbook', c: '#d9562f', emblem: 'flame', eyes: 2 },
        antics: [['nip', 2], ['splash', 1], ['charge', 1], ['call', 1]], weak: ['wind', 'water'], resist: ['fire'], summon: 'cinderimp',
        read: 'The Hearth Lexicon, smouldering with no hearth to sit in. It\'s lonely more than angry.' }),
    stone:   B({ name: 'The Grumbling Grammar', tier: 3.8, book: 'stone', hpMul: 3.8, look: { body: 'bigbook', c: '#8f7f66', emblem: 'stone', eyes: 2 },
        antics: [['bump', 2], ['rustle', 1], ['charge', 2]], weak: ['fire', 'unbind'], resist: ['stone'],
        read: 'The Lithic Grammar, grumbling very slowly about being disturbed in 1347.' }),
    frost:   B({ name: 'The Shivering Psalter', tier: 4.3, book: 'frost', look: { body: 'bigbook', c: '#8fc8ee', emblem: 'flake', eyes: 2 },
        antics: [['chill', 3], ['scatter', 1], ['charge', 1]], weak: ['fire', 'stone'], resist: ['frost'],
        read: 'The Frost Psalter, shivering in its own cold. Somebody should give it a scarf.' }),
    tide:    B({ name: 'The Roaring Hymnal', tier: 4.7, book: 'tide', look: { body: 'bigbook', c: '#2f78b8', emblem: 'wave', eyes: 2 },
        antics: [['splash', 2], ['snap', 1], ['charge', 1], ['call', 1]], weak: ['frost', 'growth'], resist: ['water', 'fire'], summon: 'gullnote',
        read: 'The Tidal Hymnal, roaring like a storm at sea. Underneath, it\'s humming a lullaby.' }),
    small:   B({ name: 'The Squeaking Grammar', tier: 5.0, book: 'small', hpMul: 3.0, look: { body: 'bigbook', c: '#d58fbd', emblem: 'mouse', eyes: 2 },
        antics: [['nip', 3], ['hiss', 1], ['call', 1]], weak: ['stone', 'frost'], resist: ['small'], summon: 'footnote',
        read: 'The Diminutive Grammar, squeaking every small word it knows. It\'s very, very small, and very, very cross.' }),
    verdant: B({ name: 'The Overgrown Herbarium', tier: 5.4, book: 'verdant', hpMul: 3.7, look: { body: 'bigbook', c: '#4f9a3c', emblem: 'leaf', eyes: 2, thorns: true },
        antics: [['snap', 2], ['tidy', 1], ['charge', 1]], weak: ['fire', 'frost'], resist: ['growth', 'water'],
        read: 'Herbarium Verdant, so overgrown you can hardly see the book. It needs a good pruning and a kind word.' }),
    echo:    B({ name: 'The Wailing Codex', tier: 5.6, book: 'echo', look: { body: 'bigbook', c: '#9b86e0', emblem: 'ripple', eyes: 2 },
        antics: [['wail', 2], ['hiss', 1], ['charge', 1], ['tidy', 1]], weak: ['light', 'star'], resist: ['echo'],
        read: 'The Echo Codex, wailing every word it ever heard, all at once. It needs a quiet moment.' }),
    key:     B({ name: 'The Clanking Lexicon', tier: 6.0, book: 'key', hpMul: 3.7, look: { body: 'bigbook', c: '#b89a3c', emblem: 'key', eyes: 2 },
        antics: [['snap', 2], ['rustle', 1], ['charge', 1]], weak: ['echo', 'water'], resist: ['unbind', 'stone'],
        read: 'The Locksmith\'s Lexicon, locked up tight around itself. Somewhere inside is the word "please".' }),
    feather: B({ name: 'The Tumbling Folio', tier: 6.4, book: 'feather', look: { body: 'bigbook', c: '#e6e2d0', emblem: 'feather', eyes: 2 },
        antics: [['swoop', 3], ['scatter', 1], ['charge', 1], ['call', 1]], weak: ['stone', 'unbind'], resist: ['sky', 'wind'], summon: 'origami',
        read: 'The Featherfall Folio, tumbling through the air and unable to land. It\'s forgotten how to fall gently.' }),
    stars:   B({ name: 'The Dimming Atlas', tier: 6.9, book: 'stars', hpMul: 3.8, look: { body: 'bigbook', c: '#4a4ac0', emblem: 'star', eyes: 2 },
        antics: [['chill', 2], ['wail', 1], ['charge', 1], ['tidy', 1]], weak: ['light', 'echo'], resist: ['star'],
        read: 'The Starlight Atlas, its stars going out one by one. It\'s frightened of the dark between them.' }),
    blot:    B({ name: 'The Blot', tier: 7.6, book: null, final: true, hpMul: 5.2, powMul: 1.0, look: { body: 'theblot', c: '#0c0a14', c2: '#4a3a8a', eyes: 5 },
        antics: [['blot', 3], ['wail', 1], ['charge', 1], ['call', 1]], weak: ['star', 'light'], resist: ['echo', 'water', 'fire'], summon: 'blotling',
        read: 'Every story Vellumvale stopped telling, pooled together in the dark. It isn\'t evil. It\'s forgotten.' }),
};

export const FOE = { ...ENEMIES, ...BOSSES };

// Which foes wander where. Towns have none.
export const BIOME_FOES = {
    farm: ['paperback', 'dustbunny', 'pagemoth'],
    meadow: ['paperback', 'pagemoth', 'dustbunny', 'bookworm'],
    wood: ['paperback', 'pagemoth', 'inkling', 'bookworm'],
    hill: ['inkling', 'bookworm', 'paperback'],
    moor: ['fogfable', 'scroll', 'quillbat'],
    thorn: ['bramblebook', 'scroll', 'tortoise'],
    quarry: ['tortoise', 'bramblebook', 'cinderimp'],
    peak: ['snowsonnet', 'tortoise', 'quillbat'],
    coast: ['atlascrab', 'gullnote', 'pagemoth'],
    lake: ['lilylex', 'footnote', 'atlascrab'],
    willow: ['lilylex', 'footnote', 'marginalia'],
    sky: ['origami', 'cometcat', 'gullnote'],
    abbeyg: ['marginalia', 'fogfable', 'bookend'],
    castleg: ['bookend', 'origami'],
};
