// Sound: ElevenLabs music, effects and voices (audio/), with a small Web Audio synth for UI blips and as the
// fallback for anything that fails to load. Effects and voices are decoded into AudioBuffers; music plays
// through <audio> elements routed into a gain node, so ../lib/page-audio.js still silences a hidden tab.

const SFX = ['doily', 'splat', 'crumble', 'wallhit', 'build', 'coins', 'bell', 'horn', 'cheer', 'arrow', 'potion', 'magic', 'stomp', 'kiss', 'oven', 'roar', 'quest'];
const VOICES = { noxia: 6, vellum: 4, pip: 3, gerald: 3, mother: 3, king: 4, queen: 3, tobias: 3, silk: 2 };
const MUSIC = ['town', 'battle', 'king', 'love'];

export class Audio {
    constructor(base = 'audio/') {
        this.base = base;
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buf = {};          // name -> AudioBuffer
        this.raw = {};          // name -> ArrayBuffer (fetched before the context exists)
        this.tracks = {};       // theme -> { el, gain }
        this.theme = null;
        this.voiceSrc = null;
        this.last = {};         // throttle per sound
        this.loaded = 0;
        this.prefetch();
    }

    prefetch() {
        const names = [...SFX.map((s) => 'sfx-' + s)];
        for (const who in VOICES) for (let i = 1; i <= VOICES[who]; i++) names.push(`vo-${who}-${i}`);
        this.total = names.length;
        for (const n of names) {
            fetch(this.base + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => {
                if (!ab) return;
                this.raw[n] = ab;
                if (this.ctx) this.decode(n);
            }).catch(() => {});
        }
    }

    decode(n) {
        const ab = this.raw[n];
        if (!ab || this.buf[n]) return;
        delete this.raw[n];
        this.ctx.decodeAudioData(ab).then((b) => { this.buf[n] = b; this.loaded++; }).catch(() => {});
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.master = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        this.meter = ctx.createAnalyser(); comp.connect(this.meter);
        for (const n of Object.keys(this.raw)) this.decode(n);
        for (const t of MUSIC) {
            const el = new window.Audio(this.base + 'music-' + t + '.mp3');
            el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
            const gain = ctx.createGain(); gain.gain.value = 0;
            try { ctx.createMediaElementSource(el).connect(gain); } catch { /* already routed */ }
            gain.connect(this.music);
            this.tracks[t] = { el, gain };
        }
        if (this.wanted) this.playTheme(this.wanted);
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music, t, 0.02);
        this.voice.gain.setTargetAtTime(voice, t, 0.02);
    }

    /** Crossfade to a theme ('town', 'battle', 'king', 'love' or null for silence). */
    playTheme(theme) {
        this.wanted = theme;
        if (!this.ctx || theme === this.theme) return;
        const now = this.ctx.currentTime;
        for (const t in this.tracks) {
            const tr = this.tracks[t];
            if (t === theme) {
                tr.gain.gain.cancelScheduledValues(now);
                tr.gain.gain.setTargetAtTime(1, now, 0.6);
                if (tr.el.paused) { if (theme === 'love') tr.el.currentTime = 0; tr.el.play().catch(() => {}); }
            } else if (t === this.theme) {
                tr.gain.gain.setTargetAtTime(0, now, 0.5);
                const el = tr.el;
                setTimeout(() => { if (this.theme !== t) el.pause(); }, 2500);
            }
        }
        this.theme = theme;
    }

    playing() { return !!(this.theme && this.tracks[this.theme] && !this.tracks[this.theme].el.paused); }

    /** One sample, with a little pitch variety; throttled so a crowd of hits doesn't become a roar. */
    play(name, { vol = 1, rate = 1, gap = 0.05, vary = 0.06 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const b = this.buf['sfx-' + name];
        if (!b) { this.blip(name); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = b;
        src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 2 * vary);
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start();
    }

    /** A character's line. One voice at a time. Returns its length in seconds (0 if none). */
    say(who, n) {
        if (!this.ctx) return 0;
        const b = this.buf[`vo-${who}-${n}`];
        if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* done */ } this.voiceSrc = null; }
        if (!b) return 0;
        const src = this.ctx.createBufferSource();
        src.buffer = b; src.connect(this.voice); src.start();
        this.voiceSrc = src;
        // duck the music under the voice
        const now = this.ctx.currentTime;
        this.music.gain.setTargetAtTime(this.musicVol * 0.45, now, 0.1);
        this.music.gain.setTargetAtTime(this.musicVol, now + b.duration, 0.4);
        return b.duration;
    }
    hush() { if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* done */ } this.voiceSrc = null; } }

    // ------------------------------------------------------------------ the synth (UI blips and fallbacks)
    tone({ freq = 440, to = freq, dur = 0.12, type = 'triangle', vol = 0.15, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    blip(name) {
        const map = { doily: [900, 1400], splat: [300, 120], crumble: [500, 200], wallhit: [120, 60], coins: [1200, 1800], quest: [660, 990] };
        const [f, t] = map[name] || [500, 700];
        this.tone({ freq: f, to: t, dur: 0.12 });
    }
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 740, dur: 0.05, vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.08, vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.08, vol: 0.1 });
        else if (kind === 'no') this.tone({ freq: 220, to: 160, dur: 0.15, type: 'square', vol: 0.06 });
    }

    // ------------------------------------------------------------------ sim events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'throw': this.play('doily', { vol: 0.5, gap: 0.08 }); break;
                case 'hit': if (e.by === 'doily' || e.by === 'knight' || e.by === 'bun') this.play('splat', { vol: 0.45, gap: 0.07 }); break;
                case 'calm': this.play('crumble', { vol: 0.55, gap: 0.12 }); break;
                case 'wallHit': this.play('wallhit', { vol: 0.5, gap: 0.18 }); break;
                case 'arrow': this.play('arrow', { vol: 0.35, gap: 0.2 }); break;
                case 'splash': if (e.kind === 'potion') this.play('potion', { vol: 0.5, gap: 0.2 }); break;
                case 'ability': this.play(e.id === 'stomp' ? 'stomp' : 'magic', { vol: 0.8, gap: 0 }); break;
                case 'build': this.play('build', { vol: 0.6, gap: 0.3 }); break;
                case 'built': this.play('build', { vol: 0.35, gap: 0.5, rate: 1.2 }); break;
                case 'hired': case 'trained': case 'delivered': this.play('coins', { vol: 0.7, gap: 0 }); break;
                case 'questDone': this.play('quest', { vol: 0.7, gap: 0 }); break;
                case 'bakeMilestone': this.play('oven', { vol: 0.8, gap: 0 }); break;
                case 'invasion': this.play('bell', { vol: 0.8, gap: 0 }); setTimeout(() => this.play('horn', { vol: 0.8, gap: 0 }), 1400); break;
                case 'kingArrives': case 'kingLooms': this.play('roar', { vol: 0.9, gap: 3 }); break;
                case 'kiss': this.play('kiss', { vol: 1, gap: 0 }); break;
                case 'battleEnd': if (e.result === 'win' || e.result === 'love') { this.play('cheer', { vol: 0.8, gap: 0 }); this.play('coins', { vol: 0.6, gap: 0 }); } break;
                case 'refused': this.ui('no'); break;
            }
        }
    }
}
