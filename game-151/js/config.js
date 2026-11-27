// One Shot — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.1';
export const SAVE_KEY = 'one-shot.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ------------------------------------------------------------------ the resonance board
export const BOARD = { cols: 7, rows: 7 };
/** Tile kinds. The first five charge the beam; shield charges the deflector; static is jammer junk. */
export const KINDS = ['power', 'speed', 'thermal', 'cryo', 'volt', 'shield'];
export const STATIC = 6;
export const ELEMENTS = ['thermal', 'cryo', 'volt'];
/** Special tiles a big match leaves behind. */
export const SP = { none: 0, lineH: 1, lineV: 2, cross: 3, nova: 4 };

export const TIMING = {
    swap: 0.12,        // a swap slides into place
    clear: 0.15,       // matched tiles burst
    fall: 0.17,        // the column falls and refills
    rushWindow: 1.7,   // match again within this long after the board settles to keep the rush going
};

export const CHARGE = {
    tile: 10,          // charge per beam tile cleared
    shieldTile: 5,     // deflector per shield tile
    shieldCap: 60,
    comboStep: 0.25,   // each cascade step adds this to the multiplier
    rushStep: 0.08,    // each rush link adds this
    rushMax: 2.0,
};

// ------------------------------------------------------------------ the ship and the drones
export const SHIP = { hull: 100 };
export const ROUND = {
    gap: 1.2,          // seconds between escorts launching while the wave has more to send
    routeBase: 40,     // charge MIRA routes into the stat you pick when a round is cleared
    routePerSec: 10,   // plus this per second left on the round clock
    lance: 12,         // the final charge window once the mothership is exposed
};
export const DRONE = {
    approach: 2.8,     // seconds from launch to firing range
    aim: 1.1,          // the telegraph before a shot
    refire: 3.2,       // seconds between shots once in range
    leak: 1.5,         // charge lost from the biggest stat per point of hull damage
};
export const MISSILE = { flight: 0.45, dmg: 1 };
export const DESPERATE = 0.75;             // a ship going down fires at this fraction of its charge

// ------------------------------------------------------------------ the shot
export const BEAM = { stages: [1.6, 2.9, 4.2], verdict: 5.4, end: 7.4 };
export const GRADES = [
    { g: 'S', min: 2.0, mult: 2.2 },
    { g: 'A', min: 1.6, mult: 1.7 },
    { g: 'B', min: 1.3, mult: 1.35 },
    { g: 'C', min: 1.0, mult: 1.0 },
];
export const GRADE_ORDER = ['F', 'C', 'B', 'A', 'S'];
export const REWARD = { perSecond: 2, perDrone: 4, flawless: 1.2, consolation: 0.35, replay: 0.5 };

// ------------------------------------------------------------------ the hangar
export const UPGRADES = [
    { id: 'capacitor', name: 'Lance Capacitor', stat: 'power', desc: '+15% Power per tile', per: 0.15 },
    { id: 'coils', name: 'Velocity Coils', stat: 'speed', desc: '+15% Speed per tile', per: 0.15 },
    { id: 'thermal', name: 'Thermal Lens', stat: 'thermal', desc: '+15% Thermal per tile', per: 0.15 },
    { id: 'cryo', name: 'Cryo Lens', stat: 'cryo', desc: '+15% Cryo per tile', per: 0.15 },
    { id: 'volt', name: 'Volt Lens', stat: 'volt', desc: '+15% Volt per tile', per: 0.15 },
    { id: 'deflector', name: 'Deflector', stat: 'shield', desc: '+25% shield per tile, +15 capacity', per: 0.25 },
    { id: 'reactor', name: 'Reactor Core', stat: 'time', desc: '+3 s every round and the final window', per: 3 },
    { id: 'missiles', name: 'Point Defense', stat: 'missiles', desc: '+50% missile damage', per: 0.5 },
];
export const UPGRADE_MAX = 5;
export const UPGRADE_COST = [40, 75, 120, 180, 260];
