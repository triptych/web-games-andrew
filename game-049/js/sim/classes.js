/**
 * classes.js — the three heroes, their skills (data only; effects live in
 * game.js) and the level-up perk pool.
 */

export const CLASSES = {
    warden: {
        id: 'warden', name: 'Warden', tag: 'Shield and steel',
        blurb: 'A Lastlight watch-captain. Hits hard, takes a beating, and keeps the dark at arm\'s length.',
        hp: 42, hpLvl: 7, stats: { might: 6, agi: 3, will: 2 }, grow: { might: 1, agi: 0.5, will: 0.25 },
        gear: ['sword', 'chain'], col: 0x4a7ab0, col2: 0xd0d8e0,
        skills: ['cleave', 'bash', 'warcry', 'bulwark'],
    },
    ranger: {
        id: 'ranger', name: 'Ranger', tag: 'Eyes in the dark',
        blurb: 'A mountain tracker who can put an arrow through a keyhole by lantern-light. Fragile up close.',
        hp: 32, hpLvl: 5, stats: { might: 3, agi: 6, will: 3 }, grow: { might: 0.4, agi: 1, will: 0.35 },
        gear: ['bow', 'leather'], col: 0x4a8a4a, col2: 0xc0a070,
        skills: ['volley', 'pin', 'tumble', 'mark'],
    },
    witch: {
        id: 'witch', name: 'Emberwitch', tag: 'Fire kept in a jar',
        blurb: 'Maren\'s other apprentice, who learned the Lantern\'s fire instead of its keeping. Burns bright, burns out.',
        hp: 26, hpLvl: 4, stats: { might: 2, agi: 3, will: 7 }, grow: { might: 0.25, agi: 0.5, will: 1 },
        gear: ['staff', 'robe'], col: 0x8a3ab0, col2: 0xffb050,
        skills: ['firebolt', 'nova', 'blink', 'meteor'],
    },
};

/**
 * Skills. tgt: 'self' | 'enemy' (a visible hostile) | 'tile' (a visible floor tile) | 'adj' (adjacent enemy).
 * lvl: hero level that unlocks it. cd: cooldown in turns. range for targeted skills.
 */
export const SKILLS = {
    cleave:  { n: 'Cleave', icon: '⟲', tgt: 'self', cd: 5, lvl: 1, d: 'Strike every adjacent enemy.' },
    bash:    { n: 'Shield Bash', icon: '⛨', tgt: 'adj', cd: 7, lvl: 3, d: 'Stun an adjacent enemy for 2 turns and knock it back.' },
    warcry:  { n: 'War Cry', icon: '✺', tgt: 'self', cd: 14, lvl: 6, d: 'Weaken enemies within 3 tiles; the weak-willed flee.' },
    bulwark: { n: 'Bulwark', icon: '▣', tgt: 'self', cd: 18, lvl: 10, d: 'Take 70% less damage for 4 turns.' },
    volley:  { n: 'Volley', icon: '⇶', tgt: 'self', cd: 5, lvl: 1, d: 'Loose an arrow at up to 3 visible enemies.' },
    pin:     { n: 'Pinning Shot', icon: '➹', tgt: 'enemy', cd: 7, lvl: 3, range: 7, d: 'A heavy shot (150%) that roots the target for 3 turns.' },
    tumble:  { n: 'Tumble', icon: '↯', tgt: 'tile', cd: 9, lvl: 6, range: 3, d: 'Leap to a visible tile up to 3 away (half a turn).' },
    mark:    { n: 'Mark Prey', icon: '◎', tgt: 'enemy', cd: 14, lvl: 10, range: 9, d: 'The target takes +50% damage for 8 turns; reveals the area around it.' },
    firebolt:{ n: 'Firebolt', icon: '✦', tgt: 'enemy', cd: 3, lvl: 1, range: 6, d: 'A bolt of fire that sets the target burning.' },
    nova:    { n: 'Frost Nova', icon: '❄', tgt: 'self', cd: 10, lvl: 3, d: 'Freeze every enemy within 2 tiles for 2 turns.' },
    blink:   { n: 'Blink', icon: '✧', tgt: 'tile', cd: 10, lvl: 6, range: 5, d: 'Teleport to a visible tile up to 5 away (half a turn).' },
    meteor:  { n: 'Meteor', icon: '☄', tgt: 'tile', cd: 15, lvl: 10, range: 7, d: 'Call a meteor: a 3×3 blast next turn that burns.' },
};

/** Level-up perks. max: ranks. cls: restrict to a class. */
export const PERKS = {
    tough:      { n: 'Toughness', d: '+12% max health.', max: 5 },
    brute:      { n: 'Brutality', d: '+12% weapon damage.', max: 5 },
    keen:       { n: 'Keen Edge', d: '+5% critical chance; crits deal more.', max: 3 },
    skin:       { n: 'Thick Skin', d: '+2 armour, growing with your level.', max: 4 },
    nimble:     { n: 'Nimble', d: '+6 evasion.', max: 4 },
    aim:        { n: 'Steady Aim', d: '+8 accuracy.', max: 3 },
    lamp:       { n: 'Lamplighter', d: 'Your lantern burns 25% slower.', max: 2 },
    bright:     { n: 'Bright Wick', d: '+1 light radius.', max: 2 },
    vamp:       { n: 'Vampiric', d: 'Heal 3% of max health on each kill.', max: 3 },
    quick:      { n: 'Quick Hands', d: 'All skill cooldowns −1.', max: 2 },
    second:     { n: 'Second Wind', d: 'Once per floor, below 25% health, heal 40%.', max: 1 },
    gold:       { n: 'Treasure Sense', d: '+35% gold; chests hold more.', max: 2 },
    path:       { n: 'Pathfinder', d: 'Spot traps from further away; auto-explore finds secrets.', max: 1 },
    regen:      { n: 'Hearty', d: 'Regenerate 1 health every 6 turns (more as you level).', max: 3 },
    potion:     { n: 'Alchemist', d: 'Potions heal 30% more; find more of them.', max: 2 },
    resist:     { n: 'Hardy', d: '+20% resistance to fire, cold and poison.', max: 3 },
    might:      { n: 'Might', d: '+2 Might.', max: 5 },
    agi:        { n: 'Agility', d: '+2 Agility.', max: 5 },
    will:       { n: 'Will', d: '+2 Will.', max: 5 },
    scholar:    { n: 'Scholar', d: '+15% experience.', max: 2 },
    // class perks
    shieldwall: { n: 'Shield Wall', d: 'Bulwark and Shield Bash cool down 3 turns faster.', max: 1, cls: 'warden' },
    reaver:     { n: 'Reaver', d: 'Cleave deals 40% more and heals you per enemy struck.', max: 2, cls: 'warden' },
    sentinel:   { n: 'Sentinel', d: '20% chance to counter-attack when struck in melee.', max: 2, cls: 'warden' },
    hunter:     { n: 'Hunter', d: 'Ranged attacks deal +15% to targets 3+ tiles away.', max: 3, cls: 'ranger' },
    fletcher:   { n: 'Fletcher', d: 'Volley fires one extra arrow.', max: 2, cls: 'ranger' },
    shadowstep: { n: 'Shadowstep', d: 'Tumble recharges 3 turns faster and grants +10 evasion for 3 turns.', max: 1, cls: 'ranger' },
    pyro:       { n: 'Pyromaniac', d: 'Burns last longer and hit harder; Firebolt +20%.', max: 3, cls: 'witch' },
    frostheart: { n: 'Frostheart', d: 'Frost Nova reaches 3 tiles and freezes 1 turn longer.', max: 1, cls: 'witch' },
    channel:    { n: 'Channeller', d: '+15% spell power.', max: 4, cls: 'witch' },
};

export const xpToNext = (lvl) => Math.round(15 * Math.pow(lvl, 1.75) + 10);
