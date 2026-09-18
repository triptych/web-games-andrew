// ============================================================
// data/elements.js - the eight elements and their chart (GDD 3)
// ============================================================

export const ELEMENTS = {
  ember:   { id: 'ember',   name: 'Ember',   icon: '\u{1F525}', colour: '#ff7a33', hue: 20,  blurb: 'fire, forge, anger' },
  tide:    { id: 'tide',    name: 'Tide',    icon: '\u{1F30A}', colour: '#3aa7d8', hue: 200, blurb: 'water, salt, memory' },
  gale:    { id: 'gale',    name: 'Gale',    icon: '\u{1F343}', colour: '#8fd6c0', hue: 160, blurb: 'wind, height, speed' },
  stone:   { id: 'stone',   name: 'Stone',   icon: '\u{1FAA8}', colour: '#b0895c', hue: 30,  blurb: 'earth, weight, patience' },
  verdant: { id: 'verdant', name: 'Verdant', icon: '\u{1F33F}', colour: '#6fbf4a', hue: 100, blurb: 'growth, rot, green' },
  storm:   { id: 'storm',   name: 'Storm',   icon: '⚡',     colour: '#e3d24a', hue: 52,  blurb: 'lightning, noise' },
  gloam:   { id: 'gloam',   name: 'Gloam',   icon: '\u{1F311}', colour: '#8b74c4', hue: 270, blurb: 'ash, forgetting, dusk' },
  radiant: { id: 'radiant', name: 'Radiant', icon: '☀️', colour: '#f2e2a0', hue: 45, blurb: 'line-fire, naming, dawn' },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

/** strong[a] = list of elements `a` hits for x2. */
const STRONG = {
  ember:   ['verdant', 'gloam'],
  tide:    ['ember', 'stone'],
  gale:    ['verdant', 'stone'],
  stone:   ['storm', 'ember'],
  verdant: ['tide', 'stone'],
  storm:   ['tide', 'gale'],
  gloam:   ['radiant', 'verdant'],
  radiant: ['gloam', 'storm'],
};

/** Built from STRONG so the chart can never disagree with itself. */
export const CHART = (() => {
  const chart = {};
  for (const a of ELEMENT_IDS) {
    chart[a] = {};
    for (const d of ELEMENT_IDS) chart[a][d] = 1;
  }
  for (const [a, targets] of Object.entries(STRONG)) {
    for (const d of targets) {
      chart[a][d] = 2;
      chart[d][a] = 0.5;      // the reverse matchup is the mirror
    }
  }
  chart.radiant.radiant = 0.5; // line-fire does not burn line-fire
  return chart;
})();

/** Multiplier of one attacking element against a defender's element list. */
export function elementMultiplier(attack, defenderElements) {
  if (!attack) return 1;
  let mult = 1;
  for (const d of defenderElements) {
    if (!d) continue;
    mult *= (CHART[attack] && CHART[attack][d] !== undefined) ? CHART[attack][d] : 1;
  }
  return mult;
}

export function matchupLabel(mult) {
  if (mult >= 4) return { text: 'SUNDERED', cls: 'sundered' };
  if (mult >= 2) return { text: 'strong', cls: 'strong' };
  if (mult <= 0.25) return { text: 'shrugged off', cls: 'shrugged' };
  if (mult <= 0.5) return { text: 'weak', cls: 'weak' };
  return null;
}

/** Element pairings used by breeding to produce something neither parent had. */
export const ELEMENT_FUSIONS = [
  { parents: ['ember', 'tide'],    child: 'storm' },
  { parents: ['gale', 'stone'],    child: 'storm' },
  { parents: ['ember', 'gale'],    child: 'radiant' },
  { parents: ['tide', 'verdant'],  child: 'verdant' },
  { parents: ['gloam', 'radiant'], child: 'radiant' },
  { parents: ['stone', 'ember'],   child: 'gloam' },
  { parents: ['storm', 'gloam'],   child: 'storm' },
  { parents: ['tide', 'gale'],     child: 'tide' },
  { parents: ['verdant', 'gloam'], child: 'gloam' },
  { parents: ['radiant', 'stone'], child: 'radiant' },
];

export function fusionOf(a, b) {
  for (const f of ELEMENT_FUSIONS) {
    if ((f.parents[0] === a && f.parents[1] === b) || (f.parents[0] === b && f.parents[1] === a)) return f.child;
  }
  return null;
}

export const elementName = id => (ELEMENTS[id] ? ELEMENTS[id].name : '—');
export const elementColour = id => (ELEMENTS[id] ? ELEMENTS[id].colour : '#888');
