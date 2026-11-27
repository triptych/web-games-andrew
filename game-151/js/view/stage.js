// The three.js stage: renderer, camera, the starfield and nebula, and the post chain (sanitize → bloom → a 90s cel
// film pass: grain, scanlines, vignette, a white flash and a slight chromatic fringe). The camera is framed into
// the part of the screen the board leaves free (setViewOffset), so the ship and the mothership are never under it.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Additive glows and bullets can overflow half-float targets to infinity; bloom would smear each into a square
// halo (game-144). Non-finite pixels go black and the rest are capped before the bloom sees them.
const SanitizeShader = {
    uniforms: { tDiffuse: { value: null }, uMax: { value: 6.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uMax; varying vec2 vUv;
        bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main(){
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            c.rgb = clamp(c.rgb, 0.0, uMax);
            gl_FragColor = c;
        }`,
};

const FilmShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uRes: { value: new THREE.Vector2(1, 1) }, uFringe: { value: 0.0015 }, uGrain: { value: 0.03 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uFlash, uFringe, uGrain; uniform vec3 uFlashColor; uniform vec2 uRes;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
            vec2 d = vUv - 0.5;
            float f = uFringe * (0.3 + dot(d, d) * 3.0);
            vec3 c;
            c.r = texture2D(tDiffuse, vUv + d * f * 4.0).r;
            c.g = texture2D(tDiffuse, vUv).g;
            c.b = texture2D(tDiffuse, vUv - d * f * 4.0).b;
            // cel-film: a soft vignette, faint scanlines and grain
            float vig = smoothstep(0.95, 0.25, length(d * vec2(1.0, 1.15)));
            c *= mix(0.62, 1.0, vig);
            c *= 0.965 + 0.035 * sin(vUv.y * uRes.y * 1.6);
            c += (h(vUv * uRes + fract(uTime * 7.0) * 91.0) - 0.5) * uGrain;
            c = mix(c, uFlashColor, clamp(uFlash, 0.0, 1.0));
            gl_FragColor = vec4(c, 1.0);
        }`,
};

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.renderer.setClearColor(0x05040c);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 900);
        this.camBase = new THREE.Vector3(0, 4.2, 12);
        this.camLook = new THREE.Vector3(0, 7.5, -40);

        this.scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x2a1838, 0.9));
        const key = new THREE.DirectionalLight(0xfff2e0, 1.5);
        key.position.set(12, 18, 10);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0x7fd8ff, 1.6);
        rim.position.set(-14, 6, -20);
        this.scene.add(rim);

        this.sky = this.makeSky();
        this.stars = this.makeStars();
        this.speed = this.makeSpeedLines();

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new ShaderPass(SanitizeShader));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 1.05);
        this.composer.addPass(this.bloom);
        this.film = new ShaderPass(FilmShader);
        this.composer.addPass(this.film);
        this.composer.addPass(new OutputPass());

        this.shake = 0;
        this.flash = 0;
        this.region = { x: 0, y: 0, w: 1, h: 1 };
        this.resize();
    }

    makeSky() {
        // the nebula painting fills the screen behind everything (scene.background: no seams, no parallax to fake);
        // a dark gradient stands in until it loads, or if it fails to
        this.scene.background = new THREE.Color(0x07061a);
        new THREE.TextureLoader().load('art/sky.webp', (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = t;
        }, undefined, () => {});
    }

    makeStars() {
        const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        let s = 12345;
        const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < n; i++) {
            const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), R = 300 + r() * 200;
            pos[i * 3] = Math.sin(ph) * Math.cos(th) * R;
            pos[i * 3 + 1] = Math.cos(ph) * R * 0.7 + 40;
            pos[i * 3 + 2] = -Math.abs(Math.sin(ph) * Math.sin(th) * R) - 40;
            const w = 0.6 + r() * 0.4, t = r();
            col.set(t < 0.2 ? [w, w * 0.8, w * 0.7] : t < 0.4 ? [w * 0.75, w * 0.85, w] : [w, w, w], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true, opacity: 0.9 }));
        this.scene.add(p);
        return p;
    }

    /** Streaks rushing past the camera: the ship is always flying in. */
    makeSpeedLines() {
        const n = 90, pos = new Float32Array(n * 6);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
        const l = new THREE.LineSegments(g, mat);
        l.userData.seeds = Array.from({ length: n }, (_, i) => ({ x: ((i * 7919) % 97) / 97 * 2 - 1, y: ((i * 104729) % 89) / 89 * 2 - 1, z: (i / n) }));
        l.frustumCulled = false;
        this.scene.add(l);
        return l;
    }

    /** The screen rect (CSS px) the 3D scene should be centred in; the board covers the rest. */
    setRegion(r) { this.region = r; this.applyView(); }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.composer.setPixelRatio(dpr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(w / 2, h / 2);
        this.film.uniforms.uRes.value.set(w * dpr, h * dpr);
        this.applyView();
        return true;
    }

    applyView() {
        const { w, h } = this;
        if (!w) return;
        const r = this.region;
        const rw = Math.max(80, r.w), rh = Math.max(80, r.h);
        const aspect = rw / rh;
        // the fov the region itself should show: 50° tall when it is wide, about 64° across when it is narrow
        const want = aspect >= 1.15 ? 50 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / aspect));
        const t = Math.tan(THREE.MathUtils.degToRad(Math.min(want, 96)) / 2) * (h / rh);
        this.camera.aspect = w / h;
        this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
        this.camera.updateProjectionMatrix();
        // shift the projection so the camera's axis lands at the region's centre
        const ox = (r.x + rw / 2) / w * 2 - 1, oy = 1 - (r.y + rh / 2) / h * 2;
        this.camera.projectionMatrix.elements[8] = -ox;
        this.camera.projectionMatrix.elements[9] = -oy;
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }

    /** A world point → client px. */
    toScreen(v) {
        const p = v.clone().project(this.camera);
        return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, behind: p.z > 1 };
    }

    frame(dt, time, { warp = 1 } = {}) {
        this.resize();
        // the camera breathes, shakes on hits
        this.shake = Math.max(0, this.shake - dt * 2.2);
        const s = this.shake * this.shake;
        const cam = this.camera;
        cam.position.set(
            this.camBase.x + Math.sin(time * 0.31) * 0.35 + (Math.sin(time * 61) * 0.5) * s * 0.8,
            this.camBase.y + Math.sin(time * 0.43) * 0.2 + (Math.sin(time * 47 + 1) * 0.5) * s * 0.8,
            this.camBase.z,
        );
        cam.lookAt(this.camLook);
        // speed lines
        const pos = this.speed.geometry.attributes.position.array;
        this.speed.userData.seeds.forEach((sd, i) => {
            sd.z = (sd.z + dt * 0.9 * warp) % 1;
            const z = -120 + sd.z * 135, x = sd.x * 30, y = sd.y * 16 + 3;
            const len = 3 + warp * 5;
            pos.set([x, y, z, x, y, z + len], i * 6);
        });
        this.speed.geometry.attributes.position.needsUpdate = true;
        this.speed.material.opacity = 0.12 + 0.25 * Math.min(1, warp);
        this.flash = Math.max(0, this.flash - dt * 2.5);
        this.film.uniforms.uFlash.value = this.flash;
        this.film.uniforms.uTime.value = time;
        this.composer.render(dt);
    }
}
