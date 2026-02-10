import { ENEMY_DEFS } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { worldPath } from './map.js';

let k;

export function initEnemies(kaplay) {
    k = kaplay;

    // When an enemy takes damage, check if it died
    events.on('enemyDamaged', (enemy) => {
        if (!enemy.exists()) return;
        if (enemy.hp <= 0) {
            killEnemy(enemy);
        } else {
            // Update HP bar
            updateHPBar(enemy);
            // Flash white on hit
            flashEnemy(enemy);
        }
    });
}

export function spawnEnemy(type) {
    const def = ENEMY_DEFS[type];
    const start = worldPath[0];

    const enemy = k.add([
        k.pos(start.x, start.y),
        k.circle(def.size),
        k.color(def.color.r, def.color.g, def.color.b),
        k.outline(2, k.rgb(
            Math.max(0, def.color.r - 60),
            Math.max(0, def.color.g - 60),
            Math.max(0, def.color.b - 60),
        )),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "enemy",
    ]);

    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.speed = def.speed;
    enemy.originalSpeed = def.speed; // Store for slow effects
    enemy.armor = def.armor || 0;
    enemy.reward = def.reward;
    enemy.damage = def.damage;
    enemy.enemyType = type;
    enemy.waypointIdx = 1;
    enemy.pathProgress = 0;
    enemy.flashTimer = 0;

    // Add unique visual features based on enemy type
    if (type === "tank") {
        // Tank: Armored look with square plating
        enemy.add([
            k.rect(def.size * 1.2, def.size * 1.2),
            k.color(60, 60, 60),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
        enemy.add([
            k.rect(def.size * 0.8, def.size * 0.8),
            k.color(def.color.r, def.color.g, def.color.b),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
    } else if (type === "boss") {
        // Boss: Large with pulsing crown/spikes
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const spikeX = Math.cos(angle) * (def.size - 4);
            const spikeY = Math.sin(angle) * (def.size - 4);
            enemy.add([
                k.circle(4),
                k.color(255, 200, 50),
                k.anchor("center"),
                k.pos(spikeX, spikeY),
            ]);
        }
        enemy.add([
            k.circle(def.size - 6),
            k.color(
                Math.min(255, def.color.r + 50),
                Math.max(0, def.color.g - 20),
                Math.min(255, def.color.b + 50),
            ),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
    } else if (type === "speedster") {
        // Speedster: Streamlined with trail marks
        enemy.add([
            k.circle(def.size - 2),
            k.color(255, 255, 100),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
    } else {
        // Default inner detail shape for scout and soldier
        enemy.add([
            k.circle(def.size - 4),
            k.color(
                Math.min(255, def.color.r + 50),
                Math.min(255, def.color.g + 20),
                Math.min(255, def.color.b + 20),
            ),
            k.anchor("center"),
            k.pos(0, 0),
        ]);
    }

    // Direction indicator (small triangle-like dot at front)
    const dotSize = type === "boss" ? 5 : 3;
    enemy.dirDot = enemy.add([
        k.circle(dotSize),
        k.color(255, 255, 200),
        k.anchor("center"),
        k.pos(def.size - 2, 0),
    ]);

    // HP bar background
    const barWidth = def.size * 2.5;
    enemy.add([
        k.rect(barWidth + 2, 5),
        k.color(30, 30, 30),
        k.anchor("center"),
        k.pos(0, -(def.size + 8)),
    ]);

    // HP bar fill
    enemy.hpBar = enemy.add([
        k.rect(barWidth, 3),
        k.color(50, 200, 50),
        k.anchor("left"),
        k.pos(-barWidth / 2, -(def.size + 8)),
    ]);
    enemy.hpBarWidth = barWidth;

    // Movement logic
    enemy.onUpdate(() => {
        if (enemy.waypointIdx >= worldPath.length) {
            enemyReachedEnd(enemy);
            return;
        }

        const target = worldPath[enemy.waypointIdx];
        const dir = k.vec2(target.x - enemy.pos.x, target.y - enemy.pos.y);
        const dist = dir.len();

        if (dist < 2) {
            enemy.waypointIdx++;
            return;
        }

        const normalized = dir.unit();
        const movement = normalized.scale(enemy.speed * k.dt());
        enemy.pos = enemy.pos.add(movement);
        enemy.pathProgress += enemy.speed * k.dt();

        // Update direction indicator
        if (enemy.dirDot) {
            enemy.dirDot.pos = normalized.scale(def.size - 2);
        }

        // Flash timer
        if (enemy.flashTimer > 0) {
            enemy.flashTimer -= k.dt();
            if (enemy.flashTimer <= 0) {
                enemy.color = k.rgb(def.color.r, def.color.g, def.color.b);
            }
        }

        // Slow effect expiration
        if (enemy.slowedUntil && k.time() > enemy.slowedUntil) {
            enemy.speed = enemy.originalSpeed;
            enemy.slowedUntil = null;
            if (enemy.slowIndicator && enemy.slowIndicator.exists()) {
                enemy.slowIndicator.destroy();
                enemy.slowIndicator = null;
            }
        }
    });

    state.enemiesAlive++;
    events.emit('enemySpawned', enemy);
    return enemy;
}

function updateHPBar(enemy) {
    if (!enemy.hpBar || !enemy.hpBar.exists()) return;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpBar.width = enemy.hpBarWidth * ratio;

    // Color: green → yellow → red
    if (ratio > 0.6) {
        enemy.hpBar.color = k.rgb(50, 200, 50);
    } else if (ratio > 0.3) {
        enemy.hpBar.color = k.rgb(220, 200, 40);
    } else {
        enemy.hpBar.color = k.rgb(220, 50, 40);
    }
}

function flashEnemy(enemy) {
    enemy.color = k.rgb(255, 255, 255);
    enemy.flashTimer = 0.08;
}

function killEnemy(enemy) {
    state.earn(enemy.reward);
    state.enemiesAlive--;

    // Death particles
    spawnDeathParticles(enemy.pos.x, enemy.pos.y, enemy.enemyType);

    enemy.destroy();
    events.emit('enemyKilled', enemy);
}

function enemyReachedEnd(enemy) {
    state.lives -= enemy.damage;
    state.enemiesAlive--;
    enemy.destroy();
    events.emit('enemyReachedEnd', enemy);
}

function spawnDeathParticles(x, y, type) {
    const def = ENEMY_DEFS[type];
    const count = 6;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 60 + Math.random() * 40;
        const particle = k.add([
            k.pos(x, y),
            k.circle(2 + Math.random() * 2),
            k.color(def.color.r, def.color.g, def.color.b),
            k.opacity(1),
            k.anchor("center"),
            k.z(30),
        ]);

        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        particle.onUpdate(() => {
            particle.pos = particle.pos.add(k.vec2(vx * k.dt(), vy * k.dt()));
            particle.opacity -= 2.5 * k.dt();
            if (particle.opacity <= 0) {
                particle.destroy();
            }
        });
    }
}
