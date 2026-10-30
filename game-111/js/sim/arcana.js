// The 22 Major Arcana: the chapters of the Restoration. Each one rekindled lights a card in the
// sky, may grant a power, and the next one brings a harder omen. Pure data.

export const ARCANA = [
    { n: 0, numeral: '0', name: 'The Fool', hue: 0.14, line: 'Every journey begins with a single step off the edge. Place the glyphs; fill a line to wake the lattice.' },
    { n: 1, numeral: 'I', name: 'The Magician', hue: 0.08, power: 'transmute', line: 'As above, so below. Sigils now glimmer on the lattice: clear a line through one for a surge of light.' },
    { n: 2, numeral: 'II', name: 'The High Priestess', hue: 0.62, line: 'Between the pillars, the veil thins. Hidden patterns wait for the patient.' },
    { n: 3, numeral: 'III', name: 'The Empress', hue: 0.33, line: 'Abundance returns. Larger glyphs of five now fall into your hand.' },
    { n: 4, numeral: 'IV', name: 'The Emperor', hue: 0.0, line: 'Order is challenged. Blight stones take root: clear a line through one twice to break it.' },
    { n: 5, numeral: 'V', name: 'The Hierophant', hue: 0.1, line: 'The old keys turn. Tradition holds the shape of things.' },
    { n: 6, numeral: 'VI', name: 'The Lovers', hue: 0.92, line: 'Two paths entwine. Clear rows and columns together for a harmony bonus.' },
    { n: 7, numeral: 'VII', name: 'The Chariot', hue: 0.55, line: 'Momentum is everything. Heavy slabs and blocks now roll into play.' },
    { n: 8, numeral: 'VIII', name: 'Strength', hue: 0.06, line: 'Gentle hands tame the lion. Patience is a kind of power.' },
    { n: 9, numeral: 'IX', name: 'The Hermit', hue: 0.5, power: 'lantern', line: 'A lantern in the dark. Call on the Hermit to place a single light anywhere.' },
    { n: 10, numeral: 'X', name: 'Wheel of Fortune', hue: 0.78, power: 'turn', line: 'What rises will fall and rise again. The Wheel lets you turn a glyph.' },
    { n: 11, numeral: 'XI', name: 'Justice', hue: 0.66, line: 'Balance is restored. Slanted glyphs test your aim.' },
    { n: 12, numeral: 'XII', name: 'The Hanged Man', hue: 0.45, line: 'See the world upside down. The lattice grows crowded with omens.' },
    { n: 13, numeral: 'XIII', name: 'Death', hue: 0.85, line: 'An ending is a door. The Void creeps: let too many moves pass without a clear and blight spreads.' },
    { n: 14, numeral: 'XIV', name: 'Temperance', hue: 0.58, line: 'Pour light from cup to cup. Measure every move.' },
    { n: 15, numeral: 'XV', name: 'The Devil', hue: 0.98, line: 'Chains of your own making. The blight runs deeper here.' },
    { n: 16, numeral: 'XVI', name: 'The Tower', hue: 0.04, power: 'strike', line: 'Lightning breaks what was built on sand. Call the Tower to shatter a 3×3 of the lattice.' },
    { n: 17, numeral: 'XVII', name: 'The Star', hue: 0.52, power: 'starfall', line: 'Hope pours down like water. Call the Star to wash away every blight.' },
    { n: 18, numeral: 'XVIII', name: 'The Moon', hue: 0.7, line: 'Illusions and tides. Few glyphs are kind beneath the moon.' },
    { n: 19, numeral: 'XIX', name: 'The Sun', hue: 0.12, line: 'Joy, warmth, clarity. The world is nearly whole.' },
    { n: 20, numeral: 'XX', name: 'Judgement', hue: 0.03, line: 'The trumpet sounds and the sleepers rise. One last trial.' },
    { n: 21, numeral: 'XXI', name: 'The World', hue: 0.4, line: 'The circle closes. Rekindle the World and magic returns to everything.' },
];

/** The powers, their costs in sparks and the arcanum that grants each. */
export const POWERS = {
    transmute: { name: 'Transmute', cost: 1, from: 1, text: 'Redeal your whole hand.' },
    lantern: { name: 'Lantern', cost: 1, from: 9, text: 'Add a single-cell glyph to your hand.' },
    turn: { name: 'Turn', cost: 1, from: 10, text: 'Rotate the chosen glyph a quarter turn.' },
    strike: { name: 'Tower Strike', cost: 2, from: 16, text: 'Shatter every cell in a 3×3.' },
    starfall: { name: 'Starfall', cost: 2, from: 17, text: 'Wash away every blight stone.' },
};
export const POWER_ORDER = ['transmute', 'lantern', 'turn', 'strike', 'starfall'];

/** The omens of arcanum i: what the lattice is like while you work toward it. */
export function omensFor(i) {
    return {
        sigils: i >= 1 ? Math.min(4, 1 + Math.floor(i / 4)) : 0,     // seeded on arrival
        blight: i >= 4 ? Math.min(5, 1 + Math.floor((i - 4) / 3)) : 0,
        blightHp: i >= 15 ? 3 : 2,
        creep: i >= 13,
        harmony: i >= 6,                                              // rows + columns at once
    };
}

/** The powers owned once the arcana in `restored` (indices) are rekindled. */
export function powersFrom(restored) {
    const set = new Set(restored);
    return Object.keys(POWERS).filter((p) => set.has(POWERS[p].from));
}
