/**
 * renderer.js — WebGLRenderer, the post-processing chain, quality tiers and resizing.
 *
 *   world RenderPass → viewmodel RenderPass (own depth) → Sanitize (kill NaN/Inf)
 *   → UnrealBloom (half res) → FX pass (god rays, shout ripple, underwater, damage/frost/heal, linear)
 *   → OutputPass (ACES + sRGB) → Grade (curves, saturation, vignette, grain) → FXAA (when no MSAA)
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { QUALITY } from '../config.js';

const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a);
        }`,
};

const FxShader = {
    uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uSun: { value: new THREE.Vector3(0.5, 0.5, 0) },      // screen uv, z = visibility
        uSunTint: { value: new THREE.Color(1, 0.85, 0.6) },
        uRays: { value: 0.0 },
        uRaySteps: { value: 24 },
        uRipple: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, // centre, age, strength
        uUnder: { value: 0 },
        uTime: { value: 0 },
        uSlow: { value: 0 },
        uSoul: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; varying vec2 vUv;
        uniform vec2 uRes; uniform vec3 uSun; uniform vec3 uSunTint; uniform float uRays; uniform float uRaySteps;
        uniform vec4 uRipple; uniform float uUnder; uniform float uTime; uniform float uSlow; uniform float uSoul;
        float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        void main() {
            vec2 uv = vUv;
            // shout ripple: an expanding ring that bends the picture
            if (uRipple.w > 0.0) {
                vec2 d = (uv - uRipple.xy) * vec2(uRes.x / uRes.y, 1.0);
                float r = length(d), ring = uRipple.z * 1.4;
                float k = exp(-pow((r - ring) * 9.0, 2.0)) * uRipple.w;
                uv -= normalize(d + 1e-5) * k * 0.035 / vec2(uRes.x / uRes.y, 1.0);
            }
            if (uUnder > 0.0) uv += vec2(sin(uv.y * 24.0 + uTime * 2.0), cos(uv.x * 20.0 + uTime * 1.7)) * 0.0025 * uUnder;
            vec3 c = texture2D(tDiffuse, uv).rgb;
            // god rays: march toward the sun gathering bright sky
            if (uRays > 0.0 && uSun.z > 0.0) {
                vec2 dir = (uSun.xy - uv);
                float steps = uRaySteps;
                vec2 st = dir / steps;
                vec2 p = uv;
                float acc = 0.0, w = 1.0;
                float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                p += st * jitter;
                for (int i = 0; i < 40; i++) {
                    if (float(i) >= steps) break;
                    vec3 s = texture2D(tDiffuse, p).rgb;
                    acc += max(lum(s) - 1.2, 0.0) * w;
                    w *= 0.96;
                    p += st;
                }
                float fall = 1.0 - smoothstep(0.0, 0.75, length(dir * vec2(uRes.x / uRes.y, 1.0)));
                c += uSunTint * acc / steps * uRays * uSun.z * fall * 1.6;
            }
            if (uUnder > 0.0) {
                float depthTint = 0.55;
                c = mix(c, vec3(0.02, 0.09, 0.12) + c * vec3(0.18, 0.45, 0.55), uUnder * depthTint);
            }
            if (uSoul > 0.0) {
                float l = lum(c);
                c = mix(c, vec3(l) * vec3(1.25, 1.1, 0.75) + vec3(0.06, 0.04, 0.0), uSoul * 0.5);
            }
            if (uSlow > 0.0) {
                float l = lum(c);
                c = mix(c, vec3(l) * vec3(0.8, 0.95, 1.2), uSlow * 0.6);
            }
            gl_FragColor = vec4(c, 1.0);
        }`,
};

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.32 },
        uGrain: { value: 0.035 },
        uSat: { value: 1.05 },
        uContrast: { value: 1.06 },
        uLift: { value: new THREE.Color(0.0, 0.004, 0.012) },
        uGain: { value: new THREE.Color(1.0, 0.99, 0.97) },
        uDamage: { value: 0 },
        uFrost: { value: 0 },
        uHeal: { value: 0 },
        uLowHp: { value: 0 },
        uFade: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; varying vec2 vUv;
        uniform float uTime, uVignette, uGrain, uSat, uContrast, uDamage, uFrost, uHeal, uLowHp, uFade;
        uniform vec3 uLift, uGain; uniform vec2 uRes;
        float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main() {
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, uSat * (1.0 - uLowHp * 0.7));
            c = (c - 0.5) * uContrast + 0.5;
            c = c * uGain + uLift * (1.0 - c);
            vec2 q = vUv - 0.5;
            float r = length(q * vec2(uRes.x / uRes.y, 1.0) * 0.9);
            float vig = smoothstep(0.85, 0.25, r);
            c *= mix(1.0, vig, uVignette);
            // damage: a red rim that pulses; frost: icy blue rim; heal: warm golden rim
            float rim = smoothstep(0.35, 0.95, r);
            c = mix(c, vec3(0.55, 0.02, 0.02), rim * uDamage * 0.8);
            c = mix(c, vec3(0.75, 0.88, 1.0), rim * uFrost * 0.7 * (0.7 + 0.3 * h12(floor(vUv * 90.0))));
            c += vec3(1.0, 0.8, 0.4) * rim * uHeal * 0.25;
            c += (h12(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
            c = mix(c, vec3(0.0), uFade);
            gl_FragColor = vec4(max(c, 0.0), 1.0);
        }`,
};

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.9;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.shadowMap.autoUpdate = true;
        this.gl = gl;
        this.maxAniso = gl.capabilities.getMaxAnisotropy();
        this.tier = 1;
        this.q = QUALITY[1];
        this.dynScale = 1;
        this.w = 0; this.h = 0;
        this.resizePending = true;
        this.fx = FxShader.uniforms;
        this.grade = GradeShader.uniforms;
        this.composer = null;
        this.onResize = null;
        const vv = window.visualViewport;
        const req = () => { this.resizePending = true; };
        window.addEventListener('resize', req);
        if (vv) vv.addEventListener('resize', req);
    }

    /** Build the composer for the current tier (and rebuild on tier change). */
    build(scene, camera, vmScene, vmCamera) {
        this.scene = scene; this.camera = camera; this.vmScene = vmScene; this.vmCamera = vmCamera;
        if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); }
        const q = this.q;
        const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa });
        const c = new EffectComposer(this.gl, rt);
        c.addPass(new RenderPass(scene, camera));
        if (vmScene) {
            const vp = new RenderPass(vmScene, vmCamera);
            vp.clear = false; vp.clearDepth = true;
            c.addPass(vp);
            this.vmPass = vp;
        }
        c.addPass(new ShaderPass(SanitizeShader));
        this.bloom = null;
        if (q.bloom > 0) {
            this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32 * q.bloom, 0.55, 0.92);
            c.addPass(this.bloom);
        }
        this.fxPass = new ShaderPass(FxShader);
        this.fxPass.uniforms = FxShader.uniforms;
        this.fxPass.material.uniforms = FxShader.uniforms;
        c.addPass(this.fxPass);
        c.addPass(new OutputPass());
        this.gradePass = new ShaderPass(GradeShader);
        this.gradePass.uniforms = GradeShader.uniforms;
        this.gradePass.material.uniforms = GradeShader.uniforms;
        c.addPass(this.gradePass);
        this.fxaa = null;
        if (q.fxaa) { this.fxaa = new ShaderPass(FXAAShader); c.addPass(this.fxaa); }
        this.composer = c;
        this.fx.uRaySteps.value = [32, 24, 12, 0][this.tier];
        this.resizePending = true;
    }

    setTier(t, rebuild = true) {
        t = Math.max(0, Math.min(3, t));
        this.tier = t;
        this.q = QUALITY[t];
        this.gl.shadowMap.enabled = this.q.shadow > 0;
        if (rebuild && this.scene) this.build(this.scene, this.camera, this.vmScene, this.vmCamera);
    }

    viewport() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
        return [w, h];
    }

    applyResize() {
        const [w, h] = this.viewport();
        const pr = Math.min(window.devicePixelRatio || 1, this.q.pr) * this.dynScale;
        if (w === this.w && h === this.h && pr === this.pr) { this.resizePending = false; return; }
        this.w = w; this.h = h; this.pr = pr;
        this.gl.setPixelRatio(pr);
        this.gl.setSize(w, h);           // sets the canvas CSS size in px (never vh/vw)
        if (this.composer) {
            this.composer.setPixelRatio(pr);
            this.composer.setSize(w, h);
            if (this.bloom) this.bloom.resolution.set(w * pr / 2, h * pr / 2);
            if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
        }
        this.fx.uRes.value.set(w, h);
        this.grade.uRes.value.set(w, h);
        if (this.onResize) this.onResize(w, h);
        this.resizePending = false;
    }

    render(dt) {
        if (this.resizePending) this.applyResize();
        this.composer.render(dt);
    }

    /** Called with a smoothed frame time; nudges resolution, and reports when a tier drop is due. */
    adapt(fps) {
        this._slow = fps < 28 ? (this._slow || 0) + 1 : 0;
        this._fast = fps > 55 ? (this._fast || 0) + 1 : 0;
        if (fps < 34 && this.dynScale > 0.7) { this.dynScale = Math.max(0.7, this.dynScale - 0.08); this.resizePending = true; }
        else if (fps > 52 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.04); this.resizePending = true; }
        return this._slow >= 4;
    }
}
