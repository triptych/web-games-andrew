// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same world.

/** mulberry32 — small, fast, good enough for level generation. */
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

/** 2D value noise from hash3, smooth-stepped. */
export function vnoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash3(x0, y0, seed), b = hash3(x0 + 1, y0, seed);
    const c = hash3(x0, y0 + 1, seed), d = hash3(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

export function fbm(x, y, seed, oct = 3) {
    let s = 0, amp = 1, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
    return s / n;
}
