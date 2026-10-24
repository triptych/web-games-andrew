// The seeded layout: the parts of the house that change from game to game. Pure and small, so
// simtest can build thousands of them and prove every one can be finished.

import { makeRng } from '../rng.js';
import { BOOK_TITLES, NOTE_NAMES } from './data.js';

export const KEY_SPOTS = ['sofa', 'teapot', 'fireplace'];

function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** One seed, one house. Always makes a layout the rules can finish. */
export function makeLayout(seed) {
    const rng = makeRng((seed ^ 0x5eed0095) >>> 0);
    const bookTitles = shuffle(rng, BOOK_TITLES);           // title at each shelf position 0..4
    const bookOrder = shuffle(rng, [0, 1, 2, 3, 4]).slice(0, 3);
    const melody = [rng.int(0, 4), rng.int(0, 4), rng.int(0, 4), rng.int(0, 4)];
    // a melody of one note repeated is not a tune
    if (melody.every((n) => n === melody[0])) melody[3] = (melody[0] + 2) % NOTE_NAMES.length;
    return {
        keySpot: rng.pick(KEY_SPOTS),
        age: rng.int(5, 9),                                  // pantry code: three single digits
        day: rng.int(2, 9),
        guests: rng.int(3, 9),
        bookTitles,
        bookOrder,
        melody,
        hue: rng.int(0, 359),                                // shifts the house's wallpaper
        peeks: { foyer: rng.int(0, 2), parlor: rng.int(0, 2), kitchen: rng.int(0, 2), library: rng.int(0, 2), attic: rng.int(0, 2), ballroom: rng.int(0, 2) },
    };
}
