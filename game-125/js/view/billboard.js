// Pixel sprites as lit, upright billboards: nearest-filtered textures on planes that turn about Y to face the
// camera, alpha-tested so they sort and cast nothing odd, each with a soft blob shadow. Textures are cached by key.

import * as THREE from 'three';
import { pixelTex } from './stage.js';

const texCache = new Map();
export function spriteTex(key, make) {
    let e = texCache.get(key);
    if (!e) { const s = make(); e = { tex: pixelTex(s.px.toCanvas()), w: s.px.w, hpx: s.px.h, h: s.h }; texCache.set(key, e); }
    return e;
}

let shadowTex = null;
function blobTex() {
    if (shadowTex) return shadowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    return shadowTex;
}
const planeCache = new Map();
function plane(w, h) {
    const k = w.toFixed(3) + 'x' + h.toFixed(3);
    let g = planeCache.get(k);
    if (!g) { g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); planeCache.set(k, g); }
    return g;
}

/**
 * A billboard: an Object3D whose `.sprite` mesh faces the camera.
 * opts: emissive (0..1 self-light, for glowing things and dark zones), shadow (radius, 0 for none), scale.
 */
export function billboard(key, make, opts = {}) {
    const T = spriteTex(key, make);
    const scale = opts.scale ?? 1;
    const h = T.h * scale, w = h * T.w / T.hpx;
    const mat = new THREE.MeshLambertMaterial({ map: T.tex, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });
    if (opts.emissive) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = T.tex; mat.emissiveIntensity = opts.emissive; }
    const mesh = new THREE.Mesh(plane(w, h), mat);
    const root = new THREE.Group();
    root.add(mesh);
    root.userData.sprite = mesh;
    root.userData.h = h; root.userData.w = w;
    if (opts.shadow !== 0) {
        const r = opts.shadow ?? w * 0.42;
        const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 1.2), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
        s.rotation.x = -Math.PI / 2; s.position.y = 0.03;
        s.renderOrder = 1;
        root.add(s);
        root.userData.shadow = s;
    }
    return root;
}
/** Turn a billboard to face the camera about Y. */
export function face(b, cam) {
    const s = b.userData.sprite;
    s.rotation.y = Math.atan2(cam.position.x - b.position.x, cam.position.z - b.position.z) - (b.rotation.y || 0);
}
export function disposeTree(o) {
    o.traverse((c) => {
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose()); }
        if (c.geometry && !planeCacheHas(c.geometry)) c.geometry.dispose();
    });
}
function planeCacheHas(g) { for (const v of planeCache.values()) if (v === g) return true; return false; }
