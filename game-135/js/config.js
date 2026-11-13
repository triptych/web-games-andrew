// HARD HAT HARBOR — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hard-hat-harbor.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const WORLD = { w: 128, h: 96 };   // metres; x east, y south
export const RADIUS = 1.7;                // every vehicle's collision circle (so a swap never lands in a wall)

/** The toy box. vmax m/s, acc m/s², turn rad/s. `pivot` vehicles (tracks) turn on the spot at full rate. */
export const VEHICLES = [
    { id: 'dump', name: 'Dump Truck', vmax: 13, acc: 11, turn: 1.9, pivot: false, len: 4.6, color: 0xf2b417 },
    { id: 'dozer', name: 'Bulldozer', vmax: 7.5, acc: 9, turn: 1.7, pivot: true, len: 4.0, color: 0xf2b417 },
    { id: 'digger', name: 'Excavator', vmax: 6.5, acc: 8, turn: 1.6, pivot: true, len: 4.4, color: 0xf2b417 },
    { id: 'roller', name: 'Road Roller', vmax: 7, acc: 8, turn: 1.6, pivot: false, len: 3.8, color: 0xf07a1a },
    { id: 'crane', name: 'Crane Truck', vmax: 9.5, acc: 9, turn: 1.7, pivot: false, len: 5.0, color: 0xd9382b },
    { id: 'wrecker', name: 'Wrecking Crane', vmax: 7.5, acc: 8, turn: 1.6, pivot: true, len: 4.4, color: 0x3e9b4f },
    { id: 'loader', name: 'Loader Tractor', vmax: 10.5, acc: 10, turn: 1.9, pivot: false, len: 4.0, color: 0x2f7fd6 },
    { id: 'mixer', name: 'Cement Mixer', vmax: 11, acc: 10, turn: 1.8, pivot: false, len: 4.8, color: 0xf4f1e8 },
];
export const VEH = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export const DRIVE = {
    reverse: 0.5,          // share of vmax in reverse
    spotTurn: 0.4,         // share of the turn rate a wheeled vehicle keeps at a standstill
    turnSpeed: 3,          // m/s at which a wheeled vehicle turns at its full rate
    bump: 0.4,             // speed kept after hitting something
    switchCd: 0.35,        // seconds between vehicle swaps
    honkCd: 0.35,
};

export const WORK = {
    loadTime: 1.2,         // s parked in the load zone to fill the dump truck
    loadSpeed: 1.5,        // "parked" means slower than this
    digTime: 2.6,          // s of holding to dig one spot
    pourTime: 3.0,         // s of holding to pour one spot
    workReach: 3.6,        // how close a digger or mixer must be to its spot
    rollReach: 1.9,        // a cell is flat once the roller's centre is this close
    rollCell: 2,           // asphalt cell size
    hookSpeed: 1.6,        // rad/s of the crane hook's swing, plus hookRamp per piece placed
    hookRamp: 0.22,
    hookWindow: 0.3,       // |sin| below this places the piece
    missCd: 0.5,
    placeCd: 1.3,          // s to rig the next piece after one is placed
    swingTime: 0.8,        // s from the press to the ball's impact
    wreckReach: 5.5,       // wrecker's distance to the building's wall
    bucket: 3,             // rubble a loader carries
    bladeHalf: 2.0,        // half width of the dozer blade / loader bucket
    debrisR: { boulder: 1.0, chunk: 1.2, rubble: 0.7, rock: 0.7 },
    wallMargin: 1.0,       // debris drifts this far clear of walls, so nothing can be wedged into a corner
    wallDrift: 2.0,        // m/s of that drift
};

/** Stars for a job: 3 at or under par, 2 under par × this, else 1. */
export const STAR2 = 1.6;
