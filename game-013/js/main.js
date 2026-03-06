/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main gameplay scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS, SEEDS, POTS, SOILS, SLOT_COUNT, GROW_STAGES, SEASONS, DECORATIONS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, spawnGoldPopup } from './ui.js';
import { initAudio, playUiClick, playPlant, playBloom, playHarvest, playBuy, playNoGold, playDayEnd, startAmbientMusic } from './sounds.js';

// ============================================================
// KAPLAY API GOTCHAS (read before adding entities)
// ============================================================
//
// 1. POSITION — entity.pos is a getter/setter, NOT a plain field.
//    Mutating the returned Vec2 has NO visual effect:
//      BAD:  entity.pos.x = 100;          // silently broken
//      GOOD: entity.pos = k.vec2(100, y); // correct
//
// 2. OPACITY — setting entity.opacity only works if k.opacity()
//    was declared in the k.add([...]) component list at creation:
//      BAD:  k.add([k.pos(x,y), k.rect(w,h)])  → entity.opacity = 0.5; // ignored
//      GOOD: k.add([k.pos(x,y), k.rect(w,h), k.opacity(1)]) → entity.opacity = 0.5; // works
//
// 3. TEXT — square brackets in k.text() strings are parsed as style tags.
//    Use parentheses instead:
//      BAD:  k.text('[Space] to fire')    // "Styled text error: unclosed tags"
//      GOOD: k.text('(Space) to fire')
//
// 4. COLOR — k.rgba() does not exist. Use k.color(r,g,b,a) or k.color(r,g,b).
//    For outline/fill params use k.rgb(r,g,b).
//
// ============================================================
// Kaplay init
// ============================================================

const k = kaplay({
    width:        GAME_WIDTH,
    height:       GAME_HEIGHT,
    background:   COLORS.bg,
    letterbox:    true,
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio, 2),
});

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 120),
        k.text('Petal & Purse', { size: 64 }),
        k.color(...COLORS.pink),
        k.anchor('center'),
        k.z(1),
    ]);

    // Subtitle
    k.add([
        k.pos(CX, CY - 55),
        k.text('A cozy flower shop sim', { size: 22 }),
        k.color(...COLORS.muted),
        k.anchor('center'),
        k.z(1),
    ]);

    // Flower decoration row
    const flowerRow = ['🌼', '🌷', '🌻', '🌹', '🌼'];
    flowerRow.forEach((f, i) => {
        k.add([
            k.pos(CX - 80 + i * 40, CY + 10),
            k.text(f, { size: 28 }),
            k.anchor('center'),
            k.z(1),
        ]);
    });

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, CY + 70),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
    });

    // Controls hint
    k.add([
        k.pos(CX, CY + 120),
        k.text('Buy seeds. Grow flowers. Sell for gold. Upgrade your pots!', { size: 13 }),
        k.color(...COLORS.muted),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 3', { size: 10 }),
        k.color(60, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click
    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        startAmbientMusic();
        playUiClick();
        document.removeEventListener('keydown', onAnyKey);
        k.go('game');
    }

    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToGame();
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(goToGame);
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    // Try to restore a saved run; fresh reset if none
    state.reset();
    state.load();
    initUI(k);

    // --------------------------------------------------------
    // Layout constants
    // --------------------------------------------------------
    const SLOT_AREA_Y   = 200;       // top of pot row
    const SLOT_SPACING  = 220;       // horizontal spacing between pots
    const SLOT_START_X  = (GAME_WIDTH - (SLOT_COUNT - 1) * SLOT_SPACING) / 2;
    const POT_W = 120;
    const POT_H = 110;

    // --------------------------------------------------------
    // Panel state (shop & upgrade share the "one panel at a time" rule)
    // --------------------------------------------------------
    let shopOpen       = false;
    let shopEntities   = [];

    let upgradeOpen    = false;
    let upgradeEntities = [];
    let upgradeSlotIdx  = null;
    let upgradePanelRect = null;  // { x, y, w, h } in world coords

    // --------------------------------------------------------
    // Pot slot visuals
    // --------------------------------------------------------
    const slotEntities = [];   // array of { bg, progressBar, stageText, labelText, potLabel }

    function buildSlotVisuals() {
        for (let i = 0; i < SLOT_COUNT; i++) {
            const cx = SLOT_START_X + i * SLOT_SPACING;
            const cy = SLOT_AREA_Y;

            // Pot background rect
            const bg = k.add([
                k.pos(cx, cy),
                k.rect(POT_W, POT_H, { radius: 10 }),
                k.color(...COLORS.soil),
                k.anchor('top'),
                k.opacity(1),
                k.z(10),
                k.area(),
                'potSlot',
                { slotIndex: i },
            ]);

            bg.onClick(() => {
                if (shopOpen || upgradeOpen) return;
                handleSlotClick(i);
            });

            // Hover-delay upgrade context menu
            let hoverTimer = null;
            bg.onHover(() => {
                if (shopOpen || (upgradeOpen && upgradeSlotIdx === i)) return;
                hoverTimer = k.wait(1.5, () => {
                    if (shopOpen) return;
                    if (upgradeOpen) closeUpgrade();
                    openUpgrade(i);
                    hoverTimer = null;
                });
            });
            bg.onHoverEnd(() => {
                if (hoverTimer) { hoverTimer.cancel(); hoverTimer = null; }
                // Dismissal is handled by the global onUpdate mouse-position check
            });

            // Stage / flower emoji label
            const stageText = k.add([
                k.pos(cx, cy + 30),
                k.text('🪴', { size: 36 }),
                k.anchor('center'),
                k.z(11),
            ]);

            // Slot label
            const labelText = k.add([
                k.pos(cx, cy + POT_H + 8),
                k.text(`Slot ${i + 1}`, { size: 13 }),
                k.color(...COLORS.muted),
                k.anchor('top'),
                k.z(11),
            ]);

            // Pot type label
            const potLabel = k.add([
                k.pos(cx, cy + POT_H + 25),
                k.text('Clay', { size: 11 }),
                k.color(...COLORS.accent),
                k.anchor('top'),
                k.z(11),
            ]);

            // Progress bar background
            const barBg = k.add([
                k.pos(cx - POT_W / 2 + 8, cy + POT_H - 18),
                k.rect(POT_W - 16, 10, { radius: 4 }),
                k.color(30, 20, 30),
                k.anchor('topleft'),
                k.z(12),
            ]);

            // Progress bar fill
            const progressBar = k.add([
                k.pos(cx - POT_W / 2 + 8, cy + POT_H - 18),
                k.rect(1, 10, { radius: 4 }),
                k.color(...COLORS.green),
                k.anchor('topleft'),
                k.z(13),
            ]);

            slotEntities.push({ bg, stageText, labelText, potLabel, progressBar, barBg });
        }
    }

    // --------------------------------------------------------
    // Slot click handler — plant or harvest
    // --------------------------------------------------------
    function handleSlotClick(i) {
        const slot = state.getSlot(i);
        if (slot.seedKey === null) {
            // Open shop to buy/plant a seed
            openShop(i);
        } else if (slot.growProgress >= 1.0) {
            // Harvest!
            const earned = state.harvestSlot(i);
            if (earned !== false) {
                playHarvest();
                const cx = SLOT_START_X + i * SLOT_SPACING;
                spawnGoldPopup(k, cx, SLOT_AREA_Y - 20, earned);
                state.save();
            }
        }
        // else: growing — do nothing (show tooltip TODO)
    }

    // --------------------------------------------------------
    // Shop panel
    // --------------------------------------------------------
    function openShop(slotIndex) {
        shopOpen = true;
        events.emit('shopOpened');

        const PW = 600, PH = 440;
        const PX = (GAME_WIDTH - PW) / 2;
        const PY = (GAME_HEIGHT - PH) / 2;

        // Dim overlay
        const overlay = k.add([
            k.pos(0, 0),
            k.rect(GAME_WIDTH, GAME_HEIGHT),
            k.color(0, 0, 0),
            k.opacity(0.55),
            k.z(200),
            k.area(),
        ]);
        shopEntities.push(overlay);

        // Panel
        const panel = k.add([
            k.pos(PX, PY),
            k.rect(PW, PH, { radius: 12 }),
            k.color(40, 32, 55),
            k.anchor('topleft'),
            k.z(201),
        ]);
        shopEntities.push(panel);

        // Title
        const title = k.add([
            k.pos(GAME_WIDTH / 2, PY + 22),
            k.text('Seed Shop', { size: 26 }),
            k.color(...COLORS.accent),
            k.anchor('top'),
            k.z(202),
        ]);
        shopEntities.push(title);

        // Gold display
        const goldDisp = k.add([
            k.pos(PX + PW - 16, PY + 22),
            k.text(`Gold: ${state.gold}g`, { size: 16 }),
            k.color(...COLORS.gold),
            k.anchor('topright'),
            k.z(202),
        ]);
        shopEntities.push(goldDisp);

        // Update gold display on goldChanged
        const offGold = events.on('goldChanged', (v) => {
            goldDisp.text = `Gold: ${v}g`;
        });
        shopEntities.push({ _off: offGold });

        // Seed buttons
        const seedKeys = Object.keys(SEEDS);
        seedKeys.forEach((key, idx) => {
            const seed = SEEDS[key];
            const bx = PX + 20 + (idx % 2) * (PW / 2 - 10);
            const by = PY + 70 + Math.floor(idx / 2) * 90;

            const btn = k.add([
                k.pos(bx, by),
                k.rect(PW / 2 - 30, 80, { radius: 8 }),
                k.color(55, 44, 75),
                k.anchor('topleft'),
                k.opacity(1),
                k.z(202),
                k.area(),
            ]);
            shopEntities.push(btn);

            const btnText = k.add([
                k.pos(bx + 10, by + 10),
                k.text(`${seed.emoji} ${seed.name}\nCost: ${seed.cost}g  |  Sell: ${seed.sellValue}g\nGrow: ${seed.growTime}s  |  Own: ${state.seedBag[key]}`, { size: 12 }),
                k.color(...COLORS.text),
                k.anchor('topleft'),
                k.z(203),
            ]);
            shopEntities.push(btnText);

            function applyAffordable(gold) {
                const canAfford = gold >= seed.cost;
                btn.opacity   = canAfford ? 1 : 0.35;
                btnText.color = canAfford ? k.rgb(...COLORS.text) : k.rgb(...COLORS.muted);
            }
            applyAffordable(state.gold);

            const offAfford = events.on('goldChanged', applyAffordable);
            shopEntities.push({ _off: offAfford });

            btn.onClick(() => {
                if (state.gold < seed.cost) { playNoGold(); return; }
                if (state.spendGold(seed.cost)) {
                    state.addSeed(key);
                    playBuy();
                    // Then immediately plant it
                    if (state.useSeed(key)) {
                        state.plantSeed(slotIndex, key);
                        playPlant();
                    }
                    closeShop();
                }
            });

            btn.onHover(() => { if (state.gold >= seed.cost) btn.color = k.rgb(75, 60, 100); });
            btn.onHoverEnd(() => { btn.color = k.rgb(55, 44, 75); });
        });

        // "Use seed from bag" section — if player has seeds
        let bagY = PY + 270;
        const bagSeeds = Object.keys(SEEDS).filter(k2 => state.seedBag[k2] > 0);
        if (bagSeeds.length > 0) {
            const bagTitle = k.add([
                k.pos(PX + 20, bagY),
                k.text('Plant from bag:', { size: 14 }),
                k.color(...COLORS.muted),
                k.anchor('topleft'),
                k.z(202),
            ]);
            shopEntities.push(bagTitle);
            bagY += 24;

            bagSeeds.forEach((key, idx) => {
                const seed = SEEDS[key];
                const bx2 = PX + 20 + idx * 110;
                const bagBtn = k.add([
                    k.pos(bx2, bagY),
                    k.rect(100, 40, { radius: 6 }),
                    k.color(55, 75, 55),
                    k.anchor('topleft'),
                    k.opacity(1),
                    k.z(202),
                    k.area(),
                ]);
                shopEntities.push(bagBtn);

                const bagBtnTxt = k.add([
                    k.pos(bx2 + 50, bagY + 20),
                    k.text(`${seed.emoji} x${state.seedBag[key]}`, { size: 13 }),
                    k.color(...COLORS.text),
                    k.anchor('center'),
                    k.z(203),
                ]);
                shopEntities.push(bagBtnTxt);

                bagBtn.onClick(() => {
                    if (state.useSeed(key)) {
                        state.plantSeed(slotIndex, key);
                        playPlant();
                        closeShop();
                    }
                });
                bagBtn.onHover(() => { bagBtn.color = k.rgb(70, 100, 70); });
                bagBtn.onHoverEnd(() => { bagBtn.color = k.rgb(55, 75, 55); });
            });
        }

        // Close button
        const closeBtn = k.add([
            k.pos(GAME_WIDTH / 2, PY + PH - 22),
            k.text('Close  (ESC)', { size: 14 }),
            k.color(...COLORS.muted),
            k.anchor('bot'),
            k.opacity(1),
            k.z(203),
            k.area(),
        ]);
        shopEntities.push(closeBtn);
        closeBtn.onClick(() => closeShop());
        closeBtn.onHover(() => { closeBtn.color = k.rgb(...COLORS.text); });
        closeBtn.onHoverEnd(() => { closeBtn.color = k.rgb(...COLORS.muted); });
    }

    function closeShop() {
        shopOpen = false;
        for (const e of shopEntities) {
            if (e && e._off) { e._off(); }
            else if (e && e.exists && e.exists()) { k.destroy(e); }
        }
        shopEntities = [];
        events.emit('shopClosed');
    }

    // --------------------------------------------------------
    // Upgrade panel — per-slot pot & soil upgrades
    // --------------------------------------------------------
    const POT_ORDER  = ['clay', 'glazed', 'terracotta'];
    const SOIL_ORDER = ['basic', 'rich', 'enchanted'];

    function openUpgrade(slotIndex) {
        upgradeOpen   = true;
        upgradeSlotIdx = slotIndex;

        const cx = SLOT_START_X + slotIndex * SLOT_SPACING;
        const UW = 260, UH = 220;
        // Anchor panel above the pot, centred
        let ux = cx - UW / 2;
        let uy = SLOT_AREA_Y - UH - 14;
        // Clamp inside canvas
        ux = Math.max(8, Math.min(GAME_WIDTH - UW - 8, ux));
        uy = Math.max(8, uy);
        upgradePanelRect = { x: ux, y: uy, w: UW, h: UH };

        // Panel bg
        const panel = k.add([
            k.pos(ux, uy),
            k.rect(UW, UH, { radius: 10 }),
            k.color(38, 28, 55),
            k.anchor('topleft'),
            k.z(210),
        ]);
        upgradeEntities.push(panel);

        // Title
        const title = k.add([
            k.pos(ux + UW / 2, uy + 12),
            k.text(`Slot ${slotIndex + 1} Upgrades`, { size: 14 }),
            k.color(...COLORS.accent),
            k.anchor('top'),
            k.z(211),
        ]);
        upgradeEntities.push(title);

        // Helper: draw a single upgrade row (pot or soil)
        function upgradeRow(order, configMap, getCurrent, label, rowY, onBuy) {
            const current = getCurrent();
            const curIdx  = order.indexOf(current);
            const nextKey = order[curIdx + 1] || null;
            const next    = nextKey ? configMap[nextKey] : null;

            // Current label
            const cur = k.add([
                k.pos(ux + 10, rowY),
                k.text(`${label}: ${configMap[current].name}`, { size: 11 }),
                k.color(...COLORS.text),
                k.anchor('topleft'),
                k.z(211),
            ]);
            upgradeEntities.push(cur);

            if (!next) {
                const maxed = k.add([
                    k.pos(ux + 10, rowY + 16),
                    k.text('Maxed out!', { size: 10 }),
                    k.color(...COLORS.green),
                    k.anchor('topleft'),
                    k.z(211),
                ]);
                upgradeEntities.push(maxed);
                return;
            }

            // Upgrade button
            const canAfford = state.gold >= next.cost;
            const btn = k.add([
                k.pos(ux + 10, rowY + 16),
                k.rect(UW - 20, 28, { radius: 6 }),
                k.color(canAfford ? 55 : 40, canAfford ? 44 : 34, canAfford ? 80 : 60),
                k.anchor('topleft'),
                k.opacity(canAfford ? 1 : 0.5),
                k.z(212),
                k.area(),
            ]);
            upgradeEntities.push(btn);

            const btnTxt = k.add([
                k.pos(ux + UW / 2, rowY + 30),
                k.text(`Upgrade to ${next.name}  (${next.cost}g)  ${next.description}`, { size: 10 }),
                k.color(...(canAfford ? COLORS.text : COLORS.muted)),
                k.anchor('center'),
                k.z(213),
            ]);
            upgradeEntities.push(btnTxt);

            btn.onClick(() => {
                if (state.gold < next.cost) { playNoGold(); return; }
                if (state.spendGold(next.cost)) {
                    onBuy(nextKey);
                    playBuy();
                    state.save();
                    closeUpgrade();
                    openUpgrade(slotIndex); // refresh panel
                }
            });
            btn.onHover(() => { if (state.gold >= next.cost) btn.color = k.rgb(75, 60, 110); });
            btn.onHoverEnd(() => { btn.color = k.rgb(canAfford ? 55 : 40, canAfford ? 44 : 34, canAfford ? 80 : 60); });
        }

        upgradeRow(
            POT_ORDER, POTS,
            () => state.getSlot(slotIndex).potKey,
            'Pot',
            uy + 38,
            (key) => state.upgradePot(slotIndex, key)
        );

        upgradeRow(
            SOIL_ORDER, SOILS,
            () => state.getSlot(slotIndex).soilKey,
            'Soil',
            uy + 120,
            (key) => state.upgradeSoil(slotIndex, key)
        );

        // Close hint
        const closeHint = k.add([
            k.pos(ux + UW / 2, uy + UH - 8),
            k.text('Right-click or ESC to close', { size: 9 }),
            k.color(...COLORS.muted),
            k.anchor('bot'),
            k.z(211),
        ]);
        upgradeEntities.push(closeHint);
    }

    function closeUpgrade() {
        upgradeOpen      = false;
        upgradeSlotIdx   = null;
        upgradePanelRect = null;
        for (const e of upgradeEntities) {
            if (e && e._off) { e._off(); }
            else if (e && e.exists && e.exists()) { k.destroy(e); }
        }
        upgradeEntities = [];
    }

    // --------------------------------------------------------
    // Petal burst particles on bloom
    // --------------------------------------------------------
    function spawnPetalBurst(cx, cy, seedKey) {
        const seed   = SEEDS[seedKey];
        const colors = [seed.color, COLORS.pink, COLORS.accent, [255, 255, 200]];
        const COUNT  = 14;
        for (let p = 0; p < COUNT; p++) {
            const angle = (p / COUNT) * Math.PI * 2;
            const speed = 60 + Math.random() * 60;
            const vx    = Math.cos(angle) * speed;
            const vy    = Math.sin(angle) * speed - 30;
            const col   = colors[Math.floor(Math.random() * colors.length)];
            const petal = k.add([
                k.pos(cx, cy),
                k.rect(6, 6, { radius: 3 }),
                k.color(...col),
                k.anchor('center'),
                k.opacity(1),
                k.z(90),
                { t: 0, vx, vy, ox: cx, oy: cy },
            ]);
            petal.onUpdate(() => {
                petal.t += k.dt();
                petal.pos = k.vec2(petal.ox + petal.vx * petal.t, petal.oy + petal.vy * petal.t + 80 * petal.t * petal.t);
                petal.opacity = Math.max(0, 1 - petal.t / 0.7);
                if (petal.t > 0.7) k.destroy(petal);
            });
        }
    }

    // --------------------------------------------------------
    // Day cycle — "End Day" button
    // --------------------------------------------------------
    const dayBtn = k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 42),
        k.rect(160, 30, { radius: 8 }),
        k.color(60, 50, 90),
        k.anchor('center'),
        k.opacity(1),
        k.z(100),
        k.area(),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 42),
        k.text('End Day  (D)', { size: 13 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(101),
    ]);
    const DAY_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
    let lastDayEndTime = -DAY_COOLDOWN_MS; // allow immediately on first load
    dayBtn.onClick(() => triggerDayEnd());
    dayBtn.onHover(() => {
        if (Date.now() - lastDayEndTime >= DAY_COOLDOWN_MS) dayBtn.color = k.rgb(80, 65, 115);
    });
    dayBtn.onHoverEnd(() => {
        if (Date.now() - lastDayEndTime >= DAY_COOLDOWN_MS) dayBtn.color = k.rgb(60, 50, 90);
    });
    dayBtn.onUpdate(() => {
        const elapsed = Date.now() - lastDayEndTime;
        const ready = elapsed >= DAY_COOLDOWN_MS;
        dayBtn.opacity = ready ? 1 : 0.4;
    });

    // --------------------------------------------------------
    // Decoration shop — buy one-time passive bonuses
    // --------------------------------------------------------
    let decoShopOpen = false;
    let decoShopEntities = [];

    const decoBtn = k.add([
        k.pos(GAME_WIDTH / 2 + 100, GAME_HEIGHT - 42),
        k.rect(140, 30, { radius: 8 }),
        k.color(50, 70, 50),
        k.anchor('center'),
        k.opacity(1),
        k.z(100),
        k.area(),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2 + 100, GAME_HEIGHT - 42),
        k.text('Decorations  (G)', { size: 13 }),
        k.color(...COLORS.green),
        k.anchor('center'),
        k.z(101),
    ]);
    decoBtn.onClick(() => {
        if (shopOpen || upgradeOpen) return;
        if (decoShopOpen) closeDecoShop(); else openDecoShop();
    });
    decoBtn.onHover(() => { decoBtn.color = k.rgb(65, 90, 65); });
    decoBtn.onHoverEnd(() => { decoBtn.color = k.rgb(50, 70, 50); });

    function openDecoShop() {
        decoShopOpen = true;
        // Two-column layout; 8 items → 4 rows
        const ITEM_W = 280, ITEM_H = 52, COLS = 2;
        const decoKeys = Object.keys(DECORATIONS);
        const ROWS = Math.ceil(decoKeys.length / COLS);
        const PW = ITEM_W * COLS + 60;
        const PH = Math.min(680, 90 + ROWS * (ITEM_H + 8) + 40);
        const PX = (GAME_WIDTH - PW) / 2;
        const PY = Math.max(10, (GAME_HEIGHT - PH) / 2);

        const overlay = k.add([k.pos(0,0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0,0,0), k.opacity(0.55), k.z(200), k.area()]);
        decoShopEntities.push(overlay);

        const panel = k.add([k.pos(PX, PY), k.rect(PW, PH, { radius: 12 }), k.color(30, 45, 30), k.anchor('topleft'), k.z(201)]);
        decoShopEntities.push(panel);

        const title = k.add([k.pos(GAME_WIDTH/2, PY+22), k.text('Garden Decorations', { size: 24 }), k.color(...COLORS.green), k.anchor('top'), k.z(202)]);
        decoShopEntities.push(title);

        const sub = k.add([k.pos(GAME_WIDTH/2, PY+50), k.text('One-time purchases. Bonus applies to every harvest.', { size: 12 }), k.color(...COLORS.muted), k.anchor('top'), k.z(202)]);
        decoShopEntities.push(sub);

        const goldDisp = k.add([k.pos(PX+PW-16, PY+22), k.text(`Gold: ${state.gold}g`, { size: 14 }), k.color(...COLORS.gold), k.anchor('topright'), k.z(202)]);
        decoShopEntities.push(goldDisp);
        const offGold = events.on('goldChanged', (v) => { goldDisp.text = `Gold: ${v}g`; });
        decoShopEntities.push({ _off: offGold });

        decoKeys.forEach((key, idx) => {
            const deco  = DECORATIONS[key];
            const owned = state.decorations[key];
            const col   = idx % COLS;
            const row   = Math.floor(idx / COLS);
            const bx    = PX + 16 + col * (ITEM_W + 8);
            const by    = PY + 72 + row * (ITEM_H + 8);

            const btn = k.add([
                k.pos(bx, by),
                k.rect(ITEM_W, ITEM_H, { radius: 8 }),
                k.color(owned ? 28 : 42, owned ? 50 : 62, owned ? 28 : 42),
                k.anchor('topleft'),
                k.opacity(owned ? 0.65 : 1),
                k.z(202),
                k.area(),
            ]);
            decoShopEntities.push(btn);

            const nameLine = owned
                ? `${deco.emoji} ${deco.name}  (owned)`
                : `${deco.emoji} ${deco.name}  —  ${deco.cost}g`;
            const descLine = deco.description;
            const nameTxt = k.add([k.pos(bx+10, by+8), k.text(nameLine, { size: 12 }), k.color(owned ? 110 : 210, owned ? 170 : 230, owned ? 110 : 180), k.anchor('topleft'), k.z(203)]);
            decoShopEntities.push(nameTxt);
            const descTxt = k.add([k.pos(bx+10, by+26), k.text(descLine, { size: 10 }), k.color(...COLORS.muted), k.anchor('topleft'), k.z(203)]);
            decoShopEntities.push(descTxt);

            if (!owned) {
                btn.onClick(() => {
                    if (state.buyDecoration(key)) {
                        playBuy();
                        state.save();
                        closeDecoShop();
                        openDecoShop();
                    } else {
                        playNoGold();
                    }
                });
                btn.onHover(() => { btn.color = k.rgb(55, 82, 55); });
                btn.onHoverEnd(() => { btn.color = k.rgb(42, 62, 42); });
            }
        });

        const closeBtn = k.add([k.pos(GAME_WIDTH/2, PY+PH-14), k.text('Close  (G / ESC)', { size: 13 }), k.color(...COLORS.muted), k.anchor('bot'), k.opacity(1), k.z(203), k.area()]);
        decoShopEntities.push(closeBtn);
        closeBtn.onClick(() => closeDecoShop());
        closeBtn.onHover(() => { closeBtn.color = k.rgb(...COLORS.text); });
        closeBtn.onHoverEnd(() => { closeBtn.color = k.rgb(...COLORS.muted); });
    }

    function closeDecoShop() {
        decoShopOpen = false;
        for (const e of decoShopEntities) {
            if (e && e._off) e._off();
            else if (e && e.exists && e.exists()) k.destroy(e);
        }
        decoShopEntities = [];
    }

    // --------------------------------------------------------
    // Achievement toast — queued so toasts never overlap
    // --------------------------------------------------------
    const achieveQueue = [];
    let achieveToastActive = false;

    function showNextAchieveToast() {
        if (achieveToastActive || achieveQueue.length === 0) return;
        achieveToastActive = true;
        const { name, desc } = achieveQueue.shift();
        playBloom();
        const toastY = 60;
        const toast = k.add([
            k.pos(GAME_WIDTH / 2, toastY),
            k.rect(420, 52, { radius: 10 }),
            k.color(50, 38, 70),
            k.anchor('top'),
            k.opacity(0),
            k.z(300),
            { t: 0 },
        ]);
        const toastTxt = k.add([
            k.pos(GAME_WIDTH / 2, toastY + 10),
            k.text(`Achievement: ${name}\n${desc}`, { size: 13 }),
            k.color(...COLORS.accent),
            k.anchor('top'),
            k.opacity(0),
            k.z(301),
            { t: 0 },
        ]);
        toast.onUpdate(() => {
            toast.t += k.dt();
            const alpha = toast.t < 0.4 ? toast.t / 0.4
                        : toast.t < 2.5 ? 1
                        : Math.max(0, 1 - (toast.t - 2.5) / 0.5);
            toast.opacity = alpha * 0.92;
            toastTxt.opacity = alpha;
            if (toast.t > 3.0) {
                k.destroy(toast);
                k.destroy(toastTxt);
                achieveToastActive = false;
                showNextAchieveToast();
            }
        });
    }

    events.on('achievementUnlocked', (_id, name, desc) => {
        achieveQueue.push({ name, desc });
        showNextAchieveToast();
    });

    function triggerDayEnd() {
        if (shopOpen || upgradeOpen) return;
        if (Date.now() - lastDayEndTime < DAY_COOLDOWN_MS) return;
        lastDayEndTime = Date.now();
        // Small gold bonus per day
        const bonus = 3 + state.day;
        state.addGold(bonus);
        spawnGoldPopup(k, GAME_WIDTH / 2, GAME_HEIGHT / 2, bonus);
        state.advanceDay();
        playDayEnd();
        state.save();
    }

    // --------------------------------------------------------
    // Update loop — grow plants
    // --------------------------------------------------------
    k.onUpdate(() => {
        // Close upgrade panel when mouse leaves both the pot tile and the panel
        if (upgradeOpen && upgradePanelRect) {
            const slotIdx = upgradeSlotIdx;
            const mx = k.mousePos().x;
            const my = k.mousePos().y;
            const pr = upgradePanelRect;
            const inPanel = mx >= pr.x && mx <= pr.x + pr.w && my >= pr.y && my <= pr.y + pr.h;
            const potCx = SLOT_START_X + slotIdx * SLOT_SPACING;
            const potLeft = potCx - POT_W / 2;
            const inPot = mx >= potLeft && mx <= potLeft + POT_W && my >= SLOT_AREA_Y && my <= SLOT_AREA_Y + POT_H;
            if (!inPanel && !inPot) closeUpgrade();
        }

        if (state.isPaused || shopOpen) return;

        for (let i = 0; i < SLOT_COUNT; i++) {
            const slot   = state.getSlot(i);
            const ent    = slotEntities[i];
            if (!slot.seedKey) {
                ent.stageText.text = '🪴';
                ent.progressBar.width = 1;
                ent.potLabel.text = POTS[slot.potKey].name;
                ent.labelText.text = `Slot ${i + 1}`;
                ent.labelText.color = k.rgb(...COLORS.muted);
                continue;
            }

            const seed     = SEEDS[slot.seedKey];
            const pot      = POTS[slot.potKey];
            const soil     = SOILS[slot.soilKey];
            const speedMul = (1 + (pot.speedBonus + soil.speedBonus) / 100) * state.seasonSpeedMod;
            const prevProg = slot.growProgress;

            if (slot.growProgress < 1) {
                slot.growProgress = Math.min(1, slot.growProgress + k.dt() / (seed.growTime / speedMul));
            }

            // Check for bloom
            if (prevProg < 1 && slot.growProgress >= 1) {
                playBloom();
                const cx2 = SLOT_START_X + i * SLOT_SPACING;
                spawnPetalBurst(cx2, SLOT_AREA_Y + 30, slot.seedKey);
            }

            // Stage emoji
            const stageIdx = GROW_STAGES.findIndex((t, i2) =>
                slot.growProgress <= t && (i2 === 0 || slot.growProgress > GROW_STAGES[i2 - 1])
            );
            const emojis = ['🌱', '🌿', seed.emoji, seed.emoji];
            const eIdx   = Math.min(Math.max(stageIdx - 1, 0), emojis.length - 1);
            ent.stageText.text = slot.growProgress >= 1 ? seed.emoji : emojis[eIdx];

            // Progress bar
            const barW = Math.max(1, Math.floor((POT_W - 16) * slot.growProgress));
            ent.progressBar.width = barW;
            ent.progressBar.color = slot.growProgress >= 1
                ? k.rgb(...COLORS.gold)
                : k.rgb(...COLORS.green);

            // "Harvest" hint on ready
            if (slot.growProgress >= 1) {
                ent.labelText.text = 'Click to harvest!';
                ent.labelText.color = k.rgb(...COLORS.gold);
            } else {
                ent.labelText.text = `Slot ${i + 1}`;
                ent.labelText.color = k.rgb(...COLORS.muted);
            }

            ent.potLabel.text = POTS[slot.potKey].name;
        }
    });

    // --------------------------------------------------------
    // Achievements panel
    // --------------------------------------------------------
    let achievePanelOpen = false;
    let achievePanelEntities = [];

    const achieveBtn = k.add([
        k.pos(GAME_WIDTH / 2 - 100, GAME_HEIGHT - 42),
        k.rect(140, 30, { radius: 8 }),
        k.color(55, 45, 75),
        k.anchor('center'),
        k.opacity(1),
        k.z(100),
        k.area(),
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2 - 100, GAME_HEIGHT - 42),
        k.text('Achievements  (A)', { size: 13 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(101),
    ]);
    achieveBtn.onClick(() => {
        if (shopOpen || upgradeOpen || decoShopOpen) return;
        if (achievePanelOpen) closeAchievementsPanel(); else openAchievementsPanel();
    });
    achieveBtn.onHover(() => { achieveBtn.color = k.rgb(75, 60, 100); });
    achieveBtn.onHoverEnd(() => { achieveBtn.color = k.rgb(55, 45, 75); });

    function openAchievementsPanel() {
        achievePanelOpen = true;
        const PW = 520, PH = 420;
        const PX = (GAME_WIDTH - PW) / 2;
        const PY = (GAME_HEIGHT - PH) / 2;

        const overlay = k.add([k.pos(0,0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0,0,0), k.opacity(0.55), k.z(200), k.area()]);
        achievePanelEntities.push(overlay);

        const panel = k.add([k.pos(PX, PY), k.rect(PW, PH, { radius: 12 }), k.color(35, 28, 52), k.anchor('topleft'), k.z(201)]);
        achievePanelEntities.push(panel);

        const unlocked = state.achievements.size;
        const total    = state.getAchievementDefs().length;
        const title = k.add([k.pos(GAME_WIDTH/2, PY+20), k.text(`Achievements  (${unlocked}/${total})`, { size: 22 }), k.color(...COLORS.accent), k.anchor('top'), k.z(202)]);
        achievePanelEntities.push(title);

        const defs = state.getAchievementDefs();
        const COLS = 2;
        const itemW = (PW - 40) / COLS;
        const itemH = 48;
        defs.forEach((def, idx) => {
            const col   = idx % COLS;
            const row   = Math.floor(idx / COLS);
            const ix    = PX + 16 + col * itemW;
            const iy    = PY + 58 + row * (itemH + 6);
            const owned = state.achievements.has(def.id);

            const bg = k.add([k.pos(ix, iy), k.rect(itemW - 8, itemH, { radius: 6 }), k.color(owned ? 45 : 30, owned ? 38 : 28, owned ? 65 : 45), k.anchor('topleft'), k.z(202)]);
            achievePanelEntities.push(bg);

            const nameStr = owned ? `${def.name}` : '???';
            const descStr = owned ? def.desc : 'Not yet unlocked';
            const nameTxt = k.add([k.pos(ix+8, iy+6), k.text(nameStr, { size: 12 }), k.color(owned ? 255 : 100, owned ? 200 : 90, owned ? 100 : 120), k.anchor('topleft'), k.z(203)]);
            achievePanelEntities.push(nameTxt);
            const descTxt = k.add([k.pos(ix+8, iy+24), k.text(descStr, { size: 10 }), k.color(...COLORS.muted), k.anchor('topleft'), k.z(203)]);
            achievePanelEntities.push(descTxt);
        });

        const closeBtn = k.add([k.pos(GAME_WIDTH/2, PY+PH-16), k.text('Close  (A / ESC)', { size: 13 }), k.color(...COLORS.muted), k.anchor('bot'), k.opacity(1), k.z(203), k.area()]);
        achievePanelEntities.push(closeBtn);
        closeBtn.onClick(() => closeAchievementsPanel());
        closeBtn.onHover(() => { closeBtn.color = k.rgb(...COLORS.text); });
        closeBtn.onHoverEnd(() => { closeBtn.color = k.rgb(...COLORS.muted); });
    }

    function closeAchievementsPanel() {
        achievePanelOpen = false;
        for (const e of achievePanelEntities) {
            if (e && e._off) e._off();
            else if (e && e.exists && e.exists()) k.destroy(e);
        }
        achievePanelEntities = [];
    }

    // --------------------------------------------------------
    // Season HUD label (bottom-left)
    // --------------------------------------------------------
    const seasonLabel = k.add([
        k.pos(16, GAME_HEIGHT - 12),
        k.text('', { size: 13 }),
        k.color(...COLORS.text),
        k.anchor('botleft'),
        k.z(100),
    ]);
    function updateSeasonLabel() {
        const s = state.season;
        seasonLabel.text = `${s.emoji} ${s.name}  Day ${state.dayInSeason}/${s.durationDays}`;
        seasonLabel.color = k.rgb(...s.color);
    }
    updateSeasonLabel();
    events.on('dayAdvanced',   () => updateSeasonLabel());
    events.on('seasonChanged', () => updateSeasonLabel());

    // --------------------------------------------------------
    // Build visuals
    // --------------------------------------------------------
    buildSlotVisuals();

    // --------------------------------------------------------
    // Key bindings
    // --------------------------------------------------------
    k.onKeyPress('s', () => {
        if (!shopOpen) openShop(null);
        else closeShop();
    });

    k.onKeyPress('d', () => { triggerDayEnd(); });

    k.onKeyPress('g', () => {
        if (shopOpen || upgradeOpen) return;
        if (decoShopOpen) closeDecoShop(); else openDecoShop();
    });

    k.onKeyPress('a', () => { openAchievementsPanel(); });

    k.onKeyPress('escape', () => {
        if (shopOpen)     { closeShop();     return; }
        if (upgradeOpen)  { closeUpgrade();  return; }
        if (decoShopOpen) { closeDecoShop(); return; }
        if (achievePanelOpen) { closeAchievementsPanel(); return; }
        events.clearAll();
        k.go('splash');
    });

    k.onKeyPress('r', () => {
        if (shopOpen) return;
        state.deleteSave();
        events.clearAll();
        k.go('game');
    });

    k.onSceneLeave(() => {
        events.clearAll();
    });
});

// ============================================================
// Start
// ============================================================

k.go('splash');
