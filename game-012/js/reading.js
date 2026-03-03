/**
 * reading.js — The Reading scene (Phase 5).
 *
 * Triggered after wave 5 and wave 10 are cleared.
 * Draws one card from the player's collection at random.
 * 30% chance the card is reversed (curse); 70% upright (blessing).
 *
 * Layout (1280×720):
 *   Centre        — animated card + omen reveal text
 *   Left panel    — reading flavour / spread art
 *   Right panel   — omen effect description + continue button
 *
 * Flow:
 *   1. Card back slides in and glows (playReadingFlip)
 *   2. After 1.2s, card flips to face (upright or rotated 180°)
 *   3. Omen text fades in; player reads and presses ENTER/click to confirm
 *   4. omen applied via state.applyOmen() → go('game')
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    COLORS, REVERSED_CHANCE,
    BLESSINGS, CURSES, LEGENDARY_ITEMS,
    MAX_ITEMS,
} from './config.js';
import {
    playReadingFlip, playOmenBlessing, playOmenCurse, playItemUsed, playUiClick,
} from './sounds.js';
import { saveCollection } from './gacha.js';
import { initNavBar } from './ui.js';

// ----------------------------------------------------------------
// Suit → blessing index mapping (deterministic for a given suit draw)
// ----------------------------------------------------------------

const SUIT_BLESSING = {
    wands:     0,  // Blaze
    swords:    1,  // Clarity
    pentacles: 2,  // Ward
    cups:      3,  // Mending
    major:     4,  // Fortune (legendary item)
};

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

export function initReading(k) {
    const W = 1280;
    const H = 720;
    const CX = W / 2;
    const CY = H / 2;

    // ---- Background ----
    k.add([k.pos(0, 0), k.rect(W, H), k.color(...COLORS.bg), k.z(0)]);

    // Starfield (static decorative dots)
    for (let i = 0; i < 80; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sr = 1 + Math.random() * 2;
        const sb = 100 + Math.floor(Math.random() * 155);
        k.add([k.pos(sx, sy), k.rect(sr, sr), k.color(sb, sb, sb + 40), k.opacity(0.4 + Math.random() * 0.4), k.z(0)]);
    }

    // ---- Title ----
    k.add([
        k.pos(CX, 32),
        k.text('THE READING', { size: 32 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(2),
    ]);

    k.add([
        k.pos(CX, 68),
        k.text('A card is drawn from your collection...', { size: 14 }),
        k.color(...COLORS.silver),
        k.anchor('center'),
        k.z(2),
    ]);

    // ---- Left info panel ----
    k.add([k.pos(0, 0), k.rect(260, H), k.color(10, 6, 24), k.z(1)]);
    k.add([k.pos(130, 120), k.text('THE SPREAD', { size: 18 }), k.color(...COLORS.accent), k.anchor('center'), k.z(2)]);
    k.add([k.pos(130, 160), k.text('One card is drawn\nfrom your collection\nat random.', { size: 12 }), k.color(...COLORS.silver), k.anchor('center'), k.z(2)]);
    k.add([k.pos(130, 260), k.text('Upright (70%):\nA blessing is granted\nfor 5 waves.', { size: 12 }), k.color(...COLORS.success), k.anchor('center'), k.z(2)]);
    k.add([k.pos(130, 360), k.text('Reversed (30%):\nA curse is inflicted\nfor 5 waves.', { size: 12 }), k.color(...COLORS.danger), k.anchor('center'), k.z(2)]);

    // Wave indicator
    k.add([k.pos(130, 480), k.text(`Wave ${state.wave - 1} cleared`, { size: 13 }), k.color(...COLORS.gold), k.anchor('center'), k.z(2)]);

    // ---- Right detail panel ----
    k.add([k.pos(W - 320, 0), k.rect(320, H), k.color(10, 6, 24), k.z(1)]);

    const omenTitle = k.add([k.pos(W - 160, 100), k.text('', { size: 20 }), k.color(...COLORS.gold), k.anchor('center'), k.opacity(0), k.z(3)]);
    const omenType  = k.add([k.pos(W - 160, 132), k.text('', { size: 14 }), k.color(...COLORS.accent), k.anchor('center'), k.opacity(0), k.z(3)]);
    const omenDesc  = k.add([k.pos(W - 160, 200), k.text('', { size: 13 }), k.color(...COLORS.text), k.anchor('center'), k.opacity(0), k.z(3)]);
    const omenDur   = k.add([k.pos(W - 160, 280), k.text('', { size: 12 }), k.color(...COLORS.silver), k.anchor('center'), k.opacity(0), k.z(3)]);

    // Continue button (hidden initially)
    const contBtn = k.add([
        k.pos(W - 160, H - 100),
        k.rect(260, 50, { radius: 6 }),
        k.color(25, 16, 55),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.anchor('center'),
        k.area(),
        k.opacity(0),
        k.z(3),
    ]);
    const contLabel = k.add([
        k.pos(W - 160, H - 100),
        k.text('(ENTER) Continue', { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.opacity(0),
        k.z(4),
    ]);

    // ---- Card area ----
    const CARD_X = CX - 40;  // slightly left of true centre (offset for panels)
    const CARD_Y = CY + 20;
    const CARD_W = 180;
    const CARD_H = 290;

    // Card back rect
    const cardBack = k.add([
        k.pos(CARD_X, CARD_Y - 120),
        k.rect(CARD_W, CARD_H, { radius: 8 }),
        k.color(22, 14, 50),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.anchor('center'),
        k.opacity(0),
        k.z(5),
    ]);

    // "?" on card back
    const cardBackQ = k.add([
        k.pos(CARD_X, CARD_Y - 120),
        k.text('?', { size: 64 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.opacity(0),
        k.z(6),
    ]);

    // Reversed banner (shown under card when reversed)
    const reversedBanner = k.add([
        k.pos(CARD_X, CARD_Y + CARD_H / 2 + 18),
        k.text('REVERSED', { size: 16 }),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.opacity(0),
        k.z(6),
    ]);

    // Card name label (below card)
    const cardNameLabel = k.add([
        k.pos(CARD_X, CARD_Y + CARD_H / 2 + 40),
        k.text('', { size: 15 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.opacity(0),
        k.z(6),
    ]);

    // Glow ring around card
    const glowRect = k.add([
        k.pos(CARD_X, CARD_Y),
        k.rect(CARD_W + 24, CARD_H + 24, { radius: 12 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.opacity(0),
        k.z(4),
    ]);

    // The face sprite entity (created on reveal)
    let cardSprite = null;

    // ---- Determine the drawn card ----
    const collection = state.collection;
    let drawnCard = null;

    if (collection.length > 0) {
        drawnCard = collection[Math.floor(Math.random() * collection.length)];
    }

    const isReversed = Math.random() < REVERSED_CHANCE;

    // Determine omen from card suit
    let omenDef = null;
    if (drawnCard) {
        if (isReversed) {
            // Pick a random curse
            omenDef = CURSES[Math.floor(Math.random() * CURSES.length)];
        } else {
            // Pick blessing based on suit
            const suitKey  = drawnCard.suit || 'major';
            const blessIdx = SUIT_BLESSING[suitKey] !== undefined ? SUIT_BLESSING[suitKey] : 4;
            omenDef = BLESSINGS[blessIdx];
        }
    }

    // ---- Animation state ----
    // States: 'entering' → 'flip' → 'revealed' → 'waiting'
    let animState = 'entering';
    let animTimer = 0;
    let revealed  = false;
    let glowTimer = 0;

    // ---- Update loop ----
    k.onUpdate(() => {
        const dt = k.dt();
        animTimer += dt;
        glowTimer += dt;

        if (glowRect.opacity > 0) {
            glowRect.opacity = 0.25 + 0.15 * Math.sin(glowTimer * Math.PI * 1.5);
        }

        if (animState === 'entering') {
            // Slide card back down from above over 0.5s
            const t     = Math.min(animTimer / 0.5, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const startY = CARD_Y - 180;
            cardBack.pos   = k.vec2(CARD_X, startY + (CARD_Y - startY) * eased);
            cardBackQ.pos  = k.vec2(CARD_X, startY + (CARD_Y - startY) * eased);
            cardBack.opacity  = eased;
            cardBackQ.opacity = eased;

            if (animTimer >= 0.5) {
                playReadingFlip();
                animState = 'flip';
                animTimer = 0;
                cardBack.pos  = k.vec2(CARD_X, CARD_Y);
                cardBackQ.pos = k.vec2(CARD_X, CARD_Y);
            }

        } else if (animState === 'flip') {
            // Shake for 0.3s then reveal at 0.5s
            if (animTimer < 0.3) {
                const intensity = (animTimer / 0.3) * 6;
                const ox = (Math.random() - 0.5) * intensity * 2;
                const oy = (Math.random() - 0.5) * intensity * 2;
                cardBack.pos  = k.vec2(CARD_X + ox, CARD_Y + oy);
                cardBackQ.pos = k.vec2(CARD_X + ox, CARD_Y + oy);
            }

            if (animTimer >= 0.5 && !revealed) {
                revealed = true;
                _revealCard();
            }
        }
    });

    function _revealCard() {
        // Hide back
        cardBack.opacity  = 0;
        cardBackQ.opacity = 0;

        if (!drawnCard) {
            // No collection — default to Wands blessing
            omenDef = BLESSINGS[0];
        }

        // Spawn face sprite
        if (cardSprite) cardSprite.destroy();
        cardSprite = k.add([
            k.pos(CARD_X, CARD_Y),
            k.sprite(drawnCard ? drawnCard.img : 'w01', { width: CARD_W, height: CARD_H }),
            k.anchor('center'),
            // Reversed = rotate 180°
            k.rotate(isReversed ? 180 : 0),
            k.z(5),
        ]);

        // Glow colour by reversed/upright
        const glowColor = isReversed ? COLORS.danger : COLORS.success;
        glowRect.color   = k.rgb(...glowColor);
        glowRect.opacity = 0.4;

        // Card name
        cardNameLabel.text    = drawnCard ? drawnCard.name : 'Unknown';
        cardNameLabel.color   = k.rgb(...glowColor);
        cardNameLabel.opacity = 1;

        // Reversed banner
        if (isReversed) {
            reversedBanner.opacity = 1;
        }

        // Apply instant effect for 'mending' and 'fortune' (no multi-wave buff needed)
        _applyInstantEffect(omenDef);

        // Show right panel info
        _showOmenPanel(omenDef, isReversed, glowColor);

        // Play sound
        if (isReversed) playOmenCurse(); else playOmenBlessing();

        animState = 'waiting';
    }

    function _applyInstantEffect(omen) {
        if (!omen) return;
        if (omen.id === 'mending') {
            // Heal 30% max HP — we store a flag the battle scene reads
            state.applyOmen({ ...omen, instant: true });
            return;
        }
        if (omen.id === 'fortune') {
            // Grant a random legendary item (if space)
            if (state.items.length < MAX_ITEMS) {
                const item = LEGENDARY_ITEMS[Math.floor(Math.random() * LEGENDARY_ITEMS.length)];
                state.addItem(item);
                playItemUsed();
            }
            // fortune is instant — no multi-wave omen tracking needed
            state.applyOmen({ ...omen, instant: true });
            return;
        }
        // All other omens persist for 5 waves
        state.applyOmen(omen);
    }

    function _showOmenPanel(omen, reversed, glowColor) {
        if (!omen) return;

        const typeLabel = reversed ? 'CURSE' : 'BLESSING';
        omenTitle.text    = omen.label;
        omenTitle.color   = k.rgb(...glowColor);
        omenTitle.opacity = 1;

        omenType.text    = typeLabel;
        omenType.color   = k.rgb(...glowColor);
        omenType.opacity = 1;

        omenDesc.text    = omen.desc;
        omenDesc.opacity = 1;

        const durText = (omen.instant) ? 'Instant effect' : 'Active for 5 waves';
        omenDur.text    = durText;
        omenDur.opacity = 1;

        // Show continue button
        k.wait(0.5, () => {
            contBtn.opacity   = 1;
            contLabel.opacity = 1;
        });
    }

    // ---- Continue action ----
    let continued = false;

    function _continue() {
        if (!revealed || continued) return;
        continued = true;
        playUiClick();
        saveCollection();
        events.emit('readingResolved', { card: drawnCard, reversed: isReversed, effect: omenDef });
        events.clearAll();
        k.go('game');
    }

    contBtn.onClick(_continue);
    contBtn.onHover(()    => { contBtn.color = k.rgb(40, 25, 80); });
    contBtn.onHoverEnd(() => { contBtn.color = k.rgb(25, 16, 55); });

    k.onKeyPress('enter', _continue);
    k.onKeyPress('space', _continue);
    k.onKeyPress('escape', () => {
        if (!revealed) return; // don't allow skip before reveal
        _continue();
    });

    initNavBar(k, 'reading');

    k.onSceneLeave(() => {
        if (cardSprite) cardSprite.destroy();
        events.clearAll();
    });
}
