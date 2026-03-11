/**
 * sounds.js — Web Audio API procedural sound effects for Tamagoji.
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

// --- Sound effects ---

export function playUiClick() {
    _osc('sine', 880, 0.05, 0.12);
}

export function playFeed() {
    // Happy nom nom sound
    _osc('sine', 523, 0.08, 0.2);
    _osc('sine', 659, 0.08, 0.2, 0.07);
    _osc('sine', 784, 0.1,  0.2, 0.14);
}

export function playHappy() {
    // Cheerful ascending tones
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.12, 0.18, i * 0.07));
}

export function playHatch() {
    // Egg crack + cheerful fanfare
    _sweep('sawtooth', 200, 800, 0.15, 0.2);
    const fanfare = [523, 659, 784, 1047, 1319];
    fanfare.forEach((f, i) => _osc('triangle', f, 0.2, 0.25, 0.15 + i * 0.09));
}

export function playStageUp() {
    // Level-up jingle
    const notes = [784, 988, 1175, 1568];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.3, i * 0.1));
}

export function playSad() {
    _sweep('triangle', 400, 220, 0.4, 0.2);
    _sweep('triangle', 300, 180, 0.5, 0.15, 0.15);
}

export function playDeath() {
    _sweep('sawtooth', 300, 50, 1.2, 0.35);
    _sweep('sine', 220, 80, 0.8, 0.2, 0.4);
}

export function playEggGet() {
    _osc('triangle', 660, 0.08, 0.2);
    _osc('triangle', 880, 0.1,  0.2, 0.09);
    _osc('triangle', 1100, 0.12, 0.2, 0.18);
}

export function playSleep() {
    _sweep('sine', 300, 180, 0.6, 0.15);
    _sweep('sine', 250, 150, 0.7, 0.12, 0.3);
}

export function playBath() {
    // Bubbly water sound
    for (let i = 0; i < 5; i++) {
        const f = 400 + Math.random() * 400;
        _osc('sine', f, 0.1, 0.1, i * 0.05);
    }
}
