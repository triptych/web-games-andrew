/**
 * symbols.js — the reel symbols. `base` is power at weapon level 1 before any
 * multipliers; `kind` decides what the symbol does when it fires.
 */

export const SYMBOLS = {
    blade:   { name: 'Blade',     kind: 'attack', base: 6, color: '#45f3ff', glyph: 'blade',   desc: 'Strikes your target.' },
    cannon:  { name: 'Cannon',    kind: 'attack', base: 5, color: '#ffa53a', glyph: 'cannon',  desc: 'Hits your target and pierces armor.' },
    missile: { name: 'Missile',   kind: 'attack', base: 3, color: '#ff4d6d', glyph: 'missile', desc: 'Hits every enemy.' },
    arc:     { name: 'Arc',       kind: 'attack', base: 4, color: '#b98cff', glyph: 'arc',     desc: 'Hits your target, then chains to the others.' },
    shield:  { name: 'Shield',    kind: 'shield', base: 4, color: '#4d8dff', glyph: 'shield',  desc: 'Raises a shield until your next spin.' },
    repair:  { name: 'Repair',    kind: 'repair', base: 3, color: '#46ff9a', glyph: 'repair',  desc: 'Repairs your frame.' },
    energy:  { name: 'Energy',    kind: 'energy', base: 1, color: '#ffe14d', glyph: 'energy',  desc: 'Charges the reactor (nudge, respin, hold).' },
    scrap:   { name: 'Scrap',     kind: 'scrap',  base: 4, color: '#d6a46a', glyph: 'scrap',   desc: 'Salvage — banked when the fight ends.' },
    wild:    { name: 'Overclock', kind: 'wild',   base: 0, color: '#ffffff', glyph: 'wild',    desc: 'Wild: stands in for any symbol on a line.' },
    core:    { name: 'Core',      kind: 'core',   base: 0, color: '#ff4dff', glyph: 'core',    desc: 'Scatter: 3 anywhere start Overdrive, 5 hit the Jackpot.' },
    glitch:  { name: 'Glitch',    kind: 'glitch', base: 0, color: '#6b6f80', glyph: 'glitch',  desc: 'Dead symbol. The Determinant writes these into your strips.' },
};

export const SYM_IDS = Object.keys(SYMBOLS);
export const WEAPONS = ['blade', 'cannon', 'missile', 'arc'];
/** Symbols a line can be made of (wild substitutes for these). */
export const PAYABLE = ['blade', 'cannon', 'missile', 'arc', 'shield', 'repair', 'energy', 'scrap'];

/** Multiplier for a line of n (applied on top of n × base). 2 only with the Near Miss skill. */
export const LINE_MULT = { 2: 0.6, 3: 1.5, 4: 2.5, 5: 4 };
