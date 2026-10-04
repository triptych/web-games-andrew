/**
 * thumbs.js — fruit portraits for the DOM (tickets, jars, album), rendered
 * from the same procedural models into an offscreen target and cached as
 * data URLs.
 */

import * as THREE from 'three';
import { renderer } from './scene.js';
import { makeFruitMesh } from './fruit.js';

const cache = new Map();
const SIZE = 96;
let tscene = null, tcam = null, target = null, canvas = null;

function setup() {
    tscene = new THREE.Scene();
    tscene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.0));
    const d = new THREE.DirectionalLight(0xffffff, 2.4);
    d.position.set(1.5, 3, 3);
    tscene.add(d);
    tcam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    tcam.position.set(0, 0.32, 2.15);
    tcam.lookAt(0, 0, 0);
    target = new THREE.WebGLRenderTarget(SIZE, SIZE, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
}

/** Data URL of a fruit portrait. Works for any kind+colour, golden too. */
export function fruitThumb(kind, colour, golden = false) {
    const key = `${kind}|${colour}|${golden ? 'g' : ''}`;
    if (cache.has(key)) return cache.get(key);
    if (!renderer) return '';
    if (!tscene) setup();
    const fv = makeFruitMesh({ kind, colour, golden, size: 'M' }, 1);
    fv.model.rotation.set(0.05, -0.25, 0);
    tscene.add(fv.root);
    const prevT = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(tscene, tcam);
    const buf = new Uint8Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, buf);
    renderer.setRenderTarget(prevT);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.shadowMap.enabled = prevShadow;
    tscene.remove(fv.root);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) img.data.set(buf.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    cache.set(key, url);
    return url;
}
