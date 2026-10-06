/**
 * audio.js — every sound in Tootle Isles is synthesised with Web Audio.
 *
 * Music: a gentle generative tune — a warm pad on a four-chord loop, a soft plucked bass, a music-box
 * melody that wanders over a pentatonic scale, a ukulele-ish strum and a whisper of shaker. At night
 * it thins out to pad and music box. Ambience: the sea, the odd seagull by day, crickets at night.
 * Effects: brick clicks, track clacks, whistles and horns for each kind of engine, station chimes,
 * a chuff for the train you're riding with, and a little voice for every thing you can tap.
 */

let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, reverb = null, noiseBuf = null;
let musicVol = 0.6, sfxVol = 0.8, muted = false;
let nightAmt = 0;
let schedT = 0, step = 0, timer = null;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(2.6, 2.8);
    const rv = ctx.createGain(); rv.gain.value = 0.35;
    reverb.connect(rv).connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.55; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = musicVol * 0.5 + 0.1; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbience();
    schedT = ctx.currentTime + 0.2;
    timer = setInterval(schedule, 90);
}

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
    musicBus.gain.setTargetAtTime(music * 0.55, ctx.currentTime, 0.2);
    ambBus.gain.setTargetAtTime(music * 0.5 + 0.1 * (sfx > 0 ? 1 : 0), ctx.currentTime, 0.2);
    sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05);
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05); }
export function setNight(n) { nightAmt = n; }
export const audioReady = () => !!ctx;

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

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ------------------------------------------------------------------ effects
export const sfx = {
    ui() { tone({ f: 880, dur: 0.08, vol: 0.12, type: 'triangle', glide: 1.4 }); },
    pop() { tone({ f: 520, dur: 0.12, vol: 0.16, type: 'sine', glide: 2.2 }); },
    tab() { tone({ f: 660, dur: 0.06, vol: 0.1, type: 'triangle' }); tone({ f: 990, t: 0.04, dur: 0.06, vol: 0.08, type: 'triangle' }); },
    click() {
        // a brick snapping on: two tight clicks and a bright tick
        noise({ dur: 0.03, vol: 0.35, type: 'highpass', f: 2500, rev: 0.05 });
        noise({ t: 0.045, dur: 0.035, vol: 0.28, type: 'highpass', f: 3200, rev: 0.05 });
        tone({ f: 1320, t: 0.04, dur: 0.07, vol: 0.06, type: 'square', lp: 4000 });
    },
    place() { this.click(); tone({ f: midi(72), t: 0.09, dur: 0.18, vol: 0.09, type: 'triangle' }); tone({ f: midi(79), t: 0.15, dur: 0.22, vol: 0.08, type: 'triangle' }); },
    clack(i = 0) {
        noise({ dur: 0.04, vol: 0.22, type: 'bandpass', f: 2200 + (i % 3) * 300, q: 3, rev: 0.05 });
        tone({ f: 380 + (i % 4) * 40, dur: 0.06, vol: 0.07, type: 'square', lp: 1800 });
    },
    erase() { tone({ f: 600, dur: 0.18, vol: 0.12, type: 'triangle', glide: 0.4 }); noise({ dur: 0.12, vol: 0.12, type: 'lowpass', f: 900 }); },
    dust() { noise({ dur: 0.35, vol: 0.28, type: 'lowpass', f: 700, to: 200 }); tone({ f: 140, dur: 0.2, vol: 0.12, type: 'sine', glide: 0.5 }); },
    paint() { noise({ dur: 0.16, vol: 0.12, type: 'bandpass', f: 900, to: 2600, q: 1.5 }); },
    switch() { tone({ f: 160, dur: 0.12, vol: 0.18, type: 'square', lp: 900 }); noise({ t: 0.02, dur: 0.05, vol: 0.2, type: 'highpass', f: 2000 }); tone({ f: 880, t: 0.06, dur: 0.12, vol: 0.06, type: 'triangle' }); },
    error() { tone({ f: 220, dur: 0.22, vol: 0.14, type: 'triangle', glide: 0.7 }); tone({ f: 180, t: 0.12, dur: 0.25, vol: 0.12, type: 'triangle', glide: 0.7 }); },
    whistle(kind = 'steam') {
        if (kind === 'steam' || kind === 'tank') {
            const base = kind === 'tank' ? 1.25 : 1;
            for (const n of [0, 4, 7]) tone({ f: midi(74 + n) * base, dur: 0.75, vol: 0.07, type: 'sine', attack: 0.06, vib: 0.006, vibRate: 7, rev: 0.4 });
            noise({ dur: 0.7, vol: 0.06, type: 'bandpass', f: 2600 * base, q: 2, attack: 0.05, rev: 0.3 });
            if (kind === 'tank') for (const n of [0, 4, 7]) tone({ f: midi(74 + n) * base, t: 0.85, dur: 0.35, vol: 0.06, type: 'sine', attack: 0.04, rev: 0.4 });
        } else if (kind === 'diesel') {
            for (const [t, d] of [[0, 0.45], [0.55, 0.7]]) { tone({ f: 233, t, dur: d, vol: 0.08, type: 'sawtooth', attack: 0.03, lp: 1400 }); tone({ f: 311, t, dur: d, vol: 0.07, type: 'sawtooth', attack: 0.03, lp: 1400 }); }
        } else if (kind === 'bullet') {
            [76, 81, 84].forEach((n, i) => tone({ f: midi(n), t: i * 0.14, dur: 0.6, vol: 0.09, type: 'sine', rev: 0.5 }));
        } else {
            for (const t of [0, 0.22]) { tone({ f: 1568, t, dur: 0.6, vol: 0.08, type: 'sine', rev: 0.5 }); tone({ f: 3920, t, dur: 0.3, vol: 0.03, type: 'sine' }); }
        }
    },
    chuff(v = 1) { noise({ dur: 0.12, vol: 0.05 + Math.min(0.06, v * 0.02), type: 'lowpass', f: 700, to: 300, rev: 0.05 }); },
    arrive() { tone({ f: midi(76), dur: 0.6, vol: 0.09, type: 'sine', rev: 0.6 }); tone({ f: midi(72), t: 0.32, dur: 0.8, vol: 0.09, type: 'sine', rev: 0.6 }); },
    board(n = 1) { for (let i = 0; i < Math.min(4, n); i++) tone({ f: midi(79 + i * 2), t: i * 0.07, dur: 0.12, vol: 0.06, type: 'triangle' }); },
    trainPlaced() { this.click(); [67, 71, 74, 79].forEach((n, i) => tone({ f: midi(n), t: 0.08 + i * 0.07, dur: 0.2, vol: 0.08, type: 'triangle' })); },
    sticker() { [72, 76, 79, 84, 88].forEach((n, i) => tone({ f: midi(n), t: i * 0.08, dur: 0.4, vol: 0.09, type: 'triangle', rev: 0.5 })); tone({ f: midi(96), t: 0.42, dur: 0.6, vol: 0.05, type: 'sine', rev: 0.6 }); },
    hello() {
        const n = 2 + Math.floor(Math.random() * 3), base = 300 + Math.random() * 250;
        for (let i = 0; i < n; i++) {
            const f = base * (1 + (Math.random() - 0.3) * 0.5);
            tone({ f, t: i * 0.11, dur: 0.09, vol: 0.08, type: 'triangle', glide: 1.2, lp: 2200 });
            tone({ f: f * 2.4, t: i * 0.11, dur: 0.07, vol: 0.03, type: 'sine' });
        }
    },
    boop(kind) {
        switch (kind) {
            case 'sheep': tone({ f: 420, dur: 0.6, vol: 0.09, type: 'sawtooth', vib: 0.06, vibRate: 11, lp: 1600, glide: 0.85 }); break;
            case 'cow': tone({ f: 150, dur: 0.9, vol: 0.12, type: 'sawtooth', glide: 0.7, lp: 700, attack: 0.08 }); break;
            case 'duck': for (const t of [0, 0.16]) tone({ f: 600, t, dur: 0.12, vol: 0.1, type: 'square', glide: 0.6, lp: 1600 }); break;
            case 'whale': tone({ f: 180, dur: 1.4, vol: 0.12, type: 'sine', glide: 2.2, attack: 0.2, rev: 0.8 }); noise({ t: 0.3, dur: 0.6, vol: 0.08, type: 'highpass', f: 1500 }); break;
            case 'tree': noise({ dur: 0.45, vol: 0.12, type: 'bandpass', f: 3000, q: 0.8, attack: 0.05 }); break;
            case 'bell': [0, 0.5].forEach((t) => tone({ f: midi(67), t, dur: 1.2, vol: 0.1, type: 'sine', rev: 0.7 })); break;
            case 'splash': noise({ dur: 0.4, vol: 0.15, type: 'bandpass', f: 1200, to: 400, q: 0.7 }); break;
            case 'house': for (const t of [0, 0.14]) { tone({ f: 120, t, dur: 0.1, vol: 0.2, type: 'sine', glide: 0.6 }); noise({ t, dur: 0.05, vol: 0.12, type: 'lowpass', f: 600 }); } break;
            case 'shop': [84, 88].forEach((n, i) => tone({ f: midi(n), t: i * 0.1, dur: 0.5, vol: 0.08, type: 'sine', rev: 0.5 })); break;
            case 'whirl': tone({ f: 300, dur: 0.6, vol: 0.08, type: 'triangle', glide: 2.5 }); break;
            case 'fun': [72, 76, 79, 76, 72].forEach((n, i) => tone({ f: midi(n), t: i * 0.09, dur: 0.15, vol: 0.07, type: 'square', lp: 2000 })); break;
            default: tone({ f: 330, dur: 0.25, vol: 0.12, type: 'sine', glide: 2.4 });
        }
    },
};

// ------------------------------------------------------------------ ambience
let waveGain = null, cricketT = 0, gullT = 4;
function startAmbience() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    waveGain = ctx.createGain(); waveGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.11; lg.gain.value = 0.035;
    lfo.connect(lg).connect(waveGain.gain);
    src.connect(lp).connect(waveGain).connect(ambBus);
    src.start(); lfo.start();
}

function ambienceTick(t) {
    gullT -= 0.09;
    if (gullT <= 0) {
        gullT = 9 + Math.random() * 14;
        if (nightAmt < 0.5) for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone({ f: 1500 + Math.random() * 300, t: i * 0.22, dur: 0.2, vol: 0.025, type: 'sine', glide: 0.62, bus: ambBus, rev: 0.4 });
    }
    if (nightAmt > 0.5) {
        cricketT -= 0.09;
        if (cricketT <= 0) {
            cricketT = 0.5 + Math.random() * 0.8;
            for (let i = 0; i < 3; i++) tone({ f: 4200 + Math.random() * 300, t: i * 0.05, dur: 0.03, vol: 0.012 * nightAmt, type: 'sine', bus: ambBus, rev: 0.2 });
        }
    }
    void t;
}

// ------------------------------------------------------------------ music
const BEAT = 60 / 88 / 2;   // eighth notes at 88 bpm
const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];   // C, Am, F, G
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
let melIdx = 3;

function schedule() {
    if (!ctx || ctx.state !== 'running') { if (ctx) schedT = Math.max(schedT, ctx.currentTime + 0.1); return; }
    ambienceTick(ctx.currentTime);
    while (schedT < ctx.currentTime + 0.35) {
        playStep(step, schedT - ctx.currentTime);
        schedT += BEAT;
        step++;
    }
}

function playStep(s, t) {
    if (musicVol <= 0.001) return;
    const bar = Math.floor(s / 8), pos = s % 8;
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const calm = nightAmt > 0.5;
    if (pos === 0 && bar % 2 === 0) for (const n of chord) tone({ f: midi(n), t, dur: BEAT * 16, vol: 0.022, type: 'triangle', attack: 0.6, bus: musicBus, rev: 0.6, lp: 1400 });
    if (!calm && (pos === 0 || pos === 4)) tone({ f: midi(chord[0] - 12), t, dur: BEAT * 3, vol: 0.07, type: 'sine', attack: 0.01, bus: musicBus, rev: 0.1 });
    if (!calm && (pos === 2 || pos === 6)) chord.forEach((n, i) => tone({ f: midi(n + 12), t: t + i * 0.018, dur: 0.28, vol: 0.022, type: 'triangle', bus: musicBus, rev: 0.2, lp: 2600 }));
    if (!calm && pos % 2 === 1) noise({ t, dur: 0.05, vol: 0.012, type: 'highpass', f: 6000, bus: musicBus, rev: 0 });
    // music box melody: chord tones on strong beats, a wander on weak ones, plenty of rests
    const play = pos % 2 === 0 ? Math.random() < (calm ? 0.35 : 0.6) : Math.random() < (calm ? 0.08 : 0.22);
    if (play) {
        melIdx = Math.max(0, Math.min(PENTA.length - 1, melIdx + Math.floor(Math.random() * 5) - 2));
        let n = PENTA[melIdx];
        if (pos === 0) { const ct = chord.map((c) => c + 12); n = ct.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a), ct[0]); }
        tone({ f: midi(n), t, dur: 0.9, vol: 0.035, type: 'sine', bus: musicBus, rev: 0.55 });
        tone({ f: midi(n + 12) * 1.003, t, dur: 0.35, vol: 0.012, type: 'sine', bus: musicBus, rev: 0.5 });
    }
}
