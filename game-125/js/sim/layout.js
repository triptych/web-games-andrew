// The Ark Meridian's crew deck, as pure data: rooms (rectangles in metres, x east, z south), the terminals you
// use, and the furniture you bump into. The sim walks you through it; the view builds it; the tests flood-fill it.

export const ROOMS = [
    { id: 'wake', name: 'Wake Bay', x0: -6, x1: 6, z0: 2, z1: 11, h: 3.4, tint: '#7ab0d0' },
    { id: 'spine', name: 'Spine Corridor', x0: -2, x1: 2, z0: -36, z1: 2, h: 3.0, tint: '#a0b0c8' },
    { id: 'stasis', name: 'Stasis Hall', x0: 3, x1: 19, z0: -13, z1: -1, h: 4.2, tint: '#6ad0ff' },
    { id: 'lab', name: 'Gene Lab', x0: -17, x1: -3, z0: -13, z1: -3, h: 3.6, tint: '#7aff9a' },
    { id: 'research', name: 'Research Lab', x0: -17, x1: -3, z0: -28, z1: -16, h: 3.6, tint: '#ffd06a' },
    { id: 'hangar', name: 'Bot Hangar', x0: 3, x1: 20, z0: -32, z1: -16, h: 6.0, tint: '#ff9a5a' },
    { id: 'command', name: 'Command Deck', x0: -11, x1: 11, z0: -51, z1: -37, h: 5.0, tint: '#9ab8ff' },
];
// Doorways bridge the one-metre walls between the spine and each room.
export const DOORS = [
    { room: 'stasis', x0: 2, x1: 3, z0: -8, z1: -5 },
    { room: 'lab', x0: -3, x1: -2, z0: -9, z1: -6 },
    { room: 'research', x0: -3, x1: -2, z0: -23, z1: -20 },
    { room: 'hangar', x0: 2, x1: 3, z0: -26, z1: -22 },
    { room: 'command', x0: -2, x1: 2, z0: -37, z1: -36 },
];
export const BOUNDS = { x0: -18, x1: 21, z0: -52, z1: 12 };

// Terminals: where you stand to use them is within WALK.reach of (x, z).
export const TERMINALS = [
    { id: 'command', name: 'Holo-table', room: 'command', x: 0, z: -45, r: 1.9 },
    { id: 'hangar', name: 'Fabrication Console', room: 'hangar', x: 9, z: -19.5, r: 0.9 },
    { id: 'launch', name: 'Drop Cradle', room: 'hangar', x: 14, z: -27, r: 1.6 },
    { id: 'lab', name: 'Gene Splicer', room: 'lab', x: -10, z: -8, r: 1.3 },
    { id: 'research', name: 'Research Console', room: 'research', x: -10, z: -22, r: 1.2 },
    { id: 'archive', name: 'Stasis Archive', room: 'stasis', x: 17, z: -7, r: 0.8 },
    { id: 'iris', name: 'Pod 31,207', room: 'stasis', x: 6, z: -11.6, r: 0.6 },
    { id: 'pod', name: 'Your Pod', room: 'wake', x: 0, z: 9.6, r: 0.9 },
];
export const TERM_BY_ID = Object.fromEntries(TERMINALS.map((t) => [t.id, t]));
// Which panel a terminal opens.
export const TERM_PANEL = { command: 'command', hangar: 'hangar', launch: 'hangar', lab: 'lab', research: 'research', archive: 'archive', iris: 'iris', pod: 'pod' };

// Pod rows in the Stasis Hall: boxes you can't walk through.
export const POD_ROWS = [];
for (let r = 0; r < 3; r++) POD_ROWS.push({ x0: 6, x1: 15, z0: -11.6 + r * 3.6 - 0.6, z1: -11.6 + r * 3.6 + 0.6 });
// Furniture as circles: terminals plus a few solid props.
export const SOLIDS = [
    ...TERMINALS.filter((t) => t.id !== 'iris').map((t) => ({ x: t.x, z: t.z, r: t.r })),
    { x: -14, z: -5, r: 0.9 }, { x: -14, z: -11, r: 0.9 },          // lab vats
    { x: -5.5, z: -26, r: 0.7 }, { x: -15, z: -18, r: 0.7 },          // research racks
    { x: 18, z: -18, r: 0.8 }, { x: 5, z: -30, r: 0.8 },              // hangar crates
];

export const SPAWN = { x: 0, z: 7.6, yaw: 0 };

// ---------------------------------------------------------------- walkability
const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/** Floor exists here (inside a room or a doorway). */
export function onFloor(x, z) {
    for (const r of ROOMS) if (inRect(r, x, z)) return true;
    for (const d of DOORS) if (inRect(d, x, z)) return true;
    return false;
}
export function roomAt(x, z) {
    for (const r of ROOMS) if (inRect(r, x, z)) return r.id;
    for (const d of DOORS) if (inRect(d, x, z)) return d.room;
    return null;
}
/** A circle of radius rad at (x, z) fits: on floor at its rim, clear of pods and furniture. */
export function fits(x, z, rad) {
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (!onFloor(x + Math.cos(a) * rad, z + Math.sin(a) * rad)) return false;
    }
    for (const p of POD_ROWS) if (x > p.x0 - rad && x < p.x1 + rad && z > p.z0 - rad && z < p.z1 + rad) return false;
    for (const s of SOLIDS) if ((x - s.x) ** 2 + (z - s.z) ** 2 < (s.r + rad) ** 2) return false;
    return true;
}
