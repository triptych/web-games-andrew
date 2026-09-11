/**
 * sounds.js — Web Audio API procedural sound effects + ambience.
 * Call initAudio() on the first user gesture (Pointer Lock request).
 */

let audioCtx = null;
let masterGain = null;
let ambienceNodes = null;
let birdTimer = null;
let _enabled = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
    _startAmbience();
}

export function setSoundEnabled(v) {
    _enabled = v;
    if (!audioCtx) return;
    if (v) {
        _scheduleBirdsong();
    } else if (birdTimer !== null) {
        clearTimeout(birdTimer);
        birdTimer = null;
    }
}

export function toggleSound() {
    setSoundEnabled(!_enabled);
    return _enabled;
}

function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

function _noiseBuffer(duration) {
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    return buf;
}

function _startAmbience() {
    // Wind: filtered looping noise, very quiet
    const src = audioCtx.createBufferSource();
    src.buffer = _noiseBuffer(4);
    src.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start();
    ambienceNodes = { src, filter, gain };

    _scheduleBirdsong();
}

/**
 * A single bird note: a short sine that glides in pitch. Real bird notes sweep
 * rather than hold a pitch, which is what keeps this from reading as a UI chime.
 * `bend` is the ratio of end frequency to start frequency (>1 rises, <1 falls).
 */
function _birdNote(freq, bend, duration, vol, startDelay) {
    if (!_enabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startDelay;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * bend, t + duration);
    // Soft attack + decay: an instant onset is what makes a sine read as "beep".
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

/**
 * Song shapes, each a sequence of notes described relative to a randomized base
 * pitch so no two calls are identical. [pitchMul, bend, duration, volMul, gap]
 * where `gap` is the delay before the note relative to the phrase start.
 */
const BIRD_PHRASES = [
    // Two-note falling "tee-loo" — a chickadee-ish call.
    [[1.0, 0.94, 0.10, 1.0, 0.00], [0.74, 0.90, 0.14, 0.85, 0.13]],
    // Rising triple trill.
    [[1.0, 1.12, 0.07, 0.9, 0.00], [1.1, 1.12, 0.07, 0.95, 0.09],
     [1.22, 1.15, 0.10, 1.0, 0.18]],
    // Quick warble that dips then lifts.
    [[1.0, 1.18, 0.06, 0.85, 0.00], [1.15, 0.82, 0.09, 1.0, 0.07],
     [0.95, 1.10, 0.07, 0.8, 0.18], [1.08, 0.88, 0.11, 0.7, 0.26]],
    // Single long descending whistle — the distant, lonely one.
    [[1.0, 0.72, 0.28, 0.95, 0.00]],
    // Chattery four-note run, evenly spaced.
    [[1.0, 1.05, 0.05, 0.8, 0.00], [1.06, 1.05, 0.05, 0.85, 0.07],
     [1.12, 1.05, 0.05, 0.8, 0.14], [1.04, 0.92, 0.08, 0.7, 0.21]],
];

function _playBirdPhrase() {
    if (!_enabled || !audioCtx) return;
    const phrase = BIRD_PHRASES[Math.floor(Math.random() * BIRD_PHRASES.length)];
    // Lower and narrower than the old 1400-2200Hz range: less piercing, more distant.
    const base = 900 + Math.random() * 700;
    // Distance varies per call so the flock feels spread across the island.
    const distance = 0.5 + Math.random() * 0.5;
    for (const [pitchMul, bend, duration, volMul, gap] of phrase) {
        _birdNote(base * pitchMul, bend, duration, 0.035 * volMul * distance, gap);
    }
}

function _scheduleBirdsong() {
    if (birdTimer !== null) clearTimeout(birdTimer);
    birdTimer = setTimeout(() => {
        _playBirdPhrase();
        // Occasionally a second bird answers the first, close behind.
        if (Math.random() < 0.3) {
            setTimeout(_playBirdPhrase, 400 + Math.random() * 500);
        }
        _scheduleBirdsong();
    }, 4000 + Math.random() * 9000);
}

export function playPickupBook() {
    _osc('sine', 660, 0.09, 0.2);
    _osc('sine', 880, 0.12, 0.16, 0.06);
}

export function playPickupArtifact() {
    _osc('triangle', 520, 0.1, 0.22);
    _osc('triangle', 780, 0.14, 0.18, 0.07);
    _osc('triangle', 1040, 0.16, 0.14, 0.14);
}

export function playFootstep() {
    if (!_enabled || !audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = _noiseBuffer(0.06);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.06;
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start();
}

/** Warm chord for shelving a book / placing an artifact — the "this counted" cue. */
export function playDeposit() {
    _osc('sine', 392, 0.22, 0.16);
    _osc('sine', 523, 0.26, 0.14, 0.05);
    _osc('sine', 659, 0.3, 0.12, 0.1);
}

export function playComplete() {
    const notes = [523, 659, 784, 1047, 1318];
    notes.forEach((f, i) => _osc('sine', f, 0.2, 0.22, i * 0.1));
}

export function playUiClick() {
    _osc('sine', 660, 0.05, 0.12);
}
