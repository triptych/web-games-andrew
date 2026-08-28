/**
 * vnRenderer.js — DOM rendering for the visual novel screen.
 * Renders background, speaker portrait, typewriter dialogue text,
 * and choice buttons. Talks to dialogueEngine via choiceIsAvailable/selectChoice.
 */

import { PORTRAITS, BACKGROUNDS } from './story.js';
import { choiceIsAvailable, selectChoice } from './dialogueEngine.js';
import { events } from './events.js';
import { playPageBlip, playChoiceSelect } from './sounds.js';
import { TYPEWRITER_MS_PER_CHAR } from './config.js';

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
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') onAdvance();
    });

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
            typewriterTimer = setTimeout(tick, TYPEWRITER_MS_PER_CHAR);
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
}
