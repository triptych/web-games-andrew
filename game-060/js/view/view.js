// The view: turns the sim into voxel pixels every frame and turns sim events into
// explosions, debris, shakes, flashes, banners and popups.

import { Renderer } from './renderer.js';
import { Backdrops } from './backdrops.js';
import { VoxelBatch } from './voxels.js';
import { Fx } from './fx.js';
import { Hud, C } from './hud.js';
import { W, H, FIELD, CAPSULE_INFO } from '../config.js';
import { hash01 } from '../rng.js';
import { INVADERS, UFO, BALL_SPRITE, FIREBALL_SPRITE, BULLETS, CAPSULE_COLORS, CAPSULE_LETTER, CAPSULE_SHAPE, paddlePixels, hex, ROW_COLORS } from '../art/sprites.js';
import { GLYPHS } from '../art/font.js';
import { SECTORS } from '../sim/levels.js';

const HEXC = new Map();
const rgbOf = (h) => { let c = HEXC.get(h); if (!c) { c = hex(h); HEXC.set(h, c); } return c; };
const WHITE = [1.6, 1.6, 1.6];
const PRIZE_Q = [[0, 4], [1, 4], [2, 3], [1, 2], [1, 0]];

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.back = new Backdrops(this.r.scene);
        this.vox = new VoxelBatch(this.r.scene, 18000, true);
        this.fx = new Fx(this.r.scene);
        this.hud = new Hud(this.r.hudScene);
        this.chips = new Map();
        this.trails = new Map();
        this.paddleCache = new Map();
        this.beat = 0;
        this.t = 0;
        this.logo = this.buildLogo();
        this.logoBall = { x: 60, y: 200, vx: 70, vy: 55 };
        this.back.set('synth');
    }

    reset() {
        this.chips.clear(); this.trails.clear(); this.fx.clear(); this.hud.clearEffects();
    }

    setBackdrop(name) { this.back.set(name); }

    stageBackdrop(w) {
        if (w.stage.type === 'challenge') return 'warp';
        return SECTORS[w.stage.sector].backdrop;
    }

    // ================================================================== events
    onEvent(e, w) {
        const fx = this.fx, r = this.r, hud = this.hud;
        switch (e.type) {
            case 'beat': this.beat = 1; break;
            case 'stageStart':
                this.chips.clear(); this.trails.clear(); hud.clearEffects();
                this.setBackdrop(this.stageBackdrop(w));
                if (w.stage.type === 'wave') hud.banner(`STAGE ${e.label}`, { sub: e.name, color: C.cyan, dur: 2.1, y: 150 });
                else if (w.stage.type === 'challenge') hud.banner('CHALLENGING', { sub: 'STAGE', color: C.yellow, subColor: C.yellow, dur: 2.1, y: 150 });
                break;
            case 'bossIntro':
                hud.banner('WARNING!!', { sub: e.title, color: C.red, subColor: C.white, dur: 2.1, y: 140, blink: true });
                r.flashScreen([1, 0.1, 0.2], 0.25);
                break;
            case 'go': if (w.stage.type !== 'boss') hud.banner('GO!', { color: C.yellow, dur: 0.7, y: 150, scale: 3 }); else hud.banner(w.boss.def.name, { color: C.pink, dur: 1.2, y: 150 }); break;
            case 'paddle': fx.sparks(e.x, e.y - 1, [0.5, 0.9, 1], 4, 50, 0.2); break;
            case 'launch': fx.ring(e.x, e.y, [0.4, 0.9, 1], 8, 0.2, 0.7); break;
            case 'hit': this.chip(e, 0.32); fx.sparks(e.x + e.w / 2, e.y + e.h / 2, [1, 1, 1], 5, 70, 0.25); r.shake(1, 0.08); break;
            case 'kill': this.killFx(e); break;
            case 'brick': this.brickFx(e); break;
            case 'crack': fx.sparks(e.x, e.y, e.btype === '=' ? [0.8, 0.85, 1] : [1, 0.9, 0.6], 6, 60, 0.25); break;
            case 'clank': fx.sparks(e.x, e.y, [1, 0.9, 0.5], 4, 50, 0.2); break;
            case 'cell': {
                const c = rgbOf(e.color);
                const g = e.glow ? e.glow : 1;
                if (e.kind === 'shield' && Math.random() < 0.5) break;
                fx.debris(e.x, e.y, [c[0] * g, c[1] * g, c[2] * g], e.x + (Math.random() - 0.5) * 6, e.y + 3, e.src === 'death' ? 1.6 : 0.9, e.s);
                if (e.src === 'death' && Math.random() < 0.15) fx.sparks(e.x, e.y, c, 3, 90);
                break;
            }
            case 'cellHit': fx.sparks(e.x, e.y, e.core ? [1, 1, 1] : [1, 0.8, 0.6], e.core ? 8 : 3, 60, 0.25); break;
            case 'tnt':
                fx.explode(e.x, e.y, [1, 0.55, 0.15], 2.2);
                fx.ring(e.x, e.y, [1, 0.9, 0.4], 46, 0.45, 0.6);
                r.shake(4, 0.3, 0.02); r.flashScreen([1, 0.6, 0.2], 0.22); r.aberrate(2.5);
                break;
            case 'boom': fx.explode(e.x, e.y, [1, 0.4, 0.15], 0.9); r.shake(2, 0.15); break;
            case 'swat': fx.sparks(e.x, e.y, [1, 1, 1], 5, 60, 0.2); break;
            case 'splash': fx.sparks(e.x, e.y, [0.4, 1, 0.5], 3, 40, 0.2); break;
            case 'reflect': fx.sparks(e.x, e.y, [0.5, 1, 1], 8, 80, 0.3); hud.popup('REFLECT!', e.x, e.y - 8, C.cyan, 0.6); break;
            case 'deflect': fx.ring(e.x, e.y, [0.4, 0.9, 1], 10, 0.2, 0.8); break;
            case 'laser': fx.flash(e.x, e.y + 2, [0.4, 0.9, 1], 4, 0.06); break;
            case 'ufoKill':
                this.burstSprite(UFO, 0, e.x, e.y, (k) => UFO.colors[k], 1.4);
                fx.explode(e.x + e.w / 2, e.y + e.h / 2, [1, 0.3, 0.3], 1.6);
                hud.popup(String(e.pts), e.x + e.w / 2, e.y - 6, C.yellow, 1.8);
                r.shake(3, 0.2);
                break;
            case 'score': if (e.pts >= 100 || Math.random() < 0.35) hud.popup(String(e.pts), e.x, e.y, e.pts >= 1000 ? C.yellow : e.pts >= 300 ? C.pink : C.white, e.pts >= 300 ? 1.1 : 0.7); break;
            case 'chain': hud.popup(`CHAIN x${e.mult}`, e.x, e.y + 10, [C.yellow, C.orange, C.pink, C.cyan][e.mult % 4], 1.0); fx.ring(e.x, e.y, [1, 0.9, 0.3], 22, 0.3, 0.7); break;
            case 'capsule': break;
            case 'power': {
                const c = rgbOf(CAPSULE_COLORS[e.kind]);
                fx.ring(e.x, w.paddle.y + 3, c, 30, 0.35, 0.9);
                fx.sparks(e.x, w.paddle.y + 4, c, 14, 90, 0.4);
                hud.popup(CAPSULE_INFO[e.kind].name + '!', e.x, w.paddle.y + 22, '#' + CAPSULE_COLORS[e.kind].toString(16).padStart(6, '0'), 1.1);
                if (e.kind === 'P') hud.banner('1UP!', { color: C.green, dur: 1.2, y: 160 });
                break;
            }
            case 'playerDie': {
                const p = w.paddle;
                const px = paddlePixels(Math.round(p.w));
                for (const q of px) if (Math.random() < 0.7) this.fx.debris(p.x - Math.round(p.w) / 2 + q.x, p.y + q.y, q.c, p.x, p.y - 4, 1.4, 1);
                fx.explode(p.x, p.y + 3, [1, 0.5, 0.2], 2.4);
                fx.ring(p.x, p.y + 3, [1, 1, 1], 60, 0.6, 0.7);
                r.shake(6, 0.5, 0.05); r.flashScreen([1, 0.2, 0.2], 0.45); r.aberrate(4);
                if (e.cause === 'invasion') hud.banner('INVASION!', { color: C.red, dur: 1.6, y: 150, blink: true });
                break;
            }
            case 'respawn': fx.ring(w.paddle.x, w.paddle.y + 3, [0.4, 0.9, 1], 30, 0.5, 0.9); if (e.cont) hud.banner('GET READY', { color: C.cyan, dur: 1.4, y: 150 }); break;
            case 'nova':
                r.flashScreen([1, 0.85, 1], 0.85); r.shake(7, 0.6, 0.06); r.aberrate(5);
                for (let i = 0; i < 4; i++) fx.ring(e.x, e.y + 4, [1, 0.5 + i * 0.12, 0.9], 70 + i * 60, 0.5 + i * 0.12, 0.9);
                fx.sparks(e.x, e.y + 6, [1, 0.6, 1], 60, 260, 0.7);
                hud.banner('NOVA!', { color: C.pink, dur: 0.9, y: 150, scale: 3 });
                break;
            case 'barrier': fx.sparks(e.x, FIELD.ground - 2, [0.7, 0.5, 1], 12, 90, 0.35); fx.ring(e.x, FIELD.ground - 2, [0.7, 0.4, 1], 18, 0.3, 0.8); break;
            case 'ballLost': fx.sparks(e.x, FIELD.ground, [1, 0.3, 0.3], 10, 60, 0.4); break;
            case 'ballSaved': break;
            case 'extraLife': hud.banner('EXTRA SHIP!', { color: C.green, dur: 1.6, y: 160 }); r.flashScreen([0.3, 1, 0.4], 0.2); break;
            case 'ballCaptured': hud.banner('BALL CAPTURED!', { color: C.purple, dur: 1.4, y: 160, scale: 1 }); break;
            case 'captured': fx.ring(e.x, e.y, [0.6, 0.4, 1], 14, 0.3, 0.9); break;
            case 'rescue': hud.banner('RESCUED!', { color: C.green, dur: 1.2, y: 160, scale: 2 }); break;
            case 'bossHit': fx.flash(e.x, e.y, [1, 1, 1], 10, 0.12); fx.sparks(e.x, e.y, [1, 0.9, 1], 10, 110, 0.35); r.shake(2, 0.12); r.aberrate(1.2); break;
            case 'bossPhase':
                fx.explode(e.x, e.y, [1, 0.3, 0.5], 2.5); r.flashScreen([1, 0.3, 0.4], 0.5); r.shake(6, 0.5, 0.04);
                hud.banner(e.phase >= 2 ? '!!DESPERATION!!' : '!!RAGE MODE!!', { color: C.red, dur: 1.4, y: 160, scale: 1, blink: true });
                break;
            case 'coreExposed':
                hud.banner('CORE EXPOSED!', { color: C.yellow, dur: 1.6, y: 160, scale: 1, blink: true });
                r.flashScreen([1, 0.9, 0.4], 0.35); r.shake(4, 0.4, 0.03);
                break;
            case 'gunDown': fx.explode(e.x, e.y, [1, 0.6, 0.2], 1.2); hud.popup('GUN DOWN!', e.x, e.y - 10, C.orange, 1); break;
            case 'regen': if (Math.random() < 0.5) fx.sparks(e.x, e.y, [0.4, 1, 0.6], 2, 25, 0.3); break;
            case 'blast': fx.explode(e.x, e.y, [1, 0.5 + Math.random() * 0.4, 0.2], 1.3); r.shake(3, 0.15, 0.02); break;
            case 'bossDie': r.flashScreen([1, 1, 1], 0.6); r.shake(5, 0.6, 0.04); hud.banner(e.name, { sub: 'DESTROYED', color: C.yellow, subColor: C.white, dur: 3.0, y: 120 }); break;
            case 'bossFinal':
                r.flashScreen([1, 1, 0.9], 1); r.shake(9, 0.9, 0.08); r.aberrate(6);
                for (let i = 0; i < 5; i++) fx.ring(e.x, e.y, [1, 0.8 - i * 0.1, 0.4 + i * 0.1], 80 + i * 50, 0.6 + i * 0.15, 0.9);
                fx.sparks(e.x, e.y, [1, 0.8, 0.4], 80, 300, 1.0);
                break;
            case 'waveClear': hud.banner('WAVE CLEAR!', { color: C.green, dur: 1.6, y: 150, sub: e.sweep ? 'BRICK SWEEP!' : '' }); break;
            case 'beamFire': r.shake(2, 0.6); break;
            case 'build': fx.sparks(e.x, e.y, [1, 0.85, 0.3], 6, 50, 0.35); break;
            case 'summon': fx.ring(e.x, e.y, [0.7, 1, 0.4], 26, 0.3, 0.7); break;
            case 'gameOver': hud.banner('GAME OVER', { color: C.red, dur: 2.5, y: 150 }); break;
            case 'jawOpen': r.shake(1, 0.2); break;
            case 'jawShut': r.shake(2, 0.15); fx.sparks(e.x, e.y, [0.8, 0.85, 1], 10, 80, 0.3); break;
        }
    }

    /** Knock pixels off a living invader. */
    chip(e, frac) {
        const def = INVADERS[e.kind];
        if (!def) return;
        let set = this.chips.get(e.id);
        if (!set) { set = new Set(); this.chips.set(e.id, set); }
        const px = def.frames[0];
        const n = Math.max(2, Math.round(px.length * frac * 0.5));
        let removed = 0;
        for (let k = 0; k < px.length * 3 && removed < n; k++) {
            const p = px[Math.floor(Math.random() * px.length)];
            const key = p.y * 16 + p.x;
            if (set.has(key) || p.k === 'o' || p.k === 'y') continue;
            set.add(key); removed++;
            this.fx.debris(e.x + p.x, e.y + p.y, def.colors[p.k], e.x + e.w / 2, e.y + e.h / 2, 0.8, 1);
        }
    }

    burstSprite(def, frame, x, y, colorOf, power = 1, skip = null) {
        const cx = x + def.w / 2, cy = y + def.h / 2;
        for (const p of def.frames[frame % def.frames.length]) {
            if (skip && skip.has(p.y * 16 + p.x)) continue;
            this.fx.debris(x + p.x, y + p.y, colorOf(p.k), cx, cy, power, 1);
        }
    }

    killFx(e) {
        const def = INVADERS[e.kind];
        if (!def) return;
        const main = def.colors.X || [1, 1, 1];
        this.burstSprite(def, e.frame || 0, e.x, e.y, (k) => def.colors[k], e.big ? 1.5 : 1.1, this.chips.get(e.id));
        this.chips.delete(e.id);
        this.fx.explode(e.x + e.w / 2, e.y + e.h / 2, main, e.big ? 1.4 : 0.8);
        this.r.shake(e.big ? 3 : 1.5, 0.12);
    }

    brickFx(e) {
        const col = this.brickColor(e.btype, e.color);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        for (let i = 0; i < 10; i++) {
            const x = e.x + 1 + Math.random() * (e.w - 2), y = e.y + 1 + Math.random() * (e.h - 2);
            this.fx.debris(x, y, col, cx, cy - 2, 0.9, 1 + Math.floor(Math.random() * 3));
        }
        this.fx.sparks(cx, cy, col, 6, 70, 0.3);
        if (e.src !== 'clear') this.fx.ring(cx, cy, col, 12, 0.18, 0.5);
        else this.fx.flash(cx, cy, col, 10, 0.15);
    }

    brickColor(bt, color) {
        if (bt === '=') return [0.75, 0.78, 0.9];
        if (bt === 'G') return [1, 0.76, 0.12];
        if (bt === 'X') return [0.95, 0.15, 0.1];
        if (bt === '?') return [1, 0.4, 0.9];
        return rgbOf(color);
    }

    // ================================================================== drawing the world
    drawWorld(w, t) {
        const v = this.vox;
        v.begin();
        // ground line
        v.box(0, FIELD.ground - 1, W, 1, 0.1, 0.55, 0.2, -1);
        if (w.barrier > 0) {
            const ph = Math.floor(t * 20);
            for (let x = 0; x < W; x += 2) v.box(x, FIELD.ground - 4, 1, 1, ...(((x >> 1) + ph) % 4 === 0 ? [1.6, 1.0, 2.2] : [0.5, 0.25, 0.9]), 0);
        }
        const intro = w.state === 'intro' ? Math.min(1, w.stateT / 1.9) : 1;
        this.drawGrids(w, t, intro);
        this.drawSlots(w, t, intro);
        this.drawFree(w, t);
        this.drawUfo(w, t);
        this.drawBeams(w, t);
        if (w.state !== 'dying' && w.state !== 'gameover') this.drawPaddle(w, t);
        this.drawBalls(w, t);
        this.drawShots(w, t);
        this.drawBullets(w, t);
        this.drawCapsules(w, t);
        v.end();
    }

    /** Wave intro: every pixel flies in from somewhere in 3D and snaps into place. */
    fly(id, k, x, y, intro, delay) {
        if (intro >= 1) return null;
        const p = Math.max(0, Math.min(1, (intro - delay) / 0.55));
        if (p >= 1) return null;
        const e = 1 - Math.pow(1 - p, 3);
        const h1 = hash01(id * 977 + k * 31), h2 = hash01(id * 131 + k * 17 + 5), h3 = hash01(id * 71 + k * 7 + 9);
        const inv = 1 - e;
        return [x + (h1 - 0.5) * 320 * inv, y + (h2 - 0.3) * 360 * inv, (200 + h3 * 900) * inv];
    }

    drawGrids(w, t, intro) {
        const v = this.vox;
        for (const g of w.grids) {
            const boss = g.kind === 'boss';
            const coreP = 1.3 + 0.7 * Math.sin(t * 9);
            for (let i = 0; i < g.cells.length; i++) {
                const code = g.cells[i];
                if (!code) continue;
                const ty = g.types[code];
                const c = rgbOf(ty.color);
                let k = ty.glow || 1;
                const col = i % g.cols, row = Math.floor(i / g.cols);
                if (ty.core) k *= coreP;
                if (g.kind === 'shield' && (row % 4 === 0 || (col + Math.floor(row / 4) * 3) % 6 === 0)) k *= 0.45;
                if (boss && code === 10 && w.boss && w.boss.id === 'saucer') k *= ((col + Math.floor(t * 10)) % 3 === 0) ? 2.2 : 0.6;
                if (boss && ty.jaw) k *= 1.1;
                if (ty.hp > 1 && g.hp[i] < ty.hp && !ty.core) k *= 0.55 + 0.45 * (g.hp[i] / ty.hp);
                let r = c[0] * k, gg = c[1] * k, b = c[2] * k;
                const f = g.flash[i];
                if (f > 0) { r += (1.8 - r) * f; gg += (1.8 - gg) * f; b += (1.8 - b) * f; }
                let x = g.x + col * g.cw, y = g.y + row * g.ch, z = 0;
                if (boss && intro < 1) {
                    const o = this.fly(g.id + 9, i, x, y, intro, (1 - row / g.rows) * 0.4);
                    if (o) { x = o[0]; y = o[1]; z = o[2]; }
                }
                v.box(x, y, g.cw, g.ch, r, gg, b, z);
            }
        }
    }

    drawSlots(w, t, intro) {
        const v = this.vox;
        const frame = w.form ? w.form.frame : 0;
        for (const s of w.slots) {
            if (!s.alive) continue;
            const delay = (s.row * 0.09 + s.col * 0.025);
            if (!s.inv) { this.drawBrick(s, t, intro, delay); continue; }
            const def = INVADERS[s.kind];
            const chips = this.chips.get(s.id);
            const fl = s.flash > 0;
            const sx = Math.round(s.x), sy = Math.round(s.y);
            const px = def.frames[s.state === 'form' ? frame : Math.floor(t * 6) % 2];
            for (let i = 0; i < px.length; i++) {
                const p = px[i];
                if (chips && chips.has(p.y * 16 + p.x)) continue;
                const c = fl ? WHITE : def.colors[p.k];
                const glow = p.k === 'o' || p.k === 'y' ? 1.5 : 1;
                let x = sx + p.x, y = sy + p.y, z = 1;
                if (intro < 1) { const o = this.fly(s.id, i, x, y, intro, delay); if (o) { x = o[0]; y = o[1]; z = o[2]; } }
                v.box(x, y, 1, 1, c[0] * glow, c[1] * glow, c[2] * glow, z);
            }
            if (s.held && s.held.length && s.state !== 'beam') {
                // a captured ball glowing under the captor
            }
        }
    }

    drawBrick(s, t, intro, delay) {
        const v = this.vox;
        let x = Math.round(s.x - 0.5) + 0.5, y = Math.round(s.y - 0.5) + 0.5, z = 0;
        x = Math.round(s.x); y = Math.round(s.y);
        if (intro < 1) { const o = this.fly(s.id, 0, x, y, intro, delay); if (o) { x = o[0]; y = o[1]; z = o[2]; } }
        let c = this.brickColor(s.btype, s.color);
        let k = 1;
        if (s.btype === '=' && s.hp < s.maxHp) k = 0.55 + 0.45 * (s.hp / s.maxHp);
        if (s.btype === '#' && s.maxHp > 1 && s.hp < s.maxHp) k = 0.6;
        if (s.btype === '?') { const h = (t * 0.6 + s.id * 0.13) % 1; c = [0.6 + 0.6 * Math.sin(h * 6.28), 0.6 + 0.6 * Math.sin(h * 6.28 + 2.1), 0.6 + 0.6 * Math.sin(h * 6.28 + 4.2)]; }
        if (s.btype === 'X') k = 0.85 + 0.25 * Math.sin(t * 8 + s.id);
        if (s.flash > 0) { c = WHITE; k = 1; }
        const r = c[0] * k, g = c[1] * k, b = c[2] * k;
        v.box(x, y, 15, 11, r * 0.22, g * 0.22, b * 0.22, z - 0.6, 0.8);
        v.box(x, y + 6, 15, 5, r, g, b, z);
        v.box(x, y, 7, 5, r, g, b, z);
        v.box(x + 8, y, 7, 5, r, g, b, z);
        if (s.btype === 'G' && ((t * 1.3 + s.id * 0.37) % 2) < 0.12) v.box(x + 2 + Math.floor(((t * 1.3 + s.id * 0.37) % 2) * 90), y + 8, 1, 1, 2.4, 2.2, 1.6, z + 1);
        if (s.btype === 'X') { for (const [dx, dy] of [[6, 3], [8, 3], [7, 5], [6, 7], [8, 7]]) v.box(x + dx, y + dy, 1, 1, 1.9, 1.7, 0.3, z + 1); }
        if (s.btype === '?') { for (const [dx, dy] of PRIZE_Q) v.box(x + 6 + dx, y + 3 + dy, 1, 1, 2, 2, 2, z + 1); }
        if (s.btype === '=' && s.hp < s.maxHp) { v.box(x + 4, y + 3, 1, 1, 0.1, 0.1, 0.15, z + 1); v.box(x + 5, y + 4, 1, 1, 0.1, 0.1, 0.15, z + 1); v.box(x + 10, y + 7, 1, 1, 0.1, 0.1, 0.15, z + 1); }
    }

    drawFree(w, t) {
        const v = this.vox;
        for (const e of w.free) {
            if (!e.alive) continue;
            const def = INVADERS[e.kind];
            const fl = e.flash > 0;
            const sx = Math.round(e.x), sy = Math.round(e.y);
            for (const p of def.frames[Math.floor(t * 6 + e.id) % 2]) {
                const c = fl ? WHITE : def.colors[p.k];
                v.box(sx + p.x, sy + p.y, 1, 1, c[0], c[1], c[2], 1);
            }
        }
    }

    drawUfo(w, t) {
        const u = w.ufo;
        if (!u) return;
        const v = this.vox;
        const sx = Math.round(u.x), sy = Math.round(u.y);
        const cyc = Math.floor(t * 8);
        for (const p of UFO.frames[0]) {
            let c = UFO.colors[p.k];
            let k = 1;
            if (p.k >= '1' && p.k <= '4') { c = UFO.colors[String(((+p.k + cyc) % 4) + 1)]; k = 2; }
            v.box(sx + p.x, sy + p.y, 1, 1, c[0] * k, c[1] * k, c[2] * k, 1);
        }
    }

    drawPaddle(w, t) {
        const p = w.paddle;
        if (p.invuln > 0 && Math.floor(t * 16) % 2 === 0) return;
        const pw = Math.round(p.w);
        const key = `${pw}|${w.power.L > 0 && w.power.L < 900 ? 1 : 0}|${w.power.C > 0 ? 1 : 0}`;
        let px = this.paddleCache.get(key);
        if (!px) { px = paddlePixels(pw, { laser: key[key.length - 3] === '1', catchy: key.endsWith('1') }); this.paddleCache.set(key, px); }
        const x0 = Math.round(p.x - pw / 2), y0 = Math.round(p.y);
        const v = this.vox;
        const flick = 0.75 + 0.25 * Math.sin(t * 40);
        for (const q of px) v.box(x0 + q.x, y0 + q.y, 1, 1, q.c[0], q.c[1], q.c[2], 1);
        // engine glow under the hull
        for (let x = 5; x < pw - 5; x += 3) v.box(x0 + x, y0 - 1, 1, 1, 0.3 * flick, 0.8 * flick, 1.6 * flick, 1);
    }

    drawBalls(w, t) {
        const v = this.vox;
        const fire = w.power.F > 0;
        const seen = new Set();
        for (const b of w.balls) {
            seen.add(b.id);
            let tr = this.trails.get(b.id);
            if (!tr) { tr = []; this.trails.set(b.id, tr); }
            const bx = Math.round(b.x - 1.5), by = Math.round(b.y - 1.5);
            if (!b.stuck && !b.captured) { tr.unshift([bx, by]); if (tr.length > 7) tr.pop(); } else tr.length = 0;
            for (let i = 2; i < tr.length; i += 1) {
                const k = (1 - i / 8) * 0.55;
                v.box(tr[i][0] + 1, tr[i][1] + 1, 1, 1, (fire ? 1.6 : 0.4) * k, (fire ? 0.6 : 0.8) * k, (fire ? 0.2 : 1.6) * k, 2);
            }
            const spr = fire ? FIREBALL_SPRITE : BALL_SPRITE;
            for (const p of spr.frames[0]) { const c = spr.colors[p.k]; v.box(bx + p.x, by + p.y, 1, 1, c[0], c[1], c[2], 3); }
            if (b.captured && Math.floor(t * 8) % 2) v.box(bx - 1, by - 1, 5, 5, 0.4, 0.2, 0.8, 2.5);
            if (fire && !b.stuck && Math.random() < 0.5) this.fx.sparks(b.x, b.y, [1, 0.5, 0.1], 1, 30, 0.3);
        }
        if (this.trails.size > seen.size) for (const id of [...this.trails.keys()]) if (!seen.has(id)) this.trails.delete(id);
    }

    drawShots(w, t) {
        const v = this.vox;
        const rapid = w.power.L > 0;
        for (const s of w.shots) {
            const x = Math.round(s.x - 0.5), y = Math.round(s.y);
            if (rapid) { v.box(x, y, 1, 6, 2.4, 0.8, 0.5, 2); v.box(x, y + 5, 1, 1, 2.6, 2.6, 2.4, 2.2); }
            else { v.box(x, y, 1, 6, 0.6, 2.0, 2.4, 2); v.box(x, y + 5, 1, 1, 2.6, 2.6, 2.6, 2.2); }
        }
    }

    drawBullets(w, t) {
        const v = this.vox;
        for (const b of w.bullets) {
            const def = BULLETS[b.kind];
            const x0 = Math.round(b.x - def.w / 2), y0 = Math.round(b.y - def.h / 2);
            for (const p of def.frames[Math.floor(t * 10 + b.x) % def.frames.length]) {
                const c = def.colors[p.k];
                v.box(x0 + p.x, y0 + p.y, 1, 1, c[0], c[1], c[2], 2);
            }
        }
    }

    drawCapsules(w, t) {
        const v = this.vox;
        for (const c of w.capsules) {
            const col = rgbOf(CAPSULE_COLORS[c.kind]);
            const x0 = Math.round(c.x), y0 = Math.round(c.y);
            const shine = Math.floor(c.t * 12) % 14;
            for (const p of CAPSULE_SHAPE) {
                const k = p.x === shine ? 2.2 : p.y === 4 ? 1.25 : p.y === 0 ? 0.6 : 1;
                v.box(x0 + p.x, y0 + p.y, 1, 1, col[0] * k, col[1] * k, col[2] * k, 2);
            }
            for (const p of CAPSULE_LETTER[c.kind]) v.box(x0 + p.x, y0 + p.y, 1, 1, 2, 2, 2, 2.5);
        }
    }

    drawBeams(w, t) {
        const v = this.vox;
        for (const bm of w.beams) {
            if (bm.kind === 'beam') {
                const top = w.boss ? w.boss.grid.y : 260;
                const x = Math.round(bm.x - bm.w / 2);
                if (bm.t < bm.warn) {
                    if (Math.floor(t * 14) % 2) for (let y = FIELD.ground; y < top; y += 3) v.box(Math.round(bm.x), y, 1, 1, 2, 0.3, 0.4, 2);
                } else {
                    const k = 1 + 0.4 * Math.sin(t * 60);
                    v.box(x, FIELD.ground, bm.w, top - FIELD.ground, 1.4 * k, 0.3 * k, 0.9 * k, 1.5);
                    v.box(x + 3, FIELD.ground, bm.w - 6, top - FIELD.ground, 2.6, 2.2, 2.6, 1.8);
                }
            } else if (bm.kind === 'tractor' && bm.t >= bm.warn && bm.cy) {
                const cx = bm.cx, cy = Math.round(bm.cy);
                const ph = Math.floor(t * 30);
                for (let y = cy - 1; y > FIELD.ground + 16; y--) {
                    const hw = Math.round(5 + (cy - y) * 0.24);
                    const band = ((y + ph) % 6) === 0;
                    const k = 0.6 + 0.4 * Math.sin((y + t * 40) * 0.3);
                    v.box(Math.round(cx - hw), y, 1, 1, 0.5 * k, 0.4 * k, 1.8 * k, 1.5);
                    v.box(Math.round(cx + hw), y, 1, 1, 0.5 * k, 0.4 * k, 1.8 * k, 1.5);
                    if (band) v.box(Math.round(cx - hw) + 1, y, hw * 2 - 1, 1, 0.25, 0.3, 0.9, 1.4);
                }
            }
        }
    }

    // ================================================================== title logo
    buildLogo() {
        const lines = [['BRICK', 278, [0xff2448, 0xff5a2a, 0xff8a1a, 0xffb02a, 0xffd23a, 0xffe23a, 0xfff07a]], ['VADERS', 230, [0x3aff5a, 0x3affb0, 0x3ae8ff, 0x3aa8ff, 0x3a6aff, 0x7a4aff, 0xb03aff]]];
        const bricks = [];
        for (const [text, top, cols] of lines) {
            const cw = 6, ch = 6;
            const width = (text.length * 6 - 1) * cw;
            const x0 = Math.round((W - width) / 2);
            for (let i = 0; i < text.length; i++) {
                const g = GLYPHS[text[i]];
                for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
                    if (!g[r][c]) continue;
                    bricks.push({ x: x0 + (i * 6 + c) * cw, y: top - (r + 1) * ch, w: cw - 1, h: ch - 1, col: rgbOf(cols[r]), gone: 0, id: bricks.length });
                }
            }
        }
        return bricks;
    }

    drawLogo(t, appear, ballOn = true) {
        const v = this.vox;
        const b = this.logoBall;
        const dt = Math.min(0.05, t - (this._lt ?? t));
        this._lt = t;
        if (ballOn && appear > 2.5) {
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < 4 || b.x > W - 4) b.vx = -b.vx;
            if (b.y < 150 || b.y > 292) b.vy = -b.vy;
            for (const k of this.logo) {
                if (k.gone > 0) continue;
                if (b.x > k.x - 1 && b.x < k.x + k.w + 1 && b.y > k.y - 1 && b.y < k.y + k.h + 1) {
                    k.gone = 3.5;
                    for (let i = 0; i < 4; i++) this.fx.debris(k.x + Math.random() * k.w, k.y + Math.random() * k.h, k.col, b.x, b.y, 1, 1 + Math.floor(Math.random() * 2));
                    this.fx.sparks(b.x, b.y, k.col, 4, 60, 0.25);
                    if (Math.abs(b.x - (k.x + k.w / 2)) > Math.abs(b.y - (k.y + k.h / 2)) * 1.2) b.vx = -b.vx; else b.vy = -b.vy;
                    break;
                }
            }
            for (const p of BALL_SPRITE.frames[0]) { const c = BALL_SPRITE.colors[p.k]; v.box(Math.round(b.x) - 1 + p.x, Math.round(b.y) - 1 + p.y, 1, 1, c[0], c[1], c[2], 3); }
        }
        const shine = (t * 0.7) % 3;
        for (const k of this.logo) {
            let x = k.x, y = k.y, z = 0;
            if (k.gone > 0) { k.gone -= dt; if (k.gone > 0.6) continue; }
            const p = Math.max(0, Math.min(1, (appear - (k.id % 37) * 0.012 - (k.y > 240 ? 0 : 0.25)) / 1.1));
            const back = k.gone > 0 ? 1 - k.gone / 0.6 : 1;
            const e = (1 - Math.pow(1 - p, 3)) * back;
            if (e < 1) {
                const h1 = hash01(k.id * 13), h2 = hash01(k.id * 29 + 3), h3 = hash01(k.id * 7 + 11);
                x += (h1 - 0.5) * 420 * (1 - e); y += (h2 - 0.5) * 420 * (1 - e); z = (300 + h3 * 900) * (1 - e);
            }
            const sh = Math.abs((k.x / W) * 2 - shine + 0.5) < 0.08 ? 1.8 : 1.15;
            v.box(x, y, k.w, k.h, k.col[0] * sh, k.col[1] * sh, k.col[2] * sh, z);
        }
    }

    /** Big sprites for the title screen's marching row. */
    drawMarchers(t) {
        const v = this.vox;
        const kinds = ['gloop', 'buzz', 'peeper', 'buzz', 'gloop'];
        const fr = Math.floor(t * 2) % 2;
        const off = Math.round(Math.sin(t * 0.8) * 20);
        kinds.forEach((k, i) => {
            const def = INVADERS[k];
            const x0 = 30 + i * 40 + off - def.w, y0 = 112;
            for (const p of def.frames[fr]) { const c = def.colors[p.k]; v.box(x0 + p.x * 2, y0 + p.y * 2, 2, 2, c[0], c[1], c[2], 1); }
        });
    }

    // ================================================================== frame
    frame(dt, t) {
        this.t = t;
        this.beat = Math.max(0, this.beat - dt * 5);
        this.back.update(dt, this.beat);
        this.fx.update(dt);
        this.fx.render();
        this.hud.updateEffects(dt);
        this.r.render(dt, t);
    }
}
