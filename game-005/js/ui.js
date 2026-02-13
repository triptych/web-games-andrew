// UI system - HUD, menus, upgrade selection

import { events } from './events.js';
import { state } from './state.js';
import { sounds } from './sounds.js';

let k;
let hudElements = {};

export function initUI(kaplay) {
    k = kaplay;

    createHUD();

    // Listen for level up events
    events.on('playerLevelUp', (level) => {
        sounds.levelUp();
        // TODO: Show upgrade selection UI
    });

    // Listen for player death
    events.on('playerDied', () => {
        state.isGameOver = true;
        showGameOver();
    });

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
