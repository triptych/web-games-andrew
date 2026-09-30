/**
 * cards.js — playing cards, enchantments, Arcana (spell cards) and the card factory.
 *
 * A card instance is a plain object so it saves as JSON:
 *   { uid, kind: 'play'|'arcana'|'ash', rank, suit, ench, id, up, temp }
 *   - play:   rank 2..14 (A = 14), suit S/C/D/H; rank 0 + joker:true is a Joker
 *   - arcana: id into ARCANA, up = upgraded
 *   - ash:    a dead card monsters shuffle in (no suit, no chips)
 *   - temp:   vanishes at the end of combat (conjured cards)
 */

import { SUIT_INFO, rankLabel, rankChips, RANK_LONG } from './rules.js';

export const ENCHANTS = {
    keen: { name: 'Keen', text: '+6 chips.', color: '#9ff0ff' },
    gilded: { name: 'Gilded', text: 'Gain 3 gold when it fires.', color: '#ffd35a' },
    vampiric: { name: 'Vampiric', text: 'Heal 2 when it fires.', color: '#ff4060' },
    blazing: { name: 'Blazing', text: 'Apply 3 Burn to the target when it fires.', color: '#ff8a30' },
    stone: { name: 'Stone', text: 'Gain 4 Ward when it fires.', color: '#b0b8c8' },
    glass: { name: 'Glass', text: 'Its line gets ×1.5. 1 in 4 chance to shatter.', color: '#c8f4ff' },
    echo: { name: 'Echo', text: 'Its chips count twice.', color: '#c89cff' },
    wild: { name: 'Wild', text: 'Counts as every suit.', color: '#7dffb0' },
    lucky: { name: 'Lucky', text: '1 in 3 chance of +10 chips.', color: '#6aff6a' },
    radiant: { name: 'Radiant', text: 'Its line gets +0.5 mult.', color: '#fff6b0' },
};
export const ENCHANT_KEYS = Object.keys(ENCHANTS);

/**
 * Arcana. `target`: none | enemy | grid | grid2 | gridSuit.
 * `exhaust`: removed for the rest of the combat once played.
 * Effects are implemented in combat.js (switch on id); `n`/`un` are the
 * base/upgraded magnitudes the text refers to.
 */
export const ARCANA = {
    fireball: { name: 'Fireball', cost: 1, upCost: 1, target: 'enemy', rarity: 1, n: 12, un: 18, text: (n) => `Deal ${n} damage.` },
    barrier: { name: 'Barrier', cost: 1, upCost: 1, target: 'none', rarity: 1, n: 11, un: 16, text: (n) => `Gain ${n} Ward.` },
    transmute: { name: 'Transmute', cost: 1, upCost: 0, target: 'gridSuit', rarity: 1, n: 0, un: 0, text: () => 'Change a table card\'s suit.' },
    swap: { name: 'Swap', cost: 0, upCost: 0, target: 'grid2', rarity: 1, n: 0, un: 1, text: (n) => `Swap two table cards.${n ? ' Draw 1.' : ''}` },
    ascend: { name: 'Ascend', cost: 1, upCost: 1, target: 'grid', rarity: 1, n: 1, un: 2, text: (n) => `A table card gains +${n} rank.` },
    sweep: { name: 'Sweep', cost: 0, upCost: 0, target: 'grid', rarity: 1, n: 0, un: 1, text: (n) => `Discard a table card.${n ? ' Draw 1.' : ''}` },
    foresight: { name: 'Foresight', cost: 0, upCost: 0, target: 'none', rarity: 1, n: 2, un: 3, text: (n) => `Draw ${n} cards.` },
    conjure: { name: 'Conjure Joker', cost: 1, upCost: 0, target: 'none', rarity: 2, exhaust: true, n: 0, un: 0, text: () => 'Add a wild Joker to your hand. Exhaust.' },
    secondWind: { name: 'Second Wind', cost: 0, upCost: 0, target: 'none', rarity: 2, exhaust: true, n: 1, un: 2, text: (n) => `Gain ${n} Deal${n > 1 ? 's' : ''}. Exhaust.` },
    gamble: { name: 'Gamble', cost: 0, upCost: 0, target: 'none', rarity: 1, n: 1, un: 2, text: (n) => `Discard your hand, then draw that many +${n}.` },
    hex: { name: 'Hex', cost: 1, upCost: 1, target: 'enemy', rarity: 1, n: 2, un: 3, text: (n) => `Apply ${n} Weak and ${n} Exposed.` },
    salvo: { name: 'Salvo', cost: 1, upCost: 1, target: 'none', rarity: 1, n: 3, un: 4, text: (n) => `Deal 5 damage to a random enemy ${n} times.` },
    thunder: { name: 'Thunderclap', cost: 2, upCost: 2, target: 'none', rarity: 2, n: 12, un: 18, text: (n) => `Deal ${n} damage to ALL enemies. Apply 1 Exposed.` },
    purify: { name: 'Purify', cost: 0, upCost: 0, target: 'none', rarity: 1, n: 0, un: 6, text: (n) => `Remove your debuffs and every Seal and Frost on the table.${n ? ` Gain ${n} Ward.` : ''}` },
    favour: { name: "Crown's Favour", cost: 1, upCost: 0, target: 'none', rarity: 2, n: 2, un: 2, text: () => 'The next line you fire this turn scores double.' },
    mirror: { name: 'Mirror', cost: 1, upCost: 0, target: 'grid', rarity: 2, n: 0, un: 0, text: () => 'Add a temporary copy of a table card to your hand.' },
    kindle: { name: 'Kindle', cost: 1, upCost: 1, target: 'enemy', rarity: 1, n: 6, un: 9, text: (n) => `Apply ${n} Burn.` },
    mend: { name: 'Mend', cost: 1, upCost: 1, target: 'none', rarity: 1, n: 6, un: 9, text: (n) => `Heal ${n}. Gain ${Math.round(n / 3)} Regen.` },
    bulwark: { name: 'Bulwark', cost: 1, upCost: 1, target: 'none', rarity: 2, n: 2, un: 3, text: (n) => `Gain ${n} Ward for each card on the table.` },
    harvest: { name: 'Harvest', cost: 1, upCost: 1, target: 'enemy', rarity: 2, n: 1, un: 1.5, text: (n) => `Deal damage equal to ${n === 1 ? '' : n + '× '}the chips on the table's fullest row.` },
    rally: { name: 'Rally', cost: 1, upCost: 1, target: 'none', rarity: 2, exhaust: true, n: 2, un: 3, text: (n) => `Gain ${n} Might. Exhaust.` },
    reap: { name: 'Reap', cost: 1, upCost: 1, target: 'none', rarity: 3, exhaust: true, n: 1, un: 2, text: (n) => `Fire the table's fullest row now, as it stands. ${n > 1 ? '' : 'Exhaust.'}` },
};
export const ARCANA_KEYS = Object.keys(ARCANA);

// ------------------------------------------------------------------ factory

export function makeCounter(run) {
    return () => (run.uid = (run.uid ?? 0) + 1);
}

export function playCard(uid, rank, suit, ench = null) {
    return { uid, kind: 'play', rank, suit, ench };
}
export function jokerCard(uid, temp = false) {
    return { uid, kind: 'play', rank: 0, suit: null, joker: true, ench: null, temp };
}
export function ashCard(uid) {
    return { uid, kind: 'ash', rank: 0, suit: null, ench: null, temp: true };
}
export function arcanaCard(uid, id, up = false) {
    return { uid, kind: 'arcana', id, up, rank: 0, suit: null, ench: null };
}

export function cloneCard(c, uid) {
    return { ...c, uid };
}

// ------------------------------------------------------------------ describing

export function cardChips(c) {
    if (c.kind !== 'play') return 0;
    if (c.joker) return 10;
    return rankChips(c.rank);
}

export function cardName(c) {
    if (c.kind === 'ash') return 'Ash';
    if (c.kind === 'arcana') return ARCANA[c.id].name + (c.up ? '+' : '');
    if (c.joker) return 'Joker';
    const r = RANK_LONG[c.rank] ?? String(c.rank);
    const e = c.ench ? ENCHANTS[c.ench].name + ' ' : '';
    return `${e}${r} of ${SUIT_INFO[c.suit].name}`;
}

export function cardShort(c) {
    if (c.kind === 'ash') return 'Ash';
    if (c.kind === 'arcana') return ARCANA[c.id].name + (c.up ? '+' : '');
    if (c.joker) return 'Joker';
    return rankLabel(c.rank) + SUIT_INFO[c.suit].glyph;
}

export function arcanaCost(c) {
    const a = ARCANA[c.id];
    return c.up ? a.upCost : a.cost;
}

export function cardText(c) {
    if (c.kind === 'ash') return 'Dead weight. No suit, no chips. Breaks flushes and straights.';
    if (c.kind === 'arcana') {
        const a = ARCANA[c.id];
        return a.text(c.up ? a.un : a.n);
    }
    if (c.joker) return 'Wild: counts as the best rank and the line\'s main suit. 10 chips.';
    const s = SUIT_INFO[c.suit];
    let t = `${cardChips(c)} chips of ${s.verb}.`;
    if (c.ench) t += ' ' + ENCHANTS[c.ench].text;
    return t;
}

/** Sort key for deck views: arcana last, then suit, then rank. */
export function cardSortKey(c) {
    if (c.kind === 'arcana') return 900 + ARCANA_KEYS.indexOf(c.id);
    if (c.kind === 'ash') return 990;
    if (c.joker) return 800;
    return 'SCDH'.indexOf(c.suit) * 20 + c.rank;
}

// ------------------------------------------------------------------ rewards

/**
 * A random reward card for world w (0-9). Later worlds offer higher ranks and
 * more enchantments. `bias` favours a hero's suits.
 */
export function rollRewardCard(rng, uid, w, { arcanaChance = 0.3, enchantChance = null, rare = false, bias = null } = {}) {
    if (rng.chance(arcanaChance)) {
        const pool = ARCANA_KEYS.filter((k) => rare ? ARCANA[k].rarity >= 2 : ARCANA[k].rarity <= 2 || rng.chance(0.3));
        return arcanaCard(uid, rng.pick(pool), rng.chance(0.08 + w * 0.04));
    }
    const lo = Math.min(9, 4 + Math.floor(w * 0.6));
    const hi = Math.min(14, 9 + Math.floor(w * 0.6) + (rare ? 2 : 0));
    const rank = rng.int(lo, hi);
    let suit = rng.pick(['S', 'C', 'D', 'H']);
    if (bias && rng.chance(0.35)) suit = rng.pick(bias);
    const ec = enchantChance ?? (0.12 + w * 0.05 + (rare ? 0.25 : 0));
    const ench = rng.chance(ec) ? rng.pick(ENCHANT_KEYS) : null;
    if (rng.chance(0.02 + w * 0.004)) return jokerCard(uid);
    return playCard(uid, rank, suit, ench);
}

/** Card value for shop pricing and bot drafting. */
export function cardValue(c) {
    if (c.kind === 'arcana') return 40 + ARCANA[c.id].rarity * 15 + (c.up ? 20 : 0);
    if (c.joker) return 90;
    return 20 + cardChips(c) * 3 + (c.ench ? 35 : 0);
}
