// Procedural pixel art, baked once into small canvases. No image files: every sprite is a character
// map and a palette. Most sprites are drawn as their left half and mirrored, which keeps them
// symmetric and halves the work. A one-pixel black outline is added around every sprite, and each
// has a white "hit flash" twin.
//
// Map characters: '.' is transparent; a b c d are four tones of the sprite's colour, light to dark;
// e and f are accents (eyes, lights, cockpits); w is white; k is black.

export const PALETTES = {
    ship:   { a: '#f4fbff', b: '#a8dcff', c: '#3f8cff', d: '#1c3aa8', e: '#29e5ff', f: '#ff004d', w: '#ffffff', k: '#05051a' },
    blue:   { a: '#b4f0ff', b: '#29adff', c: '#1d5fd1', d: '#112a7a', e: '#ffec27', f: '#ff004d', w: '#ffffff', k: '#05051a' },
    green:  { a: '#c8ffa8', b: '#4cdc4c', c: '#1a9a3a', d: '#0b5a24', e: '#ffec27', f: '#ff004d', w: '#ffffff', k: '#05051a' },
    gold:   { a: '#fff6a0', b: '#ffc400', c: '#e07800', d: '#8a3a00', e: '#29e5ff', f: '#ff004d', w: '#ffffff', k: '#05051a' },
    purple: { a: '#ecb8ff', b: '#b04dff', c: '#7a24c8', d: '#3d1070', e: '#ffec27', f: '#29e5ff', w: '#ffffff', k: '#05051a' },
    red:    { a: '#ffc0b0', b: '#ff4d4d', c: '#c4122e', d: '#6e0820', e: '#ffec27', f: '#29e5ff', w: '#ffffff', k: '#05051a' },
    hull:   { a: '#d6dcff', b: '#8a96d0', c: '#4a5aa8', d: '#232a62', e: '#ff004d', f: '#29e5ff', w: '#ffffff', k: '#05051a' },
    steel:  { a: '#eef0ff', b: '#a8b0d0', c: '#646c94', d: '#343a5c', e: '#ff004d', f: '#29e5ff', w: '#ffffff', k: '#05051a' },
    orange: { a: '#ffe0a8', b: '#ff9a2e', c: '#d1561a', d: '#7a2a0e', e: '#29e5ff', f: '#ffec27', w: '#ffffff', k: '#05051a' },
    teal:   { a: '#b0fff0', b: '#2ee6c4', c: '#129a9a', d: '#0a5056', e: '#ffec27', f: '#ff004d', w: '#ffffff', k: '#05051a' },
    pink:   { a: '#ffc8ec', b: '#ff5ec8', c: '#c41e8e', d: '#6a0e4e', e: '#ffec27', f: '#29e5ff', w: '#ffffff', k: '#05051a' },
};

// Each sector re-colours the enemies, so a long game never looks the same twice.
export const SECTOR_SKINS = [
    { drone: 'blue',   weaver: 'green',  striker: 'gold',   saucer: 'purple', dart: 'red',    cruiser: 'orange', carrier: 'teal',   mine: 'steel' },
    { drone: 'pink',   weaver: 'teal',   striker: 'blue',   saucer: 'gold',   dart: 'green',  cruiser: 'purple', carrier: 'red',    mine: 'orange' },
    { drone: 'green',  weaver: 'orange', striker: 'pink',   saucer: 'blue',   dart: 'gold',   cruiser: 'teal',   carrier: 'purple', mine: 'steel' },
    { drone: 'orange', weaver: 'purple', striker: 'teal',   saucer: 'red',    dart: 'blue',   cruiser: 'green',  carrier: 'gold',   mine: 'pink' },
];

// ------------------------------------------------------------------ the maps
// Left halves, including the centre column as the last character.
const HALF = {
    // odd width: 15
    ship: [
        '.......a',
        '.......a',
        '......ab',
        '......ae',
        '.....abe',
        '.....abc',
        '....aabc',
        '..f.abbc',
        '.ffaabbc',
        '.fbabbcc',
        'ffbbbcdd',
        'fcbbcddd',
        'fc.bcd.f',
        '.f.bd..f',
        '...dd...',
    ],
    shipL: [   // leaning into a left turn: the near wing narrows
        '......a',
        '......a',
        '.....ab',
        '.....ae',
        '....abe',
        '....abc',
        '...aabc',
        '.f.abbc',
        '.faabbc',
        'fbabbcc',
        'fbbbcdd',
        'cbbcddd',
        'c.bcd.f',
        '..bd..f',
        '..dd...',
    ],
    // even width: 12
    drone0: [
        '....aa',
        '..abbb',
        '.abbbb',
        'abeebb',
        'abeebb',
        'bbbbcc',
        'bcbccd',
        'c.cdd.',
        'c..cd.',
    ],
    drone1: [
        '....aa',
        '..abbb',
        '.abbbb',
        'abeebb',
        'abeebb',
        'bbbbcc',
        'bcbccd',
        '.ccdd.',
        'c.cdc.',
    ],
    // odd width: 13
    weaver0: [
        '......a',
        '.....ab',
        '....abe',
        '...aabb',
        '.aabbcc',
        'aabccdd',
        'abcdd..',
        'bcd....',
        'cd.....',
    ],
    weaver1: [
        '......a',
        '.....ab',
        '....abe',
        '...aabb',
        '..aabcc',
        '.abccdd',
        'abcdd..',
        'bcd.d..',
        'cd.....',
    ],
    striker0: [
        '.f.....',
        '.f..aab',
        '..aabbb',
        '.abbebb',
        'abbbbcc',
        'abcccdd',
        '.bbbcdd',
        '..cdcdd',
        '...cd.d',
        '....d..',
    ],
    striker1: [
        '.f.....',
        '.f..aab',
        'aaabbbb',
        'abbbebb',
        '.bbbbcc',
        '..cccdd',
        '...bcdd',
        '..cdcdd',
        '...cd.d',
        '....d..',
    ],
    // even width: 18
    saucer0: [
        '.....aaaa',
        '...aabbbb',
        '..abbwbbb',
        '.abbbbbbb',
        'aabbbbbbb',
        'bcccceccc',
        'cddddddde',
        '.cdcddedd',
        '..dd.d.d.',
    ],
    saucer1: [
        '.....aaaa',
        '...aabbbb',
        '..abbwbbb',
        '.abbbbbbb',
        'aabbbbbbb',
        'bcccccecc',
        'cdddedddd',
        '.cdcdddde',
        '..dd.d.d.',
    ],
    // odd width: 9
    dart0: [
        '....a',
        '....a',
        '...ab',
        '...ab',
        '..abc',
        '.aebc',
        '.abcd',
        'abccd',
        'bc.cd',
        'c..d.',
        '...f.',
    ],
    dart1: [
        '....a',
        '....a',
        '...ab',
        '...ab',
        '..abc',
        '.aebc',
        '.abcd',
        'abccd',
        'bc.cd',
        'c..d.',
        '...e.',
    ],
    // even width: 24
    cruiser0: [
        '..........aabbbb',
        '.........abbbbcc',
        '........abbbccdd',
        '..aa...abbbcddee',
        '.abba.abbbccdded',
        'abbbbaabbcccdd..',
        'bbccbbbccddddd..',
        'bccddcccddeedd..',
        'cdddddcdddeedd..',
        'cddd..cddddddd..',
        'dd....ccddc.....',
        '......cdd.dd....',
        '.......cd..d....',
        '........d.......',
    ],
    cruiser1: [
        '..........aabbbb',
        '.........abbbbcc',
        '........abbbccdd',
        '..aa...abbbcddee',
        '.abba.abbbccdded',
        'abbbbaabbcccdd..',
        'bbccbbbccddddd..',
        'bccddcccddffdd..',
        'cdddddcdddffdd..',
        'cddd..cddddddd..',
        'dd....ccddc.....',
        '......cdd.dd....',
        '.......cd..d....',
        '........d.......',
    ],
    // even width: 30
    carrier0: [
        '.........aabbbbb',
        '.......aabbbbbcc',
        '.....aabbbbccccd',
        '...aabbbbccddddd',
        '..abbbbccdddeedd',
        '.abbbccddddeeedd',
        'abbbccddddddeedd',
        'bbccddddddccdddd',
        'bcddddccccbbcdd.',
        'cddddcbbbbbbbcd.',
        'dddddcbffffbbcd.',
        'ddd...cbffffbcd.',
        'dd....cccbbbccd.',
        '......dccccccdd.',
        '.......dddddd...',
    ],
    carrier1: [
        '.........aabbbbb',
        '.......aabbbbbcc',
        '.....aabbbbccccd',
        '...aabbbbccddddd',
        '..abbbbccdddeedd',
        '.abbbccddddeeedd',
        'abbbccddddddeedd',
        'bbccddddddccdddd',
        'bcddddccccbbcdd.',
        'cddddcbbbbbbbcd.',
        'dddddcbeeeebbcd.',
        'ddd...cbeeeebcd.',
        'dd....cccbbbccd.',
        '......dccccccdd.',
        '.......dddddd...',
    ],
    // odd width: 13
    mine0: [
        '...a...',
        '..aaa..',
        '.abbbbb',
        'abbwbbc',
        '.bbbbcc',
        'abbbfcd',
        '..cccdd',
        '...d...',
    ],
    mine1: [
        '.a.....',
        '.aa.a..',
        '.abbbbb',
        'abbwbbc',
        '.bbbbcc',
        'abbbfcd',
        '..cccdd',
        '.a.d.a.',
    ],
};

/** Bosses: even widths, 56 / 64 / 60. */
const BOSS = {
    boss0a: [
        '.................aabbbbbbbbbb',
        '..............aabbbbbbbbbbbbb',
        '...........aabbbbbbbbbbbbcccc',
        '.........aabbbbbbbbcccccccddd',
        '.......aabbbbbbbccccddddddddd',
        '.....aabbbbbbcccddddeeeedddde',
        '....abbbbbcccddddddeeeeeedddd',
        '..aabbbbccccdddddddddeeeeeddd',
        '.abbbcccddddddbbbbbbbbbcdddcc',
        'abbbccdddddbbbbccccccccbbbdcc',
        'bbccddddbbbbcccdddddddddcbbdc',
        'bccdddbbbccccddddddddddddcbbd',
        'cdddbbcccdddddddfffddfffdcbbd',
        'dddbbccdddddd..ffffffffffdcbd',
        'dd.bcddddd........ffffff.dcbd',
        'd..cdd...................dcd.',
        '...dd.....................d..',
    ],
    boss0b: [
        '.................aabbbbbbbbbb',
        '..............aabbbbbbbbbbbbb',
        '...........aabbbbbbbbbbbbcccc',
        '.........aabbbbbbbbcccccccddd',
        '.......aabbbbbbbccccddddddddd',
        '.....aabbbbbbcccddddeeeedddde',
        '....abbbbbcccddddddeeeeeedddd',
        '..aabbbbccccdddddddddeeeeeddd',
        '.abbbcccddddddbbbbbbbbbcdddcc',
        'abbbccdddddbbbbccccccccbbbdcc',
        'bbccddddbbbbcccdddddddddcbbdc',
        'bccdddbbbccccddddddddddddcbbd',
        'cdddbbcccdddddddeeeddeeedcbbd',
        'dddbbccdddddd..eeeeeeeeeedcbd',
        'dd.bcddddd........eeeeee.dcbd',
        'd..cdd...................dcd.',
        '...dd.....................d..',
    ],
    boss1a: [
        '..........................aabb',
        '.........................abbbb',
        '...................aaaaabbbbbc',
        '......aabb.......aabbbbbbbbccc',
        '.....abbbba.....abbbbbbbcccddd',
        '....abccbbba...abbbbbcccddeedd',
        '...abcddcbbb..abbbbcccdddeeeed',
        '..abcdd.cbbbaabbbccdddddeeeedd',
        '.abcdd..cbbbbbbbccddddddddeedd',
        '.bcdd...cbbbbbbccdddbbbbbbbbbd',
        '.bcd....ccbbbbccddbbbcccccccbb',
        '.bcd.....ccccccdbbbccdddddddcc',
        '.cd.......dddddbbccdddd.fffffd',
        '.d.........ddbbccdddd...fffffd',
        '...........dbccdddd.....ffffd.',
        '............ccdd.......ddddd..',
        '.............dd........dd.....',
    ],
    boss1b: [
        '..........................aabb',
        '.........................abbbb',
        '...................aaaaabbbbbc',
        '......aabb.......aabbbbbbbbccc',
        '.....abbbba.....abbbbbbbcccddd',
        '....abccbbba...abbbbbcccddeedd',
        '...abcddcbbb..abbbbcccdddeeeed',
        '..abcdd.cbbbaabbbccdddddeeeedd',
        '.abcdd..cbbbbbbbccddddddddeedd',
        '.bcdd...cbbbbbbccdddbbbbbbbbbd',
        '.bcd....ccbbbbccddbbbcccccccbb',
        '.bcd.....ccccccdbbbccdddddddcc',
        '.cd.......dddddbbccdddd.eeeeed',
        '.d.........ddbbccdddd...eeeeed',
        '...........dbccdddd.....eeeed.',
        '............ccdd.......ddddd..',
        '.............dd........dd.....',
    ],
    boss2a: [
        '..........................aabbb',
        '.......................aabbbbbb',
        '.....................aabbbbbbbc',
        '..................aaabbbbbbbbccc',
        '...............aabbbbbbbbcccdddd',
        '..aa.........aabbbbbbbccdddeeedd',
        '.abba......aabbbbbbbccddddeeeeed',
        'abbbba...aabbbbbbbccddddddeeeeed',
        'bcbbbbaaabbbbbbbccddddddddeeeedd',
        'bcddbbbbbbbbbbccddddddbbbbbddddd',
        'cdd.cbbbbbbbccddddddbbbccccbbbdd',
        'dd..cccbbbccdddddddbbcccddddcbbd',
        'd....cccccdddddddbbbccddd..dccbd',
        '......dddddddddbbbccdd.....dcbd.',
        '.......ddddddbbbcccd.......dcd..',
        '........dddbbbcccdd........dd...',
        '.........dbbcccdd...............',
        '..........bccdd.....fffff.......',
        '...........cdd......fffff.......',
        '............d........fff........',
    ],
    boss2b: [
        '..........................aabbb',
        '.......................aabbbbbb',
        '.....................aabbbbbbbc',
        '..................aaabbbbbbbbccc',
        '...............aabbbbbbbbcccdddd',
        '..aa.........aabbbbbbbccdddeeedd',
        '.abba......aabbbbbbbccddddeeeeed',
        'abbbba...aabbbbbbbccddddddeeeeed',
        'bcbbbbaaabbbbbbbccddddddddeeeedd',
        'bcddbbbbbbbbbbccddddddbbbbbddddd',
        'cdd.cbbbbbbbccddddddbbbccccbbbdd',
        'dd..cccbbbccdddddddbbcccddddcbbd',
        'd....cccccdddddddbbbccddd..dccbd',
        '......dddddddddbbbccdd.....dcbd.',
        '.......ddddddbbbcccd.......dcd..',
        '........dddbbbcccdd........dd...',
        '.........dbbcccdd...............',
        '..........bccdd.....eeeee.......',
        '...........cdd......eeeee.......',
        '............d........eee........',
    ],
};

// ------------------------------------------------------------------ baking
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** Left half → full rows. odd: the centre column (the half's last character) is not repeated. */
function expand(rows, odd) {
    // the centre is the right-hand edge, so a short row is padded on the left
    const w = Math.max(...rows.map((r) => r.length));
    return rows.map((r) => r.padStart(w, '.')).map((r) => r + [...r.slice(0, odd ? -1 : r.length)].reverse().join(''));
}

function draw(rows, pal) {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const c = canvas(w, h), g = c.getContext('2d');
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const k = row[x];
            if (k === '.' || !pal[k]) continue;
            g.fillStyle = pal[k];
            g.fillRect(x, y, 1, 1);
        }
    });
    return c;
}

/** Add a one-pixel black outline (4-neighbour) around everything opaque; the canvas grows by 2. */
function outline(src, color = '#05051a') {
    const w = src.width + 2, h = src.height + 2;
    const out = canvas(w, h), g = out.getContext('2d');
    const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && sd[(y * src.width + x) * 4 + 3] > 0;
    g.fillStyle = color;
    for (let y = -1; y <= src.height; y++) for (let x = -1; x <= src.width; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
    g.drawImage(src, 1, 1);
    return out;
}

/** The same shape in one flat colour (the white flash when something is hit). */
function silhouette(src, color = '#ffffff') {
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
}

function sprite(rows, pal, { odd = false, flash = true } = {}) {
    const img = outline(draw(rows, pal));
    return { img, white: flash ? silhouette(img) : null, w: img.width, h: img.height };
}

function half(name, pal, odd) {
    return sprite(expand(HALF[name], odd), pal, { odd });
}

function mirror(spr) {
    const f = (src) => { const c = canvas(src.width, src.height), g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; };
    return { img: f(spr.img), white: spr.white && f(spr.white), w: spr.w, h: spr.h };
}

/** A small round capsule/medal, drawn with pixels: `rim` outer, `body` inner, `shine` highlight. */
function orb(size, rim, body, shine, dark) {
    const c = canvas(size, size), g = c.getContext('2d'), r = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - r, dy = y + 0.5 - r, d = Math.hypot(dx, dy);
        if (d > r) continue;
        g.fillStyle = d > r - 1.1 ? rim : (dx + dy < -r * 0.5 && d < r - 1.6 ? shine : (dx + dy > r * 0.6 ? dark : body));
        g.fillRect(x, y, 1, 1);
    }
    return c;
}

export const CAPSULES = {
    P: ['#ff4d4d', '#c4122e', '#ffb0a0', '#7a0a20'],
    S: ['#4d9dff', '#1d4fd1', '#b4d8ff', '#102a7a'],
    B: ['#4cdc4c', '#1a9a3a', '#c8ffa8', '#0b5a24'],
    H: ['#29e5ff', '#12849a', '#c8fbff', '#0a4056'],
    '1': ['#ff5ec8', '#c41e8e', '#ffc8ec', '#6a0e4e'],
};

/** The mothership: a wide hull with rows of windows, panel seams, engine pods and a hangar mouth in the belly. */
function makeMother() {
    const w = 132, h = 42, c = canvas(w, h), g = c.getContext('2d'), P = PALETTES.hull;
    const hw = (y) => (y < 5 ? 26 + y * 7 : y < 26 ? 61 + (y - 5) * 0.25 : 66 - (y - 26) * 3.4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = Math.abs(x + 0.5 - w / 2);
        if (dx > hw(y)) continue;
        let k = y < 3 ? 'a' : y < 9 ? 'b' : y < 24 ? 'c' : 'd';
        if (dx > hw(y) - 2) k = y < 24 ? 'b' : 'c';                      // a lit rim
        if (x % 22 === 0 && y > 4 && y < 26) k = 'd';                    // panel seams
        if (y === 24) k = 'd';
        g.fillStyle = P[k]; g.fillRect(x, y, 1, 1);
    }
    for (const wy of [12, 17]) for (let x = -52; x <= 52; x += 8) {       // windows
        if (Math.abs(x) < 4) continue;
        g.fillStyle = (x + wy) % 16 === 0 ? P.f : P.e; g.fillRect(w / 2 + x - 1, wy, 3, 2);
    }
    g.fillStyle = P.d; g.fillRect(w / 2 - 15, 30, 30, 12);                // the hangar mouth
    g.fillStyle = '#05051a'; g.fillRect(w / 2 - 13, 31, 26, 11);
    g.fillStyle = P.a; g.fillRect(w / 2 - 15, 29, 30, 1);
    g.fillStyle = P.f; g.fillRect(w / 2 - 14, 30, 2, 1); g.fillRect(w / 2 + 12, 30, 2, 1);
    for (const sx of [-1, 1]) {                                           // engine pods
        g.fillStyle = P.c; g.fillRect(w / 2 + sx * 50 - 6, 30, 12, 8);
        g.fillStyle = P.d; g.fillRect(w / 2 + sx * 50 - 6, 36, 12, 2);
        g.fillStyle = '#29e5ff'; g.fillRect(w / 2 + sx * 50 - 3, 38, 6, 2);
    }
    const img = outline(c);
    return { img, w: img.width, h: img.height };
}

export function makeSprites() {
    const S = { skins: SECTOR_SKINS.length };

    // the player
    const shipC = half('ship', PALETTES.ship, true);
    const shipL = half('shipL', PALETTES.ship, true);
    S.ship = { c: shipC, l: shipL, r: mirror(shipL) };
    S.flame = [0, 1].map((i) => {
        const rows = i ? ['.eee.', '.fef.', '..f..', '..f..'] : ['.eee.', '.eee.', '..f..', '...'.padEnd(5, '.')];
        const c = draw(rows, { e: '#ffec27', f: '#ff8a00' });
        return { img: c, w: c.width, h: c.height };
    });

    // enemies, one set of sprites per sector skin
    const kinds = {
        drone:   [['drone0', false], ['drone1', false]],
        weaver:  [['weaver0', true], ['weaver1', true]],
        striker: [['striker0', true], ['striker1', true]],
        saucer:  [['saucer0', false], ['saucer1', false]],
        dart:    [['dart0', true], ['dart1', true]],
        cruiser: [['cruiser0', false], ['cruiser1', false]],
        carrier: [['carrier0', false], ['carrier1', false]],
        mine:    [['mine0', true], ['mine1', true]],
    };
    S.enemy = SECTOR_SKINS.map((skin) => {
        const set = {};
        for (const [kind, frames] of Object.entries(kinds)) set[kind] = frames.map(([name, odd]) => half(name, PALETTES[skin[kind]], odd));
        return set;
    });

    // bosses: the three of them, and a hurt (red) palette for each
    const bossPal = [PALETTES.hull, PALETTES.orange, PALETTES.purple];
    S.boss = [['boss0a', 'boss0b'], ['boss1a', 'boss1b'], ['boss2a', 'boss2b']].map((names, i) => names.map((n) => sprite(expand(BOSS[n], false), bossPal[i])));

    // bullets
    const bolt = (rows, pal) => { const c = draw(rows, pal); return { img: c, w: c.width, h: c.height }; };
    S.pbullet = [
        bolt(['.c.', 'cwc', 'cwc', 'cwc', '.c.', '.c.'], { c: '#29e5ff', w: '#ffffff' }),
        bolt(['..y..', '.yay.', '.yay.', 'yaaay', 'yaaay', '.yay.', '..y..'], { y: '#ffc400', a: '#fff6a0' }),
        bolt(['..c..', '.cwc.', '.cwc.', 'cwwwc', 'cwwwc', 'cwwwc', '.cwc.', '.cwc.', '..c..'], { c: '#29e5ff', w: '#ffffff' }),
    ];
    S.ebullet = [
        bolt(['.ooo.', 'orwro', 'owwwo', 'orwro', '.ooo.'], { o: '#ff8a00', r: '#ff004d', w: '#ffffcc' }),
        bolt(['..mmm..', '.mpppm.', 'mpwwwpm', 'mpwwwpm', 'mpwwwpm', '.mpppm.', '..mmm..'], { m: '#ff5ec8', p: '#c41e8e', w: '#ffffff' }),
        bolt(['.y.', 'yay', 'yay', 'yay', '.y.', '.y.'], { y: '#ffec27', a: '#ffffff' }),
    ];

    // capsules and medals
    S.capsule = {};
    for (const [k, [body, rim, shine, dark]] of Object.entries(CAPSULES)) S.capsule[k] = outline(orb(13, rim, body, shine, dark));
    S.medal = [11, 9, 5, 9].map((w) => {
        const c = canvas(w + 2, 13), g = c.getContext('2d');
        g.fillStyle = '#05051a'; g.fillRect(1, 1, w, 11);
        g.fillStyle = '#ffc400'; g.fillRect(2, 2, w - 2, 9);
        g.fillStyle = '#fff6a0'; g.fillRect(2, 2, Math.max(1, (w - 2) >> 1), 9);
        g.fillStyle = '#e07800'; g.fillRect(w - 1, 3, 1, 7);
        if (w >= 9) { g.fillStyle = '#ff8a00'; g.fillRect((w >> 1), 4, 3, 5); g.fillStyle = '#fff6a0'; g.fillRect((w >> 1) + 1, 5, 1, 3); }
        return c;
    });

    S.mother = makeMother();

    // HUD icons
    S.lifeIcon = outline(draw(expand(['...a', '...a', '..ab', '.fab', 'fbbc', 'fcbd'], true), PALETTES.ship));
    S.bombIcon = outline(orb(9, '#ff8a00', '#ffc400', '#fff6a0', '#c4122e'));

    return S;
}

/** For dev/sprites.html: every map and palette. */
export const RAW = { HALF, BOSS, PALETTES, SECTOR_SKINS };
export { expand, draw, outline };
