/* TALEWRIGHT runtime — ui: window skins, text with control codes, the message
 * box, choices, lists, the main menu, shops, save slots, the title screen,
 * game over and The End. Drawn on the UI canvas in 320×240 virtual pixels
 * (the canvas itself is full resolution, so text is crisp in any language). */
(window.TW_MODULES = window.TW_MODULES || []).push(['ui', function (TW) {
    'use strict';
    const U = TW.util;
    const VW = 320, VH = 240;

    const SKINS = {
        classic:   { name: 'Classic', fill: ['#2c3c90', '#121a48'], border: '#ffffff', inner: '#7a8ad0', text: '#ffffff', dim: '#9aa4d0', cursor: '#ffe066', accent: '#ffe066', hp: '#6ae07a', mp: '#6ab0ff' },
        parchment: { name: 'Parchment', fill: ['#f6e8c6', '#e2cba0'], border: '#6a4a2a', inner: '#b89868', text: '#3a2a1a', dim: '#8a6a4a', cursor: '#c8402a', accent: '#a0401a', hp: '#3a8a3a', mp: '#2a5aa8', pack: 'skin.parchment' },
        midnight:  { name: 'Midnight', fill: ['#1c1c2e', '#06060e'], border: '#c8c8e8', inner: '#4a4a7a', text: '#e8e8ff', dim: '#8a8ab0', cursor: '#9ad0ff', accent: '#9ad0ff', hp: '#6ae07a', mp: '#6ab0ff', pack: 'skin.midnight' },
        forest:    { name: 'Forest', fill: ['#2e623e', '#123a20'], border: '#e8f0c8', inner: '#7aa86a', text: '#f4ffe8', dim: '#a8c898', cursor: '#ffe066', accent: '#ffe066', hp: '#a8ff8a', mp: '#8ad0ff', pack: 'skin.forest' },
        rose:      { name: 'Rose', fill: ['#94406a', '#4a1a30'], border: '#ffe0ec', inner: '#d07aa0', text: '#fff2f8', dim: '#e0a8c0', cursor: '#ffe066', accent: '#ffe066', hp: '#a8ffb0', mp: '#a8d8ff', pack: 'skin.rose' },
        neon:      { name: 'Neon', fill: ['#16082c', '#05020e'], border: '#ff3ad0', inner: '#3ae0ff', text: '#eafaff', dim: '#8ab0c8', cursor: '#3ae0ff', accent: '#ff3ad0', hp: '#3aff9a', mp: '#3ae0ff', pack: 'skin.neon' },
    };
    const COLORS = ['', '#6ab0ff', '#ff6a6a', '#6ae07a', '#ffe066', '#c08aff', '#ffa04a', '#a0a0a8'];
    const FONT = '"Trebuchet MS", "Segoe UI", Verdana, system-ui, sans-serif';
    const F = (px, bold) => (bold ? 'bold ' : '') + px + 'px ' + FONT;

    // ── drawing helpers ──────────────────────────────────────────────────────
    function rr(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
        g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
        g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
        g.closePath();
    }
    function win(g, s, x, y, w, h, alpha) {
        g.save();
        g.globalAlpha = alpha === undefined ? 0.97 : alpha;
        const gr = g.createLinearGradient(0, y, 0, y + h);
        gr.addColorStop(0, s.fill[0]); gr.addColorStop(1, s.fill[1]);
        rr(g, x, y, w, h, 3); g.fillStyle = gr; g.fill();
        g.globalAlpha = 1;
        g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,0.55)'; rr(g, x - 0.4, y - 0.4, w + 0.8, h + 0.8, 3.4); g.stroke();
        g.lineWidth = 0.8; g.strokeStyle = s.border; rr(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 2.6); g.stroke();
        g.lineWidth = 0.4; g.strokeStyle = s.inner; rr(g, x + 1.8, y + 1.8, w - 3.6, h - 3.6, 2); g.stroke();
        g.restore();
    }
    function text(g, s, str, x, y, opts) {
        opts = opts || {};
        g.font = F(opts.size || 9, opts.bold);
        g.textBaseline = 'top';
        g.textAlign = opts.align || 'left';
        if (opts.shadow !== false) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(str, x + 0.6, y + 0.6, opts.max); }
        g.fillStyle = opts.color || s.text;
        g.fillText(str, x, y, opts.max);
        g.textAlign = 'left';
    }
    function cursor(g, s, x, y, w, h, t) {
        const a = 0.3 + 0.18 * Math.sin((t || 0) * 6);
        g.save();
        g.fillStyle = U.rgba(s.cursor, a); rr(g, x, y, w, h, 2); g.fill();
        g.lineWidth = 0.6; g.strokeStyle = s.cursor; rr(g, x, y, w, h, 2); g.stroke();
        g.restore();
    }
    function bar(g, x, y, w, frac, col) {
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, w, 2.2);
        g.fillStyle = col; g.fillRect(x, y, w * U.clamp(frac, 0, 1), 2.2);
    }
    function img(g, c, x, y, scale) {
        if (!c) return;
        g.imageSmoothingEnabled = false;
        g.drawImage(c, x, y, c.width * (scale || 1), c.height * (scale || 1));
    }
    const inRect = (p, x, y, w, h) => p && p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;

    // ── text codes ───────────────────────────────────────────────────────────
    function expand(game, str) {
        const st = game.state, p = game.project;
        return String(str || '')
            .replace(/\\v\[(\d+)\]/gi, (m, n) => String(st.v(+n)))
            .replace(/\\n\[(\d+)\]/gi, (m, n) => { const a = st.actorDb(+n); return a ? a.name : ''; })
            .replace(/\\p/gi, () => (st.leader() ? st.leader().name : ''))
            .replace(/\\g/gi, () => st.gold + ' ' + ((p.system && p.system.currency) || 'G'))
            .replace(/\\i\[(\d+)\]/gi, (m, n) => { const it = st.itemDb(+n); return it ? it.name : ''; });
    }

    /** Lay out text into glyphs { ch, x, y, color } and controls, wrapped to width. */
    function layout(g, str, width, size, base) {
        g.font = F(size);
        const LH = size + 4;
        const glyphs = [];
        let x = 0, line = 0, color = base;
        const tokens = [];
        // tokenise into words, spaces, newlines and codes
        const re = /\\c\[(\d+)\]|\\\.|\\\||\\!|\\>|\n|\s+|[^\s\\]+|\\/g;
        let m;
        while ((m = re.exec(str))) {
            const s = m[0];
            if (m[1] !== undefined) tokens.push({ k: 'color', v: +m[1] });
            else if (s === '\\.') tokens.push({ k: 'pause', v: 0.25 });
            else if (s === '\\|') tokens.push({ k: 'pause', v: 1 });
            else if (s === '\\!') tokens.push({ k: 'key' });
            else if (s === '\\>') tokens.push({ k: 'instant' });
            else if (s === '\n') tokens.push({ k: 'nl' });
            else if (/^\s+$/.test(s)) tokens.push({ k: 'sp', v: ' ' });
            else tokens.push({ k: 'w', v: s });
        }
        const spaceW = g.measureText(' ').width;
        for (const t of tokens) {
            if (t.k === 'color') { color = t.v > 0 && COLORS[t.v] ? COLORS[t.v] : base; continue; }
            if (t.k === 'nl') { x = 0; line++; continue; }
            if (t.k === 'sp') { if (x > 0) x += spaceW; continue; }
            if (t.k !== 'w') { glyphs.push({ ctrl: t, line }); continue; }
            const w = g.measureText(t.v).width;
            if (x > 0 && x + w > width) { x = 0; line++; }
            let cx = x;
            for (const ch of Array.from(t.v)) {
                const cw = g.measureText(ch).width;
                if (cx + cw > width && cx > 0 && w > width) { cx = 0; line++; }
                glyphs.push({ ch, x: cx, line, color });
                cx += cw;
            }
            x = cx;
        }
        return { glyphs, lines: line + 1, LH };
    }

    // ── widgets ──────────────────────────────────────────────────────────────
    class MessageBox {
        constructor(ui, cmd, opts) {
            this.ui = ui;
            this.modal = true;
            this.cmd = cmd;
            this.hold = !!(opts && opts.holdForChoice);
            this.done = false;
            this.t = 0;
            const s = ui.skin();
            const g = ui.measure;
            this.face = cmd.face ? TW.sprites.face(cmd.face) : null;
            this.x = 8; this.w = VW - 16; this.h = 62;
            this.y = cmd.pos === 'top' ? 8 : cmd.pos === 'middle' ? (VH - this.h) / 2 : VH - this.h - 8;
            this.tx = this.face ? 50 : 10;
            const lay = layout(g, expand(ui.game, cmd.text), this.w - this.tx - 10, 10, s.text);
            this.LH = lay.LH;
            // split into pages of 4 lines
            this.pages = [];
            for (const gl of lay.glyphs) {
                const p = Math.floor(gl.line / 4);
                (this.pages[p] = this.pages[p] || []).push(gl);
            }
            if (!this.pages.length) this.pages.push([]);
            this.page = 0;
            this.startPage();
        }
        startPage() { this.shown = 0; this.typing = true; this.pause = 0; this.waitKey = false; this.instant = false; }
        update(inp, dt) {
            this.t += dt;
            const glyphs = this.pages[this.page];
            const ok = inp.pressed('ok') || inp.pressed('cancel') || !!inp.tapNow;
            if (this.typing) {
                if (this.waitKey) { if (ok) { this.waitKey = false; inp.eat('ok'); } return; }
                if (ok && !this.instant) { this.instant = true; inp.eat('ok'); }
                if (this.pause > 0 && !this.instant) { this.pause -= dt; return; }
                let budget = this.instant ? 9999 : dt * 70 + (this.carry || 0);
                while (budget >= 1 && this.shown < glyphs.length) {
                    const gl = glyphs[this.shown];
                    if (gl.ctrl) {
                        this.shown++;
                        if (gl.ctrl.k === 'pause' && !this.instant) { this.pause = gl.ctrl.v; break; }
                        if (gl.ctrl.k === 'key') { this.waitKey = true; this.instant = false; break; }
                        if (gl.ctrl.k === 'instant') this.instant = true;
                        continue;
                    }
                    this.shown++; budget--;
                    if (!this.instant && gl.ch.trim() && this.shown % 3 === 0) this.ui.game.sfx('cursor', 0.25);
                }
                this.carry = budget < 1 ? budget : 0;
                if (this.shown >= glyphs.length) {
                    this.typing = false;
                    if (this.hold && this.page === this.pages.length - 1) this.done = true;
                }
                return;
            }
            if (this.hold && this.page === this.pages.length - 1) { this.done = true; return; }
            if (ok) {
                inp.eat('ok'); inp.eat('cancel');
                if (this.page < this.pages.length - 1) { this.page++; this.startPage(); }
                else { this.done = true; this.closed = true; }
            }
        }
        draw(g, s) {
            win(g, s, this.x, this.y, this.w, this.h);
            if (this.cmd.speaker) {
                g.font = F(9, true);
                const nw = g.measureText(this.cmd.speaker).width + 14;
                const ny = this.y > 30 ? this.y - 13 : this.y + this.h + 1;
                win(g, s, this.x + 4, ny, nw, 13);
                text(g, s, this.cmd.speaker, this.x + 11, ny + 2.2, { bold: true, color: s.accent });
            }
            if (this.face) {
                g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(this.x + 7, this.y + 9, 36, 36);
                img(g, this.face, this.x + 8, this.y + 9, 36 / 14);
            }
            g.font = F(10);
            g.textBaseline = 'top';
            const glyphs = this.pages[this.page];
            const line0 = this.page * 4;
            for (let i = 0; i < this.shown && i < glyphs.length; i++) {
                const gl = glyphs[i];
                if (gl.ctrl) continue;
                const px = this.x + this.tx + gl.x, py = this.y + 7 + (gl.line - line0) * this.LH;
                g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(gl.ch, px + 0.6, py + 0.6);
                g.fillStyle = gl.color; g.fillText(gl.ch, px, py);
            }
            if ((!this.typing || this.waitKey) && !this.hold) {
                const bob = Math.sin(this.t * 6) * 1.2;
                g.fillStyle = s.cursor;
                g.beginPath(); g.moveTo(this.x + this.w / 2 - 3, this.y + this.h - 7 + bob); g.lineTo(this.x + this.w / 2 + 3, this.y + this.h - 7 + bob); g.lineTo(this.x + this.w / 2, this.y + this.h - 4 + bob); g.fill();
            }
        }
    }

    /** A vertical list. items: [{ label, right, enabled, icon, iconCanvas, color }] */
    class ListWin {
        constructor(ui, o) {
            this.ui = ui; this.modal = true;
            Object.assign(this, { x: 8, y: 8, w: 120, rows: 6, rowH: 14, cols: 1, index: 0, top: 0, title: '' }, o);
            this.items = o.items || [];
            this.h = o.h || this.rows * this.rowH + 10 + (this.title ? 13 : 0);
            this.t = 0;
            this.done = false;
            this.index = U.clamp(this.index, 0, Math.max(0, this.items.length - 1));
        }
        get perPage() { return this.rows * this.cols; }
        rowRect(i) {
            const r = i - this.top;
            const cw = (this.w - 10) / this.cols;
            return { x: this.x + 5 + (r % this.cols) * cw, y: this.y + 5 + (this.title ? 13 : 0) + Math.floor(r / this.cols) * this.rowH, w: cw, h: this.rowH };
        }
        update(inp, dt) {
            this.t += dt;
            const n = this.items.length;
            const nav = inp.nav();
            if (n) {
                if (nav === 'down') this.move(this.cols);
                if (nav === 'up') this.move(-this.cols);
                if (nav === 'right' && this.cols > 1) this.move(1);
                if (nav === 'left' && this.cols > 1) this.move(-1);
                if (nav === 'right' && this.cols === 1 && this.onRight) this.onRight(this.items[this.index], this.index);
                if (nav === 'left' && this.cols === 1 && this.onLeft) this.onLeft(this.items[this.index], this.index);
            }
            const tap = inp.tapNow;
            if (tap) {
                if (inRect(tap, this.x, this.y, this.w, this.h)) {
                    for (let i = this.top; i < Math.min(n, this.top + this.perPage); i++) {
                        const r = this.rowRect(i);
                        if (inRect(tap, r.x, r.y, r.w, r.h)) {
                            if (this.index === i || this.tapSelects) { this.index = i; this.choose(); }
                            else { this.index = i; this.ui.game.sfx('cursor'); if (this.onMove) this.onMove(this.items[i], i); }
                            return;
                        }
                    }
                    // tap on the scroll edges
                    if (tap.y > this.y + this.h - 8) this.move(this.perPage);
                    else if (tap.y < this.y + 8 + (this.title ? 13 : 0)) this.move(-this.perPage);
                    return;
                }
                if (this.onCancel) { this.ui.game.sfx('cancel'); this.onCancel(); }
                return;
            }
            if (inp.pressed('ok')) { inp.eat('ok'); this.choose(); return; }
            if (inp.pressed('cancel') && this.onCancel) { inp.eat('cancel'); this.ui.game.sfx('cancel'); this.onCancel(); }
        }
        move(d) {
            const n = this.items.length;
            if (!n) return;
            const ni = U.clamp(this.index + d, 0, n - 1);
            if (ni === this.index) return;
            this.index = ni;
            if (this.index < this.top) this.top = this.index - (this.index % this.cols);
            if (this.index >= this.top + this.perPage) this.top = this.index - (this.index % this.cols) - this.perPage + this.cols;
            this.ui.game.sfx('cursor');
            if (this.onMove) this.onMove(this.items[this.index], this.index);
        }
        choose() {
            const it = this.items[this.index];
            if (!it) return;
            if (it.enabled === false) { this.ui.game.sfx('buzzer'); return; }
            this.ui.game.sfx('confirm');
            if (this.onChoose) this.onChoose(it, this.index);
        }
        draw(g, s) {
            win(g, s, this.x, this.y, this.w, this.h);
            if (this.title) text(g, s, this.title, this.x + 8, this.y + 5, { bold: true, color: s.accent, size: 9 });
            const n = this.items.length;
            for (let i = this.top; i < Math.min(n, this.top + this.perPage); i++) {
                const it = this.items[i], r = this.rowRect(i);
                if (i === this.index && this.active !== false) cursor(g, s, r.x, r.y, r.w, r.h - 1, this.t);
                let tx = r.x + 4;
                if (it.iconCanvas) { img(g, it.iconCanvas, r.x + 2, r.y + 1, 1); tx += 13; }
                const col = it.enabled === false ? s.dim : it.color || s.text;
                text(g, s, it.label, tx, r.y + 2.2, { color: col, max: r.w - (tx - r.x) - (it.right ? 30 : 4) });
                if (it.right !== undefined && it.right !== '') text(g, s, String(it.right), r.x + r.w - 4, r.y + 2.2, { color: col, align: 'right' });
            }
            if (this.top > 0) tri(g, s, this.x + this.w / 2, this.y + 4 + (this.title ? 13 : 0), -1);
            if (this.top + this.perPage < n) tri(g, s, this.x + this.w / 2, this.y + this.h - 3, 1);
            if (!n && this.empty) text(g, s, this.empty, this.x + 10, this.y + 8 + (this.title ? 13 : 0), { color: s.dim });
        }
    }
    function tri(g, s, x, y, d) {
        g.fillStyle = s.cursor;
        g.beginPath(); g.moveTo(x - 3, y - d * 1.5); g.lineTo(x + 3, y - d * 1.5); g.lineTo(x, y + d * 1.5); g.fill();
    }

    class ChoiceBox extends ListWin {
        constructor(ui, options, cancel) {
            const g = ui.measure; g.font = F(9);
            const w = Math.min(200, Math.max(...options.map((o) => g.measureText(o).width)) + 24);
            const h = options.length * 14 + 10;
            super(ui, { items: options.map((o) => ({ label: o })), x: VW - w - 10, y: VH - 70 - h - 6, w, rows: options.length, tapSelects: true });
            this.result = -1;
            this.onChoose = (it, i) => { this.result = i; this.done = true; };
            if (cancel >= 0) this.onCancel = () => { this.result = cancel; this.done = true; };
            if (!ui.stack.some((x) => x instanceof MessageBox)) this.y = VH - h - 10;
        }
    }

    /** Draw the party summary used by the menu and shops. */
    function partyPanel(g, s, game, x, y, w, h, sel, t) {
        win(g, s, x, y, w, h);
        const st = game.state;
        const rowH = Math.min(46, (h - 8) / Math.max(1, st.party.length));
        st.party.forEach((a, i) => {
            const ry = y + 4 + i * rowH;
            if (sel === i) cursor(g, s, x + 4, ry, w - 8, rowH - 2, t);
            const db = st.actorDb(a.id) || {};
            const fc = TW.sprites.face(db.sprite || 'hero');
            img(g, fc, x + 7, ry + 3, 2);
            const tx = x + 40;
            text(g, s, a.name, tx, ry + 2, { bold: true });
            text(g, s, (db.cls || '') + '  Lv ' + a.level, tx + 62, ry + 2, { color: s.dim, size: 8 });
            const hpm = st.maxHp(a), mpm = st.maxMp(a);
            text(g, s, 'HP', tx, ry + 13, { color: s.dim, size: 8 });
            text(g, s, a.hp + '/' + hpm, tx + 70, ry + 13, { size: 8, align: 'right', color: a.hp <= 0 ? '#ff6a6a' : a.hp < hpm / 4 ? '#ffe066' : s.text });
            bar(g, tx, ry + 22, 70, a.hp / hpm, s.hp);
            if (mpm > 0) {
                text(g, s, 'MP', tx + 80, ry + 13, { color: s.dim, size: 8 });
                text(g, s, a.mp + '/' + mpm, tx + 140, ry + 13, { size: 8, align: 'right' });
                bar(g, tx + 80, ry + 22, 60, a.mp / mpm, s.mp);
            }
        });
    }

    // ── the UI manager ───────────────────────────────────────────────────────
    class UI {
        constructor(game) {
            this.game = game;
            this.stack = [];
            this.banner = null;
            this.measure = U.canvas(4, 4).getContext('2d');
        }
        skin() { const id = this.game.project.system && this.game.project.system.windowSkin; return SKINS[id] || SKINS.classic; }
        get busy() { return this.stack.some((w) => w.modal); }
        push(w) { this.stack.push(w); return w; }
        remove(w) { const i = this.stack.indexOf(w); if (i >= 0) this.stack.splice(i, 1); }
        clear() { this.stack.length = 0; }
        update(dt, inp) {
            const top = this.stack[this.stack.length - 1];
            if (top) top.update(inp, dt);
            // finished widgets leave; a message held for a choice leaves with it
            for (let i = this.stack.length - 1; i >= 0; i--) {
                const w = this.stack[i];
                if (w.done && !(w instanceof MessageBox && w.hold)) this.stack.splice(i, 1);
            }
            if (!this.stack.some((w) => w instanceof ChoiceBox)) {
                for (let i = this.stack.length - 1; i >= 0; i--) {
                    const w = this.stack[i];
                    if (w instanceof MessageBox && w.hold && w.done && w.released) this.stack.splice(i, 1);
                }
            }
            if (this.banner) { this.banner.t += dt; if (this.banner.t > 2.8) this.banner = null; }
        }
        draw(g) {
            const s = this.skin();
            if (this.banner) {
                const b = this.banner, a = Math.min(1, b.t * 3, (2.8 - b.t) * 2);
                g.save(); g.globalAlpha = a;
                g.font = F(10, true);
                const w = g.measureText(b.text).width + 30;
                const grd = g.createLinearGradient(8, 0, 8 + w, 0);
                grd.addColorStop(0, 'rgba(0,0,0,0.7)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = grd; g.fillRect(8, 10, w, 18);
                text(g, s, b.text, 16, 13.5, { bold: true, size: 10, color: '#ffffff' });
                g.restore();
            }
            for (const w of this.stack) w.draw(g, s);
        }

        // ── commands ──
        message(cmd, opts) {
            const m = this.push(new MessageBox(this, cmd, opts));
            return m;
        }
        choice(options, cancel) {
            const c = this.push(new ChoiceBox(this, options, cancel));
            const ui = this;
            const handle = { done: false, result: -1 };
            const orig = c.update.bind(c);
            c.update = (inp, dt) => {
                orig(inp, dt);
                if (c.done) {
                    handle.done = true; handle.result = c.result;
                    for (const w of ui.stack) if (w instanceof MessageBox && w.hold) w.released = true;
                }
            };
            return handle;
        }
        say(lines) {
            // a simple sequence of plain messages
            const queue = (Array.isArray(lines) ? lines : [lines]).map((t) => (typeof t === 'string' ? { text: t } : t));
            const handle = { done: !queue.length };
            const next = () => {
                if (!queue.length) { handle.done = true; return; }
                const m = this.push(new MessageBox(this, queue.shift()));
                const orig = m.update.bind(m);
                m.update = (inp, dt) => { orig(inp, dt); if (m.done) next(); };
            };
            next();
            return handle;
        }
        levelUps(ups) {
            const st = this.game.state;
            const lines = [];
            for (const u of ups) {
                let t = u.actor.name + ' reached level ' + u.level + '!';
                for (const sk of u.learned) { const d = st.skillDb(sk); if (d) t += '\n' + u.actor.name + ' learned \\c[4]' + d.name + '\\c[0]!'; }
                lines.push(t);
            }
            this.game.sfx('levelup');
            return this.say(lines);
        }
        showBanner(t) { if (t) this.banner = { text: t, t: 0 }; }
    }

    TW.ui = { SKINS, COLORS, F, FONT, VW, VH, win, text, cursor, bar, img, rr, inRect, expand, layout, partyPanel, UI, ListWin, MessageBox, ChoiceBox };
}]);
