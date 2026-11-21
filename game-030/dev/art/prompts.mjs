// Every prompt the art of Coppergate Lane was generated from (fal-ai/nano-banana-2 at 1K/2K, and
// fal-ai/nano-banana-2/edit with the base portrait as the reference for map sprites and expressions).
// The ids are the files in art/; js/view/assets.js lists the same ids and dev/simtest.mjs checks they match.
//   node game-030/dev/art/prompts.mjs <set>     prints the requests of one set as JSON (see SETS)
// `key` is the flat background colour a cut-out is painted on: green for most, magenta for anything green.

export const STYLE = 'You paint illustrations for a cozy-fantasy tinker RPG, Coppergate Lane. Style: warm hand-painted storybook gouache with soft volumetric light, rich copper, brass, amber and parchment tones with teal and sage accents, gentle steampunk-clockwork charm, in the spirit of a modern cozy game box illustration. Absolutely no text, letters, captions, UI, borders, frames, watermark or signature.';

const KEYS = { green: 'plain flat solid pure green (#00ff00)', magenta: 'plain flat solid magenta (#ff00ff)' };

export const portraitStyle = (key) => `You paint character portraits for a cozy-fantasy tinker RPG, Coppergate Lane. Style: warm hand-painted storybook gouache, expressive friendly faces with correct anatomy, soft rim light, copper and brass and amber tones. One character only, three-quarter length from the knees up, facing slightly toward the viewer, on a ${KEYS[key]} background with no shadow, no floor and no scenery. Absolutely no text, letters, captions, UI, borders, frames, watermark or signature.`;

export const spriteStyle = (key) => `You paint game sprites for a cozy-fantasy tinker RPG, Coppergate Lane. Style: warm hand-painted storybook gouache with crisp readable silhouettes and soft light; clockwork creatures are charming, never scary. One subject only, whole and uncropped, centred, on a ${KEYS[key]} background with no shadow, no ground and no scenery. Absolutely no text, letters, captions, UI, borders, frames, watermark or signature.`;

export const propStyle = (key) => `You paint map objects for a top-down cozy-fantasy RPG, Coppergate Lane, seen from above at a steep 3/4 angle like a classic 16-bit JRPG map but painted richly in warm storybook gouache. Ordinary objects, NOT characters: no faces, no eyes, no people, no animals. Soft light from the top left. Each object whole and uncropped on a ${KEYS[key]} background with no cast shadow on the background and no ground around it. Absolutely no text, letters, UI, grid lines, borders, frames, watermark or signature.`;

export const TEXTURE_STYLE = 'A seamless tileable texture seen from directly above, perfectly flat lighting with no vignette, no perspective, uniform detail across the whole square so it repeats cleanly, warm hand-painted gouache game ground texture. No objects, no people, no text, no borders.';

/** Portraits: the cast, three-quarter length. */
export const PORTRAITS = {
    wick: ['green', 'Wick, a young handy newcomer with messy chestnut hair under a battered brown cap, warm teal eyes, a friendly crooked smile, a patched teal work jacket with brass buttons, a canvas tool bag across the chest, a big adjustable wrench held on one shoulder, a smudge of grease on the cheek.'],
    trina: ['green', 'Trina, a cheerful soot-streaked young woman inventor with curly copper-red hair, brass goggles pushed up on her forehead, freckles, a leather tool belt full of gadgets over a mustard-yellow shirt with rolled sleeves, a gauntlet with a little crackling coil on one hand and a small spanner in the other, an excited grin.'],
    mabel: ['green', 'Mabel, a stout warm elderly baker woman with a white bun of hair under a flour-dusted blue headscarf, rosy cheeks, round spectacles, a floury apron over a lilac dress, holding a wooden rolling pin in one hand and a tray of golden currant scones in the other, a kind and determined look.'],
    pilcrow: ['green', 'Mayor Pilcrow, a plump anxious middle-aged mayor with a waxed curly moustache, a tall dark top hat, a plum waistcoat with a gold watch chain, a mayoral sash of green and gold across the chest, wringing a white handkerchief, worried but dignified.'],
    bertram: ['green', 'Bertram, a lanky grumpy elderly shopkeeper with a long thin face, grey mutton-chop whiskers, half-moon spectacles on his nose, a moss-green shop coat with many pockets and a measuring tape around his neck, one eyebrow raised, arms folded.'],
    bertha: ['green', 'Big Bertha, an enormous friendly-looking clockwork giantess built from riveted copper plates, steam pipes and brass gears, a big round copper face with two warm amber lamp eyes and a small riveted mouth, tiny chimney puffing steam on her head, huge hands, holding a glowing golden gear against her chest, looking a little lonely.'],
};
export const EXPRESSIONS = {
    'trina-excited': ['trina', 'Same young woman inventor, same clothes, same pose and framing, same flat green background: now bursting with excitement, eyes wide and sparkling, mouth open in a delighted shout, the coil on her gauntlet crackling bright.'],
};

/** Map sprites: /edit of each portrait into a small full-body figure facing right (mirrored in code). */
export const CHIBI = (key) => `Turn this character into a small full-body game map sprite: the same character with the same face, hair, outfit and colours, drawn in a cute chibi proportion with a big head and small body, standing in a relaxed walking pose, the whole figure visible from the top of the head to the feet, three-quarter view facing to the right, on a ${KEYS[key]} background with no shadow and no ground. Smooth painterly cartoon style (NOT pixel art). No text.`;
export const CHIBIS = ['wick', 'trina', 'mabel', 'pilcrow', 'bertram'];

/** Battle sprites, facing the viewer. */
export const ENEMIES = {
    cogsprite: ['magenta', 'A Cog Sprite: a tiny clockwork fairy-critter, a round brass body with a little gear for a head, two small glass lens eyes, delicate copper wings like thin gears, a key-wind in its back, hovering mischievously, cute and a little cheeky.'],
    rustcrab: ['green', 'A Rust Crab: a stout crab made of orange-rusted iron plates and riveted copper, big lopsided pincers, little periscope eyes on stalks, a dented kettle-lid shell with moss and a flower growing on it, scuttling sideways, grumpy but charming.'],
    bandit: ['green', 'A Lane Bandit: a chubby raccoon-like bandit critter in a tattered patched cloak and a black eye mask, a tin whistle in its mouth, a sack of loot over one shoulder, crouched ready to pounce, cheeky and mischievous rather than scary.'],
    gearwolf: ['magenta', 'A Gear-Wolf: a lean wolf built of grey iron plating and brass cog joints, a spring-coiled tail, glowing amber lamp eyes, steam puffing from its nose, crouched with bared tin fangs, fierce but stylised and storybook, facing the viewer.'],
    bigbertha: ['green', 'Big Bertha, a huge clockwork giantess built of riveted copper plates, steam pipes and big brass gears, a big round copper face with two glowing amber lamp eyes and a frowning riveted mouth, a chimney on her head puffing steam, enormous fists raised in a fighting stance, clutching a glowing golden gear in one arm, imposing but cartoonish, facing the viewer.'],
};

/** Places: backdrops for battles and scenes (16:9). */
export const BG = {
    lane: 'A wide painting of Coppergate Lane at golden hour: a cosy cobbled village lane with crooked half-timbered cottages in cream and teal, a brass workshop with gears over the door, a bakery with a striped awning, a market stall, copper lanterns and hanging clocks, flower boxes, warm light and drifting steam, a path winding into the distance. No people.',
    wilds: 'A wide painting of the Whistling Wilds: a sunlit meadow of tall golden grass and wildflowers dotted with old rusted gears, springs and bolts half-buried like strange plants, little clockwork critters in the distance, a glinting pond, twisted pines, a soft breeze, whimsical and warm. No people.',
    gully: 'A wide painting of Gutter Gully: a winding rocky ravine full of piled scrap metal, rusting pipes and giant old cogwheels, trickles of oily water, warm amber glow from lanterns and steam vents, moss and mushrooms, a mysterious iron door in the far cliff, atmospheric and a little spooky but cosy. No people.',
    lair: 'A wide painting of Big Bertha\'s lair: a vast cavern workshop of riveted iron plates and humming copper pipes, heaped scrap and cogs, a big nest of straw and blankets, a glowing golden light in the middle, warm furnace glow, steam, dramatic but friendly. No people.',
};
export const CG = {
    title: 'A wide, magical title painting of Coppergate Lane at dusk: a tiny cobbled village of crooked cottages and clockwork wonders with glowing windows, a giant golden gear shining like a moon above the rooftops, steam trails and brass lanterns, a small figure with a toolbag and a cap walking up the lane in the foreground seen from behind, warm copper, teal and amber palette, storybook illustration, space in the upper area for a title.',
    ending: 'A wide painting of a cosy festival in Coppergate Lane at night: strings of lanterns, a long table of scones and teapots, the whole village gathered, a huge friendly clockwork giantess in copper sitting at the end of the table with a tiny teacup in her giant hand, a golden gear glowing softly in a glass case on a stand, warm golden light, joyful, no text.',
};

/** Ground textures (seamless, 1:1). */
export const TEX = {
    grass: 'Lush meadow grass with tiny clover and daisies, a warm yellow-green.',
    meadow: 'Tall golden-green wild meadow grass with small wildflowers and the occasional tiny bolt or washer in the grass.',
    cobble: 'Warm sandy cobblestones laid in a pleasant irregular pattern, a little worn, with moss between some stones.',
    dirt: 'Packed pale brown dirt path with tiny pebbles and faint wheel tracks.',
    planks: 'Warm honey-coloured wooden floorboards with nail heads.',
    mud: 'Dark damp gully mud with scattered pebbles, tiny cog fragments and rust-orange stains.',
    plate: 'Riveted dark iron floor plates with copper edging, scuffs and warm rust, straw scattered here and there.',
    water: 'Shallow teal-green pond water with soft ripples and a faint oily rainbow sheen.',
    wall: 'The flat top surface of a thick old craggy rock cliff seen from straight above, brown grey stone with rust stains, in a flat top-down view.',
};

/** Buildings and set pieces: one per image, on a key colour. */
export const BUILDINGS = {
    workshop: ['green', 'A cosy cottage-workshop seen from the front at a slight angle from above: cream plaster walls, a teal tiled roof with a brass chimney puffing steam, a big cog over a round-topped door, gadgets, pipes and a rain barrel on the side, a window glowing yellow, a wooden sign blank with no writing.'],
    bakery: ['green', 'A cosy bakery cottage seen from the front at a slight angle from above: warm half-timbered walls, a striped red-and-cream awning over a round window with golden scones, a thatched roof with a brick chimney puffing smoke, flower boxes, a wooden door, a hanging pretzel-shaped sign with no writing.'],
    hall: ['green', 'A small proud town hall seen from the front at a slight angle from above: stone and cream walls with a green copper roof, a little clock tower with a brass clock face, wide steps up to double doors, hanging banners of green and gold with no writing, flower urns.'],
    stall: ['green', 'A rickety market stall shop seen from the front at a slight angle from above: a striped green-and-cream canvas awning over a wooden counter piled with jars, tea tins, tools, a stopped brass clock, hanging lanterns and a sleeping ginger cat on the counter, no people.'],
    lair_gate: ['green', 'A big round riveted iron vault door set into a rocky cliff face, seen from the front at a slight angle from above, copper pipes feeding into it, a brass lock wheel in the middle, a few warm amber lamps either side, moss and rust.'],
    kettle: ['green', 'A single dented copper kettle with a small rust patch, a curved spout and a wooden handle, sitting on its own, a little shine on it.'],
};

/** Nature props: a 3x3 sheet (magenta key) and a 3x3 town-and-junk sheet. */
export const SHEETS = {
    nature: { key: 'magenta', ids: ['tree_oak', 'tree_pine', 'tree_dead', 'bush', 'rock', 'flowers', 'mushrooms', 'stump', 'fern'],
        prompt: 'A 3x3 grid sheet of nine separate map objects, evenly spaced with generous empty margins, each on the magenta background: row 1: a round leafy oak tree with a warm green crown; a tall pine tree with a layered dark green crown; a bare twisted dead tree with a few copper leaves. Row 2: a round green shrub with tiny pink flowers; a grey mossy boulder; a little patch of mixed wildflowers (yellow, white, lilac). Row 3: a cluster of red-capped mushrooms; a sawn tree stump with rings; a clump of fern fronds. No labels.' },
    town: { key: 'magenta', ids: ['barrel', 'crates', 'signpost', 'lamp', 'well', 'scrap_heap', 'pipes', 'gear_big', 'chest'],
        prompt: 'A 3x3 grid sheet of nine separate map objects, evenly spaced with generous empty margins, each on the magenta background: row 1: a wooden barrel with brass hoops; a stack of two wooden crates; a wooden signpost with two blank arrow-shaped boards. Row 2: a tall brass street lamp with a glowing amber lantern; a round stone wishing well with a little wooden roof; a heap of rusty scrap metal with cogs and springs. Row 3: a pair of copper steam pipes lying side by side with bolted joints; a big rusty brass cogwheel half-sunk in the ground; a small wooden treasure chest with brass fittings, closed. No labels.' },
};

/** Item icons: one 5x4 sheet, in this order. */
export const ITEMS = ['tea', 'scone', 'oilcan', 'tonic', 'smoke', 'wakeup', 'wrench', 'spanner', 'sparkrod', 'rollingpin', 'skillet', 'apron', 'brassvest', 'goggles', 'charm', 'cog', 'spring', 'scrap', 'kettle', 'lairkey', 'goldgear'];
export const ITEM_SHEETS = [
    { id: 'items-a', ids: ITEMS.slice(0, 12), cols: 4, rows: 3, prompt: 'A 4x3 grid sheet of twelve separate game item icons, evenly spaced with generous empty margins, each on the magenta background, painted in warm storybook gouache, row by row: a steaming white teacup of chamomile tea; a golden currant scone; a small brass oil can with a long spout; a green bottle of mint tonic with a leaf label; a little round smoke pellet bomb with a fuse puffing grey smoke; a small glass vial of glowing amber wake-up brew; a big adjustable steel wrench; a heavy two-handed spanner; a copper rod with a crackling blue spark coil on the tip; a wooden rolling pin; a black cast-iron skillet; a brown leather apron. No labels, no text.' },
    { id: 'items-b', ids: ITEMS.slice(12), cols: 3, rows: 3, prompt: 'A 3x3 grid sheet of nine separate game item icons, evenly spaced with generous empty margins, each on the magenta background, painted in warm storybook gouache, row by row: a brass plate vest; a pair of copper goggles with round green lenses; a lucky charm: a small brass gear pendant on a cord with a tiny green gem; a single brass cog; a coiled steel spring; a small bent lump of rusty scrap metal; a dented copper kettle; a brass round token pass with a keyhole; a glowing golden gear with a warm shine. No labels, no text.' },
];

const sys = (s) => s;
/** The requests of a set, ready for fal-ai/nano-banana-2 (the /edit sets need their reference url). */
export function requests(set) {
    const out = [];
    if (set === 'portraits') for (const [id, [key, d]] of Object.entries(PORTRAITS)) out.push({ id: `por-${id}`, input: { system_prompt: portraitStyle(key), prompt: d, aspect_ratio: '3:4', resolution: '1K' } });
    if (set === 'enemies') for (const [id, [key, d]] of Object.entries(ENEMIES)) out.push({ id: `enemy-${id}`, input: { system_prompt: spriteStyle(key), prompt: d, aspect_ratio: '1:1', resolution: '1K' } });
    if (set === 'bg') for (const [id, d] of Object.entries(BG)) out.push({ id: `bg-${id}`, input: { system_prompt: STYLE, prompt: d, aspect_ratio: '16:9', resolution: '2K' } });
    if (set === 'cg') for (const [id, d] of Object.entries(CG)) out.push({ id: `cg-${id}`, input: { system_prompt: STYLE, prompt: d, aspect_ratio: '16:9', resolution: '2K' } });
    if (set === 'tex') for (const [id, d] of Object.entries(TEX)) out.push({ id: `tex-${id}`, input: { system_prompt: TEXTURE_STYLE, prompt: d, aspect_ratio: '1:1', resolution: '1K' } });
    if (set === 'buildings') for (const [id, [key, d]] of Object.entries(BUILDINGS)) out.push({ id: `prop-${id}`, input: { system_prompt: propStyle(key), prompt: d, aspect_ratio: '1:1', resolution: '1K' } });
    if (set === 'sheets') for (const [id, s] of Object.entries(SHEETS)) out.push({ id: `sheet-${id}`, input: { system_prompt: propStyle(s.key), prompt: s.prompt, aspect_ratio: '1:1', resolution: '2K' } });
    if (set === 'items') for (const s of ITEM_SHEETS) out.push({ id: s.id, input: { system_prompt: propStyle('magenta'), prompt: s.prompt, aspect_ratio: s.cols >= s.rows * 1.3 ? '4:3' : '1:1', resolution: '2K' } });
    return out;
}
if (process.argv[1]?.endsWith('prompts.mjs') && process.argv[2]) console.log(JSON.stringify(requests(process.argv[2]), null, 1));
