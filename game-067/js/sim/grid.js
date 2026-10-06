/**
 * grid.js — tile edges, track segments and the geometry of a train's path through a tile.
 *
 * Edges: 0 = north (−z), 1 = east (+x), 2 = south (+z), 3 = west (−x).
 * A tile's track is a bitmask of up to six segments, each joining two edges:
 *   0 N–S, 1 E–W (straights), 2 N–E, 3 E–S, 4 S–W, 5 W–N (quarter curves of radius ½).
 * Two straights make a crossing; a straight plus a curve sharing an edge make a switch.
 */

import { N } from '../config.js';

export const DX = [0, 1, 0, -1];
export const DZ = [-1, 0, 1, 0];
export const opp = (e) => (e + 2) & 3;

export const SEGS = [[0, 2], [1, 3], [0, 1], [1, 2], [2, 3], [3, 0]];

/** Segment index joining edges a and b, or −1 when a === b. */
export function segIndex(a, b) {
    if (a === b) return -1;
    for (let i = 0; i < 6; i++) {
        const s = SEGS[i];
        if ((s[0] === a && s[1] === b) || (s[0] === b && s[1] === a)) return i;
    }
    return -1;
}
export const segHas = (s, e) => SEGS[s][0] === e || SEGS[s][1] === e;
export const segOther = (s, e) => (SEGS[s][0] === e ? SEGS[s][1] : SEGS[s][0]);
export const isCurve = (s) => s >= 2;
export const segLen = (s) => (s < 2 ? 1 : Math.PI / 4);
export const travLen = (from, to) => ((from ^ to) === 2 ? 1 : Math.PI / 4);

/** Edges the bitmask touches, as a 4-bit mask. */
export function edgeMask(bits) {
    let m = 0;
    for (let s = 0; s < 6; s++) if (bits & (1 << s)) m |= (1 << SEGS[s][0]) | (1 << SEGS[s][1]);
    return m;
}

export const idx = (x, z) => z * N + x;
export const inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;

/** World-space centre of tile (x, z). */
export const tileX = (x) => x - N / 2 + 0.5;
export const tileZ = (z) => z - N / 2 + 0.5;

const MID = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];

/**
 * Point and unit tangent along a traversal of a tile from edge `from` to edge `to`, at fraction u,
 * in tile-local coordinates (tile centre at the origin). Writes into `out` and returns it.
 */
export function travPoint(from, to, u, out = {}) {
    const a = MID[from], b = MID[to];
    if ((from ^ to) === 2) {
        out.x = a[0] + (b[0] - a[0]) * u;
        out.z = a[1] + (b[1] - a[1]) * u;
        out.dx = b[0] - a[0];
        out.dz = b[1] - a[1];
        return out;
    }
    const cx = a[0] + b[0], cz = a[1] + b[1];       // the shared corner is the curve's centre
    const t0 = Math.atan2(a[1] - cz, a[0] - cx);
    let d = Math.atan2(b[1] - cz, b[0] - cx) - t0;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    const t = t0 + d * u;
    out.x = cx + 0.5 * Math.cos(t);
    out.z = cz + 0.5 * Math.sin(t);
    const sg = d > 0 ? 1 : -1;
    out.dx = -Math.sin(t) * sg;
    out.dz = Math.cos(t) * sg;
    return out;
}

/** The edge of tile a that faces adjacent tile b, or −1 if they aren't 4-neighbours. */
export function edgeToward(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    if (dx === 0 && dz === -1) return 0;
    if (dx === 1 && dz === 0) return 1;
    if (dx === 0 && dz === 1) return 2;
    if (dx === -1 && dz === 0) return 3;
    return -1;
}

/** 4-connected line of tiles from a to b inclusive (used to fill in fast pointer drags). */
export function tileLine(ax, az, bx, bz) {
    const out = [[ax, az]];
    let x = ax, z = az;
    let guard = 0;
    while ((x !== bx || z !== bz) && guard++ < 400) {
        const dx = bx - x, dz = bz - z;
        if (Math.abs(dx) >= Math.abs(dz)) x += Math.sign(dx); else z += Math.sign(dz);
        out.push([x, z]);
    }
    return out;
}
