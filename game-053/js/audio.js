// Web Audio, no files: a small generative score per area (lute plucks over a
// drone, with a frame drum in fights), area ambience, and SFX.

const SCALES = {
    major: [0, 2, 4, 7, 9, 12, 14, 16],
    dorian: [0, 2, 3, 5, 7, 9, 10, 12, 14],
    minor: [0, 2, 3, 5, 7, 8, 10, 12, 14],
    phrygian: [0, 1, 4, 5, 7, 8, 10, 12, 13],
    mixo: [0, 2, 4, 5, 7, 9, 10, 12, 14],
};

const AREAS = {
    title: { root: 50, scale: 'dorian', bpm: 66, density: 0.45, drone: true, pad: true },
    village: { root: 55, scale: 'major', bpm: 92, density: 0.6, drone: true },
    forest: { root: 52, scale: 'dorian', bpm: 72, density: 0.35, drone: true, amb: 'forest' },
    fight: { root: 50, scale: 'minor', bpm: 128, density: 0.55, drone: true, drum: true },
    inn: { root: 57, scale: 'mixo', bpm: 118, density: 0.75, drone: true, drum: 'soft', amb: 'fire' },
    gardens: { root: 60, scale: 'major', bpm: 70, density: 0.4, pad: true, amb: 'birds' },
    gypsy: { root: 52, scale: 'phrygian', bpm: 84, density: 0.55, drone: true },
    shades: { root: 45, scale: 'minor', bpm: 54, density: 0.25, pad: true, amb: 'wind' },
    lair: { root: 38, scale: 'phrygian', bpm: 60, density: 0.3, drone: true, drum: 'slow', amb: 'wind' },
    fields: { root: 53, scale: 'major', bpm: 64, density: 0.3, pad: true, amb: 'crickets' },
    victory: { root: 55, scale: 'major', bpm: 100, density: 0.8, drone: true, pad: true },
};
const ALIAS = { clearing: 'fight', healer: 'forest', notice: 'village', training: 'village', weapons: 'village', armor: 'village', bank: 'village', stables: 'village', stone: 'village', guilds: 'village', lodge: 'village', graveyard: 'shades', mausoleum: 'shades', dawn: 'village' };

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
    constructor(prefs) {
        this.prefs = { ...prefs };
        this.ctx = null;
        this.area = 'title';
        this.step = 0;
        this.nextT = 0;
        this.lastSfx = {};
    }
    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = this.prefs.volume;
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(c.destination);
        this.music = c.createGain(); this.music.gain.value = this.prefs.music ? 0.32 : 0;
        this.fx = c.createGain(); this.fx.gain.value = this.prefs.sound ? 0.7 : 0;
        this.amb = c.createGain(); this.amb.gain.value = this.prefs.music ? 0.22 : 0;
        this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.4);
        const vg = c.createGain(); vg.gain.value = 0.35;
        this.verb.connect(vg); vg.connect(this.master);
        this.music.connect(this.master); this.music.connect(this.verb);
        this.fx.connect(this.master); this.fx.connect(this.verb);
        this.amb.connect(this.master);
        this.noise = this.noiseBuf();
        this.nextT = c.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 90);
        this.startAmb();
    }
    apply(prefs) {
        this.prefs = { ...prefs };
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(prefs.volume, t, 0.05);
        this.music.gain.setTargetAtTime(prefs.music ? 0.32 : 0, t, 0.2);
        this.amb.gain.setTargetAtTime(prefs.music ? 0.22 : 0, t, 0.2);
        this.fx.gain.setTargetAtTime(prefs.sound ? 0.7 : 0, t, 0.05);
    }
    setArea(a) {
        const k = AREAS[a] ? a : ALIAS[a] || (a?.endsWith('fight') ? 'fight' : 'village');
        if (k === this.area) return;
        this.area = k; this.step = 0;
        this.startAmb();
    }

    impulse(sec) {
        const c = this.ctx, len = Math.floor(c.sampleRate * sec);
        const b = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        return b;
    }
    noiseBuf() {
        const c = this.ctx, len = c.sampleRate * 2;
        const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    // ------------------------------------------------------------ instruments
    pluck(freq, t, dur = 0.8, vol = 0.18, out = this.music) {
        const c = this.ctx;
        const o1 = c.createOscillator(), o2 = c.createOscillator();
        o1.type = 'triangle'; o2.type = 'sawtooth';
        o1.frequency.value = freq; o2.frequency.value = freq * 1.003;
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(freq * 8, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), t + dur * 0.6);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const g2 = c.createGain(); g2.gain.value = 0.25;
        o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(out);
        o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    tone(freq, t, dur, vol, type = 'sine', out = this.music, attack = 0.01) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
        return o;
    }
    pad(freq, t, dur, vol = 0.05) {
        const c = this.ctx;
        for (const det of [-6, 5]) {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
            const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
        }
    }
    drum(t, vol = 0.3, low = true) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(low ? 110 : 180, t); o.frequency.exponentialRampToValueAtTime(low ? 45 : 90, t + 0.18);
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.3);
        this.noiseHit(t, 0.06, vol * 0.25, 2500, this.music);
    }
    noiseHit(t, dur, vol, freq = 1200, out = this.fx, type = 'bandpass') {
        const c = this.ctx;
        const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------ the score
    schedule() {
        const c = this.ctx; if (!c || c.state !== 'running') return;
        const A = AREAS[this.area];
        const spb = 60 / A.bpm / 2; // eighth notes
        const sc = SCALES[A.scale];
        while (this.nextT < c.currentTime + 0.25) {
            const t = this.nextT, s = this.step;
            const bar = Math.floor(s / 8), beat = s % 8;
            const chordRoot = [0, 0, 5, 3, 0, 4, 3, 0][bar % 8] ?? 0;
            if (this.prefs.music) {
                if (beat === 0 && A.drone) { this.tone(mtof(A.root - 12 + chordRoot), t, spb * 8.5, 0.06, 'sawtooth', this.music, 0.2); this.tone(mtof(A.root - 5 + chordRoot), t, spb * 8.5, 0.03, 'triangle', this.music, 0.3); }
                if (beat === 0 && A.pad && bar % 2 === 0) { for (const iv of [0, 4, 7]) this.pad(mtof(A.root + chordRoot + (A.scale === 'major' || A.scale === 'mixo' ? iv : iv === 4 ? 3 : iv)), t, spb * 16, 0.025); }
                if (Math.random() < A.density * (beat % 2 === 0 ? 1 : 0.55)) {
                    this.mel = this.mel ?? 2;
                    this.mel = Math.max(0, Math.min(sc.length - 1, this.mel + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
                    const n = A.root + sc[this.mel] + (Math.random() < 0.15 ? 12 : 0);
                    this.pluck(mtof(n), t, spb * (beat % 4 === 0 ? 5 : 3), 0.11);
                    if (beat === 0 && Math.random() < 0.6) this.pluck(mtof(A.root + chordRoot - 12 + 7), t, spb * 6, 0.07);
                }
                if (A.drum === true) { if (beat === 0 || beat === 4) this.drum(t, 0.22); if (beat === 6 && Math.random() < 0.5) this.drum(t, 0.12, false); if (beat % 2 === 1) this.noiseHit(t, 0.03, 0.03, 6000, this.music, 'highpass'); }
                else if (A.drum === 'soft') { if (beat === 0) this.drum(t, 0.12); if (beat === 4 || beat === 6) this.drum(t, 0.07, false); }
                else if (A.drum === 'slow') { if (beat === 0 && bar % 2 === 0) this.drum(t, 0.25); }
            }
            this.nextT += spb; this.step++;
        }
    }

    startAmb() {
        if (!this.ctx) return;
        if (this.ambNodes) { for (const n of this.ambNodes) try { n.stop(); } catch { /* */ } }
        this.ambNodes = [];
        clearInterval(this.ambTimer);
        const A = AREAS[this.area]; const c = this.ctx;
        const kind = A.amb;
        if (!kind) return;
        if (kind === 'wind' || kind === 'forest') {
            const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'wind' ? 500 : 800;
            const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency);
            const g = c.createGain(); g.gain.value = 0.25;
            s.connect(f); f.connect(g); g.connect(this.amb); s.start(); lfo.start();
            this.ambNodes.push(s, lfo);
        }
        this.ambTimer = setInterval(() => {
            if (!this.prefs.music || c.state !== 'running') return;
            const t = c.currentTime + 0.05;
            if ((kind === 'forest' || kind === 'birds') && Math.random() < 0.35) {
                const base = 2000 + Math.random() * 2000;
                for (let i = 0; i < 1 + Math.floor(Math.random() * 4); i++) {
                    const o = c.createOscillator(); o.type = 'sine';
                    const tt = t + i * 0.12;
                    o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), tt + 0.08);
                    const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
                    o.connect(g); g.connect(this.amb); o.start(tt); o.stop(tt + 0.12);
                }
            }
            if (kind === 'crickets') for (let i = 0; i < 3; i++) this.tone(4400 + Math.random() * 200, t + i * 0.05, 0.03, 0.03, 'square', this.amb, 0.003);
            if (kind === 'fire') for (let i = 0; i < 3; i++) if (Math.random() < 0.6) this.noiseHit(t + Math.random() * 0.4, 0.02, 0.12, 3000, this.amb);
        }, 400);
    }

    // ------------------------------------------------------------ sfx
    sfx(name) {
        const c = this.ctx; if (!c || !this.prefs.sound) return;
        const now = c.currentTime;
        if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return;
        this.lastSfx[name] = now;
        const t = now + 0.01, fx = this.fx;
        const seq = (notes, step, vol = 0.2, type = 'triangle', dur = 0.3) => notes.forEach((n, i) => this.tone(mtof(n), t + i * step, dur, vol, type, fx));
        switch (name) {
            case 'click': this.tone(1400, t, 0.04, 0.05, 'square', fx, 0.002); break;
            case 'hit': this.noiseHit(t, 0.12, 0.5, 900); this.tone(180, t, 0.12, 0.2, 'square', fx, 0.003); break;
            case 'power': this.noiseHit(t, 0.25, 0.7, 700); this.tone(120, t, 0.3, 0.3, 'sawtooth', fx, 0.003); seq([76, 83], 0.06, 0.12); break;
            case 'miss': { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.15); const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.connect(f); f.connect(g); g.connect(fx); s.start(t); s.stop(t + 0.2); break; }
            case 'hurt': this.noiseHit(t, 0.15, 0.5, 400, fx, 'lowpass'); this.tone(90, t, 0.2, 0.3, 'sawtooth', fx, 0.003); break;
            case 'breath': this.noiseHit(t, 1.1, 0.6, 600, fx, 'lowpass'); this.tone(60, t, 1, 0.25, 'sawtooth', fx, 0.1); break;
            case 'heal': seq([72, 76, 79, 84], 0.07, 0.1, 'sine', 0.4); break;
            case 'coin': seq([88, 93], 0.06, 0.1, 'square', 0.15); break;
            case 'gem': seq([84, 88, 91, 96, 100], 0.05, 0.08, 'sine', 0.5); break;
            case 'buy': seq([79, 84, 88], 0.06, 0.12, 'triangle', 0.25); this.noiseHit(t, 0.1, 0.2, 5000); break;
            case 'levelup': seq([67, 72, 76, 79, 84], 0.11, 0.18, 'triangle', 0.5); seq([55, 60, 64], 0.11, 0.1, 'sawtooth', 0.6); break;
            case 'fanfare': seq([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.13, 0.18, 'sawtooth', 0.5); break;
            case 'victory': seq([72, 79], 0.08, 0.12, 'triangle', 0.3); break;
            case 'death': seq([57, 53, 50, 45], 0.35, 0.18, 'sawtooth', 0.9); this.tone(mtof(33), t, 2.5, 0.2, 'sine', fx, 0.05); break;
            case 'fail': seq([64, 60], 0.18, 0.14, 'triangle', 0.4); break;
            case 'newday': seq([72, 79, 84, 88, 91], 0.16, 0.12, 'sine', 1.2); break;
            case 'chat': this.tone(1800, t, 0.05, 0.025, 'sine', fx, 0.003); break;
            case 'raven': { const o = this.tone(700, t, 0.25, 0.12, 'sawtooth', fx, 0.01); o.frequency.exponentialRampToValueAtTime(380, t + 0.2); break; }
            case 'deed': seq([79, 83, 86, 91], 0.08, 0.12, 'triangle', 0.5); break;
            case 'magic': seq([84, 91, 88, 96, 93, 100], 0.05, 0.07, 'sine', 0.6); break;
            case 'drink': for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 200, t + i * 0.09, 0.08, 0.08, 'sine', fx); break;
            case 'lute': for (let i = 0; i < 6; i++) this.pluck(mtof([60, 64, 67, 72, 67, 64][i]), t + i * 0.12, 0.9, 0.15, fx); break;
            case 'roar': { this.noiseHit(t, 1.6, 0.8, 300, fx, 'lowpass'); const o = this.tone(80, t, 1.5, 0.35, 'sawtooth', fx, 0.15); o.frequency.exponentialRampToValueAtTime(45, t + 1.4); break; }
        }
    }

    combat(events) {
        let i = 0;
        for (const e of events.slice(0, 6)) {
            const d = i++ * 140;
            const name = e.type === 'heal' ? 'heal' : e.type === 'miss' ? 'miss' : e.type === 'breath' ? 'breath' : e.who === 'you' ? 'hurt' : e.type === 'power' ? 'power' : 'hit';
            setTimeout(() => { this.lastSfx[name] = 0; this.sfx(name); }, d);
        }
    }
}
