/**
 * sounds.js — Web Audio API procedural sound effects.
 * Requires a prior user gesture (browser autoplay policy) — call initAudio() on first click/key.
 */

import { state } from './state.js';

let audioCtx = null;
let masterGain = null;

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(audioCtx.destination);
}

function enabled() { return audioCtx && !state.muted; }

function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!enabled()) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function _sweep(type, freqStart, freqEnd, duration, vol = 0.3, startDelay = 0) {
    if (!enabled()) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startDelay;
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
    if (!enabled()) return;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain);
    gain.connect(masterGain);
    src.start(t);
}

export function playHit(dmg = 10) {
    const pitch = 260 + Math.min(200, dmg * 4);
    _sweep('square', pitch, pitch * 0.5, 0.09, 0.18);
}

export function playCrit() {
    _sweep('square', 520, 200, 0.14, 0.28);
    _noise(0.08, 0.12);
}

export function playMonsterDeath() {
    _sweep('sawtooth', 300, 60, 0.3, 0.22);
    _noise(0.2, 0.08, 0.05);
}

export function playHeroDown() {
    _sweep('sawtooth', 250, 40, 0.5, 0.25);
}

export function playPartyWipe() {
    _sweep('sawtooth', 300, 30, 0.9, 0.3);
    _noise(0.5, 0.12, 0.15);
}

export function playGoldPickup() {
    _osc('sine', 880, 0.08, 0.18);
    _osc('sine', 1100, 0.1, 0.14, 0.06);
}

export function playRoomClear() {
    [523, 659, 784].forEach((f, i) => _osc('sine', f, 0.14, 0.18, i * 0.07));
}

export function playFloorAdvance() {
    [523, 659, 784, 1047].forEach((f, i) => _osc('sine', f, 0.18, 0.2, i * 0.06));
}

export function playUiClick() {
    _osc('sine', 660, 0.05, 0.14);
}

export function playUpgradeBuy() {
    _osc('sine', 660, 0.08, 0.2);
    _osc('sine', 990, 0.12, 0.18, 0.07);
}
