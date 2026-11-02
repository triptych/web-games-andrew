// Things in chests and pockets. Lozenges are used from the party menu; charms are worn, one per princess.

export const ITEMS = {
    lozenge: { name: 'Honey Lozenge', icon: '🍯', desc: 'Restores 45 HP to one princess.', use: { heal: 45 } },
    tonic: { name: 'Starfruit Tonic', icon: '🧃', desc: 'Restores 50% HP to the whole band.', use: { healAllPct: 0.5 } },
    encore: { name: 'Encore Bell', icon: '🔔', desc: 'In battle: revives the whole band once when all fall. Used automatically.', auto: true },
};

/** Charms: one per princess. Effects are read by the battle and the party stats. */
export const CHARMS = {
    metronome: { name: 'Brass Metronome', icon: '⏱️', desc: 'Timing windows 20% wider for the wearer.', fx: { window: 1.2 } },
    pearl: { name: 'Moon Pearl', icon: '🦪', desc: '+20% max HP.', fx: { hp: 1.2 } },
    plume: { name: 'Sunbird Plume', icon: '🪶', desc: '+25% damage from the wearer\'s lane.', fx: { pow: 1.25 } },
    locket: { name: 'Prince\'s Locket', icon: '💗', desc: 'Crescendo charges 35% faster.', fx: { cres: 1.35 } },
    rimeglass: { name: 'Rimeglass Band', icon: '💍', desc: 'Enemy hits on the wearer\'s lane deal 30% less.', fx: { guard: 0.7 } },
    ember: { name: 'Hearth Ember', icon: '🔥', desc: 'Perfect hits restore 1 HP to the wearer.', fx: { leech: 1 } },
};
