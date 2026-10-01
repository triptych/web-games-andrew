/**
 * audio.js — synthesised sound effects and a small generative score.
 * Nothing is loaded: every sound is built from oscillators and noise.
 */

let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let soundOn = true, musicOn = true;
let music = null;
let wanted = null; // the score the current screen asked for, started once audio unlocks

export function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = soundOn ? 0.6 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.22 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wanted) playMusic(wanted);
}

export function setSound(on) { soundOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.6 : 0; }
export function setMusic(on) {
    musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.22 : 0, ac.currentTime, 0.3);
    if (on && ac && !music && wanted) playMusic(wanted);
}

function tone(freq, dur, o = {}) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
        const f = ac.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.cutoff || 1200; osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
}

function noise(dur, o = {}) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

const SFX = {
    click: () => tone(880, 0.06, { type: 'triangle', vol: 0.12 }),
    tab: () => { tone(660, 0.05, { type: 'triangle', vol: 0.1 }); tone(990, 0.06, { type: 'triangle', vol: 0.08, delay: 0.03 }); },
    error: () => { tone(220, 0.12, { type: 'square', vol: 0.08 }); tone(180, 0.15, { type: 'square', vol: 0.08, delay: 0.08 }); },
    swing: () => noise(0.18, { freq: 1200, to: 3200, vol: 0.18, q: 0.8 }),
    hit: () => { noise(0.12, { freq: 600, to: 200, vol: 0.35, q: 1.2 }); tone(140, 0.12, { type: 'square', to: 60, vol: 0.12 }); },
    crit: () => { noise(0.2, { freq: 2200, to: 400, vol: 0.4 }); tone(320, 0.2, { type: 'sawtooth', to: 80, vol: 0.14 }); tone(1600, 0.12, { type: 'triangle', vol: 0.1 }); },
    glance: () => noise(0.08, { freq: 2500, vol: 0.12 }),
    magic: () => { tone(520, 0.3, { type: 'sine', to: 1200, vol: 0.12 }); tone(780, 0.3, { type: 'triangle', to: 1500, vol: 0.06, delay: 0.05 }); },
    arrow: () => noise(0.16, { freq: 3000, to: 1200, vol: 0.18, q: 3 }),
    boom: () => { noise(0.5, { type: 'lowpass', freq: 900, to: 80, vol: 0.5 }); tone(90, 0.4, { type: 'sine', to: 35, vol: 0.3 }); },
    heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'sine', vol: 0.08, delay: i * 0.06 })); },
    buff: () => { tone(440, 0.18, { type: 'triangle', to: 880, vol: 0.1 }); tone(660, 0.2, { type: 'triangle', to: 1320, vol: 0.06, delay: 0.06 }); },
    debuff: () => { tone(400, 0.25, { type: 'sawtooth', to: 150, vol: 0.07, filter: 'lowpass', cutoff: 1200 }); },
    shield: () => { tone(300, 0.4, { type: 'sine', to: 600, vol: 0.12 }); noise(0.3, { freq: 4000, vol: 0.05 }); },
    death: () => { tone(300, 0.5, { type: 'triangle', to: 70, vol: 0.14 }); noise(0.4, { type: 'lowpass', freq: 600, to: 100, vol: 0.15 }); },
    coin: () => { tone(1320, 0.08, { type: 'square', vol: 0.06 }); tone(1760, 0.14, { type: 'square', vol: 0.06, delay: 0.06 }); },
    reward: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
    levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.06, delay: i * 0.07, filter: 'lowpass', cutoff: 3000 })); },
    victory: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.22, { type: 'square', vol: 0.07, delay: i * 0.12, filter: 'lowpass', cutoff: 2600 })); },
    defeat: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.1, delay: i * 0.22 })); },
    charge: () => { tone(110, 1.6, { type: 'sawtooth', to: 880, vol: 0.08, filter: 'lowpass', cutoff: 1400, attack: 0.3 }); noise(1.4, { freq: 300, to: 4000, vol: 0.08 }); },
    reveal3: () => { tone(660, 0.4, { type: 'triangle', vol: 0.12 }); tone(990, 0.5, { type: 'sine', vol: 0.08, delay: 0.08 }); },
    reveal4: () => { [587, 740, 880, 1175].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); },
    reveal5: () => { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.7, { type: 'triangle', vol: 0.1, delay: i * 0.06 })); noise(1.2, { freq: 6000, vol: 0.06 }); },
    pick: () => { tone(900, 0.05, { type: 'square', vol: 0.08 }); noise(0.1, { freq: 2500, to: 800, vol: 0.25, q: 2 }); },
    crumble: () => { noise(0.35, { type: 'lowpass', freq: 1200, to: 150, vol: 0.35 }); },
    plant: () => { tone(330, 0.1, { type: 'triangle', vol: 0.1 }); noise(0.12, { freq: 800, vol: 0.1 }); },
    splash: () => { noise(0.3, { freq: 3000, to: 800, vol: 0.15 }); },
    harvest: () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.08, delay: i * 0.05 })); },
    spin: () => tone(1200, 0.03, { type: 'square', vol: 0.04 }),
    spell: () => { tone(220, 0.6, { type: 'sawtooth', to: 1760, vol: 0.08, filter: 'lowpass', cutoff: 2400 }); noise(0.6, { freq: 1500, to: 6000, vol: 0.1 }); },
    page: () => noise(0.12, { freq: 1800, vol: 0.08 }),
};

export function sfx(name) {
    if (!ac || !soundOn) return;
    const f = SFX[name];
    if (f) try { f(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- music

const SCALES = {
    citadel: { root: 196, steps: [0, 2, 4, 7, 9, 12, 14, 16], tempo: 0.42, pad: [0, 4, 7] },
    battle: { root: 164.8, steps: [0, 2, 3, 5, 7, 8, 10, 12], tempo: 0.2, pad: [0, 3, 7] },
    summon: { root: 220, steps: [0, 3, 5, 7, 10, 12, 15], tempo: 0.34, pad: [0, 5, 10] },
    boss: { root: 146.8, steps: [0, 1, 3, 5, 7, 8, 11, 12], tempo: 0.17, pad: [0, 3, 6] },
};

export function playMusic(kind) {
    wanted = kind;
    if (!ac) return;
    if (music && music.kind === kind) return;
    stopMusic();
    const S = SCALES[kind] || SCALES.citadel;
    const m = { kind, timer: null, step: 0, pads: [] };
    // pad
    const padGain = ac.createGain(); padGain.gain.value = 0.0001; padGain.connect(musicBus);
    padGain.gain.setTargetAtTime(0.25, ac.currentTime, 1.2);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(padGain);
    for (const iv of S.pad) {
        for (const det of [-6, 6]) {
            const o = ac.createOscillator(); o.type = 'sawtooth';
            o.frequency.value = S.root * Math.pow(2, iv / 12) / 2; o.detune.value = det;
            const g = ac.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(lp); o.start();
            m.pads.push(o);
        }
    }
    m.padGain = padGain;
    const seq = () => {
        if (!musicOn || !ac) return;
        const st = m.step++;
        const deg = S.steps[(st * 3 + Math.floor(st / 8)) % S.steps.length];
        const oct = st % 16 < 8 ? 1 : 2;
        if (Math.random() < 0.82) tone(S.root * Math.pow(2, deg / 12) * oct, S.tempo * 1.8, { type: 'triangle', vol: 0.05, bus: musicBus, attack: 0.01 });
        if (kind === 'battle' || kind === 'boss') { if (st % 2 === 0) tone(S.root / 2, S.tempo * 0.9, { type: 'square', vol: 0.03, bus: musicBus, filter: 'lowpass', cutoff: 500 }); }
    };
    m.timer = setInterval(seq, S.tempo * 1000);
    music = m;
}

export function stopMusic() {
    if (!music || !ac) return;
    clearInterval(music.timer);
    const m = music;
    m.padGain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4);
    setTimeout(() => m.pads.forEach((o) => { try { o.stop(); } catch { /* ignore */ } }), 1500);
    music = null;
}
