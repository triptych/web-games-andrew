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

export function playFootstep() {
    // Dull thud of a boot on stone
    _sweep('sine', 120, 60, 0.08, 0.2);
    _noise(0.05, 0.08, 0.02);
}

export function playBump() {
    // Walk into a wall
    _sweep('square', 200, 100, 0.12, 0.3);
    _noise(0.08, 0.1);
}

export function playDoorOpen() {
    _sweep('sawtooth', 300, 500, 0.2, 0.2);
    _sweep('sawtooth', 500, 700, 0.15, 0.15, 0.18);
}

export function playAttack() {
    _sweep('sawtooth', 600, 200, 0.15, 0.35);
    _noise(0.08, 0.12);
}

export function playEnemyAttack() {
    _sweep('square', 400, 150, 0.18, 0.3);
    _noise(0.1, 0.1, 0.05);
}

export function playPlayerHit() {
    _sweep('sawtooth', 300, 80, 0.25, 0.4);
    _noise(0.15, 0.18);
}

export function playEnemyDie() {
    _sweep('sawtooth', 500, 60, 0.4, 0.35);
    _noise(0.2, 0.12, 0.1);
}

export function playPickup() {
    _osc('sine', 880, 0.08, 0.2);
    _osc('sine', 1100, 0.1, 0.15, 0.07);
}

export function playStairs() {
    const notes = [262, 330, 392, 523];
    notes.forEach((f, i) => _osc('sine', f, 0.12, 0.18, i * 0.07));
}

export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

export function playPoison() {
    // Bubbly rising burble
    _sweep('sine', 200, 400, 0.3, 0.15);
    _noise(0.2, 0.08, 0.05);
}

export function playStun() {
    // Sharp crack + ring
    _noise(0.05, 0.3);
    _sweep('square', 800, 300, 0.25, 0.2, 0.04);
}

export function playRangedAttack() {
    // Whoosh + thwap
    _sweep('sawtooth', 900, 300, 0.12, 0.2);
    _noise(0.06, 0.15, 0.1);
}
