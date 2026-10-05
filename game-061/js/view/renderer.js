// Renderer, post chain (bloom → lens pass → output) and quality tiers.
// Gotchas: updateProjectionMatrix() after any FOV/aspect change; THREE.Color takes 0..1 floats;
// custom ShaderMaterials must include the logdepthbuf chunks because the renderer uses a log depth buffer.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LensShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uCA: { value: 0.0015 },
        uVignette: { value: 0.9 },
        uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
        uDamage: { value: 0 },
        uGrain: { value: 0.035 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime, uCA, uVignette, uDamage, uGrain; uniform vec4 uFlash;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
            vec2 c = vUv - 0.5;
            float r2 = dot(c,c);
            vec2 off = c * (uCA + r2 * uCA * 2.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + off).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - off).b;
            float vig = smoothstep(0.85, 0.2, r2 * uVignette * 1.6);
            col *= mix(0.55, 1.0, vig);
            col = mix(col, uFlash.rgb, uFlash.a);
            col += vec3(0.6, 0.02, 0.05) * uDamage * smoothstep(0.1, 0.5, r2);
            col += (hash(vUv * 900.0 + uTime) - 0.5) * uGrain * (0.3 + dot(col, vec3(0.3)));
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export const TIERS = [
    { name: 'High',   pr: 2,    bloom: true,  bloomScale: 1,   particles: 1,   dust: 1 },
    { name: 'Medium', pr: 1.5,  bloom: true,  bloomScale: 0.6, particles: 0.75, dust: 0.7 },
    { name: 'Low',    pr: 1,    bloom: true,  bloomScale: 0.5, particles: 0.5, dust: 0.45 },
    { name: 'Potato', pr: 0.75, bloom: false, bloomScale: 0.5, particles: 0.3, dust: 0.25 },
];

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true, stencil: false });
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.toneMappingExposure = 1.05;
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.gl.setClearColor(0x000000, 1);
        this.tier = 1;
        this.auto = true;
        this.slow = 0;
        this.fast = 0;
        this.w = 1; this.h = 1;
        this.composer = null;
    }

    setup(scene, camera) {
        this.scene = scene; this.camera = camera;
        this.composer = new EffectComposer(this.gl);
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.72);
        this.composer.addPass(this.bloom);
        this.lens = new ShaderPass(LensShader);
        this.composer.addPass(this.lens);
        this.composer.addPass(new OutputPass());
        this.applyTier();
    }

    setTier(t, manual = false) {
        this.tier = Math.max(0, Math.min(TIERS.length - 1, t));
        if (manual) this.auto = false;
        this.applyTier();
    }
    applyTier() {
        const T = TIERS[this.tier];
        const pr = Math.min(window.devicePixelRatio || 1, T.pr);
        this.gl.setPixelRatio(pr);
        if (this.bloom) this.bloom.enabled = T.bloom;
        this.resize(this.w, this.h);
    }
    get T() { return TIERS[this.tier]; }

    resize(w, h) {
        this.w = Math.max(1, w); this.h = Math.max(1, h);
        this.gl.setSize(this.w, this.h, false);
        if (this.composer) {
            this.composer.setPixelRatio(this.gl.getPixelRatio());
            this.composer.setSize(this.w, this.h);
            const s = this.T.bloomScale;
            this.bloom.resolution.set(Math.round(this.w * s), Math.round(this.h * s));
        }
        if (this.camera) { this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix(); }
    }

    // Drop a tier after several consecutive slow samples; never raise automatically mid-play.
    sampleFps(fps) {
        if (!this.auto) return;
        if (fps > 0 && fps < 38) this.slow++; else this.slow = 0;
        if (this.slow >= 4 && this.tier < TIERS.length - 1) { this.slow = 0; this.setTier(this.tier + 1); }
    }

    render(dt) {
        this.lens.uniforms.uTime.value = (this.lens.uniforms.uTime.value + dt) % 100;
        this.composer.render(dt);
    }
}

// Shared GLSL: hash-based 3D value noise + FBM (cheap, no textures).
export const NOISE_GLSL = /* glsl */`
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i+vec3(0,0,0)), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s; }
float ridged(vec3 p, int oct){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0)); p = p * 2.1 + vec3(3.1, 1.3, 7.7); a *= 0.5; } return s; }
`;

// JS twin of the noise for CPU-side geometry displacement.
export function makeNoise3(seed = 1) {
    const h = (x, y, z) => {
        let n = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1442695041) | 0;
        n = (n ^ (n >>> 13)) * 1274126177 | 0;
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y, z) => {
        const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
        const L = (a, b, t) => a + (b - a) * t;
        return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), xf), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
            L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
    };
}

// Soft radial sprite texture (for glows, particles, coronas).
let _glowTex = null;
export function glowTexture() {
    if (_glowTex) return _glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(c);
    _glowTex.colorSpace = THREE.SRGBColorSpace;
    return _glowTex;
}
