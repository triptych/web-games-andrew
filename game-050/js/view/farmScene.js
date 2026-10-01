/**
 * farmScene.js — the farm up close: twelve plots, a barn, a windmill, a
 * scarecrow, the heroes you assigned as farmers, and crops that visibly grow.
 */

import * as THREE from 'three';
import { skyDome, setSky, standardLights, size, raycast, blobShadow } from './engine.js';
import { toonMat, toonMesh, part, glowMat, merge, paint, paintGradient, shade, mix } from './toon.js';
import { cyl, cone, box, tor, sph } from './chars.js';
import { buildCharacter } from './chars.js';
import { Actor } from './anim.js';
import { createFx } from './fx.js';
import { makeProp, groundDisc } from './props.js';
import { cropModel } from './citadel.js';

const COLS = 3, ROWS = 4;
const px = (i) => ((i % COLS) - 1) * 1.45;
const pz = (i) => (Math.floor(i / COLS) - 1.5) * 1.3;

export function createFarmStage() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#cfeeff', 20, 60);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    const sky = skyDome('#6ab8ff', '#e8f6ff', '#fff0d0');
    scene.add(sky);
    const lights = standardLights(scene, { sunPos: [6, 10, 6] });
    const fx = createFx(scene);
    fx.ambient('pollen', { w: 12, h: 3, d: 10, y: 0.3, z: 0 });

    scene.add(new THREE.Mesh(groundDisc(40, '#7ccf52', '#5aaa3e', 11, 64), toonMat({ vertexColors: true, steps: 4 })));
    // barn
    scene.add(toonMesh([
        part(box(3.2, 2.2, 2.4), '#c84a3a', [-4.6, 1.1, -5.2]),
        part(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1).rotateY(Math.PI / 4).scale(2.6, 1.3, 2.0), '#6a3a2a', [-4.6, 2.85, -5.2]),
        part(box(1.2, 1.5, 0.1), '#f4ead8', [-4.6, 0.75, -3.98]), part(box(0.08, 1.5, 0.12), '#c84a3a', [-4.6, 0.75, -3.95]),
        part(box(0.5, 0.5, 0.1), '#f4ead8', [-4.6, 2.0, -3.98]),
    ], { outline: 0.03 }));
    // windmill
    const mill = new THREE.Group();
    mill.add(toonMesh([part(cyl(0.6, 0.9, 3.4, 10), '#f0e4c8', [0, 1.7, 0]), part(cone(0.9, 1.0, 10), '#8a5a3a', [0, 3.9, 0])], { outline: 0.03 }));
    const blades = new THREE.Group();
    blades.position.set(0, 3.2, 0.75);
    for (let i = 0; i < 4; i++) blades.add(toonMesh([part(box(0.08, 1.8, 0.05), '#7a5236', [0, 0.95, 0]), part(box(0.5, 1.4, 0.03), '#f4f0e4', [0.28, 1.1, 0])], { outline: 0.012 }).rotateZ((i * Math.PI) / 2));
    mill.add(blades);
    mill.position.set(5.2, 0, -5.8);
    scene.add(mill);
    // fence around the field
    const fence = [];
    for (let i = 0; i <= 8; i++) { const x = -3 + i * 0.75; fence.push(part(box(0.08, 0.6, 0.08), '#a07a4a', [x, 0.3, -3.3]), part(box(0.08, 0.6, 0.08), '#a07a4a', [x, 0.3, 3.3])); }
    for (let i = 0; i <= 8; i++) { const z = -3.3 + i * 0.825; fence.push(part(box(0.08, 0.6, 0.08), '#a07a4a', [-3.0, 0.3, z]), part(box(0.08, 0.6, 0.08), '#a07a4a', [3.0, 0.3, z])); }
    fence.push(part(box(6.0, 0.06, 0.05), '#a07a4a', [0, 0.45, -3.3]), part(box(6.0, 0.06, 0.05), '#a07a4a', [0, 0.45, 3.3]), part(box(0.05, 0.06, 6.6), '#a07a4a', [-3.0, 0.45, 0]), part(box(0.05, 0.06, 6.6), '#a07a4a', [3.0, 0.45, 0]));
    scene.add(toonMesh(fence, { outline: 0.01 }));
    // scarecrow + trees
    scene.add(toonMesh([part(cyl(0.04, 0.04, 1.6, 6), '#7a5236', [3.8, 0.8, 1.2]), part(box(1.1, 0.07, 0.07), '#7a5236', [3.8, 1.25, 1.2]), part(sph(0.22, 10, 8), '#f0d890', [3.8, 1.7, 1.2]), part(cone(0.36, 0.36, 10), '#c84a3a', [3.8, 1.95, 1.2]), part(box(0.55, 0.6, 0.25), '#4a7ad0', [3.8, 1.2, 1.2])], { outline: 0.015 }));
    for (const [x, z, k] of [[-6, 0, 'tree'], [-7, 3, 'tree'], [6.5, 2, 'tree'], [7, -1.5, 'pine'], [-6.5, -2.6, 'bush'], [5.5, 4, 'bush'], [-4, 5, 'flower'], [4.5, -3.6, 'flower']]) {
        const m = makeProp(k, x * 10 + z, {});
        m.position.set(x, 0, z);
        m.scale.setScalar(1.3);
        scene.add(m);
    }
    // plots
    const plots = [];
    for (let i = 0; i < COLS * ROWS; i++) {
        const soil = new THREE.Mesh(paintGradient(new THREE.BoxGeometry(1.25, 0.22, 1.1, 2, 1, 2), '#4a2e1a', '#7a4e2a', 1), toonMat({ vertexColors: true }));
        soil.position.set(px(i), 0.11, pz(i));
        soil.userData.plot = i;
        scene.add(soil);
        const rows = toonMesh([0, 1, 2].map((k) => part(box(1.1, 0.05, 0.12), '#5a3a20', [0, 0.24, -0.33 + k * 0.33])), { outline: false });
        rows.position.set(px(i), 0, pz(i));
        scene.add(rows);
        const crop = new THREE.Group();
        crop.position.set(px(i), 0.22, pz(i));
        crop.scale.setScalar(1.7);
        scene.add(crop);
        const lock = toonMesh([part(box(0.5, 0.4, 0.06), '#a07a4a', [0, 0.55, 0]), part(cyl(0.03, 0.03, 0.5, 6), '#7a5236', [0, 0.25, 0])], { outline: 0.01 });
        lock.position.set(px(i), 0.2, pz(i));
        scene.add(lock);
        plots.push({ soil, rows, crop, lock, key: '' });
    }
    const can = toonMesh([part(cyl(0.18, 0.22, 0.32, 12), '#5aa0d0', [0, 0, 0]), part(cyl(0.03, 0.05, 0.4, 6), '#5aa0d0', [0.25, 0.08, 0], [0, 0, -1.0]), part(tor(0.12, 0.025, 6, 12, Math.PI), '#3a7ab0', [0, 0.18, 0], [0, 0, 0])], { outline: 0.012 });
    can.visible = false;
    scene.add(can);

    const st = { scene, camera, fx, plots, farmers: [], time: 0, canT: 0 };

    st.sync = (plotState, unlocked, t) => {
        plots.forEach((P, i) => {
            const open = i < unlocked;
            const p = plotState[i];
            P.soil.visible = true;
            P.soil.material = toonMat({ vertexColors: true });
            P.rows.visible = open;
            P.lock.visible = !open;
            P.soil.scale.set(1, open ? 1 : 0.4, 1);
            let key = open ? 'empty' : 'locked', stage = -1;
            if (open && p && p.crop) {
                const f = Math.min(1, (t - p.plantedAt) / (p.readyAt - p.plantedAt));
                stage = f >= 1 ? 3 : Math.floor(f * 3);
                key = `${p.crop}:${stage}:${p.golden && stage >= 2 ? 1 : 0}`;
            }
            P.golden = !!(p && p.golden && stage >= 2);
            P.ready = stage === 3;
            if (key === P.key) return;
            P.key = key;
            P.crop.clear();
            if (stage >= 0) {
                const g = cropModel(p.crop, stage, p.golden);
                // a few copies per plot so it reads as a field
                const copies = [[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]];
                const geos = [];
                for (const [x, z] of copies) for (const gg of g) geos.push(gg.clone().translate(x / 1.7, 0, z / 1.7));
                if (geos.length) P.crop.add(toonMesh(geos, { outline: 0.006 }));
            }
        });
    };

    st.plotAt = (x, y) => {
        const hits = raycast(x, y, plots.flatMap((P) => [P.soil, P.crop, P.lock]), camera);
        for (const h of hits) {
            let o = h.object;
            while (o && o.userData.plot === undefined && o.parent) o = o.parent;
            if (o && o.userData.plot !== undefined) return o.userData.plot;
            const idx = plots.findIndex((P) => P.crop === o || P.lock === o || P.crop.children.includes(h.object) || P.lock === h.object);
            if (idx >= 0) return idx;
        }
        return null;
    };

    st.plotPos = (i, out = new THREE.Vector3()) => out.set(px(i), 0.9, pz(i));

    st.waterFx = (i) => {
        can.visible = true;
        st.canT = 0;
        st.canAt = new THREE.Vector3(px(i) - 0.35, 1.3, pz(i));
        for (let k = 0; k < 6; k++) setTimeout(() => fx.emit({ pos: new THREE.Vector3(px(i) + (Math.random() - 0.5) * 0.6, 1.0, pz(i) + (Math.random() - 0.5) * 0.5), count: 3, color: '#7ad0ff', color2: '#ffffff', speed: 0.3, gravity: -9, life: 0.5, size: 0.1 }), k * 70);
    };
    st.harvestFx = (i, golden) => {
        const p = st.plotPos(i);
        fx.burst(p, golden ? '#ffd24a' : '#8ad64a', 24, { speed: 3, size: 0.18 });
        if (golden) fx.pillar(p.clone().setY(0.2), '#ffd24a', { radius: 0.5, height: 3, dur: 0.8 });
    };
    st.plantFx = (i) => fx.burst(st.plotPos(i).setY(0.35), '#a07a4a', 12, { speed: 1.5, size: 0.12, gravity: -4 });

    st.setFarmers = (looks) => {
        for (const f of st.farmers) { scene.remove(f.rig.root); scene.remove(f.shadow); }
        st.farmers = looks.map((look, i) => {
            const rig = buildCharacter(look);
            const actor = new Actor(rig);
            actor.place(new THREE.Vector3(-2.4 + i * 1.6, 0, 3.9), Math.PI);
            const shadow = blobShadow(0.35, 0.3);
            scene.add(rig.root, shadow);
            return { rig, actor, shadow, wait: 1 + i };
        });
    };

    st.applyTime = () => {
        const hr = new Date().getHours();
        const night = hr < 6 || hr >= 20;
        setSky(sky, night ? '#0c1030' : '#6ab8ff', night ? '#2a2050' : '#e8f6ff', night ? '#5a3a7a' : '#fff0d0');
        lights.sun.intensity = night ? 0.7 : 2.1;
        lights.hemi.intensity = night ? 0.7 : 1.15;
        scene.fog.color.set(night ? '#1a1838' : '#cfeeff');
    };

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        camera.fov = portrait ? 50 : 38;
        camera.updateProjectionMatrix();
        if (portrait) { camera.position.set(0, 10.5, 8.2); camera.lookAt(0, 0, 0.2); }
        else { camera.position.set(0, 7.8, 8.4); camera.lookAt(0, 0, 0.3); }
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    st.update = (dt) => {
        st.time += dt;
        blades.rotation.z += dt * 0.8;
        for (const P of plots) {
            if (P.golden && Math.random() < dt * 4) fx.sparkle(P.crop.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.7)), '#ffd24a', 1);
            if (P.ready) P.crop.position.y = 0.22 + Math.abs(Math.sin(st.time * 3 + P.soil.position.x)) * 0.04;
        }
        if (can.visible) {
            st.canT += dt;
            can.position.copy(st.canAt);
            can.rotation.z = -Math.min(0.9, st.canT * 3);
            if (st.canT > 0.7) can.visible = false;
        }
        for (const f of st.farmers) {
            f.actor.update(dt);
            f.shadow.position.set(f.actor.root.position.x, 0.012, f.actor.root.position.z);
            if (!f.actor.walkTo) {
                f.wait -= dt;
                if (f.wait < 0) {
                    const to = new THREE.Vector3((Math.random() - 0.5) * 5, 0, 3.6 + Math.random() * 0.8);
                    f.actor.walk(to, 0.9).then(() => { f.wait = 2 + Math.random() * 3; });
                }
            }
        }
        fx.update(dt);
    };
    st.frame();
    st.applyTime();
    return st;
}
