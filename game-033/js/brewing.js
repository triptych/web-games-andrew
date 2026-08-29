/**
 * brewing.js — brewing/crafting panel (DOM overlay).
 *
 * Lets the player turn material items (Dried Mintleaf, River Root, etc.)
 * into brewed consumables or equip items via BREW_RECIPES (config.js).
 * The panel is only reachable once the player has learned to brew —
 * gated by the 'canBrew' story flag, set by a dialogue effect — and its
 * HUD button stays hidden until then.
 */

import { state } from './state.js';
import { events } from './events.js';
import { BREW_RECIPES, ITEM_DEFS } from './config.js';
import { playUiClick, playChoiceSelect } from './sounds.js';

let $openBtn, $panel, $list, $closeBtn;

export function initBrewing() {
    $openBtn  = document.getElementById('brewing-open');
    $panel    = document.getElementById('brewing-panel');
    $list     = document.getElementById('brewing-list');
    $closeBtn = document.getElementById('brewing-close');

    $openBtn.addEventListener('click', openPanel);
    $closeBtn.addEventListener('click', closePanel);

    events.on('inventoryChanged', render);
    events.on('flagChanged', onFlagChanged);
    events.on('itemBrewed', render);

    refreshButtonVisibility();
    render();
}

function onFlagChanged(name) {
    if (name === 'canBrew') refreshButtonVisibility();
}

function refreshButtonVisibility() {
    if (!$openBtn) return;
    $openBtn.classList.toggle('hidden', !state.getFlag('canBrew'));
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

    const recipeIds = Object.keys(BREW_RECIPES);
    if (recipeIds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'brewing-empty';
        empty.textContent = 'No recipes known yet.';
        $list.appendChild(empty);
        return;
    }

    for (const recipeId of recipeIds) {
        const recipe = BREW_RECIPES[recipeId];
        const resultDef = ITEM_DEFS[recipe.result.item];
        const canMake = state.canBrew(recipeId);

        const row = document.createElement('div');
        row.className = 'brewing-row';

        const reqText = recipe.requires
            .map(req => `${req.count}x ${ITEM_DEFS[req.item]?.name || req.item}`)
            .join(', ');

        row.innerHTML = `
            <span class="brew-icon">${resultDef?.icon || '❔'}</span>
            <span class="brew-name">${recipe.name}</span>
            <span class="brew-req">${reqText}</span>
        `;

        const btn = document.createElement('button');
        btn.className = 'brew-btn';
        btn.textContent = 'Brew';
        btn.disabled = !canMake;
        btn.addEventListener('click', () => {
            playChoiceSelect();
            state.brew(recipeId);
            render();
        });
        row.appendChild(btn);

        $list.appendChild(row);
    }
}
