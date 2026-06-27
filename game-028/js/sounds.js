/**
 * sounds.js — Web Audio API procedural sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture (click / key press).
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(audioCtx.destination);
}

export function setSoundEnabled(val) { _enabled = val; }
export function isSoundEnabled()     { return _enabled; }
export function toggleSound()        { _enabled = !_enabled; return _enabled; }

// --- Internal helpers ---

function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function _sweep(type, freqStart, freqEnd, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function _noise(duration, vol = 0.15, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf     = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain);
    gain.connect(masterGain);
    src.start(t);
}

// --- Sound effects ---

export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

export function playMenuOpen() {
    _osc('triangle', 440, 0.1, 0.2);
    _osc('triangle', 550, 0.12, 0.15, 0.05);
}

export function playDialogAdvance() {
    _osc('sine', 800, 0.04, 0.1);
}

export function playDialogEnd() {
    _osc('sine', 660, 0.06, 0.12);
    _osc('sine', 880, 0.08, 0.1, 0.06);
}

export function playFootstep() {
    _noise(0.05, 0.08);
}

export function playBattleStart() {
    const notes = [220, 277, 330, 415, 494];
    notes.forEach((f, i) => _osc('sawtooth', f, 0.2, 0.25, i * 0.06));
}

export function playSwordSwing() {
    _sweep('sawtooth', 600, 200, 0.15, 0.3);
    _noise(0.1, 0.1, 0.05);
}

export function playMagicCast() {
    _sweep('sine', 300, 1200, 0.3, 0.2);
    _osc('triangle', 880, 0.2, 0.15, 0.1);
}

export function playHeal() {
    const notes = [523, 659, 784];
    notes.forEach((f, i) => _osc('triangle', f, 0.2, 0.2, i * 0.07));
}

export function playHit() {
    _sweep('square', 300, 80, 0.1, 0.25);
    _noise(0.08, 0.15);
}

export function playDeath() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

export function playVictory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1175];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.25, i * 0.09));
}

export function playItemPickup() {
    _osc('sine', 880, 0.08, 0.2);
    _osc('sine', 1100, 0.1, 0.15, 0.07);
}

export function playQuestComplete() {
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('triangle', f, 0.25, 0.3, i * 0.08));
}

export function playLevelUp() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => _osc('sine', f, 0.2, 0.3, i * 0.07));
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}
