// UFOops! — content tables. Pure data: the rules read these, the view and UI name things from them.

// Things that walk the ground and can be beamed up.
// weight slows the lift; value is points when banked at the Mother Ship.
export const SPECIMENS = {
    cow:     { name: 'Cow',          value: 100, weight: 1.45, walk: 0.9, h: 1.3, w: 1.7 },
    chicken: { name: 'Chicken',      value: 50,  weight: 0.6,  walk: 2.2, h: 0.7, w: 0.6 },
    pig:     { name: 'Pig',          value: 80,  weight: 1.25, walk: 1.2, h: 0.9, w: 1.3 },
    sheep:   { name: 'Sheep',        value: 80,  weight: 1.0,  walk: 1.0, h: 1.0, w: 1.3 },
    farmer:  { name: 'Farmer',       value: 150, weight: 1.1,  walk: 1.3, h: 1.8, w: 0.8, flee: 3.6 },
    townie:  { name: 'Townie',       value: 150, weight: 1.0,  walk: 1.4, h: 1.8, w: 0.8, flee: 3.8 },
    golden:  { name: 'Golden Cow',   value: 500, weight: 1.6,  walk: 1.6, h: 1.3, w: 1.7, flee: 4.6 },
    // enemies that were bonked and then beamed up are banked as these
    gunner:  { name: 'Armed Farmer', value: 250, weight: 1.2,  walk: 0,   h: 1.8, w: 0.9 },
    tinfoil: { name: 'Tinfoil Hat',  value: 300, weight: 1.0,  walk: 0,   h: 1.8, w: 0.8 },
    agent:   { name: 'Agent',        value: 400, weight: 1.1,  walk: 0,   h: 1.9, w: 0.8 },
};

// Things that want you gone. ground enemies stand on GROUND; air ones fly.
// beam: 'stun' = beamable only while stunned, 'never' = too heavy, 'backfire' = zaps you unless stunned
export const ENEMIES = {
    gunner:  { name: 'Shotgun Farmer', h: 1.8, w: 0.9, walk: 1.0, beam: 'stun', bank: 'gunner', range: 7, every: 2.6, windup: 0.75 },
    agent:   { name: 'Agent in Black', h: 1.9, w: 0.8, walk: 2.3, beam: 'stun', bank: 'agent', range: 9, every: 3.0, windup: 0.5 },
    tinfoil: { name: 'Tinfoil Hat Dude', h: 1.8, w: 0.8, walk: 1.6, beam: 'backfire', bank: 'tinfoil', range: 3.2, every: 3.4, windup: 0.8 },
    tank:    { name: 'Army Tank',      h: 1.6, w: 2.8, walk: 1.4, beam: 'never', range: 13, every: 3.4, windup: 0.6, armored: true },
    laser:   { name: 'Laser Battery',  h: 1.7, w: 1.8, walk: 0,   beam: 'never', range: 99, every: 4.2, windup: 1.15, armored: true },
    boss:    { name: 'The Buzzkill 9000', h: 4.2, w: 5.6, walk: 2.2, beam: 'never', range: 99, every: 2.4, windup: 0.7, armored: true, hp: 6 },
};

export const SHOTS = {
    pellet: { r: 0.22, speed: 10, ttl: 0.9, dmg: 1 },
    net:    { r: 0.45, speed: 8.5, ttl: 2.2, dmg: 0 },
    shell:  { r: 0.32, speed: 10, ttl: 2.4, dmg: 1 },
};

export const PICKUPS = {
    wrench: { name: 'Spare Part',  blurb: '+1 hull',               weight: 3 },
    tape:   { name: 'Duct Tape',   blurb: 'fixes every defect',    weight: 2 },
    turbo:  { name: 'Turbo',       blurb: 'faster for a while',    weight: 2 },
    mega:   { name: 'Mega Beam',   blurb: 'wide, fast beam',       weight: 2 },
    shield: { name: 'Force Field', blurb: 'nothing can hurt you',  weight: 1.5 },
    clock:  { name: 'Overtime',    blurb: '+15 seconds',           weight: 1.5 },
    star:   { name: 'Gold Star',   blurb: '+500 points',           weight: 1.5 },
};

// Picked between episodes, one of three offered.
export const UPGRADES = {
    hull:     { name: 'Reinforced Hull',  blurb: '+1 hull pip',                 max: 3 },
    hold:     { name: 'Roomier Hold',     blurb: 'carry one more specimen',     max: 4 },
    beam:     { name: 'Wide-Angle Beam',  blurb: 'beam cone 20% wider',         max: 3 },
    speed:    { name: 'Turbo Thrusters',  blurb: 'fly 10% faster',              max: 3 },
    coolant:  { name: 'Coolant Coil',     blurb: 'beam drains 25% slower',      max: 2 },
    warranty: { name: 'Extended Warranty', blurb: '+1 spare saucer (life)',     max: 2 },
    tape:     { name: 'Factory Recall',   blurb: 'glitch half as often',        max: 1 },
};

// The episodes. W is the level width; pop = how many walkers are kept on the ground.
// enemies: [kind, count]; jets: seconds between fly-bys (0 = none).
export const LEVELS = [
    {
        title: 'Moo-ving Day', theme: 'farm', W: 72, time: 75, quota: 5, order: 'cow', pop: 9,
        spec: { cow: 5, chicken: 3, pig: 2 },
        enemies: [['gunner', 1]], jets: 0,
        brief: 'Your first solo flight, sweetie. Five specimens. Cows if you can. Try not to dent anything else.',
    },
    {
        title: 'Pig Out!', theme: 'farm', W: 80, time: 80, quota: 7, order: 'pig', pop: 10,
        spec: { cow: 3, chicken: 3, pig: 4, farmer: 1 },
        enemies: [['gunner', 2], ['tinfoil', 1]], jets: 0,
        brief: 'Seven specimens, and Mother is craving bacon research. A pig, dear. And watch that man in the foil hat.',
    },
    {
        title: 'Night of the Living Barn', theme: 'night', W: 84, time: 85, quota: 8, order: 'farmer', pop: 10,
        spec: { cow: 3, sheep: 3, chicken: 2, farmer: 2 },
        enemies: [['gunner', 2], ['agent', 1], ['tinfoil', 1]], jets: 0,
        brief: 'The suits in sunglasses are here. Our beam bounces off them. Drop something heavy on one, then try.',
    },
    {
        title: 'Corn-fused', theme: 'corn', W: 88, time: 85, quota: 9, order: 'sheep', pop: 11,
        spec: { cow: 3, sheep: 3, pig: 2, chicken: 2, farmer: 2, golden: 0.3 },
        enemies: [['gunner', 2], ['agent', 2], ['tinfoil', 1]], jets: 0,
        brief: 'Nine specimens from the cornfield. Rumour says there\'s a golden cow out there. Rumour is Mother.',
    },
    {
        title: 'Small Town, Big Trouble', theme: 'town', W: 92, time: 90, quota: 10, order: 'townie', pop: 11,
        spec: { townie: 4, cow: 2, chicken: 2, pig: 1, sheep: 1 },
        enemies: [['gunner', 1], ['agent', 2], ['tinfoil', 2], ['tank', 1]], jets: 0,
        brief: 'The army rolled in a tank. You can\'t lift it, but a cow from a great height works wonders.',
    },
    {
        title: 'Army Surplus', theme: 'base', W: 96, time: 95, quota: 10, order: 'golden', pop: 11,
        spec: { cow: 3, townie: 2, sheep: 2, pig: 2, chicken: 2, golden: 0.5 },
        enemies: [['tank', 2], ['laser', 1], ['agent', 1], ['gunner', 1]], jets: 11,
        brief: 'A whole army base. Lasers, jets, the works. Ten specimens. Mother believes in you. Mostly.',
    },
    {
        title: 'Hangar Zero', theme: 'desert', W: 100, time: 100, quota: 12, order: 'agent', pop: 12,
        spec: { cow: 3, townie: 3, sheep: 2, chicken: 2, farmer: 2, golden: 0.5 },
        enemies: [['agent', 3], ['tinfoil', 1], ['tank', 1], ['laser', 2]], jets: 9,
        brief: 'Their secret hangar. Twelve specimens, and Mother would simply LOVE an agent for her collection.',
    },
    {
        title: 'Mother Knows Best', theme: 'finale', W: 64, time: 150, quota: 0, order: null, pop: 9, boss: true,
        spec: { cow: 4, sheep: 2, pig: 2, chicken: 1 },
        enemies: [['boss', 1], ['gunner', 1]], jets: 14,
        brief: 'General Grumbles built a tank the size of a barn. Beam up livestock. Drop it on him. Six times. Go!',
    },
];

// What the Mother Ship says. Picked with the game's own RNG, so a seed replays the same lines.
export const LINES = {
    grade: {
        'A+': ['Flawless! Mother is putting this on the fridge.', 'A plus! Who\'s a good little saucer? You are!', 'Perfection. I may cry into my antennae.'],
        A: ['Excellent work, sweetie. Hardly a scratch.', 'A! Mother is proud. Don\'t let it go to your dome.'],
        B: ['Good. Not great. Good.', 'A solid B. Your cousin got an A, but who\'s counting. Mother is.'],
        C: ['Average. Like your father.', 'C. As in "Could have tried harder."'],
        D: ['D. Did you even look at the brief?', 'Mother is not angry. Mother is disappointed.'],
        F: ['F! Back down there and do it again, young saucer!', 'Zero stars. Not even a moon. Try again.'],
    },
    quota: ['Quota met! Dock with Mother, or grab a few extras.', 'That\'s the quota! Hover under me to dock.'],
    hurry: ['Fifteen seconds, dear! Chop chop!', 'Clock\'s ticking, dented dinner plate!'],
    crash: ['Oh, not AGAIN. Sending a spare.', 'That\'s coming out of your allowance.', 'Warranty claim filed. Sigh.'],
    full: ['Hold\'s full! Bring them up to Mother.', 'No more room, sweetie. Come unload.'],
    bank: ['Lovely specimens!', 'Into the freezer they go. Kidding! Mostly.', 'Ooh, that one\'s plump.'],
    boss: ['Down he goes! Now come home for supper.'],
    glitch: { sputter: 'Engine sputter!', hiccup: 'Hic!', honk: 'HONK!' },
};

export const THEMES = ['farm', 'night', 'corn', 'town', 'base', 'desert', 'finale'];
