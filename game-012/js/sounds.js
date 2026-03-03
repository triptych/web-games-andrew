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

// Card flip / pull reveal
export function playCardFlip() {
    _sweep('triangle', 300, 600, 0.12, 0.2);
    _osc('sine', 900, 0.08, 0.1, 0.1);
}

// Gacha pull — common
export function playPullCommon() {
    _osc('sine', 440, 0.15, 0.2);
    _osc('sine', 550, 0.12, 0.12, 0.1);
}

// Gacha pull — rare
export function playPullRare() {
    const notes = [440, 554, 659];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.25, i * 0.09));
}

// Gacha pull — legendary
export function playPullLegendary() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.22, 0.3, i * 0.08));
    _noise(0.15, 0.06, 0.4);
}

// Battle attack
export function playAttack() {
    _sweep('square', 400, 150, 0.12, 0.25);
    _noise(0.08, 0.1);
}

// Battle magic / spell
export function playSpell() {
    _sweep('sine', 600, 1200, 0.2, 0.2);
    _osc('triangle', 800, 0.15, 0.15, 0.1);
}

// Heal
export function playHeal() {
    _osc('sine', 523, 0.1, 0.2);
    _osc('sine', 659, 0.12, 0.2, 0.08);
    _osc('sine', 784, 0.14, 0.15, 0.16);
}

// Enemy hit
export function playEnemyHit() {
    _sweep('sawtooth', 300, 100, 0.1, 0.2);
}

// Party member hit (higher pitched, sharper)
export function playPartyHit() {
    _sweep('square', 220, 80, 0.12, 0.22);
    _noise(0.06, 0.08);
}

// Wave cleared
export function playWaveCleared() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playFailure() {
    _sweep('sawtooth', 400, 80, 0.5, 0.3);
    _noise(0.3, 0.1, 0.1);
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

// Reading — slow triangle sweep + reverb-like tail
export function playReadingFlip() {
    _sweep('triangle', 200, 500, 0.6, 0.25);
    _osc('sine', 300, 0.8, 0.08, 0.5);
    _osc('sine', 450, 0.5, 0.06, 0.65);
}

// Omen blessing — ascending five-note sine arpeggio
export function playOmenBlessing() {
    const notes = [392, 494, 587, 740, 880];
    notes.forEach((f, i) => _osc('sine', f, 0.22, 0.22, i * 0.10));
}

// Omen curse — descending tritone + low rumble
export function playOmenCurse() {
    _sweep('sawtooth', 440, 311, 0.5, 0.25);  // descending tritone (A→Eb)
    _osc('sine', 55, 0.6, 0.35, 0.2);          // low rumble
    _noise(0.3, 0.08, 0.15);
}

// Item used — quick blip + ascending chord
export function playItemUsed() {
    _osc('sine', 660, 0.06, 0.18);
    _osc('sine', 880, 0.1, 0.15, 0.06);
    _osc('sine', 1100, 0.12, 0.12, 0.12);
}
