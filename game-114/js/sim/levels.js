// The eight sectors and the level builder. Pure.
//
// A level is a row of hand-made chunks picked by a seed. Chunks are drawn bottom-aligned, top row
// first, and every chunk enters and leaves on the floor (rows 0–1 solid) so any two can follow
// each other. Design rules the bot proves on every seed: steps up of at most 3 tiles, gaps of at
// most 4, platforms at least 4 wide.
//
//   #  solid          =  one-way platform     ~  acid
//   k  skitter        w  wisp                 s  spitter (an acid plant)
//   t  turret (ship) / spitter (homeworld)    b  brute       n  nest (homeworld) / skitter (ship)
//   P  colonist pod   +  weapon capsule       h  med kit     f  flare pack
//   L  lamp           v  steam vent (ship)    E  exit door

import { makeRng, hash3 } from '../rng.js';
import { LEVEL_H, ARENA_W } from '../config.js';
import { T_EMPTY, T_SOLID, T_PLAT, T_ACID, groundBelow } from './physics.js';

const FLOOR = (w) => ['#'.repeat(w), '#'.repeat(w)];

export const CHUNKS = {
    start: [
        '..............',
        '...L.......L..',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        ...FLOOR(14),
    ],
    exit: [
        '................',
        '...L........L...',
        '................',
        '................',
        '................',
        '................',
        '...........E....',
        ...FLOOR(16),
    ],
    arena: [
        '........................',
        '...L.......L.......L....',
        '........................',
        '........................',
        '...=====........=====...',
        '........................',
        '........................',
        '........................',
        ...FLOOR(ARENA_W),
    ],
    hall: [
        '..........................',
        '....L.............L.......',
        '..........................',
        '..............w...........',
        '.........=====............',
        '..........................',
        '....k.....P.....k.....+...',
        ...FLOOR(26),
    ],
    stairs: [
        '........................',
        '..........L.............',
        '..........P.............',
        '.........###............',
        '......t..###.....k......',
        '.....#########..........',
        '...###########......h...',
        ...FLOOR(24),
    ],
    acid: [
        '..........................',
        '...........L..............',
        '..........................',
        '...........P..............',
        '..........====............',
        '..........................',
        '...k...................k..',
        '######~~~~######~~~~######',
        '##########################',
    ],
    bridge: [
        '............................',
        '......L..............L......',
        '............................',
        '..........w.......w.........',
        '............................',
        '........====....====........',
        '............................',
        '....s...................s...',
        '######~~~~~~~~~~~~~~~~######',
        '############################',
    ],
    tower: [
        '..........................',
        '.........L......L.........',
        '...........P..............',
        '..........=====...........',
        '..........................',
        '......=====.....=====.....',
        '..........................',
        '...k....######.......b....',
        '........######.......f....',
        ...FLOOR(26),
    ],
    ledges: [
        '..............................',
        '....L.........L.........L.....',
        '..............................',
        '.........t..........t.........',
        '........####.......####.......',
        '..............................',
        '..............................',
        '...k.....+.....k.........k....',
        ...FLOOR(30),
    ],
    nest: [
        '..........................',
        '....L..............L......',
        '..........................',
        '........w.......w.........',
        '..........................',
        '..........................',
        '....n.........P.....n.....',
        ...FLOOR(26),
    ],
    vents: [
        '............................',
        '....L..........L........L...',
        '............................',
        '............................',
        '........=====.......=====...',
        '............................',
        '..k...v.......v.......v..h..',
        ...FLOOR(28),
    ],
    drop: [
        '........................',
        '...L.................L..',
        '........................',
        '........................',
        '......##########........',
        '...#############...P....',
        '..##############..k.....',
        ...FLOOR(24),
    ],
    cover: [
        '..............................',
        '....L.........L..........L....',
        '..............................',
        '.............=====............',
        '..............................',
        '..............................',
        '......##..........b......##...',
        '..f...##.........P.......##...',
        ...FLOOR(30),
    ],
    upper: [
        '................................',
        '....L...........L..........L....',
        '........w.................w.....',
        '..........======....======......',
        '................................',
        '......======.............P......',
        '................................',
        '...k.......s........k.......s...',
        ...FLOOR(32),
    ],
    pits: [
        '..............................',
        '.....L...............L........',
        '..............................',
        '..............P...............',
        '.............====.............',
        '..............................',
        '..k....................w...k..',
        '#######~~~~###~~~~#####~~~~###',
        '##############################',
    ],
};

// palette ids are looked up by the view (js/view/world.js)
export const LEVELS = [
    {
        id: 'cryo', name: 'CRYO DECK', place: 'Ark Halcyon · Deck 1', theme: 'ship', pal: 'cryo',
        chunks: 6, pool: ['hall', 'stairs', 'ledges', 'drop', 'acid', 'upper', 'cover'],
        allow: 'kwt', density: 0.6, pods: 3, end: 'exit',
    },
    {
        id: 'hydro', name: 'HYDROPONICS', place: 'Ark Halcyon · Deck 4', theme: 'ship', pal: 'hydro',
        chunks: 7, pool: ['hall', 'acid', 'bridge', 'upper', 'tower', 'pits', 'stairs'],
        allow: 'kwst', density: 0.7, pods: 4, end: 'brood',
    },
    {
        id: 'reactor', name: 'REACTOR RING', place: 'Ark Halcyon · Engineering', theme: 'ship', pal: 'reactor',
        chunks: 8, pool: ['vents', 'ledges', 'drop', 'pits', 'cover', 'tower', 'vents', 'acid'],
        allow: 'kwtb', density: 0.75, pods: 4, end: 'exit',
    },
    {
        id: 'spine', name: 'COMMAND SPINE', place: 'Ark Halcyon · Bridge', theme: 'ship', pal: 'spine',
        chunks: 8, pool: ['ledges', 'cover', 'upper', 'stairs', 'vents', 'hall', 'bridge'],
        allow: 'kwtb', density: 0.8, pods: 4, end: 'warden',
    },
    {
        id: 'ash', name: 'ASHFALL WASTES', place: 'Homeworld · The Landing', theme: 'alien', pal: 'ash',
        chunks: 8, pool: ['hall', 'pits', 'nest', 'drop', 'tower', 'acid', 'upper'],
        allow: 'kwsn', density: 0.75, pods: 5, end: 'exit',
    },
    {
        id: 'bone', name: 'BONE CANYONS', place: 'Homeworld · The Ribs', theme: 'alien', pal: 'bone',
        chunks: 9, pool: ['bridge', 'pits', 'cover', 'stairs', 'nest', 'tower', 'drop'],
        allow: 'kwsnb', density: 0.8, pods: 5, end: 'gravemaw',
    },
    {
        id: 'spires', name: 'HIVE SPIRES', place: 'Homeworld · The Spires', theme: 'alien', pal: 'spires',
        chunks: 9, pool: ['upper', 'nest', 'acid', 'bridge', 'tower', 'pits', 'cover'],
        allow: 'kwsnb', density: 0.8, pods: 5, end: 'exit',
    },
    {
        id: 'larder', name: 'THE LARDER', place: 'Homeworld · The Queen\'s Chamber', theme: 'alien', pal: 'larder',
        chunks: 7, pool: ['nest', 'cover', 'pits', 'upper', 'bridge', 'drop', 'hall'],
        allow: 'kwsnb', density: 0.8, pods: 4, end: 'queen',
    },
];

export const TOTAL_PODS = LEVELS.reduce((a, l) => a + l.pods, 0);
/** Colonists held in the Larder and freed when the Queen falls. */
export const LARDER_COLONISTS = 112;

const ENEMY_OF = { k: 'skitter', w: 'wisp', s: 'spitter', t: 'turret', b: 'brute', n: 'nest' };
const GROUNDED = new Set(['skitter', 'spitter', 'turret', 'brute', 'nest', 'pod', 'med', 'flare', 'vent', 'exit']);

/** Translate a chunk letter into an enemy kind for this level, or null. */
function enemyFor(def, ch) {
    let k = ch;
    if (def.theme === 'alien' && k === 't') k = 's';
    if (def.theme === 'ship' && k === 'n') k = 'k';
    if (!def.allow.includes(k)) k = (k === 'b' || k === 's' || k === 'n') ? 'k' : (k === 't' ? 'k' : null);
    if (k && !def.allow.includes(k)) return null;
    return k ? ENEMY_OF[k] : null;
}

export function chunkWidth(name) {
    const rows = CHUNKS[name];
    const w = rows[0].length;
    for (const r of rows) if (r.length !== w) throw new Error(`chunk ${name}: ragged rows`);
    return w;
}

/** Build level idx for a game seed. The same (idx, seed) always gives the same level. */
export function buildLevel(idx, seed) {
    const def = LEVELS[idx];
    const rng = makeRng(Math.floor(hash3(seed, idx, 77) * 4294967296));
    // ---- chunk order
    const seq = ['start'];
    let last = null;
    for (let i = 0; i < def.chunks; i++) {
        let c;
        do c = rng.pick(def.pool); while (c === last && def.pool.length > 1);
        seq.push(c);
        last = c;
    }
    seq.push(def.end === 'exit' ? 'exit' : 'arena');

    const widths = seq.map(chunkWidth);
    const W = widths.reduce((a, b) => a + b, 0);
    const H = LEVEL_H;
    const tiles = new Array(W * H).fill(T_EMPTY);
    const marks = [];
    const chunkX = [];
    let ox = 0;
    seq.forEach((name, ci) => {
        chunkX.push(ox);
        const rows = CHUNKS[name];
        const n = rows.length;
        for (let i = 0; i < n; i++) {
            const r = n - 1 - i;
            for (let c = 0; c < rows[i].length; c++) {
                const ch = rows[i][c];
                const x = ox + c;
                if (ch === '#') tiles[r * W + x] = T_SOLID;
                else if (ch === '=') tiles[r * W + x] = T_PLAT;
                else if (ch === '~') tiles[r * W + x] = T_ACID;
                else if (ch !== '.') marks.push({ ch, x, y: r, ci });
            }
        }
        ox += widths[ci];
    });
    // the ship has a ceiling; the homeworld is open sky
    if (def.theme === 'ship') for (let x = 0; x < W; x++) { tiles[14 * W + x] = T_SOLID; tiles[15 * W + x] = T_SOLID; }

    const L = { idx, w: W, h: H, tiles, theme: def.theme, pal: def.pal, name: def.name };
    const drop = (x, y) => {
        const g = groundBelow(L, Math.floor(x), y + 0.5);
        return g < 0 ? y : g;
    };

    const spawns = [], pods = [], pickups = [], lamps = [], vents = [];
    let exit = null;
    const podMarks = [], weaponMarks = [];
    for (const m of marks) {
        const cx = m.x + 0.5;
        switch (m.ch) {
            case 'L': lamps.push({ x: cx, y: m.y + 0.5 }); break;
            case 'P': podMarks.push(m); break;
            case '+': weaponMarks.push(m); break;
            case 'h': if (rng() < 0.75) pickups.push({ k: 'med', x: cx, y: drop(cx, m.y) }); break;
            case 'f': if (rng() < 0.75) pickups.push({ k: 'flare', x: cx, y: drop(cx, m.y) }); break;
            case 'v': if (def.theme === 'ship') vents.push({ x: cx, y: drop(cx, m.y), t: rng() * 3 }); break;
            case 'E': exit = { x: cx, y: drop(cx, m.y) }; break;
            default: {
                const k = enemyFor(def, m.ch);
                if (!k || m.ci === 0) break;
                if (rng() > def.density) break;
                const y = GROUNDED.has(k) ? drop(cx, m.y) : m.y + 0.2;
                spawns.push({ k, x: cx, y, on: false });
            }
        }
    }
    // pods: keep exactly def.pods of the marked spots, spread through the level
    for (let i = podMarks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [podMarks[i], podMarks[j]] = [podMarks[j], podMarks[i]]; }
    // not enough marked spots in the chunks drawn: use the middle of the chunks without one
    for (let ci = 1; ci < seq.length - 1 && podMarks.length < def.pods; ci++) {
        if (podMarks.some((m) => m.ci === ci)) continue;
        const x = chunkX[ci] + Math.floor(widths[ci] / 2) + 3;
        if (groundBelow(L, x, 12) > 0) podMarks.push({ ch: 'P', x, y: 12, ci });
    }
    for (const m of podMarks.slice(0, def.pods)) pods.push({ x: m.x + 0.5, y: drop(m.x + 0.5, m.y) });
    pods.sort((a, b) => a.x - b.x);
    // weapons: two capsules a sector, the first sector always has one
    for (let i = weaponMarks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [weaponMarks[i], weaponMarks[j]] = [weaponMarks[j], weaponMarks[i]]; }
    const kinds = ['spread', 'laser', 'rocket'];
    weaponMarks.slice(0, 2).forEach((m, i) => pickups.push({ k: kinds[(idx + i + Math.floor(rng() * 3)) % 3], x: m.x + 0.5, y: m.y + 1.4, float: true }));

    const checkpoints = [];
    for (let ci = 3; ci < seq.length - 1; ci += 3) checkpoints.push({ x: chunkX[ci] + 1.5, y: drop(chunkX[ci] + 1.5, 6) });
    const lastX = chunkX[seq.length - 1];
    let arena = null;
    if (def.end !== 'exit') {
        arena = { x0: lastX, x1: lastX + ARENA_W, boss: def.end };
        checkpoints.push({ x: lastX - 2.5, y: drop(lastX - 2.5, 6) });
    }

    Object.assign(L, {
        seq, chunkX, spawns, pods, pickups, lamps, vents, exit, arena, checkpoints,
        start: { x: 3.5, y: 2 },
    });
    return L;
}
