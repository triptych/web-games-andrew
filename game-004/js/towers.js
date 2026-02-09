import { TILE_SIZE, TOWER_DEFS, COLORS, TOOLBAR_Y, HUD_HEIGHT, GAME_WIDTH } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { gridToWorld, worldToGrid, isBuildable, isInGrid } from './map.js';

let k;
let ghostObj = null;
let rangeObj = null;
let selectedRangeObj = null;

export function initTowers(kaplay) {
    k = kaplay;

    // Mouse move: update placement ghost
    k.onMouseMove(() => {
        const pos = k.mousePos();
        updateGhost(pos);
        updateHoverRange(pos);
    });

    // Left click: place tower or select existing tower
    k.onClick(() => {
        const pos = k.mousePos();

        // Ignore clicks in UI areas (HUD top bar, right panel, and bottom toolbar)
        const PANEL_RIGHT_EDGE = GAME_WIDTH - 20; // Right edge of screen minus margin
        const PANEL_LEFT_EDGE = PANEL_RIGHT_EDGE - 130; // Panel width is 130
        if (pos.y < HUD_HEIGHT || pos.y >= TOOLBAR_Y) return;
        if (pos.x >= PANEL_LEFT_EDGE && pos.x <= PANEL_RIGHT_EDGE) return;

        if (state.isGameOver || state.isVictory) return;

        // Placing mode
        if (state.placingType) {
            if (!isInGrid(pos.x, pos.y)) return;
            const { col, row } = worldToGrid(pos.x, pos.y);
            if (isBuildable(col, row)) {
                const def = TOWER_DEFS[state.placingType];
                if (state.spend(def.cost)) {
                    createTower(state.placingType, col, row);
                    state.placingType = null;
                    clearGhost();
                }
            }
            return;
        }

        // Check if clicking on a tower
        if (isInGrid(pos.x, pos.y)) {
            const towers = k.get("tower");
            let clickedTower = null;
            for (const t of towers) {
                if (pos.dist(t.pos) < TILE_SIZE / 2 + 4) {
                    clickedTower = t;
                    break;
                }
            }
            if (clickedTower) {
                state.selectedTower = clickedTower;
                showSelectedRange(clickedTower);
            } else {
                state.selectedTower = null;
                clearSelectedRange();
            }
        }
    });

    // Right click: cancel placement or deselect
    k.onMousePress("right", () => {
        if (state.placingType) {
            state.placingType = null;
            clearGhost();
        } else if (state.selectedTower) {
            state.selectedTower = null;
            clearSelectedRange();
        }
    });

    // Escape: cancel placement
    k.onKeyPress("escape", () => {
        if (state.placingType) {
            state.placingType = null;
            clearGhost();
        } else if (state.selectedTower) {
            state.selectedTower = null;
            clearSelectedRange();
        }
    });

    // Hotkey 1: select archer tower for placement
    k.onKeyPress("1", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.placingType === "archer") {
            state.placingType = null;
            clearGhost();
        } else {
            state.selectedTower = null;
            clearSelectedRange();
            state.placingType = "archer";
        }
    });

    // Listen for placement cancellation from other modules
    events.on('placementCancelled', () => {
        clearGhost();
    });
}

function createTower(type, col, row) {
    const def = TOWER_DEFS[type];
    const { x, y } = gridToWorld(col, row);

    // Tower base
    const tower = k.add([
        k.pos(x, y),
        k.rect(TILE_SIZE - 6, TILE_SIZE - 6, { radius: 4 }),
        k.color(def.color.r, def.color.g, def.color.b),
        k.outline(2, k.rgb(
            Math.max(0, def.color.r - 30),
            Math.max(0, def.color.g - 30),
            Math.max(0, def.color.b - 30),
        )),
        k.anchor("center"),
        k.area(),
        k.z(5),
        "tower",
    ]);

    // Store tower data
    tower.towerType = type;
    tower.gridCol = col;
    tower.gridRow = row;
    tower.damage = def.damage;
    tower.range = def.range;
    tower.attackSpeed = def.attackSpeed;
    tower.projectileSpeed = def.projectileSpeed;
    tower.cooldown = 0;
    tower.target = null;

    // Turret (inner circle)
    tower.add([
        k.circle(7),
        k.color(
            Math.min(255, def.color.r + 40),
            Math.min(255, def.color.g + 40),
            Math.min(255, def.color.b + 40),
        ),
        k.outline(1, k.rgb(def.color.r, def.color.g, def.color.b)),
        k.anchor("center"),
        k.pos(0, 0),
    ]);

    // Stone corners (decorative)
    const cornerOff = 11;
    const cornerSize = 5;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        tower.add([
            k.rect(cornerSize, cornerSize, { radius: 1 }),
            k.color(
                Math.max(0, def.color.r - 15),
                Math.max(0, def.color.g - 15),
                Math.max(0, def.color.b - 15),
            ),
            k.anchor("center"),
            k.pos(dx * cornerOff, dy * cornerOff),
        ]);
    }

    // Tower update: find target and attack
    tower.onUpdate(() => {
        tower.cooldown -= k.dt();

        if (tower.cooldown <= 0) {
            const target = findTarget(tower);
            if (target) {
                fireProjectile(tower, target);
                tower.cooldown = 1 / tower.attackSpeed;
            }
        }
    });

    state.occupyCell(col, row);
    events.emit('towerPlaced', tower);
    return tower;
}

function findTarget(tower) {
    const enemies = k.get("enemy");
    let bestTarget = null;
    let bestProgress = -1;

    for (const enemy of enemies) {
        if (!enemy.exists()) continue;
        const dist = tower.pos.dist(enemy.pos);
        if (dist <= tower.range) {
            // "First" targeting: highest path progress
            if (enemy.pathProgress > bestProgress) {
                bestProgress = enemy.pathProgress;
                bestTarget = enemy;
            }
        }
    }
    return bestTarget;
}

function fireProjectile(tower, target) {
    const proj = k.add([
        k.pos(tower.pos.x, tower.pos.y),
        k.circle(3),
        k.color(220, 200, 80),
        k.outline(1, k.rgb(180, 160, 40)),
        k.anchor("center"),
        k.z(20),
        "projectile",
    ]);

    proj.damage = tower.damage;
    proj.speed = tower.projectileSpeed;
    proj.targetRef = target;

    proj.onUpdate(() => {
        // If target is gone, remove projectile
        if (!proj.targetRef || !proj.targetRef.exists()) {
            proj.destroy();
            return;
        }

        const dir = proj.targetRef.pos.sub(proj.pos);
        const dist = dir.len();

        if (dist < 8) {
            // Hit
            proj.targetRef.hp -= proj.damage;
            events.emit('enemyDamaged', proj.targetRef);
            proj.destroy();
            return;
        }

        const move = dir.unit().scale(proj.speed * k.dt());
        proj.pos = proj.pos.add(move);
    });
}

// Placement ghost
function updateGhost(mousePos) {
    if (!state.placingType) {
        clearGhost();
        return;
    }
    if (!isInGrid(mousePos.x, mousePos.y)) {
        clearGhost();
        return;
    }

    const { col, row } = worldToGrid(mousePos.x, mousePos.y);
    const { x, y } = gridToWorld(col, row);
    const canBuild = isBuildable(col, row);
    const def = TOWER_DEFS[state.placingType];

    clearGhost();

    // Range circle
    const rangeColor = canBuild ? COLORS.validPlace : COLORS.invalidPlace;
    rangeObj = k.add([
        k.pos(x, y),
        k.circle(def.range),
        k.color(rangeColor.r, rangeColor.g, rangeColor.b),
        k.opacity(0.12),
        k.anchor("center"),
        k.z(3),
        "ghost",
    ]);

    // Ghost tower
    ghostObj = k.add([
        k.pos(x, y),
        k.rect(TILE_SIZE - 6, TILE_SIZE - 6, { radius: 4 }),
        k.color(canBuild ? COLORS.validPlace.r : COLORS.invalidPlace.r,
                canBuild ? COLORS.validPlace.g : COLORS.invalidPlace.g,
                canBuild ? COLORS.validPlace.b : COLORS.invalidPlace.b),
        k.opacity(0.6),
        k.anchor("center"),
        k.z(25),
        "ghost",
    ]);
}

function clearGhost() {
    if (ghostObj) { ghostObj.destroy(); ghostObj = null; }
    if (rangeObj) { rangeObj.destroy(); rangeObj = null; }
}

// Hover range display for existing towers
function updateHoverRange(mousePos) {
    if (state.placingType || state.selectedTower) return;

    if (!isInGrid(mousePos.x, mousePos.y)) {
        clearSelectedRange();
        return;
    }

    const towers = k.get("tower");
    let hovered = null;
    for (const t of towers) {
        if (mousePos.dist(t.pos) < TILE_SIZE / 2 + 4) {
            hovered = t;
            break;
        }
    }

    if (hovered) {
        showSelectedRange(hovered);
    } else if (!state.selectedTower) {
        clearSelectedRange();
    }
}

function showSelectedRange(tower) {
    clearSelectedRange();
    selectedRangeObj = k.add([
        k.pos(tower.pos.x, tower.pos.y),
        k.circle(tower.range),
        k.color(180, 200, 255),
        k.opacity(0.12),
        k.anchor("center"),
        k.z(3),
        "rangeIndicator",
    ]);
}

function clearSelectedRange() {
    if (selectedRangeObj) {
        selectedRangeObj.destroy();
        selectedRangeObj = null;
    }
}
