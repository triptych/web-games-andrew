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
export const LOCKED = 5;      // needs a key
export const SECRET = 6;      // looks exactly like rock until searched
export const STAIRS_UP = 7;   // back the way you came

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
        this.items = [];
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
        return t === SOLID || t === DOOR || t === LOCKED || t === SECRET;
    }

    /** Blocks line of sight — open doors do not. */
    opaqueAt(x, y) {
        return this.solidAt(x, y);
    }

    walkable(x, y) {
        const t = this.at(x, y);
        return t === FLOOR || t === DOOR_OPEN || t === STAIRS || t === STAIRS_UP;
    }

    /**
     * Every cell reachable from (sx, sy), as a Set of indices.
     *
     * Closed doors count as passable by default: the player can just open
     * them, so for reasoning about layout they are not walls. Locked and
     * secret doors are always barriers. `blocked` is a single cell index
     * to treat as impassable, which is how the lock-and-key pass asks
     * "what would this door cut off?".
     */
    reachable(sx, sy, blocked = null, opts = {}) {
        const doorsOpen = opts.doorsOpen !== false;
        const passable = (x, y) => this.walkable(x, y) ||
            (doorsOpen && this.at(x, y) === DOOR);
        const seen = new Set();
        const stack = [[sx, sy]];
        while (stack.length) {
            const [x, y] = stack.pop();
            if (!this.inBounds(x, y)) continue;
            const k = y * this.width + x;
            if (seen.has(k) || k === blocked) continue;
            if (!passable(x, y)) continue;
            seen.add(k);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        return seen;
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

/** Isolated pillars inside a big room — cheap, and they look great in 3D. */
function addPillars(level, room, rng) {
    if (room.w < 6 || room.h < 6) return;
    if (rng() > 0.4) return;
    for (let y = room.y + 1; y < room.y + room.h - 1; y += 2)
        for (let x = room.x + 1; x < room.x + room.w - 1; x += 2)
            level.set(x, y, SOLID);
    room.pillared = true;
}

/** Grid of room index + 1, so we can ask "is this cell inside a room". */
function roomIdGrid(level) {
    const ids = new Uint8Array(level.width * level.height);
    level.rooms.forEach((r, i) => {
        for (let y = r.y; y < r.y + r.h; y++)
            for (let x = r.x; x < r.x + r.w; x++) ids[y * level.width + x] = i + 1;
    });
    return ids;
}

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Doorways are corridor cells that sit in a wall line with exactly two
 * opposite open sides, one of which is a room. That is precisely where a
 * dungeon architect would have hung a door.
 */
function placeDoors(level, rng, ids) {
    const doors = [];
    for (let y = 1; y < level.height - 1; y++) {
        for (let x = 1; x < level.width - 1; x++) {
            if (level.at(x, y) !== FLOOR) continue;
            if (ids[y * level.width + x] !== 0) continue;
            const openNS = level.walkable(x, y - 1) && level.walkable(x, y + 1);
            const openEW = level.walkable(x - 1, y) && level.walkable(x + 1, y);
            if (openNS === openEW) continue;               // needs exactly one axis
            if (openNS && (level.walkable(x - 1, y) || level.walkable(x + 1, y))) continue;
            if (openEW && (level.walkable(x, y - 1) || level.walkable(x, y + 1))) continue;
            const touchesRoom = ORTHO.some(([dx, dy]) => ids[(y + dy) * level.width + (x + dx)] !== 0);
            if (!touchesRoom) continue;
            if (rng() > 0.72) continue;
            level.set(x, y, DOOR);
            doors.push({ x, y });
        }
    }
    return doors;
}

/**
 * Turn one door into a locked gate, but only if locking it actually cuts
 * the stairs off — otherwise the key would be pointless. The key is then
 * dropped somewhere the player can still reach.
 */
function placeLockAndKey(level, rng, doors) {
    const shuffled = doors.slice().sort(() => rng() - 0.5);
    for (const d of shuffled) {
        const blocked = d.y * level.width + d.x;
        const near = level.reachable(level.entry.x, level.entry.y, blocked);
        if (near.has(level.stairs.y * level.width + level.stairs.x)) continue;
        if (near.size < 12) continue;                       // key side too cramped
        level.set(d.x, d.y, LOCKED);
        const cells = [...near].filter(k => {
            const x = k % level.width, y = (k / level.width) | 0;
            return level.at(x, y) === FLOOR &&
                (x !== level.entry.x || y !== level.entry.y);
        });
        if (!cells.length) { level.set(d.x, d.y, DOOR); continue; }
        const pick = cells[(rng() * cells.length) | 0];
        level.items.push({
            kind: 'key', x: pick % level.width, y: (pick / level.width) | 0
        });
        level.lockedDoor = d;
        return true;
    }
    return false;
}

/**
 * Hollow out a treasure closet behind a dead end and hide the entrance.
 * A secret door is drawn as plain rock; only searching reveals it.
 */
function placeSecrets(level, rng, count) {
    let made = 0;
    const candidates = [];
    for (let y = 2; y < level.height - 2; y++) {
        for (let x = 2; x < level.width - 2; x++) {
            if (level.at(x, y) !== FLOOR) continue;
            const open = ORTHO.filter(([dx, dy]) => level.walkable(x + dx, y + dy));
            if (open.length !== 1) continue;                // dead end
            const [ox, oy] = open[0];
            candidates.push({ x, y, dx: -ox, dy: -oy });    // dig the other way
        }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const c of candidates) {
        if (made >= count) break;
        const sx = c.x + c.dx, sy = c.y + c.dy;             // the secret door cell
        const vx = sx + c.dx, vy = sy + c.dy;               // the vault behind it
        if (!level.inBounds(vx + c.dx, vy + c.dy)) continue;
        if (level.at(sx, sy) !== SOLID || level.at(vx, vy) !== SOLID) continue;
        // the vault must be sealed rock on every other side
        const sealed = ORTHO.every(([dx, dy]) =>
            (dx === -c.dx && dy === -c.dy) || level.at(vx + dx, vy + dy) === SOLID);
        if (!sealed) continue;
        level.set(sx, sy, SECRET);
        level.set(vx, vy, FLOOR);
        level.items.push({ kind: 'hoard', x: vx, y: vy });
        made++;
    }
    return made;
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
    // Pillars go in before corridors so a corridor can bore straight
    // through one instead of being blocked by it.
    level.rooms.forEach(r => addPillars(level, r, rng));
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
    level.set(level.entry.x, level.entry.y, STAIRS_UP);

    const ids = roomIdGrid(level);
    const doors = placeDoors(level, rng, ids);
    level.doors = doors;
    if (depth >= 2 && doors.length) placeLockAndKey(level, rng, doors);
    placeSecrets(level, rng, depth >= 2 ? 1 + ((rng() * 2) | 0) : 1);

    return level;
}

/** All floor cells of a room, minus any the caller wants to exclude. */
export function roomCells(room) {
    const cells = [];
    for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y });
    return cells;
}
