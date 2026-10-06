// Renderer, post chain (scene → bloom → grade → output) and quality tiers.
// Gotchas: updateProjectionMatrix() after any aspect change; THREE.Color takes 0..1 floats.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Colour grade: vignette, a warm/cool split tone per act, the low-health pulse, death desaturation and flashes.
const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 },
        uVignette: { value: 1.0 }, uHurt: { value: 0 }, uDesat: { value: 0 },
        uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
        uShadowTint: { value: new THREE.Vector3(0.05, 0.02, 0.08) }, uHighTint: { value: new THREE.Vector3(1.0, 0.96, 0.9) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uHurt, uDesat; uniform vec4 uFlash; uniform vec3 uShadowTint, uHighTint;
        varying vec2 vUv;
        void main(){
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(col + uShadowTint * (1.0 - smoothstep(0.0, 0.35, l)), col * uHighTint, smoothstep(0.4, 1.0, l));
            vec2 c = vUv - 0.5; c.x *= 1.25;
            float r2 = dot(c, c);
            col *= mix(1.0, smoothstep(0.75, 0.05, r2), 0.55 * uVignette);
            float pulse = 0.6 + 0.4 * sin(uTime * 5.0);
            col = mix(col, vec3(0.75, 0.0, 0.08), uHurt * pulse * smoothstep(0.08, 0.45, r2) * 0.85);
            col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(0.95, 0.85, 0.85), uDesat);
            col = mix(col, uFlash.rgb, uFlash.a);
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export const TIERS = [
    { name: 'High',   pr: 2,    bloom: true,  shadows: true,  shadowSize: 2048, particles: 1 },
    { name: 'Medium', pr: 1.5,  bloom: true,  shadows: true,  shadowSize: 1024, particles: 0.8 },
    { name: 'Low',    pr: 1,    bloom: true,  shadows: false, shadowSize: 512,  particles: 0.55 },
    { name: 'Potato', pr: 0.75, bloom: false, shadows: false, shadowSize: 512,  particles: 0.35 },
];

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.toneMappingExposure = 1.1;
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.gl.shadowMap.enabled = true;
        this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        this.gl.setClearColor(0x000000, 1);
        this.tier = 1; this.auto = true; this.slow = 0;
        this.w = 1; this.h = 1;
        this.onTier = null;
    }

    setup(scene, camera) {
        this.scene = scene; this.camera = camera;
        this.composer = new EffectComposer(this.gl);
        this.composer.addPass(new RenderPass(scene, camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
        this.applyTier();
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
        if (this.bloom) this.bloom.enabled = T.bloom;
        this.gl.shadowMap.enabled = T.shadows;
        this.resize(this.w, this.h);
        if (this.onTier) this.onTier(T);
    }

    resize(w, h) {
        this.w = Math.max(1, w); this.h = Math.max(1, h);
        this.gl.setSize(this.w, this.h, false);
        if (this.composer) {
            this.composer.setPixelRatio(this.gl.getPixelRatio());
            this.composer.setSize(this.w, this.h);
            this.bloom.resolution.set(Math.round(this.w * 0.5), Math.round(this.h * 0.5));
        }
        if (this.camera) { this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix(); }
    }

    /** Drop a tier after several consecutive slow samples; never raise automatically mid-play. */
    sampleFps(fps) {
        if (!this.auto) return;
        if (fps > 0 && fps < 40) this.slow++; else this.slow = 0;
        if (this.slow >= 4 && this.tier < TIERS.length - 1) { this.slow = 0; this.setTier(this.tier + 1); }
    }

    render(dt) {
        this.grade.uniforms.uTime.value = (this.grade.uniforms.uTime.value + dt) % 1000;
        this.composer.render(dt);
    }
}
