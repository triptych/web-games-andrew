/**
 * scene.js — renderer, camera, lights, the post stack and quality tiers,
 * plus the shared shader patch that lights every surface from the baked
 * per-sector lightmap.
 *
 * Gotchas: camera.updateProjectionMatrix() after any aspect change; the
 * render delta is capped by main.js; THREE.Color takes 0..1 floats.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export let renderer, scene, camera, composer, bloom, grade;
export const Q = { tier: 'high', pixel: 1, bloom: true, shadows: true, particles: 1, lights: 6, decalRes: 12, cap: 260 };

/** Uniforms shared by every lightmapped material (same objects, so one update reaches all). */
export const LM = {
    uLM: { value: null },
    uLMSize: { value: new THREE.Vector2(1, 1) },
    uLMScale: { value: 1.35 },
    uAlarm: { value: new THREE.Color(0, 0, 0) },
    uTime: { value: 0 },
};

const TIERS = {
    low:    { pixel: 0.75, bloom: false, shadows: false, particles: 0.45, lights: 3, decalRes: 8, cap: 150 },
    medium: { pixel: 1,    bloom: true,  shadows: false, particles: 0.75, lights: 4, decalRes: 10, cap: 210 },
    high:   { pixel: 1.5,  bloom: true,  shadows: true,  particles: 1,    lights: 6, decalRes: 12, cap: 260 },
};

export function detectTier() {
    const touch = matchMedia('(pointer: coarse)').matches;
    const mem = navigator.deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    if (touch) return mem <= 3 || cores <= 4 ? 'low' : 'medium';
    return mem <= 4 || cores <= 4 ? 'medium' : 'high';
}

export function initScene(canvas, tier) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020304);
    camera = new THREE.PerspectiveCamera(38, 1, 0.5, 140);
    camera.position.set(0, 20, 12);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.86);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    setTier(tier);
    resize();
    return { renderer, scene, camera };
}

export function setTier(tier) {
    Q.tier = TIERS[tier] ? tier : 'medium';
    Object.assign(Q, TIERS[Q.tier]);
    renderer.shadowMap.enabled = Q.shadows;
    bloom.enabled = Q.bloom;
    resize();
}

let dynScale = 1;
export function setDynScale(s) { dynScale = Math.max(0.5, Math.min(1, s)); resize(); }
export function getDynScale() { return dynScale; }

export function resize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, Q.pixel) * dynScale;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    grade.uniforms.uRes.value.set(w * pr, h * pr);
}

export function isPortrait() { return window.innerHeight > window.innerWidth * 1.05; }

/** Camera distance so the view shows about targetW × targetH metres. */
export function viewDistance() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = isPortrait();
    const tw = portrait ? 12.5 : 21.5, th = portrait ? 20 : 13.2;
    return Math.max(tw / (2 * t * camera.aspect), th / (2 * t));
}

// ------------------------------------------------------------------ Shake & post

const shakeState = { trauma: 0, t: 0 };
export function shake(amount) { shakeState.trauma = Math.min(1, shakeState.trauma + amount); }
export function shakeOffset(dt, enabled) {
    shakeState.t += dt;
    shakeState.trauma = Math.max(0, shakeState.trauma - dt * 1.6);
    if (!enabled) return { x: 0, y: 0, r: 0 };
    const s = shakeState.trauma * shakeState.trauma;
    const t = shakeState.t * 32;
    return {
        x: (Math.sin(t * 1.13) + Math.sin(t * 2.71) * 0.5) * s * 0.55,
        y: (Math.sin(t * 1.71 + 2) + Math.sin(t * 3.1) * 0.5) * s * 0.55,
        r: Math.sin(t * 0.93 + 5) * s * 0.025,
    };
}

export const post = { ca: 0, hurt: 0, low: 0, flash: 0, sat: 1 };

export function updatePost(dt, time) {
    post.ca = Math.max(0, post.ca - dt * 2.5);
    post.hurt = Math.max(0, post.hurt - dt * 1.8);
    post.flash = Math.max(0, post.flash - dt * 3);
    const u = grade.uniforms;
    u.uCA.value = 0.0012 + post.ca * 0.012;
    u.uHurt.value = post.hurt;
    u.uLow.value = post.low;
    u.uFlash.value = post.flash;
    u.uTime.value = time;
    u.uSat.value = post.sat;
}

export function render() { composer.render(); }

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uCA: { value: 0.002 },
        uHurt: { value: 0 },
        uLow: { value: 0 },
        uFlash: { value: 0 },
        uTime: { value: 0 },
        uSat: { value: 1 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uCA, uHurt, uLow, uFlash, uTime, uSat;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);
            vec2 off = c * uCA * (0.4 + r2 * 3.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + off).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - off).b;
            // Grade: cool shadows, warm highlights.
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(col, col * vec3(0.92, 1.0, 1.08), (1.0 - smoothstep(0.0, 0.5, l)) * 0.4);
            col = mix(vec3(l), col, uSat * (1.0 - uLow * 0.55));
            // Low health: a heartbeat of red at the edges.
            float beat = pow(max(0.0, sin(uTime * 7.5)), 8.0) * uLow;
            float edge = smoothstep(0.12, 0.42, r2);
            col = mix(col, vec3(0.55, 0.02, 0.02), edge * clamp(uHurt * 0.9 + beat * 0.5 + uLow * 0.18, 0.0, 0.85));
            col += vec3(1.0, 0.95, 0.9) * uFlash * 0.35;
            // Vignette, grain, scanlines.
            col *= 1.0 - r2 * 1.05;
            col += (hash(vUv * uRes + fract(uTime * 13.1)) - 0.5) * 0.035;
            col *= 0.975 + 0.025 * sin(vUv.y * uRes.y * 1.6);
            gl_FragColor = vec4(col, 1.0);
        }
    `,
};

// ------------------------------------------------------------------ Lightmap patch

/**
 * Patch a MeshStandardMaterial so it adds the baked sector lightmap (and the
 * alarm channel) to its indirect diffuse light. opts.extra adds GLSL.
 */
export function patchLit(mat, opts = {}) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
        Object.assign(shader.uniforms, LM, opts.uniforms ?? {});
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                varying vec3 vLMW; varying vec3 vLMN; uniform float uTime;
                ${opts.vertexPars ?? ''}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                ${opts.vertexBegin ?? ''}`)
            .replace('#include <project_vertex>', `#include <project_vertex>
                {
                    vec4 lmw = vec4(transformed, 1.0);
                    vec3 lmn = objectNormal;
                    #ifdef USE_INSTANCING
                        lmw = instanceMatrix * lmw;
                        lmn = mat3(instanceMatrix) * lmn;
                    #endif
                    lmw = modelMatrix * lmw;
                    vLMW = lmw.xyz;
                    vLMN = normalize(mat3(modelMatrix) * lmn);
                }
                ${opts.vertexEnd ?? ''}`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform sampler2D uLM; uniform vec2 uLMSize; uniform float uLMScale; uniform vec3 uAlarm; uniform float uTime;
                varying vec3 vLMW; varying vec3 vLMN;
                ${opts.fragmentPars ?? ''}`)
            .replace('#include <map_fragment>', `#include <map_fragment>
                ${opts.mapFragment ?? ''}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                ${opts.emissiveFragment ?? ''}`)
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                {
                    vec2 lmUv = (vLMW.xz + vLMN.xz * 0.5) / uLMSize;
                    vec4 lm = texture2D(uLM, lmUv);
                    float hFall = 1.0 - clamp(vLMW.y * 0.12, 0.0, 0.25);
                    reflectedLight.indirectDiffuse += diffuseColor.rgb * (lm.rgb * uLMScale + lm.a * uAlarm) * hFall;
                }
                ${opts.lightFragment ?? ''}`);
        if (opts.onShader) opts.onShader(shader);
        if (prev) prev(shader, r);
    };
    mat.customProgramCacheKey = () => opts.key ?? 'lit';
    return mat;
}
