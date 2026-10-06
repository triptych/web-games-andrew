// Renderer and post chain: scene → bloom → steam grade → gear-iris transition → output.
// The grade gives everything a sepia-and-teal steampunk split tone, a vignette, film grain, a
// faint chromatic fringe at the edges, heat shimmer, flashes and the battle-start shatter.
// Gotchas: updateProjectionMatrix() after any aspect change; THREE.Color takes 0..1 floats.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
        uVignette: { value: 1.0 }, uGrain: { value: 0.035 }, uFringe: { value: 1.0 }, uSepia: { value: 0.18 },
        uShadow: { value: new THREE.Vector3(0.02, 0.06, 0.08) }, uHigh: { value: new THREE.Vector3(1.04, 0.97, 0.86) },
        uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uHaze: { value: 0 }, uDesat: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uFringe, uSepia, uHaze, uDesat;
        uniform vec2 uRes; uniform vec3 uShadow, uHigh; uniform vec4 uFlash;
        varying vec2 vUv;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
            vec2 uv = vUv;
            // Heat shimmer (used near furnaces and in heatwaves).
            uv.x += sin(uv.y * 80.0 + uTime * 7.0) * 0.0018 * uHaze;
            uv.y += cos(uv.x * 60.0 + uTime * 5.0) * 0.0012 * uHaze;
            vec2 c = uv - 0.5;
            float r2 = dot(c, c);
            // Chromatic fringe grows toward the edges.
            vec2 off = c * r2 * 0.012 * uFringe;
            vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            // Split tone: teal shadows, warm brass highlights, a touch of sepia.
            col = mix(col + uShadow * (1.0 - smoothstep(0.0, 0.4, l)), col * uHigh, smoothstep(0.35, 1.0, l));
            vec3 sep = vec3(l * 1.07, l * 0.92, l * 0.72);
            col = mix(col, sep, uSepia);
            col = mix(col, vec3(l), uDesat);
            // Vignette.
            vec2 vc = c; vc.x *= 1.2;
            col *= mix(1.0, smoothstep(0.85, 0.12, dot(vc, vc)), 0.6 * uVignette);
            // Film grain.
            float gr = h21(uv * uRes + fract(uTime * 13.0) * 97.0) - 0.5;
            col += gr * uGrain * (1.0 - l * 0.5);
            col = mix(col, uFlash.rgb, uFlash.a);
            gl_FragColor = vec4(col, 1.0);
        }`,
};

// A brass gear closing over the screen (battle start, map changes) or a starburst wipe.
const IrisShader = {
    uniforms: { tDiffuse: { value: null }, uK: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uMode: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uK, uAspect, uTime, uMode; varying vec2 vUv;
        void main(){
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            if (uK <= 0.0) { gl_FragColor = vec4(col, 1.0); return; }
            vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
            float a = atan(p.y, p.x) + uTime * 2.5 * (uMode > 0.5 ? -1.0 : 1.0);
            float teeth = 0.5 + 0.5 * sign(sin(a * 12.0));
            float rad = (1.0 - uK) * 1.0;
            float gearR = rad * (0.92 + 0.08 * teeth);
            float d = length(p);
            float inside = smoothstep(gearR + 0.004, gearR - 0.004, d);
            // brass rim
            float rim = smoothstep(0.03, 0.0, abs(d - gearR)) * step(0.001, uK);
            vec3 brass = vec3(0.78, 0.6, 0.25) * (0.6 + 0.4 * sin(a * 24.0));
            vec3 outCol = vec3(0.03, 0.025, 0.02);
            col = mix(outCol, col, inside);
            col = mix(col, brass, rim * 0.9);
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export const TIERS = [
    { name: 'High', pr: 2, bloom: true, shadows: true, shadowSize: 2048, particles: 1 },
    { name: 'Medium', pr: 1.5, bloom: true, shadows: true, shadowSize: 1024, particles: 0.8 },
    { name: 'Low', pr: 1, bloom: true, shadows: false, shadowSize: 512, particles: 0.55 },
    { name: 'Potato', pr: 0.75, bloom: false, shadows: false, shadowSize: 512, particles: 0.35 },
];

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.toneMappingExposure = 1.05;
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.gl.shadowMap.enabled = true;
        this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        this.tier = 1; this.auto = true; this.slow = 0;
        this.w = 1; this.h = 1;
        this.onTier = null;
        this.composer = new EffectComposer(this.gl);
        this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.85);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.iris = new ShaderPass(IrisShader);
        this.composer.addPass(this.iris);
        this.composer.addPass(new OutputPass());
    }

    use(scene, camera) {
        this.scene = scene; this.camera = camera;
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
        camera.aspect = this.w / this.h;
        camera.updateProjectionMatrix();
    }

    get T() { return TIERS[this.tier]; }
    setTier(t, manual = false) {
        this.tier = Math.max(0, Math.min(TIERS.length - 1, t));
        if (manual) this.auto = false;
        this.applyTier();
    }
    applyTier() {
        const T = this.T;
        this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, T.pr));
        this.bloom.enabled = T.bloom;
        this.gl.shadowMap.enabled = T.shadows;
        this.resize(this.w, this.h);
        if (this.onTier) this.onTier(T);
    }

    resize(w, h) {
        this.w = Math.max(1, w); this.h = Math.max(1, h);
        this.gl.setSize(this.w, this.h, false);
        this.composer.setPixelRatio(this.gl.getPixelRatio());
        this.composer.setSize(this.w, this.h);
        this.bloom.resolution.set(Math.round(this.w * 0.5), Math.round(this.h * 0.5));
        this.grade.uniforms.uRes.value.set(this.w, this.h);
        this.iris.uniforms.uAspect.value = this.w / this.h;
        if (this.camera) { this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix(); }
    }

    sampleFps(fps) {
        if (!this.auto) return;
        if (fps > 0 && fps < 38) this.slow++; else this.slow = 0;
        if (this.slow >= 4 && this.tier < TIERS.length - 1) { this.slow = 0; this.setTier(this.tier + 1); }
    }

    render(dt) {
        const u = this.grade.uniforms;
        u.uTime.value = (u.uTime.value + dt) % 1000;
        this.iris.uniforms.uTime.value = u.uTime.value;
        this.composer.render(dt);
    }
}
