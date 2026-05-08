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

export function setSoundEnabled(v) { _enabled = v; }

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

export function playShoot() {
    _sweep('square', 800, 200, 0.12, 0.18);
}

export function playInvaderHit() {
    _sweep('sawtooth', 600, 100, 0.18, 0.25);
    _noise(0.12, 0.12, 0.02);
}

export function playPlayerHit() {
    _sweep('sawtooth', 300, 40, 0.55, 0.35);
    _noise(0.4, 0.18, 0.05);
}

export function playExplosion() {
    _noise(0.5, 0.3);
    _sweep('sawtooth', 200, 30, 0.6, 0.2, 0.05);
}

export function playGameOver() {
    const notes = [440, 330, 220, 110];
    notes.forEach((f, i) => _osc('sawtooth', f, 0.3, 0.25, i * 0.22));
}

export function playWaveClear() {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => _osc('sine', f, 0.2, 0.2, i * 0.1));
}

export function playMarchTick(step) {
    const freqs = [160, 120];
    _osc('square', freqs[step % 2], 0.05, 0.08);
}

export function playUFOHit() {
    _sweep('sine', 1200, 300, 0.25, 0.35);
    _osc('square', 600, 0.15, 0.2, 0.05);
}

export function playShieldHit() {
    _noise(0.06, 0.12);
    _sweep('square', 400, 200, 0.06, 0.1, 0.01);
}

export function playBossHit() {
    _sweep('sawtooth', 900, 200, 0.25, 0.4);
    _noise(0.15, 0.2, 0.02);
}

export function playBossAppear() {
    const notes = [220, 330, 440, 330, 220, 165];
    notes.forEach((f, i) => _osc('sawtooth', f, 0.18, 0.3, i * 0.12));
}
