/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'    — Title screen, waits for any key or click
 *   'collection'— Browse owned cards and set party
 *   'gacha'     — Pull new cards from the tarot banner
 *   'battle'    — Auto-battler combat scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { CARD_DEFS } from './cards.js';
import { initGacha, pullSingle, pullTen, clearSave } from './gacha.js';
// import { initCollection } from './collection.js';  // Phase 3
// import { initBattle }     from './battle.js';      // Phase 4

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
// Asset loading — all 78 tarot card sprites
// ============================================================

const CARD_IMG_BASE = 'res/tarot/cards/';

for (const card of CARD_DEFS) {
    k.loadSprite(card.img, `${CARD_IMG_BASE}${card.img}.jpg`);
}

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Decorative subtitle
    k.add([
        k.pos(CX, CY - 140),
        k.text('TAROT AUTO BATTLER', { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 80),
        k.text('ARCANA PULL', { size: 72 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Flavour line
    k.add([
        k.pos(CX, CY - 10),
        k.text('Collect the Major Arcana. Build your party. Conquer fate.', { size: 14 }),
        k.color(...COLORS.silver),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, CY + 60),
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
        k.text('(G) Gacha Pull   (C) Collection   (B) Battle', { size: 13 }),
        k.color(80, 60, 140),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 2', { size: 10 }),
        k.color(50, 40, 80),
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
// SCENE: game  (hub / main menu between runs)
// ============================================================

k.scene('game', () => {
    // Only reset on a genuinely fresh run (no saved collection).
    // initGacha() loads from localStorage; if collection is still empty, it's a new run.
    initGacha();
    if (state.collection.length === 0) state.reset();

    initUI(k);

    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Hub background
    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(...COLORS.bgPanel), k.z(0)]);

    k.add([k.pos(CX, 55), k.text('ARCANA PULL', { size: 40 }), k.color(...COLORS.gold), k.anchor('center'), k.z(1)]);
    k.add([k.pos(CX, 100), k.text('Collect the Major Arcana. Build your party. Conquer fate.', { size: 13 }), k.color(...COLORS.silver), k.anchor('center'), k.z(1)]);

    // Status strip
    k.add([k.pos(CX, CY - 120), k.text(`Wave ${state.wave}  |  ${state.collection.length} Cards Owned  |  Party: ${state.party.length}/4`, { size: 15 }), k.color(...COLORS.text), k.anchor('center'), k.z(1)]);

    // Menu options
    const menuItems = [
        { label: '(G) Gacha — Pull Cards',      scene: 'gacha',      color: COLORS.accent },
        { label: '(C) Collection — View Party',  scene: 'collection', color: COLORS.mana   },
        { label: '(B) Battle — Start Wave',      scene: 'battle',     color: COLORS.success },
    ];
    menuItems.forEach((item, i) => {
        const btn = k.add([
            k.pos(CX, CY - 40 + i * 70),
            k.rect(460, 50, { radius: 6 }),
            k.color(25, 16, 55),
            k.outline(1, k.rgb(...item.color)),
            k.anchor('center'),
            k.area(),
            k.z(1),
        ]);
        k.add([k.pos(CX, CY - 40 + i * 70), k.text(item.label, { size: 20 }), k.color(...item.color), k.anchor('center'), k.z(2)]);
        btn.onClick(() => { playUiClick(); events.clearAll(); k.go(item.scene); });
        btn.onHover(() => { btn.color = k.rgb(40, 25, 80); });
        btn.onHoverEnd(() => { btn.color = k.rgb(25, 16, 55); });
    });

    k.add([k.pos(CX, GAME_HEIGHT - 22), k.text('(R) New Run  |  (ESC) Title', { size: 11 }), k.color(60, 50, 100), k.anchor('center'), k.z(1)]);

    k.onKeyPress('g', () => { playUiClick(); events.clearAll(); k.go('gacha'); });
    k.onKeyPress('c', () => { playUiClick(); events.clearAll(); k.go('collection'); });
    k.onKeyPress('b', () => { playUiClick(); events.clearAll(); k.go('battle'); });

    k.onKeyPress('r', () => {
        state.reset();
        events.clearAll();
        k.go('game');
    });

    k.onKeyPress('escape', () => {
        events.clearAll();
        k.go('splash');
    });

    k.onSceneLeave(() => events.clearAll());
});

// ============================================================
// SCENE STUBS — fill in during Phase 2+
// ============================================================

// ============================================================
// SCENE: gacha
// ============================================================
//
// Layout (1280×720):
//   Top bar    y=0..50   — HUD (gems, pity meter)
//   Left panel x=0..400  — Banner art + pity info
//   Center     x=400..880— Card reveal area (flip animation)
//   Right      x=880..1280— Pull buttons + result list
//
// States: 'idle' → 'flipping' → 'reveal' → 'idle'
// ============================================================

k.scene('gacha', () => {
    initGacha();   // load saved data (no-op if already loaded)

    const CX = GAME_WIDTH / 2;

    // ---- Background ----
    k.add([k.pos(0,0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(...COLORS.bg), k.z(0)]);

    // ---- Top bar ----
    k.add([k.pos(0,0), k.rect(GAME_WIDTH, 50), k.color(...COLORS.bgPanel), k.z(1)]);
    k.add([k.pos(12,10), k.text('GACHA BANNER', { size: 18 }), k.color(...COLORS.gold), k.anchor('topleft'), k.z(2)]);

    const gemsHud = k.add([
        k.pos(CX, 10),
        k.text(`GEMS  ${state.gems}`, { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('top'),
        k.z(2),
    ]);
    const pityHud = k.add([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`PITY  ${state.pullCount} / 90`, { size: 14 }),
        k.color(...COLORS.silver),
        k.anchor('topright'),
        k.z(2),
    ]);

    // Update HUD when gems change
    const offGems = events.on('gemsChanged', v => { gemsHud.text = `GEMS  ${v}`; });
    k.onSceneLeave(() => offGems());

    // ---- Left panel: banner info ----
    k.add([k.pos(0, 50), k.rect(380, GAME_HEIGHT - 50), k.color(12, 8, 28), k.z(1)]);
    k.add([k.pos(190, 120), k.text('TAROT BANNER', { size: 22 }), k.color(...COLORS.accent), k.anchor('center'), k.z(2)]);
    k.add([k.pos(190, 160), k.text('The 78-card tarot deck awaits.', { size: 13 }), k.color(...COLORS.silver), k.anchor('center'), k.z(2)]);

    // Rarity rates display
    const rarityLines = [
        { label: 'Common',    pct: '60%', color: COLORS.silver },
        { label: 'Uncommon',  pct: '25%', color: [100, 220, 120] },
        { label: 'Rare',      pct: '12%', color: COLORS.mana },
        { label: 'Legendary', pct:  '3%', color: COLORS.gold },
    ];
    rarityLines.forEach((r, i) => {
        k.add([k.pos(60, 220 + i * 30), k.text(`${r.label}`, { size: 14 }), k.color(...r.color), k.anchor('left'), k.z(2)]);
        k.add([k.pos(300, 220 + i * 30), k.text(r.pct, { size: 14 }), k.color(...r.color), k.anchor('right'), k.z(2)]);
    });

    k.add([k.pos(190, 360), k.text('Pity: guaranteed Legendary\nafter 90 pulls', { size: 12 }), k.color(120, 100, 180), k.anchor('center'), k.z(2)]);

    // Single-pull cost
    k.add([k.pos(190, 430), k.text('Single Pull:  60 Gems', { size: 14 }), k.color(...COLORS.text), k.anchor('center'), k.z(2)]);
    k.add([k.pos(190, 460), k.text('10-Pull:     500 Gems', { size: 14 }), k.color(...COLORS.text), k.anchor('center'), k.z(2)]);

    // (ESC) back hint
    k.add([k.pos(190, GAME_HEIGHT - 30), k.text('(ESC) Back to Hub', { size: 12 }), k.color(80, 60, 130), k.anchor('center'), k.z(2)]);

    // ---- Centre: card reveal area ----
    const CARD_X = 640;
    const CARD_Y = 360;
    const CARD_W = 200;
    const CARD_H = 320;

    // Card back (shown during flip animation)
    const cardBack = k.add([
        k.pos(CARD_X, CARD_Y),
        k.rect(CARD_W, CARD_H, { radius: 8 }),
        k.color(30, 20, 60),
        k.outline(2, k.rgb(100, 60, 180)),
        k.anchor('center'),
        k.opacity(0),
        k.z(5),
    ]);
    k.add([k.pos(CARD_X, CARD_Y), k.text('?', { size: 72 }), k.color(...COLORS.accent), k.anchor('center'), k.opacity(0), k.z(6), 'cardBackText']);

    // Card face border (shown behind the sprite on reveal)
    const cardFaceRect = k.add([
        k.pos(CARD_X, CARD_Y),
        k.rect(CARD_W, CARD_H, { radius: 8 }),
        k.color(20, 12, 40),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.anchor('center'),
        k.opacity(0),
        k.z(5),
        'cardFaceRect',
    ]);

    // Labels sit below the card (card bottom = CARD_Y + CARD_H/2 = 520)
    const LABEL_Y = CARD_Y + CARD_H / 2 + 22;
    const cardNameLabel   = k.add([k.pos(CARD_X, LABEL_Y),      k.text('', { size: 16 }), k.color(...COLORS.text),   k.anchor('center'), k.opacity(0), k.z(7), 'cardLabel']);
    const cardRarityLabel = k.add([k.pos(CARD_X, LABEL_Y + 24), k.text('', { size: 13 }), k.color(...COLORS.gold),   k.anchor('center'), k.opacity(0), k.z(7), 'cardLabel']);
    const cardStatsLabel  = k.add([k.pos(CARD_X, LABEL_Y + 46), k.text('', { size: 11 }), k.color(...COLORS.silver), k.anchor('center'), k.opacity(0), k.z(7), 'cardLabel']);
    const cardNewBadge    = k.add([k.pos(CARD_X + CARD_W / 2 - 10, CARD_Y - CARD_H / 2 + 10), k.text('NEW!', { size: 13 }), k.color(...COLORS.success), k.anchor('topright'), k.opacity(0), k.z(8), 'cardLabel']);
    const cardDupeBadge   = k.add([k.pos(CARD_X + CARD_W / 2 - 10, CARD_Y - CARD_H / 2 + 10), k.text('+1',   { size: 13 }), k.color(160,120,255),       k.anchor('topright'), k.opacity(0), k.z(8), 'cardLabel']);

    // Current card sprite entity (destroyed and re-created on each reveal)
    let cardSpriteEntity = null;

    // Glow ring (rarity flash)
    const glowRect = k.add([
        k.pos(CARD_X, CARD_Y),
        k.rect(CARD_W + 20, CARD_H + 20, { radius: 12 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.opacity(0),
        k.z(4),
        'glow',
    ]);

    // ---- Right panel: result list + buttons ----
    k.add([k.pos(880, 50), k.rect(400, GAME_HEIGHT - 50), k.color(10, 6, 24), k.z(1)]);
    k.add([k.pos(1080, 70), k.text('PULL HISTORY', { size: 14 }), k.color(...COLORS.accent), k.anchor('center'), k.z(2)]);

    // Result list (shows last 10 pulled names)
    const resultLines = [];
    for (let i = 0; i < 10; i++) {
        resultLines.push(k.add([
            k.pos(895, 95 + i * 34),
            k.text('', { size: 13 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(2),
        ]));
    }
    let resultHead = 0;

    function addResultLine(card) {
        const rarityColor = {
            COMMON: COLORS.silver, UNCOMMON: [100,220,120],
            RARE: COLORS.mana,     LEGENDARY: COLORS.gold,
        }[card.rarity] || COLORS.text;
        const badge = card.isNew ? ' NEW' : card.isDupe ? ' +1' : '';
        resultLines[resultHead % 10].text  = `${card.name}${badge}`;
        resultLines[resultHead % 10].color = k.rgb(...rarityColor);
        resultHead++;
        pityHud.text = `PITY  ${state.pullCount} / 90`;
    }

    // ---- Pull buttons ----
    const BTN_W = 340, BTN_H = 52;
    const BTN_X = 1080;

    function makeButton(label, y, color, onClick) {
        const bg = k.add([
            k.pos(BTN_X, y),
            k.rect(BTN_W, BTN_H, { radius: 6 }),
            k.color(...color),
            k.anchor('center'),
            k.z(3),
            k.area(),
        ]);
        const lbl = k.add([k.pos(BTN_X, y), k.text(label, { size: 16 }), k.color(...COLORS.bg), k.anchor('center'), k.z(4)]);
        bg.onClick(() => onClick());
        bg.onHover(() => { bg.color = k.rgb(Math.min(color[0]+40,255), Math.min(color[1]+40,255), Math.min(color[2]+40,255)); });
        bg.onHoverEnd(() => { bg.color = k.rgb(...color); });
        return { bg, lbl };
    }

    makeButton('(G) Single Pull — 60 Gems', 560, [80, 50, 160], doSinglePull);
    makeButton('(T) 10-Pull — 500 Gems',    630, [140, 80, 30],  doTenPull);

    // Clear save button (small, bottom-left of right panel)
    k.add([k.pos(895, GAME_HEIGHT - 30), k.text('(DEL) Clear Save', { size: 11 }), k.color(80, 40, 80), k.anchor('left'), k.z(2)]);

    // ---- Animation state machine ----
    let animState  = 'idle';  // 'idle' | 'flipping' | 'reveal'
    let animTimer  = 0;
    let pendingCards = [];    // cards waiting to be shown
    let currentCard  = null;

    function _showIdle() {
        animState = 'idle';
        cardBack.opacity = 0;
        cardFaceRect.opacity = 0;
        glowRect.opacity = 0;
        for (const e of k.get('cardLabel'))    e.opacity = 0;
        for (const e of k.get('cardBackText')) e.opacity = 0;
        if (cardSpriteEntity) { cardSpriteEntity.destroy(); cardSpriteEntity = null; }
    }

    function _startFlip(card) {
        currentCard = card;
        animState = 'flipping';
        animTimer = 0;
        // Destroy previous sprite so old art doesn't linger
        if (cardSpriteEntity) { cardSpriteEntity.destroy(); cardSpriteEntity = null; }
        cardBack.opacity = 1;
        for (const e of k.get('cardBackText')) e.opacity = 1;
        cardFaceRect.opacity = 0;
        glowRect.opacity = 0;
        for (const e of k.get('cardLabel')) e.opacity = 0;
        import('./sounds.js').then(s => s.playCardFlip());
    }

    function _showReveal(card) {
        animState = 'reveal';
        animTimer = 0;

        // Hide back
        cardBack.opacity = 0;
        for (const e of k.get('cardBackText')) e.opacity = 0;

        // Spawn the card art sprite (destroy any leftover first)
        if (cardSpriteEntity) { cardSpriteEntity.destroy(); cardSpriteEntity = null; }
        cardSpriteEntity = k.add([
            k.pos(CARD_X, CARD_Y),
            k.sprite(card.img, { width: CARD_W, height: CARD_H }),
            k.anchor('center'),
            k.z(6),
            'cardSprite',
        ]);

        // Set rarity glow color
        const glowColor = {
            COMMON: [160,160,160], UNCOMMON: [100,220,120],
            RARE: [80,140,255],    LEGENDARY: [255,180,0],
        }[card.rarity] || [255,255,255];
        glowRect.color = k.rgb(...glowColor);
        glowRect.opacity = 0.5;
        cardFaceRect.color = k.rgb(...glowColor.map(c => Math.floor(c * 0.15)));
        cardFaceRect.opacity = 1;

        // Labels
        cardNameLabel.text    = card.name;
        cardNameLabel.color   = k.rgb(...glowColor);
        cardNameLabel.opacity = 1;

        cardRarityLabel.text    = card.rarity;
        cardRarityLabel.color   = k.rgb(...glowColor);
        cardRarityLabel.opacity = 1;

        cardStatsLabel.text    = `HP ${card.hp}  ATK ${card.atk}  SPD ${card.spd}  DEF ${card.def}`;
        cardStatsLabel.opacity = 1;

        cardNewBadge.opacity  = card.isNew  ? 1 : 0;
        cardDupeBadge.opacity = card.isDupe ? 1 : 0;

        // Play rarity sound
        import('./sounds.js').then(s => {
            if (card.rarity === 'LEGENDARY')  s.playPullLegendary();
            else if (card.rarity === 'RARE')  s.playPullRare();
            else                              s.playPullCommon();
        });

        addResultLine(card);
    }

    // ---- Update loop (animate glow + auto-advance) ----
    k.onUpdate(() => {
        if (animState === 'flipping') {
            animTimer += k.dt();
            // Flip duration: 0.35s — pulse the card back opacity
            cardBack.opacity = 0.5 + 0.5 * Math.abs(Math.sin(animTimer * Math.PI / 0.35));
            if (animTimer >= 0.35) {
                _showReveal(currentCard);
            }
        } else if (animState === 'reveal') {
            animTimer += k.dt();
            // Pulse the glow
            glowRect.opacity = 0.3 + 0.2 * Math.sin(animTimer * Math.PI * 2);
            // Auto-advance if more cards queued, or return to idle after 1.5s
            if (pendingCards.length > 0 && animTimer >= 0.8) {
                _startFlip(pendingCards.shift());
            } else if (pendingCards.length === 0 && animTimer >= 1.5) {
                _showIdle();
            }
        }
    });

    // ---- Pull actions ----
    function doSinglePull() {
        if (animState !== 'idle') return;
        const results = pullSingle();
        if (!results) {
            import('./sounds.js').then(s => s.playUiClick());
            return; // not enough gems
        }
        import('./sounds.js').then(s => s.playUiClick());
        pendingCards = results.slice(1);
        _startFlip(results[0]);
    }

    function doTenPull() {
        if (animState !== 'idle') return;
        const results = pullTen();
        if (!results) {
            import('./sounds.js').then(s => s.playUiClick());
            return;
        }
        import('./sounds.js').then(s => s.playUiClick());
        pendingCards = results.slice(1);
        _startFlip(results[0]);
    }

    // ---- Key bindings ----
    k.onKeyPress('g', doSinglePull);
    k.onKeyPress('t', doTenPull);
    k.onKeyPress('escape', () => { events.clearAll(); k.go('game'); });
    k.onKeyPress('delete', () => { clearSave(); pityHud.text = 'PITY  0 / 90'; gemsHud.text = `GEMS  ${state.gems}`; });

    k.onSceneLeave(() => {
        if (cardSpriteEntity) { cardSpriteEntity.destroy(); cardSpriteEntity = null; }
        events.clearAll();
    });
});

k.scene('collection', () => {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY),
        k.text('COLLECTION SCENE — coming soon\n\n(ESC) back', { size: 24 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress('escape', () => k.go('game'));
    k.onSceneLeave(() => events.clearAll());
});

k.scene('battle', () => {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY),
        k.text('BATTLE SCENE — coming soon\n\n(ESC) back', { size: 24 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress('escape', () => k.go('game'));
    k.onSceneLeave(() => events.clearAll());
});

// ============================================================
// Start
// ============================================================

k.go('splash');
