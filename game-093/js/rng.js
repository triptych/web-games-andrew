// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.

/** mulberry32 with a saveable state. */
export function makeRng(seed) {
    let a = seed >>> 0;
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.chance = (p) => rng() < p;
    rng.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    rng.weighted = (items, wf = (x) => x.w ?? 1) => {
        let t = 0; for (const it of items) t += wf(it);
        let r = rng() * t;
        for (const it of items) { r -= wf(it); if (r <= 0) return it; }
        return items[items.length - 1];
    };
    rng.state = () => a;
    rng.setState = (s) => { a = s | 0; };
    return rng;
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

/** Smooth value noise on an integer lattice, seeded. Returns [0, 1). */
export function makeNoise(seed) {
    const n = (x, y) => hash3(x, y, seed);
    const sm = (t) => t * t * (3 - 2 * t);
    const get = (x, y) => {
        const x0 = Math.floor(x), y0 = Math.floor(y), tx = sm(x - x0), ty = sm(y - y0);
        const a = n(x0, y0), b = n(x0 + 1, y0), c = n(x0, y0 + 1), d = n(x0 + 1, y0 + 1);
        return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
    };
    get.fbm = (x, y, oct = 4, scale = 0.05) => {
        let amp = 1, f = scale, sum = 0, norm = 0;
        for (let o = 0; o < oct; o++) { sum += get(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
        return sum / norm;
    };
    return get;
}
