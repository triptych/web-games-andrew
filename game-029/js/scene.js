/**
 * scene.js — Three.js renderer, scene, camera.
 * Exports live bindings — every other module imports and uses these directly.
 *
 * Call initScene() once before adding anything to the scene.
 */

import * as THREE from 'three';
import { CAM_FOV, CAM_NEAR, CAM_FAR, CAM_POS, COLORS } from './config.js';

export let renderer, scene, camera;
export const clock = new THREE.Clock();

export function initScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(COLORS.bg);
    document.body.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.bg, 30, CAM_FAR);
    scene.background = _buildSkyTexture();

    // Camera — trails behind and above the walker, looking forward down +Z
    camera = new THREE.PerspectiveCamera(
        CAM_FOV,
        window.innerWidth / window.innerHeight,
        CAM_NEAR,
        CAM_FAR,
    );
    camera.position.set(...CAM_POS);
    camera.lookAt(0, 1, 20);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    scene.add(dir);

    // Ground is generated per-chunk by path.js — see initPath()/updatePath().

    window.addEventListener('resize', _onResize);
}

function _onResize() {
    // IMPORTANT: updateProjectionMatrix() is required, or aspect change has no effect.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/** Vertical gradient sky (dark horizon fog color -> a lighter zenith blue) baked to a canvas texture. */
function _buildSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1b2447');   // zenith
    grad.addColorStop(0.6, '#3a4a72'); // mid sky
    grad.addColorStop(1, '#0a0a14');   // horizon — matches COLORS.bg / fog color
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
