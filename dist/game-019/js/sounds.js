/**
 * sounds.js — Web Audio API procedural sound effects (synthwave style).
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
    masterGain.gain.value = 0.22;
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

/** Short synth blip for UI button press */
export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

/** Ball hits paddle — punchy low thud with rising tail */
export function playPaddleHit() {
    _sweep('square', 180, 280, 0.08, 0.28);
    _osc('sine', 320, 0.06, 0.1, 0.02);
}

/** Ball hits brick — sharp crack */
export function playBrickHit() {
    _sweep('sawtooth', 600, 250, 0.07, 0.22);
    _noise(0.04, 0.08);
}

/** Brick fully destroyed — satisfying synthwave pop */
export function playBrickDestroy() {
    _sweep('square', 800, 400, 0.12, 0.2);
    _osc('sine', 1200, 0.08, 0.15, 0.04);
    _noise(0.06, 0.1, 0.02);
}

/** Ball hits wall */
export function playWallBounce() {
    _osc('square', 240, 0.05, 0.12);
}

/** Ball lost / life lost */
export function playBallLost() {
    _sweep('sawtooth', 400, 60, 0.6, 0.35);
    _noise(0.4, 0.12, 0.1);
}

/** Powerup falls and is collected */
export function playPowerupCollect() {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => _osc('sine', f, 0.12, 0.18, i * 0.06));
}

/** Combo milestone (every 4 hits) */
export function playComboJingle() {
    _sweep('sine', 880, 1320, 0.15, 0.25);
    _osc('sine', 1760, 0.12, 0.2, 0.12);
}

/** Level complete fanfare */
export function playLevelComplete() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.22, i * 0.1));
}

/** Game over */
export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.9, 0.4);
    _noise(0.6, 0.15, 0.2);
}

/** Victory / game complete */
export function playVictory() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => _osc('sine', f, 0.22, 0.25, i * 0.09));
    _osc('triangle', 2093, 0.3, 0.3, 0.5);
}

/** Laser shot (laser paddle powerup) */
export function playLaser() {
    _sweep('sawtooth', 1200, 200, 0.12, 0.18);
}
