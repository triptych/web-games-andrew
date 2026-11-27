// The resonance board, drawn in Canvas 2D over the 3D scene. Reads G.m.board every frame, tweens each tile by its
// id toward its cell, bursts cleared tiles, and turns touches, clicks and keys into swap commands.
//
// Input: drag a tile toward a neighbour (the swap happens as the finger crosses a third of a cell, not on lift),
// or tap one tile and then a neighbour. Keyboard and gamepad: arrows move a cursor, Space picks a tile up, and an
// arrow with a tile held swaps it that way.

import { BOARD, KINDS, STATIC, SP } from '../config.js';

const COLS = BOARD.cols, ROWS = BOARD.rows;
export const TILE_COLOR = {
    power: ['#ff6b78', '#c4102c'], speed: ['#ffe680', '#d9a000'], thermal: ['#ffb066', '#e2500e'],
    cryo: ['#a8f6ff', '#1aa6d6'], volt: ['#d9b0ff', '#7a2fe0'], shield: ['#a8ffc8', '#18b65a'],
};
const INK = '#120c1c';

function shapePath(x, k, r) {
    x.beginPath();
    if (k === 'power') x.arc(0, 0, r, 0, Math.PI * 2);
    else if (k === 'speed') { x.moveTo(0, -r * 1.08); x.lineTo(r * 1.02, 0); x.lineTo(0, r * 1.08); x.lineTo(-r * 1.02, 0); x.closePath(); }
    else if (k === 'cryo') { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(Math.cos(a) * r * 1.04, Math.sin(a) * r * 1.04); } x.closePath(); }
    else if (k === 'volt') { for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }
    else if (k === 'shield') { x.moveTo(-r * 0.85, -r * 0.85); x.lineTo(r * 0.85, -r * 0.85); x.lineTo(r * 0.85, 0); x.quadraticCurveTo(r * 0.7, r * 0.75, 0, r * 1.05); x.quadraticCurveTo(-r * 0.7, r * 0.75, -r * 0.85, 0); x.closePath(); }
    else { const q = r * 0.92, c = r * 0.32; x.moveTo(-q + c, -q); x.lineTo(q - c, -q); x.quadraticCurveTo(q, -q, q, -q + c); x.lineTo(q, q - c); x.quadraticCurveTo(q, q, q - c, q); x.lineTo(-q + c, q); x.quadraticCurveTo(-q, q, -q, q - c); x.lineTo(-q, -q + c); x.quadraticCurveTo(-q, -q, -q + c, -q); x.closePath(); }
}

function glyph(x, k, r) {
    x.beginPath();
    if (k === 'power') { for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, R = i % 2 ? r * 0.22 : r * 0.58; x.lineTo(Math.cos(a) * R, Math.sin(a) * R); } x.closePath(); }
    else if (k === 'speed') { for (const dy of [-0.18, 0.2]) { x.moveTo(-r * 0.42, (dy + 0.2) * r); x.lineTo(0, (dy - 0.2) * r); x.lineTo(r * 0.42, (dy + 0.2) * r); } }
    else if (k === 'thermal') { x.moveTo(0, -r * 0.6); x.bezierCurveTo(r * 0.5, -r * 0.1, r * 0.48, r * 0.5, 0, r * 0.55); x.bezierCurveTo(-r * 0.48, r * 0.5, -r * 0.45, 0, -r * 0.12, -r * 0.18); x.quadraticCurveTo(-r * 0.05, r * 0.05, r * 0.02, -r * 0.05); x.quadraticCurveTo(r * 0.1, -r * 0.3, 0, -r * 0.6); x.closePath(); }
    else if (k === 'cryo') { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; const c = Math.cos(a) * r * 0.55, s = Math.sin(a) * r * 0.55; x.moveTo(-c, -s); x.lineTo(c, s); } }
    else if (k === 'volt') { x.moveTo(r * 0.12, -r * 0.62); x.lineTo(-r * 0.34, r * 0.06); x.lineTo(-r * 0.02, r * 0.06); x.lineTo(-r * 0.14, r * 0.62); x.lineTo(r * 0.36, -r * 0.08); x.lineTo(r * 0.04, -r * 0.08); x.closePath(); }
    else if (k === 'shield') { x.moveTo(0, -r * 0.42); x.lineTo(r * 0.36, -r * 0.28); x.lineTo(r * 0.3, r * 0.12); x.quadraticCurveTo(r * 0.2, r * 0.38, 0, r * 0.48); x.quadraticCurveTo(-r * 0.2, r * 0.38, -r * 0.3, r * 0.12); x.lineTo(-r * 0.36, -r * 0.28); x.closePath(); }
}
const STROKED = new Set(['speed', 'cryo']);

/** One tile drawn once per kind/special/size into a cache canvas. */
function drawTile(kind, sp, px) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px);
    const x = c.getContext('2d');
    const r = px * 0.4;
    x.translate(px / 2, px / 2);
    x.lineJoin = 'round';
    if (kind === STATIC) {
        shapePath(x, 'static', r);
        x.fillStyle = '#4a4458'; x.fill();
        x.save(); x.clip();
        for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.04})`; x.fillRect(((i * 37) % 100) / 100 * px - px / 2, ((i * 61) % 100) / 100 * px - px / 2, px * 0.12, px * 0.03); }
        x.restore();
        x.strokeStyle = INK; x.lineWidth = px * 0.06; x.stroke();
        x.strokeStyle = '#ff5a7a'; x.lineWidth = px * 0.07; x.lineCap = 'round';
        x.beginPath(); x.moveTo(-r * 0.4, -r * 0.4); x.lineTo(r * 0.4, r * 0.4); x.moveTo(r * 0.4, -r * 0.4); x.lineTo(-r * 0.4, r * 0.4); x.stroke();
        return c;
    }
    const k = KINDS[kind];
    const [hi, lo] = TILE_COLOR[k];
    shapePath(x, k, r);
    const g = x.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, hi); g.addColorStop(0.55, lo); g.addColorStop(1, lo);
    x.fillStyle = g; x.fill();
    // cel shadow: the lower-right third a flat darker tone
    x.save(); x.clip();
    x.fillStyle = 'rgba(20,0,40,0.22)';
    x.beginPath(); x.arc(r * 0.9, r * 0.9, r * 1.35, 0, Math.PI * 2); x.fill();
    // a hard white highlight, the 90s cel way
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.beginPath(); x.ellipse(-r * 0.38, -r * 0.48, r * 0.32, r * 0.13, -0.6, 0, Math.PI * 2); x.fill();
    x.restore();
    shapePath(x, k, r);
    x.strokeStyle = INK; x.lineWidth = px * 0.055; x.stroke();
    glyph(x, k, r);
    if (STROKED.has(k)) {
        x.lineCap = 'round';
        x.strokeStyle = INK; x.lineWidth = px * 0.13; x.stroke();
        x.strokeStyle = '#fff'; x.lineWidth = px * 0.065; x.stroke();
    } else {
        x.strokeStyle = INK; x.lineWidth = px * 0.06; x.stroke();
        x.fillStyle = '#fff'; x.fill();
    }
    if (sp) {
        x.save();
        x.strokeStyle = '#fff'; x.lineWidth = px * 0.05; x.shadowColor = '#fff'; x.shadowBlur = px * 0.15;
        if (sp === SP.lineH || sp === SP.cross) { x.beginPath(); x.moveTo(-r * 1.05, 0); x.lineTo(-r * 0.7, -r * 0.18); x.moveTo(-r * 1.05, 0); x.lineTo(-r * 0.7, r * 0.18); x.moveTo(r * 1.05, 0); x.lineTo(r * 0.7, -r * 0.18); x.moveTo(r * 1.05, 0); x.lineTo(r * 0.7, r * 0.18); x.stroke(); }
        if (sp === SP.lineV || sp === SP.cross) { x.beginPath(); x.moveTo(0, -r * 1.05); x.lineTo(-r * 0.18, -r * 0.7); x.moveTo(0, -r * 1.05); x.lineTo(r * 0.18, -r * 0.7); x.moveTo(0, r * 1.05); x.lineTo(-r * 0.18, r * 0.7); x.moveTo(0, r * 1.05); x.lineTo(r * 0.18, r * 0.7); x.stroke(); }
        if (sp === SP.nova) { x.beginPath(); x.arc(0, 0, r * 1.08, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0, 0, r * 0.86, 0, Math.PI * 2); x.setLineDash([px * 0.06, px * 0.06]); x.stroke(); }
        x.restore();
    }
    return c;
}

export class BoardView {
    constructor(canvas, { onSwap, onSelect } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onSwap = onSwap;
        this.onSelect = onSelect;
        this.sprites = new Map();       // tile id → { x, y, vy, pop }
        this.dying = [];                // { k, sp, x, y, t }
        this.sparks = [];
        this.flashes = [];              // row/col/nova flashes { kind, i, t }
        this.drops = new Map();         // spawned id → rows it fell from
        this.cache = new Map();
        this.sel = -1;
        this.cursor = 24;
        this.showCursor = false;
        this.rect = { x: 0, y: 0, size: 100 };
        this.drag = null;
        this.G = null;
        this.enabled = false;
        this.bindPointer();
    }

    /** Place the board (CSS px). */
    place(x, y, size) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const s = Math.round(size);
        this.rect = { x, y, size: s };
        Object.assign(this.canvas.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px' });
        if (this.canvas.width !== Math.round(s * dpr)) {
            this.canvas.width = this.canvas.height = Math.round(s * dpr);
            this.cache.clear();
        }
        this.dpr = dpr;
    }

    tileImg(k, sp) {
        const px = Math.round(this.canvas.width / COLS);
        const key = `${k}:${sp}:${px}`;
        if (!this.cache.has(key)) this.cache.set(key, drawTile(k, sp, px));
        return this.cache.get(key);
    }

    cellAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const cx = Math.floor((clientX - r.left) / (r.width / COLS)), cy = Math.floor((clientY - r.top) / (r.height / ROWS));
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return -1;
        return cy * COLS + cx;
    }

    bindPointer() {
        const cv = this.canvas;
        cv.addEventListener('pointerdown', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            const i = this.cellAt(e.clientX, e.clientY);
            if (i < 0) return;
            this.showCursor = false;
            this.drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
            try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        cv.addEventListener('pointermove', (e) => {
            const d = this.drag;
            if (!d || e.pointerId !== d.id || d.moved) return;
            const cell = cv.getBoundingClientRect().width / COLS;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) < cell * 0.33) return;
            d.moved = true;
            const r = Math.floor(d.i / COLS), c = d.i % COLS;
            let j = -1;
            if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && c < COLS - 1) j = d.i + 1; else if (dx < 0 && c > 0) j = d.i - 1; }
            else if (dy > 0 && r < ROWS - 1) j = d.i + COLS; else if (dy < 0 && r > 0) j = d.i - COLS;
            if (j >= 0) { this.sel = -1; this.onSwap?.(d.i, j); }
        });
        const up = (e) => {
            const d = this.drag;
            if (!d || e.pointerId !== d.id) return;
            this.drag = null;
            if (d.moved || e.type === 'pointercancel') return;
            this.tap(d.i);
        };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', up);
    }

    tap(i) {
        if (this.sel >= 0 && this.sel !== i && adjacent(this.sel, i)) { const a = this.sel; this.sel = -1; this.onSwap?.(a, i); return; }
        this.sel = this.sel === i ? -1 : i;
        this.onSelect?.(this.sel);
    }

    /** Keyboard / gamepad: move the cursor, or swap the held tile that way. */
    key(dir) {
        this.showCursor = true;
        const r = Math.floor(this.cursor / COLS), c = this.cursor % COLS;
        const [dr, dc] = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) return;
        const j = nr * COLS + nc;
        if (this.sel >= 0) { const a = this.sel; this.sel = -1; this.onSwap?.(a, j); this.cursor = j; return; }
        this.cursor = j;
    }
    pick() { this.showCursor = true; this.sel = this.sel === this.cursor ? -1 : this.cursor; }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'fall') for (const s of e.spawns) this.drops.set(s.id, s.drop);
            else if (e.type === 'clear') {
                for (const t of e.tiles) {
                    const sp = this.sprites.get(t.id);
                    const x = sp ? sp.x : t.i % COLS, y = sp ? sp.y : Math.floor(t.i / COLS);
                    if (!t.into) this.dying.push({ k: t.k, sp: t.sp, x, y, t: 0 });
                    this.sprites.delete(t.id);
                    if (t.k !== STATIC) for (let n = 0; n < 3; n++) this.sparks.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 5, t: 0, color: TILE_COLOR[KINDS[t.k]][0] });
                }
                for (const c of e.created) this.sprites.set(c.id, { x: c.i % COLS, y: Math.floor(c.i / COLS), vy: 0, pop: 1 });
                for (const b of e.blasts) this.flashes.push({ sp: b.sp, i: b.i, t: 0, color: TILE_COLOR[KINDS[b.k]]?.[0] || '#fff' });
            } else if (e.type === 'jam') {
                const sp = this.sprites.get(e.id);
                if (sp) sp.pop = 1;
            } else if (e.type === 'round' || e.type === 'brief') { this.sel = -1; }
        }
    }

    frame(G, dt, time) {
        this.G = G;
        const x = this.ctx, W = this.canvas.width, cs = W / COLS;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, W, W);
        const m = G.m;
        if (!m) return;
        const cells = m.board.cells;
        // the panel
        x.fillStyle = 'rgba(10,8,28,0.72)';
        x.fillRect(0, 0, W, W);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if ((r + c) % 2) { x.fillStyle = 'rgba(120,140,255,0.06)'; x.fillRect(c * cs, r * cs, cs, cs); }
        }
        // tiles follow their cells
        const live = new Set();
        for (let i = 0; i < cells.length; i++) {
            const t = cells[i];
            if (!t) continue;
            live.add(t.id);
            const tc = i % COLS, tr = Math.floor(i / COLS);
            let s = this.sprites.get(t.id);
            if (!s) {
                const drop = this.drops.get(t.id) ?? 0;
                s = { x: tc, y: tr - drop, vy: 0, pop: 0 };
                this.sprites.set(t.id, s);
                this.drops.delete(t.id);
            }
            const sp = 11 * dt;
            s.x += Math.max(-sp, Math.min(sp, tc - s.x));
            if (s.y < tr) { s.vy += 60 * dt; s.y = Math.min(tr, s.y + s.vy * dt); if (s.y >= tr) s.vy = 0; }
            else { s.y += Math.max(-sp, Math.min(sp, tr - s.y)); s.vy = 0; }
            s.pop = Math.max(0, s.pop - dt * 4);
            const img = this.tileImg(t.k, t.sp);
            const scale = 1 + s.pop * 0.35 + (t.sp ? Math.sin(time * 6 + t.id) * 0.04 : 0);
            const top = s.y * cs;
            if (top < -cs) continue;
            x.save();
            x.beginPath(); x.rect(0, 0, W, W); x.clip();
            x.translate(s.x * cs + cs / 2, top + cs / 2);
            x.scale(scale, scale);
            x.drawImage(img, -cs / 2, -cs / 2, cs, cs);
            x.restore();
        }
        for (const id of [...this.sprites.keys()]) if (!live.has(id)) this.sprites.delete(id);

        // bursting tiles
        for (let i = this.dying.length - 1; i >= 0; i--) {
            const d = this.dying[i];
            d.t += dt / 0.22;
            if (d.t >= 1) { this.dying.splice(i, 1); continue; }
            x.save();
            x.globalAlpha = 1 - d.t;
            x.translate(d.x * cs + cs / 2, d.y * cs + cs / 2);
            x.scale(1 + d.t * 0.6, 1 + d.t * 0.6);
            x.drawImage(this.tileImg(d.k, d.sp), -cs / 2, -cs / 2, cs, cs);
            x.restore();
        }
        // specials going off
        x.save();
        x.globalCompositeOperation = 'lighter';
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.t += dt / 0.35;
            if (f.t >= 1) { this.flashes.splice(i, 1); continue; }
            x.globalAlpha = 1 - f.t;
            x.fillStyle = f.color;
            const r = Math.floor(f.i / COLS), c = f.i % COLS;
            const th = cs * (0.5 - f.t * 0.3);
            if (f.sp === SP.lineH || f.sp === SP.cross) x.fillRect(0, r * cs + cs / 2 - th / 2, W, th);
            if (f.sp === SP.lineV || f.sp === SP.cross) x.fillRect(c * cs + cs / 2 - th / 2, 0, th, W);
            if (f.sp === SP.nova) { x.beginPath(); x.arc(c * cs + cs / 2, r * cs + cs / 2, W * f.t, 0, Math.PI * 2); x.lineWidth = cs * 0.3; x.strokeStyle = f.color; x.stroke(); }
        }
        // sparks
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.t += dt; p.vy += 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.t > 0.5) { this.sparks.splice(i, 1); continue; }
            x.globalAlpha = 1 - p.t / 0.5;
            x.fillStyle = p.color;
            x.beginPath(); x.arc(p.x * cs, p.y * cs, cs * 0.07, 0, Math.PI * 2); x.fill();
        }
        x.restore();
        x.globalAlpha = 1;

        // selection and cursor
        const box = (i, color, w) => {
            const r = Math.floor(i / COLS), c = i % COLS;
            x.strokeStyle = color; x.lineWidth = w;
            x.strokeRect(c * cs + w / 2 + 1, r * cs + w / 2 + 1, cs - w - 2, cs - w - 2);
        };
        if (this.sel >= 0) box(this.sel, `rgba(255,255,255,${0.7 + 0.3 * Math.sin(time * 10)})`, cs * 0.07);
        if (this.showCursor) box(this.cursor, '#ffd84a', cs * 0.05);
        // a board that can't take input yet is dimmed
        if (m.fireQueued || (m.phase !== 'round' && m.phase !== 'lance')) { x.fillStyle = 'rgba(5,4,15,0.45)'; x.fillRect(0, 0, W, W); }
        x.strokeStyle = 'rgba(150,180,255,0.5)'; x.lineWidth = 2 * this.dpr;
        x.strokeRect(1, 1, W - 2, W - 2);
    }
}

function adjacent(a, b) {
    const ra = Math.floor(a / COLS), ca = a % COLS, rb = Math.floor(b / COLS), cb = b % COLS;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}
