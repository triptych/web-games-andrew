/**
 * Procedural Generation System
 * Binary Space Partitioning (BSP) algorithm for dungeon generation
 */

import { MAP_WIDTH, MAP_HEIGHT, PROCGEN_CONFIG } from './config.js';

/**
 * Debug function to visualize map in console (only for small sections)
 */
function debugPrintMapSection(map, centerX, centerY, radius = 10) {
    const startX = Math.max(0, centerX - radius);
    const endX = Math.min(map[0].length, centerX + radius);
    const startY = Math.max(0, centerY - radius);
    const endY = Math.min(map.length, centerY + radius);

    console.log(`Map section around (${centerX}, ${centerY}):`);
    for (let y = startY; y < endY; y++) {
        let row = '';
        for (let x = startX; x < endX; x++) {
            const tile = map[y][x];
            if (x === centerX && y === centerY) {
                row += 'P'; // Player
            } else if (tile === 0) {
                row += '.'; // Walkable
            } else if (tile === 5) {
                row += 'D'; // Door
            } else {
                row += '#'; // Wall
            }
        }
        console.log(row);
    }
}

/**
 * BSP Tree Node
 */
class BSPNode {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.leftChild = null;
        this.rightChild = null;
        this.room = null; // Only leaf nodes have rooms
    }

    /**
     * Check if this is a leaf node (no children)
     */
    isLeaf() {
        return this.leftChild === null && this.rightChild === null;
    }

    /**
     * Split this node into two children
     */
    split() {
        // Don't split if already split or too small
        if (!this.isLeaf()) return false;
        if (this.width < PROCGEN_CONFIG.MIN_SPLIT_SIZE ||
            this.height < PROCGEN_CONFIG.MIN_SPLIT_SIZE) {
            return false;
        }

        // Determine split direction (prefer splitting the longer dimension)
        const splitHorizontally = Math.random() > 0.5;

        if (this.width > this.height && this.width / this.height >= 1.25) {
            // Split vertically (left/right)
            return this.splitVertically();
        } else if (this.height > this.width && this.height / this.width >= 1.25) {
            // Split horizontally (top/bottom)
            return this.splitHorizontally();
        } else {
            // Close to square, random split
            return splitHorizontally ? this.splitHorizontally() : this.splitVertically();
        }
    }

    splitVertically() {
        const minSize = PROCGEN_CONFIG.MIN_ROOM_SIZE + 4; // +4 for walls and padding
        if (this.width < minSize * 2) return false;

        // Random split position (between 40% and 60% of width)
        const splitPos = Math.floor(this.width * (0.4 + Math.random() * 0.2));

        this.leftChild = new BSPNode(this.x, this.y, splitPos, this.height);
        this.rightChild = new BSPNode(this.x + splitPos, this.y, this.width - splitPos, this.height);

        return true;
    }

    splitHorizontally() {
        const minSize = PROCGEN_CONFIG.MIN_ROOM_SIZE + 4;
        if (this.height < minSize * 2) return false;

        const splitPos = Math.floor(this.height * (0.4 + Math.random() * 0.2));

        this.leftChild = new BSPNode(this.x, this.y, this.width, splitPos);
        this.rightChild = new BSPNode(this.x, this.y + splitPos, this.width, this.height - splitPos);

        return true;
    }

    /**
     * Get all leaf nodes (rooms) from this node and descendants
     */
    getLeaves() {
        if (this.isLeaf()) {
            return [this];
        }
        const leaves = [];
        if (this.leftChild) leaves.push(...this.leftChild.getLeaves());
        if (this.rightChild) leaves.push(...this.rightChild.getLeaves());
        return leaves;
    }
}

/**
 * Create a room within a BSP node
 */
function createRoom(node) {
    const { MIN_ROOM_SIZE, MAX_ROOM_SIZE } = PROCGEN_CONFIG;

    // Room should be smaller than the node with padding for walls
    const maxW = Math.min(node.width - 4, MAX_ROOM_SIZE);
    const maxH = Math.min(node.height - 4, MAX_ROOM_SIZE);

    const roomW = Math.max(MIN_ROOM_SIZE, Math.floor(maxW * (0.6 + Math.random() * 0.4)));
    const roomH = Math.max(MIN_ROOM_SIZE, Math.floor(maxH * (0.6 + Math.random() * 0.4)));

    // Center the room in the node with some randomness
    const roomX = node.x + Math.floor((node.width - roomW) * (0.3 + Math.random() * 0.4));
    const roomY = node.y + Math.floor((node.height - roomH) * (0.3 + Math.random() * 0.4));

    node.room = {
        x: roomX,
        y: roomY,
        width: roomW,
        height: roomH,
        centerX: roomX + Math.floor(roomW / 2),
        centerY: roomY + Math.floor(roomH / 2)
    };
}

/**
 * Create a corridor between two rooms
 */
function createCorridor(map, room1, room2) {
    const { CORRIDOR_WIDTH } = PROCGEN_CONFIG;
    const halfWidth = Math.floor(CORRIDOR_WIDTH / 2);

    // L-shaped corridor from room1 center to room2 center
    const x1 = room1.centerX;
    const y1 = room1.centerY;
    const x2 = room2.centerX;
    const y2 = room2.centerY;

    // Randomly choose whether to go horizontal first or vertical first
    if (Math.random() > 0.5) {
        // Horizontal then vertical
        carveHorizontalCorridor(map, x1, x2, y1, halfWidth);
        carveVerticalCorridor(map, y1, y2, x2, halfWidth);
    } else {
        // Vertical then horizontal
        carveVerticalCorridor(map, y1, y2, x1, halfWidth);
        carveHorizontalCorridor(map, x1, x2, y2, halfWidth);
    }
}

function carveHorizontalCorridor(map, x1, x2, y, halfWidth) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);

    for (let x = minX; x <= maxX; x++) {
        for (let dy = -halfWidth; dy <= halfWidth; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < map.length && x >= 0 && x < map[0].length) {
                map[ny][x] = 0; // Empty space
            }
        }
    }
}

function carveVerticalCorridor(map, y1, y2, x, halfWidth) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let y = minY; y <= maxY; y++) {
        for (let dx = -halfWidth; dx <= halfWidth; dx++) {
            const nx = x + dx;
            if (y >= 0 && y < map.length && nx >= 0 && nx < map[0].length) {
                map[y][nx] = 0; // Empty space
            }
        }
    }
}

/**
 * Generate a BSP tree and place rooms
 */
function generateBSPTree() {
    // Start with the entire map area (minus boundary)
    const root = new BSPNode(1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2);

    // Recursively split the tree
    const queue = [root];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node.split()) {
            queue.push(node.leftChild);
            queue.push(node.rightChild);
        }
    }

    // Create rooms in all leaf nodes
    const leaves = root.getLeaves();
    leaves.forEach(leaf => createRoom(leaf));

    return { root, leaves };
}

/**
 * Connect all rooms with corridors
 */
function connectRooms(map, node) {
    if (node.isLeaf()) return;

    // Recursively connect children first
    if (node.leftChild) connectRooms(map, node.leftChild);
    if (node.rightChild) connectRooms(map, node.rightChild);

    // Connect left and right subtrees
    if (node.leftChild && node.rightChild) {
        const leftLeaves = node.leftChild.getLeaves();
        const rightLeaves = node.rightChild.getLeaves();

        // Pick a random room from each side and connect them
        const leftRoom = leftLeaves[Math.floor(Math.random() * leftLeaves.length)].room;
        const rightRoom = rightLeaves[Math.floor(Math.random() * rightLeaves.length)].room;

        createCorridor(map, leftRoom, rightRoom);
    }
}

/**
 * Place rooms on the map
 */
function placeRooms(map, leaves) {
    leaves.forEach(leaf => {
        const room = leaf.room;
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                    map[y][x] = 0; // Empty space
                }
            }
        }
    });
}

/**
 * Add walls around the map and randomize wall types
 */
function finalizeMap(map) {
    // Add boundary walls
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
                map[y][x] = 1; // Boundary walls are always gray stone
            } else if (map[y][x] > 0) {
                // Randomize interior wall types
                const wallTypes = [1, 2, 3, 4];
                map[y][x] = wallTypes[Math.floor(Math.random() * wallTypes.length)];
            }
        }
    }
}

/**
 * Find player spawn point (center of first room with clearance validation)
 */
function findPlayerSpawnPoint(leaves) {
    if (leaves.length === 0) {
        console.error('No rooms generated!');
        return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, angle: 0 };
    }

    // Find the largest room for spawn (more space)
    let largestRoom = leaves[0].room;
    let maxArea = largestRoom.width * largestRoom.height;

    for (const leaf of leaves) {
        const area = leaf.room.width * leaf.room.height;
        if (area > maxArea) {
            maxArea = area;
            largestRoom = leaf.room;
        }
    }

    // Spawn in center of largest room with guaranteed clearance
    return {
        x: largestRoom.centerX + 0.5,
        y: largestRoom.centerY + 0.5,
        angle: 0 // Facing right
    };
}

/**
 * Find exit door location (farthest room from player spawn)
 */
function findExitDoorLocation(leaves, playerSpawn) {
    let farthestRoom = leaves[0].room;
    let maxDistance = 0;

    leaves.forEach(leaf => {
        const room = leaf.room;
        const dx = room.centerX - playerSpawn.x;
        const dy = room.centerY - playerSpawn.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) {
            maxDistance = distance;
            farthestRoom = room;
        }
    });

    return {
        x: farthestRoom.centerX,
        y: farthestRoom.centerY
    };
}

/**
 * Calculate enemy count for a floor
 */
function getEnemyCountForFloor(floorNumber) {
    const { BASE_ENEMY_COUNT, ENEMY_SCALING, MAX_ENEMIES } = PROCGEN_CONFIG;
    const count = BASE_ENEMY_COUNT + (floorNumber - 1) * ENEMY_SCALING;
    return Math.min(count, MAX_ENEMIES);
}

/**
 * Get enemy type distribution based on floor difficulty
 */
function getEnemyTypeForFloor(floorNumber) {
    const rand = Math.random();

    if (floorNumber <= 2) {
        // Early floors: mostly guards and dogs
        if (rand < 0.5) return 'GUARD';
        if (rand < 0.8) return 'DOG';
        return 'OFFICER';
    } else if (floorNumber <= 5) {
        // Mid floors: mixed
        if (rand < 0.3) return 'GUARD';
        if (rand < 0.5) return 'DOG';
        if (rand < 0.8) return 'OFFICER';
        return 'SS_TROOPER';
    } else {
        // Late floors: harder enemies
        if (rand < 0.2) return 'GUARD';
        if (rand < 0.3) return 'DOG';
        if (rand < 0.6) return 'OFFICER';
        return 'SS_TROOPER';
    }
}

/**
 * Generate enemy spawns distributed across rooms
 */
function generateEnemySpawns(leaves, floorNumber, playerSpawn, exitDoor) {
    const enemyCount = getEnemyCountForFloor(floorNumber);
    const spawns = [];

    // Don't spawn enemies in the first room (player spawn) or last room (exit door)
    const spawnableRooms = leaves.filter(leaf => {
        const room = leaf.room;
        const distToPlayer = Math.abs(room.centerX - playerSpawn.x) + Math.abs(room.centerY - playerSpawn.y);
        const distToExit = Math.abs(room.centerX - exitDoor.x) + Math.abs(room.centerY - exitDoor.y);
        return distToPlayer > 10 && distToExit > 5;
    });

    if (spawnableRooms.length === 0) {
        console.warn('No spawnable rooms found, using all rooms except first');
        spawnableRooms.push(...leaves.slice(1));
    }

    // Distribute enemies across rooms
    for (let i = 0; i < enemyCount; i++) {
        const room = spawnableRooms[i % spawnableRooms.length].room;

        // Random position within room (not too close to walls)
        const padding = 2;
        const x = room.x + padding + Math.random() * (room.width - 2 * padding);
        const y = room.y + padding + Math.random() * (room.height - 2 * padding);
        const angle = Math.random() * 360;
        const type = getEnemyTypeForFloor(floorNumber);

        spawns.push({ type, x, y, angle });
    }

    return spawns;
}

/**
 * Generate item spawns distributed across rooms
 */
function generateItemSpawns(leaves, playerSpawn) {
    const { ITEM_SPAWN_RATE } = PROCGEN_CONFIG;
    const spawns = [];

    // Skip first room (player spawn)
    const itemRooms = leaves.slice(1);

    itemRooms.forEach(leaf => {
        if (Math.random() < ITEM_SPAWN_RATE) {
            const room = leaf.room;

            // Random position within room
            const padding = 2;
            const x = room.x + padding + Math.random() * (room.width - 2 * padding);
            const y = room.y + padding + Math.random() * (room.height - 2 * padding);

            // Random item type (health or ammo)
            const itemTypes = [
                'HEALTH_SMALL', 'HEALTH_MEDIUM', 'HEALTH_LARGE',
                'AMMO_BULLETS', 'AMMO_SHELLS', 'AMMO_ROCKETS'
            ];
            const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];

            spawns.push({ type, x, y });
        }
    });

    return spawns;
}

/**
 * Main generation function - generates a complete floor
 */
export function generateFloor(floorNumber) {
    console.log(`\n=== Generating floor ${floorNumber} ===`);

    // Initialize empty map (all walls)
    const map = Array(MAP_HEIGHT).fill(null).map(() =>
        Array(MAP_WIDTH).fill(1)
    );

    // Generate BSP tree and rooms
    const { root, leaves } = generateBSPTree();
    console.log(`Generated ${leaves.length} rooms via BSP`);

    // Validate we have enough rooms
    if (leaves.length < 3) {
        console.warn(`⚠️  Only ${leaves.length} rooms generated! Map may feel cramped.`);
    }

    // Log room sizes for debugging
    if (leaves.length > 0) {
        const firstRoom = leaves[0].room;
        console.log(`First room: ${firstRoom.width}x${firstRoom.height} at (${firstRoom.x}, ${firstRoom.y})`);
        if (leaves.length > 1) {
            const lastRoom = leaves[leaves.length - 1].room;
            console.log(`Last room: ${lastRoom.width}x${lastRoom.height} at (${lastRoom.x}, ${lastRoom.y})`);
        }

        // Show all room sizes
        console.log(`All rooms: ${leaves.map(l => `${l.room.width}x${l.room.height}`).join(', ')}`);
    }

    // Place rooms on map
    placeRooms(map, leaves);
    console.log(`Placed ${leaves.length} rooms on map`);

    // Connect rooms with corridors
    connectRooms(map, root);
    console.log('Connected rooms with corridors');

    // Finalize map (boundaries and wall randomization)
    finalizeMap(map);

    // Find spawn points
    const playerSpawn = findPlayerSpawnPoint(leaves);
    const exitDoor = findExitDoorLocation(leaves, playerSpawn);
    console.log(`Player spawn: (${playerSpawn.x.toFixed(1)}, ${playerSpawn.y.toFixed(1)})`);
    console.log(`Exit door: (${exitDoor.x}, ${exitDoor.y})`);

    // Validate spawn point is walkable
    const spawnTile = map[Math.floor(playerSpawn.y)][Math.floor(playerSpawn.x)];
    console.log(`Spawn tile type: ${spawnTile} (0=walkable, >0=wall)`);

    // Validate area around spawn is clear (3x3 grid)
    let clearTiles = 0;
    let blockedTiles = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const checkX = Math.floor(playerSpawn.x) + dx;
            const checkY = Math.floor(playerSpawn.y) + dy;
            if (checkY >= 0 && checkY < map.length && checkX >= 0 && checkX < map[0].length) {
                if (map[checkY][checkX] === 0) {
                    clearTiles++;
                } else {
                    blockedTiles++;
                }
            }
        }
    }
    console.log(`Spawn clearance: ${clearTiles}/9 tiles clear, ${blockedTiles} blocked`);

    if (clearTiles < 5) {
        console.error('⚠️  WARNING: Spawn point has insufficient clearance!');
    }

    // Debug: Print map section around spawn
    debugPrintMapSection(map, Math.floor(playerSpawn.x), Math.floor(playerSpawn.y), 15);

    // Generate spawns
    const enemySpawns = generateEnemySpawns(leaves, floorNumber, playerSpawn, exitDoor);
    const itemSpawns = generateItemSpawns(leaves, playerSpawn);

    console.log(`Floor ${floorNumber} complete: ${enemySpawns.length} enemies, ${itemSpawns.length} items`);
    console.log(`=== Generation complete ===\n`);

    return {
        number: floorNumber,
        map,
        playerSpawn,
        exitDoor,
        enemySpawns,
        itemSpawns,
        roomCount: leaves.length
    };
}
