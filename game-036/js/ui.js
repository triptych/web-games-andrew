/**
 * ui.js — DOM HUD bindings. All HUD markup lives as fixed-position DOM
 * elements in index.html; this module just wires them to game state.
 */

import { state } from './state.js';
import { events } from './events.js';

let $region, $books, $artifacts, $carried, $prompt, $toast, $lockHint, $complete;
let $objective, $objectiveText;
let $toastTimer;

export function initUI() {
    $region = document.getElementById('region-label');
    $books = document.getElementById('books-count');
    $artifacts = document.getElementById('artifacts-count');
    $carried = document.getElementById('carried-line');
    $prompt = document.getElementById('interact-prompt');
    $toast = document.getElementById('toast');
    $lockHint = document.getElementById('lock-hint');
    $complete = document.getElementById('complete-overlay');
    $objective = document.getElementById('hud-objective');
    $objectiveText = document.getElementById('hud-objective-text');

    _render();

    events.on('progressChanged', _render);
    events.on('regionEntered', (name) => {
        if ($region) $region.textContent = _prettyRegion(name);
    });
    events.on('itemCollected', ({ kind, name }) => {
        const where = kind === 'book' ? 'the library' : 'the museum';
        showToast(`${kind === 'book' ? '📖' : '🏺'} ${name} — carry it to ${where}`);
    });
    events.on('gameComplete', () => {
        if ($complete) $complete.classList.remove('hidden');
    });
}

/**
 * The one-line "what am I doing" readout under the collection counters.
 *
 * Pushed in by whoever owns the quest log rather than pulled from it, so ui.js
 * stays a pure view over events and does not have to import the quest module —
 * the HUD should not need to know that quests have tracks or predicates.
 */
export function setObjective(text) {
    if (!$objective || !$objectiveText) return;
    if (text) {
        $objectiveText.textContent = text;
        $objective.classList.remove('hidden');
    } else {
        $objective.classList.add('hidden');
    }
}

function _prettyRegion(name) {
    const map = {
        shore: 'The Shore', forest: 'The Forest', cave: 'The Cave',
        lighthouse: 'The Lighthouse', cemetery: 'The Cemetery', garden: 'The Garden',
        ruins: 'Ancient Ruins', library: 'The Library', museum: 'The Museum',
        meadow: 'The Meadow',
    };
    return map[name] || name;
}

function _render() {
    if ($books) $books.textContent = `${state.booksShelved} / ${state.booksTotal}`;
    if ($artifacts) $artifacts.textContent = `${state.artifactsDisplayed} / ${state.artifactsTotal}`;

    if ($carried) {
        const b = state.carriedBooks, a = state.carriedArtifacts;
        if (b === 0 && a === 0) {
            $carried.classList.add('hidden');
        } else {
            const parts = [];
            if (b > 0) parts.push(`${b} book${b > 1 ? 's' : ''}`);
            if (a > 0) parts.push(`${a} artifact${a > 1 ? 's' : ''}`);
            $carried.textContent = `Carrying ${parts.join(' + ')}`;
            $carried.classList.remove('hidden');
        }
    }
}

export function showToast(text) {
    if (!$toast) return;
    $toast.textContent = text;
    $toast.classList.add('visible');
    clearTimeout($toastTimer);
    $toastTimer = setTimeout(() => $toast.classList.remove('visible'), 2800);
}

export function setPrompt(text) {
    if (!$prompt) return;
    if (text) {
        $prompt.textContent = text;
        $prompt.classList.remove('hidden');
    } else {
        $prompt.classList.add('hidden');
    }
}

export function setLockHintVisible(visible) {
    if ($lockHint) $lockHint.classList.toggle('hidden', !visible);
}
