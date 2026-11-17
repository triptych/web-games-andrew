// Battle foes. A foe sits on lattice cells; every `every` placements it takes the next action in
// its pattern: advance (grows into an empty neighbouring cell), harden (+1 armour) or attack (hurts
// you). Clear a line through it to cut it back and hurt it. `art` is its painting's subject.

export const FOES = {
    imp: { id: 'imp', name: 'Cinder Imp', hp: 6, armor: 0, dmg: 3, pattern: ['attack', 'advance'],
        art: 'a small mischievous imp made of glowing coals, grinning, tiny bat wings, sparks drifting off it' },
    hulk: { id: 'hulk', name: 'Ash Hulk', hp: 12, armor: 1, dmg: 2, pattern: ['harden', 'advance', 'attack'],
        art: 'a lumbering hunchbacked brute of packed grey ash and cinders with heavy fists and dim orange eyes' },
    warden: { id: 'warden', name: 'The Ember Warden', hp: 60, armor: 2, dmg: 5, pattern: ['advance', 'harden', 'attack'], boss: true,
        art: 'a towering armoured sentinel of black iron with a furnace in its chest blazing orange, flames licking from its helm, standing guard in a stone vault' },
    crawler: { id: 'crawler', name: 'Root Crawler', hp: 8, armor: 0, dmg: 3, pattern: ['advance', 'attack'],
        art: 'a skittering beetle-like creature woven from twisted roots and moss, with glowing green eyes' },
    vinelord: { id: 'vinelord', name: 'Vine Lord', hp: 18, armor: 1, dmg: 4, pattern: ['harden', 'advance', 'attack'],
        art: 'a regal figure of thorned vines and bark with a crown of blooming white flowers and a cruel calm face' },
    serpent: { id: 'serpent', name: 'The Dew Serpent', hp: 45, armor: 1, dmg: 5, pattern: ['advance', 'attack'], boss: true,
        art: 'a great translucent serpent of living water and dew, coiled in a misty cavern pool, droplets hanging in the air, eyes like pale moons' },
    tail: { id: 'tail', name: 'Serpent Tail', hp: 28, armor: 0, dmg: 3, pattern: ['advance', 'harden', 'attack'], art: null, artOf: 'serpent' },
    wisp: { id: 'wisp', name: 'Soot Wisp', hp: 10, armor: 0, dmg: 4, pattern: ['attack', 'advance', 'advance'],
        art: 'a drifting ghostly wisp of black soot with two burning ember eyes and a trailing smoky tail' },
    sentinel: { id: 'sentinel', name: 'Brass Sentinel', hp: 22, armor: 2, dmg: 4, pattern: ['harden', 'attack', 'advance'],
        art: 'a clockwork brass guardian with riveted plates, small gears turning in its joints and a single round glass lens eye glowing amber' },
    homunculus: { id: 'homunculus', name: 'The Ashen Homunculus', hp: 80, armor: 3, dmg: 6, pattern: ['advance', 'attack', 'harden', 'advance'], boss: true,
        art: 'a hulking misshapen homunculus of grey ash and cracked glass, glowing violet veins in its cracks, bound in broken iron hoops, looming in a ruined alchemy laboratory' },
};

/** Who turns up in each chapter's battles (the boss is authored separately). */
export const ROSTER = { 1: ['imp', 'imp', 'hulk'], 2: ['crawler', 'crawler', 'vinelord', 'imp'], 3: ['wisp', 'wisp', 'sentinel', 'hulk', 'crawler'] };
