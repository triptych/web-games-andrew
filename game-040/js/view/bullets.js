/**
 * bullets.js — every bullet on screen, drawn with one InstancedMesh per visual
 * kind. At the Chorus Heart there are 200+ live bullets; one Mesh each would
 * cost 200 draw calls and the frame budget with it.
 *
 * Per-instance colour comes from setColorAt(), so the same instanced mesh can
 * draw warm enemy fire and (for the player's kinds) cool fire without swapping
 * materials.
 */

import * as THREE from 'three';
import { BULLET_KINDS, VIEW } from '../core/config.js';
import { scene } from './scene.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _axis = new THREE.Vector3(0, 0, 1);
const _color = new THREE.Color();

let meshes = null;
let group = null;

function geometryFor(kind) {
    switch (kind) {
        case 'orb':    return new THREE.SphereGeometry(1, 10, 8);
        case 'dart':   return new THREE.ConeGeometry(0.62, 2.2, 6);
        case 'petal':  return new THREE.ConeGeometry(0.9, 1.8, 5);
        case 'shard':  return new THREE.TetrahedronGeometry(1.25);
        case 'lance':  return new THREE.CylinderGeometry(0.45, 0.45, 3.6, 6);
        case 'mine':   return new THREE.IcosahedronGeometry(1.15, 0);
        case 'wave':   return new THREE.TorusGeometry(1.0, 0.3, 6, 14);
        case 'seeker': return new THREE.OctahedronGeometry(1.15);
        case 'spark':  return new THREE.SphereGeometry(0.7, 6, 5);
        case 'rocket': return new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        default:       return new THREE.SphereGeometry(1, 8, 6);
    }
}

export function initBullets() {
    group = new THREE.Group();
    group.renderOrder = 20;
    meshes = {};
    for (const kind of BULLET_KINDS) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
        });
        const mesh = new THREE.InstancedMesh(geometryFor(kind), mat, VIEW.maxBulletsPerKind);
        mesh.frustumCulled = false;
        mesh.renderOrder = 20;
        mesh.count = 0;
        group.add(mesh);
        meshes[kind] = mesh;
    }
    scene.add(group);
    return group;
}

/**
 * Push both bullet arrays into the instanced meshes.
 * Called once per rendered frame — not per simulation tick.
 */
export function syncBullets(world, time) {
    if (!meshes) return;
    const counts = {};
    for (const kind of BULLET_KINDS) counts[kind] = 0;

    writeList(world.eBullets, counts, time, false);
    writeList(world.pBullets, counts, time, true);

    for (const kind of BULLET_KINDS) {
        const mesh = meshes[kind];
        mesh.count = counts[kind];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
}

function writeList(list, counts, time, isPlayer) {
    for (const b of list) {
        if (!b.alive) continue;
        const kind = meshes[b.kind] ? b.kind : 'orb';
        const i = counts[kind];
        if (i >= VIEW.maxBulletsPerKind) continue;
        const mesh = meshes[kind];

        const ang = b.ang ?? Math.atan2(b.vy ?? 0, b.vx ?? 1);
        _q.setFromAxisAngle(_axis, ang - Math.PI / 2);   // geometry points +y
        _p.set(b.x, b.y, isPlayer ? 0.15 : 0.25);

        // A slight spin on round kinds and a pulse on mines keeps a dense
        // screen from reading as static confetti.
        const r = b.r ?? 0.24;
        const pulse = kind === 'mine' ? 1 + Math.sin(time * 9 + b.x) * 0.16 : 1;
        const stretch = kind === 'dart' || kind === 'lance' ? 1.35 : kind === 'rocket' ? 1.25 : 1;
        _s.set(r * 1.7 * pulse, r * 1.7 * pulse * stretch, r * 1.7 * pulse);

        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        _color.set(b.color ?? 0xffffff);
        if (b.grazed && !isPlayer) _color.offsetHSL(0, 0, 0.12);   // grazed bullets brighten
        mesh.setColorAt(i, _color);
        counts[kind] = i + 1;
    }
}

export function disposeBullets() {
    if (!group) return;
    for (const kind of Object.keys(meshes)) {
        const mesh = meshes[kind];
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose?.();
    }
    scene.remove(group);
    meshes = null;
    group = null;
}
