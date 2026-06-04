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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CAM_FOV, CAM_NEAR, CAM_FAR, CAM_POS, CAM_LOOK, COLORS } from './config.js';

export let renderer, scene, camera, composer;
export const clock = new THREE.Clock();

// Bloom tuning. THRESHOLD is the key dial: only pixels brighter than this glow.
// Keep it high so the dark grid, fog, and ambient-lit surfaces stay crisp and
// only the genuinely bright emissive bits (ships, bullets, explosions) bloom —
// a low threshold lifts the blacks and washes the whole scene toward white.
const BLOOM_STRENGTH  = 0.6;
const BLOOM_RADIUS    = 0.4;
const BLOOM_THRESHOLD = 0.85;

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

    // Post-processing: render the scene, then add an UnrealBloom glow pass.
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
    );
    composer.addPass(bloom);

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
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Render one frame through the bloom composer. main.js calls this instead of
// renderer.render() so the post-processing chain always runs.
export function renderScene() {
    composer.render();
}
