// Sound. ElevenLabs music, effects and voices (audio/), with Web Audio synth stand-ins for anything that fails to load.
// Music plays through <audio> elements routed into a gain node (so ../lib/page-audio.js still silences a hidden tab)
// and crossfades between themes. Effects and voices are decoded into AudioBuffers; one voice line plays at a time.
// The context is made on the first user gesture (browsers block audio before one).

const THEMES = ['title', 'academy', 'mystery', 'battle', 'climax', 'tender'];
const SFX = ['echo', 'fire', 'star', 'water', 'wind', 'hit', 'heal', 'hollow', 'levelup', 'victory', 'charm', 'quest', 'bell', 'cheer', 'whoosh', 'shatter'];

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.55, voice: 0.9 };
        this.buffers = new Map();       // 'sfx/echo' | 'vo/kai-start' → AudioBuffer | null (failed) | Promise
        this.music = {};                // theme → { el, gain }
        this.theme = null;
        this.voiceSrc = null;
        this.voiceUntil = 0;
        this.decoded = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(comp);
        this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = this.vol.voice; this.voiceBus.connect(comp);
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music; this.musicBus.connect(comp);
        for (const s of SFX) this.load('sfx/' + s);
        if (this.want) this.setTheme(this.want, true);
    }

    setVolumes({ sfx, music, voice }) {
        Object.assign(this.vol, { sfx, music, voice });
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfxBus.gain.setTargetAtTime(sfx, t, 0.03);
        this.musicBus.gain.setTargetAtTime(music, t, 0.03);
        this.voiceBus.gain.setTargetAtTime(voice, t, 0.03);
    }

    load(key) {
        if (this.buffers.has(key)) return this.buffers.get(key);
        const p = fetch(`audio/${key}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b))
            .then((buf) => { this.buffers.set(key, buf); this.decoded++; return buf; })
            .catch(() => { this.buffers.set(key, null); return null; });
        this.buffers.set(key, p);
        return p;
    }

    _play(key, bus, { rate = 1, gain = 1 } = {}) {
        const b = this.buffers.get(key);
        if (!(b instanceof AudioBuffer)) return null;
        const s = this.ctx.createBufferSource();
        s.buffer = b; s.playbackRate.value = rate;
        const g = this.ctx.createGain(); g.gain.value = gain;
        s.connect(g); g.connect(bus);
        s.start();
        return s;
    }

    /** A sound effect; the synth answers if the file isn't there (yet). */
    sfx(name, opts) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        if (this._play('sfx/' + name, this.sfxBus, opts)) return;
        this.load('sfx/' + name);
        this.synth(name);
    }

    /** A voice line (audio/vo/<who>-<key>.mp3). One at a time: a new line cuts the old. */
    voice(who, key) {
        if (!this.ctx || !who || !key) return;
        const k = `vo/${who}-${key}`;
        const go = () => {
            try { this.voiceSrc?.stop(); } catch { /* already stopped */ }
            this.voiceSrc = this._play(k, this.voiceBus);
            if (this.voiceSrc) this.voiceUntil = this.ctx.currentTime + this.buffers.get(k).duration;
        };
        const b = this.buffers.get(k);
        if (b instanceof AudioBuffer) go();
        else Promise.resolve(this.load(k)).then((buf) => { if (buf) go(); });
    }

    /** A battle bark: only if nobody else is talking, and only sometimes. */
    bark(who, key, chance = 0.5) {
        if (!this.ctx || this.ctx.currentTime < this.voiceUntil + 0.6 || Math.random() > chance) return;
        this.voice(who, key);
    }

    stopVoice() { try { this.voiceSrc?.stop(); } catch { /* */ } this.voiceSrc = null; }

    /** Crossfade to a theme (null for silence). */
    setTheme(name, force = false) {
        this.want = name;
        if (!this.ctx || (!force && name === this.theme)) return;
        const t = this.ctx.currentTime;
        const old = this.theme && this.music[this.theme];
        if (old) { old.gain.gain.cancelScheduledValues(t); old.gain.gain.setTargetAtTime(0, t, 0.35); const el = old.el; setTimeout(() => { if (this.theme !== el.dataset.theme) el.pause(); }, 1600); }
        this.theme = name;
        if (!name || !THEMES.includes(name)) return;
        let m = this.music[name];
        if (!m) {
            const el = document.createElement('audio');
            el.src = `audio/music/${name}.mp3`; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
            el.dataset.theme = name;
            const src = this.ctx.createMediaElementSource(el);
            const gain = this.ctx.createGain(); gain.gain.value = 0;
            src.connect(gain); gain.connect(this.musicBus);
            m = this.music[name] = { el, gain };
        }
        m.gain.gain.cancelScheduledValues(t);
        m.gain.gain.setTargetAtTime(1, t, 0.5);
        if (m.el.paused) m.el.play().catch(() => {});
    }

    /** Is a theme actually playing? (the browser test checks this) */
    playing() { const m = this.theme && this.music[this.theme]; return !!m && !m.el.paused; }

    // ------------------------------------------------------------------ synth stand-ins
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfxBus);
        o.start(t); o.stop(t + dur + 0.02);
    }

    synth(name) {
        const T = (o) => this.tone(o);
        switch (name) {
            case 'hit': T({ freq: 220, to: 90, dur: 0.12, type: 'square', vol: 0.12 }); break;
            case 'heal': [523, 659, 784].forEach((f, i) => T({ freq: f, dur: 0.18, delay: i * 0.06 })); break;
            case 'charm': case 'quest': T({ freq: 988, to: 1318, dur: 0.15, type: 'triangle' }); break;
            case 'levelup': case 'victory': [523, 659, 784, 1046].forEach((f, i) => T({ freq: f, dur: 0.2, type: 'triangle', delay: i * 0.08 })); break;
            default: T({ freq: 660, to: 880, dur: 0.1, type: 'triangle', vol: 0.1 });
        }
    }

    /** Little UI blips and the mini-game notes (pure synth, so they're instant). */
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 720, dur: 0.05, type: 'triangle', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.08, type: 'triangle', vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.08, type: 'triangle', vol: 0.08 });
        else if (kind === 'text') this.tone({ freq: 1200 + Math.random() * 200, dur: 0.02, type: 'sine', vol: 0.025 });
        else if (kind === 'bad') this.tone({ freq: 200, to: 120, dur: 0.2, type: 'sawtooth', vol: 0.08 });
    }

    note(n) { this.tone({ freq: [523.25, 659.25, 783.99, 1046.5][n] || 440, dur: 0.32, type: 'triangle', vol: 0.18 }); }
}
