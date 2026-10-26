// GLITTERBALL GROOVE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'glitterball-groove.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const W = 8;                       // board columns
export const H = 8;                       // board rows (row 0 is the top)

// Token colours, in sim order. The sim only counts them; the view and UI give them a look.
export const KINDS = [
    { id: 'record', name: 'RECORD', hex: 0xff2fa8, css: '#ff2fa8' },
    { id: 'ball', name: 'MIRRORBALL', hex: 0x2de2ff, css: '#2de2ff' },
    { id: 'star', name: 'STAR', hex: 0xffd21f, css: '#ffd21f' },
    { id: 'heart', name: 'HEART', hex: 0xff7a1a, css: '#ff7a1a' },
    { id: 'daisy', name: 'DAISY', hex: 0x9dff3a, css: '#9dff3a' },
    { id: 'gem', name: 'GEM', hex: 0x9b5cff, css: '#9b5cff' },
];
export const WILD = 6;                    // colour index of a Glitterball (matches nothing by itself)

// Specials: what a token can be besides plain.
export const SP = { NONE: 0, BEAM_H: 1, BEAM_V: 2, BOMB: 3, MIRROR: 4 };

// Token states.
export const ST = { IDLE: 0, SWAP: 1, FALL: 2, CLEAR: 3, BOUNCE: 4 };

export const TIMING = {
    swap: 0.11,                           // s for a swap to slide
    bounce: 0.2,                          // s for a refused swap to nudge and return
    clear: 0.2,                           // s a cleared token lingers (the view pops it)
    gravity: 150,                         // rows/s²
    maxFall: 22,                          // rows/s
    spawnV: 3,                            // rows/s a new token starts at
    beamStep: 0.035,                      // s of delay per cell a beam has travelled
    chainLag: 0.07,                       // s before a special caught in a blast goes off
    queueTtl: 0.4,                        // s a swap asked for too early waits for the tokens to settle
    hintAfter: 4.5,                       // s without a move before the view points at one
    settleCheck: 0.25,                    // s between "any moves left?" checks
};

export const SCORE = {
    token: 10,
    four: 40, shape: 60, five: 100,
    beam: 30, bomb: 40, mirror: 80,
    comboStep: 0.5,                       // each combo step adds this much to the multiplier
    comboMax: 12,
    comboWindow: 1.6,                     // s to land another match and keep the streak
    feverMult: 2,
};

export const FEVER = {
    perToken: 1.1,                        // meter % per cleared token
    perComboWave: 2.5,                    // extra % for a wave at combo 3+
    perSpecial: 4,
    seconds: 8,
    dropEvery: 1.3,                       // s between the specials Fever hands out
};

export const MODES = {
    dance: { id: 'dance', name: 'DANCE-OFF', blurb: '60 SECONDS ON THE CLOCK', time: 60, moves: 0, bonus: { beam: 1, bomb: 2, mirror: 3, fever: 3, level: 3, chain4: 0 }, cap: 99 },
    jam: { id: 'jam', name: 'SLOW JAM', blurb: '30 MOVES, NO RUSH', time: 0, moves: 30, bonus: { beam: 0, bomb: 1, mirror: 2, fever: 3, level: 3, chain4: 0 }, cap: 99 },
};

// Score needed to reach level n+1 is LEVEL_STEP * n * (n + 1) / 2.
export const LEVEL_STEP = 10000;
export const levelFor = (score) => {
    let n = 1;
    while (LEVEL_STEP * n * (n + 1) / 2 <= score) n++;
    return n;
};
export const levelScore = (level) => (level <= 1 ? 0 : LEVEL_STEP * (level - 1) * level / 2);
export const colorsFor = (level) => (level >= 3 ? 6 : 5);

// Rooms: the palette of the sunburst wall and the lights, one per level, cycling.
export const ROOMS = [
    { name: 'SUNSET STRIP', sky: [0xffb000, 0xff5a1f, 0xd81b60, 0x6a1b9a], beam: [0xff9a3c, 0xff3c8e, 0xffe14a] },
    { name: 'PURPLE HAZE', sky: [0xff4dd2, 0xb23bff, 0x5a2bd6, 0x1c1259], beam: [0xff4dd2, 0x8f5bff, 0x4ad8ff] },
    { name: 'AVOCADO LOUNGE', sky: [0xe6ff3d, 0x7ed321, 0x1b9e5a, 0x0b4a4f], beam: [0xd7ff3a, 0x42e0a0, 0xffd21f] },
    { name: 'COSMIC CYAN', sky: [0x4af0ff, 0x1d8fff, 0x5a3cff, 0x14104d], beam: [0x4af0ff, 0xff4dd2, 0xffffff] },
    { name: 'HOT TUB FUNK', sky: [0xff6a3d, 0xff2e63, 0x9d1a8a, 0x2a0a4a], beam: [0xff6a3d, 0xffd21f, 0xff2fa8] },
];

export const HIGHSCORES = { size: 8 };

// Words the groove shouts at you, by combo.
export const SHOUTS = ['', '', 'GROOVY!', 'FUNKY!', 'RIGHT ON!', 'FAR OUT!', 'GET DOWN!', 'OUTTA SIGHT!', 'BOOGIE!', 'HOT STUFF!', 'GROOVE ON!', 'SUPER FREAK!', 'DISCO DIVA!'];
