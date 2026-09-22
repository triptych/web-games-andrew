/**
 * backdrop.js — the six level backdrops and the parallax starfields.
 *
 * One ShaderMaterial with a mode switch rather than six materials: the shader
 * compiles once, and switching levels is a uniform write. The fragment shader
 * shares one FBM between all six looks, which is also what makes them feel like
 * the same game.
 *
 * REMEMBER: uTime must be bumped every frame or the backdrop is frozen (this
 * bit every three.js game in this repo at least once).
 */

import * as THREE from 'three';
import { ARENA, VIEW } from '../core/config.js';
import { scene } from './scene.js';

const MODES = { hangar: 0, clouds: 1, rings: 2, choir: 3, tether: 4, fall: 5 };

let group = null;
let plane = null;
let mat = null;
const starLayers = [];

// The backdrop plane is deliberately far larger than the playfield so its edges
// are never on screen at any aspect ratio (a phone in portrait pulls the camera
// a long way back). uUvScale keeps the pattern density constant as the plane
// grows — it matches the plane's scale factor, which also keeps the scroll
// speed unchanged in world units.
const VERT = `
varying vec2 vUv;
uniform float uUvScale;
void main() {
    vUv = uv * uUvScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uScroll;
uniform float uMode;
uniform float uBeat;
uniform float uFlash;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uFog;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
}
float grid(vec2 uv, float cells, float thick) {
    vec2 g = abs(fract(uv * cells) - 0.5);
    vec2 w = fwidth(uv * cells) * thick;
    vec2 l = smoothstep(w, vec2(0.0), g);
    return max(l.x, l.y);
}

void main() {
    vec2 uv = vUv;
    vec2 sv = vec2(uv.x, uv.y - uScroll);
    vec3 col = uFog;

    if (uMode < 0.5) {
        // HANGAR RING — station interior: trusses, deck plating, warning strips
        float plates = grid(sv * vec2(3.0, 2.0), 4.0, 1.2) * 0.25;
        float truss = smoothstep(0.46, 0.5, abs(fract(sv.y * 3.0) - 0.5)) * 0.35;
        float deck = fbm(sv * 6.0) * 0.14;
        col = uFog + uColorA * (plates * 0.5 + truss * 0.35) + vec3(deck * 0.4);
        // Warning strips stay dim: they are warm, and warm is the colour the
        // player must read as "incoming fire" (GDD readability rule).
        float warn = step(0.988, fract(sv.y * 3.0 + 0.2)) * step(0.45, fract(uv.x * 9.0));
        col += uColorB * warn * (0.14 + 0.12 * sin(uTime * 6.0));
        col += uColorA * 0.06 * smoothstep(0.7, 0.0, abs(uv.x - 0.5));
    } else if (uMode < 1.5) {
        // ASHGATE DESCENT — banded gas giant with lightning in the layers
        float bands = sin((sv.y * 9.0) + fbm(sv * 3.0) * 3.4) * 0.5 + 0.5;
        float turb = fbm(sv * 5.0 + vec2(uTime * 0.05, 0.0));
        col = mix(uFog, uColorA, bands * 0.55 + turb * 0.3);
        float strike = step(0.992, hash(vec2(floor(uTime * 3.0), floor(sv.y * 5.0))));
        col += vec3(1.0, 0.92, 0.75) * strike * 0.55 * smoothstep(0.35, 0.0, abs(fract(sv.y * 5.0) - 0.5));
        col += uColorB * pow(turb, 3.0) * 0.6;
    } else if (uMode < 2.5) {
        // RING YARDS — ice-and-rock ring bands seen edge on, sodium work lights
        float band = abs(fract(sv.y * 2.2 + fbm(sv * 2.0) * 0.4) - 0.5);
        float ice = smoothstep(0.42, 0.5, band);
        float dust = fbm(sv * 14.0) * 0.5;
        col = uFog + uColorB * ice * 0.28 + vec3(dust * 0.16);
        float lamp = step(0.995, hash(floor(sv * vec2(20.0, 26.0))));
        col += uColorA * lamp * 0.85;
    } else if (uMode < 3.5) {
        // CHOIR FIELD — organic veins that pulse on the beat
        vec2 warp = vec2(fbm(sv * 2.0 + uTime * 0.03), fbm(sv * 2.0 - uTime * 0.04));
        float veins = fbm(sv * 4.0 + warp * 2.2);
        float pulse = 0.55 + 0.45 * uBeat;
        col = mix(uFog, uColorA, smoothstep(0.45, 0.85, veins) * 0.55 * pulse);
        col += uColorB * pow(smoothstep(0.6, 1.0, veins), 3.0) * 0.6 * pulse;
        col += uColorA * 0.05;
    } else if (uMode < 4.5) {
        // TETHERCORE — woven cable running the length of the shaft, lit inside
        float cables = abs(fract(uv.x * 11.0 + sin(sv.y * 4.0 + uTime * 0.2) * 0.12) - 0.5);
        float weave = smoothstep(0.16, 0.0, cables);
        float inner = smoothstep(0.5, 0.0, abs(uv.x - 0.5));
        col = uFog + uColorA * weave * (0.28 + inner * 0.5);
        col += uColorB * pow(inner, 3.0) * (0.35 + 0.25 * sin(uTime * 2.0 + sv.y * 6.0));
        col += vec3(fbm(sv * 9.0) * 0.08);
    } else {
        // THE LONG FALL — the station burning below, the planet filling the sky
        float horizon = smoothstep(0.0, 0.55, uv.y);
        col = mix(uColorB * 0.55, uFog, horizon);
        float fire = fbm(vec2(uv.x * 4.0, uv.y * 3.0 - uTime * 0.25));
        col += uColorA * pow(1.0 - uv.y, 3.0) * (0.5 + fire * 0.9);
        float embers = step(0.997, hash(floor(vec2(uv.x * 60.0, uv.y * 40.0 - uTime * 2.0))));
        col += vec3(1.0, 0.75, 0.4) * embers * 0.9;
        col += uColorA * 0.05;
    }

    col += uFlash * vec3(0.5, 0.55, 0.7);
    // Vignette, then an overall dim: the GDD's readability rule is that the
    // backdrop never gets near the brightness of the dimmest bullet.
    float vig = smoothstep(1.6, 0.35, length(fract(uv) - 0.5));
    gl_FragColor = vec4(col * vig * 0.62, 1.0);
}
`;

export function initBackdrop() {
    group = new THREE.Group();

    mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uUvScale: { value: 2.6 },
            uScroll: { value: 0 },
            uMode: { value: 0 },
            uBeat: { value: 0 },
            uFlash: { value: 0 },
            uColorA: { value: new THREE.Color(0x64c8ff) },
            uColorB: { value: new THREE.Color(0xff9f6e) },
            uFog: { value: new THREE.Color(0x0a1020) },
        },
    });

    plane = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.w * 14.3, ARENA.h * 10.4, 1, 1), mat);
    plane.position.set(0, 0, -46);
    plane.renderOrder = -10;
    group.add(plane);

    for (const layer of VIEW.starLayers) {
        const positions = new Float32Array(layer.count * 3);
        for (let i = 0; i < layer.count; i++) {
            positions[i * 3 + 0] = (Math.random() * 2 - 1) * ARENA.w * 1.6;
            positions[i * 3 + 1] = (Math.random() * 2 - 1) * ARENA.h * 0.9;
            positions[i * 3 + 2] = layer.z + Math.random() * 3;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const pmat = new THREE.PointsMaterial({
            color: layer.color, size: layer.size, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        });
        const points = new THREE.Points(geo, pmat);
        points.frustumCulled = false;
        group.add(points);
        starLayers.push({ points, positions, speed: layer.speed, geo, mat: pmat });
    }

    scene.add(group);
    return group;
}

export function setBackdrop(name, palette = {}) {
    if (!mat) return;
    mat.uniforms.uMode.value = MODES[name] ?? 0;
    if (palette.accentA !== undefined) mat.uniforms.uColorA.value.set(palette.accentA);
    if (palette.accentB !== undefined) mat.uniforms.uColorB.value.set(palette.accentB);
    if (palette.fog !== undefined) mat.uniforms.uFog.value.set(palette.fog);
    for (const layer of starLayers) if (palette.star !== undefined) layer.mat.color.set(palette.star);
}

/** `beat` is 0..1, the decaying pulse from the Chorus's downbeat. */
export function updateBackdrop(dt, { beat = 0, flash = 0, speed = 1 } = {}) {
    if (!mat) return;
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uScroll.value += dt * 0.035 * speed;
    mat.uniforms.uBeat.value = beat;
    mat.uniforms.uFlash.value = flash;

    const top = ARENA.h * 0.9;
    for (const layer of starLayers) {
        const pos = layer.positions;
        const drop = layer.speed * dt * speed;
        for (let i = 1; i < pos.length; i += 3) {
            pos[i] -= drop;
            if (pos[i] < -top) {
                pos[i] = top;
                pos[i - 1] = (Math.random() * 2 - 1) * ARENA.w * 1.6;
            }
        }
        layer.geo.attributes.position.needsUpdate = true;
    }
}

export function disposeBackdrop() {
    if (!group) return;
    plane.geometry.dispose();
    mat.dispose();
    for (const l of starLayers) { l.geo.dispose(); l.mat.dispose(); }
    starLayers.length = 0;
    scene.remove(group);
    group = null;
}
