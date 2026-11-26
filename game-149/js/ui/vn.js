// The visual-novel layer: backgrounds, standing sprites, CGs, the text box with a typewriter, choices and chapter
// cards. Reads G.vn; sends 'next' and 'choose' through the callback. Never changes G itself.

import { CAST, CHAPTERS } from '../sim/data.js';

const $ = (id) => document.getElementById(id);
const SPEED = { slow: 28, normal: 55, fast: 120, instant: 1e9 };       // characters per second

export function sprSrc(who, expr) {
    if (who === 'mochi') return 'art/spr/mochi.webp';
    const c = CAST[who];
    if (!c?.sprites) return null;
    const e = c.sprites.includes(expr) ? expr : c.sprites[0];
    return `art/spr/${who}-${e}.webp`;
}

export class VNView {
    constructor({ audio, settings, send, nameOf }) {
        this.audio = audio;
        this.settings = settings;
        this.send = send;                 // send(cmd)
        this.nameOf = nameOf;
        this.el = $('vn');
        this.sayKey = null;               // the line on screen (identity)
        this.shown = 0;                   // characters revealed
        this.full = '';
        this.auto = false;
        this.skip = false;
        this.wait = 0;
        this.lastBg = null;
        this.choiceKey = null;
        $('vn-box').addEventListener('click', () => this.advance());
        $('vn-chapter').addEventListener('click', () => this.advance());
        $('vn-bg').addEventListener('click', () => this.advance());
        $('vn-sprites').addEventListener('click', () => this.advance());
        $('vn-cg').addEventListener('click', () => this.advance());
        $('vn-auto').addEventListener('click', (e) => { e.stopPropagation(); this.auto = !this.auto; this.skip = false; this.syncTools(); });
        $('vn-skip').addEventListener('click', (e) => { e.stopPropagation(); this.skip = !this.skip; this.auto = false; this.syncTools(); });
        $('vn-choices').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-i]');
            if (!b) return;
            this.audio.ui('click');
            this.send({ t: 'choose', i: +b.dataset.i });
        });
    }

    syncTools() {
        $('vn-auto').setAttribute('aria-pressed', String(this.auto));
        $('vn-skip').setAttribute('aria-pressed', String(this.skip));
    }

    show(on) {
        this.el.hidden = !on;
        if (!on) { this.sayKey = null; this.skip = false; this.syncTools(); }
    }

    /** Click, tap, Space, Enter: finish the line, or read on. Returns true if it did something. */
    advance() {
        if (this.el.hidden || !this.G?.vn) return false;
        const V = this.G.vn;
        if (V.choices) return false;
        if (V.wait?.kind === 'chapter') { this.send({ t: 'next' }); return true; }
        if (!V.say) return false;
        if (this.shown < this.full.length) { this.shown = this.full.length; this.paintText(); return true; }
        this.audio.stopVoice();
        this.send({ t: 'next' });
        return true;
    }

    /** Arrow keys move through the choices; Enter is the focused button's own click. */
    focusChoice(dir) {
        const bs = [...$('vn-choices').querySelectorAll('button')];
        if (!bs.length) return false;
        const i = bs.indexOf(document.activeElement);
        bs[(i + dir + bs.length) % bs.length].focus();
        return true;
    }

    render(G, dt) {
        this.G = G;
        const V = G.vn;
        if (!V) return;
        // background, CG, sprites
        if (V.bg !== this.lastBg) {
            this.lastBg = V.bg;
            if (V.bg) $('vn-bg').src = `art/bg/${V.bg}.webp`;
        }
        const cg = $('vn-cg');
        if (V.cg) { const src = `art/cg/${V.cg}.webp`; if (!cg.src.endsWith(src)) cg.src = src; cg.hidden = false; } else cg.hidden = true;
        const speaker = V.say?.who;
        for (const img of document.querySelectorAll('#vn-sprites .spr')) {
            const s = V.show[img.dataset.pos];
            const src = s && sprSrc(s.who, s.expr);
            if (!src) { img.hidden = true; img.dataset.who = ''; continue; }
            if (img.dataset.src !== src) {
                const isNew = img.dataset.who !== s.who;
                img.dataset.src = src; img.src = src;
                if (isNew) { img.classList.remove('enter'); void img.offsetWidth; img.classList.add('enter'); }
            }
            img.dataset.who = s.who;
            img.hidden = false;
            img.classList.toggle('mochi', s.who === 'mochi');
            img.classList.toggle('quiet', !!speaker && speaker !== s.who);
        }
        // chapter card
        const chap = V.wait?.kind === 'chapter';
        $('vn-chapter').hidden = !chap;
        if (chap) {
            const C = CHAPTERS.find((c) => c.n === V.wait.n || c.n === G.chapter);
            $('vn-chapter').querySelector('.ch-n').textContent = `Chapter ${G.chapter}`;
            $('vn-chapter').querySelector('.ch-name').textContent = C?.name || '';
        }
        // choices
        const ch = $('vn-choices');
        if (V.choices) {
            const key = V.scene + ':' + V.pc;
            if (this.choiceKey !== key) {
                this.choiceKey = key;
                ch.innerHTML = '';
                V.choices.forEach((c, i) => {
                    const b = document.createElement('button');
                    b.className = 'act'; b.dataset.i = i; b.textContent = c.text;
                    ch.appendChild(b);
                });
                ch.hidden = false;
                ch.querySelector('button')?.focus({ preventScroll: true });
                this.skip = false; this.syncTools();
            }
        } else { ch.hidden = true; this.choiceKey = null; }
        // the line
        const box = $('vn-box');
        box.hidden = !V.say && !V.choices;
        if (V.say) {
            const key = V.scene + ':' + V.pc + ':' + V.say.text;
            if (key !== this.sayKey) {
                this.sayKey = key;
                this.full = V.say.text;
                this.shown = this.settings.text === 'instant' || this.skip ? this.full.length : 0;
                this.wait = 0;
                const who = V.say.who;
                $('vn-name').hidden = !who;
                $('vn-name').textContent = who ? this.nameOf(who) : '';
                $('vn-name').style.background = who ? (CAST[who]?.color || '#ffd56b') : '';
                const face = $('vn-face');
                if (who === 'kai') { face.src = `art/spr/kai-${CAST.kai.sprites.includes(V.say.expr) ? V.say.expr : 'normal'}.webp`; face.hidden = false; }
                else face.hidden = true;
                $('vn-text').classList.toggle('narr', !who);
                if (V.say.voice && !this.skip) this.audio.voice(CAST[who]?.voice || who, V.say.voice);
            }
            if (this.shown < this.full.length) {
                const before = Math.floor(this.shown);
                this.shown = Math.min(this.full.length, this.shown + dt * SPEED[this.settings.text || 'normal']);
                if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 3 === 0 && !V.say.voice) this.audio.ui('text');
            } else if (this.skip) {
                this.wait += dt;
                if (this.wait > 0.06) this.advance();
            } else if (this.auto) {
                this.wait += dt;
                const voiceLeft = this.audio.ctx ? Math.max(0, this.audio.voiceUntil - this.audio.ctx.currentTime) : 0;
                if (this.wait > 1.2 + this.full.length * 0.02 && voiceLeft <= 0) this.advance();
            }
            this.paintText();
            $('vn-more').hidden = this.shown < this.full.length;
        }
    }

    paintText() {
        $('vn-text').textContent = this.full.slice(0, Math.floor(this.shown));
    }
}
