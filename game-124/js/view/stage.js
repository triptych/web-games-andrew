// The stage: renderer, camera, sky, sun and moon, fog, bloom. Time of day drives all of it.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { roundBloom } from '../../../lib/round-bloom.js';

// Key colours through the day. tod 0 is dawn (6 am), 0.5 is dusk, 0.62 is nightfall.
const KEYS = [
    { t: 0.00, zen: 0x34436f, hor: 0xf0a679, fog: 0xc79a86, sun: 0xffb47a, si: 1.1, hemi: 0.55, gnd: 0x4a3d3a },
    { t: 0.08, zen: 0x5687cf, hor: 0xf3d2ad, fog: 0xc9c7c0, sun: 0xffe0b8, si: 2.0, hemi: 0.8, gnd: 0x4f4a3a },
    { t: 0.22, zen: 0x3b7fd8, hor: 0xbfe0f4, fog: 0xb4cfe0, sun: 0xfff6e6, si: 2.7, hemi: 1.0, gnd: 0x535a3e },
    { t: 0.44, zen: 0x4377c8, hor: 0xd6dfe0, fog: 0xc3cfd2, sun: 0xffeccc, si: 2.4, hemi: 0.95, gnd: 0x535a3e },
    { t: 0.53, zen: 0x3c3f7c, hor: 0xf2895a, fog: 0xb98577, sun: 0xff8a4e, si: 1.4, hemi: 0.6, gnd: 0x4a3a3a },
    { t: 0.60, zen: 0x1f2150, hor: 0x8a4c6a, fog: 0x4f3a52, sun: 0xff6a5a, si: 0.35, hemi: 0.35, gnd: 0x2c2632 },
    { t: 0.68, zen: 0x0e1230, hor: 0x29294d, fog: 0x1d2038, sun: 0x9fb6ff, si: 0.55, hemi: 0.28, gnd: 0x1c1c28 },
    { t: 0.86, zen: 0x070a1d, hor: 0x161a36, fog: 0x12162a, sun: 0x9fb6ff, si: 0.6, hemi: 0.25, gnd: 0x16161f },
    { t: 0.97, zen: 0x1e2450, hor: 0x6c5878, fog: 0x4c4560, sun: 0xb0a8ff, si: 0.4, hemi: 0.35, gnd: 0x2a2630 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
function lerpKey(tod) {
    let i = KEYS.length - 1;
    for (let k = 0; k < KEYS.length; k++) if (KEYS[k].t <= tod) i = k;
    const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length];
    const span = ((b.t - a.t) + 1) % 1 || 1;
    const f = (((tod - a.t) + 1) % 1) / span;
    const mix = (ka) => cA.setHex(a[ka]).lerp(cB.setHex(b[ka]), f).clone();
    return { zen: mix('zen'), hor: mix('hor'), fog: mix('fog'), sun: mix('sun'), gnd: mix('gnd'), si: a.si + (b.si - a.si) * f, hemi: a.hemi + (b.hemi - a.hemi) * f };
}

const SKY_VS = `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w;
}`;
const SKY_FS = `
uniform vec3 uZen, uHor, uSunCol, uSunDir, uMoonDir;
uniform float uStars, uTime, uCloud, uCurse;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vn(p) * a; p *= 2.03; a *= 0.5; } return s; }
void main() {
    vec3 d = normalize(vDir);
    float y = clamp(d.y, -1.0, 1.0);
    float up = clamp(y, 0.0, 1.0);
    vec3 col = mix(uHor, uZen, pow(clamp(up, 0.0, 1.0), 0.55));
    if (y < 0.0) col = mix(uHor, uHor * 0.55, clamp(-y * 3.0, 0.0, 1.0));
    // sun: disc and a wide warm glow
    float sd = clamp(dot(d, uSunDir), 0.0, 1.0);
    col += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.12) * step(-0.05, uSunDir.y);
    // moon
    float md = clamp(dot(d, uMoonDir), 0.0, 1.0);
    col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.6 + pow(md, 60.0) * 0.12) * step(0.0, uMoonDir.y);
    // stars
    if (uStars > 0.01 && y > 0.0) {
        vec2 g = d.xz / (d.y + 0.35) * 260.0;
        float s = h21(floor(g));
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
        col += vec3(0.9, 0.92, 1.0) * smoothstep(0.996, 1.0, s) * uStars * tw * smoothstep(0.0, 0.2, y);
        // a faint milky band
        col += vec3(0.25, 0.25, 0.4) * uStars * 0.18 * fbm(g * 0.01 + 3.0) * smoothstep(0.35, 0.0, abs(d.x * 0.7 + d.z * 0.3 - 0.1));
    }
    // clouds on a dome
    if (y > 0.0) {
        vec2 cp = d.xz / (d.y + 0.15) * 2.2 + vec2(uTime * 0.008, uTime * 0.003);
        float c = smoothstep(0.52, 0.85, fbm(cp)) * uCloud * smoothstep(0.0, 0.25, y);
        vec3 cc = mix(uHor * 1.05, vec3(1.0), 0.45) * (0.6 + 0.6 * pow(sd, 6.0));
        col = mix(col, cc, c * 0.75);
    }
    // the curse: a faint violet bruise over the island's heart
    col += vec3(0.25, 0.05, 0.35) * uCurse * pow(clamp(dot(d, normalize(vec3(0.0, 0.15, 1.0))), 0.0, 1.0), 3.0) * 0.0;
    gl_FragColor = vec4(col, 1.0);
}`;

export class Stage {
    constructor(canvas, quality = 'high') {
        this.canvas = canvas;
        this.q = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'high', powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = quality !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 1400);
        this.scene.add(this.camera);
        this.scene.fog = new THREE.Fog(0xb4cfe0, 60, 380);

        this.skyU = {
            uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
            uStars: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.8 }, uCurse: { value: 1 },
        };
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
            uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
        }));
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -10;
        this.scene.add(this.sky);

        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x4a4a3a, 0.9);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
        this.sun.castShadow = this.renderer.shadowMap.enabled;
        const sm = quality === 'high' ? 2048 : 1024;
        this.sun.shadow.mapSize.set(sm, sm);
        const sc = this.sun.shadow.camera;
        sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
        this.sun.shadow.bias = -0.0008;
        this.sun.shadow.normalBias = 0.04;
        this.scene.add(this.sun, this.sun.target);
        this.ambient = new THREE.AmbientLight(0x404060, 0.15);
        this.scene.add(this.ambient);

        this.composer = null;
        if (quality === 'high') {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            // linear HDR before tone mapping: only emissive magic crosses 1.0, sunlit sand must not bloom
            this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 1.05);
            roundBloom(this.bloom);
            this.composer.addPass(this.bloom);
            this.composer.addPass(new OutputPass());
        }
        this.tod = -1;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.q === 'high' ? 1.75 : this.q === 'low' ? 1 : 1.4);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);                    // the canvas CSS size in px: never 100vh
        this.composer?.setPixelRatio(dpr);
        this.composer?.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.fov = w / h > 1.2 ? 68 : w / h > 0.8 ? 74 : 82;
        this.camera.updateProjectionMatrix();
    }

    /** Light, sky and fog for a time of day; `inside` dims the world when you're under a roof. */
    setTime(tod, time, focus, opts = {}) {
        const k = lerpKey(tod);
        const U = this.skyU;
        U.uZen.value.copy(k.zen); U.uHor.value.copy(k.hor); U.uSunCol.value.copy(k.sun);
        U.uTime.value = time;
        // the sun rises in the east (+x), crosses to the south and sets in the west
        const dayF = (tod + 0.02) / 0.62;
        const sunA = Math.PI * Math.min(Math.max(dayF, -0.1), 1.1);
        const sunDir = new THREE.Vector3(Math.cos(sunA), Math.sin(sunA) * 0.9, 0.42).normalize();
        const nf = ((tod - 0.6 + 1) % 1) / 0.42;
        const moonA = Math.PI * Math.min(Math.max(nf, -0.1), 1.1);
        const moonDir = new THREE.Vector3(Math.cos(moonA) * 0.9, Math.sin(moonA) * 0.85, -0.35).normalize();
        U.uSunDir.value.copy(sunDir);
        U.uMoonDir.value.copy(moonDir);
        const night = tod > 0.6 || tod < 0.01;
        U.uStars.value = THREE.MathUtils.smoothstep(tod, 0.56, 0.66) * (1 - THREE.MathUtils.smoothstep(tod, 0.95, 1.0));
        const lightDir = night ? moonDir : sunDir;
        this.sun.color.copy(k.sun);
        this.sun.intensity = k.si * (lightDir.y > 0.02 ? Math.min(1, lightDir.y * 5) : 0.15);
        this.sun.position.set(focus.x + lightDir.x * 120, focus.y + Math.max(0.08, lightDir.y) * 120, focus.z + lightDir.z * 120);
        this.sun.target.position.set(focus.x, focus.y, focus.z);
        // snap the shadow camera to texels, or shadows shimmer as you walk
        this.hemi.color.copy(k.zen).lerp(new THREE.Color(0xffffff), 0.35);
        this.hemi.groundColor.copy(k.gnd);
        this.hemi.intensity = k.hemi * (opts.inside ? 0.5 : 1);
        this.ambient.intensity = night ? 0.22 : 0.1;
        this.scene.fog.color.copy(k.fog);
        const fogFar = night ? 210 : 420;
        this.scene.fog.near = opts.inside ? 30 : night ? 18 : 55;
        this.scene.fog.far = fogFar;
        this.renderer.toneMappingExposure = night ? 1.25 : 1.0;
        if (this.bloom) this.bloom.strength = night ? 0.85 : 0.5;
        this.sunDir = sunDir; this.night = night; this.key = k;
    }

    render() {
        this.sky.position.copy(this.camera.position);
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}
