/**
 * reels.js — the slot machine. Each reel scrolls its real strip (so what you
 * see spinning past is what the Probability Engine wrote), stops with a bounce,
 * and can be overridden by an explicit column (cascades, expanded wilds).
 *
 * Also draws: the cabinet with chasing marquee bulbs, hold/jam/selection
 * overlays, the projected-line preview, and win traces.
 */

import { symbolTile, hexA, rrect, drawGlyph } from './art.js';
import { SYMBOLS } from '../sim/symbols.js';

const TAU = Math.PI * 2;
const md = (a, n) => ((a % n) + n) % n;

export class ReelView {
    constructor() {
        this.reels = [];
        this.rect = null;
        this.cell = 80;
        this.rows = 3;
        this.hl = new Map();          // c*10+r → { t, color }
        this.traces = [];             // win lines being drawn
        this.dim = 0;                 // 0..1: dim non-highlighted cells
        this.dimTarget = 0;
        this.preview = [];            // projected wins while landed
        this.selected = -1;
        this.marquee = 0;             // 0 idle, 1 spinning, 2 celebrating
        this.celebrate = 0;
        this.od = 0;                  // overdrive glow
        this.time = 0;
        this.pinned = [];             // sticky wilds pinned during a spin
    }

    setup(st) {
        this.rows = st.rows;
        this.reels = st.reels.map((r, c) => ({
            strip: r.strip.slice(), p: r.pos, anim: null, bounce: 1, fixed: st.grid[c].slice(),
            hold: r.hold, jammed: r.jammed, lockNext: r.lock > 0, drop: null, glow: 0, shake: 0,
        }));
        this.hl.clear();
        this.traces = [];
        this.preview = [];
    }

    layout(rect, cell) {
        this.rect = rect;
        this.cell = cell;
    }

    /** Update reel flags (hold / jam / lock) from sim state without disturbing animation. */
    syncFlags(st) {
        st.reels.forEach((r, c) => {
            const v = this.reels[c];
            if (!v) return;
            v.hold = r.hold;
            v.jammed = r.jammed;
            v.lockNext = r.lock > 0 && st.phase === 'ready';
            v.strip = r.strip.slice();
        });
    }

    setColumn(c, col) { this.reels[c].fixed = col.slice(); }
    setGrid(grid) { grid.forEach((col, c) => this.setColumn(c, col)); }

    /** Spin reel c to strip position `to`. Resolves when it lands. */
    spinTo(c, to, dur, opts = {}) {
        const v = this.reels[c];
        return new Promise((res) => {
            const len = v.strip.length;
            const loops = opts.loops ?? Math.max(2, Math.round(dur * 7));
            const D = md(v.p - to, len) + len * loops;
            v.fixed = null;
            v.anim = { from: v.p, D, t: 0, dur, res, antic: !!opts.antic, delay: opts.delay ?? 0, final: opts.final ?? null };
        });
    }

    /** One-step nudge: dir +1 moves symbols down. */
    nudge(c, to, dir, final) {
        const v = this.reels[c];
        return new Promise((res) => {
            v.fixed = null;
            const D = dir > 0 ? 1 : -1;
            v.anim = { from: v.p, D, t: 0, dur: 0.16, res, nudge: true, delay: 0, final };
        });
    }

    /** Cascade: removed cells shatter, survivors fall, fresh symbols drop in. */
    drop(c, newCol, removedRows) {
        const v = this.reels[c];
        const rows = this.rows;
        const k = removedRows.length;
        const drop = new Array(rows).fill(0);
        // kept symbols move down by the number of removed rows below them
        let ni = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
            if (removedRows.includes(r)) continue;
            drop[ni] = ni - r;
            ni--;
        }
        for (let r = 0; r < k; r++) drop[r] = k + 0.6;
        v.fixed = newCol.slice();
        v.drop = { off: drop, t: 0 };
    }

    cellCenter(c, r) {
        const R = this.rect;
        return { x: R.x + (c + 0.5) * this.cell, y: R.y + (r + 0.5) * this.cell };
    }

    reelAt(x, y) {
        const R = this.rect;
        if (!R || x < R.x || x > R.x + R.w || y < R.y - 10 || y > R.y + R.h + 10) return -1;
        return Math.floor((x - R.x) / this.cell);
    }

    highlight(cells, color, dur = 0.6) {
        for (const [c, r] of cells) this.hl.set(c * 10 + r, { t: 0, dur, color });
    }

    trace(cells, color, dur = 0.7) {
        this.traces.push({ pts: cells.map(([c, r]) => this.cellCenter(c, r)), color, t: 0, dur });
    }

    clearWins() { this.hl.clear(); this.traces = []; this.dimTarget = 0; }

    update(dt) {
        this.time += dt;
        this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 10);
        this.celebrate = Math.max(0, this.celebrate - dt);
        for (const v of this.reels) {
            v.glow = Math.max(0, v.glow - dt * 2);
            v.shake = Math.max(0, v.shake - dt * 3);
            if (v.bounce < 1) v.bounce = Math.min(1, v.bounce + dt / 0.22);
            if (v.drop) {
                v.drop.t += dt;
                const u = Math.min(1, v.drop.t / 0.32);
                if (u >= 1) v.drop = null; else v.drop.u = u;
            }
            const a = v.anim;
            if (!a) continue;
            if (a.delay > 0) { a.delay -= dt; continue; }
            a.t += dt;
            const u = Math.min(1, a.t / a.dur);
            let e;
            if (a.nudge) e = 1 - (1 - u) * (1 - u);
            else if (a.antic) e = u < 0.55 ? (u / 0.55) * 0.82 : 0.82 + 0.18 * (1 - Math.pow(1 - (u - 0.55) / 0.45, 3));
            else e = u < 0.62 ? (u / 0.62) * 0.86 : 0.86 + 0.14 * (1 - Math.pow(1 - (u - 0.62) / 0.38, 2));
            const len = v.strip.length;
            v.p = a.from - a.D * e;
            v.speed = Math.abs(a.D) / a.dur * (a.nudge ? 0 : (u < 0.62 ? 1.4 : (1 - u) * 3));
            if (u >= 1) {
                v.p = md(Math.round(a.from - a.D), len);
                v.anim = null;
                v.speed = 0;
                v.bounce = 0;
                if (a.final) v.fixed = a.final.slice();
                a.res();
            }
        }
    }

    draw(ctx, opts = {}) {
        const R = this.rect;
        if (!R) return;
        const cell = this.cell;
        const rows = this.rows;
        const cols = this.reels.length;
        const t = this.time;
        this.drawCabinet(ctx, R, cols, opts);
        // reel windows
        for (let c = 0; c < cols; c++) {
            const v = this.reels[c];
            const x = R.x + c * cell + (v.shake ? (Math.random() - 0.5) * v.shake * 8 : 0);
            ctx.save();
            ctx.beginPath();
            ctx.rect(x + 1, R.y, cell - 2, R.h);
            ctx.clip();
            const bg = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
            bg.addColorStop(0, '#05070e'); bg.addColorStop(0.5, '#0c1222'); bg.addColorStop(1, '#05070e');
            ctx.fillStyle = bg;
            ctx.fillRect(x, R.y, cell, R.h);
            if (v.anim && v.anim.antic) {
                ctx.fillStyle = hexA('#ff4dff', 0.12 + 0.1 * Math.sin(t * 20));
                ctx.fillRect(x, R.y, cell, R.h);
            }
            const bounceOff = v.bounce < 1 ? Math.sin(v.bounce * Math.PI) * (1 - v.bounce) * 0.16 : 0;
            if (v.fixed && !v.anim) {
                for (let r = 0; r < rows; r++) {
                    let off = 0;
                    if (v.drop) { const u = v.drop.u ?? 0; off = v.drop.off[r] * (1 - u * u); }
                    this.drawCell(ctx, v.fixed[r], c, r, x, R.y + (r - off + bounceOff) * cell, cell, opts);
                }
            } else {
                const len = v.strip.length;
                const p = v.p - bounceOff;
                const base = Math.floor(p);
                const frac = p - base;
                const blur = (v.speed ?? 0) > 9;
                for (let k = -1; k <= rows; k++) {
                    const sym = v.strip[md(base + k, len)];
                    this.drawCell(ctx, sym, c, k, x, R.y + (k - frac) * cell, cell, opts, blur);
                }
            }
            // sticky wilds stay pinned while the reel spins under them
            if (v.anim) for (const [pc, pr] of this.pinned) if (pc === c) this.drawCell(ctx, 'wild', c, pr, x, R.y + pr * cell, cell, opts);
            // depth shading top and bottom
            const sh = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
            sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(0.16, 'rgba(0,0,0,0)'); sh.addColorStop(0.84, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = sh;
            ctx.fillRect(x, R.y, cell, R.h);
            if (v.jammed) this.drawJam(ctx, x, R.y, cell, R.h, t);
            ctx.restore();
            // separators
            ctx.fillStyle = 'rgba(120,160,255,0.18)';
            if (c > 0) ctx.fillRect(R.x + c * cell - 1, R.y, 2, R.h);
            // overlays outside the clip
            if (v.hold) {
                ctx.strokeStyle = '#45f3ff'; ctx.lineWidth = 3;
                ctx.strokeRect(x + 3, R.y + 3, cell - 6, R.h - 6);
                this.tag(ctx, x + cell / 2, R.y + R.h - 2, 'HOLD', '#45f3ff');
            }
            if (v.lockNext) {
                this.tag(ctx, x + cell / 2, R.y + 12, 'JAMMED', '#ff3355');
                ctx.strokeStyle = hexA('#ff3355', 0.5 + 0.3 * Math.sin(t * 6)); ctx.lineWidth = 2;
                ctx.strokeRect(x + 3, R.y + 3, cell - 6, R.h - 6);
            }
            if (v.glow > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = hexA('#ffffff', v.glow * 0.25);
                ctx.fillRect(x, R.y, cell, R.h);
                ctx.restore();
            }
            if (this.selected === c) {
                ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
                ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30;
                ctx.strokeRect(x + 2, R.y - 4, cell - 4, R.h + 8);
                ctx.setLineDash([]);
            }
        }
        this.drawPreview(ctx);
        this.drawTraces(ctx);
    }

    drawCell(ctx, sym, c, r, x, y, cell, opts, blur = false) {
        if (!sym) return;
        const key = c * 10 + r;
        const h = this.hl.get(key);
        const inside = r >= 0 && r < this.rows;
        let scale = 1, lit = false;
        if (h && inside) {
            const u = Math.min(1, h.t / 0.18);
            scale = 1 + 0.16 * Math.sin(u * Math.PI) + 0.04;
            lit = true;
        }
        const tile = symbolTile(sym, cell, blur ? 'blur' : lit ? 'lit' : 'n');
        const s = cell * scale;
        if (this.dim > 0.01 && !lit && inside) ctx.globalAlpha = 1 - this.dim * 0.6;
        ctx.drawImage(tile, x + (cell - s) / 2, y + (cell - s) / 2, s, s);
        ctx.globalAlpha = 1;
        if (sym === 'wild' && inside && !blur) {
            // a sparkle that wanders around the star
            const a = this.time * 3 + c + r;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 8 + c);
            ctx.beginPath(); ctx.arc(x + cell / 2 + Math.cos(a) * cell * 0.3, y + cell / 2 + Math.sin(a) * cell * 0.3, cell * 0.025, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
        }
        if (sym === 'core' && inside && !blur) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = hexA('#ff4dff', 0.08 + 0.06 * Math.sin(this.time * 5 + c));
            ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.45, 0, TAU); ctx.fill();
            ctx.restore();
        }
    }

    drawJam(ctx, x, y, w, h, t) {
        ctx.save();
        ctx.fillStyle = 'rgba(40,0,8,0.55)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,40,70,0.55)';
        ctx.lineWidth = 6;
        for (let i = -h; i < w + h; i += 22) {
            ctx.beginPath(); ctx.moveTo(x + i + (t * 20) % 22, y); ctx.lineTo(x + i - h + (t * 20) % 22, y + h); ctx.stroke();
        }
        // padlock
        const cx = x + w / 2, cy = y + h / 2;
        ctx.fillStyle = '#ff3355';
        ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 12;
        rrect(ctx, cx - w * 0.18, cy - w * 0.04, w * 0.36, w * 0.28, 4); ctx.fill();
        ctx.lineWidth = w * 0.06; ctx.strokeStyle = '#ff3355';
        ctx.beginPath(); ctx.arc(cx, cy - w * 0.04, w * 0.12, Math.PI, 0); ctx.stroke();
        ctx.restore();
    }

    tag(ctx, x, y, str, color) {
        ctx.save();
        ctx.font = '800 11px system-ui, sans-serif';
        const w = ctx.measureText(str).width + 10;
        ctx.fillStyle = color;
        rrect(ctx, x - w / 2, y - 9, w, 16, 4); ctx.fill();
        ctx.fillStyle = '#05070e';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(str, x, y);
        ctx.restore();
    }

    drawCabinet(ctx, R, cols, opts) {
        const pad = Math.max(10, this.cell * 0.14);
        const x = R.x - pad, y = R.y - pad, w = R.w + pad * 2, h = R.h + pad * 2;
        const t = this.time;
        ctx.save();
        // outer glow when overdriven
        if (this.od > 0) {
            ctx.shadowColor = '#ff4dff'; ctx.shadowBlur = 30 * this.od;
        } else { ctx.shadowColor = 'rgba(69,243,255,0.35)'; ctx.shadowBlur = 18; }
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#3a4766'); g.addColorStop(0.5, '#1a2238'); g.addColorStop(1, '#2a3550');
        ctx.fillStyle = g;
        rrect(ctx, x, y, w, h, pad * 0.9); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.od > 0 ? hexA('#ff4dff', 0.8) : 'rgba(150,200,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // marquee bulbs
        const per = 2 * (w + h);
        const n = Math.max(16, Math.round(per / 26));
        const speed = this.marquee === 1 ? 14 : this.celebrate > 0 ? 22 : 3;
        for (let i = 0; i < n; i++) {
            const d = (i / n) * per;
            let bx, by;
            if (d < w) { bx = x + d; by = y + pad * 0.42; }
            else if (d < w + h) { bx = x + w - pad * 0.42; by = y + (d - w); }
            else if (d < 2 * w + h) { bx = x + w - (d - w - h); by = y + h - pad * 0.42; }
            else { bx = x + pad * 0.42; by = y + h - (d - 2 * w - h); }
            const on = ((i + Math.floor(t * speed)) % 3) === 0;
            let col = this.od > 0 ? '#ff4dff' : '#ffd36a';
            if (this.celebrate > 0) col = ['#45f3ff', '#ff4dff', '#ffe14d', '#46ff9a'][(i + Math.floor(t * 12)) % 4];
            ctx.fillStyle = on ? col : 'rgba(255,255,255,0.12)';
            if (on) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
            ctx.beginPath(); ctx.arc(bx, by, Math.max(2, pad * 0.17), 0, TAU); ctx.fill();
            ctx.shadowBlur = 0;
        }
        // payline tabs on the left
        if (opts.lines) {
            ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const seen = {};
            opts.lines.forEach((ln, i) => {
                const r0 = ln.rows[0];
                seen[r0] = (seen[r0] ?? 0) + 1;
                const k = seen[r0] - 1;
                const ty = R.y + (r0 + 0.5) * this.cell + (k - 1) * 11;
                const tx = R.x - pad * 0.5 - 1;
                const active = this.preview.some((p) => p.line === i);
                ctx.fillStyle = active ? '#ffe14d' : 'rgba(150,180,230,0.35)';
                ctx.fillRect(tx - 3, ty - 4, 6, 8);
            });
        }
        ctx.restore();
    }

    drawPreview(ctx) {
        if (!this.preview.length) return;
        const t = this.time;
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const w of this.preview) {
            const pts = w.cells.map(([c, r]) => this.cellCenter(c, r));
            const col = SYMBOLS[w.sym].color;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = -t * 40;
            ctx.strokeStyle = hexA(col === '#ffffff' ? '#ffe14d' : col, 0.75);
            ctx.lineWidth = 3;
            ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
            ctx.setLineDash([]);
            for (const p of pts) {
                ctx.strokeStyle = hexA(col === '#ffffff' ? '#ffe14d' : col, 0.6);
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - this.cell * 0.44, p.y - this.cell * 0.44, this.cell * 0.88, this.cell * 0.88);
            }
        }
        ctx.restore();
    }

    drawTraces(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = this.traces.length - 1; i >= 0; i--) {
            const tr = this.traces[i];
            const u = Math.min(1, tr.t / 0.22);
            const fade = tr.t > tr.dur - 0.2 ? Math.max(0, (tr.dur - tr.t) / 0.2) : 1;
            const pts = tr.pts;
            // partial polyline up to u
            const segs = pts.length - 1;
            const upto = u * segs;
            for (const [w, a, c] of [[16, 0.25, tr.color], [7, 0.7, tr.color], [2.5, 1, '#ffffff']]) {
                ctx.strokeStyle = c === '#ffffff' ? c : hexA(c, a * fade);
                ctx.globalAlpha = c === '#ffffff' ? fade : 1;
                ctx.lineWidth = w;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let k = 1; k <= segs; k++) {
                    if (k <= upto) ctx.lineTo(pts[k].x, pts[k].y);
                    else { const f = upto - (k - 1); if (f > 0) ctx.lineTo(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f); break; }
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    tick(dt) {
        for (const h of this.hl.values()) h.t += dt;
        for (let i = this.traces.length - 1; i >= 0; i--) { this.traces[i].t += dt; if (this.traces[i].t > this.traces[i].dur) this.traces.splice(i, 1); }
        for (const [k, h] of this.hl) if (h.t > h.dur) this.hl.delete(k);
    }
}

export { drawGlyph };
