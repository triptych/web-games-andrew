// Material textures for three.js: an albedo, a normal map and a height map per recipe (the painters are in paint.js).
//
// Painting a 512 px texture takes 100–200 ms of JavaScript, and a three-level dungeon needs about fifteen, so it is
// never done on the main thread when it can be helped: materialMaps() returns at once with a 16 px placeholder
// (painted in well under a millisecond) and a pool of Web Workers paints the real thing in parallel; each texture is
// swapped in place when it arrives (the materials never change). Without workers (or if one fails to start) the
// textures are painted on the main thread one per tick, so the page still breathes and the progress bar still moves.

import * as THREE from 'three';
import { bake, RECIPES, paint } from './paint.js';
import { addWork, doneWork } from '../progress.js';

const PLACEHOLDER = 16;
const cache = new Map();
const jobs = new Map();          // id → { name, size, out }
let nextId = 1;
let pool = null;                 // [{ worker, busy }] or [] when workers are not available
const queue = [];

function makePool() {
    if (pool) return pool;
    pool = [];
    if (typeof Worker === 'undefined' || new URLSearchParams(location.search).get('workers') === '0') return pool;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    try {
        for (let i = 0; i < n; i++) {
            const worker = new Worker(new URL('./paint-worker.js', import.meta.url), { type: 'module' });
            const slot = { worker, busy: null };
            worker.onmessage = (e) => { finish(e.data); slot.busy = null; pump(); };
            worker.onerror = (e) => {
                // a worker that can't start (no module workers) hands its job back and the pool shrinks
                e.preventDefault?.();
                pool.splice(pool.indexOf(slot), 1);
                if (slot.busy) queue.unshift(slot.busy);
                slot.busy = null;
                try { worker.terminate(); } catch { /* gone */ }
                pump();
            };
            pool.push(slot);
        }
    } catch { pool = []; }
    return pool;
}

let ticking = false;
function pump() {
    for (const slot of pool) {
        if (slot.busy || !queue.length) continue;
        const id = queue.shift();
        slot.busy = id;
        const j = jobs.get(id);
        slot.worker.postMessage({ id, name: j.name, size: j.size });
    }
    // no workers at all: paint here, one texture per tick
    if (!pool.length && queue.length && !ticking) {
        ticking = true;
        setTimeout(() => {
            ticking = false;
            const id = queue.shift();
            if (id !== undefined) { const j = jobs.get(id); finish({ id, ...bake(j.name, j.size) }); }
            pump();
        }, 0);
    }
}

function swap(tex, data, size) {
    // the GPU copy has fixed-size storage: let it go first, or a 16 px texture can't become a 512 px one
    tex.dispose();
    tex.image = { data, width: size, height: size };
    tex.needsUpdate = true;
}

function finish({ id, albedo, normal, hgt }) {
    const j = jobs.get(id);
    if (!j) return;
    jobs.delete(id);
    swap(j.out.map, albedo, j.size);
    swap(j.out.normalMap, normal, j.size);
    swap(j.out.heightMap, hgt, j.size);
    j.out.ready = true;
    doneWork('textures');
}

function texture(data, size, srgb) {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
}

/** { map, normalMap, heightMap, ready } for a recipe, made once. Ready later: the full texture is painted in a worker. */
export function materialMaps(name, size = 512) {
    const key = name + ':' + size;
    if (cache.has(key)) return cache.get(key);
    const ph = bake(name, PLACEHOLDER);
    const out = { map: texture(ph.albedo, PLACEHOLDER, true), normalMap: texture(ph.normal, PLACEHOLDER, false), heightMap: texture(ph.hgt, PLACEHOLDER, false), ready: false };
    cache.set(key, out);
    const id = nextId++;
    jobs.set(id, { name, size, out });
    queue.push(id);
    addWork('textures');
    makePool();
    pump();
    return out;
}

export { RECIPES, paint };
