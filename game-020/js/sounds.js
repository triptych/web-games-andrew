/**
 * sounds.js — Web Audio API procedural sound effects for The River.
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

// Gentle lap of water — played when advancing the river
export function playRiverMove() {
    _sweep('sine', 220, 180, 0.4, 0.18);
    _osc('sine', 440, 0.2, 0.08, 0.1);
}

// Warm chord — companion joins the boat
export function playCompanionJoin() {
    const notes = [392, 494, 587];
    notes.forEach((f, i) => _osc('sine', f, 0.4, 0.18, i * 0.07));
}

// Soft disappointed murmur — traveler was passed by
export function playCompanionDecline() {
    _sweep('sine', 330, 220, 0.3, 0.12);
}

// Sparkle — ingredient collected
export function playPickup() {
    _osc('sine', 880, 0.08, 0.2);
    _osc('sine', 1100, 0.1, 0.15, 0.07);
}

// Ominous bell — dark tower news received
export function playNewsAlert() {
    _osc('sine', 200, 1.2, 0.3);
    _osc('sine', 202, 1.0, 0.2, 0.05);  // slight detune for reverb effect
}

// Fanfare — great dinner outcome
export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.2, 0.25, i * 0.1));
}

// Sad trombone slide — poor dinner outcome
export function playFailure() {
    _sweep('sawtooth', 400, 80, 0.5, 0.3);
    _noise(0.3, 0.1, 0.1);
}

export function playGameOver() {
    _sweep('sawtooth', 350, 40, 0.9, 0.35);
    _noise(0.6, 0.15, 0.2);
}

// --- Ambient drone music ---

let _droneNodes = [];
let _droneRunning = false;

// Procedural ambient river drone: layered sine oscillators, slowly modulating
export function startAmbientDrone() {
    if (!_enabled || !audioCtx || _droneRunning) return;
    _droneRunning = true;

    // Base drone: two slightly detuned low sines for warmth
    const drone1 = audioCtx.createOscillator();
    const drone2 = audioCtx.createOscillator();
    const droneGain = audioCtx.createGain();
    drone1.type = 'sine';
    drone2.type = 'sine';
    drone1.frequency.value = 55;   // A1
    drone2.frequency.value = 56.2; // slight detune
    droneGain.gain.setValueAtTime(0, audioCtx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 3);
    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(masterGain);
    drone1.start();
    drone2.start();

    // Mid tone: a fifth above (A2 + E3 area), very soft
    const mid = audioCtx.createOscillator();
    const midGain = audioCtx.createGain();
    mid.type = 'sine';
    mid.frequency.value = 110;  // A2
    midGain.gain.setValueAtTime(0, audioCtx.currentTime);
    midGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 5);
    mid.connect(midGain);
    midGain.connect(masterGain);
    mid.start();

    // High shimmer: slow LFO on a high-pitched sine
    const shimmer = audioCtx.createOscillator();
    const lfo     = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const shimGain = audioCtx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 440; // A4
    lfo.type = 'sine';
    lfo.frequency.value = 0.07; // very slow modulation
    lfoGain.gain.value = 8;     // modulation depth
    shimGain.gain.setValueAtTime(0, audioCtx.currentTime);
    shimGain.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 8);
    lfo.connect(lfoGain);
    lfoGain.connect(shimmer.frequency);
    shimmer.connect(shimGain);
    shimGain.connect(masterGain);
    lfo.start();
    shimmer.start();

    _droneNodes = [drone1, drone2, mid, lfo, shimmer];
}

export function stopAmbientDrone() {
    if (!_droneRunning) return;
    _droneRunning = false;
    const t = audioCtx ? audioCtx.currentTime : 0;
    _droneNodes.forEach(node => {
        try {
            if (node.gain) node.gain.linearRampToValueAtTime(0, t + 2);
            node.stop(t + 2.1);
        } catch (e) { /* already stopped */ }
    });
    _droneNodes = [];
}
