// The river on screen: water, banks, cliffs, sandbars and trees, built in 120 m chunks from the sim's river
// (riverAt is a pure read). Sim (x, y) is world (x, −y): the boat sails toward −Z.
//
// The water is one shader: cel-banded turquoise that darkens toward the middle, ripple streaks scrolling
// downriver, a bright foam line along every shore and sandbar, and sparkles.

import * as THREE from 'three';
import { riverAt } from '../sim/river.js';
import { toonGradient } from './toon.js';
import { hash3 } from '../rng.js';

export const CHUNK = 120;
const ROW = 2;

export const PALETTES = {
    sakura: {
        sky: 0xbfe6ff, fog: 0xcdeeff, deep: 0x0f9fc4, shallow: 0x4fe8e0, foam: 0xffffff, streak: 0xc9fbff,
        sand: 0xf6e3a8, grass: 0x7ad06a, grass2: 0x5bb85c, rock: 0xa4a9bd, rock2: 0x8a8fa6,
        leaves: [0xffa6cf, 0xffc4dd, 0xff8fbf, 0xfff0f6], trunk: 0x6b4a3a, cliff: [7, 12],
        sun: 0xfff4e0, hemiSky: 0xd8f0ff, hemiGround: 0x6a8a6a,
    },
    jade: {
        sky: 0xa6e3cc, fog: 0xb8ecd6, deep: 0x0b8f84, shallow: 0x46dcb4, foam: 0xf4fffb, streak: 0xb8ffe9,
        sand: 0xd9cf95, grass: 0x2f9e57, grass2: 0x247f46, rock: 0x6f8f80, rock2: 0x587466,
        leaves: [0x2fb05a, 0x55c96a, 0x1e8a45, 0x8fe07a], trunk: 0x4a3a2a, cliff: [6, 10],
        sun: 0xf0fff0, hemiSky: 0xd0fff0, hemiGround: 0x2d5a40,
    },
    dusk: {
        sky: 0xffb48a, fog: 0xffc49e, deep: 0x1f6fa8, shallow: 0x5fc4e0, foam: 0xfff3e8, streak: 0xffe2c8,
        sand: 0xe8c48a, grass: 0xb98a46, grass2: 0x9a7038, rock: 0xb85c3e, rock2: 0x8c4030,
        leaves: [0xff8a3d, 0xffb23d, 0xe0562a, 0xffd27a], trunk: 0x3a2a24, cliff: [12, 18],
        sun: 0xffd8b0, hemiSky: 0xffe0c8, hemiGround: 0x6a3a2a,
    },
};

/** Bank height at distance d (m) from the shoreline, used for land units too. */
export function bankHeight(pal, d, y, side) {
    if (d <= 0.2) return -0.5;
    if (d < 7) return Math.min(1.5, 0.25 + d * 0.24);
    const n = hash3(Math.floor(y / 14), side, 3) * 0.6 + hash3(Math.floor(y / 5), side, 9) * 0.4;
    const top = pal.cliff[0] + (pal.cliff[1] - pal.cliff[0]) * n;
    const t = Math.min(1, (d - 7) / 9);
    return 1.5 + (top - 1.5) * (t * t * (3 - 2 * t)) + (d > 18 ? Math.sin(y * 0.07 + side) * 1.2 : 0);
}

function waterMaterial(pal) {
    const c = (h) => new THREE.Color(h);
    return new THREE.ShaderMaterial({
        uniforms: {
            t: { value: 0 },
            deep: { value: c(pal.deep) }, shallow: { value: c(pal.shallow) }, foam: { value: c(pal.foam) }, streak: { value: c(pal.streak) },
            fogColor: { value: c(pal.fog) }, fogNear: { value: 60 }, fogFar: { value: 160 },
        },
        vertexShader: /* glsl */`
            attribute float shore;
            varying float vShore;
            varying vec3 vWorld;
            varying float vDepth;
            void main() {
                vShore = shore;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vec4 mv = viewMatrix * w;
                vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform float t;
            uniform vec3 deep, shallow, foam, streak, fogColor;
            uniform float fogNear, fogFar;
            varying float vShore;
            varying vec3 vWorld;
            varying float vDepth;
            float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            void main() {
                vec2 p = vWorld.xz;
                float flow = p.y + t * 5.0;                       // water runs downriver (−Z) a little slower than the boat
                // depth bands: three flat tones from the shore to the middle
                float d = clamp(vShore / 7.0, 0.0, 1.0);
                float band = d < 0.22 ? 0.0 : (d < 0.6 ? 0.5 : 1.0);
                vec3 col = mix(shallow, deep, band);
                // big slow swirls in a slightly darker tone
                float sw = sin(p.x * 0.22 + sin(flow * 0.05) * 2.0) * sin(flow * 0.09 + p.x * 0.05);
                col = mix(col, col * 0.88, step(0.55, sw));
                // ripple streaks: long thin highlights stretched along the flow
                float r1 = sin(p.x * 1.3 + sin(flow * 0.21) * 1.5) * sin(flow * 0.42 + p.x * 0.3);
                col = mix(col, streak, step(0.93, r1) * 0.85);
                // sparkles
                vec2 q = vec2(p.x * 0.7, flow * 0.35);
                vec2 cell = floor(q);
                vec2 f = fract(q) - 0.5;
                float sp = h21(cell);
                // a small four-point glint in a few cells, blinking
                float star = step(abs(f.x) * abs(f.y * 2.0), 0.004) * step(length(f * vec2(1.0, 2.0)), 0.3);
                float tw = step(0.93, sp) * star * step(0.5, fract(t * 1.7 + sp * 7.0));
                col = mix(col, vec3(1.0), tw);
                // foam line at every shore, wobbling
                float fw = 0.75 + 0.35 * sin(flow * 0.7 + p.x * 0.9) + 0.25 * sin(flow * 1.9);
                float fo = step(vShore, fw);
                col = mix(col, foam, fo);
                // a second, broken foam line just off the shore
                float f2 = step(abs(vShore - fw - 0.9), 0.18) * step(0.0, sin(flow * 1.3 + p.x));
                col = mix(col, foam, f2 * 0.8);
                float fogF = smoothstep(fogNear, fogFar, vDepth);
                gl_FragColor = vec4(mix(col, fogColor, fogF), 1.0);
                #include <colorspace_fragment>
            }`,
    });
}

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.pal = PALETTES.sakura;
        this.water = waterMaterial(this.pal);
        this.land = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
        this.trunkMat = new THREE.MeshToonMaterial({ color: this.pal.trunk, gradientMap: toonGradient() });
        this.leafMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
        this.trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6).translate(0, 1.2, 0);
        this.leafGeo = new THREE.IcosahedronGeometry(1.8, 0);
        this.river = null;
        this.key = null;
    }

    setPalette(name) {
        this.pal = PALETTES[name] || PALETTES.sakura;
        const u = this.water.uniforms;
        for (const k of ['deep', 'shallow', 'foam', 'streak']) u[k].value.setHex(this.pal[k]);
        u.fogColor.value.setHex(this.pal.fog);
        this.trunkMat.color.setHex(this.pal.trunk);
    }

    setFog(near, far) { this.water.uniforms.fogNear.value = near; this.water.uniforms.fogFar.value = far; }

    /** Drop every chunk (a new sector, a new river). */
    reset() {
        for (const c of this.chunks.values()) this._free(c);
        this.chunks.clear();
    }

    /** Drop the chunks past y (the river ahead changed: a boss arena opened up). */
    dropFrom(y) {
        for (const [k, c] of this.chunks) if ((k + 1) * CHUNK > y) { this._free(c); this.chunks.delete(k); }
    }

    _free(c) {
        this.scene.remove(c.group);
        c.group.traverse((o) => { if (o.geometry && o.geometry !== this.trunkGeo && o.geometry !== this.leafGeo) o.geometry.dispose(); });
    }

    update(G, t) {
        this.water.uniforms.t.value = t;
        const R = G.river;
        const key = R.seed + ':' + R.sector;
        if (key !== this.key) { this.reset(); this.key = key; }
        this.river = R;
        const by = G.boat.y;
        const k0 = Math.floor((by - 40) / CHUNK), k1 = Math.floor((by + 230) / CHUNK);
        for (const [k, c] of this.chunks) if (k < k0 - 1) { this._free(c); this.chunks.delete(k); }
        // only build up to where the river is known
        let built = 0;
        for (let k = k0; k <= k1 && built < 2; k++) {
            if (this.chunks.has(k)) continue;
            if ((k + 1) * CHUNK > R.endY + 0.01 && !R.segs.some((s) => s.len === Infinity)) continue;
            this.chunks.set(k, this._build(k));
            built++;
        }
    }

    _build(k) {
        const R = this.river, pal = this.pal;
        const g = new THREE.Group();
        const y0 = k * CHUNK, rows = CHUNK / ROW + 1;
        const rs = [];
        for (let i = 0; i < rows; i++) rs.push(riverAt(R, y0 + i * ROW));

        // ---- water
        const WC = 14;
        {
            const pos = [], shore = [], idx = [];
            for (let i = 0; i < rows; i++) {
                const r = rs[i], y = y0 + i * ROW;
                for (let j = 0; j < WC; j++) {
                    const u = j / (WC - 1);
                    const x = r.cx - r.hw - 3 + u * (2 * r.hw + 6);
                    const dx = Math.abs(x - r.cx);
                    let s = r.hw - dx;
                    if (r.isl > 0) s = Math.min(s, dx - r.isl);
                    pos.push(x, 0, -y);
                    shore.push(s);
                }
            }
            for (let i = 0; i < rows - 1; i++) for (let j = 0; j < WC - 1; j++) {
                const a = i * WC + j, b = a + 1, c = a + WC, d = c + 1;
                idx.push(a, b, c, b, d, c);           // counter-clockwise seen from above (x right, rows toward −Z)
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('shore', new THREE.Float32BufferAttribute(shore, 1));
            geo.setIndex(idx);
            geo.computeBoundingSphere();
            const m = new THREE.Mesh(geo, this.water);
            g.add(m);
        }

        // ---- banks
        const DS = [0, 0.8, 2, 3.5, 5.5, 7.5, 10, 13, 17, 22, 28, 36, 46, 60];
        for (const side of [-1, 1]) {
            const pos = [], col = [], idx = [];
            const C = new THREE.Color();
            for (let i = 0; i < rows; i++) {
                const r = rs[i], y = y0 + i * ROW;
                for (let j = 0; j < DS.length; j++) {
                    const d = DS[j];
                    const x = r.cx + side * (r.hw + d - 0.6);
                    const h = bankHeight(pal, d, y, side);
                    pos.push(x, h, -y);
                    const n = hash3(Math.floor(x / 3), Math.floor(y / 3), 5);
                    if (d < 2.2) C.setHex(pal.sand);
                    else if (h > 3.2) C.setHex(n > 0.5 ? pal.rock : pal.rock2);
                    else C.setHex(n > 0.5 ? pal.grass : pal.grass2);
                    col.push(C.r, C.g, C.b);
                }
            }
            const W = DS.length;
            for (let i = 0; i < rows - 1; i++) for (let j = 0; j < W - 1; j++) {
                const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
                // the right bank's columns run toward +x, the left's toward −x: opposite windings face up
                if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            g.add(new THREE.Mesh(geo, this.land));
        }

        // ---- sandbars
        if (rs.some((r) => r.isl > 0)) {
            const OF = [-1, -0.55, 0, 0.55, 1], HT = [-0.4, 0.45, 0.85, 0.45, -0.4];
            const pos = [], col = [], idx = [];
            const C = new THREE.Color();
            for (let i = 0; i < rows; i++) {
                const r = rs[i], y = y0 + i * ROW;
                for (let j = 0; j < 5; j++) {
                    const w = Math.max(0, r.isl);
                    pos.push(r.cx + OF[j] * w, w > 0 ? HT[j] * Math.min(1, w / 3) : -0.6, -y);
                    C.setHex(j === 2 && w > 3 ? pal.grass : pal.sand);
                    col.push(C.r, C.g, C.b);
                }
            }
            for (let i = 0; i < rows - 1; i++) for (let j = 0; j < 4; j++) {
                const a = i * 5 + j, b = a + 1, c = a + 5, d = c + 1;
                idx.push(a, b, c, b, d, c);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            g.add(new THREE.Mesh(geo, this.land));
        }

        // ---- trees on both banks
        const N = 34;
        const trunks = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, N * 2);
        const leaves = new THREE.InstancedMesh(this.leafGeo, this.leafMat, N * 2);
        const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
        const C = new THREE.Color();
        let n = 0;
        for (const side of [-1, 1]) for (let i = 0; i < N; i++) {
            const y = y0 + hash3(k, i, side + 11) * CHUNK;
            const d = 4.5 + hash3(k, i, side + 21) ** 1.5 * 34;
            const r = riverAt(R, y);
            const x = r.cx + side * (r.hw + d);
            const h = bankHeight(pal, d, y, side);
            const s = 0.8 + hash3(k, i, side + 31) * 0.8;
            P.set(x, h - 0.1, -y); S.set(s, s, s); Q.identity();
            M.compose(P, Q, S);
            trunks.setMatrixAt(n, M);
            P.y += 2.6 * s;
            S.set(s * 1.1, s * 0.9, s * 1.1);
            Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash3(k, i, 41) * 6.28);
            M.compose(P, Q, S);
            leaves.setMatrixAt(n, M);
            leaves.setColorAt(n, C.setHex(pal.leaves[Math.floor(hash3(k, i, side + 51) * pal.leaves.length)]));
            n++;
        }
        trunks.count = leaves.count = n;
        trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
        if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
        trunks.frustumCulled = leaves.frustumCulled = false;
        g.add(trunks, leaves);

        // Break up the broad bank surfaces with layered boulders and exposed stone.
        const rockGeo = new THREE.IcosahedronGeometry(1, 0);
        const rocks = new THREE.InstancedMesh(rockGeo, this.land, 46);
        const rockM = new THREE.Matrix4(), rockQ = new THREE.Quaternion();
        for (let i = 0; i < 46; i++) {
            const side = i % 2 ? 1 : -1;
            const yy = y0 + hash3(k, i, 71) * CHUNK;
            const rr = riverAt(R, yy);
            const dist = 5 + hash3(k, i, 72) * 32;
            const xx = rr.cx + side * (rr.hw + dist);
            const hh = bankHeight(pal, dist, yy, side);
            const sx = 0.45 + hash3(k, i, 73) * 1.15;
            const sy = 0.35 + hash3(k, i, 74) * 0.8;
            const sz = 0.5 + hash3(k, i, 75) * 1.3;
            P.set(xx, hh + sy * 0.45, -yy);
            S.set(sx, sy, sz);
            rockQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash3(k, i, 76) * Math.PI);
            rockM.compose(P, rockQ, S);
            rocks.setMatrixAt(i, rockM);
            rocks.setColorAt(i, C.setHex(hash3(k, i, 77) > 0.5 ? pal.rock : pal.rock2));
        }
        rocks.frustumCulled = false;
        g.add(rocks);

        this.scene.add(g);
        return { group: g };
    }
}
