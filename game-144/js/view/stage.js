// The renderer, the camera and the post-processing chain. The play field is the plane z = 0: sim (x, y) maps to
// world (x - 16, 9 - y, 0). The camera looks at it from the side, a little above and to the left, and leans into
// boss fights; it shakes on big hits.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FIELD } from '../config.js';

export const wx = (x) => x - FIELD.w / 2;
export const wy = (y) => FIELD.h / 2 - y;

// The last pass: shockwave ripple, chromatic aberration that grows with intensity, scanline-free film grain, vignette,
// a white/colour flash, and a hit desaturation. Every pow() base is clamped (bloom turns one NaN into a box).
const FinalShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0.0015 }, uFlash: { value: 0 },
        uFlashCol: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.9 }, uGrain: { value: 0.035 },
        uWave: { value: new THREE.Vector4(0.5, 0.5, -1, 0) }, uAspect: { value: 1.7 }, uDesat: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uAberr, uFlash, uVig, uGrain, uAspect, uDesat; uniform vec3 uFlashCol; uniform vec4 uWave;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
            vec2 uv = vUv;
            // shockwave: a ring of refraction expanding from uWave.xy, radius uWave.z, strength uWave.w
            if (uWave.z > 0.0) {
                vec2 d = uv - uWave.xy; d.x *= uAspect;
                float r = length(d);
                float ring = clamp(1.0 - abs(r - uWave.z) * 14.0, 0.0, 1.0);
                uv -= normalize(d + 1e-5) * ring * uWave.w * 0.03 * vec2(1.0 / uAspect, 1.0);
            }
            vec2 c = uv - 0.5;
            float k = uAberr * (0.4 + dot(c, c) * 3.0);
            vec3 col;
            col.r = texture2D(tDiffuse, uv + c * k).r;
            col.g = texture2D(tDiffuse, uv).g;
            col.b = texture2D(tDiffuse, uv - c * k).b;
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(col, vec3(l), clamp(uDesat, 0.0, 1.0));
            col += uFlashCol * uFlash;
            float v = clamp(1.0 - dot(c, c) * uVig, 0.0, 1.0);
            col *= mix(1.0, v, 0.85);
            col += (hash(uv * 900.0 + uTime) - 0.5) * uGrain;
            gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
        }`,
};

export class Stage {
    constructor(canvas, { quality = 'high' } = {}) {
        this.canvas = canvas;
        this.quality = quality;
        const low = quality === 'low';
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.setClearColor(0x05060c);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x070814, 0.0035);
        this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 600);

        // a soft studio environment so the metal hulls have something to reflect
        const pm = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 1.0;
        pm.dispose();

        this.hemi = new THREE.HemisphereLight(0x8fa8ff, 0x1a1020, 0.7);
        this.key = new THREE.DirectionalLight(0xffe2c0, 2.4);
        this.key.position.set(-14, 18, 22);
        this.rim = new THREE.DirectionalLight(0x6fa8ff, 2.0);
        this.rim.position.set(20, -8, -14);
        this.scene.add(this.hemi, this.key, this.rim);
        // a fixed pool of point lights for explosions and muzzle flashes: the count never changes (no shader recompiles)
        this.lights = [];
        for (let i = 0; i < (low ? 2 : 6); i++) {
            const L = new THREE.PointLight(0xffaa66, 0, 14, 1.6);
            L.userData = { life: 0, max: 1, power: 0 };
            this.scene.add(L);
            this.lights.push(L);
        }

        // post
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), low ? 0.55 : 0.7, 0.45, 0.82);
        if (!low) this.composer.addPass(this.bloom);
        this.final = new ShaderPass(FinalShader);
        this.composer.addPass(this.final);
        this.composer.addPass(new OutputPass());

        this.shake = 0;
        this.flash = 0;
        this.wave = { x: 0.5, y: 0.5, t: -1, s: 0 };
        this.lean = 0;          // 0 = cruise, 1 = boss: the camera swings round a little
        this.leanT = 0;
        this.fit = 1;
        this.calm = false;
        this.resize();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.75);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);          // sets the canvas CSS size in px (never 100vh)
        this.composer.setPixelRatio(dpr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(w / 2, h / 2);
        this.camera.aspect = w / h;
        // fit the whole field, a margin round it, at any aspect (portrait phones included)
        const fov = (this.camera.fov * Math.PI) / 180;
        const needH = Math.max(FIELD.h + 1.2, (FIELD.w + 1.5) / this.camera.aspect);
        this.dist = (needH / 2) / Math.tan(fov / 2);
        this.camera.far = this.dist * 12;
        this.camera.updateProjectionMatrix();
        this.final.uniforms.uAspect.value = w / h;
        return true;
    }

    /** Project a sim point to CSS px (for DOM labels and tests). */
    toScreen(x, y) {
        const v = new THREE.Vector3(wx(x), wy(y), 0).project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
    }

    kick(shake = 0.3, flash = 0, color = null) {
        if (this.calm) { shake *= 0.3; flash *= 0.25; }
        this.shake = Math.min(1.4, this.shake + shake);
        if (flash > this.flash) { this.flash = flash; this.final.uniforms.uFlashCol.value.set(color ?? 0xffffff); }
    }

    shockwave(x, y, s = 1) {
        if (this.calm) return;
        const p = this.toScreen(x, y);
        this.wave = { x: p.x / this.w, y: 1 - p.y / this.h, t: 0, s };
    }

    light(x, y, color, power = 30, life = 0.35) {
        let L = this.lights[0];
        for (const l of this.lights) if (l.userData.life < L.userData.life) L = l;
        L.position.set(wx(x), wy(y), 2.5);
        L.color.set(color);
        L.userData = { life, max: life, power };
        L.intensity = power;
    }

    update(dt, time, focusX = 16, focusY = 9) {
        this.resize();
        this.leanT += (this.lean - this.leanT) * Math.min(1, dt * 0.8);
        const L = this.leanT;
        // cruise: slightly above and left of centre; boss: swing round to look up at the giant
        const ang = -0.1 - L * 0.22 + Math.sin(time * 0.13) * 0.025;
        const pitch = 0.12 - L * 0.1 + Math.sin(time * 0.17) * 0.015;
        const d = this.dist * (1 + L * 0.03);
        const cx = (focusX - FIELD.w / 2) * 0.06, cy = (FIELD.h / 2 - focusY) * 0.05;
        this.shake = Math.max(0, this.shake - dt * 2.2);
        const sh = this.shake * this.shake * 0.6;
        this.camera.position.set(Math.sin(ang) * d + cx + (Math.sin(time * 91) * sh), Math.sin(pitch) * d + cy + (Math.cos(time * 73) * sh), Math.cos(ang) * d);
        this.camera.lookAt(cx * 0.5, cy * 0.5, 0);
        this.camera.rotation.z += Math.sin(time * 0.21) * 0.008 * (1 + L) + Math.sin(time * 67) * sh * 0.01;

        for (const l of this.lights) {
            if (l.userData.life > 0) {
                l.userData.life -= dt;
                l.intensity = Math.max(0, l.userData.power * (l.userData.life / l.userData.max));
            } else l.intensity = 0;
        }
        this.flash = Math.max(0, this.flash - dt * 3.2);
        const u = this.final.uniforms;
        u.uTime.value = time;
        u.uFlash.value = this.flash * 0.55;
        u.uAberr.value = 0.0012 + this.shake * 0.004;
        if (this.wave.t >= 0) {
            this.wave.t += dt;
            const r = this.wave.t * 0.9;
            u.uWave.value.set(this.wave.x, this.wave.y, r, this.wave.s * Math.max(0, 1 - this.wave.t * 1.6));
            if (this.wave.t > 0.7) { this.wave.t = -1; u.uWave.value.z = -1; }
        }
    }

    render() { this.composer.render(); }
}
