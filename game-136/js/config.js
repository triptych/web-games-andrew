// Pinch & Place — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'pinch-and-place.v1';
export const ALBUM_KEY = 'pinch-and-place.album.v1';

export const MAX_FRAME = 0.05;            // a long frame never runs more than this much time

export const WALL_ROWS = 3;               // picture rows on each back wall
export const UNDO_DEPTH = 40;
export const SHELF_MAX = 24;              // things waiting on the shelf at once

// Rating: how the 0–100 score is made, and where the stars are.
export const RATE = {
    reqWeight: 50,                        // all required goals
    bonusWeight: 20,                      // all bonus goals (spread evenly)
    styleWeight: 30,                      // the style average
    twoStars: 72,
    threeStars: 88,
};

// What makes a room feel cosy (0–100 after the cap).
export const COSY = { soft: 7, light: 9, warmLight: 4, rug: 10, art: 5, green: 4, fire: 14, clutterAt: 0.6 };

export const ALBUM_MAX = 12;
export const PHOTO = { w: 1600, h: 1200 };
