/**
 * ground.js — the island itself: studded baseplate land, the sea, and the hills.
 *
 *  - Land: one quad per land tile at LAND_H with a per-tile colour, and a skirt down into the sea
 *    wherever land meets water, so the island reads as a thick toy plate. A stud normal map gives the
 *    baseplate look; path tiles are smooth (vStud = 0).
 *  - Sea: a large plane with a shader. A distance-to-land texture (two samples per tile, chamfer
 *    distance) drives shallow-to-deep colour and rings of foam that roll in toward the beach.
 *  - Hills: rock tiles become a flat-shaded height field whose height is the distance from the
 *    nearest non-rock ground, so hills meet the ground exactly at the tile boundary and never spill
 *    over neighbouring track. Track through a hill is a tunnel: the hill covers it, and the track
 *    view adds portals.
 */

import * as THREE from 'three';
import { N, T, LAND_H } from '../config.js';
import { Noise2 } from '../rng.js';
import { idx, inb, DX, DZ, edgeMask } from '../sim/grid.js';
import { studNormalMap, night, toyMat } from './materials.js';
import { Builder } from './builder.js';
import { buildItem } from './models.js';

export const GRASS = { summer: 0x6cc04a, pine: 0x5aa846, tropical: 0x7fd052, spring: 0x88d46a, autumn: 0xb0b84a, winter: 0xeef4fa };
const MEADOW = { summer: 0x7ccb52, pine: 0x6ab650, tropical: 0x8ed85e, spring: 0x98dc78, autumn: 0xc0c45a, winter: 0xeef4fa };
const SAND = 0xf0d898, PATH = 0xcfc8bc, SNOW = 0xf1f6fb, ROCKTOP = 0x8d9399;

function tileColor(t, season) {
    switch (t) {
        case T.SAND: return SAND;
        case T.PATH: return PATH;
        case T.MEADOW: return MEADOW[season] || MEADOW.summer;
        case T.SNOW: return SNOW;
        case T.ROCK: return ROCKTOP;
        default: return GRASS[season] || GRASS.summer;
    }
}

function hash(x, z) { let h = x * 374761393 + z * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export class Ground {
    constructor(scene) {
        this.scene = scene;
        this.terrainV = -1;
        this.decoV = '';
        this.landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, normalMap: studNormalMap(), normalScale: new THREE.Vector2(0.9, 0.9) });
        this.landMat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float stud;\nvarying float vStud;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStud = stud;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStud;').replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vStud;');
        };
        this.land = new THREE.Mesh(new THREE.BufferGeometry(), this.landMat);
        this.land.receiveShadow = true;
        scene.add(this.land);

        this.hillMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, flatShading: true });
        this.hills = new THREE.Mesh(new THREE.BufferGeometry(), this.hillMat);
        this.hills.castShadow = true; this.hills.receiveShadow = true;
        scene.add(this.hills);

        this.shoreData = new Uint8Array(N * 2 * N * 2);
        this.shoreTex = new THREE.DataTexture(this.shoreData, N * 2, N * 2, THREE.RedFormat);
        this.shoreTex.magFilter = THREE.LinearFilter; this.shoreTex.minFilter = THREE.LinearFilter;
        this.shoreTex.wrapS = this.shoreTex.wrapT = THREE.ClampToEdgeWrapping;
        this.waterU = {
            uTime: { value: 0 }, uShore: { value: this.shoreTex }, uNight: night, uDay: { value: 1 },
            uDeep: { value: new THREE.Color(0x1f74c4) }, uMid: { value: new THREE.Color(0x2fa9dd) }, uShallow: { value: new THREE.Color(0x6fdde2) },
        };
        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(900, 900, 1, 1).rotateX(-Math.PI / 2),
            new THREE.ShaderMaterial({
                fog: true,
                uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
                vertexShader: `
                    varying vec2 vW;
                    #include <fog_pars_vertex>
                    void main(){
                        vec4 wp = modelMatrix * vec4(position, 1.0);
                        vW = wp.xz;
                        vec4 mvPosition = viewMatrix * wp;
                        gl_Position = projectionMatrix * mvPosition;
                        #include <fog_vertex>
                    }`,
                fragmentShader: `
                    uniform float uTime, uNight, uDay; uniform sampler2D uShore; uniform vec3 uDeep, uMid, uShallow;
                    varying vec2 vW;
                    #include <fog_pars_fragment>
                    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
                    void main(){
                        vec2 uv = (vW + ${(N / 2).toFixed(1)}) / ${N.toFixed(1)};
                        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
                        float d = mix(1.0, texture2D(uShore, clamp(uv, 0.0, 1.0)).r, inside);   // 0 at the shore … 1 far out (8 tiles)
                        float dt = d * 8.0;
                        vec3 c = mix(uShallow, uMid, smoothstep(0.0, 0.35, d));
                        c = mix(c, uDeep, smoothstep(0.3, 1.0, d));
                        // gentle wave pattern
                        float w = vn(vW * 0.9 + vec2(uTime * 0.25, uTime * 0.18)) * 0.6 + vn(vW * 2.3 - vec2(uTime * 0.3, -uTime * 0.2)) * 0.4;
                        c += (w - 0.5) * 0.06;
                        // sparkles
                        float sp = vn(vW * 6.0 + uTime * vec2(0.7, 0.4));
                        c += smoothstep(0.82, 0.95, sp) * 0.18 * uDay * smoothstep(0.1, 0.5, d);
                        // foam: the edge itself plus rings rolling in toward the beach
                        float edge = 1.0 - smoothstep(0.08, 0.32, dt + (w - 0.5) * 0.3);
                        float ring = smoothstep(0.75, 0.95, sin(dt * 5.5 + uTime * 1.6 + w * 2.0)) * (1.0 - smoothstep(0.6, 1.8, dt));
                        float foam = clamp(edge + ring * 0.55, 0.0, 1.0) * inside;
                        c = mix(c, vec3(0.97, 0.99, 1.0), foam * 0.85);
                        c *= mix(1.0, 0.16, uNight);
                        c += vec3(0.0, 0.012, 0.035) * uNight;
                        gl_FragColor = vec4(c, 1.0);
                        #include <tonemapping_fragment>
                        #include <colorspace_fragment>
                        #include <fog_fragment>
                    }`,
            }),
        );
        water.material.uniforms = { ...water.material.uniforms, ...this.waterU };
        water.position.y = 0.03;
        water.receiveShadow = false;
        water.renderOrder = -1;
        scene.add(water);
        this.water = water;

        // Meadow flowers: one little cluster per free meadow tile, instanced.
        const fb = new Builder();
        const cols = [0xf6c21c, 0xffffff, 0xf27bb2, 0x9a77d6, 0xd8352a];
        for (let k = 0; k < 7; k++) { const a = k * 2.4, r = 0.12 + (k % 3) * 0.1; fb.sphere(0.028, cols[k % 5], Math.cos(a) * r, 0.04, Math.sin(a) * r, { seg: 5, rings: 3 }); }
        for (let k = 0; k < 4; k++) fb.box(0.03, 0.05, 0.12, 0x4f9e3a, Math.cos(k * 1.7) * 0.25, 0, Math.sin(k * 1.7) * 0.25, { ry: k });
        this.flowerGeo = fb.geometry();
        this.flowers = null;
        this.portalGeo = null;
    }

    update(t, dayLight) {
        this.waterU.uTime.value = t;
        this.waterU.uDay.value = dayLight;
    }

    sync(world) {
        if (world.terrainV !== this.terrainV || world.season !== this.season || this._trackV !== world.trackV) {
            const terrainChanged = world.terrainV !== this.terrainV || world.season !== this.season;
            this.terrainV = world.terrainV;
            this.season = world.season;
            this._trackV = world.trackV;
            if (terrainChanged) { this.buildLand(world); this.buildShore(world); }
            // Hills only care about track that runs through them (tunnel mouths), so most track edits skip this.
            let sig = '';
            for (let i = 0; i < N * N; i++) if (world.tiles[i] === T.ROCK && world.track[i]) sig += i + ':' + world.track[i] + ',';
            if (terrainChanged || sig !== this.hillSig) { this.hillSig = sig; this.buildHills(world); }
        }
        const dv = `${world.terrainV}:${world.objV}:${world.trackV}`;
        if (dv !== this.decoV) { this.decoV = dv; this.buildFlowers(world); }
    }

    buildLand(world) {
        const pos = [], col = [], uv = [], stud = [], nrm = [];
        const c = new THREE.Color(), cs = new THREE.Color();
        const H = LAND_H, B = -0.55;
        const quad = (p, n, colr, s) => {
            // p: 4 corners (x,y,z) in CCW order seen from the front
            for (const k of [0, 1, 2, 0, 2, 3]) {
                pos.push(p[k][0], p[k][1], p[k][2]);
                nrm.push(n[0], n[1], n[2]);
                col.push(colr.r, colr.g, colr.b);
                uv.push(p[k][0], p[k][2] + p[k][1]);
                stud.push(s);
            }
        };
        for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
            const t = world.tiles[idx(x, z)];
            if (t === T.WATER) continue;
            const x0 = x - N / 2, z0 = z - N / 2;
            c.setHex(tileColor(t, world.season));
            const j = (hash(x, z) - 0.5) * (t === T.PATH ? 0.06 : 0.07);
            c.offsetHSL(0, 0, j);
            if (t === T.PATH && (x + z) % 2) c.offsetHSL(0, 0, -0.03);
            quad([[x0, H, z0], [x0, H, z0 + 1], [x0 + 1, H, z0 + 1], [x0 + 1, H, z0]], [0, 1, 0], c, t === T.PATH ? 0 : 1);
            // skirts on edges facing water
            cs.copy(c).offsetHSL(0, 0, -0.12);
            if (t === T.SAND || t === T.GRASS || t === T.MEADOW) cs.setHex(0xd9bb7c).offsetHSL(0, 0, j);
            for (let e = 0; e < 4; e++) {
                const nx = x + DX[e], nz = z + DZ[e];
                if (inb(nx, nz) && world.tiles[idx(nx, nz)] !== T.WATER) continue;
                if (e === 0) quad([[x0 + 1, H, z0], [x0 + 1, B, z0], [x0, B, z0], [x0, H, z0]], [0, 0, -1], cs, 0);
                if (e === 1) quad([[x0 + 1, H, z0 + 1], [x0 + 1, B, z0 + 1], [x0 + 1, B, z0], [x0 + 1, H, z0]], [1, 0, 0], cs, 0);
                if (e === 2) quad([[x0, H, z0 + 1], [x0, B, z0 + 1], [x0 + 1, B, z0 + 1], [x0 + 1, H, z0 + 1]], [0, 0, 1], cs, 0);
                if (e === 3) quad([[x0, H, z0], [x0, B, z0], [x0, B, z0 + 1], [x0, H, z0 + 1]], [-1, 0, 0], cs, 0);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('stud', new THREE.Float32BufferAttribute(stud, 1));
        g.computeBoundingSphere();
        this.land.geometry.dispose();
        this.land.geometry = g;
    }

    /** Distance from each half-tile sample to the nearest land, 0..8 tiles → 0..255. */
    buildShore(world) {
        const R = 2, M = N * R;
        const d = new Float32Array(M * M).fill(1e9);
        for (let z = 0; z < M; z++) for (let x = 0; x < M; x++) if (world.tiles[idx((x / R) | 0, (z / R) | 0)] !== T.WATER) d[z * M + x] = 0;
        const a = 1, b = Math.SQRT2;
        for (let pass = 0; pass < 2; pass++) {
            for (let z = 0; z < M; z++) for (let x = 0; x < M; x++) {
                let v = d[z * M + x];
                if (x > 0) v = Math.min(v, d[z * M + x - 1] + a);
                if (z > 0) v = Math.min(v, d[(z - 1) * M + x] + a);
                if (x > 0 && z > 0) v = Math.min(v, d[(z - 1) * M + x - 1] + b);
                if (x < M - 1 && z > 0) v = Math.min(v, d[(z - 1) * M + x + 1] + b);
                d[z * M + x] = v;
            }
            for (let z = M - 1; z >= 0; z--) for (let x = M - 1; x >= 0; x--) {
                let v = d[z * M + x];
                if (x < M - 1) v = Math.min(v, d[z * M + x + 1] + a);
                if (z < M - 1) v = Math.min(v, d[(z + 1) * M + x] + a);
                if (x < M - 1 && z < M - 1) v = Math.min(v, d[(z + 1) * M + x + 1] + b);
                if (x > 0 && z < M - 1) v = Math.min(v, d[(z + 1) * M + x - 1] + b);
                d[z * M + x] = v;
            }
        }
        for (let i = 0; i < M * M; i++) {
            // distance measured from the land's edge, in tiles (samples are half a tile apart, centred)
            const tiles = Math.max(0, d[i] / R - 0.25);
            this.shoreData[i] = Math.min(255, Math.round((tiles / 8) * 255));
        }
        this.shoreTex.needsUpdate = true;
    }

    buildHills(world) {
        const R = 3, M = N * R + 1;
        const rockTile = (x, z) => inb(x, z) && world.tiles[idx(x, z)] === T.ROCK;
        // A vertex is inside the hills only if every tile touching it is rock.
        const inside = new Uint8Array(M * M);
        let any = false;
        for (let vz = 0; vz < M; vz++) for (let vx = 0; vx < M; vx++) {
            const fx = vx / R, fz = vz / R;
            const xs = Number.isInteger(fx) ? [fx - 1, fx] : [Math.floor(fx)];
            const zs = Number.isInteger(fz) ? [fz - 1, fz] : [Math.floor(fz)];
            let all = true;
            for (const x of xs) for (const z of zs) if (!rockTile(x, z)) all = false;
            inside[vz * M + vx] = all ? 1 : 0;
            if (all) any = true;
        }
        if (!any) { this.hills.visible = false; if (this.hillTrees) this.hillTrees.visible = false; return; }
        this.hills.visible = true;
        const d = new Float32Array(M * M);
        for (let i = 0; i < M * M; i++) d[i] = inside[i] ? 1e9 : 0;
        const a = 1, b = Math.SQRT2;
        for (let pass = 0; pass < 2; pass++) {
            for (let z = 1; z < M; z++) for (let x = 1; x < M - 1; x++) { const k = z * M + x; d[k] = Math.min(d[k], d[k - 1] + a, d[k - M] + a, d[k - M - 1] + b, d[k - M + 1] + b); }
            for (let z = M - 2; z >= 0; z--) for (let x = M - 2; x >= 1; x--) { const k = z * M + x; d[k] = Math.min(d[k], d[k + 1] + a, d[k + M] + a, d[k + M + 1] + b, d[k + M - 1] + b); }
        }
        // Tunnel mouths: just inside a portal the hill rises steeply so it covers the train.
        const portalBoost = new Float32Array(M * M);
        for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
            const i = idx(x, z);
            if (world.tiles[i] !== T.ROCK || !world.track[i]) continue;
            const em = edgeMask(world.track[i]);
            for (let e = 0; e < 4; e++) {
                if (!(em & (1 << e))) continue;
                for (let s = 0; s <= R; s++) for (let depth = 1; depth <= 2; depth++) {
                    let vx, vz;
                    if (e === 0) { vx = x * R + s; vz = z * R + depth; }
                    if (e === 2) { vx = x * R + s; vz = (z + 1) * R - depth; }
                    if (e === 1) { vz = z * R + s; vx = (x + 1) * R - depth; }
                    if (e === 3) { vz = z * R + s; vx = x * R + depth; }
                    portalBoost[vz * M + vx] = Math.max(portalBoost[vz * M + vx], depth === 1 ? 1.05 : 1.1);
                }
            }
        }
        const noise = new Noise2(world.seed ^ 0xabc);
        const hgt = new Float32Array(M * M);
        for (let vz = 0; vz < M; vz++) for (let vx = 0; vx < M; vx++) {
            const k = vz * M + vx;
            if (!inside[k]) continue;
            const dt = d[k] / R;   // tiles from the hill's edge
            const n = noise.fbm(vx / R * 0.45, vz / R * 0.45, 3);
            let h = Math.min(dt * 1.7, 0.75 + dt * 0.62) * (0.75 + n * 0.55);
            h = Math.min(h, 3.6);
            hgt[k] = Math.max(h, portalBoost[k]);
        }
        const pos = [], col = [];
        const winter = world.season === 'winter';
        const grass = new THREE.Color(GRASS[world.season] || GRASS.summer), rock = new THREE.Color(0x8e959c), rock2 = new THREE.Color(0x7d7368), snow = new THREE.Color(0xf6f9fc), cc = new THREE.Color();
        const X = (vx) => vx / R - N / 2, Z = (vz) => vz / R - N / 2;
        const push = (vx, vz) => {
            const h = hgt[vz * M + vx];
            pos.push(X(vx), LAND_H + h, Z(vz));
            const n = hash(vx, vz);
            if (h > (winter ? 1.0 : 2.1) + n * 0.3) cc.copy(snow);
            else if (h < 0.35 + n * 0.2) cc.copy(grass).lerp(rock, 0.25);
            else cc.copy(n > 0.5 ? rock : rock2).offsetHSL(0, 0, (n - 0.5) * 0.08);
            col.push(cc.r, cc.g, cc.b);
        };
        for (let vz = 0; vz < M - 1; vz++) for (let vx = 0; vx < M - 1; vx++) {
            const a0 = vz * M + vx, a1 = a0 + 1, a2 = a0 + M, a3 = a0 + M + 1;
            if (!(inside[a0] || inside[a1] || inside[a2] || inside[a3])) continue;
            // only quads whose tile is rock
            const tx = Math.floor((vx + 0.5) / R), tz = Math.floor((vz + 0.5) / R);
            if (!rockTile(tx, tz)) continue;
            if ((vx + vz) % 2) { push(vx, vz); push(vx, vz + 1); push(vx + 1, vz + 1); push(vx, vz); push(vx + 1, vz + 1); push(vx + 1, vz); }
            else { push(vx, vz); push(vx, vz + 1); push(vx + 1, vz); push(vx + 1, vz); push(vx, vz + 1); push(vx + 1, vz + 1); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        this.hills.geometry.dispose();
        this.hills.geometry = g;
        // a sprinkle of little pines on the lower slopes, away from tunnels
        const spots = [];
        for (let vz = 1; vz < M - 1; vz++) for (let vx = 1; vx < M - 1; vx++) {
            const k = vz * M + vx, h = hgt[k];
            if (!inside[k] || h < 0.25 || h > (winter ? 0.9 : 1.6) || portalBoost[k] > 0) continue;
            const r = hash(vx * 7 + 3, vz * 13 + 1);
            if (r > 0.16) continue;
            const tx = Math.floor(vx / R), tz = Math.floor(vz / R);
            if (world.track[idx(tx, tz)]) continue;
            spots.push([X(vx) + (r - 0.08) * 2, LAND_H + h - 0.05, Z(vz) + (hash(vx, vz * 3) - 0.5) * 0.3, 0.45 + r * 2.5]);
        }
        if (this.hillTrees) { this.scene.remove(this.hillTrees); this.hillTrees.dispose(); this.hillTrees = null; }
        if (spots.length) {
            const geo = buildItem(winter ? 'tree_snowy' : 'tree_pine').geo;
            this.hillTrees = new THREE.InstancedMesh(geo, toyMat, spots.length);
            const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
            spots.forEach(([x, y, z, s], i) => { p.set(x, y, z); sc.setScalar(s); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s * 20); m.compose(p, q, sc); this.hillTrees.setMatrixAt(i, m); });
            this.hillTrees.castShadow = true; this.hillTrees.receiveShadow = true;
            this.scene.add(this.hillTrees);
        }
    }

    buildFlowers(world) {
        const spots = [];
        for (let i = 0; i < N * N; i++) if (world.tiles[i] === T.MEADOW && world.objAt[i] < 0 && !world.track[i]) spots.push(i);
        if (this.flowers) { this.scene.remove(this.flowers); this.flowers.dispose(); }
        this.flowers = new THREE.InstancedMesh(this.flowerGeo, toyMat, Math.max(1, spots.length));
        this.flowers.count = spots.length;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
        spots.forEach((i, k) => {
            const x = i % N, z = (i / N) | 0;
            p.set(x - N / 2 + 0.5, LAND_H, z - N / 2 + 0.5);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(x, z) * 6.28);
            m.compose(p, q, s);
            this.flowers.setMatrixAt(k, m);
        });
        this.flowers.instanceMatrix.needsUpdate = true;
        this.flowers.receiveShadow = true;
        this.scene.add(this.flowers);
    }
}
