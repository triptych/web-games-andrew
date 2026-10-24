// The galaxy inside the hut's glass sphere: a spiral of a hundred thousand
// suns, drifting nebula wisps in every colour, ribbons of light and a distant
// star shell. Its own scene, drawn by the garden's composer so it blooms.

import * as THREE from 'three';
import { canvas, glowSprite } from './textures.js';
import { rng, fbm2, TAU } from './util.js';

const ARMS = 4;
const STARS = 64000;
const ARM_COLORS = ['#ff4f9a', '#2fd0ff', '#ffa83a', '#8a5cff'];

// the palette every layer draws from
const PALETTE = ['#ff5fa8', '#7a5cff', '#37d5ff', '#ffb347', '#59ffc2', '#c77dff', '#ff7e5f'];

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
}`;

// colourful domain-warped fbm on the view direction: soft whisps of colour
const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
    return s;
}
void main() {
    vec3 d = normalize(vDir);
    float t = uTime * 0.02;
    vec3 q = d * 2.2;
    vec3 w = vec3(fbm(q + vec3(0.0, t, 0.0)), fbm(q + vec3(5.2, 1.3, t)), fbm(q + vec3(t, 8.1, 2.4)));
    float n = fbm(q + 2.2 * w);
    float ridge = 1.0 - abs(2.0 * fbm(q * 1.3 + w * 1.6 + 7.0) - 1.0);
    vec3 a = vec3(0.95, 0.20, 0.55);
    vec3 b = vec3(0.30, 0.25, 1.00);
    vec3 c = vec3(0.10, 0.80, 0.95);
    vec3 e = vec3(1.00, 0.62, 0.20);
    vec3 col = mix(a, b, smoothstep(0.25, 0.75, w.x));
    col = mix(col, c, smoothstep(0.35, 0.8, w.y) * 0.8);
    col = mix(col, e, smoothstep(0.55, 0.9, w.z) * 0.55);
    float density = smoothstep(0.38, 0.85, n) * (0.35 + 0.9 * pow(ridge, 3.0));
    vec3 outc = col * density * 0.85 + vec3(0.004, 0.003, 0.012);
    gl_FragColor = vec4(outc, 1.0);
}`;

const STAR_VERT = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
    vColor = aColor * (0.75 + 0.25 * sin(uTime * 1.7 + aPhase));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 26.0);
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p) * 2.0;
    float a = pow(max(0.0, 1.0 - r), 2.2);
    gl_FragColor = vec4(vColor * a * 0.8, a);
}`;

const RIBBON_VERT = /* glsl */ `
varying vec2 vUv;
varying float vFacing;
void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFacing = abs(normalize(normalMatrix * normal).z);
    gl_Position = projectionMatrix * mv;
}`;
const RIBBON_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uSeed;
varying vec2 vUv;
varying float vFacing;
void main() {
    float core = pow(vFacing, 2.5);
    float flow = 0.5 + 0.5 * sin(vUv.x * 18.0 - uTime * 0.9 + uSeed * 6.0);
    float fade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float a = core * (0.25 + 0.75 * flow) * fade;
    gl_FragColor = vec4(uColor * a * 1.7, a);
}`;

/** A soft, many-lobed cloud on a canvas, tinted white so sprites can colour it. */
function cloudTexture(seed) {
    const n = 256, c = canvas(n), ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const u = (x / n - 0.5) * 2, v = (y / n - 0.5) * 2;
        const r = Math.hypot(u, v);
        const f = fbm2(x * 0.022 + seed * 31, y * 0.022 + seed * 7, 5) * 0.5 + 0.5;
        const a = Math.max(0, 1 - r) ** 1.6 * Math.min(1, f * f * 2.6);
        const k = (y * n + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.min(255, a * 255);
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Galaxy {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x02010a);
        this.time = 0;
        this.uniforms = { uTime: { value: 0 }, uScale: { value: 600 } };
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this._dome();
        this._spiral();
        this._shell();
        this._clouds();
        this._ribbons();
        this._motes();
    }

    _dome() {
        const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, side: THREE.BackSide, depthWrite: false });
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), mat);
        this.dome.frustumCulled = false;
        this.scene.add(this.dome);
    }

    _starMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
    }

    /** The great spiral: logarithmic arms, a hot bulge, and a halo of strays. */
    _spiral() {
        const r = rng('hut-galaxy');
        const pos = new Float32Array(STARS * 3), col = new Float32Array(STARS * 3), size = new Float32Array(STARS), phase = new Float32Array(STARS);
        const core = new THREE.Color('#ffd9a0'), mid = new THREE.Color('#ff6fb5'), edge = new THREE.Color('#4a7dff'), tmp = new THREE.Color();
        const R = 120;
        for (let i = 0; i < STARS; i++) {
            const bulge = r() < 0.22;
            let x, y, z, t, arm = 0;
            if (bulge) {
                const d = Math.pow(r(), 2.2) * R * 0.28;
                const u = r() * TAU, v = Math.acos(2 * r() - 1);
                x = Math.sin(v) * Math.cos(u) * d; y = Math.cos(v) * d * 0.55; z = Math.sin(v) * Math.sin(u) * d;
                t = d / R;
            } else {
                t = Math.pow(r(), 0.7);
                const d = t * R;
                arm = Math.floor(r() * ARMS);
                const a = (arm / ARMS) * TAU + t * 5.2 + (r() - 0.5) * (0.55 + (1 - t) * 0.5) * (0.3 + r());
                const spread = (r() - 0.5) * (2 + t * 9) * (r() < 0.2 ? 2.4 : 1);
                x = Math.cos(a) * d + spread * 0.4 * (r() - 0.5);
                z = Math.sin(a) * d + spread * 0.4 * (r() - 0.5);
                y = (r() - 0.5) * (3 + 7 * (1 - t)) * (0.4 + r());
            }
            pos.set([x, y, z], i * 3);
            // each arm has its own hue, fading from a warm core out to deep blue-violet
            mid.set(ARM_COLORS[arm]);
            if (t < 0.25) tmp.copy(core).lerp(mid, t / 0.25);
            else tmp.copy(mid).lerp(edge, Math.min(1, (t - 0.3) / 0.7));
            if (r() < 0.3) tmp.set(r.pick(PALETTE));
            const bright = (bulge ? 0.2 : 0.3) + r() * 0.6;
            col.set([tmp.r * bright, tmp.g * bright, tmp.b * bright], i * 3);
            size[i] = bulge ? 1.6 + r() * 2.2 : 1.2 + Math.pow(r(), 3) * 5;
            phase[i] = r() * TAU;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        this.spiral = new THREE.Points(g, this._starMaterial());
        this.spiral.frustumCulled = false;
        this.root.add(this.spiral);
        this.disc = new THREE.Group(); // the cloud wisps turn with the spiral
        this.root.add(this.disc);
    }

    /** Far background stars on a shell. */
    _shell() {
        const r = rng('hut-shell'), n = 5200;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
            const u = r() * TAU, v = Math.acos(2 * r() - 1), d = 500 + r() * 300;
            pos.set([Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d, Math.sin(v) * Math.sin(u) * d], i * 3);
            c.setHSL(r() < 0.5 ? 0.6 : r(), 0.5 + r() * 0.4, 0.7 + r() * 0.3);
            const b = 0.4 + Math.pow(r(), 2) * 1.2;
            col.set([c.r * b, c.g * b, c.b * b], i * 3);
            size[i] = 2 + Math.pow(r(), 4) * 9;
            phase[i] = r() * TAU;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        const p = new THREE.Points(g, this._starMaterial());
        p.frustumCulled = false;
        this.scene.add(p);
    }

    /** Big soft coloured clouds lying in the disc and drifting overhead. */
    _clouds() {
        const r = rng('hut-clouds');
        const tex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
        this.clouds = [];
        for (let i = 0; i < 46; i++) {
            const a = r() * TAU, d = 12 + Math.pow(r(), 0.8) * 110;
            const mat = new THREE.SpriteMaterial({
                map: tex[i % 3], color: new THREE.Color(r.pick(PALETTE)), transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, opacity: 0.1 + r() * 0.16, rotation: r() * TAU,
            });
            const s = new THREE.Sprite(mat);
            const sc = 30 + r() * 70;
            s.scale.set(sc, sc, 1);
            s.position.set(Math.cos(a) * d, (r() - 0.5) * 24, Math.sin(a) * d);
            s.userData = { spin: (r() - 0.5) * 0.04, base: mat.opacity, phase: r() * TAU };
            this.disc.add(s);
            this.clouds.push(s);
        }
        // a hot glow at the heart
        const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffc080, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
        heart.scale.set(34, 34, 1);
        this.root.add(heart);
        this.heart = heart;
    }

    /** Slow curving ribbons of light that weave through the arms. */
    _ribbons() {
        const r = rng('hut-ribbons');
        this.ribbons = [];
        for (let i = 0; i < 12; i++) {
            const a0 = r() * TAU, d0 = 20 + r() * 60;
            const pts = [];
            for (let k = 0; k < 9; k++) {
                const a = a0 + k * (0.34 + r() * 0.1) * (i % 2 ? 1 : -1);
                const d = d0 + k * (6 + r() * 5) + Math.sin(k) * 6;
                pts.push(new THREE.Vector3(Math.cos(a) * d, (r() - 0.5) * 22 + Math.sin(k * 0.8 + i) * 6, Math.sin(a) * d));
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const geo = new THREE.TubeGeometry(curve, 160, 0.9 + r() * 1.2, 5, false);
            const mat = new THREE.ShaderMaterial({
                uniforms: { uTime: this.uniforms.uTime, uColor: { value: new THREE.Color(r.pick(PALETTE)) }, uSeed: { value: r() } },
                vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            });
            const m = new THREE.Mesh(geo, mat);
            m.frustumCulled = false;
            this.disc.add(m);
            this.ribbons.push(m);
        }
    }

    /** Dust and glimmers close to the viewer, for depth and parallax. */
    _motes() {
        const r = rng('hut-motes'), n = 900;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
            const u = r() * TAU, v = Math.acos(2 * r() - 1), d = 6 + r() * 40;
            pos.set([Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d * 0.7, Math.sin(v) * Math.sin(u) * d], i * 3);
            c.set(r.pick(PALETTE)).lerp(new THREE.Color(1, 1, 1), 0.35);
            col.set([c.r * 0.9, c.g * 0.9, c.b * 0.9], i * 3);
            size[i] = 0.5 + r() * 1.4;
            phase[i] = r() * TAU;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        this.motes = new THREE.Points(g, this._starMaterial());
        this.motes.frustumCulled = false;
        this.scene.add(this.motes);
    }

    /**
     * Drift the camera through the arms. `look` is the pointer in [-1, 1] and `age` the
     * seconds spent in here, which eases the first moments.
     */
    update(dt, camera, look, viewportH, age) {
        this.time += dt;
        const t = this.time;
        this.uniforms.uTime.value = t;
        this.uniforms.uScale.value = viewportH * 0.9;
        this.spiral.rotation.y = t * 0.012;
        this.disc.rotation.y = t * 0.012;
        for (const s of this.clouds) {
            s.material.rotation += s.userData.spin * dt;
            s.material.opacity = s.userData.base * (0.8 + 0.2 * Math.sin(t * 0.3 + s.userData.phase));
        }
        this.heart.material.opacity = 0.5 + 0.1 * Math.sin(t * 0.8);
        // a slow orbit above the plane, drifting inward and out again
        const ease = Math.min(1, age / 3);
        const ang = t * 0.035 + 0.6;
        const rad = 78 + Math.sin(t * 0.05) * 22;
        const h = 20 + Math.sin(t * 0.07 + 1) * 9;
        camera.position.set(Math.cos(ang) * rad, h, Math.sin(ang) * rad);
        camera.lookAt(0, -2, 0);
        // the pointer leans the view a little
        camera.rotateY(-look.x * 0.28 * ease);
        camera.rotateX(look.y * 0.18 * ease);
        camera.rotateZ(Math.sin(t * 0.11) * 0.04);
    }
}
