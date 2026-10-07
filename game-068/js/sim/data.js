/**
 * data.js — everything the simulation knows about: ailments, aid stations, the dead, people,
 * trades, volunteers and bosses. Plain data, no three.js, no DOM.
 */

// ------------------------------------------------------------------ ailments
// `key` is also the icon id in the view's atlas.
export const AILMENTS = {
    wound:    { name: 'Wound',    icon: '🩸', color: '#e0483e', treat: 'medic',   blurb: 'Bleeding. Loses health every second until it is bandaged.' },
    sick:     { name: 'Blight',   icon: '🦠', color: '#6fcf5a', treat: 'remedy',  blurb: 'The sickness the dead carry. It spreads, and a bad fever drains health.' },
    hunger:   { name: 'Hunger',   icon: '🥣', color: '#e8a640', treat: 'kitchen', blurb: 'Weak from days without food: slower, and hurt more easily.' },
    cold:     { name: 'Cold',     icon: '❄️', color: '#8ccff5', treat: 'fire',    blurb: 'Winter gets into the bones. Chilled people slow down and lose health.' },
    fracture: { name: 'Fracture', icon: '🦴', color: '#f1ead8', treat: 'splint',  blurb: 'A broken leg. Barely half speed, so the dead catch up.' },
    fear:     { name: 'Fear',     icon: '⚡', color: '#c39cf2', treat: 'song',    blurb: 'Terrified. A panicked person sometimes freezes on the spot.' },
};
export const AILMENT_KEYS = Object.keys(AILMENTS);

// Tunables for the ailments (per second unless noted).
export const AIL = {
    woundDrain: 1.5,        // HP/s per wound level
    sickSpread: 0.7,        // blight rises once caught
    sickDrainHi: 1.2,       // above 70
    sickHi: 70,
    sickDrainMax: 3,        // at 100
    coldRise: 1.2,          // ambient, in winter
    coldDrainHi: 1.5,
    coldDrainMax: 4,
    coldSlow: 0.8,
    hungerSlow: 0.85,
    hungerHurt: 1.4,
    fractureSlow: 0.55,
    fearNear: 6,             // within 1.8 tiles of the dead
    fearDecay: 3,           // when none of the dead are near
    fearFreezeChance: 0.35, // per check (every 2.5 s) while above 50
    tempDecay: 1,
    downTime: 14,           // seconds to revive a collapsed person
    downTimeNear: 5,        // ...when the dead are standing over them
};

// ------------------------------------------------------------------ aid stations
// Each level entry: [range, interval, power, extra]. Costs: build, then the two upgrades.
export const STATIONS = {
    medic: {
        name: 'Medic Tent', icon: '⛑️', unlock: 1, cost: [50, 60, 90], color: 0xe94b4b,
        lv: [{ range: 2.5, every: 0.9, heal: 14, targets: 1 }, { range: 2.8, every: 0.7, heal: 20, targets: 1 }, { range: 3.1, every: 0.55, heal: 28, targets: 2 }],
        blurb: 'Bandages the most wounded in reach, closes wounds and revives anyone who has collapsed.',
        treats: ['wound'],
    },
    lantern: {
        name: 'Lantern Post', icon: '🏮', unlock: 1, cost: [40, 50, 80], color: 0xf5b83a,
        lv: [{ range: 2.0, slow: 0.35 }, { range: 2.4, slow: 0.45 }, { range: 2.8, slow: 0.55, flare: 7, stun: 1.2 }],
        blurb: 'The dead shy away from light and slow down near it. Frightened people take heart. Lv3 fires a flare.',
        treats: [],
    },
    remedy: {
        name: 'Remedy Lab', icon: '⚗️', unlock: 2, cost: [70, 70, 110], color: 0x5fcf7a,
        lv: [{ range: 2.6, every: 1.4, cure: 35, splash: 0.8 }, { range: 3.0, every: 1.1, cure: 45, splash: 1.0 }, { range: 3.3, every: 0.9, cure: 60, splash: 1.3, immune: 6 }],
        blurb: 'Lobs a cure vial that splashes and clears the blight. Lv3 leaves people immune for a while.',
        treats: ['sick'],
    },
    kitchen: {
        name: 'Field Kitchen', icon: '🍲', unlock: 3, cost: [60, 60, 100], color: 0xf08a3a,
        lv: [{ range: 2.4, every: 1.6, temp: 20 }, { range: 2.7, every: 1.3, temp: 30 }, { range: 3.0, every: 1.0, temp: 45 }],
        blurb: 'Hot soup: cures hunger and gives temporary health that soaks up harm.',
        treats: ['hunger'],
    },
    fire: {
        name: 'Warming Fire', icon: '🔥', unlock: 5, cost: [55, 50, 90], color: 0xff7a2a,
        lv: [{ range: 1.8, warm: 25, buff: 6, heal: 0 }, { range: 2.2, warm: 35, buff: 8, heal: 2 }, { range: 2.6, warm: 50, buff: 12, heal: 3 }],
        blurb: 'A crackling fire and a pile of blankets. Drives the cold out and keeps people warm for a while.',
        treats: ['cold'],
    },
    stretcher: {
        name: 'Stretcher Crew', icon: '🚑', unlock: 5, cost: [80, 70, 110], color: 0xf2f2f2,
        lv: [{ range: 3.0, channel: 1.2, revive: 0.4, carry: 1, every: 3 }, { range: 3.5, channel: 0.9, revive: 0.55, carry: 1.5, every: 2.5, hop: 4 }, { range: 4.0, channel: 0.6, revive: 0.7, carry: 2, every: 2, hop: 3 }],
        blurb: 'Runs out to the collapsed and gets them back on their feet, a little further down the road. Lv2 also carries the limping.',
        treats: [],
    },
    splint: {
        name: 'Splint Post', icon: '🦯', unlock: 6, cost: [60, 60, 100], color: 0x9ad0e8,
        lv: [{ range: 2.4, every: 1.5, targets: 1, boost: 0 }, { range: 2.8, every: 1.1, targets: 1, boost: 4 }, { range: 3.2, every: 0.8, targets: 2, boost: 6 }],
        blurb: 'Sets broken bones. Lv2 sends the mended off with a second wind.',
        treats: ['fracture'],
    },
    song: {
        name: 'Song Circle', icon: '🎻', unlock: 7, cost: [75, 70, 110], color: 0xb48af2,
        lv: [{ range: 2.2, calm: 30, courage: 3, cap: 20 }, { range: 2.6, calm: 40, courage: 4, cap: 30 }, { range: 3.0, calm: 55, courage: 5, cap: 40, sway: 0.25 }],
        blurb: 'A fiddle and a few voices. Clears fear and builds courage, temporary health. Lv3 makes the dead sway and slow.',
        treats: ['fear'],
    },
    bell: {
        name: 'Signal Bell', icon: '🔔', unlock: 9, cost: [70, 70, 110], color: 0xd9b45a,
        lv: [{ range: 2.4, every: 9, lure: 3 }, { range: 2.8, every: 8, lure: 4 }, { range: 3.2, every: 6, lure: 5 }],
        blurb: 'Rings out, and the dead in reach wander off the road toward it for a while.',
        treats: [],
    },
};
export const STATION_KEYS = Object.keys(STATIONS);
export const SELL_BACK = 0.7;

// ------------------------------------------------------------------ the dead
// speed in tiles/s; blight is their cure meter in boss levels.
export const DEAD = {
    shambler: { name: 'Shambler', speed: 0.7,  hurt: 8,  wound: 1, sick: 18, fear: 20, blight: 70,  scale: 1.0, resist: 0, haven: 1, blurb: 'Slow. Catches only those who are limping, frozen or weak.' },
    spitter:  { name: 'Spitter',  speed: 0.65, hurt: 6,  wound: 0, sick: 14, fear: 15, blight: 80,  scale: 1.0, resist: 0, haven: 1, spit: { every: 3.5, range: 2.5, sick: 20, hurt: 2 }, blurb: 'Spits blight at people a few tiles away.' },
    runner:   { name: 'Runner',   speed: 1.45, hurt: 6,  wound: 1, sick: 12, fear: 25, blight: 50,  scale: 0.95, resist: 0, haven: 1, blurb: 'Faster than anyone on the road.' },
    brute:    { name: 'Brute',    speed: 0.55, hurt: 18, wound: 2, sick: 20, fear: 30, blight: 260, scale: 1.45, resist: 0.5, haven: 2, blurb: 'Huge and slow. Scratches hard, and lanterns and bells only half work on it.' },
    howler:   { name: 'Howler',   speed: 0.75, hurt: 6,  wound: 1, sick: 12, fear: 20, blight: 100, scale: 1.05, resist: 0, haven: 1, howl: { every: 5, range: 2.5, fear: 30 }, blurb: 'Its howl fills everyone nearby with fear.' },
};
export const DEAD_KEYS = Object.keys(DEAD);
export const SCRATCH_EVERY = 1.2;
export const REACH = 0.5;          // how close the dead must be to scratch a walker
export const VOL_REACH = 1.05;     // ...and a volunteer standing beside the road

// ------------------------------------------------------------------ bosses
export const BOSSES = {
    giant: {
        name: 'The Hollow Giant', speed: 0.34, blight: 2200, scale: 3.2, haven: 99,
        slam: { every: 4, range: 1.7, hurt: 30, wound: 2, fear: 35 }, call: { every: 11, kind: 'shambler', n: 3 },
        from: 'Tomas Hale', cured: 'Tomas Hale, a farmer, who has no idea how he got so tall in his dreams.',
    },
    wailer: {
        name: 'The Winter Wailer', speed: 0.36, blight: 3800, scale: 3.0, haven: 99,
        wail: { every: 6, range: 3, fear: 55, cold: 40, hurt: 8 }, call: { every: 10, kind: 'runner', n: 3 },
        from: 'Agnes Frost', cured: 'Agnes Frost, the choir mistress, who would very much like a cup of tea.',
    },
    heart: {
        name: 'The Blight Heart', speed: 0.3, blight: 5000, scale: 3.6, haven: 99,
        glob: { every: 3, range: 3.2, sick: 40, hurt: 10, splash: 1.0 },
        call: { every: 9, kind: 'brute', n: 1, also: 'spitter' },
        slam: { every: 5, range: 1.6, hurt: 24, wound: 2, fear: 30 },
        phases: [0.66, 0.33],
        from: 'Everyone who walked out of the Heart', cured: 'Everyone it ever took, walking out of the light, blinking at the sunrise.',
    },
};

// ------------------------------------------------------------------ people
export const KINDS = {
    adult:   { hp: 100, speed: 1.1,  scale: 1.0,  fearMul: 1.0 },
    elder:   { hp: 70,  speed: 0.88, scale: 0.95, fearMul: 0.8 },
    child:   { hp: 60,  speed: 1.18, scale: 0.68, fearMul: 1.5 },
    carrier: { hp: 120, speed: 0.92, scale: 1.05, fearMul: 0.9, supplies: 10 },
};

export const TRADES = {
    firefighter: { name: 'Firefighter', icon: '🧑‍🚒', hat: 'helmet', color: 0xd8382e,
        range: 1.9, every: 1.2, cure: 18, cone: 0.9, push: 0.35, blurb: 'Hoses the dead in a wide spray and pushes them back.' },
    nurse:       { name: 'Nurse', icon: '🧑‍⚕️', hat: 'cap', color: 0x6fc3e8,
        range: 2.4, every: 1.0, cure: 20, mend: { every: 3, range: 1.6, heal: 8 }, blurb: 'Cure darts, and patches up the volunteers nearby.' },
    gardener:    { name: 'Gardener', icon: '🧑‍🌾', hat: 'straw', color: 0x7ab648,
        range: 2.6, every: 2.0, cure: 26, splash: 1.0, blurb: 'Herb bombs that burst over a crowd.' },
    athlete:     { name: 'Athlete', icon: '🏃', hat: 'band', color: 0xf0c03a,
        range: 2.8, every: 0.55, cure: 11, blurb: 'Quick, accurate tosses, one after another.' },
    musician:    { name: 'Musician', icon: '🎺', hat: 'beret', color: 0xa77ae0,
        range: 2.2, aura: 6, slow: 0.3, calm: 20, blurb: 'A lullaby: everything in reach slows and is cured a little at a time. Calms volunteers.' },
    mechanic:    { name: 'Mechanic', icon: '🔧', hat: 'goggles', color: 0x6b7f99,
        range: 3.4, every: 2.6, cure: 45, beam: 0.45, stun: 0.5, blurb: 'A floodlight beam that cuts down the whole line and stuns.' },
    storyteller: { name: 'Storyteller', icon: '📖', hat: 'flatcap', color: 0xc9a27a,
        range: 2.0, aura: 4, rally: 0.3, blurb: 'Elders who rally everyone near them: faster hands and no fear.' },
    neighbour:   { name: 'Neighbour', icon: '🙋', hat: 'none', color: 0x9a8f80,
        range: 2.4, every: 0.8, cure: 10, blurb: 'Folk from the Haven. Always three of them ready to help.' },
};
export const TRADE_KEYS = Object.keys(TRADES);
// Trades an adult can have (elders are storytellers, children have none).
export const ADULT_TRADES = ['firefighter', 'nurse', 'gardener', 'athlete', 'musician', 'mechanic'];
export const VOL = { hp: 100, rest: 20, downTime: 3, neighbours: 3, perExtra: 0.03, maxBonus: 0.6 };

export const LOOKS = {
    skin: [0xf2d0b0, 0xe0b48e, 0xc6926a, 0x9a6a48, 0x6e4a32, 0xf5dcc6],
    hair: [0x2a2018, 0x5a3a1e, 0xa86a32, 0xe0c070, 0xb8502a, 0xd8d8d8, 0x8a8f96],
    cloth: [0x3f6fb5, 0xb54a3f, 0x4f9a5a, 0xd9a53a, 0x7a5aa8, 0x2f8f8a, 0xc96a9a, 0x6a6a72, 0x9a6a3a, 0xe0dcc8, 0x2f3f5f, 0xc8502a],
};
