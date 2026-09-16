/**
 * journal.js — Wisteria's Journal (DOM overlay).
 *
 * Phase 6. Two jobs, both of which exist because the season got long:
 *   1. "Asked of You" — every quest the story has started, split into
 *      still-open and finished, so a player who puts the game down for a
 *      week can pick up what they were in the middle of.
 *   2. "What You've Learned" — collected lore entries (journal pages,
 *      things Granny Sessily and Hollow tell you), so the backstory of the
 *      hearth-stone is readable rather than only overheard once.
 *
 * The panel and its HUD button stay hidden until the player actually finds
 * the journal in the aunt's workroom (the `hasJournal` story flag).
 */

import { state } from './state.js';
import { events } from './events.js';
import { QUEST_DEFS, LORE_DEFS } from './config.js';
import { playUiClick } from './sounds.js';
import { restoreStageFocus } from './vnRenderer.js';

let $openBtn, $panel, $list, $closeBtn;

export function initJournal() {
    $openBtn  = document.getElementById('journal-open');
    $panel    = document.getElementById('journal-panel');
    $list     = document.getElementById('journal-list');
    $closeBtn = document.getElementById('journal-close');

    $openBtn.addEventListener('click', openPanel);
    $closeBtn.addEventListener('click', closePanel);
    $panel.addEventListener('click', (e) => {
        if (e.target === $panel) closePanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$panel.classList.contains('hidden')) closePanel();
    });

    events.on('flagChanged', onFlagChanged);
    events.on('questChanged', onQuestChanged);
    events.on('loreAdded', render);
    events.on('gameLoaded', () => { refreshButtonVisibility(); render(); });

    refreshButtonVisibility();
    render();
}

function onFlagChanged(name) {
    if (name === 'hasJournal') refreshButtonVisibility();
}

// A new or newly-finished quest pulses the HUD button, so the player knows
// there's something to read without the game interrupting the scene.
function onQuestChanged() {
    render();
    if (!$openBtn || $openBtn.classList.contains('hidden')) return;
    $openBtn.classList.remove('journal-nudge');
    // Force a reflow so re-adding the class restarts the animation.
    void $openBtn.offsetWidth;
    $openBtn.classList.add('journal-nudge');
}

function refreshButtonVisibility() {
    if (!$openBtn) return;
    $openBtn.classList.toggle('hidden', !state.getFlag('hasJournal'));
}

function openPanel() {
    playUiClick();
    render();
    $openBtn.classList.remove('journal-nudge');
    $panel.classList.remove('hidden');
    $closeBtn.focus();
}

function closePanel() {
    playUiClick();
    $panel.classList.add('hidden');
    restoreStageFocus();
}

function sectionHeading(text) {
    const h = document.createElement('h3');
    h.className = 'journal-heading';
    h.textContent = text;
    return h;
}

function emptyLine(text) {
    const el = document.createElement('div');
    el.className = 'journal-empty';
    el.textContent = text;
    return el;
}

function questRow(id, done) {
    const def = QUEST_DEFS[id] || { name: id, desc: '' };
    const row = document.createElement('div');
    row.className = `journal-row${done ? ' journal-row-done' : ''}`;
    row.innerHTML = `
        <span class="journal-mark">${done ? '✔' : '•'}</span>
        <span class="journal-name">${def.name}</span>
        <span class="journal-desc">${def.desc}</span>
    `;
    return row;
}

function loreRow(id) {
    const def = LORE_DEFS[id];
    if (!def) return null;
    const row = document.createElement('div');
    row.className = 'journal-row journal-row-lore';
    row.innerHTML = `
        <span class="journal-mark">📖</span>
        <span class="journal-name">${def.title}</span>
        <span class="journal-desc">${def.text}</span>
    `;
    return row;
}

function render() {
    if (!$list) return;
    $list.innerHTML = '';

    const entries = Object.entries(state.quests);
    const active = entries.filter(([, v]) => v === 'active').map(([k]) => k);
    const done   = entries.filter(([, v]) => v === 'done').map(([k]) => k);

    $list.appendChild(sectionHeading('Asked of You'));
    if (active.length === 0) {
        $list.appendChild(emptyLine('Nothing outstanding. Enjoy it while it lasts.'));
    } else {
        for (const id of active) $list.appendChild(questRow(id, false));
    }

    if (done.length) {
        $list.appendChild(sectionHeading('Settled'));
        for (const id of done) $list.appendChild(questRow(id, true));
    }

    $list.appendChild(sectionHeading('What You’ve Learned'));
    if (state.lore.length === 0) {
        $list.appendChild(emptyLine('The pages you can read so far are mostly about mintleaf.'));
    } else {
        for (const id of state.lore) {
            const row = loreRow(id);
            if (row) $list.appendChild(row);
        }
    }
}
