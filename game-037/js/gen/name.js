// ============================================================
// gen/name.js - the grammar evaluator (GDD §34)
// PURE. Depth-capped expansion with a blocklist and a uniqueness check.
// ============================================================
import { PLACE_GRAMMAR, HOLLOW_GRAMMAR, PERSON_NAMES, TRADE_BYNAMES, NAME_BLOCKLIST, BOSS_TITLES } from '../data/names.js';
import { titleCase } from '../core/util.js';

/** @pure Expand {rule} placeholders against a grammar, depth-capped at 6. */
export function expand(rule, grammar, rng, depth = 0) {
  if (depth > 6) return rule;
  return rule.replace(/\{(\w+)\}/g, (_, key) => {
    const options = grammar[key];
    if (!options) return '';
    return expand(rng.pick(options), grammar, rng, depth + 1);
  });
}

/** Collapse doubled letters at grammar joins, title-case, tidy spaces. */
function tidy(s) {
  return titleCase(s.replace(/([a-z])\1{2,}/gi, '$1$1').replace(/\s+/g, ' ').trim());
}

function acceptable(name, used) {
  const lower = name.toLowerCase();
  if (name.length < 3 || name.length > 16) return false;
  if (used && used.has(lower)) return false;
  for (const bad of NAME_BLOCKLIST) if (lower.includes(bad)) return false;
  return true;
}

/** @pure A place name. Re-rolls up to 12, then appends an ordinal. */
export function expandPlace(rng, used, culture) {
  for (let i = 0; i < 12; i++) {
    const n = tidy(expand('{root}', PLACE_GRAMMAR, rng));
    if (acceptable(n, used)) return n;
  }
  const base = tidy(expand('{pre}{post}', PLACE_GRAMMAR, rng));
  for (const suffix of [' Below', ' Over', ' Far', ' Little', ' Old']) {
    const n = base + suffix;
    if (acceptable(n, used) || n.length <= 16) return n;
  }
  return base + ' Two';
}

/** @pure A Hollow name. */
export function expandHollow(rng, used, placeNames) {
  const g = { ...HOLLOW_GRAMMAR, place: placeNames.length ? placeNames : ['Ash'] };
  for (let i = 0; i < 12; i++) {
    const n = tidy(expand('{root}', g, rng)).replace(/\bThe\b/g, 'The');
    const lower = n.toLowerCase();
    if (n.length <= 22 && !(used && used.has(lower)) && !NAME_BLOCKLIST.some(b => lower.includes(b))) return n;
  }
  return 'The Hollow';
}

/** @pure A person's name for a culture. 30% take a trade byname. */
export function personName(rng, culture, trade, usedShort, usedFull) {
  const bank = PERSON_NAMES[culture] || PERSON_NAMES.hedgewright;
  for (let i = 0; i < 10; i++) {
    const given = rng.pick(bank.given);
    const useByname = rng.chance(0.30) && TRADE_BYNAMES[trade];
    const family = useByname ? TRADE_BYNAMES[trade] : rng.pick(bank.family);
    const full = family.startsWith('of ') ? `${given} ${family}` : `${given} ${family}`;
    if (usedShort && usedShort.has(given)) continue;
    if (usedFull && usedFull.has(full)) continue;
    const lower = full.toLowerCase();
    if (NAME_BLOCKLIST.some(b => lower.includes(b))) continue;
    return { name: full, shortName: given };
  }
  // A town can outgrow its given names. Rather than repeat a short name -
  // which makes two people the same person in conversation - qualify it.
  const QUALIFIERS = ['the Younger', 'the Elder', 'the Tall', 'the Quiet', 'the Red',
    'the Left-handed', 'of the Hill', 'of the Ford', 'the Younger Still', 'the Third'];
  for (const given of rng.shuffle(bank.given.slice())) {
    for (const q of QUALIFIERS) {
      const short = `${given} ${q}`;
      if (usedShort && usedShort.has(short)) continue;
      return { name: short, shortName: short };
    }
  }
  const n = (usedShort ? usedShort.size : 0) + 1;
  const given = rng.pick(bank.given);
  return { name: `${given} ${n}`, shortName: `${given} ${n}` };
}

/** @pure A boss name: a title and a name, possibly partly erased. */
export function bossName(rng, culture, forgotten) {
  const bank = PERSON_NAMES[culture] || PERSON_NAMES.hedgewright;
  const title = rng.pick(BOSS_TITLES);
  const name = forgotten ? '———' : rng.pick(bank.given);
  return `${title} ${name}`;
}
