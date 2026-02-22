import {
    TILE_SIZE, GRID_COLS, GRID_ROWS,
    GRID_OFFSET_X, GRID_OFFSET_Y,
    ENEMY_ZONE_MAX, BUFFER_ZONE_MIN, BUFFER_ZONE_MAX, PLAYER_ZONE_MIN,
    TOWER_SLOTS, TOWER_SLOT_SET,
    NODES_AT_START, NODE_MAX_HP,
    COLORS,
} from './config.js';
import { state } from './state.js';
import { events } from './events.js';

// ============================================================
// Coordinate helpers
// ============================================================

/**
 * Convert grid tile (col, row) to world-space pixel center.
 * @param {number} col
 * @param {number} row
 * @returns {{ x: number, y: number }}
 */
export function tileToWorld(col, row) {
    return {
        x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
        y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
    };
}

/**
 * Convert world-space pixel position to grid tile (col, row).
 * Returns null if outside the grid.
 * @param {number} x
 * @param {number} y
 * @returns {{ col: number, row: number } | null}
 */
export function worldToTile(x, y) {
    const col = Math.floor((x - GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((y - GRID_OFFSET_Y) / TILE_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
}

/**
 * Check if world coords are inside the grid bounds.
 */
export function isInGrid(x, y) {
    return (
        x >= GRID_OFFSET_X &&
        x <  GRID_OFFSET_X + GRID_COLS * TILE_SIZE &&
        y >= GRID_OFFSET_Y &&
        y <  GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE
    );
}

// ============================================================
// Zone helpers
// ============================================================

export function isEnemyZone(row)  { return row <= ENEMY_ZONE_MAX; }
export function isBufferZone(row) { return row >= BUFFER_ZONE_MIN && row <= BUFFER_ZONE_MAX; }
export function isPlayerZone(row) { return row >= PLAYER_ZONE_MIN; }

// ============================================================
// Tower slot queries
// ============================================================

export function isTowerSlot(col, row) {
    return TOWER_SLOT_SET.has(`${col},${row}`);
}

export function isBurnedSlot(col, row) {
    return state.burnedSlots.has(`${col},${row}`);
}

export function isTowerAt(col, row) {
    return state.hasTower(col, row);
}

// ============================================================
// Node management
// ============================================================

export function isNodeAt(col, row) {
    return state.hasNode(col, row);
}

/**
 * Place a node at (col, row) with full HP.
 * Emits nothing (placement is silent — for initial seeding).
 */
export function placeNode(col, row, hp = NODE_MAX_HP) {
    if (state.hasNode(col, row) || state.hasTower(col, row)) return;
    state.setNode(col, row, { hp, poisoned: false });
}

/**
 * Damage a node by 1 HP.  Destroys it if HP reaches 0.
 * Returns the node's remaining HP (or -1 if no node existed).
 */
export function damageNode(col, row) {
    const node = state.getNode(col, row);
    if (!node) return -1;

    node.hp -= 1;
    if (node.hp <= 0) {
        removeNode(col, row);
        return 0;
    }
    state.setNode(col, row, node);
    events.emit('nodeDamaged', col, row, node.hp);
    return node.hp;
}

/**
 * Remove a node entirely (destroyed by player fire or Mortar splash).
 */
export function removeNode(col, row) {
    state.removeNode(col, row);
    events.emit('nodeDestroyed', col, row);
}

/**
 * Poison a node (Scorpion effect).
 */
export function poisonNode(col, row) {
    const node = state.getNode(col, row);
    if (!node) return;
    node.poisoned = true;
    state.setNode(col, row, node);
    events.emit('nodePoisoned', col, row);
}

// ============================================================
// Initial random node seeding
// ============================================================

/**
 * Returns a colour [r,g,b] for a node based on its HP.
 */
function nodeColor(hp, poisoned) {
    if (poisoned) return COLORS.nodePoisoned;
    if (hp === 4) return COLORS.node;
    if (hp === 3) return COLORS.nodeHit1;
    if (hp === 2) return COLORS.nodeHit2;
    return COLORS.nodeHit3;
}

/**
 * Seed 30 random nodes in the enemy zone.
 * Avoids edges (col 0 & 23), tower slots, and existing nodes.
 */
function seedNodes() {
    // Build a set of forbidden cells (tower slots + edges)
    const forbidden = new Set(TOWER_SLOTS.map(s => `${s.col},${s.row}`));

    let placed = 0;
    let attempts = 0;
    while (placed < NODES_AT_START && attempts < 2000) {
        attempts++;
        const col = 1 + Math.floor(Math.random() * (GRID_COLS - 2)); // 1..22
        const row = Math.floor(Math.random() * (ENEMY_ZONE_MAX + 1));  // 0..12
        const key = `${col},${row}`;
        if (forbidden.has(key)) continue;
        forbidden.add(key);
        placeNode(col, row, NODE_MAX_HP);
        placed++;
    }
}

// ============================================================
// Grid initialisation — call once inside the 'game' scene
// ============================================================

/**
 * Build all static tile entities and seed initial nodes.
 * @param {import('../../../lib/kaplay/kaplay.mjs').KaboomCtx} k
 */
export function initGrid(k) {
    _drawStaticTiles(k);
    _drawTowerSlotHighlights(k);
    seedNodes();
    _spawnNodeEntities(k);
}

// ============================================================
// Static tile rendering (created once, never updated)
// ============================================================

function tileColor(col, row) {
    if (isTowerSlot(col, row)) return COLORS.towerSlotEmpty;
    if (row <= ENEMY_ZONE_MAX)  return COLORS.enemyZone;
    if (row <= BUFFER_ZONE_MAX) return COLORS.bufferZone;
    return COLORS.playerZone;
}

function _drawStaticTiles(k) {
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (isTowerSlot(col, row)) continue; // drawn separately with highlight
            const [r, g, b] = tileColor(col, row);
            const px = GRID_OFFSET_X + col * TILE_SIZE;
            const py = GRID_OFFSET_Y + row * TILE_SIZE;
            k.add([
                k.pos(px, py),
                k.rect(TILE_SIZE, TILE_SIZE),
                k.color(r, g, b),
                k.outline(1, k.rgb(...COLORS.gridLine)),
                k.z(0),
                'tile',
            ]);
        }
    }
}

function _drawTowerSlotHighlights(k) {
    const [r, g, b] = COLORS.towerSlotEmpty;
    for (const { col, row } of TOWER_SLOTS) {
        const px = GRID_OFFSET_X + col * TILE_SIZE;
        const py = GRID_OFFSET_Y + row * TILE_SIZE;

        // Slot base tile
        k.add([
            k.pos(px, py),
            k.rect(TILE_SIZE, TILE_SIZE),
            k.color(r, g, b),
            k.outline(1, k.rgb(...COLORS.gridLine)),
            k.z(0),
            'towerSlotTile',
        ]);

        // Corner markers — four small squares to visually mark the slot
        const markerSize = 5;
        const offsets = [
            [1, 1], [TILE_SIZE - markerSize - 1, 1],
            [1, TILE_SIZE - markerSize - 1], [TILE_SIZE - markerSize - 1, TILE_SIZE - markerSize - 1],
        ];
        for (const [ox, oy] of offsets) {
            k.add([
                k.pos(px + ox, py + oy),
                k.rect(markerSize, markerSize),
                k.color(80, 130, 200),
                k.z(1),
                'towerSlotMarker',
            ]);
        }
    }
}

// ============================================================
// Node entity management
// ============================================================

/** Tag used for all node visual entities. */
const NODE_TAG = 'gridNode';

/**
 * Spawn visual entities for all nodes currently in state.
 * Called once after seedNodes().  Phase 2+ will call this
 * incrementally when new nodes are created by killed segments.
 */
function _spawnNodeEntities(k) {
    for (const [key, nodeData] of state.nodes) {
        const [col, row] = key.split(',').map(Number);
        _spawnOneNode(k, col, row, nodeData);
    }
}

function _spawnOneNode(k, col, row, nodeData) {
    const { hp, poisoned } = nodeData;
    const [r, g, b] = nodeColor(hp, poisoned);
    const center = tileToWorld(col, row);
    const size   = TILE_SIZE - 8;

    const ent = k.add([
        k.pos(center.x - size / 2, center.y - size / 2),
        k.rect(size, size, { radius: 4 }),
        k.color(r, g, b),
        k.outline(1, k.rgb(Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40))),
        k.z(2),
        NODE_TAG,
        { col, row },
    ]);

    // HP dots — small squares indicating current HP
    const dotSize = 4;
    const dotGap  = 2;
    const dotTotalW = NODE_MAX_HP * dotSize + (NODE_MAX_HP - 1) * dotGap;
    for (let i = 0; i < NODE_MAX_HP; i++) {
        const filled = i < hp;
        const dx = center.x - dotTotalW / 2 + i * (dotSize + dotGap);
        const dy = center.y + size / 2 + 2;
        k.add([
            k.pos(dx, dy),
            k.rect(dotSize, dotSize),
            k.color(filled ? 200 : 60, filled ? 200 : 60, filled ? 200 : 60),
            k.z(3),
            NODE_TAG,
            { col, row, isDot: true },
        ]);
    }

    return ent;
}

/**
 * Refresh the visual for a specific node (e.g. after being damaged).
 * Destroys old entities and recreates them.
 */
export function refreshNodeVisual(k, col, row) {
    // Remove old visuals for this node
    const existing = k.get(NODE_TAG).filter(e => e.col === col && e.row === row);
    for (const e of existing) e.destroy();

    // Recreate if node still exists
    const nodeData = state.getNode(col, row);
    if (nodeData) _spawnOneNode(k, col, row, nodeData);
}

/**
 * Spawn a brand-new node entity (called when a centipede segment is killed in Phase 2).
 */
export function spawnNodeEntity(k, col, row) {
    const nodeData = state.getNode(col, row);
    if (nodeData) _spawnOneNode(k, col, row, nodeData);
}

/**
 * Destroy visual entities for a node that was removed from state.
 */
export function destroyNodeEntity(k, col, row) {
    const existing = k.get(NODE_TAG).filter(e => e.col === col && e.row === row);
    for (const e of existing) e.destroy();
}

// ============================================================
// Burned slot fire & smoke effect
// ============================================================

/**
 * Spawn a persistent flickering flame + smoke effect on a burned tower slot.
 * These entities live for the rest of the game (tagged 'burnedSlotFx').
 * @param {*} k   Kaplay context
 * @param {number} col
 * @param {number} row
 */
export function spawnBurnEffect(k, col, row) {
    const center = tileToWorld(col, row);
    const cx = center.x;
    const cy = center.y;

    // --- Scorched tile overlay (permanent dark tint) ---
    k.add([
        k.pos(cx - TILE_SIZE / 2, cy - TILE_SIZE / 2),
        k.rect(TILE_SIZE, TILE_SIZE),
        k.color(25, 10, 5),
        k.opacity(0.72),
        k.z(1),
        'burnedSlotFx',
        { col, row },
    ]);

    // --- Flame particles (continuous) ---
    // We spawn a controller entity whose onUpdate emits flame & smoke periodically.
    let flameTimer   = 0;
    let smokeTimer   = 0;
    const FLAME_INTERVAL = 0.10; // new flame particle every 100 ms
    const SMOKE_INTERVAL = 0.28; // new smoke puff every 280 ms

    k.add([
        k.pos(cx, cy),
        k.z(10),
        k.opacity(0),   // invisible controller; opacity comp required for the entity to be valid
        'burnedSlotFx',
        { col, row, isController: true },
        {
            update() {
                flameTimer += k.dt();
                smokeTimer += k.dt();

                if (flameTimer >= FLAME_INTERVAL) {
                    flameTimer -= FLAME_INTERVAL;
                    _spawnFlameParticle(k, cx, cy);
                }
                if (smokeTimer >= SMOKE_INTERVAL) {
                    smokeTimer -= SMOKE_INTERVAL;
                    _spawnSmokeParticle(k, cx, cy);
                }
            },
        },
    ]);
}

/**
 * Emit one flame particle rising from the base of the tile center.
 */
function _spawnFlameParticle(k, cx, cy) {
    // Pick a random hue from deep orange → bright yellow
    const palette = [
        [255, 60,  10],
        [255, 110, 20],
        [255, 160, 30],
        [255, 200, 50],
        [255, 240, 80],
    ];
    const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];

    const size   = 4 + Math.random() * 6;       // 4–10 px radius
    const ox     = (Math.random() - 0.5) * 18;  // horizontal spread ±9 px
    const oy     = 4 + Math.random() * 4;        // start slightly below tile center
    const vx     = (Math.random() - 0.5) * 22;  // small horizontal drift
    const vy     = -(28 + Math.random() * 36);  // upward velocity 28–64 px/s
    const life   = 0.30 + Math.random() * 0.25; // 0.30–0.55 s

    let bx = cx + ox;
    let by = cy + oy;
    let t  = 0;

    const ent = k.add([
        k.pos(bx, by),
        k.circle(size),
        k.color(r, g, b),
        k.opacity(0.85),
        k.anchor('center'),
        k.z(11),
        'burnedSlotFx',
    ]);

    ent.onUpdate(() => {
        t  += k.dt();
        bx += vx * k.dt();
        by += vy * k.dt();
        if (ent.exists()) {
            ent.pos     = k.vec2(bx, by);
            ent.opacity = 0.85 * Math.max(0, 1 - t / life);
        }
        if (t >= life && ent.exists()) ent.destroy();
    });
}

/**
 * Emit one wispy smoke puff drifting upward.
 */
function _spawnSmokeParticle(k, cx, cy) {
    const grey   = 90 + Math.floor(Math.random() * 60); // 90–150
    const size   = 6 + Math.random() * 8;               // 6–14 px radius
    const ox     = (Math.random() - 0.5) * 14;
    const vx     = (Math.random() - 0.5) * 14;
    const vy     = -(18 + Math.random() * 20);          // slower than flame
    const life   = 0.55 + Math.random() * 0.35;         // 0.55–0.90 s
    const startOp = 0.30 + Math.random() * 0.15;        // 0.30–0.45

    let bx = cx + ox;
    let by = cy - 6; // start a little above tile center (flame tip)
    let t  = 0;

    const ent = k.add([
        k.pos(bx, by),
        k.circle(size),
        k.color(grey, grey, grey),
        k.opacity(startOp),
        k.anchor('center'),
        k.z(12),
        'burnedSlotFx',
    ]);

    ent.onUpdate(() => {
        t  += k.dt();
        bx += vx * k.dt();
        by += vy * k.dt();
        if (ent.exists()) {
            ent.pos     = k.vec2(bx, by);
            ent.opacity = startOp * Math.max(0, 1 - t / life);
        }
        if (t >= life && ent.exists()) ent.destroy();
    });
}
