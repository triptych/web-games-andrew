// Procedural pixel art, baked once into small canvases. No image files: every sprite is a string
// map and a palette. '.' is transparent.

const MAPS = {
    hero: [
        [
            '....gggg....',
            '...ghhhhg...',
            '...gvvvvg...',
            '...gggggg...',
            '....gggg....',
            '..dggggggd..',
            '.gghggggggg.',
            'g.ghgggggg.g',
            'g.ghgggggg.g',
            'g..gggggg..g',
            '...gggggg...',
            '...gg..gg...',
            '...gg..gg...',
            '...gg..gg...',
            '..ggg..ggg..',
            '............',
        ],
        [
            '....gggg....',
            '...ghhhhg...',
            '...gvvvvg...',
            '...gggggg...',
            '....gggg....',
            '..dggggggd..',
            '.gghggggggg.',
            '.ghgggggggg.',
            'g.ghgggggg.g',
            'g..gggggg..g',
            '...gggggg...',
            '..gg....gg..',
            '..gg....gg..',
            '.gg......gg.',
            'ggg......ggg',
            '............',
        ],
    ],
    robot: [
        [
            '....rrrrrr....',
            '...rhhhhhhr...',
            '..rkkkkkkkkr..',
            '..rkeekkkkkr..',
            '..rrrrrrrrrr..',
            '...rrrrrrrr...',
            '.dddrhrrrrddd.',
            '.r.rhrrrrrr.r.',
            '.r.rhrrrrrr.r.',
            '.r.rrdrrdrr.r.',
            '...rrrrrrrr...',
            '...rr....rr...',
            '...rr....rr...',
            '..ddd....ddd..',
        ],
        [
            '....rrrrrr....',
            '...rhhhhhhr...',
            '..rkkkkkkkkr..',
            '..rkkkkkeekr..',
            '..rrrrrrrrrr..',
            '...rrrrrrrr...',
            '.dddrhrrrrddd.',
            '.r.rhrrrrrr.r.',
            '.r.rhrrrrrr.r.',
            '.r.rrdrrdrr.r.',
            '...rrrrrrrr...',
            '..rr......rr..',
            '..rr......rr..',
            '.ddd......ddd.',
        ],
    ],
    gunner: [
        [
            '......ee......',
            '......dd......',
            '....rrrrrr....',
            '...rhhhhhhr...',
            '..rkkeekkkkr..',
            '..rrrrrrrrrr..',
            'dddrhrrrrrr...',
            'eeerhrrrrrrr.r',
            'dddrhrrrrrrr.r',
            '...rrdrrdrr..r',
            '...rrrrrrrr...',
            '...rr....rr...',
            '...rr....rr...',
            '..ddd....ddd..',
        ],
        [
            '......dd......',
            '......ee......',
            '....rrrrrr....',
            '...rhhhhhhr...',
            '..rkkkkkeekr..',
            '..rrrrrrrrrr..',
            'dddrhrrrrrr...',
            'eeerhrrrrrrr.r',
            'dddrhrrrrrrr.r',
            '...rrdrrdrr..r',
            '...rrrrrrrr...',
            '..rr......rr..',
            '..rr......rr..',
            '.ddd......ddd.',
        ],
    ],
    chip: [[
        '...c...',
        '..ccc..',
        '.cchcc.',
        'cchwhcc',
        '.cchcc.',
        '..ccc..',
        '...c...',
    ]],
};

const PALETTES = {
    hero:   { g: '#39ff88', h: '#b6ffd4', d: '#0f8a4a', v: '#eafffb' },
    drone:  { r: '#ffb000', h: '#ffe08a', d: '#9a5a00', k: '#2a1400', e: '#ff2d55' },
    hunter: { r: '#ff2d55', h: '#ff9db0', d: '#8a0a24', k: '#24000a', e: '#ffe14d' },
    gunner: { r: '#9b5cff', h: '#d7bfff', d: '#4a1fa0', k: '#14062e', e: '#2de2ff' },
    brute:  { r: '#ff5ec8', h: '#ffc2ea', d: '#9a1a6e', k: '#2a0020', e: '#7dff3a' },
    chip:   { c: '#ffe14d', h: '#fff4b0', w: '#ffffff' },
};

function bake(rows, pal, flat = null) {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const k = row[x];
            if (k === '.' || !pal[k]) continue;
            g.fillStyle = flat || pal[k];
            g.fillRect(x, y, 1, 1);
        }
    });
    return c;
}

/** A canvas mirrored left-to-right. */
function mirror(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
}

/** The Grinner: a bouncing yellow face, drawn with circles at pixel scale. Two frames: grin, cackle. */
function grinner(open) {
    const s = 22, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const disc = (cx, cy, r, col) => {
        g.fillStyle = col;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) g.fillRect(x, y, 1, 1);
    };
    disc(11, 11, 10.5, '#ff2bd6');
    disc(11, 11, 9.3, '#ffe14d');
    disc(10, 9.5, 8, '#fff4a8');
    disc(11, 11.5, 7.6, '#ffe14d');
    g.fillStyle = '#1a0010';
    g.fillRect(6, 6, 3, 4); g.fillRect(13, 6, 3, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(7, 6, 1, 1); g.fillRect(14, 6, 1, 1);
    // the grin
    g.fillStyle = '#1a0010';
    const mouth = open ? [[5, 12, 12, 1], [5, 13, 12, 3], [6, 16, 10, 1], [8, 17, 6, 1]] : [[4, 12, 2, 1], [16, 12, 2, 1], [5, 13, 12, 2], [7, 15, 8, 1]];
    for (const [x, y, w, h] of mouth) g.fillRect(x, y, w, h);
    g.fillStyle = '#ffffff';
    if (open) { g.fillRect(6, 13, 10, 1); } else { for (let x = 6; x < 16; x += 2) g.fillRect(x, 13, 1, 1); }
    g.fillStyle = '#ff2bd6';
    if (open) g.fillRect(9, 15, 4, 1);
    return c;
}

export function makeSprites() {
    const S = {};
    const set = (name, maps, pal) => {
        const frames = maps.map((m) => bake(m, pal));
        S[name] = { frames, flipped: frames.map(mirror), white: maps.map((m) => bake(m, pal, '#ffffff')) };
    };
    set('hero', MAPS.hero, PALETTES.hero);
    set('drone', MAPS.robot, PALETTES.drone);
    set('hunter', MAPS.robot, PALETTES.hunter);
    set('gunner', MAPS.gunner, PALETTES.gunner);
    set('brute', MAPS.robot, PALETTES.brute);
    set('chip', MAPS.chip, PALETTES.chip);
    S.grinner = { frames: [grinner(false), grinner(true)] };
    S.colors = { drone: PALETTES.drone.r, hunter: PALETTES.hunter.r, gunner: PALETTES.gunner.r, brute: PALETTES.brute.r };
    return S;
}

/** For dev/gallery.html: every map and palette. */
export const RAW = { MAPS, PALETTES };
