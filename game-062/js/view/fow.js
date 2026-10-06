// Fog of war as a texture (one texel per tile: 0 unseen, ~0.4 remembered, 1 visible), eased
// every frame and sampled by every level material through one onBeforeCompile patch. Walls
// near the hero and between the hero and the camera are cut down in the vertex shader.

import * as THREE from 'three';

export const fow = {
    tex: null, data: null, cur: null, w: 1, h: 1, town: false,
    uniforms: {
        uFow: { value: null }, uFowSize: { value: new THREE.Vector2(1, 1) },
        uHero: { value: new THREE.Vector2() }, uTime: { value: 0 }, uFowOn: { value: 1 },
    },
};

export function initFow(w, h, town) {
    if (fow.tex) fow.tex.dispose();
    fow.w = w; fow.h = h; fow.town = town;
    fow.data = new Uint8Array(w * h * 4);
    fow.cur = new Float32Array(w * h);
    fow.tex = new THREE.DataTexture(fow.data, w, h, THREE.RGBAFormat);
    fow.tex.magFilter = THREE.LinearFilter;
    fow.tex.minFilter = THREE.LinearFilter;
    fow.tex.needsUpdate = true;
    fow.uniforms.uFow.value = fow.tex;
    fow.uniforms.uFowSize.value.set(w, h);
    fow.uniforms.uFowOn.value = town ? 0 : 1;
}

export function updateFow(vis, seen, dt, snap = false) {
    const { cur, data } = fow;
    if (!cur) return;
    const k = snap ? 1 : 1 - Math.pow(0.002, dt);
    let changed = false;
    for (let i = 0; i < cur.length; i++) {
        const want = vis[i] ? 1 : seen[i] ? 0.4 : 0;
        const c = cur[i];
        if (c === want) continue;
        let n = c + (want - c) * k;
        if (Math.abs(n - want) < 0.01) n = want;
        cur[i] = n;
        const v = Math.round(n * 255);
        if (data[i * 4] !== v) { data[i * 4] = v; changed = true; }
    }
    if (changed) fow.tex.needsUpdate = true;
}

/** Patch a built-in material to read the fog of war (and optionally cut away walls near the hero). */
export function patchFow(mat, opts = {}) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        Object.assign(sh.uniforms, fow.uniforms);
        sh.vertexShader = 'varying vec3 vFowW;\nvarying float vTopFace;\nuniform vec2 uHero;\n' + sh.vertexShader
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vTopFace = normal.y > 0.5 ? 1.0 : 0.0;
${opts.cut ? `#ifdef USE_INSTANCING
                vec3 icut = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                float cdz = icut.z - uHero.y;
                float cut = smoothstep(3.6, 2.4, abs(icut.x - uHero.x)) * smoothstep(-0.2, 0.6, cdz) * smoothstep(5.0, 3.6, cdz);
                transformed.y *= mix(1.0, 0.1, cut);
#endif` : ''}`)
            .replace('#include <project_vertex>', `#include <project_vertex>
                vec4 fowW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
                fowW = instanceMatrix * fowW;
#endif
                vFowW = (modelMatrix * fowW).xyz;`);
        sh.fragmentShader = 'varying vec3 vFowW;\nvarying float vTopFace;\nuniform sampler2D uFow;\nuniform vec2 uFowSize;\nuniform float uFowOn;\n' + sh.fragmentShader
            .replace('#include <dithering_fragment>', `#include <dithering_fragment>
                ${opts.darkTop ? 'gl_FragColor.rgb *= mix(1.0, 0.16, vTopFace);' : ''}
                float fv = texture2D(uFow, (vFowW.xz) / uFowSize).r;
                float seenF = smoothstep(0.02, 0.3, fv);
                float visF = smoothstep(0.45, 0.95, fv);
                vec3 memory = vec3(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.55, 0.6, 0.85) + diffuseColor.rgb * 0.03;
                vec3 shown = mix(memory, gl_FragColor.rgb, visF) * seenF;
                gl_FragColor.rgb = mix(gl_FragColor.rgb, shown, uFowOn);`);
    };
    mat.customProgramCacheKey = () => `fow:${opts.cut ? 1 : 0}:${opts.darkTop ? 1 : 0}:${opts.key || ''}`;
    return mat;
}

export const FOW_GLSL = `
uniform sampler2D uFow; uniform vec2 uFowSize; uniform float uFowOn;
float fowAt(vec2 xz){ float fv = texture2D(uFow, xz / uFowSize).r; return mix(1.0, smoothstep(0.02, 0.3, fv) * mix(0.35, 1.0, smoothstep(0.45, 0.95, fv)), uFowOn); }
`;
