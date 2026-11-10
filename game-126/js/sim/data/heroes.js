// EMBERSPIRE — the nine heroes, their classes, evolutions and skills. Pure data.
//
// Every hero starts in a base class. At level EVOLVE_LV (config) they choose one of two evolutions at the Temple;
// at ASCEND_LV the chosen evolution ascends (a third tier, same art with a golden aura). Each class has a stat
// growth g: [hp, mp, atk, mag, def, res, spd] at level 1, multiplied by the level curve (heroStats in party.js).
//
// Skills: { id, name, mp, tgt, kind, pow, el, hits, st, desc, lv }
//   tgt  'enemy' | 'enemies' | 'ally' | 'allies' | 'self' | 'fallen'
//   kind 'phys' | 'mag' | 'heal' | 'buff' | 'revive' | 'debuff'
//   pow  damage or heal multiplier of atk (phys) or mag (mag/heal)
//   st   { id, ch, n } status applied with chance ch for n turns (ids in STATUS)
//   lv   level at which the class can learn it (at the Temple, for skill points)

export const STATUS = {
    poison: { name: 'Poison', icon: '☠', bad: true },
    burn: { name: 'Burn', icon: '🔥', bad: true },
    stun: { name: 'Stun', icon: '💫', bad: true },
    slow: { name: 'Slow', icon: '🐌', bad: true },
    atkdown: { name: 'Weak', icon: '⬇', bad: true },
    defdown: { name: 'Brittle', icon: '🛡', bad: true },
    atkup: { name: 'Might', icon: '⚔', bad: false },
    defup: { name: 'Guard', icon: '🛡', bad: false },
    magup: { name: 'Focus', icon: '✦', bad: false },
    haste: { name: 'Haste', icon: '💨', bad: false },
    regen: { name: 'Regen', icon: '✚', bad: false },
    barrier: { name: 'Barrier', icon: '◈', bad: false },
    taunt: { name: 'Taunt', icon: '❗', bad: false },
};

const S = (id, name, mp, tgt, kind, pow, lv, desc, extra = {}) => ({ id, name, mp, tgt, kind, pow, lv, desc, el: 'phys', hits: 1, ...extra });

// ---------------------------------------------------------------- classes
// tier 1 base classes (key = class id); evo: [a, b] evolution class ids; asc: ascended name per evolution.
export const CLASSES = {
    // Knight
    knight: { name: 'Knight', tier: 1, weapon: 'sword', armor: 'heavy', g: [120, 20, 12, 5, 11, 7, 9], evo: ['paladin', 'warlord'],
        skills: [
            S('power_strike', 'Power Strike', 4, 'enemy', 'phys', 1.6, 1, 'A heavy two-handed blow.'),
            S('provoke', 'Provoke', 3, 'self', 'buff', 0, 3, 'Draw every enemy\'s attacks for 3 turns and steel yourself.', { st: { id: 'taunt', ch: 1, n: 3 }, st2: { id: 'defup', ch: 1, n: 3 } }),
            S('shield_bash', 'Shield Bash', 6, 'enemy', 'phys', 1.2, 6, 'Bash with the shield; may stun.', { st: { id: 'stun', ch: 0.35, n: 1 } }),
            S('rally', 'Rally', 10, 'allies', 'buff', 0, 10, 'Raise the whole party\'s guard.', { st: { id: 'defup', ch: 1, n: 3 } }),
        ] },
    paladin: { name: 'Paladin', tier: 2, from: 'knight', g: [150, 34, 14, 10, 15, 11, 9], asc: 'Lightbringer',
        skills: [
            S('holy_blade', 'Holy Blade', 10, 'enemy', 'phys', 2.0, 15, 'A sword wreathed in holy light.', { el: 'holy' }),
            S('lay_hands', 'Lay on Hands', 12, 'ally', 'heal', 2.6, 18, 'Heal one ally greatly.'),
            S('aegis', 'Aegis', 18, 'allies', 'buff', 0, 24, 'A barrier on every ally.', { st: { id: 'barrier', ch: 1, n: 3 } }),
            S('dawnbreaker', 'Dawnbreaker', 30, 'enemies', 'phys', 2.2, 40, 'Ultimate: a sunrise of holy steel on every foe.', { el: 'holy' }),
        ] },
    warlord: { name: 'Warlord', tier: 2, from: 'knight', g: [140, 26, 17, 5, 13, 8, 10], asc: 'Conqueror',
        skills: [
            S('cleave_w', 'Sweeping Cleave', 10, 'enemies', 'phys', 1.3, 15, 'Strike every foe.'),
            S('battle_cry', 'Battle Cry', 12, 'allies', 'buff', 0, 18, 'The party hits harder.', { st: { id: 'atkup', ch: 1, n: 3 } }),
            S('execute', 'Execute', 14, 'enemy', 'phys', 2.2, 24, 'Deals double damage to a foe below 30% health.', { exec: 0.3 }),
            S('warlords_wrath', 'Warlord\'s Wrath', 30, 'enemy', 'phys', 4.5, 40, 'Ultimate: an earth-splitting blow.'),
        ] },

    // Cleric
    cleric: { name: 'Cleric', tier: 1, weapon: 'staff', armor: 'robe', g: [85, 45, 6, 12, 7, 12, 9], evo: ['saint', 'oracle'],
        skills: [
            S('heal', 'Heal', 5, 'ally', 'heal', 1.8, 1, 'Restore one ally\'s health.'),
            S('smite', 'Smite', 5, 'enemy', 'mag', 1.4, 3, 'A bolt of holy light.', { el: 'holy' }),
            S('blessing', 'Blessing', 8, 'ally', 'buff', 0, 6, 'Regeneration for 3 turns.', { st: { id: 'regen', ch: 1, n: 3 } }),
            S('raise', 'Raise', 16, 'fallen', 'revive', 0.4, 10, 'Bring a fallen ally back with 40% health.'),
        ] },
    saint: { name: 'Saint', tier: 2, from: 'cleric', g: [100, 70, 6, 15, 9, 16, 9], asc: 'Hierophant',
        skills: [
            S('mass_heal', 'Sanctuary', 16, 'allies', 'heal', 1.5, 15, 'Heal the whole party.'),
            S('purify', 'Purify', 8, 'ally', 'heal', 1.0, 18, 'Heal and cleanse every ailment.', { cleanse: true }),
            S('full_raise', 'Resurrection', 26, 'fallen', 'revive', 1.0, 24, 'Bring a fallen ally back at full health.'),
            S('miracle', 'Miracle', 40, 'allies', 'revive', 0.6, 40, 'Ultimate: revive and heal the whole party.', { massRevive: true }),
        ] },
    oracle: { name: 'Oracle', tier: 2, from: 'cleric', g: [95, 62, 6, 18, 8, 15, 11], asc: 'Starseer',
        skills: [
            S('holy_nova', 'Holy Nova', 14, 'enemies', 'mag', 1.3, 15, 'Holy light on every foe.', { el: 'holy' }),
            S('haste', 'Haste', 10, 'ally', 'buff', 0, 18, 'One ally acts much more often.', { st: { id: 'haste', ch: 1, n: 3 } }),
            S('foresight', 'Foresight', 14, 'allies', 'buff', 0, 24, 'The party focuses its magic.', { st: { id: 'magup', ch: 1, n: 3 } }),
            S('judgement_o', 'Final Judgement', 34, 'enemies', 'mag', 2.4, 40, 'Ultimate: the heavens pass sentence.', { el: 'holy' }),
        ] },

    // Berserker
    berserker: { name: 'Berserker', tier: 1, weapon: 'axe', armor: 'heavy', g: [130, 12, 15, 3, 8, 5, 9], evo: ['juggernaut', 'bloodreaver'],
        skills: [
            S('wild_swing', 'Wild Swing', 3, 'enemy', 'phys', 1.8, 1, 'A reckless, heavy swing.'),
            S('rage', 'Rage', 4, 'self', 'buff', 0, 3, 'Fury: much stronger attacks for 3 turns.', { st: { id: 'atkup', ch: 1, n: 3 } }),
            S('whirlwind', 'Whirlwind', 8, 'enemies', 'phys', 1.0, 6, 'Spin through every foe.'),
            S('skullsplitter', 'Skullsplitter', 10, 'enemy', 'phys', 2.6, 10, 'A brutal blow that leaves them brittle.', { st: { id: 'defdown', ch: 0.6, n: 3 } }),
        ] },
    juggernaut: { name: 'Juggernaut', tier: 2, from: 'berserker', g: [190, 16, 16, 3, 14, 7, 8], asc: 'Titan',
        skills: [
            S('iron_hide', 'Iron Hide', 8, 'self', 'buff', 0, 15, 'Barrier and guard on yourself; enemies come at you.', { st: { id: 'barrier', ch: 1, n: 3 }, st2: { id: 'taunt', ch: 1, n: 3 } }),
            S('earthshaker', 'Earthshaker', 14, 'enemies', 'phys', 1.4, 18, 'Shake the floor; foes may be stunned.', { st: { id: 'stun', ch: 0.25, n: 1 } }),
            S('second_wind', 'Second Wind', 10, 'self', 'heal', 0, 24, 'Recover 35% of your health.', { pct: 0.35 }),
            S('unstoppable', 'Unstoppable', 30, 'enemy', 'phys', 3.5, 40, 'Ultimate: a charge that knocks them flat.', { st: { id: 'stun', ch: 1, n: 1 } }),
        ] },
    bloodreaver: { name: 'Bloodreaver', tier: 2, from: 'berserker', g: [150, 14, 20, 3, 9, 5, 11], asc: 'Crimson Lord',
        skills: [
            S('blood_strike', 'Blood Strike', 8, 'enemy', 'phys', 1.9, 15, 'Steal half the damage as health.', { leech: 0.5 }),
            S('frenzy_h', 'Frenzy', 12, 'enemy', 'phys', 0.8, 18, 'Four savage hits.', { hits: 4 }),
            S('bloodlust', 'Bloodlust', 10, 'self', 'buff', 0, 24, 'Haste and might.', { st: { id: 'haste', ch: 1, n: 3 }, st2: { id: 'atkup', ch: 1, n: 3 } }),
            S('crimson_tide', 'Crimson Tide', 30, 'enemies', 'phys', 2.2, 40, 'Ultimate: a wave of blood; heal for a third.', { leech: 0.33 }),
        ] },

    // Rogue
    rogue: { name: 'Rogue', tier: 1, weapon: 'daggers', armor: 'light', g: [90, 22, 13, 5, 7, 7, 15], evo: ['assassin', 'shadowdancer'],
        skills: [
            S('backstab', 'Backstab', 4, 'enemy', 'phys', 1.5, 1, 'A precise stab, likely to crit.', { crit: 0.5 }),
            S('envenom', 'Envenom', 5, 'enemy', 'phys', 1.0, 3, 'A poisoned blade.', { el: 'nature', st: { id: 'poison', ch: 0.85, n: 3 } }),
            S('pilfer', 'Pilfer', 3, 'enemy', 'phys', 0.8, 6, 'Strike and steal some gold.', { steal: true }),
            S('smoke_veil', 'Smoke Veil', 8, 'allies', 'buff', 0, 10, 'Everyone slips into smoke and speeds up.', { st: { id: 'haste', ch: 1, n: 2 } }),
        ] },
    assassin: { name: 'Assassin', tier: 2, from: 'rogue', g: [100, 28, 18, 5, 8, 8, 18], asc: 'Nightblade',
        skills: [
            S('mark', 'Death Mark', 8, 'enemy', 'debuff', 0, 15, 'Leave a foe brittle and slowed.', { st: { id: 'defdown', ch: 1, n: 3 }, st2: { id: 'slow', ch: 0.8, n: 3 } }),
            S('assassinate', 'Assassinate', 14, 'enemy', 'phys', 2.6, 18, 'Always critical.', { crit: 1 }),
            S('venom_fan', 'Venom Fan', 12, 'enemies', 'phys', 1.0, 24, 'Poisoned knives at every foe.', { el: 'nature', st: { id: 'poison', ch: 0.7, n: 3 } }),
            S('thousand_cuts', 'Thousand Cuts', 30, 'enemy', 'phys', 0.9, 40, 'Ultimate: seven blinding strikes.', { hits: 7, crit: 0.3 }),
        ] },
    shadowdancer: { name: 'Shadowdancer', tier: 2, from: 'rogue', g: [105, 34, 15, 10, 9, 10, 19], asc: 'Umbral Muse',
        skills: [
            S('shadow_step', 'Shadow Step', 8, 'enemy', 'phys', 1.6, 15, 'Strike from the shadows with dark steel.', { el: 'dark' }),
            S('dance_of_blades', 'Dance of Blades', 12, 'enemies', 'phys', 0.7, 18, 'Two hits on every foe.', { hits: 2 }),
            S('grand_heist', 'Grand Heist', 10, 'enemy', 'phys', 1.2, 24, 'Steal a fat purse.', { steal: true, stealMul: 3 }),
            S('eclipse_dance', 'Eclipse Dance', 30, 'enemies', 'phys', 1.0, 40, 'Ultimate: three shadow strikes on every foe.', { hits: 3, el: 'dark' }),
        ] },

    // Ranger
    ranger: { name: 'Ranger', tier: 1, weapon: 'bow', armor: 'light', g: [95, 24, 13, 6, 8, 8, 13], evo: ['sniper', 'beastmaster'],
        skills: [
            S('aimed_shot', 'Aimed Shot', 4, 'enemy', 'phys', 1.7, 1, 'A careful shot.'),
            S('volley', 'Volley', 7, 'enemies', 'phys', 0.9, 3, 'Rain arrows on every foe.'),
            S('pin', 'Pinning Shot', 5, 'enemy', 'phys', 1.0, 6, 'Pin a foe in place: slowed.', { st: { id: 'slow', ch: 0.9, n: 3 } }),
            S('herbal', 'Herbal Poultice', 8, 'ally', 'heal', 1.3, 10, 'Field medicine.', { useAtk: true }),
        ] },
    sniper: { name: 'Sniper', tier: 2, from: 'ranger', g: [100, 28, 19, 6, 8, 8, 14], asc: 'Hawkeye',
        skills: [
            S('headshot', 'Headshot', 12, 'enemy', 'phys', 2.8, 15, 'A shot between the eyes; high crit.', { crit: 0.4 }),
            S('fire_arrow', 'Fire Arrow', 8, 'enemy', 'phys', 1.8, 18, 'A burning arrow.', { el: 'fire', st: { id: 'burn', ch: 0.6, n: 3 } }),
            S('storm_arrow', 'Storm Arrow', 14, 'enemies', 'phys', 1.3, 24, 'Lightning-charged volley.', { el: 'bolt' }),
            S('starfall_shot', 'Starfall Shot', 30, 'enemy', 'phys', 5.0, 40, 'Ultimate: an arrow shot into the sky that comes down a comet.', { el: 'holy' }),
        ] },
    beastmaster: { name: 'Beastmaster', tier: 2, from: 'ranger', g: [120, 26, 16, 8, 10, 9, 13], asc: 'Wildheart',
        skills: [
            S('wolf_pack', 'Call the Pack', 10, 'enemies', 'phys', 1.1, 15, 'Wolves tear through the foes.', { hits: 2 }),
            S('bear_roar', 'Bear\'s Roar', 10, 'allies', 'buff', 0, 18, 'The bear\'s might fills the party.', { st: { id: 'atkup', ch: 1, n: 3 } }),
            S('falcon_dive', 'Falcon Dive', 8, 'enemy', 'phys', 2.0, 24, 'The falcon strikes from above; may stun.', { st: { id: 'stun', ch: 0.3, n: 1 } }),
            S('wild_hunt', 'Wild Hunt', 30, 'enemies', 'phys', 2.0, 40, 'Ultimate: every beast of the forest answers.', { el: 'nature', hits: 2 }),
        ] },

    // Mage
    mage: { name: 'Mage', tier: 1, weapon: 'tome', armor: 'robe', g: [75, 50, 4, 15, 6, 11, 10], evo: ['archmage', 'spellblade'],
        skills: [
            S('fire', 'Fire', 4, 'enemy', 'mag', 1.6, 1, 'A ball of fire.', { el: 'fire', st: { id: 'burn', ch: 0.2, n: 3 } }),
            S('ice', 'Ice', 4, 'enemy', 'mag', 1.6, 1, 'A lance of ice; may slow.', { el: 'ice', st: { id: 'slow', ch: 0.2, n: 2 } }),
            S('thunder_s', 'Thunder', 4, 'enemy', 'mag', 1.6, 3, 'A lightning bolt; may stun.', { el: 'bolt', st: { id: 'stun', ch: 0.12, n: 1 } }),
            S('fira', 'Fireball', 12, 'enemies', 'mag', 1.1, 6, 'Fire bursts over every foe.', { el: 'fire' }),
            S('blizzara', 'Blizzard', 12, 'enemies', 'mag', 1.1, 10, 'Ice storms over every foe.', { el: 'ice' }),
        ] },
    archmage: { name: 'Archmage', tier: 2, from: 'mage', g: [85, 80, 4, 21, 7, 14, 10], asc: 'Magister',
        skills: [
            S('thundaga', 'Chain Lightning', 16, 'enemies', 'mag', 1.4, 15, 'Lightning jumps through every foe.', { el: 'bolt' }),
            S('arcane_focus', 'Arcane Focus', 8, 'self', 'buff', 0, 18, 'Focus: much stronger spells for 3 turns.', { st: { id: 'magup', ch: 1, n: 3 } }),
            S('flare', 'Flare', 20, 'enemy', 'mag', 3.2, 24, 'Concentrated fire.', { el: 'fire' }),
            S('meteor_s', 'Meteor', 42, 'enemies', 'mag', 2.6, 40, 'Ultimate: stars fall on every foe.', { el: 'fire' }),
        ] },
    spellblade: { name: 'Spellblade', tier: 2, from: 'mage', g: [110, 55, 14, 15, 10, 11, 11], asc: 'Runeknight',
        skills: [
            S('flame_blade', 'Flame Blade', 8, 'enemy', 'phys', 1.8, 15, 'Blade and fire as one.', { el: 'fire', mixed: true }),
            S('frost_blade', 'Frost Blade', 8, 'enemy', 'phys', 1.8, 18, 'Blade and frost as one; may slow.', { el: 'ice', mixed: true, st: { id: 'slow', ch: 0.4, n: 2 } }),
            S('volt_blade', 'Volt Blade', 8, 'enemy', 'phys', 1.8, 24, 'Blade and lightning as one; may stun.', { el: 'bolt', mixed: true, st: { id: 'stun', ch: 0.25, n: 1 } }),
            S('runic_storm', 'Runic Storm', 30, 'enemies', 'phys', 2.2, 40, 'Ultimate: runes erupt under every foe.', { el: 'holy', mixed: true }),
        ] },

    // Bard
    bard: { name: 'Bard', tier: 1, weapon: 'lute', armor: 'light', g: [88, 40, 8, 11, 7, 10, 12], evo: ['maestro', 'skald'],
        skills: [
            S('ballad', 'Rousing Ballad', 6, 'allies', 'buff', 0, 1, 'The party hits harder.', { st: { id: 'atkup', ch: 1, n: 3 } }),
            S('lullaby', 'Lullaby', 6, 'enemy', 'debuff', 0, 3, 'A foe nods off (stunned).', { st: { id: 'stun', ch: 0.7, n: 1 } }),
            S('soothing', 'Soothing Song', 8, 'allies', 'heal', 0.9, 6, 'A gentle melody heals everyone.'),
            S('discord', 'Discord', 8, 'enemies', 'mag', 0.9, 10, 'A painful chord: foes weaken.', { st: { id: 'atkdown', ch: 0.6, n: 3 } }),
        ] },
    maestro: { name: 'Maestro', tier: 2, from: 'bard', g: [95, 60, 8, 15, 8, 13, 13], asc: 'Virtuoso',
        skills: [
            S('allegro', 'Allegro', 14, 'allies', 'buff', 0, 15, 'Haste for the whole party.', { st: { id: 'haste', ch: 1, n: 2 } }),
            S('requiem', 'Requiem', 14, 'enemies', 'mag', 1.4, 18, 'A sorrowful dirge that hurts.', { el: 'dark' }),
            S('hymn', 'Hymn of Life', 16, 'allies', 'heal', 1.3, 24, 'Heal and regenerate.', { st: { id: 'regen', ch: 1, n: 3 } }),
            S('symphony', 'Grand Symphony', 36, 'allies', 'buff', 0, 40, 'Ultimate: might, guard, focus and haste on all.', { st: { id: 'atkup', ch: 1, n: 3 }, st2: { id: 'defup', ch: 1, n: 3 }, st3: { id: 'magup', ch: 1, n: 3 }, st4: { id: 'haste', ch: 1, n: 3 } }),
        ] },
    skald: { name: 'Skald', tier: 2, from: 'bard', g: [115, 40, 14, 12, 10, 10, 12], asc: 'Stormsinger',
        skills: [
            S('war_chant', 'War Chant', 12, 'allies', 'buff', 0, 15, 'Might and guard for all.', { st: { id: 'atkup', ch: 1, n: 3 }, st2: { id: 'defup', ch: 1, n: 3 } }),
            S('thunder_drum', 'Thunder Drum', 12, 'enemies', 'mag', 1.3, 18, 'Every beat a lightning strike.', { el: 'bolt' }),
            S('saga', 'Saga of Heroes', 14, 'ally', 'buff', 0, 24, 'One ally strikes twice as hard.', { st: { id: 'atkup', ch: 1, n: 4 }, st2: { id: 'haste', ch: 1, n: 3 } }),
            S('ragnarok', 'Ragnarok Verse', 32, 'enemies', 'mag', 2.4, 40, 'Ultimate: the last song of the world.', { el: 'bolt' }),
        ] },

    // Alchemist
    alchemist: { name: 'Alchemist', tier: 1, weapon: 'flask', armor: 'light', g: [92, 36, 10, 12, 8, 9, 10], evo: ['bombardier', 'apothecary'],
        skills: [
            S('acid_flask', 'Acid Flask', 4, 'enemy', 'mag', 1.3, 1, 'Corrodes armour.', { el: 'nature', st: { id: 'defdown', ch: 0.5, n: 3 } }),
            S('firebomb', 'Firebomb', 7, 'enemies', 'mag', 1.0, 3, 'Fire on every foe.', { el: 'fire' }),
            S('tonic', 'Bubbling Tonic', 6, 'ally', 'heal', 1.6, 6, 'A tasty healing draught.'),
            S('transmute', 'Transmute', 6, 'enemy', 'phys', 0.6, 10, 'Turn some of a foe to gold.', { steal: true, stealMul: 2 }),
        ] },
    bombardier: { name: 'Bombardier', tier: 2, from: 'alchemist', g: [100, 46, 10, 18, 9, 10, 10], asc: 'Doomsmith',
        skills: [
            S('cluster', 'Cluster Bomb', 14, 'enemies', 'mag', 1.4, 15, 'Lots of little explosions.', { el: 'fire', hits: 2 }),
            S('frost_bomb', 'Cryo Bomb', 10, 'enemies', 'mag', 1.2, 18, 'Freezing shrapnel; foes may slow.', { el: 'ice', st: { id: 'slow', ch: 0.5, n: 2 } }),
            S('nitro', 'Nitro Charge', 16, 'enemy', 'mag', 3.0, 24, 'An enormous bang.', { el: 'fire' }),
            S('big_one', 'The Big One', 36, 'enemies', 'mag', 2.6, 40, 'Ultimate: Grimble\'s life\'s work.', { el: 'fire', st: { id: 'burn', ch: 1, n: 3 } }),
        ] },
    apothecary: { name: 'Apothecary', tier: 2, from: 'alchemist', g: [110, 56, 8, 16, 10, 13, 10], asc: 'Panacea',
        skills: [
            S('elixir_mist', 'Elixir Mist', 14, 'allies', 'heal', 1.3, 15, 'Healing mist for everyone.'),
            S('antidote_s', 'Panacea Draught', 8, 'ally', 'heal', 1.2, 18, 'Heal and cleanse.', { cleanse: true }),
            S('vigor', 'Draught of Vigor', 12, 'allies', 'buff', 0, 24, 'Regen and guard for all.', { st: { id: 'regen', ch: 1, n: 3 }, st2: { id: 'defup', ch: 1, n: 3 } }),
            S('philosopher', 'Philosopher\'s Stone', 40, 'allies', 'revive', 0.8, 40, 'Ultimate: revive and restore everyone.', { massRevive: true }),
        ] },

    // Warlock
    warlock: { name: 'Warlock', tier: 1, weapon: 'scythe', armor: 'robe', g: [85, 44, 7, 14, 7, 11, 10], evo: ['hexblade', 'necromancer'],
        skills: [
            S('shadowbolt', 'Shadow Bolt', 4, 'enemy', 'mag', 1.6, 1, 'A bolt of darkness.', { el: 'dark' }),
            S('hex', 'Hex', 5, 'enemy', 'debuff', 0, 3, 'Weaken a foe.', { st: { id: 'atkdown', ch: 1, n: 3 }, st2: { id: 'defdown', ch: 0.6, n: 3 } }),
            S('siphon', 'Siphon Life', 6, 'enemy', 'mag', 1.2, 6, 'Drain their life into yours.', { el: 'dark', leech: 0.6 }),
            S('dread', 'Dread', 10, 'enemies', 'mag', 1.0, 10, 'Shadows on every foe.', { el: 'dark' }),
        ] },
    hexblade: { name: 'Hexblade', tier: 2, from: 'warlock', g: [115, 46, 15, 14, 10, 11, 12], asc: 'Voidreaver',
        skills: [
            S('cursed_edge', 'Cursed Edge', 8, 'enemy', 'phys', 1.9, 15, 'A scythe of shadow; weakens.', { el: 'dark', mixed: true, st: { id: 'atkdown', ch: 0.5, n: 3 } }),
            S('reap', 'Reap', 14, 'enemies', 'phys', 1.4, 18, 'Sweep the scythe through every foe.', { el: 'dark', mixed: true, leech: 0.2 }),
            S('pact', 'Dark Pact', 6, 'self', 'buff', 0, 24, 'Might and focus at the cost of 10% health.', { st: { id: 'atkup', ch: 1, n: 3 }, st2: { id: 'magup', ch: 1, n: 3 }, selfCost: 0.1 }),
            S('oblivion', 'Oblivion', 32, 'enemy', 'phys', 4.6, 40, 'Ultimate: cut them out of the world.', { el: 'dark', mixed: true }),
        ] },
    necromancer: { name: 'Necromancer', tier: 2, from: 'warlock', g: [95, 66, 5, 20, 8, 14, 10], asc: 'Lich Sovereign',
        skills: [
            S('bone_spear', 'Bone Spear', 10, 'enemy', 'mag', 2.2, 15, 'A spear of bone through the foe.', { el: 'dark' }),
            S('plague', 'Plague', 14, 'enemies', 'mag', 0.9, 18, 'Sickness on every foe.', { el: 'nature', st: { id: 'poison', ch: 0.8, n: 4 } }),
            S('unholy_raise', 'Unholy Raise', 16, 'fallen', 'revive', 0.5, 24, 'Drag an ally back from death.'),
            S('army_dead', 'Army of the Dead', 36, 'enemies', 'mag', 2.5, 40, 'Ultimate: the dead rise and swarm.', { el: 'dark', hits: 2 }),
        ] },
};

// every skill by id, with its class
export const SKILLS = {};
for (const [cid, c] of Object.entries(CLASSES)) for (const s of c.skills) SKILLS[s.id] = { ...s, cls: cid };

// ---------------------------------------------------------------- heroes
// recruit: gold cost at the tavern; unlock: highest floor reached before they show up.
// art/portrait/evolved: what the fal prompts were written from.
export const HEROES = [
    { id: 'arin', name: 'Arin', cls: 'knight', recruit: 0, unlock: 0, hero: true,
        title: 'Warden of Hearthmere',
        bio: 'A stubborn young knight who swore to climb the Emberspire after it swallowed his father\'s patrol.',
        art: 'Arin, a young knight with tousled auburn hair, steel plate armour with a crimson tabard bearing a small flame emblem, a kite shield on one arm and a longsword held ready',
        evolved: 'the same knight Arin now in gleaming gold-trimmed white and crimson plate armour with a flowing red cape, a winged helm under his arm style circlet, a radiant runed longsword and a tall ornate shield',
        portrait: 'Arin, a determined young knight with tousled auburn hair, green eyes, a small scar on his chin, steel pauldrons and a crimson tabard with a flame emblem' },
    { id: 'mira', name: 'Mira', cls: 'cleric', recruit: 0, unlock: 0,
        title: 'Lantern of the Temple',
        bio: 'Raised in the temple, gentle and quietly fearless. She thinks the tower is sick, not evil.',
        art: 'Mira, a kind young cleric with long silver-blonde braided hair, a white and gold hooded vestment with a sun pendant, holding a tall staff topped with a golden sun',
        evolved: 'the same cleric Mira now in radiant flowing white and gold high priestess robes with a halo-like sun circlet, glowing golden wings of light behind her, an ornate sun staff',
        portrait: 'Mira, a kind young cleric with long silver-blonde braided hair, soft amber eyes, a white and gold hooded vestment with a sun pendant, a gentle warm smile' },
    { id: 'brakka', name: 'Brakka', cls: 'berserker', recruit: 120, unlock: 2,
        title: 'Exile of the Ashfang Clan',
        bio: 'A half-orc axe-woman who laughs in every fight and refuses to talk about why her clan cast her out.',
        art: 'Brakka, a muscular half-orc woman with green-grey skin, small tusks, a wild black mohawk braid, fur and iron armour, war paint, a huge double-bladed battle axe',
        evolved: 'the same half-orc warrior Brakka now in massive spiked blackened iron armour with a wolf-skull pauldron, glowing red war paint, a giant crimson-edged greataxe',
        portrait: 'Brakka, a half-orc woman with green-grey skin, small tusks, a wild black braided mohawk, red war paint stripes, a broad grin, fur collar' },
    { id: 'sylas', name: 'Sylas', cls: 'rogue', recruit: 160, unlock: 4,
        title: 'Gentleman Thief',
        bio: 'An elven pickpocket with excellent manners and terrible habits. Owes money to half the town.',
        art: 'Sylas, a slim elven rogue with silver hair tied back, a dark teal hooded leather coat, a scarf over his lower face, twin curved daggers',
        evolved: 'the same elf rogue Sylas now in sleek midnight-black and violet assassin leathers with a shadowy flowing cloak, glowing violet eyes, twin black crystal daggers',
        portrait: 'Sylas, a handsome slim elf with silver hair tied back, sly violet eyes, a confident smirk, a dark teal hood and leather collar' },
    { id: 'lyra', name: 'Lyra', cls: 'ranger', recruit: 200, unlock: 6,
        title: 'Warden of the Greenwood',
        bio: 'A forest ranger who followed the tower\'s roots up out of the woods and wants to know why the trees are dying.',
        art: 'Lyra, a freckled young ranger with a long red ponytail, a green hooded cloak, leather bracers, a longbow drawn, a quiver on her back',
        evolved: 'the same ranger Lyra now in elegant leaf-patterned emerald armour, an antlered circlet, a glowing living-wood longbow, a white wolf spirit beside her',
        portrait: 'Lyra, a freckled young woman with a long red ponytail, bright green eyes, a green hood, a feather in her hair, a warm confident smile' },
    { id: 'thorne', name: 'Thorne', cls: 'mage', recruit: 260, unlock: 8,
        title: 'Expelled Prodigy',
        bio: 'Thrown out of the Academy for setting the library on fire. Twice. Insists the second time was a different library.',
        art: 'Thorne, a lanky young mage with messy black hair, round spectacles, a midnight-blue robe with star embroidery, an open glowing spellbook in one hand and fire in the other',
        evolved: 'the same mage Thorne now in grand midnight-blue and gold archmage robes with a high collar, floating arcane runes circling him, a staff of crystal and starlight',
        portrait: 'Thorne, a lanky young man with messy black hair, round spectacles, sharp grey eyes, a slightly smug smile, a midnight-blue star-embroidered collar' },
    { id: 'pip', name: 'Pip', cls: 'bard', recruit: 320, unlock: 12,
        title: 'Wandering Minstrel',
        bio: 'A halfling bard writing the definitive ballad of the Emberspire, and needs to see the top to finish it.',
        art: 'Pip, a cheerful halfling bard with curly chestnut hair, a feathered green cap, a patchwork orange and yellow doublet, playing a lute',
        evolved: 'the same halfling bard Pip now in a splendid crimson and gold performer\'s coat, a grand plumed hat, a glowing enchanted golden lute with musical notes of light around it',
        portrait: 'Pip, a cheerful halfling with curly chestnut hair, rosy cheeks, a big grin, a feathered green cap and an orange doublet collar' },
    { id: 'grimble', name: 'Grimble', cls: 'alchemist', recruit: 380, unlock: 16,
        title: 'Master of Unsafe Sciences',
        bio: 'A dwarf alchemist with no eyebrows left. Wants the tower\'s ember crystals for reasons he calls "research".',
        art: 'Grimble, a stout dwarf alchemist with a huge braided ginger beard, brass goggles on his forehead, a leather apron full of vials, holding a fizzing bomb flask',
        evolved: 'the same dwarf alchemist Grimble now in a reinforced brass and leather alchemist rig with a backpack of bubbling tanks, glowing goggles, a large bomb launcher',
        portrait: 'Grimble, a stout dwarf with a huge braided ginger beard, brass goggles on his forehead, singed eyebrows, a mischievous grin' },
    { id: 'nyx', name: 'Nyx', cls: 'warlock', recruit: 450, unlock: 22,
        title: 'Bound to Something Below',
        bio: 'A tiefling warlock whose patron lives somewhere in the tower. She climbs to break the pact, or so she says.',
        art: 'Nyx, a tiefling warlock woman with lavender skin, curved black horns, long dark violet hair, a black and purple hooded robe with silver chains, a bone scythe with violet flame',
        evolved: 'the same tiefling warlock Nyx now in an elegant black and violet gown-armour with a high collar, a crown of dark crystal between her horns, a huge scythe of violet fire',
        portrait: 'Nyx, a tiefling woman with lavender skin, curved black horns, long dark violet hair, glowing golden eyes, a wry half-smile, a black hood with silver chains' },
];

export const HERO = Object.fromEntries(HEROES.map((h) => [h.id, h]));
