// The renderer and its post chain, shared by every scene.
//
//   RenderPass → Sanitize (NaN/Inf to black) → UnrealBloom → PS2 → OutputPass
//
// PS2 is our own pass and carries the look: an ordered 4×4 dither down to 5 bits a channel (the
// PlayStation 2's gritty gradients), a grade, a vignette, scanlines, grain, chromatic aberration
// that kicks in on hits, horizontal glitch tearing for the Hex, a radial zoom blur for big
// skills, a flash, and the swirl-and-shatter that opens every battle.
// The canvas is sized in px from visualViewport, never 100vh.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const SanitizeShader = {
    name: 'SanitizeShader',
    uniforms: { tDiffuse: { value: null } },
    vertexShader: VERT,
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

const PS2Shader = {
    name: 'PS2Shader',
    uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uVignette: { value: 0.42 }, uGrain: { value: 0.018 }, uSat: { value: 1.1 }, uContrast: { value: 1.06 },
        uDither: { value: 0.7 }, uScan: { value: 0.07 }, uCA: { value: 0.0015 }, uGlitch: { value: 0 }, uZoom: { value: 0 },
        uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color('#ffffff') },
        uSwirl: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') }, uTintK: { value: 0 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Color('#000000') },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uTime, uVignette, uGrain, uSat, uContrast, uDither, uScan, uCA, uGlitch, uZoom, uFlash, uSwirl, uTintK, uFade;
        uniform vec3 uFlashCol, uTint, uFadeCol;
        varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float bayer(vec2 p) {
            int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
            int i = x + y * 4;
            float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
            return m[i] / 16.0 - 0.5;
        }
        void main() {
            vec2 uv = vUv;
            float aspect = uRes.x / max(uRes.y, 1.0);
            if (uSwirl > 0.0) {
                vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
                float r = length(d);
                float ang = uSwirl * uSwirl * 9.0 * max(0.0, 1.0 - r * 1.2);
                float cs = cos(ang), sn = sin(ang);
                d = mat2(cs, -sn, sn, cs) * d;
                d *= 1.0 - uSwirl * 0.5;
                vec2 cell = floor(uv * vec2(9.0, 6.0));
                float k = h(cell);
                d += (vec2(k, h(cell + 3.1)) - 0.5) * uSwirl * uSwirl * 0.2;
                uv = d / vec2(aspect, 1.0) + 0.5;
            }
            if (uGlitch > 0.0) {
                float band = floor(uv.y * 28.0 + floor(uTime * 12.0));
                float on = step(0.82, h(vec2(band, floor(uTime * 12.0))));
                uv.x += on * (h(vec2(band, 7.0)) - 0.5) * 0.09 * uGlitch;
            }
            vec2 q = uv - 0.5;
            float ca = uCA * (1.0 + uGlitch * 3.0) * (0.4 + length(q) * 2.0);
            vec3 col;
            if (uZoom > 0.0) {
                col = vec3(0.0);
                for (int i = 0; i < 8; i++) {
                    float s = 1.0 - uZoom * 0.09 * float(i) / 7.0;
                    vec2 p = q * s + 0.5;
                    col += vec3(texture2D(tDiffuse, p + q * ca).r, texture2D(tDiffuse, p).g, texture2D(tDiffuse, p - q * ca).b);
                }
                col /= 8.0;
            } else {
                col = vec3(texture2D(tDiffuse, uv + q * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - q * ca).b);
            }
            col = max(col, vec3(0.0));
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, uSat);
            col = (col - 0.5) * uContrast + 0.5;
            col = mix(col, col * uTint, uTintK);
            vec2 vq = (vUv - 0.5) * vec2(aspect, 1.0) / max(aspect, 1.0);
            col *= 1.0 - uVignette * dot(vq, vq) * 2.2;
            col *= 1.0 - uScan * (0.5 + 0.5 * sin(vUv.y * uRes.y * 1.5708));
            col += (h(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
            // PS2 colour depth: 5 bits a channel with an ordered dither
            float lv = 31.0;
            vec3 dq = floor(col * lv + 0.5 + bayer(gl_FragCoord.xy) * uDither) / lv;
            col = mix(col, dq, step(0.001, uDither));
            col = mix(col, uFlashCol, clamp(uFlash + uSwirl * uSwirl * uSwirl * 0.9, 0.0, 1.0));
            col = mix(col, uFadeCol, uFade);
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
        this.r.setClearColor('#0a1a1c');
        this.scene = null;
        this.camera = null;
        this.composer = new EffectComposer(this.r);
        this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
        this.composer.addPass(this.renderPass);
        this.composer.addPass(new ShaderPass(SanitizeShader));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.95);
        this.composer.addPass(this.bloom);
        this.ps2 = new ShaderPass(PS2Shader);
        this.composer.addPass(this.ps2);
        this.composer.addPass(new OutputPass());
        this.quality = 2;
        this.flash = 0; this.shake = 0; this.ca = 0; this.swirl = 0; this.zoom = 0; this.glitch = 0; this.fade = 0;
        this.w = 0; this.h = 0;
        this.calm = false;
        this.resize();
        const onResize = () => { this.dirty = true; };
        addEventListener('resize', onResize);
        visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.quality = q;
        this.r.shadowMap.enabled = q > 0;
        this.bloom.enabled = q > 0;
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
        const bs = this.quality >= 2 ? 2 : 4;
        this.bloom.resolution.set((w * pr) / bs, (h * pr) / bs);
        this.ps2.uniforms.uRes.value.set(w * pr, h * pr);
        this.aspect = w / h;
    }

    use(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
    }

    doFlash(color = '#ffffff', k = 0.7) {
        this.ps2.uniforms.uFlashCol.value.set(color);
        this.flash = Math.max(this.flash, this.calm ? k * 0.5 : k);
    }
    doShake(k = 0.5) { this.shake = Math.max(this.shake, this.calm ? k * 0.4 : k); this.ca = Math.max(this.ca, k); }
    tint(color, k) { this.ps2.uniforms.uTint.value.set(color); this.ps2.uniforms.uTintK.value = k; }
    grade({ sat = 1.1, contrast = 1.06, vignette = 0.42 } = {}) {
        const U = this.ps2.uniforms;
        U.uSat.value = sat; U.uContrast.value = contrast; U.uVignette.value = vignette;
    }
    setFade(k, color = '#000000') { this.fade = k; this.ps2.uniforms.uFadeCol.value.set(color); }

    render(dt, t) {
        this.resize();
        if (this.camera && this.camera.aspect !== this.aspect) {
            this.camera.aspect = this.aspect;
            this.camera.updateProjectionMatrix();
        }
        const U = this.ps2.uniforms;
        U.uTime.value = t;
        this.flash = Math.max(0, this.flash - dt * 2.4);
        this.shake = Math.max(0, this.shake - dt * 3);
        this.ca = Math.max(0, this.ca - dt * 2.6);
        U.uFlash.value = this.flash * this.flash;
        U.uSwirl.value = this.swirl;
        U.uCA.value = 0.0012 + this.ca * 0.012;
        U.uGlitch.value = this.glitch;
        U.uZoom.value = this.zoom;
        U.uFade.value = this.fade;
        U.uDither.value = this.quality >= 1 ? 0.7 : 0.45;
        this.composer.render(dt);
    }
}
