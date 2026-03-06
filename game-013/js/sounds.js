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

// --- Sound effects ---

export function playUiClick() {
    _osc('sine', 520, 0.06, 0.12);
}

/** Soft chime when planting a seed */
export function playPlant() {
    _osc('sine', 440, 0.1, 0.15);
    _osc('sine', 660, 0.12, 0.1, 0.05);
}

/** Gentle sparkle when a flower finishes growing */
export function playBloom() {
    const notes = [523, 659, 784, 988];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.18, i * 0.07));
}

/** Coin-drop sound on harvest / sale */
export function playHarvest() {
    _osc('triangle', 880, 0.08, 0.25);
    _osc('triangle', 1100, 0.1, 0.2, 0.06);
    _osc('triangle', 1320, 0.12, 0.15, 0.12);
}

/** Soft click when buying from the shop */
export function playBuy() {
    _sweep('sine', 300, 500, 0.1, 0.2);
}

/** Gentle error tone when you can't afford something */
export function playNoGold() {
    _sweep('sine', 300, 200, 0.15, 0.2);
}

/** Day-end soft chime */
export function playDayEnd() {
    const notes = [392, 494, 587, 740];
    notes.forEach((f, i) => _osc('sine', f, 0.25, 0.15, i * 0.1));
}

// ============================================================
// Ambient background music loop (gentle arpeggiated chords)
// ============================================================

let _ambientNodes = [];   // oscillators & gains kept for mute/stop
let _ambientRunning = false;

// Pentatonic-ish chord tones (A minor pentatonic + octave)
const AMBIENT_NOTES = [220, 261.6, 329.6, 392, 440, 523.3, 659.3, 784];

function _scheduleAmbientNote(freq, startTime, duration, vol) {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
    gain.gain.setValueAtTime(vol, startTime + duration - 0.15);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    _ambientNodes.push(osc, gain);
}

// Each "measure" is ~4 s; we schedule 2 measures ahead then recurse
function _scheduleAmbientMeasure(startTime) {
    if (!_ambientRunning || !audioCtx) return;
    const noteGap  = 0.55;     // seconds between notes
    const duration = 1.2;
    // Pick a random 4-note ascending pattern from the scale
    const pick = () => AMBIENT_NOTES[Math.floor(Math.random() * AMBIENT_NOTES.length)];
    const pattern = [pick(), pick(), pick(), pick()].sort((a, b) => a - b);
    pattern.forEach((freq, i) => {
        _scheduleAmbientNote(freq, startTime + i * noteGap, duration, 0.04);
    });
    // Also a low drone on the root
    _scheduleAmbientNote(110, startTime, noteGap * 4 + 0.1, 0.025);

    const measureLen = noteGap * 4 + 0.4;
    const nextStart  = startTime + measureLen;
    // Schedule the next measure slightly before it's needed
    const delay = (nextStart - audioCtx.currentTime - 0.3) * 1000;
    setTimeout(() => _scheduleAmbientMeasure(nextStart), Math.max(0, delay));
}

export function startAmbientMusic() {
    if (_ambientRunning || !audioCtx) return;
    _ambientRunning = true;
    _scheduleAmbientMeasure(audioCtx.currentTime + 0.1);
}

export function stopAmbientMusic() {
    _ambientRunning = false;
    _ambientNodes.forEach(n => { try { n.stop(0); } catch(_) {} });
    _ambientNodes = [];
}

export function isAmbientPlaying() { return _ambientRunning; }
