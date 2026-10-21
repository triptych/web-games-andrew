// Daemons in 3D: sixteen sculpted rigs (see rigs/), each dressed by the species' recipe (colours,
// scale and extra parts such as horns, halos and flames). Smooth lofted meshes with painted skins
// and ink outlines; glowing parts are unlit so they bloom. Faces +z, stands on y = 0.

import * as THREE from 'three';
import { TOON } from './toon.js';
import { DAEMONS } from '../sim/data/daemons.js';
import { NATURE } from './rigs/nature.js';
import { BEASTS } from './rigs/beasts.js';
import { MACHINES } from './rigs/machines.js';
import { SPIRITS } from './rigs/spirits.js';

const RIGS = { ...NATURE, ...BEASTS, ...MACHINES, ...SPIRITS };

/** Build the 3D model for a species. Returns { root, h, r, pose(state, t), glowColor }. */
export function buildDaemon(spId) {
    const sp = DAEMONS[spId];
    const m = sp.model;
    const rig = (RIGS[m.rig] || RIGS.blob)({ c: m.c, s: m.s, x: m.x });
    const holder = new THREE.Group();
    holder.add(rig.root);
    holder.scale.setScalar(m.s);
    return {
        root: holder, inner: rig.root, h: rig.h * m.s, r: rig.r * m.s, glowColor: m.c[2], race: sp.race,
        pose: (st, t) => rig.anim(st || {}, t),
    };
}

let shellMat = null;
function hexShellMaterial() {
    if (shellMat) return shellMat;
    shellMat = new THREE.MeshBasicMaterial({ color: '#d24bff', side: THREE.BackSide, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, fog: false });
    shellMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = TOON.uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * (0.045 + 0.025 * sin(uTime * 7.0 + position.y * 9.0));');
    };
    shellMat.customProgramCacheKey = () => 'hexshell';
    shellMat.userData.shared = true;
    return shellMat;
}

/** Make a built model read as corrupted: a pulsing magenta shell that crawls over its surface. */
export function hexify(model) {
    const add = [];
    model.root.traverse((o) => {
        if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.userData.outline && !o.userData.hexshell) add.push(o);
    });
    for (const o of add) {
        const s = new THREE.Mesh(o.geometry, hexShellMaterial());
        s.raycast = () => {};
        s.userData.hexshell = true;
        o.add(s);
    }
    model.hexified = true;
    return model;
}
