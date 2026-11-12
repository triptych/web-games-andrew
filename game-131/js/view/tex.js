// Textures. The painted ones (art/tex-*.webp, made with fal: see dev/art/README.md) load over a code-made stand-in,
// so a missing file or a slow network still shows a wall, just a plainer one.

import * as THREE from 'three';
import { hash3 } from '../rng.js';

const cache = {};
const loader = new THREE.TextureLoader();

/** A speckled canvas in one colour: what a surface looks like until (or unless) its painting arrives. */
function standIn(hex, grain = 26) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), col = new THREE.Color(hex);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const n = (hash3(x, y, 7) - 0.5) * grain + (hash3(x >> 3, y >> 3, 9) - 0.5) * grain;
        g.fillStyle = `rgb(${Math.max(0, Math.min(255, col.r * 255 + n)) | 0},${Math.max(0, Math.min(255, col.g * 255 + n)) | 0},${Math.max(0, Math.min(255, col.b * 255 + n)) | 0})`;
        g.fillRect(x, y, 1, 1);
    }
    return c;
}

/** A tiling surface texture by name, e.g. tile('caves-wall', 0x2a2850). */
export function tile(name, fallback = 0x888888) {
    if (cache[name]) return cache[name];
    const t = new THREE.CanvasTexture(standIn(fallback));
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;       // mirrored: a painting that doesn't quite tile shows no seam
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache[name] = t;
    loader.load(`art/tex-${name}.webp`, (img) => { t.image = img.image; t.needsUpdate = true; }, undefined, () => { /* keep the stand-in */ });
    return t;
}

/** A picture with transparency (an icon), or null-safe stand-in: a soft glowing dot in `hex`. */
export function icon(name, hex = '#ffffff') {
    const key = 'icon:' + name;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, hex); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    cache[key] = t;
    loader.load(`art/icon-${name}.webp`, (img) => { t.image = img.image; t.needsUpdate = true; }, undefined, () => { /* keep the dot */ });
    return t;
}

/** A soft round glow for sprites and motes. */
export function glow() {
    if (cache.glow) return cache.glow;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    cache.glow = new THREE.CanvasTexture(c);
    return cache.glow;
}

/** A spiral rune drawn on a canvas, for stones and doors that have no painted model. */
export function rune(hex = '#7fffe0') {
    const key = 'rune' + hex;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = hex; g.lineWidth = 7; g.lineCap = 'round'; g.shadowColor = hex; g.shadowBlur = 12;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.1) { const r = 6 + a * 3; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    cache[key] = t;
    return t;
}
