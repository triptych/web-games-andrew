// The Foundry's effects: welding sparks, lava splashes and embers (one additive
// particle system), paint mist and steam (a soft one), electric arcs, the lava
// itself, the lava falls on the far wall, the rock of the pit lit from below,
// and the hazy cones under the high lamps. Particles are written once, when
// they are born, and moved on the GPU: each keeps where and when it started,
// its velocity and how hard gravity pulls it.

import * as THREE from 'three';
import { glowSprite } from './textures.js';

const PVERT = /* glsl */ `
uniform float uTime, uScale;
attribute vec4 aVel;    // xyz velocity, w gravity (m/s²)
attribute vec4 aLife;   // birth, life, size, drag
attribute vec3 aColor;
varying vec3 vColor;
varying float vA;
#include <fog_pars_vertex>
void main(){
  float age = uTime - aLife.x;
  float k = age / aLife.y;
  vec3 p = position;
  if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  // drag slows the throw; gravity still has its way
  float d = aLife.w;
  float t = d > 0.0 ? (1.0 - exp(-d * age)) / d : age;
  p += aVel.xyz * t;
  p.y -= 0.5 * aVel.w * age * age;
  vColor = aColor;
  vA = (1.0 - k) * smoothstep(0.0, 0.05, k);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aLife.z * uScale / -mvPosition.z * (0.6 + 0.4 * (1.0 - k));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const PFRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uSoft;
varying vec3 vColor;
varying float vA;
#include <fog_pars_fragment>
void main(){
  float m = texture2D(uMap, gl_PointCoord).a;
  float a = m * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * (uSoft > 0.5 ? 1.0 : a), uSoft > 0.5 ? a * 0.5 : 1.0);
  #include <fog_fragment>
}`;

/** A ring buffer of GPU particles. */
export class Particles {
    constructor(scene, n, { soft = false } = {}) {
        this.n = n;
        this.i = 0;
        const g = new THREE.BufferGeometry();
        const attr = (name, size) => {
            const a = new THREE.BufferAttribute(new Float32Array(n * size), size);
            a.setUsage(THREE.DynamicDrawUsage);
            g.setAttribute(name, a);
            return a;
        };
        this.pos = attr('position', 3);
        this.vel = attr('aVel', 4);
        this.life = attr('aLife', 4);
        this.col = attr('aColor', 3);
        for (let i = 0; i < n; i++) this.life.array[i * 4 + 1] = 1e-3; // all dead
        this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 300 }, uMap: { value: null }, uSoft: { value: soft ? 1 : 0 } }]);
        this.uniforms.uMap.value = glowSprite();
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, fog: true,
            blending: soft ? THREE.NormalBlending : THREE.AdditiveBlending,
        });
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = soft ? 6 : 7;
        scene.add(this.points);
        this.dirty = false;
        this.time = 0;
    }

    emit(x, y, z, vx, vy, vz, { life = 1, size = 0.1, grav = 9.8, drag = 0, r = 1, g = 1, b = 1 } = {}) {
        const i = this.i;
        this.i = (i + 1) % this.n;
        this.pos.array.set([x, y, z], i * 3);
        this.vel.array.set([vx, vy, vz, grav], i * 4);
        this.life.array.set([this.time, life, size, drag], i * 4);
        this.col.array.set([r, g, b], i * 3);
        this.dirty = true;
    }

    update(t, viewportH) {
        this.time = t;
        this.uniforms.uTime.value = t;
        this.uniforms.uScale.value = viewportH * 0.6;
        if (this.dirty) {
            this.pos.needsUpdate = this.vel.needsUpdate = this.life.needsUpdate = this.col.needsUpdate = true;
            this.dirty = false;
        }
    }
}

/** Jagged electric arcs, redrawn every frame. */
export class Arcs {
    constructor(scene, max = 24, segs = 10) {
        this.max = max;
        this.segs = segs;
        this.geo = new THREE.BufferGeometry();
        this.arr = new Float32Array(max * segs * 2 * 3 * 2);
        this.attr = new THREE.BufferAttribute(this.arr, 3);
        this.attr.setUsage(THREE.DynamicDrawUsage);
        this.geo.setAttribute('position', this.attr);
        this.lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 2.4, 4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.lines.frustumCulled = false;
        this.lines.renderOrder = 8;
        scene.add(this.lines);
    }

    /** list of { a, b } (Vector3s) */
    draw(list) {
        let o = 0;
        const { segs, arr } = this;
        const n = Math.min(list.length, this.max);
        for (let i = 0; i < n; i++) {
            const { a, b, big } = list[i];
            const len = a.distanceTo(b);
            const amp = (big ? 0.12 : 0.06) * len;
            // two strands: a bright core and a forked one
            for (let strand = 0; strand < 2; strand++) {
                let px = a.x, py = a.y, pz = a.z;
                for (let s = 1; s <= segs; s++) {
                    const t = s / segs;
                    const j = s === segs ? 0 : amp * (strand ? 1.4 : 1);
                    const x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j;
                    const y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * j;
                    const z = a.z + (b.z - a.z) * t + (Math.random() - 0.5) * j;
                    arr[o++] = px; arr[o++] = py; arr[o++] = pz;
                    arr[o++] = x; arr[o++] = y; arr[o++] = z;
                    px = x; py = y; pz = z;
                }
            }
        }
        this.geo.setDrawRange(0, o / 3);
        this.attr.needsUpdate = true;
    }
}

// ---------------------------------------------------------------- lava

const NOISE = /* glsl */ `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

/** A lake of lava: dark crust drifting over a glowing melt. */
export function lavaMaterial() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
    return new THREE.ShaderMaterial({
        uniforms, fog: true,
        vertexShader: `varying vec2 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
        fragmentShader: `uniform float uTime; varying vec2 vW;\n${NOISE}\n#include <fog_pars_fragment>\nvoid main(){
          vec2 p = vW * 0.09;
          vec2 flow = vec2(fbm(p + uTime * 0.02), fbm(p - uTime * 0.017 + 4.0));
          float n = fbm(p * 1.7 + flow * 2.2 + vec2(uTime * 0.03, -uTime * 0.012));
          float cracks = smoothstep(0.42, 0.62, n);
          float hot = pow(1.0 - cracks, 2.0);
          vec3 crust = vec3(0.09, 0.03, 0.02) + vec3(0.25, 0.06, 0.0) * smoothstep(0.75, 0.55, n);
          vec3 melt = mix(vec3(1.9, 0.36, 0.04), vec3(2.6, 1.05, 0.2), fbm(p * 4.0 - uTime * 0.1));
          float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + n * 9.0);
          gl_FragColor = vec4(mix(crust, melt * pulse, hot), 1.0);
          #include <fog_fragment>
        }`,
    });
}

/** A fall of lava down the far wall, pouring for ever. */
export function lavafallMaterial() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
    return new THREE.ShaderMaterial({
        uniforms, fog: true, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        vertexShader: `varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;\n${NOISE}\n#include <fog_pars_fragment>\nvoid main(){
          float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          float n = fbm(vec2(vUv.x * 6.0, vUv.y * 3.0 + uTime * 1.4));
          float streak = fbm(vec2(vUv.x * 18.0, vUv.y * 1.2 + uTime * 2.2));
          float a = edge * smoothstep(0.25, 0.55, n + edge * 0.3);
          vec3 c = mix(vec3(1.8, 0.35, 0.04), vec3(3.2, 1.3, 0.3), streak);
          c *= 0.7 + 0.5 * vUv.y;
          if (a < 0.02) discard;
          gl_FragColor = vec4(c, a);
          #include <fog_fragment>
        }`,
    });
}

/** Rock lit by the lava below it: the lower it is, the redder it glows. */
export function underglow(mat, y0, h, strength = 1.6) {
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uGlowY = { value: y0 };
        sh.uniforms.uGlowH = { value: h };
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vWY;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uGlowY, uGlowH;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\nfloat gk = clamp(1.0 - (vWY - uGlowY) / uGlowH, 0.0, 1.0);\ntotalEmissiveRadiance += vec3(1.0, 0.28, 0.05) * pow(gk, 3.0) * ${strength.toFixed(2)};`);
    };
    mat.customProgramCacheKey = () => `underglow-${y0}-${h}-${strength}`;
    return mat;
}

/** The haze lit under a high lamp: a cone, brighter at its top. */
export function beamMaterial(color = new THREE.Color(1, 0.86, 0.6), strength = 0.06) {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uStrength: { value: strength } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * uStrength; gl_FragColor = vec4(uColor * a, 1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}
