/**
 * rules.js — the numbers that define the game. Pure data; tuned with dev/simtest.mjs.
 */

export const GRID = 5;
export const HAND_SIZE = 5;
export const MAX_HAND = 8;
export const DEALS = 3;
export const REDRAWS = 1;
export const ELIXIR_SLOTS = 3;

export const SUITS = ['S', 'C', 'D', 'H'];
export const SUIT_INFO = {
    S: { name: 'Blades', glyph: '♠', channel: 'dmg', scale: 1.0, color: '#d8e4ff', hex: 0xb8ccff, verb: 'damage' },
    C: { name: 'Staves', glyph: '♣', channel: 'aoe', scale: 0.6, color: '#b98cff', hex: 0xa070ff, verb: 'damage to all' },
    D: { name: 'Coins', glyph: '♦', channel: 'ward', scale: 0.8, color: '#ffd35a', hex: 0xffc640, verb: 'Ward' },
    H: { name: 'Hearts', glyph: '♥', channel: 'heal', scale: 0.35, color: '#ff6a7a', hex: 0xff4a60, verb: 'healing' },
};

export const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const RANK_LONG = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
export const rankLabel = (r) => RANK_NAMES[r] ?? String(r);

/** Chips a rank is worth: pip value, faces 10, aces 11. */
export const rankChips = (r) => (r <= 0 ? 0 : r <= 10 ? r : r === 14 ? 11 : 10);

/** Poker hands, best first. `mult` multiplies every suit channel of the line. */
export const HANDS = {
    fiveKind: { name: 'Five of a Kind', mult: 10, tier: 10 },
    royalFlush: { name: 'Royal Flush', mult: 12, tier: 11 },
    straightFlush: { name: 'Straight Flush', mult: 8, tier: 9 },
    fourKind: { name: 'Four of a Kind', mult: 6, tier: 8 },
    fullHouse: { name: 'Full House', mult: 4.5, tier: 7 },
    flush: { name: 'Flush', mult: 3, tier: 6 },
    straight: { name: 'Straight', mult: 3.5, tier: 5 },
    threeKind: { name: 'Three of a Kind', mult: 2.5, tier: 4 },
    twoPair: { name: 'Two Pair', mult: 2, tier: 3 },
    pair: { name: 'Pair', mult: 1.5, tier: 2 },
    high: { name: 'High Card', mult: 1, tier: 1 },
};
/** Display order for the hand-ranks panel. */
export const HAND_ORDER = ['royalFlush', 'fiveKind', 'straightFlush', 'fourKind', 'fullHouse', 'straight', 'flush', 'threeKind', 'twoPair', 'pair', 'high'];

export const CROSS_MULT = 1.5;   // each line completed by the same placement
export const DIAG_MULT = 1.25;   // diagonals are harder to finish

export const WEAK_MULT = 0.75;
export const EXPOSED_MULT = 1.5;

/** Map node types. */
export const NODE = {
    battle: { name: 'Battle', icon: 'battle' },
    elite: { name: 'Elite', icon: 'elite' },
    event: { name: 'Mystery', icon: 'event' },
    shop: { name: 'Merchant', icon: 'shop' },
    rest: { name: 'Campfire', icon: 'rest' },
    treasure: { name: 'Treasure', icon: 'treasure' },
    boss: { name: 'Warden', icon: 'boss' },
};

export const WORLDS = 10;
export const FLOORS = 10;
