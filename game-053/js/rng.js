// Seeded RNG (mulberry32) plus the small random helpers the whole game uses.
// Game logic uses `R` (a module-level stream that is re-seeded from the save),
// so a world behaves the same way when replayed from the same save.

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

let stream = mulberry32(Date.now() & 0xffffffff);
export const R = {
    seed(n) { stream = mulberry32(n >>> 0); },
    f: () => stream(),
    /** integer in [a, b] inclusive */
    i: (a, b) => a + Math.floor(stream() * (b - a + 1)),
    chance: (p) => stream() < p,
    pick: (arr) => arr[Math.floor(stream() * arr.length)],
    /** LoGD's bell_rand: a roughly normal value in [a, b] */
    bell(a, b) {
        if (b <= a) return a;
        const v = (stream() + stream() + stream()) / 3;
        return a + v * (b - a);
    },
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(stream() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
        return arr;
    },
    weighted(items, w) {
        let tot = 0;
        for (const it of items) tot += w(it);
        let r = stream() * tot;
        for (const it of items) { r -= w(it); if (r <= 0) return it; }
        return items[items.length - 1];
    },
    /** returns a 32-bit int for seeding sub-streams */
    int32: () => Math.floor(stream() * 4294967296) >>> 0,
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export function plural(n, one, many = one + 's') { return `${fmt(n)} ${n === 1 ? one : many}`; }
