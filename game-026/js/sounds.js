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
    // Low square thud, pitch varied a little so repeated steps don't machine-gun.
    _osc('square', 60 + Math.random() * 18, 0.07, 0.18);
    _noise(0.04, 0.04);
}

export function playWallBump() {
    // Dull noise burst — heavier and flatter than a footstep.
    _noise(0.12, 0.22);
    _osc('square', 50, 0.12, 0.22);
}

export function playDescend() {
    // Low rumble sweep for taking the stairs.
    _sweep('sawtooth', 130, 35, 0.9, 0.3);
    _noise(0.6, 0.08, 0.1);
}

export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playFailure() {
    _sweep('sawtooth', 400, 80, 0.5, 0.3);
    _noise(0.3, 0.1, 0.1);
}

export function playHit() {
    _sweep('square', 300, 80, 0.1, 0.25);
}

export function playPickup() {
    _osc('sine', 880, 0.08, 0.2);
    _osc('sine', 1100, 0.1, 0.15, 0.07);
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

// Combat-specific sounds
export function playSwordSwing() {
    _sweep('square', 400, 120, 0.12, 0.2);
    _noise(0.06, 0.06, 0.04);
}

export function playMonsterHit() {
    _sweep('square', 280, 60, 0.15, 0.28);
    _noise(0.08, 0.12, 0.05);
}

export function playCombatStart() {
    _osc('square', 220, 0.1, 0.2);
    _osc('square', 180, 0.12, 0.2, 0.08);
    _noise(0.05, 0.05, 0.1);
}
