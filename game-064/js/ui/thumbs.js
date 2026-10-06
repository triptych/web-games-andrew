// thumbs.js — renders each ship type once into a small transparent image, so the
// locker, the promotion picker and the help legend show the real 3D models.

import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createPiece } from '../view/ships.js';
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../sim/chess.js';

export const THUMBS = {};

export function renderThumbs(size = 128) {
    let r;
    try {
        r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch { return THUMBS; }
    r.setPixelRatio(1);
    r.setSize(size, size);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    const fx = new OutlineEffect(r, { defaultThickness: 0.008, defaultColor: [0.12, 0.1, 0.14] });
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x6fb3c8, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-3, 6, 4);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    for (const type of [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING]) {
        for (const color of [1, -1]) {
            const p = createPiece(type * color);
            if (p.beam) p.body.remove(p.beam);   // or its invisible cone inflates the bounds
            // Same three-quarter view for both fleets (the Pirates' body is already turned round).
            p.root.rotation.y = color > 0 ? -0.9 : -0.9 + Math.PI;
            scene.add(p.root);
            p.root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(p.body);
            const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
            const rad = Math.max(sz.x, sz.y, sz.z) * 0.62;
            const dist = rad / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2));
            cam.position.copy(c).add(new THREE.Vector3(1, 0.5, 1.15).normalize().multiplyScalar(dist));
            cam.lookAt(c);
            fx.render(scene, cam);
            THUMBS[type * color] = r.domElement.toDataURL('image/png');
            scene.remove(p.root);
        }
    }
    r.dispose();
    r.forceContextLoss?.();
    return THUMBS;
}
