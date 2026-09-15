// ============================================================
// core/seed.js - seed strings and the master seed (GDD §5)
// ============================================================
import { xmur3 } from './rand.js';
import { SEED_ADJ, SEED_NOUN, SEED_PLACE } from '../data/names.js';

/** @pure Seeds ignore punctuation and case, by design. */
export function normalizeSeedString(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64) || 'lanternwake';
}

/** @stateful Uses crypto for a memorable three-word seed. */
export function randomSeedString() {
  const buf = new Uint32Array(3);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else { const t = Date.now(); buf[0] = t; buf[1] = t >> 7; buf[2] = t >> 13; }
  return [
    SEED_ADJ[buf[0] % SEED_ADJ.length],
    SEED_NOUN[buf[1] % SEED_NOUN.length],
    SEED_PLACE[buf[2] % SEED_PLACE.length],
  ].join(' ');
}

/** @pure seed string -> { string, words[4] }. Everything grows from this. */
export function makeMasterSeed(seedString) {
  const s = normalizeSeedString(seedString);
  const h = xmur3(s);
  return { string: s, words: [h(), h(), h(), h()] };
}
