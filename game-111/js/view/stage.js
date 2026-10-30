// The stage: renderer, camera, and the post chain RenderPass → bloom → the arcane lens → OutputPass.
// The lens adds chromatic aberration, a radial ripple, a colour flash, vignette, scanlines and grain,
// all driven from game events (shake, flash, aberrate, ripple), never from the clock alone.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LENS = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberr: { value: 0 },
        uFlash: { value: new THREE.Vector3() },
        uRipple: { value: new THREE.Vector4(0.5, 0.5, -1, 0) },   // centre uv, age, strength
        uAspect: { value: 1 },
        uCalm: { value: 0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uAberr, uAspect, uCalm;
        uniform vec3 uFlash;
        uniform vec4 uRipple;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            // a shock ring spreading from where light was released
            if (uRipple.z >= 0.0) {
                vec2 d = uv - uRipple.xy; d.x *= uAspect;
                float r = length(d);
                float front = uRipple.z * 1.4;
                float w = smoothstep(0.12, 0.0, abs(r - front)) * uRipple.w * (1.0 - clamp(uRipple.z, 0.0, 1.0));
                uv -= normalize(d + 1e-5) * w * 0.018 * vec2(1.0 / uAspect, 1.0);
            }
            vec2 c = uv - 0.5;
            float dist = length(c);
            float ab = (0.001 + uAberr * 0.0045) * dist;
            vec3 col;
            col.r = texture2D(tDiffuse, uv + c * ab * 2.0).r;
            col.g = texture2D(tDiffuse, uv).g;
            col.b = texture2D(tDiffuse, uv - c * ab * 2.0).b;
            col += uFlash;
            // vignette, scanlines and grain (the calm setting drops the last two)
            col *= mix(1.0, smoothstep(0.95, 0.25, dist), 0.65);
            float scan = 0.97 + 0.03 * sin(gl_FragCoord.y * 1.7);
            col *= mix(scan, 1.0, uCalm);
            col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.025 * (1.0 - uCalm);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }`,
};

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;     // ACES bleaches neon to white
        this.renderer.setClearColor(0x05030c);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
        this.camera.position.set(0, 0, 40);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // only glyph edges, sigils, beams and sparks cross the threshold, never the plate or the sky
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.6, 0.62);
        this.composer.addPass(this.bloom);
        this.lens = new ShaderPass(LENS);
        this.composer.addPass(this.lens);
        this.composer.addPass(new OutputPass());

        this.shakeAmt = 0;
        this.flashCol = new THREE.Vector3();
        this.aberr = 0;
        this.rippleAge = -1;
        this.rippleStrength = 0;
        this.calm = false;
        this.base = new THREE.Vector3();
    }

    setSize(w, h) {
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        // bloom at half resolution: looks the same, a quarter of the fill
        this.bloom.resolution.set(Math.max(1, (w * pr) / 2), Math.max(1, (h * pr) / 2));
        this.lens.uniforms.uAspect.value = w / h;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    shake(a) { if (!this.calm) this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
    flash(r, g, b) { const k = this.calm ? 0.35 : 0.6; this.flashCol.set(Math.max(this.flashCol.x, r * k), Math.max(this.flashCol.y, g * k), Math.max(this.flashCol.z, b * k)); }
    aberrate(a) { this.aberr = Math.min(1.5, this.aberr + (this.calm ? a * 0.3 : a)); }
    /** A lens ripple from a screen point (uv, 0..1 with y up). */
    ripple(u, v, strength = 1) {
        if (this.calm) return;
        this.lens.uniforms.uRipple.value.set(u, v, 0, strength);
        this.rippleAge = 0;
    }

    render(dt, time) {
        const L = this.lens.uniforms;
        L.uTime.value = time;
        L.uCalm.value = this.calm ? 1 : 0;
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.6);
        this.aberr = Math.max(0, this.aberr - dt * 2.2);
        this.flashCol.multiplyScalar(Math.max(0, 1 - dt * 5));
        L.uAberr.value = this.aberr;
        L.uFlash.value.copy(this.flashCol);
        if (this.rippleAge >= 0) {
            this.rippleAge += dt * 1.1;
            L.uRipple.value.z = this.rippleAge;
            if (this.rippleAge > 1) { this.rippleAge = -1; L.uRipple.value.z = -1; }
        }
        // shake the camera about its fitted spot
        const s = this.shakeAmt * this.shakeAmt * 0.35;
        this.camera.position.set(
            this.base.x + (Math.sin(time * 61) + Math.sin(time * 37)) * s,
            this.base.y + (Math.sin(time * 53) + Math.cos(time * 29)) * s,
            this.base.z,
        );
        this.composer.render(dt);
    }
}
