/**
 * shop.js — Tower shop: in-game tower sidebar + between-wave overlay.
 *
 * Phase 4: Gold deduction, placement mode, upgrade/sell popup.
 *
 * Public API:
 *   initShop(k)
 *   openShopOverlay()   — between waves
 *   closeShopOverlay()
 */

import {
    GAME_WIDTH, GAME_HEIGHT,
    GRID_OFFSET_X,
    TOWER_DEFS,
    COLORS,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    enterPlacementMode, exitPlacementMode,
    sellTowerAt, upgradeTowerAt, showRangeFor, hideRange, getTowerAt,
} from './towers.js';

// ============================================================
// DOM elements (created once, reused)
// ============================================================

let _shopOverlay  = null;  // between-wave fullscreen DOM overlay
let _towerPopup   = null;  // upgrade/sell popup for a placed tower
let _activePopupKey = null;

// ============================================================
// Public init
// ============================================================

export function initShop(k) {
    // Tower clicked in placement grid → show upgrade/sell popup
    events.on('towerClicked', (col, row) => {
        _showTowerPopup(k, col, row);
    });

    // Placement mode changed
    events.on('placementModeChanged', (active, type) => {
        _updatePlacementIndicator(active, type);
    });

    // Invalid placement flash
    events.on('invalidPlacement', () => {
        _flashStatusBar('Cannot place here!');
    });

    // Not enough gold
    events.on('notEnoughGold', () => {
        _flashStatusBar('Not enough gold!');
    });

    // Close popup on any scene teardown
    k.onSceneLeave(() => {
        _hideTowerPopup();
        closeShopOverlay();
    });

    // Build the persistent right-HUD tower shop panel
    _buildTowerShopPanel(k);
}

// ============================================================
// Right-HUD tower shop panel (always visible, shows 6 towers)
// ============================================================

let _shopPanelEl = null;
let _statusBarEl = null;
let _placementLabelEl = null;

function _buildTowerShopPanel(k) {
    // Inject styles once
    if (!document.getElementById('g008-styles')) {
        const style = document.createElement('style');
        style.id = 'g008-styles';
        style.textContent = `
            #g008-shop-panel {
                position: fixed;
                top: 0; right: 0;
                width: 0; height: 0;
                pointer-events: none;
                z-index: 200;
                font-family: 'Courier New', monospace;
            }
            #g008-tower-buttons {
                position: fixed;
                right: 0;
                top: 220px;
                width: 148px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px 6px;
                pointer-events: all;
                z-index: 200;
            }
            .g008-tower-btn {
                background: #0d1a2e;
                border: 1px solid #1e4a7f;
                color: #ccdcef;
                padding: 4px 6px;
                cursor: pointer;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                text-align: left;
                transition: background 0.12s;
                user-select: none;
            }
            .g008-tower-btn:hover {
                background: #1a3050;
                border-color: #4080c0;
            }
            .g008-tower-btn.selected {
                background: #1e4a7f;
                border-color: #60aaff;
                color: #ffffff;
            }
            .g008-tower-btn .cost {
                color: #ffd700;
                float: right;
            }
            .g008-tower-btn.unaffordable {
                opacity: 0.45;
                cursor: default;
            }
            #g008-status-bar {
                position: fixed;
                bottom: 8px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.75);
                color: #ff6060;
                padding: 4px 16px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.15s;
                z-index: 300;
            }
            #g008-placement-label {
                position: fixed;
                top: 8px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(20,40,80,0.9);
                color: #aaddff;
                padding: 4px 16px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                pointer-events: none;
                display: none;
                z-index: 300;
            }
            /* Tower popup */
            #g008-tower-popup {
                position: fixed;
                background: #0a1020;
                border: 1px solid #2a5a9f;
                color: #ccdcef;
                padding: 10px 12px;
                border-radius: 5px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                z-index: 250;
                min-width: 170px;
            }
            #g008-tower-popup h3 {
                margin: 0 0 6px; color: #fff; font-size: 13px;
            }
            #g008-tower-popup .stat { color: #aabbcc; margin: 2px 0; }
            #g008-tower-popup .btn-row {
                display: flex; gap: 6px; margin-top: 8px;
            }
            #g008-tower-popup button {
                flex: 1;
                background: #162840;
                border: 1px solid #2a5a9f;
                color: #ccdcef;
                padding: 4px;
                cursor: pointer;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            }
            #g008-tower-popup button:hover { background: #1e3a5f; }
            #g008-tower-popup button.sell { border-color: #8b3030; color: #ff8888; }
            #g008-tower-popup button:disabled {
                opacity: 0.4; cursor: default;
            }
            /* Shop overlay */
            #g008-shop-overlay {
                display: none;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.82);
                z-index: 400;
                justify-content: center;
                align-items: center;
            }
            #g008-shop-overlay.active { display: flex; }
            #g008-shop-inner {
                background: #080f1a;
                border: 2px solid #1e4a7f;
                border-radius: 8px;
                padding: 24px 32px;
                color: #ccdcef;
                font-family: 'Courier New', monospace;
                min-width: 560px;
                max-width: 660px;
            }
            #g008-shop-inner h2 {
                text-align: center; color: #60aaff; margin: 0 0 16px;
            }
            .g008-shop-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 16px;
            }
            .g008-shop-card {
                background: #0d1a2e;
                border: 1px solid #1e3a5f;
                border-radius: 4px;
                padding: 8px 10px;
                cursor: pointer;
                transition: border-color 0.1s, background 0.1s;
            }
            .g008-shop-card:hover { background: #14253c; border-color: #3a7abf; }
            .g008-shop-card h4 { margin: 0 0 4px; color: #fff; }
            .g008-shop-card .cost-line { color: #ffd700; font-size: 12px; }
            .g008-shop-card .desc { color: #8899aa; font-size: 10px; margin-top: 4px; }
            .g008-shop-card.unaffordable { opacity: 0.5; cursor: default; }
            #g008-shop-footer {
                display: flex; justify-content: space-between; align-items: center;
            }
            #g008-shop-footer .gold-display {
                color: #ffd700; font-size: 14px;
            }
            #g008-shop-close {
                background: #1e4a7f;
                border: 1px solid #60aaff;
                color: #fff;
                padding: 6px 18px;
                border-radius: 4px;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }
            #g008-shop-close:hover { background: #2a6abf; }
            #g008-shop-timer { color: #aabbcc; font-size: 12px; }
        `;
        document.head.appendChild(style);
    }

    // Tower buttons column (right HUD)
    const btns = document.createElement('div');
    btns.id = 'g008-tower-buttons';
    document.body.appendChild(btns);
    _renderTowerButtons(btns);

    // Refresh button states on gold change
    events.on('goldChanged', () => _renderTowerButtons(btns));
    events.on('towerPlaced', () => _renderTowerButtons(btns));

    // Status bar
    _statusBarEl = document.createElement('div');
    _statusBarEl.id = 'g008-status-bar';
    document.body.appendChild(_statusBarEl);

    // Placement hint label
    _placementLabelEl = document.createElement('div');
    _placementLabelEl.id = 'g008-placement-label';
    _placementLabelEl.textContent = 'Click a tower slot to place — ESC to cancel';
    document.body.appendChild(_placementLabelEl);

    // Between-wave overlay (initially hidden)
    const overlay = document.createElement('div');
    overlay.id = 'g008-shop-overlay';
    overlay.innerHTML = `
        <div id="g008-shop-inner">
            <h2>TOWER SHOP</h2>
            <div class="g008-shop-grid" id="g008-shop-cards"></div>
            <div id="g008-shop-footer">
                <div class="gold-display" id="g008-shop-gold">Gold: ${state.gold}</div>
                <div id="g008-shop-timer"></div>
                <button id="g008-shop-close">Start Wave &gt;</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _shopOverlay = overlay;

    document.getElementById('g008-shop-close').addEventListener('click', closeShopOverlay);
}

function _renderTowerButtons(container) {
    container.innerHTML = '';
    for (const [type, def] of Object.entries(TOWER_DEFS)) {
        const affordable = state.gold >= def.cost;
        const btn = document.createElement('div');
        btn.className = 'g008-tower-btn' + (affordable ? '' : ' unaffordable');
        btn.innerHTML = `${def.name} <span class="cost">${def.cost}g</span>`;
        btn.title = def.special;
        if (affordable) {
            btn.addEventListener('click', () => {
                // Remove selected highlight from all buttons
                container.querySelectorAll('.g008-tower-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                enterPlacementMode(type);
            });
        }
        container.appendChild(btn);
    }
}

function _updatePlacementIndicator(active, type) {
    if (!_placementLabelEl) return;
    if (active && type) {
        const def = TOWER_DEFS[type];
        _placementLabelEl.textContent = `Placing ${def.name} (${def.cost}g) — click slot — ESC to cancel`;
        _placementLabelEl.style.display = 'block';
    } else {
        _placementLabelEl.style.display = 'none';
        // Deselect all buttons
        const btns = document.querySelectorAll('.g008-tower-btn');
        btns.forEach(b => b.classList.remove('selected'));
    }
}

// ============================================================
// Status bar flash
// ============================================================

let _statusFadeTimer = null;
function _flashStatusBar(msg) {
    if (!_statusBarEl) return;
    _statusBarEl.textContent = msg;
    _statusBarEl.style.opacity = '1';
    if (_statusFadeTimer) clearTimeout(_statusFadeTimer);
    _statusFadeTimer = setTimeout(() => {
        if (_statusBarEl) _statusBarEl.style.opacity = '0';
    }, 1500);
}

// ============================================================
// Tower upgrade/sell popup
// ============================================================

function _showTowerPopup(k, col, row) {
    _hideTowerPopup();
    const tower = getTowerAt(col, row);
    if (!tower) return;
    _activePopupKey = `${col},${row}`;

    const def   = TOWER_DEFS[tower.type];
    const upg   = def.upgrades[tower.tier];
    const canUpgrade = !!upg && state.gold >= upg.cost && tower.tier < def.upgrades.length;
    const atMax  = tower.tier >= def.upgrades.length;
    const refund = Math.floor(tower.totalSpent * 0.5);

    const popup = document.createElement('div');
    popup.id = 'g008-tower-popup';
    popup.innerHTML = `
        <h3>${def.name} ${tower.tier > 0 ? 'T' + (tower.tier + 1) : ''}</h3>
        <div class="stat">DMG: ${tower.damage} | Rate: ${tower.fireRate.toFixed(2)}s</div>
        <div class="stat">Range: ${tower.range} tiles</div>
        <div class="stat" style="color:#aaa;font-size:10px">${def.special}</div>
        <div class="btn-row">
            <button id="g008-upg-btn" ${(!upg || atMax) ? 'disabled' : ''}>
                ${atMax ? 'Max Tier' : (!upg ? 'Max' : `Upgrade (${upg.cost}g)`)}
            </button>
            <button class="sell" id="g008-sell-btn">Sell (${refund}g)</button>
            <button id="g008-close-popup-btn">X</button>
        </div>
    `;

    // Position near the tile (with bounds check)
    const tilePixelX = GRID_OFFSET_X + col * 40 + 40;
    const tilePixelY = row * 40;
    popup.style.left = Math.min(tilePixelX + 8, GAME_WIDTH - 200) + 'px';
    popup.style.top  = Math.max(tilePixelY, 8) + 'px';
    document.body.appendChild(popup);
    _towerPopup = popup;

    showRangeFor(k, col, row);

    popup.querySelector('#g008-upg-btn')?.addEventListener('click', () => {
        upgradeTowerAt(k, col, row);
        _hideTowerPopup();
    });
    popup.querySelector('#g008-sell-btn').addEventListener('click', () => {
        sellTowerAt(k, col, row);
        hideRange(k);
        _hideTowerPopup();
    });
    popup.querySelector('#g008-close-popup-btn').addEventListener('click', () => {
        hideRange(k);
        _hideTowerPopup();
    });
}

function _hideTowerPopup() {
    if (_towerPopup) {
        _towerPopup.remove();
        _towerPopup = null;
    }
    _activePopupKey = null;
}

// ============================================================
// Between-wave shop overlay
// ============================================================

let _shopCountdown = 0;
let _shopTimer     = null;

export function openShopOverlay() {
    if (!_shopOverlay) return;
    _refreshShopCards();
    _shopOverlay.classList.add('active');

    _shopCountdown = 15;
    _updateShopTimer();
    _shopTimer = setInterval(() => {
        _shopCountdown--;
        _updateShopTimer();
        if (_shopCountdown <= 0) closeShopOverlay();
    }, 1000);
}

export function closeShopOverlay() {
    if (_shopTimer) { clearInterval(_shopTimer); _shopTimer = null; }
    if (_shopOverlay) _shopOverlay.classList.remove('active');
    events.emit('shopClosed');
}

function _updateShopTimer() {
    const el = document.getElementById('g008-shop-timer');
    if (el) el.textContent = `Auto-start in ${_shopCountdown}s`;
    const gold = document.getElementById('g008-shop-gold');
    if (gold) gold.textContent = `Gold: ${state.gold}`;
}

function _refreshShopCards() {
    const grid = document.getElementById('g008-shop-cards');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [type, def] of Object.entries(TOWER_DEFS)) {
        const affordable = state.gold >= def.cost;
        const card = document.createElement('div');
        card.className = 'g008-shop-card' + (affordable ? '' : ' unaffordable');
        card.innerHTML = `
            <h4>${def.name}</h4>
            <div class="cost-line">${def.cost}g</div>
            <div class="stat" style="font-size:10px">DMG: ${def.damage} | Rate: ${def.fireRate}s | Range: ${def.range}</div>
            <div class="desc">${def.special}</div>
        `;
        if (affordable) {
            card.addEventListener('click', () => {
                closeShopOverlay();
                enterPlacementMode(type);
            });
        }
        grid.appendChild(card);
    }
    const gold = document.getElementById('g008-shop-gold');
    if (gold) gold.textContent = `Gold: ${state.gold}`;
}

// ============================================================
// Cleanup on page unload / scene restart
// ============================================================

export function destroyShopDOM() {
    document.getElementById('g008-tower-buttons')?.remove();
    document.getElementById('g008-status-bar')?.remove();
    document.getElementById('g008-placement-label')?.remove();
    document.getElementById('g008-shop-overlay')?.remove();
    document.getElementById('g008-tower-popup')?.remove();
    document.getElementById('g008-styles')?.remove();
    _shopOverlay = null;
    _towerPopup  = null;
}
