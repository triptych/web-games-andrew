// Wrack & Wonder — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'wrack-and-wonder.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ------------------------------------------------------------------ time
export const DAY = 480;                   // game seconds in a whole day
// A day's phases as fractions of DAY. Every essence waxes in one of them.
export const PHASES = [
    { id: 'dawn', name: 'Dawn', from: 0.00, to: 0.12 },
    { id: 'day', name: 'Day', from: 0.12, to: 0.50 },
    { id: 'dusk', name: 'Dusk', from: 0.50, to: 0.62 },
    { id: 'night', name: 'Night', from: 0.62, to: 1.00 },
];
export const START_TOD = 0.47;            // you wash up late in the afternoon

// ------------------------------------------------------------------ the castaway
export const PLAYER = {
    eye: 1.62,
    radius: 0.32,
    walk: 4.4,
    sprint: 7.0,
    jump: 5.6,
    gravity: 17,
    stepUp: 0.55,          // a rise you can always step onto
    maxSlope: 1.25,        // rise per metre you can walk up (about 51 degrees)
    wade: 0.85,            // the deepest water you can walk through
    reach: 3.0,            // how far "use" reaches
    pitchMax: 1.45,
};

export const SURVIVAL = {
    vigorDrain: 100 / 1100,     // per second: a full belly lasts most of two days
    warmDayOut: 0.06,           // per second, outdoors by day (to WARM_CAP)
    warmCap: 72,
    coldNight: 0.20,            // per second, outdoors at night
    coldWater: 1.2,             // per second while wading
    coldWind: 0.12,             // per second on the Highmoor by day
    fireWarm: 3.5,              // per second, near a lit fire
    hutWarm: 0.8,               // per second indoors
    starve: 0.45,               // health per second at 0 vigor or 0 warmth
    regen: 0.12,                // health per second when fed and warm
    fireRadius: 4.2,
};

// ------------------------------------------------------------------ magic
export const MAGIC = {
    boltRange: 34,
    boltSpeed: 30,              // for the view only; the sim resolves a bolt at once
    wardBase: 30,               // seconds, + wardPer × power
    wardPer: 15,
    sealTime: 90,
    updraftTime: 24,
    updraftLift: 15,            // metres above the ground an updraft carries you
    updraftRadius: 1.8,
    fireSealRadius: 4.2,
    stillRadius: 5.5,
    beaconRadius: 10,
    iceRadius: 3.6,
    charges: 5,                 // most casts one wand slot can hold
    slots: 3,
};

export const ESSENCES = ['kindle', 'rime', 'lumen', 'bloom', 'gale', 'still'];
export const FORMS = ['bolt', 'ward', 'seal'];

// What each essence is called in plain words (Elowen's words, and the notebook's).
export const ESSENCE_INFO = {
    kindle: { name: 'Kindle', word: 'the warm word', does: 'heat and flame' },
    rime: { name: 'Rime', word: 'the cold word', does: 'frost and ice' },
    lumen: { name: 'Lumen', word: 'the bright word', does: 'light that reveals' },
    bloom: { name: 'Bloom', word: 'the green word', does: 'growth and healing' },
    gale: { name: 'Gale', word: 'the wind word', does: 'wind and lift' },
    still: { name: 'Still', word: 'the quiet word', does: 'stillness and binding' },
};
export const FORM_INFO = {
    bolt: { name: 'Bolt', does: 'thrown where you aim' },
    ward: { name: 'Ward', does: 'worn about yourself' },
    seal: { name: 'Seal', does: 'set on the ground before you' },
};

// Six hues for the six essences. Which essence gets which is the island's choice.
export const ESSENCE_HUES = ['#ff8a3d', '#6fd6ff', '#ffe066', '#7be36f', '#c48bff', '#ff6fae'];
