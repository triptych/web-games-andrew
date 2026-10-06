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

export let renderer, scene, camera, composer, bloom;
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
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    const bloomScale = quality === 0 ? 0.5 : 0.35;
    bloom.resolution.set(Math.max(64, w * bloomScale), Math.max(64, h * bloomScale));
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

export function render() { composer.render(); }

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
