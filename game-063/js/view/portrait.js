// Dialogue portraits: each speaker's rig rendered head-and-shoulders into a small offscreen canvas,
// one image per speaker × expression, cached as data URLs.

import * as THREE from 'three';
import { makeSpeaker } from './stage.js';
import { setPose, animate } from './anim.js';
import { TOON } from './toon.js';

const SIZE = 160;
// [look-at x, look-at y, camera distance] with the rig at scale 1
const H = [0, 1.0, 1.3];
const FRAME = {
    hero: H, queen: H, eagle: H, fescue: H, zeph: H, yodel: H, cinder: H, albatross: H, bogey: [0, 1.08, 1.45],
    wedge: [0.08, -0.32, 1.25], gopher: [0, 1.2, 3.2], worm: [0, 1.4, 3.8], yeti: [0, 2.0, 4.4], ogre: [0, 6.0, 7.0], dragon: [0, 6.9, 9.5],
};

export class Portraits {
    constructor() {
        this.cache = new Map();
        this.rigs = new Map();
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = SIZE;
        try {
            this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
            this.r.setPixelRatio(1);
            this.r.setSize(SIZE, SIZE, false);
        } catch { this.r = null; }
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.HemisphereLight('#fff4e0', '#806a8a', 1.6));
        const d = new THREE.DirectionalLight('#ffffff', 2.0);
        d.position.set(2, 4, 5);
        this.scene.add(d);
        this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    }

    get(key, expr, profile) {
        const id = `${key}:${expr}:${key === 'hero' ? profile.look + '/' + profile.outfit : ''}`;
        if (this.cache.has(id)) return this.cache.get(id);
        if (!this.r) return '';
        let rig = this.rigs.get(key + (key === 'hero' ? profile.look + '/' + profile.outfit : ''));
        if (!rig) {
            rig = makeSpeaker(key, profile);
            rig.root.scale.setScalar(1);
            if (rig.kind === 'humanoid') { setPose(rig, 'idle'); for (let i = 0; i < 20; i++) animate(rig, 0.05, 0); rig.blinkT = 999; }
            this.rigs.set(key + (key === 'hero' ? profile.look + '/' + profile.outfit : ''), rig);
        }
        for (const c of [...this.scene.children]) if (c.userData.portrait) this.scene.remove(c);
        rig.root.userData.portrait = true;
        rig.root.position.set(0, 0, 0);
        rig.root.rotation.set(0, 0, 0);
        this.scene.add(rig.root);
        rig.setExpr?.(expr === 'smug' && rig.kind !== 'humanoid' ? 'smug' : expr);
        const f = FRAME[key] ?? [0, 1.8, 2.2];
        this.cam.position.set(f[0] + f[2] * 0.12, f[1] + f[2] * 0.06, f[2]);
        this.cam.lookAt(f[0], f[1] - f[2] * 0.04, 0);
        const rim = TOON.uRimK.value;
        TOON.uRimK.value = 0.25;
        this.r.render(this.scene, this.cam);
        TOON.uRimK.value = rim;
        const url = this.canvas.toDataURL('image/png');
        this.cache.set(id, url);
        return url;
    }
}
