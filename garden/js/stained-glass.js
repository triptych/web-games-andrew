// The round stained-glass window in the Hut's loft. Every time you climb into
// the loft the window is a new design: a rose window drawn on a canvas from a
// seed, with a ring structure, a symmetry, a palette and a picture in its
// centre (a sun, a moon, a tree, a fish...), each pane mottled like old glass
// and held in dark lead. One texture is shared by the window inside and the
// little round window in the hut's dormer outside, so both always match.
// The design count is kept in storage, so the next visit is new too.

import * as THREE from 'three';
import { rng, store, TAU } from './util.js';

const N = 768;            // canvas size
const R = N / 2 - 6;      // radius of the glass
const LEAD = '#1b140f';

const PALETTES = [
    { name: 'Ember', c: ['#c0283a', '#f08a24', '#ffd25a', '#7a1f4f', '#2f6db5', '#f6e7b0'] },
    { name: 'Tide', c: ['#1d5fa8', '#2bb3c0', '#9fe3e0', '#f2d06b', '#16365e', '#e9f4f6'] },
    { name: 'Meadow', c: ['#3f9a3a', '#a7d64b', '#f4d34a', '#d9533f', '#2a5d8f', '#f3efd0'] },
    { name: 'Dusk', c: ['#6b3fa0', '#d0508a', '#f39a5b', '#2a2f7a', '#f6cf6a', '#efe0f5'] },
    { name: 'Aurora', c: ['#1e9e78', '#5ad1c4', '#7a5cd6', '#e84f8c', '#173a5a', '#e8fff4'] },
    { name: 'Harvest', c: ['#b5562a', '#e3a33b', '#7a8f2a', '#8a2e2e', '#3a5a8a', '#f8e2a8'] },
    { name: 'Orchard', c: ['#d93b4a', '#f28fb0', '#5aa64a', '#f6c445', '#3d6fb0', '#fff1e0'] },
    { name: 'Twilight', c: ['#2b3f9e', '#5b8ee6', '#b06ad9', '#f2c14e', '#e5675a', '#dfe8ff'] },
    { name: 'Lantern', c: ['#e8742a', '#f7c548', '#c33b5e', '#2e7d6b', '#5a3c8c', '#fff4d6'] },
];
const MOTIFS = [
    { key: 'sun', name: 'Sun' }, { key: 'moon', name: 'Moon' }, { key: 'star', name: 'Star' },
    { key: 'flower', name: 'Blossom' }, { key: 'tree', name: 'Tree' }, { key: 'fish', name: 'Fish' },
    { key: 'heart', name: 'Hearth' }, { key: 'compass', name: 'Compass' }, { key: 'leaf', name: 'Fern' },
    { key: 'bird', name: 'Swallow' }, { key: 'spiral', name: 'Whirl' }, { key: 'mountain', name: 'Mountain' },
];
const RINGS = ['petals', 'lancets', 'roundels', 'wedges', 'diamonds', 'scallops', 'rays'];

class StainedGlass {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = N;
        this.ctx = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 4;
        this.tint = new THREE.Color(0xffd9a0);
        this.colors = [];
        this.name = '';
        this.count = store.get('loftWindow', 0) | 0;
        this.draw(this.count);
    }

    /** A new design, remembered for next time. Returns its name. */
    next() {
        this.count = (this.count + 1) % 100000;
        store.set('loftWindow', this.count);
        this.draw(this.count);
        return this.name;
    }

    draw(n) {
        const r = rng('loft-window-' + n);
        const pick = (a) => a[Math.floor(r() * a.length)];
        // the first few visits walk through different palettes and motifs, then anything goes
        const pal = n < PALETTES.length ? PALETTES[(n * 4) % PALETTES.length] : pick(PALETTES);
        const motif = n < MOTIFS.length ? MOTIFS[(n * 5) % MOTIFS.length] : pick(MOTIFS);
        const sym = pick([6, 8, 8, 10, 12, 12, 16]);
        const cols = pal.c;
        this.colors = cols;
        this.name = `The ${pal.name} ${motif.name}`;
        const x = this.ctx;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, N, N);
        x.translate(N / 2, N / 2);
        x.lineJoin = 'round';
        x.lineCap = 'round';

        // background of the whole disc: the darkest blue of the palette, leaded later
        x.beginPath();
        x.arc(0, 0, R, 0, TAU);
        x.fillStyle = cols[4];
        x.fill();

        // rings from the outside in: a border of beads, then two or three patterned rings, then the medallion
        const r0 = 0.27 + r() * 0.06;
        const bands = r() < 0.5 ? [r0, 0.6, 0.86, 1] : [r0, 0.5, 0.7, 0.86, 1];
        // the border: a ring of small panes
        this._beads(r, cols, R * bands[bands.length - 2], R, sym * (r() < 0.5 ? 3 : 4));
        for (let i = bands.length - 3; i >= 0; i--) {
            const a = R * bands[i], b = R * bands[i + 1];
            const style = pick(RINGS);
            this._ring(r, style, cols, a, b, sym * (i === 0 && r() < 0.5 ? 1 : i === 0 ? 1 : r() < 0.4 ? 2 : 1), r() * TAU / sym);
        }
        // the medallion
        this._medallion(r, motif.key, cols, R * r0, sym);
        // lead around everything, and a ring of lead between the bands
        x.strokeStyle = LEAD;
        for (const f of bands) {
            x.lineWidth = f === 1 ? 14 : 9;
            x.beginPath();
            x.arc(0, 0, R * f - (f === 1 ? 6 : 0), 0, TAU);
            x.stroke();
        }
        // a few saddle bars, the iron that holds a big window together
        x.strokeStyle = 'rgba(20, 14, 10, 0.85)';
        x.lineWidth = 6;
        for (const yy of [-0.5, 0.5]) {
            const h = Math.sqrt(1 - yy * yy) * R;
            x.beginPath();
            x.moveTo(-h, yy * R);
            x.lineTo(h, yy * R);
            x.stroke();
        }
        // the tint of the light it lets in: the average of its glass, brightened
        const avg = [0, 0, 0];
        for (const c of cols.slice(0, 4)) {
            const k = new THREE.Color(c);
            avg[0] += k.r / 4;
            avg[1] += k.g / 4;
            avg[2] += k.b / 4;
        }
        this.tint.setRGB(avg[0], avg[1], avg[2]);
        const hsl = {};
        this.tint.getHSL(hsl);
        this.tint.setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.1), 0.62);
        this.texture.needsUpdate = true;
    }

    /** Fill a pane with its colour, mottle it like old glass, and lead it. */
    _pane(r, path, color, lead = 7) {
        const x = this.ctx;
        x.save();
        x.fillStyle = color;
        x.fill(path);
        x.clip(path);
        // mottling: soft light and dark blooms
        const b = x.getTransform();
        for (let i = 0; i < 4; i++) {
            const px = (r() - 0.5) * N * 0.9, py = (r() - 0.5) * N * 0.9;
            const rad = 40 + r() * 160;
            // the blooms are in canvas space (the pane is clipped), so undo the centring
            const g = x.createRadialGradient(px, py, 0, px, py, rad);
            const light = r() < 0.55;
            g.addColorStop(0, light ? 'rgba(255,255,240,0.22)' : 'rgba(0,0,20,0.2)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g;
            x.fillRect(-N / 2, -N / 2, N, N);
        }
        // seeds and streaks in the glass
        x.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 14; i++) {
            x.beginPath();
            x.arc((r() - 0.5) * N, (r() - 0.5) * N, 0.8 + r() * 2.2, 0, TAU);
            x.fill();
        }
        x.setTransform(b);
        x.restore();
        x.strokeStyle = LEAD;
        x.lineWidth = lead;
        x.stroke(path);
    }

    _beads(r, cols, a, b, n) {
        const c1 = cols[r() < 0.5 ? 2 : 5], c2 = cols[r() < 0.5 ? 0 : 1];
        for (let i = 0; i < n; i++) {
            const t0 = (i / n) * TAU, t1 = ((i + 1) / n) * TAU;
            const p = new Path2D();
            p.arc(0, 0, b, t0, t1);
            p.arc(0, 0, a, t1, t0, true);
            p.closePath();
            this._pane(r, p, i % 2 ? c1 : c2, 6);
            // a jewel in every other pane
            if (i % 2 === 0) {
                const m = (t0 + t1) / 2, rr = (a + b) / 2;
                const j = new Path2D();
                j.arc(Math.cos(m) * rr, Math.sin(m) * rr, (b - a) * 0.26, 0, TAU);
                this._pane(r, j, cols[3], 4);
            }
        }
    }

    _ring(r, style, cols, a, b, n, rot) {
        const pick = () => cols[Math.floor(r() * 4)];
        const bg = new Path2D();
        bg.arc(0, 0, b, 0, TAU);
        bg.arc(0, 0, a, TAU, 0, true);
        const ground = r() < 0.5 ? cols[4] : cols[5];
        this._pane(r, bg, ground, 8);
        const ca = pick();
        let cb = pick();
        if (cb === ca) cb = cols[(cols.indexOf(ca) + 1) % 4];
        const accent = cols[r() < 0.5 ? 2 : 5] === ground ? cols[3] : cols[r() < 0.5 ? 2 : 5];
        const mid = (a + b) / 2, half = (b - a) / 2;
        for (let i = 0; i < n; i++) {
            const t = rot + (i / n) * TAU, t1 = rot + ((i + 1) / n) * TAU, dt = t1 - t;
            const col = i % 2 ? cb : ca;
            const P = (rad, ang) => [Math.cos(ang) * rad, Math.sin(ang) * rad];
            const p = new Path2D();
            if (style === 'petals') {
                const tip = P(b - 4, t), base = P(a + 4, t);
                const l = P(mid, t - dt * 0.42), rr = P(mid, t + dt * 0.42);
                p.moveTo(...base);
                p.quadraticCurveTo(...l, ...tip);
                p.quadraticCurveTo(...rr, ...base);
                this._pane(r, p, col);
                const q = new Path2D();
                q.arc(...P(a + half * 0.55, t), half * 0.22, 0, TAU);
                this._pane(r, q, accent, 5);
            } else if (style === 'lancets') {
                const w = dt * 0.36;
                const [x0, y0] = P(a + 6, t - w), [x1, y1] = P(a + 6, t + w);
                const [x2, y2] = P(b - half * 0.7, t + w), [x3, y3] = P(b - half * 0.7, t - w);
                const tip = P(b - 6, t);
                p.moveTo(x0, y0);
                p.lineTo(x1, y1);
                p.lineTo(x2, y2);
                p.quadraticCurveTo(...P(b - half * 0.2, t + w * 0.8), ...tip);
                p.quadraticCurveTo(...P(b - half * 0.2, t - w * 0.8), x3, y3);
                p.closePath();
                this._pane(r, p, col);
                const q = new Path2D();
                q.arc(...P(mid, t + dt / 2), half * 0.24, 0, TAU);
                this._pane(r, q, accent, 5);
            } else if (style === 'roundels') {
                const rad = Math.min(half * 0.82, mid * Math.sin(dt / 2) * 0.86);
                p.arc(...P(mid, t), rad, 0, TAU);
                this._pane(r, p, col);
                const q = new Path2D();
                q.arc(...P(mid, t), rad * 0.45, 0, TAU);
                this._pane(r, q, accent, 5);
            } else if (style === 'wedges') {
                p.arc(0, 0, b, t, t1);
                p.arc(0, 0, a, t1, t, true);
                p.closePath();
                this._pane(r, p, col);
                const q = new Path2D();
                q.moveTo(...P(a + half * 0.4, t + dt / 2));
                q.lineTo(...P(mid, t + dt * 0.2));
                q.lineTo(...P(b - half * 0.4, t + dt / 2));
                q.lineTo(...P(mid, t + dt * 0.8));
                q.closePath();
                this._pane(r, q, accent, 5);
            } else if (style === 'diamonds') {
                p.moveTo(...P(a + 4, t));
                p.lineTo(...P(mid, t - dt * 0.48));
                p.lineTo(...P(b - 4, t));
                p.lineTo(...P(mid, t + dt * 0.48));
                p.closePath();
                this._pane(r, p, col);
                const q = new Path2D();
                q.moveTo(...P(mid - half * 0.4, t));
                q.lineTo(...P(mid, t - dt * 0.18));
                q.lineTo(...P(mid + half * 0.4, t));
                q.lineTo(...P(mid, t + dt * 0.18));
                q.closePath();
                this._pane(r, q, accent, 4);
            } else if (style === 'scallops') {
                p.arc(...P(a, t + dt / 2), Math.min(b - a - 6, a * Math.sin(dt / 2) * 1.05), 0, TAU);
                this._pane(r, p, col);
                const q = new Path2D();
                q.arc(...P(b - half * 0.5, t), half * 0.32, 0, TAU);
                this._pane(r, q, accent, 5);
            } else {
                // rays: long thin wedges, alternating long and short
                const long = i % 2 === 0;
                p.moveTo(...P(a + 4, t - dt * 0.18));
                p.lineTo(...P(long ? b - 4 : mid + half * 0.3, t));
                p.lineTo(...P(a + 4, t + dt * 0.18));
                p.closePath();
                this._pane(r, p, long ? ca : cb);
            }
        }
    }

    _medallion(r, motif, cols, rad, sym) {
        const bgCol = cols[5];
        const c = new Path2D();
        c.arc(0, 0, rad, 0, TAU);
        this._pane(r, c, r() < 0.5 ? cols[4] : bgCol, 9);
        const dark = cols[4], gold = cols[2], warm = cols[0], cool = cols[1], deep = cols[3];
        const pane = (p, col, lead = 6) => this._pane(r, p, col, lead);
        const circ = (x, y, rr) => {
            const p = new Path2D();
            p.arc(x, y, rr, 0, TAU);
            return p;
        };
        const poly = (pts) => {
            const p = new Path2D();
            p.moveTo(pts[0][0], pts[0][1]);
            for (const q of pts.slice(1)) p.lineTo(q[0], q[1]);
            p.closePath();
            return p;
        };
        // a halo of a second colour behind the picture
        pane(circ(0, 0, rad * 0.82), cols[5] === bgCol ? cool : bgCol, 6);
        const s = rad;
        if (motif === 'sun') {
            const n = 12;
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TAU, w = TAU / n / 2.4;
                pane(poly([[Math.cos(t - w) * s * 0.42, Math.sin(t - w) * s * 0.42], [Math.cos(t) * s * 0.78, Math.sin(t) * s * 0.78], [Math.cos(t + w) * s * 0.42, Math.sin(t + w) * s * 0.42]]), i % 2 ? warm : gold);
            }
            pane(circ(0, 0, s * 0.42), gold, 7);
            pane(circ(0, 0, s * 0.22), warm, 5);
        } else if (motif === 'moon') {
            const p = new Path2D();
            p.arc(0, 0, s * 0.55, 0.9, TAU - 0.9 + 0.0);
            p.arc(s * 0.3, -s * 0.05, s * 0.42, TAU - 1.15, 1.25, true);
            p.closePath();
            pane(p, gold, 7);
            for (const [x, y, k] of [[0.35, -0.42, 0.09], [0.5, 0.25, 0.07], [0.1, 0.55, 0.06], [0.58, -0.05, 0.05]]) pane(this._star(x * s, y * s, k * s * 1.6, k * s * 0.6, 5), cols[5] === gold ? warm : cols[5], 4);
        } else if (motif === 'star') {
            const pts = Math.max(5, Math.min(8, sym / 2 + 2));
            pane(this._star(0, 0, s * 0.74, s * 0.3, pts), gold, 7);
            pane(this._star(0, 0, s * 0.36, s * 0.15, pts), warm, 5);
            pane(circ(0, 0, s * 0.1), cool, 4);
        } else if (motif === 'flower') {
            const n = 6 + (sym % 4 === 0 ? 2 : 0);
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TAU;
                const p = new Path2D();
                p.ellipse(Math.cos(t) * s * 0.4, Math.sin(t) * s * 0.4, s * 0.3, s * 0.15, t, 0, TAU);
                pane(p, i % 2 ? warm : deep);
            }
            pane(circ(0, 0, s * 0.2), gold, 6);
        } else if (motif === 'tree') {
            pane(poly([[-s * 0.08, s * 0.7], [-s * 0.06, s * 0.1], [s * 0.06, s * 0.1], [s * 0.08, s * 0.7]]), '#6a3f22');
            for (const [x, y, k, col] of [[0, -0.2, 0.42, cool], [-0.32, 0.05, 0.27, deep], [0.32, 0.05, 0.27, deep], [-0.18, -0.42, 0.24, warm], [0.2, -0.44, 0.22, gold]]) pane(circ(x * s, y * s, k * s), col === cool ? '#3f9a4a' : col);
            pane(poly([[-s * 0.65, s * 0.72], [s * 0.65, s * 0.72], [s * 0.55, s * 0.5], [-s * 0.55, s * 0.5]]), '#3f7a3a');
        } else if (motif === 'fish') {
            for (const [dir, y, col] of [[1, -0.25, warm], [-1, 0.25, gold]]) {
                const p = new Path2D();
                p.ellipse(dir * -0.05 * s, y * s, s * 0.36, s * 0.17, 0, 0, TAU);
                pane(p, col);
                pane(poly([[dir * 0.28 * s, y * s], [dir * 0.58 * s, (y - 0.17) * s], [dir * 0.58 * s, (y + 0.17) * s]]), deep);
                pane(circ(dir * -0.24 * s, (y - 0.04) * s, s * 0.05), dark, 3);
            }
            const w = new Path2D();
            w.moveTo(-s * 0.7, s * 0.62);
            for (let i = 0; i <= 8; i++) w.quadraticCurveTo(-s * 0.7 + (i + 0.5) * s * 0.175, s * (i % 2 ? 0.54 : 0.7), -s * 0.7 + (i + 1) * s * 0.175, s * 0.62);
            this.ctx.strokeStyle = cool;
            this.ctx.lineWidth = 10;
            this.ctx.stroke(w);
        } else if (motif === 'heart') {
            const p = new Path2D();
            p.moveTo(0, s * 0.55);
            p.bezierCurveTo(-s * 0.9, -s * 0.05, -s * 0.45, -s * 0.75, 0, -s * 0.3);
            p.bezierCurveTo(s * 0.45, -s * 0.75, s * 0.9, -s * 0.05, 0, s * 0.55);
            pane(p, warm, 8);
            // a little flame in it: the hearth
            const f = new Path2D();
            f.moveTo(0, s * 0.3);
            f.quadraticCurveTo(-s * 0.22, s * 0.05, 0, -s * 0.22);
            f.quadraticCurveTo(s * 0.22, s * 0.05, 0, s * 0.3);
            pane(f, gold, 5);
        } else if (motif === 'compass') {
            pane(this._star(0, 0, s * 0.78, s * 0.16, 4), gold, 7);
            this.ctx.rotate(Math.PI / 4);
            pane(this._star(0, 0, s * 0.5, s * 0.12, 4), cool, 5);
            this.ctx.rotate(-Math.PI / 4);
            pane(circ(0, 0, s * 0.12), warm, 5);
        } else if (motif === 'leaf') {
            for (const [ang, col] of [[-0.6, '#3f9a4a'], [0.6, deep], [Math.PI, gold]]) {
                this.ctx.save();
                this.ctx.rotate(ang);
                const p = new Path2D();
                p.moveTo(0, 0);
                p.quadraticCurveTo(s * 0.32, -s * 0.38, 0, -s * 0.78);
                p.quadraticCurveTo(-s * 0.32, -s * 0.38, 0, 0);
                pane(p, col);
                this.ctx.restore();
            }
            pane(circ(0, 0, s * 0.12), warm, 5);
        } else if (motif === 'bird') {
            const p = new Path2D();
            p.moveTo(-s * 0.7, -s * 0.3);
            p.quadraticCurveTo(-s * 0.25, -s * 0.15, 0, s * 0.1);
            p.quadraticCurveTo(s * 0.25, -s * 0.15, s * 0.7, -s * 0.3);
            p.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.08, s * 0.32);
            p.lineTo(s * 0.18, s * 0.66);
            p.lineTo(0, s * 0.45);
            p.lineTo(-s * 0.18, s * 0.66);
            p.lineTo(-s * 0.08, s * 0.32);
            p.quadraticCurveTo(-s * 0.3, s * 0.1, -s * 0.7, -s * 0.3);
            pane(p, deep === dark ? cool : deep, 7);
            pane(circ(0, s * 0.12, s * 0.12), warm, 5);
            pane(circ(-s * 0.4, -s * 0.48, s * 0.12), gold, 4);
        } else if (motif === 'spiral') {
            const n = 7;
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TAU;
                const p = new Path2D();
                p.moveTo(0, 0);
                p.quadraticCurveTo(Math.cos(t + 0.9) * s * 0.6, Math.sin(t + 0.9) * s * 0.6, Math.cos(t + 0.4) * s * 0.78, Math.sin(t + 0.4) * s * 0.78);
                p.quadraticCurveTo(Math.cos(t + 0.2) * s * 0.3, Math.sin(t + 0.2) * s * 0.3, 0, 0);
                pane(p, [warm, gold, cool, deep][i % 4]);
            }
            pane(circ(0, 0, s * 0.12), cols[5], 5);
        } else {
            // mountain under the sun
            pane(circ(s * 0.25, -s * 0.3, s * 0.2), gold, 6);
            pane(poly([[-s * 0.75, s * 0.5], [-s * 0.2, -s * 0.35], [s * 0.15, s * 0.15], [s * 0.35, -s * 0.05], [s * 0.75, s * 0.5]]), deep === dark ? cool : deep, 7);
            pane(poly([[-s * 0.2, -s * 0.35], [-s * 0.32, -s * 0.15], [-s * 0.2, -s * 0.2], [-s * 0.08, -s * 0.15]]), '#f4f2ea', 4);
            pane(poly([[-s * 0.8, s * 0.48], [s * 0.8, s * 0.48], [s * 0.7, s * 0.72], [-s * 0.7, s * 0.72]]), cool, 6);
        }
    }

    _star(cx, cy, ro, ri, n) {
        const p = new Path2D();
        for (let i = 0; i < n * 2; i++) {
            const t = (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? ri : ro;
            const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
            if (i) p.lineTo(x, y);
            else p.moveTo(x, y);
        }
        p.closePath();
        return p;
    }
}

let shared = null;
/** The one stained-glass window: inside the loft and outside on the dormer. */
export function stainedGlass() {
    shared ??= new StainedGlass();
    return shared;
}
