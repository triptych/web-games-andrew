/**
 * vnRenderer.js — DOM rendering for the visual novel screen.
 * Renders background, speaker portrait, typewriter dialogue text,
 * and choice buttons. Talks to dialogueEngine via choiceIsAvailable/selectChoice.
 */

import { PORTRAITS, BACKGROUNDS } from './story.js';
import { choiceIsAvailable, selectChoice } from './dialogueEngine.js';
import { events } from './events.js';
import { playPageBlip, playChoiceSelect } from './sounds.js';
import { settings } from './settings.js';

let $stage, $portrait, $speaker, $textbox, $choices, $advanceHint;

let currentNode = null;
let lineQueue = [];
let typewriterTimer = null;
let isTyping = false;
let currentFullLine = '';

export function initVnRenderer() {
    $stage       = document.getElementById('vn-stage');
    $portrait    = document.getElementById('vn-portrait');
    $speaker     = document.getElementById('vn-speaker');
    $textbox     = document.getElementById('vn-text');
    $choices     = document.getElementById('vn-choices');
    $advanceHint = document.getElementById('vn-advance-hint');

    $textbox.addEventListener('click', onAdvance);
    $textbox.setAttribute('tabindex', '0');
    $textbox.setAttribute('role', 'button');
    document.addEventListener('keydown', onKeyDown);

    events.on('nodeEntered', showNode);
}

function showNode(node) {
    currentNode = node;

    // Background
    const bg = BACKGROUNDS[node.background];
    if (bg) $stage.style.background = bg.gradient;

    // Portrait / speaker
    if (node.portrait && PORTRAITS[node.portrait]) {
        const p = PORTRAITS[node.portrait];
        $portrait.textContent = p.emoji;
        $portrait.classList.remove('hidden');
        $speaker.textContent = node.speaker || p.label || '';
        $speaker.classList.toggle('hidden', !($speaker.textContent));
    } else {
        $portrait.classList.add('hidden');
        $speaker.classList.add('hidden');
    }

    // Lines
    lineQueue = Array.isArray(node.text) ? [...node.text] : [node.text];
    $choices.innerHTML = '';
    $choices.classList.add('hidden');
    advanceLine();
}

function advanceLine() {
    if (isTyping) {
        // Skip typing animation, show full line immediately
        clearTimeout(typewriterTimer);
        $textbox.textContent = currentFullLine;
        isTyping = false;
        $advanceHint.classList.remove('hidden');
        return;
    }

    if (lineQueue.length === 0) {
        showChoices();
        return;
    }

    currentFullLine = lineQueue.shift();
    typeLine(currentFullLine);
}

function typeLine(fullText) {
    const msPerChar = settings.textSpeedMsPerChar;

    // "Instant" text speed: skip the animation outright rather than firing
    // a zero-delay timer per character.
    if (msPerChar <= 0) {
        isTyping = false;
        $textbox.textContent = fullText;
        $advanceHint.classList.remove('hidden');
        return;
    }

    isTyping = true;
    $advanceHint.classList.add('hidden');
    $textbox.textContent = '';
    let i = 0;

    function tick() {
        if (!isTyping) return; // was skipped
        $textbox.textContent = fullText.slice(0, i + 1);
        i++;
        if (i % 3 === 0) playPageBlip();
        if (i < fullText.length) {
            typewriterTimer = setTimeout(tick, msPerChar);
        } else {
            isTyping = false;
            $advanceHint.classList.remove('hidden');
        }
    }
    tick();
}

function onAdvance() {
    if (!currentNode) return;
    if (!$choices.classList.contains('hidden')) return; // waiting on a choice
    advanceLine();
}

/**
 * Returns focus to wherever a keyboard user should land after closing a
 * modal (inventory/brewing/stats/settings): the currently-visible choice
 * button if one exists, otherwise the dialogue textbox. Every panel's close
 * handler calls this instead of focusing its own "open" button, so closing
 * a modal never strands keyboard focus somewhere off-stage.
 */
export function restoreStageFocus() {
    const visibleChoice = $choices && !$choices.classList.contains('hidden')
        ? $choices.querySelector('.vn-choice-btn')
        : null;
    if (visibleChoice) visibleChoice.focus();
    else if ($textbox) $textbox.focus();
}

// --- Keyboard accessibility (Phase 4) ---
// Space/Enter advance dialogue, but only when focus isn't already on an
// interactive element (a choice button, a modal control, etc.) — otherwise
// a keypress that activates a focused button via its native behavior would
// *also* trigger onAdvance(), double-firing. Arrow keys move focus between
// choice buttons once they're showing, so the whole story is playable
// without a mouse.
function onKeyDown(e) {
    const isChoicesShowing = !$choices.classList.contains('hidden');
    const focusedIsChoice = $choices.contains(document.activeElement);

    if (isChoicesShowing) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveChoiceFocus(e.key === 'ArrowDown' ? 1 : -1);
        }
        return; // Enter/Space on a focused choice button is handled natively
    }

    if (focusedIsChoice) return;

    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onAdvance();
    }
}

function moveChoiceFocus(delta) {
    const buttons = [...$choices.querySelectorAll('.vn-choice-btn')];
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = currentIndex === -1
        ? 0
        : (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
}

function showChoices() {
    $advanceHint.classList.add('hidden');
    const choices = currentNode.choices || [];

    if (choices.length === 0) {
        // Terminal node (e.g. ending) — nothing more to do here.
        return;
    }

    $choices.innerHTML = '';
    for (const choice of choices) {
        if (!choiceIsAvailable(choice)) continue;
        const btn = document.createElement('button');
        btn.className = 'vn-choice-btn';
        btn.textContent = choice.label;
        btn.addEventListener('click', () => {
            playChoiceSelect();
            selectChoice(choice);
        });
        $choices.appendChild(btn);
    }
    $choices.classList.remove('hidden');

    // Focus the first choice so keyboard-only players land somewhere sane
    // without having to Tab in from elsewhere on the page. Deferred a tick:
    // when showChoices() runs synchronously inside a click handler on
    // #vn-text (itself focusable for keyboard users), the browser's native
    // focus-follows-click behavior for that click fires *after* this
    // function returns and would otherwise steal focus right back.
    const firstBtn = $choices.querySelector('.vn-choice-btn');
    if (firstBtn) setTimeout(() => firstBtn.focus(), 0);
}
