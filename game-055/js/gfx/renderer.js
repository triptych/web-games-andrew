// Draws a World: ground chunks, then sprite layers, then bloom and the
// composite. Reads the simulation, never writes it. Also turns the sim's
// events into effects (explosions, wrecks, craters, lights, shake).

import { createGL, canvasTexture } from './gl.js';
import { buildAtlas, mainJobs, bossJobs } from './atlas.js';
import { Batch } from './batch.js';
import { Ground, LOOK } from './ground.js';
import { Post } from './post.js';
import { FX, PALETTE } from './fx.js';
import { STYLE } from '../sim/bullets.js';
import { WATER, LAVA, LAND } from '../sim/terrain.js';
import { bossHealth } from '../sim/bosses.js';

const TAU = Math.PI * 2;
const LAYERS = ['decor', 'ground', 'gfx', 'gsmoke', 'debris', 'shadow', 'boss', 'air', 'pickup', 'pshot', 'smoke', 'fx', 'player', 'ebullet', 'top'];
const CAPS = { decor: 7000, ground: 1500, gfx: 2500, gsmoke: 2000, debris: 1500, shadow: 1200, boss: 400, air: 1200, pickup: 800, pshot: 1600, smoke: 2500, fx: 4000, player: 200, ebullet: 2800, top: 4000 };
const WEATHER = { clear: 0, rain: 1, sand: 2, snow: 3, storm: 4, ash: 5 };
const BIOME_WEATHER = { coast: 'clear', jungle: 'rain', desert: 'sand', arctic: 'snow', city: 'storm', volcano: 'ash' };

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const g = createGL(canvas);
        if (!g) throw new Error('WebGL2 unavailable');
        this.gl = g.gl;
        this.hdr = g.floatRT;
        const gl = this.gl;
        this.batch = new Batch(gl, LAYERS, CAPS);
        const A = buildAtlas(mainJobs(), 2048, 2);
        this.atlasCanvas = A.canvas;
        this.batch.setAtlas(0, canvasTexture(gl, A.canvas), A.sprites);
        this.batch.setAtlas(1, this.batch.tex[0], {});
        this.ground = new Ground(gl, this.batch, this.hdr);
        this.post = new Post(gl, this.hdr, this.ground.noise);
        this.fx = new FX();
        this.time = 0;
        this.quality = 1;
        this.opts = { shake: 1, flash: 1, scan: 0, hitbox: false };
        this.bossAtlasId = null;
        this.layout = { cw: 1, ch: 1, fx: 0, fy: 0, s: 1 };
        this.trailT = 0;
        this.lightningT = 4;
        this.cloudOff = [0, 0];
        this.terrainVersion = -1;
        this.world = null;
        this.rotor = 0;
    }

    loadBoss(id) {
        if (this.bossAtlasId === id) return;
        const gl = this.gl;
        const jobs = bossJobs(id);
        if (!jobs.length) return;
        const A = buildAtlas(jobs, 2048, 1.6);
        if (this.batch.tex[1] && this.batch.tex[1] !== this.batch.tex[0]) gl.deleteTexture(this.batch.tex[1]);
        this.batch.setAtlas(1, canvasTexture(gl, A.canvas), A.sprites);
        this.bossAtlasId = id;
    }

    /** Field placement in CSS pixels. */
    setLayout(cw, ch, dpr, field) {
        this.layout = { cw, ch, dpr, ...field };
        const q = this.quality;
        const maxPix = 2.6e6 * q;
        let rw = Math.round(cw * dpr * q), rh = Math.round(ch * dpr * q);
        const k = Math.min(1, Math.sqrt(maxPix / (rw * rh)));
        rw = Math.max(64, Math.round(rw * k)); rh = Math.max(64, Math.round(rh * k));
        this.canvas.width = Math.round(cw * dpr * Math.min(1, q + 0.25));
        this.canvas.height = Math.round(ch * dpr * Math.min(1, q + 0.25));
        this.post.resize(rw, rh);
        this.relayoutGround();
    }

    relayoutGround() {
        const L = this.layout;
        const s = L.s;
        const x0 = -L.fx / s - 24, cwW = L.cw / s + 48;
        const density = Math.max(0.6, Math.min(1.6, s * L.dpr * this.quality));
        this.ground.layout(Math.floor(x0 / 8) * 8, Math.ceil(cwW / 8) * 8, density);
    }

    setWorld(w) {
        this.world = w;
        this.fx = Object.assign(new FX(), { reduce: this.fx.reduce, quality: this.fx.quality });
        this.ground.setTerrain(w.terrain);
        this.terrainVersion = w.terrainVersion;
        this.look = LOOK[w.terrain.biome];
        const boss = w.endless ? null : w.op.boss;
        this.loadBoss(boss === 'seraph' || boss === 'meridian' ? (boss === 'meridian' ? 'meridian' : 'seraph') : boss);
    }

    terrainKind(x, y) { const w = this.world; return w.terrain.kind(x, w.scroll + w.H - y); }

    // ------------------------------------------------------------ events

    consume(events) {
        const fx = this.fx;
        const w = this.world;
        for (const e of events) {
            switch (e.type) {
                case 'kill': this.onKill(e); break;
                case 'partKill': fx.explosion(e.x, e.y, 'l'); for (let i = 0; i < 3; i++) setTimeout(() => fx.explosion(e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40, 'm'), 80 + i * 110); fx.popup(e.x, e.y - 20, '+800', [1, 0.8, 0.3], 1.2); break;
                case 'phitE': if (!e.shield) fx.hitSpark(e.x, e.y, e.crit, e.kind); else fx.pop(e.x, e.y, [0.6, 0.8, 1], 0.3); break;
                case 'ting': fx.pop(e.x, e.y, [0.7, 0.85, 1], 0.25); break;
                case 'pshot': this.muzzle(e); break;
                case 'eshot': if (e.k !== 's') fx.pop(e.x + (e.muzzle !== undefined ? Math.cos(e.muzzle) * 16 : 0), e.y + (e.muzzle !== undefined ? Math.sin(e.muzzle) * 16 : 8), [1, 0.6, 0.3], e.k === 'l' ? 0.8 : 0.45); break;
                case 'blast': fx.explosion(e.x, e.y, 'l', { ground: true }); fx.scorch(e.x, e.y, 1.3, false); break;
                case 'rocketHit': fx.explosion(e.x, e.y, 's'); break;
                case 'cancel': this.onCancel(e); break;
                case 'burn': if (Math.random() < 0.5) fx.pop(e.x, e.y, [0.5, 0.9, 1], 0.3); break;
                case 'graze': fx.p({ spr: 'spark', x: w.player.x + (Math.random() - 0.5) * 16, y: w.player.y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.15, s0: 0.35, r: 0.8, g: 0.9, b: 1, ramp: 3, mode: 7, layer: 'top', stretch: 1 }); break;
                case 'phit': {
                    fx.explosion(e.x, e.y, 'm');
                    fx.shake(0.55 * this.opts.shake);
                    fx.hitPulse = 1;
                    fx.ca = 0.03;
                    fx.hitstop = Math.max(fx.hitstop, 0.09);
                    fx.flashScreen(1, 0.2, 0.15, 0.25, 3);
                    break;
                }
                case 'shieldBreak': fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.4, s0: 0.3, s1: 1.2, r: 0.4, g: 0.9, b: 1, ramp: 6, mode: 7, layer: 'top' }); fx.shock(e.x, e.y, 80, 0.02, 0.4); fx.shake(0.25); break;
                case 'shieldUp': fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.4, s0: 1.0, s1: 0.4, r: 0.4, g: 0.9, b: 1, ramp: 6, mode: 7, layer: 'top' }); break;
                case 'pdead': {
                    fx.explosion(e.x, e.y, 'l');
                    setTimeout(() => fx.explosion(e.x + 20, e.y - 10, 'l'), 200);
                    setTimeout(() => fx.explosion(e.x - 15, e.y + 15, 'xl'), 450);
                    fx.wreck(e.x, e.y, 'heli', 0, 0, 40, 'l', (x, y) => this.terrainKind(x, y));
                    fx.slowmo = 1.4; fx.slowmoScale = 0.3;
                    fx.flashScreen(1, 0.5, 0.3, 0.5, 2);
                    fx.shake(1);
                    break;
                }
                case 'phoenix': {
                    fx.flashScreen(1, 0.7, 0.3, 0.8, 2);
                    fx.shock(e.x, e.y, 400, 0.05, 1.0);
                    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; fx.p({ spr: 'fire' + (i & 3), x: e.x, y: e.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, drag: 2, life: 0.8, s0: 0.6, s1: 1.4, ramp: 1, mode: 4, layer: 'top' }); }
                    fx.popup(e.x, e.y - 40, 'PHOENIX', [1, 0.6, 0.2], 1.6);
                    break;
                }
                case 'bomb': this.onBomb(e); break;
                case 'od': fx.flashScreen(1, 0.85, 0.3, 0.35, 3); fx.shock(e.x, e.y, 200, 0.03, 0.6); break;
                case 'arc': {
                    const p = e.pts;
                    for (let i = 2; i < p.length; i += 2) fx.bolt(p[i - 2], p[i - 1], p[i], p[i + 1], [0.5, 0.85, 1], 0.8, 0.16);
                    for (let i = 2; i < p.length; i += 2) fx.pop(p[i], p[i + 1], [0.6, 0.9, 1], 0.5);
                    fx.light(p[0], p[1], 160, 1.2, [0.5, 0.8, 1], 0.15);
                    break;
                }
                case 'pickup': {
                    const c = e.kind === 'salvage' ? [1, 0.8, 0.3] : e.kind === 'repair' ? [0.4, 1, 0.6] : e.kind === 'bomb' ? [0.5, 0.8, 1] : [1, 0.85, 0.3];
                    fx.pop(e.x, e.y, c, e.kind === 'salvage' ? 0.35 : 1.0);
                    if (e.kind !== 'salvage') fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.35, s0: 0.1, s1: 0.6, r: c[0], g: c[1], b: c[2], ramp: 6, mode: 7, layer: 'top' });
                    break;
                }
                case 'rescue': {
                    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; fx.p({ spr: 'soft', x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, drag: 3, life: 0.8, s0: 0.25, r: 0.4, g: 1, b: 0.6, ramp: 0, mode: 7, layer: 'top' }); }
                    fx.popup(e.x, e.y - 24, '+' + e.n, [0.5, 1, 0.6], 1.3);
                    break;
                }
                case 'laserFire': fx.light(e.x, e.y, 200, 1.5, [1, 0.4, 0.6], 0.3); fx.shake(0.1); break;
                case 'missile': fx.smokePuff(e.x, e.y, 18, 0.6, 'gsmoke', 1, 0.4); break;
                case 'split': if (Math.random() < 0.5) fx.pop(e.x, e.y, PALETTE[e.color] || [1, 1, 1], 0.5); break;
                case 'stomp': fx.shake(0.3); fx.shock(e.x, e.y, 160, 0.02, 0.5); for (const dx of [-70, 70]) { fx.p({ spr: 'ring', x: e.x + dx, y: e.y, life: 0.6, s0: 0.2, s1: 1.4, r: 0.5, g: 0.45, b: 0.3, a: 0.7, ramp: 6, mode: 0, layer: 'gfx' }); for (let i = 0; i < 6; i++) fx.smokePuff(e.x + dx, e.y, 30, 0.6, 'gsmoke', 1, 0.35); } break;
                case 'burrow': for (let i = 0; i < 14; i++) fx.smokePuff(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, 40, 0.8, 'gsmoke', 1, 0.6); fx.shake(0.3); break;
                case 'bulge': fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.7, s0: 1.2, s1: 0.3, r: 1, g: 0.5, b: 0.2, a: 0.9, ramp: 6, mode: 7, layer: 'gfx' }); for (let i = 0; i < 8; i++) fx.smokePuff(e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 50, 26, 0.7, 'gsmoke', 0, 0.55); break;
                case 'erupt': fx.explosion(e.x, e.y, 'l', { ground: true, tint: [0.62, 0.5, 0.34] }); fx.scorch(e.x, e.y, 1.6, true); fx.shake(0.6); break;
                case 'dash': for (let i = 0; i < 4; i++) setTimeout(() => this.afterimage(), i * 40); break;
                case 'strikeWarn': fx.p({ spr: 'ring', x: e.x, y: e.y, life: e.t, s0: 1.2, s1: 0.4, r: 1, g: 0.25, b: 0.35, a: 0.9, ramp: 0, mode: 7, layer: 'top' }); setTimeout(() => { fx.bolt(e.x + (Math.random() - 0.5) * 80, -40, e.x, e.y, [0.85, 0.9, 1], 1.6, 0.22); fx.explosion(e.x, e.y, 'm'); fx.lightning = 0.5 * this.opts.flash; }, e.t * 1000); break;
                case 'bossPhase': fx.flashScreen(1, 1, 1, 0.45, 3); fx.shock(e.x, e.y, 500, 0.05, 1.1); fx.shake(0.6); fx.explosion(e.x, e.y, 'xl'); fx.hitstop = 0.12; break;
                case 'bossDying': this.bossDeathSeq(e); break;
                case 'bossDeath': this.bossFinal(e); break;
                case 'bossIntro': this.loadBoss(e.id === 'meridian' ? 'meridian' : e.id); break;
                case 'ally': this.loadBoss('meridian'); break;
                case 'warning': break;
            }
        }
    }

    onKill(e) {
        const fx = this.fx;
        const w = this.world;
        if (e.kind === 'beacon') return;
        const size = e.size === 'l' ? 'l' : e.size === 'm' ? 'm' : 's';
        if (e.ground) {
            const k = this.terrainKind(e.x, e.y);
            if (k === WATER) { fx.splash(e.x, e.y, size === 'l' ? 1.6 : 1); fx.explosion(e.x, e.y, size === 'l' ? 'm' : 's', { ground: true }); }
            else {
                fx.explosion(e.x, e.y, e.kind === 'fueltank' || e.kind === 'truck' ? 'l' : size, { ground: true });
                if (k !== LAVA) fx.scorch(e.x, e.y, size === 'l' ? 1.4 : size === 'm' ? 1 : 0.7, size !== 's');
                const wreck = { tank: 'debris1', aa: 'debris2', sam: 'debris3' }[e.kind];
                if (wreck) fx.stamps.push({ name: 'wreck', x: e.x, y: e.y, rot: e.rot || 0, s: 0.9, a: 0.9 });
            }
        } else {
            const sprite = { hornet: 'hornet', jet: 'jet', gunship: 'gunship', bomber: 'bomber', carrier: 'carrier', warhawk: 'warhawk' }[e.kind];
            fx.explosion(e.x, e.y, e.kind === 'missile' ? 's' : size);
            if (sprite && !e.silent) {
                const en = { x: e.x, y: e.y };
                fx.wreck(en.x, en.y, sprite, e.rot ?? Math.PI, 0, 60, size, (x, y) => this.terrainKind(x, y));
            }
            if (size === 'l') { for (let i = 0; i < 3; i++) setTimeout(() => fx.explosion(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 40, 'm'), 100 + i * 120); }
        }
        if (e.elite) fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.5, s0: 0.2, s1: 1.2, r: 0.8, g: 0.4, b: 1, ramp: 6, mode: 7, layer: 'fx' });
    }

    onCancel(e) {
        const fx = this.fx;
        const p = e.pts;
        const n = p.length / 3;
        const step = Math.max(1, Math.floor(n / 220));
        for (let i = 0; i < n; i += step) {
            const c = PALETTE[p[i * 3 + 2]] || [1, 1, 1];
            fx.p({ spr: 'glow', x: p[i * 3], y: p[i * 3 + 1], life: 0.35, s0: 0.35, s1: 0.05, r: c[0], g: c[1], b: c[2], ramp: 5, mode: 7, layer: 'top' });
            if (e.reason !== 'tick' && this.world.L.stormBreaker && i % (step * 3) === 0) {
                const pl = this.world.player;
                fx.p({ spr: 'gear', x: p[i * 3], y: p[i * 3 + 1], vx: (pl.x - p[i * 3]) * 2.2, vy: (pl.y - p[i * 3 + 1]) * 2.2, drag: 0, life: 0.45, s0: 0.6, ramp: 0, mode: 0, layer: 'top' });
            }
        }
    }

    onBomb(e) {
        const fx = this.fx;
        fx.flashScreen(0.7, 0.9, 1, 0.55, 3);
        fx.shock(e.x, e.y, 900, 0.07, 1.3);
        fx.shock(e.x, e.y, 500, 0.04, 0.8);
        fx.shake(0.8 * this.opts.shake);
        fx.ca = 0.022;
        fx.p({ spr: 'ring', x: e.x, y: e.y, life: 0.9, s0: 0.3, s1: 14, r: 0.4, g: 0.75, b: 1, a: 0.75, ramp: 6, mode: 7, layer: 'top' });
        fx.p({ spr: 'ring', x: e.x, y: e.y, life: 1.2, s0: 0.2, s1: 9, r: 0.8, g: 0.9, b: 1, a: 0.45, ramp: 6, mode: 7, layer: 'top' });
        fx.p({ spr: 'glow', x: e.x, y: e.y, life: 0.5, s0: 2, s1: 6, r: 0.5, g: 0.75, b: 1, a: 0.6, ramp: 5, mode: 7, layer: 'fx' });
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * TAU, d = 200 + Math.random() * 300;
            fx.bolt(e.x, e.y, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, [0.6, 0.85, 1], 1.2, 0.3);
        }
        fx.light(e.x, e.y, 700, 2.5, [0.6, 0.8, 1], 0.8);
        fx.lightning = 0.2 * this.opts.flash;
    }

    muzzle(e) {
        const fx = this.fx;
        const p = this.world.player;
        const s = e.v % 2 ? 1 : -1;
        fx.p({ spr: 'flare', x: p.x + s * 4.5, y: p.y - 30, life: 0.05, s0: 0.22, s1: 0.32, r: 1, g: 0.85, b: 0.5, ramp: 5, mode: 7, layer: 'top', rot: Math.random() * TAU });
        if (e.v % 3 === 0) fx.p({ spr: 'shell', x: p.x + s * 6, y: p.y - 18, vx: s * (60 + Math.random() * 60), vy: 20 + Math.random() * 40, drag: 1.5, life: 0.9, s0: 1, vr: 20, ramp: 4, mode: 0, layer: 'debris', z: 30, vz: 30, grav: 300 });
        if (e.v % 4 === 0) fx.light(p.x, p.y - 30, 70, 0.6, [1, 0.8, 0.4], 0.06);
    }

    afterimage() {
        const b = this.world.boss;
        if (!b || !b.alive) return;
        this.fx.p({ spr: 'ser_body', x: b.x, y: b.y, rot: Math.PI + (b.rot || 0), life: 0.35, s0: 1, s1: 1.1, r: 1, g: 0.8, b: 0.3, a: 0.5, ramp: 0, mode: 4, layer: 'air' });
    }

    bossDeathSeq(e) {
        const fx = this.fx;
        const w = this.world;
        const b = w.boss;
        let n = 0;
        const iv = setInterval(() => {
            if (!b || n++ > 22) { clearInterval(iv); return; }
            const pts = b.parts.filter((p) => !p.visual);
            const p = pts[(Math.random() * pts.length) | 0] || b;
            fx.explosion(p.x + (Math.random() - 0.5) * 70, p.y + (Math.random() - 0.5) * 70, Math.random() < 0.3 ? 'l' : 'm');
            fx.shake(0.15);
        }, 140);
        fx.slowmo = 0.8; fx.slowmoScale = 0.45;
    }

    bossFinal(e) {
        const fx = this.fx;
        fx.flashScreen(1, 1, 1, e.final ? 1 : 0.85, e.final ? 0.6 : 1.2);
        fx.shock(e.x, e.y, 1100, 0.09, 1.6);
        fx.shock(e.x, e.y, 600, 0.05, 1.0);
        fx.shake(1.2 * this.opts.shake);
        fx.ca = 0.05;
        fx.slowmo = 1.6; fx.slowmoScale = 0.25;
        for (let i = 0; i < 8; i++) setTimeout(() => fx.explosion(e.x + (Math.random() - 0.5) * 160, e.y + (Math.random() - 0.5) * 160, 'xl'), i * 90);
        for (let i = 0; i < 60; i++) {
            const a = Math.random() * TAU, s = 200 + Math.random() * 500;
            fx.p({ spr: 'debris' + (i & 3), x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.8, life: 2.5, s0: 1 + Math.random() * 2, vr: (Math.random() - 0.5) * 12, ramp: 4, mode: 0, layer: 'debris', z: 10, vz: 150 + Math.random() * 250, grav: 400, trail: Math.random() < 0.3 ? 1 : 0 });
        }
        const k = this.terrainKind(e.x, e.y);
        if (k !== WATER) for (let i = 0; i < 5; i++) fx.scorch(e.x + (Math.random() - 0.5) * 160, e.y + (Math.random() - 0.5) * 160, 2.2, i === 0);
        else fx.splash(e.x, e.y, 3);
        if (e.eject) {
            // the crown blows, the pilot's chute opens
            setTimeout(() => {
                fx.p({ spr: 'soft', x: e.x, y: e.y, vx: 30, vy: -60, drag: 0.6, life: 4, s0: 0.5, r: 1, g: 1, b: 1, ramp: 0, mode: 0, layer: 'top' });
                fx.popup(e.x, e.y - 40, '+ASH', [1, 0.7, 0.4], 1.4);
            }, 600);
        }
        fx.light(e.x, e.y, 900, 3, [1, 0.7, 0.4], 1.6);
    }

    // ------------------------------------------------------------ drawing

    view(shx = 0, shy = 0) {
        const L = this.layout;
        const s = L.s;
        return [2 * s / L.cw, -2 * s / L.ch, (2 * (L.fx + shx)) / L.cw - 1, 1 - (2 * (L.fy + shy)) / L.ch];
    }

    render(dt, opts = {}) {
        const w = this.world;
        if (!w) return;
        const gl = this.gl;
        const B = this.batch;
        const fx = this.fx;
        this.time += dt;
        this.rotor += dt * 42;
        if (w.terrainVersion !== this.terrainVersion) {
            this.terrainVersion = w.terrainVersion;
            this.ground.setTerrain(w.terrain);
            this.look = LOOK[w.terrain.biome];
            this.loadBoss(w.director.bossId());
        }
        fx.update(dt, w.scrollSpeed);
        this.ambientFx(dt);
        // stamps (craters, treads) into the terrain
        if (fx.stamps.length) {
            const list = fx.stamps.map((s) => [s.name, s.x, w.scroll + w.H - s.y, s.rot, s.s, s.a]);
            fx.stamps.length = 0;
            this.ground.stamp(list);
        }
        const L = this.layout;
        const yTop = -L.fy / L.s - 30, yBot = (L.ch - L.fy) / L.s + 30;
        this.ground.update(w.scroll + w.H - yBot, yBot - yTop, true);

        // shake
        const tr = fx.trauma * fx.trauma * this.opts.shake;
        const shx = (Math.sin(this.time * 71) + Math.sin(this.time * 43)) * 9 * tr * L.s;
        const shy = (Math.sin(this.time * 59) + Math.cos(this.time * 37)) * 9 * tr * L.s;
        const view = this.view(shx, shy);

        B.clear();
        this.drawWorld(B);
        fx.draw(B, {});

        // lights for the ground
        const lights = fx.lights.slice(-14);
        const p = w.player;
        if (p.alive && p.firing && !p.beam) lights.push({ x: p.x, y: p.y - 30, r: 60, i: 0.35, c: [1, 0.8, 0.4] });
        if (p.beam) lights.push({ x: p.x, y: p.y - 200, r: 260, i: 1.2, c: [0.4, 0.85, 1] });
        this.ground.setLights(lights);

        this.post.beginScene();
        const look = this.look;
        const night = !!look.night;
        const search = night && p.alive ? [p.x, p.y - 20, -Math.PI / 2 + p.bank * 0.35, 1] : [0, 0, 0, 0];
        this.ground.draw(view, w.scroll, w.H, this.time, { search, flash: fx.lightning, emMul: 1 });
        B.begin(view);
        // sprites stay inside the play field (plus a sliver above it for arrivals)
        const pw = this.post.w, ph = this.post.h;
        const sx0 = Math.floor((L.fx + shx) / L.cw * pw), sx1 = Math.ceil((L.fx + shx + w.W * L.s) / L.cw * pw);
        const syTop = Math.max(0, L.fy - 6 * L.s), syBot = L.fy + w.H * L.s;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(sx0, Math.floor((1 - (syBot + shy) / L.ch) * ph), sx1 - sx0, Math.ceil((syBot - syTop) / L.ch * ph));
        for (const name of LAYERS) if (name !== 'decor') B.drawLayer(name);
        gl.disable(gl.SCISSOR_TEST);
        this.post.bloom(this.hdr ? 0.95 : 0.72);

        // composite
        const fieldUV = [
            (L.fx) / L.cw, 1 - (L.fy + w.H * L.s) / L.ch,
            (L.fx + w.W * L.s) / L.cw, 1 - L.fy / L.ch,
        ];
        const shocks = fx.shocks.map((s) => {
            const u = s.t / s.life;
            const sx = (L.fx + s.x * L.s + shx) / L.cw, sy = 1 - (L.fy + s.y * L.s + shy) / L.ch;
            return [sx, sy, (s.maxR * L.s / L.ch) * (1 - Math.pow(1 - u, 2.2)), s.str * (1 - u)];
        });
        this.cloudOff[0] += dt * 0.004; this.cloudOff[1] += dt * (0.012 + w.scrollSpeed * 0.00035);
        const lowHP = p.alive && p.armor <= 1 ? 1 : 0;
        this.post.composite(gl.drawingBufferWidth, gl.drawingBufferHeight, {
            time: this.time, bloom: this.hdr ? 0.9 : 0.75, shocks, ca: 0.0016 + fx.ca + (p.odT > 0 ? 0.004 : 0),
            flash: fx.flash, grade: look.grade, field: fieldUV, weather: WEATHER[opts.weather ?? (w.endless ? BIOME_WEATHER[w.terrain.biome] : w.op.weather)] ?? 0, weatherI: opts.weatherI ?? 1,
            cloud: Math.min(1, w.cloudCover * 1.1), cloudAmb: opts.cloudAmb ?? (look.cloud * 0.35), cloudOff: this.cloudOff, fog: look.fog,
            lowHP, od: p.odT > 0 ? 1 : 0, hit: fx.hitPulse * (this.opts.flash ? 1 : 0.3), lightning: fx.lightning * 0.5, grain: 0.035, scan: this.opts.scan ? 0.08 : 0,
            exposure: night ? 1.15 : 1.08,
        });
    }

    ambientFx(dt) {
        const w = this.world;
        const fx = this.fx;
        const p = w.player;
        // rotor downwash
        this.trailT -= dt;
        if (this.trailT <= 0 && p.alive) {
            this.trailT = 0.12;
            const sx = p.x + 18, sy = p.y + 26;
            const k = this.terrainKind(sx, sy);
            if (k === WATER) fx.p({ spr: 'ring', x: sx, y: sy, life: 0.9, s0: 0.15, s1: 0.75, r: 0.85, g: 0.95, b: 1, a: 0.35, ramp: 6, mode: 0, layer: 'gfx', scroll: 1 });
            else if (w.terrain.biome === 'desert' || w.terrain.biome === 'arctic' || w.terrain.biome === 'volcano') {
                const c = w.terrain.biome === 'arctic' ? 0.95 : w.terrain.biome === 'desert' ? 0.75 : 0.35;
                fx.p({ spr: 'smoke' + ((Math.random() * 4) | 0), x: sx + (Math.random() - 0.5) * 30, y: sy + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, drag: 2, life: 0.8, s0: 0.3, s1: 0.9, r: c, g: c * 0.92, b: c * 0.85, a: 0.35, ramp: 2, layer: 'gsmoke', scroll: 1 });
            }
        }
        // missile trails, wakes, burning things
        for (const s of w.pshots) {
            if ((s.kind === 'msl' || s.kind === 'rkt') && Math.random() < 0.7) fx.smokePuff(s.x - s.vx * 0.012, s.y - s.vy * 0.012, s.kind === 'msl' ? 9 : 7, 0.45, 'smoke', 0, 0.75);
        }
        for (const e of w.enemies) {
            if (!e.alive || e.delay > 0) continue;
            if (e.kind === 'missile' && Math.random() < 0.6) fx.smokePuff(e.x, e.y, 9, 0.45, 'smoke', 0, 0.7);
            if ((e.kind === 'boat' || e.kind === 'icebreaker') && Math.random() < 0.25) {
                const a = e.rot + Math.PI / 2;
                fx.p({ spr: 'smoke' + ((Math.random() * 4) | 0), x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, life: 1.4, s0: 0.25, s1: 0.8, r: 0.9, g: 0.95, b: 1, a: 0.5, ramp: 2, layer: 'gfx', scroll: 1 });
            }
            if (e.ground && (e.kind === 'tank' || e.kind === 'truck' || e.kind === 'walker') && e.mv && e.mv.spd) {
                e._tr = (e._tr || 0) + dt;
                if (e._tr > 0.3) { e._tr = 0; fx.stamps.push({ name: 'tread', x: e.x, y: e.y, rot: e.rot, s: e.kind === 'truck' ? 0.7 : 1, a: 0.5 }); }
            }
            if (!e.boss && e.hp < e.maxHp * 0.4 && e.def.size !== 's' && Math.random() < 0.25) fx.smokePuff(e.x, e.y, 12, 0.5, e.ground ? 'gsmoke' : 'smoke', e.ground ? 1 : 0, 0.15);
        }
        const b = w.boss;
        if (b && b.alive && b.phase && !b.entering) {
            const hp = bossHealth(b);
            if ((hp < 0.5 || b.dying) && Math.random() < 0.4) { const pt = b.parts[(Math.random() * b.parts.length) | 0]; if (pt && !pt.visual) fx.smokePuff(pt.x + (Math.random() - 0.5) * 40, pt.y, 22, 0.55, 'smoke', 0, 0.12); }
            if (b.submerged && Math.random() < 0.5) fx.smokePuff(b.x + (Math.random() - 0.5) * 50, b.y + (Math.random() - 0.5) * 50, 30, 0.6, 'gsmoke', 0, 0.62);
        }
        // weather lightning
        const wt = w.endless ? BIOME_WEATHER[w.terrain.biome] : w.op.weather;
        if (wt === 'storm' || (w.terrain.biome === 'volcano' && !w.endless)) {
            this.lightningT -= dt;
            if (this.lightningT <= 0) {
                this.lightningT = 3 + Math.random() * 6;
                const x = Math.random() * w.W;
                fx.bolt(x, -60, x + (Math.random() - 0.5) * 200, Math.random() * w.H * 0.4, [0.8, 0.85, 1], 1.4, 0.25);
                fx.lightning = (wt === 'storm' ? 0.9 : 0.45) * this.opts.flash;
            }
        }
    }

    drawWorld(B) {
        const w = this.world;
        const t = this.time;
        const spr = (n) => B.spr(n);
        // pickups
        for (const k of w.pickups) {
            if (k.kind === 'salvage') {
                B.push('pickup', spr('glow'), k.x, k.y, 0, 0.35, 0.35, 1, 0.75, 0.25, 0.5, 0, 7);
                B.push('pickup', spr('gear'), k.x, k.y, k.spin, 0.9, 0.9);
            } else {
                const s = { repair: 'repair', bomb: 'bombpick', od: 'odcell' }[k.kind];
                const c = k.kind === 'repair' ? [0.4, 1, 0.6] : k.kind === 'bomb' ? [0.5, 0.8, 1] : [1, 0.85, 0.3];
                const bob = 1 + Math.sin(t * 6 + k.spin) * 0.08;
                B.push('pickup', spr('glow'), k.x, k.y, 0, 0.8, 0.8, c[0], c[1], c[2], 0.6, 0, 7);
                B.push('pickup', spr(s), k.x, k.y, 0, bob * 1.1, bob * 1.1);
            }
        }
        // enemies
        for (const e of w.enemies) {
            if (!e.alive || e.delay > 0) continue;
            this.drawEnemy(B, e, t);
        }
        // boss
        if (w.boss && w.boss.alive) this.drawBoss(B, w.boss, t);
        // ally
        if (w.ally) {
            const a = w.ally;
            const s = spr('ser_body');
            if (s) {
                B.push('shadow', s, a.x + 18, a.y + 26, 0, 0.6, 0.6, 1, 1, 1, 0.35, 0, 1);
                B.push('air', s, a.x, a.y, 0, 0.6, 0.6);
                B.push('air', spr('rotor_gold'), a.x, a.y - 4, this.rotor * 1.1, 0.8, 0.8, 1, 1, 1, 0.8);
                B.push('fx', spr('glow'), a.x, a.y + 10, 0, 0.5, 0.5, 1, 0.8, 0.4, 0.6, 0, 7);
            }
        }
        // player shots
        for (const s of w.pshots) {
            if (s.delay > 0) continue;
            const rot = s.ang + Math.PI / 2;
            switch (s.kind) {
                case 'gun':
                    if (s.crit) B.push('pshot', spr('trace'), s.x, s.y, rot, 1.4, 1.3, 1, 0.45, 0.35, 1, 0, 4);
                    else B.push('pshot', spr('trace'), s.x, s.y, rot, 1, 1.1, 1, 0.82, 0.45, 0.95, 0, 4);
                    break;
                case 'drone': B.push('pshot', spr('trace'), s.x, s.y, rot, 0.8, 0.7, 0.5, 0.9, 1, 0.9, 0, 4); break;
                case 'ally': B.push('pshot', spr('trace'), s.x, s.y, rot, 1.1, 1, 1, 0.75, 0.3, 1, 0, 4); break;
                case 'bomblet': B.push('pshot', spr('glow'), s.x, s.y, 0, 0.35, 0.35, 1, 0.6, 0.2, 1, 0, 7); break;
                case 'msl':
                    B.push('pshot', spr('glow'), s.x - Math.cos(s.ang) * 8, s.y - Math.sin(s.ang) * 8, 0, 0.4, 0.4, 1, 0.6, 0.25, 1, 0, 7);
                    B.push('pshot', spr('pmsl'), s.x, s.y, rot, 1, 1);
                    break;
                case 'rkt':
                    B.push('pshot', spr('glow'), s.x - Math.cos(s.ang) * 7, s.y - Math.sin(s.ang) * 7, 0, 0.35, 0.5, 1, 0.75, 0.3, 1, 0, 7);
                    B.push('pshot', spr('prkt'), s.x, s.y, rot, 1, 1);
                    break;
            }
        }
        this.drawPlayer(B, t);
        this.drawLasers(B, t);
        this.drawBullets(B, t);
    }

    drawPlayer(B, t) {
        const w = this.world;
        const p = w.player;
        const L = w.L;
        const spr = (n) => B.spr(n);
        for (const d of p.drones) {
            if (!p.alive) break;
            B.push('shadow', spr('drone'), d.x + 12, d.y + 18, 0, 1, 1, 1, 1, 1, 0.35, 0, 1);
            B.push('player', spr('drone'), d.x, d.y, 0, 1, 1);
            B.push('player', spr('glow'), d.x, d.y - 3, 0, 0.18, 0.18, 1, 0.6, 0.2, 0.8 + Math.sin(t * 20) * 0.2, 0, 7);
        }
        if (!p.alive) return;
        const blink = p.invuln > 0 && p.bombT <= 0 && Math.floor(t * 18) % 2 === 0;
        const sx = 1 - Math.abs(p.bank) * 0.16;
        const rot = p.bank * 0.12;
        const heli = spr('heli');
        B.push('shadow', heli, p.x + 18, p.y + 26, rot, sx * 0.92, 0.92, 1, 1, 1, 0.38, 0, 1);
        B.push('shadow', spr('rotor'), p.x + 18, p.y + 20, this.rotor, 0.9, 0.9, 1, 1, 1, 0.14, 0, 1);
        if (p.odT > 0) {
            for (let i = 1; i <= 3; i++) B.push('player', heli, p.x - p.vx * 0.012 * i, p.y - p.vy * 0.012 * i + i * 3, rot, sx, 1, 1, 0.75, 0.3, 0.25 / i, 1, 4);
            B.push('fx', spr('glow'), p.x, p.y, 0, 2.2, 2.2, 1, 0.75, 0.25, 0.35 + Math.sin(t * 14) * 0.1, 0, 7);
        }
        const a = blink ? 0.35 : 1;
        const flash = p.hitT > 0 ? 0.8 : 0;
        // pods
        if (L.missiles) for (const s of [-1, 1]) B.push('player', spr('pod_msl'), p.x + (s * (L.rockets ? 17 : 14)) * sx, p.y - 1, rot, 1, 1, 1, 1, 1, a);
        if (L.rockets) for (const s of [-1, 1]) B.push('player', spr('pod_rkt'), p.x + s * (L.missiles ? 10.5 : 14) * sx, p.y - 1, rot, 1, 1, 1, 1, 1, a);
        B.push('player', heli, p.x, p.y, rot, sx * 1.1, 1.08, 0.02, 0.03, 0.04, 0.7 * a, 0, 3);
        B.push('player', heli, p.x, p.y, rot, sx, 1, 1, 1, 1, a, flash, 0);
        B.push('player', spr('glow'), p.x, p.y - 13, 0, 0.16, 0.16, 0.5, 0.95, 1, 0.55 + 0.45 * Math.sin(t * 7), 0, 7);
        // engines
        const eg = p.odT > 0 ? [1, 0.75, 0.3] : [1, 0.5, 0.2];
        for (const s of [-1, 1]) B.push('player', spr('glow'), p.x + s * 5 * sx, p.y + 10, 0, 0.22, 0.3, eg[0], eg[1], eg[2], 0.7 + Math.sin(t * 40 + s) * 0.2, 0, 7);
        // rotors
        B.push('player', spr('rotor'), p.x, p.y - 7, this.rotor, 1, 1, 1, 1, 1, 0.8 * a);
        B.push('player', spr('rotor'), p.x, p.y - 7, this.rotor + 0.35, 1, 1, 1, 1, 1, 0.35 * a);
        B.push('player', spr('tailrotor'), p.x + 1.5, p.y + 30, this.rotor * 1.6, 1, 1, 1, 1, 1, 0.9 * a);
        // nav lights
        if (Math.floor(t * 1.2) % 2 === 0) {
            B.push('player', spr('glow'), p.x - 17 * sx, p.y - 1, 0, 0.14, 0.14, 1, 0.2, 0.2, 1, 0, 7);
            B.push('player', spr('glow'), p.x + 17 * sx, p.y - 1, 0, 0.14, 0.14, 0.2, 1, 0.3, 1, 0, 7);
        }
        if (p.shield) B.push('top', spr('ring'), p.x, p.y, 0, 0.42 + Math.sin(t * 4) * 0.01, 0.42, 0.3, 0.85, 1, 0.55, 0, 7);
        if (p.beam) {
            const len = p.y + 20;
            const fl = 0.85 + Math.sin(t * 60) * 0.15;
            B.pushWH('fx', spr('beam'), p.x, (p.y - 24) / 2, Math.PI / 2, len, 40 * fl, 0.25, 0.7, 1, 0.9, 0, 7);
            B.pushWH('fx', spr('beam'), p.x, (p.y - 24) / 2, Math.PI / 2, len, 14 * fl, 1, 1, 1, 1, 0, 7);
            B.push('top', spr('flare'), p.x, p.y - 26, t * 9, 0.5, 0.5, 0.6, 0.9, 1, 1, 0, 7);
        }
        if (p.focus || this.opts.hitbox) {
            B.push('top', spr('hitbox'), p.x, p.y, 0, 0.6 * L.hitboxMul + 0.15, 0.6 * L.hitboxMul + 0.15, 1, 1, 1, 0.95);
            if (p.focus) B.push('top', spr('ring'), p.x, p.y, -t, 0.38, 0.38, 1, 1, 1, 0.25, 0, 7);
        }
        // winch rope to a beacon being rescued
        for (const e of w.enemies) {
            if (e.kind !== 'beacon' || !e.alive || !e.data.near || e.data.done) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const len = Math.hypot(dx, dy) * Math.min(1, e.data.prog * 1.6);
            const ang = Math.atan2(dy, dx);
            B.pushWH('player', spr('beam'), p.x + Math.cos(ang) * len / 2, p.y + Math.sin(ang) * len / 2, ang, len, 3, 0.2, 0.2, 0.2, 0.9, 0, 0);
        }
    }

    drawEnemy(B, e, t) {
        const spr = (n) => B.spr(n);
        const f = e.flash > 0 ? 0.85 : 0;
        const layer = e.ground ? 'ground' : 'air';
        const shadow = (s, sc = 1, off = 1) => B.push('shadow', s, e.x + 16 * off, e.y + 24 * off, e.rot, sc, sc, 1, 1, 1, 0.35, 0, 1);
        const gshadow = (s, sc = 1) => B.push('ground', s, e.x + 3, e.y + 4, e.rot, sc, sc, 1, 1, 1, 0.4, 0, 1);
        const elite = (s, sc = 1) => { if (e.elite) B.push(layer, s, e.x, e.y, e.rot, sc * 1.18, sc * 1.18, 0.75, 0.35, 1, 0.55 + Math.sin(t * 8) * 0.25, 0, 7); };
        switch (e.kind) {
            case 'hornet': {
                const s = spr('hornet');
                shadow(s, 1, 0.8); elite(s);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                B.push(layer, spr('rotor_e'), e.x, e.y, this.rotor * 1.3 + e.id, 0.5, 0.5, 1, 1, 1, 0.7);
                break;
            }
            case 'jet': {
                const s = spr('jet');
                shadow(s, 1, 1.2); elite(s);
                const bx = Math.sin(e.rot), by = -Math.cos(e.rot);
                B.push('fx', spr('glow'), e.x - bx * 22, e.y - by * 22, 0, 0.3, 0.3, 1, 0.5, 0.25, 0.9, 0, 7);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                break;
            }
            case 'gunship': {
                const s = spr('gunship');
                shadow(s); elite(s);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                B.push(layer, spr('rotor_e'), e.x, e.y + 4, this.rotor + e.id, 1.05, 1.05, 1, 1, 1, 0.75);
                B.push(layer, spr('glow'), e.x, e.y + 22, 0, 0.12, 0.12, 1, 0.2, 0.25, Math.floor(t * 3) % 2, 0, 7);
                break;
            }
            case 'bomber': {
                const s = spr('bomber');
                shadow(s, 1, 1.5); elite(s);
                for (const dx of [-30, -16, 16, 30]) B.push('fx', spr('glow'), e.x + dx, e.y - 22, 0, 0.3, 0.35, 1, 0.45, 0.2, 0.8, 0, 7);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                break;
            }
            case 'carrier': {
                const s = spr('carrier');
                shadow(s, 1, 1.6);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                for (const [dx, dy] of [[-52, -34], [52, -34], [-52, 34], [52, 34]]) {
                    const c = Math.cos(e.rot), sn = Math.sin(e.rot);
                    B.push(layer, spr('fan'), e.x + dx * c - dy * sn, e.y + dx * sn + dy * c, this.rotor * 0.6, 0.9, 0.9);
                }
                break;
            }
            case 'warhawk': {
                const s = spr('warhawk');
                shadow(s, 1, 1.4);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                const c = Math.cos(e.rot), sn = Math.sin(e.rot);
                for (const dy of [-26, 26]) B.push(layer, spr('rotor_e'), e.x - dy * sn, e.y + dy * c, this.rotor * (dy > 0 ? 1 : -1), 1.1, 1.1, 1, 1, 1, 0.7);
                break;
            }
            case 'mine': {
                const s = spr('mine');
                shadow(s, 1, 0.7); elite(s);
                B.push(layer, s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                if (Math.floor(t * 4 + e.id) % 2) B.push('fx', spr('glow'), e.x, e.y, 0, 0.35, 0.35, 1, 0.8, 0.2, 0.9, 0, 7);
                break;
            }
            case 'missile': {
                const s = spr('emissile');
                shadow(s, 1, 0.6);
                const bx = Math.sin(e.rot), by = -Math.cos(e.rot);
                B.push('fx', spr('glow'), e.x - bx * 10, e.y - by * 10, 0, 0.3, 0.3, 1, 0.4, 0.3, 1, 0, 7);
                B.push('air', s, e.x, e.y, e.rot, 1.1, 1.1, 1, 1, 1, 1, f);
                B.push('top', spr('lock'), e.x, e.y, t * 2, 0.4, 0.4, 1, 0.3, 0.3, 0.5, 0, 7);
                break;
            }
            case 'tank': case 'aa': case 'sam': case 'turret': case 'radar': {
                const base = spr(e.kind), top = spr(e.kind + '_t');
                gshadow(base); elite(base);
                B.push('ground', base, e.x, e.y, e.kind === 'tank' ? e.rot : 0, 1, 1, 1, 1, 1, 1, f);
                const tr = e.kind === 'radar' ? e.trot : e.kind === 'turret' ? e.trot : e.trot + Math.PI / 2;
                B.push('ground', top, e.x + 2, e.y + 3, tr, 1, 1, 1, 1, 1, 0.35, 0, 1);
                B.push('ground', top, e.x, e.y, tr, 1, 1, 1, 1, 1, 1, f);
                break;
            }
            case 'bunker': case 'fueltank': case 'depot': case 'truck': {
                const s = spr(e.kind);
                gshadow(s); elite(s);
                B.push('ground', s, e.x, e.y, e.kind === 'truck' ? e.rot : 0, 1, 1, 1, 1, 1, 1, f);
                if (e.kind === 'bunker') B.push('ground', spr('glow'), e.x, e.y, 0, 0.3, 0.3, 0.3, 1, 0.5, 0.6 + Math.sin(t * 5) * 0.3, 0, 7);
                if (e.kind === 'depot') B.push('top', spr('gear'), e.x, e.y - 28 + Math.sin(t * 3) * 2, t, 0.9, 0.9, 1, 1, 1, 0.9);
                break;
            }
            case 'boat': case 'icebreaker': {
                const s = spr(e.kind);
                B.push('ground', s, e.x + 2, e.y + 3, e.rot, 1, 1, 1, 1, 1, 0.3, 0, 1); elite(s);
                B.push('ground', s, e.x, e.y, e.rot, 1, 1, 1, 1, 1, 1, f);
                const c = Math.cos(e.rot), sn = Math.sin(e.rot);
                const turrets = e.kind === 'boat' ? [-10] : [-26, -12];
                for (const dy of turrets) B.push('ground', spr(e.kind === 'boat' ? 'boat_t' : 'aa_t'), e.x - dy * sn, e.y + dy * c, e.trot + Math.PI / 2, 1, 1, 1, 1, 1, 1, f);
                break;
            }
            case 'walker': {
                const s = spr('walker');
                gshadow(s); elite(s);
                const c = Math.cos(e.rot), sn = Math.sin(e.rot);
                for (let i = 0; i < 4; i++) {
                    const side = i < 2 ? -1 : 1, fwd = i % 2 ? 8 : -8;
                    const step = Math.sin(t * 6 + i * Math.PI / 2) * 4;
                    const lx = side * 13, ly = fwd + step;
                    B.push('ground', spr('walker_leg'), e.x + lx * c - ly * sn, e.y + lx * sn + ly * c, e.rot + side * 0.4, 1, 1, 1, 1, 1, 1, f);
                }
                B.push('ground', s, e.x, e.y, e.trot + Math.PI / 2, 1, 1, 1, 1, 1, 1, f);
                break;
            }
            case 'beacon': {
                if (e.data.done) break;
                B.push('ground', spr('beacon'), e.x, e.y, 0, 1, 1);
                const n = e.data.people || 3;
                for (let i = 0; i < n; i++) {
                    const a = i / n * TAU + 0.5;
                    const wave = Math.sin(t * 8 + i) * 1.2;
                    B.push('ground', spr('person'), e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9 + wave * 0.3, 0, 1.3, 1.3);
                }
                const fl = 0.7 + Math.sin(t * 13) * 0.2 + Math.sin(t * 31) * 0.1;
                B.push('fx', spr('glow'), e.x + 12, e.y - 10, 0, 0.9 * fl, 0.9 * fl, 1, 0.3, 0.2, 0.9, 0, 7);
                B.push('fx', spr('flare'), e.x + 12, e.y - 10, t, 0.35, 0.35, 1, 0.6, 0.4, 1, 0, 7);
                if (Math.random() < 0.2) this.fx.smokePuff(e.x + 12, e.y - 10, 10, 0.5, 'gsmoke', 1, 0.7);
                const pr = e.data.prog || 0;
                B.push('top', spr('ring'), e.x, e.y, 0, 0.42, 0.42, 0.4, 1, 0.6, e.data.near ? 0.9 : 0.35 + Math.sin(t * 4) * 0.15, 0, 7);
                if (pr > 0) B.push('top', spr('glow'), e.x, e.y, 0, pr * 1.2, pr * 1.2, 0.4, 1, 0.6, 0.6, 0, 7);
                break;
            }
        }
    }

    drawBoss(B, b, t) {
        const spr = (n) => B.spr(n);
        const f = b.flash > 0 ? 0.6 : 0;
        const pf = (p) => (p.flash > 0 ? 0.8 : 0);
        const P = (id) => b.parts.find((p) => p.id === id);
        const dying = b.dying ? Math.min(1, b.dieT / 3.4) : 0;
        const dim = 1 - dying * 0.4;
        switch (b.bossId) {
            case 'leviathan': {
                const hull = spr('lev_hull');
                const sink = b.dying ? 1 - dying * 0.25 : 1;
                B.push('ground', hull, b.x + 5, b.y + 7, Math.PI, sink, sink, 1, 1, 1, 0.45, 0, 1);
                B.push('boss', hull, b.x, b.y, Math.PI, sink, sink, dim, dim, dim, 1, f);
                for (const p of b.parts) {
                    if (p.id === 'core') { B.push('boss', spr('lev_core'), p.x, p.y, Math.PI, sink, sink, dim, dim, dim, 1, b.invuln ? 0 : f); continue; }
                    if (!p.alive) { B.push('boss', spr('scorch1'), p.x, p.y, p.rot, 0.5, 0.5, 1, 1, 1, 0.9); continue; }
                    const s = p.id === 'silo' ? spr('lev_silo') : spr('lev_turret');
                    B.push('boss', s, p.x, p.y, p.id === 'silo' ? 0 : p.rot, sink, sink, 1, 1, 1, 1, pf(p));
                }
                // wake
                if (Math.random() < 0.5) this.fx.p({ spr: 'smoke' + ((Math.random() * 4) | 0), x: b.x + (Math.random() - 0.5) * 160, y: b.y - 200, life: 2, s0: 0.6, s1: 2, r: 0.9, g: 0.95, b: 1, a: 0.5, ramp: 2, layer: 'gfx', scroll: 1 });
                if (!b.invuln) B.push('fx', spr('glow'), b.x, b.y - 10, 0, 1.2, 0.6, 1, 0.2, 0.3, 0.4 + Math.sin(t * 6) * 0.2, 0, 7);
                break;
            }
            case 'mantis': {
                const a = b.anim;
                for (let i = 0; i < 4; i++) {
                    const side = i < 2 ? -1 : 1, fwd = i % 2 ? 40 : -30;
                    const step = Math.sin(a.step * 2 + i * 1.7) * 10;
                    B.push('ground', spr('man_leg'), b.x + side * 64 + 4, b.y + fwd + step + 6, side * 0.6, 1, 1, 1, 1, 1, 0.4, 0, 1);
                    B.push('boss', spr('man_leg'), b.x + side * 64, b.y + fwd + step, side * 0.6, 1, 1, dim, dim, dim, 1, f);
                }
                B.push('ground', spr('man_body'), b.x + 8, b.y + 10, Math.PI, 1, 1, 1, 1, 1, 0.45, 0, 1);
                B.push('boss', spr('man_body'), b.x, b.y, Math.PI, 1, 1, dim, dim, dim, 1, f);
                for (const id of ['armL', 'armR']) {
                    const p = P(id);
                    const ang = id === 'armL' ? a.armL : a.armR;
                    const bx = b.x + p.ox, by = b.y + p.oy;
                    const c = p.alive ? 1 : 0.35;
                    B.push('boss', spr('man_arm'), bx + Math.sin(ang) * 30, by + Math.cos(ang) * 26 + 20, -ang, 1, 1, c, c, c, 1, pf(p));
                    if (p.alive) B.push('fx', spr('glow'), p.x, p.y + 30, 0, 0.5, 0.5, 0.4, 1, 0.3, 0.5, 0, 7);
                }
                const core = P('core');
                B.push('boss', spr('man_head'), core.x, core.y + 10, Math.PI, 1, 1, dim, dim, dim, 1, b.invuln ? 0 : f);
                for (const s of [-1, 1]) B.push('fx', spr('glow'), core.x + s * 12, core.y + 18, 0, 0.3, 0.3, 0.4, 1, 0.3, b.invuln ? 0.4 : 1, 0, 7);
                break;
            }
            case 'sandwyrm': {
                const sub = b.submerged ? 0.25 : 1;
                for (let i = b.parts.length - 1; i >= 1; i--) {
                    const p = b.parts[i];
                    const name = p.id === 'tail' ? 'wyrm_tail' : p.alive ? 'wyrm_seg' : 'wyrm_husk';
                    B.push('ground', spr(name), p.x + 6, p.y + 8, p.rot, 1, 1, 1, 1, 1, 0.4 * sub, 0, 1);
                    B.push('boss', spr(name), p.x, p.y, p.rot, 1, 1, dim, dim, dim, sub, pf(p));
                    if (!p.alive && p.id !== 'tail' && Math.random() < 0.15) this.fx.p({ spr: 'fire' + ((Math.random() * 4) | 0), x: p.x, y: p.y, life: 0.4, s0: 0.4, s1: 0.1, ramp: 1, mode: 4, layer: 'fx' });
                }
                B.push('ground', spr('wyrm_head'), b.x + 6, b.y + 8, b.rot + Math.PI, 1, 1, 1, 1, 1, 0.4 * sub, 0, 1);
                B.push('boss', spr('wyrm_head'), b.x, b.y, b.rot + Math.PI, 1, 1, dim, dim, dim, sub, b.invuln ? 0 : f);
                const dx = -Math.sin(b.rot) * -40, dy = Math.cos(b.rot) * 40;
                B.push('boss', spr('wyrm_drill'), b.x - dx * 0.2, b.y + dy * 0.2, t * (b.anim.drill ? 20 : 6), 0.7, 0.7, dim, dim, dim, sub);
                break;
            }
            case 'bastion': {
                const base = spr('bas_base');
                B.push('boss', base, b.x, b.y, 0, 1, 1, dim, dim, dim, 1);
                for (const p of b.parts) {
                    if (p.id === 'cL' || p.id === 'cR') {
                        if (p.alive) B.push('boss', spr('bas_cannon'), p.x, p.y, p.rot || Math.PI, 1, 1, 1, 1, 1, 1, pf(p));
                        else B.push('boss', spr('scorch0'), p.x, p.y, 0, 0.6, 0.6, 1, 1, 1, 0.9);
                    }
                }
                const core = P('core');
                B.push('boss', spr('bas_core'), core.x, core.y, t * 0.2, 1, 1, dim, dim, dim, 1, b.invuln ? 0 : f);
                B.push('fx', spr('glow'), core.x, core.y, 0, 1.3, 1.3, 0.4, 0.8, 1, b.invuln ? 0.25 : 0.6 + Math.sin(t * 5) * 0.2, 0, 7);
                for (const p of b.parts) {
                    if (p.id[0] !== 'p' || !p.alive) continue;
                    B.push('air', spr('bas_plate'), p.x + 10, p.y + 14, p.rot, 1, 1, 1, 1, 1, 0.35, 0, 1);
                    B.push('air', spr('bas_plate'), p.x, p.y, p.rot, 1, 1, 1, 1, 1, 1, pf(p));
                    B.push('fx', spr('bas_plate'), p.x, p.y, p.rot, 1.05, 1.05, 0.3, 0.7, 1, 0.25, 0, 7);
                }
                break;
            }
            case 'seraph': {
                const s = spr('ser_body');
                for (const d of b.anim.decoys || []) {
                    if (!d) continue;
                    B.push('air', s, d.x, d.y, Math.PI, 1, 1, 0.8, 0.5, 1, 0.45, 0, 4);
                    B.push('air', spr('rotor_gold'), d.x, d.y - 4, -this.rotor, 1.1, 1.1, 1, 1, 1, 0.3);
                }
                B.push('shadow', s, b.x + 20, b.y + 30, Math.PI + (b.rot || 0), 1, 1, 1, 1, 1, 0.35, 0, 1);
                B.push('air', s, b.x, b.y, Math.PI + (b.rot || 0), 1, 1, dim, dim, dim, 1, f);
                B.push('air', spr('rotor_gold'), b.x, b.y + 4, this.rotor * 1.2, 1.15, 1.15, 1, 1, 1, 0.42);
                B.push('air', spr('ser_crown'), b.x, b.y + 4, t * 2, 1, 1, 1, 1, 1, 1, b.invuln ? 0 : f);
                B.push('fx', spr('glow'), b.x, b.y + 4, 0, 0.8, 0.8, 1, 0.2, 0.35, 0.6 + Math.sin(t * 9) * 0.3, 0, 7);
                for (const s2 of [-1, 1]) B.push('fx', spr('glow'), b.x + s2 * 40, b.y - 11, 0, 0.5, 0.5, 1, 0.8, 0.3, 0.7, 0, 7);
                break;
            }
            case 'meridian': {
                const a = b.anim;
                B.push('boss', spr('mer_ring1'), b.x, b.y, a.ring1, 1, 0.8, dim, dim, dim, 0.95);
                B.push('boss', spr('mer_ring2'), b.x, b.y, a.ring2, 1, 0.8, dim, dim, dim, 0.95);
                B.push('fx', spr('glow'), b.x, b.y, 0, 4.5, 4.5, 1, 0.15, 0.25, 0.25 + (a.charge || 0) * 0.15, 0, 7);
                B.push('boss', spr('mer_core'), b.x, b.y, a.ring1 * 0.2, 1, 1, dim, dim, dim, 1, b.invuln ? 0 : f);
                const ey = spr('mer_eye');
                B.push('fx', ey, b.x + (a.eye || 0) * 6, b.y, 0, 1 + Math.sin(t * 3) * 0.05, 1, 1, 1, 1, b.invuln ? 0.5 : 1, 0, 4);
                for (const p of b.parts) {
                    if (p.id[0] !== 'n' || !p.alive) continue;
                    B.push('shadow', spr('mer_node'), p.x + 14, p.y + 20, p.rot + Math.PI / 2, 1, 1, 1, 1, 1, 0.35, 0, 1);
                    B.push('air', spr('mer_node'), p.x, p.y, p.rot + Math.PI / 2, 1, 1, 1, 1, 1, 1, pf(p));
                    B.push('fx', spr('glow'), p.x, p.y, 0, 0.7, 0.7, 1, 0.2, 0.4, 0.6, 0, 7);
                }
                break;
            }
        }
    }

    drawLasers(B, t) {
        const spr = (n) => B.spr(n);
        const beam = spr('beam');
        for (const l of this.world.bs.lasers) {
            const c = PALETTE[l.color] || [1, 0.3, 0.6];
            const dx = Math.cos(l.ang), dy = Math.sin(l.ang);
            const cx = l.x + dx * l.len / 2, cy = l.y + dy * l.len / 2;
            if (!l.live) {
                const fl = 0.35 + 0.35 * Math.abs(Math.sin(t * 30));
                const k = l.t / l.warm;
                B.pushWH('fx', beam, cx, cy, l.ang, l.len, 3 + k * 4, c[0], c[1], c[2], fl, 0, 7);
                B.push('top', spr('glow'), l.x, l.y, 0, 0.4 + k * 0.6, 0.4 + k * 0.6, c[0], c[1], c[2], 0.8, 0, 7);
            } else {
                const fl = 0.9 + Math.sin(t * 50) * 0.1;
                const k = Math.min(1, (l.t - l.warm) / 0.12) * Math.min(1, (l.warm + l.dur - l.t) / 0.15);
                B.pushWH('fx', beam, cx, cy, l.ang, l.len, l.width * 3.2 * fl * k, c[0], c[1], c[2], 0.9, 0, 7);
                B.pushWH('ebullet', beam, cx, cy, l.ang, l.len, l.width * 1.1 * fl * k, 1, 1, 1, 1, 0, 7);
                B.push('top', spr('flare'), l.x, l.y, t * 7, 0.8 * k, 0.8 * k, c[0], c[1], c[2], 1, 0, 7);
                if (Math.random() < 0.4) this.fx.p({ spr: 'spark', x: l.x, y: l.y, vx: dx * 300 + (Math.random() - 0.5) * 200, vy: dy * 300 + (Math.random() - 0.5) * 200, life: 0.2, s0: 0.5, r: c[0], g: c[1], b: c[2], ramp: 3, mode: 7, layer: 'top', stretch: 1 });
            }
        }
    }

    drawBullets(B, t) {
        const list = this.world.bs.list;
        const sprs = this._bsprs || (this._bsprs = Object.fromEntries(Object.keys(STYLE).map((k) => [k, B.spr('b_' + k)])));
        const glow = B.spr('glow');
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            const c = PALETTE[b.color] || PALETTE[0];
            if (b.delay > 0) {
                const k = Math.max(0, 1 - b.delay / 1.2);
                B.push('ebullet', glow, b.x, b.y, 0, 0.12 + k * 0.2, 0.12 + k * 0.2, c[0], c[1], c[2], 0.3 + k * 0.4, 0, 7);
                continue;
            }
            const st = STYLE[b.style];
            const rot = st.long ? b.ang + Math.PI / 2 : st.spin ? b.t * 5 : 0;
            const pop = b.t < 0.08 ? 1.6 - b.t / 0.08 * 0.6 : 1;
            B.push('ebullet', sprs[b.style], b.x, b.y, rot, pop, pop, c[0], c[1], c[2], 1, 0, 2);
        }
    }
}
