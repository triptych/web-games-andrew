// The island: a signed-distance coastline grown around the paths, a baked
// height field (paths and plazas flattened into it, granite cliffs at the
// shore), the terrain mesh and fast height/shore queries for everything else.

import * as THREE from 'three';
import { fbm2, ridged2, smoothstep, clamp, lerp } from './util.js';
import { PLAZA_R, PATH_HALF, PAVILION_PLAZA } from './layout.js';
import { terrainDetail } from './textures.js';

const smin = (a, b, k) => {
    const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
    return lerp(b, a, h) - k * h * (1 - h);
};

function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
    return { d: Math.hypot(px - ax - dx * t, pz - az - dz * t), t };
}

/** Low-frequency ground level that paths follow. */
export const lowGround = (x, z) => 3.6 + 1.5 * fbm2(x * 0.011 + 3.1, z * 0.011 - 7.3, 2);
export const HUB_Y = lowGround(0, 0) + 0.3;

/** Uniform-grid index of line segments for nearest-path queries. */
class SegmentGrid {
    constructor(cell) {
        this.cell = cell;
        this.map = new Map();
    }
    key(i, j) {
        return i * 73856 + j;
    }
    add(seg, reach) {
        const c = this.cell;
        const i0 = Math.floor((Math.min(seg.ax, seg.bx) - reach) / c), i1 = Math.floor((Math.max(seg.ax, seg.bx) + reach) / c);
        const j0 = Math.floor((Math.min(seg.az, seg.bz) - reach) / c), j1 = Math.floor((Math.max(seg.az, seg.bz) + reach) / c);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const k = this.key(i, j);
            if (!this.map.has(k)) this.map.set(k, []);
            this.map.get(k).push(seg);
        }
    }
    near(x, z) {
        return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || [];
    }
}

export class Island {
    constructor(layout, resolution = 0.8) {
        this.layout = layout;
        this._prepare();
        this.half = layout.islandR + 34;
        this.n = Math.min(360, Math.ceil((this.half * 2) / resolution) + 1);
        this.step = (this.half * 2) / (this.n - 1);
        this._bake();
    }

    _prepare() {
        const L = this.layout;
        // give every path point a target height
        for (const sp of L.spokes) {
            for (const p of sp.pts) p.y = lerp(HUB_Y, lowGround(p.x, p.z) + 0.25, smoothstep(0, 18, p.s));
            const end = sp.pts[sp.pts.length - 1];
            sp.pavilion.y = end.y;
            for (const st of sp.statues) st.y = samplePathY(sp.pts, st.s);
            sp.gate.y = samplePathY(sp.pts, sp.gate.s);
        }
        const dl = L.dock.pts[L.dock.pts.length - 1].s;
        for (const p of L.dock.pts) p.y = lerp(HUB_Y, L.dock.y - 0.12, smoothstep(0, dl - 3, p.s));

        // coarse capsules for the coastline
        this.capsules = [];
        for (const sp of L.spokes) {
            const step = 8;
            for (let i = 0; i + step < sp.pts.length; i += step) {
                const a = sp.pts[i], b = sp.pts[Math.min(i + step, sp.pts.length - 1)];
                this.capsules.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ra: 13, rb: 13 });
            }
            this.capsules.push({ ax: sp.pavilion.x, az: sp.pavilion.z, bx: sp.pavilion.x, bz: sp.pavilion.z, ra: PAVILION_PLAZA + 8, rb: 0 });
        }
        for (const f of L.features) {
            const r = f.type === 'lighthouse' ? 9 : f.type === 'grove' ? 11 : 13;
            this.capsules.push({ ax: f.x, az: f.z, bx: f.x, bz: f.z, ra: r, rb: 0 });
        }

        // fine segments for flattening, carrying their heights
        this.paths = new SegmentGrid(12);
        const addLine = (pts, stride) => {
            for (let i = 0; i < pts.length - 1; i += stride) {
                const a = pts[i], b = pts[Math.min(i + stride, pts.length - 1)];
                this.paths.add({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ay: a.y, by: b.y }, 14);
            }
        };
        for (const sp of L.spokes) addLine(sp.pts, 3);
        addLine(L.dock.pts, 3);

        this.plazas = [{ x: 0, z: 0, r: PLAZA_R + 0.5, y: HUB_Y, fall: 9 }];
        for (const sp of L.spokes) this.plazas.push({ x: sp.pavilion.x, z: sp.pavilion.z, r: PAVILION_PLAZA + 0.3, y: sp.pavilion.y, fall: 7 });
        this.mounds = L.features
            .filter((f) => ['gear', 'tower', 'stones', 'tree', 'lighthouse'].includes(f.type))
            .map((f) => ({ x: f.x, z: f.z, h: f.type === 'lighthouse' ? 2.5 : f.type === 'tree' ? 1.2 : 3, r: 9 }));
        for (const f of L.features) {
            if (f.type === 'fountain') this.plazas.push({ x: f.x, z: f.z, r: 6.5, y: lowGround(f.x, f.z) + 0.3, fall: 6 });
        }

        // the clock-tower islet: out past the shore on the dock side
        const a = (Math.PI / L.slots) * 0.75;
        let r = L.hubR;
        while (this.coast(Math.sin(a) * r, Math.cos(a) * r) < 22 && r < 400) r += 2;
        L.islet = { x: Math.sin(a) * r, z: Math.cos(a) * r, r: 7 };
    }

    /** Coastline distance without the islet (negative on land). */
    coast(x, z) {
        const L = this.layout;
        let d = Math.hypot(x, z) - L.hubR;
        for (const c of this.capsules) {
            const { d: sd, t } = segDist(x, z, c.ax, c.az, c.bx, c.bz);
            d = smin(d, sd - lerp(c.ra, c.rb || c.ra, t), 9);
        }
        // keep the dock cove clean, wobble everything else
        const dockQuiet = 1 - smoothstep(14, 4, Math.abs(x)) * smoothstep(L.hubR - 20, L.hubR - 8, z);
        d += (fbm2(x * 0.028, z * 0.028, 3) * 6 + fbm2(x * 0.09, z * 0.09, 2) * 1.6) * (0.35 + 0.65 * dockQuiet);
        return d;
    }

    sdfAt(x, z) {
        const L = this.layout;
        let d = this.coast(x, z);
        if (L.islet) d = Math.min(d, Math.hypot(x - L.islet.x, z - L.islet.z) - L.islet.r + fbm2(x * 0.2, z * 0.2) * 1.2);
        return d;
    }

    /** Nearest path flatten target: { w, y, d }. */
    flatten(x, z) {
        let best = { w: 0, y: 0, d: 99 };
        for (const s of this.paths.near(x, z)) {
            const { d, t } = segDist(x, z, s.ax, s.az, s.bx, s.bz);
            if (d < best.d) best = { d, y: lerp(s.ay, s.by, t), w: 0 };
        }
        best.w = 1 - smoothstep(PATH_HALF + 5.4, PATH_HALF + 12, best.d);
        for (const p of this.plazas) {
            const d = Math.hypot(x - p.x, z - p.z) - p.r;
            const w = 1 - smoothstep(0, p.fall, d);
            if (w > best.w || (w > 0.999 && d < best.d)) best = { w, y: p.y, d: Math.min(best.d, Math.max(d, 0)) };
        }
        return best;
    }

    _height(x, z, sdf) {
        const low = lowGround(x, z);
        const hills = Math.pow(fbm2(x * 0.03 + 11, z * 0.03 - 4, 4) * 0.5 + 0.5, 1.6) * 6.5 + ridged2(x * 0.05, z * 0.05, 3) * 1.4;
        let land = low + hills;
        for (const m of this.mounds) land += m.h * Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (m.r * m.r));
        const f = this.flatten(x, z);
        land = lerp(land, f.y, f.w);
        // granite cliffs drop into the sea
        const rough = ridged2(x * 0.12, z * 0.12, 3);
        const cliff = smoothstep(-7, 0.6, sdf + rough * 2.2);
        const sea = -1.6 - Math.max(sdf, 0) * 0.32 - rough * 1.2;
        let h = lerp(land, Math.max(sea, -15), Math.pow(cliff, 1.4));
        if (sdf > -1 && sdf < 6) h -= rough * 0.6; // tumbled rock at the waterline
        return { h, flat: f.w, pathD: f.d, rough };
    }

    _bake() {
        const { n, half, step } = this;
        this.height = new Float32Array(n * n);
        this.sdf = new Float32Array(n * n);
        this.flat = new Float32Array(n * n);
        this.pathD = new Float32Array(n * n);
        this.rough = new Float32Array(n * n);
        for (let j = 0; j < n; j++) {
            const z = -half + j * step;
            for (let i = 0; i < n; i++) {
                const x = -half + i * step;
                const k = j * n + i;
                const d = this.sdfAt(x, z);
                this.sdf[k] = d;
                if (d > 30) {
                    this.height[k] = -15;
                    this.pathD[k] = 99;
                    continue;
                }
                const r = this._height(x, z, d);
                this.height[k] = r.h;
                this.flat[k] = r.flat;
                this.pathD[k] = r.pathD;
                this.rough[k] = r.rough;
            }
        }
        // edge of the grid goes deep so it hides under the water
        for (let i = 0; i < n; i++) {
            for (const k of [i, (n - 1) * n + i, i * n, i * n + n - 1]) this.height[k] = -15;
        }
    }

    _sample(arr, x, z) {
        const { n, half, step } = this;
        const fx = clamp((x + half) / step, 0, n - 1.001), fz = clamp((z + half) / step, 0, n - 1.001);
        const i = Math.floor(fx), j = Math.floor(fz);
        const u = fx - i, v = fz - j;
        const k = j * n + i;
        return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + n], arr[k + n + 1], u), v);
    }

    heightAt(x, z) {
        return this._sample(this.height, x, z);
    }
    shoreAt(x, z) {
        return this._sample(this.sdf, x, z);
    }
    flatAt(x, z) {
        return this._sample(this.flat, x, z);
    }
    pathDistAt(x, z) {
        return this._sample(this.pathD, x, z);
    }
    normalAt(x, z, out = new THREE.Vector3()) {
        const e = 0.6;
        return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
    }

    /** Terrain mesh with baked colours and a triplanar detail shader. */
    buildMesh() {
        const { n, half, step } = this;
        const pos = new Float32Array(n * n * 3);
        const col = new Float32Array(n * n * 3);
        const rock = new Float32Array(n * n);
        const c = new THREE.Color();
        const grassA = new THREE.Color('#4c7a2a'), grassB = new THREE.Color('#87a03c'), grassC = new THREE.Color('#2f5e2a');
        const soil = new THREE.Color('#7a6446'), sand = new THREE.Color('#cdb88d'), wetSand = new THREE.Color('#8f7e5d');
        const granite = new THREE.Color('#8a7f78'), graniteDark = new THREE.Color('#5d5652'), seabed = new THREE.Color('#5d6b55');
        const nrm = new THREE.Vector3();
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const k = j * n + i;
                const x = -half + i * step, z = -half + j * step, h = this.height[k];
                pos.set([x, h, z], k * 3);
                this.normalAt(x, z, nrm);
                const slope = 1 - nrm.y;
                const g1 = fbm2(x * 0.05, z * 0.05, 3) * 0.5 + 0.5, g2 = fbm2(x * 0.18 + 5, z * 0.18, 2) * 0.5 + 0.5;
                c.copy(grassA).lerp(grassB, g1 * 0.8).lerp(grassC, g2 * 0.35);
                // worn soil along path edges
                const pd = this.pathD[k];
                c.lerp(soil, (1 - smoothstep(PATH_HALF, PATH_HALF + 1.2, pd)) * 0.55);
                const sd = this.sdf[k];
                const beach = smoothstep(-4, -0.5, sd) * (1 - smoothstep(1.4, 2.6, h));
                c.lerp(sand, beach);
                if (h < 0.4) c.lerp(wetSand, smoothstep(0.4, -0.4, h));
                if (h < -1.5) c.lerp(seabed, smoothstep(-1.5, -5, h));
                let r = smoothstep(0.32, 0.6, slope) + smoothstep(-6, -1, sd) * smoothstep(0.15, 0.35, slope) + this.rough[k] * 0.3 * smoothstep(-10, -2, sd);
                r = clamp(r * (1 - this.flat[k] * 0.9), 0, 1);
                c.lerp(granite, r).lerp(graniteDark, r * g2 * 0.5);
                rock[k] = r;
                col.set([c.r, c.g, c.b], k * 3);
            }
        }
        const idx = new Uint32Array((n - 1) * (n - 1) * 6);
        let t = 0;
        for (let j = 0; j < n - 1; j++) {
            for (let i = 0; i < n - 1; i++) {
                const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
                // skip quads deep under the sea
                if (this.height[a] < -14 && this.height[d] < -14 && this.height[b] < -14 && this.height[cc] < -14) continue;
                idx.set([a, cc, b, b, cc, d], t);
                t += 6;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
        geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();

        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
        const detail = terrainDetail();
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uDetail = { value: detail };
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying float vRock;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvWPos = (modelMatrix * vec4(position,1.0)).xyz;\nvWNrm = normal;');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying float vRock;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
                .replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
                    vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));
                    bw /= (bw.x + bw.y + bw.z);
                    vec2 g0 = texture2D(uDetail, vWPos.xz * 0.21).rg;
                    vec2 g1 = texture2D(uDetail, vWPos.xz * 0.037).rg;
                    float rockT = texture2D(uDetail, vWPos.zy * 0.12).g * bw.x + texture2D(uDetail, vWPos.xz * 0.12).g * bw.y + texture2D(uDetail, vWPos.xy * 0.12).g * bw.z;
                    float grassT = g0.r * mix(0.85, 1.15, g1.r);
                    float d = mix(grassT, rockT * 1.05, vRock);
                    diffuseColor.rgb *= d * 1.05;
                    // strata in the cliffs
                    diffuseColor.rgb *= 1.0 - vRock * 0.18 * smoothstep(0.6, 1.0, sin(vWPos.y * 3.1 + rockT * 4.0));`
                );
        };
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.name = 'terrain';
        return mesh;
    }

    /**
     * Data texture for the water shader: R = water depth (0..12 m),
     * G = shore proximity, B = path-free land mask (unused by water, handy for debug).
     */
    buildWaterData() {
        const { n } = this;
        const data = new Uint8Array(n * n * 4);
        for (let k = 0; k < n * n; k++) {
            const depth = clamp(-this.height[k] / 12, 0, 1);
            const shore = 1 - smoothstep(-2, 26, this.sdf[k]);
            data[k * 4] = depth * 255;
            data[k * 4 + 1] = shore * 255;
            data[k * 4 + 2] = 0;
            data[k * 4 + 3] = 255;
        }
        const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }
}

/** Path height at arc length s (path points carry y once the island is built). */
export function samplePathY(pts, s) {
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].s <= s) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const t = b.s > a.s ? clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
    return lerp(a.y, b.y, t);
}
