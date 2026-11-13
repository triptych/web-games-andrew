// GIANT'S VAULT: monsters, bosses and elite affixes. Pure data.
// hp and dmg are multipliers of the level curve in config.js (MON.hp(level), MON.dmg(level)).
// ai: 'melee' walks in and swings; 'ranged' keeps its distance and shoots; 'caster' shoots slow orbs and raises
// help; 'charger' winds up and rushes. poise: a hit bigger than poise × max life staggers it (bosses have a lot).

export const MONSTERS = {
    // ---------------------------------------------------------- Act I: the Drowned Wilds
    wretch: {
        name: 'Bramble Wretch', act: 1, ai: 'melee', hp: 1.0, dmg: 1.0, speed: 2.6, radius: 0.55, reach: 1.4,
        atk: 1.3, xp: 1, poise: 0.12, el: 'phys', model: 'mon-wretch', h: 1.7, color: 0x6b7a3a,
        art: 'a hunched humanoid made of tangled thorny brambles and drowned roots, glowing green pinprick eyes, long clawed twig arms',
    },
    gorehound: {
        name: 'Gorehound', act: 1, ai: 'melee', hp: 0.55, dmg: 0.7, speed: 4.6, radius: 0.5, reach: 1.2,
        atk: 0.9, xp: 0.6, poise: 0.08, el: 'phys', model: 'mon-gorehound', h: 1.0, pack: true, color: 0x8a3a2a,
        art: 'a lean mangy hyena-like hound with exposed ribs, red-brown fur and a too-wide mouth of teeth, four legs',
    },
    slinger: {
        name: 'Satyr Slinger', act: 1, ai: 'ranged', hp: 0.7, dmg: 0.8, speed: 3.0, radius: 0.5, reach: 9,
        atk: 1.8, xp: 0.9, poise: 0.1, el: 'phys', proj: { speed: 13, radius: 0.3 }, model: 'mon-slinger', h: 1.6, color: 0x9a7a4a,
        art: 'a wiry goat-legged satyr with curled horns, mossy fur, a leather sling and a pouch of stones, crouched and sly',
    },
    // ---------------------------------------------------------- Act II: the Ashen Necropolis
    thrall: {
        name: 'Bone Thrall', act: 2, ai: 'melee', hp: 1.0, dmg: 1.0, speed: 2.8, radius: 0.5, reach: 1.4,
        atk: 1.2, xp: 1, poise: 0.12, el: 'phys', model: 'mon-thrall', h: 1.8, color: 0xd8d0b8,
        art: 'a skeleton warrior in rusted bronze Greek armour scraps with a notched sword and a cracked round shield, glowing violet eye sockets',
    },
    archer: {
        name: 'Crypt Archer', act: 2, ai: 'ranged', hp: 0.7, dmg: 0.9, speed: 2.8, radius: 0.5, reach: 10,
        atk: 1.7, xp: 0.9, poise: 0.1, el: 'phys', proj: { speed: 16, radius: 0.25 }, model: 'mon-archer', h: 1.8, color: 0xbfb79f,
        art: 'a hooded skeleton archer with a long black yew bow and a quiver of black arrows, tattered grey shroud',
    },
    hag: {
        name: 'Grave Hag', act: 2, ai: 'caster', hp: 0.9, dmg: 1.1, speed: 2.4, radius: 0.55, reach: 8,
        atk: 2.6, xp: 1.4, poise: 0.12, el: 'shadow', proj: { speed: 7, radius: 0.5 }, raises: 'thrall', model: 'mon-hag', h: 1.7, color: 0x5a4a7a,
        art: 'a gaunt hunched old witch in rotting black-violet burial wraps, long grey hair, a crooked staff topped with a small skull, glowing violet eyes',
    },
    // ---------------------------------------------------------- Act III: the Giant's Vault
    sentinel: {
        name: 'Bronze Sentinel', act: 3, ai: 'charger', hp: 1.8, dmg: 1.4, speed: 2.2, radius: 0.8, reach: 1.8,
        atk: 1.8, xp: 1.8, poise: 0.25, el: 'phys', armor: 0.3, model: 'mon-sentinel', h: 2.4, color: 0xb08040,
        art: 'a hulking bronze automaton guardian with a featureless Greek helm, a glowing orange furnace core in its chest, huge hammer-like fists',
    },
    wraith: {
        name: 'Ichor Wraith', act: 3, ai: 'melee', hp: 0.7, dmg: 1.1, speed: 4.2, radius: 0.5, reach: 1.4,
        atk: 1.0, xp: 1, poise: 0.08, el: 'fire', model: 'mon-wraith', h: 1.8, phase: true, color: 0xffaa33,
        art: 'a floating spectral figure made of molten golden ichor and smoke, no legs, a trailing tail of fire, long burning claws',
    },
    gorgon: {
        name: 'Gorgon Archer', act: 3, ai: 'ranged', hp: 0.9, dmg: 1.1, speed: 3.0, radius: 0.55, reach: 11,
        atk: 1.6, xp: 1.2, poise: 0.12, el: 'phys', proj: { speed: 17, radius: 0.3 }, model: 'mon-gorgon', h: 1.9, color: 0x4a8a6a,
        art: 'a gorgon archer woman with a lower body of a green serpent tail, hair of small hissing snakes, bronze breastplate and a recurve bow',
    },
};

/** Bosses: one per act and the rift guardian. phases split the life bar; each adds abilities. */
export const BOSSES = {
    skyllith: {
        name: 'Skyllith, Maw of the Drowned Temple', act: 1, hp: 26, dmg: 1.6, speed: 2.6, radius: 1.6, reach: 2.8,
        atk: 1.6, xp: 25, poise: 0.5, el: 'cold', model: 'boss-skyllith', h: 4.2, color: 0x2a7a8a,
        abilities: ['slam', 'spray', 'summon:gorehound'], phases: [0.5],
        art: 'a monstrous sea-hydra with three eel-like heads full of needle teeth, barnacled teal scales, a crab-like armoured body and claws, drowned temple gold jewellery',
        taunt: ['The tide remembers your kind, Warden.', 'Sink with the rest of them!', 'More! Rise from the deep!'],
        death: 'The tide... will take you... in the end.',
        voice: 'Draconius - Feral, Demonic & Dangerous',
    },
    morwen: {
        name: 'Morwen, the Ossuary Queen', act: 2, hp: 30, dmg: 1.7, speed: 3.0, radius: 1.0, reach: 9,
        atk: 1.4, xp: 30, poise: 0.5, el: 'shadow', model: 'boss-morwen', h: 3.0, color: 0x7a5aaa, ranged: true,
        abilities: ['bonering', 'blink', 'summon:thrall', 'volley'], phases: [0.66, 0.33],
        art: 'a tall regal undead queen in a gown woven from bones and violet silk, a crown of finger bones, skeletal hands, a long bone sceptre, floating hem',
        taunt: ['Kneel, little warden. My court has room for one more.', 'Bones, to me!', 'You will make a lovely chandelier.'],
        death: 'Sixty years... and I never once... rested.',
        voice: 'Kristen – Cold Evil Queen Villain',
    },
    kolossar: {
        name: 'Kolossar, the Chained Giant', act: 3, hp: 44, dmg: 2.0, speed: 2.2, radius: 2.2, reach: 3.4,
        atk: 1.8, xp: 60, poise: 0.6, el: 'fire', model: 'boss-kolossar', h: 6.0, color: 0xc0602a,
        abilities: ['slam', 'quake', 'meteor', 'summon:sentinel'], phases: [0.66, 0.33],
        art: 'a colossal stone-and-magma giant with broken golden chains hanging from his wrists and neck, molten cracks across his body, a bearded crowned head of basalt, burning eyes',
        taunt: ['Ten thousand years in chains, and they send ME a child?', 'The chains are rust, Warden. So are you.', 'Burn! Let the sky fall with me!'],
        death: 'Chains... again. I will wait. I am very... patient.',
        voice: 'Bloodgrin VF - Evil, Demonic Villain',
    },
};

/** Elite affixes, Diablo II style: a blue champion pack all share one; a yellow rare has two and minions. */
export const ELITE_AFFIXES = {
    fast: { name: 'Fast', speed: 1.4, atk: 0.75 },
    strong: { name: 'Extra Strong', dmg: 1.5 },
    stone: { name: 'Stoneskin', armor: 0.4 },
    vampiric: { name: 'Vampiric', leech: 0.25 },
    thunder: { name: 'Thunderous', nova: 'lightning' },     // a ring of lightning every few seconds (telegraphed)
    molten: { name: 'Molten', deathBlast: 'fire' },         // explodes when it dies (telegraphed)
};

export const ACT_MONSTERS = {
    1: ['wretch', 'gorehound', 'slinger'],
    2: ['thrall', 'archer', 'hag'],
    3: ['sentinel', 'wraith', 'gorgon'],
};
