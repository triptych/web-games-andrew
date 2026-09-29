/**
 * lights.js — fake "lights" painted onto the table surface.
 *
 * Real three.js point lights are expensive and the neon look doesn't need
 * shadows, so explosions/bumpers/lasers just register a short-lived glow here.
 * The table surface shader reads the eight brightest each frame, which lights
 * up the grid lines under every explosion.
 */

import * as THREE from 'three';

export const MAX_LIGHTS = 8;
const lights = [];      // { x, y, r, i, decay, color: THREE.Color }

let addedThisFrame = 0;

export function addLight(x, y, color, intensity = 1, radius = 2.5, decay = 4) {
    if (++addedThisFrame > 4) return;
    lights.push({ x, y, r: radius, i: intensity, decay, color: new THREE.Color(color) });
    if (lights.length > 32) lights.shift();
}

export function updateLights(dt) {
    addedThisFrame = 0;
    for (let i = lights.length - 1; i >= 0; i--) {
        const l = lights[i];
        l.i *= Math.exp(-l.decay * dt);
        if (l.i < 0.02) lights.splice(i, 1);
    }
}

/** Fill the shader uniform arrays with the brightest lights. */
export function writeLightUniforms(posArr, colArr) {
    const sorted = lights.length > MAX_LIGHTS ? [...lights].sort((a, b) => b.i - a.i) : lights;
    for (let k = 0; k < MAX_LIGHTS; k++) {
        const l = sorted[k];
        if (l) {
            posArr[k].set(l.x, l.y, l.r, l.i);
            colArr[k].copy(l.color);
        } else {
            posArr[k].set(0, 0, 1, 0);
        }
    }
}

export function clearLights() { lights.length = 0; }
