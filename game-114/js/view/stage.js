// Renderer, camera, the light pool and the post chain:
// scene → bloom → a grade pass (vignette, chromatic aberration on hits, scanlines, grain, a red
// pulse at low health) → OutputPass (ACES tone mapping + sRGB).
//
// Lighting is a fixed pool of point lights handed out every frame to whatever matters most near
// the camera: the player's suit lamp, muzzle flashes, explosions, flares, the level's lamps and
// acid. A fixed count means the shaders never recompile when a light appears or goes out.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { roundBloom } from '../../../lib/round-bloom.js';

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberr: { value: 0 },
        uHurt: { value: 0 },
        uVignette: { value: 0.55 },
        uScan: { value: 0.035 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTint: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uAberr, uHurt, uVignette, uScan;
        uniform vec2 uRes;
        uniform vec3 uTint;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);
            vec2 off = c * (0.0025 + uAberr * 0.018) * (0.4 + r2 * 2.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + off).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - off).b;
            col *= uTint;
            // scanlines and grain, kept faint
            float scan = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159);
            col *= 1.0 - uScan * scan;
            col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.018;
            // vignette, and a red pulse at the edges when hurt
            float v = clamp(1.0 - r2 * uVignette * 2.2, 0.0, 1.0);
            col *= v;
            col = mix(col, vec3(0.7, 0.02, 0.04), clamp(uHurt * smoothstep(0.12, 0.4, r2), 0.0, 1.0) * 0.35);
            gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
        }`,
};

export const LIGHTS = [5, 8, 10];        // per quality: low, medium, high

export class Stage {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.quality = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.setClearColor(0x05060c);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(34, 1, 1, 400);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.92);
        roundBloom(this.bloom);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());

        this.hemi = new THREE.HemisphereLight(0x8aa0d0, 0x1a1020, 0.55);
        this.scene.add(this.hemi);
        this.key = new THREE.DirectionalLight(0xffffff, 0.35);
        this.key.position.set(-3, 6, 10);
        this.scene.add(this.key);
        this.pool = [];
        for (let i = 0; i < 10; i++) {
            const l = new THREE.PointLight(0xffffff, 0, 12, 2);
            this.scene.add(l);
            this.pool.push(l);
        }
        this.cam = { x: 0, y: 8 };
        this.shake = 0;
        this.viewH = 13;
        this.resize(true);
    }

    setQuality(q) { this.quality = q; this.resize(true); }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const q = this.quality;
        const pr = Math.min(window.devicePixelRatio || 1, [1, 1.25, 2][q]) * [0.75, 1, 1][q];
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);           // sets the canvas CSS size in px (never 100vh)
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
        this.grade.uniforms.uRes.value.set(w * pr, h * pr);
        this.camera.aspect = w / h;
        // Show about 13 tiles of height in landscape; on a portrait phone keep ~11 tiles of width.
        this.viewH = Math.min(24, Math.max(12.5, 11 / this.camera.aspect));
        this.dist = this.viewH / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
        this.camera.near = Math.max(1, this.dist - 12);
        this.camera.far = this.dist + 200;
        this.camera.updateProjectionMatrix();
        return true;
    }

    get viewW() { return this.viewH * this.camera.aspect; }

    place(x, y, time) {
        const s = this.shake;
        const sx = s ? Math.sin(time * 87) * s * 0.35 : 0, sy = s ? Math.cos(time * 71) * s * 0.35 : 0;
        this.camera.position.set(x + sx, y + sy + 0.6, this.dist);
        this.camera.lookAt(x + sx, y + sy, 0);
    }

    /** Hand the light pool to the best candidates: [{ x, y, z, color, intensity, dist, pri }]. */
    assignLights(cands) {
        const n = LIGHTS[this.quality];
        const cx = this.camera.position.x, cy = this.camera.position.y;
        const halfW = this.viewW / 2 + 4, halfH = this.viewH / 2 + 4;
        const vis = [];
        for (const c of cands) {
            if (Math.abs(c.x - cx) > halfW || Math.abs(c.y - cy) > halfH) continue;
            c.score = c.pri * c.intensity / (1 + Math.abs(c.x - cx) * 0.15);
            vis.push(c);
        }
        vis.sort((a, b) => b.score - a.score);
        for (let i = 0; i < this.pool.length; i++) {
            const l = this.pool[i], c = i < n ? vis[i] : null;
            if (!c) { l.intensity = 0; continue; }
            l.position.set(c.x, c.y, c.z ?? 1.2);
            l.color.setHex(c.color);
            l.intensity = c.intensity;
            l.distance = c.dist || 10;
        }
        return Math.min(n, vis.length);
    }

    render(time) {
        this.grade.uniforms.uTime.value = time;
        if (this.quality === 0) this.renderer.render(this.scene, this.camera);
        else this.composer.render();
    }
}
