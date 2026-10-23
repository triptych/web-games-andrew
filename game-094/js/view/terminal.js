// The view: a scrolling transcript like a 1980s adventure. It reads the sim's events and turns them
// into echoed choices, dice rolls, notices, a 1-bit picture drawn line by line, and paragraphs typed
// out one character at a time. It never changes G.

import { ART, TYPE_CPS, REVEAL_ROWS_PER_SEC, STAT_NAMES } from '../config.js';
import { renderArt, paintArt } from './art.js';
import { passageOf, choicesFor, summary } from '../sim/game.js';
import { ITEMS } from '../sim/data/items.js';
import { CODEX } from '../sim/data/codex.js';

const MAX_CHILDREN = 90;

export class View {
    constructor(transcript, scroller) {
        this.el = transcript;
        this.scroller = scroller;
        this.queue = [];
        this.cur = null;
        this.speed = 'normal';
        this.fast = 1;                  // ?debug=1&fast=N
        this.stick = true;              // follow the bottom unless the reader scrolled up
        this.lockUntil = 0;             // ignore keyboard-made clicks just after a skip
        this.clickLockUntil = 0;        // ignore every click until then: the layout moved under a finger
        this.lastDown = -1e9;           // when the last finger or mouse went down on the story
        this.rgb = [255, 176, 0];
        this.statics = [];
        this.onChar = null;             // (ch) => void, for the keyboard sound
        this.onChoose = null;           // (i) => void
        this.onEndAction = null;        // ('new' | 'title') => void
        scroller.addEventListener('scroll', () => {
            this.stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
        });
        scroller.addEventListener('pointerdown', () => { this.lastDown = performance.now(); }, { capture: true });
        this.el.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            const now = performance.now();
            if (now < this.clickLockUntil || (e.detail === 0 && now < this.lockUntil)) { e.preventDefault(); return; }
            if (b.dataset.i != null) { if (!b.disabled && this.onChoose) this.onChoose(+b.dataset.i); }
            else if (b.dataset.end && this.onEndAction) this.onEndAction(b.dataset.end);
        });
    }

    get busy() { return !!this.cur || this.queue.length > 0; }

    // ------------------------------------------------------------------ phosphor
    setPhosphor() {
        const v = getComputedStyle(document.body).getPropertyValue('--ph-rgb');
        const rgb = v.split(',').map((x) => +x.trim());
        if (rgb.length === 3 && rgb.every(Number.isFinite)) this.rgb = rgb;
        for (const s of this.statics) paintArt(s.canvas, s.bits, ART.h, this.rgb);
    }

    /** Draw a picture straight onto a canvas that is already in the page (the title screen). */
    drawStatic(canvas, key) {
        const bits = renderArt(key, canvas.width, canvas.height);
        this.statics = this.statics.filter((s) => s.canvas !== canvas).concat({ canvas, bits });
        paintArt(canvas, bits, canvas.height, this.rgb);
    }

    // ------------------------------------------------------------------ the transcript
    clear() {
        this.queue.length = 0;
        this.cur = null;
        this.el.textContent = '';
        this.statics = this.statics.filter((s) => s.canvas.isConnected);
    }

    push(block) { this.queue.push(block); }
    now(fn) { this.push({ k: 'now', fn }); }
    line(cls, text) { this.now(() => { const d = document.createElement('div'); d.className = cls; d.textContent = text; this.append(d); }); }
    type(cls, text, mult = 1) { this.push({ k: 'type', cls, text, mult }); }

    append(node) {
        this.el.appendChild(node);
        while (this.el.children.length > MAX_CHILDREN) this.el.firstElementChild.remove();
        this.follow();
    }
    follow() { if (this.stick) this.scroller.scrollTop = this.scroller.scrollHeight; }

    /** Show the game as it stands (a loaded save): the current passage and its choices, no animation. */
    restore(G) {
        this.clear();
        this.line('sys', 'RESTORED FROM DISK A:');
        this.scene(G, G.node);
        this.skip();
    }

    scene(G, nodeId) {
        const p = passageOf(G, nodeId);
        this.now(() => { const h = document.createElement('div'); h.className = 'heading'; h.textContent = p.title; this.append(h); });
        this.push({ k: 'fig', key: p.art });
        for (const l of p.lines) this.type('p', l);
        if (G.over) return;
        const list = choicesFor(G).map((c) => ({ i: c.i, t: c.t, locked: c.locked }));
        this.now(() => this.showChoices(list));
    }

    showChoices(list) {
        const ol = document.createElement('ol');
        ol.className = 'choices';
        list.forEach((c, n) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.i = c.i;
            const num = document.createElement('span');
            num.className = 'num';
            num.textContent = n < 9 ? `[${n + 1}]` : '[ ]';
            b.append(num, c.t);
            if (c.locked) {
                b.disabled = true;
                const why = document.createElement('span');
                why.className = 'why';
                why.textContent = `[${c.locked}]`;
                b.append(why);
            }
            li.append(b);
            ol.append(li);
        });
        // a finger that went down a moment ago was meant for the text it was skipping, not for what
        // appears under it (a tap's click lands on whatever is there when the finger lifts)
        if (performance.now() - this.lastDown < 600) this.clickLockUntil = performance.now() + 450;
        this.append(ol);
        this.focusFirst();
        this.scroller.scrollTop = this.scroller.scrollHeight;
    }

    choiceButtons() { return [...this.el.querySelectorAll('.choices button:not(:disabled)')]; }
    focusFirst() { this.choiceButtons()[0]?.focus({ preventScroll: true }); }
    clearChoices() { for (const o of this.el.querySelectorAll('.choices')) o.remove(); }

    /** Press choice number n (1-based) of the visible list. */
    pressNumber(n) {
        const items = [...this.el.querySelectorAll('.choices li button')];
        const b = items[n - 1];
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    moveFocus(dir) {
        const list = this.choiceButtons();
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus({ preventScroll: false });
    }

    // ------------------------------------------------------------------ events → transcript
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'choice': this.now(() => this.clearChoices()); this.line('echo', e.text); break;
                case 'roll': {
                    const bonus = e.bonus ? ` +${e.bonus} kit` : '';
                    this.type('roll', `ROLL ${STAT_NAMES[e.stat]}: 2d6 [${e.dice[0]}+${e.dice[1]}] +${e.mod}${bonus} = ${e.total} vs ${e.dc} — ${e.ok ? 'SUCCESS' : 'FAILURE'}`, 2);
                    break;
                }
                case 'result': for (const l of e.lines) this.type('p', l); break;
                case 'notice': this.line('sys ' + (e.tone || ''), e.text); break;
                case 'item': this.line('sys ' + (e.gained ? 'good' : ''), `${e.gained ? 'PICKED UP' : 'LOST'}: ${ITEMS[e.id].name.toUpperCase()}`); break;
                case 'stat': this.line('sys ' + (e.delta < 0 ? 'bad' : 'good'), `${e.which.toUpperCase()} ${e.delta > 0 ? '+' : ''}${e.delta} (${e.value})`); break;
                case 'und': this.line('sys good', `GENOME DECODED +${e.delta}% (${e.value}%)`); break;
                case 'codex': this.line('sys good', `JOURNAL UPDATED: ${CODEX[e.id].title}`); break;
                case 'scene': if (!e.quiet) this.scene(G, e.node); else if (!G.over) { const list = choicesFor(G).map((c) => ({ i: c.i, t: c.t, locked: c.locked })); this.now(() => this.showChoices(list)); } break;
                case 'end': {
                    const s = summary(G);
                    this.now(() => this.showEnd(s));
                    break;
                }
                default: break;
            }
        }
    }

    showEnd(s) {
        const d = document.createElement('div');
        d.className = 'endcard';
        d.innerHTML = '<h3></h3><dl></dl><div class="row-btns"></div>';
        d.querySelector('h3').textContent = `THE END — ${s.name}`;
        const dl = d.querySelector('dl');
        for (const [k, v] of [['DAYS ON VESPER', s.days], ['GENOME DECODED', s.und + '%'], ['JOURNAL', `${s.codex}/${s.codexTotal}`], ['ITEMS CARRIED', s.items]]) {
            const dt = document.createElement('dt'); dt.textContent = k;
            const dd = document.createElement('dd'); dd.textContent = v;
            dl.append(dt, dd);
        }
        const row = d.querySelector('.row-btns');
        for (const [act, label] of [['new', 'NEW GAME'], ['title', 'TITLE SCREEN']]) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'btn' + (act === 'new' ? ' primary' : ''); b.dataset.end = act; b.textContent = label;
            row.append(b);
        }
        this.append(d);
        row.firstElementChild.focus({ preventScroll: true });
        this.scroller.scrollTop = this.scroller.scrollHeight;
    }

    // ------------------------------------------------------------------ the clock
    /** Advance the animation by dt seconds: draw a picture, type a paragraph, run instant steps. */
    frame(dt) {
        for (let guard = 0; guard < 400; guard++) {
            if (!this.cur) {
                this.cur = this.queue.shift();
                if (!this.cur) return;
                this.begin(this.cur);
            }
            if (!this.step(this.cur, dt)) return;
            this.cur = null;
            dt = 0;
        }
    }

    begin(b) {
        if (b.k === 'fig') {
            const fig = document.createElement('div');
            fig.className = 'figure';
            const c = document.createElement('canvas');
            c.className = 'art'; c.width = ART.w; c.height = ART.h;
            c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'A picture of the scene');
            fig.append(c);
            b.canvas = c; b.bits = renderArt(b.key, ART.w, ART.h); b.rows = 0;
            this.statics.push({ canvas: c, bits: b.bits });
            this.append(fig);
        } else if (b.k === 'type') {
            const p = document.createElement('p');
            p.className = b.cls;
            p.classList.add('cursor');
            b.p = p; b.node = document.createTextNode(''); p.append(b.node);
            b.i = 0; b.acc = 0; b.wait = 0;
            this.append(p);
        }
    }

    /** Returns true when the block is finished. */
    step(b, dt) {
        if (b.k === 'now') { b.fn(); return true; }
        const instant = this.speed === 'instant';
        if (b.k === 'fig') {
            b.rows += instant ? ART.h : dt * REVEAL_ROWS_PER_SEC * this.fast;
            paintArt(b.canvas, b.bits, b.rows, this.rgb);
            this.follow();
            return b.rows >= ART.h;
        }
        // typing
        const cps = (TYPE_CPS[this.speed] || TYPE_CPS.normal) * b.mult;
        if (instant) b.i = b.text.length;
        else {
            b.wait -= dt;
            b.acc += dt * cps * this.fast;
            while (b.acc >= 1 && b.wait <= 0 && b.i < b.text.length) {
                const ch = b.text[b.i++];
                b.node.data += ch;
                b.acc -= 1;
                if (this.onChar) this.onChar(ch);
                // a breath at the end of a sentence or clause
                if (/[.?!]/.test(ch) && b.text[b.i] === ' ') b.wait = (0.2 * 110 / cps) / this.fast;
                else if (/[,;:]/.test(ch)) b.wait = (0.07 * 110 / cps) / this.fast;
            }
            if (b.i < b.text.length) { b.acc = Math.min(b.acc, 4); this.follow(); return false; }
        }
        b.node.data = b.text;
        b.p.classList.remove('cursor');
        this.follow();
        return true;
    }

    /** Finish everything at once: the picture, the typing, the choices. */
    skip() {
        this.lockUntil = performance.now() + 350;
        if (performance.now() - this.lastDown < 600) this.clickLockUntil = performance.now() + 450;
        let n = 0;
        if (this.cur) { const b = this.cur; this.finish(b); this.cur = null; }
        while (this.queue.length && n++ < 500) {
            const b = this.queue.shift();
            this.begin(b);
            this.finish(b);
        }
        this.follow();
    }

    finish(b) {
        if (b.k === 'now') b.fn();
        else if (b.k === 'fig') { paintArt(b.canvas, b.bits, ART.h, this.rgb); }
        else if (b.k === 'type') { b.node.data = b.text; b.p.classList.remove('cursor'); }
    }
}
