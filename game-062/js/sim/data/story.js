// Acts, floors, townsfolk, quests and flavour text.

export const ACTS = [
    {
        id: 1, name: 'The Root Cellar', floors: [1, 2, 3, 4], theme: 'cellar', boss: 'juicer',
        monsters: { grape: 10, fly: 7, peelton: 8, archer: 5, worm: 4, eggplant: 2 },
        intro: 'Something has crawled up from under Tristrawberry. The cellar smells… fermented.',
    },
    {
        id: 2, name: 'The Jam Catacombs', floors: [5, 6, 7, 8], theme: 'jam', boss: 'mango',
        monsters: { tomato: 8, lemon: 7, cactus: 4, crab: 6, eggplant: 4, fly: 5, archer: 3, worm: 3, mimic: 1 },
        intro: 'Below the cellar lie the old preserving vaults. The jam down here has opinions.',
    },
    {
        id: 3, name: 'The Rotten Core', floors: [9, 10, 11, 12], theme: 'core', boss: 'durianlord',
        monsters: { pumpkin: 7, chili: 8, durian: 4, crab: 4, lemon: 4, tomato: 3, worm: 3, mimic: 1 },
        intro: 'The very core of the Great Orchard. Rivers of boiling fruit punch. The stink is unbelievable.',
    },
];

export const actOf = (floor) => ACTS[Math.min(2, Math.floor((floor - 1) / 4))];
export const isBossFloor = (floor) => floor % 4 === 0;
export function floorName(floor) {
    if (floor === 0) return 'Tristrawberry';
    const a = actOf(floor);
    return `${a.name} — Level ${a.floors.indexOf(floor) + 1}`;
}
/** Monster level of a floor on Fresh difficulty. */
export const floorLevel = (floor) => 1 + Math.round((floor - 1) * 1.75);

export const NPCS = {
    cane: {
        name: 'Deckard Cane', title: 'Elder & Identifier', model: 'cane', pos: [20, 15],
        hello: ['Stay a while and glisten!', 'Ah, young fruit. Sit. Glisten.', 'Did I ever tell you about the Great Jam Flood? No? Stay a while…'],
        services: ['identify', 'talk'],
    },
    granny: {
        name: 'Granny Smith', title: 'Healer', model: 'granny', pos: [13, 21],
        hello: ['Oh, look at you, all bruised! Come here, dear.', 'Eat something, you look peaky.', 'Back in my day we fought rot with a spoon.'],
        services: ['heal', 'shop'],
    },
    grapeswold: {
        name: 'Grapeswold', title: 'Blacksmith', model: 'grapeswold', pos: [27, 21],
        hello: ['What can I do for ya?', 'Need somethin\' sharpened? Or squished?', 'I forge kitchenware. For WAR.'],
        services: ['shop'],
    },
    olivia: {
        name: 'Olivia', title: 'Oracle of the Grove', model: 'olivia', pos: [30, 13],
        hello: ['The pits whisper your name…', 'I sense… you need potions.', 'The olives told me you would come.'],
        services: ['shop'],
    },
    kiwirt: {
        name: 'Kiwirt', title: 'Shady Kid', model: 'kiwirt', pos: [10, 12],
        hello: ['Psst. Wanna buy a mystery smoothie?', 'Don\'t look at the leg. Everyone looks at the leg.', 'No refunds.'],
        services: ['gamble'],
    },
};

// Quest states: 0 unknown, 1 active, 2 done (return to giver), 3 rewarded.
export const QUESTS = [
    {
        id: 'freshfruit', name: 'Ahh, Fresh Fruit!', giver: 'cane', floor: 4,
        start: 'Something BIG has been chopping fruit in the Root Cellar. They call it The Juicer. Go down four levels and make it stop. Please. My nerves.',
        hint: 'Slay The Juicer on Root Cellar Level 4.',
        done: 'You did it! The Juicer is scrap! Here — I have been saving this for a hero. Or a garage sale.',
        reward: { skill: 1, item: 'rare', sugar: 300 },
    },
    {
        id: 'recipe', name: "Granny's Lost Recipe", giver: 'granny', floor: 2,
        start: 'My recipe book! I dropped it down the cellar stairs years ago. It\'s on a little stand on the second level. Would you be a dear?',
        hint: 'Find Granny\'s Recipe Book on a lectern in Root Cellar Level 2.',
        done: 'My pie recipe! Here, have a slice. It will put pulp on your bones.',
        reward: { maxHp: 15, potions: 4 },
    },
    {
        id: 'anvil', name: 'The Anvil of Furry', giver: 'grapeswold', floor: 6,
        start: 'Legend says there\'s an anvil in the Jam Catacombs. Covered in peach fuzz. The Anvil of Furry! Bring it to me and I\'ll forge you something special.',
        hint: 'Find the Anvil of Furry in Jam Catacombs Level 2.',
        done: 'Look at the FUZZ on it! Give me a moment… there. Forged just for you.',
        reward: { forge: true },
    },
    {
        id: 'leg', name: "Kiwirt's Leg", giver: 'kiwirt', floor: 7,
        start: 'Some bony banana nicked my spare leg. The Toothpick Thief. Jam Catacombs, level three. Get it back and it\'s yours. I mean it. Keep it. Please.',
        hint: 'Defeat the Toothpick Thief in Jam Catacombs Level 3.',
        done: 'My leg! …Ugh, it\'s all sticky now. You keep it.',
        reward: { legendary: 'kiwileg' },
    },
    {
        id: 'chutney', name: 'The Chutney Lord', giver: 'cane', floor: 8, needs: 'freshfruit',
        start: 'The Juicer was only a servant. Below the catacombs waits Mangophisto, Lord of Chutney, who pickles everything he touches. Stop him.',
        hint: 'Slay Mangophisto in Jam Catacombs Level 4.',
        done: 'Mangophisto, pickled by his own hand! But I fear the stink is getting worse…',
        reward: { skill: 1, item: 'rare', sugar: 900 },
    },
    {
        id: 'core', name: 'Rotten to the Core', giver: 'cane', floor: 12, needs: 'chutney',
        start: 'It is as I feared. Durian the Diabolical, the Prime Evil of the Orchard, stirs in the Rotten Core. Only you can stop him. Hold your nose.',
        hint: 'Slay Durian the Diabolical in the Rotten Core Level 4.',
        done: 'The orchard is saved! The air already smells… fruitier. Stay a while and glisten, hero. You have earned it.',
        reward: { skill: 2, sugar: 3000 },
    },
];

export const DEATH_LINES = ['YOU GOT SQUASHED', 'YOU HAVE BEEN JUICED', 'BRUISED BEYOND REPAIR', 'PULPED!', 'YOU WENT OFF'];
export const LEVELUP_LINES = ['You feel riper!', 'Sweeter than ever!', 'Your rind grows thicker!', 'Peak ripeness approaches!', 'Juicier!'];
export const TIPS = [
    'Click to walk, click a monster to whack it. Hold the button to keep whacking.',
    'Right-click (or 1–4) uses your skills. Juice is the blue-ish… orange-ish globe.',
    'Q drinks Strawberry Jam. E drinks Orange Juice. R bakes a Portal Pie home.',
    'Hold Alt to see every item on the floor. Or don\'t, and live dangerously.',
    'Deckard Cane identifies Ripe and Golden items for free. He insists you stay a while.',
    'Soda kegs explode. Fruit near soda kegs also explode. Be thoughtful.',
    'Smoothie Shrines give you a random boost. Most of them are good.',
    'Jam is sticky. Fruit punch is boiling. Stand in neither.',
    'Eggplant Shamans bring their friends back. Squash them first.',
    'Tab shows the map of everything you have explored.',
];

export const SHRINES = {
    ripe:    { name: 'Shrine of Ripeness',    msg: 'You feel ripe! +40% damage.',          buff: 'dmg',   v: 0.4, dur: 60 },
    crunchy: { name: 'Shrine of Crunch',      msg: 'Your rind hardens! +60% armour.',      buff: 'armor', v: 0.6, dur: 60 },
    zippy:   { name: 'Shrine of Zip',         msg: 'Zoom! +30% speed.',                    buff: 'speed', v: 0.3, dur: 60 },
    fresh:   { name: 'Refreshing Shrine',     msg: 'Fully refreshed!',                     instant: 'full' },
    sweet:   { name: 'Shrine of Sweetness',   msg: 'Experience tastes sweeter! +40% XP.',  buff: 'xp',    v: 0.4, dur: 90 },
    fizzy:   { name: 'Fizzy Shrine',          msg: 'Your juice fizzes! Skills cost nothing.', buff: 'free', v: 1, dur: 20 },
};
