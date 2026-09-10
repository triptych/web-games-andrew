/**
 * sounds.js — Web Audio API procedural sound effects + ambience.
 * Call initAudio() on the first user gesture (Pointer Lock request).
 */

let audioCtx = null;
let masterGain = null;
let ambienceNodes = null;
let _enabled = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
    _startAmbience();
}

export function setSoundEnabled(v) { _enabled = v; }
export function toggleSound() { _enabled = !_enabled; return _enabled; }

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

    // Occasional distant bird chirp
    function chirpLoop() {
        if (_enabled && audioCtx) {
            const base = 1400 + Math.random() * 800;
            _osc('sine', base, 0.09, 0.04);
            _osc('sine', base * 1.3, 0.07, 0.03, 0.08);
        }
        setTimeout(chirpLoop, 3000 + Math.random() * 6000);
    }
    setTimeout(chirpLoop, 2000);
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
