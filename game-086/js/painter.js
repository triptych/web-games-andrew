/**
 * painter.js — the zoomable pixel canvas: camera, drawing, and every way of touching it.
 *
 * Gestures
 *   one finger / left mouse   the current tool (brush strokes paint every pixel crossed;
 *                             pour and burst fire on a tap; the Move tool pans)
 *   two fingers               pinch to zoom, drag to pan. A stroke the first finger started
 *                             less than VIEW.pinchCancelMs ago is undone (it was the pinch).
 *   wheel / trackpad pinch    zoom around the cursor
 *   right or middle drag,
 *   or Space + drag           pan
 *
 * The painter knows nothing about rules: the controller hands it `look(i)` (how pixel i looks)
 * and receives cell coordinates back through the hooks.
 */
import { VIEW } from './config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAP_SLOP = 9;

export class Painter {
    constructor(canvas, hooks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hooks = hooks;
        this.pic = null;
        this.fills = [];
        this.labels = [];
        this.labelInk = [];
        this.marks = [];
        this.cam = { s: 10, ox: 0, oy: 0 };
        this.anim = null;
        this.tool = 'brush';
        this.pointers = new Map();
        this.mode = 'idle';
        this.stroke = null;
        this.spaceHeld = false;
        this.hover = -1;
        this.particles = [];
        this.glow = [];
        this.reveal = null;
        this.trail = false;
        this.showGrid = true;
        this.dirty = true;
        this.W = 1; this.H = 1; this.dpr = 1;
        this.minimap = null;
        this.bind();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.frame = this.frame.bind(this);
        requestAnimationFrame(this.frame);
    }

    /* ───────────── picture ───────────── */

    /** pic: { w, h, total, look(i) → [fill, label|null, labelInk, mark] } */
    setPicture(pic, keepCamera = false) {
        this.pic = pic;
        this.fills = new Array(pic.total);
        this.labels = new Array(pic.total);
        this.labelInk = new Array(pic.total);
        this.marks = new Uint8Array(pic.total);
        this.refresh();
        this.particles = [];
        this.reveal = null;
        this.glow = [];
        if (!keepCamera) this.fit(false);
    }

    refresh(indices) {
        if (!this.pic) return;
        const list = indices ?? Array.from({ length: this.pic.total }, (_, i) => i);
        for (const i of list) {
            const [fill, label, ink, mark] = this.pic.look(i);
            this.fills[i] = fill; this.labels[i] = label; this.labelInk[i] = ink; this.marks[i] = mark ? 1 : 0;
        }
        this.dirty = true;
    }

    /* ───────────── camera ───────────── */

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const first = this.W <= 1;
        // keep the same picture point in the middle of the stage
        const mid = this.pic && !first ? this.screenToCell(this.W / 2, this.H / 2) : null;
        const wasFit = this.pic && Math.abs(this.cam.s - this.fitScale()) < 0.01;
        this.W = W; this.H = H; this.dpr = dpr;
        this.canvas.width = Math.round(W * dpr);
        this.canvas.height = Math.round(H * dpr);
        this.canvas.style.width = `${W}px`;
        this.canvas.style.height = `${H}px`;
        if (this.pic) {
            if (first || wasFit || !mid) this.fit(false);
            else { this.cam.s = clamp(this.cam.s, this.minScale(), this.maxScale()); this.centerOn(mid.fx, mid.fy, this.cam.s, false); }
        }
        this.dirty = true;
    }

    fitScale() {
        if (!this.pic) return 1;
        return Math.min(this.W / this.pic.w, this.H / this.pic.h) * VIEW.fitMargin;
    }
    minScale() { return this.fitScale() * 0.75; }
    maxScale() { return Math.max(VIEW.maxCell, this.fitScale() * 1.5); }

    fit(animate = true) {
        const s = this.fitScale();
        this.goto(s, (this.W - this.pic.w * s) / 2, (this.H - this.pic.h * s) / 2, animate);
    }

    goto(s, ox, oy, animate) {
        const c = this.clampCam({ s, ox, oy });
        if (animate) this.anim = { from: { ...this.cam }, to: c, t: 0, dur: 0.38 };
        else { this.cam = c; this.anim = null; }
        this.dirty = true;
        this.hooks.onCamera?.();
    }

    /** Put picture point (fx, fy) (in pixel units) in the middle of the stage. */
    centerOn(fx, fy, s = this.cam.s, animate = true) {
        this.goto(s, this.W / 2 - fx * s, this.H / 2 - fy * s, animate);
    }

    clampCam({ s, ox, oy }) {
        s = clamp(s, this.minScale(), this.maxScale());
        const pw = this.pic.w * s, ph = this.pic.h * s;
        // the picture may never leave the middle of the stage
        if (pw <= this.W) ox = clamp(ox, Math.min(0, this.W - pw), Math.max(0, this.W - pw));
        else ox = clamp(ox, this.W / 2 - pw, this.W / 2);
        if (ph <= this.H) oy = clamp(oy, Math.min(0, this.H - ph), Math.max(0, this.H - ph));
        else oy = clamp(oy, this.H / 2 - ph, this.H / 2);
        return { s, ox, oy };
    }

    zoomAt(factor, sx, sy, animate = false) {
        const s = clamp(this.cam.s * factor, this.minScale(), this.maxScale());
        const k = s / this.cam.s;
        this.goto(s, sx - (sx - this.cam.ox) * k, sy - (sy - this.cam.oy) * k, animate);
    }

    zoomBy(factor) { this.zoomAt(factor, this.W / 2, this.H / 2, true); }

    panBy(dx, dy) { this.goto(this.cam.s, this.cam.ox + dx, this.cam.oy + dy, false); }

    /** Fly to pixel i at a zoom where its number is readable. */
    flyTo(i, minCell = 30) {
        const x = i % this.pic.w, y = Math.floor(i / this.pic.w);
        this.centerOn(x + 0.5, y + 0.5, Math.max(this.cam.s, Math.min(minCell, this.maxScale())), true);
    }

    screenToCell(sx, sy) {
        const fx = (sx - this.cam.ox) / this.cam.s, fy = (sy - this.cam.oy) / this.cam.s;
        return { fx, fy, x: Math.floor(fx), y: Math.floor(fy), inside: fx >= 0 && fy >= 0 && fx < this.pic.w && fy < this.pic.h };
    }

    cellToScreen(x, y) {
        return { sx: this.cam.ox + x * this.cam.s, sy: this.cam.oy + y * this.cam.s };
    }

    /** Fraction of the picture visible, as a rect in pixel units (for the minimap). */
    viewRect() {
        const a = this.screenToCell(0, 0), b = this.screenToCell(this.W, this.H);
        return { x: a.fx, y: a.fy, w: b.fx - a.fx, h: b.fy - a.fy };
    }

    /* ───────────── input ───────────── */

    bind() {
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => this.down(e));
        c.addEventListener('pointermove', (e) => this.move(e));
        c.addEventListener('pointerup', (e) => this.up(e, false));
        c.addEventListener('pointercancel', (e) => this.up(e, true));
        c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.hover = -1; this.dirty = true; } });
        c.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId)) this.up(e, true); });
        c.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        // Safari's own pinch gestures
        for (const t of ['gesturestart', 'gesturechange', 'gestureend']) c.addEventListener(t, (e) => e.preventDefault());
        // Cancel the touch events too. With only touch-action: none, Chromium still builds a fling out of
        // a one-finger drag and then swallows the next tap anywhere on the page (say, on a colour) to stop it.
        for (const t of ['touchstart', 'touchmove']) c.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    }

    local(e) {
        const r = this.canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    down(e) {
        if (!this.pic) return;
        e.preventDefault();
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
        const p = this.local(e);
        this.pointers.set(e.pointerId, { ...p, sx: p.x, sy: p.y, type: e.pointerType });
        this.hooks.onFirstTouch?.();

        if (this.pointers.size === 2) {
            if (this.mode === 'paint') {
                const young = performance.now() - this.stroke.t0 < VIEW.pinchCancelMs;
                if (young) this.hooks.onStrokeCancel?.(); else this.hooks.onStrokeEnd?.();
                this.stroke = null;
            }
            this.anim = null;
            this.startPinch();
            return;
        }
        if (this.pointers.size > 2 || this.mode !== 'idle') return;

        const panButton = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
        if (panButton || this.spaceHeld || this.tool === 'move') { this.mode = 'pan'; this.anim = null; return; }
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        if (this.tool === 'brush') {
            const cell = this.screenToCell(p.x, p.y);
            this.mode = 'paint';
            this.stroke = { id: e.pointerId, t0: performance.now(), last: null };
            this.hooks.onStrokeStart?.();
            if (cell.inside) { this.stroke.last = cell; this.hooks.onStrokeCell(cell.x, cell.y); }
        } else {
            this.mode = 'tap';
            this.tapId = e.pointerId;
        }
    }

    move(e) {
        if (!this.pic) return;
        const p = this.local(e);
        const ptr = this.pointers.get(e.pointerId);
        if (!ptr) {
            if (e.pointerType === 'mouse') {
                const cell = this.screenToCell(p.x, p.y);
                const h = cell.inside ? cell.y * this.pic.w + cell.x : -1;
                if (h !== this.hover) { this.hover = h; this.dirty = true; }
            }
            return;
        }
        const dx = p.x - ptr.x, dy = p.y - ptr.y;
        ptr.x = p.x; ptr.y = p.y;

        if (this.mode === 'pinch') { this.updatePinch(); return; }
        if (this.mode === 'pan') { this.panBy(dx, dy); return; }
        if (this.mode === 'tap' && e.pointerId === this.tapId) {
            if (Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > TAP_SLOP) this.mode = 'pan';
            return;
        }
        if (this.mode === 'paint' && this.stroke && e.pointerId === this.stroke.id) {
            const events = e.getCoalescedEvents?.() ?? [];
            const pts = events.length ? events.map((ev) => this.local(ev)) : [p];
            for (const q of pts) this.paintTo(q);
            if (e.pointerType === 'mouse') {
                const cell = this.screenToCell(p.x, p.y);
                this.hover = cell.inside ? cell.y * this.pic.w + cell.x : -1;
            }
        }
    }

    /** Paint every cell on the line from the last painted cell to the pointer. */
    paintTo(q) {
        const cell = this.screenToCell(q.x, q.y);
        const last = this.stroke.last;
        if (!cell.inside) { this.stroke.last = null; return; }
        if (last && last.x === cell.x && last.y === cell.y) return;
        if (!last) { this.stroke.last = cell; this.hooks.onStrokeCell(cell.x, cell.y); return; }
        let x0 = last.x, y0 = last.y;
        const x1 = cell.x, y1 = cell.y;
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (!(x0 === x1 && y0 === y1)) {
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
            this.hooks.onStrokeCell(x0, y0);
        }
        this.stroke.last = cell;
    }

    up(e, cancelled) {
        const ptr = this.pointers.get(e.pointerId);
        if (!ptr) return;
        this.pointers.delete(e.pointerId);
        if (this.mode === 'paint' && this.stroke && e.pointerId === this.stroke.id) {
            this.hooks.onStrokeEnd?.();
            this.stroke = null;
        } else if (this.mode === 'tap' && e.pointerId === this.tapId && !cancelled) {
            const cell = this.screenToCell(ptr.x, ptr.y);
            if (cell.inside) this.hooks.onTap?.(cell.x, cell.y);
        }
        // after a pinch (or any gesture), wait for every finger to lift before painting again
        this.mode = this.pointers.size === 0 ? 'idle' : 'wait';
    }

    startPinch() {
        const [a, b] = [...this.pointers.values()];
        this.mode = 'pinch';
        this.pinch = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }

    updatePinch() {
        const [a, b] = [...this.pointers.values()];
        if (!a || !b) return;
        const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const { s, ox, oy } = this.cam;
        const ns = clamp(s * (d / this.pinch.d), this.minScale(), this.maxScale());
        const k = ns / s;
        // zoom around the old midpoint, then follow the midpoint
        this.goto(ns, this.pinch.mx - (this.pinch.mx - ox) * k + (mx - this.pinch.mx), this.pinch.my - (this.pinch.my - oy) * k + (my - this.pinch.my), false);
        this.pinch = { d, mx, my };
    }

    wheel(e) {
        if (!this.pic) return;
        e.preventDefault();
        const p = this.local(e);
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        const factor = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0018));
        this.anim = null;
        this.zoomAt(factor, p.x, p.y, false);
    }

    /* ───────────── effects ───────────── */

    sparkle(i, color) {
        if (this.particles.length > 140) return;
        const x = i % this.pic.w, y = Math.floor(i / this.pic.w);
        const n = this.trail ? 3 : 2;
        for (let k = 0; k < n; k++) {
            this.particles.push({
                fx: x + 0.5, fy: y + 0.5, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, t: 0,
                life: 0.55 + Math.random() * 0.3, color: this.trail ? `hsl(${(performance.now() / 6 + k * 120) % 360} 95% 70%)` : color,
                size: 2 + Math.random() * 2.5,
            });
        }
    }

    playReveal() {
        const cx = this.pic.w / 2, cy = this.pic.h / 2, maxD = Math.hypot(cx, cy);
        this.reveal = { t: 0, cx, cy, maxD, dur: 1.4 };
    }

    /* ───────────── drawing ───────────── */

    frame(now) {
        requestAnimationFrame(this.frame);
        const dt = Math.min(0.05, (now - (this.lastNow ?? now)) / 1000);
        this.lastNow = now;
        if (!this.pic || !this.canvas.isConnected || this.canvas.offsetParent === null) return;
        let live = false;
        if (this.anim) {
            const a = this.anim;
            a.t += dt / a.dur;
            const k = a.t >= 1 ? 1 : 1 - (1 - a.t) ** 3;
            this.cam = { s: a.from.s + (a.to.s - a.from.s) * k, ox: a.from.ox + (a.to.ox - a.from.ox) * k, oy: a.from.oy + (a.to.oy - a.from.oy) * k };
            if (a.t >= 1) this.anim = null;
            this.hooks.onCamera?.();
            live = true;
        }
        if (this.particles.length) {
            for (const p of this.particles) { p.t += dt; p.fx += (p.vx * dt) / this.cam.s; p.fy += (p.vy * dt) / this.cam.s; p.vy += 60 * dt; }
            this.particles = this.particles.filter((p) => p.t < p.life);
            live = true;
        }
        if (this.reveal) { this.reveal.t += dt; if (this.reveal.t > this.reveal.dur + 0.4) this.reveal = null; live = true; }
        if (this.glow.length) live = true;
        if (!live && !this.dirty) return;
        this.dirty = false;
        this.draw(now / 1000);
        if (this.minimap) this.drawMinimap(now / 1000);
    }

    draw(time) {
        const { ctx, dpr, pic } = this;
        const { s, ox, oy } = this.cam;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const X = (i) => Math.round((ox + i * s) * dpr);
        const Y = (j) => Math.round((oy + j * s) * dpr);

        // shadow and frame
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 24 * dpr;
        ctx.shadowOffsetY = 6 * dpr;
        ctx.fillStyle = '#fff';
        ctx.fillRect(X(0), Y(0), X(pic.w) - X(0), Y(pic.h) - Y(0));
        ctx.restore();

        const x0 = clamp(Math.floor(-ox / s), 0, pic.w), x1 = clamp(Math.ceil((this.W - ox) / s), 0, pic.w);
        const y0 = clamp(Math.floor(-oy / s), 0, pic.h), y1 = clamp(Math.ceil((this.H - oy) / s), 0, pic.h);

        let lastFill = '';
        for (let y = y0; y < y1; y++) {
            const top = Y(y), bot = Y(y + 1);
            for (let x = x0; x < x1; x++) {
                const i = y * pic.w + x;
                const f = this.fills[i];
                if (f !== lastFill) { ctx.fillStyle = f; lastFill = f; }
                ctx.fillRect(X(x), top, X(x + 1) - X(x), bot - top);
            }
        }

        // reveal shimmer: a ring of light sweeping out from the middle
        if (this.reveal) {
            const r = this.reveal, front = (r.t / r.dur) * (r.maxD + 3);
            ctx.fillStyle = '#fff';
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const d = Math.hypot(x + 0.5 - r.cx, y + 0.5 - r.cy);
                const a = 1 - Math.abs(front - d) / 2.5;
                if (a <= 0) continue;
                ctx.globalAlpha = a * 0.75;
                ctx.fillRect(X(x), Y(y), X(x + 1) - X(x), Y(y + 1) - Y(y));
            }
            ctx.globalAlpha = 1;
        }

        // grid
        if (this.showGrid && s >= VIEW.gridAt) {
            ctx.strokeStyle = `rgba(40,34,70,${clamp((s - VIEW.gridAt) / 20, 0.08, 0.28)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = x0; x <= x1; x++) { const px = X(x) + 0.5; ctx.moveTo(px, Y(y0)); ctx.lineTo(px, Y(y1)); }
            for (let y = y0; y <= y1; y++) { const py = Y(y) + 0.5; ctx.moveTo(X(x0), py); ctx.lineTo(X(x1), py); }
            ctx.stroke();
        }

        // numbers, and the corner marks on mistakes
        if (s >= VIEW.numbersAt) {
            const fs = Math.round(s * dpr * 0.46);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const i = y * pic.w + x;
                if (this.marks[i]) {
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    const m = Math.max(3, s * dpr * 0.28);
                    ctx.beginPath();
                    ctx.moveTo(X(x + 1), Y(y));
                    ctx.lineTo(X(x + 1) - m, Y(y));
                    ctx.lineTo(X(x + 1), Y(y) + m);
                    ctx.fill();
                }
                const label = this.labels[i];
                if (!label) continue;
                ctx.font = `700 ${label.length > 1 ? Math.round(fs * 0.86) : fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
                ctx.fillStyle = this.labelInk[i];
                ctx.fillText(label, (X(x) + X(x + 1)) / 2, (Y(y) + Y(y + 1)) / 2 + dpr * 0.5);
            }
        }

        // hover outline (mouse)
        if (this.hover >= 0 && s >= 6) {
            const x = this.hover % pic.w, y = Math.floor(this.hover / pic.w);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = Math.max(1, dpr * 1.5);
            ctx.strokeRect(X(x) + 1, Y(y) + 1, X(x + 1) - X(x) - 2, Y(y + 1) - Y(y) - 2);
        }

        // Lantern Light: pulsing rings on the last few pixels of the chosen colour
        if (this.glow.length) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 5);
            ctx.lineWidth = 2 * dpr;
            for (const i of this.glow) {
                const x = i % pic.w, y = Math.floor(i / pic.w);
                const cx = (X(x) + X(x + 1)) / 2, cy = (Y(y) + Y(y + 1)) / 2;
                const r = Math.max(s * dpr * 0.75, 9 * dpr) + pulse * 4 * dpr;
                ctx.strokeStyle = `rgba(255,214,110,${0.55 + pulse * 0.45})`;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // sparkles
        for (const p of this.particles) {
            const a = 1 - p.t / p.life;
            const px = (ox + p.fx * s) * dpr, py = (oy + p.fy * s) * dpr, r = p.size * dpr * (0.6 + a * 0.6);
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(px, py - r * 1.6); ctx.lineTo(px + r * 0.4, py - r * 0.4); ctx.lineTo(px + r * 1.6, py);
            ctx.lineTo(px + r * 0.4, py + r * 0.4); ctx.lineTo(px, py + r * 1.6); ctx.lineTo(px - r * 0.4, py + r * 0.4);
            ctx.lineTo(px - r * 1.6, py); ctx.lineTo(px - r * 0.4, py - r * 0.4);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /** minimap: { canvas, base: ImageBitmap-ish canvas of the picture, dots: [i...] } */
    drawMinimap(time) {
        const mm = this.minimap, c = mm.canvas, ctx = c.getContext('2d');
        const W = c.width, H = c.height, pic = this.pic;
        const k = Math.min(W / pic.w, H / pic.h), ox = (W - pic.w * k) / 2, oy = (H - pic.h * k) / 2;
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        if (mm.base) ctx.drawImage(mm.base, ox, oy, pic.w * k, pic.h * k);
        if (mm.dots?.length) {
            ctx.fillStyle = `rgba(255,90,140,${0.65 + 0.35 * Math.sin(time * 6)})`;
            for (const i of mm.dots) ctx.fillRect(ox + (i % pic.w) * k - 1, oy + Math.floor(i / pic.w) * k - 1, k + 2, k + 2);
        }
        const v = this.viewRect();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + v.x * k, oy + v.y * k, v.w * k, v.h * k);
        mm.layout = { k, ox, oy };
    }
}
