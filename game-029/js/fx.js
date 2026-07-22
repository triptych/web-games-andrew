/**
 * fx.js — lightweight hit-feedback effects: particle bursts on sword
 * contact and screen shake on hit-dealt/hit-taken. Kept separate from
 * monsters.js/player.js since both need to trigger it and it owns its
 * own transient mesh pool + shake state.
 */

import * as THREE from 'three';
import { scene } from './scene.js';

const PARTICLE_LIFETIME = 0.25; // seconds
const PARTICLE_COUNT = 6;
const _particleGeo = new THREE.SphereGeometry(0.08, 4, 4);

let _particles = []; // { mesh, vx, vy, vz, life }

/** Spawns a small burst of fading particles at (x, y, z), tinted `color`. */
export function spawnHitParticles(x, y, z, color = 0xffffff) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const mesh = new THREE.Mesh(_particleGeo, mat.clone());
        mesh.position.set(x, y, z);
        scene.add(mesh);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2;
        _particles.push({
            mesh,
            vx: Math.cos(angle) * speed,
            vy: 1 + Math.random() * 2,
            vz: Math.sin(angle) * speed,
            life: PARTICLE_LIFETIME,
        });
    }
}

export function updateParticles(dt) {
    _particles = _particles.filter((p) => {
        p.life -= dt;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.material.dispose();
            return false;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 6 * dt; // gravity
        p.mesh.material.opacity = p.life / PARTICLE_LIFETIME;
        return true;
    });
}

// --- Screen shake ---
// Additive offset applied on top of the camera's normal follow position.
// player.js reads getShakeOffset() each frame after positioning the camera.

let _shakeTime = 0;
let _shakeDuration = 0;
let _shakeStrength = 0;

export function triggerShake(strength, duration) {
    // A stronger/longer shake always wins rather than stacking, so rapid
    // hits don't compound into a nauseating amount of camera jitter.
    if (strength < _shakeStrength && _shakeTime < _shakeDuration) return;
    _shakeStrength = strength;
    _shakeDuration = duration;
    _shakeTime = duration;
}

export function updateShake(dt) {
    if (_shakeTime > 0) _shakeTime -= dt;
}

export function getShakeOffset() {
    if (_shakeTime <= 0) return { x: 0, y: 0 };
    const falloff = _shakeTime / _shakeDuration;
    const mag = _shakeStrength * falloff;
    return {
        x: (Math.random() - 0.5) * mag,
        y: (Math.random() - 0.5) * mag,
    };
}
