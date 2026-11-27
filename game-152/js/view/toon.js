// Cel-shading helpers: a three-step gradient for MeshToonMaterial, and an inverted-hull ink outline.

import * as THREE from 'three';

let gradient = null;
/** Three hard light bands: shadow, mid, lit. Nearest filtering keeps the steps crisp. */
export function toonGradient() {
    if (gradient) return gradient;
    const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
    return gradient;
}

export function toon(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

const outlineMats = new Map();
/** A black back-face material pushed out along the normals: the ink line around a model. */
export function outlineMaterial(thickness = 0.05, color = 0x14121f) {
    const key = thickness + ':' + color;
    if (outlineMats.has(key)) return outlineMats.get(key);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.thick = { value: thickness };
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float thick;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * thick;');
    };
    m.customProgramCacheKey = () => 'outline' + key;
    outlineMats.set(key, m);
    return m;
}

/** Add an outline shell to every mesh under `root` (skips ones flagged noOutline). */
export function addOutlines(root, thickness) {
    const meshes = [];
    root.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o); });
    for (const m of meshes) {
        const shell = new THREE.Mesh(m.geometry, outlineMaterial(thickness));
        shell.userData.isOutline = true;
        shell.renderOrder = -1;
        m.add(shell);
    }
}
