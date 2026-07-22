/**
 * ui.js — DOM HUD bindings, loot comparison modal, and shop modal.
 * The HUD lives in index.html as fixed DOM elements; this module hooks up
 * event listeners, shows/hides overlays, and renders the modal(s) into
 * #modal-root.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { WEAPON_ATTRS, ARMOR_ATTRS, POTION_COST, POTION_HEAL } from './config.js';
import { getSaleValue } from './loot.js';
import { playUiClick, playCoinPickup } from './sounds.js';

let $hp, $distance, $coins, $message, $modalRoot, $combatIndicator;

export function initUI() {
    $hp              = document.getElementById('hp-val');
    $distance        = document.getElementById('score-val');
    $coins           = document.getElementById('lives-val');
    $message         = document.getElementById('message');
    $modalRoot       = document.getElementById('modal-root');
    $combatIndicator = document.getElementById('combat-indicator');

    _render();

    events.on('hpChanged',       _render);
    events.on('coinsChanged',    _render);
    events.on('distanceChanged', _render);
    events.on('gameOver',        _showGameOver);
}

function _render() {
    if ($hp)       $hp.textContent = `${state.hp} / ${state.maxHp}`;
    if ($distance) $distance.textContent = `${Math.floor(state.distance)}m`;
    if ($coins)    $coins.textContent = String(state.coins);
}

export function hideSplash() {
    if ($message) $message.classList.add('hidden');
}

export function setCombatIndicator(active) {
    if ($combatIndicator) $combatIndicator.classList.toggle('hidden', !active);
}

export function showPaused() {
    if (!$message) return;
    $message.innerHTML = `
        <h1>PAUSED</h1>
        <p style="opacity:0.6">Press P to resume</p>
    `;
    $message.classList.remove('hidden');
}

export function hidePaused() {
    if ($message) $message.classList.add('hidden');
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050">YOU DIED</h1>
        <p>Distance walked: ${Math.floor(state.distance)}m — Coins: ${state.coins}</p>
        <p style="opacity:0.6">Press R to restart</p>
    `;
    $message.classList.remove('hidden');
}

// ============================================================
// Loot comparison modal
// ============================================================
//
// An "item" is a plain object, e.g.:
//   { name: 'Iron Sword', slot: 'weapon', rarity: 'common',
//     damage: 5, attackSpeed: 1.0, critChance: 0.05 }
//
// TODO(loot.js / monsters.js): generate items with this shape and call
//   showLootComparison(item) whenever a monster drops gear.

const ATTR_LABELS = {
    damage:      'Damage',
    attackSpeed: 'Attack Speed',
    critChance:  'Crit Chance',
    defense:     'Defense',
    maxHp:       'Max HP',
    moveSpeed:   'Move Speed',
};

function _attrsForSlot(slot) {
    if (slot === 'weapon') return WEAPON_ATTRS;
    if (slot === 'armor')  return ARMOR_ATTRS;
    return [];
}

/**
 * Show the equip-vs-new comparison panel. Resolves 'equip' or 'sell'
 * depending on the player's choice. Sale coin value is left to the caller
 * (loot.js should decide pricing based on rarity — see config.RARITY).
 */
export function showLootComparison(newItem, saleValue = 0) {
    return new Promise((resolve) => {
        const slot     = newItem.slot;
        const equipped = state.equipped[slot];
        const attrs    = _attrsForSlot(slot);

        $modalRoot.innerHTML = `
            <div class="loot-compare-backdrop">
                <div class="loot-compare-panel">
                    <h2>New ${slot} found!</h2>
                    <div class="loot-compare-columns">
                        ${_renderItemColumn('Equipped', equipped, attrs)}
                        ${_renderItemColumn('New', newItem, attrs, equipped)}
                    </div>
                    <div class="loot-compare-actions">
                        <button id="btn-equip">Equip</button>
                        <button id="btn-sell">Sell for ${saleValue} coins</button>
                    </div>
                </div>
            </div>
        `;
        _injectStylesOnce();
        $modalRoot.classList.add('active');

        const cleanup = (choice) => {
            $modalRoot.classList.remove('active');
            $modalRoot.innerHTML = '';
            resolve(choice);
        };

        document.getElementById('btn-equip').onclick = () => { playUiClick(); cleanup('equip'); };
        document.getElementById('btn-sell').onclick  = () => { playUiClick(); cleanup('sell'); };
    });
}

function _renderItemColumn(label, item, attrs, compareAgainst = null) {
    if (!item) {
        return `<div class="loot-compare-col"><h3>${label}</h3><p class="empty">— none —</p></div>`;
    }
    const rows = attrs.map((key) => {
        const val = item[key] ?? 0;
        let arrow = '';
        if (compareAgainst) {
            const base = compareAgainst[key] ?? 0;
            if (val > base) arrow = '<span class="arrow up">&#9650;</span>';
            else if (val < base) arrow = '<span class="arrow down">&#9660;</span>';
        }
        return `<div class="attr-row"><span>${ATTR_LABELS[key] ?? key}</span><span>${val} ${arrow}</span></div>`;
    }).join('');
    return `
        <div class="loot-compare-col">
            <h3>${label}</h3>
            <p class="item-name rarity-${item.rarity ?? 'common'}">${item.name}</p>
            ${rows}
        </div>
    `;
}

let _stylesInjected = false;
function _injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .loot-compare-backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.65);
            display: flex; align-items: center; justify-content: center;
        }
        .loot-compare-panel {
            background: #14141f; border: 1px solid #383858;
            border-radius: 8px; padding: 24px 32px; min-width: 420px;
            color: #dcdcf0;
        }
        .loot-compare-panel h2 { margin-bottom: 16px; font-size: 18px; letter-spacing: 1px; }
        .loot-compare-columns { display: flex; gap: 24px; }
        .loot-compare-col { flex: 1; }
        .loot-compare-col h3 { font-size: 12px; opacity: 0.6; margin-bottom: 6px; text-transform: uppercase; }
        .item-name { font-size: 15px; margin-bottom: 10px; }
        .rarity-common   { color: #cccccc; }
        .rarity-uncommon { color: #50dc64; }
        .rarity-rare     { color: #64c8ff; }
        .rarity-epic     { color: #b060ff; }
        .attr-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
        .arrow.up   { color: #50dc64; }
        .arrow.down { color: #ff5050; }
        .empty { opacity: 0.4; font-size: 13px; }
        .loot-compare-actions { margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end; }
        .loot-compare-actions button {
            font-family: inherit; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;
            background: #232338; border: 1px solid #4a4a70; color: #dcdcf0;
            padding: 8px 16px; border-radius: 4px; cursor: pointer;
        }
        .loot-compare-actions button:hover { background: #2e2e4a; }
        .shop-panel { min-width: 380px; }
        .shop-coins { opacity: 0.7; font-size: 13px; margin-bottom: 16px; }
        .shop-section { margin-bottom: 16px; }
        .shop-section h3 { font-size: 12px; opacity: 0.6; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .shop-row {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 13px; padding: 6px 0; gap: 12px;
        }
        .shop-row button {
            font-family: inherit; font-size: 12px; letter-spacing: 0.5px;
            background: #232338; border: 1px solid #4a4a70; color: #dcdcf0;
            padding: 5px 10px; border-radius: 4px; cursor: pointer; white-space: nowrap;
        }
        .shop-row button:hover:not(:disabled) { background: #2e2e4a; }
        .shop-row button:disabled { opacity: 0.35; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
}

// ============================================================
// Shop modal (town visits)
// ============================================================
// Called by main.js when the player enters a town's shop trigger volume.
// There's no bag (per the design's "equip or sell, no inventory" rule), so
// "sell inventory" here means selling whatever is *currently equipped* —
// reverting to bare hands/no armor in exchange for coins. Buying is limited
// to a heal potion (full-HP restore for a flat coin cost) rather than new
// gear, since gear only ever comes from loot drops in this design.

export function showShop() {
    return new Promise((resolve) => {
        const render = () => {
            $modalRoot.innerHTML = `
                <div class="loot-compare-backdrop">
                    <div class="loot-compare-panel shop-panel">
                        <h2>Town Shop</h2>
                        <p class="shop-coins">Coins: ${state.coins}</p>
                        <div class="shop-section">
                            <h3>Sell Equipped Gear</h3>
                            ${_renderSellRow('weapon')}
                            ${_renderSellRow('armor')}
                        </div>
                        <div class="shop-section">
                            <h3>Buy</h3>
                            <div class="shop-row">
                                <span>Healing Potion (restores ${POTION_HEAL} HP)</span>
                                <button id="btn-buy-potion" ${state.coins < POTION_COST || state.hp >= state.maxHp ? 'disabled' : ''}>
                                    Buy for ${POTION_COST}
                                </button>
                            </div>
                        </div>
                        <div class="loot-compare-actions">
                            <button id="btn-leave">Leave shop</button>
                        </div>
                    </div>
                </div>
            `;
            _injectStylesOnce();
            $modalRoot.classList.add('active');

            for (const slot of ['weapon', 'armor']) {
                const btn = document.getElementById(`btn-sell-${slot}`);
                if (btn) btn.onclick = () => {
                    const item = state.equipped[slot];
                    if (!item) return;
                    playUiClick();
                    state.addCoins(getSaleValue(item));
                    state.unequip(slot);
                    render();
                };
            }

            const potionBtn = document.getElementById('btn-buy-potion');
            if (potionBtn) potionBtn.onclick = () => {
                if (state.coins < POTION_COST || state.hp >= state.maxHp) return;
                playCoinPickup();
                state.coins -= POTION_COST;
                state.heal(POTION_HEAL);
                render();
            };

            document.getElementById('btn-leave').onclick = () => {
                playUiClick();
                $modalRoot.classList.remove('active');
                $modalRoot.innerHTML = '';
                resolve();
            };
        };
        render();
    });
}

function _renderSellRow(slot) {
    const item = state.equipped[slot];
    if (!item) {
        return `<div class="shop-row"><span class="empty">${slot} — none equipped</span></div>`;
    }
    const value = getSaleValue(item);
    return `
        <div class="shop-row">
            <span class="item-name rarity-${item.rarity ?? 'common'}">${item.name}</span>
            <button id="btn-sell-${slot}">Sell for ${value}</button>
        </div>
    `;
}
