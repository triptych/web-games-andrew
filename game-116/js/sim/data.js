// Content tables: suits, layouts, your cards, gadgets, souvenirs, the creature feature and the reels.
// Pure data. Numbers that the rules use live here or in config.js; game-plan.md says what they are for.

export const RANKS = ['★', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const rankName = (r) => RANKS[r] ?? '?';

// The four suits of the alien deck. A table card played onto the beam does what its suit does,
// and does more the longer the chain: c is its place in this turn's chain (1, 2, 3, ...).
export const SUITS = [
    { k: 'ray', name: 'Ray', color: '#d23b2a', text: 'deals 2 + chain damage' },
    { k: 'rocket', name: 'Rocket', color: '#e2861b', text: 'deals 1 + chain damage that ignores shields' },
    { k: 'shield', name: 'Shield', color: '#2b6cc9', text: 'gives 2 + chain block' },
    { k: 'atom', name: 'Atom', color: '#22955a', text: 'gives 1 charge (2 from the 4th card of a chain on)' },
];

// Table layouts, as rows of half-card columns. A card is covered (and face down) while any card in
// the row below sits within one half-column of it. Rows 0 is the top of the table.
export const LAYOUTS = {
    peaks: [[3, 9], [2, 4, 8, 10], [1, 3, 5, 7, 9, 11], [0, 2, 4, 6, 8, 10, 12]],
    saucer: [[5, 7], [4, 6, 8], [1, 3, 5, 7, 9, 11], [0, 2, 4, 6, 8, 10, 12], [5, 7]],
    rocket: [[6], [5, 7], [4, 6, 8], [5, 7], [4, 6, 8], [2, 4, 6, 8, 10]],
    towers: [[1, 6, 11], [0, 2, 5, 7, 10, 12], [1, 6, 11], [0, 2, 5, 7, 10, 12]],
    diamond: [[6], [5, 7], [4, 6, 8], [3, 5, 7, 9], [2, 4, 6, 8, 10], [3, 5, 7, 9], [4, 6, 8]],
    pyramid: [[6], [5, 7], [4, 6, 8], [3, 5, 7, 9], [2, 4, 6, 8, 10], [1, 3, 5, 7, 9, 11], [0, 2, 4, 6, 8, 10, 12]],
};

// ------------------------------------------------------------------ your deck
// Your deck is the stock. A turn starts by turning its top card onto the beam for free; then you have
// DRAWS_PER_TURN draws. A card fires its effect when it lands on the beam, and a Quick card gives
// the draw back. fx: dmg (× hits), block, charge, heal, weak (Dazed turns), strDown, reveal
// (X-ray the table), quick, rayBonus (Rays and Rockets this turn), chainBase (the chain jumps).
export const CARDS = {
    plain: { name: 'Card', rarity: 'starter', text: 'No effect.', upText: 'Quick.', fx: {}, up: { quick: true } },
    death_ray: { name: 'Death Ray', r: 7, rarity: 'common', fx: { dmg: 6 }, up: { dmg: 10 } },
    force_field: { name: 'Force Field', r: 11, rarity: 'common', fx: { block: 7 }, up: { block: 11 } },
    atomic_pile: { name: 'Atomic Pile', r: 5, rarity: 'common', fx: { charge: 2 }, up: { charge: 3 } },
    jet_boots: { name: 'Jet Boots', r: 9, rarity: 'common', fx: { quick: true, block: 3 }, up: { quick: true, block: 7 } },
    ration: { name: 'Space Ration', r: 2, rarity: 'common', fx: { heal: 3 }, up: { heal: 6 } },
    reflector: { name: 'Reflector', r: 8, rarity: 'common', fx: { block: 5, dmg: 5 }, up: { block: 8, dmg: 8 } },
    wild: { name: 'Wild Card', r: 0, wild: true, rarity: 'uncommon', fx: {}, up: { charge: 1 } },
    meteor: { name: 'Meteor Shower', r: 13, rarity: 'uncommon', fx: { dmg: 3, hits: 3 }, up: { dmg: 3, hits: 5 } },
    booster: { name: 'Ray Booster', r: 4, rarity: 'uncommon', fx: { rayBonus: 2 }, up: { rayBonus: 3, quick: true } },
    chain_rx: { name: 'Chain Reaction', r: 6, rarity: 'uncommon', fx: { chainBase: 2 }, up: { chainBase: 4 } },
    radar: { name: 'Radar Dish', r: 3, rarity: 'uncommon', fx: { reveal: true, quick: true }, up: { reveal: true, quick: true, charge: 1 } },
    rocket_fuel: { name: 'Rocket Fuel', r: 12, rarity: 'uncommon', fx: { quick: true, charge: 1 }, up: { quick: true, charge: 2 } },
    hypno: { name: 'Hypno-Spiral', r: 10, rarity: 'uncommon', fx: { weak: 2 }, up: { weak: 3, quick: true } },
    shrink: { name: 'Shrink Ray', r: 1, rarity: 'rare', fx: { strDown: 2, dmg: 4 }, up: { strDown: 3, dmg: 7 } },
    flying_saucer: { name: 'Flying Saucer', r: 0, wild: true, rarity: 'rare', fx: { dmg: 6, quick: true }, up: { dmg: 10, quick: true } },
    // junk the aliens jam into your stock for one fight (or, from an event, for good)
    static: { name: 'Martian Static', r: 0, static: true, junk: true, rarity: 'junk', text: 'Nothing fits on it.', fx: {} },
    slime: { name: 'Space Slime', r: 0, junk: true, rarity: 'junk', fx: { selfDmg: 3 } },
};
export const CARD_POOL = {
    common: ['death_ray', 'force_field', 'atomic_pile', 'jet_boots', 'ration', 'reflector'],
    uncommon: ['wild', 'meteor', 'booster', 'chain_rx', 'radar', 'rocket_fuel', 'hypno'],
    rare: ['shrink', 'flying_saucer'],
};

// The starting deck: eight plain cards across the ranks, a Death Ray and a Force Field.
export const START_DECK = [
    { k: 'plain', r: 1, s: 0 }, { k: 'plain', r: 3, s: 2 }, { k: 'plain', r: 4, s: 1 }, { k: 'plain', r: 6, s: 3 },
    { k: 'plain', r: 8, s: 0 }, { k: 'plain', r: 10, s: 2 }, { k: 'plain', r: 12, s: 1 }, { k: 'plain', r: 13, s: 3 },
    { k: 'death_ray' }, { k: 'force_field' },
];

// ------------------------------------------------------------------ gadgets (spend Atom charge)
export const GADGETS = {
    ray_pistol: { name: 'Ray Pistol', cost: 3, text: 'Deal 8 damage.', fx: { dmg: 8 } },
    wild_beam: { name: 'Wild Beam', cost: 2, text: 'The beam card turns wild: any card fits on it.', fx: { wildBeam: true } },
    force_bubble: { name: 'Force Bubble', cost: 2, text: 'Gain 9 block.', fx: { block: 9 } },
    disintegrator: { name: 'Disintegrator', cost: 2, target: true, text: 'Vaporize a face-up table card. The chain goes on.', fx: { vaporize: true } },
    jetpack: { name: 'Jetpack', cost: 1, text: 'A free draw.', fx: { freeDraw: true } },
    freeze_ray: { name: 'Freeze Ray', cost: 5, text: 'The creature skips its next move.', fx: { stun: true } },
    xray_specs: { name: 'X-Ray Specs', cost: 1, text: 'See every face-down card this fight.', fx: { reveal: true } },
    hypno_gun: { name: 'Hypno Gun', cost: 2, text: 'Daze the creature for 2 turns: it deals 25% less.', fx: { weak: 2 } },
    heat_lamp: { name: 'Heat Lamp', cost: 1, text: 'Thaw every frozen card and gain 3 block.', fx: { thaw: true, block: 3 } },
    atomic_bomb: { name: 'Atomic Bomb', cost: 7, text: 'Deal 26 damage.', fx: { dmg: 26 } },
};
export const START_GADGETS = ['ray_pistol', 'wild_beam'];
export const GADGET_POOL = ['force_bubble', 'disintegrator', 'jetpack', 'freeze_ray', 'xray_specs', 'hypno_gun', 'heat_lamp', 'atomic_bomb'];

// ------------------------------------------------------------------ souvenirs (passive relics)
export const RELICS = {
    rabbit_foot: { name: "Lucky Rabbit's Foot", icon: '🐇', tier: 'starter', text: 'Start every fight with 2 charge.' },
    lead_apron: { name: 'Lead Apron', icon: '🦺', tier: 'common', text: 'Start every fight with 8 block.' },
    ray_lens: { name: 'Ruby Ray Lens', icon: '🔴', tier: 'common', text: 'Ray cards deal 1 more damage.' },
    rocket_fins: { name: 'Rocket Fins', icon: '🚀', tier: 'common', text: 'Rocket cards deal 1 more damage.' },
    tin_shield: { name: 'Tin Shield', icon: '🛡️', tier: 'common', text: 'Shield cards give 1 more block.' },
    jukebox: { name: 'Jukebox', icon: '🎵', tier: 'common', text: 'Heal 5 after every fight.' },
    slide_rule: { name: 'Slide Rule', icon: '📏', tier: 'common', text: 'The first Atom card each turn gives 1 more charge.' },
    piggy_bank: { name: 'Piggy Bank', icon: '🐷', tier: 'common', text: 'Fights pay 50% more bucks.' },
    wristwatch: { name: 'Atomic Wristwatch', icon: '⌚', tier: 'uncommon', text: 'One extra draw on the first turn of every fight.' },
    tinfoil_hat: { name: 'Tin Foil Hat', icon: '🎩', tier: 'uncommon', text: 'Martian Static never reaches your stock.' },
    moon_rock: { name: 'Moon Rock', icon: '🌑', tier: 'uncommon', text: 'A Clean Sweep deals 20 damage instead of 10.' },
    pocket_robot: { name: 'Pocket Robot', icon: '🤖', tier: 'uncommon', text: 'Every 5th card of a chain gives 2 charge.' },
    sheriff_badge: { name: "Sheriff's Badge", icon: '⭐', tier: 'uncommon', text: 'Once a turn, a chain of 6 gains 6 block.' },
    saucer_shard: { name: 'Saucer Shard', icon: '🛸', tier: 'uncommon', text: 'Creatures start every fight with 10% less HP.' },
    golden_theremin: { name: 'Golden Theremin', icon: '🎻', tier: 'boss', text: 'Raise your max HP by 14 and heal 14.' },
    atomic_coffee: { name: 'Atomic Coffee', icon: '☕', tier: 'boss', text: 'Gain 1 charge at the start of every turn.' },
    lucky_dice: { name: 'Fuzzy Dice', icon: '🎲', tier: 'boss', text: 'Every turn, your chain starts at 1.' },
};
export const RELIC_POOL = {
    common: ['lead_apron', 'ray_lens', 'rocket_fins', 'tin_shield', 'jukebox', 'slide_rule', 'piggy_bank'],
    uncommon: ['wristwatch', 'tinfoil_hat', 'moon_rock', 'pocket_robot', 'sheriff_badge', 'saucer_shard'],
    boss: ['golden_theremin', 'atomic_coffee', 'lucky_dice'],
};

// ------------------------------------------------------------------ the creature feature
// Moves (intents), cycled in order from a random start (bosses start at the top):
//   atk n [hits]   block n   atkblock n b   buff str [block]   jam junk count [n]   freeze count [n]
//   drain n (heals what gets through)   wind (winds up; does nothing)
// Strength adds to every hit; Dazed (weak) takes off a quarter.
const atk = (n, hits = 1) => ({ t: 'atk', n, hits });
export const ENEMIES = {
    // Reel 1 — Gila Flats, Nevada
    ant: { name: 'Giant Ant', hp: [26, 30], layout: 'peaks', art: 'ant', moves: [atk(6), atk(3, 2), { t: 'atkblock', n: 5, b: 5 }] },
    trooper: { name: 'Tin Trooper', hp: [30, 34], layout: 'saucer', art: 'robot', moves: [{ t: 'atkblock', n: 5, b: 6 }, atk(9)] },
    blob: { name: 'The Little Blob', hp: [22, 26], layout: 'rocket', art: 'blob', moves: [{ t: 'buff', str: 2 }, atk(5), atk(5)] },
    scout: { name: 'Saucer Scout', hp: [24, 28], layout: 'saucer', art: 'saucer', moves: [{ t: 'jam', junk: 'static', count: 1, n: 4 }, atk(6), atk(7)] },
    scorpion: { name: 'Atomic Scorpion', hp: [54, 58], layout: 'towers', art: 'scorpion', elite: true, moves: [atk(5, 2), atk(11), { t: 'buff', str: 2, block: 8 }] },
    robot_man: { name: 'Robot Man', hp: [60, 64], layout: 'towers', art: 'robot', crest: true, elite: true, moves: [atk(10), { t: 'block', n: 12 }, { t: 'freeze', count: 2, n: 6 }] },
    gila: { name: 'The Colossal Gila', hp: [100, 100], layout: 'pyramid', art: 'lizard', boss: true, moves: [atk(6, 2), { t: 'buff', str: 2, block: 10 }, { t: 'jam', junk: 'slime', count: 2, n: 6 }, atk(14)] },
    // Reel 2 — Tranquility Moon Base
    crab: { name: 'Crater Crab', hp: [40, 44], layout: 'towers', art: 'crab', moves: [{ t: 'block', n: 10 }, atk(12), atk(6, 2)] },
    moth: { name: 'Lunar Moth', hp: [34, 38], layout: 'saucer', art: 'moth', moves: [atk(4, 3), { t: 'freeze', count: 2, n: 5 }] },
    leech: { name: 'Brain Leech', hp: [36, 40], layout: 'rocket', art: 'leech', moves: [{ t: 'drain', n: 8 }, { t: 'jam', junk: 'slime', count: 1, n: 6 }] },
    ape: { name: 'Space Ape', hp: [46, 50], layout: 'peaks', art: 'ape', moves: [atk(12), atk(6, 2), { t: 'buff', str: 2 }] },
    cyclops: { name: 'The Cyclops', hp: [86, 90], layout: 'saucer', art: 'cyclops', elite: true, moves: [atk(17), atk(7, 2), { t: 'buff', str: 2, block: 14 }] },
    sentinel: { name: 'Robo-Sentinel', hp: [90, 94], layout: 'towers', art: 'robot', antenna: true, elite: true, moves: [{ t: 'freeze', count: 3, n: 8 }, atk(6, 3), { t: 'block', n: 18 }] },
    brain: { name: 'The Brain from Planet X', hp: [175, 175], layout: 'pyramid', art: 'brain', boss: true, moves: [{ t: 'jam', junk: 'static', count: 2, n: 10 }, { t: 'block', n: 20 }, atk(6, 3), { t: 'freeze', count: 3, n: 8 }, atk(21)] },
    // Reel 3 — The Mothership
    saucer_man: { name: 'Saucer Man', hp: [52, 56], layout: 'saucer', art: 'martian', moves: [atk(8, 2), { t: 'jam', junk: 'static', count: 2, n: 6 }, atk(14)] },
    tentacle: { name: 'Tentacle Horror', hp: [62, 66], layout: 'peaks', art: 'tentacle', moves: [atk(16), { t: 'freeze', count: 3, n: 6 }, atk(5, 3)] },
    gunner: { name: 'Ray Gunner', hp: [46, 50], layout: 'diamond', art: 'martian', gun: true, moves: [{ t: 'wind' }, atk(24), { t: 'atkblock', n: 6, b: 12 }] },
    soldier: { name: 'Martian Soldier', hp: [56, 60], layout: 'rocket', art: 'martian', helmet: true, moves: [{ t: 'atkblock', n: 10, b: 10 }, { t: 'buff', str: 3 }, atk(7, 2)] },
    queen: { name: 'The Queen of Venus', hp: [112, 116], layout: 'towers', art: 'queen', elite: true, moves: [{ t: 'drain', n: 12 }, { t: 'jam', junk: 'slime', count: 2, n: 8 }, atk(9, 2), { t: 'buff', str: 3 }] },
    robot_king: { name: 'The Robot King', hp: [122, 126], layout: 'saucer', art: 'robot', crown: true, elite: true, moves: [{ t: 'block', n: 24 }, atk(22), { t: 'freeze', count: 3, n: 10 }] },
    overlord: { name: 'The Overlord', hp: [250, 250], layout: 'pyramid', art: 'overlord', boss: true, moves: [{ t: 'jam', junk: 'static', count: 2, n: 12 }, { t: 'buff', str: 3, block: 24 }, atk(7, 4), { t: 'freeze', count: 4, n: 12 }, { t: 'wind' }, atk(34)] },
};

// The three reels of the picture.
export const REELS = [
    {
        title: 'IT CAME FROM GILA FLATS', place: 'Gila Flats, Nevada', year: 1957, scene: 'desert',
        fights: ['ant', 'trooper', 'blob', 'scout'], elites: ['scorpion', 'robot_man'], boss: 'gila',
        intro: 'Something fell out of the sky over Gila Flats last night, and this morning the ants are the size of Buicks. The visitors have a custom: a planet is won or lost at the card table. Professor, the town is counting on your solitaire.',
        outro: 'The Colossal Gila crumples into the sand. In its belly: a homing beacon, still blinking, pointed at the Moon.',
    },
    {
        title: 'ROCKET TO TRANQUILITY', place: 'Tranquility Moon Base', year: 1959, scene: 'moon',
        fights: ['crab', 'moth', 'leech', 'ape'], elites: ['cyclops', 'sentinel'], boss: 'brain',
        intro: 'Two years later the Air Force bolts you into a rocket. The Moon base went quiet a week ago. The last transmission was a pair of hands, shuffling.',
        outro: 'The Brain from Planet X deflates like a party balloon. Its jar holds a star chart, and one star has a saucer drawn round it in red.',
    },
    {
        title: 'THE MOTHERSHIP', place: 'The Mothership, high orbit', year: 1961, scene: 'ship',
        fights: ['saucer_man', 'tentacle', 'gunner', 'soldier'], elites: ['queen', 'robot_king'], boss: 'overlord',
        intro: 'It was never a star. The Mothership parks over Earth like a hubcap the size of Ohio, and the Overlord deals the last hand himself.',
        outro: 'The Overlord folds. The Mothership drifts off toward wherever mothers go, and the radio plays the hit parade again. THE END... OR IS IT?',
    },
];

// ------------------------------------------------------------------ strange broadcasts (events)
// Each option: label, a short result, and what it does (run.js resolves the `do` keys).
export const EVENTS = {
    mad_scientist: {
        title: "The Mad Scientist's Lab",
        text: 'A man in a lab coat waves you in past the Tesla coils. "I can make you better! Stronger! Only slightly radioactive!"',
        options: [
            { label: 'Volunteer (max HP +8, a Space Slime joins your deck)', do: { maxHp: 8, curse: 'slime' }, result: 'You feel tremendous. Your pocket feels sticky.' },
            { label: 'Let him tinker with your deck (upgrade a random card)', do: { upgradeRandom: true }, result: 'He hums a little tune while he works.' },
            { label: 'Back away slowly', do: {}, result: '"Fools! I\'ll show them all!" he calls after you.' },
        ],
    },
    drive_in: {
        title: 'Double Feature at the Drive-In',
        text: 'The marquee says ATTACK OF THE GIANT LEECHES and THEM! AGAIN! The concession stand is short-handed.',
        options: [
            { label: 'Watch both pictures (heal 14)', do: { heal: 14 }, result: 'You nap through most of the second one.' },
            { label: 'Work the popcorn machine (+35 bucks)', do: { bucks: 35 }, result: 'Your fingers smell of butter for a week.' },
        ],
    },
    crashed_saucer: {
        title: 'The Crashed Saucer',
        text: 'A saucer lies nose-down in the arroyo, humming. Something inside glows.',
        options: [
            { label: 'Climb in (take 9 damage, gain a souvenir)', do: { dmg: 9, relic: true }, result: 'Ouch. But look what you found.' },
            { label: 'Strip the hull for scrap (+22 bucks)', do: { bucks: 22 }, result: 'The scrap dealer asks no questions.' },
        ],
    },
    recruiter: {
        title: 'The Army Recruiter',
        text: '"Uncle Sam needs card sharps, Professor. Hand over your worst card and I\'ll see it gets a desk job."',
        options: [
            { label: 'Enlist a card (remove a card from your deck)', do: { remove: true }, needDeck: true, result: 'Off it goes, to fight the paperwork.' },
            { label: 'Just take a ration (heal 7)', do: { heal: 7 }, result: 'Powdered eggs. Delicious.' },
        ],
    },
    teenagers: {
        title: 'Teenagers at Lookout Point',
        text: '"Nobody believes us! It came out of the lake and it had a deck of cards!"',
        options: [
            { label: 'Believe them (gain a random card)', do: { card: true }, result: 'They press a card into your hand. It is still damp.' },
            { label: 'Call the sheriff (+25 bucks reward)', do: { bucks: 25 }, result: 'The sheriff pays you to go away.' },
        ],
    },
    fortune: {
        title: 'The Fortune Machine',
        text: 'A turbaned automaton in a glass box. ZOLTRON SEES ALL. 30 BUCKS.',
        options: [
            { label: 'Pay 30 bucks (gain a rare card)', do: { pay: 30, rareCard: true }, needBucks: 30, result: 'A card slides out of the slot: YOUR FUTURE IS BRIGHT.' },
            { label: 'Walk on', do: {}, result: 'ZOLTRON IS DISAPPOINTED IN YOU.' },
        ],
    },
    radio: {
        title: 'A Voice on the Radio',
        text: 'Between stations, a voice: "Earthling. We admire your shuffle. Accept a gift, or our respect."',
        options: [
            { label: 'Accept the gift (gain a gadget)', do: { gadget: true }, result: 'Something drops on the passenger seat with a clunk.' },
            { label: 'Accept their respect (max HP +5)', do: { maxHp: 5, heal: 5 }, result: 'You sit a little taller.' },
        ],
    },
};
export const EVENT_KEYS = Object.keys(EVENTS);
