// The wooden flute on the loft desk. Click it and a songbook opens at the foot
// of the screen: an eight-holed flute you play with the keys A S D F G H J K
// (or 1 to 8, or by touching the holes), and above it a five-line staff where
// every note you play lands as a coloured gem. The songbook has five tunes of
// the loft's own to listen to and learn, and each one does something when you
// play it yourself (the twinkle lights dance, the window changes its picture,
// fireflies come out, the cat purrs, the hours turn). Press Record, play, and
// press it again to keep a tune of your own; your tunes stay in this browser.
//
// The flute is synthesised with Web Audio: a triangle and a soft octave sine,
// a breathy noise chiff at the start of every note, and vibrato that creeps in
// as the note is held.

import { store, esc } from './util.js';

/** D major, D5 to D6: one note for each hole. */
const NOTES = [
    { name: 'D', midi: 74, key: 'a', color: '#ff6b6b' },
    { name: 'E', midi: 76, key: 's', color: '#ffa94d' },
    { name: 'F♯', midi: 78, key: 'd', color: '#ffd43b' },
    { name: 'G', midi: 79, key: 'f', color: '#8ce99a' },
    { name: 'A', midi: 81, key: 'g', color: '#63e6be' },
    { name: 'B', midi: 83, key: 'h', color: '#74c0fc' },
    { name: 'C♯', midi: 85, key: 'j', color: '#b197fc' },
    { name: 'D', midi: 86, key: 'k', color: '#f783ac' },
];

/** The loft's own songs, each [hole, beats]. All written for the loft. */
export const SONGS = [
    {
        id: 'lanterns', name: 'Lantern Waltz', tempo: 132, effect: 'The twinkle lights dance in every colour',
        notes: [[4, 1], [7, 0.5], [6, 0.5], [5, 1], [4, 1], [2, 1], [4, 1], [3, 1], [5, 1], [4, 0.5], [3, 0.5], [2, 3]],
    },
    {
        id: 'window', name: 'Window Rondo', tempo: 120, effect: 'The stained-glass window finds a new picture',
        notes: [[0, 0.5], [2, 0.5], [4, 0.5], [7, 1.5], [6, 0.5], [5, 0.5], [4, 1], [3, 0.5], [5, 0.5], [7, 2]],
    },
    {
        id: 'fireflies', name: 'Firefly Reel', tempo: 150, effect: 'Fireflies drift in to play under the rafters',
        notes: [[4, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [7, 1], [5, 0.5], [4, 1.5]],
    },
    {
        id: 'lullaby', name: 'Loft Lullaby', tempo: 84, effect: 'The cat on the quilt purrs in its sleep',
        notes: [[4, 1.5], [2, 0.5], [3, 1], [1, 1], [2, 1.5], [0, 0.5], [1, 1], [2, 1], [0, 3]],
    },
    {
        id: 'hours', name: 'Turning Hours', tempo: 112, effect: 'Day turns to night, or night to morning',
        notes: [[0, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 1], [4, 1], [5, 0.5], [6, 0.5], [7, 2]],
    },
];

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** The flute's voice. Shares the garden's audio context and its effects bus when there is one. */
export class FluteSynth {
    constructor(audio) {
        this.audio = audio;
        this.voices = new Map();
    }

    _ctx() {
        const a = this.audio;
        if (a && !a.ctx) a.start?.();
        if (a?.ctx) return { ctx: a.ctx, out: a.sfx };
        if (!this.own) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            const ctx = new AC();
            const g = ctx.createGain();
            g.gain.value = 0.7;
            g.connect(ctx.destination);
            this.own = { ctx, out: g };
        }
        return this.own;
    }

    _noise(ctx) {
        if (!this.noiseBuf || this.noiseBuf.sampleRate !== ctx.sampleRate) {
            const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            this.noiseBuf = b;
        }
        return this.noiseBuf;
    }

    /** Start a note (hole 0-7); `id` names the voice so it can be stopped. Returns the id. */
    on(hole, id = 'k' + hole, vol = 1, when = 0) {
        const c = this._ctx();
        if (!c) return id;
        this.off(id);
        const { ctx, out } = c;
        const t = Math.max(ctx.currentTime, when || 0) + 0.005;
        const f = freq(NOTES[hole].midi);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.2 * vol, t + 0.05);
        env.gain.setTargetAtTime(0.16 * vol, t + 0.06, 0.3);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3400;
        lp.Q.value = 0.4;
        lp.connect(env).connect(out);
        const o1 = ctx.createOscillator();
        o1.type = 'triangle';
        o1.frequency.value = f;
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = f * 2;
        const g2 = ctx.createGain();
        g2.gain.value = 0.12;
        o1.connect(lp);
        o2.connect(g2).connect(lp);
        // vibrato that creeps in as the note is held
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.1;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(f * 0.007, t + 0.6);
        lfo.connect(depth);
        depth.connect(o1.frequency);
        depth.connect(o2.frequency);
        // breath: a chiff of noise at the start, and a little air under the tone
        const nz = ctx.createBufferSource();
        nz.buffer = this._noise(ctx);
        nz.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f * 1.5;
        bp.Q.value = 1.2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, t);
        ng.gain.linearRampToValueAtTime(0.5 * vol, t + 0.012);
        ng.gain.setTargetAtTime(0.06 * vol, t + 0.02, 0.05);
        nz.connect(bp).connect(ng).connect(env);
        for (const n of [o1, o2, lfo, nz]) n.start(t);
        this.voices.set(id, { env, nodes: [o1, o2, lfo, nz], ctx });
        return id;
    }

    off(id, when = 0) {
        const v = this.voices.get(id);
        if (!v) return;
        this.voices.delete(id);
        const t = Math.max(v.ctx.currentTime, when || 0);
        v.env.gain.cancelScheduledValues(t);
        v.env.gain.setTargetAtTime(0, t, 0.05);
        for (const n of v.nodes) n.stop(t + 0.4);
    }

    allOff() {
        for (const id of [...this.voices.keys()]) this.off(id);
    }

    /** Play a song through on its own (for the lullaby while you sleep). Returns the length in seconds. */
    playSong(song, vol = 0.7) {
        const c = this._ctx();
        if (!c) return 0;
        const beat = 60 / song.tempo;
        let t = c.ctx.currentTime + 0.1;
        song.notes.forEach(([n, b], i) => {
            const id = this.on(n, 'song' + i, vol, t);
            this.off(id, t + b * beat * 0.92);
            t += b * beat;
        });
        return t - c.ctx.currentTime;
    }

    /** A soft rising sparkle: you played a song the loft knows. */
    sparkle() {
        const c = this._ctx();
        if (!c) return;
        const { ctx, out } = c;
        [0, 4, 7, 12, 16].forEach((st, i) => {
            const t = ctx.currentTime + 0.05 + i * 0.07;
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = freq(86 + st);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.07, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 1);
        });
    }
}

// ---------------------------------------------------------------- the songbook

const STAFF_SLOTS = 12;

export class FluteUI {
    /**
     * @param {object} o
     * @param {FluteSynth} o.synth
     * @param {(song) => void} o.onSong  you played one of the loft's songs yourself
     * @param {() => void} o.onClose
     */
    constructor({ synth, audio, onSong, onClose }) {
        this.synth = synth;
        this.audio = audio;
        this.onSong = onSong;
        this.onCloseCb = onClose;
        this.open = false;
        this.trail = [];          // the gems on the staff: { n, ghost?, ok?, born }
        this.history = [];        // the holes played by hand, for spotting songs
        this.mode = 'free';       // 'free' | 'learn' | 'listen'
        this.learn = null;        // { song, i }
        this.rec = null;          // { t0, notes: [{ n, t, d }] } while recording
        this.held = new Map();    // key or pointer id -> { n, voice, t }
        this.timers = [];
        this.mine = store.get('fluteSongs', []);
        if (!Array.isArray(this.mine)) this.mine = [];
        this._build();
        this._key = (e) => this._onKey(e);
        this._keyUp = (e) => this._onKeyUp(e);
        addEventListener('keydown', this._key, true);
        addEventListener('keyup', this._keyUp, true);
        addEventListener('blur', () => this._releaseAll());
    }

    _build() {
        const el = document.createElement('section');
        el.id = 'flute-ui';
        el.className = 'flute-overlay';
        el.hidden = true;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'The wooden flute');
        el.innerHTML = `
            <div class="fl-panel">
                <header class="fl-head">
                    <h2>🪈 The Wooden Flute</h2>
                    <div class="fl-tools">
                        <button class="fl-btn" data-act="book" aria-expanded="false">📖 Songbook</button>
                        <button class="fl-btn fl-rec" data-act="rec" aria-pressed="false">● Record</button>
                        <button class="fl-btn fl-x" data-act="close" aria-label="Put the flute down">✕</button>
                    </div>
                </header>
                <div class="fl-book" hidden>
                    <h3>Songs of the loft</h3>
                    <ul class="fl-songs"></ul>
                    <h3>Your tunes</h3>
                    <ul class="fl-mine"></ul>
                    <p class="fl-empty">Press <b>● Record</b>, play something, then press it again to keep it here.</p>
                </div>
                <div class="fl-staff-wrap"><canvas class="fl-staff" width="960" height="150" aria-hidden="true"></canvas></div>
                <p class="fl-msg" aria-live="polite"></p>
                <div class="fl-flute" role="group" aria-label="Flute holes">
                    <span class="fl-mouth" aria-hidden="true"></span>
                    ${NOTES.map((n, i) => `<button class="fl-hole" data-n="${i}" style="--c:${n.color}" aria-label="${n.name}${i === 7 ? ' (high)' : ''}"><i></i><kbd>${n.key.toUpperCase()}</kbd></button>`).join('')}
                </div>
            </div>`;
        document.body.appendChild(el);
        this.el = el;
        this.canvas = el.querySelector('.fl-staff');
        this.msgEl = el.querySelector('.fl-msg');
        this.bookEl = el.querySelector('.fl-book');
        this.holes = [...el.querySelectorAll('.fl-hole')];
        el.querySelector('.fl-songs').innerHTML = SONGS.map((s) => `
            <li><div><b>${esc(s.name)}</b><small>${esc(s.effect)}</small></div>
            <span><button class="fl-btn sm" data-listen="${s.id}">▶ Listen</button><button class="fl-btn sm" data-learn="${s.id}">✎ Learn</button></span></li>`).join('');
        this._renderMine();
        el.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            const act = b.dataset.act;
            if (act === 'close') this.close();
            else if (act === 'book') this.toggleBook();
            else if (act === 'rec') this.toggleRec();
            else if (b.dataset.listen) this.listen(SONGS.find((s) => s.id === b.dataset.listen));
            else if (b.dataset.learn) this.startLearn(SONGS.find((s) => s.id === b.dataset.learn));
            else if (b.dataset.play !== undefined) this.listen(this.mine[+b.dataset.play]);
            else if (b.dataset.del !== undefined) {
                this.mine.splice(+b.dataset.del, 1);
                store.set('fluteSongs', this.mine);
                this._renderMine();
            }
        });
        el.addEventListener('change', (e) => {
            const i = e.target.dataset?.rename;
            if (i === undefined || !this.mine[+i]) return;
            this.mine[+i].name = e.target.value.trim().slice(0, 40) || this.mine[+i].name;
            store.set('fluteSongs', this.mine);
        });
        // the holes: press and hold, and slide from hole to hole
        for (const h of this.holes) {
            h.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                h.releasePointerCapture?.(e.pointerId);
                this._press('p' + e.pointerId, +h.dataset.n);
            });
            h.addEventListener('pointerenter', (e) => {
                if (e.buttons && this.held.has('p' + e.pointerId)) this._press('p' + e.pointerId, +h.dataset.n);
            });
        }
        const up = (e) => this._release('p' + e.pointerId);
        addEventListener('pointerup', up);
        addEventListener('pointercancel', up);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        // a click on the dimmed loft around the panel puts the flute down
        el.addEventListener('pointerdown', (e) => {
            if (e.target === el) this.close();
        });
    }

    _renderMine() {
        const ul = this.el.querySelector('.fl-mine');
        ul.innerHTML = this.mine.map((s, i) => `
            <li><div><input class="fl-name" data-rename="${i}" value="${esc(s.name)}" aria-label="Name of your tune" maxlength="40"><small>${s.notes.length} notes · ${(s.notes.at(-1) ? (s.notes.at(-1).t + s.notes.at(-1).d) / 1000 : 0).toFixed(1)} s</small></div>
            <span><button class="fl-btn sm" data-play="${i}">▶ Play</button><button class="fl-btn sm" data-del="${i}" aria-label="Forget ${esc(s.name)}">🗑</button></span></li>`).join('');
        this.el.querySelector('.fl-empty').hidden = this.mine.length > 0;
    }

    show() {
        if (this.open) return;
        this.open = true;
        this.el.hidden = false;
        this.mode = 'free';
        this.learn = null;
        this.trail = [];
        this.history = [];
        this.say('Play with <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> <kbd>G</kbd> <kbd>H</kbd> <kbd>J</kbd> <kbd>K</kbd> or touch the holes · open the 📖 Songbook to learn a tune');
        // the island's music steps back while you play
        if (this.audio?.ctx && this.audio.music) this.audio.music.gain.setTargetAtTime(0.05, this.audio.ctx.currentTime, 0.3);
        this._loop();
    }

    close() {
        if (!this.open) return;
        if (this.rec) this.toggleRec();
        this.open = false;
        this.el.hidden = true;
        this._stopTimers();
        this._releaseAll();
        this.synth.allOff();
        cancelAnimationFrame(this.raf);
        if (this.audio?.ctx && this.audio.music) this.audio.setMusicVolume(this.audio.musicVol);
        this.onCloseCb?.();
    }

    say(html) {
        this.msgEl.innerHTML = html;
    }

    toggleBook(force) {
        const on = force ?? this.bookEl.hidden;
        this.bookEl.hidden = !on;
        this.el.querySelector('[data-act="book"]').setAttribute('aria-expanded', String(on));
    }

    toggleRec() {
        const b = this.el.querySelector('[data-act="rec"]');
        if (!this.rec) {
            this._stopTimers();
            this.mode = 'free';
            this.learn = null;
            this.trail = [];
            this.rec = { t0: 0, notes: [] };
            b.textContent = '■ Stop';
            b.setAttribute('aria-pressed', 'true');
            this.el.classList.add('recording');
            this.say('<b class="fl-red">● Recording</b> · play your tune, then press <b>■ Stop</b>');
            return;
        }
        const r = this.rec;
        this.rec = null;
        b.textContent = '● Record';
        b.setAttribute('aria-pressed', 'false');
        this.el.classList.remove('recording');
        for (const n of r.notes) if (n.d === undefined) n.d = Math.max(120, performance.now() - r.t0 - n.t);
        if (!r.notes.length) return this.say('Nothing to keep: the tune was silent.');
        const n = (store.get('fluteCount', 0) | 0) + 1;
        store.set('fluteCount', n);
        this.mine.unshift({ name: `My Tune No. ${n}`, notes: r.notes.map((x) => ({ n: x.n, t: Math.round(x.t), d: Math.round(x.d) })) });
        this.mine = this.mine.slice(0, 16);
        store.set('fluteSongs', this.mine);
        this._renderMine();
        this.toggleBook(true);
        this.say(`Kept <b>My Tune No. ${n}</b> in the songbook · give it a name, or press ▶ to hear it`);
    }

    /** Play a song through: the loft's (beats) or one of yours (milliseconds). */
    listen(song) {
        if (!song) return;
        this._stopTimers();
        this._releaseAll();
        if (this.rec) this.toggleRec();
        this.mode = 'listen';
        this.learn = null;
        this.trail = [];
        const timed = song.notes[0]?.t !== undefined ? song.notes : this._timed(song);
        this.say(`♪ <b>${esc(song.name)}</b>`);
        for (const [i, nt] of timed.entries()) {
            this.timers.push(setTimeout(() => {
                this._gem(nt.n);
                this._light(nt.n, true);
                this.synth.on(nt.n, 'listen');
            }, nt.t));
            this.timers.push(setTimeout(() => {
                this._light(nt.n, false);
                // only stop it if the next note hasn't already taken over
                if (!timed[i + 1] || timed[i + 1].t > nt.t + nt.d) this.synth.off('listen');
            }, nt.t + nt.d));
        }
        const end = timed.at(-1).t + timed.at(-1).d;
        this.timers.push(setTimeout(() => {
            this.mode = 'free';
            this.say(song.effect ? `Now you try: press <b>✎ Learn</b> beside <b>${esc(song.name)}</b>` : 'Play on, or open the 📖 Songbook');
        }, end + 400));
    }

    _timed(song) {
        const beat = 60000 / song.tempo;
        let t = 0;
        return song.notes.map(([n, b]) => {
            const x = { n, t, d: b * beat * 0.9 };
            t += b * beat;
            return x;
        });
    }

    startLearn(song) {
        this._stopTimers();
        this._releaseAll();
        if (this.rec) this.toggleRec();
        this.mode = 'learn';
        this.learn = { song, i: 0, misses: 0 };
        this.trail = song.notes.map(([n]) => ({ n, ghost: true, born: performance.now() }));
        this.toggleBook(false);
        this.say(`Learning <b>${esc(song.name)}</b> · play the notes on the staff, left to right`);
    }

    _onKey(e) {
        if (!this.open) return;
        if (e.target.closest?.('input')) {
            if (e.key === 'Escape') e.target.blur();
            e.stopImmediatePropagation();
            return;
        }
        const k = e.key.toLowerCase();
        let n = NOTES.findIndex((x) => x.key === k);
        if (n < 0 && /^[1-8]$/.test(k)) n = +k - 1;
        if (n >= 0) {
            e.preventDefault();
            if (!e.repeat) this._press('key' + e.code, n);
        } else if (k === 'escape') {
            e.preventDefault();
            this.close();
        } else if (k === 'r' && !e.repeat) this.toggleRec();
        else if (k === 'b' && !e.repeat) this.toggleBook();
        else if (k === 'tab') return;
        e.stopImmediatePropagation();
    }

    _onKeyUp(e) {
        if (!this.open) return;
        this._release('key' + e.code);
    }

    _press(id, n) {
        if (this.mode === 'listen') {
            this._stopTimers();
            this.synth.off('listen');
            this.holes.forEach((h) => h.classList.remove('on'));
            this.mode = 'free';
        }
        const was = this.held.get(id);
        if (was) {
            if (was.n === n) return;
            this._release(id);
        }
        const voice = this.synth.on(n, id);
        const now = performance.now();
        this.held.set(id, { n, voice, t: now });
        this._light(n, true);
        if (this.rec) {
            if (!this.rec.notes.length) this.rec.t0 = now;
            this.rec.notes.push({ n, t: now - this.rec.t0, id });
        }
        if (this.mode === 'learn') this._learnNote(n);
        else {
            this._gem(n);
            this.history.push(n);
            if (this.history.length > 24) this.history.shift();
            const song = SONGS.find((s) => s.notes.length <= this.history.length && s.notes.every(([x], i) => x === this.history[this.history.length - s.notes.length + i]));
            if (song) this._played(song);
        }
    }

    _release(id) {
        const h = this.held.get(id);
        if (!h) return;
        this.held.delete(id);
        this.synth.off(h.voice);
        if (![...this.held.values()].some((o) => o.n === h.n)) this._light(h.n, false);
        if (this.rec) {
            const r = [...this.rec.notes].reverse().find((x) => x.id === id && x.d === undefined);
            if (r) {
                r.d = Math.max(60, performance.now() - this.rec.t0 - r.t);
                delete r.id;
            }
        }
    }

    _releaseAll() {
        for (const id of [...this.held.keys()]) this._release(id);
    }

    _learnNote(n) {
        const L = this.learn;
        const want = L.song.notes[L.i][0];
        const g = this.trail[L.i];
        if (n === want) {
            g.ghost = false;
            g.ok = true;
            g.born = performance.now();
            L.i++;
            if (L.i >= L.song.notes.length) {
                this.mode = 'free';
                this.learn = null;
                this.history = [];
                this._played(L.song, true);
            }
        } else {
            g.wrong = performance.now();
        }
    }

    _played(song) {
        this.history = [];
        this.synth.sparkle();
        this.el.classList.remove('fl-glow');
        void this.el.offsetWidth;
        this.el.classList.add('fl-glow');
        this.say(`✨ You played <b>${esc(song.name)}</b>! · ${esc(song.effect)}`);
        setTimeout(() => this.onSong?.(song), 350);
    }

    _gem(n) {
        this.trail.push({ n, born: performance.now() });
        if (this.trail.length > STAFF_SLOTS) this.trail.splice(0, this.trail.length - STAFF_SLOTS);
    }

    _light(n, on) {
        this.holes[n]?.classList.toggle('on', on);
    }

    _stopTimers() {
        for (const t of this.timers) clearTimeout(t);
        this.timers = [];
    }

    _loop() {
        this._drawStaff();
        if (this.open) this.raf = requestAnimationFrame(() => this._loop());
    }

    _drawStaff() {
        const c = this.canvas, x = c.getContext('2d');
        const W = c.width, H = c.height;
        x.clearRect(0, 0, W, H);
        const top = 26, gap = 22, left = 70, right = W - 24;
        // five lines
        x.strokeStyle = 'rgba(255, 236, 200, 0.55)';
        x.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            x.beginPath();
            x.moveTo(left - 46, top + i * gap);
            x.lineTo(right, top + i * gap);
            x.stroke();
        }
        // a little leaf-and-swirl clef, the loft's own
        x.save();
        x.translate(left - 30, top + gap * 2);
        x.strokeStyle = 'rgba(255, 224, 160, 0.85)';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(0, gap * 2.2);
        x.bezierCurveTo(10, gap, -12, -gap * 0.6, 4, -gap * 2.1);
        x.bezierCurveTo(14, -gap * 1.2, -14, -gap * 0.2, -6, gap * 0.6);
        x.bezierCurveTo(0, gap * 1.2, 14, gap * 0.4, 6, -gap * 0.2);
        x.stroke();
        x.restore();
        const now = performance.now();
        const step = (right - left - 20) / STAFF_SLOTS;
        // hole 0 sits on the bottom line, hole 7 in the top space
        const yOf = (n) => top + gap * 4 - n * (gap / 2);
        this.trail.forEach((g, i) => {
            const cx = left + 14 + step * (i + 0.5);
            let cy = yOf(g.n);
            const age = (now - g.born) / 1000;
            const pop = g.ghost ? 1 : Math.min(1, age * 6);
            let s = (0.6 + 0.4 * pop) * (g.ok && age < 0.3 ? 1 + (0.3 - age) : 1);
            if (g.wrong && now - g.wrong < 300) {
                cy += Math.sin((now - g.wrong) / 18) * 3;
            }
            const col = NOTES[g.n].color;
            x.save();
            x.translate(cx, cy);
            x.scale(s, s);
            x.globalAlpha = g.ghost ? 0.35 : 1;
            if (!g.ghost) {
                x.shadowColor = col;
                x.shadowBlur = 14;
            }
            // a round gem with a facet and a highlight
            x.fillStyle = col;
            x.beginPath();
            x.arc(0, 0, 13, 0, Math.PI * 2);
            x.fill();
            x.shadowBlur = 0;
            x.fillStyle = 'rgba(0,0,0,0.22)';
            x.beginPath();
            x.arc(2, 3, 8, 0, Math.PI * 2);
            x.fill();
            x.fillStyle = 'rgba(255,255,255,0.75)';
            x.beginPath();
            x.ellipse(-4, -5, 4.5, 2.6, -0.6, 0, Math.PI * 2);
            x.fill();
            x.strokeStyle = g.ghost ? col : 'rgba(40, 24, 10, 0.8)';
            x.lineWidth = 2;
            x.beginPath();
            x.arc(0, 0, 13, 0, Math.PI * 2);
            x.stroke();
            x.fillStyle = '#2a1a0a';
            x.font = '700 11px system-ui, sans-serif';
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillText(NOTES[g.n].key.toUpperCase(), 0, 1);
            x.restore();
            // learning: a caret under the next note to play
            if (this.mode === 'learn' && this.learn && i === this.learn.i) {
                x.fillStyle = 'rgba(255, 230, 160, ' + (0.6 + 0.4 * Math.sin(now / 160)) + ')';
                x.beginPath();
                x.moveTo(cx, H - 18);
                x.lineTo(cx - 7, H - 6);
                x.lineTo(cx + 7, H - 6);
                x.closePath();
                x.fill();
            }
        });
        if (this.rec) {
            x.fillStyle = `rgba(255, 70, 70, ${0.6 + 0.4 * Math.sin(now / 200)})`;
            x.beginPath();
            x.arc(W - 20, 14, 7, 0, Math.PI * 2);
            x.fill();
        }
    }
}
