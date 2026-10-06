// The 3D level: floors (one merged mesh with per-vertex ambient occlusion), cut-away walls
// (instanced), pillars, jam pools, boiling fruit punch, decor, torches, interactive objects and
// the town of Tristrawberry. Everything level-bound reads the fog-of-war texture.

import * as THREE from 'three';
import { T, walkable, opaque, DIRS4 } from '../sim/tiles.js';
import { floorTex, wallTex, woodTex, liquidTex, glowTex, labelTex } from './textures.js';
import { fow, initFow, patchFow, FOW_GLSL } from './fow.js';
import { mat, mesh, disposeModel } from './fruitkit.js';

export const WALL_H = { cellar: 2.0, jam: 2.2, core: 2.5, town: 2 };

function vrng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const THEME = {
    cellar: { ambient: 0x6a5a6a, ambientK: 0.55, ground: 0x2a1a10, fog: 0x0a0806, torch: 0xffa040, key: 0xb0a0ff },
    jam:    { ambient: 0x8a6a9a, ambientK: 0.42, ground: 0x1a0a14, fog: 0x0a0408, torch: 0xffa0c8, key: 0xd0c0ff },
    core:   { ambient: 0x9a6a5a, ambientK: 0.38, ground: 0x1a0606, fog: 0x0c0303, torch: 0xff8a40, key: 0xffc0a0 },
    town:   { ambient: 0xbfd8ff, ambientK: 1.0, ground: 0x6a8a4a, fog: 0x9ec8e8, torch: 0xffc070, key: 0xfff2d8 },
};
export { THEME };

export class LevelView {
    constructor(scene) {
        this.scene = scene;
        this.root = null;
        this.mats = [];
        this.objViews = new Map();
        this.lightSources = [];
        this.flames = [];
        this.anims = [];
        this.buildings = [];
        this.time = 0;
    }

    track(m) { this.mats.push(m); return m; }

    dispose() {
        if (!this.root) return;
        this.scene.remove(this.root);
        disposeModel(this.root);
        for (const m of this.mats) m.dispose();
        this.mats = []; this.objViews.clear(); this.lightSources = []; this.flames = []; this.anims = []; this.buildings = [];
        this.root = null;
    }

    build(world) {
        this.dispose();
        const map = world.map;
        this.map = map;
        this.theme = map.theme;
        this.town = map.theme === 'town';
        this.root = new THREE.Group();
        this.scene.add(this.root);
        initFow(map.w, map.h, this.town);
        const rnd = vrng(map.seed ^ 0xbeef);
        this.rnd = rnd;
        if (this.town) this.buildTown(map, rnd);
        else this.buildDungeon(map, rnd);
        for (const o of world.objs) this.addObj(o);
    }

    // ------------------------------------------------------------------ floors
    floorMesh(map, tiles, matl, y = 0, uvScale = 0.25, aoK = 0.55) {
        const pos = [], uv = [], col = [], idx = [];
        const solidAt = (x, y2) => !walkable(map.at(x, y2)) && map.at(x, y2) !== T.PUNCH;
        // AO per vertex: how many of the 4 tiles around the vertex are solid.
        const ao = (vx, vy) => { let n = 0; for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (solidAt(vx + ox, vy + oy)) n++; return 1 - (n / 4) * aoK; };
        for (const [x, z] of tiles) {
            const base = pos.length / 3;
            const tint = 0.92 + ((x * 7 + z * 13) % 5) * 0.025;
            for (const [vx, vz] of [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]]) {
                pos.push(vx, y, vz);
                uv.push(vx * uvScale, -vz * uvScale);
                const a = ao(vx, vz) * tint;
                col.push(a, a, a);
            }
            idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, matl);
        m.receiveShadow = true;
        this.root.add(m);
        return m;
    }

    buildDungeon(map, rnd) {
        const th = map.theme;
        const H = WALL_H[th];
        const ft = floorTex(th);
        const floorMat = this.track(patchFow(new THREE.MeshStandardMaterial({ map: ft.map, bumpMap: ft.bump, bumpScale: 2.0, roughness: 0.9, vertexColors: true, emissiveMap: ft.emissive || null, emissive: ft.emissive ? new THREE.Color(0.55, 0.16, 0.08) : new THREE.Color(0) }), { key: 'floor' }));
        const floors = [], jams = [], punches = [];
        for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
            const t = map.at(x, y);
            if (t === T.FLOOR || t === T.BLOCK) floors.push([x, y]);
            else if (t === T.JAM) { floors.push([x, y]); jams.push([x, y]); }
            else if (t === T.PUNCH) punches.push([x, y]);
        }
        this.floorMesh(map, floors, floorMat);
        // Sticky jam: glossy, slowly wobbling.
        if (jams.length) {
            const lt = liquidTex();
            const jm = this.track(patchFow(new THREE.MeshPhysicalMaterial({ color: 0x9a0f38, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, bumpMap: lt, bumpScale: 3, emissive: 0x2a0010, transparent: true, opacity: 0.94 }), { key: 'jam' }));
            const jmesh = this.floorMesh(map, jams, jm, 0.035, 0.18, 0);
            this.anims.push((dt, t) => { lt.offset.set(t * 0.02, t * 0.013); });
            jmesh.renderOrder = 1;
        }
        if (punches.length) this.buildPunch(map, punches);

        // Walls: every opaque tile that touches open floor (8-neighbourhood).
        const wt = wallTex(th);
        wt.map.repeat.set(1, H / 1.5); if (wt.bump) wt.bump.repeat.set(1, H / 1.5);
        const wallMat = this.track(patchFow(new THREE.MeshStandardMaterial({ map: wt.map, bumpMap: wt.bump, bumpScale: 2.5, roughness: 0.92 }), { cut: true, darkTop: true, key: 'wall' }));
        const wallTiles = [];
        for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
            if (map.at(x, y) !== T.SOLID) continue;
            let near = false;
            for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) { const t = map.at(x + ox, y + oy); if (walkable(t) || t === T.PUNCH) { near = true; break; } }
            if (near) wallTiles.push([x, y]);
        }
        const wg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
        const walls = new THREE.InstancedMesh(wg, wallMat, wallTiles.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
        wallTiles.forEach(([x, y], i) => {
            const hh = th === 'core' ? H * (0.85 + rnd() * 0.45) : H * (0.97 + rnd() * 0.06);
            const j = th === 'core' ? 0.12 : 0.0;
            p.set(x + 0.5 + (rnd() - 0.5) * j, 0, y + 0.5 + (rnd() - 0.5) * j); sc.set(1 + j, hh, 1 + j);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), th === 'core' ? (rnd() - 0.5) * 0.3 : 0);
            m4.compose(p, q, sc);
            walls.setMatrixAt(i, m4);
        });
        walls.castShadow = true; walls.receiveShadow = true;
        this.root.add(walls);
        this.walls = walls;

        // Pillars (BLOCK tiles).
        const blocks = [];
        for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.at(x, y) === T.BLOCK) blocks.push([x, y]);
        if (blocks.length) {
            const pillarGeo = th === 'core' ? new THREE.ConeGeometry(0.42, H * 1.1, 7).translate(0, H * 0.55, 0) : mergeGeos([
                new THREE.BoxGeometry(0.8, 0.22, 0.8).translate(0, 0.11, 0),
                new THREE.CylinderGeometry(0.28, 0.32, H - 0.3, 12).translate(0, H / 2, 0),
                new THREE.BoxGeometry(0.75, 0.2, 0.75).translate(0, H - 0.1, 0),
            ]);
            const pm = this.track(patchFow(new THREE.MeshStandardMaterial({ map: wt.map, color: th === 'jam' ? 0xb090c0 : 0xd0c0b0, roughness: 0.85 }), { cut: true, key: 'pillar' }));
            const pillars = new THREE.InstancedMesh(pillarGeo, pm, blocks.length);
            blocks.forEach(([x, y], i) => { m4.compose(p.set(x + 0.5, 0, y + 0.5), q.identity(), sc.set(1, 1, 1)); pillars.setMatrixAt(i, m4); });
            pillars.castShadow = true; pillars.receiveShadow = true;
            this.root.add(pillars);
            if (th === 'core') blocks.forEach(([x, y]) => this.lightSources.push({ x: x + 0.5, y: 1.2, z: y + 0.5, color: 0xff5a20, k: 0.6 }));
        }
        this.decorate(map, rnd, wallTiles);
    }

    buildPunch(map, tiles) {
        const lt = liquidTex();
        const m = this.track(new THREE.ShaderMaterial({
            uniforms: { ...fow.uniforms, uTime: { value: 0 }, uNoise: { value: lt } },
            vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
            fragmentShader: `${FOW_GLSL}
                uniform float uTime; uniform sampler2D uNoise; varying vec3 vW;
                void main(){
                    vec2 p = vW.xz * 0.35;
                    float a = texture2D(uNoise, p + vec2(uTime * 0.03, uTime * 0.02)).r;
                    float b = texture2D(uNoise, p * 1.7 - vec2(uTime * 0.025, -uTime * 0.04)).r;
                    float n = a * 0.6 + b * 0.4;
                    vec3 deep = vec3(0.9, 0.08, 0.25), hot = vec3(1.6, 0.7, 0.25), foam = vec3(2.2, 1.6, 0.9);
                    vec3 col = mix(deep, hot, smoothstep(0.35, 0.7, n));
                    col = mix(col, foam, smoothstep(0.78, 0.9, n));
                    float bub = step(0.985, fract(sin(dot(floor(vW.xz * 4.0), vec2(12.9, 78.2))) * 43758.5 + uTime * 0.3));
                    col += bub * vec3(1.5, 1.0, 0.6);
                    gl_FragColor = vec4(col * fowAt(vW.xz), 1.0);
                }`,
        }));
        const pos = [], idx = [];
        for (const [x, z] of tiles) { const b = pos.length / 3; pos.push(x, -0.28, z, x + 1, -0.28, z, x + 1, -0.28, z + 1, x, -0.28, z + 1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        this.root.add(new THREE.Mesh(g, m));
        // Banks: vertical faces from the floor down to the punch.
        const bpos = [], bidx = [], buv = [];
        const set = new Set(tiles.map(([x, z]) => z * map.w + x));
        for (const [x, z] of tiles) for (const [dx, dz] of DIRS4) {
            const nx = x + dx, nz = z + dz;
            if (set.has(nz * map.w + nx) || !walkable(map.at(nx, nz))) continue;
            // Edge shared with the neighbour, facing into the punch tile.
            let ax, az, bx, bz;
            if (dx === 1) { ax = x + 1; az = z + 1; bx = x + 1; bz = z; }
            else if (dx === -1) { ax = x; az = z; bx = x; bz = z + 1; }
            else if (dz === 1) { ax = x; az = z + 1; bx = x + 1; bz = z + 1; }
            else { ax = x + 1; az = z; bx = x; bz = z; }
            const b = bpos.length / 3;
            bpos.push(ax, 0, az, bx, 0, bz, bx, -0.3, bz, ax, -0.3, az);
            buv.push(0, 1, 1, 1, 1, 0, 0, 0);
            bidx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2)); bg.setIndex(bidx); bg.computeVertexNormals();
        const bm = this.track(patchFow(new THREE.MeshStandardMaterial({ color: 0x3a1a18, roughness: 0.9, emissive: 0x501008, side: THREE.DoubleSide }), { key: 'bank' }));
        this.root.add(new THREE.Mesh(bg, bm));
        this.anims.push((dt, t) => { m.uniforms.uTime.value = t; });
        // Punch glows: a few light sources spread over the lakes.
        for (let i = 0; i < tiles.length; i += 9) this.lightSources.push({ x: tiles[i][0] + 0.5, y: 0.6, z: tiles[i][1] + 0.5, color: 0xff4a40, k: 0.9 });
    }

    // ------------------------------------------------------------------ decor
    decorate(map, rnd, wallTiles) {
        const th = map.theme;
        const H = WALL_H[th];
        const T_ = THEME[th];
        // Torches on south-facing wall faces (the faces the camera sees), spaced out.
        const torches = [];
        for (const [x, y] of wallTiles) {
            if (!walkable(map.at(x, y + 1)) || map.at(x, y + 1) === T.JAM) continue;
            if (torches.some((t) => Math.abs(t[0] - x) + Math.abs(t[1] - y) < 6)) continue;
            if (rnd() < 0.55) torches.push([x, y]);
        }
        const bracketMat = this.track(patchFow(new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6, metalness: 0.6 }), { key: 'deco' }));
        const flameTex = glowTex();
        for (const [x, y] of torches) {
            const g = new THREE.Group();
            g.position.set(x + 0.5, 1.35, y + 1.02);
            g.add(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), bracketMat, 0, -0.1, 0));
            g.add(mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 8), bracketMat, 0, 0.06, 0.05));
            const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: T_.torch, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
            flame.scale.set(0.45, 0.65, 1); flame.position.set(0, 0.25, 0.06);
            g.add(flame);
            const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
            core.scale.set(0.16, 0.26, 1); core.position.set(0, 0.2, 0.08); g.add(core);
            this.root.add(g);
            this.flames.push({ s: flame, c: core, ph: rnd() * 10, x: x + 0.5, z: y + 1 });
            this.lightSources.push({ x: x + 0.5, y: 1.5, z: y + 1.3, color: T_.torch, k: 1.0, flicker: true });
        }
        // Scatter: per theme little props on open floor (never on walkable chokepoints — decor has no collision).
        const scatter = [];
        for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
            if (map.at(x, y) !== T.FLOOR) continue;
            let walls = 0;
            for (const [dx, dy] of DIRS4) if (opaque(map.at(x + dx, y + dy))) walls++;
            if (walls && rnd() < 0.22) scatter.push([x, y, walls]);
            else if (!walls && rnd() < 0.025) scatter.push([x, y, 0]);
        }
        const decoMat = (o) => this.track(patchFow(new THREE.MeshStandardMaterial(o), { key: 'deco' }));
        const glowM = (c, k = 2) => this.track(patchFow(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }), { key: 'glow' }));
        const add = (o) => { this.root.add(o); return o; };
        const seedM = decoMat({ color: 0x3a2a1a, roughness: 0.6 });
        const coreM = decoMat({ color: 0xf2e6c0, roughness: 0.7 });
        const coreSkin = decoMat({ color: 0xc83030, roughness: 0.6 });
        const webM = this.track(patchFow(new THREE.MeshBasicMaterial({ map: webTex(), color: 0xdddddd, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), { key: 'web' }));
        const shroomCap = [glowM(0x4ab8ff, 1.6), glowM(0xff6ac8, 1.6), glowM(0x9aff6a, 1.4)];
        const stemM = decoMat({ color: 0xe8dcc8, roughness: 0.8 });
        const crystalM = [glowM(0xff8a5a, 1.8), glowM(0xffd06a, 1.6), glowM(0xff4a8a, 1.6)];
        const rootM = decoMat({ color: 0x5a3a22, roughness: 0.9 });
        const jarM = decoMat({ color: 0xbfe0ff, roughness: 0.1, transparent: true, opacity: 0.55 });
        const jamM = decoMat({ color: 0xa0103a, roughness: 0.3 });
        for (const [x, y, walls] of scatter) {
            const cx = x + 0.5 + (rnd() - 0.5) * 0.5, cz = y + 0.5 + (rnd() - 0.5) * 0.5;
            const r = rnd();
            if (th === 'cellar') {
                if (r < 0.35) { // apple cores and seeds
                    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rnd() * 6;
                    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), coreM, 0, 0.07, 0)).rotation.z = 1.5;
                    g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), coreSkin, 0.08, 0.07, 0)); g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), coreSkin, -0.08, 0.07, 0));
                    add(g);
                } else if (r < 0.6) { for (let k = 0; k < 4; k++) { const s = add(mesh(new THREE.SphereGeometry(0.03, 6, 4), seedM, cx + (rnd() - 0.5) * 0.4, 0.02, cz + (rnd() - 0.5) * 0.4)); s.scale.set(1, 0.6, 1.6); s.rotation.y = rnd() * 6; } }
                else if (opaque(map.at(x, y - 1))) {
                    // Webs and roots hang on north walls only: the camera sees those, and south walls get cut away.
                    if (r < 0.8) { const w = add(mesh(new THREE.PlaneGeometry(0.9, 0.9), webM, x + 0.5, H - 0.45, y + 0.04)); w.rotation.z = rnd() < 0.5 ? 0 : Math.PI / 2; }
                    else { const rt = add(mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 5), rootM, cx, H - 0.45, y + 0.06)); rt.rotation.z = (rnd() - 0.5) * 0.6; }
                }
            } else if (th === 'jam') {
                if (r < 0.45) { // glowing mushrooms
                    const n = 1 + Math.floor(rnd() * 3);
                    for (let k = 0; k < n; k++) {
                        const sx = cx + (rnd() - 0.5) * 0.4, sz = cz + (rnd() - 0.5) * 0.4, hgt = 0.12 + rnd() * 0.18;
                        add(mesh(new THREE.CylinderGeometry(0.025, 0.035, hgt, 6), stemM, sx, hgt / 2, sz));
                        const cap = add(mesh(new THREE.SphereGeometry(0.08 + rnd() * 0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shroomCap[k % 3], sx, hgt, sz));
                        cap.castShadow = false;
                    }
                    if (rnd() < 0.3) this.lightSources.push({ x: cx, y: 0.5, z: cz, color: 0x6a8aff, k: 0.4 });
                } else if (r < 0.75) { // jam jars
                    add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), jarM, cx, 0.11, cz));
                    add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), jamM, cx, 0.07, cz));
                } else { const d = add(mesh(new THREE.CircleGeometry(0.3 + rnd() * 0.3, 12), jamM, cx, 0.012, cz)); d.rotation.x = -Math.PI / 2; d.castShadow = false; d.receiveShadow = true; }
            } else {
                if (r < 0.4) { // sugar crystals
                    const n = 2 + Math.floor(rnd() * 3);
                    const cm = crystalM[Math.floor(rnd() * 3)];
                    for (let k = 0; k < n; k++) {
                        const c = add(mesh(new THREE.OctahedronGeometry(0.1 + rnd() * 0.12, 0), cm, cx + (rnd() - 0.5) * 0.35, 0.12, cz + (rnd() - 0.5) * 0.35));
                        c.scale.y = 1.8 + rnd(); c.rotation.set(rnd() - 0.5, rnd() * 3, rnd() - 0.5); c.castShadow = false;
                    }
                    if (rnd() < 0.35) this.lightSources.push({ x: cx, y: 0.5, z: cz, color: 0xff7a40, k: 0.5 });
                } else if (r < 0.7) { // giant seeds / pits
                    const s = add(mesh(new THREE.SphereGeometry(0.16, 10, 8), seedM, cx, 0.1, cz)); s.scale.set(1, 0.7, 1.5); s.rotation.y = rnd() * 6;
                } else { const s = add(mesh(new THREE.DodecahedronGeometry(0.2 + rnd() * 0.15, 0), decoMat({ color: 0x4a2a28, roughness: 0.9 }), cx, 0.12, cz)); s.rotation.set(rnd(), rnd(), rnd()); }
            }
        }
    }

    // ------------------------------------------------------------------ town
    buildTown(map, rnd) {
        const grass = floorTex('grass'), path = floorTex('path');
        const gm = this.track(patchFow(new THREE.MeshStandardMaterial({ map: grass.map, bumpMap: grass.bump, bumpScale: 1.5, roughness: 0.95, vertexColors: true }), { key: 'grass' }));
        const pm = this.track(patchFow(new THREE.MeshStandardMaterial({ map: path.map, bumpMap: path.bump, bumpScale: 2, roughness: 0.9, vertexColors: true }), { key: 'path' }));
        const g = [], pth = [];
        for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) (map.at(x, y) === T.PATH ? pth : g).push([x, y]);
        this.floorMesh(map, g, gm, 0, 0.2, 0.15);
        this.floorMesh(map, pth, pm, 0.01, 0.35, 0.1);
        // A wide meadow beyond the hedge so the edge of the world isn't a cliff.
        const meadow = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), this.track(new THREE.MeshStandardMaterial({ color: 0x4a7a32, roughness: 1 })));
        meadow.position.set(map.w / 2, -0.02, map.h / 2); meadow.receiveShadow = true;
        this.root.add(meadow);

        const add = (o) => { this.root.add(o); return o; };
        const S = (o) => this.track(new THREE.MeshStandardMaterial(o));
        // Trees and hedges on the border.
        const trunkM = S({ color: 0x6a4428, roughness: 0.9 });
        const leafMs = [S({ color: 0x3f8a34, roughness: 0.8 }), S({ color: 0x4f9a3a, roughness: 0.8 }), S({ color: 0x2f7a2e, roughness: 0.8 })];
        const appleM = S({ color: 0xd82a2a, roughness: 0.4 });
        const hedgeM = S({ color: 0x356e2a, roughness: 0.9 });
        const leafGeo = new THREE.IcosahedronGeometry(1, 1);
        for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
            if (map.at(x, y) !== T.SOLID) continue;
            const inner = walkable(map.at(x + 1, y)) || walkable(map.at(x - 1, y)) || walkable(map.at(x, y + 1)) || walkable(map.at(x, y - 1));
            if (inner) {
                const hd = add(mesh(new THREE.BoxGeometry(1.02, 0.9, 1.02), hedgeM, x + 0.5, 0.45, y + 0.5));
                hd.receiveShadow = true;
                const top = add(mesh(leafGeo, hedgeM, x + 0.5, 0.9, y + 0.5)); top.scale.set(0.55, 0.25, 0.55);
            }
            if (rnd() < (inner ? 0.12 : 0.55)) this.tree(x + 0.5 + (rnd() - 0.5) * 0.6, y + 0.5 + (rnd() - 0.5) * 0.6, 1 + rnd() * 0.6, trunkM, leafMs[Math.floor(rnd() * 3)], appleM, rnd, leafGeo);
        }
        // Outer forest ring.
        for (let k = 0; k < 120; k++) {
            const a = rnd() * Math.PI * 2, d = 26 + rnd() * 18;
            const x = map.w / 2 + Math.cos(a) * d * 1.05, z = map.h / 2 + Math.sin(a) * d;
            if (x > -1 && x < map.w + 1 && z > -1 && z < map.h + 1) continue;
            this.tree(x, z, 1.2 + rnd() * 0.8, trunkM, leafMs[k % 3], null, rnd, leafGeo);
        }
        // Houses.
        for (const b of map.buildings) this.house(b, rnd);
        // Lamp posts around the plaza.
        const postM = S({ color: 0x2a2a30, roughness: 0.5, metalness: 0.6 });
        for (const [x, z] of [[16, 14], [23.5, 14], [16, 21], [23.5, 21], [19, 9], [21, 26]]) {
            add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), postM, x, 1.1, z));
            add(mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.9) })), x, 2.25, z));
            this.lightSources.push({ x, y: 2.2, z, color: 0xffc070, k: 0.8 });
        }
        // Flower beds and fences.
        const fenceM = S({ color: 0xe8dcc0, roughness: 0.8 });
        const petals = [0xff7aa8, 0xffe06a, 0xffffff, 0xb08aff, 0xff6a4a].map((c) => S({ color: c, roughness: 0.6 }));
        for (const [x0, z0, w] of [[13, 15, 4], [24, 19.6, 4], [8, 25, 3], [30, 25, 3]]) {
            for (let i = 0; i <= w * 2; i++) add(mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), fenceM, x0 + i * 0.5, 0.18, z0));
            add(mesh(new THREE.BoxGeometry(w, 0.05, 0.04), fenceM, x0 + w / 2, 0.28, z0));
            for (let i = 0; i < w * 4; i++) { const f = add(mesh(new THREE.SphereGeometry(0.07, 6, 4), petals[i % 5], x0 + rnd() * w, 0.12 + rnd() * 0.08, z0 - 0.3 - rnd() * 0.5)); f.castShadow = false; }
        }
        // Market stall by the plaza.
        const stall = new THREE.Group(); stall.position.set(25.5, 0, 16.5);
        const awn = new THREE.MeshStandardMaterial({ color: 0xe84a5a, roughness: 0.8 }); this.track(awn);
        stall.add(mesh(new THREE.BoxGeometry(1.6, 0.7, 0.7), this.track(new THREE.MeshStandardMaterial({ map: woodTex(1) })), 0, 0.35, 0));
        for (const sx of [-0.75, 0.75]) stall.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), trunkM, sx, 0.9, -0.3));
        const roof = stall.add(mesh(new THREE.BoxGeometry(1.8, 0.06, 1.1), awn, 0, 1.75, 0)); roof.rotation.x = 0.25;
        for (let i = 0; i < 9; i++) stall.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), [appleM, petals[1], S({ color: 0xff9a2a }), S({ color: 0x8a3ab8 })][i % 4], -0.6 + (i % 5) * 0.3, 0.78, -0.12 + Math.floor(i / 5) * 0.2));
        add(stall);
    }

    tree(x, z, s, trunkM, leafM, fruitM, rnd, leafGeo) {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.3, 7), trunkM, 0, 0.65, 0));
        for (let i = 0; i < 4; i++) { const l = mesh(leafGeo, leafM, (rnd() - 0.5) * 0.7, 1.5 + rnd() * 0.6, (rnd() - 0.5) * 0.7); l.scale.setScalar(0.55 + rnd() * 0.3); g.add(l); }
        if (fruitM) for (let i = 0; i < 5; i++) { const a = rnd() * 6.28; g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), fruitM, Math.cos(a) * 0.65, 1.3 + rnd() * 0.7, Math.sin(a) * 0.65)); }
        this.root.add(g);
    }

    house(b, rnd) {
        const g = new THREE.Group();
        g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
        const wall = this.track(new THREE.MeshStandardMaterial({ color: b.wall, map: b.shack ? woodTex(2) : wallTex('town').map, roughness: 0.85, transparent: true }));
        const roofM = this.track(new THREE.MeshStandardMaterial({ color: b.roof, roughness: 0.7, transparent: true }));
        const trimM = this.track(new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.8, transparent: true }));
        const winM = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.55, 0.8), transparent: true }));
        const wh = 2.0;
        const body = mesh(new THREE.BoxGeometry(b.w - 0.2, wh, b.h - 0.2), wall, 0, wh / 2, 0); body.receiveShadow = true; g.add(body);
        // Gabled roof: a triangular prism.
        const shape = new THREE.Shape(); shape.moveTo(-b.w / 2 - 0.1, 0); shape.lineTo(b.w / 2 + 0.1, 0); shape.lineTo(0, 1.5); shape.closePath();
        const rg = new THREE.ExtrudeGeometry(shape, { depth: b.h + 0.2, bevelEnabled: false }).translate(0, 0, -(b.h + 0.2) / 2);
        g.add(mesh(rg, roofM, 0, wh, 0));
        // Door (front = +z side, facing the plaza) and windows.
        g.add(mesh(new THREE.BoxGeometry(0.7, 1.25, 0.08), trimM, 0, 0.63, b.h / 2 - 0.08));
        g.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), mat('gold'), 0.22, 0.63, b.h / 2 - 0.02));
        for (const sx of [-1, 1]) {
            g.add(mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), winM, sx * (b.w / 2 - 1.1), 1.15, b.h / 2 - 0.09));
            g.add(mesh(new THREE.BoxGeometry(0.65, 0.08, 0.1), trimM, sx * (b.w / 2 - 1.1), 0.85, b.h / 2 - 0.06));
            this.lightSources.push({ x: g.position.x + sx * (b.w / 2 - 1.1), y: 1.2, z: g.position.z + b.h / 2 + 0.4, color: 0xffb060, k: 0.35 });
        }
        g.add(mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), wall, b.w / 2 - 1, wh + 1.0, -0.4));
        if (b.forge) {
            const fm = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.3), transparent: true }));
            g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), fm, -b.w / 2 + 1.3, 0.4, b.h / 2 - 0.08));
            this.lightSources.push({ x: g.position.x - b.w / 2 + 1.3, y: 0.6, z: g.position.z + b.h / 2 + 0.5, color: 0xff7a20, k: 1.0, flicker: true });
            const anvil = mesh(new THREE.BoxGeometry(0.5, 0.35, 0.25), mat('darksteel'), 1.6, 0.18, b.h / 2 + 0.6); g.add(anvil);
        }
        // Sign over the door.
        const names = { granny: 'GRANNY SMITH', smithy: 'GRAPESWOLD', olivia: 'OLIVIA', kiwirt: 'KIWIRT', tavern: 'THE ROTTEN CORE INN' };
        if (names[b.id]) {
            const sign = mesh(new THREE.PlaneGeometry(b.w * 0.55, 0.36), this.track(new THREE.MeshBasicMaterial({ map: labelTex(names[b.id], { w: 512, h: 96, font: 'bold 44px Georgia, serif' }), transparent: true })), 0, 1.65, b.h / 2 + 0.01);
            sign.castShadow = false; g.add(sign);
        }
        this.root.add(g);
        this.buildings.push({ g, b, mats: [wall, roofM, trimM, winM] });
    }

    // ------------------------------------------------------------------ interactive objects
    addObj(o) {
        if (this.objViews.has(o.id)) return this.objViews.get(o.id);
        const v = buildObj(this, o);
        if (!v) return null;
        v.g.position.set(o.x, 0, o.y);
        this.root.add(v.g);
        v.g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.objId = o.id; } });
        this.objViews.set(o.id, v);
        return v;
    }
    removeObj(id) { const v = this.objViews.get(id); if (v) { this.root.remove(v.g); this.objViews.delete(id); } }

    update(dt, world, time, hero) {
        this.time = time;
        fow.uniforms.uHero.value.set(hero.x, hero.y);
        fow.uniforms.uTime.value = time;
        for (const a of this.anims) a(dt, time);
        for (const f of this.flames) {
            const k = 0.85 + Math.sin(time * 13 + f.ph) * 0.08 + Math.sin(time * 23 + f.ph * 2) * 0.07;
            f.s.scale.set(0.45 * k, 0.65 * k * (1 + Math.sin(time * 17 + f.ph) * 0.05), 1);
            f.c.scale.set(0.16 * k, 0.26 * k, 1);
        }
        // Sync object states.
        const live = new Set();
        for (const o of world.objs) {
            live.add(o.id);
            const v = this.objViews.get(o.id) || this.addObj(o);
            if (v && v.update) v.update(dt, o, time);
        }
        for (const id of [...this.objViews.keys()]) if (!live.has(id)) this.removeObj(id);
        // Fade houses that stand between the camera and the hero.
        for (const h of this.buildings) {
            const b = h.b;
            const front = hero.y < b.y + b.h + 0.5 && hero.y > b.y - 3.6 && hero.x > b.x - 1.5 && hero.x < b.x + b.w + 1.5;
            const want = front ? 0.28 : 1;
            for (const m of h.mats) { m.opacity += (want - m.opacity) * Math.min(1, dt * 8); m.depthWrite = m.opacity > 0.9; }
        }
    }
}

function mergeGeos(list) {
    // Minimal merge for non-indexed + indexed geometries with position/normal/uv.
    const out = new THREE.BufferGeometry();
    const pos = [], nor = [], uv = [], idx = [];
    let base = 0;
    for (const g0 of list) {
        const g = g0.index ? g0 : g0;
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
        else for (let i = 0; i < p.count; i++) idx.push(i + base);
        base += p.count;
    }
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
}
export { mergeGeos };

// --------------------------------------------------------------------------- object models
function buildObj(lv, o) {
    const g = new THREE.Group();
    const M = (opts, key = 'obj') => lv.track(patchFow(new THREE.MeshStandardMaterial(opts), { key }));
    const add = (m) => { g.add(m); return m; };
    const v = { g, o };
    switch (o.type) {
        case 'crate': {
            const wm = M({ map: woodTex(0), roughness: 0.8 });
            const s = 0.62;
            add(mesh(new THREE.BoxGeometry(s, s, s), wm, 0, s / 2, 0)).rotation.y = (o.id % 7) * 0.2;
            const bandM = M({ color: 0x6a4424, roughness: 0.8 });
            add(mesh(new THREE.BoxGeometry(s + 0.02, 0.06, s + 0.02), bandM, 0, s * 0.8, 0)).rotation.y = (o.id % 7) * 0.2;
            for (let i = 0; i < 3; i++) add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M({ color: [0xd82a2a, 0xffa020, 0x8ad82a][i], roughness: 0.4 }), (i - 1) * 0.16, s + 0.04, 0));
            break;
        }
        case 'jar': {
            add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.48, 14), M({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.5 }), 0, 0.24, 0));
            add(mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.36, 14), M({ color: [0xb0103a, 0xff7a10, 0x6a1a8a][o.id % 3], roughness: 0.3 }), 0, 0.19, 0));
            add(mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.08, 14), M({ color: 0xe8e0d0, roughness: 0.9 }), 0, 0.5, 0));
            add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 14), M({ color: 0xd84a4a, roughness: 0.9 }), 0, 0.52, 0));
            break;
        }
        case 'barrel': case 'keg': {
            const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.27 + Math.sin(t * Math.PI) * 0.06, t * 0.7)); }
            const bm = o.type === 'keg' ? M({ color: 0x3a7ad8, roughness: 0.4, metalness: 0.3 }) : M({ map: woodTex(1), roughness: 0.8 });
            add(mesh(new THREE.LatheGeometry(pts, 16), bm, 0, 0, 0));
            add(mesh(new THREE.CircleGeometry(0.27, 16), bm, 0, 0.7, 0)).rotation.x = -Math.PI / 2;
            const ring = M({ color: 0x8a8a90, roughness: 0.4, metalness: 0.8 });
            for (const y of [0.12, 0.58]) add(mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 20), ring, 0, y, 0)).rotation.x = Math.PI / 2;
            if (o.type === 'keg') {
                const lbl = add(mesh(new THREE.PlaneGeometry(0.34, 0.16), lv.track(new THREE.MeshBasicMaterial({ map: labelTex('SODA', { w: 128, h: 64, bg: '#ffe04a', fg: '#c81a1a', font: 'bold 38px Arial' }) })), 0, 0.38, 0.33));
                lbl.castShadow = false;
                const fizz = add(mesh(new THREE.SphereGeometry(0.04, 6, 4), lv.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.8, 2.2) })), 0, 0.78, 0));
                v.update = (dt, ob, t) => { fizz.position.y = 0.75 + ((t * 0.6 + ob.id * 0.1) % 1) * 0.35; fizz.visible = ob.state !== 'broken'; };
            }
            break;
        }
        case 'chest': case 'bigchest': {
            const s = o.type === 'bigchest' ? 1.25 : 1;
            const wick = M({ color: 0xc8955a, roughness: 0.85, map: woodTex(0) });
            add(mesh(new THREE.BoxGeometry(0.8 * s, 0.42 * s, 0.5 * s), wick, 0, 0.21 * s, 0));
            const lid = new THREE.Group(); lid.position.set(0, 0.42 * s, -0.25 * s); g.add(lid);
            const ging = lv.track(patchFow(new THREE.MeshStandardMaterial({ map: gingham(), roughness: 0.9 }), { key: 'obj' }));
            lid.add(mesh(new THREE.BoxGeometry(0.84 * s, 0.08 * s, 0.54 * s), ging, 0, 0.04 * s, 0.25 * s));
            const handle = add(mesh(new THREE.TorusGeometry(0.22 * s, 0.025, 6, 16, Math.PI), wick, 0, 0.45 * s, 0));
            if (o.type === 'bigchest') for (const sx of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.06, 0.44 * s, 0.52 * s), lv.track(patchFow(new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.3 }), { key: 'obj' })), sx * 0.4 * s, 0.22 * s, 0));
            v.update = (dt, ob) => { const open = ob.state !== 'idle'; lid.rotation.x += ((open ? -1.9 : 0) - lid.rotation.x) * Math.min(1, dt * 8); handle.visible = !open; };
            break;
        }
        case 'shrine': {
            const colors = { ripe: 0xff4a6a, crunchy: 0xc8a060, zippy: 0x4ad8ff, fresh: 0x6aff8a, sweet: 0xff9ae8, fizzy: 0xfff06a };
            const c = colors[o.shrine] || 0xffffff;
            add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 12), M({ color: 0x8a8090, roughness: 0.7 }), 0, 0.17, 0));
            const cup = add(mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.7, 16, 1, true), M({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.4, side: THREE.DoubleSide }), 0, 0.7, 0));
            const liquid = add(mesh(new THREE.CylinderGeometry(0.27, 0.19, 0.55, 16), lv.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8) })), 0, 0.64, 0));
            const straw = add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), M({ color: 0xff4a8a, roughness: 0.4 }), 0.1, 1.05, 0)); straw.rotation.z = -0.25;
            add(mesh(new THREE.SphereGeometry(0.09, 10, 8), M({ color: 0xd8102a, roughness: 0.3 }), -0.1, 1.06, 0.05));
            lv.lightSources.push({ x: o.x, y: 1.2, z: o.y, color: c, k: 0.9, objId: o.id });
            v.update = (dt, ob, t) => { const used = ob.state !== 'idle'; liquid.scale.y = used ? 0.08 : 1 + Math.sin(t * 3) * 0.03; liquid.position.y = used ? 0.4 : 0.64; };
            break;
        }
        case 'up': {
            const sm = M({ map: wallTex(lv.theme === 'town' ? 'cellar' : lv.theme).map, roughness: 0.9 });
            for (let i = 0; i < 4; i++) add(mesh(new THREE.BoxGeometry(1.0, 0.18 * (i + 1), 0.3), sm, 0, 0.09 * (i + 1), -0.1 - i * 0.3 + 0.45));
            add(mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), sm, -0.55, 0.8, -0.6)); add(mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), sm, 0.55, 0.8, -0.6));
            const lamp = add(mesh(new THREE.SphereGeometry(0.08, 8, 6), lv.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.0) })), 0, 1.7, -0.6));
            lamp.castShadow = false;
            lv.lightSources.push({ x: o.x, y: 1.6, z: o.y - 0.3, color: 0xffd08a, k: 0.8 });
            break;
        }
        case 'down': {
            const hole = add(mesh(new THREE.BoxGeometry(1.3, 0.02, 1.3), lv.track(new THREE.MeshBasicMaterial({ color: 0x000000 })), 0, 0.006, 0));
            hole.receiveShadow = false;
            const sm = M({ map: wallTex(lv.theme).map, roughness: 0.9 });
            for (const [x, z, w, d] of [[0, -0.7, 1.5, 0.12], [0, 0.7, 1.5, 0.12], [-0.7, 0, 0.12, 1.5], [0.7, 0, 0.12, 1.5]]) add(mesh(new THREE.BoxGeometry(w, 0.16, d), sm, x, 0.08, z));
            for (let i = 0; i < 3; i++) add(mesh(new THREE.BoxGeometry(1.1, 0.04, 0.3), sm, 0, 0.02 - i * 0.001, -0.4 + i * 0.32)).scale.y = 1 - i * 0.3;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: lv.theme === 'core' ? 0xff4a2a : 0x8a6aff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
            glow.scale.set(1.8, 1.8, 1); glow.position.y = 0.3; g.add(glow);
            lv.lightSources.push({ x: o.x, y: 0.6, z: o.y, color: lv.theme === 'core' ? 0xff4a2a : 0x8a6aff, k: 0.9 });
            v.update = (dt, ob, t) => { glow.material.opacity = 0.55 + Math.sin(t * 2.5) * 0.2; };
            break;
        }
        case 'cellar': {
            const stone = M({ color: 0x9a9088, roughness: 0.9 });
            add(mesh(new THREE.BoxGeometry(1.8, 0.35, 1.5), stone, 0, 0.17, 0));
            const wm = M({ map: woodTex(2), roughness: 0.8 });
            for (const sx of [-1, 1]) { const d = add(mesh(new THREE.BoxGeometry(0.75, 0.06, 1.2), wm, sx * 0.4, 0.42, 0)); d.rotation.z = sx * -0.28; }
            add(mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), mat('gold'), 0.12, 0.5, 0.1)).rotation.x = Math.PI / 2;
            const sign = add(mesh(new THREE.PlaneGeometry(1.4, 0.32), lv.track(new THREE.MeshBasicMaterial({ map: labelTex('ROOT CELLAR', { w: 512, h: 112, font: 'bold 52px Georgia, serif' }) })), 0, 1.25, -0.72));
            sign.castShadow = false;
            for (const sx of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), wm, sx * 0.72, 0.7, -0.72));
            break;
        }
        case 'well': {
            const pts = []; for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector2(0.7 + (i % 2) * 0.02, i * 0.12));
            const stone = M({ map: floorTex('path').map, roughness: 0.9 });
            add(mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.7, 20, 1, true), stone, 0, 0.35, 0)).material.side = THREE.DoubleSide;
            add(mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 24), stone, 0, 0.7, 0)).rotation.x = Math.PI / 2;
            const water = add(mesh(new THREE.CircleGeometry(0.75, 24), lv.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 2.0) })), 0, 0.5, 0)); water.rotation.x = -Math.PI / 2; water.castShadow = false;
            const wood = M({ map: woodTex(1), roughness: 0.8 });
            for (const sx of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), wood, sx * 0.8, 0.9, 0));
            const roof = new THREE.Shape(); roof.moveTo(-1.1, 0); roof.lineTo(1.1, 0); roof.lineTo(0, 0.6); roof.closePath();
            add(mesh(new THREE.ExtrudeGeometry(roof, { depth: 1.2, bevelEnabled: false }).translate(0, 0, -0.6), M({ color: 0xb84a3a, roughness: 0.7 }), 0, 1.75, 0));
            add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), wood, 0, 1.5, 0)).rotation.z = Math.PI / 2;
            add(mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 10), wood, 0.2, 1.1, 0));
            const runes = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x6ad8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
            runes.scale.set(2.2, 2.2, 1); runes.position.y = 0.6; g.add(runes);
            lv.lightSources.push({ x: o.x, y: 1, z: o.y, color: 0x6ad8ff, k: 0.8 });
            v.update = (dt, ob, t) => { runes.material.opacity = 0.4 + Math.sin(t * 2) * 0.15; };
            break;
        }
        case 'stash': {
            const wood = M({ map: woodTex(2), roughness: 0.7 });
            const gold = lv.track(patchFow(new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.3 }), { key: 'obj' }));
            add(mesh(new THREE.BoxGeometry(1.0, 0.55, 0.6), wood, 0, 0.28, 0));
            const lid = add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 14, 1, false, 0, Math.PI), wood, 0, 0.55, 0)); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2;
            for (const sx of [-0.35, 0.35]) add(mesh(new THREE.BoxGeometry(0.08, 0.62, 0.62), gold, sx, 0.31, 0));
            add(mesh(new THREE.BoxGeometry(0.16, 0.18, 0.05), gold, 0, 0.5, 0.31));
            break;
        }
        case 'portal': {
            const crust = M({ color: 0xd9973e, roughness: 0.7 });
            const ring = add(mesh(new THREE.TorusGeometry(0.62, 0.11, 10, 28), crust, 0, 1.0, 0));
            for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(mesh(new THREE.SphereGeometry(0.06, 6, 4), crust, Math.cos(a) * 0.62, 1.0 + Math.sin(a) * 0.62, 0.08)); }
            const swirl = add(mesh(new THREE.CircleGeometry(0.58, 32), lv.track(portalMaterial()), 0, 1.0, 0.0));
            swirl.castShadow = false;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff8a5a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
            glow.scale.set(2.4, 2.4, 1); glow.position.y = 1.0; g.add(glow);
            lv.lightSources.push({ x: o.x, y: 1.0, z: o.y + 0.4, color: 0xff9a5a, k: 1.2, objId: o.id });
            v.update = (dt, ob, t) => { swirl.material.uniforms.uTime.value = t; g.rotation.y = 0; ring.rotation.z = t * 0.3; };
            break;
        }
        case 'lectern': {
            const wood = M({ map: woodTex(2) });
            add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8), wood, 0, 0.45, 0));
            const top = add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.4), wood, 0, 0.92, 0)); top.rotation.x = 0.4;
            const book = add(mesh(new THREE.BoxGeometry(0.42, 0.06, 0.3), M({ color: 0xd84a6a, roughness: 0.6 }), 0, 0.98, 0.02)); book.rotation.x = 0.4;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x7dffa6, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.set(1.2, 1.2, 1); glow.position.y = 1.1; g.add(glow);
            v.update = (dt, ob, t) => { book.visible = glow.visible = ob.state === 'idle'; glow.material.opacity = 0.6 + Math.sin(t * 4) * 0.3; };
            break;
        }
        case 'anvil': {
            const fuzz = lv.track(patchFow(new THREE.MeshPhysicalMaterial({ color: 0xffa88a, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffe0d0), sheenRoughness: 0.4 }), { key: 'fuzz' }));
            add(mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), fuzz, 0, 0.15, 0));
            add(mesh(new THREE.BoxGeometry(0.75, 0.2, 0.34), fuzz, 0, 0.4, 0));
            add(mesh(new THREE.ConeGeometry(0.15, 0.3, 8), fuzz, 0.5, 0.42, 0)).rotation.z = Math.PI / 2;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x7dffa6, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.set(1.4, 1.4, 1); glow.position.y = 0.5; g.add(glow);
            v.update = (dt, ob, t) => { g.visible = ob.state === 'idle'; glow.material.opacity = 0.5 + Math.sin(t * 4) * 0.3; };
            break;
        }
        default: return null;
    }
    if (o.breakable) {
        const prev = v.update;
        v.update = (dt, ob, t) => { if (prev) prev(dt, ob, t); g.visible = ob.state !== 'broken'; };
    }
    return v;
}

let _web = null;
function webTex() {
    if (_web) return _web;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 0.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); x.stroke(); }
    for (let r = 14; r < 128; r += 16) { x.beginPath(); for (let i = 0; i <= 9; i++) { const a = (i / 9) * Math.PI * 0.5; const rr = r + Math.sin(i * 3) * 3; if (i) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); }
    _web = new THREE.CanvasTexture(c);
    return _web;
}

let _ging = null;
function gingham() {
    if (_ging) return _ging;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(220,40,60,0.55)';
    for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 8, 64); x.fillRect(0, i, 64, 8); }
    _ging = new THREE.CanvasTexture(c); _ging.colorSpace = THREE.SRGBColorSpace; _ging.wrapS = _ging.wrapT = THREE.RepeatWrapping; _ging.repeat.set(2, 2);
    return _ging;
}
export { gingham };

function portalMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
                float s = sin(a * 3.0 + r * 9.0 - uTime * 4.0) * 0.5 + 0.5;
                vec3 col = mix(vec3(1.0, 0.45, 0.2), vec3(1.0, 0.85, 0.5), s) * (1.6 - r);
                gl_FragColor = vec4(col * 1.4, smoothstep(1.0, 0.7, r) * 0.95); }`,
    });
}
