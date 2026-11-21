// Sound: ElevenLabs music, effects and voices (audio/), with a Web Audio synth for rapid-fire sounds and as a
// fallback for anything that fails to load. The context is made on the first user gesture; ../lib/page-audio.js
// suspends it while the tab is hidden, and the music <audio> elements are routed through it so they fall silent too.

const SFX = ['explode-s', 'explode-l', 'boss-die', 'bomb', 'warp', 'powerup', 'shield', 'death', 'warning', 'laser', 'rocket', 'burst', 'extend', 'roar', 'engine', 'capital', 'synergy'];

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.6, voice: 0.9 };
        this.buf = {};
        this.voiceBuf = {};
        this.music = { name: null, els: [], cur: 0 };
        this.lastAt = {};
        this.voiceSrc = null;
        this.loaded = 0;
        this.failed = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = comp;
        this.sfx = ctx.createGain(); this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.connect(comp);
        this.duck = ctx.createGain(); this.duck.connect(this.mus);
        this.vox = ctx.createGain(); this.vox.connect(comp);
        // a meter for the browser test: peak level of everything that comes out
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 256; comp.connect(this.meter);
        this.setVolumes(this.vol);
        // a little noise buffer for the synth
        const n = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const d = n.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noise = n;
        for (const s of SFX) this.load(s);
        if (this.music.want) this.playMusic(this.music.want, true);
    }

    load(name) {
        fetch(`audio/sfx/${name}.mp3`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then((ab) => this.ctx.decodeAudioData(ab))
            .then((b) => { this.buf[name] = b; this.loaded++; })
            .catch(() => { this.failed++; });
    }

    setVolumes(v) {
        Object.assign(this.vol, v);
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.02);
        this.mus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.05);
        this.vox.gain.setTargetAtTime(this.vol.voice * 1.1, t, 0.02);
    }

    level() {
        if (!this.meter) return 0;
        const a = new Uint8Array(this.meter.fftSize);
        this.meter.getByteTimeDomainData(a);
        let p = 0;
        for (const v of a) p = Math.max(p, Math.abs(v - 128));
        return p / 128;
    }

    // ------------------------------------------------------------------ music
    playMusic(name, force = false) {
        this.music.want = name;
        if (!this.ctx || (!force && this.music.name === name)) return;
        this.music.name = name;
        const M = this.music;
        const old = M.els[M.cur];
        if (old) {
            const g = old._gain;
            g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
            setTimeout(() => { if (M.els[M.cur] !== old) old.pause(); }, 1600);
        }
        if (!name) return;
        M.cur = 1 - M.cur;
        let el = M.els[M.cur];
        if (!el) {
            el = document.createElement('audio');
            el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
            const src = this.ctx.createMediaElementSource(el);
            el._gain = this.ctx.createGain();
            src.connect(el._gain); el._gain.connect(this.duck);
            M.els[M.cur] = el;
        }
        el.src = `audio/music/${name}.mp3`;
        el._gain.gain.setValueAtTime(0, this.ctx.currentTime);
        el._gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
        el.play().catch(() => { /* blocked until a gesture; init() retries */ });
    }
    musicPlaying() { const el = this.music.els[this.music.cur]; return !!el && !el.paused; }

    // ------------------------------------------------------------------ one-shots
    play(name, { vol = 1, rate = 1, gap = 0.04 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return false;
        const now = this.ctx.currentTime;
        if (now - (this.lastAt[name] || 0) < gap) return false;
        this.lastAt[name] = now;
        const b = this.buf[name];
        if (!b) { this.synthFallback(name, vol); return false; }
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        s.connect(g); g.connect(this.sfx);
        s.start();
        return true;
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, dest } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    hiss({ dur = 0.2, vol = 0.2, freq = 2000, q = 1, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noise;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t); s.stop(t + dur + 0.02);
    }
    synthFallback(name, vol) {
        if (name.startsWith('explode') || name === 'boss-die' || name === 'death' || name === 'engine') { this.hiss({ dur: 0.5, vol: 0.4 * vol, freq: 400 }); this.tone({ freq: 120, to: 40, dur: 0.4, type: 'sawtooth', vol: 0.2 * vol }); }
        else if (name === 'powerup' || name === 'extend' || name === 'synergy') [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.15, delay: i * 0.05 }));
        else this.tone({ freq: 500, to: 900, dur: 0.15, type: 'triangle', vol: 0.12 });
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, to: 1320, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'move') this.tone({ freq: 660, dur: 0.03, type: 'square', vol: 0.05 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'text') this.tone({ freq: 1500 + Math.random() * 200, dur: 0.02, type: 'square', vol: 0.025 });
    }

    // ------------------------------------------------------------------ voices
    async voice(id) {
        if (!this.ctx) return 0;
        this.stopVoice();
        let b = this.voiceBuf[id];
        if (!b) {
            try {
                const r = await fetch(`audio/vo/${id}.mp3`);
                if (!r.ok) return 0;
                b = this.voiceBuf[id] = await this.ctx.decodeAudioData(await r.arrayBuffer());
            } catch { return 0; }
        }
        if (this.ctx.state !== 'running') return 0;
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.connect(this.vox);
        s.start();
        this.voiceSrc = s;
        // duck the music under the voice
        const t = this.ctx.currentTime;
        this.duck.gain.setTargetAtTime(0.45, t, 0.08);
        s.onended = () => { if (this.voiceSrc === s) { this.voiceSrc = null; this.duck.gain.setTargetAtTime(1, this.ctx.currentTime, 0.3); } };
        return b.duration;
    }
    stopVoice() { if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* */ } this.voiceSrc = null; this.duck?.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2); } }
    /** Fetch and decode a scene's lines ahead of time. */
    preload(ids) {
        if (!this.ctx) return;
        for (const id of ids) if (!this.voiceBuf[id]) fetch(`audio/vo/${id}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((ab) => ab && this.ctx.decodeAudioData(ab)).then((b) => { if (b) this.voiceBuf[id] = b; }).catch(() => {});
    }

    // ------------------------------------------------------------------ the game
    frame(G) {
        // the guns: a soft synth tick at most every 70 ms (sampled guns at 14 shots a second just roar)
        const fired = (G.firing || 0) !== this.lastFiring;
        this.lastFiring = G.firing || 0;
        if (fired && G.phase === 'play' && G.player.dead <= 0) {
            const now = this.ctx?.currentTime || 0;
            if (now - (this.lastAt.gun || 0) > 0.075) {
                this.lastAt.gun = now;
                const k = { sora: [1800, 900], kaito: [1200, 500], lyra: [2400, 1400] }[G.pilot] || [1500, 800];
                this.tone({ freq: k[0], to: k[1], dur: 0.04, type: 'square', vol: 0.025 });
            }
        }
        const n = G.beams.length;
        if (n > (this.beams || 0)) this.play('laser', { vol: 0.55, gap: 0.5 });
        this.beams = n;
    }

    onEvents(G, events) {
        let kills = 0;
        for (const e of events) {
            switch (e.type) {
                case 'kill':
                    if (e.big) this.play('explode-l', { vol: 0.9, rate: 0.9 + Math.random() * 0.2, gap: 0.08 });
                    else if (kills++ < 2) this.play('explode-s', { vol: 0.45, rate: 0.85 + Math.random() * 0.35, gap: 0.03 });
                    break;
                case 'boom': this.play('explode-s', { vol: 0.3, rate: 1.3, gap: 0.05 }); break;
                case 'bomb': this.play('bomb', { vol: 1, gap: 0.2 }); this.play('explode-l', { vol: 0.7, rate: 0.7, gap: 0 }); break;
                case 'warp': this.play('warp', { vol: 0.8 }); break;
                case 'burst': this.play('burst', { vol: 1 }); break;
                case 'powerup': this.play('powerup', { vol: 0.7, gap: 0.08 }); break;
                case 'synergy': this.play('synergy', { vol: 0.9, gap: 0.3 }); break;
                case 'shieldHit': this.play('shield', { vol: 0.9 }); break;
                case 'die': this.play('death', { vol: 1 }); this.play('explode-l', { vol: 0.8, rate: 0.8, gap: 0 }); break;
                case 'extend': this.play('extend', { vol: 0.9 }); break;
                case 'rockets': this.play('rocket', { vol: 0.25, gap: 0.25, rate: 0.9 + Math.random() * 0.2 }); break;
                case 'graze': this.tone({ freq: 2600, to: 3400, dur: 0.03, type: 'sine', vol: 0.04 }); break;
                case 'gems': this.tone({ freq: 1760, to: 2640, dur: 0.06, type: 'triangle', vol: 0.05 }); break;
                case 'warning': this.play('warning', { vol: 0.9, gap: 1 }); break;
                case 'boss': if (e.key === 'wyrm' || e.key === 'mother' || e.key === 'heart') this.play('roar', { vol: 1, rate: e.key === 'heart' ? 0.8 : 1 }); this.playMusic(e.key === 'heart' ? 'final' : 'boss'); break;
                case 'phase': this.play('explode-l', { vol: 0.8, rate: 0.8 }); break;
                case 'bossDie': this.play('boss-die', { vol: 1 }); for (let i = 1; i < 6; i++) setTimeout(() => this.play('explode-l', { vol: 0.8, rate: 0.7 + Math.random() * 0.4, gap: 0 }), i * 450); break;
                case 'engineDown': this.play('engine', { vol: 1 }); break;
                case 'capital': this.play('capital', { vol: 0.9 }); break;
                case 'capitalBreak': this.play('boss-die', { vol: 0.9 }); this.play('engine', { vol: 0.8, rate: 0.8, gap: 0 }); break;
                case 'eye': this.tone({ freq: e.open ? 180 : 260, to: e.open ? 90 : 130, dur: 0.3, type: 'sawtooth', vol: 0.08 }); break;
                case 'hatch': this.tone({ freq: 300, to: 900, dur: 0.12, type: 'sine', vol: 0.06 }); break;
                default: break;
            }
        }
    }
}
