// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a
// music box playing two public-domain carols (Jingle Bells, 1857, and We Wish You a Merry
// Christmas, traditional) through a little generated reverb, with sleigh bells on the beat.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// [midi or null for a rest, beats]
const JINGLE = {
    bpm: 112, bells: true,
    melody: [
        [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
        [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5], [76, 1], [74, 1], [74, 1], [76, 1], [74, 2], [79, 2],
        [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
        [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5], [79, 1], [79, 1], [77, 1], [74, 1], [72, 4],
    ],
    // one root per 4-beat bar
    bass: [48, 48, 48, 48, 53, 48, 43, 43, 48, 48, 48, 48, 53, 48, 43, 48], barBeats: 4,
};
const WISH = {
    bpm: 150, bells: false,
    melody: [
        [74, 1], [79, 1], [79, 0.5], [81, 0.5], [79, 0.5], [78, 0.5], [76, 1], [76, 1], [76, 1],
        [81, 1], [81, 0.5], [83, 0.5], [81, 0.5], [79, 0.5], [78, 1], [74, 1], [74, 1],
        [83, 1], [83, 0.5], [84, 0.5], [83, 0.5], [81, 0.5], [79, 1], [76, 1], [74, 0.5], [74, 0.5],
        [76, 1], [81, 1], [78, 1], [79, 3],
    ],
    bass: [null, 43, 48, 45, 50, 52, 48, 50, 43, 43], barBeats: 3, pickup: 1,
};
const SONGS = [JINGLE, WISH];
// a merge rings a note of this scale, climbing with the treat
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.musicOn = false;
        this.lastBump = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a small room: decaying stereo noise as the impulse
        const len = Math.floor(ctx.sampleRate * 1.6);
        const imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = imp.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        this.verb = ctx.createConvolver();
        this.verb.buffer = imp;
        this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.35;
        this.verb.connect(this.verbOut); this.verbOut.connect(comp);
        // sleigh-bell noise
        const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noise = nb;
        if (this.musicOn) this.startMusic();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    running() { return this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, out = this.sfx, verb = 0 } = {}) {
        if (!this.running()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out);
        if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verb); }
        o.start(t); o.stop(t + dur + 0.02);
    }

    /** A bell: a sine with an inharmonic partial, long decay. */
    bell(midi, { vol = 0.18, delay = 0, dur = 1.2, out = this.sfx, verb = 0.5, at = null } = {}) {
        if (!this.running()) return;
        const f = mtof(midi);
        const t = at ?? this.ctx.currentTime + delay;
        for (const [mul, amp, d] of [[1, 1, dur], [2, 0.35, dur * 0.6], [4.07, 0.12, dur * 0.3]]) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = 'sine';
            o.frequency.value = f * mul;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g); g.connect(out);
            if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verb); }
            o.start(t); o.stop(t + d + 0.05);
        }
    }

    /** Sleigh bells: a burst of high-passed noise. */
    jingle({ vol = 0.08, delay = 0, at = null, out = this.sfx, len = 0.18 } = {}) {
        if (!this.running()) return;
        const t = at ?? this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass'; hp.frequency.value = 7500; hp.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        src.connect(hp); hp.connect(g); g.connect(out);
        src.start(t, Math.random() * 0.2); src.stop(t + len + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, to: 1100, dur: 0.06, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.09, type: 'triangle', vol: 0.1 });
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'drop') this.tone({ freq: 620 - e.tier * 60, to: 300, dur: 0.12, vol: 0.12 });
            else if (e.type === 'bump') {
                const now = this.ctx ? this.ctx.currentTime : 0;
                if (now - this.lastBump < 0.05) continue;
                this.lastBump = now;
                this.tone({ freq: 210 - e.tier * 12, to: 90, dur: 0.09, type: 'triangle', vol: 0.05 + e.power * 0.12 });
            } else if (e.type === 'merge') {
                this.tone({ freq: 300 + e.tier * 40, to: 900 + e.tier * 60, dur: 0.08, vol: 0.12 });   // the pop
                this.bell(SCALE[e.tier] - (e.tier > 6 ? 12 : 0), { vol: 0.16 + e.tier * 0.008, delay: 0.02 });
                if (e.chain > 1) this.bell(SCALE[Math.min(10, e.tier)] + 7, { vol: 0.08, delay: 0.09 });
                if (e.tier >= 6) for (let i = 0; i < 4; i++) this.jingle({ vol: 0.07, delay: i * 0.07 });
            } else if (e.type === 'miracle') {
                [72, 76, 79, 84, 88, 91].forEach((m, i) => this.bell(m, { vol: 0.18, delay: i * 0.09, dur: 1.6 }));
                for (let i = 0; i < 10; i++) this.jingle({ vol: 0.09, delay: i * 0.06 });
            } else if (e.type === 'warn') {
                this.tone({ freq: 330, to: 300, dur: 0.25, type: 'triangle', vol: 0.12 });
                this.tone({ freq: 330, to: 300, dur: 0.25, type: 'triangle', vol: 0.12, delay: 0.3 });
            } else if (e.type === 'over') {
                [79, 76, 72, 67].forEach((m, i) => this.bell(m, { vol: 0.16, delay: i * 0.22, dur: 1.4 }));
            }
        }
    }

    // ------------------------------------------------------------------ music
    startMusic() {
        this.musicOn = true;
        if (!this.ctx || this.timer) return;
        this.song = 0;
        this.noteI = 0;
        this.nextT = this.ctx.currentTime + 0.3;
        this.beat = 0;
        this.timer = setInterval(() => this.schedule(), 100);
    }

    stopMusic() {
        this.musicOn = false;
        clearInterval(this.timer);
        this.timer = null;
    }

    schedule() {
        if (!this.running()) return;
        const ctx = this.ctx;
        // a hidden tab throttles timers; never try to catch up on missed notes
        if (this.nextT < ctx.currentTime - 0.2) this.nextT = ctx.currentTime + 0.05;
        while (this.nextT < ctx.currentTime + 0.35) {
            const S = SONGS[this.song];
            const spb = 60 / S.bpm;
            if (this.noteI >= S.melody.length) {
                // a breath between songs, then the other one
                this.nextT += spb * 3;
                this.song = (this.song + 1) % SONGS.length;
                this.noteI = 0;
                this.beat = 0;
                continue;
            }
            const [m, beats] = S.melody[this.noteI++];
            const t = this.nextT;
            if (m !== null) this.bell(m, { at: t, vol: 0.11, dur: Math.min(1.6, beats * spb * 2.2), out: this.music, verb: 0.6 });
            // the bass on each bar line, sleigh bells on each beat
            const pick = S.pickup || 0;
            for (let b = Math.ceil(this.beat - 1e-6); b < this.beat + beats - 1e-6; b++) {
                const bt = t + (b - this.beat) * spb;
                if (S.bells) this.jingle({ at: bt, vol: b % 2 ? 0.02 : 0.035, out: this.music, len: 0.12 });
                if ((b - pick) >= 0 && (b - pick) % S.barBeats === 0) {
                    const root = S.bass[Math.floor((b - pick) / S.barBeats) + (pick ? 1 : 0)];
                    if (root) this.bell(root, { at: bt, vol: 0.09, dur: spb * S.barBeats, out: this.music, verb: 0.3 });
                }
            }
            this.beat += beats;
            this.nextT += beats * spb;
        }
    }
}
