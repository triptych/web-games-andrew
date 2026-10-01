/**
 * books.js — the thirteen Lost Books. Each one returned grants a permanent unlock;
 * studying it at the Scriptorium raises its tier (×1, ×1.5, ×2).
 * Effects are read by game.js (hero stats), town.js (buildings) and battle setup.
 */

export const BOOKS = [
    { id: 'sparks',   title: 'The Primer of Sparks',          wing: 0, at: 'keeper',   icon: '⚡', color: '#ffd23a',
      bonus: (m) => `+${Math.round(m)} Spark mana from every Spark match.`,
      blurb: 'A children\'s first spellbook, with crayon notes in the margins. It still fizzes when you open it.' },
    { id: 'almanac',  title: "The Gardener's Almanac",        wing: 0, at: 'guardian', icon: '🌻', color: '#57e07a', unlock: 'herbs',
      bonus: (m) => `Leaf matches heal ${Math.round(m)} HP per gem. Unlocks the Herb Garden.`,
      blurb: 'Pressed flowers between every page. Planting advice for every month, including three months nobody remembers.' },
    { id: 'ember',    title: 'The Ember Codex',               wing: 1, at: 'keeper',   icon: '🔥', color: '#ff6a3d', unlock: 'forge',
      bonus: (m) => `Fire spells +${Math.round(20 * m)}% power. Unlocks the Forge.`,
      blurb: 'Warm to the touch, smells of toast. Teaches smiths to fold starlight into steel.' },
    { id: 'bestiary', title: 'The Bestiary of Bright Beasts', wing: 1, at: 'guardian', icon: '🦄', color: '#ff7ad9',
      bonus: (m) => `+${Math.round(15 * m)}% XP. Monster weaknesses deal +50% (and are shown).`,
      blurb: 'Every monster in the Library, drawn lovingly, with a section titled "Their Feelings".' },
    { id: 'tides',    title: 'The Tide Tables',               wing: 2, at: 'keeper',   icon: '🌊', color: '#3fb2ff', unlock: 'alchemist',
      bonus: (m) => `+${Math.round(3 * m)} mana capacity. Unlocks the Alchemist.`,
      blurb: 'Predicts every tide, including the tides of tea in the reading room. Slightly damp.' },
    { id: 'ledger',   title: 'The Ledger of Lost Coins',      wing: 2, at: 'guardian', icon: '💰', color: '#ffc531',
      bonus: (m) => `+${Math.round(25 * m)}% gold from battles and the Market.`,
      blurb: 'A list of every coin ever dropped down the back of a sofa — and where it went.' },
    { id: 'thunder',  title: 'The Thunder Psalter',           wing: 3, at: 'keeper',   icon: '🌩️', color: '#b8a6ff', unlock: 'magetower',
      bonus: (m) => `Start every battle with ${Math.round(4 * m)} Spark mana. Unlocks the Mage Tower.`,
      blurb: 'Hymns for storms. Reading it aloud makes your hair stand up in a very dignified way.' },
    { id: 'atlas',    title: 'The Atlas of Winds',            wing: 3, at: 'guardian', icon: '🧭', color: '#7fe3ff',
      bonus: (m) => `Buildings store +${Math.round(4 * m)} hours of production.`,
      blurb: 'Maps of where every wind goes when it stops blowing. Most of them go home for supper.' },
    { id: 'clock',    title: "The Clockmaker's Manual",       wing: 4, at: 'keeper',   icon: '⚙️', color: '#ffb35a', unlock: 'clocktower',
      bonus: (m) => `All production +${Math.round(10 * m)}%. Unlocks the Clocktower.`,
      blurb: 'Diagrams of gears inside gears inside gears. On the last page, a tiny gear, inside a gear.' },
    { id: 'gears',    title: 'The Grimoire of Gears',         wing: 4, at: 'guardian', icon: '⏰', color: '#ff9a3d', spell: 'clockbomb',
      bonus: (m) => `Teaches Clockwork Bomb (rank +${Math.round(m * 2 - 2)}).`,
      blurb: 'It ticks. Not like a clock. Like it is thinking about it.' },
    { id: 'stars',    title: 'The Star Chart',                wing: 5, at: 'keeper',   icon: '🌟', color: '#e0b8ff',
      bonus: (m) => `+1 spell slot. Skull crit +${Math.round(4 * m)}%.`,
      blurb: 'Every constellation, including the shy ones that only come out when nobody\'s looking.' },
    { id: 'lexicon',  title: 'The Lexicon of Light',          wing: 5, at: 'guardian', icon: '💡', color: '#fff3a0',
      bonus: (m) => `+${Math.round(20 * m)}% max HP.`,
      blurb: 'A dictionary in which every word is a little brighter than the last.' },
    { id: 'first',    title: 'The First Book',                wing: 6, at: 'final',    icon: '📖', color: '#ffffff',
      bonus: (m) => `+${Math.round(10 * m)}% to every stat. Opens the Endless Stacks.`,
      blurb: 'The book every other book is quoting. Its first line is "Once upon a time" and it means it.' },
];
export const BOOK_BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const TIER_MULT = [0, 1, 1.5, 2];
export const MAX_TIER = 3;

/** Multiplier for a book the profile holds (0 if missing). */
export function bookMult(profile, id) { return TIER_MULT[profile.books[id] || 0] || 0; }
export function bookCount(profile) { return Object.keys(profile.books).length; }

export function studyCost(book, tier) {
    const i = BOOKS.indexOf(book) + 1;
    return tier === 2 ? { ink: 30 + 12 * i, gold: 150 + 60 * i } : { ink: 90 + 30 * i, gold: 400 + 150 * i };
}
export function studyReq(tier) { return tier === 2 ? 2 : 5; }   // Scriptorium level needed
