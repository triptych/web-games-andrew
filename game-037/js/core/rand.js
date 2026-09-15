// ============================================================
// core/rand.js - hash and RNG primitives (GDD §6)
// Every number the world is made of comes from here.
// No Math.random(), ever.
// ============================================================

/** @pure string -> a generator of 32-bit seed words. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** @pure Small Fast Counter PRNG. Four words of state, trivially serializable. */
export function sfc32(a, b, c, d) {
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  return function rng() {
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** @pure Mix the master seed plus a list of integers into one 32-bit word. */
export function hashInts(words, ...ints) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ words[i], 16777619);
  }
  for (let i = 0; i < ints.length; i++) {
    let x = ints[i] | 0;
    x = Math.imul(x ^ (x >>> 16), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    h = Math.imul(h ^ (x ^ (x >>> 16)), 16777619);
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

const DOMAIN_CACHE = new Map();
/** @pure Domain string -> stable integer. Cache is pure (keyed by the string). */
export function domainId(domain) {
  let v = DOMAIN_CACHE.get(domain);
  if (v === undefined) { v = xmur3(domain)(); DOMAIN_CACHE.set(domain, v); }
  return v;
}

const STR_CACHE = new Map();
/** @pure Any string -> stable integer, for use as a coordinate. */
export function hashStr(s) {
  let v = STR_CACHE.get(s);
  if (v === undefined) {
    v = xmur3(String(s))();
    if (STR_CACHE.size > 4096) STR_CACHE.clear();
    STR_CACHE.set(s, v);
  }
  return v;
}

/**
 * The only sanctioned way to consume randomness. Generators receive one of
 * these, never a raw function, so every draw is accounted for.
 */
export class RNG {
  constructor(a, b, c, d) {
    this.seedWords = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    this._next = sfc32(a, b, c, d);
    this.calls = 0;
  }

  /** Uniform float in [0,1). */
  next() { this.calls++; return this._next(); }
  /** Uniform float in [min,max). */
  float(min, max) { return min + this.next() * (max - min); }
  /** Uniform integer in [min,max] inclusive. */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  /** True with probability p. */
  chance(p) { return this.next() < p; }
  /** Uniform element. */
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  /** Weighted element; `weights` parallel to `arr`, non-negative. */
  weighted(arr, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  /** Weighted element from an object of {key: weight}. Key order is source order. */
  weightedKey(table) {
    const keys = Object.keys(table);
    return this.weighted(keys, keys.map(k => table[k]));
  }

  /** In-place Fisher-Yates. Returns the same array. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** n distinct elements, order shuffled. */
  sample(arr, n) {
    return this.shuffle(arr.slice()).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  /** Sum of k uniform rolls in [min,max] - bell-shaped. */
  dice(k, min, max) { let s = 0; for (let i = 0; i < k; i++) s += this.int(min, max); return s; }

  /** Approximately normal, clamped to +/-3 sigma. */
  gaussian(mean, sd) {
    const u = 1 - this.next(), v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * Math.max(-3, Math.min(3, z));
  }

  /** Serializable state, for the runtime streams that live in the save. */
  save() { return { a: this.seedWords[0], b: this.seedWords[1], c: this.seedWords[2], d: this.seedWords[3], calls: this.calls }; }

  /** Restore a stream by replaying its call count. */
  static restore(s) {
    const r = new RNG(s.a, s.b, s.c, s.d);
    for (let i = 0; i < s.calls; i++) r.next();
    return r;
  }
}

/** @pure The only way to make a stream. The 12-call warm-up is mandatory. */
export function deriveRNG(master, domain, ...coords) {
  const d = domainId(domain);
  const a = hashInts(master.words, d, 0x9e37, ...coords);
  const b = hashInts(master.words, d, 0x85eb, ...coords);
  const c = hashInts(master.words, d, 0xc2b2, ...coords);
  const e = hashInts(master.words, d, 0x27d4, ...coords);
  const rng = new RNG(a, b, c, e);
  for (let i = 0; i < 12; i++) rng.next();
  return rng;
}

/** @pure Four words for a named runtime stream. */
export function deriveWords(master, domain) {
  const d = domainId(domain);
  return [
    hashInts(master.words, d, 1),
    hashInts(master.words, d, 2),
    hashInts(master.words, d, 3),
    hashInts(master.words, d, 4),
  ];
}
