// WanderQuest — every fal request for the painted art, built from the game's own tables.
//
//   node game-085/dev/art/prompts.mjs [group|name ...]   # prints the jobs as JSON: [{ name, prompt, aspect_ratio, resolution, key, cells }]
//
// All jobs go to fal-ai/nano-banana-2 with SYSTEM as system_prompt. Sprites are painted on a flat key colour (magenta, or
// green behind anything purple or pink) and cut out by export.py; sheets are grids of separate objects, cut by cell.

import { FAMILIES, REGIONS, CLASSES, TOWNS } from '../../js/sim/data.js';

export const SYSTEM = 'You are the art director of WanderQuest, a cosy fantasy idle game about a caravan of covered wagons travelling a realm gone dark. '
    + 'Every picture is a warm hand-painted storybook illustration in gouache and watercolour: soft painterly brushwork, gentle rounded shapes, '
    + 'a thin dark-brown ink outline around every subject, warm light from the upper left, rich but soft colours, charming rather than frightening. '
    + 'Never include any text, letters, numbers, writing, runes, logos, watermarks, signatures, borders, frames, grid lines, captions, labels or user-interface elements.';

const KEYS = { magenta: ['magenta', '#ff00ff'], green: ['bright green', '#00ff00'] };
const keyed = (key) => {
    const [n, hex] = KEYS[key];
    return ` Paint it on a perfectly flat, uniform, solid ${n} (${hex}) background that fills the whole image edge to edge: `
        + `no ground, no floor, no cast shadow, no scenery, no gradient, no vignette. Do not use ${n} anywhere in the subject itself.`;
};
const ONE = ' Show ONE subject only, the whole of it in frame and centred, with a generous empty margin on every side.';

// ------------------------------------------------------------------ monsters (the road's fights) and Wardens
// key: green behind anything purple, violet or pink, so the cut-out doesn't eat it.
const MONSTER = {
    wolf: ['a grey wolf with yellow eyes, hackles raised, snarling', 'magenta'],
    goblin: ['a small green goblin with red eyes and pointed ears, in a ragged brown tunic, waving a crude short sword', 'magenta'],
    bandit: ['a human highway bandit in a brown hooded cloak with a cloth mask over the lower face, holding a short sword', 'magenta'],
    boar: ['a big brown wild boar with pale curved tusks and a bristly back, head lowered to charge', 'magenta'],
    bramble: ['a bramble imp: a small mischievous floating sprite made of thorny green bramble vines and leaves, with glowing yellow eyes', 'magenta'],
    scorpion: ['a giant amber-orange desert scorpion with big pincers and its segmented tail raised over its back', 'magenta'],
    raider: ['a desert sand raider in sand-coloured robes and a wrapped head-cloth with a face veil, bright blue eyes, holding a curved scimitar', 'magenta'],
    wraith: ['a dust wraith: a ghostly floating spirit made of swirling pale sand and dust, glowing orange eyes, its ragged lower body trailing away into sand', 'magenta'],
    jackal: ['a lean tawny desert jackal with tall ears and yellow eyes', 'magenta'],
    wyrm: ['a sand wyrm: a huge segmented sandy-tan worm-serpent rearing up out of a small mound of sand, a round mouth ringed with teeth, small red eyes', 'magenta'],
    troll: ['a big lumbering bog troll with mossy green skin, long arms, a round belly, pale yellow eyes and tufts of swamp grass on its head', 'magenta'],
    wisp: ['a will-o\'-the-wisp: a small floating ball of soft mint-green ghost light with a wispy tail and two tiny white eyes', 'magenta'],
    spider: ['a fen spider: a large charcoal-black and dark brown spider with a cluster of red eyes and hairy striped legs', 'magenta'],
    leech: ['a leechman: a hunched swamp creature with olive-green slimy skin, a round leech-like mouth, ragged reed clothing and pink eyes', 'magenta'],
    bogling: ['a bogling: a round squat blob of swamp mud and moss with stubby arms and glowing lime-green eyes', 'magenta'],
    icewolf: ['an ice wolf with frosty white-blue fur, ice crystals along its back and glowing blue eyes', 'magenta'],
    yeti: ['a big shaggy white yeti with a grey-blue face and hands and bright blue eyes, arms raised', 'magenta'],
    harpy: ['a storm harpy: a fierce bird creature with broad slate-blue feathered wings, taloned feet and yellow eyes, flying', 'magenta'],
    rime: ['a rime spirit: a floating ghost made of frost and snowflakes, pale ice-blue and white, with glowing white eyes', 'magenta'],
    imp: ['a fire imp: a small flying red-orange imp with leathery bat wings, little horns, a flame-tipped tail and yellow eyes', 'magenta'],
    golem: ['a magma golem: a hulking blocky giant of dark basalt rock with glowing orange lava cracks and yellow eyes', 'magenta'],
    salamander: ['a fire salamander: a large orange lizard with a crest and tail tipped with small flames', 'magenta'],
    cultist: ['an ash cultist in a charcoal-grey hooded robe with crimson trim, the face hidden in shadow except for glowing orange-red eyes, holding a curved dagger', 'magenta'],
    knight: ['a hollow knight: an empty suit of dark violet-grey plate armour with nobody inside, faint lavender light glowing from the visor slit, holding a longsword', 'green'],
    shade: ['a shade: a tall shadowy figure of dark indigo smoke with a hooded head and pale lilac glowing eyes', 'green'],
    stareater: ['a star-eater: a flying creature shaped like a manta ray, made of deep night-blue sky speckled with tiny stars, with white eyes', 'green'],
    hound: ['a void hound: a lean dark purple dog-like beast made of shadow, violet glowing eyes, wisps of darkness trailing from it', 'green'],
};
const WARDEN = {
    thornback: ['an enormous ancient brown boar with huge curling tusks, thorny bramble vines growing all over its back and a crown of thorns', 'magenta'],
    sphinx: ['a majestic sphinx with a lion\'s body and great feathered wings, made entirely of pale blue translucent glass, with glowing pale gold eyes', 'magenta'],
    witch: ['a floating ghostly witch made of sea-green water and pondweed, long dripping hair, holding up a lantern of green fen-light, pale glowing eyes', 'magenta'],
    rimeclaw: ['a large white frost dragon with pale blue wing membranes, icicles hanging from its jaw and glowing cyan eyes, wings spread', 'magenta'],
    colossus: ['a towering giant of black cinder rock with glowing orange lava veins, a molten core in its chest and yellow eyes', 'magenta'],
    hollowking: ['a tall gaunt king in dark violet robes over black armour, a golden crown, an empty shadowed face with two glowing gold eyes, holding a sword', 'green'],
};
const FACING_FOE = ' Full body, standing its ground in a three-quarter view, turned toward the viewer and slightly to the LEFT, ready to fight.';

// ------------------------------------------------------------------ travellers, Grandmother, the carts
const PERSON = {
    captain: ['a young caravan captain in a rust-red travelling coat and a mustard-yellow scarf, sturdy boots, a short sword at the hip, holding a small brass lantern', 'magenta'],
    guard: ['a burly sellsword guard in steel mail and a slate-blue tabard, with a round shield and a spear', 'magenta'],
    cook: ['a cheerful stout cook in an orange tunic and a white apron, holding a big wooden ladle', 'magenta'],
    smith: ['a strong blacksmith in a dark brown leather apron with rolled sleeves, holding a heavy hammer', 'magenta'],
    alchemist: ['a wiry alchemist in a deep purple robe with a lime-green sash and brass goggles on the forehead, holding a round flask with a lit fuse', 'green'],
    trader: ['a well-dressed merchant in a teal-green coat with gold buttons, a coin purse at the belt, holding a small brass balance scale', 'magenta'],
    scout: ['a lithe scout in a forest-green hooded cloak and leather jerkin, holding a longbow', 'magenta'],
    healer: ['a kind healer in pale blue robes with a cream shawl, holding a wooden staff sprouting green leaves', 'magenta'],
    bard: ['a jaunty bard in a plum doublet and a feathered cap, playing a long-necked lute', 'green'],
};
const ODESSA = ['Grandmother Odessa: a kind, sprightly old grandmother with white hair in a bun, a purple shawl over a long brown dress, holding up a glowing brass lantern, leaning on a walking stick', 'green'];
const FACING_FRIEND = ' Full body, standing, three-quarter view turned toward the viewer and slightly to the RIGHT.';

const CART = {
    captain: ['Grandmother\'s wagon: a big old covered wagon with a patched cream canvas hood on wooden hoops, warm brown planks and a brass lantern hanging on a pole at its front', 'magenta'],
    guard: ['the Armoury Cart: a sturdy covered wagon with a slate-blue canvas hood, round shields hung along its sides and spears racked at the back', 'magenta'],
    cook: ['the Kitchen Cart: a covered wagon with an orange canvas hood, a little tin stove chimney poking up through the hood, pots, pans and ladles hanging off the back', 'magenta'],
    smith: ['the Forge Cart: a heavy dark-timbered wagon carrying a stone forge with a red glow, an anvil and bellows on its open back, tools hanging off the tailboard', 'magenta'],
    alchemist: ['the Apothecary Cart: a covered wagon with a deep purple canvas hood, rows of glass bottles and bundles of drying herbs hanging at the back', 'green'],
    trader: ['the Merchant Cart: a covered wagon with a teal canvas hood, piled with crates, barrels and sacks of goods at the back', 'magenta'],
    scout: ['the Outrider\'s Cart: a light, fast wagon with a forest-green canvas hood, a rolled map case, a spyglass and a small pennant on a pole', 'magenta'],
    healer: ['the Chapel Wagon: a small wooden chapel built on a wagon bed, with a pale blue shingled roof, a little bell in a tiny belfry and a round window at the back', 'magenta'],
    bard: ['the Stage Wagon: a colourful travelling-theatre wagon with plum and gold curtains, a fold-down stage at the back and strings of bunting', 'green'],
};
const FROM_BEHIND = ' Seen from BEHIND and slightly above and to the right, as if following it down a road, so its back end faces the viewer and its side shows a little. '
    + 'Four spoked wooden wheels. No horses, no oxen, no people, no driver.';

// ------------------------------------------------------------------ roadside things, in grid sheets
// Each sheet: a grid of separate objects in reading order; export.py cuts it into cells and names each one.
const SHEETS = {
    'p-meadow-trees': { key: 'magenta', grid: [3, 2], items: [
        ['oak', 'a broad round oak tree'], ['oak2', 'a tall oak tree with a lopsided crown'], ['birch', 'a slender silver birch with light green leaves'],
        ['poplar', 'a tall narrow poplar tree'], ['autumn', 'a round tree in autumn orange and gold'], ['bush', 'a round green hedge bush'],
    ] },
    'p-meadow-ground': { key: 'magenta', grid: [3, 2], items: [
        ['rock', 'a grey-brown boulder'], ['rock2', 'a flat mossy grey stone'], ['boulders', 'a cluster of three rounded boulders'],
        ['log', 'a fallen log lying along the ground'], ['stump', 'a sawn tree stump'], ['fence', 'a short section of rustic split-rail wooden fence'],
    ] },
    'p-meadow-life': { key: 'magenta', grid: [2, 2], items: [
        ['sheep', 'a fluffy white sheep with a black face, side view facing right'], ['deer', 'a red deer stag, side view facing right'],
        ['windmill', 'a small white windmill with four sails'], ['haystack', 'a round golden haystack'],
    ] },
    'p-desert': { key: 'magenta', grid: [3, 2], items: [
        ['saguaro', 'a tall saguaro cactus with two arms'], ['barrel', 'a round barrel cactus with a yellow flower'], ['pear', 'a prickly pear cactus with flat paddles'],
        ['deadbush', 'a dry tumbleweed bush'], ['bones', 'a bleached animal skull and ribs half buried in sand'], ['palm', 'a date palm tree'],
    ] },
    'p-mire': { key: 'magenta', grid: [3, 2], items: [
        ['willow', 'a weeping willow'], ['swamptree', 'a gnarled swamp cypress with hanging moss'], ['deadtree', 'a bare dead tree with crooked dark branches'],
        ['giantshroom', 'a giant red-capped toadstool taller than a man'], ['mossrock', 'a boulder covered in thick green moss'], ['reeds', 'a clump of tall bulrush reeds'],
    ] },
    'p-frost': { key: 'magenta', grid: [3, 2], items: [
        ['pine', 'a tall dark green pine tree'], ['pine2', 'a shorter bushy fir tree'], ['snowpine', 'a pine tree laden with snow'],
        ['deadpine', 'a bare grey dead pine'], ['icespire', 'a tall jagged spire of blue ice'], ['iceshards', 'a small cluster of ice shards'],
    ] },
    'p-ember': { key: 'magenta', grid: [3, 2], items: [
        ['lavarock', 'a black rock with glowing orange lava cracks'], ['obsidian', 'a jagged glassy black obsidian outcrop'], ['vent', 'a small volcanic vent cone glowing orange at the top'],
        ['ashtree', 'a charred tree with a few dark grey-brown leaves'], ['ember', 'a small pile of glowing embers'], ['lavarock2', 'a low broad basalt rock with glowing seams'],
    ] },
    'p-verge': { key: 'magenta', grid: [3, 3], items: [
        ['tuft', 'a small tuft of green grass'], ['flowers', 'a small clump of yellow, white and blue wildflowers'], ['pebbles', 'a few small grey pebbles'],
        ['smallrock', 'a small grey stone'], ['drytuft', 'a tuft of dry yellow desert grass'], ['snowtuft', 'a tuft of grass poking through snow'],
        ['ashtuft', 'a tuft of grey ashen grass'], ['lily', 'a few green lily pads with one white water lily'], ['toadstool', 'two little red toadstools with white spots'],
    ] },
    'p-star': { key: 'green', grid: [3, 3], items: [
        ['blossom', 'a round tree covered in pink and white blossom'], ['crystal', 'a tall cluster of glowing violet crystals'], ['crystal2', 'a low cluster of glowing lilac crystals'],
        ['obelisk', 'a slender dark violet stone obelisk with a glowing lilac gem set in it'], ['startree', 'a tree with deep violet leaves speckled with tiny starlights'], ['floatrock', 'a small rock floating in the air with a few pebbles under it'],
        ['glowshroom', 'a cluster of glowing blue-violet mushrooms'], ['shard', 'a single small glowing violet crystal shard'], ['glowtuft', 'a tuft of glowing indigo grass'],
    ] },
};
const SHEET_TAIL = (grid, n) => ` The objects are arranged in a ${grid[0]} by ${grid[1]} grid, ${n} separate objects in reading order, each one whole, small enough to fit well inside its own cell, `
    + 'with wide empty background between them; nothing touches or overlaps another object or the image edge. Each is seen from the front at eye level, slightly from above.';

// wide things (mesas, dunes, distant tree lines): two rows, one band each
const BANDS = {
    'w-desert': { key: 'magenta', rows: [['mesa', 'a wide flat-topped red sandstone mesa'], ['dune', 'a long smooth sand dune']] },
    'w-lines': { key: 'magenta', rows: [['treeline', 'a long band of mixed green deciduous woodland, the edge of a forest seen from a field'], ['pineline', 'a long band of dark green pine forest']] },
};

// ------------------------------------------------------------------ buildings by region (2 x 2 sheets)
const HOUSES = {
    meadow: ['magenta', 'cottages with cream plaster walls, dark timber framing and red-tiled, blue-slate or straw-thatched roofs'],
    desert: ['magenta', 'adobe houses of sand-coloured mud brick with flat roofs, small domes and striped cloth awnings'],
    mire: ['magenta', 'wooden fen houses raised on stilts, with moss-green shingled roofs and little porches'],
    frost: ['magenta', 'stone houses with steep roofs heavy with snow and wooden shutters'],
    ember: ['magenta', 'dark basalt houses with red clay-tiled roofs and warmly glowing windows'],
    star: ['green', 'slender houses of dusky violet stone with tall pointed roofs and windows glowing pale gold'],
};

// ------------------------------------------------------------------ backdrops: distant mountains behind the road
const MOUNTAINS = {
    meadow: ['magenta', 'soft green rolling hills in front of distant blue-grey mountains'],
    desert: ['magenta', 'distant sandstone mesas and buttes in warm ochre and rose'],
    mire: ['magenta', 'misty low blue-green hills covered in dark forest, hazy and soft'],
    frost: ['magenta', 'jagged snow-capped mountain peaks in white and pale blue'],
    ember: ['magenta', 'dark volcanic mountains with a smoking volcano glowing orange at its crater'],
    star: ['green', 'strange violet crystalline peaks under a twilight sky colour, faintly glowing'],
};

// ------------------------------------------------------------------ the job list
// Sheets of several subjects keep the requests (and their cost) down and a set's palette together.
const CREATURE_SHEETS = [
    ['s-mon1', 'magenta', [3, 2], ['wolf', 'goblin', 'bandit', 'boar', 'bramble', 'jackal']],
    ['s-mon2', 'magenta', [3, 2], ['scorpion', 'raider', 'wraith', 'wyrm', 'troll', 'wisp']],
    ['s-mon3', 'magenta', [3, 2], ['spider', 'leech', 'bogling', 'icewolf', 'yeti', 'harpy']],
    ['s-mon4', 'magenta', [3, 2], ['rime', 'imp', 'golem', 'salamander', 'cultist']],
    ['s-mon5', 'green', [2, 2], ['knight', 'shade', 'stareater', 'hound']],
];
const PEOPLE_SHEETS = [
    ['s-people1', 'magenta', [3, 2], ['captain', 'guard', 'cook', 'smith', 'trader', 'scout']],
    ['s-people2', 'green', [2, 2], ['alchemist', 'healer', 'bard', 'odessa']],
];
const CART_SHEETS = [
    ['s-carts1', 'magenta', [3, 2], ['captain', 'guard', 'cook', 'smith', 'trader', 'scout']],
    ['s-carts2', 'green', [3, 1], ['alchemist', 'healer', 'bard']],
];
const THINGS = [
    ['ox', 'a big brown draught ox with pale curved horns and a wooden yoke over its shoulders, seen from directly BEHIND as it plods away from the viewer: its rump and tail toward us, its horns showing over its back'],
    ['campfire', 'a small campfire of crossed logs inside a ring of stones, with bright orange and yellow flames and no smoke'],
    ['gate', 'a rustic wooden town gateway arch seen straight from the front: two thick timber posts and a crossbeam on top, with a large rectangular cream-coloured signboard hanging below the middle of the crossbeam. The signboard is completely BLANK, plain painted wood with nothing written or drawn on it'],
    ['waystone', 'a Waystone: a tall ancient standing stone of grey weathered granite tapering to a point, with a round socket near its top holding a dark, cold, unlit crystal orb, a little moss at its foot'],
    ['waystone-lit', 'the very same Waystone, identical in shape, but now its crystal orb blazes with warm golden light'],
];
const GRID = (grid, n, empty) => ` Arranged in a ${grid[0]} by ${grid[1]} grid in reading order${empty ? `; the last ${grid[0] * grid[1] - n === 1 ? 'cell is' : 'cells are'} left completely empty` : ''}. `
    + 'Each subject is whole and separate, small enough to sit well inside its own cell, with wide empty background between them; nothing touches or overlaps another subject or the image edge. '
    + 'All are painted at the same scale and in the same style, as one matching set.';
const aspect = ([c, r]) => (c === r ? '1:1' : c === 3 && r === 2 ? '3:2' : c === 3 && r === 1 ? '21:9' : c === 2 && r === 1 ? '16:9' : '1:1');

export function jobs() {
    const out = [];
    const sheet = (name, group, key, grid, items, intro, each, tail = '') => out.push({
        name, group, key, aspect_ratio: aspect(grid), resolution: '2K', cells: grid, items: items.map((i) => i[0]),
        prompt: `${intro} ${items.map((i, k) => `${k + 1}. ${i[1]}`).join('; ')}.${GRID(grid, items.length, items.length < grid[0] * grid[1])}${each}${tail}${keyed(key)}`,
    });
    for (const [name, key, grid, ids] of CREATURE_SHEETS) {
        sheet(name, 'monsters', key, grid, ids.map((id) => [`m-${id}`, MONSTER[id][0]]),
            `A matching set of ${ids.length} monsters from a cosy fantasy storybook, one per cell:`,
            ' Each one full body, standing its ground in a three-quarter view, turned toward the viewer and slightly to the LEFT, ready to fight.');
    }
    for (const R of REGIONS) {
        const [look, key] = WARDEN[R.warden.id];
        out.push({ name: `w-${R.warden.id}`, group: 'wardens', key, aspect_ratio: '1:1', resolution: '1K',
            prompt: `${R.warden.name}, ${R.warden.title}: the great guardian monster of ${R.name}, ${look}. Imposing and grand but still storybook-charming.${FACING_FOE}${ONE}${keyed(key)}` });
    }
    for (const [name, key, grid, ids] of PEOPLE_SHEETS) {
        sheet(name, 'people', key, grid, ids.map((id) => [`t-${id}`, id === 'odessa' ? ODESSA[0] : `the ${CLASSES[id].name.toLowerCase()}, ${PERSON[id][0]}`]),
            'A matching cast of travellers who journey together with a merchant caravan, one per cell:',
            ' Each one full body, standing, in a three-quarter view turned toward the viewer and slightly to the RIGHT.');
    }
    for (const [name, key, grid, ids] of CART_SHEETS) {
        sheet(name, 'carts', key, grid, ids.map((id) => [`c-${id}`, CART[id][0]]),
            'A matching set of caravan wagons, one per cell:',
            ' Every wagon is painted in a symmetrical REAR VIEW, exactly as someone walking behind it on the road would see it: we look straight into its back end '
            + '(the round opening of its canvas hood, or its back wall), its tailboard, and its two rear wheels standing left and right at the bottom, seen edge-on as narrow upright ovals. '
            + 'The front wheels are hidden behind them and none of the wagon\'s long sides can be seen. No horses, no oxen, no people, no driver, no smoke.');
    }
    sheet('s-things', 'things', 'magenta', [3, 2], THINGS.map(([n, d]) => [`x-${n}`, d]), 'A matching set of things for a caravan game, one per cell:', ' Each seen from the front at eye level.');
    for (const [name, S] of Object.entries(SHEETS)) {
        sheet(name, 'props', S.key, S.grid, S.items.map(([n, d]) => [`p-${n}`, d]), 'A matching set of separate roadside things for a game, one per cell:', ' Each is seen from the front at eye level, slightly from above.');
    }
    for (const [name, B] of Object.entries(BANDS)) {
        out.push({ name, group: 'props', key: B.key, aspect_ratio: '16:9', resolution: '2K', rows: B.rows.map((r) => `p-${r[0]}`),
            prompt: `Two separate long horizontal bands, one above the other with wide empty background between them: on top, ${B.rows[0][1]}; below, ${B.rows[1][1]}. `
                + `Each band runs almost the full width of the image, seen from the front at a distance, with a flat bottom edge.${keyed(B.key)}` });
    }
    for (const [biome, [key, look]] of Object.entries(HOUSES)) {
        const R = REGIONS.find((r) => r.biome === biome);
        out.push({ name: `h-${biome}`, group: 'houses', key, aspect_ratio: '1:1', resolution: '2K', cells: [2, 2], items: [0, 1, 2, 3].map((i) => `h-${biome}${i}`),
            prompt: `A sheet of four different small houses from ${R.name}: ${look}. Arranged in a 2 by 2 grid, each house whole and separate, with wide empty background between them. `
                + `Each in strict front elevation: the front wall parallel to the picture with a door in the middle, seen slightly from above so the roof shows; not isometric, not a corner view. No ground, no fences, no smoke.${keyed(key)}` });
    }
    for (const [biome, [key, look]] of Object.entries(MOUNTAINS)) {
        const [n, hex] = KEYS[key];
        out.push({ name: `bg-${biome}`, group: 'mountains', key, aspect_ratio: '21:9', resolution: '2K',
            prompt: `A wide panorama of ${look}, seen from very far away: only the distant hills and mountains, no foreground, no meadow, no trees close by. `
                + `The land runs off the left, right and bottom edges of the image without any border, frame or margin, and fills the bottom half of the picture; its skyline is a long varied ridge. `
                + `Above the ridge the sky is a perfectly flat, uniform, solid ${n} (${hex}), with no clouds, no sun, no gradient. Do not use ${n} anywhere in the land.` });
    }
    const towns = TOWNS.map((T) => {
        const R = REGIONS[T.region];
        return [`town-${T.id}`, `${T.name}, a town in ${R.name} (${HOUSES[R.biome][1]}): ${T.blurb}${T.capital ? ' A tall dark Waystone stands at its edge.' : ''}`];
    });
    for (let i = 0; i < towns.length; i += 4) {
        const part = towns.slice(i, i + 4), grid = part.length === 4 ? [2, 2] : [part.length, 1];
        out.push({ name: `s-towns${i / 4 + 1}`, group: 'towns', key: null, aspect_ratio: aspect(grid), resolution: '2K', cells: grid, items: part.map((t) => t[0]), square: true,
            prompt: `${part.length} separate small square paintings of towns, arranged in a ${grid[0]} by ${grid[1]} grid and separated by thin plain white gutters: ${part.map((t, k) => `${k + 1}. ${t[1]}`).join('; ')}. `
                + 'Each painting fills its own square edge to edge: the town seen from the road as you approach it, in soft daylight, a cosy scene with no people in the foreground.' });
    }
    out.push({ name: 'title', group: 'title', key: null, aspect_ratio: '16:9', resolution: '2K',
        prompt: 'Key art for WanderQuest: a little caravan travelling a winding dirt road at golden dusk. At the front, Grandmother\'s big covered wagon with a cream canvas hood and a glowing brass lantern on a pole, pulled by two brown oxen; '
            + 'behind it three smaller covered carts in orange, blue and purple. The road winds from the foreground through green meadows toward a far horizon where the regions of the realm rise one behind another: '
            + 'pale desert mesas, a misty fen, snowy peaks, a distant volcano, and far off a dark tower under the first stars. Warm lantern light, long shadows, a few fireflies. '
            + 'Keep the upper middle of the picture open sky with soft clouds, with room for a title. Painted edge to edge.' });
    out.push({ name: 'icon', group: 'title', key: null, aspect_ratio: '1:1', resolution: '1K',
        prompt: 'An app icon for WanderQuest: Grandmother\'s covered wagon with a cream canvas hood and a glowing brass lantern, three-quarter view, on a deep twilight-blue background with a few stars. '
            + 'Bold, simple and readable at small sizes, centred, filling most of the square, painted edge to edge, no rounded corners, no border.' });
    // the realm map: an edit of a colour layout drawn from the towns (dev/art/map-ref.py), so each region lands where its towns are
    out.push({ name: 'map', group: 'title', key: null, edit: 'map-ref.png', aspect_ratio: 'auto', resolution: '2K',
        prompt: 'Repaint this colour layout as an illustrated antique fantasy map of a realm on aged parchment, in warm hand-painted storybook gouache and ink, seen from above. '
            + 'Keep every coloured patch exactly where it is and the same size, and paint each as its terrain: the green patch at the lower left is gentle farmland meadows with hedgerows and small woods; '
            + 'the amber-orange patch along the bottom middle and right is a sandy desert with dunes and mesas; the teal patch at the right is a misty fen and swamp forest with pools; '
            + 'the pale blue patch at the top right is snowy mountain peaks; the red patch at the top left is dark volcanic land with lava; the violet patch in the centre is a twilight land of crystal spires. '
            + 'Plain parchment between them, a little sea at the edges is fine. Small painted details only: no towns, no roads, no paths, no buildings, no compass rose, no text, no labels, no letters, no border, no frame.' });
    return out;
}

// ------------------------------------------------------------------ CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    const want = process.argv.slice(2);
    const all = jobs();
    const pick = want.length ? all.filter((j) => want.includes(j.group) || want.includes(j.name)) : all;
    process.stdout.write(JSON.stringify(pick, null, 1) + '\n');
}
