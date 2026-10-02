// ============================================================
// Nightline — configuration
// ============================================================
// All tunables live here. Distances are metres, speeds m/s unless named _KMH.

// --- Road cross-section (u = lateral offset, + is the driver's right) ---
export const LANE_W = 3.6;
export const ROAD_HALF = LANE_W * 2;          // 4 lanes, two each way
export const LANES = [LANE_W * 0.5, LANE_W * 1.5];   // our side: 0 = fast lane, 1 = curb lane
export const ONCOMING = [-LANE_W * 0.5, -LANE_W * 1.5];
export const CURB_H = 0.16;
export const WALK_OUT = 12;                   // sidewalk outer edge
export const FRONT_ROW = 13;                  // first building facade
export const BAY_U = 9.8;                     // where a parked car sits at a stop

// --- Road shape ---
export const SAMPLE = 2;                      // spacing of road samples
export const CHUNK = 96;                      // chunk length (multiple of the 12 m dash and 32 m lamp spacing)
export const LAMP_SPACING = 32;
export const AHEAD = 672;                     // build chunks this far ahead
export const BEHIND = 160;                    // ...and keep them this far behind
export const ROAD_LOOKAHEAD = 2200;           // road samples exist this far ahead (for clearance checks)
export const SKYWAY_H = 19;                   // elevated road height
export const RAMP = 260;                      // length of the climb onto / off the skyway

// --- Driving ---
export const MAX_KMH = 140;
export const START_KMH = 60;
export const ACCEL = 3.2;
export const DECEL = 5.5;
export const BRAKE = 11;
export const LANE_CHANGE_SPEED = 1.7;         // lateral m/s

// --- Stops ---
export const STOP_GAP_MIN = 820;
export const STOP_GAP_MAX = 1500;
export const STOP_PROMPT_RANGE = 420;         // a stop is offered from this far out
export const STOP_LEN = 34;                   // the pull-in bay

// --- Rendering ---
export const FOV = 62;
export const FOG_DENSITY = 0.0034;
export const RES_PRESETS = {                  // vertical render resolution
    lofi: 240,
    mid: 360,
    hi: 540,
    crisp: 1080,
};

// --- Districts ---
// Each district type has its own palette and its own idea of a building.
export const DISTRICTS = {
    downtown: {
        names: ['Lumen Ward', 'Old Downtown', 'Meridian Core', 'Central Arcology'],
        fog: [0.20, 0.10, 0.24], sky: [0.05, 0.02, 0.09], lamp: [1.0, 0.55, 0.85],
        neon: ['#ff2fa8', '#2ff3ff', '#ffb02f', '#8a5bff', '#ff4b4b', '#4bff9b'],
        tint: [[1.0, 0.85, 0.95], [0.85, 0.95, 1.0], [1.0, 0.9, 0.8]],
        height: [40, 190], width: [16, 30], depth: [18, 32], storefront: 0.8, signs: 0.9,
        crossEvery: 192, stops: ['diner', 'konbini', 'arcade', 'charge', 'laundry'],
    },
    market: {
        names: ['Hoshino Night Market', 'Lantern Street', 'Little Kowloon', 'Paper Moon Alley'],
        fog: [0.26, 0.11, 0.08], sky: [0.07, 0.02, 0.03], lamp: [1.0, 0.6, 0.3],
        neon: ['#ff3b3b', '#ffcf3b', '#ff6ad5', '#3bffd1', '#ff8c2f'],
        tint: [[1.0, 0.8, 0.65], [1.0, 0.9, 0.75]],
        height: [9, 26], width: [7, 13], depth: [10, 16], storefront: 1.0, signs: 1.6,
        crossEvery: 0, stops: ['noodle', 'records', 'arcade', 'konbini'],
    },
    skyway: {
        names: ['Skyway 9', 'The Overpass', 'Route 77 Elevated', 'Halo Interchange'],
        fog: [0.09, 0.12, 0.25], sky: [0.02, 0.03, 0.09], lamp: [0.55, 0.85, 1.0],
        neon: ['#2fd5ff', '#ff2f8e', '#b6ff2f', '#ffffff'],
        tint: [[0.8, 0.9, 1.0], [0.9, 0.85, 1.0]],
        height: [50, 230], width: [18, 34], depth: [18, 34], storefront: 0, signs: 0.5,
        crossEvery: 0, stops: ['overlook', 'charge'],
    },
    harbor: {
        names: ['Harbor Row', 'Pier District', 'Saltwater Docks', 'Breakwater'],
        fog: [0.07, 0.15, 0.17], sky: [0.01, 0.04, 0.06], lamp: [1.0, 0.7, 0.35],
        neon: ['#2fffc8', '#ff5a2f', '#ffe14b', '#4b8bff'],
        tint: [[0.8, 1.0, 0.95], [1.0, 0.85, 0.7]],
        height: [8, 18], width: [24, 46], depth: [20, 30], storefront: 0.25, signs: 0.45,
        crossEvery: 0, stops: ['pier', 'noodle', 'diner', 'motel'],
    },
    heights: {
        names: ['Cinder Heights', 'Block 41', 'The Stacks', 'Glasshouse Hill'],
        fog: [0.16, 0.08, 0.20], sky: [0.04, 0.02, 0.07], lamp: [1.0, 0.75, 0.5],
        neon: ['#c45bff', '#ff4f9a', '#4fd8ff', '#ffd24f'],
        tint: [[1.0, 0.9, 0.8], [0.9, 0.9, 1.0]],
        height: [30, 95], width: [14, 24], depth: [14, 22], storefront: 0.6, signs: 0.7,
        crossEvery: 256, stops: ['motel', 'laundry', 'konbini', 'records', 'noodle'],
    },
};

export const DISTRICT_ORDER = ['downtown', 'market', 'skyway', 'harbor', 'heights'];

// --- Settings persistence ---
export const SETTINGS_KEY = 'nightline-settings';
export const LOG_KEY = 'nightline-log';
