// Sound. Music, effects and voices are ElevenLabs recordings (audio/); a Web Audio synth stands in for any effect
// that fails to load, and makes the engine hum. The context is made on the first user gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

import { LINES } from './lines.js';

const SFX = ['cannon', 'missile', 'jump', 'land', 'boom', 'bigboom', 'pickup', 'powerup', 'alarm', 'hurt', 'shield', 'laser', 'deflect', 'phase', 'bridge', 'overdrive'];
const MUSIC = ['title', 'river', 'boss'];

export class Audio {
    constructor(base = 'audio/') {
        this.base = base;
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.6, voice: 0.9 };
        this.muted = false;
        this.buffers = {};
        this.tracks = {};
        this.current = null;
        this.last = {};
        this.voiceBusy = 0;
        this.engineOn = false;
        this.loaded = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(ctx.destination);
        this.meter = ctx.createAnalyser();
        this.meter.fftSize = 256;
        comp.connect(this.meter);
        this.sfx = ctx.createGain(); this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.connect(this.master);
        this.voiceBus = ctx.createGain(); this.voiceBus.connect(this.master);
        this.duck = ctx.createGain(); this.duck.connect(this.music);
        this.setVolumes(this.vol);
        for (const n of SFX) this._load('sfx-' + n, n);
        for (const id in LINES) this._load('vo-' + id, 'vo:' + id);
        this._load('jingle-clear', 'jingle-clear');
        this._load('jingle-over', 'jingle-over');
        for (const n of MUSIC) {
            const el = new window.Audio();
            el.src = this.base + 'music-' + n + '.mp3';
            el.loop = true;
            el.preload = 'auto';
            el.crossOrigin = 'anonymous';
            try {
                const src = ctx.createMediaElementSource(el);
                const g = ctx.createGain(); g.gain.value = 0;
                src.connect(g); g.connect(this.duck);
                this.tracks[n] = { el, g };
            } catch { /* no element routing */ }
        }
        this._engine();
        if (this.wantTrack) this.playMusic(this.wantTrack);
    }

    async _load(file, key) {
        try {
            const r = await fetch(this.base + file + '.mp3');
            if (!r.ok) throw new Error(r.status);
            const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
            this.buffers[key] = buf;
            this.loaded++;
        } catch { /* the synth covers it */ }
    }

    setVolumes({ sfx, music, voice }) {
        Object.assign(this.vol, { sfx, music, voice });
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * 0.55, t, 0.02);
        this.voiceBus.gain.setTargetAtTime(voice, t, 0.02);
    }
    setMuted(m) {
        this.muted = m;
        if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
    }

    /** Crossfade to a music track (or null for silence). */
    playMusic(name) {
        this.wantTrack = name;
        if (!this.ctx || this.current === name) return;
        const t = this.ctx.currentTime;
        for (const [n, tr] of Object.entries(this.tracks)) {
            if (n === name) {
                tr.el.currentTime = n === 'title' ? 0 : tr.el.currentTime;
                tr.el.play().catch(() => {});
                tr.g.gain.cancelScheduledValues(t);
                tr.g.gain.setTargetAtTime(1, t, 0.4);
            } else {
                tr.g.gain.cancelScheduledValues(t);
                tr.g.gain.setTargetAtTime(0, t, 0.3);
                const el = tr.el;
                setTimeout(() => { if (this.current !== n) el.pause(); }, 1600);
            }
        }
        this.current = name;
    }
    playing() { return this.current && this.tracks[this.current] && !this.tracks[this.current].el.paused; }

    /** Play a decoded clip; returns its duration (0 if none). */
    clip(key, { vol = 1, rate = 1, bus = this.sfx } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return 0;
        const buf = this.buffers[key];
        if (!buf) return 0;
        const s = this.ctx.createBufferSource();
        s.buffer = buf; s.playbackRate.value = rate;
        const g = this.ctx.createGain(); g.gain.value = vol;
        s.connect(g); g.connect(bus);
        s.start();
        return buf.duration / rate;
    }

    /** An effect by name, at most once per `gap` seconds; the synth stands in if the recording is missing. */
    fx(name, { vol = 1, rate = 1, gap = 0.03 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (now - (this.last[name] || 0) < gap) return;
        this.last[name] = now;
        if (this.clip(name, { vol, rate })) return;
        this.synth(name);
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    noise(dur = 0.3, vol = 0.3, cutoff = 1200) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const n = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
        const g = this.ctx.createGain(); g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(this.sfx); s.start();
    }
    synth(name) {
        switch (name) {
            case 'cannon': this.tone({ freq: 900, to: 300, dur: 0.06, vol: 0.08 }); break;
            case 'missile': this.noise(0.5, 0.25, 3000); this.tone({ freq: 300, to: 900, dur: 0.3, type: 'sawtooth', vol: 0.06 }); break;
            case 'jump': this.noise(0.4, 0.3, 2500); this.tone({ freq: 200, to: 700, dur: 0.35, type: 'triangle', vol: 0.15 }); break;
            case 'land': this.noise(0.45, 0.5, 900); break;
            case 'boom': this.noise(0.5, 0.6, 1400); this.tone({ freq: 120, to: 40, dur: 0.3, type: 'sine', vol: 0.4 }); break;
            case 'bigboom': this.noise(1.4, 0.8, 900); this.tone({ freq: 90, to: 25, dur: 1, type: 'sine', vol: 0.6 }); break;
            case 'pickup': this.tone({ freq: 1200, dur: 0.06, type: 'triangle', vol: 0.15 }); this.tone({ freq: 1800, dur: 0.1, type: 'triangle', vol: 0.15, delay: 0.06 }); break;
            case 'powerup': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'square', vol: 0.1, delay: i * 0.05 })); break;
            case 'alarm': for (let i = 0; i < 3; i++) { this.tone({ freq: 880, dur: 0.22, type: 'square', vol: 0.15, delay: i * 0.5 }); this.tone({ freq: 660, dur: 0.22, type: 'square', vol: 0.15, delay: i * 0.5 + 0.25 }); } break;
            case 'hurt': this.noise(0.2, 0.5, 2000); this.tone({ freq: 300, to: 120, dur: 0.15, vol: 0.2 }); break;
            case 'shield': this.tone({ freq: 1400, to: 700, dur: 0.25, type: 'sine', vol: 0.2 }); break;
            case 'laser': this.tone({ freq: 220, to: 110, dur: 0.6, type: 'sawtooth', vol: 0.2 }); this.noise(0.6, 0.2, 4000); break;
            case 'deflect': this.tone({ freq: 2400, to: 1800, dur: 0.05, type: 'triangle', vol: 0.08 }); break;
            case 'phase': this.tone({ freq: 60, to: 30, dur: 1.2, type: 'sine', vol: 0.5 }); this.noise(1, 0.4, 600); break;
            case 'bridge': this.noise(1.4, 0.7, 700); break;
            case 'overdrive': this.tone({ freq: 200, to: 1200, dur: 0.7, type: 'sawtooth', vol: 0.15 }); break;
            case 'tele': this.tone({ freq: 1600, dur: 0.05, type: 'square', vol: 0.05 }); break;
            case 'efire': this.tone({ freq: 700, to: 400, dur: 0.07, type: 'square', vol: 0.04 }); break;
            case 'jingle-clear': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'square', vol: 0.12, delay: i * 0.12 })); break;
            case 'jingle-over': [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.15, delay: i * 0.25 })); break;
        }
    }

    /** A voice line, one at a time; music ducks under it. Returns false if something is still talking. */
    voice(id, force = false) {
        if (!this.ctx || this.ctx.state !== 'running') return false;
        const now = this.ctx.currentTime;
        if (!force && now < this.voiceBusy) return false;
        const d = this.clip('vo:' + id, { bus: this.voiceBus });
        if (!d) return false;
        this.voiceBusy = now + d + 0.2;
        this.duck.gain.cancelScheduledValues(now);
        this.duck.gain.setTargetAtTime(0.35, now, 0.05);
        this.duck.gain.setTargetAtTime(1, now + d, 0.3);
        return true;
    }

    _engine() {
        const ctx = this.ctx;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        o1.type = 'sawtooth'; o2.type = 'square';
        o1.frequency.value = 55; o2.frequency.value = 82;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 4;
        const g = ctx.createGain(); g.gain.value = 0;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 18; lg.gain.value = 6;
        lfo.connect(lg); lg.connect(o1.frequency);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx);
        o1.start(); o2.start(); lfo.start();
        this.eng = { o1, o2, f, g };
    }
    /** Called every frame: pitch follows the boat's speed; silent off the water. */
    engine(on, speed = 16, throttle = 0, air = false) {
        if (!this.eng) return;
        const t = this.ctx.currentTime;
        const k = speed / 16;
        this.eng.o1.frequency.setTargetAtTime(45 + 28 * k + (air ? 20 : 0), t, 0.1);
        this.eng.o2.frequency.setTargetAtTime(70 + 40 * k, t, 0.1);
        this.eng.f.frequency.setTargetAtTime(260 + 260 * k + (throttle > 0 ? 300 : 0), t, 0.1);
        this.eng.g.gain.setTargetAtTime(on ? 0.06 + 0.03 * Math.max(0, throttle) : 0, t, 0.15);
    }

    /** The loudest sample on the master bus right now (0..1), for tests. */
    peak() {
        if (!this.meter) return 0;
        const a = new Uint8Array(this.meter.fftSize);
        this.meter.getByteTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v - 128) / 128);
        return m;
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'shoot': this.fx('cannon', { vol: e.weapon === 'plasma' ? 0.7 : 0.32, rate: e.weapon === 'plasma' ? 0.6 : 0.95 + Math.random() * 0.1, gap: 0.07 }); break;
                case 'missile': this.fx('missile', { vol: 0.6 }); break;
                case 'jump': this.fx('jump'); break;
                case 'land': this.fx('land', { vol: 0.8 }); if (e.shock) this.fx('phase', { vol: 0.35, rate: 1.6 }); break;
                case 'kill': this.fx(e.big ? 'bigboom' : 'boom', { vol: e.big ? 0.7 : 0.55, rate: 0.9 + Math.random() * 0.2, gap: 0.05 }); break;
                case 'boom': this.fx(e.big ? 'bigboom' : 'boom', { vol: e.big ? 0.8 : 0.4, gap: 0.06 }); break;
                case 'hit': this.fx('deflect', { vol: 0.18, rate: 0.7, gap: 0.06 }); break;
                case 'hurt': this.fx('hurt', { vol: 0.9, gap: 0.1 }); break;
                case 'shieldhit': this.fx('shield'); break;
                case 'pickup':
                    if (e.kind === 'core') this.fx('pickup', { vol: 0.45, rate: 1.2, gap: 0.05 });
                    else if (e.kind === 'overdrive') this.fx('overdrive');
                    else this.fx('powerup', { vol: 0.8 });
                    break;
                case 'boss': case 'miniboss': this.fx('alarm', { vol: 0.8 }); break;
                case 'phase': this.fx('phase'); break;
                case 'bossdown': case 'partdown': this.fx('bigboom', { gap: 0.1 }); break;
                case 'lane': this.fx('laser', { vol: 0.8, gap: 0.2 }); break;
                case 'deflect': this.fx('deflect', { vol: 0.3, gap: 0.08 }); break;
                case 'bridge': this.fx('bridge'); break;
                case 'efire': this.synth('efire'); break;
                case 'tele': case 'btele': this.synth('tele'); break;
                case 'dock': case 'victory': if (!this.clip('jingle-clear', { bus: this.music })) this.synth('jingle-clear'); break;
                case 'over': if (!this.clip('jingle-over', { bus: this.music })) this.synth('jingle-over'); break;
            }
        }
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'buy') { this.fx('powerup', { vol: 0.7, rate: 1.2, gap: 0 }); }
        else if (kind === 'deny') this.tone({ freq: 200, to: 140, dur: 0.15, type: 'square', vol: 0.12 });
    }
}
