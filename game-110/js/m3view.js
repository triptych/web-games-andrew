// The Skull Swap board: a Canvas 2D view of the cemetery's match-three. It shows the sim's board, plays back the steps a
// swap returns (swap, clear, fall, shuffle) as short animations, and turns drags, taps and keys into swap requests.
// It reads the sim; it never changes it — swaps go out through onSwap and come back as steps.

import { W, H, SP, KINDS, validMoves } from './sim/match3.js';
import { drawToken, drawPumpkin } from './view/art.js';

const COL = { skull: '#f4eefa', cupcake: '#ff9ec7', yarn: '#b48cff', candle: '#ffd36b', rose: '#c03a6a', teacup: '#5fd0c0' };
const DUR = { swap: 0.14, bad: 0.26, clear: 0.26, fall: 0.24, shuffle: 0.45 };
const ease = (t) => 1 - (1 - t) ** 3;

export class M3View {
    constructor(canvas, { audio, onSwap }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = audio;
        this.onSwap = onSwap;
        this.sprites = KINDS.map((k) => drawToken(k).toCanvas());
        this.pumpkin = drawPumpkin().toCanvas();
        this.toks = [];
        this.webs = [];
        this.queue = [];
        this.anim = null;
        this.parts = [];
        this.texts = [];
        this.beams = [];
        this.sel = -1;
        this.cursor = 24;
        this.idle = 0;
        this.B = null;
        this.drag = null;
        this.speed = 1;          // animation speed (the tests run it faster, like the sim's fast mode)
        canvas.addEventListener('pointerdown', (e) => this.down(e));
        canvas.addEventListener('pointermove', (e) => this.move(e));
        for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { this.drag = null; });
    }

    get busy() { return !!this.anim || this.queue.length > 0; }

    /** Show a board as it stands, with no animation. */
    setBoard(B) {
        this.B = B;
        this.toks = B.cells.map((k, i) => ({ kind: k, sp: B.sp[i], ox: 0, oy: 0, s: 1, a: 1, pop: 0 }));
        this.webs = [...B.webs];
        this.queue.length = 0;
        this.anim = null;
        this.sel = -1;
        this.idle = 0;
    }

    /** Queue the steps of one swap; they play one after another. */
    play(steps) {
        for (const s of steps) this.queue.push(s);
        this.idle = 0;
    }

    // ------------------------------------------------------------------ input
    cellAt(e) {
        const r = this.canvas.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * W), y = Math.floor(((e.clientY - r.top) / r.height) * H);
        return x >= 0 && x < W && y >= 0 && y < H ? y * W + x : -1;
    }
    down(e) {
        e.preventDefault();
        const c = this.cellAt(e);
        if (c < 0) return;
        this.canvas.focus({ preventScroll: true });
        const r = this.canvas.getBoundingClientRect();
        this.drag = { c, x: e.clientX, y: e.clientY, cell: r.width / W };
        if (this.sel >= 0 && this.sel !== c && this.isNeighbour(this.sel, c)) { this.request(this.sel, c); this.drag = null; return; }
        this.sel = this.sel === c ? -1 : c;
        this.cursor = c;
    }
    move(e) {
        const d = this.drag;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < d.cell * 0.4) return;
        const [x, y] = [d.c % W, (d.c / W) | 0];
        const tx = x + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0), ty = y + (Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0);
        this.drag = null;
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
        this.request(d.c, ty * W + tx);
    }
    /** Keyboard: arrows move the cursor (or swap, once a token is picked up); Space/Enter picks up and puts down. */
    key(k) {
        const d = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }[k];
        if (d) {
            const x = (this.cursor % W) + d[0], y = ((this.cursor / W) | 0) + d[1];
            if (x < 0 || x >= W || y < 0 || y >= H) return;
            const to = y * W + x;
            if (this.sel >= 0) { this.request(this.sel, to); return; }
            this.cursor = to;
        } else if (k === 'Space' || k === 'Enter') this.sel = this.sel === this.cursor ? -1 : this.cursor;
    }
    isNeighbour(a, b) { return Math.abs((a % W) - (b % W)) + Math.abs(((a / W) | 0) - ((b / W) | 0)) === 1; }
    request(a, b) {
        this.sel = -1;
        this.cursor = b;
        if (this.busy || !this.B || this.B.over || !this.isNeighbour(a, b)) return;
        this.onSwap(a, b);
    }

    // ------------------------------------------------------------------ playback
    startNext() {
        const s = this.queue.shift();
        if (!s) return;
        const T = this.toks;
        this.anim = { s, t: 0, d: DUR[s.t === 'swap' ? 'swap' : s.t] || 0.2 };
        if (s.t === 'swap' || s.t === 'bad') {
            const [a, b] = [s.a, s.b];
            [T[a], T[b]] = [T[b], T[a]];
            const dx = (b % W) - (a % W), dy = ((b / W) | 0) - ((a / W) | 0);
            T[a].ox = dx; T[a].oy = dy; T[b].ox = -dx; T[b].oy = -dy;
            this.audio?.m3?.('swap');
            if (s.t === 'bad') this.anim.back = true;
        } else if (s.t === 'clear') {
            for (const c of s.cells) { T[c].dying = 1; this.burst(c, COL[KINDS[T[c].kind]] || '#fff', 7); }
            for (const m of s.makes) { T[m.i] = { kind: m.kind, sp: m.sp, ox: 0, oy: 0, s: 1, a: 1, pop: 1 }; this.burst(m.i, '#ffe36a', 14); }
            for (const w of s.webs) { this.webs[w] = 0; this.burst(w, '#e8e0ff', 10); }
            for (const f of s.fired) this.beams.push({ i: f.i, sp: f.sp, t: 0 });
            const all = [...s.cells, ...s.makes.map((m) => m.i)];
            const cx = all.reduce((a, c) => a + (c % W), 0) / all.length, cy = all.reduce((a, c) => a + ((c / W) | 0), 0) / all.length;
            this.texts.push({ x: cx + 0.5, y: cy + 0.5, text: '+' + s.gained, t: 0, big: s.chain > 1 });
            this.audio?.m3?.('clear', s.chain, s.fired.length);
        } else if (s.t === 'fall') {
            const next = T.map((t) => (t && !t.dying ? t : null));
            for (const d of s.drops) { const t = T[d.from]; next[d.to] = t; if (d.from !== d.to) next[d.from] = null; t.oy = ((d.from / W) | 0) - ((d.to / W) | 0); }
            for (const sp of s.spawns) next[sp.to] = { kind: sp.kind, sp: 0, ox: 0, oy: sp.row - ((sp.to / W) | 0) - 0.0, s: 1, a: 1, pop: 0 };
            this.toks = next.map((t, i) => t || { kind: this.B.cells[i], sp: this.B.sp[i], ox: 0, oy: 0, s: 1, a: 1, pop: 0 });
        } else if (s.t === 'shuffle') {
            this.toks = s.cells.map((k, i) => ({ kind: k, sp: s.sp[i], ox: 0, oy: 0, s: 0, a: 1, pop: 1 }));
            this.texts.push({ x: W / 2, y: H / 2, text: 'Shuffle!', t: 0, big: true });
        }
    }
    finishStep() {
        const { s } = this.anim;
        const T = this.toks;
        if (s.t === 'bad') { const [a, b] = [s.a, s.b]; [T[a], T[b]] = [T[b], T[a]]; for (const t of [T[a], T[b]]) { t.ox = 0; t.oy = 0; } this.audio?.m3?.('bad'); }
        for (const t of T) { t.ox = 0; t.oy = 0; t.s = 1; }
        this.anim = null;
        // when everything has played, the picture must match the sim exactly
        if (!this.queue.length && this.B) {
            const same = this.B.cells.every((k, i) => T[i].kind === k && T[i].sp === this.B.sp[i]);
            if (!same) this.setBoard(this.B);
        }
    }

    burst(c, color, n) {
        const x = (c % W) + 0.5, y = ((c / W) | 0) + 0.5;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0, life: 0.5 + Math.random() * 0.4, color, size: 0.08 + Math.random() * 0.07 }); }
    }

    // ------------------------------------------------------------------ the frame
    frame(dt, time) {
        if (!this.B) return;
        if (!this.anim) this.startNext();
        if (this.anim) {
            const A = this.anim;
            A.t += dt * this.speed;
            const k = Math.min(1, A.t / A.d), e = ease(k);
            const s = A.s;
            if (s.t === 'swap' || s.t === 'bad') {
                const back = s.t === 'bad' ? (k < 0.5 ? ease(k * 2) : 1 - ease((k - 0.5) * 2)) : e;
                const dx = (s.b % W) - (s.a % W), dy = ((s.b / W) | 0) - ((s.a / W) | 0);
                const ta = this.toks[s.a], tb = this.toks[s.b];
                if (s.t === 'swap') { ta.ox = dx * (1 - e); ta.oy = dy * (1 - e); tb.ox = -dx * (1 - e); tb.oy = -dy * (1 - e); }
                else { ta.ox = dx * (1 - back); ta.oy = dy * (1 - back); tb.ox = -dx * (1 - back); tb.oy = -dy * (1 - back); }
            } else if (s.t === 'clear') {
                for (const t of this.toks) if (t.dying) { t.s = 1 + e * 0.4; t.a = 1 - e; }
            } else if (s.t === 'fall') {
                for (const t of this.toks) if (t.oy) { t.oy0 ??= t.oy; t.oy = t.oy0 * (1 - Math.min(1, k * k * 1.15)); }
            } else if (s.t === 'shuffle') {
                for (const t of this.toks) t.s = e;
            }
            if (k >= 1) { for (const t of this.toks) delete t.oy0; this.finishStep(); }
        } else {
            this.idle += dt;
        }
        for (const t of this.toks) if (t.pop) t.pop = Math.max(0, t.pop - dt * 3);
        this.draw(dt, time);
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        return { w, h, cell: w / W };
    }

    draw(dt, time) {
        const { w, h, cell } = this.resize();
        const x = this.ctx;
        x.imageSmoothingEnabled = false;
        x.clearRect(0, 0, w, h);
        // the slab: stone cells in two shades
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            x.fillStyle = (i + j) % 2 ? 'rgba(80,64,110,0.85)' : 'rgba(64,50,92,0.85)';
            x.fillRect(i * cell, j * cell, cell, cell);
        }
        // a hint after a while with nothing happening
        let hint = null;
        if (!this.busy && !this.B.over && this.idle > 7) { const m = validMoves(this.B)[0]; if (m) hint = m; }
        const tk = Math.max(1, (cell * 0.8) / 16);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const c = j * W + i, t = this.toks[c];
            if (!t || t.kind < 0) continue;
            let s = t.s * (1 + t.pop * 0.25);
            if (hint && (hint[0] === c || hint[1] === c)) s *= 1 + Math.sin(time * 10) * 0.06;
            const cx = (i + 0.5 + t.ox) * cell, cy = (j + 0.5 + t.oy) * cell;
            if (cy < -cell) continue;
            x.globalAlpha = Math.max(0, Math.min(1, t.a));
            const size = 16 * tk * s;
            if (t.sp === SP.bomb) {
                x.fillStyle = `rgba(255,150,40,${0.25 + Math.sin(time * 6) * 0.1})`;
                x.beginPath(); x.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); x.fill();
                x.drawImage(this.pumpkin, cx - size / 2, cy - size / 2, size, size);
                x.drawImage(this.sprites[t.kind], cx + size * 0.05, cy + size * 0.05, size * 0.5, size * 0.5);
            } else {
                x.drawImage(this.sprites[t.kind], cx - size / 2, cy - size / 2, size, size);
                if (t.sp === SP.row || t.sp === SP.col) {
                    x.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(time * 8) * 0.25})`;
                    for (const o of [-0.18, 0.18]) {
                        if (t.sp === SP.row) x.fillRect(cx - size / 2, cy + o * size - size * 0.04, size, size * 0.08);
                        else x.fillRect(cx + o * size - size * 0.04, cy - size / 2, size * 0.08, size);
                    }
                }
            }
            x.globalAlpha = 1;
        }
        // cobwebs over their cells
        x.strokeStyle = 'rgba(235,230,255,0.75)';
        x.lineWidth = Math.max(1, cell / 28);
        for (let c = 0; c < W * H; c++) {
            if (!this.webs[c]) continue;
            const px = (c % W) * cell, py = ((c / W) | 0) * cell;
            x.beginPath();
            for (let a = 0; a < 4; a++) { x.moveTo(px, py); x.lineTo(px + cell * [1, 0.5, 1, 0.2][a], py + cell * [0.2, 1, 1, 0.9][a]); }
            for (const r of [0.35, 0.65, 0.95]) x.arc(px, py, cell * r, 0, Math.PI / 2);
            x.stroke();
        }
        // specials going off: a beam along the row or column, a ring for a jack-o'-lantern
        for (let n = this.beams.length - 1; n >= 0; n--) {
            const b = this.beams[n];
            b.t += dt;
            if (b.t > 0.35) { this.beams.splice(n, 1); continue; }
            const a = 1 - b.t / 0.35, bx = (b.i % W) * cell, by = ((b.i / W) | 0) * cell;
            x.fillStyle = `rgba(255,240,180,${a * 0.8})`;
            if (b.sp === SP.row) x.fillRect(0, by + cell * 0.3, w, cell * 0.4);
            else if (b.sp === SP.col) x.fillRect(bx + cell * 0.3, 0, cell * 0.4, h);
            else { x.strokeStyle = `rgba(255,160,60,${a})`; x.lineWidth = cell * 0.15; x.beginPath(); x.arc(bx + cell / 2, by + cell / 2, cell * (0.5 + (1 - a) * 1.2), 0, Math.PI * 2); x.stroke(); }
        }
        // the picked-up token and the keyboard cursor
        const box = (c, color, dash) => { x.setLineDash(dash ? [cell / 8, cell / 10] : []); x.strokeStyle = color; x.lineWidth = Math.max(2, cell / 14); x.strokeRect((c % W) * cell + 2, ((c / W) | 0) * cell + 2, cell - 4, cell - 4); x.setLineDash([]); };
        if (this.sel >= 0) box(this.sel, '#ffd36b', false);
        if (this.keyboard && this.cursor >= 0) box(this.cursor, 'rgba(255,255,255,0.8)', true);
        // sparks and score
        for (let n = this.parts.length - 1; n >= 0; n--) {
            const p = this.parts[n];
            p.t += dt;
            if (p.t > p.life) { this.parts.splice(n, 1); continue; }
            p.vy += 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            x.globalAlpha = 1 - p.t / p.life;
            x.fillStyle = p.color;
            const s = p.size * cell;
            x.fillRect(p.x * cell - s / 2, p.y * cell - s / 2, s, s);
        }
        x.globalAlpha = 1;
        x.textAlign = 'center';
        for (let n = this.texts.length - 1; n >= 0; n--) {
            const t = this.texts[n];
            t.t += dt;
            if (t.t > 0.9) { this.texts.splice(n, 1); continue; }
            x.globalAlpha = 1 - t.t / 0.9;
            x.font = `900 ${Math.round(cell * (t.big ? 0.55 : 0.42))}px Nunito, system-ui, sans-serif`;
            const ty = (t.y - t.t * 0.8) * cell;
            x.lineWidth = cell / 10; x.strokeStyle = '#2a1238'; x.strokeText(t.text, t.x * cell, ty);
            x.fillStyle = t.big ? '#ffe36a' : '#fff'; x.fillText(t.text, t.x * cell, ty);
        }
        x.globalAlpha = 1;
    }
}
