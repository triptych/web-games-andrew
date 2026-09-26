// ============================================================
// Syllable grammars for people and places.
// ============================================================

const P_START = ['Al', 'Bram', 'Cor', 'Del', 'El', 'Fen', 'Gar', 'Hal', 'Isa', 'Jun', 'Ka', 'Lio', 'Mar', 'Nel', 'Or', 'Pip', 'Quin', 'Ros', 'Sa', 'Tam', 'Ul', 'Vi', 'Wren', 'Yor', 'Zel', 'Bel', 'Cal', 'Dor', 'Em', 'Fi', 'Ivo', 'Lu', 'Mo', 'Nia', 'Os', 'Pell', 'Rhu', 'Sol', 'Tib', 'Wil'];
const P_MID = ['', '', '', 'a', 'e', 'i', 'o', 'ar', 'el', 'in', 'or', 'ri', 'la', 'ne', 'bi'];
const P_END = ['a', 'o', 'ie', 'y', 'en', 'an', 'is', 'ton', 'wyn', 'ric', 'ra', 'la', 'na', 'dle', 'bert', 'ley', 'ette', 'mund', 'row', 'by', 'sa', 'ius', 'ka', 'mi'];
const SURNAME_A = ['Honey', 'Thistle', 'Moss', 'Bram', 'Oak', 'Willow', 'Ash', 'Clover', 'Fern', 'Hazel', 'Pepper', 'Stone', 'Brook', 'Wren', 'Holly', 'Birch', 'Marigold', 'Tumble', 'Copper', 'Bright'];
const SURNAME_B = ['well', 'wick', 'bottom', 'field', 'bury', 'dale', 'brook', 'foot', 'hollow', 'worth', 'combe', 'ley', 'thorne', 'wood', 'mead', 'stead'];

const PLACE_A = ['Whisper', 'Sun', 'Moon', 'Bramble', 'Hollow', 'Mist', 'Amber', 'Silver', 'Thorn', 'Glass', 'Ember', 'Frost', 'Star', 'Dusk', 'Dawn', 'Green', 'Wild', 'Old', 'Still', 'Fox', 'Raven', 'Heather', 'Cinder', 'Rime', 'Lark'];
const PLACE_B = ['brook', 'hollow', 'mere', 'fell', 'vale', 'wick', 'stone', 'gleam', 'reach', 'shade', 'thorn', 'ford', 'crest', 'glow', 'moor', 'dell', 'wind', 'fall'];
const TOWNS = ['Barrowby', 'Kettlewick', 'Old Harrow', 'Lanternford', 'Millbridge', 'Saltmarsh', 'Pennyfield', 'Rookhollow', 'Ashcombe', 'Tallowmere', 'Brindlebury', 'Cobblestead'];
const GLEN_WORDS = ['Glimmer', 'Hearth', 'Willow', 'Starling', 'Mossy', 'Honey', 'Lantern', 'Clover', 'Fern'];
const GLEN_ENDS = ['glen', 'dell', 'hollow', 'vale', 'combe'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function personName(rng) {
    let n = rng.pick(P_START) + rng.pick(P_MID) + rng.pick(P_END);
    n = n.replace(/([aeiou])\1+/g, '$1').replace(/(.)\1\1/g, '$1$1');
    if (n.length > 9) n = n.slice(0, 9);
    return cap(n.toLowerCase());
}
export const surname = rng => rng.pick(SURNAME_A) + rng.pick(SURNAME_B);
export const townName = rng => rng.pick(TOWNS);
export const glenName = rng => rng.pick(GLEN_WORDS) + rng.pick(GLEN_ENDS);

export function regionName(rng, biome) {
    const a = rng.pick(PLACE_A), b = rng.pick(PLACE_B);
    return `${a}${b} ${rng.pick(biome.nouns)}`;
}
export function siteName(rng, list) { return `${rng.pick(['The ', '', ''])}${rng.pick(list)}`.trim(); }

export const PRONOUNS = {
    they: { they: 'they', them: 'them', their: 'their', theyre: "they're", is: 'are', has: 'have' },
    she: { they: 'she', them: 'her', their: 'her', theyre: "she's", is: 'is', has: 'has' },
    he: { they: 'he', them: 'him', their: 'his', theyre: "he's", is: 'is', has: 'has' },
};

/** Fill {tokens} in a template. Unknown tokens are left as-is. */
export function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}
