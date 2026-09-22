/**
 * scene.js — renderer, camera, bloom composer, screen shake, pointer mapping.
 *
 * Exports live bindings (`renderer`, `scene`, `camera`) the way the other
 * three.js games in this repo do, so any view module can `scene.add(mesh)`
 * without a singleton class.
 *
 * Camera: a perspective camera pitched slightly over the XY playfield, so ships
 * have visible geometry and the backdrop parallaxes, but the field still reads
 * like a vertical shmup. `fitCamera()` pulls back far enough that the whole
 * 20x28 arena fits at ANY aspect — including a 390x844 phone in portrait.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ARENA, CAM, COLORS, VIEW } from '../core/config.js';

export let renderer = null;
export let scene = null;
export let camera = null;
export let composer = null;
export const clock = new THREE.Clock();

const shake = { amount: 0, x: 0, y: 0 };
const camState = { baseY: 0, dist: 34, lean: 0, dolly: 0 };
let _canvas = null;

export function initScene(canvas) {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas ?? undefined,
                                         powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    renderer.setSize(vw(), vh());
    renderer.setClearColor(COLORS.bg, 1);
    _canvas = renderer.domElement;
    if (!canvas && typeof document !== 'undefined') document.body.appendChild(_canvas);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(CAM.fov, vw() / vh(), CAM.near, CAM.far);
    fitCamera();

    scene.add(new THREE.AmbientLight(0xaac4ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 10, 14);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff86c8, 0.45);
    rim.position.set(-8, -6, 6);
    scene.add(rim);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(vw(), vh()),
        VIEW.bloomStrength, VIEW.bloomRadius, VIEW.bloomThreshold,
    );
    composer.addPass(bloom);
    composer.bloom = bloom;

    if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
    return { renderer, scene, camera, composer };
}

function vw() { return (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1280; }
function vh() { return (typeof window !== 'undefined' ? window.innerHeight : 720) || 720; }

/**
 * Distance that fits both arena dimensions, whichever is the binding
 * constraint. Portrait phones bind on width and simply sit further back.
 */
export function fitCamera() {
    const aspect = vw() / vh();
    const halfFov = (CAM.fov * Math.PI) / 360;
    const needH = (ARENA.h * 1.06) / (2 * Math.tan(halfFov));
    const needW = (ARENA.w * 1.1) / (2 * Math.tan(halfFov) * aspect);
    camState.dist = Math.max(needH, needW);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    applyCamera(0);
}

function applyCamera(dt) {
    const d = camState.dist + camState.dolly;
    const pitch = CAM.tilt;
    camera.position.set(
        camState.lean + shake.x,
        camState.baseY - Math.sin(pitch) * d + shake.y,
        Math.cos(pitch) * d,
    );
    camera.lookAt(camState.lean * 0.55, camState.baseY + 1.0, 0);
}

/** Called every frame by render.js. */
export function updateCamera(dt, player) {
    if (player) camState.lean += (player.x * (CAM.lean / 10) - camState.lean) * Math.min(1, dt * 3);
    if (shake.amount > 0) {
        shake.amount = Math.max(0, shake.amount - dt * CAM.shakeDecay);
        const a = shake.amount * 0.5;
        shake.x = (Math.random() * 2 - 1) * a;
        shake.y = (Math.random() * 2 - 1) * a;
    } else {
        shake.x = 0; shake.y = 0;
    }
    camState.dolly += (0 - camState.dolly) * Math.min(1, dt * 2.2);
    applyCamera(dt);
}

export function addShake(amount) {
    shake.amount = Math.min(2.4, shake.amount + amount);
}

export function dollyPunch(amount = 3) {
    camState.dolly = -amount;
}

function onResize() {
    renderer.setSize(vw(), vh());
    composer.setSize(vw(), vh());
    composer.bloom?.setSize?.(vw(), vh());
    fitCamera();
}

/**
 * Screen pixels -> world coordinates on the z = 0 playfield plane.
 *
 * Done with explicit ray maths rather than Vector3.unproject so it stays
 * testable headlessly and never depends on matrix state being up to date.
 */
export function screenToWorld(px, py) {
    const w = vw(), h = vh();
    const ndcX = (px / w) * 2 - 1;
    const ndcY = -((py / h) * 2 - 1);
    const halfFov = (CAM.fov * Math.PI) / 360;
    const t = Math.tan(halfFov);

    const cam = camera.position;
    const targetY = camState.baseY + 1.0;
    // camera basis: forward toward the look-at point, right = forward x worldUp
    let fx = camState.lean * 0.55 - cam.x, fy = targetY - cam.y, fz = -cam.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    // right = normalize(cross(forward, worldUp)), worldUp = (0, 1, 0)
    let rx = -fz, ry = 0, rz = fx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    // up = cross(right, forward)
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    const dx = fx + rx * ndcX * t * (w / h) + ux * ndcY * t;
    const dy = fy + ry * ndcX * t * (w / h) + uy * ndcY * t;
    const dz = fz + rz * ndcX * t * (w / h) + uz * ndcY * t;

    if (Math.abs(dz) < 1e-6) return { x: 0, y: 0 };
    const k = -cam.z / dz;
    return { x: cam.x + dx * k, y: cam.y + dy * k };
}

export function renderFrame() {
    composer.render();
}

/**
 * Free GPU resources for a mesh tree — three.js does not GC them.
 *
 * Geometries flagged `userData.shared` (the cache in models.js) are owned by
 * that cache and shared between every mesh of a type, so they are deliberately
 * NOT disposed here; only the per-mesh materials are.
 */
export function disposeObject(obj) {
    obj.traverse?.((o) => {
        if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
    });
}

export function clearGroup(group) {
    for (let i = group.children.length - 1; i >= 0; i--) {
        const child = group.children[i];
        group.remove(child);
        disposeObject(child);
    }
}
