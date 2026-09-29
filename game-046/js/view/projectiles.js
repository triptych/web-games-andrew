/**
 * projectiles.js — everything small and numerous, drawn with instancing:
 * the player's arrows (tinted by element) and their trails, enemy bullets
 * (glowing cores + halos, stretched along their flight for arrow kinds),
 * loot (XP gems, coins, hearts), and the telegraphs every enemy attack
 * paints on the floor first: blast circles that fill up as the timer runs
 * out, expanding shockwave rings, laser sights and beams, charge lanes,
 * archer aim lines, lobbed bombs and falling meteors.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, camera } from './scene.js';
import { glowTexture, ringTexture } from './textures.js';

const MAX_ARROWS = 320, MAX_BULLETS = 700, MAX_PICK = 260;
let group;
let arrowMesh, trailMesh, bulletCore, bulletGlow, xpMesh, coinMesh, heartMesh;
const hazardPool = [];
let aimLines = [];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export const BULLET_COLORS = {
    orb: 0xff3a5a, arrow: 0xffd28a, hex: 0xb060ff, goo: 0x7aff4a, wisp: 0x7ae8ff, void: 0xd050ff,
    bubble: 0x4ae0ff, ember: 0xff7a20, seed: 0xff5aa8,
};
const ELEM_COLORS = { fire: 0xff8a2a, frost: 0x8ae8ff, poison: 0x8aff5a, bolt: 0xfff06a };

export function initProjectiles() {
    group = new THREE.Group();
    scene.add(group);

    // Arrow: shaft + head + fletching, pointing along +z.
    const shaft = new THREE.CylinderGeometry(0.025, 0.025, 0.62, 5); shaft.rotateX(Math.PI / 2);
    const head = new THREE.ConeGeometry(0.07, 0.18, 6); head.rotateX(Math.PI / 2); head.translate(0, 0, 0.38);
    const fl1 = new THREE.BoxGeometry(0.14, 0.01, 0.14); fl1.translate(0, 0, -0.28);
    const fl2 = new THREE.BoxGeometry(0.01, 0.14, 0.14); fl2.translate(0, 0, -0.28);
    const arrowGeo = mergeGeometries([shaft, head, fl1, fl2]);
    arrowMesh = new THREE.InstancedMesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe6b0, emissiveIntensity: 0.5, roughness: 0.4 }), MAX_ARROWS);
    arrowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ARROWS * 3), 3);
    arrowMesh.frustumCulled = false;
    group.add(arrowMesh);

    const trailGeo = new THREE.PlaneGeometry(0.16, 1.2); trailGeo.rotateX(-Math.PI / 2); trailGeo.translate(0, 0, -0.6);
    trailMesh = new THREE.InstancedMesh(trailGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }), MAX_ARROWS);
    trailMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ARROWS * 3), 3);
    trailMesh.frustumCulled = false;
    group.add(trailMesh);

    bulletCore = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BULLETS);
    bulletCore.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BULLETS * 3), 3);
    bulletCore.frustumCulled = false;
    group.add(bulletCore);
    bulletGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_BULLETS);
    bulletGlow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BULLETS * 3), 3);
    bulletGlow.frustumCulled = false;
    group.add(bulletGlow);

    xpMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0x60ffb0, emissive: 0x30ff90, emissiveIntensity: 1.6 }), MAX_PICK);
    xpMesh.frustumCulled = false;
    group.add(xpMesh);
    const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14); coinGeo.rotateX(Math.PI / 2);
    coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({ color: 0xffcc30, emissive: 0x805a00, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.25 }), MAX_PICK);
    coinMesh.frustumCulled = false;
    group.add(coinMesh);
    const h1 = new THREE.SphereGeometry(0.1, 10, 8); h1.translate(-0.07, 0.05, 0);
    const h2 = new THREE.SphereGeometry(0.1, 10, 8); h2.translate(0.07, 0.05, 0);
    const h3 = new THREE.ConeGeometry(0.15, 0.2, 10); h3.rotateZ(Math.PI); h3.translate(0, -0.07, 0);
    heartMesh = new THREE.InstancedMesh(mergeGeometries([h1, h2, h3]), new THREE.MeshStandardMaterial({ color: 0xff3050, emissive: 0xff1030, emissiveIntensity: 0.8 }), 32);
    heartMesh.frustumCulled = false;
    group.add(heartMesh);
}

// ------------------------------------------------------------------ Hazards

function makeHazardView() {
    const g = new THREE.Group();
    const outline = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    outline.rotation.x = -Math.PI / 2;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.35 }));
    fill.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.3 }));
    lane.geometry.rotateX(-Math.PI / 2);
    lane.geometry.translate(0, 0, -0.5);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.geometry.translate(0, 0, -0.5);
    const proj = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.4, emissive: 0xff5010, emissiveIntensity: 0 }));
    proj.castShadow = true;
    g.add(outline, fill, ring, lane, beam, proj);
    g.userData = { outline, fill, ring, lane, beam, proj };
    group.add(g);
    return g;
}

const STYLE_COL = { bomb: 0xff4a2a, land: 0xff3a6a, rain: 0xff3a3a, meteor: 0xff7a1a, slam: 0xffaa3a, tele: 0xffd040 };

function syncHazards(w, time) {
    let i = 0;
    const get = () => {
        if (i >= hazardPool.length) hazardPool.push(makeHazardView());
        const v = hazardPool[i++];
        v.visible = true;
        for (const c of v.children) c.visible = false;
        return v;
    };
    for (const h of w.hazards) {
        const v = get(), u = v.userData;
        v.position.set(h.x, 0.03, -h.y);
        v.rotation.set(0, 0, 0);
        v.scale.set(1, 1, 1);
        if (h.kind === 'circle') {
            if (h.delay <= 0) { i--; v.visible = false; continue; }
            const k = Math.min(1, h.t / h.delay);
            const col = STYLE_COL[h.style] ?? 0xff4040;
            u.outline.visible = u.fill.visible = true;
            u.outline.scale.setScalar(h.r);
            u.outline.material.color.set(col);
            u.outline.material.opacity = 0.55 + 0.4 * Math.sin(time * 18) * k;
            u.fill.scale.setScalar(Math.max(0.01, h.r * k));
            u.fill.material.color.set(col);
            u.fill.material.opacity = 0.25 + 0.3 * k;
            // Lobbed bombs arc in; meteors fall from the sky.
            if (h.style === 'bomb' && h.fromX !== undefined) {
                u.proj.visible = true;
                u.proj.scale.setScalar(1);
                u.proj.material.color.set(0x222228);
                u.proj.material.emissive.set(0xff5010);
                u.proj.material.emissiveIntensity = k > 0.7 ? 1 + Math.sin(time * 40) : 0;
                u.proj.position.set(h.fromX - h.x, 0, -(h.fromY - h.y)).multiplyScalar(1 - k);
                u.proj.position.y = 0.3 + Math.sin(Math.PI * k) * 3;
            } else if (h.style === 'meteor' && k > 0.45) {
                const f = (k - 0.45) / 0.55;
                u.proj.visible = true;
                u.proj.material.color.set(0x5a2a1a);
                u.proj.material.emissive.set(0xff5010);
                u.proj.material.emissiveIntensity = 2;
                u.proj.scale.setScalar(2.2);
                u.proj.position.set(1.5 * (1 - f), 9 * (1 - f), 1.5 * (1 - f));
            } else if (h.style === 'rain' && k > 0.6) {
                u.proj.visible = true;
                u.proj.material.color.set(0xffe0a0);
                u.proj.material.emissive.set(0xffc060);
                u.proj.material.emissiveIntensity = 1.5;
                u.proj.scale.set(0.3, 3, 0.3);
                u.proj.position.set(0, 6 * (1 - (k - 0.6) / 0.4), 0);
            }
            if (!u.proj.visible) u.proj.scale.setScalar(1);
        } else if (h.kind === 'ring') {
            if (h.r <= 0) { i--; v.visible = false; continue; }
            u.ring.visible = true;
            u.ring.scale.setScalar(h.r);
            u.ring.material.color.set(0xff8a3a);
            u.ring.material.opacity = 0.9 * (1 - h.r / h.maxR * 0.6);
        } else if (h.kind === 'line') {
            u.lane.visible = true;
            v.rotation.y = Math.atan2(Math.cos(h.ang), -Math.sin(h.ang)) + Math.PI;
            u.lane.scale.set((h.width || 0.5) * 2, 1, h.len);
            u.lane.material.color.set(0xff3030);
            u.lane.material.opacity = 0.18 + 0.2 * Math.min(1, h.t / h.life) + Math.sin(time * 20) * 0.05;
        } else if (h.kind === 'beam') {
            u.beam.visible = true;
            v.rotation.y = Math.atan2(Math.cos(h.ang), -Math.sin(h.ang)) + Math.PI;
            const live = h.t >= h.delay;
            if (live) {
                const f = 1 - (h.t - h.delay) / h.dur;
                u.beam.scale.set(h.width * 2.4 * (0.6 + f * 0.6), 0.5, h.len);
                u.beam.position.y = 0.55;
                u.beam.material.color.set(0xff60ff);
                u.beam.material.opacity = 0.95;
            } else {
                const k = h.t / h.delay;
                u.beam.scale.set(0.05 + k * 0.05, 0.02, h.len);
                u.beam.position.y = 0.05;
                u.beam.material.color.set(0xff2060);
                u.beam.material.opacity = 0.5 + 0.5 * Math.sin(time * (10 + k * 30));
            }
        }
    }
    // Archer aim lines.
    for (const e of w.enemies) {
        if (e.state !== 'aim' || e.data.aim === undefined) continue;
        const v = get(), u = v.userData;
        v.position.set(e.x, 0.05, -e.y);
        v.rotation.set(0, Math.atan2(Math.cos(e.data.aim), -Math.sin(e.data.aim)) + Math.PI, 0);
        u.beam.visible = true;
        u.beam.scale.set(0.04, 0.02, 9);
        u.beam.position.y = 0.45;
        u.beam.material.color.set(0xff2020);
        u.beam.material.opacity = 0.35 + 0.35 * Math.sin(time * 25);
    }
    for (let k = i; k < hazardPool.length; k++) hazardPool[k].visible = false;
}

// ------------------------------------------------------------------ Per-frame

export function syncProjectiles(w, dt, time) {
    // Player arrows.
    const p = w.player;
    const elem = p.ab.fire ? 'fire' : p.ab.frost ? 'frost' : p.ab.poison ? 'poison' : p.ab.bolt ? 'bolt' : null;
    let n = 0;
    for (const s of w.arrows) {
        if (n >= MAX_ARROWS) break;
        const ang = Math.atan2(s.vy, s.vx);
        _q.setFromAxisAngle(UP, Math.atan2(Math.cos(ang), -Math.sin(ang)));
        const sc = s.r / 0.14;
        _s.set(sc, sc, sc * (s.spirit ? 0.7 : 1));
        _p.set(s.x, 0.55, -s.y);
        _m.compose(_p, _q, _s);
        arrowMesh.setMatrixAt(n, _m);
        _c.set(s.spirit ? 0x9affff : elem && !s.spirit ? ELEM_COLORS[elem] : 0xfff2d8);
        arrowMesh.setColorAt(n, _c);
        _s.set(sc * 1.4, 1, 1);
        _m.compose(_p, _q, _s);
        trailMesh.setMatrixAt(n, _m);
        _c.set(s.spirit ? 0x3a9aff : elem ? ELEM_COLORS[elem] : 0xffd080).multiplyScalar(0.8);
        trailMesh.setColorAt(n, _c);
        n++;
    }
    arrowMesh.count = trailMesh.count = n;
    arrowMesh.instanceMatrix.needsUpdate = trailMesh.instanceMatrix.needsUpdate = true;
    if (n) { arrowMesh.instanceColor.needsUpdate = true; trailMesh.instanceColor.needsUpdate = true; }

    // Enemy bullets.
    n = 0;
    for (const b of w.bullets) {
        if (n >= MAX_BULLETS) break;
        const col = BULLET_COLORS[b.kind] ?? 0xff4040;
        const pulse = 1 + Math.sin(time * 14 + b.id) * 0.08;
        _p.set(b.x, 0.5, -b.y);
        if (b.kind === 'arrow') {
            const ang = Math.atan2(b.vy, b.vx);
            _q.setFromAxisAngle(UP, Math.atan2(Math.cos(ang), -Math.sin(ang)));
            _s.set(b.r * 0.6, b.r * 0.6, b.r * 2.6);
        } else {
            _q.identity();
            _s.setScalar(b.r * 0.72 * pulse);
        }
        _m.compose(_p, _q, _s);
        bulletCore.setMatrixAt(n, _m);
        _c.set(col).lerp(new THREE.Color(1, 1, 1), 0.55);
        bulletCore.setColorAt(n, _c);
        _s.setScalar(b.r * 6.5 * pulse);
        _m.compose(_p, camera.quaternion, _s);
        bulletGlow.setMatrixAt(n, _m);
        _c.set(col);
        bulletGlow.setColorAt(n, _c);
        n++;
    }
    bulletCore.count = bulletGlow.count = n;
    bulletCore.instanceMatrix.needsUpdate = bulletGlow.instanceMatrix.needsUpdate = true;
    if (n) { bulletCore.instanceColor.needsUpdate = true; bulletGlow.instanceColor.needsUpdate = true; }

    // Loot.
    let nx = 0, nc = 0, nh = 0;
    for (const k of w.pickups) {
        const y = 0.25 + (k.z || 0) + Math.sin(time * 4 + k.id) * 0.05;
        _p.set(k.x, y, -k.y);
        _q.setFromAxisAngle(UP, time * 3 + k.id);
        if (k.kind === 'xp' && nx < MAX_PICK) {
            _s.setScalar(0.8 + Math.min(1.2, k.value * 0.25));
            _m.compose(_p, _q, _s);
            xpMesh.setMatrixAt(nx++, _m);
        } else if (k.kind === 'coin' && nc < MAX_PICK) {
            _s.setScalar(1);
            _m.compose(_p, _q, _s);
            coinMesh.setMatrixAt(nc++, _m);
        } else if (k.kind === 'heart' && nh < 32) {
            _s.setScalar(1.3 + Math.sin(time * 6) * 0.1);
            _m.compose(_p, _q, _s);
            heartMesh.setMatrixAt(nh++, _m);
        }
    }
    xpMesh.count = nx; coinMesh.count = nc; heartMesh.count = nh;
    xpMesh.instanceMatrix.needsUpdate = coinMesh.instanceMatrix.needsUpdate = heartMesh.instanceMatrix.needsUpdate = true;

    syncHazards(w, time);
}
