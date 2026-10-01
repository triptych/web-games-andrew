/**
 * spireScene.js — the Endless Spire seen from the sky: a tower of floors
 * rising out of the clouds, the current floor lit, guardian floors in red.
 */

import * as THREE from 'three';
import { skyDome, setSky, standardLights, size } from './engine.js';
import { toonMesh, part, glowMat, merge, paintGradient, shade, disposeObject } from './toon.js';
import { cyl, cone, box, tor } from './chars.js';
import { createFx } from './fx.js';
import { makeProp } from './props.js';

const FH = 2.2;

function floorSegment(f, current) {
    const boss = f % 10 === 0;
    const base = boss ? '#c84a5a' : f % 2 ? '#d8d0f0' : '#c8bce8';
    const grp = new THREE.Group();
    grp.add(toonMesh([
        part(cyl(1.75, 1.85, FH * 0.86, 16), base, [0, FH * 0.43, 0]),
        part(cyl(2.05, 2.05, FH * 0.14, 16), shade(base, -0.2), [0, FH * 0.93, 0]),
        part(tor(1.82, 0.08, 6, 24), '#e8c060', [0, FH * 0.86, 0], [Math.PI / 2, 0, 0]),
        ...Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return part(box(0.25, FH * 0.86, 0.25), shade(base, -0.12), [Math.cos(a) * 1.82, FH * 0.43, Math.sin(a) * 1.82]); }),
    ], { outline: 0.035 }));
    const wins = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; wins.push(part(box(0.38, 0.6, 0.06), f <= current ? '#ffe08a' : '#5a4a8a', [Math.cos(a) * 1.76, FH * 0.45, Math.sin(a) * 1.76], [0, -a + Math.PI / 2, 0])); }
    grp.add(new THREE.Mesh(merge(wins), glowMat()));
    grp.position.y = (f - 1) * FH;
    grp.userData.floor = f;
    return grp;
}

export function createSpireStage() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#8a7ad0', 25, 70);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    const sky = skyDome('#2a1a6a', '#c8b0ff', '#ffd0f0', 250);
    scene.add(sky);
    standardLights(scene, { sky: '#e0d8ff', ground: '#6a5aa0', sunPos: [6, 10, 8] });
    const fx = createFx(scene);
    const tower = new THREE.Group();
    scene.add(tower);
    const clouds = new THREE.Group();
    scene.add(clouds);
    for (let i = 0; i < 18; i++) {
        const c = makeProp('cloud', 300 + i, {});
        const a = (i / 18) * Math.PI * 2, r = 7 + (i % 4) * 3;
        c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        c.userData.dy = (i % 5) * 1.3 - 3;
        c.userData.a = a; c.userData.r = r;
        c.scale.setScalar(1.6 + (i % 3) * 0.8);
        clouds.add(c);
    }
    // the rock the Spire grows out of
    const baseRock = new THREE.Group();
    baseRock.add(toonMesh([part(paintGradient(cone(4.2, 7, 10), '#3a3048', '#6a5a7a', 1), null, [0, -3.6, 0], [Math.PI, 0, 0]), part(paintGradient(cyl(4.3, 4.2, 0.4, 24), '#5aaa3e', '#7ccf52', 1), null, [0, -0.2, 0])], { outline: 0.04 }));
    for (let i = 0; i < 6; i++) { const t = makeProp(i % 2 ? 'pine' : 'rock', 70 + i, {}); const a = (i / 6) * Math.PI * 2; t.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); baseRock.add(t); }
    scene.add(baseRock);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const st = { scene, camera, fx, floor: 1, time: 0, camY: 0, built: -1 };

    st.setFloor = (floor) => {
        st.floor = floor;
        if (st.built === floor) return;
        st.built = floor;
        disposeObject(tower);
        tower.clear();
        for (let f = Math.max(1, floor - 6); f <= floor + 6; f++) tower.add(floorSegment(f, floor - 1));
        const top = toonMesh([part(paintGradient(cone(1.5, 3, 12), '#5a4aa8', '#9a8aff', 1), null, [0, 0, 0])], { outline: 0.03 });
        top.position.y = (floor + 6) * FH + 1.5;
        tower.add(top);
        ring.position.y = (floor - 1) * FH + 0.08;
        st.targetY = (floor - 1) * FH + 1.0;
        // tint the sky as you climb
        const k = Math.min(1, floor / 120);
        setSky(sky, shade('#2a1a6a', -k * 0.6), shade('#c8b0ff', -k * 0.5), '#ffd0f0');
    };

    st.celebrate = () => {
        const p = new THREE.Vector3(0, (st.floor - 1) * FH + 1, 2);
        fx.burst(p, '#ffe08a', 50, { speed: 5 });
        fx.ring(new THREE.Vector3(0, (st.floor - 1) * FH, 0), '#ffe08a', { to: 5 });
    };

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        camera.fov = portrait ? 52 : 40;
        camera.updateProjectionMatrix();
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    st.update = (dt) => {
        st.time += dt;
        const portrait = size.w / size.h < 0.9;
        st.camY += ((st.targetY || 0) - st.camY) * Math.min(1, dt * 3);
        const a = st.time * 0.12;
        const d = portrait ? 21 : 15;
        camera.position.set(Math.sin(a) * d, st.camY + (portrait ? 0.5 : 1.5), Math.cos(a) * d);
        camera.lookAt(0, st.camY - (portrait ? 3.4 : 1.4), 0);
        ring.rotation.z += dt * 0.5;
        ring.material.opacity = 0.5 + Math.sin(st.time * 3) * 0.2;
        for (const c of clouds.children) {
            c.userData.a += dt * 0.02;
            c.position.set(Math.cos(c.userData.a) * c.userData.r, st.camY - 7 - Math.abs(c.userData.dy), Math.sin(c.userData.a) * c.userData.r);
        }
        if (Math.random() < dt * 6) fx.emit({ pos: new THREE.Vector3((Math.random() - 0.5) * 8, st.camY - 3, (Math.random() - 0.5) * 8), count: 1, color: '#fff0c0', speed: 0.3, up: 1.5, life: 3, size: 0.12 });
        fx.update(dt);
    };
    st.frame();
    return st;
}
