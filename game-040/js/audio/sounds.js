/**
 * sounds.js — every sound in the game, synthesised at runtime with the Web
 * Audio API. No audio files, same as every other game in this repo.
 *
 * The music bed is driven by the simulation's beat events, so on level 4 the
 * Choirmaster's attacks land on the downbeat by construction rather than by
 * being timed against a recording.
 */

const state = {
    ctx: null,
    master: null,
    sfxGain: null,
    musicGain: null,
    enabled: { sfx: true, music: true },
    started: false,
    level: 1,
    bar: 0,
    noiseBuffer: null,
};

// Minor-ish modes per level: the game gets darker as it climbs the tether.
const SCALES = {
    1: [0, 3, 5, 7, 10],
    2: [0, 2, 3, 7, 8],
    3: [0, 2, 5, 7, 9],
    4: [0, 1, 5, 6, 8],
    5: [0, 3, 6, 7, 11],
    6: [0, 1, 4, 6, 9],
};
const ROOTS = { 1: 110, 2: 98, 3: 116.5, 4: 87.3, 5: 82.4, 6: 73.4 };

export function initAudio() {
    if (state.ctx) return state.ctx;
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    state.ctx = new Ctx();
    state.master = state.ctx.createGain();
    state.master.gain.value = 0.62;
    state.master.connect(state.ctx.destination);

    state.sfxGain = state.ctx.createGain();
    state.sfxGain.gain.value = 0.85;
    state.sfxGain.connect(state.master);

    state.musicGain = state.ctx.createGain();
    state.musicGain.gain.value = 0.32;
    state.musicGain.connect(state.master);

    // one shared noise buffer for every explosion/impact
    const len = state.ctx.sampleRate * 2;
    const buf = state.ctx.createBuffer(1, len, state.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    state.noiseBuffer = buf;

    startDrone();
    return state.ctx;
}

/** Browsers suspend audio until a gesture; call this from the first input. */
export function resumeAudio() {
    if (state.ctx?.state === 'suspended') state.ctx.resume();
}

export function setAudioOptions({ sfx, music } = {}) {
    if (sfx !== undefined) state.enabled.sfx = sfx;
    if (music !== undefined) state.enabled.music = music;
    if (state.sfxGain) state.sfxGain.gain.value = state.enabled.sfx ? 0.85 : 0;
    if (state.musicGain) state.musicGain.gain.value = state.enabled.music ? 0.32 : 0;
}

export function setMusicLevel(level) {
    state.level = level;
    if (droneOsc) {
        const root = ROOTS[level] ?? 110;
        droneOsc.forEach((o, i) => {
            o.frequency.setTargetAtTime(root * (DRONE_VOICES[i]?.mult ?? 1), now(), 0.6);
        });
    }
}

function now() { return state.ctx ? state.ctx.currentTime : 0; }
function ok() { return !!state.ctx && state.enabled.sfx; }

// ------------------------------------------------------------------ primitives

function tone({ freq = 440, type = 'square', dur = 0.12, gain = 0.2, glide = 0, dest = null,
                attack = 0.005, detune = 0 }) {
    if (!state.ctx) return;
    const t = now();
    const osc = state.ctx.createOscillator();
    const g = state.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? state.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, gain = 0.3, freq = 1200, q = 1, type = 'lowpass', sweep = 0.25, dest = null }) {
    if (!state.ctx) return;
    const t = now();
    const src = state.ctx.createBufferSource();
    src.buffer = state.noiseBuffer;
    src.loop = true;
    const filt = state.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    filt.Q.value = q;
    const g = state.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(dest ?? state.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
}

// ----------------------------------------------------------------- the ambient

let droneOsc = null;

/* The ambient bed used to be two sawtooths and a triangle held at fixed
   pitch and fixed gain through a fixed filter, the lowest of them a 55Hz
   sub. Nothing about it moved, so it read as a buzz rather than as room
   tone -- and because it starts on the first input and never stops, you
   heard it sitting on the title screen as much as in a fight.

   This version keeps the same harmony but gives every part somewhere to
   go: triangles instead of sawtooths (no high harmonics to rasp), the
   sub dropped an octave up out of the buzz register, a real interval
   instead of a 0.1% detune that beat against itself, and slow LFOs on
   both filter and level so the pad breathes instead of droning. */
const DRONE_VOICES = [
    { mult: 1,    gain: 0.030, lfoRate: 0.045, lfoDepth: 0.011 },
    { mult: 1.5,  gain: 0.022, lfoRate: 0.062, lfoDepth: 0.008 },
    { mult: 2.01, gain: 0.014, lfoRate: 0.037, lfoDepth: 0.006 },
];

function startDrone() {
    if (!state.ctx || droneOsc) return;
    const root = ROOTS[state.level] ?? 110;
    const t = now();
    droneOsc = [];

    // one shared lowpass that drifts across the pad, so the timbre opens
    // and closes over ~40s rather than sitting on one static colour
    const filt = state.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 380;
    filt.Q.value = 0.7;
    const sweep = state.ctx.createOscillator();
    sweep.frequency.value = 0.025;
    const sweepAmt = state.ctx.createGain();
    sweepAmt.gain.value = 140;
    sweep.connect(sweepAmt).connect(filt.frequency);
    sweep.start(t);

    filt.connect(state.musicGain);

    for (const v of DRONE_VOICES) {
        const osc = state.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = root * v.mult;

        const g = state.ctx.createGain();
        // fade in rather than snapping on at full level
        g.gain.value = 0;
        g.gain.setTargetAtTime(v.gain, t, 2.5);

        // independent slow swell per voice; the rates are mutually prime
        // enough that the three never line up into an obvious pulse
        const lfo = state.ctx.createOscillator();
        lfo.frequency.value = v.lfoRate;
        const depth = state.ctx.createGain();
        depth.gain.value = v.lfoDepth;
        lfo.connect(depth).connect(g.gain);
        lfo.start(t);

        osc.connect(g).connect(filt);
        osc.start(t);
        droneOsc.push(osc);
    }
}

/** Called on every simulation beat event: this is the music. */
export function onBeat(index, { intensity = 1 } = {}) {
    if (!state.ctx || !state.enabled.music) return;
    const scale = SCALES[state.level] ?? SCALES[1];
    const root = ROOTS[state.level] ?? 110;
    const beatInBar = index % 8;

    if (beatInBar === 0) state.bar++;
    // bass on 1 and 5
    if (beatInBar === 0 || beatInBar === 4) {
        tone({ freq: root, type: 'sawtooth', dur: 0.28, gain: 0.16 * intensity,
               glide: 0.98, dest: state.musicGain });
    }
    // kick + hat
    if (beatInBar % 2 === 0) noise({ dur: 0.11, gain: 0.16 * intensity, freq: 260, sweep: 0.2, dest: state.musicGain });
    else noise({ dur: 0.05, gain: 0.05 * intensity, freq: 7000, type: 'highpass', sweep: 1, dest: state.musicGain });

    // arpeggio line
    const step = scale[(index * 3 + state.bar) % scale.length];
    tone({
        freq: root * 2 * Math.pow(2, step / 12),
        type: 'square', dur: 0.16, gain: 0.05 * intensity, dest: state.musicGain,
    });
}

// ------------------------------------------------------------------ the sounds

const WEAPON_TONE = { vulcan: 780, spread: 620, lance: 980, seeker: 540 };

export const sfx = {
    shot(weapon = 'vulcan', od = false) {
        if (!ok()) return;
        tone({ freq: (WEAPON_TONE[weapon] ?? 700) * (od ? 1.25 : 1), type: 'square',
               dur: 0.05, gain: 0.045, glide: 0.5 });
    },
    enemyShot() {
        if (!ok()) return;
        tone({ freq: 240, type: 'sawtooth', dur: 0.07, gain: 0.03, glide: 0.7 });
    },
    hit() {
        if (!ok()) return;
        noise({ dur: 0.05, gain: 0.05, freq: 3200, sweep: 0.4 });
    },
    explosion(scale = 1) {
        if (!ok()) return;
        noise({ dur: 0.35 * scale, gain: 0.22, freq: 1400, sweep: 0.12 });
        tone({ freq: 140 / scale, type: 'sine', dur: 0.3 * scale, gain: 0.16, glide: 0.35 });
    },
    bigExplosion() {
        if (!ok()) return;
        noise({ dur: 1.1, gain: 0.34, freq: 1800, sweep: 0.06 });
        tone({ freq: 90, type: 'sine', dur: 0.9, gain: 0.26, glide: 0.4 });
    },
    podRescue(chain = 1) {
        if (!ok()) return;
        const base = 523.25 * Math.pow(2, Math.min(chain, 8) / 24);   // the only consonance in the game
        tone({ freq: base, type: 'triangle', dur: 0.22, gain: 0.1 });
        tone({ freq: base * 1.26, type: 'triangle', dur: 0.26, gain: 0.08 });
        tone({ freq: base * 1.5, type: 'sine', dur: 0.3, gain: 0.06 });
    },
    podLost() {
        if (!ok()) return;
        tone({ freq: 330, type: 'triangle', dur: 0.5, gain: 0.12, glide: 0.45 });
        noise({ dur: 0.4, gain: 0.12, freq: 900, sweep: 0.1 });
    },
    graze() {
        if (!ok()) return;
        tone({ freq: 2100, type: 'sine', dur: 0.03, gain: 0.02 });
    },
    flare() {
        if (!ok()) return;
        noise({ dur: 0.9, gain: 0.3, freq: 5200, sweep: 0.04 });
        tone({ freq: 420, type: 'sawtooth', dur: 0.7, gain: 0.16, glide: 0.2 });
    },
    powerUp() {
        if (!ok()) return;
        for (const [i, f] of [523, 659, 784].entries()) {
            setTimeout(() => tone({ freq: f, type: 'square', dur: 0.1, gain: 0.08 }), i * 55);
        }
    },
    pickup() {
        if (!ok()) return;
        tone({ freq: 880, type: 'square', dur: 0.07, gain: 0.06, glide: 1.3 });
    },
    windup(duration = 0.6) {
        if (!ok()) return;
        tone({ freq: 180, type: 'sawtooth', dur: duration, gain: 0.07, glide: 3.2 });
    },
    bossWarning() {
        if (!ok()) return;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                tone({ freq: 160, type: 'sawtooth', dur: 0.45, gain: 0.16, glide: 2.4 });
                noise({ dur: 0.3, gain: 0.1, freq: 800, sweep: 2 });
            }, i * 320);
        }
    },
    phase() {
        if (!ok()) return;
        noise({ dur: 0.6, gain: 0.22, freq: 4000, sweep: 0.05 });
        tone({ freq: 320, type: 'square', dur: 0.4, gain: 0.12, glide: 0.4 });
    },
    playerDeath() {
        if (!ok()) return;
        noise({ dur: 1.2, gain: 0.3, freq: 2400, sweep: 0.03 });
        tone({ freq: 400, type: 'sawtooth', dur: 1.0, gain: 0.2, glide: 0.12 });
    },
    odStart() {
        if (!ok()) return;
        for (const [i, f] of [392, 523, 659, 880].entries()) {
            setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.18, gain: 0.1 }), i * 60);
        }
    },
    ui() {
        if (!ok()) return;
        tone({ freq: 660, type: 'square', dur: 0.05, gain: 0.05 });
    },
    comms() {
        if (!ok()) return;
        tone({ freq: 1200, type: 'square', dur: 0.03, gain: 0.03 });
        setTimeout(() => tone({ freq: 1600, type: 'square', dur: 0.03, gain: 0.025 }), 45);
    },
};

/** Route one simulation event to a sound. Mirrors render.handleFxEvent. */
export function handleAudioEvent(ev) {
    switch (ev.type) {
        case 'beat':        onBeat(ev.index); break;
        case 'shot':        sfx.shot(ev.weapon, ev.od); break;
        case 'enemyFire':   sfx.enemyShot(); break;
        case 'hit':         if (Math.random() < 0.35) sfx.hit(); break;
        case 'enemyDeath':  sfx.explosion(ev.big ? 1.8 : 1); break;
        case 'podRescued':  sfx.podRescue(ev.chain); break;
        case 'podLost':     sfx.podLost(); break;
        case 'graze':       if (Math.random() < 0.5) sfx.graze(); break;
        case 'flare':       sfx.flare(); break;
        case 'powerUp':     sfx.powerUp(); break;
        case 'flarePickup':
        case 'gemPickup':
        case 'lifePickup':
        case 'weaponSwap':  sfx.pickup(); break;
        case 'bossWindup':  sfx.windup(ev.duration); break;
        case 'bossWarning': sfx.bossWarning(); break;
        case 'bossPhaseFlash': sfx.phase(); break;
        case 'bossDying':   sfx.bigExplosion(); break;
        case 'bossDefeated': sfx.bigExplosion(); break;
        case 'playerDeath': sfx.playerDeath(); break;
        case 'odStart':     sfx.odStart(); break;
        case 'comms':       sfx.comms(); break;
        default: break;
    }
}
