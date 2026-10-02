// The Gloamwood bestiary. Each row: [name, weapon, kind, colour, death line].
// `kind` picks the 3D body in scene/foes.js:
//   beast · humanoid · brute · slime · flyer · spirit · serpent · plant · insect
// Stats come from the level (see creatureFor), with a little variance per name.

const C = (name, weapon, kind, color, death) => ({ name, weapon, kind, color, death });

export const CREATURES = {
    1: [
        C('Bog Rat', 'yellowed teeth', 'beast', 0x6b5a44, 'The rat squeaks once and lies still. You feel faintly ridiculous.'),
        C('Furious Goose', 'a merciless beak', 'flyer', 0xe8e4da, 'The goose honks its final honk. Somewhere, a farmer weeps with relief.'),
        C('Moss Slime', 'a sticky pseudopod', 'slime', 0x6fbf4a, 'The slime splatters into a steaming puddle of green.'),
        C('Scarecrow Apprentice', 'a pointed stick', 'humanoid', 0xc9a35a, 'The scarecrow collapses into straw and somebody\'s old trousers.'),
        C('Mudling', 'fistfuls of wet clay', 'brute', 0x7a5a3a, 'The mudling slumps back into the earth with a sad squelch.'),
        C('Bramble Sprite', 'a whip of thorns', 'plant', 0x5b8a3c, 'The sprite withers into a tangle of dry twigs.'),
    ],
    2: [
        C('Wolf Spider', 'venomous fangs', 'insect', 0x3a3530, 'The spider curls its eight legs tight and goes still.'),
        C('Kobold Scrounger', 'a rusty fork', 'humanoid', 0xb5602f, 'The kobold drops its fork and keels over. You keep the fork. No — you don\'t.'),
        C('Rabid Badger', 'frothing jaws', 'beast', 0x55524c, 'The badger gives one last furious snarl and expires.'),
        C('Swamp Leech', 'a ring of tiny teeth', 'serpent', 0x3d4a33, 'The leech shrivels like a raisin in the sun.'),
        C('Mischievous Pixie', 'stinging glitter', 'flyer', 0xe08ae8, 'The pixie bursts in a puff of sparkles and a very rude word.'),
        C('Toadstool Shambler', 'clouds of spores', 'plant', 0xb8463a, 'The shambler topples, and its cap rolls away into the ferns.'),
    ],
    3: [
        C('Grey Wolf', 'snapping jaws', 'beast', 0x8c8c8c, 'The wolf whimpers and lies down, and does not get up.'),
        C('Goblin Cutpurse', 'a jagged dagger', 'humanoid', 0x6f9a3b, 'The goblin gurgles, "Wasn\'t even my purse," and dies.'),
        C('Carrion Crow Swarm', 'a hundred beaks', 'flyer', 0x1e1e26, 'The crows scatter shrieking into the canopy, leaving feathers everywhere.'),
        C('Crypt Beetle', 'grinding mandibles', 'insect', 0x2d5a4f, 'The beetle\'s shell cracks with a sound like a breaking plate.'),
        C('Peat Golem', 'a fist of packed earth', 'brute', 0x4d3a26, 'The golem crumbles into a perfectly good pile of fuel.'),
        C('Wisp of the Bog', 'a chill flicker', 'spirit', 0x9fe3ff, 'The wisp gutters like a candle and goes out.'),
    ],
    4: [
        C('Hobgoblin Thug', 'a spiked club', 'humanoid', 0x9a5a2a, 'The hobgoblin topples like a felled tree, still looking surprised.'),
        C('Wild Boar', 'curving tusks', 'beast', 0x5a3f2e, 'The boar thrashes once and is still. That is a lot of bacon.'),
        C('Strangling Vine', 'coiling tendrils', 'plant', 0x3f7a2e, 'You hack through the last tendril and the vine goes limp.'),
        C('Marsh Adder', 'needle fangs', 'serpent', 0x6b7a3a, 'The adder twists into a knot and stops moving.'),
        C('Bandit Lookout', 'a short bow', 'humanoid', 0x6e5240, 'The bandit drops their bow with a groan. "Shoulda stayed a baker..."'),
        C('Giant Hornet', 'a stinger like a nail', 'insect', 0xd4a017, 'The hornet\'s buzzing stops, which is the best sound you\'ve heard all day.'),
    ],
    5: [
        C('Black Bear', 'heavy claws', 'beast', 0x2a2420, 'The bear sighs like an old man and lies down for the long sleep.'),
        C('Orc Raider', 'a notched axe', 'humanoid', 0x5a7a3a, 'The orc snarls something about your mother and falls dead.'),
        C('Gloomwood Owlbear', 'a crushing hug', 'brute', 0x7a5a3e, 'The owlbear hoots mournfully and collapses in a heap of feathers and fur.'),
        C('Ghoul', 'filthy talons', 'spirit', 0x8a9a80, 'The ghoul shrieks and collapses into grave dust.'),
        C('Harpy', 'raking talons', 'flyer', 0x9a6a8a, 'The harpy spirals into the brush, cursing to the very end.'),
        C('Bog Ooze', 'acidic slime', 'slime', 0x8a9a2a, 'The ooze bubbles, hisses and seeps away into the mud.'),
    ],
    6: [
        C('Dire Wolf', 'savage fangs', 'beast', 0x4a4a52, 'The great wolf falls, and somewhere in the forest its pack begins to howl.'),
        C('Barrow Wight', 'a grave-cold blade', 'spirit', 0xb0c8d8, 'The wight crumbles, its blade rusting away in a heartbeat.'),
        C('Gnoll Packleader', 'a bone-handled flail', 'humanoid', 0xa08050, 'The gnoll yelps like a kicked dog and goes down.'),
        C('Thornback Lizard', 'a lashing spiked tail', 'serpent', 0x5a8a4a, 'The lizard\'s spines flatten as it dies.'),
        C('Fungal Colossus', 'choking spore clouds', 'plant', 0xa86a9a, 'The colossus rots away to a ring of strange white mushrooms.'),
        C('Venomous Centipede', 'a hundred clicking legs', 'insect', 0x8a3a1a, 'The centipede coils up, every last leg twitching, then still.'),
    ],
    7: [
        C('Forest Troll', 'fists like boulders', 'brute', 0x4a6a4a, 'The troll falls with a crash that shakes the leaves from the trees.'),
        C('Dark Elf Scout', 'a poisoned crossbow', 'humanoid', 0x6a5a9a, 'The scout whispers a curse in a language older than the village and dies.'),
        C('Wyvern Hatchling', 'a barbed tail', 'flyer', 0x7a9a5a, 'The hatchling crashes into the ferns with a pitiful screech.'),
        C('Mire Hag', 'withering hexes', 'humanoid', 0x6a7a5a, 'The hag cackles one last time and dissolves into swamp water.'),
        C('Shadow Panther', 'claws of night', 'beast', 0x1a1a2a, 'The panther\'s body fades into shadow and is gone.'),
        C('Gelatinous Cube', 'engulfing jelly', 'slime', 0x7ad4c4, 'The cube wobbles, sags and spills across the forest floor, revealing three swords and a boot.'),
    ],
    8: [
        C('Ogre Brute', 'a tree-trunk club', 'brute', 0x8a7a5a, 'The ogre sways, blinks twice, and topples like a tower.'),
        C('Bandit Captain', 'a gleaming cutlass', 'humanoid', 0x7a3a3a, 'The captain falls, and their crew is suddenly elsewhere.'),
        C('Banshee', 'a soul-rending wail', 'spirit', 0xd8e8f8, 'The banshee\'s scream cuts off into blessed silence.'),
        C('Giant Constrictor', 'crushing coils', 'serpent', 0x6a5a2a, 'The snake\'s coils loosen, and you can breathe again.'),
        C('Ironbark Treant', 'gnarled branch-arms', 'plant', 0x5a4a32, 'The treant groans and roots itself in place, forever.'),
        C('Werewolf', 'moon-mad claws', 'beast', 0x6a5a4a, 'The werewolf shrinks back into a pale, naked stranger, who smiles in death.'),
    ],
    9: [
        C('Minotaur', 'a double-bladed axe', 'brute', 0x6a3a2a, 'The minotaur bellows and crashes down, horns first.'),
        C('Lich Acolyte', 'necrotic bolts', 'humanoid', 0x5a6a5a, 'The acolyte\'s phylactery shatters and they turn to ash.'),
        C('Chimera Cub', 'three hungry mouths', 'beast', 0xaa7a3a, 'All three heads sigh at once, and the chimera lies still.'),
        C('Giant Mantis', 'scything forelimbs', 'insect', 0x7aaa3a, 'The mantis folds its blades as if in prayer, and dies.'),
        C('Will-o\'-the-Wisp', 'luring lights', 'spirit', 0x9affd0, 'The wisp splits into a dozen sparks that fade one by one.'),
        C('Basilisk', 'a petrifying gaze', 'serpent', 0x4a6a3a, 'You avoid its eyes as the basilisk dies. Just in case.'),
    ],
    10: [
        C('Hill Giant', 'a boulder', 'brute', 0x9a8a6a, 'The giant topples, and three trees go down with it.'),
        C('Death Knight', 'a runeblade', 'humanoid', 0x2a3a4a, 'The knight\'s eyes go dark inside the helm, and the armour falls empty.'),
        C('Manticore', 'a spiked tail volley', 'beast', 0xaa5a3a, 'The manticore roars one last time and rolls over, spikes and all.'),
        C('Wraith', 'a draining touch', 'spirit', 0x8a8aaa, 'The wraith unravels into cold mist.'),
        C('Cockatrice', 'a stone-turning peck', 'flyer', 0xc8b46a, 'The cockatrice flops over. You check your fingers: all flesh.'),
        C('Black Pudding', 'corrosive bulk', 'slime', 0x1a1a1a, 'The pudding hisses, steams and boils away to nothing.'),
    ],
    11: [
        C('Wyvern', 'a venomous stinger', 'flyer', 0x5a7a4a, 'The wyvern crashes down, wings broken, and is still.'),
        C('Troll Shaman', 'cursed totems', 'humanoid', 0x3a5a4a, 'The shaman\'s totems crack one by one as it dies.'),
        C('Bone Golem', 'grinding bone fists', 'brute', 0xd8d0b8, 'The golem collapses into an enormous pile of ribs and regrets.'),
        C('Naga Warden', 'a coral trident', 'serpent', 0x3a8a8a, 'The naga hisses a curse and slides beneath the dark water.'),
        C('Corpse-flower Behemoth', 'a gaping maw', 'plant', 0x8a2a5a, 'The behemoth wilts, filling the clearing with a stench of rot.'),
        C('Phase Spider', 'flickering fangs', 'insect', 0x5a3a8a, 'The spider blinks out of existence, and this time it does not come back.'),
    ],
    12: [
        C('Frost Giant', 'an ice-rimed greataxe', 'brute', 0x9ac8e8, 'The giant shatters like a dropped icicle.'),
        C('Vampire Thrall-Lord', 'a blood-drinking kiss', 'humanoid', 0x6a1a2a, 'The vampire screams and crumbles to dust as dawn-light finds it.'),
        C('Hydra', 'five snapping heads', 'serpent', 0x3a6a5a, 'You burn the last neck before it can grow back. The hydra is still.'),
        C('Spectral Warhorse', 'thundering ghost-hooves', 'spirit', 0xaac8ff, 'The phantom horse rears and gallops away into nothing.'),
        C('Roc Fledgling', 'a beak like a scythe', 'flyer', 0x8a6a3a, 'The fledgling crashes through the canopy and does not rise.'),
        C('Gloamwood Behir', 'crackling lightning', 'beast', 0x4a5a9a, 'The behir\'s lightning sputters out and it collapses, smoking.'),
    ],
    13: [
        C('Elder Treant', 'the wrath of the forest', 'plant', 0x4a5a2a, 'The elder treant settles into the earth and becomes a tree again, forever.'),
        C('Demon Hound', 'hellfire jaws', 'beast', 0x8a2a1a, 'The hound howls and burns away to a smoking scorch-mark.'),
        C('Fallen Paladin', 'a blackened warhammer', 'humanoid', 0x4a4a5a, 'The paladin whispers a prayer, at last, and is still.'),
        C('Stone Colossus', 'earth-shaking stomps', 'brute', 0x7a7a7a, 'The colossus cracks down the middle and tumbles into rubble.'),
        C('Night Hag', 'nightmare-claws', 'spirit', 0x5a3a6a, 'The hag dissolves with a shriek that you will hear in your dreams.'),
        C('Purple Worm', 'a tunnel of teeth', 'serpent', 0x6a2a7a, 'The worm thrashes, then sinks back into the earth for good.'),
    ],
    14: [
        C('Storm Giant', 'a lightning-forged sword', 'brute', 0x6a8aaa, 'The storm giant falls, and for a moment the sky goes quiet.'),
        C('Lich', 'a staff of withering', 'humanoid', 0x6a7a6a, 'The lich\'s crown rolls into the dust, and its laughter fades.'),
        C('Drake of the Gloam', 'searing breath', 'flyer', 0x5a8a3a, 'The drake gives a last smoky gasp. A cousin of the Wyrm. It will have noticed.'),
        C('Abyssal Horror', 'a dozen grasping arms', 'slime', 0x2a1a3a, 'The horror implodes into a sucking void, and then into nothing at all.'),
        C('Bonewing Revenant', 'grave-cold wings', 'spirit', 0xc8d8c8, 'The revenant\'s bones scatter on the wind.'),
        C('Primordial Ankheg', 'acid spit', 'insect', 0x8a6a2a, 'The ankheg\'s shell splits, and it dies with a hiss.'),
    ],
    15: [
        C('Pit Fiend', 'a burning trident', 'humanoid', 0xaa2a1a, 'The fiend roars and is dragged back, screaming, to wherever it came from.'),
        C('Ancient Basilisk', 'a gaze of eternity', 'serpent', 0x3a5a2a, 'The ancient basilisk closes its eyes for the last time.'),
        C('Titan of the Deep Wood', 'fists of living oak', 'brute', 0x5a4a2a, 'The titan kneels, then falls, and the whole forest shudders.'),
        C('Dread Wraith-Queen', 'a crown of screaming souls', 'spirit', 0xa0a0d0, 'The wraith-queen\'s crown shatters, and a hundred souls fly free.'),
        C('Jade Wyrmling', 'jade-green fire', 'flyer', 0x2ac87a, 'The wyrmling falls, and from deep in the forest something vast and old answers its cry.'),
        C('Elder Gloamwood Spider', 'webs of shadow', 'insect', 0x2a2a3a, 'The great spider curls in on itself, and its webs fall like grey snow.'),
    ],
    16: [
        C('Wyrm-Touched Behemoth', 'jade-veined horns', 'brute', 0x3a7a5a, 'The behemoth falls, and the jade light in its veins goes dark.'),
        C('Herald of the Wyrm', 'a jade-flame glaive', 'humanoid', 0x2a9a6a, 'The herald dies laughing. "It is waiting for you," they whisper.'),
        C('Gloam Leviathan', 'crushing coils of night', 'serpent', 0x1a3a3a, 'The leviathan sinks back into the black earth.'),
        C('Archon of Thorns', 'a storm of barbs', 'plant', 0x3a5a1a, 'The archon withers, thorn by thorn.'),
    ],
};

// Restless souls in the Barrow Field (Pale Shore). Fought with soul points.
export const SOULS = [
    C('Wailing Shade', 'a mournful cry', 'spirit', 0xb0c0e0, 'The shade sighs and drifts away across the water.'),
    C('Restless Peasant', 'a ghostly hoe', 'spirit', 0xa0b0c0, 'The peasant\'s ghost finally lies down to rest.'),
    C('Drowned Sailor', 'a waterlogged cutlass', 'spirit', 0x80a0c0, 'The sailor sinks into the mist, one last bubble rising.'),
    C('Jealous Phantom', 'spiteful whispers', 'spirit', 0xc0a0e0, 'The phantom\'s whispers fall silent at last.'),
    C('Bitter Old Knight', 'a rusted spectral blade', 'spirit', 0x90a0b0, 'The old knight lowers his blade. "...Thank you," he says, and fades.'),
    C('Lost Child-Ghost', 'tiny cold hands', 'spirit', 0xd0e0f0, 'The little ghost giggles and runs off into the light.'),
    C('Gravedigger\'s Shadow', 'a spade of darkness', 'spirit', 0x7080a0, 'The shadow climbs back into its grave and pulls the earth over itself.'),
];

// The Jade Wyrm.
export const WYRM = {
    name: 'The Jade Wyrm', weapon: 'jade fire and ancient fury', kind: 'dragon', color: 0x1fae6a,
    level: 18, hp: 230, atk: 34, def: 22,
    death: 'With a sound like a mountain breaking, the Jade Wyrm falls. Its jade fire gutters and dies, and for the first time in a hundred years, the Gloamwood is silent.',
};

// LoGD creature gold and XP tables, by level 1..16.
const GOLD = [36, 97, 148, 198, 241, 288, 340, 388, 435, 488, 538, 600, 633, 686, 739, 784];
const EXP = [14, 24, 34, 45, 55, 66, 77, 89, 101, 114, 127, 141, 156, 172, 189, 207];

/** Build a combat-ready creature of the given level. `rng` = R from rng.js. */
export function creatureFor(level, rng, dk = 0) {
    const L = Math.max(1, Math.min(16, level));
    const base = rng.pick(CREATURES[L]);
    const v = () => 0.9 + rng.f() * 0.2;
    const dkMul = 1 + dk * 0.02;
    return {
        ...base,
        level: L,
        maxhp: Math.max(5, Math.round((7 * L - 1) * v() * dkMul)),
        atk: Math.max(1, +((1.95 * L - 0.5) * v() * dkMul).toFixed(1)),
        def: Math.max(0.5, +((1.1 * L - 0.4) * v() * dkMul).toFixed(1)),
        gold: Math.round(GOLD[L - 1] * v()),
        exp: Math.round(EXP[L - 1] * v() * (1 + dk * 0.05)),
    };
}

export function soulFor(level, rng) {
    const base = rng.pick(SOULS);
    const L = Math.max(1, level);
    return { ...base, level: L, maxhp: 8 + L * 6, atk: 1 + L, def: 1 + Math.round(L * 0.8), gold: 0, exp: 0, favor: 6 + Math.round(L * 0.8) };
}
