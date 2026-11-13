// HOLLOWDEEP — the first-person dungeon in three.js. Reads G; never changes it.
//
// PS2 look: the scene renders into a small buffer (about 448 lines tall) that the browser scales up smoothly, the
// walls are the painted fal textures with Gouraud (Lambert) lighting, a warm torch rides with the party, and fog in
// the stratum's colour closes the corridor down. Monsters that walk the halls (the guardian, the Lantern Reaper) are
// painted 2D sprites standing in their cells, as in the classic first-person dungeon crawlers.
//
// Sim (x, y) on the grid maps to world (x * S, 0, y * S). Facing 0 (north, y-1) looks down world -Z.

import * as THREE from 'three';
import { getFloor, open, DX, DY } from '../sim/dungeon.js';
import { stratumOf, STRATA } from '../sim/data/monsters.js';
import { floorState, spotQuest, tileAt } from '../sim/game.js';
import { hash3 } from '../rng.js';
import { Models } from './models.js';

const S = 2;            // cell size in world units
const H = 2.3;          // wall height
const EYE = 1.08;
const YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];   // facing → camera yaw (rotation.y)

export class DungeonView {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.12);
        this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
        this.camera.rotation.order = 'YXZ';
        this.amb = new THREE.HemisphereLight(0x8090a0, 0x201810, 0.55);
        this.scene.add(this.amb);
        this.torch = new THREE.PointLight(0xffb36a, 16, 12, 1.7);
        this.scene.add(this.torch);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.loader = new THREE.TextureLoader();
        this.tex = {};
        this.spriteTex = {};
        this.retro = true;
        this.floorKey = null;
        this.pos = { x: 0, z: 0, yaw: 0 };
        this.anim = null;          // { from, to, t, dur }
        this.shake = 0;
        this.speed = 1;
        this.time = 0;
        this.hidden = true;
        this.props = {};
        this.build_n = 0;
        this.models = new Models();
        this.models.preload();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setRetro(on) { this.retro = on; this.w = 0; this.resize(); document.body.classList.toggle('retro', on); }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        // the PS2 drew about 448 lines; scale the buffer to that and let the browser smooth it up
        const pr = this.retro ? Math.min(1, 448 / h) : Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        // keep the corridor readable on a tall phone: widen the horizontal view, not the vertical
        this.camera.fov = w / h < 0.8 ? 82 : 68;
        this.camera.updateProjectionMatrix();
    }

    get busy() { return !!this.anim; }

    // ------------------------------------------------------------ textures
    _texture(url, fallbackTint) {
        if (this.tex[url]) return this.tex[url];
        // the painted texture; if it can't be loaded, a noise texture in the stratum's colour takes its place
        const t = this.loader.load(url, undefined, undefined, () => {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const g = c.getContext('2d');
            const col = new THREE.Color(fallbackTint);
            for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) {
                const v = 0.55 + hash3(x, y, 7) * 0.35;
                g.fillStyle = `rgb(${(col.r * 255 * v) | 0},${(col.g * 255 * v) | 0},${(col.b * 255 * v) | 0})`;
                g.fillRect(x, y, 4, 4);
            }
            const f = new THREE.CanvasTexture(c);
            f.colorSpace = THREE.SRGBColorSpace;
            f.wrapS = f.wrapT = THREE.RepeatWrapping;
            for (const m of this._mats || []) if (m.map === t) { m.map = f; m.needsUpdate = true; }
        });
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        this.tex[url] = t;
        return t;
    }

    _spriteTexture(url) {
        if (this.spriteTex[url]) return this.spriteTex[url];
        const t = this.loader.load(url);
        t.colorSpace = THREE.SRGBColorSpace;
        this.spriteTex[url] = t;
        return t;
    }

    _glowTexture(color) {
        const key = 'glow' + color;
        if (this.spriteTex[key]) return this.spriteTex[key];
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        const col = new THREE.Color(color);
        const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
        grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.3, `rgba(${rgb},0.5)`); grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        this.spriteTex[key] = t;
        return t;
    }

    // ------------------------------------------------------------ the floor
    _clear() {
        this.root.traverse((o) => { if (o.userData.shared) return; if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map === undefined) o.material.dispose?.(); });
        this.root.clear();
        this.props = {};
        this.build_n++;
    }

    build(G) {
        const key = `${G.seed}:${G.floor}`;
        if (key === this.floorKey) return;
        this.floorKey = key;
        this._clear();
        const f = getFloor(G.seed, G.floor);
        const { stratum, cycle } = stratumOf(G.floor);
        this.stratum = stratum;
        const tint = new THREE.Color(stratum.tint);
        // the Echoes are the same strata, darker and stranger
        const echo = cycle > 0 ? new THREE.Color().setHSL((cycle * 0.17) % 1, 0.35, 0.55) : null;
        this.scene.fog.color.set(stratum.fog);
        this.scene.fog.density = 0.115 + Math.min(0.04, G.floor * 0.0008);
        this.renderer.setClearColor(stratum.fog);
        this.torch.color.set(stratum.light);
        this.amb.color.set(0xffffff).lerp(new THREE.Color(stratum.tint), 0.35);
        this.amb.groundColor.set(0x8a7f70).lerp(new THREE.Color(stratum.fog), 0.3);
        const wallTex = this._texture(`art/tex/${stratum.id}-wall.webp`, stratum.tint);
        const floorTex = this._texture(`art/tex/${stratum.id}-floor.webp`, stratum.fog);
        const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, vertexColors: true });
        const floorMat = new THREE.MeshLambertMaterial({ map: floorTex, vertexColors: true });
        const ceilMat = new THREE.MeshLambertMaterial({ map: wallTex, vertexColors: true, color: 0x4a4440 });
        this._mats = [wallMat, floorMat, ceilMat];
        if (echo) { wallMat.color.copy(echo).lerp(new THREE.Color(1, 1, 1), 0.45); floorMat.color.copy(wallMat.color); }

        const wall = { p: [], uv: [], c: [], i: [] }, flo = { p: [], uv: [], c: [], i: [] }, ceil = { p: [], uv: [], c: [], i: [] };
        const quad = (buf, a, b, c, d, cols) => {
            const n = buf.p.length / 3;
            buf.p.push(...a, ...b, ...c, ...d);
            buf.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
            for (const k of cols) buf.c.push(k, k, k);
            buf.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
        };
        const isOpen = (x, y) => open(f, x, y);
        for (let y = 0; y < f.h; y++) {
            for (let x = 0; x < f.w; x++) {
                if (!isOpen(x, y)) continue;
                const x0 = x * S - S / 2, x1 = x * S + S / 2, z0 = y * S - S / 2, z1 = y * S + S / 2;
                // corners darken where walls meet (a little baked ambient occlusion)
                const ao = (dx, dy) => 1 - 0.22 * ((!isOpen(x + dx, y) ? 1 : 0) + (!isOpen(x, y + dy) ? 1 : 0) + (!isOpen(x + dx, y + dy) ? 0.5 : 0));
                // the down stairs are a hole in the floor (the stairwell model hangs in it)
                if (x !== f.down.x || y !== f.down.y) quad(flo, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [ao(-1, 1), ao(1, 1), ao(1, -1), ao(-1, -1)]);
                quad(ceil, [x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], [0.7, 0.7, 0.7, 0.7]);
                // walls face into the cell; bottom edge darker
                const lo = 0.62, hi = 1.0;
                if (!isOpen(x, y - 1)) quad(wall, [x0, 0, z0], [x1, 0, z0], [x1, H, z0], [x0, H, z0], [lo, lo, hi, hi]);
                if (!isOpen(x, y + 1)) quad(wall, [x1, 0, z1], [x0, 0, z1], [x0, H, z1], [x1, H, z1], [lo, lo, hi, hi]);
                if (!isOpen(x - 1, y)) quad(wall, [x0, 0, z1], [x0, 0, z0], [x0, H, z0], [x0, H, z1], [lo, lo, hi, hi]);
                if (!isOpen(x + 1, y)) quad(wall, [x1, 0, z0], [x1, 0, z1], [x1, H, z1], [x1, H, z0], [lo, lo, hi, hi]);
            }
        }
        const mesh = (buf, mat) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(buf.p, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
            g.setAttribute('color', new THREE.Float32BufferAttribute(buf.c, 3));
            g.setIndex(buf.i);
            g.computeVertexNormals();
            const m = new THREE.Mesh(g, mat);
            this.root.add(m);
            return m;
        };
        mesh(wall, wallMat); mesh(flo, floorMat); mesh(ceil, ceilMat);
        this._props(G, f, tint);
        // snap the camera to the party
        this.pos = { x: G.pos.x * S, z: G.pos.y * S, yaw: YAW[G.pos.d] };
        this.anim = null;
    }

    _box(w, h, d, color, x, y, z, parent = this.root, mat) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    }

    _sprite(url, h, x, z, y0 = 0, { glow, aspect = 1 } = {}) {
        const mat = new THREE.SpriteMaterial({ map: url.startsWith('glow') ? this._glowTexture(url.slice(4)) : this._spriteTexture(url), transparent: true, depthWrite: false, fog: true });
        const s = new THREE.Sprite(mat);
        s.scale.set(h * aspect, h, 1);
        s.position.set(x, y0 + h / 2, z);
        this.root.add(s);
        if (glow) {
            const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTexture(glow), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
            g.scale.set(h * 1.4, h * 1.4, 1);
            g.position.set(x, y0 + h / 2, z - 0.01);
            this.root.add(g);
            s.userData.glow = g;
        }
        return s;
    }

    /** Put a Meshy model (js/view/models.js) in `g`. Until it loads, or if it can't, `fallback(g)` builds the old
     *  box version in its place. */
    _place(id, g, fallback, tint) {
        const add = (model) => {
            // stone models take the stratum's colour, like the walls (the material is shared, so this is per floor)
            if (tint) model.traverse((o) => { if (o.isMesh) o.material.color.set(0xffffff).lerp(tint, 0.45); });
            g.add(model);
        };
        const m = this.models.get(id);
        if (m) { add(m); return; }
        const fb = new THREE.Group();
        fallback(fb);
        g.add(fb);
        const n = this.build_n;
        this.models.load(id, (model) => { if (this.build_n !== n) return; g.remove(fb); add(model); });
    }

    /** The one open side of a dead end (chests, the stairs and the quest spot all sit in dead ends). */
    _openSide(f, x, y) { for (let k = 0; k < 4; k++) if (open(f, x + DX[k], y + DY[k])) return k; return 0; }

    _props(G, f) {
        const wood = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const brass = new THREE.MeshLambertMaterial({ color: 0xc9a24a, emissive: 0x221100 });
        this.stone = this._texture(`art/tex/${this.stratum.id}-wall.webp`, this.stratum.tint);
        const stone = new THREE.MeshLambertMaterial({ map: this.stone, color: 0xbbbbbb });
        const tint = new THREE.Color(this.stratum.tint);
        const shaft = new THREE.MeshLambertMaterial({ map: this.stone, color: 0x8a8580, side: THREE.BackSide });
        // stairs up: a flight of stone steps climbing into the back wall of the dead end, behind the party as it arrives
        // (the group's +Z is behind the party)
        {
            const g = new THREE.Group();
            const steps = new THREE.Group();
            steps.position.z = 0.55;
            this._place('stairs_up', steps, (p) => { for (let i = 0; i < 4; i++) this._box(1.6, 0.28 * (i + 1), 0.22, 0, 0, 0.14 * (i + 1), -0.15 + i * 0.2, p, stone); }, tint);
            g.add(steps);
            g.position.set(f.start.x * S, 0, f.start.y * S);
            g.rotation.y = YAW[f.start.d];
            this.root.add(g);
            this._sprite('glow#ffe0a0', 1.4, f.start.x * S - DX[f.start.d] * 0.7, f.start.y * S - DY[f.start.d] * 0.7, 1.0).material.opacity = 0.3;
        }
        // stairs down: the floor has a hole here and a flight of steps goes down into it from the way in; the shaft
        // is lined with the walls' stone, and a faint glow comes up from below
        {
            const g = new THREE.Group();
            const pit = new THREE.Mesh(new THREE.BoxGeometry(S, 2.6, S), shaft);
            pit.position.y = -1.3; g.add(pit);
            this._place('stairs_down', g, (p) => {
                const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                hole.rotation.x = -Math.PI / 2; hole.position.y = 0.0; p.add(hole);
                for (const [w, d, x, z] of [[1.7, 0.1, 0, -0.8], [1.7, 0.1, 0, 0.8], [0.1, 1.7, -0.8, 0], [0.1, 1.7, 0.8, 0]]) this._box(w, 0.08, d, 0, x, 0.04, z, p, brass);
                const rim = new THREE.Mesh(new THREE.PlaneGeometry(S, S), stone);   // the floor the hole was cut from
                rim.rotation.x = -Math.PI / 2; rim.position.y = -0.01; p.add(rim);
            }, tint);
            g.position.set(f.down.x * S, 0, f.down.y * S);
            g.rotation.y = YAW[this._openSide(f, f.down.x, f.down.y)];   // the top of the flight (-Z) toward the way in
            this.root.add(g);
            this._sprite(`glow#${new THREE.Color(this.stratum.light).getHexString()}`, 1.2, f.down.x * S, f.down.y * S, -0.6).material.opacity = 0.45;
        }
        // chests: a closed one, swapped for the open one (with a little hop) when it is opened
        const st = floorState(G, G.floor);
        this.props.chests = f.chests.map((c, i) => {
            const g = new THREE.Group();
            const shut = new THREE.Group(), opened = new THREE.Group();
            this._place('chest_closed', shut, (p) => {
                this._box(0.9, 0.5, 0.6, 0, 0, 0.25, 0, p, wood);
                for (const x of [-0.3, 0.3]) this._box(0.08, 0.52, 0.62, 0, x, 0.26, 0, p, brass);
                this._box(0.9, 0.18, 0.6, 0, 0, 0.59, 0, p, wood);
                this._box(0.12, 0.12, 0.05, 0, 0, 0.5, 0.32, p, brass);
            });
            this._place('chest_open', opened, (p) => {
                this._box(0.9, 0.5, 0.6, 0, 0, 0.25, 0, p, wood);
                for (const x of [-0.3, 0.3]) this._box(0.08, 0.52, 0.62, 0, x, 0.26, 0, p, brass);
                const lid = this._box(0.9, 0.6, 0.18, 0, 0, 0.75, -0.36, p, wood);
                lid.rotation.x = -0.25;
            });
            g.add(shut, opened);
            g.position.set(c.x * S, 0, c.y * S);
            g.rotation.y = YAW[this._openSide(f, c.x, c.y)] + Math.PI;   // the lock faces the way in
            this.root.add(g);
            const was = st.opened.includes(i) ? 1 : 0;
            shut.visible = !was; opened.visible = !!was;
            return { g, shut, opened, i, open: was };
        });
        // the fountain
        if (f.fountain) {
            const g = new THREE.Group();
            this._place('fountain', g, (p) => {
                const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.45, 14, 1, true), stone);
                basin.position.y = 0.22; p.add(basin);
                const water = new THREE.Mesh(new THREE.CircleGeometry(0.68, 16), new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.8 }));
                water.rotation.x = -Math.PI / 2; water.position.y = 0.4; p.add(water);
                const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 8), stone);
                pillar.position.y = 0.6; p.add(pillar);
            });
            g.position.set(f.fountain.x * S, 0, f.fountain.y * S);
            this.root.add(g);
            this.props.fountain = this._sprite('glow#60d8ff', 1.6, f.fountain.x * S, f.fountain.y * S, 0.1);
            this.props.fountain.material.opacity = 0.45;
        }
        // wall torches: an iron sconce with a flame and a glow on some walls (no extra lights; they'd cost the phones)
        this.props.flames = [];
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
            if (!open(f, x, y) || hash3(x, y, G.floor * 13) > 0.09) continue;
            for (let k = 0; k < 4; k++) {
                if (open(f, x + DX[k], y + DY[k])) continue;
                const wx = x * S + DX[k] * (S / 2), wz = y * S + DY[k] * (S / 2);
                const g = new THREE.Group();
                g.position.set(wx, 1.0, wz);
                g.rotation.y = YAW[k];        // the backplate on the wall, the torch toward the cell
                this._place('sconce', g, (p) => this._box(0.06, 0.25, 0.06, 0, 0, 0.45, 0.08, p, brass));
                this.root.add(g);
                const fl = this._sprite('glow#ffb050', 0.42, wx - DX[k] * 0.09, wz - DY[k] * 0.09, 1.42);
                fl.material.blending = THREE.AdditiveBlending;
                this.props.flames.push(fl);
                break;
            }
        }
        // the guardian
        if (f.boss) {
            const mid = this.stratum.boss;
            const s = this._sprite(`art/mon/${mid}.webp`, 2.15, f.boss.x * S, f.boss.y * S, 0, { glow: '#9a60ff', aspect: this._aspect(mid) });
            this.props.boss = s;
        }
        // quest spot: a glint, or a lost delver slumped against the back wall of the dead end
        if (f.spot) {
            const glint = this._sprite('glow#ffe080', 0.7, f.spot.x * S, f.spot.y * S, 0.3);
            glint.material.blending = THREE.AdditiveBlending;
            const delver = new THREE.Group();
            delver.position.set(f.spot.x * S, 0, f.spot.y * S);
            delver.rotation.y = YAW[this._openSide(f, f.spot.x, f.spot.y)] + Math.PI;   // facing the way in
            const body = new THREE.Group();
            body.position.z = -0.45;
            this._place('delver', body, (p) => {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glowTexture('#9fd0ff'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
                s.scale.set(1.6, 1.6, 1); s.position.y = 1.0; p.add(s);
            });
            delver.add(body);
            this.root.add(delver);
            this.props.glint = glint; this.props.delver = delver;
        }
        // the reaper (positioned every frame)
        this.props.reaper = this._sprite('art/mon/reaper.webp', 1.9, 0, 0, 0, { glow: '#60ff9a', aspect: this._aspect('reaper') });
        this.props.reaperPos = null;
    }

    _aspect(mid) {
        const s = this.spriteSizes?.[mid];
        return s ? s[0] / s[1] : 0.75;
    }

    // ------------------------------------------------------------ events and frames
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'floor' || e.type === 'enter') { this.floorKey = null; this.build(G); }
            else if (e.type === 'step' || e.type === 'turn') this._go(G, e.type === 'turn' ? 0.13 : 0.17);
            else if (e.type === 'bump') this.shake = 0.25;
            else if (e.type === 'battle') this.shake = 0.35;
        }
    }

    _go(G, dur) {
        const to = { x: G.pos.x * S, z: G.pos.y * S, yaw: YAW[G.pos.d] };
        // turn the short way round
        let dy = to.yaw - this.pos.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        to.yaw = this.pos.yaw + dy;
        this.anim = { from: { ...this.pos }, to, t: 0, dur: dur / this.speed };
    }

    frame(G, dt) {
        this.time += dt;
        this.resize();
        if (!G || !G.floor) return;
        this.build(G);
        if (this.anim) {
            const a = this.anim;
            a.t += dt;
            const k = Math.min(1, a.t / a.dur);
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            this.pos = { x: a.from.x + (a.to.x - a.from.x) * e, z: a.from.z + (a.to.z - a.from.z) * e, yaw: a.from.yaw + (a.to.yaw - a.from.yaw) * e };
            if (k >= 1) { this.anim = null; this.pos.yaw = YAW[G.pos.d]; }
        } else this.pos = { x: G.pos.x * S, z: G.pos.y * S, yaw: YAW[G.pos.d] };
        const bob = this.anim ? Math.sin((this.anim.t / this.anim.dur) * Math.PI) * 0.04 : 0;
        this.shake = Math.max(0, this.shake - dt);
        const sh = this.shake * 0.08;
        this.camera.position.set(this.pos.x + (Math.random() - 0.5) * sh, EYE + bob + (Math.random() - 0.5) * sh, this.pos.z);
        this.camera.rotation.set(-0.02, this.pos.yaw, 0);
        // the torch sways and flickers a little ahead of the party
        const fx = -Math.sin(this.pos.yaw) * 0.15, fz = -Math.cos(this.pos.yaw) * 0.15;
        this.torch.position.set(this.pos.x + fx, 1.35, this.pos.z + fz);
        this.torch.intensity = 15 + Math.sin(this.time * 9) * 1.1 + Math.sin(this.time * 23.7) * 0.9;
        // props
        const st = floorState(G, G.floor);
        for (const c of this.props.chests || []) {
            const isOpen = st.opened.includes(c.i);
            c.open = Math.max(0, Math.min(1, c.open + (isOpen ? 1 : -1) * dt * 2.5));
            c.shut.visible = c.open < 0.35; c.opened.visible = !c.shut.visible;
            c.g.scale.setScalar(1 + Math.sin(c.open * Math.PI) * 0.14);   // a hop as the lid flies up
        }
        if (this.props.fountain) this.props.fountain.material.opacity = 0.42 + Math.sin(this.time * 3) * 0.06;
        for (const [i, fl] of (this.props.flames || []).entries()) { const s = 0.5 + Math.sin(this.time * 11 + i * 1.7) * 0.06; fl.scale.set(s, s * 1.3, 1); }
        if (this.props.boss) {
            const f = getFloor(G.seed, G.floor);
            this.props.boss.visible = !G.bossDown[G.floor];
            if (this.props.boss.userData.glow) this.props.boss.userData.glow.visible = this.props.boss.visible;
            this.props.boss.position.y = 2.15 / 2 + Math.sin(this.time * 1.6) * 0.03;
            void f;
        }
        if (this.props.glint) {
            const t = tileAt(G, ...this._spotXY(G));
            this.props.glint.visible = t === 'glint';
            this.props.delver.visible = t === 'delver';
            this.props.glint.position.y = 0.6 + Math.sin(this.time * 3) * 0.08;
            this.props.glint.material.rotation = this.time;
        }
        const r = st.reaper;
        const rs = this.props.reaper;
        rs.visible = !!r;
        rs.userData.glow.visible = !!r;
        if (r) {
            const tx = r.x * S, tz = r.y * S;
            if (!this.props.reaperPos) this.props.reaperPos = { x: tx, z: tz };
            const p = this.props.reaperPos;
            p.x += (tx - p.x) * Math.min(1, dt * 5); p.z += (tz - p.z) * Math.min(1, dt * 5);
            rs.position.set(p.x, 0.95 + Math.sin(this.time * 2.2) * 0.06, p.z);
            rs.userData.glow.position.set(p.x, 0.95, p.z);
        }
        this.renderer.render(this.scene, this.camera);
    }

    _spotXY(G) { const f = getFloor(G.seed, G.floor); return f.spot ? [f.spot.x, f.spot.y] : [-1, -1]; }

    /** Is the cell visible in front of the camera? (used by the browser test to check sprites are on screen) */
    project(x, y, h = 1) {
        const v = new THREE.Vector3(x * S, h, y * S).project(this.camera);
        return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, inFront: v.z < 1 };
    }

    /** Draw the scene once more and read a few pixels back (the browser test checks the screen is not blank). */
    sample() {
        this.renderer.render(this.scene, this.camera);
        const gl = this.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const px = new Uint8Array(4 * 64);
        const out = [];
        for (let i = 0; i < 64; i++) {
            const x = Math.floor(((i % 8) + 0.5) / 8 * w), y = Math.floor((Math.floor(i / 8) + 0.5) / 8 * h);
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(i * 4, i * 4 + 4));
            out.push((px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3);
        }
        return out;
    }
}

export { S as CELL, STRATA };
