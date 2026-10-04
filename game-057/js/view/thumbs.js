/**
 * thumbs.js — codex portraits of the Brood, rendered once with the main
 * renderer into a small target and cached as data URLs.
 */

import * as THREE from 'three';
import { bugGeometry } from './actors.js';
import { ENEMIES } from '../config.js';

const cache = {};
let rt = null, sc = null, cam = null, mat = null;

export function bugThumb(renderer, type) {
    if (cache[type]) return cache[type];
    const S = 128;
    if (!rt) {
        rt = new THREE.WebGLRenderTarget(S, S);
        sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xbfe2ff, 0x1a1410, 2.2));
        const d = new THREE.DirectionalLight(0xffffff, 2.5);
        d.position.set(2, 4, 3);
        sc.add(d);
        cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
        mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 });
        mat.onBeforeCompile = (s) => {
            s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
            s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * 1.5;');
        };
    }
    const geo = bugGeometry(type);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = -0.7;
    sc.add(mesh);
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    const r = bs.radius * 1.1 * (ENEMIES[type] ? 1 : 1);
    cam.position.set(bs.center.x + r * 1.3, bs.center.y + r * 1.6, bs.center.z + r * 2.6);
    cam.lookAt(bs.center);
    const prevT = renderer.getRenderTarget();
    const prevTM = renderer.toneMapping;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x0a141a, 1);
    renderer.clear();
    renderer.render(sc, cam);
    const px = new Uint8Array(S * S * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    renderer.setRenderTarget(prevT);
    renderer.toneMapping = prevTM;
    sc.remove(mesh);
    geo.dispose();
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
        // Flip vertically, and gamma-encode the linear target.
        for (let x = 0; x < S * 4; x++) {
            const v = px[(S - 1 - y) * S * 4 + x];
            img.data[y * S * 4 + x] = (x % 4 === 3) ? 255 : Math.min(255, Math.pow(v / 255, 1 / 2.2) * 255);
        }
    }
    g.putImageData(img, 0, 0);
    cache[type] = c.toDataURL();
    return cache[type];
}
