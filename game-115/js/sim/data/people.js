// Heroes and townspeople: classes, traits, names, and the six special folk who move in
// when a journal entry says so.

export const HERO_CLASSES = {
    warrior: { name: 'Warrior', icon: '⚔️', blurb: 'Sturdy and steady.', base: { hp: 40, atk: 7, def: 6, luck: 3 }, grow: { hp: 6, atk: 1.3, def: 1.1, luck: 0.15 } },
    archer: { name: 'Archer', icon: '🏹', blurb: 'Quick eyes, quick hands.', base: { hp: 28, atk: 8, def: 3, luck: 6 }, grow: { hp: 4, atk: 1.5, def: 0.6, luck: 0.25 } },
    mage: { name: 'Mage', icon: '🔮', blurb: 'Hits hard, folds easily.', base: { hp: 24, atk: 10, def: 2, luck: 4 }, grow: { hp: 3, atk: 1.8, def: 0.4, luck: 0.2 } },
    rogue: { name: 'Rogue', icon: '🗡️', blurb: 'Finds the loot first.', base: { hp: 26, atk: 7, def: 3, luck: 9 }, grow: { hp: 4, atk: 1.2, def: 0.5, luck: 0.4 } },
    cleric: { name: 'Cleric', icon: '✨', blurb: 'Keeps the party on its feet.', base: { hp: 32, atk: 5, def: 5, luck: 5 }, grow: { hp: 5, atk: 0.9, def: 0.9, luck: 0.2 } },
};

// Hero traits: small numbers that change how a hero lives.
export const HERO_TRAITS = {
    brave: { name: 'Brave', icon: '🦁', text: '+5% power', power: 0.05 },
    greedy: { name: 'Greedy', icon: '💰', text: 'Keeps more of the loot', goldKeep: 0.15 },
    foodie: { name: 'Foodie', icon: '🍰', text: 'Hungrier, but meals work 50% harder', hungerRate: 0.2, buffMul: 1.5 },
    lucky: { name: 'Lucky', icon: '🍀', text: '+4 luck', luck: 4 },
    sleepy: { name: 'Sleepy', icon: '😴', text: 'Tires fast, hits a bit harder', energyRate: 0.3, power: 0.03 },
    curious: { name: 'Curious', icon: '🔎', text: 'Learns 15% faster', xp: 0.15 },
    cheerful: { name: 'Cheerful', icon: '😊', text: 'Always in a good mood', mood: 10 },
    stoic: { name: 'Stoic', icon: '🪨', text: 'Needs less food and sleep', hungerRate: -0.15, energyRate: -0.15 },
    loyal: { name: 'Loyal', icon: '🐕', text: 'Gives more to the town', goldKeep: -0.1, xp: 0.05 },
};

export const VILLAGER_TRAITS = {
    hardy: { name: 'Hardy', icon: '💪', text: 'Gatherers +8%', gather: 0.08 },
    nimble: { name: 'Nimble', icon: '🤲', text: 'Crafters +10%', craft: 0.1 },
    cheerful: { name: 'Cheerful', icon: '😊', text: 'Services +10%, town cozier', serve: 0.1, cozy: 1 },
    studious: { name: 'Studious', icon: '📖', text: 'Learns 50% faster', xp: 0.5 },
    nightowl: { name: 'Night Owl', icon: '🦉', text: 'Works well after dark', night: 0.5 },
    lucky: { name: 'Lucky', icon: '🍀', text: '5% chance of a bonus find', bonus: 0.05 },
    gentle: { name: 'Gentle', icon: '🐑', text: 'Animals love them: husbandry +10%', husb: 0.1 },
    strong: { name: 'Strong', icon: '🦾', text: 'Woodcraft and mining +10%', heavy: 0.1 },
};

export const FIRST_NAMES = ['Alder', 'Bramble', 'Clover', 'Dill', 'Ember', 'Fennel', 'Gideon', 'Hazel', 'Ivy', 'Juniper', 'Kestrel', 'Linden',
    'Moss', 'Nettle', 'Olive', 'Pip', 'Quill', 'Rowan', 'Sage', 'Thistle', 'Umber', 'Vale', 'Willow', 'Yarrow', 'Zinnia', 'Bran', 'Cedric',
    'Dara', 'Elowen', 'Finn', 'Gwen', 'Hob', 'Isolde', 'Jory', 'Kit', 'Lark', 'Mira', 'Nell', 'Orla', 'Perrin', 'Rue', 'Sorrel', 'Tansy',
    'Wren', 'Briar', 'Cobb', 'Daisy', 'Egan', 'Flint', 'Gilly', 'Holly', 'Ash', 'Basil', 'Corin', 'Dorrie', 'Eben', 'Faye', 'Garrick', 'Hettie', 'Jasper'];
export const SURNAMES = ['Thatch', 'Millbrook', 'Oakhand', 'Greenfield', 'Brightwater', 'Hollowell', 'Fernside', 'Cobblestone', 'Ashby', 'Pennywhistle',
    'Larkspur', 'Dunmore', 'Wickersham', 'Burrow', 'Applegate', 'Stonebridge', 'Marlow', 'Tumble', 'Honeycomb', 'Crabtree', 'Reedmarsh', 'Underhill', 'Goodbarrel', 'Fairweather'];

export const HERO_EPITHETS = ['the Bold', 'the Brisk', 'of the Glen', 'the Wanderer', 'Longstride', 'the Kind', 'Ironbark', 'Quickfoot', 'the Merry', 'Stormcaller', 'the Patient', 'Hearthguard'];

/** XP a hero needs to leave a level. */
export const heroXpNeed = (lv) => Math.round(16 * Math.pow(lv, 1.45));
/** XP a villager's skill needs to leave a level (1..9). */
export const skillXpNeed = (lv) => Math.round(90 * lv * Math.pow(1.25, lv));
export const SKILL_MAX = 10;

// The special folk: each arrives from a journal reward and brings a town-wide perk.
export const SPECIALS = {
    brenna: { name: 'Brenna Fernwhistle', title: 'the Herbalist', skills: { alchemy: 6, foraging: 5 }, trait: 'gentle', look: { skin: 1, hair: 6, style: 2, outfit: 4, hat: 2 },
        perk: { potionMul: 0.2 }, perkText: 'Potions work 20% better.', story: 'Brenna walked out of the marsh with a basket of something that smelled wonderful, and asked if you had a spare shelf.' },
    thorne: { name: 'Thorne Ironbeard', title: 'the Smith', skills: { smithing: 7, mining: 4 }, trait: 'strong', look: { skin: 2, hair: 4, style: 3, outfit: 2, hat: 0 },
        perk: { smithSpeed: 0.25 }, perkText: 'Smithy and Carpenter work 25% faster.', story: 'Thorne followed the smell of coal smoke to your door. He says your anvil is "adequate, for now".' },
    pip: { name: 'Pip Pennywhistle', title: 'the Peddler', skills: { hospitality: 6 }, trait: 'lucky', look: { skin: 0, hair: 5, style: 1, outfit: 3, hat: 1 },
        perk: { sellMul: 0.1, merchantFreq: 1 }, perkText: 'Sells for 10% more; the merchant visits more often.', story: 'Pip arrived with a cart, a limp, and three opinions about your prices.' },
    tuck: { name: 'Tuck Larkspur', title: 'the Bard', skills: { hospitality: 4, cooking: 3 }, trait: 'cheerful', look: { skin: 3, hair: 7, style: 0, outfit: 5, hat: 2 },
        perk: { cozy: 15, heroMood: 6 }, perkText: 'The town is cozier and heroes are merrier.', story: 'Tuck tuned a lute outside the tavern until someone gave him a bowl of soup. Nobody asked him to leave.' },
    orla: { name: 'Sage Orla', title: 'the Archivist', skills: { scholar: 8 }, trait: 'studious', look: { skin: 1, hair: 3, style: 3, outfit: 1, hat: 0 },
        perk: { loreMul: 0.5, upgradeDiscount: 0.1 }, perkText: 'Lore comes 50% faster; upgrades cost 10% less.', story: 'Orla has read every book in three counties and is looking for a fourth.' },
    fenn: { name: "Cap'n Fenn", title: 'the Old Sailor', skills: { fishing: 8 }, trait: 'hardy', look: { skin: 2, hair: 0, style: 2, outfit: 0, hat: 1 },
        perk: { fishMul: 0.3 }, perkText: 'Fishing yields 30% more.', story: 'Fenn has never been to sea. He says the river counts.' },
};
