// The Lighthouse Arcade's floor plan, made from the game list (no three.js here).
// Every game gets a cabinet. Cabinets stand back to back in islands, one genre to
// an island (a big genre fills several), and the islands are packed into a grid
// that grows with the list. A bowling alley runs down the west side, and the east
// side holds the disco floor, its jukebox and the prize counter. Add games and
// the hall gets bigger; the bowling alley gains lanes as it does.

import { groupGames } from './genres.js';
import { rng, clamp } from './util.js';

export const CAB_W = 0.8;          // cabinet width
export const CAB_D = 0.82;         // cabinet depth
export const CAB_PITCH = 0.92;     // cabinet spacing along an island
export const PER_SIDE = 7;         // cabinets on each face of an island
export const ISLAND_D = CAB_D * 2 + 0.06;
export const AISLE = 3.1;          // walking room between islands
export const HALL_H = 6.2;

// the bowling alley, in metres (a real lane is 18.3 m to the head pin; ours is a touch shorter)
export const LANE_W = 1.06;        // the boards
export const GUTTER = 0.24;
export const LANE_PITCH = 1.95;    // lane + two gutters + the capping between lanes
export const LANE_LEN = 15.5;      // foul line to head pin
export const APPROACH = 4.6;

// the disco floor
export const TILE = 1.0;
export const TILES = 7;

/**
 * @param {object[]} games  the launcher's game list
 * @returns the floor plan: hall bounds, cabinets, islands, signs, the bowling alley,
 *          the disco, the jukebox, the counter, blocks you cannot walk into, and pillars.
 */
export function planArcade(games) {
    const r = rng('lighthouse-arcade-' + games.length);
    const groups = groupGames(games);

    // ---- islands: one genre each, split when a genre is big
    const islands = [];
    for (const g of groups) {
        for (let i = 0; i < g.games.length; i += PER_SIDE * 2) {
            islands.push({ genre: g.genre, games: g.games.slice(i, i + PER_SIDE * 2), part: i / (PER_SIDE * 2) });
        }
    }
    const cols = clamp(Math.round(Math.sqrt(islands.length * 0.8)), 2, 5);
    const rows = Math.ceil(islands.length / cols);
    const ISL = PER_SIDE * CAB_PITCH;                 // the longest island
    const slotW = ISL + AISLE;
    const slotD = ISLAND_D + AISLE;
    const AW = cols * slotW + AISLE;                  // the cabinet floor's width
    const arcadeD = rows * slotD + AISLE;

    // ---- the bowling alley sets the hall's least depth
    const nLanes = clamp(Math.floor(games.length / 30) + 1, 2, 6);
    const backRoom = 2.4;                             // pin deck, pit and the masking unit
    const front = 3.0;                                // concourse between the settees and the south wall
    const D = Math.max(LANE_LEN + APPROACH + backRoom + front + 1.2, arcadeD + 9);
    const BW = nLanes * LANE_PITCH + 0.6;
    const DW = Math.max(14, TILES * TILE + 6.5);

    const x0 = -AW / 2 - BW - 1.2, x1 = AW / 2 + DW;
    const z0 = -D / 2, z1 = D / 2;
    const hall = { x0, x1, z0, z1, h: HALL_H, w: x1 - x0, d: D };

    // ---- cabinets
    const zTop = z0 + 3.4;                            // room in front of the north wall mural
    const cabinets = [];
    const signs = [];
    const blocks = [];
    islands.forEach((isl, i) => {
        const c = i % cols, rw = Math.floor(i / cols);
        const n = isl.games.length;
        const perSide = Math.ceil(n / 2);
        const len = perSide * CAB_PITCH;
        const cx = -AW / 2 + AISLE + c * slotW + ISL / 2;
        const cz = zTop + rw * slotD + ISLAND_D / 2;
        isl.x = cx;
        isl.z = cz;
        isl.len = len;
        isl.games.forEach((game, k) => {
            const south = k < perSide;                // fill the south face first, then the north
            const j = south ? k : k - perSide;
            const m = south ? perSide : n - perSide;
            const x = cx + (j - (m - 1) / 2) * CAB_PITCH * (south ? 1 : -1);
            const z = cz + (south ? 1 : -1) * (CAB_D / 2 + 0.03);
            const rot = south ? 0 : Math.PI;          // a cabinet's front faces +z when rot = 0
            const fz = south ? 1 : -1;
            cabinets.push({ game, genre: isl.genre, island: i, x, z, rot, stand: { x, z: z + fz * 1.15, yaw: south ? 0 : Math.PI }, seed: r() });
        });
        blocks.push({ x0: cx - len / 2 - 0.1, x1: cx + len / 2 + 0.1, z0: cz - ISLAND_D / 2 - 0.05, z1: cz + ISLAND_D / 2 + 0.05 });
        signs.push({ genre: isl.genre, x: cx, z: cz, w: Math.min(len, 5.6), part: isl.part });
    });
    cabinets.forEach((c, i) => (c.id = i));

    // pillars where the aisles cross, holding up the long roof
    const pillars = [];
    for (let c = 1; c < cols; c++) {
        for (let rw = 0; rw <= rows; rw += Math.max(1, Math.ceil(rows / 2))) {
            const x = -AW / 2 + c * slotW + AISLE / 2;
            const z = zTop - AISLE / 2 + rw * slotD;
            if (z > z1 - 4 || z < z0 + 1.5) continue;
            pillars.push({ x, z, r: 0.32 });
        }
    }

    // ---- the bowling alley along the west wall: lanes run north, the bowler stands at the south end
    const foulZ = z1 - front - APPROACH;
    const headZ = foulZ - LANE_LEN;
    const bx0 = x0 + 0.6;
    const lanes = [];
    for (let i = 0; i < nLanes; i++) {
        const cx = bx0 + LANE_PITCH * (i + 0.5);
        lanes.push({ i, x: cx, foulZ, headZ, stand: { x: cx, z: foulZ + 2.6, yaw: 0 } });
    }
    const bx1 = bx0 + nLanes * LANE_PITCH;
    const bowling = { x0: bx0, x1: bx1, foulZ, headZ, backZ: z0, lanes, settee: foulZ + APPROACH - 0.4 };
    // the lanes themselves, from the foul line to the masking unit
    blocks.push({ x0: bx0 - 0.05, x1: bx1 + 0.05, z0: z0 - 1, z1: foulZ, lanes: true });
    // ball returns, one between each pair of lanes
    bowling.returns = [];
    for (let i = 0; i + 1 < nLanes; i += 2) {
        const x = bx0 + LANE_PITCH * (i + 1);
        bowling.returns.push({ x, z: foulZ + 1.5 });
        blocks.push({ x0: x - 0.32, x1: x + 0.32, z0: foulZ + 0.4, z1: foulZ + 2.3 });
    }
    if (nLanes % 2) {
        const x = bx0 + LANE_PITCH * nLanes;
        bowling.returns.push({ x, z: foulZ + 1.5 });
        blocks.push({ x0: x - 0.32, x1: x + 0.32, z0: foulZ + 0.4, z1: foulZ + 2.3 });
    }
    // a wall of glass blocks between the alley and the cabinets, open at the concourse
    bowling.wallX = bx1 + 0.6;
    blocks.push({ x0: bowling.wallX - 0.12, x1: bowling.wallX + 0.12, z0: z0 - 1, z1: foulZ + 0.6 });

    // ---- the disco on the east side
    const dxc = AW / 2 + 1.8 + (DW - 1.8) / 2;
    const disco = { x: dxc - 0.6, z: z0 + 3.2 + (TILES * TILE) / 2, n: TILES, tile: TILE, half: (TILES * TILE) / 2 };
    const jukebox = { x: x1 - 0.65, z: disco.z, rot: -Math.PI / 2 };
    blocks.push({ x0: jukebox.x - 0.5, x1: x1 + 1, z0: jukebox.z - 0.8, z1: jukebox.z + 0.8 });
    // speakers either side of the jukebox
    disco.speakers = [{ x: x1 - 0.6, z: disco.z - 2.4 }, { x: x1 - 0.6, z: disco.z + 2.4 }];
    for (const s of disco.speakers) blocks.push({ x0: s.x - 0.45, x1: x1 + 1, z0: s.z - 0.45, z1: s.z + 0.45 });

    // the prize counter in the south-east corner, and a few café tables between it and the floor
    const counter = { x0: x1 - 6.5, x1: x1 - 0.2, z0: z1 - 3.2, z1: z1 - 2.4 };
    blocks.push({ x0: counter.x0, x1: counter.x1 + 1, z0: counter.z0, z1: z1 + 1 });
    const tables = [];
    const tz = (disco.z + disco.half + counter.z0) / 2;
    for (let k = 0; k < 3; k++) {
        const tx = dxc - 3.8 + k * 3.2 + r.range(-0.3, 0.3);
        if (tz - (disco.z + disco.half) > 1.6) tables.push({ x: tx, z: tz + r.range(-0.3, 0.3), r: 0.5 });
    }

    // ---- the way in and out, in the south wall in front of the cabinets
    const door = { x: 0, z: z1 - 0.15 };
    const exit = { x: 0, z: z1 - 0.75 };
    const spawn = { x: 0, z: z1 - 2.4, yaw: 0 };

    return { games, islands, cols, rows, cabinets, signs, pillars, blocks, hall, bowling, disco, jukebox, counter, tables, door, exit, spawn, AW, seed: r() };
}

/** Is (x, z) somewhere you can stand? `pad` keeps the eye out of the furniture. */
export function walkablePlan(plan, x, z, pad = 0.3) {
    const h = plan.hall;
    if (x < h.x0 + pad || x > h.x1 - pad || z < h.z0 + pad || z > h.z1 - pad) return false;
    for (const b of plan.blocks) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return false;
    for (const p of plan.pillars) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + pad) ** 2) return false;
    for (const t of plan.tables) if ((x - t.x) ** 2 + (z - t.z) ** 2 < (t.r + pad) ** 2) return false;
    return true;
}
