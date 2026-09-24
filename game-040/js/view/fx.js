/**
 * fx.js — explosions, shockwaves, sparks, telegraphs, score popups.
 *
 * Everything here is short-lived and self-disposing: each effect owns its
 * geometry/material and frees them when its life runs out, because three.js
 * does not garbage-collect GPU resources.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { makeTextSprite } from './text3d.js';

const effects = [];
let group = null;

export function initFx() {
    group = new THREE.Group();
    scene.add(group);
    return group;
}

function push(obj, life, update) {
    obj.renderOrder = 15;
    group.add(obj);
    effects.push({ obj, life, maxLife: life, update });
    return obj;
}

// ------------------------------------------------------------------ explosions

/**
 * A three-stage explosion, because one cloud of same-coloured dots reads as
 * smoke rather than as a detonation:
 *
 *   core   — a white-hot ball that cools to the given colour over its life
 *   debris — a slower, darker, gravity-affected ring of chunks
 *   sparks — a few very fast streaks that outrun both
 *
 * Per-vertex colour is what makes it bright: each particle gets its own RGB,
 * lerped from white through the explosion colour, so the middle of the blast
 * is genuinely overexposed and the bloom pass has something to catch.
 */
export function spawnExplosion(x, y, { color = 0xffb347, scale = 1, count = 26, speed = 9 } = {}) {
    const base = new THREE.Color(color);

    // --- core: hot, fast, fades from white ---
    const n = Math.round(count * 1.35);
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        // sqrt keeps the cloud disc-uniform instead of clumping at the centre
        const s = (0.25 + Math.sqrt(Math.random())) * speed * scale;
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = 0.3;
        vel[i * 3] = Math.cos(a) * s;
        vel[i * 3 + 1] = Math.sin(a) * s;
        vel[i * 3 + 2] = (Math.random() - 0.5) * s * 0.35;
        // the fastest particles start whitest — that is what a fireball edge does
        tint.copy(base).lerp(WHITE, 0.25 + Math.random() * 0.75);
        colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.3 * scale, transparent: true, opacity: 1, vertexColors: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;

    const life = 0.6 + 0.3 * scale;
    push(pts, life, (e, dt) => {
        const k = e.life / e.maxLife;
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
            p[i] += vel[i] * dt;
            p[i + 1] += vel[i + 1] * dt;
            p[i + 2] += vel[i + 2] * dt;
            vel[i] *= 1 - 2.6 * dt;
            vel[i + 1] *= 1 - 2.6 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = k ** 0.7;
        mat.size = 0.3 * scale * (0.25 + k * 0.9);
    });

    spawnDebris(x, y, base, scale, Math.round(count * 0.5), speed);
    // Two rings of different colour and timing give the blast a front and a
    // wake, which one ring never does.
    spawnShockwave(x, y, { color: 0xffffff, maxR: 1.9 * scale, life: 0.24, width: 0.07 });
    spawnShockwave(x, y, { color, maxR: 2.9 * scale, life: 0.4, width: 0.1 });
    spawnFlash(x, y, { color: 0xffffff, scale: scale * 0.9, life: 0.12 });
    spawnFlash(x, y, { color, scale: scale * 1.5, life: 0.22 });
    return pts;
}

const WHITE = new THREE.Color(0xffffff);

/** The slower half of a blast: heavier chunks that arc and fall. */
function spawnDebris(x, y, base, scale, count, speed) {
    if (count <= 0) return null;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.15 + Math.random() * 0.55) * speed * scale;
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = 0.2;
        vel[i * 3] = Math.cos(a) * s;
        vel[i * 3 + 1] = Math.sin(a) * s + speed * scale * 0.18;
        vel[i * 3 + 2] = 0;
        tint.copy(base).multiplyScalar(0.55 + Math.random() * 0.45);
        colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.17 * scale, transparent: true, opacity: 0.85, vertexColors: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    const gravity = 9 * scale;
    return push(pts, 0.85 + 0.35 * scale, (e, dt) => {
        const k = e.life / e.maxLife;
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
            vel[i + 1] -= gravity * dt;
            p[i] += vel[i] * dt;
            p[i + 1] += vel[i + 1] * dt;
            vel[i] *= 1 - 1.1 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 0.85 * k ** 1.3;
    });
}

export function spawnShockwave(x, y, { color = 0xffffff, maxR = 3, life = 0.45, width = 0.16 } = {}) {
    const geo = new THREE.RingGeometry(1 - width, 1, 36);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, y, 0.35);
    ring.scale.setScalar(0.35);
    return push(ring, life, (e) => {
        const k = 1 - e.life / e.maxLife;
        ring.scale.setScalar(0.35 + maxR * k);
        mat.opacity = 0.95 * (1 - k) ** 1.5;
    });
}

export function spawnFlash(x, y, { color = 0xffffff, scale = 1, life = 0.18 } = {}) {
    const geo = new THREE.SphereGeometry(0.6 * scale, 10, 8);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const s = new THREE.Mesh(geo, mat);
    s.position.set(x, y, 0.4);
    return push(s, life, (e) => {
        const k = e.life / e.maxLife;
        mat.opacity = 0.9 * k;
        s.scale.setScalar(1 + (1 - k) * 1.6);
    });
}

export function spawnSpark(x, y, color = 0x7ef2ff) {
    const geo = new THREE.SphereGeometry(0.16, 6, 5);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const s = new THREE.Mesh(geo, mat);
    s.position.set(x, y, 0.3);
    return push(s, 0.16, (e) => {
        const k = e.life / e.maxLife;
        mat.opacity = 0.9 * k;
        s.scale.setScalar(0.6 + (1 - k) * 2.2);
    });
}

/** The windup telegraph: a ring that closes onto the emitter as it charges. */
export function spawnTelegraph(x, y, duration, color = 0xff3860, radius = 3.2) {
    const geo = new THREE.RingGeometry(0.92, 1, 34);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, y, 0.3);
    return push(ring, Math.max(0.12, duration), (e) => {
        const k = 1 - e.life / e.maxLife;            // 0 -> 1 as it charges
        ring.scale.setScalar(radius * (1 - k) + 0.7);
        mat.opacity = 0.25 + 0.65 * k;
    });
}

export function spawnPopup(x, y, text, cssColor = '#ffd166', { scale = 0.9, rise = 2.2 } = {}) {
    const sprite = makeTextSprite(text, cssColor, { scale });
    sprite.position.set(x, y, 0.8);
    return push(sprite, 0.9, (e) => {
        const k = e.life / e.maxLife;
        sprite.position.y += rise * 0.016;
        sprite.material.opacity = Math.min(1, k * 1.6);
    });
}

export function spawnBanner(text, cssColor = '#7ef2ff', { y = 3, scale = 2.6, life = 2.4 } = {}) {
    const sprite = makeTextSprite(text, cssColor, { scale, size: 110 });
    sprite.position.set(0, y, 1.2);
    return push(sprite, life, (e) => {
        const k = e.life / e.maxLife;
        sprite.material.opacity = k > 0.75 ? (1 - k) * 4 : Math.min(1, k * 2.4);
        sprite.scale.set(scale * 2 * (1 + (1 - k) * 0.06), scale * (1 + (1 - k) * 0.06), 1);
    });
}

/** The flare: a fat expanding ring plus a wash of light. */
export function spawnFlareBurst(x, y, radius = 9) {
    spawnShockwave(x, y, { color: 0xffe9b0, maxR: radius, life: 0.75, width: 0.06 });
    spawnShockwave(x, y, { color: 0xff8bd0, maxR: radius * 0.75, life: 0.6, width: 0.12 });
    spawnFlash(x, y, { color: 0xffffff, scale: 3.5, life: 0.3 });
    for (let i = 0; i < 3; i++) {
        spawnExplosion(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3,
            { color: 0xffd166, scale: 1.1, count: 18 });
    }
}

// --------------------------------------------------------- persistent visuals

export function makeBeamMesh() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xff3860, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 18;
    return mesh;
}

export function makeFieldMesh(color = 0xff8bd0) {
    const geo = new THREE.RingGeometry(0.6, 1, 32);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 14;
    return mesh;
}

export function makeWaveMesh(color = 0x9fe8ff) {
    const geo = new THREE.RingGeometry(0.88, 1, 48);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 16;
    return mesh;
}

// -------------------------------------------------------------------- update

export function updateFx(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.life -= dt;
        if (e.life <= 0) {
            group.remove(e.obj);
            e.obj.geometry?.dispose?.();
            if (e.obj.material?.map) e.obj.material.map = null;   // textures are cached & shared
            e.obj.material?.dispose?.();
            effects.splice(i, 1);
            continue;
        }
        e.update?.(e, dt);
    }
}

export function clearFx() {
    for (const e of effects) {
        group.remove(e.obj);
        e.obj.geometry?.dispose?.();
        e.obj.material?.dispose?.();
    }
    effects.length = 0;
}

export function fxCount() { return effects.length; }
