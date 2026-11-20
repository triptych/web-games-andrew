// The four heroes. Stats are at level 1; js/config.js GROWTH scales them by the party's shared level.
//
// An ability: { id, name, mp, kind, power, target, fx, lv, desc, anim }
//   kind    phys (atk vs defence) | magic (atk, mostly ignores defence) | heal | buff | debuff
//   target  foe | foes (all) | ally | fallen | self | party
//   fx      status effects: { s, p (chance), t (turns) }. Statuses: poison stun slow weak atkup taunt guard dodge mark
//   extra   drain (heal the user for a share of the damage), selfHp (costs a share of the user's max HP)
//   lv      the party level that teaches it (1 if omitted)
//   anim    what the battle stage draws

export const PARTY = {
    lyra: {
        id: 'lyra', name: 'Lyra', title: 'Wandering Mage', color: '#b48cff',
        hp: 74, mp: 58, atk: 13, def: 6, spd: 10,
        bio: 'A young mage who fled the Aethermoor Academy the night it burned, carrying a prophecy she was never meant to read.',
        abilities: [
            { id: 'strike', name: 'Staff Strike', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'slash', desc: 'A plain blow with the staff.' },
            { id: 'fireball', name: 'Fireball', mp: 8, kind: 'magic', power: 2.0, target: 'foe', anim: 'fire', desc: 'A bolt of searing flame.' },
            { id: 'frostbind', name: 'Frostbind', mp: 9, kind: 'magic', power: 1.3, target: 'foe', fx: [{ s: 'slow', p: 1, t: 3 }], anim: 'ice', desc: 'Freezes a foe: damage, and it acts at half speed for 3 turns.' },
            { id: 'remedy', name: 'Remedy', mp: 10, kind: 'heal', power: 1.0, target: 'ally', anim: 'heal', desc: 'Restores an ally\'s HP.' },
            { id: 'starfall', name: 'Starfall', mp: 20, kind: 'magic', power: 1.45, target: 'foes', lv: 7, anim: 'star', desc: 'Stars rain on every foe.' },
        ],
    },
    orin: {
        id: 'orin', name: 'Orin', title: 'Iron Vanguard', color: '#7cc8ff',
        hp: 138, mp: 28, atk: 15, def: 15, spd: 7,
        bio: 'A knight cast out of the Solarian Order for refusing an order he could not stomach. He still keeps the oath they broke.',
        abilities: [
            { id: 'slash', name: 'Slash', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'slash', desc: 'A sword stroke.' },
            { id: 'shield_bash', name: 'Shield Bash', mp: 6, kind: 'phys', power: 1.25, target: 'foe', fx: [{ s: 'stun', p: 0.45, t: 1 }], anim: 'bash', desc: 'A heavy bash that may stun the foe for a turn.' },
            { id: 'provoke', name: 'Provoke', mp: 6, kind: 'buff', target: 'self', fx: [{ s: 'taunt', p: 1, t: 2 }, { s: 'guard', p: 1, t: 1 }], anim: 'shield', desc: 'Every foe must attack Orin for 2 turns, and he braces for the first.' },
            { id: 'bulwark', name: 'Bulwark', mp: 12, kind: 'buff', target: 'party', fx: [{ s: 'guard', p: 1, t: 1 }], lv: 4, anim: 'shield', desc: 'The whole party takes half damage until Orin\'s next turn.' },
            { id: 'rally', name: 'Rallying Cry', mp: 14, kind: 'buff', target: 'party', fx: [{ s: 'atkup', p: 1, t: 3 }], lv: 8, anim: 'holy', desc: 'Every ally hits 30% harder for 3 turns.' },
        ],
    },
    sera: {
        id: 'sera', name: 'Sera', title: 'Thornwood Ranger', color: '#7cdc9c',
        hp: 94, mp: 40, atk: 15, def: 9, spd: 15,
        bio: 'An elf ranger exiled from the Thornwood Conclave for walking with humans. She has not missed a shot she cared about in years.',
        abilities: [
            { id: 'arrow', name: 'Arrow Shot', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'arrow', desc: 'A quick arrow.' },
            { id: 'triple_shot', name: 'Triple Shot', mp: 7, kind: 'phys', power: 0.75, target: 'foes', anim: 'arrows', desc: 'An arrow for every foe.' },
            { id: 'poison_arrow', name: 'Poison Arrow', mp: 6, kind: 'phys', power: 0.9, target: 'foe', fx: [{ s: 'poison', p: 0.8, t: 3 }], anim: 'arrow', desc: 'Poisons the foe for 3 turns.' },
            { id: 'shadowstep', name: 'Shadowstep', mp: 10, kind: 'phys', power: 1.8, target: 'foe', selfFx: [{ s: 'dodge', p: 1, t: 2 }], anim: 'slash', desc: 'Strikes from behind, then slips away: the next attack on Sera misses.' },
            { id: 'mark', name: 'Hunter\'s Mark', mp: 5, kind: 'debuff', target: 'foe', fx: [{ s: 'mark', p: 1, t: 3 }], lv: 6, anim: 'mark', desc: 'The marked foe takes 30% more damage for 3 turns.' },
        ],
    },
    thane: {
        id: 'thane', name: 'Thane', title: 'Soulbrand Warlock', color: '#ff8a5c',
        hp: 90, mp: 66, atk: 17, def: 8, spd: 11,
        bio: 'A former imperial warlock who broke his bond with the demon Kaelthas. The brand still burns; he has learned to aim it.',
        abilities: [
            { id: 'shadow_bolt', name: 'Shadow Bolt', mp: 0, kind: 'magic', power: 1.0, target: 'foe', anim: 'shadow', desc: 'A bolt of shadow.' },
            { id: 'soul_drain', name: 'Soul Drain', mp: 9, kind: 'magic', power: 1.5, target: 'foe', drain: 0.5, anim: 'drain', desc: 'Drains life: Thane heals half the damage.' },
            { id: 'hex', name: 'Hex', mp: 7, kind: 'debuff', target: 'foe', fx: [{ s: 'weak', p: 1, t: 3 }], anim: 'mark', desc: 'The foe hits 30% softer for 3 turns.' },
            { id: 'dark_ritual', name: 'Dark Ritual', mp: 24, kind: 'magic', power: 2.2, target: 'foes', selfHp: 0.1, anim: 'ritual', desc: 'Devastating shadow on every foe; costs a tenth of Thane\'s HP.' },
        ],
    },
};

export const PARTY_ORDER = ['lyra', 'orin', 'sera', 'thane'];
