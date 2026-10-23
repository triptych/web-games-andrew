// The toolbox every model is made from: cached materials, procedural textures drawn on small
// canvases (wallpaper, planks, tiles, rugs, labels, glows), and one-line mesh builders. Nothing
// here loads a file. Textures are seeded by a hash, so a house always looks the same for a seed.

import * as THREE from 'three';

// ------------------------------------------------------------------ materials
const mats = new Map();
export function M(color, o = {}) {
    const key = `${color}|${o.rough ?? 0.85}|${o.metal ?? 0}|${o.emissive ?? 0}|${o.ei ?? 1}|${o.opacity ?? 1}|${o.side ?? 0}|${o.map?.uuid ?? ''}`;
    let m = mats.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({
            color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
            emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
            transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, map: o.map || null,
        });
        mats.set(key, m);
    }
    return m;
}
export const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });

// ------------------------------------------------------------------ mesh builders
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
}
export const box = (w, h, d, mat, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
export const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
export const sph = (r, mat, x = 0, y = 0, z = 0, ws = 20, hs = 14) => mesh(new THREE.SphereGeometry(r, ws, hs), mat, x, y, z);
export const cone = (r, h, mat, x = 0, y = 0, z = 0, seg = 16) => mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y, z);
export const torus = (r, t, mat, x = 0, y = 0, z = 0) => mesh(new THREE.TorusGeometry(r, t, 10, 24), mat, x, y, z);
export function plane(w, h, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z); }
export function group(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }
export function at(obj, x = 0, y = 0, z = 0, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; }
/** Add children to g. Returns the last child added, so `add(g, sph(...)).scale.set(...)` poses the child. */
export function add(g, ...kids) { let last = g; for (const k of kids) if (k) { g.add(k); last = k; } return last; }

// ------------------------------------------------------------------ colour and noise helpers
export const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);
export const hex = (c) => '#' + c.getHexString();
function hashN(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function rnd(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ canvas textures
const texCache = new Map();
export function canvasTex(key, w, h, draw, { repeat = null, srgb = true } = {}) {
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    texCache.set(key, t);
    return t;
}

function speckle(g, w, h, n, seed, alpha = 0.06, dark = true) {
    const r = rnd(seed);
    for (let i = 0; i < n; i++) {
        g.fillStyle = dark ? `rgba(0,0,0,${alpha * r()})` : `rgba(255,255,255,${alpha * r()})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
}

/** Wallpaper in a pattern: stripes, damask-ish diamonds, polka dots or plain boards. */
export function wallpaperTex(seed, hue, pattern = 'stripes', sat = 0.35, light = 0.3) {
    return canvasTex(`wp${seed}|${hue}|${pattern}|${sat}|${light}`, 256, 256, (g, w, h) => {
        const base = hsl(hue, sat, light), accent = hsl(hue + 12, sat * 0.8, light + 0.07), dim = hsl(hue, sat, light - 0.06);
        g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
        if (pattern === 'stripes') {
            for (let x = 0; x < w; x += 32) { g.fillStyle = hex(accent); g.fillRect(x, 0, 16, h); g.fillStyle = hex(dim); g.fillRect(x + 16, 0, 1, h); }
        } else if (pattern === 'diamonds') {
            g.fillStyle = hex(accent);
            for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
                for (const [ox, oy] of [[0, 0], [32, 32]]) {
                    g.beginPath(); g.moveTo(x + ox + 16, y + oy); g.lineTo(x + ox + 32, y + oy + 16); g.lineTo(x + ox + 16, y + oy + 32); g.lineTo(x + ox, y + oy + 16); g.closePath(); g.fill();
                }
            }
        } else if (pattern === 'dots') {
            g.fillStyle = hex(accent);
            for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + ((y / 32) % 2 ? 16 : 0) + 8, y + 8, 5, 0, 7); g.fill(); }
        } else if (pattern === 'boards') {
            for (let x = 0; x < w; x += 42) {
                g.fillStyle = hex(hsl(hue, sat, light + (hashN(x, 3, seed) - 0.5) * 0.08)); g.fillRect(x, 0, 41, h);
                g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 41, 0, 1, h);
                for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + hashN(x, k, seed) * 40, 0, 1, h); }
            }
        }
        // a few water stains and a vignette so no wall looks flat
        const r = rnd(seed + 11);
        for (let i = 0; i < 3; i++) {
            const gr = g.createRadialGradient(r() * w, r() * h, 2, r() * w, r() * h, 60 + r() * 60);
            gr.addColorStop(0, 'rgba(0,0,0,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }
        speckle(g, w, h, 160, seed, 0.1);
    }, { repeat: [3, 2] });
}

export function planksTex(seed, hue, light = 0.3, boardW = 40) {
    return canvasTex(`pl${seed}|${hue}|${light}|${boardW}`, 256, 256, (g, w, h) => {
        for (let x = 0; x < w; x += boardW) {
            const off = hashN(x, 1, seed) * h;
            for (let y = -off; y < h; y += 128 + hashN(x, 2, seed) * 64) {
                g.fillStyle = hex(hsl(hue + (hashN(x, y | 0, seed) - 0.5) * 10, 0.4, light + (hashN(x, (y | 0) + 5, seed) - 0.5) * 0.07));
                g.fillRect(x, y, boardW - 1, 160);
                g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, boardW, 1);
            }
            g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + boardW - 1, 0, 1, h);
            for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + hashN(x, k + 9, seed) * (boardW - 3), 0, 1, h); }
        }
        speckle(g, w, h, 200, seed, 0.12);
    }, { repeat: [3, 3] });
}

export function tilesTex(seed, a, b) {
    return canvasTex(`ti${seed}|${a}|${b}`, 256, 256, (g, w, h) => {
        const s = 64;
        for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
            g.fillStyle = ((x + y) / s) % 2 ? a : b; g.fillRect(x, y, s, s);
            g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, s, 2);
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + s - 2, s, 2); g.fillRect(x + s - 2, y, 2, s);
        }
        const r = rnd(seed);
        for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
        speckle(g, w, h, 150, seed, 0.08);
    }, { repeat: [3, 2] });
}

export function rugTex(seed, c1, c2, c3) {
    return canvasTex(`rg${seed}|${c1}|${c2}|${c3}`, 256, 192, (g, w, h) => {
        g.fillStyle = c1; g.fillRect(0, 0, w, h);
        g.strokeStyle = c3; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
        g.strokeStyle = c2; g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48);
        g.fillStyle = c2;
        for (let i = 0; i < 6; i++) {
            const cx = w / 2 + (i - 2.5) * 30, cy = h / 2;
            g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 12, cy); g.fill();
        }
        g.fillStyle = c3; g.beginPath(); g.arc(w / 2, h / 2, 14, 0, 7); g.fill();
        for (let x = 0; x < w; x += 8) { g.fillStyle = c3; g.fillRect(x, 0, 3, 6); g.fillRect(x, h - 6, 3, 6); }
        speckle(g, w, h, 300, seed, 0.12);
    });
}

/** Text on a sign, a spine or a plaque, measured and shrunk to fit its width. */
export function labelTex(text, w, h, { bg = '#f4ead2', fg = '#3a2a1a', font = 'Georgia, serif', weight = 'bold', pad = 0.1, vertical = false } = {}) {
    return canvasTex(`lb${text}|${w}|${h}|${bg}|${fg}|${vertical}`, w, h, (g) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save();
        if (vertical) { g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); }
        const avail = (vertical ? h : w) * (1 - pad * 2);
        let size = (vertical ? w : h) * 0.5;
        g.font = `${weight} ${size}px ${font}`;
        const m = g.measureText(text).width;
        if (m > avail) { size *= avail / m; g.font = `${weight} ${size}px ${font}`; }
        g.fillText(text, vertical ? 0 : w / 2, vertical ? 0 : h / 2 + size * 0.04);
        g.restore();
    });
}

export const glowTex = (color = '#ffd27a') => canvasTex('glow' + color, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
export const starTex = canvasTex('star', 64, 64, (g, w, h) => {
    g.translate(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,180,0.5)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const r of [0, Math.PI / 2]) { g.save(); g.rotate(r); g.beginPath(); g.moveTo(-28, 0); g.lineTo(0, -2.2); g.lineTo(28, 0); g.lineTo(0, 2.2); g.fill(); g.restore(); }
});
export const blobTex = canvasTex('blob', 64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

/** A contact shadow, so furniture sits on the floor instead of hovering above it. */
export function blob(w, d, x = 0, z = 0, strength = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: strength }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.renderOrder = 1;
    return m;
}

/** A sprite that glows, drawn additively. */
export function glowSprite(color, size, opacity = 0.9) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
    s.scale.set(size, size, 1);
    return s;
}
