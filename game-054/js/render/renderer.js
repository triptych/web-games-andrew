/**
 * renderer.js — WebGL renderer, cameras, the post-processing chain and the
 * dynamic light pool.
 *
 * Passes:
 *   RenderPass(world)                — the level, monsters, effects
 *   RenderPass(viewmodel, depth only)— the gun, drawn over everything
 *   UnrealBloomPass (half res)       — threshold high so only emission blooms
 *   FinalPass                        — grade, vignette, damage/pickup flashes,
 *                                      powerup looks (berserk red, overdrive
 *                                      purple, Aegis inverted, haste speed
 *                                      lines, cloak shimmer, hazard green),
 *                                      chromatic aberration kicks, low-health
 *                                      desaturation, heat shimmer, grain, fade
 *   OutputPass                       — ACES tone mapping + sRGB
 *
 * Quality tiers move pixels, not features: pixel ratio, render scale, bloom,
 * light count, particle budget.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G } from './materials.js';
import { FOV, QUALITY, MAX_DYN_LIGHTS } from '../config.js';

const FinalShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uDamage: { value: 0 },
        uPickup: { value: 0 },
        uLowHealth: { value: 0 },
        uBerserk: { value: 0 },
        uOverdrive: { value: 0 },
        uInvuln: { value: 0 },
        uHaste: { value: 0 },
        uCloak: { value: 0 },
        uSuit: { value: 0 },
        uAberration: { value: 0 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) },
        uHeat: { value: 0 },
        uGrain: { value: 0.012 },
        uFade: { value: 0 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uDeath: { value: 0 },
        uScan: { value: 0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uDamage, uPickup, uLowHealth, uBerserk, uOverdrive, uInvuln, uHaste, uCloak, uSuit;
        uniform float uAberration, uHeat, uGrain, uFade, uFlash, uDeath, uScan;
        uniform vec2 uRes;
        uniform vec3 uGrade;
        uniform vec3 uFlashColor;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
            vec2 uv = vUv;
            vec2 c = uv - 0.5;
            float r = length(c);
            // heat shimmer + cloak ripple + death wobble
            float wob = uHeat * 0.0025 + uCloak * 0.004 + uDeath * 0.01;
            uv += vec2(sin(uv.y * 40.0 + uTime * 3.0), cos(uv.x * 35.0 + uTime * 2.6)) * wob;
            // haste: radial smear
            vec3 col;
            float ab = uAberration * 0.012 + uDamage * 0.004 + uOverdrive * 0.0015 + uDeath * 0.006;
            if (uHaste > 0.0) {
                vec3 acc = vec3(0.0);
                for (int i = 0; i < 6; i++) {
                    float k = 1.0 - float(i) * 0.012 * uHaste * smoothstep(0.1, 0.6, r);
                    acc += texture2D(tDiffuse, 0.5 + (uv - 0.5) * k).rgb;
                }
                col = acc / 6.0;
            } else if (ab > 0.0) {
                vec2 dir = c * ab;
                col = vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
            } else {
                col = texture2D(tDiffuse, uv).rgb;
            }
            col *= uGrade;
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            // low health: drain colour and pulse red at the edges
            float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
            col = mix(col, vec3(lum), uLowHealth * 0.55);
            // powerups
            col = mix(col, col * vec3(1.5, 0.45, 0.4) + vec3(0.06, 0.0, 0.0), uBerserk * 0.75);
            col = mix(col, col * vec3(1.15, 0.75, 1.45) + vec3(0.03, 0.0, 0.05), uOverdrive * 0.55);
            col = mix(col, col * vec3(0.7, 1.25, 0.75), uSuit * 0.45);
            if (uInvuln > 0.0) {
                vec3 inv = vec3(1.0 - clamp(lum * 1.2, 0.0, 1.0)) * vec3(0.85, 1.0, 0.8);
                col = mix(col, inv, uInvuln);
            }
            // vignette + flashes
            float vig = smoothstep(0.85, 0.25, r);
            col *= mix(0.55, 1.0, vig);
            col += vec3(0.8, 0.0, 0.0) * uDamage * (0.35 + smoothstep(0.2, 0.75, r) * 1.4);
            col += vec3(0.6, 0.0, 0.0) * uLowHealth * smoothstep(0.35, 0.8, r) * pulse * 0.8;
            col += vec3(0.9, 0.75, 0.2) * uPickup * smoothstep(0.2, 0.8, r) * 0.6;
            col += uFlashColor * uFlash;
            // haste speed lines
            if (uHaste > 0.0) {
                float a = atan(c.y, c.x);
                float lines = step(0.92, hash(vec2(floor(a * 60.0), floor(uTime * 20.0))));
                col += vec3(0.4, 1.0, 0.95) * lines * smoothstep(0.3, 0.7, r) * uHaste * 0.35;
            }
            // terminal / map scanlines
            col *= 1.0 - uScan * 0.25 * step(0.5, fract(gl_FragCoord.y * 0.5));
            // grain
            col += (hash(uv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
            col = mix(col, col * vec3(0.8, 0.3, 0.3), uDeath * 0.6);
            col *= 1.0 - uFade;
            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
    `,
};

export class Renderer {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.domElement.id = 'gl';
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 600);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);

        this.vmScene = new THREE.Scene();
        this.vmCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);

        this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
        this.worldPass = new RenderPass(this.scene, this.camera);
        this.vmPass = new RenderPass(this.vmScene, this.vmCamera);
        this.vmPass.clear = false;
        this.vmPass.clearDepth = true;
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.82);
        this.final = new ShaderPass(FinalShader);
        this.output = new OutputPass();
        this.composer.addPass(this.worldPass);
        this.composer.addPass(this.vmPass);
        this.composer.addPass(this.bloom);
        this.composer.addPass(this.final);
        this.composer.addPass(this.output);
        this.post = this.final.uniforms;

        // dynamic light requests, collected each frame
        this.lightReqs = [];
        this.maxLights = MAX_DYN_LIGHTS;
        this.tier = 0;
        this.renderScale = 1;
        this.retro = false;
        this._resizePending = true;
        window.addEventListener('resize', () => { this._resizePending = true; });
        window.visualViewport?.addEventListener('resize', () => { this._resizePending = true; });
    }

    setQuality(tier, opts = {}) {
        this.tier = Math.max(0, Math.min(QUALITY.length - 1, tier));
        const q = QUALITY[this.tier];
        this.quality = q;
        this.maxLights = q.lights;
        this.bloom.enabled = q.bloom && opts.bloom !== false;
        this.post.uGrain.value = this.tier >= 2 ? 0.0 : 0.012;
        this.retro = !!opts.retro;
        this._resizePending = true;
    }

    _applySize() {
        const w = Math.max(1, this.container.clientWidth || window.innerWidth);
        const h = Math.max(1, this.container.clientHeight || window.innerHeight);
        const q = this.quality ?? QUALITY[0];
        let pr = Math.min(window.devicePixelRatio || 1, q.pixelRatio) * q.scale;
        if (this.retro) pr = Math.min(pr, 320 / h);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h, true);
        this.renderer.domElement.style.imageRendering = this.retro ? 'pixelated' : 'auto';
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(w * pr / 2, h * pr / 2);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.vmCamera.aspect = w / h;
        // keep the gun a sensible size in portrait
        this.vmCamera.fov = w / h < 1 ? 70 : 58;
        this.vmCamera.updateProjectionMatrix();
        this.post.uRes.value.set(w * pr, h * pr);
        this.width = w; this.height = h;
    }

    setFov(fov) {
        this.baseFov = fov;
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
    }

    /** Ask for a dynamic light this frame. priority: bigger wins. */
    light(x, y, z, color, radius, intensity = 1, priority = 1) {
        this.lightReqs.push({ x, y, z, color, radius, intensity, priority });
    }

    _assignLights() {
        const cam = this.camera.position;
        const reqs = this.lightReqs;
        for (const r of reqs) {
            const d = Math.hypot(r.x - cam.x, r.y - cam.y, r.z - cam.z);
            r.score = r.priority * r.intensity * r.radius / (1 + d * 0.15);
        }
        reqs.sort((a, b) => b.score - a.score);
        const n = Math.min(reqs.length, this.maxLights);
        for (let i = 0; i < MAX_DYN_LIGHTS; i++) {
            const v = G.uDL.value[i], c = G.uDLC.value[i];
            if (i < n) {
                const r = reqs[i];
                v.set(r.x, r.y, r.z, r.radius);
                c.setRGB(((r.color >> 16) & 255) / 255 * r.intensity, ((r.color >> 8) & 255) / 255 * r.intensity, (r.color & 255) / 255 * r.intensity);
            } else {
                v.set(0, -999, 0, 0);
            }
        }
        reqs.length = 0;
    }

    render(dt) {
        if (this._resizePending) { this._resizePending = false; this._applySize(); }
        G.uCamPos.value.copy(this.camera.getWorldPosition(new THREE.Vector3()));
        this._assignLights();
        this.post.uTime.value += dt;
        this.composer.render(dt);
    }

    /** Mean brightness of the last rendered frame (for tests). */
    brightness() {
        const gl = this.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        let sum = 0, n = 0;
        const buf = new Uint8Array(4);
        for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) {
            gl.readPixels(Math.floor((w * x) / 8), Math.floor((h * y) / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            sum += buf[0] + buf[1] + buf[2]; n += 3;
        }
        return sum / n;
    }
}
