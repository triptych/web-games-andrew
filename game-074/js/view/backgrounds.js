// The look of each circle: a procedural sky shader on a far plane, the
// lighting rig, the fog, and layers of 3D scenery that scroll past at depth
// (perspective gives the parallax for free). Index 7 is the dawn sky of the
// ending, used only by the story scenes.

import * as THREE from 'three';
import { Builder, litMat, NOISE_GLSL, sphere, cyl, cone, box, torus, octa, lathe, dsphere, taperTube, displace } from './lib.js';
import { CAM_D } from './renderer.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const c = (h) => new THREE.Color(h);

export const LOOKS = [
    { top: 0x060103, hor: 0x5a1206, glow: 0xff4a10, fog: 0x260806, fogNear: 26, fogFar: 95, keyDir: V(0.25, -0.8, 0.6), keyCol: c(0xff6a20), keyInt: 1.8, sky: c(0x3a1010), ground: c(0xff5020), hemi: 0.7, rim: c(0xff6a30), rimAmt: 0.55, fill: c(0xffd8c0), fillInt: 0.9, exposure: 1.0, bloom: 0.85, heat: 0.6, grade: [1.05, 0.95, 0.9] },
    { top: 0x07060c, hor: 0x3a3444, glow: 0xb0a890, fog: 0x1a1720, fogNear: 26, fogFar: 90, keyDir: V(-0.4, 1, 0.5), keyCol: c(0xc0c8ff), keyInt: 1.2, sky: c(0x6a6a80), ground: c(0x302018), hemi: 0.8, rim: c(0xa8a8d8), rimAmt: 0.45, fill: c(0xd8d8ff), fillInt: 1.0, exposure: 1.05, bloom: 0.7, heat: 0, grade: [0.95, 0.97, 1.05] },
    { top: 0x0a0504, hor: 0x5a2a10, glow: 0xff7a20, fog: 0x2a1408, fogNear: 26, fogFar: 90, keyDir: V(0.5, -0.6, 0.6), keyCol: c(0xff7a20), keyInt: 1.6, sky: c(0x3a2a20), ground: c(0xa04010), hemi: 0.7, rim: c(0xffa040), rimAmt: 0.5, fill: c(0xffe0c8), fillInt: 0.9, exposure: 1.0, bloom: 0.85, heat: 0.45, grade: [1.08, 0.98, 0.88] },
    { top: 0x010506, hor: 0x0a3434, glow: 0x40ffd0, fog: 0x061616, fogNear: 26, fogFar: 95, keyDir: V(-0.2, 1, 0.6), keyCol: c(0x80ffe8), keyInt: 1.0, sky: c(0x205050), ground: c(0x051010), hemi: 0.8, rim: c(0x60ffe0), rimAmt: 0.6, fill: c(0xc8fff0), fillInt: 0.9, exposure: 1.1, bloom: 0.8, heat: 0, grade: [0.9, 1.02, 1.05] },
    { top: 0x140106, hor: 0x5a0816, glow: 0xff3050, fog: 0x2a060c, fogNear: 26, fogFar: 85, keyDir: V(-0.3, 0.6, 0.8), keyCol: c(0xff6070), keyInt: 1.3, sky: c(0x803040), ground: c(0x300810), hemi: 0.75, rim: c(0xff5a70), rimAmt: 0.55, fill: c(0xffd0d8), fillInt: 0.85, exposure: 1.0, bloom: 0.75, heat: 0.25, grade: [1.08, 0.94, 0.96] },
    { top: 0x02050c, hor: 0x1a3450, glow: 0x80c8ff, fog: 0x0c1828, fogNear: 26, fogFar: 95, keyDir: V(0.1, 1, 0.7), keyCol: c(0xc8e8ff), keyInt: 1.5, sky: c(0x6080a0), ground: c(0x102030), hemi: 0.8, rim: c(0x80d0ff), rimAmt: 0.6, fill: c(0xd8f0ff), fillInt: 1.0, exposure: 1.1, bloom: 0.85, heat: 0, grade: [0.94, 1.0, 1.08] },
    { top: 0x1c1030, hor: 0xd06a50, glow: 0xffd8a0, fog: 0x4a2840, fogNear: 28, fogFar: 110, keyDir: V(0.6, 0.8, 0.5), keyCol: c(0xffd8a0), keyInt: 1.6, sky: c(0xc8a0a0), ground: c(0x402030), hemi: 0.6, rim: c(0xffd890), rimAmt: 0.6, fill: c(0xfff0d8), fillInt: 0.7, exposure: 0.92, bloom: 0.85, heat: 0, grade: [1.04, 1.0, 0.95] },
    { top: 0x6a5a98, hor: 0xffa070, glow: 0xfff0d0, fog: 0xc89080, fogNear: 30, fogFar: 160, keyDir: V(0.5, 0.9, 0.6), keyCol: c(0xfff0d0), keyInt: 1.2, sky: c(0xfff0e0), ground: c(0xc08070), hemi: 0.55, rim: c(0xfff0c0), rimAmt: 0.7, fill: c(0xffffff), fillInt: 0.35, exposure: 0.9, bloom: 1.0, heat: 0, grade: [1.03, 1.0, 0.96] },
];

const SKY_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `
precision highp float;
varying vec2 vUv;
uniform float uStage, uTime, uScroll;
uniform vec3 uTop, uHor, uGlow;
${NOISE_GLSL}
float n2(vec2 p){ return vn3(vec3(p, 0.37)); }
float fbm2(vec2 p){ return n2(p) * 0.5 + n2(p * 2.07 + 1.3) * 0.27 + n2(p * 4.13 + 5.1) * 0.15 + n2(p * 8.3 + 9.7) * 0.08; }
float stars(vec2 p, float dens, float sz){
  vec2 g = floor(p), f = fract(p) - 0.5;
  float h = fract(sin(dot(g, vec2(127.1, 311.7))) * 43758.5453);
  vec2 o = vec2(fract(h * 17.3), fract(h * 91.7)) - 0.5;
  float d = length(f - o * 0.6);
  return step(1.0 - dens, h) * smoothstep(sz, 0.0, d);
}
void main(){
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * 1.78 + uScroll * 0.0035, uv.y);
  vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.9, uv.y));
  int s = int(uStage + 0.5);
  if (s == 0) {
    col += uGlow * pow(1.0 - uv.y, 4.0) * 0.9;
    float sm = fbm2(vec2(p.x * 2.5, p.y * 1.6 - uTime * 0.03));
    float sm2 = fbm2(vec2(p.x * 5.0 + 3.0, p.y * 3.0 - uTime * 0.06));
    col = mix(col, vec3(0.02, 0.005, 0.004), smoothstep(0.45, 0.85, sm) * 0.85);
    col += uGlow * smoothstep(0.55, 0.9, sm2) * pow(1.0 - uv.y, 2.0) * 0.4;
    vec2 e = vec2(p.x * 40.0, p.y * 24.0 - uTime * 1.5);
    col += vec3(1.0, 0.5, 0.15) * stars(e, 0.04, 0.12) * 2.0;
  } else if (s == 1) {
    float fog = fbm2(vec2(p.x * 2.0 - uTime * 0.01, p.y * 4.0));
    col = mix(col, uGlow * 0.35, smoothstep(0.4, 0.8, fog) * smoothstep(0.75, 0.2, uv.y) * 0.6);
    vec2 m = vec2(0.72, 0.68);
    float d = length((uv - m) * vec2(1.78, 1.0));
    col += uGlow * (smoothstep(0.09, 0.08, d) * 0.9 + exp(-d * 7.0) * 0.35);
    col += vec3(0.8) * stars(p * vec2(60.0, 34.0), 0.02, 0.1) * smoothstep(0.4, 0.9, uv.y);
  } else if (s == 2) {
    col += uGlow * pow(1.0 - uv.y, 3.0) * 0.7;
    float sm = fbm2(vec2(p.x * 3.0, p.y * 2.0 - uTime * 0.05));
    col = mix(col, vec3(0.03, 0.015, 0.01), smoothstep(0.4, 0.8, sm) * 0.8);
    vec2 e = vec2(p.x * 30.0 + uTime * 0.6, p.y * 18.0 - uTime * 2.4);
    col += vec3(1.0, 0.6, 0.2) * stars(e, 0.05, 0.1) * 2.4;
  } else if (s == 3) {
    float a = fbm2(vec2(p.x * 1.6 + uTime * 0.02, uv.y * 1.2 - uTime * 0.04));
    float band = smoothstep(0.35, 0.0, abs(uv.y - 0.55 - (a - 0.5) * 0.6));
    col += uGlow * band * smoothstep(0.45, 0.75, a) * 0.55;
    vec2 e = vec2(p.x * 22.0, p.y * 14.0 - uTime * 0.6);
    col += vec3(0.4, 1.0, 0.9) * stars(e, 0.03, 0.14) * 1.4;
  } else if (s == 4) {
    vec2 q = p * vec2(4.0, 3.0);
    float v1 = abs(fbm2(q + vec2(0.0, uTime * 0.05)) - 0.5);
    float v2 = abs(fbm2(q * 2.1 + 7.0) - 0.5);
    float pulse = 0.7 + 0.3 * sin(uTime * 3.0);
    col += uGlow * (smoothstep(0.03, 0.0, v1) * pulse + smoothstep(0.02, 0.0, v2) * 0.4) * 0.6;
    col *= 0.8 + 0.4 * fbm2(q * 0.5);
  } else if (s == 5) {
    float a = fbm2(vec2(p.x * 1.4 - uTime * 0.015, uv.y * 1.5 + uTime * 0.02));
    float band = smoothstep(0.28, 0.0, abs(uv.y - 0.7 - (a - 0.5) * 0.5));
    col += mix(uGlow, vec3(0.5, 1.0, 0.8), a) * band * smoothstep(0.4, 0.7, a) * 0.6;
    col += vec3(0.9, 0.95, 1.0) * stars(p * vec2(70.0, 40.0), 0.03, 0.1) * smoothstep(0.3, 0.9, uv.y);
    vec2 e = vec2(p.x * 26.0 - uTime * 1.2, p.y * 16.0 + uTime * 1.6);
    col += vec3(0.8, 0.9, 1.0) * stars(e, 0.05, 0.12) * 0.9;
  } else {
    // dawn: the gate of light, rays and clouds
    vec2 sun = vec2(0.82, 0.86);
    vec2 d = (uv - sun) * vec2(1.78, 1.0);
    float r = length(d);
    col += uGlow * (exp(-r * 5.0) * 0.55 + smoothstep(0.07, 0.055, r) * 1.2);
    float ang = atan(d.y, d.x);
    float rays = pow(max(0.0, sin(ang * 14.0 + uTime * 0.1) * 0.5 + 0.5), 6.0) * exp(-r * 1.6);
    col += uGlow * rays * 0.16;
    float cl = fbm2(vec2(p.x * 2.2 - uTime * 0.02, uv.y * 5.0));
    float clm = smoothstep(0.5, 0.75, cl) * smoothstep(0.05, 0.35, uv.y) * smoothstep(0.85, 0.5, uv.y);
    col = mix(col, mix(vec3(0.55, 0.32, 0.36), vec3(0.16, 0.08, 0.14), 1.0 - uv.y), clm * 0.75);
    if (s == 7) col = mix(col, vec3(1.0, 0.9, 0.75), 0.08);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- scenery builders
function propSet(stage) {
    const mats = [litMat({ rough: 0.85, glowMul: 0.9, rimMul: 0.6 })];
    const M = mats[0];
    const mk = (b) => new THREE.Mesh(b.build(), M);
    const out = [];   // [{ geoMesh factory, z range, count, scale }]
    const add = (fn, z0, z1, n, s0 = 1, s1 = 1, y = 0) => out.push({ fn, z0, z1, n, s0, s1, y });
    switch (stage) {
        case 0: {
            add(() => { const b = new Builder(); const g = displace(new THREE.ConeGeometry(1, 1, 10, 6), 0.12, 2, 3); b.add(g, { s: [1.5, 12, 1.5], p: [0, 6, 0], color: 0x1a0806, tint: (x, y) => new THREE.Color(Math.abs(Math.sin(y * 9 + x * 4)) > 0.95 ? 0xff5010 : 0x1a0806), glow: 1.2 }); return mk(b); }, -22.0, -47.5, 9, 0.9, 1.95, -2);
            add(() => { const b = new Builder(); b.add(displace(new THREE.ConeGeometry(1, 1, 14, 4), 0.06, 1.5, 5), { s: [22, 18, 12], p: [0, 9, 0], color: 0x120404, color2: 0x2a0806, grad: 'y' }); b.add(sphere(), { p: [0, 18, 0], s: [3, 1, 2], color: 0xff6010, glow: 3 }); return mk(b); }, -80.0, -122.5, 4, 1.2, 2.1, -4);
            break;
        }
        case 1: {
            add(() => {
                const b = new Builder();
                b.add(taperTube([V(0, -2), V(0.4, 3), V(-0.3, 7), V(0.5, 10)], 0.45, 0.12, 8, 16), { color: 0xd8ccb0, color2: 0x8a7a5a, grad: 'y' });
                for (let i = 0; i < 6; i++) { const y = 4 + i * 1.1, s = i % 2 ? 1 : -1; b.add(taperTube([V(0, y), V(s * 1.2, y + 0.8), V(s * 2.4, y + 0.5), V(s * 3.0, y + 1.3)], 0.14, 0.03, 6, 10), { color: 0xd8ccb0 }); b.add(sphere(), { p: [s * 3.0, y + 1.4, 0], s: 0.18, color: 0xe8dcc0 }); }
                return mk(b);
            }, -20.0, -42.5, 10, 1.05, 1.8, -1);
            add(() => { const b = new Builder(); for (let i = 0; i < 9; i++) b.add(taperTube([V(i * 1.2, 0, 1.5), V(i * 1.2 + 0.2, 4, 0.8), V(i * 1.2, 6, -0.2)], 0.25, 0.12, 6, 10), { color: 0xc8bca0 }); b.add(cyl(1, 1, 10), { p: [5, 6, -0.2], r: [0, 0, Math.PI / 2], s: [0.35, 11, 0.35], color: 0xb8ac90 }); return mk(b); }, -38.0, -66.2, 4, 1.5, 2.4, -2);
            break;
        }
        case 2: {
            add(() => { const b = new Builder(); b.add(cyl(0.8, 1, 16), { s: [1.4, 16, 1.4], p: [0, 6, 0], color: 0x3a2a20, color2: 0x1a1210, grad: 'y' }); b.add(torus(0.2, 8, 20), { p: [0, 14, 0], r: [Math.PI / 2, 0, 0], s: 1.2, color: 0xff6010, glow: 2.5 }); for (let y = 0; y < 13; y += 2.2) b.add(torus(0.12, 6, 18), { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: 1.45, color: 0x5a4a3a }); return mk(b); }, -24.0, -52.5, 8, 1.05, 1.95, -3);
            add(() => { const b = new Builder(); b.add(torus(0.18, 10, 36), { s: 4, color: 0x5a4a38 }); for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; b.add(box(), { p: [Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0], r: [0, 0, a], s: [1.0, 0.7, 0.8], color: 0x5a4a38 }); } b.add(cyl(1, 1, 12), { r: [Math.PI / 2, 0, 0], s: [1, 1, 1], color: 0xff7020, glow: 1.5 }); const m = mk(b); m.userData.spin = 0.3; return m; }, -28.0, -47.5, 4, 0.9, 1.65, 8);
            break;
        }
        case 3: {
            add(() => {
                const b = new Builder();
                for (const s of [-1, 1]) { b.add(cyl(1, 1, 12), { p: [s * 2.5, 4, 0], s: [0.6, 12, 0.6], color: 0x2a3a3a }); }
                b.add(taperTube([V(-2.5, 10), V(-1.5, 13), V(0, 14.2), V(1.5, 13), V(2.5, 10)], 0.5, 0.5, 8, 20), { color: 0x2a3a3a });
                b.add(sphere(10, 8), { p: [0, 14.6, 0], s: 0.3, color: 0x60ffd8, glow: 3 });
                return mk(b);
            }, -20.0, -45.0, 7, 1.2, 1.95, -2);
            add(() => { const b = new Builder(); b.add(lathe([[0, 3], [0.5, 2.6], [0.7, 1], [0.9, -1], [1.2, -2]], 14), { p: [0, 2, 0], color: 0x1a2424 }); b.add(sphere(), { p: [0, 5.2, 0], s: 0.5, color: 0x2a3434 }); for (const s of [-1, 1]) b.add(taperTube([V(0, 4.5, s * 0.3), V(-1, 6, s * 1.2), V(-1.5, 8, s * 1.8)], 0.4, 0.05, 6, 10), { color: 0x203030 }); return mk(b); }, -40.0, -72.5, 4, 1.8, 2.7, -1);
            break;
        }
        case 4: {
            add(() => { const b = new Builder(); b.add(taperTube([V(0, -2), V(1.2, 3), V(-1.0, 7), V(0.6, 12), V(-0.4, 16)], 0.9, 0.25, 10, 24), { tint: (x, y) => new THREE.Color(Math.abs(Math.sin(y * 3 + x)) > 0.9 ? 0xff8090 : 0x7a1828), glow: 0.3 }); return mk(b); }, -18.0, -40.0, 12, 0.9, 1.8, -2);
            add(() => { const b = new Builder(); b.add(dsphere(0.15, 1.5, 81), { s: [3, 3.5, 2.5], color: 0x8a2030, glow: 0.2 }); b.add(sphere(), { s: [0.8, 0.8, 0.5], p: [0, 0, 2.4], color: 0xffa060, glow: 2 }); return mk(b); }, -32.0, -60.0, 5, 1.05, 2.1, 8);
            break;
        }
        case 5: {
            add(() => { const b = new Builder(); for (let i = 0; i < 5; i++) b.add(octa(1), { p: [(i - 2) * 0.8, 3 + (i % 3) * 1.5, (i % 2) * 0.6], r: [0, i, (i - 2) * 0.12], s: [0.9, 6 + i, 0.9], color: 0x8ab0d0, color2: 0x1a3050, grad: 'y', glow: 0.1 }); return mk(b); }, -26.0, -55.0, 10, 0.7, 1.4, -4);
            add(() => { const b = new Builder(); b.add(box(), { s: [5, 9, 3], p: [0, 4.5, 0], color: 0x8ab8d8, glow: 0.15 }); b.add(sphere(), { p: [0, 5.5, 1.0], s: [1, 1.3, 0.6], color: 0x101828 }); for (const s of [-1, 1]) b.add(taperTube([V(0, 6, 1.1), V(s * 1.5, 7.5, 1.1), V(s * 2.2, 8.4, 1.1)], 0.35, 0.1, 6, 10), { color: 0x101828 }); return mk(b); }, -36.0, -62.5, 4, 1.5, 2.25, -2);
            break;
        }
        default: {
            add(() => { const b = new Builder(); b.add(cyl(1, 1, 18), { s: [0.9, 14, 0.9], p: [0, 5, 0], color: 0x9a8a80, color2: 0x4a3a40, grad: 'y' }); b.add(box(), { s: [2.4, 0.6, 2.4], p: [0, 12.2, 0], color: 0x9a8a80 }); b.add(box(), { s: [2.4, 0.6, 2.4], p: [0, -2, 0], color: 0x6a5a58 }); for (let y = -1; y < 12; y += 2.4) b.add(torus(0.08, 6, 18), { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: 0.92, color: 0xffd070, glow: 0.4 }); return mk(b); }, -20.0, -47.5, 9, 0.9, 1.8, -3);
            add(() => { const b = new Builder(); b.add(dsphere(0.2, 0.8, 91), { s: [4, 1.6, 3], color: 0xc8b8a8, color2: 0x6a5060, grad: 'y' }); b.add(cone(8), { p: [0, -2.6, 0], r: [Math.PI, 0, 0], s: [3, 3, 2.4], color: 0x6a5060 }); return mk(b); }, -28.0, -60.0, 6, 0.9, 2.1, 9);
        }
    }
    return { out, mats };
}

export class Backdrop {
    constructor(scene) {
        this.uniforms = { uStage: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } };
        const g = new THREE.PlaneGeometry(1, 1);
        this.sky = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, depthWrite: false }));
        const z = -170, dist = CAM_D - z;
        const h = 2 * dist * Math.tan((40 / 2) * Math.PI / 180) * 1.25;
        this.sky.scale.set(h * 2.4, h, 1);
        this.sky.position.set(16, 9, z);
        this.sky.renderOrder = -10;
        this.sky.frustumCulled = false;
        scene.add(this.sky);
        this.props = new THREE.Group();
        scene.add(this.props);
        this.items = [];
        this.mats = [];
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.8);
        this.key = new THREE.DirectionalLight(0xffffff, 1.5);
        this.key.position.set(0, 10, 10);
        this.key.target.position.set(16, 9, 0);
        this.fill = new THREE.DirectionalLight(0xffffff, 0.8);
        this.fill.position.set(8, 16, 30);
        this.fill.target.position.set(16, 9, 0);
        scene.add(this.hemi, this.key, this.key.target, this.fill, this.fill.target);
        this.scene = scene;
        this.stage = -1;
    }

    setStage(i) {
        const L = LOOKS[i];
        this.look = L;
        const u = this.uniforms;
        u.uStage.value = i; u.uTop.value.set(L.top); u.uHor.value.set(L.hor); u.uGlow.value.set(L.glow);
        this.scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
        this.hemi.color.copy(L.sky); this.hemi.groundColor.copy(L.ground); this.hemi.intensity = L.hemi;
        this.key.color.copy(L.keyCol); this.key.intensity = L.keyInt;
        this.key.position.set(16 + L.keyDir.x * 20, 9 + L.keyDir.y * 20, L.keyDir.z * 20);
        this.fill.color.copy(L.fill); this.fill.intensity = L.fillInt;
        if (this.stage === i) return;
        this.stage = i;
        for (const it of this.items) { this.props.remove(it.mesh); }
        for (const m of this.mats) m.dispose();
        this.items = [];
        const { out, mats } = propSet(Math.min(i, 6));
        this.mats = mats;
        let seed = 1 + i * 97;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (const layer of out) {
            const zMid = (layer.z0 + layer.z1) / 2;
            const halfW = (CAM_D - zMid) * Math.tan(20 * Math.PI / 180) * (16 / 9) + 8;
            const span = halfW * 2 + 10;
            for (let k = 0; k < layer.n; k++) {
                const mesh = layer.fn();
                const z = layer.z0 + (layer.z1 - layer.z0) * rnd();
                const s = layer.s0 + (layer.s1 - layer.s0) * rnd();
                mesh.scale.setScalar(s);
                mesh.rotation.y = rnd() * Math.PI * 2;
                mesh.frustumCulled = false;
                const halfWz = (CAM_D - z) * Math.tan(20 * Math.PI / 180) * (16 / 9) + 6 * s;
                const it = { mesh, wx: 16 - halfW + (k + rnd() * 0.8) * (span / layer.n), z, y: layer.y + (rnd() - 0.5) * 2, span, halfW: halfWz, par: 1 };
                mesh.position.set(0, it.y, z);
                this.props.add(mesh);
                this.items.push(it);
            }
        }
    }

    update(scroll, time, dt) {
        this.uniforms.uTime.value = time;
        this.uniforms.uScroll.value = scroll;
        for (const it of this.items) {
            let x = it.wx - scroll;
            while (x < 16 - it.halfW - 4) { it.wx += it.span; x += it.span; }
            while (x > 16 + it.halfW + it.span) { it.wx -= it.span; x -= it.span; }
            it.mesh.position.x = x;
            if (it.mesh.userData.spin) it.mesh.rotation.z += it.mesh.userData.spin * dt;
        }
    }

    setPropsVisible(v) { this.props.visible = v; }
}
