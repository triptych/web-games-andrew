// Readings: after the third, sixth and ninth Thresholds three cards are dealt face up. Choose one; it is turned,
// and lands upright (a blessing) or reversed (a curse) for the next three battles. The suit decides which.
// Pure data.

export const BLESSINGS = {
    wands: { id: 'blaze', name: 'Blaze', text: 'Every card strikes 20% harder.', atk: 0.2 },
    cups: { id: 'mending', name: 'Mending', text: 'Every card has 20% more HP.', hp: 0.2 },
    swords: { id: 'clarity', name: 'Clarity', text: 'Every card acts 15% faster.', spd: 0.15 },
    pentacles: { id: 'ward', name: 'Ward', text: 'Every card starts each battle with a shield of 20% of its HP.', shield: 0.2 },
    major: { id: 'fortune', name: 'Fortune', text: 'A Legendary charm and 200 stardust, at once.', dust: 200, item: true },
};
export const CURSES = {
    wands: { id: 'weakened', name: 'Weakened', text: 'Every card strikes 15% softer.', atk: -0.15 },
    cups: { id: 'poisoned', name: 'Poisoned', text: 'Every card loses 3% of its HP each time it acts.', poison: 0.03 },
    swords: { id: 'slowed', name: 'Slowed', text: 'Every card acts 15% slower.', spd: -0.15 },
    pentacles: { id: 'hexed', name: 'Hexed', text: 'Stardust won from battles is halved.', dustMult: 0.5 },
    major: { id: 'cursed', name: 'Cursed', text: 'The Well forgets you: pulls do not count toward the Legendary guarantee.', pityFrozen: true },
};

/** Charms, held three at a time and armed before a battle (the Wheel Token pays out at once). */
export const ITEMS = {
    star_vial: { name: 'Star Vial', text: 'Next battle, every card starts with a shield of 35% of its HP.', glyph: '✧' },
    sun_sigil: { name: 'Sun Sigil', text: 'Double stardust from the next battle won.', glyph: '☀' },
    moon_shard: { name: 'Moon Shard', text: 'Next battle, every Hollow strikes 20% softer.', glyph: '☾' },
    wheel_token: { name: 'Wheel Token', text: 'Ten free pulls from the Well, at once.', glyph: '☸' },
};
export const ITEM_IDS = Object.keys(ITEMS);
