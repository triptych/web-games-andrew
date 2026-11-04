// Materials and small shaders for the glowing garden under the well
// (grotto.js): vertex-coloured flora that glows and sways, the cave's rock
// (mapped in three directions, with holes cut for the shaft and the pool), the
// pool's water and its waterfall, and a soft point-sprite shader for spores,
// glowworms and sparks.

import * as THREE from 'three';
import { cavernRock, canvas } from './textures.js';

export const C = (h) => new THREE.Color(h);

/**
 * Flora: vertex colours, a sway per vertex and a glow per vertex (the colour
 * itself is what shines). `u` holds { uTime, uSway, uGlow, uVital }; give a plant
 * its own `uVital` (0..1, how well it is) to dim it when it is thirsty.
 */
export function floraMaterial(u, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.7, metalness: 0, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: u.uTime, uSway: u.uSway, uGlow: u.uGlow, uVital: u.uVital });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
attribute float aSway; attribute float aGlow; uniform float uTime; uniform float uSway;
varying float vGlow; varying float vPh;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = uTime * 1.05 + position.x * 0.9 + position.z * 0.6;
transformed.x += sin(ph) * aSway * uSway;
transformed.z += cos(ph * 0.83 + 1.3) * aSway * uSway * 0.65;
vGlow = aGlow;
vPh = position.x * 2.7 + position.y * 1.9 + position.z * 1.3;`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uGlow; uniform float uVital;
varying float vGlow; varying float vPh;`)
            // the lit surface is darker than the colour that shines, so a glowing thing stays saturated
            .replace('#include <color_fragment>', `#include <color_fragment>
vec3 glowCol = diffuseColor.rgb;
diffuseColor.rgb *= 0.55;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float pulse = 0.84 + 0.16 * sin(uTime * 1.6 + vPh);
totalEmissiveRadiance += glowCol * vGlow * uGlow * uVital * pulse;`);
    };
    m.customProgramCacheKey = () => 'garden-grotto-flora-2';
    return m;
}

export const floraUniforms = (shared, vital = 1) => ({ uTime: shared.uTime, uSway: shared.uSway, uGlow: shared.uGlow, uVital: { value: vital } });

/**
 * The cave's rock, seen from inside. The rock texture is laid on in three
 * directions (so a dome has no seams or pinched poles), and fragments inside
 * the shaft's circle (high up) or the pool's (low down) are discarded.
 */
export function shellMaterial(u) {
    const rock = cavernRock();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uRock: { value: rock.map }, uHole: u.uHole, uPool: u.uPool, uTime: u.uTime });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vWP = (modelMatrix * vec4(position, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * normal);`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform sampler2D uRock; uniform vec3 uHole; uniform vec3 uPool; uniform float uTime;
varying vec3 vWP; varying vec3 vWN;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.08;`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vWP.y > 4.0 && distance(vWP.xz, uHole.xy) < uHole.z) discard;
if (vWP.y < 0.7 && distance(vWP.xz, uPool.xy) < uPool.z) discard;`)
            .replace('#include <map_fragment>', `
vec3 bw = pow(abs(vWN), vec3(3.0));
bw /= (bw.x + bw.y + bw.z + 1e-4);
vec3 rk = texture2D(uRock, vWP.zy * 0.085).rgb * bw.x + texture2D(uRock, vWP.xz * 0.085).rgb * bw.y + texture2D(uRock, vWP.xy * 0.085).rgb * bw.z;
vec3 rk2 = texture2D(uRock, vWP.zy * 0.31 + 0.3).rgb * bw.x + texture2D(uRock, vWP.xz * 0.31 + 0.3).rgb * bw.y + texture2D(uRock, vWP.xy * 0.31 + 0.3).rgb * bw.z;
diffuseColor.rgb *= clamp(1.0 + ((rk * 0.6 + rk2 * 0.4) - 0.35) * 1.6, 0.25, 1.6);`);
    };
    m.customProgramCacheKey = () => 'garden-grotto-shell-2';
    return m;
}

// ------------------------------------------------------------------ the pool

const WATER_VERT = 'varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const WATER_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uCentre; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlow;
uniform vec4 uRip[4];
varying vec3 vWP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 p = vWP.xz;
    float r = length(p - uCentre.xy) / uCentre.z;
    float h = 0.0;
    for (int i = 0; i < 4; i++) {
        float age = uTime - uRip[i].z;
        if (age > 0.0 && age < 5.0) {
            float d = length(p - uRip[i].xy) - age * 0.85;
            h += sin(d * 17.0) * exp(-d * d * 7.0) * exp(-age * 0.75) * uRip[i].w;
        }
    }
    float w = sin(p.x * 3.1 + uTime * 0.8 + sin(p.y * 2.3 + uTime * 0.6)) * sin(p.y * 2.7 - uTime * 0.55 + sin(p.x * 1.9 + uTime * 0.3));
    vec3 V = normalize(cameraPosition - vWP);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
    vec3 col = mix(uShallow, uDeep, smoothstep(1.0, 0.1, r));
    col += uGlow * (pow(max(w, 0.0), 5.0) * 0.5 + max(h, 0.0) * 0.9);
    // plankton: sparks that wink on and off
    vec2 cell = floor(p * 9.0);
    float hs = hash(cell);
    float spark = step(0.93, hs) * smoothstep(0.55, 1.0, sin(uTime * (0.8 + hs * 1.7) + hs * 40.0) * 0.5 + 0.5);
    col += uGlow * spark * 0.9 * (1.0 - smoothstep(0.7, 1.0, r));
    col += vec3(0.08, 0.3, 0.34) * fres;
    float edge = smoothstep(0.82, 1.0, r);
    col = mix(col, vec3(0.5, 0.9, 0.85), edge * 0.18 * (0.5 + 0.5 * w));
    gl_FragColor = vec4(col, mix(0.8, 0.97, clamp(fres + r * 0.4, 0.0, 1.0)));
}`;

export function waterMaterial(cx, cz, radius) {
    const rip = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0));
    const m = new THREE.ShaderMaterial({
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uCentre: { value: new THREE.Vector3(cx, cz, radius) },
            uDeep: { value: C('#031a2e') },
            uShallow: { value: C('#0f6f78') },
            uGlow: { value: C('#6dffe0') },
            uRip: { value: rip },
        },
    });
    m.userData.ripples = rip;
    m.userData.next = 0;
    /** A ring spreads out from (x, z). */
    m.userData.ripple = (x, z, t, amp = 1) => {
        const r = rip[m.userData.next++ % 4];
        r.set(x, z, t, amp);
    };
    return m;
}

const FALL_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
    float cols = 14.0;
    float c = floor(vUv.x * cols);
    float speed = 0.9 + hash(c) * 0.9;
    float streak = smoothstep(0.35, 0.9, sin((vUv.y * 5.0 + uTime * speed + hash(c + 4.0) * 20.0) * 3.0) * 0.5 + 0.5);
    float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float fade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float a = (0.22 + 0.5 * streak) * edge * fade;
    gl_FragColor = vec4(vec3(0.55, 1.0, 0.92) * a * 1.4, a);
}`;
export function waterfallMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: FALL_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
    });
}

// ------------------------------------------------------------ points of light

const SPARK_VERT = /* glsl */ `
uniform float uTime; uniform float uScale; uniform float uMove; uniform float uH; uniform float uTwinkle;
attribute vec4 aCol; attribute float aSize; attribute float aSeed;
varying vec4 vCol;
void main() {
    vec3 p = position;
    if (uMove > 0.5) {
        p.y = mod(position.y + uTime * (0.05 + aSeed * 0.12), uH);
        p.x += sin(uTime * (0.2 + aSeed * 0.3) + aSeed * 30.0) * 0.7;
        p.z += cos(uTime * (0.17 + aSeed * 0.25) + aSeed * 21.0) * 0.7;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = mix(1.0, smoothstep(0.1, 1.0, sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 50.0) * 0.5 + 0.5), uTwinkle);
    float fade = uMove > 0.5 ? smoothstep(0.0, 1.5, p.y) * smoothstep(uH, uH - 1.5, p.y) : 1.0;
    vCol = vec4(aCol.rgb, aCol.a * tw * fade);
    gl_PointSize = aSize * 0.01 * uScale / max(-mv.z, 0.2);
    gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec4 vCol;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)); a *= a;
    if (a * vCol.a < 0.01) discard;
    gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.0);
}`;

/** Additive soft dots. Attributes: position, aCol (rgb + alpha), aSize (the dot's width in centimetres), aSeed. */
export function sparkMaterial({ move = 0, height = 8, twinkle = 0 } = {}) {
    return new THREE.ShaderMaterial({
        vertexShader: SPARK_VERT,
        fragmentShader: SPARK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uMove: { value: move }, uH: { value: height }, uTwinkle: { value: twinkle } },
    });
}

/** A points object from lists: [{ x, y, z, r, g, b, a, size, seed }]. */
export function sparkPoints(list, material) {
    const n = list.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n), seed = new Float32Array(n);
    list.forEach((s, i) => {
        pos.set([s.x, s.y, s.z], i * 3);
        col.set([s.r, s.g, s.b, s.a ?? 1], i * 4);
        size[i] = s.size ?? 12;
        seed[i] = s.seed ?? Math.random();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const p = new THREE.Points(g, material);
    p.frustumCulled = false;
    return p;
}

// ----------------------------------------------------------------- textures

/** Courses of old brick, damp and furred with moss towards the bottom: the shaft's lining. */
export function brickTexture() {
    const w = 256, h = 512;
    const c = canvas(w, h);
    const g = c.getContext('2d');
    g.fillStyle = '#1b201f';
    g.fillRect(0, 0, w, h);
    const rows = 16, rh = h / rows;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < rows; r++) {
        const n = 6;
        const bw = w / n;
        const off = r % 2 ? bw / 2 : 0;
        for (let k = -1; k <= n; k++) {
            const t = 0.38 + rnd() * 0.22;
            g.fillStyle = `rgb(${Math.round(110 * t + 30)}, ${Math.round(118 * t + 30)}, ${Math.round(112 * t + 30)})`;
            g.fillRect(k * bw + off + 2, r * rh + 2, bw - 4, rh - 4);
            // moss creeps up from the foot of each course
            g.fillStyle = `rgba(70, ${150 + Math.round(rnd() * 60)}, 90, ${0.12 + rnd() * 0.22})`;
            g.fillRect(k * bw + off + 2, r * rh + rh * 0.5, bw - 4, rh * 0.5 - 2);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A column of light: bright down the middle, soft at the sides and the ends. */
export function beamTexture() {
    const c = canvas(64, 128);
    const g = c.getContext('2d');
    const img = g.createImageData(64, 128);
    for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 64; x++) {
            const u = Math.abs(x / 63 - 0.5) * 2;
            const a = Math.pow(1 - u, 1.6) * Math.min(1, y / 20) * Math.min(1, (127 - y) / 40);
            const k = (y * 64 + x) * 4;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
            img.data[k + 3] = a * 255;
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A canvas disc of mottled lichen: pale bloom, darker rim, speckles. */
export function lichenTexture(hex) {
    const n = 128;
    const c = canvas(n);
    const g = c.getContext('2d');
    const col = new THREE.Color(hex);
    const rgb = (k, a = 1) => `rgba(${Math.round(col.r * 255 * k)}, ${Math.round(col.g * 255 * k)}, ${Math.round(col.b * 255 * k)}, ${a})`;
    const gr = g.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n / 2);
    gr.addColorStop(0, rgb(1, 1));
    gr.addColorStop(0.55, rgb(0.8, 0.85));
    gr.addColorStop(1, rgb(0.4, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * n * 0.42;
        g.fillStyle = rnd() < 0.5 ? rgb(1.25, 0.8) : rgb(0.5, 0.5);
        g.beginPath();
        g.arc(n / 2 + Math.cos(a) * d, n / 2 + Math.sin(a) * d, 1.5 + rnd() * 4, 0, Math.PI * 2);
        g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
