// Geometry for the mine: 3D noise, tunnels swept along the track with a different
// cross-section at every metre, lumps of displaced rock, and the rock material
// they all wear. A tunnel is one closed surface whose normals face inward, so
// where tunnels overlap nothing shows from the wrong side and a cavern is just
// a tunnel that swells.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { frameAt, pointAt } from './minepath.js';
import { cavernRock } from './textures.js';
import { smoothstep, clamp, TAU } from './util.js';

// ---------------------------------------------------------------- noise

const hash3 = (x, y, z) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1103515245);
    return (((n ^ (n >>> 16)) >>> 0) / 4294967295) * 2 - 1;
};

/** 3D value noise in [-1, 1]. */
export function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10), w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
    const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
    const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
    const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
}

export function fbm3(x, y, z, oct = 3) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
        s += a * noise3(x * f + i * 11.7, y * f - i * 5.3, z * f + i * 3.1);
        n += a;
        a *= 0.5;
        f *= 2.03;
    }
    return s / n;
}

// ---------------------------------------------------------------- tunnels

/**
 * Sweep a closed cave section along the track from s0 to s1.
 *
 * @param {object} o
 *   s0, s1, ds    stretch and ring spacing (m)
 *   segs          vertices round each ring
 *   section(s, out)  fills { a, b, cx, cy, n, rough } : half width and height, centre offset
 *                    (left, up) from the rail, superellipse exponent, rock roughness (m)
 *   shape(info)   optional last say on a vertex before it is placed (info.p is a THREE.Vector3 to edit)
 *   paint(v)      colours a vertex: sets v.r v.g v.b (albedo), v.gr v.gg v.gb (baked glow), v.v0..v.v3 (vein colour and scale)
 *   bank          how far the section leans into curves (0..1)
 */
export function buildTube(o) {
    const { s0, s1, segs, section, shape, bank = 1, seed = 0 } = o;
    const ds = o.ds ?? 1.5;
    const rings = Math.ceil((s1 - s0) / ds) + 1;
    const count = rings * segs;
    const pos = new Float32Array(count * 3);
    const lxy = new Float32Array(count * 2);
    const ringS = new Float32Array(rings);
    const secs = [];
    const _pt = {};
    const fr = {}, sec = { a: 2, b: 2, cx: 0, cy: 0, n: 2.4, rough: 0.5 };
    const info = { p: new THREE.Vector3(), s: 0, phi: 0, lx: 0, ly: 0, rho: 0, i: 0, j: 0, sec, l: null, u: null, ox: 0, oy: 0, oz: 0 };
    for (let i = 0; i < rings; i++) {
        const s = Math.min(s1, s0 + i * ds);
        ringS[i] = s;
        frameAt(s, fr, bank);
        const P = pointAt(s, _pt);
        section(s, sec);
        secs.push({ ...sec });
        const { l, u } = fr;
        for (let j = 0; j < segs; j++) {
            const phi = (j / segs) * TAU;
            const c = Math.cos(phi), sn = Math.sin(phi);
            const rho = 1 / Math.pow(Math.pow(Math.abs(c) / sec.a, sec.n) + Math.pow(Math.abs(sn) / sec.b, sec.n), 1 / sec.n);
            let lx = sec.cx + c * rho, ly = sec.cy + sn * rho;
            let x = P.x + l.x * lx + u.x * ly, y = P.y + l.y * lx + u.y * ly, z = P.z + l.z * lx + u.z * ly;
            if (sec.rough > 0) {
                const k = 1 + seed * 0.37;
                const d = sec.rough * (fbm3(x * 0.07 * k, y * 0.07 * k, z * 0.07 * k, 3) + 0.7 * fbm3(x * 0.3 + 7, y * 0.3, z * 0.3, 2) + 0.4 * noise3(x * 1.05, y * 1.05, z * 1.05) + 0.17 * noise3(x * 2.6, y * 2.6, z * 2.6));
                // keep the floor under the rails flat
                const w = smoothstep(0.9, 2.8, Math.hypot(lx, ly + 0.2));
                // outward direction from the section centre
                const ox = c * l.x + sn * u.x, oy = c * l.y + sn * u.y, oz = c * l.z + sn * u.z;
                x += ox * d * w; y += oy * d * w; z += oz * d * w;
            }
            if (shape) {
                info.p.set(x, y, z);
                info.s = s; info.phi = phi; info.lx = lx; info.ly = ly; info.i = i; info.j = j; info.rho = rho; info.l = l; info.u = u;
                info.ox = c * l.x + sn * u.x; info.oy = c * l.y + sn * u.y; info.oz = c * l.z + sn * u.z;
                shape(info);
                x = info.p.x; y = info.p.y; z = info.p.z;
            }
            const k = i * segs + j;
            pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
            lxy[k * 2] = lx; lxy[k * 2 + 1] = ly;
        }
    }
    const idx = new (count > 65535 ? Uint32Array : Uint16Array)((rings - 1) * segs * 6);
    let q = 0;
    for (let i = 0; i < rings - 1; i++) {
        for (let j = 0; j < segs; j++) {
            const j1 = (j + 1) % segs;
            const a = i * segs + j, b = i * segs + j1, c = (i + 1) * segs + j, d = (i + 1) * segs + j1;
            idx[q++] = a; idx[q++] = c; idx[q++] = b;
            idx[q++] = b; idx[q++] = c; idx[q++] = d;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal.array;
    geo.computeBoundingSphere();
    const tube = { geo, rings, segs, ringS, secs, pos, nrm, lxy, s0, ds };
    /** Colour, glow and veins per vertex, once whatever lights it have been placed. */
    tube.paint = (paint) => {
        const col = new Float32Array(count * 3), glow = new Float32Array(count * 3), vein = new Float32Array(count * 4);
        const v = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, s: 0, phi: 0, lx: 0, ly: 0, i: 0, j: 0, sec: null, r: 0.2, g: 0.2, b: 0.2, gr: 0, gg: 0, gb: 0, v0: 0, v1: 0, v2: 0, v3: 0 };
        for (let i = 0; i < rings; i++) {
            for (let j = 0; j < segs; j++) {
                const k = i * segs + j;
                v.x = pos[k * 3]; v.y = pos[k * 3 + 1]; v.z = pos[k * 3 + 2];
                v.nx = nrm[k * 3]; v.ny = nrm[k * 3 + 1]; v.nz = nrm[k * 3 + 2];
                v.s = ringS[i]; v.phi = (j / segs) * TAU; v.lx = lxy[k * 2]; v.ly = lxy[k * 2 + 1]; v.i = i; v.j = j; v.sec = secs[i];
                v.r = v.g = v.b = 0.2; v.gr = v.gg = v.gb = 0; v.v0 = v.v1 = v.v2 = v.v3 = 0;
                paint(v);
                col[k * 3] = v.r; col[k * 3 + 1] = v.g; col[k * 3 + 2] = v.b;
                glow[k * 3] = v.gr; glow[k * 3 + 1] = v.gg; glow[k * 3 + 2] = v.gb;
                vein[k * 4] = v.v0; vein[k * 4 + 1] = v.v1; vein[k * 4 + 2] = v.v2; vein[k * 4 + 3] = v.v3;
            }
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 3));
        geo.setAttribute('aVein', new THREE.BufferAttribute(vein, 4));
        return tube;
    };
    return tube;
}

/**
 * Where the wall of a tube is at height ly (relative to the rail) on one side (+1 left, -1 right) near s:
 * { x, y, z, nx, ny, nz } or null.
 */
export function wallAt(tube, s, side, ly) {
    const i = clamp(Math.round((s - tube.s0) / tube.ds), 0, tube.rings - 1);
    const { segs, lxy, pos, nrm } = tube;
    for (let j = 0; j < segs; j++) {
        const a = i * segs + j, b = i * segs + ((j + 1) % segs);
        const la = lxy[a * 2 + 1], lb = lxy[b * 2 + 1];
        if (lxy[a * 2] * side <= 0) continue;
        if ((la - ly) * (lb - ly) > 0 || la === lb) continue;
        const f = (ly - la) / (lb - la);
        return {
            x: pos[a * 3] + (pos[b * 3] - pos[a * 3]) * f, y: pos[a * 3 + 1] + (pos[b * 3 + 1] - pos[a * 3 + 1]) * f, z: pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * f,
            nx: nrm[a * 3] + (nrm[b * 3] - nrm[a * 3]) * f, ny: nrm[a * 3 + 1] + (nrm[b * 3 + 1] - nrm[a * 3 + 1]) * f, nz: nrm[a * 3 + 2] + (nrm[b * 3 + 2] - nrm[a * 3 + 2]) * f,
        };
    }
    return null;
}

/** Pick a random point on a tube's surface: { x, y, z, nx, ny, nz, s, ring, j }. */
export function tubePoint(tube, r, out = {}) {
    const i = Math.floor(r() * (tube.rings - 1)), j = Math.floor(r() * tube.segs);
    const k = i * tube.segs + j;
    out.x = tube.pos[k * 3]; out.y = tube.pos[k * 3 + 1]; out.z = tube.pos[k * 3 + 2];
    out.nx = tube.nrm[k * 3]; out.ny = tube.nrm[k * 3 + 1]; out.nz = tube.nrm[k * 3 + 2];
    out.s = tube.ringS[i]; out.ring = i; out.j = j;
    return out;
}

// ---------------------------------------------------------------- lumps of rock

/** A displaced icosahedron: boulders, spurs, stalactites. Faces outward. */
export function rockGeometry(seed, { detail = 2, rough = 0.35, stretch = [1, 1, 1], flatTop = null } = {}) {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-4);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = fbm3(v.x * 1.7 + seed * 13, v.y * 1.7 + seed * 7, v.z * 1.7 + seed * 3, 3) + 0.25 * noise3(v.x * 5 + seed, v.y * 5, v.z * 5);
        v.multiplyScalar(1 + n * rough);
        v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
        if (flatTop !== null && v.y > flatTop) v.y = flatTop + (v.y - flatTop) * 0.04;
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

/** A hanging spike (or standing one, flipped): a cone with a ragged surface. */
export function spikeGeometry(seed, segs = 9, rows = 7) {
    const g = new THREE.CylinderGeometry(0.0, 1, 1, segs, rows, true);
    g.translate(0, -0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const t = -y;                       // 0 at the tip, 1 at the root... (cylinder top radius 0 is the tip)
        const k = 1 + 0.28 * noise3(x * 2.1 + seed, y * 3.3, z * 2.1) + 0.12 * noise3(x * 6, y * 8, z * 6 + seed);
        const bend = 0.12 * Math.sin(t * 5 + seed) * t;
        p.setXYZ(i, x * k + bend, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

// ---------------------------------------------------------------- the rock material

const ROCK_NOISE = /* glsl */ `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fb3(vec3 p){ return vn3(p) * 0.55 + vn3(p * 2.1 + 3.0) * 0.3 + vn3(p * 4.3 + 7.0) * 0.15; }
`;

/**
 * One material for all the mine's rock. It reads baked colour, glow and vein
 * attributes, and adds fine relief, strata and glowing veins in the shader.
 * With `outside` it is darkened with depth into the mountain, so the first
 * metres seen from the cove fall to black.
 */
export function rockMaterial({ outside = null, cut = false } = {}) {
    const g = cavernRock();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.6 });
    mat.userData.uniforms = {
        uTime: { value: 0 }, uPulse: { value: 1 }, uMouth: { value: new THREE.Vector4(0, 0, 0, 0) }, uWet: { value: 0.0 },
        uCutP: { value: new THREE.Vector3() }, uCutD: { value: new THREE.Vector3(0, 0, 1) }, uCutR: { value: 0 },
    };
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, mat.userData.uniforms, { uRockN: { value: g.normalMap }, uRockT: { value: g.map } });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nattribute vec4 aVein;\nvarying vec3 vGlow;\nvarying vec4 vVein;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vVein = aVein;\nvec4 ip = vec4(position, 1.0); vec3 in3 = normal;\n#ifdef USE_INSTANCING\nip = instanceMatrix * ip; in3 = mat3(instanceMatrix) * in3;\n#endif\nvWPos = (modelMatrix * ip).xyz;\nvWNrm = normalize(mat3(modelMatrix) * in3);');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                varying vec3 vGlow; varying vec4 vVein; varying vec3 vWPos; varying vec3 vWNrm;
                uniform sampler2D uRockN, uRockT;
                uniform float uTime, uPulse, uWet;
                uniform vec4 uMouth;
                uniform vec3 uCutP, uCutD; uniform float uCutR;
                ${ROCK_NOISE}`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                ${cut ? 'vec3 cd = vWPos - uCutP; float cal = dot(cd, uCutD); if (uCutR > 0.0 && length(cd - cal * uCutD) < uCutR && abs(cal) < 30.0) discard;' : ''}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 bw = pow(abs(normalize(vWNrm)), vec3(5.0));
                bw /= (bw.x + bw.y + bw.z);
                float tx = dot(texture2D(uRockT, vWPos.zy * 0.21).rgb, vec3(0.333)) * bw.x + dot(texture2D(uRockT, vWPos.xz * 0.21).rgb, vec3(0.333)) * bw.y + dot(texture2D(uRockT, vWPos.xy * 0.21).rgb, vec3(0.333)) * bw.z;
                float tf = dot(texture2D(uRockT, vWPos.zy * 1.1).rgb, vec3(0.333)) * bw.x + dot(texture2D(uRockT, vWPos.xz * 1.1).rgb, vec3(0.333)) * bw.y + dot(texture2D(uRockT, vWPos.xy * 1.1).rgb, vec3(0.333)) * bw.z;
                float large = fb3(vWPos * 0.31);
                diffuseColor.rgb *= (0.35 + tx * 1.05) * (0.7 + tf * 0.55) * (0.75 + large * 0.5);
                // strata: thin pale and dark layers
                float strata = sin(vWPos.y * 2.7 + large * 6.0 + vn3(vWPos * vec3(0.4, 0.1, 0.4)) * 3.0);
                diffuseColor.rgb *= 1.0 - 0.14 * smoothstep(0.35, 1.0, strata);`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                {
                    vec3 nT = texture2D(uRockN, vWPos.zy * 0.34).xyz * bw.x + texture2D(uRockN, vWPos.xz * 0.34).xyz * bw.y + texture2D(uRockN, vWPos.xy * 0.34).xyz * bw.z;
                    vec3 nF = texture2D(uRockN, vWPos.zy * 1.7).xyz * bw.x + texture2D(uRockN, vWPos.xz * 1.7).xyz * bw.y + texture2D(uRockN, vWPos.xy * 1.7).xyz * bw.z;
                    vec3 nd = (nT * 2.0 - 1.0) * 1.6 + (nF * 2.0 - 1.0) * 0.9;
                    vec3 nW = normalize(normalize(vWNrm) + vec3(nd.x, nd.y * 0.6, nd.y) * 0.62);
                    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
                }`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                {
                    // glowing fissures: the rock's own big cracks, lit in patches
                    float txL = dot(texture2D(uRockT, vWPos.zy * 0.065).rgb, vec3(0.333)) * bw.x + dot(texture2D(uRockT, vWPos.xz * 0.065).rgb, vec3(0.333)) * bw.y + dot(texture2D(uRockT, vWPos.xy * 0.065).rgb, vec3(0.333)) * bw.z;
                    float crack = smoothstep(0.3, 0.16, txL) * (0.25 + 0.75 * smoothstep(0.35, 0.62, fb3(vWPos * 0.9 + 5.0)));
                    float zone = smoothstep(0.58, 0.85, fb3(vWPos * 0.055 + vec3(0.0, uTime * 0.01, 0.0)) + 0.14 * vVein.a);
                    float vein = vVein.a > 0.0 ? crack * zone * (0.75 + 0.25 * sin(uTime * 1.3 + large * 20.0)) : 0.0;
                    totalEmissiveRadiance += vVein.rgb * vein * 0.75 * uPulse + vGlow * diffuseColor.rgb * 2.4 * uPulse;
                }`);
        if (outside) {
            sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
                float depthIn = max(0.0, (vWPos.z - uMouth.z) * uMouth.w);
                outgoingLight *= mix(0.02, 1.0, exp(-depthIn));
                #include <opaque_fragment>`);
        }
    };
    return mat;
}
