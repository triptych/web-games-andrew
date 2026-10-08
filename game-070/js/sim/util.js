// Wrap-around helpers: the world is a cylinder WORLD_W around.

import { WORLD_W } from '../config.js';

const HALF = WORLD_W / 2;

/** x folded into [0, WORLD_W). */
export const wrap = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;

/** Shortest signed distance from b to a (a − b), in (−WORLD_W/2, WORLD_W/2]. */
export function wdx(a, b) {
    let d = (a - b) % WORLD_W;
    if (d > HALF) d -= WORLD_W;
    else if (d <= -HALF) d += WORLD_W;
    return d;
}
