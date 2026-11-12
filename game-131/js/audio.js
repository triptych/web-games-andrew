// Sound. Music, ambience, effects and every voice were generated with ElevenLabs (audio/, see dev/audio/README.md).
// Music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js still silences a hidden tab,
// and crossfades between places. Effects, ambience and voices are decoded into AudioBuffers on demand. Anything that
// fails to load falls back to a small Web Audio synth (soft pads, bells, taps), so the game is never silent.

const CHIME = [261.63, 329.63, 392.0, 523.25];           // the four singing stones: C E G C
const PAD = { title: [130.8, 196, 261.6], isle: [146.8, 220, 293.7], caves: [110, 164.8, 246.9], under: [98, 146.8, 196], sky: [174.6, 261.6, 349.2], sea: [123.5, 185, 246.9], warren: [130.8, 164.8, 196] };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buffers = {}; this.loading = {}; this.failed = new Set();
        this.tracks = {};
        this.current = null;      // the theme that should be playing
        this.amb = null;          // { name, src, gain }
        this.voiceSrc = null;
        this.voiceUntil = 0;
        this.pad = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.connect(comp);
        // a meter on the master bus: the browser test reads it to prove sound came out
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 512; comp.connect(this.meter);
        this.setVolumes(this.sfxVol, this.musicVol, this.voiceVol);
        for (const n of ['step', 'pickup', 'item', 'page']) this._load('sfx-' + n);
        if (this.current) { const c = this.current; this.current = null; this.play(c); }
        if (this.wantAmb) this.ambience(this.wantAmb);
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.03);
        this.music.gain.setTargetAtTime(music * 0.8, t, 0.05);
        this.voice.gain.setTargetAtTime(voice, t, 0.03);
    }

    /** Peak level on the master bus right now (0..1). */
    level() {
        if (!this.meter) return 0;
        const a = new Float32Array(this.meter.fftSize);
        this.meter.getFloatTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v));
        return m;
    }

    // ------------------------------------------------------------ clips
    _load(name) {
        if (this.buffers[name] || this.failed.has(name) || !this.ctx) return this.loading[name] || Promise.resolve(this.buffers[name] || null);
        if (this.loading[name]) return this.loading[name];
        this.loading[name] = fetch(`audio/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[name] = buf; return buf; })
            .catch(() => { this.failed.add(name); return null; });
        return this.loading[name];
    }

    _play(buf, bus, { vol = 1, rate = 1, loop = false } = {}) {
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = buf; s.playbackRate.value = rate; s.loop = loop; g.gain.value = vol;
        s.connect(g); g.connect(bus);
        s.start();
        s._g = g;
        return s;
    }

    /** A sound effect by name; a synth stand-in when the file is missing or still loading. */
    fx(name, opts = {}) {
        if (!this.ok) return;
        const key = 'sfx-' + name, buf = this.buffers[key];
        if (buf) { this._play(buf, this.sfx, { vol: opts.vol ?? 0.8, rate: opts.rate ?? (0.95 + Math.random() * 0.1) }); return; }
        this._load(key);
        this._synth(name);
    }

    _synth(name) {
        if (name === 'step') this.noise(0.07, 500, 0.05);
        else if (name === 'pickup') { this.tone(880, 1320, 0.12, 'sine', 0.1); this.tone(1320, 1760, 0.14, 'sine', 0.07, 0.07); }
        else if (name === 'item') [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.1, i * 0.08));
        else if (name === 'gem') [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.6, 'sine', 0.12, i * 0.13));
        else if (name === 'door') this.noise(1.2, 140, 0.22);
        else if (name === 'lever') { this.noise(0.12, 900, 0.12); this.tone(160, 90, 0.2, 'triangle', 0.12, 0.05); }
        else if (name === 'travel') this.noise(1.0, 1400, 0.1);
        else if (name === 'page') this.noise(0.12, 2600, 0.04);
        else if (name === 'bump') this.tone(110, 70, 0.12, 'sine', 0.12);
        else if (name === 'crawl') this.noise(0.16, 380, 0.07);
        else if (name === 'keepsake') [659, 784, 988, 1319].forEach((f, i) => this.tone(f, f, 0.35, 'sine', 0.1, i * 0.1));
        else this.tone(440, 440, 0.1, 'sine', 0.08);
    }

    tone(from, to, dur = 0.12, type = 'sine', vol = 0.12, delay = 0) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise(dur, cutoff, vol) {
        if (!this.ok) return;
        const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start();
    }

    /** One of the four singing stones or weather vanes: a soft bell. */
    chime(note) {
        if (!this.ok) return;
        const f = CHIME[note] || 440;
        this.tone(f, f, 1.6, 'sine', 0.16); this.tone(f * 2.01, f * 2, 1.0, 'sine', 0.05); this.tone(f * 3.0, f * 3, 0.5, 'sine', 0.025);
    }

    ui(kind) {
        if (kind === 'click') this.tone(660, 660, 0.05, 'triangle', 0.07);
        else if (kind === 'open') this.tone(440, 660, 0.09, 'triangle', 0.07);
        else if (kind === 'close') this.tone(660, 440, 0.09, 'triangle', 0.07);
    }

    // ------------------------------------------------------------ voices
    /** Say a recorded line (audio/vo/<id>.mp3). One voice at a time; a new line replaces the old one. */
    say(id) {
        if (!this.ok) return;
        const key = 'vo/' + id;
        const token = (this.voiceToken = (this.voiceToken || 0) + 1);
        this._load(key).then((buf) => {
            if (!buf || token !== this.voiceToken) return;
            this.hush();
            this.voiceSrc = this._play(buf, this.voice, { vol: 1 });
            this.voiceUntil = performance.now() + buf.duration * 1000;
            this._duck(buf.duration);
        });
    }
    hush() { try { this.voiceSrc?.stop(); } catch { /* already ended */ } this.voiceSrc = null; this.voiceUntil = 0; }
    get speaking() { return performance.now() < this.voiceUntil; }

    _duck(sec) {
        const t = this.ctx.currentTime, g = this.music.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(this.musicVol * 0.36, t, 0.1);
        g.setTargetAtTime(this.musicVol * 0.8, t + sec, 0.5);
    }

    // ------------------------------------------------------------ music and ambience
    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music-${name}.mp3`);
        el.loop = true; el.preload = 'auto';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* connected once */ }
        g.connect(this.music);
        el._g = g;
        el.addEventListener('error', () => { this.failed.add('music-' + name); if (this.current === name) this._pad(name); });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the theme with a slow crossfade. */
    play(name) {
        if (!this.ctx) { this.current = name; return; }
        if (this.current === name) return;
        const t = this.ctx.currentTime, old = this.current && this.tracks[this.current];
        if (old) { old._g.gain.setTargetAtTime(0, t, 0.8); setTimeout(() => { if (old !== this.tracks[this.current]) old.pause(); }, 3500); }
        this.current = name;
        this._pad(null);
        if (!name) return;
        if (this.failed.has('music-' + name)) { this._pad(name); return; }
        const el = this._track(name);
        el._g.gain.cancelScheduledValues(t);
        el._g.gain.setTargetAtTime(1, t + 0.1, 1.0);
        el.play().catch(() => {});
    }
    get musicPlaying() { const el = this.current && this.tracks[this.current]; return !!el && !el.paused; }

    /** A looping bed of place-sound (waves, drips, wind) under the music. */
    ambience(name) {
        this.wantAmb = name;
        if (!this.ctx || this.amb?.name === name) return;
        const t = this.ctx.currentTime;
        if (this.amb) { const old = this.amb; old.src._g.gain.setTargetAtTime(0, t, 0.6); setTimeout(() => { try { old.src.stop(); } catch { /* */ } }, 2500); this.amb = null; }
        if (!name) return;
        this._load('amb-' + name).then((buf) => {
            if (!buf || this.wantAmb !== name || this.amb?.name === name) return;
            const src = this._play(buf, this.sfx, { vol: 0, loop: true });
            src._g.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.2);
            this.amb = { name, src };
        });
    }

    /** The stand-in for a missing track: three soft sines breathing slowly. */
    _pad(name) {
        if (this.pad) { const p = this.pad; p.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5); setTimeout(() => p.os.forEach((o) => { try { o.stop(); } catch { /* */ } }), 2500); this.pad = null; }
        if (!name || !this.ctx) return;
        const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.music);
        const os = (PAD[name] || PAD.isle).map((f, i) => {
            const o = this.ctx.createOscillator(), og = this.ctx.createGain(), l = this.ctx.createOscillator(), lg = this.ctx.createGain();
            o.type = 'sine'; o.frequency.value = f; og.gain.value = 0.05;
            l.frequency.value = 0.07 + i * 0.03; lg.gain.value = 0.035; l.connect(lg); lg.connect(og.gain);
            o.connect(og); og.connect(g); o.start(); l.start();
            return o;
        });
        g.gain.setTargetAtTime(1, this.ctx.currentTime, 1.5);
        this.pad = { g, os };
    }

    // ------------------------------------------------------------ the sim's events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'footstep': this.fx('step', { vol: e.run ? 0.5 : 0.36 }); break;
                case 'pickup': this.fx('pickup', { vol: 0.6 }); break;
                case 'item': this.fx('item'); break;
                case 'gem': this.fx('gem', { rate: 1 }); break;
                case 'keepsake': this.fx('keepsake', { rate: 1 }); break;
                case 'chime': this.chime(e.note); break;
                case 'seqReset': this.tone(220, 160, 0.4, 'sine', 0.08, 0.3); break;
                case 'seqDone': [0, 1, 2, 3].forEach((n, i) => setTimeout(() => this.chime(n), 400 + i * 180)); break;
                case 'tunDone': this.fx(e.thing === 'lever' ? 'lever' : 'item'); if (e.thing === 'lever') setTimeout(() => this.fx('door', { rate: 1 }), 500); break;
                case 'tunStep': this.fx('crawl', { vol: 0.5 }); break;
                case 'tunBump': this.fx('bump', { vol: 0.6 }); break;
                case 'travel': this.fx('travel', { rate: 1 }); break;
                case 'offered': case 'hearthSet': this.fx('door', { rate: 1 }); break;
                case 'cardClose': this.fx('page', { vol: 0.5 }); this.hush(); break;
                case 'lore': this.fx('page', { vol: 0.6 }); break;
                default: break;
            }
        }
    }
}
