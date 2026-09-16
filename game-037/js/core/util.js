// ============================================================
// core/util.js - small helpers with no opinions
// ============================================================

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

/** Chebyshev distance - the right metric for an 8-way grid. */
export const dist8 = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export const DEV = (() => {
  try { return typeof location !== 'undefined' && /(^|[?&])dev=1/.test(location.search); }
  catch { return false; }
})();

export function assert(cond, msg) {
  if (!cond) {
    const e = new Error('assert: ' + msg);
    if (DEV) throw e;
    console.warn(e.message);
  }
  return cond;
}

/** Title-case a phrase, leaving the s in "Bell's" alone. */
export const titleCase = s => s.replace(/(^|[\s-])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());

/** Deep freeze, for data tables. Slow, so dev-only callers should guard it. */
export function deepFreeze(o) {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

/** Stable stringify: sorted keys, numbers rounded, for golden hashes. */
export function stableStringify(v) {
  const seen = new WeakSet();
  const walk = (x) => {
    if (x === null || x === undefined) return 'null';
    if (typeof x === 'number') return Number.isFinite(x) ? String(Math.round(x * 1e6) / 1e6) : '0';
    if (typeof x === 'boolean' || typeof x === 'string') return JSON.stringify(x);
    if (ArrayBuffer.isView(x)) return '[' + Array.from(x).join(',') + ']';
    if (Array.isArray(x)) return '[' + x.map(walk).join(',') + ']';
    if (x instanceof Map) return '{' + [...x.keys()].sort().map(k => JSON.stringify(String(k)) + ':' + walk(x.get(k))).join(',') + '}';
    if (x instanceof Set) return '[' + [...x].map(String).sort().map(s => JSON.stringify(s)).join(',') + ']';
    if (typeof x === 'object') {
      if (seen.has(x)) return '"<cycle>"';
      seen.add(x);
      return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + walk(x[k])).join(',') + '}';
    }
    return '"?"';
  };
  return walk(v);
}

/** A bounded least-recently-used cache. Pure when keyed by its inputs. */
export class LRU {
  constructor(limit = 256) { this.limit = limit; this.m = new Map(); }
  get(k) {
    if (!this.m.has(k)) return undefined;
    const v = this.m.get(k);
    this.m.delete(k); this.m.set(k, v);
    return v;
  }
  set(k, v) {
    if (this.m.has(k)) this.m.delete(k);
    this.m.set(k, v);
    if (this.m.size > this.limit) this.m.delete(this.m.keys().next().value);
    return v;
  }
  has(k) { return this.m.has(k); }
  clear() { this.m.clear(); }
}

/** Grammatical "a"/"an", because generated text reads badly without it. */
export const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';

/** Join a list the way a person would. */
export function commaList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + ' and ' + items[1];
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}
