/**
 * audio.js — every sound in Haven Road is synthesised with Web Audio.
 *
 * Music is generative and hopeful: a warm pad on a four-chord loop, a soft piano-ish melody over a
 * major pentatonic, a plucked bass and a light shaker. Each act has its own key and pace (autumn
 * in D, winter in A and slower, the city in F with a hush). Boss levels move to a minor
 * progression with a low drum that sounds like resolve rather than dread. Ambience: wind and birds,
 * a winter hush, rain on the roofs.
 *
 * Effects: a chime for every kind of care, the Haven's bell for every arrival, a soft sigh and a
 * rising tone for a lantern lost, quiet, melancholy moans from the dead, and sparkles for a cure.
 */

let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, reverb = null, noiseBuf = null;
let musicVol = 0.55, sfxVol = 0.8, muted = false;
let schedT = 0, step = 0, timer = null;
let mood = 'title', act = 1;
let ambNodes = [];
let lastAt = {};

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(2.8, 2.6);
    const rv = ctx.createGain(); rv.gain.value = 0.38;
    reverb.connect(rv).connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.5; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setAmbience(act);
    schedT = ctx.currentTime + 0.2;
    timer = setInterval(schedule, 90);
}
export const audioReady = () => !!ctx;

function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
}

export function setVolumes(music, sfx) {
    musicVol = music; sfxVol = sfx;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(music * 0.5, ctx.currentTime, 0.2);
    sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05);
    ambBus.gain.setTargetAtTime(0.25 + music * 0.45, ctx.currentTime, 0.2);
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05); }
export function setMood(m, a = act) {
    const changed = a !== act;
    mood = m; act = a;
    if (ctx && changed) setAmbience(a);
}

// ------------------------------------------------------------------ voices
function tone({ f, type = 'sine', t = 0, dur = 0.3, vol = 0.2, attack = 0.005, bus = sfxBus, rev = 0.25, glide = 0, vib = 0, vibRate = 6, lp = 0 }) {
    if (!ctx || !bus) return;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), now + dur);
    if (vib) {
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = vibRate; lg.gain.value = f * vib;
        l.connect(lg).connect(o.frequency);
        l.start(now); l.stop(now + dur + 0.1);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; node.connect(f2); node = f2; }
    node.connect(g);
    g.connect(bus);
    if (rev && reverb) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(reverb); }
    o.start(now); o.stop(now + dur + 0.05);
}

function noise({ t = 0, dur = 0.2, vol = 0.2, type = 'bandpass', f = 1000, q = 1, to = 0, bus = sfxBus, attack = 0.003, rev = 0.1 }) {
    if (!ctx || !bus) return;
    const now = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
    if (to) fl.frequency.exponentialRampToValueAtTime(to, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(fl).connect(g).connect(bus);
    if (rev && reverb) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(reverb); }
    src.start(now, Math.random() * 1.5); src.stop(now + dur + 0.05);
}

/** A soft piano-like note: a sine with a quick triangle overtone and a long decay. */
function piano(n, t, dur = 1.2, vol = 0.05, bus = musicBus) {
    tone({ f: midi(n), t, dur, vol, type: 'sine', attack: 0.004, bus, rev: 0.5 });
    tone({ f: midi(n) * 2.003, t, dur: dur * 0.35, vol: vol * 0.35, type: 'triangle', attack: 0.002, bus, rev: 0.4 });
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
/** Throttle a sound so a crowd of events doesn't become a wall of noise. */
function gate(key, sec) {
    if (!ctx) return false;
    const now = ctx.currentTime;
    if ((lastAt[key] || 0) + sec > now) return false;
    lastAt[key] = now;
    return true;
}

// ------------------------------------------------------------------ effects
export const sfx = {
    ui() { tone({ f: 880, dur: 0.07, vol: 0.1, type: 'triangle', glide: 1.4 }); },
    tab() { tone({ f: 660, dur: 0.06, vol: 0.08, type: 'triangle' }); tone({ f: 990, t: 0.04, dur: 0.06, vol: 0.06, type: 'triangle' }); },
    error() { tone({ f: 260, dur: 0.18, vol: 0.12, type: 'triangle', glide: 0.75 }); tone({ f: 200, t: 0.1, dur: 0.22, vol: 0.1, type: 'triangle', glide: 0.75 }); },
    build() {
        for (let i = 0; i < 3; i++) { noise({ t: i * 0.09, dur: 0.05, vol: 0.25, type: 'bandpass', f: 1800, q: 2 }); tone({ f: 220 + i * 30, t: i * 0.09, dur: 0.07, vol: 0.08, type: 'square', lp: 1200 }); }
        [74, 78, 81].forEach((n, i) => tone({ f: midi(n), t: 0.3 + i * 0.07, dur: 0.3, vol: 0.06, type: 'triangle', rev: 0.4 }));
    },
    upgrade() { [69, 74, 78, 81, 86].forEach((n, i) => tone({ f: midi(n), t: i * 0.06, dur: 0.35, vol: 0.07, type: 'triangle', rev: 0.5 })); },
    packUp() { noise({ dur: 0.3, vol: 0.15, type: 'bandpass', f: 600, to: 1800, q: 1 }); tone({ f: 500, dur: 0.25, vol: 0.06, type: 'triangle', glide: 0.6 }); },
    heal() { if (!gate('heal', 0.12)) return; tone({ f: midi(84), dur: 0.25, vol: 0.05, type: 'sine', rev: 0.5 }); tone({ f: midi(88), t: 0.06, dur: 0.3, vol: 0.04, type: 'sine', rev: 0.5 }); },
    cureSick() { if (!gate('vial', 0.15)) return; noise({ dur: 0.12, vol: 0.12, type: 'highpass', f: 3500 }); [86, 90, 93].forEach((n, i) => tone({ f: midi(n), t: 0.05 + i * 0.05, dur: 0.25, vol: 0.035, type: 'sine', rev: 0.6 })); },
    soup() { if (!gate('soup', 0.2)) return; tone({ f: 420, dur: 0.12, vol: 0.06, type: 'sine', glide: 1.5 }); tone({ f: midi(79), t: 0.08, dur: 0.3, vol: 0.04, type: 'triangle', rev: 0.4 }); },
    warm() { if (!gate('warm', 0.4)) return; noise({ dur: 0.5, vol: 0.06, type: 'lowpass', f: 900 }); tone({ f: midi(72), dur: 0.5, vol: 0.04, type: 'sine', rev: 0.6 }); },
    splint() { if (!gate('splint', 0.15)) return; noise({ dur: 0.04, vol: 0.2, type: 'bandpass', f: 1400, q: 3 }); noise({ t: 0.08, dur: 0.04, vol: 0.18, type: 'bandpass', f: 1700, q: 3 }); tone({ f: midi(81), t: 0.12, dur: 0.25, vol: 0.05, type: 'triangle' }); },
    calm() { if (!gate('calm', 0.6)) return; [76, 79, 83].forEach((n, i) => tone({ f: midi(n), t: i * 0.1, dur: 0.6, vol: 0.035, type: 'sawtooth', lp: 1800, vib: 0.006, attack: 0.06, rev: 0.6 })); },
    revive() { [67, 71, 74, 79].forEach((n, i) => tone({ f: midi(n), t: i * 0.08, dur: 0.4, vol: 0.07, type: 'triangle', rev: 0.5 })); },
    carry() { if (!gate('carry', 0.4)) return; tone({ f: 300, dur: 0.12, vol: 0.06, type: 'triangle', glide: 1.6 }); },
    saved(thriving) {
        if (!gate('saved', 0.18)) return;
        tone({ f: midi(thriving ? 79 : 76), dur: 1.2, vol: 0.06, type: 'sine', rev: 0.8 });
        tone({ f: midi(thriving ? 86 : 83), t: 0.05, dur: 1.0, vol: 0.03, type: 'sine', rev: 0.8 });
        if (thriving) tone({ f: midi(91), t: 0.12, dur: 0.8, vol: 0.025, type: 'sine', rev: 0.8 });
    },
    collapse() { tone({ f: 180, dur: 0.4, vol: 0.12, type: 'sine', glide: 0.6 }); noise({ dur: 0.15, vol: 0.12, type: 'lowpass', f: 500 }); tone({ f: midi(64), t: 0.1, dur: 0.6, vol: 0.04, type: 'triangle', glide: 0.94, rev: 0.5 }); },
    lost() { [69, 72, 76, 81].forEach((n, i) => tone({ f: midi(n), t: i * 0.22, dur: 1.4, vol: 0.05, type: 'sine', rev: 0.9 })); },
    moan() {
        if (!gate('moan', 2.2)) return;
        const f = 90 + Math.random() * 50;
        tone({ f, dur: 1.4, vol: 0.05, type: 'sawtooth', glide: 0.8, lp: 420, attack: 0.3, rev: 0.6, bus: ambBus });
        noise({ dur: 1.2, vol: 0.03, type: 'bandpass', f: 300, q: 2, attack: 0.3, bus: ambBus, rev: 0.4 });
    },
    scratch() { if (!gate('scratch', 0.15)) return; noise({ dur: 0.1, vol: 0.18, type: 'bandpass', f: 2400, to: 900, q: 1.5 }); tone({ f: 150, dur: 0.12, vol: 0.06, type: 'sine', glide: 0.7 }); },
    spit() { if (!gate('spit', 0.3)) return; noise({ dur: 0.18, vol: 0.12, type: 'bandpass', f: 600, to: 1500, q: 3 }); },
    howl() { if (!gate('howl', 1)) return; tone({ f: 220, dur: 1.1, vol: 0.07, type: 'sawtooth', glide: 1.6, lp: 900, attack: 0.15, rev: 0.7, vib: 0.02 }); },
    flare() { noise({ dur: 0.5, vol: 0.18, type: 'highpass', f: 1200, to: 4000 }); tone({ f: midi(88), dur: 0.6, vol: 0.04, type: 'sine', rev: 0.7 }); },
    bell() { [0, 0.02].forEach((t, i) => { tone({ f: midi(67) * (i ? 2.76 : 1), t, dur: 2.2, vol: i ? 0.04 : 0.11, type: 'sine', rev: 0.9 }); }); tone({ f: midi(79), dur: 1.6, vol: 0.04, type: 'sine', rev: 0.8 }); },
    deploy() { [72, 76, 79].forEach((n, i) => tone({ f: midi(n), t: i * 0.05, dur: 0.3, vol: 0.06, type: 'square', lp: 2200 })); noise({ t: 0.05, dur: 0.3, vol: 0.06, type: 'bandpass', f: 1500, q: 0.6 }); },
    recall() { tone({ f: midi(76), dur: 0.2, vol: 0.06, type: 'triangle' }); tone({ f: midi(72), t: 0.1, dur: 0.25, vol: 0.06, type: 'triangle' }); },
    spray() { if (!gate('spray', 0.3)) return; noise({ dur: 0.35, vol: 0.12, type: 'highpass', f: 2600 }); },
    beam() { if (!gate('beam', 0.3)) return; tone({ f: 880, dur: 0.3, vol: 0.05, type: 'sawtooth', glide: 1.5, lp: 3000 }); },
    toss() { if (!gate('toss', 0.12)) return; tone({ f: 1200, dur: 0.06, vol: 0.025, type: 'triangle', glide: 1.4 }); },
    cure() {
        if (!gate('cure', 0.1)) return;
        [79, 83, 86, 91].forEach((n, i) => tone({ f: midi(n), t: i * 0.04, dur: 0.5, vol: 0.04, type: 'sine', rev: 0.7 }));
    },
    slam() { tone({ f: 70, dur: 0.6, vol: 0.25, type: 'sine', glide: 0.5 }); noise({ dur: 0.4, vol: 0.25, type: 'lowpass', f: 300 }); },
    wail() { tone({ f: 600, dur: 1.4, vol: 0.06, type: 'sawtooth', glide: 0.45, lp: 1600, vib: 0.03, attack: 0.1, rev: 0.9 }); tone({ f: 640, dur: 1.4, vol: 0.05, type: 'sawtooth', glide: 0.42, lp: 1600, vib: 0.03, attack: 0.1, rev: 0.9 }); },
    glob() { noise({ dur: 0.3, vol: 0.16, type: 'bandpass', f: 400, to: 900, q: 4 }); },
    boss() { tone({ f: 55, dur: 2.4, vol: 0.18, type: 'sawtooth', lp: 300, attack: 0.3, rev: 0.8 }); tone({ f: 82, t: 0.2, dur: 2.2, vol: 0.12, type: 'sawtooth', lp: 300, attack: 0.3, rev: 0.8 }); },
    bossCured() { [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => tone({ f: midi(n), t: i * 0.09, dur: 1.6, vol: 0.06, type: 'sine', rev: 0.9 })); },
    waveStart(boss) { if (boss) this.boss(); else { tone({ f: midi(62), dur: 1.2, vol: 0.07, type: 'triangle', attack: 0.08, rev: 0.6 }); tone({ f: midi(69), t: 0.25, dur: 1.2, vol: 0.06, type: 'triangle', attack: 0.08, rev: 0.6 }); } },
    waveEnd() { [74, 78, 81, 86].forEach((n, i) => tone({ f: midi(n), t: i * 0.1, dur: 0.8, vol: 0.06, type: 'triangle', rev: 0.6 })); },
    victory() { [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => piano(n, i * 0.12, 2, 0.08, sfxBus)); },
    defeat() { [69, 65, 62, 57].forEach((n, i) => piano(n, i * 0.3, 2, 0.06, sfxBus)); },
    letter() { tone({ f: midi(88), dur: 0.4, vol: 0.04, type: 'sine', rev: 0.6 }); },
    star() { [84, 88, 91].forEach((n, i) => tone({ f: midi(n), t: i * 0.05, dur: 0.5, vol: 0.06, type: 'triangle', rev: 0.6 })); },
};

// ------------------------------------------------------------------ ambience
function setAmbience(a) {
    if (!ctx) return;
    for (const n of ambNodes) { try { n.stop(); } catch { /* already stopped */ } }
    ambNodes = [];
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = a === 3 ? 'bandpass' : 'lowpass';
    lp.frequency.value = a === 3 ? 2600 : a === 2 ? 380 : 520;
    if (a === 3) lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = a === 3 ? 0.08 : 0.04;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = a === 3 ? 0.01 : 0.025;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(ambBus);
    src.start(); lfo.start();
    ambNodes.push(src, lfo);
}
let birdT = 3;
function ambienceTick() {
    birdT -= 0.09;
    if (birdT > 0) return;
    birdT = 6 + Math.random() * 10;
    if (act === 1 && mood !== 'boss') for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone({ f: 2400 + Math.random() * 900, t: i * 0.13, dur: 0.09, vol: 0.015, type: 'sine', glide: 1.3, bus: ambBus, rev: 0.4 });
    if (act === 2) tone({ f: midi(96 + Math.floor(Math.random() * 5)), dur: 1.4, vol: 0.008, type: 'sine', bus: ambBus, rev: 0.9 });
}

// ------------------------------------------------------------------ music
// Chords as MIDI notes; melody scales; tempo (eighth-note seconds). Hopeful, never ominous.
const SONGS = {
    title:  { beat: 60 / 76 / 2, chords: [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]], scale: [74, 76, 78, 81, 83, 86, 88], calm: true },
    1:      { beat: 60 / 84 / 2, chords: [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]], scale: [74, 76, 78, 81, 83, 86, 88] },
    2:      { beat: 60 / 72 / 2, chords: [[57, 61, 64], [52, 56, 59], [54, 57, 61], [50, 54, 57]], scale: [69, 71, 73, 76, 78, 81, 83], calm: true },
    3:      { beat: 60 / 78 / 2, chords: [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]], scale: [65, 67, 69, 72, 74, 77, 79] },
    boss:   { beat: 60 / 92 / 2, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], scale: [69, 72, 74, 76, 79, 81, 84], drum: true },
    win:    { beat: 60 / 80 / 2, chords: [[62, 66, 69], [55, 59, 62], [57, 61, 64], [62, 66, 69]], scale: [74, 76, 78, 81, 83, 86], calm: true },
};
let melIdx = 3;

function schedule() {
    if (!ctx || ctx.state !== 'running') { if (ctx) schedT = Math.max(schedT, ctx.currentTime + 0.1); return; }
    ambienceTick();
    const song = SONGS[mood === 'play' ? act : mood] || SONGS[1];
    while (schedT < ctx.currentTime + 0.35) {
        playStep(song, step, schedT - ctx.currentTime);
        schedT += song.beat;
        step++;
    }
}

function playStep(S, s, t) {
    if (musicVol <= 0.001) return;
    const bar = Math.floor(s / 8), pos = s % 8;
    const chord = S.chords[Math.floor(bar / 2) % S.chords.length];
    const B = S.beat;
    if (pos === 0 && bar % 2 === 0) for (const n of chord) {
        tone({ f: midi(n), t, dur: B * 16, vol: 0.02, type: 'triangle', attack: 0.8, bus: musicBus, rev: 0.7, lp: 1300 });
        tone({ f: midi(n) * 1.004, t, dur: B * 16, vol: 0.012, type: 'sawtooth', attack: 1.2, bus: musicBus, rev: 0.7, lp: 700 });
    }
    if (pos === 0 || pos === 4) tone({ f: midi(chord[0] - 12), t, dur: B * 3.5, vol: S.calm ? 0.04 : 0.06, type: 'sine', attack: 0.01, bus: musicBus, rev: 0.1 });
    if (S.drum && (pos === 0 || pos === 3 || pos === 6)) { tone({ f: 70, t, dur: 0.3, vol: 0.09, type: 'sine', glide: 0.5, bus: musicBus, rev: 0.2 }); }
    if (S.drum && pos === 4) noise({ t, dur: 0.12, vol: 0.03, type: 'bandpass', f: 1200, q: 0.8, bus: musicBus, rev: 0.3 });
    if (!S.calm && pos % 2 === 1) noise({ t, dur: 0.04, vol: 0.008, type: 'highpass', f: 6500, bus: musicBus, rev: 0 });
    if (pos === 2 || pos === 6) chord.forEach((n, i) => tone({ f: midi(n + 12), t: t + i * 0.03, dur: 0.6, vol: 0.012, type: 'triangle', bus: musicBus, rev: 0.4, lp: 2400 }));
    // melody: chord tones on strong beats, a wander on weak ones, room to breathe
    const play = pos % 2 === 0 ? Math.random() < (S.calm ? 0.45 : 0.6) : Math.random() < (S.calm ? 0.1 : 0.2);
    if (play) {
        melIdx = Math.max(0, Math.min(S.scale.length - 1, melIdx + Math.floor(Math.random() * 5) - 2));
        let n = S.scale[melIdx];
        if (pos === 0) { const ct = chord.map((c) => c + 12); n = ct.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a), ct[0]); }
        piano(n, t, 1.4, 0.04);
    }
}
