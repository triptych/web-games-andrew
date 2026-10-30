// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
//
// Everything is drawn into a 224×288 pixel buffer (the "8-bit screen") with smoothing off. A cheap
// bloom is added inside the buffer, the HUD is drawn crisp on top, and the buffer is scaled up to the
// window (an integer nearest-neighbour step, then a gentle bilinear one for fractional sizes), with
// scanlines and a neon frame on top. The view may use Math.random: effects are not part of the game.

import { FIELD, SCORE, WAVE, PLAYER } from '../config.js';
import { makeSprites, CAPSULES } from './sprites.js';
import { Fx, Starfield, SECTORS, RAMPS, disc, ring } from './fx.js';
import { drawText, textWidth } from './font.js';
import { BOSS_NAMES } from '../sim/bosses.js';

const BW = FIELD.w, BH = FIELD.h;
const TOP_BAND = 44;                       // CSS px kept clear for the back link and the pause button
const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');
const CAP_COLOR = { P: '#ff4d4d', S: '#4d9dff', B: '#4cdc4c', H: '#29e5ff', '1': '#ff5ec8', M: '#ffc400' };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const sectorOf = (wave) => Math.floor(Math.max(0, wave - 1) / WAVE.bossEvery) % SECTORS.length;

export class View {
    constructor(el) {
        this.canvas = el;
        this.ctx = el.getContext('2d');
        this.buf = canvas(BW, BH);
        this.b = this.buf.getContext('2d');
        this.b.imageSmoothingEnabled = false;
        this.g1 = canvas(BW / 2, BH / 2);
        this.g2 = canvas(BW / 4, BH / 4);
        this.up = canvas(BW, BH);
        this.sprites = makeSprites();
        this.fx = new Fx();
        this.stars = new Starfield();
        this.opts = { crt: true, calm: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false };
        this.fx.calm = this.opts.calm;
        this.time = 0;
        this.clearInfo = null;
        this.toast = null;
        this.overlay = null;
        this.w = this.h = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setOptions(o) {
        Object.assign(this.opts, o);
        this.fx.calm = this.opts.calm;
        this.overlay = null;
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        // CSS size in px, never 100vw/100vh; backing store at device pixels.
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        // The field is fitted under the top band. On a tall (phone) screen it sits at the top so the
        // space below is free for thumbs; otherwise it is centred.
        const availH = h - TOP_BAND - 4;
        const s = Math.max(0.5, Math.min(w / BW, availH / BH));
        this.scale = s;
        this.dw = Math.round(BW * s);
        this.dh = Math.round(BH * s);
        this.ox = Math.round((w - this.dw) / 2);
        this.oy = h > w * 1.15 ? TOP_BAND : TOP_BAND + Math.max(0, Math.round((availH - this.dh) / 2));
        const dev = s * dpr;
        this.k = Math.max(1, Math.ceil(dev - 0.02));                  // integer step up, then a small bilinear step down
        this.up.width = BW * this.k;
        this.up.height = BH * this.k;
        this.overlay = null;
    }

    /** Screen (client) px → buffer pixels, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const fx = this.fx;
        for (const e of events) {
            switch (e.type) {
                case 'boom': fx.boom(e.x, e.y, e.size, e.c); break;
                case 'pdie': fx.shipDeath(e.x, e.y); break;
                case 'ehit': if (!e.boss || this.time - (this.lastBossSpark || 0) > 0.06) { this.lastBossSpark = this.time; fx.hit(e.x + (e.boss ? (Math.random() - 0.5) * 30 : 0), e.y + (e.boss ? 6 : 0), e.boss); } break;
                case 'cancel': fx.cancel(e.x, e.y); break;
                case 'bomb': fx.bomb(e.x, e.y); break;
                case 'pickup': fx.pickup(e.x, e.y, CAP_COLOR[e.kind]); break;
                case 'medal': fx.popup(e.x, e.y - 8, String(e.value), '#ffc400'); break;
                case 'popup': if (e.text.length >= 4) fx.popup(e.x, e.y, e.text, e.text.length >= 5 ? '#ffec27' : '#ffffff'); break;
                case 'shieldbreak': fx.shock(e.x, e.y, 24, 0.4, RAMPS.ice, 2); fx.debris(e.x, e.y, 14, 80, 0.5, RAMPS.ice); break;
                case 'wave': this.stars.setSector(sectorOf(e.n)); this.clearInfo = null; break;
                case 'waveclear': this.clearInfo = e; if (e.perfect) fx.shock(BW / 2, 110, 100, 0.8, RAMPS.rainbow, 3); break;
                case 'bossdown': fx.flashScreen(0.4, '#fff6a0'); fx.kick(6); break;
                case 'beam': fx.kick(2.5); break;
                case '1up': this.toast = { text: '1UP!', t: 0 }; break;
            }
        }
    }

    // ------------------------------------------------------------------ the frame
    /** st: { mode: 'title' | 'play' | 'over', hi, paused } */
    frame(G, dt, st) {
        this.resize();
        if (st.paused) dt = 0;
        this.time += dt;
        const t = this.time, g = this.b;

        const warp = G.phase === 'dock' ? (G.dock?.st === 'shop' ? 1.5 : 3.4) : G.phase === 'clear' ? 4.5 : (G.plan?.kind === 'boss' && G.phase === 'intro') ? 2.4 : 1;
        if (this.stars.sector < 0) this.stars.setSector(sectorOf(G.wave));
        this.stars.update(dt, warp);
        this.fx.update(dt);
        if (this.toast) { this.toast.t += dt; if (this.toast.t > 1.6) this.toast = null; }

        this.stars.draw(g, t);
        this.drawMother(G, g, t);
        this.drawPowerups(G, g, t);
        this.drawEnemies(G, g, t);
        this.drawBeams(G, g, t);
        this.drawPlayerShots(G, g);
        this.drawPlayer(G, g, t);
        this.drawEnemyShots(G, g, t);
        this.drawBomb(G, g, t);
        this.fx.draw(g);
        this.bloom();
        if (this.fx.flash > 0.01) { g.fillStyle = this.fx.flashColor; g.globalAlpha = this.fx.flash; g.fillRect(0, 0, BW, BH); g.globalAlpha = 1; }
        this.fx.drawPopups(g);
        this.drawBanner(G, g, t);
        this.drawHud(G, g, t, st);
        this.present();
    }

    // ------------------------------------------------------------------ layers
    /** `flash` 0..1 lays the white silhouette over the sprite: a hit shows, but never hides the sprite. */
    drawSprite(g, spr, x, y, flash = 0) {
        const px = Math.round(x - spr.w / 2), py = Math.round(y - spr.h / 2);
        g.drawImage(spr.img, px, py);
        if (flash > 0 && spr.white) { g.globalAlpha = flash; g.drawImage(spr.white, px, py); g.globalAlpha = 1; }
    }

    /** After a boss: the mothership slides in from the top, a tractor beam draws the ship up to it, and it slides away on launch. */
    drawMother(G, g, t) {
        const d = G.dock;
        if (G.phase !== 'dock' || !d) return;
        const spr = this.sprites.mother;
        const u = d.st === 'approach' ? Math.min(1, d.t / 0.9) : d.st === 'launch' ? 1 - Math.min(1, d.t / 0.6) : 1;
        const e = 1 - (1 - u) * (1 - u), cy = -26 + 62 * e, x = Math.round(BW / 2 - spr.w / 2), y = Math.round(cy - spr.h / 2);
        g.drawImage(spr.img, x, y);
        const mouthY = y + 30, mouthX = BW / 2;
        // guide lights along the mouth
        for (let i = -2; i <= 2; i++) { g.fillStyle = ((t * 6 + i) | 0) % 2 ? '#ffec27' : '#ff004d'; g.fillRect(Math.round(mouthX + i * 6), mouthY + 11, 2, 1); }
        if (d.st !== 'launch' && u >= 1) {
            // the tractor beam: dotted lines from the mouth to the ship, scrolling upward
            const p = G.player, top = mouthY + 12;
            for (const side of [-1, 1]) {
                const x0 = mouthX + side * 12, x1 = p.x + side * 8;
                for (let k = 0; k < 9; k++) {
                    const f = (k + ((t * 5) % 1)) / 9, px = x0 + (x1 - x0) * f, py = top + (p.y - 8 - top) * f;
                    if (py > p.y - 6) continue;
                    g.fillStyle = k % 2 ? '#29e5ff' : '#b4f0ff'; g.fillRect(Math.round(px), Math.round(py), 1, 2);
                }
            }
        }
    }

    drawPowerups(G, g, t) {
        const S = this.sprites;
        for (const u of G.powerups) {
            const bob = Math.sin(t * 5 + u.x) * 1.2;
            if (u.kind === 'M') {
                const f = S.medal[Math.floor(t * 9 + u.x) % 4];
                g.drawImage(f, Math.round(u.x - f.width / 2), Math.round(u.y + bob - f.height / 2));
                if (((t * 8 + u.x) | 0) % 6 === 0) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(u.x + 4), Math.round(u.y - 5), 1, 1); }
                continue;
            }
            const c = S.capsule[u.kind];
            if (!c) continue;
            const x = Math.round(u.x - c.width / 2), y = Math.round(u.y + bob - c.height / 2);
            g.drawImage(c, x, y);
            drawText(g, u.kind, u.x + 0.5, u.y + bob - 3, '#ffffff', { align: 'c', shadow: '#05051a' });
            if (((t * 6 + u.x) | 0) % 5 === 0) { g.fillStyle = '#ffffff'; g.fillRect(x + 3, y + 2, 2, 1); }
        }
    }

    drawEnemies(G, g, t) {
        const S = this.sprites, skin = S.enemy[sectorOf(G.wave) % S.enemy.length];
        for (const e of G.enemies) {
            if (e.dead) continue;
            const x = e.x, y = e.y;
            if (e.type === 'boss') { this.drawBoss(g, e, t); continue; }
            const frames = skin[e.type];
            if (!frames) continue;
            const spr = frames[Math.floor(t * 4 + e.id) & 1], flash = e.hitT > 0 ? 0.85 : 0;
            if (e.carry) {
                // a pulsing halo in the colour of the capsule it carries
                if (((t * 5) | 0) % 2) ring(g, x, y, Math.max(spr.w, spr.h) / 2 + 2, 1, CAP_COLOR[e.carry] || '#ffffff');
            }
            if (e.type === 'weaver') {
                g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(1, -1);
                g.drawImage(flash ? spr.white : spr.img, -Math.round(spr.w / 2), -Math.round(spr.h / 2)); g.restore();
            } else if (e.type === 'dart') {
                g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate((e.ang ?? Math.PI / 2) + Math.PI / 2);
                g.drawImage(flash ? spr.white : spr.img, -Math.round(spr.w / 2), -Math.round(spr.h / 2)); g.restore();
            } else this.drawSprite(g, spr, x, y, flash);
            if (e.type === 'mine' && ((t * 6 + e.id) | 0) % 2) { g.fillStyle = '#ff004d'; g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1); }
        }
    }

    drawBoss(g, e, t) {
        const b = e.boss, frames = this.sprites.boss[b.idx], spr = frames[Math.floor(t * 3) & 1];
        let flash = e.hitT > 0 ? 0.4 : 0;
        if (b.st === 'dying') flash = ((t * 24) | 0) % 2 === 0 ? 0.9 : 0.2;
        const spark = e.hp / e.maxHp < 0.35 && b.st !== 'dying' && Math.random() < 0.08;
        if (spark) this.fx.hit(e.x + (Math.random() - 0.5) * e.r * 1.6, e.y + (Math.random() - 0.5) * 10, true);
        if (b.st === 'enter' && ((t * 12) | 0) % 2) flash = 0.8;         // a flicker as it drops in
        // the sprite is wider than it is tall; its hit circles are drawn from the sprite's own centre
        this.drawSprite(g, spr, e.x, e.y + 2, flash);
    }

    drawBeams(G, g, t) {
        for (const e of G.enemies) {
            const bm = e.beam;
            if (!bm || e.dead) continue;
            const y0 = Math.round(e.y + 10);
            if (!bm.on) {
                // a warning line, with the edges of the coming beam marked in dashes
                g.fillStyle = ((t * 14) | 0) % 2 ? '#ff004d' : '#ffffff';
                g.fillRect(Math.round(bm.x), y0, 1, BH - y0);
                g.fillStyle = '#ff004d';
                for (let y = y0; y < BH; y += 5) { g.fillRect(Math.round(bm.x - 10), y, 1, 2); g.fillRect(Math.round(bm.x + 10), y, 1, 2); }
                if (((t * 8) | 0) % 2) disc(g, bm.x, y0, 3, '#ffffff');
            } else {
                const hw = bm.w / 2, x = Math.round(bm.x - hw), w = Math.round(bm.w);
                const cols = ['#29e5ff', '#ff5ec8', '#ffec27', '#4cdc4c'];
                g.fillStyle = cols[((t * 20) | 0) % cols.length]; g.fillRect(x - 1, y0, w + 2, BH - y0);
                g.fillStyle = cols[(((t * 20) | 0) + 2) % cols.length]; g.fillRect(x + 2, y0, w - 4, BH - y0);
                g.fillStyle = '#ffffff'; g.fillRect(x + (w >> 2) + 1, y0, Math.max(1, w >> 1) - 1, BH - y0);
                for (let i = 0; i < 6; i++) { g.fillStyle = '#ffffff'; g.fillRect(x - 3 + Math.floor(Math.random() * (w + 6)), y0 + Math.floor(Math.random() * (BH - y0)), 1, 3); }
                disc(g, bm.x, y0 + 2, hw + 2, '#ffffff');
            }
        }
    }

    drawPlayerShots(G, g) {
        const S = this.sprites;
        for (const b of G.pbullets) {
            const spr = S.pbullet[b.k] || S.pbullet[0];
            g.drawImage(spr.img, Math.round(b.x - spr.w / 2), Math.round(b.y - spr.h / 2));
        }
    }

    drawPlayer(G, g, t) {
        const p = G.player, S = this.sprites;
        if (!p.alive) return;
        if (p.inv > 0 && !G.bombFx && G.phase !== 'dock' && ((t * 16) | 0) % 2) return;                // blinks while invulnerable
        const spr = p.bank > 0.35 ? S.ship.r : p.bank < -0.35 ? S.ship.l : S.ship.c;
        const fl = S.flame[(t * 20) & 1];
        g.drawImage(fl.img, Math.round(p.x - fl.w / 2), Math.round(p.y + 6));
        this.drawSprite(g, spr, p.x, p.y);
        if (p.shield) {
            const r = 12 + Math.sin(t * 9);
            ring(g, p.x, p.y, r, 1, ((t * 10) | 0) % 2 ? '#29e5ff' : '#b4f0ff');
            if (((t * 6) | 0) % 3 === 0) ring(g, p.x, p.y, r - 2, 1, '#1d5fd1');
        }
    }

    drawEnemyShots(G, g, t) {
        const S = this.sprites;
        for (const b of G.ebullets) {
            const spr = S.ebullet[b.k] || S.ebullet[0];
            if (b.k === 2) {
                // needles point along their flight
                g.save(); g.translate(Math.round(b.x), Math.round(b.y)); g.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
                g.drawImage(spr.img, -Math.round(spr.w / 2), -Math.round(spr.h / 2)); g.restore();
            } else g.drawImage(spr.img, Math.round(b.x - spr.w / 2), Math.round(b.y - spr.h / 2));
        }
    }

    drawBomb(G, g, t) {
        const fx = G.bombFx;
        if (!fx) return;
        const u = fx.t / 0.85, cols = RAMPS.rainbow;
        // a stack of rainbow rings, each a step behind the last
        for (let i = 0; i < 6; i++) {
            const r = fx.r - i * 6;
            if (r < 2) continue;
            ring(g, fx.x, fx.y, r, 3, cols[(i + ((t * 12) | 0)) % cols.length]);
        }
        if (u < 0.5) { g.globalAlpha = 0.18 * (1 - u * 2); disc(g, fx.x, fx.y, fx.r, '#ffffff'); g.globalAlpha = 1; }
    }

    /** A cheap bloom: the buffer, blurred twice by downscaling, added back on itself. */
    bloom() {
        const g = this.b;
        const a = this.g1.getContext('2d'), c = this.g2.getContext('2d');
        a.imageSmoothingEnabled = c.imageSmoothingEnabled = true;
        a.clearRect(0, 0, BW / 2, BH / 2); c.clearRect(0, 0, BW / 4, BH / 4);
        a.drawImage(this.buf, 0, 0, BW / 2, BH / 2);
        c.drawImage(this.g1, 0, 0, BW / 4, BH / 4);
        g.imageSmoothingEnabled = true;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.34; g.drawImage(this.g2, 0, 0, BW, BH);
        g.globalAlpha = 0.18; g.drawImage(this.g1, 0, 0, BW, BH);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
    }

    // ------------------------------------------------------------------ text layers
    drawBanner(G, g, t) {
        const plan = G.plan, cx = BW / 2;
        const slide = (u) => Math.round((1 - Math.min(1, u * 4)) ** 2 * 60);      // glides in from the right
        if (G.over) return;
        if (G.endT > 0) {
            if (((t * 3) | 0) % 2 === 0 || G.endT < 1) drawText(g, 'GAME OVER', cx, 112, '#ff004d', { scale: 3, align: 'c', shadow: '#05051a' });
            return;
        }
        if (G.phase === 'intro' && plan) {
            const u = G.phaseT, off = slide(u);
            if (plan.kind === 'boss') {
                if (((t * 5) | 0) % 2 === 0) drawText(g, 'WARNING!', cx, 84, '#ff004d', { scale: 3, align: 'c', shadow: '#05051a' });
                drawText(g, BOSS_NAMES[plan.boss.idx], cx + off, 116, '#ffec27', { scale: 2, align: 'c', shadow: '#05051a' });
                drawText(g, 'A HUGE SIGNAL APPROACHES', cx, 140, '#ffffff', { align: 'c', shadow: '#05051a' });
            } else if (plan.kind === 'bonus') {
                drawText(g, 'BONUS STAGE', cx + off, 96, '#ffec27', { scale: 3, align: 'c', shadow: '#c4122e' });
                drawText(g, 'NO ENEMY FIRE!', cx, 126, '#29e5ff', { scale: 1, align: 'c', shadow: '#05051a' });
                drawText(g, 'SHOOT THEM ALL FOR A BONUS', cx, 138, '#ffffff', { align: 'c', shadow: '#05051a' });
            } else {
                drawText(g, 'WAVE ' + G.wave, cx + off, 96, '#29e5ff', { scale: 3, align: 'c', shadow: '#1d2b53' });
                const first = (G.wave - 1) % WAVE.bossEvery === 0;
                const sub = G.wave === 1 ? 'GET READY!' : first ? 'SECTOR ' + (sectorOf(G.wave) + 1) + ' - ' + SECTORS[sectorOf(G.wave)].name : '';
                if (sub) drawText(g, sub, cx, 126, '#ffec27', { align: 'c', shadow: '#05051a' });
            }
        } else if (G.phase === 'dock' && G.dock) {
            if (G.dock.st === 'approach') drawText(g, 'RETURNING TO MOTHERSHIP', cx, 150, '#29e5ff', { align: 'c', shadow: '#05051a' });
            else if (G.dock.st === 'launch') drawText(g, 'LAUNCH!', cx, 140, '#ffec27', { scale: 3, align: 'c', shadow: '#c4122e' });
        } else if (G.phase === 'clear' && G.phaseT < WAVE.clear - 0.3) {
            const info = this.clearInfo, perfect = info?.perfect, kind = plan?.kind;
            const title = kind === 'boss' ? 'BOSS DESTROYED!' : kind === 'bonus' ? 'BONUS STAGE CLEAR' : 'WAVE ' + G.wave + ' CLEAR';
            drawText(g, title, cx, 92, kind === 'boss' ? '#ffec27' : '#29e5ff', { scale: kind === 'boss' ? 2 : 1, align: 'c', shadow: '#05051a' });
            if (perfect && (((t * 5) | 0) % 2 === 0 || G.phaseT > 1.5)) {
                drawText(g, 'PERFECT!', cx, 108, '#ffec27', { scale: 3, align: 'c', shadow: '#c4122e' });
                drawText(g, '+' + info.bonus + (kind === 'bonus' ? '  +1 BOMB' : ''), cx, 136, '#ffffff', { align: 'c', shadow: '#05051a' });
            } else if (kind === 'bonus' && info) {
                drawText(g, info.killed + '/' + info.total + ' HIT', cx, 110, '#ffffff', { align: 'c', shadow: '#05051a' });
            }
        }
        if (this.toast) drawText(g, this.toast.text, 40, BH - 24, ((this.toast.t * 8) | 0) % 2 ? '#ffec27' : '#ffffff', { scale: 2, shadow: '#05051a' });
    }

    drawHud(G, g, t, st) {
        const red = '#ff004d', white = '#ffffff', cyan = '#29e5ff', yellow = '#ffec27';
        // top: 1UP score, hi-score, wave and chain
        drawText(g, '1UP', 4, 3, ((t * 2) | 0) % 2 || st.mode !== 'play' ? red : '#7a0a2a');
        drawText(g, pad6(G.score), 4, 12, white);
        drawText(g, 'HI-SCORE', BW / 2, 3, red, { align: 'c' });
        drawText(g, pad6(Math.max(st.hi || 0, G.score)), BW / 2, 12, white, { align: 'c' });
        drawText(g, 'WAVE ' + String(G.wave).padStart(2, '0'), BW - 4, 3, cyan, { align: 'r' });
        const mult = 1 + Math.min(SCORE.chainMax - 1, Math.floor(G.chain / SCORE.chainPer));
        if (G.chain > 1) {
            drawText(g, 'CHAIN ' + G.chain, BW - 4, 12, mult > 1 ? yellow : white, { align: 'r' });
            const u = Math.max(0, Math.min(1, G.chainT / SCORE.chainWindow));
            g.fillStyle = '#1d2b53'; g.fillRect(BW - 4 - 36, 21, 36, 2);
            g.fillStyle = mult > 1 ? yellow : cyan; g.fillRect(BW - 4 - 36, 21, Math.round(36 * u), 2);
            if (mult > 1) drawText(g, 'x' + mult, BW - 4 - textWidth('CHAIN ' + G.chain) - 6, 12, yellow, { align: 'r' });
        }
        // boss health
        const boss = G.enemies.find((e) => e.boss && !e.dead);
        if (boss) {
            const w = 150, x = (BW - w) / 2, f = Math.max(0, boss.hp / boss.maxHp);
            g.fillStyle = '#05051a'; g.fillRect(x - 1, 25, w + 2, 6);
            g.fillStyle = '#7a0a2a'; g.fillRect(x, 26, w, 4);
            g.fillStyle = f > 0.33 ? '#ff4d4d' : ((t * 8) | 0) % 2 ? '#ffec27' : '#ff004d';
            g.fillRect(x, 26, Math.round(w * f), 4);
            g.fillStyle = '#ffffff'; g.fillRect(x, 26, Math.round(w * f), 1);
        }
        // bottom: lives, power, bombs
        const y = BH - 11, S = this.sprites;
        const showLives = Math.max(0, G.lives - (G.player.alive ? 1 : 0));
        for (let i = 0; i < Math.min(showLives, 5); i++) g.drawImage(S.lifeIcon, 3 + i * 10, y - 2);
        if (showLives > 5) drawText(g, '+' + (showLives - 5), 3 + 5 * 10 + 1, y, white);
        const px = BW / 2 - 21;
        drawText(g, 'PWR', px, y, '#ff8a00');
        for (let i = 0; i < PLAYER.maxWeapon; i++) { g.fillStyle = i < G.player.weapon ? '#ff4d4d' : '#3a1a3a'; g.fillRect(px + 20 + i * 4, y + 1, 3, 5); }
        for (let i = 0; i < Math.min(G.bombs, 8); i++) g.drawImage(S.bombIcon, BW - 12 - i * 11, y - 2);
        drawText(g, 'CR ' + G.credits, BW - 4, y - 11, '#29e5ff', { align: 'r' });
        if (st.mode === 'title' && ((t * 1.6) | 0) % 2 === 0) drawText(g, 'DEMO PLAY', BW / 2, BH - 24, yellow, { align: 'c', shadow: '#05051a' });
    }

    // ------------------------------------------------------------------ put it on the screen
    present() {
        const ctx = this.ctx, dpr = this.dpr;
        const ug = this.up.getContext('2d');
        ug.imageSmoothingEnabled = false;
        ug.drawImage(this.buf, 0, 0, this.up.width, this.up.height);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#05010f';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const dx = this.ox * dpr, dy = this.oy * dpr, dw = this.dw * dpr, dh = this.dh * dpr;
        ctx.imageSmoothingEnabled = Math.abs(this.k - this.scale * dpr) > 0.02;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
        const sh = this.fx.shake, sx = sh ? Math.round((Math.random() - 0.5) * sh * this.scale * dpr * 1.6) : 0, sy = sh ? Math.round((Math.random() - 0.5) * sh * this.scale * dpr * 1.6) : 0;
        ctx.drawImage(this.up, dx + sx, dy + sy, dw, dh);
        ctx.restore();

        if (!this.overlay) this.overlay = this.bakeOverlay();
        ctx.drawImage(this.overlay, 0, 0);
    }

    /** Neon frame, scanlines and a vignette, baked once per size. */
    bakeOverlay() {
        const c = canvas(this.canvas.width, this.canvas.height), g = c.getContext('2d'), dpr = this.dpr;
        const x = this.ox * dpr, y = this.oy * dpr, w = this.dw * dpr, h = this.dh * dpr;
        if (this.opts.crt) {
            const step = (this.scale * dpr);
            if (step >= 2.4) {
                g.fillStyle = 'rgba(0,0,0,0.2)';
                const th = Math.max(1, Math.round(step * 0.34));
                for (let r = 0; r < BH; r++) g.fillRect(x, Math.round(y + (r + 1) * step - th), w, th);
            }
            const v = g.createRadialGradient(x + w / 2, y + h / 2, h * 0.35, x + w / 2, y + h / 2, h * 0.78);
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
            g.fillStyle = v; g.fillRect(x, y, w, h);
        }
        g.save();
        g.shadowColor = '#29e5ff'; g.shadowBlur = 14 * dpr;
        g.strokeStyle = '#29e5ff'; g.lineWidth = Math.max(1, Math.round(1.5 * dpr));
        g.strokeRect(x - 2 * dpr, y - 2 * dpr, w + 4 * dpr, h + 4 * dpr);
        g.restore();
        return c;
    }
}
