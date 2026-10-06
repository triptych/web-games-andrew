// Hero classes and their skills. Every skill scales from the equipped weapon's damage roll
// (Diablo III style), times its multiplier, times (1 + main stat / 100).
// kind drives js/sim/skills.js; `r` is the skill's rank (1..20).

export const CLASSES = {
    knight: {
        id: 'knight', name: 'Melon Knight', icon: '🛡️', main: 'str',
        blurb: 'A stout fruit with a big knife and a bigger heart. Slices up close, soaks up hits, never retreats (mostly because of the short legs).',
        base: { str: 25, dex: 15, mag: 10, vit: 25 }, hpPerLvl: 5, juicePerLvl: 0.6, baseHp: 34, baseJuice: 20,
        weapons: ['melee1', 'melee2'], offhands: ['shield'], juiceOnHit: 3, juiceRegen: 1.2,
        skills: ['slice', 'bash', 'bigslice', 'juiceup', 'leap', 'blender'],
        start: { weapon: 'Butter Knife', offhand: 'Pot Lid' }, defaultFruit: 'watermelon', defaultHat: 'helm',
    },
    ranger: {
        id: 'ranger', name: 'Seed Ranger', icon: '🏹', main: 'dex',
        blurb: 'Quick, sharp-eyed and spitting seeds at speeds the orchard has never seen. Keep your distance and they will never touch your peel.',
        base: { str: 15, dex: 25, mag: 15, vit: 20 }, hpPerLvl: 4, juicePerLvl: 1, baseHp: 34, baseJuice: 26,
        weapons: ['bow'], offhands: ['pouch'], juiceOnHit: 1, juiceRegen: 2.0,
        skills: ['seedshot', 'pomegranate', 'pipspray', 'roll', 'peeltrap', 'raisinrain'],
        start: { weapon: 'Straw Shooter', offhand: 'Seed Pouch' }, defaultFruit: 'strawberry', defaultHat: 'feather',
    },
    mage: {
        id: 'mage', name: 'Citromancer', icon: '🔮', main: 'mag',
        blurb: 'A scholar of sour sorcery. Hurls zest, freezes brains, and once dropped a whole watermelon on a moth. Fragile. Very, very zesty.',
        base: { str: 10, dex: 15, mag: 30, vit: 20 }, hpPerLvl: 3.5, juicePerLvl: 2, baseHp: 28, baseJuice: 34,
        weapons: ['wand', 'staff'], offhands: ['orb'], juiceOnHit: 0, juiceRegen: 3.2,
        skills: ['zestbolt', 'caramelize', 'brainfreeze', 'limening', 'peelport', 'melonmeteor'],
        start: { weapon: 'Pretzel Wand', offhand: 'Gumball' }, defaultFruit: 'lemon', defaultHat: 'wizard',
    },
};

const pct = (x) => Math.round(x * 100) + '%';

export const SKILLS = {
    // ---------------------------------------------------------------- Melon Knight
    slice: {
        name: 'Slice', icon: '🔪', lvl: 1, cost: 0, cd: 0, kind: 'melee', basic: true, range: 1.45, arc: 110, elem: 'phys',
        mult: (r) => 1 + 0.08 * (r - 1),
        desc: (r, s) => `Swing your weapon in a short arc for ${pct(s.mult(r))} weapon damage. Each hit squeezes out ${3} Juice.`,
    },
    bash: {
        name: 'Rind Bash', icon: '🛡️', lvl: 1, cost: 6, cd: 0, kind: 'melee', range: 1.5, arc: 50, elem: 'phys', single: true,
        mult: (r) => 1.6 + 0.15 * (r - 1), stun: (r) => 0.9 + 0.08 * r, knock: 2.6,
        desc: (r, s) => `Thwack one enemy with your shield for ${pct(s.mult(r))} weapon damage, knock it back and stun it for ${s.stun(r).toFixed(1)} s.`,
    },
    bigslice: {
        name: 'Big Slice', icon: '🌀', lvl: 2, cost: 8, cd: 0, kind: 'melee', range: 2.0, arc: 220, elem: 'phys',
        mult: (r) => 1.3 + 0.12 * (r - 1),
        desc: (r, s) => `A huge sweeping cut that hits everything in front of you for ${pct(s.mult(r))} weapon damage.`,
    },
    juiceup: {
        name: 'Juice Up!', icon: '💪', lvl: 4, cost: 12, cd: 14, kind: 'buff', dur: 10,
        dmg: (r) => 0.3 + 0.05 * (r - 1), armor: 0.5, heal: 0.12,
        desc: (r, s) => `Flex your rind: +${pct(s.dmg(r))} damage and +50% armor for 10 s, and recover 12% Freshness.`,
    },
    leap: {
        name: 'Pit Leap', icon: '🦘', lvl: 7, cost: 14, cd: 5, kind: 'leap', maxRange: 7, radius: 2.3, elem: 'phys',
        mult: (r) => 1.8 + 0.2 * (r - 1), stun: 0.7,
        desc: (r, s) => `Leap through the air and land with a squelch, dealing ${pct(s.mult(r))} weapon damage around you and stunning enemies.`,
    },
    blender: {
        name: 'Blender', icon: '🌪️', lvl: 11, cost: 20, cd: 0, kind: 'spin', dur: 3, radius: 1.8, tick: 0.25, elem: 'phys',
        mult: (r) => 0.6 + 0.06 * (r - 1),
        desc: (r, s) => `Spin like a blender on max for 3 s, hitting everything nearby for ${pct(s.mult(r))} weapon damage every quarter second. You can move while spinning.`,
    },
    // ---------------------------------------------------------------- Seed Ranger
    seedshot: {
        name: 'Seed Shot', icon: '🌰', lvl: 1, cost: 0, cd: 0, kind: 'shot', basic: true, speed: 19, elem: 'phys', proj: 'seed', pierce: 1,
        mult: (r) => 1 + 0.08 * (r - 1),
        desc: (r, s) => `Spit a seed for ${pct(s.mult(r))} weapon damage. It punches through the first enemy it hits. Never runs out. Mildly rude.`,
    },
    pomegranate: {
        name: 'Pomegranate Pop', icon: '💥', lvl: 1, cost: 7, cd: 0, kind: 'shot', speed: 15, elem: 'fire', proj: 'pome', radius: 1.9,
        mult: (r) => 1.5 + 0.15 * (r - 1),
        desc: (r, s) => `Lob a pomegranate that bursts into spicy seeds, dealing ${pct(s.mult(r))} weapon damage as fire in an area.`,
    },
    pipspray: {
        name: 'Pip Spray', icon: '🎇', lvl: 2, cost: 9, cd: 0, kind: 'fan', speed: 18, elem: 'phys', proj: 'seed', spread: 50,
        count: (r) => 5 + Math.floor((r - 1) / 3), mult: (r) => 0.7 + 0.06 * (r - 1),
        desc: (r, s) => `Fire a fan of ${s.count(r)} seeds, each dealing ${pct(s.mult(r))} weapon damage.`,
    },
    roll: {
        name: 'Somersault', icon: '🤸', lvl: 4, cost: 5, cd: 2.2, kind: 'dash', dist: 4.6, invuln: 0.35,
        desc: () => `Roll up to 4.6 m, dodging everything on the way. Fruit are excellent at rolling.`,
    },
    peeltrap: {
        name: 'Peel Trap', icon: '🍌', lvl: 7, cost: 10, cd: 0.6, kind: 'trap', maxRange: 8, radius: 1.8, elem: 'phys',
        mult: (r) => 1.4 + 0.12 * (r - 1), stun: (r) => 1.6 + 0.1 * r, max: 3,
        desc: (r, s) => `Drop a banana peel trap (up to 3). The first enemy to step near it slips, stunning everything close for ${s.stun(r).toFixed(1)} s and taking ${pct(s.mult(r))} weapon damage.`,
    },
    raisinrain: {
        name: 'Raisin Rain', icon: '🌧️', lvl: 11, cost: 22, cd: 4, kind: 'rain', maxRange: 11, radius: 3.0, dur: 3, tick: 0.3, elem: 'phys',
        mult: (r) => 0.45 + 0.05 * (r - 1),
        desc: (r, s) => `Call down a storm of raisins for 3 s, hitting everything in the area for ${pct(s.mult(r))} weapon damage every 0.3 s.`,
    },
    // ---------------------------------------------------------------- Citromancer
    zestbolt: {
        name: 'Zest Bolt', icon: '✨', lvl: 1, cost: 0, cd: 0, kind: 'shot', basic: true, speed: 16, elem: 'light', proj: 'zest', homing: 3,
        mult: (r) => 1 + 0.08 * (r - 1),
        desc: (r, s) => `A homing spark of pure citrus for ${pct(s.mult(r))} weapon damage as fizz.`,
    },
    caramelize: {
        name: 'Caramelize', icon: '🔥', lvl: 1, cost: 9, cd: 0, kind: 'shot', speed: 13, elem: 'fire', proj: 'fire', radius: 2.0, burn: 3,
        mult: (r) => 1.8 + 0.18 * (r - 1),
        desc: (r, s) => `Hurl a ball of molten sugar that explodes for ${pct(s.mult(r))} weapon damage as fire and leaves enemies burning.`,
    },
    brainfreeze: {
        name: 'Brain Freeze', icon: '❄️', lvl: 2, cost: 14, cd: 3, kind: 'nova', radius: 4.2, elem: 'cold', freeze: (r) => 1.3 + 0.07 * r,
        mult: (r) => 0.9 + 0.1 * (r - 1),
        desc: (r, s) => `An icy nova: ${pct(s.mult(r))} weapon damage as cold to everything around you, freezing them solid for ${s.freeze(r).toFixed(1)} s.`,
    },
    limening: {
        name: 'Chain Lime-ning', icon: '⚡', lvl: 4, cost: 11, cd: 0, kind: 'chain', range: 9, jump: 5, elem: 'light',
        jumps: (r) => 3 + Math.floor(r / 2), mult: (r) => 1.25 + 0.12 * (r - 1),
        desc: (r, s) => `A crackling green bolt hits a target and jumps to ${s.jumps(r)} more, ${pct(s.mult(r))} weapon damage as fizz each.`,
    },
    peelport: {
        name: 'Peel-port', icon: '🌀', lvl: 7, cost: 12, cd: 1.2, kind: 'teleport', maxRange: 9,
        desc: () => `Peel yourself out of reality and back in up to 9 m away. Leaves a faint lemony smell.`,
    },
    melonmeteor: {
        name: 'Melon Meteor', icon: '🍉', lvl: 11, cost: 28, cd: 3, kind: 'meteor', maxRange: 12, radius: 2.9, delay: 0.95, elem: 'fire',
        mult: (r) => 3.6 + 0.35 * (r - 1),
        desc: (r, s) => `Summon a flaming watermelon from the sky. It lands for ${pct(s.mult(r))} weapon damage as fire and leaves the ground burning.`,
    },
};

export const MAX_SKILL_RANK = 20;
