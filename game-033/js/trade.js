/**
 * trade.js — Peddler Ock's cart (DOM overlay).
 *
 * Phase 6. The shop half of "you inherited an apothecary" finally has an
 * economy: brew things, sell them to the peddler, buy the materials you
 * can't forage yet. Buying costs an item's `value` from config.js; selling
 * pays `sellPrice()` (half, rounded down), so the margin comes from brewing
 * rather than from arbitrage.
 *
 * The panel is only reachable while Ock's cart is actually in the square —
 * the story sets the `tradeOpen` flag when you walk up to it and clears it
 * when you walk away — plus an `openTrade` effect for opening it straight
 * from a dialogue choice.
 */

import { state } from './state.js';
import { events } from './events.js';
import { ITEM_DEFS, TRADE_STOCK, buyPrice, sellPrice } from './config.js';
import { playUiClick, playChoiceSelect, playFailure } from './sounds.js';
import { restoreStageFocus } from './vnRenderer.js';

let $openBtn, $panel, $list, $closeBtn, $coin, $tabBuy, $tabSell;
let mode = 'buy';

export function initTrade() {
    $openBtn  = document.getElementById('trade-open');
    $panel    = document.getElementById('trade-panel');
    $list     = document.getElementById('trade-list');
    $closeBtn = document.getElementById('trade-close');
    $coin     = document.getElementById('trade-coin');
    $tabBuy   = document.getElementById('trade-tab-buy');
    $tabSell  = document.getElementById('trade-tab-sell');

    $openBtn.addEventListener('click', openPanel);
    $closeBtn.addEventListener('click', closePanel);
    $tabBuy.addEventListener('click', () => setMode('buy'));
    $tabSell.addEventListener('click', () => setMode('sell'));

    $panel.addEventListener('click', (e) => {
        if (e.target === $panel) closePanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$panel.classList.contains('hidden')) closePanel();
    });

    events.on('flagChanged', onFlagChanged);
    events.on('inventoryChanged', render);
    events.on('coinChanged', render);
    events.on('openTrade', openPanel);
    events.on('gameLoaded', refreshButtonVisibility);

    refreshButtonVisibility();
}

function onFlagChanged(name) {
    if (name === 'tradeOpen' || name === 'peddlerDeepStock') {
        refreshButtonVisibility();
        render();
    }
}

function refreshButtonVisibility() {
    if (!$openBtn) return;
    $openBtn.classList.toggle('hidden', !state.getFlag('tradeOpen'));
}

function setMode(next) {
    mode = next;
    playUiClick();
    $tabBuy.classList.toggle('trade-tab-active', mode === 'buy');
    $tabSell.classList.toggle('trade-tab-active', mode === 'sell');
    render();
}

function openPanel() {
    playUiClick();
    setMode('buy');
    $panel.classList.remove('hidden');
    $closeBtn.focus();
}

function closePanel() {
    playUiClick();
    $panel.classList.add('hidden');
    restoreStageFocus();
}

/** What Ock currently has laid out — some stock only appears once the story
 *  has sent him deeper into the county for it. */
export function availableStock() {
    return TRADE_STOCK.filter(entry => !entry.flag || state.getFlag(entry.flag));
}

/** Everything in the bag that has a trade `value` — quest items don't. */
export function sellableStacks() {
    return state.inventory.filter(stack => {
        const def = ITEM_DEFS[stack.id];
        return def && def.value && state.equipped[def.slot || 'trinket'] !== stack.id;
    });
}

function row({ icon, name, desc, priceLabel, btnLabel, disabled, onClick }) {
    const el = document.createElement('div');
    el.className = 'trade-row';
    el.innerHTML = `
        <span class="trade-icon">${icon}</span>
        <span class="trade-name">${name}</span>
        <span class="trade-desc">${desc}</span>
        <span class="trade-price">${priceLabel}</span>
    `;
    const btn = document.createElement('button');
    btn.className = 'trade-btn';
    btn.textContent = btnLabel;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    el.appendChild(btn);
    return el;
}

function render() {
    if (!$list) return;
    $coin.textContent = `${state.coin}c`;
    $list.innerHTML = '';

    if (mode === 'buy') {
        const stock = availableStock();
        if (!stock.length) {
            $list.appendChild(emptyLine('The cart is bare today.'));
            return;
        }
        for (const entry of stock) {
            const def = ITEM_DEFS[entry.item];
            const price = buyPrice(entry.item);
            if (!def || price == null) continue;
            $list.appendChild(row({
                icon: def.icon,
                name: def.name,
                desc: def.desc,
                priceLabel: `${price}c`,
                btnLabel: 'Buy',
                disabled: state.coin < price,
                onClick: () => {
                    if (!state.spendCoin(price)) { playFailure(); return; }
                    playChoiceSelect();
                    state.addItem(entry.item, 1);
                    render();
                },
            }));
        }
        return;
    }

    const stacks = sellableStacks();
    if (!stacks.length) {
        $list.appendChild(emptyLine('Nothing in your bag he wants — and he says so, at length.'));
        return;
    }
    for (const stack of stacks) {
        const def = ITEM_DEFS[stack.id];
        const price = sellPrice(stack.id);
        $list.appendChild(row({
            icon: def.icon,
            name: `${def.name}${stack.count > 1 ? ` x${stack.count}` : ''}`,
            desc: def.desc,
            priceLabel: `${price}c`,
            btnLabel: 'Sell',
            disabled: false,
            onClick: () => {
                playChoiceSelect();
                state.removeItem(stack.id, 1);
                state.addCoin(price);
                render();
            },
        }));
    }
}

function emptyLine(text) {
    const el = document.createElement('div');
    el.className = 'trade-empty';
    el.textContent = text;
    return el;
}
