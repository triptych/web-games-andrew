/**
 * inventory.js — Weapon inventory screen.
 * Press I to open/close.
 *
 * Exports:
 *   initInventory()
 *   showInventory()
 *   hideInventory()
 */

import { state }  from './state.js';
import { events } from './events.js';
import { WEAPON_DEFS } from './config.js';
import { playUiClick } from './sounds.js';

const panel = document.getElementById('inventory-panel');
const list  = document.getElementById('inventory-list');
const close = document.getElementById('inventory-close');

function _render() {
    if (!list) return;
    list.innerHTML = '';
    for (const [type, wDef] of Object.entries(WEAPON_DEFS)) {
        if (!state.hasWeapon(type)) continue;
        const equipped = state.equippedWeapon === type;
        const row = document.createElement('div');
        row.className = 'inv-item' + (equipped ? ' inv-equipped' : '');
        row.innerHTML = `
            <div class="inv-name">${wDef.label} ${equipped ? '<span style="color:#88ddff;font-size:11px">(equipped)</span>' : ''}</div>
            <div class="inv-stats">DMG ×${wDef.dmgMult} &nbsp; Range ${wDef.range} &nbsp; ${wDef.isRanged ? 'Ranged' : 'Melee'}</div>
            <button data-type="${type}" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>
        `;
        list.appendChild(row);
    }

    list.querySelectorAll('button[data-type]:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            state.equippedWeapon = btn.dataset.type;
            playUiClick();
            events.emit('message', `Equipped: ${WEAPON_DEFS[btn.dataset.type].label}`, '#c8e8a0');
            _render();
        });
    });
}

export function showInventory() {
    _render();
    if (panel) panel.style.display = 'block';
}

export function hideInventory() {
    if (panel) panel.style.display = 'none';
}

export function initInventory() {
    events.on('inventoryChanged', () => {
        if (panel && panel.style.display === 'block') _render();
    });
    events.on('weaponChanged', () => {
        if (panel && panel.style.display === 'block') _render();
    });

    if (close) close.addEventListener('click', () => { playUiClick(); hideInventory(); });
}
