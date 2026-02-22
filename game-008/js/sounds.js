/**
 * sounds.js — Web Audio API procedural sound effects.
 *
 * All sounds require the user to interact with the page first (browser policy).
 * Call initAudio() on the first user interaction (button click / key press).
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

/**
 * Initialise the AudioContext.  Safe to call multiple times.
 * Must be called after a user gesture.
 */
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

// ============================================================
// Internal helpers
// ============================================================

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
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer     = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(gain);
    gain.connect(masterGain);
    source.start(t);
}

// ============================================================
// Sound effects
// ============================================================

/** Player bullet fired. */
export function playShoot() {
    _sweep('sine', 880, 440, 0.08, 0.15);
}

/** A centipede segment was destroyed. */
export function playSegmentKill() {
    _sweep('sawtooth', 300, 60, 0.12, 0.25);
}

/** Player was hit by an enemy. */
export function playPlayerHit() {
    _osc('sawtooth', 80, 0.4, 0.3);
    _noise(0.3, 0.2);
}

/** Smart Bomb detonated. */
export function playSmartBomb() {
    _sweep('sawtooth', 50, 800, 0.15, 0.4);
    _sweep('sawtooth', 800, 50, 0.3, 0.3, 0.15);
    _noise(0.5, 0.25);
}

/** A tower was placed. */
export function playTowerPlace() {
    _osc('sine', 523, 0.08, 0.2);           // C5
    _osc('sine', 659, 0.08, 0.15, 0.07);    // E5
    _osc('sine', 784, 0.12, 0.1,  0.14);    // G5
}

/** A tower was sold. */
export function playTowerSell() {
    _sweep('sine', 784, 440, 0.15, 0.2);
    _osc('sine', 330, 0.12, 0.15, 0.1);
}

/** A tower was upgraded. */
export function playTowerUpgrade() {
    _osc('sine', 523, 0.07, 0.18);
    _osc('sine', 659, 0.07, 0.15, 0.07);
    _osc('sine', 880, 0.07, 0.12, 0.14);
    _osc('sine', 1047, 0.15, 0.2, 0.21);   // C6 — bright top note
}

/** Wave completed. */
export function playWaveComplete() {
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((freq, i) => {
        _osc('sine', freq, 0.2, 0.2, i * 0.1);
    });
}

/** Game won (all 20 waves cleared). */
export function playGameWon() {
    // Rising arpeggio + held chord
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
        _osc('sine', freq, 0.4, 0.25, i * 0.12);
    });
    _osc('sine', 1047, 0.8, 0.2, 0.7);
    _osc('sine', 1319, 0.8, 0.2, 0.7);
}

/** Flea dropping from the top. */
export function playFleaDrop() {
    _sweep('square', 800, 400, 0.05, 0.15);
    _sweep('square', 600, 300, 0.05, 0.1, 0.06);
    _sweep('square', 400, 200, 0.05, 0.08, 0.12);
}

/** Spider moving in player zone. */
export function playSpiderMove() {
    _osc('square', 200 + Math.random() * 100, 0.05, 0.1);
}

/** Scorpion crossing a row. */
export function playScorpionMove() {
    // Buzzy low crawl
    _osc('sawtooth', 160 + Math.random() * 40, 0.07, 0.12);
}

/** Node damaged (player bullet hit). */
export function playNodeHit() {
    _osc('square', 240, 0.06, 0.12);
}

/** Node destroyed completely. */
export function playNodeDestroy() {
    _sweep('square', 320, 80, 0.1, 0.18);
    _noise(0.07, 0.1);
}

/** Node poisoned by scorpion. */
export function playNodePoison() {
    _sweep('sawtooth', 200, 400, 0.12, 0.15);
    _osc('sine', 180, 0.1, 0.08, 0.08);
}

/** Wave started fanfare. */
export function playWaveStart() {
    _osc('square', 330, 0.08, 0.2);
    _osc('square', 440, 0.08, 0.2, 0.09);
}

/** Boss wave alert — deeper, more dramatic. */
export function playBossAlert() {
    _sweep('sawtooth', 80, 200, 0.3, 0.35);
    _sweep('sawtooth', 200, 80, 0.3, 0.3, 0.3);
    _osc('square', 60, 0.25, 0.2, 0.6);
}

/** UI button click. */
export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

/** Countdown tick (3, 2, 1). Pass 0 for the final "GO" beat. */
export function playCountdownTick(n) {
    // n=3,2,1 → descending tones; n=0 → bright GO chord
    if (n > 0) {
        _osc('sine', 440 + n * 80, 0.12, 0.25);
    } else {
        _osc('sine', 880, 0.18, 0.12);
        _osc('sine', 1100, 0.14, 0.1, 0.06);
    }
}

/** Game over. */
export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}

/**
 * Single node "step" thump used during between-wave march.
 * Call once per row of nodes marching down.
 * @param {number} stepIndex - which step (0, 1, 2…) for pitch variation
 */
export function playNodeMarchStep(stepIndex) {
    // Alternating low thuds — classic Centipede march feel
    const freq = stepIndex % 2 === 0 ? 120 : 100;
    _osc('square', freq, 0.08, 0.18);
    _noise(0.06, 0.08);
}

/** Shooter enemy fires a projectile at a tower. */
export function playShooterFire() {
    // Distinctive "pew" — higher pitch than player bullet to sound alien
    _sweep('square', 600, 1200, 0.07, 0.18);
    _osc('sine', 400, 0.05, 0.1, 0.04);
}

/** A tower takes a hit from an enemy projectile. */
export function playTowerHit() {
    // Dull metallic thud
    _osc('sawtooth', 140, 0.09, 0.28);
    _noise(0.08, 0.12);
}

/** Tower destroyed — shockwave explosion. */
export function playTowerExplosion() {
    _sweep('sawtooth', 200, 40, 0.5, 0.45);
    _sweep('sawtooth', 120, 20, 0.4, 0.3, 0.1);
    _noise(0.4, 0.3);
    _osc('square', 60, 0.25, 0.2, 0.15);
}
