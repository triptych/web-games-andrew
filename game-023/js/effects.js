/**
 * effects.js — Particle explosions and screen flash.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { COLORS } from './config.js';

const _particles = [];

export function spawnExplosion(x, y, z, color = COLORS.explosion, count = 18) {
    for (let i = 0; i < count; i++) {
        const geo = new THREE.PlaneGeometry(0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        const angle  = Math.random() * Math.PI * 2;
        const speed  = 2 + Math.random() * 5;
        _particles.push({
            mesh,
            vx:   Math.cos(angle) * speed,
            vy:   Math.sin(angle) * speed * 0.3,
            vz:   (Math.random() - 0.5) * 2,
            life: 0.5 + Math.random() * 0.3,
            age:  0,
        });
    }
}

export function updateEffects(dt) {
    for (let i = _particles.length - 1; i >= 0; i--) {
        const p = _particles[i];
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
            scene.remove(p.mesh);
            _particles.splice(i, 1);
            continue;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = 1 - t;
        const s = 1 - t * 0.5;
        p.mesh.scale.set(s, s, 1);
    }
}

export function clearEffects() {
    for (const p of _particles) scene.remove(p.mesh);
    _particles.length = 0;
}
