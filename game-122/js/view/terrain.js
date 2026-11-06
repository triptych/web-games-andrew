// The ground and the waters, built from the very height function the sim walks on.

import * as THREE from 'three';
import { SITES, HILLTOP, segDist } from '../sim/world.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SIZE = 470, SEG = 300;

function hashN(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }

const C = {
    sand: new THREE.Color(0xd9c393), wetsand: new THREE.Color(0xa99470), grass: new THREE.Color(0x6e9a45),
    grass2: new THREE.Color(0x87a64e), wood: new THREE.Color(0x3d5a2a), woodfloor: new THREE.Color(0x4e4a2c),
    fen: new THREE.Color(0x7b7a3c), fenmud: new THREE.Color(0x5c5030), moor: new THREE.Color(0x7d5e70),
    moor2: new THREE.Color(0x8c7a52), rock: new THREE.Color(0x7d786e), darkrock: new THREE.Color(0x524c48),
    curse: new THREE.Color(0x3e3448), flag: new THREE.Color(0x8a857c), path: new THREE.Color(0x9a8160),
    seabed: new THREE.Color(0x4f6a66),
};

export function buildTerrain(W) {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = W.height(x, z);
        pos.setY(i, h);
        const reg = W.regionAt(x, z);
        const slope = W.slopeAt(x, z);
        const n = hashN(Math.floor(x * 0.7), Math.floor(z * 0.7)) * 0.5 + hashN(Math.floor(x * 0.13), Math.floor(z * 0.13)) * 0.5;
        const r = Math.hypot(x, z);
        if (h < -0.3) c.copy(C.seabed).lerp(C.wetsand, ss(-3, -0.3, h));
        else if (h < 1.0) c.copy(C.wetsand).lerp(C.sand, ss(-0.3, 1.0, h));
        else if (h < (reg === 'shore' ? 4.2 : 2.6) && reg !== 'fen') c.copy(C.sand).lerp(C.grass2, reg === 'shore' ? ss(3.0, 4.2, h) : ss(1.6, 2.6, h));
        else if (reg === 'wood') c.copy(C.wood).lerp(C.woodfloor, n);
        else if (reg === 'fen') c.copy(C.fen).lerp(C.fenmud, n);
        else if (reg === 'moor') c.copy(C.moor).lerp(C.moor2, n * 0.8);
        else c.copy(C.grass).lerp(C.grass2, n);
        // the curse bleeds out from the castle
        if (r < 66) c.lerp(C.curse, ss(66, 52, r) * 0.85);
        if (r < 21 && h > HILLTOP - 0.5) c.copy(C.flag).lerp(C.darkrock, n * 0.4);
        // steep ground is bare rock
        if (slope > 0.75) c.lerp(slope > 1.4 ? C.darkrock : C.rock, ss(0.75, 1.3, slope));
        // worn paths
        if (h > 1.2 && W.nearRoad(x, z, 2.2)) c.lerp(C.path, 0.55 * (1 - ss(1.2, 2.2, Math.min(...W.roadSegs.map((s) => segDist(x, z, s[0], s[1], s[2], s[3]))))));
        // the hut's yard, trodden
        if (Math.abs(x - SITES.hut.x) < 7 && Math.abs(z - SITES.hut.z) < 6) c.lerp(C.path, 0.35);
        const v = 0.92 + hashN(x * 3.1, z * 2.7) * 0.12;
        col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    // a little procedural grain so close ground isn't flat colour
    mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float th(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
float gr = tn(vWP.xz * 1.7) * 0.6 + tn(vWP.xz * 7.0) * 0.4;
diffuseColor.rgb *= 0.86 + gr * 0.26;`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
}

/** The heights as a texture, so water shaders know how deep they are. */
export function heightTexture(W) {
    const N = 256;
    const data = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i / (N - 1) - 0.5) * SIZE, z = (j / (N - 1) - 0.5) * SIZE;
        data[j * N + i] = W.height(x, z);
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.FloatType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
}

const WATER_VS = `
uniform float uTime, uWave;
varying vec3 vWP;
varying float vFogDepth;
void main() {
    vec3 p = position;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    wp.y += (sin(wp.x * 0.21 + uTime * 1.1) + sin(wp.z * 0.17 - uTime * 0.9)) * uWave;
    vWP = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;
const WATER_FS = `
uniform sampler2D uH;
uniform float uTime, uLevel, uSize, uFoam, uCurse, uBoil;
uniform vec3 uShallow, uDeep, uSky, uSunDir, uSunCol, fogColor;
uniform float fogNear, fogFar;
varying vec3 vWP;
varying float vFogDepth;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
    vec2 uv = vWP.xz / uSize + 0.5;
    float ground = texture2D(uH, uv).r;
    float depth = max(0.0, uLevel - ground);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) depth = 12.0;
    float d = clamp(depth / 5.0, 0.0, 1.0);
    vec3 col = mix(uShallow, uDeep, sqrt(d));
    // ripples: a normal from two moving noise layers
    vec2 q = vWP.xz * 0.35;
    float n1 = vn(q + vec2(uTime * 0.3, uTime * 0.2)), n2 = vn(q * 2.3 - vec2(uTime * 0.25, -uTime * 0.31));
    vec3 nrm = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2, 1.0, (n2 - 0.5) * 0.35 - (n1 - 0.5) * 0.2));
    vec3 view = normalize(cameraPosition - vWP);
    float fres = pow(clamp(1.0 - max(dot(view, nrm), 0.0), 0.0, 1.0), 4.0);
    col = mix(col, uSky, fres * 0.6);
    vec3 hv = normalize(view + uSunDir);
    col += uSunCol * pow(clamp(dot(nrm, hv), 0.0, 1.0), 180.0) * 1.4 * step(0.0, uSunDir.y);
    // foam where it meets the shore
    float f = uFoam * (1.0 - smoothstep(0.0, 0.55, depth)) * (0.55 + 0.45 * sin(uTime * 1.6 - depth * 12.0 + vn(vWP.xz * 0.6) * 6.0));
    col = mix(col, vec3(0.95, 0.97, 1.0), clamp(f, 0.0, 1.0) * 0.8);
    // a cursed sheen
    if (uCurse > 0.0) col += vec3(0.35, 0.08, 0.5) * uCurse * pow(clamp(vn(vWP.xz * 0.25 + uTime * 0.1), 0.0, 1.0), 4.0);
    // boiling: bright bubbles
    if (uBoil > 0.0) col += vec3(1.0, 0.85, 0.55) * uBoil * smoothstep(0.82, 0.95, vn(vWP.xz * 3.0 + vec2(0.0, uTime * 2.0)));
    float a = mix(0.72, 0.95, d);
    float fogF = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(col, fogColor, fogF), a);
}`;

export function makeWater(hTex, opts) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uH: { value: hTex }, uTime: { value: 0 }, uLevel: { value: opts.level }, uSize: { value: SIZE },
            uFoam: { value: opts.foam ?? 1 }, uCurse: { value: opts.curse ?? 0 }, uBoil: { value: opts.boil ?? 0 }, uWave: { value: opts.wave ?? 0.08 },
            uShallow: { value: new THREE.Color(opts.shallow) }, uDeep: { value: new THREE.Color(opts.deep) }, uSky: { value: new THREE.Color(0x9fc4e8) },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xffffff) },
            fogColor: { value: new THREE.Color() }, fogNear: { value: 50 }, fogFar: { value: 400 },
        },
        vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
    });
    let geo;
    if (opts.ring) { geo = new THREE.RingGeometry(opts.ring[0], opts.ring[1], 96, 2); geo.rotateX(-Math.PI / 2); }
    else if (opts.r) { geo = new THREE.CircleGeometry(opts.r, 48); geo.rotateX(-Math.PI / 2); }
    else { geo = new THREE.PlaneGeometry(2400, 2400, 120, 120); geo.rotateX(-Math.PI / 2); }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(opts.x || 0, opts.level, opts.z || 0);
    m.renderOrder = 1;
    return m;
}

export function buildWaters(W) {
    const hTex = heightTexture(W);
    const S = SITES;
    const list = [
        makeWater(hTex, { level: 0, shallow: 0x3fb5b0, deep: 0x163e66, wave: 0.12 }),
        makeWater(hTex, { level: S.moat.level, ring: [S.moat.inner - 1, S.moat.outer + 1], shallow: 0x1a1022, deep: 0x07040c, curse: 1, foam: 0.25, wave: 0.02 }),
        makeWater(hTex, { level: S.mere.level, x: S.mere.x, z: S.mere.z, r: S.mere.r + 1, shallow: 0x4f8a6a, deep: 0x163a32, foam: 0.35, wave: 0.02 }),
        makeWater(hTex, { level: S.pool.level, x: S.pool.x, z: S.pool.z, r: S.pool.r + 1, shallow: 0x8bd6c4, deep: 0x1f7a86, boil: 1, foam: 0.5, wave: 0.04 }),
        makeWater(hTex, { level: S.spring.level, x: S.spring.x, z: S.spring.z, r: S.spring.r + 1, shallow: 0xa6e2d6, deep: 0x4cb0b2, foam: 0.4, wave: 0.01 }),
    ];
    return { hTex, list };
}

export function updateWaters(waters, stage, time) {
    const k = stage.key;
    for (const w of waters.list) {
        const u = w.material.uniforms;
        u.uTime.value = time;
        u.uSunDir.value.copy(stage.sunDir);
        u.uSunCol.value.copy(stage.sun.color).multiplyScalar(stage.night ? 0.2 : 1);
        u.uSky.value.copy(k.hor).lerp(k.zen, 0.4);
        u.fogColor.value.copy(stage.scene.fog.color);
        u.fogNear.value = stage.scene.fog.near; u.fogFar.value = stage.scene.fog.far;
    }
}
