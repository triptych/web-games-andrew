// Every table in the game: creatures, foes, cards, relics, boons, encounters, acts and events.
// Pure data. The rules that read it are in battle.js and game.js.

// ---------------------------------------------------------------------------------------------
// Creatures you can field. Stats are per creature; a stack is a count of them (Heroes-style).
//   hp dmg atk def spd: hit points, damage dealt, attack and defence skill, hexes per move
//   rng: shoots instead of walking up; fly: passes over everything; tier gates where they're sold
//   cost: gold per creature; sig: the signature card the stack brings to your deck
// ---------------------------------------------------------------------------------------------
export const CREATURES = {
    pikemen:   { name: 'Pikemen',          tier: 1, hp: 10,  dmg: 2,  atk: 4,  def: 5,  spd: 2, cost: 15,   sig: 'brace',     blurb: 'Steady village levies behind a hedge of ash-wood pikes.' },
    bowmen:    { name: 'Longbowmen',       tier: 1, hp: 8,   dmg: 3,  atk: 5,  def: 3,  spd: 2, cost: 20,   sig: 'aimed',     rng: true, blurb: 'Yeomen with yew bows taller than they are.' },
    wolves:    { name: 'Dire Wolves',      tier: 2, hp: 20,  dmg: 5,  atk: 6,  def: 3,  spd: 4, cost: 40,   sig: 'packhunt',  blurb: 'Shoulder-high and clever. They hunt in a ring.' },
    dwarves:   { name: 'Dwarf Shieldwall', tier: 2, hp: 26,  dmg: 4,  atk: 5,  def: 9,  spd: 2, cost: 50,   sig: 'shieldwall', blurb: 'Stone-folk who lock shields and do not step back.' },
    mages:     { name: 'Hedge Mages',      tier: 3, hp: 22,  dmg: 7,  atk: 7,  def: 4,  spd: 2, cost: 75,   sig: 'mend',      rng: true, blurb: 'Village wise-folk who learned a little too much.' },
    griffins:  { name: 'Griffins',         tier: 3, hp: 40,  dmg: 9,  atk: 8,  def: 7,  spd: 5, cost: 105,  sig: 'swoop',     fly: true, retalAll: true, blurb: 'Eagle-fronted, lion-backed. They answer every blow.' },
    knights:   { name: 'Knights Errant',   tier: 4, hp: 70,  dmg: 15, atk: 11, def: 10, spd: 4, cost: 200,  sig: 'lance',     blurb: 'Questing knights on barded destriers. Their charge grows with the gallop.' },
    ogres:     { name: 'Hill Ogres',       tier: 4, hp: 90,  dmg: 16, atk: 9,  def: 7,  spd: 2, cost: 180,  sig: 'smash',     blurb: 'Paid in mutton. Swing tree trunks.' },
    oaks:      { name: 'Elder Oaks',       tier: 5, hp: 160, dmg: 22, atk: 10, def: 14, spd: 1, cost: 360,  sig: 'entangle',  blurb: 'Old trees that remember being angry.' },
    moonhorns: { name: 'Moonhorns',        tier: 5, hp: 120, dmg: 20, atk: 13, def: 12, spd: 5, cost: 400,  sig: 'moonlight', blurb: 'Silver unicorns. Where they tread, wounds close.' },
    drakes:    { name: 'Copper Drakes',    tier: 6, hp: 200, dmg: 32, atk: 15, def: 13, spd: 5, cost: 720,  sig: 'breath',    fly: true, blurb: 'Young dragons with copper scales and short tempers.' },
    wyrm:      { name: 'Golden Wyrm',      tier: 7, hp: 420, dmg: 60, atk: 22, def: 20, spd: 6, cost: 1800, sig: 'sunfire',   fly: true, blurb: 'A dragon of the old sun. It came because you asked politely.' },
};

// ---------------------------------------------------------------------------------------------
// Foes. Same stats, plus a move list the intent picker draws from (Spire-style: it shows its next
// move at the start of your turn). Moves:
//   attack (melee: walk up and hit, ×mult)   shoot (ranged, ×mult)   ward (block, share of stack hp)
//   cry (all foes gain Might)   hex (a status on one of your stacks, at any range)
//   curse (shuffle a curse card into your discard)   summon (more foes)   breath (a line of 3 hexes)
//   sweep (everything adjacent)   roar (every one of your stacks gets a status)   regen
// `w` weights a move; a foe never picks the same move three times running. Bosses cycle in order.
// ---------------------------------------------------------------------------------------------
const A = (mult = 1, extra = {}) => ({ k: 'attack', mult, w: 3, ...extra });
const S = (mult = 1, extra = {}) => ({ k: 'shoot', mult, w: 3, ...extra });
const W = (f = 0.25, w = 1) => ({ k: 'ward', f, w });

export const FOES = {
    // Act I: the Gloaming Marches
    goblins:   { name: 'Goblin Rabble',   hp: 5,   dmg: 2,  atk: 3,  def: 2,  spd: 3, moves: [A(), W(0.2)] },
    slingers:  { name: 'Goblin Slingers', hp: 4,   dmg: 2,  atk: 3,  def: 1,  spd: 2, rng: true, moves: [S(), S(1.3, { w: 1 })] },
    skeletons: { name: 'Skeletons',       hp: 9,   dmg: 2,  atk: 4,  def: 6,  spd: 2, moves: [A(), W(0.3)] },
    worgs:     { name: 'Worg Riders',     hp: 16,  dmg: 4,  atk: 5,  def: 3,  spd: 5, pref: 'weak', moves: [A(), A(1.4, { w: 1 })] },
    bandits:   { name: 'Brigands',        hp: 12,  dmg: 3,  atk: 5,  def: 4,  spd: 3, moves: [A(), A(0.8, { st: ['weak', 1], w: 2 }), W(0.25)] },
    orcs:      { name: 'Orc Reavers',     hp: 22,  dmg: 6,  atk: 7,  def: 5,  spd: 3, moves: [A(), A(1.5, { w: 1 }), { k: 'cry', p: 25, w: 1 }] },
    shamans:   { name: 'Orc Shamans',     hp: 18,  dmg: 4,  atk: 6,  def: 4,  spd: 2, rng: true, moves: [S(), { k: 'hex', st: ['weak', 2], w: 2 }, { k: 'cry', p: 30, w: 1 }] },
    brutes:    { name: 'Ogre Brutes',     hp: 95,  dmg: 17, atk: 9,  def: 6,  spd: 2, moves: [A(), A(1.6, { w: 1 }), W(0.2)] },
    grubnak:   { name: 'Grubnak the Goblin King', hp: 400, dmg: 34, atk: 9, def: 8, spd: 3, boss: true, cycle: true,
                 moves: [{ k: 'summon', key: 'goblins', n: 18 }, A(1), { k: 'cry', p: 35 }, A(1.4), { k: 'ward', f: 0.25 }] },

    // Act II: the Barrow Fens
    zombies:   { name: 'Bog Zombies',     hp: 18,  dmg: 4,  atk: 4,  def: 4,  spd: 1, moves: [A()] },
    ghouls:    { name: 'Ghouls',          hp: 24,  dmg: 6,  atk: 7,  def: 4,  spd: 3, moves: [A(), A(0.8, { st: ['root', 1], w: 2 })] },
    cultists:  { name: 'Mire Cultists',   hp: 20,  dmg: 5,  atk: 6,  def: 4,  spd: 2, rng: true, moves: [S(), { k: 'hex', st: ['vuln', 2], w: 2 }, { k: 'curse', card: 'doubt', w: 1 }] },
    lizards:   { name: 'Lizardfolk',      hp: 30,  dmg: 7,  atk: 8,  def: 7,  spd: 3, moves: [A(), W(0.3), A(1.3, { w: 1 })] },
    spiders:   { name: 'Giant Spiders',   hp: 34,  dmg: 8,  atk: 8,  def: 5,  spd: 4, pref: 'weak', moves: [A(), { k: 'hex', st: ['root', 1], w: 2 }] },
    wraiths:   { name: 'Wraiths',         hp: 40,  dmg: 9,  atk: 9,  def: 6,  spd: 4, fly: true, drain: true, moves: [A(), A(1.3, { st: ['weak', 1], w: 1 })] },
    trolls:    { name: 'Fen Trolls',      hp: 90,  dmg: 15, atk: 10, def: 6,  spd: 3, regen: 0.15, moves: [A(), A(1.5, { w: 1 })] },
    basilisks: { name: 'Basilisks',       hp: 170, dmg: 22, atk: 11, def: 10, spd: 2, moves: [A(), { k: 'hex', st: ['stun', 1], w: 1 }, A(1.2, { w: 2 })] },
    murkwater: { name: 'Mother Murkwater, the Fen Hag', hp: 650, dmg: 26, atk: 12, def: 10, spd: 2, rng: true, boss: true, cycle: true,
                 moves: [{ k: 'summon', key: 'zombies', n: 12 }, { k: 'roar', st: ['vuln', 1] }, S(1.5), { k: 'curse', card: 'doubt' }, { k: 'hex', st: ['stun', 1] }, S(1.2)] },

    // Act III: the Cinder Throne
    hellhounds: { name: 'Hellhounds',     hp: 45,  dmg: 12, atk: 11, def: 7,  spd: 6, pref: 'weak', moves: [A(1, { st: ['burn', 2] }), A(1.3, { w: 1 })] },
    gargoyles: { name: 'Gargoyles',       hp: 55,  dmg: 11, atk: 10, def: 13, spd: 5, fly: true, moves: [A(), W(0.35)] },
    minotaurs: { name: 'Minotaurs',       hp: 110, dmg: 22, atk: 14, def: 10, spd: 4, moves: [A(), A(1.6, { w: 1 }), { k: 'cry', p: 25, w: 1 }] },
    salamanders: { name: 'Salamanders',   hp: 60,  dmg: 14, atk: 12, def: 9,  spd: 3, rng: true, moves: [S(1, { st: ['burn', 2] }), S(1.3, { w: 1 })] },
    giants:    { name: 'Fire Giants',     hp: 400, dmg: 50, atk: 16, def: 14, spd: 2, moves: [A(), { k: 'sweep', mult: 0.8, w: 2 }, W(0.2)] },
    gloomeye:  { name: 'The Gloomeye',    hp: 520, dmg: 34, atk: 15, def: 12, spd: 1, rng: true, fly: true,
                 moves: [S(1.2), { k: 'hex', st: ['stun', 1], w: 2 }, { k: 'roar', st: ['weak', 1], w: 1 }] },
    ashmaw:    { name: 'Ashmaw the Red', hp: 2100, dmg: 85, atk: 20, def: 18, spd: 5, fly: true, boss: true, cycle: true,
                 moves: [{ k: 'roar', st: ['weak', 1] }, { k: 'breath', mult: 1.3, st: ['burn', 2] }, A(1.1), { k: 'summon', key: 'salamanders', n: 4 }, { k: 'sweep', mult: 0.9 }, { k: 'ward', f: 0.15 }] },
};

export const BOSSES = ['grubnak', 'murkwater', 'ashmaw'];

// ---------------------------------------------------------------------------------------------
// Cards. Every order you give in battle is a card.
//   kind: move | attack | ward | buff | spell | heal | draw | earthwork | special | curse
//   actor: who carries it out: 'any' of your stacks, 'melee' or 'ranged' only, or one creature key
//          (a signature card: only that stack can, and with it gone the card is a dead draw)
//   target: enemy | ally | hex | empty | none
//   up: what changes when the card is inscribed (upgraded) at a campfire or shrine
// Text placeholders: {m} attack multiplier %, {s} spell damage, {w} ward %, {h} heal %.
// ---------------------------------------------------------------------------------------------
export const CARDS = {
    // ---- starters
    strike:    { name: 'Strike',         cost: 1, kind: 'attack', rarity: 'starter', actor: 'any', target: 'enemy', mult: 1, text: 'A stack attacks at {m}. Walkers march into reach first.', up: { mult: 1.3 } },
    holdfast:  { name: 'Hold Fast',      cost: 1, kind: 'ward',   rarity: 'starter', actor: 'any', target: 'ally', ward: 0.3, text: 'A stack gains Ward equal to {w} of its health.', up: { ward: 0.45 } },
    onslaught: { name: 'Onslaught',      cost: 2, kind: 'attack', rarity: 'starter', actor: 'melee', target: 'enemy', mult: 1.6, bonus: 1, text: 'A walker moves up to its speed +1 and attacks at {m}.', up: { mult: 2.1 } },
    firebolt:  { name: 'Firebolt',       cost: 1, kind: 'spell',  rarity: 'starter', target: 'enemy', base: 14, per: 10, text: 'Hurl {s} fire at a foe.', up: { base: 22, per: 14 } },

    // ---- common
    march:     { name: 'Double Time',    cost: 0, kind: 'move',   rarity: 'common', actor: 'any', target: 'hex', free: true, text: 'A stack moves again, up to its speed, even if it has moved.', up: { bonus: 2, text: 'A stack moves again, up to its speed +2, even if it has moved.' } },
    volley:    { name: 'Volley',         cost: 1, kind: 'attack', rarity: 'common', actor: 'ranged', target: 'enemy', mult: 0.7, twice: true, text: 'An archer stack shoots twice at {m}.', up: { mult: 0.9 } },
    shieldbash: { name: 'Shield Bash',   cost: 1, kind: 'attack', rarity: 'common', actor: 'melee', target: 'enemy', mult: 0.8, st: [['weak', 2]], text: 'Attack at {m}. The foe is Weakened for 2 turns.', up: { mult: 1.1 } },
    rallycry:  { name: 'Rally Cry',      cost: 1, kind: 'buff',   rarity: 'common', target: 'none', all: true, might: 25, text: 'All your stacks gain Might: +25% damage this turn.', up: { might: 40, text: 'All your stacks gain Might: +40% damage this turn.' } },
    scout:     { name: 'Scout Ahead',    cost: 0, kind: 'draw',   rarity: 'common', target: 'none', n: 2, text: 'Draw 2 cards.', up: { n: 3, text: 'Draw 3 cards.' } },
    quickstep: { name: 'Quickened Step', cost: 0, kind: 'buff',   rarity: 'common', actor: 'any', target: 'ally', st: [['haste', 1]], refreshMove: true, text: 'A stack gets +2 speed this turn and may move again.', up: { cost: 0, st: [['haste', 2]], text: 'A stack gets +2 speed for 2 turns and may move again.' } },
    frostbind: { name: 'Frostbind',      cost: 1, kind: 'spell',  rarity: 'common', target: 'enemy', base: 8, per: 6, st: [['root', 1]], text: 'Deal {s} cold and Root the foe: it cannot move next turn.', up: { base: 14, per: 8 } },
    frailty:   { name: 'Hex of Frailty', cost: 1, kind: 'spell',  rarity: 'common', target: 'enemy', base: 0, per: 0, st: [['vuln', 2]], text: 'A foe is Vulnerable for 2 turns: it takes 50% more.', up: { cost: 0 } },
    enfeeble:  { name: 'Enfeeble',       cost: 1, kind: 'spell',  rarity: 'common', target: 'enemy', base: 0, per: 0, st: [['weak', 2]], text: 'A foe is Weakened for 2 turns: it deals 25% less.', up: { cost: 0 } },
    feint:     { name: 'Feint',          cost: 0, kind: 'attack', rarity: 'common', actor: 'any', target: 'enemy', mult: 0.5, noRetal: true, text: 'Attack at {m}. The foe cannot strike back.', up: { mult: 0.75 } },
    guidingbolt: { name: 'Guiding Bolt', cost: 1, kind: 'spell',  rarity: 'common', target: 'enemy', base: 10, per: 6, st: [['vuln', 1]], text: 'Deal {s} radiance. The foe is Vulnerable for a turn.', up: { base: 16, per: 9 } },
    sparks:    { name: 'Spark Shower',   cost: 1, kind: 'spell',  rarity: 'common', target: 'none', allFoes: true, base: 6, per: 5, text: 'Deal {s} to every foe.', up: { base: 10, per: 7 } },
    earthwork: { name: 'Raise Earthwork', cost: 1, kind: 'earthwork', rarity: 'common', target: 'empty', text: 'Raise a rock on an empty hex. Walkers must go around it.', up: { cost: 0 } },
    entrench:  { name: 'Entrench',       cost: 2, kind: 'ward',   rarity: 'common', target: 'none', all: true, ward: 0.18, text: 'All your stacks gain Ward equal to {w} of their health.', up: { ward: 0.26 } },

    // ---- uncommon
    taunt:     { name: 'Challenge',      cost: 1, kind: 'ward',   rarity: 'uncommon', actor: 'any', target: 'ally', ward: 0.25, st: [['taunt', 1]], text: 'A stack gains {w} Ward and calls out: foes that can reach it must attack it.', up: { ward: 0.4 } },
    flankblow: { name: 'Pincer',         cost: 1, kind: 'attack', rarity: 'uncommon', actor: 'melee', target: 'enemy', mult: 0.9, flankPer: 0.45, text: 'Attack at {m}, +45% for each other stack of yours touching the foe.', up: { mult: 1.2 } },
    cleave:    { name: 'Cleave',         cost: 2, kind: 'attack', rarity: 'uncommon', actor: 'melee', target: 'enemy', mult: 1.1, cleave: 0.6, text: 'Attack at {m}, then strike every other foe beside you at 60%.', up: { mult: 1.4, cleave: 0.8 } },
    chain:     { name: 'Chain Lightning', cost: 2, kind: 'spell', rarity: 'uncommon', target: 'enemy', base: 16, per: 10, chain: 2, text: 'Deal {s}, then 70% of it leaps to the 2 nearest other foes.', up: { base: 24, per: 13 } },
    haste:     { name: 'Haste',          cost: 1, kind: 'buff',   rarity: 'uncommon', target: 'none', all: true, st: [['haste', 1]], text: 'All your stacks get +2 speed this turn.', up: { cost: 0 } },
    bless:     { name: 'Bless',          cost: 1, kind: 'buff',   rarity: 'uncommon', actor: 'any', target: 'ally', might: 60, text: 'A stack gains Might: +60% damage this turn.', up: { might: 90, text: 'A stack gains Might: +90% damage this turn.' } },
    teleport:  { name: 'Dimension Door', cost: 1, kind: 'move',   rarity: 'uncommon', actor: 'any', target: 'hex', tele: true, free: true, text: 'A stack steps to any empty hex, even if it has moved.', up: { cost: 0 } },
    laststand: { name: 'Last Stand',     cost: 1, kind: 'ward',   rarity: 'uncommon', actor: 'any', target: 'ally', ward: 0.2, desperate: 0.6, text: 'A stack gains {w} Ward, or 60% if it has lost half its number this battle.', up: { ward: 0.3, desperate: 0.8, text: 'A stack gains {w} Ward, or 80% if it has lost half its number this battle.' } },
    study:     { name: 'Study the Field', cost: 1, kind: 'draw',  rarity: 'uncommon', target: 'none', n: 3, text: 'Draw 3 cards.', up: { n: 4, text: 'Draw 4 cards.' } },
    inkreserve: { name: 'Ink Reserve',   cost: 0, kind: 'draw',   rarity: 'uncommon', target: 'none', n: 0, ink: 2, exhaust: true, text: 'Gain 2 ink. Spent for the battle.', up: { ink: 3, text: 'Gain 3 ink. Spent for the battle.' } },
    secondwind: { name: 'Second Wind',   cost: 1, kind: 'buff',   rarity: 'uncommon', actor: 'any', target: 'ally', refreshMove: true, refreshAtk: true, exhaust: true, text: 'A stack may move and attack again this turn. Spent for the battle.', up: { cost: 0 } },
    fielddress: { name: 'Field Dressing', cost: 1, kind: 'heal',  rarity: 'uncommon', actor: 'any', target: 'ally', frac: 0.3, exhaust: true, text: '{h} of a stack\'s fallen this battle get back up. Spent for the battle.', up: { frac: 0.5 } },

    // ---- rare
    meteor:    { name: 'Meteor',         cost: 3, kind: 'spell',  rarity: 'rare', target: 'hex', area: 1, base: 40, per: 22, text: 'Deal {s} to every stack on and around a hex, yours too.', up: { cost: 2 } },
    resurrect: { name: 'Raise the Fallen', cost: 2, kind: 'heal', rarity: 'rare', target: 'none', all: true, frac: 0.4, exhaust: true, text: '{h} of every stack\'s fallen this battle rise again. Spent for the battle.', up: { frac: 0.6 } },
    fury:      { name: 'Battle Fury',    cost: 1, kind: 'attack', rarity: 'rare', actor: 'any', target: 'enemy', mult: 1.2, onKill: true, text: 'Attack at {m}. If the foe is destroyed, the stack may attack again and you gain 1 ink.', up: { mult: 1.6 } },
    prayer:    { name: 'Prayer of Valor', cost: 2, kind: 'buff',  rarity: 'rare', target: 'none', all: true, might: 35, ward: 0.12, text: 'All your stacks gain {w} Ward and +35% damage this turn.', up: { might: 55, ward: 0.2, text: 'All your stacks gain {w} Ward and +55% damage this turn.' } },
    sleep:     { name: 'Slumber',        cost: 2, kind: 'spell',  rarity: 'rare', target: 'enemy', base: 0, per: 0, st: [['stun', 1]], notBoss: true, text: 'A foe (not a boss) falls asleep and loses its next move.', up: { cost: 1 } },
    warhost:   { name: 'War Host',       cost: 3, kind: 'special', rarity: 'rare', target: 'none', fx: 'warhost', mult: 0.7, text: 'Every stack that has not attacked strikes the nearest foe it can reach at {m}.', up: { mult: 0.95 } },
    mire:      { name: 'Sucking Mire',   cost: 2, kind: 'spell',  rarity: 'rare', target: 'none', allFoes: true, base: 0, per: 0, st: [['root', 1], ['vuln', 1]], text: 'Every foe is Rooted and Vulnerable for a turn.', up: { cost: 1 } },

    // ---- signature: one per creature; the stack brings it to your deck
    brace:     { name: 'Set Pikes',      cost: 1, kind: 'ward',   rarity: 'sig', actor: 'pikemen', target: 'none', ward: 0.35, st: [['brace', 1]], text: 'Pikemen gain {w} Ward and strike back at double strength until your next turn.', up: { ward: 0.5 } },
    aimed:     { name: 'Aimed Shot',     cost: 1, kind: 'attack', rarity: 'sig', actor: 'bowmen', target: 'enemy', mult: 1.5, pierce: true, text: 'Longbowmen shoot at {m}, straight through Ward.', up: { mult: 2 } },
    packhunt:  { name: 'Pack Hunt',      cost: 1, kind: 'attack', rarity: 'sig', actor: 'wolves', target: 'enemy', mult: 1, flankPer: 0.4, noRetal: true, text: 'Dire Wolves attack at {m}, +40% for each other stack touching the foe. No strike back.', up: { mult: 1.3 } },
    shieldwall: { name: 'Shield Wall',   cost: 1, kind: 'ward',   rarity: 'sig', actor: 'dwarves', target: 'none', ward: 0.4, adj: 0.2, text: 'Dwarves gain {w} Ward; every stack of yours beside them gains 20%.', up: { ward: 0.55, adj: 0.3 } },
    mend:      { name: 'Mending Words',  cost: 1, kind: 'heal',   rarity: 'sig', actor: 'mages', target: 'ally', perUnit: 8, text: 'Hedge Mages heal a stack 8 health per mage, raising its fallen.', up: { perUnit: 12, text: 'Hedge Mages heal a stack 12 health per mage, raising its fallen.' } },
    swoop:     { name: 'Swoop',          cost: 1, kind: 'attack', rarity: 'sig', actor: 'griffins', target: 'enemy', mult: 1.1, swoop: true, text: 'Griffins dive on any foe at {m} and fly back to where they were.', up: { mult: 1.5 } },
    lance:     { name: 'Couched Lance',  cost: 2, kind: 'attack', rarity: 'sig', actor: 'knights', target: 'enemy', mult: 1, joust: 0.3, bonus: 1, text: 'Knights charge at {m}, +30% for every hex they gallop first.', up: { cost: 1 } },
    smash:     { name: 'Boulder Smash',  cost: 1, kind: 'attack', rarity: 'sig', actor: 'ogres', target: 'enemy', mult: 1.25, knock: true, st: [['weak', 1]], text: 'Ogres attack at {m}, knock the foe back a hex and Weaken it.', up: { mult: 1.6 } },
    entangle:  { name: 'Grasping Roots', cost: 1, kind: 'special', rarity: 'sig', actor: 'oaks', target: 'none', fx: 'entangle', mult: 0.4, text: 'Every foe within 2 hexes of the Oaks is Rooted and takes {m} of their damage.', up: { mult: 0.65 } },
    moonlight: { name: 'Moonlight',      cost: 1, kind: 'special', rarity: 'sig', actor: 'moonhorns', target: 'none', fx: 'moonlight', perUnit: 30, text: 'Every stack of yours within 2 hexes heals 30 per Moonhorn and loses its ailments.', up: { perUnit: 45, text: 'Every stack of yours within 2 hexes heals 45 per Moonhorn and loses its ailments.' } },
    breath:    { name: 'Copper Breath',  cost: 2, kind: 'attack', rarity: 'sig', actor: 'drakes', target: 'enemy', mult: 1.2, line: 2, st: [['burn', 2]], text: 'Drakes breathe on a foe they can reach at {m}, and on the hex behind it. Burns.', up: { mult: 1.6 } },
    sunfire:   { name: 'Sunfire',        cost: 3, kind: 'special', rarity: 'sig', actor: 'wyrm', target: 'none', fx: 'sunfire', mult: 0.8, text: 'The Wyrm scorches every foe at {m} of its damage.', up: { cost: 2 } },

    // ---- curses: dead draws an enemy or an event slips into your deck
    doubt:     { name: 'Doubt',          cost: 0, kind: 'curse', rarity: 'curse', target: 'none', unplayable: true, ethereal: true, text: 'Unplayable. Fades from your hand at the end of the turn.' },
    wound:     { name: 'Old Wound',      cost: 0, kind: 'curse', rarity: 'curse', target: 'none', unplayable: true, text: 'Unplayable.' },
    guilt:     { name: 'Guilt',          cost: 0, kind: 'curse', rarity: 'curse', target: 'none', unplayable: true, text: 'Unplayable. It sits in your hand like a stone.' },
};

export const RARITY_W = { common: 60, uncommon: 32, rare: 8 };

// ---------------------------------------------------------------------------------------------
// Relics: things the General carries. Each is a flag the rules check by id.
// ---------------------------------------------------------------------------------------------
export const RELICS = {
    ledger:   { name: "Quartermaster's Ledger", rarity: 'common', glyph: 'book',   text: 'Draw 2 more cards on the first turn of each battle.' },
    banner:   { name: 'Banner of the Old Keep', rarity: 'common', glyph: 'banner', text: 'Your stacks begin each battle with Ward equal to 12% of their health.' },
    inkwell:  { name: 'Inkwell of Plenty',      rarity: 'common', glyph: 'ink',    text: 'Gain 1 extra ink on the first turn of each battle.' },
    surgeon:  { name: "Barber-Surgeon's Kit",   rarity: 'common', glyph: 'kit',    text: 'Half of each battle\'s fallen rejoin afterwards, not a third.' },
    boots:    { name: 'Boots of Striding',      rarity: 'uncommon', glyph: 'boot', text: 'All your stacks move 1 hex further.' },
    whetstone: { name: 'Dwarven Whetstone',     rarity: 'common', glyph: 'stone',  text: '+2 Attack for every creature.' },
    crest:    { name: 'Tower Shield Crest',     rarity: 'common', glyph: 'shield', text: '+2 Defence for every creature.' },
    lantern:  { name: 'Lantern of Lore',        rarity: 'uncommon', glyph: 'lamp', text: '+1 Lore: every spell burns hotter.' },
    purse:    { name: 'Tithe Purse',            rarity: 'common', glyph: 'purse',  text: 'Win 25% more gold.' },
    candle:   { name: 'Ever-burning Candle',    rarity: 'uncommon', glyph: 'candle', text: 'At the start of each of your turns, a random foe takes 6 + 6 per Lore.' },
    wardstone: { name: 'Wardstone',             rarity: 'uncommon', glyph: 'rune', text: 'All Ward you gain is half again as strong.' },
    drum:     { name: 'War Drum',               rarity: 'uncommon', glyph: 'drum', text: 'The first attack each turn deals 50% more.' },
    d20:      { name: 'Ivory Twenty-Sider',     rarity: 'rare', glyph: 'die',      text: 'Every attack rolls a d20. On a natural 20 it deals triple.' },
    satchel:  { name: 'Bottomless Satchel',     rarity: 'rare', glyph: 'bag',      text: 'At the end of your turn keep up to 2 cards in hand.' },
    sigil:    { name: 'Sigil of Command',       rarity: 'rare', glyph: 'sigil',    text: 'The first attack card you play each turn costs nothing.' },
    horn:     { name: 'Horn of the Last Charge', rarity: 'uncommon', glyph: 'horn', text: 'The first time each battle a stack falls below half its number, it gains 30% Ward.' },
    mapcase:  { name: "Cartographer's Case",    rarity: 'common', glyph: 'map',    text: 'Recruiting at dwellings costs 15% less.' },
    // boss relics: strong, with a price
    crown:    { name: 'Crown of the Usurper',   rarity: 'boss', glyph: 'crown',    text: '+1 ink every turn. Recruits cost 40% more.' },
    grail:    { name: 'Grail of the Fen',       rarity: 'boss', glyph: 'grail',    text: '+1 ink every turn. Resting at a campfire raises only half as many.' },
    astrolabe: { name: 'Brass Astrolabe',       rarity: 'boss', glyph: 'astro',    text: 'Draw 1 more card every turn. Start each battle with a Doubt in hand.' },
    warhorn:  { name: 'Warhorn of the Hosts',   rarity: 'boss', glyph: 'horn',     text: 'Your legion may hold 6 stacks. +1 Attack and Defence.' },
};

/** Level-up boons for the General, three offered at a time. */
export const BOONS = {
    atk:   { name: 'Weapon Drill',   text: '+3 Attack for every creature.' },
    def:   { name: 'Shield Drill',   text: '+3 Defence for every creature.' },
    lore:  { name: 'Study the Grimoire', text: '+1 Lore: spells hit harder.' },
    gold:  { name: 'Spoils of War',  text: 'Gain 120 gold now.' },
    levy:  { name: 'Muster',         text: 'Every stack is reinforced by 15% of its full number.' },
    draw:  { name: 'Battle Sense',   text: 'Draw 1 more card on the first turn of each battle.' },
    ink:   { name: 'Deep Inkwell',   text: '+1 ink on the first turn of each battle.' },
};

// ---------------------------------------------------------------------------------------------
// Acts and their encounters. Counts grow with the floor: × (1 + 0.07 · floor).
// ---------------------------------------------------------------------------------------------
export const ACT_INFO = [
    { name: 'The Gloaming Marches', sub: 'Book I', boss: 'grubnak', tiers: 3, ground: 0xe9dcb8, wash: 0x6b8a4a,
      skirm: [
          [['goblins', 26], ['slingers', 12]],
          [['skeletons', 18], ['goblins', 14]],
          [['bandits', 14], ['slingers', 10]],
          [['worgs', 7], ['goblins', 18]],
          [['bandits', 12], ['skeletons', 12]],
      ],
      elite: [
          [['orcs', 12], ['shamans', 6]],
          [['brutes', 2], ['goblins', 16]],
          [['worgs', 10], ['orcs', 7]],
      ] },
    { name: 'The Barrow Fens', sub: 'Book II', boss: 'murkwater', tiers: 5, ground: 0xdcd6b4, wash: 0x4f7a6e,
      skirm: [
          [['zombies', 20], ['cultists', 6]],
          [['ghouls', 12], ['skeletons', 16]],
          [['lizards', 9], ['cultists', 6]],
          [['spiders', 8], ['ghouls', 8]],
          [['wraiths', 6], ['zombies', 14]],
      ],
      elite: [
          [['trolls', 3], ['cultists', 6]],
          [['basilisks', 2], ['lizards', 6]],
          [['wraiths', 8], ['spiders', 7]],
      ] },
    { name: 'The Cinder Throne', sub: 'Book III', boss: 'ashmaw', tiers: 7, ground: 0xe6d2b0, wash: 0xa8502e,
      skirm: [
          [['hellhounds', 9], ['salamanders', 5]],
          [['gargoyles', 9], ['minotaurs', 3]],
          [['minotaurs', 4], ['salamanders', 5]],
          [['hellhounds', 8], ['gargoyles', 7]],
      ],
      elite: [
          [['giants', 2], ['hellhounds', 6]],
          [['gloomeye', 1], ['gargoyles', 8]],
          [['minotaurs', 6], ['salamanders', 6]],
      ] },
];

/** Boss escorts, beside the boss itself. */
export const BOSS_ESCORT = { grubnak: [['goblins', 26], ['slingers', 14]], murkwater: [['zombies', 18], ['cultists', 6]], ashmaw: [['salamanders', 5]] };

// ---------------------------------------------------------------------------------------------
// Map node kinds.
// ---------------------------------------------------------------------------------------------
export const NODES = {
    battle:   { name: 'Skirmish',     glyph: 'swords',  text: 'A band of foes on the road.' },
    elite:    { name: 'Lair',         glyph: 'skull',   text: 'Something strong lives here. It guards a relic.' },
    dwelling: { name: 'Dwelling',     glyph: 'tower',   text: 'Creatures who will march for gold.' },
    shop:     { name: 'Scriptorium',  glyph: 'quill',   text: 'Monks who sell orders, relics, and erasures.' },
    camp:     { name: 'Campfire',     glyph: 'fire',    text: 'Rest the legion, or inscribe a card.' },
    event:    { name: 'Encounter',    glyph: 'query',   text: 'Something strange off the road.' },
    treasure: { name: 'Hoard',        glyph: 'chest',   text: 'An unguarded chest. Probably.' },
    boss:     { name: 'Boss',         glyph: 'crown',   text: 'The master of this book.' },
};

// ---------------------------------------------------------------------------------------------
// Encounters (map "?" nodes). Effects are in game.js → eventChoice; this is the page text.
// ---------------------------------------------------------------------------------------------
export const EVENTS = {
    well:     { title: 'The Wishing Well', acts: [0, 1, 2],
                text: 'A mossy well in a ring of standing stones. Coins glint far below, and something down there hums when you lean close.',
                opts: [{ label: 'Toss in 40 gold and wish', id: 'wish', gold: 40 }, { label: 'Walk on', id: 'leave' }] },
    sage:     { title: 'The Hermit Sage', acts: [0, 1, 2],
                text: 'An old woman in a hut of bark and books offers to teach your scribes. "Every lesson has a price," she says, and smiles with too many teeth.',
                opts: [{ label: 'Learn: inscribe 2 random cards', id: 'learn' }, { label: 'Ask for a rare spell (a stack loses 15%)', id: 'rare' }, { label: 'Thank her and go', id: 'leave' }] },
    peddler:  { title: 'The Goblin Peddler', acts: [0, 1],
                text: 'A goblin with a cart of junk and one very shiny thing. "Fine relic! Only slightly cursed! Hundred-twenty gold, final price, maybe."',
                opts: [{ label: 'Buy the shiny thing (120 gold)', id: 'buy', gold: 120 }, { label: 'Rob him (a fight)', id: 'rob' }, { label: 'No thanks', id: 'leave' }] },
    shrine:   { title: 'Shrine of the Pale God', acts: [0, 1, 2],
                text: 'A white idol with no face. The offerings at its feet are fresh. Your soldiers will not look at it.',
                opts: [{ label: 'Pray: +1 Lore, but a Doubt joins your deck', id: 'pray' }, { label: 'Loot the offerings: 140 gold, your largest stack loses 20%', id: 'loot' }, { label: 'Leave it be', id: 'leave' }] },
    knight:   { title: 'The Wounded Knight', acts: [0, 1, 2],
                text: 'A knight in dented plate sits against a dead horse. "My company is scattered. Bind my wounds and they will ride with you."',
                opts: [{ label: 'Bind his wounds: Knights Errant join you', id: 'help' }, { label: 'Take his purse: 100 gold and Guilt', id: 'rob' }, { label: 'Ride past', id: 'leave' }] },
    ring:     { title: 'The Mushroom Ring', acts: [0, 1],
                text: 'A perfect circle of red-capped mushrooms. Music, faintly, from nowhere. Your wolves keep looking at it.',
                opts: [{ label: 'Dance: a gamble on the legion\'s health', id: 'dance' }, { label: 'Eat a mushroom: inscribe a random card, gain an Old Wound', id: 'eat' }, { label: 'Go around', id: 'leave' }] },
    armory:   { title: 'The Abandoned Armory', acts: [0, 1, 2],
                text: 'A collapsed keep with its weapon racks still standing. There is time to strip one wall.',
                opts: [{ label: 'Take the blades: +1 Attack', id: 'atk' }, { label: 'Take the shields: +1 Defence', id: 'def' }] },
    riddle:   { title: "The Dragon's Riddle", acts: [1, 2],
                text: 'A brass dragon head set into a cliff speaks: "What has roots nobody sees, is taller than trees, up, up it goes, and yet never grows?"',
                opts: [{ label: '"A mountain."', id: 'right' }, { label: '"A tower."', id: 'wrong' }, { label: '"Your ego."', id: 'wrong' }] },
    mercs:    { title: 'The Sellsword Camp', acts: [0, 1, 2],
                text: 'A camp of hard-faced mercenaries dicing by the road. Their captain names a price for a season\'s service.',
                opts: [{ label: 'Hire them (150 gold)', id: 'hire', gold: 150 }, { label: 'Challenge them to dice (50 gold)', id: 'dice', gold: 50 }, { label: 'Move on', id: 'leave' }] },
    tome:     { title: 'The Chained Tome', acts: [1, 2],
                text: 'A book chained to a lectern in an empty chapel. Its pages turn by themselves, slowly, to a page with your name on it.',
                opts: [{ label: 'Read: 2 of your cards change into others', id: 'read' }, { label: 'Burn it: erase a card from your deck', id: 'burn' }, { label: 'Leave it chained', id: 'leave' }] },
    field:    { title: 'The Old Battlefield', acts: [0, 1, 2],
                text: 'Rusted helmets and bones among the heather. The crows have long since finished.',
                opts: [{ label: 'Scavenge: 70 gold and an Old Wound', id: 'scav' }, { label: 'Bury the dead: erase a card', id: 'bury' }] },
    crossroads: { title: 'The Fey Crossroads', acts: [1, 2],
                text: 'Four roads meet at a signpost whose arms point at things that aren\'t there. A fox in a waistcoat offers a trade.',
                opts: [{ label: 'Trade a card for a copy of another', id: 'dupe' }, { label: 'Trade 10% of every stack for a relic', id: 'relic' }, { label: 'Decline', id: 'leave' }] },
};

// every table entry knows its own key
for (const T of [CREATURES, FOES, CARDS, RELICS, BOONS, EVENTS, NODES]) for (const k in T) T[k].id = k;
