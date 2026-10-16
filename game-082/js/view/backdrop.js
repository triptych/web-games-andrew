// Deep space behind the station: a nebula painted by a noise shader in each zone's colours,
// three layers of twinkling stars, and a couple of slow planets. All generated.

import * as THREE from 'three';
import { W, H } from '../config.js';

const NEBULA = {
    uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(0x061226) },
        uB: { value: new THREE.Color(0x0c3a5a) },
        uC: { value: new THREE.Color(0x1f8fb0) },
        uSeed: { value: 0 },
    },
    vertexShader: /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
uniform float uTime, uSeed;
uniform vec3 uA, uB, uC;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
}
void main() {
    vec2 p = vUv * vec2(3.2, 2.4) + vec2(uSeed * 3.7, uSeed * 1.3);
    float t = uTime * 0.012;
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    float f = fbm(p + 2.2 * q);
    float g = clamp(f * f * 1.6, 0.0, 1.0);
    vec3 col = mix(uA, uB, clamp(f * 1.4, 0.0, 1.0));
    col = mix(col, uC, clamp(g * g * 1.3, 0.0, 1.0) * 0.85);
    // dark dust lanes
    float lane = smoothstep(0.45, 0.75, fbm(p * 1.7 - q * 1.3 + 3.0));
    col *= 1.0 - lane * 0.55;
    // vignette
    vec2 c = vUv - 0.5;
    col *= 1.0 - dot(c, c) * 1.1;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`,
};

const STARS = {
    vertexShader: /* glsl */`
attribute float aSize;
attribute float aPhase;
uniform float uTime;
varying float vTw;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vTw = 0.55 + 0.45 * sin(uTime * (1.5 + aPhase) + aPhase * 17.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
uniform vec3 uColor;
varying float vTw;
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = clamp(1.0 - d * 2.0, 0.0, 1.0);
    a = a * a;
    gl_FragColor = vec4(uColor * (0.6 + vTw * 0.9), a * vTw);
}`,
};

export class Backdrop {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.mat = new THREE.ShaderMaterial({ ...NEBULA, uniforms: THREE.UniformsUtils.clone(NEBULA.uniforms), depthWrite: false });
        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
        this.plane.position.set(W / 2, H / 2, -120);
        this.plane.scale.set(420, 300, 1);
        this.plane.renderOrder = -10;
        this.group.add(this.plane);
        // stars: three depths; parallax comes free from the camera's sway
        this.stars = [];
        let seed = 9;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (const [n, z, size, color] of [[700, -100, 1.6, 0xbfd8ff], [260, -60, 2.2, 0xffffff], [70, -30, 2.8, 0xfff0c0]]) {
            const pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
            const spread = (-z) * 1.9 + 40;
            for (let i = 0; i < n; i++) {
                pos[i * 3] = W / 2 + (rnd() - 0.5) * spread * 1.6;
                pos[i * 3 + 1] = H / 2 + (rnd() - 0.5) * spread * 1.1;
                pos[i * 3 + 2] = z + (rnd() - 0.5) * 8;
                sz[i] = size * (0.4 + rnd());
                ph[i] = rnd() * 6;
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
            g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
            const m = new THREE.ShaderMaterial({ ...STARS, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
            const pts = new THREE.Points(g, m);
            pts.renderOrder = -9;
            this.group.add(pts);
            this.stars.push(pts);
        }
        // planets
        this.planets = [];
        const mk = (r, color, ring, x, y, z) => {
            const g = new THREE.Group();
            const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, emissive: color, emissiveIntensity: 0.06 }));
            g.add(m);
            if (ring) {
                const t = new THREE.Mesh(new THREE.RingGeometry(r * 1.35, r * 2.0, 64), new THREE.MeshBasicMaterial({ color: ring, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
                t.rotation.x = 1.25; t.rotation.y = 0.35;
                g.add(t);
            }
            g.position.set(x, y, z);
            this.group.add(g);
            this.planets.push({ g, m, x, y, spin: 0.02 + r * 0.002 });
        };
        mk(7, 0x6a4ab0, 0xd8c0ff, -14, 30, -70);
        mk(3.2, 0x2a8a9f, null, 52, -2, -50);
        this.sun = new THREE.DirectionalLight(0xfff2e0, 1.4);
        this.sun.position.set(-40, 50, 60);
        this.group.add(this.sun);
        this.target = null;
    }

    /** Fade to a zone's sky (three colours, dark to bright). */
    setTheme(theme, idx, instant = false) {
        this.target = { cols: theme.sky.map((c) => new THREE.Color(c)), seed: (idx * 0.37) % 5 };
        if (instant) {
            const u = this.mat.uniforms;
            u.uA.value.copy(this.target.cols[0]); u.uB.value.copy(this.target.cols[1]); u.uC.value.copy(this.target.cols[2]);
            u.uSeed.value = this.target.seed;
            this.planets[0].m.material.color.copy(this.target.cols[2]).lerp(new THREE.Color(0x8a6ad0), 0.5);
        }
    }

    update(dt, time) {
        const u = this.mat.uniforms;
        u.uTime.value = time;
        for (const s of this.stars) s.material.uniforms.uTime.value = time;
        if (this.target) {
            const k = Math.min(1, dt * 1.5);
            u.uA.value.lerp(this.target.cols[0], k); u.uB.value.lerp(this.target.cols[1], k); u.uC.value.lerp(this.target.cols[2], k);
            u.uSeed.value += (this.target.seed - u.uSeed.value) * k;
        }
        for (const p of this.planets) { p.m.rotation.y += dt * p.spin; p.g.position.x = p.x + Math.sin(time * 0.01) * 3; }
    }
}
