// The renderer and its post chain, shared by the dig and the museum.
//
//   RenderPass → Sanitize (NaN/Inf to black) → UnrealBloom (half size) → Grade → OutputPass
//
// Grade is our own pass: warm split-toning, a vignette, a little film grain, a white flash and
// chromatic aberration that the dig drives from its explosions. The canvas is sized in px from
// visualViewport (never 100vh, see the scaffold notes). An image-based environment from
// RoomEnvironment gives every metal and gem something to reflect.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SanitizeShader = {
    name: 'SanitizeShader',
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = clamp(c, vec4(0.0), vec4(64.0));
        }`,
};

const GradeShader = {
    name: 'GradeShader',
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.32 },
        uFlash: { value: 0 },
        uAberr: { value: 0 },
        uWarm: { value: 0.5 },
        uGrain: { value: 0.035 },
        uAspect: { value: 1 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uVignette, uFlash, uAberr, uWarm, uGrain, uAspect;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 d = vUv - 0.5;
            vec2 off = d * uAberr * 0.012;
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + off).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - off).b;
            col = max(col, vec3(0.0));
            // split toning: warm highlights, cool-teal shadows (linear space, before OutputPass)
            float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
            vec3 warm = vec3(1.06, 1.0, 0.9);
            vec3 cool = vec3(0.92, 1.0, 1.05);
            col *= mix(cool, warm, smoothstep(0.0, 0.6, l) * uWarm + (1.0 - uWarm) * 0.5);
            // vignette (round on any aspect)
            vec2 v = d * vec2(uAspect, 1.0) / max(uAspect, 1.0);
            float vig = smoothstep(0.85, 0.2, length(v) * 1.25);
            col *= mix(1.0 - uVignette, 1.0, vig);
            col += uFlash * vec3(1.0, 0.96, 0.85);
            col += (hash(vUv * 811.0 + fract(uTime) * 91.0) - 0.5) * uGrain * (0.4 + l);
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export class Stage {
    constructor(canvas, quality = 'high') {
        this.canvas = canvas;
        this.quality = quality;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.0;
        r.shadowMap.enabled = quality !== 'low';
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.setClearColor(0x87c6d8);

        const pmrem = new THREE.PMREMGenerator(r);
        this.envMap = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
        pmrem.dispose();

        this.scene = null;
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
        this.composer = new EffectComposer(r);
        this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
        this.composer.addPass(this.renderPass);
        this.composer.addPass(new ShaderPass(SanitizeShader));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.55, 0.82);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
        this.G = this.grade.uniforms;
        this.flash = 0;
        this.aberr = 0;

        this.w = 0; this.h = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.quality = q;
        this.renderer.shadowMap.enabled = q !== 'low';
        this.bloom.enabled = q !== 'low';
        this.w = 0;
        this.resize();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
        const pr = Math.min(window.devicePixelRatio || 1, cap);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        this.G.uAspect.value = w / h;
        this.onResize?.(w, h);
        return true;
    }

    /** A white flash and a colour split, both fading out; the dig calls these on big blasts. */
    kick(flash = 0.25, aberr = 1) {
        this.flash = Math.max(this.flash, flash);
        this.aberr = Math.max(this.aberr, aberr);
    }

    render(scene, camera, dt, time, look = {}) {
        this.resize();
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
        this.flash = Math.max(0, this.flash - dt * 2.5);
        this.aberr = Math.max(0, this.aberr - dt * 3);
        this.G.uTime.value = time;
        this.G.uFlash.value = this.flash * this.flash;
        this.G.uAberr.value = this.aberr;
        this.G.uVignette.value = look.vignette ?? 0.32;
        this.G.uWarm.value = look.warm ?? 0.5;
        this.bloom.strength = look.bloom ?? 0.45;
        this.bloom.threshold = look.threshold ?? 0.82;
        this.renderer.toneMappingExposure = look.exposure ?? 1.0;
        this.composer.render(dt);
    }
}
