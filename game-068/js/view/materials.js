/**
 * materials.js — the shared material every model uses: vertex colours, a little roughness, and a
 * per-vertex `glow` added as emission (more at night). Windows, lanterns, flames and the dead's
 * eyes glow with no extra lights. Same idea as game-067.
 */

import * as THREE from 'three';

export const night = { value: 0 };   // shared uniform, 0 = day … 1 = night
export const time = { value: 0 };

function patchGlow(mat, key) {
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uNight = night;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.35 + uNight * 1.6);');
    };
    mat.customProgramCacheKey = () => key;
    return mat;
}

export const toyMat = patchGlow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0 }), 'hr-glow');

/** For instanced actors: instance colour multiplies vertex colour; glow from the vertex attribute. */
export const actorMat = patchGlow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }), 'hr-actor');

export function ghostMat(ok = true) {
    return new THREE.MeshBasicMaterial({ color: ok ? 0x8ff0a0 : 0xff7a6a, transparent: true, opacity: 0.5, depthWrite: false });
}
