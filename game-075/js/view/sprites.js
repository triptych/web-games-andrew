// Pixel art, made in code. Small items are hand-drawn character grids. The
// dragons, the bat and CHROMAGON are built from shapes (ellipses, polygons,
// thick lines) rasterised into a material grid, then shaded and outlined the
// way a late-80s sprite artist would: a light edge where the material's top
// meets something else, a dark edge at its bottom, and a dark outline round
// the whole silhouette. One body plan, many palettes, any size.
//
// Every sprite is baked once into a canvas at native resolution (one canvas
// pixel per screen pixel). Glows are baked at 3× so they stay smooth.

const S = 3;

// ------------------------------------------------------------------ grids
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function bakeGrid(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = canvas(w, h), g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const col = pal[rows[y][x]];
        if (!col) continue;
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
}

/** A soft glow of a sprite's silhouette, baked at 3×, padded by `pad` native px. */
export function bakeGlow(src, color, blur = 4, pad = 6) {
    const w = (src.width + pad * 2) * S, h = (src.height + pad * 2) * S;
    const c = canvas(w, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    // the shadow trick: draw the sprite off the canvas, its shadow on it
    g.shadowColor = color; g.shadowBlur = blur * S; g.shadowOffsetX = w + 1000;
    g.drawImage(src, pad * S - (w + 1000), pad * S, src.width * S, src.height * S);
    g.shadowOffsetX = 0;
    c.pad = pad;
    return c;
}

/** All lit pixels of a sprite in one flat colour (hit flashes). */
export function silhouette(src, color = '#fff') {
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
}

// ------------------------------------------------------------------ the shape rasteriser
class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.m = new Int8Array(w * h).fill(-1); }
    set(x, y, m) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = m; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.m[y * this.w + x]; }
    ellipse(cx, cy, rx, ry, m) {
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) this.set(x, y, m);
        }
    }
    poly(pts, m) {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
            const px = x + 0.5, py = y + 0.5;
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const [xi, yi] = pts[i], [xj, yj] = pts[j];
                if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
            }
            if (inside) this.set(x, y, m);
        }
    }
    line(x0, y0, x1, y1, w, m) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
            if (w <= 1.2) this.set(x, y, m); else this.ellipse(x, y, w / 2, w / 2, m);
        }
    }
    rect(x, y, w, h, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m); }
}

/**
 * Shade and outline a material grid. `mats[i]` = { ramp: [dark, base, light], flat?: bool }.
 */
function renderPix(P, mats, outline) {
    const c = canvas(P.w, P.h), g = c.getContext('2d');
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
        const m = P.get(x, y);
        if (m < 0) {
            if (outline && (P.get(x - 1, y) >= 0 || P.get(x + 1, y) >= 0 || P.get(x, y - 1) >= 0 || P.get(x, y + 1) >= 0)) {
                g.fillStyle = outline; g.fillRect(x, y, 1, 1);
            }
            continue;
        }
        const mat = mats[m];
        let col = mat.ramp[1];
        if (!mat.flat) {
            const up = P.get(x, y - 1), dn = P.get(x, y + 1), lf = P.get(x - 1, y), rt = P.get(x + 1, y);
            if (up !== m && (lf !== m || up < 0)) col = mat.ramp[2];
            else if (up !== m) col = mat.ramp[2];
            else if (dn !== m || (rt < 0)) col = mat.ramp[0];
            else if (lf !== m && ((x + y) & 1)) col = mat.ramp[2];
        }
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
}

// ------------------------------------------------------------------ dragons
const BODY = 0, BELLY = 1, WING = 2, BONE = 3, HORN = 4, EYE = 5, PUPIL = 6, MOUTH = 7, TEETH = 8, SPIKE = 9;

export const DRAGON_PAL = {
    aurix:   { body: ['#a85200', '#ffad14', '#ffe46a'], belly: ['#c88a20', '#ffe9a0', '#fffadc'], wing: ['#a02800', '#ff6a10', '#ffa848'], bone: '#6a2000', horn: ['#8a6a40', '#e8d8b8', '#ffffff'], spike: ['#c03000', '#ff5020', '#ff9a60'], pupil: '#ff1060', out: '#2a0c00', glow: '#ffa800' },
    verdox:  { body: ['#086a2a', '#1ed060', '#9cff8c'], belly: ['#6aa040', '#d8ff90', '#f8ffd8'], wing: ['#00524a', '#00b090', '#48f4c8'], bone: '#003a30', horn: ['#7a7a50', '#e8e8c0', '#ffffff'], spike: ['#006a6a', '#00e0c0', '#a0fff0'], pupil: '#ff3000', out: '#00200e', glow: '#20ff80' },
    scarlax: { body: ['#7a0010', '#ff1e3c', '#ff8a86'], belly: ['#a04020', '#ffa070', '#ffd8bc'], wing: ['#4a0030', '#b00060', '#ff3a96'], bone: '#300018', horn: ['#605050', '#d8c8c8', '#ffffff'], spike: ['#ff6000', '#ffb000', '#fff080'], pupil: '#ffee00', out: '#200006', glow: '#ff2a40' },
    cryovex: { body: ['#00507e', '#1cbcff', '#b4f2ff'], belly: ['#6090b0', '#e0f8ff', '#ffffff'], wing: ['#1c2a8a', '#4060ff', '#98b4ff'], bone: '#101a60', horn: ['#80a0c0', '#e8f8ff', '#ffffff'], spike: ['#a0e8ff', '#ffffff', '#ffffff'], pupil: '#0030ff', out: '#001030', glow: '#40e0ff' },
    luma:    { body: ['#7a0060', '#ff2ece', '#ff9cf0'], belly: ['#a04080', '#ffc0f0', '#fff0fc'], wing: ['#2c0070', '#7c30ff', '#c49cff'], bone: '#1a0040', horn: ['#9070a0', '#f0e0ff', '#ffffff'], spike: ['#00a0c0', '#20f0ff', '#c0ffff'], pupil: '#20f0ff', out: '#24001c', glow: '#ff40e0' },
    nox:     { body: ['#2c0070', '#8a3aff', '#cca4ff'], belly: ['#6050a0', '#d8c8ff', '#f8f0ff'], wing: ['#5a0040', '#d01e90', '#ff64c4'], bone: '#300020', horn: ['#706090', '#e0d8f0', '#ffffff'], spike: ['#ff2ece', '#ff9cf0', '#ffffff'], pupil: '#ff2ece', out: '#100024', glow: '#a060ff' },
    chrome:  { body: ['#3c4660', '#aebed8', '#ffffff'], belly: ['#806040', '#e4c480', '#fff2c8'], wing: ['#1c2436', '#64749c', '#d4e2ff'], bone: '#0c1220', horn: ['#a07820', '#ffd040', '#fff8c0'], spike: ['#a07820', '#ffd040', '#fff8c0'], pupil: '#ff0044', out: '#06080e', glow: '#c0e0ff' },
    dull:    { body: ['#303038', '#6a6a74', '#9a9aa4'], belly: ['#504838', '#8a8070', '#aaa090'], wing: ['#202028', '#44444e', '#6a6a74'], bone: '#101014', horn: ['#504830', '#8a7a50', '#a89870'], spike: ['#504830', '#8a7a50', '#a89870'], pupil: '#600018', out: '#06060a', glow: '#606070' },
};

function dragonPix(size, f) {
    const k = size / 24;
    const P = new Pix(size, size);
    const E = (x, y, rx, ry, m) => P.ellipse(x * k, y * k, rx * k, ry * k, m);
    const L = (x0, y0, x1, y1, w, m) => P.line(x0 * k, y0 * k, x1 * k, y1 * k, w * k, m);
    const Q = (pts, m) => P.poly(pts.map(([x, y]) => [x * k, y * k]), m);
    const b = f.step ? 0.6 : 0;
    // wing (behind the body)
    const wing = f.wing === 0
        ? [[8, 13], [12.5, 12], [14.5, 3.5], [11.5, 1.2], [10, 5], [7, 2.2], [5.6, 6], [2.2, 5], [3, 11]]
        : [[8, 13.5], [12.5, 12.5], [16, 9.5], [12.8, 8.6], [10.6, 10.4], [7.6, 9], [5.6, 11.6], [1.8, 11.4], [4, 14]];
    Q(wing, WING);
    const tips = f.wing === 0 ? [[14.5, 3.5], [11.5, 1.2], [7, 2.2], [2.2, 5]] : [[16, 9.5], [12.8, 8.6], [7.6, 9], [1.8, 11.4]];
    for (const [tx, ty] of tips) L(10.5, 12.6, tx, ty, 0.8, BONE);
    // tail, with a spade at the end
    L(7, 16 + b, 4, 18.4, 2.3, BODY); L(4, 18.4, 2.2, 16.6, 1.9, BODY); L(2.2, 16.6, 1.6, 13, 1.5, BODY);
    Q([[0, 13.6], [1.6, 10.2], [3.4, 13.4]], SPIKE);
    // the far leg
    L(8.2, 17.5 + b, f.step ? 6.8 : 8.2, 21.2, 2.1, BODY); L(f.step ? 5.8 : 7.2, 21.6, f.step ? 7.8 : 9.2, 21.6, 1, SPIKE);
    // body and belly
    E(10.5, 15.4 + b, 5.3, 3.7, BODY);
    E(11, 17.3 + b, 4.1, 1.7, BELLY);
    // the near leg
    L(13.4, 17 + b, f.step ? 14.2 : 13, 21.2, 2.2, BODY); L(f.step ? 13.2 : 12, 21.7, f.step ? 15.6 : 14.4, 21.7, 1, SPIKE);
    // neck and head
    L(12.6, 14.4 + b, 16, 9.4, 3.4, BODY);
    L(14.3, 14.6 + b, 17.2, 10.6, 1.2, BELLY);
    E(18, 7.3, 3.3, 2.7, BODY);
    Q([[17.6, 5.4], [23, 6.1], [23, 8.7], [17.6, 9.3]], BODY);
    if (f.mouth) {
        Q([[17, 9.2], [22.8, 11], [22, 13.2], [16.8, 11]], BELLY);
        Q([[18, 8.8], [23, 8.9], [22.6, 11], [18, 10]], MOUTH);
        P.set(20 * k, 9 * k, TEETH); P.set(22 * k, 9 * k, TEETH); P.set(21 * k, 10.6 * k, TEETH);
    } else {
        Q([[17.6, 8.7], [22.6, 8.8], [22.2, 10.2], [17.6, 10.2]], BELLY);
    }
    // horns, spines, eye
    L(17, 5.2, 14.4, 1.8, 1.4, HORN); L(18.8, 5, 18, 1.4, 1.1, HORN);
    Q([[12.4, 11.4], [13.6, 9.3], [14.4, 11.6]], SPIKE);
    Q([[9.8, 12.1], [11, 10.2], [12.2, 12.1]], SPIKE);
    Q([[7.3, 13], [8.4, 11.3], [9.5, 13]], SPIKE);
    if (k > 1.2) { E(18.6, 6.4, 1.1, 1, EYE); E(19.1, 6.5, 0.55, 0.65, PUPIL); }
    else { P.set(18 * k, 6 * k, EYE); P.set(19 * k, 6 * k, PUPIL); }
    P.set(22.3 * k, 6.8 * k, MOUTH);
    return P;
}

function dragonMats(pal) {
    return [
        { ramp: pal.body }, { ramp: pal.belly }, { ramp: pal.wing }, { ramp: [pal.bone, pal.bone, pal.bone], flat: true },
        { ramp: pal.horn }, { ramp: ['#fff', '#fff', '#fff'], flat: true }, { ramp: [pal.pupil, pal.pupil, pal.pupil], flat: true },
        { ramp: ['#400010', '#a00020', '#a00020'], flat: true }, { ramp: ['#fff', '#fff', '#fff'], flat: true }, { ramp: pal.spike },
    ];
}

/** Frames: walk A, walk B, bite. Each frame = { img, glow, white }. */
export function bakeDragon(kind, size = 24) {
    const pal = DRAGON_PAL[kind];
    const frames = [{ wing: 0, step: 0 }, { wing: 1, step: 1 }, { wing: 0, step: 0, mouth: 1 }].map((f) => {
        const img = renderPix(dragonPix(size, f), dragonMats(pal), pal.out);
        return { img, glow: bakeGlow(img, pal.glow, size > 30 ? 7 : 4, size > 30 ? 10 : 6), white: silhouette(img, '#ffffff') };
    });
    return { frames, pal, size };
}

// ------------------------------------------------------------------ the bat
export function bakeBat() {
    const out = [];
    for (const up of [true, false]) {
        const P = new Pix(16, 10);
        const wing = up ? [[[7, 5], [3, 0], [0, 3], [1, 6], [5, 7]], [[9, 5], [13, 0], [16, 3], [15, 6], [11, 7]]]
            : [[[7, 4], [2, 6], [0, 9], [3, 8], [6, 7]], [[9, 4], [14, 6], [16, 9], [13, 8], [10, 7]]];
        for (const w of wing) P.poly(w, 1);
        P.ellipse(8, 5.2, 2.6, 2.8, 0);
        P.set(6.4, 2, 0); P.set(9.6, 2, 0); P.set(6.4, 1, 0); P.set(9.6, 1, 0);
        P.set(7, 4.6, 2); P.set(9, 4.6, 2);
        const img = renderPix(P, [{ ramp: ['#300848', '#7a2ab8', '#c08af0'] }, { ramp: ['#08402c', '#14a070', '#5cf0b0'] }, { ramp: ['#ff2050', '#ff2050', '#ff2050'], flat: true }], '#0c0214');
        out.push({ img, glow: bakeGlow(img, '#40ffb0', 4, 6), white: silhouette(img) });
    }
    return out;
}

// ------------------------------------------------------------------ items
const PAL = {
    k: '#08040c', w: '#ffffff', c: '#29e6ff', C: '#0a7ea8', g: '#ffd23a', G: '#a8740a', y: '#fff27a', r: '#ff2a50', R: '#8a0a26',
    p: '#ff5ad2', P: '#8a1a74', b: '#3a6aff', m: '#ff2ece', o: '#ff8a1a', n: '#3aff7a', N: '#0a8a3a', s: '#c8d4e8', S: '#6a768c',
    d: '#3a3a4a', D: '#1c1c26', v: '#a46aff', l: '#e8f0ff', x: '#7a8090',
};

export const KEY_HUE = { gold: ['#ffd23a', '#a8740a'], onyx: ['#5a6070', '#20222c'], pearl: ['#f4f0ff', '#a8a0c8'], neon: ['#3affd0', '#0a9070'], violet: ['#b070ff', '#5a20a8'], chrome: ['#e0eaff', '#8090b0'], sunset: ['#ff7a5a', '#a02a4a'] };

const GRIDS = {
    sword: [
        '..gg........',
        '.kgGk.......',
        'kddgGcwwwwww',
        'kddgGcllllll',
        '.kgGk.......',
        '..gg........',
    ],
    key: [
        '.KKK........',
        'KH.HK.......',
        'K...KKKKKKKK',
        'KH.HKHHHKHKH',
        '.KKK....K.K.',
        '............',
    ],
    chalice: [
        'KKKKKKKK',
        'KwHHHHHK',
        '.KHHHHK.',
        '.KKHHKK.',
        '..KKKK..',
        '...KK...',
        '...KK...',
        '..KKKK..',
        '.KKHHKK.',
        'KKKKKKKK',
    ],
    magnet: [
        'ss....ss',
        'SS....SS',
        'rr....rr',
        'rr....rr',
        'rrR..Rrr',
        'rRRrrRRr',
        '.rrrrrr.',
        '..RRRR..',
    ],
    lamp: [
        '...dd...',
        '..d..d..',
        '.dddddd.',
        'dyyyyyyd',
        'dywwyyyd',
        'dywwyyyd',
        'dyyyyyyd',
        'dyyyyyyd',
        '.dddddd.',
        '..dddd..',
    ],
    shield: [
        'cccccccc',
        'clwccwlc',
        'clccccCc',
        'ccwwwwCc',
        'cccwwcCc',
        '.ccccCc.',
        '.cccCCc.',
        '..ccCc..',
        '...cc...',
        '........',
    ],
    charge: [
        '..ssss..',
        '.sRrrRs.',
        'sRrrrrRs',
        'sryrrrRs',
        'srrrrrRs',
        'sRrrrRRs',
        '.sRRRRs.',
        '..ssss..',
    ],
    pixel: ['xx', 'xx'],
    gem: [
        '..cc..',
        '.cwcc.',
        'cwcccC',
        'ccccCC',
        '.cCCC.',
        '..CC..',
    ],
    biggem: [
        '...pp...',
        '..pwpp..',
        '.pwpppp.',
        'pwppppPp',
        'pppppPPp',
        '.ppPPPP.',
        '..pPPP..',
        '...PP...',
    ],
    battery: [
        '..ss..',
        'nnnnnn',
        'nwnnnN',
        'nwnnnN',
        'nnnnnN',
        'NNnnnN',
        'nnnnNN',
        'NNNNNN',
    ],
    oneup: [
        'cccccccc',
        'cwwwwwwc',
        'cwkwwkwc',
        'cwwwwwwc',
        'cwkkkkwc',
        'cwwwwwwc',
        'cccccccc',
        '........',
    ],
    cassette: [
        'kkkkkkkkkk',
        'kppppppppk',
        'kpwwwwwwpk',
        'kpwkwwkwpk',
        'kpwwwwwwpk',
        'kppkkkkppk',
        'kkkkkkkkkk',
    ],
    shard: [
        '..w...',
        '.wsl..',
        '.wssl.',
        'wsslls',
        'sslSs.',
        '.sSS..',
        '..S...',
        '......',
    ],
};

export function bakeItem(kind, color) {
    const pal = { ...PAL };
    if (kind === 'key' || kind === 'chalice') {
        const [a, d] = KEY_HUE[color] || KEY_HUE.gold;
        pal.K = a; pal.H = d;
        if (kind === 'chalice') { pal.K = color || '#ffd23a'; pal.H = '#ffffff'; pal.w = '#ffffff'; }
    }
    const img = bakeGrid(GRIDS[kind], pal);
    return img;
}

/** Everything the renderer draws, baked once. */
export function bakeAll() {
    const A = { items: {}, keys: {}, chalice: [], glows: {}, dragons: {}, bat: bakeBat() };
    for (const k of ['sword', 'magnet', 'lamp', 'shield', 'charge', 'pixel', 'gem', 'biggem', 'battery', 'oneup', 'cassette', 'shard']) {
        A.items[k] = bakeItem(k);
    }
    for (const c of Object.keys(KEY_HUE)) A.keys[c] = bakeItem('key', c);
    // the chalice flashes through the palette
    for (const c of ['#ffd23a', '#ff8a1a', '#ff2a50', '#ff2ece', '#a46aff', '#3a6aff', '#29e6ff', '#3aff7a']) A.chalice.push(bakeItem('chalice', c));
    A.chromeChalice = bakeItem('chalice', '#e8f0ff');
    const glowCol = { sword: '#7af4ff', magnet: '#ff4060', lamp: '#fff27a', shield: '#29e6ff', charge: '#ff2a50', gem: '#29e6ff', biggem: '#ff5ad2', battery: '#3aff7a', oneup: '#29e6ff', cassette: '#ff5ad2', shard: '#e0eaff', pixel: '#9098a8' };
    for (const [k, col] of Object.entries(glowCol)) A.glows[k] = bakeGlow(A.items[k], col, 3, 5);
    for (const c of Object.keys(KEY_HUE)) A.glows['key:' + c] = bakeGlow(A.keys[c], KEY_HUE[c][0], 3, 5);
    A.glows.chalice = bakeGlow(A.chalice[0], '#fff0a0', 5, 7);
    for (const k of ['aurix', 'verdox', 'scarlax', 'cryovex', 'luma', 'nox']) A.dragons[k] = bakeDragon(k, 24);
    A.boss = bakeDragon('chrome', 40);
    A.bossDull = bakeDragon('dull', 40);
    return A;
}
