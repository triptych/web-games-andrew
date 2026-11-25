// The overworld in Canvas 2D: painted ground textures blended at their edges (baked once per map), then trees,
// props, people, chests, waiting foes and the party, sorted by depth so things stand in front of each other
// properly. The party follows the leader. A gold marker floats over whoever the guide says to see next.
// Reads G; never writes it.

import { MAPS, isSolidGround } from '../sim/data/maps.js';
import { CAST } from '../sim/data/cast.js';
import { cond } from '../sim/rules.js';
import { visibleProps, visiblePeople, isBumpEvent } from '../sim/world.js';
import { nextGoal } from '../sim/guide.js';
import { img } from './assets.js';
import { STEP_TIME } from '../config.js';
import { hash } from '../rng.js';

const TEX = { '.': 'grass', ',': 'meadow', ':': 'cobble', '=': 'dirt', 'p': 'planks', 'm': 'mud', 'i': 'plate', '~': 'water', '#': 'wall' };
const LAYERS = ['grass', 'meadow', 'mud', 'plate', 'planks', 'dirt', 'cobble', 'water'];
const SCALE = { cogsprite: 0.6, rustcrab: 0.8, gearwolf: 0.95, bandit: 0.95, bigbertha: 1.9 };
const LIGHT = {
    lane: { tint: 'rgba(255, 190, 110, 0.10)', dark: 0.08 },
    wilds: { tint: 'rgba(70, 120, 60, 0.08)', dark: 0.12, motes: '#fff3b0' },
    gully: { tint: 'rgba(120, 70, 30, 0.16)', dark: 0.22, motes: '#ffb870' },
    lair: { tint: 'rgba(120, 50, 20, 0.22)', dark: 0.35, motes: '#ff9a5a' },
};

export class MapView {
    constructor(canvas) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.mapId = null;
        this.T = 48;
        this.cache = new Map();           // painted grounds of the last few maps, by map and tile size (newest last)
        this.px = 0; this.py = 0;        // the leader's drawn position, in tiles
        this.from = null; this.t = 1;     // the current step's tween
        this.trail = [];                  // tiles the leader walked through, newest first
        this.flip = false;
        this.time = 0;
        this.motes = [];
        this.cam = { x: 0, y: 0 };
        this.walking = 0;
        this.blocked = null;              // { text, t }
    }

    resize(w, h, dpr) {
        this.w = w; this.h = h; this.dpr = dpr;
        const T = Math.round(Math.max(34, Math.min(72, Math.min(w / 11, h / 9))) * dpr);
        if (T !== this.T) { this.T = T; this.mapId = null; this.cache.clear(); }
    }

    get busy() { return this.t < 1; }
    /** Finish the current step at once (a battle began mid-step, and the map stops drawing). */
    snap() { this.t = 1; }

    /** The game moved the leader (one step, or a jump when the map changed). */
    sync(G) {
        if (G.map !== this.mapId) this.bake(G);
        if (this.lx === undefined || this.lmap !== G.map) { this.px = G.x; this.py = G.y; this.t = 1; this.trail = [[G.x, G.y]]; }
        else if (this.lx !== G.x || this.ly !== G.y) {
            const near = Math.abs(this.lx - G.x) + Math.abs(this.ly - G.y) === 1;
            if (near) { this.from = [this.px, this.py]; this.t = 0; } else { this.px = G.x; this.py = G.y; this.t = 1; }
            this.trail.unshift([G.x, G.y]);
            this.trail.length = Math.min(this.trail.length, 8);
            this.walking = 0.25;
        }
        if (G.face === 'left') this.flip = true; else if (G.face === 'right') this.flip = false;
        this.lx = G.x; this.ly = G.y; this.lmap = G.map;
    }

    /** Is this map's ground already painted at the current size? (Then entering it needs no loading screen.) */
    isBaked(id) { return this.mapId === id || this.cache.has(`${id}|${this.T}`); }

    /** Switch to the map G is on: its painted ground from the cache, or paint it (the slow part of changing maps). */
    bake(G) {
        const m = MAPS[G.map];
        this.mapId = G.map;
        this.m = m;
        this.motes = [];
        const key = `${G.map}|${this.T}`;
        let c = this.cache.get(key);
        if (c) this.cache.delete(key);   // re-added below as the newest
        else c = this.paint(m);
        this.cache.set(key, c);
        while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);   // a full map is tens of MB on a phone
        this.ground = c;
    }

    paint(m) {
        const T = this.T, W = m.grid[0].length, H = m.grid.length;
        const c = document.createElement('canvas');
        c.width = W * T; c.height = H * T;
        const x = c.getContext('2d');
        const base = TEX[m.ground] || 'grass';
        const layerOf = (ch) => ch === 'T' ? base : ch === 'V' ? null : TEX[ch];
        // Each ground texture shows through a soft-edged mask of its tiles. The masks are drawn at S px a tile and
        // blurred there, then scaled up: the same soft edges as blurring at full size, for a small fraction of the cost
        // (blurring a full-size canvas per texture took seconds on big maps and froze the step into a new map).
        const S = 8;
        const sm = document.createElement('canvas'), sb = document.createElement('canvas');
        sm.width = sb.width = W * S; sm.height = sb.height = H * S;
        const smx = sm.getContext('2d'), sbx = sb.getContext('2d');
        const layer = document.createElement('canvas');
        layer.width = c.width; layer.height = c.height;
        const lx = layer.getContext('2d');
        lx.imageSmoothingEnabled = true; lx.imageSmoothingQuality = 'high';
        for (const name of LAYERS) {
            const tex = img('tex', name);
            if (!tex) continue;
            smx.clearRect(0, 0, sm.width, sm.height);
            smx.fillStyle = '#fff';
            let any = false;
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                const ch = m.grid[j][i];
                if (layerOf(ch) === name || (name === base && ch !== 'V' && ch !== '#' && ch !== '~')) { smx.fillRect(i * S, j * S, S, S); any = true; }
            }
            if (!any) continue;
            sbx.clearRect(0, 0, sb.width, sb.height);
            sbx.filter = `blur(${name === 'water' ? 0.6 : 0.3 * S}px)`;
            sbx.drawImage(sm, 0, 0);
            sbx.filter = 'none';
            lx.globalCompositeOperation = 'copy';
            lx.drawImage(sb, 0, 0, layer.width, layer.height);
            lx.globalCompositeOperation = 'source-in';
            const pat = lx.createPattern(tex, 'repeat');
            pat.setTransform(new DOMMatrix().scale((T * 4) / tex.width));
            lx.fillStyle = pat;
            lx.fillRect(0, 0, layer.width, layer.height);
            x.drawImage(layer, 0, 0);
        }
        // water: a darker rim
        x.save();
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (m.grid[j][i] === '~') {
            const g = x.createLinearGradient(0, j * T, 0, j * T + T * 0.4);
            if (m.grid[j - 1]?.[i] !== '~') { g.addColorStop(0, 'rgba(0,10,20,0.55)'); g.addColorStop(1, 'rgba(0,10,20,0)'); x.fillStyle = g; x.fillRect(i * T, j * T, T, T * 0.4); }
        }
        x.restore();
        // walls: a stone top and a shaded face
        const wall = img('tex', 'wall');
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const ch = m.grid[j][i];
            if (ch === '#') {
                if (wall) { const p = x.createPattern(wall, 'repeat'); p.setTransform(new DOMMatrix().scale((T * 3) / wall.width)); x.fillStyle = p; } else x.fillStyle = '#4a3a30';
                x.fillRect(i * T, j * T, T, T);
                x.fillStyle = 'rgba(24,12,6,0.42)'; x.fillRect(i * T, j * T, T, T);
                if (m.grid[j - 1]?.[i] !== '#') { x.fillStyle = 'rgba(255,230,200,0.18)'; x.fillRect(i * T, j * T, T, Math.max(2, T * 0.06)); }
                if (m.grid[j + 1]?.[i] !== '#') { x.fillStyle = 'rgba(10,5,20,0.55)'; x.fillRect(i * T, j * T + T * 0.62, T, T * 0.38); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i * T, j * T, T, 3); }
                x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * T, (j + 1) * T, T, T * 0.18);
            } else if (ch === 'V') {
                const r = hash(`${i},${j}`);
                x.fillStyle = '#05030b'; x.fillRect(i * T, j * T, T, T);
                x.fillStyle = `rgba(120, 90, 200, ${0.08 + (r % 7) / 60})`; x.fillRect(i * T, j * T, T, T);
                if (r % 5 === 0) { x.fillStyle = 'rgba(200,220,255,0.7)'; x.fillRect(i * T + (r % 37) / 37 * T, j * T + ((r >> 5) % 37) / 37 * T, 2, 2); }
            }
        }
        // the void's edge falls away into shadow
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (m.grid[j][i] === 'V' && m.grid[j - 1]?.[i] && m.grid[j - 1][i] !== 'V') {
            const g = x.createLinearGradient(0, j * T, 0, j * T + T * 0.6);
            g.addColorStop(0, 'rgba(60,40,90,0.9)'); g.addColorStop(1, 'rgba(5,3,11,0)');
            x.fillStyle = g; x.fillRect(i * T, j * T, T, T * 0.6);
        }
        return c;
    }

    /** Tile under a point on the canvas (CSS px). */
    tileAt(cx, cy) {
        const T = this.T, d = this.dpr;
        return [Math.floor((cx * d + this.cam.x) / T), Math.floor((cy * d + this.cam.y) / T)];
    }

    say(text) { this.blocked = { text, t: 2.6 }; }

    draw(G, dt) {
        const ctx = this.ctx, T = this.T, d = this.dpr;
        if (G.map !== this.mapId) this.bake(G);
        const m = this.m;
        this.time += dt;
        if (this.t < 1) { this.t = Math.min(1, this.t + dt / STEP_TIME); const e = this.t; this.px = this.from[0] + (G.x - this.from[0]) * e; this.py = this.from[1] + (G.y - this.from[1]) * e; }
        else { this.px = G.x; this.py = G.y; }
        this.walking = Math.max(0, this.walking - dt);
        const W = m.grid[0].length * T, H = m.grid.length * T, cw = this.w * d, ch = this.h * d;
        let cx = (this.px + 0.5) * T - cw / 2, cy = (this.py + 0.5) * T - ch / 2;
        cx = W <= cw ? (W - cw) / 2 : Math.max(0, Math.min(W - cw, cx));
        cy = H <= ch ? (H - ch) / 2 : Math.max(0, Math.min(H - ch, cy));
        this.cam = { x: Math.round(cx), y: Math.round(cy) };
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = m.interior ? '#140b08' : '#0a0705';
        ctx.fillRect(0, 0, cw, ch);
        ctx.setTransform(1, 0, 0, 1, -this.cam.x, -this.cam.y);
        ctx.drawImage(this.ground, 0, 0);
        this.water(ctx, m, T);

        // everything that stands up, sorted by its foot
        const list = [];
        const treeImg = m.tree ? img('prop', m.tree) : null;
        for (let j = 0; j < m.grid.length; j++) for (let i = 0; i < m.grid[0].length; i++) {
            if (m.grid[j][i] !== 'T' || !treeImg) continue;
            const r = hash(`${m.name}${i},${j}`);
            const s = 1.45 + (r % 30) / 100;
            list.push({ y: (j + 1) * T, draw: () => this.sprite(ctx, treeImg, (i + 0.5) * T + ((r >> 4) % 9 - 4) * T / 40, (j + 1.12) * T, s * T, false, 0.35) });
        }
        for (const p of visibleProps(G)) {
            const im = img('prop', p.k);
            if (!im) continue;
            let w = (p.small ? 1 : p.w * (p.w > 1 ? 1.12 : 0.92)) * T;
            if (p.counter) w = Math.min(w, T * 1.0 * im.width / im.height);   // keep counters low, so whoever stands behind shows
            const foot = (p.y + p.h) * T;
            const flat = p.solid === false && !p.small;
            list.push({ y: flat ? foot - T : foot, draw: () => {
                if (p.k === 'lair_gate' && cond(G, 'has:lairkey')) ctx.globalAlpha = 0.85;
                this.sprite(ctx, im, (p.x + p.w / 2) * T, foot + (p.h > 1 ? T * 0.05 : 0), w, false, p.h > 1 ? 0 : 0.3);
                ctx.globalAlpha = 1;
            } });
        }
        for (const ev of m.events) {
            if (ev.type === 'chest') {
                const im = img('prop', ev.art || 'chest');
                const open = !!G.done[ev.id];
                list.push({ y: (ev.y + 1) * T, draw: () => {
                    if (open) ctx.filter = 'brightness(0.55) saturate(0.6)';
                    this.sprite(ctx, im, (ev.x + 0.5) * T, (ev.y + 0.95) * T, T * (ev.art ? 0.7 : 0.85), false, 0.3);
                    ctx.filter = 'none';
                    if (!open) this.sparkle(ctx, (ev.x + 0.5) * T, (ev.y + 0.3) * T, T);
                } });
            } else if (ev.type === 'fight' && isBumpEvent(G, ev)) {
                const im = img('enemy', ev.who);
                const s = ev.boss ? 2.6 : (SCALE[ev.who] || 1) * 1.25;
                list.push({ y: (ev.y + 1) * T, draw: () => {
                    const bob = Math.sin(this.time * 2 + ev.x) * T * 0.04;
                    this.sprite(ctx, im, (ev.x + 0.5) * T, (ev.y + 1) * T + bob, s * T, false, 0.45, true);
                } });
            }
        }
        for (const pp of visiblePeople(G)) {
            const im = img('chibi', pp.who);
            const face = pp.x > G.x;
            list.push({ y: (pp.y + 1) * T, draw: () => this.sprite(ctx, im, (pp.x + 0.5) * T, (pp.y + 0.98) * T + Math.sin(this.time * 2.2 + pp.x) * T * 0.015, T * 1.05, face, 0.32, true) });
        }
        // the party: leader and followers along the trail
        const party = G.party.filter((id) => CAST[id]);
        party.forEach((id, k) => {
            let x, y;
            if (k === 0) { x = this.px; y = this.py; }
            else {
                const a = this.trail[k] || this.trail[this.trail.length - 1], b = this.trail[k - 1] || a;
                x = b[0] + (a[0] - b[0]) * (1 - this.t); y = b[1] + (a[1] - b[1]) * (1 - this.t);
                if (k > 0 && x === this.px && y === this.py) return;
            }
            const bob = this.walking > 0 ? Math.abs(Math.sin(this.time * 18 + k)) * T * 0.05 : 0;
            const flip = k === 0 ? this.flip : (this.trail[k - 1] && this.trail[k] ? this.trail[k - 1][0] < this.trail[k][0] : this.flip);
            list.push({ y: (y + 1) * T - k * 0.01, draw: () => this.sprite(ctx, img('chibi', id), (x + 0.5) * T, (y + 0.98) * T - bob, T * 1.05, flip, 0.32, true) });
        });
        list.sort((a, b) => a.y - b.y);
        for (const s of list) s.draw();

        // the guide's marker
        const goal = G.mode === 'explore' ? nextGoal(G) : null;
        if (goal && goal.map === G.map && goal.kind !== 'grind') {
            const bx = (goal.x + 0.5) * T, by = (goal.y - (goal.kind === 'bump' && goal.id === 'lr_bertha' ? 2.4 : 0.9)) * T + Math.sin(this.time * 4) * T * 0.08;
            ctx.fillStyle = '#ffd77a'; ctx.strokeStyle = '#3a2008'; ctx.lineWidth = Math.max(2, T / 20);
            ctx.beginPath(); ctx.moveTo(bx, by + T * 0.28); ctx.lineTo(bx - T * 0.18, by); ctx.lineTo(bx + T * 0.18, by); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        this.atmosphere(ctx, G, dt, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.light(ctx, G, cw, ch);
        if (this.blocked) {
            this.blocked.t -= dt;
            if (this.blocked.t <= 0) this.blocked = null;
        }
    }

    sprite(ctx, im, x, foot, w, flip, shadow = 0.3, small = false) {
        if (!im) return;
        const h = w * im.height / im.width;
        if (shadow) {
            ctx.fillStyle = `rgba(0,0,0,${shadow})`;
            ctx.beginPath(); ctx.ellipse(x, foot - w * 0.03, w * (small ? 0.28 : 0.4), w * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, foot - h, w, h); ctx.restore(); }
        else ctx.drawImage(im, x - w / 2, foot - h, w, h);
    }

    sparkle(ctx, x, y, T) {
        const a = (Math.sin(this.time * 3 + x) + 1) / 2;
        ctx.fillStyle = `rgba(255, 240, 180, ${0.4 + a * 0.5})`;
        const r = T * (0.05 + a * 0.05);
        ctx.beginPath(); ctx.moveTo(x, y - r * 3); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 3); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    }

    water(ctx, m, T) {
        for (let j = 0; j < m.grid.length; j++) for (let i = 0; i < m.grid[0].length; i++) {
            if (m.grid[j][i] !== '~') continue;
            const a = 0.08 + 0.06 * Math.sin(this.time * 1.6 + i * 1.3 + j * 0.7);
            ctx.fillStyle = `rgba(160, 220, 255, ${a})`;
            ctx.fillRect(i * T + T * 0.15, j * T + T * (0.3 + 0.1 * Math.sin(this.time + i)), T * 0.5, 2);
        }
    }

    atmosphere(ctx, G, dt, W, H) {
        const L = LIGHT[G.map];
        if (!L?.motes) return;
        while (this.motes.length < 40) this.motes.push({ x: Math.random() * W, y: Math.random() * H, v: 0.2 + Math.random() * 0.6, p: Math.random() * 6 });
        ctx.fillStyle = L.motes;
        for (const mo of this.motes) {
            mo.y -= mo.v * dt * this.T * 0.4; mo.p += dt;
            if (mo.y < 0) { mo.y = H; mo.x = Math.random() * W; }
            ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(mo.p));
            ctx.fillRect(mo.x + Math.sin(mo.p) * this.T * 0.2, mo.y, 2 * this.dpr, 2 * this.dpr);
        }
        ctx.globalAlpha = 1;
    }

    light(ctx, G, cw, ch) {
        const L = LIGHT[G.map] || { tint: 'rgba(0,0,0,0)', dark: 0.2 };
        ctx.fillStyle = L.tint; ctx.fillRect(0, 0, cw, ch);
        const x = (this.px + 0.5) * this.T - this.cam.x, y = (this.py + 0.4) * this.T - this.cam.y;
        const g = ctx.createRadialGradient(x, y, this.T * 2, x, y, Math.max(cw, ch) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,2,10,${L.dark + 0.25})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
}
