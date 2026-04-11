/**
 * sounds.js — Web Audio API procedural sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture.
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.2;
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

/** Short sword swing */
export function playSwordSwing() {
    _sweep('sawtooth', 280, 80, 0.08, 0.25);
    _sweep('square',   600, 200, 0.06, 0.12, 0.02);
}

/** Monster hit (thud) */
export function playMonsterHit() {
    _sweep('square', 160, 60, 0.1, 0.3);
    _noise(0.07, 0.15);
}

/** Monster dies */
export function playMonsterDie() {
    _sweep('sawtooth', 300, 40, 0.35, 0.3);
    _noise(0.25, 0.12, 0.05);
}

/** Player takes damage */
export function playPlayerHurt() {
    _sweep('square', 440, 110, 0.18, 0.35);
    _noise(0.12, 0.2, 0.02);
}

/** Pick up resource */
export function playPickup() {
    _osc('sine', 660, 0.07, 0.2);
    _osc('sine', 880, 0.09, 0.15, 0.06);
}

/** Gold pickup */
export function playGoldPickup() {
    _osc('sine',  880, 0.06, 0.2);
    _osc('sine', 1100, 0.07, 0.12, 0.05);
    _osc('sine', 1320, 0.08, 0.1,  0.09);
}

/** Building constructed */
export function playBuild() {
    const notes = [330, 440, 550, 660];
    notes.forEach((f, i) => _osc('triangle', f, 0.12, 0.25, i * 0.07));
}

/** Level up fanfare */
export function playLevelUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.28, i * 0.1));
}

/** UI click */
export function playUiClick() {
    _osc('sine', 660, 0.05, 0.15);
}

/** Game over */
export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.9, 0.4);
    _noise(0.6, 0.15, 0.2);
}

/** Footstep (very quiet) */
export function playFootstep() {
    _noise(0.04, 0.04);
}
