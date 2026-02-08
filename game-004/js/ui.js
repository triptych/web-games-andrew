import {
    GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, TOOLBAR_Y, TOOLBAR_HEIGHT,
    TOWER_DEFS, COLORS, WAVE_DEFS,
} from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { startNextWave } from './waves.js';

let k;
let goldText, livesText, waveText, startBtnText;
let towerBtnRects = []; // { x, y, w, h, typeId }
let overlayObj = null;
let lastGold = -1, lastLives = -1, lastWave = -1;

export function initUI(kaplay) {
    k = kaplay;
    createHUD();
    createToolbar();
    setupClicks();
    listenEvents();

    // Continuously sync HUD text with state (reliable across Kaplay versions)
    k.onUpdate(() => {
        if (state.gold !== lastGold) {
            lastGold = state.gold;
            goldText.text = String(state.gold);
        }
        if (state.lives !== lastLives) {
            lastLives = state.lives;
            livesText.text = String(state.lives);
        }
        if (state.wave !== lastWave) {
            lastWave = state.wave;
            waveText.text = "Wave " + state.wave + " / " + WAVE_DEFS.length;
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
    goldText = k.add([
        k.pos(44, HUD_HEIGHT / 2),
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
    livesText = k.add([
        k.pos(204, HUD_HEIGHT / 2),
        k.text(String(state.lives), { size: 20 }),
        k.color(255, 255, 255),
        k.anchor("left"),
        k.z(52),
    ]);

    // Wave text
    waveText = k.add([
        k.pos(GAME_WIDTH / 2, HUD_HEIGHT / 2),
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
    // Toolbar background
    k.add([
        k.pos(0, TOOLBAR_Y),
        k.rect(GAME_WIDTH, TOOLBAR_HEIGHT),
        k.color(COLORS.toolbarBg.r, COLORS.toolbarBg.g, COLORS.toolbarBg.b),
        k.z(50),
    ]);
    k.add([
        k.pos(0, TOOLBAR_Y),
        k.rect(GAME_WIDTH, 2),
        k.color(80, 90, 110),
        k.z(51),
    ]);

    // Tower buttons
    const types = Object.entries(TOWER_DEFS);
    const btnW = 100;
    const btnH = 44;
    const totalW = types.length * btnW + (types.length - 1) * 12;
    const startX = (GAME_WIDTH - totalW) / 2;

    for (let i = 0; i < types.length; i++) {
        const [typeId, def] = types[i];
        const bx = startX + i * (btnW + 12);
        const by = TOOLBAR_Y + 6;

        // Store rect for manual click detection
        towerBtnRects.push({ x: bx, y: by, w: btnW, h: btnH, typeId });

        // Button background (no anchor - topleft)
        k.add([
            k.pos(bx, by),
            k.rect(btnW, btnH, { radius: 6 }),
            k.color(COLORS.buttonBg.r, COLORS.buttonBg.g, COLORS.buttonBg.b),
            k.outline(2, k.rgb(70, 75, 95)),
            k.z(52),
            "towerBtn_" + typeId,
        ]);

        // Tower icon
        k.add([
            k.pos(bx + 12, by + btnH / 2),
            k.rect(16, 16, { radius: 3 }),
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
            k.pos(bx + 26, by + 10),
            k.text(def.name, { size: 13 }),
            k.color(220, 220, 230),
            k.anchor("left"),
            k.z(53),
        ]);

        // Cost
        k.add([
            k.pos(bx + 26, by + 27),
            k.text("$" + def.cost, { size: 12 }),
            k.color(COLORS.goldText.r, COLORS.goldText.g, COLORS.goldText.b),
            k.anchor("left"),
            k.z(53),
        ]);

        // Hotkey
        k.add([
            k.pos(bx + btnW - 8, by + 27),
            k.text("[" + def.hotkey + "]", { size: 10 }),
            k.color(150, 150, 170),
            k.anchor("right"),
            k.z(53),
        ]);
    }

    // Instructions
    k.add([
        k.pos(GAME_WIDTH / 2, TOOLBAR_Y + TOOLBAR_HEIGHT - 10),
        k.text("[1] Select tower  |  [SPACE] Start Wave  |  [ESC] Cancel  |  Right-click: Deselect", { size: 10 }),
        k.color(100, 100, 120),
        k.anchor("center"),
        k.z(52),
    ]);
}

function setupClicks() {
    // Manual hit-testing for toolbar tower buttons
    k.onClick(() => {
        const pos = k.mousePos();

        // Tower button hit tests
        for (const rect of towerBtnRects) {
            if (pos.x >= rect.x && pos.x <= rect.x + rect.w &&
                pos.y >= rect.y && pos.y <= rect.y + rect.h) {
                if (state.isGameOver || state.isVictory) return;
                if (state.placingType === rect.typeId) {
                    state.placingType = null;
                } else {
                    state.selectedTower = null;
                    state.placingType = rect.typeId;
                }
                return;
            }
        }
    });
}

function listenEvents() {
    events.on('waveStarted', () => {
        startBtnText.text = "In Progress";
    });

    events.on('waveCompleted', (waveNum) => {
        if (waveNum >= WAVE_DEFS.length) {
            startBtnText.text = "Complete!";
        } else {
            startBtnText.text = "Start Wave";
        }
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
