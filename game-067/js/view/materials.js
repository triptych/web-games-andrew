/**
 * materials.js — the shared toy-plastic material and the procedural baseplate stud texture.
 *
 * Every model is merged into one geometry with per-vertex colours and a per-vertex `glow` (windows,
 * lamps, headlights). The material is a MeshStandardMaterial patched so that glow × uNight is added
 * as emission: at night windows light up in their own colour with no extra lights.
 */

import * as THREE from 'three';

export const night = { value: 0 };   // shared uniform, 0 = day … 1 = night

function patchGlow(mat) {
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uNight = night;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.18 + uNight * 1.7);');
    };
    mat.customProgramCacheKey = () => 'toy-glow';
    return mat;
}

export const toyMat = patchGlow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.0 }));

/** A brighter, unshaded-looking variant for tiny details that should never go dark. */
export const flatMat = new THREE.MeshBasicMaterial({ vertexColors: true });

/** Ghost material for placement previews. */
export function ghostMat() {
    return new THREE.MeshBasicMaterial({ color: 0x6ee87a, transparent: true, opacity: 0.55, depthWrite: false });
}

/**
 * Normal map for one tile of baseplate: 4×4 studs. The ground's UVs are world x/z, so it repeats
 * once per tile. Drawn as a height field on a canvas, then converted to normals.
 */
export function studNormalMap() {
    const S = 128, studs = 4, cell = S / studs, r = cell * 0.3;
    const h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const cx = (x % cell) - cell / 2 + 0.5, cy = (y % cell) - cell / 2 + 0.5;
        const d = Math.hypot(cx, cy);
        // a stud: flat top, rounded shoulder; a faint shadow ring around its foot
        h[y * S + x] = d < r - 1.5 ? 1 : d < r + 1.5 ? (r + 1.5 - d) / 3 : d < r + 4 ? -0.08 * (1 - (d - r - 1.5) / 2.5) : 0;
    }
    const data = new Uint8Array(S * S * 4);
    const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
        const l = Math.hypot(dx, dy, 1);
        const k = (y * S + x) * 4;
        data[k] = ((-dx / l) * 0.5 + 0.5) * 255;
        data[k + 1] = ((dy / l) * 0.5 + 0.5) * 255;
        data[k + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        data[k + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
}
