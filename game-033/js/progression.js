/**
 * progression.js — leveling feedback layer.
 * The actual XP/level math lives in state.js (addXp); this module just
 * reacts to the resulting events with sound + a toast notification.
 */

import { events } from './events.js';
import { playLevelUp } from './sounds.js';

export function initProgression() {
    events.on('levelUp', (newLevel) => {
        playLevelUp();
        showLevelUpToast(newLevel);
    });
}

function showLevelUpToast(newLevel) {
    const toast = document.createElement('div');
    toast.className = 'level-up-toast';
    toast.textContent = `Level Up! You are now level ${newLevel}.`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 2200);
}
