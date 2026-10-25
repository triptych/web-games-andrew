// The Canvas 2D view. Reads a world G every frame and answers its events; never changes G.
//
// The picture is VW × VH low-res pixels drawn into an offscreen buffer, then scaled onto the
// canvas by a whole number where it can be (nearest neighbour, so pixels stay square). Text and
// speech bubbles are drawn afterwards at full resolution so they stay sharp.

import { VW, VH, CELL, COLS, ROWS, HUD_H, PAL, ART } from '../config.js';
import { bake, background } from './sprites.js';
import { byId } from '../sim/stickers.js';
import { alive, hasTag } from '../sim/world.js';

const FONT = '"Press Start 2P", ui-monospace, Menlo, Consolas, monospace';
const INK = PAL[0];
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const LOGO_COLORS = [2, 3, 4, 5, 11, 10, 9, 3, 4];
const rnd = Math.random;                    // cosmetic only: particles never touch the sim

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.buf = document.createElement('canvas');
        this.buf.width = VW; this.buf.height = VH;
        this.b = this.buf.getContext('2d');
        this.parts = [];                    // particles, in buffer pixels
        this.pops = [];                     // floating "+1" texts, in buffer pixels
        this.shake = 0;
        this.fade = 0;
        this.goalT = 0;
        this.bootT = 0;
        this.w = 0; this.h = 0; this.dpr = 1; this.sd = 1; this.ox = 0; this.oy = 0;
        this.setSize(canvas.clientWidth || 288, canvas.clientHeight || 180);
        try { document.fonts?.load(`8px "Press Start 2P"`); } catch { /* fonts are decoration */ }
    }

    /** Size the canvas in CSS px (called from the layout, never 100vw/100vh). */
    setSize(w, h) {
        w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        const c = this.canvas;
        c.style.width = w + 'px'; c.style.height = h + 'px';
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        const fit = Math.min(c.width / VW, c.height / VH);
        this.sd = fit >= 3 ? Math.floor(fit) : fit;
        this.ox = Math.floor((c.width - VW * this.sd) / 2);
        this.oy = Math.floor((c.height - VH * this.sd) / 2);
    }

    /** Client px → scene cells (x right, y down), or null outside the scene. */
    toCell(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        if (!r.width) return null;
        const px = (clientX - r.left) * (this.canvas.width / r.width);
        const py = (clientY - r.top) * (this.canvas.height / r.height);
        const x = ((px - this.ox) / this.sd) / CELL;
        const y = (((py - this.oy) / this.sd) - HUD_H) / CELL;
        if (x < 0 || y < 0 || x > COLS || y > ROWS) return null;
        return { x, y };
    }

    /** Scene cells → client px (the inverse of toCell). The tests use it to click where a sticker is. */
    toClient(x, y) {
        const r = this.canvas.getBoundingClientRect();
        const px = this.ox + x * CELL * this.sd, py = this.oy + (HUD_H + y * CELL) * this.sd;
        return { x: r.left + (px * r.width) / this.canvas.width, y: r.top + (py * r.height) / this.canvas.height };
    }

    // ------------------------------------------------------------------ events → effects

    onEvents(G, events) {
        for (const e of events) {
            const at = (c) => [c.x * CELL, HUD_H + c.y * CELL];
            switch (e.type) {
                case 'fx': this.burst(e.kind, ...at(e)); break;
                case 'hurt': {
                    const [x, y] = at(e);
                    this.burst('hit', x, y);
                    if (G.insts.some((o) => o.id === e.id && hasTag(G, o, 'hero'))) this.shake = 0.3;
                    break;
                }
                case 'die': this.burst('smoke', ...at(e)); break;
                case 'heal': this.burst('hearts', ...at(e)); break;
                case 'spawn': this.burst('poof', ...at(e)); break;
                case 'give': {
                    const [x, y] = at(e);
                    this.pops.push({ text: `+${e.n}`, x, y: y - 8, t: 0, color: PAL[4] });
                    break;
                }
                case 'scene': this.fade = 1; break;
                default: break;
            }
        }
    }

    burst(kind, x, y) {
        const add = (n, f) => { for (let i = 0; i < n; i++) this.parts.push(f(i)); };
        switch (kind) {
            case 'sparkle': add(10, () => ({ x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 20, vy: -10 - rnd() * 18, life: 0.7, max: 0.7, c: rnd() < 0.5 ? PAL[4] : PAL[12], s: 1 })); break;
            case 'stars': add(14, () => ({ x, y, vx: (rnd() - 0.5) * 60, vy: -20 - rnd() * 40, life: 0.9, max: 0.9, c: [PAL[4], PAL[12], PAL[11]][(rnd() * 3) | 0], s: 2 })); break;
            case 'smoke': add(8, () => ({ x: x + (rnd() - 0.5) * 6, y: y + (rnd() - 0.5) * 6, vx: (rnd() - 0.5) * 14, vy: -8 - rnd() * 8, life: 0.6, max: 0.6, c: rnd() < 0.5 ? PAL[13] : PAL[14], s: 2 })); break;
            case 'hearts': add(5, () => ({ x: x + (rnd() - 0.5) * 10, y, vx: (rnd() - 0.5) * 8, vy: -12 - rnd() * 8, life: 1, max: 1, c: PAL[2], s: 3, heart: true })); break;
            case 'boom': this.shake = Math.max(this.shake, 0.25); add(22, () => { const a = rnd() * 6.283, v = 20 + rnd() * 50; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.55, max: 0.55, c: [PAL[2], PAL[3], PAL[4], PAL[12]][(rnd() * 4) | 0], s: 2 }; }); break;
            case 'hit': add(5, () => { const a = rnd() * 6.283, v = 20 + rnd() * 30; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25, max: 0.25, c: PAL[12], s: 1 }; }); break;
            case 'poof': add(6, () => { const a = rnd() * 6.283; return { x, y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, life: 0.3, max: 0.3, c: PAL[12], s: 1 }; }); break;
            default: break;
        }
    }

    // ------------------------------------------------------------------ drawing

    /** o: { mode, edit?: { sel, hover, tool }, title?, goal?, labels? }. */
    frame(G, dt, time, o = {}) {
        const { b, ctx } = this;
        const mode = o.mode || 'play';
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.imageSmoothingEnabled = false;
        b.fillStyle = INK;
        b.fillRect(0, 0, VW, VH);

        let texts = [];
        if (mode === 'boot') texts = this.drawBoot(time);
        else texts = this.drawScene(G, dt, time, o);

        if (this.fade > 0) {
            b.fillStyle = `rgba(26,28,44,${Math.min(1, this.fade)})`;
            b.fillRect(0, 0, VW, VH);
            this.fade = Math.max(0, this.fade - dt * 3);
        }

        // blit to the canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#0b0d14';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const sh = this.shake > 0 && !this.calm ? Math.round((rnd() - 0.5) * 2 * this.sd * Math.min(1, this.shake * 4)) : 0;
        this.shake = Math.max(0, this.shake - dt);
        ctx.drawImage(this.buf, this.ox + sh, this.oy, VW * this.sd, VH * this.sd);
        for (const t of texts) t(this);
    }

    drawScene(G, dt, time, o) {
        const { b } = this;
        const texts = [];
        const scene = G.cart.scenes[G.scene];
        b.drawImage(background(scene.bg), 0, HUD_H);

        const edit = o.edit;
        if (edit?.grid) {
            b.fillStyle = 'rgba(244,244,244,0.18)';
            for (let cy = 0; cy <= ROWS; cy++) for (let cx = 0; cx <= COLS; cx++) b.fillRect(cx * CELL, HUD_H + cy * CELL, 1, 1);
        }

        const list = G.insts.filter((i) => !i.gone).sort((a, c) => (a.y + (G.defs[a.sid].size === 2 ? 0.6 : 0)) - (c.y + (G.defs[c.sid].size === 2 ? 0.6 : 0)));
        for (const i of list) this.drawSticker(G, i, time);

        if (edit?.hover) {
            const def = G.defs[edit.hover.sid];
            if (def) {
                b.globalAlpha = 0.6;
                this.drawSticker(G, { ...edit.hover, id: 0, fx: 1, fy: 0, hp: 1, flash: 0, inv: 0 }, time, true);
                b.globalAlpha = 1;
            }
        }
        if (edit?.sel != null) {
            const i = G.insts.find((q) => q.item === edit.sel);
            if (i) {
                const size = G.defs[i.sid].size, half = (ART * size) / 2 + 2;
                const x = Math.round(i.x * CELL - half), y = Math.round(HUD_H + i.y * CELL - half), s = half * 2;
                b.fillStyle = (Math.floor(time * 4) % 2) ? PAL[4] : PAL[12];
                b.fillRect(x, y, s, 1); b.fillRect(x, y + s - 1, s, 1); b.fillRect(x, y, 1, s); b.fillRect(x + s - 1, y, 1, s);
            }
        }

        // particles
        for (let n = this.parts.length - 1; n >= 0; n--) {
            const p = this.parts[n];
            p.life -= dt;
            if (p.life <= 0) { this.parts.splice(n, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vy += (p.heart || p.s === 3 ? -2 : 18) * dt;
            b.globalAlpha = Math.min(1, p.life / p.max * 1.5);
            b.fillStyle = p.c;
            if (p.heart) {
                const hx = Math.round(p.x) - 3, hy = Math.round(p.y) - 3;
                for (let r = 0; r < 6; r++) for (let q = 0; q < 7; q++) if (HEART[r][q] === 'X') b.fillRect(hx + q, hy + r, 1, 1);
            } else b.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        }
        b.globalAlpha = 1;

        this.drawHud(G, o, texts);

        // floating texts and speech bubbles at full resolution
        for (let n = this.pops.length - 1; n >= 0; n--) {
            const p = this.pops[n];
            p.t += dt;
            if (p.t > 0.9) { this.pops.splice(n, 1); continue; }
            const x = p.x, y = p.y - p.t * 14, text = p.text, color = p.color, a = 1 - p.t / 0.9;
            texts.push((v) => v.text(text, x, y, { size: 5, color, align: 'center', alpha: a }));
        }
        for (const i of list) {
            if (!i.say) continue;
            const def = G.defs[i.sid];
            const top = HUD_H + i.y * CELL - (ART * def.size) / 2 - 3;
            const text = i.say.text, x = i.x * CELL;
            texts.push((v) => v.bubble(text, x, top));
        }
        if (o.labels) {
            for (const i of list) {
                const def = G.defs[i.sid];
                if (!def.label) continue;
                const x = i.x * CELL, y = HUD_H + i.y * CELL + (ART * def.size) / 2 + 3, label = def.label;
                texts.push((v) => v.text(label, x, y, { size: 4.2, color: PAL[12], align: 'center' }));
            }
        }
        if (o.goal && this.goalT > 0) {
            this.goalT -= dt;
            const goal = o.goal, a = Math.min(1, this.goalT);
            texts.push((v) => v.banner(goal, a));
        }
        return texts;
    }

    drawSticker(G, i, time, ghost = false) {
        const { b } = this;
        const def = G.defs[i.sid];
        const s = bake(def);
        const size = def.size;
        const flying = !ghost && hasTag(G, i, 'flying') && def.speed > 0 && !i.mo?.k?.startsWith('fly');
        const lively = def.speed > 0 || hasTag(G, i, 'item') || hasTag(G, i, 'friend');
        const bob = lively && !ghost ? Math.sin(time * 4 + i.id * 1.7) * 0.8 : 0;
        const lift = (flying ? 3 : 0) + (i.mo?.k === 'fly' ? 0 : 0);
        const cx = Math.round(i.x * CELL), cy = Math.round(HUD_H + i.y * CELL);
        const n = s.size * size;
        const squash = i.moving ? 1 + Math.sin(time * 16 + i.id) * 0.06 : 1;
        const h = Math.round(n * squash);
        const dx = cx - n / 2, dy = cy - n / 2 + (n - h) / 2 - lift + Math.round(bob);

        if (!ghost && !hasTag(G, i, 'magic') && !(i.mo?.k === 'fly')) {
            b.fillStyle = 'rgba(26,28,44,0.32)';
            b.beginPath();
            b.ellipse(cx, cy + 4.5 * size + (flying ? 1 : 0), 4 * size + 1, 1.7 * size, 0, 0, Math.PI * 2);
            b.fill();
        }
        // hurt heroes blink while their invulnerable time runs
        if (i.inv > 0 && hasTag(G, i, 'hero') && Math.floor(time * 14) % 2 === 0) return;

        const flip = i.fx < -0.25;
        if (flip) { b.save(); b.translate(cx, 0); b.scale(-1, 1); b.translate(-cx, 0); }
        b.drawImage(s.c, Math.round(dx), Math.round(dy), n, h);
        if (i.flash > 0) {
            b.globalAlpha = Math.min(1, i.flash / 0.15);
            b.drawImage(s.white, Math.round(dx), Math.round(dy), n, h);
            b.globalAlpha = ghost ? 0.6 : 1;
        }
        if (flip) b.restore();
    }

    drawHud(G, o, texts) {
        const { b } = this;
        b.fillStyle = INK;
        b.fillRect(0, 0, VW, HUD_H);
        b.fillStyle = PAL[15];
        b.fillRect(0, HUD_H - 1, VW, 1);
        const mode = o.mode;
        if (mode === 'play' || mode === 'press') {
            const hero = G.insts.find((i) => alive(i) && hasTag(G, i, 'hero'));
            if (hero) {
                const max = G.defs[hero.sid].hp;
                const n = Math.min(10, Math.max(0, Math.ceil(hero.hp)));
                for (let k = 0; k < Math.min(10, max); k++) {
                    b.fillStyle = k < n ? PAL[2] : PAL[14];
                    const hx = 4 + k * 8, hy = 3;
                    for (let r = 0; r < HEART.length; r++) for (let q = 0; q < 7; q++) if (HEART[r][q] === 'X') b.fillRect(hx + q, hy + r, 1, 1);
                }
            }
            let x = VW - 4;
            const show = [];
            for (const k of ['coin', 'key', 'gem', 'star']) if (G.inv[k] > 0) show.push(k);
            for (const k of show.reverse()) {
                const def = byId[k];
                const s = bake(def);
                const txt = String(G.inv[k]);
                x -= txt.length * 5 + 1;
                const tx = x;
                texts.push((v) => v.text(txt, tx, 3, { size: 5, color: PAL[12] }));
                x -= 11;
                b.drawImage(s.c, x - 1, -1, 14, 14);
                x -= 3;
            }
            const vars = ['A', 'B', 'C'].filter((k) => G.vars[k] !== 0).map((k) => `${k}:${G.vars[k]}`).join(' ');
            if (vars) texts.push((v) => v.text(vars, 96, 3, { size: 5, color: PAL[11] }));
            if (mode === 'play' && G.score > 0) {
                const sc = String(G.score);
                texts.push((v) => v.text(sc, 150, 3, { size: 5, color: PAL[4] }));
            }
        } else if (mode === 'stage') {
            const nm = G.cart.scenes[G.scene].name.toUpperCase();
            texts.push((v) => v.text(`STAGE: ${nm}`, 4, 3, { size: 5, color: PAL[4] }));
        } else if (mode === 'room') {
            texts.push((v) => v.text('FABLECART', 4, 3, { size: 5, color: PAL[4] }));
            const t = 'WALK INTO A MACHINE';
            texts.push((v) => v.text(t, VW - 4, 3, { size: 4.2, color: PAL[13], align: 'right' }));
        }
    }

    drawBoot(time) {
        const { b } = this;
        const t = time - this.bootT;
        const texts = [];
        // slow vertical scan reveal
        const reveal = Math.min(VH, t * 520);
        b.save();
        b.beginPath(); b.rect(0, 0, VW, reveal); b.clip();
        for (let y = 0; y < VH; y += 2) { b.fillStyle = 'rgba(115,239,247,0.04)'; b.fillRect(0, y, VW, 1); }
        // parade of stickers walking on from the right
        const cast = ['princess', 'knight', 'goblin', 'fairy', 'dragon', 'slime', 'castle'];
        cast.forEach((id, k) => {
            const def = byId[id];
            const target = 28 + k * 38;
            const ease = Math.max(0, 1 - Math.max(0, t - 0.5 - k * 0.12) / 1.5);
            const x = target + ease * ease * 330;
            const fake = { id: k + 1, sid: id, x: x / CELL, y: (126 + (def.size === 2 ? -6 : 0)) / CELL - HUD_H / CELL, fx: -1, fy: 0, flash: 0, inv: 0, moving: ease > 0.01, mo: null };
            this.drawSticker({ defs: byId, tags: this.bootTags(), insts: [] }, fake, time);
        });
        b.restore();
        const letters = 'FABLECART';
        const shown = Math.min(letters.length, Math.floor(t * 7));
        for (let k = 0; k < shown; k++) {
            const ch = letters[k], x = VW / 2 + (k - (letters.length - 1) / 2) * 17;
            const bounce = Math.max(0, 1 - (t - k / 7) * 4) * 8;
            const col = PAL[LOGO_COLORS[k]];
            texts.push((v) => {
                v.text(ch, x + 1, 46 - bounce + 1, { size: 15, color: INK, align: 'center', shadow: false });
                v.text(ch, x, 46 - bounce, { size: 15, color: col, align: 'center', shadow: false });
            });
        }
        if (t > 1.0) texts.push((v) => v.text('FANTASY STICKER CONSOLE', VW / 2, 68, { size: 4.6, color: PAL[13], align: 'center' }));
        if (t > 2.2 && Math.floor(t * 2) % 2 === 0) texts.push((v) => v.text('PRESS ANY KEY', VW / 2, 154, { size: 6, color: PAL[12], align: 'center' }));
        return texts;
    }

    bootTags() { return this._bt || (this._bt = new Proxy({}, { get: () => new Set() })); }

    // ------------------------------------------------------------------ text at full resolution

    text(str, vx, vy, { size = 5, color = PAL[12], align = 'left', shadow = true, alpha = 1 } = {}) {
        const { ctx, sd } = this;
        ctx.font = `${Math.max(6, Math.round(size * sd))}px ${FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'top';
        ctx.globalAlpha = alpha;
        const x = this.ox + vx * sd, y = this.oy + vy * sd;
        if (shadow) { ctx.fillStyle = INK; ctx.fillText(str, x + sd * 0.7, y + sd * 0.7); }
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
        ctx.globalAlpha = 1;
    }

    bubble(str, vx, vyBottom) {
        const { ctx, sd } = this;
        ctx.font = `${Math.round(4.4 * sd)}px ${FONT}`;
        const w = ctx.measureText(str).width + 5 * sd, h = 8.4 * sd;
        let x = this.ox + vx * sd - w / 2;
        x = Math.max(this.ox + 2 * sd, Math.min(this.ox + VW * sd - w - 2 * sd, x));
        const y = this.oy + vyBottom * sd - h - 2.5 * sd;
        ctx.fillStyle = INK;
        ctx.fillRect(x - sd, y - sd, w + 2 * sd, h + 2 * sd);
        ctx.fillStyle = PAL[12];
        ctx.fillRect(x, y, w, h);
        const tx = this.ox + vx * sd;
        ctx.fillStyle = INK;
        ctx.fillRect(tx - 1.5 * sd, y + h, 3 * sd, 1.5 * sd);
        ctx.fillStyle = PAL[12];
        ctx.fillRect(tx - 0.5 * sd, y + h, 1 * sd, 1 * sd);
        ctx.fillStyle = INK;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(str, x + 2.5 * sd, y + h / 2 + 0.3 * sd);
    }

    banner(str, a) {
        const { ctx, sd } = this;
        const words = str.toUpperCase().split(' ');
        const lines = [''];
        for (const w of words) {
            if ((lines[lines.length - 1] + ' ' + w).trim().length > 40 && lines.length < 2) lines.push(w);
            else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(26,28,44,0.88)';
        ctx.fillRect(this.ox, this.oy + (HUD_H + 4) * sd, VW * sd, (14 + lines.length * 7) * sd);
        ctx.globalAlpha = 1;
        this.text('GOAL', VW / 2, HUD_H + 7, { size: 4.4, color: PAL[4], align: 'center', alpha: a });
        lines.forEach((l, i) => this.text(l.slice(0, 44), VW / 2, HUD_H + 15 + i * 7, { size: 3.6, color: PAL[12], align: 'center', alpha: a }));
    }

    startGoal() { this.goalT = 3.2; }
}
