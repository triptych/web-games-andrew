/**
 * sounds.js — Web Audio procedural SFX (game-plan §Sound Design).
 * Warm apothecary palette. No file assets. Call initAudio() on first gesture.
 *
 * Phase 1 sounds: click, pickup, place, invalid, line clear, combo, set dealt,
 * jammed.
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(audioCtx.destination);
}

export function setSoundEnabled(val) { _enabled = val; }
export function isSoundEnabled()     { return _enabled; }
export function toggleSound()        { _enabled = !_enabled; return _enabled; }

// --- helpers ---
function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

function _sweep(type, f0, f1, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + duration + 0.01);
}

function _noise(duration, vol = 0.15, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain); gain.connect(masterGain);
    src.start(t);
}

// --- effects ---

/** UI click — short sine blip */
export function playUiClick()   { _osc('sine', 620, 0.06, 0.14); }

/** Pick up a shape — soft pluck */
export function playPickup()    { _osc('triangle', 440, 0.08, 0.16); _osc('sine', 660, 0.05, 0.08, 0.01); }

/** Place valid — wooden tick + tiny thud */
export function playPlace() {
    _osc('square', 200, 0.05, 0.12);
    _osc('sine', 130, 0.07, 0.18, 0.01);
    _noise(0.03, 0.05);
}

/** Invalid release — dull buzz */
export function playInvalid()   { _osc('sawtooth', 110, 0.12, 0.18); }

/**
 * Line clear — rising glassy arpeggio; pitch climbs with simultaneous lines.
 * @param {number} lines — number of lines cleared this placement.
 */
export function playLineClear(lines = 1) {
    const base = 520 + (lines - 1) * 120;
    const notes = [base, base * 1.25, base * 1.5];
    notes.forEach((f, i) => _osc('sine', f, 0.16, 0.18, i * 0.05));
}

/** Combo — shimmer + higher chime for multi-line clears */
export function playCombo(lines = 2) {
    _sweep('sine', 900, 1500 + lines * 80, 0.18, 0.2);
    _osc('triangle', 1800, 0.14, 0.16, 0.1);
}

/** Set dealt — soft triple shuffle/clack */
export function playSetDealt() {
    for (let i = 0; i < 3; i++) _noise(0.04, 0.06, i * 0.05);
    _osc('sine', 380, 0.05, 0.08, 0.04);
}

/** Jammed — low descending sawtooth (§Failure 1) */
export function playJammed() {
    _sweep('sawtooth', 360, 50, 0.7, 0.35);
    _noise(0.4, 0.1, 0.1);
}

/** Cover stripped — gritty scrape as a deposit layer is removed (§5) */
export function playCoverStripped() {
    _noise(0.16, 0.13);
    _sweep('sawtooth', 240, 150, 0.16, 0.07);
}

/** Tile-type unlocked — bubbling glug + soft chime (§4 cauldron unlock) */
export function playTileUnlocked() {
    // "glug" — descending noise burst evoking a bubbling cauldron
    _sweep('sawtooth', 180, 90, 0.22, 0.18);
    _noise(0.18, 0.09, 0.04);
    // chime
    _osc('sine', 880, 0.4, 0.18, 0.14);
    _osc('sine', 1108, 0.3, 0.3, 0.22);
    _osc('triangle', 1320, 0.2, 0.2, 0.30);
}

/** Harvest — warm bell bloom when a deposit is fully revealed (§5) */
export function playHarvest() {
    _osc('sine', 523.25, 0.5, 0.2);            // C5
    _osc('sine', 659.25, 0.5, 0.16, 0.04);     // E5
    _osc('sine', 783.99, 0.6, 0.14, 0.08);     // G5
    _osc('triangle', 1046.5, 0.4, 0.08, 0.12); // C6 shimmer
}

/** Level complete — major arpeggio flourish (§Phase 4) */
export function playLevelComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notes.forEach((f, i) => _osc('sine', f, 0.45 - i * 0.06, 0.22, i * 0.07));
    _osc('triangle', 1568, 0.25, 0.2, 0.32);  // top shimmer
}

/** Quest infeasible — hollow detuned fall (§Failure 2) */
export function playInfeasible() {
    _sweep('sawtooth', 320, 80, 0.9, 0.28);
    _sweep('sine', 280, 60, 0.9, 0.12, 0.08);
    _noise(0.3, 0.06, 0.2);
}

/** Cauldron tier upgrade — triumphant chord (§6) */
export function playCauldronUpgrade() {
    // root + major third + fifth + octave, staggered
    _osc('sine', 261.63, 0.8, 0.25);           // C4
    _osc('sine', 329.63, 0.8, 0.22, 0.06);     // E4
    _osc('sine', 392.00, 0.8, 0.20, 0.12);     // G4
    _osc('sine', 523.25, 0.9, 0.18, 0.18);     // C5
    _osc('triangle', 1046.5, 0.6, 0.3, 0.22);  // sparkle
    _noise(0.1, 0.05, 0.24);
}

// --- Phase 5: Refinement sounds (§11b) ---

/** Recipe condition satisfied — soft confirming bell */
export function playConditionMet() {
    _osc('sine', 740, 0.28, 0.18);
    _osc('sine', 988, 0.28, 0.22, 0.06);
    _osc('triangle', 1318, 0.2, 0.18, 0.12);
}

/** Quality grade rises — brightening shimmer */
export function playQualityUp() {
    _sweep('sine', 600, 1200, 0.2, 0.22);
    _osc('triangle', 1760, 0.14, 0.16, 0.14);
}

/** Potion brewed (refinement complete) — warm cork-pop + sparkle */
export function playPotionBrewed() {
    // cork-pop: short noise burst + pluck
    _noise(0.06, 0.22);
    _osc('sine', 330, 0.12, 0.08, 0.02);
    // sparkle arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => _osc('sine', f, 0.35 - i * 0.05, 0.2, 0.06 + i * 0.06));
    _osc('triangle', 1568, 0.18, 0.22, 0.3);
}

// --- Phase 5: Battle sounds (§11c) ---

/** Enemy hit — crunchy impact (pitch descends with remaining HP ratio) */
export function playEnemyHit(hpRatio = 1) {
    const freq = 180 + hpRatio * 200; // lower pitch = more damaged
    _osc('square', freq, 0.1, 0.22);
    _noise(0.1, 0.14);
}

/** Enemy defeated — shatter + descending puff */
export function playEnemyDefeated() {
    _noise(0.18, 0.24);
    _sweep('sawtooth', 400, 80, 0.3, 0.22);
    _osc('sine', 200, 0.25, 0.2, 0.08);
}

/** Player hurt — dull thud + low warble */
export function playPlayerHurt() {
    _osc('sine', 90, 0.25, 0.28);
    _sweep('sine', 130, 70, 0.35, 0.18, 0.04);
    _noise(0.12, 0.1, 0.06);
}

/** Player defeated (HP → 0) — heavy minor-chord collapse */
export function playDefeated() {
    // Minor chord collapse, descending
    _osc('sine', 220, 0.8, 0.55);
    _osc('sine', 261.63, 0.8, 0.5, 0.06);
    _osc('sine', 174.61, 0.8, 0.6, 0.12);
    _sweep('sawtooth', 200, 40, 0.9, 0.3, 0.2);
    _noise(0.5, 0.18, 0.3);
}

// --- Phase 8: Shop / item sounds ---

/** Purchase — coin clink + register ding (§8) */
export function playPurchase() {
    _osc('triangle', 1318, 0.10, 0.14);
    _osc('sine', 1760, 0.08, 0.10, 0.06);
    _noise(0.04, 0.06, 0.02);
}

/** Item used — quick fizzy pop (§8) */
export function playItemUse() {
    _noise(0.06, 0.18);
    _sweep('sine', 440, 880, 0.14, 0.14, 0.02);
    _osc('triangle', 1046, 0.10, 0.12, 0.08);
}

// --- Phase 6: Dialog / VN sounds ---

/** VN panel slides in — soft whoosh upward */
export function playDialogOpen() {
    _sweep('sine', 180, 340, 0.22, 0.13);
    _noise(0.1, 0.04, 0.01);
}

/** VN panel slides out — soft whoosh downward */
export function playDialogClose() {
    _sweep('sine', 320, 150, 0.20, 0.11);
    _noise(0.1, 0.03);
}

/** Text advance click — soft tick (quiet, fires every line) */
export function playDialogAdvance() {
    _osc('sine', 520, 0.04, 0.10);
}

/** Choice hover highlight — subtle tone shift */
export function playChoiceHover() {
    _osc('triangle', 660, 0.03, 0.06);
}

// ─── Phase 9 sounds ──────────────────────────────────────────────────────────

/** Skill tree unlock — resonant unlock chime + sparkle */
export function playSkillUnlock() {
    _osc('sine',     440, 0.15, 0.30);
    _osc('sine',     660, 0.12, 0.20, 0.04);
    _osc('triangle', 880, 0.10, 0.18, 0.10);
    _sweep('sine',   1100, 1760, 0.25, 0.08, 0.15);
}

/** Activated passive triggered — soft warp/whoosh */
export function playPassiveTrigger() {
    _sweep('sine',   330, 660, 0.12, 0.22);
    _osc('triangle', 880, 0.07, 0.10, 0.08);
}

/** Activated passive cooldown finished — tiny rising "ready" chime */
export function playPassiveReady() {
    _osc('sine',     740, 0.06, 0.10);
    _osc('sine',     990, 0.05, 0.08, 0.05);
}
