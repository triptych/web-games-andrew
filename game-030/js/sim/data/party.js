// The party. Stats are at level 1; js/config.js GROWTH scales them by the party's shared level.
//
// An ability: { id, name, mp, kind, power, target, fx, lv, desc, anim }
//   kind    phys (atk vs defence) | magic (atk, mostly ignores defence) | heal | buff | debuff
//   target  foe | foes (all) | ally | fallen | self | party
//   fx      status effects: { s, p (chance), t (turns) }. Statuses: stun rust weak atkup taunt guard dodge
//   lv      the party level that teaches it (1 if omitted)
//   anim    what the battle stage draws

export const PARTY = {
    wick: {
        id: 'wick', name: 'Wick', title: 'Handy Newcomer', color: '#8fd0c8',
        hp: 72, mp: 30, atk: 12, def: 6, spd: 10,
        bio: 'Arrived in Coppergate Lane with a toolbag and a reputation for fixing things nobody asked about.',
        abilities: [
            { id: 'swing', name: 'Wrench Swing', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'slash', desc: 'A plain whack with the wrench.' },
            { id: 'overclock', name: 'Overclock', mp: 8, kind: 'phys', power: 1.9, target: 'foe', anim: 'spark', desc: 'A focused, over-tightened burst on one foe.' },
            { id: 'patch', name: 'Patch Up', mp: 9, kind: 'heal', power: 1.0, target: 'ally', anim: 'heal', desc: 'Tape, glue and good wishes: restores an ally\'s HP.' },
            { id: 'scatter', name: 'Scatter-Gear', mp: 13, kind: 'magic', power: 1.0, target: 'foes', lv: 3, anim: 'gears', desc: 'Flings a pocketful of gears at every foe.' },
            { id: 'jury_rig', name: 'Jury-Rig', mp: 9, kind: 'phys', power: 0.9, target: 'foe', fx: [{ s: 'stun', p: 0.75, t: 1 }], lv: 5, anim: 'bash', desc: 'Wedges a spanner in a foe\'s works: it may lose its next turn.' },
        ],
    },
    trina: {
        id: 'trina', name: 'Trina', title: 'Lane Tinker', color: '#f2a860',
        hp: 58, mp: 52, atk: 13, def: 4, spd: 12,
        bio: 'The lane\'s inventor. Everything she builds works eventually, and most of it works as intended.',
        abilities: [
            { id: 'tap', name: 'Spanner Tap', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'slash', desc: 'A quick rap with her spanner.' },
            { id: 'zap', name: 'Spark Zap', mp: 7, kind: 'magic', power: 1.9, target: 'foe', anim: 'spark', desc: 'A crackling bolt from her coil gauntlet.' },
            { id: 'storm', name: 'Sprocket Storm', mp: 14, kind: 'magic', power: 1.15, target: 'foes', lv: 3, anim: 'gears', desc: 'A whirlwind of sprockets hits every foe.' },
            { id: 'rust_dust', name: 'Rust Dust', mp: 9, kind: 'debuff', target: 'foes', fx: [{ s: 'rust', p: 0.9, t: 3 }], lv: 5, anim: 'rust', desc: 'Eats away every foe\'s armour: defence drops for 3 turns.' },
            { id: 'tune_up', name: 'Tune-Up', mp: 14, kind: 'buff', target: 'party', fx: [{ s: 'atkup', p: 1, t: 3 }], lv: 7, anim: 'tune', desc: 'Everyone hits 30% harder for 3 turns.' },
        ],
    },
    mabel: {
        id: 'mabel', name: 'Mabel', title: 'Baker', color: '#f0b8c0',
        hp: 84, mp: 40, atk: 9, def: 8, spd: 8,
        bio: 'Bakes the best scones on the lane and swings a rolling pin like she means every word.',
        abilities: [
            { id: 'pin', name: 'Rolling Pin', mp: 0, kind: 'phys', power: 1.0, target: 'foe', anim: 'bash', desc: 'A solid thwack.' },
            { id: 'tea_time', name: 'Tea Time', mp: 8, kind: 'heal', power: 1.05, target: 'ally', anim: 'heal', desc: 'A hot cup of something steadying: restores an ally\'s HP.' },
            { id: 'clang', name: 'Pan Clang', mp: 6, kind: 'phys', power: 1.25, target: 'foe', fx: [{ s: 'stun', p: 0.5, t: 1 }], lv: 3, anim: 'bash', desc: 'A skillet to the head that may stun a foe for a turn.' },
            { id: 'warm_scone', name: 'Warm Scones', mp: 15, kind: 'heal', power: 0.55, target: 'party', lv: 4, anim: 'heal', desc: 'Passes scones round: restores everyone\'s HP a little.' },
            { id: 'blanket', name: 'Cosy Blanket', mp: 12, kind: 'buff', target: 'party', fx: [{ s: 'guard', p: 1, t: 1 }], lv: 6, anim: 'shield', desc: 'Wraps the party up: everyone takes half damage until Mabel\'s next turn.' },
        ],
    },
};

export const PARTY_ORDER = ['wick', 'trina', 'mabel'];
