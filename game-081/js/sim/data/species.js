// The monsters of Gloamhollow. Pure data. Each species has a silhouette — the scan grid's mask, 7
// wide × 8 tall: '.' is body, ' ' is outside it — and the afflictions it tends to come in with.

export const SPECIES = {
    goblin: {
        label: 'Goblin', voice: 1.25, height: 1.1,
        names: ['Nib', 'Grub', 'Skritch', 'Moll', 'Pockets', 'Tansy', 'Wort', 'Fidget'],
        lean: ['thorn', 'gash', 'bruise', 'spider', 'nightmare', 'scorch'],
        lore: 'Small, nosy and braver than they look. Goblins run the night markets and know every tunnel.',
        mask: ['.. . ..', '.......', ' ..... ', '.......', '.......', '.......', ' .. .. ', ' .. .. '],
    },
    slime: {
        label: 'Slime', voice: 0.8, height: 0.9,
        names: ['Gloop', 'Wobbleton', 'Splotch', 'Jelly Jim', 'Ooze', 'Quiver'],
        lean: ['acid', 'wyrmbile', 'rotspore', 'nightshade', 'frostbite', 'sigil'],
        lore: 'Slimes eat what dungeons drop and keep the halls clean. They are mostly water and good manners.',
        mask: ['  ...  ', ' ..... ', '.......', '.......', '.......', '.......', '.......', '.......'],
    },
    myconid: {
        label: 'Myconid', voice: 0.9, height: 1.3,
        names: ['Fen', 'Puffcap', 'Old Morel', 'Chanterelle', 'Spindle', 'Truffet'],
        lean: ['rotspore', 'wither', 'acid', 'thorn', 'nightshade', 'scorch'],
        lore: 'Mushroom folk who talk in spores and remember everything the forest ever dreamed.',
        mask: [' ..... ', '.......', '.......', '  ...  ', ' ..... ', '.......', ' ..... ', ' .. .. '],
    },
    imp: {
        label: 'Imp', voice: 1.45, height: 0.8,
        names: ['Cinder', 'Snick', 'Brimby', 'Ashlet', 'Tock', 'Fizz'],
        lean: ['gash', 'scorch', 'holyfire', 'sigil', 'bruise', 'chain'],
        lore: 'Imps carry messages for the Overlord, fast as sparks and twice as rude.',
        mask: ['.  .  .', '.. . ..', '.......', '.......', ' ..... ', '.......', ' ..... ', ' .. .. '],
    },
    owlbear: {
        label: 'Owlbear', voice: 0.6, height: 2.3,
        names: ['Mother Bramblehide', 'Hoot', 'Barkpaw', 'Tumble'],
        lean: ['gash', 'thorn', 'fracture', 'spider', 'bruise'],
        lore: 'The forest\'s great guardians, fierce as bears and wise as owls. They nest in old hollows.',
        mask: ['..   ..', '.......', '.......', '.......', '.......', '.......', '.......', '.. . ..'],
    },
    skeleton: {
        label: 'Skeleton', voice: 1.05, height: 1.75,
        names: ['Rattle', 'Sir Femur', 'Clatterby', 'Ulna', 'Knucklebones', 'Marrow'],
        lean: ['fracture', 'sigil', 'chain', 'wither', 'nightmare', 'frostbite'],
        lore: 'Skeletons keep the crypts tidy and the old stories straight. They feel hexes in their bones, literally.',
        mask: [' ..... ', ' ..... ', '  ...  ', '.......', '.. . ..', '.......', '.. . ..', ' .. .. '],
    },
    ghost: {
        label: 'Ghost', voice: 1.6, height: 1.2,
        names: ['Wisp', 'Hollow Hal', 'Murmur', 'Sigh', 'Pale Peg', 'Echo'],
        lean: ['nightmare', 'sigil', 'chain', 'frostbite', 'wither', 'holyfire'],
        lore: 'Ghosts are memories that stayed on to look after a place. Most are shy. All are cold.',
        mask: [' ..... ', '.......', '.......', '.......', '.......', ' ..... ', ' .. .. ', '.  .  .'],
    },
    banshee: {
        label: 'Banshee', voice: 1.7, height: 2.1,
        names: ['The Weeping Lady'],
        lean: ['sigil', 'nightmare', 'chain', 'frostbite', 'wither'],
        lore: 'Wardens of the dead. A banshee\'s song tells the spirits where to rest, and it should never be a scream.',
        mask: [' ..... ', '.......', '.. . ..', '.......', '.......', '.......', ' ..... ', '  . .  '],
    },
    kobold: {
        label: 'Kobold', voice: 1.3, height: 1.0,
        names: ['Tik', 'Ore-Ella', 'Pick', 'Soot', 'Gravel', 'Nugget'],
        lean: ['scorch', 'fracture', 'bruise', 'acid', 'wyrmbile', 'gash'],
        lore: 'Dragon-kin miners who sing to the stone. They keep Emberpeak\'s forges and its dragon\'s hoard.',
        mask: [' ...   ', '.....  ', ' ....  ', '...... ', '.......', ' ......', ' .. ...', ' .. . .'],
    },
    golem: {
        label: 'Golem', voice: 0.5, height: 2.4,
        names: ['Cobble', 'Big Slab', 'Granite', 'Keystone'],
        lean: ['fracture', 'chain', 'sigil', 'acid', 'frostbite', 'scorch'],
        lore: 'Stone given a name and a job. Golems guard the Citadel and never, ever forget a face.',
        mask: ['  ...  ', '.......', '.......', '.. . ..', '.......', '.......', '... ...', '... ...'],
    },
    gargoyle: {
        label: 'Gargoyle', voice: 0.85, height: 1.6,
        names: ['Grotesque', 'Spout', 'Crag', 'Nightperch', 'Lichen'],
        lean: ['fracture', 'wither', 'chain', 'holyfire', 'scorch', 'nightmare'],
        lore: 'Gargoyles watch the Citadel\'s towers by night and turn to stone by day. Terrible gossips.',
        mask: ['.. . ..', '.......', '.......', ' ..... ', '.......', ' ..... ', '  ...  ', ' .. .. '],
    },
    troll: {
        label: 'Troll', voice: 0.55, height: 2.5,
        names: ['Bogdan', 'Mossmaw', 'Lumpkin', 'Granny Gnarl'],
        lean: ['gash', 'bruise', 'thorn', 'rotspore', 'holyfire', 'acid'],
        lore: 'Bridge-keepers and cooks. A troll heals fast, which is why the Company cuts them so often.',
        mask: [' ..... ', '.......', '.......', '.......', '.......', '.......', '.. . ..', '.. . ..'],
    },
    dragon: {
        label: 'Ember Wyrm', voice: 0.45, height: 4,
        names: ['Ignatia'],
        lean: ['scorch', 'gash', 'fracture', 'holyfire', 'acid'],
        lore: 'The last great dragon of Gloamhollow, keeper of Emberpeak, mother of one stolen egg.',
        mask: ['.  .  .', '.. . ..', '.......', '.......', '.......', ' ..... ', '  ... .', ' .. ...'],
    },
    overlord: {
        label: 'Overlord', voice: 0.4, height: 4.2,
        names: ['Grimwald the Gentle'],
        lean: ['scorch', 'holyfire', 'sigil', 'nightmare', 'chain', 'wither'],
        lore: 'Three hundred years on the Lantern Throne. Gardener, poet, keeper of the Peace of Lanterns.',
        mask: ['..    ..', '...  ...', '........', '........', '.. .. ..', '........', '........', ' ...... ', '  ....  '],
    },
};
export const SPECIES_IDS = Object.keys(SPECIES);

/** The Overlord's three boards. */
export const OVERLORD_MASKS = {
    wrath: ['..    ..', '...  ...', '........', '........', '.. .. ..', '........', '........', ' ...... ', '  ....  '],
    lies: [' ..  .. ', '........', '........', '........', '........', ' ...... ', '  ....  ', '........', '........'],
    diadem: ['.  ..  .', '.. .. ..', '........', '........', '........', '........', '........', '........', ' ...... '],
};

/** The cast who are not patients (models and portraits only). */
export const CAST = {
    clasp: { label: 'Clasp', role: 'Receptionist (a mimic)', voice: 1.15 },
    ossa: { label: 'Ossa', role: 'Head nurse', voice: 0.95 },
    pip: { label: 'Pip', role: 'Wisp of the Lumen Lens', voice: 1.9 },
    you: { label: 'You', role: 'The Healer', voice: 1.0 },
    aldric: { label: 'Sir Aldric Goldspur', role: 'The Gilded Company', voice: 0.75 },
    vessa: { label: 'Vessa Nightquill', role: 'The Gilded Company', voice: 1.2 },
    corvin: { label: 'Magister Corvin Hale', role: 'The Gilded Company', voice: 0.85 },
    lumina: { label: 'Sister Lumina', role: 'The Gilded Company', voice: 1.3 },
};
