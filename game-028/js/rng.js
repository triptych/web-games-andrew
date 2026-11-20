// Seeded randomness (mulberry32). The sim's only source of chance; its state is a single number, so it saves.

export function makeRng(seed) {
    return { s: seed >>> 0 };
}

export function next(r) {
    r.s = (r.s + 0x6d2b79f5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const chance = (r, p) => next(r) < p;
export const int = (r, n) => Math.floor(next(r) * n);
export const pick = (r, arr) => arr[int(r, arr.length)];

export function pickWeighted(r, items, weight) {
    let total = 0;
    for (const it of items) total += weight(it);
    let x = next(r) * total;
    for (const it of items) { x -= weight(it); if (x < 0) return it; }
    return items[items.length - 1];
}

/** A stable 32-bit hash of a string (voice-line keys, seeds from names). */
export function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
