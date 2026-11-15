// The three.js view. Reads G every frame and turns sim events into effects; never changes G.
// Sim (x, y) on the grid maps to world (x, height, y). One terrain layer is one unit tall.
//
// Look: 1990s TV-anime cels. Toon materials with a three-step ramp, bold ink outlines on every
// voxel and model (inverted hulls), flat unlit projectiles, chunky flash explosions, a painted
// sky gradient. Modes: 'off' (nothing drawn), 'hangar' (the mech on a turntable over the
// hangar painting) and 'mission'.

import * as THREE from 'three';
import { MAP, VOXEL, MECH, COLORS } from '../config.js';
import { ENEMIES, BOSSES, MATS } from '../sim/data/enemies.js';
import { SECTORS, missionById } from '../sim/data/missions.js';
import { MAT_LIST } from '../sim/world.js';
import { dronePos } from '../sim/combat.js';
import { toon, INK, PAL, VOXEL_COLORS, boxModel, buildMech, poseMech, enemyModel, bossModel, hiveSpire, cageModel } from './models.js';

const MAX_TERRAIN = MAP.w * MAP.h * MAP.maxH;
const tmp = new THREE.Object3D();
const tmpC = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
const MAT_COL = { stone: PAL.stone, crystal: PAL.crystal, rust: PAL.rust, neon: PAL.neon, edge: PAL.edge, hive: PAL.hive };

function instanced(geo, mat, n, ink = null) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    if (ink) {
        const o = new THREE.InstancedMesh(ink, INK, n);
        o.instanceMatrix = m.instanceMatrix;      // shares the same transforms
        o.count = 0;
        o.frustumCulled = false;
        m.userData.ink = o;
    }
    return m;
}
function setCount(m, n) { m.count = n; if (m.userData.ink) m.userData.ink.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

export class View {
    constructor(canvas, { low = false } = {}) {
        this.canvas = canvas;
        this.low = low;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
        this.mode = 'off';
        this.t = 0;
        this.shake = 0;
        this.flash = 0;
        this.focus = new THREE.Vector3(MAP.w / 2, 0, MAP.h / 2);
        this.mechKey = '';
        this.runRef = null;
        this.terrainDirty = true;
        this.buildHangar();
        this.buildMission();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        // how far back to sit: enough to see ~22 cells across in landscape, ~13 on a portrait phone
        const t = Math.tan((this.camera.fov * Math.PI) / 360);
        const needW = this.camera.aspect < 1 ? 13 : 24, needH = 15;
        this.dist = Math.max(needH / 2 / t, needW / 2 / (t * this.camera.aspect));
    }

    setMode(mode) {
        this.mode = mode;
        this.canvas.classList.toggle('see-through', mode === 'hangar');
    }

    // ================================================================== hangar
    buildHangar() {
        const s = this.hangarScene = new THREE.Scene();
        s.add(new THREE.HemisphereLight(0xfff0dd, 0x302040, 1.2));
        const key = new THREE.DirectionalLight(0xffe0c0, 2.2); key.position.set(4, 8, 6); s.add(key);
        const rim = new THREE.DirectionalLight(0x60e0ff, 1.4); rim.position.set(-6, 4, -6); s.add(rim);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.25, 40), toon({ color: 0x3a3d4a }));
        disc.add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.27, 40), INK));
        disc.position.y = -0.12;
        s.add(disc);
        const stripe = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0xffc23b, side: THREE.DoubleSide }));
        stripe.rotation.x = -Math.PI / 2; stripe.position.y = 0.02; s.add(stripe);
        this.hangarMech = null;
        this.hangarCam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    }

    hangarLoadout(loadout) {
        const key = JSON.stringify(loadout);
        if (key === this.hangarKey) return;
        this.hangarKey = key;
        if (this.hangarMech) this.hangarScene.remove(this.hangarMech);
        this.hangarMech = buildMech(loadout);
        this.hangarScene.add(this.hangarMech);
        this.hangarPop = 1;
    }

    // ================================================================== mission scene
    buildMission() {
        const s = this.scene = new THREE.Scene();
        s.add(this.hemi = new THREE.HemisphereLight(0xfff4e8, 0x40305a, 1.25));
        const sun = this.sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
        sun.position.set(-10, 24, 14);
        s.add(sun);
        s.fog = new THREE.Fog(0x6b4fd8, 40, 90);

        // ground: a checker of two greens (or reds, or blues) one cell each
        this.groundTex = new THREE.CanvasTexture(document.createElement('canvas'));
        const ground = this.ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), toon({ map: this.groundTex }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(MAP.w / 2, 0, MAP.h / 2);
        s.add(ground);
        const apron = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w * 5, MAP.h * 5), new THREE.MeshBasicMaterial({ color: 0x241a3a }));
        apron.rotation.x = -Math.PI / 2; apron.position.set(MAP.w / 2, -0.02, MAP.h / 2);
        s.add(apron);
        this.apron = apron;

        const cube = new THREE.BoxGeometry(1, 1, 1);
        const cubeInk = new THREE.BoxGeometry(1.08, 1.08, 1.08);
        this.terrain = instanced(cube, toon(), MAX_TERRAIN, cubeInk);
        this.terrain.setColorAt(0, WHITE);
        s.add(this.terrain, this.terrain.userData.ink);

        const vs = VOXEL.size;
        this.vox = instanced(new THREE.BoxGeometry(vs, vs, vs), toon(), VOXEL.cap + 50, new THREE.BoxGeometry(vs + 0.07, vs + 0.07, vs + 0.07));
        this.vox.setColorAt(0, WHITE);
        s.add(this.vox, this.vox.userData.ink);

        // the Cubeborn, one instanced mesh per kind
        this.foes = {};
        for (const [k, def] of Object.entries(ENEMIES)) {
            const M = enemyModel(k, def.color);
            const m = instanced(M.geo, toon({ vertexColors: true }), 260, M.ink);
            m.setColorAt(0, WHITE);
            s.add(m, m.userData.ink);
            this.foes[k] = m;
        }
        this.boss = null; this.bossKind = null;
        // blob shadows
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x100818, transparent: true, opacity: 0.35, depthWrite: false });
        const disc = new THREE.CircleGeometry(1, 16); disc.rotateX(-Math.PI / 2);
        this.shadows = instanced(disc, shadowMat, 300);
        s.add(this.shadows);

        // projectiles: flat, unlit, bright
        const bulletGeo = new THREE.BoxGeometry(0.12, 0.12, 0.6); bulletGeo.rotateY(Math.PI / 2);
        this.bullets = instanced(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xfff27a }), 500);
        const rocketGeo = new THREE.BoxGeometry(0.2, 0.2, 0.55); rocketGeo.rotateY(Math.PI / 2);
        this.rockets = instanced(rocketGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 80);
        this.shells = instanced(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7dfff0 }), 30);
        this.eshots = instanced(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3df0 }), 400);
        s.add(this.bullets, this.rockets, this.shells, this.eshots);
        // saw drones
        const sawGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 8);
        this.saws = instanced(sawGeo, toon({ color: 0xdde6ff }), 8, new THREE.CylinderGeometry(0.42, 0.42, 0.14, 8));
        this.saws.setColorAt(0, WHITE);
        s.add(this.saws, this.saws.userData.ink);

        // the mech
        this.mech = null;
        this.mechShadow = new THREE.Mesh(disc, shadowMat); this.mechShadow.scale.setScalar(1.1);
        s.add(this.mechShadow);
        this.magRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), new THREE.MeshBasicMaterial({ color: 0x7dfff0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
        this.magRing.rotation.x = -Math.PI / 2;
        s.add(this.magRing);
        this.aura = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3060, transparent: true, opacity: 0.22, depthWrite: false }));
        s.add(this.aura);

        this.hiveGroup = new THREE.Group(); s.add(this.hiveGroup);
        this.cageGroup = new THREE.Group(); s.add(this.cageGroup);

        // effects pool
        this.fx = [];
        this.fxGroup = new THREE.Group(); s.add(this.fxGroup);
        const sparkGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
        this.sparks = instanced(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 400);
        this.sparks.setColorAt(0, WHITE);
        this.sparkList = [];
        s.add(this.sparks);
    }

    /** A new sortie: paint the ground, place the hives and cages, set the sky. */
    setupRun(R) {
        this.runRef = R;
        const m = missionById(R.mission), S = SECTORS[m.sector];
        // ground checker
        const c = document.createElement('canvas');
        c.width = MAP.w * 8; c.height = MAP.h * 8;
        const g = c.getContext('2d');
        const a = '#' + new THREE.Color(S.ground).getHexString(), b = '#' + new THREE.Color(S.ground2).getHexString();
        for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 8, y * 8, 8, 8); }
        this.groundTex.image = c;
        this.groundTex.magFilter = THREE.NearestFilter;
        this.groundTex.colorSpace = THREE.SRGBColorSpace;
        this.groundTex.needsUpdate = true;
        // sky: a vertical painted gradient
        const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
        const sg = sky.getContext('2d'), grad = sg.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#' + new THREE.Color(S.sky[1]).getHexString());
        grad.addColorStop(1, '#' + new THREE.Color(S.sky[0]).getHexString());
        sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
        const tex = new THREE.CanvasTexture(sky); tex.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = tex;
        this.scene.fog.color.set(S.sky[1]).lerp(new THREE.Color(S.sky[0]), 0.4);
        this.apron.material.color.set(S.ground).multiplyScalar(0.55);
        if (m.sector === 'city') { this.hemi.intensity = 0.95; this.sun.color.set(0xb0a0ff); } else { this.hemi.intensity = 1.25; this.sun.color.set(0xfff0d8); }
        // hives and cages
        this.hiveGroup.clear();
        for (const h of R.hives) { const sp = hiveSpire(); sp.position.set(h.x, 0, h.y); sp.userData.id = h.id; this.hiveGroup.add(sp); }
        this.cageGroup.clear();
        for (const cg of R.cages) { const m2 = cageModel(); m2.position.set(cg.x, 0, cg.y); this.cageGroup.add(m2); }
        // boss
        if (this.boss) { this.scene.remove(this.boss); this.boss = null; this.bossKind = null; }
        this.terrainDirty = true;
        this.fx.forEach((f) => this.fxGroup.remove(f.mesh)); this.fx.length = 0;
        this.sparkList.length = 0;
        this.focus.set(R.mech.x, 0, R.mech.y);
    }

    rebuildTerrain(W) {
        let n = 0;
        for (let i = 0; i < W.h.length; i++) {
            const h = W.h[i];
            if (!h) continue;
            const x = i % MAP.w, y = (i / MAP.w) | 0;
            const mat = MAT_LIST[W.mat[i]];
            const base = MAT_COL[mat] ?? PAL.stone;
            for (let k = 0; k < h; k++) {
                tmp.position.set(x + 0.5, k + 0.5, y + 0.5);
                tmp.rotation.set(0, 0, 0);
                tmp.scale.set(1, 1, 1);
                tmp.updateMatrix();
                this.terrain.setMatrixAt(n, tmp.matrix);
                // alternate shades by layer and a checker, so walls read as voxels
                tmpC.set(base).multiplyScalar(k === h - 1 ? 1.12 : ((x + y + k) % 2 ? 0.86 : 0.95));
                this.terrain.setColorAt(n, tmpC);
                n++;
            }
        }
        setCount(this.terrain, n);
        this.terrainDirty = false;
    }

    // ================================================================== events → effects
    onEvents(G, events) {
        let sparkBudget = 30;
        for (const e of events) {
            switch (e.type) {
                case 'break': this.terrainDirty = true; if (sparkBudget-- > 0) this.puff(e.x, e.h + 0.5, e.y, MAT_COL[e.mat] ?? PAL.stone, 4); break;
                case 'kill': this.boom(e.x, 0.5, e.y, e.boss ? 5 : 1.0, e.boss ? 0xffffff : (ENEMIES[e.kind]?.color ?? 0xffffff)); if (e.boss) { this.shake = 1.2; this.flash = 1; } break;
                case 'boom': this.boom(e.x, 0.4, e.y, e.r, e.from === 'monster' ? 0xff5030 : 0xffb030); this.shake = Math.max(this.shake, Math.min(0.6, e.r * 0.15)); break;
                case 'hive_down': this.boom(e.x, 1, e.y, 4.5, PAL.hive); this.shake = 1; this.flash = 0.8; this.terrainDirty = true; break;
                case 'beam': this.beam(e); break;
                case 'hurt': this.shake = Math.max(this.shake, 0.35); this.hurtT = 0.2; break;
                case 'stomp': this.ring(e.x, e.y, e.r, 0xffe0a0); break;
                case 'levelup': if (G.run) this.ring(G.run.mech.x, G.run.mech.y, 3, 0xffe060); break;
                case 'rescue': this.column(e.x, e.y); break;
                case 'overdrive': if (G.run) this.ring(G.run.mech.x, G.run.mech.y, 5, 0xff3060); this.flash = 0.6; break;
                case 'collect': if (sparkBudget-- > 0 && G.run) this.puff(G.run.mech.x, 1.4, G.run.mech.y, PAL[e.c] ?? 0xffffff, 2, 0.6); break;
                case 'chew': if (sparkBudget-- > 0) this.puff(e.x, 0.3, e.y, VOXEL_COLORS[e.c]?.getHex() ?? 0xffffff, 3); break;
                case 'boss_in': this.shake = 0.8; break;
                case 'boss_act': if (e.act === 'stomp') { this.ring(e.x, e.y, 4.2, 0xff5030); this.shake = 0.9; } break;
                case 'hatch': if (sparkBudget-- > 0) this.puff(e.x, 0.4, e.y, PAL.hive, 4); break;
            }
        }
    }

    boom(x, y, z, r, color) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false }));
        mesh.position.set(x, y, z);
        this.fxGroup.add(mesh);
        this.fx.push({ mesh, t: 0, life: 0.45, kind: 'boom', r, color: new THREE.Color(color) });
        this.puff(x, y + 0.3, z, color, Math.min(14, 4 + r * 2), 1 + r * 0.4);
    }
    ring(x, z, r, color) {
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.12, z);
        this.fxGroup.add(mesh);
        this.fx.push({ mesh, t: 0, life: 0.5, kind: 'ring', r });
    }
    beam(e) {
        const len = Math.hypot(e.x2 - e.x, e.y2 - e.y);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, e.w * 0.9), new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 1, depthWrite: false }));
        mesh.position.set((e.x + e.x2) / 2, 1.3, (e.y + e.y2) / 2);
        mesh.rotation.y = -Math.atan2(e.y2 - e.y, e.x2 - e.x);
        const core = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        mesh.add(core);
        this.fxGroup.add(mesh);
        this.fx.push({ mesh, t: 0, life: 0.18, kind: 'beam' });
    }
    column(x, z) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbffff0, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
        mesh.position.set(x, 15, z);
        this.fxGroup.add(mesh);
        this.fx.push({ mesh, t: 0, life: 1.4, kind: 'column' });
    }
    puff(x, y, z, color, n, power = 1) {
        for (let k = 0; k < n && this.sparkList.length < 400; k++) {
            const a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 3) * power;
            this.sparkList.push({ x, y, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * 4 * power, vz: Math.sin(a) * s, life: 0.35 + Math.random() * 0.35, c: new THREE.Color(color) });
        }
    }

    stepFx(dt) {
        for (let k = this.fx.length - 1; k >= 0; k--) {
            const f = this.fx[k];
            f.t += dt;
            const u = f.t / f.life;
            if (u >= 1) { this.fxGroup.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); this.fx.splice(k, 1); continue; }
            if (f.kind === 'boom') {
                // a white frame, then the colour, then gone: an anime impact
                f.mesh.scale.setScalar(f.r * (0.3 + 0.9 * Math.sqrt(u)));
                f.mesh.material.color.copy(u < 0.18 ? WHITE : f.color);
                f.mesh.material.opacity = 1 - u * u;
            } else if (f.kind === 'ring') {
                f.mesh.scale.setScalar(f.r * (0.2 + u));
                f.mesh.material.opacity = 0.9 * (1 - u);
            } else if (f.kind === 'beam') {
                f.mesh.scale.z = 1 - u;
                f.mesh.material.opacity = 1 - u;
            } else if (f.kind === 'column') {
                f.mesh.scale.set(1 - u * 0.7, 1, 1 - u * 0.7);
                f.mesh.material.opacity = 0.7 * (1 - u);
            }
        }
        let n = 0;
        for (let k = this.sparkList.length - 1; k >= 0; k--) {
            const p = this.sparkList[k];
            p.life -= dt;
            if (p.life <= 0 || p.y < 0) { this.sparkList.splice(k, 1); continue; }
            p.vy -= 18 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            tmp.position.set(p.x, p.y, p.z);
            tmp.rotation.set(p.life * 9, p.life * 7, 0);
            tmp.scale.setScalar(Math.min(1, p.life * 3));
            tmp.updateMatrix();
            this.sparks.setMatrixAt(n, tmp.matrix);
            this.sparks.setColorAt(n, p.c);
            n++;
        }
        setCount(this.sparks, n);
    }

    // ================================================================== the frame
    frame(G, dt, time) {
        this.resize();
        this.t = time;
        if (this.mode === 'off') { this.renderer.clear(); return; }
        if (this.mode === 'hangar') return this.frameHangar(G, dt);
        const R = G.run;
        if (!R) { this.renderer.clear(); return; }
        if (R !== this.runRef) this.setupRun(R);
        if (this.terrainDirty) this.rebuildTerrain(R.W);
        const M = R.mech;

        // ---- the mech
        const key = JSON.stringify(G.hangar.loadout);
        if (key !== this.mechKey) {
            if (this.mech) this.scene.remove(this.mech);
            this.mech = buildMech(G.hangar.loadout);
            this.mech.scale.setScalar(1.3);
            this.scene.add(this.mech);
            this.mechKey = key;
        }
        const moving = Math.hypot(M.vx, M.vy);
        this.walk = (this.walk || 0) + dt * moving / 6;
        this.hurtT = Math.max(0, (this.hurtT || 0) - dt);
        this.mech.position.set(M.x, 0, M.y);
        poseMech(this.mech, { t: time, walk: moving > 0.2 ? this.walk : 0, face: M.face, aim: M.aim ?? M.face, od: M.odT > 0, hurt: this.hurtT > 0, crouch: R.over === 'win' ? 0.6 : 0 });
        this.mech.visible = !(M.inv > 0 && M.hp > 0 && Math.floor(time * 20) % 2 && R.t > 2) && !(R.over === 'lose' && R.overT < 1.6);
        this.mechShadow.position.set(M.x, 0.03, M.y);
        this.magRing.visible = !!M.magnetOn;
        if (M.magnetOn) { this.magRing.position.set(M.x, 0.1, M.y); this.magRing.scale.setScalar(M.magnet * (0.96 + Math.sin(time * 10) * 0.04)); }
        this.aura.visible = M.odT > 0;
        if (this.aura.visible) { this.aura.position.set(M.x, 1.4, M.y); this.aura.scale.setScalar(1 + Math.sin(time * 18) * 0.08); }

        // ---- voxels
        let n = 0;
        for (const v of R.voxels) {
            const fade = v.s === 1 ? Math.min(1, v.life / 2) : 1;
            tmp.position.set(v.x + (v.s === 1 ? ((v.z * 7.3) % 0.3) - 0.15 : 0), v.z + VOXEL.size / 2, v.y + (v.s === 1 ? ((v.z * 5.1) % 0.3) - 0.15 : 0));
            if (v.s === 1) tmp.rotation.set(0, (v.i * 1.7 + v.z * 3) % 1.5, 0);
            else tmp.rotation.set(time * 7 + n, time * 5 + n * 0.3, 0);
            tmp.scale.setScalar(fade * (v.s === 2 ? 0.8 : 1));
            tmp.updateMatrix();
            this.vox.setMatrixAt(n, tmp.matrix);
            const col = VOXEL_COLORS[v.c];
            // collectibles twinkle
            if (v.c <= 3) tmpC.copy(col).multiplyScalar(1.05 + 0.25 * Math.sin(time * 8 + n));
            else tmpC.copy(col);
            this.vox.setColorAt(n, tmpC);
            n++;
        }
        setCount(this.vox, n);

        // ---- monsters
        const counts = { mite: 0, brute: 0, spitter: 0, boomer: 0 };
        let sh = 0;
        let bossE = null;
        for (const e of R.enemies) {
            if (e.boss) { bossE = e; continue; }
            const m = this.foes[e.kind];
            if (!m) continue;
            const i = counts[e.kind]++;
            const bob = Math.abs(Math.sin(time * 9 + e.id)) * 0.12;
            tmp.position.set(e.x, bob, e.y);
            tmp.rotation.set(0, Math.atan2(e.vx, e.vy), 0);
            const sq = e.fuse > 0 ? 1 + Math.sin(time * 40) * 0.12 : 1;
            tmp.scale.set(sq, 1 / sq + bob * 0.5, sq);
            tmp.updateMatrix();
            m.setMatrixAt(i, tmp.matrix);
            if (e.flash > 0) tmpC.setRGB(3, 3, 3);
            else if (e.fuse > 0 && Math.floor(time * 16) % 2) tmpC.setRGB(2.5, 0.6, 0.4);
            else tmpC.setRGB(1, 1, 1);
            m.setColorAt(i, tmpC);
            tmp.position.set(e.x, 0.02, e.y); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(e.r * 1.1); tmp.updateMatrix();
            this.shadows.setMatrixAt(sh++, tmp.matrix);
        }
        for (const k in counts) setCount(this.foes[k], counts[k]);
        // the kaiju
        if (bossE && this.bossKind !== bossE.kind) {
            if (this.boss) this.scene.remove(this.boss);
            const B = bossModel(bossE.kind, BOSSES[bossE.kind].color);
            this.boss = new THREE.Mesh(B.geo, toon({ vertexColors: true }));
            this.boss.add(new THREE.Mesh(B.ink, INK));
            this.bossKind = bossE.kind;
            this.scene.add(this.boss);
        }
        if (this.boss) {
            this.boss.visible = !!bossE;
            if (bossE) {
                const s = bossE.r / 1.6;
                const wind = bossE.st === 'wind' ? Math.sin(time * 30) * 0.06 : 0;
                this.boss.position.set(bossE.x, Math.abs(Math.sin(time * 4)) * 0.15, bossE.y);
                const dx = M.x - bossE.x, dy = M.y - bossE.y;
                this.boss.rotation.y = bossE.st === 'act' && bossE.act === 'charge' ? Math.atan2(Math.cos(bossE.dir), Math.sin(bossE.dir)) : Math.atan2(dx, dy);
                this.boss.scale.set(s * (1 + wind), s * (1 - wind), s * (1 + wind));
                this.boss.material.color.setScalar(bossE.flash > 0 ? 2.5 : bossE.st === 'wind' ? 1.4 + Math.sin(time * 25) * 0.3 : 1);
                tmp.position.set(bossE.x, 0.02, bossE.y); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(bossE.r * 1.3); tmp.updateMatrix();
                this.shadows.setMatrixAt(sh++, tmp.matrix);
            }
        }
        setCount(this.shadows, sh);

        // ---- projectiles
        let nb = 0, nr = 0, nm = 0, ne = 0;
        for (const s of R.shots) {
            const a = Math.atan2(s.vy || 0, s.vx || 0);
            if (s.k === 'b') { tmp.position.set(s.x, 1.25, s.y); tmp.rotation.set(0, -a, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); this.bullets.setMatrixAt(nb++, tmp.matrix); }
            else if (s.k === 'r') { tmp.position.set(s.x, 1.5, s.y); tmp.rotation.set(0, -a, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); this.rockets.setMatrixAt(nr++, tmp.matrix); if (Math.random() < 0.5) this.puff(s.x, 1.5, s.y, 0xffa040, 1, 0.2); }
            else if (s.k === 'm') { tmp.position.set(s.x, s.z || 1, s.y); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1 + Math.sin(time * 20) * 0.15); tmp.updateMatrix(); this.shells.setMatrixAt(nm++, tmp.matrix); }
            else { tmp.position.set(s.x, 0.9, s.y); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar((s.big ? 1.7 : 1) * (1 + Math.sin(time * 16 + ne) * 0.15)); tmp.updateMatrix(); this.eshots.setMatrixAt(ne++, tmp.matrix); }
        }
        setCount(this.bullets, nb); setCount(this.rockets, nr); setCount(this.shells, nm); setCount(this.eshots, ne);

        // ---- saw drones
        let ns = 0;
        for (const w of M.weapons) {
            if (w.type !== 'orbit') continue;
            for (let k = 0; k < w.count && ns < 8; k++) {
                const p = dronePos(R, w, k);
                tmp.position.set(p.x, 1.0, p.y); tmp.rotation.set(0, time * 25, 0); tmp.scale.setScalar(1); tmp.updateMatrix();
                this.saws.setMatrixAt(ns++, tmp.matrix);
            }
        }
        setCount(this.saws, ns);

        // ---- hives and cages
        for (const sp of this.hiveGroup.children) {
            const h = R.hives.find((x) => x.id === sp.userData.id);
            sp.visible = !!h && !h.dead;
            if (!sp.visible) continue;
            const cr = sp.userData.crystal;
            cr.rotation.y = time * 1.2;
            cr.position.y = 3.3 + Math.sin(time * 2) * 0.2;
            cr.scale.setScalar(0.5 + 0.5 * (h.hp / h.max));
            cr.scale.y *= 1.6;
            cr.material.emissive.setHex(h.flash > 0 ? 0xffffff : 0x60107a);
        }
        this.cageGroup.children.forEach((g, k) => {
            const c = R.cages[k];
            if (!c) return;
            const U = g.userData;
            U.cage.visible = !c.freed; U.person.visible = !c.freed; U.ring.visible = !c.freed; U.beacon.visible = !c.freed;
            U.person.position.y = Math.abs(Math.sin(time * 6 + k)) * 0.15;
            U.person.rotation.y = time;
            U.prog.visible = c.prog > 0 && !c.freed;
            if (U.prog.visible) { U.prog.geometry.dispose(); U.prog.geometry = new THREE.RingGeometry(1.2, 2.0, 40, 1, 0, Math.PI * 2 * Math.min(1, c.prog / 3.5)); }
            U.ring.material.opacity = 0.4 + Math.sin(time * 4) * 0.2;
        });

        this.stepFx(dt);

        // ---- camera
        const ease = 1 - Math.exp(-dt * 5);
        // follow the mech, but don't show more of the void past the map's edge than needed
        const cx = Math.max(7, Math.min(MAP.w - 7, M.x)), cz = Math.max(5, Math.min(MAP.h - 8, M.y));
        this.focus.x += (cx - this.focus.x) * ease;
        this.focus.z += (cz - this.focus.z) * ease;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const sx = (Math.random() - 0.5) * this.shake * 0.6, sy = (Math.random() - 0.5) * this.shake * 0.6;
        const pitch = 0.95;
        this.camera.position.set(this.focus.x + sx, Math.sin(pitch) * this.dist, this.focus.z + Math.cos(pitch) * this.dist + sy);
        this.camera.lookAt(this.focus.x, 0.8, this.focus.z + 1);
        this.scene.fog.near = this.dist * 1.1; this.scene.fog.far = this.dist * 2.6;
        this.flash = Math.max(0, this.flash - dt * 3);
        this.renderer.render(this.scene, this.camera);
    }

    frameHangar(G, dt) {
        this.hangarLoadout(G.hangar.loadout);
        const m = this.hangarMech;
        this.hangarPop = Math.max(0, (this.hangarPop || 0) - dt * 3);
        m.rotation.y += dt * 0.5;
        m.scale.setScalar(1 + this.hangarPop * 0.08);
        poseMech(m, { t: this.t, walk: 0, face: -m.rotation.y + Math.PI / 2, aim: -m.rotation.y + Math.PI / 2, od: false });
        m.rotation.y = this.hangarSpin = (this.hangarSpin || 0) + dt * 0.5;
        const cam = this.hangarCam;
        cam.aspect = this.w / this.h;
        // landscape: the mech sits in the left part, beside the panel; portrait: in the top part, above it
        const portrait = this.w < this.h;
        // portrait: the panel covers the bottom 56%, so stand further back and lift the mech into the top part
        cam.setViewOffset(this.w, this.h, portrait ? 0 : this.w * 0.2, portrait ? this.h * 0.24 : 0, this.w, this.h);
        const back = portrait ? 15 : 7.6;
        cam.position.set(0, 2.6, back);
        cam.lookAt(0, 1.3, 0);
        cam.updateProjectionMatrix();
        this.renderer.render(this.hangarScene, cam);
    }

    /** Screen position (CSS px) of a sim point, for the tests. */
    project(x, y, h = 0) {
        const v = new THREE.Vector3(x, h, y).project(this.camera);
        return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, inFront: v.z < 1 };
    }
}
