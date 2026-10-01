/**
 * tiles.js — tile ids and their properties. Shared by the simulation and the view.
 */

export const T = {
    WALL: 0, FLOOR: 1, DOOR: 2, DOOR_OPEN: 3, STAIRS_DOWN: 4, STAIRS_UP: 5,
    SHALLOW: 6, DEEP: 7, LAVA: 8, CHASM: 9, BRIDGE: 10, PILLAR: 11,
    VAULT_DOOR: 12, MOSS: 13, RUBBLE: 14, PROP: 15, ICE: 16, SEALED: 17,
};

// pass: walkable · opaque: blocks sight · fly: a flyer may cross · liquid
const P = [];
const def = (id, o) => { P[id] = { pass: false, opaque: false, fly: false, liquid: false, ...o }; };
def(T.WALL, { opaque: true });
def(T.FLOOR, { pass: true });
def(T.DOOR, { opaque: true, door: true });
def(T.DOOR_OPEN, { pass: true, door: true });
def(T.STAIRS_DOWN, { pass: true });
def(T.STAIRS_UP, { pass: true });
def(T.SHALLOW, { pass: true, liquid: true });
def(T.DEEP, { fly: true, liquid: true });
def(T.LAVA, { fly: true, liquid: true, light: 4 });
def(T.CHASM, { fly: true });
def(T.BRIDGE, { pass: true });
def(T.PILLAR, { opaque: true });
def(T.VAULT_DOOR, { opaque: true, door: true });
def(T.MOSS, { pass: true });
def(T.RUBBLE, { pass: true });
def(T.PROP, {});
def(T.ICE, { pass: true });
def(T.SEALED, { opaque: false });
export const TP = P;

export const passable = (t) => P[t].pass;
export const opaque = (t) => P[t].opaque;

/** Monsters (and the hero) treat closed doors as walkable — bumping opens them. */
export const walkable = (t, fly = false) => P[t].pass || t === T.DOOR || (fly && P[t].fly);

export const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
export const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
