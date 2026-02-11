import { TILE_SIZE, TOWER_DEFS, COLORS, TOOLBAR_Y, HUD_HEIGHT, GAME_WIDTH, SELL_REFUND_RATE } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { gridToWorld, worldToGrid, isBuildable, isInGrid } from './map.js';
import { sounds } from './sounds.js';
import { isClickOnUI } from './ui.js';

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

        // Ignore clicks on any UI elements
        if (isClickOnUI(pos.x, pos.y)) return;

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

    // Hotkey U: upgrade selected tower
    k.onKeyPress("u", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.selectedTower) {
            upgradeTower(state.selectedTower);
        }
    });

    // Hotkey S: sell selected tower
    k.onKeyPress("s", () => {
        if (state.isGameOver || state.isVictory) return;
        if (state.selectedTower) {
            sellTower(state.selectedTower);
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

    // Shadow beneath tower
    k.add([
        k.pos(x + 2, y + 3),
        k.rect(TILE_SIZE - 6, TILE_SIZE - 6, { radius: 4 }),
        k.color(0, 0, 0),
        k.opacity(0.3),
        k.anchor("center"),
        k.z(4),
        "towerShadow_" + col + "_" + row,
    ]);

    // Tower base (main body)
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

    // Add gradient effect (lighter top-left)
    tower.add([
        k.rect(TILE_SIZE - 8, TILE_SIZE - 8, { radius: 3 }),
        k.color(
            Math.min(255, def.color.r + 40),
            Math.min(255, def.color.g + 40),
            Math.min(255, def.color.b + 40)
        ),
        k.opacity(0.3),
        k.anchor("center"),
        k.pos(-2, -2),
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
    tower.upgradeLevel = 0;
    tower.totalCost = def.cost; // Track total investment for sell value
    tower.targetingPriority = "first"; // Default targeting

    // Store tower-specific stats for upgrades
    if (def.splashRadius !== undefined) tower.splashRadius = def.splashRadius;
    if (def.chainCount !== undefined) tower.chainCount = def.chainCount;
    if (def.chainRange !== undefined) tower.chainRange = def.chainRange;
    if (def.slowDuration !== undefined) tower.slowDuration = def.slowDuration;
    if (def.slowAmount !== undefined) tower.slowAmount = def.slowAmount;
    if (def.armorPierce !== undefined) tower.armorPierce = def.armorPierce;

    // Tower-specific decorations with rotation capability
    if (type === "archer") {
        // Turret (rotatable part)
        tower.turret = tower.add([
            k.pos(0, 0),
            k.rotate(0),
            k.anchor("center"),
            k.z(1), // Render above tower base
        ]);

        // Turret circle with gradient
        tower.turret.add([
            k.circle(7),
            k.color(
                Math.min(255, def.color.r + 40),
                Math.min(255, def.color.g + 40),
                Math.min(255, def.color.b + 40),
            ),
            k.outline(1, k.rgb(def.color.r, def.color.g, def.color.b)),
            k.anchor("center"),
        ]);

        // Highlight on turret
        tower.turret.add([
            k.circle(3),
            k.color(255, 255, 255),
            k.opacity(0.4),
            k.anchor("center"),
            k.pos(-1, -1),
        ]);

        // Arrow pointing direction
        tower.turret.add([
            k.rect(2, 10, { radius: 1 }),
            k.color(50, 50, 40),
            k.anchor("center"),
            k.pos(0, -8),
        ]);
    } else if (type === "cannon") {
        // Cannon base (non-rotating)
        tower.add([
            k.circle(9),
            k.color(80, 80, 80),
            k.outline(1, k.rgb(50, 50, 50)),
            k.anchor("center"),
        ]);

        // Cannon barrel (rotatable)
        tower.turret = tower.add([
            k.pos(0, 0),
            k.rotate(0),
            k.anchor("center"),
            k.z(1), // Render above tower base
        ]);

        tower.turret.add([
            k.rect(12, 20, { radius: 2 }),
            k.color(70, 70, 70),
            k.outline(1, k.rgb(40, 40, 40)),
            k.anchor("center"),
            k.pos(0, -9),
        ]);

        // Barrel highlight
        tower.turret.add([
            k.rect(4, 16),
            k.color(90, 90, 90),
            k.opacity(0.5),
            k.anchor("center"),
            k.pos(-2, -9),
        ]);
    } else if (type === "mage") {
        // Mage tower - pulsing crystal
        tower.turret = tower.add([
            k.pos(0, -6),
            k.anchor("center"),
            k.z(1), // Render above tower base
        ]);

        // Outer glow
        const outerGlow = tower.turret.add([
            k.circle(10),
            k.color(180, 130, 230),
            k.opacity(0.3),
            k.anchor("center"),
        ]);

        // Crystal orb
        tower.turret.add([
            k.circle(8),
            k.color(180, 130, 230),
            k.outline(2, k.rgb(130, 80, 180)),
            k.anchor("center"),
        ]);

        // Inner bright glow
        tower.turret.add([
            k.circle(5),
            k.color(220, 180, 255),
            k.anchor("center"),
        ]);

        // Pulsing animation
        tower.turret.pulseTime = 0;
        tower.turret.onUpdate(() => {
            tower.turret.pulseTime += k.dt() * 3;
            const scale = 1 + Math.sin(tower.turret.pulseTime) * 0.1;
            outerGlow.scale = k.vec2(scale, scale);
        });

        // Floating arcane symbols
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const symbol = tower.add([
                k.rect(3, 3, { radius: 1 }),
                k.color(200, 150, 220),
                k.anchor("center"),
                k.pos(Math.cos(angle) * 12, Math.sin(angle) * 12),
                k.z(1), // Render above tower base
            ]);
            symbol.orbitAngle = angle;
            symbol.orbitTime = 0;
            symbol.onUpdate(() => {
                symbol.orbitTime += k.dt() * 0.5;
                const newAngle = symbol.orbitAngle + symbol.orbitTime;
                symbol.pos = k.vec2(Math.cos(newAngle) * 12, Math.sin(newAngle) * 12);
            });
        }
    } else if (type === "tesla") {
        // Tesla coil with energy effect
        tower.turret = tower.add([
            k.pos(0, 0),
            k.anchor("center"),
            k.z(1), // Render above tower base
        ]);

        // Base plate
        tower.turret.add([
            k.rect(16, 4, { radius: 1 }),
            k.color(70, 90, 110),
            k.anchor("center"),
            k.pos(0, 8),
        ]);

        // Central rod
        tower.turret.add([
            k.rect(4, 14),
            k.color(80, 100, 120),
            k.anchor("center"),
            k.pos(0, 0),
        ]);

        // Top sphere
        tower.turret.add([
            k.circle(7),
            k.color(120, 180, 240),
            k.outline(2, k.rgb(60, 140, 200)),
            k.anchor("center"),
            k.pos(0, -7),
        ]);

        // Energy glow
        const energyGlow = tower.turret.add([
            k.circle(9),
            k.color(150, 200, 255),
            k.opacity(0.4),
            k.anchor("center"),
            k.pos(0, -7),
        ]);

        // Pulsing energy
        tower.turret.pulseTime = 0;
        tower.turret.onUpdate(() => {
            tower.turret.pulseTime += k.dt() * 4;
            energyGlow.opacity = 0.2 + Math.sin(tower.turret.pulseTime) * 0.2;
        });
    } else if (type === "sniper") {
        // Sniper base
        tower.add([
            k.rect(14, 8, { radius: 2 }),
            k.color(
                Math.max(0, def.color.r - 10),
                Math.max(0, def.color.g - 10),
                Math.max(0, def.color.b - 10),
            ),
            k.anchor("center"),
        ]);

        // Sniper barrel (rotatable)
        tower.turret = tower.add([
            k.pos(0, 0),
            k.rotate(0),
            k.anchor("center"),
            k.z(1), // Render above tower base
        ]);

        // Long barrel
        tower.turret.add([
            k.rect(6, 28, { radius: 1 }),
            k.color(
                Math.max(0, def.color.r - 20),
                Math.max(0, def.color.g - 20),
                Math.max(0, def.color.b - 20),
            ),
            k.anchor("center"),
            k.pos(0, -12),
        ]);

        // Barrel highlight
        tower.turret.add([
            k.rect(2, 24),
            k.color(
                Math.min(255, def.color.r + 20),
                Math.min(255, def.color.g + 20),
                Math.min(255, def.color.b + 20),
            ),
            k.opacity(0.3),
            k.anchor("center"),
            k.pos(-1, -12),
        ]);

        // Scope
        tower.turret.add([
            k.rect(8, 5, { radius: 1 }),
            k.color(40, 60, 80),
            k.outline(1, k.rgb(20, 30, 40)),
            k.anchor("center"),
            k.pos(0, -10),
        ]);

        // Lens glint
        tower.turret.add([
            k.circle(2),
            k.color(150, 200, 255),
            k.opacity(0.6),
            k.anchor("center"),
            k.pos(0, -10),
        ]);

        // Barrel tip
        tower.turret.add([
            k.circle(2),
            k.color(30, 30, 40),
            k.anchor("center"),
            k.pos(0, -26),
        ]);
    }

    // Tower update: find target, rotate, and attack
    tower.onUpdate(() => {
        tower.cooldown -= k.dt();

        const target = findTarget(tower);

        // Rotate turret to face target
        if (target && tower.turret) {
            const angle = Math.atan2(target.pos.y - tower.pos.y, target.pos.x - tower.pos.x);
            // Smooth rotation
            const targetAngle = angle * (180 / Math.PI);
            const currentAngle = tower.turret.angle;
            const angleDiff = targetAngle - currentAngle;
            // Normalize angle difference to -180 to 180
            let normalizedDiff = ((angleDiff + 180) % 360) - 180;
            if (normalizedDiff < -180) normalizedDiff += 360;
            // Rotate smoothly
            const rotateSpeed = 360; // degrees per second
            const maxRotate = rotateSpeed * k.dt();
            if (Math.abs(normalizedDiff) < maxRotate) {
                tower.turret.angle = targetAngle;
            } else {
                tower.turret.angle += Math.sign(normalizedDiff) * maxRotate;
            }
        }

        if (tower.cooldown <= 0 && target) {
            fireProjectile(tower, target);
            tower.cooldown = 1 / tower.attackSpeed;

            // Muzzle flash effect
            createMuzzleFlash(tower);
        }
    });

    state.occupyCell(col, row);
    sounds.placeTower();
    events.emit('towerPlaced', tower);
    return tower;
}

function createProjectileTrail(pos, color, size) {
    const trail = k.add([
        k.pos(pos.x, pos.y),
        k.circle(size * 0.6),
        k.color(color),
        k.opacity(0.6),
        k.anchor("center"),
        k.z(19),
    ]);

    trail.onUpdate(() => {
        trail.opacity -= 3 * k.dt();
        trail.scale = k.vec2(trail.opacity, trail.opacity);
        if (trail.opacity <= 0) trail.destroy();
    });
}

function createMuzzleFlash(tower) {
    if (!tower.turret) return;

    // Get the direction the turret is facing
    const angle = tower.turret.angle * (Math.PI / 180);
    const distance = tower.towerType === "sniper" ? 26 : tower.towerType === "cannon" ? 18 : 12;
    const flashX = Math.cos(angle) * distance;
    const flashY = Math.sin(angle) * distance;

    const flash = k.add([
        k.pos(tower.pos.x + flashX, tower.pos.y + flashY),
        k.circle(6),
        k.color(255, 240, 150),
        k.opacity(0.9),
        k.anchor("center"),
        k.z(25),
    ]);

    flash.onUpdate(() => {
        flash.opacity -= 8 * k.dt();
        flash.scale = k.vec2(flash.opacity * 1.2, flash.opacity * 1.2);
        if (flash.opacity <= 0) flash.destroy();
    });
}

function findTarget(tower) {
    const enemies = k.get("enemy");
    let bestTarget = null;
    let bestValue = null;

    for (const enemy of enemies) {
        if (!enemy.exists()) continue;
        const dist = tower.pos.dist(enemy.pos);
        if (dist <= tower.range) {
            let value;
            switch (tower.targetingPriority) {
                case "first":
                    value = enemy.pathProgress;
                    if (bestValue === null || value > bestValue) {
                        bestValue = value;
                        bestTarget = enemy;
                    }
                    break;
                case "last":
                    value = enemy.pathProgress;
                    if (bestValue === null || value < bestValue) {
                        bestValue = value;
                        bestTarget = enemy;
                    }
                    break;
                case "strongest":
                    value = enemy.hp;
                    if (bestValue === null || value > bestValue) {
                        bestValue = value;
                        bestTarget = enemy;
                    }
                    break;
                case "weakest":
                    value = enemy.hp;
                    if (bestValue === null || value < bestValue) {
                        bestValue = value;
                        bestTarget = enemy;
                    }
                    break;
                default:
                    // Default to first
                    value = enemy.pathProgress;
                    if (bestValue === null || value > bestValue) {
                        bestValue = value;
                        bestTarget = enemy;
                    }
            }
        }
    }
    return bestTarget;
}

function fireProjectile(tower, target) {
    // Tesla uses instant chain lightning, no projectile
    if (tower.towerType === "tesla") {
        fireTeslaLightning(tower, target);
        return;
    }

    // Play shooting sound
    sounds.shoot();

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
    proj.tower = tower; // Store reference to tower for upgraded stats

    proj.trailTimer = 0;
    proj.onUpdate(() => {
        // If target is gone, remove projectile (except cannon which hits ground)
        if (!proj.targetRef || !proj.targetRef.exists()) {
            if (proj.towerType === "cannon" && proj.tower && proj.tower.exists()) {
                // Cannon projectiles explode at last known position
                const lastPos = proj.targetRef ? proj.targetRef.pos : proj.pos;
                createSplashDamage(lastPos, proj.tower.splashRadius, proj.damage);
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

        // Spawn trail particles
        proj.trailTimer += k.dt();
        if (proj.trailTimer > 0.03) {
            proj.trailTimer = 0;
            createProjectileTrail(proj.pos, projColor, projSize);
        }

        // Rotate projectile based on direction (for visual effect)
        proj.angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    });
}

function calculateDamage(baseDamage, target, armorPierce = 0) {
    // Armor reduces damage, but armor pierce reduces the effectiveness of armor
    const effectiveArmor = target.armor * (1 - armorPierce);
    const finalDamage = Math.max(1, baseDamage - effectiveArmor);
    return finalDamage;
}

function handleProjectileHit(proj, target) {
    if (proj.towerType === "cannon" && proj.tower && proj.tower.exists()) {
        // Cannon: splash damage
        createSplashDamage(target.pos, proj.tower.splashRadius, proj.damage);
    } else if (proj.towerType === "mage" && proj.tower && proj.tower.exists()) {
        // Mage: direct damage + slow effect
        const damage = calculateDamage(proj.damage, target);
        target.hp -= damage;
        showDamageNumber(damage, target.pos);
        applySlowEffect(target, proj.tower.slowDuration, proj.tower.slowAmount);
        events.emit('enemyDamaged', target);
    } else if (proj.towerType === "sniper" && proj.tower && proj.tower.exists()) {
        // Sniper: armor-piercing damage
        const damage = calculateDamage(proj.damage, target, proj.tower.armorPierce);
        target.hp -= damage;
        showDamageNumber(damage, target.pos, true); // Critical hit style
        events.emit('enemyDamaged', target);
        // Visual feedback for sniper hit
        createImpactEffect(target.pos, k.rgb(255, 200, 100));
    } else {
        // Archer and others: direct damage
        const damage = calculateDamage(proj.damage, target);
        target.hp -= damage;
        showDamageNumber(damage, target.pos);
        events.emit('enemyDamaged', target);
    }
}

function createSplashDamage(pos, radius, baseDamage) {
    // Visual explosion effect
    createExplosionEffect(pos, radius);

    // Explosion sound
    sounds.enemyHit();

    // Damage all enemies in radius
    const enemies = k.get("enemy");
    for (const enemy of enemies) {
        if (!enemy.exists()) continue;
        const dist = enemy.pos.dist(pos);
        if (dist <= radius) {
            const damage = calculateDamage(baseDamage, enemy);
            enemy.hp -= damage;
            showDamageNumber(damage, enemy.pos);
            events.emit('enemyDamaged', enemy);
        }
    }
}

function showDamageNumber(damage, pos, isCritical = false) {
    const damageNum = k.add([
        k.pos(pos.x + (Math.random() - 0.5) * 10, pos.y - 15),
        k.text(Math.round(damage).toString(), { size: isCritical ? 18 : 14 }),
        k.color(isCritical ? 255 : 255, isCritical ? 200 : 255, isCritical ? 100 : 255),
        k.anchor("center"),
        k.opacity(1),
        k.z(45),
    ]);

    damageNum.startY = damageNum.pos.y;
    damageNum.lifetime = 0;

    damageNum.onUpdate(() => {
        damageNum.lifetime += k.dt();
        // Float upward with slight arc
        damageNum.pos.y = damageNum.startY - damageNum.lifetime * 50;
        damageNum.pos.x += Math.sin(damageNum.lifetime * 3) * 0.5;
        // Scale up then down
        const scaleAmount = isCritical ? 1.3 : 1.0;
        if (damageNum.lifetime < 0.1) {
            damageNum.scale = k.vec2(damageNum.lifetime * 10 * scaleAmount, damageNum.lifetime * 10 * scaleAmount);
        } else {
            damageNum.scale = k.vec2(scaleAmount, scaleAmount);
        }
        // Fade out
        if (damageNum.lifetime > 0.4) {
            damageNum.opacity -= 2.5 * k.dt();
            if (damageNum.opacity <= 0) damageNum.destroy();
        }
    });
}

function createExplosionEffect(pos, radius) {
    // Main explosion
    const explosion = k.add([
        k.pos(pos.x, pos.y),
        k.circle(radius * 0.5),
        k.color(255, 150, 50),
        k.opacity(0.8),
        k.anchor("center"),
        k.z(22),
    ]);
    explosion.startScale = 0.5;
    explosion.onUpdate(() => {
        explosion.startScale += 6 * k.dt();
        explosion.scale = k.vec2(explosion.startScale, explosion.startScale);
        explosion.opacity -= 2.5 * k.dt();
        if (explosion.opacity <= 0) explosion.destroy();
    });

    // Expanding shockwave ring
    const shockwave = k.add([
        k.pos(pos.x, pos.y),
        k.circle(radius * 0.3),
        k.color(255, 200, 100),
        k.opacity(0.8),
        k.anchor("center"),
        k.z(21),
    ]);
    shockwave.startRadius = radius * 0.3;
    shockwave.onDraw(() => {
        k.drawCircle({
            pos: k.vec2(0, 0),
            radius: shockwave.startRadius,
            color: k.rgb(255, 200, 100),
            opacity: shockwave.opacity,
            outline: { color: k.rgb(255, 150, 50), width: 3 },
        });
    });
    shockwave.onUpdate(() => {
        shockwave.startRadius += radius * 3 * k.dt();
        shockwave.opacity -= 2 * k.dt();
        if (shockwave.opacity <= 0) shockwave.destroy();
    });

    // Inner bright flash
    const flash = k.add([
        k.pos(pos.x, pos.y),
        k.circle(radius * 0.4),
        k.color(255, 255, 220),
        k.opacity(1),
        k.anchor("center"),
        k.z(23),
    ]);
    flash.onUpdate(() => {
        flash.opacity -= 6 * k.dt();
        flash.scale = k.vec2(1 + (1 - flash.opacity), 1 + (1 - flash.opacity));
        if (flash.opacity <= 0) flash.destroy();
    });

    // Explosion particles
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = 60 + Math.random() * 40;
        const particle = k.add([
            k.pos(pos.x, pos.y),
            k.circle(3 + Math.random() * 2),
            k.color(255, 150 + Math.random() * 50, 50),
            k.opacity(0.9),
            k.anchor("center"),
            k.z(22),
        ]);

        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        particle.onUpdate(() => {
            particle.pos = particle.pos.add(k.vec2(vx * k.dt(), vy * k.dt()));
            particle.opacity -= 3 * k.dt();
            if (particle.opacity <= 0) particle.destroy();
        });
    }
}

function applySlowEffect(enemy, duration, slowAmount) {
    if (!enemy.originalSpeed) {
        enemy.originalSpeed = enemy.speed;
    }
    enemy.speed = enemy.originalSpeed * (1 - slowAmount);
    enemy.slowedUntil = k.time() + duration;

    // Visual slow indicator - icy particles
    if (!enemy.slowIndicator) {
        enemy.slowIndicator = enemy.add([
            k.pos(0, 0),
            k.anchor("center"),
        ]);

        // Create multiple icy particles around enemy
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const particle = enemy.slowIndicator.add([
                k.circle(3),
                k.color(130, 180, 230),
                k.opacity(0.6),
                k.anchor("center"),
                k.pos(0, 0),
            ]);
            particle.orbitAngle = angle;
            particle.orbitRadius = enemy.size + 5;
            particle.orbitSpeed = -2; // Rotate around enemy

            particle.onUpdate(() => {
                particle.orbitAngle += particle.orbitSpeed * k.dt();
                particle.pos = k.vec2(
                    Math.cos(particle.orbitAngle) * particle.orbitRadius,
                    Math.sin(particle.orbitAngle) * particle.orbitRadius
                );
            });
        }

        // Slow icon above enemy
        const slowIcon = enemy.slowIndicator.add([
            k.text("❄", { size: 12 }),
            k.color(150, 200, 255),
            k.anchor("center"),
            k.pos(0, -enemy.size - 20),
        ]);
        slowIcon.pulseTime = 0;
        slowIcon.onUpdate(() => {
            slowIcon.pulseTime += k.dt() * 3;
            slowIcon.opacity = 0.6 + Math.sin(slowIcon.pulseTime) * 0.4;
        });
    }
}

function fireTeslaLightning(tower, target) {
    const targets = [target];
    const hitPositions = [target.pos];

    // Play tesla sound
    sounds.shoot();

    // Find chain targets
    const enemies = k.get("enemy");
    let currentTarget = target;

    for (let i = 1; i < tower.chainCount; i++) {
        let nextTarget = null;
        let closestDist = Infinity;

        for (const enemy of enemies) {
            if (!enemy.exists() || targets.includes(enemy)) continue;
            const dist = currentTarget.pos.dist(enemy.pos);
            if (dist <= tower.chainRange && dist < closestDist) {
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
        const damage = calculateDamage(tower.damage, t);
        t.hp -= damage;
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

// Upgrade tower
export function upgradeTower(tower) {
    if (!tower || !tower.exists()) return false;

    const def = TOWER_DEFS[tower.towerType];
    if (tower.upgradeLevel >= def.upgrades.length) return false; // Max level reached

    const upgrade = def.upgrades[tower.upgradeLevel];
    if (!state.canAfford(upgrade.cost)) return false;

    // Apply upgrade
    if (!state.spend(upgrade.cost)) return false;

    tower.totalCost += upgrade.cost;
    tower.upgradeLevel++;

    // Apply stat bonuses
    if (upgrade.damageBonus !== undefined) tower.damage += upgrade.damageBonus;
    if (upgrade.rangeBonus !== undefined) tower.range += upgrade.rangeBonus;
    if (upgrade.attackSpeedBonus !== undefined) tower.attackSpeed += upgrade.attackSpeedBonus;
    if (upgrade.splashRadiusBonus !== undefined) tower.splashRadius += upgrade.splashRadiusBonus;
    if (upgrade.chainCountBonus !== undefined) tower.chainCount += upgrade.chainCountBonus;
    if (upgrade.chainRangeBonus !== undefined) tower.chainRange += upgrade.chainRangeBonus;
    if (upgrade.slowAmountBonus !== undefined) tower.slowAmount += upgrade.slowAmountBonus;

    // Visual upgrade effect
    createUpgradeEffect(tower);

    // Play sound
    sounds.placeTower();

    // Update range display if this tower is selected
    if (state.selectedTower === tower) {
        showSelectedRange(tower);
    }

    events.emit('towerUpgraded', tower);
    return true;
}

// Sell tower
export function sellTower(tower) {
    if (!tower || !tower.exists()) return false;

    const refund = Math.floor(tower.totalCost * SELL_REFUND_RATE);
    state.earn(refund);

    // Free up the cell
    state.freeCell(tower.gridCol, tower.gridRow);

    // Clear selection
    if (state.selectedTower === tower) {
        state.selectedTower = null;
        clearSelectedRange();
    }

    // Remove tower shadow
    const shadowTag = "towerShadow_" + tower.gridCol + "_" + tower.gridRow;
    k.destroyAll(shadowTag);

    // Visual effect
    showFloatingText("+" + refund, tower.pos.x, tower.pos.y, COLORS.goldText);

    // Play sound
    sounds.uiClick();

    tower.destroy();
    events.emit('towerSold', tower);
    return true;
}

// Set tower targeting priority
export function setTargetingPriority(tower, priority) {
    if (!tower || !tower.exists()) return;
    tower.targetingPriority = priority;
    events.emit('targetingChanged', tower);
}

// Create upgrade visual effect
function createUpgradeEffect(tower) {
    const particles = 12;
    for (let i = 0; i < particles; i++) {
        const angle = (Math.PI * 2 * i) / particles;
        const dist = 25;
        const particle = k.add([
            k.pos(tower.pos.x + Math.cos(angle) * dist, tower.pos.y + Math.sin(angle) * dist),
            k.circle(3),
            k.color(255, 220, 100),
            k.opacity(1),
            k.anchor("center"),
            k.z(30),
        ]);

        particle.onUpdate(() => {
            particle.pos = particle.pos.add(k.vec2(Math.cos(angle) * 60 * k.dt(), Math.sin(angle) * 60 * k.dt()));
            particle.opacity -= 3 * k.dt();
            if (particle.opacity <= 0) particle.destroy();
        });
    }
}

// Helper function to show floating text (moved from ui.js for tower sell)
function showFloatingText(str, x, y, colorDef) {
    const ft = k.add([
        k.pos(x, y - 10),
        k.text(str, { size: 14 }),
        k.color(colorDef.r, colorDef.g, colorDef.b),
        k.anchor("center"),
        k.opacity(1),
        k.z(40),
    ]);
    ft.onUpdate(() => {
        ft.pos = ft.pos.add(k.vec2(0, -40 * k.dt()));
        ft.opacity -= 1.5 * k.dt();
        if (ft.opacity <= 0) ft.destroy();
    });
}
