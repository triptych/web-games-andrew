// The dig: a 3D excavation pit with the board in it. Reads the board and plays back the script
// of events each move produces (swap, waves of clears and specials, falls, relics, shuffles)
// with tweens, particles, beams, flashes and shakes. Never changes the sim.
//
// Board space: the board lies in XZ with row 0 at the far edge (−Z) and gravity toward +Z, the
// camera above and behind +Z. Tiles stand tilted back so their faces look at the camera.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tileModel, rockGeos, crustGeos, tileGeos, auraMaterial, sunMaterial } from './models.js';
import { Kit, instance, cyl, box, sphere, cone, torus, bumpy, tube, noise3 } from './kit.js';
import { Fx } from './fx.js';
import { TILES } from '../config.js';

const CELL = 1;
const TILE_Y = 0.5;
const TILT = 0.42;                 // camera angle from straight down (rad)
const DS = 0.11;                   // seconds per unit of an event's delay `d`
const GRAV = 70;                   // cells / s² for falling finds

export const THEMES = [
    { name: 'Dune Dig', sand: '#e9cf98', sand2: '#dcbd82', soil1: '#a87a4c', soil2: '#7a5434', frame: '#8f5e36', sky: '#bfe3f2', ground: '#b8925e', sun: '#fff1d8', sunI: 2.0, hemi: 0.6, fog: '#e7d5ad', grass: '#7fae4a' },
    { name: 'Old Ruins', sand: '#e6dcc6', sand2: '#d6cab0', soil1: '#a08a6a', soil2: '#76664c', frame: '#7d6650', sky: '#cfe2ea', ground: '#a89a80', sun: '#fff4e2', sunI: 2.3, hemi: 0.75, fog: '#e2dccb', grass: '#8aa65a' },
    { name: 'Jungle Hill', sand: '#d9a77a', sand2: '#c8946a', soil1: '#8f5a3a', soil2: '#663c26', frame: '#6b4426', sky: '#bfe6cf', ground: '#9a6a48', sun: '#fff0d0', sunI: 2.2, hemi: 0.8, fog: '#cfd8b8', grass: '#4f9a3e' },
    { name: 'Sea Cliffs', sand: '#d8d4c8', sand2: '#c6c2b4', soil1: '#8e8676', soil2: '#655e52', frame: '#6e6a62', sky: '#bcdcf0', ground: '#8f8c84', sun: '#f4f6ff', sunI: 2.3, hemi: 0.85, fog: '#d5dde2', grass: '#7aa070' },
    { name: 'Sunset Quarry', sand: '#efbf8a', sand2: '#e0aa74', soil1: '#b0703e', soil2: '#7e4a26', frame: '#7a4a2a', sky: '#ffd3a6', ground: '#c08050', sun: '#ffd2a0', sunI: 2.5, hemi: 0.7, fog: '#f0c79c', grass: '#8a9a4a' },
    { name: 'Night Dig', sand: '#8a8aa0', sand2: '#7c7c94', soil1: '#5a4c52', soil2: '#3e343c', frame: '#4a3a34', sky: '#1c2440', ground: '#4a4a62', sun: '#a8b8ff', sunI: 1.1, hemi: 0.45, fog: '#232a44', grass: '#3e5a4a', night: true },
];

export class DigView {
    constructor(stage, hooks) {
        this.stage = stage;
        this.hooks = hooks;              // { ui, sfx }
        const scene = this.scene = new THREE.Scene();
        scene.environment = stage.envMap;
        scene.environmentIntensity = 0.45;
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
        this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0xb89a6a, 0.75);
        scene.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight(0xfff1d8, 2.4);
        sun.position.set(-6, 14, 4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera;
        sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.02;
        scene.add(sun, sun.target);
        scene.fog = new THREE.Fog(0xe7d5ad, 30, 60);

        this.root = new THREE.Group();          // shakes as one
        scene.add(this.root);
        this.groundMat = sandMaterial();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 1, 1), this.groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        this.root.add(ground);
        this.env = new THREE.Group();
        this.root.add(this.env);
        this.boardG = new THREE.Group();
        this.root.add(this.boardG);
        this.tileG = new THREE.Group();
        this.root.add(this.tileG);
        this.fx = new Fx(this.root);

        // selection and keyboard cursor
        this.sel = squareMarker(0xffe08a);
        this.cursor = squareMarker(0x9fe0ff);
        this.root.add(this.sel, this.cursor);
        this.sel.visible = this.cursor.visible = false;

        this.tiles = new Map();          // id -> { obj, r, c, key, data }
        this.rocks = new Map();          // cell index -> group
        this.tweens = [];
        this.queue = [];
        this.tl = null;
        this.rushing = false;
        this.time = 0;
        this.shake = 0;
        this.punch = 0;
        this.idle = 0;
        this.hint = null;
        this.insets = { top: 120, bottom: 90, left: 0, right: 0 };
        this.enabled = false;
        this.selected = null;
        this.cursorAt = null;
        this.hammerMode = false;
        this.B = null;
        this.frames = 0;
        this.ray = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_Y);
        this.bindPointer();
    }

    // ------------------------------------------------------------------ building
    /** Show a board. Builds the tray for its shape and drops every find in from above. */
    load(B, spec, themeIndex = 0) {
        this.clear();
        this.B = B;
        this.spec = spec;
        this.R = B.R; this.C = B.C;
        this.theme = THEMES[themeIndex];
        this.applyTheme(this.theme);
        this.buildTray();
        this.buildProps();
        let k = 0;
        for (let r = 0; r < B.R; r++) {
            for (let c = 0; c < B.C; c++) {
                const cell = B.cells[r * B.C + c];
                if (!B.mask[r * B.C + c]) continue;
                if (cell.rock) this.setRock(r, c, cell.rock);
                if (!cell.t) continue;
                const o = this.addTile(cell.t, r, c);
                const delay = 0.1 + (B.R - r) * 0.05 + c * 0.02 + (k++ % 3) * 0.01;
                const x = this.X(c), z = this.Z(r);
                o.obj.group.position.set(x, TILE_Y + 2.2, z - 1.2);
                o.obj.group.scale.setScalar(0.01);
                this.tween(0.42, (q) => {
                    const k = q * q;
                    o.obj.group.position.set(x, TILE_Y + 2.2 * (1 - k), z - 1.2 * (1 - k));
                    o.obj.group.scale.setScalar(Math.max(0.01, Math.min(1, q * 2.2)));
                }, () => { this.land(o); if ((r + c) % 4 === 0) this.fx.burst(x, 0.15, z, { n: 3, kind: 'dust', color: this.theme.sand2, speed: 1, up: 0.6, size: 0.4, grav: 1 }); }, delay);
            }
        }
        this.fit();
        this.introT = 0;
        this.enabled = true;
    }

    clear() {
        for (const o of this.tiles.values()) this.tileG.remove(o.obj.group);
        this.tiles.clear();
        for (const g of this.rocks.values()) this.boardG.remove(g);
        this.rocks.clear();
        this.boardG.clear();
        this.env.clear();
        this.tweens.length = 0;
        this.queue.length = 0;
        this.tl = null;
        this.rushing = false;
        this.fx.clear();
        this.selected = null;
        this.sel.visible = this.cursor.visible = false;
        this.hint = null;
        this.hammerMode = false;
    }

    applyTheme(t) {
        this.sun.color.set(t.sun);
        this.sun.intensity = t.sunI;
        this.hemi.intensity = t.hemi;
        this.hemi.color.set(t.night ? 0x6a7ab0 : 0xcfe8ff);
        this.hemi.groundColor.set(t.ground);
        this.scene.fog.color.set(t.fog);
        this.scene.background = new THREE.Color(t.fog);
        this.groundMat.color.set(t.sand);
        this.groundMat.userData.u.uSand2.value.set(t.sand2);
        this.scene.environmentIntensity = t.night ? 0.25 : 0.4;
    }

    X(c) { return (c - (this.C - 1) / 2) * CELL; }
    Z(r) { return (r - (this.R - 1) / 2) * CELL; }

    buildTray() {
        const B = this.B, t = this.theme;
        const n = B.mask.reduce((a, m) => a + m, 0);
        const geo = new RoundedBoxGeometry(0.95, 1, 0.95, 2, 0.08);
        geo.translate(0, -0.5, 0);
        this.slabs = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }), n);
        this.slabs.receiveShadow = true;
        this.slabIndex = new Map();
        let i = 0;
        for (let r = 0; r < B.R; r++) for (let c = 0; c < B.C; c++) if (B.mask[r * B.C + c]) this.slabIndex.set(r * B.C + c, i++);
        this.boardG.add(this.slabs);
        // fossils peeking out of the dirt
        const fossilGeo = tileGeos(5)[0].geo;
        this.fossilMesh = new THREE.InstancedMesh(fossilGeo, new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.6 }), n);
        this.fossilMesh.castShadow = true;
        this.boardG.add(this.fossilMesh);
        this.refreshCells(true);

        // the frame: a wooden rim round every edge of the shape, and survey strings between cells
        const kit = new Kit();
        const has = (r, c) => r >= 0 && c >= 0 && r < B.R && c < B.C && B.mask[r * B.C + c];
        const wood = (x, z, sx, sz) => kit.add(box(sx, 0.26, sz), (px, py) => (py > 0.08 ? shadeHex(t.frame, 0.12) : t.frame), 'flat', { p: [x, 0.08, z] });
        for (let r = 0; r < B.R; r++) {
            for (let c = 0; c < B.C; c++) {
                if (!has(r, c)) continue;
                const x = this.X(c), z = this.Z(r);
                if (!has(r - 1, c)) wood(x, z - 0.55, 1.2, 0.14);
                if (!has(r + 1, c)) wood(x, z + 0.55, 1.2, 0.14);
                if (!has(r, c - 1)) wood(x - 0.55, z, 0.14, 1.2);
                if (!has(r, c + 1)) wood(x + 0.55, z, 0.14, 1.2);
                if (has(r, c + 1)) kit.add(box(0.012, 0.012, 1.0), '#f4efe2', 'matte', { p: [x + 0.5, 0.06, z] });
                if (has(r + 1, c)) kit.add(box(1.0, 0.012, 0.012), '#f4efe2', 'matte', { p: [x, 0.06, z + 0.5] });
            }
        }
        // corner stakes with red tape
        const corners = [[0, 0], [0, B.C - 1], [B.R - 1, 0], [B.R - 1, B.C - 1]];
        for (const [r, c] of corners) {
            const x = this.X(c) + (c ? 0.72 : -0.72), z = this.Z(r) + (r ? 0.72 : -0.72);
            kit.add(cyl(0.05, 0.06, 0.9, 8), '#b88a5a', 'flat', { p: [x, 0.3, z] });
            kit.add(box(0.14, 0.05, 0.02), '#e2503a', 'gloss', { p: [x + 0.06, 0.64, z], r: [0, 0.4, 0.3] });
        }
        const frame = kit.build();
        this.boardG.add(frame);
    }

    /** Dig-site clutter round the pit: buckets, brushes, a sieve, tufts, a parasol. Theme-tinted. */
    buildProps() {
        const t = this.theme;
        const halfW = (this.C / 2) * CELL + 1.0, halfD = (this.R / 2) * CELL + 1.0;
        const add = (g, x, z, ry = 0, s = 1) => { g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); this.env.add(g); };
        add(bucket(), -halfW - 0.6, -halfD + 1.2, 0.4);
        add(sieve(), halfW + 0.9, halfD - 2.4, -0.3);
        add(brushes(), halfW + 0.6, -halfD + 1.5, 0.8);
        add(clipboard(), -halfW - 0.5, halfD - 1.2, -0.5);
        add(rocksPile(), -halfW - 1.8, 0.5, 0);
        add(rocksPile(), halfW + 1.9, 0.2, 2);
        if (t.night) {
            for (const [x, z] of [[-halfW - 0.4, -halfD + 0.2], [halfW + 0.4, halfD - 0.2], [halfW + 0.5, -halfD + 0.3]]) {
                const l = lantern();
                add(l, x, z);
                const pl = new THREE.PointLight(0xffb060, 9, 9, 1.5);
                pl.position.set(x, 1.1, z);
                this.env.add(pl);
            }
        } else add(parasol(), -halfW - 1.6, -halfD - 0.6, 0.3, 1.2);
        // grass tufts and pebbles scattered outside the pit
        const tufts = new Kit(), peb = new Kit();
        for (let i = 0; i < 70; i++) {
            const a = (i * 2.399) % (Math.PI * 2), d = 0.6 + ((i * 0.618) % 1) * 7;
            const x = Math.cos(a) * (halfW + d), z = Math.sin(a) * (halfD + d);
            if (i % 3) peb.add(bumpy(new THREE.IcosahedronGeometry(0.06 + (i % 5) * 0.025, 0), 0.02, 6, i), shadeHex(t.ground, (i % 4) * 0.08 - 0.1), 'flat', { p: [x, 0.02, z] });
            else for (let b = 0; b < 4; b++) tufts.add(cone(0.035, 0.35 + (b % 2) * 0.12, 4), shadeHex(t.grass, b * 0.06), 'flat', { p: [x + (b - 1.5) * 0.06, 0.16, z + ((b * 7) % 3 - 1) * 0.05], r: [((b % 3) - 1) * 0.3, 0, ((b % 2) - 0.5) * 0.5] });
        }
        this.env.add(tufts.build(), peb.build());
    }

    /** Recolour the cells for dirt, and place fossil hints, from the view's own copy of them. */
    refreshCells(first = false) {
        const B = this.B, t = this.theme;
        if (first) {
            this.soilV = new Map(); this.fossilV = new Set(); this.cellH = new Map();
            for (const [ci] of this.slabIndex) {
                this.soilV.set(ci, B.cells[ci].soil);
                if (B.cells[ci].fossil) this.fossilV.add(ci);
                this.cellH.set(ci, soilH(B.cells[ci].soil));
            }
        }
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
        const lay = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.6));
        let nf = 0;
        for (const [ci, i] of this.slabIndex) {
            const r = Math.floor(ci / B.C), c = ci % B.C;
            const soil = this.soilV.get(ci);
            const hh = this.cellH.get(ci);
            p.set(this.X(c), hh, this.Z(r)); s.set(1, Math.max(0.02, hh + 0.05), 1);
            m.compose(p, q.identity(), s);
            this.slabs.setMatrixAt(i, m);
            col.set(soil === 2 ? t.soil2 : soil === 1 ? t.soil1 : (r + c) % 2 ? t.sand : t.sand2);
            this.slabs.setColorAt(i, col);
            if (this.fossilV.has(ci)) {
                p.set(this.X(c) + 0.25, hh + 0.02, this.Z(r) + 0.28);
                s.setScalar(0.55);
                m.compose(p, lay, s);
                this.fossilMesh.setMatrixAt(nf++, m);
            }
        }
        this.fossilMesh.count = nf;
        this.fossilMesh.instanceMatrix.needsUpdate = true;
        this.slabs.instanceMatrix.needsUpdate = true;
        if (this.slabs.instanceColor) this.slabs.instanceColor.needsUpdate = true;
    }

    setRock(r, c, hp) {
        const ci = r * this.C + c;
        const old = this.rocks.get(ci);
        if (old) { this.boardG.remove(old); this.rocks.delete(ci); }
        if (hp <= 0) return;
        const g = instance(rockGeos(Math.min(2, hp), (r * 3 + c) % 3));
        g.position.set(this.X(c), 0.42, this.Z(r));
        g.rotation.set(-(Math.PI / 2 - TILT) * 0.5, ((r + c) % 4) * 0.6, 0);
        g.userData.hp = hp;
        this.boardG.add(g);
        this.rocks.set(ci, g);
    }

    // ------------------------------------------------------------------ tiles
    addTile(t, r, c) {
        const obj = tileModel(t);
        obj.group.rotation.x = -(Math.PI / 2 - TILT);
        obj.group.position.set(this.X(c), TILE_Y, this.Z(r));
        this.tileG.add(obj.group);
        const o = { obj, r, c, key: lookKey(t), data: { ...t }, sq: 0 };
        this.tiles.set(t.id, o);
        return o;
    }
    setLook(o, t) {
        const key = lookKey(t);
        if (key === o.key) return;
        const pos = o.obj.group.position.clone(), rot = o.obj.group.rotation.clone();
        this.tileG.remove(o.obj.group);
        o.obj = tileModel(t);
        o.obj.group.position.copy(pos);
        o.obj.group.rotation.copy(rot);
        this.tileG.add(o.obj.group);
        o.key = key;
        o.data = { ...t };
    }
    removeTile(id) {
        const o = this.tiles.get(id);
        if (!o) return;
        this.tileG.remove(o.obj.group);
        this.tiles.delete(id);
    }
    land(o) { o.sq = 1; }

    /** Make the view match the board exactly (after every script, and as a safety net). */
    sync(B = this.B) {
        if (!B) return;
        this.B = B;
        const seen = new Set();
        for (let r = 0; r < B.R; r++) {
            for (let c = 0; c < B.C; c++) {
                const ci = r * B.C + c;
                if (!B.mask[ci]) continue;
                const cell = B.cells[ci];
                const rk = this.rocks.get(ci);
                if ((cell.rock || 0) !== (rk ? rk.userData.hp : 0)) this.setRock(r, c, cell.rock);
                const t = cell.t;
                if (!t) continue;
                seen.add(t.id);
                let o = this.tiles.get(t.id);
                if (!o) o = this.addTile(t, r, c);
                this.setLook(o, t);
                o.r = r; o.c = c;
                o.obj.group.position.set(this.X(c), TILE_Y, this.Z(r));
                o.obj.group.scale.setScalar(1);
                o.obj.group.visible = true;
            }
        }
        for (const id of [...this.tiles.keys()]) if (!seen.has(id)) this.removeTile(id);
        for (const [ci] of this.slabIndex) {
            this.soilV.set(ci, B.cells[ci].soil);
            this.cellH.set(ci, soilH(B.cells[ci].soil));
            if (B.cells[ci].fossil) this.fossilV.add(ci); else this.fossilV.delete(ci);
        }
        this.refreshCells();
    }

    // ------------------------------------------------------------------ playback
    play(list) { this.queue.push(list); }
    busy() { return !!this.tl || this.queue.length > 0 || this.tweens.some((t) => t.block); }

    /**
     * Jump to the end of the queued scripts: the final board and no more effects. The sim has
     * already settled everything, so this only skips the show (the Treasure Rush).
     */
    skip() {
        if (!this.busy()) return false;
        this.tl = null;
        this.queue.length = 0;
        this.tweens.length = 0;
        this.rushing = false;
        // drop what cut-short animations left in the tile layer: cleared finds, a scarab, a bone
        const live = new Set([...this.tiles.values()].map((o) => o.obj.group));
        for (const g of [...this.tileG.children]) if (!live.has(g)) this.tileG.remove(g);
        for (const o of this.tiles.values()) o.obj.group.rotation.z = 0;
        this.sync();
        this.hooks.onIdle?.();
        return true;
    }

    /** Turn one move's events into timed actions. */
    schedule(list) {
        const acts = [];
        const at = (t, fn) => acts.push({ t, fn });
        let T = 0, W0 = 0, waveEnd = 0;
        const birthOf = new Map();
        let lastPos = null;
        const pos = (r, c) => ({ x: this.X(c), z: this.Z(r) });
        for (const e of list) {
            switch (e.type) {
                case 'swap': {
                    const [r1, c1] = e.a, [r2, c2] = e.b;
                    if (e.ok) {
                        at(T, () => this.animSwap(e.ids[0], r1, c1, r2, c2, false));
                        T += 0.17;
                    } else if (e.stuck) {
                        at(T, () => { this.wiggle(r1, c1); this.wiggle(r2, c2); this.hooks.sfx('nope'); });
                        T += 0.2;
                    } else {
                        at(T, () => this.animSwap(e.ids[0], r1, c1, r2, c2, true));
                        T += 0.36;
                    }
                    break;
                }
                case 'moves': at(T, () => this.hooks.ui.moves(e.left, e.added)); break;
                case 'hammer': at(T, () => this.animHammer(e.r, e.c)); T += 0.38; break;
                case 'combo': at(T, () => { this.hooks.ui.praiseText('COMBO!', 'combo'); this.stage.kick(0.25, 1.2); this.hooks.sfx('combo'); }); break;
                case 'wave':
                    T = Math.max(T, waveEnd);
                    W0 = T; waveEnd = T + 0.05;
                    birthOf.clear();
                    if (e.chain >= 2 && !e.rush) at(T, () => this.hooks.ui.praise(e.chain));
                    break;
                case 'match': {
                    if (e.birth) for (const [r, c] of e.cells) birthOf.set(r * this.C + c, e.birth);
                    const mid = e.cells[Math.floor(e.cells.length / 2)];
                    at(W0, () => {
                        const p = pos(mid[0], mid[1]);
                        this.hooks.ui.popup(`+${e.pts}`, this.toScreen(p.x, TILE_Y + 0.4, p.z), TILES[e.color]?.color, e.size >= 4);
                        this.hooks.sfx('match', { chain: e.chain, size: e.size });
                    });
                    break;
                }
                case 'clear': {
                    const tt = W0 + e.d * DS;
                    const birth = e.by === 'match' ? birthOf.get(e.r * this.C + e.c) : null;
                    at(tt, () => this.animClear(e, birth));
                    waveEnd = Math.max(waveEnd, tt + (birth ? 0.24 : 0.2));
                    lastPos = [e.r, e.c];
                    break;
                }
                case 'fire': {
                    const tt = W0 + e.d * DS;
                    at(tt, () => this.animFire(e));
                    waveEnd = Math.max(waveEnd, tt + 0.25);
                    break;
                }
                case 'fly': {
                    const t0 = W0 + e.d * DS, t1 = W0 + (e.d + 3.8) * DS;
                    at(t0, () => this.animFly(e, t1 - t0));
                    waveEnd = Math.max(waveEnd, t1);
                    break;
                }
                case 'convert': {
                    const tt = W0 + e.d * DS;
                    at(tt, () => this.animConvert(e));
                    waveEnd = Math.max(waveEnd, tt + 0.12);
                    if (e.rush) T = Math.max(T, tt + 0.05);
                    break;
                }
                case 'crust': case 'rock': case 'soil': case 'fossil': {
                    const tt = W0 + (e.d || 0) * DS;
                    at(tt, () => this.animCell(e));
                    lastPos = [e.r, e.c];
                    waveEnd = Math.max(waveEnd, tt + 0.1);
                    break;
                }
                case 'goal': {
                    const lp = lastPos;
                    const tt = Math.max(W0, T);
                    at(tt, () => this.hooks.ui.goal(e, lp ? this.toScreenCell(lp[0], lp[1]) : null));
                    break;
                }
                case 'create': {
                    T = Math.max(T, waveEnd);
                    at(T, () => this.animCreate(e));
                    T += 0.06;
                    waveEnd = Math.max(waveEnd, T + 0.2);
                    break;
                }
                case 'fall': {
                    T = Math.max(T, waveEnd);
                    const dur = this.fallDuration(e);
                    at(T, () => this.animFall(e));
                    T += dur;
                    waveEnd = T;
                    break;
                }
                case 'relic': {
                    T = Math.max(T, waveEnd);
                    lastPos = [e.r, e.c];
                    at(T, () => this.animRelic(e));
                    T += 0.5;
                    waveEnd = T;
                    break;
                }
                case 'shuffle': {
                    T = Math.max(T, waveEnd);
                    at(T, () => this.animShuffle(e));
                    T += 0.8;
                    waveEnd = T;
                    break;
                }
                case 'rushstart':
                    T = Math.max(T, waveEnd) + 0.2;
                    at(T, () => { this.rushing = true; this.hooks.onRush?.(); this.hooks.ui.banner('Treasure Rush!', 'rush'); this.hooks.sfx('rush'); this.confetti(); });
                    T += 0.9;
                    break;
                case 'rushend': T = Math.max(T, waveEnd) + 0.2; break;
                default: break;
            }
        }
        const end = Math.max(T, waveEnd) + 0.05;
        acts.sort((a, b) => a.t - b.t);
        return { acts, end, t: 0, i: 0 };
    }

    fallDuration(e) {
        let m = 0;
        for (const mv of [...e.moves, ...e.spawns]) {
            const n = pathLen(mv.path);
            m = Math.max(m, Math.sqrt((2 * n) / GRAV) + 0.05);
        }
        return Math.min(0.9, m + 0.08);
    }

    // ------------------------------------------------------------------ animations
    tween(dur, fn, end = null, delay = 0, block = false) { this.tweens.push({ t: -delay, dur, fn, end, block }); }

    animSwap(id, r1, c1, r2, c2, back) {
        const ia = this.at(r1, c1), ib = this.at(r2, c2);
        const A = this.X(c1), Az = this.Z(r1), Bx = this.X(c2), Bz = this.Z(r2);
        this.hooks.sfx(back ? 'swapBad' : 'swap');
        for (const [o, fx, fz, tx, tz, lift] of [[ia, A, Az, Bx, Bz, 0.35], [ib, Bx, Bz, A, Az, -0.1]]) {
            if (!o) continue;
            const g = o.obj.group;
            this.tween(back ? 0.34 : 0.16, (q) => {
                const k = back ? (q < 0.5 ? easeOut(q * 2) : 1 - easeIn((q - 0.5) * 2)) : easeInOut(q);
                g.position.set(fx + (tx - fx) * k, TILE_Y + Math.sin(k * Math.PI) * lift, fz + (tz - fz) * k);
                g.scale.setScalar(1 + Math.sin(k * Math.PI) * (lift > 0 ? 0.15 : -0.05));
            }, () => { if (!back) { o.r = o === ia ? r2 : r1; o.c = o === ia ? c2 : c1; } g.scale.setScalar(1); });
        }
        if (back) this.shake = Math.max(this.shake, 0.12);
    }

    at(r, c) { for (const o of this.tiles.values()) if (o.r === r && o.c === c) return o; return null; }

    wiggle(r, c) {
        const o = this.at(r, c);
        if (!o) return;
        const g = o.obj.group, x = this.X(c);
        this.tween(0.3, (q) => { g.position.x = x + Math.sin(q * Math.PI * 6) * 0.08 * (1 - q); });
    }

    animClear(e, birth) {
        const o = this.tiles.get(e.id);
        const x = this.X(e.c), z = this.Z(e.r);
        const col = e.k === 'sun' ? '#fff2a8' : TILES[e.color]?.color || '#ffffff';
        if (!o) return;
        const g = o.obj.group;
        this.tiles.delete(e.id);
        o.r = o.c = -9;
        if (birth) {
            const bx = this.X(birth[1]), bz = this.Z(birth[0]);
            this.tween(0.16, (q) => {
                const k = easeIn(q);
                g.position.set(x + (bx - x) * k, TILE_Y + Math.sin(q * Math.PI) * 0.2, z + (bz - z) * k);
                g.scale.setScalar(1 - k * 0.5);
            }, () => { this.tileG.remove(g); this.fx.burst(bx, TILE_Y, bz, { n: 4, color: col, speed: 1.5, size: 0.25 }); });
            return;
        }
        this.tween(0.2, (q) => {
            const s = q < 0.3 ? 1 + (q / 0.3) * 0.32 : 1.32 * (1 - easeIn((q - 0.3) / 0.7));
            g.scale.setScalar(Math.max(0.001, s));
            g.rotation.z = q * 1.4;
        }, () => this.tileG.remove(g));
        this.fx.burst(x, TILE_Y, z, { n: e.by === 'match' ? 9 : 6, color: col, speed: 2.6, up: 2.2, size: 0.26, life: 0.6 });
        this.fx.burst(x, TILE_Y, z, { n: 1, color: '#fff4d0', speed: 0.3, up: 0.2, size: 0.42, kind: 'glow', life: 0.25, grav: 0, alpha: 0.45 });
        this.fx.shatter(x, TILE_Y, z, col, e.by === 'match' ? 4 : 3, 2.6);
        if (e.by !== 'match') this.fx.burst(x, 0.2, z, { n: 2, kind: 'dust', color: this.theme.sand2, speed: 0.8, up: 0.5, size: 0.5, grav: 0.5 });
    }

    animFire(e) {
        const x = this.X(e.c), z = this.Z(e.r);
        const col = e.color >= 0 ? TILES[e.color].color : '#fff2b0';
        const W = this.C * CELL / 2 + 0.6, D = this.R * CELL / 2 + 0.6;
        switch (e.s) {
            case 'h':
                this.fx.beam(-W, z, W, z, col, 0.95);
                this.hooks.sfx('trowel');
                this.shake = Math.max(this.shake, 0.22);
                for (const [r, c] of e.cells) this.fx.burst(this.X(c), TILE_Y, this.Z(r), { n: 2, color: '#fff6c8', speed: 1, up: 1, size: 0.2, kind: 'spark', life: 0.4 });
                break;
            case 'v':
                this.fx.beam(x, -D, x, D, col, 0.95);
                this.hooks.sfx('trowel');
                this.shake = Math.max(this.shake, 0.22);
                for (const [r, c] of e.cells) this.fx.burst(this.X(c), TILE_Y, this.Z(r), { n: 2, color: '#fff6c8', speed: 1, up: 1, size: 0.2, kind: 'spark', life: 0.4 });
                break;
            case 'cross':
                this.fx.beam(-W, z, W, z, col, 1.3); this.fx.beam(x, -D, x, D, col, 1.3);
                this.hooks.sfx('trowel'); this.hooks.sfx('boom');
                this.shake = Math.max(this.shake, 0.4); this.stage.kick(0.2, 1);
                break;
            case 'wide':
                for (const d of [-1, 0, 1]) { this.fx.beam(-W, z + d, W, z + d, col, 1.1); this.fx.beam(x + d, -D, x + d, D, col, 1.1); }
                this.hooks.sfx('boom'); this.hooks.sfx('trowel');
                this.shake = Math.max(this.shake, 0.6); this.stage.kick(0.35, 1.6);
                break;
            case 'bomb': case 'bigbomb': {
                const big = e.s === 'bigbomb';
                this.fx.ring(x, z, '#ffc070', big ? 3.6 : 2.4, 0.5);
                this.fx.ring(x, z, '#ffffff', big ? 2.2 : 1.4, 0.3);
                this.fx.flashLight(x, z, big ? 1.6 : 1);
                this.fx.burst(x, 0.3, z, { n: big ? 26 : 16, kind: 'dust', color: this.theme.soil1, speed: big ? 5 : 3.5, up: 1.6, size: 0.7, life: 1.1, grav: 1.5, grow: true, alpha: 0.75 });
                this.fx.burst(x, TILE_Y, z, { n: big ? 30 : 18, color: '#ffd38a', speed: big ? 7 : 5, up: 3, size: 0.28, life: 0.7 });
                this.shake = Math.max(this.shake, big ? 0.75 : 0.5);
                this.stage.kick(big ? 0.4 : 0.22, big ? 2 : 1.2);
                this.hooks.sfx('boom', { big });
                break;
            }
            case 'sun':
                for (const [r, c] of e.cells) this.fx.bolt(x, z, this.X(c), this.Z(r), '#fff2b0', 0.4, Math.random() * 0.1);
                this.fx.ring(x, z, '#fff2b0', 2.6, 0.5);
                this.fx.flashLight(x, z, 1.4);
                this.stage.kick(0.3, 1.5);
                this.shake = Math.max(this.shake, 0.4);
                this.hooks.sfx('sun');
                break;
            case 'nova':
                this.fx.ring(x, z, '#ffffff', 9, 0.9);
                this.fx.ring(x, z, '#ffd38a', 6, 0.7);
                this.stage.kick(0.9, 3);
                this.shake = 1;
                this.confetti();
                this.hooks.sfx('nova');
                break;
            case 'scarab':
                this.fx.ring(x, z, col, 1.2, 0.3);
                this.hooks.sfx('scarab');
                break;
            default: break;
        }
    }

    animFly(e, dur) {
        const sc = tileModel({ k: 'gem', c: e.color, s: 'scarab' }).group;
        sc.rotation.x = -(Math.PI / 2 - TILT);
        this.tileG.add(sc);
        const x0 = this.X(e.c), z0 = this.Z(e.r), x1 = this.X(e.tc), z1 = this.Z(e.tr);
        this.tween(dur, (q) => {
            const k = easeInOut(q);
            sc.position.set(x0 + (x1 - x0) * k, TILE_Y + Math.sin(q * Math.PI) * 2.2, z0 + (z1 - z0) * k);
            sc.rotation.z = Math.atan2(x1 - x0, -(z1 - z0)) * (q < 0.9 ? 1 : 1 - (q - 0.9) * 10);
            sc.scale.setScalar(0.9 + Math.sin(q * Math.PI) * 0.4);
            if (Math.random() < 0.5) this.fx.burst(sc.position.x, sc.position.y, sc.position.z, { n: 1, color: TILES[e.color].color, speed: 0.3, up: 0, size: 0.25, kind: 'glow', life: 0.4, grav: 0 });
        }, () => {
            this.tileG.remove(sc);
            this.fx.ring(x1, z1, TILES[e.color].color, 1.3, 0.35);
            this.fx.burst(x1, TILE_Y, z1, { n: 12, color: TILES[e.color].color, speed: 3, size: 0.25 });
            this.shake = Math.max(this.shake, 0.2);
            this.hooks.sfx('thud');
        });
        this.hooks.sfx('buzz');
    }

    animConvert(e) {
        const o = this.tiles.get(e.id);
        if (!o) return;
        this.setLook(o, { ...o.data, s: e.s });
        this.fx.burst(this.X(e.c), TILE_Y, this.Z(e.r), { n: 8, color: '#fff2b0', speed: 1.6, size: 0.24 });
        const g = o.obj.group;
        this.tween(0.25, (q) => g.scale.setScalar(1 + Math.sin(q * Math.PI) * 0.35));
        this.hooks.sfx('convert');
    }

    animCreate(e) {
        const o = this.addTile(e.tile, e.r, e.c);
        const g = o.obj.group, x = this.X(e.c), z = this.Z(e.r);
        g.scale.setScalar(0.01);
        this.tween(0.32, (q) => g.scale.setScalar(Math.max(0.01, backOut(q) * 1.0)));
        this.fx.ring(x, z, e.tile.k === 'sun' ? '#fff2b0' : TILES[e.tile.c].color, 1.4, 0.4);
        this.fx.burst(x, TILE_Y, z, { n: 16, color: '#fff6d0', speed: 2.4, up: 2, size: 0.26 });
        this.fx.flashLight(x, z, 0.6);
        this.hooks.sfx('special', { kind: e.tile.k === 'sun' ? 'sun' : e.tile.s });
        this.hooks.ui.specialMade(e.tile, this.toScreen(x, TILE_Y + 0.6, z));
    }

    animCell(e) {
        const x = this.X(e.c), z = this.Z(e.r);
        const ci = e.r * this.C + e.c;
        if (e.type === 'soil') {
            const h = soilH(e.left);
            const from = this.cellH.get(ci) ?? h;
            this.soilV.set(ci, e.left);
            this.tween(0.25, (q) => { this.cellH.set(ci, from + (h - from) * easeOut(q)); this.refreshCellsSoon = true; });
            this.fx.burst(x, 0.3, z, { n: 6, kind: 'dust', color: e.left ? this.theme.soil1 : this.theme.soil2, speed: 1.6, up: 1.2, size: 0.55, life: 0.8, grav: 1, grow: true, alpha: 0.8 });
            this.fx.shatter(x, 0.3, z, this.theme.soil2, 3, 1.8);
            this.hooks.sfx('dirt');
        } else if (e.type === 'fossil') {
            this.fossilV.delete(ci);
            this.refreshCellsSoon = true;
            const bone = instance(tileGeos(5));
            bone.position.set(x, 0.3, z);
            bone.rotation.x = -(Math.PI / 2 - TILT);
            this.tileG.add(bone);
            this.tween(0.75, (q) => {
                bone.position.y = 0.3 + easeOut(Math.min(1, q * 2)) * 1.3;
                bone.rotation.z = q * 6;
                bone.scale.setScalar(q < 0.7 ? 1 + q * 0.4 : (1.28 * (1 - (q - 0.7) / 0.3)) + 0.001);
            }, () => this.tileG.remove(bone));
            this.fx.burst(x, 0.6, z, { n: 20, color: '#fff3c4', speed: 2.4, up: 3, size: 0.3 });
            this.fx.ring(x, z, '#fff3c4', 1.3, 0.4);
            this.hooks.sfx('fossil');
            this.hooks.ui.popup('Fossil!', this.toScreen(x, 1.4, z), '#fff3c4', true);
        } else if (e.type === 'rock') {
            this.setRock(e.r, e.c, e.left);
            if (e.left) this.rocks.get(ci).userData.hp = e.left;
            this.fx.shatter(x, 0.5, z, '#8d8a82', e.left ? 7 : 12, 3.2);
            this.fx.burst(x, 0.4, z, { n: 8, kind: 'dust', color: '#b8b2a6', speed: 2, up: 1.2, size: 0.6, life: 0.9, grav: 0.8, grow: true, alpha: 0.7 });
            this.shake = Math.max(this.shake, 0.18);
            this.hooks.sfx('rock', { left: e.left });
        } else if (e.type === 'crust') {
            const o = this.tiles.get(e.id);
            if (o) this.setLook(o, { ...o.data, crust: e.left });
            this.fx.shatter(x, TILE_Y, z, '#e3c48a', 9, 2.6);
            this.fx.burst(x, TILE_Y, z, { n: 6, kind: 'dust', color: '#e3c48a', speed: 1.5, up: 1, size: 0.5, life: 0.7, grav: 0.8, grow: true, alpha: 0.7 });
            this.hooks.sfx('crust');
        }
    }

    animFall(e) {
        const all = [...e.moves.map((m) => ({ ...m, spawn: false })), ...e.spawns.map((s) => ({ ...s, id: s.tile.id, spawn: true }))];
        const topRow = (c) => { for (let r = 0; r < this.R; r++) if (this.B.mask[r * this.C + c]) return r; return 0; };
        for (const m of all) {
            let o = this.tiles.get(m.id);
            const [r0, c0] = m.path[0];
            if (!o && m.spawn) {
                o = this.addTile(m.tile, r0, c0);
                o.obj.group.scale.setScalar(0.01);
            }
            if (!o) continue;
            const [rEnd, cEnd] = m.path[m.path.length - 1];
            o.r = rEnd; o.c = cEnd;
            const pts = m.path.map(([r, c]) => [this.X(c), this.Z(r)]);
            const segs = [];
            let L = 0;
            for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
            const dur = Math.sqrt((2 * L) / GRAV) + 0.03;
            const g = o.obj.group;
            const top = this.Z(topRow(c0)) - 0.5;
            this.tween(dur, (q) => {
                let s = L * q * q, i = 0;
                while (i < segs.length - 1 && s > segs[i]) { s -= segs[i]; i++; }
                const k = segs[i] ? Math.min(1, s / segs[i]) : 1;
                const x = pts[i][0] + (pts[i + 1]?.[0] - pts[i][0] || 0) * k;
                const z = pts[i][1] + (pts[i + 1]?.[1] - pts[i][1] || 0) * k;
                g.position.set(x, TILE_Y, z);
                if (m.spawn) g.scale.setScalar(Math.max(0.01, Math.min(1, (z - top - 0.05) / 0.45)));
            }, () => { g.position.set(pts[pts.length - 1][0], TILE_Y, pts[pts.length - 1][1]); g.scale.setScalar(1); this.land(o); });
        }
        this.hooks.sfx('fall', { n: all.length });
    }

    animRelic(e) {
        const o = this.tiles.get(e.id);
        const x = this.X(e.c), z = this.Z(e.r);
        this.fx.burst(x, TILE_Y, z, { n: 30, color: '#ffd36a', speed: 3.5, up: 4, size: 0.32 });
        this.fx.ring(x, z, '#ffd36a', 2, 0.5);
        this.fx.flashLight(x, z, 1.2);
        this.stage.kick(0.2, 0.6);
        this.hooks.sfx('relic');
        this.hooks.ui.popup('Relic!', this.toScreen(x, 1.5, z), '#ffd36a', true);
        if (!o) return;
        this.tiles.delete(e.id);
        const g = o.obj.group;
        this.tween(0.5, (q) => {
            g.position.y = TILE_Y + easeIn(q) * 4;
            g.rotation.z = q * 4;
            g.scale.setScalar(1 + q * 0.5);
        }, () => this.tileG.remove(g));
    }

    animShuffle(e) {
        if (e.free) this.hooks.ui.banner('No moves left — shuffling!', 'shuffle');
        this.hooks.sfx('shuffle');
        for (const m of e.moves) {
            const o = this.tiles.get(m.id);
            if (!o) continue;
            const g = o.obj.group;
            const fx = g.position.x, fz = g.position.z, tx = this.X(m.to[1]), tz = this.Z(m.to[0]);
            o.r = m.to[0]; o.c = m.to[1];
            const swirl = Math.random() * Math.PI * 2;
            this.tween(0.7, (q) => {
                const k = easeInOut(q);
                const s = Math.sin(q * Math.PI);
                g.position.set(fx + (tx - fx) * k + Math.cos(swirl + q * 6) * s * 0.8, TILE_Y + s * 1.2, fz + (tz - fz) * k + Math.sin(swirl + q * 6) * s * 0.8);
            });
        }
    }

    animHammer(r, c) {
        const x = this.X(c), z = this.Z(r);
        const h = new Kit();
        h.add(cyl(0.05, 0.06, 1.1, 8), '#9a5b2e', 'gloss', { p: [0, -0.4, 0] });
        h.add(box(0.5, 0.22, 0.22), '#9aa4aa', 'metal', { p: [0, 0.15, 0] });
        const g = h.build();
        g.position.set(x + 0.6, 1.6, z);
        this.tileG.add(g);
        this.tween(0.36, (q) => {
            g.rotation.z = q < 0.6 ? 0.5 + q * 0.4 : 0.74 - easeIn((q - 0.6) / 0.4) * 2.1;
            g.position.y = 1.6 - Math.max(0, q - 0.6) * 1.8;
        }, () => {
            this.tileG.remove(g);
            this.fx.ring(x, z, '#ffffff', 1.4, 0.35);
            this.fx.burst(x, TILE_Y, z, { n: 14, color: '#ffe6a0', speed: 3, size: 0.25 });
            this.shake = Math.max(this.shake, 0.4);
            this.stage.kick(0.15, 0.8);
            this.hooks.sfx('hammer');
        });
    }

    confetti() {
        const cols = ['#ff6b6b', '#ffd93b', '#6bd96b', '#5bb8ff', '#c77dff', '#ffffff'];
        for (let i = 0; i < 6; i++) this.fx.burst((Math.random() - 0.5) * this.C, 2.5, (Math.random() - 0.5) * this.R, { n: 14, color: cols[i], speed: 4, up: 4, size: 0.24, life: 1.6, grav: 4, drag: 1.2 });
    }

    // ------------------------------------------------------------------ input
    bindPointer() {
        const cv = this.stage.canvas;
        let down = null;
        cv.addEventListener('pointerdown', (e) => {
            if (this.enabled && this.rushing) { this.hooks.onSkip?.(); return; }
            if (!this.enabled || this.busy() || !this.B || this.B.state !== 'play') return;
            const cell = this.pick(e.clientX, e.clientY);
            this.idle = 0;
            if (!cell) { this.select(null); return; }
            if (this.hammerMode) { this.hooks.onHammer(cell.r, cell.c); return; }
            if (this.selected && Math.abs(this.selected.r - cell.r) + Math.abs(this.selected.c - cell.c) === 1) {
                const s = this.selected;
                this.select(null);
                this.hooks.onSwap(s.r, s.c, cell.r, cell.c);
                return;
            }
            down = { x: e.clientX, y: e.clientY, cell, id: e.pointerId };
            this.select(cell);
            try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        cv.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== down.id) return;
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            const th = Math.max(14, this.cellPx() * 0.35);
            if (Math.hypot(dx, dy) < th) return;
            const s = down.cell;
            down = null;
            const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
            this.select(null);
            this.hooks.onSwap(s.r, s.c, s.r + dr, s.c + dc);
        });
        const up = (e) => { if (down && e.pointerId === down.id) down = null; };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', up);
    }

    cellPx() {
        const a = this.toScreen(this.X(0), TILE_Y, 0), b = this.toScreen(this.X(1), TILE_Y, 0);
        return Math.abs(b.x - a.x) || 40;
    }

    select(cell) {
        this.selected = cell;
        this.sel.visible = !!cell;
        if (cell) { this.sel.position.set(this.X(cell.c), 0.08 + (this.cellH?.get(cell.r * this.C + cell.c) || 0.1), this.Z(cell.r)); this.hooks.sfx('select'); }
    }

    setCursor(cell) {
        this.cursorAt = cell;
        this.cursor.visible = !!cell;
        if (cell) this.cursor.position.set(this.X(cell.c), 0.09 + (this.cellH?.get(cell.r * this.C + cell.c) || 0.1), this.Z(cell.r));
    }

    /** Screen px (client) → cell, through the canvas rect and the camera. */
    pick(cx, cy) {
        if (!this.B) return null;
        const rect = this.stage.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
        this.root.updateMatrixWorld();
        this.ray.setFromCamera(ndc, this.camera);
        const p = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
        p.sub(this.root.position);
        const c = Math.round(p.x / CELL + (this.C - 1) / 2), r = Math.round(p.z / CELL + (this.R - 1) / 2);
        if (r < 0 || c < 0 || r >= this.R || c >= this.C || !this.B.mask[r * this.C + c]) return null;
        return { r, c };
    }

    toScreen(x, y, z) {
        const v = new THREE.Vector3(x, y, z).add(this.root.position).project(this.camera);
        const rect = this.stage.canvas.getBoundingClientRect();
        return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
    }
    toScreenCell(r, c) { return this.toScreen(this.X(c), TILE_Y, this.Z(r)); }

    // ------------------------------------------------------------------ camera
    setInsets(ins) { this.insets = ins; this.fit(); }

    fit() {
        const w = this.stage.w, h = this.stage.h;
        if (!this.R) return;
        const cam = this.camera;
        cam.aspect = w / h;
        const ins = this.insets;
        const rw = Math.max(100, w - ins.left - ins.right), rh = Math.max(100, h - ins.top - ins.bottom);
        const W = this.C * CELL + 0.9, D = this.R * CELL + 0.9;
        const tan = Math.tan((cam.fov * Math.PI) / 360);
        const needV = (D * Math.cos(TILT) + 0.9) / (2 * tan) * (h / rh);
        const needH = W / (2 * tan * cam.aspect) * (w / rw);
        const d = Math.max(needV, needH) * 1.04;
        this.camDist = d;
        cam.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT));
        cam.lookAt(0, 0.25, 0);
        cam.far = d * 4;
        this.scene.fog.near = d * 1.3;
        this.scene.fog.far = d * 3.2;
        const cx = ins.left + rw / 2, cy = ins.top + rh / 2;
        cam.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
        cam.updateProjectionMatrix();
        this.fx.setScale(h * Math.min(window.devicePixelRatio || 1, 2), cam.fov);
    }

    // ------------------------------------------------------------------ the frame
    frame(dt, time, render = true) {
        this.time = time;
        this.frames++;
        // the script
        if (!this.tl && this.queue.length) this.tl = this.schedule(this.queue.shift());
        if (this.tl) {
            const tl = this.tl;
            tl.t += dt;
            while (tl.i < tl.acts.length && tl.acts[tl.i].t <= tl.t) tl.acts[tl.i++].fn();
            if (tl.t >= tl.end && tl.i >= tl.acts.length && !this.tweens.some((q) => q.t < q.dur)) {
                this.tl = null;
                if (!this.queue.length) { this.rushing = false; this.sync(); this.hooks.onIdle?.(); }
            }
        }
        // tweens
        for (let i = 0; i < this.tweens.length; i++) {
            const tw = this.tweens[i];
            tw.t += dt;
            if (tw.t < 0) continue;
            const q = Math.min(1, tw.t / tw.dur);
            tw.fn(q);
            if (q >= 1) { tw.end?.(); this.tweens.splice(i--, 1); }
        }
        if (this.refreshCellsSoon) { this.refreshCellsSoon = false; this.refreshCells(); }
        // idle life: bobbing, spinning coins, glowing specials, landing squash
        this.idle += dt;
        sunMaterial().uniforms.uTime.value = time;
        auraMaterial().uniforms.uTime.value = time;
        for (const [id, o] of this.tiles) {
            const b = o.obj.body;
            if (!b) continue;
            const ph = id * 1.7;
            // a slow, small sway for every find; coins used to swing ±0.5 rad and flash
            b.rotation.y = Math.sin(time * 0.9 + ph) * 0.08;
            b.position.y = this.still ? 0 : Math.sin(time * 2 + ph) * 0.025;
            if (o.data.k === 'sun') { b.userData.spin.rotation.z = time * 1.5; b.userData.orb.rotation.y = time; }
            if (o.obj.overlay?.userData.pulse) for (const m of o.obj.overlay.userData.pulse) m.scale.y = 1 + Math.sin(time * 8) * 0.25;
            if (o.sq > 0) {
                o.sq = Math.max(0, o.sq - dt * 5);
                const s = Math.sin(o.sq * Math.PI);
                b.scale.set(1 + s * 0.16, 1 - s * 0.2, 1);
            } else b.scale.set(1, 1, 1);
        }
        if (this.selected && this.sel.visible) {
            const o = this.at(this.selected.r, this.selected.c);
            if (o) o.obj.body.position.y = 0.06 + Math.abs(Math.sin(time * 7)) * 0.08;
            this.sel.scale.setScalar(1 + Math.sin(time * 6) * 0.05);
        }
        // a hint after a quiet while
        if (this.enabled && !this.busy() && this.idle > 6 && this.B?.state === 'play' && this.hooks.hintMove) {
            const m = this.hooks.hintMove();
            if (m) {
                for (const [r, c] of m) {
                    const o = this.at(r, c);
                    if (o) o.obj.group.scale.setScalar(1 + Math.max(0, Math.sin(time * 6)) * 0.12);
                }
                this.hinting = m;
            }
        } else if (this.hinting) {
            for (const [r, c] of this.hinting) { const o = this.at(r, c); if (o && !this.busy()) o.obj.group.scale.setScalar(1); }
            this.hinting = null;
        }
        // camera: settle in, breathe, shake
        this.shake = Math.max(0, this.shake - dt * 1.8);
        const s = this.shakeOn === false ? 0 : this.shake * this.shake * 0.35;
        this.root.position.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.5, (Math.random() - 0.5) * s);
        this.fx.update(dt);
        if (render) this.stage.render(this.scene, this.camera, dt, time, this.theme?.night ? { bloom: 0.75, threshold: 0.9, vignette: 0.45, warm: 0.3, exposure: 1.05 } : { bloom: 0.55, threshold: 1.3, vignette: 0.32, warm: 0.55, exposure: 0.95 });
    }
}

// ------------------------------------------------------------------ helpers
const soilH = (n) => (n === 2 ? 0.34 : n === 1 ? 0.24 : 0.1);
function lookKey(t) { return `${t.k}|${t.c}|${t.s || ''}|${t.crust || 0}|${t.item ?? ''}`; }
function pathLen(path) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return L; }
const easeIn = (q) => q * q;
const easeOut = (q) => 1 - (1 - q) * (1 - q);
const easeInOut = (q) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
const backOut = (q) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (q - 1) ** 3 + c1 * (q - 1) ** 2; };
function shadeHex(hex, k) { const c = new THREE.Color(hex); c.lerp(new THREE.Color(k > 0 ? 0xffffff : 0x000000), Math.abs(k)); return '#' + c.getHexString(); }

function squareMarker(color) {
    const shape = new THREE.Shape();
    const o = 0.5, i = 0.42, rr = 0.1;
    shape.moveTo(-o + rr, -o); shape.lineTo(o - rr, -o); shape.quadraticCurveTo(o, -o, o, -o + rr); shape.lineTo(o, o - rr); shape.quadraticCurveTo(o, o, o - rr, o); shape.lineTo(-o + rr, o); shape.quadraticCurveTo(-o, o, -o, o - rr); shape.lineTo(-o, -o + rr); shape.quadraticCurveTo(-o, -o, -o + rr, -o);
    const hole = new THREE.Path();
    hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
    shape.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 12;
    return m;
}

/** Sand: MeshStandard with wind ripples and damp patches painted in world space. */
function sandMaterial() {
    const m = new THREE.MeshStandardMaterial({ color: 0xe9cf98, roughness: 1, metalness: 0 });
    const u = { uSand2: { value: new THREE.Color(0xdcbd82) } };
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uSand2 = u.uSand2;
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform vec3 uSand2;\nvarying vec3 vWP;\n' + /* glsl */`
            float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float nn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
        ` + sh.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
            {
                vec2 p = vWP.xz;
                float n = nn(p * 0.35) * 0.6 + nn(p * 1.3) * 0.3 + nn(p * 5.0) * 0.1;
                float rip = sin(p.x * 3.2 + p.y * 1.1 + nn(p * 0.5) * 6.0) * 0.5 + 0.5;
                diffuseColor.rgb = mix(diffuseColor.rgb, uSand2, clamp(n * 0.9 + rip * 0.18, 0.0, 1.0));
                diffuseColor.rgb *= 0.92 + hh(floor(p * 40.0)) * 0.1;
            }`);
    };
    m.customProgramCacheKey = () => 'sand';
    return m;
}

// little dig-site props
function bucket() {
    const k = new Kit();
    k.add(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 18, 1, true), '#3a8ac4', 'gloss', { p: [0, 0.25, 0] });
    k.add(cyl(0.26, 0.26, 0.02, 18), '#2e6e9c', 'gloss', { p: [0, 0.01, 0] });
    k.add(cyl(0.32, 0.32, 0.06, 18), '#c9a46a', 'flat', { p: [0, 0.42, 0] });
    k.add(torus(0.33, 0.015, 4, 20, Math.PI), '#9aa4aa', 'metal', { p: [0, 0.5, 0], r: [0, 0, 0] });
    k.add(cyl(0.025, 0.03, 0.7, 6), '#a45a2a', 'gloss', { p: [0.1, 0.6, 0.05], r: [0.3, 0, -0.4] });
    return k.build();
}
function sieve() {
    const k = new Kit();
    k.add(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 24, 1, true), '#b07a48', 'flat', { p: [0, 0.12, 0] });
    k.add(cyl(0.54, 0.54, 0.01, 24), '#c9c2b0', 'metal', { p: [0, 0.05, 0] });
    for (let i = 0; i < 9; i++) k.add(bumpy(new THREE.IcosahedronGeometry(0.06 + (i % 3) * 0.02, 0), 0.02, 4, i), i === 4 ? '#e9c24e' : '#9a8a72', i === 4 ? 'gold' : 'flat', { p: [Math.cos(i * 2.4) * 0.3 * (i / 9), 0.1, Math.sin(i * 2.4) * 0.3 * (i / 9)] });
    return k.build();
}
function brushes() {
    const k = new Kit();
    for (let i = 0; i < 3; i++) {
        k.add(cyl(0.025, 0.03, 0.5, 6), ['#c23a3a', '#3a8a5a', '#d9a63a'][i], 'gloss', { p: [i * 0.18, 0.04, 0], r: [Math.PI / 2, 0, 0.2 * i] });
        k.add(box(0.12, 0.05, 0.12), '#f0d8a0', 'fur', { p: [i * 0.18 + 0.05 * i, 0.04, 0.3] });
    }
    k.add(extrude2([[0, 0.2], [0.12, 0], [0, -0.06], [-0.12, 0]]), '#c9d2d8', 'metal', { p: [-0.4, 0.02, 0.2], r: [-Math.PI / 2, 0, 0.4] });
    return k.build();
}
function extrude2(pts) {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
}
function clipboard() {
    const k = new Kit();
    k.add(box(0.6, 0.03, 0.8), '#9a6a3a', 'gloss', { p: [0, 0.02, 0] });
    k.add(box(0.52, 0.01, 0.68), '#fbf7ee', 'matte', { p: [0, 0.04, 0.03] });
    for (let i = 0; i < 6; i++) k.add(box(0.36 - (i % 3) * 0.06, 0.005, 0.02), '#6a7a8a', 'matte', { p: [-0.03, 0.05, -0.2 + i * 0.09] });
    k.add(box(0.2, 0.04, 0.06), '#aeb7bd', 'metal', { p: [0, 0.05, -0.36] });
    k.add(cyl(0.015, 0.015, 0.5, 6), '#2a5a9a', 'gloss', { p: [0.36, 0.03, 0.1], r: [Math.PI / 2, 0, 0.3] });
    return k.build();
}
function rocksPile() {
    const k = new Kit();
    for (let i = 0; i < 5; i++) k.add(bumpy(new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.1, 1), 0.05, 3, i + 40), i % 2 ? '#9a958b' : '#8a857b', 'flat', { p: [Math.cos(i * 2.2) * 0.4, 0.12 + (i === 0 ? 0.2 : 0), Math.sin(i * 2.2) * 0.35] });
    return k.build();
}
function parasol() {
    const k = new Kit();
    k.add(cyl(0.035, 0.04, 2.4, 8), '#e8e0d0', 'gloss', { p: [0, 1.2, 0] });
    const segs = 8;
    for (let i = 0; i < segs; i++) {
        const g = new THREE.ConeGeometry(1.4, 0.5, segs, 1, true, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs);
        k.add(g, i % 2 ? '#f2f0e8' : '#e2503a', 'fur', { p: [0, 2.45, 0] });
    }
    return k.build();
}
function lantern() {
    const k = new Kit();
    k.add(cyl(0.03, 0.03, 1.0, 6), '#4a3a2a', 'flat', { p: [0, 0.5, 0] });
    k.add(cyl(0.12, 0.12, 0.22, 8), '#ffd27a', 'glow', { p: [0, 1.1, 0] });
    k.add(cone(0.16, 0.12, 8), '#2f3a44', 'metal', { p: [0, 1.27, 0] });
    return k.build();
}

export { TILE_Y, CELL, TILT, noise3, sphere, tube };
