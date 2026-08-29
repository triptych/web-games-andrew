/**
 * inventory.js — inventory panel (DOM overlay).
 * Reads state.inventory directly; equipping affects state.effectiveStats.
 */

import { state } from './state.js';
import { events } from './events.js';
import { ITEM_DEFS } from './config.js';
import { playUiClick } from './sounds.js';

let $panel, $list, $closeBtn, $openBtn;

export function initInventory() {
    $panel    = document.getElementById('inventory-panel');
    $list     = document.getElementById('inventory-list');
    $closeBtn = document.getElementById('inventory-close');
    $openBtn  = document.getElementById('inventory-open');

    $openBtn.addEventListener('click', openPanel);
    $closeBtn.addEventListener('click', closePanel);

    events.on('inventoryChanged', render);
    events.on('equipmentChanged', render);

    render();
}

function openPanel() {
    playUiClick();
    render();
    $panel.classList.remove('hidden');
}

function closePanel() {
    playUiClick();
    $panel.classList.add('hidden');
}

function render() {
    if (!$list) return;
    $list.innerHTML = '';

    if (state.inventory.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'inventory-empty';
        empty.textContent = 'Your bag is empty.';
        $list.appendChild(empty);
        return;
    }

    for (const stack of state.inventory) {
        const def = ITEM_DEFS[stack.id];
        if (!def) continue;

        const row = document.createElement('div');
        row.className = 'inventory-row';

        // Equip items each declare their own slot (trinket / charm as of
        // Phase 3) — only one item per slot can be equipped at a time.
        const slot = def.slot || 'trinket';
        const isEquipped = state.equipped[slot] === stack.id;

        row.innerHTML = `
            <span class="inv-icon">${def.icon}</span>
            <span class="inv-name">${def.name}${stack.count > 1 ? ` x${stack.count}` : ''}</span>
            <span class="inv-desc">${def.desc}</span>
        `;

        if (def.type === 'equip') {
            const btn = document.createElement('button');
            btn.className = 'inv-equip-btn';
            btn.textContent = isEquipped ? 'Unequip' : 'Equip';
            btn.addEventListener('click', () => {
                playUiClick();
                if (isEquipped) state.unequip(slot);
                else state.equip(slot, stack.id);
            });
            row.appendChild(btn);
        }

        $list.appendChild(row);
    }
}
