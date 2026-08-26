/**
 * Procedural dungeon generation.
 *
 * Rooms are placed by rejection sampling, then connected with L-shaped
 * corridors in placement order (which guarantees connectivity) plus a few
 * extra links so the map has loops instead of being a pure tree — dead-end
 * trees are miserable to crawl.
 */

import { mulberry32 } from './engine/textures.js';

export const SOLID = 0;
export const FLOOR = 1;
export const DOOR = 2;        // closed door, blocks movement and sight
export const DOOR_OPEN = 3;
export const STAIRS = 4;      // descend to the next floor

export class Level {
    constructor(width, height, depth, seed) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.seed = seed;
        this.tiles = new Uint8Array(width * height);   // SOLID everywhere
        this.seen = new Uint8Array(width * height);    // automap knowledge
        this.rooms = [];
        this.entry = { x: 1, y: 1 };
        this.stairs = { x: 1, y: 1 };
        this.theme = null;
        this.entities = [];
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    at(x, y) {
        if (!this.inBounds(x, y)) return SOLID;
        return this.tiles[y * this.width + x];
    }

    set(x, y, t) {
        if (this.inBounds(x, y)) this.tiles[y * this.width + x] = t;
    }

    /** Blocks movement (and, for the renderer, is a wall face). */
    solidAt(x, y) {
        const t = this.at(x, y);
        return t === SOLID || t === DOOR;
    }

    /** Blocks line of sight — open doors do not. */
    opaqueAt(x, y) {
        const t = this.at(x, y);
        return t === SOLID || t === DOOR;
    }

    walkable(x, y) {
        const t = this.at(x, y);
        return t === FLOOR || t === DOOR_OPEN || t === STAIRS;
    }

    markSeen(x, y) {
        if (this.inBounds(x, y)) this.seen[y * this.width + x] = 1;
    }

    hasSeen(x, y) {
        return this.inBounds(x, y) && this.seen[y * this.width + x] === 1;
    }

    /**
     * Reveal what the player can see from (px, py) by casting rays to the
     * rim of a square of radius r. Cheap, and the artefacts it produces
     * look exactly like the automaps of the era.
     */
    revealFrom(px, py, r = 7) {
        this.markSeen(px, py);
        const rim = [];
        for (let i = -r; i <= r; i++) {
            rim.push([px + i, py - r], [px + i, py + r], [px - r, py + i], [px + r, py + i]);
        }
        for (const [tx, ty] of rim) {
            let x = px, y = py;
            const dx = tx - px, dy = ty - py;
            const steps = Math.max(Math.abs(dx), Math.abs(dy));
            for (let s = 1; s <= steps; s++) {
                x = Math.round(px + (dx * s) / steps);
                y = Math.round(py + (dy * s) / steps);
                if (!this.inBounds(x, y)) break;
                this.markSeen(x, y);
                if (this.opaqueAt(x, y)) break;
            }
        }
    }
}

function overlaps(a, b, pad = 1) {
    return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
        a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

function carveRoom(level, room) {
    for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++)
            level.set(x, y, FLOOR);
}

function carveCorridor(level, x0, y0, x1, y1, horizontalFirst) {
    if (horizontalFirst) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) level.set(x, y0, level.at(x, y0) === SOLID ? FLOOR : level.at(x, y0));
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) level.set(x1, y, level.at(x1, y) === SOLID ? FLOOR : level.at(x1, y));
    } else {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) level.set(x0, y, level.at(x0, y) === SOLID ? FLOOR : level.at(x0, y));
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) level.set(x, y1, level.at(x, y1) === SOLID ? FLOOR : level.at(x, y1));
    }
}

/** Squared distance between room centres, for picking the far room. */
function roomDist(a, b) {
    const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
    const dy = (a.y + a.h / 2) - (b.y + b.h / 2);
    return dx * dx + dy * dy;
}

export function generateLevel(depth, seed) {
    const rng = mulberry32(seed);
    // floors grow with depth, capped so the automap stays readable
    const size = Math.min(49, 29 + depth * 2);
    const level = new Level(size, size, depth, seed);

    const targetRooms = Math.min(14, 6 + depth);
    const attempts = 220;
    for (let i = 0; i < attempts && level.rooms.length < targetRooms; i++) {
        const w = 3 + ((rng() * 6) | 0);
        const h = 3 + ((rng() * 6) | 0);
        const x = 1 + ((rng() * (size - w - 2)) | 0);
        const y = 1 + ((rng() * (size - h - 2)) | 0);
        const room = { x, y, w, h };
        if (level.rooms.some(r => overlaps(r, room))) continue;
        level.rooms.push(room);
    }

    level.rooms.forEach(r => carveRoom(level, r));

    const centre = r => ({ x: (r.x + r.w / 2) | 0, y: (r.y + r.h / 2) | 0 });
    for (let i = 1; i < level.rooms.length; i++) {
        const a = centre(level.rooms[i - 1]), b = centre(level.rooms[i]);
        carveCorridor(level, a.x, a.y, b.x, b.y, rng() < 0.5);
    }
    // a few extra links so the level loops back on itself
    const extras = 1 + ((level.rooms.length / 4) | 0);
    for (let i = 0; i < extras; i++) {
        const a = centre(level.rooms[(rng() * level.rooms.length) | 0]);
        const b = centre(level.rooms[(rng() * level.rooms.length) | 0]);
        carveCorridor(level, a.x, a.y, b.x, b.y, rng() < 0.5);
    }

    const first = level.rooms[0];
    level.entry = centre(first);

    // stairs go in whichever room is furthest from the entrance
    let far = level.rooms[0], best = -1;
    for (const r of level.rooms) {
        const d = roomDist(first, r);
        if (d > best) { best = d; far = r; }
    }
    const s = centre(far);
    level.stairs = s;
    level.set(s.x, s.y, STAIRS);
    level.stairsRoom = far;

    return level;
}

/** All floor cells of a room, minus any the caller wants to exclude. */
export function roomCells(room) {
    const cells = [];
    for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y });
    return cells;
}
