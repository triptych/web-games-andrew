// Shared materials. Every metal is a MeshStandardMaterial with a shader patch (onBeforeCompile)
// that adds brushed streaks, rivet-line grime and patches of rust or verdigris from 3D noise in
// object space — so a brass boiler looks worked and weathered without a single texture file.

import * as THREE from 'three';

export const FINISH = {
    brass:     { c: '#c9a24a', m: 0.92, r: 0.34, rust: 0.18, pat: '#4a8a5a' },
    copper:    { c: '#c47a45', m: 0.92, r: 0.36, rust: 0.25, pat: '#3a9a7a' },
    bronze:    { c: '#9a6a3a', m: 0.88, r: 0.42, rust: 0.2, pat: '#4a7a5a' },
    iron:      { c: '#5e6066', m: 0.82, r: 0.58, rust: 0.35, pat: '#8a4a22' },
    steel:     { c: '#9aa2ac', m: 0.92, r: 0.3, rust: 0.15, pat: '#8a4a22' },
    chrome:    { c: '#dfe4ea', m: 1.0, r: 0.12, rust: 0.05, pat: '#8a4a22' },
    gunmetal:  { c: '#3e434c', m: 0.86, r: 0.42, rust: 0.18, pat: '#7a4a22' },
    verdigris: { c: '#4fa58a', m: 0.45, r: 0.62, rust: 0.4, pat: '#c47a45' },
    rust:      { c: '#8a4a2a', m: 0.45, r: 0.82, rust: 0.55, pat: '#5a2a14' },
    gold:      { c: '#e8c050', m: 1.0, r: 0.2, rust: 0.04, pat: '#c8902a' },
    red:       { c: '#b0322a', m: 0.25, r: 0.4, rust: 0.22, pat: '#6a2a14', enamel: true },
    teal:      { c: '#2e8a8a', m: 0.25, r: 0.4, rust: 0.22, pat: '#6a3a14', enamel: true },
    cream:     { c: '#e8dcc0', m: 0.15, r: 0.45, rust: 0.25, pat: '#8a5a2a', enamel: true },
    black:     { c: '#202228', m: 0.5, r: 0.45, rust: 0.2, pat: '#6a3a14', enamel: true },
    blue:      { c: '#2e4a8a', m: 0.3, r: 0.4, rust: 0.2, pat: '#6a3a14', enamel: true },
    green:     { c: '#3a6a3a', m: 0.3, r: 0.45, rust: 0.25, pat: '#6a3a14', enamel: true },
    violet:    { c: '#5a3a7a', m: 0.35, r: 0.4, rust: 0.15, pat: '#3a2a4a', enamel: true },
    white:     { c: '#e8ecf0', m: 0.2, r: 0.35, rust: 0.15, pat: '#8a7a6a', enamel: true },
    orange:    { c: '#d8702a', m: 0.25, r: 0.42, rust: 0.2, pat: '#6a3a14', enamel: true },
    yellow:    { c: '#e8c02a', m: 0.25, r: 0.42, rust: 0.22, pat: '#6a4a14', enamel: true },
    pink:      { c: '#d87aa8', m: 0.25, r: 0.4, rust: 0.15, pat: '#6a3a3a', enamel: true },
};

// GLSL: hash-based 3D value noise and fbm. Prepended to patched shaders.
export const NOISE_GLSL = /* glsl */`
float swHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float swNoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(swHash(i + vec3(0,0,0)), swHash(i + vec3(1,0,0)), f.x), mix(swHash(i + vec3(0,1,0)), swHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(swHash(i + vec3(0,0,1)), swHash(i + vec3(1,0,1)), f.x), mix(swHash(i + vec3(0,1,1)), swHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float swFbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * swNoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

/** Patch a standard material with weathering. opts: { rust, patina (THREE.Color), scale, seed } */
export function weather(mat, { rust = 0.2, patina = new THREE.Color('#8a4a22'), scale = 3.5, seed = 0, streak = 1 } = {}) {
    mat.userData.weather = { rust, patina, scale, seed };
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uRust = { value: rust };
        sh.uniforms.uPatina = { value: patina };
        sh.uniforms.uWScale = { value: scale };
        sh.uniforms.uSeed = { value: seed };
        sh.uniforms.uStreak = { value: streak };
        sh.vertexShader = 'varying vec3 vSwPos;\nvarying vec3 vSwN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSwPos = position; vSwN = normal;');
        sh.fragmentShader = 'uniform float uRust, uWScale, uSeed, uStreak;\nuniform vec3 uPatina;\nvarying vec3 vSwPos;\nvarying vec3 vSwN;\n' + NOISE_GLSL + sh.fragmentShader
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 swp = vSwPos * uWScale + uSeed;
                float swn = swFbm(swp);
                float brushed = swNoise(vec3(swp.x * 0.6, swp.y * 22.0, swp.z * 0.6));
                float grime = smoothstep(0.35, 0.95, swFbm(swp * 2.3 + 7.0)) * (0.5 + 0.5 * (1.0 - abs(vSwN.y)));
                float rustM = smoothstep(1.0 - uRust, 1.0 - uRust + 0.18, swn + 0.15 * swNoise(swp * 9.0));
                diffuseColor.rgb *= 0.92 + 0.16 * brushed * uStreak;
                diffuseColor.rgb *= 1.0 - 0.28 * grime;
                diffuseColor.rgb = mix(diffuseColor.rgb, uPatina * (0.7 + 0.5 * swNoise(swp * 6.0)), rustM);`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = clamp(roughnessFactor + rustM * 0.55 + grime * 0.2 - brushed * 0.08, 0.04, 1.0);`)
            .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
                metalnessFactor *= 1.0 - rustM * 0.85;`);
    };
    mat.customProgramCacheKey = () => 'sw-weather';
    return mat;
}

const cache = new Map();
/** A weathered metal (or enamel) material for a finish name. */
export function metal(name, { gilded = false, rustScale = 1 } = {}) {
    const key = `${name}|${gilded}|${rustScale}`;
    if (cache.has(key)) return cache.get(key);
    const F = gilded ? FINISH.gold : (FINISH[name] || FINISH.iron);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(F.c), metalness: F.m, roughness: F.r });
    weather(m, { rust: F.rust * rustScale, patina: new THREE.Color(F.pat), scale: 3.2, seed: name.length * 3.7, streak: F.enamel ? 0.3 : 1 });
    if (gilded) { m.emissive = new THREE.Color('#5a3a08'); m.emissiveIntensity = 0.35; }
    cache.set(key, m);
    return m;
}

/** Glowing parts: eyes, cores, coils. */
const glowCache = new Map();
export function glow(color, intensity = 2.2) {
    const key = `${color}|${intensity}`;
    if (glowCache.has(key)) return glowCache.get(key);
    const m = new THREE.MeshStandardMaterial({ color: '#111111', emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.4, metalness: 0 });
    glowCache.set(key, m);
    return m;
}

export const MAT = {
    rubber: new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.9, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cfe8f0', roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false }),
    dark: weather(new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6, metalness: 0.7 }), { rust: 0.2, patina: new THREE.Color('#5a3014') }),
    moss: new THREE.MeshStandardMaterial({ color: '#4a8a3a', roughness: 1, metalness: 0 }),
    moss2: new THREE.MeshStandardMaterial({ color: '#6aa84a', roughness: 1, metalness: 0 }),
    ice: new THREE.MeshPhysicalMaterial({ color: '#bfe8ff', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.8, clearcoat: 1, emissive: new THREE.Color('#1a3a5a'), emissiveIntensity: 0.4 }),
    rustFlake: new THREE.MeshStandardMaterial({ color: '#9a4a1a', roughness: 1, metalness: 0.1 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#d8c8a8', roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
};

// ------------------------------------------------------------------ procedural canvas textures
function canvasTex(w, h, draw, repeat = true) {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
}
let rngS = 12345;
const r01 = () => { rngS = (rngS * 16807) % 2147483647; return rngS / 2147483647; };

const texCache = {};
export function tex(kind) {
    if (texCache[kind]) return texCache[kind];
    let t = null;
    switch (kind) {
        case 'brick': t = canvasTex(256, 256, (g, w, h) => {
            g.fillStyle = '#3a2420'; g.fillRect(0, 0, w, h);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
                const ox = (y % 2) * 16;
                const v = 0.75 + r01() * 0.4;
                g.fillStyle = `rgb(${(150 * v) | 0},${(70 * v) | 0},${(50 * v) | 0})`;
                g.fillRect(x * 32 + ox + 1, y * 16 + 1, 30, 14);
                if (r01() < 0.2) { g.fillStyle = 'rgba(20,10,5,0.35)'; g.fillRect(x * 32 + ox + 1, y * 16 + 10, 30, 5); }
            }
        }); break;
        case 'planks': t = canvasTex(256, 256, (g, w, h) => {
            for (let x = 0; x < 8; x++) {
                const v = 0.7 + r01() * 0.4;
                g.fillStyle = `rgb(${(120 * v) | 0},${(82 * v) | 0},${(52 * v) | 0})`;
                g.fillRect(x * 32, 0, 32, h);
                g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x * 32, 0, 2, h);
                for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(40,20,10,${r01() * 0.25})`; g.fillRect(x * 32 + r01() * 30, r01() * h, 1, 10 + r01() * 40); }
                g.fillStyle = '#2a2a2a'; g.fillRect(x * 32 + 6, 20, 3, 3); g.fillRect(x * 32 + 22, 20, 3, 3); g.fillRect(x * 32 + 6, 220, 3, 3); g.fillRect(x * 32 + 22, 220, 3, 3);
            }
        }); break;
        case 'corrugated': t = canvasTex(128, 128, (g, w, h) => {
            for (let x = 0; x < w; x++) { const v = 0.55 + 0.35 * Math.sin((x / w) * Math.PI * 16); g.fillStyle = `rgb(${(150 * v) | 0},${(130 * v) | 0},${(110 * v) | 0})`; g.fillRect(x, 0, 1, h); }
            for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(130,60,20,${r01() * 0.4})`; g.beginPath(); g.arc(r01() * w, r01() * h, 2 + r01() * 10, 0, 7); g.fill(); }
        }); break;
        case 'plate': t = canvasTex(256, 256, (g, w, h) => {
            g.fillStyle = '#6a6e74'; g.fillRect(0, 0, w, h);
            for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
                const v = 0.8 + r01() * 0.3;
                g.fillStyle = `rgb(${(110 * v) | 0},${(114 * v) | 0},${(120 * v) | 0})`;
                g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
                g.fillStyle = 'rgba(0,0,0,0.6)';
                for (const [a, b] of [[6, 6], [56, 6], [6, 56], [56, 56]]) { g.beginPath(); g.arc(x * 64 + a, y * 64 + b, 2.5, 0, 7); g.fill(); }
                // lozenge tread
                g.fillStyle = 'rgba(255,255,255,0.06)';
                for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) g.fillRect(x * 64 + 6 + i * 9 + (j % 2) * 4, y * 64 + 8 + j * 9, 5, 2);
            }
        }); break;
        case 'cobble': t = canvasTex(256, 256, (g, w, h) => {
            g.fillStyle = '#4a4038'; g.fillRect(0, 0, w, h);
            for (let i = 0; i < 90; i++) {
                const x = r01() * w, y = r01() * h, r = 9 + r01() * 9, v = 0.6 + r01() * 0.5;
                g.fillStyle = `rgb(${(120 * v) | 0},${(108 * v) | 0},${(92 * v) | 0})`;
                g.beginPath(); g.ellipse(x, y, r, r * 0.8, r01() * 3, 0, 7); g.fill();
                g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
            }
        }); break;
        case 'screen': t = canvasTex(64, 64, (g, w, h) => {
            g.fillStyle = '#0a2a1a'; g.fillRect(0, 0, w, h);
            for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(120,255,160,0.18)'; g.fillRect(0, y, w, 1); }
            g.fillStyle = '#8affa8'; g.fillRect(16, 22, 8, 8); g.fillRect(40, 22, 8, 8); g.fillRect(18, 42, 28, 4);
        }, false); break;
    }
    texCache[kind] = t;
    return t;
}
