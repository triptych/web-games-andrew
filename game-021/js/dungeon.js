/**
 * dungeon.js — Procedural dungeon map generator.
 *
 * Tile values: 0=empty/floor, 1=wall, 2=door, 3=stairs_down, 4=stairs_up,
 *              7=locked_door (requires key), 8=shop_marker (floor tile)
 *
 * Also generates:
 *   - wallVariants: 2D array same size as grid
 *   - torches:      array of { x, y }
 *   - props:        array of { x, y, type }
 *   - shopPos:      { x, y } center of the shop room (or null)
 */

import {
    DUNGEON_COLS, DUNGEON_ROWS,
    TILE_EMPTY, TILE_WALL, TILE_DOOR, TILE_STAIRS_DOWN, TILE_STAIRS_UP,
    TILE_LOCKED_DOOR, TILE_SHOP,
} from './config.js';

// --- BSP node ---
class BSPNode {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.left = null; this.right = null;
        this.room = null;
    }
}

function splitNode(node, depth) {
    if (depth === 0 || node.w < 8 || node.h < 8) return;

    const splitH = node.h > node.w && node.h >= 10;
    const splitV = node.w > node.h && node.w >= 10;
    const horizontal = splitH ? true : splitV ? false : Math.random() < 0.5;

    if (horizontal) {
        const split = 4 + Math.floor(Math.random() * (node.h - 8));
        node.left  = new BSPNode(node.x, node.y, node.w, split);
        node.right = new BSPNode(node.x, node.y + split, node.w, node.h - split);
    } else {
        const split = 4 + Math.floor(Math.random() * (node.w - 8));
        node.left  = new BSPNode(node.x, node.y, split, node.h);
        node.right = new BSPNode(node.x + split, node.y, node.w - split, node.h);
    }

    splitNode(node.left, depth - 1);
    splitNode(node.right, depth - 1);
}

function placeRooms(node, rooms) {
    if (!node.left && !node.right) {
        const rw = 4 + Math.floor(Math.random() * (node.w - 6));
        const rh = 4 + Math.floor(Math.random() * (node.h - 6));
        const rx = node.x + 1 + Math.floor(Math.random() * (node.w - rw - 2));
        const ry = node.y + 1 + Math.floor(Math.random() * (node.h - rh - 2));
        node.room = { x: rx, y: ry, w: rw, h: rh };
        rooms.push(node.room);
    } else {
        if (node.left)  placeRooms(node.left, rooms);
        if (node.right) placeRooms(node.right, rooms);
    }
}

function getRoom(node) {
    if (node.room) return node.room;
    const l = node.left  ? getRoom(node.left)  : null;
    const r = node.right ? getRoom(node.right) : null;
    if (!l) return r;
    if (!r) return l;
    return Math.random() < 0.5 ? l : r;
}

function connectNodes(node, grid) {
    if (!node.left || !node.right) return;
    connectNodes(node.left,  grid);
    connectNodes(node.right, grid);

    const rA = getRoom(node.left);
    const rB = getRoom(node.right);
    if (!rA || !rB) return;

    const ax = rA.x + Math.floor(rA.w / 2);
    const ay = rA.y + Math.floor(rA.h / 2);
    const bx = rB.x + Math.floor(rB.w / 2);
    const by = rB.y + Math.floor(rB.h / 2);

    let cx = ax, cy = ay;
    while (cx !== bx) { grid[cy][cx] = TILE_EMPTY; cx += cx < bx ? 1 : -1; }
    while (cy !== by) { grid[cy][cx] = TILE_EMPTY; cy += cy < by ? 1 : -1; }
}

/**
 * Generate a dungeon floor map.
 * @param {number} floorNum — floor index (1-based)
 * @returns {{ grid, rooms, startPos, stairsUp, stairsDown, enemies, items,
 *             wallVariants, torches, props, shopPos, lockedDoorPositions }}
 */
export function generateDungeon(floorNum = 1) {
    const grid = [];
    for (let r = 0; r < DUNGEON_ROWS; r++) {
        grid.push(new Array(DUNGEON_COLS).fill(TILE_WALL));
    }

    const root = new BSPNode(0, 0, DUNGEON_COLS, DUNGEON_ROWS);
    splitNode(root, 4);
    const rooms = [];
    placeRooms(root, rooms);

    for (const room of rooms) {
        for (let r = room.y; r < room.y + room.h; r++) {
            for (let c = room.x; c < room.x + room.w; c++) {
                grid[r][c] = TILE_EMPTY;
            }
        }
    }

    connectNodes(root, grid);

    // Place stairs
    const startRoom = rooms[0];
    const endRoom   = rooms[rooms.length - 1];

    const startPos = {
        x: startRoom.x + Math.floor(startRoom.w / 2),
        y: startRoom.y + Math.floor(startRoom.h / 2),
    };

    const stairsDown = {
        x: endRoom.x + Math.floor(endRoom.w / 2),
        y: endRoom.y + Math.floor(endRoom.h / 2),
    };

    let stairsUp = null;
    if (floorNum > 1) {
        stairsUp = { x: startPos.x, y: startPos.y + 1 };
        grid[stairsUp.y][stairsUp.x] = TILE_STAIRS_UP;
    }
    grid[stairsDown.y][stairsDown.x] = TILE_STAIRS_DOWN;

    // --- Shop room (always the middle room, if enough rooms exist) ---
    let shopPos = null;
    let shopRoomIdx = -1;
    if (rooms.length >= 4) {
        shopRoomIdx = Math.floor(rooms.length / 2);
        const shopRoom = rooms[shopRoomIdx];
        shopPos = {
            x: shopRoom.x + Math.floor(shopRoom.w / 2),
            y: shopRoom.y + Math.floor(shopRoom.h / 2),
        };
        // Mark shop tile so player gets the shop prompt on step-over
        grid[shopPos.y][shopPos.x] = TILE_SHOP;
    }

    // --- Locked doors: place on 1–2 corridors leading to end room (floor >= 2) ---
    const lockedDoorPositions = [];
    if (floorNum >= 2 && rooms.length >= 3) {
        // Find a wall tile adjacent to the end room that was carved to a corridor
        const er = endRoom;
        const candidates = [];
        // Check tiles one step outside the end room perimeter that are EMPTY (corridor)
        for (let c = er.x - 1; c <= er.x + er.w; c++) {
            for (const row of [er.y - 1, er.y + er.h]) {
                if (row >= 0 && row < DUNGEON_ROWS && c >= 0 && c < DUNGEON_COLS) {
                    if (grid[row][c] === TILE_EMPTY) candidates.push({ x: c, y: row });
                }
            }
        }
        for (let r = er.y - 1; r <= er.y + er.h; r++) {
            for (const col of [er.x - 1, er.x + er.w]) {
                if (r >= 0 && r < DUNGEON_ROWS && col >= 0 && col < DUNGEON_COLS) {
                    if (grid[r][col] === TILE_EMPTY) candidates.push({ x: col, y: r });
                }
            }
        }
        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            // Don't lock the stairsDown tile itself
            if (!(pick.x === stairsDown.x && pick.y === stairsDown.y) &&
                !(shopPos && pick.x === shopPos.x && pick.y === shopPos.y)) {
                grid[pick.y][pick.x] = TILE_LOCKED_DOOR;
                lockedDoorPositions.push(pick);
            }
        }
    }

    // --- Enemies ---
    const enemies = [];
    const ENEMY_DEFS = [
        { type: 'Slime',    ranged: false, color: 0x60ff60, range: 0 },
        { type: 'Goblin',   ranged: false, color: 0xff8000, range: 0 },
        { type: 'Skeleton', ranged: true,  color: 0xe8e8b0, range: 4 },
        { type: 'Orc',      ranged: false, color: 0xff4040, range: 0 },
        { type: 'Lich',     ranged: true,  color: 0xc040ff, range: 5 },
    ];
    const typeIdx = Math.min(floorNum - 1, ENEMY_DEFS.length - 1);

    for (let i = 1; i < rooms.length - 1; i++) {
        if (i === shopRoomIdx) continue; // no enemies in shop room
        const room = rooms[i];
        const count = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < count; j++) {
            const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
            const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
            if (grid[ey][ex] === TILE_EMPTY) {
                const tier = Math.min(typeIdx + (j > 0 ? 1 : 0), ENEMY_DEFS.length - 1);
                const def  = ENEMY_DEFS[tier];
                enemies.push({
                    x: ex, y: ey,
                    type:      def.type,
                    ranged:    def.ranged,
                    color:     def.color,
                    range:     def.range,
                    hp:        6 + floorNum * 3 + tier * 2,
                    maxHp:     6 + floorNum * 3 + tier * 2,
                    atk:       2 + floorNum + tier,
                    def:       0,
                    xpReward:  5 + floorNum * 2 + tier * 3,
                    goldDrop:  Math.floor(Math.random() * (floorNum * 4)) + 1,
                    roamDir:   Math.floor(Math.random() * 4),
                    alerted:   false,
                });
            }
        }
    }

    // --- Boss on floor 5: spawn in end room ---
    if (floorNum === 5) {
        const bx = endRoom.x + 1 + Math.floor(Math.random() * (endRoom.w - 2));
        const by = endRoom.y + 1 + Math.floor(Math.random() * (endRoom.h - 2));
        if (grid[by][bx] === TILE_EMPTY &&
            !(bx === stairsDown.x && by === stairsDown.y)) {
            enemies.push({
                x: bx, y: by,
                type:      'The Lich King',
                ranged:    true,
                color:     0xff00ff,
                range:     6,
                hp:        120,
                maxHp:     120,
                atk:       18,
                def:       4,
                xpReward:  200,
                goldDrop:  150,
                roamDir:   0,
                alerted:   true,   // always alerted
                isBoss:    true,
            });
        }
    }

    // --- Items ---
    const items = [];
    const ITEM_TYPES = [
        { name: 'Health Potion', effect: 'heal',    value: 10 },
        { name: 'Rusty Sword',   effect: 'atk',     value: 2  },
        { name: 'Iron Shield',   effect: 'def',     value: 1  },
        { name: 'Gold Coin',     effect: 'gold',    value: 5  },
        { name: 'Antidote',      effect: 'antidote',value: 0  },
        { name: 'Dungeon Key',   effect: 'key',     value: 1  },
        { name: 'Fire Scroll',   effect: 'scroll',  value: 25 },
        { name: 'Magic Wand',    effect: 'wand',    value: 12 },
    ];

    // Guarantee one key per floor if locked doors exist
    let keyPlaced = false;

    for (let i = 1; i < rooms.length; i += 3) {
        if (i === shopRoomIdx) continue;
        const room = rooms[i];
        const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (grid[iy][ix] === TILE_EMPTY) {
            let item;
            if (lockedDoorPositions.length > 0 && !keyPlaced) {
                item = { name: 'Dungeon Key', effect: 'key', value: 1 };
                keyPlaced = true;
            } else {
                item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
            }
            items.push({ x: ix, y: iy, ...item });
        }
    }

    // Ensure key always placed when locked door exists
    if (lockedDoorPositions.length > 0 && !keyPlaced) {
        for (let i = 1; i < rooms.length; i++) {
            if (i === shopRoomIdx) continue;
            const room = rooms[i];
            const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
            const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
            if (grid[iy][ix] === TILE_EMPTY) {
                items.push({ x: ix, y: iy, name: 'Dungeon Key', effect: 'key', value: 1 });
                break;
            }
        }
    }

    // --- Wall variants ---
    const wallVariants = [];
    for (let r = 0; r < DUNGEON_ROWS; r++) {
        const row = new Array(DUNGEON_COLS).fill(0);
        for (let c = 0; c < DUNGEON_COLS; c++) {
            if (grid[r][c] === TILE_WALL) {
                const roll = Math.random();
                row[c] = roll < 0.15 ? 1 : roll < 0.30 ? 2 : 0;
            }
        }
        wallVariants.push(row);
    }

    // --- Torches ---
    const torches = [];
    const torchSet = new Set();
    for (const room of rooms) {
        for (let c = room.x; c < room.x + room.w; c++) {
            for (const tryR of [room.y, room.y + room.h - 1]) {
                if (grid[tryR] && grid[tryR][c] === TILE_EMPTY && Math.random() < 0.35) {
                    const key = `${c},${tryR}`;
                    if (!torchSet.has(key)) { torchSet.add(key); torches.push({ x: c, y: tryR }); }
                }
            }
        }
        for (let r = room.y; r < room.y + room.h; r++) {
            for (const tryC of [room.x, room.x + room.w - 1]) {
                if (grid[r] && grid[r][tryC] === TILE_EMPTY && Math.random() < 0.35) {
                    const key = `${tryC},${r}`;
                    if (!torchSet.has(key)) { torchSet.add(key); torches.push({ x: tryC, y: r }); }
                }
            }
        }
    }

    // --- Props ---
    const PROP_TYPES = ['barrel', 'barrel', 'skeleton', 'crate', 'bones', 'bones', 'bones'];
    const props = [];
    const propSet = new Set();
    for (let i = 1; i < rooms.length; i++) {
        if (i === shopRoomIdx) continue;
        const room = rooms[i];
        const count = Math.floor(Math.random() * 3);
        for (let j = 0; j < count; j++) {
            for (let attempt = 0; attempt < 8; attempt++) {
                const px2 = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
                const py2 = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
                const key = `${px2},${py2}`;
                if (grid[py2][px2] === TILE_EMPTY && !propSet.has(key) && !torchSet.has(key)) {
                    if ((px2 === stairsDown.x && py2 === stairsDown.y) ||
                        (stairsUp && px2 === stairsUp.x && py2 === stairsUp.y) ||
                        (shopPos && px2 === shopPos.x && py2 === shopPos.y) ||
                        (px2 === startPos.x && py2 === startPos.y)) break;
                    propSet.add(key);
                    props.push({ x: px2, y: py2, type: PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)] });
                    break;
                }
            }
        }
    }

    return { grid, rooms, startPos, stairsUp, stairsDown, enemies, items,
             wallVariants, torches, props, shopPos, lockedDoorPositions };
}
