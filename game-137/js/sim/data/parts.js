// Mech parts. Bought and upgraded in the hangar with credits, equipped in five slots.
// Every weapon number is for level 1; each level above multiplies the `up` stat by LEVEL_MUL.

export const SLOTS = ['armL', 'armR', 'shoulder', 'core', 'legs'];
export const SLOT_NAME = { armL: 'Left arm', armR: 'Right arm', shoulder: 'Shoulder', core: 'Core', legs: 'Legs' };
export const SLOT_KIND = { armL: 'arm', armR: 'arm', shoulder: 'shoulder', core: 'core', legs: 'legs' };
export const LEVEL_MUL = [1, 1.35, 1.75];

export const PARTS = {
    // ---------------------------------------------------------------- arms
    vulcan: {
        kind: 'arm', name: 'Vulcan Arm', icon: '🔫', cost: [0, 140, 320],
        desc: 'A rotary gun that never stops. Short range, fast, chips terrain a little.',
        weapon: { type: 'bullet', rate: 7, dmg: 7, range: 9.5, speed: 30, spread: 0.08, terrain: 1, count: 1 },
        up: 'dmg',
    },
    scatter: {
        kind: 'arm', name: 'Scatter Cannon', icon: '💥', cost: [180, 200, 380],
        desc: 'Five pellets in a cone. Brutal up close; clears swarms.',
        weapon: { type: 'bullet', rate: 1.5, dmg: 9, range: 6.5, speed: 24, spread: 0.55, terrain: 2, count: 5 },
        up: 'dmg',
    },
    laser: {
        kind: 'arm', name: 'Lance Laser', icon: '⚡', cost: [260, 260, 460],
        desc: 'A beam that pierces every monster in a line and cuts through rock.',
        weapon: { type: 'beam', rate: 0.95, dmg: 34, range: 13, width: 0.55, terrain: 5 },
        up: 'dmg',
    },
    // ---------------------------------------------------------------- shoulder
    rockets: {
        kind: 'shoulder', name: 'Swarm Rockets', icon: '🚀', cost: [0, 160, 340],
        desc: 'Homing rockets that blow holes in monsters, walls and hives.',
        weapon: { type: 'rocket', rate: 0.6, dmg: 24, radius: 2.0, range: 14, speed: 13, turn: 5, terrain: 7, count: 2 },
        up: 'count',
    },
    mortar: {
        kind: 'shoulder', name: 'Plasma Mortar', icon: '☄️', cost: [240, 240, 420],
        desc: 'Lobs a plasma shell over walls into the thickest crowd. Huge blast.',
        weapon: { type: 'mortar', rate: 0.42, dmg: 48, radius: 3.0, range: 15, flight: 0.9, terrain: 9, count: 1 },
        up: 'dmg',
    },
    drone: {
        kind: 'shoulder', name: 'Saw Drones', icon: '🌀', cost: [220, 220, 400],
        desc: 'Spinning saws orbit the mech and shred anything that comes close.',
        weapon: { type: 'orbit', rate: 6, dmg: 9, radius: 2.3, count: 2, spin: 3.2, terrain: 0 },
        up: 'count',
    },
    // ---------------------------------------------------------------- core
    plating: {
        kind: 'core', name: 'Heavy Plating', icon: '🛡️', cost: [0, 120, 260],
        desc: 'More armour. More hit points.',
        stats: { hp: 40 }, up: 'hp',
    },
    barrier: {
        kind: 'core', name: 'Barrier Core', icon: '🔷', cost: [200, 200, 380],
        desc: 'A shield that soaks hits and recharges when you stop getting hit. Blue voxels top it up.',
        stats: { shield: 45, regen: 9 }, up: 'shield',
    },
    reactor: {
        kind: 'core', name: 'Overclock Reactor', icon: '🔥', cost: [220, 220, 400],
        desc: 'Every weapon fires faster, and Overdrive charges sooner.',
        stats: { rate: 0.2, od: 0.3 }, up: 'rate',
    },
    // ---------------------------------------------------------------- legs
    strider: {
        kind: 'legs', name: 'Strider Legs', icon: '🦿', cost: [0, 100, 220],
        desc: 'Balanced walking legs.',
        stats: { speed: 6.0, hp: 0 }, up: 'speed',
    },
    sprinter: {
        kind: 'legs', name: 'Sprinter Legs', icon: '💨', cost: [160, 160, 320],
        desc: 'Fast and light; a little less armour.',
        stats: { speed: 7.4, hp: -15 }, up: 'speed',
    },
    stomper: {
        kind: 'legs', name: 'Stomper Legs', icon: '🦶', cost: [200, 200, 380],
        desc: 'Slow, heavy legs. Every few steps a shockwave knocks back and crushes monsters and rubble.',
        stats: { speed: 5.3, hp: 25 }, up: 'dmg',
        weapon: { type: 'stomp', rate: 0.4, dmg: 26, radius: 2.8, terrain: 3 },
    },
};

export const STARTER = {
    parts: { vulcan: 1, rockets: 1, plating: 1, strider: 1 },
    loadout: { armL: 'vulcan', armR: null, shoulder: 'rockets', core: 'plating', legs: 'strider' },
};

export const partIds = (kind) => Object.keys(PARTS).filter((id) => PARTS[id].kind === kind);
