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
    // Color management — without these, StandardMaterial looks muddy/washed in r165.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    document.body.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    // Fog gives the crypt its claustrophobic, lantern-lit feel — tune near/far per taste.
    // Near must be well past one tile (TILE_SIZE=4) or adjacent walls vanish into the
    // dark bg the instant they appear. Start the haze ~3 tiles out, fade by ~10 tiles.
    scene.fog = new THREE.Fog(COLORS.bg, 12, 40);

    // Camera
    camera = new THREE.PerspectiveCamera(
        CAM_FOV,
        window.innerWidth / window.innerHeight,
        CAM_NEAR,
        CAM_FAR,
    );
    camera.position.set(...CAM_POS);

    // Lights — a soft fill so nothing is pure black, plus a bright warm "lantern"
    // point light carried by the player. The lantern is offset slightly forward and
    // up from the eye so it actually rakes across the walls ahead instead of sitting
    // inside the camera. decay=2 is physically correct; the high intensity + large
    // range compensate so corridors a few tiles out stay readable.
    scene.add(new THREE.AmbientLight(0x6070a0, 0.9));
    scene.add(new THREE.HemisphereLight(0xb0c0ff, 0x202028, 0.5));

    const lantern = new THREE.PointLight(0xffe0b0, 22, 30, 2);
    lantern.position.set(0, 0.4, -0.6);   // local to camera: a hair up and ahead
    camera.add(lantern);
    scene.add(camera);   // camera must be in scene for its child light to render

    window.addEventListener('resize', _onResize);
}

function _onResize() {
    // IMPORTANT: updateProjectionMatrix() is required, or aspect change has no effect.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
