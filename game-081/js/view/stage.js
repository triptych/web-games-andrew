// Renderer, the camera and the post chain:
//   RenderPass (MSAA on high) → half-res bloom → a grade pass (per-place colour grade,
//   lift/gamma/gain, vignette, film grain, chromatic fringe, fades) → OutputPass (ACES + sRGB).
// The world and the Lumen scan each have a scene; render(scene, camera) swaps the RenderPass's.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const GRADE = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uLift: { value: new THREE.Vector3(0, 0, 0) },
        uSat: { value: 1.0 },
        uVignette: { value: 0.45 },
        uGrain: { value: 0.035 },
        uAberr: { value: 0.0 },
        uFade: { value: 0.0 },
        uFlash: { value: new THREE.Vector3(0, 0, 0) },
        uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
uniform sampler2D tDiffuse;
uniform float uTime, uSat, uVignette, uGrain, uAberr, uFade;
uniform vec3 uTint, uLift, uFlash;
uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 c = vUv - 0.5;
    float r2 = dot(c, c);
    vec2 off = c * (0.0012 + uAberr * 0.01) * (1.0 + r2 * 3.0);
    vec3 col;
    col.r = texture2D(tDiffuse, vUv + off).r;
    col.g = texture2D(tDiffuse, vUv).g;
    col.b = texture2D(tDiffuse, vUv - off).b;
    col = max(col, vec3(0.0));
    // grade: tint (gain), lift in the shadows, saturation
    col = col * uTint + uLift * (1.0 - clamp(col, 0.0, 1.0));
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat);
    col += uFlash;
    // vignette and grain
    col *= 1.0 - smoothstep(0.18, 0.85, r2 * 1.7) * uVignette;
    col += (h(vUv * uRes + fract(uTime * 7.31)) - 0.5) * uGrain;
    col *= 1.0 - uFade;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`,
};

export class Stage {
    constructor(canvas, quality = 1) {
        this.canvas = canvas;
        this.quality = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x05060c);
        this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);   // near 0.1, not 0.05: twice the depth precision on phones
        this.camera.rotation.order = 'YXZ';
        const pm = new THREE.PMREMGenerator(this.renderer);
        this.envRoom = pm.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
        pm.dispose();
        this.buildComposer();
        this.resize(true);
    }

    buildComposer() {
        const q = this.quality;
        const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q >= 2 ? 4 : 0 });
        this.composer = new EffectComposer(this.renderer, rt);
        this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.82);
        this.bloom.enabled = q >= 1;
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GRADE);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
        this.renderer.shadowMap.enabled = q >= 2;
    }

    setQuality(q) {
        if (q === this.quality) return;
        this.quality = q;
        this.composer.dispose?.();
        this.buildComposer();
        this.resize(true);
        this.onQuality?.(q);
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const dpr = window.devicePixelRatio || 1;
        const pr = [Math.min(dpr, 1) * 0.65, Math.min(dpr, 1.5), Math.min(dpr, 2)][this.quality];
        this.pr = pr;
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);          // sets the canvas CSS size in px (never 100vh)
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
        this.grade.uniforms.uRes.value.set(w * pr, h * pr);
        this.camera.aspect = w / h;
        this.camera.fov = w / h < 0.8 ? 84 : 72;    // portrait phones see a little more
        this.camera.updateProjectionMatrix();
        this.onResize?.(w, h);
        return true;
    }

    /** Set the colour grade for a place. */
    setGrade({ tint = [1, 1, 1], lift = [0, 0, 0], sat = 1, vignette = 0.45, grain = 0.035, exposure = 1, bloom = 0.6, threshold = 0.82 } = {}) {
        const u = this.grade.uniforms;
        u.uTint.value.set(...tint);
        u.uLift.value.set(...lift);
        u.uSat.value = sat;
        u.uVignette.value = vignette;
        u.uGrain.value = grain;
        this.renderer.toneMappingExposure = exposure;
        this.bloom.strength = bloom * (this.quality >= 2 ? 1 : 0.85);
        this.bloom.threshold = threshold;
    }

    render(scene, camera, time) {
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
        this.grade.uniforms.uTime.value = time;
        this.composer.render();
    }
}
