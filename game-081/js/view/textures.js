// Procedural textures, painted into canvases once and cached: a colour map, a normal map derived
// from the painted height, and a roughness map. No image files.

import * as THREE from 'three';

const cache = new Map();

function makeNoise(seed) {
    const P = new Uint8Array(512);
    let s = seed >>> 0;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const g = new Float32Array(256).map(() => r());
    // tileable value noise with a period in cells
    return (x, y, period = 256) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const w = (a, b) => g[P[(P[((a % period) + period) % period & 255] + (((b % period) + period) % period & 255)) & 511]];
        const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

function fbm(n, x, y, oct, period) {
    let a = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { a += n(x * f, y * f, period * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return a / norm;
}

/**
 * paint(x, y) → [r, g, b, height, rough] in 0..1 for each texel, given helpers.
 */
function build(key, size, paint, { repeat = 1, normalStrength = 2.5 } = {}) {
    if (cache.has(key)) return cache.get(key);
    const n = makeNoise(key.length * 977 + key.charCodeAt(0) * 13);
    const col = new Uint8ClampedArray(size * size * 4);
    const rough = new Uint8ClampedArray(size * size * 4);
    const hgt = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const [r, g, b, h, ro] = paint(x / size, y / size, n, size);
            const i = y * size + x;
            col[i * 4] = r * 255; col[i * 4 + 1] = g * 255; col[i * 4 + 2] = b * 255; col[i * 4 + 3] = 255;
            hgt[i] = h;
            rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = (ro ?? 0.8) * 255; rough[i * 4 + 3] = 255;
        }
    }
    const nrm = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const hx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)];
            const hy = hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x];
            let nx = -hx * normalStrength, ny = -hy * normalStrength, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            const i = (y * size + x) * 4;
            nrm[i] = (nx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-ny / l * 0.5 + 0.5) * 255; nrm[i + 2] = (nz / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
        }
    }
    const tex = (data, srgb) => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat, repeat);
        t.anisotropy = 4;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const out = { map: tex(col, true), normalMap: tex(nrm, false), roughnessMap: tex(rough, false) };
    cache.set(key, out);
    return out;
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Wooden planks: running boards with grain, seams and knots. */
export const planks = () => build('planks', 256, (u, v, n) => {
    const boards = 4;
    const bi = Math.floor(v * boards);
    const off = (bi * 0.37) % 1;
    const uu = (u + off) % 1;
    const seamU = Math.min(uu % 0.5, 0.5 - (uu % 0.5)) * 2;
    const seamV = Math.min((v * boards) % 1, 1 - ((v * boards) % 1));
    const grain = fbm(n, uu * 3, v * 40 + bi * 7, 3, 64);
    const ring = Math.sin((grain * 12 + uu * 6) * Math.PI) * 0.5 + 0.5;
    const shade = 0.75 + bi % 2 * 0.08 + ((bi * 53) % 7) * 0.02;
    let c = mix3([0.33, 0.19, 0.1], [0.55, 0.34, 0.18], ring * 0.6 + grain * 0.4);
    c = c.map((x) => x * shade);
    const seam = seamV < 0.04 || seamU < 0.012 ? 0.35 : 1;
    return [c[0] * seam, c[1] * seam, c[2] * seam, (seam < 1 ? 0 : 0.6 + ring * 0.2), 0.55 + grain * 0.3];
}, { repeat: 1, normalStrength: 3 });

/** Lime plaster: soft, blotchy, warm. */
export const plaster = () => build('plaster', 256, (u, v, n) => {
    const f = fbm(n, u * 8, v * 8, 5, 8);
    const c = mix3([0.66, 0.58, 0.47], [0.8, 0.72, 0.6], f);
    return [...c, f * 0.5, 0.92];
}, { normalStrength: 1.2 });

/** Flagstones with mortar: the crypt and the citadel (tinted by material colour). */
export const flags = () => build('flags', 256, (u, v, n) => {
    const s = 3;
    const jx = fbm(n, u * 4, v * 4, 2, 4) * 0.25;
    const gx = (u * s + jx) % 1, gy = (v * s + (Math.floor(u * s) % 2) * 0.5 + jx * 0.5) % 1;
    const edge = Math.min(gx, 1 - gx, gy, 1 - gy);
    const mortar = edge < 0.05;
    const f = fbm(n, u * 16, v * 16, 4, 16);
    const id = Math.floor(u * s) * 7 + Math.floor((v * s + (Math.floor(u * s) % 2) * 0.5));
    const tone = 0.75 + ((id * 37) % 11) / 40;
    const c = mortar ? [0.2, 0.19, 0.18] : [0.55 * tone + f * 0.15, 0.53 * tone + f * 0.14, 0.5 * tone + f * 0.12];
    return [...c, mortar ? 0 : 0.5 + f * 0.4 + Math.min(edge, 0.12) * 2, mortar ? 1 : 0.7 + f * 0.2];
}, { normalStrength: 4 });

/** Rough stone blocks for walls. */
export const blocks = () => build('blocks', 256, (u, v, n) => {
    const rows = 4;
    const ry = Math.floor(v * rows);
    const gx = (u * 2 + (ry % 2) * 0.5) % 1, gy = (v * rows) % 1;
    const edge = Math.min(gx * 2, (1 - gx) * 2, gy, 1 - gy);
    const f = fbm(n, u * 12, v * 12, 5, 12);
    const mortar = edge < 0.06;
    const tone = 0.8 + (((ry * 13 + Math.floor(u * 2 + (ry % 2) * 0.5) * 7) % 9) / 30);
    const c = mortar ? [0.16, 0.15, 0.14] : [0.5 * tone + f * 0.2, 0.48 * tone + f * 0.18, 0.46 * tone + f * 0.16];
    return [...c, mortar ? 0 : 0.4 + f * 0.6, 0.85];
}, { normalStrength: 5 });

/** Forest floor: moss, earth and leaf litter. */
export const moss = () => build('moss', 256, (u, v, n) => {
    const f = fbm(n, u * 6, v * 6, 5, 6);
    const g = fbm(n, u * 24 + 5, v * 24, 3, 24);
    const leaf = g > 0.62 ? 1 : 0;
    let c = mix3([0.18, 0.2, 0.08], [0.3, 0.42, 0.12], f);
    if (leaf) c = mix3(c, [0.45, 0.25, 0.08], 0.7);
    return [...c, f * 0.6 + g * 0.4, 0.95];
}, { normalStrength: 2 });

/** Mossy rock cliff. */
export const rock = () => build('rock', 256, (u, v, n) => {
    const f = fbm(n, u * 5, v * 9, 6, 5);
    const strata = Math.sin(v * 40 + f * 8) * 0.5 + 0.5;
    const mossy = clamp01((fbm(n, u * 4 + 3, v * 4, 3, 4) - 0.5) * 4);
    let c = mix3([0.26, 0.25, 0.24], [0.42, 0.4, 0.37], f * 0.7 + strata * 0.3);
    c = mix3(c, [0.2, 0.3, 0.1], mossy * 0.8);
    return [...c, f * 0.7 + strata * 0.3, 0.9];
}, { normalStrength: 5 });

/** Bark for tree trunks. */
export const bark = () => build('bark', 128, (u, v, n) => {
    const f = fbm(n, u * 12, v * 3, 4, 12);
    const ridge = Math.abs(Math.sin(u * 40 + f * 6));
    const c = mix3([0.12, 0.08, 0.05], [0.32, 0.22, 0.14], ridge * 0.7 + f * 0.3);
    return [...c, ridge, 0.95];
}, { normalStrength: 6 });

/** Basalt with glowing cracks (the forge). Colour only; emissive comes from a second map. */
export const basalt = () => build('basalt', 256, (u, v, n) => {
    const f = fbm(n, u * 6, v * 6, 5, 6);
    const crack = Math.abs(fbm(n, u * 3 + 7, v * 3, 4, 3) - 0.5);
    const c = mix3([0.07, 0.06, 0.06], [0.2, 0.17, 0.16], f);
    const glowc = crack < 0.012 ? 1 : crack < 0.02 ? 0.35 : 0;
    return glowc ? [0.9 * glowc + c[0] * (1 - glowc), 0.32 * glowc + c[1] * (1 - glowc), 0.04 * glowc + c[2] * (1 - glowc), 0, 0.4] : [...c, 0.3 + f * 0.7, 0.75];
}, { normalStrength: 5 });

/** Polished dark marble with veins (the citadel). */
export const marble = () => build('marble', 256, (u, v, n) => {
    const f = fbm(n, u * 4, v * 4, 6, 4);
    const vein = Math.abs(Math.sin((u + f * 1.5) * 18));
    let c = mix3([0.12, 0.1, 0.16], [0.24, 0.2, 0.3], f);
    if (vein < 0.05) c = mix3(c, [0.7, 0.62, 0.8], 0.6);
    return [...c, 0.5, 0.25 + f * 0.2];
}, { normalStrength: 0.6 });

/** A woven rug: a border and a diamond field. */
export const rug = () => build('rug', 128, (u, v, n) => {
    const d = Math.abs((u * 2) % 1 - 0.5) + Math.abs((v * 2) % 1 - 0.5);
    const d2 = Math.abs((u * 2 + 0.5) % 1 - 0.5) + Math.abs((v * 2 + 0.5) % 1 - 0.5);
    const weave = (Math.sin(u * 300) * Math.sin(v * 300)) * 0.5 + 0.5;
    let c = d < 0.22 ? [0.62, 0.16, 0.16] : d < 0.27 ? [0.85, 0.66, 0.3] : d2 < 0.12 ? [0.2, 0.32, 0.4] : [0.24, 0.1, 0.16];
    c = c.map((x) => x * (0.85 + weave * 0.2 + fbm(n, u * 8, v * 8, 2, 8) * 0.1));
    return [...c, weave * 0.3, 1];
}, { normalStrength: 1.5 });

/** Purple carpet with a gold edge pattern (the citadel's halls). */
export const carpet = () => build('carpet', 128, (u, v, n) => {
    const f = fbm(n, u * 16, v * 16, 3, 16);
    const c = mix3([0.22, 0.05, 0.25], [0.32, 0.08, 0.36], f);
    return [...c, f * 0.2, 1];
}, { normalStrength: 1 });

/** Ash and cinders (the forge floor). */
export const ash = () => build('ash', 256, (u, v, n) => {
    const f = fbm(n, u * 8, v * 8, 5, 8);
    const ember = fbm(n, u * 30 + 2, v * 30, 2, 30) > 0.78;
    const c = ember ? [0.6, 0.2, 0.04] : mix3([0.12, 0.1, 0.09], [0.28, 0.24, 0.22], f);
    return [...c, f, 0.95];
}, { normalStrength: 3 });

/** A material from a texture set, tinted. */
export function texMat(set, { color = 0xffffff, rough = 1, metal = 0, repeat = [1, 1], normalScale = 1, emissive = null, emissiveIntensity = 0, envIntensity = 0.6 } = {}) {
    const t = set();
    const clone = (tx) => { const c = tx.clone(); c.repeat.set(repeat[0], repeat[1]); c.needsUpdate = true; return c; };
    const m = new THREE.MeshStandardMaterial({
        color, roughness: rough, metalness: metal,
        map: clone(t.map), normalMap: clone(t.normalMap), roughnessMap: clone(t.roughnessMap),
        normalScale: new THREE.Vector2(normalScale, normalScale), envMapIntensity: envIntensity,
    });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveMap = m.map; m.emissiveIntensity = emissiveIntensity; }
    return m;
}

/** A soft round sprite texture (glows, particles). */
let glowTex = null;
export function glow() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
}
