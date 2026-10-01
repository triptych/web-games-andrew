/**
 * portraits.js — renders hero (and monster) busts to images with the main
 * WebGL renderer into an off-screen target, a few per frame, cached by look.
 */

import * as THREE from 'three';
import { renderer } from '../view/engine.js';
import { buildCharacter } from '../view/chars.js';
import { buildMonster } from '../view/monsters.js';
import { disposeObject } from '../view/toon.js';
import { hashStr } from '../core/rng.js';

const SIZE = 200;
const cache = new Map();
const waiting = new Map();
const queue = [];
let scene = null, cam = null, rt = null, canvas = null, ctx = null, pixels = null;

function setup() {
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8aaa', 1.3));
    const key = new THREE.DirectionalLight('#fff6e8', 2.2); key.position.set(1.5, 2.5, 3); scene.add(key);
    const rim = new THREE.DirectionalLight('#9fc8ff', 1.2); rim.position.set(-2, 1.5, -2); scene.add(rim);
    rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    ctx = canvas.getContext('2d');
    pixels = new Uint8Array(SIZE * SIZE * 4);
}

export function lookKey(hero) {
    return hero.seed + ':' + hashStr(JSON.stringify(hero.look || hero.view || {}));
}

export function portraitSrc(hero) { return cache.get(lookKey(hero)) || null; }

/** hero: anything with { seed, look } or { seed, view } */
export function requestPortrait(hero, cb) {
    const k = lookKey(hero);
    if (cache.has(k)) { cb && cb(cache.get(k)); return; }
    if (waiting.has(k)) { if (cb) waiting.get(k).push(cb); return; }
    waiting.set(k, cb ? [cb] : []);
    queue.push({ k, hero });
}

export function invalidatePortrait(hero) { cache.delete(lookKey(hero)); }

function render(job) {
    if (!scene) setup();
    const v = job.hero.view;
    const rig = v && v.kind === 'monster' ? buildMonster({ ...v, size: 1 }) : buildCharacter(job.hero.look || v.look);
    rig.root.rotation.y = 0.32;
    scene.add(rig.root);
    const hy = rig.headY || 1.0;
    const tall = rig.kind === 'monster' && rig.height > 1.2;
    cam.position.set(0.32, hy + 0.08, tall ? 3.2 : 2.25);
    cam.lookAt(0, hy - (rig.kind === 'monster' ? 0.12 : 0.18), 0);
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, pixels);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    scene.remove(rig.root);
    disposeObject(rig.root);
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
        const src = (SIZE - 1 - y) * SIZE * 4;
        img.data.set(pixels.subarray(src, src + SIZE * 4), y * SIZE * 4);
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
}

/** Renders up to n queued portraits; call once per frame. */
export function pumpPortraits(n = 2) {
    if (!renderer) return;
    for (let i = 0; i < n && queue.length; i++) {
        const job = queue.shift();
        let url = null;
        try { url = render(job); } catch (e) { console.warn('portrait failed', e); url = ''; }
        cache.set(job.k, url);
        const cbs = waiting.get(job.k) || [];
        waiting.delete(job.k);
        for (const cb of cbs) cb(url);
    }
}

export function portraitsPending() { return queue.length; }
