/**
 * classes.js — the twelve hero classes and their skill template pools.
 *
 * A generated hero draws one basic, one active, one ultimate and (3★+) one
 * passive from its class. Damage multipliers (`m`) read caster stats:
 * raw = atk·m.atk + def·m.def + hp·m.hp + spd·m.spd.
 *
 * Effect vocabulary (resolved in sim/battle.js):
 *   debuff {s, c, d}           chance c to apply status s for d turns to each target hit
 *   buff   {s, d, to}          to: self | allies | target (an ally target)
 *   heal   {p, to, by}         p × (target max HP, or caster max HP if by:'caster')
 *   shield {p, d, to}          p × caster max HP
 *   atb    {v, to}             +v attack bar to self | allies | target
 *   atbDown{v, c}              −v attack bar on each enemy hit
 *   cleanse{n, to}  strip{n, c}  revive{p}  lifesteal{p}  extra{c}
 *   bonus  {cond, v}           +v damage when cond: debuffed | lowHp | highHp | perDebuff | slower | boss
 *   pierce {v}                 ignore v of the target's DEF
 */

const B = (o) => ({ kind: 'basic', cd: 0, hits: 1, tgt: 'enemy', ...o });
const A = (o) => ({ kind: 'active', hits: 1, tgt: 'enemy', ...o });
const U = (o) => ({ kind: 'ult', hits: 1, tgt: 'enemy', ...o });
const P = (o) => ({ kind: 'passive', ...o });

export const CLASSES = {
    knight: {
        name: 'Knight', role: 'defense', weapons: ['sword'], shield: true, outfits: ['plate'], head: ['helm', 'none'],
        base: { hp: 1150, atk: 70, def: 95, spd: 96, cr: 0.15, cd: 0.5, res: 0.2, acc: 0 },
        blurb: 'Stands in front, draws the blows and keeps the line.',
        basic: [
            B({ nouns: ['Strike', 'Bash', 'Smite'], m: { atk: 2.2, def: 1.6 }, fx: 'slash', eff: [{ t: 'debuff', s: 'provoke', c: 0.2, d: 1 }] }),
            B({ nouns: ['Shield Slam', 'Bulwark Blow'], m: { atk: 1.8, def: 2.2 }, fx: 'slam', eff: [{ t: 'debuff', s: 'atkDown', c: 0.25, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Rally', 'Bastion', 'Vanguard'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'buff', s: 'defUp', d: 2, to: 'allies' }, { t: 'buff', s: 'counter', d: 1, to: 'self' }] }),
            A({ nouns: ['Challenge', 'Taunt', 'Warcry'], cd: 3, tgt: 'enemies', m: { atk: 1.0, def: 1.4 }, fx: 'slam', eff: [{ t: 'debuff', s: 'provoke', c: 0.6, d: 1 }] }),
            A({ nouns: ['Aegis', 'Ward', 'Bulwark'], cd: 4, tgt: 'none', fx: 'shield', eff: [{ t: 'shield', p: 0.18, d: 2, to: 'allies' }] }),
        ],
        ult: [
            U({ nouns: ['Last Bastion', 'Iron Oath', 'Unbroken Wall'], cd: 5, tgt: 'none', fx: 'shield', eff: [{ t: 'buff', s: 'defUp', d: 3, to: 'allies' }, { t: 'buff', s: 'endure', d: 1, to: 'allies' }, { t: 'cleanse', n: 1, to: 'allies' }] }),
            U({ nouns: ['Judgement', 'Crushing Verdict'], cd: 5, m: { atk: 2.5, def: 4.0 }, fx: 'slam', eff: [{ t: 'debuff', s: 'stun', c: 0.6, d: 1 }, { t: 'debuff', s: 'defDown', c: 0.8, d: 2 }] }),
        ],
        passive: [
            P({ nouns: ['Iron Skin', 'Plated'], p: { type: 'reduceDmg', v: 0.15 } }),
            P({ nouns: ['Protector', 'Guardian'], p: { type: 'teamStat', stat: 'defP', v: 0.15 } }),
            P({ nouns: ['Retaliation'], p: { type: 'counter', v: 0.25 } }),
        ],
    },
    berserker: {
        name: 'Berserker', role: 'attack', weapons: ['axe', 'greatsword'], outfits: ['leather', 'tunic'], head: ['none', 'none', 'band'],
        base: { hp: 980, atk: 105, def: 60, spd: 99, cr: 0.15, cd: 0.6, res: 0.15, acc: 0 },
        blurb: 'Bleeds to win. The lower the health, the harder the swing.',
        basic: [
            B({ nouns: ['Cleave', 'Chop', 'Hack'], m: { atk: 3.4 }, fx: 'slash', eff: [{ t: 'lifesteal', p: 0.2 }] }),
            B({ nouns: ['Rend', 'Gash'], m: { atk: 3.1 }, fx: 'slash', eff: [{ t: 'debuff', s: 'defDown', c: 0.25, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Whirlwind', 'Reaping Arc'], cd: 3, tgt: 'enemies', m: { atk: 2.4 }, fx: 'nova', eff: [{ t: 'lifesteal', p: 0.15 }] }),
            A({ nouns: ['Bloodlust', 'Frenzy'], cd: 4, m: { atk: 4.4 }, fx: 'slash', eff: [{ t: 'buff', s: 'atkUp', d: 2, to: 'self' }, { t: 'bonus', cond: 'lowHp', v: 0.4 }] }),
            A({ nouns: ['Skullsplitter'], cd: 3, m: { atk: 4.2 }, fx: 'slam', eff: [{ t: 'debuff', s: 'stun', c: 0.3, d: 1 }] }),
        ],
        ult: [
            U({ nouns: ['Rampage', 'Carnage', 'Wrath'], cd: 5, tgt: 'random', hits: 4, m: { atk: 2.1 }, fx: 'multi', eff: [{ t: 'lifesteal', p: 0.25 }] }),
            U({ nouns: ['Executioner\'s Fall', 'Headsman'], cd: 5, m: { atk: 6.5 }, fx: 'slam', eff: [{ t: 'bonus', cond: 'lowHp', v: 0.8 }, { t: 'extra', c: 0.5 }] }),
        ],
        passive: [
            P({ nouns: ['Blood Rage', 'Fury'], p: { type: 'lowHpAtk', v: 0.5 } }),
            P({ nouns: ['Savage'], p: { type: 'lifesteal', v: 0.15 } }),
            P({ nouns: ['Vengeance'], p: { type: 'revenge', v: 0.5 } }),
        ],
    },
    ranger: {
        name: 'Ranger', role: 'attack', weapons: ['bow'], outfits: ['leather', 'cloak'], head: ['hood', 'none', 'cap'],
        base: { hp: 820, atk: 108, def: 55, spd: 104, cr: 0.25, cd: 0.55, res: 0.15, acc: 0.1 },
        blurb: 'Picks a target and makes it fall, slowly or all at once.',
        basic: [
            B({ nouns: ['Shot', 'Arrow', 'Volley'], m: { atk: 3.3 }, fx: 'arrow', eff: [{ t: 'atbDown', v: 0.15, c: 0.35 }] }),
            B({ nouns: ['Twin Shot', 'Double Nock'], hits: 2, m: { atk: 1.75 }, fx: 'arrow', eff: [{ t: 'debuff', s: 'slow', c: 0.2, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Pinning Shot', 'Hamstring'], cd: 3, m: { atk: 3.8 }, fx: 'arrow', eff: [{ t: 'debuff', s: 'slow', c: 0.8, d: 2 }, { t: 'atbDown', v: 0.3, c: 0.8 }] }),
            A({ nouns: ['Hunter\'s Mark', 'Sight'], cd: 3, m: { atk: 3.2 }, fx: 'arrow', eff: [{ t: 'debuff', s: 'mark', c: 1, d: 2 }, { t: 'buff', s: 'critUp', d: 2, to: 'self' }] }),
            A({ nouns: ['Rain of Arrows', 'Hail'], cd: 4, tgt: 'enemies', m: { atk: 2.4 }, fx: 'rain', eff: [{ t: 'debuff', s: 'defDown', c: 0.3, d: 2 }] }),
        ],
        ult: [
            U({ nouns: ['Deadeye', 'Heartseeker', 'Skypiercer'], cd: 5, m: { atk: 7.0 }, fx: 'beam', eff: [{ t: 'pierce', v: 0.5 }, { t: 'bonus', cond: 'debuffed', v: 0.3 }] }),
            U({ nouns: ['Arrowstorm', 'Thousand Quills'], cd: 6, tgt: 'random', hits: 5, m: { atk: 1.9 }, fx: 'rain', eff: [{ t: 'debuff', s: 'mark', c: 0.3, d: 2 }] }),
        ],
        passive: [
            P({ nouns: ['Eagle Eye'], p: { type: 'stat', stat: 'cr', v: 0.15 } }),
            P({ nouns: ['Quickdraw'], p: { type: 'critAtb', v: 0.2 } }),
            P({ nouns: ['Predator'], p: { type: 'execute', v: 0.35 } }),
        ],
    },
    mage: {
        name: 'Mage', role: 'attack', weapons: ['staff', 'wand'], outfits: ['robe'], head: ['wizard', 'none', 'circlet'],
        base: { hp: 800, atk: 112, def: 52, spd: 100, cr: 0.15, cd: 0.5, res: 0.15, acc: 0.15 },
        blurb: 'Reshapes the battlefield with fire, frost and stormlight.',
        basic: [
            B({ nouns: ['Bolt', 'Missile', 'Orb'], m: { atk: 3.4 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'burn', c: 0.3, d: 2 }] }),
            B({ nouns: ['Shard', 'Lance'], m: { atk: 3.2 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'slow', c: 0.25, d: 1 }] }),
        ],
        active: [
            A({ nouns: ['Nova', 'Burst', 'Eruption'], cd: 3, tgt: 'enemies', m: { atk: 2.5 }, fx: 'nova', eff: [{ t: 'debuff', s: 'burn', c: 0.4, d: 2 }] }),
            A({ nouns: ['Chain', 'Arc'], cd: 3, tgt: 'random', hits: 3, m: { atk: 1.8 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'stun', c: 0.15, d: 1 }] }),
            A({ nouns: ['Prison', 'Binding'], cd: 4, m: { atk: 3.0 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'stun', c: 0.75, d: 1 }] }),
        ],
        ult: [
            U({ nouns: ['Cataclysm', 'Meteor', 'Tempest'], cd: 5, tgt: 'enemies', m: { atk: 4.2 }, fx: 'meteor', eff: [{ t: 'debuff', s: 'defDown', c: 0.5, d: 2 }] }),
            U({ nouns: ['Singularity', 'Apotheosis'], cd: 6, tgt: 'enemies', m: { atk: 3.6 }, fx: 'nova', eff: [{ t: 'atbDown', v: 0.3, c: 0.9 }, { t: 'debuff', s: 'silence', c: 0.5, d: 1 }] }),
        ],
        passive: [
            P({ nouns: ['Arcane Mind'], p: { type: 'stat', stat: 'atkP', v: 0.18 } }),
            P({ nouns: ['Kindling'], p: { type: 'onHitDebuff', s: 'burn', c: 0.25, d: 2 } }),
            P({ nouns: ['Focus'], p: { type: 'stat', stat: 'acc', v: 0.25 } }),
        ],
    },
    assassin: {
        name: 'Assassin', role: 'attack', weapons: ['daggers'], outfits: ['cloak', 'leather'], head: ['hood', 'mask', 'none'],
        base: { hp: 780, atk: 110, def: 50, spd: 112, cr: 0.3, cd: 0.65, res: 0.15, acc: 0.05 },
        blurb: 'Fast, fragile, final. Turns kills into more turns.',
        basic: [
            B({ nouns: ['Stab', 'Backstab', 'Lunge'], m: { atk: 3.3 }, fx: 'slash', eff: [{ t: 'bonus', cond: 'debuffed', v: 0.25 }] }),
            B({ nouns: ['Flurry', 'Twin Fang'], hits: 2, m: { atk: 1.7 }, fx: 'slash', eff: [{ t: 'debuff', s: 'poison', c: 0.3, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Venom Edge', 'Toxin'], cd: 3, m: { atk: 3.6 }, fx: 'slash', eff: [{ t: 'debuff', s: 'poison', c: 0.9, d: 3 }, { t: 'debuff', s: 'healBlock', c: 0.5, d: 2 }] }),
            A({ nouns: ['Shadowstep', 'Blink'], cd: 3, m: { atk: 3.9 }, fx: 'slash', eff: [{ t: 'atb', v: 0.4, to: 'self' }] }),
            A({ nouns: ['Smoke Bomb'], cd: 4, tgt: 'enemies', m: { atk: 1.6 }, fx: 'nova', eff: [{ t: 'debuff', s: 'blind', c: 0.8, d: 2 }] }),
        ],
        ult: [
            U({ nouns: ['Assassinate', 'Death Mark', 'Nightfall'], cd: 5, m: { atk: 7.2 }, fx: 'slash', eff: [{ t: 'bonus', cond: 'lowHp', v: 0.8 }, { t: 'extra', c: 1.0, onKill: true }] }),
            U({ nouns: ['Thousand Cuts', 'Bladestorm'], cd: 5, hits: 5, m: { atk: 1.55 }, fx: 'multi', eff: [{ t: 'bonus', cond: 'perDebuff', v: 0.12 }] }),
        ],
        passive: [
            P({ nouns: ['Lethality'], p: { type: 'stat', stat: 'cd', v: 0.3 } }),
            P({ nouns: ['Opportunist'], p: { type: 'firstStrike', v: 0.4 } }),
            P({ nouns: ['Exploit'], p: { type: 'execute', v: 0.4 } }),
        ],
    },
    cleric: {
        name: 'Cleric', role: 'support', weapons: ['mace', 'staff'], outfits: ['priest'], head: ['circlet', 'hood', 'none'],
        base: { hp: 1000, atk: 70, def: 72, spd: 103, cr: 0.15, cd: 0.5, res: 0.25, acc: 0 },
        blurb: 'Mends wounds and lifts curses. Nobody falls on their watch.',
        basic: [
            B({ nouns: ['Smite', 'Light Touch'], m: { atk: 2.8 }, fx: 'bolt', eff: [{ t: 'heal', p: 0.08, to: 'lowest' }] }),
            B({ nouns: ['Rebuke'], m: { atk: 2.6, hp: 0.08 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'atkDown', c: 0.25, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Mending', 'Renewal', 'Benediction'], cd: 3, tgt: 'none', fx: 'heal', eff: [{ t: 'heal', p: 0.25, to: 'allies' }] }),
            A({ nouns: ['Purify', 'Absolution'], cd: 3, tgt: 'none', fx: 'heal', eff: [{ t: 'cleanse', n: 2, to: 'allies' }, { t: 'heal', p: 0.15, to: 'allies' }] }),
            A({ nouns: ['Blessing'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'buff', s: 'regen', d: 2, to: 'allies' }, { t: 'buff', s: 'immunity', d: 1, to: 'allies' }] }),
        ],
        ult: [
            U({ nouns: ['Resurrection', 'Second Dawn'], cd: 6, tgt: 'none', fx: 'heal', eff: [{ t: 'revive', p: 0.4 }, { t: 'heal', p: 0.3, to: 'allies' }] }),
            U({ nouns: ['Sanctuary', 'Grace'], cd: 5, tgt: 'none', fx: 'heal', eff: [{ t: 'heal', p: 0.4, to: 'allies' }, { t: 'buff', s: 'immunity', d: 2, to: 'allies' }] }),
        ],
        passive: [
            P({ nouns: ['Devotion'], p: { type: 'healBoost', v: 0.25 } }),
            P({ nouns: ['Sacred Ground'], p: { type: 'teamStat', stat: 'hpP', v: 0.12 } }),
            P({ nouns: ['Faith'], p: { type: 'cleanseTurn', v: 0.5 } }),
        ],
    },
    bard: {
        name: 'Bard', role: 'support', weapons: ['lute'], outfits: ['bard'], head: ['feathercap', 'none', 'band'],
        base: { hp: 900, atk: 75, def: 70, spd: 110, cr: 0.15, cd: 0.5, res: 0.25, acc: 0.1 },
        blurb: 'Plays the tempo of the fight. Everyone moves faster to the beat.',
        basic: [
            B({ nouns: ['Chord', 'Ballad', 'Note'], m: { atk: 2.9 }, fx: 'note', eff: [{ t: 'atb', v: 0.1, to: 'allies' }] }),
            B({ nouns: ['Discord', 'Off-key'], m: { atk: 2.8 }, fx: 'note', eff: [{ t: 'debuff', s: 'slow', c: 0.3, d: 1 }] }),
        ],
        active: [
            A({ nouns: ['Anthem', 'March', 'Hymn'], cd: 3, tgt: 'none', fx: 'buff', eff: [{ t: 'atb', v: 0.3, to: 'allies' }, { t: 'buff', s: 'spdUp', d: 2, to: 'allies' }] }),
            A({ nouns: ['Rousing Song', 'War Song'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'buff', s: 'atkUp', d: 2, to: 'allies' }, { t: 'buff', s: 'critUp', d: 2, to: 'allies' }] }),
            A({ nouns: ['Lullaby'], cd: 4, tgt: 'enemies', m: { atk: 1.4 }, fx: 'note', eff: [{ t: 'atbDown', v: 0.25, c: 0.7 }, { t: 'debuff', s: 'slow', c: 0.5, d: 2 }] }),
        ],
        ult: [
            U({ nouns: ['Crescendo', 'Finale', 'Overture'], cd: 5, tgt: 'none', fx: 'buff', eff: [{ t: 'atb', v: 0.5, to: 'allies' }, { t: 'buff', s: 'atkUp', d: 2, to: 'allies' }, { t: 'buff', s: 'spdUp', d: 2, to: 'allies' }] }),
            U({ nouns: ['Requiem of Echoes'], cd: 5, tgt: 'enemies', m: { atk: 2.6 }, fx: 'note', eff: [{ t: 'strip', n: 2, c: 0.9 }, { t: 'atbDown', v: 0.4, c: 0.8 }] }),
        ],
        passive: [
            P({ nouns: ['Tempo'], p: { type: 'teamStat', stat: 'spd', v: 8 } }),
            P({ nouns: ['Encore'], p: { type: 'firstStrike', v: 0.5 } }),
            P({ nouns: ['Harmony'], p: { type: 'teamStat', stat: 'res', v: 0.15 } }),
        ],
    },
    necromancer: {
        name: 'Necromancer', role: 'support', weapons: ['scythe', 'staff'], outfits: ['necro'], head: ['hood', 'crown', 'none'],
        base: { hp: 880, atk: 92, def: 62, spd: 101, cr: 0.15, cd: 0.5, res: 0.15, acc: 0.3 },
        blurb: 'Curses, rot and the dead who will not stay down.',
        basic: [
            B({ nouns: ['Wither', 'Grave Touch', 'Rot'], m: { atk: 3.0 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'poison', c: 0.4, d: 2 }] }),
            B({ nouns: ['Reap', 'Harvest'], m: { atk: 3.2 }, fx: 'slash', eff: [{ t: 'lifesteal', p: 0.25 }] }),
        ],
        active: [
            A({ nouns: ['Plague', 'Pestilence'], cd: 3, tgt: 'enemies', m: { atk: 1.8 }, fx: 'nova', eff: [{ t: 'debuff', s: 'poison', c: 0.7, d: 2 }] }),
            A({ nouns: ['Curse', 'Hex', 'Doom'], cd: 3, m: { atk: 3.0 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'defDown', c: 0.9, d: 2 }, { t: 'debuff', s: 'healBlock', c: 0.9, d: 2 }] }),
            A({ nouns: ['Bone Cage'], cd: 4, m: { atk: 2.8 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'stun', c: 0.6, d: 1 }, { t: 'strip', n: 1, c: 0.8 }] }),
        ],
        ult: [
            U({ nouns: ['Raise Dead', 'Unlife'], cd: 6, tgt: 'enemies', m: { atk: 2.6 }, fx: 'nova', eff: [{ t: 'revive', p: 0.35 }, { t: 'lifesteal', p: 0.2 }] }),
            U({ nouns: ['Soul Rend', 'Requiem'], cd: 5, tgt: 'enemies', m: { atk: 3.0 }, fx: 'nova', eff: [{ t: 'bonus', cond: 'perDebuff', v: 0.15 }, { t: 'debuff', s: 'atkDown', c: 0.6, d: 2 }] }),
        ],
        passive: [
            P({ nouns: ['Deathly Aura'], p: { type: 'onHitDebuff', s: 'poison', c: 0.25, d: 2 } }),
            P({ nouns: ['Soul Siphon'], p: { type: 'onKillHeal', v: 0.25 } }),
            P({ nouns: ['Malice'], p: { type: 'stat', stat: 'acc', v: 0.25 } }),
        ],
    },
    paladin: {
        name: 'Paladin', role: 'hp', weapons: ['hammer', 'mace'], shield: true, outfits: ['plate'], head: ['helm', 'circlet', 'none'],
        base: { hp: 1100, atk: 80, def: 88, spd: 98, cr: 0.15, cd: 0.5, res: 0.25, acc: 0 },
        blurb: 'A holy wall that heals as it fights.',
        basic: [
            B({ nouns: ['Hammer', 'Crusade', 'Smite'], m: { atk: 2.0, hp: 0.12 }, fx: 'slam', eff: [{ t: 'heal', p: 0.06, to: 'allies' }] }),
            B({ nouns: ['Holy Strike'], m: { atk: 2.2, hp: 0.1 }, fx: 'slam', eff: [{ t: 'debuff', s: 'stun', c: 0.15, d: 1 }] }),
        ],
        active: [
            A({ nouns: ['Lay on Hands', 'Consecrate'], cd: 4, tgt: 'none', fx: 'heal', eff: [{ t: 'heal', p: 0.3, to: 'lowest' }, { t: 'shield', p: 0.15, d: 2, to: 'allies' }] }),
            A({ nouns: ['Divine Hammer'], cd: 3, m: { atk: 2.2, hp: 0.2 }, fx: 'slam', eff: [{ t: 'debuff', s: 'stun', c: 0.4, d: 1 }] }),
            A({ nouns: ['Oath', 'Vow'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'buff', s: 'defUp', d: 2, to: 'allies' }, { t: 'heal', p: 0.12, to: 'allies' }] }),
        ],
        ult: [
            U({ nouns: ['Divine Shield', 'Aegis of Dawn'], cd: 5, tgt: 'none', fx: 'shield', eff: [{ t: 'shield', p: 0.3, d: 2, to: 'allies' }, { t: 'buff', s: 'immunity', d: 2, to: 'allies' }] }),
            U({ nouns: ['Hammer of Heaven'], cd: 5, tgt: 'enemies', m: { atk: 2.0, hp: 0.18 }, fx: 'meteor', eff: [{ t: 'heal', p: 0.2, to: 'allies' }] }),
        ],
        passive: [
            P({ nouns: ['Holy Vigor'], p: { type: 'stat', stat: 'hpP', v: 0.2 } }),
            P({ nouns: ['Martyr'], p: { type: 'reduceDmg', v: 0.12 } }),
            P({ nouns: ['Aura of Light'], p: { type: 'teamStat', stat: 'defP', v: 0.12 } }),
        ],
    },
    monk: {
        name: 'Monk', role: 'attack', weapons: ['knuckles'], outfits: ['gi'], head: ['band', 'none', 'none'],
        base: { hp: 930, atk: 95, def: 66, spd: 108, cr: 0.2, cd: 0.55, res: 0.2, acc: 0.05 },
        blurb: 'A storm of fists. Every hit lands, then lands again.',
        basic: [
            B({ nouns: ['Palm', 'Jab', 'Combo'], hits: 3, m: { atk: 1.2 }, fx: 'punch', eff: [] }),
            B({ nouns: ['Kick', 'Sweep'], m: { atk: 3.3 }, fx: 'punch', eff: [{ t: 'atbDown', v: 0.15, c: 0.4 }] }),
        ],
        active: [
            A({ nouns: ['Hundred Fists', 'Flurry'], cd: 3, hits: 5, m: { atk: 0.95 }, fx: 'multi', eff: [{ t: 'debuff', s: 'defDown', c: 0.15, d: 2 }] }),
            A({ nouns: ['Inner Focus', 'Meditation'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'heal', p: 0.25, to: 'self' }, { t: 'buff', s: 'counter', d: 2, to: 'self' }, { t: 'buff', s: 'critUp', d: 2, to: 'self' }] }),
            A({ nouns: ['Pressure Point'], cd: 3, m: { atk: 3.2 }, fx: 'punch', eff: [{ t: 'debuff', s: 'stun', c: 0.45, d: 1 }] }),
        ],
        ult: [
            U({ nouns: ['Dragon Ascent', 'Heaven Strike', 'Tiger Fang'], cd: 5, hits: 6, m: { atk: 1.25 }, fx: 'multi', eff: [{ t: 'debuff', s: 'stun', c: 0.25, d: 1 }] }),
            U({ nouns: ['Ki Explosion'], cd: 5, tgt: 'enemies', m: { atk: 3.0, spd: 4 }, fx: 'nova', eff: [{ t: 'atbDown', v: 0.25, c: 0.7 }] }),
        ],
        passive: [
            P({ nouns: ['Discipline'], p: { type: 'counter', v: 0.3 } }),
            P({ nouns: ['Flow'], p: { type: 'stat', stat: 'spd', v: 10 } }),
            P({ nouns: ['Iron Body'], p: { type: 'cleanseTurn', v: 0.35 } }),
        ],
    },
    druid: {
        name: 'Druid', role: 'hp', weapons: ['staff', 'wand'], outfits: ['druid'], head: ['antlers', 'wreath', 'none'],
        base: { hp: 980, atk: 80, def: 70, spd: 102, cr: 0.15, cd: 0.5, res: 0.2, acc: 0.2 },
        blurb: 'Roots, thorns and regrowth. Patient as the forest.',
        basic: [
            B({ nouns: ['Thorn', 'Vine Whip', 'Bramble'], m: { atk: 2.9 }, fx: 'vine', eff: [{ t: 'debuff', s: 'poison', c: 0.3, d: 2 }] }),
            B({ nouns: ['Root', 'Entangle'], m: { atk: 2.7 }, fx: 'vine', eff: [{ t: 'debuff', s: 'slow', c: 0.35, d: 2 }] }),
        ],
        active: [
            A({ nouns: ['Rejuvenate', 'Bloom'], cd: 3, tgt: 'none', fx: 'heal', eff: [{ t: 'buff', s: 'regen', d: 3, to: 'allies' }, { t: 'heal', p: 0.1, to: 'allies' }] }),
            A({ nouns: ['Barkskin'], cd: 4, tgt: 'none', fx: 'shield', eff: [{ t: 'buff', s: 'defUp', d: 2, to: 'allies' }, { t: 'shield', p: 0.12, d: 2, to: 'allies' }] }),
            A({ nouns: ['Swarm', 'Spore Cloud'], cd: 3, tgt: 'enemies', m: { atk: 1.9 }, fx: 'vine', eff: [{ t: 'debuff', s: 'poison', c: 0.6, d: 2 }, { t: 'debuff', s: 'defDown', c: 0.3, d: 2 }] }),
        ],
        ult: [
            U({ nouns: ['Wrath of the Wild', 'Overgrowth'], cd: 5, tgt: 'enemies', m: { atk: 3.2 }, fx: 'vine', eff: [{ t: 'debuff', s: 'stun', c: 0.35, d: 1 }, { t: 'heal', p: 0.15, to: 'allies' }] }),
            U({ nouns: ['World Tree', 'Lifebloom'], cd: 5, tgt: 'none', fx: 'heal', eff: [{ t: 'heal', p: 0.35, to: 'allies' }, { t: 'buff', s: 'regen', d: 2, to: 'allies' }, { t: 'cleanse', n: 1, to: 'allies' }] }),
        ],
        passive: [
            P({ nouns: ['Photosynthesis'], p: { type: 'turnHeal', v: 0.08 } }),
            P({ nouns: ['Thornhide'], p: { type: 'thorns', v: 0.2 } }),
            P({ nouns: ['Grove'], p: { type: 'teamStat', stat: 'hpP', v: 0.1 } }),
        ],
    },
    warlock: {
        name: 'Warlock', role: 'attack', weapons: ['tome', 'wand'], outfits: ['necro', 'robe'], head: ['horns', 'hood', 'none'],
        base: { hp: 860, atk: 100, def: 58, spd: 103, cr: 0.15, cd: 0.5, res: 0.15, acc: 0.25 },
        blurb: 'Bargains with things that should not be bargained with.',
        basic: [
            B({ nouns: ['Hex Bolt', 'Eldritch Blast'], m: { atk: 3.3 }, fx: 'bolt', eff: [{ t: 'atbDown', v: 0.15, c: 0.4 }] }),
            B({ nouns: ['Drain', 'Siphon'], m: { atk: 3.0 }, fx: 'beam', eff: [{ t: 'lifesteal', p: 0.3 }] }),
        ],
        active: [
            A({ nouns: ['Soul Leech', 'Life Tap'], cd: 3, m: { atk: 3.7 }, fx: 'beam', eff: [{ t: 'atbDown', v: 0.3, c: 0.9 }, { t: 'atb', v: 0.3, to: 'self' }] }),
            A({ nouns: ['Agony', 'Torment'], cd: 3, m: { atk: 3.2 }, fx: 'bolt', eff: [{ t: 'debuff', s: 'mark', c: 0.9, d: 2 }, { t: 'debuff', s: 'silence', c: 0.5, d: 1 }] }),
            A({ nouns: ['Dark Pact'], cd: 4, tgt: 'none', fx: 'buff', eff: [{ t: 'buff', s: 'atkUp', d: 3, to: 'self' }, { t: 'buff', s: 'critUp', d: 3, to: 'self' }, { t: 'atb', v: 0.5, to: 'self' }] }),
        ],
        ult: [
            U({ nouns: ['Abyssal Gate', 'Oblivion', 'Void Rift'], cd: 5, tgt: 'enemies', m: { atk: 3.8 }, fx: 'meteor', eff: [{ t: 'strip', n: 1, c: 0.7 }, { t: 'atbDown', v: 0.2, c: 0.7 }] }),
            U({ nouns: ['Annihilate', 'Doombringer'], cd: 5, m: { atk: 7.0 }, fx: 'beam', eff: [{ t: 'bonus', cond: 'perDebuff', v: 0.2 }] }),
        ],
        passive: [
            P({ nouns: ['Forbidden Lore'], p: { type: 'stat', stat: 'atkP', v: 0.15 } }),
            P({ nouns: ['Despair'], p: { type: 'onHitDebuff', s: 'atkDown', c: 0.2, d: 2 } }),
            P({ nouns: ['Soul Feast'], p: { type: 'onKillHeal', v: 0.3 } }),
        ],
    },
};
export const CLASS_IDS = Object.keys(CLASSES);

/** Passives anyone can roll alongside their class pool. */
export const GENERAL_PASSIVES = [
    P({ nouns: ['Second Wind'], p: { type: 'turnHeal', v: 0.05 } }),
    P({ nouns: ['Resilience'], p: { type: 'stat', stat: 'res', v: 0.2 } }),
    P({ nouns: ['Celerity'], p: { type: 'stat', stat: 'spd', v: 8 } }),
    P({ nouns: ['Tenacity'], p: { type: 'stat', stat: 'hpP', v: 0.15 } }),
    P({ nouns: ['Brawn'], p: { type: 'stat', stat: 'atkP', v: 0.12 } }),
];

export const WEAPONS = ['sword', 'greatsword', 'axe', 'hammer', 'spear', 'bow', 'staff', 'wand', 'daggers', 'mace', 'lute', 'scythe', 'tome', 'knuckles'];
export const WEAPON_NAME = {
    sword: 'Sword', greatsword: 'Greatsword', axe: 'Axe', hammer: 'Warhammer', spear: 'Spear', bow: 'Bow', staff: 'Staff',
    wand: 'Wand', daggers: 'Twin Daggers', mace: 'Mace', lute: 'Lute', scythe: 'Scythe', tome: 'Tome', knuckles: 'Knuckles',
};
export const OUTFITS = ['plate', 'leather', 'robe', 'cloak', 'tunic', 'gi', 'priest', 'bard', 'necro', 'druid'];
export const OUTFIT_NAME = {
    plate: 'Plate Armour', leather: 'Leathers', robe: 'Mage Robe', cloak: 'Shadow Cloak', tunic: 'Tunic', gi: 'Monk Gi',
    priest: 'Vestments', bard: 'Doublet', necro: 'Grave Robe', druid: 'Leafweave',
};
export const HEADWEAR = ['none', 'helm', 'hood', 'wizard', 'circlet', 'crown', 'band', 'cap', 'feathercap', 'mask', 'antlers', 'wreath', 'horns'];
export const HEADWEAR_NAME = {
    none: 'None', helm: 'Helm', hood: 'Hood', wizard: 'Wizard Hat', circlet: 'Circlet', crown: 'Crown', band: 'Headband',
    cap: 'Ranger Cap', feathercap: 'Feathered Cap', mask: 'Mask', antlers: 'Antler Crown', wreath: 'Wreath', horns: 'Horned Cowl',
};
