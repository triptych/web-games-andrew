/**
 * thumbs.js — portraits for cards, the bestiary and wave previews, rendered
 * from the same procedural models into an offscreen target and cached as
 * data URLs.
 */

import * as THREE from 'three';
import { renderer } from './scene.js';
import { makeUnit, makeMonster, animateRig } from './models.js';

const cache = new Map();
let tscene = null, tcam = null, target = null, canvas = null;
const SIZE = 128;

function setup() {
    tscene = new THREE.Scene();
    tscene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(2, 3, 2.5);
    tscene.add(d);
    tcam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    target = new THREE.WebGLRenderTarget(SIZE, SIZE, { colorSpace: THREE.SRGBColorSpace });
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
}

function shoot(rig, height, key, opts = {}) {
    if (!tscene) setup();
    tscene.add(rig.root);
    animateRig(rig, { t: 0.3, move: 0, atk: 0 });
    rig.root.rotation.y = opts.rotY ?? 0.6;
    const h = height * (opts.scale ?? 1);
    const dist = h * 2.4 + 0.4;
    tcam.position.set(Math.sin(0.35) * dist, h * 0.62 + dist * 0.22, Math.cos(0.35) * dist);
    tcam.lookAt(0, h * 0.48, 0);
    const prevT = renderer.getRenderTarget();
    const prevTone = renderer.toneMapping;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(tscene, tcam);
    const buf = new Uint8Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, buf);
    renderer.setRenderTarget(prevT);
    renderer.toneMapping = prevTone;
    tscene.remove(rig.root);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) img.data.set(buf.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    cache.set(key, url);
    return url;
}

export function unitThumb(type) {
    const key = `u:${type}`;
    if (cache.has(key)) return cache.get(key);
    const rig = makeUnit(type);
    return shoot(rig, rig.height, key, { rotY: 0.7 });
}

export function speciesThumb(sp) {
    const key = `s:${sp.id}`;
    if (cache.has(key)) return cache.get(key);
    const rig = makeMonster(sp);
    const s = sp.plan === 'biped' ? 1 : 1;
    return shoot(rig, Math.max(0.45, rig.height * s), key, { rotY: -0.7 + Math.PI });
}
