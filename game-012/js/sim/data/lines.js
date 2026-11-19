// The spoken lines. The Oracle (who keeps the Well) narrates; The World answers in its own voice at the end.
// Each id is a recording in audio/vo-<id>.mp3 (dev/audio/voices.mjs builds the takes from this file), and the
// same text shows as a subtitle, so the words on screen are the words you hear. Pure data.

export const ORACLE = {
    intro: 'Welcome, Cartomancer. The Great Deck has shattered, and its shadows hold the ten Thresholds. Draw from the Well, and take the world back, one card at a time.',
    t1: 'The Wandering Path. Every journey begins with a fool who will not look down.',
    t2: 'The Hidden Veil. What lurks behind it has been waiting for you.',
    t3: 'The Iron Decree. The Emperor\'s shadow does not bend. Make it break.',
    t4: 'The Relentless Advance. They are fast. Be faster, or be stronger.',
    t5: 'The Inverted World. Up is down here. Trust nothing but your cards.',
    t6: 'The Pale Crossing. What falls here does not always stay fallen.',
    t7: 'The Falling Spire. Lightning, fire and stone. Nothing stands forever.',
    t8: 'The Dream Labyrinth. The moon lies. Your fears will look very real.',
    t9: 'The Final Calling. The dead rise to judge you. Do not let them.',
    t10: 'The World Entire. This is the last door. Everything you have drawn has led you here.',
    reading: 'Three cards wait upon the cloth. Choose one, and let the Arcana speak.',
    upright: 'Upright. Fortune smiles on you.',
    reversed: 'Reversed. The cards are not kind tonight.',
    legendary: 'A Major Arcanum answers your call!',
    win: 'The Threshold is yours.',
    lost: 'The candle gutters, but it has not gone out. Draw again, and try again.',
    over: 'The deck scatters into the dark. Another night, another reading.',
    ending: 'The World is whole again, and every card has found its place. You were the hand that dealt them.',
    ascend: 'Again, then. The shadows grow longer with every turning of the wheel.',
};

export const WORLD = {
    wintro: 'I am the end of every journey, little reader. Lay down your cards.',
    wphase: 'Fire, water, air. I wear them all, and I wear them better.',
    wfall: 'Then let the circle close.',
};

/** Who speaks a line. */
export const speaker = (id) => (id in WORLD ? 'world' : 'oracle');
export const LINES = { ...ORACLE, ...WORLD };
export const LINE_IDS = Object.keys(LINES);
