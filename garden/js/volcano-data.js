// Cinderpeak: where the volcano stands and what shape it is. Pure numbers and
// height functions (no three.js), shared by the view from the island, the cove
// at its foot and the mine that runs into it. Everything is in garden world
// coordinates: the volcano lies out to sea beyond the dock (+z), so you see it
// when you stand on the dock and turn around.

import { fbm2, ridged2, smoothstep, clamp, lerp } from './util.js';

export const VC = { x: 0, z: 1320 };  // the crater's centre
export const SUMMIT = 232;            // the rim, above the sea
export const RIM_R = 64;
export const COAST_R = 470;
export const CRATER_DEPTH = 74;

/** The landing cove on the north shore, facing the garden. Local z runs toward the mountain. */
export const DAIS = { x: 0, z: VC.z - 448, y: 2.35 };
export const PAD_Y = 2.35;
// the flat shelf of the cove, a rectangle around the dais
export const PAD = { x0: -27, x1: 27, z0: DAIS.z - 22, z1: DAIS.z + 60 };

/** Everything the mine and the station share: where the track starts and the mouth of the mountain. */
export const STATION = {
    cart: { x: 15.5, z: DAIS.z + 36 },          // where the cart waits
    mouth: { x: 15.5, z: DAIS.z + 62 },          // the portal in the cliff face
    mouthY: PAD_Y,
};

const wobble = (th, k, s) => fbm2(Math.cos(th) * k + s, Math.sin(th) * k - s * 0.7, 2);

/** Radius of the coast at angle th. */
export function coastRadius(th) {
    return COAST_R * (1 + 0.06 * wobble(th, 1.3, 4.1) + 0.025 * wobble(th, 4, 9));
}

/** The bare mountain: a steep concave cone with a crater, gullies and lumps. */
export function coneHeight(x, z) {
    const dx = x - VC.x, dz = z - VC.z;
    const r = Math.hypot(dx, dz);
    const th = Math.atan2(dx, dz);
    const rc = coastRadius(th);
    const rim = RIM_R * (1 + 0.16 * wobble(th, 2.3, 1.7));
    if (r < rim) {
        const d = r / rim;
        const floor = SUMMIT - CRATER_DEPTH;
        let h = SUMMIT - CRATER_DEPTH * smoothstep(1.0, 0.45, d);
        h += fbm2(x * 0.09, z * 0.09, 3) * 6 * (1 - d);
        // a notch in the rim on the garden side, where the lava spills
        const notch = smoothstep(0.55, 1.0, d) * smoothstep(0.7, 0.98, Math.cos(th - Math.PI)) * 22;
        return Math.max(floor - 4, h - notch);
    }
    const t = clamp((r - rim) / (rc - rim), 0, 1.6);
    let h;
    if (t < 1) h = SUMMIT * Math.pow(1 - t, 1.45);
    else h = -(t - 1) * (rc - rim) * 0.2 - 0.4;
    if (t < 1) {
        // radial gullies and ridges, strongest on the upper slopes
        const gully = ridged2(th * 6.0 + r * 0.004, r * 0.012, 3) - 0.5;
        h *= 1 + gully * 0.34 * Math.sin(Math.PI * Math.min(1, t * 1.3));
        h += fbm2(x * 0.018 + 7, z * 0.018 - 3, 4) * 13 * Math.sin(Math.PI * t) + fbm2(x * 0.07, z * 0.07, 3) * 2.2 * (1 - t);
    } else h += fbm2(x * 0.02, z * 0.02, 2) * 1.5;
    // a smooth crest where the slope meets the rim
    if (t < 0.05) h = lerp(h, SUMMIT + 3, 0.0);
    return h;
}

const rectDist = (x, z, r) => {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
    return Math.hypot(dx, dz);
};

/** Height of the cove floor and the walls that close it in, blended over the bare mountain. */
export function volcanoHeight(x, z) {
    let h = coneHeight(x, z);
    const near = Math.abs(x - DAIS.x) < 130 && z < VC.z - 300 && z > VC.z - 520;
    if (!near) return h;
    const zz = z - DAIS.z;
    const ax = Math.abs(x - DAIS.x);
    // sea cliffs close the cove to east and west and run out into the water as headlands
    const wall = smoothstep(38, 54, ax) * (1 - smoothstep(-6, -44, zz));
    h += wall * (26 + 10 * fbm2(x * 0.05, z * 0.05, 3)) + wall * ridged2(x * 0.11, z * 0.11, 3) * 5;
    // the shelf: flat, with a short steep fall to the cliff behind and a beach toward the sea
    const d = rectDist(x, z, PAD);
    const side = z > PAD.z1 - 2 ? 0 : 1;                  // south edge: a short cliff, elsewhere a longer slope
    const fall = z > (PAD.z1 + PAD.z0) / 2 ? lerp(11, 9, side) : 16;
    const w = 1 - smoothstep(0, fall, d);
    return lerp(h, PAD_Y + fbm2(x * 0.22, z * 0.22, 2) * 0.18 * smoothstep(2, 10, d), w * w * (3 - 2 * w));
}

/** Rough distance to open water (negative on land), for the surf sound and the sea's foam. */
export function volcanoShore(x, z) {
    const r = Math.hypot(x - VC.x, z - VC.z);
    return r - coastRadius(Math.atan2(x - VC.x, z - VC.z));
}
