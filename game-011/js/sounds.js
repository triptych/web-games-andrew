/**
 * sounds.js — Web Audio API procedural sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture (click / key press).
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

// Music
let _musicSource = null;
let _musicGain   = null;

export function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(audioCtx.destination);
}

/**
 * Load and loop a music track from a URL.
 * Safe to call multiple times — stops any currently playing track first.
 */
export function playMusic(url, volume = 0.5) {
    if (!audioCtx) return;
    stopMusic();
    fetch(url)
        .then(r => r.arrayBuffer())
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => {
            if (!audioCtx) return; // context may have been torn down
            _musicGain = audioCtx.createGain();
            _musicGain.gain.value = volume;
            _musicGain.connect(audioCtx.destination);

            _musicSource = audioCtx.createBufferSource();
            _musicSource.buffer = decoded;
            _musicSource.loop   = true;
            _musicSource.connect(_musicGain);
            _musicSource.start(0);
        })
        .catch(err => console.warn('playMusic failed:', err));
}

export function stopMusic() {
    if (_musicSource) {
        try { _musicSource.stop(); } catch (_) { /* already stopped */ }
        _musicSource = null;
    }
    _musicGain = null;
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

/** Short click when the player fills/clears a nonogram cell */
export function playCellClick() {
    _osc('sine', 440, 0.05, 0.12);
}

/** Soft "ping" when the nonogram clue is satisfied */
export function playClueSatisfied() {
    _osc('sine', 660, 0.1, 0.18);
    _osc('sine', 880, 0.08, 0.14, 0.06);
}

/** Torpedo launch — low thud + short sweep */
export function playFire() {
    _sweep('sawtooth', 180, 60, 0.15, 0.35);
    _noise(0.08, 0.1);
}

/** Hit — explosion crack */
export function playHit() {
    _noise(0.25, 0.35);
    _sweep('square', 300, 60, 0.2, 0.2, 0.05);
}

/** Miss — hollow splash */
export function playMiss() {
    _sweep('sine', 300, 180, 0.2, 0.15);
    _osc('sine', 220, 0.15, 0.08, 0.1);
}

/** Ship sunk — triumphant ascending notes */
export function playShipSunk() {
    const notes = [330, 415, 494, 659];
    notes.forEach((f, i) => _osc('triangle', f, 0.18, 0.25, i * 0.09));
}

/** Level complete — fanfare */
export function playLevelComplete() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.14, 0.28, i * 0.07));
}

/** Puzzle failed — descending gloom */
export function playPuzzleFailed() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

export function playGameOver() {
    _sweep('sawtooth', 350, 40, 1.0, 0.4);
    _noise(0.6, 0.15, 0.25);
}
