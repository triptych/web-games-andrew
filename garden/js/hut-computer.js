// The old computer on the loft desk: a beige box with a monochrome amber
// monitor and a Hercules graphics card, 720 by 348 pixels, one bit each.
// Click it and you sit down in front of it: it boots HUT-DOS and runs
// ISLAND.EXE, a wireframe survey of the island drawn from the garden's real
// terrain, with the landmarks marked and the Hut flashing YOU ARE HERE.
// Turn it with the arrows or by dragging, tilt it, zoom it, let it spin, flip
// to a top-down contour map, and Tab through the sites.
//
// The same survey turns slowly on the little screen in the loft (see
// hut-loft.js), drawn smaller into a texture.

const HW = 720, HH = 348;          // Hercules graphics: 720 x 348, one bit per pixel
const AMBER = [255, 176, 0];

// a 5x7 font, drawn double height on the 348-line screen like the MDA/Hercules text
const FONT = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
    '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [0, 1, 2, 4, 8, 16, 0], '\\': [0, 16, 8, 4, 2, 1, 0],
    '>': [8, 4, 2, 1, 2, 4, 8], '<': [2, 4, 8, 16, 8, 4, 2], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
    '=': [0, 0, 31, 0, 31, 0, 0], _: [0, 0, 0, 0, 0, 0, 31], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
    "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 0, 0, 0, 0, 0], '#': [10, 10, 31, 10, 31, 10, 10], '%': [24, 25, 2, 4, 8, 19, 3],
    '*': [0, 4, 21, 14, 21, 4, 0], '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14], '°': [12, 18, 18, 12, 0, 0, 0],
    '█': [31, 31, 31, 31, 31, 31, 31], '←': [0, 4, 8, 31, 8, 4, 0], '→': [0, 4, 2, 31, 2, 4, 0], '↑': [4, 14, 21, 4, 4, 4, 4],
    '↓': [4, 4, 4, 4, 21, 14, 4], '·': [0, 0, 0, 12, 12, 0, 0], '|': [4, 4, 4, 4, 4, 4, 4], '&': [12, 18, 20, 8, 21, 18, 13],
};

/** Write text in the bitmap font. (x, y) is the top left; each glyph cell is 6 wide and `sy * 7` tall. */
export function bitText(ctx, s, x, y, sy = 2, sx = 1) {
    const up = String(s).toUpperCase();
    for (let i = 0; i < up.length; i++) {
        const g = FONT[up[i]] ?? FONT['?'];
        for (let r = 0; r < 7; r++) {
            const row = g[r];
            if (!row) continue;
            for (let c = 0; c < 5; c++) if (row & (16 >> c)) ctx.fillRect(x + (i * 6 + c) * sx, y + r * sy, sx, sy);
        }
    }
}

/** Snap a canvas to one bit: lit pixels amber, the rest black. */
function oneBit(ctx, w, h, thresh = 70) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const on = d[i] > thresh;
        d[i] = on ? AMBER[0] : 0;
        d[i + 1] = on ? AMBER[1] : 0;
        d[i + 2] = on ? AMBER[2] : 0;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
}

/** The island as a height grid, ready to draw as a wireframe. */
export class IslandSurvey {
    /** @param {object} o { heightAt(x, z), landmarks: [{ name, x, z }], islandR, home: { x, z } } */
    constructor({ heightAt, landmarks = [], islandR = 150, home = null }) {
        this.R = islandR * 1.08;
        const G = (this.G = 60);
        this.h = new Float32Array((G + 1) * (G + 1));
        let max = 1;
        for (let j = 0; j <= G; j++) {
            for (let i = 0; i <= G; i++) {
                const x = -this.R + (i / G) * this.R * 2, z = -this.R + (j / G) * this.R * 2;
                let y = 0;
                try {
                    y = heightAt(x, z);
                } catch {
                    y = 0;
                }
                if (!Number.isFinite(y)) y = 0;
                this.h[j * (G + 1) + i] = y;
                max = Math.max(max, y);
            }
        }
        this.maxH = max;
        // relief: the tallest hill stands about a sixth of the island's width
        this.ex = Math.max(1, (this.R * 0.17) / max);
        this.sites = landmarks.map((l) => ({ name: l.name.replace(/^The /, ''), x: l.x, z: l.z, y: Math.max(0, this.heightAt(l.x, l.z)) }));
        this.home = home ? { x: home.x, z: home.z, y: Math.max(0, this.heightAt(home.x, home.z)) } : null;
    }

    heightAt(x, z) {
        const G = this.G, fx = ((x + this.R) / (this.R * 2)) * G, fz = ((z + this.R) / (this.R * 2)) * G;
        const i = Math.max(0, Math.min(G - 1, Math.floor(fx))), j = Math.max(0, Math.min(G - 1, Math.floor(fz)));
        const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
        const H = (a, b) => this.h[b * (G + 1) + a];
        return (H(i, j) * (1 - u) + H(i + 1, j) * u) * (1 - v) + (H(i, j + 1) * (1 - u) + H(i + 1, j + 1) * u) * v;
    }

    /**
     * Draw the survey into a 2D context, amber on black (snap it to one bit afterwards).
     * view: { yaw, pitch, zoom, tx, tz, mode: '3d' | 'map', labels, sel, blink, step }
     */
    draw(ctx, w, h, view) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgb(255,176,0)';
        ctx.fillStyle = 'rgb(255,176,0)';
        if (view.mode === 'map') return this._map(ctx, w, h, view);
        const G = this.G, R = this.R, step = view.step || 1;
        const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
        const dist = R * 2.3 / view.zoom, f = Math.min(w * 0.9, h * 1.9) * 0.9;
        const ox = w / 2, oy = h * 0.56;
        // the pixels are 1.55 times taller than wide on a 4:3 tube, so squash y to keep shapes true
        const ay = 1 / 1.55 * (h / (w * 348 / 720));
        const P = (x, y, z) => {
            const dx = x - view.tx, dz = z - view.tz;
            const rx = dx * cy - dz * sy, rz = dx * sy + dz * cy;
            const ry = y * cp - rz * sp, rz2 = y * sp + rz * cp;
            const d = dist + rz2;
            if (d < 1) return null;
            return [ox + (f * rx) / d, oy - ((f * ry) / d) * ay, d];
        };
        const ex = this.ex;
        const H = (i, j) => Math.max(0, this.h[j * (G + 1) + i]) * ex;
        const X = (i) => -R + (i / G) * R * 2;
        // the sea: a ring of dots at sea level
        for (let j = 0; j <= G; j += 2 * step) {
            for (let i = 0; i <= G; i += 2 * step) {
                if (this.h[j * (G + 1) + i] > 0.05) continue;
                const p = P(X(i), 0, X(j));
                if (p) ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1);
            }
        }
        // the land: quads drawn far to near, each filled black and outlined, so hills hide what is behind them
        const quads = [];
        for (let j = 0; j < G; j += step) {
            for (let i = 0; i < G; i += step) {
                const i1 = Math.min(G, i + step), j1 = Math.min(G, j + step);
                const k = [this.h[j * (G + 1) + i], this.h[j * (G + 1) + i1], this.h[j1 * (G + 1) + i1], this.h[j1 * (G + 1) + i]];
                if (Math.max(...k) <= 0.05) continue;
                const a = P(X(i), H(i, j), X(j)), b = P(X(i1), H(i1, j), X(j)), c = P(X(i1), H(i1, j1), X(j1)), d = P(X(i), H(i, j1), X(j1));
                if (!a || !b || !c || !d) continue;
                quads.push({ a, b, c, d, z: a[2] + b[2] + c[2] + d[2] });
            }
        }
        quads.sort((p, q) => q.z - p.z);
        ctx.lineWidth = 1;
        for (const q of quads) {
            ctx.beginPath();
            ctx.moveTo(q.a[0], q.a[1]);
            ctx.lineTo(q.b[0], q.b[1]);
            ctx.lineTo(q.c[0], q.c[1]);
            ctx.lineTo(q.d[0], q.d[1]);
            ctx.closePath();
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.stroke();
        }
        ctx.fillStyle = 'rgb(255,176,0)';
        // the sites: a mast up from the ground with a flag
        const small = w < 500;
        if (view.labels !== false) {
            // nearest first, the chosen site before all; a label that would cover another is left off
            const boxes = [];
            const order = this.sites.map((s, i) => ({ s, i, g: P(s.x, s.y * ex, s.z), t: P(s.x, s.y * ex + R * 0.07, s.z) })).filter((o) => o.g && o.t);
            order.sort((a, b) => (b.i === view.sel) - (a.i === view.sel) || a.g[2] - b.g[2]);
            for (const { s, i, g, t } of order) {
                const sel = view.sel === i;
                if (sel && !view.blink) continue;
                const tx = Math.round(t[0]), ty = Math.round(t[1]);
                ctx.fillRect(tx, ty, 1, Math.max(1, Math.round(g[1] - t[1])));
                ctx.fillRect(tx - 1, ty - 1, 3, 3);
                if (small && !sel) continue;
                const label = sel ? `[${s.name}]` : s.name;
                const box = [tx + 3, ty - 9, label.length * (small ? 6 : 12) + 2, small ? 9 : 16];
                if (!sel && boxes.some((b) => box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3])) continue;
                boxes.push(box);
                ctx.fillStyle = '#000';
                ctx.fillRect(...box);
                ctx.fillStyle = 'rgb(255,176,0)';
                bitText(ctx, label, tx + 4, ty - 8, small ? 1 : 2, small ? 1 : 2);
            }
        }
        // the hut: YOU ARE HERE, blinking
        if (this.home && view.blink) {
            const g = P(this.home.x, this.home.y * ex, this.home.z);
            if (g) {
                const x = Math.round(g[0]), y = Math.round(g[1]);
                ctx.fillRect(x - 6, y, 13, 1);
                ctx.fillRect(x, y - 6, 1, 13);
                ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
                if (!small) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(x + 7, y + 2, 146, 16);
                    ctx.fillStyle = 'rgb(255,176,0)';
                    bitText(ctx, 'YOU ARE HERE', x + 8, y + 3, 2, 2);
                }
            }
        }
    }

    /** Top-down: contour lines every few metres, the coast doubled, sites as boxes. */
    _map(ctx, w, h, view) {
        const G = this.G, R = this.R;
        const s = (Math.min(w, h * 1.55) / (R * 2)) * 0.92 * view.zoom;
        const ay = 1 / 1.55 * (h / (w * 348 / 720));
        const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
        const M = (x, z) => {
            const dx = x - view.tx, dz = z - view.tz;
            return [w / 2 + (dx * cyw - dz * syw) * s, h / 2 + (dx * syw + dz * cyw) * s * ay];
        };
        const X = (i) => -R + (i / G) * R * 2;
        const levels = [];
        for (let k = 0; k < 9; k++) levels.push(0.3 + (this.maxH * k) / 9);
        ctx.lineWidth = 1;
        for (const lv of levels) {
            ctx.beginPath();
            for (let j = 0; j < G; j++) {
                for (let i = 0; i < G; i++) {
                    // marching squares, one segment per crossing pair
                    const v = [this.h[j * (G + 1) + i], this.h[j * (G + 1) + i + 1], this.h[(j + 1) * (G + 1) + i + 1], this.h[(j + 1) * (G + 1) + i]];
                    const c = [[X(i), X(j)], [X(i + 1), X(j)], [X(i + 1), X(j + 1)], [X(i), X(j + 1)]];
                    const pts = [];
                    for (let e = 0; e < 4; e++) {
                        const a = v[e], b = v[(e + 1) % 4];
                        if ((a > lv) !== (b > lv)) {
                            const t = (lv - a) / (b - a);
                            const p = c[e], q = c[(e + 1) % 4];
                            pts.push(M(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t));
                        }
                    }
                    for (let k = 0; k + 1 < pts.length; k += 2) {
                        ctx.moveTo(pts[k][0], pts[k][1]);
                        ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
                    }
                }
            }
            ctx.stroke();
        }
        // a frame of tick marks: north is up when unturned
        for (let k = -10; k <= 10; k++) {
            const [x] = M(k * R / 10, 0);
            if (x > 2 && x < w - 2) ctx.fillRect(Math.round(x), 0, 1, k % 5 ? 3 : 6);
        }
        if (view.labels !== false) {
            const boxes = [];
            const order = this.sites.map((st, i) => ({ st, i })).sort((a, b) => (b.i === view.sel) - (a.i === view.sel));
            for (const { st, i } of order) {
                const [x, y] = M(st.x, st.z), sel = view.sel === i;
                if (sel && !view.blink) continue;
                ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
                const label = sel ? `[${st.name}]` : st.name;
                const box = [Math.round(x) + 5, Math.round(y) - 5, label.length * 12 + 2, 16];
                if (!sel && boxes.some((b) => box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3])) continue;
                boxes.push(box);
                ctx.fillStyle = '#000';
                ctx.fillRect(...box);
                ctx.fillStyle = 'rgb(255,176,0)';
                bitText(ctx, label, box[0] + 1, box[1] + 1, 2, 2);
            }
        }
        if (this.home && view.blink) {
            const [x, y] = M(this.home.x, this.home.z);
            ctx.strokeRect(Math.round(x) - 4.5, Math.round(y) - 4.5, 9, 9);
            ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        }
    }
}

const BOOT = [
    'HERCULES GRAPHICS CARD PLUS   720 X 348',
    'MEMORY TEST 640K OK',
    '',
    'HUT-DOS VERSION 3.30',
    '(C) THE HUT, ALL RIGHTS RESERVED',
    '',
    'C:\\>CD \\SURVEY',
    'C:\\SURVEY>ISLAND /HGC',
];

/** The full-screen monitor you sit down in front of. */
export class HerculesTerminal {
    /** @param {object} o { survey: IslandSurvey, onClose, beep(kind) } */
    constructor({ survey, onClose, beep }) {
        this.survey = survey;
        this.onCloseCb = onClose;
        this.beep = beep;
        this.open = false;
        this.booted = false;
        this.view = { yaw: 0.6, pitch: 0.62, zoom: 1.25, tx: 0, tz: 0, mode: '3d', labels: true, sel: -1, blink: true };
        this.target = { tx: 0, tz: 0, zoom: 1.25 };
        this.spin = true;
        this.keys = new Set();
        this._build();
        this._key = (e) => this._onKey(e);
        addEventListener('keydown', this._key, true);
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), true);
        addEventListener('blur', () => this.keys.clear());
    }

    _build() {
        const el = document.createElement('section');
        el.id = 'herc';
        el.className = 'herc-overlay';
        el.hidden = true;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'The old computer: a wireframe survey of the island');
        el.innerHTML = `
            <div class="herc-monitor">
                <div class="herc-bezel">
                    <div class="herc-glass"><canvas width="${HW}" height="${HH}"></canvas><div class="herc-scan"></div></div>
                </div>
                <div class="herc-chin"><span class="herc-brand">HUT/PC</span><span class="herc-led"></span><span class="herc-model">MONOCHROME · HGC</span></div>
            </div>
            <div class="herc-keys" role="group" aria-label="Computer keys">
                <button data-k="arrowleft" aria-label="Turn left">←</button><button data-k="arrowright" aria-label="Turn right">→</button>
                <button data-k="arrowup" aria-label="Tilt up">↑</button><button data-k="arrowdown" aria-label="Tilt down">↓</button>
                <button data-k="+" aria-label="Zoom in">+</button><button data-k="-" aria-label="Zoom out">−</button>
                <button data-tap=" ">SPIN</button><button data-tap="v">VIEW</button><button data-tap="tab">SITE</button><button data-tap="l">LABELS</button>
                <button data-tap="escape" class="herc-off">OFF</button>
            </div>`;
        document.body.appendChild(el);
        this.el = el;
        this.canvas = el.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        // held buttons act like held keys; the rest are taps
        el.querySelectorAll('[data-k]').forEach((b) => {
            const k = b.dataset.k;
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.keys.add(k);
            });
            for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => this.keys.delete(k));
        });
        el.querySelectorAll('[data-tap]').forEach((b) => b.addEventListener('click', () => this._tap(b.dataset.tap)));
        // drag the picture to turn and tilt it; the wheel zooms
        let drag = null;
        this.canvas.addEventListener('pointerdown', (e) => {
            drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
            this.canvas.setPointerCapture?.(e.pointerId);
            this.spin = false;
            if (!this.booted) this._finishBoot();
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!drag || drag.id !== e.pointerId) return;
            this.view.yaw += (e.clientX - drag.x) * 0.008;
            this.view.pitch = Math.max(0.12, Math.min(1.5, this.view.pitch + (e.clientY - drag.y) * 0.006));
            drag.x = e.clientX;
            drag.y = e.clientY;
        });
        const end = () => (drag = null);
        this.canvas.addEventListener('pointerup', end);
        this.canvas.addEventListener('pointercancel', end);
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.target.zoom = Math.max(0.6, Math.min(5, this.target.zoom * Math.exp(-e.deltaY * 0.0012)));
        }, { passive: false });
        el.addEventListener('pointerdown', (e) => {
            if (e.target === el) this.close();
        });
    }

    show() {
        if (this.open) return;
        this.open = true;
        this.el.hidden = false;
        this.t0 = performance.now();
        this.last = this.t0;
        this.lines = this.booted ? ['C:\\SURVEY>ISLAND /HGC'] : [];
        this.beep?.('on');
        this._loop();
    }

    close() {
        if (!this.open) return;
        this.open = false;
        this.el.hidden = true;
        this.keys.clear();
        cancelAnimationFrame(this.raf);
        this.beep?.('off');
        this.onCloseCb?.();
    }

    _finishBoot() {
        this.booted = true;
    }

    _tap(k) {
        if (!this.booted) {
            this._finishBoot();
            if (k !== 'escape') return;
        }
        const v = this.view;
        if (k === 'escape') this.close();
        else if (k === ' ') this.spin = !this.spin;
        else if (k === 'v') {
            v.mode = v.mode === '3d' ? 'map' : '3d';
            this.beep?.('key');
        } else if (k === 'l') v.labels = !v.labels;
        else if (k === 'tab' || k === 'shift+tab') {
            const n = this.survey.sites.length;
            if (!n) return;
            v.sel = k === 'tab' ? (v.sel + 1) % (n + 1) : (v.sel + n + 1) % (n + 1);
            if (v.sel === n) v.sel = -1;
            const s = this.survey.sites[v.sel];
            this.target.tx = s ? s.x : 0;
            this.target.tz = s ? s.z : 0;
            this.target.zoom = s ? 2.4 : 1.25;
            this.beep?.('key');
        } else if (k === 'h') {
            const h = this.survey.home;
            if (h) {
                v.sel = -1;
                this.target.tx = h.x;
                this.target.tz = h.z;
                this.target.zoom = 2.6;
            }
        }
    }

    _onKey(e) {
        if (!this.open) return;
        const k = e.key.toLowerCase();
        e.stopImmediatePropagation();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', '_', 'a', 'd', 'w', 's', 'q', 'e'].includes(k)) {
            e.preventDefault();
            if (!this.booted) this._finishBoot();
            this.keys.add(k);
            if (['arrowleft', 'arrowright', 'a', 'd', 'q', 'e'].includes(k)) this.spin = false;
            return;
        }
        if (k === 'tab') {
            e.preventDefault();
            return this._tap(e.shiftKey ? 'shift+tab' : 'tab');
        }
        if (k === 'escape' || k === ' ' || k === 'v' || k === 'l' || k === 'h' || k === 'm') {
            e.preventDefault();
            if (!e.repeat) this._tap(k === 'm' ? 'v' : k);
            return;
        }
        if (!this.booted && !e.repeat) this._finishBoot();
    }

    _loop() {
        if (!this.open) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this._step(dt, now);
        this._render(now);
        this.raf = requestAnimationFrame(() => this._loop());
    }

    _step(dt) {
        const v = this.view, k = this.keys, T = this.target;
        if (k.has('arrowleft') || k.has('a') || k.has('q')) v.yaw -= dt * 1.4;
        if (k.has('arrowright') || k.has('d') || k.has('e')) v.yaw += dt * 1.4;
        if (k.has('arrowup') || k.has('w')) v.pitch = Math.min(1.5, v.pitch + dt * 0.9);
        if (k.has('arrowdown') || k.has('s')) v.pitch = Math.max(0.12, v.pitch - dt * 0.9);
        if (k.has('+') || k.has('=')) T.zoom = Math.min(5, T.zoom * Math.exp(dt * 1.6));
        if (k.has('-') || k.has('_')) T.zoom = Math.max(0.6, T.zoom * Math.exp(-dt * 1.6));
        if (this.spin) v.yaw += dt * 0.22;
        const a = 1 - Math.exp(-dt * 4);
        v.tx += (T.tx - v.tx) * a;
        v.tz += (T.tz - v.tz) * a;
        v.zoom += (T.zoom - v.zoom) * a;
    }

    _render(now) {
        const x = this.ctx, age = (now - this.t0) / 1000;
        x.fillStyle = '#000';
        x.fillRect(0, 0, HW, HH);
        x.fillStyle = 'rgb(255,176,0)';
        if (!this.booted) {
            // the boot: a line every quarter second, then the program starts
            const n = Math.floor(age / 0.28);
            BOOT.slice(0, n).forEach((l, i) => bitText(x, l, 12, 12 + i * 18, 2, 2));
            if (Math.floor(age * 3) % 2 === 0) x.fillRect(12 + (n < BOOT.length ? 0 : BOOT[BOOT.length - 1].length * 12 + 6), 12 + (n < BOOT.length ? n : BOOT.length - 1) * 18, 10, 14);
            if (n >= BOOT.length + 2) this._finishBoot();
            oneBit(x, HW, HH);
            return;
        }
        const v = this.view;
        v.blink = Math.floor(now / 420) % 2 === 0;
        x.save();
        x.beginPath();
        x.rect(0, 20, HW, HH - 42);
        x.clip();
        this.survey.draw(x, HW, HH, v);
        x.restore();
        // the frame: a title bar, a status line and the keys along the bottom
        x.fillStyle = 'rgb(255,176,0)';
        x.fillRect(0, 0, HW, 17);
        x.fillStyle = '#000';
        bitText(x, 'ISLAND SURVEY 1.0', 6, 2, 2, 2);
        const deg = ((Math.round((v.yaw * 180) / Math.PI) % 360) + 360) % 360;
        const head = `${v.mode === '3d' ? 'WIRE' : 'MAP'} HDG ${String(deg).padStart(3, '0')}° ELV ${String(Math.round((v.pitch * 180) / Math.PI)).padStart(2, '0')}° X${v.zoom.toFixed(1)}`;
        bitText(x, head, HW - head.length * 12 - 4, 2, 2, 2);
        x.fillStyle = 'rgb(255,176,0)';
        x.fillRect(0, HH - 21, HW, 1);
        const sel = this.survey.sites[v.sel];
        const status = sel
            ? `${v.sel + 1}/${this.survey.sites.length} ${sel.name} X${Math.round(sel.x)} Z${Math.round(sel.z)} ${Math.round(sel.y)}M`
            : '←→↑↓ LOOK +- ZOOM V MAP TAB SITE ESC';
        bitText(x, status.slice(0, 58), 6, HH - 17, 2, 2);
        if (!sel && Math.floor(now / 530) % 2 === 0) x.fillRect(HW - 16, HH - 17, 10, 14);
        oneBit(x, HW, HH);
    }
}
