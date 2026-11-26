// The shop, side on, like a doll's house with the front wall taken away. Canvas 2D. Reads G and answers events;
// never changes G. The room is laid out in "slot" units: the door on the left, G.shop.width slots of wall and floor,
// the counter on the right. When the room is wider than the screen it pans (drag, or it follows the action).

import { FURNITURE, FOLK, KINDS, VIRTUES } from '../sim/data.js';
import { shelfBooks, section, cell } from '../sim/game.js';

const DOOR_W = 1.4, COUNTER_W = 2.0;
// where the books stand inside the bookshelf sprite (fractions of its size, measured from art/furn-shelf.webp)
const SHELF = { x0: 0.16, x1: 0.84, rows: [0.336, 0.514, 0.69, 0.891], rowH: 0.15 };
// furniture size in slot units (height); width follows the sprite
const SIZE = { shelf: 1.45, table: 0.62, armchair: 0.82, lamp: 1.3, fern: 0.72, cat: 0.42, painting: 0.5, ivy: 0.95, counter: 0.78 };
const FOLK_H = { child: 0.62 };
// the glass of the backdrop's three windows (fractions of the painting), measured from art/bg-shop.webp
const WINDOWS = [[0.141, 0.246], [0.449, 0.551], [0.755, 0.859]];
const GLASS = { top: 0.22, sill: 0.643 };
// who walks past: the townsfolk sprites themselves, as dark silhouettes ('pair' is two of them side by side)
const PASSERS = [...Object.keys(FOLK), 'pair'];

const s3 = (v) => v.s;
function img(src) { const i = new Image(); i.src = src; return i; }
const ok = (i) => i && i.complete && i.naturalWidth > 0;

export class ShopView {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cam = 0;              // pan, in px
        this.follow = null;        // world x to ease towards
        this.fx = [];
        this.sel = null;           // the selected column (arranging)
        this.arranging = false;
        this.time = 0;
        this.walkers = [];         // townsfolk passing the windows while the shop is open (view only)
        this.art = {
            bg: img('art/bg-shop.webp'),
            tam: img('art/cast-tam.webp'),
            vellum: img('art/cast-vellum.webp'),
            counter: img('art/furn-counter.webp'),
            furn: Object.fromEntries(Object.keys(FURNITURE).map((k) => [k, img(`art/furn-${k}.webp`)])),
            folk: Object.fromEntries(Object.keys(FOLK).map((k) => [k, img(`art/folk-${k}.webp`)])),
        };
        this.resize();
        this._bindPan();
    }

    resize() {
        const r = this.canvas.parentElement.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
    }

    /** Scale (px per slot unit) and the world width, for a shop of `width` slots. */
    layout(width) {
        const worldW = DOOR_W + width + COUNTER_W;
        // the room shows about three furniture heights; a wide shop pans instead of shrinking
        // (on a tall phone the zoom is capped so about three spots fit across; a beamed ceiling fills the top)
        const s = Math.min(Math.max(this.h / 3.3, this.w / worldW), this.w / 3.0);
        this.s = s;
        this.worldPx = worldW * s;
        this.floorY = this.h * 0.95;
        this.wallBase = this.floorY - s * 0.1;
        this.maxCam = Math.max(0, this.worldPx - this.w);
        this.cam = Math.max(0, Math.min(this.maxCam, this.cam));
        this.ox = this.worldPx < this.w ? (this.w - this.worldPx) / 2 : -this.cam;
        return s;
    }
    /** Screen x of a world x (slot units; the shop's slot 0 starts at 0, the door is at negative x). */
    sx(x) { return this.ox + (DOOR_W + x) * this.s; }

    _bindPan() {
        let d = null;
        this.canvas.addEventListener('pointerdown', (e) => { d = { x: e.clientX, cam: this.cam, moved: false }; });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 8) d.moved = true;
            if (d.moved && this.maxCam > 0) { this.cam = Math.max(0, Math.min(this.maxCam, d.cam - dx)); this.follow = null; this.userPanned = 3; }
        });
        const end = () => { this.lastDragMoved = d?.moved; d = null; };
        this.canvas.addEventListener('pointerup', end);
        this.canvas.addEventListener('pointercancel', end);
        this.canvas.addEventListener('pointerleave', () => { d = null; });
    }

    /** What is under a client point: a waiting customer, or a column of the shop. */
    pick(G, clientX, clientY) {
        if (this.lastDragMoved) return null;
        const r = this.canvas.getBoundingClientRect();
        const x = clientX - r.left, y = clientY - r.top;
        for (const cu of G.customers) {
            if (cu.state !== 'ask') continue;
            const cx = this.sx(cu.x), h = (FOLK_H[cu.folk] || 0.95) * this.s;
            if (Math.abs(x - cx) < this.s * 0.35 && y > this.floorY - h - this.s * 0.5 && y < this.floorY) return { type: 'cust', id: cu.id };
        }
        const wx = (x - this.ox) / this.s - DOOR_W;
        const slot = Math.floor(wx);
        if (slot >= 0 && slot < G.shop.width) return { type: 'slot', slot, row: y < this.floorY - this.s * 0.75 ? 'wall' : 'floor' };
        if (wx >= G.shop.width) return { type: 'counter' };
        return null;
    }

    /** Center the view on a world x (eased). */
    lookAt(x) { if (this.maxCam > 0 && !(this.userPanned > 0)) this.follow = x; }
    centerOn(x) { this.layout(this.shopW || 6); this.cam = Math.max(0, Math.min(this.maxCam, (DOOR_W + x) * this.s - this.w / 2)); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sold' || e.type === 'served' || e.type === 'fulfilled') {
                this.fx.push({ kind: 'text', text: `+${e.price} 🪙`, x: G.shop.width + 0.3, y: 1.2, t: 0, life: 1.6, color: '#ffd76a' });
                for (let i = 0; i < 8; i++) this.fx.push({ kind: 'spark', x: G.shop.width + 0.3 + (Math.random() - 0.5) * 0.6, y: 1 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random(), t: 0, life: 0.9, color: '#ffd76a' });
            } else if (e.type === 'inspired' || e.type === 'chapter') {
                for (let i = 0; i < 40; i++) this.fx.push({ kind: 'spark', x: Math.random() * G.shop.width, y: Math.random() * 2, vx: (Math.random() - 0.5) * 0.4, vy: 0.3 + Math.random() * 0.6, t: 0, life: 1.8 + Math.random(), color: e.type === 'inspired' ? VIRTUES[(e.id && G && G.inspired) ? 'charm' : 'wonder'].color : '#ffe9a8' });
            } else if (e.type === 'ask') {
                const cu = G.customers.find((c) => c.id === e.cust);
                if (cu) this.lookAt(cu.x);
            } else if (e.type === 'placed' || e.type === 'shelved') {
                const x = e.slot != null ? e.slot + 0.5 : null;
                if (x != null) for (let i = 0; i < 10; i++) this.fx.push({ kind: 'spark', x: x + (Math.random() - 0.5) * 0.7, y: 0.3 + Math.random(), vx: 0, vy: 0.4, t: 0, life: 0.7, color: '#fff3c4' });
            }
        }
    }

    // ------------------------------------------------------------------ drawing
    frame(G, dt) {
        this.time += dt;
        this._passers(G, dt);
        this.resize();
        this.shopW = G.shop.width;
        const { ctx } = this;
        const s = this.layout(G.shop.width);
        if (this.follow != null && this.maxCam > 0) {
            const want = Math.max(0, Math.min(this.maxCam, (DOOR_W + this.follow) * s - this.w / 2));
            this.cam += (want - this.cam) * Math.min(1, dt * 3);
            if (Math.abs(want - this.cam) < 1) this.follow = null;
            this.ox = -this.cam;
        }
        if (this.userPanned > 0) this.userPanned -= dt;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.imageSmoothingQuality = 'high';
        this._backdrop(G);
        this._door(G);
        // wall row, then the floor row in front of it
        for (let i = 0; i < G.shop.width; i++) this._item(G, 'wall', i);
        for (let i = 0; i < G.shop.width; i++) this._item(G, 'floor', i);
        this._counter(G);
        // customers, back to front by their state (browsing ones nearest the shelves)
        const cs = G.customers.slice().sort((a, b) => (a.state === 'browse') - (b.state === 'browse'));
        for (const cu of cs) this._customer(G, cu);
        if (this.arranging) this._handles(G);
        this._fx(dt);
        this._light(G);
    }

    _backdrop(G) {
        const { ctx, w, h } = this;
        const bg = this.art.bg;
        ctx.fillStyle = '#2a1d16';
        ctx.fillRect(0, 0, w, h);
        // the backdrop scales with the furniture: its floor line (86% down) sits on the wall base
        const ih = s3(this) * 3.6;
        const top = this.wallBase - ih * 0.86;
        if (top > 0) {
            // above the room: the dark beams of the ceiling and the floor above
            const g = ctx.createLinearGradient(0, 0, 0, top);
            g.addColorStop(0, '#1e140d'); g.addColorStop(1, '#3a2618');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, top + 2);
            ctx.fillStyle = '#2a1a10';
            for (let x = this.ox % (this.s * 1.6) - this.s * 1.6; x < w; x += this.s * 1.6) ctx.fillRect(x, 0, this.s * 0.22, top);
            ctx.fillStyle = '#4a2f1c'; ctx.fillRect(0, top - 6, w, 8);
        }
        if (ok(bg)) {
            const iw = ih * bg.naturalWidth / bg.naturalHeight;
            const x0 = this.sx(-DOOR_W) - iw * 0.08;
            const x1 = this.sx(G.shop.width + COUNTER_W);
            const tiles = [];
            for (let x = x0 - iw * Math.ceil(Math.max(0, x0) / iw); x < Math.max(w, x1); x += iw) { ctx.drawImage(bg, x, top, iw, ih); tiles.push(x); }
            this._street(tiles, iw, ih, top);
            // the floor in front of the backdrop
            const fy = top + ih * 0.985;
            const g = ctx.createLinearGradient(0, fy, 0, h);
            g.addColorStop(0, '#8a5a32'); g.addColorStop(1, '#5a3820');
            ctx.fillStyle = g;
            ctx.fillRect(0, fy, w, h - fy);
        }
    }

    /** Townsfolk walking by outside while the shop is open: more of them the busier the day. Made up by the view;
     *  the sim never knows. Positions are in slot units so they stay put when the shop pans. */
    _passers(G, dt) {
        const W = G.shop.width;
        const lo = -DOOR_W - 1.5, hi = W + COUNTER_W + 1.5;
        if (G.phase === 'open' && G.clock < 79) {
            const want = Math.min(9, 3 + Math.floor((G.today?.visitors || 4) / 2));
            if (this.walkers.length < want && Math.random() < dt * 0.9) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                const near = Math.random() < 0.45;
                this.walkers.push({
                    x: dir > 0 ? lo : hi, dir, speed: (near ? 0.55 : 0.38) + Math.random() * 0.35,
                    near, kind: PASSERS[Math.floor(Math.random() * PASSERS.length)], other: Object.keys(FOLK)[Math.floor(Math.random() * 7)], phase: Math.random() * 6, pause: 0, paused: false,
                });
            }
        }
        for (let i = this.walkers.length - 1; i >= 0; i--) {
            const p = this.walkers[i];
            if (p.pause > 0) { p.pause -= dt; continue; }
            p.x += p.dir * p.speed * dt;
            // now and then someone stops to look in at the books
            if (!p.paused && Math.random() < dt * 0.08) { p.paused = true; p.pause = 1.2 + Math.random() * 1.5; }
            if (p.x < lo - 0.5 || p.x > hi + 0.5) this.walkers.splice(i, 1);
        }
    }

    /** A townsfolk sprite as a dark silhouette: the same outline, filled with one colour ('source-in'). Made once per
     *  sprite when it has loaded; the canvas equivalent of a CSS brightness filter, and it works on every browser. */
    _silhouette(kind) {
        this.sil ||= {};
        if (this.sil[kind]) return this.sil[kind];
        const im = this.art.folk[kind];
        if (!ok(im)) return null;
        const h = 180, w = Math.round(h * im.naturalWidth / im.naturalHeight);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0, w, h);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = '#3c2836';
        x.fillRect(0, 0, w, h);
        return (this.sil[kind] = c);
    }

    /** Draw the passers-by, masked by the windows' glass so they only show through it. Multiply darkens the glass
     *  where someone passes, so the window bars stay in front of them; the near ones are darker than the far ones. */
    _street(tiles, iw, ih, top) {
        if (!this.walkers.length) return;
        const { ctx } = this;
        ctx.save();
        ctx.beginPath();
        for (const x of tiles) for (const [a, b] of WINDOWS) ctx.rect(x + a * iw, top + GLASS.top * ih, (b - a) * iw, (GLASS.sill - GLASS.top) * ih);
        ctx.clip();
        ctx.globalCompositeOperation = 'multiply';
        const ground = top + ih * 0.69;             // the street is below the sill: feet stay hidden
        for (const p of this.walkers) {
            const k = (p.near ? 0.27 : 0.21) * ih;  // a grown-up's height in px
            const x = this.sx(p.x);
            const step = p.pause > 0 ? 0 : Math.sin(this.time * 7 * p.speed + p.phase);
            ctx.globalAlpha = p.near ? 0.72 : 0.45;
            const figure = (kind, fx) => {
                const c = this._silhouette(kind);
                if (!c) return;
                const fh = k * (FOLK_H[kind] || 0.95) / 0.95, fw = fh * c.width / c.height;
                ctx.save();
                ctx.translate(fx, ground - Math.abs(step) * k * 0.03);
                ctx.rotate(step * 0.035);
                if (p.dir < 0) ctx.scale(-1, 1);
                ctx.drawImage(c, -fw / 2, -fh, fw, fh);
                ctx.restore();
            };
            if (p.kind === 'pair') { figure(p.other, x - k * 0.16); figure('noble', x + k * 0.16); }
            else figure(p.kind, x);
        }
        ctx.restore();
    }

    _door(G) {
        const { ctx, s } = this;
        const x = this.sx(-DOOR_W + 0.25), y = this.wallBase;
        const dw = s * 0.9, dh = s * 1.6;
        ctx.save();
        ctx.fillStyle = '#4b2e1a';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - dh + dw / 2); ctx.arc(x + dw / 2, y - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(x + dw, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2b190d'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        // a glowing window in the door
        const open = G.phase === 'open';
        ctx.fillStyle = open ? 'rgba(255,214,140,0.9)' : 'rgba(120,150,200,0.55)';
        ctx.beginPath(); ctx.arc(x + dw / 2, y - dh + dw / 2 + s * 0.05, dw * 0.28, 0, 7); ctx.fill();
        ctx.fillStyle = '#c9a24a';
        ctx.beginPath(); ctx.arc(x + dw * 0.82, y - dh * 0.42, s * 0.04, 0, 7); ctx.fill();
        // the hanging sign
        ctx.fillStyle = open ? '#f3e2b0' : '#c8b48a';
        ctx.fillRect(x + dw * 0.2, y - dh * 0.62, dw * 0.6, s * 0.18);
        ctx.fillStyle = '#4b2e1a';
        ctx.font = `700 ${Math.max(7, s * 0.1)}px Cinzel, Georgia, serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(open ? 'OPEN' : 'CLOSED', x + dw / 2, y - dh * 0.62 + s * 0.09);
        ctx.restore();
    }

    _sprite(im, cx, bottom, hUnits) {
        if (!ok(im)) return null;
        const h = hUnits * this.s, w = h * im.naturalWidth / im.naturalHeight;
        this.ctx.drawImage(im, cx - w / 2, bottom - h, w, h);
        return { x: cx - w / 2, y: bottom - h, w, h };
    }

    _item(G, row, slot) {
        const c = cell(G, row, slot);
        if (!c) return;
        const { ctx, s } = this;
        const cx = this.sx(slot + 0.5);
        const type = c.type;
        let bottom = row === 'wall' ? this.wallBase : this.floorY;
        if (type === 'painting') bottom = this.wallBase - s * 1.05;
        if (type === 'ivy') bottom = this.wallBase - s * 0.75;
        if (this.sel && this.sel.slot === slot && this.sel.row === row) {
            ctx.save(); ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 24;
        }
        const r = this._sprite(this.art.furn[type], cx, bottom, SIZE[type]);
        if (this.sel && this.sel.slot === slot && this.sel.row === row) ctx.restore();
        if (!r) { ctx.fillStyle = '#6b4226'; ctx.fillRect(cx - s * 0.4, bottom - s * SIZE[type], s * 0.8, s * SIZE[type]); return; }
        if (type === 'shelf') this._shelfBooks(G, row, slot, r);
        else if (type === 'table') this._tableBooks(G, row, slot, r);
        if (type === 'shelf') {
            const sec = section(G, row, slot);
            if (sec) {
                // a little brass label over a section
                ctx.save();
                ctx.font = `600 ${Math.max(8, s * 0.095)}px Cinzel, Georgia, serif`;
                // a little brass sign hung above the shelf (floor furniture would hide one on the plinth)
                const t = KINDS[sec].plural;
                const tw = Math.min(r.w * 0.8, ctx.measureText(t).width + s * 0.12);
                const ly = r.y - s * 0.2;
                ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(cx - tw * 0.35, ly); ctx.lineTo(cx, ly - s * 0.08); ctx.lineTo(cx + tw * 0.35, ly); ctx.stroke();
                ctx.fillStyle = '#c9a24a'; ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 1;
                ctx.fillRect(cx - tw / 2, ly, tw, s * 0.13); ctx.strokeRect(cx - tw / 2, ly, tw, s * 0.13);
                ctx.fillStyle = '#3a2410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(t, cx, ly + s * 0.068, r.w * 0.76);
                ctx.restore();
            }
        }
        if (type === 'lamp' && G.phase !== 'open') {
            // the lamp throws a warm pool of light at night
            const g = ctx.createRadialGradient(cx, r.y + r.h * 0.15, 0, cx, r.y + r.h * 0.15, s * 1.2);
            g.addColorStop(0, 'rgba(255,200,120,0.35)'); g.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = g; ctx.fillRect(cx - s * 1.2, r.y - s, s * 2.4, s * 2.6);
        }
    }

    _shelfBooks(G, row, slot, r) {
        const { ctx } = this;
        const books = shelfBooks(G, row, slot);
        const perRow = 3;
        const x0 = r.x + r.w * SHELF.x0, x1 = r.x + r.w * SHELF.x1, rw = x1 - x0;
        for (let k = 0; k < SHELF.rows.length; k++) {
            const by = r.y + r.h * SHELF.rows[k];
            const rh = r.h * SHELF.rowH;
            let x = x0 + rw * 0.04;
            for (let j = 0; j < perRow; j++) {
                const b = books[k * perRow + j];
                if (!b) { x += rw * 0.2; continue; }
                const L = b.look;
                const bw = rw * (0.13 + L.t * 0.32);
                const bh = rh * Math.min(1, 0.62 + L.h * 0.28);
                ctx.fillStyle = `hsl(${L.hue}, ${L.sat}%, ${L.lit + 4}%)`;
                ctx.fillRect(x, by - bh, bw, bh);
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + bw * 0.82, by - bh, bw * 0.18, bh);
                ctx.fillStyle = L.metalColor;
                const band = Math.max(1, bh * 0.06);
                ctx.fillRect(x, by - bh * 0.82, bw, band); ctx.fillRect(x, by - bh * 0.22, bw, band);
                if (b.rarity >= 2) { ctx.fillRect(x + bw * 0.3, by - bh * 0.6, bw * 0.4, bh * 0.2); }
                if (b.talk) {
                    // a talking book twitches now and then
                    const t = Math.sin(this.time * 3 + b.id) > 0.97 ? 1 : 0;
                    if (t) { ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x + bw / 2, by - bh - 3, 2.5, 0, 7); ctx.fill(); }
                }
                if (L.glow) { ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 2 + b.id); ctx.fillStyle = L.glow; ctx.fillRect(x - 1, by - bh - 1, bw + 2, bh + 2); ctx.restore(); }
                x += bw + rw * 0.025;
            }
        }
    }

    _tableBooks(G, row, slot, r) {
        const { ctx } = this;
        const books = shelfBooks(G, row, slot);
        const top = r.y + r.h * 0.12;
        books.forEach((b, i) => {
            if (!b) return;
            const L = b.look;
            const bw = r.w * 0.2, bh = bw * L.h / L.w;
            const x = r.x + r.w * (0.2 + i * 0.22);
            ctx.save();
            ctx.translate(x + bw / 2, top);
            ctx.rotate((i - 1) * 0.12);
            ctx.fillStyle = `hsl(${L.hue}, ${L.sat}%, ${L.lit + 4}%)`;
            ctx.fillRect(-bw / 2, -bh, bw, bh);
            ctx.strokeStyle = L.metalColor; ctx.lineWidth = Math.max(1, bw * 0.06);
            ctx.strokeRect(-bw / 2 + bw * 0.12, -bh + bw * 0.12, bw * 0.76, bh - bw * 0.24);
            ctx.fillStyle = L.metalColor; ctx.beginPath(); ctx.arc(0, -bh * 0.45, bw * 0.14, 0, 7); ctx.fill();
            ctx.restore();
        });
    }

    _counter(G) {
        const { s } = this;
        const cx = this.sx(G.shop.width + 1.05);
        // Tam behind the counter, Old Vellum floating beside her
        this._sprite(this.art.tam, cx + s * 0.15, this.floorY - s * 0.05, 1.0);
        const bob = Math.sin(this.time * 1.8) * s * 0.05;
        this._sprite(this.art.vellum, cx + s * 0.75, this.floorY - s * 0.95 + bob, 0.38);
        this._sprite(this.art.counter, cx, this.floorY + s * 0.02, SIZE.counter);
    }

    _customer(G, cu) {
        const { ctx, s } = this;
        const im = this.art.folk[cu.folk];
        if (!ok(im)) return;
        const x = this.sx(cu.x);
        const walking = cu.state === 'in' || cu.state === 'out';
        const bob = walking ? Math.abs(Math.sin(this.time * 9 + cu.bob * 10)) * s * 0.04 : 0;
        const h = (FOLK_H[cu.folk] || 0.95) * s;
        const w = h * im.naturalWidth / im.naturalHeight;
        const left = walking && cu.tx < cu.x;
        ctx.save();
        // a soft shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(x, this.floorY, w * 0.35, s * 0.05, 0, 0, 7); ctx.fill();
        ctx.translate(x, this.floorY - bob);
        if (left) ctx.scale(-1, 1);
        if (cu.state === 'browse') ctx.rotate(Math.sin(this.time * 2 + cu.bob * 5) * 0.03);
        ctx.drawImage(im, -w / 2, -h, w, h);
        ctx.restore();
        // what they hold, or want
        if (cu.carry) {
            const b = G.books.find((k) => k.id === cu.carry);
            if (b) { ctx.fillStyle = `hsl(${b.look.hue}, ${b.look.sat}%, ${b.look.lit}%)`; ctx.fillRect(x + w * 0.2, this.floorY - h * 0.55, s * 0.12, s * 0.16); ctx.strokeStyle = b.look.metalColor; ctx.strokeRect(x + w * 0.2, this.floorY - h * 0.55, s * 0.12, s * 0.16); }
        }
        if (cu.state === 'ask' && cu.want) {
            const by = this.floorY - h - s * 0.32 + Math.sin(this.time * 3) * s * 0.03;
            const icon = cu.want.kind ? KINDS[cu.want.kind].icon : cu.want.virtue ? VIRTUES[cu.want.virtue].icon : '📖';
            ctx.save();
            ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 2;
            const bw = s * 0.62, bh = s * 0.34;
            ctx.beginPath(); ctx.roundRect(x - bw / 2, by - bh / 2, bw, bh, bh * 0.4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - s * 0.06, by + bh / 2 - 1); ctx.lineTo(x, by + bh / 2 + s * 0.1); ctx.lineTo(x + s * 0.06, by + bh / 2 - 1); ctx.fill();
            ctx.font = `${Math.max(10, s * 0.2)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#3a2410';
            ctx.fillText(`${icon}?`, x, by + 1);
            // a patience ring
            ctx.strokeStyle = '#d98b3a'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x + bw / 2, by - bh / 2, s * 0.07, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, cu.patience) / 55); ctx.stroke();
            ctx.restore();
        } else if (cu.state === 'out' && cu.happy) {
            ctx.font = `${Math.max(10, s * 0.18)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('💛', x, this.floorY - h - s * 0.08 - Math.sin(this.time * 4) * 3);
        } else if (cu.state === 'browse') {
            ctx.font = `${Math.max(9, s * 0.15)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('…', x, this.floorY - h - s * 0.05);
        }
    }

    _handles(G) {
        const { ctx, s } = this;
        ctx.save();
        for (let i = 0; i < G.shop.width; i++) {
            const cx = this.sx(i + 0.5);
            for (const row of ['wall', 'floor']) {
                const y = row === 'wall' ? this.wallBase - s * 1.6 : this.floorY - s * 0.3;
                const sel = this.sel && this.sel.slot === i;
                if (G.shop[row][i] && !sel) continue;
                ctx.globalAlpha = sel ? 1 : 0.6;
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = sel ? '#ffe08a' : 'rgba(255,240,200,0.8)';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - s * 0.45, row === 'wall' ? this.wallBase - s * 1.5 : this.floorY - s * 0.72, s * 0.9, row === 'wall' ? s * 0.7 : s * 0.7);
                if (!G.shop[row][i]) {
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'rgba(40,24,12,0.6)';
                    ctx.beginPath(); ctx.arc(cx, y + s * 0.0, s * 0.13, 0, 7); ctx.fill();
                    ctx.fillStyle = '#ffe9b0'; ctx.font = `700 ${s * 0.2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('+', cx, y + 1);
                }
            }
        }
        ctx.restore();
    }

    _fx(dt) {
        const { ctx, s } = this;
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.t += dt;
            if (f.t > f.life) { this.fx.splice(i, 1); continue; }
            const a = 1 - f.t / f.life;
            const x = this.sx(f.x + (f.vx || 0) * f.t), y = this.floorY - (f.y + (f.vy || 0.6) * f.t) * s;
            ctx.save();
            ctx.globalAlpha = a;
            if (f.kind === 'text') {
                ctx.font = `700 ${Math.max(12, s * 0.2)}px Lora, Georgia, serif`;
                ctx.textAlign = 'center';
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,20,5,0.8)'; ctx.strokeText(f.text, x, y);
                ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
            } else {
                ctx.fillStyle = f.color;
                ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, s * 0.025) * a + 1, 0, 7); ctx.fill();
            }
            ctx.restore();
        }
    }

    _light(G) {
        const { ctx, w, h } = this;
        if (G.phase === 'evening') {
            ctx.fillStyle = 'rgba(20,24,60,0.32)';
            ctx.fillRect(0, 0, w, h);
        } else if (G.phase === 'morning') {
            const g = ctx.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, 'rgba(255,220,170,0.10)'); g.addColorStop(1, 'rgba(255,240,210,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        // dust motes in the light
        ctx.fillStyle = 'rgba(255,240,200,0.35)';
        for (let i = 0; i < 16; i++) {
            const x = ((i * 137.5 + this.time * (6 + i % 5)) % w);
            const y = (h * 0.15) + ((i * 71 + Math.sin(this.time * 0.5 + i) * 30) % (h * 0.6));
            ctx.fillRect(x, y, 1.6, 1.6);
        }
    }
}
