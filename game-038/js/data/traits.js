// ============================================================
// data/traits.js - passive abilities (GDD 4.2)
// Hooks read by game/battle.js: onDamageTaken, onDealDamage, onTurnEnd,
// statMod, resist, bindBonus, xpBonus, bondBonus.
// ============================================================

export const TRAITS = {
  forgeheart:  { id: 'forgeheart',  name: 'Forgeheart',  desc: 'Immune to Burn; heals a little whenever it is hit by Ember.',       resist: ['burn'], absorb: 'ember' },
  emberhide:   { id: 'emberhide',   name: 'Emberhide',   desc: 'Takes 25% less Ember damage.',                                      elementResist: { ember: 0.75 } },
  saltmemory:  { id: 'saltmemory',  name: 'Salt Memory', desc: 'Cannot be Muzzled, and shrugs a status off a turn early.',          resist: ['muzzle'], statusShorten: 1 },
  swiftwing:   { id: 'swiftwing',   name: 'Swiftwing',   desc: '+15% Speed, and it flees successfully far more often.',             statMod: { spd: 1.15 }, fleeBonus: 0.3 },
  bedrock:     { id: 'bedrock',     name: 'Bedrock',     desc: 'Survives a killing blow at 1 HP once per battle.',                  endure: true },
  thickscale:  { id: 'thickscale',  name: 'Thickscale',  desc: '+12% Defence and physical hits crit it less.',                      statMod: { def: 1.12 }, critResist: 0.5 },
  quickening:  { id: 'quickening',  name: 'Quickening',  desc: 'Recovers 5% of max HP at the end of each of its turns.',            regenPct: 0.05 },
  dazzle:      { id: 'dazzle',      name: 'Dazzle',      desc: 'Enemies targeting it lose 10% accuracy.',                           evade: 0.10 },
  stormborn:   { id: 'stormborn',   name: 'Stormborn',   desc: 'Storm moves cost 2 less MP and crit 10% more often.',               mpDiscount: { storm: 2 }, critBonus: { storm: 0.10 } },
  clingfast:   { id: 'clingfast',   name: 'Clingfast',   desc: 'Cannot be moved or made to flinch; immune to Fear.',                resist: ['fear'] },
  hollowed:    { id: 'hollowed',    name: 'Hollowed',    desc: 'Ashbound. Loses the name it had; harder to bind until cleansed.',   ashbound: true, bindPenalty: 0.45 },
  brightscale: { id: 'brightscale', name: 'Brightscale', desc: '+10% to all damage dealt when above half health.',                  healthyDamage: 1.10 },
  keenhunter:  { id: 'keenhunter',  name: 'Keen Hunter', desc: 'Critical hits land 10% more often and hit harder.',                 critBonus: { all: 0.10 }, critMult: 1.15 },
  ironlung:    { id: 'ironlung',    name: 'Ironlung',    desc: 'Breath moves cost 25% less MP.',                                    mpDiscountAll: 0.75 },
  hearthbond:  { id: 'hearthbond',  name: 'Hearthbond',  desc: 'Gains bond twice as fast and grants the party +5% Ember Surge.',    bondBonus: 2.0, surgeBonus: 0.05 },
  scavenger:   { id: 'scavenger',   name: 'Scavenger',   desc: 'Finds an extra material after battles it survives.',                extraDrop: true },
  wellspring:  { id: 'wellspring',  name: 'Wellspring',  desc: 'Recovers 4 MP at the end of each of its turns.',                    mpRegen: 4 },
  broodkeeper: { id: 'broodkeeper', name: 'Broodkeeper', desc: 'Eggs it parents incubate in two-thirds the time.',                  incubateMult: 0.66 },
  linewalker:  { id: 'linewalker',  name: 'Linewalker',  desc: 'Takes 20% less damage from Radiant and Gloam both.',                elementResist: { radiant: 0.8, gloam: 0.8 } },
  tempered:    { id: 'tempered',    name: 'Tempered',    desc: 'Gains 15% more experience.',                                        xpBonus: 1.15 },
  patient:     { id: 'patient',     name: 'Patient',     desc: 'Guarding also restores 8% of max HP.',                              guardHeal: 0.08 },
  namebearer:  { id: 'namebearer',  name: 'Namebearer',  desc: 'Bindings thrown while this dragon is out are 20% more likely.',     bindBonus: 1.20 },
};

export const TRAIT_IDS = Object.keys(TRAITS);
export const trait = id => TRAITS[id] || null;

/** Traits a dragon can roll at Drake / Wyrm stage, excluding lineage signatures. */
export const ROLLABLE_TRAITS = TRAIT_IDS.filter(id => !['hollowed'].includes(id));
