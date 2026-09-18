// ============================================================
// audio.js - WebAudio chiptune (GDD 15)
// Square/pulse/triangle/noise voices and a tiny sequencer. No files, and
// the game is fully playable muted: nothing is audio-only.
// ============================================================
import { state } from './game/state.js';

let ctx = null, master = null, musicGain = null, sfxGain = null;
let started = false, currentTrack = null, step = 0, timer = null;

export function startAudio() {
  if (started) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = state.settings.volume ?? 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.28; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    started = true;
    return true;
  } catch { started = false; return false; }
}

export function setVolume(v) {
  state.settings.volume = v;
  if (master) master.gain.value = v;
}
export function setMusicEnabled(on) {
  state.settings.music = on;
  if (musicGain) musicGain.gain.value = on ? 0.28 : 0;
}
export function setSoundEnabled(on) {
  state.settings.sound = on;
  if (sfxGain) sfxGain.gain.value = on ? 0.9 : 0;
}

const ready = () => started && ctx && state.settings.sound !== false;

/** A pulse wave, built once: the sound of the whole genre. */
let pulseWave = null;
function getPulse() {
  if (pulseWave) return pulseWave;
  const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (i % 2 ? 1 : 0.25) / i;
  pulseWave = ctx.createPeriodicWave(real, imag);
  return pulseWave;
}

function tone(freq, { type = 'square', dur = 0.12, gain = 0.2, when = 0, dest = null, slide = 0 } = {}) {
  if (!started || !ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  if (type === 'pulse') osc.setPeriodicWave(getPulse()); else osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(dest || sfxGain);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, gain = 0.2, when = 0, freq = 1200, q = 1, type = 'bandpass' } = {}) {
  if (!started || !ctx) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur);
}

const N = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };
const note = (name, oct = 0) => (N[name[0]] * (name[1] === '#' ? 1.0595 : 1)) * Math.pow(2, oct);

// --------------------------------------------------------------- effects --
export const sfx = {
  ui() { if (ready()) tone(660, { dur: 0.05, gain: 0.12, type: 'square' }); },
  back() { if (ready()) tone(440, { dur: 0.06, gain: 0.1, type: 'square', slide: 0.7 }); },
  confirm() { if (ready()) { tone(523, { dur: 0.06, gain: 0.14 }); tone(784, { dur: 0.09, gain: 0.12, when: 0.05 }); } },
  error() { if (ready()) tone(160, { dur: 0.16, gain: 0.16, type: 'sawtooth', slide: 0.6 }); },
  hit(heavy = false) {
    if (!ready()) return;
    noise({ dur: heavy ? 0.22 : 0.12, gain: heavy ? 0.3 : 0.2, freq: heavy ? 320 : 900, q: 0.8 });
    tone(heavy ? 110 : 220, { dur: 0.1, gain: 0.16, type: 'square', slide: 0.5 });
  },
  crit() { if (ready()) { noise({ dur: 0.26, gain: 0.32, freq: 500 }); tone(880, { dur: 0.12, gain: 0.2, type: 'pulse', slide: 0.4 }); } },
  miss() { if (ready()) noise({ dur: 0.1, gain: 0.12, freq: 2600, type: 'highpass' }); },
  heal() { if (ready()) { tone(523, { dur: 0.1, gain: 0.14, type: 'triangle' }); tone(659, { dur: 0.12, gain: 0.14, type: 'triangle', when: 0.07 }); tone(784, { dur: 0.16, gain: 0.14, type: 'triangle', when: 0.14 }); } },
  faint() { if (ready()) tone(330, { dur: 0.5, gain: 0.2, type: 'square', slide: 0.28 }); },
  bind() { if (ready()) { for (let i = 0; i < 3; i++) tone(440 + i * 60, { dur: 0.08, gain: 0.14, type: 'pulse', when: i * 0.1 }); } },
  bound() { if (ready()) { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.16, gain: 0.16, type: 'pulse', when: i * 0.09 })); } },
  bindFail() { if (ready()) { noise({ dur: 0.2, gain: 0.2, freq: 700 }); tone(200, { dur: 0.22, gain: 0.16, type: 'sawtooth', slide: 0.5 }); } },
  levelUp() { if (ready()) { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.14, gain: 0.15, type: 'pulse', when: i * 0.08 })); } },
  stage() { if (ready()) { [262, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { dur: 0.22, gain: 0.16, type: 'pulse', when: i * 0.1 })); } },
  hatch() { if (ready()) { noise({ dur: 0.12, gain: 0.18, freq: 1800 }); [659, 784, 988].forEach((f, i) => tone(f, { dur: 0.2, gain: 0.15, type: 'triangle', when: 0.12 + i * 0.1 })); } },
  surge() { if (ready()) { for (let i = 0; i < 8; i++) tone(220 * Math.pow(1.18, i), { dur: 0.1, gain: 0.14, type: 'pulse', when: i * 0.05 }); noise({ dur: 0.5, gain: 0.25, freq: 400, when: 0.4 }); } },
  coin() { if (ready()) { tone(988, { dur: 0.06, gain: 0.12, type: 'square' }); tone(1319, { dur: 0.1, gain: 0.1, type: 'square', when: 0.05 }); } },
  step() { if (ready()) noise({ dur: 0.08, gain: 0.08, freq: 500 }); },
  cleanse() { if (ready()) { [784, 1047, 1319, 1568].forEach((f, i) => tone(f, { dur: 0.3, gain: 0.12, type: 'triangle', when: i * 0.12 })); } },
};

// ----------------------------------------------------------------- music --
/** Four tracks, each a bass line and a lead, in note names. */
const TRACKS = {
  field: {
    bpm: 108,
    bass: ['C-1', '.', 'G-1', '.', 'A-1', '.', 'F-1', '.'],
    lead: ['E0', 'G0', 'A0', 'G0', 'C1', '.', 'A0', 'G0', 'F0', 'E0', 'D0', '.', 'E0', '.', '.', '.'],
  },
  town: {
    bpm: 92,
    bass: ['F-1', '.', 'C-1', '.', 'D-1', '.', 'A-1', '.'],
    lead: ['A0', 'C1', 'D1', 'C1', 'A0', 'G0', 'F0', '.', 'G0', 'A0', 'C1', '.', 'A0', '.', '.', '.'],
  },
  battle: {
    bpm: 148,
    bass: ['D-1', 'D-1', 'A-1', '.', 'D-1', 'D-1', 'F-1', 'G-1'],
    lead: ['D1', 'F1', 'E1', 'D1', 'A0', '.', 'D1', 'C1', 'A0', 'F0', 'G0', 'A0', 'D1', '.', 'A0', '.'],
  },
  boss: {
    bpm: 132,
    bass: ['C-1', 'C-1', 'C-1', 'G#-1', 'A#-1', 'A#-1', 'G-1', 'G-1'],
    lead: ['C1', 'D#1', 'G1', 'F1', 'D#1', 'C1', 'A#0', 'C1', 'G0', 'A#0', 'C1', 'D#1', 'C1', '.', '.', '.'],
  },
};

function freqOf(token) {
  if (!token || token === '.') return 0;
  const m = /^([A-G]#?)(-?\d)$/.exec(token);
  if (!m) return 0;
  return note(m[1], Number(m[2]));
}

export function playMusic(trackName) {
  if (!started) return;
  if (currentTrack === trackName) return;
  currentTrack = trackName;
  stopSequencer();
  const track = TRACKS[trackName];
  if (!track || state.settings.music === false) return;
  step = 0;
  const interval = (60 / track.bpm) * 1000 / 2;   // eighth notes
  timer = setInterval(() => {
    if (state.settings.music === false) return;
    const bass = freqOf(track.bass[step % track.bass.length]);
    const lead = freqOf(track.lead[step % track.lead.length]);
    if (bass) tone(bass, { type: 'triangle', dur: 0.24, gain: 0.3, dest: musicGain });
    if (lead) tone(lead, { type: 'pulse', dur: 0.16, gain: 0.16, dest: musicGain });
    if (step % 4 === 0 && trackName !== 'quiet') {
      const t = ctx.currentTime;
      const n = ctx.createBufferSource();
      const b = ctx.createBuffer(1, 800, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < 800; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / 800);
      n.buffer = b;
      const g = ctx.createGain(); g.gain.value = 0.12;
      n.connect(g); g.connect(musicGain);
      n.start(t); n.stop(t + 0.05);
    }
    step++;
  }, interval);
}

export function stopMusic() { currentTrack = null; stopSequencer(); }
function stopSequencer() { if (timer) { clearInterval(timer); timer = null; } }

/** Browsers need a user gesture; call this from the first tap. */
export function unlock() {
  if (!started) startAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
