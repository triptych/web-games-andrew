// Small pictures for the DOM: goal icons, the journal, the reward card and dialogue portraits.
// One tiny offscreen WebGL renderer draws each model once and the PNG is cached by key.
// Nothing here is drawn before it is asked for, and a picture asked for twice is drawn once.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tileModel, rockGeos, tileGeos, crustGeos, relicGroup } from './models.js';
import { instance, Kit, box } from './kit.js';
import { buildArtifact } from './artifacts.js';
import { buildBonePart } from './skeleton.js';
import { buildAnimal, animate } from './animals.js';
import { ITEM, PEOPLE } from '../sim/data.js';

let R = null, env = null;
const cache = new Map();
const SIZE = 128;

function renderer() {
    if (R) return R;
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    try {
        R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch { R = false; return R; }
    R.setPixelRatio(1);
    R.setSize(SIZE, SIZE, false);
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.05;
    env = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(R), 0.04).texture;
    return R;
}

function shoot(obj, { dist = 1.5, y = 0, yaw = 0, pitch = 0.15, fov = 32 } = {}) {
    const r = renderer();
    if (!r) return '';
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a48, 0.8));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8);
    sun.position.set(1.5, 3, 3);
    scene.add(sun);
    scene.add(obj);
    const cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
    cam.position.set(Math.sin(yaw) * dist * Math.cos(pitch), y + Math.sin(pitch) * dist, Math.cos(yaw) * dist * Math.cos(pitch));
    cam.lookAt(0, y, 0);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/png');
}

const get = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

/** A goal's picture: a colour's find, dirt, a fossil, a boulder, crust or a relic. */
export function goalIcon(g) {
    const key = g.kind === 'color' ? 'tile' + g.c : 'goal-' + g.kind;
    return get(key, () => {
        if (g.kind === 'color') return shoot(tileModel({ k: 'gem', c: g.c }).group, { dist: 1.45 });
        if (g.kind === 'soil') {
            const k = new Kit();
            k.add(box(0.9, 0.36, 0.9), (x, y) => (y > 0.1 ? '#8a5a3a' : '#6a4228'), 'flat');
            for (let i = 0; i < 5; i++) k.add(new THREE.IcosahedronGeometry(0.07, 0), '#b89a72', 'flat', { p: [Math.cos(i * 2.4) * 0.28, 0.2, Math.sin(i * 2.4) * 0.28] });
            return shoot(k.build(), { dist: 2.1, pitch: 0.6 });
        }
        if (g.kind === 'fossil') return shoot(instance(tileGeos(5)), { dist: 1.4 });
        if (g.kind === 'rock') return shoot(instance(rockGeos(2, 0)), { dist: 1.7, pitch: 0.3 });
        if (g.kind === 'crust') {
            const grp = new THREE.Group();
            grp.add(instance(tileGeos(1)), instance(crustGeos()));
            return shoot(grp, { dist: 1.5 });
        }
        if (g.kind === 'relic') return shoot(relicGroup(1), { dist: 1.5 });
        return '';
    });
}

export function tileIcon(c) { return goalIcon({ kind: 'color', c }); }

/** A find from the collection. */
export function itemIcon(id) {
    return get('item-' + id, () => {
        const it = ITEM[id];
        if (!it) return '';
        if (it.kind === 'bone') {
            const g = buildBonePart(it.dino, it.part);
            const box3 = new THREE.Box3().setFromObject(g);
            const size = box3.getSize(new THREE.Vector3()), c = box3.getCenter(new THREE.Vector3());
            const s = 1 / Math.max(size.x, size.y, size.z);
            g.position.set(-c.x * s, -c.y * s, -c.z * s);
            g.scale.setScalar(s);
            const holder = new THREE.Group(); holder.add(g);
            return shoot(holder, { dist: 2.0, yaw: 0.9, pitch: 0.25 });
        }
        return shoot(buildArtifact(it, 1), { dist: 2.0, yaw: 0.4, pitch: 0.2 });
    });
}

/** A head-and-shoulders portrait of a person. */
export function portrait(who) {
    return get('face-' + who, () => {
        const P = PEOPLE[who];
        const a = buildAnimal(P ? P.animal : 'player');
        animate(a, 0.5, {});
        return shoot(a.group, { dist: 2.3, y: 1.0, pitch: 0.05, fov: 30 });
    });
}

/** Draw a batch of pictures over a few frames, so opening the journal never stalls. */
export function warm(list, done) {
    const todo = list.filter(([kind, arg]) => !cache.has(kind === 'item' ? 'item-' + arg : kind === 'face' ? 'face-' + arg : 'tile' + arg));
    let i = 0;
    const step = () => {
        const t0 = performance.now();
        while (i < todo.length && performance.now() - t0 < 12) {
            const [kind, arg] = todo[i++];
            if (kind === 'item') itemIcon(arg); else if (kind === 'face') portrait(arg); else tileIcon(arg);
        }
        if (i < todo.length) requestAnimationFrame(step); else done?.();
    };
    step();
}
