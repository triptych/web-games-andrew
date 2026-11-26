// VACANCY — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.2.0';
export const SAVE_KEY = 'vacancy.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ------------------------------------------------------------------ the grid
// The whole city, outside and in, sits on one grid of TILE-metre tiles. A building owns a rectangle of tiles and
// stacks its own levels on them; walls run along tile edges.
export const TILE = 2;
export const CITY = {
    blocks: 11,            // blocks per side
    pitch: 30,             // tiles from one block's corner to the next
    road: 5,               // tiles of street between blocks: sidewalk, 3 lanes, sidewalk
    edge: 5,               // a street around the outside, then the fog
};
export const CITY_TILES = CITY.blocks * CITY.pitch + CITY.edge;   // 335 tiles, 670 m

// ------------------------------------------------------------------ the walker
export const PLAYER = {
    radius: 0.3,
    eye: 1.62,
    walk: 3.1,             // m/s
    run: 5.6,
    turn: 2.6,             // rad/s with the arrow keys
    step: 0.62,            // the highest ledge you walk up without thinking
    gravity: 18,
    reach: 1.9,            // how far away you can pick something up
    reachCos: 0.5,         // ...and how far off-centre (cos of the half-angle)
};

export const DOOR_GAP = 1.15;              // metres of doorway between the two wall stubs
export const WALL_T = 0.14;                // wall thickness for collision

// ------------------------------------------------------------------ the story
export const DIARIES = 10;                 // nine citizens and Dr. Marrow
export const ITEM_AT = { 2: 0, 4: 1, 6: 2 };  // diary index → which of the three gate items lies with it
export const FUSE_AT = 8;                  // the fuse lies with the ninth diary
export const LEVERS = ['amber', 'violet', 'green', 'white'];
export const ENDING_SECONDS = 9;           // the portal sequence before the end card

// Lock kinds and the item that opens each.
export const LOCKS = {
    boards: { item: 'crowbar', name: 'boarded shut', need: 'Something to prise the boards off would do it.', done: 'You lever the boards off with the crowbar. They come away wet.' },
    chain: { item: 'cutters', name: 'chained', need: 'A heavy chain and padlock. Bolt cutters would go through it.', done: 'The bolt cutters bite through the chain. It slithers to the floor.' },
    badge: { item: 'badge', name: 'card reader', need: 'A card reader blinks red. It wants a staff badge.', done: 'You swipe the staff badge. The reader thinks, then blinks green.' },
    lab: { item: 'labcard', name: 'Threshold security', need: 'THRESHOLD LABORATORY — AUTHORISED PERSONNEL. The reader wants a director-level card.', done: 'Dr. Marrow\'s keycard. The lock gives with a heavy, oiled clunk.' },
};

export const ITEMS = {
    flashlight: { name: 'Flashlight', icon: '🔦', text: 'A heavy rubber flashlight. The batteries should have died years ago.' },
    compass: { name: 'Brass compass', icon: '🧭', text: 'Its needle ignores north. It points at whatever you most need to find next.' },
    crowbar: { name: 'Crowbar', icon: '🪛', text: 'Rusty, heavy, honest. Opens boarded doors.' },
    cutters: { name: 'Bolt cutters', icon: '✂️', text: 'Long red handles. Opens chained doors and gates.' },
    badge: { name: 'Staff badge', icon: '🪪', text: 'A hospital staff badge with a magnetic strip. Opens card readers.' },
    fuse: { name: 'Ceramic fuse', icon: '🧯', text: 'A fat ceramic cartridge fuse, the kind a substation eats. Still warm.' },
    labcard: { name: 'Director\'s keycard', icon: '💳', text: 'E. MARROW — DIRECTOR. Opens everything at Threshold.' },
};
