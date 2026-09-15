// ============================================================
// audio.js - WebAudio synthesis (GDD §28.6)
// No files. The game must be fully playable muted; nothing is audio-only.
// ============================================================
let ctx = null, master = null, ambientGain = null, started = false;
let ambientNodes = [];
let musicTimer = null;
export const audio = { enabled: true, volume: 0.5, biome: null, quiet: 0 };

export function startAudio() {
  if (started) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = audio.volume;
    master.connect(ctx.destination);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.12;
    ambientGain.connect(master);
    started = true;
    scheduleMusic();
  } catch { started = false; }
}

export function setVolume(v) {
  audio.volume = v;
  if (master) master.gain.value = audio.enabled ? v : 0;
}
export function setEnabled(on) {
  audio.enabled = on;
  if (master) master.gain.value = on ? audio.volume : 0;
}

function env(node, gain, attack, decay, when = 0) {
  const t = ctx.currentTime + when;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  node.connect(g);
  g.connect(master);
  return { g, stopAt: t + attack + decay + 0.02 };
}

function noiseBuffer(seconds = 0.2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** ~24 sounds, each a handful of lines. */
export const sfx = {
  step(tileKey) {
    if (!ready()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = tileKey === 'shallow_water' ? 900 : tileKey === 'snow' ? 2400 :
      tileKey === 'leaf_litter' ? 1600 : tileKey === 'floor_wood' ? 500 : 700;
    f.Q.value = 1.2;
    src.connect(f);
    const { stopAt } = env(f, 0.06, 0.005, 0.10);
    src.start(); src.stop(stopAt);
  },
  hit(heavy) {
    if (!ready()) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(heavy ? 90 : 160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.14);
    const { stopAt } = env(o, heavy ? 0.28 : 0.16, 0.004, 0.14);
    o.start(); o.stop(stopAt);
  },
  hurt() {
    if (!ready()) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
    const { stopAt } = env(o, 0.20, 0.004, 0.2);
    o.start(); o.stop(stopAt);
  },
  pickup() {
    if (!ready()) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.05);
    const { stopAt } = env(o, 0.12, 0.004, 0.10);
    o.start(); o.stop(stopAt);
  },
  levelUp() {
    if (!ready()) return;
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const { stopAt } = env(o, 0.13, 0.01, 0.35, i * 0.09);
      o.start(ctx.currentTime + i * 0.09); o.stop(stopAt);
    });
  },
  bell() {
    if (!ready()) return;
    [440, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * (1 + i * 0.002);
      const { stopAt } = env(o, 0.14 / (i + 1), 0.005, 2.2);
      o.start(); o.stop(stopAt);
    });
  },
  door() {
    if (!ready()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    src.connect(f);
    const { stopAt } = env(f, 0.10, 0.02, 0.26);
    src.start(); src.stop(stopAt);
  },
  wake() {
    if (!ready()) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 1.4);
    const { stopAt } = env(o, 0.22, 0.05, 1.4);
    o.start(); o.stop(stopAt);
  },
  lantern() {
    if (!ready()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2200;
    src.connect(f);
    const { stopAt } = env(f, 0.08, 0.01, 0.22);
    src.start(); src.stop(stopAt);
  },
};

const ready = () => started && ctx && audio.enabled;

/** A drifting drone per biome, crossfaded over four seconds. */
export function setAmbience(biomeKey, quiet) {
  if (!ready()) return;
  audio.quiet = quiet;
  if (audio.biome === biomeKey) { fadeAmbient(quiet); return; }
  audio.biome = biomeKey;
  for (const n of ambientNodes) { try { n.stop ? n.stop() : n.disconnect(); } catch { } }
  ambientNodes = [];

  const bases = {
    fen: 78, deepwood: 96, meadow: 110, shore: 88, crag: 68, peak: 62,
    snowfield: 70, upland: 92, heath: 104, orchardland: 116, wood: 100,
    cloudforest: 84, dryland: 120, sea: 60, hollow: 52,
  };
  const base = bases[biomeKey] || 100;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = base * (i === 0 ? 1 : i === 1 ? 1.5 : 2.01) * (1 + (i * 0.004));
    const g = ctx.createGain();
    g.gain.value = 0.05 / (i + 1);
    o.connect(g); g.connect(ambientGain);
    o.start();
    ambientNodes.push(o);
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = biomeKey === 'fen' ? 500 : biomeKey === 'shore' ? 900 : 700;
  f.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.02;
  src.connect(f); f.connect(g); g.connect(ambientGain);
  src.start();
  ambientNodes.push(src);
  fadeAmbient(quiet);
}

/** As the Quiet rises, the ambience loses layers. At 0.8, silence. */
function fadeAmbient(quiet) {
  if (!ambientGain) return;
  const target = quiet >= 0.8 ? 0 : 0.12 * (1 - quiet);
  ambientGain.gain.setTargetAtTime(target, ctx.currentTime, 2);
}

/** Generative music: a room with someone humming in it, never a soundtrack. */
function scheduleMusic() {
  if (musicTimer) clearTimeout(musicTimer);
  const next = () => {
    if (ready() && audio.quiet < 0.8) {
      const scale = [0, 2, 4, 7, 9, 12];
      const root = 220;
      const n = scale[Math.floor(Math.random() * scale.length)];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = root * Math.pow(2, n / 12);
      const { stopAt } = env(o, 0.035 * (1 - audio.quiet), 0.6, 2.6);
      o.start(); o.stop(stopAt);
    }
    musicTimer = setTimeout(next, 4000 + Math.random() * 8000);
  };
  musicTimer = setTimeout(next, 4000);
}
