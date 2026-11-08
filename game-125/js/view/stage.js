// The stage: renderer, camera and the HD-2D finish. Pixel sprites live in a lit 3D world; the post chain adds
// bloom (only emissive things cross 1.0), a tilt-shift blur that softens the top and bottom of the frame, a warm
// grade and a vignette. Low quality skips the composer and renders straight to the screen.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { roundBloom } from '../../../lib/round-bloom.js';

const TILT = {
    uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.5 }, uBand: { value: 0.22 },
        uBlur: { value: 1.0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.35 }, uSat: { value: 1.12 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.2, 0.2) },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uBlur, uVig, uSat, uFlash; uniform vec3 uTint, uFlashCol;
varying vec2 vUv;
void main() {
    // tilt-shift: blur grows with distance from the focus band
    float d = clamp((abs(vUv.y - uFocus) - uBand) / (0.5 - uBand * 0.5), 0.0, 1.0);
    float r = d * d * 3.5 * uBlur;
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    if (r > 0.05) {
        vec3 s = c * 0.2; vec2 px = r / uRes;
        s += texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb * 0.1;  s += texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb * 0.1;
        s += texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb * 0.1;  s += texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb * 0.1;
        s += texture2D(tDiffuse, vUv + px * 1.6).rgb * 0.1;         s += texture2D(tDiffuse, vUv - px * 1.6).rgb * 0.1;
        s += texture2D(tDiffuse, vUv + vec2(px.x, -px.y) * 1.6).rgb * 0.1; s += texture2D(tDiffuse, vUv + vec2(-px.x, px.y) * 1.6).rgb * 0.1;
        c = s;
    }
    // grade: saturation, a tint, a soft vignette and a damage flash
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = max(mix(vec3(l), c, uSat), vec3(0.0)) * uTint;
    vec2 q = vUv - 0.5;
    c *= 1.0 - uVig * clamp(dot(q, q) * 2.2, 0.0, 1.0);
    c = mix(c, uFlashCol * max(l, 0.3), clamp(uFlash, 0.0, 1.0) * clamp(dot(q, q) * 3.0, 0.0, 1.0));
    gl_FragColor = vec4(c, 1.0);
}`,
};

export class Stage {
    constructor(canvas, quality = 'high') {
        this.canvas = canvas;
        this.q = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'low', powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);
        this.scene = new THREE.Scene();
        this.composer = null;
        if (quality !== 'low') {
            this.composer = new EffectComposer(this.renderer);
            this.renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(this.renderPass);
            this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 1.1);
            roundBloom(this.bloom);
            this.composer.addPass(this.bloom);
            this.tilt = new ShaderPass(TILT);
            this.composer.addPass(this.tilt);
            this.composer.addPass(new OutputPass());
        }
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setScene(scene) { this.scene = scene; if (this.renderPass) this.renderPass.scene = scene; }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.q === 'high' ? 1.75 : this.q === 'low' ? 1 : 1.25);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);                    // the canvas CSS size in px, never 100vh
        if (this.composer) {
            this.composer.setPixelRatio(dpr);
            this.composer.setSize(w, h);
            this.tilt.uniforms.uRes.value.set(w * dpr, h * dpr);
        }
        this.camera.aspect = w / h;
        this.camera.fov = w / h > 1.2 ? 70 : w / h > 0.8 ? 78 : 88;   // portrait phones see wider
        this.camera.updateProjectionMatrix();
    }

    /** The finish for the current place: tint, tilt-shift strength, bloom, vignette. */
    grade({ tint = 0xffffff, blur = 1, bloom = 0.6, vig = 0.35, sat = 1.12, band = 0.22 } = {}) {
        if (!this.tilt) return;
        const U = this.tilt.uniforms;
        U.uTint.value.set(tint); U.uBlur.value = blur; U.uVig.value = vig; U.uSat.value = sat; U.uBand.value = band;
        this.bloom.strength = bloom;
    }
    flash(v, col = 0xff3a3a) { if (this.tilt) { this.tilt.uniforms.uFlash.value = v; this.tilt.uniforms.uFlashCol.value.set(col); } }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

/** A canvas texture with crisp pixels. */
export function pixelTex(canvas, repeat = false) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
}

/** A gradient sky dome with a sun, stars and an optional planet glow. */
export function skyDome(top, horizon, opts = {}) {
    const U = {
        uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uSun: { value: new THREE.Color(opts.sun || 0xffffff) },
        uSunDir: { value: new THREE.Vector3(0.3, 0.45, -0.85).normalize() }, uStars: { value: opts.stars || 0 }, uTime: { value: 0 },
    };
    const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
        uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
        fragmentShader: `
uniform vec3 uTop, uHor, uSun, uSunDir; uniform float uStars, uTime; varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHor, uTop, pow(clamp(up, 0.0, 1.0), 0.6));
    if (d.y < 0.0) col = uHor * 0.8;
    float sd = clamp(dot(d, uSunDir), 0.0, 1.0);
    col += uSun * (pow(sd, 900.0) * 1.5 + pow(sd, 24.0) * 0.16);
    if (uStars > 0.0) {
        vec2 g = vec2(atan(d.z, d.x) * 300.0, d.y * 480.0);
        float s = h21(floor(g));
        col += vec3(0.9, 0.92, 1.0) * smoothstep(0.994, 1.0, s) * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0));
    }
    gl_FragColor = vec4(col, 1.0);
}`,
    }));
    m.frustumCulled = false;
    m.renderOrder = -10;
    m.userData.U = U;
    return m;
}
