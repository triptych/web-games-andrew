// The four merge chains, the guests and what they say. Pure data.
//
// A chain is a ladder of six tiers. Two identical items of one chain and tier merge into the next tier
// (pair merge, 2 -> 1), so a tier-N item is worth 2^(N-1) base items.

export const CHAIN_KEYS = ['craft', 'pumpkin', 'turkey', 'grain'];

export const CHAINS = {
    craft: {
        name: 'Craft Box',
        blurb: 'Kid crafts for the table',
        tiers: ['Crayon', 'Paper Leaf', 'Place Card', 'Handprint Turkey', 'Pilgrim Hat', 'Thankful Tree'],
        unlock: 0,
    },
    pumpkin: {
        name: 'Pumpkin Patch',
        blurb: 'From seed to blue-ribbon pie',
        tiers: ['Pumpkin Seed', 'Sprout', 'Mini Pumpkin', 'Pumpkin', 'Pumpkin Pie', 'Blue-Ribbon Pie'],
        unlock: 0,
    },
    turkey: {
        name: 'Turkey Coop',
        blurb: 'Egg to the big bird',
        tiers: ['Egg', 'Chick', 'Poult', 'Gobbler', 'Roast Turkey', 'Feast Platter'],
        unlock: 1,
    },
    grain: {
        name: 'Wheat Barrel',
        blurb: 'Wheat to a horn of plenty',
        tiers: ['Wheat', 'Flour Sack', 'Dough', 'Dinner Roll', 'Bread Basket', 'Cornucopia'],
        unlock: 2,
    },
};

export const tierName = (c, t) => CHAINS[c].tiers[t - 1];

export const GUEST_LIST = [
    { id: 'rose', name: 'Grandma Rose' },
    { id: 'joe', name: 'Grandpa Joe' },
    { id: 'bob', name: 'Uncle Bob' },
    { id: 'linda', name: 'Aunt Linda' },
    { id: 'timmy', name: 'Cousin Timmy' },
    { id: 'ava', name: 'Little Ava' },
    { id: 'pete', name: 'Pilgrim Pete' },
    { id: 'tess', name: 'Tess the Turkey' },
];

// What a guest says, by the first thing they ask for.
export const LINES = {
    craft: ['The place cards look so cute!', 'Can we decorate the table?', 'Kids made these, right? Love it!', 'Ooh, something crafty!'],
    pumpkin: ['Is there pie yet?', 'Save me a slice of pumpkin!', 'I could smell that pie from the porch.', 'Pumpkin, please!'],
    turkey: ['Where is the bird?', 'Gobble gobble!', 'Who is carving this year?', 'The turkey is the star!'],
    grain: ['Pass the rolls!', 'Warm bread, please.', 'Smells like the bakery in here.', 'I will take the bread basket.'],
};
