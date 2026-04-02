/**
 * sounds.js — Web Audio API sounds for Pixel Picross.
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

/** Short click when filling a cell */
export function playFill() {
    _osc('square', 880, 0.05, 0.15);
}

/** Softer tick when marking a cell with X */
export function playMark() {
    _osc('sine', 440, 0.06, 0.1);
}

/** Rising arpeggio on puzzle solved */
export function playWin() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.25, i * 0.09));
}

/** Short UI blip */
export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

/** Grand fanfare when all puzzles complete */
export function playAllComplete() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => _osc('sine', f, 0.2, 0.28, i * 0.1));
    _sweep('sawtooth', 200, 100, 0.8, 0.08, 0.5);
}
