/**
 * statsPanel.js — stat-point spending UI.
 * A small badge appears next to the HUD level readout whenever
 * state.stats.statPoints > 0; clicking it opens a compact modal with
 * Strength / Wit / Charm rows, each with a + button wired to
 * state.spendStatPoint(name).
 */

import { state } from './state.js';
import { events } from './events.js';
import { playUiClick, playChoiceSelect } from './sounds.js';
import { restoreStageFocus } from './vnRenderer.js';

const STAT_ROWS = [
    { key: 'strength', label: 'Strength', desc: 'Battle damage dealt' },
    { key: 'wit',      label: 'Wit',      desc: 'Flee chance, gates some dialogue' },
    { key: 'charm',    label: 'Charm',    desc: 'Affinity gained from choices' },
];

let $badge, $panel, $points, $rows, $closeBtn;

export function initStatsPanel() {
    $badge    = document.getElementById('hud-statpoints-badge');
    $panel    = document.getElementById('stats-panel');
    $points   = document.getElementById('stats-points-remaining');
    $rows     = document.getElementById('stats-rows');
    $closeBtn = document.getElementById('stats-close');

    $badge.addEventListener('click', () => {
        playUiClick();
        openPanel();
    });
    $closeBtn.addEventListener('click', () => {
        playUiClick();
        closePanel();
    });
    // Tapping the dimmed backdrop closes the panel too — on touch devices
    // there's no Escape key, so this is the only "click outside" affordance.
    $panel.addEventListener('click', (e) => {
        if (e.target === $panel) closePanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$panel.classList.contains('hidden')) closePanel();
    });

    events.on('statsChanged', render);
    events.on('levelUp', render);

    render();
}

function openPanel() {
    $panel.classList.remove('hidden');
    render();
    $closeBtn.focus();
}

function closePanel() {
    $panel.classList.add('hidden');
    restoreStageFocus();
}

function render() {
    if (!$badge) return;
    const points = state.stats.statPoints;

    $badge.textContent = `+${points}`;
    $badge.classList.toggle('hidden', points <= 0);

    if ($panel.classList.contains('hidden')) return;

    $points.textContent = points > 0
        ? `You have ${points} stat point${points === 1 ? '' : 's'} to spend.`
        : 'No stat points to spend right now.';

    $rows.innerHTML = '';
    for (const row of STAT_ROWS) {
        const el = document.createElement('div');
        el.className = 'stats-row';
        el.innerHTML = `
            <span class="stats-row-label">${row.label}</span>
            <span class="stats-row-value">${state.stats[row.key]}</span>
            <span class="stats-row-desc">${row.desc}</span>
        `;
        const btn = document.createElement('button');
        btn.className = 'stats-row-btn';
        btn.textContent = '+';
        btn.disabled = points <= 0;
        btn.addEventListener('click', () => {
            playChoiceSelect();
            state.spendStatPoint(row.key);
        });
        el.appendChild(btn);
        $rows.appendChild(el);
    }
}
