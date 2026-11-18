// The ward-lock on screen: concentric stone rings of runes over the painted seal. It reads the ward object the sim
// keeps in G.ward and sends turns through onTurn(ring, dir); it never changes the ward itself.
//
// Drag a ring round to turn it (each eighth of a turn is one move), tap the right or left half of a ring to turn it
// clockwise or back, or use the buttons and keys main.js wires up. Coupled rings turn with it, which is the puzzle.
// When the ward opens, the rings blaze in the colour that is returning and the whole lock fades into the picture.

import { RUNES, RUNE_HUE, HUES } from '../sim/data/chapters.js';

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;

// Each rune is a few strokes in a -1..1 box (y down): lines as point lists, arcs as { a: [cx, cy, r, from, to] }.
export const GLYPHS = {
    kindling: [[[0, -1], [0.55, 0.15], [0.3, 0.75], [0, 1], [-0.3, 0.75], [-0.55, 0.15], [0, -1]], [[0, 0.2], [0.18, 0.55], [0, 0.75], [-0.18, 0.55], [0, 0.2]]],
    making: [[[-0.8, -0.55], [0.8, -0.55]], [[-0.45, -0.55], [-0.2, -0.1], [0.2, -0.1], [0.45, -0.55]], [[0, -0.1], [0, 0.7]], [[-0.55, 0.95], [0, 0.7], [0.55, 0.95]]],
    seeing: [[[-1, 0], [-0.5, -0.5], [0.5, -0.5], [1, 0], [0.5, 0.5], [-0.5, 0.5], [-1, 0]], { a: [0, 0, 0.28, 0, TAU] }, [[0, -0.95], [0, -0.7]], [[-0.6, -0.85], [-0.45, -0.65]], [[0.6, -0.85], [0.45, -0.65]]],
    growing: [[[0, 1], [0, -1]], [[0, 0.3], [-0.65, -0.35]], [[0, 0.3], [0.65, -0.35]], [[0, -0.25], [-0.4, -0.75]], [[0, -0.25], [0.4, -0.75]], [[-0.5, 1], [0.5, 1]]],
    passage: [[[-0.65, 1], [-0.65, -0.25], { q: [0, -1.05, 0.65, -0.25] }, [0.65, 1]], [[-1, 0.35], [-0.6, 0.15], [-0.2, 0.35], [0.2, 0.15], [0.6, 0.35], [1, 0.15]], [[-1, 0.75], [-0.6, 0.55], [-0.2, 0.75], [0.2, 0.55], [0.6, 0.75], [1, 0.55]]],
    binding: [[[0, -1], [0.87, 0.5], [-0.87, 0.5], [0, -1]], [[0, 1], [-0.87, -0.5], [0.87, -0.5], [0, 1]], { a: [0, 0, 0.22, 0, TAU] }],
    dreaming: [{ a: [0, 0, 0.9, 0.9, TAU - 0.9] }, { a: [0.42, 0, 0.62, 2.0, TAU - 2.0], rev: true }, [[0.55, -0.55], [0.62, -0.38], [0.8, -0.32], [0.62, -0.26], [0.55, -0.1], [0.48, -0.26], [0.3, -0.32], [0.48, -0.38], [0.55, -0.55]]],
};

/** Stroke a rune at (x, y), size s (half-width), in the current strokeStyle. */
export function drawRune(c, id, x, y, s) {
    const g = GLYPHS[id];
    if (!g) return;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.lineWidth = Math.max(1.2, s * 0.13) / s;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const part of g) {
        c.beginPath();
        if (part.a) {
            const [cx, cy, r, a0, a1] = part.a;
            c.arc(cx, cy, r, a0, a1, !!part.rev);
        } else {
            let first = true;
            for (const p of part) {
                if (p.q) { c.quadraticCurveTo(p.q[0], p.q[1], p.q[2], p.q[3]); continue; }
                if (first) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
                first = false;
            }
        }
        c.stroke();
    }
    c.restore();
}

export class WardView {
    constructor(canvas, { onTurn, reduceMotion = false }) {
        this.canvas = canvas;
        this.c = canvas.getContext('2d');
        this.onTurn = onTurn;
        this.reduce = reduceMotion;
        this.w = null;
        this.sel = 0;
        this.disp = [];          // the angle each ring is drawn at, in slots, easing towards w.off
        this.drag = null;
        this.hintT = 0; this.hintRing = -1; this.hintDir = 0;
        this.assist = false;     // story mode: the next move is always shown
        this.open = 0;           // 0..1 the opening blaze; >1 fading out
        this.openHue = 0;
        this.hues = [0, 0, 0, 0, 0, 0, 0];
        this.t = 0;
        this.W = 2; this.H = 2;
        canvas.addEventListener('pointerdown', (e) => this._down(e));
        canvas.addEventListener('pointermove', (e) => this._move(e));
        canvas.addEventListener('pointerup', (e) => this._up(e));
        canvas.addEventListener('pointercancel', () => { this.drag = null; });
    }

    resize(cssW, cssH) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.cssW = cssW; this.cssH = cssH;
        this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
        this.W = this.canvas.width = Math.round(cssW * dpr);
        this.H = this.canvas.height = Math.round(cssH * dpr);
    }

    /** Begin showing a ward (the object in G.ward; it is drawn live, and still drawn after it opens). */
    show(w) {
        this.w = w;
        this.sel = 0;
        this.disp = w.off.slice();
        this.open = 0;
        this.drag = null;
        this.hintRing = -1;
    }
    hide() { this.w = null; this.drag = null; }
    get active() { return !!this.w && this.open === 0; }

    select(d) { if (this.w) this.sel = mod(this.sel + d, this.w.rings.length); }
    hint(h) { this.hintRing = h.ring; this.hintDir = h.dir; this.hintT = 2.2; this.sel = h.ring; }
    opened(hue) { this.open = 0.001; this.openHue = hue; this.drag = null; }

    /** Geometry in canvas px: centre, outer radius and ring width. A tall screen moves the lock up, clear of the buttons. */
    geom() {
        const W = this.W, H = this.H, K = this.w.rings.length;
        const tall = W / H < 0.9;
        const top = (tall ? 132 : 104) * this.dpr, bottom = (tall ? 150 : 92) * this.dpr;
        const avail = Math.max(120, H - top - bottom);
        const R = Math.min(W * 0.46, avail * 0.5);
        const cx = W / 2, cy = top + avail / 2;
        const hub = R * 0.3;
        return { cx, cy, R, hub, rw: (R - hub) / K, K };
    }

    _ringAt(px, py) {
        const g = this.geom();
        const d = Math.hypot(px - g.cx, py - g.cy);
        if (d > g.R * 1.08 || d < g.hub * 0.6) return -1;
        return Math.max(0, Math.min(g.K - 1, Math.floor((g.R - d) / g.rw)));
    }

    _pt(e) {
        const r = this.canvas.getBoundingClientRect();
        return [(e.clientX - r.left) * (this.W / r.width), (e.clientY - r.top) * (this.H / r.height)];
    }

    _down(e) {
        if (!this.active) return;
        const [x, y] = this._pt(e);
        const ring = this._ringAt(x, y);
        if (ring < 0) return;
        const g = this.geom();
        this.sel = ring;
        this.drag = { ring, id: e.pointerId, a: Math.atan2(y - g.cy, x - g.cx), acc: 0, moved: 0, turned: false, x, y };
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
        e.preventDefault();
    }

    _move(e) {
        const D = this.drag;
        if (!D || e.pointerId !== D.id || !this.active) return;
        const [x, y] = this._pt(e);
        const g = this.geom();
        const a = Math.atan2(y - g.cy, x - g.cx);
        let da = a - D.a;
        if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
        D.a = a;
        D.moved += Math.hypot(x - D.x, y - D.y); D.x = x; D.y = y;
        const step = TAU / this.w.slots;
        D.acc += da;
        while (Math.abs(D.acc) > step * 0.5 && this.active) {
            const dir = D.acc > 0 ? 1 : -1;
            D.acc -= dir * step;
            D.turned = true;
            this.onTurn(D.ring, dir);
        }
    }

    _up(e) {
        const D = this.drag;
        if (!D || e.pointerId !== D.id) return;
        this.drag = null;
        if (!D.turned && D.moved < 10 * this.dpr && this.active) {
            const g = this.geom();
            this.onTurn(D.ring, D.x >= g.cx ? 1 : -1);
        }
    }

    // ------------------------------------------------------------ drawing
    frame(dt, hues) {
        this.t += dt;
        this.hues = hues;
        const c = this.c;
        c.clearRect(0, 0, this.W, this.H);
        const w = this.w;
        if (!w) return;
        if (this.open > 0) this.open += dt / 2.0;
        if (this.open > 1.6) { this.hide(); return; }
        if (this.hintT > 0) this.hintT -= dt;
        const g = this.geom();
        const n = w.slots, K = g.K;
        // the drawn angle eases to the true offset the short way round (plus the live drag)
        const k = this.reduce ? 1 : 1 - Math.exp(-dt * 14);
        for (let r = 0; r < K; r++) {
            let d = mod(w.off[r] - this.disp[r] + n / 2, n) - n / 2;
            this.disp[r] += d * k;
        }
        const fadeOut = this.open > 1 ? Math.max(0, 1 - (this.open - 1) / 0.6) : 1;
        const blaze = Math.min(1, this.open * 1.6);
        const hueCol = HUES[this.openHue].css;
        c.save();
        c.globalAlpha = fadeOut;
        c.translate(g.cx, g.cy);
        if (this.open > 1) { const s = 1 + (this.open - 1) * 0.25; c.scale(s, s); }
        // a dark well behind the stone
        const well = c.createRadialGradient(0, 0, g.hub * 0.5, 0, 0, g.R * 1.25);
        well.addColorStop(0, 'rgba(6,6,10,0.88)'); well.addColorStop(0.8, 'rgba(6,6,10,0.7)'); well.addColorStop(1, 'rgba(6,6,10,0)');
        c.fillStyle = well;
        c.beginPath(); c.arc(0, 0, g.R * 1.25, 0, TAU); c.fill();
        for (let r = 0; r < K; r++) {
            const ro = g.R - r * g.rw, ri = ro - g.rw;
            const sel = r === this.sel && this.open === 0;
            const lit = this._matched(r);
            // the stone annulus
            const st = c.createRadialGradient(0, 0, ri, 0, 0, ro);
            st.addColorStop(0, sel ? '#3a3a44' : '#2a2a31'); st.addColorStop(0.5, sel ? '#4a4a55' : '#36363e'); st.addColorStop(1, sel ? '#33333c' : '#25252b');
            c.fillStyle = st;
            c.beginPath(); c.arc(0, 0, ro - 1.5 * this.dpr, 0, TAU); c.arc(0, 0, ri + 1.5 * this.dpr, 0, TAU, true); c.fill();
            c.lineWidth = 1.5 * this.dpr;
            c.strokeStyle = sel ? 'rgba(232, 205, 140, 0.85)' : 'rgba(200, 200, 215, 0.25)';
            c.beginPath(); c.arc(0, 0, ro - 1.5 * this.dpr, 0, TAU); c.stroke();
            if (blaze > 0) {
                c.strokeStyle = hueCol; c.globalAlpha = fadeOut * blaze * (0.6 + 0.4 * Math.sin(this.t * 6 + r));
                c.lineWidth = 3 * this.dpr;
                c.beginPath(); c.arc(0, 0, ro - 1.5 * this.dpr, 0, TAU); c.stroke();
                c.globalAlpha = fadeOut;
            }
            // tick marks between slots
            const ang = (this.disp[r] / n) * TAU;
            c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.2 * this.dpr;
            for (let s = 0; s < n; s++) {
                const a = -Math.PI / 2 + ang + (s + 0.5) * TAU / n;
                c.beginPath(); c.moveTo(Math.cos(a) * (ri + 3 * this.dpr), Math.sin(a) * (ri + 3 * this.dpr)); c.lineTo(Math.cos(a) * (ro - 3 * this.dpr), Math.sin(a) * (ro - 3 * this.dpr)); c.stroke();
            }
            // the runes
            const mid = (ro + ri) / 2;
            const rs = Math.min(g.rw * 0.3, mid * Math.sin(Math.PI / n) * 0.62);
            for (let s = 0; s < n; s++) {
                const a = -Math.PI / 2 + ang + s * TAU / n;
                const x = Math.cos(a) * mid, y = Math.sin(a) * mid;
                const rune = w.rings[r][s];
                if (!rune) {
                    c.fillStyle = 'rgba(160,160,175,0.35)';
                    c.beginPath(); c.arc(x, y, rs * 0.14, 0, TAU); c.fill();
                    continue;
                }
                const atTop = mod(s + Math.round(this.disp[r]), n) === 0;
                c.strokeStyle = blaze > 0 ? hueCol : this._runeCol(rune, atTop && lit);
                if (atTop && lit || blaze > 0) { c.shadowColor = blaze > 0 ? hueCol : '#f0d58c'; c.shadowBlur = 12 * this.dpr; }
                drawRune(c, rune, x, y, rs);
                c.shadowBlur = 0;
            }
        }
        // the window at the top of each ring, where its key rune must sit
        for (let r = 0; r < K; r++) {
            const ro = g.R - r * g.rw, ri = ro - g.rw;
            const half = Math.PI / n * 0.92;
            const lit = this._matched(r);
            c.lineWidth = (lit ? 2.6 : 1.6) * this.dpr;
            c.strokeStyle = lit ? 'rgba(240, 213, 140, 0.95)' : 'rgba(220, 222, 235, 0.55)';
            c.beginPath();
            c.arc(0, 0, ro - 3 * this.dpr, -Math.PI / 2 - half, -Math.PI / 2 + half);
            c.arc(0, 0, ri + 3 * this.dpr, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
            c.closePath(); c.stroke();
        }
        // the pointer above the outer ring
        c.fillStyle = 'rgba(240, 213, 140, 0.9)';
        c.beginPath(); c.moveTo(0, -g.R - 2 * this.dpr); c.lineTo(-8 * this.dpr, -g.R - 16 * this.dpr); c.lineTo(8 * this.dpr, -g.R - 16 * this.dpr); c.closePath(); c.fill();
        // the hub: the keyhole of the geas sigil
        const hub = c.createRadialGradient(0, 0, 0, 0, 0, g.hub);
        hub.addColorStop(0, blaze > 0 ? hueCol : '#2c2c34'); hub.addColorStop(1, '#141418');
        c.fillStyle = hub;
        c.beginPath(); c.arc(0, 0, g.hub - 2 * this.dpr, 0, TAU); c.fill();
        c.fillStyle = blaze > 0 ? '#fff6dc' : '#07070a';
        c.beginPath(); c.arc(0, -g.hub * 0.18, g.hub * 0.22, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-g.hub * 0.12, -g.hub * 0.1); c.lineTo(g.hub * 0.12, -g.hub * 0.1); c.lineTo(g.hub * 0.2, g.hub * 0.45); c.lineTo(-g.hub * 0.2, g.hub * 0.45); c.closePath(); c.fill();
        // the hint: an arc arrow round the ring to turn
        const hr = this.assist && this.open === 0 ? this.assistHint : (this.hintT > 0 ? { ring: this.hintRing, dir: this.hintDir } : null);
        if (hr && hr.ring >= 0) {
            const ro = g.R - hr.ring * g.rw, rad = ro - g.rw / 2;
            const pulse = 0.55 + 0.45 * Math.sin(this.t * 7);
            c.strokeStyle = `rgba(240, 213, 140, ${pulse})`;
            c.lineWidth = 4 * this.dpr;
            const a0 = -Math.PI / 2 + 0.35, a1 = a0 + 1.0;
            const [s0, s1] = hr.dir > 0 ? [a0, a1] : [-Math.PI - a0, -Math.PI - a1];
            c.beginPath(); c.arc(0, 0, rad, s0, s1, hr.dir < 0); c.stroke();
            const ex = Math.cos(s1) * rad, ey = Math.sin(s1) * rad;
            const tx = -Math.sin(s1) * hr.dir, ty = Math.cos(s1) * hr.dir;
            c.fillStyle = c.strokeStyle;
            c.beginPath();
            c.moveTo(ex + tx * 12 * this.dpr, ey + ty * 12 * this.dpr);
            c.lineTo(ex - ty * 9 * this.dpr, ey + tx * 9 * this.dpr);
            c.lineTo(ex + ty * 9 * this.dpr, ey - tx * 9 * this.dpr);
            c.closePath(); c.fill();
        }
        if (blaze > 0 && !this.reduce) {
            const bl = c.createRadialGradient(0, 0, 0, 0, 0, g.R * 1.6);
            bl.addColorStop(0, hueCol); bl.addColorStop(1, 'rgba(0,0,0,0)');
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = fadeOut * 0.5 * Math.sin(Math.min(1, this.open) * Math.PI);
            c.fillStyle = bl;
            c.beginPath(); c.arc(0, 0, g.R * 1.6, 0, TAU); c.fill();
            c.globalCompositeOperation = 'source-over';
        }
        c.restore();
    }

    _matched(r) {
        const w = this.w;
        return w.rings[r][mod(-w.off[r], w.slots)] === w.key[r];
    }

    _runeCol(rune, lit) {
        if (lit) return '#f6e2a6';
        const h = RUNE_HUE[rune];
        return this.hues[h] ? HUES[h].css : 'rgba(214, 216, 228, 0.9)';
    }
}

export { RUNES };
