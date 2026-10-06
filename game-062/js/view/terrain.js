// The ground of a hole, drawn from the simulation's own grids:
//  - a mesh sampled from course.H (in the Sky Citadel, void cells become cliff skirts under the islands)
//  - two RGBA mask textures (one channel per surface, blurred) that a patched toon material turns into
//    mown fairway stripes, chequered greens, rippled sand, cracked ice, swirling quicksand… with ink lines
//    where surfaces meet
//  - water and lava sheets masked by the same grid, with foam, ripples and a glowing crust
//  - instanced grass tufts and flowers that sway in the wind

import * as THREE from 'three';
import { SURF } from '../sim/realms.js';
import { VOID_H } from '../sim/course.js';
import { gradientMap, TOON } from './toon.js';

const CH_A = [SURF.fairway, SURF.green, SURF.sand, SURF.ice];      // + tee → fairway
const CH_B = [SURF.snow, SURF.quick, SURF.stone, SURF.cloud];     // + dune/ash are the realm rough

export const TERRAIN_U = { uWind: { value: new THREE.Vector2(0, 0) } };

function maskTextures(c) {
    const { nx, nz, S } = c;
    const a = new Float32Array(nx * nz * 4), b = new Float32Array(nx * nz * 4), w = new Float32Array(nx * nz);
    for (let k = 0; k < nx * nz; k++) {
        const s = S[k];
        const sa = s === SURF.tee ? SURF.fairway : s;
        for (let ch = 0; ch < 4; ch++) { if (sa === CH_A[ch]) a[k * 4 + ch] = 1; if (s === CH_B[ch]) b[k * 4 + ch] = 1; }
        if (s === SURF.water || s === SURF.lava) w[k] = 1;
    }
    const blur = (src, comps) => {
        const out = new Uint8Array(nx * nz * 4);
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            for (let ch = 0; ch < comps; ch++) {
                let sum = 0, n = 0;
                for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                    const ii = Math.min(nx - 1, Math.max(0, i + di)), jj = Math.min(nz - 1, Math.max(0, j + dj));
                    const wt = di || dj ? 1 : 2;
                    sum += src[(jj * nx + ii) * comps + ch] * wt; n += wt;
                }
                out[(j * nx + i) * 4 + ch] = Math.round((sum / n) * 255);
            }
            if (comps === 1) { out[(j * nx + i) * 4 + 3] = 255; }
        }
        const t = new THREE.DataTexture(out, nx, nz, THREE.RGBAFormat);
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        return t;
    };
    return { A: blur(a, 4), B: blur(b, 4), W: blur(w, 1) };
}

const NOISE_GLSL = `
float th21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(th21(i), th21(i + vec2(1, 0)), f.x), mix(th21(i + vec2(0, 1)), th21(i + vec2(1, 1)), f.x), f.y); }
float tfbm(vec2 p) { return tn2(p) * 0.55 + tn2(p * 2.1) * 0.3 + tn2(p * 4.3) * 0.15; }
vec2 tvor(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y); vec2 o = vec2(th21(i + g), th21(i + g + 17.3));
        float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return vec2(d1, d2); }
`;

function terrainMaterial(c, P, masks) {
    const u = {
        uMaskA: { value: masks.A }, uMaskB: { value: masks.B },
        uRough0: { value: new THREE.Color(P.rough[0]) }, uRough1: { value: new THREE.Color(P.rough[1]) }, uOob: { value: new THREE.Color(P.oob) },
        uFair0: { value: new THREE.Color(P.fairway[0]) }, uFair1: { value: new THREE.Color(P.fairway[1]) },
        uGreen0: { value: new THREE.Color(P.green[0]) }, uGreen1: { value: new THREE.Color(P.green[1]) },
        uSand: { value: new THREE.Color(P.sand) }, uIce: { value: new THREE.Color(P.ice) }, uSnow: { value: new THREE.Color(P.snow) },
        uQuick: { value: new THREE.Color(P.quick) }, uStone: { value: new THREE.Color(P.stone) }, uCloud: { value: new THREE.Color(P.cloud) }, uCliff: { value: new THREE.Color(P.cliff) },
        uStripe: { value: new THREE.Vector2(Math.cos(c.teeYaw), -Math.sin(c.teeYaw)) },
        uRoughW: { value: c.sky ? 1.5 : (c.hole.roughW ?? 16) }, uSky: { value: c.sky ? 1 : 0 },
        uTime: TOON.uTime,
    };
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientMap(3) });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 aMask;\nattribute float aD;\nattribute float aSkirt;\nvarying vec2 vMask;\nvarying vec3 vW;\nvarying float vD;\nvarying float vSkirt;\nvarying float vUp;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask; vD = aD; vSkirt = aSkirt; vW = (modelMatrix * vec4(position, 1.0)).xyz; vUp = normal.y;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform sampler2D uMaskA, uMaskB;
uniform vec3 uRough0, uRough1, uOob, uFair0, uFair1, uGreen0, uGreen1, uSand, uIce, uSnow, uQuick, uStone, uCloud, uCliff;
uniform vec2 uStripe; uniform float uRoughW, uSky, uTime;
varying vec2 vMask; varying vec3 vW; varying float vD; varying float vSkirt; varying float vUp;
${NOISE_GLSL}
float edgeW(float m) { float fw = max(fwidth(m), 0.02); return smoothstep(0.5 - fw, 0.5 + fw, m); }
float inkL(float m) { float fw = max(fwidth(m), 0.015); return 1.0 - smoothstep(0.0, fw * 1.6, abs(m - 0.5)); }
`)
            .replace('#include <color_fragment>', `#include <color_fragment>
{
    vec2 p = vW.xz;
    vec4 A = texture2D(uMaskA, vMask);
    vec4 B = texture2D(uMaskB, vMask);
    float n = tfbm(p * 0.09);
    float n2 = tn2(p * 0.7);
    vec3 col = mix(uRough0, uRough1, smoothstep(0.35, 0.65, n));
    col *= 0.93 + 0.1 * n2;
    if (uSky < 0.5) col = mix(col, uOob, smoothstep(uRoughW * 0.85, uRoughW * 1.2, vD));
    float ink = 0.0;
    // fairway: mown stripes across the line of play
    float st = step(0.5, fract(dot(p, uStripe) / 7.0));
    vec3 fair = mix(uFair0, uFair1, st) * (0.97 + 0.05 * n2);
    float wf = edgeW(A.r); col = mix(col, fair, wf); ink = max(ink, inkL(A.r));
    // green: fine chequer
    float ch = mod(floor(p.x / 2.2) + floor(p.y / 2.2), 2.0);
    vec3 grn = mix(uGreen0, uGreen1, ch);
    float wg = edgeW(A.g); col = mix(col, mix(fair, uGreen0 * 1.06, 0.6), smoothstep(0.08, 0.5, A.g) * (1.0 - wg) * 0.6); col = mix(col, grn, wg); ink = max(ink, inkL(A.g) * 0.7);
    // sand: wind ripples and speckle
    float rip = sin(dot(p, vec2(0.8, 0.5)) * 2.2 + n * 9.0) * 0.5 + 0.5;
    vec3 snd = uSand * (0.93 + 0.06 * rip) * (0.96 + 0.08 * step(0.93, th21(floor(p * 6.0))));
    float ws = edgeW(A.b); col = mix(col, snd, ws); ink = max(ink, inkL(A.b));
    // ice: pale with cracks and glints
    vec2 vr = tvor(p * 0.35);
    vec3 ice = uIce * (0.95 + 0.08 * n) * (1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06, vr.y - vr.x)));
    ice += vec3(0.6) * step(0.995, th21(floor(p * 3.0) + floor(uTime * 2.0)));
    float wi = edgeW(A.a); col = mix(col, ice, wi); ink = max(ink, inkL(A.a) * 0.6);
    // snowdrift
    vec3 snow = uSnow * (0.94 + 0.06 * n2);
    float wsn = edgeW(B.r); col = mix(col, snow, wsn); ink = max(ink, inkL(B.r) * 0.5);
    // quicksand: a slow swirl
    float sw = sin(length(fract(p * 0.12) - 0.5) * 30.0 - uTime * 1.5 + n * 6.0) * 0.5 + 0.5;
    vec3 qk = uQuick * (0.85 + 0.2 * sw);
    float wq = edgeW(B.g); col = mix(col, qk, wq); ink = max(ink, inkL(B.g));
    // stone: blocks
    vec2 bl = fract(vec2(p.x / 3.0 + floor(p.y / 1.6) * 0.5, p.y / 1.6));
    float joint = step(0.06, bl.x) * step(0.08, bl.y);
    vec3 stn = uStone * (0.8 + 0.2 * joint) * (0.95 + 0.08 * th21(floor(vec2(p.x / 3.0 + floor(p.y / 1.6) * 0.5, p.y / 1.6))));
    float wst = edgeW(B.b); col = mix(col, stn, wst); ink = max(ink, inkL(B.b) * 0.7);
    // cloud: soft puffs
    vec3 cld = uCloud * (0.9 + 0.1 * smoothstep(0.3, 0.7, tfbm(p * 0.3 + uTime * 0.05)));
    float wc = edgeW(B.a); col = mix(col, cld, wc); ink = max(ink, inkL(B.a) * 0.5);
    // cliffs: steep slopes and the skirts under floating islands
    float cliff = max(smoothstep(0.72, 0.55, vUp), vSkirt);
    vec3 rock = uCliff * (0.8 + 0.25 * sin(vW.y * 2.4 + n * 4.0)) * (0.9 + 0.1 * n2);
    col = mix(col, rock, cliff);
    col *= 1.0 - ink * 0.42;
    diffuseColor.rgb = col;
}`);
    };
    m.customProgramCacheKey = () => 'terrain';
    return m;
}

export function buildTerrain(c, P, quality = 2) {
    const step = quality >= 2 ? 2 : 3;   // grid cells per vertex
    const vx = Math.floor((c.nx - 1) / step) + 1, vz = Math.floor((c.nz - 1) / step) + 1;
    const N = vx * vz;
    const pos = new Float32Array(N * 3), mask = new Float32Array(N * 2), dAttr = new Float32Array(N), skirt = new Float32Array(N);
    const keep = new Uint8Array(N);
    const hv = new Float32Array(N);
    // heights (void → island skirts by BFS down from the land edge)
    const depth = new Int16Array(N).fill(-1);
    const queue = [];
    for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
        const k = j * vx + i, gi = Math.min(c.nx - 1, i * step), gj = Math.min(c.nz - 1, j * step);
        const h = c.H[gj * c.nx + gi];
        if (h > VOID_H + 1) { hv[k] = h; depth[k] = 0; queue.push(k); }
    }
    if (c.sky) {
        let head = 0;
        while (head < queue.length) {
            const k = queue[head++];
            const d = depth[k];
            if (d >= 7) continue;
            const i = k % vx, j = (k / vx) | 0;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = i + di, b = j + dj;
                if (a < 0 || b < 0 || a >= vx || b >= vz) continue;
                const kk = b * vx + a;
                if (depth[kk] >= 0) continue;
                depth[kk] = d + 1;
                hv[kk] = hv[k] - (d === 0 ? 1.2 : 2.2 + d * 0.5);
                queue.push(kk);
            }
        }
    }
    for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
        const k = j * vx + i, gi = Math.min(c.nx - 1, i * step), gj = Math.min(c.nz - 1, j * step);
        const x = c.x0 + gi * c.cell, z = c.z0 + gj * c.cell;
        keep[k] = depth[k] >= 0 ? 1 : 0;
        pos[k * 3] = x; pos[k * 3 + 1] = keep[k] ? hv[k] : -40; pos[k * 3 + 2] = z;
        mask[k * 2] = (gi + 0.5) / c.nx; mask[k * 2 + 1] = (gj + 0.5) / c.nz;
        dAttr[k] = c.D[gj * c.nx + gi];
        skirt[k] = depth[k] > 0 ? 1 : 0;
    }
    const idx = [];
    for (let j = 0; j < vz - 1; j++) for (let i = 0; i < vx - 1; i++) {
        const a = j * vx + i, b = a + 1, d = a + vx, e = d + 1;
        if (!(keep[a] && keep[b] && keep[d] && keep[e])) continue;
        idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 2));
    geo.setAttribute('aD', new THREE.BufferAttribute(dAttr, 1));
    geo.setAttribute('aSkirt', new THREE.BufferAttribute(skirt, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const masks = maskTextures(c);
    const mesh = new THREE.Mesh(geo, terrainMaterial(c, P, masks));
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    const group = new THREE.Group();
    group.add(mesh);
    if (c.sky) group.add(islandUndersides(c, P));
    else group.add(outerGround(c, P));
    for (const w of waterSheets(c, P, masks.W)) group.add(w);
    return { group, mesh, masks, dispose: () => { geo.dispose(); masks.A.dispose(); masks.B.dispose(); masks.W.dispose(); } };
}

// Land holes: the world carries on past the course grid — a coarse ring of ground from the same base
// height function (with the full rough mound), so there is no edge to the world from any camera.
function outerGround(c, P) {
    const W = (c.nx - 1) * c.cell, H = (c.nz - 1) * c.cell;
    const pad = 420, st = 6;
    const x0 = c.x0 - pad, z0 = c.z0 - pad, nx = Math.ceil((W + pad * 2) / st) + 1, nz = Math.ceil((H + pad * 2) / st) + 1;
    const mound = c.hole.mound ?? 2.2;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const a = new THREE.Color(P.oob);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = x0 + i * st, z = z0 + j * st, k = j * nx + i;
        // just under the course grid where they overlap, so the detailed terrain wins
        const inside = x > c.x0 + 2 && x < c.x0 + W - 2 && z > c.z0 + 2 && z < c.z0 + H - 2;
        pos[k * 3] = x; pos[k * 3 + 1] = c.base(x, z) + mound - (inside ? 3 : 0.15); pos[k * 3 + 2] = z;
        const t = 0.97 + Math.sin(x * 0.05) * Math.cos(z * 0.043) * 0.05;
        col[k * 3] = a.r * t; col[k * 3 + 1] = a.g * t; col[k * 3 + 2] = a.b * t;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const p = j * nx + i; idx.push(p, p + nx, p + 1, p + 1, p + nx, p + nx + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3) }));
    m.receiveShadow = true;
    m.name = 'outer';
    return m;
}

// Rocky cones under each floating island.
function islandUndersides(c, P) {
    const geos = [];
    const mat = new THREE.MeshToonMaterial({ color: P.cliff, gradientMap: gradientMap(3) });
    const g = new THREE.Group();
    for (const L of c.layers) {
        if (L.shape !== 'ellipse' || L.sid === SURF.green || L.teePad) continue;
        const r = Math.max(L.rx, L.rz);
        const y = c.heightAt(L.x, L.z);
        if (y < VOID_H + 1) continue;
        const cone = new THREE.ConeGeometry(1, 1, 9, 3);
        const pa = cone.attributes.position;
        for (let i = 0; i < pa.count; i++) { const yy = pa.getY(i); const k = 1 + Math.sin(i * 12.9) * 0.12 * (yy < 0.45 ? 1 : 0); pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); }
        cone.computeVertexNormals();
        const m = new THREE.Mesh(cone, mat);
        m.scale.set(L.rx * 0.95, r * 1.5, L.rz * 0.95);
        m.rotation.x = Math.PI;
        m.position.set(L.x, y - 7 - r * 0.75, L.z);
        m.rotation.y = L.rot || 0;
        g.add(m);
        geos.push(m);
    }
    return g;
}

function waterSheets(c, P, maskW) {
    const out = [];
    const seen = new Set();
    for (const L of c.layers) {
        if (L.sid !== SURF.water && L.sid !== SURF.lava) continue;
        const key = L.level.toFixed(2) + L.sid;
        // one sheet per distinct level; size it to every layer at that level
        if (seen.has(key)) continue;
        seen.add(key);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const M of c.layers) {
            if ((M.sid !== SURF.water && M.sid !== SURF.lava) || M.level.toFixed(2) + M.sid !== key) continue;
            const b = M.shape === 'path' ? M.pts.reduce((a, p) => [Math.min(a[0], p[0] - p[2]), Math.min(a[1], p[1] - p[2]), Math.max(a[2], p[0] + p[2]), Math.max(a[3], p[1] + p[2])], [Infinity, Infinity, -Infinity, -Infinity])
                : [M.x - Math.max(M.rx, M.rz) - 2, M.z - Math.max(M.rx, M.rz) - 2, M.x + Math.max(M.rx, M.rz) + 2, M.z + Math.max(M.rx, M.rz) + 2];
            x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]);
        }
        const lava = L.sid === SURF.lava;
        const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2);
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, fog: true,
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
                uMask: { value: maskW }, uX0: { value: c.x0 }, uZ0: { value: c.z0 }, uW: { value: (c.nx - 1) * c.cell + c.cell }, uH: { value: (c.nz - 1) * c.cell + c.cell },
                uShallow: { value: new THREE.Color(P.water) }, uDeep: { value: new THREE.Color(P.waterDeep) }, uFoam: { value: new THREE.Color(P.foam) },
                uLava: { value: lava ? 1 : 0 }, uTime: { value: 0 },
            }]),
            vertexShader: `
#include <fog_pars_vertex>
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
            fragmentShader: `
#include <fog_pars_fragment>
uniform sampler2D uMask; uniform float uX0, uZ0, uW, uH, uLava, uTime; uniform vec3 uShallow, uDeep, uFoam;
varying vec3 vW;
${NOISE_GLSL}
void main() {
    vec2 uv = vec2((vW.x - uX0 + 0.25) / uW, (vW.z - uZ0 + 0.25) / uH);
    float m = texture2D(uMask, uv).r;
    if (m < 0.3) discard;
    float a = smoothstep(0.3, 0.45, m);
    vec2 p = vW.xz;
    vec3 col;
    if (uLava > 0.5) {
        vec2 vr = tvor(p * 0.22 + vec2(uTime * 0.05, uTime * 0.03));
        float crust = smoothstep(0.02, 0.12, vr.y - vr.x);
        float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + tfbm(p * 0.2) * 8.0);
        col = mix(uFoam * 1.6 * pulse, uDeep * 0.35, crust * 0.8);
        col = mix(col, uShallow * 1.4, (1.0 - crust) * 0.5);
        col += uFoam * smoothstep(0.62, 0.42, m) * 0.9;
    } else {
        float depth = smoothstep(0.45, 1.0, m);
        col = mix(uShallow, uDeep, depth * 0.85);
        float rip = tfbm(p * 0.25 + vec2(uTime * 0.08, uTime * 0.05));
        float band = smoothstep(0.55, 0.6, rip) - smoothstep(0.6, 0.66, rip);
        col += vec3(0.9) * band * 0.35;
        float glint = step(0.985, th21(floor(p * 2.0) + floor(uTime * 1.5)));
        col += glint * 0.6;
        float foamBand = smoothstep(0.62, 0.45, m) * (0.7 + 0.3 * sin(uTime * 2.0 + m * 30.0 + p.x * 0.3));
        col = mix(col, uFoam, foamBand);
    }
    gl_FragColor = vec4(col, a * (uLava > 0.5 ? 1.0 : 0.92));
    #include <fog_fragment>
}`,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((x0 + x1) / 2, L.level, (z0 + z1) / 2);
        mesh.renderOrder = 1;
        mesh.userData.water = true;
        out.push(mesh);
    }
    return out;
}

// ---------------------------------------------------------------- grass and flowers
const grassVS = `
uniform float uTime; uniform vec2 uWind;
attribute vec3 aCol;
varying vec3 vCol; varying float vY;
#include <fog_pars_vertex>
void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float sway = sin(uTime * 2.2 + w.x * 0.35 + w.z * 0.27) * 0.18 + uWind.x * 0.05;
    w.x += sway * position.y; w.z += (cos(uTime * 1.7 + w.x * 0.3) * 0.12 + uWind.y * 0.05) * position.y;
    vCol = aCol; vY = position.y;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;
const grassFS = `
varying vec3 vCol; varying float vY;
#include <fog_pars_fragment>
void main() { gl_FragColor = vec4(vCol * (0.62 + vY * 0.75), 1.0);
#include <fog_fragment>
}`;

export function buildGrass(c, P, quality = 2, seed = 1) {
    const group = new THREE.Group();
    const roughSid = c.roughSid;
    const grassy = P.key === 'meadow' || P.key === 'sky' ? 1 : P.key === 'cinder' ? 0.35 : P.key === 'sand' ? 0.25 : 0.12;
    const max = [3000, 7000, 13000][Math.min(2, quality)] * grassy;
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const spots = [];
    const flowers = [];
    const roughW = c.sky ? 2 : (c.hole.roughW ?? 16) + 8;
    for (let tries = 0; tries < max * 4 && spots.length < max; tries++) {
        const x = c.x0 + rnd() * (c.nx - 1) * c.cell, z = c.z0 + rnd() * (c.nz - 1) * c.cell;
        const sid = c.surfAt(x, z);
        if (sid !== roughSid && sid !== SURF.oob && sid !== SURF.rough) continue;
        const d = c.dAt(x, z);
        if (d > roughW || d < 0.6) continue;
        const y = c.heightAt(x, z);
        spots.push([x, y, z, 0.7 + rnd() * 0.7, rnd() * Math.PI]);
        if (P.flowers.length && rnd() < 0.05) flowers.push([x + 0.3, y, z + 0.2, P.flowers[Math.floor(rnd() * P.flowers.length)]]);
    }
    if (spots.length) {
        // three crossed blades per tuft
        const bg = new THREE.BufferGeometry();
        const v = [], cols = [];
        const c0 = new THREE.Color(P.grass[0]), c1 = new THREE.Color(P.grass[1]);
        for (let b = 0; b < 3; b++) {
            const a = (b / 3) * Math.PI;
            const dx = Math.cos(a) * 0.12, dz = Math.sin(a) * 0.12, lean = (b - 1) * 0.08;
            v.push(-dx, 0, -dz, dx, 0, dz, lean, 0.55 + b * 0.06, 0);
            cols.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
        }
        bg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        bg.setAttribute('aCol', new THREE.Float32BufferAttribute(cols, 3));
        const mat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() } }]),
            vertexShader: grassVS, fragmentShader: grassFS, side: THREE.DoubleSide, fog: true,
        });
        mat.uniforms.uTime = TOON.uTime;
        mat.uniforms.uWind = TERRAIN_U.uWind;
        const im = new THREE.InstancedMesh(bg, mat, spots.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        spots.forEach(([x, y, z, sc, r], i) => { e.set(0, r, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(i, m4); });
        im.frustumCulled = false;
        group.add(im);
    }
    if (flowers.length) {
        const fg = new THREE.SphereGeometry(0.16, 6, 4);
        const fm = new THREE.MeshToonMaterial({ gradientMap: gradientMap(2) });
        const im = new THREE.InstancedMesh(fg, fm, flowers.length);
        const m4 = new THREE.Matrix4();
        flowers.forEach(([x, y, z, col], i) => { m4.makeTranslation(x, y + 0.35, z); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(col)); });
        group.add(im);
    }
    return group;
}
