/**
 * citadel.js — the hub: a floating island citadel with every building,
 * the Overlord on a dais, wandering heroes, a waterfall, day/night from the
 * local clock, and the Endless Spire and Arena on their own islets.
 */

import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { skyDome, setSky, blobShadow, standardLights, size, raycast } from './engine.js';
import { toonMat, toonMesh, part, glowMat, merge, paint, paintGradient, jitterColor, shade, mix, disposeObject } from './toon.js';
import { cyl, cone, box, tor, sph, taper } from './chars.js';
import { makeProp, groundDisc, rockGeo } from './props.js';
import { buildCharacter } from './chars.js';
import { Actor } from './anim.js';
import { createFx } from './fx.js';
import { runeTexture } from './showcase.js';
import { CROPS } from '../data/items.js';

const PI = Math.PI;

// ---------------------------------------------------------------- island

function islandMesh(rng) {
    const grp = new THREE.Group();
    const R = 8.2;
    const top = groundDisc(R, '#7ccf52', '#5aaa3e', 7, 72);
    grp.add(new THREE.Mesh(top, toonMat({ vertexColors: true, steps: 4 })));
    // dirt rim
    const rim = new THREE.CylinderGeometry(R, R * 0.97, 0.7, 72, 2, true);
    rim.translate(0, -0.35, 0);
    paintGradient(rim, '#5a3a24', '#8a5a34', 1);
    grp.add(new THREE.Mesh(rim, toonMat({ vertexColors: true })));
    // grass lip
    grp.add(toonMesh([part(tor(R, 0.12, 6, 72), '#6ac04a', [0, 0.0, 0], [PI / 2, 0, 0])], { outline: false }));
    // rocky underside
    const under = new THREE.ConeGeometry(R * 0.97, 7.5, 40, 8, true);
    under.rotateX(PI);
    under.translate(0, -0.7 - 3.75, 0);
    const p = under.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 + (rng.next() - 0.5) * 0.22 * Math.min(1, (-y - 0.7) / 2);
        p.setXYZ(i, p.getX(i) * k, y + (rng.next() - 0.5) * 0.3, p.getZ(i) * k);
    }
    under.computeVertexNormals();
    paintGradient(under, '#3a3040', '#7a5a44', 1, -8.2, -0.7, 0.8);
    jitterColor(under, 0.08, 3);
    grp.add(toonMesh(under, { outline: 0.03 }));
    // crystals under the island
    const cr = [];
    for (let i = 0; i < 9; i++) {
        const a = rng.range(0, PI * 2), r = rng.range(2.5, 6), y = -1.5 - (6 - r) * 0.9;
        cr.push(part(paintGradient(new THREE.OctahedronGeometry(0.4), '#7a4aff', '#c8f0ff', 1), null, [Math.cos(a) * r, y, Math.sin(a) * r], [rng.range(-0.5, 0.5), a, PI + rng.range(-0.4, 0.4)], [0.6, rng.range(1.6, 2.8), 0.6]));
    }
    grp.add(new THREE.Mesh(merge(cr), glowMat()));
    // hanging roots / vines
    const vines = [];
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2 + rng.range(-0.1, 0.1), r = R * 0.96;
        vines.push(paint(taper([[Math.cos(a) * r, -0.3, Math.sin(a) * r], [Math.cos(a) * r * 1.01, -1.2, Math.sin(a) * r * 1.01], [Math.cos(a) * r * 0.98, -1.8 - rng.range(0, 1.2), Math.sin(a) * r * 0.98]], 0.06, 0.02, 8, 5), '#4a8a3a'));
    }
    grp.add(toonMesh(vines, { outline: false }));
    return grp;
}

function path(from, to, w = 0.7) {
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    const g = new THREE.PlaneGeometry(w, len, 1, Math.ceil(len * 2));
    g.rotateX(-PI / 2);
    paint(g, '#d8c8a0');
    jitterColor(g, 0.07, Math.floor(len * 100));
    const m = new THREE.Mesh(g, toonMat({ vertexColors: true }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.position.y = 0.012;
    m.rotation.y = Math.atan2(d.x, d.z);
    return m;
}

// ---------------------------------------------------------------- buildings

function roof(w, d, h, color) {
    const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1);
    g.rotateY(PI / 4);
    g.scale(w * 0.75, h, d * 0.75);
    paintGradient(g, shade(color, -0.2), shade(color, 0.15), 1);
    return g;
}

const BUILD = {
    keep(theme) {
        const stone = '#d8cfc0', roofC = '#5a4aa8', trim = '#e8c060';
        const geos = [
            part(box(3.0, 1.9, 1.8), stone, [0, 0.95, 0]),
            part(box(3.2, 0.25, 2.0), shade(stone, -0.12), [0, 1.95, 0]),
            part(roof(3.4, 2.2, 1.3, roofC), null, [0, 2.7, 0]),
            part(box(0.8, 1.2, 0.1), '#5a3a24', [0, 0.6, 0.91]),
            part(cyl(0.4, 0.4, 0.1, 16, false), '#5a3a24', [0, 1.2, 0.91], [PI / 2, 0, 0], [1, 1, 1]),
            part(box(0.1, 1.25, 0.12), trim, [0, 0.62, 0.95]),
        ];
        for (const s of [-1, 1]) {
            geos.push(part(cyl(0.55, 0.62, 3.0, 14), stone, [s * 1.75, 1.5, 0.1]));
            geos.push(part(paintGradient(cone(0.8, 1.5, 14), shade(roofC, -0.2), shade(roofC, 0.2), 1), null, [s * 1.75, 3.75, 0.1]));
            geos.push(part(tor(0.6, 0.06, 6, 20), trim, [s * 1.75, 3.0, 0.1], [PI / 2, 0, 0]));
            for (let i = 0; i < 3; i++) geos.push(part(box(0.18, 0.35, 0.08), '#2a2040', [s * 1.75 + (i - 1) * 0.0, 1.2 + i * 0.6, 0.72]));
        }
        for (let i = 0; i < 5; i++) geos.push(part(box(0.28, 0.28, 0.28), stone, [-1.2 + i * 0.6, 2.2, 0.85]));
        const m = toonMesh(geos, { outline: 0.03 });
        const grp = new THREE.Group(); grp.add(m);
        // banners
        for (const s of [-1, 1]) {
            const b = new THREE.Mesh(paintGradient(new THREE.PlaneGeometry(0.42, 1.0, 1, 4), theme, shade(theme, -0.3), 1), toonMat({ vertexColors: true, side: THREE.DoubleSide }));
            b.position.set(s * 0.95, 1.25, 0.93);
            grp.add(b);
            grp.add(new THREE.Mesh(merge([part(sph(0.07, 8, 6), '#ffe08a', [s * 0.95, 1.35, 0.95])]), glowMat()));
        }
        // windows glow
        grp.add(new THREE.Mesh(merge([part(box(0.3, 0.45, 0.02), '#ffd88a', [-0.8, 1.2, 0.91]), part(box(0.3, 0.45, 0.02), '#ffd88a', [0.8, 1.2, 0.91])]), glowMat()));
        grp.userData.windows = grp.children[grp.children.length - 1];
        return grp;
    },
    summoning() {
        const grp = new THREE.Group();
        grp.add(toonMesh([
            part(paintGradient(cyl(1.5, 1.65, 0.25, 40), '#8a80a8', '#c8c0e0', 1), null, [0, 0.12, 0]),
            part(tor(1.5, 0.06, 6, 48), '#e8c060', [0, 0.25, 0], [PI / 2, 0, 0]),
            ...Array.from({ length: 4 }, (_, i) => { const a = (i / 4) * PI * 2 + PI / 4; return part(cyl(0.12, 0.16, 1.2, 8), '#c8c0e0', [Math.cos(a) * 1.55, 0.6, Math.sin(a) * 1.55]); }),
        ], { outline: 0.025 }));
        const rune = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshBasicMaterial({ map: runeTexture('#bfe8ff'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, color: '#9ad8ff' }));
        rune.rotation.x = -PI / 2; rune.position.y = 0.26;
        grp.add(rune);
        const crystals = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * PI * 2 + PI / 4;
            const c = new THREE.Mesh(paintGradient(new THREE.OctahedronGeometry(0.16), '#7a8aff', '#e0f6ff', 1), glowMat());
            c.position.set(Math.cos(a) * 1.55, 1.45, Math.sin(a) * 1.55);
            c.scale.set(1, 1.6, 1);
            crystals.add(c);
        }
        const core = new THREE.Mesh(paintGradient(new THREE.OctahedronGeometry(0.32), '#8a6aff', '#ffffff', 1), glowMat());
        core.position.y = 1.4; core.scale.set(1, 1.5, 1);
        crystals.add(core);
        grp.add(crystals);
        grp.userData.spin = [rune, crystals];
        return grp;
    },
    treasury() {
        const g = [
            part(cyl(1.0, 1.1, 1.3, 20), '#d8cfc0', [0, 0.65, 0]),
            part(new THREE.SphereGeometry(1.05, 20, 10, 0, PI * 2, 0, PI / 2), '#ffcf4a', [0, 1.3, 0]),
            part(cone(0.12, 0.5, 8), '#ffcf4a', [0, 2.55, 0]),
            part(tor(1.05, 0.07, 6, 28), '#a8741c', [0, 1.3, 0], [PI / 2, 0, 0]),
            part(box(0.6, 0.9, 0.1), '#6a4a2a', [0, 0.45, 1.05]),
            part(tor(0.12, 0.03, 6, 12), '#ffd24a', [0, 0.5, 1.12]),
        ];
        for (let i = 0; i < 9; i++) g.push(part(cyl(0.13, 0.13, 0.05, 10), '#ffd24a', [0.9 + (i % 3) * 0.12, 0.03 + Math.floor(i / 3) * 0.06, 0.8 + (i % 2) * 0.1]));
        g.push(part(box(0.5, 0.3, 0.35), '#a06a2a', [-1.0, 0.15, 0.8]), part(box(0.52, 0.06, 0.37), '#ffd24a', [-1.0, 0.3, 0.8]));
        return toonMesh(g, { outline: 0.025 });
    },
    mine(rng) {
        const grp = new THREE.Group();
        const rocks = [];
        for (let i = 0; i < 6; i++) rocks.push(part(rockGeo(rng, rng.range(0.6, 1.0), '#8a7a6a'), null, [rng.range(-1, 1), rng.range(0.2, 0.6), rng.range(-1, 0)]));
        rocks.push(part(rockGeo(rng, 1.3, '#7a6a5a'), null, [0, 0.7, -0.4]));
        grp.add(toonMesh(rocks, { outline: 0.03 }));
        grp.add(toonMesh([
            part(box(0.15, 1.2, 0.15), '#7a5236', [-0.55, 0.6, 0.75]), part(box(0.15, 1.2, 0.15), '#7a5236', [0.55, 0.6, 0.75]), part(box(1.3, 0.15, 0.18), '#7a5236', [0, 1.2, 0.75]),
            part(box(0.08, 0.04, 2.0), '#6a6a72', [-0.25, 0.04, 1.6]), part(box(0.08, 0.04, 2.0), '#6a6a72', [0.25, 0.04, 1.6]),
            ...Array.from({ length: 6 }, (_, i) => part(box(0.75, 0.04, 0.12), '#6a4a32', [0, 0.02, 0.8 + i * 0.32])),
            part(box(0.7, 0.4, 0.55), '#5a5a62', [0, 0.32, 1.9]), part(box(0.6, 0.12, 0.45), '#c88a4a', [0, 0.55, 1.9]),
            ...[[-0.3, 1.7], [0.3, 1.7], [-0.3, 2.1], [0.3, 2.1]].map(([x, z]) => part(cyl(0.1, 0.1, 0.06, 10), '#2a2a32', [x * 1.2, 0.1, z], [0, 0, PI / 2])),
        ], { outline: 0.015 }));
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20, 0, PI), new THREE.MeshBasicMaterial({ color: '#0a0610' }));
        hole.position.set(0, 0.0, 0.72);
        grp.add(hole);
        grp.add(new THREE.Mesh(merge([part(sph(0.07, 8, 6), '#ffd08a', [0.55, 1.05, 0.88])]), glowMat()));
        return grp;
    },
    farm() {
        const grp = new THREE.Group();
        const g = [];
        for (let i = 0; i < 5; i++) { g.push(part(box(0.06, 0.4, 0.06), '#a07a4a', [-1.9 + i * 0.95, 0.2, -1.6]), part(box(0.06, 0.4, 0.06), '#a07a4a', [-1.9 + i * 0.95, 0.2, 1.6])); }
        g.push(part(box(3.8, 0.05, 0.04), '#a07a4a', [0, 0.3, -1.6]), part(box(3.8, 0.05, 0.04), '#a07a4a', [0, 0.3, 1.6]), part(box(0.04, 0.05, 3.2), '#a07a4a', [-1.9, 0.3, 0]), part(box(0.04, 0.05, 3.2), '#a07a4a', [1.9, 0.3, 0]));
        // scarecrow
        g.push(part(cyl(0.04, 0.04, 1.3, 6), '#7a5236', [2.3, 0.65, -1.2]), part(box(0.9, 0.06, 0.06), '#7a5236', [2.3, 1.0, -1.2]), part(sph(0.18, 10, 8), '#f0d890', [2.3, 1.35, -1.2]), part(cone(0.3, 0.3, 10), '#c84a3a', [2.3, 1.55, -1.2]), part(box(0.45, 0.5, 0.2), '#4a7ad0', [2.3, 0.95, -1.2]));
        grp.add(toonMesh(g, { outline: 0.012 }));
        grp.userData.plots = [];
        for (let i = 0; i < 12; i++) {
            const x = -1.35 + (i % 4) * 0.9, z = -1.05 + Math.floor(i / 4) * 1.05;
            const soil = new THREE.Mesh(paint(box(0.72, 0.12, 0.82), '#6a4428'), toonMat({ vertexColors: true }));
            soil.position.set(x, 0.06, z);
            grp.add(soil);
            const crop = new THREE.Group(); crop.position.set(x, 0.12, z);
            grp.add(crop);
            grp.userData.plots.push({ soil, crop, key: '' });
        }
        return grp;
    },
    forge() {
        const grp = new THREE.Group();
        grp.add(toonMesh([
            part(box(2.0, 1.3, 1.6), '#a8a0a0', [0, 0.65, 0]),
            part(roof(2.3, 1.9, 0.9, '#8a3a2a'), null, [0, 1.75, 0]),
            part(box(0.5, 2.6, 0.5), '#8a8080', [0.6, 1.3, -0.4]),
            part(box(0.62, 0.12, 0.62), '#6a6060', [0.6, 2.62, -0.4]),
            part(box(0.5, 0.45, 0.35), '#4a4a52', [-0.9, 0.25, 1.15]), part(box(0.7, 0.12, 0.3), '#5a5a62', [-0.9, 0.52, 1.15]),
            part(box(0.08, 0.3, 0.08), '#6a4a2a', [-0.65, 0.7, 1.2], [0, 0, 0.7]),
        ], { outline: 0.025 }));
        const fire = new THREE.Mesh(merge([part(box(0.8, 0.6, 0.02), '#ff8a2a', [0, 0.45, 0.81]), part(box(0.5, 0.3, 0.02), '#ffe04a', [0, 0.35, 0.82])]), glowMat());
        grp.add(fire);
        grp.userData.chimney = new THREE.Vector3(0.6, 2.8, -0.4);
        grp.userData.glow = fire;
        return grp;
    },
    tavern() {
        const grp = new THREE.Group();
        const wood = '#7a5236';
        grp.add(toonMesh([
            part(box(2.2, 1.1, 1.6), '#f0e4c8', [0, 0.55, 0]),
            part(box(2.3, 0.9, 1.7), '#e8d8b8', [0, 1.55, 0]),
            part(roof(2.6, 2.0, 1.0, '#3a6a9a'), null, [0, 2.45, 0]),
            ...[-1.1, -0.35, 0.35, 1.1].map((x) => part(box(0.1, 2.0, 0.1), wood, [x, 1.0, 0.82])),
            part(box(2.3, 0.1, 0.1), wood, [0, 1.1, 0.83]),
            part(box(0.6, 0.85, 0.1), '#5a3a24', [0, 0.42, 0.82]),
            part(box(0.06, 0.6, 0.06), wood, [1.25, 1.4, 0.95], [0, 0, 0]), part(box(0.5, 0.06, 0.06), wood, [1.45, 1.7, 0.95]),
            part(box(0.5, 0.36, 0.05), '#c8a04a', [1.5, 1.45, 0.95]),
        ], { outline: 0.025 }));
        grp.add(new THREE.Mesh(merge([part(box(0.35, 0.35, 0.02), '#ffd88a', [-0.7, 1.55, 0.86]), part(box(0.35, 0.35, 0.02), '#ffd88a', [0.7, 1.55, 0.86]), part(box(0.3, 0.3, 0.02), '#ffd88a', [-0.7, 0.6, 0.81])]), glowMat()));
        return grp;
    },
    training() {
        const g = [];
        for (let i = 0; i < 3; i++) {
            const x = -1 + i;
            g.push(part(cyl(0.06, 0.06, 1.0, 6), '#7a5236', [x, 0.5, 0]), part(cyl(0.2, 0.22, 0.6, 10), '#d8b878', [x, 0.9, 0]), part(sph(0.17, 10, 8), '#d8b878', [x, 1.35, 0]), part(box(0.8, 0.07, 0.07), '#7a5236', [x, 1.05, 0]), part(tor(0.2, 0.025, 4, 12), '#c84a4a', [x, 0.95, 0], [PI / 2, 0, 0]));
        }
        g.push(part(box(1.4, 0.08, 0.15), '#7a5236', [0, 0.9, -1]), part(box(0.08, 0.9, 0.08), '#7a5236', [-0.65, 0.45, -1]), part(box(0.08, 0.9, 0.08), '#7a5236', [0.65, 0.45, -1]));
        for (let i = 0; i < 4; i++) g.push(part(box(0.05, 1.1, 0.02), '#c8d0dc', [-0.45 + i * 0.3, 0.7, -0.95], [0, 0, 0.15]));
        g.push(part(new THREE.CircleGeometry(1.8, 24), '#c8b088', [0, 0.015, -0.2], [-PI / 2, 0, 0]));
        return toonMesh(g, { outline: 0.015 });
    },
    market() {
        const grp = new THREE.Group();
        const cols = [['#e84a4a', '#fff4e0'], ['#4a7ae8', '#fff4e0'], ['#4ab86a', '#fff4e0']];
        cols.forEach(([a, b], i) => {
            const x = (i - 1) * 1.15;
            const g = [part(box(0.95, 0.5, 0.6), '#a07a4a', [x, 0.25, 0]), part(box(0.06, 1.1, 0.06), '#7a5236', [x - 0.42, 0.55, 0.28]), part(box(0.06, 1.1, 0.06), '#7a5236', [x + 0.42, 0.55, 0.28])];
            for (let k = 0; k < 4; k++) g.push(part(box(0.26, 0.04, 0.8), k % 2 ? a : b, [x - 0.39 + k * 0.26, 1.15, 0.05], [0.25, 0, 0]));
            for (let k = 0; k < 3; k++) g.push(part(sph(0.09, 8, 6), ['#ff8a3a', '#ffd04a', '#8ad64a', '#c84aff'][(i + k) % 4], [x - 0.25 + k * 0.25, 0.56, 0.05]));
            grp.add(toonMesh(g, { outline: 0.015 }));
        });
        return grp;
    },
    spire() {
        const grp = new THREE.Group();
        const rng = new Rng(9);
        const rock = [];
        for (let i = 0; i < 5; i++) rock.push(part(rockGeo(rng, rng.range(1.2, 1.8), '#6a5a7a'), null, [rng.range(-0.8, 0.8), rng.range(-1.5, -0.3), rng.range(-0.8, 0.8)]));
        rock.push(part(paintGradient(cone(2.2, 5, 10), '#3a3048', '#6a5a7a', 1), null, [0, -3.2, 0], [PI, 0, 0]));
        grp.add(toonMesh(rock, { outline: 0.04 }));
        const tower = [];
        for (let i = 0; i < 9; i++) {
            const r = 1.0 - i * 0.06;
            tower.push(part(cyl(r * 0.92, r, 1.6, 12), i % 2 ? '#d8d0f0' : '#c8bce8', [0, i * 1.6 + 0.8, 0]));
            tower.push(part(tor(r * 0.98, 0.07, 6, 18), '#e8c060', [0, i * 1.6 + 1.6, 0], [PI / 2, 0, 0]));
        }
        tower.push(part(paintGradient(cone(0.75, 2.6, 12), '#5a4aa8', '#9a8aff', 1), null, [0, 9 * 1.6 + 1.3, 0]));
        grp.add(toonMesh(tower, { outline: 0.04 }));
        const wins = [];
        for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) { const a = k * 2.1 + i * 0.5; wins.push(part(box(0.18, 0.35, 0.05), '#ffe08a', [Math.sin(a) * (0.95 - i * 0.055), i * 1.6 + 0.9, Math.cos(a) * (0.95 - i * 0.055)], [0, a, 0])); }
        grp.add(new THREE.Mesh(merge(wins), glowMat()));
        const top = new THREE.Mesh(paintGradient(new THREE.OctahedronGeometry(0.5), '#c8a0ff', '#ffffff', 1), glowMat());
        top.position.y = 9 * 1.6 + 3.2; top.scale.set(1, 1.6, 1);
        grp.add(top);
        grp.userData.beacon = top;
        return grp;
    },
    arena() {
        const grp = new THREE.Group();
        const rng = new Rng(4);
        const rock = [];
        for (let i = 0; i < 6; i++) rock.push(part(rockGeo(rng, rng.range(1.2, 1.8), '#7a6a5a'), null, [rng.range(-1.6, 1.6), rng.range(-1.2, -0.4), rng.range(-1.6, 1.6)]));
        grp.add(toonMesh(rock, { outline: 0.04 }));
        const ring = [part(cyl(2.4, 2.4, 0.15, 32), '#c8b088', [0, 0.07, 0])];
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * PI * 2;
            ring.push(part(box(0.9, 1.4, 0.4), '#d8cfc0', [Math.cos(a) * 2.6, 0.7, Math.sin(a) * 2.6], [0, -a + PI / 2, 0]));
            if (i % 2) ring.push(part(box(0.5, 0.7, 0.42), '#3a2a20', [Math.cos(a) * 2.6, 0.35, Math.sin(a) * 2.6], [0, -a + PI / 2, 0]));
        }
        ring.push(part(tor(2.65, 0.12, 6, 40), '#e8c060', [0, 1.45, 0], [PI / 2, 0, 0]));
        grp.add(toonMesh(ring, { outline: 0.03 }));
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * PI * 2 + 0.4;
            const f = new THREE.Mesh(paintGradient(new THREE.PlaneGeometry(0.5, 0.8), '#c84a4a', '#ff8a5a', 1), toonMat({ vertexColors: true, side: THREE.DoubleSide }));
            f.position.set(Math.cos(a) * 2.6, 2.1, Math.sin(a) * 2.6);
            grp.add(f);
            grp.add(toonMesh([part(cyl(0.03, 0.03, 1.4, 6), '#5a4a3a', [Math.cos(a) * 2.6 - 0.25, 2.0, Math.sin(a) * 2.6])], { outline: false }));
        }
        return grp;
    },
};

function cropModel(id, stage, golden) {
    const C = CROPS[id];
    const grp = [];
    const leaf = '#4fae3a';
    if (stage === 0) { grp.push(part(cone(0.04, 0.12, 5), leaf, [0, 0.06, 0]), part(cone(0.04, 0.1, 5), leaf, [0.06, 0.05, 0.03], [0, 0, -0.5])); return grp; }
    if (stage === 1) { for (let i = 0; i < 3; i++) grp.push(part(sph(0.08, 6, 5), leaf, [Math.cos(i * 2.1) * 0.08, 0.1, Math.sin(i * 2.1) * 0.08], [0, 0, 0], [0.7, 1.4, 0.4])); return grp; }
    const col = golden ? '#ffd24a' : C.color;
    const full = stage >= 3;
    switch (id) {
        case 'wheat': for (let i = 0; i < 6; i++) { const x = (i % 3 - 1) * 0.15, z = (Math.floor(i / 3) - 0.5) * 0.2; grp.push(part(cyl(0.012, 0.012, 0.4, 4), '#c8b050', [x, 0.2, z]), part(sph(0.04, 6, 4), full ? col : '#b8c060', [x, 0.42, z], [0, 0, 0], [0.8, 2.2, 0.8])); } break;
        case 'carrot': for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.24, z = (Math.floor(i / 2) - 0.5) * 0.28; grp.push(part(cone(0.06, 0.2, 5), leaf, [x, 0.12, z]), full ? part(cone(0.05, 0.14, 8), col, [x, 0.03, z], [PI, 0, 0]) : null); } break;
        case 'pumpkin': grp.push(part(sph(full ? 0.2 : 0.12, 14, 10), full ? col : '#8ac04a', [0, 0.14, 0], [0, 0, 0], [1.2, 0.85, 1.2]), part(cyl(0.02, 0.03, 0.08, 6), '#4a7a2a', [0, 0.32, 0]), part(sph(0.1, 6, 5), leaf, [0.2, 0.06, 0.15], [0, 0, 0], [1.2, 0.3, 1])); break;
        case 'sunberry': grp.push(part(sph(0.2, 10, 8), leaf, [0, 0.2, 0])); if (full) for (let i = 0; i < 7; i++) grp.push(part(sph(0.045, 6, 5), col, [Math.cos(i) * 0.17, 0.2 + Math.sin(i * 2) * 0.1, Math.sin(i) * 0.17])); break;
        case 'moonbloom': grp.push(part(cyl(0.015, 0.015, 0.35, 4), leaf, [0, 0.17, 0])); for (let i = 0; i < 5; i++) grp.push(part(sph(0.06, 6, 5), full ? col : '#c8d0e0', [Math.cos(i * 1.26) * 0.07, 0.38, Math.sin(i * 1.26) * 0.07], [0, 0, 0], [1, 0.4, 1.6])); break;
        case 'dragonfruit': grp.push(part(cyl(0.05, 0.07, 0.3, 6), '#4a9a5a', [0, 0.15, 0])); if (full) grp.push(part(sph(0.12, 10, 8), col, [0, 0.38, 0], [0, 0, 0], [1, 1.3, 1]), ...Array.from({ length: 5 }, (_, i) => part(cone(0.03, 0.08, 4), '#7ad06a', [Math.cos(i * 1.26) * 0.1, 0.4, Math.sin(i * 1.26) * 0.1], [Math.sin(i * 1.26) * 1.2, 0, -Math.cos(i * 1.26) * 1.2]))); break;
        case 'starmelon': grp.push(part(sph(0.1, 6, 5), leaf, [0.15, 0.05, 0.1], [0, 0, 0], [1.4, 0.3, 1])); if (full) grp.push(part(sph(0.18, 14, 10), col, [0, 0.16, 0], [0, 0, 0], [1.25, 1, 1])); break;
        default: grp.push(part(sph(0.1, 8, 6), leaf, [0, 0.1, 0]));
    }
    return grp.filter(Boolean);
}
export { cropModel };

// ---------------------------------------------------------------- the stage

export const BUILDING_SPOTS = {
    keep:      { pos: [0, 0, -4.2], label: 'Throne Keep', icon: 'crown', screen: 'overlord', h: 4.6 },
    summoning: { pos: [0, 0, 2.6], label: 'Summoning Circle', icon: 'summon', screen: 'summon', h: 1.9 },
    treasury:  { pos: [-4.4, 0, -1.4], label: 'Treasury', icon: 'chest', screen: 'treasury', h: 2.9 },
    mine:      { pos: [-5.3, 0, 2.4], label: 'Mine', icon: 'pick', screen: 'mine', h: 2.3, rot: 0.9 },
    farm:      { pos: [4.6, 0, 2.6], label: 'Farm', icon: 'seed', screen: 'farm', h: 1.8, rot: -0.3 },
    forge:     { pos: [5.0, 0, -1.6], label: 'Forge', icon: 'hammer', screen: 'forge', h: 2.9, rot: -0.6 },
    tavern:    { pos: [-2.6, 0, -5.6], label: 'Tavern', icon: 'map', screen: 'tavern', h: 3.0, rot: 0.25 },
    training:  { pos: [2.9, 0, -5.4], label: 'Training Grounds', icon: 'sword', screen: 'training', h: 1.8, rot: -0.25 },
    market:    { pos: [-3.0, 0, 5.4], label: 'Market', icon: 'gold', screen: 'market', h: 1.6, rot: 0.45 },
    spire:     { pos: [11.5, -2, -10], label: 'Endless Spire', icon: 'spire', screen: 'spire', h: 19.5, far: true },
    arena:     { pos: [-12, -1.5, -8], label: 'Arena', icon: 'arena', screen: 'arena', h: 2.6, far: true },
};

export function createCitadel() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#bfe6ff', 48, 130);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    const sky = skyDome('#6ab8ff', '#dff4ff', '#fff0d0', 200);
    scene.add(sky);
    const lights = standardLights(scene, { sunPos: [8, 14, 6] });
    const fx = createFx(scene);
    const rng = new Rng(2026);

    const world = new THREE.Group();
    scene.add(world);
    world.add(islandMesh(rng));

    const st = { scene, camera, fx, buildings: {}, heroes: [], az: 0.0, azVel: 0, dist: 1, time: 0, overlord: null, nightK: 0, theme: '#7a4aff' };

    // paths from the plaza
    const plaza = new THREE.Mesh(groundDisc(1.9, '#e0d0a8', '#c8b890', 3, 32), toonMat({ vertexColors: true }));
    plaza.position.set(0, 0.008, -0.6);
    world.add(plaza);
    for (const k of ['keep', 'summoning', 'treasury', 'mine', 'farm', 'forge', 'tavern', 'training', 'market']) {
        const p = BUILDING_SPOTS[k].pos;
        world.add(path(new THREE.Vector3(0, 0, -0.6), new THREE.Vector3(p[0] * 0.85, 0, p[2] * 0.85)));
    }
    // buildings
    for (const [id, spot] of Object.entries(BUILDING_SPOTS)) {
        const make = id === 'keep' ? () => BUILD.keep('#7a4aff') : BUILD[id];
        const b = make(rng);
        b.position.set(...spot.pos);
        b.rotation.y = spot.rot || 0;
        b.userData.building = id;
        world.add(b);
        st.buildings[id] = b;
        if (!spot.far) { const sh = blobShadow(1.8, 0.25); sh.position.set(spot.pos[0], 0.01, spot.pos[2]); world.add(sh); }
    }
    // the Overlord's dais
    const dais = toonMesh([part(cyl(0.55, 0.65, 0.3, 20), '#c8c0e0', [0, 0.15, 0]), part(tor(0.56, 0.04, 6, 24), '#e8c060', [0, 0.3, 0], [PI / 2, 0, 0])], { outline: 0.02 });
    dais.position.set(0, 0, -2.2);
    world.add(dais);

    // scenery
    const scenery = [];
    for (let i = 0; i < 42; i++) {
        const a = rng.range(0, PI * 2), r = rng.range(6.2, 7.8);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z > 5.0 && Math.abs(x) < 3) continue;
        const kind = rng.pick(['tree', 'tree', 'pine', 'bush', 'rock', 'flower', 'flower']);
        const m = makeProp(kind, rng.seed(), {});
        m.position.set(x, 0, z);
        m.rotation.y = rng.range(0, PI * 2);
        m.scale.setScalar(rng.range(0.8, 1.25));
        world.add(m);
    }
    for (let i = 0; i < 14; i++) {
        const a = rng.range(0, PI * 2), r = rng.range(1.5, 6);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Object.values(BUILDING_SPOTS).some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 2.2)) continue;
        const m = makeProp(rng.pick(['flower', 'bush', 'rock']), rng.seed(), {});
        m.position.set(x, 0, z); m.scale.setScalar(0.8);
        world.add(m);
    }
    // lanterns along the main path
    const lamps = [];
    for (const [x, z] of [[-1.1, 1.0], [1.1, 1.0], [-1.1, -2.6], [1.1, -2.6], [-2.4, -0.2], [2.4, -0.2]]) {
        const l = makeProp('lantern', 1, {});
        l.position.set(x, 0, z);
        world.add(l);
        l.traverse((o) => { if (o.userData.lamp) lamps.push(o); });
    }
    st.lamps = lamps;
    const nightLights = [new THREE.PointLight('#ffb860', 0, 7, 1.5), new THREE.PointLight('#ffb860', 0, 7, 1.5), new THREE.PointLight('#9ad8ff', 0, 6, 1.5)];
    nightLights[0].position.set(-1.1, 1.3, 1.0); nightLights[1].position.set(1.1, 1.3, -2.6); nightLights[2].position.set(0, 1.5, 2.6);
    nightLights.forEach((l) => world.add(l));
    // waterfall off the front-right edge
    const wtex = (() => {
        const c = document.createElement('canvas'); c.width = 32; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#7ad0ff'; g.fillRect(0, 0, 32, 128);
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; g.fillRect(Math.random() * 32, Math.random() * 128, 2 + Math.random() * 3, 10 + Math.random() * 30); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })();
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 9, 1, 1), new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.85 }));
    fall.position.set(6.4, -4.4, 5.2);
    fall.rotation.y = -0.85;
    world.add(fall);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ map: wtex, color: '#bfefff' }));
    pond.rotation.x = -PI / 2; pond.position.set(6.0, 0.02, 4.7);
    world.add(pond);
    world.add(toonMesh([part(tor(1.1, 0.14, 6, 24), '#9a9aa8', [6.0, 0.03, 4.7], [PI / 2, 0, 0])], { outline: 0.015 }));
    st.water = wtex;

    // clouds and distant islets
    const clouds = new THREE.Group();
    for (let i = 0; i < 14; i++) {
        const c = makeProp('cloud', 100 + i, {});
        const a = (i / 14) * PI * 2, r = rng.range(16, 34);
        c.position.set(Math.cos(a) * r, rng.range(-9, 4), Math.sin(a) * r);
        c.scale.setScalar(rng.range(1.2, 2.6));
        c.userData.drift = rng.range(0.02, 0.06);
        clouds.add(c);
    }
    scene.add(clouds);
    st.clouds = clouds;
    for (let i = 0; i < 5; i++) {
        const isl = new THREE.Group();
        const r2 = new Rng(500 + i);
        isl.add(toonMesh([part(paintGradient(cone(1.4, 2.6, 8), '#4a3a40', '#7a5a44', 1), null, [0, -1.3, 0], [PI, 0, 0]), part(groundDisc(1.45, '#7ccf52', '#5aaa3e', i, 16), null, [0, 0, 0])], { outline: 0.03 }));
        const t = makeProp(r2.pick(['tree', 'pine', 'rock']), r2.seed(), {});
        isl.add(t);
        const a = -PI / 2 + (i - 2) * 0.55;
        isl.position.set(Math.cos(a) * 26, rng.range(-6, 3), Math.sin(a) * 26 - 4);
        isl.scale.setScalar(rng.range(0.8, 1.4));
        scene.add(isl);
    }
    // stars for the night
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
        const u = rng.next() * 2 - 1, th = rng.next() * PI * 2;
        const y = Math.abs(u) * 0.9 + 0.1;
        sp[i * 3] = Math.cos(th) * Math.sqrt(1 - y * y) * 180; sp[i * 3 + 1] = y * 180; sp[i * 3 + 2] = Math.sin(th) * Math.sqrt(1 - y * y) * 180;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(stars);
    fx.ambient('pollen', { w: 14, h: 3, d: 14, y: 0.2, z: 0 });

    // ---------------------------------------------------------------- api
    st.setOverlord = (look) => {
        if (st.overlord) { world.remove(st.overlord.rig.root); disposeObject(st.overlord.rig.root); st.overlord = null; }
        if (!look) return;
        const rig = buildCharacter(look);
        rig.root.scale.setScalar(1.15);
        const actor = new Actor(rig);
        actor.place(new THREE.Vector3(0, 0.3, -2.2), 0);
        world.add(rig.root);
        st.overlord = { rig, actor };
    };

    const WAYPOINTS = [[-1.5, 0.5], [1.5, 0.5], [0, -1.2], [-2.8, -1.8], [2.8, -1.8], [-3.6, 1.6], [3.2, 1.2], [-1.4, 3.8], [1.6, 4.2], [0, -3.0], [-1.6, -3.4], [1.8, -3.2]];
    st.setHeroes = (looks) => {
        for (const h of st.heroes) { world.remove(h.rig.root); world.remove(h.shadow); disposeObject(h.rig.root); disposeObject(h.shadow); }
        st.heroes = [];
        looks.slice(0, 6).forEach((look, i) => {
            const rig = buildCharacter(look);
            const actor = new Actor(rig);
            const w = WAYPOINTS[(i * 3) % WAYPOINTS.length];
            actor.place(new THREE.Vector3(w[0], 0, w[1]), rng.range(0, PI * 2));
            const shadow = blobShadow(0.38, 0.3);
            world.add(rig.root, shadow);
            const h = { rig, actor, shadow, wait: rng.range(0, 3), look };
            st.heroes.push(h);
        });
    };

    st.syncFarm = (plots, t) => {
        const F = st.buildings.farm.userData.plots;
        F.forEach((slot, i) => {
            const p = plots[i];
            const unlocked = !!p;
            slot.soil.visible = unlocked;
            let key = 'none';
            let stage = -1;
            if (p && p.crop) {
                const f = Math.min(1, (t - p.plantedAt) / (p.readyAt - p.plantedAt));
                stage = f >= 1 ? 3 : Math.floor(f * 3);
                key = `${p.crop}:${stage}:${p.golden && stage >= 2 ? 1 : 0}`;
            }
            if (key === slot.key) return;
            slot.key = key;
            disposeObject(slot.crop);
            slot.crop.clear();
            if (stage >= 0) {
                const g = cropModel(p.crop, stage, p.golden);
                if (g.length) slot.crop.add(toonMesh(g, { outline: 0.008 }));
            }
        });
    };

    st.pick = (x, y) => {
        const hits = raycast(x, y, [world], camera);
        for (const h of hits) {
            let o = h.object;
            while (o && !o.userData.building && o.parent) o = o.parent;
            if (o && o.userData.building) return o.userData.building;
        }
        return null;
    };

    st.labelPos = (id, out = new THREE.Vector3()) => {
        const s = BUILDING_SPOTS[id];
        return out.set(s.pos[0], s.pos[1] + s.h, s.pos[2]).applyMatrix4(world.matrixWorld);
    };

    st.drag = (dx, dy) => { st.azVel = -dx * 0.004; st.dist = Math.max(0.7, Math.min(1.35, st.dist + dy * 0.0015)); };
    st.zoom = (k) => { st.dist = Math.max(0.7, Math.min(1.35, st.dist * k)); };

    // day / night from the local clock
    function applyTime() {
        const d = new Date();
        const h = d.getHours() + d.getMinutes() / 60;
        // night factor: 0 day, 1 night, smooth at dawn (5–7) and dusk (18–20)
        let n = 0;
        if (h < 5 || h >= 20) n = 1;
        else if (h < 7) n = 1 - (h - 5) / 2;
        else if (h >= 18) n = (h - 18) / 2;
        const dusk = Math.max(0, 1 - Math.abs(h - 19) / 1.5) + Math.max(0, 1 - Math.abs(h - 6) / 1.5);
        st.nightK = n;
        const top = mix(mix('#5ab0ff', '#0c1030', n), '#6a3a8a', dusk * 0.5);
        const bot = mix(mix('#dff4ff', '#2a2050', n), '#ffb070', dusk * 0.6);
        setSky(sky, top, bot, mix('#fff0d0', '#ff9a5a', dusk));
        scene.fog.color.set(mix(mix('#bfe6ff', '#1a1838', n), '#e0a080', dusk * 0.4));
        lights.sun.intensity = 2.1 * (1 - n * 0.75);
        lights.sun.color.set(mix('#fff4e0', '#ffb080', dusk));
        lights.hemi.intensity = 1.15 * (1 - n * 0.45);
        lights.hemi.color.set(mix('#dfefff', '#7a8aff', n));
        stars.material.opacity = n;
        for (const l of nightLights) l.intensity = n * 3;
        for (const l of lamps) l.visible = n > 0.3;
    }
    applyTime();
    st.applyTime = applyTime;

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        camera.fov = portrait ? 48 : 36;
        camera.updateProjectionMatrix();
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    let timeAcc = 0;
    st.update = (dt) => {
        st.time += dt;
        st.az += st.azVel;
        st.azVel *= Math.pow(0.03, dt);
        st.az = Math.max(-1.1, Math.min(1.1, st.az));
        const portrait = size.w / size.h < 0.9;
        const base = portrait ? 30 : 20;
        const d = base * st.dist;
        const az = st.az + Math.sin(st.time * 0.05) * 0.06;
        camera.position.set(Math.sin(az) * d, d * 0.62, Math.cos(az) * d);
        camera.lookAt(0, portrait ? -1.6 : 0.2, -0.2);
        // buildings
        for (const o of st.buildings.summoning.userData.spin) o.rotation[o.isGroup ? 'y' : 'z'] += dt * 0.35;
        st.buildings.summoning.userData.spin[1].position.y = Math.sin(st.time * 1.5) * 0.08;
        const beacon = st.buildings.spire.userData.beacon;
        beacon.rotation.y += dt;
        beacon.position.y = 9 * 1.6 + 3.2 + Math.sin(st.time * 2) * 0.15;
        st.water.offset.y -= dt * 0.9;
        for (const c of st.clouds.children) { c.position.x += c.userData.drift * dt * 10; if (c.position.x > 40) c.position.x = -40; }
        // smoke from the forge
        timeAcc += dt;
        if (timeAcc > 0.25) {
            timeAcc = 0;
            const f = st.buildings.forge;
            const p = f.userData.chimney.clone().applyMatrix4(f.matrixWorld);
            fx.emit({ pos: p, count: 1, color: '#c8c8d0', speed: 0.2, up: 1.0, life: 2.2, size: 0.5, gravity: 0.2, drag: 0.4 });
            if (st.nightK > 0.5 && Math.random() < 0.5) fx.emit({ pos: new THREE.Vector3((Math.random() - 0.5) * 12, 0.5 + Math.random(), (Math.random() - 0.5) * 12), count: 1, color: '#d0ff7a', speed: 0.2, life: 2.5, size: 0.12 });
            fx.emit({ pos: new THREE.Vector3(6.2, -8.5, 5.4), count: 2, color: '#e8f8ff', speed: 0.8, up: 0.6, life: 1.5, size: 0.5 });
        }
        // wandering heroes
        for (const hh of st.heroes) {
            hh.actor.update(dt);
            hh.shadow.position.set(hh.actor.root.position.x, 0.012, hh.actor.root.position.z);
            if (!hh.actor.walkTo) {
                hh.wait -= dt;
                if (hh.wait <= 0) {
                    const w = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
                    hh.actor.walk(new THREE.Vector3(w[0] + (Math.random() - 0.5), 0, w[1] + (Math.random() - 0.5)), 1.1).then(() => { hh.wait = 2 + Math.random() * 5; });
                }
            }
        }
        if (st.overlord) st.overlord.actor.update(dt);
        fx.update(dt);
        if (Math.floor(st.time) % 30 === 0 && Math.floor(st.time - dt) % 30 !== 0) applyTime();
    };

    st.frame();
    return st;
}
