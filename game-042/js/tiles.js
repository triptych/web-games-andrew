// ============================================================
// Tile ids and what each one does. Level grids are Uint8Arrays of these.
// ============================================================

export const T = {
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,      // breaks on a head bump, a pound or a rocket
    QBLOCK: 3,     // contents in level.contents[index]
    USED: 4,
    HARD: 5,       // stair blocks, castle stone
    ONEWAY: 6,     // jump up through, stand on top
    SPIKE: 7,
    LAVA: 8,       // surface of lava
    RED: 9,        // red rock: rockets only
    BUBBLE: 10,    // not solid until frozen by the Frost Ray
    CRACK: 11,     // cracked floor: ground pound breaks it
    PIPE_TL: 12, PIPE_TR: 13, PIPE_L: 14, PIPE_R: 15,
    COIN: 16,
    ICE: 17,       // a frozen bubble (runtime)
    HIDDEN: 18,    // invisible ? block, only solid when hit from below
    SPRING: 19,
    LAVA_FILL: 20,
    CEIL: 21,      // ground drawn as a ceiling (caves, castles)
    POLE: 22,      // flagpole (decor, the goal is an entity)
    // decorations: never solid
    DECO_A: 24, DECO_B: 25, DECO_C: 26, DECO_D: 27, DECO_E: 28, DECO_F: 29,
};

// Collision kinds handed to the physics.
export const K = { EMPTY: 0, SOLID: 1, ONEWAY: 2, HIDDEN: 3, SPRING: 4 };

const SOLID = new Set([T.GROUND, T.BRICK, T.QBLOCK, T.USED, T.HARD, T.RED, T.CRACK,
    T.PIPE_TL, T.PIPE_TR, T.PIPE_L, T.PIPE_R, T.ICE, T.CEIL]);

/** Collision kind for the game (everything behaves as it really does). */
export function gameKind(t) {
    if (SOLID.has(t)) return K.SOLID;
    if (t === T.ONEWAY) return K.ONEWAY;
    if (t === T.HIDDEN) return K.HIDDEN;
    if (t === T.SPRING) return K.SPRING;
    return K.EMPTY;
}

export const isHazard = t => t === T.SPIKE || t === T.LAVA || t === T.LAVA_FILL;
export const isSolidTile = t => SOLID.has(t) || t === T.SPRING;
export const isDeco = t => t >= T.DECO_A;
export const isPipe = t => t >= T.PIPE_TL && t <= T.PIPE_R;
