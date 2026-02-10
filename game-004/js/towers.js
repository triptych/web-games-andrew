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

    // Hotkey 2: select cannon tower
    k.onKeyPress("2", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.placingType === "cannon") {
            state.placingType = null;
            clearGhost();
        } else {
            state.selectedTower = null;
            clearSelectedRange();
            state.placingType = "cannon";
        }
    });

    // Hotkey 3: select mage tower
    k.onKeyPress("3", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.placingType === "mage") {
            state.placingType = null;
            clearGhost();
        } else {
            state.selectedTower = null;
            clearSelectedRange();
            state.placingType = "mage";
        }
    });

    // Hotkey 4: select tesla tower
    k.onKeyPress("4", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.placingType === "tesla") {
            state.placingType = null;
            clearGhost();
        } else {
            state.selectedTower = null;
            clearSelectedRange();
            state.placingType = "tesla";
        }
    });

    // Hotkey 5: select sniper tower
    k.onKeyPress("5", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.placingType === "sniper") {
            state.placingType = null;
            clearGhost();
        } else {
            state.selectedTower = null;
            clearSelectedRange();
            state.placingType = "sniper";
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

    // Tower-specific decorations
    if (type === "archer") {
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
        // Arrow slits
        for (const dx of [-8, 8]) {
            tower.add([
                k.rect(3, 8),
                k.color(30, 40, 30),
                k.anchor("center"),
                k.pos(dx, 0),
            ]);
        }
    } else if (type === "cannon") {
        // Large cannon barrel
        tower.add([
            k.rect(12, 18, { radius: 2 }),
            k.color(70, 70, 70),
            k.outline(1, k.rgb(40, 40, 40)),
            k.anchor("center"),
            k.pos(0, -8),
        ]);
        // Cannon base
        tower.add([
            k.circle(9),
            k.color(80, 80, 80),
            k.outline(1, k.rgb(50, 50, 50)),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
    } else if (type === "mage") {
        // Crystal/orb on top
        tower.add([
            k.circle(8),
            k.color(180, 130, 230),
            k.outline(2, k.rgb(130, 80, 180)),
            k.anchor("center"),
            k.pos(0, -6),
        ]);
        // Inner glow
        tower.add([
            k.circle(5),
            k.color(220, 180, 255),
            k.anchor("center"),
            k.pos(0, -6),
        ]);
        // Small arcane symbols
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            tower.add([
                k.rect(2, 2),
                k.color(200, 150, 220),
                k.anchor("center"),
                k.pos(Math.cos(angle) * 10, Math.sin(angle) * 10),
            ]);
        }
    } else if (type === "tesla") {
        // Tesla coil - top sphere
        tower.add([
            k.circle(7),
            k.color(120, 180, 240),
            k.outline(2, k.rgb(60, 140, 200)),
            k.anchor("center"),
            k.pos(0, -7),
        ]);
        // Central rod
        tower.add([
            k.rect(4, 14),
            k.color(80, 100, 120),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
        // Base plate
        tower.add([
            k.rect(16, 4, { radius: 1 }),
            k.color(70, 90, 110),
            k.anchor("center"),
            k.pos(0, 8),
        ]);
    } else if (type === "sniper") {
        // Long barrel
        tower.add([
            k.rect(6, 24, { radius: 1 }),
            k.color(
                Math.max(0, def.color.r - 20),
                Math.max(0, def.color.g - 20),
                Math.max(0, def.color.b - 20),
            ),
            k.anchor("center"),
            k.pos(0, -10),
        ]);
        // Scope
        tower.add([
            k.rect(8, 4, { radius: 1 }),
            k.color(40, 60, 80),
            k.outline(1, k.rgb(20, 30, 40)),
            k.anchor("center"),
            k.pos(0, -8),
        ]);
        // Barrel tip
        tower.add([
            k.circle(2),
            k.color(30, 30, 40),
            k.anchor("center"),
            k.pos(0, -22),
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
    const def = TOWER_DEFS[tower.towerType];

    // Tesla uses instant chain lightning, no projectile
    if (tower.towerType === "tesla") {
        fireTeslaLightning(tower, target, def);
        return;
    }

    // Create projectile based on tower type
    let projColor, projOutline, projSize;

    if (tower.towerType === "archer") {
        projColor = k.rgb(220, 200, 80);
        projOutline = k.rgb(180, 160, 40);
        projSize = 3;
    } else if (tower.towerType === "cannon") {
        projColor = k.rgb(80, 80, 80);
        projOutline = k.rgb(50, 50, 50);
        projSize = 6;
    } else if (tower.towerType === "mage") {
        projColor = k.rgb(180, 130, 230);
        projOutline = k.rgb(130, 80, 180);
        projSize = 5;
    } else if (tower.towerType === "sniper") {
        projColor = k.rgb(255, 200, 100);
        projOutline = k.rgb(200, 150, 50);
        projSize = 4;
    }

    const proj = k.add([
        k.pos(tower.pos.x, tower.pos.y),
        k.circle(projSize),
        k.color(projColor),
        k.outline(1, projOutline),
        k.anchor("center"),
        k.z(20),
        "projectile",
    ]);

    proj.damage = tower.damage;
    proj.speed = tower.projectileSpeed;
    proj.targetRef = target;
    proj.towerType = tower.towerType;
    proj.towerDef = def;

    proj.onUpdate(() => {
        // If target is gone, remove projectile (except cannon which hits ground)
        if (!proj.targetRef || !proj.targetRef.exists()) {
            if (proj.towerType === "cannon") {
                // Cannon projectiles explode at last known position
                const lastPos = proj.targetRef ? proj.targetRef.pos : proj.pos;
                createSplashDamage(lastPos, proj.towerDef.splashRadius, proj.damage);
            }
            proj.destroy();
            return;
        }

        const dir = proj.targetRef.pos.sub(proj.pos);
        const dist = dir.len();

        if (dist < 8) {
            // Hit
            handleProjectileHit(proj, proj.targetRef);
            proj.destroy();
            return;
        }

        const move = dir.unit().scale(proj.speed * k.dt());
        proj.pos = proj.pos.add(move);
    });
}

function handleProjectileHit(proj, target) {
    if (proj.towerType === "cannon") {
        // Cannon: splash damage
        createSplashDamage(target.pos, proj.towerDef.splashRadius, proj.damage);
    } else if (proj.towerType === "mage") {
        // Mage: direct damage + slow effect
        target.hp -= proj.damage;
        applySlowEffect(target, proj.towerDef.slowDuration, proj.towerDef.slowAmount);
        events.emit('enemyDamaged', target);
    } else if (proj.towerType === "sniper") {
        // Sniper: armor-piercing damage (for now just direct damage, armor system to be added later)
        target.hp -= proj.damage;
        events.emit('enemyDamaged', target);
        // Visual feedback for sniper hit
        createImpactEffect(target.pos, k.rgb(255, 200, 100));
    } else {
        // Archer and others: direct damage
        target.hp -= proj.damage;
        events.emit('enemyDamaged', target);
    }
}

function createSplashDamage(pos, radius, damage) {
    // Visual explosion effect
    createExplosionEffect(pos, radius);

    // Damage all enemies in radius
    const enemies = k.get("enemy");
    for (const enemy of enemies) {
        if (!enemy.exists()) continue;
        const dist = enemy.pos.dist(pos);
        if (dist <= radius) {
            enemy.hp -= damage;
            events.emit('enemyDamaged', enemy);
        }
    }
}

function createExplosionEffect(pos, radius) {
    const explosion = k.add([
        k.pos(pos.x, pos.y),
        k.circle(radius),
        k.color(255, 150, 50),
        k.opacity(0.6),
        k.anchor("center"),
        k.z(22),
    ]);
    explosion.onUpdate(() => {
        explosion.opacity -= 3 * k.dt();
        if (explosion.opacity <= 0) explosion.destroy();
    });
    // Inner bright flash
    const flash = k.add([
        k.pos(pos.x, pos.y),
        k.circle(radius * 0.5),
        k.color(255, 220, 100),
        k.opacity(1),
        k.anchor("center"),
        k.z(23),
    ]);
    flash.onUpdate(() => {
        flash.opacity -= 5 * k.dt();
        if (flash.opacity <= 0) flash.destroy();
    });
}

function applySlowEffect(enemy, duration, slowAmount) {
    if (!enemy.originalSpeed) {
        enemy.originalSpeed = enemy.speed;
    }
    enemy.speed = enemy.originalSpeed * (1 - slowAmount);
    enemy.slowedUntil = k.time() + duration;

    // Visual slow indicator
    if (!enemy.slowIndicator) {
        enemy.slowIndicator = enemy.add([
            k.circle(6),
            k.color(130, 80, 180),
            k.opacity(0.3),
            k.anchor("center"),
            k.pos(0, -enemy.size - 8),
        ]);
    }
}

function fireTeslaLightning(tower, target, def) {
    const targets = [target];
    const hitPositions = [target.pos];

    // Find chain targets
    const enemies = k.get("enemy");
    let currentTarget = target;

    for (let i = 1; i < def.chainCount; i++) {
        let nextTarget = null;
        let closestDist = Infinity;

        for (const enemy of enemies) {
            if (!enemy.exists() || targets.includes(enemy)) continue;
            const dist = currentTarget.pos.dist(enemy.pos);
            if (dist <= def.chainRange && dist < closestDist) {
                closestDist = dist;
                nextTarget = enemy;
            }
        }

        if (nextTarget) {
            targets.push(nextTarget);
            hitPositions.push(nextTarget.pos);
            currentTarget = nextTarget;
        } else {
            break;
        }
    }

    // Deal damage to all targets
    for (const t of targets) {
        t.hp -= tower.damage;
        events.emit('enemyDamaged', t);
    }

    // Visual lightning effect
    createLightningEffect(tower.pos, hitPositions);
}

function createLightningEffect(startPos, targetPositions) {
    // Draw lightning bolts between positions
    for (let i = 0; i < targetPositions.length; i++) {
        const start = i === 0 ? startPos : targetPositions[i - 1];
        const end = targetPositions[i];

        const bolt = k.add([
            k.pos(start.x, start.y),
            k.color(120, 180, 255),
            k.opacity(0.8),
            k.z(21),
        ]);

        const dist = start.dist(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        bolt.onDraw(() => {
            k.drawLine({
                p1: k.vec2(0, 0),
                p2: k.vec2(Math.cos(angle) * dist, Math.sin(angle) * dist),
                width: 3,
                color: k.rgb(150, 200, 255),
            });
        });

        bolt.onUpdate(() => {
            bolt.opacity -= 6 * k.dt();
            if (bolt.opacity <= 0) bolt.destroy();
        });

        // Lightning spark at target
        const spark = k.add([
            k.pos(end.x, end.y),
            k.circle(8),
            k.color(150, 200, 255),
            k.opacity(0.7),
            k.anchor("center"),
            k.z(22),
        ]);
        spark.onUpdate(() => {
            spark.opacity -= 4 * k.dt();
            if (spark.opacity <= 0) spark.destroy();
        });
    }
}

function createImpactEffect(pos, color) {
    const impact = k.add([
        k.pos(pos.x, pos.y),
        k.circle(12),
        k.color(color),
        k.opacity(0.6),
        k.anchor("center"),
        k.z(22),
    ]);
    impact.onUpdate(() => {
        impact.opacity -= 4 * k.dt();
        if (impact.opacity <= 0) impact.destroy();
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
