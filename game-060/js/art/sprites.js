// Every bitmap in the game, as strings. '.' is empty; other characters index the
// sprite's colour table. Rows are listed top to bottom; pixel y is measured up from
// the sprite's bottom edge so it matches the sim (y up).
//
// Pure data + tiny helpers: the sim imports sizes from here, so no three.js.

export const hex = (h, k = 1) => [((h >> 16) & 255) / 255 * k, ((h >> 8) & 255) / 255 * k, (h & 255) / 255 * k];

export const PAL = {
    white: 0xffffff, red: 0xff2448, orange: 0xff8a1a, yellow: 0xffe23a, green: 0x3aff5a,
    lime: 0xb6ff3a, cyan: 0x3ae8ff, blue: 0x3a6aff, magenta: 0xff3ad8, purple: 0x9a4aff,
    pink: 0xff7ab8, grey: 0x9aa0b8, dark: 0x262a40, steel: 0x7a86a8, gold: 0xffc21a, ice: 0xbff4ff,
};

/** Breakout rainbow, by formation row. */
export const ROW_COLORS = [0xff2448, 0xff8a1a, 0xffe23a, 0x3aff5a, 0x3ae8ff, 0x3a6aff, 0xff3ad8, 0x9a4aff];

function sprite(colors, ...frames) {
    const h = frames[0].length, w = frames[0][0].length;
    const out = { w, h, colors: {}, frames: [] };
    for (const [k, v] of Object.entries(colors)) out.colors[k] = Array.isArray(v) ? v : hex(v);
    for (const rows of frames) {
        const px = [];
        rows.forEach((row, r) => {
            if (row.length !== w) throw new Error(`sprite row width ${row.length} != ${w}: ${row}`);
            for (let c = 0; c < w; c++) if (row[c] !== '.') px.push({ x: c, y: h - 1 - r, k: row[c] });
        });
        out.frames.push(px);
    }
    return out;
}

// ------------------------------------------------------------------ invaders
export const INVADERS = {
    // GLOOP: a one-eyed goo blob that drips as it marches
    gloop: sprite({ X: PAL.magenta, w: PAL.white, o: PAL.cyan }, [
        '...XXXX...',
        '..XXXXXX..',
        '.XXwwwwXX.',
        'XXwwoowwXX',
        'XXXwwwwXXX',
        'XXXXXXXXXX',
        'X.XX..XX.X',
        '...X..X...',
    ], [
        '...XXXX...',
        '.XXXXXXXX.',
        'XXXwwwwXXX',
        'XXwwoowwXX',
        'XXXwwwwXXX',
        'XXXXXXXXXX',
        '.XX.XX.XX.',
        '.X..X..X..',
    ]),
    // BUZZ: a shelled space beetle scuttling on six legs
    buzz: sprite({ X: PAL.cyan, d: 0x1a7a9a, o: PAL.red }, [
        '.X.......X.',
        '..X.....X..',
        '...XXXXX...',
        'X.XoXdXoX.X',
        '.XXXXdXXXX.',
        'X.XXXdXXX.X',
        '.XXXXdXXXX.',
        'X..XX.XX..X',
    ], [
        'X.........X',
        '.X.......X.',
        '...XXXXX...',
        '.XXoXdXoXX.',
        'X.XXXdXXX.X',
        '.XXXXdXXXX.',
        'X.XXXdXXX.X',
        '..XX...XX..',
    ]),
    // PEEPER: a bat-winged eyeball that flaps
    peeper: sprite({ X: PAL.green, w: PAL.white, o: PAL.red }, [
        'X....XX....X',
        'XX..XXXX..XX',
        'XXXXwwwwXXXX',
        '.XXwwoowwXX.',
        '..XwwoowwX..',
        '...XwwwwX...',
        '....X..X....',
        '...X....X...',
    ], [
        '.....XX.....',
        '....XXXX....',
        '..XXwwwwXX..',
        '.XXwwoowwXX.',
        'XXXwwoowwXXX',
        'XX.XwwwwX.XX',
        'X...X..X...X',
        '...X....X...',
    ]),
    tank: sprite({ X: PAL.orange, o: PAL.steel, w: PAL.white, y: PAL.yellow }, [
        '...oooooo...',
        '..oowwwwoo..',
        '.oXXXXXXXXo.',
        'oXXyyXXyyXXo',
        'oXXXXXXXXXXo',
        '.XXXXXXXXXX.',
        '.X.XX..XX.X.',
        'X..X....X..X',
        '.X..X..X..X.',
    ], [
        '...oooooo...',
        '..oowwwwoo..',
        '.oXXXXXXXXo.',
        'oXXyyXXyyXXo',
        'oXXXXXXXXXXo',
        '.XXXXXXXXXX.',
        '..XX.XX.XX..',
        '.X..X..X..X.',
        'X..X....X..X',
    ]),
    diver: sprite({ X: PAL.yellow, o: PAL.red }, [
        '.....X.....',
        '....XXX....',
        'X..XoXoX..X',
        'XX.XXXXX.XX',
        'XXXXXXXXXXX',
        '.XXX.X.XXX.',
        '..X..X..X..',
        '.....X.....',
        '....X.X....',
    ], [
        'X....X....X',
        'XX..XXX..XX',
        '.X.XoXoX.X.',
        '.XXXXXXXXX.',
        '..XXXXXXX..',
        '...X.X.X...',
        '..X..X..X..',
        '.....X.....',
        '....X.X....',
    ]),
    splitter: sprite({ X: PAL.lime, d: 0x3a8a1a, o: PAL.magenta }, [
        '...XXXX...',
        '.XXXXdXXX.',
        'XoXXXdXXoX',
        'XXXXXdXXXX',
        'XXXXXdXXXX',
        '.XX.XdX.X.',
        'X..X...X.X',
        '.X.......X',
    ], [
        '...XXXX...',
        '.XXXXdXXX.',
        'XoXXXdXXoX',
        'XXXXXdXXXX',
        'XXXXXdXXXX',
        '.X.XXdXX..',
        'X.X...X..X',
        '..X....X..',
    ]),
    mini: sprite({ X: 0xd8ff7a, o: PAL.magenta }, [
        '.XXXX.',
        'XoXXoX',
        'XXXXXX',
        '.X..X.',
        'X....X',
    ], [
        '.XXXX.',
        'XoXXoX',
        'XXXXXX',
        'X.XX.X',
        '.X..X.',
    ]),
    mirror: sprite({ X: PAL.ice, w: PAL.white, o: PAL.cyan, b: PAL.blue }, [
        '.....w.....',
        '....wXw....',
        '...wXoXw...',
        '..wXXoXXw..',
        '.wXXboboXXw',
        '..XXXoXXX..',
        '...XXoXX...',
        '....XXX....',
        '.....X.....',
    ], [
        '.....w.....',
        '....wow....',
        '...wXXXw...',
        '..wXoXoXw..',
        '.wXXXbXXXXw',
        '..XoXXXoX..',
        '...XXXXX...',
        '....XoX....',
        '.....X.....',
    ]),
    builder: sprite({ X: PAL.gold, o: PAL.cyan, w: PAL.white, r: PAL.red }, [
        '....XXXX....',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        'XXXXXXXXXXXX',
        'X.XXwwwwXX.X',
        'r..XX..XX..r',
        '..XX....XX..',
        '.X........X.',
    ], [
        '....XXXX....',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        'XXXXXXXXXXXX',
        'r.XXwwwwXX.r',
        'X..XX..XX..X',
        '...XX..XX...',
        '..X......X..',
    ]),
    captor: sprite({ X: PAL.purple, o: PAL.yellow, y: PAL.cyan }, [
        '..X.......X..',
        '...X.....X...',
        '..XXXXXXXXX..',
        '.XXoXXXXXoXX.',
        'XXXXXXXXXXXXX',
        'XXyXXXXXXXyXX',
        'X.XXXX.XXXX.X',
        'X..XX...XX..X',
        '..XX.....XX..',
        '.X.........X.',
    ], [
        'X.X.......X.X',
        '.X.X.....X.X.',
        '..XXXXXXXXX..',
        '.XXoXXXXXoXX.',
        'XXXXXXXXXXXXX',
        'XXyXXXXXXXyXX',
        '.XXXXX.XXXXX.',
        '..XXX...XXX..',
        '.X.X.....X.X.',
        'X...........X',
    ]),
};

export const INVADER_INFO = {
    gloop:    { hp: 1, pts: 10,  name: 'GLOOP' },
    buzz:     { hp: 1, pts: 20,  name: 'BUZZ' },
    peeper:   { hp: 1, pts: 30,  name: 'PEEPER' },
    tank:     { hp: 4, pts: 60,  name: 'TANK' },
    splitter: { hp: 2, pts: 40,  name: 'SPLITTER' },
    mini:     { hp: 1, pts: 15,  name: 'MINI' },
    mirror:   { hp: 2, pts: 50,  name: 'MIRROR' },
    builder:  { hp: 2, pts: 50,  name: 'BUILDER' },
    diver:    { hp: 2, pts: 50,  name: 'DIVER' },
    captor:   { hp: 3, pts: 150, name: 'CAPTOR' },
};

// The mystery ship: a delta-winged raider with a bubble cockpit and three thrusters
export const UFO = sprite({ X: PAL.red, w: PAL.white, r: PAL.orange, 1: PAL.yellow, 2: PAL.cyan, 3: PAL.green, 4: PAL.magenta }, [
    '.......ww.......',
    '......wXXw......',
    '..X..XXXXXX..X..',
    '.XXXXX1XX2XXXXX.',
    'XX3XXXXXXXXXX4XX',
    '.X.XXXXXXXXXX.X.',
    '...rr..rr..rr...',
]);

// The ball is the only white-and-cyan thing in play; every enemy shot is red, pink or magenta.
export const BALL_SPRITE = sprite({ W: [2.4, 2.4, 2.4], o: [0.35, 1.6, 2.4] }, ['oWo', 'WWW', 'oWo']);
export const FIREBALL_SPRITE = sprite({ W: [2.6, 2.5, 1.4], o: [2.4, 1.3, 0.1] }, ['oWo', 'WWW', 'oWo']);

export const BULLETS = {
    zig: sprite({ X: [2.4, 0.22, 0.3] }, ['.X.', 'X..', '.X.', '..X', '.X.', 'X..', '.X.'],
        ['.X.', '..X', '.X.', 'X..', '.X.', '..X', '.X.']),
    plunger: sprite({ X: [2.3, 0.3, 0.75] }, ['.X.', '.X.', '.X.', '.X.', 'XXX', '.X.'],
        ['.X.', 'XXX', '.X.', '.X.', '.X.', '.X.']),
    bomb: sprite({ X: [1.8, 0.4, 0.3], o: [2.2, 1.9, 0.6] }, ['.XXX.', 'XXoXX', 'XoooX', 'XXoXX', '.XXX.'],
        ['.XXX.', 'XoooX', 'XoXoX', 'XoooX', '.XXX.']),
    rock: sprite({ X: hex(0xa08868), o: hex(0x6a5a48) }, ['.XX.', 'XXoX', 'XoXX', '.XX.']),
    orb: sprite({ X: [2.0, 0.2, 1.6], o: [2.4, 0.6, 1.0] }, ['X.X', '.o.', 'X.X'], ['.X.', 'XoX', '.X.']),
};

// ------------------------------------------------------------------ capsules
const MINI_FONT = {
    L: '#../#../#../#../###', E: '###/#../##./#../###', C: '.##/#../#../#../.##',
    M: '#.#/###/###/#.#/#.#', F: '###/#../##./#../#..', S: '.##/#../.#./..#/##.',
    B: '##./#.#/##./#.#/##.', N: '##./#.#/#.#/#.#/#.#', P: '##./#.#/##./#../#..',
};
export const CAPSULE_COLORS = {
    L: 0xff2448, E: 0x3a6aff, C: 0x3aff5a, M: 0x3ae8ff, F: 0xff8a1a,
    S: 0xffe23a, B: 0x9a4aff, N: 0xff7ab8, P: 0xb8bcd0,
};
export const CAPSULE_W = 11, CAPSULE_H = 5;
/** Pixels of the letter inside a capsule, relative to the capsule's bottom-left. */
export const CAPSULE_LETTER = {};
for (const [k, s] of Object.entries(MINI_FONT)) {
    const rows = s.split('/'), px = [];
    rows.forEach((row, r) => { for (let c = 0; c < 3; c++) if (row[c] === '#') px.push({ x: 4 + c, y: 4 - r }); });
    CAPSULE_LETTER[k] = px;
}
export const CAPSULE_SHAPE = (() => {
    const rows = ['.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.'];
    const px = [];
    rows.forEach((row, r) => { for (let c = 0; c < 11; c++) if (row[c] === 'X') px.push({ x: c, y: 4 - r }); });
    return px;
})();

// ------------------------------------------------------------------ paddle
/** The STRIKER, built procedurally for any width. Returns [{x,y,c:[r,g,b]}], bottom-left origin. */
export function paddlePixels(w, opts = {}) {
    const px = [];
    const body = hex(0x9aa8d0), hi = hex(0xe8f4ff, 1.15), lo = hex(0x4a5478), pod = opts.laser ? hex(0xff3a3a, 1.3) : hex(0xff8a1a, 1.1);
    const podHi = opts.laser ? hex(0xffd0d0, 1.6) : hex(0xffd08a, 1.3);
    const glow = opts.catchy ? hex(0x3aff5a, 1.6) : hex(0x3ae8ff, 1.6);
    const cx = (w - 1) / 2;
    for (let x = 0; x < w; x++) {
        const edge = Math.min(x, w - 1 - x);
        for (let y = 0; y < 5; y++) {
            if (edge === 0 && (y === 0 || y === 4)) continue;
            if (edge < 4) {
                px.push({ x, y, c: y === 3 ? podHi : (y === 0 ? lo : pod) });
            } else {
                let c = body;
                if (y === 4) c = edge === 4 ? body : hi;
                else if (y === 0) c = lo;
                else if (y === 2) c = glow;
                px.push({ x, y, c });
            }
        }
        // cockpit dome
        if (Math.abs(x - cx) < 3) px.push({ x, y: 5, c: Math.abs(x - cx) < 1.5 ? hex(0x3ae8ff, 1.9) : hi });
        if (opts.laser && (edge === 1)) { px.push({ x, y: 5, c: podHi }); px.push({ x, y: 6, c: hex(0xffffff, 1.8) }); }
    }
    return px;
}

// ------------------------------------------------------------------ shields
/** Shields are little brick forts: battlements on top, a gateway underneath. */
export const SHIELD_SHAPE = [
    'XXXX..XXXX..XXXX..XXXX',
    'XXXX..XXXX..XXXX..XXXX',
    'XXXX..XXXX..XXXX..XXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXX....XXXXXXXXX',
    'XXXXXXXX......XXXXXXXX',
    'XXXXXXXX......XXXXXXXX',
    'XXXXXXXX......XXXXXXXX',
    'XXXXXXXX......XXXXXXXX',
    'XXXXXXXX......XXXXXXXX',
];
