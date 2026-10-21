// The renderer and its post chain, shared by the board and the battle scenes.
//
//   RenderPass → Sanitize (NaN/Inf to black) → UnrealBloom (half size) → Storybook → OutputPass
//
// Storybook is our own pass: saturation, a warm or cool grade, a vignette, paper grain, a white
// flash, and the Final-Fantasy battle swirl (the screen twists, zooms and shatters to white as a
// battle starts). The canvas is sized in px from visualViewport, never 100vh.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SanitizeShader = {
    name: 'SanitizeShader',
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = clamp(c, vec4(0.0), vec4(32.0));
        }`,
};

const StorybookShader = {
    name: 'StorybookShader',
    uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uVignette: { value: 0.34 }, uGrain: { value: 0.012 }, uSat: { value: 1.12 }, uWarm: { value: 0.04 },
        uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color('#ffffff') },
        uSwirl: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') }, uTintK: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uTime, uVignette, uGrain, uSat, uWarm, uFlash, uSwirl, uTintK;
        uniform vec3 uFlashCol, uTint;
        varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            float aspect = uRes.x / max(uRes.y, 1.0);
            if (uSwirl > 0.0) {
                // twist round the centre, more toward the middle, and zoom in
                vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
                float r = length(d);
                float ang = uSwirl * uSwirl * 9.0 * max(0.0, 1.0 - r * 1.2);
                float cs = cos(ang), sn = sin(ang);
                d = mat2(cs, -sn, sn, cs) * d;
                d *= 1.0 - uSwirl * 0.45;
                // shards: offset blocks of the picture
                vec2 cell = floor(uv * vec2(9.0, 6.0));
                float k = h(cell);
                d += (vec2(k, h(cell + 3.1)) - 0.5) * uSwirl * uSwirl * 0.18;
                uv = d / vec2(aspect, 1.0) + 0.5;
            }
            vec3 col = texture2D(tDiffuse, uv).rgb;
            col = max(col, vec3(0.0));
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, uSat);
            col += vec3(uWarm, uWarm * 0.45, -uWarm * 0.35) * (0.35 + 0.65 * clamp(l, 0.0, 1.0));
            col = mix(col, col * uTint, uTintK);
            vec2 q = (vUv - 0.5) * vec2(aspect, 1.0) / max(aspect, 1.0);
            col *= 1.0 - uVignette * dot(q, q) * 2.0;
            col += (h(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
            col = mix(col, uFlashCol, clamp(uFlash + uSwirl * uSwirl * uSwirl * 0.9, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.r.outputColorSpace = THREE.SRGBColorSpace;
        this.r.toneMapping = THREE.NoToneMapping;
        this.r.shadowMap.enabled = true;
        this.r.shadowMap.type = THREE.PCFSoftShadowMap;
        this.r.setClearColor('#8ad0ff');
        this.scene = null;
        this.camera = null;
        this.composer = new EffectComposer(this.r);
        this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
        this.composer.addPass(this.renderPass);
        this.composer.addPass(new ShaderPass(SanitizeShader));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.92);
        this.composer.addPass(this.bloom);
        this.story = new ShaderPass(StorybookShader);
        this.composer.addPass(this.story);
        this.composer.addPass(new OutputPass());
        this.quality = 2;
        this.flash = 0;
        this.swirl = 0;
        this.w = 0; this.h = 0;
        this.resize();
        const onResize = () => { this.dirty = true; };
        addEventListener('resize', onResize);
        visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.quality = q;
        this.r.shadowMap.enabled = q > 0;
        this.dirty = true;
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const pr = Math.min(devicePixelRatio || 1, [1, 1.5, 2][this.quality] ?? 1.5);
        if (w === this.w && h === this.h && pr === this.pr && !this.dirty) return;
        this.w = w; this.h = h; this.pr = pr; this.dirty = false;
        this.r.setPixelRatio(pr);
        this.r.setSize(w, h);             // sets the canvas's CSS size in px too
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        this.story.uniforms.uRes.value.set(w * pr, h * pr);
        this.aspect = w / h;
    }

    use(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
    }

    doFlash(color = '#ffffff', k = 0.7) {
        this.story.uniforms.uFlashCol.value.set(color);
        this.flash = Math.max(this.flash, k);
    }

    render(dt, t) {
        this.resize();
        if (this.camera && this.camera.aspect !== this.aspect) {
            this.camera.aspect = this.aspect;
            this.camera.updateProjectionMatrix();
        }
        const U = this.story.uniforms;
        U.uTime.value = t;
        this.flash = Math.max(0, this.flash - dt * 2.4);
        U.uFlash.value = this.flash * this.flash;
        U.uSwirl.value = this.swirl;
        this.composer.render(dt);
    }
}
