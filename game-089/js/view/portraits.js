// Portraits for the UI: each character's head rendered once by a small offscreen renderer and
// kept as a data URL, so the party cards, the turn order and the tavern show the real 3D models.

import * as THREE from 'three';
import { buildHumanoid, lookFor } from './chars.js';
import { buildMonster } from './monsters.js';
import { MONSTERS } from '../sim/data.js';

let R = null, scene = null, cam = null;
const cache = new Map();

function setup() {
    if (R) return true;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
        R.setPixelRatio(1);
        R.setSize(160, 160, false);
        R.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.6));
        const key = new THREE.DirectionalLight('#fff4e0', 2.2);
        key.position.set(2, 3, 4);
        scene.add(key);
        cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
        return true;
    } catch {
        R = null;
        return false;
    }
}

function shoot(obj, centre, dist, bg) {
    scene.add(obj);
    cam.position.set(centre.x + dist * 0.25, centre.y + dist * 0.08, centre.z + dist);
    cam.lookAt(centre);
    R.setClearColor(bg, 1);
    R.render(scene, cam);
    const url = R.domElement.toDataURL('image/png');
    scene.remove(obj);
    return url;
}

/** A head-and-shoulders portrait of a party member, rival or hero class. */
export function portrait(id, cls) {
    const key = 'h:' + id + ':' + (cls || '');
    if (cache.has(key)) return cache.get(key);
    if (!setup()) return '';
    const rig = buildHumanoid(lookFor(id, cls));
    rig.root.updateMatrixWorld(true);
    const url = shoot(rig.root, new THREE.Vector3(0, rig.hipY + 0.62, 0), 2.0, id === 'hero' ? '#bfe0ff' : '#ffe8c0');
    cache.set(key, url);
    return url;
}

/** A portrait of a monster for the turn order. */
export function monsterPortrait(eid) {
    const key = 'm:' + eid;
    if (cache.has(key)) return cache.get(key);
    if (!setup()) return '';
    const rig = buildMonster(MONSTERS[eid].model);
    const h = rig.height;
    const url = shoot(rig.root, new THREE.Vector3(0, h * 0.55, 0), h * 2.1 + 0.6, '#ffd0c8');
    cache.set(key, url);
    return url;
}
