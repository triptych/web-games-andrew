/**
 * splash.js — Animated Three.js monster showcase behind the splash screen.
 *
 * Creates a small Three.js renderer on #splash-canvas, outside the main game
 * renderer. Spawns a row of procedural + named monsters that slowly rotate,
 * breathe, and bob. Torn down when the game starts to free GPU resources.
 *
 * Usage:
 *   const stop = initSplashScene();
 *   // later:
 *   stop();
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { generateProceduralMonster, buildMonsterMeshForDisplay } from './monsters.js';
import { MONSTER_DEFS } from './config.js';

// Monsters to show: mix of named types + procedural entries
const SHOWCASE = [
    { type: 'slime',    procDef: null },
    { type: 'goblin',   procDef: null },
    { type: 'proc',     procDef: generateProceduralMonster(0.30) },
    { type: 'skeleton', procDef: null },
    { type: 'proc',     procDef: generateProceduralMonster(0.55) },
    { type: 'troll',    procDef: null },
    { type: 'proc',     procDef: generateProceduralMonster(0.72) },
    { type: 'dragon',   procDef: null },
    { type: 'proc',     procDef: generateProceduralMonster(0.90) },
];

// Horizontal spacing between monsters in world units
const SPACING = 5.5;

export function initSplashScene() {
    const canvas = document.getElementById('splash-canvas');
    if (!canvas) return () => {};

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);   // transparent — HTML background shows through
    renderer.shadowMap.enabled = false;

    // ---- Scene ----
    const scene  = new THREE.Scene();

    // Subtle fog so monsters fade out at edges
    scene.fog = new THREE.FogExp2(0x0a100a, 0.042);

    // ---- Lighting ----
    const ambient = new THREE.AmbientLight(0xddeedd, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff5dd, 1.2);
    key.position.set(8, 14, -6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88bbff, 0.35);
    fill.position.set(-10, 6, 8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffaa44, 0.5);
    rim.position.set(0, -4, -12);
    scene.add(rim);

    // ---- Camera ----
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    // ---- Build monsters ----
    const entries = [];
    const totalWidth = (SHOWCASE.length - 1) * SPACING;
    const startX     = -totalWidth / 2;

    for (let i = 0; i < SHOWCASE.length; i++) {
        const { type, procDef } = SHOWCASE[i];
        const mesh = buildMonsterMeshForDisplay(type, procDef);

        // Remove HP bar — it clutters the display
        const hpBar = mesh.getObjectByName('hpBar');
        if (hpBar) mesh.remove(hpBar);

        const x = startX + i * SPACING;
        mesh.position.set(x, 0, 0);

        // Each monster faces slightly toward center for a dramatic lineup look
        const toCenter = -x;
        mesh.rotation.y = Math.atan2(toCenter, 12) * 0.25;

        scene.add(mesh);

        // Compute vertical center of this monster for camera targeting
        const box  = new THREE.Box3().setFromObject(mesh);
        const midY = (box.min.y + box.max.y) / 2;

        entries.push({
            mesh,
            baseX:   x,
            baseRotY: mesh.rotation.y,
            midY,
            phase:   (i / SHOWCASE.length) * Math.PI * 2,   // stagger bob timing
            spinDir: i % 2 === 0 ? 1 : -1,                   // alternate spin direction
        });
    }

    // Camera target: center of lineup, mid height
    const avgMidY = entries.reduce((s, e) => s + e.midY, 0) / entries.length;

    // ---- Resize handler ----
    function _resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
    }

    // ---- Animation ----
    let rafId     = null;
    let elapsed   = 0;
    let last      = performance.now();
    let running   = true;

    // Slow pan: camera orbits very gently around the lineup
    const CAM_DIST  = 22;
    const CAM_Y     = avgMidY + 1.5;
    const PAN_SPEED = 0.06;   // radians per second

    function _animate() {
        if (!running) return;
        rafId = requestAnimationFrame(_animate);

        const now = performance.now();
        const dt  = Math.min((now - last) / 1000, 0.08);
        last = now;
        elapsed += dt;

        _resize();

        // Camera orbit (very gentle — just a small arc so scene feels alive)
        const camAngle = elapsed * PAN_SPEED;
        camera.position.set(
            Math.sin(camAngle) * CAM_DIST,
            CAM_Y,
            Math.cos(camAngle) * CAM_DIST
        );
        camera.lookAt(0, avgMidY, 0);

        // Animate each monster
        for (const e of entries) {
            const t = elapsed + e.phase;

            // Slow idle rotation
            e.mesh.rotation.y = e.baseRotY + elapsed * 0.35 * e.spinDir;

            // Bob up and down
            e.mesh.position.y = Math.sin(t * 0.9) * 0.12;

            // Wing flap (dragon / procedural wings)
            e.mesh.traverse(child => {
                if (child.userData.isWing) {
                    const side = child.position.x < 0 ? -1 : 1;
                    child.rotation.z = side * (0.35 + Math.sin(t * 2.2) * 0.28);
                }
            });

            // Tail wag
            e.mesh.traverse(child => {
                if (child.userData.isTail) {
                    child.rotation.y = Math.sin(t * 1.8) * 0.3;
                }
            });
        }

        renderer.render(scene, camera);
    }

    _resize();
    _animate();

    // ---- Teardown ----
    return function stop() {
        running = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        renderer.dispose();
        scene.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    };
}
