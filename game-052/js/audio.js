// All sound is synthesised. Three generative radio stations, the rain, the
// engine and tyre hiss, and the small sounds: blinker, door chime, thunder,
// spinner fly-bys, a distant siren.
//
// The radio is a step sequencer scheduled ahead on the audio clock. Each
// "track" picks a key and a chord progression, plays 24–32 bars, then a new
// one starts with a new (invented) title. Everything passes through a
// "broadcast" chain: tape wow on every oscillator, a band-limited filter,
// a little reverb and delay, and vinyl crackle on the lo-fi station.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export const STATIONS = [
    { id: 'wave', name: 'NIGHTWAVE', freq: '88.3', bpm: 86, swing: 0, scale: MINOR,
        progs: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 6, 0, 0], [0, 6, 5, 6], [0, 2, 5, 6]] },
    { id: 'lofi', name: 'RAIN FM', freq: '101.9', bpm: 74, swing: 0.17, scale: MAJOR,
        progs: [[1, 4, 0, 5], [3, 2, 1, 0], [5, 1, 4, 0], [3, 4, 2, 5], [0, 5, 1, 4]] },
    { id: 'drift', name: 'STATIC DREAMS', freq: '76.0', bpm: 58, swing: 0, scale: MINOR,
        progs: [[0, 5, 3, 4], [0, 6, 5, 4], [0, 3, 0, 5], [5, 3, 0, 6]] },
    { id: 'off', name: 'RADIO OFF', freq: '--.-' },
];

const ADJ = ['Neon', 'Chrome', 'Midnight', 'Electric', 'Velvet', 'Static', 'Paper', 'Golden', 'Hollow', 'Silent', 'Last', 'Blue', 'Crimson', 'Wet', 'Distant', 'Slow', 'Analog', 'Sodium'];
const NOUN = ['Boulevard', 'Heart', 'Skyline', 'Memory', 'Overpass', 'Signal', 'Lanterns', 'Echo', 'Tide', 'Arcade', 'Satellite', 'Afterglow', 'Rain', 'Taillights', 'Avenue', 'Pyramid', 'Ferry', 'Motel', 'Static', 'Window'];
const ARTISTS = ['Kiri Ono', 'DATAGHOST', 'Lune Arcade', 'Mira Vance', 'The Overpass Club', 'Sato & the Static', 'VHS Lagoon', 'Neon Monk', 'Tokyo Driftwood', 'Holo Bloom', 'Night Clerk', 'Cassette Saints', 'Juno Rain', 'Polygon Hearts'];

function trackName(r) {
    const a = ADJ[Math.floor(r() * ADJ.length)], n = NOUN[Math.floor(r() * NOUN.length)], n2 = NOUN[Math.floor(r() * NOUN.length)];
    const forms = [
        () => `${a} ${n}`,
        () => `${n} on ${a === 'Wet' ? 'Chrome' : n2}`,
        () => `${a} ${n} (Night Mix)`,
        () => `${n}s in the ${n2}`,
        () => `Under the ${a} ${n}`,
        () => `${a} ${n2}, 3 AM`,
    ];
    return { title: forms[Math.floor(r() * forms.length)](), artist: ARTISTS[Math.floor(r() * ARTISTS.length)] };
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.station = 0;
        this.musicVol = 0.7;
        this.sfxVol = 0.8;
        this.onTrack = null;
        this._r = Math.random;
        this.track = null;
    }

    get ready() { return !!this.ctx; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(comp).connect(ctx.destination);

        this.musicOut = ctx.createGain();
        this.musicOut.gain.value = this.musicVol;
        this.musicOut.connect(this.master);
        this.sfxOut = ctx.createGain();
        this.sfxOut.gain.value = this.sfxVol;
        this.sfxOut.connect(this.master);

        // broadcast chain
        this.radioIn = ctx.createGain();
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 75;
        this.radioLP = ctx.createBiquadFilter(); this.radioLP.type = 'lowpass'; this.radioLP.frequency.value = 6000; this.radioLP.Q.value = 0.4;
        this.radioGain = ctx.createGain();
        this.radioIn.connect(hp).connect(this.radioLP).connect(this.radioGain).connect(this.musicOut);

        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = this.noise.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

        // reverb
        this.verb = ctx.createConvolver();
        this.verb.buffer = this._impulse(3.2, 2.4);
        this.verbSend = ctx.createGain();
        const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
        this.verbSend.connect(this.verb).connect(verbOut).connect(this.radioIn);
        // delay
        this.delaySend = ctx.createGain();
        this.delay = ctx.createDelay(2);
        const fb = ctx.createGain(); fb.gain.value = 0.38;
        const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
        this.delaySend.connect(this.delay);
        this.delay.connect(dlp).connect(fb).connect(this.delay);
        dlp.connect(this.radioIn);
        this.delay.delayTime.value = 0.5;

        // tape wow
        this.wow = ctx.createOscillator();
        this.wow.frequency.value = 0.45;
        this.wowAmt = ctx.createGain();
        this.wowAmt.gain.value = 7;
        this.wow.connect(this.wowAmt);
        this.wow.start();

        // buses with side-chain ducking
        this.duck = ctx.createGain();
        this.duck.connect(this.radioIn);
        this.duck.connect(this.verbSend);
        this.drumBus = ctx.createGain();
        this.drumBus.connect(this.radioIn);

        // crackle
        const cb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const cd = cb.getChannelData(0);
        for (let i = 0; i < cd.length; i++) {
            cd[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.7 : 0);
        }
        this.crackle = ctx.createBufferSource();
        this.crackle.buffer = cb; this.crackle.loop = true;
        this.crackleGain = ctx.createGain(); this.crackleGain.gain.value = 0;
        const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 5000;
        this.crackle.connect(clp).connect(this.crackleGain).connect(this.radioIn);
        this.crackle.start();

        this._ambience();
        this.setStation(this.station, true);
        this._timer = setInterval(() => this._schedule(), 30);
    }

    _impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = b.getChannelData(c);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        }
        return b;
    }

    setVolumes(music, sfx) {
        this.musicVol = music; this.sfxVol = sfx;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.musicOut.gain.setTargetAtTime(music, t, 0.05);
        this.sfxOut.gain.setTargetAtTime(sfx, t, 0.05);
    }

    // ------------------------------------------------------------------
    // Ambience: rain, tyres, engine, city hum
    // ------------------------------------------------------------------
    _loopNoise(filterType, freq, q = 0.7) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise; src.loop = true;
        src.playbackRate.value = 0.7 + Math.random() * 0.6;
        const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(this.sfxOut);
        src.start(0, Math.random() * 1.5);
        return { src, f, g };
    }

    _ambience() {
        const ctx = this.ctx;
        this.rainLow = this._loopNoise('lowpass', 900);
        this.rainHigh = this._loopNoise('highpass', 4200);
        this.hum = this._loopNoise('lowpass', 140);
        this.tyres = this._loopNoise('bandpass', 1300, 0.6);
        // engine: an electric motor's whine over a low drive rumble
        const e1 = ctx.createOscillator(); e1.type = 'sawtooth';
        const e2 = ctx.createOscillator(); e2.type = 'triangle';
        const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 300;
        const eg = ctx.createGain(); eg.gain.value = 0;
        e1.connect(ef); e2.connect(ef); ef.connect(eg).connect(this.sfxOut);
        e1.start(); e2.start();
        this.engine = { e1, e2, ef, eg };
        // rain drops on the roof
        this._dropAcc = 0;
    }

    update(dt, { speed = 0, rain = 0.5, inside = false, parked = false }) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const k = 0.25;
        const muf = inside ? 0.55 : 1;
        this.rainLow.g.gain.setTargetAtTime(rain * 0.16 * (inside ? 1.3 : 1), t, k);
        this.rainLow.f.frequency.setTargetAtTime(inside ? 500 : 1100, t, k);
        this.rainHigh.g.gain.setTargetAtTime(rain * 0.045 * muf, t, k);
        this.hum.g.gain.setTargetAtTime(0.08, t, k);
        const sp = Math.min(speed / 40, 1);
        this.tyres.g.gain.setTargetAtTime(sp * (0.05 + rain * 0.07) * muf, t, k);
        this.tyres.f.frequency.setTargetAtTime(700 + sp * 1400, t, k);
        const e = this.engine;
        e.e1.frequency.setTargetAtTime(32 + speed * 1.1, t, 0.1);
        e.e2.frequency.setTargetAtTime(180 + speed * 9, t, 0.1);
        e.ef.frequency.setTargetAtTime(220 + speed * 14, t, 0.1);
        e.eg.gain.setTargetAtTime(parked ? 0.008 : 0.025 + sp * 0.035, t, 0.2);
        // individual drops tapping the roof when you're inside the car
        if (inside && rain > 0.1) {
            this._dropAcc += dt * rain * 22;
            while (this._dropAcc > 1) {
                this._dropAcc -= 1;
                this._tick(t + Math.random() * 0.05, 2500 + Math.random() * 3000, 0.012 + Math.random() * 0.02, 0.02);
            }
        }
    }

    _tick(t, freq, vol, dur) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        src.connect(f).connect(g).connect(this.sfxOut);
        src.start(t, Math.random() * 1.5, dur + 0.02);
    }

    // ------------------------------------------------------------------
    // Sound effects
    // ------------------------------------------------------------------
    blinker(on) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tick(t, on ? 3200 : 2400, 0.09, 0.025);
    }

    click() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone('square', 1320, t, 0.04, 0.03);
    }

    chime() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone('sine', NOTE(81), t, 0.6, 0.08, this.sfxOut, true);
        this._tone('sine', NOTE(76), t + 0.28, 0.9, 0.08, this.sfxOut, true);
    }

    thunder(power = 1) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
        src.playbackRate.value = 0.35;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(90, t + 4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.25);
        g.gain.setValueAtTime(0.5 * power, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
        src.connect(f).connect(g).connect(this.sfxOut);
        src.start(t); src.stop(t + 6);
    }

    flyby() {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
        f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1400, t + 1.2); f.frequency.exponentialRampToValueAtTime(300, t + 3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        src.connect(f).connect(g).connect(this.sfxOut);
        src.start(t); src.stop(t + 3.3);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(170, t + 1.1); o.frequency.linearRampToValueAtTime(110, t + 3);
        const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 600;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.03, t + 1.1); og.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.connect(of).connect(og).connect(this.sfxOut);
        o.start(t); o.stop(t + 3.1);
    }

    siren() {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = 'triangle';
        for (let i = 0; i < 6; i++) {
            o.frequency.setValueAtTime(620, t + i * 0.9);
            o.frequency.linearRampToValueAtTime(980, t + i * 0.9 + 0.45);
            o.frequency.linearRampToValueAtTime(620, t + i * 0.9 + 0.9);
        }
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 1.5);
        g.gain.setValueAtTime(0.025, t + 3.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.4);
        o.connect(f).connect(g).connect(this.sfxOut);
        o.start(t); o.stop(t + 5.5);
    }

    _tone(type, freq, t, dur, vol, dest = this.sfxOut, soft = false) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(soft ? 0.0001 : vol, t);
        if (soft) g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------------
    // Radio
    // ------------------------------------------------------------------
    get stationInfo() { return STATIONS[this.station]; }

    setStation(i, silent = false) {
        this.station = (i + STATIONS.length) % STATIONS.length;
        const st = STATIONS[this.station];
        this.track = null;
        if (!this.ctx) return st;
        const t = this.ctx.currentTime;
        if (!silent) this._static(t);
        this.radioGain.gain.cancelScheduledValues(t);
        this.radioGain.gain.setValueAtTime(0, t);
        if (st.id !== 'off') this.radioGain.gain.setTargetAtTime(1, t + 0.35, 0.15);
        this.crackleGain.gain.setTargetAtTime(st.id === 'lofi' ? 1 : st.id === 'wave' ? 0.25 : 0.1, t, 0.2);
        this.radioLP.frequency.setTargetAtTime(st.id === 'lofi' ? 3600 : st.id === 'wave' ? 6500 : 5200, t, 0.1);
        this.nextTime = t + 0.45;
        this.step = 0;
        return st;
    }

    _static(t) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.35);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        src.connect(f).connect(g).connect(this.sfxOut);
        src.start(t, Math.random(), 0.45);
    }

    _newTrack() {
        const st = STATIONS[this.station];
        const r = this._r;
        const prog = st.progs[Math.floor(r() * st.progs.length)];
        const key = 45 + Math.floor(r() * 7);       // A2 .. D#3
        const bars = 24 + 4 * Math.floor(r() * 3);
        const name = trackName(r);
        this.track = {
            prog, key, bars, bar: 0, name,
            motif: Array.from({ length: 8 }, () => (r() < 0.7 ? [0, 2, 4, 7, 9][Math.floor(r() * 5)] : -1)),
            arpOn: r() < 0.8, leadFrom: 8 + Math.floor(r() * 8),
            kickExtra: r() < 0.5,
        };
        this.delay.delayTime.setValueAtTime((60 / st.bpm) * 0.75, this.ctx.currentTime);
        if (this.onTrack) this.onTrack(st, name);
    }

    _chord(deg, size = 3, octave = 0) {
        const st = STATIONS[this.station], sc = st.scale;
        const notes = [];
        for (let i = 0; i < size; i++) {
            const idx = deg + i * 2;
            notes.push(this.track.key + 12 * octave + sc[idx % 7] + 12 * Math.floor(idx / 7));
        }
        return notes;
    }

    _scaleNote(deg, octave) {
        const sc = STATIONS[this.station].scale;
        const d = ((deg % 7) + 7) % 7;
        return this.track.key + 12 * octave + sc[d] + 12 * Math.floor(deg / 7);
    }

    _schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        const st = STATIONS[this.station];
        if (st.id === 'off') return;
        const stepDur = 60 / st.bpm / 4;
        while (this.nextTime < ctx.currentTime + 0.25) {
            if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;   // tab was asleep
            if (!this.track || (this.step === 0 && this.track.bar >= this.track.bars)) this._newTrack();
            const swing = (this.step % 2 === 1) ? st.swing * stepDur : 0;
            this._playStep(st, this.step, this.nextTime + swing, stepDur);
            this.nextTime += stepDur;
            this.step = (this.step + 1) % 16;
            if (this.step === 0) this.track.bar++;
        }
    }

    _playStep(st, step, t, sd) {
        const tr = this.track, bar = tr.bar, r = this._r;
        const barsPerChord = st.id === 'drift' ? 2 : 1;
        const deg = tr.prog[Math.floor(bar / barsPerChord) % tr.prog.length];
        const intro = bar < 2, outro = bar >= tr.bars - 2;
        if (st.id === 'wave') {
            if (!intro && (step === 0 || step === 8 || (tr.kickExtra && step === 10))) { this._kick(t, 0.9); this._duckAt(t, 0.45); }
            if (!intro && (step === 4 || step === 12)) this._snare(t, 0.35, 0.65);
            if (step % 2 === 0 && !outro) this._hat(t, step % 4 === 2 ? 0.07 : 0.035, step % 4 === 2 ? 0.09 : 0.03);
            if (step === 0 && bar % barsPerChord === 0) this._pad(this._chord(deg, 3, 1), t, sd * 16 * barsPerChord, 0.05, 'sawtooth', 1300);
            if (step % 2 === 0) this._bass(this._chord(deg, 1, -1)[0], t, sd * 1.7, 0.16);
            if (tr.arpOn && bar >= 4 && !outro) {
                const ch = this._chord(deg, 4, 2);
                const order = [0, 1, 2, 3, 2, 1];
                this._pluck(ch[order[step % order.length]], t, sd * 0.9, 0.035);
            }
            if (bar >= tr.leadFrom && bar < tr.bars - 4 && step % 4 === 0) {
                const m = tr.motif[(step / 4 + (bar % 2) * 4) % 8];
                if (m >= 0) this._lead(this._scaleNote(m + deg, 2), t, sd * 3.6, 0.04);
            }
        } else if (st.id === 'lofi') {
            if (!intro && (step === 0 || step === 10 || (tr.kickExtra && step === 7))) this._kick(t, 0.7, true);
            if (!intro && (step === 4 || step === 12)) this._snare(t, 0.22, 0.25, true);
            if (step % 2 === 0) this._hat(t, 0.03 + r() * 0.025, 0.04);
            if (step === 0 || step === 7 || (step === 14 && r() < 0.5)) {
                this._keys(this._chord(deg, 4, 1), t, sd * (step === 0 ? 6 : 4), step === 0 ? 0.05 : 0.035);
            }
            if (step === 0 || step === 8 || (step === 14 && r() < 0.4)) {
                const root = this._chord(deg, 1, -1)[0];
                this._sub(step === 14 ? root + 7 : root, t, sd * (step === 14 ? 2 : 5), 0.22);
            }
            if (bar >= tr.leadFrom && step % 4 === 2 && r() < 0.45 && !outro) {
                const m = tr.motif[Math.floor(r() * 8)];
                if (m >= 0) this._flute(this._scaleNote(m + deg, 2), t, sd * 3, 0.03);
            }
        } else if (st.id === 'drift') {
            if (step === 0 && bar % 2 === 0) {
                this._brass(this._chord(deg, 3, 1), t, sd * 32, 0.05);
                this._sub(this._chord(deg, 1, -1)[0], t, sd * 32, 0.12);
            }
            if ((step === 6 || step === 13) && r() < 0.35) {
                const m = [0, 2, 4, 7, 9][Math.floor(r() * 5)];
                this._bell(this._scaleNote(m + deg, 3), t, 0.03);
            }
        }
    }

    // ---------------- instruments ----------------
    _osc(type, freq, t, end, dest, detune = 0) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        this.wowAmt.connect(o.detune);
        o.connect(dest);
        o.start(t);
        o.stop(end);
        o.onended = () => { try { this.wowAmt.disconnect(o.detune); } catch { /* already gone */ } o.disconnect(); };
        return o;
    }

    _env(gain, t, a, peak, d, sus, rel, end) {
        gain.setValueAtTime(0.0001, t);
        gain.exponentialRampToValueAtTime(peak, t + a);
        gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
        gain.setValueAtTime(Math.max(0.0001, peak * sus), Math.max(t + a + d, end - rel));
        gain.exponentialRampToValueAtTime(0.0001, end);
    }

    _duckAt(t, depth) {
        const g = this.duck.gain;
        g.setValueAtTime(depth, t);
        g.linearRampToValueAtTime(1, t + 0.28);
    }

    _kick(t, vol, dusty = false) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(dusty ? 110 : 150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dusty ? 0.32 : 0.42));
        o.connect(g).connect(this.drumBus);
        o.start(t); o.stop(t + 0.5);
    }

    _noiseHit(t, type, freq, q, vol, dur, verb = 0) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.drumBus);
        if (verb > 0) {
            const s = ctx.createGain(); s.gain.value = verb;
            g.connect(s).connect(this.verbSend);
        }
        src.start(t, Math.random() * 1.5, dur + 0.05);
    }

    _snare(t, vol, verb, dusty = false) {
        this._noiseHit(t, 'bandpass', dusty ? 1500 : 1900, 0.8, vol, dusty ? 0.14 : 0.22, verb);
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g).connect(this.drumBus);
        o.start(t); o.stop(t + 0.12);
    }

    _hat(t, vol, dur) { this._noiseHit(t, 'highpass', 7500, 0.5, vol, dur); }

    _pad(notes, t, dur, vol, type, cutoff) {
        const ctx = this.ctx, end = t + dur;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.8;
        const g = ctx.createGain();
        this._env(g.gain, t, 0.5, vol, 0.6, 0.8, 0.9, end);
        f.connect(g).connect(this.duck);
        for (const n of notes) for (const d of [-8, 8]) this._osc(type, NOTE(n), t, end + 0.05, f, d);
    }

    _bass(n, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
        f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur * 0.8);
        const g = ctx.createGain();
        this._env(g.gain, t, 0.005, vol, 0.08, 0.6, 0.05, end);
        f.connect(g).connect(this.duck);
        this._osc('sawtooth', NOTE(n), t, end + 0.02, f);
    }

    _pluck(n, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
        const g = ctx.createGain();
        this._env(g.gain, t, 0.004, vol, dur * 0.5, 0.3, dur * 0.3, end);
        f.connect(g);
        g.connect(this.radioIn);
        const ds = ctx.createGain(); ds.gain.value = 0.6;
        g.connect(ds).connect(this.delaySend);
        this._osc('square', NOTE(n), t, end + 0.02, f);
    }

    _lead(n, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
        const g = ctx.createGain();
        this._env(g.gain, t, 0.06, vol, 0.2, 0.7, 0.3, end);
        f.connect(g);
        g.connect(this.radioIn);
        const vs = ctx.createGain(); vs.gain.value = 0.6;
        g.connect(vs).connect(this.verbSend);
        const ds = ctx.createGain(); ds.gain.value = 0.4;
        g.connect(ds).connect(this.delaySend);
        const o = this._osc('sawtooth', NOTE(n), t, end + 0.05, f);
        const o2 = this._osc('triangle', NOTE(n + 12), t, end + 0.05, f, 4);
        const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
        const va = ctx.createGain(); va.gain.setValueAtTime(0, t); va.gain.linearRampToValueAtTime(12, t + 0.4);
        vib.connect(va); va.connect(o.detune); va.connect(o2.detune);
        vib.start(t); vib.stop(end + 0.05);
    }

    _keys(notes, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const g = ctx.createGain();
        this._env(g.gain, t, 0.008, vol, 0.5, 0.45, 0.3, end);
        const trem = ctx.createGain();
        const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5;
        const la = ctx.createGain(); la.gain.value = 0.25;
        lfo.connect(la).connect(trem.gain);
        trem.gain.value = 0.8;
        g.connect(trem);
        trem.connect(this.radioIn);
        const vs = ctx.createGain(); vs.gain.value = 0.35;
        trem.connect(vs).connect(this.verbSend);
        lfo.start(t); lfo.stop(end + 0.05);
        for (const n of notes) {
            this._osc('sine', NOTE(n), t, end + 0.02, g);
            const h = ctx.createGain(); h.gain.setValueAtTime(0.35, t); h.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            h.connect(g);
            this._osc('sine', NOTE(n) * 2.01, t, t + 0.45, h);
        }
    }

    _sub(n, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const g = ctx.createGain();
        this._env(g.gain, t, 0.02, vol, 0.2, 0.7, 0.2, end);
        g.connect(this.radioIn);
        this._osc('triangle', NOTE(n), t, end + 0.02, g);
    }

    _flute(n, t, dur, vol) {
        const ctx = this.ctx, end = t + dur;
        const g = ctx.createGain();
        this._env(g.gain, t, 0.08, vol, 0.2, 0.8, 0.3, end);
        g.connect(this.radioIn);
        const vs = ctx.createGain(); vs.gain.value = 0.5;
        g.connect(vs).connect(this.verbSend);
        this._osc('sine', NOTE(n), t, end + 0.05, g);
        this._noiseHit(t, 'bandpass', NOTE(n) * 2, 4, vol * 0.3, 0.12);
    }

    _brass(notes, t, dur, vol) {
        // slow-swelling, detuned and vibrato'd — the big analogue polysynth sound
        const ctx = this.ctx, end = t + dur;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 2.2);
        f.frequency.exponentialRampToValueAtTime(900, t + dur * 0.8);
        const g = ctx.createGain();
        this._env(g.gain, t, 1.6, vol, 1.5, 0.75, 2.5, end);
        f.connect(g);
        g.connect(this.radioIn);
        const vs = ctx.createGain(); vs.gain.value = 0.9;
        g.connect(vs).connect(this.verbSend);
        const vib = ctx.createOscillator(); vib.frequency.value = 5;
        const va = ctx.createGain(); va.gain.setValueAtTime(0, t); va.gain.linearRampToValueAtTime(9, t + 2.5);
        vib.connect(va);
        vib.start(t); vib.stop(end + 0.1);
        for (const n of notes) for (const d of [-9, 0, 9]) {
            const o = this._osc('sawtooth', NOTE(n), t, end + 0.1, f, d);
            va.connect(o.detune);
        }
    }

    _bell(n, t, vol) {
        const ctx = this.ctx, end = t + 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, end);
        g.connect(this.radioIn);
        const vs = ctx.createGain(); vs.gain.value = 1.2;
        g.connect(vs).connect(this.verbSend);
        const ds = ctx.createGain(); ds.gain.value = 0.6;
        g.connect(ds).connect(this.delaySend);
        this._osc('sine', NOTE(n), t, end, g);
        const h = ctx.createGain(); h.gain.value = 0.3; h.connect(g);
        this._osc('sine', NOTE(n) * 2.76, t, t + 1, h);
    }
}
