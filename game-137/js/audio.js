// Sound. Effects, voices and music are ElevenLabs recordings (audio/, listed in media.js). Effects
// and voices are decoded into AudioBuffers; music plays through <audio> elements routed into a
// gain node, so ../lib/page-audio.js still silences a hidden tab. Anything that fails to load
// falls back to a little Web Audio synth (effects) or silence (music, voices): never an error.

import { SFX, MUSIC, VOICES, ROOT } from './media.js';

const SYNTH = {
    vulcan: [{ freq: 220, to: 120, dur: 0.05, type: 'square', vol: 0.06 }],
    rocket: [{ freq: 300, to: 900, dur: 0.25, type: 'sawtooth', vol: 0.06 }],
    laser: [{ freq: 1800, to: 400, dur: 0.25, type: 'sawtooth', vol: 0.08 }],
    mortar: [{ freq: 120, to: 60, dur: 0.25, type: 'sine', vol: 0.25 }],
    boom: [{ freq: 140, to: 40, dur: 0.35, type: 'sawtooth', vol: 0.18 }],
    bigboom: [{ freq: 90, to: 30, dur: 0.9, type: 'sawtooth', vol: 0.3 }],
    shatter: [{ freq: 1600, to: 2400, dur: 0.08, type: 'triangle', vol: 0.08 }],
    crumble: [{ freq: 180, to: 90, dur: 0.15, type: 'square', vol: 0.06 }],
    pickup: [{ freq: 1300, to: 1800, dur: 0.06, type: 'sine', vol: 0.08 }],
    levelup: [523, 659, 784, 1046].map((f, i) => ({ freq: f, dur: 0.18, type: 'triangle', delay: i * 0.08 })),
    overdrive: [{ freq: 200, to: 1200, dur: 0.8, type: 'sawtooth', vol: 0.12 }],
    hurt: [{ freq: 200, to: 80, dur: 0.18, type: 'square', vol: 0.12 }],
    shield: [{ freq: 600, to: 300, dur: 0.15, type: 'sine', vol: 0.12 }],
    stomp: [{ freq: 90, to: 40, dur: 0.3, type: 'sine', vol: 0.3 }],
    step: [{ freq: 70, to: 50, dur: 0.08, type: 'sine', vol: 0.12 }],
    rescue: [{ freq: 660, dur: 0.12, type: 'triangle' }, { freq: 990, dur: 0.25, type: 'triangle', delay: 0.12 }],
    roar: [{ freq: 90, to: 60, dur: 1.2, type: 'sawtooth', vol: 0.2 }],
    alarm: [{ freq: 700, dur: 0.3, type: 'square', vol: 0.06 }, { freq: 500, dur: 0.3, type: 'square', vol: 0.06, delay: 0.35 }],
    click: [{ freq: 900, dur: 0.04, type: 'triangle', vol: 0.1 }],
    open: [{ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.1 }],
    buy: [{ freq: 880, dur: 0.08, type: 'square', vol: 0.06 }, { freq: 1320, dur: 0.12, type: 'square', vol: 0.06, delay: 0.08 }],
    gift: [{ freq: 1046, dur: 0.15, type: 'sine' }, { freq: 1568, dur: 0.25, type: 'sine', delay: 0.12 }],
    clear: [523, 659, 784, 1046, 1318].map((f, i) => ({ freq: f, dur: 0.25, type: 'square', vol: 0.08, delay: i * 0.1 })),
    fail: [{ freq: 440, to: 110, dur: 1.0, type: 'sawtooth', vol: 0.1 }],
    spit: [{ freq: 400, to: 150, dur: 0.1, type: 'sine', vol: 0.06 }],
    hatch: [{ freq: 800, to: 300, dur: 0.1, type: 'triangle', vol: 0.06 }],
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6; this.voiceVol = 0.9;
        this.buffers = {};
        this.voices = {};
        this.music = { el: null, which: null, want: null, i: 0 };
        this.last = {};
        this.voice = { src: null, queue: [], lowHp: false };
        this.stepT = 0;
    }

    /** Made on the first user gesture (browsers block audio before one). */
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.master = comp;
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 256; comp.connect(this.meter);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol * 0.8; this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.5; this.mus.connect(comp);
        this.vox = ctx.createGain(); this.vox.gain.value = this.voiceVol; this.vox.connect(comp);
        const load = (name, path, into) => fetch(ROOT + path)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((a) => ctx.decodeAudioData(a))
            .then((b) => { into[name] = b; })
            .catch(() => { /* the synth or silence stands in */ });
        this.loading = Promise.all([
            ...SFX.map((n) => load(n, `audio/sfx-${n}.mp3`, this.buffers)),
            ...VOICES.map((n) => load(n, `audio/vo-${n}.mp3`, this.voices)),
        ]);
        if (this.music.want) { const w = this.music.want; this.music.which = null; this.playMusic(w); }
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx * 0.8, t, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.5, t, 0.05);
        this.vox.gain.setTargetAtTime(voice, t, 0.02);
    }
    running() { return !!(this.ctx && this.ctx.state === 'running'); }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0 } = {}) {
        if (!this.running()) return;
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

    /** An effect: the recording if it loaded, else the synth. gap: the same clip again within it is dropped. */
    play(name, { rate = 1, vol = 1, delay = 0, gap = 0.05 } = {}) {
        if (!this.running()) return;
        const now = this.ctx.currentTime;
        if (!delay && this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const b = this.buffers[name];
        if (!b) { for (const t of SYNTH[name] || []) this.tone({ ...t, delay: (t.delay || 0) + delay, freq: t.freq * rate, to: (t.to || t.freq) * rate }); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = b; src.playbackRate.value = rate;
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(now + delay);
    }

    /** A voice line. One at a time; at most one waits its turn, the rest are dropped (no chatter). */
    say(name, { force = false } = {}) {
        if (!this.running() || !this.voices[name]) return false;
        if (this.voice.src) {
            if (force) { try { this.voice.src.stop(); } catch { /* */ } this.voice.src = null; this.voice.queue.length = 0; }
            else { if (this.voice.queue.length < 1) this.voice.queue.push(name); return true; }
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.voices[name];
        src.connect(this.vox);
        src.onended = () => { if (this.voice.src === src) { this.voice.src = null; const n = this.voice.queue.shift(); if (n) this.say(n); } };
        src.start();
        this.voice.src = src;
        // duck the music under speech
        this.mus.gain.setTargetAtTime(this.musicVol * 0.25, this.ctx.currentTime, 0.1);
        setTimeout(() => { if (!this.voice.src && this.ctx) this.mus.gain.setTargetAtTime(this.musicVol * 0.5, this.ctx.currentTime, 0.3); }, src.buffer.duration * 1000 + 100);
        return true;
    }
    shutUp() { if (this.voice.src) { try { this.voice.src.stop(); } catch { /* */ } } this.voice.src = null; this.voice.queue.length = 0; }
    voiceDuration(name) { return this.voices[name]?.duration || 0; }

    ui(kind) { this.play(kind, { vol: 0.7 }); }

    /** 'title', 'hangar', 'battle', 'boss' or null. The two battle themes take turns. */
    playMusic(which) {
        this.music.want = which;
        if (!this.ctx || this.music.which === which) return;
        this.music.which = which;
        const old = this.music.el;
        if (old) this.fadeOut(old);
        this.music.el = null;
        if (!which) return;
        const src = which === 'battle' ? MUSIC.battle[this.music.i++ % MUSIC.battle.length] : MUSIC[which];
        const el = new window.Audio();
        el.src = ROOT + src;
        el.loop = which !== 'battle';
        el.crossOrigin = 'anonymous';
        try {
            const node = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain();
            g.gain.value = 0.0001;
            g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
            node.connect(g); g.connect(this.mus);
            el._g = g;
        } catch { /* already routed */ }
        if (which === 'battle') el.addEventListener('ended', () => { if (this.music.el === el) { this.music.which = null; this.playMusic('battle'); } });
        el.addEventListener('error', () => { if (this.music.el === el) this.music.el = null; });
        el.play().catch(() => { /* a later gesture resumes it */ });
        this.music.el = el;
    }
    fadeOut(el) {
        if (el._g && this.ctx) el._g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
        setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); }, 1500);
    }
    /** Is a tune actually playing? (for the tests) */
    playing() { return !!(this.music.el && !this.music.el.paused); }
    /** Peak level on the master bus, 0..1 (for the tests). */
    level() {
        if (!this.meter) return 0;
        const a = new Uint8Array(this.meter.fftSize);
        this.meter.getByteTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v - 128));
        return m / 128;
    }

    /** Footsteps while the mech walks, and the low-HP shout once a sortie. */
    tick(G, dt) {
        const R = G.run;
        if (!R || R.over || R.choice) return;
        const M = R.mech, sp = Math.hypot(M.vx, M.vy);
        this.stepT -= dt * sp;
        if (sp > 0.5 && this.stepT <= 0) { this.stepT = 2.6; this.play('step', { vol: 0.5, rate: 0.9 + Math.random() * 0.2 }); }
        if (M.hp < M.maxHp * 0.3 && !this.voice.lowHp) { this.voice.lowHp = true; this.say('kai-lowhp'); }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'fire':
                    if (e.part === 'vulcan') this.play('vulcan', { vol: 0.35, gap: 0.12, rate: 0.95 + Math.random() * 0.1 });
                    else if (e.part === 'scatter') this.play('vulcan', { vol: 0.6, rate: 0.7, gap: 0.2 });
                    else if (e.part === 'rockets') this.play('rocket', { vol: 0.5, gap: 0.15 });
                    else if (e.part === 'mortar') this.play('mortar', { vol: 0.7 });
                    break;
                case 'beam': this.play('laser', { vol: 0.55, gap: 0.2 }); break;
                case 'kill': if (e.boss) this.play('bigboom', { vol: 1 }); else this.play('shatter', { vol: 0.45, rate: 0.8 + Math.random() * 0.5, gap: 0.04 }); break;
                case 'boom': this.play('boom', { vol: e.from === 'monster' ? 0.8 : 0.5, gap: 0.07, rate: 0.9 + Math.random() * 0.2 }); break;
                case 'hive_down': this.play('bigboom'); break;
                case 'break': this.play('crumble', { vol: 0.45, gap: 0.09, rate: 0.85 + Math.random() * 0.3 }); break;
                case 'collect': this.play('pickup', { vol: 0.35, gap: 0.035, rate: e.c === 'gold' ? 1.3 : e.c === 'red' ? 1 : 0.85 }); break;
                case 'levelup': this.play('levelup'); if (Math.random() < 0.4) this.say('kai-levelup'); break;
                case 'overdrive': this.play('overdrive'); this.say('kai-overdrive', { force: true }); break;
                case 'hurt': this.play(e.shield ? 'shield' : 'hurt', { vol: 0.7, gap: 0.12 }); break;
                case 'stomp': this.play('stomp'); break;
                case 'rescue': this.play('rescue'); this.say('mirei-rescue'); break;
                case 'boss_in': this.play('roar'); this.play('alarm', { vol: 0.5 }); this.say('mirei-boss', { force: true }); this.say('kai-boss'); this.playMusic('boss'); break;
                case 'boss_wind': this.play('roar', { vol: 0.35, rate: 1.4, gap: 0.5 }); break;
                case 'boss_act': if (e.act === 'stomp') this.play('stomp', { rate: 0.7 }); break;
                case 'evac': this.play('alarm', { vol: 0.4 }); this.say('mirei-evac', { force: true }); break;
                case 'clear': this.play('clear'); this.say('mirei-clear', { force: true }); break;
                case 'fail': this.play('fail'); this.say('mirei-down', { force: true }); break;
                case 'spit': this.play('spit', { vol: 0.3, gap: 0.1 }); break;
                case 'hatch': this.play('hatch', { vol: 0.3, gap: 0.15 }); break;
                case 'launch': this.voice.lowHp = false; this.say('mirei-launch', { force: true }); this.say('kai-launch'); break;
                case 'bought': case 'upgraded': this.play('buy'); break;
                case 'equip': this.play('click'); break;
                case 'gift': this.play('gift', { gap: 0.15 }); break;
                case 'nope': this.play('hurt', { vol: 0.3, rate: 1.6 }); break;
            }
        }
    }
}
