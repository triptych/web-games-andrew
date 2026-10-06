/**
 * stage.js — renderer, scene, camera rig, bloom and quality tiers.
 *
 * The camera orbits the tree. Its distance and target height follow the tree's
 * current size, so the seed fills the frame at the start and the World Tree
 * still fits at the end. Drag (or one finger) orbits, wheel or pinch zooms.
 *
 * The HUD covers part of the screen (a side panel on desktop, a bottom sheet on
 * phones). setInsets() shifts the projection with setViewOffset so the tree is
 * centred in the part of the canvas you can actually see.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Bloom blurs the frame through a chain of ever-smaller buffers, so a single
 * NaN or infinite pixel (a shader's pow() of a rounding-error negative, say)
 * comes out as a black or white box for a frame. This pass, just before the
 * bloom, turns any such pixel into black, where one pixel is invisible. It
 * tests the float's exponent bits, which a driver's fast-math can't skip.
 */
const SanitizeShader = {
    name: 'SanitizeShader',
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = min(c, vec4(60000.0));
        }`,
};

export let renderer, scene, camera, composer, bloom, sanitize;
export const clock = new THREE.Clock();

/** Shared uniforms every custom shader reads. */
export const U = {
    uTime: { value: 0 },
    uWind: { value: 0.6 },
    uFogColor: { value: new THREE.Color(0x0b1a22) },
    uFogDensity: { value: 0.012 },
    uGlow: { value: 0.3 },                       // tree glow, grows with stage
    uSeason: { value: 0 },                       // 0..4 continuous (wraps)
    uTreeH: { value: 1 },                        // current tree height in world units
    uMoonDir: { value: new THREE.Vector3(-0.45, 0.62, -0.64).normalize() },
};

const rig = {
    yaw: 0.6, pitch: 0.18, dist: 4, target: new THREE.Vector3(0, 0.4, 0),
    wantDist: 4, wantTargetY: 0.4, zoom: 1, autoRotate: true, idle: 0,
    minPitch: 0.02, maxPitch: 1.05,
};
const insets = { right: 0, bottom: 0, top: 0 };
let quality = 1;   // 0 high, 1 medium, 2 low
let pendingResize = true;
let sizeKey = '';

export function initStage(container, q) {
    quality = q;
    renderer = new THREE.WebGLRenderer({ antialias: q === 0, powerPreference: 'high-performance' });
    renderer.setClearColor(0x050b10);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(U.uFogColor.value, U.uFogDensity.value);
    camera = new THREE.PerspectiveCamera(50, 1, 0.05, 900);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.62);
    sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(sanitize);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    window.addEventListener('resize', () => { pendingResize = true; });
    applyQuality();
}

export function getQuality() { return quality; }
export function setQuality(q) {
    q = Math.max(0, Math.min(2, q));
    if (q === quality) return;
    quality = q;
    applyQuality();
}
function applyQuality() {
    bloom.enabled = quality < 2;
    sanitize.enabled = bloom.enabled;       // without bloom a stray pixel stays one pixel
    bloom.strength = quality === 0 ? 0.9 : 0.8;
    pendingResize = true;
}

export function setInsets(right, bottom, top = 0) {
    if (insets.right === right && insets.bottom === bottom && insets.top === top) return;
    insets.right = right; insets.bottom = bottom; insets.top = top;
    pendingResize = true;
}

function resize() {
    pendingResize = false;
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, [2, 1.5, 1][quality]);
    // Reallocate the canvas and render targets only when the size really changes: an inset change just moves the camera.
    const key = `${w}x${h}@${dpr}/${quality}`;
    if (key !== sizeKey) {
        sizeKey = key;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h);
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
        const bloomScale = quality === 0 ? 0.5 : 0.35;
        bloom.resolution.set(Math.max(64, w * bloomScale), Math.max(64, h * bloomScale));
    }
    camera.aspect = w / h;
    // Centre the tree in the uncovered part of the screen.
    const visW = Math.max(200, w - insets.right), visH = Math.max(200, h - insets.bottom - insets.top);
    const ox = insets.right / 2, oy = (insets.bottom - insets.top) / 2;
    if (ox || oy) camera.setViewOffset(w, h, ox, oy, w, h);
    else camera.clearViewOffset();
    // On a narrow visible area, widen the fov a little so the tree still fits.
    const visAspect = visW / visH;
    camera.fov = visAspect < 0.8 ? 58 : 50;
    rig.visAspect = visAspect;
    rig.visFracV = visH / h;
    rig.visFracH = visW / w;
    camera.updateProjectionMatrix();
}

/** Tell the rig how big the tree is now (world units). */
export function frameTree(height, crown) {
    // the tree must fit the part of the frame the HUD leaves uncovered
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const needV = height * 1.18 + 0.6;
    const needH = Math.max(crown * 2.3, height * 0.7) + 0.6;
    const distV = needV / 2 / (tanV * (rig.visFracV || 1));
    const distH = needH / 2 / (tanV * camera.aspect * (rig.visFracH || 1));
    rig.wantDist = Math.max(2.4, Math.max(distV, distH));
    rig.wantTargetY = Math.max(0.25, height * 0.48);
}

// ------------------------------------------------------------------ input on the rig
export function orbitBy(dx, dy) {
    rig.yaw -= dx * 0.006;
    rig.pitch = Math.max(rig.minPitch, Math.min(rig.maxPitch, rig.pitch + dy * 0.004));
    rig.idle = 0;
}
export function zoomBy(f) {
    rig.zoom = Math.max(0.45, Math.min(2.2, rig.zoom * f));
    rig.idle = 0;
}
export function setAutoRotate(on) { rig.autoRotate = on; }
export function cameraState() { return { yaw: rig.yaw, pitch: rig.pitch, dist: rig.dist, zoom: rig.zoom }; }

let shake = 0;
export function kick(amount) { shake = Math.min(1, shake + amount); }

/** Jump straight to the wanted framing (first frame, after a load). */
export function snapCamera() { rig.dist = rig.wantDist * rig.zoom; rig.target.y = rig.wantTargetY; }

export function updateStage(dt) {
    if (pendingResize) resize();
    rig.idle += dt;
    if (rig.autoRotate && rig.idle > 4) rig.yaw += dt * 0.045;
    // ease toward the wanted framing
    const k = 1 - Math.exp(-dt * 1.6);
    rig.dist += (rig.wantDist * rig.zoom - rig.dist) * k;
    rig.target.y += (rig.wantTargetY - rig.target.y) * k;
    const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
    camera.position.set(
        rig.target.x + Math.sin(rig.yaw) * cp * rig.dist,
        rig.target.y + sp * rig.dist + rig.dist * 0.04,
        rig.target.z + Math.cos(rig.yaw) * cp * rig.dist,
    );
    // never look from below the ground
    camera.position.y = Math.max(0.12, camera.position.y);
    camera.lookAt(rig.target);
    if (shake > 0) {
        shake = Math.max(0, shake - dt * 2.5);
        const s = shake * shake * rig.dist * 0.006;
        camera.position.x += (Math.random() - 0.5) * s;
        camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.near = Math.max(0.03, rig.dist * 0.01);
    camera.far = Math.max(400, rig.dist * 12);
    camera.updateProjectionMatrix();
    scene.fog.density = U.uFogDensity.value;
}

export function render() {
    // count draw calls for the whole frame (bloom + output passes included), not just the last pass
    renderer.info.autoReset = false;
    renderer.info.reset();
    composer.render();
}

/** Project a world point to client pixels. */
const _v = new THREE.Vector3();
export function toScreen(p) {
    _v.copy(p).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight, behind: _v.z > 1 };
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function rayFrom(clientX, clientY) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
}
