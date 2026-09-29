/**
 * backdrop.js — the synthwave world around the table: a gradient sky dome with
 * twinkling stars, a striped retro sun, wireframe mountains, and an endless
 * neon grid floor scrolling toward the camera. Everything pulses on the beat.
 *
 * All shaders here read `uTime` / `uBeat`; updateBackdrop() must run every
 * frame in every mode (title, play, pause, game over) so menus look alive.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { COLORS } from '../config.js';

const FLOOR_Y = -14;
const SUN_Z = -1100;
const SUN_SIZE = 620;

let sky, sun, grid, stars, mountains = [];
const uniforms = {
    uTime:  { value: 0 },
    uBeat:  { value: 0 },     // 1 on the beat, decays to 0
    uHype:  { value: 0 },     // 0..1 — combo / multiball intensity
};

export function initBackdrop() {
    // --- Sky dome ---
    sky = new THREE.Mesh(
        new THREE.SphereGeometry(2200, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                ...uniforms,
                uTop:     { value: new THREE.Color(0x05010f) },
                uMid:     { value: new THREE.Color(0x2a0650) },
                uHorizon: { value: new THREE.Color(0xff3d8b) },
                uLow:     { value: new THREE.Color(0x12002e) },
            },
            vertexShader: /* glsl */`
                varying vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3 uTop, uMid, uHorizon, uLow;
                uniform float uBeat, uHype;
                varying vec3 vDir;
                void main() {
                    float y = vDir.y;
                    vec3 col = mix(uMid, uTop, smoothstep(0.05, 0.55, y));
                    float glow = exp(-abs(y) * 14.0) * (1.1 + 0.25 * uBeat + 0.5 * uHype);
                    col = mix(col, uHorizon, clamp(glow, 0.0, 1.0));
                    if (y < 0.0) col = mix(col, uLow, smoothstep(0.0, -0.1, y));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        }),
    );
    sky.renderOrder = -10;
    scene.add(sky);

    // --- Stars (upper sky only) ---
    const N = 900;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = 0.03 + Math.pow(Math.random(), 0.8) * 0.9;     // elevation 0..1
        const r = 2000;
        const cosV = Math.cos(v * Math.PI / 2);
        pos[i * 3]     = Math.cos(u) * cosV * r;
        pos[i * 3 + 1] = Math.sin(v * Math.PI / 2) * r;
        pos[i * 3 + 2] = Math.sin(u) * cosV * r;
        seed[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    stars = new THREE.Points(sg, new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms,
        vertexShader: /* glsl */`
            attribute float seed;
            uniform float uTime;
            varying float vA;
            void main() {
                vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + seed * 3.0) + seed * 40.0));
                gl_PointSize = 1.5 + seed * 2.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            varying float vA;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                gl_FragColor = vec4(vec3(0.9, 0.85, 1.0) * vA, 1.0) * smoothstep(0.5, 0.0, d);
            }
        `,
    }));
    stars.renderOrder = -9;
    scene.add(stars);

    // --- Retro sun ---
    sun = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: { ...uniforms },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */`
                uniform float uTime, uBeat, uHype;
                varying vec2 vUv;
                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    float r = length(p);
                    // Body: gold at the top, hot pink at the bottom.
                    vec3 top = vec3(1.0, 0.86, 0.25);
                    vec3 bot = vec3(1.0, 0.12, 0.55);
                    vec3 col = mix(bot, top, smoothstep(-0.7, 0.8, p.y)) * (1.05 + 0.25 * uBeat + 0.3 * uHype);
                    float body = smoothstep(0.72, 0.70, r);
                    // Scrolling horizontal gaps across the lower half, widening downward.
                    float y = p.y + fract(uTime * 0.06) * 0.2;
                    float band = fract(y * 5.0);
                    float gapW = clamp((0.15 - p.y) * 0.55, 0.0, 0.5);
                    float gaps = step(gapW, band);
                    body *= mix(gaps, 1.0, step(0.15, p.y));
                    // Soft outer glow.
                    float halo = exp(-max(r - 0.7, 0.0) * 9.0) * 0.28 * (1.0 - body);
                    vec3 c = col * body + vec3(1.0, 0.2, 0.6) * halo;
                    gl_FragColor = vec4(c, max(body, halo));
                }
            `,
        }),
    );
    sun.scale.set(SUN_SIZE, SUN_SIZE, 1);
    sun.position.set(0, FLOOR_Y + 60, SUN_Z);
    sun.renderOrder = -8;
    scene.add(sun);

    // --- Wireframe mountains, left and right of the sun ---
    for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(900, 240, 36, 8);
        geo.rotateX(-Math.PI / 2);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const u = (x + 450) / 900;                      // 0 = inner edge, 1 = outer
            const edge = side < 0 ? 1 - u : u;
            const ridge = Math.abs(Math.sin(x * 0.021 + side) * 70 + Math.sin(x * 0.057) * 30 + Math.sin(x * 0.13 + z * 0.05) * 14);
            const falloff = Math.sin(((z + 120) / 240) * Math.PI);  // 0 at front/back rows
            p.setY(i, ridge * falloff * (0.25 + edge * 0.9));
        }
        geo.computeVertexNormals();
        const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0220 }));
        const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: new THREE.Color(side < 0 ? COLORS.cyan : COLORS.purple).multiplyScalar(1.3),
            wireframe: true,
            transparent: true,
            opacity: 0.55,
        }));
        const g = new THREE.Group();
        g.add(fill, wire);
        g.position.set(side * 560, FLOOR_Y, SUN_Z + 260);
        scene.add(g);
        mountains.push(g);
    }

    // --- Neon grid floor ---
    const gmat = new THREE.ShaderMaterial({
        transparent: false,
        uniforms: {
            ...uniforms,
            uLine:    { value: new THREE.Color(COLORS.grid) },
            uHorizon: { value: new THREE.Color(0xff3d8b) },
            uFloor:   { value: new THREE.Color(0x0a0120) },
        },
        vertexShader: /* glsl */`
            varying vec3 vW;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime, uBeat, uHype;
            uniform vec3 uLine, uHorizon, uFloor;
            varying vec3 vW;
            void main() {
                vec2 p = vW.xz / 7.0;
                p.y += uTime * (2.2 + uHype * 3.0);          // scroll toward the camera
                vec2 fw = fwidth(p);
                vec2 g = abs(fract(p - 0.5) - 0.5) / max(fw, 1e-4);
                float line = 1.0 - min(min(g.x, g.y) * 0.7, 1.0);
                float lod = clamp(1.0 - max(fw.x, fw.y) * 1.2, 0.0, 1.0);   // fade before aliasing
                float dist = -vW.z;
                float farT = smoothstep(80.0, 1100.0, dist);
                vec3 col = uFloor + uHorizon * farT * 0.45;
                float bright = 1.6 + uBeat * 1.4 + uHype * 1.2;
                col += uLine * line * lod * bright * (1.0 - farT * 0.6);
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    });
    grid = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2400), gmat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, FLOOR_Y, SUN_Z + 1200 - 100);
    scene.add(grid);
}

export function updateBackdrop(dt, time, beat, hype) {
    uniforms.uTime.value = time;
    uniforms.uBeat.value = beat;
    uniforms.uHype.value += (hype - uniforms.uHype.value) * Math.min(1, dt * 2);
    // Shader materials that spread `uniforms` share the same objects, but the
    // sky/sun/grid made copies with extra keys: sync them.
    for (const m of [sky.material, sun.material, grid.material]) {
        m.uniforms.uTime.value = time;
        m.uniforms.uBeat.value = beat;
        m.uniforms.uHype.value = uniforms.uHype.value;
    }
    sun.scale.setScalar(SUN_SIZE * (1 + beat * 0.012));
}
