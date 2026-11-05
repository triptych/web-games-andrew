// Gameplay tables. Pure data: no behaviour. Colours and models live in the view.

export const TRACKS = ['guns', 'missiles', 'armor', 'fuel', 'legs'];
export const MAX_TIER = 5;

export const TRACK_INFO = {
    guns:     { name: 'Main Guns',   icon: '🔫', blurb: 'Bigger guns, faster, harder.' },
    missiles: { name: 'Missile Rack', icon: '🚀', blurb: 'Homing rockets: more of them, faster refills, bigger salvos, then cluster warheads.' },
    armor:    { name: 'Hull Armor',  icon: '🛡️', blurb: 'More armor plates, more hit points, less damage taken.' },
    fuel:     { name: 'Fuel Tanks',  icon: '⛽', blurb: 'Longer boost and jump-jet burns, faster refuel.' },
    legs:     { name: 'Leg Actuators', icon: '🦿', blurb: 'Faster, climb steeper slopes, step over bigger rubble, harder landings.' },
};
// scrap cost of the upgrade that takes a track from tier t to t+1
export const COSTS = {
    guns:     [105, 195, 315, 480, 705],
    missiles: [80, 160, 260, 405, 600],
    armor:    [90, 170, 285, 435, 645],
    fuel:     [70, 135, 225, 350, 525],
    legs:     [80, 165, 270, 420, 615],
};

export const WEAPONS = [
    { name: 'Pulse Gun',        dmg: 6,    rate: 6.0, speed: 70,  spread: 0.025, barrels: 1, pierce: 0, splash: 0,   col: 0x66ddff, life: 1.1, r: 0.3 },
    { name: 'Twin Autocannon',  dmg: 8.5,  rate: 8.0, speed: 80,  spread: 0.035, barrels: 2, pierce: 0, splash: 0,   col: 0xffcc55, life: 1.1, r: 0.3 },
    { name: 'Plasma Repeater',  dmg: 15,   rate: 7.0, speed: 62,  spread: 0.03,  barrels: 2, pierce: 0, splash: 1.7, col: 0x66ff99, life: 1.3, r: 0.4 },
    { name: 'Ion Lance',        dmg: 24,   rate: 6.5, speed: 100, spread: 0.02,  barrels: 2, pierce: 2, splash: 0,   col: 0xff66ee, life: 1.0, r: 0.4 },
    { name: 'Rail Cannon',      dmg: 58,   rate: 3.2, speed: 170, spread: 0.008, barrels: 2, pierce: 6, splash: 0,   col: 0xbfe8ff, life: 0.8, r: 0.5 },
    { name: 'Hellfire Battery', dmg: 30,   rate: 8.0, speed: 75,  spread: 0.04,  barrels: 4, pierce: 0, splash: 3.3, col: 0xff7733, life: 1.2, r: 0.5 },
];
export const MISSILES = [
    { name: 'Homing Pod',       ammo: 3,  reload: 5.0, dmg: 55, splash: 4.2, salvo: 1, homing: 1, cluster: 0 },
    { name: 'Twin Homing Pods', ammo: 4,  reload: 4.5, dmg: 60, splash: 4.4, salvo: 2, homing: 1, cluster: 0 },
    { name: 'Seeker Rockets',   ammo: 6,  reload: 4.0, dmg: 65, splash: 4.6, salvo: 2, homing: 1, cluster: 0 },
    { name: 'Cluster Seekers',  ammo: 6,  reload: 3.5, dmg: 70, splash: 4.8, salvo: 2, homing: 1, cluster: 4 },
    { name: 'Hornet Rack',      ammo: 8,  reload: 3.0, dmg: 80, splash: 5.0, salvo: 4, homing: 1, cluster: 0 },
    { name: 'Swarm Launcher',   ammo: 12, reload: 2.4, dmg: 90, splash: 5.4, salvo: 6, homing: 1, cluster: 3 },
];
export const ARMOR = [
    { hp: 150, dr: 0 }, { hp: 200, dr: 0.05 }, { hp: 255, dr: 0.10 }, { hp: 315, dr: 0.15 }, { hp: 380, dr: 0.20 }, { hp: 460, dr: 0.26 },
];
export const FUEL = [
    { cap: 100, regen: 14 }, { cap: 140, regen: 18 }, { cap: 185, regen: 22 }, { cap: 235, regen: 27 }, { cap: 290, regen: 32 }, { cap: 350, regen: 38 },
];
export const LEGS = [
    { speed: 7.0, climb: 0.85, clear: 0.9, stomp: 25 }, { speed: 7.6, climb: 1.0, clear: 1.2, stomp: 40 }, { speed: 8.2, climb: 1.15, clear: 1.5, stomp: 60 },
    { speed: 8.8, climb: 1.3, clear: 1.8, stomp: 85 }, { speed: 9.4, climb: 1.5, clear: 2.1, stomp: 115 }, { speed: 10.0, climb: 1.7, clear: 2.4, stomp: 150 },
];

// Enemy table. hp is for level 1 and scales with the level's hpScale. cost is the camp-budget price.
export const ENEMIES = {
    trooper:   { name: 'Skarn Trooper',  hp: 26,  spd: 6.2, r: 0.5,  h: 1.8, aggro: 48, cost: 3,  scrap: 4,  fly: 0, inf: true,  armor: 1 },
    rocketeer: { name: 'Rocketeer',      hp: 38,  spd: 3.8, r: 0.55, h: 1.9, aggro: 52, cost: 5,  scrap: 7,  fly: 0, inf: true,  armor: 1 },
    wasp:      { name: 'Wasp Drone',     hp: 30,  spd: 11,  r: 0.7,  h: 1.2, aggro: 60, cost: 4,  scrap: 6,  fly: 6, inf: false, armor: 1 },
    stalker:   { name: 'Stalker Walker', hp: 170, spd: 5.2, r: 1.3,  h: 4.2, aggro: 58, cost: 12, scrap: 22, fly: 0, inf: false, armor: 0.9 },
    bulwark:   { name: 'Bulwark Tank',   hp: 440, spd: 2.6, r: 2.1,  h: 3.4, aggro: 62, cost: 28, scrap: 55, fly: 0, inf: false, armor: 0.7 },
    turret:    { name: 'Gun Emplacement', hp: 130, spd: 0,  r: 1.1,  h: 2.2, aggro: 56, cost: 8,  scrap: 14, fly: 0, inf: false, armor: 0.85 },
    pylon:     { name: 'Shield Pylon',   hp: 240, spd: 0,   r: 1.5,  h: 6.0, aggro: 0,  cost: 0,  scrap: 0,  fly: 0, inf: false, armor: 1 },
};

export const LEVELS = [
    { id: 'ruin', name: "Haven's Ruin", sub: 'Scorched Plains', biome: 'scorched', length: 330, hw: 34, amp: 3.2, craters: 16, rocks: 40, wrecks: 14, spires: 6,
      hazard: 'fire', hazN: 5, camps: 5, budget: [20, 48], mix: { trooper: 5, rocketeer: 2, turret: 1.5, stalker: 0.35 }, ambush: 1, pods: 2, boss: 'gatekeeper', hpScale: 1.0, dmgScale: 1.0 },
    { id: 'fen', name: 'Sporefen', sub: 'Toxic Marsh', biome: 'marsh', length: 350, hw: 36, amp: 2.6, craters: 6, rocks: 30, wrecks: 6, spires: 34,
      hazard: 'acid', hazN: 11, camps: 6, budget: [28, 60], mix: { trooper: 4, wasp: 3, rocketeer: 2, stalker: 1.2 }, ambush: 2, pods: 2, boss: null, hpScale: 1.2, dmgScale: 1.08 },
    { id: 'rift', name: 'Redrock Canyon', sub: 'Badlands', biome: 'canyon', length: 370, hw: 30, amp: 9, craters: 6, rocks: 46, wrecks: 8, spires: 22, terrace: 2.8,
      hazard: 'sand', hazN: 8, camps: 6, budget: [34, 74], mix: { trooper: 3, stalker: 2, bulwark: 0.8, turret: 2, wasp: 1.5 }, ambush: 2, pods: 3, boss: 'strider', hpScale: 1.4, dmgScale: 1.18 },
    { id: 'ice', name: 'Whitelight Glacier', sub: 'Frozen Wastes', biome: 'ice', length: 370, hw: 34, amp: 5.5, craters: 8, rocks: 36, wrecks: 6, spires: 30,
      hazard: 'ice', hazN: 9, camps: 6, budget: [42, 88], mix: { trooper: 3, wasp: 3, stalker: 2, rocketeer: 2, bulwark: 1 }, ambush: 2, pods: 3, boss: 'leviathan', hpScale: 1.65, dmgScale: 1.3 },
    { id: 'cinder', name: 'Cinder Basin', sub: 'Volcanic Forge-Fields', biome: 'volcanic', length: 380, hw: 34, amp: 6.5, craters: 10, rocks: 44, wrecks: 10, spires: 18,
      hazard: 'lava', hazN: 9, camps: 7, budget: [50, 102], mix: { stalker: 3, bulwark: 1.6, turret: 2, wasp: 2, trooper: 2 }, ambush: 2, pods: 3, boss: 'titan', hpScale: 1.9, dmgScale: 1.42 },
    { id: 'hive', name: 'The Hive', sub: 'Skarn Main Camp', biome: 'hive', length: 400, hw: 36, amp: 5, craters: 8, rocks: 30, wrecks: 8, spires: 44,
      hazard: 'goo', hazN: 10, camps: 7, budget: [58, 120], mix: { trooper: 3, rocketeer: 2, wasp: 2.5, stalker: 3, bulwark: 2, turret: 2 }, ambush: 3, pods: 4, boss: 'warlord', hpScale: 2.2, dmgScale: 1.55 },
];

export const HAZARDS = {
    fire:  { dps: 7,  slow: 1,   ice: 0, label: 'Burning wreckage' },
    acid:  { dps: 9,  slow: 0.7, ice: 0, label: 'Acid pool' },
    sand:  { dps: 0,  slow: 0.5, ice: 0, label: 'Quicksand' },
    ice:   { dps: 0,  slow: 1,   ice: 1, label: 'Black ice' },
    lava:  { dps: 22, slow: 1,   ice: 0, label: 'Lava' },
    goo:   { dps: 8,  slow: 0.6, ice: 0, label: 'Hive goo' },
};

/**
 * Bosses. A phase is active while hp/maxHp <= at (the last one that matches wins). Entering a phase
 * makes the boss invulnerable for a moment (a set-piece), cancels its attack, and applies `enter`:
 *   say: radio line id, summon: unit types dropped in, pylons: n shield pylons (boss immune until all die),
 *   vuln: damage multiplier while the phase lasts (an exposed core), lava: n lava pools raised in the arena.
 * atk: [attack, weight]. Attack implementations are in boss.js.
 */
export const BOSSES = {
    gatekeeper: {
        name: 'GATEKEEPER', title: 'Skarn Siege Tank', hp: 1000, r: 3.4, spd: 3.0, scrap: 160, model: 'tank',
        phases: [
            { at: 1.0,  spd: 3.0, cd: [2.0, 3.0], atk: [['burst', 3], ['shells', 3], ['fan', 2]] },
            { at: 0.5,  spd: 4.2, cd: [1.4, 2.2], atk: [['burst', 2], ['shells', 3], ['charge', 3], ['fan', 2]], enter: { say: 'gk2', summon: ['trooper', 'trooper', 'trooper', 'rocketeer'] } },
        ],
    },
    strider: {
        name: 'SIEGE STRIDER', title: 'Skarn Artillery Walker', hp: 1800, r: 3.6, spd: 2.8, scrap: 240, model: 'strider',
        phases: [
            { at: 1.0,  spd: 2.6, cd: [2.2, 3.2], atk: [['shells', 4], ['burst', 2], ['stomp', 2]] },
            { at: 0.66, spd: 3.2, cd: [1.8, 2.6], atk: [['shells', 3], ['burst', 3], ['stomp', 2], ['summon', 2]], enter: { say: 'st2', summon: ['trooper', 'trooper', 'wasp', 'wasp'] } },
            { at: 0.33, spd: 4.6, cd: [1.2, 2.0], atk: [['beam', 3], ['stomp', 3], ['shells', 2], ['charge', 2]], vuln: 1.8, enter: { say: 'st3' } },
        ],
    },
    leviathan: {
        name: 'GLACIER LEVIATHAN', title: 'Skarn Burrowing Wyrm', hp: 2300, r: 3.0, spd: 5.0, scrap: 300, model: 'worm',
        phases: [
            { at: 1.0,  spd: 5.0, cd: [1.8, 2.6], atk: [['burrow', 3], ['shards', 3], ['spit', 2]] },
            { at: 0.62, spd: 5.8, cd: [1.4, 2.2], atk: [['burrow', 2], ['shards', 2], ['blizzard', 3], ['summon', 2]], enter: { say: 'lv2', summon: ['wasp', 'wasp', 'wasp'] } },
            { at: 0.3,  spd: 7.0, cd: [1.0, 1.7], atk: [['burrow', 4], ['shards', 3], ['blizzard', 2]], chain: 3, vuln: 1.5, enter: { say: 'lv3' } },
        ],
    },
    titan: {
        name: 'CINDER TITAN', title: 'Skarn Forge-Colossus', hp: 3000, r: 4.2, spd: 3.4, scrap: 380, model: 'colossus',
        phases: [
            { at: 1.0,  spd: 3.2, cd: [2.0, 3.0], atk: [['flamering', 3], ['fireballs', 3], ['burst', 2]] },
            { at: 0.66, spd: 3.6, cd: [1.8, 2.6], atk: [['fireballs', 3], ['stomp', 2], ['flamering', 2], ['summon', 2]], enter: { say: 'ti2', pylons: 2, summon: ['stalker'] } },
            { at: 0.33, spd: 5.0, cd: [1.1, 1.9], atk: [['beam', 3], ['stomp', 3], ['fireballs', 3], ['flamering', 2]], vuln: 1.6, enter: { say: 'ti3', lava: 5 } },
        ],
    },
    warlord: {
        name: 'THE WARLORD', title: 'Zhar-Kul, Skarn Hive-Lord', hp: 4600, r: 4.0, spd: 4.2, scrap: 600, model: 'warlord',
        phases: [
            { at: 1.0,  spd: 4.0, cd: [1.6, 2.4], atk: [['fan', 3], ['lance', 3], ['burst', 2]] },
            { at: 0.75, spd: 3.6, cd: [1.6, 2.4], atk: [['fan', 2], ['missiles', 3], ['summon', 3], ['stomp', 2]], enter: { say: 'wl2', pylons: 3, summon: ['stalker', 'wasp', 'wasp'] } },
            { at: 0.5,  spd: 4.8, cd: [1.2, 2.0], atk: [['beam', 3], ['missiles', 3], ['lance', 2], ['stomp', 2]], enter: { say: 'wl3', summon: ['wasp', 'wasp', 'wasp', 'wasp'] } },
            { at: 0.25, spd: 6.0, cd: [0.9, 1.5], atk: [['orbital', 3], ['lance', 3], ['missiles', 2], ['beam', 2], ['stomp', 2]], vuln: 1.6, enter: { say: 'wl4', lava: 4 } },
        ],
    },
};
