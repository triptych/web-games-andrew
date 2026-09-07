import { UPGRADES } from './config.js';
import { state } from './state.js';
import { playUpgradeBuy } from './sounds.js';

/** Which upgrades appear under which Town tab. */
export const TAB_UPGRADES = {
    heroes: ['recruit', 'revive'],
    stats: ['atk', 'def', 'hp', 'goldfind'],
    delve: ['startFloor'],
};

export function buildUpgradeCard(id) {
    const u = UPGRADES[id];
    const lvl = state.getUpgradeLevel(id);
    const maxed = lvl >= u.maxLevel;
    const cost = maxed ? null : state.getUpgradeCost(id);

    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
        <div class="up-icon">${u.icon}</div>
        <div class="up-info">
            <div class="up-name">${u.name}</div>
            <div class="up-desc">${u.describe(lvl)}</div>
            <div class="up-level">Level ${lvl}${maxed ? ' (MAX)' : ' / ' + u.maxLevel}</div>
        </div>
        <button class="buy-btn" ${maxed || !state.canBuyUpgrade(id) ? 'disabled' : ''}>
            ${maxed ? 'MAXED' : '● ' + cost}
        </button>
    `;
    const btn = card.querySelector('.buy-btn');
    if (!maxed) {
        btn.addEventListener('click', () => {
            if (state.buyUpgrade(id)) {
                playUpgradeBuy();
            }
        });
    }
    return card;
}
