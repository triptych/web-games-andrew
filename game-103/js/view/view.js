// The Canvas 2D view: an isometric diorama that reads G every frame and plays sim events back as a
// queue of little animations. It never changes G. The sim is already in its new state when an event
// arrives, so the view keeps its own picture of each unit (`vis`: where it is, how much hp the bar
// shows) and only updates it as each event plays. `busy` is true until the last one finishes.

import { CHAPTERS, SKILLS, STATUS } from '../sim/data.js';
import { drawActor } from './sprites.js';

const TW = 64, TH = 32, HZ = 13, BASE = 16;            // tile width/height in px, a height level, the island's thickness
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const FONT = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// grass-like, stone-like and wall colours for each scene, and the sky behind it
const THEMES = {
    yard: { bg: ['#bfe9ff', '#f3fbdc'], g: ['#9fe07f', '#92d672'], s: ['#e6dccb', '#dccfba'], w: ['#e8b5c8', '#d99db5'], petals: '#ffc2d8', clouds: true },
    library: { bg: ['#f6e2c4', '#e9caa0'], g: ['#d9a86c', '#cf9c60'], s: ['#cdbb9e', '#c2af90'], w: ['#a8643c', '#8a4e2c'], petals: '#fff2b0', clouds: false, shelf: true },
    garden: { bg: ['#b7ecd2', '#eaf8c8'], g: ['#86d86e', '#79cc62'], s: ['#d8d4c4', '#cbc6b4'], w: ['#4a9a4a', '#3f8a40'], petals: '#ffe0f0', clouds: true, hedge: true },
    roof: { bg: ['#ffd2a8', '#ffeccc'], g: ['#e6b987', '#dbad7a'], s: ['#e0836a', '#d4775e'], w: ['#b8b0c8', '#a89fb8'], petals: '#fff', clouds: true },
    cellar: { bg: ['#3a3350', '#5a4a6a'], g: ['#aaa6ba', '#9c98ae'], s: ['#bbb4c6', '#aea7ba'], w: ['#6c6480', '#5e5672'], petals: '#ffd9a0', clouds: false, dark: true },
    kitchen: { bg: ['#ffd9b5', '#ffb98a'], g: ['#fff4e0', '#f1d9b8'], s: ['#d9c8b0', '#cdbba2'], w: ['#8a8aa0', '#7a7a92'], petals: '#ffe6a0', clouds: false, warm: true },
};

function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
    return `rgb(${r},${g},${b})`;
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.inset = { t: 70, b: 150, l: 6, r: 6 };
        this.speed = 1;
        this.calm = false;
        this.q = [];
        this.cur = null;
        this.vis = new Map();
        this.texts = [];
        this.parts = [];
        this.banner = null;
        this.B = null;
        this.theme = THEMES.yard;
        this.ov = {};
        this.ghost = false;          // set by the battle controller on a player's turn
        this.time = 0;
        this.onTalk = null;               // (lines, done) → shows a dialogue, calls done when it closes
        this.onEnd = null;                // (ev) → the battle is over and the banner has been shown
        this.onPlay = null;               // (ev) → an event is starting; the audio listens
        this.onTap = null;                // (x, y) | null
        this.onHover = null;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this._bindPointer();
    }

    // ------------------------------------------------------------------ size and camera
    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (!force && w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        // CSS size in px, never 100vw/100vh: on phones 100vh is taller than the visible area.
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.fit();
    }

    setInsets(i) { Object.assign(this.inset, i); this.fit(); }

    /** Fit the whole board into the space the HUD leaves. */
    fit() {
        const B = this.B;
        if (!B) return;
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (let y = 0; y < B.h; y++) {
            for (let x = 0; x < B.w; x++) {
                const t = B.tiles[y * B.w + x];
                if (t.gap) continue;
                const sx = (x - y) * TW / 2, sy = (x + y) * TH / 2;
                const lift = (t.h + (t.c === '#' ? 1.6 : t.c === 't' ? 0.8 : 0)) * HZ;
                minX = Math.min(minX, sx - TW / 2); maxX = Math.max(maxX, sx + TW / 2);
                minY = Math.min(minY, sy - lift - TH / 2 - 62); maxY = Math.max(maxY, sy + TH / 2 + BASE + 6 - 0);
            }
        }
        const { t, b, l, r } = this.inset;
        const aw = this.w - l - r, ah = this.h - t - b;
        this.cam = { s: Math.max(0.25, Math.min(1.7, aw / (maxX - minX), ah / (maxY - minY))) };
        this.cam.ox = l + aw / 2 - ((minX + maxX) / 2) * this.cam.s;
        this.cam.oy = t + ah / 2 - ((minY + maxY) / 2) * this.cam.s;
    }

    /** Screen position (canvas px) of the middle of a tile's top face. */
    screen(x, y, h) {
        const c = this.cam;
        return [c.ox + ((x - y) * TW / 2) * c.s, c.oy + ((x + y) * TH / 2 - h * HZ) * c.s];
    }

    tileToClient(x, y) {
        const r = this.canvas.getBoundingClientRect();
        const h = this.B ? this.B.tiles[y * this.B.w + x].h : 0;
        const [sx, sy] = this.screen(x, y, h);
        return { x: r.left + sx, y: r.top + sy };
    }

    /** The tile under a client point: units first (their bodies overlap the tiles behind), then the floor, front to back. */
    pick(clientX, clientY) {
        const B = this.B;
        if (!B) return null;
        const r = this.canvas.getBoundingClientRect();
        const px = clientX - r.left, py = clientY - r.top;
        const s = this.cam.s;
        // while a student is choosing, the others are see-through and the floor under them is clickable
        const list = this.ghost ? [] : [...this.vis.values()].filter((v) => v.alive).sort((a, b) => (b.x + b.y) - (a.x + a.y));
        for (const v of list) {
            const [fx, fy] = this.screen(v.x, v.y, v.z);
            const hh = 56 * v.size * s, ww = 16 * v.size * s;
            if (Math.abs(px - fx) < ww && py > fy - hh && py < fy + 8 * s) return { x: Math.round(v.x), y: Math.round(v.y) };
        }
        for (let sum = B.w + B.h - 2; sum >= 0; sum--) {
            for (let x = Math.min(B.w - 1, sum); x >= 0 && sum - x < B.h; x--) {
                const y = sum - x;
                const t = B.tiles[y * B.w + x];
                const top = t.c === '#' ? t.h + 1.6 : t.c === 't' ? t.h + 0.8 : t.h;
                const [sx, sy] = this.screen(x, y, top);
                if (Math.abs(px - sx) / (TW / 2 * s) + Math.abs(py - sy) / (TH / 2 * s) <= 1) return { x, y };
            }
        }
        return null;
    }

    _bindPointer() {
        const cv = this.canvas;
        let down = null;
        cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
        cv.addEventListener('pointerup', (e) => {
            if (!down || e.pointerId !== down.id) return;
            const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
            down = null;
            if (moved > 12) return;                                    // a drag is not a tap
            const p = this.pick(e.clientX, e.clientY);
            this.onTap?.(p ? p.x : null, p ? p.y : null);
        });
        cv.addEventListener('pointercancel', () => { down = null; });
        cv.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            const p = this.pick(e.clientX, e.clientY);
            this.onHover?.(p ? p.x : null, p ? p.y : null);
        });
        cv.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ------------------------------------------------------------------ battle state
    setBattle(G, scenery = false) {
        const B = G.B;
        this.B = B;
        this.scenery = scenery;
        this.q.length = 0; this.cur = null;
        this.texts.length = 0; this.parts.length = 0; this.banner = null;
        this.vis.clear();
        if (!B) return;
        this.theme = THEMES[CHAPTERS[B.chapter].theme] || THEMES.yard;
        for (const u of B.units) this.vis.set(u.id, this._visOf(u));
        if (B.turn && !scenery) this.vis.get(B.turn.id).active = true;
        this.guestAsk = CHAPTERS[B.chapter].guest?.ask || '';
        this.fit();
    }

    _visOf(u) {
        const size = { pip: 1, bram: 1.1, fenn: 0.95, pudge: 1.15, bunny: 0.9, sprite: 0.85, scone: 1.1, basil: 1.35 }[u.key] || 1;
        return {
            id: u.id, key: u.key, team: u.team, x: u.x, y: u.y, z: this.B.tiles[u.y * this.B.w + u.x]?.h || 0, hp: u.hp, maxhp: u.maxhp, mp: u.mp, st: { ...u.st },
            alive: u.alive, active: false, flash: 0, hop: 0, lean: 0, dir: 1, fade: 0, ox: 0, oy: 0, shake: 0, face: 'idle', size, fly: u.fly, phase: u.id * 1.7, squash: 0, spin: 0,
        };
    }

    get busy() { return !!this.cur || this.q.length > 0; }

    onEvents(G, events) { for (const e of events) this.q.push(e); }

    /** Skip every animation: used by tests and the debug fast-forward. */
    skipAll(G) {
        this.q.length = 0; this.cur = null; this.banner = null;
        if (this.B) {
            this.vis.clear();
            for (const u of this.B.units) this.vis.set(u.id, this._visOf(u));
            if (this.B.turn) this.vis.get(this.B.turn.id).active = true;
        }
    }

    // ------------------------------------------------------------------ event playback
    _begin(ev) {
        const v = this.vis.get(ev.id);
        const c = { ev, v, t: 0, dur: 0 };
        this.onPlay?.(ev);
        switch (ev.type) {
            case 'turn':
                for (const o of this.vis.values()) o.active = false;
                if (v) v.active = true;
                c.dur = 0.3;
                break;
            case 'move': {
                c.dur = Math.max(0.2, 0.17 * (ev.path.length - 1));
                break;
            }
            case 'warp': v.x = ev.x; v.y = ev.y; v.z = this._h(ev.x, ev.y); this._puff(ev.x, ev.y, v.z, '#fff'); c.dur = 0.2; break;
            case 'skill': {
                const sk = SKILLS[ev.skill];
                const tgt = [ev.x, ev.y];
                const [cx, cy] = [ev.x - v.x, ev.y - v.y];
                v.dir = (cx - cy) < 0 ? -1 : (cx - cy) > 0 ? 1 : v.dir;
                c.melee = sk.range[1] <= 1 && sk.range[1] > 0;
                c.dx = Math.sign(cx) * (Math.abs(cx) >= Math.abs(cy) ? 1 : 0); c.dy = Math.sign(cy) * (Math.abs(cy) > Math.abs(cx) ? 1 : 0);
                c.dur = 0.55;
                this._text(v.x, v.y, v.z + 2.3, sk.name === 'Wobbly Scepter' || !sk.cost ? '' : sk.name, '#fff6c8');
                this._castFx(ev, sk, v, tgt);
                break;
            }
            case 'hit': {
                v.flash = 1; v.face = 'hurt'; c.dur = 0.45;
                this._text(v.x, v.y, v.z + 2.4, String(ev.dmg), '#fff', '#e0506a', 1.25);
                this._burst(v.x, v.y, v.z + 1.1, 7, ['#fff', '#ffd94d', '#ff9ec7'], 'spark');
                break;
            }
            case 'heal':
                c.dur = 0.5;
                v.hp = ev.hp;
                if (ev.amt > 0) this._text(v.x, v.y, v.z + 2.4, `+${ev.amt}`, '#d8ffe0', '#2f9a5a', 1.2);
                this._burst(v.x, v.y, v.z + 0.6, 8, ['#8cf0a8', '#fff', '#ffe0f0'], 'heart');
                break;
            case 'status':
                c.dur = ev.on ? 0.3 : 0.05;
                if (v) { if (ev.on) v.st[ev.s] = 1; else delete v.st[ev.s]; }
                if (ev.on && v) this._text(v.x, v.y, v.z + 2.4, STATUS[ev.s].short, '#fff6c8');
                break;
            case 'faint': c.dur = 0.8; v.face = 'ko'; this._burst(v.x, v.y, v.z + 1, 10, ['#fff', '#ffd94d'], 'star'); break;
            case 'oops':
                c.dur = 0.95;
                this._text(v.x, v.y, v.z + 2.6, 'Oops!', '#ffe0f0', '#d9528a', 1.3);
                break;
            case 'lucky':
                c.dur = 0.5;
                this._text(v.x, v.y, v.z + 2.6, 'Lucky stumble!', '#fff6a0', '#d99a1a', 1.2);
                this._burst(v.x, v.y, v.z + 1, 12, ['#ffe66d', '#fff', '#ff9ec7'], 'star');
                break;
            case 'sleepy': c.dur = 0.5; this._text(v.x, v.y, v.z + 2.4, 'Zzz…', '#d8d0ff'); break;
            case 'resist': c.dur = 0.4; this._text(v.x, v.y, v.z + 2.4, 'Resists!', '#fff'); break;
            case 'rescue':
                c.dur = 0.8; v.team = 'p';
                this._text(v.x, v.y, v.z + 2.6, 'Joined!', '#ffe0f0', '#d9528a', 1.3);
                this._burst(v.x, v.y, v.z + 1, 16, ['#ff9ec7', '#ffe66d', '#fff'], 'heart');
                break;
            case 'talk':
                c.wait = true;
                this.onTalk?.(ev.lines, () => { c.wait = false; c.dur = 0; c.t = 0; });
                break;
            case 'end':
                c.dur = ev.result === 'win' ? 1.6 : 1.4;
                this.banner = { text: ev.result === 'win' ? (ev.why === 'yield' ? 'The Dread Lord yields!' : 'Chapter clear!') : 'The party is tuckered out…', win: ev.result === 'win', t: 0 };
                if (ev.result === 'win') for (let i = 0; i < 3; i++) this._confetti();
                break;
            case 'battle': break;
            default: break;
        }
        return c;
    }

    _step(c, p) {
        const v = c.v;
        switch (c.ev.type) {
            case 'move': {
                const path = c.ev.path, segs = path.length - 1;
                const f = Math.min(segs - 1e-6, p * segs), i = Math.floor(f), k = f - i;
                const [ax, ay] = path[i], [bx, by] = path[i + 1];
                v.x = lerp(ax, bx, k); v.y = lerp(ay, by, k);
                const ha = this._h(ax, ay), hb = this._h(bx, by);
                v.z = lerp(ha, hb, k);
                v.hop = Math.sin(k * Math.PI) * 7;
                const sx = (bx - by) - (ax - ay);
                if (sx) v.dir = sx > 0 ? 1 : -1;
                break;
            }
            case 'skill':
                if (c.melee) { const k = Math.sin(clamp01(p * 1.6) * Math.PI) * 0.34; v.ox = (c.dx || 0) * k; v.oy = (c.dy || 0) * k; }
                else v.hop = Math.sin(clamp01(p * 2) * Math.PI) * 6;
                v.squash = p < 0.3 ? p * 0.3 : Math.max(0, 0.1 - (p - 0.3) * 0.3);
                break;
            case 'hit':
                v.flash = 1 - p; v.shake = Math.sin(c.t * 60) * 7 * (1 - p) * (1 - p); v.hp = lerp(c.hp0 ?? (c.hp0 = v.hp), c.ev.hp, clamp01(p * 1.6));
                break;
            case 'oops': v.lean = Math.sin(p * Math.PI) * 1.2; v.hop = Math.max(0, Math.sin(p * Math.PI * 3)) * 3; break;
            case 'lucky': v.hop = Math.sin(p * Math.PI) * 10; break;
            case 'faint': v.fade = p; v.hop = p * 14; break;
            case 'rescue': v.hop = Math.abs(Math.sin(p * Math.PI * 3)) * 8; break;
            default: break;
        }
    }

    _finish(c) {
        const v = c.v;
        switch (c.ev.type) {
            case 'move': { const [x, y] = c.ev.path[c.ev.path.length - 1]; v.x = x; v.y = y; v.z = this._h(x, y); v.hop = 0; break; }
            case 'skill': v.ox = v.oy = v.hop = v.squash = 0; break;
            case 'hit': v.flash = 0; v.shake = 0; v.hp = c.ev.hp; v.face = 'idle'; break;
            case 'oops': v.lean = 0; v.hop = 0; break;
            case 'lucky': case 'rescue': v.hop = 0; break;
            case 'faint': v.alive = false; v.hp = 0; v.face = 'idle'; v.fade = 1; break;
            case 'heal': v.hp = c.ev.hp; break;
            case 'end': this.banner = null; this.onEnd?.(c.ev); break;
            default: break;
        }
    }

    update(dt) {
        this.time += dt;
        let left = dt * this.speed;
        for (let guard = 0; guard < 80; guard++) {
            if (!this.cur) {
                if (!this.q.length) break;
                this.cur = this._begin(this.q.shift());
            }
            const c = this.cur;
            if (c.wait) break;
            const need = c.dur - c.t;
            if (left >= need) {
                this._step(c, 1); this._finish(c); this.cur = null; left -= need;
            } else {
                c.t += left; left = 0;
                this._step(c, c.dur ? c.t / c.dur : 1);
                break;
            }
        }
        // particles and floating text run on real time, not the queue
        const d = Math.min(dt, 0.05) * (this.speed > 1 ? Math.min(2, this.speed) : 1);
        for (const p of this.parts) { p.t += d; p.x += p.vx * d; p.y += p.vy * d; p.z += p.vz * d; p.vz += (p.g || 0) * d; }
        this.parts = this.parts.filter((p) => p.t < p.life);
        for (const x of this.texts) x.t += d;
        this.texts = this.texts.filter((x) => x.t < x.life);
        if (this.banner) this.banner.t += d;
        for (const v of this.vis.values()) v.hop = v.hop || 0;
        if (!this.calm && this.theme.petals && Math.random() < dt * 2.2) this._petal();
    }

    _h(x, y) { return this.B?.tiles[Math.round(y) * this.B.w + Math.round(x)]?.h || 0; }

    // ------------------------------------------------------------------ fx
    _text(x, y, z, text, color, outline = '#7a4a6a', size = 1) {
        if (!text) return;
        this.texts.push({ x, y, z, text, color, outline, size, t: 0, life: 1.1 });
    }
    _burst(x, y, z, n, colors, type) {
        if (this.calm) n = Math.ceil(n / 3);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + (i % 3) * 0.7;
            const sp = 0.8 + (i % 4) * 0.35;
            this.parts.push({ type, x, y, z, vx: Math.cos(a) * sp * 0.5, vy: Math.sin(a) * sp * 0.5, vz: 1.2 + (i % 3) * 0.5, g: -3.2, t: 0, life: 0.7 + (i % 3) * 0.12, color: colors[i % colors.length], size: 1 });
        }
    }
    _puff(x, y, z, color) { this.parts.push({ type: 'puff', x, y, z, vx: 0, vy: 0, vz: 0.4, t: 0, life: 0.4, color, size: 1 }); }
    _petal() {
        const B = this.B; if (!B) return;
        this.parts.push({ type: 'petal', x: Math.random() * B.w * 1.2 - 1, y: -2 - Math.random() * 3, z: 5 + Math.random() * 3, vx: 0.35, vy: 0.5, vz: -0.9, t: 0, life: 7, color: this.theme.petals, size: 1, sway: Math.random() * 6 });
    }
    _confetti() {
        const B = this.B; if (!B) return;
        const cols = ['#ff9ec7', '#ffe66d', '#8ccf8c', '#8cc8ff', '#c9a8ff'];
        for (let i = 0; i < 28; i++) this.parts.push({ type: 'conf', x: Math.random() * B.w, y: Math.random() * B.h, z: 7 + Math.random() * 4, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: -1.2 - Math.random(), t: 0, life: 3.2, color: cols[i % cols.length], size: 1, sway: Math.random() * 6 });
    }

    _castFx(ev, sk, v, tgt) {
        const tiles = ev.tiles || [{ x: ev.x, y: ev.y }];
        const h = (x, y) => this._h(x, y);
        const fx = sk.fx;
        if (fx === 'sparkle' || fx === 'crown' || fx === 'stars') {
            for (const t of tiles) this._burst(t.x, t.y, h(t.x, t.y) + 0.8, fx === 'stars' ? 6 : 4, ['#ff9ec7', '#ffe66d', '#8cc8ff', '#c9a8ff', '#fff'], 'star');
        } else if (fx === 'star') {
            this._burst(ev.x, ev.y, h(ev.x, ev.y) + 1, 6, ['#ffe66d', '#fff'], 'star');
        } else if (fx === 'slash' || fx === 'smite') {
            this.parts.push({ type: 'slash', x: ev.x, y: ev.y, z: h(ev.x, ev.y) + 1.2, vx: 0, vy: 0, vz: 0, t: -0.15, life: 0.3, color: fx === 'smite' ? '#c9a8ff' : '#fff', size: 1 });
        } else if (fx === 'arrow' || fx === 'ink' || fx === 'soot' || fx === 'leaf') {
            const col = { arrow: '#fff6c8', ink: '#3a3a8a', soot: '#4a4050', leaf: '#8ccf6a' }[fx];
            this.parts.push({ type: 'proj', x: v.x, y: v.y, z: v.z + 1.4, tx: ev.x, ty: ev.y, tz: h(ev.x, ev.y) + 1, t: 0, life: 0.28, color: col, kind: fx, vx: 0, vy: 0, vz: 0, size: 1 });
            if (tiles.length > 1) for (const t of tiles) this._burst(t.x, t.y, h(t.x, t.y) + 1, 3, [col], 'spark');
        } else if (fx === 'heal' || fx === 'bloom') {
            for (const t of tiles) this._burst(t.x, t.y, h(t.x, t.y) + 0.4, 3, ['#8cf0a8', '#fff'], 'heart');
        } else if (fx === 'zzz') {
            this._burst(ev.x, ev.y, h(ev.x, ev.y) + 1.6, 4, ['#d8d0ff'], 'puff');
        } else if (fx === 'shield') {
            for (const t of tiles) this._burst(t.x, t.y, h(t.x, t.y) + 1, 3, ['#8cc8ff', '#fff'], 'spark');
        } else if (fx === 'stomp') {
            this.parts.push({ type: 'ring', x: v.x, y: v.y, z: v.z, vx: 0, vy: 0, vz: 0, t: 0, life: 0.5, color: '#ffe0a0', size: 1 });
        }
    }

    // ------------------------------------------------------------------ drawing
    frame(G, dt, time, ov = {}) {
        this.resize();
        this.update(dt);
        this.ov = ov;
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this._background(time);
        if (!this.B) return;
        const B = this.B;
        ctx.save();
        ctx.translate(this.cam.ox, this.cam.oy);
        ctx.scale(this.cam.s, this.cam.s);
        ctx.lineJoin = 'round';
        const units = [...this.vis.values()].filter((v) => v.alive || v.fade < 1);
        const byDiag = new Map();
        for (const v of units) { const k = Math.round(v.x + v.y); (byDiag.get(k) || byDiag.set(k, []).get(k)).push(v); }
        for (let sum = 0; sum <= B.w + B.h - 2; sum++) {
            for (let x = Math.max(0, sum - B.h + 1); x <= Math.min(B.w - 1, sum); x++) this._tile(x, sum - x, time);
            const list = byDiag.get(sum);
            if (list) for (const v of list.sort((a, b) => a.x + a.y - (b.x + b.y))) this._unit(v, time);
        }
        for (const p of this.parts) this._particle(p, time);
        for (const t of this.texts) this._floatText(t);
        ctx.restore();
        if (this.banner) this._bannerDraw();
    }

    _background(time) {
        const ctx = this.ctx, th = this.theme;
        const g = ctx.createLinearGradient(0, 0, 0, this.h);
        g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
        if (th.clouds) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (let i = 0; i < 4; i++) {
                const x = ((time * (6 + i * 3) + i * 330) % (this.w + 240)) - 120, y = 40 + i * 38 + (i % 2) * 20;
                for (const [dx, dy, r] of [[0, 0, 20], [22, -8, 26], [50, 0, 20], [24, 6, 20]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); }
            }
        } else {
            // indoor: a soft vignette and a warm glow
            const v = ctx.createRadialGradient(this.w / 2, this.h * 0.45, this.h * 0.2, this.w / 2, this.h * 0.45, Math.max(this.w, this.h) * 0.75);
            v.addColorStop(0, th.warm ? 'rgba(255,230,160,0.35)' : 'rgba(255,255,255,0.12)'); v.addColorStop(1, th.dark ? 'rgba(10,5,30,0.5)' : 'rgba(80,40,10,0.18)');
            ctx.fillStyle = v; ctx.fillRect(0, 0, this.w, this.h);
        }
    }

    _diamond(sx, sy) {
        const ctx = this.ctx;
        ctx.beginPath(); ctx.moveTo(sx, sy - TH / 2); ctx.lineTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx - TW / 2, sy); ctx.closePath();
    }

    _tile(x, y, time) {
        const B = this.B, ctx = this.ctx, th = this.theme;
        const t = B.tiles[y * B.w + x];
        if (t.gap) return;
        const sx = (x - y) * TW / 2, sy = (x + y) * TH / 2 - t.h * HZ;
        const stone = 'sSZ'.includes(t.c);
        const pair = stone ? th.s : th.g;
        let top = pair[(x + y) & 1];
        if (t.c === 'r') top = (x + y) & 1 ? '#e8c8a0' : '#d6584f';
        if (th.warm && !stone && t.c !== 'r') top = (x + y) & 1 ? '#fff4e0' : '#f1c9a0';
        top = shade(top, 1 + t.h * 0.05);
        const D = BASE + t.h * HZ;
        // sides
        const earth = stone ? th.s[1] : th.g[1];
        ctx.fillStyle = shade(earth, 0.78);
        ctx.beginPath(); ctx.moveTo(sx - TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx, sy + TH / 2 + D); ctx.lineTo(sx - TW / 2, sy + D); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(earth, 0.62);
        ctx.beginPath(); ctx.moveTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx, sy + TH / 2 + D); ctx.lineTo(sx + TW / 2, sy + D); ctx.closePath(); ctx.fill();
        // a thin dirt band under the grass
        if (!stone && !th.warm) {
            ctx.fillStyle = shade('#b98a5a', 0.9);
            ctx.beginPath(); ctx.moveTo(sx - TW / 2, sy + 5); ctx.lineTo(sx, sy + TH / 2 + 5); ctx.lineTo(sx, sy + TH / 2 + D); ctx.lineTo(sx - TW / 2, sy + D); ctx.closePath(); ctx.fill();
            ctx.fillStyle = shade('#b98a5a', 0.72);
            ctx.beginPath(); ctx.moveTo(sx + TW / 2, sy + 5); ctx.lineTo(sx, sy + TH / 2 + 5); ctx.lineTo(sx, sy + TH / 2 + D); ctx.lineTo(sx + TW / 2, sy + D); ctx.closePath(); ctx.fill();
        }
        this._diamond(sx, sy); ctx.fillStyle = top; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,40,60,0.18)'; ctx.stroke();

        // decoration
        if (t.c === 'w') {
            for (const [dx, dy, col] of [[-10, -2, '#ff8fb1'], [6, 3, '#fff'], [-2, 5, '#ffe66d'], [12, -4, '#ff8fb1']]) {
                ctx.fillStyle = '#4f9a3f'; ctx.fillRect(sx + dx - 0.5, sy + dy, 1, 4);
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx + dx, sy + dy, 2.4, 0, TAU); ctx.fill();
            }
        } else if (t.c === 'f' || t.c === 'F') {
            const sw = Math.sin(time * 1.5 + x + y) * 1.2;
            for (const [dx, dy, r] of [[-8, 2, 9], [8, 2, 9], [0, -3, 11]]) {
                ctx.fillStyle = shade(th.hedge ? '#4a9a4a' : '#5cb85a', 0.92 + (dy < 0 ? 0.12 : 0)); ctx.beginPath(); ctx.arc(sx + dx + sw * 0.3, sy + dy - 6, r, 0, TAU); ctx.fill();
            }
            ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(sx + 4, sy - 13, 2.2, 0, TAU); ctx.fill();
        } else if (t.c === 'r' && (x + y) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,240,200,.5)'; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TAU); ctx.fill();
        } else if (t.c === '.' && ((x * 7 + y * 13) % 5 === 0) && !th.warm && !th.dark) {
            ctx.strokeStyle = 'rgba(60,140,60,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
            ctx.moveTo(sx - 4, sy + 2); ctx.lineTo(sx - 5, sy - 3); ctx.moveTo(sx - 2, sy + 2); ctx.lineTo(sx - 1, sy - 4); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + 2, sy - 2); ctx.stroke();
        } else if (th.dark && ((x * 5 + y * 3) % 7 === 0) && !stone) {
            ctx.strokeStyle = 'rgba(40,30,60,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx, sy + 4); ctx.stroke();
        }
        if (t.c === '#') this._block(sx, sy, 1.6, th.w, th);
        else if (t.c === 't') this._table(sx, sy, th);

        this._overlay(x, y, sx, sy - (t.c === '#' ? 1.6 * HZ : t.c === 't' ? 0.8 * HZ : 0), time);
    }

    _block(sx, sy, lift, pair, th) {
        const ctx = this.ctx, H = lift * HZ;
        const top = pair[0];
        ctx.fillStyle = shade(top, 0.8);
        ctx.beginPath(); ctx.moveTo(sx - TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx, sy + TH / 2 - H); ctx.lineTo(sx - TW / 2, sy - H); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(top, 0.62);
        ctx.beginPath(); ctx.moveTo(sx + TW / 2, sy); ctx.lineTo(sx, sy + TH / 2); ctx.lineTo(sx, sy + TH / 2 - H); ctx.lineTo(sx + TW / 2, sy - H); ctx.closePath(); ctx.fill();
        if (th.shelf) {                      // bookshelves: coloured spines on both faces
            const cols = ['#d9584a', '#4b6fb0', '#e8c14a', '#6aa86a', '#9a6ac0'];
            for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
                ctx.fillStyle = cols[(i + r * 2) % 5];
                const px = i * 5 + 2, py = -4 - r * 8;
                ctx.fillRect(sx - TW / 2 + px, sy + py + px * 0.5 - H + 14 + 0, 3.4, 6);
                ctx.fillRect(sx + px - 1, sy + py + TH / 2 - px * 0.5 - H + 14 + 0, 3.4, 6);
            }
        } else if (th.hedge) {
            for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#5cb85a' : '#3f8a40'; ctx.beginPath(); ctx.arc(sx - 22 + i * 9, sy - H + 12 + (i % 2) * 5, 8, 0, TAU); ctx.fill(); }
        }
        this._diamond(sx, sy - H);
        ctx.fillStyle = th.hedge ? '#5cb85a' : shade(top, 1.15); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,40,60,.25)'; ctx.stroke();
    }

    _table(sx, sy, th) {
        const ctx = this.ctx;
        this._block(sx, sy, 0.8, th.dark ? ['#9a6a3a', '#7a4a2a'] : ['#c9894a', '#a8693a'], { shelf: false, hedge: false });
        ctx.fillStyle = th.dark ? '#7a4a2a' : '#fff6dc';
        ctx.beginPath(); ctx.ellipse(sx - 6, sy - 15, 4, 2.4, 0, 0, TAU); ctx.fill();
    }

    _overlay(x, y, sx, sy, time) {
        const ctx = this.ctx, ov = this.ov;
        const k = y * this.B.w + x;
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        const paint = (fill, stroke, a) => {
            this._diamond(sx, sy); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.fill();
            ctx.globalAlpha = 1; ctx.lineWidth = 1.6; ctx.strokeStyle = stroke; ctx.stroke();
        };
        if (ov.move?.has(k)) paint('#5fb0ff', '#ffffff', 0.55 + pulse * 0.12);
        if (ov.atk?.has(k)) paint('#ff6b8a', '#ffe0e6', 0.38 + pulse * 0.1);
        if (ov.tgt?.has(k)) paint('#ffb24d', '#fff1d0', 0.5 + pulse * 0.12);
        if (ov.aoe?.has(k)) paint('#ffd94d', '#fff', 0.55 + pulse * 0.15);
        if (ov.path?.has(k)) {
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, TAU); ctx.fill();
        }
        if (ov.cursor && ov.cursor.x === x && ov.cursor.y === y) {
            const j = 1 + pulse * 0.06;
            ctx.save(); ctx.translate(sx, sy); ctx.scale(j, j); this._diamond(0, 0);
            ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
            ctx.lineWidth = 1.4; ctx.strokeStyle = '#ff5d8f'; ctx.stroke(); ctx.restore();
        }
    }

    _unit(v, time) {
        const ctx = this.ctx;
        const z = v.z + (v.fly ? 0.9 + Math.sin(time * 4 + v.phase) * 0.12 : 0);
        const sx = (v.x + v.ox - v.y - v.oy) * TW / 2 + (v.shake || 0), sy = (v.x + v.ox + v.y + v.oy) * TH / 2 - v.z * HZ;
        const s = v.size;
        const alpha = (v.fade > 0 ? 1 - v.fade : 1) * (this.ghost && !v.active ? 0.42 : 1);
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        // shadow and team ring
        ctx.fillStyle = 'rgba(40,20,50,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 15 * s, 6.5 * s, 0, 0, TAU); ctx.fill();
        const ring = v.team === 'p' ? '#5fb8ff' : v.team === 'e' ? '#ff6b8a' : '#ffd94d';
        ctx.lineWidth = 2.2; ctx.strokeStyle = ring; ctx.globalAlpha = alpha * (v.active ? 1 : 0.7);
        ctx.beginPath(); ctx.ellipse(sx, sy + 2, 17 * s, 7.5 * s, 0, 0, TAU); ctx.stroke();
        if (v.active) {
            const k = (time * 1.4) % 1;
            ctx.strokeStyle = '#fff'; ctx.globalAlpha = (1 - k) * alpha;
            ctx.beginPath(); ctx.ellipse(sx, sy + 2, (17 + k * 14) * s, (7.5 + k * 6) * s, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        const floatY = (v.fly ? 0.9 + Math.sin(time * 4 + v.phase) * 0.12 : 0) * HZ;
        drawActor(ctx, v.key, sx, sy - floatY + 2, s * 1.0, {
            t: time, dir: v.dir, hop: v.hop, lean: v.lean, squash: v.squash, flash: v.flash, face: v.face, phase: v.phase, bob: v.team === 'g' ? 0.6 : 1,
        });
        // hp bar, status pips and the active marker
        const top = sy - floatY - 62 * s - 6;
        if (v.team !== 'g' && v.alive && !this.scenery) {
            const bw = 30;
            ctx.fillStyle = 'rgba(40,20,50,0.55)'; ctx.beginPath(); ctx.roundRect(sx - bw / 2 - 1.5, top - 1.5, bw + 3, 7, 3.5); ctx.fill();
            const f = clamp01(v.hp / v.maxhp);
            ctx.fillStyle = f > 0.5 ? (v.team === 'p' ? '#7ee89a' : '#ff8a9a') : f > 0.25 ? '#ffd94d' : '#ff6b6b';
            ctx.beginPath(); ctx.roundRect(sx - bw / 2, top, Math.max(2, bw * f), 4, 2); ctx.fill();
            let px = sx - bw / 2;
            for (const s2 of Object.keys(v.st)) {
                ctx.fillStyle = { cheer: '#ffd94d', guard: '#6ab8ff', regen: '#7ee89a', sleepy: '#b9a0ff' }[s2] || '#fff';
                ctx.beginPath(); ctx.arc(px + 3, top - 7, 3, 0, TAU); ctx.fill();
                ctx.strokeStyle = 'rgba(60,40,60,.6)'; ctx.lineWidth = 1; ctx.stroke();
                px += 8;
            }
        }
        if (v.active && v.alive && !this.scenery) {
            const bounce = Math.sin(time * 6) * 3;
            ctx.fillStyle = '#ffd94d'; ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(sx, top - 12 + bounce + 8); ctx.lineTo(sx - 6, top - 12 + bounce); ctx.lineTo(sx + 6, top - 12 + bounce); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (v.team === 'g' && this.guestAsk) this._bubble(sx, top - 2 + Math.sin(time * 3) * 2, this.guestAsk);
        ctx.globalAlpha = 1;
    }

    _bubble(x, y, text) {
        const ctx = this.ctx;
        ctx.font = `600 11px ${FONT}`;
        const w = Math.min(200, ctx.measureText(text).width + 14);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7a4a6a'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - 22, w, 20, 8); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x, y + 3); ctx.lineTo(x + 4, y - 3); ctx.fill();
        ctx.fillStyle = '#5a3a5a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text.length > 32 ? text.slice(0, 31) + '…' : text, x, y - 12);
    }

    _particle(p, time) {
        const ctx = this.ctx;
        if (p.t < 0) return;
        const k = p.t / p.life;
        let sx = (p.x - p.y) * TW / 2, sy = (p.x + p.y) * TH / 2 - p.z * HZ;
        if (p.type === 'proj') {
            const u = clamp01(k);
            const x = lerp(p.x, p.tx, u), y = lerp(p.y, p.ty, u), z = lerp(p.z, p.tz, u) + Math.sin(u * Math.PI) * 0.8;
            sx = (x - y) * TW / 2; sy = (x + y) * TH / 2 - z * HZ;
            ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(60,40,60,.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(sx, sy, p.kind === 'arrow' ? 3 : 5, 0, TAU); ctx.fill(); ctx.stroke();
            if (p.kind === 'arrow') { ctx.beginPath(); ctx.moveTo(sx - 8, sy + 3); ctx.lineTo(sx, sy); ctx.strokeStyle = '#fff'; ctx.stroke(); }
            return;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.translate(sx, sy);
        if (p.type === 'spark') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 2.6 * (1 - k * 0.6), 0, TAU); ctx.fill(); }
        else if (p.type === 'star') this._star(0, 0, 5 * (1 - k * 0.4), p.color, time * 3 + p.t);
        else if (p.type === 'heart') this._heart(0, 0, 5.5 * (1 - k * 0.3), p.color);
        else if (p.type === 'puff') { ctx.fillStyle = p.color; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(0, 0, 6 + k * 14, 0, TAU); ctx.fill(); }
        else if (p.type === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - k); ctx.beginPath(); ctx.ellipse(0, 0, 20 + k * 80, 10 + k * 40, 0, 0, TAU); ctx.stroke(); }
        else if (p.type === 'slash') {
            ctx.strokeStyle = p.color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 5, -12 + k * 6); ctx.lineTo(10 + i * 5, 12 - k * 4); ctx.stroke(); }
        } else if (p.type === 'petal') { ctx.globalAlpha = 0.85; ctx.translate(Math.sin(p.t * 1.6 + p.sway) * 14, 0); ctx.rotate(p.t * 1.5); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.4, 0, 0, TAU); ctx.fill(); }
        else if (p.type === 'conf') { ctx.globalAlpha = 1 - k * k * k; ctx.translate(Math.sin(p.t * 3 + p.sway) * 18, 0); ctx.rotate(p.t * 4); ctx.fillStyle = p.color; ctx.fillRect(-3, -2, 6, 4); }
        ctx.restore();
    }

    _star(x, y, r, fill, rot) {
        const ctx = this.ctx;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }

    _heart(x, y, r, fill) {
        const ctx = this.ctx;
        ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
        ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.4);
        ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
        ctx.fillStyle = fill; ctx.fill();
    }

    _floatText(t) {
        const ctx = this.ctx;
        const k = t.t / t.life;
        const sx = (t.x - t.y) * TW / 2, sy = (t.x + t.y) * TH / 2 - t.z * HZ - k * 26;
        ctx.save();
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const pop = k < 0.12 ? 0.6 + k * 4 : 1;
        ctx.translate(sx, sy); ctx.scale(pop * t.size, pop * t.size);
        ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = t.outline; ctx.strokeText(t.text, 0, 0);
        ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
        ctx.restore();
    }

    _bannerDraw() {
        const ctx = this.ctx, b = this.banner;
        const k = clamp01(b.t / 0.4);
        const y = this.h * 0.38;
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.translate(this.w / 2, y); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
        const w = Math.min(this.w - 24, 420);
        ctx.fillStyle = b.win ? '#ffe9a8' : '#e8dcff'; ctx.strokeStyle = b.win ? '#d9a41a' : '#7a6aa8'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(-w / 2, -34, w, 68, 22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a3a5a'; ctx.font = `700 ${w < 360 ? 22 : 28}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.text, 0, 2);
        ctx.restore();
    }
}
