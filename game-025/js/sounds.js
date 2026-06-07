/**
 * sounds.js — Web Audio API procedural retro sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture (click / key press).
 *
 * Style note: square/sawtooth waves and noise bursts give the chunky
 * 8-bit arcade character that suits a Gauntlet-style crawler.
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
    _osc('square', 660, 0.06, 0.15);
}

// Class selected — short triumphant arpeggio
export function playClassSelect() {
    const notes = [392, 523, 659];
    notes.forEach((f, i) => _osc('square', f, 0.12, 0.18, i * 0.06));
}

// Player melee swing / ranged shot fired
export function playAttack() {
    _sweep('square', 880, 220, 0.12, 0.18);
}
export function playShot() {
    _sweep('sawtooth', 1200, 400, 0.14, 0.16);
}

// Enemy takes a hit
export function playHit() {
    _sweep('square', 300, 80, 0.1, 0.22);
    _noise(0.06, 0.08);
}

// Enemy dies — chunky pop
export function playEnemyDeath() {
    _sweep('square', 200, 50, 0.22, 0.25);
    _noise(0.18, 0.12);
}

// Nest destroyed — bigger boom
export function playNestDestroy() {
    _sweep('sawtooth', 160, 40, 0.5, 0.35);
    _noise(0.4, 0.2, 0.05);
}

// Food / treasure pickup
export function playPickup() {
    _osc('square', 880, 0.08, 0.2);
    _osc('square', 1320, 0.1, 0.15, 0.06);
}

// Key pickup — sparkly two-tone
export function playKey() {
    _osc('triangle', 1046, 0.1, 0.2);
    _osc('triangle', 1568, 0.12, 0.18, 0.08);
}

// Door opens — heavy slide
export function playDoor() {
    _sweep('sawtooth', 120, 320, 0.45, 0.22);
    _noise(0.3, 0.08);
}

// Player hurt
export function playPlayerHurt() {
    _sweep('sawtooth', 440, 120, 0.25, 0.3);
}

// Descend to next level — rising fanfare
export function playLevelComplete() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('square', f, 0.16, 0.2, i * 0.09));
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

export function playGameWon() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('square', f, 0.2, 0.22, i * 0.12));
}
