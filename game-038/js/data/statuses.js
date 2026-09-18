// ============================================================
// data/statuses.js - the eleven battle statuses (GDD 6.3)
// `mods` are multiplicative on the stat; `tick` runs at end of the owner's turn.
// ============================================================

export const STATUSES = {
  burn:    { id: 'burn',    name: 'Burn',    icon: '\u{1F525}', bad: true,  turns: 3, mods: { atk: 0.85 }, tick: { dmgPctMax: 0.06 }, cure: 'ashwash',     onset: 'catches light', blurb: 'Losing health each turn; strikes land softer.' },
  soak:    { id: 'soak',    name: 'Soak',    icon: '\u{1F4A7}', bad: true,  turns: 3, mods: { def: 0.80 }, vuln: { storm: 1.5 },      cure: 'saltcloth',   onset: 'is drenched', blurb: 'Guard is weakened and storm damage bites deeper.' },
  chill:   { id: 'chill',   name: 'Chill',   icon: '❄',    bad: true,  turns: 3, mods: { spd: 0.65 }, cure: 'frostroot',                              onset: 'goes cold', blurb: 'Slowed; acts later in the round.' },
  blight:  { id: 'blight',  name: 'Blight',  icon: '☠',    bad: true,  turns: 4, tick: { dmgPctMax: 0.04, ramp: 0.02 },  cure: 'venomdraw',          onset: 'starts to rot', blurb: 'Rot that worsens the longer it sits.' },
  stun:    { id: 'stun',    name: 'Stun',    icon: '\u{1F4AB}', bad: true,  turns: 1, skipTurn: true,      cure: 'clearmind',                             onset: 'is knocked senseless', blurb: 'Loses its next turn entirely.' },
  fear:    { id: 'fear',    name: 'Fear',    icon: '\u{1F628}', bad: true,  turns: 3, mods: { atk: 0.75 }, flinch: 0.25, cure: 'braveleaf',               onset: 'loses its nerve', blurb: 'Weakened, and may freeze instead of acting.' },
  muzzle:  { id: 'muzzle',  name: 'Muzzle',  icon: '\u{1F507}', bad: true,  turns: 3, noSkills: true,      cure: 'clearmind',                             onset: 'cannot find the words', blurb: 'Cannot use skills, only strike.' },
  ashen:   { id: 'ashen',   name: 'Ashen',   icon: '\u{1F32B}', bad: true,  turns: 4, mpDrain: 3, noBind: true, cure: 'clearwater',                       onset: 'greys over', blurb: 'Grey and unreachable; cannot be bound while it lasts.' },
  haste:   { id: 'haste',   name: 'Haste',   icon: '\u{1F4A8}', bad: false, turns: 4, mods: { spd: 1.45 },                                                onset: 'quickens', blurb: 'Acts sooner and more often than it should.' },
  barrier: { id: 'barrier', name: 'Barrier', icon: '\u{1F6E1}', bad: false, turns: 3, damageTaken: 0.75,                                                  onset: 'hardens over', blurb: 'Takes a quarter less damage from everything.' },
  regen:   { id: 'regen',   name: 'Regen',   icon: '\u{1F49A}', bad: false, turns: 4, tick: { healPctMax: 0.07 },                                         onset: 'begins to knit', blurb: 'Knits itself back together each turn.' },
};

export const STATUS_IDS = Object.keys(STATUSES);
export const status = id => STATUSES[id] || null;
export const isBad = id => !!(STATUSES[id] && STATUSES[id].bad);

/** How much a status helps a binding attempt (GDD 7). */
export const BIND_STATUS_BONUS = {
  stun: 2.0, chill: 1.6, soak: 1.45, fear: 1.4, blight: 1.3,
  burn: 1.25, muzzle: 1.2, ashen: 0.0,
};

export function bindStatusBonus(statusList) {
  let best = 1;
  for (const s of statusList || []) {
    const b = BIND_STATUS_BONUS[s.id];
    if (b === 0) return 0;              // Ashen blocks binding outright
    if (b && b > best) best = b;
  }
  return best;
}
