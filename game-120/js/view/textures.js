// Procedural textures drawn into canvases: no image files.
import * as THREE from 'three';

function noiseCanvas(size, seed, oct = 4, contrast = 1) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // value noise on tiling lattices of increasing frequency
    const lat = [];
    for (let o = 0; o < oct; o++) { const n = 4 << o; const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); lat.push([n, a]); }
    const sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let v = 0, amp = 1, tot = 0;
        for (const [n, a] of lat) {
            const fx = x / size * n, fy = y / size * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
            const i0 = x0 % n, i1 = (x0 + 1) % n, j0 = y0 % n, j1 = (y0 + 1) % n;
            const t = a[j0 * n + i0] * (1 - tx) + a[j0 * n + i1] * tx, b = a[j1 * n + i0] * (1 - tx) + a[j1 * n + i1] * tx;
            v += (t * (1 - ty) + b * ty) * amp; tot += amp; amp *= 0.5;
        }
        v = Math.min(1, Math.max(0, (v / tot - 0.5) * contrast + 0.5));
        const k = (y * size + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}

export function detailTexture(seed = 1) {
    const c = noiseCanvas(256, seed, 5, 1.6), g = c.getContext('2d');
    g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgb(120,120,120)'; g.fillRect(0, 0, 256, 256);   // lift the mean so it modulates vertex colour instead of halving it
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

/** A tiling normal map derived from noise heights (Sobel). */
export function normalTexture(seed = 3, strength = 3) {
    const size = 256, src = noiseCanvas(size, seed, 5, 1.8);
    const d = src.getContext('2d').getImageData(0, 0, size, size).data;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), out = g.createImageData(size, size);
    const H = (x, y) => d[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
        const l = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
        out.data[k] = (-dx / l * 0.5 + 0.5) * 255; out.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[k + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
}

/** Armour: scratched panels with seams and rivets; used as bump map and as a colour multiplier. */
export function panelTexture(seed = 5) {
    const size = 256, c = noiseCanvas(size, seed, 4, 1.3), g = c.getContext('2d');
    g.globalAlpha = 0.9;
    g.strokeStyle = '#000'; g.lineWidth = 3;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * size / 4); g.lineTo(size, i * size / 4); g.stroke(); g.beginPath(); g.moveTo(i * size / 4, 0); g.lineTo(i * size / 4, size); g.stroke(); }
    g.fillStyle = '#fff';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) for (const [ox, oy] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { g.beginPath(); g.arc(x * 64 + ox, y * 64 + oy, 2.2, 0, 6.3); g.fill(); }
    g.globalAlpha = 0.35; g.strokeStyle = '#fff'; g.lineWidth = 1;
    let s = seed;
    for (let i = 0; i < 40; i++) { s = (s * 1664525 + 1013904223) >>> 0; const x = s % size; s = (s * 1664525 + 1013904223) >>> 0; const y = s % size; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ((s >> 8) % 30) - 15, y + ((s >> 16) % 30) - 15); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/** A soft round sprite for particles, rings and glows. */
export function softDot() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Swirling hazard surface (acid, lava, goo). */
export function swirlTexture(seed = 9) {
    const c = noiseCanvas(128, seed, 4, 2.6);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
