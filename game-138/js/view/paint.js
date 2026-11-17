// The texture painter: pure JavaScript, no three.js and no DOM, so it runs in a Web Worker (paint-worker.js) as well
// as on the main thread. Each painter is a function of (u, v) in [0, 1) returning [r, g, b, height] (0–255 colour,
// 0–1 height, 1 = the top of the surface). Every texture tiles and spans 2 m of wall or floor.

// ------------------------------------------------------------------ periodic noise
function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a, n) => ((a % n) + n) % n;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Value noise on a lattice of P cells across the texture, so it tiles. */
function vnoise(u, v, P, s) {
    const x = u * P, y = v * P, x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = smooth(x - x0), ty = smooth(y - y0);
    const a = hash(mod(x0, P), mod(y0, P), s), b = hash(mod(x0 + 1, P), mod(y0, P), s);
    const c = hash(mod(x0, P), mod(y0 + 1, P), s), d = hash(mod(x0 + 1, P), mod(y0 + 1, P), s);
    return mix(mix(a, b, tx), mix(c, d, tx), ty);
}
function fbm(u, v, P, s, oct = 4) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) { sum += vnoise(u, v, P << o, s + o * 17) * amp; norm += amp; amp *= 0.5; }
    return sum / norm;
}
/** Worley noise, periodic: { d1, d2, id, cx, cy } (distances in cell units). */
function voronoi(u, v, P, s, jit = 0.8) {
    const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y);
    let d1 = 9, d2 = 9, id = 0, cx = 0, cy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = xi + i, gy = yi + j, hx = mod(gx, P), hy = mod(gy, P);
        const px = gx + 0.5 + (hash(hx, hy, s) - 0.5) * jit, py = gy + 0.5 + (hash(hx, hy, s + 7) - 0.5) * jit;
        const d = Math.hypot(px - x, py - y);
        if (d < d1) { d2 = d1; d1 = d; id = hx * 131 + hy; cx = px - x; cy = py - y; } else if (d < d2) d2 = d;
    }
    return { d1, d2, id, cx, cy };
}
/** A bond of bricks/blocks: rows × cols per texture, odd rows shifted by `offset`. edge: distance to the nearest joint. */
function bond(u, v, rows, cols, offset = 0.5) {
    const ry = v * rows, row = Math.floor(ry);
    const rx = u * cols + (row % 2) * offset, col = Math.floor(rx);
    const fx = rx - col, fy = ry - row;
    const ex = Math.min(fx, 1 - fx) * (rows / cols), ey = Math.min(fy, 1 - fy);
    return { id: mod(col, cols) * 97 + row, edge: Math.min(ex, ey), fx, fy };
}

// ------------------------------------------------------------------ painters
const P = {
    blocks(u, v, o) {
        const b = bond(u, v, 4, 2);
        const n = fbm(u, v, 8, 3), j = hash(b.id, 1, 5);
        const mort = smooth(clamp01((b.edge - 0.035) / 0.06));
        const h = 0.25 + mort * (0.6 + n * 0.25) - (1 - smooth(clamp01(b.edge / 0.16))) * 0.08;
        const c = mixc(o.mortar || [92, 84, 76], tint(o.base || [160, 150, 136], 0.78 + j * 0.32 + (n - 0.5) * 0.35), mort);
        return [...c, h];
    },
    flags(u, v, o) {
        const w = voronoi(u, v, 4, 11, 0.85);
        const n = fbm(u, v, 8, 13), j = hash(w.id, 3, 9);
        const g = smooth(clamp01((w.d2 - w.d1 - 0.04) / 0.1));
        const c = mixc(o.grout || [70, 64, 58], tint(o.base || [150, 140, 128], 0.75 + j * 0.4 + (n - 0.5) * 0.3), g);
        return [...c, 0.2 + g * (0.65 + (n - 0.5) * 0.3)];
    },
    planks(u, v, o) {
        const cols = 4, x = u * cols, col = Math.floor(x), fx = x - col;
        const j = hash(col, 2, 4);
        const grain = fbm(u, v, 2, 21 + col, 4);
        const streak = Math.sin((v * 22 + grain * 9 + j * 6) * Math.PI) * 0.5 + 0.5;
        const gap = smooth(clamp01(Math.min(fx, 1 - fx) / 0.05));
        const nail = [0.1, 0.9].some((ny) => Math.hypot((fx - 0.5) * 0.5, v - ny) < 0.018) ? 1 : 0;
        let c = mixc([48, 30, 18], tint(o.base || [150, 98, 58], 0.78 + j * 0.3 + (streak - 0.5) * 0.18 + (grain - 0.5) * 0.2), gap);
        if (nail) c = [70, 66, 62];
        return [...c, 0.15 + gap * (0.75 + streak * 0.1) - nail * 0.15];
    },
    boards(u, v, o) {
        const rows = 4, y = v * rows, row = Math.floor(y), fy = y - row;
        const x = u + hash(row, 5, 6), seg = Math.floor(x), fx = x - seg;
        const j = hash(row * 13 + mod(seg, 1), 7, 8);
        const grain = fbm(u, v, 2, 31 + row, 4);
        const streak = Math.sin((u * 26 + grain * 8 + j * 5) * Math.PI) * 0.5 + 0.5;
        const gap = smooth(clamp01(Math.min(Math.min(fy, 1 - fy) * 2.5, Math.min(fx, 1 - fx) * 10) / 0.09));
        const c = mixc([52, 32, 20], tint(o.base || [168, 112, 66], 0.75 + j * 0.32 + (streak - 0.5) * 0.16 + (grain - 0.5) * 0.25), gap);
        return [...c, 0.15 + gap * (0.78 + streak * 0.07)];
    },
    bricks(u, v, o) {
        const b = bond(u, v, 8, 4);
        const n = fbm(u, v, 16, 41), j = hash(b.id, 4, 2);
        const mort = smooth(clamp01((b.edge - 0.05) / 0.07));
        let c = tint(o.base || [168, 78, 52], 0.72 + j * 0.4 + (n - 0.5) * 0.35);
        if (hash(b.id, 9, 9) > 0.86) c = tint(c, 0.7);
        return [...mixc(o.mortar || [196, 182, 160], c, mort), 0.3 + mort * (0.6 + n * 0.1)];
    },
    terracotta(u, v, o) {
        const b = bond(u, v, 4, 4, 0);
        const n = fbm(u, v, 8, 51), j = hash(b.id, 6, 1);
        const g = smooth(clamp01((b.edge - 0.03) / 0.05));
        const ring = Math.abs(Math.hypot(b.fx - 0.5, b.fy - 0.5) - 0.3) < 0.02 ? 0.88 : 1;
        const c = mixc([214, 196, 168], tint(o.base || [196, 112, 70], (0.8 + j * 0.25 + (n - 0.5) * 0.3) * ring), g);
        return [...c, 0.3 + g * 0.65];
    },
    rock(u, v, o) {
        const n = fbm(u, v, 4, 61, 5);
        const r = 1 - Math.abs(fbm(u, v, 3, 67, 4) * 2 - 1);
        const w = voronoi(u, v, 3, 71, 1);
        const crack = smooth(clamp01((w.d2 - w.d1) / 0.08));
        const h = clamp01(0.25 + n * 0.55 + r * 0.25) * (0.55 + crack * 0.45);
        return [...tint(o.base || [122, 112, 102], 0.6 + h * 0.6 + (hash(w.id, 1, 1) - 0.5) * 0.15), h];
    },
    pebbles(u, v, o) {
        const w = voronoi(u, v, 9, 81, 0.9);
        const bump = clamp01(1 - w.d1 / 0.55);
        const n = fbm(u, v, 16, 83, 3), j = hash(w.id, 8, 3);
        const c = mixc(o.grit || [80, 70, 60], tint(o.base || [138, 128, 116], 0.6 + j * 0.55), smooth(clamp01(bump * 2.5)));
        return [...c, clamp01(0.15 + Math.sqrt(bump) * 0.8 + (n - 0.5) * 0.1)];
    },
    crystal(u, v, o) {
        const w = voronoi(u, v, 5, 91, 0.9);
        const j = hash(w.id, 5, 5), k = hash(w.id, 6, 6);
        const facet = 0.55 + (w.cx * (j - 0.5) + w.cy * (k - 0.5)) * 0.9;
        const edge = smooth(clamp01((w.d2 - w.d1) / 0.06));
        const c = mixc(o.vein || [214, 170, 255], tint(o.base || [92, 62, 140], 0.6 + facet * 0.6 + j * 0.2), edge);
        return [...c, clamp01(0.2 + edge * facet * 0.8)];
    },
    glass(u, v, o) {
        const b = bond(u, v, 3, 3, 0.33);
        const w = voronoi(u, v, 6, 95, 1);
        const vein = 1 - smooth(clamp01((w.d2 - w.d1) / 0.035));
        const g = smooth(clamp01((b.edge - 0.03) / 0.05));
        const c = mixc([30, 20, 50], mixc(tint(o.base || [70, 50, 110], 0.8 + hash(b.id, 2, 7) * 0.35), [200, 160, 255], vein * 0.55), g);
        return [...c, 0.3 + g * 0.65];
    },
    ice(u, v, o) {
        const b = bond(u, v, 3, 2);
        const w = voronoi(u, v, 5, 97, 1);
        const crack = 1 - smooth(clamp01((w.d2 - w.d1) / 0.03));
        const n = fbm(u, v, 8, 99);
        const g = smooth(clamp01((b.edge - 0.03) / 0.07));
        const c = mixc([96, 130, 160], mixc(tint(o.base || [178, 214, 236], 0.85 + n * 0.25), [240, 252, 255], crack * 0.6), g);
        return [...c, 0.3 + g * (0.6 - crack * 0.1)];
    },
    snow(u, v) {
        const n = fbm(u, v, 6, 101, 5);
        const sparkle = hash(Math.floor(u * 512), Math.floor(v * 512), 7) > 0.995 ? 30 : 0;
        return [196 + n * 22 + sparkle, 206 + n * 20 + sparkle, 222 + n * 10 + sparkle, 0.35 + n * 0.5];
    },
    turf(u, v, o) {
        const n = fbm(u, v, 6, 111, 5);
        const blade = hash(Math.floor(u * 256), Math.floor(v * 256), 3);
        const fl = voronoi(u, v, 10, 113, 1);
        let c = tint(o.base || [96, 140, 70], 0.7 + n * 0.5 + (blade - 0.5) * 0.25);
        if (o.flowers && fl.d1 < 0.06 && hash(fl.id, 1, 2) > 0.7) c = hash(fl.id, 2, 3) > 0.5 ? [250, 230, 140] : [240, 190, 210];
        return [...c, 0.3 + n * 0.5 + blade * 0.15];
    },
    strata(u, v) {
        const band = v * 7 + fbm(u, v, 4, 121) * 1.6, k = Math.floor(band);
        const cols = [[110, 80, 56], [132, 96, 64], [96, 72, 54], [150, 116, 80], [88, 66, 50], [124, 92, 66], [104, 82, 62]];
        const w = voronoi(u, v, 14, 123, 1);
        const stone = w.d1 < 0.3 && hash(w.id, 4, 4) > 0.75;
        const c = stone ? tint([150, 144, 136], 0.8 + hash(w.id, 5, 5) * 0.3) : tint(cols[mod(k, cols.length)], 0.85 + fbm(u, v, 16, 125) * 0.3);
        return [...c, stone ? 0.8 : 0.4 + (band - k) * 0.2];
    },
};

/** Material recipes: a painter and its options. */
export const RECIPES = {
    planks:     ['planks', { base: [150, 100, 60] }],
    boards:     ['boards', { base: [170, 116, 70] }],
    roots:      ['planks', { base: [110, 80, 52] }],
    blocks:     ['blocks', { base: [168, 158, 142] }],
    flags:      ['flags', { base: [158, 150, 138] }],
    bricks:     ['bricks', {}],
    terracotta: ['terracotta', {}],
    rock:       ['rock', { base: [132, 118, 104] }],
    pebbles:    ['pebbles', {}],
    mossblocks: ['blocks', { base: [146, 150, 132], moss: true }],
    mossflags:  ['flags', { base: [140, 142, 124], moss: true }],
    crystal:    ['crystal', {}],
    glass:      ['glass', {}],
    ice:        ['ice', {}],
    snow:       ['snow', {}],
    turf:       ['turf', { base: [104, 150, 74], flowers: true }],
    moss:       ['turf', { base: [84, 124, 66], flowers: true }],
    slate:      ['rock', { base: [96, 92, 96] }],
    soil:       ['pebbles', { base: [120, 86, 60], grit: [80, 56, 40] }],
    darkrock:   ['rock', { base: [92, 84, 80] }],
    amethyst:   ['crystal', { base: [70, 46, 110] }],
    snowcap:    ['snow', {}],
    strata:     ['strata', {}],
};

/** Paint a recipe into plain arrays (no three.js): { albedo: Uint8Array RGBA, height: Float32Array }. */
export function paint(name, size) {
    const [painter, opts] = RECIPES[name] || RECIPES.rock;
    const fn = P[painter];
    const n = size * size;
    const albedo = new Uint8Array(n * 4), height = new Float32Array(n);
    for (let y = 0; y < size; y++) {
        const v = (y + 0.5) / size;
        for (let x = 0; x < size; x++) {
            const u = (x + 0.5) / size;
            let [r, g, b, h] = fn(u, v, opts);
            if (opts.moss) {
                // moss gathers in the low places and in big soft patches
                const m = fbm(u, v, 4, 131, 4);
                const amt = clamp01((m - 0.5) * 4 + (0.5 - h) * 2.2) * 0.85;
                r = mix(r, 78 + m * 40, amt); g = mix(g, 120 + m * 50, amt); b = mix(b, 58, amt);
                h = Math.max(h, amt * 0.6);
            }
            const i = y * size + x;
            albedo[i * 4] = r; albedo[i * 4 + 1] = g; albedo[i * 4 + 2] = b; albedo[i * 4 + 3] = 255;
            height[i] = clamp01(h);
        }
    }
    return { albedo, height };
}

/**
 * Everything a material needs, as RGBA byte arrays ready for a DataTexture: the albedo, the normal map (from the
 * height, by central differences that wrap) and the height map (grey).
 */
export function bake(name, size) {
    const { albedo, height } = paint(name, size);
    const n = size * size;
    const normal = new Uint8Array(n * 4), hgt = new Uint8Array(n * 4);
    const k = size / 64;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            const hl = height[y * size + mod(x - 1, size)], hr = height[y * size + mod(x + 1, size)];
            const hu = height[mod(y - 1, size) * size + x], hd = height[mod(y + 1, size) * size + x];
            // row y holds v = (y + 0.5) / size (a DataTexture is not flipped), so the slope along v is hd - hu
            const nx = (hl - hr) * k, ny = (hu - hd) * k, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            normal[i * 4] = (nx / l * 0.5 + 0.5) * 255; normal[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
            normal[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; normal[i * 4 + 3] = 255;
            const hv = height[i] * 255;
            hgt[i * 4] = hv; hgt[i * 4 + 1] = hv; hgt[i * 4 + 2] = hv; hgt[i * 4 + 3] = 255;
        }
    }
    return { albedo, normal, hgt };
}

export { fbm, voronoi, hash };
