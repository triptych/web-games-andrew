/**
 * waveBanner.js — The between-wave splash (Phase 4).
 *
 * When a new wave begins, a big "WAVE N" banner sweeps onto the centre of the
 * field, holds, and fades — a beat of breathing room and a clear signal that
 * the difficulty just stepped up. Boss waves get an extra red "WARNING" subtitle.
 *
 * Rendered the same way as the score popups: a camera-facing THREE.Sprite with
 * a canvas-drawn neon texture, so it floats in world space under the overhead
 * camera with no DOM-to-screen projection math. The whole thing is purely
 * cosmetic — gameplay (spawning) runs underneath it.
 *
 * Public API:
 *   initWaveBanner()           — wire up. Call once.
 *   showWaveBanner(n, isBoss)  — splash "WAVE n" (with WARNING if isBoss).
 *   updateWaveBanner(dt)       — animate in/hold/out + cull. Call each frame.
 *   resetWaveBanner()          — clear any live banner on (re)start.
 */

import * as THREE from 'three';

import { scene }            from './scene.js';
import { COLORS, WAVE_BANNER_TIME } from './config.js';

const FADE_IN  = 0.25;   // sec to grow + fade in
const FADE_OUT = 0.5;    // sec to fade out at the end
const Y_LIFT   = 1.5;    // sits above the action

// At most one banner at a time; a new wave replaces the old instantly.
let banner = null;       // { sprite, age, life }

export function initWaveBanner() { /* nothing to pre-build */ }

function _hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

// Draw a centered neon line of text with a soft glow at (cx, cy).
function _drawNeon(ctx, text, cx, cy, font, cssColor) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cssColor;
    ctx.shadowColor = cssColor;
    for (const blur of [40, 22, 10]) {
        ctx.shadowBlur = blur;
        ctx.fillText(text, cx, cy);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, cy);
}

function _makeTexture(waveNum, isBoss) {
    const W = 1024;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const accent = _hexToCss(isBoss ? COLORS.magenta : COLORS.accent);
    _drawNeon(ctx, 'WAVE ' + waveNum, W / 2, H * 0.42,
        'bold 180px "Courier New", monospace', accent);

    if (isBoss) {
        _drawNeon(ctx, '! WARNING — BOSS !', W / 2, H * 0.72,
            'bold 64px "Courier New", monospace', _hexToCss(COLORS.danger));
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function showWaveBanner(waveNum, isBoss = false) {
    // Replace any banner still on screen.
    resetWaveBanner();

    const tex = _makeTexture(waveNum, isBoss);
    const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, Y_LIFT, 0);
    // 2:1 canvas aspect; large enough to dominate the field for the beat.
    sprite.scale.set(18, 9, 1);
    scene.add(sprite);

    banner = { sprite, age: 0, life: WAVE_BANNER_TIME };
}

export function resetWaveBanner() {
    if (!banner) return;
    scene.remove(banner.sprite);
    banner.sprite.material.map.dispose();   // texture is unique per banner
    banner.sprite.material.dispose();
    banner = null;
}

export function updateWaveBanner(dt) {
    if (!banner) return;
    banner.age += dt;

    const { sprite, age, life } = banner;
    if (age >= life) { resetWaveBanner(); return; }

    // Opacity envelope: fade in, hold, fade out.
    let op;
    if (age < FADE_IN) {
        op = age / FADE_IN;
    } else if (age > life - FADE_OUT) {
        op = Math.max(0, (life - age) / FADE_OUT);
    } else {
        op = 1;
    }
    sprite.material.opacity = op;

    // A gentle settle: starts slightly oversized and eases to its resting scale.
    const grow = 1 + 0.12 * (1 - Math.min(1, age / FADE_IN));
    sprite.scale.set(18 * grow, 9 * grow, 1);
}
