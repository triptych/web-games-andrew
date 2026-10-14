// Renderer and post chain: RenderPass → UnrealBloom (half res) → grade/VHS →
// OutputPass. The grade pass does the 80s TV look: soft vignette, a little
// chromatic fringe, optional scanlines, and the VHS rewind smear.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uVhs: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uScan: { value: 0.12 }, uAberr: { value: 0.0015 }, uVig: { value: 0.35 }, uRes: { value: new THREE.Vector2(1280, 720) }, uDesat: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uVhs, uFlash, uScan, uAberr, uVig, uDesat; uniform vec3 uFlashColor; uniform vec2 uRes;
        varying vec2 vUv;
        float h(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
            vec2 uv = vUv;
            // VHS: horizontal tear bands that roll, plus jitter
            float band = step(0.93, fract(uv.y * 3.0 - uTime * 1.7)) * uVhs;
            float jit = (h(floor(uv.y * 160.0) + floor(uTime * 30.0)) - 0.5) * 0.012 * uVhs;
            uv.x += jit + band * 0.04;
            float ab = uAberr + uVhs * 0.006;
            vec3 c;
            c.r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
            c.g = texture2D(tDiffuse, uv).g;
            c.b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;
            // scanlines
            float sl = sin(vUv.y * uRes.y * 3.14159) * 0.5 + 0.5;
            c *= 1.0 - uScan * (1.0 - sl) * 0.6;
            // VHS noise + tracking band brightness
            c += (h(uv.x * 91.0 + uv.y * 517.0 + uTime) - 0.5) * 0.08 * uVhs;
            c += band * 0.25;
            float g = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(c, vec3(g) * vec3(1.05, 0.95, 1.1), clamp(uDesat + uVhs * 0.45, 0.0, 1.0));
            // vignette
            vec2 d = vUv - 0.5;
            c *= 1.0 - uVig * dot(d, d) * 2.2;
            c = mix(c, uFlashColor, uFlash);
            gl_FragColor = vec4(c, 1.0);
        }`,
};

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.r.toneMapping = THREE.ACESFilmicToneMapping;
        this.r.toneMappingExposure = 1.12;
        this.r.shadowMap.enabled = true;
        this.r.shadowMap.type = THREE.PCFSoftShadowMap;
        this.composer = new EffectComposer(this.r);
        this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.8, 0.5, 0.78);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
        this.tier = 0;
        this.w = 1; this.h = 1;
    }

    setQuality(tier) {
        this.tier = tier;
        const pr = Math.min(devicePixelRatio, tier === 0 ? 2 : tier === 1 ? 1.5 : 1);
        this.r.setPixelRatio(pr);
        this.r.shadowMap.enabled = tier < 2;
        this.bloom.enabled = tier < 2;
        this.resize(this.w, this.h);
    }

    resize(w, h) {
        this.w = w; this.h = h;
        this.r.setSize(w, h, false);
        this.composer.setSize(w, h);
        const pr = this.r.getPixelRatio();
        this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        this.grade.uniforms.uRes.value.set(w, h);
    }

    render(scene, camera, t) {
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
        this.grade.uniforms.uTime.value = t;
        this.composer.render();
    }
}
