/**
 * explosions.js — Particle bursts on enemy kills (and player hits).
 *
 * Each burst is a short-lived THREE.Points cloud using a shared shader-free
 * PointsMaterial with additive blending so the sparks glow against the grid.
 * We pool nothing here — bursts are small and brief — but every burst's geometry
 * IS disposed when it dies, since each has unique per-particle buffers.
 *
 * Public API:
 *   initExplosions()        — wire up. Call once.
 *   spawnExplosion(x, z, color?) — emit a burst at a world position.
 *   updateExplosions(dt)    — advance + cull bursts. Call each frame.
 *   resetExplosions()       — clear all bursts on (re)start.
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { COLORS } from './config.js';

const PARTICLES = 18;       // sparks per burst
const LIFETIME  = 0.55;     // seconds
const SPREAD    = 14;       // initial speed scalar

// Live bursts: { points, geo, vels:Float32Array, age, life }
const bursts = [];

export function initExplosions() { /* nothing to pre-build */ }

export function resetExplosions() {
    for (const b of bursts) {
        scene.remove(b.points);
        b.geo.dispose();
        b.mat.dispose();
    }
    bursts.length = 0;
}

export function spawnExplosion(x, z, color = COLORS.gold) {
    const positions = new Float32Array(PARTICLES * 3);
    const vels      = new Float32Array(PARTICLES * 3);

    for (let i = 0; i < PARTICLES; i++) {
        const o = i * 3;
        positions[o]     = x;
        positions[o + 1] = 0;
        positions[o + 2] = z;

        // Random direction on a hemisphere-ish spread, mostly along the plane.
        const ang   = Math.random() * Math.PI * 2;
        const speed = SPREAD * (0.4 + Math.random() * 0.6);
        vels[o]     = Math.cos(ang) * speed;
        vels[o + 1] = Math.random() * speed * 0.4;   // a little vertical pop
        vels[o + 2] = Math.sin(ang) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color,
        size: 0.45,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    bursts.push({ points, geo, mat, vels, age: 0, life: LIFETIME });
}

export function updateExplosions(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;

        if (b.age >= b.life) {
            scene.remove(b.points);
            b.geo.dispose();
            b.mat.dispose();
            bursts.splice(i, 1);
            continue;
        }

        // Advance particles; apply mild drag so the burst eases out.
        const pos  = b.geo.attributes.position.array;
        const drag = Math.pow(0.12, dt);   // exponential decay per second
        for (let p = 0; p < pos.length; p += 3) {
            pos[p]     += b.vels[p]     * dt;
            pos[p + 1] += b.vels[p + 1] * dt;
            pos[p + 2] += b.vels[p + 2] * dt;
            b.vels[p]     *= drag;
            b.vels[p + 1] *= drag;
            b.vels[p + 2] *= drag;
        }
        b.geo.attributes.position.needsUpdate = true;

        // Fade out over the lifetime.
        b.mat.opacity = 1 - (b.age / b.life);
    }
}
