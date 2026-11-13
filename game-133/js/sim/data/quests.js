// What a petition is made of. The Guild Handbook (shown in the game) is exactly these tables: a quest's
// threat is the sum of its clues, and every two points of threat is a rank.
//
//   threat = creature tier (0-4) + how many (0-2) + where (0-2) + omen (0-2, from day 13)
//   rank   = Copper 0-1 · Bronze 2-3 · Silver 4-5 · Gold 6-7 · Platinum 8+

export const FOES = [
    // tier 0: pests
    { tier: 0, one: 'giant rat', many: 'giant rats' }, { tier: 0, one: 'grain beetle', many: 'grain beetles' },
    { tier: 0, one: 'thieving crow', many: 'thieving crows' }, { tier: 0, one: 'slime', many: 'slimes' },
    // tier 1: beasts and small folk
    { tier: 1, one: 'wolf', many: 'wolves' }, { tier: 1, one: 'goblin', many: 'goblins' },
    { tier: 1, one: 'wild boar', many: 'wild boars' }, { tier: 1, one: 'giant spider', many: 'giant spiders' },
    // tier 2: armed or unquiet
    { tier: 2, one: 'bandit', many: 'bandits' }, { tier: 2, one: 'skeleton', many: 'skeletons' },
    { tier: 2, one: 'harpy', many: 'harpies' }, { tier: 2, one: 'ghoul', many: 'ghouls' },
    // tier 3: monsters
    { tier: 3, one: 'troll', many: 'trolls' }, { tier: 3, one: 'wyvern', many: 'wyverns' },
    { tier: 3, one: 'basilisk', many: 'basilisks' }, { tier: 3, one: 'manticore', many: 'manticores' },
    // tier 4: calamities
    { tier: 4, one: 'lich', many: 'liches' }, { tier: 4, one: 'elder wyrm', many: 'elder wyrms' },
    { tier: 4, one: 'demon', many: 'demons' }, { tier: 4, one: 'stone titan', many: 'stone titans' },
];
export const TIER_NAME = ['Pests', 'Beasts & small folk', 'Armed or unquiet', 'Monsters', 'Calamities'];

// [phrase before the creature, uses the plural?]
export const COUNTS = [
    [['a lone', false], ['a single', false], ['one', false]],
    [['a pack of', true], ['a band of', true], ['a handful of', true]],
    [['a horde of', true], ['a whole nest of', true], ['dozens of', true]],
];
export const COUNT_NAME = ['One', 'A few', 'A great many'];

export const SITES = [
    ['in my cellar', 'in the barley fields', 'on the market road', 'by the town well', 'in the orchard'],
    ['in the Thornwood', 'in the old mill ruins', 'up on Crag Moor', 'in the Sunken Abbey', 'in the Weeping Caves'],
    ['in the Hollowdeep', 'under the Barrow of Kings', 'in the Ashen Pass'],
];
export const SITE_NAME = ['Near town', 'The wilds', 'Cursed ground'];

export const OMENS = [
    [''],
    [' The birds have gone quiet there.', ' There are strange lights at night.', ' The milk sours when the wind turns.'],
    [' And the Gloam was on them, that grey mist.', ' The grey mist came up with them. The Gloam.', ' Their eyes were grey as ash. Gloam-touched.'],
];
export const OMEN_NAME = ['None', 'Ill signs', 'The Gloam'];

// What the job needs, and how a petitioner asks for it.
export const JOBS = {
    mgt: ['Someone has to drive them off.', 'Send someone who can swing a blade.', 'It wants killing, plain and simple.'],
    wit: ['Somebody clever needs to find out where they come from.', 'Track them to their lair and tell us what we face.', 'We need to know why they have come.'],
    arc: ['It is cursed work. It wants a spellcaster.', 'No blade will hold them. Send someone with the art.', 'The wards must be redrawn before they return.'],
    stl: ['They took what is mine. Get it back quietly.', 'Slip in, take it back, and wake nothing.', 'No fighting. Just fetch it out from under them.'],
};

export const GIVERS = {
    folk: {
        names: ['Farmer Edda', 'Miller Joss', 'Widow Harrowgate', 'Shepherd Tam', 'Baker Olwen', 'Innkeep Marta', 'Old Fenwick', 'Fisher Bryn', 'Weaver Sallow', 'Cooper Hask'],
        open: ['Begging your pardon, clerk.', 'I have walked since dawn to say this.', 'You have to help us.', 'I have the coin, I swear it.', 'It is not much to pay with, but it is honest.'],
    },
    adv: {
        names: ['Scout Hale', 'Sellsword Varga', 'Pilgrim Anselm', 'Caravan-master Idris', 'Old Delver Marn', 'Hunter Yrsa'],
        open: ['Posting a job, not taking one.', 'Saw it with my own eyes on the road in.', 'I would handle it myself, but my party is short.', 'Put this on the board. Somebody should know.'],
    },
    crown: {
        names: ['Royal Herald Cassius', 'Lady Brannoch', 'Tax-reeve Dunmore', 'Captain Yseult of the Lancers', 'Lord Steward Ambrose'],
        open: ['By order of the Crown.', 'Her Majesty requires the guild\'s discretion.', 'The palace will pay promptly, in gold.', 'This comes under the royal seal.'],
    },
    wild: {
        names: ['Thistle the hedge-sprite', 'Brock, a talking badger', 'Grandmother Owl', 'a pond nixie', 'Grim the gargoyle', 'a will-o\'-wisp', 'the Fox Who Walks Upright'],
        open: ['The tall folk said the lantern-house listens.', 'I can pay in acorns. They are very good acorns.', 'The old compact says you must hear me.', 'Do not laugh. It is a long way to come on small legs.'],
    },
};
export const GIVER_NAME = { folk: 'Townsfolk', adv: 'Adventurers', crown: 'The Crown', wild: 'The Wild Folk' };

// How likely each rank and each kind of petitioner is, by chapter (0-4).
export const RANK_WEIGHTS = [[6, 3, 1, 0, 0], [4, 4, 2, 0, 0], [3, 4, 3, 1, 0], [2, 3, 3, 2, 1], [1, 2, 3, 3, 2]];
export const GIVER_WEIGHTS = { folk: [5, 5, 5, 5, 5], adv: [2, 2, 2, 2, 2], crown: [0, 1, 2, 2, 3], wild: [0, 1, 2, 3, 3] };
