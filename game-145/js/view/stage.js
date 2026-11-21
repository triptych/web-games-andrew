// The renderer, the camera, the lights and the post chain.
//
// Mood comes mostly from light: a low blue-hour moon whose shadows fall through every window, a hemisphere that
// all but dies indoors, the flashlight (the brightest thing in the city, with its own shadow), and a small pool of
// point lights lent to whichever fluorescent panels, street lamps and neon are nearest. Post: a sanitize pass (no
// NaN or infinite pixel ever reaches the bloom), bloom, ACES tone mapping, then a grade pass for film grain,
// vignette, a little chromatic aberration, teal shadows and sick-yellow highlights.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { image, setAnisotropy } from './tex.js';

export const QUALITY = {
    low: { pr: 0.75, shadows: false, bloom: false, shadowSize: 0, lights: 4 },
    medium: { pr: 1, shadows: true, bloom: true, shadowSize: 1024, lights: 6 },
    high: { pr: 1.5, shadows: true, bloom: true, shadowSize: 2048, lights: 8 },
};

const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            // NaN fails every comparison with itself; huge values are infinities from overflowing half floats
            bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 6.0e4 || c.g > 6.0e4 || c.b > 6.0e4;
            gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(8.0)), c.a);
        }`,
};

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
        grain: { value: 0.06 }, vignette: { value: 0.62 }, ca: { value: 0.012 }, fear: { value: 0 }, white: { value: 0 }, sick: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time, grain, vignette, ca, fear, white, sick; uniform vec2 res;
        varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 uv = vUv, d = uv - 0.5;
            // a slow warp when the ring is open
            uv += d * sin(time * 1.7 + length(d) * 9.0) * 0.004 * fear;
            float r2 = dot(d, d);
            vec2 off = d * r2 * (ca + fear * 0.05);
            vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
            col = clamp(col, 0.0, 1.0);
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, 0.74 + sick * 0.2);
            col += vec3(-0.012, 0.01, 0.022) * (1.0 - smoothstep(0.0, 0.45, l));
            col *= mix(vec3(1.0), vec3(1.06, 1.02, 0.84), smoothstep(0.35, 1.0, l));
            col = pow(clamp(col, 0.0, 1.0), vec3(1.04));
            col *= 1.0 - vignette * smoothstep(0.08, 0.62, r2 * 1.45);
            float n = h(uv * res + fract(time * 13.1) * 91.7);
            col += (n - 0.5) * grain;
            col += (h(uv * res * 0.5 + time) - 0.5) / 255.0;      // dither: no banding in the dark
            col = mix(col, vec3(1.0, 0.97, 0.88), clamp(white, 0.0, 1.0));
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
};

export class Stage {
    constructor(canvas, quality = 'medium') {
        this.canvas = canvas;
        this.q = QUALITY[quality] ?? QUALITY.medium;
        this.qname = quality;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.05;
        r.shadowMap.enabled = this.q.shadows;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

        const s = this.scene = new THREE.Scene();
        this.fogOut = new THREE.Color(0x4a5754);
        this.fogIn = new THREE.Color(0x121310);
        s.fog = new THREE.FogExp2(this.fogOut.clone(), 0.011);
        s.background = new THREE.Color(0x1b2120);
        this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 700);
        s.add(this.camera);

        // the sky: a fal panorama on a dome that follows the camera
        const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.MeshBasicMaterial({ map: image('sky'), side: THREE.BackSide, fog: false, depthWrite: false, color: 0xc0c8c4 }));
        sky.renderOrder = -10;
        sky.material.map.mapping = THREE.UVMapping;
        this.sky = sky; s.add(sky);

        this.hemi = new THREE.HemisphereLight(0x9cb0b6, 0x3a342c, 0.9);
        s.add(this.hemi);
        const moon = this.moon = new THREE.DirectionalLight(0xc2cede, 1.6);
        moon.castShadow = this.q.shadows;
        if (this.q.shadows) {
            moon.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
            const c = moon.shadow.camera; c.left = -48; c.right = 48; c.top = 48; c.bottom = -48; c.near = 1; c.far = 260;
            moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
        }
        this.moonDir = new THREE.Vector3(-0.55, 0.62, -0.56).normalize();
        s.add(moon); s.add(moon.target);

        // the flashlight, held a little low and to the right
        const fl = this.flash = new THREE.SpotLight(0xfff0d8, 11, 36, 0.58, 0.62, 1.3);
        fl.position.set(0.18, -0.22, 0.05);
        fl.target.position.set(0.05, -0.1, -4);
        fl.castShadow = this.q.shadows;
        if (this.q.shadows) { fl.shadow.mapSize.set(512, 512); fl.shadow.bias = -0.0008; fl.shadow.camera.near = 0.2; }
        this.camera.add(fl); this.camera.add(fl.target);
        // a faint fill around the walker so total black never happens
        this.fill = new THREE.PointLight(0xc8d0d8, 1.4, 9, 1.6);
        this.camera.add(this.fill);

        this.pool = [];
        for (let i = 0; i < this.q.lights; i++) { const p = new THREE.PointLight(0xffffff, 0, 10, 2); p.visible = false; s.add(p); this.pool.push(p); }

        this.composer = new EffectComposer(r);
        this.composer.addPass(new RenderPass(s, this.camera));
        this.composer.addPass(new ShaderPass(SanitizeShader));
        if (this.q.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.86); this.composer.addPass(this.bloom); }
        this.composer.addPass(new OutputPass());
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.resize();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth)), h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, this.q.pr);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.fov = w < h ? 82 : 72;
        this.camera.updateProjectionMatrix();
        this.grade.uniforms.res.value.set(w * pr, h * pr);
        if (this.bloom) this.bloom.resolution.set(w / 2, h / 2);
    }

    /** Follow the walker: sky, moon shadow box (snapped to its texels so shadows don't shimmer). */
    follow(x, y, z) {
        this.sky.position.set(x, y, z);
        const snap = this.q.shadowSize ? 96 / this.q.shadowSize : 1;
        const sx = Math.round(x / snap) * snap, sz = Math.round(z / snap) * snap;
        this.moon.target.position.set(sx, 0, sz);
        this.moon.position.set(sx + this.moonDir.x * 120, this.moonDir.y * 120, sz + this.moonDir.z * 120);
    }

    render(time) {
        this.grade.uniforms.time.value = time;
        this.composer.render();
    }
}
