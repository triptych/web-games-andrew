/**
 * scene.js — Three.js renderer, scene, camera.
 * Exports live bindings — every other module imports and uses these directly.
 *
 * Call initScene() once before adding anything to the scene.
 *
 * The camera looks straight down from overhead so the gameplay reads as a
 * classic top-down shmup, while still being rendered in 3D (so shaders,
 * bloom-like emissive glows, and parallax depth all work).
 */

import * as THREE from 'three';
import { CAM_FOV, CAM_NEAR, CAM_FAR, CAM_POS, CAM_LOOK, COLORS } from './config.js';

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
    scene.fog = new THREE.FogExp2(COLORS.bg, 0.012);

    // Camera — overhead, looking down at the play field
    camera = new THREE.PerspectiveCamera(
        CAM_FOV,
        window.innerWidth / window.innerHeight,
        CAM_NEAR,
        CAM_FAR,
    );
    camera.position.set(...CAM_POS);
    camera.lookAt(...CAM_LOOK);

    // Lights — emissive neon materials carry most of the look, but a little
    // ambient + a key light keep non-emissive geometry from going pure black.
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(0, 10, 4);
    scene.add(dir);

    window.addEventListener('resize', _onResize);
}

function _onResize() {
    // IMPORTANT: updateProjectionMatrix() is required, or aspect change has no effect.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
