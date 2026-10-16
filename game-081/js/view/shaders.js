// Custom materials: the Lumen X-ray, ghosts, slime jelly, shell fur, water, lava, the night sky,
// fake volumetric light shafts and the hologram backdrop of the scan. Every pow() base is clamped
// to [0, 1]: with bloom, one NaN pixel smears into a blinking box (game-065).

import * as THREE from 'three';

const NOISE = /* glsl */`
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 4; i++) { a += vnoise(p) * w; p *= 2.03; w *= 0.5; } return a; }
`;

export const timeUniform = { value: 0 };

/** The Lumen Lens X-ray: fresnel rim, scan lines, a sweeping band and glowing "organs". */
export function xrayMaterial(color = 0x58c8ff) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) }, uBand: { value: 0 }, uHurt: { value: new THREE.Color(0xff4d6a) }, uHeal: { value: 0 } },
        vertexShader: /* glsl */`
varying vec3 vN, vV, vW;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
}`,
        fragmentShader: /* glsl */`
uniform float uTime, uHeal;
uniform vec3 uColor, uHurt;
varying vec3 vN, vV, vW;
${NOISE}
void main() {
    float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float rim = pow(f, 2.2);
    float lines = 0.55 + 0.45 * sin(vW.y * 60.0 - uTime * 4.0);
    float band = smoothstep(0.35, 0.0, abs(fract(vW.y * 0.18 - uTime * 0.25) - 0.5) - 0.38);
    float organs = smoothstep(0.55, 0.8, fbm3(vW * 1.6 + vec3(0.0, uTime * 0.15, 0.0)));
    vec3 col = uColor * (rim * 0.85 + 0.05 * lines) + uColor * band * 0.22;
    col += mix(uHurt, uColor * 1.4, uHeal) * organs * (0.16 + 0.1 * sin(uTime * 3.0));
    float a = clamp(rim * 0.6 + 0.05 + band * 0.08 + organs * 0.18, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

/** A ghost: fresnel glow, drifting wisps cut out of the body, a gentle wobble. */
export function ghostMaterial(color = 0xbfe6ff, strength = 1) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
        vertexShader: /* glsl */`
uniform float uTime;
varying vec3 vN, vV, vP;
void main() {
    vec3 p = position;
    p.x += sin(p.y * 3.0 + uTime * 2.0) * 0.03 * (1.0 - clamp(p.y, 0.0, 1.0));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vP = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
}`,
        fragmentShader: /* glsl */`
uniform float uTime, uStrength;
uniform vec3 uColor;
varying vec3 vN, vV, vP;
${NOISE}
void main() {
    float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float wisp = fbm3(vP * 3.0 + vec3(0.0, -uTime * 0.6, 0.0));
    float a = clamp(0.18 + pow(f, 1.6) * 0.9, 0.0, 1.0) * smoothstep(0.25, 0.6, wisp + 0.25) * uStrength;
    vec3 col = uColor * (0.6 + pow(f, 2.0) * 1.4);
    gl_FragColor = vec4(col, a);
}`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
}

/** Slime jelly: physical clearcoat with a sheen; real transmission on high quality. */
export function slimeMaterial(color = 0x6ee07a, quality = 1) {
    const m = new THREE.MeshPhysicalMaterial({
        color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
        sheen: 0.6, sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.2), iridescence: 0.25,
        transparent: true, opacity: 0.82, envMapIntensity: 1.2,
    });
    if (quality >= 2) { m.transmission = 0.6; m.thickness = 0.8; m.opacity = 1; m.ior = 1.33; m.attenuationColor = new THREE.Color(color); m.attenuationDistance = 0.6; }
    return m;
}

/**
 * Shell fur: N copies of a mesh pushed out along the normals, each discarding texels where a
 * strand noise is shorter than its layer. Returns a Group to add beside the base mesh.
 */
export function furShells(geometry, color, { layers = 10, length = 0.07, density = 90, quality = 1 } = {}) {
    const g = new THREE.Group();
    const n = quality >= 2 ? layers : Math.max(4, Math.round(layers * 0.6));
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55 + 0.45 * t), roughness: 1, transparent: false });
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uT = { value: t };
            sh.uniforms.uLen = { value: length };
            sh.uniforms.uDen = { value: density };
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nuniform float uT, uLen; varying vec3 vFurP;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurP = position; transformed += normal * uLen * uT; transformed.y -= uLen * uT * uT * 0.4;');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', `#include <common>\nuniform float uT, uDen; varying vec3 vFurP;\nfloat fh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
                .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (fh(floor(vFurP * uDen)) < uT * 0.95) discard;');
        };
        m.customProgramCacheKey = () => `fur${i}`;
        const s = new THREE.Mesh(geometry, m);
        g.add(s);
    }
    return g;
}

/** Still dark water with ripples and a fresnel sheen. */
export function waterMaterial(color = 0x0b2a33, glowColor = 0x3fd0c0) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) }, uGlow: { value: new THREE.Color(glowColor) } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: /* glsl */`
uniform float uTime; uniform vec3 uColor, uGlow; varying vec3 vW;
${NOISE}
void main() {
    vec3 v = normalize(cameraPosition - vW);
    float n = fbm3(vec3(vW.xz * 0.7, uTime * 0.25));
    float n2 = fbm3(vec3(vW.xz * 2.3 + 4.0, uTime * 0.4));
    float fres = pow(clamp(1.0 - v.y, 0.0, 1.0), 3.0);
    float caust = smoothstep(0.55, 0.7, n2) * 0.5;
    vec3 col = uColor * (0.7 + n * 0.6) + uGlow * (caust * 0.4 + fres * 0.35);
    gl_FragColor = vec4(col, 0.92);
}`,
        transparent: true,
    });
}

/** Flowing lava: dark crust over hot cracks, very bright where it's hot (bloom picks it up). */
export function lavaMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform },
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: /* glsl */`
uniform float uTime; varying vec3 vW;
${NOISE}
void main() {
    vec2 p = vW.xz * 0.45;
    float flow = fbm3(vec3(p + vec2(uTime * 0.05, uTime * 0.02), uTime * 0.08));
    float crust = smoothstep(0.42, 0.62, fbm3(vec3(p * 2.2 - vec2(uTime * 0.03, 0.0), 3.0)));
    vec3 hot = mix(vec3(1.6, 0.35, 0.03), vec3(2.6, 1.3, 0.25), clamp(flow * 1.4 - 0.2, 0.0, 1.0));
    vec3 col = mix(hot, vec3(0.06, 0.03, 0.02), crust * 0.85);
    gl_FragColor = vec4(col, 1.0);
}`,
    });
}

/** The night sky on a big sphere: gradient, stars, a moon and drifting cloud. */
export function skyMaterial(top = 0x0a1030, bottom = 0x2a3550, moonDir = new THREE.Vector3(0.4, 0.5, -0.75)) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uMoon: { value: moonDir.clone().normalize() } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
        fragmentShader: /* glsl */`
uniform float uTime; uniform vec3 uTop, uBottom, uMoon; varying vec3 vD;
${NOISE}
void main() {
    vec3 d = normalize(vD);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(h, 0.7));
    float st = step(0.9985, hash31(floor(d * 420.0))) * smoothstep(0.0, 0.3, d.y);
    col += vec3(st) * (0.6 + 0.4 * sin(uTime * 2.0 + hash31(floor(d * 420.0)) * 30.0));
    float md = dot(d, uMoon);
    col += vec3(1.0, 0.95, 0.8) * (smoothstep(0.9985, 0.9992, md) * 2.0 + pow(clamp(md, 0.0, 1.0), 200.0) * 0.6);
    float cl = fbm3(vec3(d.xz / max(0.15, d.y) * 0.6 + vec2(uTime * 0.01, 0.0), 1.0));
    col = mix(col, uBottom * 1.4, smoothstep(0.5, 0.8, cl) * 0.5 * smoothstep(0.0, 0.25, d.y));
    gl_FragColor = vec4(col, 1.0);
}`,
        side: THREE.BackSide, depthWrite: false,
    });
}

/**
 * A flame sheet: scrolling noise shaped by a teardrop, white-hot at the base and fading through
 * orange to red at the tips. Additive, so crossed sheets read as a solid fire from any angle.
 * uSeed offsets the noise so two sheets don't flicker in step.
 */
export function fireMaterial(seed = 0, strength = 1) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uSeed: { value: seed }, uStrength: { value: strength } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
uniform float uTime, uSeed, uStrength; varying vec2 vUv;
${NOISE}
void main() {
    vec2 p = vUv;
    float t = uTime * 1.6 + uSeed * 7.0;
    // rising, licking noise
    float n = fbm3(vec3(p.x * 3.2 + uSeed, p.y * 2.4 - t, t * 0.35));
    float n2 = vnoise(vec3(p.x * 7.0, p.y * 5.0 - t * 1.7, uSeed));
    // a teardrop that narrows toward the top, pushed sideways by the noise
    float x = (p.x - 0.5) * 2.0 + (n - 0.5) * 0.55 * p.y;
    float width = mix(0.95, 0.08, pow(clamp(p.y, 0.0, 1.0), 0.8));
    float body = clamp(1.0 - abs(x) / max(width, 0.001), 0.0, 1.0);
    float heat = body * (1.0 - p.y) * 1.6 + (n * 0.8 + n2 * 0.4 - 0.55) * (1.0 - p.y * 0.6);
    heat *= smoothstep(0.0, 0.08, p.y);
    heat = clamp(heat, 0.0, 1.0);
    vec3 col = mix(vec3(0.5, 0.05, 0.0), vec3(1.6, 0.5, 0.06), smoothstep(0.1, 0.5, heat));
    col = mix(col, vec3(2.4, 1.7, 0.7), smoothstep(0.55, 0.95, heat));
    float a = smoothstep(0.08, 0.35, heat);
    gl_FragColor = vec4(col * a * uStrength, 1.0);
}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

/** A fake volumetric light shaft: an additive cone that fades along its length and at its edges. */
export function shaftMaterial(color = 0xfff0c0, strength = 0.25) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: /* glsl */`
uniform float uTime, uStrength; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN, vV;
${NOISE}
void main() {
    float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5);
    float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - vUv.y * 0.6);
    float dust = 0.75 + 0.25 * vnoise(vec3(vUv * vec2(6.0, 3.0), uTime * 0.3));
    gl_FragColor = vec4(uColor * edge * along * dust * uStrength, 1.0);
}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

/** The scan's backdrop: a deep blue lab with a hex grid, rings and a slow sweep. */
export function holoBackdrop(color = 0x2a7cff) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) }, uMood: { value: new THREE.Color(0x0a1830) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
uniform float uTime; uniform vec3 uColor, uMood; varying vec2 vUv;
${NOISE}
float hexd(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    vec2 p = uv * vec2(14.0, 9.0);
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    float hex = smoothstep(0.46, 0.5, hexd(g));
    float d = length(uv * vec2(1.6, 1.0));
    float rings = smoothstep(0.02, 0.0, abs(fract(d * 3.0 - uTime * 0.12) - 0.5) - 0.48);
    float sweep = smoothstep(0.15, 0.0, abs(fract(atan(uv.y, uv.x) / 6.2831 - uTime * 0.05) - 0.5) - 0.45) * (1.0 - d * 0.6);
    vec3 col = uMood * (1.1 - d * 0.6) + uColor * (hex * 0.06 + rings * 0.05 + sweep * 0.08);
    col += uColor * 0.04 * fbm3(vec3(uv * 3.0, uTime * 0.1));
    gl_FragColor = vec4(col, 1.0);
}`,
        depthWrite: false,
    });
}

/** Soft additive glow sprite material. */
export function glowMaterial(tex, color, opacity = 1) {
    return new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}
