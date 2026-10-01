/**
 * worlds.js — the ten worlds of the Deep: generation knobs, the look keys the
 * view reads, bestiaries, and every authored line of the story.
 */

export const FLOORS_PER_WORLD = 10;
export const WORLD_COUNT = 10;
export const LAST_FLOOR = FLOORS_PER_WORLD * WORLD_COUNT;

export const worldOf = (floor) => Math.min(WORLD_COUNT, Math.floor((floor - 1) / FLOORS_PER_WORLD) + 1);
export const isBossFloor = (floor) => floor % FLOORS_PER_WORLD === 0;
export const floorInWorld = (floor) => ((floor - 1) % FLOORS_PER_WORLD) + 1;

/**
 * gen:    generator weights (rooms / caves / halls / mixed)
 * liquid: the main liquid pools; deep: deep liquid/chasm feature; moss: carpet chance
 * props:  blocking furniture kinds the view knows how to build
 * deco:   non-blocking floor decor kinds
 * glow:   static light decor (lights the area around it)
 * look:   keys for the view (texture styles, colours, particles, music)
 */
export const WORLDS = [
    null,
    {
        id: 1, name: 'The Rootcellars', short: 'Rootcellars',
        gen: { rooms: 5, caves: 2, mixed: 2 },
        liquid: 'shallow', deep: null, moss: 0.25, torches: 0.9, braziers: 2,
        props: ['barrel', 'crate', 'shelf'], deco: ['roots', 'bones', 'sack'], glow: null,
        bestiary: ['rat', 'beetle', 'grub', 'kobold', 'slime', 'moth', 'burrower'],
        look: {
            floor: 'dirt', wall: 'earth', fog: 0x0b0806, bg: 0x050302,
            amb: 0x6b5a48, ambI: 0.55, light: 0xffb060, torch: 0xff8a3a, accent: 0xc89a5a,
            particles: 'dust', liquid: 0x3a4a3a,
        },
        music: { mode: 'dorian', root: 50, bpm: 84 },
        chapter: 'I. Under Lastlight',
        intro: 'The first stairs are old friends: the cellars of Lastlight, where the town kept its apples and its secrets. Roots from the orchard above have pushed through the vaults. Something has been eating the roots. Something has been eating everything.',
        page: 'Day 1. The cellars are louder than they should be. The rats have a king again — I heard them singing his name through the walls. If you are reading this, little wick, you were never good at staying home. Keep the lamp low and your feet quiet.',
        warden: { id: 'gnawbone', name: 'Gnawbone, the Rat King', title: 'Warden of the Rootcellars',
            intro: 'A hundred tails knotted into one crown, a hundred mouths that speak with one voice: "THE LIGHT TASTES OF APPLES. WE ATE IT ALL."',
            defeat: 'The knot loosens. The rats scatter into the walls, each one small again, each one only hungry. In the middle of the nest something glows: the first Ember.' },
    },
    {
        id: 2, name: 'Mirelight Grotto', short: 'Grotto',
        gen: { caves: 6, mixed: 2, rooms: 1 },
        liquid: 'shallow', deep: 'deep', moss: 0.45, torches: 0.15, braziers: 1,
        props: ['bigshroom', 'stalagmite'], deco: ['shrooms', 'spores', 'pebbles'], glow: 'glowshroom',
        bestiary: ['puffball', 'mushman', 'toad', 'glowmoth', 'leech', 'sporeling', 'myconid'],
        look: {
            floor: 'mud', wall: 'cave', fog: 0x04100c, bg: 0x020806,
            amb: 0x3a7a6a, ambI: 0.5, light: 0x9affd8, torch: 0x5affc0, accent: 0x6affd0,
            particles: 'spores', liquid: 0x1a6a5a,
        },
        music: { mode: 'phrygian', root: 52, bpm: 76 },
        chapter: 'II. The Glowing Dark',
        intro: 'Below the cellars the stone opens into a grotto where the dark has learned to glow on its own. Fungus lights the pools in blues and greens. It is beautiful. It is also breathing.',
        page: 'Day 6. The grotto makes its own light, and it is not kind light. Do not breathe near the puffballs. I lost two days to a spore-dream in which you were small again and asking me why the lamps never go out. They are going out, love. That is why I came.',
        warden: { id: 'mycel', name: 'Mother Mycel', title: 'Warden of the Grotto',
            intro: 'The cavern wall unfolds into a body of gills and caps. "Little lamp. Lie down in the soft dark. I will grow you into something that never needs to see again."',
            defeat: 'The great cap sags and the glow drains out of the grotto, all at once, like a held breath released. Under her roots, the second Ember.' },
    },
    {
        id: 3, name: 'The Drowned Library', short: 'Library',
        gen: { halls: 6, rooms: 3 },
        liquid: 'shallow', deep: 'deep', moss: 0.0, torches: 0.6, braziers: 3,
        props: ['bookshelf', 'lectern', 'bookpile'], deco: ['pages', 'books', 'puddle'], glow: 'candles',
        bestiary: ['tome', 'inkwraith', 'scholar', 'eel', 'papergolem', 'quillimp', 'librarian'],
        look: {
            floor: 'tiles', wall: 'shelves', fog: 0x060a14, bg: 0x02040a,
            amb: 0x5a6a9a, ambI: 0.55, light: 0xffe0a0, torch: 0xffd070, accent: 0x7aa8ff,
            particles: 'pages', liquid: 0x10284a,
        },
        music: { mode: 'minor', root: 55, bpm: 72 },
        chapter: 'III. Every Book Is Wet',
        intro: 'Someone built a library at the bottom of the world, to remember the things the surface wanted to forget. Then the water came in. The books still whisper, swollen and illegible. Something still shelves them.',
        page: 'Day 11. The Archivist was a friend of the Keeper before mine. He wrote down everything the dark ever said, to understand it. I think it understood him first. If he asks your name, lie.',
        warden: { id: 'archivist', name: 'The Archivist', title: 'Warden of the Library',
            intro: 'A tall shape in a coat of wet pages turns from its desk. "Ah. A new entry. Name, purpose, expected date of extinguishment?"',
            defeat: '"Catalogue... incomplete..." The pages of his coat fall away one by one until only a small warm light is left on the desk where he sat: the third Ember.' },
    },
    {
        id: 4, name: 'The Ember Forge', short: 'Forge',
        gen: { rooms: 4, mixed: 3, halls: 2 },
        liquid: 'lava', deep: 'lava', moss: 0.0, torches: 0.5, braziers: 2,
        props: ['anvil', 'forge', 'ore'], deco: ['coals', 'chains', 'slag'], glow: 'coals',
        bestiary: ['imp', 'magmaslug', 'forgegolem', 'salamander', 'cinderbat', 'smith', 'firehound'],
        look: {
            floor: 'basalt', wall: 'forgebrick', fog: 0x140604, bg: 0x080202,
            amb: 0x8a4a3a, ambI: 0.5, light: 0xffa060, torch: 0xff7020, accent: 0xff6a20,
            particles: 'embers', liquid: 0xff5010,
        },
        music: { mode: 'harmonic', root: 45, bpm: 96 },
        chapter: 'IV. Hammer and Cinder',
        intro: 'The dwarves of the Deep dug down to be nearer the Lantern\'s warmth, and built a forge on its heat. The anvils still ring. No one living is swinging the hammers.',
        page: 'Day 17. Brann made my lantern, and yours. He swore he would never let the forge go cold. He kept his word. He is still at the anvil — he simply forgot to stop when he died. Be gentle with him if you can. You will not be able to.',
        warden: { id: 'brann', name: 'Forgemaster Brann', title: 'Warden of the Forge',
            intro: 'Armour welded seam to seam, a hammer the size of a door. A voice like a bellows: "THAT LAMP. I KNOW THAT LAMP. GIVE IT HERE, IT NEEDS RE-TEMPERING."',
            defeat: 'The hammer falls one last time, on nothing, and stays there. Inside the cooling armour a single coal is still lit: the fourth Ember. "Good lamp," the bellows sigh. "Good work."' },
    },
    {
        id: 5, name: 'Crystal Hollows', short: 'Hollows',
        gen: { caves: 5, mixed: 3 },
        liquid: 'shallow', deep: 'chasm', moss: 0.0, torches: 0.0, braziers: 1,
        props: ['crystal', 'geode'], deco: ['shards', 'pebbles', 'gems'], glow: 'crystal',
        bestiary: ['crystalspider', 'shardling', 'prismwisp', 'geodecrab', 'glassbat', 'facet', 'lumenmite'],
        look: {
            floor: 'crystalfloor', wall: 'crystal', fog: 0x0a0618, bg: 0x04020a,
            amb: 0x7a6aca, ambI: 0.6, light: 0xd0b0ff, torch: 0xb080ff, accent: 0xc8a0ff,
            particles: 'sparkles', liquid: 0x6a4aca,
        },
        music: { mode: 'major', root: 57, bpm: 80 },
        chapter: 'V. The Bent Light',
        intro: 'Halfway down, the Deep turns to crystal. Your lantern\'s light comes back to you from a thousand faces, split into colours, wandering off down passages you have not taken.',
        page: 'Day 24. Halfway. The crystals drink light and keep it, which is why the Hollows shine. Something larger has been drinking from them. I can see the Lantern from here, a little star far below. It is so much dimmer than it should be.',
        warden: { id: 'wyrm', name: 'The Prism Wyrm', title: 'Warden of the Hollows',
            intro: 'Glass scales, glass wings, and inside them every colour of light the Hollows ever held. It looks at your lantern the way the hungry look at bread.',
            defeat: 'The Wyrm cracks along a thousand facets and every stolen colour spills out of it at once, washing the hollows in rainbow. One light does not scatter: the fifth Ember.' },
    },
    {
        id: 6, name: 'The Ossuary', short: 'Ossuary',
        gen: { halls: 5, rooms: 4 },
        liquid: null, deep: 'chasm', moss: 0.0, torches: 0.5, braziers: 3,
        props: ['sarcophagus', 'urn', 'bonepile'], deco: ['bones', 'skulls', 'candles'], glow: 'candles',
        bestiary: ['skeleton', 'ghoul', 'banshee', 'bonearcher', 'necromancer', 'cryptbat', 'bonehulk'],
        look: {
            floor: 'flagstone', wall: 'skullwall', fog: 0x0a0a0a, bg: 0x040404,
            amb: 0x8a8a7a, ambI: 0.45, light: 0xfff0c0, torch: 0xffe0a0, accent: 0xe8e0c0,
            particles: 'ash', liquid: 0x202020,
        },
        music: { mode: 'harmonic', root: 50, bpm: 66 },
        chapter: 'VI. The Names of the Dead',
        intro: 'Every Keeper who ever tended the Lantern is buried here, and everyone who came down after them and did not go back up. Candles burn in the niches. Someone is still lighting them.',
        page: 'Day 30. I understand now. The Hush is not something that came from outside. Every light throws a shadow, and the Lantern is the brightest light there ever was. Its shadow has been growing as long as it has burned. Vesper knew. She has been singing to keep it asleep.',
        warden: { id: 'vesper', name: 'Lady Vesper', title: 'Warden of the Ossuary',
            intro: 'A queen in a gown of finger-bones, a voice like a choir in an empty church. "Hush now. Hush. Say your name, so I can sing it with the others."',
            defeat: 'Her song stops mid-name. The candles in every niche go out together, and then, one by one, light again by themselves. In her open hands: the sixth Ember.' },
    },
    {
        id: 7, name: 'Clockwork Depths', short: 'Clockwork',
        gen: { halls: 4, rooms: 4, mixed: 1 },
        liquid: null, deep: 'chasm', moss: 0.0, torches: 0.7, braziers: 2,
        props: ['gearstack', 'pipes', 'boiler'], deco: ['cogs', 'bolts', 'grate'], glow: 'lamp',
        bestiary: ['clocksoldier', 'drone', 'sentry', 'gearhound', 'tinker', 'steamgolem', 'springjack'],
        look: {
            floor: 'brassplate', wall: 'brass', fog: 0x0c0a04, bg: 0x060402,
            amb: 0x9a8050, ambI: 0.55, light: 0xffd890, torch: 0xffc060, accent: 0xffc860,
            particles: 'steam', liquid: 0x302818,
        },
        music: { mode: 'mixolydian', root: 53, bpm: 108 },
        chapter: 'VII. The Measure of Night',
        intro: 'Ages ago someone built a machine to measure the dark — how deep, how fast it grows, when it will win. The machine is still counting. Every gear in these halls is turning toward one number.',
        page: 'Day 37. The Orrery keeps the date of the last sunrise. It has been counting down since the first Keeper. By its reckoning we have about a year left. By mine, less. Wind your watch, love. Every hour counts down here.',
        warden: { id: 'orrery', name: 'The Grand Orrery', title: 'Warden of the Depths',
            intro: 'Brass planets on brass arms, wheeling around a dead sun. A voice of ticking: "CALCULATION: YOU ARRIVE LATE. PROBABILITY OF DAWN: ZERO. RECALCULATING TO CONFIRM."',
            defeat: 'The arms slow. The planets stop. "RECALCULATING... PROBABILITY OF DAWN: NOT ZERO." The dead sun at its centre opens like a locket around the seventh Ember.' },
    },
    {
        id: 8, name: 'Frostveil Abyss', short: 'Abyss',
        gen: { caves: 5, mixed: 2, rooms: 2 },
        liquid: 'ice', deep: 'chasm', moss: 0.0, torches: 0.2, braziers: 2,
        props: ['icespike', 'frozenstatue'], deco: ['snow', 'icicles', 'pebbles'], glow: 'aurora',
        bestiary: ['icewraith', 'frosttroll', 'snowwolf', 'iceelemental', 'rimebat', 'yeti', 'frostmage'],
        look: {
            floor: 'ice', wall: 'iceWall', fog: 0x060c14, bg: 0x02060a,
            amb: 0x7aa0d0, ambI: 0.42, light: 0xd8f0ff, torch: 0x9ad8ff, accent: 0x9ae0ff,
            particles: 'snow', liquid: 0xa0d8ff,
        },
        music: { mode: 'dorian', root: 54, bpm: 70 },
        chapter: 'VIII. The Court That Would Not Change',
        intro: 'The warmth of the Lantern never reached this far down, or else it was taken. The Abyss is frozen in the middle of a moment: waterfalls stopped in the air, courtiers frozen mid-bow.',
        page: 'Day 45. Isolde froze her whole court so that nothing would ever be lost again. I almost understand it. I am so tired, and the cold is very kind about it. Keep walking. Whatever she offers you, keep walking.',
        warden: { id: 'isolde', name: 'Queen Isolde of the Rime', title: 'Warden of the Abyss',
            intro: 'A queen on a throne of black ice, perfectly still, perfectly beautiful. "Stay. Stop. Nothing will hurt here, because nothing will happen here. Isn\'t that what you wanted?"',
            defeat: 'The ice of her throne cracks, and for a moment she moves like a living woman, and sighs, and is gone. Frozen in her crown: the eighth Ember, still warm.' },
    },
    {
        id: 9, name: 'The Starfall Vault', short: 'Vault',
        gen: { mixed: 4, rooms: 3, caves: 2 },
        liquid: null, deep: 'chasm', moss: 0.0, torches: 0.3, braziers: 2,
        props: ['monolith', 'orb'], deco: ['stardust', 'runes', 'pebbles'], glow: 'starstone',
        bestiary: ['voidstalker', 'starjelly', 'sentinel', 'gazer', 'riftimp', 'nebula', 'starseer'],
        look: {
            floor: 'starstone', wall: 'voidrock', fog: 0x06040c, bg: 0x010006,
            amb: 0x6a5aaa, ambI: 0.5, light: 0xc0d0ff, torch: 0x9a8aff, accent: 0xb0a0ff,
            particles: 'stars', liquid: 0x2a1a5a,
        },
        music: { mode: 'lydian', root: 56, bpm: 64 },
        chapter: 'IX. Under the Deep',
        intro: 'The stairs go down past the bottom of the world. Ruins hang in a sky full of stars that are not stars. Look too long into the gaps between them and something looks back.',
        page: 'Day 52. There is something under the Deep. The Watcher has seen it, and it has driven him to keep his eye open forever. I won\'t tell you what it is. I will tell you it is not unkind, only very, very old. Almost there now.',
        warden: { id: 'watcher', name: 'The Watcher Between', title: 'Warden of the Vault',
            intro: 'An eye as wide as a room opens in the void. It has no voice, but you understand it anyway: I HAVE SEEN WHAT IS UNDER EVERYTHING. NOW YOU WILL SEE IT TOO.',
            defeat: 'The great eye closes, slowly, gratefully, like someone finally allowed to sleep. Where its pupil was: the ninth Ember.' },
    },
    {
        id: 10, name: 'The Heart of Night', short: 'Heart',
        gen: { mixed: 3, rooms: 3, caves: 3 },
        liquid: null, deep: 'chasm', moss: 0.0, torches: 0.25, braziers: 3,
        props: ['obelisk', 'cage'], deco: ['blackflame', 'ash', 'runes'], glow: 'blackfire',
        bestiary: ['shade', 'hushknight', 'nightmare', 'hollowed', 'duskweaver', 'gloom', 'lampeater'],
        look: {
            floor: 'obsidian', wall: 'obsidianWall', fog: 0x040206, bg: 0x000000,
            amb: 0x5a4a6a, ambI: 0.4, light: 0xffd8a0, torch: 0xa070ff, accent: 0xffe0a0,
            particles: 'ash', liquid: 0x0a0010,
        },
        music: { mode: 'phrygian', root: 47, bpm: 60 },
        chapter: 'X. The First Lantern',
        intro: 'The last stairs. The walls are glass-black and the fires here burn dark. Far below, in an iron cage the size of a cathedral, the First Lantern flickers — and in its light, a figure you would know anywhere.',
        page: 'Day 58. I have reached the cage. The Lantern needs a wick to burn, and the old wick is spent, so I have become it. Do not grieve. If you have all my pages you know what I learned too late: ten Embers are a light of their own. Bring them home. Bring them to me.',
        warden: { id: 'hush', name: 'The Hush', title: 'The Shadow of the Lantern',
            intro: 'The dark in front of the cage stands up, and it is wearing Maren\'s face. "There you are, little wick," it says, in her voice. "Put the lamp down. It is so heavy. Let me carry it for you."',
            defeat: 'The Hush comes apart like smoke in a draught, and where it stood there is only your own shadow, ordinary and small, thrown by the light of the Lantern behind you.' },
    },
];

export const PROLOGUE = [
    'Lastlight sits on the rim of the Deep, a shaft that falls through ten buried worlds. At the bottom hangs the First Lantern. Its light, rising up the shaft, is the only thing that keeps the Hush from climbing out.',
    'A year ago the Lantern began to gutter. Maren — the town\'s Keeper, your teacher, the closest thing you have to family — went down to tend it, and did not come back.',
    'Tonight the lamps of Lastlight went out one street at a time. You took the spare lantern from her workshop. One hundred stairs. One flask of oil. Go.',
];

export const ENDINGS = {
    vigil: {
        title: 'The Keeper\'s Vigil',
        text: [
            'You open the cage and take Maren\'s place at the heart of the Lantern. It does not hurt. It feels like being a candle in a window, waiting for someone.',
            'Maren climbs the Hundred Stairs alone, slowly, stopping at each world to leave a light. When she reaches Lastlight the lamps are burning again, every street.',
            'Every year on the longest night she comes down to sit with you a while. You burn. She tells you the news from the surface. It is enough.',
        ],
    },
    rest: {
        title: 'Maren\'s Rest',
        text: [
            '"Go home," Maren says, and she means it in the voice she used when you were small and it was late. "Someone has to tell them it worked."',
            'You climb. It takes a long time. Behind you the Lantern burns steady and warm, and you do not look back, because she asked you not to.',
            'Lastlight\'s lamps are burning when you reach the top. You become its Keeper. You keep a chair by the fire that nobody sits in.',
        ],
    },
    dawn: {
        title: 'The Long Dawn',
        text: [
            'You remember her pages. Ten Embers are a light of their own. One by one you set them into the cage, and the First Lantern takes them, and blazes — brighter than it has ever burned, needing no wick at all.',
            'Maren steps out of the light, blinking, and laughs at you for being so tall. You climb the Hundred Stairs together, and the shadows that the new light throws are short ones.',
            'When you come out at the top of the Deep the sky over Lastlight is turning grey, then gold. It is the first sunrise in a year. The whole town is in the street to see it.',
        ],
    },
};

/** Templated lines for wayfarers (quest-givers), keyed by kind. {target} etc are filled in. */
export const WAYFARER_NAMES = [
    'Odda', 'Penn', 'Corwin', 'Ilse', 'Tamsin', 'Garrick', 'Wren', 'Bastian', 'Mirela', 'Hob', 'Sabel',
    'Fenn', 'Rook', 'Agathe', 'Lio', 'Morrow', 'Juna', 'Edric', 'Petra', 'Silas', 'Yarrow', 'Dov',
];
export const WAYFARER_TITLES = ['delver', 'lamplighter', 'cartographer', 'pilgrim', 'treasure-hunter', 'scholar', 'tinker', 'oil-trader', 'lost apprentice', 'grave-singer'];
