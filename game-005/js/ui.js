// UI system - HUD, menus, upgrade selection

import { events } from './events.js';
import { state } from './state.js';
import { sounds } from './sounds.js';
import { getRandomUpgrades } from './upgrades.js';

let k;
let hudElements = {};
let unsubscribeCallbacks = [];
let upgradeUIElements = [];

export function initUI(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];
    upgradeUIElements = [];

    createHUD();

    // Listen for level up events
    const levelUpUnsub = events.on('playerLevelUp', (level) => {
        sounds.levelUp();
        showUpgradeSelection();
    });
    unsubscribeCallbacks.push(levelUpUnsub);

    // Listen for player death
    const playerDiedUnsub = events.on('playerDied', () => {
        state.isGameOver = true;
        showGameOver();
    });
    unsubscribeCallbacks.push(playerDiedUnsub);

    // Listen for wave changes
    const waveChangedUnsub = events.on('waveChanged', (waveNumber) => {
        showWaveComplete(waveNumber);
    });
    unsubscribeCallbacks.push(waveChangedUnsub);

    // Update HUD
    k.onUpdate(() => {
        updateHUD();
    });
}

function createHUD() {
    // Health bar background
    hudElements.hpBarBg = k.add([
        k.rect(300, 20),
        k.pos(20, 20),
        k.color(50, 50, 50),
        k.outline(2, k.rgb(100, 100, 100)),
        k.z(1000),
        k.fixed(),
    ]);

    // Health bar fill
    hudElements.hpBar = k.add([
        k.rect(300, 20),
        k.pos(20, 20),
        k.color(255, 50, 50),
        k.z(1001),
        k.fixed(),
    ]);

    // Health text
    hudElements.hpText = k.add([
        k.text("HP: 100/100", { size: 16 }),
        k.pos(30, 23),
        k.color(255, 255, 255),
        k.z(1002),
        k.fixed(),
    ]);

    // XP bar background
    hudElements.xpBarBg = k.add([
        k.rect(k.width() - 40, 15),
        k.pos(20, k.height() - 35),
        k.color(30, 30, 50),
        k.outline(2, k.rgb(100, 100, 150)),
        k.z(1000),
        k.fixed(),
    ]);

    // XP bar fill
    hudElements.xpBar = k.add([
        k.rect(0, 15),
        k.pos(20, k.height() - 35),
        k.color(50, 255, 150),
        k.z(1001),
        k.fixed(),
    ]);

    // Level text
    hudElements.levelText = k.add([
        k.text("Level 1", { size: 18 }),
        k.pos(20, k.height() - 60),
        k.color(255, 255, 255),
        k.z(1002),
        k.fixed(),
    ]);

    // Timer
    hudElements.timerText = k.add([
        k.text("0:00", { size: 24 }),
        k.pos(k.width() / 2, 20),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(1002),
        k.fixed(),
    ]);

    // Kill counter
    hudElements.killText = k.add([
        k.text("Kills: 0", { size: 20 }),
        k.pos(k.width() - 20, 20),
        k.anchor("right"),
        k.color(255, 255, 255),
        k.z(1002),
        k.fixed(),
    ]);

    // Wave counter
    hudElements.waveText = k.add([
        k.text("Wave 1", { size: 20 }),
        k.pos(k.width() - 20, 50),
        k.anchor("right"),
        k.color(100, 200, 255),
        k.z(1002),
        k.fixed(),
    ]);
}

function updateHUD() {
    const player = state.player;
    if (!player || !player.exists()) return;

    // Update health bar
    const hpPercent = player.hp / player.maxHp;
    hudElements.hpBar.width = 300 * hpPercent;
    hudElements.hpText.text = `HP: ${Math.ceil(player.hp)}/${player.maxHp}`;

    // Update XP bar
    const xpPercent = player.xp / player.xpToNext;
    hudElements.xpBar.width = (k.width() - 40) * xpPercent;

    // Update level text
    hudElements.levelText.text = `Level ${player.level}`;

    // Update timer
    const minutes = Math.floor(state.timeAlive / 60);
    const seconds = Math.floor(state.timeAlive % 60);
    hudElements.timerText.text = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update kill counter
    hudElements.killText.text = `Kills: ${state.kills}`;

    // Update wave counter
    hudElements.waveText.text = `Wave ${state.currentWave}`;
}

function showGameOver() {
    // Darken background
    k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.7),
        k.z(2000),
        k.fixed(),
    ]);

    // Game Over text
    k.add([
        k.text("GAME OVER", { size: 64 }),
        k.pos(k.width() / 2, k.height() / 2 - 100),
        k.anchor("center"),
        k.color(255, 50, 50),
        k.z(2001),
        k.fixed(),
    ]);

    // Stats
    const minutes = Math.floor(state.timeAlive / 60);
    const seconds = Math.floor(state.timeAlive % 60);
    const timeText = `Time Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`;

    k.add([
        k.text(timeText, { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(2001),
        k.fixed(),
    ]);

    k.add([
        k.text(`Kills: ${state.kills}`, { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 40),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(2001),
        k.fixed(),
    ]);

    k.add([
        k.text(`Level Reached: ${state.player.level}`, { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 80),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(2001),
        k.fixed(),
    ]);

    // Restart prompt
    k.add([
        k.text("Press R to Restart", { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 140),
        k.anchor("center"),
        k.color(200, 200, 200),
        k.z(2001),
        k.fixed(),
    ]);

    // Listen for restart
    k.onKeyPress("r", () => {
        k.go("game");
    });
}

function showWaveComplete(nextWave) {
    // Create wave complete message
    const waveMsg = k.add([
        k.text(`WAVE ${nextWave - 1} COMPLETE`, { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(100, 255, 150),
        k.opacity(1),
        k.z(1500),
        k.fixed(),
    ]);

    const nextWaveMsg = k.add([
        k.text(`Wave ${nextWave} starting...`, { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 60),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.opacity(1),
        k.z(1500),
        k.fixed(),
    ]);

    // Fade out and destroy after 1.5 seconds
    setTimeout(() => {
        waveMsg.opacity = 0;
        nextWaveMsg.opacity = 0;
        setTimeout(() => {
            k.destroy(waveMsg);
            k.destroy(nextWaveMsg);
        }, 500);
    }, 1500);
}

function showUpgradeSelection() {
    // Pause the game
    state.isPaused = true;

    // Get random upgrades
    const upgrades = getRandomUpgrades(3);

    // Darken background
    const overlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.8),
        k.z(3000),
        k.fixed(),
    ]);
    upgradeUIElements.push(overlay);

    // Title
    const title = k.add([
        k.text("LEVEL UP!", { size: 56 }),
        k.pos(k.width() / 2, 100),
        k.anchor("center"),
        k.color(100, 255, 150),
        k.z(3001),
        k.fixed(),
    ]);
    upgradeUIElements.push(title);

    // Subtitle
    const subtitle = k.add([
        k.text("Choose an upgrade", { size: 24 }),
        k.pos(k.width() / 2, 160),
        k.anchor("center"),
        k.color(200, 200, 200),
        k.z(3001),
        k.fixed(),
    ]);
    upgradeUIElements.push(subtitle);

    // Display upgrade options
    const cardWidth = 300;
    const cardHeight = 200;
    const cardSpacing = 50;
    const totalWidth = (cardWidth * upgrades.length) + (cardSpacing * (upgrades.length - 1));
    const startX = (k.width() - totalWidth) / 2;
    const startY = k.height() / 2 - 30;

    upgrades.forEach((upgrade, index) => {
        const x = startX + (cardWidth + cardSpacing) * index + cardWidth / 2;
        const y = startY;

        createUpgradeCard(upgrade, x, y, cardWidth, cardHeight);
    });
}

function createUpgradeCard(upgrade, x, y, width, height) {
    const currentLevel = upgrade.getCurrentLevel();

    // Card background
    const cardBg = k.add([
        k.rect(width, height, { radius: 8 }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(40, 40, 60),
        k.outline(3, k.rgb(100, 100, 150)),
        k.z(3001),
        k.area(),
        k.fixed(),
        "upgradeCard",
    ]);
    upgradeUIElements.push(cardBg);

    // Icon
    const icon = k.add([
        k.text(upgrade.icon, { size: 48 }),
        k.pos(x, y - 50),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(3002),
        k.fixed(),
    ]);
    upgradeUIElements.push(icon);

    // Name
    const name = k.add([
        k.text(upgrade.name, { size: 20, width: width - 20 }),
        k.pos(x, y - 10),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(3002),
        k.fixed(),
    ]);
    upgradeUIElements.push(name);

    // Description
    const desc = k.add([
        k.text(upgrade.description, { size: 16, width: width - 40 }),
        k.pos(x, y + 30),
        k.anchor("center"),
        k.color(200, 200, 200),
        k.z(3002),
        k.fixed(),
    ]);
    upgradeUIElements.push(desc);

    // Level indicator
    const levelText = k.add([
        k.text(`Level ${currentLevel} → ${currentLevel + 1}`, { size: 14 }),
        k.pos(x, y + 70),
        k.anchor("center"),
        k.color(100, 200, 255),
        k.z(3002),
        k.fixed(),
    ]);
    upgradeUIElements.push(levelText);

    // Hover effect
    cardBg.onHoverUpdate(() => {
        cardBg.color = k.rgb(60, 60, 90);
        cardBg.outline.color = k.rgb(150, 150, 255);
        k.setCursor("pointer");
    });

    cardBg.onHoverEnd(() => {
        cardBg.color = k.rgb(40, 40, 60);
        cardBg.outline.color = k.rgb(100, 100, 150);
        k.setCursor("default");
    });

    // Click handler
    cardBg.onClick(() => {
        selectUpgrade(upgrade.id);
    });
}

function selectUpgrade(upgradeId) {
    // Play UI sound
    sounds.uiClick();

    // Emit upgrade selected event
    events.emit('upgradeSelected', upgradeId);

    // Clean up upgrade UI
    upgradeUIElements.forEach(elem => {
        if (elem.exists()) {
            k.destroy(elem);
        }
    });
    upgradeUIElements = [];

    // Resume the game
    state.isPaused = false;
}
