// ============================================================
// core/rand.js - seeded randomness (GDD 17)
// The world is a pure function of a seed string. Math.random() is used
// only for battle variance and per-session cosmetic flicker, never for
// anything that has to survive a reload.
// ============================================================

/** String -> a generator of 32-bit seed words. */
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

/** Small Fast Counter PRNG. Four words of state, trivially serializable. */
export function sfc32(a, b, c, d) {
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  return function () {
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Any string -> a stable 32-bit integer. */
export function hashStr(s) {
  return xmur3(String(s))();
}

/** Mix a list of integers into one 32-bit word. */
export function hashInts(...ints) {
  let h = 2166136261 >>> 0;
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

/** The only sanctioned way to consume randomness. */
export class RNG {
  constructor(a, b, c, d) {
    this.words = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    this._next = sfc32(a, b, c, d);
    this.calls = 0;
  }

  next() { this.calls++; return this._next(); }
  float(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }

  /** Weighted element; `weights` parallel to `arr`, non-negative. */
  weighted(arr, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) return arr[0];
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  /** Weighted element from {key: weight}. */
  weightedKey(table) {
    const keys = Object.keys(table);
    return this.weighted(keys, keys.map(k => table[k]));
  }

  /** Weighted element from [{ ...,  weight }]. */
  weightedList(list, field = 'weight') {
    return this.weighted(list, list.map(x => x[field] ?? 1));
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  sample(arr, n) {
    return this.shuffle(arr.slice()).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  /** Bell-shaped: sum of k uniform rolls. */
  dice(k, min, max) { let s = 0; for (let i = 0; i < k; i++) s += this.int(min, max); return s; }

  save() { return { w: this.words, calls: this.calls }; }

  static restore(s) {
    const r = new RNG(s.w[0], s.w[1], s.w[2], s.w[3]);
    for (let i = 0; i < s.calls; i++) r.next();
    return r;
  }
}

/** Derive a named, coordinate-addressed stream from a master seed string. */
export function rngFrom(seedString, domain, ...coords) {
  const seed = xmur3(String(seedString) + '|' + domain);
  const base = [seed(), seed(), seed(), seed()];
  const mixed = base.map((w, i) => hashInts(w, i * 2654435761, ...coords));
  const rng = new RNG(mixed[0], mixed[1], mixed[2], mixed[3]);
  for (let i = 0; i < 8; i++) rng.next();   // warm-up
  return rng;
}

/** A stream seeded from wall-clock + counter, for things that need not persist. */
let volatileCounter = 0;
export function volatileRNG() {
  volatileCounter = (volatileCounter + 1) | 0;
  return new RNG(hashInts(Date.now() | 0, volatileCounter),
                 hashInts(volatileCounter, 0x9e3779b9),
                 hashInts((Date.now() / 7) | 0, volatileCounter * 31),
                 hashInts(volatileCounter, (performance?.now?.() | 0) || 0));
}
