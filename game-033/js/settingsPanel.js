/**
 * settingsPanel.js — Phase 4 settings modal: text speed and volume sliders.
 * Preferences live in settings.js (persisted separately from the save file)
 * and take effect immediately — no "Apply" button.
 */

import { settings, TEXT_SPEEDS } from './settings.js';
import { playUiClick } from './sounds.js';
import { restoreStageFocus } from './vnRenderer.js';

const SPEED_STEPS = [
    { key: 'slow',    label: 'Slow' },
    { key: 'normal',  label: 'Normal' },
    { key: 'fast',    label: 'Fast' },
    { key: 'instant', label: 'Instant' },
];

let $openBtn, $panel, $closeBtn, $speedSlider, $speedLabel, $volumeSlider, $volumeLabel;

export function initSettingsPanel() {
    $openBtn      = document.getElementById('hud-settings');
    $panel        = document.getElementById('settings-panel');
    $closeBtn     = document.getElementById('settings-close');
    $speedSlider  = document.getElementById('settings-speed-slider');
    $speedLabel   = document.getElementById('settings-speed-label');
    $volumeSlider = document.getElementById('settings-volume-slider');
    $volumeLabel  = document.getElementById('settings-volume-label');

    $openBtn.addEventListener('click', () => {
        playUiClick();
        openPanel();
    });
    $closeBtn.addEventListener('click', () => {
        playUiClick();
        closePanel();
    });
    $panel.addEventListener('click', (e) => {
        if (e.target === $panel) closePanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$panel.classList.contains('hidden')) closePanel();
    });

    $speedSlider.min = 0;
    $speedSlider.max = SPEED_STEPS.length - 1;
    $speedSlider.step = 1;
    $speedSlider.addEventListener('input', () => {
        const step = SPEED_STEPS[Number($speedSlider.value)];
        settings.setTextSpeed(TEXT_SPEEDS[step.key]);
        renderSpeedLabel();
    });

    $volumeSlider.min = 0;
    $volumeSlider.max = 100;
    $volumeSlider.step = 5;
    $volumeSlider.addEventListener('input', () => {
        settings.setVolume(Number($volumeSlider.value) / 100);
        renderVolumeLabel();
    });

    syncControlsFromSettings();
}

function openPanel() {
    syncControlsFromSettings();
    $panel.classList.remove('hidden');
    $closeBtn.focus();
}

function closePanel() {
    $panel.classList.add('hidden');
    restoreStageFocus();
}

function syncControlsFromSettings() {
    const stepIndex = SPEED_STEPS.findIndex(
        (s) => TEXT_SPEEDS[s.key] === settings.textSpeedMsPerChar
    );
    $speedSlider.value = stepIndex >= 0 ? stepIndex : 1;
    $volumeSlider.value = Math.round(settings.volume * 100);
    renderSpeedLabel();
    renderVolumeLabel();
}

function renderSpeedLabel() {
    const step = SPEED_STEPS[Number($speedSlider.value)];
    $speedLabel.textContent = step.label;
}

function renderVolumeLabel() {
    $volumeLabel.textContent = `${$volumeSlider.value}%`;
}
