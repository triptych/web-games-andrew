/**
 * shaders.js — shared GLSL and the global uniforms every material sees.
 *
 * three's fog chunks are replaced (once, at import) by an exponential height fog whose colour
 * is looked up in the sky texture along the view ray, plus a glow toward the sun. Built-in
 * materials receive the uniforms through `patch()`; ShaderMaterials spread `G` and include
 * the fog chunks themselves.
 */
import * as THREE from 'three';

// Uniforms shared by reference across every material (one write reaches all programs).
export const G = {
    uTime: { value: 0 },
    uSkyTex: { value: null },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },     // toward the sun (or the moon at night)
    uSunCol: { value: new THREE.Color(1, 1, 1) },       // direct light colour × intensity
    uSunFog: { value: new THREE.Color(0.6, 0.5, 0.35) },// in-scatter glow toward the sun
    uFogDensity: { value: 0.0009 },
    uFogFalloff: { value: 0.006 },
    uFogBase: { value: 40 },
    uWind: { value: new THREE.Vector2(0.6, 0.3) },
    uWet: { value: 0 },
    uSnow: { value: 0 },
    uNight: { value: 0 },
    uPlayer: { value: new THREE.Vector3() },
    uLightning: { value: 0 },
};

export const GLSL_NOISE = /* glsl */`
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y);
    float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y);
    return mix(a, b, u.z);
}
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

export const GLSL_SKY = /* glsl */`
uniform sampler2D uSkyTex;
vec3 skyLookup(vec3 d) {
    float u = atan(d.z, d.x) * 0.15915494 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5;
    return texture2D(uSkyTex, vec2(u, v)).rgb;
}
`;

// ---------------------------------------------------------------- global fog override
THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
varying vec3 vFogWorld;
#endif
`;
THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif
`;
THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
uniform vec3 fogColor;
varying vec3 vFogWorld;
uniform vec3 uSunDir;
uniform vec3 uSunFog;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
${GLSL_SKY}
float heightFog(vec3 ro, vec3 rd, float dist) {
    float b = max(uFogFalloff, 1e-5);
    float h0 = clamp(ro.y - uFogBase, -200.0, 4000.0);
    float k = rd.y * b * dist;
    float shape = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0;
    float f = uFogDensity * exp(-h0 * b) * dist * shape;
    f += uFogDensity * 0.05 * dist;           // thin aerial haze at every height
    return 1.0 - exp(-max(f, 0.0));
}
vec3 fogColorFor(vec3 dir) {
    vec3 c = skyLookup(vec3(dir.x, max(dir.y, 0.0) * 0.6 + 0.015, dir.z));
    c += uSunFog * pow(max(dot(dir, uSunDir), 0.0), 7.0);
    return c;
}
#endif
`;
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
{
    vec3 fr = vFogWorld - cameraPosition;
    float fd = length(fr);
    vec3 fdir = fr / max(fd, 1e-3);
    float fa = heightFog(cameraPosition, fdir, fd);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColorFor(fdir), fa);
}
#endif
`;

const FOG_U = ['uSkyTex', 'uSunDir', 'uSunFog', 'uFogDensity', 'uFogFalloff', 'uFogBase'];

/** Give a built-in material the shared uniforms; `extra(shader)` may patch it further. */
export function patch(mat, extra, key) {
    mat.onBeforeCompile = (sh, r) => {
        for (const k of FOG_U) sh.uniforms[k] = G[k];
        sh.uniforms.uTime = G.uTime;
        sh.uniforms.uWind = G.uWind;
        if (extra) extra(sh, r);
    };
    if (key) mat.customProgramCacheKey = () => key;
    return mat;
}

/** Uniforms for a ShaderMaterial that wants fog and the globals. */
export function sharedUniforms(extra = {}) {
    return { ...THREE.UniformsLib.fog, ...G, ...extra };
}

/** Wind sway for vegetation: displace by height above the base, phase from world position. */
export const GLSL_WIND = /* glsl */`
uniform vec2 uWind;
vec3 windSway(vec3 world, float h, float stiff) {
    float t = uTime;
    float ph = dot(world.xz, vec2(0.07, 0.05));
    float gust = 0.6 + 0.4 * sin(t * 0.35 + world.x * 0.004 + world.z * 0.003);
    float s = (sin(t * 1.7 + ph) * 0.6 + sin(t * 2.9 + ph * 1.7) * 0.3) * gust;
    vec2 w = uWind * (0.35 + 0.25 * s) * h * h / stiff;
    return vec3(w.x, -0.15 * dot(w, w), w.y);
}
`;
