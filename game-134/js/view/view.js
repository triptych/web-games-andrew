// The Canvas 2D view: reads G every frame and turns sim events into cartoon effects. Never changes G.
// The level is wider than the screen: the camera follows the saucer sideways and always shows the
// whole height, sky to dirt; spare height on a tall phone goes to sky above and dirt below.

import { GROUND, WORLD_H, MOTHER, UFO, CEIL, BEAM } from '../config.js';
import { SPECIMENS, ENEMIES, SHOTS, LEVELS, PICKUPS } from '../sim/data.js';
import { hash3 } from '../rng.js';
import * as S from './sprites.js';
import { drawBackdrop, drawFence } from './scenery.js';
import * as art from './art.js';

// How tall each painted sprite is drawn, in world units (walkers stand on their feet, the rest are centred).
const SPR_H = {
    cow: 1.45, golden: 1.5, chicken: 0.85, pig: 1.1, sheep: 1.15, farmer: 2.0, townie: 2.0,
    gunner: 2.0, agent: 2.05, tinfoil: 2.15, tank: 1.9, laser: 1.95, boss: 4.4, jet: 1.15,
};

/** Draw a painted sprite with its feet at the origin, facing right unless flipped. */
function spr(ctx, img, hgt, flip = false) {
    const w = hgt * img.width / img.height;
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -hgt, w, hgt);
    return w;
}

const MIN_VIEW_W = 15;          // a portrait phone still sees at least this many units across
const VIEW_TOP = -3.3;          // the camera shows from here (Mother's dome pokes above y = 0)...
const VIEW_BOT = 19.4;          // ...to here (a strip of dirt under the grass)
const FONT = '"Luckiest Guy", "Bangers", Impact, "Arial Black", sans-serif';
const SAY = {
    cow: 'MOO!', chicken: 'BAWK!', pig: 'OINK!', sheep: 'BAA!', farmer: 'YEEP!', townie: 'EEK!',
    golden: 'MOO-LAH!', gunner: 'HEY!', agent: 'NOT COOL!', tinfoil: 'I KNEW IT!',
};
const DRAW = {
    cow: S.cow, golden: (c, o) => S.cow(c, { ...o, gold: true }), chicken: S.chicken, pig: S.pig, sheep: S.sheep,
    farmer: S.farmer, townie: S.townie, gunner: S.gunner, agent: S.agent, tinfoil: S.tinfoil,
};

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camX = 0;
        this.shake = 0;
        this.flash = 0;
        this.parts = [];
        this.pops = [];
        this.quality = 1;
        art.preload();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
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
        const viewH = VIEW_BOT - VIEW_TOP;
        this.s = Math.min(h / viewH, w / MIN_VIEW_W);             // px per world unit
        const spare = h / this.s - viewH;                         // extra units of height on tall screens
        this.oy = (spare * 0.55 - VIEW_TOP) * this.s;             // screen y of world y = 0
    }

    /** Screen px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (clientX - r.left) / this.s + this.camX, y: (clientY - r.top - this.oy) / this.s };
    }
    /** World → screen px (CSS). */
    toScreen(x, y) { return { x: (x - this.camX) * this.s, y: this.oy + y * this.s }; }

    // ------------------------------------------------------------------ events → effects
    pop(text, x, y, col = '#ffe14d', size = 1) { this.pops.push({ text, x, y, col, size, life: 1.1, max: 1.1 }); }
    burst(x, y, n, kind, col) {
        for (let i = 0; i < n * this.quality; i++) {
            const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
            this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'smoke' ? 2 : 0), life: 0.6 + Math.random() * 0.6, max: 1.2, kind, col, size: kind === 'smoke' ? 0.4 + Math.random() * 0.5 : 0.12 + Math.random() * 0.12 });
        }
    }

    onEvents(G, events) {
        const u = G.ufo;
        for (const e of events) {
            switch (e.type) {
                case 'catch': this.pop(SAY[e.kind] || 'GOT IT!', u.x, u.y - 1.4, '#9dff6b'); this.burst(u.x, u.y + 0.4, 8, 'spark', '#b6ff8c'); break;
                case 'grab': if (Math.random() < 0.5) this.pop(SAY[e.kind] || '!', e.x, e.y - 2.2, '#ffffff', 0.7); break;
                case 'bank': this.pop(`+${e.pts}`, u.x, u.y - 1.6, '#ffe14d', 1.3); this.burst(u.x, u.y - 0.5, 14, 'star', '#ffe14d'); break;
                case 'bonk': this.pop('BONK!', e.x, GROUND - 2.6, '#ff9f1c', 1.3); this.burst(e.x, GROUND - 2, 10, 'star', '#ffe14d'); this.shake = Math.max(this.shake, 0.25); break;
                case 'boom': this.pop('KA-BLAM!', e.x, GROUND - 2.4, '#ff4d4d', 1.5); this.burst(e.x, GROUND - 1, 22, 'smoke', '#4a4a4a'); this.burst(e.x, GROUND - 1, 16, 'spark', '#ffb03b'); this.shake = 0.6; break;
                case 'bosshit': this.pop(e.hp > 0 ? 'KLONK!' : 'KA-BOOOM!', e.x, GROUND - 5, '#ff4d4d', 1.6); this.burst(e.x, GROUND - 3, 18, 'smoke', '#555'); this.shake = 0.7; break;
                case 'bossdown': this.burst(e.x, GROUND - 2, 40, 'smoke', '#333'); this.burst(e.x, GROUND - 2, 30, 'spark', '#ffb03b'); this.shake = 1.2; break;
                case 'hit': this.pop(e.cause === 'backfire' ? 'ZZZT!' : 'OUCH!', u.x, u.y - 1.3, '#ff6b6b'); this.burst(u.x, u.y, 12, 'spark', '#ffd23f'); this.shake = Math.max(this.shake, 0.45); break;
                case 'crash': this.pop('KER-SPLAT!', u.x, u.y - 1.5, '#ff4d4d', 1.6); this.burst(u.x, u.y, 30, 'smoke', '#3a3a3a'); this.shake = 1; break;
                case 'glitch': this.pop({ sputter: 'SPUTTER!', hiccup: 'HIC!', honk: 'HONK!' }[e.kind], u.x, u.y - 1.4, '#c9a7ff', 0.9); if (e.kind === 'sputter') this.burst(u.x - 1, u.y, 6, 'smoke', '#666'); break;
                case 'overheat': this.pop('OVERHEAT!', u.x, u.y + 1.5, '#ff8c42'); this.burst(u.x, u.y + 0.3, 8, 'smoke', '#888'); break;
                case 'deflect': this.pop('NOPE.', e.x, GROUND - 2.6, '#ffffff', 0.8); break;
                case 'flash': if (e.hit) this.flash = 1; this.pop('SAY CHEESE!', e.x, GROUND - 2.8, '#fff', 0.8); break;
                case 'netted': this.pop('TANGLED!', u.x, u.y - 1.3, '#7fd7ff'); break;
                case 'laser': this.shake = Math.max(this.shake, 0.3); break;
                case 'pickup': this.pop(PICKUPS[e.kind].name.toUpperCase() + '!', e.x, e.y - 1, '#7fe7ff', 0.9); this.burst(e.x, e.y, 12, 'star', '#fff'); break;
                case 'land': if (e.hard) this.burst(e.x, GROUND, 6, 'smoke', '#c8b08a'); break;
                case 'wake': this.pop('HUH?', e.x, GROUND - 2.4, '#fff', 0.7); break;
                case 'drop': this.pop('BOMBS AWAY!', u.x, u.y - 1.3, '#ffffff', 0.7); break;
                case 'respawn': this.burst(u.x, u.y, 16, 'star', '#9dff6b'); break;
                case 'quota': this.pop('QUOTA MET!', u.x, u.y - 2, '#9dff6b', 1.4); break;
            }
        }
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time) {
        this.resize();
        const { ctx, s, w, h } = this;
        const u = G.ufo;
        const viewW = w / s;
        // camera: ease towards the saucer, clamp to the level
        const target = Math.max(0, Math.min(G.W - viewW, u.x - viewW / 2));
        this.camX += (target - this.camX) * Math.min(1, dt * 6);
        if (G.W < viewW) this.camX = (G.W - viewW) / 2;
        if (!this.ready) { this.camX = target; this.ready = true; }
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const sx = this.shake ? (Math.random() - 0.5) * this.shake * s * 0.6 : 0;
        const sy = this.shake ? (Math.random() - 0.5) * this.shake * s * 0.6 : 0;
        const v = { w, h, s, cx: this.camX, oy: this.oy };
        const theme = LEVELS[G.level].theme;

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.save();
        ctx.translate(sx, sy);
        const painting = art.backdrop(theme);
        drawBackdrop(ctx, theme, v, time, painting && { img: painting, g: art.BACKDROPS[theme] });

        // world transform: 1 unit = s px
        ctx.save();
        ctx.translate(-this.camX * s, this.oy);
        ctx.scale(s, s);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        this.drawMother(G, time);
        ctx.restore();
        if (!painting) drawFence(ctx, theme, v);
        ctx.save();
        ctx.translate(-this.camX * s, this.oy);
        ctx.scale(s, s);
        ctx.lineJoin = 'round';

        const L = this.camX - 4, R = this.camX + viewW + 4;
        // laser warnings go behind everything
        for (const e of G.enemies) {
            if (e.wind > 0 && e.aimX && (e.kind === 'laser' || (e.kind === 'boss' && e.pattern % 3 === 2))) {
                const on = Math.floor(time * 16) % 2;
                ctx.strokeStyle = on ? 'rgba(255,40,40,0.9)' : 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 0.08;
                ctx.setLineDash([0.4, 0.3]);
                ctx.beginPath(); ctx.moveTo(e.aimX, -2); ctx.lineTo(e.aimX, GROUND); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(255,40,40,0.12)';
                ctx.fillRect(e.aimX - 1.2, -2, 2.4, GROUND + 2);
            }
        }
        // pickups
        for (const p of G.pickups) {
            if (p.x < L || p.x > R) continue;
            if (p.life < 2.5 && Math.floor(time * 10) % 2) continue;
            ctx.save(); ctx.translate(p.x, p.y + Math.sin(time * 3 + p.id) * 0.2);
            const ic = art.icon(p.kind);
            if (ic) {
                S.ell(ctx, 0, 0, 0.7, 0.7, 'rgba(255,255,255,0.35)', 0.06);
                ctx.rotate(Math.sin(time * 2 + p.id) * 0.15);
                ctx.drawImage(ic, -0.55, -0.55, 1.1, 1.1);
            } else S.pickup(ctx, p.kind, time + p.id);
            ctx.restore();
        }
        // enemies
        for (const e of G.enemies) {
            if (e.x < L - 4 || e.x > R + 4) continue;
            const d = ENEMIES[e.kind];
            const top = GROUND - d.h;
            ctx.save();
            ctx.translate(e.x, GROUND);
            ell(ctx, 0, 0.05, d.w * 0.5, 0.12);
            const aim = Math.max(-Math.PI + 0.25, Math.min(-0.25, Math.atan2(u.y - top, u.x - e.x)));
            const o = { t: time, walk: e.x, wind: e.wind > 0, dir: e.dir, aim, hp: e.hp, inv: e.inv, v: e.id };
            const img = art.sprite(e.kind);
            if (img) {
                const face = e.kind === 'laser' ? 1 : (e.kind === 'agent' || e.kind === 'tinfoil' || e.kind === 'boss' || e.wind > 0) ? (u.x >= e.x ? 1 : -1) : e.dir;
                const bob = d.walk && e.wind <= 0 ? -Math.abs(Math.sin(e.x * 3)) * 0.06 : 0;
                if (e.inv > 0) ctx.translate(Math.sin(time * 60) * 0.08, 0);
                ctx.translate(0, bob);
                const hh = SPR_H[e.kind];
                const ww = spr(ctx, img, hh, face < 0);
                if (e.wind > 0) {
                    const pulse = 0.2 + Math.abs(Math.sin(time * 30)) * 0.12;
                    const tip = { gunner: [0.45, 0.82], agent: [0.42, 0.74], tinfoil: [0.38, 0.72], tank: [0.47, 0.93], laser: [0, 0.86], boss: [0.48, 0.66] }[e.kind] || [0.4, 0.8];
                    if (e.kind === 'laser') S.ell(ctx, 0, -tip[1] * hh, 0.5 + pulse, 0.35 + pulse * 0.5, 'rgba(255,40,40,0.55)', 0);
                    else S.star(ctx, tip[0] * ww, -tip[1] * hh, pulse + (e.kind === 'boss' ? 0.2 : 0), e.kind === 'tinfoil' ? '#ffffff' : '#ffec5c', 0.03);
                }
                ctx.restore();
                if (e.kind === 'boss') {        // the Buzzkill's health, as six warning lights
                    for (let k = 0; k < (ENEMIES.boss.hp || 6); k++) S.rr(ctx, e.x - 1.65 + k * 0.56, GROUND - hh - 0.75, 0.42, 0.32, 0.08, k < e.hp ? '#ff3b3b' : '#3a3a3a', 0.05);
                }
                if (e.zap > 0) this.zapFx(e, top);
                continue;
            }
            if (e.kind === 'tank' || e.kind === 'boss' || e.kind === 'laser') {
                if (e.kind === 'tank') S.tank(ctx, o);
                else if (e.kind === 'laser') S.laser(ctx, o);
                else S.boss(ctx, o);
            } else {
                const face = e.kind === 'agent' || e.kind === 'tinfoil' || e.wind > 0 ? (u.x >= e.x ? 1 : -1) : e.dir;
                ctx.scale(face, 1);
                const o2 = { ...o, walk: e.kind === 'gunner' && e.wind > 0 ? 0 : e.x, blink: hash3(e.id, Math.floor(time * 2)) < 0.05 };
                if (e.kind === 'gunner') { o2.aim = aim; S.gunner(ctx, o2); }
                else if (e.kind === 'agent') S.agent(ctx, o2);
                else S.tinfoil(ctx, o2);
            }
            ctx.restore();
            if (e.zap > 0) this.zapFx(e, top);
        }
        // walkers
        for (const sp of G.specs) {
            if (sp.x < L || sp.x > R) continue;
            const d = SPECIMENS[sp.kind];
            ctx.save();
            if (sp.y >= GROUND - 0.01) ell(ctx, sp.x, GROUND + 0.05, d.w * 0.45, 0.1);
            ctx.translate(sp.x, sp.y);
            const lifting = sp.state === 'lift' || (sp.state === 'fall' && sp.y < GROUND - 0.1);
            ctx.scale(sp.dir < 0 ? -1 : 1, 1);
            const o = { t: time + sp.id, walk: sp.state === 'walk' && sp.dir ? sp.x : 0, lift: lifting, dazed: sp.state === 'dazed', flee: sp.state === 'walk' && d.flee && Math.abs(sp.x - u.x) < 6.5 && u.beam, v: sp.id, blink: hash3(sp.id, Math.floor(time * 2)) < 0.05 };
            const img = art.sprite(sp.kind);
            if (img) {
                const hh = SPR_H[sp.kind] || d.h;
                if (lifting) { ctx.translate(0, -hh / 2); ctx.rotate(Math.sin(o.t * 6) * 0.3); ctx.translate(0, hh / 2); }
                else if (o.dazed) { ctx.rotate(sp.wake ? -0.35 : 0.12 * Math.sin(o.t * 3)); }
                else if (o.walk) { const b = Math.abs(Math.sin(sp.x * (o.flee ? 4 : 3))); ctx.translate(0, -b * 0.1); ctx.scale(1 + b * 0.03, 1 - b * 0.03); }
                spr(ctx, img, hh, false);
                if (o.dazed) for (let k = 0; k < 3; k++) { const a = o.t * 4 + k * 2.1; S.star(ctx, Math.cos(a) * 0.5, -hh - 0.15 + Math.sin(a) * 0.12, 0.15, '#ffe14d', 0.03); }
            } else (DRAW[sp.kind] || S.cow)(ctx, o);
            if (sp.state === 'dazed' && sp.wake) {
                ctx.fillStyle = '#fff'; ctx.font = `0.45px ${FONT}`; ctx.textAlign = 'center';
                ctx.fillText('Zzz', 0.3, -d.h - 0.5);
            }
            ctx.restore();
        }
        // the beam
        if (u.dead <= 0 && u.beam) this.drawBeam(G, time);
        // the saucer
        this.drawUfo(G, time);
        // shots
        for (const sh of G.shots) {
            ctx.save(); ctx.translate(sh.x, sh.y);
            if (sh.kind === 'pellet') S.ell(ctx, 0, 0, 0.16, 0.16, '#ffcf33', 0.05);
            else if (sh.kind === 'shell') { ctx.rotate(Math.atan2(sh.vy, sh.vx)); S.rr(ctx, -0.35, -0.16, 0.7, 0.32, 0.15, '#c9b458'); }
            else if (sh.kind === 'net') {
                ctx.rotate(time * 6);
                ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 0.05;
                for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 0.18, -0.45); ctx.lineTo(k * 0.18, 0.45); ctx.moveTo(-0.45, k * 0.18); ctx.lineTo(0.45, k * 0.18); ctx.stroke(); }
                S.ell(ctx, 0, 0, 0.5, 0.5, null, 0.05);
            }
            ctx.restore();
        }
        // laser columns
        for (const e of G.enemies) {
            if (e.fire <= 0) continue;
            const wob = 0.5 + Math.sin(time * 60) * 0.12;
            const grd = ctx.createLinearGradient(e.aimX - 1, 0, e.aimX + 1, 0);
            grd.addColorStop(0, 'rgba(255,0,60,0)'); grd.addColorStop(0.35, 'rgba(255,40,80,0.9)'); grd.addColorStop(0.5, '#fff'); grd.addColorStop(0.65, 'rgba(255,40,80,0.9)'); grd.addColorStop(1, 'rgba(255,0,60,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(e.aimX - wob * 1.6, -3, wob * 3.2, GROUND + 3);
        }
        // jets and their warnings
        for (const j of G.jets) {
            if (j.warn > 0) {
                if (Math.floor(time * 8) % 2) continue;
                const ex = j.dir > 0 ? this.camX + 1.2 : this.camX + viewW - 1.2;
                ctx.save(); ctx.translate(ex, j.y);
                S.rr(ctx, -0.55, -0.55, 1.1, 1.1, 0.2, '#ff3b3b', 0.08);
                ctx.fillStyle = '#fff'; ctx.font = `1px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 0.08);
                ctx.restore();
                ctx.strokeStyle = 'rgba(255,60,60,0.35)'; ctx.lineWidth = 0.06; ctx.setLineDash([0.5, 0.5]);
                ctx.beginPath(); ctx.moveTo(this.camX, j.y); ctx.lineTo(this.camX + viewW, j.y); ctx.stroke(); ctx.setLineDash([]);
                continue;
            }
            ctx.save(); ctx.translate(j.x, j.y); ctx.scale(j.dir, 1);
            const jp = art.sprite('jet');
            if (jp) { const jh = SPR_H.jet, jw = jh * jp.width / jp.height; ctx.drawImage(jp, -jw / 2, -jh / 2, jw, jh); }
            else S.jet(ctx, { t: time });
            ctx.restore();
        }
        // particles and pop-up words
        this.drawParts(dt);
        this.drawPops(dt);
        ctx.restore();

        // arrow to Mother when she is off screen and you have reason to go
        const mx = G.W / 2;
        const wantHome = u.dead <= 0 && G.phase === 'play' && (u.hold.length >= 1 || G.quotaMet);
        if (wantHome && (mx < this.camX + 1 || mx > this.camX + viewW - 1)) {
            const left = mx < this.camX;
            const ax = left ? 34 : w - 34, ay = this.oy + 3 * s;
            ctx.save(); ctx.translate(ax, ay); ctx.scale(left ? -1 : 1, 1);
            const bob = Math.sin(time * 6) * 4;
            ctx.beginPath(); ctx.moveTo(-14 + bob, -14); ctx.lineTo(10 + bob, 0); ctx.lineTo(-14 + bob, 14); ctx.closePath();
            ctx.fillStyle = '#ff4fb0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = S.INK; ctx.stroke();
            ctx.restore();
        }
        ctx.restore();

        // camera-flash and hurt overlays
        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.85})`;
            ctx.fillRect(0, 0, w, h);
            this.flash = Math.max(0, this.flash - dt * 1.6);
        }
        if (u.fx.dazzle > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            for (let i = 0; i < 5; i++) {
                const px = (hash3(i, 3) * w + time * 40 * (i + 1)) % w, py = hash3(i, 4) * h;
                ctx.beginPath(); ctx.arc(px, py, 26 + i * 6, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    zapFx(e, top) {     // the beam crackles on a foil hat
        const { ctx } = this;
        ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 0.07;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(e.x + (Math.random() - 0.5) * 0.8, top - 0.6 - k * 0.5);
        ctx.stroke();
    }

    drawMother(G, time) {
        const { ctx } = this;
        const u = G.ufo;
        const mx = G.W / 2;
        const open = G.quotaMet || u.hold.length > 0;
        // the intake column
        const alpha = open ? 0.28 + Math.sin(time * 4) * 0.08 : 0.1;
        const g = ctx.createLinearGradient(0, 1.8, 0, MOTHER.intakeY + 0.6);
        g.addColorStop(0, `rgba(127,245,212,${alpha + 0.2})`); g.addColorStop(1, 'rgba(127,245,212,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(mx - 1.6, 1.8); ctx.lineTo(mx + 1.6, 1.8); ctx.lineTo(mx + MOTHER.intakeHalf, MOTHER.intakeY + 0.6); ctx.lineTo(mx - MOTHER.intakeHalf, MOTHER.intakeY + 0.6); ctx.closePath(); ctx.fill();
        if (open) for (let k = 0; k < 3; k++) {
            const yy = 1.9 + ((time * 1.5 + k / 3) % 1) * (MOTHER.intakeY - 1.6);
            ctx.strokeStyle = `rgba(200,255,240,${0.5 - ((time * 1.5 + k / 3) % 1) * 0.5})`; ctx.lineWidth = 0.08;
            ctx.beginPath(); ctx.ellipse(mx, yy, 1.6 + (yy - 1.8) * 0.5, 0.25, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.save();
        ctx.translate(mx, -0.2 + Math.sin(time * 0.8) * 0.12);
        const ms = art.sprite('mothership');
        if (ms) {
            const mw = 13, mh = mw * ms.height / ms.width;
            ctx.drawImage(ms, -mw / 2, 2.3 - mh, mw, mh);
            if (u.dockT > 0 || G.quotaMet) S.ell(ctx, 0, 2.05, 1.5, 0.3, `rgba(185,255,239,${0.35 + Math.sin(time * 6) * 0.2})`, 0);
        } else S.motherShip(ctx, { t: time, dock: u.dockT > 0, mood: G.stats.hits > 3 ? -1 : G.quotaMet ? 1 : 0 });
        ctx.restore();
    }

    drawBeam(G, time) {
        const { ctx } = this;
        const u = G.ufo;
        const mega = u.fx.mega > 0;
        const top = u.y + 0.25;
        const k = (1 + 0.2 * G.up.beam) * (mega ? BEAM.megaWidth : 1);
        const hTop = BEAM.top * k, hb = (BEAM.top + (GROUND - u.y) * BEAM.spread) * k;
        const g = ctx.createLinearGradient(0, top, 0, GROUND);
        const c = mega ? '255,120,255' : '180,255,120';
        g.addColorStop(0, `rgba(${c},0.6)`); g.addColorStop(1, `rgba(${c},0.18)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(u.x - hTop, top); ctx.lineTo(u.x + hTop, top); ctx.lineTo(u.x + hb, GROUND); ctx.lineTo(u.x - hb, GROUND); ctx.closePath(); ctx.fill();
        // rings travelling up the beam
        for (let k = 0; k < 4; k++) {
            const f = 1 - ((time * 1.4 + k / 4) % 1);
            const yy = top + f * (GROUND - top);
            const half = hTop + (hb - hTop) * f;
            ctx.strokeStyle = `rgba(255,255,255,${0.15 + f * 0.35})`; ctx.lineWidth = 0.07;
            ctx.beginPath(); ctx.ellipse(u.x, yy, half, 0.18, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${c},0.5)`;
        ctx.beginPath(); ctx.ellipse(u.x, GROUND, hb, 0.25, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawUfo(G, time) {
        const { ctx } = this;
        const u = G.ufo;
        if (u.dead > 0) {
            ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(time * 8);
            const wreck = art.sprite('ufo-crash');
            if (wreck) this.ufoImg(wreck, 1);
            else S.ufo(ctx, { t: time, tilt: 0, lookX: 0, blink: true, hurt: true, hullCol: '#8f8ba8' });
            ctx.restore();
            if (Math.random() < 0.5) this.burst(u.x, u.y, 1, 'smoke', '#444');
            return;
        }
        if (u.inv > 0 && Math.floor(time * 14) % 2) return;
        const bob = Math.sin(time * 3) * 0.12;
        const tilt = Math.max(-0.35, Math.min(0.35, u.vx * 0.03)) + (u.glitch?.kind === 'sputter' ? Math.sin(time * 40) * 0.1 : 0);
        ctx.save(); ctx.translate(u.x, u.y + bob);
        if (u.fx.shield > 0) {
            ctx.fillStyle = `rgba(110,200,255,${0.25 + Math.sin(time * 8) * 0.08})`;
            ctx.beginPath(); ctx.ellipse(0, -0.2, 1.8, 1.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 0.06; ctx.strokeStyle = '#bfe9ff'; ctx.stroke();
        }
        if (u.fx.turbo > 0) {
            for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(255,${180 - k * 40},60,${0.6 - k * 0.15})`; ctx.beginPath(); ctx.ellipse(-Math.sign(u.vx || 1) * (1.5 + k * 0.4), 0, 0.4 - k * 0.08, 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        const saucer = art.sprite('ufo');
        if (saucer) {
            if (u.vx > 0.5) this.ufoFace = -1; else if (u.vx < -0.5) this.ufoFace = 1;   // the smoke trails behind
            ctx.save(); ctx.rotate(tilt);
            if (u.lock) ctx.filter = 'sepia(0.6) saturate(1.6) hue-rotate(-20deg)';
            this.ufoImg(saucer, this.ufoFace || 1);
            ctx.filter = 'none';
            ctx.restore();
        } else S.ufo(ctx, { t: time, tilt, lookX: Math.max(-0.6, Math.min(0.6, u.vx * 0.08)), blink: hash3(7, Math.floor(time * 2)) < 0.04, hurt: u.inv > 0 || u.fx.dazzle > 0, glitch: !!u.glitch, hullCol: u.lock ? '#e7b3a8' : null });
        // dangling hold: little icons of what's aboard
        u.hold.forEach((k, i) => {
            const x = (i - (u.hold.length - 1) / 2) * 0.32;
            S.ell(ctx, x, 0.5, 0.11, 0.11, { cow: '#fff', golden: '#ffd23f', chicken: '#fff8e1', pig: '#ffb3cf', sheep: '#f3efff' }[k] || '#ffd2a6', 0.04);
        });
        if (u.fx.net > 0) {
            ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 0.05;
            for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.35, -0.9); ctx.lineTo(k * 0.35 + 0.3, 0.45); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-1.3, k * 0.18 - 0.2); ctx.lineTo(1.3, k * 0.18 - 0.15); ctx.stroke(); }
        }
        if (u.dockT > 0) {
            ctx.strokeStyle = '#7ff5d4'; ctx.lineWidth = 0.14;
            ctx.beginPath(); ctx.arc(0, -0.1, 1.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, u.dockT / MOTHER.dockTime)); ctx.stroke();
        }
        if (u.defects > 0 && Math.random() < 0.08 * u.defects) this.burst(u.x + (Math.random() - 0.5), u.y - 0.1, 1, 'smoke', '#777');
        ctx.restore();
    }

    /** Zib's saucer, 2.9 units wide, with the disc (not the dome or the smoke) on the origin. */
    ufoImg(img, face) {
        const { ctx } = this;
        const w = 2.9, h = w * img.height / img.width;
        ctx.save();
        ctx.scale(face, 1);
        ctx.drawImage(img, -w * 0.4, -h * 0.66, w, h);
        ctx.restore();
    }

    drawParts(dt) {
        const { ctx } = this;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) { this.parts.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.kind === 'smoke') { p.vx *= 0.94; p.vy = p.vy * 0.94 - dt * 2; p.size += dt * 0.6; }
            else p.vy += dt * 14;
            const a = Math.min(1, p.life / 0.4);
            ctx.globalAlpha = a;
            if (p.kind === 'star') S.star(ctx, p.x, p.y, p.size * 1.6, p.col, 0.03);
            else if (p.kind === 'smoke') S.ell(ctx, p.x, p.y, p.size, p.size, p.col, 0);
            else { ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
            ctx.globalAlpha = 1;
        }
        if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    }

    drawPops(dt) {
        const { ctx } = this;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = this.pops.length - 1; i >= 0; i--) {
            const p = this.pops[i];
            p.life -= dt;
            if (p.life <= 0) { this.pops.splice(i, 1); continue; }
            const age = p.max - p.life;
            const k = age < 0.15 ? 0.4 + age / 0.15 * 0.8 : age < 0.25 ? 1.2 - (age - 0.15) * 2 : 1;
            const y = p.y - age * 0.8;
            ctx.save(); ctx.translate(p.x, y); ctx.scale(k * p.size, k * p.size); ctx.rotate(-0.08);
            ctx.globalAlpha = Math.min(1, p.life / 0.3);
            ctx.font = `0.8px ${FONT}`;
            ctx.lineWidth = 0.22; ctx.strokeStyle = S.INK; ctx.lineJoin = 'round';
            ctx.strokeText(p.text, 0, 0);
            ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}

function ell(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

export { SHOTS, UFO, CEIL };
