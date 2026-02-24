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

// Menu / UI
export function playMenuMove()   { _osc('sine', 440, 0.06, 0.12); }
export function playMenuSelect() { _osc('sine', 660, 0.06, 0.15); _osc('sine', 880, 0.08, 0.1, 0.04); }
export function playMenuBack()   { _sweep('sine', 440, 280, 0.1, 0.12); }

// Battle — party attacks (class-specific)
// Warrior: heavy metal clang — deep thud + low square grind
export function playWarriorHit()   { _noise(0.1, 0.3); _sweep('square', 180, 60, 0.12, 0.25); }
// Mage: weak physical zap — thin high-pitched blip (mages are bad fighters)
export function playMageHit()      { _sweep('sine', 800, 300, 0.08, 0.15); _noise(0.04, 0.1, 0.02); }
// Healer: light staff tap — soft mid thump
export function playHealerHit()    { _osc('triangle', 320, 0.07, 0.2); _noise(0.05, 0.12, 0.03); }
// Rogue: quick sharp slash — fast high noise snap, double-click feel
export function playRogueHit()     { _noise(0.03, 0.35); _sweep('sawtooth', 1200, 400, 0.05, 0.2, 0.02); }
// Generic fallback
export function playPhysicalHit()  { _noise(0.06, 0.25); _sweep('square', 200, 80, 0.08, 0.2); }

// Battle — party magic
export function playMagicCast()    { _osc('sine', 880, 0.08, 0.2); _osc('sine', 1320, 0.12, 0.15, 0.06); _osc('sine', 1760, 0.1, 0.1, 0.1); }
export function playFireSpell()    { _sweep('sawtooth', 600, 200, 0.3, 0.3); _noise(0.2, 0.1, 0.05); }
export function playIceSpell()     { _osc('triangle', 1200, 0.12, 0.2); _osc('triangle', 900, 0.15, 0.15, 0.08); _noise(0.1, 0.08, 0.1); }
// Healer magic cast: softer ascending chime (not an attack, feels nurturing)
export function playHealerMagic()  { _osc('sine', 660, 0.06, 0.15); _osc('sine', 990, 0.08, 0.12, 0.05); _osc('sine', 1320, 0.06, 0.1, 0.1); }
// Status buff application: short shimmer
export function playStatusBuff()   { _sweep('triangle', 400, 800, 0.12, 0.18); _osc('sine', 1000, 0.06, 0.12, 0.1); }
// Status debuff (like smoke screen): hollow descending sweep
export function playStatusDebuff() { _sweep('square', 700, 200, 0.15, 0.18); _noise(0.08, 0.1, 0.1); }
export function playHeal()         { [523, 659, 784].forEach((f, i) => _osc('sine', f, 0.2, 0.2, i * 0.06)); }
export function playHealAll()      { [523, 659, 784, 1047].forEach((f, i) => _osc('sine', f, 0.25, 0.2, i * 0.07)); }

// Battle — enemy actions
export function playEnemyAttack()  { _sweep('sawtooth', 300, 100, 0.12, 0.25); _noise(0.06, 0.15, 0.06); }
export function playEnemyMagic()   { _sweep('square', 400, 800, 0.08, 0.2); _osc('sine', 660, 0.1, 0.15, 0.1); }

// Battle — results
export function playDamageHit()    { _noise(0.08, 0.3); }
export function playPartyKO()      { _sweep('sawtooth', 400, 50, 0.8, 0.4); _noise(0.5, 0.15, 0.2); }
export function playEnemyDeath()   { _sweep('sawtooth', 300, 40, 0.4, 0.3); _noise(0.3, 0.1, 0.1); }
export function playVictoryFanfare() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((f, i) => _osc('triangle', f, 0.15, 0.3, i * 0.1));
}

// Level-up
export function playLevelUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => _osc('sine', f, 0.2, 0.25, i * 0.09));
}

// Status effects
export function playPoison()    { _sweep('sawtooth', 200, 400, 0.15, 0.15); }
export function playBuffApply() { _osc('triangle', 660, 0.08, 0.2); _osc('triangle', 880, 0.1, 0.18, 0.06); }

// Game events
export function playBattleStart() { _sweep('square', 100, 300, 0.12, 0.3); _noise(0.08, 0.15, 0.1); }
export function playGameOver()    { _sweep('sawtooth', 400, 50, 0.8, 0.4); _noise(0.5, 0.15, 0.2); }
// Items — distinct by effect type
export function playItemUse()     { _osc('sine', 740, 0.1, 0.2); }                                                    // generic fallback
export function playItemHeal()    { _osc('sine', 600, 0.06, 0.18); _osc('sine', 900, 0.08, 0.15, 0.05); }             // HP potion: warm two-note pop
export function playItemMana()    { _osc('triangle', 440, 0.05, 0.15); _sweep('sine', 660, 1100, 0.12, 0.15, 0.04); } // MP ether: rising shimmer
export function playItemRevive()  { _osc('sine', 330, 0.06, 0.2); [440, 550, 660, 880].forEach((f, i) => _osc('sine', f, 0.18, 0.22, 0.06 + i * 0.07)); } // revive: short pause then ascending chord
export function playItemCure()    { _sweep('triangle', 300, 600, 0.12, 0.2); _noise(0.06, 0.06, 0.1); }               // antidote: cleansing sweep
export function playRun()         { _sweep('triangle', 600, 200, 0.2, 0.2); }
