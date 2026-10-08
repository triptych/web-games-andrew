/**
 * grass.js — GPU grass around the camera.
 *
 * Two rings of instanced blade clumps on fixed grids that snap to the camera. Each clump's
 * world position, ground height, density, colour and size come from the terrain textures in the
 * vertex shader, so the CPU only moves one uniform per frame. Blades bend with the wind and lean
 * away from the player's feet; a few carry flowers.
 */
import * as THREE from 'three';
import { WORLD } from '../sim/geography.js';
import { G, GLSL_NOISE, sharedUniforms } from './shaders.js';
import { GLSL_HEIGHT, heightUniforms } from './water.js';
import { mulberry32 } from '../sim/rng.js';

function clumpGeometry(blades, segs, rnd) {
    const pos = [], data = [], idx = [];
    for (let b = 0; b < blades; b++) {
        const ox = (rnd() - 0.5) * 0.45, oz = (rnd() - 0.5) * 0.45, ang = rnd() * Math.PI, lean = 0.2 + rnd() * 0.6, hs = 0.6 + rnd() * 0.6;
        const base = pos.length / 3;
        for (let s = 0; s <= segs; s++) {
            const t = s / segs;
            const w = 0.5 * (1 - t * 0.92);
            pos.push(-w, t, 0, w, t, 0);
            data.push(ox, oz, ang, lean * hs, ox, oz, ang, lean * hs);
        }
        for (let s = 0; s < segs; s++) {
            const a = base + s * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('blade', new THREE.Float32BufferAttribute(data, 4));
    g.setIndex(idx);
    return g;
}

const vert = /* glsl */`
attribute vec4 blade;
attribute vec2 aOff;
uniform vec2 uOrigin; uniform float uSpacing; uniform float uRadius; uniform float uInner; uniform float uWidth; uniform float uBladeH;
uniform sampler2D uMasks; uniform sampler2D uTintG; uniform float uWorld; uniform float uHalf;
uniform float uTime; uniform vec2 uWind; uniform vec3 uPlayer;
varying vec3 vCol; varying float vT; varying vec3 vW; varying float vFlower; varying vec3 vNrm;
${GLSL_NOISE}
HEIGHT_CHUNK
#include <fog_pars_vertex>
void main() {
    vec2 cell = uOrigin + aOff;
    vec2 jit = hash22(floor(cell * 7.31) + 0.5) - 0.5;
    vec2 c = cell + jit * uSpacing;
    vec2 wuv = (c + uHalf) / uWorld;
    vec4 M = texture2D(uMasks, wuv);
    float dens = M.r * (1.0 - M.g * 1.5) * (1.0 - M.b * 1.3) * (1.0 - M.a * 0.6);
    float d = distance(c, cameraPosition.xz);
    float fade = 1.0 - smoothstep(uRadius * 0.62, uRadius, d);
    if (uInner > 0.0) fade *= smoothstep(uInner - 2.0, uInner + 1.0, d);   // the outer ring leaves the inner ring alone
    float r = hash12(c * 3.17);
    float keep = step(r, dens * 1.15);
    float h = (uBladeH * (0.55 + 0.6 * hash12(c * 1.7)) * (0.45 + dens * 0.7)) * fade * keep;
    // blade frame
    vec2 bp = c + blade.xy * uSpacing * 1.6;
    float ang = blade.z + hash12(c) * 6.283;
    vec2 dir = vec2(cos(ang), sin(ang));
    float t = position.y;
    vT = t;
    // bend: lean + wind gust + push away from the player
    float gust = vnoise(bp * 0.08 + uTime * 0.6 * normalize(uWind + 1e-4)) * 1.2 + 0.2;
    vec2 bend = dir.yx * vec2(1.0, -1.0) * blade.w * 0.35 + uWind * gust * 0.45;
    vec2 away = bp - uPlayer.xz;
    float pd = length(away);
    bend += normalize(away + 1e-4) * smoothstep(1.4, 0.2, pd) * 1.4 * step(abs(uPlayer.y - terrainH(bp)), 2.0);
    vec3 p = vec3(bp.x, terrainH(bp), bp.y);
    vec2 side = dir * position.x * uWidth;
    p.xz += side;
    float tt = t * t;
    p.xz += bend * tt * h;
    p.y += t * h * (1.0 - 0.25 * min(1.0, length(bend)) * tt);
    vW = p;
    vec3 tint = texture2D(uTintG, wuv).rgb * 2.0;
    float v = hash12(c * 5.3);
    vCol = tint * mix(vec3(0.42, 0.5, 0.26), vec3(0.62, 0.66, 0.36), v);
    vCol *= mix(0.55, 1.0, M.r) * (1.0 - M.a * 0.45);
    vFlower = step(0.965, hash12(c * 9.1)) * step(0.5, t) * keep;
    vNrm = normalize(vec3(-dir.y, 0.6, dir.x) + vec3(bend.x, 0.0, bend.y) * 0.3);
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    if (h < 0.02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // culled clumps collapse off-screen
    #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform vec3 uSunCol; uniform float uNight; uniform float uTime;
varying vec3 vCol; varying float vT; varying vec3 vW; varying float vFlower; varying vec3 vNrm;
${GLSL_NOISE}
#include <fog_pars_fragment>
void main() {
    vec3 col = vCol * mix(0.35, 1.15, vT);            // dark at the root, bright at the tip
    if (vFlower > 0.5 && vT > 0.82) {
        float k = hash12(floor(vW.xz * 3.0));
        col = k < 0.33 ? vec3(0.75, 0.35, 0.85) : k < 0.66 ? vec3(0.95, 0.9, 0.55) : vec3(0.92, 0.92, 0.95);
    }
    vec3 N = normalize(gl_FrontFacing ? vNrm : vec3(-vNrm.x, vNrm.y, -vNrm.z));
    vec3 L = uSunDir;
    float diff = max(dot(N, L), 0.0) * 0.6 + 0.4;
    vec3 V = normalize(cameraPosition - vW);
    float trans = pow(max(dot(-V, L), 0.0), 3.0) * vT * 0.6;
    vec3 sky = skyLookup(vec3(0.0, 1.0, 0.0)) * 1.4 + vec3(0.02);
    vec3 lit = col * (uSunCol * (diff * 0.36 + trans) + sky);
    gl_FragColor = vec4(lit, 1.0);
    #include <fog_fragment>
}`;

export class GrassView {
    constructor(scene, terrain, hTex, maps) {
        this.scene = scene;
        this.terrain = terrain;
        this.hTex = hTex;
        this.maps = maps;
        this.meshes = [];
    }

    build(q) {
        for (const m of this.meshes) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
        this.meshes = [];
        const rnd = mulberry32(99);
        const R = q.grass, dens = q.grassDensity;
        const rings = [
            { inner: 0, radius: Math.min(22, R * 0.5), spacing: 0.55 / Math.sqrt(dens), blades: 5, segs: 3 },
            { inner: Math.min(22, R * 0.5), radius: R, spacing: 1.15 / Math.sqrt(dens), blades: 3, segs: 2 },
        ];
        for (const ring of rings) {
            const geo = clumpGeometry(ring.blades, ring.segs, rnd);
            const offs = [];
            const n = Math.ceil(ring.radius / ring.spacing);
            for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
                const x = i * ring.spacing, z = j * ring.spacing, d = Math.hypot(x, z);
                if (d <= ring.radius + ring.spacing && d >= ring.inner - ring.spacing * 2) offs.push(x, z);
            }
            geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 2));
            geo.instanceCount = offs.length / 2;
            const mat = new THREE.ShaderMaterial({
                vertexShader: vert.replace('HEIGHT_CHUNK', GLSL_HEIGHT),
                fragmentShader: frag,
                uniforms: sharedUniforms({
                    ...heightUniforms(this.hTex, this.terrain),
                    uOrigin: { value: new THREE.Vector2() }, uSpacing: { value: ring.spacing }, uRadius: { value: ring.radius }, uInner: { value: ring.inner },
                    uWidth: { value: 0.07 }, uBladeH: { value: 0.75 },
                    uMasks: { value: this.maps.masks }, uTintG: { value: this.maps.tintG }, uWorld: { value: WORLD.SIZE }, uHalf: { value: WORLD.HALF },
                }),
                side: THREE.DoubleSide, fog: true,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.userData.spacing = ring.spacing;
            this.scene.add(mesh);
            this.meshes.push(mesh);
        }
        this.tris = this.meshes.reduce((a, m) => a + m.geometry.index.count / 3 * m.geometry.instanceCount, 0);
    }

    update(cam, visible = true) {
        for (const m of this.meshes) {
            m.visible = visible;
            const s = m.userData.spacing;
            m.material.uniforms.uOrigin.value.set(Math.round(cam.x / s) * s, Math.round(cam.z / s) * s);
        }
    }
}
