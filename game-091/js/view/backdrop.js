// The sky: one full-screen shader. A synthwave horizon (striped retro sun, a scrolling neon grid
// floor), a drifting nebula and twinkling stars, with a palette per sector that blends over.

import * as THREE from 'three';

const PALETTES = [
    // The Rust Rings: classic outrun magenta and cyan
    { top: 0x07031a, hor: 0xff3d8b, sunA: 0xffe46b, sunB: 0xff3d9a, grid: 0x2de2e6, neb: 0x1fb5c9, floor: 0x0b0418 },
    // Nebula Reach: violet and pink
    { top: 0x04021a, hor: 0x8a3dff, sunA: 0x7af0ff, sunB: 0xff5ce1, grid: 0xff3dd4, neb: 0x9b4dff, floor: 0x0a0320 },
    // The House: casino gold and red
    { top: 0x120208, hor: 0xff7a1f, sunA: 0xffe066, sunB: 0xff2d4a, grid: 0xffcf3d, neb: 0xff3d3d, floor: 0x140306 },
];

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uHorizon, uCalm, uSunX;
uniform vec2 uRes;
uniform vec3 uTop, uHor, uSunA, uSunB, uGrid, uNeb, uFloor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

void main() {
    float asp = uRes.x / uRes.y;
    vec2 p = vec2((vUv.x - 0.5) * asp, vUv.y);
    float h = uHorizon;
    float time = uTime * (1.0 - uCalm * 0.85);
    vec3 col;
    if (vUv.y >= h) {
        float t = clamp((vUv.y - h) / (1.0 - h), 0.0, 1.0);
        col = mix(uHor, uTop, sqrt(t));
        // nebula
        float n = fbm(p * 2.2 + vec2(time * 0.01, 0.0));
        float n2 = fbm(p * 3.6 - vec2(0.0, time * 0.012) + n * 1.4);
        col += uNeb * smoothstep(0.42, 0.95, n2) * 0.6 * t;
        // stars
        vec2 g = p * 70.0;
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float r = hash(id);
        if (r > 0.955) {
            float tw = 0.65 + 0.35 * sin(time * (1.0 + r * 3.0) + r * 40.0);
            float d = length(f + (vec2(hash(id + 1.3), hash(id + 2.7)) - 0.5) * 0.6);
            col += vec3(1.0, 0.95, 1.0) * smoothstep(0.14, 0.0, d) * tw * smoothstep(0.0, 0.25, t) * 1.2;
        }
        // the retro sun: a disc whose lower half is cut by stripes that thin toward the top
        vec2 sc = vec2(uSunX, h + 0.13);
        float sr = 0.2;
        float sd = length(p - sc);
        float sy = clamp((p.y - (sc.y - sr)) / (2.0 * sr), 0.0, 1.0);
        float gap = smoothstep(0.62, 0.0, sy) * 0.55;
        float band = fract(sy * 11.0 + time * 0.08);
        float lit = (1.0 - step(sr, sd)) * step(gap, band);
        col = mix(col, mix(uSunB, uSunA, sy) * 1.25, lit);
        col += uSunB * 0.45 * exp(-max(sd - sr, 0.0) * 9.0);
    } else {
        // the grid floor, in perspective, scrolling toward you
        float d = max(h - vUv.y, 0.0005);
        float z = 0.06 / d;
        float x = p.x * z * 4.0;
        float zz = z * 3.0 + time * 0.9;
        vec2 gv = vec2(x, zz);
        vec2 w = fwidth(gv) + 1e-4;
        vec2 gl = abs(fract(gv - 0.5) - 0.5) / w;
        float line = 1.0 - clamp(min(gl.x, gl.y), 0.0, 1.0);
        float fade = smoothstep(0.0, 0.18, d);
        col = uFloor + uGrid * line * (0.35 + 0.9 * fade) * fade;
        // haze at the horizon
        col += uHor * exp(-d * 30.0) * 0.8;
    }
    gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class Backdrop {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const u = {
            uTime: { value: 0 }, uHorizon: { value: 0.34 }, uCalm: { value: 0 }, uSunX: { value: 0 },
            uRes: { value: new THREE.Vector2(1, 1) },
        };
        for (const k of ['top', 'hor', 'sunA', 'sunB', 'grid', 'neb', 'floor']) {
            u['u' + k[0].toUpperCase() + k.slice(1)] = { value: new THREE.Color(PALETTES[0][k]) };
        }
        this.u = u;
        this.mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false });
        // one triangle that covers the screen
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
        const mesh = new THREE.Mesh(geo, this.mat);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.sector = 0;
        this.tmp = new THREE.Color();
    }

    setSector(s) { this.sector = Math.max(0, Math.min(PALETTES.length - 1, s)); }

    resize(w, h, horizon, sunX = 0) {
        this.u.uRes.value.set(w, h);
        this.u.uHorizon.value = horizon;
        this.u.uSunX.value = sunX;
    }

    frame(dt, time, calm) {
        this.u.uTime.value = time;
        this.u.uCalm.value = calm ? 1 : 0;
        const P = PALETTES[this.sector];
        const k = 1 - Math.exp(-dt * 2.5);     // blend toward the sector's palette
        for (const key of ['top', 'hor', 'sunA', 'sunB', 'grid', 'neb', 'floor']) {
            this.u['u' + key[0].toUpperCase() + key.slice(1)].value.lerp(this.tmp.set(P[key]), k);
        }
    }
}
