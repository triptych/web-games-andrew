/**
 * dungeon.js — Procedural dungeon map generator.
 *
 * Generates a 2D tile grid using a BSP (binary space partition) room approach.
 * Returns a map object used by DungeonScene and Raycaster.
 *
 * Tile values: 0=empty/floor, 1=wall, 2=door, 3=stairs_down, 4=stairs_up
 */

import {
    DUNGEON_COLS, DUNGEON_ROWS,
    TILE_EMPTY, TILE_WALL, TILE_DOOR, TILE_STAIRS_DOWN, TILE_STAIRS_UP,
} from './config.js';

// --- BSP node ---
class BSPNode {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.left = null; this.right = null;
        this.room = null; // { x, y, w, h }
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
        // Leaf — carve a room
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

    // L-shaped corridor
    let cx = ax, cy = ay;
    while (cx !== bx) {
        grid[cy][cx] = TILE_EMPTY;
        cx += cx < bx ? 1 : -1;
    }
    while (cy !== by) {
        grid[cy][cx] = TILE_EMPTY;
        cy += cy < by ? 1 : -1;
    }
}

/**
 * Generate a dungeon floor map.
 * @param {number} floorNum  — floor index (1-based), used to scale difficulty
 * @returns {{ grid, rooms, startPos, stairsUp, stairsDown, enemies, items }}
 */
export function generateDungeon(floorNum = 1) {
    // Fill with walls
    const grid = [];
    for (let r = 0; r < DUNGEON_ROWS; r++) {
        grid.push(new Array(DUNGEON_COLS).fill(TILE_WALL));
    }

    // BSP
    const root = new BSPNode(0, 0, DUNGEON_COLS, DUNGEON_ROWS);
    splitNode(root, 4);
    const rooms = [];
    placeRooms(root, rooms);

    // Carve rooms into grid
    for (const room of rooms) {
        for (let r = room.y; r < room.y + room.h; r++) {
            for (let c = room.x; c < room.x + room.w; c++) {
                grid[r][c] = TILE_EMPTY;
            }
        }
    }

    // Connect rooms via corridors
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

    // Stairs up only on floors > 1
    let stairsUp = null;
    if (floorNum > 1) {
        stairsUp = { x: startPos.x, y: startPos.y + 1 };
        grid[stairsUp.y][stairsUp.x] = TILE_STAIRS_UP;
    }
    grid[stairsDown.y][stairsDown.x] = TILE_STAIRS_DOWN;

    // Spawn enemies (1–2 per room, scaled by floor)
    const enemies = [];
    const ENEMY_TYPES = ['Slime', 'Goblin', 'Skeleton', 'Orc', 'Lich'];
    const typeIdx = Math.min(floorNum - 1, ENEMY_TYPES.length - 1);

    for (let i = 1; i < rooms.length - 1; i++) {
        const room = rooms[i];
        const count = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < count; j++) {
            const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
            const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
            if (grid[ey][ex] === TILE_EMPTY) {
                const tier = Math.min(typeIdx + (j > 0 ? 1 : 0), ENEMY_TYPES.length - 1);
                enemies.push({
                    x: ex, y: ey,
                    type:   ENEMY_TYPES[tier],
                    hp:     6 + floorNum * 3 + tier * 2,
                    maxHp:  6 + floorNum * 3 + tier * 2,
                    atk:    2 + floorNum + tier,
                    xpReward: 5 + floorNum * 2 + tier * 3,
                    goldDrop: Math.floor(Math.random() * (floorNum * 4)) + 1,
                });
            }
        }
    }

    // Spawn items (one per 3 rooms roughly)
    const items = [];
    const ITEM_TYPES = [
        { name: 'Health Potion', effect: 'heal', value: 10 },
        { name: 'Rusty Sword',   effect: 'atk',  value: 2  },
        { name: 'Iron Shield',   effect: 'def',  value: 1  },
        { name: 'Gold Coin',     effect: 'gold', value: 5  },
    ];
    for (let i = 1; i < rooms.length; i += 3) {
        const room = rooms[i];
        const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (grid[iy][ix] === TILE_EMPTY) {
            const item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
            items.push({ x: ix, y: iy, ...item });
        }
    }

    return { grid, rooms, startPos, stairsUp, stairsDown, enemies, items };
}
