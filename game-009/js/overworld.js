/**
 * overworld.js — Encounter sequencer and shop overlay.
 *
 * Responsibilities:
 *   - Track which encounters trigger a shop (every 2-3 battles)
 *   - Render the shop overlay (keyboard-navigable buy menu)
 *   - Clean up the overlay and call startNextEncounter when done
 *
 * Call initOverworld(k) once per 'game' scene.
 * The shop is triggered via events.emit('showShop') from battle.js.
 */

import { events }   from './events.js';
import { state }    from './state.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, SHOP_ITEMS } from './config.js';
import { playMenuMove, playMenuSelect, playMenuBack } from './sounds.js';

// Shop appears after these encounter indices (0-based, BEFORE advancing to next)
// Encounter 2 → shop; 5 → shop; 8 → shop; 10 → shop (pre-boss Dragon)
const SHOP_AFTER = new Set([1, 4, 7, 9]);

let _k = null;

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

export function initOverworld(kaplay) {
    _k = kaplay;

    const off1 = events.on('showShop', _openShop);
    _k.onSceneLeave(() => { off1(); });
}

// ----------------------------------------------------------------
// Shop trigger check (called by battle.js after each victory)
// ----------------------------------------------------------------

export function shouldShowShop(encounterIndex) {
    return SHOP_AFTER.has(encounterIndex);
}

// ----------------------------------------------------------------
// Shop overlay
// ----------------------------------------------------------------

// Shop state
let _shopOpen   = false;
let _shopItems  = [];           // ordered list of item keys
let _cursorIdx  = 0;
let _shopEnts   = [];           // all Kaplay entities in the overlay (tagged 'shopOverlay')
let _rowEnts    = [];           // per-item cursor/name/cost/count labels for refresh
let _onClose    = null;         // callback when shop closes

function _openShop(onClose) {
    if (_shopOpen) return;
    _shopOpen  = true;
    _onClose   = onClose ?? (() => {});
    _cursorIdx = 0;
    _shopItems = Object.keys(SHOP_ITEMS);

    _buildShopUI();
    _attachKeys();
}

function _closeShop() {
    if (!_shopOpen) return;
    _shopOpen = false;

    // Destroy all shop entities
    _k.destroyAll('shopOverlay');
    _shopEnts  = [];
    _rowEnts   = [];

    // Detach key handlers
    _detachKeys();

    const cb = _onClose;
    _onClose = null;
    cb();
}

// ----------------------------------------------------------------
// UI construction
// ----------------------------------------------------------------

const SHOP_W   = 640;
const SHOP_H   = 480;
const SHOP_X   = (GAME_WIDTH  - SHOP_W) / 2;
const SHOP_Y   = (GAME_HEIGHT - SHOP_H) / 2;

function _add(...comps) {
    const e = _k.add([...comps, 'shopOverlay']);
    _shopEnts.push(e);
    return e;
}

function _buildShopUI() {
    // Dimmer
    _add(_k.pos(0, 0), _k.rect(GAME_WIDTH, GAME_HEIGHT), _k.color(0, 0, 0), _k.opacity(0.72), _k.z(200));

    // Background panel
    _add(_k.pos(SHOP_X, SHOP_Y), _k.rect(SHOP_W, SHOP_H), _k.color(...COLORS.panel), _k.z(201));
    _add(_k.pos(SHOP_X, SHOP_Y), _k.rect(SHOP_W, SHOP_H), _k.outline(2, _k.rgb(...COLORS.panelBorder)), _k.color(...COLORS.panel), _k.z(202));

    // Title
    _add(_k.pos(SHOP_X + SHOP_W / 2, SHOP_Y + 20), _k.text('TRAVELLING MERCHANT', { size: 20 }), _k.color(...COLORS.accent), _k.anchor('top'), _k.z(203));

    // Gold display
    const goldLine = _add(_k.pos(SHOP_X + SHOP_W - 16, SHOP_Y + 20), _k.text(`GOLD: ${state.gold}`, { size: 14 }), _k.color(...COLORS.accent), _k.anchor('topright'), _k.z(203));

    // Update gold display when it changes during shopping
    const offGold = events.on('goldChanged', (v) => { if (goldLine) goldLine.text = `GOLD: ${v}`; });
    // Clean up listener when shop closes — attach to scene leave as backup
    _k.onSceneLeave(() => offGold());
    // Store ref so we can call it on manual close too
    _shopEnts._offGold = offGold;

    // Item rows
    _rowEnts = [];
    _shopItems.forEach((itemKey, i) => {
        const item = SHOP_ITEMS[itemKey];
        const rowY = SHOP_Y + 70 + i * 64;

        // Cursor arrow
        const cursor = _add(
            _k.pos(SHOP_X + 20, rowY + 8),
            _k.text('>', { size: 16 }),
            _k.color(...COLORS.accent),
            _k.anchor('topleft'),
            _k.z(204),
        );

        // Item name
        const nameLabel = _add(
            _k.pos(SHOP_X + 46, rowY),
            _k.text(item.name, { size: 15 }),
            _k.color(...COLORS.text),
            _k.anchor('topleft'),
            _k.z(204),
        );

        // Cost
        const costLabel = _add(
            _k.pos(SHOP_X + 46, rowY + 20),
            _k.text(`${item.cost}G`, { size: 12 }),
            _k.color(...COLORS.accent),
            _k.anchor('topleft'),
            _k.z(204),
        );

        // Count owned
        const ownedCount = state.inventory[itemKey] ?? 0;
        const countLabel = _add(
            _k.pos(SHOP_X + 130, rowY + 20),
            _k.text(`x${ownedCount}`, { size: 12 }),
            _k.color(...COLORS.text),
            _k.anchor('topleft'),
            _k.z(204),
        );

        // Description
        _add(
            _k.pos(SHOP_X + 46, rowY + 38),
            _k.text(item.desc, { size: 10 }),
            _k.color(140, 130, 170),
            _k.anchor('topleft'),
            _k.z(204),
        );

        _rowEnts.push({ cursor, nameLabel, costLabel, countLabel, itemKey });
    });

    // Footer hints
    _add(
        _k.pos(SHOP_X + SHOP_W / 2, SHOP_Y + SHOP_H - 20),
        _k.text('Up/Down: navigate   Space/Enter: buy   ESC/Backspace: leave', { size: 11 }),
        _k.color(100, 90, 140),
        _k.anchor('bot'),
        _k.z(203),
    );

    _refreshCursor();
}

function _refreshCursor() {
    for (let i = 0; i < _rowEnts.length; i++) {
        const row = _rowEnts[i];
        const selected = i === _cursorIdx;
        const item   = SHOP_ITEMS[row.itemKey];
        const canAfford = state.gold >= item.cost;

        // Show/hide cursor arrow
        row.cursor.text = selected ? '>' : '';

        // Dim rows the player can't afford
        const col = !canAfford
            ? [80, 70, 100]
            : selected
                ? COLORS.accent
                : COLORS.text;

        row.nameLabel.color = _k.rgb(...col);

        // Refresh count owned in case we just bought one
        const owned = state.inventory[row.itemKey] ?? 0;
        row.countLabel.text = `x${owned}`;
    }
}

// ----------------------------------------------------------------
// Key handlers
// ----------------------------------------------------------------

let _keyHandles = [];

function _attachKeys() {
    _keyHandles = [
        _k.onKeyPress('up',        _navUp),
        _k.onKeyPress('w',         _navUp),
        _k.onKeyPress('down',      _navDown),
        _k.onKeyPress('s',         _navDown),
        _k.onKeyPress('space',     _tryBuy),
        _k.onKeyPress('enter',     _tryBuy),
        _k.onKeyPress('escape',    _leaveShop),
        _k.onKeyPress('backspace', _leaveShop),
    ];
}

function _detachKeys() {
    _keyHandles.forEach(h => h.cancel());
    _keyHandles = [];
}

function _navUp() {
    _cursorIdx = (_cursorIdx - 1 + _shopItems.length) % _shopItems.length;
    playMenuMove();
    _refreshCursor();
}

function _navDown() {
    _cursorIdx = (_cursorIdx + 1) % _shopItems.length;
    playMenuMove();
    _refreshCursor();
}

function _tryBuy() {
    const itemKey = _shopItems[_cursorIdx];
    const item    = SHOP_ITEMS[itemKey];

    if (state.gold < item.cost) {
        events.emit('showMessage', `Not enough gold to buy ${item.name}!`);
        return;
    }

    state.spend(item.cost);
    if (!state.inventory[itemKey]) state.inventory[itemKey] = 0;
    state.inventory[itemKey]++;

    playMenuSelect();
    events.emit('showMessage', `Bought ${item.name}! (x${state.inventory[itemKey]})`);

    _refreshCursor();
}

function _leaveShop() {
    playMenuBack();
    // Cancel the gold event listener stored on the array
    if (_shopEnts._offGold) _shopEnts._offGold();
    _closeShop();
}
