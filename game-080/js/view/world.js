// Draws a map: ground (baked in chunks), animated water and locks, then everything that stands up
// (scenery, buildings, people, foes, you, Wick) sorted by where its feet are, then light and
// weather. Reads the sim; never changes it.

import { TILE } from '../config.js';
import { TILES, T } from '../sim/data/tiles.js';
import { ZONES } from '../sim/data/world.js';
import { NPCS } from '../sim/data/npcs.js';
import { FOE } from '../sim/data/enemies.js';
import { GRIMOIRE, COMMON_BOOKS, GENRES } from '../sim/data/books.js';
import { tileAt, clutterGone } from '../sim/rules.js';
import { npcsHere } from '../sim/game.js';
import { ground, wallTile, waterTile, lockTile, prop, ROOM } from './tiles.js';
import { building } from './buildings.js';
import { personFrame, foeFrame, wickFrame, PLAYER_LOOK, spine } from './sprites.js';
import { canvas } from './paint.js';

const CH = 16;                      // chunk size in tiles
const WALLISH = new Set(['wall', 'cliff', 'stonewall', 'pit', 'reef', 'rapids']);
const ANIM = new Set(['water', 'deep', 'stream', 'fog', 'ghost', 'chasm', 'starseal', 'rune', 'tiny', 'sprout', 'thorn', 'dark', 'locked']);
const GLOWS = { lamp: [255, 214, 120, 46], hearth: [255, 150, 60, 54], kiln: [255, 130, 50, 44], telescope: null, starseal: [140, 120, 255, 34], lectern: [255, 220, 140, 26] };

export class WorldView {
    constructor() {
        this.chunks = new Map();
        this.wick = { x: 0, y: 0, map: null };
        this.cam = { x: 0, y: 0, map: null };
        this.light = canvas(8, 8);
        this.parts = [];
        this.time = 0;
    }

    styleAt(M, i) {
        if (M.kind === 'world') return ZONES[M.zoneOf[i]].biome;
        return M.style;
    }

    version(G, M) {
        const o = G.opened[M.id];
        return (o ? Object.keys(o).length : 0) + ':' + (M.id === 'library' ? G.placed.length : 0);
    }

    // ---------------------------------------------------------------- ground chunks
    chunk(G, M, cx, cy) {
        const key = M.id + ':' + cx + ':' + cy;
        const ver = this.version(G, M);
        let ch = this.chunks.get(key);
        if (ch && ch.ver === ver) return ch.cv.c;
        if (!ch) { ch = { cv: canvas(CH * TILE, CH * TILE), ver }; this.chunks.set(key, ch); }
        ch.ver = ver;
        const { g } = ch.cv;
        g.clearRect(0, 0, CH * TILE, CH * TILE);
        for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
            const x = cx * CH + tx, y = cy * CH + ty;
            if (x >= M.w || y >= M.h) continue;
            const i = y * M.w + x;
            const img = this.groundImg(G, M, x, y, i);
            if (img) g.drawImage(img, tx * TILE, ty * TILE);
        }
        return ch.cv.c;
    }

    groundImg(G, M, x, y, i) {
        const t = tileAt(G, M, i);
        const d = TILES[t];
        const st = this.styleAt(M, i);
        const v = M.v[i];
        if (WALLISH.has(d.name)) {
            const below = y + 1 < M.h ? TILES[tileAt(G, M, i + M.w)].name : d.name;
            const face = below !== d.name && !WALLISH.has(below);
            if (d.name === 'wall') return wallTile('wall', M.style, face, v);
            if (d.name === 'pit' && M.kind === 'world') return wallTile('pit', 'sky', face, v);
            return wallTile(d.name, st, face, v);
        }
        if (d.name === 'void') return null;
        // things standing on tiles and animated tiles still need ground under them
        let gname = TILES[M.g[i]].name;
        if (!d.solid && !d.lock && !ANIM.has(d.name)) gname = d.name;
        if (gname === 'water') gname = 'sand';
        if (gname === 'door' || gname === 'stairs') gname = M.kind === 'world' ? 'path' : TILES[M.g[i]].name;
        return ground(gname, st, v);
    }

    // ---------------------------------------------------------------- the frame
    draw(ctx, G, vw, vh, dt, opts = {}) {
        this.time += dt;
        const M = opts.map;
        const p = G.p;
        // camera: follow, clamp to the map, centre small rooms
        const px = p.x * TILE, py = p.y * TILE - 10;
        if (this.cam.map !== M.id) { this.cam.x = px; this.cam.y = py; this.cam.map = M.id; this.wick = { x: p.x - 0.8, y: p.y, map: M.id }; this.parts.length = 0; }
        const k = 1 - Math.exp(-dt * 8);
        this.cam.x += (px - this.cam.x) * k;
        this.cam.y += (py - this.cam.y) * k;
        const mw = M.w * TILE, mh = M.h * TILE;
        let cx = mw <= vw ? mw / 2 : Math.max(vw / 2, Math.min(mw - vw / 2, this.cam.x));
        let cy = mh <= vh ? mh / 2 : Math.max(vh / 2, Math.min(mh - vh / 2, this.cam.y));
        if (opts.shake) { cx += (Math.random() - 0.5) * opts.shake; cy += (Math.random() - 0.5) * opts.shake; }
        const ox = Math.round(vw / 2 - cx), oy = Math.round(vh / 2 - cy);
        this.ox = ox; this.oy = oy;

        ctx.fillStyle = M.kind === 'world' ? '#1d2a3a' : '#120e14';
        ctx.fillRect(0, 0, vw, vh);

        const tx0 = Math.max(0, Math.floor(-ox / TILE) - 1), ty0 = Math.max(0, Math.floor(-oy / TILE) - 1);
        const tx1 = Math.min(M.w - 1, Math.ceil((vw - ox) / TILE) + 1), ty1 = Math.min(M.h - 1, Math.ceil((vh - oy) / TILE) + 2);

        // ground
        for (let cyy = Math.floor(ty0 / CH); cyy <= Math.floor(ty1 / CH); cyy++) {
            for (let cxx = Math.floor(tx0 / CH); cxx <= Math.floor(tx1 / CH); cxx++) {
                ctx.drawImage(this.chunk(G, M, cxx, cyy), ox + cxx * CH * TILE, oy + cyy * CH * TILE);
            }
        }
        // animated tiles
        const fr = Math.floor(this.time * 3) % 4;
        const lights = [];
        const items = [];
        for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
            const i = y * M.w + x;
            const t = tileAt(G, M, i);
            const d = TILES[t];
            const sx = ox + x * TILE, sy = oy + y * TILE;
            if (t === T.water || t === T.deep) {
                let e = 0;
                const land = (j) => { const tt = TILES[tileAt(G, M, j)]; return !tt.swim && tt.name !== 'reef' && tt.name !== 'rapids' && tt.name !== 'bridge'; };
                if (y > 0 && land(i - M.w)) e |= 1;
                if (x < M.w - 1 && land(i + 1)) e |= 2;
                if (y < M.h - 1 && land(i + M.w)) e |= 4;
                if (x > 0 && land(i - 1)) e |= 8;
                ctx.drawImage(waterTile((fr + ((x + y) & 1)) & 3, this.styleAt(M, i), e), sx, sy);
                continue;
            }
            if (d.lock && ANIM.has(d.name)) {
                ctx.drawImage(lockTile(d.name, fr, this.styleAt(M, i), M.v[i]), sx, sy);
                if (d.name === 'starseal') lights.push([sx + 8, sy + 8, GLOWS.starseal]);
                if (d.name === 'rune') lights.push([sx + 8, sy + 8, [255, 220, 120, 18]]);
                continue;
            }
            if (t === T.locked) { ctx.drawImage(lockTile('locked', 0, M.style, 0), sx, sy); continue; }
            // things that stand up
            if (d.prop || t === T.boulder || t === T.clutter) {
                if (t === T.clutter && clutterGone(G, M, i)) continue;
                items.push({ y: y + 0.98, kind: 'prop', x, ty: y, t, i });
                if (GLOWS[d.name]) lights.push([sx + 8, sy + (d.name === 'lamp' ? -4 : 6), GLOWS[d.name]]);
            }
        }
        // buildings
        for (const b of M.buildings) {
            if (b.x * TILE + ox > vw + 64 || (b.x + b.w) * TILE + ox < -64 || b.y * TILE + oy > vh + 96 || (b.y + b.h) * TILE + oy < -96) continue;
            items.push({ y: b.y + b.h - 0.02, kind: 'bld', b });
        }
        // people
        for (const n of npcsHere(G)) items.push({ y: n.y + 0.9, kind: 'npc', n });
        for (const e of G.ents) {
            if (Math.abs(e.x - p.x) > vw / TILE + 2 || Math.abs(e.y - p.y) > vh / TILE + 2) continue;
            items.push({ y: e.y + 0.3, kind: 'foe', e });
        }
        items.push({ y: p.y, kind: 'player' });
        // Wick floats along behind you
        const wd = { up: [0, 0.7], down: [0, -0.5], left: [0.8, -0.1], right: [-0.8, -0.1] }[p.dir];
        const wx = p.x + wd[0], wy = p.y + wd[1];
        if (this.wick.map !== M.id) this.wick = { x: wx, y: wy, map: M.id };
        const wk = 1 - Math.exp(-dt * 3.5);
        this.wick.x += (wx - this.wick.x) * wk; this.wick.y += (wy - this.wick.y) * wk;
        if (G.flags.metWick && !G.flags.won) items.push({ y: this.wick.y + 0.4, kind: 'wick' });
        if (G.flags.won && M.id !== 'library') items.push({ y: this.wick.y + 0.4, kind: 'wick' });

        items.sort((a, b) => a.y - b.y);
        for (const it of items) this.drawItem(ctx, G, M, it, ox, oy, lights);

        // weather and motes
        this.weather(ctx, G, M, vw, vh, dt, ox, oy);

        // light: night outdoors, darkness in dark places
        this.lighting(ctx, G, M, vw, vh, ox, oy, lights);
    }

    drawItem(ctx, G, M, it, ox, oy, lights) {
        const p = G.p;
        if (it.kind === 'prop') {
            const d = TILES[it.t];
            const st = this.styleAt(M, it.i);
            let extra = 0;
            if (d.name === 'chest') extra = G.chests[M.objs[it.i]?.id] ? 1 : 0;
            if (d.name === 'lectern' && M.objs[it.i]) { const id = G.placed[M.objs[it.i].n]; extra = id ? GRIMOIRE[id].colour : 0; if (id) lights.push([ox + it.x * TILE + 8, oy + it.ty * TILE + 2, [255, 230, 160, 22]]); }
            const pr = prop(d.name === 'boulder' ? 'boulder' : d.name, st, M.v[it.i], extra);
            const sx = ox + it.x * TILE + pr.ox, sy = oy + it.ty * TILE + pr.oy;
            ctx.drawImage(pr.c, sx, sy);
            if (d.name === 'shelf' && M.shelves) this.shelfBooks(ctx, G, M, it, sx, sy);
            if (d.name === 'hearth') this.fire(ctx, sx + 8, sy + 13, G.flags.metWick ? 1 : 0.35);
            if (d.name === 'kiln') this.fire(ctx, sx + 8, sy + 18, 0.6);
            return;
        }
        if (it.kind === 'bld') {
            const b = it.b;
            const art = building(b, this.time);
            const sx = ox + b.x * TILE - 2, sy = oy + b.y * TILE + art.oy;
            ctx.drawImage(art.c, sx, sy);
            for (const [wx, wy] of art.win) lights.push([sx + wx, sy + wy, [255, 200, 110, 20]]);
            return;
        }
        if (it.kind === 'npc') {
            const n = it.n;
            const def = NPCS[n.id];
            if (!def) return;
            const dx = p.x - (n.x + 0.5), dy = p.y - (n.y + 0.55);
            let dir = 'down';
            if (Math.hypot(dx, dy) < 2.6) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            else { const ph = Math.floor((this.time + n.x * 1.7 + n.y) / 2.5) % 5; dir = ['down', 'down', 'left', 'down', 'right'][ph]; }
            const fr = def.look.k === 'ghost' || def.look.k === 'heron' ? Math.floor(this.time * 2 + n.x) % 3 : 0;
            const img = personFrame(def.look, dir, fr, n.id);
            const bob = def.look.k === 'ghost' ? Math.round(Math.sin(this.time * 2 + n.x) * 1.5) : 0;
            const sx = Math.round(ox + (n.x + 0.5) * TILE - 8), sy = Math.round(oy + (n.y + 0.55) * TILE - 22 + bob);
            this.shadow(ctx, sx + 8, oy + (n.y + 0.55) * TILE, 5);
            ctx.drawImage(img, sx, sy);
            return;
        }
        if (it.kind === 'foe') {
            const e = it.e;
            const look = FOE[e.foe].look;
            const f = Math.floor(this.time * (e.state === 'chase' ? 6 : 3) + e.hx) % 2;
            const img = foeFrame(look, f, 20);
            const hop = e.state === 'chase' ? Math.abs(Math.sin(this.time * 9 + e.hx)) * 2 : Math.abs(Math.sin(this.time * 3 + e.hx));
            const sx = Math.round(ox + e.x * TILE - 10), sy = Math.round(oy + e.y * TILE - 18 - hop);
            this.shadow(ctx, sx + 10, oy + e.y * TILE + 1, 6);
            if (e.swim) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 2, sy - 4, 24, 18); ctx.clip(); ctx.drawImage(img, sx, sy); ctx.restore(); }
            else ctx.drawImage(img, sx, sy);
            if (e.state === 'chase') { ctx.fillStyle = '#ffd86b'; ctx.fillRect(sx + 9, sy - 6, 2, 4); ctx.fillRect(sx + 9, sy - 1, 2, 1); }
            if (e.state === 'dazed') { const a = this.time * 5; ctx.fillStyle = '#fff4c0'; ctx.fillRect(sx + 10 + Math.cos(a) * 6, sy - 3 + Math.sin(a) * 2, 2, 2); }
            return;
        }
        if (it.kind === 'player') {
            const walk = p.moving ? [1, 0, 2, 0][Math.floor(p.walk * 7) % 4] : 0;
            const img = personFrame(PLAYER_LOOK, p.dir, walk, 'player');
            const sx = Math.round(ox + p.x * TILE - 8), sy = Math.round(oy + p.y * TILE - 22);
            if (p.small) {
                this.shadow(ctx, sx + 8, oy + p.y * TILE, 3);
                ctx.drawImage(img, sx + 4, sy + 12, 8, 12);
                return;
            }
            if (p.float) {
                const lift = 4 + Math.sin(this.time * 3) * 2;
                this.shadow(ctx, sx + 8, oy + p.y * TILE + 2, 4);
                ctx.drawImage(img, sx, sy - lift);
                ctx.fillStyle = 'rgba(242,239,226,0.9)';
                ctx.fillRect(sx - 2, sy + 8 - lift + Math.sin(this.time * 6) * 2, 3, 1); ctx.fillRect(sx + 15, sy + 8 - lift - Math.sin(this.time * 6) * 2, 3, 1);
                return;
            }
            if (p.swim) {
                ctx.save(); ctx.beginPath(); ctx.rect(sx - 2, sy - 2, 20, 16); ctx.clip();
                ctx.drawImage(img, sx, sy + 3 + Math.round(Math.sin(this.time * 4)));
                ctx.restore();
                ctx.fillStyle = 'rgba(220,240,255,0.85)';
                const r = (this.time * 8) % 6;
                ctx.fillRect(sx - 1 - r / 2, sy + 15, 4, 1); ctx.fillRect(sx + 13 + r / 2, sy + 15, 4, 1);
                return;
            }
            this.shadow(ctx, sx + 8, oy + p.y * TILE, 5);
            ctx.drawImage(img, sx, sy);
            return;
        }
        if (it.kind === 'wick') {
            const img = wickFrame((this.time * 1.2) % 1);
            const bob = Math.sin(this.time * 2.6) * 2;
            const sx = Math.round(ox + this.wick.x * TILE - 7), sy = Math.round(oy + this.wick.y * TILE - 26 + bob);
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffb03a';
            ctx.beginPath(); ctx.arc(sx + 7, sy + 10, 9, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.drawImage(img, sx, sy);
            lights.push([sx + 7, sy + 10, [255, 170, 80, M.dark && !G.books.includes('lumen') ? 34 : 30], 'wick']);
            this.wickScreen = { x: sx + 7, y: sy };
            // a spark now and then
            if (Math.random() < 0.06) this.parts.push({ x: this.wick.x + (Math.random() - 0.5) * 0.4, y: this.wick.y - 1.3, vx: (Math.random() - 0.5) * 0.3, vy: -0.6, life: 0.8, t: 0, c: '#ffd86b', kind: 'spark' });
        }
    }

    shelfBooks(ctx, G, M, it, sx, sy) {
        const genre = M.shelves[it.ty];
        if (!genre) return;
        const books = COMMON_BOOKS.filter((b) => b.genre === genre);
        // which shelf tile in the row is this (0..5)
        let k = 0;
        for (let x = it.x - 1; x >= 0 && TILES[M.t[it.ty * M.w + x]].name === 'shelf'; x--) k++;
        const b = books[k];
        if (!b || G.common[b.id] !== 2) return;
        const col = GENRES[genre].colour;
        for (let row = 0; row < 3; row++) for (let s = 0; s < 4; s++) {
            const h = 5 + ((s + row + k) % 2);
            ctx.drawImage(spine(s % 2 ? col : shadeHex(col, row), h, s + k), sx + 2 + s * 3, sy + 3 + row * 7 + (6 - h));
        }
    }

    fire(ctx, x, y, strength) {
        const t = this.time;
        for (let i = 0; i < 4; i++) {
            const h = (3 + Math.sin(t * 9 + i * 2) * 1.5) * strength * 1.4;
            ctx.fillStyle = i % 2 ? '#ffb03a' : '#ff7a2a';
            ctx.fillRect(Math.round(x - 4 + i * 2), Math.round(y - h), 2, Math.max(1, Math.round(h)));
        }
        if (strength > 0.5) { ctx.fillStyle = '#ffe58a'; ctx.fillRect(Math.round(x - 1), Math.round(y - 2), 2, 2); }
    }

    shadow(ctx, x, y, r) {
        ctx.fillStyle = 'rgba(20,14,24,0.28)';
        ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---------------------------------------------------------------- weather
    weather(ctx, G, M, vw, vh, dt, ox, oy) {
        const z = M.kind === 'world' ? ZONES[M.zoneOf[Math.floor(G.p.y) * M.w + Math.floor(G.p.x)]] : null;
        const biome = z?.biome;
        const night = this.nightAmount(G, M);
        let kind = null, rate = 0;
        if (M.kind === 'world') {
            if (biome === 'peak') { kind = 'snow'; rate = 30; }
            else if (biome === 'wood' || biome === 'thorn' || biome === 'willow') { kind = 'leaf'; rate = 3; }
            else if (biome === 'moor' || biome === 'abbeyg') { kind = 'mist'; rate = 3; }
            else if (biome === 'sky') { kind = 'cloud'; rate = 2; }
            else if (night > 0.4) { kind = 'firefly'; rate = 4; }
            else if (['meadow', 'farm', 'hill', 'green', 'village', 'mouse'].includes(biome)) { kind = 'petal'; rate = 1.2; }
        } else if (M.id === 'library') { kind = 'mote'; rate = 4; }
        else if (M.dark) { kind = 'mote'; rate = 1; }
        if (kind && Math.random() < rate * dt) {
            const wx = (-ox + Math.random() * vw) / TILE, wy = (-oy + (kind === 'snow' || kind === 'leaf' || kind === 'petal' ? -10 : Math.random() * vh)) / TILE;
            this.parts.push({ x: wx, y: wy, vx: kind === 'mist' || kind === 'cloud' ? 0.5 : (Math.random() - 0.5) * 0.5, vy: kind === 'snow' ? 1.2 : kind === 'leaf' || kind === 'petal' ? 0.8 : kind === 'firefly' ? 0 : -0.05, life: kind === 'mist' || kind === 'cloud' ? 9 : 7, t: 0, kind, ph: Math.random() * 6 });
        }
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const q = this.parts[i];
            q.t += dt;
            if (q.t > q.life || this.parts.length > 160) { this.parts.splice(i, 1); continue; }
            q.x += (q.vx + (q.kind === 'leaf' || q.kind === 'petal' ? Math.sin(q.t * 2 + q.ph) * 0.6 : 0)) * dt;
            q.y += q.vy * dt;
            if (q.kind === 'firefly') { q.x += Math.sin(q.t * 1.3 + q.ph) * 0.4 * dt; q.y += Math.cos(q.t * 1.1 + q.ph) * 0.3 * dt; }
            const sx = Math.round(ox + q.x * TILE), sy = Math.round(oy + q.y * TILE);
            const fade = Math.min(1, q.t * 2, (q.life - q.t) * 1.5);
            ctx.globalAlpha = Math.max(0, fade);
            switch (q.kind) {
                case 'snow': ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 1, 1); if (q.ph > 3) ctx.fillRect(sx + 1, sy, 1, 1); break;
                case 'leaf': ctx.fillStyle = q.ph > 3 ? '#d8903a' : '#8aba4a'; ctx.fillRect(sx, sy, 2, 1); ctx.fillRect(sx + 1, sy + 1, 1, 1); break;
                case 'petal': ctx.fillStyle = q.ph > 3 ? '#ffd0e0' : '#fff4c0'; ctx.fillRect(sx, sy, 1, 1); break;
                case 'mist': ctx.globalAlpha = Math.max(0, fade) * 0.25; ctx.fillStyle = '#e8eef2'; ctx.beginPath(); ctx.ellipse(sx, sy, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); break;
                case 'cloud': ctx.globalAlpha = Math.max(0, fade) * 0.5; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(sx, sy, 14, 4, 0, 0, Math.PI * 2); ctx.fill(); break;
                case 'firefly': ctx.fillStyle = Math.sin(q.t * 6 + q.ph) > 0 ? '#e8ff8a' : '#a8c050'; ctx.fillRect(sx, sy, 1, 1); break;
                case 'mote': ctx.globalAlpha = Math.max(0, fade) * 0.6; ctx.fillStyle = '#ffe8a8'; ctx.fillRect(sx, sy, 1, 1); break;
                case 'spark': ctx.fillStyle = q.c; ctx.fillRect(sx, sy, 1, 1); break;
                default: ctx.fillStyle = q.c || '#ffffff'; ctx.fillRect(sx, sy, q.s || 1, q.s || 1);
            }
            ctx.globalAlpha = 1;
        }
    }

    burst(x, y, colour, n = 16, speed = 2.5) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
            this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 0.6 + Math.random() * 0.6, t: 0, kind: 'fx', c: colour, s: Math.random() < 0.3 ? 2 : 1 });
        }
    }

    // ---------------------------------------------------------------- light
    nightAmount(G, M) {
        if (M.kind !== 'world') return 0;
        const ph = (G.clock / 600) % 1;     // 0.3 is morning
        // day from 0.2 to 0.75, dusk to 0.85, night until 0.15
        if (ph > 0.22 && ph < 0.72) return 0;
        if (ph >= 0.72 && ph < 0.86) return (ph - 0.72) / 0.14 * 0.62;
        if (ph >= 0.86 || ph < 0.12) return 0.62;
        return (0.22 - ph) / 0.1 * 0.62;
    }

    lighting(ctx, G, M, vw, vh, ox, oy, lights) {
        let dark = this.nightAmount(G, M);
        let col = '18,22,60';
        if (M.dark) { dark = G.books.includes('lumen') ? 0.8 : 0.94; col = '6,4,12'; }
        if (M.id === 'undercroft') col = '10,4,20';
        if (dark <= 0.01) {
            // a warm sunset blush
            const ph = (G.clock / 600) % 1;
            if (M.kind === 'world' && ph > 0.62 && ph < 0.74) { ctx.fillStyle = `rgba(255,140,60,${((1 - Math.abs(ph - 0.68) / 0.06) * 0.12).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh); }
            return;
        }
        const L = this.light;
        if (L.c.width !== vw || L.c.height !== vh) { L.c.width = vw; L.c.height = vh; }
        const g = L.g;
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, vw, vh);
        g.fillStyle = `rgba(${col},${dark})`;
        g.fillRect(0, 0, vw, vh);
        g.globalCompositeOperation = 'destination-out';
        const hole = (x, y, r, a = 1) => {
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        };
        const px = ox + G.p.x * TILE, py = oy + G.p.y * TILE - 8;
        if (M.dark) hole(px, py, G.books.includes('lumen') ? 78 : 26, 1);
        else hole(px, py, 30, 0.5);
        for (const [x, y, c] of lights) if (c) hole(x, y, c[3] * (1 + Math.sin(this.time * 3 + x) * 0.04), 0.95);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(L.c, 0, 0);
        // a warm bloom on the lights
        ctx.globalCompositeOperation = 'lighter';
        for (const [x, y, c] of lights) {
            if (!c) continue;
            const r = c[3] * 0.6;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.22 * dark).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}

function shadeHex(c, k) {
    const n = parseInt(c.slice(1), 16);
    const f = 1 - k * 0.12;
    const r = Math.round(((n >> 16) & 255) * f), gg = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return '#' + [r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
void ROOM;
