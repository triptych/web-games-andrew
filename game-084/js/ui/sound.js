// SOUND and MUSIC: eight effects a cart plays with sfx(n), and one 32-step song with a lead,
// a bass and drums. The tracker's rows are a pentatonic scale, so anything you tap sounds fine.

import { V } from '../runtime/index.js';
import { el } from './dom.js';

const SLOT_NAMES = ['0', '1', '2', '3', '4', '5', '6', '7'];

export class SoundEditor {
    constructor(bench) { this.b = bench; this.slot = 0; }
    get cart() { return this.b.cart; }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        this.slots = el('div', { class: 'toolbar' });
        this.form = el('div', { class: 'formgrid' });
        this.graph = el('canvas', { width: 280, height: 90, style: { width: '280px', maxWidth: '100%', height: '90px', background: '#02040b', border: '1px solid var(--line)' } });
        const presets = el('div', { class: 'toolbar' }, Object.keys(V.SFX_PRESETS).map((k) => el('button', { class: 'tool', onclick: () => { this.b.snapshot(); this.cart.sounds[this.slot] = { ...V.SFX_PRESETS[k] }; this.b.stat('sfx', 1); this.b.changed('sound'); this.refresh(); this.test(); } }, el('small', {}, k))));
        root.append(el('div', { class: 'ed' }, [
            el('div', { class: 'ed-col', style: { flex: '1 1 320px' } }, [
                el('div', { class: 'panel' }, [el('h4', {}, 'Effects: sfx(0) … sfx(7)'), this.slots]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Shape'), this.form, el('div', { class: 'btnrow', style: { marginTop: '10px' } }, [el('button', { class: 'btn play', onclick: () => this.test() }, '▶ Test')])]),
            ]),
            el('div', { class: 'ed-col', style: { flex: '1 1 280px' } }, [
                el('div', { class: 'panel' }, [el('h4', {}, 'Pitch over time'), this.graph]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Start from a preset'), presets]),
            ]),
        ]));
        this.refresh();
    }
    test() { this.b.audio.init(); this.b.audio.synth.sfx(this.cart.sounds[this.slot]); this.b.view?.pulseScope(0.8); }
    refresh() {
        this.slots.innerHTML = '';
        SLOT_NAMES.forEach((n, i) => this.slots.append(el('button', { class: 'tool' + (i === this.slot ? ' on' : ''), onclick: () => { this.slot = i; this.refresh(); this.test(); } }, n)));
        const s = this.cart.sounds[this.slot];
        this.form.innerHTML = '';
        const set = (k, v) => { this.b.snapshot(true); s[k] = v; this.b.changed('sound'); this.drawGraph(); };
        const slider = (k, label, lo, hi, step, fmt) => {
            const out = el('output', {}, fmt(s[k]));
            this.form.append(el('label', {}, label), el('div', { class: 'val' }, [
                el('input', { type: 'range', min: lo, max: hi, step, value: s[k], 'aria-label': label, oninput: (e) => { out.textContent = fmt(+e.target.value); set(k, +e.target.value); }, onchange: () => { this.b.stat('sfx', 1); this.test(); } }), out,
            ]));
        };
        this.form.append(el('label', {}, 'Wave'), el('select', { 'aria-label': 'Wave', onchange: (e) => { set('wave', e.target.value); this.test(); } }, V.WAVES.map((w) => el('option', { value: w, selected: s.wave === w }, w))));
        slider('p0', 'Start pitch', 24, 108, 1, V.noteName);
        slider('p1', 'End pitch', 24, 108, 1, V.noteName);
        slider('len', 'Length', 20, 1500, 10, (v) => v + ' ms');
        slider('vol', 'Volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
        slider('vib', 'Vibrato', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
        slider('arp', 'Steps', 0, 12, 1, (v) => (v ? v + ' steps' : 'smooth'));
        this.drawGraph();
    }
    drawGraph() {
        const g = this.graph.getContext('2d'), s = this.cart.sounds[this.slot];
        g.fillStyle = '#02040b'; g.fillRect(0, 0, 280, 90);
        g.strokeStyle = 'rgba(95,240,255,0.12)';
        for (let x = 0; x < 280; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 90); g.stroke(); }
        const y = (p) => 84 - ((p - 24) / 84) * 78;
        const w = Math.max(20, Math.min(276, (s.len / 1500) * 276));
        g.strokeStyle = '#ffb347'; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 40; i++) {
            let t = i / 40;
            if (s.arp > 0) t = Math.floor(t * (s.arp + 1)) / s.arp;
            const p = s.p0 + (s.p1 - s.p0) * Math.min(1, t) + Math.sin(i * 1.6) * s.vib * 2;
            const x = 2 + (i / 40) * w;
            if (i) g.lineTo(x, y(p)); else g.moveTo(x, y(p));
        }
        g.stroke();
        g.fillStyle = '#9fb4d8'; g.font = '11px monospace';
        g.fillText(s.wave.toUpperCase(), 6, 14);
    }
}

// ---------------------------------------------------------------------- music
const LEAD = [81, 79, 76, 74, 72, 69, 67, 64, 62, 60];
const BASS = [48, 45, 43, 40, 38, 36];
const DRUMS = [[3, 'hat'], [2, 'snare'], [1, 'kick']];
const CW = 20, RH = 18, LW = 44;

export class MusicEditor {
    constructor(bench) { this.b = bench; this.playing = false; }
    get cart() { return this.b.cart; }
    get m() { return this.cart.music; }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        this.rows = [...LEAD.map((p) => ['lead', p]), null, ...BASS.map((p) => ['bass', p]), null, ...DRUMS.map(([d, n]) => ['drums', d, n])];
        const W = LW + V.STEPS * CW, H = this.rows.length * RH;
        this.cv = el('canvas', { width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px' }, 'aria-label': 'Music grid' });
        this.cv.addEventListener('click', (e) => this.tap(e));
        const m = this.m;
        const tempoOut = el('output', {}, m.tempo);
        this.playBtn = el('button', { class: 'btn play small', onclick: () => this.toggle() }, '▶ Play');
        root.append(el('div', { class: 'ed', style: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' } }, [
            el('div', { class: 'panel' }, [
                el('div', { class: 'row' }, [
                    el('label', { class: 'hint' }, ['Tempo ', el('input', { type: 'range', min: 60, max: 240, step: 2, value: m.tempo, 'aria-label': 'Tempo', oninput: (e) => { tempoOut.textContent = e.target.value; this.b.snapshot(true); m.tempo = +e.target.value; this.b.changed('music'); if (this.playing) this.b.audio.synth.music.tempo = m.tempo; } }), tempoOut]),
                    el('label', { class: 'hint' }, ['Lead ', el('select', { 'aria-label': 'Lead wave', onchange: (e) => { this.b.snapshot(); m.leadWave = e.target.value; this.b.changed('music'); this.restart(); } }, ['square', 'triangle', 'saw', 'sine'].map((w) => el('option', { value: w, selected: m.leadWave === w }, w)))]),
                    el('label', { class: 'hint' }, ['Plays when the game starts ', el('input', { type: 'checkbox', checked: m.on, onchange: (e) => { this.b.snapshot(); m.on = e.target.checked; this.b.changed('music'); } })]),
                ]),
                el('div', { class: 'btnrow' }, [
                    this.playBtn,
                    el('button', { class: 'btn small', onclick: () => this.jam() }, '♪ VESTA, improvise'),
                    el('button', { class: 'btn small danger', onclick: () => this.b.ask('Clear the song?', '', [['Clear', () => { this.b.snapshot(); m.lead.fill(-1); m.bass.fill(-1); m.drums.fill(0); this.b.changed('music'); this.draw(); }, 'danger']]) }, 'Clear'),
                ]),
                el('div', { class: 'hint', style: { marginTop: '6px' } }, 'Tap the grid: one note per step for the lead and the bass, one drum per step. In a game, music(true) and music(false) start and stop it.'),
            ]),
            el('div', { class: 'music-wrap' }, this.cv),
        ]));
        this.draw();
    }
    unmount() { if (this.playing) this.toggle(); }

    tap(e) {
        const r = this.cv.getBoundingClientRect();
        const x = (e.clientX - r.left) * ((LW + V.STEPS * CW) / r.width), y = (e.clientY - r.top) * ((this.rows.length * RH) / r.height);
        const step = Math.floor((x - LW) / CW), row = this.rows[Math.floor(y / RH)];
        if (step < 0 || step >= V.STEPS || !row) return;
        this.b.snapshot();
        const [ch, v] = row;
        const arr = this.m[ch];
        const was = arr[step];
        arr[step] = was === v ? (ch === 'drums' ? 0 : -1) : v;
        if (arr[step] !== (ch === 'drums' ? 0 : -1)) {
            this.b.stat('notes', 1);
            this.b.audio.init();
            if (ch === 'drums') this.b.audio.synth.sfx(v === 1 ? { wave: 'sine', p0: 40, p1: 28, len: 140, vol: 0.9 } : v === 2 ? { wave: 'noise', p0: 70, p1: 60, len: 120, vol: 0.6 } : { wave: 'noise', p0: 100, p1: 98, len: 40, vol: 0.3 });
            else this.b.audio.synth.note(v, ch === 'lead' ? this.m.leadWave : 'triangle', 0.18);
        }
        this.b.changed('music');
        this.draw();
    }
    toggle() {
        this.b.audio.init();
        this.playing = !this.playing;
        if (this.playing) { this.b.audio.synth.startMusic(this.m); this.anim(); }
        else this.b.audio.synth.stopMusic();
        this.playBtn.textContent = this.playing ? '■ Stop' : '▶ Play';
        this.draw();
    }
    restart() { if (this.playing) this.b.audio.synth.startMusic(this.m); }
    anim() {
        if (!this.playing || !this.cv.isConnected) { this.playing = false; this.b.audio.synth.stopMusic(); return; }
        // the scheduler runs ahead of the speakers; tick it from here while previewing
        this.b.audio.synth.tick();
        if (this.b.audio.synth.music) this.b.audio.synth.music = this.m;
        this.draw();
        requestAnimationFrame(() => this.anim());
    }
    jam() {
        this.b.snapshot();
        const m = this.m, r = Math.random;
        let p = 4 + Math.floor(r() * 3);
        for (let i = 0; i < V.STEPS; i++) {
            m.drums[i] = i % 8 === 0 ? 1 : i % 8 === 4 ? 2 : i % 2 === 0 && r() < 0.6 ? 3 : 0;
            if (i % 4 === 0 || r() < 0.3) { p = Math.max(0, Math.min(LEAD.length - 1, p + Math.floor(r() * 5) - 2)); m.lead[i] = r() < 0.85 ? LEAD[p] : -1; } else m.lead[i] = -1;
            m.bass[i] = i % 4 === 0 ? BASS[[5, 5, 2, 3, 5, 4, 2, 5][(i / 4) | 0]] : -1;
        }
        this.b.stat('notes', 16);
        this.b.changed('music');
        this.restart();
        this.draw();
    }
    draw() {
        const g = this.cv.getContext('2d');
        g.setTransform(2, 0, 0, 2, 0, 0);
        const W = LW + V.STEPS * CW, H = this.rows.length * RH;
        g.fillStyle = '#02040b'; g.fillRect(0, 0, W, H);
        const playStep = this.playing && this.b.audio.synth.step !== undefined ? (this.b.audio.synth.step - 1 + V.STEPS) % V.STEPS : -1;
        this.rows.forEach((row, ri) => {
            const y = ri * RH;
            if (!row) { g.fillStyle = 'rgba(95,240,255,0.25)'; g.fillRect(0, y + RH / 2, W, 1); return; }
            const [ch, v, name] = row;
            g.fillStyle = ch === 'lead' ? '#ffb347' : ch === 'bass' ? '#5ff0ff' : '#ff4fd8';
            g.font = '10px monospace';
            g.fillText(ch === 'drums' ? name : V.noteName(v), 4, y + 12);
            for (let s = 0; s < V.STEPS; s++) {
                const x = LW + s * CW;
                g.fillStyle = s === playStep ? 'rgba(255,255,255,0.12)' : s % 8 < 4 ? '#0a0f20' : '#070b18';
                g.fillRect(x + 1, y + 1, CW - 2, RH - 2);
                if (this.m[ch][s] === v) {
                    g.fillStyle = ch === 'lead' ? '#ffb347' : ch === 'bass' ? '#5ff0ff' : '#ff4fd8';
                    g.shadowColor = g.fillStyle; g.shadowBlur = 6;
                    g.fillRect(x + 3, y + 3, CW - 6, RH - 6);
                    g.shadowBlur = 0;
                }
            }
        });
    }
}
