// EMBERSPIRE — the ten strata of the tower, their monsters, mini bosses and bosses. Pure data.
//
// Floors 1–100 run through the ten strata in order; past 100 the strata repeat as "Ascended" versions
// (cycle = Math.floor((floor - 1) / 100)), tinted and stronger. Every 5th floor is a mini boss, every 10th a boss.
//
// Monster stat multipliers m: [hp, atk, mag, def, res, spd], applied to the floor's base enemy (see enemyStats in
// battle.js). el is the element of its basic attack; weak and resist are element lists; acts are ability ids from
// skills.js (MONSTER_ACTS). art is the description the fal prompts were written from (dev/art/prompts.mjs).

export const ELEMENTS = ['phys', 'fire', 'ice', 'bolt', 'holy', 'dark', 'nature'];

export const BIOMES = [
    {
        id: 'undercroft', name: 'Mossy Undercroft', floors: [1, 10], tint: '#6fa35b',
        art: 'Mossy stone flagstone floor seen from a slight elevation, crumbling arches and pillars wrapped in roots and glowing mushrooms, iron braziers with warm flames, shafts of green-gold light, a staircase spiralling up in the far background',
        intro: 'Roots older than the town have cracked the flagstones. Something squelches in the dark.',
        monsters: [
            { id: 'moss_slime', name: 'Moss Slime', m: [0.9, 0.8, 0.6, 1.0, 0.8, 0.8], el: 'nature', weak: ['fire'], resist: ['phys'], acts: ['tackle', 'spit'], art: 'a translucent green gelatinous blob with moss, tiny mushrooms and a pebble inside its body, two beady glossy eyes, a cheeky grin' },
            { id: 'gnawer_rat', name: 'Gnawer Rat', m: [0.7, 1.0, 0.3, 0.7, 0.6, 1.4], el: 'phys', weak: ['fire', 'ice'], resist: [], acts: ['bite', 'bite', 'frenzy'], art: 'a dog-sized mangy brown sewer rat with yellow buck teeth, red eyes, a torn ear and a scaly tail' },
            { id: 'dusk_bat', name: 'Duskwing Bat', m: [0.6, 0.9, 0.5, 0.5, 0.8, 1.7], el: 'phys', weak: ['bolt', 'holy'], resist: ['nature'], acts: ['bite', 'drain', 'screech'], art: 'a purple cave bat with huge leathery wings spread wide, glowing amber eyes and tiny fangs, flying' },
            { id: 'goblin_scrapper', name: 'Goblin Scrapper', m: [1.0, 1.1, 0.4, 1.0, 0.7, 1.0], el: 'phys', weak: ['holy'], resist: [], acts: ['slash', 'slash', 'pocketsand'], art: 'a scrawny green goblin with a pot helmet, patched leather armour and a jagged rusty cleaver, grinning wickedly' },
            { id: 'puffcap', name: 'Puffcap', m: [0.9, 0.6, 1.1, 0.8, 1.1, 0.7], el: 'nature', weak: ['fire'], resist: ['nature', 'ice'], acts: ['spores', 'spit', 'sporecloud'], art: 'a waddling red-and-white spotted mushroom creature with stubby legs, a sleepy face and drifting yellow spores' },
        ],
        mini: { id: 'grubnak', name: 'Grubnak the Goblin Warchief', m: [3.2, 1.4, 0.6, 1.3, 1.0, 1.0], el: 'phys', weak: ['holy'], resist: [], acts: ['slash', 'cleave', 'warcry', 'slash'], art: 'a hulking goblin warchief with a horned iron helm, a bearskin cloak, a huge spiked club and war paint' },
        boss: { id: 'colossus', name: 'Rootbound Colossus', m: [7.5, 1.6, 1.0, 1.6, 1.2, 0.8], el: 'nature', weak: ['fire'], resist: ['phys', 'nature'], acts: ['quake', 'slam', 'regrow', 'slam', 'rootgrasp'], art: 'a towering golem of mossy stone blocks bound together by thick living roots, a glowing amber heart-crystal in its chest, mushrooms on its shoulders, massive fists' },
    },
    {
        id: 'grotto', name: 'Crystal Grotto', floors: [11, 20], tint: '#7fb7e8',
        art: 'A vast cavern of giant glowing blue and violet crystals jutting from the walls and ceiling, a smooth cave floor with shallow reflective pools, mine-cart rails and a wooden scaffold to one side, cold crystal light mixed with a warm lantern',
        intro: 'The walls ring like bells when you touch them. The light comes from inside the stone.',
        monsters: [
            { id: 'kobold_miner', name: 'Kobold Miner', m: [0.9, 1.1, 0.4, 1.0, 0.7, 1.1], el: 'phys', weak: ['ice'], resist: [], acts: ['slash', 'pickaxe', 'lantern'], art: 'a small red-scaled kobold in a miner\'s helmet with a candle on top, a pickaxe over its shoulder, a sack of glittering gems' },
            { id: 'crystal_spider', name: 'Crystal Spider', m: [0.8, 1.1, 0.7, 1.2, 1.0, 1.4], el: 'phys', weak: ['bolt'], resist: ['ice'], acts: ['bite', 'web', 'shardspray'], art: 'a large spider whose body is a cluster of pale blue crystals, glassy legs and many glowing cyan eyes' },
            { id: 'geode_tortoise', name: 'Geode Tortoise', m: [1.6, 0.9, 0.5, 2.0, 1.0, 0.5], el: 'phys', weak: ['bolt'], resist: ['phys', 'fire'], acts: ['tackle', 'harden', 'tackle'], art: 'a sturdy tortoise whose shell is a split-open geode full of purple amethyst crystals' },
            { id: 'shard_wisp', name: 'Shard Wisp', m: [0.6, 0.4, 1.3, 0.6, 1.5, 1.5], el: 'ice', weak: ['dark'], resist: ['ice', 'phys'], acts: ['frost', 'shardspray', 'frost'], art: 'a floating will-o-wisp of cold blue light with orbiting crystal shards and a faint mischievous face' },
            { id: 'quartz_mole', name: 'Quartz Mole', m: [1.1, 1.2, 0.4, 1.1, 0.8, 0.9], el: 'phys', weak: ['ice'], resist: ['bolt'], acts: ['claw', 'burrow', 'claw'], art: 'a chubby burrowing mole with huge shovel claws tipped with quartz, little round spectacles-like eyes, popping out of the ground' },
        ],
        mini: { id: 'basilisk', name: 'Prism Basilisk', m: [3.4, 1.4, 1.2, 1.5, 1.2, 1.0], el: 'ice', weak: ['bolt'], resist: ['ice'], acts: ['bite', 'petrigaze', 'shardspray', 'bite'], art: 'a long six-legged lizard covered in rainbow prism scales, a crown of crystal spikes and piercing white glowing eyes' },
        boss: { id: 'vitreous_wyrm', name: 'Vitreous Wyrm', m: [8, 1.5, 1.6, 1.8, 1.6, 1.0], el: 'ice', weak: ['bolt', 'fire'], resist: ['ice'], acts: ['crystalbreath', 'bite', 'harden', 'shardspray', 'crystalbreath'], art: 'a great serpentine dragon made of translucent blue-violet crystal, coiled, jagged crystal spines down its back, cold light glowing inside its body' },
    },
    {
        id: 'library', name: 'Haunted Library', floors: [21, 30], tint: '#b49ad8',
        art: 'An enormous haunted library hall, towering bookshelves vanishing into darkness, floating candles, books flying through the air, a carpeted floor with scattered parchment, a great arched stained-glass window glowing purple, cobwebs',
        intro: 'Pages turn by themselves. Somewhere above, a quill is still writing.',
        monsters: [
            { id: 'living_tome', name: 'Living Tome', m: [0.8, 0.6, 1.3, 0.8, 1.3, 1.1], el: 'dark', weak: ['fire'], resist: ['dark'], acts: ['papercut', 'darkbolt', 'curse'], art: 'a flying leather-bound spellbook with snapping page-teeth, a single eye on its cover and glowing runes drifting off its pages' },
            { id: 'ink_shade', name: 'Inkblot Shade', m: [0.8, 0.9, 1.1, 0.5, 1.2, 1.3], el: 'dark', weak: ['holy'], resist: ['phys', 'dark'], acts: ['darkbolt', 'drain', 'blind'], art: 'a dripping shadow made of black ink, a hunched ghostly shape with white hollow eyes and long inky claws' },
            { id: 'skeleton_scholar', name: 'Skeleton Scholar', m: [1.0, 0.8, 1.2, 1.0, 1.0, 0.9], el: 'dark', weak: ['holy', 'phys'], resist: ['ice', 'dark'], acts: ['darkbolt', 'frost', 'bonk'], art: 'a skeleton in tattered scholar robes and a square academic cap, round spectacles, holding an open tome and a bone wand' },
            { id: 'quill_imp', name: 'Quill Imp', m: [0.6, 1.0, 1.0, 0.6, 0.9, 1.7], el: 'phys', weak: ['ice'], resist: [], acts: ['stab', 'stab', 'inksplash'], art: 'a tiny mischievous purple imp riding a giant feather quill like a lance, with a little ink pot on its belt' },
            { id: 'wax_wraith', name: 'Wax Wraith', m: [0.9, 0.5, 1.3, 0.8, 1.1, 1.0], el: 'fire', weak: ['ice'], resist: ['fire', 'dark'], acts: ['firebolt', 'meltdown', 'firebolt'], art: 'a ghost made of melting candle wax, many candle flames burning on its head and shoulders, dripping wax hands' },
        ],
        mini: { id: 'grand_mimic', name: 'Grand Mimic', m: [3.5, 1.6, 0.8, 1.6, 1.0, 0.9], el: 'phys', weak: ['bolt'], resist: ['dark'], acts: ['chomp', 'tonguelash', 'chomp', 'gobble'], art: 'a huge mimic disguised as an ornate bookcase that has burst open into a fanged maw with a long purple tongue, books spilling out' },
        boss: { id: 'archivist', name: 'The Archivist Lich', m: [7.5, 1.0, 2.0, 1.2, 2.0, 1.1], el: 'dark', weak: ['holy', 'fire'], resist: ['dark', 'ice'], acts: ['deathtome', 'darkstorm', 'curse', 'darkbolt', 'drain'], art: 'a tall lich in tattered violet and gold librarian robes, a crowned skull with blue flame eyes, floating spellbooks orbiting around it, a staff topped with a burning quill' },
    },
    {
        id: 'forge', name: 'Ember Forge', floors: [31, 40], tint: '#e8743a',
        art: 'A colossal dwarven forge hall inside the tower, rivers of glowing molten metal in channels, giant anvils and chains, huge bellows, blackened stone walls, sparks and embers in the air, red-orange light',
        intro: 'The heat hits like a wall. Hammers ring with nobody holding them.',
        monsters: [
            { id: 'fire_imp', name: 'Fire Imp', m: [0.7, 0.8, 1.2, 0.6, 1.0, 1.5], el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['firebolt', 'firebolt', 'taunt_fire'], art: 'a small red horned imp with bat wings, a pitchfork and a flaming tail, cackling' },
            { id: 'magma_salamander', name: 'Magma Salamander', m: [1.1, 1.2, 1.0, 1.1, 0.9, 1.1], el: 'fire', weak: ['ice'], resist: ['fire', 'nature'], acts: ['bite', 'flame', 'bite'], art: 'a long black-and-orange salamander with cracked glowing magma skin and smoke rising from its back' },
            { id: 'cinder_hound', name: 'Cinder Hound', m: [0.9, 1.3, 0.6, 0.8, 0.8, 1.5], el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['bite', 'bite', 'emberbite'], art: 'a lean coal-black hound with glowing ember cracks across its body, a flaming mane and burning eyes' },
            { id: 'slag_golem', name: 'Slag Golem', m: [1.8, 1.3, 0.4, 1.8, 0.7, 0.5], el: 'phys', weak: ['ice', 'bolt'], resist: ['fire', 'phys'], acts: ['slam', 'harden', 'slam'], art: 'a lumbering golem of cooling slag and scrap iron plates, glowing seams, a chimney pipe on its back puffing smoke' },
            { id: 'forge_wight', name: 'Forge Wight', m: [1.0, 1.3, 0.9, 1.1, 1.0, 1.0], el: 'fire', weak: ['holy'], resist: ['fire', 'dark'], acts: ['hammer', 'flame', 'hammer'], art: 'a ghostly dwarven smith in a leather apron, a translucent body with a burning beard and a glowing hammer' },
        ],
        mini: { id: 'furnace_ogre', name: 'Furnace Ogre', m: [3.6, 1.7, 0.6, 1.4, 0.9, 0.8], el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['slam', 'flame', 'cleave', 'warcry'], art: 'a huge ogre with a furnace built into its belly glowing through a grate, an iron jaw, carrying an anvil as a weapon' },
        boss: { id: 'ignivar', name: 'Ignivar, the Molten King', m: [8, 1.8, 1.8, 1.5, 1.4, 1.0], el: 'fire', weak: ['ice'], resist: ['fire', 'nature'], acts: ['eruption', 'flame', 'meteor', 'firebolt', 'warcry'], art: 'a giant fire elemental king with a body of flowing lava, a crown of black obsidian spikes, molten rock dripping from his arms, a burning greatsword' },
    },
    {
        id: 'frost', name: 'Frostbound Gallery', floors: [41, 50], tint: '#a8e0f0',
        art: 'A grand frozen palace gallery, ice-covered marble columns, statues encased in ice, frozen chandeliers, snow drifting through broken high windows, a polished icy floor reflecting pale moonlight, blue and silver palette',
        intro: 'Every statue here was someone. The frost keeps them very still.',
        monsters: [
            { id: 'frost_wolf', name: 'Frost Wolf', m: [0.9, 1.3, 0.6, 0.9, 1.0, 1.5], el: 'ice', weak: ['fire'], resist: ['ice'], acts: ['bite', 'howl', 'frostbite'], art: 'a large white wolf with icy blue fur, frost crystals on its back and a breath of cold mist' },
            { id: 'ice_wraith', name: 'Ice Wraith', m: [0.8, 0.5, 1.4, 0.6, 1.4, 1.2], el: 'ice', weak: ['fire', 'holy'], resist: ['ice', 'phys'], acts: ['frost', 'blizzard', 'drain'], art: 'a floating ghostly woman of swirling snow and ice, long icicle fingers, a tattered frozen veil' },
            { id: 'snow_yeti', name: 'Snow Yeti', m: [1.6, 1.4, 0.5, 1.2, 0.9, 0.8], el: 'phys', weak: ['fire'], resist: ['ice'], acts: ['slam', 'snowball', 'roar'], art: 'a big shaggy white yeti with blue skin on its face and hands, huge tusks, roaring' },
            { id: 'frozen_knight', name: 'Frozen Knight', m: [1.3, 1.3, 0.6, 1.7, 1.0, 0.8], el: 'ice', weak: ['fire', 'bolt'], resist: ['ice', 'phys'], acts: ['slash', 'frostblade', 'harden'], art: 'an empty suit of ornate knight armour encased in ice, blue light inside its visor, a frozen longsword' },
            { id: 'rime_harpy', name: 'Rime Harpy', m: [0.8, 1.1, 1.0, 0.7, 1.0, 1.7], el: 'ice', weak: ['bolt'], resist: ['ice'], acts: ['claw', 'gale', 'claw'], art: 'a harpy with pale blue feathered wings, icicle talons and a frosty crest, screeching' },
        ],
        mini: { id: 'glacier_troll', name: 'Glacier Troll', m: [3.8, 1.7, 0.7, 1.5, 1.1, 0.8], el: 'ice', weak: ['fire'], resist: ['ice'], acts: ['slam', 'regrow', 'snowball', 'slam'], art: 'a massive troll with glacier-blue skin, a back covered in ice spikes, a tree-trunk club frozen solid' },
        boss: { id: 'hrimgard', name: 'Hrimgard, Wyvern of Winter', m: [8.5, 1.8, 1.7, 1.6, 1.6, 1.2], el: 'ice', weak: ['fire'], resist: ['ice'], acts: ['blizzardbreath', 'frostbite', 'gale', 'blizzard', 'roar'], art: 'a majestic white wyvern with frost-blue wings spread wide, icicle horns, crystalline scales and a freezing breath' },
    },
    {
        id: 'clockwork', name: 'Clockwork Halls', floors: [51, 60], tint: '#d8b45a',
        art: 'A vast hall of giant brass gears, clock faces and pistons, steam pipes and copper walkways, an enormous turning cog wall in the background, warm golden light from lamps, brass and teal palette',
        intro: 'The tower ticks. Somebody built this floor, and they are still winding it.',
        monsters: [
            { id: 'clock_soldier', name: 'Clockwork Soldier', m: [1.1, 1.2, 0.5, 1.4, 0.9, 1.0], el: 'phys', weak: ['bolt'], resist: ['dark', 'nature'], acts: ['slash', 'slash', 'overclock'], art: 'a brass toy-soldier automaton with a wind-up key in its back, a tall plumed helmet and a bayonet' },
            { id: 'gear_spider', name: 'Gear Spider', m: [0.8, 1.2, 0.6, 1.1, 0.8, 1.6], el: 'phys', weak: ['bolt'], resist: ['nature'], acts: ['bite', 'oilspray', 'bite'], art: 'a mechanical spider made of brass gears and springs, a single red glass eye, needle legs' },
            { id: 'brass_owl', name: 'Brass Owl', m: [0.7, 0.8, 1.3, 0.8, 1.2, 1.5], el: 'bolt', weak: ['ice'], resist: ['bolt'], acts: ['zap', 'screech', 'zap'], art: 'a clockwork owl of polished brass with lens eyes that glow blue, copper feathers and a spinning gear on its chest' },
            { id: 'cog_hound', name: 'Cogwork Hound', m: [1.0, 1.4, 0.4, 1.2, 0.8, 1.4], el: 'phys', weak: ['bolt', 'ice'], resist: ['fire'], acts: ['bite', 'bite', 'steamvent'], art: 'a mechanical bulldog of iron plates and pistons with a steam exhaust, a gear-toothed jaw' },
            { id: 'sentinel_orb', name: 'Sentinel Orb', m: [0.8, 0.5, 1.5, 1.0, 1.5, 1.1], el: 'bolt', weak: ['phys'], resist: ['bolt', 'fire', 'ice'], acts: ['laser', 'zap', 'shieldpulse'], art: 'a floating brass sphere with a single huge glowing eye lens, rotating rings of gears around it' },
        ],
        mini: { id: 'siege_automaton', name: 'Siege Automaton', m: [4, 1.8, 1.0, 1.9, 1.2, 0.7], el: 'phys', weak: ['bolt'], resist: ['fire'], acts: ['cannon', 'slam', 'overclock', 'cannon'], art: 'a walking brass siege engine on four legs with a cannon for a head, rivets, a furnace glow and pipes' },
        boss: { id: 'orrery', name: 'The Grand Orrery Engine', m: [9, 1.6, 2.0, 2.0, 1.6, 1.0], el: 'bolt', weak: ['ice'], resist: ['bolt', 'phys'], acts: ['timestop', 'thunder', 'laser', 'overclock', 'cannon'], art: 'a colossal clockwork construct shaped like a planetary orrery with a face, rotating rings of brass planets, arms of gears and pistons, a glowing blue core' },
    },
    {
        id: 'garden', name: 'Sunken Garden', floors: [61, 70], tint: '#58c49a',
        art: 'A flooded overgrown garden inside the tower, giant lily pads and lotus flowers on dark water, vine-choked marble ruins, weeping willow trees, fireflies, shafts of light through a broken glass dome, lush teal and pink palette',
        intro: 'Water to the knee, flowers the size of carts. Everything here is hungry.',
        monsters: [
            { id: 'mandrake', name: 'Mandrake', m: [0.8, 0.7, 1.2, 0.8, 1.1, 1.0], el: 'nature', weak: ['fire'], resist: ['nature', 'bolt'], acts: ['scream', 'spit', 'spores'], art: 'a screaming mandrake root creature with a leafy top, a gnarled face with a wide open mouth and root legs' },
            { id: 'bog_lurker', name: 'Bog Lurker', m: [1.4, 1.3, 0.6, 1.1, 0.9, 0.9], el: 'nature', weak: ['fire', 'bolt'], resist: ['ice'], acts: ['claw', 'drag', 'claw'], art: 'a hulking swamp creature of mud, reeds and moss, glowing yellow eyes, dripping algae and long claws' },
            { id: 'thorn_dryad', name: 'Thorn Dryad', m: [0.9, 0.8, 1.4, 0.9, 1.3, 1.2], el: 'nature', weak: ['fire'], resist: ['nature'], acts: ['thornlash', 'heal', 'rootgrasp'], art: 'a corrupted dryad with bark skin, a crown of thorns and black roses, vine whips in her hands' },
            { id: 'mire_toad', name: 'Mire Toad', m: [1.5, 1.1, 0.8, 1.0, 1.0, 0.8], el: 'nature', weak: ['ice'], resist: ['nature', 'bolt'], acts: ['tongue', 'spit', 'gobble'], art: 'a huge warty purple and green toad with orange spots, a long sticky tongue and a lily pad on its head' },
            { id: 'flytrap', name: 'Carnivorous Flytrap', m: [1.1, 1.4, 0.7, 1.0, 1.0, 0.9], el: 'nature', weak: ['fire', 'ice'], resist: ['nature'], acts: ['chomp', 'chomp', 'acid'], art: 'a giant venus flytrap plant with toothy red jaws, writhing vines and dripping nectar' },
        ],
        mini: { id: 'hydra', name: 'Twin-Headed Hydra', m: [4, 1.8, 1.2, 1.4, 1.2, 1.0], el: 'nature', weak: ['fire'], resist: ['ice'], acts: ['bite', 'bite', 'acid', 'regrow'], art: 'a two-headed serpent hydra with green-teal scales, fin crests and fanged jaws, rising from water' },
        boss: { id: 'motherbloom', name: 'Mother Bloom', m: [9.5, 1.5, 2.0, 1.5, 1.8, 1.0], el: 'nature', weak: ['fire', 'ice'], resist: ['nature', 'bolt'], acts: ['pollenstorm', 'thornlash', 'heal', 'rootgrasp', 'acid'], art: 'an enormous monstrous rafflesia flower queen, a giant red bloom with a woman-like plant figure rising from its centre, thorny vines and petals like a crown' },
    },
    {
        id: 'astral', name: 'Astral Observatory', floors: [71, 80], tint: '#8a8cf0',
        art: 'An open-roofed astral observatory at the top of a stone tower, a giant brass telescope, a star map inlaid in the floor, a sky full of swirling galaxies and nebulae, floating star motes, deep indigo and gold palette',
        intro: 'The ceiling is gone. Above you, the stars are much too close.',
        monsters: [
            { id: 'star_jelly', name: 'Star Jelly', m: [0.9, 0.5, 1.4, 0.8, 1.4, 1.1], el: 'bolt', weak: ['dark'], resist: ['bolt', 'holy'], acts: ['zap', 'starfall', 'heal'], art: 'a floating translucent jellyfish whose bell is full of tiny stars and galaxies, long glowing tentacles' },
            { id: 'nebula_moth', name: 'Nebula Moth', m: [0.8, 0.8, 1.3, 0.7, 1.2, 1.6], el: 'dark', weak: ['fire'], resist: ['dark'], acts: ['dust', 'darkbolt', 'dust'], art: 'a giant moth with wings patterned like a purple and pink nebula, feathery antennae and glittering star dust' },
            { id: 'astral_sentinel', name: 'Astral Sentinel', m: [1.4, 1.4, 1.0, 1.6, 1.4, 0.9], el: 'holy', weak: ['dark'], resist: ['holy', 'phys'], acts: ['smite', 'slash', 'shieldpulse'], art: 'a marble statue of a winged guardian come to life, a halo of floating stars, a celestial spear' },
            { id: 'void_eye', name: 'Void Eye', m: [0.9, 0.4, 1.6, 0.8, 1.5, 1.2], el: 'dark', weak: ['holy'], resist: ['dark', 'ice'], acts: ['gaze', 'darkbolt', 'curse'], art: 'a floating giant eyeball with a starry void for a pupil and dark tentacles trailing beneath it' },
            { id: 'starlight_stag', name: 'Starlight Stag', m: [1.2, 1.4, 1.1, 1.0, 1.1, 1.4], el: 'holy', weak: ['dark'], resist: ['holy'], acts: ['charge', 'smite', 'heal'], art: 'a graceful stag made of starlight and deep blue night sky, antlers like branching constellations' },
        ],
        mini: { id: 'eclipse_knight', name: 'Eclipse Knight', m: [4, 1.9, 1.4, 1.8, 1.4, 1.1], el: 'dark', weak: ['holy'], resist: ['dark'], acts: ['eclipse', 'slash', 'smite', 'slash'], art: 'a knight in black armour edged with a burning golden corona, a helmet shaped like an eclipsed sun, a sword of shadow and light' },
        boss: { id: 'celestine', name: 'Celestine, the Fallen Star', m: [9.5, 1.5, 2.3, 1.5, 2.0, 1.2], el: 'holy', weak: ['dark'], resist: ['holy', 'bolt'], acts: ['supernova', 'starfall', 'smite', 'heal', 'starfall'], art: 'a fallen celestial woman of white-gold starlight with six shattered glowing wings, a cracked halo, floating serenely above a fallen star' },
    },
    {
        id: 'abyss', name: 'Abyssal Throne', floors: [81, 90], tint: '#c0324a',
        art: 'A hellish throne room, black obsidian pillars, rivers of red-hot lava, chains hanging from the darkness, demonic statues, an ominous empty throne of bones far in the background, crimson and black palette',
        intro: 'The air tastes of iron. A throne waits at the far end, and it is warm.',
        monsters: [
            { id: 'hellhound', name: 'Hellhound', m: [1.1, 1.5, 0.8, 1.0, 1.0, 1.5], el: 'fire', weak: ['holy', 'ice'], resist: ['fire', 'dark'], acts: ['bite', 'emberbite', 'howl'], art: 'a muscular black demon hound with burning red eyes, a mane of hellfire and spiked collar' },
            { id: 'horned_fiend', name: 'Horned Fiend', m: [1.2, 1.4, 1.2, 1.2, 1.1, 1.1], el: 'dark', weak: ['holy'], resist: ['dark', 'fire'], acts: ['claw', 'darkbolt', 'curse'], art: 'a red-skinned horned demon with leathery wings, a spiked tail, a trident and a cruel grin' },
            { id: 'gargoyle', name: 'Gargoyle', m: [1.3, 1.3, 0.6, 2.0, 1.0, 1.0], el: 'phys', weak: ['bolt'], resist: ['phys', 'dark'], acts: ['claw', 'harden', 'dive'], art: 'a grey stone gargoyle with bat wings, horns and claws, crouched and snarling' },
            { id: 'void_spawn', name: 'Void Spawn', m: [1.0, 1.0, 1.5, 0.8, 1.4, 1.2], el: 'dark', weak: ['holy'], resist: ['dark', 'nature'], acts: ['tentacle', 'darkbolt', 'drain'], art: 'a writhing mass of black tentacles and too many purple eyes, dripping shadow' },
            { id: 'demon_knight', name: 'Demon Knight', m: [1.4, 1.6, 0.8, 1.6, 1.1, 1.0], el: 'dark', weak: ['holy'], resist: ['dark', 'fire'], acts: ['slash', 'cleave', 'darkbolt'], art: 'a knight in spiked black-red armour with demonic horns on the helmet, a flaming jagged greatsword' },
        ],
        mini: { id: 'pit_warden', name: 'The Pit Warden', m: [4.4, 2.0, 1.2, 1.7, 1.3, 0.9], el: 'fire', weak: ['holy'], resist: ['fire', 'dark'], acts: ['chainlash', 'flame', 'cleave', 'warcry'], art: 'a huge demon jailer with a bull head and horns, a burning ring of keys, chains wrapped around its arms, a massive axe' },
        boss: { id: 'malgrath', name: 'Malgrath, Archdemon of the Spire', m: [10, 2.0, 2.0, 1.7, 1.7, 1.1], el: 'dark', weak: ['holy'], resist: ['dark', 'fire'], acts: ['hellfire', 'darkstorm', 'cleave', 'curse', 'warcry'], art: 'a towering archdemon lord with four horns, vast tattered black wings, burning red armour, a crown of fire, a flaming black sword' },
    },
    {
        id: 'summit', name: 'Skyreach Summit', floors: [91, 100], tint: '#f0c24a',
        art: 'The open summit of a colossal tower above the clouds, golden sunset, a sea of clouds below, broken golden ruins and floating rocks, wind-torn banners, a giant ember-red crystal shard floating in the distance',
        intro: 'Clouds below you. Wind with teeth. At the very top, something is breathing.',
        monsters: [
            { id: 'thunderbird', name: 'Thunderbird', m: [1.1, 1.3, 1.4, 1.0, 1.2, 1.7], el: 'bolt', weak: ['ice'], resist: ['bolt'], acts: ['claw', 'thunder', 'zap'], art: 'a great eagle-like bird with storm-blue feathers crackling with lightning, glowing yellow eyes' },
            { id: 'storm_elemental', name: 'Storm Elemental', m: [1.2, 0.8, 1.6, 0.9, 1.5, 1.3], el: 'bolt', weak: ['phys'], resist: ['bolt', 'ice'], acts: ['zap', 'thunder', 'gale'], art: 'a swirling elemental of dark storm clouds with arms of lightning and a glowing face in the clouds' },
            { id: 'griffon', name: 'Griffon', m: [1.3, 1.6, 0.6, 1.1, 1.0, 1.5], el: 'phys', weak: ['bolt'], resist: ['nature'], acts: ['claw', 'dive', 'claw'], art: 'a majestic griffon with the head and wings of a golden eagle and the body of a lion, rearing' },
            { id: 'seraph_sentinel', name: 'Seraph Sentinel', m: [1.3, 1.3, 1.5, 1.4, 1.6, 1.1], el: 'holy', weak: ['dark'], resist: ['holy'], acts: ['smite', 'heal', 'judgement'], art: 'a golden armoured angelic sentinel with a faceless helm, four white wings and a radiant spear' },
            { id: 'sky_drake', name: 'Sky Drake', m: [1.5, 1.6, 1.2, 1.3, 1.2, 1.2], el: 'fire', weak: ['ice'], resist: ['fire'], acts: ['bite', 'flame', 'dive'], art: 'a sleek red and gold young dragon with wide wings, horns and a spark of flame in its jaws' },
        ],
        mini: { id: 'storm_drake', name: 'Tempest Drake', m: [4.5, 2.0, 1.8, 1.7, 1.5, 1.3], el: 'bolt', weak: ['ice'], resist: ['bolt'], acts: ['thunder', 'bite', 'gale', 'thunder'], art: 'a large storm dragon with indigo scales, lightning crackling along its horns and spines, wings like thunderclouds' },
        boss: { id: 'aurelion', name: 'Aurelion, the Ember Dragon', m: [12, 2.1, 2.1, 1.9, 1.9, 1.2], el: 'fire', weak: ['ice'], resist: ['fire', 'bolt'], acts: ['dragonfire', 'meteor', 'bite', 'roar', 'dragonfire'], art: 'a colossal ancient dragon with gold and ember-red scales, a mane of living flame, great wings, a glowing ember crystal set in its brow' },
    },
];

/** The stratum a floor belongs to, and how many times the tower has looped. */
export function biomeOf(floor) {
    const f = Math.max(1, floor | 0);
    const cycle = Math.floor((f - 1) / 100);
    const idx = Math.floor(((f - 1) % 100) / 10);
    return { biome: BIOMES[idx], cycle, idx };
}

/** Every monster template by id (normals, minis and bosses). */
export const MONSTERS = {};
for (const b of BIOMES) {
    for (const m of b.monsters) MONSTERS[m.id] = { ...m, rank: 'normal', biome: b.id };
    MONSTERS[b.mini.id] = { ...b.mini, rank: 'mini', biome: b.id };
    MONSTERS[b.boss.id] = { ...b.boss, rank: 'boss', biome: b.id };
}
