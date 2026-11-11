// Gemheart Saga — the five regions of the Vale, their monsters, the region bosses, the four nemeses and the Gloam
// Sovereign. Pure data.
//
// A foe's stats come from its level (set by the story chapter or the patrol) times its multipliers:
//   hp = 70 · (1 + 0.32·(lv-1)) · m[0]      atk = 9 · (1 + 0.21·(lv-1)) · m[1]      every = attack interval in seconds
// weak: the gem colour (r, s, e, a) that hurts it double, and its skills of that colour 1.5×.
// abil: what it does besides hitting (see ABILITIES); rank: normal | elite | boss.
// res: the village material a patrol in the region pays in.
// art: the description the fal prompts were written from (dev/art/prompts.mjs). Monsters face LEFT, toward the hero.

export const ABILITIES = {
    stone: 'Its blows turn 3 gems to stone. Match next to stone to break it.',
    lock: 'Chains 3 gems in place. Match a chained gem to free it.',
    doom: 'Plants a doom gem that bursts for a heavy blow when its count runs out. Match it first!',
    drain: 'Drains 6 mana from your fullest pool.',
    heal: 'Every third attack it heals 8% of its health.',
    shield: 'Every other attack it raises a shield.',
    poison: 'Its bite poisons you for a few seconds.',
    enrage: 'Below half health it attacks much faster.',
    haste: 'Fast. Very fast.',
};

export const REGIONS = [
    {
        id: 'greenmarch', name: 'Greenmarch Meadows', res: 'wood', tint: '#7cc35a',
        art: 'rolling green meadows under a bright blue sky with drifting clouds, wildflowers, an old dirt road, a crumbling stone wall and a lone windmill on a far hill, a forest edge to one side',
        blurb: 'Farmland and hedgerow, where the Vale\'s troubles start small.',
        monsters: [
            { id: 'slime', name: 'Meadow Slime', m: [0.8, 0.8], every: 4.6, weak: 'r', abil: [], art: 'a round translucent green slime with a dandelion and a few pebbles floating inside it, big glossy eyes and a cheerful wobbly smile' },
            { id: 'boar', name: 'Thornback Boar', m: [1.1, 1.0], every: 5.0, weak: 'a', abil: ['stone'], art: 'a stocky wild boar with bristly brown fur, curved tusks and a ridge of bramble thorns growing along its back, pawing the ground angrily' },
            { id: 'goblin', name: 'Goblin Raider', m: [0.9, 1.1], every: 4.2, weak: 'r', abil: [], art: 'a scrawny green goblin raider in a dented pot helmet and patched leather, a jagged rusty dagger in one hand and a stolen chicken under its arm, grinning' },
            { id: 'hornet', name: 'Giant Hornet', m: [0.7, 0.9], every: 3.2, weak: 's', abil: ['poison', 'haste'], art: 'a dog-sized giant hornet with yellow and black stripes, glassy buzzing wings, a long gleaming stinger and compound red eyes' },
            { id: 'wolf', name: 'Dire Wolf', m: [1.0, 1.2], every: 4.4, weak: 'r', abil: [], art: 'a large shaggy grey dire wolf with yellow eyes and bared fangs, hackles raised, crouched to pounce' },
            { id: 'bandit', name: 'Bandit Captain', m: [2.2, 1.3], every: 4.6, weak: 'a', abil: ['lock', 'shield'], rank: 'elite', art: 'a swaggering human bandit captain with a red bandana, an eyepatch, a long coat, a curved sabre and a buckler, smirking' },
        ],
        boss: { id: 'tusk', name: 'Old Tusk, the Boar King', m: [5.5, 1.5], every: 5.2, weak: 'a', abil: ['stone', 'enrage'], rank: 'boss', art: 'an enormous ancient boar king with grey-white bristles, massive cracked yellow tusks hung with charms, a crown of brambles on its head and a scarred hide, snorting steam' },
    },
    {
        id: 'mirefen', name: 'Mirefen Marsh', res: 'grain', tint: '#6f9c86',
        art: 'a misty marsh at dusk with dark still water, twisted mangrove roots, hanging moss, cattails and lily pads, glowing will-o-wisp lights in the fog, a rotting boardwalk',
        blurb: 'Fog, reeds and drowned lanterns. The rice farmers keep their doors barred.',
        monsters: [
            { id: 'toad', name: 'Bog Toad', m: [1.0, 0.9], every: 4.8, weak: 'r', abil: ['poison'], art: 'a fat warty bog toad the size of a barrel with a mossy back, bulging orange eyes and a long sticky tongue lolling out' },
            { id: 'wisp', name: 'Will-o\'-Wisp', m: [0.7, 0.9], every: 3.8, weak: 'e', abil: ['drain'], art: 'a floating ghostly green flame with a mischievous little face, trailing sparks and wisps of fog' },
            { id: 'leech', name: 'Mire Leech', m: [1.0, 0.8], every: 4.0, weak: 'r', abil: ['heal'], art: 'a huge glistening black and olive-brown marsh leech rearing up, a round mouth ringed with tiny teeth, dripping slime' },
            { id: 'lizard', name: 'Lizardfolk Spear', m: [1.1, 1.1], every: 4.4, weak: 's', abil: ['lock'], art: 'a muscular green lizardfolk warrior with a bone necklace, a crest of red frills and a barbed fishing spear held ready' },
            { id: 'shaman', name: 'Swamp Shaman', m: [0.9, 1.2], every: 4.6, weak: 'r', abil: ['doom'], art: 'a hunched frog-like swamp shaman in a cloak of reeds and feathers, holding a gnarled staff topped with a glowing skull, eyes glowing yellow' },
            { id: 'troll', name: 'Mire Troll', m: [2.5, 1.3], every: 5.2, weak: 'r', abil: ['heal', 'stone'], rank: 'elite', art: 'a hulking mossy marsh troll with long arms, green-grey warty skin, weeds and mud dripping from it, a log for a club' },
        ],
        boss: { id: 'murk', name: 'Mother Murk', m: [5.2, 1.5], every: 4.8, weak: 'r', abil: ['doom', 'heal', 'enrage'], rank: 'boss', art: 'a towering bog hag rising from the swamp, long tangled hair of black weeds, sickly green skin, a crooked smile of sharp teeth, a shawl of lily pads and hanging lanterns, long clawed fingers' },
    },
    {
        id: 'emberdeep', name: 'Emberdeep Mines', res: 'ore', tint: '#e07a3c',
        art: 'a deep dwarven mine cavern lit by rivers of glowing orange lava, old mine-cart rails on a rocky floor, wooden support beams, glittering ore veins in the walls, embers drifting in hot air',
        blurb: 'The old dwarf-holds, gone quiet. The lava has risen.',
        monsters: [
            { id: 'kobold', name: 'Kobold Miner', m: [0.9, 1.0], every: 4.2, weak: 's', abil: [], art: 'a small red-scaled kobold in an oversized miner\'s helmet with a candle on top, a pickaxe over its shoulder and a sack of glittering ore' },
            { id: 'beetle', name: 'Fire Beetle', m: [1.2, 0.9], every: 4.8, weak: 's', abil: ['shield'], art: 'a big armoured beetle with a glossy black shell cracked with glowing orange lava seams and flickering flames on its back' },
            { id: 'bat', name: 'Ember Bat', m: [0.7, 1.0], every: 3.4, weak: 's', abil: ['haste'], art: 'a bat with smouldering wings edged in fire, a glowing ember body and tiny fangs, flying' },
            { id: 'salamander', name: 'Magma Salamander', m: [1.1, 1.2], every: 4.6, weak: 's', abil: ['poison'], art: 'a long salamander with black rocky skin split by glowing magma cracks, a frilled head and a tail dripping fire' },
            { id: 'miner', name: 'Cursed Miner', m: [1.0, 1.1], every: 4.4, weak: 'e', abil: ['stone'], art: 'a skeletal dwarf miner in a rusted helmet and tattered apron, a lantern with a ghostly blue flame, a cracked pickaxe, a long grey beard still clinging to its skull' },
            { id: 'golem', name: 'Obsidian Golem', m: [2.8, 1.2], every: 5.6, weak: 's', abil: ['stone', 'shield'], rank: 'elite', art: 'a massive golem of glossy black obsidian blocks with glowing orange magma veins and a single burning eye in its head, huge fists' },
        ],
        boss: { id: 'cinderjaw', name: 'Cinderjaw, the Magma Wyrm', m: [5.6, 1.6], every: 5.0, weak: 's', abil: ['stone', 'doom', 'enrage'], rank: 'boss', art: 'a huge wingless magma wyrm coiled in the lava, black basalt scales split with glowing orange cracks, a jaw full of fire, smoke pouring from its nostrils, horns like volcanic rock' },
    },
    {
        id: 'frostfang', name: 'Frostfang Peaks', res: 'crystal', tint: '#9ad0f0',
        art: 'a snowy mountain pass between towering frozen peaks, glittering blue ice crystals jutting from the snow, an old stone shrine half buried in drifts, a pale aurora in a twilight sky',
        blurb: 'Wind, ice and the crystal veins the mages pay a fortune for.',
        monsters: [
            { id: 'imp', name: 'Frost Imp', m: [0.8, 1.0], every: 3.8, weak: 'r', abil: ['lock'], art: 'a small mischievous pale-blue imp with icicle horns, frosty bat wings and a pointed tail, juggling a snowball and cackling' },
            { id: 'harpy', name: 'Rime Harpy', m: [0.9, 1.1], every: 3.6, weak: 'r', abil: ['haste'], art: 'a harpy with white and pale-blue feathered wings, icy talons, a wild mane of frosted hair and a shrieking mouth, flying' },
            { id: 'yeti', name: 'Snow Yeti', m: [1.4, 1.2], every: 5.0, weak: 'r', abil: [], art: 'a big shaggy white yeti with blue-grey skin on its face and hands, long arms raised, roaring' },
            { id: 'wraith', name: 'Ice Wraith', m: [0.9, 1.2], every: 4.4, weak: 'r', abil: ['drain', 'doom'], art: 'a floating spectral wraith in tattered robes made of frost and mist, a crown of icicles, glowing pale blue eyes and long skeletal hands' },
            { id: 'ram', name: 'Crystal Ram', m: [1.2, 1.1], every: 4.6, weak: 'a', abil: ['shield'], art: 'a mountain ram with thick white wool and huge curled horns made of glowing blue crystal' },
            { id: 'jarl', name: 'Frost Giant Jarl', m: [2.8, 1.4], every: 5.2, weak: 'r', abil: ['stone', 'lock'], rank: 'elite', art: 'a towering frost giant jarl with blue skin, a braided white beard full of ice, a horned helm, a fur cloak and a huge frozen axe' },
        ],
        boss: { id: 'hrimfrost', name: 'Hrimfrost, the Ice Titan', m: [6.0, 1.6], every: 5.4, weak: 'r', abil: ['lock', 'shield', 'enrage'], rank: 'boss', art: 'a colossal titan of living glacier ice with jagged crystal armour, a frozen waterfall for a beard, cold blue light glowing in its chest and eyes, one fist raised' },
    },
    {
        id: 'gloamspire', name: 'Gloamspire', res: 'crystal', tint: '#9a6ad8',
        art: 'the courtyard of a ruined black citadel under a violet twilight sky with a huge pale moon, broken gothic towers and arches, floating shards of dark crystal, purple flames in iron braziers, mist over cracked flagstones',
        blurb: 'The citadel where the light of the Vale is going.',
        monsters: [
            { id: 'shade', name: 'Gloam Shade', m: [0.9, 1.1], every: 3.8, weak: 'e', abil: ['drain'], art: 'a hovering shadowy humanoid figure made of violet smoke with glowing white eyes and long wispy clawed hands' },
            { id: 'skeleton', name: 'Skeleton Knight', m: [1.2, 1.2], every: 4.4, weak: 'e', abil: ['shield'], art: 'a skeleton knight in rusted black plate armour with a torn purple cape, a notched longsword and a round shield, purple fire in its eye sockets' },
            { id: 'gargoyle', name: 'Gargoyle', m: [1.3, 1.1], every: 4.8, weak: 'e', abil: ['stone'], art: 'a stone gargoyle with bat wings, horns, a grinning fanged face and cracked grey stone skin, crouched on its haunches' },
            { id: 'cultist', name: 'Gloam Cultist', m: [0.9, 1.3], every: 4.4, weak: 'r', abil: ['doom', 'lock'], art: 'a hooded cultist in black and violet robes with a silver mask, holding a dagger and a book that leaks purple light' },
            { id: 'hound', name: 'Shadow Hound', m: [1.0, 1.2], every: 3.6, weak: 'e', abil: ['haste', 'poison'], art: 'a gaunt black hound made of shadow and smoke with glowing violet eyes and a mane of dark flame, snarling' },
            { id: 'revenant', name: 'Gloam Revenant', m: [2.8, 1.4], every: 4.8, weak: 'e', abil: ['drain', 'doom', 'shield'], rank: 'elite', art: 'a towering undead revenant in ornate cracked black armour, a ragged violet cloak, a greatsword dripping dark mist, a crown of broken iron' },
        ],
        boss: { id: 'sovereign', name: 'The Gloam Sovereign', m: [7.5, 1.7], every: 5.0, weak: 'e', abil: ['drain', 'doom', 'lock', 'enrage'], rank: 'boss', art: 'a tall regal sorcerer-king of shadow wearing a crown of black crystal shards, a long robe of starless night with violet flames along its hem, a pale masked face with burning violet eyes, one hand cradling a captured orb of golden light' },
    },
];

// Each hero's nemesis: fought in chapter 5 (they retreat) and chapter 9.
export const NEMESES = [
    { id: 'varek', hero: 'kael', name: 'Sir Varek the Oathbreaker', m: [5.0, 1.6], every: 4.6, weak: 'a', abil: ['shield', 'lock', 'enrage'], rank: 'boss', art: 'a tall fallen knight in blackened gold-trimmed plate armour with a cracked sun sigil on the breastplate, a long dark cape, a two-handed greatsword wreathed in grey flame, a cold handsome face with a short silver beard' },
    { id: 'quell', hero: 'sela', name: 'Magister Quell', m: [4.6, 1.6], every: 4.4, weak: 'e', abil: ['drain', 'doom', 'enrage'], rank: 'boss', art: 'an old archmage risen from the water, sodden dark blue robes dripping and trailing seaweed, a long white beard, barnacles on his shoulders, a coral staff with a cracked pearl, empty glowing teal eyes, books floating around him' },
    { id: 'rotroot', hero: 'fenn', name: 'Rotroot, the Blight Treant', m: [5.4, 1.5], every: 5.0, weak: 'r', abil: ['poison', 'stone', 'heal'], rank: 'boss', art: 'a huge diseased treant with blackened rotting bark, sickly purple fungus and glowing pustules along its trunk, dead branches like antlers, a hollow face with burning violet eyes and grasping root-claws' },
    { id: 'vesper', hero: 'odo', name: 'Vesper, the Ashen Priestess', m: [4.8, 1.6], every: 4.6, weak: 'e', abil: ['drain', 'lock', 'shield'], rank: 'boss', art: 'a pale priestess in grey and white robes turned to ash at the hems, a veil of black lace, a censer swinging from a chain trailing grey smoke and dark sparks, a snuffed-out candle crown on her head' },
];

export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const FOE = {};
for (const r of REGIONS) {
    for (const m of r.monsters) FOE[m.id] = { rank: 'normal', ...m, region: r.id };
    FOE[r.boss.id] = { ...r.boss, region: r.id };
}
for (const n of NEMESES) FOE[n.id] = { ...n, region: null };
