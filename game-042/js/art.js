// ============================================================
// All the graphics, generated at boot. No image files.
//
// * Colours come from the NES 2C02 palette.
// * Characters and items are hand-drawn as strings, baked once into small
//   canvases (plus a mirrored copy and a white flash copy).
// * Tiles are generated per theme: dithered dirt, grass tufts, brick
//   courses, crystal tops, cloud puffs, castle stone — each ground tile in
//   16 variants for which sides are exposed.
// * Parallax backdrops are drawn procedurally into wide strips.
// ============================================================

import { RNG } from './rng.js';
import { T } from './tiles.js';

// FCEUX-style NES palette
export const NES = [
    '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400',
    '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#000000', '#000000',
    '#BCBCBC', '#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10',
    '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888', '#000000', '#000000', '#000000',
    '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044',
    '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8', '#787878', '#000000', '#000000',
    '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8',
    '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8', '#000000', '#000000',
];
const INK = '#1a1026';      // outline: a soft near-black

const col = v => (typeof v === 'number' ? NES[v] : v);

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

function hexRGB(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bake a sprite from strings. map: char -> NES index or '#rrggbb'. '.' is transparent. */
function bake(rows, map) {
    const h = rows.length, w = rows[0].length;
    const c = canvas(w, h);
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const lut = {};
    for (const k in map) lut[k] = hexRGB(col(map[k]));
    lut.k = lut.k || hexRGB(INK);
    for (let y = 0; y < h; y++) {
        const row = rows[y];
        for (let i = 0; i < w; i++) {
            const ch = row[i];
            if (ch === '.' || ch === ' ' || ch === undefined) continue;
            const rgb = lut[ch];
            if (!rgb) continue;
            const o = (y * w + i) * 4;
            img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
    }
    x.putImageData(img, 0, 0);
    return c;
}

function flip(src) {
    const c = canvas(src.width, src.height);
    const x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
}

function silhouette(src, color) {
    const c = canvas(src.width, src.height);
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
}

function sprite(cv) {
    return { c: cv, f: null, w: cv.width, h: cv.height, _white: null,
        get flipped() { return this.f || (this.f = flip(this.c)); },
        get white() { return this._white || (this._white = silhouette(this.c, '#ffffff')); },
    };
}

// ------------------------------------------------------------ Pip
const PIP_MAP = { g: 0x2a, G: 0x1a, L: 0x38, o: 0x27, S: 0x17, W: 0x30, E: INK, P: 0x25, F: 0x07, M: 0x10, m: 0x2d, c: 0x36 };
const F = fill => '..k' + fill + 'k..';
const PIP_HEAD = [
    '......gg.gg.....',
    '........k.......',
    '.....kkkkkk.....',
    '...kkLLLoookk...',
    F('LLLooooooo'),
    F('LLoooWWoWW'),
    F('LooooWEoWE'),
    F('LooooWEoWE'),
    F('ooooPoooPo'),
    F('ooooookkoo'),
    F('SooooooooS'),
    F('SSooooooSS'),
    '...kkSSSSSSkk...',
    '.....kkkkkk.....',
];
const faceSwap = (rows, swaps) => rows.map((r, i) => (swaps[i] ? F(swaps[i]) : r));
const PIP_FACES = {
    idle: PIP_HEAD,
    blink: faceSwap(PIP_HEAD, { 5: 'LLoooooooo', 6: 'LooooEEoEE', 7: 'Looooooooo' }),
    hurt: faceSwap(PIP_HEAD, { 5: 'LLoooEooEo', 6: 'LooooEEoEE', 7: 'LoooEooEoo', 9: 'oooooEEooo' }),
    happy: faceSwap(PIP_HEAD, { 5: 'LLoooEEoEE', 6: 'LoooEooEoo', 7: 'Looooooooo' }),
    up: faceSwap(PIP_HEAD, { 5: 'LLoooWEoWE', 6: 'LooooWWoWW', 7: 'Looooooooo' }),
};
const PIP_FEET = {
    stand: ['....kFFk.kFFk...', '....kkkk.kkkk...'],
    runA: ['...kFFk....kFFk.', '...kkk......kkk.'],
    runB: ['.....kFFkkFFk...', '.....kkkkkkkk...'],
    jump: ['....kFk...kFk...', '.....k.....k....'],
    fall: ['...kFFk...kFFk..', '...kkkk...kkkk..'],
    wall: ['.......kFFk.kFk.', '.......kkkk.kk..'],
};
const GUN = {
    fwd: ['............kkk.', '...........kmMMk', '...........kkkk.'],          // rows 8..10
    up: ['..........kk....', '..........kMk...', '..........kMk...', '..........kmk...', '..........kkk...'],   // rows 0..4
    diag: ['.............kk.', '............kMk.', '...........kMk..', '..........kmk...', '..........kk....'],   // rows 3..7
};

function composePip(face, feet, gun, bob) {
    const c = canvas(16, 16);
    const x = c.getContext('2d');
    const head = bake(PIP_FACES[face], PIP_MAP);
    const f = bake(PIP_FEET[feet], PIP_MAP);
    x.drawImage(f, 0, 14);
    x.drawImage(head, 0, bob);
    if (gun) {
        const g = bake(GUN[gun], PIP_MAP);
        const gy = gun === 'fwd' ? 8 : gun === 'up' ? 0 : 3;
        x.drawImage(g, 0, gy + bob);
    }
    return c;
}

// ------------------------------------------------------------ enemies (drawn facing right / front)
const E = {
    bug: {
        map: { B: 0x04, b: 0x14, W: 0x30, E: INK, C: 0x36, F: 0x07 },
        frames: [[
            '................', '................',
            '......kkkk......',
            '....kkbbBBkk....',
            '...kbbbBBBBBk...',
            '..kbbBBBBBBBBk..',
            '..kBBBBBBBBBBk..',
            '.kBkkkBBBBkkkBk.',
            '.kBBWkkBBkkWBBk.',
            '.kBBWEWBBWEWBBk.',
            '.kkBWEWBBWEWBkk.',
            '..kkCCCCCCCCkk..',
            '...kCCCkkCCCk...',
            '....kkCCCCkk....',
            '...kFFkkkkFFk...',
            '...kkkk..kkkk...',
        ]],
    },
    snail: {
        map: { S: 0x16, s: 0x27, G: 0x2a, g: 0x39, W: 0x30, E: INK },
        frames: [[
            '................', '................', '................',
            '.k.k............',
            '.kWkk...kkkkk...',
            '.kEWk.kkSSSSSkk.',
            '..kk.kSsssssSSk.',
            '..kk.kSsSSSsSSSk',
            '.kGGkSsSsssSsSSk',
            'kGgGkSsSsSsSsSSk',
            'kGGGkSsSSsSSsSSk',
            'kGGGGkSsssssSSk.',
            'kGGGGGkSSSSSSkk.',
            '.kGGGGGkkkkkkGk.',
            '..kGGGGGGGGGGGGk',
            '...kkkkkkkkkkkk.',
        ]],
    },
    shell: {
        map: { S: 0x16, s: 0x27 },
        frames: [[
            '................', '................', '................', '................',
            '.....kkkkkk.....',
            '...kkSSSSSSkk...',
            '..kSSsssssSSSk..',
            '..kSsSSSSSsSSk..',
            '.kSsSsssssSsSSk.',
            '.kSsSsSSSsSsSSk.',
            '.kSsSsSsSsSsSSk.',
            '.kSsSSsSSsSSSSk.',
            '..kSSsssssSSSk..',
            '..kkSSSSSSSSkk..',
            '....kkkkkkkk....',
            '................',
        ]],
    },
    frog: {
        map: { G: 0x1a, g: 0x2a, l: 0x3a, W: 0x30, E: INK, R: 0x15 },
        frames: [[
            '................', '................', '................', '................',
            '..kkk......kkk..',
            '.kWWWk....kWWWk.',
            '.kWEWkkkkkkWEWk.',
            '.kgggGGGGGGgggk.',
            'kgggGGGGGGGGgggk',
            'kggGGGGGGGGGGggk',
            'kGkRRRRRRRRRRkGk',
            'kGGkkkkkkkkkkGGk',
            '.kGllllllllllGk.',
            '.kGGllllllllGGk.',
            'kgggkkkkkkkkgggk',
            'kkkk........kkkk',
        ], [
            '................',
            '..kkk......kkk..',
            '.kWWWk....kWWWk.',
            '.kWEWkkkkkkWEWk.',
            '.kgggGGGGGGgggk.',
            'kgggGGGGGGGGgggk',
            'kggGGGGGGGGGGggk',
            'kGkRRRRRRRRRRkGk',
            'kGGkkkkkkkkkkGGk',
            '.kGllllllllllGk.',
            '.kGGllllllllGGk.',
            '..kkkkkkkkkkkk..',
            '..kgk......kgk..',
            '.kggk......kggk.',
            '.kgk........kgk.',
            '.kk..........kk.',
        ]],
    },
    bee: {
        map: { Y: 0x28, y: 0x38, B: INK, W: 0x31, w: 0x30, E: INK },
        frames: [[
            '................',
            '.....kk..kk.....',
            '....kwwkkwwk....',
            '....kwWWkWWk....',
            '.....kkkkkk.....',
            '....kYYYYYYk....',
            '...kYyyBYYBYk...',
            '..kYyWEBYYBYYk..',
            '..kYYWEBYYBYYkk.',
            '..kYYYYBYYBYYkBk',
            '...kYYYBYYBYk.k.',
            '....kkkkkkkk....',
            '................', '................', '................', '................',
        ], [
            '................', '................',
            '....kkkkkkkk....',
            '...kwWWkkWWwk...',
            '....kkkkkkkk....',
            '....kYYYYYYk....',
            '...kYyyBYYBYk...',
            '..kYyWEBYYBYYk..',
            '..kYYWEBYYBYYkk.',
            '..kYYYYBYYBYYkBk',
            '...kYYYBYYBYk.k.',
            '....kkkkkkkk....',
            '................', '................', '................', '................',
        ]],
    },
    prickle: {
        map: { R: 0x16, r: 0x27, S: 0x30, W: 0x30, E: INK },
        frames: [[
            '................',
            '...k...k...k....',
            '...Sk.kSk.kSk...',
            '..kkRkRRRkRkk...',
            '.SkRRRRRRRRRkS..',
            '..kRrrRRRRRRRk..',
            'SkRrrRRRRRRRRRkS',
            '.kRRRkkRRRkkRRk.',
            '.kRRWWEkRkWWERk.',
            'SkRRWWEkRkWWERkS',
            '.kRRRRRRRRRRRRk.',
            '..kRRRkkkkRRRk..',
            '.SkRRRRRRRRRRkS.',
            '...kkRkkkkRkk...',
            '...Sk.k..k.kS...',
            '..k..........k..',
        ]],
    },
    shroom: {
        map: { R: 0x16, r: 0x26, W: 0x30, C: 0x36, E: INK },
        frames: [[
            '................', '................',
            '.....kkkkkk.....',
            '...kkRRWWRRkk...',
            '..kRRRWWWWRRRk..',
            '.kRWWRRRRRRWWRk.',
            '.kRWWRRRRRRWWRk.',
            'kRRRRRRWWRRRRRRk',
            'kkkkkkkkkkkkkkkk',
            '...kCCCCCCCCk...',
            '...kCWEkkWECk...',
            '...kCWEkkWECk...',
            '...kCCCCCCCCk...',
            '...kCCkkkkCCk...',
            '....kCCCCCCk....',
            '.....kkkkkk.....',
        ]],
    },
    cactus: {
        map: { G: 0x1a, g: 0x2a, W: 0x30, E: INK, P: 0x25, F: 0x34 },
        frames: [[
            '......kFFk......',
            '.....kgGGgk.....',
            '....kgGGGGGk....',
            '.k..kgWEGWEk..k.',
            'kgk.kgWEGWEk.kgk',
            'kgk.kgGGGGGk.kgk',
            'kgGkkgGkkGGkkGgk',
            '.kgGGGGGGGGGGgk.',
            '..kkkgGGGGGkkk..',
            '....kgGGGGGk....',
            '....kgGGGGGk....',
            '....kgGgGGGk....',
            '....kgGGGgGk....',
            '....kgGGGGGk....',
            '...kkkkkkkkkk...',
            '...kPPPPPPPPk...',
        ]],
    },
    chomper: {
        map: { R: 0x16, r: 0x26, W: 0x30, G: 0x1a, g: 0x2a, E: INK },
        frames: [[
            '....kkkkkkk.....',
            '..kkRRWRRRRkk...',
            '.kRRRRRRRWRRRk..',
            'kRWRRRRRRRRRRRk.',
            'kRRRkkkkkkkRRRk.',
            'kRRkWkWkWkWkRRk.',
            'kRk.........kRk.',
            'kRk.........kRk.',
            'kRRkWkWkWkWkRRk.',
            '.kRRkkkkkkkRRk..',
            '..kkRRRRRRRkk...',
            '....kkkgkkk.....',
            '.kkk..kgk..kkk..',
            'kgggk.kgk.kgggk.',
            '.kgggkkgkkgggk..',
            '..kkkkkgkkkkk...',
        ], [
            '....kkkkkkk.....',
            '..kkRRWRRRRkk...',
            '.kRRRRRRRWRRRk..',
            'kRWRRRRRRRRRRRk.',
            'kRRRRRRRRRRRRRk.',
            'kRRkkkkkkkkkRRk.',
            'kRkWkWkWkWkWkRk.',
            'kRkkkkkkkkkkkRk.',
            'kRRRRRRRRRRRRRk.',
            '.kRRRRRRRRRRRk..',
            '..kkRRRRRRRkk...',
            '....kkkgkkk.....',
            '.kkk..kgk..kkk..',
            'kgggk.kgk.kgggk.',
            '.kgggkkgkkgggk..',
            '..kkkkkgkkkkk...',
        ]],
    },
    bat: {
        map: { P: 0x03, p: 0x13, W: 0x30, E: 0x16 },
        frames: [[
            '................', '................', '................',
            'kk....kkkk....kk',
            'kPk..kPPPPk..kPk',
            'kPPkkPkPPkPkkPPk',
            'kPpPPPEPPEPPPpPk',
            'kPppPPPPPPPPppPk',
            '.kPpkPWkkWPkpPk.',
            '..kk.kPPPPk.kk..',
            '......kkkk......',
            '................', '................', '................', '................', '................',
        ], [
            '................', '................', '................',
            '......kkkk......',
            '.....kPPPPk.....',
            '....kPkPPkPk....',
            '..kkPPEPPEPPkk..',
            '.kPpPPPPPPPPpPk.',
            'kPppkPWkkWPkppPk',
            'kPpk.kPPPPk.kpPk',
            'kPk...kkkk...kPk',
            'kk............kk',
            '................', '................', '................', '................',
        ]],
    },
    glint: {
        map: { C: 0x2c, c: 0x3c, D: 0x1c, W: 0x30, E: INK },
        frames: [[
            '................', '................', '................',
            '.......kk.......',
            '......kcWk......',
            '.....kcWCCk.....',
            '....kcCCCCCk....',
            '...kcCCCCCCCk...',
            '..kcCWEkCWEkCk..',
            '..kCCWEkCWEkCk..',
            '.kcCCCCCCCCCCDk.',
            '.kCCCCkkkkCCCDk.',
            '.kCCCCCCCCCCDDk.',
            'kCCCCCCCCCCCDDDk',
            'kDDDDDDDDDDDDDDk',
            '.kkkkkkkkkkkkkk.',
        ]],
    },
    drizzle: {
        map: { W: 0x30, w: 0x10, G: 0x2d, E: INK, B: 0x21 },
        frames: [[
            '................',
            '.....kkkk.......',
            '....kWWWWk.kk...',
            '..kkWWWWWWkWWk..',
            '.kWWWWWWWWWWWWk.',
            'kWWWkkWWWWkkWWWk',
            'kWWWEkWWWWEkWWWk',
            'kWWwWWWWWWWWwWWk',
            'kWWWWWkkkkWWWWwk',
            '.kwwWWWWWWWWwwk.',
            '..kkkwwwwwwkkk..',
            '.....kkkkkk.....',
            '....B...B...B...',
            '.....B...B......',
            '................', '................',
        ]],
    },
    lavabub: {
        map: { R: 0x16, O: 0x27, Y: 0x38, W: 0x30, E: INK },
        frames: [[
            '....k..k..k.....',
            '...kRk.kRkRk....',
            '..kRORkROkROk...',
            '..kROOROOOOROk..',
            '.kROOOYOOOYOORk.',
            '.kROOWEOOOWEORk.',
            '.kROOWEOOOWEORk.',
            '.kROOOOYYYOOORk.',
            '.kROOOYOOOYOORk.',
            '..kROOOOOOOORk..',
            '...kRROOOORRk...',
            '....kkkkkkkk....',
            '................', '................', '................', '................',
        ]],
    },
};

// ------------------------------------------------------------ items & icons (16x16 unless noted)
const ITEMS = {
    coin0: { map: { Y: 0x28, y: 0x38, O: 0x17 }, rows: ['................', '.....kkkkk......', '....kyyYYYk.....', '...kyYYOYYOk....', '...kyYYOYYOk....', '...kyYYOYYOk....', '...kyYYOYYOk....', '...kyYYOYYOk....', '...kyYYYYYOk....', '....kYYOOOk.....', '.....kkkkk......', '................', '................', '................', '................', '................'] },
    coin1: { map: { Y: 0x28, y: 0x38, O: 0x17 }, rows: ['................', '......kkk.......', '.....kyYYk......', '.....kyOYk......', '.....kyOYk......', '.....kyOYk......', '.....kyOYk......', '.....kyOYk......', '.....kyYYk......', '.....kYOOk......', '......kkk.......', '................', '................', '................', '................', '................'] },
    coin2: { map: { Y: 0x28, O: 0x17 }, rows: ['................', '.......k........', '......kYk.......', '......kYk.......', '......kYk.......', '......kYk.......', '......kYk.......', '......kYk.......', '......kYk.......', '......kOk.......', '.......k........', '................', '................', '................', '................', '................'] },
    berry: { map: { R: 0x16, r: 0x26, W: 0x30, G: 0x1a, g: 0x2a }, rows: ['................', '......kk.kk.....', '.....kgGkgGk....', '......kkGkk.....', '....kkkkkkkk....', '...kRrRRRRRRk...', '..kRWrRRRRRRRk..', '..kRWRRRRRRRRk..', '..kRRRRRRRRRRk..', '..kRRRRRRRRRRk..', '...kRRRRRRRRk...', '....kRRRRRRk....', '.....kRRRRk.....', '......kkkk......', '................', '................'] },
    star: { map: { Y: 0x28, y: 0x38, W: 0x30, E: INK }, rows: ['.......kk.......', '......kyYk......', '......kyYk......', '.....kyYYYk.....', 'kkkkkkyYYYkkkkkk', 'kyyyyyYYYYYYYYYk', '.kYYYYWEYWEYYYk.', '..kYYYWEYWEYYk..', '...kYYYYYYYYk...', '...kYYYYYYYYk...', '..kYYYYkkYYYYk..', '..kYYYk..kYYYk..', '.kYYk......kYYk.', '.kkk........kkk.', '................', '................'] },
    pepper: { map: { R: 0x16, r: 0x26, G: 0x1a, g: 0x2a }, rows: ['................', '..........kk....', '.........kgk....', '........kGk.....', '......kkGGkk....', '.....kRRkkRRk...', '....kRrRRRRRk...', '...kRrRRRRRRk...', '...kRrRRRRRk....', '..kRrRRRRRRk....', '..kRRRRRRRk.....', '.kRRRRRRRk......', '.kRRRRRkk.......', '..kkkkk.........', '................', '................'] },
    shield: { map: { B: 0x31, b: 0x21, W: 0x30 }, rows: ['................', '.....kkkkkk.....', '...kkbbbbbbkk...', '..kbWWbbbbbbbk..', '..kbWbbbbbbbbk..', '.kbWbbbbbbbbbbk.', '.kbbbbbbbbbbbbk.', '.kbbbbbbbbbbbbk.', '.kbbbbbbbbbbbbk.', '.kbbbbbbbbbbWbk.', '..kbbbbbbbbWbk..', '..kbbbbbbbWWbk..', '...kkbbbbbbkk...', '.....kkkkkk.....', '................', '................'] },
    shard: { map: { Y: 0x28, y: 0x38, W: 0x30, O: 0x27 }, rows: ['.......k........', '......kWk.......', '.....kWyYk......', '....kWyYYOk.....', '...kWyYYYYOk....', '..kWyYYYYYYOk...', '.kWyYYYYYYYYOk..', 'kWyYYYYYYYYYYOk.', '.kyYYYYYYYYYOk..', '..kYYYYYYYYOk...', '...kYYYYYYOk....', '....kYYYYOk.....', '.....kYYOk......', '......kOk.......', '.......k........', '................'] },
    heart: { map: { R: 0x16, r: 0x26, W: 0x30 }, rows: ['................', '..kkkk....kkkk..', '.kRRRRk..kRRRRk.', 'kRWWRRRkkRRRRRRk', 'kRWRRRRRRRRRRRRk', 'kRRRRRRRRRRRRRRk', 'kRRRRRRRRRRRRRRk', '.kRRRRRRRRRRRRk.', '..kRRRRRRRRRRk..', '...kRRRRRRRRk...', '....kRRRRRRk....', '.....kRRRRk.....', '......kRRk......', '.......kk.......', '................', '................'] },
    chip: { map: { G: 0x1a, g: 0x2a, Y: 0x28, M: 0x10 }, rows: ['................', '...k.k.k.k.k....', '..kMkMkMkMkMk...', '.kkkkkkkkkkkkk..', 'kMkGGGGGGGGGkMk.', '.kkGgggggggGkk..', 'kMkGgYYYYYgGkMk.', '.kkGgYkkkYgGkk..', 'kMkGgYkkkYgGkMk.', '.kkGgYYYYYgGkk..', 'kMkGgggggggGkMk.', '.kkGGGGGGGGGkk..', '..kkkkkkkkkkkk..', '..kMkMkMkMkMk...', '...k.k.k.k.k....', '................'] },
    boots: { map: { R: 0x16, r: 0x26, W: 0x30, S: 0x10, s: 0x2d }, rows: ['................', '....kkkkk.......', '...kRrrRRk......', '...kRRRRRk......', '...kRRRRRk......', '...kRRRRRRkkk...', '..kRRRRRRRRRRk..', '..kRRRRRRRRRRRk.', '..kWWWWWWWWWWWk.', '...kkkkkkkkkkk..', '....ksk..ksk....', '.....sk..ks.....', '....ksk..ksk....', '.....sk..ks.....', '....kkkk.kkkk...', '................'] },
    frost: { map: { C: 0x2c, c: 0x3c, W: 0x30, B: 0x11 }, rows: ['................', '.......kk.......', '...k..kWck..k...', '..kWk.kcCk.kWk..', '...kckkcCkkck...', '....kcccCCCk....', '.kkkkcWWCCkkkkk.', 'kWcccCWCCCCcccWk', '.kkkkcCCCCkkkkk.', '....kcCCCCCk....', '...kckkcCkkck...', '..kWk.kcCk.kWk..', '...k..kcck..k...', '.......kk.......', '................', '................'] },
    mitts: { map: { P: 0x14, p: 0x24, W: 0x30 }, rows: ['................', '...k.k.k........', '..kpkpkpk.......', '..kpkpkpkk......', '..kpkpkpkpk.....', '..kpppppkpk.....', '..kpppppppk.kk..', '..kpppppppkkpk..', '..kPppppppppk...', '..kPPpppppppk...', '..kPPPpppppk....', '...kPPPPppk.....', '...kWWWWWWk.....', '...kWWWWWWk.....', '...kkkkkkkk.....', '................'] },
    rocket: { map: { R: 0x16, W: 0x30, M: 0x10, m: 0x2d, Y: 0x28, O: 0x27 }, rows: ['................', '................', '...kk...........', '..kRRk..........', '..kRRRkkkkkkkk..', '.kYkRMMMMMMMWWk.', 'kOYkRMmmmmmMWWWk', 'kOYkRMMMMMMMWWk.', '.kYkRMMMMMMMWWk.', '..kRRRkkkkkkkk..', '..kRRk..........', '...kk...........', '................', '................', '................', '................'] },
    spread: { map: { Y: 0x28, O: 0x27, W: 0x30 }, rows: ['................', '...........kk...', '.........kkYWk..', '.......kkYYk....', '.....kkYYkk.....', '....kYYk........', '..kkYYYYYYYYYWk.', '.kWYYYYYYYYYYYk.', '..kkYYYYYYYYYWk.', '....kYYk........', '.....kkYYkk.....', '.......kkYYk....', '.........kkYWk..', '...........kk...', '................', '................'] },
    pea: { map: { G: 0x1a, g: 0x2a, W: 0x30 }, rows: ['................', '................', '................', '................', '.....kkkk.......', '....kgWggk......', '...kgWgggGk.....', '...kggggGGk.....', '...kgggGGGk.....', '...kgGGGGGk.....', '....kGGGGk......', '.....kkkk.......', '................', '................', '................', '................'] },
    sun: { map: { Y: 0x28, y: 0x38, O: 0x27, W: 0x30, E: INK, P: 0x25 }, rows: ['.......kk.......', '..k...kYYk...k..', '.kYk..kYYk..kYk.', '..kYkkkkkkkkYk..', '...kkyyyyYYkk...', '..kkyWyyYYYYkk..', 'kkkyWyYYYYYYYkkk', 'kYkyyEYYYEYYYkYk', 'kYkyYEYYYEYYYkYk', 'kkkYYPYYYYPYOkkk', '..kkYYYEEYYOkk..', '...kkYYYYYOkk...', '..kYkkkkkkkkYk..', '.kYk..kYYk..kYk.', '..k...kYYk...k..', '.......kk.......'] },
    flag: { map: { G: 0x2a, g: 0x1a, W: 0x30 }, rows: ['kkkkkkkkkkkkk...', 'kGGGGGGGGGGGGk..', 'kGGWWWGGGGGGGGk.', 'kGWGGGWGGGGGGGGk', 'kGWGWGWGGGGGGGGk', 'kGWGGGWGGGGGGGk.', 'kGGWWWGGGGGGGk..', 'kgggggggggggk...', 'kkkkkkkkkkkk....'] },
    cp_off: { map: { M: 0x2d, R: 0x16, r: 0x26, W: 0x30 }, rows: ['.kk.............', '.kMkkkkkkk......', '.kMkRRRRRRk.....', '.kMkRrRRRRRk....', '.kMkRRRRRRRRk...', '.kMkRRRRRRRk....', '.kMkRRRRRRk.....', '.kMkkkkkkk......', '.kMk............', '.kMk............', '.kMk............', '.kMk............', '.kMk............', '.kMk............', 'kkkkk...........', 'kMMMk...........'] },
    cp_on: { map: { M: 0x2d, G: 0x2a, g: 0x1a, W: 0x30, Y: 0x28 }, rows: ['.kk.............', '.kYkkkkkkk......', '.kMkGGGGGGk.....', '.kMkGWGGGGGk....', '.kMkGGGWGGGGk...', '.kMkGGGGGGGk....', '.kMkggggggk.....', '.kMkkkkkkk......', '.kMk............', '.kMk............', '.kMk............', '.kMk............', '.kMk............', '.kMk............', 'kkkkk...........', 'kMMMk...........'] },
};
const HEART_SMALL = { map: { R: 0x16, r: 0x26, W: 0x30 }, rows: ['.kk.kk.', 'kRWkRRk', 'kRRRRRk', 'kRRRRRk', '.kRRRk.', '..kRk..', '...k...'] };
const HEART_EMPTY = { map: { D: 0x2d, d: 0x00 }, rows: ['.kk.kk.', 'kddkddk', 'kdddddk', 'kdddddk', '.kdddk.', '..kdk..', '...k...'] };
const HEART_BLUE = { map: { R: 0x21, W: 0x30 }, rows: ['.kk.kk.', 'kRWkRRk', 'kRRRRRk', 'kRRRRRk', '.kRRRk.', '..kRk..', '...k...'] };
const COIN_SMALL = { map: { Y: 0x28, O: 0x17 }, rows: ['.kkk.', 'kYYOk', 'kYOYk', 'kYOYk', 'kYYOk', '.kkk.'] };
const SHARD_SMALL = { map: { Y: 0x28, W: 0x30, O: 0x27 }, rows: ['...k...', '..kWk..', '.kWYOk.', 'kWYYYOk', '.kYYOk.', '..kOk..', '...k...'] };
const SHARD_EMPTY = { map: { D: 0x2d }, rows: ['...k...', '..kDk..', '.kD.Dk.', 'kD...Dk', '.kD.Dk.', '..kDk..', '...k...'] };

// ------------------------------------------------------------ themes
export const THEMES = {
    meadow: {
        sky: [0x21, 0x31, 0x31], top: [0x0a, 0x1a, 0x2a, 0x39], dirt: [0x08, 0x07, 0x17, 0x27], brick: [0x07, 0x17, 0x27],
        hard: [0x08, 0x18, 0x28], pipe: [0x0a, 0x1a, 0x2a, 0x3a], plat: [0x16, 0x26, 0x30], accent: [0x17, 0x28, 0x38],
        far: 0x22, mid: [0x1a, 0x2a, 0x0a], near: [0x1a, 0x2a], cloud: [0x30, 0x31],
    },
    dunes: {
        sky: [0x27, 0x37, 0x38], top: [0x18, 0x28, 0x38, 0x37], dirt: [0x07, 0x17, 0x27, 0x37], brick: [0x08, 0x18, 0x28],
        hard: [0x07, 0x17, 0x27], pipe: [0x0c, 0x1c, 0x2c, 0x3c], plat: [0x18, 0x28, 0x38], accent: [0x16, 0x26, 0x36],
        far: 0x26, mid: [0x27, 0x37, 0x17], near: [0x0b, 0x1b], cloud: [0x36, 0x37],
    },
    grotto: {
        sky: [0x0f, 0x0c, 0x0f], top: [0x03, 0x13, 0x2c, 0x3c], dirt: [0x0f, 0x03, 0x13, 0x00], brick: [0x03, 0x13, 0x23],
        hard: [0x0c, 0x1c, 0x2c], pipe: [0x04, 0x14, 0x24, 0x34], plat: [0x0c, 0x2c, 0x3c], accent: [0x13, 0x24, 0x34],
        far: 0x02, mid: [0x0c, 0x1c, 0x0f], near: [0x0f, 0x0c], cloud: [0x13, 0x23],
    },
    skies: {
        sky: [0x13, 0x23, 0x25], top: [0x31, 0x30, 0x30, 0x30], dirt: [0x21, 0x31, 0x30, 0x30], brick: [0x04, 0x14, 0x24],
        hard: [0x12, 0x22, 0x32], pipe: [0x14, 0x24, 0x34, 0x30], plat: [0x31, 0x30, 0x30], accent: [0x15, 0x25, 0x35],
        far: 0x33, mid: [0x34, 0x35, 0x24], near: [0x30, 0x3d], cloud: [0x30, 0x3d],
    },
    keep: {
        sky: [0x0f, 0x07, 0x06], top: [0x06, 0x16, 0x26, 0x36], dirt: [0x0f, 0x06, 0x16, 0x07], brick: [0x06, 0x16, 0x26],
        hard: [0x07, 0x17, 0x27], pipe: [0x00, 0x10, 0x20, 0x30], plat: [0x00, 0x10, 0x20], accent: [0x16, 0x27, 0x38],
        far: 0x07, mid: [0x06, 0x16, 0x0f], near: [0x0f, 0x06], cloud: [0x16, 0x26],
    },
    castle: {
        sky: [0x0f, 0x0f, 0x00], top: [0x00, 0x10, 0x20, 0x30], dirt: [0x0f, 0x00, 0x10, 0x2d], brick: [0x00, 0x10, 0x20],
        hard: [0x2d, 0x00, 0x10], pipe: [0x0a, 0x1a, 0x2a, 0x3a], plat: [0x00, 0x10, 0x20], accent: [0x16, 0x27, 0x38],
        far: 0x2d, mid: [0x00, 0x2d, 0x0f], near: [0x0f, 0x00], cloud: [0x2d, 0x00],
    },
};

// ------------------------------------------------------------ tile painting
function px(x, c, X, Y, w = 1, h = 1) { x.fillStyle = c; x.fillRect(X, Y, w, h); }

function paintGround(x, ox, oy, th, mask, rng, name) {
    const D = th.dirt.map(col), Tp = th.top.map(col);
    // body
    px(x, D[1], ox, oy, 16, 16);
    for (let i = 0; i < 22; i++) {
        const X = rng.int(0, 15), Y = rng.int(0, 15);
        px(x, rng.chance(0.5) ? D[2] : D[0], ox + X, oy + Y);
    }
    if (name === 'keep' || name === 'castle') {
        // stone courses
        for (let y = 0; y < 16; y += 8) {
            px(x, D[0], ox, oy + y + 7, 16, 1);
            const off = (y / 8) % 2 ? 8 : 0;
            px(x, D[0], ox + off, oy + y, 1, 8);
            px(x, D[2], ox + off + 1, oy + y, 6, 1);
        }
    } else if (name === 'dunes') {
        for (let y = 3; y < 16; y += 5) for (let X = 0; X < 16; X++) if ((X + y) % 7 !== 0) px(x, D[2], ox + X, oy + y);
    } else if (name === 'skies') {
        px(x, D[2], ox, oy, 16, 16);
        for (let i = 0; i < 12; i++) px(x, D[1], ox + rng.int(0, 15), oy + rng.int(4, 15));
    } else if (name === 'grotto') {
        for (let i = 0; i < 3; i++) { const X = rng.int(1, 13), Y = rng.int(3, 13); px(x, D[2], ox + X, oy + Y, 2, 1); px(x, D[0], ox + X, oy + Y + 1, 2, 1); }
    } else {
        for (let i = 0; i < 3; i++) { const X = rng.int(1, 13), Y = rng.int(5, 13); px(x, D[3], ox + X, oy + Y, 2, 1); px(x, D[0], ox + X, oy + Y + 1, 2, 1); }
    }
    // exposed sides
    if (mask & 8) { px(x, D[0], ox, oy, 1, 16); }
    if (mask & 2) { px(x, D[0], ox + 15, oy, 1, 16); }
    if (mask & 4) { px(x, D[0], ox, oy + 15, 16, 1); px(x, INK, ox, oy + 15, 16, 1); }
    if (mask & 1) {
        if (name === 'meadow') {
            px(x, Tp[1], ox, oy, 16, 4);
            px(x, Tp[2], ox, oy, 16, 1);
            for (let X = 0; X < 16; X++) {
                const d = (X * 7 + 3) % 5 === 0 ? 2 : (X % 3 === 0 ? 1 : 0);
                px(x, Tp[1], ox + X, oy + 4, 1, d);
                if (d) px(x, Tp[0], ox + X, oy + 4 + d, 1, 1); else px(x, Tp[0], ox + X, oy + 4, 1, 1);
            }
            for (let i = 0; i < 4; i++) px(x, Tp[3], ox + rng.int(0, 15), oy + rng.int(1, 2));
        } else if (name === 'dunes') {
            px(x, Tp[2], ox, oy, 16, 3);
            px(x, Tp[3], ox, oy, 16, 1);
            for (let X = 0; X < 16; X++) px(x, Tp[1], ox + X, oy + 3 + ((X >> 2) % 2), 1, 1);
        } else if (name === 'grotto') {
            px(x, Tp[1], ox, oy, 16, 2);
            for (let X = 0; X < 16; X += 4) {
                const h = rng.int(1, 3);
                px(x, Tp[2], ox + X + 1, oy - 0, 2, h);
                px(x, Tp[3], ox + X + 1, oy, 1, 1);
            }
            px(x, Tp[0], ox, oy + 2, 16, 1);
        } else if (name === 'skies') {
            px(x, Tp[1], ox, oy, 16, 5);
            for (let X = 0; X < 16; X++) {
                const bump = Math.round(1.5 + 1.5 * Math.sin((X + 2) * 0.8));
                x.clearRect(ox + X, oy, 1, bump);
                px(x, Tp[0], ox + X, oy + bump, 1, 1);
            }
            px(x, col(th.dirt[1]), ox, oy + 6, 16, 1);
        } else {
            px(x, Tp[2], ox, oy, 16, 3);
            px(x, Tp[3], ox, oy, 16, 1);
            px(x, Tp[0], ox, oy + 3, 16, 1);
            for (let X = 3; X < 16; X += 8) px(x, Tp[0], ox + X, oy, 1, 3);
        }
        if (mask & 8) px(x, INK, ox, oy, 1, 4);
        if (mask & 2) px(x, INK, ox + 15, oy, 1, 4);
    }
}

function bevel(x, ox, oy, c3, outline = true) {
    const [d, m, l] = c3.map(col);
    px(x, m, ox, oy, 16, 16);
    px(x, l, ox, oy, 16, 2); px(x, l, ox, oy, 2, 16);
    px(x, d, ox, oy + 14, 16, 2); px(x, d, ox + 14, oy, 2, 16);
    if (outline) { x.strokeStyle = INK; x.lineWidth = 1; x.strokeRect(ox + 0.5, oy + 0.5, 15, 15); }
}

function paintBrick(x, ox, oy, th) {
    const [d, m, l] = th.brick.map(col);
    px(x, m, ox, oy, 16, 16);
    for (let r = 0; r < 4; r++) {
        const y = oy + r * 4;
        px(x, d, ox, y + 3, 16, 1);
        px(x, l, ox, y, 16, 1);
        const off = r % 2 ? 4 : 0;
        for (let X = off; X < 16; X += 8) px(x, d, ox + X, y, 1, 3);
    }
    px(x, INK, ox, oy + 15, 16, 1);
}

function paintQ(x, ox, oy, th, frame) {
    const [d, m, l] = th.accent.map(col);
    bevel(x, ox, oy, th.accent);
    // rivets
    for (const [X, Y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) px(x, d, ox + X, oy + Y, 2, 2);
    const shine = [col(0x30), l, m, l][frame];
    const Q = ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'];
    for (let r = 0; r < Q.length; r++) for (let c = 0; c < 6; c++) if (Q[r][c] === '#') { px(x, INK, ox + 5 + c + 1, oy + 4 + r + 1); px(x, shine, ox + 5 + c, oy + 4 + r); }
}

function paintUsed(x, ox, oy, th) {
    bevel(x, ox, oy, [0x08, 0x07, 0x17]);
    for (const [X, Y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) px(x, col(0x08), ox + X, oy + Y, 2, 2);
}

function paintPipe(x, ox, oy, th, part) {
    const [d, m, l, h] = th.pipe.map(col);
    if (part === 'TL' || part === 'TR') {
        const left = part === 'TL';
        px(x, INK, ox, oy, 16, 16);
        px(x, m, ox + (left ? 1 : 0), oy + 1, left ? 15 : 15, 14);
        if (left) { px(x, h, ox + 3, oy + 1, 2, 14); px(x, l, ox + 6, oy + 1, 3, 14); }
        else { px(x, d, ox + 9, oy + 1, 5, 14); }
    } else {
        const left = part === 'L';
        const x0 = left ? 2 : 0, w = 14;
        px(x, INK, ox + x0, oy, w, 16);
        px(x, m, ox + x0 + (left ? 1 : 0), oy, w - 1, 16);
        if (left) { px(x, h, ox + 5, oy, 2, 16); px(x, l, ox + 8, oy, 3, 16); }
        else px(x, d, ox + 6, oy, 6, 16);
    }
}

function paintOneway(x, ox, oy, th, name) {
    const [d, m, l] = th.plat.map(col);
    if (name === 'skies') {
        for (let X = 0; X < 16; X++) {
            const top = Math.round(1 + 1.5 * (1 + Math.sin(X * 0.7)));
            px(x, l, ox + X, oy + top, 1, 7 - top);
            px(x, INK, ox + X, oy + top - 1, 1, 1);
            px(x, m, ox + X, oy + 7, 1, 1);
        }
        px(x, INK, ox, oy + 8, 16, 1);
        return;
    }
    if (name === 'meadow') {
        // a mushroom-cap ledge
        px(x, INK, ox, oy, 16, 7);
        px(x, m, ox, oy + 1, 16, 5);
        px(x, l, ox, oy + 1, 16, 1);
        for (let X = 2; X < 16; X += 6) px(x, col(0x30), ox + X, oy + 2, 2, 2);
        px(x, d, ox, oy + 5, 16, 1);
        return;
    }
    px(x, INK, ox, oy, 16, 6);
    px(x, m, ox, oy + 1, 16, 4);
    px(x, l, ox, oy + 1, 16, 1);
    px(x, d, ox, oy + 4, 16, 1);
    px(x, INK, ox + 7, oy + 6, 2, 3);
    if (name === 'grotto') for (let X = 1; X < 16; X += 5) px(x, col(0x3c), ox + X, oy + 1, 2, 1);
}

function paintSpike(x, ox, oy) {
    for (let s = 0; s < 4; s++) {
        const X = ox + s * 4;
        for (let r = 0; r < 8; r++) {
            const half = Math.floor(r / 4);
            px(x, INK, X + 1 - half, oy + 8 + r, 2 + half * 2, 1);
            px(x, col(r < 3 ? 0x30 : 0x10), X + 1 - half + (r > 0 ? 0 : 0), oy + 8 + r, Math.max(1, 1 + half), 1);
        }
        px(x, INK, X + 1, oy + 7, 2, 1);
    }
    px(x, col(0x2d), ox, oy + 15, 16, 1);
}

function paintLava(x, ox, oy, frame, fill) {
    px(x, col(0x16), ox, oy, 16, 16);
    for (let i = 0; i < 16; i++) {
        const h = Math.round(2 + 1.8 * Math.sin((i + frame * 4) * 0.55));
        if (!fill) { x.clearRect(ox + i, oy, 1, h); px(x, col(0x38), ox + i, oy + h, 1, 1); px(x, col(0x27), ox + i, oy + h + 1, 1, 2); }
    }
    for (let i = 0; i < 6; i++) px(x, col(0x27), ox + ((i * 5 + frame * 3) % 16), oy + 6 + ((i * 7) % 9), 2, 1);
}

function paintRed(x, ox, oy) {
    bevel(x, ox, oy, [0x05, 0x16, 0x26]);
    x.strokeStyle = col(0x07); x.lineWidth = 1;
    x.beginPath(); x.moveTo(ox + 3, oy + 3); x.lineTo(ox + 7, oy + 8); x.lineTo(ox + 5, oy + 13); x.moveTo(ox + 7, oy + 8); x.lineTo(ox + 12, oy + 10); x.stroke();
    px(x, col(0x36), ox + 10, oy + 3, 2, 2);
}

function paintBubble(x, ox, oy, frame) {
    const r = frame ? 6.5 : 6;
    x.fillStyle = 'rgba(164,228,252,0.28)';
    x.beginPath(); x.arc(ox + 8, oy + 8, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = col(0x31); x.lineWidth = 1;
    x.beginPath(); x.arc(ox + 8, oy + 8, r, 0, Math.PI * 2); x.stroke();
    px(x, col(0x30), ox + 5, oy + 4, 2, 1); px(x, col(0x30), ox + 4, oy + 5, 1, 2);
}

function paintIce(x, ox, oy) {
    bevel(x, ox, oy, [0x1c, 0x2c, 0x3c]);
    px(x, col(0x30), ox + 3, oy + 3, 5, 1); px(x, col(0x30), ox + 3, oy + 3, 1, 4);
    px(x, col(0x30), ox + 10, oy + 10, 2, 1);
}

function paintSpring(x, ox, oy, frame) {
    const top = frame ? 8 : 4;
    px(x, INK, ox + 1, oy + top, 14, 4);
    px(x, col(0x16), ox + 2, oy + top + 1, 12, 2);
    px(x, col(0x26), ox + 2, oy + top + 1, 12, 1);
    for (let y = oy + top + 4; y < oy + 14; y += 2) { px(x, INK, ox + 4, y, 8, 1); px(x, col(0x10), ox + 5, y + 1, 6, 1); }
    px(x, INK, ox + 1, oy + 14, 14, 2);
    px(x, col(0x2d), ox + 2, oy + 14, 12, 1);
}

function paintCoin(x, ox, oy, frame) {
    const w = [8, 6, 2, 6][frame];
    const X = ox + 8 - w / 2;
    px(x, INK, X - 1, oy + 2, w + 2, 12);
    px(x, col(0x28), X, oy + 3, w, 10);
    if (w > 2) { px(x, col(0x38), X, oy + 3, 1, 10); px(x, col(0x17), X + w - 1, oy + 3, 1, 10); px(x, col(0x17), X + w / 2 - 0.5, oy + 5, 1, 6); }
}

function paintDeco(x, ox, oy, name, i, rng) {
    const P = (c, X, Y, w = 1, h = 1) => px(x, col(c), ox + X, oy + Y, w, h);
    const K = (X, Y, w = 1, h = 1) => px(x, INK, ox + X, oy + Y, w, h);
    if (name === 'meadow' || name === 'skies') {
        if (i === 0) { // bush
            for (const [cx, cy, r] of [[5, 12, 4], [10, 11, 5], [13, 13, 3]]) { x.fillStyle = INK; x.beginPath(); x.arc(ox + cx, oy + cy, r + 1, 0, 7); x.fill(); }
            for (const [cx, cy, r] of [[5, 12, 4], [10, 11, 5], [13, 13, 3]]) { x.fillStyle = col(0x1a); x.beginPath(); x.arc(ox + cx, oy + cy, r, 0, 7); x.fill(); }
            P(0x2a, 8, 8, 3, 1); P(0x2a, 3, 10, 2, 1);
        } else if (i === 1 || i === 2) { // flower
            const pc = i === 1 ? (name === 'skies' ? 0x24 : 0x16) : 0x28;
            K(7, 9, 1, 7); P(0x1a, 7, 10, 1, 6); P(0x2a, 8, 12, 2, 1);
            K(5, 4, 5, 5); P(pc, 6, 5, 3, 3); P(0x38, 7, 6);
        } else { // tuft
            for (const X of [4, 6, 8, 10]) { P(0x1a, X, 11 + (X % 4 ? 1 : 0), 1, 5); P(0x2a, X, 11 + (X % 4 ? 1 : 0)); }
        }
    } else if (name === 'dunes') {
        if (i === 0) { K(6, 5, 4, 11); P(0x1a, 7, 6, 2, 10); P(0x2a, 7, 6, 1, 9); K(3, 8, 3, 1); K(3, 8, 1, 4); P(0x1a, 4, 9, 1, 2); K(10, 7, 3, 1); K(12, 7, 1, 4); P(0x1a, 11, 8, 1, 2); }
        else if (i === 1) { K(4, 11, 8, 5); P(0x30, 5, 12, 6, 3); K(6, 13); K(9, 13); }
        else if (i === 2) { for (const X of [5, 7, 9, 11]) { P(0x18, X, 10 + (X % 3), 1, 6 - (X % 3)); } }
        else { K(4, 11, 9, 5); P(0x17, 5, 12, 7, 4); P(0x27, 5, 12, 3, 1); }
    } else if (name === 'grotto') {
        if (i === 0) { for (const [X, h] of [[5, 8], [8, 11], [11, 6]]) { K(X - 1, 16 - h - 1, 3, h + 1); P(0x2c, X, 16 - h, 1, h); P(0x3c, X, 16 - h, 1, 2); } }
        else if (i === 1) { K(4, 7, 8, 4); P(0x24, 5, 8, 6, 2); P(0x34, 6, 8, 2, 1); K(7, 11, 2, 5); P(0x36, 7, 11, 1, 5); }
        else if (i === 2) { K(5, 6, 5, 10); P(0x13, 6, 7, 3, 9); P(0x23, 6, 7, 1, 7); }
        else { K(3, 12, 10, 4); P(0x03, 4, 13, 8, 3); P(0x13, 4, 13, 3, 1); }
    } else {
        if (i === 0) { K(4, 12, 8, 4); P(0x30, 5, 13, 3, 2); P(0x10, 8, 13, 3, 2); K(6, 14); }
        else if (i === 1) { for (let X = 2; X < 14; X += 3) { K(X, 14, 2, 2); P(0x2d, X, 14); } }
        else if (i === 2) { K(5, 10, 6, 6); P(0x10, 6, 11, 4, 5); P(0x20, 6, 11, 1, 3); }
        else { K(3, 13, 10, 3); P(0x00, 4, 14, 8, 2); }
    }
    void rng;
}

function paintWallDeco(x, ox, oy, name, i, frame) {
    const P = (c, X, Y, w = 1, h = 1) => px(x, col(c), ox + X, oy + Y, w, h);
    const K = (X, Y, w = 1, h = 1) => px(x, INK, ox + X, oy + Y, w, h);
    if (name === 'grotto') {
        if (i === 0) { K(5, 3, 6, 10); P(0x2c, 6, 4, 4, 8); P(0x3c, 6, 4, 1, 6); P(0x30, 7, 5); }
        else { K(4, 5, 8, 7); P(0x24, 5, 6, 6, 5); P(0x34, 5, 6, 2, 2); }
        return;
    }
    if (i === 0) { // torch
        K(7, 8, 2, 8); P(0x07, 7, 9, 2, 7); K(5, 7, 6, 2); P(0x2d, 6, 7, 4, 1);
        const fl = frame ? [[6, 2, 4, 5, 0x16], [7, 1, 2, 3, 0x27], [7, 3, 2, 2, 0x38]] : [[6, 3, 4, 4, 0x16], [7, 2, 2, 3, 0x27], [8, 4, 1, 2, 0x38]];
        for (const [X, Y, w, h, c] of fl) P(c, X, Y, w, h);
    } else { // banner
        K(3, 1, 10, 13); P(0x15, 4, 2, 8, 10); P(0x28, 6, 5, 4, 4); P(0x05, 4, 11, 8, 1); K(5, 14, 2, 2); K(9, 14, 2, 2);
    }
}

// ------------------------------------------------------------ backgrounds
function paintBackground(name, th) {
    const W = 512, H = 200;
    const rng = new RNG(name.length * 977 + 13);
    const far = canvas(W, H), mid = canvas(W, H), near = canvas(W, H);
    const f = far.getContext('2d'), m = mid.getContext('2d'), n = near.getContext('2d');
    const ridge = (ctx, base, amp, freqs, color, outline, seed) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(0, H);
        const ys = [];
        for (let X = 0; X <= W; X++) {
            let y = base;
            freqs.forEach(([k, a], i) => { y -= Math.sin((X / W) * Math.PI * 2 * k + seed * (i + 1)) * a * amp; });
            ys.push(Math.round(y));
            ctx.lineTo(X, Math.round(y));
        }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        if (outline) { ctx.fillStyle = outline; for (let X = 0; X < W; X++) ctx.fillRect(X, ys[X], 1, 1); }
        return ys;
    };
    if (name === 'meadow') {
        ridge(f, 120, 1, [[2, 18], [5, 6]], col(th.far), null, 1.3);
        const ys = ridge(m, 150, 1, [[3, 22], [7, 5]], col(th.mid[0]), INK, 0.4);
        for (let X = 6; X < W; X += 23) { const y = ys[X] + 10 + (X % 3) * 6; m.fillStyle = col(th.mid[2]); m.fillRect(X, y, 2, 4); m.fillRect(X - 1, y + 1, 4, 2); }
        for (let X = 0; X < W; X += 3) { m.fillStyle = col(th.mid[1]); m.fillRect(X, ys[X] + 1, 1, 1); }
        for (let i = 0; i < 9; i++) { const X = rng.int(0, W - 40); bushClump(n, X, 190, rng, col(th.near[0]), col(th.near[1])); }
    } else if (name === 'dunes') {
        // pyramids
        for (let i = 0; i < 3; i++) {
            const X = 60 + i * 170 + rng.int(-20, 20), s = rng.int(40, 70), base = 135;
            f.fillStyle = col(0x17); f.beginPath(); f.moveTo(X - s, base); f.lineTo(X, base - s * 0.9); f.lineTo(X + s, base); f.fill();
            f.fillStyle = col(0x27); f.beginPath(); f.moveTo(X - s, base); f.lineTo(X, base - s * 0.9); f.lineTo(X - s * 0.1, base); f.fill();
        }
        ridge(f, 140, 1, [[2, 6]], col(0x26), null, 2);
        ridge(m, 158, 1, [[2, 14], [5, 4]], col(th.mid[0]), col(th.mid[1]), 0.7);
        for (let i = 0; i < 7; i++) { const X = rng.int(0, W - 20); cactusSil(n, X, 196, rng.int(18, 30), col(th.near[0])); }
    } else if (name === 'grotto') {
        // stalactites from the top, distant glows
        for (let X = 0; X < W; X += rng.int(10, 24)) {
            const h = rng.int(20, 70);
            f.fillStyle = col(0x0c);
            f.beginPath(); f.moveTo(X, 0); f.lineTo(X + 6, h); f.lineTo(X + 12, 0); f.fill();
        }
        for (let i = 0; i < 18; i++) { const X = rng.int(0, W), Y = rng.int(40, 150); f.fillStyle = rng.chance(0.5) ? col(0x1c) : col(0x14); f.fillRect(X, Y, 1, 1); if (rng.chance(0.4)) { f.fillRect(X - 1, Y, 3, 1); f.fillRect(X, Y - 1, 1, 3); } }
        for (let X = 0; X < W; X += rng.int(30, 60)) { const w = rng.int(10, 22); m.fillStyle = col(th.mid[0]); m.fillRect(X, 60, w, H); m.fillStyle = col(th.mid[1]); m.fillRect(X + 2, 60, 2, H); }
        ridge(m, 165, 1, [[4, 10]], col(th.mid[0]), col(th.mid[1]), 1.1);
        for (let X = 0; X < W; X += rng.int(14, 30)) { const h = rng.int(12, 36); n.fillStyle = col(th.near[0]); n.beginPath(); n.moveTo(X, H); n.lineTo(X + 7, H - h); n.lineTo(X + 14, H); n.fill(); }
    } else if (name === 'skies') {
        for (let i = 0; i < 4; i++) {
            const X = rng.int(0, W - 60), Y = rng.int(60, 110), s = rng.int(20, 34);
            f.fillStyle = col(0x23); f.beginPath(); f.moveTo(X, Y); f.lineTo(X + s * 2, Y); f.lineTo(X + s, Y + s); f.fill();
            f.fillStyle = col(0x33); f.fillRect(X, Y - 3, s * 2, 3);
        }
        for (let i = 0; i < 10; i++) cloudPuff(m, rng.int(0, W - 60), rng.int(110, 170), rng.int(14, 26), col(th.mid[0]), col(th.mid[1]));
        m.fillStyle = col(th.mid[0]); m.fillRect(0, 175, W, H);
        for (let i = 0; i < 8; i++) cloudPuff(n, rng.int(0, W - 40), rng.int(150, 190), rng.int(10, 18), col(th.near[0]), col(th.near[1]));
    } else {
        // castle interior: brick wall with arched windows, then pillars
        f.fillStyle = col(th.far); f.fillRect(0, 0, W, H);
        f.fillStyle = col(0x0f);
        for (let y = 0; y < H; y += 8) { f.fillRect(0, y + 7, W, 1); for (let X = (y / 8) % 2 ? 8 : 0; X < W; X += 16) f.fillRect(X, y, 1, 7); }
        for (let X = 30; X < W; X += 96) {
            f.fillStyle = col(0x0f); f.fillRect(X, 40, 20, 40); f.beginPath(); f.arc(X + 10, 40, 10, Math.PI, 0); f.fill();
            f.fillStyle = col(name === 'keep' ? 0x16 : 0x02); f.fillRect(X + 3, 44, 14, 33);
            f.fillStyle = col(name === 'keep' ? 0x27 : 0x12); f.fillRect(X + 3, 44, 14, 3);
        }
        for (let X = 10; X < W; X += 64) {
            m.fillStyle = col(th.mid[2]); m.fillRect(X, 0, 18, H);
            m.fillStyle = col(th.mid[0]); m.fillRect(X + 2, 0, 14, H);
            m.fillStyle = col(th.mid[1]); m.fillRect(X + 3, 0, 3, H);
            if ((X / 64) % 2 === 0) { m.fillStyle = col(0x05); m.fillRect(X - 2, 60, 22, 34); m.fillStyle = col(0x28); m.fillRect(X + 6, 70, 6, 6); }
        }
        for (let X = 0; X < W; X += rng.int(40, 80)) { n.fillStyle = col(0x0f); for (let y = 0; y < 60; y += 6) { n.fillRect(X, y, 3, 4); n.fillRect(X - 1, y + 4, 5, 2); } }
    }
    return { far, mid, near, W, H };
}

function bushClump(ctx, X, base, rng, dark, light) {
    for (let i = 0; i < 4; i++) {
        const cx = X + i * 9 + rng.int(-2, 2), r = rng.int(7, 11);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, base - r + 3, r + 1, 0, 7); ctx.fill();
        ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx, base - r + 3, r, 0, 7); ctx.fill();
        ctx.fillStyle = light; ctx.fillRect(cx - 3, base - 2 * r + 5, 3, 1);
    }
    ctx.fillStyle = dark; ctx.fillRect(X - 6, base - 4, 44, 20);
}

function cactusSil(ctx, X, base, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(X, base - h, 5, h);
    ctx.fillRect(X - 5, base - h * 0.6, 5, 3); ctx.fillRect(X - 5, base - h * 0.85, 3, h * 0.25);
    ctx.fillRect(X + 5, base - h * 0.45, 5, 3); ctx.fillRect(X + 7, base - h * 0.75, 3, h * 0.3);
}

function cloudPuff(ctx, X, Y, r, c, shade) {
    const bumps = [[0, 0, r], [r * 0.9, -r * 0.4, r * 0.8], [r * 1.8, 0, r * 0.9], [r * 2.5, r * 0.2, r * 0.6]];
    ctx.fillStyle = shade;
    for (const [dx, dy, rr] of bumps) { ctx.beginPath(); ctx.arc(X + dx, Y + dy + 2, rr, 0, 7); ctx.fill(); }
    ctx.fillStyle = c;
    for (const [dx, dy, rr] of bumps) { ctx.beginPath(); ctx.arc(X + dx, Y + dy, rr, 0, 7); ctx.fill(); }
}

// ------------------------------------------------------------ public
export class Art {
    constructor() {
        this.spr = {};
        this.themes = {};
        this.buildPip();
        this.buildEnemies();
        this.buildItems();
        this.buildBosses();
    }

    buildPip() {
        const feetRun = ['runA', 'stand', 'runB', 'stand'];
        for (const gun of ['fwd', 'up', 'diag', null]) {
            const g = gun || 'none';
            this.spr[`pip_idle_${g}`] = sprite(composePip('idle', 'stand', gun, 0));
            this.spr[`pip_blink_${g}`] = sprite(composePip('blink', 'stand', gun, 0));
            feetRun.forEach((f, i) => { this.spr[`pip_run${i}_${g}`] = sprite(composePip('idle', f, gun, i % 2 ? 0 : -1)); });
            this.spr[`pip_jump_${g}`] = sprite(composePip(gun === 'up' || gun === 'diag' ? 'up' : 'idle', 'jump', gun, -1));
            this.spr[`pip_fall_${g}`] = sprite(composePip('idle', 'fall', gun, 0));
            this.spr[`pip_wall_${g}`] = sprite(composePip('happy', 'wall', gun, 0));
        }
        this.spr.pip_pound = sprite(composePip('happy', 'jump', null, 1));
        this.spr.pip_hurt = sprite(composePip('hurt', 'fall', null, 0));
        this.spr.pip_happy = sprite(composePip('happy', 'stand', null, 0));
        this.spr.pip_face = sprite(bake(PIP_HEAD.slice(2, 14).map(r => r.slice(2, 14)), PIP_MAP));
    }

    buildEnemies() {
        for (const k in E) {
            E[k].frames.forEach((rows, i) => { this.spr[`${k}${i}`] = sprite(bake(rows, E[k].map)); });
        }
        // crusher: a 24x24 stone face, drawn procedurally
        for (const angry of [0, 1]) {
            const c = canvas(24, 24), x = c.getContext('2d');
            x.fillStyle = INK; x.fillRect(0, 0, 24, 24);
            x.fillStyle = col(0x10); x.fillRect(1, 1, 22, 22);
            x.fillStyle = col(0x20); x.fillRect(1, 1, 22, 2); x.fillRect(1, 1, 2, 22);
            x.fillStyle = col(0x00); x.fillRect(1, 21, 22, 2); x.fillRect(21, 1, 2, 22);
            for (const X of [0, 22]) for (let Y = 3; Y < 22; Y += 5) { x.fillStyle = INK; x.fillRect(X, Y, 2, 2); }
            x.fillStyle = INK; x.fillRect(5, 7, 5, 4); x.fillRect(14, 7, 5, 4);
            x.fillStyle = col(angry ? 0x16 : 0x30); x.fillRect(6, 8, 3, 2); x.fillRect(15, 8, 3, 2);
            x.fillStyle = INK; x.fillRect(4, 5, 6, 1); x.fillRect(14, 5, 6, 1);
            if (angry) { x.fillRect(6, 4, 3, 1); x.fillRect(15, 4, 3, 1); }
            x.fillRect(6, 15, 12, 4);
            x.fillStyle = col(0x30); for (let X = 7; X < 18; X += 3) x.fillRect(X, 15, 2, 2);
            this.spr[`crusher${angry}`] = sprite(c);
        }
    }

    buildItems() {
        for (const k in ITEMS) this.spr[k] = sprite(bake(ITEMS[k].rows, ITEMS[k].map));
        this.spr.coin3 = this.spr.coin1;
        this.spr.plush = sprite(composePip('happy', 'stand', null, 0));
        this.spr.hs = sprite(bake(HEART_SMALL.rows, HEART_SMALL.map));
        this.spr.he = sprite(bake(HEART_EMPTY.rows, HEART_EMPTY.map));
        this.spr.hb = sprite(bake(HEART_BLUE.rows, HEART_BLUE.map));
        this.spr.cs = sprite(bake(COIN_SMALL.rows, COIN_SMALL.map));
        this.spr.ss = sprite(bake(SHARD_SMALL.rows, SHARD_SMALL.map));
        this.spr.se = sprite(bake(SHARD_EMPTY.rows, SHARD_EMPTY.map));
        // gadget icons reuse item art
        this.spr.i_boots = this.spr.boots; this.spr.i_frost = this.spr.frost; this.spr.i_mitts = this.spr.mitts;
        this.spr.i_rocket = this.spr.rocket; this.spr.i_spread = this.spr.spread; this.spr.i_pea = this.spr.pea;
        this.spr.i_heart = this.spr.heart; this.spr.i_chip = this.spr.chip; this.spr.i_sun = this.spr.sun;
        // castle (goal decoration), 48x48
        const c = canvas(48, 48), x = c.getContext('2d');
        const brick = (X, Y, w, h) => {
            x.fillStyle = INK; x.fillRect(X, Y, w, h);
            x.fillStyle = col(0x17); x.fillRect(X + 1, Y + 1, w - 2, h - 2);
            x.fillStyle = col(0x07);
            for (let yy = Y + 4; yy < Y + h; yy += 4) x.fillRect(X + 1, yy, w - 2, 1);
            for (let yy = Y + 1; yy < Y + h; yy += 4) for (let xx = X + ((yy >> 2) % 2 ? 2 : 6); xx < X + w - 1; xx += 8) x.fillRect(xx, yy, 1, 3);
        };
        brick(4, 20, 40, 28);
        brick(12, 4, 24, 17);
        for (let X = 4; X < 44; X += 8) { x.fillStyle = INK; x.fillRect(X, 16, 5, 5); x.fillStyle = col(0x17); x.fillRect(X + 1, 17, 3, 3); }
        for (let X = 12; X < 36; X += 8) { x.fillStyle = INK; x.fillRect(X, 0, 5, 5); x.fillStyle = col(0x17); x.fillRect(X + 1, 1, 3, 3); }
        x.fillStyle = INK; x.fillRect(18, 32, 12, 16); x.beginPath(); x.arc(24, 32, 6, Math.PI, 0); x.fill();
        x.fillRect(20, 8, 3, 6); x.fillRect(26, 8, 3, 6);
        this.spr.castle = sprite(c);
        // pole top ball
        this.spr.poleball = sprite(bake(['.kkk.', 'kGggk', 'kgggk', 'kgggk', '.kkk.'], { G: 0x3a, g: 0x2a }));
    }

    buildBosses() {
        // Chompo: the Grumblebug at 2x with a crown
        const big = (src, scale) => { const c = canvas(src.width * scale, src.height * scale), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height); return c; };
        const crown = (x, X, Y, w) => {
            x.fillStyle = INK; x.fillRect(X, Y + 2, w, 6);
            for (let i = 0; i <= w - 4; i += Math.floor((w - 4) / 3)) x.fillRect(X + i, Y - 2, 4, 5);
            x.fillStyle = col(0x28); x.fillRect(X + 1, Y + 3, w - 2, 4);
            for (let i = 0; i <= w - 4; i += Math.floor((w - 4) / 3)) x.fillRect(X + i + 1, Y - 1, 2, 4);
            x.fillStyle = col(0x16); x.fillRect(X + (w >> 1) - 1, Y + 4, 2, 2);
        };
        for (let f = 0; f < 2; f++) {
            const c = canvas(32, 32), x = c.getContext('2d');
            x.imageSmoothingEnabled = false;
            x.drawImage(big(this.spr.bug0.c, 2), 0, f ? 1 : 0);
            crown(x, 9, 2 + (f ? 1 : 0), 14);
            this.spr[`chompo${f}`] = sprite(c);
        }
        // Sandsnake: head 20x18 and segment 16x16
        {
            const c = canvas(20, 18), x = c.getContext('2d');
            const oval = (cx, cy, rx, ry, color) => { x.fillStyle = color; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); };
            oval(10, 9, 10, 9, INK); oval(10, 9, 9, 8, col(0x18)); oval(8, 7, 6, 5, col(0x28));
            x.fillStyle = INK; x.fillRect(12, 4, 5, 5); x.fillStyle = col(0x30); x.fillRect(13, 5, 3, 3); x.fillStyle = col(0x16); x.fillRect(14, 6, 2, 2);
            x.fillStyle = INK; x.fillRect(10, 12, 10, 2); x.fillStyle = col(0x30); x.fillRect(12, 14, 2, 2); x.fillRect(16, 14, 2, 2);
            x.fillStyle = col(0x16); x.fillRect(2, 1, 3, 3); x.fillRect(6, 0, 3, 3);
            this.spr.snakehead = sprite(c);
            const s = canvas(16, 16), y = s.getContext('2d');
            y.fillStyle = INK; y.beginPath(); y.arc(8, 8, 8, 0, 7); y.fill();
            y.fillStyle = col(0x17); y.beginPath(); y.arc(8, 8, 7, 0, 7); y.fill();
            y.fillStyle = col(0x27); y.beginPath(); y.arc(7, 6, 4, 0, 7); y.fill();
            y.fillStyle = col(0x07); y.fillRect(3, 11, 10, 2);
            this.spr.snakeseg = sprite(s);
        }
        // Glimmerjaw: a crystal golem, eye open / closed
        for (const open of [0, 1]) {
            const c = canvas(36, 34), x = c.getContext('2d');
            const poly = (pts, color) => { x.fillStyle = color; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
            poly([[18, 0], [34, 10], [36, 24], [26, 34], [10, 34], [0, 24], [2, 10]], INK);
            poly([[18, 2], [32, 11], [34, 23], [25, 32], [11, 32], [2, 23], [4, 11]], col(0x1c));
            poly([[18, 2], [32, 11], [18, 16], [4, 11]], col(0x2c));
            poly([[18, 2], [24, 7], [18, 16], [11, 7]], col(0x3c));
            poly([[2, 23], [11, 32], [18, 22]], col(0x0c));
            x.fillStyle = INK; x.fillRect(11, 15, 14, 9);
            if (open) { x.fillStyle = col(0x30); x.fillRect(12, 16, 12, 7); x.fillStyle = col(0x15); x.fillRect(16, 17, 5, 5); x.fillStyle = INK; x.fillRect(18, 18, 2, 3); }
            else { x.fillStyle = col(0x2c); x.fillRect(12, 19, 12, 2); }
            x.fillStyle = INK; for (let X = 9; X < 28; X += 4) x.fillRect(X, 27, 2, 3);
            this.spr[`glimmer${open}`] = sprite(c);
        }
        // Nimbus Grump: storm cloud
        for (const mood of [0, 1]) {
            const c = canvas(44, 28), x = c.getContext('2d');
            const puffs = [[10, 16, 9], [20, 11, 11], [32, 13, 10], [38, 19, 6], [6, 21, 6], [22, 20, 9]];
            x.fillStyle = INK; for (const [a, b, r] of puffs) { x.beginPath(); x.arc(a, b, r + 1, 0, 7); x.fill(); }
            x.fillStyle = col(mood ? 0x00 : 0x10); for (const [a, b, r] of puffs) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
            x.fillStyle = col(mood ? 0x10 : 0x20); for (const [a, b, r] of puffs.slice(0, 3)) { x.beginPath(); x.arc(a - 2, b - 3, r * 0.5, 0, 7); x.fill(); }
            x.fillStyle = INK; x.fillRect(13, 11, 7, 2); x.fillRect(25, 11, 7, 2); x.fillRect(15, 13, 4, 4); x.fillRect(26, 13, 4, 4);
            x.fillStyle = col(0x28); x.fillRect(16, 14, 2, 2); x.fillRect(27, 14, 2, 2);
            x.fillStyle = INK; x.fillRect(17, 21, 11, 2); x.fillRect(16, 23, 2, 1); x.fillRect(27, 23, 2, 1);
            this.spr[`nimbus${mood}`] = sprite(c);
        }
        // King Grumblewort: 28x34, plus a flying pot variant
        for (const pot of [0, 1]) {
            const c = canvas(28, 34), x = c.getContext('2d');
            const R = (X, Y, w, h, color) => { x.fillStyle = color; x.fillRect(X, Y, w, h); };
            // cape
            R(1, 12, 26, 20, INK); R(2, 13, 24, 18, col(0x05)); R(2, 13, 24, 2, col(0x15));
            // body
            R(5, 10, 18, 20, INK); R(6, 11, 16, 18, col(0x04)); R(6, 11, 5, 18, col(0x14));
            R(9, 18, 10, 9, col(0x36));
            // head
            R(6, 3, 16, 12, INK); R(7, 4, 14, 10, col(0x04)); R(7, 4, 5, 3, col(0x14));
            R(8, 7, 5, 4, col(0x30)); R(15, 7, 5, 4, col(0x30)); R(10, 8, 2, 3, INK); R(17, 8, 2, 3, INK);
            R(8, 6, 5, 1, INK); R(15, 6, 5, 1, INK); R(12, 5, 1, 1, INK); R(15, 5, 1, 1, INK);
            R(10, 12, 8, 1, INK);
            // crown
            R(7, 0, 14, 4, INK); R(8, 1, 12, 2, col(0x28)); R(8, -1, 2, 2, col(0x28)); R(13, -1, 2, 2, col(0x28)); R(18, -1, 2, 2, col(0x28));
            R(13, 1, 2, 2, col(0x16));
            if (pot) { R(2, 22, 24, 12, INK); R(3, 23, 22, 10, col(0x2d)); R(3, 23, 22, 2, col(0x10)); R(8, 27, 12, 2, col(0x28)); }
            else { R(6, 29, 6, 5, INK); R(16, 29, 6, 5, INK); R(7, 30, 4, 3, col(0x07)); R(17, 30, 4, 3, col(0x07)); }
            this.spr[`king${pot}`] = sprite(c);
        }
    }

    /** Tile atlas + backdrop for a theme, built on first use. */
    theme(name) {
        if (this.themes[name]) return this.themes[name];
        const th = THEMES[name];
        const rng = new RNG(name.charCodeAt(0) * 131 + name.length);
        const slots = {};
        const COLS = 16;
        let n = 0;
        const atlas = canvas(COLS * 16, 8 * 16);
        const x = atlas.getContext('2d');
        x.imageSmoothingEnabled = false;
        const slot = (key, paint) => {
            const ox = (n % COLS) * 16, oy = Math.floor(n / COLS) * 16;
            x.save(); x.beginPath(); x.rect(ox, oy, 16, 16); x.clip();
            paint(ox, oy);
            x.restore();
            slots[key] = [ox, oy];
            n++;
        };
        for (let mask = 0; mask < 16; mask++) slot(`g${mask}`, (ox, oy) => paintGround(x, ox, oy, th, mask, rng, name));
        for (let mask = 0; mask < 16; mask++) slot(`c${mask}`, (ox, oy) => paintGround(x, ox, oy, th, mask & ~1, rng, name));
        slot('brick', (ox, oy) => paintBrick(x, ox, oy, th));
        for (let f = 0; f < 4; f++) slot(`q${f}`, (ox, oy) => paintQ(x, ox, oy, th, f));
        slot('used', (ox, oy) => paintUsed(x, ox, oy, th));
        slot('hard', (ox, oy) => { bevel(x, ox, oy, th.hard); px(x, col(th.hard[0]), ox + 4, oy + 4, 8, 8); px(x, col(th.hard[1]), ox + 5, oy + 5, 6, 6); });
        slot('oneway', (ox, oy) => paintOneway(x, ox, oy, th, name));
        slot('spike', (ox, oy) => paintSpike(x, ox, oy));
        for (let f = 0; f < 4; f++) slot(`lava${f}`, (ox, oy) => paintLava(x, ox, oy, f, false));
        for (let f = 0; f < 4; f++) slot(`lavaf${f}`, (ox, oy) => paintLava(x, ox, oy, f, true));
        slot('red', (ox, oy) => paintRed(x, ox, oy));
        slot('bubble0', (ox, oy) => paintBubble(x, ox, oy, 0));
        slot('bubble1', (ox, oy) => paintBubble(x, ox, oy, 1));
        slot('ice', (ox, oy) => paintIce(x, ox, oy));
        slot('crack', (ox, oy) => {
            paintGround(x, ox, oy, th, 1, rng, name);
            x.strokeStyle = INK; x.lineWidth = 1;
            x.beginPath(); x.moveTo(ox + 2, oy + 5); x.lineTo(ox + 6, oy + 9); x.lineTo(ox + 5, oy + 14); x.moveTo(ox + 6, oy + 9); x.lineTo(ox + 11, oy + 8); x.lineTo(ox + 14, oy + 13); x.stroke();
        });
        slot('pTL', (ox, oy) => paintPipe(x, ox, oy, th, 'TL'));
        slot('pTR', (ox, oy) => paintPipe(x, ox, oy, th, 'TR'));
        slot('pL', (ox, oy) => paintPipe(x, ox, oy, th, 'L'));
        slot('pR', (ox, oy) => paintPipe(x, ox, oy, th, 'R'));
        for (let f = 0; f < 4; f++) slot(`coin${f}`, (ox, oy) => paintCoin(x, ox, oy, f));
        slot('spring0', (ox, oy) => paintSpring(x, ox, oy, 0));
        slot('spring1', (ox, oy) => paintSpring(x, ox, oy, 1));
        slot('pole', (ox, oy) => { px(x, INK, ox + 6, oy, 4, 16); px(x, col(0x2a), ox + 7, oy, 2, 16); px(x, col(0x3a), ox + 7, oy, 1, 16); });
        for (let i = 0; i < 4; i++) slot(`deco${i}`, (ox, oy) => paintDeco(x, ox, oy, name, i, rng));
        for (let i = 0; i < 2; i++) for (let f = 0; f < 2; f++) slot(`wall${i}${f}`, (ox, oy) => paintWallDeco(x, ox, oy, name, i, f));
        const bg = paintBackground(name, th);
        const sky = th.sky.map(col);
        const abyss = { meadow: '#0c1a4a', dunes: '#4a1a08', grotto: '#000000', skies: '#3a1a6a', keep: '#1a0404', castle: '#08080c' }[name];
        const dim = { grotto: 0.25, keep: 0.4, castle: 0.35 }[name] || 0;
        return (this.themes[name] = { atlas, slots, bg, sky, th, abyss, dim });
    }

    get(name) { return this.spr[name]; }
}

export { INK, col };
