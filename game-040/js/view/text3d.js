/**
 * text3d.js — in-world text as canvas-texture sprites (the pattern game-024
 * proved in this repo): draw glowing text to a 2D canvas, wrap it in a
 * CanvasTexture, render it as a Sprite that always faces the camera.
 *
 * Textures are cached by string+colour, because most score popups repeat the
 * same handful of values and a new GPU texture per popup is how you leak.
 */

import * as THREE from 'three';

const texCache = new Map();

export function textTexture(text, cssColor = '#ffffff', { size = 96, weight = 'bold' } = {}) {
    const key = `${text}|${cssColor}|${size}|${weight}`;
    if (texCache.has(key)) return texCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cssColor;
    ctx.shadowColor = cssColor;
    for (const blur of [28, 16, 8]) {           // neon halo
        ctx.shadowBlur = blur;
        ctx.fillText(text, 256, 128);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';                   // crisp core
    ctx.fillText(text, 256, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;       // or canvas colours render dull
    texCache.set(key, tex);
    return tex;
}

export function makeTextSprite(text, cssColor, { scale = 2.4, size = 96 } = {}) {
    const tex = textTexture(text, cssColor, { size });
    const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale * 2, scale, 1);       // match the 2:1 canvas aspect
    sprite.renderOrder = 30;
    return sprite;
}

export function clearTextCache() {
    for (const tex of texCache.values()) tex.dispose?.();
    texCache.clear();
}
