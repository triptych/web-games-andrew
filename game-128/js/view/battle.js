// Gemheart Saga — the battle view (Canvas 2D). Reads G.battle and answers sim events; never changes G.
// It also owns the board's pointer and keyboard cursor, and hands swaps back through onSwap(a, b).
//
// Layout: portrait phones put the scene on top and the board below; wide screens put the scene on the left and the
// board on the right. this.layout = { scene, board, bar } in CSS px; the DOM skill bar is placed into layout.bar.
// The art is exported larger than it is drawn and scaled down once, with high-quality filtering, by scaled() below.

import { BOARD, GEM, SPECIAL, CLEAR_TIME, HINT_AFTER, BATTLE } from '../config.js';
import { img, ready, ART } from '../assets.js';
import { HERO } from '../sim/data/heroes.js';
import { FOE } from '../sim/data/world.js';
import * as Bd from '../sim/board.js';

const W = BOARD.w, H = BOARD.h;
const GEM_COL = ['#c9d6e6', '#ff7aa8', '#ff5a5a', '#4ea2ff', '#3fd07a', '#b07bff', '#9a9a9a', '#ff3030', '#ffffff'];
const POOL_COL = { r: '#ff6b6b', s: '#4ea2ff', e: '#3fd07a', a: '#b07bff' };
// gem kind -> [atlas, cell]: the emerald is in the misc atlas
const CELL = [['gems', 0], ['gems', 1], ['gems', 2], ['gems', 3], ['misc', 5], ['gems', 4], ['gems', 6], ['gems', 7], ['gems', 5]];

// Pre-scaled copies: each picture (or atlas cell) is filtered down once to the device-pixel size it is drawn at, then
// drawn 1:1 every frame. Filtering big art down every frame starved software rendering and costs phones battery.
const SCALED = new Map();
// `outline` adds a black outline that thick (as a fraction of the size) around the picture's silhouette (the gems).
function scaled(im, sx, sy, sw, sh, w, h, outline = 0) {
    const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    const key = `${im.src}|${sx}|${sy}|${sw}|${sh}|${W}|${H}|${outline}`;
    let c = SCALED.get(key);
    if (!c) {
        if (SCALED.size > 400) SCALED.clear();
        c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        if (!outline) x.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
        else {
            // the picture shrunk to leave room, its silhouette in black, stamped round a circle, then the picture on top
            const r = Math.max(1.5, W * outline);
            const sil = document.createElement('canvas');
            sil.width = W; sil.height = H;
            const sx2 = sil.getContext('2d');
            sx2.imageSmoothingQuality = 'high';
            sx2.drawImage(im, sx, sy, sw, sh, r, r, W - 2 * r, H - 2 * r);
            // drop the faint stray pixels at the atlas cell's edge, or the outline would trace them too
            const d = sx2.getImageData(0, 0, W, H);
            for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 64 ? 0 : Math.min(255, (d.data[i] - 64) * 1.4 + 64);
            sx2.putImageData(d, 0, 0);
            const pic = document.createElement('canvas');
            pic.width = W; pic.height = H;
            pic.getContext('2d').drawImage(sil, 0, 0);
            sx2.globalCompositeOperation = 'source-in';
            sx2.fillStyle = '#000';
            sx2.fillRect(0, 0, W, H);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                x.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
            }
            x.drawImage(pic, 0, 0);
        }
        SCALED.set(key, c);
    }
    return c;
}

export class BattleView {
    constructor(canvas, { onSwap, onSelect } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onSwap = onSwap;
        this.onSelect = onSelect;
        this.sel = -1;              // selected slot
        this.cursor = 27;           // keyboard cursor slot
        this.showCursor = false;
        this.fx = [];               // particles
        this.nums = [];             // floating numbers
        this.banners = [];          // big words
        this.lunge = { hero: 0, foe: 0 };
        this.flash = { hero: 0, foe: 0 };
        this.shake = 0;
        this.calm = false;
        this.foeDying = 0;
        this.drawn = { hero: 0, foe: 0 };    // how much the sprites are scaled (the tests keep it ≤ 1)
        this.layout = { scene: { x: 0, y: 0, w: 1, h: 1 }, board: { x: 0, y: 0, s: 1 }, bar: { x: 0, y: 0, w: 1, h: 1 } };
        this.atlas = { gems: img(ART.icons('gems')), misc: img(ART.icons('misc')) };
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this._bindPointer();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        const barH = 80;
        if (h > w * 1.05) {
            // portrait: scene on top, skill bar, then the board as wide as the screen
            const s = Math.floor(Math.min(w - 12, h * 0.56) / 8) * 8;
            const sceneH = Math.max(150, Math.min(Math.round(w * 1.0), h - barH - s - 22));
            const by = Math.round(sceneH + barH + 8 + Math.max(0, (h - sceneH - barH - 8 - s - 10) / 2));
            this.layout = {
                scene: { x: 0, y: 0, w, h: sceneH },
                bar: { x: 0, y: sceneH + 2, w, h: barH },
                board: { x: Math.round((w - s) / 2), y: by, s },
            };
        } else {
            // landscape: the board on the right, clear of the pause button; the scene on the left
            const s = Math.floor(Math.min(h - 70, w * 0.55) / 8) * 8;
            const bx = w - s - 14;
            const sceneW = bx - 10;
            this.layout = {
                scene: { x: 0, y: 0, w: sceneW, h: h - barH - 8 },
                bar: { x: 0, y: h - barH - 4, w: sceneW, h: barH },
                board: { x: bx, y: Math.max(56, Math.round((h - s) / 2) + 12), s },
            };
        }
    }

    // ------------------------------------------------------------------ input
    cellAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const b = this.layout.board;
        const x = clientX - r.left - b.x, y = clientY - r.top - b.y;
        const cs = b.s / 8;
        if (x < 0 || y < 0 || x >= b.s || y >= b.s) return -1;
        return Bd.idx(Math.floor(x / cs), Math.floor(y / cs));
    }

    _bindPointer() {
        let down = null;
        this.canvas.addEventListener('pointerdown', (e) => {
            if (!this.active) return;
            const i = this.cellAt(e.clientX, e.clientY);
            if (i < 0) { this.sel = -1; return; }
            e.preventDefault();
            this.showCursor = false;
            down = { i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
            try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== down.id || down.moved) return;
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            const cs = this.layout.board.s / 8;
            if (Math.hypot(dx, dy) < cs * 0.35) return;
            down.moved = true;
            const c = Bd.col(down.i), r = Bd.row(down.i);
            const [nc, nr] = Math.abs(dx) > Math.abs(dy) ? [c + Math.sign(dx), r] : [c, r + Math.sign(dy)];
            if (nc >= 0 && nr >= 0 && nc < W && nr < H) this.onSwap?.(down.i, Bd.idx(nc, nr));
            this.sel = -1;
        });
        const up = (e) => {
            if (!down || e.pointerId !== down.id) return;
            if (!down.moved) this.tap(down.i);
            down = null;
        };
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', () => { down = null; });
    }

    /** A tap (or Space on the cursor): pick up, put down, or swap with the picked gem. */
    tap(i) {
        if (this.sel >= 0 && this.sel !== i && Math.abs(Bd.col(this.sel) - Bd.col(i)) + Math.abs(Bd.row(this.sel) - Bd.row(i)) === 1) {
            this.onSwap?.(this.sel, i);
            this.sel = -1;
        } else {
            this.sel = this.sel === i ? -1 : i;
            if (this.sel >= 0) this.onSelect?.();
        }
    }

    /** Keyboard: arrows move the cursor, or swap the picked-up gem that way. */
    key(code) {
        this.showCursor = true;
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[code];
        if (d) {
            const base = this.sel >= 0 ? this.sel : this.cursor;
            const c = Math.max(0, Math.min(W - 1, Bd.col(base) + d[0])), r = Math.max(0, Math.min(H - 1, Bd.row(base) + d[1]));
            const n = Bd.idx(c, r);
            if (this.sel >= 0) { if (n !== this.sel) this.onSwap?.(this.sel, n); this.sel = -1; this.cursor = n; }
            else this.cursor = n;
            return true;
        }
        if (code === 'Space' || code === 'Enter') { this.tap(this.cursor); return true; }
        return false;
    }

    reset() { this.sel = -1; this.fx.length = 0; this.nums.length = 0; this.banners.length = 0; this.foeDying = 0; this.lunge.hero = this.lunge.foe = 0; }

    // ------------------------------------------------------------------ events
    cellCenter(x, y) {
        const b = this.layout.board, cs = b.s / 8;
        return { x: b.x + (x + 0.5) * cs, y: b.y + (y + 0.5) * cs };
    }
    heroPos() { const s = this.layout.scene; return { x: s.x + s.w * 0.24, y: s.y + s.h * 0.72 }; }
    foePos() { const s = this.layout.scene; return { x: s.x + s.w * 0.72, y: s.y + s.h * 0.7 }; }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'battle') { this.reset(); this.banner(FOE[e.foe].name, '#ffcf5a', 1.6); }
            else if (e.type === 'match') {
                const p = this.cellCenter(e.x, e.y);
                const to = e.k === GEM.HEART ? this.heroPos() : this.foePos();
                const n = Math.min(10, e.n + 2);
                for (let i = 0; i < n; i++) this.orb(p.x, p.y, to.x, to.y, GEM_COL[e.k], 0.32 + i * 0.03);
                for (let i = 0; i < 8; i++) this.spark(p.x, p.y, GEM_COL[e.k]);
                if (e.chain >= 2) { this.banners = this.banners.filter((x) => !x.chain); this.banner(`Chain ×${e.chain}`, '#fff1b0', 0.9); this.banners[this.banners.length - 1].chain = true; }
            } else if (e.type === 'special') this.banner({ 1: 'Line gem!', 2: 'Line gem!', 3: 'Bomb gem!', 4: 'Prism!' }[e.sp], '#9ff', 1.0);
            else if (e.type === 'blast' || e.type === 'prism') { const p = this.cellCenter(e.x, e.y); for (let i = 0; i < 24; i++) this.spark(p.x, p.y, '#fff6c8', 260); this.shake = Math.max(this.shake, 0.15); }
            else if (e.type === 'hit') {
                const p = this.foePos();
                this.flash.foe = 0.14;
                if (e.src === 'sword') this.lunge.hero = 1;
                const col = e.crit ? '#ffe14d' : e.weak ? '#ffb347' : e.src === 'skill' ? '#9fe8ff' : '#fff';
                this.num(p.x + (Math.random() - 0.5) * 40, p.y - 30, (e.crit ? 'CRIT ' : '') + e.amt, col, e.crit || e.src === 'skill' ? 1.3 : 1);
            } else if (e.type === 'foeAttack') { this.lunge.foe = 1; }
            else if (e.type === 'hurt') { const p = this.heroPos(); this.flash.hero = 0.2; this.shake = Math.max(this.shake, 0.25); this.num(p.x, p.y - 40, '-' + e.amt, '#ff6b6b', 1.2); }
            else if (e.type === 'blocked') { const p = this.heroPos(); this.num(p.x, p.y - 60, 'Blocked ' + e.amt, '#9fd0ff'); }
            else if (e.type === 'heal') { const p = this.heroPos(); this.num(p.x, p.y - 50, '+' + e.amt, '#7dff9a'); }
            else if (e.type === 'foeHeal') { const p = this.foePos(); this.num(p.x, p.y - 50, '+' + e.amt, '#7dff9a'); }
            else if (e.type === 'curse') {
                for (const s of e.slots || []) { const p = this.cellCenter(Bd.col(s), Bd.row(s)); for (let i = 0; i < 6; i++) this.spark(p.x, p.y, e.kind === 'doom' ? '#ff3b3b' : '#aaa'); }
                this.banner({ stone: 'Petrified!', lock: 'Chained!', doom: 'Doom gem!' }[e.kind], '#ff9a9a', 1.1);
            } else if (e.type === 'doomBurst') { const p = this.cellCenter(e.x, e.y); for (let i = 0; i < 30; i++) this.spark(p.x, p.y, '#ff3030', 300); this.shake = 0.4; }
            else if (e.type === 'drain') this.banner(`Mana drained`, POOL_COL[e.pool], 1.0);
            else if (e.type === 'enrage') this.banner('Enraged!', '#ff4d4d', 1.4);
            else if (e.type === 'won') { this.foeDying = 1; }
            else if (e.type === 'shuffle') this.banner('Shuffle', '#cde', 0.9);
            else if (e.type === 'revive') this.banner('Revived!', '#ffcf5a', 1.4);
            else if (e.type === 'frozen') this.banner('Frozen!', '#9fe8ff', 1.0);
            else if (e.type === 'poisoned') this.banner('Poisoned', '#7dff6b', 0.9);
        }
    }

    orb(x0, y0, x1, y1, col, dur) { if (!this.calm || this.fx.length < 30) this.fx.push({ kind: 'orb', x0, y0, x1, y1, col, t: 0, dur, cx: (x0 + x1) / 2 + (Math.random() - 0.5) * 140, cy: Math.min(y0, y1) - 60 - Math.random() * 80 }); }
    spark(x, y, col, sp = 160) { if (this.calm && this.fx.length > 40) return; const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random()); this.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, col, t: 0, dur: 0.45 + Math.random() * 0.3, s: 2 + Math.random() * 3 }); }
    num(x, y, text, col, size = 1) { this.nums.push({ x, y, text: String(text), col, t: 0, size }); }
    banner(text, col, dur = 1, y = null) { if (text) this.banners.push({ text, col, t: 0, dur, y }); if (this.banners.length > 3) this.banners.shift(); }

    // ------------------------------------------------------------------ drawing
    frame(G, dt, time) {
        this.resize();
        const ctx = this.ctx;
        const Bt = G.battle;
        this.active = !!Bt && (Bt.phase === 'fight' || Bt.phase === 'intro');
        // out of battle the canvas sits under the village and story screens: clear it once and leave it, so it isn't
        // re-rasterised every frame for nothing (that starved software rendering)
        const size = `${this.w}x${this.h}@${this.dpr}`;
        if (!Bt && this.idle === size) return;
        this.idle = Bt ? null : size;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#0b0712';
        ctx.fillRect(0, 0, this.w, this.h);
        if (!Bt) return;
        let sx = 0, sy = 0;
        if (this.shake > 0 && !this.calm) { sx = (Math.random() - 0.5) * 10 * this.shake; sy = (Math.random() - 0.5) * 10 * this.shake; }
        this.shake = Math.max(0, this.shake - dt * 1.5);
        ctx.save();
        ctx.translate(sx, sy);
        this.drawScene(G, Bt, dt, time);
        this.drawBoard(G, Bt, dt, time);
        ctx.restore();
        this.drawFx(dt);
    }

    drawScene(G, Bt, dt, time) {
        const ctx = this.ctx, s = this.layout.scene;
        ctx.save();
        ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
        const region = FOE[Bt.foe.id].region || G.quest?.region || 'gloamspire';
        const bg = img(ART.bg(region));
        ctx.imageSmoothingEnabled = true;
        if (ready(bg)) {
            const k = Math.max(s.w / bg.width, s.h / bg.height);
            this.blit(bg, 0, 0, bg.width, bg.height, s.x + (s.w - bg.width * k) / 2, s.y + (s.h - bg.height * k) * 0.75, bg.width * k, bg.height * k);
        } else { ctx.fillStyle = '#20182e'; ctx.fillRect(s.x, s.y, s.w, s.h); }
        // a soft vignette so bars read on bright backdrops
        const gr = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = gr; ctx.fillRect(s.x, s.y, s.w, s.h);
        const ground = s.y + s.h * 0.94;
        // hero
        const hs = img(ART.hero(G.hero.id));
        this.lunge.hero = Math.max(0, this.lunge.hero - dt * 4);
        this.lunge.foe = Math.max(0, this.lunge.foe - dt * 3.5);
        this.flash.hero = Math.max(0, this.flash.hero - dt);
        this.flash.foe = Math.max(0, this.flash.foe - dt);
        const bob = this.calm ? 0 : Math.sin(time * 2.2) * 2;
        if (ready(hs)) {
            // about 45% of the scene, never past the sprite's own size: smaller and smoothly downscaled reads
            // as fine 32-bit pixel art (v1.0.0 filled two thirds of the scene and looked zoomed)
            const th = Math.min(s.h * 0.45, hs.height);
            const k = th / hs.height;
            this.drawn.hero = k;
            const lx = Math.sin(Math.min(1, this.lunge.hero) * Math.PI) * s.w * 0.05;
            this.sprite(hs, s.x + s.w * 0.24 - hs.width * k / 2 + lx, ground - th + bob, hs.width * k, th, this.flash.hero > 0 ? 'hurt' : null, Bt.hero.hp <= 0 ? 0.4 : 1);
        }
        // foe
        const f = Bt.foe;
        const fs = img(ART.mon(f.id));
        if (ready(fs)) {
            const frac = f.rank === 'boss' ? 0.64 : f.rank === 'elite' ? 0.52 : 0.42;
            let th = Math.min(s.h * frac, fs.height);
            let k = th / fs.height;
            if (fs.width * k > s.w * 0.38) { k = s.w * 0.38 / fs.width; th = fs.height * k; }
            this.drawn.foe = k;
            const lx = -Math.sin(Math.min(1, this.lunge.foe) * Math.PI) * s.w * 0.07;
            if (this.foeDying > 0) this.foeDying = Math.max(0, this.foeDying - dt * 1.2);
            const alpha = Bt.phase === 'won' ? this.foeDying : 1;
            const fb = this.calm ? 0 : Math.sin(time * 1.7 + 1) * 3;
            const tint = this.flash.foe > 0 ? 'hit' : f.frozen > 0 ? 'frozen' : f.enraged ? 'rage' : null;
            this.sprite(fs, s.x + s.w * 0.72 - fs.width * k / 2 + lx, ground - th + fb, fs.width * k, th, tint, alpha);
        }
        ctx.restore();
        // bars
        const pad = 10;
        const topY = s.y + 48;            // below the ← Games link
        // a soft dark band behind the HUD so its labels read over a bright sky
        const scrim = ctx.createLinearGradient(0, s.y, 0, topY + 80);
        scrim.addColorStop(0, 'rgba(8,6,16,0.6)'); scrim.addColorStop(0.7, 'rgba(8,6,16,0.4)'); scrim.addColorStop(1, 'rgba(8,6,16,0)');
        ctx.fillStyle = scrim; ctx.fillRect(s.x, s.y, s.w, topY + 80 - s.y);
        const rpad = s.x + s.w > this.w - 60 ? 58 : pad;   // clear of the pause button
        const bw = Math.min(220, s.w * 0.42, (s.w - pad - rpad - 10) / 2);
        this.hpBar(s.x + pad, topY, bw, HERO[G.hero.id].name, Bt.hero.hp, Bt.hero.max, Bt.hero.shield, '#46d36b', false);
        this.mana(Bt.hero.mana, s.x + pad, topY + 30, bw);
        this.hpBar(s.x + s.w - bw - rpad, topY, bw, `${f.name}  Lv ${f.lv}`, f.hp, f.max, f.shield, '#e5484d', true);
        // the foe's attack timer
        const every = f.every * (f.enraged ? BATTLE.enrageMult : 1);
        const t = Math.max(0, Math.min(1, 1 - f.timer / every));
        const ty = topY + 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x + s.w - bw - rpad, ty, bw, 8);
        ctx.fillStyle = f.frozen > 0 ? '#9fe8ff' : t > 0.8 ? '#ff4d4d' : '#ffb347';
        ctx.fillRect(s.x + s.w - bw - rpad + 1, ty + 1, (bw - 2) * t, 6);
        this.text(f.frozen > 0 ? 'Frozen' : 'Attack', s.x + s.w - rpad, ty + 20, 11, '#ddd', 'right');
        // the foe's weakness and status
        this.text(`Weak: ${{ r: 'Ruby', s: 'Sapphire', e: 'Emerald', a: 'Amethyst' }[f.weak]}`, s.x + s.w - bw - rpad, ty + 20, 11, POOL_COL[f.weak], 'left');
        if (Bt.hero.poison > 0) this.text('Poisoned', s.x + pad, topY + 62, 11, '#7dff6b');
        if (Bt.hero.summon) this.text('Ash fights at your side', s.x + pad, topY + 62, 11, '#ddd');
        if (Bt.phase === 'intro') this.text('Ready…', s.x + s.w / 2, s.y + s.h * 0.45, 26, '#fff', 'center', true);
    }

    sprite(im, x, y, w, h, tint, alpha = 1) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = true;          // the sprites are drawn smaller than their art: filter, don't block
        if (tint === 'hit' || tint === 'hurt') ctx.filter = tint === 'hit' ? 'brightness(2.2)' : 'sepia(1) saturate(4) hue-rotate(-40deg)';
        else if (tint === 'frozen') ctx.filter = 'hue-rotate(180deg) saturate(0.6) brightness(1.2)';
        else if (tint === 'rage') ctx.filter = 'saturate(1.6) sepia(0.3) hue-rotate(-20deg)';
        this.blit(im, 0, 0, im.width, im.height, Math.round(x), Math.round(y), w, h);
        ctx.restore();
    }

    /** Draw part of an image at (x, y, w, h) CSS px from a copy pre-scaled to that size; `base` (w, h) picks the copy
     * when the drawn size is animating (a gem popping), so the cache keeps one copy per resting size. */
    blit(im, sx, sy, sw, sh, x, y, w, h, bw = w, bh = h, outline = 0) {
        const c = scaled(im, sx, sy, sw, sh, bw * this.dpr, bh * this.dpr, outline);
        if (bw === w && bh === h) this.ctx.drawImage(c, x, y, c.width / this.dpr, c.height / this.dpr);
        else this.ctx.drawImage(c, x, y, w, h);
    }

    hpBar(x, y, w, name, hp, max, shield, col, right) {
        const ctx = this.ctx;
        this.text(name, right ? x + w : x, y + 2, 13, '#fff', right ? 'right' : 'left', true);
        const by = y + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, by, w, 14);
        ctx.fillStyle = col; ctx.fillRect(x + 1, by + 1, (w - 2) * Math.max(0, hp / max), 12);
        if (shield > 0) { ctx.fillStyle = 'rgba(120,190,255,0.75)'; ctx.fillRect(x + 1, by + 1, Math.min(w - 2, (w - 2) * shield / max), 5); }
        this.text(`${Math.ceil(hp)} / ${max}`, x + w / 2, by + 11, 11, '#fff', 'center', true);
    }

    mana(m, x, y, w) {
        const ctx = this.ctx;
        const each = (w - 9) / 4;
        ['r', 's', 'e', 'a'].forEach((p, i) => {
            const bx = x + i * (each + 3);
            ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx, y, each, 8);
            ctx.fillStyle = POOL_COL[p]; ctx.fillRect(bx + 1, y + 1, (each - 2) * Math.min(1, m[p] / BATTLE.manaCap), 6);
        });
    }

    text(t, x, y, size, col, align = 'left', shadow = false) {
        const ctx = this.ctx;
        ctx.font = `800 ${size}px Nunito, system-ui, sans-serif`;
        ctx.textAlign = align;
        // every label gets a dark outline (v1.1.0: red 'Weak: Ruby' was lost on a blue sky); `shadow` thickens it
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, size * (shadow ? 0.26 : 0.22));
        ctx.strokeStyle = 'rgba(6,4,12,0.92)';
        ctx.strokeText(t, x, y);
        ctx.fillStyle = col;
        ctx.fillText(t, x, y);
    }

    drawBoard(G, Bt, dt, time) {
        const ctx = this.ctx, b = this.layout.board, cs = b.s / 8, B = Bt.board;
        // frame
        ctx.fillStyle = 'rgba(30,20,48,0.96)';
        ctx.fillRect(b.x - 6, b.y - 6, b.s + 12, b.s + 12);
        ctx.strokeStyle = 'rgba(255,207,90,0.6)'; ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 5, b.y - 5, b.s + 10, b.s + 10);
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
            ctx.fillRect(b.x + c * cs, b.y + r * cs, cs, cs);
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(b.x, b.y, b.s, b.s); ctx.clip();
        let hint = null;
        if (B.idle > HINT_AFTER && Bt.phase === 'fight') hint = Bd.hint(B);
        for (let i = 0; i < B.cells.length; i++) {
            const t = B.cells[i];
            if (!t) continue;
            let c = Bd.col(i), r = t.y;
            if (t.sw) {
                const p = Math.min(1, t.sw.t / t.sw.dur);
                if (t.sw.back) { const q = p < 0.5 ? p * 2 : (1 - p) * 2; c = c + (t.sw.fc - c) * q * 0.5; r = Bd.row(i) + (t.sw.fr - Bd.row(i)) * q * 0.5; }
                else { const e = p * p * (3 - 2 * p); c = t.sw.fc + (Bd.col(i) - t.sw.fc) * e; r = t.sw.fr + (Bd.row(i) - t.sw.fr) * e; }
            }
            let scale = 1, alpha = 1;
            if (t.st === 'clear') { const p = Math.max(0, t.ct / CLEAR_TIME); scale = 0.4 + 0.75 * p; alpha = p; }
            if (hint && (i === hint.a || i === hint.b) && !this.calm) scale *= 1 + 0.08 * Math.sin(time * 8);
            const x = b.x + c * cs, y = b.y + r * cs;
            this.gem(t, x, y, cs, scale, alpha, time);
        }
        ctx.restore();
        // selection and cursor
        if (this.sel >= 0) { ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 3; ctx.strokeRect(b.x + Bd.col(this.sel) * cs + 2, b.y + Bd.row(this.sel) * cs + 2, cs - 4, cs - 4); }
        if (this.showCursor) { ctx.strokeStyle = '#ffffff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeRect(b.x + Bd.col(this.cursor) * cs + 4, b.y + Bd.row(this.cursor) * cs + 4, cs - 8, cs - 8); ctx.setLineDash([]); }
    }

    gem(t, x, y, cs, scale, alpha, time) {
        const ctx = this.ctx;
        const [sheet, cell] = CELL[t.k] || CELL[0];
        const im = this.atlas[sheet];
        const pad = cs * 0.06;
        const sz = (cs - pad * 2) * scale;
        const gx = x + (cs - sz) / 2, gy = y + (cs - sz) / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (t.sp === SPECIAL.PRISM || t.k === Bd.PRISM) {
            ctx.shadowColor = `hsl(${(time * 120) % 360},100%,70%)`; ctx.shadowBlur = this.calm ? 6 : 14;
        }
        ctx.imageSmoothingEnabled = true;
        const base = cs - pad * 2;
        if (ready(im)) {
            const cw = im.width / 4;
            this.blit(im, (cell % 4) * cw, Math.floor(cell / 4) * cw, cw, cw, gx, gy, sz, sz, base, base, 0.045);   // a bold black outline, v1.1.0
        } else {
            ctx.fillStyle = GEM_COL[t.k] || '#fff';
            ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, sz / 2.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        if (t.sp === SPECIAL.LINE_H || t.sp === SPECIAL.LINE_V) {
            const pulse = this.calm ? 0.7 : 0.55 + 0.35 * Math.sin(time * 6);
            ctx.fillStyle = `rgba(255,255,255,${pulse})`;
            if (t.sp === SPECIAL.LINE_H) ctx.fillRect(gx, y + cs * 0.44, sz, cs * 0.12);
            else ctx.fillRect(x + cs * 0.44, gy, cs * 0.12, sz);
        } else if (t.sp === SPECIAL.BOMB) {
            ctx.strokeStyle = `rgba(255,240,150,${this.calm ? 0.9 : 0.6 + 0.4 * Math.sin(time * 7)})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, sz * 0.48, 0, Math.PI * 2); ctx.stroke();
        }
        if (t.lock) {
            const lim = this.atlas.gems;
            if (ready(lim)) { const cw = lim.width / 4; ctx.globalAlpha = alpha * 0.9; this.blit(lim, 0, 2 * cw, cw, cw, gx, gy, sz, sz, base, base); }
        }
        if (t.k === GEM.DOOM && t.st === 'idle') {
            ctx.globalAlpha = 1;
            this.text(String(Math.max(0, Math.ceil(t.doom))), x + cs / 2, y + cs * 0.62, Math.round(cs * 0.36), '#fff', 'center', true);
        }
        ctx.restore();
    }

    drawFx(dt) {
        const ctx = this.ctx;
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const p = this.fx[i];
            p.t += dt;
            if (p.t >= p.dur) { this.fx.splice(i, 1); continue; }
            const k = p.t / p.dur;
            if (p.kind === 'orb') {
                const u = 1 - k;
                const x = u * u * p.x0 + 2 * u * k * p.cx + k * k * p.x1;
                const y = u * u * p.y0 + 2 * u * k * p.cy + k * k * p.y1;
                ctx.fillStyle = p.col;
                ctx.globalAlpha = 0.9;
                ctx.beginPath(); ctx.arc(x, y, 4 + 3 * (1 - k), 0, Math.PI * 2); ctx.fill();
            } else {
                p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
                ctx.fillStyle = p.col;
                ctx.globalAlpha = 1 - k;
                ctx.fillRect(p.x, p.y, p.s, p.s);
            }
        }
        ctx.globalAlpha = 1;
        for (let i = this.nums.length - 1; i >= 0; i--) {
            const n = this.nums[i];
            n.t += dt;
            if (n.t > 1) { this.nums.splice(i, 1); continue; }
            ctx.globalAlpha = 1 - Math.max(0, (n.t - 0.6) / 0.4);
            this.text(n.text, n.x, n.y - n.t * 40, Math.round(18 * n.size), n.col, 'center', true);
        }
        ctx.globalAlpha = 1;
        const b = this.layout.board;
        this.banners = this.banners.filter((x) => (x.t += dt) < x.dur);
        this.banners.forEach((x, i) => {
            const a = Math.min(1, (x.dur - x.t) * 3, x.t * 8);
            ctx.globalAlpha = a;
            this.text(x.text, b.x + b.s / 2, b.y + b.s * 0.42 + i * 34 - (1 - a) * 8, 26, x.col, 'center', true);
        });
        ctx.globalAlpha = 1;
    }
}
