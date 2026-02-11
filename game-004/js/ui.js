import {
    GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, TOOLBAR_Y, TOOLBAR_HEIGHT,
    TOWER_DEFS, COLORS, WAVE_DEFS, ENEMY_DEFS, SELL_REFUND_RATE, TARGETING_PRIORITIES,
} from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { startNextWave } from './waves.js';
import { sounds, toggleSound, isSoundEnabled } from './sounds.js';
import { upgradeTower, sellTower, setTargetingPriority } from './towers.js';

let k;
let goldText, livesText, waveText, startBtnText;
let overlayObj = null;
let bossBanner = null;
let wavePreviewContainer = null;
let lastGold = -1, lastLives = -1, lastWave = -1;
let goldTextPos, livesTextPos, waveTextPos; // Store positions for recreating text
let towerInfoPanel = null; // Tower info panel container

/**
 * UI BOUNDS - Centralized Event Delegation System
 *
 * This object defines the clickable bounds of all UI panels in the game.
 * When adding new UI elements that should block game clicks:
 *
 * 1. Add the bounds here with accurate left, right, top, bottom values
 * 2. Add a check in isClickOnUI() function below
 * 3. If the element can be hidden, add a visibility flag and check it
 *
 * This prevents UI buttons from being intercepted by global game click handlers.
 * All bounds should match the actual k.add([k.pos(...)]) positions in the code.
 */
export const UI_BOUNDS = {
    towerInfo: {
        left: 20,
        right: 220, // 20 + 200 (panelWidth)
        top: HUD_HEIGHT + 80,
        bottom: HUD_HEIGHT + 80 + 340,
    },
    towerMenu: {
        left: GAME_WIDTH - 158, // GAME_WIDTH - 150 - 8 (padding)
        right: GAME_WIDTH - 12,  // GAME_WIDTH - 20 + 8 (padding)
        top: HUD_HEIGHT + 72,    // HUD_HEIGHT + 80 - 8 (padding)
        bottom: GAME_HEIGHT - 20, // Extends to near bottom
    },
};

/**
 * Helper function to check if a click position is within any UI area.
 * This centralizes UI click detection to prevent game clicks from interfering with UI buttons.
 *
 * To add new UI elements:
 * 1. Add bounds to UI_BOUNDS object above
 * 2. Add a check here (with visibility condition if element can be hidden)
 * 3. All global click handlers will automatically respect the new UI element
 *
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @returns {boolean} - True if click is on any UI element
 */
export function isClickOnUI(x, y) {
    // Check HUD top bar
    if (y < HUD_HEIGHT) return true;

    // Check bottom toolbar
    if (y >= TOOLBAR_Y) return true;

    // Check tower info panel (only when visible)
    if (towerInfoPanel) {
        const bounds = UI_BOUNDS.towerInfo;
        if (x >= bounds.left && x <= bounds.right &&
            y >= bounds.top && y <= bounds.bottom) {
            return true;
        }
    }

    // Check tower menu panel (right side - always visible)
    const menuBounds = UI_BOUNDS.towerMenu;
    if (x >= menuBounds.left && x <= menuBounds.right &&
        y >= menuBounds.top && y <= menuBounds.bottom) {
        return true;
    }

    return false;
}

export function initUI(kaplay) {
    k = kaplay;
    createHUD();
    createToolbar();
    setupClicks();
    listenEvents();

    // Continuously sync HUD text with state (recreate text objects for reliable updates)
    k.onUpdate(() => {
        if (state.gold !== lastGold) {
            lastGold = state.gold;
            if (goldText && goldText.exists()) goldText.destroy();
            goldText = k.add([
                k.pos(goldTextPos.x, goldTextPos.y),
                k.text(String(state.gold), { size: 20 }),
                k.color(255, 255, 255),
                k.anchor("left"),
                k.z(52),
            ]);
            // Refresh tower info panel if tower is selected (to update upgrade button affordability)
            if (state.selectedTower && state.selectedTower.exists()) {
                showTowerInfoPanel(state.selectedTower);
            }
        }
        if (state.lives !== lastLives) {
            lastLives = state.lives;
            if (livesText && livesText.exists()) livesText.destroy();
            livesText = k.add([
                k.pos(livesTextPos.x, livesTextPos.y),
                k.text(String(state.lives), { size: 20 }),
                k.color(255, 255, 255),
                k.anchor("left"),
                k.z(52),
            ]);
        }
        if (state.wave !== lastWave) {
            lastWave = state.wave;
            if (waveText && waveText.exists()) waveText.destroy();

            // Check if current wave is a boss wave
            const isBossWave = state.wave > 0 && WAVE_DEFS[state.wave - 1]?.isBoss;
            const waveLabel = isBossWave ? "BOSS WAVE " + state.wave : "Wave " + state.wave;

            waveText = k.add([
                k.pos(waveTextPos.x, waveTextPos.y),
                k.text(waveLabel + " / " + WAVE_DEFS.length, { size: 18 }),
                k.color(isBossWave ? 255 : 200, isBossWave ? 100 : 200, isBossWave ? 100 : 220),
                k.anchor("center"),
                k.z(52),
            ]);
        }
    });
}

function createHUD() {
    // HUD background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, HUD_HEIGHT),
        k.color(COLORS.hudBg.r, COLORS.hudBg.g, COLORS.hudBg.b),
        k.z(50),
    ]);

    k.add([
        k.pos(0, HUD_HEIGHT - 2),
        k.rect(GAME_WIDTH, 2),
        k.color(80, 90, 110),
        k.z(51),
    ]);

    // Gold icon + text
    k.add([
        k.pos(20, HUD_HEIGHT / 2),
        k.text("$", { size: 22 }),
        k.color(COLORS.goldText.r, COLORS.goldText.g, COLORS.goldText.b),
        k.anchor("left"),
        k.z(52),
    ]);
    goldTextPos = { x: 44, y: HUD_HEIGHT / 2 };
    goldText = k.add([
        k.pos(goldTextPos.x, goldTextPos.y),
        k.text(String(state.gold), { size: 20 }),
        k.color(255, 255, 255),
        k.anchor("left"),
        k.z(52),
    ]);

    // Lives icon + text
    k.add([
        k.pos(180, HUD_HEIGHT / 2),
        k.text("\u2665", { size: 22 }),
        k.color(COLORS.livesText.r, COLORS.livesText.g, COLORS.livesText.b),
        k.anchor("left"),
        k.z(52),
    ]);
    livesTextPos = { x: 204, y: HUD_HEIGHT / 2 };
    livesText = k.add([
        k.pos(livesTextPos.x, livesTextPos.y),
        k.text(String(state.lives), { size: 20 }),
        k.color(255, 255, 255),
        k.anchor("left"),
        k.z(52),
    ]);

    // Wave text
    waveTextPos = { x: GAME_WIDTH / 2, y: HUD_HEIGHT / 2 };
    waveText = k.add([
        k.pos(waveTextPos.x, waveTextPos.y),
        k.text("Wave 0 / " + WAVE_DEFS.length, { size: 18 }),
        k.color(200, 200, 220),
        k.anchor("center"),
        k.z(52),
    ]);

    // Sound toggle button
    const soundBtnSize = 28;
    const soundBtnX = GAME_WIDTH - 260;
    const soundBtnY = HUD_HEIGHT / 2;
    const soundBtn = k.add([
        k.pos(soundBtnX, soundBtnY),
        k.rect(soundBtnSize, soundBtnSize, { radius: 4 }),
        k.color(60, 70, 90),
        k.outline(1, k.rgb(100, 110, 130)),
        k.anchor("center"),
        k.area(),
        k.z(52),
    ]);

    let soundBtnText = k.add([
        k.pos(soundBtnX, soundBtnY),
        k.text(isSoundEnabled() ? "\u266A" : "\u266B", { size: 18 }),
        k.color(isSoundEnabled() ? 100 : 150, isSoundEnabled() ? 200 : 100, isSoundEnabled() ? 100 : 100),
        k.anchor("center"),
        k.z(53),
    ]);

    soundBtn.onClick(() => {
        const enabled = toggleSound();
        if (soundBtnText && soundBtnText.exists()) soundBtnText.destroy();
        soundBtnText = k.add([
            k.pos(soundBtnX, soundBtnY),
            k.text(enabled ? "\u266A" : "\u266B", { size: 18 }),
            k.color(enabled ? 100 : 150, enabled ? 200 : 100, enabled ? 100 : 100),
            k.anchor("center"),
            k.z(53),
        ]);
        if (enabled) sounds.uiClick();
    });

    // Start wave button (uses Kaplay area click - this works)
    const btnX = GAME_WIDTH - 130;
    const btnW = 120;
    const btnH = 32;

    const startBtn = k.add([
        k.pos(btnX, HUD_HEIGHT / 2),
        k.rect(btnW, btnH, { radius: 6 }),
        k.color(COLORS.startBtn.r, COLORS.startBtn.g, COLORS.startBtn.b),
        k.outline(2, k.rgb(30, 100, 40)),
        k.anchor("center"),
        k.area(),
        k.z(52),
    ]);

    startBtn.baseColor = k.rgb(COLORS.startBtn.r, COLORS.startBtn.g, COLORS.startBtn.b);
    startBtn.hoverColor = k.rgb(
        Math.min(255, COLORS.startBtn.r + 30),
        Math.min(255, COLORS.startBtn.g + 30),
        Math.min(255, COLORS.startBtn.b + 30)
    );

    startBtn.onUpdate(() => {
        if (startBtn.isHovering() && !state.isWaveActive && !state.isGameOver && !state.isVictory) {
            startBtn.color = startBtn.hoverColor;
        } else {
            startBtn.color = startBtn.baseColor;
        }
    });

    startBtnText = k.add([
        k.pos(btnX, HUD_HEIGHT / 2),
        k.text("Start Wave", { size: 14 }),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.z(53),
    ]);
    startBtn.onClick(() => {
        sounds.uiClick();
        startNextWave();
    });
}

function createToolbar() {
    // Floating panel on right side
    const panelWidth = 130;
    const panelX = GAME_WIDTH - panelWidth - 20; // 20px from right edge
    const panelY = HUD_HEIGHT + 80; // Start below HUD with some padding

    const types = Object.entries(TOWER_DEFS);
    const btnW = 120;
    const btnH = 64;
    const btnSpacing = 12;
    const panelPadding = 8;
    const titleSpace = 32;
    const panelHeight = titleSpace + types.length * btnH + (types.length - 1) * btnSpacing + panelPadding * 2;

    // Panel background
    k.add([
        k.pos(panelX - panelPadding, panelY - panelPadding),
        k.rect(panelWidth, panelHeight, { radius: 8 }),
        k.color(COLORS.toolbarBg.r, COLORS.toolbarBg.g, COLORS.toolbarBg.b),
        k.outline(2, k.rgb(80, 90, 110)),
        k.opacity(0.95),
        k.z(50),
    ]);

    // Panel title
    k.add([
        k.pos(panelX + btnW / 2, panelY - panelPadding + 16),
        k.text("Towers", { size: 14 }),
        k.color(200, 200, 220),
        k.anchor("center"),
        k.z(53),
    ]);

    // Tower buttons (vertical stack)
    const buttonsStartY = panelY + 20;

    for (let i = 0; i < types.length; i++) {
        const [typeId, def] = types[i];
        const bx = panelX;
        const by = buttonsStartY + i * (btnH + btnSpacing);

        // Button background
        const btn = k.add([
            k.pos(bx, by),
            k.rect(btnW, btnH, { radius: 6 }),
            k.color(COLORS.buttonBg.r, COLORS.buttonBg.g, COLORS.buttonBg.b),
            k.outline(2, k.rgb(70, 75, 95)),
            k.area(),
            k.z(52),
            "towerBtn_" + typeId,
        ]);

        btn.baseColor = k.rgb(COLORS.buttonBg.r, COLORS.buttonBg.g, COLORS.buttonBg.b);
        btn.hoverColor = k.rgb(
            Math.min(255, COLORS.buttonBg.r + 15),
            Math.min(255, COLORS.buttonBg.g + 15),
            Math.min(255, COLORS.buttonBg.b + 15)
        );
        btn.isHovered = false;

        // Add hover effect
        btn.onUpdate(() => {
            const mousePos = k.mousePos();
            const wasHovered = btn.isHovered;
            btn.isHovered = btn.isHovering();

            if (btn.isHovered && !wasHovered) {
                btn.color = btn.hoverColor;
            } else if (!btn.isHovered && wasHovered) {
                btn.color = btn.baseColor;
            }

            // Selected state
            if (state.placingType === typeId) {
                btn.color = k.rgb(60, 100, 140);
            } else if (!btn.isHovered) {
                btn.color = btn.baseColor;
            }
        });

        // Add click handler directly to button
        btn.onClick(() => {
            if (state.isGameOver || state.isVictory) return;
            sounds.uiClick();
            if (state.placingType === typeId) {
                state.placingType = null;
            } else {
                state.selectedTower = null;
                state.placingType = typeId;
            }
        });

        // Tower icon
        k.add([
            k.pos(bx + btnW / 2, by + 16),
            k.rect(20, 20, { radius: 4 }),
            k.color(def.color.r, def.color.g, def.color.b),
            k.outline(1, k.rgb(
                Math.max(0, def.color.r - 30),
                Math.max(0, def.color.g - 30),
                Math.max(0, def.color.b - 30),
            )),
            k.anchor("center"),
            k.z(53),
        ]);

        // Tower name
        k.add([
            k.pos(bx + btnW / 2, by + 36),
            k.text(def.name, { size: 13 }),
            k.color(220, 220, 230),
            k.anchor("center"),
            k.z(53),
        ]);

        // Cost
        k.add([
            k.pos(bx + 8, by + btnH - 8),
            k.text("$" + def.cost, { size: 11 }),
            k.color(COLORS.goldText.r, COLORS.goldText.g, COLORS.goldText.b),
            k.anchor("left"),
            k.z(53),
        ]);

        // Hotkey
        k.add([
            k.pos(bx + btnW - 8, by + btnH - 8),
            k.text("(" + def.hotkey + ")", { size: 10 }),
            k.color(150, 150, 170),
            k.anchor("right"),
            k.z(53),
        ]);
    }

    // Instructions at bottom of screen
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 20),
        k.text("1-5: Select towers  |  U: Upgrade  |  S: Sell  |  SPACE: Start Wave  |  ESC/Right-click: Cancel", { size: 10 }),
        k.color(100, 100, 120),
        k.anchor("center"),
        k.z(52),
    ]);

    // Initial wave preview
    updateWavePreview();
}

function setupClicks() {
    // Click handlers are now attached directly to buttons in createToolbar()
}

function listenEvents() {
    events.on('waveStarted', (waveNum) => {
        startBtnText.text = "In Progress";

        // Play wave start sound
        sounds.waveStart();

        // Show boss wave banner
        const isBossWave = WAVE_DEFS[waveNum - 1]?.isBoss;
        if (isBossWave) {
            showBossBanner(waveNum);
        }

        // Update wave preview
        updateWavePreview();
    });

    events.on('waveCompleted', (waveNum) => {
        if (waveNum >= WAVE_DEFS.length) {
            startBtnText.text = "Complete!";
        } else {
            startBtnText.text = "Start Wave";
        }

        // Play wave complete sound
        sounds.waveComplete();

        // Clear boss banner if it's still showing
        clearBossBanner();

        // Update wave preview for next wave
        updateWavePreview();
    });

    events.on('gameOver', () => {
        sounds.gameOver();
        showOverlay("DEFEAT", "Your base was destroyed!", [255, 80, 80]);
    });

    events.on('gameWon', () => {
        sounds.victory();
        showOverlay("VICTORY", "All waves defeated!", [80, 255, 120]);
    });

    events.on('enemyKilled', (enemy) => {
        if (!enemy.pos) return;
        showFloatingText("+" + enemy.reward, enemy.pos.x, enemy.pos.y, COLORS.goldText);
    });

    events.on('enemyReachedEnd', () => {
        livesText.color = k.rgb(255, 50, 50);
        k.wait(0.3, () => {
            if (livesText.exists()) livesText.color = k.rgb(255, 255, 255);
        });
    });

    events.on('towerSelected', (tower) => {
        showTowerInfoPanel(tower);
    });

    events.on('towerDeselected', () => {
        hideTowerInfoPanel();
    });

    events.on('towerUpgraded', (tower) => {
        if (state.selectedTower === tower) {
            showTowerInfoPanel(tower);
        }
    });

    events.on('towerSold', () => {
        hideTowerInfoPanel();
    });
}

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

function updateWavePreview() {
    // Clear existing preview
    if (wavePreviewContainer) {
        k.destroyAll("wavePreview");
        wavePreviewContainer = null;
    }

    // Don't show preview if game is over or all waves completed
    if (state.isGameOver || state.isVictory || state.wave >= WAVE_DEFS.length) return;

    const nextWaveIdx = state.isWaveActive ? state.wave : state.wave;
    if (nextWaveIdx >= WAVE_DEFS.length) return;

    const nextWave = WAVE_DEFS[nextWaveIdx];
    const previewX = 340;
    const previewY = HUD_HEIGHT / 2;

    // "Next Wave:" label
    k.add([
        k.pos(previewX, previewY - 12),
        k.text("Next:", { size: 11 }),
        k.color(150, 150, 170),
        k.anchor("left"),
        k.z(52),
        "wavePreview",
    ]);

    // Show enemy types in next wave
    let offsetX = 0;
    const enemyTypes = new Map(); // Count each enemy type

    for (const group of nextWave.enemies) {
        const current = enemyTypes.get(group.type) || 0;
        enemyTypes.set(group.type, current + group.count);
    }

    // Display each enemy type
    for (const [type, count] of enemyTypes) {
        const def = ENEMY_DEFS[type];

        // Enemy icon (small circle)
        k.add([
            k.pos(previewX + offsetX, previewY + 8),
            k.circle(6),
            k.color(def.color.r, def.color.g, def.color.b),
            k.outline(1, k.rgb(
                Math.max(0, def.color.r - 60),
                Math.max(0, def.color.g - 60),
                Math.max(0, def.color.b - 60),
            )),
            k.anchor("center"),
            k.z(52),
            "wavePreview",
        ]);

        // Count
        k.add([
            k.pos(previewX + offsetX + 10, previewY + 8),
            k.text("×" + count, { size: 10 }),
            k.color(200, 200, 220),
            k.anchor("left"),
            k.z(52),
            "wavePreview",
        ]);

        offsetX += 48;
    }

    // Boss wave indicator
    if (nextWave.isBoss) {
        k.add([
            k.pos(previewX + offsetX, previewY + 8),
            k.text("⚠", { size: 12 }),
            k.color(255, 100, 100),
            k.anchor("center"),
            k.z(52),
            "wavePreview",
        ]);
    }

    wavePreviewContainer = true; // Mark as created
}

function showBossBanner(waveNum) {
    // Clear existing banner and all its elements
    clearBossBanner();

    // Create boss wave warning banner
    const bannerHeight = 60;
    const bannerY = GAME_HEIGHT / 2 - 100;

    bossBanner = k.add([
        k.pos(GAME_WIDTH / 2, bannerY),
        k.rect(500, bannerHeight, { radius: 8 }),
        k.color(150, 50, 200),
        k.outline(3, k.rgb(200, 100, 250)),
        k.anchor("center"),
        k.opacity(0.95),
        k.z(90),
        "bossBanner",
    ]);

    const bannerText1 = k.add([
        k.pos(GAME_WIDTH / 2, bannerY - 8),
        k.text("⚠ BOSS WAVE " + waveNum + " ⚠", { size: 32 }),
        k.color(255, 220, 100),
        k.anchor("center"),
        k.z(91),
        "bossBanner",
    ]);

    const bannerText2 = k.add([
        k.pos(GAME_WIDTH / 2, bannerY + 12),
        k.text("Prepare for a tough fight!", { size: 14 }),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.z(91),
        "bossBanner",
    ]);

    // Auto-hide banner after 3 seconds
    k.wait(3, () => {
        if (bossBanner && bossBanner.exists()) {
            const fadeSpeed = 2;
            const bannerElements = k.get("bossBanner");

            bossBanner.onUpdate(() => {
                bossBanner.opacity -= fadeSpeed * k.dt();
                // Fade all text elements too
                for (const elem of bannerElements) {
                    if (elem.exists() && elem !== bossBanner) {
                        elem.opacity = bossBanner.opacity;
                    }
                }
                if (bossBanner.opacity <= 0) {
                    clearBossBanner();
                }
            });
        }
    });
}

function clearBossBanner() {
    // Destroy all banner elements
    k.destroyAll("bossBanner");
    bossBanner = null;
}

function showOverlay(title, subtitle, titleColor) {
    if (overlayObj) return;
    overlayObj = k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.6),
        k.z(100),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40),
        k.text(title, { size: 64 }),
        k.color(titleColor[0], titleColor[1], titleColor[2]),
        k.anchor("center"),
        k.z(101),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30),
        k.text(subtitle, { size: 24 }),
        k.color(220, 220, 230),
        k.anchor("center"),
        k.z(101),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70),
        k.text("Wave " + state.wave + " / " + WAVE_DEFS.length + "  |  Press R to restart", { size: 16 }),
        k.color(160, 160, 180),
        k.anchor("center"),
        k.z(101),
    ]);
}

// Tower info panel
function showTowerInfoPanel(tower) {
    hideTowerInfoPanel();

    const def = TOWER_DEFS[tower.towerType];
    const panelWidth = 200;
    const panelX = 20;
    const panelY = HUD_HEIGHT + 80;

    // Panel background
    const panelBg = k.add([
        k.pos(panelX, panelY),
        k.rect(panelWidth, 340, { radius: 8 }),
        k.color(COLORS.toolbarBg.r, COLORS.toolbarBg.g, COLORS.toolbarBg.b),
        k.outline(2, k.rgb(80, 90, 110)),
        k.opacity(0.95),
        k.z(50),
        "towerInfo",
    ]);

    // Tower name
    const levelSuffix = tower.upgradeLevel > 0 ? ` [Lv ${tower.upgradeLevel + 1}]` : "";
    k.add([
        k.pos(panelX + panelWidth / 2, panelY + 20),
        k.text(def.name + levelSuffix, { size: 16 }),
        k.color(220, 220, 230),
        k.anchor("center"),
        k.z(53),
        "towerInfo",
    ]);

    // Upgrade stars
    let starY = panelY + 38;
    for (let i = 0; i < 3; i++) {
        const filled = i < tower.upgradeLevel;
        k.add([
            k.pos(panelX + panelWidth / 2 - 20 + i * 20, starY),
            k.text(filled ? "\u2605" : "\u2606", { size: 14 }),
            k.color(filled ? 255 : 100, filled ? 215 : 100, filled ? 0 : 100),
            k.anchor("center"),
            k.z(53),
            "towerInfo",
        ]);
    }

    // Stats
    let statY = panelY + 60;
    const statSize = 11;
    const statSpacing = 18;

    k.add([
        k.pos(panelX + 10, statY),
        k.text(`Damage: ${Math.round(tower.damage)}`, { size: statSize }),
        k.color(200, 200, 220),
        k.anchor("left"),
        k.z(53),
        "towerInfo",
    ]);
    statY += statSpacing;

    k.add([
        k.pos(panelX + 10, statY),
        k.text(`Range: ${Math.round(tower.range)}`, { size: statSize }),
        k.color(200, 200, 220),
        k.anchor("left"),
        k.z(53),
        "towerInfo",
    ]);
    statY += statSpacing;

    k.add([
        k.pos(panelX + 10, statY),
        k.text(`Speed: ${tower.attackSpeed.toFixed(1)}/s`, { size: statSize }),
        k.color(200, 200, 220),
        k.anchor("left"),
        k.z(53),
        "towerInfo",
    ]);
    statY += statSpacing + 5;

    // Separator
    k.add([
        k.pos(panelX + 10, statY),
        k.rect(panelWidth - 20, 1),
        k.color(80, 90, 110),
        k.z(53),
        "towerInfo",
    ]);
    statY += 10;

    // Targeting priority
    k.add([
        k.pos(panelX + 10, statY),
        k.text("Target:", { size: 11 }),
        k.color(150, 150, 170),
        k.anchor("left"),
        k.z(53),
        "towerInfo",
    ]);
    statY += 18;

    // Targeting buttons
    const targetBtnWidth = (panelWidth - 30) / 2;
    const targetBtnHeight = 24;
    const priorities = Object.keys(TARGETING_PRIORITIES);

    for (let i = 0; i < priorities.length; i++) {
        const priority = priorities[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const btnX = panelX + 10 + col * (targetBtnWidth + 5);
        const btnY = statY + row * (targetBtnHeight + 5);
        const isSelected = tower.targetingPriority === priority;

        const btn = k.add([
            k.pos(btnX, btnY),
            k.rect(targetBtnWidth, targetBtnHeight, { radius: 4 }),
            k.color(isSelected ? 60 : 40, isSelected ? 100 : 50, isSelected ? 140 : 70),
            k.outline(1, k.rgb(isSelected ? 120 : 70, isSelected ? 140 : 80, isSelected ? 180 : 100)),
            k.area(),
            k.z(52),
            "towerInfo",
        ]);

        btn.onClick(() => {
            sounds.uiClick();
            setTargetingPriority(tower, priority);
            showTowerInfoPanel(tower); // Refresh panel
        });

        k.add([
            k.pos(btnX + targetBtnWidth / 2, btnY + targetBtnHeight / 2),
            k.text(TARGETING_PRIORITIES[priority].name, { size: 10 }),
            k.color(200, 200, 220),
            k.anchor("center"),
            k.z(53),
            "towerInfo",
        ]);
    }

    statY += 60;

    // Separator
    k.add([
        k.pos(panelX + 10, statY),
        k.rect(panelWidth - 20, 1),
        k.color(80, 90, 110),
        k.z(53),
        "towerInfo",
    ]);
    statY += 15;

    // Upgrade button
    if (tower.upgradeLevel < def.upgrades.length) {
        const upgrade = def.upgrades[tower.upgradeLevel];
        const canAfford = state.canAfford(upgrade.cost);

        const upgradeBtn = k.add([
            k.pos(panelX + 10, statY),
            k.rect(panelWidth - 20, 40, { radius: 6 }),
            k.color(canAfford ? 40 : 30, canAfford ? 100 : 50, canAfford ? 60 : 50),
            k.outline(2, k.rgb(canAfford ? 60 : 50, canAfford ? 140 : 70, canAfford ? 80 : 70)),
            k.area(),
            k.z(52),
            "towerInfo",
        ]);

        upgradeBtn.onClick(() => {
            sounds.uiClick();
            if (upgradeTower(tower)) {
                showTowerInfoPanel(tower);
            }
        });

        k.add([
            k.pos(panelX + panelWidth / 2, statY + 12),
            k.text(`Upgrade (U)`, { size: 13 }),
            k.color(canAfford ? 220 : 140, canAfford ? 220 : 140, canAfford ? 230 : 150),
            k.anchor("center"),
            k.z(53),
            "towerInfo",
        ]);

        k.add([
            k.pos(panelX + panelWidth / 2, statY + 28),
            k.text(`$${upgrade.cost}`, { size: 11 }),
            k.color(COLORS.goldText.r, COLORS.goldText.g, COLORS.goldText.b),
            k.anchor("center"),
            k.z(53),
            "towerInfo",
        ]);

        statY += 50;
    } else {
        // Max level indicator
        k.add([
            k.pos(panelX + panelWidth / 2, statY + 10),
            k.text("MAX LEVEL", { size: 12 }),
            k.color(255, 215, 0),
            k.anchor("center"),
            k.z(53),
            "towerInfo",
        ]);
        statY += 30;
    }

    // Sell button
    const sellValue = Math.floor(tower.totalCost * SELL_REFUND_RATE);
    const sellBtn = k.add([
        k.pos(panelX + 10, statY),
        k.rect(panelWidth - 20, 40, { radius: 6 }),
        k.color(100, 50, 50),
        k.outline(2, k.rgb(140, 70, 70)),
        k.area(),
        k.z(52),
        "towerInfo",
    ]);

    sellBtn.onClick(() => {
        sounds.uiClick();
        sellTower(tower);
    });

    k.add([
        k.pos(panelX + panelWidth / 2, statY + 12),
        k.text("Sell (S)", { size: 13 }),
        k.color(220, 220, 230),
        k.anchor("center"),
        k.z(53),
        "towerInfo",
    ]);

    k.add([
        k.pos(panelX + panelWidth / 2, statY + 28),
        k.text(`+$${sellValue}`, { size: 11 }),
        k.color(COLORS.goldText.r, COLORS.goldText.g, COLORS.goldText.b),
        k.anchor("center"),
        k.z(53),
        "towerInfo",
    ]);

    towerInfoPanel = true;
}

function hideTowerInfoPanel() {
    if (towerInfoPanel) {
        k.destroyAll("towerInfo");
        towerInfoPanel = null;
    }
}
