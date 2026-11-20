// Every prompt the art of Echoes of Aethermoor was generated from (fal-ai/nano-banana-2 at 1K/2K, and
// fal-ai/nano-banana-2/edit with the base portrait as the reference for expressions and map sprites).
// The ids are the files in art/; js/view/assets.js lists the same ids and dev/simtest.mjs checks they match.
// `key` is the flat background colour a cut-out is painted on: green for most, magenta for anything green.

export const STYLE = 'You paint illustrations for a fantasy visual-novel RPG, Echoes of Aethermoor. Style: lush painterly digital fantasy illustration with rich detail and soft volumetric light, in the spirit of classic JRPG concept art and storybook oil painting; a twilight palette of violet, indigo and teal aether glow with warm amber firelight accents. Absolutely no text, letters, runes that look like writing, captions, UI, borders, frames, watermark or signature.';

const KEYS = { green: 'plain flat solid pure green (#00ff00)', magenta: 'plain flat solid magenta (#ff00ff)' };

export const portraitStyle = (key) => `You paint character portraits for a fantasy visual-novel RPG, Echoes of Aethermoor. Style: lush painterly digital fantasy illustration, classic JRPG character art, soft rim light, expressive faces with correct anatomy. One character only, three-quarter length from the knees up, facing slightly toward the viewer, on a ${KEYS[key]} background with no shadow, no floor and no scenery. Absolutely no text, letters, captions, UI, borders, frames, watermark or signature.`;

export const spriteStyle = (key) => `You paint game sprites for a fantasy RPG, Echoes of Aethermoor. Style: painterly digital fantasy illustration with crisp readable silhouettes and soft light. One subject only, whole and uncropped, centred, on a ${KEYS[key]} background with no shadow, no ground and no scenery. Absolutely no text, letters, captions, UI, borders, frames, watermark or signature.`;

export const propStyle = (key) => `You paint map objects for a top-down fantasy RPG, Echoes of Aethermoor, seen from above at a steep 3/4 angle like a classic 16-bit JRPG map but painted richly. Ordinary objects, NOT characters: no faces, no eyes, no people, no animals. Painterly, soft light from the top left. Each object whole and uncropped on a ${KEYS[key]} background with no cast shadow on the background and no ground around it. Absolutely no text, letters, UI, grid lines, borders, frames, watermark or signature.`;

export const TEXTURE_STYLE = 'A seamless tileable texture seen from directly above, perfectly flat lighting with no vignette, no perspective, uniform detail across the whole square so it repeats cleanly, painterly fantasy game ground texture. No objects, no people, no text, no borders.';

/** Portraits: the cast, three-quarter length. Also drawn in battle for Korvas and Vaelthas. */
export const PORTRAITS = {
    lyra: ['green', 'Lyra, a young woman mage of about nineteen with long silver-lavender hair in a loose side braid and violet eyes, a deep violet travelling cloak embroidered with tiny silver stars over a midnight-blue robe, a leather satchel stuffed with scrolls, holding a slender wooden staff topped with a softly glowing violet crystal, a determined but gentle expression.'],
    orin: ['green', 'Orin, a broad-shouldered human knight in his forties, short dark hair greying at the temples, a short beard, a scar through one eyebrow, steel plate armour whose sun emblem on the breastplate has been scratched off, a tattered sky-blue tabard, a big round steel shield on one arm and a longsword, a steady weary gaze.'],
    sera: ['magenta', 'Sera, an elf ranger woman with long pointed ears, copper-red hair tied back in a tail, freckles, sharp green eyes, fitted green and brown leather armour, a hooded forest-green cloak, a carved longbow in one hand and a quiver of fletched arrows on her back, a wry half smile.'],
    thane: ['green', 'Thane, a gaunt human warlock in his thirties with pale skin, black hair swept back, dark circles under intense amber eyes, a glowing orange ember-brand burned into the back of his left hand and up his neck, a high-collared black coat lined with crimson, a small flame of orange and black shadow-fire hovering over one palm.'],
    varec: ['green', 'Elder Varec, the old elder of a forest village, a long white beard, kind tired eyes, a brown wool robe and a knitted shawl, leaning on a gnarled walking stick with a small amber lantern hanging from it.'],
    holt: ['magenta', 'Farmer Holt, a stout middle-aged farmer with sunburnt cheeks and a bushy moustache, a straw hat, patched blue dungarees over a linen shirt, holding a pitchfork, a frazzled and worried look.'],
    borin: ['green', 'Borin, a round jolly travelling merchant with a bushy brown beard, a battered feathered hat, a colourful patchwork coat, an enormous overstuffed backpack hung with pots, lanterns and trinkets, a bandage wrapped around his forehead.'],
    marta: ['green', 'Marta, a muscular blacksmith woman in her fifties, grey hair cropped short, soot on her cheeks, a heavy leather apron over a rolled-sleeve shirt, a big forging hammer resting on her shoulder, a no-nonsense smirk.'],
    aldric: ['green', 'Aldric, a jovial portly innkeeper with a curled ginger moustache and rosy cheeks, a white apron over a burgundy waistcoat, holding a tray with a steaming bowl of stew and a foaming mug, beaming.'],
    sylvara: ['magenta', 'Sylvara, the ancient dryad spirit of the World Tree: a tall serene woman with skin like pale birch bark, hair of trailing willow leaves and tiny white blossoms, glowing amber eyes, a flowing gown of moss and woven roots, soft green light around her, a few dark violet veins of corruption creeping up one arm.'],
    aneth: ['green', 'Scholar Aneth, a thin bookish woman in her sixties with round spectacles and a long grey braid, an ink-stained indigo academy robe with silver trim, clutching an armful of old books and a rolled star chart, sharp curious eyes.'],
    korvas: ['green', 'Korvas the Fallen Paladin, a towering knight in once-golden plate armour now blackened and cracked, violet corruption seeping from every seam, a horned helm with a broken halo crest, glowing violet eyes inside the visor, a huge two-handed greatsword wreathed in dark violet flame, menacing.'],
    vaelthas: ['green', 'Vaelthas, the Lich of Aethermoor, once the headmaster of a magic academy: a towering skeletal sorcerer in rotting violet and gold academy robes, a crown of black iron with floating shards of glowing cyan crystal, blue-white soulfire burning in his eye sockets, skeletal hands crackling with cyan aether lightning, terrifying and regal.'],
};

/** Expressions: /edit of the base portrait. */
export const EXPRESSIONS = {
    'lyra-happy': ['lyra', 'Same young woman, same clothes, same staff, same pose and framing, same flat green background: now smiling warmly, eyes bright, a little laugh.'],
    'lyra-sad': ['lyra', 'Same young woman, same clothes, same staff, same pose and framing, same flat green background: now sorrowful and afraid, eyes glistening, brows drawn together, looking down.'],
    'lyra-fierce': ['lyra', 'Same young woman, same clothes, same pose and framing, same flat green background: now fierce and resolute, staff raised, its crystal blazing violet, jaw set.'],
    'orin-angry': ['orin', 'Same knight, same armour, same pose and framing, same flat green background: now furious and grieving, teeth clenched, gripping his sword hard.'],
    'sera-smile': ['sera', 'Same elf ranger, same clothes, same pose and framing, same flat magenta background: now grinning openly, playful.'],
    'thane-sad': ['thane', 'Same warlock, same coat, same pose and framing, same flat green background: now haunted and ashamed, looking away, the shadow-fire guttering low.'],
    'varec-worried': ['varec', 'Same old elder, same clothes, same pose and framing, same flat green background: now deeply worried, hand to his chest.'],
    'sylvara-sad': ['sylvara', 'Same dryad, same gown, same pose and framing, same flat magenta background: now in pain, eyes half closed, the violet corruption spreading further up her arm.'],
};

/** Map sprites: /edit of each portrait into a small full-body figure facing right (mirrored in code). */
export const CHIBI = (key) => `Turn this character into a small full-body game map sprite: the same character with the same face, hair, outfit and colours, drawn in a cute chibi proportion with a big head and small body, standing in a relaxed walking pose, the whole figure visible from the top of the head to the feet, three-quarter view facing to the right, on a ${KEYS[key]} background with no shadow and no ground. No text.`;
// Varec's first sprite came back as pixel art; his was redone with Lyra's sprite as a second reference and this note.
export const CHIBI_FIX = { varec: 'in the same smooth painterly cartoon style as a modern illustrated RPG (NOT pixel art, no pixels)' };
export const CHIBIS = ['lyra', 'orin', 'sera', 'thane', 'varec', 'holt', 'borin', 'marta', 'aldric', 'sylvara', 'aneth'];

/** Battle sprites, facing the viewer. Korvas and Vaelthas use their portraits. */
export const ENEMIES = {
    slime: ['magenta', 'A translucent green forest slime, a wobbly jelly blob with a leaf and a tiny mushroom stuck in it, two dark beady spots for eyes, glistening.'],
    forest_wolf: ['green', 'A lean grey forest wolf with patches of corrupted fur glowing violet, snarling with bared fangs, crouched to pounce, facing the viewer.'],
    bandit: ['green', 'A Thornwood bandit, a hooded rogue in a ragged brown cloak and studded leather armour, a scarf over the lower face, a curved knife in each hand, crouched in a fighting stance facing the viewer.'],
    golem: ['magenta', 'A hulking stone golem built of mossy ruined masonry blocks, glowing cyan rune cracks across its body, huge fists, standing facing the viewer.'],
    lich_shard: ['green', 'A floating jagged crystal of frozen cyan and violet lich magic, a hollow skull-like face in its facets, cold mist and small orbiting shards around it.'],
    academy_wisp: ['magenta', 'A small floating will-o-wisp of blue-white aether flame around a tiny glowing crystal core, trailing sparks and faint spectral ribbons.'],
    corrupted_knight: ['green', 'A corrupted knight in blackened plate armour, a defaced sun emblem on the chest, violet corruption leaking from the visor slit, a notched sword and a dented shield, standing ready facing the viewer.'],
};

/** Backdrops for dialogue and battle (16:9, no people). */
export const BG = {
    thornhaven: 'Background, no people: Thornhaven, a small forest village at dusk, thatched timber cottages with glowing windows, a stone well, a cobbled square, an inn with a hanging lantern, a smithy chimney with sparks, the dark edge of a huge ancient forest behind, a violet sky with the first stars.',
    forge: 'Background, no people: inside a village blacksmith\'s forge at night, a glowing furnace, an anvil, racks of swords, axes and shields, hammers and tongs on the wall, sparks, warm orange light and deep shadows.',
    inn: 'Background, no people: inside the cosy Ember Hearth Inn, a big crackling hearth, wooden tables with candles, a bar with barrels and mugs, a staircase to rooms, dried herbs hanging from beams, warm amber light.',
    thornwood: 'Background, no people: the Thornwood, an ancient forest of huge twisted dark trees with thorny branches, shafts of pale light, ferns, mushrooms, a winding dirt path, faint violet corruption creeping along some roots, mist.',
    academy: 'Background, no people: the ruins of a magic academy in the forest, a collapsed domed lecture hall open to the night sky, broken stone pillars, scattered books and scrolls, a scorched lectern, floating motes of blue aether light, ivy.',
    grove: 'Background, no people: the World Tree Grove, a colossal luminous ancient tree with roots like cathedral buttresses, glowing green and gold leaves, a circle of white flowers, but three of the great roots are veined with pulsing violet corruption; soft magical light.',
    chapel: 'Background, no people: a shattered chapel of a knightly sun order in the forest, broken stained glass windows with a golden sun, toppled pews, a cracked altar, violet corruption crawling over the stone, shafts of dim light, dust.',
    ruins: 'Background, no people: the Aethermoor Ruins, vast crumbling halls of violet stone under a stormy sky, broken arches and staircases, floating fragments of masonry, cyan lich crystals growing from the cracks, eerie mist.',
    sanctum: 'Background, no people: the Aethermoor Sanctum deep underground, an enormous circular vault of black stone, a great dais with a broken throne, ancient seals of light on the floor, cyan soulfire braziers, an oppressive dark majesty.',
};

/** Illustrations: [prompt, references]. References are portrait ids passed to /edit. */
export const CG = {
    title: ['The title painting: a young woman mage with silver-lavender hair and a violet star-embroidered cloak stands on a cliff seen from behind and to the side, her crystal staff glowing violet, looking across a vast twilight forest toward the distant ruins of a great academy where a pillar of cold cyan light rises into a violet sky full of stars; three companions silhouetted further back on the path: a knight with a round shield, an elf archer, a figure in a dark coat with an ember glow. Epic, beautiful, hopeful and ominous.', ['lyra']],
    prologue: ['Night, a burning magic academy in the forest behind her, a young woman mage with silver-lavender hair and a violet cloak runs through the dark trees clutching an old scroll to her chest, looking back over her shoulder in fear, cyan aether fire in the windows behind.', ['lyra']],
    korvas: ['Inside a shattered chapel, a defeated fallen paladin in blackened golden armour kneels before a scarred knight with a sky-blue tabard and a round shield, the violet corruption burning away from the fallen one\'s armour as golden light streams through broken stained glass; sorrow and release.', ['orin', 'korvas']],
    seal: ['In vast violet ruins, an old scholar in an indigo robe with spectacles holds up two glowing soul gems as a ring of cyan light explodes outward from a great sealed stone door, cracks of light racing across the seal, a young mage with a crystal staff shielding her eyes.', ['aneth', 'lyra']],
    'end-remember': ['Dawn after the battle: a young woman mage with silver-lavender hair kneels in a ruined sanctum holding an open glowing scroll, and from it rise gentle motes of light shaped like memories of an academy full of students, a black iron crown at her feet, golden sunrise pouring through a hole in the vault; peace, remembrance.', ['lyra']],
    'end-release': ['Dawn after the battle: on a cliff above a misty forest, the young woman mage with silver-lavender hair and a violet star cloak (first reference) lets an old scroll burn away in her raised hand into a stream of violet and gold sparks drifting up into the morning sky, eyes closed, freed. Behind her and watching kindly: the scarred knight with the sky-blue tabard and round shield (second reference), the red-haired elf ranger with a longbow (third reference), and the pale black-haired warlock in a black and crimson coat (fourth reference).', ['lyra', 'orin', 'sera', 'thane']],
};

/** Ground textures for the tile map. */
export const TEXTURES = {
    grass: 'Lush green meadow grass with a few tiny white and yellow wildflowers and clover.',
    forest: 'Dark forest floor: moss, fallen leaves, pine needles and small twigs, deep green and brown.',
    cobble: 'Old rounded cobblestones of grey and warm brown stone with moss in the gaps.',
    dirt: 'A packed earthen dirt path, warm brown, small pebbles and wheel ruts.',
    planks: 'Warm honey-brown wooden floor planks with nails and knots, an old inn floor.',
    ruins: 'Cracked ancient flagstones of violet-grey stone with faint glowing cyan cracks and moss.',
    water: 'Clear dark blue-green pond water with soft ripples and light glints.',
    wall: 'The flat top surface of a thick old stone wall seen from straight above: large fitted grey-violet stone blocks with moss in the joints, like a flagstone floor, completely flat, no sky, no perspective, no wall face.',
};

/** Buildings and big props, one per image. */
export const PROPS = {
    elder_house: ['green', 'A cosy thatched timber village cottage with a stone chimney, a round wooden door, lit windows, flower boxes.'],
    farmhouse: ['magenta', 'A rustic farmhouse with a red-brown thatched roof, a small barn door, hay bales and a cabbage patch along one side.'],
    inn_house: ['green', 'A two-storey timber-framed village inn with a steep shingled roof, warm glowing windows, a hanging lantern by the door and barrels outside, no sign lettering.'],
    forge_house: ['green', 'A stone blacksmith\'s forge building with a big chimney trailing glowing sparks and smoke, an open front showing a furnace glow, an anvil outside.'],
    world_tree: ['magenta', 'A colossal ancient luminous tree with a vast round crown of glowing green and gold leaves and huge buttress roots, a few roots veined with violet corruption.'],
    seal_gate: ['green', 'A massive round stone sealed door set in a low ruined arch, carved with concentric rings, cyan light glowing in the carvings.'],
};

/** Prop sheets, 3x3 grids at 2K: the cells are cut apart in export.py (row by row). */
export const SHEETS = {
    nature: ['magenta', ['tree_oak', 'tree_pine', 'tree_dead', 'tree_glow', 'bush', 'rock', 'flowers', 'mushrooms', 'stump'],
        'A sheet of nine separate map objects in a 3 by 3 grid, evenly spaced with wide empty gaps between them, each one whole: a round leafy green oak tree; a tall dark twisted thorny pine tree; a dead grey leafless tree; a pale tree with glowing green-gold leaves; a round green bush; a mossy grey boulder; a clump of white and blue wildflowers; a cluster of red-capped mushrooms; an old tree stump.'],
    ruins: ['green', ['pillar', 'statue', 'lectern', 'altar', 'crystal', 'anchor', 'rubble', 'brazier', 'bookshelf'],
        'A sheet of nine separate map objects in a 3 by 3 grid, evenly spaced with wide empty gaps between them, each one whole: a broken violet stone pillar; a toppled weathered stone statue of a robed scholar, face worn smooth; a scorched wooden lectern with an open book; a cracked stone altar with a sun carving; a cluster of glowing cyan crystals; a gnarled tree root pulsing with veins of violet corruption; a pile of stone rubble; an iron brazier with cyan flame; a broken bookshelf with old books.'],
    interior: ['green', ['anvil', 'barrel', 'crates', 'table', 'chest', 'counter', 'hearth', 'furnace', 'weapon_rack'],
        'A sheet of nine separate map objects in a 3 by 3 grid, evenly spaced with wide empty gaps between them, each one whole: an iron anvil on a stump; a wooden barrel; a stack of wooden crates; a round wooden table with a candle and two stools; a closed wooden treasure chest bound with iron and a brass lock; a long wooden counter with mugs; a stone hearth with a crackling fire; a glowing stone forge furnace; a wooden rack of swords and axes.'],
};

/** Item icons: one 5x4 sheet, cut row by row. */
export const ITEM_SHEET = ['magenta', ['potion', 'hi_potion', 'ether', 'antidote', 'phoenix_down',
    'iron_dagger', 'mage_staff', 'longbow', 'runic_blade', 'warlock_tome',
    'leather_vest', 'chain_mail', 'mage_robe', 'slime_core', 'wolf_pelt',
    'fang', 'stone_heart', 'soul_gem', 'lich_crown', 'elder_scroll'],
'A sheet of twenty separate fantasy RPG item icons in a 5 by 4 grid, evenly spaced with wide empty gaps, each whole and centred in its cell, painterly, no text. Row one: a small round red healing potion; a large ornate crimson potion with a gold stopper; a blue mana potion; a small green vial of antidote; a glowing golden phoenix feather. Row two: a simple iron dagger; a wooden mage staff with a violet crystal; a carved elven longbow; a sword etched with glowing blue runes; a black leather spellbook with an ember sigil. Row three: a brown leather vest; a shirt of chain mail; a violet mage robe with silver stars; a green jelly slime core; a grey wolf pelt. Row four: a sharp white wolf fang; a grey stone heart with cyan cracks; a glowing violet soul gem; a black iron crown with cyan crystals; a rolled ancient parchment scroll with a wax seal.'];
