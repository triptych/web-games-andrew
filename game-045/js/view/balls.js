/**
 * balls.js — chrome pinballs that reflect a synthwave environment, each with
 * a glowing under-light and a tapering neon ribbon trail.
 *
 * Public API:
 *   initBalls(renderer)            — builds the neon env map for reflections
 *   syncBalls(w, dt, fire)         — create/remove/move ball meshes + trails
 *   resetBalls()
 */

import * as THREE from 'three';
import { table } from './scene.js';
import { PHYS, COLORS } from '../config.js';

const R = PHYS.ballR;
const TRAIL = 26;

let envMap, ballGeo, glowTex;
const views = new Map();       // ball id → view

export function initBalls(renderer) {
    // A tiny scene of neon bands, pre-filtered into an env map, so the chrome
    // balls reflect pink/cyan/purple instead of a grey studio.
    const envScene = new THREE.Scene();
    const envSphere = new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: `
                varying vec3 vD;
                void main() {
                    float y = vD.y;
                    vec3 c = mix(vec3(0.05, 0.0, 0.12), vec3(0.2, 0.0, 0.35), smoothstep(-1.0, 0.0, y));
                    c += vec3(1.0, 0.18, 0.62) * exp(-abs(y - 0.05) * 18.0) * 2.5;       // pink horizon
                    c += vec3(0.2, 0.95, 1.0) * smoothstep(0.55, 0.9, y) * 1.6;          // cyan sky
                    c += vec3(1.0, 0.8, 0.3) * exp(-length(vD - normalize(vec3(-0.4, 0.6, 0.7))) * 6.0) * 3.0; // key light
                    float grid = step(0.94, fract(atan(vD.z, vD.x) * 6.0)) * step(y, -0.05);
                    c += vec3(0.9, 0.2, 1.0) * grid;
                    gl_FragColor = vec4(c, 1.0);
                }`,
        }),
    );
    envScene.add(envSphere);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();

    ballGeo = new THREE.SphereGeometry(R, 32, 20);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
}

function makeView(b) {
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: 1, roughness: 0.1, envMap, envMapIntensity: 1.5,
        emissive: new THREE.Color(COLORS.cyan), emissiveIntensity: 0.08,
    });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.position.set(b.x, b.y, R);

    const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex, color: new THREE.Color(COLORS.cyan).multiplyScalar(1.3),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), glowMat);
    glowMesh.position.set(b.x, b.y, 0.04);
    glowMesh.renderOrder = 3;

    // Ribbon trail: a triangle strip rebuilt from the position history.
    const pos = new Float32Array(TRAIL * 2 * 3);
    const col = new Float32Array(TRAIL * 2 * 3);
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tg.setIndex(idx);
    const trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    trail.frustumCulled = false;
    trail.renderOrder = 4;

    table.add(mesh, glowMesh, trail);
    const hist = Array.from({ length: TRAIL }, () => new THREE.Vector2(b.x, b.y));
    return { mesh, mat, glowMesh, glowMat, trail, hist, spawn: 0 };
}

function dropView(id) {
    const v = views.get(id);
    table.remove(v.mesh, v.glowMesh, v.trail);
    v.mat.dispose();
    v.glowMat.dispose();
    v.glowMesh.geometry.dispose();
    v.trail.geometry.dispose();
    v.trail.material.dispose();
    views.delete(id);
}

const cA = new THREE.Color(), cB = new THREE.Color(), cT = new THREE.Color();

export function syncBalls(w, dt, fire) {
    const live = new Set();
    for (const b of w.balls) {
        live.add(b.id);
        if (!views.has(b.id)) views.set(b.id, makeView(b));
        const v = views.get(b.id);
        v.spawn = Math.min(1, v.spawn + dt * 5);
        v.mesh.position.set(b.x, b.y, R);
        v.mesh.scale.setScalar(v.spawn);
        v.glowMesh.position.set(b.x, b.y, 0.04);

        const sp = Math.hypot(b.vx, b.vy);
        const hot = fire ? 1 : 0;
        v.mat.emissive.set(fire ? COLORS.orange : COLORS.cyan);
        v.mat.emissiveIntensity = fire ? 1.1 + Math.sin(performance.now() * 0.03) * 0.3 : 0.08;
        v.glowMat.color.set(fire ? COLORS.orange : COLORS.cyan).multiplyScalar(0.75 + Math.min(1, sp / 30) * 0.45 + hot * 0.35);
        v.glowMesh.scale.setScalar(1 + Math.min(0.4, sp / 80) + hot * 0.25);

        // Shift history; newest at 0.
        for (let i = TRAIL - 1; i > 0; i--) v.hist[i].copy(v.hist[i - 1]);
        v.hist[0].set(b.x, b.y);
        if (b.held) for (const h of v.hist) h.set(b.x, b.y);

        cA.set(fire ? 0xfff0a0 : 0xffffff);
        cB.set(fire ? COLORS.orange : (sp > 26 ? COLORS.pink : COLORS.cyan));
        const pos = v.trail.geometry.attributes.position.array;
        const col = v.trail.geometry.attributes.color.array;
        for (let i = 0; i < TRAIL; i++) {
            const p = v.hist[i];
            const q = v.hist[Math.min(TRAIL - 1, i + 1)];
            const o = v.hist[Math.max(0, i - 1)];
            let dx = o.x - q.x, dy = o.y - q.y;
            const l = Math.hypot(dx, dy) || 1;
            dx /= l; dy /= l;
            const f = 1 - i / (TRAIL - 1);
            const wdt = R * (0.95 * f + 0.05) * (fire ? 1.5 : 1);
            const k = i * 6;
            pos[k]     = p.x - dy * wdt; pos[k + 1] = p.y + dx * wdt; pos[k + 2] = R * 0.9;
            pos[k + 3] = p.x + dy * wdt; pos[k + 4] = p.y - dx * wdt; pos[k + 5] = R * 0.9;
            cT.copy(cB).lerp(cA, f * f).multiplyScalar(f * f * (fire ? 1.6 : 1.2));
            col[k] = col[k + 3] = cT.r;
            col[k + 1] = col[k + 4] = cT.g;
            col[k + 2] = col[k + 5] = cT.b;
        }
        v.trail.geometry.attributes.position.needsUpdate = true;
        v.trail.geometry.attributes.color.needsUpdate = true;
    }
    for (const id of [...views.keys()]) if (!live.has(id)) dropView(id);
}

export function resetBalls() {
    for (const id of [...views.keys()]) dropView(id);
}
