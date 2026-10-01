/**
 * fow.js — fog of war as a texture. One texel per tile: 0 unseen, ~0.35
 * remembered, 1 visible, eased every frame so the dark peels back smoothly.
 *
 * patchFow(material) splices a few lines into any built-in material: tiles you
 * have never seen are black, remembered tiles fall back to a cold desaturated
 * memory of their albedo, visible tiles are lit normally. With { cut: true }
 * (walls) instances between the camera and the hero are cut down so the hero
 * is never hidden behind a wall.
 */

import * as THREE from 'three';

export const fow = {
    tex: null, data: null, cur: null, w: 1, h: 1,
    uniforms: {
        uFow: { value: null }, uFowSize: { value: new THREE.Vector2(1, 1) },
        uHero: { value: new THREE.Vector2() }, uTime: { value: 0 },
    },
};

export function initFow(w, h) {
    if (fow.tex) fow.tex.dispose();
    fow.w = w; fow.h = h;
    fow.data = new Uint8Array(w * h * 4);
    fow.cur = new Float32Array(w * h);
    fow.tex = new THREE.DataTexture(fow.data, w, h, THREE.RGBAFormat);
    fow.tex.magFilter = THREE.LinearFilter;
    fow.tex.minFilter = THREE.LinearFilter;
    fow.tex.needsUpdate = true;
    fow.uniforms.uFow.value = fow.tex;
    fow.uniforms.uFowSize.value.set(w, h);
}

/** Ease towards the target visibility; returns true if anything changed. */
export function updateFow(vis, seen, dt, snap = false) {
    const { cur, data } = fow;
    const k = snap ? 1 : 1 - Math.pow(0.0005, dt);
    let changed = false;
    for (let i = 0; i < cur.length; i++) {
        const want = vis[i] ? 1 : seen[i] ? 0.35 : 0;
        const c = cur[i];
        if (c === want) continue;
        let n = c + (want - c) * k;
        if (Math.abs(n - want) < 0.01) n = want;
        cur[i] = n;
        const v = Math.round(n * 255);
        if (data[i * 4] !== v) { data[i * 4] = v; changed = true; }
    }
    if (changed) fow.tex.needsUpdate = true;
    return changed;
}

export function patchFow(mat, opts = {}) {
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, fow.uniforms);
        sh.vertexShader = 'varying vec3 vFowW;\nuniform vec2 uHero;\n' + sh.vertexShader
            .replace('#include <begin_vertex>', `#include <begin_vertex>
${opts.cut ? `#ifdef USE_INSTANCING
                vec3 icut = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                float cdz = icut.z - uHero.y;
                float cut = smoothstep(3.4, 2.2, abs(icut.x - uHero.x)) * step(0.4, cdz) * smoothstep(3.8, 2.6, cdz);
                transformed.y *= mix(1.0, 0.18, cut);
#endif` : ''}`)
            .replace('#include <project_vertex>', `#include <project_vertex>
                vec4 fowW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
                fowW = instanceMatrix * fowW;
#endif
                vFowW = (modelMatrix * fowW).xyz;`);
        sh.fragmentShader = 'varying vec3 vFowW;\nuniform sampler2D uFow;\nuniform vec2 uFowSize;\n' + sh.fragmentShader
            .replace('#include <dithering_fragment>', `#include <dithering_fragment>
                float fv = texture2D(uFow, (vFowW.xz + 0.5) / uFowSize).r;
                float seenF = smoothstep(0.02, 0.3, fv);
                float visF = smoothstep(0.42, 0.95, fv);
                vec3 memory = vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.32, 0.36, 0.5);
                vec3 lit = gl_FragColor.rgb + diffuseColor.rgb * 0.07;   // nothing you can see is pitch black
                gl_FragColor.rgb = mix(memory, lit, visF) * seenF;`);
    };
    mat.customProgramCacheKey = () => (opts.cut ? 'fow-cut' : 'fow');
    return mat;
}

export const FOW_GLSL = `
    uniform sampler2D uFow; uniform vec2 uFowSize;
    float fowAt(vec2 xz) { return texture2D(uFow, (xz + 0.5) / uFowSize).r; }
`;
