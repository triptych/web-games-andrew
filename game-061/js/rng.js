// Deterministic randomness. Everything in the universe derives from one seed string:
// hashStr(seed) → galaxy RNG; sub(seed, 'system', id) → that system's RNG; and so on.
// Never use Math.random in js/sim — a test greps for it.

export function hashStr(s) {
    let h = 0x811c9dc5;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// Combine a base hash with any number of keys (numbers or strings).
export function sub(base, ...keys) {
    let h = base >>> 0;
    for (const k of keys) {
        const kh = typeof k === 'number' ? (k * 2654435761) >>> 0 : hashStr(k);
        h = Math.imul(h ^ kh, 0x85ebca6b) >>> 0;
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35) >>> 0;
        h ^= h >>> 16;
    }
    return h >>> 0;
}

// sfc32: fast, good-quality, 128 bits of state.
export class RNG {
    constructor(seed = 1) {
        this.a = 0x9e3779b9; this.b = 0x243f6a88; this.c = 0xb7e15162; this.d = seed >>> 0;
        for (let i = 0; i < 12; i++) this.next();
    }
    next() {
        let { a, b, c, d } = this;
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        const t = (a + b | 0) + d | 0;
        d = d + 1 | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = c << 21 | c >>> 11;
        c = c + t | 0;
        this.a = a; this.b = b; this.c = c; this.d = d;
        return (t >>> 0) / 4294967296;
    }
    range(lo, hi) { return lo + (hi - lo) * this.next(); }
    int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    gauss() { // approx normal(0,1)
        return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732;
    }
    weighted(items, weightOf) {
        let total = 0;
        for (const it of items) total += weightOf(it);
        let r = this.next() * total;
        for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
        return items[items.length - 1];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    get state() { return [this.a, this.b, this.c, this.d]; }
    set state(s) { [this.a, this.b, this.c, this.d] = s; }
}

export const rngFor = (base, ...keys) => new RNG(sub(base, ...keys));

const SEED_WORDS = ['ORION', 'VEGA', 'LYRA', 'DRACO', 'HYDRA', 'CYGNUS', 'TAURI', 'NOVA', 'ATLAS', 'KESTREL', 'EMBER', 'RIFT', 'HALO', 'CINDER', 'AZURE', 'TALON', 'QUILL', 'MARROW', 'SABLE', 'ZENITH'];
// Only the UI calls this (with Math.random); the sim never invents seeds.
export function randomSeedText(rand = Math.random) {
    return `${SEED_WORDS[Math.floor(rand() * SEED_WORDS.length)]}-${Math.floor(rand() * 900 + 100)}`;
}
