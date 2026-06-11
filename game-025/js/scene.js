/**
 * scene.js — Three.js renderer, scene, camera.
 * Exports live bindings — every other module imports and uses these directly.
 *
 * Call initScene() once before adding anything to the scene.
 */

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CAM_FOV, CAM_NEAR, CAM_FAR, COLORS } from './config.js';

export let renderer, scene, camera, composer;
export const clock = new THREE.Clock();

export function initScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(COLORS.bg);
    document.body.appendChild(renderer.domElement);

    // Scene + atmospheric fog for the dungeon depths.
    // near ~28 (just past the camera-to-player distance of ~26) keeps the area
    // around the player crisp; far ~62 fades the maze into darkness so corridors
    // feel enclosed and torchlit rather than fully visible.
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.bg, 28, 62);

    // Camera (overhead, slight tilt — set each frame by main.js to follow player)
    camera = new THREE.PerspectiveCamera(
        CAM_FOV,
        window.innerWidth / window.innerHeight,
        CAM_NEAR,
        CAM_FAR,
    );
    camera.position.set(0, 22, 14);

    // Lights — dim ambient + a torch-like point light follows the player (see main.js).
    // Ambient is kept low so the follow-torch and bloom carry the mood; a faint
    // cool directional adds shape to the wall tops without flattening the dark.
    scene.add(new THREE.AmbientLight(0x303048, 1.0));
    const dir = new THREE.DirectionalLight(0xaab4ff, 0.35);
    dir.position.set(5, 20, 8);
    scene.add(dir);

    // Post-processing: subtle bloom so torch-lit emissive bits (nests, shots,
    // pickups, popups, death bursts) glow. High threshold (~0.82) keeps the dark
    // maze/fog crisp — only genuinely bright pixels bloom (see threejs-api.md).
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.7,    // strength
        0.5,    // radius
        0.82,   // threshold
    ));

    window.addEventListener('resize', _onResize);
}

function _onResize() {
    // IMPORTANT: updateProjectionMatrix() is required, or aspect change has no effect.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);   // keep the bloom buffer in sync
}
