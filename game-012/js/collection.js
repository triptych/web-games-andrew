/**
 * collection.js — Collection browser, party slot assignment, card detail panel,
 *                 and star-up (fusion) interface.
 *
 * Layout (1280 × 720):
 *   Left panel  x=0..640    — scrollable card grid (5 cols × N rows)
 *   Right panel x=640..1280 — party slots (top) + card detail (bottom)
 *   Top bar     y=0..50     — title + gem/wave HUD
 *   Bottom bar  y=670..720  — hint text
 *
 * Interaction:
 *   - Click a card in the grid → select it (shows detail on right)
 *   - Click a party slot while a grid card is selected → assign card to slot
 *   - Click a filled party slot → deselect that card from party
 *   - Press F (or click Fuse button) when a selected card has ≥1 dupe → fuse
 *   - ESC → back to hub
 */

import { state }                        from './state.js';
import { events }                       from './events.js';
import { fuseCard, getStarUpCost, saveCollection } from './gacha.js';
import { COLORS, MAX_PARTY_SIZE }       from './config.js';
import { playUiClick }                  from './sounds.js';
import { initNavBar }                   from './ui.js';

// ----------------------------------------------------------------
// Layout constants
// ----------------------------------------------------------------

const W  = 1280;
const H  = 720;

const TOP_BAR_H    = 50;
const BOT_BAR_H    = 50;
const GRID_AREA_W  = 620;   // left side for card grid
const RIGHT_X      = 640;   // right panel starts here
const RIGHT_W      = W - RIGHT_X;

// Card thumbnail dimensions inside the grid
const THUMB_W = 90;
const THUMB_H = 140;
const THUMB_PAD_X = 16;
const THUMB_PAD_Y = 12;
const GRID_COLS    = 5;
const GRID_START_X = 20;
const GRID_START_Y = TOP_BAR_H + 10;

// Party slot layout (right panel, top half)
const SLOT_W = 120;
const SLOT_H = 185;
const SLOT_PAD = 18;
const SLOTS_Y  = TOP_BAR_H + 20;
const SLOTS_X  = RIGHT_X + 20;

// Detail panel (right panel, below party slots)
const DETAIL_Y = SLOTS_Y + SLOT_H + 30;
const DETAIL_X = RIGHT_X + 20;
const DETAIL_W = RIGHT_W - 40;

// Rarity colours (mirrored from gacha scene)
const RARITY_COLOR = {
    COMMON:    COLORS.silver,
    UNCOMMON:  [100, 220, 120],
    RARE:      COLORS.mana,
    LEGENDARY: COLORS.gold,
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function rarityColor(rarity) {
    return RARITY_COLOR[rarity] || COLORS.text;
}

function starStr(stars) {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

// ----------------------------------------------------------------
// initCollection(k) — called from the 'collection' scene
// ----------------------------------------------------------------

export function initCollection(k) {

    // ---- state ----
    let selectedCard   = null;   // card instance from collection
    let selectedSlotIdx = -1;   // which party slot is "active target" (-1 = none)
    let scrollOffset   = 0;     // how many pixel rows scrolled (in card-row units)
    let cardThumbEntities = [];  // { card, bg, sprite, starLabel, border }
    let partySlotEntities = [];  // one per party slot index
    let detailEntities    = [];  // entities making up the detail panel

    initNavBar(k, 'collection');

    // ---- background ----
    k.add([k.pos(0, 0), k.rect(W, H), k.color(...COLORS.bg), k.z(0)]);

    // ---- top bar ----
    k.add([k.pos(0, 0), k.rect(W, TOP_BAR_H), k.color(...COLORS.bgPanel), k.z(1)]);
    k.add([k.pos(14, 12), k.text('COLLECTION', { size: 18 }), k.color(...COLORS.gold), k.anchor('topleft'), k.z(2)]);

    const gemsHud = k.add([k.pos(W / 2, 12), k.text(`GEMS  ${state.gems}`, { size: 15 }), k.color(...COLORS.gold), k.anchor('top'), k.z(2)]);
    k.add([k.pos(W - 14, 12), k.text(`Wave ${state.wave}`, { size: 14 }), k.color(...COLORS.silver), k.anchor('topright'), k.z(2)]);

    const offGems = events.on('gemsChanged', v => { gemsHud.text = `GEMS  ${v}`; });
    k.onSceneLeave(() => offGems());

    // ---- divider ----
    k.add([k.pos(GRID_AREA_W + 10, TOP_BAR_H), k.rect(2, H - TOP_BAR_H - BOT_BAR_H), k.color(40, 28, 80), k.z(1)]);

    // ---- bottom bar hint (above the nav bar) ----
    k.add([
        k.pos(W / 2, H - BOT_BAR_H - 2),
        k.text('(ESC) Hub   (F) Fuse selected card with dupes   Arrow keys scroll', { size: 12 }),
        k.color(80, 60, 130),
        k.anchor('bot'),
        k.z(2),
    ]);

    // ---- grid scroll clip (mask trick: just render within bounds by z-ordering) ----
    // We use a solid rect panel behind the grid so cards that scroll out are hidden.
    k.add([k.pos(0, TOP_BAR_H), k.rect(GRID_AREA_W + 10, H - TOP_BAR_H - BOT_BAR_H), k.color(...COLORS.bg), k.z(1)]);

    // ---- right panel background ----
    k.add([k.pos(RIGHT_X, TOP_BAR_H), k.rect(RIGHT_W, H - TOP_BAR_H - BOT_BAR_H), k.color(12, 8, 28), k.z(1)]);

    // ---- party slot headers ----
    k.add([k.pos(RIGHT_X + 14, TOP_BAR_H + 6), k.text('PARTY', { size: 14 }), k.color(...COLORS.accent), k.anchor('topleft'), k.z(2)]);

    // ================================================================
    // PARTY SLOTS
    // ================================================================

    function buildPartySlots() {
        // Destroy old slot entities
        for (const e of partySlotEntities) for (const en of e) en.destroy();
        partySlotEntities = [];

        for (let i = 0; i < MAX_PARTY_SIZE; i++) {
            const sx = SLOTS_X + i * (SLOT_W + SLOT_PAD);
            const sy = SLOTS_Y;
            const card = state.party[i] || null;
            const isActive = (selectedSlotIdx === i);

            const slotEnts = [];

            // Background rect
            const outlineColor = isActive
                ? k.rgb(...COLORS.gold)
                : card ? k.rgb(...rarityColor(card.rarity)) : k.rgb(50, 35, 90);

            const slotBg = k.add([
                k.pos(sx, sy),
                k.rect(SLOT_W, SLOT_H, { radius: 6 }),
                k.color(card ? 18 : 10, card ? 12 : 7, card ? 40 : 25),
                k.outline(isActive ? 2 : 1, outlineColor),
                k.anchor('topleft'),
                k.area(),
                k.z(2),
            ]);
            slotEnts.push(slotBg);

            if (card) {
                // Card art sprite
                const sp = k.add([
                    k.pos(sx + SLOT_W / 2, sy + 6),
                    k.sprite(card.img, { width: SLOT_W - 12, height: SLOT_H - 55 }),
                    k.anchor('top'),
                    k.z(3),
                ]);
                slotEnts.push(sp);

                // Card name below sprite
                const nameLabel = k.add([
                    k.pos(sx + SLOT_W / 2, sy + SLOT_H - 46),
                    k.text(card.name.replace('The ', ''), { size: 10 }),
                    k.color(...rarityColor(card.rarity)),
                    k.anchor('center'),
                    k.z(3),
                ]);
                slotEnts.push(nameLabel);

                // Stars row
                const starsLabel = k.add([
                    k.pos(sx + SLOT_W / 2, sy + SLOT_H - 32),
                    k.text(starStr(card.stars), { size: 10 }),
                    k.color(...COLORS.gold),
                    k.anchor('center'),
                    k.z(3),
                ]);
                slotEnts.push(starsLabel);

                // HP/ATK micro stats
                const statsLabel = k.add([
                    k.pos(sx + SLOT_W / 2, sy + SLOT_H - 18),
                    k.text(`HP${card.hp} ATK${card.atk}`, { size: 9 }),
                    k.color(...COLORS.silver),
                    k.anchor('center'),
                    k.z(3),
                ]);
                slotEnts.push(statsLabel);
            } else {
                // Empty slot label
                const emptyLabel = k.add([
                    k.pos(sx + SLOT_W / 2, sy + SLOT_H / 2 - 10),
                    k.text(`SLOT ${i + 1}`, { size: 13 }),
                    k.color(60, 45, 100),
                    k.anchor('center'),
                    k.z(3),
                ]);
                slotEnts.push(emptyLabel);
                const emptyLabel2 = k.add([
                    k.pos(sx + SLOT_W / 2, sy + SLOT_H / 2 + 12),
                    k.text('empty', { size: 10 }),
                    k.color(45, 34, 75),
                    k.anchor('center'),
                    k.z(3),
                ]);
                slotEnts.push(emptyLabel2);
            }

            // Click handler
            const slotIdx = i;
            slotBg.onClick(() => {
                playUiClick();
                if (card) {
                    // Remove from party if slot has a card
                    state.removeFromParty(card.uid);
                    saveCollection();
                    if (selectedCard && selectedCard.uid === card.uid) selectedCard = null;
                    selectedSlotIdx = -1;
                    buildPartySlots();
                    buildGrid();
                    buildDetail();
                } else if (selectedCard && state.party.length < MAX_PARTY_SIZE) {
                    // Assign selected card to this slot
                    state.addToParty(selectedCard);
                    saveCollection();
                    selectedSlotIdx = -1;
                    buildPartySlots();
                    buildGrid();
                    buildDetail();
                } else {
                    // Highlight slot as target
                    selectedSlotIdx = (selectedSlotIdx === slotIdx) ? -1 : slotIdx;
                    buildPartySlots();
                }
            });
            slotBg.onHover(() => {
                slotBg.color = k.rgb(25, 18, 52);
                if (card) buildDetail(card);
            });
            slotBg.onHoverEnd(() => {
                slotBg.color = k.rgb(card ? 18 : 10, card ? 12 : 7, card ? 40 : 25);
                buildDetail();
            });

            partySlotEntities.push(slotEnts);
        }
    }

    // ================================================================
    // CARD GRID
    // ================================================================

    function buildGrid() {
        // Destroy old thumbnail entities
        for (const te of cardThumbEntities) {
            if (!te) continue;
            te.bg.destroy();
            if (te.sprite) te.sprite.destroy();
            te.starLabel.destroy();
            te.border.destroy();
            if (te.dupeLabel) te.dupeLabel.destroy();
            if (te.inPartyBadge) te.inPartyBadge.destroy();
        }
        cardThumbEntities = [];

        const coll = state.collection;

        coll.forEach((card, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);

            const x = GRID_START_X + col * (THUMB_W + THUMB_PAD_X);
            const y = GRID_START_Y + row * (THUMB_H + THUMB_PAD_Y) - scrollOffset;

            // Skip if off-screen (above or below visible area)
            const visTop    = TOP_BAR_H;
            const visBottom = H - BOT_BAR_H;
            if (y + THUMB_H < visTop || y > visBottom) {
                // Push placeholder so indices stay aligned
                cardThumbEntities.push(null);
                return;
            }

            const isSelected = selectedCard && selectedCard.uid === card.uid;
            const inParty    = state.party.some(p => p.uid === card.uid);
            const rc         = rarityColor(card.rarity);

            // Count dupes (same id, different uid)
            const dupeCount = state.collection.filter(c => c.id === card.id && c.uid !== card.uid).length;

            const outlineColor = isSelected ? k.rgb(...COLORS.gold) : k.rgb(...rc.map(c => Math.floor(c * 0.5)));

            const bg = k.add([
                k.pos(x, y),
                k.rect(THUMB_W, THUMB_H, { radius: 5 }),
                k.color(isSelected ? 30 : 14, isSelected ? 20 : 9, isSelected ? 60 : 30),
                k.outline(isSelected ? 2 : 1, outlineColor),
                k.anchor('topleft'),
                k.area(),
                k.z(3),
            ]);

            let sprite = null;
            try {
                sprite = k.add([
                    k.pos(x + THUMB_W / 2, y + 4),
                    k.sprite(card.img, { width: THUMB_W - 8, height: THUMB_H - 36 }),
                    k.anchor('top'),
                    k.z(4),
                ]);
            } catch (e) {
                // sprite might not be loaded yet — skip
            }

            const starLabel = k.add([
                k.pos(x + THUMB_W / 2, y + THUMB_H - 22),
                k.text(starStr(card.stars), { size: 8 }),
                k.color(...COLORS.gold),
                k.anchor('center'),
                k.z(4),
            ]);

            // Rarity border strip at bottom
            const border = k.add([
                k.pos(x, y + THUMB_H - 10),
                k.rect(THUMB_W, 10, { radius: 5 }),
                k.color(...rc.map(c => Math.floor(c * 0.35))),
                k.anchor('topleft'),
                k.z(4),
            ]);

            // Dupe count badge (top-right corner)
            let dupeLabel = null;
            if (dupeCount > 0) {
                dupeLabel = k.add([
                    k.pos(x + THUMB_W - 4, y + 4),
                    k.text(`x${dupeCount + 1}`, { size: 9 }),
                    k.color(200, 160, 255),
                    k.anchor('topright'),
                    k.z(5),
                ]);
            }

            // In-party indicator (top-left)
            let inPartyBadge = null;
            if (inParty) {
                inPartyBadge = k.add([
                    k.pos(x + 4, y + 4),
                    k.text('P', { size: 9 }),
                    k.color(...COLORS.success),
                    k.anchor('topleft'),
                    k.z(5),
                ]);
            }

            // Click handler
            bg.onClick(() => {
                playUiClick();
                if (selectedCard && selectedCard.uid === card.uid) {
                    // Deselect
                    selectedCard = null;
                    selectedSlotIdx = -1;
                } else {
                    selectedCard = card;
                    selectedSlotIdx = -1;
                    // If party not full, auto-assign to next empty slot
                    if (!inParty && state.party.length < MAX_PARTY_SIZE) {
                        state.addToParty(card);
                        saveCollection();
                        selectedCard = null;
                        buildPartySlots();
                        buildGrid();
                        buildDetail();
                        return;
                    }
                }
                buildGrid();
                buildPartySlots();
                buildDetail();
            });
            bg.onHover(() => { bg.color = k.rgb(isSelected ? 38 : 22, isSelected ? 28 : 14, isSelected ? 70 : 42); });
            bg.onHoverEnd(() => { bg.color = k.rgb(isSelected ? 30 : 14, isSelected ? 20 : 9, isSelected ? 60 : 30); });

            cardThumbEntities.push({ bg, sprite, starLabel, border, dupeLabel, inPartyBadge });
        });
    }

    // ================================================================
    // DETAIL PANEL
    // ================================================================

    function buildDetail(previewCard) {
        // Destroy previous detail entities
        for (const e of detailEntities) e.destroy();
        detailEntities = [];

        const card = previewCard !== undefined ? previewCard : selectedCard;

        function addDetail(ent) { detailEntities.push(ent); return ent; }

        if (!card) {
            addDetail(k.add([
                k.pos(DETAIL_X + DETAIL_W / 2, DETAIL_Y + 40),
                k.text('Select a card to view details', { size: 13 }),
                k.color(70, 55, 110),
                k.anchor('center'),
                k.z(3),
            ]));
            return;
        }

        const rc = rarityColor(card.rarity);
        let dy = DETAIL_Y;

        // ---- card art (small) ----
        addDetail(k.add([
            k.pos(DETAIL_X + 48, dy),
            k.sprite(card.img, { width: 80, height: 125 }),
            k.anchor('topleft'),
            k.z(3),
        ]));

        // ---- name + rarity ----
        addDetail(k.add([
            k.pos(DETAIL_X + 140, dy + 2),
            k.text(card.name, { size: 16 }),
            k.color(...rc),
            k.anchor('topleft'),
            k.z(3),
        ]));
        addDetail(k.add([
            k.pos(DETAIL_X + 140, dy + 22),
            k.text(`${card.rarity}  |  ${card.suit.toUpperCase()}`, { size: 11 }),
            k.color(...COLORS.silver),
            k.anchor('topleft'),
            k.z(3),
        ]));
        addDetail(k.add([
            k.pos(DETAIL_X + 140, dy + 38),
            k.text(starStr(card.stars), { size: 14 }),
            k.color(...COLORS.gold),
            k.anchor('topleft'),
            k.z(3),
        ]));

        // ---- stats block ----
        const statsY = dy + 60;
        const statItems = [
            { label: 'HP',  val: card.hp,  color: COLORS.success },
            { label: 'ATK', val: card.atk, color: COLORS.danger  },
            { label: 'SPD', val: card.spd, color: COLORS.mana    },
            { label: 'DEF', val: card.def, color: [200, 170, 80] },
        ];
        statItems.forEach((s, i) => {
            addDetail(k.add([
                k.pos(DETAIL_X + 140 + i * 60, statsY),
                k.text(`${s.label}\n${s.val}`, { size: 11 }),
                k.color(...s.color),
                k.anchor('topleft'),
                k.z(3),
            ]));
        });

        // ---- keywords ----
        dy += 140;
        if (card.keywords && card.keywords.length) {
            addDetail(k.add([
                k.pos(DETAIL_X + 48, dy),
                k.text(card.keywords.join('  '), { size: 10 }),
                k.color(140, 110, 200),
                k.anchor('topleft'),
                k.z(3),
            ]));
        }

        // ---- ability description (if any) ----
        dy += 20;
        if (card.ability) {
            addDetail(k.add([
                k.pos(DETAIL_X + 48, dy),
                k.text(`Ability: ${card.ability}`, { size: 11 }),
                k.color(...COLORS.accent),
                k.anchor('topleft'),
                k.z(3),
            ]));
            dy += 20;
        }

        // ---- fusion info ----
        dy += 8;
        const dupes = state.collection.filter(c => c.id === card.id && c.uid !== card.uid);
        const cost  = getStarUpCost(card);

        if (card.stars >= 5) {
            addDetail(k.add([
                k.pos(DETAIL_X + 48, dy),
                k.text('MAX STARS — fully fused', { size: 11 }),
                k.color(...COLORS.gold),
                k.anchor('topleft'),
                k.z(3),
            ]));
        } else {
            addDetail(k.add([
                k.pos(DETAIL_X + 48, dy),
                k.text(`Dupes owned: ${dupes.length}  /  Need ${cost} to reach ${card.stars + 1} stars`, { size: 11 }),
                k.color(dupes.length >= cost ? COLORS.success : COLORS.silver),
                k.anchor('topleft'),
                k.z(3),
            ]));
            dy += 20;

            if (dupes.length >= cost) {
                // Fuse button
                const fuseBtnBg = k.add([
                    k.pos(DETAIL_X + 48, dy),
                    k.rect(160, 34, { radius: 5 }),
                    k.color(50, 20, 100),
                    k.outline(1, k.rgb(...COLORS.accent)),
                    k.anchor('topleft'),
                    k.area(),
                    k.z(4),
                ]);
                addDetail(fuseBtnBg);
                addDetail(k.add([
                    k.pos(DETAIL_X + 128, dy + 17),
                    k.text(`(F) Fuse to ${card.stars + 1} stars`, { size: 12 }),
                    k.color(...COLORS.accent),
                    k.anchor('center'),
                    k.z(5),
                ]));
                fuseBtnBg.onClick(() => doFuse());
                fuseBtnBg.onHover(() => { fuseBtnBg.color = k.rgb(70, 35, 140); });
                fuseBtnBg.onHoverEnd(() => { fuseBtnBg.color = k.rgb(50, 20, 100); });
            }
        }
    }

    // ================================================================
    // FUSION ACTION
    // ================================================================

    function doFuse() {
        if (!selectedCard) return;
        const dupes = state.collection.filter(c => c.id === selectedCard.id && c.uid !== selectedCard.uid);
        const cost  = getStarUpCost(selectedCard);
        if (dupes.length < cost) return;

        const dupUids = dupes.slice(0, cost).map(c => c.uid);
        const ok = fuseCard(selectedCard.uid, dupUids);
        if (ok) {
            playUiClick();
            // selectedCard still points to the same object (mutated in fuseCard)
            buildGrid();
            buildPartySlots();
            buildDetail();
        }
    }

    // ================================================================
    // SCROLL
    // ================================================================

    const ROW_H = THUMB_H + THUMB_PAD_Y;

    function scrollBy(delta) {
        const rows = Math.ceil(state.collection.length / GRID_COLS);
        const maxScroll = Math.max(0, rows * ROW_H - (H - TOP_BAR_H - BOT_BAR_H) + GRID_START_Y - TOP_BAR_H);
        scrollOffset = Math.max(0, Math.min(scrollOffset + delta, maxScroll));
        buildGrid();
    }

    // ================================================================
    // INITIAL RENDER
    // ================================================================

    buildPartySlots();
    buildGrid();
    buildDetail();

    // ================================================================
    // KEY BINDINGS
    // ================================================================

    k.onKeyPress('escape', () => { events.clearAll(); k.go('game'); });

    k.onKeyPress('f', () => doFuse());

    k.onKeyPress('up',    () => scrollBy(-ROW_H));
    k.onKeyPress('down',  () => scrollBy( ROW_H));
    k.onKeyPress('pageup',   () => scrollBy(-ROW_H * 3));
    k.onKeyPress('pagedown', () => scrollBy( ROW_H * 3));

    // Mouse wheel scroll
    k.onScroll(delta => {
        scrollBy(delta.y * 0.8);
    });

    k.onSceneLeave(() => events.clearAll());
}
