// lib/core/rng.js — seeded randomness and stateless hashes. Pure: safe in js/sim/ and in Node.
//
// The same mulberry32 that the scaffold has copied into ~100 games, so a game that switches to
// this file keeps its exact random sequence (and its old saves, whose rngState still applies).
// Games 126–135 hash the seed first so that seeds 1, 2, 3 don't start alike: pass
// { hashSeed: true } to get their sequence. New games should prefer it.
//
//   import { makeRng, hash3 } from '../../lib/core/rng.js';

/** Scramble a seed so nearby seeds give unrelated sequences (games 126–135). */
export function hashSeed(seed) {
    let h = (seed | 0) ^ 0x9E3779B9;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) | 0;
}

/** mulberry32 with a saveable state. rng() → [0, 1). */
export function makeRng(seed, { hashSeed: hashed = false } = {}) {
    let a = hashed ? hashSeed(seed) : seed >>> 0;
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    /** Integer in [lo, hi], both ends included. */
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.chance = (p) => rng() < p;
    rng.state = () => a;
    rng.setState = (s) => { a = s | 0; };
    return rng;
}

/** Integer hash of up to three numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** A 31-bit seed derived from a parent seed and up to two numbers (a floor, a chunk, a wave). */
export const childSeed = (seed, a = 0, b = 0) => (hash3(seed, a, b) * 2147483647) | 0;

/** String → unsigned 32-bit int, FNV-1a (the variant 25 games use for seed phrases and ids). */
export function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** String → unsigned 32-bit int with better avalanche than FNV (games 124 and 125 call this hashStr). */
export function cyrb32(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

/** Fisher–Yates with a seeded rng; returns a new array and leaves the input alone. */
export function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Pick a key from { key: weight }. Weights need not sum to 1. */
export function weighted(rng, table) {
    let total = 0;
    for (const k in table) total += table[k];
    let r = rng() * total;
    for (const k in table) { r -= table[k]; if (r < 0) return k; }
    return Object.keys(table).pop();
}

/** Pick an item from a list, weighting each by weightOf(item). */
export function weightedItem(rng, items, weightOf) {
    let total = 0;
    for (const it of items) total += Math.max(0, weightOf(it));
    let r = rng() * total;
    for (const it of items) { r -= Math.max(0, weightOf(it)); if (r < 0) return it; }
    return items[items.length - 1];
}
