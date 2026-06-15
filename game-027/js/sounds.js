/**
 * sounds.js — Web Audio procedural SFX (game-plan §Sound Design).
 * Warm apothecary palette. No file assets. Call initAudio() on first gesture.
 *
 * Phase 1 sounds: click, pickup, place, invalid, line clear, combo, set dealt,
 * jammed.
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

// --- helpers ---
function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

function _sweep(type, f0, f1, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

function _noise(duration, vol = 0.15, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain); gain.connect(masterGain);
    src.start(t);
}

// --- effects ---

/** UI click — short sine blip */
export function playUiClick()   { _osc('sine', 620, 0.06, 0.14); }

/** Pick up a shape — soft pluck */
export function playPickup()    { _osc('triangle', 440, 0.08, 0.16); _osc('sine', 660, 0.05, 0.08, 0.01); }

/** Place valid — wooden tick + tiny thud */
export function playPlace() {
    _osc('square', 200, 0.05, 0.12);
    _osc('sine', 130, 0.07, 0.18, 0.01);
    _noise(0.03, 0.05);
}

/** Invalid release — dull buzz */
export function playInvalid()   { _osc('sawtooth', 110, 0.12, 0.18); }

/**
 * Line clear — rising glassy arpeggio; pitch climbs with simultaneous lines.
 * @param {number} lines — number of lines cleared this placement.
 */
export function playLineClear(lines = 1) {
    const base = 520 + (lines - 1) * 120;
    const notes = [base, base * 1.25, base * 1.5];
    notes.forEach((f, i) => _osc('sine', f, 0.16, 0.18, i * 0.05));
}

/** Combo — shimmer + higher chime for multi-line clears */
export function playCombo(lines = 2) {
    _sweep('sine', 900, 1500 + lines * 80, 0.18, 0.2);
    _osc('triangle', 1800, 0.14, 0.16, 0.1);
}

/** Set dealt — soft triple shuffle/clack */
export function playSetDealt() {
    for (let i = 0; i < 3; i++) _noise(0.04, 0.06, i * 0.05);
    _osc('sine', 380, 0.05, 0.08, 0.04);
}

/** Jammed — low descending sawtooth (§Failure 1) */
export function playJammed() {
    _sweep('sawtooth', 360, 50, 0.7, 0.35);
    _noise(0.4, 0.1, 0.1);
}
