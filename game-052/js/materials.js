// Shared materials and the custom shaders: wet road, glow points, sky,
// skyline band, light beams and rain.
//
// Colour management is off for the whole game: every colour is a display
// value, written straight to the low-res target and then to the screen.

import * as THREE from 'three';
import { FOG_DENSITY } from './config.js';

// Uniforms shared by every custom shader, updated once per frame.
export const U = {
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0.2, 0.1, 0.24) },
    uFogDensity: { value: FOG_DENSITY },
    uPointScale: { value: 300 },
    uWet: { value: 0.8 },
    uLamp: { value: new THREE.Color(1, 0.6, 0.8) },
    uCarPos: { value: new THREE.Vector3() },
    uCarDir: { value: new THREE.Vector2(0, 1) },
    uHead: { value: 1 },
    uRefl: { value: null },
    uReflOn: { value: 1 },
    uTexMatrix: { value: new THREE.Matrix4() },
    uFlash: { value: 0 },
    uSky: { value: new THREE.Color(0.05, 0.02, 0.09) },
};

const FOG_GLSL = /* glsl */`
float fogAmount(float d) { return 1.0 - exp(-uFogDensity * uFogDensity * d * d); }
`;

const NOISE_GLSL = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

export function makeMaterials(tex) {
    const M = {};
    M.glowTex = tex.glow;

    M.building = new THREE.MeshBasicMaterial({ map: tex.windows, vertexColors: true });
    M.flat = new THREE.MeshBasicMaterial({ vertexColors: true });
    M.sign = new THREE.MeshBasicMaterial({
        map: tex.signs.texture, vertexColors: true, transparent: true, depthWrite: false,
    });
    M.signFlicker = M.sign.clone();
    M.billboards = tex.billboards.items.map((it) => new THREE.MeshBasicMaterial({ map: it.texture, vertexColors: true }));
    M.lines = new THREE.LineBasicMaterial({ vertexColors: true });
    M.ground = new THREE.MeshBasicMaterial({ color: 0x06050a });

    // ---------------- glow points ----------------
    M.points = new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uFogDensity: U.uFogDensity, uPointScale: U.uPointScale, uTex: { value: tex.glow } },
        vertexShader: /* glsl */`
            attribute float size;
            attribute vec3 blink;
            attribute vec3 color;
            uniform float uTime, uFogDensity, uPointScale;
            varying vec3 vColor;
            varying float vFade;
            #include <clipping_planes_pars_vertex>
            ${FOG_GLSL}
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vec4 mvPosition = mv;
                #include <clipping_planes_vertex>
                float on = 1.0;
                if (blink.x > 0.0) on = step(fract(uTime * blink.x + blink.y), blink.z);
                else if (blink.x < 0.0) on = step(0.12, fract(sin(floor(uTime * -blink.x) * 12.9898 + blink.y * 78.233) * 43758.5453)) * 0.8 + 0.2;
                float d = max(-mv.z, 0.1);
                float px = size * uPointScale / d;
                // Keep distant lights at least a pixel or two, and fade them
                // into the haze instead of letting fog swallow them outright.
                vFade = (1.0 - fogAmount(d) * 0.82) * clamp(px / 1.6, 0.35, 1.0);
                gl_PointSize = on > 0.0 ? clamp(px, 1.6, 140.0) : 0.0;
                vColor = color * on;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform sampler2D uTex;
            varying vec3 vColor;
            varying float vFade;
            #include <clipping_planes_pars_fragment>
            void main() {
                #include <clipping_planes_fragment>
                float a = texture2D(uTex, gl_PointCoord).a;
                gl_FragColor = vec4(vColor * a * vFade, 1.0);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clipping: true,
    });

    // ---------------- wet road / sidewalk / water ----------------
    M.road = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: /* glsl */`
            attribute vec2 info;
            uniform mat4 uTexMatrix;
            varying vec2 vUv;
            varying vec2 vInfo;
            varying vec3 vWorld;
            varying vec4 vRefl;
            varying float vDepth;
            void main() {
                vUv = uv;
                vInfo = info;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vRefl = uTexMatrix * w;
                vec4 mv = viewMatrix * w;
                vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime, uWet, uFogDensity, uHead, uReflOn;
            uniform vec3 uFogColor, uLamp, uCarPos;
            uniform vec2 uCarDir;
            uniform sampler2D uRefl;
            varying vec2 vUv;
            varying vec2 vInfo;
            varying vec3 vWorld;
            varying vec4 vRefl;
            varying float vDepth;
            ${FOG_GLSL}
            ${NOISE_GLSL}
            void main() {
                float kind = vInfo.x, lampU = vInfo.y;
                float u = vUv.x, s = vUv.y;
                vec3 col = vec3(0.03, 0.029, 0.038) * (0.8 + 0.4 * hash(floor(vWorld.xz * 5.0)));
                float refl = 1.0;
                if (kind < 0.5) {
                    float au = abs(u);
                    float c1 = step(abs(au - 0.17), 0.055);
                    float dash = step(abs(au - 3.6), 0.07) * step(fract(s / 12.0), 0.42);
                    float edge = step(abs(au - 6.95), 0.08);
                    float mm = max(c1, max(dash, edge));
                    vec3 mc = c1 * vec3(0.6, 0.42, 0.1) + (dash + edge) * vec3(0.4, 0.4, 0.44);
                    col = mix(col, mc, mm * (0.7 + 0.3 * vnoise(vWorld.xz * 0.8)));
                    refl -= mm * 0.6;
                    col *= 0.8 + 0.35 * vnoise(vWorld.xz * 0.3);
                } else if (kind < 1.5) {
                    vec2 t = fract(vec2(u, s) / 1.25);
                    float line = min(step(t.x, 0.05) + step(t.y, 0.05), 1.0);
                    col = vec3(0.055, 0.05, 0.065) * (0.8 + 0.35 * hash(floor(vec2(u, s) / 1.25)));
                    col *= 1.0 - line * 0.45;
                    refl = 0.75;
                } else if (kind < 2.5) {
                    col *= 1.15;
                } else {
                    col = vec3(0.008, 0.02, 0.03);
                    refl = 1.7;
                }
                if (lampU > 0.0) {
                    float ls = floor((s - 16.0) / 32.0 + 0.5) * 32.0 + 16.0;
                    vec2 d = vec2(abs(u) - lampU, s - ls);
                    col += uLamp * exp(-dot(d, d) / 46.0) * 0.3;
                }
                vec2 toP = vWorld.xz - uCarPos.xz;
                float along = dot(toP, uCarDir);
                if (along > 1.0 && along < 65.0 && abs(vWorld.y - uCarPos.y) < 2.5) {
                    float lat = abs(toP.x * uCarDir.y - toP.y * uCarDir.x);
                    float w = 1.3 + along * 0.2;
                    float beam = exp(-lat * lat / (w * w) * 1.6) * smoothstep(1.0, 7.0, along) * (1.0 - along / 65.0);
                    col += vec3(0.6, 0.55, 0.45) * beam * uHead * (kind > 2.5 ? 0.15 : 0.9);
                }
                if (uReflOn > 0.5) {
                    vec2 rip = vec2(vnoise(vWorld.xz * 1.7 + uTime * vec2(0.3, 1.3)),
                                    vnoise(vWorld.xz * 2.1 - uTime * vec2(1.1, 0.2))) - 0.5;
                    vec4 rp = vRefl;
                    rp.xy += rip * rp.w * (kind > 2.5 ? 0.045 : 0.012) * (0.5 + uWet);
                    vec2 ruv = rp.xy / rp.w;
                    vec3 r = texture2D(uRefl, ruv).rgb * 0.36;
                    r += texture2D(uRefl, ruv + vec2(0.0, 0.011)).rgb * 0.2;
                    r += texture2D(uRefl, ruv - vec2(0.0, 0.011)).rgb * 0.2;
                    r += texture2D(uRefl, ruv + vec2(0.0, 0.025)).rgb * 0.12;
                    r += texture2D(uRefl, ruv - vec2(0.0, 0.025)).rgb * 0.12;
                    vec3 V = normalize(cameraPosition - vWorld);
                    float fres = 0.3 + 0.7 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
                    float puddle = smoothstep(0.4, 0.75, vnoise(vWorld.xz * 0.11));
                    col += r * uWet * fres * refl * (0.5 + 0.7 * puddle);
                }
                col = mix(col, uFogColor, fogAmount(vDepth));
                gl_FragColor = vec4(col, 1.0);
            }`,
    });

    // ---------------- sky dome ----------------
    M.sky = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_Position = p.xyww;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uFogColor, uSky;
            uniform float uTime, uFlash;
            varying vec3 vDir;
            ${NOISE_GLSL}
            void main() {
                float y = vDir.y;
                vec3 col = mix(uFogColor, uSky, smoothstep(-0.02, 0.5, y));
                vec2 p = vDir.xz / max(y + 0.08, 0.06) * 1.3 + vec2(uTime * 0.006, uTime * 0.002);
                float c = vnoise(p) * 0.55 + vnoise(p * 2.3) * 0.3 + vnoise(p * 5.1) * 0.15;
                float band = smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.25, 0.85, y));
                col += uFogColor * 0.75 * smoothstep(0.42, 0.8, c) * band;
                col += vec3(0.55, 0.55, 0.8) * uFlash * (0.25 + c) * smoothstep(-0.05, 0.3, y);
                gl_FragColor = vec4(col, 1.0);
            }`,
        side: THREE.BackSide, depthWrite: false, depthTest: false,
    });

    // ---------------- distant skyline band ----------------
    M.skyline = new THREE.ShaderMaterial({
        uniforms: { uFogColor: U.uFogColor, uTex: { value: tex.skyline }, uFlash: U.uFlash },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform sampler2D uTex;
            uniform vec3 uFogColor;
            uniform float uFlash;
            varying vec2 vUv;
            void main() {
                vec4 t = texture2D(uTex, vec2(vUv.x * 2.0, vUv.y));
                vec3 col = mix(t.rgb, uFogColor * 0.7, 0.45) + uFlash * 0.12;
                gl_FragColor = vec4(col, t.a);
            }`,
        transparent: true, depthWrite: false, side: THREE.BackSide,
    });

    // ---------------- light beams (headlights in rain, searchlights) ----------------
    M.beam = (color, strength = 0.35) => new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uFogDensity: U.uFogDensity },
        vertexShader: /* glsl */`
            varying float vT;
            varying float vEdge;
            varying float vDepth;
            void main() {
                vT = uv.y;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vec3 n = normalize(mat3(modelMatrix) * normal);
                vec3 v = normalize(cameraPosition - w.xyz);
                vEdge = abs(dot(n, v));
                vec4 mv = viewMatrix * w;
                vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            uniform float uStrength, uFogDensity;
            varying float vT;
            varying float vEdge;
            varying float vDepth;
            ${FOG_GLSL}
            void main() {
                float a = pow(vT, 2.2) * pow(vEdge, 1.5) * uStrength * (1.0 - fogAmount(vDepth));
                gl_FragColor = vec4(uColor * a, 1.0);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });

    return M;
}
