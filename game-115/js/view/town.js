// The town as three.js objects: terrain, wild nodes (instanced), buildings, and the people who walk
// around. It reads the game every frame and never writes to it. Sim (x, y) on the map is world
// (x, 0, y): x to the right, y (z in three.js) toward the camera.

import * as THREE from 'three';
import { MAP, WALK_SPEED } from '../config.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { ITEMS } from '../sim/data/items.js';
import { NODE_KINDS } from '../sim/world.js';
import { hash3 } from '../rng.js';
import { seasonOf, hourOf, locPos, hall as hallOf, isNight } from '../sim/core.js';
import { Terrain } from './terrain.js';
import { Nav, roadTiles } from './nav.js';
import { tex, spriteMaterial, spriteGeometry, LEAN } from './stage.js';
import { paintBuilding, paintScaffold, paintBlades } from './buildings.js';
import { tree, rock, plant, stump, shadowTex, glowTex } from './nature.js';
import { charStrip, heroLook, villagerLook, heroKey, villagerKey, FW, FH, FRAMES, FRAME } from './chars.js';
import { canvas, ctx2, INK, box, poly, circle, ellipse, line, softShadow, PX } from './paint.js';

const CHAR_H = 1.2, CHAR_W = CHAR_H * FW / FH;
const NIGHT_LIGHT = { tavern: 1, inn: 1, guild: 0.8, hall: 0.8, itemshop: 0.7, smithy: 0.9, alchemist: 0.7, library: 0.6, healer: 0.6, house: 0.45, lantern: 1.3, market: 0.4, mine: 0.6, stables: 0.3 };

const lcg = (...a) => hash3(a[0] | 0, a[1] | 0, a[2] | 0);

function cartCanvas() {
    const c = canvas(PX * 1.5, PX * 1.1), g = ctx2(c);
    const by = c.height - 10, cx = c.width / 2;
    softShadow(g, cx, by, 54, 8, 0.3);
    box(g, cx - 40, by - 36, 80, 26, '#9a6a3a', 3, INK, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#d94a4a'; g.beginPath(); g.moveTo(cx - 44 + i * 15, by - 78); g.lineTo(cx - 29 + i * 15, by - 78); g.lineTo(cx - 29 + i * 15, by - 52); g.lineTo(cx - 44 + i * 15, by - 52); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(cx - 44, by - 78, 90, 26);
    for (const s of [-1, 1]) line(g, cx + s * 40, by - 52, cx + s * 40, by - 14, '#5a3d28', 4);
    circle(g, cx - 28, by - 10, 11, '#5a3d28', INK, 2); circle(g, cx + 28, by - 10, 11, '#5a3d28', INK, 2);
    for (const [x, col] of [[-26, '#e6d6a8'], [-8, '#e04a3a'], [10, '#7bbf4c'], [28, '#f2d046']]) circle(g, cx + x, by - 40, 8, col, INK, 1.4);
    return c;
}
function ringCanvas() {
    const c = canvas(128, 128), g = ctx2(c);
    g.strokeStyle = 'rgba(255,214,90,0.95)'; g.lineWidth = 7; g.setLineDash([16, 10]);
    g.beginPath(); g.roundRect(8, 8, 112, 112, 26); g.stroke();
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.roundRect(8, 8, 112, 112, 26); g.stroke();
    return c;
}

class Walker {
    constructor(kind, id) {
        this.kind = kind; this.id = id; this.key = '';
        this.x = 0; this.y = 0; this.path = null; this.pi = 0; this.gx = -99; this.gy = -99; this.navv = -1;
        this.alpha = 0; this.target = 1; this.face = 1; this.t = Math.random() * 10; this.mode = 'idle';
        this.wanderT = 0; this.wx = 0; this.wy = 0; this.moving = false; this.placed = false; this.inside = null;
        this.phase = 0; this.phaseT = 0;
    }
}

export class Town {
    constructor(stage, fx, quality) {
        this.stage = stage;
        this.fx = fx;
        this.quality = quality;
        this.group = new THREE.Group();
        this.nav = new Nav();
        this.terrain = new Terrain(stage, quality);
        this.group.add(this.terrain.group);
        this.geo = spriteGeometry();
        this.nodeMeshes = new Map();
        this.bmap = new Map();
        this.walkers = new Map();
        this.texCache = new Map();
        this.season = -1;
        this.nodeT = 0; this.nodeDirty = true; this.wobble = new Map();
        this.layoutSig = '';
        this.roads = new Set();
        this.pop = new Map();
        this.insideCount = new Map();
        this.smokeT = 0;
        this.sel = null;
        this.speed = 1;
        this.nodeSlots = new Map();
        this.buildExtras();
    }

    // ---------------------------------------------------------------- decals: shadows, light pools, ring, ghost
    buildExtras() {
        const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
        this.shadowGeo = flat;
        const sm = new THREE.MeshBasicMaterial({ map: tex(shadowTex(), { mip: false }), transparent: true, depthWrite: false, opacity: 0.8 });
        this.shadows = new THREE.InstancedMesh(flat, sm, 200);
        this.shadows.frustumCulled = false; this.shadows.renderOrder = 2; this.shadows.count = 0;
        const gm = new THREE.MeshBasicMaterial({ map: tex(glowTex(), { mip: false }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb860, opacity: 0 });
        this.pools = new THREE.InstancedMesh(flat, gm, 160);
        this.pools.frustumCulled = false; this.pools.renderOrder = 3; this.pools.count = 0;
        const rm = new THREE.MeshBasicMaterial({ map: tex(ringCanvas(), { mip: false }), transparent: true, depthWrite: false });
        this.ring = new THREE.Mesh(flat, rm); this.ring.renderOrder = 4; this.ring.visible = false;
        const tm = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.5 });
        this.tiles = new THREE.InstancedMesh(flat, tm, 80);
        this.tiles.frustumCulled = false; this.tiles.renderOrder = 4; this.tiles.count = 0;
        this.tiles.setColorAt(0, new THREE.Color(1, 1, 1));
        this.group.add(this.shadows, this.pools, this.ring, this.tiles);
        this.dummy = new THREE.Object3D();
        // the merchant's cart
        const cm = spriteMaterial(this.stage.shared, tex(cartCanvas()), {});
        this.cart = new THREE.Mesh(this.geo, cm);
        this.cart.rotation.x = -LEAN; this.cart.scale.set(1.5, 1.1, 1); this.cart.visible = false;
        this.group.add(this.cart);
        this.ghost = null;
    }

    texFor(canvasEl, opts, key) {
        let t = this.texCache.get(key);
        if (!t) { t = tex(canvasEl, opts); this.texCache.set(key, t); }
        return t;
    }

    /** A different game was loaded: forget every per-game object. */
    reset() {
        for (const e of this.bmap.values()) { this.group.remove(e.mesh); if (e.scaf) this.group.remove(e.scaf); if (e.blades) this.group.remove(e.blades); }
        this.bmap.clear();
        for (const w of this.walkers.values()) this.group.remove(w.mesh);
        this.walkers.clear();
        this.layoutSig = ''; this.terrain.sig = ''; this.nodeDirty = true; this.wobble.clear(); this.pop.clear();
    }

    // ---------------------------------------------------------------- the layout (nav, roads, ground)
    refreshLayout(G, season) {
        const sig = G.buildings.map((b) => `${b.id}:${b.x},${b.y},${b.lv}`).join(';') + '|' + G.bounds.x0 + '|' + G.nodes.length + '|' + season;
        if (sig === this.layoutSig && this.terrain.sig) return;
        this.layoutSig = sig;
        this.nav.rebuild(G);
        this.roads = roadTiles(G, this.nav);
        this.terrain.update(G, this.roads, season);
        this.nodeDirty = true;
    }

    // ---------------------------------------------------------------- wild nodes (instanced)
    nodeKey(n) {
        if (n.k === 'tree') return n.regrow > 0 ? 'stump' : `tree${n.v % 4}`;
        if (n.k === 'rock') return n.regrow > 0 ? null : `rock${n.v % 4}`;
        return `${n.k}:${n.regrow > 0 ? 0 : 1}`;
    }
    nodeSprite(key, season, v) {
        if (key === 'stump') return stump();
        if (key.startsWith('tree')) return tree(+key.slice(4), season);
        if (key.startsWith('rock')) return rock(+key.slice(4), season);
        const [k, full] = key.split(':');
        return plant(k, full === '1', season, v);
    }
    syncNodes(G, season, dt) {
        this.nodeT -= dt;
        const regrowing = G.nodes.some((n) => n.regrow > 0);
        if (!this.nodeDirty && this.nodeT > 0) return;
        this.nodeT = regrowing ? 0.5 : 2;
        this.nodeDirty = false;
        const groups = new Map();
        for (const n of G.nodes) {
            const key = this.nodeKey(n);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(n);
        }
        this.nodeSlots.clear();
        for (const [key, list] of groups) {
            let rec = this.nodeMeshes.get(key);
            const sp = this.nodeSprite(key, season, 0);
            if (!rec || rec.cap < list.length) {
                if (rec) { this.group.remove(rec.mesh); rec.mesh.dispose(); }
                const mat = spriteMaterial(this.stage.shared, this.texFor(sp.c, {}, `n:${key}:${season}`), { instanced: true, sway: key.startsWith('tree') && !key.includes('stump') ? 0.05 : key.startsWith('flax') ? 0.04 : 0 });
                const mesh = new THREE.InstancedMesh(this.geo, mat, Math.max(16, Math.ceil(list.length * 1.3)));
                mesh.frustumCulled = false;
                this.group.add(mesh);
                rec = { mesh, cap: mesh.count = mesh.instanceMatrix.count, season };
                this.nodeMeshes.set(key, rec);
            }
            if (rec.season !== season) { rec.mesh.material.uniforms.map.value = this.texFor(sp.c, {}, `n:${key}:${season}`); rec.season = season; }
            rec.mesh.count = list.length;
            list.forEach((n, i) => { this.setNode(rec.mesh, i, n, sp, 0); this.nodeSlots.set(n.id, { mesh: rec.mesh, i, sp }); });
            rec.mesh.instanceMatrix.needsUpdate = true;
        }
        // groups that emptied out
        for (const [key, rec] of this.nodeMeshes) if (!groups.has(key)) rec.mesh.count = 0;
    }
    setNode(mesh, i, n, sp, wob) {
        const d = this.dummy;
        const sc = 0.92 + lcg(n.x, n.y, 3) * 0.2;
        d.position.set(n.x + 0.5 + n.ox, -0.02, n.y + 0.72 + n.oy);
        d.rotation.set(-LEAN, 0, wob);
        d.scale.set(sp.w * sc, sp.h * sc, 1);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
    }
    tickWobble(G, dt) {
        for (const [id, w] of this.wobble) {
            w.t -= dt;
            const slot = this.nodeSlots.get(id);
            const n = G.nodes.find((x) => x.id === id);
            if (slot && n) { this.setNode(slot.mesh, slot.i, n, slot.sp, w.t > 0 ? Math.sin(w.t * 38) * 0.09 * (w.t / 0.35) : 0); slot.mesh.instanceMatrix.needsUpdate = true; }
            if (w.t <= 0) this.wobble.delete(id);
        }
    }

    // ---------------------------------------------------------------- buildings
    syncBuildings(G, dt, time, ui) {
        const alive = new Set();
        const lights = [];
        for (const b of G.buildings) {
            alive.add(b.id);
            const d = BUILDINGS[b.type];
            let e = this.bmap.get(b.id);
            const lvShow = Math.max(1, b.lv);
            if (!e) {
                e = { b, mesh: new THREE.Mesh(this.geo, null), scaf: null, lv: -1, blades: null, smokeT: Math.random() * 3 };
                e.mesh.rotation.x = -LEAN;
                this.group.add(e.mesh);
                this.bmap.set(b.id, e);
            }
            e.b = b;
            if (e.lv !== lvShow) {
                const s = paintBuilding(b.type, lvShow);
                e.sprite = s;
                const old = e.mesh.material;
                e.mesh.material = spriteMaterial(this.stage.shared, this.texFor(s.c, {}, `b:${b.type}:${lvShow}`), { emi: this.texFor(s.e, {}, `be:${b.type}:${lvShow}`) });
                if (old) old.dispose();
                e.mesh.scale.set(s.w, s.h, 1);
                e.lv = lvShow;
                if (b.type === 'mill') {
                    if (!e.blades) { e.blades = new THREE.Group(); e.blades.rotation.x = -LEAN; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spriteMaterial(this.stage.shared, this.texFor(paintBlades(lvShow), {}, `bl:${lvShow}`), {})); m.name = 'b'; e.blades.add(m); this.group.add(e.blades); }
                    else e.blades.children[0].material.uniforms.map.value = this.texFor(paintBlades(lvShow), {}, `bl:${lvShow}`);
                    e.blades.children[0].scale.set(190 / PX, 190 / PX, 1);
                }
            }
            const s = e.sprite;
            const cx = b.x + d.w / 2, cz = b.y + d.h - 0.2;
            const pop = this.pop.get(b.id);
            let sc = 1;
            if (pop) { pop.t -= dt; sc = 1 + Math.sin(Math.max(0, pop.t) / 0.5 * Math.PI) * 0.06; if (pop.t <= 0) this.pop.delete(b.id); }
            e.mesh.position.set(cx, -0.1, cz);
            e.mesh.scale.set(s.w * sc, s.h * sc, 1);
            const u = e.mesh.material.uniforms;
            // rising out of the ground while it is first being built
            const prog = b.bld ? 1 - Math.max(0, b.bld.t) / b.bld.total : 1;
            u.uClip.value = b.lv < 1 ? 0.08 + prog * 0.93 : 1.01;
            u.uTint.value.setRGB(1, 1, 1);
            if (b.lv < 1) u.uTint.value.setRGB(0.92, 0.88, 0.8);
            u.uHi.value = this.sel && this.sel.kind === 'building' && this.sel.id === b.id ? 1 : 0;
            e.mesh.visible = true;
            // scaffolding
            if (b.bld) {
                if (!e.scaf) {
                    const sc2 = paintScaffold(d.w, Math.max(1.6, s.h * 0.92));
                    e.scaf = new THREE.Mesh(this.geo, spriteMaterial(this.stage.shared, this.texFor(sc2.c, {}, `sf:${d.w}:${Math.round(s.h * 10)}`), { }));
                    e.scaf.rotation.x = -LEAN; e.scaf.scale.set(sc2.w, sc2.h, 1);
                    this.group.add(e.scaf);
                }
                e.scaf.visible = true;
                e.scaf.position.set(cx, -0.1, cz + 0.12);
            } else if (e.scaf) e.scaf.visible = false;
            // blades
            if (e.blades) {
                const hub = s.extra.hub;
                const bx = cx - s.w / 2 + hub.x, up = s.h - hub.y;
                e.blades.position.set(bx, -0.1 + up * Math.cos(LEAN), cz - up * Math.sin(LEAN) + 0.05);
                e.blades.children[0].rotation.z = -time * (0.5 + 0.1 * G.villagers.length * 0) ;
                e.blades.visible = b.lv >= 1;
            }
            // chimney smoke
            if (b.lv >= 1 && s.smoke.length) {
                e.smokeT -= dt;
                const hr = hourOf(G.t);
                const cold = hr < 9 || hr > 16 || G.weather === 'snow' || G.weather === 'rain';
                const forge = b.type === 'smithy' && b.workers.length > 0;
                if (e.smokeT <= 0 && (cold || forge || d.kind === 'craft')) {
                    e.smokeT = forge ? 0.45 : 1.3 + Math.random();
                    for (const sm of s.smoke) this.fx.puff(cx - s.w / 2 + sm.x, (s.h - sm.y) * Math.cos(LEAN), cz - (s.h - sm.y) * Math.sin(LEAN), forge ? { color: [0.45, 0.45, 0.5], a: 0.5 } : undefined);
                }
            }
            // light pools for the night
            if (b.lv >= 1 && NIGHT_LIGHT[b.type]) lights.push({ x: cx, z: b.y + d.h + 0.55, r: (d.kind === 'deco' ? 2.4 : 1.4 + d.w * 0.6) * NIGHT_LIGHT[b.type] });
        }
        for (const [id, e] of this.bmap) if (!alive.has(id)) {
            this.group.remove(e.mesh); if (e.scaf) this.group.remove(e.scaf); if (e.blades) this.group.remove(e.blades);
            this.bmap.delete(id);
        }
        // pools
        const L = this.stage.shared.uNight.value;
        this.pools.material.opacity = L * 0.32;
        this.pools.count = L > 0.02 ? lights.length : 0;
        lights.forEach((l, i) => { this.dummy.position.set(l.x, 0.03, l.z); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(l.r * 1.7, 1, l.r * 1.1); this.dummy.updateMatrix(); this.pools.setMatrixAt(i, this.dummy.matrix); });
        this.pools.instanceMatrix.needsUpdate = true;
        // selection ring
        const sel = this.sel;
        const sb = sel && sel.kind === 'building' ? G.buildings.find((b) => b.id === sel.id) : null;
        this.ring.visible = !!sb;
        if (sb) {
            const d = BUILDINGS[sb.type];
            const pulse = 1 + Math.sin(time * 4) * 0.03;
            this.ring.position.set(sb.x + d.w / 2, 0.04, sb.y + d.h / 2);
            this.ring.scale.set((d.w + 0.7) * pulse, 1, (d.h + 0.7) * pulse);
        }
    }

    // ---------------------------------------------------------------- the ghost shown while placing a building
    setGhost(spec) {
        this.ghostSpec = spec;
    }
    syncGhost() {
        const g = this.ghostSpec;
        if (!g) { if (this.ghost) this.ghost.visible = false; this.tiles.count = 0; return; }
        const d = BUILDINGS[g.type];
        const s = paintBuilding(g.type, 1);
        if (!this.ghost) { this.ghost = new THREE.Mesh(this.geo, null); this.ghost.rotation.x = -LEAN; this.group.add(this.ghost); }
        if (this.ghost.userData.type !== g.type) {
            this.ghost.material = spriteMaterial(this.stage.shared, this.texFor(s.c, {}, `b:${g.type}:1`), { emi: this.texFor(s.e, {}, `be:${g.type}:1`) });
            this.ghost.material.transparent = true; this.ghost.material.alphaToCoverage = false;
            this.ghost.userData.type = g.type;
        }
        this.ghost.visible = true;
        this.ghost.material.uniforms.uAlpha.value = 0.72;
        this.ghost.material.uniforms.uTint.value.setRGB(g.ok ? 0.9 : 1.2, g.ok ? 1.1 : 0.7, g.ok ? 0.9 : 0.7);
        this.ghost.scale.set(s.w, s.h, 1);
        this.ghost.position.set(g.x + d.w / 2, -0.1, g.y + d.h - 0.2);
        this.tiles.count = g.tiles.length;
        g.tiles.forEach((t, i) => {
            this.dummy.position.set(t.x + 0.5, 0.05, t.y + 0.5); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(0.94, 1, 0.94); this.dummy.updateMatrix();
            this.tiles.setMatrixAt(i, this.dummy.matrix);
            this.tiles.setColorAt(i, new THREE.Color(t.ok ? 0x6ae06a : 0xe05a4a));
        });
        this.tiles.instanceMatrix.needsUpdate = true;
        if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    }

    // ---------------------------------------------------------------- people
    walkerFor(kind, id, key, canvasFn) {
        const wid = `${kind}${id}`;
        let w = this.walkers.get(wid);
        if (!w) { w = new Walker(kind, id); this.walkers.set(wid, w); }
        if (w.key !== key) {
            w.key = key;
            const t = this.texFor(canvasFn(), { pixel: true }, 'c:' + key);
            if (!w.mesh) {
                w.mat = spriteMaterial(this.stage.shared, t, { rect: [0, 0, 1 / FRAMES, 1], alphaCoverage: false });
                w.mat.transparent = true;
                w.mesh = new THREE.Mesh(this.geo, w.mat);
                w.mesh.rotation.x = -LEAN;
                w.mesh.scale.set(CHAR_W, CHAR_H, 1);
                w.mesh.renderOrder = 5;
                this.group.add(w.mesh);
            } else w.mat.uniforms.map.value = t;
        }
        return w;
    }

    homeOf(G, v) {
        const houses = G.buildings.filter((b) => b.type === 'house' && b.lv >= 1);
        const pick = Math.floor(lcg(v.id, 5, 1) * (houses.length + 1));
        const b = pick >= houses.length ? hallOf(G) : houses[pick];
        const d = BUILDINGS[b.type];
        return { b, x: b.x + d.w / 2 - 0.2 + lcg(v.id, 1, 2) * 0.4, y: b.y + d.h + 0.35 };
    }

    nodeNear(G, b, kind) {
        const d = BUILDINGS[b.type];
        const cx = b.x + d.w / 2, cy = b.y + d.h / 2;
        let best = null, bd = 1e9;
        for (const n of G.nodes) {
            if (n.k !== kind || n.regrow > 0) continue;
            const dd = Math.hypot(n.x + 0.5 - cx, n.y + 0.5 - cy);
            if (dd < bd && dd < 9 && !(n.x >= b.x && n.x < b.x + d.w && n.y >= b.y && n.y < b.y + d.h)) { bd = dd; best = n; }
        }
        return best;
    }

    /** Where a villager should be right now, and what they are doing there. */
    villagerGoal(G, v, w) {
        const night = isNight(G.t);
        const hr = hourOf(G.t);
        if (night || (hr > 19.2 && !v.job)) {
            const h = this.homeOf(G, v);
            return { x: h.x, y: h.y, mode: 'home', b: h.b };
        }
        const b = v.job != null ? G.buildings.find((x) => x.id === v.job) : null;
        if (b && b.lv >= 1) {
            const d = BUILDINGS[b.type];
            const door = { x: b.x + d.w / 2 + (lcg(v.id, 3, 3) - 0.5) * Math.min(2, d.w * 0.6), y: b.y + d.h + 0.5 };
            if (d.near && w.phase % 3 !== 2) {
                const n = this.nodeNear(G, b, d.near);
                if (n) return { x: n.x + 0.5, y: n.y + 1.05, mode: 'work' };
            }
            if (d.kind === 'gather' && !d.near) {
                // out in the fields around it
                return { x: b.x + 0.5 + lcg(v.id, w.phase, 4) * (d.w - 1), y: b.y + d.h - 0.3 + lcg(v.id, w.phase, 5) * 0.7, mode: 'work' };
            }
            return { x: door.x, y: door.y, mode: w.phase % 4 === 3 ? 'idle' : 'work', b };
        }
        return null;
    }

    heroGoal(G, h) {
        const plaza = locPos(G, 'plaza');
        switch (h.st) {
            case 'walk': { const p = locPos(G, h.to); return { x: p.x, y: p.y, mode: 'walk', sync: h.t }; }
            case 'eat': case 'sleep': case 'heal': case 'shop': { const b = G.buildings.find((x) => x.id === h.then?.bid || x.id === h.at); const p = locPos(G, b ? b.id : h.at); return { x: p.x, y: p.y, mode: 'inside', b }; }
            case 'rest': return { x: plaza.x + 1.2 + lcg(h.id, 8, 1) * 1.6, y: plaza.y + 0.7 + lcg(h.id, 8, 2) * 1.2, mode: 'sit' };
            case 'away': { const p = locPos(G, 'gate'); return { x: p.x, y: p.y, mode: 'away' }; }
            default: return null;
        }
    }

    stepWalker(w, G, dt, goal, speed) {
        // choose a path to the goal when it changed or the layout did
        const moved = Math.hypot(goal.x - w.gx, goal.y - w.gy) > 0.6 || w.navv !== this.nav.version;
        if (moved) {
            w.gx = goal.x; w.gy = goal.y; w.navv = this.nav.version;
            const p = this.nav.path(w.x, w.y, goal.x, goal.y);
            w.path = p.slice(); w.path.push([goal.x, goal.y]); w.pi = 0;
        }
        w.moving = false;
        let left = speed * dt;
        while (w.path && w.pi < w.path.length && left > 0) {
            const [tx, ty] = w.path[w.pi];
            const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
            if (d <= left) { w.x = tx; w.y = ty; left -= d; w.pi++; }
            else { w.x += (dx / d) * left; w.y += (dy / d) * left; left = 0; w.moving = true; if (Math.abs(dx) > 0.05) w.face = dx > 0 ? 1 : -1; }
        }
        if (w.path && w.pi >= w.path.length) w.path = null;
        return !w.moving;
    }

    pathLeft(w) {
        if (!w.path) return 0;
        let d = 0, px = w.x, py = w.y;
        for (let i = w.pi; i < w.path.length; i++) { d += Math.hypot(w.path[i][0] - px, w.path[i][1] - py); [px, py] = w.path[i]; }
        return d;
    }

    syncPeople(G, dt, time) {
        const seen = new Set();
        const inside = new Map();
        const sp = Math.min(4, this.speed);
        const gate = locPos(G, 'gate');
        // villagers
        for (const v of G.villagers) {
            const w = this.walkerFor('v', v.id, villagerKey(v), () => charStrip(villagerKey(v), villagerLook(v, v.special)));
            seen.add(`v${v.id}`);
            w.phaseT -= dt;
            if (w.phaseT <= 0) { w.phase++; w.phaseT = 7 + lcg(v.id, w.phase, 6) * 9; }
            let goal = this.villagerGoal(G, v, w);
            if (!w.placed) {
                const g0 = goal || { x: locPos(G, 'plaza').x, y: locPos(G, 'plaza').y };
                w.x = g0.x + (lcg(v.id, 1, 1) - 0.5) * 1.5; w.y = g0.y + 0.2; w.placed = true; w.alpha = 0;
            }
            let mode = 'idle', vis = 1;
            if (!goal) {
                // between chores: wander near the plaza
                w.wanderT -= dt;
                if (w.wanderT <= 0) {
                    w.wanderT = 3 + lcg(v.id, w.phase, 7) * 6;
                    const p = locPos(G, 'plaza');
                    const [fx, fy] = this.nav.nearest(p.x - 3 + lcg(v.id, w.phase, 8) * 6, p.y - 1 + lcg(v.id, w.phase, 9) * 4);
                    w.wx = fx + 0.5; w.wy = fy + 0.5;
                }
                goal = { x: w.wx || w.x, y: w.wy || w.y, mode: 'idle' };
            }
            const arrived = this.stepWalker(w, G, dt, goal, 1.5 * sp);
            if (goal.mode === 'home' && arrived) { vis = 0; mode = 'idle'; if (goal.b) inside.set(goal.b.id, (inside.get(goal.b.id) || 0) + 1); }
            else if (goal.mode === 'work' && arrived) mode = 'work';
            else if (arrived) mode = 'idle';
            w.mode = w.moving ? 'walk' : mode;
            w.target = vis;
        }
        // heroes
        for (const h of G.heroes) {
            const wt = h.equip.weapon ? ITEMS[h.equip.weapon].tier : 0, at = h.equip.armor ? ITEMS[h.equip.armor].tier : 0, ct = h.equip.charm ? ITEMS[h.equip.charm].tier : 0;
            const w = this.walkerFor('h', h.id, heroKey(h, wt, at, ct), () => charStrip(heroKey(h, wt, at, ct), heroLook(h, wt, at, ct)));
            seen.add(`h${h.id}`);
            let goal = this.heroGoal(G, h);
            if (!w.placed) {
                const p = locPos(G, h.st === 'away' ? 'gate' : h.at === 'gate' ? 'gate' : 'plaza');
                w.x = p.x + (lcg(h.id, 1, 1) - 0.5); w.y = p.y; w.placed = true; w.alpha = 0;
                w.prevSt = h.st;
            }
            // coming home from a quest: appear at the gate
            if (w.prevSt === 'away' && h.st !== 'away') { w.x = gate.x; w.y = gate.y; w.alpha = 0; w.path = null; w.gx = -99; }
            w.prevSt = h.st;
            let vis = 1, mode = 'idle', speed = 2.1 * sp;
            if (!goal) {
                w.wanderT -= dt;
                if (w.wanderT <= 0) {
                    w.wanderT = 3 + lcg(h.id, Math.floor(time / 5), 7) * 6;
                    const p = locPos(G, 'plaza');
                    const [fx, fy] = this.nav.nearest(p.x - 3.5 + lcg(h.id, Math.floor(time / 7), 8) * 7, p.y - 0.5 + lcg(h.id, Math.floor(time / 7), 9) * 3.5);
                    w.wx = fx + 0.5; w.wy = fy + 0.5;
                }
                goal = { x: w.wx || w.x, y: w.wy || w.y, mode: 'idle' };
                speed = 1.3 * sp;
            } else if (goal.sync != null) {
                const left = this.pathLeft(w) || 1;
                speed = Math.max(1.2, Math.min(7, left / Math.max(0.35, goal.sync))) * (sp > 1 ? 1 : 1);
            }
            const arrived = this.stepWalker(w, G, dt, goal, speed);
            if (goal.mode === 'inside' && arrived) { vis = 0; if (goal.b) inside.set(goal.b.id, (inside.get(goal.b.id) || 0) + 1); }
            if (goal.mode === 'away') vis = arrived ? 0 : 1;
            if (goal.mode === 'sit' && arrived) mode = 'sit';
            w.mode = w.moving ? 'walk' : mode;
            w.target = vis;
            w.hero = h;
        }
        // visitors waiting at the gate, and the merchant
        let vi = 0;
        for (const vis of G.visitors) {
            if (vis.kind !== 'villager') continue;
            const v = vis.person;
            const w = this.walkerFor('x', vis.id, villagerKey(v), () => charStrip(villagerKey(v), villagerLook(v, null)));
            seen.add(`x${vis.id}`);
            if (!w.placed) { w.x = gate.x + 0.5; w.y = gate.y + vi * 0.7 - 0.3; w.placed = true; }
            w.x = gate.x + 1.1; w.y = gate.y - 0.3 + vi * 0.7; w.target = 1; w.mode = 'idle'; w.moving = false; w.face = 1;
            vi++;
        }
        const m = G.merchant;
        this.cart.visible = !!m;
        if (m) {
            const p = locPos(G, 'plaza');
            this.cart.position.set(p.x - 3.6, -0.05, p.y + 0.6);
        }
        // fade, frames, placement
        let ns = 0;
        const sdw = this.dummy;
        for (const [wid, w] of this.walkers) {
            if (!seen.has(wid)) { this.group.remove(w.mesh); this.walkers.delete(wid); continue; }
            w.alpha += (w.target - w.alpha) * Math.min(1, dt * 6);
            w.t += dt;
            const frame = w.mode === 'walk' ? FRAME.walk + (Math.floor(w.t * 8 * Math.min(2, this.speed)) % 4) : w.mode === 'work' ? FRAME.work + (Math.floor(w.t * 3) % 2) : w.mode === 'sit' ? FRAME.sit : FRAME.idle;
            const u = w.mat.uniforms;
            u.uRect.value.set(frame / FRAMES, 0, (frame + 1) / FRAMES, 1);
            u.uAlpha.value = Math.max(0, Math.min(1, w.alpha));
            w.mesh.visible = w.alpha > 0.04;
            const bob = w.mode === 'walk' ? Math.abs(Math.sin(w.t * 8)) * 0.03 : w.mode === 'idle' ? Math.sin(w.t * 2 + w.id) * 0.006 : 0;
            w.mesh.position.set(w.x, bob - 0.02, w.y + 0.1);
            w.mesh.scale.set(CHAR_W * w.face, CHAR_H, 1);
            u.uHi.value = this.sel && this.sel.kind === (w.kind === 'h' ? 'hero' : 'villager') && this.sel.id === w.id ? 1 : 0;
            if (w.mesh.visible && ns < 190) {
                sdw.position.set(w.x + 0.04, 0.03, w.y + 0.1); sdw.rotation.set(0, 0, 0); sdw.scale.set(0.9, 1, 0.5); sdw.updateMatrix();
                this.shadows.setMatrixAt(ns++, sdw.matrix);
            }
        }
        this.shadows.count = ns;
        this.shadows.instanceMatrix.needsUpdate = true;
        this.insideCount = inside;
    }

    // ---------------------------------------------------------------- per-frame
    update(G, dt, time, ui = {}) {
        this.sel = ui.selected || null;
        this.speed = ui.speed || 1;
        const season = seasonOf(G.day);
        this.refreshLayout(G, season);
        if (season !== this.season) {
            this.season = season;
            this.nodeDirty = true;
            this.terrain.sig = '';
            this.refreshLayout(G, season);
        }
        this.terrain.water.material.uniforms.uSnow.value = season === 3 ? 1 : 0;
        this.terrain.mat.color.copy(this.stage.shared.uLight.value);
        this.shadows.material.opacity = 0.8 - this.stage.shared.uNight.value * 0.35;
        this.syncNodes(G, season, dt);
        this.tickWobble(G, dt);
        this.syncBuildings(G, dt, time, ui);
        this.syncPeople(G, dt, time);
        this.syncGhost();
    }

    // ---------------------------------------------------------------- events from the sim
    onEvent(G, e) {
        const fx = this.fx;
        switch (e.type) {
            case 'hit': case 'felled': {
                this.wobble.set(e.id, { t: 0.35 });
                fx.chips(e.x + 0.5, e.y + 0.7, e.k === 'tree' ? 'tree' : e.k === 'rock' ? 'rock' : 'plant');
                if (e.n > 0) fx.floater(`+${e.n} ${ITEMS[e.item].icon}`, e.x + 0.5, 1.5, e.y + 0.5);
                if (e.type === 'felled') this.nodeDirty = true;
                break;
            }
            case 'built': case 'upgraded': {
                this.pop.set(e.id, { t: 0.5 });
                const b = G.buildings.find((x) => x.id === e.id);
                if (b) { const d = BUILDINGS[b.type]; fx.sparkle(b.x + d.w / 2, 1.2, b.y + d.h, 18); fx.dust(b.x + d.w / 2, b.y + d.h, 12); }
                this.nodeDirty = true;
                break;
            }
            case 'placed': this.nodeDirty = true; break;
            case 'gain': {
                const b = G.buildings.find((x) => x.id === e.bid);
                if (b) { const d = BUILDINGS[b.type]; fx.floater(`+${e.n} ${ITEMS[e.item].icon}`, b.x + d.w / 2, 1.6 + d.h * 0.2, b.y + d.h * 0.5, 'soft'); }
                break;
            }
            case 'craft': {
                const b = G.buildings.find((x) => x.id === e.bid);
                if (b) { const d = BUILDINGS[b.type]; fx.sparkle(b.x + d.w / 2, 0.9, b.y + d.h, 6); fx.floater(`${ITEMS[e.item].icon}`, b.x + d.w / 2, 1.8, b.y + d.h * 0.6, 'soft'); }
                break;
            }
            case 'sale': case 'sell': {
                const h = e.hid && G.heroes.find((x) => x.id === e.hid);
                const w = h && this.walkers.get(`h${h.id}`);
                const p = w ? { x: w.x, y: w.y } : locPos(G, 'plaza');
                fx.floater(`+${e.gold} 🪙`, p.x, 1.6, p.y, 'gold');
                fx.burst(p.x, 1.0, p.y, { n: 6, color: [1, 0.85, 0.3], size: 0.08, layer: 1, speed: 1.2 });
                break;
            }
            case 'levelup': {
                const w = this.walkers.get(`h${e.hid}`);
                if (w) { fx.floater(`Level ${e.lv}!`, w.x, 1.9, w.y, 'level'); fx.sparkle(w.x, 1.0, w.y, 14); }
                break;
            }
            case 'welcomed': case 'hired': {
                const g = locPos(G, 'gate');
                fx.sparkle(g.x + 1, 1.0, g.y, 10);
                break;
            }
            case 'raid': { const g = locPos(G, 'gate'); fx.floater(e.win ? '🛡️ Held!' : '💥 Raided!', g.x + 1.5, 2.2, g.y, e.win ? 'good' : 'bad'); break; }
            case 'festival': case 'won': { if (!this.calm) { const p = locPos(G, 'plaza'); fx.confetti(p.x, p.y, 70); } break; }
            case 'claimed': { const p = locPos(G, 'plaza'); fx.sparkle(p.x, 1.4, p.y, 14, [1, 0.85, 0.4]); break; }
            case 'special': { if (!this.calm) { const p = locPos(G, 'plaza'); fx.confetti(p.x, p.y, 30); } break; }
            default: break;
        }
    }

    // ---------------------------------------------------------------- picking
    spriteRect(x, z, w, h) {
        // screen rectangle of a leaning sprite whose bottom centre is at world (x, 0, z)
        const st = this.stage, a = {}, b = {}, c = {}, d = {};
        const ux = Math.cos(LEAN), uz = -Math.sin(LEAN);
        st.project(x - w / 2, 0, z, a); st.project(x + w / 2, 0, z, b);
        st.project(x - w / 2, h * ux, z + h * uz, c); st.project(x + w / 2, h * ux, z + h * uz, d);
        const xs = [a.x, b.x, c.x, d.x], ys = [a.y, b.y, c.y, d.y];
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), vis: a.vis };
    }

    screenRect(kind, id, G) {
        if (kind === 'building') {
            const b = G.buildings.find((x) => x.id === id), e = this.bmap.get(id);
            if (!b || !e) return null;
            const d = BUILDINGS[b.type];
            return this.spriteRect(b.x + d.w / 2, b.y + d.h - 0.2, e.sprite.w * 0.92, e.sprite.h);
        }
        if (kind === 'hero' || kind === 'villager') {
            const w = this.walkers.get(`${kind === 'hero' ? 'h' : 'v'}${id}`);
            return w ? this.spriteRect(w.x, w.y + 0.1, CHAR_W * 1.3, CHAR_H) : null;
        }
        if (kind === 'node') {
            const n = G.nodes.find((x) => x.id === id);
            if (!n) return null;
            const sp = this.nodeSprite(this.nodeKey(n) || 'stump', this.season, 0);
            return this.spriteRect(n.x + 0.5 + n.ox, n.y + 0.72 + n.oy, sp.w * 0.7, sp.h * 0.85);
        }
        return null;
    }

    /** What is under a screen point: people first, then wild things, then buildings. */
    pick(px, py, G) {
        const hits = [];
        const inside = (r) => r && r.vis !== false && px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1;
        for (const [wid, w] of this.walkers) {
            if (w.kind === 'x' || !w.mesh.visible) continue;
            const kind = w.kind === 'h' ? 'hero' : 'villager';
            const r = this.screenRect(kind, w.id, G);
            if (inside(r)) hits.push({ kind, id: w.id, z: w.y + 100, pri: 3 });
        }
        for (const n of G.nodes) {
            if (n.regrow > 0 && n.k !== 'tree') continue;
            if (n.x < G.bounds.x0 - 1 || n.x > G.bounds.x1 + 1 || n.y < G.bounds.y0 - 1 || n.y > G.bounds.y1 + 1) continue;
            const r = this.screenRect('node', n.id, G);
            if (inside(r)) hits.push({ kind: 'node', id: n.id, z: n.y + 0.72, pri: 2 });
        }
        for (const b of G.buildings) {
            const r = this.screenRect('building', b.id, G);
            if (inside(r)) {
                const d = BUILDINGS[b.type];
                hits.push({ kind: 'building', id: b.id, z: b.y + d.h, pri: 1 });
            }
        }
        hits.sort((a, b) => b.pri - a.pri || b.z - a.z);
        const g = this.stage.unproject(px, py);
        const tile = { x: Math.floor(g.x), y: Math.floor(g.z) };
        if (!hits.length) return { kind: 'ground', tile, world: g };
        // a building behind a wild node on screen: prefer the node only if the tap is low on it
        return { ...hits[0], tile, world: g };
    }
}
