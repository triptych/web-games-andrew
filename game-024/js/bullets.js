/**
 * bullets.js — Player projectiles.
 *
 * Subscribes to the `playerFired` event (emitted by player.js) and spawns a
 * glowing neon bullet that travels in the given direction until it leaves the
 * field, then is removed.
 *
 * Bullets use a shared geometry + material (cheap; no per-bullet GPU allocation)
 * and additive blending so they glow against the dark grid. Phase 2 collision
 * with enemies will hook into the live bullet list via getBullets().
 *
 * Public API:
 *   initBullets()      — wire the playerFired subscription. Call once.
 *   updateBullets(dt)  — advance + cull bullets. Call each playing frame.
 *   resetBullets()     — remove all live bullets on (re)start.
 *   getBullets()       — the live bullet array (for Phase 2 collisions).
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { events } from './events.js';
import {
    BULLET_SPEED,
    BULLET_RADIUS,
    FIELD_HALF_W,
    FIELD_HALF_H,
    COLORS,
} from './config.js';

// Shared resources — every bullet reuses these, so we never dispose them
// per-bullet (only the Mesh wrappers are added/removed from the scene).
let _geo  = null;   // bullet head (sphere)
let _mat  = null;
let _tGeo = null;   // trail (elongated plane laid flat on the XZ floor)
let _tMat = null;

// Length of the comet tail behind the head, in world units.
const TRAIL_LEN = BULLET_RADIUS * 14;

// Live bullets: each is { mesh, vx, vz }.
const bullets = [];

function _ensureResources() {
    if (_geo) return;
    _geo = new THREE.SphereGeometry(BULLET_RADIUS, 8, 8);
    _mat = new THREE.MeshBasicMaterial({
        color: COLORS.bullet,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });

    // Trail: a plane that runs from the head (+y end, opacity ~1) back to a
    // faded tail (-y end). A vertex-alpha gradient gives the fade; the plane is
    // laid flat on the floor and rotated per-bullet to point along travel.
    _tGeo = new THREE.PlaneGeometry(BULLET_RADIUS * 1.4, TRAIL_LEN, 1, 1);
    // Per-vertex colors: bright at the head edge, black (→ invisible under
    // additive blending) at the tail edge.
    const colors = new Float32Array([
        // PlaneGeometry verts order: top-left, top-right, bottom-left, bottom-right.
        1, 1, 1,  1, 1, 1,    // top edge = head end (full bright)
        0, 0, 0,  0, 0, 0,    // bottom edge = tail end (fades to nothing)
    ]);
    _tGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Shift so the head end sits at the local origin and the tail extends -Y.
    _tGeo.translate(0, -TRAIL_LEN / 2, 0);

    _tMat = new THREE.MeshBasicMaterial({
        color: COLORS.bullet,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
}

function _spawn({ x, z, dirX, dirZ }) {
    _ensureResources();
    const mesh = new THREE.Mesh(_geo, _mat);
    mesh.position.set(x, 0, z);

    // Trail child: laid flat on the floor and yawed so the tail (the -Y end of
    // its local geometry) streams out behind the head along -velocity.
    //
    // Build the orientation as: flat-on-floor (rot.x = -90°) THEN a yaw about
    // the world up axis. Chaining via Euler is ambiguous, so set the X tilt and
    // the yaw on two nested objects — the outer yaws, the inner lies flat.
    const trail = new THREE.Mesh(_tGeo, _tMat);
    trail.rotation.x = -Math.PI / 2;                 // upright plane → flat on XZ
    trail.position.y = -0.05;                        // just under the head

    const trailYaw = new THREE.Group();
    // After the flat tilt, the plane's local +Y maps to world -Z. We want the
    // tail (local -Y → world +Z) to point along +velocity-reversed, i.e. the
    // head leads. Yaw so world -Z aligns with the travel direction (dirX,dirZ).
    trailYaw.rotation.y = Math.atan2(dirX, dirZ);
    trailYaw.add(trail);
    mesh.add(trailYaw);

    scene.add(mesh);
    bullets.push({
        mesh,
        vx: dirX * BULLET_SPEED,
        vz: dirZ * BULLET_SPEED,
    });
}

// ============================================================
// Lifecycle
// ============================================================

export function initBullets() {
    events.on('playerFired', _spawn);
}

export function getBullets() { return bullets; }

export function resetBullets() {
    for (const b of bullets) scene.remove(b.mesh);
    bullets.length = 0;
}

// ============================================================
// Per-frame update
// ============================================================

export function updateBullets(dt) {
    // Iterate backward so we can splice culled bullets without skipping any.
    const limX = FIELD_HALF_W + BULLET_RADIUS;
    const limZ = FIELD_HALF_H + BULLET_RADIUS;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.z += b.vz * dt;

        const p = b.mesh.position;
        if (p.x < -limX || p.x > limX || p.z < -limZ || p.z > limZ) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        }
    }
}
