// ============================================================
// data/names.js - name syllabary (GDD 4)
// Names are generated, not listed, so a hundred Cinderlings are a hundred
// different animals. Every lineage draws from its own sound.
// ============================================================

export const SYLLABLES = {
  ember:   { head: ['Vor', 'Kal', 'Ash', 'Em', 'Pyr', 'Cin', 'Thar', 'Bran', 'Sol', 'Fyr'],
             mid:  ['ka', 'de', 'ro', 'me', 'va', 'ti', 'ga'],
             tail: ['ax', 'ith', 'eth', 'ull', 'oth', 'ara', 'ir', 'us'] },
  tide:    { head: ['Mor', 'Nal', 'Sel', 'Thal', 'Wyn', 'Cae', 'Bri', 'Lir', 'Ys', 'Oss'],
             mid:  ['va', 'le', 'ri', 'ae', 'mo', 'na', 'wi'],
             tail: ['eth', 'wyn', 'ara', 'is', 'ell', 'oon', 'ay', 'ash'] },
  gale:    { head: ['Zeph', 'Ael', 'Kir', 'Syl', 'Ven', 'Ris', 'Ith', 'Fae', 'Cor', 'Nim'],
             mid:  ['ri', 'a', 'ye', 'so', 'le', 'wi', 'ta'],
             tail: ['iel', 'ax', 'ynn', 'ora', 'is', 'ael', 'ith', 'us'] },
  stone:   { head: ['Gar', 'Dorn', 'Bru', 'Kag', 'Hol', 'Mar', 'Thok', 'Grim', 'Bael', 'Ord'],
             mid:  ['da', 'mu', 'ga', 'ro', 'ka', 'ben', 'to'],
             tail: ['gar', 'mund', 'ock', 'ul', 'rim', 'nak', 'sten', 'holm'] },
  verdant: { head: ['Syl', 'Bri', 'Ver', 'Mos', 'Thorn', 'Lys', 'Fen', 'Gre', 'Wil', 'Rune'],
             mid:  ['va', 'le', 'no', 'ri', 'da', 'me', 'sa'],
             tail: ['wen', 'thil', 'ara', 'osh', 'iel', 'ory', 'ash', 'un'] },
  storm:   { head: ['Zar', 'Krел', 'Vex', 'Tyr', 'Ral', 'Skri', 'Ozh', 'Nyx', 'Jol', 'Vel'],
             mid:  ['ka', 'ze', 'ri', 'to', 'va', 'ix', 'ar'],
             tail: ['ax', 'ick', 'orn', 'ux', 'eth', 'ara', 'is', 'okk'] },
  gloam:   { head: ['Um', 'Neth', 'Sor', 'Vash', 'Khol', 'Mour', 'Dus', 'Har', 'Yll', 'Grae'],
             mid:  ['va', 'ne', 'ro', 'sha', 'le', 'mi', 'tha'],
             tail: ['eth', 'un', 'ash', 'oir', 'ryx', 'ell', 'om', 'ira'] },
  radiant: { head: ['Aur', 'Sol', 'Hel', 'Lum', 'Ser', 'Ela', 'Vio', 'Ray', 'Dawn', 'Cae'],
             mid:  ['e', 'ri', 'va', 'no', 'li', 'sa', 'mi'],
             tail: ['us', 'iel', 'ara', 'on', 'eth', 'ine', 'ax', 'or'] },
};
// One stray Cyrillic character crept into the storm head list from an old
// keyboard; normalise it rather than silently generating unreadable names.
SYLLABLES.storm.head[1] = 'Krel';

/** Epithets for named champions and board-quest targets. */
export const EPITHETS = [
  'the Unfed', 'of the Long Road', 'Ninefang', 'the Grey', 'Saltbitten', 'the Last Warm Thing',
  'Cloudbreaker', 'of the Sunken Hall', 'the Patient', 'Emberless', 'the Wound', 'Skyless',
  'Twice-Bound', 'of the Riven Throne', 'the Unnamed', 'Ashcrown', 'Bright-Eyed', 'the Widow-Maker',
  'the Quiet', 'Stormridden', 'the Hollow', 'Whitescale', 'of Three Valleys', 'the Uncounted',
];

/** Human names for the people you meet and the quests they hand out. */
export const PERSON_NAMES = {
  first: ['Maerin', 'Kessa', 'Tolm', 'Bryd', 'Ansel', 'Wren', 'Halla', 'Odren', 'Sif', 'Corvin',
          'Emme', 'Darrow', 'Ilsa', 'Petrin', 'Nessa', 'Garrick', 'Yola', 'Thom', 'Avice', 'Roan'],
  last:  ['Colde', 'Vane', 'Ashworth', 'Brill', 'Tarne', 'Dunmore', 'Saltley', 'Ferrow', 'Keld',
          'Winch', 'Marrow', 'Oster', 'Pell', 'Rushmere', 'Gannet', 'Holt'],
};

/** Roost and landmark name parts, for generated dungeon floors. */
export const PLACE_PARTS = {
  adj:  ['Guttering', 'Sunken', 'Riven', 'Hollow', 'Blackened', 'Salt', 'Quiet', 'Cracked',
         'Windward', 'Low', 'Old', 'Thin', 'Bright', 'Ashen'],
  noun: ['Roost', 'Warren', 'Hollow', 'Stair', 'Gallery', 'Nest', 'Throat', 'Vault',
         'Terrace', 'Burrow', 'Chimney', 'Shelf', 'Cradle', 'Rookery'],
};

/**
 * A name from an element's syllabary. `rng` is an RNG instance.
 * Rolls are rejected and retried when the seams read badly - a repeated
 * syllable ("Kagkagar") or an echoed opening ("Aelael") - because those are
 * the two failures that make a generated name obviously generated.
 */
export function dragonName(rng, elementId) {
  const bank = SYLLABLES[elementId] || SYLLABLES.ember;
  let name = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const head = rng.pick(bank.head);
    const mid = rng.chance(0.55) ? rng.pick(bank.mid) : '';
    const tail = rng.pick(bank.tail);
    name = (head + mid + tail).toLowerCase();
    const echoed = tail.startsWith(head.toLowerCase().slice(0, 2)) ||
                   (mid && tail.startsWith(mid)) ||
                   /(\w{2,})\1/.test(name);
    if (!echoed) break;
  }
  // Tidy the seams: no triples, no doubled vowels at a join.
  name = name.replace(/(.)\1\1+/g, '$1$1').replace(/([aeiou])\1/g, '$1');
  return name[0].toUpperCase() + name.slice(1);
}

export function championName(rng, elementId) {
  return `${dragonName(rng, elementId)} ${rng.pick(EPITHETS)}`;
}

export function personName(rng) {
  return `${rng.pick(PERSON_NAMES.first)} ${rng.pick(PERSON_NAMES.last)}`;
}

export function placeName(rng) {
  return `The ${rng.pick(PLACE_PARTS.adj)} ${rng.pick(PLACE_PARTS.noun)}`;
}
