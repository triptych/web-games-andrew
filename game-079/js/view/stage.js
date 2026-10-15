// Renderer, cameras and the post chain: world pass → viewmodel pass (depth cleared) → half-res
// bloom → a VHS pass (chromatic aberration kicks, vignette, damage flash, low-health
// desaturation, the Overdrive grade, scan lines, grain) → OutputPass (ACES + sRGB).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VHS = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0 }, uDamage: { value: 0 }, uOver: { value: 0 },
        uLow: { value: 0 }, uFlash: { value: new THREE.Vector3() }, uScan: { value: 0.5 }, uRes: { value: new THREE.Vector2(1, 1) },
        uFrozen: { value: 0 }, uDead: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
uniform sampler2D tDiffuse;
uniform float uTime, uAberr, uDamage, uOver, uLow, uScan, uFrozen, uDead;
uniform vec3 uFlash;
uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    // VHS tracking wobble, stronger in Overdrive and when hurt
    float wob = (sin(uv.y * 40.0 + uTime * 3.0) * 0.0006 + step(0.995, h(vec2(floor(uTime * 20.0), floor(uv.y * 60.0)))) * 0.004) * (0.3 + uOver + uDamage);
    uv.x += wob;
    float ab = 0.0015 + uAberr * 0.012 + uOver * 0.003;
    vec2 off = c * ab * (1.0 + r2 * 4.0);
    vec3 col;
    col.r = texture2D(tDiffuse, uv + off).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - off).b;
    // Overdrive: a hot pink/cyan grade and a radial smear
    if (uOver > 0.0) {
        vec3 s = vec3(0.0);
        for (int i = 1; i <= 5; i++) s += texture2D(tDiffuse, 0.5 + c * (1.0 - float(i) * 0.012 * uOver)).rgb;
        col = mix(col, s / 5.0, 0.3 * uOver);
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 grade = mix(vec3(0.15, 0.0, 0.35), vec3(1.0, 0.25, 0.75), smoothstep(0.0, 0.6, l));
        grade = mix(grade, vec3(0.4, 1.0, 1.0), smoothstep(0.6, 1.4, l));
        col = mix(col, grade * (0.4 + l), 0.3 * uOver);
    }
    // frozen-world tint when you're slowed? (unused) and low health draining colour
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l) * vec3(1.1, 0.85, 0.85), uLow * 0.6);
    // damage: red edges
    col = mix(col, vec3(0.6, 0.0, 0.02), clamp(uDamage * (0.2 + r2 * 3.0), 0.0, 0.85));
    col += uFlash;
    // death: drain to red and black
    col = mix(col, vec3(l * 0.7, 0.0, 0.0), uDead * 0.8);
    // scan lines and grain
    float sl = 0.5 + 0.5 * sin(vUv.y * uRes.y * 1.57);
    col *= 1.0 - uScan * 0.12 * sl;
    col += (h(vUv * uRes + uTime) - 0.5) * 0.035 * uScan;
    // vignette
    col *= 1.0 - smoothstep(0.25, 0.9, r2 * 1.6) * 0.55;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`,
};

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.renderer.setClearColor(0x05030a);
        this.renderer.autoClear = false;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 1200);
        this.camera.rotation.order = 'YXZ';
        this.quality = 1;      // 0 low, 1 medium, 2 high
        this.composer = new EffectComposer(this.renderer);
        this.worldPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.worldPass);
        this.vmPass = null;
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.45, 0.86);
        this.composer.addPass(this.bloom);
        this.vhs = new ShaderPass(VHS);
        this.composer.addPass(this.vhs);
        this.composer.addPass(new OutputPass());
        // a neon environment map for chrome and guns, from a tiny generated scene
        this.envMap = this.makeEnv();
        this.scene.environment = this.envMap;
        this.resize();
    }

    addViewModel(vm) {
        this.vm = vm;
        this.vmPass = new RenderPass(vm.scene, vm.camera);
        this.vmPass.clear = false;
        this.vmPass.clearDepth = true;
        this.composer.insertPass(this.vmPass, 1);
    }

    makeEnv() {
        const pm = new THREE.PMREMGenerator(this.renderer);
        const s = new THREE.Scene();
        s.background = new THREE.Color(0x07040c);
        const box = (c, p, sc) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: c })); m.position.set(...p); m.scale.set(...sc); s.add(m); };
        box(new THREE.Color(4, 0.6, 2.4), [-5, 2, -3], [0.4, 4, 6]);
        box(new THREE.Color(0.5, 2.8, 4), [5, 1, 2], [0.4, 3, 6]);
        box(new THREE.Color(3, 2.4, 1.8), [0, 6, 0], [6, 0.3, 6]);
        box(new THREE.Color(0.15, 0.05, 0.25), [0, -4, 0], [20, 0.3, 20]);
        const rt = pm.fromScene(s, 0.04);
        pm.dispose();
        return rt.texture;
    }

    setQuality(q) {
        this.quality = q;
        this.resize(true);
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, [1, 1.25, 2][this.quality]) * [0.6, 0.85, 1][this.quality];
        this.pr = pr;
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);          // sets the canvas CSS size in px (never 100vh)
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(w * pr / 2, h * pr / 2);
        this.bloom.strength = [0.55, 0.75, 0.85][this.quality];
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.vm?.setAspect(w / h);
        this.vhs.uniforms.uRes.value.set(w * pr, h * pr);
        return true;
    }

    render() { this.composer.render(); }
}
