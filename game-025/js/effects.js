/**
 * effects.js — Transient eye-candy: floating damage/score popups and death
 * bursts. Purely cosmetic; nothing here feeds back into gameplay.
 *
 *   spawnPopup(x, z, text, cssColor) — a text sprite that rises and fades.
 *   spawnBurst(x, z, color [, count]) — a spray of small cubes that fly out,
 *                                       fall, and fade (enemy/nest death).
 *
 * Rendering tricks (see docs/threejs/threejs-api.md):
 *  - Popups are canvas-texture THREE.Sprites — they live at a world position but
 *    always face the overhead camera, so no DOM projection math. Textures are
 *    cached by string (most popups repeat the same handful of values); the
 *    SpriteMaterial is cloned per popup so opacity fades independently.
 *  - Burst shards share ONE geometry + per-color materials (THREE.JS GOTCHA #4).
 *    Materials use additive blending so they pop under bloom.
 *
 * Lifetimes are tracked in plain arrays and culled in updateEffects(); meshes
 * are removed on expiry (shared geo/mat are never disposed; cloned popup mats
 * ARE disposed).
 */

import * as THREE from 'three';
import { scene } from './scene.js';

// --- Popups ---------------------------------------------------------------
const POPUP_LIFE  = 0.9;    // seconds a popup lives
const POPUP_RISE  = 4.5;    // world units it floats up over its life
const POPUP_Y     = 2.2;    // starting height above the floor

// Cache canvas textures by "text|color" — reused across the whole run.
const _texCache = new Map();
function _textTexture(text, cssColor) {
    const key = `${text}|${cssColor}`;
    let tex = _texCache.get(key);
    if (tex) return tex;

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;   // padded so the glow blur isn't clipped
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cssColor;
    ctx.shadowColor = cssColor;
    for (const blur of [18, 10]) { ctx.shadowBlur = blur; ctx.fillText(text, 128, 64); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 64);

    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;   // or the color washes out
    _texCache.set(key, tex);
    return tex;
}

// Active popups: { sprite, life, ttl }
let _popups = [];

/** Spawn a floating text popup at world (x, z). */
export function spawnPopup(x, z, text, cssColor = '#ffffff') {
    const tex = _textTexture(String(text), cssColor);
    const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    // Slight random x/z jitter so stacked hits don't perfectly overlap.
    sprite.position.set(x + (Math.random() - 0.5) * 0.8, POPUP_Y, z + (Math.random() - 0.5) * 0.8);
    sprite.scale.set(3, 1.5, 1);   // match the 2:1 canvas aspect
    scene.add(sprite);
    _popups.push({ sprite, life: POPUP_LIFE, ttl: POPUP_LIFE });
}

// --- Death bursts ---------------------------------------------------------
const BURST_LIFE    = 0.6;
const SHARD_GRAVITY = 18;

const _shardGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
const _shardMats = new Map();   // colorHex -> additive MeshBasicMaterial
function _shardMat(colorHex) {
    let m = _shardMats.get(colorHex);
    if (!m) {
        // Shared across all shards of this color, so we can't fade opacity
        // per-shard — instead each shard shrinks to nothing over its life.
        m = new THREE.MeshBasicMaterial({ color: colorHex, blending: THREE.AdditiveBlending });
        _shardMats.set(colorHex, m);
    }
    return m;
}

// Active shards: { mesh, vx, vy, vz, life, ttl }
let _shards = [];

/** Spawn a burst of `count` shards at world (x, z) in the given hex color. */
export function spawnBurst(x, z, colorHex, count = 10) {
    const mat = _shardMat(colorHex);
    for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(_shardGeo, mat);
        mesh.position.set(x, 1.0, z);
        scene.add(mesh);
        const ang = Math.random() * Math.PI * 2;
        const spd = 4 + Math.random() * 6;
        _shards.push({
            mesh,
            vx: Math.cos(ang) * spd,
            vy: 4 + Math.random() * 5,
            vz: Math.sin(ang) * spd,
            life: BURST_LIFE, ttl: BURST_LIFE,
        });
    }
}

// --- Lifecycle ------------------------------------------------------------

/** Reset all effects (call on level load / restart). */
export function initEffects() { _teardown(); }
export function clearEffects() { _teardown(); }

function _teardown() {
    for (const p of _popups) { scene.remove(p.sprite); p.sprite.material.dispose(); }
    for (const s of _shards) scene.remove(s.mesh);
    _popups = [];
    _shards = [];
}

/** Per-frame: animate + cull popups and shards. */
export function updateEffects(dt) {
    // Popups: rise + fade.
    for (let i = _popups.length - 1; i >= 0; i--) {
        const p = _popups[i];
        p.life -= dt;
        const k = p.life / p.ttl;                 // 1 → 0
        p.sprite.position.y = POPUP_Y + (1 - k) * POPUP_RISE;
        p.sprite.material.opacity = Math.max(0, k);
        if (p.life <= 0) {
            scene.remove(p.sprite);
            p.sprite.material.dispose();           // cloned per popup — dispose; texture is cached
            _popups.splice(i, 1);
        }
    }

    // Shards: ballistic + fade.
    for (let i = _shards.length - 1; i >= 0; i--) {
        const s = _shards[i];
        s.life -= dt;
        s.vy -= SHARD_GRAVITY * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        if (s.mesh.position.y < 0.15) { s.mesh.position.y = 0.15; s.vy *= -0.4; }   // bounce
        s.mesh.rotation.x += dt * 8;
        s.mesh.rotation.y += dt * 6;
        s.mesh.scale.setScalar(Math.max(0.01, s.life / s.ttl));   // shrink as it dies (shared mat → no opacity fade)
        if (s.life <= 0) {
            scene.remove(s.mesh);                   // shared geo/mat — do NOT dispose
            _shards.splice(i, 1);
        }
    }
}
