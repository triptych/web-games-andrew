// The twelve grimoires of the Lantern Library, and the common books that escaped with them.
//
// A grimoire lends you a power in the world (it opens one kind of lock) and a spell in battle.
// Each one ran wild when the library fell; the guardian at the end of its dungeon IS the book,
// and calming it turns it back. Restoring all twelve to the Rotunda lifts the curse.

export const GRIMOIRES = [
    {
        id: 'lumen', title: 'The Lumen Primer', short: 'Lumen', colour: '#ffd86b', emblem: 'sun',
        power: 'Light the dark. Pitch-black passages become walkable while you carry it.',
        spell: { name: 'Soft Glow', ink: 3, kind: 'calm', power: 10, elem: 'light', target: 'one',
            text: 'A warm glow, like a reading lamp left on for someone.' },
        lore: 'A first reader for little lights. Its pages are warm to the touch.',
        memory: 'I remember… a lamp on a long desk, and the smell of cocoa. Someone hummed while they worked. Was it me?',
    },
    {
        id: 'gust', title: "Zephyr's Almanac", short: 'Gust', colour: '#9fe3e0', emblem: 'swirl',
        power: 'Blow away fog banks. Face the fog and press Action.',
        spell: { name: 'Page Breeze', ink: 4, kind: 'calm', power: 7, elem: 'wind', target: 'all',
            text: 'A breeze riffles every page in reach.' },
        lore: 'Weather notes for every day of a year that never quite happened.',
        memory: 'A window. I always kept the north window open a crack, so the books could breathe. Silly, isn\'t it?',
    },
    {
        id: 'ember', title: 'The Hearth Lexicon', short: 'Ember', colour: '#ff8a4c', emblem: 'flame',
        power: 'Burn away brambles. Face the thorns and press Action.',
        spell: { name: 'Hearthwarm', ink: 4, kind: 'calm', power: 15, elem: 'fire', target: 'one',
            text: 'The cosy heat of a fire you can curl up beside.' },
        lore: 'Every word for warmth, in every tongue. Wick likes this one best.',
        memory: 'Oh! A hearth. MY hearth. I used to toast bread on it with a long brass fork. I… had hands, then.',
    },
    {
        id: 'stone', title: 'The Lithic Grammar', short: 'Stone', colour: '#b9a58a', emblem: 'stone',
        power: 'Ask boulders to roll aside. Face a boulder and press Action.',
        spell: { name: 'Steady Stone', ink: 4, kind: 'guard', power: 6, elem: 'stone', target: 'self',
            text: 'You feel as steady as an old mountain. (Poise up for 3 turns, and a gentle calm.)' },
        lore: 'Stones speak very slowly. This book took four hundred years to write.',
        memory: 'There was a ledger. I wrote every loan in it, in green ink. Green, because it\'s the colour of things growing.',
    },
    {
        id: 'frost', title: 'The Frost Psalter', short: 'Frost', colour: '#bfe6ff', emblem: 'flake',
        power: 'Freeze running streams into ice you can walk on. Face a stream and press Action.',
        spell: { name: 'Hush of Snow', ink: 5, kind: 'calm', power: 11, elem: 'frost', target: 'one', drowsy: 0.6,
            text: 'The deep hush of the first snowfall. Foes may grow drowsy.' },
        lore: 'Psalms for the quiet months. Reading it aloud makes your breath fog.',
        memory: 'Winter nights in the library, the whole town crowded in by the fire for story hour. I read them the Snow Queen. Every year.',
    },
    {
        id: 'tide', title: 'The Tidal Hymnal', short: 'Tide', colour: '#4fa8e0', emblem: 'wave',
        power: 'Swim. Deep water carries you while you hold it.',
        spell: { name: 'Tidewash', ink: 5, kind: 'heal', power: 40, elem: 'water', target: 'self',
            text: 'A cool wave washes the worry away. (Restores composure.)' },
        lore: 'Sea shanties and lullabies, which turn out to be the same songs.',
        memory: 'I had an apprentice once… no. I wanted one. I waited years for someone to answer the notice. And then you came. Too late for me, but not for the books.',
    },
    {
        id: 'small', title: 'The Diminutive Grammar', short: 'Small', colour: '#e8b7d6', emblem: 'mouse',
        power: 'Shrink to mouse size and slip through tiny doors. Just walk into one.',
        spell: { name: 'Pocket Spell', ink: 4, kind: 'shrink', power: 6, elem: 'small', target: 'one',
            text: 'The foe shrinks to pocket size. Its antics hit softer.' },
        lore: 'A grammar for very small sentences. Written by mice, for mice, about mice.',
        memory: 'The mice! They kept the Small Grammar. I gave them a library card each, sized to fit. Do they still have them?',
    },
    {
        id: 'verdant', title: 'Herbarium Verdant', short: 'Verdant', colour: '#7fd36a', emblem: 'leaf',
        power: 'Grow sprouts into climbing vines. Face a sprout at a cliff and press Action.',
        spell: { name: 'Bloom', ink: 5, kind: 'regen', power: 10, elem: 'growth', target: 'self',
            text: 'Petals unfurl around you. (Restores composure each turn for 4 turns.)' },
        lore: 'Pressed flowers from every meadow in Vellumvale. Some are still alive.',
        memory: 'My name… I\'m sure it began with an M. Like marigolds. There were marigolds on my windowsill.',
    },
    {
        id: 'echo', title: 'The Echo Codex', short: 'Echo', colour: '#c9b6ff', emblem: 'ripple',
        power: 'Speak with what lingers. Ghostly gates part when you face them and press Action.',
        spell: { name: 'Lullaby Echo', ink: 6, kind: 'calm', power: 10, elem: 'echo', target: 'all',
            text: 'A lullaby that sings itself back, softer each time.' },
        lore: 'Every word ever said in the Abbey, still echoing between the covers.',
        memory: 'I remember the night it happened. The ink rose up out of the Undercroft like a tide. I shut the door on it with myself on the wrong side.',
    },
    {
        id: 'key', title: "The Locksmith's Lexicon", short: 'Key', colour: '#e0c060', emblem: 'key',
        power: 'Read the rune seals open. Face a seal and press Action.',
        spell: { name: 'Unbind', ink: 6, kind: 'calm', power: 14, elem: 'unbind', target: 'one', strip: true,
            text: 'Every latch and knot in the foe comes loose. (Removes its guard.)' },
        lore: 'A dictionary of the words that open things. "Please" is on the first page.',
        memory: 'Marigold. Marigold Ashby, Keeper of the Lantern Library. That was me. That is me. Thank you for finding my name.',
    },
    {
        id: 'feather', title: 'The Featherfall Folio', short: 'Feather', colour: '#f2efe2', emblem: 'feather',
        power: 'Float. Chasms can be crossed on the air while you hold it.',
        spell: { name: 'Featherlight', ink: 4, kind: 'dodge', power: 0, elem: 'sky', target: 'self',
            text: 'You become light as a feather. (The next antic misses you entirely.)' },
        lore: 'A folio of birds that taught people how to fall gently.',
        memory: 'The Queen used to come here as a girl. She read the Featherfall Folio under the big table and thought I didn\'t know.',
    },
    {
        id: 'stars', title: 'The Starlight Atlas', short: 'Stars', colour: '#8d8dff', emblem: 'star',
        power: 'Open the star seals. One waits beneath the Rotunda, on the door to the Undercroft.',
        spell: { name: 'Starlit Story', ink: 10, kind: 'calm', power: 26, elem: 'star', target: 'all',
            text: 'You tell the story of the stars, and everyone listens.' },
        lore: 'Maps of the sky, with every constellation\'s story written in the margins.',
        memory: 'It\'s cold down there, in the Undercroft. But I can feel the library getting warmer above me. Come and get me, apprentice. I\'ll put the kettle on. Somehow.',
    },
];

export const GRIMOIRE = Object.fromEntries(GRIMOIRES.map((b) => [b.id, b]));
export const BOOK_ORDER = GRIMOIRES.map((b) => b.id);

// ------------------------------------------------------------------ common books
// The ordinary books that escaped. Calmed foes turn back into them; carry them to the Returns
// Cart in the Reading Room and they go back on their shelf. A full genre earns a gift.

export const GENRES = {
    poetry: { name: 'Poetry', colour: '#d77fb0' },
    cookery: { name: 'Cookery', colour: '#e9a64e' },
    history: { name: 'History', colour: '#a97a52' },
    tales: { name: 'Fairy Tales', colour: '#8fc46b' },
    nature: { name: 'Natural Philosophy', colour: '#5fae8a' },
    maps: { name: 'Maps & Travels', colour: '#5d9bd1' },
    mystery: { name: 'Mysteries', colour: '#7b6fc4' },
    songs: { name: 'Songbooks', colour: '#e56a6a' },
};

export const COMMON_BOOKS = [
    // poetry
    ['poetry', 'Odes to Small Weather'], ['poetry', 'The Hedgehog Sonnets'], ['poetry', 'Verses for a Rainy Window'],
    ['poetry', 'Haiku for Kettles'], ['poetry', 'The Lighthouse Keeper\'s Rhymes'], ['poetry', 'Starlings: A Cycle'],
    // cookery
    ['cookery', 'One Hundred Soups'], ['cookery', 'The Honest Biscuit'], ['cookery', 'Jam Through the Seasons'],
    ['cookery', 'Bread for Beginners and Bakers'], ['cookery', 'Tea and Its Companions'], ['cookery', 'The Mouse Cheese Almanac'],
    // history
    ['history', 'A Brief History of Vellumvale'], ['history', 'The Queens of Aubade'], ['history', 'Mills and Millers'],
    ['history', 'Lanterns: An Account'], ['history', 'The Founding of Saltmere'], ['history', 'Chronicle of the Long Frost'],
    // tales
    ['tales', 'The Owl Who Was Afraid of Books'], ['tales', 'Seven Silver Spoons'], ['tales', 'The Snow Queen'],
    ['tales', 'The Little Lamp'], ['tales', 'The Fox and the Lending Card'], ['tales', 'Bramble Rose'],
    // nature
    ['nature', 'A Field Guide to Moths'], ['nature', 'Ferns of the Whisperwood'], ['nature', 'On Clouds'],
    ['nature', 'Tidepools and Their Residents'], ['nature', 'Stones That Hum'], ['nature', 'The Secret Life of Moss'],
    // maps
    ['maps', 'Roads of the Eastern Downs'], ['maps', 'Charts of the Saltmere Coast'], ['maps', 'An Atlas of Small Places'],
    ['maps', 'Frostmantle by Lantern'], ['maps', 'The Lake That Moves'], ['maps', 'Skyreach: A Climber\'s Notes'],
    // mystery
    ['mystery', 'The Case of the Missing Bookmark'], ['mystery', 'Death by Overdue Fine'], ['mystery', 'The Abbey Bell'],
    ['mystery', 'Who Moved the Moon?'], ['mystery', 'The Locked Library'], ['mystery', 'Footprints in the Flour'],
    // songs
    ['songs', 'Shanties of the Saltmere'], ['songs', 'Harvest Rounds'], ['songs', 'Lullabies for Lanterns'],
    ['songs', 'The Mouse Choir Hymnal'], ['songs', 'Marching Songs (Quiet Edition)'], ['songs', 'Carols of the Peaks'],
].map(([genre, title], i) => ({ id: 'b' + i, genre, title }));

export const COMMON = Object.fromEntries(COMMON_BOOKS.map((b) => [b.id, b]));
export const booksOfGenre = (g) => COMMON_BOOKS.filter((b) => b.genre === g);

// A full genre shelf earns a gift (given at the Returns Cart).
export const GENRE_REWARD = {
    poetry: { item: 'patch', n: 1 }, cookery: { item: 'biscuit', n: 5 }, history: { item: 'inkwell', n: 1 },
    tales: { item: 'patch', n: 1 }, nature: { item: 'inkwell', n: 1 }, maps: { item: 'compass', n: 1 },
    mystery: { item: 'patch', n: 1 }, songs: { item: 'musicbox', n: 1 },
};
