/**
 * terrain.js (view) — quadtree LOD terrain and its splat material.
 *
 * Nodes are 33×33-vertex grids from 3072 m down to 96 m (3 m spacing = the height grid). A node
 * splits while the camera is closer than `size × split`. Skirts hide the cracks between LODs.
 * Triangles split along the same diagonal as Terrain.heightAt(), so feet meet the drawn ground.
 */
import * as THREE from 'three';
import { WORLD } from '../sim/geography.js';
import { MASK_RES, TINT_RES } from '../sim/terrain.js';
import { patch, GLSL_NOISE, G } from './shaders.js';
import { makeTerrainTextures } from './textures.js';

const SEG = 32;
const ROOT = WORLD.SIZE;
const MAX_LEVEL = 5;   // 3072 / 2^5 = 96 m

function dataTex(data, w, h, opts = {}) {
    const t = new THREE.DataTexture(data, w, h, opts.format || THREE.RGBAFormat, opts.type || THREE.UnsignedByteType);
    t.minFilter = opts.min || THREE.LinearFilter;
    t.magFilter = opts.mag || THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = !!opts.mips;
    if (opts.mips) t.minFilter = THREE.LinearMipmapLinearFilter;
    if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
}

export function makeTerrainTextures2(terrain) {
    return {
        masks: dataTex(terrain.masks, MASK_RES, MASK_RES, { mips: true }),
        tintG: dataTex(terrain.tintGrass, TINT_RES, TINT_RES),   // linear multipliers (×2 in the shader)
        tintS: dataTex(terrain.tintSoil, TINT_RES, TINT_RES),
    };
}

export function makeTerrainMaterial(terrain, tex, q, maps) {
    const { masks, tintG, tintS } = maps;
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0xffffff });
    const U = {
        uAlb: { value: tex.albedo }, uNrm: { value: tex.normal },
        uMasks: { value: masks }, uTintG: { value: tintG }, uTintS: { value: tintS },
        uWorld: { value: WORLD.SIZE }, uHalf: { value: WORLD.HALF },
    };
    const defines = (q.triplanar ? '#define TRIPLANAR\n' : '') + (q.macro ? '#define MACRO\n' : '');
    patch(mat, (sh) => {
        Object.assign(sh.uniforms, U);
        sh.uniforms.uWet = G.uWet;
        sh.vertexShader = 'attribute float ao;\nvarying float vAO;\nvarying vec3 vTW;\nvarying vec3 vTN;\n' + sh.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvAO = ao;\nvTW = (modelMatrix * vec4(position, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * normal);');
        sh.fragmentShader = defines + /* glsl */`
            precision highp sampler2DArray;
            uniform sampler2DArray uAlb; uniform sampler2DArray uNrm;
            uniform sampler2D uMasks; uniform sampler2D uTintG; uniform sampler2D uTintS;
            uniform float uWorld; uniform float uHalf; uniform float uTime; uniform float uWet;
            varying float vAO; varying vec3 vTW; varying vec3 vTN;
            ${GLSL_NOISE}
            vec3 tNW; float tRough; float tSnow;
            vec4 L(vec2 uv, float i) { return texture(uAlb, vec3(uv, i)); }
            vec3 N(vec2 uv, float i) { vec3 n = texture(uNrm, vec3(uv, i)).xyz * 2.0 - 1.0; return vec3(n.x, 0.0, n.y); }  // world-space perturbation (top projection)
            void blendLayer(inout vec3 col, inout float h, inout vec3 nrm, inout float rough, vec4 a, vec3 n, float r, float w) {
                float m = smoothstep(0.38, 0.62, w + (a.a - h) * 0.45 * (1.0 - abs(w * 2.0 - 1.0)));
                col = mix(col, a.rgb, m); h = mix(h, a.a, m); nrm = mix(nrm, n, m); rough = mix(rough, r, m);
            }
        ` + sh.fragmentShader
            .replace('#include <map_fragment>', /* glsl */`
            {
                vec2 wuv = (vTW.xz + uHalf) / uWorld;
                vec4 M = texture2D(uMasks, wuv);
                vec3 tg = texture2D(uTintG, wuv).rgb * 2.0;
                vec3 ts = texture2D(uTintS, wuv).rgb * 2.1;
                vec3 gN = normalize(vTN);
                float slope = 1.0 - gN.y;
                float dist = length(vTW - cameraPosition);
                vec2 uv = vTW.xz / 3.6;
                float var = vnoise(vTW.xz * 0.05);
                // soil base
                vec4 a = L(uv, 1.0); vec3 col = a.rgb * ts; float h = a.a; vec3 nrm = N(uv, 1.0); float rough = 0.95;
                vec4 g = L(uv * 0.9, 0.0); g.rgb *= tg;
                blendLayer(col, h, nrm, rough, g, N(uv * 0.9, 0.0), 0.97, M.r);
                vec4 f = L(uv * 1.2, 5.0); f.rgb *= mix(vec3(1.0), ts * 0.9, 0.35);
                blendLayer(col, h, nrm, rough, f, N(uv * 1.2, 5.0), 0.98, M.a * 0.85 * (0.7 + 0.6 * var));
                float beach = 1.0 - smoothstep(1.2, 3.2, vTW.y + var * 1.5);
                vec4 s = L(uv * 1.4, 6.0);
                blendLayer(col, h, nrm, rough, s, N(uv * 1.4, 6.0), 0.9, beach);
                vec4 rd = L(uv * 0.8, 4.0); rd.rgb *= mix(vec3(1.0), ts * 0.8, 0.4);
                blendLayer(col, h, nrm, rough, rd, N(uv * 0.8, 4.0), 0.9, M.b);
                // rock on steep ground: triplanar where available
                float rockW = smoothstep(0.26, 0.46, slope + (var - 0.5) * 0.12);
                if (rockW > 0.001) {
                    vec4 rk; vec3 rn;
                    vec3 rockTint = mix(vec3(1.0), ts * 0.85, 0.3);
            #ifdef TRIPLANAR
                    vec3 bw = pow(abs(gN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
                    vec2 ux = vTW.zy / 7.0, uy = vTW.xz / 7.0, uz = vTW.xy / 7.0;
                    rk = L(ux, 2.0) * bw.x + L(uy, 2.0) * bw.y + L(uz, 2.0) * bw.z;
                    vec3 nx = N(ux, 2.0), ny = N(uy, 2.0), nz = N(uz, 2.0);   // (t.x, 0, t.y) each
                    rn = vec3(0.0, nx.z, nx.x) * bw.x + ny * bw.y + vec3(nz.x, nz.z, 0.0) * bw.z;
            #else
                    rk = L(vTW.xz / 7.0, 2.0); rn = N(vTW.xz / 7.0, 2.0);
            #endif
                    rk.rgb *= rockTint;
                    blendLayer(col, h, nrm, rough, rk, rn, 0.82, rockW);
                }
                // snow sits on the flatter ground and drifts into the hollows
                float sn = clamp(M.g * (1.0 - rockW * 0.75) + rockW * M.g * smoothstep(0.55, 0.9, gN.y + var * 0.2) * 0.6, 0.0, 1.0);
                vec4 sw = L(uv * 0.7, 3.0);
                blendLayer(col, h, nrm, rough, sw, N(uv * 0.7, 3.0), 0.55, sn);
                tSnow = sn;
            #ifdef MACRO
                float mac = vnoise(vTW.xz * 0.021) * 0.6 + vnoise(vTW.xz * 0.0063) * 0.4;
                col *= 0.84 + 0.32 * mac;
            #endif
                // rain darkens and glosses everything but snow
                float wet = uWet * (1.0 - sn);
                col *= 1.0 - wet * 0.35;
                rough = mix(rough, 0.3, wet * 0.8);
                diffuseColor.rgb = col;
                tRough = rough;
                // perturbed world normal (whiteout blend on the top projection)
                float nStr = mix(1.0, 0.35, smoothstep(30.0, 250.0, dist));
                tNW = normalize(gN + nrm * 0.9 * nStr);
            }`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
            .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNW, 0.0)).xyz);')
            .replace('#include <emissivemap_fragment>', /* glsl */`
                #include <emissivemap_fragment>
                {
                    vec3 cell = floor(vTW * 14.0);
                    float glint = step(0.996, hash13(cell)) * tSnow;
                    vec3 V = normalize(cameraPosition - vTW);
                    float flick = step(0.6, fract(hash13(cell + 3.1) * 10.0 + dot(V, vec3(13.0, 7.0, 11.0))));
                    totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * glint * flick * 1.5 * (1.0 - smoothstep(10.0, 40.0, length(cameraPosition - vTW)));
                }`)
            .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vAO; reflectedLight.indirectSpecular *= vAO; reflectedLight.directDiffuse *= mix(0.7, 1.0, vAO);');
    }, 'terrain' + defines.length);
    return mat;
}

export class TerrainView {
    constructor(scene, terrain, renderer, G) {
        this.scene = scene;
        this.terrain = terrain;
        this.renderer = renderer;
        this.group = new THREE.Group();
        this.group.name = 'terrain';
        scene.add(this.group);
        this.cache = new Map();
        this.frame = 0;
        this.split = 2.0;
        this.tex = makeTerrainTextures(256, Math.min(8, renderer.maxAniso));
        this.maps = makeTerrainTextures2(terrain);
        this.G = G;
        this.setQuality(renderer.q);
        this.visibleCount = 0;
        this.built = 0;
    }

    setQuality(q) {
        this.split = q.split;
        const old = this.material;
        this.material = makeTerrainMaterial(this.terrain, this.tex, q, this.maps);
        this.material.userData.G = this.G;
        for (const e of this.cache.values()) e.mesh.material = this.material;
        old?.dispose();
        this.castLevel = q.shadow > 0 ? 4 : 99;
    }

    nodeRange(level, ix, iz) {
        const size = ROOT / (1 << level);
        const x0 = -WORLD.HALF + ix * size, z0 = -WORLD.HALF + iz * size;
        const T = this.terrain, step = size / SEG;
        let mn = 1e9, mx = -1e9;
        for (let j = 0; j <= SEG; j += 4) for (let i = 0; i <= SEG; i += 4) {
            const h = T.heightAt(x0 + i * step, z0 + j * step);
            if (h < mn) mn = h; if (h > mx) mx = h;
        }
        return [mn - 8, mx + 8];
    }

    buildNode(level, ix, iz) {
        const T = this.terrain, N = T.N, Hh = T.h, AO = T.ao;
        const size = ROOT / (1 << level);
        const x0 = -WORLD.HALF + ix * size, z0 = -WORLD.HALF + iz * size;
        const step = size / SEG;
        const gstep = Math.round(step / WORLD.CELL);
        const gi0 = Math.round((x0 + WORLD.HALF) / WORLD.CELL), gj0 = Math.round((z0 + WORLD.HALF) / WORLD.CELL);
        const V = (SEG + 1) * (SEG + 1);
        const skirtN = 4 * (SEG + 1);
        const pos = new Float32Array((V + skirtN) * 3), nrm = new Float32Array((V + skirtN) * 3), ao = new Float32Array(V + skirtN);
        const gridAt = (gi, gj) => Hh[Math.min(N - 1, gj) * N + Math.min(N - 1, gi)];
        let mn = 1e9, mx = -1e9;
        for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) {
            const gi = Math.min(N - 1, gi0 + i * gstep), gj = Math.min(N - 1, gj0 + j * gstep);
            const k = j * (SEG + 1) + i;
            const h = Hh[gj * N + gi];
            pos[k * 3] = x0 + i * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + j * step;
            if (h < mn) mn = h; if (h > mx) mx = h;
            const dx = gridAt(Math.min(N - 1, gi + 1), gj) - gridAt(Math.max(0, gi - 1), gj);
            const dz = gridAt(gi, Math.min(N - 1, gj + 1)) - gridAt(gi, Math.max(0, gj - 1));
            const l = Math.hypot(dx, 2 * WORLD.CELL, dz);
            nrm[k * 3] = -dx / l; nrm[k * 3 + 1] = 2 * WORLD.CELL / l; nrm[k * 3 + 2] = -dz / l;
            ao[k] = AO[gj * N + gi] / 255;
        }
        // skirts: copies of the edge vertices dropped below the surface
        const drop = step * 1.5 + 2;
        const edges = [];
        for (let i = 0; i <= SEG; i++) edges.push(i);                              // north (j = 0)
        for (let i = 0; i <= SEG; i++) edges.push(SEG * (SEG + 1) + i);            // south
        for (let j = 0; j <= SEG; j++) edges.push(j * (SEG + 1));                  // west
        for (let j = 0; j <= SEG; j++) edges.push(j * (SEG + 1) + SEG);            // east
        edges.forEach((src, e) => {
            const k = V + e;
            pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - drop; pos[k * 3 + 2] = pos[src * 3 + 2];
            nrm[k * 3] = nrm[src * 3]; nrm[k * 3 + 1] = nrm[src * 3 + 1]; nrm[k * 3 + 2] = nrm[src * 3 + 2];
            ao[k] = ao[src] * 0.8;
        });
        const idx = new Uint16Array(SEG * SEG * 6 + 4 * SEG * 6);
        let p = 0;
        for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
            const a = j * (SEG + 1) + i, b = a + 1, d = a + SEG + 1, c = d + 1;
            idx[p++] = a; idx[p++] = c; idx[p++] = b;
            idx[p++] = a; idx[p++] = d; idx[p++] = c;
        }
        // skirt quads (double-sided via both windings would cost; orient outward per edge)
        const sk = (e0, rowEdges, flip) => {
            for (let s = 0; s < SEG; s++) {
                const t0 = rowEdges[s], t1 = rowEdges[s + 1];
                const b0 = V + e0 + s, b1 = V + e0 + s + 1;
                if (!flip) { idx[p++] = t0; idx[p++] = t1; idx[p++] = b0; idx[p++] = t1; idx[p++] = b1; idx[p++] = b0; }
                else { idx[p++] = t0; idx[p++] = b0; idx[p++] = t1; idx[p++] = t1; idx[p++] = b0; idx[p++] = b1; }
            }
        };
        const S1 = SEG + 1;
        sk(0, edges.slice(0, S1), false);
        sk(S1, edges.slice(S1, 2 * S1), true);
        sk(2 * S1, edges.slice(2 * S1, 3 * S1), true);
        sk(3 * S1, edges.slice(3 * S1, 4 * S1), false);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        geo.setAttribute('ao', new THREE.BufferAttribute(ao, 1));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.boundingBox = new THREE.Box3(new THREE.Vector3(x0, mn - drop, z0), new THREE.Vector3(x0 + size, mx, z0 + size));
        geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = level >= this.castLevel;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.built++;
        return { mesh, range: [mn, mx], last: 0 };
    }

    /** Select and show the nodes for this camera position. */
    update(cam) {
        this.frame++;
        const cx = cam.x, cy = cam.y, cz = cam.z;
        const want = [];
        const visit = (level, ix, iz) => {
            const size = ROOT / (1 << level);
            const x0 = -WORLD.HALF + ix * size, z0 = -WORLD.HALF + iz * size;
            const key = level * 1e6 + iz * 1000 + ix;
            let e = this.cache.get(key);
            let range = e ? e.range : (this._ranges || (this._ranges = new Map())).get(key);
            if (!range) { range = this.nodeRange(level, ix, iz); this._ranges.set(key, range); }
            const dx = Math.max(x0 - cx, 0, cx - (x0 + size));
            const dz = Math.max(z0 - cz, 0, cz - (z0 + size));
            const dy = Math.max(range[0] - cy, 0, cy - range[1]);
            const d = Math.hypot(dx, dy * 0.6, dz);
            if (level < MAX_LEVEL && d < size * this.split) {
                visit(level + 1, ix * 2, iz * 2); visit(level + 1, ix * 2 + 1, iz * 2);
                visit(level + 1, ix * 2, iz * 2 + 1); visit(level + 1, ix * 2 + 1, iz * 2 + 1);
            } else want.push(key);
        };
        visit(0, 0, 0);
        for (const e of this.cache.values()) e.mesh.visible = false;
        for (const key of want) {
            let e = this.cache.get(key);
            if (!e) {
                const level = Math.floor(key / 1e6), rem = key - level * 1e6, iz = Math.floor(rem / 1000), ix = rem - iz * 1000;
                e = this.buildNode(level, ix, iz);
                this.cache.set(key, e);
                this.group.add(e.mesh);
            }
            e.mesh.visible = true;
            e.last = this.frame;
        }
        this.visibleCount = want.length;
        // evict long-unused nodes
        if (this.cache.size > 700) {
            const old = [...this.cache.entries()].filter(([, e]) => this.frame - e.last > 300).sort((a, b) => a[1].last - b[1].last);
            for (const [k, e] of old.slice(0, this.cache.size - 600)) {
                this.group.remove(e.mesh);
                e.mesh.geometry.dispose();
                this.cache.delete(k);
            }
        }
    }
}
