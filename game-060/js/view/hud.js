// The raster HUD: a 240×320 2D canvas drawn every frame with the pixel font and
// composited into the low-res target before bloom and the CRT pass, so text glows
// and scanlines like everything else. Also draws every menu and attract screen.
//
// Canvas coordinates are top-left origin (y down); world y converts with cy = 320 − y.

import * as THREE from 'three';
import { W, H, CAPSULE_INFO } from '../config.js';
import { drawText, textWidth } from '../art/font.js';
import { INVADERS, INVADER_INFO, UFO, CAPSULE_COLORS, CAPSULE_LETTER, CAPSULE_SHAPE } from '../art/sprites.js';

export const C = {
    white: '#ffffff', red: '#ff3050', pink: '#ff6ac8', cyan: '#3ae8ff', yellow: '#ffe23a', green: '#3aff5a',
    orange: '#ff9a2a', purple: '#b07aff', grey: '#8a90b0', dim: '#4a4e6a', blue: '#5a8aff', gold: '#ffc21a',
};
const css = (hex, k = 1) => `rgb(${Math.min(255, ((hex >> 16) & 255) * k) | 0},${Math.min(255, ((hex >> 8) & 255) * k) | 0},${Math.min(255, (hex & 255) * k) | 0})`;
const rgbCss = (c) => `rgb(${Math.min(255, c[0] * 255) | 0},${Math.min(255, c[1] * 255) | 0},${Math.min(255, c[2] * 255) | 0})`;
const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const blink = (t, hz = 2) => (t * hz) % 1 < 0.6;

export class Hud {
    constructor(scene) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = W; this.canvas.height = H;
        this.ctx = this.canvas.getContext('2d');
        this.tex = new THREE.CanvasTexture(this.canvas);
        this.tex.minFilter = THREE.NearestFilter; this.tex.magFilter = THREE.NearestFilter;
        this.tex.generateMipmaps = false;
        const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
        m.position.set(W / 2, H / 2, 0);
        scene.add(m);
        this.popups = [];
        this.banners = [];
        this.hits = [];
    }

    begin() { this.ctx.clearRect(0, 0, W, H); this.hits = []; }
    end() { this.tex.needsUpdate = true; }

    text(s, x, y, color = C.white, scale = 1, align = 'left') { return drawText(this.ctx, s, x, y, color, scale, align); }

    sprite(def, frame, x, y, scale = 1, tint = null) {
        const ctx = this.ctx;
        for (const p of def.frames[frame % def.frames.length]) {
            ctx.fillStyle = tint || rgbCss(def.colors[p.k]);
            ctx.fillRect(x + p.x * scale, y + (def.h - 1 - p.y) * scale, scale, scale);
        }
    }

    capsule(kind, x, y, t) {
        const ctx = this.ctx;
        const col = CAPSULE_COLORS[kind];
        const shine = Math.floor(t * 10) % 14;
        for (const p of CAPSULE_SHAPE) {
            ctx.fillStyle = p.x === shine ? '#ffffff' : css(col, p.y === 4 ? 1.2 : p.y === 0 ? 0.6 : 1);
            ctx.fillRect(x + p.x, y + 4 - p.y, 1, 1);
        }
        ctx.fillStyle = '#ffffff';
        for (const p of CAPSULE_LETTER[kind]) ctx.fillRect(x + p.x, y + 4 - p.y, 1, 1);
    }

    /** Register a tappable rectangle (canvas coords). */
    hit(id, x, y, w, h) { this.hits.push({ id, x, y, w, h }); }

    // ================================================================== effects
    popup(text, wx, wy, color = C.white, life = 0.8) {
        if (this.popups.length > 24) this.popups.shift();
        this.popups.push({ text, x: wx, y: H - wy, t: 0, life, color });
    }

    banner(text, opts = {}) {
        this.banners.push({ text, sub: opts.sub || '', color: opts.color || C.white, subColor: opts.subColor || C.yellow, t: 0, dur: opts.dur || 1.6, y: opts.y ?? 140, scale: opts.scale || 2, blink: opts.blink ?? false });
    }

    clearEffects() { this.popups.length = 0; this.banners.length = 0; }

    updateEffects(dt) {
        for (const p of this.popups) { p.t += dt; p.y -= dt * 14; }
        this.popups = this.popups.filter((p) => p.t < p.life);
        if (this.banners.length) {
            const b = this.banners[0];
            b.t += dt;
            if (b.t > b.dur) this.banners.shift();
        }
    }

    drawEffects(t) {
        for (const p of this.popups) {
            if (p.t > p.life * 0.7 && blink(t, 12)) continue;
            this.text(p.text, p.x, p.y - 3, p.color, 1, 'center');
        }
        const b = this.banners[0];
        if (b) {
            if (b.blink && !blink(t, 4)) return;
            const k = Math.min(1, b.t / 0.12);
            const sc = b.scale;
            const wave = Math.max(0, 1 - b.t / 0.25);
            this.text(b.text, W / 2 + (Math.random() - 0.5) * 4 * wave, b.y - 3 * sc, b.color, k < 1 ? sc + 1 : sc, 'center');
            if (b.sub) this.text(b.sub, W / 2, b.y + 7 * sc + 4, b.subColor, 1, 'center');
        }
    }

    // ================================================================== play HUD
    drawTop(score, hi, label, loop, t) {
        this.text('SCORE', 4, 1, C.cyan);
        this.text(pad(score, 7), 4, 10, C.white);
        this.text('HI-SCORE', W / 2, 1, C.red, 1, 'center');
        this.text(pad(Math.max(hi, score), 7), W / 2, 10, C.white, 1, 'center');
        this.text(loop > 0 ? `LOOP${loop + 1}` : 'STAGE', W - 4, 1, loop > 0 ? C.pink : C.yellow, 1, 'right');
        this.text(label, W - 4, 10, C.white, 1, 'right');
    }

    drawPlay(w, S, hi, t) {
        const st = w.stage;
        this.drawTop(S.score, hi, st.label, S.loop, t);
        const ctx = this.ctx;
        // boss bar
        if (w.boss && !w.boss.dead) {
            const f = Math.max(0, w.boss.coreHp / w.boss.coreMax);
            ctx.fillStyle = '#300810'; ctx.fillRect(40, 21, 160, 3);
            ctx.fillStyle = f < 0.3 && blink(t, 6) ? '#ffffff' : '#ff3050'; ctx.fillRect(40, 21, Math.round(160 * f), 3);
        }
        // chain
        if (w.mult > 1) this.text(`x${w.mult}`, W - 4, 22, [C.yellow, C.orange, C.pink, C.cyan][w.mult % 4], 1, 'right');
        if (w.challenge && w.state !== 'tally') this.text(`HITS ${w.challenge.hits}`, 4, 22, C.green);
        // bottom strip: ships, bombs, barrier, powers
        const by = H - 8;
        const lives = Math.max(0, S.lives - (w.state === 'dying' ? 0 : 1));
        for (let i = 0; i < Math.min(lives, 5); i++) {
            ctx.fillStyle = '#9aa8d0'; ctx.fillRect(3 + i * 10, by + 2, 8, 3);
            ctx.fillStyle = '#ff8a1a'; ctx.fillRect(3 + i * 10, by + 3, 1, 2); ctx.fillRect(10 + i * 10, by + 3, 1, 2);
            ctx.fillStyle = '#3ae8ff'; ctx.fillRect(6 + i * 10, by + 1, 2, 1);
        }
        if (lives > 5) this.text(`x${lives}`, 54, by, C.white);
        for (let i = 0; i < S.bombs; i++) {
            const x = 74 + i * 8;
            ctx.fillStyle = '#ff7ab8'; ctx.fillRect(x + 1, by, 4, 6); ctx.fillRect(x, by + 1, 6, 4);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, by + 2, 2, 2);
        }
        let px = W - 3;
        for (const k of ['F', 'C', 'E', 'L']) {
            const v = w.power[k];
            if (!(v > 0) || v > 900) continue;
            if (v < 2.5 && blink(t, 6)) { px -= 9; continue; }
            px -= 9;
            this.text(k, px, by - 1, css(CAPSULE_COLORS[k], 1.1));
        }
        if (w.barrier > 0) { px -= 4 + w.barrier * 4; for (let i = 0; i < w.barrier; i++) { ctx.fillStyle = '#b07aff'; ctx.fillRect(px + i * 4, by + 2, 3, 3); } }
    }

    drawTally(w, t) {
        const T = w.tally;
        if (!T) return;
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,10,0.72)'; ctx.fillRect(16, 96, W - 32, 112);
        ctx.fillStyle = '#3ae8ff'; ctx.fillRect(16, 96, W - 32, 1); ctx.fillRect(16, 207, W - 32, 1);
        const title = T.kind === 'boss' ? 'BOSS DESTROYED!' : T.kind === 'challenge' ? 'CHALLENGING STAGE' : 'WAVE CLEAR!';
        this.text(title, W / 2, 104, T.kind === 'boss' ? C.yellow : C.cyan, 1, 'center');
        const st = w.stateT;
        T.lines.forEach((l, i) => {
            const at = 0.35 + i * 0.45;
            if (st < at) return;
            const k = Math.min(1, (st - at) / 0.35);
            const y = 122 + i * 14;
            const isCount = T.kind === 'challenge' && i === 0;
            this.text(l[0], 26, y, l[0].startsWith('PERFECT') ? (blink(t, 6) ? C.yellow : C.pink) : C.white);
            this.text(isCount ? String(Math.round(l[1] * k)) : pad(l[1] * k, 6), W - 26, y, l[1] ? C.yellow : C.dim, 1, 'right');
        });
        const end = 0.35 + T.lines.length * 0.45;
        if (st > end) {
            this.text('TOTAL', 26, 190, C.green);
            this.text(pad(T.total, 7), W - 26, 190, blink(t, 3) ? C.white : C.green, 1, 'right');
        }
    }

    // ================================================================== attract & menus
    drawPushStart(t, y = 236, label = 'PUSH START') {
        if (blink(t, 1.6)) this.text(label, W / 2, y, C.white, 1, 'center');
    }

    drawFooter(t) {
        this.text('@1983 BRICK-TEK', W / 2, 300, C.grey, 1, 'center');
        this.text('FREE PLAY', W / 2, 310, blink(t, 0.7) ? C.dim : C.grey, 1, 'center');
    }

    drawScoreTable(t, pageT) {
        this.text('*SCORE ADVANCE TABLE*', W / 2, 44, C.white, 1, 'center');
        const rows = [['ufo', null], ['zippo'], ['krabbo'], ['octo'], ['tank'], ['splitter'], ['mirror'], ['builder'], ['diver'], ['captor']];
        rows.forEach((r, i) => {
            const at = 0.3 + i * 0.28;
            if (pageT < at) return;
            const y = 60 + i * 21;
            const k = r[0];
            const def = k === 'ufo' ? UFO : INVADERS[k];
            this.sprite(def, Math.floor(t * 2), 46 - Math.floor(def.w / 2), y, 1);
            const s = k === 'ufo' ? '= ? MYSTERY' : `= ${INVADER_INFO[k].pts} POINTS`;
            const n = Math.min(s.length, Math.floor((pageT - at) * 30));
            this.text(s.slice(0, n), 64, y + 1, k === 'ufo' ? C.red : C.white);
            if (k !== 'ufo' && n >= s.length) this.text(INVADER_INFO[k].name, 64, y + 10, C.dim);
        });
    }

    drawCapsuleTable(t, pageT) {
        this.text('*POWER CAPSULES*', W / 2, 44, C.white, 1, 'center');
        Object.keys(CAPSULE_INFO).forEach((k, i) => {
            const at = 0.3 + i * 0.25;
            if (pageT < at) return;
            const y = 62 + i * 20;
            this.capsule(k, 22, y + 1, t + i * 0.2);
            this.text(CAPSULE_INFO[k].name, 42, y, css(CAPSULE_COLORS[k], 1.1));
            this.text(CAPSULE_INFO[k].desc, 42, y + 9, C.grey);
        });
    }

    drawHiscores(list, t, highlight = -1) {
        this.text('*TOP BRICKBUSTERS*', W / 2, 40, C.yellow, 1, 'center');
        this.text('RANK  SCORE   NAME  STG', W / 2, 58, C.cyan, 1, 'center');
        const colors = [C.red, C.orange, C.yellow, C.green, C.cyan, C.blue, C.purple, C.pink, C.white, C.grey];
        list.slice(0, 10).forEach((e, i) => {
            const y = 74 + i * 16;
            const col = i === highlight ? (blink(t, 5) ? C.white : C.yellow) : colors[i];
            const rank = ['1ST', '2ND', '3RD'][i] || `${i + 1}TH`;
            this.text(rank.padStart(4), 30, y, col);
            this.text(pad(e.score, 7), 66, y, col);
            this.text(e.name, 120, y, col);
            this.text(e.stage || '1-1', 210, y, col, 1, 'right');
        });
    }

    drawMenu(title, items, sel, t, y0 = 150) {
        if (title) this.text(title, W / 2, y0 - 22, C.cyan, 1, 'center');
        items.forEach((it, i) => {
            const y = y0 + i * 16;
            const on = i === sel;
            const label = it.label;
            const w = textWidth(label);
            if (on) {
                this.ctx.fillStyle = 'rgba(58,232,255,0.16)';
                this.ctx.fillRect(W / 2 - w / 2 - 14, y - 4, w + 28, 15);
                if (blink(t, 3)) { this.text('}', W / 2 - w / 2 - 11, y, C.yellow); this.text('{', W / 2 + w / 2 + 6, y, C.yellow); }
            }
            this.text(label, W / 2, y, it.disabled ? C.dim : on ? C.white : C.grey, 1, 'center');
            this.hit(i, 16, y - 5, W - 32, 16);
        });
    }

    drawEntry(e, t) {
        this.text('CONGRATULATIONS!', W / 2, 70, C.yellow, 1, 'center');
        this.text('YOU ARE A TOP BRICKBUSTER', W / 2, 86, C.white, 1, 'center');
        this.text('ENTER YOUR INITIALS', W / 2, 112, C.cyan, 1, 'center');
        this.text(pad(e.score, 7), W / 2, 128, C.white, 1, 'center');
        for (let i = 0; i < 3; i++) {
            const x = W / 2 - 30 + i * 22;
            const ch = e.name[i] || '.';
            const on = i === e.pos;
            if (on) { this.ctx.fillStyle = 'rgba(255,226,58,0.2)'; this.ctx.fillRect(x - 3, 150, 18, 24); }
            this.text(ch, x, 155, on && blink(t, 4) ? C.yellow : C.white, 2);
            if (on) { this.text('^', x + 3, 142, C.dim); this.text('v', x + 3, 177, C.dim); }
            this.hit('slot' + i, x - 4, 140, 20, 46);
        }
        this.text('{ } OR SLIDE: LETTER', W / 2, 204, C.grey, 1, 'center');
        this.text('FIRE: NEXT', W / 2, 216, C.grey, 1, 'center');
        this.hit('up', W / 2 + 46, 140, 40, 22);
        this.hit('down', W / 2 + 46, 164, 40, 22);
        this.text('^', W / 2 + 62, 146, C.cyan, 2); this.text('v', W / 2 + 62, 168, C.cyan, 2);
        this.hit('ok', W / 2 - 30, 226, 60, 18);
        this.text('OK', W / 2, 230, blink(t, 2) ? C.green : C.white, 1, 'center');
    }

    drawContinue(n, t) {
        this.text('CONTINUE?', W / 2, 110, C.yellow, 2, 'center');
        this.text(String(Math.max(0, n)), W / 2, 140, n <= 3 && blink(t, 4) ? C.red : C.white, 4, 'center');
        this.drawPushStart(t, 190, 'PUSH FIRE');
        this.hit('yes', 30, 100, W - 60, 110);
    }
}
