/**
 * popups.js — Floating score numbers.
 *
 * When an enemy is destroyed we pop the points it awarded as a glowing number
 * at the kill site. It appears, rises for ~1s, and fades out. Rendered as a
 * camera-facing THREE.Sprite using a canvas-drawn texture, so it sits in the
 * world at the kill position and reads correctly under the overhead camera —
 * no DOM-to-screen projection math needed.
 *
 * Textures are cached per number string (most kills award the same handful of
 * values), so repeated popups reuse one GPU texture. Sprite materials are
 * cloned per popup only so their opacity can fade independently.
 *
 * Public API:
 *   initPopups()              — wire up. Call once.
 *   spawnScorePopup(x, z, n)  — float "+n" at world (x, z).
 *   updatePopups(dt)          — rise + fade + cull. Call each playing frame.
 *   resetPopups()             — clear all popups on (re)start.
 */

import * as THREE from 'three';

import { scene }  from './scene.js';
import { COLORS } from './config.js';

const LIFETIME   = 1.0;   // seconds on screen
const RISE_SPEED = 4.0;   // world units / sec the number floats upward (along -Z)
const Y_LIFT     = 1.2;   // raised slightly off the floor so it sits above the action

// Live popups: { sprite, age, life }
const popups = [];

// Cache: number string -> THREE.Texture (one canvas per distinct value).
const _texCache = new Map();

export function initPopups() { /* nothing to pre-build */ }

function _hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

function _makeTexture(text) {
    if (_texCache.has(text)) return _texCache.get(text);

    // Canvas is intentionally wider than tall, with generous margin on every
    // side, so the glow's blur radius never reaches an edge and gets clipped.
    const W = 512;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const col = _hexToCss(COLORS.gold);
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Neon glow: draw the text a few times with an increasing blur, then crisp.
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    for (const blur of [28, 16, 8]) {
        ctx.shadowBlur = blur;
        ctx.fillText(text, cx, cy);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache.set(text, tex);
    return tex;
}

export function spawnScorePopup(x, z, amount) {
    const text = '+' + amount;
    const tex  = _makeTexture(text);

    const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, Y_LIFT, z);
    // Scale matches the 2:1 canvas aspect so the glyph isn't stretched.
    sprite.scale.set(5, 2.5, 1);
    scene.add(sprite);

    popups.push({ sprite, age: 0, life: LIFETIME });
}

export function resetPopups() {
    for (const p of popups) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();   // cloned per popup; texture is cached/shared
    }
    popups.length = 0;
}

export function updatePopups(dt) {
    for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.age += dt;

        if (p.age >= p.life) {
            scene.remove(p.sprite);
            p.sprite.material.dispose();
            popups.splice(i, 1);
            continue;
        }

        // Rise toward the top of the field (-Z), easing as it ages.
        p.sprite.position.z -= RISE_SPEED * dt;

        // Fade out over the back half of the lifetime, holding full opacity at first.
        const t = p.age / p.life;
        p.sprite.material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    }
}
