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

import { GAME_WIDTH, GAME_HEIGHT, COLORS, SEEDS, POTS, SOILS, SLOT_COUNT, GROW_STAGES } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, spawnGoldPopup } from './ui.js';
import { initAudio, playUiClick, playPlant, playBloom, playHarvest, playBuy, playNoGold } from './sounds.js';

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
        k.text('Phase 1', { size: 10 }),
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
    state.reset();
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
    // Shop panel state
    // --------------------------------------------------------
    let shopOpen       = false;
    let shopEntities   = [];
    let selectedSlotForShop = null;   // which slot triggered the shop

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
                if (shopOpen) return;
                handleSlotClick(i);
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
            }
        }
        // else: growing — do nothing (show tooltip TODO)
    }

    // --------------------------------------------------------
    // Shop panel
    // --------------------------------------------------------
    function openShop(slotIndex) {
        shopOpen = true;
        selectedSlotForShop = slotIndex;
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
        selectedSlotForShop = null;
        for (const e of shopEntities) {
            if (e && e._off) { e._off(); }
            else if (e && e.exists && e.exists()) { k.destroy(e); }
        }
        shopEntities = [];
        events.emit('shopClosed');
    }

    // --------------------------------------------------------
    // Update loop — grow plants
    // --------------------------------------------------------
    k.onUpdate(() => {
        if (state.isPaused || shopOpen) return;

        for (let i = 0; i < SLOT_COUNT; i++) {
            const slot   = state.getSlot(i);
            const ent    = slotEntities[i];
            if (!slot.seedKey) {
                ent.stageText.text = '🪴';
                ent.progressBar.width = 1;
                ent.potLabel.text = POTS[slot.potKey].name;
                continue;
            }

            const seed     = SEEDS[slot.seedKey];
            const pot      = POTS[slot.potKey];
            const soil     = SOILS[slot.soilKey];
            const speedMul = 1 + (pot.speedBonus + soil.speedBonus) / 100;
            const prevProg = slot.growProgress;

            if (slot.growProgress < 1) {
                slot.growProgress = Math.min(1, slot.growProgress + k.dt() / (seed.growTime / speedMul));
            }

            // Check for bloom
            if (prevProg < 1 && slot.growProgress >= 1) {
                playBloom();
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

    k.onKeyPress('escape', () => {
        if (shopOpen) { closeShop(); return; }
        events.clearAll();
        k.go('splash');
    });

    k.onKeyPress('r', () => {
        if (shopOpen) return;
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
