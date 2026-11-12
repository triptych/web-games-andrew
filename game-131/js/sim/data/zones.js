// The places of the Spiral Isle, as data. Pure.
//
// A zone is either the open island ('field': walked on the height function in ../terrain.js) or a 'grid' of 3 m cells
// drawn as text: '#' wall, ' ' nothing (open sky or deep water: no standing), anything else floor. A letter on the
// floor is a thing, described in `legend`; a letter with a list takes its entries in reading order.
//
// Thing types: portal (a way to another zone, perhaps needing a gem), lore (an inscription for the journal),
// item (picked up by walking over it), tunnel (a goblin-sized way in: send Fray), npc, offer (give N of an item),
// chime (ring them in the zone's `seq` order), pedestal (a gem, once its `needs` flags are set), door (a wall until
// its flag is set), hearth (the last thing in the game).

import { MARKS } from '../terrain.js';

const at = (name, dx = 0, dz = 0) => ({ x: MARKS[name][0] + dx, z: MARKS[name][1] + dz });

// The Rootshrine: a ring of sixteen standing stones; the western one is the door Fray opens from inside.
const ring = [];
for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, x = MARKS.rootshrine[0] + Math.cos(a) * 8, z = MARKS.rootshrine[1] + Math.sin(a) * 8;
    ring.push(i === 8 ? { id: 'rootDoor', type: 'door', flag: 'rootDoor', x, z, solid: 1.7, look: 'rootdoor' } : { id: 'ring' + i, type: 'deco', x, z, solid: 1.45, look: 'pillar' });
}
// Castle Hollowmere: four towers and what is left of the walls. The west gate stands open.
const castle = [];
for (const [i, [x, z]] of [[78, 20], [106, 20], [78, 48], [106, 48]].entries()) castle.push({ id: 'tower' + i, type: 'deco', x, z, solid: 3.4, look: 'tower' });
const wall = (x0, z0, x1, z1, tag) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2.4);
    for (let i = 0; i <= n; i++) castle.push({ id: `wall${tag}${i}`, type: 'deco', x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n, solid: 1.35, look: 'wall' });
};
wall(83, 20, 101, 20, 'n'); wall(106, 25, 106, 31, 'e'); wall(78, 25, 78, 30, 'w'); wall(78, 42, 78, 44, 'v'); wall(92, 48, 101, 48, 's');

export const ZONES = {
    // ------------------------------------------------------------------ the island itself
    isle: {
        name: 'The Spiral Isle', kind: 'field', music: 'isle',
        spawn: { ...at('start'), yaw: 0 },
        scatter: [
            { kind: 'seaglass', n: 12, from: 'start', maxH: 9 },
            { kind: 'feather', n: 12, from: 'vineTop', minH: 10 },
        ],
        things: [
            // the shore
            { id: 'wreck', type: 'lore', ...at('wreck'), look: 'boat', solid: 1.6, title: 'Your little boat',
                text: 'Hauled above the tide line, mast unstepped. The letter that brought you is still under the thwart: "The Isle has been without a Warden for an age. It asked for you by name. Bring nothing; it has kept everything."' },
            { id: 'cairn', type: 'lore', ...at('cairn'), look: 'cairn', solid: 0.9, title: 'The Welcome Cairn',
                text: 'Seven flat stones, stacked small to large, each cut with one turn of a spiral. Travellers before you have left sea-glass in the gaps. Someone has swept the sand from it recently, with a very small broom.' },
            { id: 'tidewatch', type: 'lore', ...at('tidewatch'), look: 'ruin', solid: 2.2, title: 'Tidewatch',
                text: 'A lookout shrine, half fallen. The carving shows keepers pouring lamp-oil on the waves to calm them for departing ships. Below it, fresh scratches at goblin height: "DO NOT CLIMB. I climbed. — F."' },
            { id: 'fray', type: 'npc', npc: 'fray', ...at('fray'), solid: 0.5 },
            { id: 'mint1', type: 'item', item: 'moonmint', ...at('mint1') },
            { id: 'mint2', type: 'item', item: 'moonmint', ...at('mint2') },
            { id: 'mint3', type: 'item', item: 'moonmint', ...at('mint3') },
            // the Mosswood and the Rootshrine
            ...ring,
            { id: 'rootMural', type: 'lore', ...at('rootMural'), look: 'stone', solid: 0.8, title: 'The Gardeners\' Stone',
                text: 'The Rootshrine was never built. The Leaf-keepers planted sixteen stones and waited four hundred years for the oak to lift them into a ring. "Patience is a kind of building," says the moss-filled lettering. "We were in no hurry. Nor is the oak."' },
            { id: 'rootTunnel', type: 'tunnel', tunnel: 'root', ...at('rootTunnel'), look: 'burrow' },
            { id: 'rootWell', type: 'lore', ...at('rootWell'), look: 'well', solid: 1.3, title: 'The Listening Well',
                text: 'Drop a pebble and the well answers with a note, never the same one twice. The keepers tuned their flutes to it each morning. On the rim: "When we left, we left the well singing, so the wood would not feel alone."' },
            { id: 'rootInner', type: 'lore', ...at('rootshrine', 0, -4.5), look: 'stone', solid: 0.8, title: 'The Last Planting',
                text: '"We have gone inland of the world, where the forests are younger and need us more. The Leaf Gem stays. It was never ours; it only liked our company. Warden, when you come: it grows things. Mostly it grows them toward where you need to go."' },
            { id: 'leafPedestal', type: 'pedestal', gem: 'leaf', ...at('rootshrine'), solid: 0.9, look: 'pedestal' },
            // the cliff
            { id: 'vineFoot', type: 'portal', ...at('vineFoot'), to: 'isle', at: 'vineTop', needs: 'leaf', look: 'vine', label: 'Climb the vine',
                deny: 'A bare cliff, twice the height of the oaks. Dry brown vine-roots cling to it, waiting for something.' },
            { id: 'vineTop', type: 'portal', ...at('vineTop'), to: 'isle', at: 'vineFoot', needs: 'leaf', look: 'vinetop', label: 'Climb down the vine', deny: '' },
            // the highlands: the Golem Fields
            { id: 'grandfather', type: 'offer', npc: 'golem', ...at('grandfather'), solid: 2.6, look: 'golem', item: 'rune', count: 3, flag: 'golemAwake', gem: 'stone',
                label: 'Grandfather Lichen', ask: 'golemAsk', done: 'golemDone' },
            { id: 'rune1', type: 'item', item: 'rune', ...at('rune1') },
            { id: 'rune2', type: 'item', item: 'rune', ...at('rune2', 4, 6) },
            { id: 'golemTunnel', type: 'tunnel', tunnel: 'golem', ...at('golemTunnel'), look: 'burrow' },
            { id: 'golemFallen', type: 'lore', ...at('golemFallen'), look: 'golemfallen', solid: 2.4, title: 'The One Who Lay Down',
                text: 'A golem on its side, one arm curled round a patch of thyme as if round a sleeping cat. It did not fall. The scratched tally on its shoulder counts nine hundred summers, and then: "ENOUGH. GOOD."' },
            { id: 'golemRing', type: 'lore', ...at('golemRing'), look: 'stone', solid: 0.8, title: 'The Field-Makers',
                text: 'The stone-folk made the golems to carry what was too heavy: boulders, grief, the long watches of winter. When the stone-folk walked north across the sea-ice, the golems were told they were free. They thought about it for a century, then chose to mind the meadow.' },
            { id: 'golemSong', type: 'lore', ...at('golemSong'), look: 'golemsmall', solid: 1.4, title: 'The Small One',
                text: 'A golem no taller than a barrel, seated, hands cupped upward. Rain has filled the hands; a wagtail is bathing in them. The inscription on its chest is a single word in the old tongue. Fray sounds it out: "Birdbath."' },
            { id: 'highView', type: 'lore', ...at('highView'), look: 'cairn', solid: 0.9, title: 'The Far Sight',
                text: 'From this cairn you can see the whole Spiral: the wood, the castle on its hill, the pale stairs running into the western sea, and above the clouds, something with towers that does not move with the wind.' },
            { id: 'caveMouth', type: 'portal', ...at('caveMouth'), to: 'caves', at: 'caveExit', needs: 'stone', look: 'cavemouth', label: 'Enter Glimmerdeep',
                deny: 'A boulder the size of a cottage sits in a cleft of the rock. Cool air breathes round its edges. It is not going to move for you.' },
            // Castle Hollowmere
            ...castle,
            { id: 'castleGate', type: 'lore', ...at('castleGate'), look: 'stone', solid: 0.8, title: 'The Open Gate',
                text: '"Hollowmere has no lock. Queen Isolde had the gates taken off their hinges the day she was crowned and made into a table long enough for everyone." The table is still in the yard. It is a very long table.' },
            { id: 'throne', type: 'lore', ...at('throne'), look: 'throne', solid: 1.1, title: 'The Garden Throne',
                text: 'The last queen never sat here; she said it was a waste of a good south wall and trained a pear tree up it. There are pears. The plaque reads: "Take one. Take two. I am not here to stop you. — I."' },
            { id: 'garden', type: 'lore', ...at('garden'), look: 'stone', solid: 0.8, title: 'The Farewell Roll',
                text: 'Every name in the castle, cut in rows, with where they went: "to the mainland, to be a baker." "to sea, for love." "to the mountains, to find out." The last line is the queen\'s: "to see what is past the edge of the map. Leave the lamps for whoever comes."' },
            { id: 'banner', type: 'lore', ...at('banner'), look: 'stone', solid: 0.8, title: 'The Wind-Callers',
                text: 'Hollowmere kept a wind organ in the undercroft, played once a year to thank the air for the harvest. Its music could be heard in the Aerie, and the sky-folk would answer with bells. The stair down is dark now. It wants a light that does not go out.' },
            { id: 'underStair', type: 'portal', ...at('underStair'), to: 'under', at: 'underExit', needs: 'light', look: 'stair', label: 'Go down to the Underkeep',
                deny: 'A stair going down into a dark so complete it seems solid. Fray could manage it. You could not.' },
            { id: 'windPerch', type: 'portal', ...at('windPerch'), to: 'sky', at: 'skyLanding', needs: 'wind', look: 'perch', label: 'Step onto the wind',
                deny: 'A stone platform with no rail and a spiral worn into it by ten thousand feet. Far overhead, towers drift in the blue. There is no stair.' },
            // the west
            { id: 'tideArch', type: 'lore', ...at('tideArch'), look: 'arch', solid: 1.0, title: 'The Tide Arch',
                text: 'Carved waves, and under them carved streets. "Thalune did not drown. Thalune went swimming." The sea-folk loved the whales more than the land, and one spring they asked the sea to rise over their city, gently, like a blanket.' },
            { id: 'fisherHut', type: 'lore', ...at('fisherHut'), look: 'hut', solid: 2.0, title: 'The Net-Mender\'s Hut',
                text: 'One wall, a hearth and a row of pegs. A net hangs half mended, the needle still in it. Chalked on the lintel in a careful hand: "Back when the mackerel run." The chalk is three hundred years old and looks like yesterday\'s.' },
            { id: 'tideStairs', type: 'portal', ...at('tideStairs'), to: 'sea', at: 'seaLanding', needs: 'water', look: 'tidestair', label: 'Walk down into the sea',
                deny: 'White steps run down the beach and on under the waves, as far as you can see through the green water. You hold your breath just looking.' },
            { id: 'moonStone', type: 'lore', ...at('moonStone'), look: 'stone', solid: 0.8, title: 'The Door-Ward\'s Stone',
                text: 'Goblin letters, small and deep: "UNDERHOME. Knock by moonlight or not at all. Up-goers will not be named. Mind the step." Fray runs her fingers over the third line twice and says nothing.' },
            { id: 'moonDoor', type: 'portal', ...at('moonDoor'), to: 'warren', at: 'warrenDoor', needs: 'moon', look: 'moondoor', label: 'Open the moon door',
                deny: 'A round stone door in the hillside, no taller than your chest, with a crescent cut into it. It is shut the way a held breath is shut.' },
        ],
    },

    // ------------------------------------------------------------------ Glimmerdeep, the crystal caves
    caves: {
        name: 'Glimmerdeep', kind: 'grid', cell: 3, music: 'caves', look: 'caves',
        scatter: [{ kind: 'shard', n: 12 }],
        seq: { order: ['chime3', 'chime1', 'chime4', 'chime2'], flag: 'cavesSung' },
        map: [
            '######################',
            '#E...#.....a.#.......#',
            '#....#.......#..1.2..#',
            '#..........###.......#',
            '#....#.......D...P...#',
            '##.###..b....#.......#',
            '#....#.......#..3.4..#',
            '#....#####.###.......#',
            '#.c......#.#.#####.###',
            '#........#t#.....#...#',
            '#....#.....#..d......#',
            '#....#.....#.....#...#',
            '######################',
        ],
        legend: {
            E: { id: 'caveExit', type: 'portal', to: 'isle', at: 'caveMouth', look: 'exit', label: 'Climb back to the highlands' },
            a: { id: 'cavesA', type: 'lore', look: 'crystal', solid: 0.9, title: 'The First Lamp',
                text: 'A crystal the height of a child, glowing the colour of honey. The deep-miners did not dig for gems. They dug for dark, to plant light in it. "We came for the quiet," says the plate at its foot, "and found it sang."' },
            b: { id: 'cavesB', type: 'lore', look: 'stone', solid: 0.8, title: 'The Tuning Verse',
                text: '"Wake the Heart of Glimmerdeep as the miners did at shift\'s end. Strike first the LOW stone by the southern wall on the sunset side; then the stone by the northern wall on the sunset side; then south again, toward sunrise; and last the northern sunrise stone. Low, far, low, far: a yawn and a stretch."' },
            c: { id: 'cavesC', type: 'lore', look: 'cart', solid: 1.1, title: 'The Last Cart',
                text: 'An ore cart on wooden rails, full to the brim with nothing but folded blankets and a tin cup. The miners slept here on the hottest days of summer. A note is tucked in the cup: "Whoever needs the cool: it\'s yours."' },
            d: { id: 'cavesD', type: 'lore', look: 'crystal', solid: 0.9, title: 'Where the Light Went',
                text: '"We followed the vein down past where maps mean anything, and it opened on a sea with its own stars. We are going to see what they are stars of. The Light Gem stays in the Heart: it shows what is true, and the truth is we were happy here."' },
            t: { id: 'cavesTunnel', type: 'tunnel', tunnel: 'caves', look: 'burrow' },
            D: { id: 'crystalGate', type: 'door', flag: 'crystalGate', look: 'crystalgate' },
            1: { id: 'chime1', type: 'chime', note: 1, look: 'chime', solid: 0.7, label: 'Strike the singing stone' },
            2: { id: 'chime2', type: 'chime', note: 2, look: 'chime', solid: 0.7, label: 'Strike the singing stone' },
            3: { id: 'chime3', type: 'chime', note: 0, look: 'chime', solid: 0.7, label: 'Strike the singing stone' },
            4: { id: 'chime4', type: 'chime', note: 3, look: 'chime', solid: 0.7, label: 'Strike the singing stone' },
            P: { id: 'lightPedestal', type: 'pedestal', gem: 'light', needs: ['cavesSung'], look: 'pedestal', solid: 0.9,
                wait: 'A great dark crystal on a plinth, with four smaller ones standing round it like a choir waiting for the note.' },
        },
    },

    // ------------------------------------------------------------------ the Underkeep
    under: {
        name: 'The Underkeep', kind: 'grid', cell: 3, music: 'under', look: 'under',
        scatter: [{ kind: 'crown', n: 12 }],
        map: [
            '########################',
            '#S....#..a..#....#.....#',
            '#.....#.....#....#..O..#',
            '#...........#....#.....#',
            '#.....#.....#.b..#.....#',
            '###.###.....##.###..c..#',
            '#.....#..........G.....#',
            '#.p...###.####.###.....#',
            '#.....#....#.....#######',
            '#.....#.t..#..p..#.....#',
            '#..d.................p.#',
            '#.....#....#.....#.....#',
            '########################',
        ],
        legend: {
            S: { id: 'underExit', type: 'portal', to: 'isle', at: 'underStair', look: 'exit', label: 'Climb back to the castle yard' },
            a: { id: 'underA', type: 'lore', look: 'stone', solid: 0.8, title: 'The Cells That Never Were',
                text: 'Queen Isolde inherited a dungeon and no one to put in it. The cells became a cheese store, a place to dry onions, and one room where children were sent to shout until they felt better. The shouting room has the best echo in the castle.' },
            b: { id: 'underB', type: 'lore', look: 'barrel', solid: 1.0, title: 'The Cellarer\'s Ledger',
                text: '"Cider, 40 barrels. Perry, 12. Something Old Tam made, 1 (do not open indoors)." The last entry: "Left 3 barrels for the next folk. If you are the next folk: the one with the red bung is the good one."' },
            c: { id: 'underC', type: 'lore', look: 'stone', solid: 0.8, title: 'The Organ-Builder\'s Mark',
                text: '"I made her from the pipes of nine shipwrecks, so that drowned brass could sing again. She has ninety pipes and wants every one. Three I never could keep in their racks; they wander. If she is silent, look for the wanderers." — Maud, who also made the long table.' },
            d: { id: 'underD', type: 'lore', look: 'stone', solid: 0.8, title: 'The Night Stair',
                text: 'A child\'s chalk drawings cover this wall from knee to shoulder height: a castle, a whale, a very round queen. Higher up, in an adult hand: "Bed. NOW." And under that, in the child\'s: "five more minits." It was never rubbed out.' },
            t: { id: 'underTunnel', type: 'tunnel', tunnel: 'under', look: 'burrow' },
            G: { id: 'underGate', type: 'door', flag: 'underGate', look: 'portcullis' },
            p: [
                { id: 'pipe1', type: 'item', item: 'pipe' },
                { id: 'pipe2', type: 'item', item: 'pipe' },
                { id: 'pipe3', type: 'item', item: 'pipe' },
            ],
            O: { id: 'organ', type: 'offer', look: 'organ', solid: 1.6, item: 'pipe', count: 3, flag: 'organPlayed', gem: 'wind',
                label: 'The wind organ', ask: 'organAsk', done: 'organDone' },
        },
    },

    // ------------------------------------------------------------------ the Aerie, the castle in the sky
    sky: {
        name: 'The Aerie', kind: 'grid', cell: 3, music: 'sky', look: 'sky',
        scatter: [{ kind: 'starseed', n: 12 }],
        seq: { order: ['vane2', 'vane4', 'vane1', 'vane3'], flag: 'skySung' },
        map: [
            '                       ',
            '  .....    ...    .....',
            '  .a...    .b.    .....',
            '  ........................',
            '  .....    ...    ..t..',
            '    .     1...2     .  ',
            '  S....   ..P..   ..c..',
            '    .     3...4     .  ',
            '  .....    ...    .....',
            '  ........................',
            '  .d...    ...    .....',
            '  .....    .e.    .....',
            '                       ',
        ],
        legend: {
            S: { id: 'skyLanding', type: 'portal', to: 'isle', at: 'windPerch', look: 'exit', label: 'Step off, back down to the castle' },
            a: { id: 'skyA', type: 'lore', look: 'stone', solid: 0.8, title: 'The Charter of the Aerie',
                text: '"We built on cloud because cloud does not belong to anyone. No tolls, no walls, no keys. A bridge to every tower and a bell on every bridge, so you always know a friend is coming." The bells are gone. The hooks still ring a little in the wind.' },
            b: { id: 'skyB', type: 'lore', look: 'stone', solid: 0.8, title: 'The Weather Rhyme',
                text: '"Turn the vanes as the day turns, to draw rain into the cistern. Morning comes from the sunrise side of the northern wall. Evening settles on the sunrise side of the southern wall. Night creeps in from the north, on the sunset side. And dawn-before-dawn waits at the south, on the sunset side."' },
            c: { id: 'skyC', type: 'lore', look: 'telescope', solid: 1.0, title: 'The Kind Telescope',
                text: 'A brass telescope fixed to look down, not up. The sky-folk used it to watch the island for anyone who looked lost, and would lower a basket of bread on a very long rope. The rope is coiled beside it. There is a basket.' },
            d: { id: 'skyD', type: 'lore', look: 'stone', solid: 0.8, title: 'The Drifting',
                text: '"The wind asked if we would like to see the other side of the world, and we could not think of a reason to say no. We have left the cistern full and the Water Gem in it, so the island will have rain without us. It will find the sea on its own, when someone kind carries it."' },
            e: { id: 'skyE', type: 'lore', look: 'nest', solid: 1.0, title: 'The Borrowed Nest',
                text: 'An enormous nest of silver twigs, empty, with one pale feather as long as your arm. Carved on the parapet beside it: "She comes back every hundredth spring. Do not tidy."' },
            t: { id: 'skyTunnel', type: 'tunnel', tunnel: 'sky', look: 'pipe' },
            1: { id: 'vane1', type: 'chime', note: 2, look: 'vane', solid: 0.6, label: 'Turn the weather vane' },
            2: { id: 'vane2', type: 'chime', note: 0, look: 'vane', solid: 0.6, label: 'Turn the weather vane' },
            3: { id: 'vane3', type: 'chime', note: 3, look: 'vane', solid: 0.6, label: 'Turn the weather vane' },
            4: { id: 'vane4', type: 'chime', note: 1, look: 'vane', solid: 0.6, label: 'Turn the weather vane' },
            P: { id: 'waterPedestal', type: 'pedestal', gem: 'water', needs: ['skyValve', 'skySung'], look: 'cistern', solid: 1.2,
                wait: 'A wide stone cistern, dry as a drum. Something blue glints under the grating at the bottom, out of reach.',
                half: 'The cistern still stands empty. The valve and the vanes must both do their part.' },
        },
    },

    // ------------------------------------------------------------------ Thalune, the city that went swimming
    sea: {
        name: 'Thalune', kind: 'grid', cell: 3, music: 'sea', look: 'sea',
        scatter: [{ kind: 'songshell', n: 12 }],
        map: [
            '########################',
            '#L....#..........#.....#',
            '#.....#..#....#..#..p..#',
            '#................#.....#',
            '#.....#..#.M..#..#..c..#',
            '#..a..#................#',
            '###.###..#....#..###.###',
            '#.....#..........#.....#',
            '#..p..###..##..###..t..#',
            '#..........b...........#',
            '#.....#....##....#..d..#',
            '########################',
        ],
        legend: {
            L: { id: 'seaLanding', type: 'portal', to: 'isle', at: 'tideStairs', look: 'exit', label: 'Climb the stairs back to the beach' },
            a: { id: 'seaA', type: 'lore', look: 'stone', solid: 0.8, title: 'The Harbour Law',
                text: '"No ship leaves Thalune without a loaf, a lamp and a song. No ship is asked where it is going." Below, a list of songs, most of them about soup.' },
            b: { id: 'seaB', type: 'lore', look: 'mosaic', solid: 0.2, title: 'The Whale Road',
                text: 'A mosaic of the whole sea floor, picked out in blue glass. A line of gold tiles runs from this square off the edge of the picture, with small whales swimming beside it. At the edge, three words: "This way. Soon."' },
            c: { id: 'seaC', type: 'lore', look: 'stone', solid: 0.8, title: 'The Pearl Tithe',
                text: '"Tide Mother asks nothing. But it is polite to bring her three pearls when you want the moon\'s attention: one for the tide that comes, one for the tide that goes, and one for the still water between."' },
            d: { id: 'seaD', type: 'lore', look: 'bell', solid: 1.0, title: 'The Sunken Bell',
                text: 'The harbour bell, green with age. A crab lives in it and has decorated. When the current shifts the bell gives one soft note, and far off, something very large answers.' },
            M: { id: 'tideMother', type: 'offer', look: 'tidemother', solid: 1.6, item: 'pearl', count: 3, flag: 'tideGiven', gem: 'moon',
                label: 'Tide Mother', ask: 'tideAsk', done: 'tideDone' },
            p: [
                { id: 'pearl1', type: 'item', item: 'pearl' },
                { id: 'pearl2', type: 'item', item: 'pearl' },
            ],
            t: { id: 'seaTunnel', type: 'tunnel', tunnel: 'sea', look: 'pipe' },
        },
    },

    // ------------------------------------------------------------------ Underhome, the goblin warren
    warren: {
        name: 'Underhome', kind: 'grid', cell: 3, music: 'warren', look: 'warren',
        scatter: [{ kind: 'button', n: 12 }],
        map: [
            '######################',
            '#W...#.....#####.....#',
            '#....#..a..#...#..c..#',
            '#..........#.g.#.....#',
            '#....#.....#...#.....#',
            '##.#####.####.####.###',
            '#....#.............#.#',
            '#.b..#....H....E...#.#',
            '#....#.............#.#',
            '#........#...#.....t.#',
            '#....#...#.d.#.....#.#',
            '######################',
        ],
        legend: {
            W: { id: 'warrenDoor', type: 'portal', to: 'isle', at: 'moonDoor', look: 'exit', label: 'Go back up through the moon door' },
            a: { id: 'warrenA', type: 'lore', look: 'stone', solid: 0.8, title: 'The Naming Wall',
                text: 'Every goblin of Underhome, back to the first, each name pressed into the clay with a thumb. Near the bottom one thumb-print has been smoothed over with a wet hand. The clay there is still paler than the rest.' },
            b: { id: 'warrenB', type: 'lore', look: 'loom', solid: 1.1, title: 'The Mending Room',
                text: 'Nothing in Underhome is thrown away. Socks are darned until they are more darn than sock. A sign: "IF IT IS BROKE BRING IT. IF YOU ARE BROKE, ALSO BRING IT. SOUP AT SIX."' },
            c: { id: 'warrenC', type: 'lore', look: 'stone', solid: 0.8, title: 'The Law of Up',
                text: '"The first goblins came down out of the sun, which was unkind to them. So: no goblin goes Up. Who goes Up is un-named, for their own good, so the sun cannot call them back." In newer scratches underneath: "this is a sad law. — several of us"' },
            d: { id: 'warrenD', type: 'lore', look: 'stone', solid: 0.8, title: 'The Listening Dark',
                text: '"Behind the Hearth is the road the Heart came by. There is no light in it and light does not help: it is full of glimmers that are not there. Every sighted goblin who went in came out the same door, dizzy. We have stopped trying. The Hearth dims a little every year."' },
            g: { id: 'granny', type: 'lore', look: 'goblinold', solid: 0.6, title: 'Granny Sootwick\'s Nook',
                text: 'A rocking chair, nine shawls and a kettle that is never cold. A very old goblin is asleep with her mouth open. Pinned to her top shawl: "IF I AM ASLEEP I AM LISTENING. — G. Sootwick, Ember-Tender (ret.), taught Fray everything, proud of it."' },
            E: { id: 'elder', type: 'npc', npc: 'elder', look: 'elder', solid: 0.6 },
            H: { id: 'hearth', type: 'hearth', look: 'hearth', solid: 1.6 },
            t: { id: 'hearthTunnel', type: 'tunnel', tunnel: 'hearth', look: 'darkway', needsFlag: 'hearthSet',
                deny: 'A low black opening behind the hall. Cold comes out of it, and a sense of being politely ignored.' },
        },
    },
};

// ---------------------------------------------------------------- the tunnels only Fray can enter
// Text maps, north up. S is the mouth; L a lever, I an item, H the Heart, b something small and lost she can pocket.
export const TUNNELS = {
    root: { name: 'the root-way under the Rootshrine', flag: 'rootDoor', thing: 'lever',
        found: 'A root as thick as my arm, sticking out sideways. It wiggles. That is not a root, that is a lever.',
        used: 'It goes clunk. Something big and stone goes grrrrind, up where you are. Was that good? That sounded good.',
        map: ['#######', '#b..L.#', '#.#.#.#', '#.#...#', '###.###', '###S###'] },
    golem: { name: 'the hollow under the sleeping golem', item: 'rune', thing: 'item',
        found: 'A flat stone, warm, with a spiral I can feel with my thumb. It is humming one long low note.',
        used: 'Got it. It is heavier than it looks. Everything is heavier than it looks when you cannot look.',
        map: ['########', '#I.#..b#', '#..#.###', '#......#', '####.###', '####S###'] },
    caves: { name: 'the crack behind the crystal gate', flag: 'crystalGate', thing: 'lever',
        found: 'A cold bar across the passage with a ring on the end. Miners like rings. Rings are for pulling.',
        used: 'Pulled. Oh! Everything is ringing, like a spoon on a glass, a very big glass.',
        map: ['#########', '#b#...#L#', '#.#.#.#.#', '#...#...#', '###.#####', '###S#####'] },
    under: { name: 'the drain beside the portcullis', flag: 'underGate', thing: 'lever',
        found: 'A chain, hanging down, each link as big as my hand. It smells of old iron and a little bit of cheese.',
        used: 'Heave! It is going up, I can hear it going up, rattle rattle rattle. I am very strong. Tell everyone.',
        map: ['#########', '#...#..b#', '#.#.#.###', '#L#.....#', '###.###.#', '###S###.#', '#########'] },
    sky: { name: 'the old rain-pipe of the Aerie', flag: 'skyValve', thing: 'lever',
        found: 'A wheel. A round wheel with spokes, stuck on the end of the pipe. Wheels turn. I know about wheels.',
        used: 'It turns! Something is gurgling. I would like to remind you that we are in the sky and I cannot see the floor.',
        map: ['#########', '#b....#.#', '###.#.#L#', '#...#...#', '#.#####.#', '#...S...#', '#########'] },
    sea: { name: 'the dry pipe under Thalune', item: 'pearl', thing: 'item',
        found: 'Something round and smooth in a shell the size of a soup bowl. It is cold like the moon would be.',
        used: 'I have it. I am going to stop thinking about how much sea is on top of this pipe now.',
        map: ['##########', '#I..#...b#', '###.#.####', '#...#....#', '#.#####.##', '#...S...##', '##########'] },
    hearth: { name: 'the Listening Dark', item: 'heart', thing: 'heart',
        found: 'Oh. Oh, it is warm. It is beating, like a small animal asleep. It knows my name. It knows my name.',
        used: 'I have the Heart. I am coming home. Keep talking, so I know which way home is.',
        map: ['###########', '#H#.....#b#', '#.#.###.#.#', '#.#...#...#', '#.###.###.#', '#...#...#.#', '###.###.#.#', '#b..#...#.#', '#.###.###.#', '#.....S...#', '###########'] },
};
