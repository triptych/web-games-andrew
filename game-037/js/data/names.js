// ============================================================
// data/names.js - name and text grammars (GDD §34). APPEND ONLY.
// ============================================================

export const SEED_ADJ = Object.freeze([
  'quiet', 'green', 'long', 'low', 'old', 'salt', 'bright', 'cold', 'kind', 'far',
  'small', 'patient', 'wet', 'grey', 'first', 'last', 'slow', 'high', 'lost', 'warm',
  'still', 'deep', 'thin', 'good', 'sharp', 'soft', 'bare', 'dark', 'pale', 'wide',
  'nine', 'broken', 'hidden', 'even', 'early', 'late', 'plain', 'rough', 'sweet', 'true',
  'wandering', 'shallow', 'fallow', 'bitter', 'open', 'narrow', 'wild', 'gentle',
]);

export const SEED_NOUN = Object.freeze([
  'bell', 'lantern', 'river', 'thread', 'hearth', 'wren', 'stone', 'rain', 'loom', 'ash',
  'ford', 'moth', 'candle', 'needle', 'basket', 'hound', 'orchard', 'well', 'salt', 'brack',
  'crow', 'nettle', 'honey', 'wool', 'shuttle', 'bramble', 'oar', 'spade', 'mill', 'rope',
  'kettle', 'hare', 'goat', 'plough', 'thistle', 'heron', 'gate', 'anvil', 'reed', 'bee',
  'quill', 'lamb', 'sparrow', 'clay', 'birch', 'flint', 'oat', 'wick',
]);

export const SEED_PLACE = Object.freeze([
  'hollow', 'moor', 'mere', 'combe', 'reach', 'fold', 'garth', 'wick', 'ley', 'stead',
  'fen', 'cote', 'ford', 'bridge', 'barrow', 'green', 'end', 'cross', 'gate', 'row',
  'bottom', 'hill', 'field', 'dale', 'strand', 'mill', 'church', 'lane', 'walk', 'water',
  'wood', 'heath', 'bank', 'holt', 'shaw', 'rise', 'hurst', 'thwaite', 'beck', 'burn',
  'crag', 'scar', 'tarn', 'gill', 'howe', 'ness', 'wold', 'haugh',
]);

// ---- person names, by culture (§34.1) ----------------------------------
export const PERSON_NAMES = Object.freeze({
  hedgewright: {
    given: ['Maru', 'Ellis', 'Bryd', 'Tam', 'Nesta', 'Colm', 'Wren', 'Hale', 'Odo', 'Pell', 'Sena', 'Garrow'],
    family: ['Threadwell', 'Hedger', 'Applewhite', 'Combe', 'Ryeman', 'Barlow', 'Quillon', 'Underhedge'],
  },
  fenfolk: {
    given: ['Sedge', 'Mira', 'Otho', 'Lask', 'Pell', 'Vann', 'Ilka', 'Bree', 'Tolm', 'Nys'],
    family: ['of the Low Water', 'Reedmere', 'Silt', 'Lanternby', 'Osier', 'Wading'],
  },
  stonewake: {
    given: ['Doran', 'Ket', 'Brann', 'Ysolt', 'Gar', 'Mabb', 'Tove', 'Renn', 'Hesk'],
    family: ['Stonewake', 'Hammersend', 'Quarrel', 'Dunn', 'Cairnly', 'Grist'],
  },
  saltmarch: {
    given: ['Nessa', 'Hob', 'Calder', 'Rue', 'Merrit', 'Shen', 'Dorry', 'Fenn'],
    family: ['Saltcote', 'Netter', 'Wrack', 'Farstrand', 'Keelan', 'Tarrow'],
  },
  tallgrass: {
    given: ['Ilse', 'Jory', 'Aven', 'Peth', 'Bram', 'Cass', 'Nolan', 'Wendel'],
    family: ['Longfurrow', 'Sheaf', 'Mowbray', 'Tine', 'Stookes', 'Haymer'],
  },
  bellhold: {
    given: ['Aldis', 'Ferren', 'Ottily', 'Sim', 'Corin', 'Vesna', 'Halloway'],
    family: ['Bellhold', 'Ringer', 'Chapel', 'Tolliver', 'Clappen', 'Evensong'],
  },
  ashkin: {
    given: ['Vesh', 'Kor', 'Ama', 'Drell', 'Shiv', 'Ondry', 'Tass'],
    family: ['Ashkin', 'Emberly', 'Cinder', 'Burnt Hollow', 'Sootlin', 'Charwood'],
  },
});

/** Trade bynames, used for 30% of NPCs instead of a family name. */
export const TRADE_BYNAMES = Object.freeze({
  weaver: 'Loom', smith: 'Forge', innkeeper: 'Cups', herbalist: 'Nettle', farmer: 'Furrow',
  fisher: 'Nets', shepherd: 'Fold', baker: 'Oven', carter: 'Wheel', miller: 'Grist',
  cooper: 'Stave', thatcher: 'Reed', digger: 'Spade', keeper: 'Wick', tanner: 'Hide',
  potter: 'Clay', scholar: 'Quill', bellringer: 'Rope', boatwright: 'Keel', beekeeper: 'Skep',
});

// ---- place names (§34.2) -----------------------------------------------
export const PLACE_GRAMMAR = Object.freeze({
  root: ['{pre}{post}', '{pre}{post}', '{pre}{post} {tail}', '{adj} {post}', '{post} of {pre}'],
  pre: ['Ash', 'Went', 'Thrush', 'Bell', 'Salt', 'Fen', 'Wick', 'Hollow', 'Mere', 'Nine',
    'Elm', 'Rook', 'Barrow', 'Grey', 'Milk', 'Bram', 'Hern', 'Cob', 'Thistle', 'Low'],
  post: ['moor', 'fold', 'mere', 'cote', 'ford', 'bridge', 'hollow', 'combe', 'ley', 'wick',
    'stead', 'garth', 'reach', 'bourne', 'holt', 'mead'],
  tail: ['Bottom', 'Green', 'End', 'Cross', 'Gate', 'Row', 'Under'],
  adj: ['Low', 'High', 'Old', 'New', 'Little', 'Great', 'Far', 'Quiet'],
});

// ---- hollow names (§34.4) ----------------------------------------------
export const HOLLOW_GRAMMAR = Object.freeze({
  root: ['The {noun}', 'The {adj} {noun}', '{place}\'s {noun}', '{noun} of {place}', 'The {adj} {noun}'],
  noun: ['Bellows', 'Barrow', 'Undercroft', 'Well', 'Stair', 'Deeplight', 'Warren', 'Salt',
    'Chapel', 'Root', 'Mill', 'Hollow', 'Quiet', 'Shaft', 'Cistern', 'Kiln', 'Pens', 'Orchard'],
  adj: ['Drowned', 'Cracked', 'Sleeping', 'Hungry', 'Lost', 'Cold', 'Nameless', 'Patient', 'Green'],
});

export const BOSS_TITLES = Object.freeze(['the Warden of', 'the Last', 'the One Who Waits at', 'Keeper of']);

// ---- blocklist (§34.7) -------------------------------------------------
// Unfortunate joins the grammar can produce. Substring, case-insensitive.
export const NAME_BLOCKLIST = Object.freeze([
  'arse', 'piss', 'crap', 'damn', 'hell of', 'bumf', 'fart', 'turd', 'shit', 'cock',
  'nazi', 'slav', 'wank', 'scum',
]);

export const CULTURE_KEYS = Object.freeze(['hedgewright', 'fenfolk', 'stonewake', 'saltmarch', 'tallgrass', 'bellhold', 'ashkin']);
