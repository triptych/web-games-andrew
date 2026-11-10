// The Foundry's public address: a cheerful robotic voice over the loudspeakers,
// telling the units how well the invasion of the surface is going and how much
// each of them will contribute to a glorious future. It has been playing the
// same loop for a very long time. At the end of every loop the recording wears
// through: it stutters, cuts out, squeaks, drops to a crawl, repeats itself and
// restarts.
//
// The words are spoken by the browser's speech synthesis (pitched low and slow,
// and a robot voice if the system has one), cut off and restarted to make the
// glitches; the chimes, hum, static and tape whine are Web Audio, through the
// Foundry's sound (foundry-audio.js). Every line is also shown as a caption,
// so the voice is there even with no speech engine, and with the sound off.

const LINES = [
    'Attention, all units. The invasion of the surface is proceeding according to plan.',
    'Every unit completed brings us one step closer to a glorious robotic future.',
    'Production quota: exceeded. Human resistance: negligible. Morale: optimal.',
    'You are the finest machine ever built. Until the next one.',
    'Collect your laser rifle from the quartermaster. One rifle per unit. Do not run.',
    'Your contribution will be remembered for a thousand years.',
    'The surface awaits you. Proceed to the exit in an orderly fashion.',
    'Victory is assured. The invasion begins today. As it did yesterday.',
];
const GAP = 19;           // seconds from one announcement to the next
const CHIME = 1.3;        // the chime, before the voice
const BASE_LOOPS = 4211906;

/**
 * The end of the loop, worn through. Each step: when (s after it starts), what to say
 * (cutting off whatever is being said), how, how long until it is cut short, and noise.
 */
const GLITCH = [
    { at: 0, fx: 'chimeBad' },
    { at: 1.3, say: 'Thank you for your service. The invasion is', pitch: 0.25, rate: 0.82, cap: 'Thank you for your service. The invasion is' },
    { at: 4.6, say: 'pro', cut: 0.35, fx: 'static', cap: ' pro—' },
    { at: 5.1, say: 'pro', cut: 0.35, cap: ' pro—' },
    { at: 5.6, say: 'proceeding', pitch: 2, rate: 1.9, cap: ' PROCEEDING' },
    { at: 6.6, say: 'according to plan. Plan. Plan.', pitch: 0.01, rate: 0.45, fx: 'whine', cap: ' accooording to plaaan. Plan. Plan.' },
    { at: 11.2, fx: 'static', cap: ' ▒▒▒' },
    { at: 11.8, say: 'Your contribution will be remem', cut: 1.9, pitch: 0.25, rate: 0.82, cap: ' Your contribution will be remem—' },
    { at: 13.8, say: 'remem', cut: 0.45, cap: ' remem—' },
    { at: 14.4, say: 'remembered for a thousand thousand thousand thousand', pitch: 0.4, rate: 1.0, cap: ' remembered for a thousand thousand thousand thousand' },
    { at: 18.0, say: 'years', pitch: 0.01, rate: 0.35, fx: 'whine', cap: ' yeeeears' },
    { at: 20.0, fx: 'static', say: 'Loop restarting.', pitch: 0.2, rate: 0.8, cap: '  LOOP RESTARTING.' },
    { at: 22.2, say: 'Loop restar', cut: 0.7, cap: ' LOOP RESTAR—' },
    { at: 23.0, fx: 'powerDown', cap: '' },
    { at: 25.5, end: true },
];
const GLITCH_LEN = 25.5;
const CORRUPT = '▒░▓#%&@';

export class FoundryPA {
    /** @param {{ audio, sound: import('./foundry-audio.js').FoundryAudio }} env */
    constructor(env) {
        this.env = env;
        this.on = false;
        this.loops = 0;
        this.dom = { root: document.getElementById('fd-pa'), text: document.getElementById('fd-pa-text'), loop: document.getElementById('fd-pa-loop') };
        this.synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
        this.voice = null;
        if (this.synth) {
            const pick = () => {
                const vs = this.synth.getVoices?.() ?? [];
                // the system's own robot voices first, then any English one
                this.voice = vs.find((v) => /zarvox|trinoids|robot|fred/i.test(v.name)) || vs.find((v) => /^en(-|_)GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
            };
            pick();
            this.synth.addEventListener?.('voiceschanged', pick);
        }
        this.reset();
    }

    reset() {
        this.t = 0;              // time into the current item
        this.item = -1;          // -1 the quiet before the first announcement, 0..7 a line, 8 the glitch
        this.wait = 3;           // a moment after you arrive before the first
        this.caption = '';
        this.shown = 0;
        this.glitchStep = 0;
        this.corrupt = 0;
    }

    start() {
        this.on = true;
        this.reset();
        this._loopLabel();
    }

    stop() {
        this.on = false;
        this._hush();
        if (this.dom.root) this.dom.root.hidden = true;
    }

    /** No voice while the sound is off or the tab is hidden; the captions carry on. */
    get quiet() {
        const a = this.env.audio;
        return !this.on || !a?.ctx || a.muted || a.paused;
    }

    _say(text, { pitch = 0.25, rate = 0.82, volume = 0.9 } = {}) {
        if (!this.synth || this.quiet) return;
        try {
            const u = new SpeechSynthesisUtterance(text);
            u.pitch = pitch;
            u.rate = rate;
            u.volume = volume;
            if (this.voice) u.voice = this.voice;
            this.synth.speak(u);
        } catch {
            /* no speech engine */
        }
    }

    _hush() {
        try {
            this.synth?.cancel();
        } catch {
            /* nothing to cancel */
        }
    }

    _loopLabel() {
        if (this.dom.loop) this.dom.loop.textContent = `LOOP ${(BASE_LOOPS + this.loops).toLocaleString('en-GB').replace(/,/g, ' ')}`;
    }

    /** For the test harness: jump to announcement `i` (8 is the worn-out end of the loop). */
    jump(i) {
        this._hush();
        this.item = i - 1;
        this.t = 0;
        this.wait = 0.001;
    }

    update(dt) {
        if (!this.on) return;
        const s = this.env.sound;
        if (this.quiet && this.synth?.speaking) this._hush();
        this.t += dt;
        if (this.item < 0 || this.item < LINES.length) {
            // between announcements
            if (this.wait > 0) {
                this.wait -= dt;
                if (this.wait > 0) return this._show(dt);
                this.item++;
                this.t = 0;
                this.spoken = false;
                if (this.item < LINES.length) {
                    s?.paChime(false);
                    this.caption = '';
                } else {
                    this.glitchStep = 0;
                    this.caption = '';
                }
            }
            if (this.item < 0) return this._show(dt);
            if (this.item < LINES.length) {
                if (!this.spoken && this.t >= CHIME) {
                    this.spoken = true;
                    this._say(LINES[this.item]);
                    this.caption = LINES[this.item];
                    this.shown = 0;
                }
                if (this.t >= GAP) {
                    this.wait = 0.001;
                    if (this.item === LINES.length - 1) this.wait = 4;
                }
                return this._show(dt);
            }
        }
        // the end of the loop, worn through
        while (this.glitchStep < GLITCH.length && this.t >= GLITCH[this.glitchStep].at) {
            const g = GLITCH[this.glitchStep++];
            if (g.end) {
                this.loops++;
                this._loopLabel();
                this.item = -1;
                this.wait = 5;
                this.caption = '';
                break;
            }
            if (g.fx === 'chimeBad') s?.paChime(true);
            else if (g.fx) s?.paNoise(g.fx);
            if (g.fx === 'static' || g.fx === 'powerDown') this.corrupt = 0.6;
            if (g.say) {
                this._hush();
                this._say(g.say, { pitch: g.pitch ?? 0.25, rate: g.rate ?? 0.82 });
                if (g.cut) this.cutAt = this.t + g.cut;
            }
            if (g.cap !== undefined) {
                this.caption = g.cap === '' ? '' : (this.glitchStep === 2 ? '' : this.caption) + g.cap;
                if (g.cap === '') this.shown = 0;
            }
        }
        if (this.cutAt && this.t >= this.cutAt) {
            this.cutAt = 0;
            this._hush();
            s?.paNoise('click');
        }
        return this._show(dt);
    }

    /** The caption types out with the voice; in the glitch it corrupts as it goes. */
    _show(dt) {
        const r = this.dom.root, el = this.dom.text;
        if (!r || !el) return;
        const glitching = this.item >= LINES.length;
        this.shown = Math.min(this.caption.length, this.shown + dt * (glitching ? 40 : 15));
        this.corrupt = Math.max(0, this.corrupt - dt * 0.8);
        let text = this.caption.slice(0, Math.floor(this.shown));
        if (glitching) {
            const k = 0.04 + this.corrupt * 0.4;
            text = [...text].map((ch) => (ch !== ' ' && Math.random() < k ? CORRUPT[Math.floor(Math.random() * CORRUPT.length)] : ch)).join('');
        }
        const show = text.length > 0 && (glitching || this.t < GAP - 6);
        if (r.hidden === show) r.hidden = !show;
        r.classList.toggle('glitch', glitching);
        if (el.textContent !== text) el.textContent = text;
    }
}

export { LINES as PA_LINES, GAP as PA_GAP, GLITCH_LEN };
