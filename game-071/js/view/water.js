/**
 * water.js — the Hrimsea, the lakes and the Brightrun.
 *
 * One shader: two scrolling normal maps (rivers scroll along their flow), Fresnel reflection of
 * the sky texture, a sun glitter highlight, and depth read from the terrain height texture for
 * colour absorption, transparency over the shallows and foam at the shore.
 */
import * as THREE from 'three';
import { WORLD } from '../sim/geography.js';
import { G, GLSL_NOISE, GLSL_SKY, sharedUniforms } from './shaders.js';
import { makeWaterNormal } from './textures.js';

export const GLSL_HEIGHT = /* glsl */`
uniform sampler2D uHeight; uniform float uHN; uniform float uHalfW; uniform float uCell;
float terrainH(vec2 xz) {
    vec2 g = (xz + uHalfW) / uCell;
    g = clamp(g, vec2(0.0), vec2(uHN - 1.001));
    vec2 i = floor(g), f = g - i;
    float h00 = texelFetch(uHeight, ivec2(i), 0).r, h10 = texelFetch(uHeight, ivec2(i) + ivec2(1, 0), 0).r;
    float h01 = texelFetch(uHeight, ivec2(i) + ivec2(0, 1), 0).r, h11 = texelFetch(uHeight, ivec2(i) + ivec2(1, 1), 0).r;
    return f.x > f.y ? h00 + (h10 - h00) * f.x + (h11 - h10) * f.y : h00 + (h11 - h01) * f.x + (h01 - h00) * f.y;
}
`;

export function makeHeightTexture(terrain) {
    const t = new THREE.DataTexture(terrain.h, terrain.N, terrain.N, THREE.RedFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
}

export function heightUniforms(hTex, terrain) {
    return { uHeight: { value: hTex }, uHN: { value: terrain.N }, uHalfW: { value: WORLD.HALF }, uCell: { value: WORLD.CELL } };
}

const vert = /* glsl */`
uniform float uTime; uniform float uWaves;
attribute float flow;
varying vec3 vW; varying vec2 vFlowUv; varying float vFlow;
#include <fog_pars_vertex>
void main() {
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    if (uWaves > 0.0) {
        float d = length(w.xz - cameraPosition.xz);
        float k = uWaves * (1.0 - smoothstep(60.0, 400.0, d));
        w.y += (sin(w.x * 0.08 + uTime * 1.1) * 0.35 + sin(w.z * 0.11 - uTime * 0.9) * 0.25 + sin((w.x + w.z) * 0.05 + uTime * 0.6) * 0.4) * k;
    }
    vW = w.xyz;
    vFlowUv = uv;
    vFlow = flow;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform float uTime; uniform sampler2D uNormal; uniform vec3 uSunCol;
uniform vec3 uDeep; uniform vec3 uShallow; uniform float uLevel; uniform float uRiver; uniform float uIce; uniform float uNight;
varying vec3 vW; varying vec2 vFlowUv; varying float vFlow;
${GLSL_NOISE}
#include <fog_pars_fragment>
${'' /* skyLookup comes with the fog chunk */}
${'' /* terrain height */}
HEIGHT_CHUNK
void main() {
    vec3 V = normalize(cameraPosition - vW);
    float dist = length(cameraPosition - vW);
    vec2 uv1, uv2;
    if (uRiver > 0.5) {
        uv1 = vec2(vFlowUv.x * 0.25, vFlowUv.y * 0.08 - uTime * 0.35 * vFlow);
        uv2 = vec2(vFlowUv.x * 0.6 + 0.3, vFlowUv.y * 0.2 - uTime * 0.6 * vFlow);
    } else {
        uv1 = vW.xz * 0.032 + uTime * vec2(0.012, 0.008);
        uv2 = vW.xz * 0.095 - uTime * vec2(0.01, -0.021);
    }
    vec3 n1 = texture2D(uNormal, uv1).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormal, uv2).xyz * 2.0 - 1.0;
    float calm = mix(1.0, 0.35, smoothstep(40.0, 600.0, dist));
    vec3 N = normalize(vec3((n1.x + n2.x * 0.6) * calm, 2.2, (n1.y + n2.y * 0.6) * calm));
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.02 + 0.98 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
    vec3 R = reflect(-V, N);
    vec3 refl = skyLookup(vec3(R.x, max(R.y, 0.02), R.z));
    float depth = max(uLevel - terrainH(vW.xz), 0.0);
    float absorb = 1.0 - exp(-depth * 0.22);
    float lightAmt = clamp(uSunCol.r * 0.35 + 0.08, 0.02, 1.4);
    vec3 body = mix(uShallow, uDeep, absorb) * lightAmt;
    // sun glitter
    float spec = pow(max(dot(R, uSunDir), 0.0), 380.0) * 6.0 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.12;
    vec3 col = mix(body, refl, fres) + uSunCol * spec;
    // foam at the shore and on river riffles
    float foamN = vnoise(vW.xz * 0.9 + uTime * 0.4) * vnoise(vW.xz * 0.23 - uTime * 0.15);
    float shore = smoothstep(0.9, 0.0, depth) * smoothstep(0.15, 0.55, foamN + 0.25 * sin(depth * 9.0 - uTime * 2.0));
    float riffle = uRiver * smoothstep(0.62, 0.8, foamN) * 0.6;
    col = mix(col, vec3(0.85, 0.9, 0.95) * (lightAmt + 0.1), clamp(shore + riffle, 0.0, 1.0) * 0.85);
    // sea ice in the frozen north
    if (uIce > 0.0) {
        float ice = smoothstep(0.55, 0.62, fbm2(vW.xz * 0.012)) * uIce;
        col = mix(col, vec3(0.75, 0.82, 0.9) * (lightAmt + 0.15), ice);
        fres = mix(fres, 1.0, ice);
    }
    float alpha = clamp(max(smoothstep(0.0, 3.5, depth) * 0.9 + 0.08, fres), 0.0, 1.0);
    alpha = max(alpha, shore * 0.9);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
}`;

export class WaterView {
    constructor(scene, terrain, hTex) {
        this.scene = scene;
        this.normal = makeWaterNormal(256);
        const hU = heightUniforms(hTex, terrain);
        const mk = (level, opts = {}) => new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag.replace('HEIGHT_CHUNK', GLSL_HEIGHT),
            uniforms: sharedUniforms({
                ...hU, uNormal: { value: this.normal }, uLevel: { value: level },
                uDeep: { value: new THREE.Color(opts.deep || 0x0b2633) }, uShallow: { value: new THREE.Color(opts.shallow || 0x2f6b6a) },
                uRiver: { value: opts.river ? 1 : 0 }, uWaves: { value: opts.waves || 0 }, uIce: { value: opts.ice || 0 },
            }),
            transparent: true, depthWrite: false, fog: true,
        });
        this.group = new THREE.Group();
        scene.add(this.group);
        // the sea: a big grid that follows the camera
        const seaGeo = new THREE.PlaneGeometry(9000, 9000, 120, 120).rotateX(-Math.PI / 2);
        seaGeo.setAttribute('flow', new THREE.BufferAttribute(new Float32Array(seaGeo.attributes.position.count), 1));
        this.sea = new THREE.Mesh(seaGeo, mk(0, { deep: 0x08202c, shallow: 0x2a5f66, waves: 1, ice: 0.6 }));
        this.sea.frustumCulled = false;
        this.sea.renderOrder = 2;
        this.group.add(this.sea);
        // lakes
        for (const lk of terrain.lakes) {
            const g = new THREE.CircleGeometry(lk.r * 1.25, 64).rotateX(-Math.PI / 2);
            g.setAttribute('flow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
            const m = new THREE.Mesh(g, mk(lk.level, { deep: 0x0d2a30, shallow: 0x356b62 }));
            m.position.set(lk.x, lk.level, lk.z);
            m.renderOrder = 2;
            this.group.add(m);
        }
        // rivers: ribbons along the course, each vertex at the local water line
        for (const rv of terrain.rivers) {
            const pts = rv.pts, n = pts.length;
            const half = rv.w / 2 + 2.5;
            const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), flow = new Float32Array(n * 2);
            let acc = 0;
            for (let k = 0; k < n; k++) {
                const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
                let dx = b[0] - a[0], dz = b[1] - a[1];
                const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
                if (k > 0) acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
                const slope = k > 0 ? Math.max(0, pts[k - 1][2] - pts[k][2]) : 0;
                for (let s = 0; s < 2; s++) {
                    const side = s ? 1 : -1;
                    const o = (k * 2 + s);
                    pos[o * 3] = pts[k][0] - dz * half * side;
                    pos[o * 3 + 1] = pts[k][2] + 0.05;
                    pos[o * 3 + 2] = pts[k][1] + dx * half * side;
                    uv[o * 2] = s * rv.w / 4; uv[o * 2 + 1] = acc / 4;
                    flow[o] = 0.6 + Math.min(2, slope * 6);
                }
            }
            const idx = [];
            for (let k = 0; k < n - 1; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            g.setAttribute('flow', new THREE.BufferAttribute(flow, 1));
            g.setIndex(idx);
            g.computeBoundingSphere();
            // the river's "level" varies along it, so depth uses its own height: pass a large level and rely on y
            const m = mk(0, { river: true, deep: 0x123a3c, shallow: 0x3d7466 });
            m.fragmentShader = m.fragmentShader.replace('float depth = max(uLevel - terrainH(vW.xz), 0.0);', 'float depth = max(vW.y - terrainH(vW.xz), 0.0);');
            const mesh = new THREE.Mesh(g, m);
            mesh.renderOrder = 2;
            this.group.add(mesh);
        }
    }

    update(cam) {
        this.sea.position.set(Math.round(cam.x / 75) * 75, 0, Math.round(cam.z / 75) * 75);
    }
}
