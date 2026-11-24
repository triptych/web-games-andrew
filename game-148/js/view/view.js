// The Canvas 2D view: glass bell-flowers on curling stems, glowing wisps, and every flourish that answers a sim
// event (a pour's arc, a bloom, a creature popping out to sit on its flower, mist puffs, brambles letting go, the
// hint firefly). It reads G and the UI's selection; it never changes G.
//
// The sim applies a pour at once; the view keeps the poured wisps "in flight" and hides that many at the top of
// the target until they land. While anything is in flight `busy` is true and main holds the next command.

import { WISPS, CAP } from '../config.js';
import { isHidden, colorOf, topRun } from '../sim/rules.js';

const TAU = Math.PI * 2;
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };

// Glyphs are drawn in a unit box centred on 0,0, radius 1.
const GLYPHS = {
    heart(c) { c.beginPath(); c.moveTo(0, 0.75); c.bezierCurveTo(-1.1, -0.05, -0.55, -0.95, 0, -0.35); c.bezierCurveTo(0.55, -0.95, 1.1, -0.05, 0, 0.75); c.fill(); },
    sun(c) { c.beginPath(); c.arc(0, 0, 0.42, 0, TAU); c.fill(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.arc(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0.13, 0, TAU); c.fill(); } },
    leaf(c) { c.beginPath(); c.moveTo(-0.7, 0.7); c.quadraticCurveTo(-0.75, -0.65, 0.75, -0.75); c.quadraticCurveTo(0.65, 0.75, -0.7, 0.7); c.fill(); },
    cloud(c) { c.beginPath(); c.arc(-0.42, 0.15, 0.36, 0, TAU); c.arc(0.05, -0.12, 0.48, 0, TAU); c.arc(0.48, 0.18, 0.34, 0, TAU); c.rect(-0.42, 0.15, 0.9, 0.37); c.fill(); },
    moon(c) { c.beginPath(); c.arc(0, 0, 0.8, 0.6, TAU - 0.6, false); c.arc(0.38, -0.05, 0.62, TAU - 1.1, 1.1, true); c.fill(); },
    flame(c) { c.beginPath(); c.moveTo(0, -0.85); c.bezierCurveTo(0.65, -0.2, 0.75, 0.3, 0.45, 0.62); c.quadraticCurveTo(0, 0.95, -0.45, 0.62); c.bezierCurveTo(-0.75, 0.3, -0.45, -0.15, 0, -0.85); c.fill(); },
    wave(c) { c.lineWidth = 0.26; c.lineCap = 'round'; for (const y of [-0.3, 0.3]) { c.beginPath(); c.moveTo(-0.8, y); c.bezierCurveTo(-0.4, y - 0.4, -0.2, y + 0.4, 0.1, y); c.bezierCurveTo(0.4, y - 0.4, 0.6, y + 0.3, 0.85, y - 0.05); c.stroke(); } },
    star(c) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.38 : 0.88; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); },
    diamond(c) { c.beginPath(); c.moveTo(0, -0.85); c.lineTo(0.6, 0); c.lineTo(0, 0.85); c.lineTo(-0.6, 0); c.closePath(); c.fill(); },
};

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sprites = new Map();       // `${colour}|${d}|${glyph}` → canvas
        this.creatures = {};            // wisp id → Image
        for (const w of [...WISPS.map((x) => x.id), 'bramble']) {
            const im = new Image();
            im.src = `art/creature-${w}.webp`;
            this.creatures[w] = im;
        }
        this.glyphs = true;
        this.calm = false;              // reduce motion
        this.flights = [];              // wisps in the air
        this.parts = [];                // sparkles, petals, mist
        this.motes = [];
        this.fx = new Map();            // per tube: { shake, bloom, grow, unlock, perch }
        this.hint = null;               // { from, to, t }
        this.popups = [];               // floating text
        this.selected = -1;
        this.cursor = -1;               // keyboard cursor (shown only after a key press)
        this.layout = [];
        this.time = 0;
        this.winT = -1;
        this.tint = '#ffd6ec';
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        for (let i = 0; i < 46; i++) this.motes.push(this._mote(true));
    }

    get busy() { return this.flights.length > 0; }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return false;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.lastKey = '';              // force a new layout
        return true;
    }

    /** The board's free area (CSS px), set by the UI from the HUD and toolbar sizes. */
    setArea(top, bottom, right = 0) {
        if (top === this.areaTop && bottom === this.areaBottom && right === this.areaRight) return;
        this.areaTop = top; this.areaBottom = bottom; this.areaRight = right; this.lastKey = '';
    }

    // ------------------------------------------------------------------ layout
    /** Lay the blossoms out in 1–3 rows, choosing whichever gives the biggest blossoms. */
    doLayout(G) {
        const n = G.tubes.length;
        const key = n + '|' + this.w + '|' + this.h + '|' + G.tubes.map((t) => t.cap).join('') + '|' + this.areaTop + '|' + this.areaBottom + '|' + this.areaRight;
        if (key === this.lastKey && this.layout.length === n) return;
        this.lastKey = key;
        const top = this.areaTop ?? 80, bottom = this.h - (this.areaBottom ?? 110);
        const right = this.areaRight || 0;
        const W = this.w - 24 - right, H = Math.max(120, bottom - top);
        const midX = (this.w - right) / 2;
        let best = null;
        for (let rows = 1; rows <= 3; rows++) {
            const per = Math.ceil(n / rows);
            // a blossom is w wide and about w * (CAP * 0.86 + 1.9) tall with its stem and the lift space above
            const wByW = W / (per * 1.42);
            const wByH = H / (rows * (CAP * 0.86 + 2.05));
            const tw = Math.min(wByW, wByH, 74);
            if (!best || tw > best.tw + 0.5) best = { rows, per, tw };
        }
        const { rows, per, tw } = best;
        const d = tw * 0.8;                       // wisp diameter
        const cellH = tw * (CAP * 0.86 + 2.05);
        const gap = Math.min(tw * 0.42, (W - per * tw) / Math.max(1, per));
        this.d = d; this.tw = tw; this.per = per;
        this.layout = [];
        const totalH = rows * cellH;
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / per);
            const inRow = Math.min(per, n - r * per);
            const rowW = inRow * tw + (inRow - 1) * gap;
            const c = i - r * per;
            const cx = midX - rowW / 2 + tw / 2 + c * (tw + gap);
            const cell = top + (H - totalH) / 2 + r * cellH;
            const t = G.tubes[i];
            const ih = t.cap * d * 1.04 + tw * 0.16;
            const bottomY = cell + cellH - tw * 0.62;     // bottom of the glass; the stem is below
            this.layout.push({ cx, w: tw, ih, top: bottomY - ih, bottom: bottomY, cap: t.cap });
        }
    }

    /** Centre of the k-th wisp slot of tube i (CSS px). */
    slot(i, k) {
        const L = this.layout[i];
        return { x: L.cx, y: L.bottom - this.tw * 0.1 - this.d * 0.52 - k * this.d * 1.04 };
    }

    /** Which blossom a client point is over (generous: its whole column), or -1. */
    hitTube(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const x = clientX - r.left, y = clientY - r.top;
        let best = -1, bd = Infinity;
        this.layout.forEach((L, i) => {
            const dx = Math.abs(x - L.cx);
            if (dx > L.w * 0.5 + Math.max(10, this.tw * 0.25)) return;
            if (y < L.top - this.tw * 1.6 - this.d * 2 || y > L.bottom + this.tw * 0.9) return;
            if (dx < bd) { bd = dx; best = i; }
        });
        return best;
    }

    /** Client coordinates of a blossom's middle (for tests and the hint firefly). */
    tubeCenter(i) {
        const L = this.layout[i];
        if (!L) return null;
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + L.cx, y: r.top + (L.top + L.bottom) / 2 };
    }

    // ------------------------------------------------------------------ sprites
    wispSprite(colour, d, hidden = false) {
        const key = `${colour}|${Math.round(d)}|${this.glyphs}|${hidden}`;
        let c = this.sprites.get(key);
        if (c) return c;
        const s = Math.ceil(d * 1.9 * this.dpr);
        c = document.createElement('canvas');
        c.width = c.height = s;
        const x = c.getContext('2d');
        x.scale(this.dpr, this.dpr);
        const R = d / 2, m = d * 0.95;
        x.translate(m, m);
        if (hidden) {
            // a curl of mist hiding the wisp
            const g = x.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.2);
            g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(230,220,255,0)');
            x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 1.2, 0, TAU); x.fill();
            x.fillStyle = 'rgba(214,206,236,0.96)';
            for (const [px, py, pr] of [[-0.35, 0.18, 0.55], [0.32, 0.2, 0.55], [0, -0.22, 0.62], [0.05, 0.36, 0.5]]) {
                x.beginPath(); x.arc(px * R, py * R, pr * R, 0, TAU); x.fill();
            }
            x.fillStyle = 'rgba(255,255,255,0.7)';
            x.beginPath(); x.arc(-0.2 * R, -0.35 * R, 0.25 * R, 0, TAU); x.fill();
            x.fillStyle = 'rgba(120,96,170,0.75)';
            x.font = `700 ${Math.round(R * 1.05)}px Quicksand, system-ui, sans-serif`;
            x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillText('?', 0, R * 0.08);
        } else {
            const w = WISPS[colour];
            const glow = x.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.75);
            glow.addColorStop(0, rgba(w.glow, 0.75)); glow.addColorStop(1, rgba(w.glow, 0));
            x.fillStyle = glow; x.beginPath(); x.arc(0, 0, R * 1.75, 0, TAU); x.fill();
            const body = x.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R);
            body.addColorStop(0, '#ffffff');
            body.addColorStop(0.35, w.glow);
            body.addColorStop(0.75, w.hex);
            body.addColorStop(1, rgba(w.hex === '#f3ecff' ? '#b8a6d8' : w.hex, 1));
            x.fillStyle = body; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
            x.strokeStyle = 'rgba(255,255,255,0.65)'; x.lineWidth = Math.max(1, R * 0.08); x.stroke();
            if (this.glyphs) {
                x.save();
                x.scale(R * 0.46, R * 0.46);
                x.fillStyle = colour === 7 ? 'rgba(150,120,200,0.8)' : 'rgba(255,255,255,0.88)';
                x.strokeStyle = x.fillStyle;
                GLYPHS[w.glyph](x);
                x.restore();
            }
            x.fillStyle = 'rgba(255,255,255,0.85)';
            x.beginPath(); x.ellipse(-R * 0.34, -R * 0.42, R * 0.24, R * 0.14, -0.6, 0, TAU); x.fill();
        }
        c.half = m;
        this.sprites.set(key, c);
        return c;
    }

    drawWisp(colour, x, y, d, hidden = false, alpha = 1, scale = 1) {
        const sp = this.wispSprite(colour, d, hidden);
        const { ctx } = this;
        const s = sp.half * 2 * scale;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sp, x - sp.half * scale, y - sp.half * scale, s, s);
        ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ events
    tfx(i) { let f = this.fx.get(i); if (!f) { f = { shake: 0, bloom: 0, grow: 1, unlock: 0, perchT: 0 }; this.fx.set(i, f); } return f; }

    reset(G) {
        this.flights.length = 0; this.parts.length = 0; this.popups.length = 0;
        this.fx.clear(); this.hint = null; this.selected = -1; this.winT = -1;
        this.lastKey = '';
        this.doLayout(G);
        // blossoms already bloomed in a loaded game get their creature at once
        G.tubes.forEach((t, i) => { if (t.done) { const f = this.tfx(i); f.bloom = 1; f.perchT = 1; } });
    }

    onEvents(G, events) {
        this.doLayout(G);
        for (const e of events) {
            if (e.type === 'pour') this._pour(G, e);
            else if (e.type === 'nope' && e.to >= 0) { this.tfx(e.to).shake = 1; if (e.from >= 0) this.tfx(e.from).shake = 0.6; }
            else if (e.type === 'reveal') {
                const L = this.layout[e.tube];
                const k = G.tubes[e.tube].s.length - 1;
                const p = this.slot(e.tube, k);
                for (let j = 0; j < 14; j++) this._spark(p.x, p.y, 'mist', L);
            }
            else if (e.type === 'unlock') { const f = this.tfx(e.tube); f.unlock = 1; this._burst(e.tube, '#7fb069', 18, 'leaf'); }
            else if (e.type === 'sprout') { this.lastKey = ''; this.doLayout(G); this.tfx(e.tube).grow = 0; }
            else if (e.type === 'undo' || e.type === 'restart') {
                this.flights.length = 0;
                if (e.type === 'restart') { this.fx.clear(); this.lastKey = ''; this.doLayout(G); }
            }
            else if (e.type === 'hint') this.hint = e.from >= 0 ? { from: e.from, to: e.to, t: 0 } : null;
            else if (e.type === 'win') this.winT = 0;
        }
    }

    _pour(G, e) {
        const target = G.tubes[e.to], source = G.tubes[e.from];
        const srcLenBefore = source.s.length + e.n;
        const dstLenBefore = target.s.length - e.n;
        const lift = this.selected === e.from;
        for (let j = 0; j < e.n; j++) {
            const kFrom = srcLenBefore - 1 - j;
            const a = this.slot(e.from, kFrom);
            if (lift) a.y = this._liftY(e.from, srcLenBefore, kFrom);
            const b = this.slot(e.to, dstLenBefore + j);
            this.flights.push({ colour: e.colour, a, b, t: -j * 0.07, dur: this.calm ? 0.22 : 0.42, to: e.to, k: dstLenBefore + j, bloomAfter: target.done && j === e.n - 1 });
        }
        this.selected = -1;
    }

    _liftY(i, len, k) {
        const L = this.layout[i];
        const run = len - k;            // 1 for the top wisp
        return L.top - this.d * 0.55 - (run - 1) * this.d * 1.04 - this.tw * 0.25;
    }

    _land(f, G) {
        const p = f.b;
        for (let j = 0; j < 6; j++) this._spark(p.x, p.y, WISPS[f.colour].glow);
        if (f.bloomAfter) {
            const fx = this.tfx(f.to);
            fx.bloom = 0.001;
            fx.perchT = 0;
            this._burst(f.to, WISPS[f.colour].hex, 34, 'petal');
            const L = this.layout[f.to];
            this.popups.push({ text: WISPS[f.colour].creature + '!', x: L.cx, y: L.top - this.tw * 1.9, t: 0, colour: WISPS[f.colour].hex });
            this.onLand?.('bloom', f.colour);
        } else this.onLand?.('drop', f.colour);
    }

    _spark(x, y, colour, L) {
        const a = Math.random() * TAU, v = 20 + Math.random() * 70;
        if (colour === 'mist') {
            this.parts.push({ x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * 0.4 - 20, life: 0.9 + Math.random() * 0.5, t: 0, r: (L?.w ?? 30) * (0.15 + Math.random() * 0.2), kind: 'mist' });
            return;
        }
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.5, t: 0, r: 1.5 + Math.random() * 2.2, colour, kind: 'spark' });
    }

    _burst(i, colour, n, kind) {
        const L = this.layout[i];
        if (!L) return;
        const count = this.calm ? Math.ceil(n / 3) : n;
        for (let j = 0; j < count; j++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 60 + Math.random() * 160;
            this.parts.push({ x: L.cx, y: L.top, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 0.8, t: 0, r: 3 + Math.random() * 4, colour, kind, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8 });
        }
    }

    _mote(anywhere) {
        return { x: Math.random() * (this.w || 400), y: anywhere ? Math.random() * (this.h || 700) : (this.h || 700) + 10, vy: -(6 + Math.random() * 14), sway: Math.random() * TAU, r: 0.8 + Math.random() * 2.2, tw: Math.random() * TAU };
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, show = true) {
        this.time = time;
        this.resize();
        const { ctx } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.w, this.h);
        this._motes(dt);
        if (!show || !G) return;
        this.doLayout(G);
        // flights
        for (const f of this.flights) {
            f.t += dt;
            if (!f.landed && f.t >= f.dur) { f.landed = true; this._land(f, G); }
        }
        this.flights = this.flights.filter((f) => !f.landed);
        const inbound = new Map();
        for (const f of this.flights) inbound.set(f.to, (inbound.get(f.to) || 0) + 1);
        // the board
        G.tubes.forEach((t, i) => this._tube(G, t, i, dt, inbound.get(i) || 0));
        if (this.hint) this._hint(dt);
        for (const f of this.flights) this._flight(f);
        this._parts(dt);
        this._popups(dt);
        if (this.winT >= 0) this.winT += dt;
    }

    _motes(dt) {
        const { ctx } = this;
        const n = this.calm ? 14 : this.motes.length;
        for (let i = 0; i < n; i++) {
            const m = this.motes[i];
            m.y += m.vy * dt; m.sway += dt * 0.8; m.tw += dt * 2.2;
            const x = m.x + Math.sin(m.sway) * 14;
            if (m.y < -10) Object.assign(m, this._mote(false));
            const a = 0.35 + 0.35 * Math.sin(m.tw);
            ctx.fillStyle = `rgba(255,248,230,${a})`;
            ctx.beginPath(); ctx.arc(x, m.y, m.r, 0, TAU); ctx.fill();
            if (m.r > 2) { ctx.fillStyle = rgba(this.tint, a * 0.25); ctx.beginPath(); ctx.arc(x, m.y, m.r * 3, 0, TAU); ctx.fill(); }
        }
    }

    _tube(G, t, i, dt, inbound) {
        const { ctx, d } = this;
        const L = this.layout[i];
        const f = this.tfx(i);
        f.shake = Math.max(0, f.shake - dt * 3);
        f.grow = Math.min(1, f.grow + dt * 1.8);
        if (f.bloom > 0 && f.bloom < 1) f.bloom = Math.min(1, f.bloom + dt * 1.4);
        if (t.done && f.bloom === 0) { f.bloom = 1; f.perchT = 1; }
        if (f.bloom >= 1) f.perchT = Math.min(1, f.perchT + dt * 1.6);
        if (f.unlock > 0) f.unlock = Math.max(0, f.unlock - dt * 1.5);
        const sx = Math.sin(this.time * 40) * 6 * f.shake;
        const locked = t.lock > G.blooms;
        const sel = this.selected === i;
        ctx.save();
        ctx.translate(sx, 0);
        if (f.grow < 1) {
            ctx.translate(L.cx, L.bottom + L.w * 0.6);
            const g = ease(f.grow);
            ctx.scale(g, g);
            ctx.translate(-L.cx, -(L.bottom + L.w * 0.6));
        }
        const x0 = L.cx - L.w / 2, x1 = L.cx + L.w / 2, r = L.w / 2;
        // stem, leaves and a soft pool of light on the ground
        const ground = L.bottom + L.w * 0.58;
        const pool = ctx.createRadialGradient(L.cx, ground, 2, L.cx, ground, L.w * 0.9);
        pool.addColorStop(0, 'rgba(255,255,255,0.35)'); pool.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(L.cx, ground, L.w * 0.9, L.w * 0.22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#5f9a5c'; ctx.lineWidth = Math.max(2, L.w * 0.08); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(L.cx, L.bottom - 2); ctx.quadraticCurveTo(L.cx + L.w * 0.12, (L.bottom + ground) / 2, L.cx, ground); ctx.stroke();
        ctx.fillStyle = '#79b86f';
        for (const s of [-1, 1]) {
            ctx.beginPath();
            const lx = L.cx, ly = L.bottom + L.w * 0.32 + (s > 0 ? L.w * 0.08 : 0);
            ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + s * L.w * 0.45, ly - L.w * 0.3, lx + s * L.w * 0.55, ly + L.w * 0.02);
            ctx.quadraticCurveTo(lx + s * L.w * 0.3, ly + L.w * 0.12, lx, ly); ctx.fill();
        }
        // selection / cursor / hint glow behind the glass
        const hintOn = this.hint && (this.hint.from === i || this.hint.to === i);
        if (sel || hintOn || this.cursor === i) {
            const col = hintOn ? '255,214,102' : sel ? '255,255,255' : '190,170,255';
            const pulse = 0.55 + 0.3 * Math.sin(this.time * 5);
            const gl = ctx.createRadialGradient(L.cx, (L.top + L.bottom) / 2, L.w * 0.3, L.cx, (L.top + L.bottom) / 2, L.ih * 0.85);
            gl.addColorStop(0, `rgba(${col},${0.5 * pulse})`); gl.addColorStop(1, `rgba(${col},0)`);
            ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(L.cx, (L.top + L.bottom) / 2, L.w * 1.2, L.ih * 0.85, 0, 0, TAU); ctx.fill();
        }
        // the glass
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(x0 - L.w * 0.08, L.top);
            ctx.quadraticCurveTo(x0, L.top + L.w * 0.12, x0, L.top + L.w * 0.3);
            ctx.lineTo(x0, L.bottom - r);
            ctx.arc(L.cx, L.bottom - r, r, Math.PI, 0, true);
            ctx.lineTo(x1, L.top + L.w * 0.3);
            ctx.quadraticCurveTo(x1, L.top + L.w * 0.12, x1 + L.w * 0.08, L.top);
        };
        const cup = t.kind === 'cup';
        body();
        const gfill = ctx.createLinearGradient(0, L.top, 0, L.bottom);
        gfill.addColorStop(0, 'rgba(255,255,255,0.22)');
        gfill.addColorStop(1, cup ? 'rgba(110,70,40,0.42)' : 'rgba(62,36,104,0.45)');
        ctx.fillStyle = gfill; ctx.fill();
        if (t.done && f.bloom > 0) {
            const wc = WISPS[colorOf(t.s[0])];
            ctx.save(); ctx.clip();
            const lg = ctx.createLinearGradient(0, L.top, 0, L.bottom);
            lg.addColorStop(0, rgba(wc.glow, 0.15)); lg.addColorStop(1, rgba(wc.hex, 0.55 * ease(f.bloom)));
            ctx.fillStyle = lg; ctx.fillRect(x0 - 4, L.top, L.w + 8, L.ih + 4);
            ctx.restore();
        }
        ctx.lineWidth = Math.max(1.5, L.w * 0.045);
        ctx.strokeStyle = sel ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)';
        body(); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,40,110,0.45)';
        ctx.beginPath(); ctx.arc(L.cx, L.bottom - r, r + ctx.lineWidth * 1.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        // shine
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1.5, L.w * 0.07);
        ctx.beginPath(); ctx.moveTo(x0 + L.w * 0.2, L.top + L.w * 0.4); ctx.lineTo(x0 + L.w * 0.2, L.bottom - r * 0.9); ctx.stroke();
        // the wisps (minus any still flying in, minus the lifted run)
        let show = t.s.length - inbound;
        let liftN = 0;
        if (sel && t.s.length) liftN = Math.min(topRun(t.s), show);
        for (let k = 0; k < show; k++) {
            const ch = t.s[k];
            const p = this.slot(i, k);
            if (k >= show - liftN) {
                const bob = this.calm ? 0 : Math.sin(this.time * 4 + k) * 3;
                p.y = this._liftY(i, show, k) + bob;
            }
            const pulse = t.done ? 1 + 0.05 * Math.sin(this.time * 3 + k) : 1;
            this.drawWisp(colorOf(ch), p.x, p.y, d, isHidden(ch), 1, pulse);
        }
        // the rim: petals around a blossom (open when bloomed), an acorn cap around a cup
        if (cup) this._acornRim(L);
        else this._petals(L, t, f);
        if (locked || f.unlock > 0) this._brambles(L, t.lock - G.blooms, locked ? 1 : f.unlock);
        ctx.restore();
        if (t.done && f.perchT > 0) this._perch(L, t, f);
    }

    _petals(L, t, f) {
        const { ctx } = this;
        const open = t.done ? ease(f.bloom) : 0;
        const wc = t.done ? WISPS[colorOf(t.s[0])] : null;
        const n = 6;
        for (let j = 0; j < n; j++) {
            const side = j < n / 2 ? -1 : 1;
            const k = j % (n / 2);
            const base = side * (0.25 + k * 0.45);
            const ang = -Math.PI / 2 + base * (0.55 + open * 0.75);
            const len = L.w * (0.32 + open * 0.42) * (k === 1 ? 1.1 : 1);
            const px = L.cx + side * L.w * (0.38 + k * 0.08), py = L.top + L.w * 0.02;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(ang + Math.PI / 2);
            const g = ctx.createLinearGradient(0, 0, 0, -len);
            if (wc) { g.addColorStop(0, rgba(wc.hex, 0.95)); g.addColorStop(1, rgba(wc.glow, 0.9)); }
            else { g.addColorStop(0, 'rgba(255,235,246,0.95)'); g.addColorStop(1, rgba(this.tint, 0.85)); }
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-len * 0.42, -len * 0.3, -len * 0.28, -len * 0.95, 0, -len);
            ctx.bezierCurveTo(len * 0.28, -len * 0.95, len * 0.42, -len * 0.3, 0, 0);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
        }
        if (wc && open > 0) {
            const gl = ctx.createRadialGradient(L.cx, L.top, 2, L.cx, L.top, L.w * 1.3);
            gl.addColorStop(0, rgba(wc.glow, 0.55 * open)); gl.addColorStop(1, rgba(wc.glow, 0));
            ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(L.cx, L.top, L.w * 1.3, 0, TAU); ctx.fill();
        }
    }

    _acornRim(L) {
        const { ctx } = this;
        const y = L.top + L.w * 0.08;
        const g = ctx.createLinearGradient(0, y - L.w * 0.18, 0, y + L.w * 0.2);
        g.addColorStop(0, '#b98552'); g.addColorStop(1, '#7a4f2b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(L.cx, y, L.w * 0.66, L.w * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,230,190,0.35)';
        for (let j = -3; j <= 3; j++) { ctx.beginPath(); ctx.arc(L.cx + j * L.w * 0.16, y + (j % 2) * L.w * 0.05, L.w * 0.04, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(L.cx, y - L.w * 0.18); ctx.quadraticCurveTo(L.cx + L.w * 0.1, y - L.w * 0.4, L.cx + L.w * 0.22, y - L.w * 0.38); ctx.stroke();
    }

    _brambles(L, left, alpha) {
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        for (let v = 0; v < 3; v++) {
            const y0 = L.top + L.ih * (0.15 + v * 0.3);
            ctx.strokeStyle = v % 2 ? '#6e5a3a' : '#4f6b37';
            ctx.lineWidth = Math.max(2, L.w * 0.09);
            ctx.beginPath();
            const pts = [];
            for (let s = 0; s <= 10; s++) {
                const x = L.cx - L.w * 0.75 + (s / 10) * L.w * 1.5;
                const y = y0 + Math.sin(s * 1.3 + v * 2) * L.w * 0.18 + s * L.w * 0.03 * (v % 2 ? -1 : 1);
                pts.push([x, y]);
                if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle;
            for (let s = 1; s < 10; s += 2) {
                const [x, y] = pts[s];
                ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y - L.w * 0.16); ctx.lineTo(x + 3, y); ctx.fill();
            }
            ctx.fillStyle = '#fff6f8';
            const [rx, ry] = pts[3 + v * 2];
            for (let p = 0; p < 5; p++) { const a = p * TAU / 5; ctx.beginPath(); ctx.arc(rx + Math.cos(a) * L.w * 0.07, ry + Math.sin(a) * L.w * 0.07, L.w * 0.06, 0, TAU); ctx.fill(); }
            ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(rx, ry, L.w * 0.04, 0, TAU); ctx.fill();
        }
        if (left > 0) {
            // the badge: how many more blooms loosen it
            const bx = L.cx, by = L.top - L.w * 0.55, br = Math.max(13, L.w * 0.3);
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#4f6b37'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#ff8fbf';
            for (let p = 0; p < 5; p++) { const a = p * TAU / 5 - Math.PI / 2; ctx.beginPath(); ctx.arc(bx - br * 0.38 + Math.cos(a) * br * 0.2, by + Math.sin(a) * br * 0.2, br * 0.17, 0, TAU); ctx.fill(); }
            ctx.fillStyle = '#3d2c4f';
            ctx.font = `700 ${Math.round(br * 1.05)}px Quicksand, system-ui, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(left), bx + br * 0.33, by + 1);
        }
        ctx.restore();
    }

    /** The creature that woke from a bloomed blossom sits on top of it. */
    _perch(L, t, f) {
        const { ctx } = this;
        const wc = WISPS[colorOf(t.s[0])];
        const im = this.creatures[wc.id];
        const p = ease(f.perchT);
        const size = L.w * 1.55;
        const hop = this.winT >= 0 && !this.calm ? Math.abs(Math.sin(this.winT * 6 + L.cx)) * L.w * 0.35 : 0;
        const bob = this.calm ? 0 : Math.sin(this.time * 2 + L.cx * 0.05) * 2;
        const y = L.top - size * 0.78 - (1 - p) * L.w * 1.5 - hop + bob;
        ctx.globalAlpha = Math.min(1, p * 1.5);
        if (im.complete && im.naturalWidth) {
            const s = size / Math.max(im.naturalWidth, im.naturalHeight);
            const w = im.naturalWidth * s, h = im.naturalHeight * s;
            ctx.drawImage(im, L.cx - w / 2, y + (size - h), w, h);
        } else {
            this.drawWisp(colorOf(t.s[0]), L.cx, y + size / 2, this.d * 1.3);
        }
        ctx.globalAlpha = 1;
    }

    _flight(f) {
        if (f.t < 0) return;
        const u = ease(f.t / f.dur);
        const top = Math.min(f.a.y, f.b.y) - this.tw * 1.4;
        const x = (1 - u) * (1 - u) * f.a.x + 2 * (1 - u) * u * ((f.a.x + f.b.x) / 2) + u * u * f.b.x;
        const y = (1 - u) * (1 - u) * f.a.y + 2 * (1 - u) * u * top + u * u * f.b.y;
        if (!this.calm && Math.random() < 0.7) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.4, t: 0, r: 1.5 + Math.random() * 1.5, colour: WISPS[f.colour].glow, kind: 'spark' });
        this.drawWisp(f.colour, x, y, this.d);
    }

    _hint(dt) {
        const h = this.hint;
        h.t += dt;
        if (h.t > 3.2 || !this.layout[h.from] || !this.layout[h.to]) { this.hint = null; return; }
        const a = this.slot(h.from, 0), b = this.slot(h.to, 0);
        a.y = this.layout[h.from].top - this.tw * 0.4; b.y = this.layout[h.to].top - this.tw * 0.4;
        const u = (h.t % 1.1) / 1.1;
        const x = lerp(a.x, b.x, ease(u)), y = lerp(a.y, b.y, ease(u)) - Math.sin(u * Math.PI) * this.tw * 1.2;
        const { ctx } = this;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 18);
        g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.3, 'rgba(255,210,90,0.7)'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.ellipse(x - 4, y - 5, 5, 2.5, -0.5, 0, TAU); ctx.ellipse(x + 4, y - 5, 5, 2.5, 0.5, 0, TAU); ctx.fill();
        if (!this.calm && Math.random() < 0.5) this.parts.push({ x, y, vx: 0, vy: 10, life: 0.6, t: 0, r: 1.6, colour: '#ffe28a', kind: 'spark' });
    }

    _parts(dt) {
        const { ctx } = this;
        for (const p of this.parts) {
            p.t += dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.kind === 'petal' || p.kind === 'leaf') { p.vy += 120 * dt; p.vx *= 0.98; p.rot += p.vr * dt; }
            else if (p.kind === 'mist') { p.r += dt * 10; p.vx *= 0.96; p.vy *= 0.96; }
            else { p.vx *= 0.94; p.vy *= 0.94; }
            const a = Math.max(0, 1 - p.t / p.life);
            if (p.kind === 'mist') {
                ctx.fillStyle = `rgba(236,230,252,${0.55 * a})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
            } else if (p.kind === 'petal' || p.kind === 'leaf') {
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                ctx.globalAlpha = a;
                ctx.fillStyle = p.colour;
                ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.7, 0, 0, TAU); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath(); ctx.ellipse(-p.r * 0.3, -p.r * 0.15, p.r * 0.5, p.r * 0.22, 0, 0, TAU); ctx.fill();
                ctx.restore(); ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = rgba(p.colour, a);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill();
                ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.35, 0, TAU); ctx.fill();
            }
        }
        this.parts = this.parts.filter((p) => p.t < p.life && p.y < this.h + 40);
        if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    }

    _popups(dt) {
        const { ctx } = this;
        for (const p of this.popups) {
            p.t += dt;
            const a = p.t < 0.2 ? p.t / 0.2 : Math.max(0, 1 - (p.t - 1.2) / 0.6);
            const y = Math.max((this.areaTop ?? 80) + 14, p.y - ease(p.t / 1.8) * 24);
            const size = Math.max(16, Math.min(26, this.tw * 0.42));
            ctx.font = `700 ${size}px Quicksand, system-ui, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const tw = ctx.measureText(p.text).width;
            const x = Math.max(tw / 2 + 8, Math.min(this.w - tw / 2 - 8, p.x));
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            const pad = 10;
            ctx.beginPath(); ctx.roundRect(x - tw / 2 - pad, y - size * 0.75, tw + pad * 2, size * 1.5, size * 0.75); ctx.fill();
            ctx.fillStyle = '#4a2d6b';
            ctx.fillText(p.text, x, y + 1);
            ctx.globalAlpha = 1;
        }
        this.popups = this.popups.filter((p) => p.t < 1.8);
    }

    /** A creature portrait drawn for the UI (journal, win sheet) uses the same images. */
    creatureSrc(id) { return `art/creature-${id}.webp`; }
}

export { WISPS };
