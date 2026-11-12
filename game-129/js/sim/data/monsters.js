// HOLLOWDEEP — the strata of the dungeon and the monsters that live in them. Pure data.
//
// Eight strata of five floors each; the fifth floor of every stratum holds its guardian. Past floor 40 the strata
// come round again as Echoes (deeper, stronger, recoloured): the Hollowdeep has no bottom anyone has found.
//
// Monster stats are the stratum-1 baseline; js/sim/stats.js scales them by floor. `art` is the fal prompt for the
// sprite (dev/art/prompts.mjs builds every request from these fields, so art and game stay in step).
//   el:     the element of its attack ('phys' | 'fire' | 'ice' | 'bolt' | 'holy' | 'dark')
//   weak / resist: element lists
//   acts:   the special actions it may take instead of a plain attack (js/sim/battle.js MONSTER_ACTS)
//   undead: holy deals double damage and Turn Undead can banish it

export const STRATA = [
    {
        id: 'catacombs', floor: 'worn grey flagstones with moss in the cracks and scattered small bones', name: 'Mossy Catacombs', key: 'magenta',
        tint: 0x9fb48a, fog: 0x0d1410, light: 0xffb36a,
        art: 'ancient underground catacombs of grey stone blocks with green moss, burial niches and skull-lined alcoves, iron torch sconces',
        monsters: ['bone_rat', 'crypt_bat', 'moss_slime', 'skeleton', 'ghoul', 'wisp'],
        boss: 'ossuary_knight',
    },
    {
        id: 'grotto', floor: 'damp uneven cave rock with puddles, pebbles and tiny glowing cyan fungi', name: 'Glimmer Grotto', key: 'magenta',
        tint: 0x8fb8c8, fog: 0x081218, light: 0x7fe0ff,
        art: 'a natural limestone cavern lit by giant bioluminescent cyan mushrooms, dripping stalactites and glittering crystal seams',
        monsters: ['sporeling', 'cave_beetle', 'glow_moth', 'myconid_shaman', 'rock_lizard', 'kobold'],
        boss: 'mother_mycelia',
    },
    {
        id: 'drowned', floor: 'cracked white marble tiles under a film of shallow green water with barnacles', name: 'Drowned Halls', key: 'magenta',
        tint: 0x7aa6a8, fog: 0x06141a, light: 0x9fd8e8,
        art: 'a half-flooded sunken temple of cracked white marble columns, ankle-deep green water, barnacles and hanging seaweed',
        monsters: ['kelp_horror', 'merrow', 'giant_crab', 'drowned_sailor', 'eel_serpent', 'siren'],
        boss: 'brine_leviathan',
    },
    {
        id: 'foundry', floor: 'black basalt slabs and iron grating with thin cracks of glowing orange lava', name: 'Ember Foundry', key: 'green',
        tint: 0xc8906a, fog: 0x1a0a06, light: 0xff8040,
        art: 'an abandoned dwarven foundry carved into black basalt, glowing lava channels, iron gratings, chains and anvils',
        monsters: ['fire_imp', 'magma_slug', 'iron_golem', 'salamander', 'ember_hound', 'dwarf_revenant'],
        boss: 'forgefather',
    },
    {
        id: 'ossuary', floor: 'frosted grey flagstones under a skin of blue ice with snow drifts', name: 'Frozen Ossuary', key: 'magenta',
        tint: 0xb8cce0, fog: 0x0c1420, light: 0xb0d8ff,
        art: 'a frozen crypt of blue ice walls with bones and skulls frozen inside the ice, frost-covered stone floor, icicles',
        monsters: ['frost_wolf', 'ice_wraith', 'yeti', 'rime_archer', 'snow_harpy', 'frost_thrall'],
        boss: 'winter_lich',
    },
    {
        id: 'thornwood', floor: 'packed dark earth crossed by gnarled roots, moss and fallen leaves', name: 'Thornwood Hollow', key: 'magenta',
        tint: 0x8aa868, fog: 0x0a1206, light: 0xd8f080,
        art: 'an underground forest of twisted giant roots and thorny vines growing through ruined stone walls, glowing pollen in the air',
        monsters: ['treant_sapling', 'thorn_dryad', 'mantis', 'venom_toad', 'owlbear', 'vine_strangler'],
        boss: 'elder_briar',
    },
    {
        id: 'clockwork', floor: 'riveted brass and iron floor plates with inset gears and grooves', name: 'Clockwork Vault', key: 'magenta',
        tint: 0xc8a870, fog: 0x140e06, light: 0xffd080,
        art: 'a vast vault of brass machinery, turning bronze gears in the walls, copper pipes venting steam, riveted iron floor plates',
        monsters: ['gear_spider', 'brass_sentry', 'clock_owl', 'steam_knight', 'mimic', 'copper_golem'],
        boss: 'orrery_engine',
    },
    {
        id: 'sanctum', floor: 'polished black obsidian flagstones veined with violet starlight', name: 'Starsunk Sanctum', key: 'green',
        tint: 0xa898d8, fog: 0x0a0618, light: 0xc8a0ff,
        art: 'a ruined cathedral sunk into a starry void, floating obsidian flagstones, violet starlight through broken stained glass',
        monsters: ['void_eye', 'star_jelly', 'astral_knight', 'nebula_moth', 'fallen_seraph', 'shadow_fiend'],
        boss: 'hollow_king',
    },
];

// hp atk def mag res spd: stratum-1 baseline; xp and gold likewise
export const MONSTERS = {
    // ------------------------------------------------------------------ Mossy Catacombs
    bone_rat: { name: 'Bone Rat', hp: 14, atk: 6, def: 2, mag: 1, res: 1, spd: 9, xp: 6, gold: 4, el: 'phys', weak: ['fire'], resist: [], acts: ['bite'],
        art: 'a mangy giant rat with patches of exposed skeleton and glowing red eyes, hunched and snarling' },
    crypt_bat: { name: 'Crypt Bat', hp: 11, atk: 5, def: 1, mag: 2, res: 2, spd: 13, xp: 6, gold: 3, el: 'phys', weak: ['bolt'], resist: [], acts: ['drain'], fly: true,
        art: 'a large leathery cave bat with tattered wings spread wide, fangs bared, pale ghostly glow' },
    moss_slime: { name: 'Moss Slime', hp: 20, atk: 5, def: 4, mag: 3, res: 1, spd: 4, xp: 7, gold: 5, el: 'phys', weak: ['fire'], resist: ['phys'], acts: ['poison'],
        art: 'a quivering translucent green slime blob with moss, pebbles and a tiny skull floating inside it' },
    skeleton: { name: 'Skeleton Soldier', hp: 22, atk: 8, def: 5, mag: 1, res: 2, spd: 7, xp: 10, gold: 8, el: 'phys', weak: ['holy', 'bolt'], resist: ['dark'], acts: [], undead: true,
        art: 'a skeleton warrior in rusted chainmail holding a notched sword and a cracked round shield' },
    ghoul: { name: 'Ghoul', hp: 28, atk: 9, def: 3, mag: 2, res: 3, spd: 6, xp: 12, gold: 9, el: 'phys', weak: ['holy', 'fire'], resist: [], acts: ['paralyze'], undead: true,
        art: 'a gaunt grey-skinned ghoul with long claws and a hungry fanged maw, crouching in tattered burial wraps' },
    wisp: { name: 'Will-o\'-Wisp', hp: 16, atk: 3, def: 8, mag: 9, res: 6, spd: 12, xp: 12, gold: 10, el: 'fire', weak: ['ice'], resist: ['phys'], acts: ['flame'], fly: true,
        art: 'a floating wisp of pale blue-green ghost fire with a faint mournful face in the flames' },
    ossuary_knight: { name: 'The Ossuary Knight', hp: 260, atk: 15, def: 9, mag: 6, res: 6, spd: 8, xp: 160, gold: 140, el: 'phys', weak: ['holy'], resist: ['dark', 'ice'], acts: ['cleave', 'warcry', 'drain'], undead: true, boss: true,
        art: 'a towering undead knight in black plate armour fused with bones, a skull helm crowned with candles, wielding a huge rusted greatsword, green soul-fire in its ribs' },

    // ------------------------------------------------------------------ Glimmer Grotto
    sporeling: { name: 'Sporeling', hp: 18, atk: 6, def: 3, mag: 4, res: 3, spd: 7, xp: 7, gold: 5, el: 'phys', weak: ['fire'], resist: [], acts: ['sleep'],
        art: 'a small walking mushroom creature with a spotted cyan glowing cap, stubby legs and beady eyes, puffing spores' },
    cave_beetle: { name: 'Cave Beetle', hp: 24, atk: 8, def: 8, mag: 1, res: 2, spd: 5, xp: 9, gold: 6, el: 'phys', weak: ['bolt'], resist: ['phys'], acts: ['bite'],
        art: 'a huge armoured cave beetle with an iridescent blue-black shell and big mandibles' },
    glow_moth: { name: 'Glow Moth', hp: 15, atk: 4, def: 2, mag: 7, res: 5, spd: 14, xp: 8, gold: 6, el: 'bolt', weak: ['fire'], resist: [], acts: ['blind', 'spark'], fly: true,
        art: 'a giant moth with luminous turquoise eye-spot wings and feathery antennae, scattering glowing dust' },
    myconid_shaman: { name: 'Myconid Shaman', hp: 26, atk: 5, def: 4, mag: 10, res: 7, spd: 6, xp: 13, gold: 11, el: 'dark', weak: ['fire'], resist: ['dark'], acts: ['heal_ally', 'poison'],
        art: 'a tall mushroom-person shaman with a drooping violet cap, a staff of twisted root and a necklace of glowing caps' },
    rock_lizard: { name: 'Rock Lizard', hp: 30, atk: 10, def: 7, mag: 1, res: 3, spd: 8, xp: 12, gold: 8, el: 'phys', weak: ['ice'], resist: [], acts: ['bite'],
        art: 'a heavy lizard with grey stone-plated scales and crystal growths along its spine, mouth open' },
    kobold: { name: 'Pale Kobold', hp: 22, atk: 9, def: 4, mag: 3, res: 3, spd: 10, xp: 11, gold: 14, el: 'phys', weak: ['holy'], resist: [], acts: ['steal', 'bomb'],
        art: 'a small pale-scaled kobold miner with a pickaxe, a candle stuck on its helmet and a sack of stolen coins' },
    mother_mycelia: { name: 'Mother Mycelia', hp: 420, atk: 14, def: 8, mag: 16, res: 10, spd: 7, xp: 300, gold: 240, el: 'dark', weak: ['fire'], resist: ['dark', 'bolt'], acts: ['sleep_all', 'poison_all', 'heal_self'], boss: true,
        art: 'an enormous fungal queen, a womanlike figure grown from layered glowing cyan and violet mushroom caps and mycelium threads, rooted to the floor, regal and eerie' },

    // ------------------------------------------------------------------ Drowned Halls
    kelp_horror: { name: 'Kelp Horror', hp: 30, atk: 9, def: 5, mag: 6, res: 5, spd: 6, xp: 14, gold: 10, el: 'phys', weak: ['fire'], resist: ['ice'], acts: ['entangle'],
        art: 'a shambling mass of dripping kelp and seaweed with a gaping mouth and two pale glowing eyes' },
    merrow: { name: 'Merrow Raider', hp: 32, atk: 12, def: 6, mag: 3, res: 4, spd: 9, xp: 16, gold: 14, el: 'phys', weak: ['bolt'], resist: ['ice'], acts: ['pierce'],
        art: 'a scaly fish-man warrior with fins and a barbed coral trident, wearing scraps of a ship sail' },
    giant_crab: { name: 'Giant Crab', hp: 38, atk: 13, def: 12, mag: 1, res: 4, spd: 5, xp: 17, gold: 12, el: 'phys', weak: ['bolt'], resist: ['phys', 'ice'], acts: ['bite'],
        art: 'a giant red-orange armoured crab raising one oversized barnacle-crusted claw' },
    drowned_sailor: { name: 'Drowned Sailor', hp: 34, atk: 11, def: 5, mag: 4, res: 4, spd: 6, xp: 15, gold: 16, el: 'phys', weak: ['holy', 'bolt'], resist: ['ice'], acts: ['drain'], undead: true,
        art: 'a bloated drowned zombie sailor in a torn striped shirt with a rusty cutlass, seaweed in its hair, water dripping' },
    eel_serpent: { name: 'Eel Serpent', hp: 28, atk: 12, def: 4, mag: 8, res: 5, spd: 12, xp: 15, gold: 11, el: 'bolt', weak: ['ice'], resist: ['bolt'], acts: ['spark'],
        art: 'a long electric eel serpent rearing up in a coil, crackling with blue lightning along its fins' },
    siren: { name: 'Siren', hp: 26, atk: 6, def: 4, mag: 13, res: 9, spd: 11, xp: 18, gold: 18, el: 'ice', weak: ['bolt'], resist: ['ice'], acts: ['charm', 'frost'], fly: true,
        art: 'a beautiful but sinister harpy-like siren with sea-green feathered wings, a pale woman\'s face and talons' },
    brine_leviathan: { name: 'The Brine Leviathan', hp: 620, atk: 20, def: 11, mag: 18, res: 11, spd: 9, xp: 520, gold: 380, el: 'ice', weak: ['bolt'], resist: ['ice', 'fire'], acts: ['tidal', 'bite', 'frost'], boss: true,
        art: 'a colossal sea serpent leviathan rising from water, armoured teal scales, a crown of jagged fins, glowing abyssal eyes, mouth full of needle teeth' },

    // ------------------------------------------------------------------ Ember Foundry
    fire_imp: { name: 'Fire Imp', hp: 26, atk: 9, def: 5, mag: 13, res: 8, spd: 13, xp: 18, gold: 15, el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['flame'], fly: true,
        art: 'a mischievous red-skinned imp with bat wings, small horns, a pitchfork and flames dancing on its fingertips' },
    magma_slug: { name: 'Magma Slug', hp: 44, atk: 12, def: 10, mag: 10, res: 6, spd: 3, xp: 19, gold: 14, el: 'fire', weak: ['ice'], resist: ['fire', 'phys'], acts: ['burn'],
        art: 'a giant slug made of cooling black rock with cracks of glowing orange magma, trailing fire' },
    iron_golem: { name: 'Iron Golem', hp: 58, atk: 16, def: 16, mag: 1, res: 4, spd: 4, xp: 24, gold: 18, el: 'phys', weak: ['bolt'], resist: ['phys', 'fire'], acts: ['smash'],
        art: 'a hulking golem of riveted dark iron plates with a furnace glowing in its chest and huge fists' },
    salamander: { name: 'Salamander', hp: 36, atk: 14, def: 7, mag: 11, res: 7, spd: 10, xp: 20, gold: 16, el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['flame', 'burn'],
        art: 'a large orange-and-black spotted salamander with a back ridge of flickering flames' },
    ember_hound: { name: 'Ember Hound', hp: 38, atk: 15, def: 6, mag: 8, res: 5, spd: 14, xp: 21, gold: 15, el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['bite', 'flame'],
        art: 'a lean black hellhound with a mane of embers, smoking nostrils and glowing coal eyes' },
    dwarf_revenant: { name: 'Dwarf Revenant', hp: 46, atk: 16, def: 11, mag: 4, res: 6, spd: 7, xp: 24, gold: 26, el: 'phys', weak: ['holy'], resist: ['fire'], acts: ['cleave'], undead: true,
        art: 'an undead dwarf smith in scorched plate armour with a braided ash-grey beard and a glowing war hammer' },
    forgefather: { name: 'The Forgefather', hp: 860, atk: 26, def: 16, mag: 16, res: 10, spd: 8, xp: 780, gold: 560, el: 'fire', weak: ['ice'], resist: ['fire', 'phys'], acts: ['smash', 'eruption', 'warcry'], boss: true,
        art: 'a colossal dwarven automaton king of blackened iron and brass with a molten furnace face, a braided beard of chains and a giant glowing forge hammer' },

    // ------------------------------------------------------------------ Frozen Ossuary
    frost_wolf: { name: 'Frost Wolf', hp: 42, atk: 16, def: 7, mag: 6, res: 8, spd: 15, xp: 24, gold: 16, el: 'ice', weak: ['fire'], resist: ['ice'], acts: ['bite', 'howl'],
        art: 'a large white wolf with frost-crusted fur, icicles on its jaw and pale blue eyes, snarling' },
    ice_wraith: { name: 'Ice Wraith', hp: 34, atk: 8, def: 9, mag: 17, res: 12, spd: 12, xp: 26, gold: 20, el: 'ice', weak: ['fire', 'holy'], resist: ['ice', 'phys'], acts: ['frost', 'drain'], undead: true, fly: true,
        art: 'a floating hooded wraith of swirling snow and blue ice shards with long frozen claws' },
    yeti: { name: 'Yeti', hp: 66, atk: 19, def: 9, mag: 2, res: 6, spd: 7, xp: 28, gold: 20, el: 'phys', weak: ['fire'], resist: ['ice'], acts: ['smash'],
        art: 'a massive shaggy white yeti with blue-grey skin, long arms and a roaring mouth' },
    rime_archer: { name: 'Rime Archer', hp: 38, atk: 17, def: 8, mag: 5, res: 6, spd: 11, xp: 25, gold: 22, el: 'ice', weak: ['holy', 'fire'], resist: ['ice'], acts: ['pierce', 'frost'], undead: true,
        art: 'a skeleton archer encased in frost with a bow of black ice and a quiver of icicle arrows' },
    snow_harpy: { name: 'Snow Harpy', hp: 36, atk: 14, def: 6, mag: 10, res: 8, spd: 16, xp: 24, gold: 21, el: 'ice', weak: ['bolt'], resist: ['ice'], acts: ['frost', 'pierce'], fly: true,
        art: 'a savage harpy with white and grey feathers, icy talons and a shrieking face' },
    frost_thrall: { name: 'Frost Giant Thrall', hp: 80, atk: 21, def: 12, mag: 4, res: 7, spd: 5, xp: 32, gold: 28, el: 'ice', weak: ['fire'], resist: ['ice'], acts: ['cleave'],
        art: 'a blue-skinned frost giant thrall in chains and furs with an iron collar and a huge ice-crusted club' },
    winter_lich: { name: 'The Winter Lich', hp: 1080, atk: 22, def: 13, mag: 30, res: 18, spd: 11, xp: 1100, gold: 760, el: 'ice', weak: ['fire', 'holy'], resist: ['ice', 'dark'], acts: ['blizzard', 'drain', 'raise'], undead: true, boss: true,
        art: 'a skeletal lich sorcerer-king in frost-rimed robes of royal blue, a crown of icicles, a staff topped with a frozen heart, cold blue fire in its eye sockets' },

    // ------------------------------------------------------------------ Thornwood Hollow
    treant_sapling: { name: 'Treant Sapling', hp: 60, atk: 18, def: 12, mag: 6, res: 8, spd: 5, xp: 30, gold: 22, el: 'phys', weak: ['fire'], resist: ['bolt'], acts: ['entangle', 'smash'],
        art: 'a young walking tree creature with a knotted bark face, branch arms and roots for feet' },
    thorn_dryad: { name: 'Thorn Dryad', hp: 44, atk: 12, def: 8, mag: 19, res: 14, spd: 13, xp: 32, gold: 28, el: 'dark', weak: ['fire'], resist: [], acts: ['charm', 'heal_ally', 'entangle'],
        art: 'a wild dryad woman with bark skin, hair of thorny briars and red roses, holding a vine whip' },
    mantis: { name: 'Mantis Stalker', hp: 48, atk: 22, def: 9, mag: 3, res: 6, spd: 17, xp: 33, gold: 24, el: 'phys', weak: ['ice'], resist: [], acts: ['cleave'],
        art: 'a giant emerald praying mantis with scythe-like forearms raised to strike' },
    venom_toad: { name: 'Venom Toad', hp: 54, atk: 17, def: 8, mag: 12, res: 8, spd: 8, xp: 30, gold: 22, el: 'dark', weak: ['ice'], resist: ['dark'], acts: ['poison_all', 'bite'],
        art: 'a fat warty purple-and-yellow poison toad with bulging eyes and dripping venom' },
    owlbear: { name: 'Owlbear', hp: 84, atk: 24, def: 11, mag: 2, res: 6, spd: 9, xp: 38, gold: 26, el: 'phys', weak: ['bolt'], resist: [], acts: ['smash', 'howl'],
        art: 'a ferocious owlbear: the body of a brown bear with the feathered head and hooked beak of a great owl, rearing up' },
    vine_strangler: { name: 'Vine Strangler', hp: 64, atk: 20, def: 10, mag: 10, res: 8, spd: 6, xp: 34, gold: 24, el: 'phys', weak: ['fire'], resist: ['ice'], acts: ['entangle', 'drain'],
        art: 'a giant carnivorous plant with a toothy flower-mouth bulb and writhing thorny vine tentacles' },
    elder_briar: { name: 'The Elder Briar', hp: 1400, atk: 30, def: 18, mag: 24, res: 16, spd: 9, xp: 1500, gold: 980, el: 'dark', weak: ['fire'], resist: ['bolt', 'ice'], acts: ['entangle_all', 'heal_self', 'smash'], boss: true,
        art: 'a monstrous ancient tree beast of black thorned bark with a glowing amber heart in its trunk, a gaping knothole maw and antler-like branches' },

    // ------------------------------------------------------------------ Clockwork Vault
    gear_spider: { name: 'Gear Spider', hp: 56, atk: 22, def: 14, mag: 4, res: 8, spd: 15, xp: 38, gold: 30, el: 'phys', weak: ['bolt'], resist: ['dark'], acts: ['bite', 'entangle'],
        art: 'a mechanical spider of bronze gears and pistons with eight jointed brass legs and a single red lens eye' },
    brass_sentry: { name: 'Brass Sentry', hp: 70, atk: 24, def: 18, mag: 6, res: 10, spd: 8, xp: 40, gold: 34, el: 'phys', weak: ['bolt'], resist: ['phys', 'dark'], acts: ['pierce'],
        art: 'a clockwork guardian soldier of polished brass with a halberd and a round keyhole face' },
    clock_owl: { name: 'Clockwork Owl', hp: 46, atk: 16, def: 12, mag: 20, res: 14, spd: 18, xp: 38, gold: 32, el: 'bolt', weak: ['ice'], resist: ['bolt'], acts: ['spark', 'blind'], fly: true,
        art: 'a mechanical owl of copper and brass with clock faces for eyes and gear-feathered wings spread' },
    steam_knight: { name: 'Steam Knight', hp: 88, atk: 27, def: 17, mag: 8, res: 9, spd: 9, xp: 46, gold: 40, el: 'fire', weak: ['ice'], resist: ['phys'], acts: ['cleave', 'burn'],
        art: 'a heavy armoured knight powered by a steam boiler on its back, venting steam, wielding a piston-driven sword' },
    mimic: { name: 'Mimic', hp: 76, atk: 28, def: 14, mag: 12, res: 10, spd: 10, xp: 60, gold: 90, el: 'phys', weak: ['ice'], resist: [], acts: ['bite', 'drain'],
        art: 'a treasure chest mimic with a long purple tongue, rows of sharp teeth in the lid and gold coins spilling out' },
    copper_golem: { name: 'Copper Golem', hp: 100, atk: 26, def: 20, mag: 3, res: 8, spd: 5, xp: 50, gold: 38, el: 'bolt', weak: ['ice'], resist: ['bolt', 'phys'], acts: ['smash', 'spark'],
        art: 'a giant golem of green-patina copper coils and tesla rods crackling with electricity' },
    orrery_engine: { name: 'The Orrery Engine', hp: 1800, atk: 34, def: 22, mag: 30, res: 20, spd: 12, xp: 2000, gold: 1300, el: 'bolt', weak: ['ice'], resist: ['bolt', 'phys', 'dark'], acts: ['thunderstorm', 'smash', 'haste_self'], boss: true,
        art: 'a gigantic clockwork orrery machine-god with rotating brass rings and planet spheres around a glowing core, mechanical arms ending in blades, arcs of lightning' },

    // ------------------------------------------------------------------ Starsunk Sanctum
    void_eye: { name: 'Void Eye', hp: 60, atk: 14, def: 12, mag: 26, res: 18, spd: 14, xp: 46, gold: 36, el: 'dark', weak: ['holy'], resist: ['dark'], acts: ['curse', 'darkbolt'], fly: true,
        art: 'a floating giant eyeball with a violet iris and a halo of black tentacles, starlight inside its pupil' },
    star_jelly: { name: 'Star Jelly', hp: 66, atk: 16, def: 10, mag: 22, res: 16, spd: 10, xp: 44, gold: 34, el: 'bolt', weak: ['dark'], resist: ['bolt', 'phys'], acts: ['spark', 'paralyze'], fly: true,
        art: 'a translucent cosmic jellyfish full of tiny stars and nebula swirls, trailing glowing tentacles' },
    astral_knight: { name: 'Astral Knight', hp: 96, atk: 30, def: 20, mag: 14, res: 14, spd: 11, xp: 54, gold: 46, el: 'holy', weak: ['dark'], resist: ['holy'], acts: ['cleave', 'pierce'],
        art: 'a hollow knight of silver star-forged armour with a constellation visible inside the empty helm, wielding a sword of light' },
    nebula_moth: { name: 'Nebula Moth', hp: 58, atk: 18, def: 10, mag: 24, res: 16, spd: 18, xp: 48, gold: 38, el: 'dark', weak: ['fire'], resist: [], acts: ['sleep_all', 'blind'], fly: true,
        art: 'a huge moth whose wings are windows into a purple and pink nebula, glittering star dust falling' },
    fallen_seraph: { name: 'Fallen Seraph', hp: 90, atk: 26, def: 16, mag: 28, res: 20, spd: 15, xp: 60, gold: 50, el: 'holy', weak: ['dark'], resist: ['holy'], acts: ['holy_light', 'heal_ally'], fly: true,
        art: 'a fallen angel with six blackened and golden wings, a cracked halo and a weeping blindfolded face, holding a broken spear' },
    shadow_fiend: { name: 'Shadow Fiend', hp: 84, atk: 32, def: 14, mag: 20, res: 14, spd: 16, xp: 58, gold: 48, el: 'dark', weak: ['holy'], resist: ['dark', 'phys'], acts: ['curse', 'cleave'],
        art: 'a horned demon made of living shadow with burning white eyes and long smoky claws' },
    hollow_king: { name: 'The Hollow King', hp: 2600, atk: 40, def: 24, mag: 38, res: 24, spd: 14, xp: 3200, gold: 2000, el: 'dark', weak: ['holy'], resist: ['dark', 'ice', 'fire'], acts: ['eclipse', 'curse', 'drain', 'darkbolt'], boss: true,
        art: 'the Hollow King: a gaunt titanic king in a cloak of starry void, an empty crown floating above a faceless dark helm, a sceptre of black stars, cracks of violet light in his armour' },

    // ------------------------------------------------------------------ the roaming elite (any floor from 6)
    reaper: { name: 'Lantern Reaper', hp: 140, atk: 18, def: 10, mag: 16, res: 10, spd: 12, xp: 220, gold: 160, el: 'dark', weak: ['holy'], resist: ['dark', 'ice'], acts: ['cleave', 'drain', 'curse'], undead: true, elite: true,
        art: 'a tall robed reaper with a skull face hidden in a hood, carrying a scythe in one hand and an iron lantern of green ghost fire in the other' },
};

for (const [id, m] of Object.entries(MONSTERS)) m.id = id;
for (const [i, s] of STRATA.entries()) {
    s.idx = i;
    for (const id of [...s.monsters, s.boss]) MONSTERS[id].stratum = s.id;
}

export const FLOORS_PER_STRATUM = 5;

/** The stratum a floor belongs to, and which pass round the strata (0 = first, 1 = the first Echoes...). */
export function stratumOf(floor) {
    const i = Math.floor((floor - 1) / FLOORS_PER_STRATUM);
    return { stratum: STRATA[i % STRATA.length], cycle: Math.floor(i / STRATA.length), idx: i % STRATA.length };
}
export const isBossFloor = (floor) => floor % FLOORS_PER_STRATUM === 0;

// names of the deeper passes, prefixed to the monster names
export const ECHO = ['', 'Echoing', 'Abyssal', 'Ancient', 'Primordial', 'Nameless'];
export const echoName = (name, cycle) => (cycle ? `${ECHO[Math.min(cycle, ECHO.length - 1)]} ${name.replace(/^The /, '')}` : name);
