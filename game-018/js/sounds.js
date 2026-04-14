/**
 * sounds.js — Web Audio API procedural sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture.
 */

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

/** Short sword swing */
export function playSwordSwing() {
    _sweep('sawtooth', 280, 80, 0.08, 0.25);
    _sweep('square',   600, 200, 0.06, 0.12, 0.02);
}

/** Monster hit (thud) */
export function playMonsterHit() {
    _sweep('square', 160, 60, 0.1, 0.3);
    _noise(0.07, 0.15);
}

/** Monster dies */
export function playMonsterDie() {
    _sweep('sawtooth', 300, 40, 0.35, 0.3);
    _noise(0.25, 0.12, 0.05);
}

/** Player takes damage */
export function playPlayerHurt() {
    _sweep('square', 440, 110, 0.18, 0.35);
    _noise(0.12, 0.2, 0.02);
}

/** Pick up resource */
export function playPickup() {
    _osc('sine', 660, 0.07, 0.2);
    _osc('sine', 880, 0.09, 0.15, 0.06);
}

/** Gold pickup */
export function playGoldPickup() {
    _osc('sine',  880, 0.06, 0.2);
    _osc('sine', 1100, 0.07, 0.12, 0.05);
    _osc('sine', 1320, 0.08, 0.1,  0.09);
}

/** Building constructed */
export function playBuild() {
    const notes = [330, 440, 550, 660];
    notes.forEach((f, i) => _osc('triangle', f, 0.12, 0.25, i * 0.07));
}

/** Level up fanfare */
export function playLevelUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.18, 0.28, i * 0.1));
}

/** UI click */
export function playUiClick() {
    _osc('sine', 660, 0.05, 0.15);
}

/** Game over */
export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.9, 0.4);
    _noise(0.6, 0.15, 0.2);
}

/** Footstep (very quiet) */
export function playFootstep() {
    _noise(0.04, 0.04);
}

/** Axe swing (heavier, slower) */
export function playAxeSwing() {
    _sweep('sawtooth', 180, 50, 0.14, 0.35);
    _noise(0.1, 0.2);
}

/** Bow shot */
export function playBowShot() {
    _sweep('sine', 400, 800, 0.04, 0.15);
    _sweep('sawtooth', 800, 200, 0.12, 0.1, 0.03);
}

/** Heal / tavern rest */
export function playHeal() {
    _osc('sine',  528, 0.15, 0.2);
    _osc('sine',  660, 0.15, 0.15, 0.08);
    _osc('sine',  792, 0.12, 0.12, 0.15);
}

/**
 * Monster grunt on hit.
 * scale controls pitch — bigger monsters = lower grunt.
 */
export function playMonsterGrunt(scale = 1) {
    if (!_enabled || !audioCtx) return;
    // Pitch inversely proportional to size
    const baseFreq = 280 / Math.max(0.5, scale);
    // Pick one of three grunt shapes at random so repeated hits vary
    const roll = Math.random();
    if (roll < 0.33) {
        // Short low growl — downward sweep
        _sweep('sawtooth', baseFreq * 1.1, baseFreq * 0.55, 0.13, 0.22);
        _noise(0.09, 0.10, 0.02);
    } else if (roll < 0.66) {
        // Mid grunt — quick noise burst with tone
        _osc('square', baseFreq * 0.9, 0.10, 0.18);
        _noise(0.12, 0.12, 0.01);
    } else {
        // High yelp for smaller monsters
        _sweep('triangle', baseFreq * 1.4, baseFreq * 0.7, 0.09, 0.20);
    }
}

// ---- Ambient soundscape ----

let _ambientHandle = null;  // ScriptProcessorNode or null

/**
 * Start a looping ambient forest soundscape (wind + crickets).
 * Safe to call multiple times — only starts once.
 */
export function startAmbient() {
    if (!_enabled || !audioCtx || _ambientHandle) return;

    const ambGain = audioCtx.createGain();
    ambGain.gain.value = 0.06;
    ambGain.connect(audioCtx.destination);

    // --- Wind: filtered noise, slowly LFO-modulated ---
    function _windBurst() {
        if (!audioCtx) return;
        const bufSize = Math.floor(audioCtx.sampleRate * 2.5);
        const buf     = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data    = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

        const src    = audioCtx.createBufferSource();
        src.buffer   = buf;
        src.loop     = false;

        const lpf    = audioCtx.createBiquadFilter();
        lpf.type     = 'lowpass';
        lpf.frequency.value = 400 + Math.random() * 200;
        lpf.Q.value  = 0.5;

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.55 + Math.random() * 0.3, audioCtx.currentTime + 0.8);
        g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5);

        src.connect(lpf);
        lpf.connect(g);
        g.connect(ambGain);
        src.start();

        // Schedule the next burst at a random interval
        const delay = 3 + Math.random() * 5;
        _ambientHandle = setTimeout(_windBurst, delay * 1000);
    }
    _windBurst();

    // --- Crickets: short high sine chirps ---
    function _cricket() {
        if (!audioCtx) return;
        const chirps = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < chirps; i++) {
            const freq = 3200 + Math.random() * 800;
            _osc('sine', freq, 0.04, 0.04, i * 0.06);
        }
        const nextDelay = 1.5 + Math.random() * 3.5;
        setTimeout(_cricket, nextDelay * 1000);
    }
    // Crickets mostly at night — start slightly delayed so wind goes first
    setTimeout(_cricket, 1200);
}

/** Stop ambient sounds (clears the wind timeout chain). */
export function stopAmbient() {
    if (_ambientHandle) { clearTimeout(_ambientHandle); _ambientHandle = null; }
}

// ---- Dungeon ambient soundscape ----

let _dungeonDripHandle  = null;
let _dungeonGrumbleHandle = null;

/**
 * Start dungeon ambient: stone drips + low rumbles.
 * Stops the overworld ambient first.
 */
export function startDungeonAmbient() {
    stopAmbient();
    if (!_enabled || !audioCtx) return;

    // --- Drips: short high pluck tones ---
    function _drip() {
        if (!audioCtx) return;
        const freq = 800 + Math.random() * 600;
        _sweep('sine', freq, freq * 0.5, 0.18, 0.12);
        _noise(0.06, 0.06, 0.01);
        _dungeonDripHandle = setTimeout(_drip, 1200 + Math.random() * 3000);
    }
    _drip();

    // --- Deep rumbles: very low filtered noise ---
    function _rumble() {
        if (!audioCtx) return;
        const bufSize = Math.floor(audioCtx.sampleRate * 1.2);
        const buf     = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data    = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

        const src = audioCtx.createBufferSource();
        src.buffer = buf;

        const hpf = audioCtx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 20;

        const lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 80 + Math.random() * 60;

        const g = audioCtx.createGain();
        const t = audioCtx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.4);
        g.gain.linearRampToValueAtTime(0, t + 1.2);

        src.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(audioCtx.destination);
        src.start();

        _dungeonGrumbleHandle = setTimeout(_rumble, 4000 + Math.random() * 8000);
    }
    setTimeout(_rumble, 800);
}

/** Stop dungeon ambient and restart overworld ambient. */
export function stopDungeonAmbient() {
    if (_dungeonDripHandle)    { clearTimeout(_dungeonDripHandle);    _dungeonDripHandle    = null; }
    if (_dungeonGrumbleHandle) { clearTimeout(_dungeonGrumbleHandle); _dungeonGrumbleHandle = null; }
    // Resume forest sounds
    startAmbient();
}
