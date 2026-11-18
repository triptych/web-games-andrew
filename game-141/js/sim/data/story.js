// Names, lines and the order things are said in. Every line has an id so a voice clip can be matched to it
// (audio/vo-<id>.mp3). who: sela (you), quill (the clockwork owl), zahra (the merchant).

export const FLOORS = [
    null,
    { name: 'The Antechamber Dunes' },
    { name: "The Porters' Hall" },
    { name: 'The Glyph Galleries' },
    { name: 'Vault of the Sun', treasure: true },
    { name: 'The Conduit Works' },
    { name: "The Scribes' Rest" },
    { name: 'The Cobra Court' },
    { name: "Queen Ishet's Treasury", treasure: true },
    { name: 'The Lamp Cloisters' },
    { name: 'The Obsidian Deep' },
    { name: 'The Observatory Well' },
    { name: 'The Phoenix Reliquary', treasure: true },
    { name: 'The Singing Caverns' },
    { name: 'The Jackal Gate' },
    { name: "The High Priests' Stair" },
    { name: 'The Heart Chamber', treasure: true },
];
export const floorName = (n) => (FLOORS[n] ? FLOORS[n].name : `The Echo Deeps, level ${n - 16}`);

export const LINES = {
    intro:      { who: 'quill', text: 'Sela! The whole tower is down there, sunk to its crown in sand. Tap a block next to the open floor to dig it out.' },
    intro2:     { who: 'sela',  text: 'Then let\'s see what the desert has been keeping.' },
    numbers:    { who: 'quill', text: 'See the glowing number? It counts the traps and monsters hidden in the eight blocks around that tile.' },
    mark:       { who: 'quill', text: 'Sure something nasty is in a block? Mark it first (right-click, long-press or the flag button). A marked trap is disarmed safely, and a marked monster is ambushed.' },
    falseAlarm: { who: 'quill', text: 'A false alarm costs a little stamina. Careful is good. Too careful is tiring.' },
    trap:       { who: 'sela',  text: 'Ow! Note to self: read the numbers.' },
    monster:    { who: 'quill', text: 'A tomb creature! Tap it to fight. It hits back after every strike you make, anywhere on the floor.' },
    disarm:     { who: 'sela',  text: 'Disarmed. Not today, little trap.' },
    rune:       { who: 'quill', text: 'Rune blocks! Strike them in the order of their numerals, one to the last. A wrong one resets them all.' },
    runeHidden: { who: 'quill', text: 'These runes hide their numerals. Good thing you have the Glyph Tablet: it reads them for you.' },
    door:       { who: 'quill', text: 'A bronze door. There will be a key somewhere on this floor.' },
    conduit:    { who: 'quill', text: 'A sun pedestal and golden channels! Tap the channels to turn them until light runs from the pedestal to the sun panel.' },
    noLens:     { who: 'quill', text: 'The pedestal is empty. We need something that holds sunlight.' },
    chest:      { who: 'quill', text: 'A rune-locked chest. Each rune you press flips itself and its two neighbours. Light all five.' },
    artifact:   { who: 'sela',  text: 'Oh, look at you. Straight to the museum.' },
    clear:      { who: 'quill', text: 'Floor cleared! The hatch is open. Down we go when you are ready.' },
    exhausted:  { who: 'quill', text: 'You are out of stamina. Back up the rope to camp; the floor will wait for you.' },
    faint:      { who: 'quill', text: 'You fainted! The camel-drivers hauled you up, for a fee. Nothing is lost down there.' },
    revive:     { who: 'sela',  text: 'Not yet! The feather burns, and I am back on my feet.' },
    levelup:    { who: 'quill', text: 'Level up! Spend your skill point in the skill tree.' },
    quest:      { who: 'quill', text: 'A quest is complete. Open the quest scroll to claim your gold.' },
    camp:       { who: 'zahra', text: 'Welcome back, little digger. Potions, tonics, charms: Zahra has what the deep takes from you.' },
    buy:        { who: 'zahra', text: 'A fine choice. Mind you come back up to spend more.' },
    boss:       { who: 'quill', text: 'The Sphinx Warden guards the Heart! Mark-ambush it if you can, and keep potions handy.' },
    heart:      { who: 'sela',  text: 'The Heart of the Spire. It is singing. Quill, the whole tower is singing!' },
    ending:     { who: 'quill', text: 'The tower is rising! Sela, you woke it. And there are deeper halls still, if you want them.' },
    deeper:     { who: 'sela',  text: 'Deeper it is.' },
};

/** Said the first time a floor is entered (from floor 2 on). */
export const FLOOR_LINES = {
    3: 'rune', 4: null, 5: 'conduit', 16: 'boss',
};
