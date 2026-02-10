import {
    GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, TOOLBAR_Y, TOOLBAR_HEIGHT,
    TOWER_DEFS, COLORS, WAVE_DEFS, ENEMY_DEFS,
} from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { startNextWave } from './waves.js';

let k;
let goldText, livesText, waveText, startBtnText;
let overlayObj = null;
let bossBanner = null;
let wavePreviewContainer = null;
let lastGold = -1, lastLives = -1, lastWave = -1;
let goldTextPos, livesTextPos, waveTextPos; // Store positions for recreating text

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
    startBtnText = k.add([
        k.pos(btnX, HUD_HEIGHT / 2),
        k.text("Start Wave", { size: 14 }),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.z(53),
    ]);
    startBtn.onClick(() => {
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

        // Add click handler directly to button
        btn.onClick(() => {
            if (state.isGameOver || state.isVictory) return;
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
        k.text("1-5: Select towers  |  SPACE: Start Wave  |  ESC: Cancel  |  Right-click: Deselect", { size: 10 }),
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

        // Update wave preview for next wave
        updateWavePreview();
    });

    events.on('gameOver', () => {
        showOverlay("DEFEAT", "Your base was destroyed!", [255, 80, 80]);
    });

    events.on('gameWon', () => {
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
    // Clear existing banner
    if (bossBanner && bossBanner.exists()) {
        bossBanner.destroy();
    }

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
    ]);

    k.add([
        k.pos(GAME_WIDTH / 2, bannerY - 8),
        k.text("⚠ BOSS WAVE " + waveNum + " ⚠", { size: 32 }),
        k.color(255, 220, 100),
        k.anchor("center"),
        k.z(91),
    ]);

    k.add([
        k.pos(GAME_WIDTH / 2, bannerY + 12),
        k.text("Prepare for a tough fight!", { size: 14 }),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.z(91),
    ]);

    // Auto-hide banner after 3 seconds
    k.wait(3, () => {
        if (bossBanner && bossBanner.exists()) {
            const fadeSpeed = 2;
            bossBanner.onUpdate(() => {
                bossBanner.opacity -= fadeSpeed * k.dt();
                if (bossBanner.opacity <= 0) {
                    bossBanner.destroy();
                    bossBanner = null;
                }
            });
        }
    });
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
