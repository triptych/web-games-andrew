/**
 * SoundManager — procedural WebAudio sound effects.
 * All sounds generated via oscillators; no audio files needed.
 */

let ctx = null;
let masterGain = null;
let engineOsc = null, engineGain = null;
let fuelAlarmTimer = 0, hullAlarmTimer = 0;
let _enabled = true;
let _ambientOsc = null, _ambientGain = null;
let _currentTier = -1;

export function initAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);

    // Start engine hum
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(masterGain);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sine';
    engineOsc.frequency.value = 60;
    engineOsc.connect(engineGain);
    engineOsc.start();
}

export function setEnabled(v) { _enabled = v; }
export function isEnabled() { return _enabled; }
export function toggleSound() { _enabled = !_enabled; masterGain && (masterGain.gain.value = _enabled ? 0.3 : 0); return _enabled; }

function _osc(type, freq, dur, vol = 0.3, delay = 0) {
    if (!_enabled || !ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const t    = ctx.currentTime + delay;
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.01);
}

function _sweep(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!_enabled || !ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const t    = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.01);
}

function _noise(dur, vol = 0.15, freqLow = 200, freqHigh = 2000) {
    if (!_enabled || !ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filt.type = 'bandpass';
    filt.frequency.value = (freqLow + freqHigh) / 2;
    filt.Q.value = 0.5;
    src.buffer = buf;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(gain); gain.connect(masterGain);
    src.start(); src.stop(t + dur + 0.01);
}

// --- Public sounds ---

export function playDrill(hardness) {
    const baseFreq = 80 + hardness * 20;
    _sweep('sawtooth', baseFreq, baseFreq * 2.5, 0.12 + hardness * 0.02, 0.2);
    _noise(0.05, 0.08);
}

export function setEngineHum(isMoving, speed = 1.0) {
    if (!engineGain) return;
    const target = (isMoving && _enabled) ? 0.12 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    if (engineOsc) engineOsc.frequency.setTargetAtTime(60 + speed * 30, ctx.currentTime, 0.2);
}

export function playOreCollect(tierIndex = 0) {
    const base = 220 * (1 + tierIndex * 0.15);
    _osc('triangle', base,        0.1, 0.2);
    _osc('triangle', base * 1.25, 0.1, 0.15, 0.07);
    _osc('triangle', base * 1.5,  0.1, 0.1,  0.14);
}

export function playHullDamage(severity = 1) {
    _noise(0.15, 0.15 * severity);
    _sweep('square', 400, 80, 0.2, 0.15 * severity);
}

export function playLavaHiss() {
    _noise(0.3, 0.08, 100, 600);
}

export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

export function playUpgrade() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playBaseArrival() {
    _osc('sine', 523, 0.2, 0.3);
    _osc('sine', 659, 0.2, 0.25, 0.12);
    _osc('sine', 784, 0.25, 0.2, 0.24);
}

export function playTeleport() {
    _sweep('sine', 200, 2000, 0.3, 0.3);
}

export function playCaveIn() {
    _noise(0.3, 0.3, 80, 500);
    _osc('sawtooth', 120, 0.2, 0.2, 0.05);
}

export function playSingingVein() {
    // Ethereal discovery sound
    const freqs = [220, 277, 330, 440, 554, 659];
    freqs.forEach((f, i) => {
        _osc('sine', f, 1.0, 0.15, i * 0.15);
        _osc('sine', f * 2, 0.8, 0.08, i * 0.15 + 0.05);
    });
}

// --- Alarm ticking (call each frame with delta in ms) ---

export function tickAlarms(delta, lowFuel, hullCritical) {
    if (!_enabled || !ctx) return;
    fuelAlarmTimer += delta;
    hullAlarmTimer += delta;

    if (lowFuel && fuelAlarmTimer > 1000) {
        fuelAlarmTimer = 0;
        _osc('square', 880, 0.15, 0.1);
    }
    if (hullCritical && hullAlarmTimer > 400) {
        hullAlarmTimer = 0;
        _osc('square', 1200, 0.08, 0.1);
    }
}

// --- Ambient music per tier ---
export function setAmbientTier(tierIdx) {
    if (!_enabled || !ctx || tierIdx === _currentTier) return;
    _currentTier = tierIdx;

    if (_ambientOsc) {
        _ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => { try { _ambientOsc.stop(); } catch(_) {} }, 1000);
    }

    const tierFreqs = [55, 46, 41, 36, 32, 29, 24];
    const freq = tierFreqs[Math.min(tierIdx, tierFreqs.length - 1)];

    _ambientGain = ctx.createGain();
    _ambientGain.gain.value = 0;
    _ambientGain.connect(masterGain);

    _ambientOsc = ctx.createOscillator();
    _ambientOsc.type = 'sine';
    _ambientOsc.frequency.value = freq;
    _ambientOsc.connect(_ambientGain);
    _ambientOsc.start();

    _ambientGain.gain.setTargetAtTime(0.06, ctx.currentTime, 1.0);
}
