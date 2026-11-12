// TITAN'S VAULT: the places, the story, the people in town and the lore tablets. Pure data.
//
// gen: 'town' (hand-laid), 'wilds' (cellular caves with clearings), 'rooms' (rooms and corridors).
// lvl: monster level at the entrance and at the far end. density: packs per 100 floor cells.

export const AREAS = {
    town: {
        name: 'Lantern\'s Rest', act: 0, gen: 'town', lvl: [1, 1], music: 'town', tex: 'town',
        fog: 0x2a2030, sky: 0x1a1420, light: 0xffc890, ambient: 0x8a7aa0,
        blurb: 'The last lit town on the road to the Vault. Wardens rest here; traders follow the wardens.',
    },
    wilds: {
        name: 'The Drowned Wilds', act: 1, gen: 'wilds', w: 64, h: 64, lvl: [1, 5], density: 2.2, next: 'temple',
        music: 'act1', tex: 'wilds', fog: 0x2a3a34, sky: 0x203028, light: 0xd8f0d0, ambient: 0x6a8a7a,
        blurb: 'Marsh, reeds and broken colonnades where the sea came inland and never left.',
    },
    temple: {
        name: 'Temple of the Tide-Eye', act: 1, gen: 'rooms', w: 60, h: 60, lvl: [5, 8], density: 2.6, boss: 'skyllith',
        next: 'necropolis', music: 'act1', tex: 'temple', fog: 0x183038, sky: 0x10202a, light: 0x9ae0ff, ambient: 0x4a7a8a,
        blurb: 'A sunken shrine to a sea-god who died. Something else answers the prayers now.',
    },
    necropolis: {
        name: 'The Ashen Necropolis', act: 2, gen: 'rooms', w: 64, h: 64, lvl: [9, 13], density: 2.6, next: 'ossuary',
        music: 'act2', tex: 'crypt', fog: 0x24202a, sky: 0x141018, light: 0xc8b0ff, ambient: 0x5a4a6a,
        blurb: 'A city of tombs for the wardens who fell before you. Not all of them stayed down.',
    },
    ossuary: {
        name: 'The Ossuary Depths', act: 2, gen: 'rooms', w: 60, h: 60, lvl: [13, 17], density: 2.8, boss: 'morwen',
        next: 'halls', music: 'act2', tex: 'crypt', fog: 0x1a1220, sky: 0x0e0a12, light: 0xb090ff, ambient: 0x4a3a5a,
        blurb: 'Bone stacked on bone, ordered by a queen who never stopped counting.',
    },
    halls: {
        name: 'The Bronze Halls', act: 3, gen: 'rooms', w: 66, h: 66, lvl: [18, 22], density: 2.8, next: 'vault',
        music: 'act3', tex: 'vault', fog: 0x2a1a10, sky: 0x180e08, light: 0xffb070, ambient: 0x7a5a40,
        blurb: 'The forge-halls the gods built to hold a titan. The furnaces never went out.',
    },
    vault: {
        name: 'The Titan\'s Vault', act: 3, gen: 'rooms', w: 60, h: 60, lvl: [22, 26], density: 3.0, boss: 'kolossar',
        next: 'town', music: 'act3', tex: 'vault', fog: 0x301008, sky: 0x1a0804, light: 0xff8040, ambient: 0x8a4a30,
        blurb: 'The chains are here. So is the thing they hold.',
    },
    rift: {
        name: 'Vault Rift', act: 4, gen: 'rift', w: 58, h: 58, lvl: [26, 26], density: 3.4, music: 'rift', tex: 'rift',
        fog: 0x200a30, sky: 0x10051a, light: 0xd890ff, ambient: 0x6a3a8a,
        blurb: 'A crack in the Vault\'s walls into somewhere that is all of the places at once.',
    },
};

export const CAMPAIGN = ['wilds', 'temple', 'necropolis', 'ossuary', 'halls', 'vault'];

/** Story cards: shown full-screen with fal art and the narrator's voice. id → { title, text, art }. */
export const CARDS = {
    intro: {
        title: 'The Chains Are Rusting',
        text: 'Before the gods left, they chained the Titans beneath the world and set wardens to watch them. The gods are gone now. The wardens are few. And under the mountain, something has begun to pull at its chains.',
        art: 'a vast dark cavern with an enormous chained stone titan silhouette in the background, glowing magma cracks, a lone warden with a lantern on a ledge in the foreground',
    },
    act1: {
        title: 'Act I: The Drowned Wilds',
        text: 'The road to the Vault runs through the marsh where the sea-god\'s temple sank. The Tide-Key lies in the temple, and the temple has a new master.',
        art: 'a misty teal marsh with half-sunken white marble colonnades and reeds, a ruined temple dome on the horizon, eerie green light',
    },
    act2: {
        title: 'Act II: The Ashen Necropolis',
        text: 'With the Tide-Key you can open the Necropolis, where every warden who ever fell was laid to rest. Their Queen did not let them rest. She is forging a key from their souls.',
        art: 'a vast city of tombs and mausoleums under a violet night sky, ash falling like snow, ghostly lights in the windows',
    },
    act3: {
        title: 'Act III: The Titan\'s Vault',
        text: 'Two keys. One door. Behind it the Bronze Halls, the furnaces that forged the chains, and at the bottom, Kolossar, who has been awake for ten thousand years.',
        art: 'enormous bronze gates in a mountain wall, glowing orange furnace light spilling out, giant chains running into the dark',
    },
    victory: {
        title: 'The Chains Hold',
        text: 'You bound Kolossar again with his own broken chains. But the fight cracked the Vault\'s walls, and through the cracks you can see other places: rifts into everywhere the titans ever touched. The Vault will need watching. It will need you.',
        art: 'a warden standing before a defeated chained stone titan, golden chains glowing, violet cracks in the walls opening onto starry rift dimensions',
    },
    rifts: {
        title: 'The Vault Rifts',
        text: 'Each rift is deeper than the last, and there is no last one. Fill the rift\'s hunger, slay its guardian, and go deeper.',
        art: 'a swirling violet-and-gold dimensional rift portal in a cracked bronze wall, fragments of marsh, crypt and forge floating inside',
    },
};

/** Lore tablets: environmental storytelling, a few per area, placed by the seed. */
export const LORE = {
    wilds: [
        { title: 'A warden\'s note, soaked', text: 'The water rose in a night. Not a storm: the sea simply walked in. Tomas says the temple bells rang under the water for three days.' },
        { title: 'Carved on a broken column', text: 'TO THE TIDE-EYE, WHO SEES ALL THAT SINKS. (Someone has scratched beneath: "it saw us.")' },
        { title: 'A satyr\'s tally', text: 'Scratched marks, hundreds of them, and a crude drawing of a warden with a cross through it.' },
    ],
    temple: [
        { title: 'The high priestess\'s last entry', text: 'The god is dead. I know it as I know my own name. But the prayers are still being answered, and the answers have teeth.' },
        { title: 'Mosaic, half-drowned', text: 'Three keys: one of tide, one of soul, one of flame. Together they open the Vault, or seal it forever.' },
    ],
    necropolis: [
        { title: 'Epitaph', text: 'HERE LIES WARDEN ALDA, WHO HELD THE BRIDGE. (The tomb is empty.)' },
        { title: 'A gravedigger\'s complaint', text: 'Third time this month I\'ve buried old Corvin. He keeps getting up. The Queen says it\'s an honour.' },
        { title: 'Royal decree, in bone-ink', text: 'Every warden who falls belongs to the Court. Every soul is a link. Every link a key.' },
    ],
    ossuary: [
        { title: 'Counting stones', text: 'Rows of stones, each with a tally. The last row ends mid-count, at nine thousand and four.' },
        { title: 'Morwen\'s diary', text: 'I was a warden once. I held the Vault for sixty years. Then I listened to him. He is very patient, and very kind, and he promised the dead would never have to sleep.' },
    ],
    halls: [
        { title: 'Forge-master\'s plaque', text: 'THESE FIRES SHALL NOT GO OUT WHILE THE TITAN BREATHES. (They have not.)' },
        { title: 'A sentinel\'s order-stone', text: 'GUARD. GUARD. GUARD. GUARD. (The same word ten thousand times, worn smooth.)' },
        { title: 'Scorched letter', text: 'If you are reading this, the chains are weakening. Do not try to kill him. You cannot kill a titan. Bind him. Use the chains themselves.' },
    ],
    vault: [
        { title: 'Chain-link, large as a cart', text: 'Every link is stamped with the name of a god. Most of the names have been scratched out from the inside.' },
        { title: 'Graffiti, fresh', text: 'THE UNBOUND WILL RISE. (In another hand, older: no, they won\'t.)' },
    ],
    rift: [],
};

/** Town people: id → who, where (town grid), what they do. */
export const NPCS = {
    ysolde: { name: 'Ysolde', role: 'merchant', model: 'npc-ysolde', x: 13, y: 9,
        art: 'a cheerful plump middle-aged merchant woman with a red headscarf, gold earrings, a leather apron full of pouches and a big brass scale',
        lines: ['Coin for your trinkets, Warden? I pay fair, mostly.', 'Three gems of a kind and I can make you a better one.', 'Back again! The Vault is good for business.'] },
    heron: { name: 'Old Heron', role: 'chronicler', model: 'npc-heron', x: 22, y: 10,
        art: 'a tall thin very old bearded man chronicler in long grey robes with ink-stained fingers, a heron-feather in his hat, holding a big book',
        lines: ['Every warden\'s story ends in my book. Let us make yours a long one.', 'The rifts never close. That is what wardens are for.'] },
};

/** Town points of interest (grid cells in the town map). */
export const TOWN = {
    w: 36, h: 28, spawn: [18, 18],
    waystone: [18, 14], stash: [9, 12], obelisk: [27, 18], gate: [18, 3], shrine: [10, 9],
};

/** What the Chronicler (and the Hint button) says is next, by campaign progress. */
export const QUESTS = [
    { id: 'q1', area: 'wilds', text: 'Cross the Drowned Wilds to the Temple of the Tide-Eye.' },
    { id: 'q2', area: 'temple', text: 'Find Skyllith in the drowned temple and take the Tide-Key.' },
    { id: 'q3', area: 'necropolis', text: 'Open the Ashen Necropolis and find the way down to the Ossuary.' },
    { id: 'q4', area: 'ossuary', text: 'End Morwen, the Ossuary Queen, and free the wardens\' souls.' },
    { id: 'q5', area: 'halls', text: 'Pass through the Bronze Halls to the Vault.' },
    { id: 'q6', area: 'vault', text: 'Bind Kolossar, the Chained Titan.' },
    { id: 'q7', area: 'rift', text: 'The Vault Rifts are open. Go as deep as you dare.' },
];

/** Rift modifiers: one or two per rift, from the seed. */
export const RIFT_MODS = {
    swarming: { name: 'Swarming', text: '+40% more monsters', density: 1.4 },
    brutal: { name: 'Brutal', text: 'Monsters deal 25% more damage', dmg: 1.25 },
    hardy: { name: 'Hardy', text: 'Monsters have 30% more life', hp: 1.3 },
    elite: { name: 'Elite', text: 'Twice as many elite packs', elite: 2 },
    bountiful: { name: 'Bountiful', text: '+50% magic find', mf: 50 },
    hasty: { name: 'Hasty', text: 'Monsters move 20% faster', speed: 1.2 },
};
