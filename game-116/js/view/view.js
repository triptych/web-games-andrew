// The Canvas 2D view. It reads G and plays the sim's events back one at a time, keeping its own
// picture of the table (vis) and the numbers on screen (shown, the snapshot each event carries), so
// a resolved turn is shown blow by blow. It never changes G. It also owns the hit test for taps.

import { ENEMIES, LAYOUTS, REELS, SUITS, CARDS, GADGETS } from '../sim/data.js';
import { intentInfo, rankFits } from '../sim/battle.js';
import { choices } from '../sim/run.js';
import { cardName, cardText, gadgetText, intentText, suitText } from '../sim/text.js';
import { CHARGE_MAX, DRAWS_PER_TURN } from '../config.js';
import { CREAM, FONT_BODY, FONT_HEAD, INK, drawCard, drawEnemy, drawSaucer, fitText, nodeIcon, paintBackdrop, rrect, suitIcon } from './art.js';

const DUR = {
    play: 0.17, flip: 0.03, draw: 0.24, block: 0.07, charge: 0.05, heal: 0.12, gadget: 0.26, status: 0.3,
    jam: 0.45, freeze: 0.35, enemyMove: 0.36, sweep: 0.75, deal: 0.5, vaporize: 0.22, defeat: 1.0, dead: 1.5,
    battle: 0.25, reshuffle: 0.3, thaw: 0.1, stunned: 0.45, endTurn: 0.12, turn: 0.1,
};
const ROWSTEP = 0.5;          // rows overlap by half a card
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.queue = [];
        this.cur = null;
        this.curLeft = 0;
        this.speed = 1;
        this.film = 'on';
        this.reduced = !!window.A11Y?.reducedMotion;
        this.onEvent = null;        // main.js: audio and UI hear each event as it plays
        this.vis = { tab: new Map(), beam: null, beamAnim: null, layout: 'peaks', key: null, frozen: new Set(), dying: 0 };
        this.shown = null;
        this.floaters = [];
        this.parts = [];
        this.banner = null;
        this.shake = 0;
        this.hurt = 0;
        this.enemyFx = { flash: 0, lunge: 0, shake: 0, alpha: 1 };
        this.hits = [];
        this.focus = null;          // a key into hits ("card:12", "draw", "gadget:0", "node:5")
        this.hover = null;
        this.targeting = -1;        // a gadget waiting for a table card
        this.bgKey = '';
        this.time = 0;
        this.grain = this._makeGrain();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        document.fonts?.ready?.then(() => { this.bgKey = ''; });
    }

    get busy() { return !!this.cur || this.queue.length > 0; }

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
        this.bgKey = '';
    }

    // ------------------------------------------------------------------ event playback
    /** Rebuild the picture straight from G (a loaded save, a new run): no animation. */
    reset(G) {
        this.queue.length = 0;
        this.cur = null;
        this.floaters.length = 0;
        this.parts.length = 0;
        this.banner = null;
        this.targeting = -1;
        this.focus = null;
        this.enemyFx = { flash: 0, lunge: 0, shake: 0, alpha: 1 };
        const B = G.battle;
        this.vis.tab = new Map();
        if (B) {
            this.vis.key = B.key;
            this.vis.layout = B.layout;
            for (const c of B.tab) this.vis.tab.set(c.id, { ...c, x: null, y: null });
            this.vis.beam = B.beam ? { ...B.beam } : null;
            this.vis.beamAnim = null;
            this.enemyFx.alpha = B.done && B.won ? 0 : 1;
        }
        this.shown = this.liveSnap(G);
    }

    liveSnap(G) {
        const B = G.battle;
        const s = { hp: G.hp, maxHp: G.maxHp, bucks: G.bucks };
        if (B) {
            const e = B.enemy;
            Object.assign(s, { block: B.block, charge: B.charge, draws: B.draws, chain: B.chainBase + B.plays, ehp: e.hp, emax: e.maxHp, eblock: e.block, estr: e.str, eweak: e.weak, stock: B.stock.length, disc: B.discard.length, wild: B.wildBeam, xray: B.xray });
            s.intent = intentInfo(B);
        }
        return s;
    }

    push(events) { for (const e of events) this.queue.push(e); }

    /** Fast-forward everything still queued (a skip, or a test). */
    finish() {
        let guard = 0;
        while (this.busy && guard++ < 10000) this._advance(1e9);
    }

    _advance(dt) {
        let left = dt;
        while (left > 0) {
            if (!this.cur) {
                if (!this.queue.length) return;
                this.cur = this.queue.shift();
                this.curLeft = (DUR[this.cur.type] ?? (this.cur.type === 'hit' ? (this.cur.who === 'player' ? 0.34 : 0.1) : 0));
                this._start(this.cur);
            }
            const need = this.curLeft;
            if (left >= need) { left -= need; this.cur = null; }
            else { this.curLeft -= left; left = 0; }
        }
    }

    _start(e) {
        if (e.s) this.shown = e.s;
        const V = this.vis;
        const L = this.L;
        switch (e.type) {
            case 'battle':
                V.key = e.key; V.tab = new Map(); V.beam = null; V.beamAnim = null;
                this.enemyFx = { flash: 0, lunge: 0, shake: 0, alpha: 0, appear: 1 };
                this.banner = null;
                break;
            case 'deal': {
                V.layout = e.layout;
                V.tab = new Map();
                const from = this._enemyPos();
                e.cards.forEach((c, i) => V.tab.set(c.id, { ...c, x: from.x, y: from.y, delay: i * 0.02 }));
                break;
            }
            case 'flip': { const c = V.tab.get(e.id); if (c) { c.up = true; c.flipT = 1; } break; }
            case 'play': {
                const c = V.tab.get(e.id);
                const p = c && c.x != null ? { x: c.x, y: c.y } : this._beamPos();
                V.tab.delete(e.id);
                V.prevBeam = V.beam;
                V.beam = { r: e.r, s: e.suit, src: 'tab' };
                V.beamAnim = { x: p.x, y: p.y, t: 0, dur: 0.17 };
                const bp = this._beamPos();
                this._float(`×${e.chain}`, bp.x + (L?.cardW || 50) * 0.7, bp.y - (L?.cardH || 70) * 0.4, '#fff4b0', 18 + Math.min(14, e.chain));
                break;
            }
            case 'draw':
                if (e.card) {
                    const sp = this._stockPos();
                    V.prevBeam = V.beam;
                    V.beam = { ...e.card };
                    V.beamAnim = { x: sp.x, y: sp.y, t: 0, dur: 0.24 };
                    if (e.quick && !e.free) this._float('QUICK!', this._beamPos().x, this._beamPos().y - 50, '#7ff5ff', 16);
                }
                break;
            case 'hit': {
                if (e.who === 'enemy') {
                    const p = this._enemyPos();
                    if (e.n > 0) {
                        this._float(`-${e.n}`, p.x + (Math.random() - 0.5) * 50, p.y - 30, e.src === 'rocket' ? '#ffa94a' : '#ff6a55', 26);
                        this.enemyFx.flash = 1; this.enemyFx.shake = 1;
                        this._burst(p.x, p.y, e.src === 'rocket' ? '#ffa94a' : '#ffef9a', 10);
                    } else if (e.blocked) this._float('BLOCKED', p.x, p.y - 30, '#7fb4ff', 16);
                } else {
                    const p = this._playerPos();
                    if (e.n > 0) { this._float(`-${e.n}`, p.x, p.y - 20, '#ff4d4d', 28); this.hurt = 1; this.shake = Math.min(1, 0.4 + e.n / 20); }
                    else this._float('BLOCKED', p.x, p.y - 20, '#7fb4ff', 18);
                }
                break;
            }
            case 'block': {
                const p = e.who === 'enemy' ? this._enemyPos() : this._playerPos();
                this._float(`+${e.n} block`, p.x + 40, p.y - 10, '#7fb4ff', 16);
                break;
            }
            case 'charge': { const p = this._playerPos(); this._float(`+${e.n} charge`, p.x + 60, p.y - 30, '#5fd88f', 15); break; }
            case 'heal': {
                const p = e.who === 'enemy' ? this._enemyPos() : this._playerPos();
                this._float(`+${e.n}`, p.x, p.y - 30, '#7ff5a0', 22);
                break;
            }
            case 'gadget': {
                const def = GADGETS[e.k];
                this._float(def.name.toUpperCase(), this.w / 2, (this.L?.table.y || 200) + 20, '#ffcf3a', 20);
                if (def.fx.dmg) { const a = this._playerPos(), b = this._enemyPos(); this.zap = { ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0.3 }; }
                break;
            }
            case 'status': {
                const words = { weak: 'DAZED!', shrink: 'SHRUNK!', xray: 'X-RAY VISION!', boost: `RAYS +${e.n}`, chain: `CHAIN +${e.n}`, grow: 'IT GROWS!', wind: 'WINDING UP...', stun: 'FROZEN SOLID!', wild: 'WILD BEAM!', thaw: 'THAWED', tinfoil: 'TIN FOIL HAT!' };
                const p = ['weak', 'shrink', 'grow', 'wind', 'stun'].includes(e.what) ? this._enemyPos() : this._beamPos();
                this._float(words[e.what] || '', p.x, p.y - 60, '#e8d8ff', 18);
                break;
            }
            case 'jam': {
                const p = this._enemyPos(), q = this._stockPos();
                this.banner = { text: e.junk === 'static' ? 'JAMMED WITH STATIC!' : 'SLIMED!', t: 1.2, color: '#c9ff9a' };
                for (let i = 0; i < 16; i++) this.parts.push({ x: p.x, y: p.y, vx: (q.x - p.x) / 0.45 + (Math.random() - 0.5) * 80, vy: (q.y - p.y) / 0.45 + (Math.random() - 0.5) * 80, life: 0.45, max: 0.45, c: e.junk === 'static' ? '#d8e8d8' : '#7bd34a', r: 3 });
                break;
            }
            case 'freeze': for (const id of e.ids) { const c = V.tab.get(id); if (c) { c.frozen = true; this._burst(c.x ?? 0, c.y ?? 0, '#dff6ff', 8); } } break;
            case 'thaw': for (const c of V.tab.values()) c.frozen = false; break;
            case 'enemyMove': this.enemyFx.lunge = 1; break;
            case 'stunned': { const p = this._enemyPos(); this._float('FROZEN: SKIPS ITS MOVE', p.x, p.y - 60, '#bfeaff', 16); break; }
            case 'sweep': this.banner = { text: 'CLEAN SWEEP!', t: 1.3, color: '#ffcf3a' }; break;
            case 'vaporize': { const c = V.tab.get(e.id); if (c) { this._burst(c.x, c.y, '#ff7ab2', 18); V.tab.delete(e.id); } break; }
            case 'defeat': {
                const p = this._enemyPos();
                for (let i = 0; i < 4; i++) this._burst(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 60, ['#ffcf3a', '#ff6a55', '#fff4b0', '#7ff5ff'][i], 20);
                this.enemyFx.dying = 1;
                this.banner = { text: e.tier === 'boss' ? 'THE MONSTER IS DEAD!' : 'DESTROYED!', t: 1.4, color: '#ffcf3a' };
                break;
            }
            case 'dead': this.banner = { text: 'THE END?', t: 2, color: '#ff4d4d' }; this.hurt = 1; break;
            case 'reshuffle': this._float('RESHUFFLE', this._stockPos().x, this._stockPos().y - 50, '#e8d8ff', 15); break;
        }
        this.onEvent?.(e);
    }

    _float(text, x, y, color, size = 18) { this.floaters.push({ text, x, y, color, size, t: 0, life: 1.1 }); }
    _burst(x, y, color, n) {
        const k = this.reduced ? 0.4 : 1;
        for (let i = 0; i < n * k; i++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
            this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.3, max: 0.8, c: color, r: 2 + Math.random() * 2.5, g: 300 });
        }
    }

    // ------------------------------------------------------------------ layout
    _layout() {
        const w = this.w, h = this.h;
        const portrait = h > w * 1.08;
        const top = 46;
        let enemy, table, bar;
        if (portrait) {
            const eh = Math.max(150, Math.min(240, h * 0.25));
            const bh = Math.max(186, Math.min(240, h * 0.27));
            enemy = { x: 0, y: top + 30, w, h: eh };
            bar = { x: 0, y: h - bh, w, h: bh };
            table = { x: 8, y: enemy.y + eh + 6, w: w - 16, h: bar.y - (enemy.y + eh + 6) - 6 };
        } else {
            const bh = Math.max(118, Math.min(176, h * 0.25));
            const ew = Math.max(220, Math.min(420, w * 0.3));
            bar = { x: 0, y: h - bh, w, h: bh };
            enemy = { x: 0, y: top + 30, w: ew, h: bar.y - top - 34 };
            table = { x: ew + 4, y: top + 28, w: w - ew - 16, h: bar.y - top - 34 };
        }
        // table cards
        const rows = LAYOUTS[this.vis.layout] || LAYOUTS.peaks;
        let maxCol = 0;
        for (const r of rows) for (const c of r) maxCol = Math.max(maxCol, c);
        const across = (maxCol + 2) / 2;
        const gap = 1.06;
        let cardW = Math.min(table.w / (across * gap), table.h / ((1 + (rows.length - 1) * ROWSTEP) * 1.4 * 1.02), 104);
        cardW = Math.max(24, cardW);
        const cardH = cardW * 1.4;
        const tw = across * cardW * gap, th = cardH * (1 + (rows.length - 1) * ROWSTEP);
        const ox = table.x + (table.w - tw) / 2 + (cardW * gap) / 2;
        const oy = table.y + (table.h - th) / 2 + cardH / 2;
        // the bar: player strip, beam row, gadget row
        let strip, beamRow, gadRow;
        if (portrait) {
            strip = { x: 10, y: bar.y + 6, w: w - 20, h: 34 };
            gadRow = { x: 8, y: bar.y + bar.h - 58, w: w - 16, h: 52 };
            beamRow = { x: 8, y: strip.y + strip.h + 4, w: w - 16, h: gadRow.y - (strip.y + strip.h + 8) };
        } else {
            strip = { x: 12, y: bar.y + 8, w: Math.min(360, w * 0.28), h: bar.h - 16 };
            gadRow = { x: w - Math.min(470, w * 0.36) - 10, y: bar.y + 8, w: Math.min(470, w * 0.36), h: bar.h - 16 };
            beamRow = { x: strip.x + strip.w + 10, y: bar.y + 6, w: gadRow.x - (strip.x + strip.w) - 20, h: bar.h - 12 };
        }
        const bcH = Math.min(beamRow.h - 30, 140), bcW = bcH / 1.4;
        this.L = { portrait, enemy, table, bar, strip, beamRow, gadRow, cardW, cardH, ox, oy, gap, bcW, bcH };
    }
    cardPos(c) { const L = this.L; return { x: L.ox + (c.col / 2) * L.cardW * L.gap, y: L.oy + c.row * L.cardH * ROWSTEP }; }
    _enemyPos() { const E = this.L?.enemy; return E ? { x: E.x + E.w / 2, y: E.y + E.h * 0.5 } : { x: this.w / 2, y: 150 }; }
    _playerPos() { const S = this.L?.strip; return S ? { x: S.x + 60, y: S.y + 10 } : { x: 80, y: this.h - 150 }; }
    _beamRects() {
        const L = this.L, R = L.beamRow;
        const cy = R.y + R.h / 2;
        const lead = L.portrait ? 58 : 0;          // room for the chain badge on a phone
        const totalW = L.bcW * 2 + 16 + 112 + lead;
        const x0 = R.x + lead + Math.max(0, (R.w - totalW) / 2);
        return {
            stock: { x: x0, y: cy - L.bcH / 2, w: L.bcW, h: L.bcH },
            beam: { x: x0 + L.bcW + 16, y: cy - L.bcH / 2, w: L.bcW, h: L.bcH },
            btn: { x: x0 + L.bcW * 2 + 28, y: cy - 30, w: Math.min(112, R.x + R.w - (x0 + L.bcW * 2 + 28)), h: 60 },
        };
    }
    _beamPos() { if (!this.L) return { x: this.w / 2, y: this.h - 100 }; const b = this._beamRects().beam; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
    _stockPos() { if (!this.L) return { x: this.w / 2 - 60, y: this.h - 100 }; const b = this._beamRects().stock; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

    // ------------------------------------------------------------------ input
    /** Client px → the hit under it, topmost first. */
    hitAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const x = clientX - r.left, y = clientY - r.top;
        for (let i = this.hits.length - 1; i >= 0; i--) {
            const h = this.hits[i];
            if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
        }
        return null;
    }
    focusable() { return this.hits.filter((h) => h.focus); }
    focusHit() { return this.hits.find((h) => h.key === this.focus) || null; }
    /** Spatial cursor: pick the focusable that best lies in direction (dx, dy). */
    moveFocus(dx, dy) {
        const list = this.focusable();
        if (!list.length) return;
        const cur = this.focusHit();
        if (!cur) { this.focus = list[0].key; return; }
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        let best = null, bs = Infinity;
        for (const h of list) {
            if (h === cur) continue;
            const vx = h.x + h.w / 2 - cx, vy = h.y + h.h / 2 - cy;
            const d = Math.hypot(vx, vy) || 1;
            const cos = (vx * dx + vy * dy) / d;
            if (cos < 0.3) continue;
            const s = d * (2 - cos);
            if (s < bs) { bs = s; best = h; }
        }
        if (!best && dx !== 0) {
            // wrap round within the row of focusables
            const sorted = list.slice().sort((a, b) => a.x - b.x);
            best = dx > 0 ? sorted[0] : sorted[sorted.length - 1];
        }
        if (best) this.focus = best.key;
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        this.time = time;
        this._advance(dt * this.speed);
        if (!this.busy && G) this.shown = this.liveSnap(G);
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.hits = [];
        const scene = REELS[Math.min(G?.act ?? 0, 2)].scene;
        const mode = !G || (G.over && !G.battle) ? 'title' : G.phase === 'battle' || (G.phase === 'reward' && G.offer?.kind === 'reward') || (G.over && G.battle) ? 'battle' : G.phase === 'map' ? 'map' : 'scene';
        this._backdrop(mode === 'title' ? 'desert' : scene, mode === 'battle');
        ctx.save();
        if (this.shake > 0 && !this.reduced) ctx.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
        if (mode === 'title') this._title(time);
        else if (mode === 'battle' && G.battle) this._battle(G, time, dt);
        else if (mode === 'map' || mode === 'scene') this._map(G, time, mode === 'scene');
        this._effects(dt);
        ctx.restore();
        this.shake = Math.max(0, this.shake - dt * 3);
        this.hurt = Math.max(0, this.hurt - dt * 2.2);
        if (this.hurt > 0) {
            const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
            g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(220,20,20,${0.45 * this.hurt})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
        }
        this._filmOverlay(time);
    }

    _backdrop(scene, dimTop) {
        const key = `${scene}:${this.w}x${this.h}`;
        if (this.bgKey !== key) {
            this.bgKey = key;
            const c = this.bg || (this.bg = document.createElement('canvas'));
            c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
            const x = c.getContext('2d');
            x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            paintBackdrop(x, scene, this.w, this.h, scene.length * 7);
            // vignette baked in
            const g = x.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
            x.fillStyle = g; x.fillRect(0, 0, this.w, this.h);
        }
        this.ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    }

    // ------------------------------------------------------------------ the title / attract scene
    _title(t) {
        const ctx = this.ctx, w = this.w, h = this.h;
        const sx = w / 2 + Math.sin(t * 0.5) * w * 0.12, sy = h * 0.2 + Math.sin(t * 1.3) * 8;
        const s = Math.min(3.4, w / 160);
        // the tractor beam, and cards drifting up it
        const g = ctx.createLinearGradient(0, sy, 0, h);
        g.addColorStop(0, 'rgba(170,255,210,0.5)'); g.addColorStop(1, 'rgba(170,255,210,0.02)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(sx - 12 * s, sy + 4 * s); ctx.lineTo(sx + 12 * s, sy + 4 * s); ctx.lineTo(sx + 40 * s, h); ctx.lineTo(sx - 40 * s, h); ctx.fill();
        const cw = Math.min(46, w / 9);
        for (let i = 0; i < 7; i++) {
            const k = ((t * 0.12 + i / 7) % 1);
            const y = lerp(h * 0.95, sy + 20, k);
            const x = sx + Math.sin(t * 1.5 + i * 2) * (1 - k) * 30 * s * 0.6;
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * 0.6 * (1 - k)); ctx.globalAlpha = 1 - k * 0.6;
            drawCard(ctx, { r: (i * 4) % 13 + 1, s: i % 4 }, 0, 0, cw * (1 - k * 0.5), cw * 1.4 * (1 - k * 0.5), { down: i % 3 === 1 });
            ctx.restore();
        }
        drawSaucer(ctx, sx, sy, s, t);
    }

    // ------------------------------------------------------------------ the fight
    _battle(G, t, dt) {
        this._layout();
        const ctx = this.ctx, L = this.L, B = G.battle, S = this.shown || this.liveSnap(G), V = this.vis;
        const def = ENEMIES[V.key || B.key];
        const canAct = !G.over && G.phase === 'battle' && !B.done;

        // --- the creature
        const E = L.enemy;
        const ef = this.enemyFx;
        ef.flash = Math.max(0, ef.flash - dt * 5); ef.shake = Math.max(0, ef.shake - dt * 4);
        ef.lunge = Math.max(0, ef.lunge - dt * 3);
        if (ef.appear) { ef.alpha = Math.min(1, ef.alpha + dt * 3); if (ef.alpha >= 1) ef.appear = 0; }
        if (ef.dying) { ef.alpha = Math.max(0, ef.alpha - dt * 1.4); }
        const es = Math.min(E.w / 140, (E.h - 90) / 112) * (def.boss ? 1.05 : def.elite ? 0.96 : 0.86);
        const ex = E.x + E.w / 2, ey = E.y + E.h * 0.46;
        ctx.save();
        ctx.globalAlpha = ef.alpha;
        const bob = Math.sin(t * 1.6) * 3;
        const lunge = ef.lunge > 0 ? Math.sin((1 - ef.lunge) * Math.PI) : 0;
        drawEnemy(ctx, def, ex, ey + bob, es, t, { flash: ef.flash, shake: this.reduced ? 0 : ef.shake, lunge });
        ctx.restore();
        // name, HP bar, block and status
        const barW = Math.min(E.w - 30, 260), bx = ex - barW / 2, by = E.y + E.h - 26;
        ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        fitText(ctx, def.name.toUpperCase(), ex, by - 4, E.w - 16, 15, FONT_HEAD);
        this._hpBar(bx, by, barW, 16, S.ehp ?? 0, S.emax ?? 1, '#d23b2a', S.eblock);
        const pips = [];
        if (S.estr > 0) pips.push([`STR +${S.estr}`, '#ff8a7a']);
        if (S.estr < 0) pips.push([`STR ${S.estr}`, '#7fb4ff']);
        if (S.eweak > 0) pips.push([`DAZED ${S.eweak}`, '#e8d8ff']);
        ctx.font = `bold 12px ${FONT_BODY}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        pips.forEach(([txt, c], i) => { ctx.fillStyle = c; ctx.fillText(txt, ex + (i - (pips.length - 1) / 2) * 90, by + 19); });
        // the intent bubble
        if (S.intent && !B.done) {
            const it = S.intent;
            const ix = Math.max(E.x + 6, Math.min(E.x + E.w - 72, ex + 38 * es)), iy = Math.max(E.y + 2, ey - 66 * es - 20);
            this._intent(ix, iy, it, t);
            this.hits.push({ key: 'intent', x: ix - 4, y: iy - 4, w: 74, h: 50, info: intentText(it) });
        }
        if (V.key && !this.hits.some((h) => h.key === 'enemy')) this.hits.unshift({ key: 'enemy', x: E.x, y: E.y, w: E.w, h: E.h, info: `${def.name}. ${intentText(S.intent)}.` });

        // --- the table
        const beam = V.beam;
        const fitsBeam = (c) => {
            if (!beam) return true;
            if (S.wild) return true;
            if (beam.src !== 'tab' && CARDS[beam.k]?.static) return false;
            if (beam.src !== 'tab' && CARDS[beam.k]?.wild) return true;
            return rankFits(beam.r, c.r);
        };
        const cards = [...V.tab.values()].sort((a, b) => a.row - b.row);
        const coveredVis = (c) => cards.some((o) => o.row === c.row + 1 && Math.abs(o.col - c.col) <= 1);
        for (const c of cards) {
            const p = this.cardPos(c);
            if (c.x == null) { c.x = p.x; c.y = p.y; }
            if (c.delay > 0) c.delay -= dt * this.speed;
            else { const k = 1 - Math.pow(0.0005, dt * this.speed); c.x = lerp(c.x, p.x, k); c.y = lerp(c.y, p.y, k); }
            const free = c.up && !coveredVis(c);
            const ok = canAct && free && !c.frozen && fitsBeam(c);
            const targeting = this.targeting >= 0 && free;
            const key = `card:${c.id}`;
            const focus = this.focus === key || this.hover?.key === key;
            const flip = c.flipT > 0 ? (c.flipT -= dt * 8 * this.speed, Math.abs(Math.cos((1 - Math.max(0, c.flipT)) * Math.PI))) : 1;
            ctx.save(); ctx.translate(c.x, c.y); ctx.scale(Math.max(0.05, flip), 1);
            drawCard(ctx, c, 0, 0, L.cardW, L.cardH, {
                down: !c.up, xray: !c.up && S.xray, frozen: c.frozen,
                glow: targeting ? '#ff7ab2' : ok ? '#ffcf3a' : null,
                dim: canAct && free && !ok && !targeting, focus: focus && free,
            });
            ctx.restore();
            if (free) {
                const label = `${['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'][c.r]} of ${SUITS[c.s].name}s`;
                this.hits.push({ key, kind: 'card', id: c.id, x: c.x - L.cardW / 2, y: c.y - L.cardH / 2, w: L.cardW, h: L.cardH, focus: canAct, ok: ok || targeting, info: c.frozen ? `${label}: frozen until the creature's next move.` : `${label}. ${suitText(c.s)}` });
            }
        }

        // --- the bar
        const bar = L.bar;
        const g = ctx.createLinearGradient(0, bar.y, 0, bar.y + bar.h);
        g.addColorStop(0, 'rgba(20,12,36,0.0)'); g.addColorStop(0.2, 'rgba(20,12,36,0.82)'); g.addColorStop(1, 'rgba(12,6,24,0.95)');
        ctx.fillStyle = g; ctx.fillRect(0, bar.y - 20, this.w, bar.h + 20);
        // player strip: HP, block, charge
        const st = L.strip;
        const hpW = L.portrait ? st.w * 0.5 : st.w - 10;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#9fe8e0'; ctx.font = `12px ${FONT_HEAD}`;
        ctx.fillText('PROFESSOR', st.x, st.y + 12);
        this._hpBar(st.x, st.y + 15, hpW, 16, S.hp, S.maxHp, '#2fbf6a', S.block);
        const cx0 = L.portrait ? st.x + hpW + 14 : st.x, cy0 = L.portrait ? st.y + 2 : st.y + 46;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#5fd88f'; ctx.font = `12px ${FONT_HEAD}`;
        ctx.fillText(`CHARGE ${S.charge ?? 0}`, cx0, cy0);
        const pipW = Math.min(14, ((L.portrait ? st.x + st.w - cx0 : st.w) - 4) / CHARGE_MAX - 2);
        for (let i = 0; i < CHARGE_MAX; i++) {
            ctx.beginPath(); ctx.arc(cx0 + pipW / 2 + i * (pipW + 2), cy0 + 22, pipW / 2 - 0.5, 0, Math.PI * 2);
            ctx.fillStyle = i < (S.charge ?? 0) ? '#5fd88f' : 'rgba(255,255,255,0.12)'; ctx.fill();
        }
        if (!L.portrait) {
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#fff4b0'; ctx.font = `13px ${FONT_HEAD}`;
            ctx.fillText(`CHAIN ${S.chain ?? 0}`, st.x, st.y + 84);
            ctx.fillStyle = CREAM; ctx.font = `12px ${FONT_BODY}`;
            ctx.fillText(`Turn ${B.turn}`, st.x + 120, st.y + 86);
        }
        // stock, beam, draw / end
        const R = this._beamRects();
        const stockN = (S.stock ?? 0);
        for (let i = Math.min(3, stockN) - 1; i >= 0; i--) drawCard(ctx, {}, R.stock.x + R.stock.w / 2 + i * 2, R.stock.y + R.stock.h / 2 - i * 2, R.stock.w, R.stock.h, { down: true });
        if (!stockN) { rrect(ctx, R.stock.x, R.stock.y, R.stock.w, R.stock.h, 8); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = CREAM; ctx.font = `bold 12px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${stockN} left`, R.stock.x + R.stock.w / 2, R.stock.y + R.stock.h + 2);
        // the beam card, flying in when it changes
        const bp = { x: R.beam.x + R.beam.w / 2, y: R.beam.y + R.beam.h / 2 };
        const glowBeam = S.wild ? '#ff7ab2' : null;
        if (V.beamAnim) {
            V.beamAnim.t += (dt * this.speed) / V.beamAnim.dur;
            if (V.prevBeam) drawCard(ctx, V.prevBeam, bp.x, bp.y, R.beam.w, R.beam.h, {});
            const k = ease(V.beamAnim.t);
            const sc = lerp(V.beamAnim.x < bp.x - 5 && V.beamAnim.y > bp.y - 5 ? 1 : L.cardW / R.beam.w, 1, k);
            drawCard(ctx, V.beam || {}, lerp(V.beamAnim.x, bp.x, k), lerp(V.beamAnim.y, bp.y, k) - Math.sin(k * Math.PI) * 30, R.beam.w, R.beam.h, { scale: sc, glow: glowBeam });
            if (V.beamAnim.t >= 1) V.beamAnim = null;
        } else if (V.beam) drawCard(ctx, V.beam, bp.x, bp.y, R.beam.w, R.beam.h, { glow: glowBeam });
        // a halo under the beam, like a ray-gun emitter
        ctx.fillStyle = '#9fe8e0'; ctx.font = `11px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('THE BEAM', bp.x, R.beam.y + R.beam.h + 2);
        const beamInfo = V.beam ? (V.beam.src === 'tab' ? `The beam: ${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][V.beam.r]}. Play a card one higher or lower.` : `The beam: ${cardName(V.beam)}. ${cardText(V.beam)}`) : '';
        this.hits.push({ key: 'beam', x: R.beam.x, y: R.beam.y, w: R.beam.w, h: R.beam.h, info: beamInfo });
        const draws = S.draws ?? 0;
        const canDraw = draws > 0 && (stockN + (S.disc ?? 0)) > 0;
        this.hits.push({ key: 'draw', kind: 'draw', x: R.stock.x, y: R.stock.y, w: R.stock.w, h: R.stock.h, focus: canAct, ok: canAct && canDraw, info: `Stock: ${stockN} cards, ${S.disc ?? 0} in the discard. ${canDraw ? `Draw the next one onto the beam (${draws} draw${draws === 1 ? '' : 's'} left).` : 'No draws left this turn.'}` });
        // the draw / end turn button
        const bt = R.btn;
        const label = canDraw ? 'DRAW' : 'END TURN';
        const pressFx = canAct ? (canDraw ? '#9fe8e0' : '#ffcf3a') : '#555';
        rrect(ctx, bt.x, bt.y + 3, bt.w, bt.h, 12); ctx.fillStyle = INK; ctx.fill();
        rrect(ctx, bt.x, bt.y, bt.w, bt.h, 12); ctx.fillStyle = pressFx; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        if (this.focus === 'btn' || this.hover?.key === 'btn') { rrect(ctx, bt.x - 4, bt.y - 4, bt.w + 8, bt.h + 8, 14); ctx.strokeStyle = '#7ff5ff'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fitText(ctx, label, bt.x + bt.w / 2, bt.y + bt.h / 2 - (canDraw ? 7 : 0), bt.w - 10, 15, FONT_HEAD);
        if (canDraw) {
            for (let i = 0; i < DRAWS_PER_TURN + 1; i++) {
                if (i >= Math.max(draws, DRAWS_PER_TURN)) break;
                ctx.beginPath(); ctx.arc(bt.x + bt.w / 2 + (i - (Math.max(draws, DRAWS_PER_TURN) - 1) / 2) * 14, bt.y + bt.h - 14, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = i < draws ? INK : 'rgba(27,18,38,0.25)'; ctx.fill();
            }
        }
        this.hits.push({ key: 'btn', kind: canDraw ? 'draw' : 'end', x: bt.x, y: bt.y, w: bt.w, h: bt.h, focus: canAct, ok: canAct, info: canDraw ? `Draw a card onto the beam. ${draws} left this turn.` : 'End your turn: the creature moves.' });
        if (L.portrait) {
            const bx0 = R.stock.x - 58, by0 = R.stock.y + R.stock.h / 2;
            ctx.fillStyle = '#fff4b0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `10px ${FONT_HEAD}`; ctx.fillText('CHAIN', bx0 + 25, by0 - 16);
            ctx.font = `26px ${FONT_HEAD}`; ctx.fillText(String(S.chain ?? 0), bx0 + 25, by0 + 8);
            ctx.font = `bold 10px ${FONT_BODY}`; ctx.fillStyle = CREAM; ctx.fillText(`TURN ${B.turn}`, bx0 + 25, by0 + 32);
        }
        // gadgets
        const GR = L.gadRow;
        const n = 3;
        const gw = L.portrait ? (GR.w - (n - 1) * 8) / n : GR.w / n - 8;
        const gh = L.portrait ? GR.h : Math.min(GR.h, 92);
        for (let i = 0; i < n; i++) {
            const k = G.gadgets[i];
            const gx = GR.x + i * (gw + 8), gy = L.portrait ? GR.y : GR.y + (GR.h - gh) / 2;
            rrect(ctx, gx, gy, gw, gh, 10);
            if (!k) { ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); continue; }
            const gd = GADGETS[k];
            const can = canAct && (S.charge ?? 0) >= gd.cost;
            const sel = this.targeting === i;
            ctx.fillStyle = sel ? '#ff7ab2' : can ? '#2b6c6c' : 'rgba(255,255,255,0.07)'; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = can ? '#9fe8e0' : 'rgba(255,255,255,0.18)'; ctx.stroke();
            const gkey = `gadget:${i}`;
            if (this.focus === gkey || this.hover?.key === gkey) { rrect(ctx, gx - 3, gy - 3, gw + 6, gh + 6, 12); ctx.strokeStyle = '#7ff5ff'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); }
            ctx.fillStyle = can ? CREAM : 'rgba(246,236,210,0.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            fitText(ctx, gd.name.toUpperCase(), gx + 8, gy + 6, gw - 40, 12, FONT_HEAD);
            ctx.fillStyle = can ? '#5fd88f' : 'rgba(95,216,143,0.5)'; ctx.textAlign = 'right'; ctx.font = `bold 13px ${FONT_BODY}`;
            ctx.fillText(`${gd.cost}⚛`, gx + gw - 6, gy + 5);
            if (gh > 60) {
                ctx.fillStyle = 'rgba(246,236,210,0.8)'; ctx.textAlign = 'left'; ctx.font = `11px ${FONT_BODY}`;
                this._wrap(gd.text, gx + 8, gy + 26, gw - 14, 13, Math.floor((gh - 30) / 13));
            } else {
                ctx.fillStyle = 'rgba(246,236,210,0.7)'; ctx.textAlign = 'left';
                fitText(ctx, gd.text, gx + 8, gy + 26, gw - 14, 10, FONT_BODY);
            }
            this.hits.push({ key: gkey, kind: 'gadget', i, x: gx, y: gy, w: gw, h: gh, focus: canAct, ok: can, info: gadgetText(k) });
        }
        // the info line: what's under the cursor
        const info = this.targeting >= 0 ? 'Pick a face-up card to vaporize. Tap anything else to cancel.' : (this.hover || this.focusHit())?.info;
        if (info && canAct) {
            const iy = L.portrait ? L.table.y + L.table.h - 4 : bar.y - 8;
            ctx.font = `12px ${FONT_BODY}`;
            const tw = Math.min(this.w - 20, ctx.measureText(info).width + 20);
            rrect(ctx, this.w / 2 - tw / 2, iy - 20, tw, 22, 6); ctx.fillStyle = 'rgba(12,6,24,0.85)'; ctx.fill();
            ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            fitText(ctx, info, this.w / 2, iy - 9, tw - 12, 12, FONT_BODY);
        }
        if (this.zap) {
            this.zap.t -= dt;
            if (this.zap.t > 0) {
                ctx.strokeStyle = `rgba(255,120,100,${this.zap.t * 3})`; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(this.zap.ax, this.zap.ay);
                for (let i = 1; i <= 8; i++) ctx.lineTo(lerp(this.zap.ax, this.zap.bx, i / 8) + (Math.random() - 0.5) * 18, lerp(this.zap.ay, this.zap.by, i / 8) + (Math.random() - 0.5) * 18);
                ctx.stroke();
            } else this.zap = null;
        }
    }

    _hpBar(x, y, w, h, v, max, color, block) {
        const ctx = this.ctx;
        rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
        const f = Math.max(0, Math.min(1, v / Math.max(1, max)));
        if (f > 0) { rrect(ctx, x + 2, y + 2, (w - 4) * f, h - 4, (h - 4) / 2); ctx.fillStyle = color; ctx.fill(); }
        rrect(ctx, x, y, w, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = block > 0 ? '#7fb4ff' : INK; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(h * 0.75)}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${v}/${max}`, x + w / 2, y + h / 2 + 1);
        if (block > 0) {
            ctx.save(); ctx.translate(x - 4, y + h / 2);
            suitIcon(ctx, 2, 0, 0, h * 1.5, '#2b6cc9');
            ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(h * 0.7)}px ${FONT_BODY}`; ctx.textAlign = 'center';
            ctx.fillText(String(block), 0, 0);
            ctx.restore();
        }
    }

    _intent(x, y, it, t) {
        const ctx = this.ctx;
        const atk = it.dmg != null && it.t !== 'block';
        const col = it.t === 'stun' ? '#9fd8ff' : atk ? '#d23b2a' : it.t === 'block' ? '#2b6cc9' : it.t === 'buff' ? '#c98a1f' : '#6a4a9a';
        const bob = Math.sin(t * 3) * 2;
        rrect(ctx, x, y + bob, 66, 40, 10); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let main = '', sub = '';
        switch (it.t) {
            case 'atk': main = it.hits > 1 ? `${it.dmg}×${it.hits}` : `${it.dmg}`; sub = 'ATTACK'; break;
            case 'atkblock': main = `${it.dmg}`; sub = `+${it.b} SHIELD`; break;
            case 'block': main = `${it.n}`; sub = 'SHIELD'; break;
            case 'buff': main = `+${it.str}`; sub = 'GROWS'; break;
            case 'jam': main = it.dmg ? `${it.dmg}` : '!'; sub = 'JAM'; break;
            case 'freeze': main = it.dmg ? `${it.dmg}` : '❄'; sub = `FREEZE ${it.count}`; break;
            case 'drain': main = `${it.dmg}`; sub = 'DRAIN'; break;
            case 'wind': main = '...'; sub = 'WIND UP'; break;
            case 'stun': main = '❄'; sub = 'FROZEN'; break;
        }
        ctx.font = `18px ${FONT_HEAD}`; ctx.fillText(main, x + 33, y + 15 + bob);
        ctx.font = `bold 9px ${FONT_BODY}`; ctx.fillText(sub, x + 33, y + 31 + bob);
    }

    _wrap(text, x, y, maxW, lh, maxLines) {
        const ctx = this.ctx;
        const words = text.split(' ');
        let line = '', n = 0;
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, y + n * lh); n++; line = w;
                if (n >= maxLines) return;
            } else line = test;
        }
        if (line && n < maxLines) ctx.fillText(line, x, y + n * lh);
    }

    // ------------------------------------------------------------------ the map
    _map(G, t, behind) {
        const ctx = this.ctx, w = this.w, h = this.h;
        const reel = REELS[G.act];
        const M = G.map;
        const R = Math.max(...M.nodes.map((n) => n.row));
        // a short landscape screen (a phone on its side) runs the road left to right
        const horiz = h < 520 && w > h * 1.3;
        let pos, r;
        if (horiz) {
            const left = 36, right = w - 46, top = 92, bottom = h - 30;
            ctx.fillStyle = 'rgba(10,4,24,0.45)'; ctx.fillRect(left - 24, top - 16, right - left + 60, bottom - top + 28);
            ctx.fillStyle = '#ffcf3a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            fitText(ctx, `REEL ${G.act + 1}: ${reel.title}`, 14, 58, Math.max(160, w - 420), 15, FONT_HEAD);
            ctx.fillStyle = '#b7a9cf'; ctx.font = `11px ${FONT_BODY}`;
            ctx.fillText(`${reel.place}, ${reel.year}`, 14, 76);
            pos = (n) => ({ x: lerp(left + 10, right - 10, n.row / R), y: top + ((n.lane + 0.5) / 4) * (bottom - top) + (n.type === 'boss' ? 0 : Math.sin(n.id * 12.9) * 6) });
            r = Math.max(19, Math.min(24, (bottom - top) / 4 / 2.4));
        } else {
            const top = 128, bottom = h - 34;
            const cw = Math.min(w - 40, 520);
            const x0 = (w - cw) / 2;
            ctx.fillStyle = 'rgba(10,4,24,0.45)'; ctx.fillRect(x0 - 12, top - 48, cw + 24, bottom - top + 58);
            ctx.fillStyle = '#ffcf3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            fitText(ctx, `REEL ${G.act + 1}: ${reel.title}`, w / 2, top - 30, cw, 17, FONT_HEAD);
            ctx.fillStyle = '#b7a9cf'; ctx.font = `12px ${FONT_BODY}`;
            ctx.fillText(`${reel.place}, ${reel.year}`, w / 2, top - 12);
            pos = (n) => ({ x: x0 + ((n.lane + 0.5) / 4) * cw + (n.type === 'boss' ? 0 : Math.sin(n.id * 12.9) * cw * 0.03), y: lerp(bottom - 24, top + 30, n.row / R) });
            r = Math.max(19, Math.min(26, (bottom - top) / (R + 1) / 2.2));
        }
        const avail = new Set(behind ? [] : choices(G));
        const visited = new Set(G.trail || []);
        // paths
        for (const n of M.nodes) {
            const a = pos(n);
            for (const id of n.next) {
                const b = pos(M.nodes[id]);
                const lit = (G.pos === n.id && avail.has(id));
                ctx.strokeStyle = lit ? '#ffcf3a' : 'rgba(246,236,210,0.28)'; ctx.lineWidth = lit ? 3 : 2;
                ctx.setLineDash(lit ? [] : [5, 6]);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
        }
        ctx.setLineDash([]);
        for (const n of M.nodes) {
            const p = pos(n);
            const isAvail = avail.has(n.id);
            const done = n.row <= (G.pos != null ? M.nodes[G.pos].row : -1) && n.id !== G.pos;
            const rr = (n.type === 'boss' ? r * 1.6 : r) * (isAvail ? 1 + Math.sin(t * 5) * 0.06 : 1);
            ctx.save();
            ctx.globalAlpha = done && !visited.has(n.id) ? 0.35 : 1;
            if (isAvail) { ctx.shadowColor = '#ffcf3a'; ctx.shadowBlur = 16; }
            nodeIcon(ctx, n.type, p.x, p.y, rr, t);
            ctx.restore();
            if (visited.has(n.id) || n.id === G.pos) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 4, 0, Math.PI * 2); ctx.strokeStyle = '#7ff5a0'; ctx.lineWidth = 2.5; ctx.stroke(); }
            const key = `node:${n.id}`;
            if (isAvail) {
                if (this.focus === key || this.hover?.key === key) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 8, 0, Math.PI * 2); ctx.strokeStyle = '#7ff5ff'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); }
                const label = { fight: 'A creature', elite: 'An elite creature (☢): harder, drops a souvenir', boss: `The boss: ${ENEMIES[reel.boss].name}`, rest: 'The roadside diner: rest or tinker', shop: 'Army Surplus: buy cards, gadgets, souvenirs', event: 'A strange broadcast', treasure: 'Treasure: a souvenir' }[n.type];
                const hs = Math.max(rr * 2, 48);
                this.hits.push({ key, kind: 'node', id: n.id, x: p.x - hs / 2, y: p.y - hs / 2, w: hs, h: hs, focus: true, ok: true, info: label });
            }
        }
        if (G.pos != null) {
            const p = pos(M.nodes[G.pos]);
            ctx.save(); ctx.translate(p.x + (horiz ? 0 : r + 10), p.y - (horiz ? r + 12 : 4)); ctx.rotate(-0.5 + Math.sin(t * 2) * 0.1);
            suitIcon(ctx, 1, 0, 0, 22, '#e2861b');
            ctx.restore();
        }
        if (!behind) {
            const info = (this.hover || this.focusHit())?.info || (G.pos == null ? 'Pick where to start: tap a glowing stop.' : 'Pick the next stop on the road.');
            ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            fitText(ctx, info, w / 2, h - 14, w - 24, 13, FONT_BODY);
        }
    }

    // ------------------------------------------------------------------ effects and film
    _effects(dt) {
        const ctx = this.ctx;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) { this.parts.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
            ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
            ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
        }
        ctx.globalAlpha = 1;
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.t += dt;
            if (f.t >= f.life) { this.floaters.splice(i, 1); continue; }
            const k = f.t / f.life;
            ctx.globalAlpha = 1 - Math.pow(k, 3);
            ctx.font = `${f.size}px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y - k * 40);
            ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 40);
        }
        ctx.globalAlpha = 1;
        if (this.banner) {
            const b = this.banner;
            b.t -= dt;
            if (b.t <= 0) this.banner = null;
            else {
                const a = Math.min(1, b.t * 3);
                const y = this.L ? this.L.table.y + this.L.table.h * 0.45 : this.h * 0.45;
                ctx.globalAlpha = a;
                const size = Math.min(52, this.w / (b.text.length * 0.75));
                ctx.font = `${size}px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.save(); ctx.translate(this.w / 2, y); ctx.rotate(-0.06);
                ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeText(b.text, 4, 4); ctx.strokeText(b.text, 0, 0);
                ctx.fillStyle = '#d23b2a'; ctx.fillText(b.text, 3, 3);
                ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    _makeGrain() {
        const c = document.createElement('canvas');
        c.width = c.height = 160;
        const x = c.getContext('2d');
        const img = x.createImageData(160, 160);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() * 255;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = Math.random() < 0.5 ? 22 : 0;
        }
        x.putImageData(img, 0, 0);
        return c;
    }

    _filmOverlay(t) {
        if (this.film === 'off') return;
        const ctx = this.ctx;
        const calm = this.film === 'calm' || this.reduced;
        const pat = ctx.createPattern(this.grain, 'repeat');
        ctx.save();
        if (!calm) ctx.translate(Math.floor(Math.random() * 160), Math.floor(Math.random() * 160));
        ctx.globalAlpha = calm ? 0.5 : 0.9;
        ctx.fillStyle = pat;
        ctx.fillRect(-160, -160, this.w + 320, this.h + 320);
        ctx.restore();
        if (!calm) {
            // a scratch now and then, and a slow, gentle exposure wobble (well under 2 Hz)
            if (Math.random() < 0.06) {
                ctx.fillStyle = 'rgba(255,255,240,0.14)'; ctx.fillRect(Math.random() * this.w, 0, 1.2, this.h);
            }
            const f = 0.03 * (Math.sin(t * 1.1) * 0.5 + 0.5);
            ctx.fillStyle = `rgba(255,240,200,${f})`; ctx.fillRect(0, 0, this.w, this.h);
        }
    }
}
