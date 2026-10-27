// The 3D view. A three.js scene rendered at 320×200 and quantized to EGA by post.js. It reads G and
// the events drained from the sim, and never writes to G.
//
// Grid dungeon: cell (x, y) is the square [x, x+1] × [y, y+1] in world (x, z); north is -z. The camera
// stands in the middle of a cell, 0.5 up, and turns in quarter circles.

import * as THREE from 'three';
import { hash3 } from '../rng.js';
import { getEdge, featAt } from '../sim/dungeon.js';
import { RES_W, RES_H, makePost } from './post.js';
import { buildAtlas, COLS, ROWS, TILE } from './textures.js';
import { monsterCanvas, npcCanvas, featureCanvas } from './sprites.js';
import { TownScene } from './town3d.js';

THREE.ColorManagement.enabled = false;

const CHUNK = 8;
const nearest = (tex) => { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; return tex; };
const spriteTex = (canvas) => { const t = nearest(new THREE.CanvasTexture(canvas)); return t; };

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(RES_W, RES_H, false);
        this.renderer.setClearColor(0x000000, 1);
        this.rt = new THREE.WebGLRenderTarget(RES_W, RES_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
        this.post = makePost(this.rt.texture);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 0.5, 7);
        this.camera = new THREE.PerspectiveCamera(64, RES_W / RES_H, 0.04, 40);
        this.camera.position.set(0.5, 0.5, 0.5);
        this.scene.add(this.camera);
        this.dungeon = new THREE.Group();
        this.scene.add(this.dungeon);
        this.featGroup = new THREE.Group();
        this.scene.add(this.featGroup);
        this.battleGroup = new THREE.Group();
        this.camera.add(this.battleGroup);
        // the battle room: a hall in the floor's own walls, entered by a fade, left by a fade
        this.arenaScene = new THREE.Scene();
        this.arenaScene.background = new THREE.Color(0x000000);
        this.arenaScene.fog = new THREE.Fog(0x000000, 0.6, 9);
        this.arenaCam = new THREE.PerspectiveCamera(64, RES_W / RES_H, 0.04, 40);
        this.arenaScene.add(this.arenaCam);
        this.arena = null;
        this.arenaZ = 2.4;
        this.inArena = false;

        this.town = new TownScene();
        this.mode = 'town';
        this.floor = null;
        this.floorKey = '';
        this.chunks = [];
        this.featSprites = new Map();
        this.atlas = null;
        this.enemies = [];
        this.time = 0;
        // pose animation
        this.cur = { x: 0.5, z: 0.5, yaw: 0 };
        this.tgt = { x: 0.5, z: 0.5, yaw: 0 };
        this.from = { x: 0.5, z: 0.5, yaw: 0 };
        this.anim = 0; this.animDur = 0.18;
        this.fadeSpeed = 4;
        this.bump = 0; this.shake = 0; this.tintT = 0; this.tintCol = [1, 0, 0]; this.fade = 1; this.fadeTo = 1;
        this.lastD = 0;
        this.reduced = false;
    }

    // ------------------------------------------------------------------ floors
    setMode(mode) { this.mode = mode; }

    loadFloor(f) {
        for (const c of this.chunks) { this.dungeon.remove(c); c.geometry.dispose(); }
        this.chunks = [];
        for (const s of this.featSprites.values()) { this.featGroup.remove(s.sprite); s.sprite.material.map.dispose(); s.sprite.material.dispose(); }
        this.featSprites.clear();
        if (this.mat) { this.mat.map.dispose(); this.mat.dispose(); }
        const atlas = buildAtlas(f.theme);
        const tex = nearest(new THREE.CanvasTexture(atlas));
        this.mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5, fog: true });
        this.floor = f;
        // geometry per chunk
        for (let cy = 0; cy < f.h; cy += CHUNK) for (let cx = 0; cx < f.w; cx += CHUNK) {
            const pos = [], uv = [], col = [], idx = [];
            const quad = (a, b, c, d, tile, shade) => {
                const n = pos.length / 3;
                for (const v of [a, b, c, d]) { pos.push(...v); col.push(shade, shade, shade); }
                const tx = tile % COLS, ty = (tile / COLS) | 0;
                const u0 = tx / COLS, u1 = (tx + 1) / COLS, v1 = 1 - ty / ROWS, v0 = 1 - (ty + 1) / ROWS;
                const e = 0.0008;
                uv.push(u0 + e, v0 + e, u1 - e, v0 + e, u1 - e, v1 - e, u0 + e, v1 - e);
                idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
            };
            for (let y = cy; y < Math.min(f.h, cy + CHUNK); y++) for (let x = cx; x < Math.min(f.w, cx + CHUNK); x++) {
                const ft = featAt(f, x, y);
                const ftile = ft && ft.type === 'down' ? TILE.down : ft && ft.type === 'up' ? TILE.up : (hash3(x, y, 5) < 0.3 ? TILE.floorB : TILE.floor);
                quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y], ftile, 1);
                quad([x, 1, y], [x + 1, 1, y], [x + 1, 1, y + 1], [x, 1, y + 1], TILE.ceil, 0.9);
                const wallTile = (t, h) => {
                    if (t === 2) return TILE.door;
                    if (t === 4) return TILE.arch;
                    let r = h;
                    // caverns are rough, great halls are dressed, warrens are cracked and bony
                    if (f.style === 'caves') r = r < 0.5 ? 0.9 + r * 0.1 : r < 0.75 ? 0.93 + (r - 0.5) * 0.05 : r < 0.9 ? 0.6 : 0.95;
                    else if (f.style === 'halls' && r > 0.62 && r < 0.78) r = 0.8 + (r - 0.62) * 0.4;
                    else if (f.style === 'warren' && r > 0.78) r = 0.9 + (r - 0.78) * 0.4;
                    if (r < 0.62) return TILE.wallA;
                    if (r < 0.78) return TILE.wallB;
                    if (r < 0.84) return TILE.sconce;
                    if (r < 0.88) return TILE.banner;
                    if (r < 0.92) return TILE.bones;
                    if (r < 0.95) return TILE.moss;
                    if (r < 0.98) return TILE.crack;
                    return TILE.rubble;
                };
                const t0 = getEdge(f, x, y, 0);                      // north
                if (t0) quad([x, 0, y], [x + 1, 0, y], [x + 1, 1, y], [x, 1, y], wallTile(t0, hash3(x, y, 1)), 0.78);
                const t3 = getEdge(f, x, y, 3);                      // west
                if (t3) quad([x, 0, y + 1], [x, 0, y], [x, 1, y], [x, 1, y + 1], wallTile(t3, hash3(x, y, 2)), 1);
                if (y === f.h - 1) { const t2 = getEdge(f, x, y, 2); if (t2) quad([x + 1, 0, y + 1], [x, 0, y + 1], [x, 1, y + 1], [x + 1, 1, y + 1], wallTile(t2, hash3(x, y, 3)), 0.78); }
                if (x === f.w - 1) { const t1 = getEdge(f, x, y, 1); if (t1) quad([x + 1, 0, y], [x + 1, 0, y + 1], [x + 1, 1, y + 1], [x + 1, 1, y], wallTile(t1, hash3(x, y, 4)), 1); }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            g.setIndex(idx);
            g.computeBoundingSphere();
            const m = new THREE.Mesh(g, this.mat);
            this.dungeon.add(m);
            this.chunks.push(m);
        }
        this.buildFeatures(f);
        this.floorKey = `${f.depth}`;
    }

    buildFeatures(f) {
        for (const key of Object.keys(f.feat)) {
            const ft = f.feat[key];
            if (ft.type === 'up' || ft.type === 'down') continue;
            const [x, y] = key.split(',').map(Number);
            const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.4, fog: true, depthWrite: true });
            const sprite = new THREE.Sprite(mat);
            const isNpc = ft.type === 'npc';
            sprite.scale.set(isNpc ? 0.5 : 0.55, isNpc ? 0.62 : 0.55, 1);
            sprite.position.set(x + 0.5, isNpc ? 0.31 : 0.275, y + 0.5);
            if (ft.type === 'trap') sprite.position.y = 0.04;
            this.featGroup.add(sprite);
            this.featSprites.set(key, { sprite, ft, shown: null, x, y });
        }
        this.syncFeatures();
    }

    /** Show or hide each thing on the floor to match the sim's state. */
    syncFeatures() {
        for (const s of this.featSprites.values()) {
            const ft = s.ft;
            let vis = true, canvas;
            switch (ft.type) {
                case 'chest': canvas = featureCanvas('chest', '', !!ft.opened); break;
                case 'gather': vis = ft.left > 0; canvas = featureCanvas('gather', ft.kind); break;
                case 'spring': vis = ft.left > 0; canvas = featureCanvas('spring'); break;
                case 'altar': vis = !ft.used; canvas = featureCanvas('altar', ft.kind); break;
                case 'sign': canvas = featureCanvas('sign'); break;
                case 'relic': vis = !ft.taken; canvas = featureCanvas('relic'); break;
                case 'den': vis = !ft.done; canvas = featureCanvas('den'); break;
                case 'tablet': vis = !ft.read; canvas = featureCanvas('tablet'); break;
                case 'trap': vis = !!ft.found && !ft.sprung || !!ft.sprung; canvas = featureCanvas('trap'); break;
                case 'npc': vis = !ft.done; canvas = npcCanvas(ft.kind, ft.seed); break;
                default: vis = false;
            }
            const seen = this.floor.seen[s.y * this.floor.w + s.x] > 0;
            s.sprite.visible = vis && seen;
            if (canvas && s.shown !== canvas) {
                if (s.sprite.material.map) s.sprite.material.map.dispose();
                s.sprite.material.map = spriteTex(canvas);
                s.sprite.material.needsUpdate = true;
                s.shown = canvas;
            }
        }
    }

    // ------------------------------------------------------------------ pose
    setPose(x, y, d, instant = false) {
        const tx = x + 0.5, tz = y + 0.5;
        let yaw = this.tgt.yaw;
        if (d !== this.lastD || instant) {
            const diff = ((d - this.lastD + 6) % 4) - 2;      // -2..1
            yaw = instant ? -d * Math.PI / 2 : this.tgt.yaw - diff * Math.PI / 2;
            this.lastD = d;
        }
        if (instant) {
            this.cur = { x: tx, z: tz, yaw }; this.tgt = { x: tx, z: tz, yaw }; this.anim = 0;
            return;
        }
        if (tx === this.tgt.x && tz === this.tgt.z && yaw === this.tgt.yaw) return;
        this.from = { ...this.cur };
        this.tgt = { x: tx, z: tz, yaw };
        this.animDur = yaw !== this.from.yaw && tx === this.from.x && tz === this.from.z ? 0.16 : 0.17;
        this.anim = this.animDur;
    }
    get busy() { return this.anim > this.animDur * 0.45 || this.mode === 'dungeon' && this.fade < 0.2; }
    doBump() { this.bump = 0.2; }
    doShake(a = 1) { this.shake = 0.35 * a; }
    flash(color, t = 0.25) { this.tintCol = color; this.tintT = t; this.tintMax = t; }
    fadeOut() { this.fade = 0; this.fadeTo = 1; }

    // ------------------------------------------------------------------ battle
    /** A closed hall built from the current floor's wall atlas: sconces, banners, and pillars for a guardian. */
    buildArena(boss) {
        if (this.arena) { this.arenaScene.remove(this.arena); this.arena.geometry.dispose(); this.arena = null; }
        const W = boss ? 7 : 5, D = boss ? 8 : 6, H = boss ? 1.5 : 1.25;
        const x0 = -W / 2, z0 = -D / 2;
        const pos = [], uv = [], col = [], idx = [];
        const quad = (a, b, c, d, tile, shade) => {
            const n = pos.length / 3;
            for (const v of [a, b, c, d]) { pos.push(...v); col.push(shade, shade, shade); }
            const tx = tile % COLS, ty = (tile / COLS) | 0, e = 0.0008;
            const u0 = tx / COLS, u1 = (tx + 1) / COLS, v1 = 1 - ty / ROWS, v0 = 1 - (ty + 1) / ROWS;
            uv.push(u0 + e, v0 + e, u1 - e, v0 + e, u1 - e, v1 - e, u0 + e, v1 - e);
            idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        };
        const th = (k) => { const r = hash3(k, this.floor ? this.floor.depth : 1, 77); return r < 0.5 ? TILE.wallA : r < 0.65 ? TILE.wallB : r < 0.78 ? TILE.sconce : r < 0.86 ? TILE.banner : r < 0.92 ? TILE.bones : r < 0.96 ? TILE.moss : TILE.crack; };
        for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
            const x = x0 + i, z = z0 + j;
            quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z], [x, 0, z], (i + j) % 3 === 0 ? TILE.floorB : TILE.floor, 1);
            quad([x, H, z], [x + 1, H, z], [x + 1, H, z + 1], [x, H, z + 1], TILE.ceil, 0.9);
        }
        for (let i = 0; i < W; i++) {
            const x = x0 + i;
            quad([x, 0, z0], [x + 1, 0, z0], [x + 1, H, z0], [x, H, z0], i === (W >> 1) ? TILE.banner : th(i), 0.78);                         // far wall
            quad([x + 1, 0, z0 + D], [x, 0, z0 + D], [x, H, z0 + D], [x + 1, H, z0 + D], th(i + 40), 0.78);                                 // behind the camera
        }
        for (let j = 0; j < D; j++) {
            const z = z0 + j;
            quad([x0, 0, z + 1], [x0, 0, z], [x0, H, z], [x0, H, z + 1], j % 2 ? TILE.sconce : th(j + 80), 1);
            quad([x0 + W, 0, z], [x0 + W, 0, z + 1], [x0 + W, H, z + 1], [x0 + W, H, z], j % 2 ? TILE.sconce : th(j + 120), 1);
        }
        if (boss) for (const [px, pz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.0], [2.2, 1.0]]) {        // pillars
            const a = 0.3;
            quad([px - a, 0, pz + a], [px + a, 0, pz + a], [px + a, H, pz + a], [px - a, H, pz + a], TILE.wallA, 0.85);
            quad([px + a, 0, pz - a], [px - a, 0, pz - a], [px - a, H, pz - a], [px + a, H, pz - a], TILE.wallA, 0.7);
            quad([px - a, 0, pz - a], [px - a, 0, pz + a], [px - a, H, pz + a], [px - a, H, pz - a], TILE.wallB, 0.75);
            quad([px + a, 0, pz + a], [px + a, 0, pz - a], [px + a, H, pz - a], [px + a, H, pz + a], TILE.wallB, 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeBoundingSphere();
        this.arena = new THREE.Mesh(g, this.mat);
        this.arena.frustumCulled = false;
        this.arenaScene.add(this.arena);
        this.arenaZ = D / 2 - 0.55;
        this.arenaCam.position.set(0, 0.55, this.arenaZ);
        this.arenaCam.rotation.set(-0.02, 0, 0);
    }

    setBattle(enemies) {
        for (const e of this.enemies) { this.battleGroup.remove(e.sprite); e.sprite.material.map.dispose(); e.sprite.material.dispose(); }
        this.enemies = [];
        const was = this.inArena;
        this.inArena = !!(enemies && enemies.length) && !!this.mat;
        if (this.inArena) {
            this.buildArena(enemies[0].boss);
            this.arenaCam.add(this.battleGroup);
        } else {
            this.camera.add(this.battleGroup);
        }
        if (was !== this.inArena) { this.fade = 0; this.fadeTo = 1; }          // fade into the room, and back out to the corridor
        if (!enemies || !enemies.length) return;
        const n = enemies.length;
        const boss = enemies[0].boss;
        enemies.forEach((en, i) => {
            const mat = new THREE.SpriteMaterial({ map: spriteTex(monsterCanvas(en.sprite)), transparent: true, alphaTest: 0.4, fog: false, depthTest: false, depthWrite: false });
            const sprite = new THREE.Sprite(mat);
            sprite.renderOrder = 10 + i;
            let sx, sy, sc;
            if (boss) { sx = 0; sy = 0.0; sc = 1.15; }
            else if (n <= 3) { sx = (i - (n - 1) / 2) * 0.58; sy = -0.12; sc = 0.58; }
            else {
                const front = Math.ceil(n / 2);
                if (i < front) { sx = (i - (front - 1) / 2) * 0.58; sy = -0.17; sc = 0.54; }
                else { const k = i - front, bn = n - front; sx = (k - (bn - 1) / 2) * 0.58; sy = 0.17; sc = 0.44; }
            }
            sprite.scale.set(sc, sc, 1);
            sprite.position.set(sx, sy, -1.05 - (boss ? 0.35 : 0));
            this.battleGroup.add(sprite);
            this.enemies.push({ sprite, base: { x: sx, y: sy, sc }, hit: 0, die: -1, i, phase: i * 1.7, hidden: false });
        });
    }
    hitEnemy(i, big = false) { const e = this.enemies[i]; if (e) { e.hit = big ? 0.32 : 0.2; } }
    killEnemy(i) { const e = this.enemies[i]; if (e) e.die = 0.5; }
    lungeEnemy(i) { const e = this.enemies[i]; if (e) e.lunge = 0.25; }
    /** Where an enemy appears on the 3D box, as fractions (0..1) of its width and height. */
    enemyScreen(i) {
        const e = this.enemies[i];
        if (!e) return { x: 0.5, y: 0.5 };
        const v = new THREE.Vector3();
        const cam = this.inArena ? this.arenaCam : this.camera;
        e.sprite.getWorldPosition(v);
        cam.updateMatrixWorld();
        v.project(cam);
        return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    }

    // ------------------------------------------------------------------ frame
    update(dt, time) {
        this.time = time;
        if (this.mode === 'town') { this.town.update(dt, time); }
        // pose tween
        if (this.anim > 0) {
            this.anim = Math.max(0, this.anim - dt);
            const k = 1 - this.anim / this.animDur, e = k * k * (3 - 2 * k);
            this.cur.x = this.from.x + (this.tgt.x - this.from.x) * e;
            this.cur.z = this.from.z + (this.tgt.z - this.from.z) * e;
            this.cur.yaw = this.from.yaw + (this.tgt.yaw - this.from.yaw) * e;
        }
        const walking = this.anim > 0 && this.cur.x !== this.tgt.x || this.anim > 0 && this.cur.z !== this.tgt.z;
        const bob = walking && !this.reduced ? Math.sin((1 - this.anim / this.animDur) * Math.PI) * 0.025 : 0;
        const fwd = { x: -Math.sin(this.cur.yaw), z: -Math.cos(this.cur.yaw) };
        let bumpOff = 0;
        if (this.bump > 0) { this.bump = Math.max(0, this.bump - dt); bumpOff = Math.sin((this.bump / 0.2) * Math.PI) * 0.07; }
        let sx = 0, sy = 0;
        if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); if (!this.reduced) { sx = (Math.random() - 0.5) * 0.06 * (this.shake / 0.35); sy = (Math.random() - 0.5) * 0.05 * (this.shake / 0.35); } }
        this.camera.position.set(this.cur.x + fwd.x * bumpOff + sx, 0.5 + bob + sy, this.cur.z + fwd.z * bumpOff);
        this.camera.rotation.set(0, this.cur.yaw, 0);
        if (this.inArena) {
            const sway = this.reduced ? 0 : Math.sin(time * 0.5) * 0.02;
            this.arenaCam.position.set(sx + sway, 0.55 + sy, this.arenaZ);
            this.arenaCam.rotation.set(-0.02, sway * 0.5, 0);
        }
        // torch flicker
        const fl = this.reduced ? 0 : Math.sin(time * 9.3) * 0.18 + Math.sin(time * 15.7) * 0.1 + Math.sin(time * 4.1) * 0.1;
        this.scene.fog.far = (this.floor?.dark ? 3.4 : this.floor?.theme === 3 ? 7.5 : 6.6) + fl * (this.floor?.dark ? 0.5 : 1);
        // enemies
        for (const e of this.enemies) {
            const s = e.sprite;
            e.hit = Math.max(0, e.hit - dt);
            let ox = 0, oy = Math.sin(time * 2.4 + e.phase) * 0.012, sc = e.base.sc;
            if (e.hit > 0 && !this.reduced) { ox = (Math.random() - 0.5) * 0.05; s.material.color.setRGB(3, 3, 3); } else s.material.color.setRGB(1, 1, 1);
            if (e.lunge > 0) { e.lunge = Math.max(0, e.lunge - dt); sc *= 1 + Math.sin((e.lunge / 0.25) * Math.PI) * 0.18; }
            if (e.die >= 0) { e.die = Math.max(0, e.die - dt); sc *= e.die / 0.5; s.material.color.setRGB(2, 0.5, 0.5); if (e.die === 0) { s.visible = false; e.die = -2; } }
            if (e.die === -2) s.visible = false;
            s.scale.set(sc, sc, 1);
            s.position.set(e.base.x + ox, e.base.y + oy, s.position.z);
        }
        // post uniforms
        const U = this.post.mat.uniforms;
        if (this.tintT > 0) { this.tintT = Math.max(0, this.tintT - dt); U.tintAmt.value = (this.tintT / this.tintMax) * 0.55; U.tint.value.set(...this.tintCol); } else U.tintAmt.value = 0;
        this.fade += Math.sign(this.fadeTo - this.fade) * Math.min(Math.abs(this.fadeTo - this.fade), dt * (this.fadeSpeed || 4));
        U.fade.value = this.fade;
    }

    render() {
        const r = this.renderer;
        if (this.mode === 'town') { r.setRenderTarget(this.rt); r.render(this.town.scene, this.town.camera); }
        else if (this.inArena) { r.setRenderTarget(this.rt); r.render(this.arenaScene, this.arenaCam); }
        else { r.setRenderTarget(this.rt); r.render(this.scene, this.camera); }
        r.setRenderTarget(null);
        r.render(this.post.scene, this.post.cam);
    }
}
