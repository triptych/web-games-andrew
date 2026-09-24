// ============================================================
// Draws a Game into the pixel buffer (the canvas backing store is the
// game's own low resolution; CSS scales it up by a whole number of device
// pixels). Everything is drawn at 1:1 with integer coordinates.
// ============================================================

import { TILE, WEAPONS } from './config.js';
import { T } from './tiles.js';
import { FONT, GLYPH_W, GLYPH_H, GLYPH_ADV } from './font.js';
import { NES, INK, col } from './art.js';
import { mod } from './rng.js';

const GROUNDISH = new Set([T.GROUND, T.CEIL, T.CRACK]);
const RAINBOW = ['#F83800', '#F8B800', '#58D854', '#3CBCFC', '#9878F8', '#F878F8'];

export class Renderer {
    constructor(canvas, art) {
        this.cv = canvas;
        this.x = canvas.getContext('2d', { alpha: false });
        this.art = art;
        this.glyphs = new Map();
        this.tints = new Map();
        this.skyCache = new Map();
        this.W = canvas.width; this.H = canvas.height;
    }

    resize(w, h) {
        this.cv.width = w; this.cv.height = h;
        this.W = w; this.H = h;
        this.x.imageSmoothingEnabled = false;
    }

    // ---------------------------------------------------- text
    glyph(ch, color) {
        const key = color + ch;
        let g = this.glyphs.get(key);
        if (g) return g;
        const rows = FONT[ch] || FONT[ch.toUpperCase()] || FONT['?'];
        g = document.createElement('canvas');
        g.width = GLYPH_W; g.height = GLYPH_H;
        const x = g.getContext('2d');
        x.fillStyle = color;
        for (let r = 0; r < GLYPH_H; r++) for (let c = 0; c < GLYPH_W; c++) if (rows[r][c] === '#') x.fillRect(c, r, 1, 1);
        this.glyphs.set(key, g);
        return g;
    }

    textWidth(s, scale = 1) { return s.length ? (s.length * GLYPH_ADV - 1) * scale : 0; }

    /** align: 'l' | 'c' | 'r'. shadow draws a dark copy one pixel down-right. */
    text(s, x, y, color = '#FCFCFC', align = 'l', scale = 1, shadow = true) {
        s = String(s);
        const w = this.textWidth(s, scale);
        let X = Math.round(align === 'c' ? x - w / 2 : align === 'r' ? x - w : x);
        const Y = Math.round(y);
        const ctx = this.x;
        for (const ch of s) {
            if (ch !== ' ') {
                if (shadow) ctx.drawImage(this.glyph(ch, INK), X + scale, Y + scale, GLYPH_W * scale, GLYPH_H * scale);
                ctx.drawImage(this.glyph(ch, color), X, Y, GLYPH_W * scale, GLYPH_H * scale);
            }
            X += GLYPH_ADV * scale;
        }
        return w;
    }

    spr(name, x, y, flip = false, alpha = 1) {
        const s = this.art.spr[name];
        if (!s) return;
        const ctx = this.x;
        if (alpha !== 1) ctx.globalAlpha = alpha;
        ctx.drawImage(flip ? s.flipped : s.c, Math.round(x), Math.round(y));
        if (alpha !== 1) ctx.globalAlpha = 1;
    }

    tinted(name, color) {
        const key = name + color;
        let c = this.tints.get(key);
        if (c) return c;
        const s = this.art.spr[name];
        c = document.createElement('canvas');
        c.width = s.w; c.height = s.h;
        const x = c.getContext('2d');
        x.drawImage(s.c, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.globalAlpha = 0.55;
        x.fillStyle = color;
        x.fillRect(0, 0, s.w, s.h);
        this.tints.set(key, { c, f: null, w: s.w, h: s.h, get flipped() { if (!this.f) { const d = document.createElement('canvas'); d.width = this.w; d.height = this.h; const y = d.getContext('2d'); y.translate(this.w, 0); y.scale(-1, 1); y.drawImage(this.c, 0, 0); this.f = d; } return this.f; } });
        return this.tints.get(key);
    }

    rect(x, y, w, h, c) { this.x.fillStyle = c; this.x.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

    panel(x, y, w, h, fill = '#1a1026', border = '#FCFCFC') {
        const ctx = this.x;
        x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = border; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }

    // ---------------------------------------------------- backdrop
    sky(theme, colors) {
        const key = theme + this.H;
        let c = this.skyCache.get(key);
        if (!c) {
            c = document.createElement('canvas');
            c.width = 4; c.height = this.H;
            const x = c.getContext('2d');
            const n = colors.length;
            for (let y = 0; y < this.H; y++) {
                const t = y / this.H * (n - 1);
                const i = Math.min(n - 2, Math.floor(t)), f = t - i;
                for (let X = 0; X < 4; X++) {
                    // 4x4 ordered dither between neighbouring bands
                    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][X] / 16;
                    x.fillStyle = f > bayer ? colors[i + 1] : colors[i];
                    x.fillRect(X, y, 1, 1);
                }
            }
            this.skyCache.set(key, c);
        }
        const ctx = this.x;
        for (let X = 0; X < this.W; X += 4) ctx.drawImage(c, X, 0);
    }

    backdrop(g, th, t) {
        const ctx = this.x;
        this.sky(g.level.theme, th.sky);
        const bg = th.bg;
        const cam = g.cam;
        const layers = [[bg.far, 0.15], [bg.mid, 0.35], [bg.near, 0.6]];
        const indoor = g.level.theme === 'keep' || g.level.theme === 'castle';
        const anchor = 21 * TILE + 36;   // world y the backdrop's bottom sits at
        for (const [img, f] of layers) {
            const fy = indoor ? 0.2 : f;
            let bottom = Math.round(this.H + (anchor - cam.y - this.H) * fy);
            if (g.level.theme === 'grotto' && img === bg.far) bottom = Math.round(bg.H - cam.y * 0.05);
            if (indoor) bottom = Math.round(bg.H + (this.H - bg.H) * 0.5 - cam.y * 0.06);
            const ox = -mod(Math.round(cam.x * f + (img === bg.near && g.level.theme === 'skies' ? t * 6 : 0)), bg.W);
            for (let X = ox; X < this.W; X += bg.W) ctx.drawImage(img, X, bottom - bg.H);
            // below the strip, continue its bottom row so nothing shows through
            if (bottom < this.H && !indoor && img !== bg.near) {
                ctx.drawImage(img, 0, bg.H - 1, 1, 1, 0, bottom, this.W, this.H - bottom);
            }
        }
        if (th.dim) { ctx.globalAlpha = th.dim; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    }

    // ---------------------------------------------------- level
    drawGame(g, t) {
        const ctx = this.x;
        const th = this.art.theme(g.level.theme);
        ctx.imageSmoothingEnabled = false;
        const shx = g.shake > 0 ? Math.round((Math.sin(t * 90) * g.shake)) : 0;
        const shy = g.shake > 0 ? Math.round((Math.cos(t * 77) * g.shake * 0.6)) : 0;
        this.backdrop(g, th, t);
        const cx = Math.round(g.cam.x) - shx, cy = Math.round(g.cam.y) - shy;
        this.cx = cx; this.cy = cy;

        // things that live behind the tiles
        for (const e of g.enemies) if (!e.dead && e.active && (e.kind === 'chomper' || e.kind === 'lavabub')) this.enemy(e, t);

        this.abyss(g, th);
        this.tiles(g, th, t);
        this.objects(g, th, t);
        for (const e of g.enemies) if (!e.dead && (e.kind !== 'chomper' && e.kind !== 'lavabub')) this.enemy(e, t);
        if (g.boss) this.boss(g, t);
        this.player(g, t);
        this.shots(g, t);
        this.particles(g, t);
        if (g.flashT > 0) { ctx.globalAlpha = Math.min(0.7, g.flashT * 3); this.rect(0, 0, this.W, this.H, '#FCFCFC'); ctx.globalAlpha = 1; }
    }

    /** Bottomless pits fade to a dark abyss so they never read as solid ground. */
    abyss(g, th) {
        const ctx = this.x;
        const x0 = Math.max(0, Math.floor(this.cx / TILE)), x1 = Math.min(g.w - 1, Math.floor((this.cx + this.W) / TILE));
        const dark = th.abyss;
        for (let tx = x0; tx <= x1; tx++) {
            const top = g.pitTop[tx];
            if (top < 0) continue;
            const sx = tx * TILE - this.cx, sy = top * TILE - this.cy;
            ctx.fillStyle = dark;
            // two dithered rows, then solid
            for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c += 2) ctx.fillRect(sx + c + (r & 1), sy + r * 2, 1, 1);
            for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) if ((c + r) % 2 === 0) ctx.fillRect(sx + c, sy + 8 + r, 1, 1);
            ctx.fillRect(sx, sy + 12, 16, g.h * TILE - top * TILE);
        }
    }

    tiles(g, th, t) {
        const ctx = this.x;
        const { atlas, slots } = th;
        const x0 = Math.max(0, Math.floor(this.cx / TILE)), x1 = Math.min(g.w - 1, Math.floor((this.cx + this.W) / TILE));
        const y0 = Math.max(0, Math.floor(this.cy / TILE)), y1 = Math.min(g.h - 1, Math.floor((this.cy + this.H) / TILE));
        const qf = mod(Math.floor(t * 5), 4) === 3 ? 1 : [0, 0, 2, 1][mod(Math.floor(t * 5), 4)];
        const cf = mod(Math.floor(t * 8), 4);
        const lf = mod(Math.floor(t * 4), 4);
        const bumped = new Map();
        for (const b of g.bumps) bumped.set(b.y * g.w + b.x, b);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const i = ty * g.w + tx;
                const tt = g.tiles[i];
                if (tt === T.EMPTY || tt === T.HIDDEN) continue;
                let key;
                switch (tt) {
                    case T.GROUND: case T.CEIL: {
                        const up = ty > 0 ? g.tiles[i - g.w] : T.EMPTY;
                        const dn = ty < g.h - 1 ? g.tiles[i + g.w] : T.GROUND;
                        const lf2 = tx > 0 ? g.tiles[i - 1] : tt, rt = tx < g.w - 1 ? g.tiles[i + 1] : tt;
                        let m = 0;
                        if (!GROUNDISH.has(up) && ty > 0) m |= 1;
                        if (!GROUNDISH.has(rt)) m |= 2;
                        if (!GROUNDISH.has(dn)) m |= 4;
                        if (!GROUNDISH.has(lf2)) m |= 8;
                        key = (tt === T.CEIL ? 'c' : 'g') + m;
                        break;
                    }
                    case T.BRICK: key = 'brick'; break;
                    case T.QBLOCK: key = 'q' + qf; break;
                    case T.USED: key = 'used'; break;
                    case T.HARD: key = 'hard'; break;
                    case T.ONEWAY: key = 'oneway'; break;
                    case T.SPIKE: key = 'spike'; break;
                    case T.LAVA: key = 'lava' + lf; break;
                    case T.LAVA_FILL: key = 'lavaf' + lf; break;
                    case T.RED: key = 'red'; break;
                    case T.BUBBLE: key = 'bubble' + (mod(Math.floor(t * 3 + tx), 2)); break;
                    case T.ICE: key = 'ice'; break;
                    case T.CRACK: key = 'crack'; break;
                    case T.PIPE_TL: key = 'pTL'; break;
                    case T.PIPE_TR: key = 'pTR'; break;
                    case T.PIPE_L: key = 'pL'; break;
                    case T.PIPE_R: key = 'pR'; break;
                    case T.COIN: key = 'coin' + cf; break;
                    case T.SPRING: key = 'spring0'; break;
                    case T.POLE: key = 'pole'; break;
                    case T.DECO_A: key = 'deco0'; break;
                    case T.DECO_B: key = 'deco1'; break;
                    case T.DECO_C: key = 'deco2'; break;
                    case T.DECO_D: key = 'deco3'; break;
                    case T.DECO_E: key = 'wall0' + mod(Math.floor(t * 6 + tx), 2); break;
                    case T.DECO_F: key = 'wall1' + mod(Math.floor(t * 6 + tx), 2); break;
                    default: continue;
                }
                const b = bumped.get(i);
                if (b && b.spring) key = 'spring1';
                const s = slots[key];
                if (!s) continue;
                let dy = 0;
                if (b && !b.spring) dy = -Math.round(Math.sin((1 - b.t / 0.15) * Math.PI) * 4);
                if (tt === T.ICE) {
                    const it = g.iceTiles.find(q => q.x === tx && q.y === ty);
                    if (it && it.t < 2 && mod(Math.floor(t * 10), 2)) { const s2 = slots['bubble0']; ctx.drawImage(atlas, s2[0], s2[1], 16, 16, tx * TILE - this.cx, ty * TILE - this.cy, 16, 16); continue; }
                }
                ctx.drawImage(atlas, s[0], s[1], 16, 16, tx * TILE - this.cx, ty * TILE - this.cy + dy, 16, 16);
            }
        }
    }

    objects(g, th, t) {
        const ctx = this.x;
        const X = v => Math.round(v - this.cx), Y = v => Math.round(v - this.cy);
        // castle and goal
        if (g.castle) this.spr('castle', X(g.castle.x * TILE - 16), Y((g.castle.y + 1) * TILE - 48));
        if (g.goal) {
            const gl = g.goal;
            this.spr('poleball', X(gl.x * TILE + 5), Y(gl.top * TILE - 4));
            this.spr('flag', X(gl.x * TILE - 8), Y(gl.flagY));
        }
        if (g.checkpoint) {
            const c = g.checkpoint;
            this.spr(c.on ? 'cp_on' : 'cp_off', X(c.x * TILE + 4), Y((c.y + 1) * TILE - 16));
        }
        // lifts
        for (const L of g.lifts) {
            const [d, m, l] = th.th.plat.map(col);
            const lx = X(L.x), ly = Y(L.y);
            this.rect(lx, ly, L.w, L.h, INK);
            this.rect(lx + 1, ly + 1, L.w - 2, L.h - 3, m);
            this.rect(lx + 1, ly + 1, L.w - 2, 1, l);
            this.rect(lx + 1, ly + L.h - 3, L.w - 2, 1, d);
            for (let i = 6; i < L.w; i += 12) this.rect(lx + i, ly + 3, 2, 2, d);
        }
        // firebars
        for (const f of g.firebars) {
            for (let i = 1; i <= f.len; i++) {
                const fx = X(f.cx + Math.cos(f.a) * i * 8), fy = Y(f.cy + Math.sin(f.a) * i * 8);
                this.rect(fx - 3, fy - 3, 7, 7, INK);
                this.rect(fx - 2, fy - 2, 5, 5, mod(Math.floor(t * 12 + i), 2) ? NES[0x16] : NES[0x27]);
                this.rect(fx - 1, fy - 1, 2, 2, NES[0x38]);
            }
        }
        // pickups
        for (const k of g.pickups) {
            const bob = Math.round(Math.sin(k.bob * 3) * 2);
            if (k.t === 'shard') {
                if (mod(Math.floor(t * 8 + k.x), 16) === 0 && !k.ghost) this.sparkle(X(k.x + 12), Y(k.y), '#FCFCFC');
                this.spr('shard', X(k.x - 2), Y(k.y - 2 + bob), false, k.ghost ? 0.4 : 1);
            } else {
                const name = k.t === 'gadget' ? 'i_' + k.item : 'i_' + k.item;
                const glow = 7 + Math.round(Math.sin(t * 6) * 2);
                ctx.globalAlpha = 0.35; ctx.fillStyle = NES[0x38];
                ctx.beginPath(); ctx.arc(X(k.x + k.w / 2), Y(k.y + k.h / 2 + bob), glow + 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
                this.spr(name, X(k.x + k.w / 2 - 8), Y(k.y + k.h / 2 - 8 + bob));
            }
        }
        // items
        for (const it of g.items) {
            let name = it.kind;
            if (it.kind === 'star') {
                const s = this.tinted('star', RAINBOW[mod(Math.floor(t * 12), RAINBOW.length)]);
                ctx.drawImage(s.c, X(it.x - 2), Y(it.y - 4));
                continue;
            }
            if (it.kind === 'plush') name = 'plush';
            this.spr(name, X(it.x - 2), Y(it.y - 4));
        }
    }

    sparkle(x, y, c) {
        this.rect(x - 2, y, 5, 1, c); this.rect(x, y - 2, 1, 5, c);
    }

    enemy(e, t) {
        const ctx = this.x;
        if (e.hidden && e.kind !== 'chomper') return;
        const X = Math.round(e.x - this.cx), Y = Math.round(e.y - this.cy);
        if (X < -40 || X > this.W + 40 || Y < -40 || Y > this.H + 40) return;
        let name, flip = e.dir < 0, dx = 0, dy = 0;
        const f2 = mod(Math.floor((t + e.x * 0.01) * 5), 2);
        switch (e.kind) {
            case 'bug': name = 'bug0'; flip = f2 === 1; dx = -2; dy = -4; break;
            case 'snail':
                if (e.state === 'walk') { name = 'snail0'; flip = e.dir > 0; dx = -2; dy = -4; }
                else { name = 'shell0'; dx = -2; dy = -4; if (e.state === 'shell' && e.t > 4.5) dx += mod(Math.floor(t * 20), 2); if (e.state === 'slide') flip = f2 === 1; }
                break;
            case 'frog': name = e.onGround ? 'frog0' : 'frog1'; dx = -2; dy = -4; flip = false; break;
            case 'bee': name = 'bee' + mod(Math.floor(t * 14), 2); flip = e.dir < 0; dx = -2; dy = -4; break;
            case 'prickle': name = 'prickle0'; flip = f2 === 1; dx = -2; dy = -4; break;
            case 'shroom': name = 'shroom0'; dx = -2; dy = e.puff > 0 ? -2 : -4; flip = false; break;
            case 'cactus': name = 'cactus0'; dx = -2; dy = -2; flip = e.puff > 0 && mod(Math.floor(t * 20), 2) === 1; break;
            case 'chomper': name = 'chomper' + mod(Math.floor(t * 4), 2); dx = -2; dy = 0; flip = false; break;
            case 'bat': name = e.state === 'sleep' ? 'bat1' : 'bat' + mod(Math.floor(t * 10), 2); dx = -2; dy = -3; flip = false; break;
            case 'glint': name = 'glint0'; dx = -1; dy = -4; flip = false; break;
            case 'drizzle': name = 'drizzle0'; dx = 0; dy = -2; flip = e.dir < 0; break;
            case 'crusher': name = 'crusher' + (e.state === 'wait' ? 0 : 1); dx = e.state === 'shake' ? mod(Math.floor(t * 30), 2) * 2 - 1 : 0; flip = false; break;
            case 'lavabub': name = 'lavabub0'; dx = -2; dy = -2; flip = false; break;
            default: return;
        }
        const s = this.art.spr[name];
        if (!s) return;
        if (e.mini) {
            ctx.drawImage(e.hurt > 0 ? s.white : s.c, X - 1, Y - 3, 12, 12);
        } else if (e.kind === 'lavabub' && e.vy > 0) {
            ctx.save(); ctx.translate(X + dx, Y + dy + 16); ctx.scale(1, -1); ctx.drawImage(s.c, 0, 0); ctx.restore();
        } else if (e.hurt > 0 && mod(Math.floor(t * 30), 2)) {
            ctx.drawImage(s.white, X + dx, Y + dy);
        } else {
            ctx.drawImage(flip ? s.flipped : s.c, X + dx, Y + dy);
        }
        if (e.frozen > 0) {
            const blink = e.frozen < 1.2 && mod(Math.floor(t * 12), 2);
            ctx.globalAlpha = blink ? 0.3 : 0.6;
            this.rect(X - 1, Y - 2, e.w + 2, e.h + 2, NES[0x2c]);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = NES[0x30]; ctx.lineWidth = 1;
            ctx.strokeRect(X - 0.5, Y - 1.5, e.w + 1, e.h + 1);
            this.rect(X + 1, Y, 3, 1, NES[0x30]); this.rect(X + 1, Y, 1, 3, NES[0x30]);
        }
    }

    boss(g, t) {
        const b = g.boss;
        const ctx = this.x;
        const X = Math.round(b.x - this.cx), Y = Math.round(b.y - this.cy);
        const flash = b.hurt > 0 && mod(Math.floor(t * 30), 2);
        if (b.dead && b.deadT > 2) return;
        if (b.dead && mod(Math.floor(t * 16), 2)) return;
        const draw = (name, x, y, flip) => {
            const s = this.art.spr[name]; if (!s) return;
            ctx.drawImage(flash ? s.white : flip ? s.flipped : s.c, Math.round(x), Math.round(y));
        };
        switch (b.kind) {
            case 'chompo': draw('chompo' + (b.state === 'crouch' ? 1 : mod(Math.floor(t * 4), 2)), X - 1, Y - 6, false); break;
            case 'sandsnake': {
                if (b.hidden) break;
                for (const p of b.def.parts(b).slice().reverse()) draw('snakeseg', p.x - 1 - this.cx, p.y - 1 - this.cy, false);
                draw('snakehead', X, Y, b.dir < 0);
                break;
            }
            case 'glimmerjaw': draw('glimmer' + (b.eye === 'open' ? 1 : 0), X, Y, false); break;
            case 'nimbus': {
                draw('nimbus' + (b.state === 'drift' ? 0 : 1), X, Y, b.dir < 0);
                if (b.bolts) {
                    const floor = g.arenaPx.floor - this.cy;
                    for (const bx of b.bolts) {
                        const sx = Math.round(bx - this.cx);
                        if (b.state === 'charge') {
                            if (mod(Math.floor(t * 16), 2)) for (let y = Y + b.h; y < floor; y += 6) this.rect(sx, y, 1, 3, NES[0x38]);
                        } else {
                            let px = sx;
                            for (let y = Y + b.h; y < floor; y += 6) {
                                const nx = sx + Math.round(Math.sin(y * 0.7 + t * 40) * 4);
                                this.rect(Math.min(px, nx) - 1, y, Math.abs(nx - px) + 3, 6, NES[0x38]);
                                this.rect(Math.min(px, nx), y, Math.abs(nx - px) + 1, 6, NES[0x30]);
                                px = nx;
                            }
                        }
                    }
                }
                break;
            }
            case 'grumblewort': draw('king' + (b.phase === 2 ? 1 : 0), X, Y, b.dir < 0); break;
        }
    }

    player(g, t) {
        const p = g.player;
        const ctx = this.x;
        if (p.hidden) return;
        if (p.invuln > 0 && !p.dead && mod(Math.floor(t * 20), 2)) return;
        let name;
        const gun = p.dead ? null : p.aim === 'up' ? 'up' : p.aim === 'diag' ? 'diag' : 'fwd';
        const gs = gun || 'none';
        if (p.dead) name = 'pip_hurt';
        else if (p.pounding) name = 'pip_pound';
        else if (p.wallDir !== 0 && !p.onGround && p.vy > 0) name = `pip_wall_${gs}`;
        else if (!p.onGround) name = `pip_${p.vy < 0 ? 'jump' : 'fall'}_${gs}`;
        else if (Math.abs(p.vx) > 12) name = `pip_run${mod(Math.floor(p.anim * (6 + Math.abs(p.vx) / 18)), 4)}_${gs}`;
        else name = mod(Math.floor(t * 0.5), 7) === 0 && mod(t, 2) < 0.15 ? `pip_blink_${gs}` : `pip_idle_${gs}`;
        const flip = p.wallDir !== 0 && !p.onGround && p.vy > 0 ? p.wallDir > 0 : p.facing < 0;
        const X = Math.round(p.x - this.cx) - 3, Y = Math.round(p.y - this.cy) - 2;
        let s = this.art.spr[name];
        if (p.star > 0) s = this.tinted(name, RAINBOW[mod(Math.floor(t * 14), RAINBOW.length)]);
        else if (p.pepper > 0 && mod(Math.floor(t * 8), 2)) s = this.tinted(name, NES[0x16]);
        if (p.dead) ctx.drawImage(s.c, X, Y);
        else ctx.drawImage(flip ? s.flipped : s.c, X, Y);
        if (p.fireFlash > 0 && !p.dead) {
            let mx = p.facing > 0 ? X + 16 : X - 1, my = Y + 10;
            if (p.aim === 'up') { mx = p.facing > 0 ? X + 11 : X + 4; my = Y - 1; }
            else if (p.aim === 'diag') { mx = p.facing > 0 ? X + 15 : X; my = Y + 3; }
            this.rect(mx - 2, my - 2, 5, 5, NES[0x38]);
            this.rect(mx - 1, my - 1, 3, 3, NES[0x30]);
        }
        if (p.shield) {
            ctx.strokeStyle = mod(Math.floor(t * 6), 2) ? NES[0x31] : NES[0x21];
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(X + 8.5, Y + 8.5, 11, 0, 7); ctx.stroke();
            this.rect(X + 2, Y - 1, 3, 1, NES[0x30]);
        }
    }

    shots(g, t) {
        const ctx = this.x;
        for (const s of g.shots) {
            const X = Math.round(s.x - this.cx), Y = Math.round(s.y - this.cy);
            if (s.kind === 'pea') { this.rect(X - 1, Y - 1, 7, 7, INK); this.rect(X, Y, 5, 5, NES[0x2a]); this.rect(X + 1, Y + 1, 2, 2, NES[0x39]); }
            else if (s.kind === 'spread') { this.rect(X - 1, Y - 1, 7, 7, INK); this.rect(X, Y, 5, 5, NES[0x28]); this.rect(X + 1, Y + 1, 2, 2, NES[0x30]); }
            else if (s.kind === 'frost') {
                this.rect(X - s.ux * 6 + 1, Y - s.uy * 6 + 1, 3, 3, NES[0x31]);
                this.rect(X - 1, Y + 2, 8, 2, INK); this.rect(X + 2, Y - 1, 2, 8, INK);
                this.rect(X, Y + 2, 6, 2, NES[0x3c]); this.rect(X + 2, Y, 2, 6, NES[0x3c]); this.rect(X + 2, Y + 2, 2, 2, NES[0x30]);
            } else {
                ctx.save();
                ctx.translate(X + 4, Y + 4); ctx.rotate(Math.atan2(s.uy, s.ux));
                this.rect(-6, -3, 12, 6, INK); this.rect(-5, -2, 9, 4, NES[0x30]); this.rect(2, -2, 3, 4, NES[0x16]);
                this.rect(-6, -3, 2, 1, NES[0x16]); this.rect(-6, 2, 2, 1, NES[0x16]);
                this.rect(-9, -1, 3, 2, mod(Math.floor(t * 30), 2) ? NES[0x28] : NES[0x27]);
                ctx.restore();
            }
        }
        for (const s of g.eshots) {
            const X = Math.round(s.x - this.cx), Y = Math.round(s.y - this.cy);
            switch (s.kind) {
                case 'spore': this.rect(X - 1, Y - 1, 8, 8, INK); this.rect(X, Y, 6, 6, NES[0x24]); this.rect(X + 1, Y + 1, 2, 2, NES[0x34]); break;
                case 'needle': this.rect(X, Y + 1, 8, 2, INK); this.rect(X + 1, Y + 1, 6, 1, NES[0x30]); break;
                case 'rain': this.rect(X, Y, 4, 6, INK); this.rect(X + 1, Y + 1, 2, 4, NES[0x21]); break;
                case 'sand': this.rect(X - 1, Y - 1, 8, 8, INK); this.rect(X, Y, 6, 6, NES[0x28]); break;
                case 'crystal': this.rect(X + 2, Y - 1, 2, 8, INK); this.rect(X - 1, Y + 2, 8, 2, INK); this.rect(X + 2, Y, 2, 6, NES[0x3c]); this.rect(X, Y + 2, 6, 2, NES[0x2c]); break;
                case 'fireball': this.rect(X - 1, Y - 1, 10, 10, INK); this.rect(X, Y, 8, 8, mod(Math.floor(t * 20), 2) ? NES[0x16] : NES[0x27]); this.rect(X + 2, Y + 2, 3, 3, NES[0x38]); break;
                case 'bomb': {
                    this.rect(X - 1, Y - 1, 12, 12, INK);
                    this.rect(X, Y, 10, 10, s.fuse < 0.4 && mod(Math.floor(t * 20), 2) ? NES[0x16] : NES[0x2d]);
                    this.rect(X + 2, Y + 2, 2, 2, NES[0x10]);
                    this.rect(X + 6, Y - 3, 2, 3, NES[0x28]);
                    break;
                }
                case 'wave': ctx.strokeStyle = NES[0x30]; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X + 6, Y + 12, 6 + mod(Math.floor(t * 20), 3), Math.PI, 0); ctx.stroke(); break;
                case 'blast': break;
            }
        }
    }

    particles(g, t) {
        const ctx = this.x;
        for (const q of g.parts) {
            const X = Math.round(q.x - this.cx), Y = Math.round(q.y - this.cy);
            const a = q.life / q.max;
            switch (q.k) {
                case 'dust': this.rect(X, Y, 2, 2, a > 0.5 ? NES[0x30] : NES[0x10]); break;
                case 'pop': this.rect(X, Y, 2, 2, a > 0.5 ? NES[0x30] : NES[0x28]); break;
                case 'ice': this.rect(X, Y, 2, 2, a > 0.5 ? NES[0x30] : NES[0x3c]); break;
                case 'ember': this.rect(X, Y, 2, 2, a > 0.5 ? NES[0x38] : NES[0x16]); break;
                case 'rock': this.rect(X, Y, 3, 3, a > 0.5 ? NES[0x16] : NES[0x07]); break;
                case 'smoke': ctx.globalAlpha = a * 0.7; this.rect(X - 1, Y - 1, 3, 3, NES[0x10]); ctx.globalAlpha = 1; break;
                case 'star': this.sparkle(X, Y, a > 0.5 ? NES[0x30] : NES[0x28]); break;
                case 'sparkle': this.sparkle(X, Y, NES[0x30]); break;
                case 'spark': this.rect(X - 2, Y - 2, 5, 5, NES[0x30]); break;
                case 'ring': { ctx.strokeStyle = NES[0x30]; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, (1 - a) * 14 + 2, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; break; }
                case 'boom': {
                    const r = (1 - a) * 18 + 4;
                    ctx.fillStyle = a > 0.66 ? NES[0x30] : a > 0.33 ? NES[0x38] : NES[0x27];
                    ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
                    break;
                }
                case 'debris': this.rect(X - 2, Y - 2, 4, 4, INK); this.rect(X - 1, Y - 1, 3, 3, NES[0x17]); break;
                case 'coinpop': { const s = this.art.spr['coin' + mod(Math.floor(t * 16), 3)]; if (s) ctx.drawImage(s.c, X, Y); break; }
                case 'text': this.text(q.text, X, Y, NES[0x30], 'c'); break;
                case 'squash': {
                    const name = q.kind === 'snail' ? 'shell0' : q.kind + '0';
                    const s = this.art.spr[name]; if (!s) break;
                    ctx.drawImage(s.c, 0, 0, 16, 16, X - 2, Y + q.h - 8, 16, 8);
                    break;
                }
                case 'flip': {
                    const name = q.kind === 'snail' ? 'shell0' : q.kind + '0';
                    const s = this.art.spr[name]; if (!s) break;
                    ctx.save(); ctx.translate(X - 2, Y + 12); ctx.scale(1, -1); ctx.drawImage(s.c, 0, 0); ctx.restore();
                    break;
                }
            }
        }
    }

    // ---------------------------------------------------- HUD
    hud(g, profile, run, extra = {}) {
        const W = this.W;
        const p = g.player;
        const top = extra.top || 0;
        // hearts
        const maxH = profile.maxHearts;
        for (let i = 0; i < maxH; i++) {
            const name = i < p.hp ? 'hs' : 'he';
            this.spr(name, 4 + i * 8, 4 + top);
        }
        if (p.shield) this.spr('hb', 4 + maxH * 8, 4 + top);
        // coins + lives
        this.spr('cs', 4, 14 + top);
        this.text('x' + String(run.coins).padStart(2, '0'), 11, 14 + top);
        this.text('PIP x' + run.lives, 36, 14 + top);
        // right: score + time (kept clear of a floating pause button)
        const RX = W - 4 - (extra.right || 0);
        this.text(String(run.score).padStart(7, '0'), RX, 4 + top, '#FCFCFC', 'r');
        this.text('T' + String(Math.ceil(g.time)).padStart(3, '0'), RX, 14 + top, g.time < 60 && g.time > 0 ? NES[0x28] : '#FCFCFC', 'r');
        // centre: shards for this level + weapon
        const cx = Math.round(W / 2);
        if (!g.level.castle) {
            for (let i = 0; i < 3; i++) {
                const got = g.gotShards.has(i) || profile.shards.has(`${g.level.world}-${g.level.index}-${i}`);
                this.spr(got ? 'ss' : 'se', cx - 14 + i * 10, 4 + top);
            }
        }
        const wk = profile.weapons[p.weaponIdx] || 'pea';
        if (profile.weapons.length > 1 || W > 260) {
            const wx = W > 300 ? cx + 22 : cx - 8;
            const wy = W > 300 ? 1 + top : 13 + top;
            if (W > 300) { this.spr(WEAPONS[wk].icon, wx, wy); this.text(WEAPONS[wk].name, wx + 18, wy + 5, NES[0x38]); }
            else this.text(WEAPONS[wk].name, cx, 14 + top, NES[0x38], 'c');
        }
        if (p.star > 0 || p.pepper > 0) {
            const label = p.star > 0 ? 'STAR ' + Math.ceil(p.star) : 'HOT ' + Math.ceil(p.pepper);
            this.text(label, cx, 24 + top, p.star > 0 ? RAINBOW[mod(Math.floor(g.t * 10), 6)] : NES[0x16], 'c');
        }
        // boss bar
        const b = g.boss;
        if (b && !(b.dead && b.deadT > 2)) {
            const bw = Math.min(160, W - 40), bx = Math.round((W - bw) / 2), by = this.H - 14 - (extra.bottom || 0);
            this.text(b.def.name, W / 2, by - 9, NES[0x38], 'c');
            this.rect(bx - 1, by - 1, bw + 2, 7, INK);
            this.rect(bx, by, bw, 5, NES[0x00]);
            this.rect(bx, by, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 5, NES[0x16]);
            this.rect(bx, by, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 1, NES[0x26]);
        }
    }
}
