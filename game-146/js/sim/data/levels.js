// JINGLE POP — chapters, levels, power-ups and the story. Pure data (the generator is js/sim/levels.js).

/** Power-ups. `shot` ones are loaded into the launcher and fired; the others act the moment they are used.
 *  `icon` is the cell in art/icons.webp (a 3x3 sheet; 8 is the wrapped present). */
export const POWERS = {
    bomb: { name: 'Pudding Bomb', icon: 1, shot: true, desc: 'Bursts every ornament within two rings of where it lands: coal and ice too.' },
    star: { name: 'Rainbow Star', icon: 2, shot: true, desc: 'Turns into the colour it touches and only needs one partner to pop.' },
    candy: { name: 'Candy Cane Striker', icon: 0, shot: true, desc: 'Smashes straight through everything in its path, off the walls and up to the ceiling.' },
    cookie: { name: 'Gingerbread Break', icon: 7, shot: false, desc: 'The blizzard backs off: the ceiling rises one row and the drop counter resets.' },
    cocoa: { name: 'Hot Cocoa', icon: 5, shot: true, desc: 'Thaws every frozen ornament on the board and melts the coal where it splashes.' },
    bell: { name: 'Jingle Bell', icon: 3, shot: true, desc: 'Rings away every ornament of the colour it touches, all over the board.' },
    tinsel: { name: 'Tinsel Garland', icon: 4, shot: true, desc: 'Sweeps away the whole row it lands in and the row above it.' },
    north: { name: 'North Star', icon: 6, shot: false, desc: 'Shows the whole path and the landing spot of your next 8 shots.' },
};
export const POWER_IDS = Object.keys(POWERS);
export const GIFT_ICON = 8;

/** Grid specials, for the how-to page and the level intro cards. */
export const SPECIALS = {
    gift: { name: 'Wrapped Present', desc: 'Pop or drop an ornament next to it and it opens: a power-up goes in your sack.' },
    coal: { name: 'Lump of Coal', desc: 'Never matches. Drop it by cutting what holds it up, or blast it.' },
    ice: { name: 'Frozen Ornament', desc: 'Land a shot against it, or pop something next to it, to thaw it; then it matches like any other.' },
    bell: { name: 'Golden Bell', desc: 'Pop something next to it and it rings, popping everything around it.' },
    prism: { name: 'Prism Bauble', desc: 'A rainbow ornament that matches every colour.' },
};

// Each chapter unlocks power-ups (presents and the spirit meter only give unlocked ones) and introduces a special.
export const CHAPTERS = [
    { id: 'workshop', name: "Santa's Workshop", bg: 'workshop', music: 'play1', unlock: ['bomb', 'star'], meet: 'gift', tint: 0xffb35c },
    { id: 'gingerbread', name: 'Gingerbread Lane', bg: 'gingerbread', music: 'play1', unlock: ['candy', 'cookie'], meet: 'coal', tint: 0xffa36a },
    { id: 'candy', name: 'Candy Cane Forest', bg: 'candy', music: 'play1', unlock: ['cocoa'], meet: 'ice', tint: 0xffc6dc },
    { id: 'pond', name: 'Twinkle Pond', bg: 'pond', music: 'play2', unlock: ['bell', 'tinsel'], meet: 'bell', tint: 0x9fc8ff },
    { id: 'ridge', name: 'Reindeer Ridge', bg: 'ridge', music: 'play2', unlock: ['north'], meet: 'prism', tint: 0x9dffd0 },
    { id: 'hoard', name: "Grimwick's Hoard", bg: 'hoard', music: 'play2', unlock: [], meet: null, tint: 0xa8e4ff },
];

// name, shape, paint, rows, colours, tray slots, misses before the ceiling drops, specials
// (g gift, c coal, i ice, b bell, p prism, each followed by a count).
const L = (name, shape, paint, rows, colors, slots, drop, sp = '') => ({ name, shape, paint, rows, colors, slots, drop, sp });
const RAW = [
    // 1  Santa's Workshop: one ornament at a time, three or four colours, presents
    L('First Polish', 'full', 'clusters', 4, 3, 1, 10),
    L('Tinsel Shelf', 'stripes', 'cols', 5, 3, 1, 10),
    L('Rocking Horse', 'v', 'clusters', 6, 3, 1, 9),
    L('Gift Wrap Station', 'full', 'rows', 5, 4, 1, 9, 'g2'),
    L('Toy Train Track', 'zigzag', 'diag', 7, 4, 1, 9, 'g2'),
    L('Workshop Tree', 'tree', 'rings', 8, 4, 1, 9, 'g3'),
    // 2  Gingerbread Lane: two ornaments to swap between, coal
    L('Gumdrop Alley', 'full', 'clusters', 6, 4, 2, 9, 'c2 g1'),
    L('Icing Rooftops', 'arch', 'rows', 7, 4, 2, 8, 'c3 g2'),
    L('Peppermint Square', 'diamond', 'random', 8, 4, 2, 8, 'c3 g2'),
    L('Cookie Jar', 'columns', 'cols', 7, 4, 2, 8, 'c4 g2'),
    L('Lollipop Lamps', 'bells', 'halves', 8, 4, 2, 8, 'c4 g2'),
    L('Gingerbread Hall', 'full', 'random', 8, 4, 2, 8, 'c5 g3'),
    // 3  Candy Cane Forest: frozen ornaments
    L('Peppermint Path', 'full', 'diag', 6, 4, 2, 8, 'i3 g2'),
    L('Frosted Pines', 'tree', 'clusters', 8, 4, 2, 8, 'i4 c2 g2'),
    L('Sugar Plum Glade', 'heart', 'rings', 9, 5, 2, 8, 'i4 g2'),
    L('Striped Trunks', 'stripes', 'cols', 8, 5, 2, 7, 'i5 c3 g2'),
    L('Minty Hollow', 'wreath', 'random', 10, 5, 2, 7, 'i5 c3 g2'),
    L('Candy Crown', 'v', 'diag', 8, 5, 2, 7, 'i6 c4 g3'),
    // 4  Twinkle Pond: three ornaments in the tray, golden bells
    L('First Skate', 'full', 'clusters', 6, 5, 3, 8, 'b2 i2 g2'),
    L('Moon on the Ice', 'diamond', 'rings', 9, 5, 3, 8, 'b2 i4 g2'),
    L("Skater's Loop", 'wreath', 'random', 10, 5, 3, 7, 'b3 c3 g2'),
    L('Icicle Hut', 'arch', 'rows', 8, 5, 3, 7, 'b3 i5 g2'),
    L('Snowflake Pond', 'star', 'rings', 10, 5, 3, 7, 'b3 i4 c3 g2'),
    L('Frozen Chimes', 'full', 'random', 9, 5, 3, 7, 'b4 i5 c4 g3'),
    // 5  Reindeer Ridge: prism baubles, six colours
    L('Stable Lights', 'full', 'clusters', 7, 5, 3, 7, 'p2 b2 g2'),
    L('Aurora Arch', 'arch', 'diag', 9, 6, 3, 7, 'p2 i4 c3 g2'),
    L('Sleigh Run', 'zigzag', 'rows', 10, 6, 3, 7, 'p3 b3 c3 g2'),
    L('Reindeer Games', 'snowman', 'rings', 10, 6, 3, 7, 'p2 i5 b2 g3'),
    L('Northern Glow', 'heart', 'random', 10, 6, 3, 6, 'p3 i5 c4 g2'),
    L('Ridge Top', 'full', 'clusters', 10, 6, 3, 6, 'p3 i5 c5 b3 g3'),
    // 6  Grimwick's Hoard: everything at once
    L('The Icy Gate', 'columns', 'cols', 10, 6, 3, 7, 'i6 c4 b2 g2 p2'),
    L('Treasure Heaps', 'tree', 'random', 10, 6, 3, 8, 'i6 c5 b3 g3 p2'),
    L('Icicle Chandelier', 'star', 'rings', 10, 6, 3, 7, 'i7 c4 b3 g2 p3'),
    L("The Goblin's Bedroom", 'wreath', 'clusters', 11, 6, 3, 6, 'i7 c6 b3 g3 p2'),
    L('Sack of Sparkles', 'diamond', 'random', 11, 6, 3, 6, 'i8 c6 b4 g3 p3'),
    L("Grimwick's Hoard", 'full', 'random', 11, 6, 3, 6, 'i9 c6 b4 g4 p3'),
];

const SPECIAL_KEYS = { g: 'gift', c: 'coal', i: 'ice', b: 'bell', p: 'prism' };

export const LEVELS = RAW.map((l, i) => {
    const sp = {};
    for (const tok of l.sp.split(/\s+/).filter(Boolean)) sp[SPECIAL_KEYS[tok[0]]] = +tok.slice(1);
    const ch = Math.floor(i / 6);
    return { ...l, id: i + 1, ch, n: (i % 6) + 1, specials: sp, seed: 7919 * (i + 1) + 1031 };
});

/** Power-ups available from presents and the spirit meter on a given level (or in endless: all of them). */
export function unlockedPowers(levelId) {
    if (!levelId) return POWER_IDS.slice();
    const ch = Math.floor((levelId - 1) / 6);
    return CHAPTERS.slice(0, ch + 1).flatMap((c) => c.unlock);
}

// ------------------------------------------------------------------ story
// who: juni | holly | grimwick. vo: the voice clip (audio/vo-*.mp3) that reads the line, if any.
export const STORY = {
    intro: [
        { who: 'holly', vo: 'holly-intro', text: "Juniper, dear! Grimwick's blizzard swept every ornament right out of the workshop windows. Christmas Eve is six nights away. Will you bring them home?" },
        { who: 'juni', vo: 'juni-ready', text: 'Leave it to me, Mrs. Claus! My bauble blaster is polished and ready.' },
    ],
    chapters: [
        [{ who: 'grimwick', vo: 'grim-1', text: "Shiny, shiny, mine, mine! You'll never get them all back, little elf!" },
            { who: 'juni', text: 'Three of a colour and they pop free. Here goes nothing!' }],
        [{ who: 'grimwick', vo: 'grim-2', text: 'I hid them in the gingerbread! And I left you some coal. Hee hee!' },
            { who: 'juni', text: "Coal never matches... but if I knock out what it hangs from, down it comes. And now I can juggle two ornaments!" }],
        [{ who: 'grimwick', vo: 'grim-3', text: 'Brrr! I froze the best ones solid. Good luck thawing those!' },
            { who: 'juni', text: 'A good knock or a pop right next to the ice should crack it open.' }],
        [{ who: 'grimwick', vo: 'grim-4', text: "Bells! Ringing, jingling bells! Even I can't resist them!" },
            { who: 'juni', text: 'Three ornaments in my tray now. Tap one to load it!' }],
        [{ who: 'grimwick', vo: 'grim-5', text: "Why do you even want them so badly? They're just... shiny." },
            { who: 'juni', text: "They're not just shiny, Grimwick. Every one of them is somebody's memory." }],
        [{ who: 'grimwick', vo: 'grim-6', text: "This is MY hoard! My very own sparkles... the only ones I've ever had." },
            { who: 'juni', text: "Then let's settle this, Grimwick. One last board." }],
    ],
    ending: [
        { who: 'juni', vo: 'juni-gently', text: "Grimwick... you just wanted a tree of your own, didn't you?" },
        { who: 'grimwick', vo: 'grim-7', text: '...Maybe. Just a little one.' },
        { who: 'holly', vo: 'holly-end', text: 'Then he shall have one. Merry Christmas, everyone!' },
        { who: 'juni', vo: 'juni-merry', text: 'Every last ornament, home where it belongs. Merry Christmas!' },
    ],
    endless: { who: 'grimwick', vo: 'grim-8', text: 'Snow, snow, and MORE snow! How long can you last?' },
};
export const CAST = {
    juni: { name: 'Juniper', portrait: 'por-juni' },
    holly: { name: 'Mrs. Claus', portrait: 'por-holly' },
    grimwick: { name: 'Grimwick', portrait: 'por-grimwick' },
};
