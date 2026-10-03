/**
 * materials.js — the custom shaders that give the game its look.
 *
 *  world   — level surfaces: albedo+height texture with derivative bump
 *            mapping, a baked lightmap sampled by world XZ (static lights,
 *            ambient occlusion in alpha), a second lightmap for flickering
 *            lights, up to 8 dynamic point lights (muzzle flashes, rockets,
 *            explosions), emission, animated liquids and distance fog.
 *  actor   — monsters, pickups, props: vertex colour + 3D noise skin detail,
 *            the same lightmap and dynamic lights so they sit in the room,
 *            rim light, hit flash and a noise dissolve for deaths/teleports.
 *  glow    — additive camera-facing quads for halos, projectiles and flares.
 *
 * Every material shares one set of global uniform *objects* (G), so updating
 * G.uTime.value once per frame reaches every shader.
 */
import * as THREE from 'three';
import { MAX_DYN_LIGHTS } from '../config.js';

export const G = {
    uTime: { value: 0 },
    uLM: { value: null },
    uLMF: { value: null },
    uLMSize: { value: new THREE.Vector2(1, 1) },
    uDL: { value: Array.from({ length: MAX_DYN_LIGHTS }, () => new THREE.Vector4(0, -100, 0, 0)) },
    uDLC: { value: Array.from({ length: MAX_DYN_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
    uFog: { value: new THREE.Color(0x000000) },
    uFogD: { value: 0.02 },
    uAmb: { value: new THREE.Color(0.08, 0.08, 0.1) },
    uCamPos: { value: new THREE.Vector3() },
    uFlickAmt: { value: 1 },
};

const NOISE_GLSL = /* glsl */`
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    float n000 = hash13(i), n100 = hash13(i+vec3(1,0,0)), n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
    float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1)), n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += vnoise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

const LIGHT_GLSL = /* glsl */`
uniform sampler2D uLM;
uniform sampler2D uLMF;
uniform vec2 uLMSize;
uniform vec4 uDL[${MAX_DYN_LIGHTS}];
uniform vec3 uDLC[${MAX_DYN_LIGHTS}];
uniform vec3 uFog;
uniform float uFogD;
uniform vec3 uAmb;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uFlickAmt;

vec4 sampleLM(vec3 wp, vec3 n, out vec3 flickLight){
    vec2 luv = (wp.xz + n.xz * 0.35) / uLMSize;
    vec4 lm = texture2D(uLM, luv);
    vec4 lf = texture2D(uLMF, luv);
    float ph = lf.a * 6.2831;
    float fl = 0.62 + 0.38 * sin(uTime * 9.0 + ph * 7.0) * sin(uTime * 23.0 + ph * 3.0 + sin(uTime * 3.1 + ph));
    fl = mix(1.0, fl, uFlickAmt);
    flickLight = lf.rgb * fl;
    return lm;
}

vec3 dynLights(vec3 wp, vec3 N, vec3 V, inout float spec){
    vec3 acc = vec3(0.0);
    for (int i = 0; i < ${MAX_DYN_LIGHTS}; i++){
        float r = uDL[i].w;
        if (r <= 0.0) continue;
        vec3 L = uDL[i].xyz - wp;
        float d = length(L);
        float att = clamp(1.0 - d / r, 0.0, 1.0);
        att *= att;
        if (att <= 0.0) continue;
        vec3 Ld = L / max(d, 1e-3);
        float ndl = max(dot(N, Ld), 0.0);
        acc += uDLC[i] * att * (ndl * 0.85 + 0.15);
        vec3 H = normalize(Ld + V);
        spec += pow(max(dot(N, H), 0.0), 40.0) * att * dot(uDLC[i], vec3(0.33));
    }
    return acc;
}

vec3 applyFog(vec3 col, float dist){
    float f = 1.0 - exp(-pow(dist * uFogD, 1.5));
    return mix(col, uFog, clamp(f, 0.0, 1.0));
}
`;

// ------------------------------------------------------------------ world

const WORLD_VS = /* glsl */`
attribute float aAO;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vAO;
varying vec3 vView;
void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vAO = aAO;
    vec4 mv = viewMatrix * wp;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}
`;

const WORLD_FS = /* glsl */`
uniform sampler2D uMap;
uniform sampler2D uEmit;
uniform float uLiquid;
uniform float uEmitBoost;
uniform float uBump;
uniform float uSpec;
uniform vec3 uTint;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vAO;
varying vec3 vView;
${LIGHT_GLSL}

vec3 perturb(vec3 p, vec3 n, vec2 dh){
    vec3 sx = dFdx(p), sy = dFdy(p);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
    return normalize(abs(det) * n - grad);
}

void main(){
    vec2 uv = vUv;
    if (uLiquid > 0.5) {
        uv += vec2(sin(vUv.y * 5.0 + uTime * 0.9), cos(vUv.x * 4.0 + uTime * 0.7)) * 0.045 + vec2(uTime * 0.025, uTime * 0.017);
    }
    vec4 tex = texture2D(uMap, uv);
    vec3 albedo = tex.rgb * uTint;
    vec3 Ng = normalize(vNormal);
    if (!gl_FrontFacing) Ng = -Ng;
    float h = tex.a;
    vec2 dh = vec2(dFdx(h), dFdy(h)) * uBump;
    vec3 N = perturb(vWorld, Ng, dh);

    vec3 flick;
    vec4 lm = sampleLM(vWorld, Ng, flick);
    vec3 light = uAmb + lm.rgb + flick;
    float ao = mix(0.35, 1.0, lm.a) * vAO;
    float face = 1.0 - 0.14 * abs(Ng.x) - 0.25 * max(-Ng.y, 0.0);
    float relief = 0.72 + 0.28 * clamp(dot(N, normalize(Ng + vec3(0.2, 0.75, 0.15))), 0.0, 1.0);
    light *= ao * face * relief;

    vec3 V = normalize(uCamPos - vWorld);
    float spec = 0.0;
    vec3 dyn = dynLights(vWorld, N, V, spec);
    // a little sheen from the baked light on metal-ish surfaces
    spec += pow(max(dot(N, normalize(V + vec3(0.0, 0.6, 0.0))), 0.0), 24.0) * dot(lm.rgb, vec3(0.33)) * 0.35;

    vec3 col = albedo * (light + dyn) + spec * uSpec * (0.4 + h * 0.6);
    vec3 em = texture2D(uEmit, uv).rgb * uEmitBoost;
    if (uLiquid > 0.5) em *= 0.75 + 0.25 * sin(uTime * 2.2 + vWorld.x * 0.8 + vWorld.z * 0.6);
    col += em;
    gl_FragColor = vec4(applyFog(col, length(vView)), 1.0);
}
`;

export function worldMaterial(tex, opts = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            ...G,
            uMap: { value: tex.map },
            uEmit: { value: tex.emit },
            uLiquid: { value: opts.liquid ? 1 : 0 },
            uEmitBoost: { value: opts.emitBoost ?? (opts.liquid ? 1.6 : 1.4) },
            uBump: { value: opts.bump ?? 0.035 },
            uSpec: { value: opts.spec ?? 0.5 },
            uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) },
        },
        vertexShader: WORLD_VS,
        fragmentShader: WORLD_FS,
        side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
}

// ------------------------------------------------------------------ actor

const ACTOR_VS = /* glsl */`
attribute vec3 color;
attribute float aGlow;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vGlow;
varying vec3 vObj;
varying vec3 vView;
void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vColor = color;
    vGlow = aGlow;
    vObj = position;
    vec4 mv = viewMatrix * wp;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}
`;

const ACTOR_FS = /* glsl */`
uniform vec3 uTint;
uniform vec3 uGlowColor;
uniform float uHit;
uniform float uDissolve;
uniform float uRim;
uniform float uNoise;
uniform float uSeed;
uniform float uCloak;
uniform float uLit;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vGlow;
varying vec3 vObj;
varying vec3 vView;
${NOISE_GLSL}
${LIGHT_GLSL}
void main(){
    float n = fbm3(vObj * uNoise + uSeed);
    float edge = 0.0;
    if (uDissolve > 0.0) {
        float d = fbm3(vObj * 3.1 + uSeed * 1.7);
        if (d < uDissolve * 1.1 - 0.05) discard;
        edge = smoothstep(0.08, 0.0, d - (uDissolve * 1.1 - 0.05));
    }
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorld);
    vec3 base = vColor * uTint * (0.72 + 0.56 * n);
    vec3 flick;
    vec4 lm = sampleLM(vWorld, vec3(0.0), flick);
    vec3 light = uAmb * 1.3 + (lm.rgb + flick) * (0.45 + 0.4 * clamp(N.y * 0.5 + 0.6, 0.0, 1.0));
    light = mix(vec3(1.0), light, uLit);
    float spec = 0.0;
    vec3 dyn = dynLights(vWorld, N, V, spec);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 col = base * (light + dyn) + spec * 0.35 * (0.3 + n);
    col += rim * uRim * (uGlowColor * 0.6 + light * 0.4);
    col += vColor * vGlow * 2.4;
    col += uHit * vec3(1.0, 0.85, 0.7);
    col += edge * uGlowColor * 4.0;
    col = applyFog(col, length(vView));
    float a = 1.0;
    if (uCloak > 0.0) {
        a = mix(1.0, 0.12 + rim * 0.8, uCloak);
        col = mix(col, uGlowColor * rim * 2.0 + col * 0.2, uCloak);
    }
    gl_FragColor = vec4(col, a);
}
`;

export function actorMaterial(opts = {}) {
    const m = new THREE.ShaderMaterial({
        uniforms: {
            ...G,
            uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) },
            uGlowColor: { value: new THREE.Color(opts.glow ?? 0xff6622) },
            uHit: { value: 0 },
            uDissolve: { value: 0 },
            uRim: { value: opts.rim ?? 0.35 },
            uNoise: { value: opts.noise ?? 4.0 },
            uSeed: { value: opts.seed ?? 0 },
            uCloak: { value: 0 },
            uLit: { value: opts.unlit ? 0 : 1 },
        },
        vertexShader: ACTOR_VS,
        fragmentShader: ACTOR_FS,
        transparent: !!opts.transparent,
        side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    return m;
}

// ------------------------------------------------------------------ glow (additive billboards)

const GLOW_VS = /* glsl */`
uniform float uSize;
varying vec2 vUv;
void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mv.xy += position.xy * scale * uSize;
    gl_Position = projectionMatrix * mv;
}
`;
const GLOW_FS = /* glsl */`
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uIntensity;
uniform float uFogD;
uniform float uSharp;
varying vec2 vUv;
void main(){
    float d = length(vUv - 0.5) * 2.0;
    float g = pow(clamp(1.0 - d, 0.0, 1.0), uSharp);
    float core = smoothstep(0.35, 0.0, d);
    vec3 col = uColor * g + uCore * core;
    gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;
export function glowMaterial(color, core = 0xffffff, intensity = 1, sharp = 2.2) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(color) },
            uCore: { value: new THREE.Color(core) },
            uIntensity: { value: intensity },
            uSize: { value: 1 },
            uFogD: G.uFogD,
            uSharp: { value: sharp },
        },
        vertexShader: GLOW_VS,
        fragmentShader: GLOW_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
}
export const GLOW_GEO = new THREE.PlaneGeometry(1, 1);
GLOW_GEO.userData.shared = true;

/** Tag a geometry as shared so disposeObject() leaves it alone. */
export function shared(geo) { geo.userData.shared = true; return geo; }

export function disposeObject(obj) {
    obj.traverse?.((o) => {
        if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m && !m.userData?.shared) m.dispose();
    });
}
