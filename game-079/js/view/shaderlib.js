// Shared GLSL and the uniforms every lit thing in the world reads.
//
// SU is one object of uniforms spread into every custom material, so a single
// SU.uTime.value = t reaches every shader. The lightmap is the level's baked light over the XZ
// plane (rgb, ×4 range in a byte texture); uDL/uDLC are up to MAX_DL dynamic point lights
// (muzzle flashes, rockets, explosions) refilled every frame by priority.

import * as THREE from 'three';

export const MAX_DL = 12;

export const SU = {
    uTime: { value: 0 },
    uLM: { value: null },
    uLMSize: { value: new THREE.Vector2(1, 1) },
    uDL: { value: Array.from({ length: MAX_DL }, () => new THREE.Vector4(0, -999, 0, 0)) },
    uDLC: { value: Array.from({ length: MAX_DL }, () => new THREE.Vector3()) },
    uFogColor: { value: new THREE.Color(0x120a1e) },
    uFogDensity: { value: 0.012 },
    uAmbient: { value: new THREE.Color(0x1a1428) },
    uSkyLight: { value: 0 },
};

export const NOISE = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y);
    float b = mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y);
    return mix(a, b, u.z);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vnoise3(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
// Worley-ish cells: distance to the nearest jittered point, and its id
vec2 cells(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d = 9.0; float id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash22(i + g);
        vec2 r = g + o - f;
        float dd = dot(r, r);
        if (dd < d) { d = dd; id = hash12(i + g); }
    }
    return vec2(sqrt(d), id);
}
`;

// Lightmap + dynamic lights, shared by the world shader and the actor patch.
export const LIGHTS = /* glsl */`
uniform sampler2D uLM;
uniform vec2 uLMSize;
uniform vec4 uDL[${MAX_DL}];
uniform vec3 uDLC[${MAX_DL}];
uniform vec3 uAmbient;
vec3 bakedLight(vec3 wp, vec3 n) {
    vec2 luv = (wp.xz + n.xz * 0.6) / uLMSize;
    return texture2D(uLM, luv).rgb * 4.0;
}
vec3 dynLight(vec3 wp, vec3 n) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < ${MAX_DL}; i++) {
        vec4 L = uDL[i];
        if (L.w <= 0.0) continue;
        vec3 d = L.xyz - wp;
        float dist = length(d);
        float att = clamp(1.0 - dist / L.w, 0.0, 1.0);
        att *= att;
        float lam = clamp(dot(n, d / max(dist, 1e-3)) * 0.75 + 0.25, 0.0, 1.0);
        acc += uDLC[i] * att * lam;
    }
    return acc;
}
`;

/**
 * Patch a MeshStandardMaterial so it is lit like the world: lightmap and dynamic lights added as
 * emissive light on the albedo, plus rim light, hit flash, freeze, burn, windup glow and a
 * dissolve. U is a per-model uniform bag ({ uHit, uFrozen, uBurn, uGlow, uDissolve, uTint }),
 * shared by every material of one model so one write flashes the whole body.
 */
export function patchActor(m, U, key = 'actor') {
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, SU, U);
        sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vOP;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            vec4 wp4 = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4;
            #endif
            vWP = (modelMatrix * wp4).xyz;
            vOP = position;`);
        sh.fragmentShader = 'varying vec3 vWP;\nvarying vec3 vOP;\nuniform float uHit, uFrozen, uBurn, uGlow, uDissolve, uTime;\nuniform vec3 uTint;\n' + NOISE + LIGHTS +
            sh.fragmentShader
                .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                    if (uDissolve > 0.0 && vnoise3(vOP * 4.0) < uDissolve) discard;`)
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                    {
                        vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
                        vec3 lit = bakedLight(vWP, wn) + dynLight(vWP, wn) + uAmbient;
                        totalEmissiveRadiance += diffuseColor.rgb * lit * 0.85;
                        float fres = clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
                        float rim = fres * fres * fres;
                        totalEmissiveRadiance += uTint * rim * 0.35;
                        totalEmissiveRadiance += vec3(1.0, 0.85, 0.7) * uHit * 0.7;
                        totalEmissiveRadiance += vec3(1.0, 0.25, 0.05) * uGlow * (0.6 + 0.4 * sin(uTime * 30.0));
                        float burnN = vnoise3(vOP * 6.0 + vec3(0.0, -uTime * 3.0, 0.0));
                        totalEmissiveRadiance += vec3(1.0, 0.4, 0.05) * uBurn * smoothstep(0.45, 0.8, burnN) * 2.0;
                        if (uDissolve > 0.0) {
                            float edge = vnoise3(vOP * 4.0) - uDissolve;
                            totalEmissiveRadiance += vec3(0.6, 0.9, 1.0) * (1.0 - smoothstep(0.0, 0.08, edge)) * 3.0;
                        }
                    }`)
                .replace('#include <dithering_fragment>', `#include <dithering_fragment>
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.85, 1.0) * (0.4 + 0.6 * dot(gl_FragColor.rgb, vec3(0.33))) + vec3(0.1, 0.18, 0.25), uFrozen * 0.85);`);
        m.userData.shader = sh;
    };
    m.customProgramCacheKey = () => key;
    return m;
}

/** A fresh per-model uniform bag. */
export function actorUniforms(tint = 0x6a5aff) {
    return {
        uHit: { value: 0 }, uFrozen: { value: 0 }, uBurn: { value: 0 }, uGlow: { value: 0 },
        uDissolve: { value: 0 }, uTint: { value: new THREE.Color(tint) },
    };
}

/** Fog for custom shaders (exp2), applied in linear space before tone mapping. */
export const FOG = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 c, float dist) {
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    return mix(c, uFogColor, clamp(f, 0.0, 1.0));
}
`;
