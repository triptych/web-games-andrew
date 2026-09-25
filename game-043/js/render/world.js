// ============================================================
// Draws the overworld or a dungeon floor: cached ground chunks,
// then objects/buildings/entities row by row (y-sorted), then
// light, weather and little effects.
// ============================================================

import { makeCanvas, h2 } from '../gen/art/core.js';
import { G, O, G_WATER } from '../data/tiles.js';
import { ITEM } from '../data/items.js';
import { BIOMES } from '../data/monsters.js';
import { cropStage, CROP } from '../data/crops.js';

export const T = 16;
const CH = 16;   // chunk size in tiles
const INTERACT = new Set([O.SIGN, O.LOTSIGN, O.BOARD, O.BIN, O.DUNGEON, O.CAVE, O.GLIMMER, O.HEART, O.PLACED, O.CHEST, O.LOCKED, O.FORAGE, O.UP, O.DOWN, O.FACADE]);

export class WorldRenderer {
    constructor(canvas, sprites) {
        this.cv = canvas; this.g = canvas.getContext('2d');
        this.sp = sprites;
        this.chunks = new Map();
        this.lc = makeCanvas(1, 1); this.lg = this.lc.getContext('2d');
        this.fx = []; this.floaters = []; this.weather = [];
        this.t = 0; this.shake = 0;
    }
    setGame(game) {
        this.game = game; this.chunks.clear();
        game.on('tile', i => this.invalidate(i));
        game.on('tiles', () => this.chunks.clear());
        game.on('newday', () => this.chunks.clear());
        game.on('mapchange', () => { this.fx = []; this.floaters = []; });
        game.on('heartwood', () => this.chunks.clear());
        game.on('pickup', ({ id, n }) => this.floaters.push({ id, n, t: 0, x: game.p.x, y: game.p.y - 1.4 - this.floaters.filter(f => f.t < 0.3).length * 0.5 }));
        game.on('hit', ({ i, o }) => this.burst(i, o));
        game.on('broke', ({ i, o }) => { this.burst(i, o, 9); });
    }
    resize(w, h) { this.W = w; this.H = h; this.lc.width = w; this.lc.height = h; }
    mapKey() { const m = this.game.map; return m === this.game.world ? 'w' : `${m.site}:${m.floor}`; }
    invalidate(i) {
        const m = this.game.map;
        const x = i % m.W, y = (i / m.W) | 0;
        for (const k of [...this.chunks.keys()]) if (k.startsWith(this.mapKey() + ':' + ((x / CH) | 0) + ':' + ((y / CH) | 0) + ':')) this.chunks.delete(k);
    }
    burst(i, o, n = 4) {
        const m = this.game.map, x = i % m.W + 0.5, y = ((i / m.W) | 0) + 0.5;
        const col = [O.TREE, O.PINE, O.STUMP, O.BUSH, O.DEADTREE].includes(o) ? ['#8a5a32', '#5f9a4a'] : [O.WEED, O.TUFT].includes(o) ? ['#6fae5f', '#a8d080'] : ['#9a948c', '#6c6660'];
        for (let k = 0; k < n; k++) this.fx.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4 - 1, t: 0, life: 0.5 + Math.random() * 0.3, c: col[k % 2] });
    }

    // ------------------------------------------------------------ ground chunks
    chunk(cx, cy) {
        const game = this.game, m = game.map, season = m === game.world ? game.season : 0;
        const key = `${this.mapKey()}:${cx}:${cy}:${season}:${game.s.heartwood}`;
        let c = this.chunks.get(key);
        if (c) return c;
        c = makeCanvas(CH * T, CH * T);
        const g = c.getContext('2d');
        const inWorld = m === game.world;
        for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
            const x = cx * CH + tx, y = cy * CH + ty;
            if (x >= m.W || y >= m.H) continue;
            const i = y * m.W + x;
            let gr = m.ground[i];
            const rg = inWorld ? (m.region[i] === 255 ? this.nearRegion(i) : m.region[i]) : m.region;
            const v = (h2(x, y, 5) * 4) | 0;
            g.drawImage(this.sp.ground(gr, rg, season, v), tx * T, ty * T);
            this.edges(g, m, x, y, tx * T, ty * T, gr, inWorld);
        }
        this.chunks.set(key, c);
        return c;
    }
    nearRegion(i) {
        const m = this.game.world, x = i % m.W, y = (i / m.W) | 0;
        const dx = x - m.cx, dy = y - m.cy;
        if (Math.hypot(dx, dy) < 32) return 1;
        const a = Math.atan2(dy, dx);
        let best = 1, bd = 9;
        for (const R of m.regions) { const d = Math.abs(((a - R.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = R.idx; } }
        return best;
    }
    edges(g, m, x, y, px, py, gr, inWorld) {
        const at = (dx, dy) => { const X = x + dx, Y = y + dy; return X < 0 || Y < 0 || X >= m.W || Y >= m.H ? gr : m.ground[Y * m.W + X]; };
        if (G_WATER.has(gr) || gr === G.LAVA) {
            const lava = gr === G.LAVA;
            g.fillStyle = lava ? 'rgba(60,20,10,0.7)' : 'rgba(235,225,180,0.85)';
            const land = t => !G_WATER.has(t) && t !== G.LAVA && t !== G.BRIDGE;
            if (land(at(0, -1))) g.fillRect(px, py, T, 2);
            if (land(at(0, 1))) g.fillRect(px, py + T - 2, T, 2);
            if (land(at(-1, 0))) g.fillRect(px, py, 2, T);
            if (land(at(1, 0))) g.fillRect(px + T - 2, py, 2, T);
            if (!lava && land(at(0, -1))) { g.fillStyle = 'rgba(40,70,100,0.35)'; g.fillRect(px, py + 2, T, 3); }
        } else if (gr === G.CLIFF && inWorld) {
            if (at(0, 1) !== G.CLIFF) { g.fillStyle = 'rgba(30,20,20,0.45)'; g.fillRect(px, py + 9, T, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < T; k += 4) g.fillRect(px + k, py + 10, 1, 6); }
            if (at(0, -1) !== G.CLIFF) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px, py, T, 2); }
        } else if (gr === G.WALL) {
            if (at(0, 1) === G.WALL || at(0, 1) === undefined) { g.fillStyle = 'rgba(10,6,14,0.75)'; g.fillRect(px, py, T, T); }
            else { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px, py, T, 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py + T - 3, T, 3); }
        } else if (gr === G.PATH || gr === G.PLAZA) {
            // soften the path edge with a few grass pixels
            const grassy = t => t === G.GRASS || t === G.GRASS2;
            g.fillStyle = 'rgba(80,120,60,0.35)';
            if (grassy(at(0, -1))) for (let k = 0; k < T; k += 3) g.fillRect(px + k, py, 2, 1 + (k % 2));
            if (grassy(at(0, 1))) for (let k = 1; k < T; k += 3) g.fillRect(px + k, py + T - 1 - (k % 2), 2, 1 + (k % 2));
        }
        if (inWorld && gr !== G.CLIFF && gr !== G.WATER && at(0, -1) === G.CLIFF) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px, py, T, 4); }
    }

    // ------------------------------------------------------------ frame
    draw(dt) {
        const game = this.game, g = this.g, m = game.map, p = game.p;
        this.t += dt;
        const W = this.W, H = this.H;
        // camera (clamped to the map, pixel aligned)
        let camX = p.x * T - W / 2, camY = (p.y - 0.5) * T - H / 2;
        camX = Math.max(0, Math.min(m.W * T - W, camX)); camY = Math.max(0, Math.min(m.H * T - H, camY));
        if (m.W * T < W) camX = (m.W * T - W) / 2;
        if (m.H * T < H) camY = (m.H * T - H) / 2;
        if (this.shake > 0) { this.shake -= dt; camX += (Math.random() - 0.5) * 3; camY += (Math.random() - 0.5) * 3; }
        camX = Math.round(camX); camY = Math.round(camY);
        this.cam = { x: camX, y: camY };
        g.fillStyle = m === game.world ? '#1d2a1a' : '#08060c';
        g.fillRect(0, 0, W, H);
        // ground
        const cx0 = Math.max(0, Math.floor(camX / (CH * T))), cy0 = Math.max(0, Math.floor(camY / (CH * T)));
        const cx1 = Math.floor((camX + W) / (CH * T)), cy1 = Math.floor((camY + H) / (CH * T));
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
            if (cx * CH >= m.W || cy * CH >= m.H) continue;
            g.drawImage(this.chunk(cx, cy), cx * CH * T - camX, cy * CH * T - camY);
        }
        const tx0 = Math.max(0, Math.floor(camX / T) - 2), ty0 = Math.max(0, Math.floor(camY / T) - 1);
        const tx1 = Math.min(m.W - 1, Math.ceil((camX + W) / T) + 2), ty1 = Math.min(m.H - 1, Math.ceil((camY + H) / T) + 4);
        this.animatedGround(tx0, ty0, tx1, ty1, camX, camY);
        // soil
        if (m === game.world) {
            for (const [k, t] of Object.entries(game.s.world.tilled)) {
                const i = +k, x = i % m.W, y = (i / m.W) | 0;
                if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
                g.drawImage(this.sp.soil(t.w), x * T - camX, y * T - camY);
            }
        }
        // entity buckets by row
        const rows = new Map();
        const put = (y, fn) => { const r = Math.floor(y - 0.001); let a = rows.get(r); if (!a) rows.set(r, a = []); a.push({ y, fn }); };
        this.collectEntities(put);
        // objects + entities, row by row
        const bRows = new Map();
        if (m === game.world) for (const b of game.buildings) { const r = b.y + b.h - 1; if (r >= ty0 - 1 && b.y <= ty1 + 4 && b.x + b.w >= tx0 && b.x <= tx1) { (bRows.get(r) ?? bRows.set(r, []).get(r)).push(b); } }
        for (let y = ty0; y <= ty1; y++) {
            for (const b of bRows.get(y) ?? []) this.drawBuilding(b, camX, camY);
            for (let x = tx0; x <= tx1; x++) {
                const i = y * m.W + x;
                if (m === game.world) { const c = game.s.world.crops[i]; if (c) { const st = cropStage(CROP[c.id], c.age); g.drawImage(this.sp.crop(c.id, st), x * T - camX, y * T - 4 - camY + (st === 3 ? Math.round(Math.sin(this.t * 2 + x) * 0.5) : 0)); } }
                const o = m.obj[i];
                if (o) this.drawObj(o, i, x, y, camX, camY);
            }
            const ents = rows.get(y);
            if (ents) { ents.sort((a, b) => a.y - b.y); for (const e of ents) e.fn(camX, camY); }
        }
        this.drawFx(dt, camX, camY);
        this.drawLight(camX, camY);
        this.drawWeather(dt);
        this.drawPrompt(camX, camY);
    }

    animatedGround(tx0, ty0, tx1, ty1, camX, camY) {
        const g = this.g, m = this.game.map;
        for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
            const gr = m.ground[y * m.W + x];
            if (gr === G.WATER) {
                const ph = (this.t * 1.3 + h2(x, y, 1) * 6) % 6;
                if (ph < 1.4) { g.fillStyle = 'rgba(255,255,255,0.35)'; const k = Math.floor(ph * 3); g.fillRect(x * T - camX + 3 + k * 2, y * T - camY + 5 + (h2(x, y, 2) * 7 | 0), 3, 1); }
            } else if (gr === G.LAVA) {
                const a = 0.15 + Math.sin(this.t * 2 + h2(x, y, 3) * 6) * 0.1;
                g.fillStyle = `rgba(255,220,90,${a.toFixed(3)})`; g.fillRect(x * T - camX, y * T - camY, T, T);
            }
        }
    }

    drawObj(o, i, x, y, camX, camY) {
        const game = this.game, m = game.map, g = this.g;
        const inWorld = m === game.world;
        const rg = inWorld ? m.region[i] : m.region;
        const season = inWorld ? game.season : 0;
        const v = m.ov[i];
        let s = null;
        const px = x * T - camX, py = y * T - camY;
        switch (o) {
            case O.HEART: {
                const H = game.world.glen.heart;
                if (x === H.x && y === H.y + 3) { const c = this.sp.heart(game.s.heartwood, season); g.drawImage(c, H.x * T - 8 - camX, (H.y + 4) * T - c.height - camY); }
                return;
            }
            case O.FACADE: return;
            case O.DUNGEON: case O.CAVE: { const c = this.sp.facade(o === O.DUNGEON ? 'dungeon' : 'cave', rg); g.drawImage(c, px - T, py + T - c.height); if (o === O.DUNGEON && inWorld && game.s.village.level < v) { g.fillStyle = `rgba(200,230,255,${0.25 + Math.sin(this.t * 2) * 0.1})`; g.fillRect(px, py - 12, T, 28); } return; }
            case O.GLIMMER: {
                const gl = game.glimmerAt(i); if (!gl) return;
                const awake = game.glimmerAwake(gl);
                if (!awake) { this.twinkle(px, py, i); return; }
                const used = !!game.s.world.glimmers[gl.id] || game.s.moonwell[gl.id] === game.day;
                s = this.sp.glimmer(gl.kind, true, used);
                const bob = ['acorn', 'starfruit', 'scroll'].includes(gl.kind) ? Math.round(Math.sin(this.t * 3 + i) * 1.5) : 0;
                g.drawImage(s.c, px + s.ox, py + s.oy + bob);
                if (!used && (this.t * 2 + i) % 3 < 0.2) this.fx.push({ x: x + 0.5 + (Math.random() - 0.5), y: y + 0.4, vx: 0, vy: -1, t: 0, life: 0.8, c: '#fff6b0' });
                return;
            }
            case O.FORAGE: { const f = game.world.forage[v]; const id = f ? game.forageItem(f) : 'wild_berry'; const c = this.sp.item(id); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(px + 4, py + 12, 8, 2); g.drawImage(c, px, py - 2 + Math.round(Math.sin(this.t * 2 + i) * 1)); return; }
            case O.PLACED: {
                const pl = game.s.world.placed[i]; if (!pl) return;
                const night = game.s.time.min >= 18 * 60;
                const st = game.s.stations['p' + i];
                const busy = st?.queue?.length > 0;
                s = this.sp.obj(o, 0, rg, 0, { item: pl.id, night, busy }, pl.id + (night ? 'n' : '') + (busy ? 'b' : ''));
                break;
            }
            case O.ORE: s = this.sp.obj(o, v, rg, season, {}, ''); break;
            case O.GEM: { const gems = BIOMES[Math.max(0, rg - 1)].gem; s = this.sp.obj(o, v, rg, 0, { gem: gems[v % gems.length] }, gems[v % gems.length]); break; }
            case O.CHEST: { const open = !inWorld && m.opened?.has(i); const special = !inWorld && m.special?.i === i; s = this.sp.obj(o, 0, rg, 0, { open, special }, `${open}${special}`); break; }
            case O.LOTSIGN: s = this.sp.obj(o, 0, 0, 0, { locked: !game.lotUnlocked(v) }, game.lotUnlocked(v) ? 'u' : 'l'); break;
            case O.BOARD: { const built = game.s.village.board; const posts = Math.min(6, game.s.board.postings.length); s = this.sp.obj(o, 0, 0, 0, { built, posts }, `${built}${posts}`); break; }
            case O.TORCH: case O.DARK: { const f = Math.floor(this.t * 5 + i) % 2; s = this.sp.obj(o, 0, rg, 0, { frame: f }, 'f' + f); break; }
            default: s = this.sp.obj(o, v % 6, rg, season, {}, '');
        }
        if (!s) return;
        let wob = 0;
        const hits = game.rt.hits.get(i);
        if (hits) wob = Math.round(Math.sin(this.t * 40) * 1);
        g.drawImage(s.c, px + s.ox + wob, py + s.oy);
    }
    twinkle(px, py, i) {
        const game = this.game;
        const d = Math.hypot(game.p.x - (px + this.cam.x) / T - 0.5, game.p.y - (py + this.cam.y) / T - 0.5);
        if (d > 3.2) return;
        const g = this.g;
        const a = (1 - d / 3.2) * (0.5 + 0.5 * Math.sin(this.t * 4 + i));
        g.fillStyle = `rgba(255,250,210,${a.toFixed(3)})`;
        for (let k = 0; k < 3; k++) { const t = this.t * 1.5 + k * 2.1; g.fillRect(px + 8 + Math.cos(t) * 5 | 0, py + 6 + Math.sin(t * 1.3) * 5 | 0, 1, 1); }
    }
    drawBuilding(b, camX, camY) {
        const game = this.game, g = this.g;
        const night = game.s.time.min >= 18 * 60 || game.s.time.min < 7 * 60;
        let c;
        if (b.type === 'hall') c = this.sp.building('hall', { shape: game.s.village.level <= 1 ? 'tent' : 'hall', roof: 205, wall: 40, night });
        else if (b.type === 'cabin') c = this.sp.building('cabin', { roof: 355, wall: 32, night, chimney: true });
        else c = this.sp.building(b.type, { night, construction: game.s.movingIn[this.jobOf(b.type)] !== undefined && b.built === game.day });
        g.drawImage(c, b.x * T - camX, (b.y + b.h) * T - c.height - camY);
        // chimney smoke
        if (['cabin', 'cafe', 'forge', 'farmhouse', 'tavern'].includes(b.type) && (this.t * 10 | 0) % 7 === 0) this.fx.push({ x: b.x + 3.3, y: b.y - 1.9, vx: 0.3, vy: -0.8, t: 0, life: 1.6, c: 'rgba(230,230,230,0.6)', r: 2 });
    }
    jobOf(type) { return { workshop: 'carpenter', farmhouse: 'farmer', forge: 'blacksmith', ranch: 'rancher', cafe: 'cook', apothecary: 'herbalist', store: 'merchant', loft: 'tailor', lodge: 'miner', tower: 'guard', library: 'scholar', tavern: 'bard' }[type]; }

    // ------------------------------------------------------------ entities
    collectEntities(put) {
        const game = this.game, p = game.p, rt = game.rt, g = this.g;
        const walkFrame = (moving, t) => (moving ? (Math.floor(t * 7) % 2 ? 1 : 2) : 0);
        const shadow = (x, y, w = 5) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y - 1, w, 2, 0, 0, Math.PI * 2); g.fill(); };
        // player
        put(p.y, (cx, cy) => {
            const x = Math.round(p.x * T - cx), y = Math.round(p.y * T - cy);
            shadow(x, y);
            const frame = rt.swing > 0 ? 3 : walkFrame(rt.moving, rt.anim);
            g.drawImage(this.sp.person(p.look, p.dir, frame), x - 8, y - 20);
            if (rt.swing > 0) this.drawSwing(x, y);
        });
        // companion
        if (rt.companion && game.people[rt.companion.job]) {
            const c = rt.companion;
            put(c.y, (cx, cy) => { const x = Math.round(c.x * T - cx), y = Math.round(c.y * T - cy); shadow(x, y); g.drawImage(this.sp.person(game.people[c.job].look, c.dir, walkFrame(c.walk > 0, c.walk)), x - 8, y - 20); });
        }
        // NPCs
        if (game.inWorld) for (const n of Object.values(rt.npcs)) {
            if (n.hidden) continue;
            if (n.id === 'glim') {
                put(n.y, (cx, cy) => {
                    const x = Math.round(n.x * T - cx), y = Math.round(n.y * T - cy - 14 + Math.sin(this.t * 3) * 2);
                    g.fillStyle = 'rgba(180,255,230,0.18)'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
                    g.drawImage(this.sp.glim(Math.floor(this.t * 4) % 2), x - 6, y - 6);
                    if (!game.s.quests.flags.met_glim && game.s.quests.flags.met_mayor) this.marker(x, y - 12, '!');
                });
                continue;
            }
            const look = n.id === 'mayor' ? game.mayor.look : game.people[n.id.replace('app_', '')]?.look;
            if (!look) continue;
            put(n.y, (cx, cy) => {
                const x = Math.round(n.x * T - cx), y = Math.round(n.y * T - cy);
                shadow(x, y);
                g.drawImage(this.sp.person(look, n.dir, walkFrame(n.walk > 0 && n.path?.length, n.walk)), x - 8, y - 20);
                let mk = null;
                if (n.id === 'mayor' && (game.s.village.levelReady || !game.s.quests.flags.met_mayor)) mk = game.s.village.levelReady ? '★' : '!';
                else if (n.id.startsWith('app_') && !game.s.villagers[n.id.slice(4)]?.met) mk = '?';
                else if (game.s.villagers[n.id] && game.storyState(n.id).available) mk = '✦';
                if (mk) this.marker(x, y - 24, mk);
            });
        }
        // animals
        if (game.inWorld) for (const a of rt.animals) {
            put(a.y, (cx, cy) => { const x = Math.round(a.x * T - cx), y = Math.round(a.y * T - cy); shadow(x, y, 4); g.drawImage(this.sp.animal(a.kind, Math.abs(a.vx) + Math.abs(a.vy) > 0.1 ? Math.floor(this.t * 5) % 2 : 0, a.dir === 2), x - 8, y - 15); });
        }
        // monsters
        for (const mo of rt.monsters) {
            const sp = game.species[mo.sp]; if (!sp) continue;
            put(mo.y, (cx, cy) => {
                const size = sp.boss ? 32 : 16;
                const x = Math.round(mo.x * T - cx), y = Math.round(mo.y * T - cy);
                shadow(x, y, sp.boss ? 12 : 5);
                g.globalAlpha = mo.stun > 0 ? 0.5 + Math.sin(this.t * 20) * 0.3 : mo.fade;
                const bob = Math.round(Math.sin(this.t * (mo.chasing ? 10 : 4) + mo.x) * 1);
                const c = this.sp.monster(sp, Math.floor(this.t * 3 + mo.x) % 2);
                if (mo.dir === 2) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(c, -size / 2, y - size + bob); g.restore(); }
                else g.drawImage(c, x - size / 2, y - size + bob);
                g.globalAlpha = 1;
                if (mo.chasing && !sp.boss) this.marker(x, y - size - 6, '!', '#d2566b');
            });
        }
    }
    marker(x, y, ch, col = '#e0a832') {
        const g = this.g;
        const b = Math.round(Math.sin(this.t * 5) * 1.5);
        g.fillStyle = col; g.strokeStyle = '#2d2418'; g.lineWidth = 1;
        g.beginPath(); g.arc(x, y + b, 5, 0, Math.PI * 2); g.fill(); g.stroke();
        this.ov?.text(x, y + b + 0.5, ch, { size: 9, stroke: null, base: 'middle' });
    }
    drawSwing(x, y) {
        const game = this.game, sel = game.selected();
        const id = sel && ['hoe', 'can', 'axe', 'pick', 'scythe'].includes(sel.id) ? sel.id : game.p.equip.weapon;
        const c = this.sp.item(id);
        const d = game.p.dir, k = 1 - game.rt.swing / 0.25;
        const off = [[4, -6], [-2, -22], [-14, -12], [8, -12]][d];
        this.g.save();
        this.g.translate(x + off[0] + 6, y + off[1] + 6);
        this.g.rotate((d === 2 ? -1 : 1) * (k * 1.6 - 0.8));
        this.g.drawImage(c, -6, -6, 12, 12);
        this.g.restore();
    }
    drawFx(dt, camX, camY) {
        const g = this.g;
        this.fx = this.fx.filter(f => (f.t += dt) < f.life);
        for (const f of this.fx) {
            f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.r ? -0.2 : 9) * dt;
            g.fillStyle = f.c;
            const s = f.r ? f.r + f.t * 2 : 1.5;
            g.globalAlpha = 1 - f.t / f.life;
            g.fillRect(Math.round(f.x * T - camX), Math.round(f.y * T - camY), s, s);
        }
        g.globalAlpha = 1;
        this.floaters = this.floaters.filter(f => (f.t += dt) < 1.2);
        for (const f of this.floaters) {
            const x = Math.round(f.x * T - camX), y = Math.round((f.y - f.t * 0.8) * T - camY);
            g.globalAlpha = Math.min(1, 2.4 - f.t * 2);
            g.drawImage(this.sp.item(f.id), x - 12, y - 6, 12, 12);
            this.ov?.text(x + 1, y, '+' + f.n, { size: 12, align: 'left', base: 'middle', alpha: Math.min(1, 2.4 - f.t * 2) });
        }
        g.globalAlpha = 1;
    }

    // ------------------------------------------------------------ light
    darkness() {
        const game = this.game;
        if (game.map !== game.world) return { a: 0.9, col: '6,4,10' };
        const m = game.s.time.min;
        let a = 0;
        if (m < 7 * 60) a = 0.35 * (1 - (m - 360) / 60);
        else if (m >= 17 * 60 + 30) a = Math.min(0.62, (m - (17 * 60 + 30)) / 180 * 0.62);
        if (game.s.weather === 'storm') a = Math.max(a, 0.28); else if (game.s.weather === 'rain') a = Math.max(a, 0.15);
        const dusk = m >= 17 * 60 + 30 && m < 19 * 60 + 30;
        return { a, col: dusk ? '60,24,40' : '12,18,48' };
    }
    drawLight(camX, camY) {
        const game = this.game, { a, col } = this.darkness();
        if (a <= 0.01) return;
        const lg = this.lg, W = this.W, H = this.H;
        lg.globalCompositeOperation = 'source-over';
        lg.clearRect(0, 0, W, H);
        lg.fillStyle = `rgba(${col},${a.toFixed(3)})`;
        lg.fillRect(0, 0, W, H);
        lg.globalCompositeOperation = 'destination-out';
        const hole = (x, y, r, k = 1) => {
            const gr = lg.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(0.6, `rgba(0,0,0,${k * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
            lg.fillStyle = gr; lg.beginPath(); lg.arc(x, y, r, 0, Math.PI * 2); lg.fill();
        };
        const p = game.p, m = game.map;
        const inWorld = m === game.world;
        const pr = inWorld ? 3.5 : (game.hasRelic('lantern') ? 6.5 : 3.6);
        hole(p.x * T - camX, (p.y - 0.5) * T - camY, pr * T, inWorld ? 0.7 : 1);
        const tx0 = Math.max(0, Math.floor(camX / T) - 6), ty0 = Math.max(0, Math.floor(camY / T) - 6);
        const tx1 = Math.min(m.W - 1, Math.ceil((camX + W) / T) + 6), ty1 = Math.min(m.H - 1, Math.ceil((camY + H) / T) + 6);
        for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
            const i = y * m.W + x, o = m.obj[i];
            if (o === O.TORCH) hole(x * T + 8 - camX, y * T + 6 - camY, 3.2 * T, 0.95);
            else if (o === O.PLACED && game.s.world.placed[i]?.id === 'lamp') hole(x * T + 8 - camX, y * T - 4 - camY, 3.5 * T, 0.9);
            else if (o === O.GLIMMER && game.glimmerAwakeAt(i)) hole(x * T + 8 - camX, y * T + 8 - camY, 1.6 * T, 0.6);
            else if (o === O.UP || o === O.DOWN) hole(x * T + 8 - camX, y * T + 8 - camY, 1.2 * T, 0.5);
        }
        if (inWorld) {
            for (const b of game.buildings) hole((b.x + 2) * T - camX, (b.y + 2.3) * T - camY, 2.6 * T, 0.7);
            const H2 = game.world.glen.heart;
            if (game.s.heartwood) hole((H2.x + 2) * T - camX, (H2.y + 1) * T - camY, (1.5 + game.s.heartwood) * T, 0.35 + game.s.heartwood * 0.1);
            for (const n of Object.values(game.rt.npcs)) if (n.id === 'glim' && !n.hidden) hole(n.x * T - camX, (n.y - 1) * T - camY, 1.6 * T, 0.8);
        }
        this.g.drawImage(this.lc, 0, 0);
    }
    drawWeather(dt) {
        const game = this.game;
        if (game.map !== game.world) return;
        const w = game.s.weather, g = this.g;
        if (w === 'sun') { this.weather = []; return; }
        const want = w === 'snow' ? 70 : w === 'storm' ? 130 : 90;
        while (this.weather.length < want) this.weather.push({ x: Math.random() * this.W, y: Math.random() * this.H, s: 0.6 + Math.random() * 0.6 });
        g.fillStyle = w === 'snow' ? 'rgba(255,255,255,0.85)' : 'rgba(190,210,255,0.55)';
        for (const d of this.weather) {
            if (w === 'snow') { d.y += 22 * d.s * dt; d.x += Math.sin(this.t + d.s * 9) * 10 * dt; g.fillRect(d.x | 0, d.y | 0, 1 + (d.s > 1 ? 1 : 0), 1 + (d.s > 1 ? 1 : 0)); }
            else { d.y += 220 * d.s * dt; d.x -= 40 * d.s * dt; g.fillRect(d.x | 0, d.y | 0, 1, 4); }
            if (d.y > this.H) { d.y = -4; d.x = Math.random() * (this.W + 40); }
        }
        if (w === 'storm' && (this.t % 9) < 0.08) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, this.W, this.H); }
    }
    /** A small "A" bubble over whatever the action button would use. */
    drawPrompt(camX, camY) {
        const game = this.game;
        if (game.rt.battle) return;
        const f = game.facingTile();
        const m = game.map;
        let show = false, px = f.x, py = f.y;
        const npc = game.npcNear(f.x + 0.5, f.y + 0.5, 0.95);
        if (npc) { show = true; px = npc.x - 0.5; py = npc.y - 1.6; }
        else if (game.buildingAt(f.x + 0.5, f.y + 0.5)) show = true;
        else if (INTERACT.has(m.obj[f.i])) show = m.obj[f.i] !== O.GLIMMER || game.glimmerAwakeAt(f.i) || true;
        else if (m === game.world && game.s.world.crops[f.i] && game.cropStageAt(f.i) === 3) show = true;
        const sel = game.selected();
        if (sel && ['hoe', 'can'].includes(sel.id) || sel && ITEM[sel.id]?.cat === 'seed') {
            const g = this.g; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.strokeRect(f.x * T - camX + 0.5, f.y * T - camY + 0.5, T - 1, T - 1);
        }
        if (!show) return;
        const g = this.g;
        const x = Math.round(px * T - camX + 8), y = Math.round(py * T - camY - 5 + Math.sin(this.t * 4) * 1.5);
        g.fillStyle = 'rgba(79,138,74,0.95)'; g.strokeStyle = '#2d2418';
        g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.stroke();
        this.ov?.text(x, y + 0.5, 'A', { size: 8, stroke: null, base: 'middle' });
    }
}
