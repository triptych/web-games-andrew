/**
 * scene.js — renderer, the two scenes and cameras, the post chain, resize and
 * quality tiers.
 *
 * Two layers, one composer:
 *   worldScene / worldCam — the realm, the monsters, the hero (perspective, framed per layout)
 *   cardScene  / cardCam  — the table, the hand and screen-space fx. Narrow-FOV perspective
 *                           placed so that at z = 0 one world unit is one CSS pixel,
 *                           with (0,0) at the screen centre and +y up. Layout is done
 *                           in pixels; cards still tilt and flip in real 3D.
 *
 * Post: RenderPass(world) → RenderPass(cards, no clear) → Bloom → Grade → Output.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export let renderer, composer, worldScene, worldCam, cardScene, cardCam, bloomPass, gradePass;
export const view = { w: 1, h: 1, dpr: 1, quality: 0, portrait: false, cardDist: 1000 };

const CARD_FOV = 20;

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.9 },
        uGrain: { value: 0.035 },
        uAberr: { value: 0 },
        uFlash: { value: new THREE.Vector3(0, 0, 0) },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uSat: { value: 1.08 },
        uDim: { value: 0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uVignette, uGrain, uAberr, uSat, uDim;
        uniform vec3 uFlash, uTint;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 d = vUv - 0.5;
            float r2 = dot(d, d);
            vec3 col;
            if (uAberr > 0.0001) {
                vec2 off = d * min(uAberr, 1.5) * 0.012;
                col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
            } else {
                col = texture2D(tDiffuse, vUv).rgb;
            }
            float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col = mix(vec3(l), col, uSat);
            col *= uTint;
            col *= mix(1.0, 1.0 - uVignette * 0.9, smoothstep(0.12, 0.62, r2 * 1.6));
            col += uFlash;
            col *= 1.0 - uDim;
            float g = hash(vUv * 1000.0 + fract(uTime * 7.3)) - 0.5;
            col += g * uGrain * (0.4 + l);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
    `,
};

export function initScene(canvasParent) {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasParent.appendChild(renderer.domElement);

    worldScene = new THREE.Scene();
    worldCam = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
    cardScene = new THREE.Scene();
    cardCam = new THREE.PerspectiveCamera(CARD_FOV, 1, 10, 20000);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(worldScene, worldCam));
    const cardPass = new RenderPass(cardScene, cardCam);
    cardPass.clear = false;
    cardPass.clearDepth = true;
    composer.addPass(cardPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    composer.addPass(bloomPass);
    gradePass = new ShaderPass(GradeShader);
    composer.addPass(gradePass);
    composer.addPass(new OutputPass());

    window.addEventListener('resize', resize);
    resize();
}

export function setQuality(q) {
    view.quality = Math.max(0, Math.min(2, q));
    renderer.shadowMap.enabled = view.quality === 0;
    resize();
}

export function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dprCap = [2, 1.5, 1][view.quality];
    view.w = w; view.h = h;
    view.dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    view.portrait = h > w * 1.1;
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(w, h);
    composer.setPixelRatio(view.dpr);
    composer.setSize(w, h);
    const bs = view.quality === 2 ? 0.35 : 0.5;
    bloomPass.resolution.set(w * view.dpr * bs, h * view.dpr * bs);
    worldCam.aspect = w / h;
    worldCam.updateProjectionMatrix();
    // card camera: 1 unit = 1 px at z = 0
    cardCam.aspect = w / h;
    view.cardDist = h / (2 * Math.tan((CARD_FOV * Math.PI) / 360));
    cardCam.position.set(0, 0, view.cardDist);
    cardCam.lookAt(0, 0, 0);
    cardCam.near = view.cardDist * 0.2;
    cardCam.far = view.cardDist * 3;
    cardCam.updateProjectionMatrix();
    for (const fn of resizeHooks) fn(w, h);
}

const resizeHooks = [];
export function onResize(fn) { resizeHooks.push(fn); }

/** CSS pixel (top-left origin) → card-layer coordinates at z = 0. */
export function px2card(x, y) { return { x: x - view.w / 2, y: view.h / 2 - y }; }
export function card2px(x, y) { return { x: x + view.w / 2, y: view.h / 2 - y }; }

const _v = new THREE.Vector3();
/** World position → CSS pixel. */
export function world2px(p) {
    _v.copy(p).project(worldCam);
    return { x: (_v.x * 0.5 + 0.5) * view.w, y: (-_v.y * 0.5 + 0.5) * view.h, behind: _v.z > 1 };
}

export function render(dt, t) {
    gradePass.uniforms.uTime.value = t;
    composer.render(dt);
}
