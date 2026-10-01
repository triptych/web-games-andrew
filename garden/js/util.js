// Small math, randomness and noise helpers shared by every garden module.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
/** Shortest signed difference between two angles. */
export const angleDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
};

/** Deterministic 32-bit hash of a string. */
export function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** mulberry32 seeded RNG with a few helpers. */
export function rng(seed) {
    let s = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
    const next = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (a, b) => a + (b - a) * next();
    next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.sign = () => (next() < 0.5 ? -1 : 1);
    return next;
}

// ---------------------------------------------------------------- value noise

const PERM = new Uint8Array(512);
{
    const r = rng(1337);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const GRAD = new Float32Array(256);
for (let i = 0; i < 256; i++) GRAD[i] = (PERM[i] / 255) * 2 - 1;

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise in [-1, 1]. */
export function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = GRAD[PERM[X + PERM[Y]]];
    const b = GRAD[PERM[X + 1 + PERM[Y]]];
    const c = GRAD[PERM[X + PERM[Y + 1]]];
    const d = GRAD[PERM[X + 1 + PERM[Y + 1]]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Fractal sum of noise2, roughly in [-1, 1]. */
export function fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * noise2(x * freq + i * 17.3, y * freq - i * 9.1);
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / norm;
}

/** Ridged multifractal, in [0, 1]. Good for rocky ridges and marble veins. */
export function ridged2(x, y, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(noise2(x * freq + i * 31.7, y * freq + i * 4.3));
        sum += amp * n * n;
        norm += amp;
        amp *= 0.5;
        freq *= 2.1;
    }
    return sum / norm;
}

/** Tileable 2D noise for textures: blends four offset samples over a period. */
export function tileNoise(x, y, period, octaves = 4) {
    const fx = x / period, fy = y / period;
    const a = fbm2(x, y, octaves);
    const b = fbm2(x - period, y, octaves);
    const c = fbm2(x, y - period, octaves);
    const d = fbm2(x - period, y - period, octaves);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** Yield to the browser so the loading screen can repaint. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Escape text for safe insertion into HTML. */
export function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Trim a long description to roughly `n` characters on a word boundary. */
export function excerpt(text, n = 220) {
    if (text.length <= n) return text;
    const cut = text.slice(0, n);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[,;:\s—-]+$/, '') + '…';
}

/** Safe localStorage wrappers (private windows and blocked storage throw). */
export const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem('garden.' + key);
            return v === null ? fallback : JSON.parse(v);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem('garden.' + key, JSON.stringify(value));
        } catch {
            /* storage unavailable */
        }
    },
};
