/**
 * Seeded pseudo-random number generator.
 * Small-fast-counter (sfc32) seeded through a string hash, so a run seed like
 * "WAKE-4417" always regenerates the same palette, playfield and sprites.
 */

export function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

export function makeRng(seed) {
    const s = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
    let a = s ^ 0x9e3779b9;
    let b = s ^ 0x85ebca6b;
    let c = s ^ 0xc2b2ae35;
    let d = s ^ 0x27d4eb2f;

    const next = () => {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        let t = (a + b) >>> 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) >>> 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) >>> 0;
        d = (d + 1) >>> 0;
        t = (t + d) >>> 0;
        return t >>> 0;
    };

    const rng = () => next() / 4294967296;
    rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
    rng.range = (min, max) => min + rng() * (max - min);
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.sign = () => (rng() < 0.5 ? -1 : 1);
    rng.shuffle = (arr) => {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };
    return rng;
}

/** Human-typeable run seed, e.g. "WAKE-7Q2F". */
export function newSeedString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return 'WAKE-' + s;
}
