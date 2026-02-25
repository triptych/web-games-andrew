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
    _osc('sine', 660, 0.06, 0.15);
}

export function playPlace() {
    // Soft "thud" — building placed on grid
    _osc('sine', 440, 0.08, 0.2);
    _osc('sine', 550, 0.06, 0.15, 0.05);
}

export function playPlaceRoad() {
    _osc('triangle', 300, 0.07, 0.18);
}

export function playPlacePark() {
    // Cheerful little chime
    _osc('sine', 880, 0.1, 0.18);
    _osc('sine', 1100, 0.08, 0.12, 0.06);
}

export function playClear() {
    _sweep('sawtooth', 300, 150, 0.12, 0.2);
}

export function playNoGold() {
    // Low buzz — can't afford it
    _sweep('square', 200, 160, 0.18, 0.25);
}

export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

// ---- Ambient background music ----
// Cozy I–V–vi–IV loop in C major, mid-register (C4 = 261 Hz).
// Each chord is a root + major/minor third + fifth, one octave up doubles it softly.
// Sine + triangle blend for warmth; gentle volume, slow crossfade.

const AMBIENT_CHORDS = [
    [261.6, 329.6, 392.0, 523.3],          // C4 major  (I)
    [392.0, 493.9, 587.3, 784.0],          // G4 major  (V)
    [220.0, 261.6, 329.6, 440.0],          // A3 minor  (vi)  — one octave lower keeps it warm
    [349.2, 440.0, 523.3, 698.5],          // F4 major  (IV)
];
const CHORD_DURATION   = 4;    // seconds per chord — livelier than 6
const CHORD_FADE       = 1.4;  // seconds to fade in/out (long crossfade = smooth)

// ---- Tinkly melody phrases (C5 = 523.3 Hz range) ----
// One phrase per chord: short descending/ascending arpeggios, gentle bell-like tones.
// Each entry: array of [freq, delay, duration] relative to the chord's start.
const MELODY_PHRASES = [
    // I  (C major): C6 → E5 → G5 → C6
    [[1046.5, 0.2, 0.18], [659.3, 0.45, 0.16], [784.0, 0.7, 0.16], [1046.5, 1.05, 0.22]],
    // V  (G major): D6 → B5 → G5 → D6
    [[1174.7, 0.15, 0.18], [987.8, 0.4, 0.16], [784.0, 0.65, 0.16], [1174.7, 1.1, 0.20]],
    // vi (A minor): A5 → C6 → E5 → A5
    [[880.0, 0.25, 0.18], [1046.5, 0.5, 0.16], [659.3, 0.78, 0.16], [880.0, 1.1, 0.22]],
    // IV (F major): C6 → A5 → F5 → C6
    [[1046.5, 0.2, 0.18], [880.0, 0.45, 0.16], [698.5, 0.7, 0.16], [1046.5, 1.05, 0.22]],
];

function _playMelodyPhrase(phrase) {
    if (!_enabled || !audioCtx) return;
    const baseT = audioCtx.currentTime;
    for (const [freq, delay, dur] of phrase) {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t    = baseT + delay;
        osc.type            = 'sine';
        osc.frequency.value = freq;
        // Sharp attack, quick bell-like decay
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.055, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        _ambientNodes.push(osc);
    }
}

const MUSIC_PREF_KEY = 'tinyTown_music';

function _loadMusicPref() {
    const val = localStorage.getItem(MUSIC_PREF_KEY);
    return val === null ? true : val === '1';
}

function _saveMusicPref(enabled) {
    localStorage.setItem(MUSIC_PREF_KEY, enabled ? '1' : '0');
}

let _ambientNodes  = [];
let _ambientTimer  = null;
let _ambientActive = false;
let _chordIndex    = 0;

function _playAmbientChord(notes) {
    if (!_enabled || !audioCtx) return;
    const t = audioCtx.currentTime;

    for (const freq of notes) {
        // Each note = one sine (pure) + one triangle (warm overtones), slightly detuned
        const layers = [
            { type: 'sine',     detune: -4, vol: 0.035 },
            { type: 'triangle', detune:  4, vol: 0.022 },
        ];
        for (const { type, detune, vol } of layers) {
            const osc  = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type            = type;
            osc.frequency.value = freq;
            osc.detune.value    = detune;

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(vol, t + CHORD_FADE);
            gain.gain.setValueAtTime(vol, t + CHORD_DURATION - CHORD_FADE);
            gain.gain.linearRampToValueAtTime(0, t + CHORD_DURATION);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(t);
            osc.stop(t + CHORD_DURATION + 0.05);
            _ambientNodes.push(osc);
        }
    }
}

function _scheduleNextChord() {
    if (!_ambientActive) return;
    const idx = _chordIndex;
    _playAmbientChord(AMBIENT_CHORDS[idx]);
    _playMelodyPhrase(MELODY_PHRASES[idx]);
    _chordIndex = (idx + 1) % AMBIENT_CHORDS.length;
    // Overlap next chord slightly before this one ends
    _ambientTimer = setTimeout(_scheduleNextChord, (CHORD_DURATION - CHORD_FADE * 0.5) * 1000);
}

export function isMusicEnabled() { return _loadMusicPref(); }

export function startAmbient() {
    if (_ambientActive) return;
    if (!audioCtx) return;
    if (!_loadMusicPref()) return;
    _ambientActive = true;
    _chordIndex    = 0;
    _scheduleNextChord();
}

export function stopAmbient() {
    _ambientActive = false;
    clearTimeout(_ambientTimer);
    _ambientTimer = null;
    for (const node of _ambientNodes) {
        try { node.stop(); } catch (_) {}
    }
    _ambientNodes = [];
}

export function toggleAmbient() {
    if (_ambientActive) {
        stopAmbient();
        _saveMusicPref(false);
        return false;
    }
    _saveMusicPref(true);
    startAmbient();
    return true;
}
