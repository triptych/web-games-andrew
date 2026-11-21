// Textures and materials. Every surface is a fal-generated photo texture (art/*.webp); each one starts life as a
// code-made canvas stand-in, so the city renders at once and still renders if a file fails to load.

import * as THREE from 'three';

const ART = 'art/';

/** name → [file, metres per repeat, fallback colour] */
export const TEX = {
    // walls
    yellow: ['wall-yellow', 2.4, '#c9b469'], floral: ['wall-floral', 2.2, '#b9a68f'], plaster: ['wall-plaster', 3, '#a7b49b'],
    concrete: ['wall-concrete', 3, '#8d8a83'], tile: ['tile-white', 2, '#cfcac0'], lab: ['lab-panel', 2.4, '#d3d0c4'],
    brick: ['brick', 2.6, '#7b4436'], rust: ['rust', 3, '#7a4a2a'],
    // floors
    carpet: ['carpet', 3, '#8d7b42'], wood: ['floor-wood', 2.5, '#6d5a45'], terrazzo: ['floor-terrazzo', 3, '#b9a98e'],
    fconcrete: ['floor-concrete', 4, '#7d7a74'], lino: ['floor-lino', 2, '#9ab1a8'],
    // ceilings
    ceiling: ['ceiling', 1.2, '#cfc8b8'],
    // outside
    asphalt: ['asphalt', 6, '#4c4d4f'], sidewalk: ['sidewalk', 3, '#8b8a85'], grass: ['grass', 5, '#6b6a3c'],
    facade: ['facade-concrete', 4, '#9a978f'], stucco: ['stucco', 3, '#b9ab8e'], siding: ['siding', 2.4, '#8ea2a7'],
    bark: ['bark', 2, '#4b4239'],
};

const loader = new THREE.ImageLoader();
const cache = new Map();
let anisotropy = 4;
export function setAnisotropy(a) { anisotropy = a; }

function noiseCanvas(color, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, size, size);
    // a little grime so the stand-in is not flat
    for (let i = 0; i < size * 6; i++) {
        const x = (i * 9301 + 49297) % size, y = (i * 233 + 17 * (i >> 3)) % size;
        g.fillStyle = `rgba(0,0,0,${0.05 + ((i * 7) % 13) / 100})`;
        g.fillRect(x, y, 2 + (i % 3), 2 + (i % 2));
    }
    return c;
}

/** A repeating texture by name (see TEX). */
export function tex(name) {
    if (cache.has(name)) return cache.get(name);
    const [file, , color] = TEX[name];
    const t = new THREE.Texture(noiseCanvas(color));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    cache.set(name, t);
    // dispose first: WebGL2 storage is allocated at the stand-in's size, and a bigger image would only fill its corner
    loader.load(ART + file + '.webp', (img) => { t.dispose(); t.image = img; t.needsUpdate = true; }, undefined, () => { /* keep the stand-in */ });
    return t;
}

/** A one-off image (portraits, key art, posters, decals) as a texture. */
export function image(file, { repeat = false, srgb = true } = {}) {
    const key = 'img:' + file;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const t = new THREE.Texture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    loader.load(ART + file + '.webp', (img) => { t.dispose(); t.image = img; t.needsUpdate = true; }, undefined, () => {});
    cache.set(key, t);
    return t;
}

// ------------------------------------------------------------------ materials

const mats = new Map();

/** The standard surface material for a texture name: photo map, the same map as a bump, vertex colours for AO. */
export function surface(name, opts = {}) {
    const key = name + JSON.stringify(opts);
    if (mats.has(key)) return mats.get(key);
    const map = tex(name);
    const m = new THREE.MeshStandardMaterial({
        map, bumpMap: map, bumpScale: opts.bump ?? 1.2, roughness: opts.rough ?? 0.92, metalness: opts.metal ?? 0,
        vertexColors: true, side: opts.side ?? THREE.FrontSide, color: opts.color ?? 0xffffff,
    });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei ?? 1; }
    mats.set(key, m);
    return m;
}

/** Plain materials for props: colour comes from the vertex colours. */
export function plain(kind) {
    if (mats.has('p:' + kind)) return mats.get('p:' + kind);
    let m;
    switch (kind) {
        case 'metal': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.6 }); break;
        case 'paint': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }); break;
        case 'fabric': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: tex('carpet'), bumpMap: tex('carpet'), bumpScale: 0.8 }); break;
        case 'wood': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: tex('wood'), bumpMap: tex('wood'), bumpScale: 0.8 }); break;
        case 'rust': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: tex('rust'), bumpMap: tex('rust'), bumpScale: 1.5 }); break;
        case 'bark': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: tex('bark'), bumpMap: tex('bark'), bumpScale: 2 }); break;
        case 'concrete': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex('fconcrete'), bumpMap: tex('fconcrete'), bumpScale: 1 }); break;
        case 'glow': m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); break;
        case 'glass': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false }); break;
        case 'leaves': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: true }); break;
        case 'paper': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }); break;
        default: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    }
    mats.set('p:' + kind, m);
    return m;
}

/** Decals drawn with multiply blending (mould, stains, cracks) or alpha (graffiti, leaves, posters). */
export function decal(file, mode = 'multiply') {
    const key = 'd:' + file + mode;
    if (mats.has(key)) return mats.get(key);
    const map = image(file);
    const m = mode === 'multiply'
        ? new THREE.MeshBasicMaterial({ map, blending: THREE.MultiplyBlending, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false })
        : new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.08, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.set(key, m);
    return m;
}

/** A canvas texture with text: shop signs, building names, the VACANCY neon. */
export function signTexture(text, { w = 512, h = 96, bg = '#1c1b18', fg = '#d9cfae', font = 'bold 56px Georgia, serif', neon = false } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    let size = parseInt(font.match(/(\d+)px/)[1], 10);
    g.font = font;
    while (g.measureText(text).width > w - 24 && size > 10) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (neon) { g.shadowColor = fg; g.shadowBlur = 18; }
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 2);
    if (!neon && bg) {
        // weathering: streaks and a missing letter's ghost
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(20,15,10,${0.05 + (i % 5) * 0.03})`; g.fillRect((i * 97) % w, 0, 2 + (i % 4), h * ((i % 7) / 7)); }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
}

/** The glowing front of a vending machine: rows of cans behind fogged plastic. */
let vendTex = null;
export function vendingTexture() {
    if (vendTex) return vendTex;
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#f7f2d8'); grd.addColorStop(1, '#d8e6e0');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
    const cols = ['#b3202a', '#2a4fa8', '#d48a1a', '#2f8a3a', '#6b2a8a', '#c2c2c2'];
    for (let r = 0; r < 6; r++) for (let k = 0; k < 5; k++) {
        g.fillStyle = cols[(r + k * 2) % cols.length];
        g.fillRect(10 + k * 22, 14 + r * 34, 16, 26);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(12 + k * 22, 16 + r * 34, 3, 22);
    }
    g.fillStyle = 'rgba(30,30,30,0.85)'; g.fillRect(0, 220, 128, 36);
    g.fillStyle = '#e44'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('LUMEN COLA', 64, 244);
    vendTex = new THREE.CanvasTexture(c); vendTex.colorSpace = THREE.SRGBColorSpace;
    return vendTex;
}
