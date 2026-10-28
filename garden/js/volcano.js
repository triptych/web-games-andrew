// Cinderpeak seen from outside: the mountain itself (a coarse cone with a finely
// meshed cove at its foot), the glow of its lava, the smoke that stands over it
// by day and the lava plumes it throws up by night, and the sea's shallows
// around it. Everything reads the garden's sky, so the mountain turns blue in
// the haze at noon, red at dusk and burns by night, and fog or rain swallow it.
//
// The cove (the dais you arrive on, the mine station and the mouth of the
// mine) is built in volcano-cove.js; this file is the mountain.

import * as THREE from 'three';
import { VC, SUMMIT, RIM_R, COAST_R, DAIS, PAD, volcanoHeight, coneHeight, volcanoShore } from './volcano-data.js';
import { GLSL_NOISE } from './sky.js';
import { terrainDetail, granite, glowSprite, softGlow, canvas } from './textures.js';
import { fbm2, smoothstep, clamp, rng, TAU } from './util.js';

/** The patch around the cove that gets a fine mesh. */
export const NEAR = { x0: -76, x1: 76, z0: DAIS.z - 50, z1: DAIS.z + 88, step: 1.5 };
const LAVA_MAP = { ox: -660, oz: VC.z - 660, size: 1320 };
const CRATER_FLOOR = SUMMIT - 74;

// ---------------------------------------------------------------- lava rivers

/** Runs of lava from the rim down the gullies, as polylines (world x, z). */
function lavaRivers() {
    const r = rng('cinderpeak-lava');
    const rivers = [];
    const start = [0.45, 1.05, 1.7, 2.35, -2.5, -1.9, -1.2, -0.55, 2.95, -2.95];
    for (const th0 of start) {
        let th = th0 + r.range(-0.1, 0.1);
        const rim = RIM_R * 1.1;
        let x = VC.x + Math.sin(th) * rim, z = VC.z + Math.cos(th) * rim;
        const pts = [{ x, z, w: 9 }];
        let vx = Math.sin(th), vz = Math.cos(th);
        for (let i = 0; i < 160; i++) {
            const e = 4;
            const gx = (coneHeight(x + e, z) - coneHeight(x - e, z)) / (2 * e);
            const gz = (coneHeight(x, z + e) - coneHeight(x, z - e)) / (2 * e);
            const gl = Math.hypot(gx, gz) || 1;
            // follow the gully downhill, with some momentum and wander
            vx = vx * 0.78 - (gx / gl) * 0.22 + r.range(-0.06, 0.06);
            vz = vz * 0.78 - (gz / gl) * 0.22 + r.range(-0.06, 0.06);
            const vl = Math.hypot(vx, vz) || 1;
            x += (vx / vl) * 6;
            z += (vz / vl) * 6;
            const h = coneHeight(x, z);
            if (h < 6 || Math.hypot(x - VC.x, z - VC.z) > COAST_R - 6) break;
            // keep them out of the cove
            if (Math.abs(x - DAIS.x) < 62 && z < DAIS.z + 110 && z > DAIS.z - 60) break;
            pts.push({ x, z, w: 9 + i * 0.08 });
            if (i > 26 && i < 90 && r() < 0.025 && rivers.length < 24) {
                // a tributary splits off
                const side = r() < 0.5 ? 1 : -1;
                const pts2 = [{ x, z, w: 6 }];
                let bx = x, bz = z, bvx = -vz * side * 0.7 + vx * 0.5, bvz = vx * side * 0.7 + vz * 0.5;
                for (let k = 0; k < 40; k++) {
                    const gx2 = (coneHeight(bx + e, bz) - coneHeight(bx - e, bz)) / (2 * e);
                    const gz2 = (coneHeight(bx, bz + e) - coneHeight(bx, bz - e)) / (2 * e);
                    const gl2 = Math.hypot(gx2, gz2) || 1;
                    bvx = bvx * 0.8 - (gx2 / gl2) * 0.2 + r.range(-0.05, 0.05);
                    bvz = bvz * 0.8 - (gz2 / gl2) * 0.2 + r.range(-0.05, 0.05);
                    const bl = Math.hypot(bvx, bvz) || 1;
                    bx += (bvx / bl) * 6;
                    bz += (bvz / bl) * 6;
                    if (coneHeight(bx, bz) < 8 || (Math.abs(bx - DAIS.x) < 62 && bz < DAIS.z + 110 && bz > DAIS.z - 60)) break;
                    pts2.push({ x: bx, z: bz, w: 6 - k * 0.1 });
                }
                if (pts2.length > 6) rivers.push(pts2);
            }
        }
        if (pts.length > 10) rivers.push(pts);
    }
    return rivers;
}

/** The lava as a map the terrain shader reads: R = molten, G = glow around it. */
function lavaTexture(size) {
    const c = canvas(size);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    const k = size / LAVA_MAP.size;
    const to = (p) => [(p.x - LAVA_MAP.ox) * k, (p.z - LAVA_MAP.oz) * k];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = 'lighter';
    const rivers = lavaRivers();
    for (const pass of [0, 1]) {
        for (const pts of rivers) {
            for (let i = 1; i < pts.length; i++) {
                const a = to(pts[i - 1]), b = to(pts[i]);
                const fade = 1 - smoothstep(0.55, 1, i / pts.length) * 0.75;
                g.beginPath();
                g.moveTo(a[0], a[1]);
                g.lineTo(b[0], b[1]);
                if (pass === 0) {
                    g.strokeStyle = `rgba(0,255,0,${0.22 * fade})`;
                    g.lineWidth = pts[i].w * 4.2 * k;
                } else {
                    g.strokeStyle = `rgba(255,0,0,${fade})`;
                    g.lineWidth = Math.max(1.2, pts[i].w * 0.62 * k * fade);
                }
                g.stroke();
            }
        }
    }
    // the crater is a lake of lava, with cracks running out over the rim
    const [cx, cy] = to(VC);
    const r = rng('cinderpeak-cracks');
    g.fillStyle = 'rgba(255,0,0,1)';
    g.beginPath();
    g.arc(cx, cy, RIM_R * 0.75 * k, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(0,255,0,0.5)';
    g.beginPath();
    g.arc(cx, cy, RIM_R * 1.6 * k, 0, TAU);
    g.fill();
    for (let i = 0; i < 90; i++) {
        let a = r() * TAU, d = RIM_R * r.range(0.7, 1.0);
        g.beginPath();
        g.moveTo(cx + Math.sin(a) * d * k, cy + Math.cos(a) * d * k);
        for (let s = 0; s < 6; s++) {
            a += r.range(-0.2, 0.2);
            d += r.range(5, 16);
            g.lineTo(cx + Math.sin(a) * d * k, cy + Math.cos(a) * d * k);
        }
        g.strokeStyle = 'rgba(255,0,0,0.85)';
        g.lineWidth = Math.max(1, r.range(1.2, 3) * k);
        g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return t;
}

// ---------------------------------------------------------------- terrain

function rockColor(x, z, h, slope, out) {
    const n1 = fbm2(x * 0.03 + 4, z * 0.03 - 9, 3) * 0.5 + 0.5;
    const n2 = fbm2(x * 0.11, z * 0.11, 2) * 0.5 + 0.5;
    // dark basalt, with ash and red scoria on the upper slopes
    out.setRGB(0.05, 0.042, 0.038);
    const ash = smoothstep(40, 150, h) * smoothstep(0.2, 0.8, n1);
    out.lerp(_c.setRGB(0.15, 0.135, 0.125), ash * 0.75);
    const scoria = smoothstep(0.5, 0.82, fbm2(x * 0.05 - 3, z * 0.05 + 5, 3) * 0.5 + 0.5) * smoothstep(10, 90, h);
    out.lerp(_c.setRGB(0.2, 0.075, 0.045), scoria * 0.8);
    // sulphur stains near the rim
    const sulph = smoothstep(SUMMIT - 70, SUMMIT - 10, h) * smoothstep(0.52, 0.72, n2);
    out.lerp(_c.setRGB(0.4, 0.31, 0.05), sulph * 0.7);
    // scrub on the low gentle slopes
    const scrub = (1 - smoothstep(35, 75, h)) * (1 - smoothstep(0.22, 0.5, slope)) * smoothstep(0.35, 0.65, n1) * smoothstep(5, 9, h);
    out.lerp(_c.setRGB(0.05, 0.1, 0.04), scrub * 0.85);
    // black sand
    const sand = (1 - smoothstep(1.6, 4.5, h)) * (1 - smoothstep(0.35, 0.6, slope));
    out.lerp(_c.setRGB(0.028, 0.026, 0.03), sand);
    if (h < 0.5) out.multiplyScalar(0.6 + 0.4 * smoothstep(-1, 0.5, h));
    out.multiplyScalar(0.75 + n2 * 0.5);
    return out;
}
const _c = new THREE.Color();

function buildFar(segs, step) {
    const radii = [];
    for (let r = 0; r < 80; r += 3 * step) radii.push(r);
    for (let r = 80; r < 480; r += 5 * step) radii.push(r);
    for (let r = 480; r <= 680; r += 10 * step) radii.push(r);
    const nR = radii.length;
    const pos = new Float32Array(nR * segs * 3), col = new Float32Array(nR * segs * 3);
    const h = new Float32Array(nR * segs);
    for (let i = 0; i < nR; i++) {
        for (let j = 0; j < segs; j++) {
            const a = (j / segs) * TAU, r = radii[i];
            const x = VC.x + Math.sin(a) * r, z = VC.z + Math.cos(a) * r;
            const y = volcanoHeight(x, z);
            const k = i * segs + j;
            pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
            h[k] = y;
        }
    }
    const idx = [];
    for (let i = 0; i < nR - 1; i++) {
        for (let j = 0; j < segs; j++) {
            const j1 = (j + 1) % segs;
            const a = i * segs + j, b = i * segs + j1, c = (i + 1) * segs + j, d = (i + 1) * segs + j1;
            // the near mesh covers this part
            const cx = (pos[a * 3] + pos[d * 3]) / 2, cz = (pos[a * 3 + 2] + pos[d * 3 + 2]) / 2;
            if (cx > NEAR.x0 + 2 && cx < NEAR.x1 - 2 && cz > NEAR.z0 + 2 && cz < NEAR.z1 - 2) continue;
            // far under the sea nobody looks
            if (h[a] < -14 && h[b] < -14 && h[c] < -14 && h[d] < -14) continue;
            idx.push(a, c, b, b, c, d);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const n = geo.attributes.normal;
    const c = new THREE.Color();
    for (let k = 0; k < nR * segs; k++) {
        const slope = 1 - n.getY(k);
        rockColor(pos[k * 3], pos[k * 3 + 2], pos[k * 3 + 1], slope, c);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
}

function buildNear() {
    const { x0, x1, z0, z1, step } = NEAR;
    const nx = Math.ceil((x1 - x0) / step) + 1, nz = Math.ceil((z1 - z0) / step) + 1;
    const pos = new Float32Array((nx * nz + 2 * (nx + nz)) * 3);
    const idx = [];
    for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
            const x = x0 + i * step, z = z0 + j * step;
            const k = j * nx + i;
            pos[k * 3] = x; pos[k * 3 + 1] = volcanoHeight(x, z); pos[k * 3 + 2] = z;
        }
    }
    for (let j = 0; j < nz - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
            const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }
    // a skirt around the edge hides the seam with the coarse mesh
    let next = nx * nz;
    const skirt = (ids) => {
        const base = next;
        for (const k of ids) {
            pos[next * 3] = pos[k * 3]; pos[next * 3 + 1] = pos[k * 3 + 1] - 4; pos[next * 3 + 2] = pos[k * 3 + 2];
            next++;
        }
        for (let q = 0; q < ids.length - 1; q++) idx.push(ids[q], base + q, ids[q + 1], ids[q + 1], base + q, base + q + 1);
    };
    const row = (j) => Array.from({ length: nx }, (_, i) => j * nx + i);
    const colm = (i) => Array.from({ length: nz }, (_, j) => j * nx + i);
    skirt(row(0).reverse()); skirt(row(nz - 1)); skirt(colm(0)); skirt(colm(nx - 1).reverse());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, next * 3), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const n = geo.attributes.normal;
    const col = new Float32Array(next * 3);
    const c = new THREE.Color();
    for (let k = 0; k < next; k++) {
        const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
        rockColor(x, z, y, 1 - n.getY(k), c);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
}

// ---------------------------------------------------------------- shared shader pieces

/** Haze toward the horizon colour, thicker with distance and near sea level. */
const HAZE_FRAG = /* glsl */ `
uniform vec3 uHazeColor;
uniform float uHazeD0, uHazeTop, uHazeY, uHazeScale;
vec3 hazeMix(vec3 col, vec3 wp){
  float dist = length(wp - cameraPosition) * uHazeScale;
  float hz = 1.0 - exp(-pow(dist / uHazeD0, 1.6));
  float low = exp(-max(wp.y, 0.0) * uHazeY);
  float f = clamp(hz * mix(uHazeTop, 1.0, low), 0.0, 1.0);
  return mix(col, uHazeColor, f);
}`;

export function makeHazeUniforms() {
    return {
        uHazeColor: { value: new THREE.Color(0xa8cbeb) },
        uHazeD0: { value: 900 }, uHazeTop: { value: 0.22 }, uHazeY: { value: 0.022 }, uHazeScale: { value: 1 },
    };
}

function terrainMaterial(U, lavaMap) {
    const detail = terrainDetail();
    const g = granite();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, fog: false });
    mat.userData.cut = { min: new THREE.Vector3(1e9, 1e9, 1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9) };
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U, {
            uDetail: { value: detail }, uRockN: { value: g.normalMap }, uLavaMap: { value: lavaMap },
            uCutMin: { value: mat.userData.cut.min }, uCutMax: { value: mat.userData.cut.max },
            uLavaBox: { value: new THREE.Vector4(LAVA_MAP.ox, LAVA_MAP.oz, LAVA_MAP.size, 0) },
        });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position,1.0)).xyz;\nvWNrm = normal;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                varying vec3 vWPos; varying vec3 vWNrm;
                uniform sampler2D uDetail, uRockN, uLavaMap;
                uniform vec3 uCutMin, uCutMax;
                uniform vec4 uLavaBox;
                uniform float uTime, uGlow;
                ${GLSL_NOISE}
                ${HAZE_FRAG}`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                if (all(greaterThan(vWPos, uCutMin)) && all(lessThan(vWPos, uCutMax))) discard;`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));
                bw /= (bw.x + bw.y + bw.z);
                float rockT = texture2D(uDetail, vWPos.zy * 0.11).g * bw.x + texture2D(uDetail, vWPos.xz * 0.11).g * bw.y + texture2D(uDetail, vWPos.xy * 0.11).g * bw.z;
                float rockF = texture2D(uDetail, vWPos.zy * 0.47).g * bw.x + texture2D(uDetail, vWPos.xz * 0.47).g * bw.y + texture2D(uDetail, vWPos.xy * 0.47).g * bw.z;
                diffuseColor.rgb *= (0.3 + rockT * 1.25) * (0.6 + rockF * 0.8);
                diffuseColor.rgb *= 1.0 - 0.1 * smoothstep(0.6, 1.0, sin(vWPos.y * 0.85 + rockT * 6.0 + fbm(vWPos.xz * 0.05) * 5.0));
                // rain-streaked cliffs: pale runs down the faces
                diffuseColor.rgb *= 1.0 + 0.35 * (1.0 - abs(normalize(vWNrm).y)) * smoothstep(0.55, 0.9, vnoise(vec2(vWPos.x * 0.8 + vWPos.z * 0.8, vWPos.y * 0.07)));`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                {
                    vec3 nT = texture2D(uRockN, vWPos.zy * 0.18).xyz * bw.x + texture2D(uRockN, vWPos.xz * 0.18).xyz * bw.y + texture2D(uRockN, vWPos.xy * 0.18).xyz * bw.z;
                    nT = nT * 2.0 - 1.0;
                    vec3 nW = normalize(normalize(vWNrm) + vec3(nT.x, 0.0, nT.y) * 0.55 * smoothstep(260.0, 40.0, length(vWPos - cameraPosition)));
                    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
                }`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                {
                    vec2 lm = (vWPos.xz - uLavaBox.xy) / uLavaBox.z;
                    vec2 L = texture2D(uLavaMap, lm).rg;
                    float pat = vnoise(vWPos.xz * 0.32 + vec2(0.0, uTime * 0.5)) * 0.55 + vnoise(vWPos.xz * 0.95 - vec2(uTime * 0.35, 0.0)) * 0.45;
                    float core = smoothstep(0.3, 0.85, L.r * (0.45 + pat * 1.0));
                    vec3 lc = mix(vec3(0.85, 0.1, 0.01), vec3(1.0, 0.72, 0.22), pat * pat);
                    totalEmissiveRadiance += lc * core * uGlow * 2.6 + vec3(1.0, 0.22, 0.04) * L.g * uGlow * 0.22 * (0.7 + pat);
                }`)
            .replace('#include <fog_fragment>', `gl_FragColor.rgb = hazeMix(gl_FragColor.rgb, vWPos);`);
    };
    return mat;
}

// ---------------------------------------------------------------- billboards

function cloudSprite() {
    const n = 256;
    const c = canvas(n);
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    const r = rng('cinderpeak-puff');
    // a few overlapping lobes with a noisy edge
    const lobes = Array.from({ length: 9 }, () => ({ x: r.range(-0.28, 0.28), y: r.range(-0.28, 0.28), s: r.range(0.22, 0.4) }));
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const u = x / n - 0.5, v = y / n - 0.5;
            let d = 0;
            for (const l of lobes) d = Math.max(d, 1 - Math.hypot(u - l.x, v - l.y) / l.s);
            const nz = fbm2(u * 9 + 3, v * 9 - 2, 4) * 0.5 + 0.5;
            const a = clamp((d * 1.35 + (nz - 0.5) * 0.9), 0, 1);
            const f = a * a * (3 - 2 * a) * (1 - smoothstep(0.38, 0.5, Math.hypot(u, v)));
            const k = (y * n + x) * 4;
            const shade = 0.55 + nz * 0.5;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.min(255, shade * 255);
            img.data[k + 3] = f * 255;
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function instancedQuad(count, attrs) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    geo.instanceCount = count;
    for (const [name, [arr, size]] of Object.entries(attrs)) geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(VC.x, SUMMIT, VC.z), 1e5);
    return geo;
}

class Smoke {
    constructor(U, count) {
        const r = rng('cinderpeak-smoke');
        const seed = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) seed.set([i / count + r() * 0.002, r(), r(), r()], i * 4);
        this.U = {
            ...U, uTime: { value: 0 }, uMap: { value: cloudSprite() },
            uLife: { value: 62 }, uHeight: { value: 380 }, uBase: { value: new THREE.Vector3(VC.x, SUMMIT - 6, VC.z) },
            uWind: { value: new THREE.Vector3(150, 0, 90) }, uErupt: { value: 0 }, uGlow: { value: 0 },
            uSunColor: { value: new THREE.Color(1, 1, 1) }, uAmbient: { value: new THREE.Color(0.5, 0.5, 0.5) },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 0.8 },
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.U, transparent: true, depthWrite: false, fog: false,
            vertexShader: /* glsl */ `
                attribute vec4 aSeed;
                varying vec2 vUv; varying vec4 vS; varying vec3 vWPos; varying float vAge;
                uniform float uTime, uLife, uHeight, uErupt;
                uniform vec3 uBase, uWind;
                void main(){
                    float age = fract(uTime / uLife + aSeed.x);
                    float h = pow(age, 0.8) * uHeight * (1.0 + uErupt * 0.3 * smoothstep(0.0, 0.5, age));
                    vec3 c = uBase + vec3(0.0, h, 0.0);
                    float ang = aSeed.y * 6.2832;
                    c.xz += vec2(cos(ang), sin(ang)) * (6.0 + 85.0 * age * age) * aSeed.w + uWind.xz * age * age;
                    float size = (46.0 + age * 250.0) * (0.75 + 0.55 * aSeed.z) * (1.0 + uErupt * 0.5 * smoothstep(0.0, 0.4, age));
                    float rot = aSeed.y * 31.4 + age * (aSeed.z - 0.5) * 1.2;
                    vec2 q = vec2(cos(rot) * position.x - sin(rot) * position.y, sin(rot) * position.x + cos(rot) * position.y);
                    vec4 mv = viewMatrix * vec4(c, 1.0);
                    mv.xy += q * size;
                    vUv = uv; vS = aSeed; vAge = age; vWPos = c;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap;
                uniform vec3 uSunColor, uAmbient, uSunDir;
                uniform float uGlow, uErupt, uOpacity;
                varying vec2 vUv; varying vec4 vS; varying vec3 vWPos; varying float vAge;
                ${HAZE_FRAG}
                void main(){
                    vec2 uv = vUv;
                    if (vS.y > 0.5) uv.x = 1.0 - uv.x;
                    vec4 t = texture2D(uMap, uv);
                    float a = t.a * smoothstep(0.0, 0.07, vAge) * pow(1.0 - vAge, 1.25) * uOpacity;
                    if (a < 0.004) discard;
                    // grey ash, lit from the sun side and from the lava underneath
                    float top = vUv.y;
                    float sunUp = smoothstep(-0.05, 0.3, uSunDir.y);
                    vec3 col = uAmbient * (0.6 + 0.4 * t.r) + uSunColor * sunUp * (0.25 + 0.55 * top) * t.r;
                    col *= mix(1.0, 0.55, smoothstep(0.0, 0.5, vAge) * 0.6);
                    float under = exp(-vAge * 4.2) * (0.55 + 0.45 * (1.0 - top));
                    col += vec3(1.0, 0.33, 0.07) * (uGlow * under * 1.15 + uErupt * exp(-vAge * 2.2) * 1.4) * (0.6 + t.r * 0.8);
                    col = hazeMix(col, vWPos);
                    gl_FragColor = vec4(col, a);
                }`,
        });
        this.mesh = new THREE.Mesh(instancedQuad(count, { aSeed: [seed, 4] }), mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 4;
    }
}

/** Lava thrown from the crater: stretched, glowing streaks on ballistic arcs. */
class Plumes {
    constructor(U, count = 520) {
        this.count = count;
        this.cursor = 0;
        this.time = 0;
        const p0 = new Float32Array(count * 4), v = new Float32Array(count * 4), prm = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) prm[i * 4 + 1] = -1e4;
        this.attr = { p0, v, prm };
        this.U = { ...U, uTime: { value: 0 }, uGravity: { value: 9.0 }, uMap: { value: glowSprite() } };
        const geo = instancedQuad(count, { aP0: [p0, 4], aV: [v, 4], aPrm: [prm, 4] });
        this.geo = geo;
        const mat = new THREE.ShaderMaterial({
            uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
            vertexShader: /* glsl */ `
                attribute vec4 aP0, aV, aPrm;   // p0 + size, velocity, (birth, life, heat, -)
                varying vec2 vUv; varying float vHeat; varying float vA; varying vec3 vWPos;
                uniform float uTime, uGravity;
                void main(){
                    float age = uTime - aPrm.x;
                    float k = age / aPrm.y;
                    vA = 0.0;
                    vec3 p = aP0.xyz + aV.xyz * age + vec3(0.0, -0.5 * uGravity * age * age, 0.0);
                    vec3 vel = aV.xyz + vec3(0.0, -uGravity * age, 0.0);
                    if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
                    vHeat = (1.0 - k);
                    vA = smoothstep(0.0, 0.03, k) * (1.0 - smoothstep(0.7, 1.0, k));
                    vec4 mv = viewMatrix * vec4(p, 1.0);
                    vec3 vv = mat3(viewMatrix) * vel;
                    vec2 d = vv.xy; float dl = length(d);
                    d = dl > 0.01 ? d / dl : vec2(0.0, 1.0);
                    vec2 pd = vec2(d.y, -d.x);
                    float size = aP0.w * (0.6 + 0.5 * vHeat);
                    float streak = clamp(length(vel) * 0.045, 1.0, 5.0);
                    mv.xy += pd * position.x * size + d * position.y * size * streak;
                    vUv = uv; vWPos = p;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap;
                varying vec2 vUv; varying float vHeat; varying float vA; varying vec3 vWPos;
                void main(){
                    if (vA < 0.01) discard;
                    vec2 q = vUv * 2.0 - 1.0;
                    float g = exp(-(q.x * q.x * 4.5 + pow(abs(q.y), 1.7) * 2.4));
                    vec3 hot = mix(vec3(1.0, 0.12, 0.02), vec3(1.0, 0.8, 0.35), smoothstep(0.35, 1.0, vHeat));
                    gl_FragColor = vec4(hot * g * vA * (1.2 + vHeat * 2.4), 1.0);
                }`,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 6;
    }

    /** One eruption: a fountain of streaks, mostly up, some thrown wide. */
    erupt(strength, r) {
        const n = Math.floor(70 + 120 * strength);
        for (let i = 0; i < n; i++) {
            const k = this.cursor;
            this.cursor = (this.cursor + 1) % this.count;
            const a = r() * TAU, rad = Math.sqrt(r()) * RIM_R * 0.45;
            const up = 38 + r() * 54 * (0.6 + 0.6 * strength);
            const out = (r() < 0.25 ? 26 : 9) * r() * (0.6 + strength * 0.5);
            const ox = a + r.range(-0.6, 0.6);
            const { p0, v, prm } = this.attr;
            p0.set([VC.x + Math.sin(a) * rad, CRATER_FLOOR + 6, VC.z + Math.cos(a) * rad, 5 + r() * 9], k * 4);
            v.set([Math.sin(ox) * out, up, Math.cos(ox) * out, 0], k * 4);
            prm.set([this.time + r() * 1.2, 6 + r() * 7, 1, 0], k * 4);
        }
        for (const name of ['aP0', 'aV', 'aPrm']) this.geo.attributes[name].needsUpdate = true;
    }

    update(t) {
        this.time = t;
        this.U.uTime.value = t;
    }
}

// ---------------------------------------------------------------- the mountain

export class Mountain {
    /**
     * @param {object} env { scene, sky, quality }
     */
    constructor(env) {
        this.sky = env.sky;
        const q = env.quality;
        this.U = {
            ...makeHazeUniforms(),
            uTime: { value: 0 }, uGlow: { value: 0.3 },
        };
        this.lavaMap = lavaTexture(q.tier === 'low' ? 512 : 1024);
        this.mat = terrainMaterial(this.U, this.lavaMap);
        const hi = q.tier === 'high', mid = q.tier === 'medium';
        const far = new THREE.Mesh(buildFar(hi ? 384 : mid ? 288 : 208, 1), this.mat);
        far.name = 'cinderpeak';
        const near = new THREE.Mesh(buildNear(), this.mat);
        near.castShadow = true;
        near.receiveShadow = true;
        far.receiveShadow = false;
        near.name = 'cinderpeak-cove';
        this.group = new THREE.Group();
        this.group.add(far, near);
        this.near = near;
        this.far = far;

        this.smoke = new Smoke(this.U, hi ? 110 : mid ? 80 : 56);
        this.plumes = new Plumes(this.U, hi ? 700 : 450);
        this.group.add(this.smoke.mesh, this.plumes.mesh);

        // the glow over the crater, a big soft additive sprite
        const gm = new THREE.SpriteMaterial({ map: softGlow(), color: 0xff5a14, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
        this.halo = new THREE.Sprite(gm);
        this.halo.position.set(VC.x, SUMMIT + 18, VC.z);
        this.halo.scale.set(330, 220, 1);
        this.halo.renderOrder = 5;
        this.group.add(this.halo);
        const gm2 = gm.clone();
        gm2.color.set(0xffc060);
        this.core = new THREE.Sprite(gm2);
        this.core.position.set(VC.x, SUMMIT - 10, VC.z);
        this.core.scale.set(110, 70, 1);
        this.core.renderOrder = 5;
        this.group.add(this.core);

        this.rand = rng('cinderpeak-erupt');
        this.nextErupt = 6;
        this.erupt = 0;           // 0..1, how strongly the plume is lit right now
        this.eruptAge = 99;
        this.onErupt = null;      // (distanceDelaySeconds, strength) for the sound
        this.forceNight = false;
        this._c = new THREE.Color();
    }

    /** A hole through the cliff for the mouth of the mine (world box). */
    setCut(min, max) {
        this.mat.userData.cut.min.copy(min);
        this.mat.userData.cut.max.copy(max);
    }

    /** Sea data for the water shader: R depth, G shore, covering the volcano's waters. */
    waterData(res = 512) {
        const half = 720;
        const data = new Uint8Array(res * res * 4);
        for (let j = 0; j < res; j++) {
            for (let i = 0; i < res; i++) {
                const x = VC.x - half + ((i + 0.5) / res) * half * 2, z = VC.z - half + ((j + 0.5) / res) * half * 2;
                const h = volcanoHeight(x, z);
                const sdf = volcanoShore(x, z);
                const k = (j * res + i) * 4;
                data[k] = clamp(-h / 12, 0, 1) * 255;
                data[k + 1] = (1 - smoothstep(-2, 26, sdf)) * 255;
                data[k + 3] = 255;
            }
        }
        const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return { tex, cx: VC.x, cz: VC.z, half };
    }

    /**
     * @param {number} dt
     * @param {number} t world time
     * @param {THREE.Vector3} camPos
     */
    update(dt, t, camPos) {
        const s = this.sky.state, wx = this.sky.wx;
        const U = this.U;
        const night = s.night;
        U.uTime.value = t;
        // haze: the sky's horizon colour; fog and rain thicken it
        U.uHazeColor.value.copy(s.horizon);
        U.uHazeScale.value = 1 + wx.density * 190 + wx.overcast * 0.35;
        // the glow: steady by night, a smoulder by day, with a slow breath
        const breath = 0.88 + 0.12 * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1);
        const glow = (0.14 + 0.86 * night) * breath;
        U.uGlow.value = glow + this.erupt * 0.8;
        const sm = this.smoke.U;
        sm.uTime.value = t;
        sm.uGlow.value = glow;
        sm.uErupt.value = this.erupt;
        sm.uSunColor.value.copy(s.sunColor).multiplyScalar(smoothstep(-0.1, 0.25, s.sunElev) * (1 - 0.6 * wx.overcast));
        sm.uSunDir.value.copy(s.sunDir);
        // ambient: the sky's colour, dim at night
        sm.uAmbient.value.copy(s.horizon).lerp(s.zenith, 0.4).multiplyScalar(0.55 * (0.2 + 0.8 * s.day) + 0.05);
        // the plume leans with the weather
        sm.uWind.value.set(150 + wx.density * 4000, 0, 90);
        this.halo.material.opacity = (0.1 + 0.9 * night) * (0.55 + 0.45 * breath) * (0.5 + this.erupt);
        this.core.material.opacity = (0.15 + 0.85 * night) * (0.6 + 0.4 * breath);
        this.plumes.update(t);

        // eruptions: after dark, every so often, and a flash of light on the smoke
        this.eruptAge += dt;
        this.erupt = Math.exp(-this.eruptAge * 0.32) * (this.eruptAge < 18 ? 1 : 0);
        if ((night > 0.3 || this.forceNight) && (this.nextErupt -= dt) <= 0) {
            this.nextErupt = 12 + this.rand() * 26;
            this.fire(0.5 + this.rand() * 0.5, camPos);
        }
        if (night <= 0.3 && !this.forceNight && this.nextErupt < 4) this.nextErupt = 4 + this.rand() * 10;
    }

    /** Throw a plume now. Sound is told how late it should arrive by distance. */
    fire(strength, camPos) {
        this.plumes.erupt(strength, this.rand);
        this.eruptAge = 0;
        const d = camPos ? Math.hypot(camPos.x - VC.x, camPos.z - VC.z) : 1300;
        this.onErupt?.(d / 343, strength, d);
    }
}

export { LAVA_MAP, CRATER_FLOOR };
