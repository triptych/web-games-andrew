// Sound: ElevenLabs music, effects and voices (audio/), with a Web Audio synth standing in for any effect that
// fails to load. The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it in a hidden tab; music plays through <audio> elements routed into a gain
// node, so a hidden tab silences it too.

const SFX = ['match', 'blast', 'nova', 'volley-a', 'volley-b', 'impact', 'kill', 'enemyshot', 'block', 'hit', 'alarm', 'charge', 'beam', 'shatter', 'bigboom', 'route', 'jam', 'shift'];
const VO = {
    juno: ['intro', 'throne', 'launch', 'fire', 'win', 'downed', 'clear', 'rush', 'end'],
    mira: ['intro', 'picket', 'ember', 'glacier', 'storm', 'prism', 'throne', 'fail', 'hull', 'shift', 'exposed', 'end'],
};
const JINGLES = ['win', 'fail'];
const THEMES = ['title', 'battle', 'lance'];
// The music sits under everything (its tracks master around -12 LUFS; the voices are normalised to -15). While a line
// is spoken the music drops to 30% and the effects to 60% (v1.0.1: the intro was lost under the title theme).
const MUSIC_LEVEL = 0.42;
const DUCK = { music: 0.3, sfx: 0.6 };

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.6, voice: 0.9 };
        this.buffers = {};
        this.loaded = 0;
        this.els = {};
        this.theme = null;
        this.want = null;
        this.voiceSrc = null;
        this.voiceUntil = 0;
        this.last = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.out = comp;
        // ducking has gain nodes of its own after the volume buses, so the volume settings and a duck never fight
        // over one automation timeline
        this.duckSfx = ctx.createGain(); this.duckSfx.connect(comp);
        this.duckMusic = ctx.createGain(); this.duckMusic.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.connect(this.duckSfx);
        this.music = ctx.createGain(); this.music.connect(this.duckMusic);
        this.voiceBus = ctx.createGain(); this.voiceBus.connect(comp);
        this.setVolumes(this.vol.sfx, this.vol.music, this.vol.voice);
        const names = [...SFX.map((n) => `sfx-${n}`), ...JINGLES.map((n) => `jingle-${n}`), ...Object.entries(VO).flatMap(([w, ls]) => ls.map((l) => `vo-${w}-${l}`))];
        for (const n of names) {
            fetch(`audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then((b) => ctx.decodeAudioData(b)).then((buf) => {
                    this.buffers[n] = buf;
                    this.loaded++;
                    // a line asked for before its clip decoded (the intro, right after the first tap) plays now
                    const p = this.pendingVoice;
                    if (p && `vo-${p.id}` === n && ctx.currentTime - p.at < 8) { this.pendingVoice = null; this.voice(p.id, true); }
                })
                .catch(() => { /* the synth stands in */ });
        }
        if (this.want) { const w = this.want; this.want = null; this.setTheme(w); }
    }

    setVolumes(sfx, music, voice = this.vol.voice) {
        this.vol = { sfx, music, voice };
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * MUSIC_LEVEL, t, 0.02);
        this.voiceBus.gain.setTargetAtTime(voice, t, 0.02);
    }

    ducked(t = this.ctx?.currentTime ?? 0) { return t < this.voiceUntil; }

    /** Music and effects step back while someone speaks, then ease back in after the line. */
    duck(dur) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.lastDuck = { at: t, dur };        // (an idle bus doesn't advance its automation, so tests read this)
        for (const [node, k] of [[this.duckMusic, DUCK.music], [this.duckSfx, DUCK.sfx]]) {
            const g = node.gain;
            g.cancelScheduledValues(t);
            g.setValueAtTime(g.value, t);
            g.setTargetAtTime(k, t, 0.06);
            g.setTargetAtTime(1, t + dur + 0.15, 0.35);
        }
    }

    // ------------------------------------------------------------------ music
    /** Crossfade to a theme ('title', 'battle', 'lance') or to silence (null). */
    setTheme(theme) {
        if (!this.ctx) { this.want = theme; return; }
        if (theme === this.theme) return;
        this.theme = theme;
        const t = this.ctx.currentTime;
        for (const [name, m] of Object.entries(this.els)) {
            if (name === theme) continue;
            m.g.gain.setTargetAtTime(0, t, 0.35);
            clearTimeout(m.stop);
            m.stop = setTimeout(() => { if (this.theme !== name) m.el.pause(); }, 1600);
        }
        if (!theme || !THEMES.includes(theme)) return;
        let m = this.els[theme];
        if (!m) {
            const el = new window.Audio(`audio/music-${theme}.mp3`);
            el.loop = true;
            el.preload = 'auto';
            const g = this.ctx.createGain();
            g.gain.value = 0;
            try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already wired */ }
            g.connect(this.music);
            m = this.els[theme] = { el, g, stop: 0 };
        }
        clearTimeout(m.stop);
        if (theme !== 'lance') m.el.currentTime = m.el.paused ? 0 : m.el.currentTime;
        else m.el.currentTime = 0;
        m.el.play().catch(() => {});
        m.g.gain.setTargetAtTime(1, t, 0.25);
    }

    /** Is a theme actually playing (for the browser test). */
    playing() { const m = this.els[this.theme]; return !!m && !m.el.paused; }

    jingle(name) {
        const b = this.buffers[`jingle-${name}`];
        if (b) this.buf(b, { bus: this.music, vol: 1.6 });
    }

    // ------------------------------------------------------------------ effects
    buf(buffer, { vol = 1, rate = 1, bus = this.sfx, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return null;
        const s = this.ctx.createBufferSource();
        s.buffer = buffer;
        s.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        s.connect(g); g.connect(bus);
        s.start(this.ctx.currentTime + delay);
        return s;
    }

    /** A named effect, at most once per `gap` seconds; the synth plays it if its file never loaded. */
    play(name, { vol = 1, rate = 1, gap = 0.05, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (now - (this.last[name] || -1) < gap) return;
        this.last[name] = now;
        const b = this.buffers[`sfx-${name}`];
        if (b) this.buf(b, { vol, rate, delay });
        else this.synth(name, delay);
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
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

    synth(name, delay = 0) {
        const T = (o) => this.tone({ ...o, delay });
        switch (name) {
            case 'match': T({ freq: 880, to: 1320, dur: 0.1, type: 'triangle', vol: 0.15 }); break;
            case 'blast': case 'nova': T({ freq: 300, to: 1800, dur: 0.3, type: 'sawtooth', vol: 0.15 }); break;
            case 'volley-a': case 'volley-b': T({ freq: 900, to: 180, dur: 0.18, type: 'sawtooth', vol: 0.12 }); break;
            case 'impact': case 'kill': case 'hit': T({ freq: 160, to: 40, dur: 0.3, type: 'sawtooth', vol: 0.22 }); break;
            case 'enemyshot': T({ freq: 1600, to: 600, dur: 0.12, type: 'square', vol: 0.08 }); break;
            case 'block': T({ freq: 500, to: 900, dur: 0.15, type: 'sine', vol: 0.2 }); break;
            case 'alarm': T({ freq: 880, dur: 0.12, vol: 0.12 }); this.tone({ freq: 660, dur: 0.12, vol: 0.12, delay: delay + 0.18 }); break;
            case 'charge': T({ freq: 120, to: 1600, dur: 1.4, type: 'sawtooth', vol: 0.12 }); break;
            case 'beam': T({ freq: 70, to: 50, dur: 3.5, type: 'sawtooth', vol: 0.25 }); break;
            case 'shatter': case 'bigboom': T({ freq: 90, to: 30, dur: 1.2, type: 'sawtooth', vol: 0.3 }); break;
            case 'route': T({ freq: 330, to: 990, dur: 0.3, type: 'triangle', vol: 0.15 }); break;
            case 'jam': T({ freq: 90, to: 120, dur: 0.2, type: 'square', vol: 0.08 }); break;
            case 'shift': T({ freq: 200, to: 600, dur: 0.6, type: 'sine', vol: 0.15 }); break;
        }
    }

    /** A sub-bass punch under a sample, so cannon fire lands in the chest rather than the ear. */
    thump({ freq = 110, to = 42, dur = 0.2, vol = 0.35, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 760, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'bad') this.tone({ freq: 200, to: 140, dur: 0.12, type: 'square', vol: 0.08 });
    }

    // ------------------------------------------------------------------ voices
    /** Play a voice clip by id ('juno-fire'). One at a time; `force` cuts off the one speaking. */
    voice(id, force = false) {
        if (!this.ctx) return 0;
        if (this.ctx.state !== 'running') { this.pendingVoice = { id, at: this.ctx.currentTime }; return 0; }
        const b = this.buffers[`vo-${id}`];
        if (!b) { this.pendingVoice = { id, at: this.ctx.currentTime }; return 0; }
        const now = this.ctx.currentTime;
        if (now < this.voiceUntil && !force) return 0;
        try { this.voiceSrc?.stop(); } catch { /* ended */ }
        this.voiceSrc = this.buf(b, { bus: this.voiceBus });
        this.voiceUntil = now + b.duration;
        this.duck(b.duration);
        return b.duration;
    }

    // ------------------------------------------------------------------ the sim's events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'clear':
                    this.play('match', { rate: 1 + Math.min(6, e.depth) * 0.09, vol: 0.7, gap: 0.04 });
                    if (e.blasts.some((b) => b.sp === 4)) this.play('nova', { vol: 0.9 });
                    else if (e.blasts.length) this.play('blast', { vol: 0.8 });
                    break;
                case 'swapFail': case 'swapBad': this.ui('bad'); break;
                case 'missile':
                    // one heavy cannon volley per burst of missiles (they come several to a match), two takes alternating
                    if (this.ctx && this.ctx.currentTime - (this.last.volley || -1) >= 0.16) {
                        this.last.volley = this.ctx.currentTime;
                        this.volleyN = (this.volleyN || 0) + 1;
                        this.play(this.volleyN % 2 ? 'volley-a' : 'volley-b', { vol: 0.85, gap: 0, rate: 0.94 + Math.random() * 0.1 });
                        this.thump({ vol: 0.3 });
                    }
                    break;
                case 'droneDown': this.play('kill', { vol: 1, gap: 0.08, rate: 0.92 + Math.random() * 0.12 }); this.thump({ freq: 90, to: 32, dur: 0.45, vol: 0.45 }); break;
                case 'boom': if (!e.dead) { this.play('impact', { vol: 0.7, gap: 0.08, rate: 0.9 + Math.random() * 0.15 }); this.thump({ freq: 140, to: 55, dur: 0.14, vol: 0.22 }); } break;
                case 'shot': this.play('enemyshot', { vol: 0.5, gap: 0.1 }); break;
                case 'hit': if (e.rest > 0) this.play('hit', { vol: 0.9 }); else this.play('block', { vol: 0.8 }); break;
                case 'lowHull': this.play('alarm', { vol: 0.6 }); break;
                case 'jam': this.play('jam', { vol: 0.5 }); break;
                case 'shift': this.play('shift', { vol: 0.8 }); break;
                case 'route': this.play('route', { vol: 0.8 }); break;
                case 'round': this.setTheme('battle'); break;
                case 'exposed': this.setTheme('lance'); break;
                case 'fire': this.setTheme(null); this.play('charge', { vol: 1 }); this.play('beam', { vol: 1, delay: 1.25 }); break;
                case 'stage': if (e.key === 'barrier' && e.ratio >= 1) this.play('shatter', { vol: 1 }); break;
                case 'destroyed': this.play('bigboom', { vol: 1 }); break;
                case 'result': setTimeout(() => this.jingle(e.destroyed ? 'win' : 'fail'), 300); break;
                case 'hangar': this.setTheme('title'); break;
            }
        }
    }
}
