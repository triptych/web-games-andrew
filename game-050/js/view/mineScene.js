/**
 * mineScene.js — the Delve: a 7 × 10 rock face of instanced toon blocks,
 * embedded ore, jewels and treasure, a swinging pickaxe, and the heroes you
 * assigned as miners working on the ledge above.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { skyDome, standardLights, size, raycast } from './engine.js';
import { toonMat, toonMesh, part, glowMat, merge, paint, paintGradient, shade, outlineMat } from './toon.js';
import { cyl, cone, box, tor, sph } from './chars.js';
import { buildCharacter } from './chars.js';
import { Actor, ease } from './anim.js';
import { createFx } from './fx.js';
import { makeProp } from './props.js';
import { MINE_W, MINE_H, CELL } from '../sim/mine.js';
import { ORES, JEWELS } from '../data/items.js';
import { ELEMENT } from '../data/core.js';

const GAP = 1.04;
const cx = (c) => (c - (MINE_W - 1) / 2) * GAP;
const cy = (r) => ((MINE_H - 1) / 2 - r) * GAP;

function crackTextures() {
    return [1, 2, 3].map((lv) => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        g.strokeStyle = 'rgba(20,10,10,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
        let s = lv * 99;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let k = 0; k < lv * 3; k++) {
            g.beginPath();
            let x = 64, y = 64;
            g.moveTo(x, y);
            const a0 = rnd() * Math.PI * 2;
            for (let i = 0; i < 4; i++) { const a = a0 + (rnd() - 0.5) * 1.2; x += Math.cos(a) * (10 + rnd() * 12); y += Math.sin(a) * (10 + rnd() * 12); g.lineTo(x, y); }
            g.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        return t;
    });
}

function decoFor(cell, depth) {
    const parts = [], glow = [];
    switch (cell.k) {
        case 'ore': {
            const col = ORES[cell.x].color;
            const shiny = ORES[cell.x].tier >= 5;
            for (let i = 0; i < 5; i++) {
                const g = part(new THREE.IcosahedronGeometry(0.11 + (i % 2) * 0.04, 0), col, [Math.cos(i * 1.3) * 0.25, Math.sin(i * 2.1) * 0.25, 0.48], [i, i * 2, 0]);
                (shiny ? glow : parts).push(g);
            }
            break;
        }
        case 'jewel': glow.push(part(paintGradient(new THREE.OctahedronGeometry(0.22), shade(JEWELS[cell.x].color, -0.2), shade(JEWELS[cell.x].color, 0.5), 1), null, [0, 0, 0.5], [0.3, 0.5, 0], [1, 1.4, 0.7])); break;
        case 'chest':
            parts.push(part(box(0.55, 0.36, 0.3), '#a06a2a', [0, -0.05, 0.45]), part(box(0.58, 0.08, 0.32), '#ffd24a', [0, 0.14, 0.45]), part(box(0.1, 0.12, 0.05), '#ffd24a', [0, 0.0, 0.62]));
            break;
        case 'geode': parts.push(part(sph(0.32, 12, 10), '#6a5a7a', [0, 0, 0.35])); for (let i = 0; i < 5; i++) glow.push(part(new THREE.OctahedronGeometry(0.08), '#d0a0ff', [Math.cos(i * 1.25) * 0.15, Math.sin(i * 1.25) * 0.15, 0.62], [0, 0, i], [0.7, 1.5, 0.7])); break;
        case 'fossil':
            parts.push(part(new THREE.TorusGeometry(0.2, 0.05, 6, 16, Math.PI * 1.4), '#f4ead8', [0, 0, 0.5]), part(cyl(0.04, 0.04, 0.35, 6), '#f4ead8', [0.12, -0.15, 0.5], [0, 0, 0.8]));
            break;
        case 'essence': glow.push(part(paintGradient(new THREE.OctahedronGeometry(0.2), ELEMENT[cell.x].dark, ELEMENT[cell.x].glow, 1), null, [0, 0, 0.5], [0, 0.4, 0], [0.8, 1.6, 0.8])); break;
        case 'cache': glow.push(part(new THREE.TorusGeometry(0.2, 0.05, 8, 20), '#ffd24a', [0, 0, 0.52]), part(new THREE.OctahedronGeometry(0.1), '#fff6c0', [0, 0, 0.55])); break;
        default: break;
    }
    return { parts, glow };
}

export function createMineStage() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#1a1424', 18, 40);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const sky = skyDome('#2a2038', '#0e0a14', '#3a2a40');
    scene.add(sky);
    const lights = standardLights(scene, { hemi: 0.9, sunI: 1.6, sunPos: [3, 6, 10], sky: '#ffe8d0', ground: '#3a2a3a', sun: '#ffe0c0' });
    const fx = createFx(scene);
    fx.ambient('embers', { w: 12, h: 10, d: 2, y: -5, z: 1.5 });

    // cave backdrop: the tunnel wall behind dug cells, and rough rock all around
    const back = new THREE.Mesh(new THREE.PlaneGeometry(MINE_W * GAP, MINE_H * GAP), toonMat({ color: '#1e1620' }));
    back.position.z = -0.5;
    scene.add(back);
    const frame = [];
    for (let i = 0; i < 40; i++) {
        const side = i % 2 ? 1 : -1;
        const y = -6 + (i / 2) * 0.6;
        frame.push(part(new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.3, 0), shade('#4a3a40', (i % 4) * 0.04), [side * (MINE_W / 2 + 0.7 + (i % 3) * 0.3), y, -0.3 + (i % 2) * 0.3], [i, i * 0.7, 0]));
    }
    scene.add(toonMesh(frame, { outline: 0.03 }));
    // ledge with a lantern on top
    scene.add(toonMesh([part(box(MINE_W * GAP + 3, 0.5, 2.2), '#5a4434', [0, cy(0) + 0.9, 0.4]), part(box(MINE_W * GAP + 3, 0.12, 2.3), '#6fbf4a', [0, cy(0) + 1.17, 0.4])], { outline: 0.02 }));
    for (const x of [-4.3, 4.3]) { const l = makeProp('lantern', 3, {}); l.position.set(x, cy(0) + 1.2, 0.6); scene.add(l); }
    const torchLights = [new THREE.PointLight('#ffb060', 3, 8, 1.4), new THREE.PointLight('#ffb060', 3, 8, 1.4)];
    torchLights[0].position.set(-3.5, 1, 2); torchLights[1].position.set(3.5, -3, 2);
    torchLights.forEach((l) => scene.add(l));

    // blocks
    const N = MINE_W * MINE_H;
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    const blocks = new THREE.InstancedMesh(geo, toonMat({ color: '#ffffff' }), N);
    blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    const outlines = new THREE.InstancedMesh(geo, outlineMat(0.03), N);
    scene.add(outlines, blocks);
    const decoGroup = new THREE.Group();
    scene.add(decoGroup);
    const cracks = crackTextures();
    const crackMeshes = [];
    const pick = toonMesh([part(cyl(0.05, 0.05, 1.1, 6), '#8a5a2a', [0, -0.3, 0]), part(cone(0.08, 0.5, 6), '#c8d0dc', [0.25, 0.22, 0], [0, 0, -Math.PI / 2]), part(cone(0.08, 0.5, 6), '#c8d0dc', [-0.25, 0.22, 0], [0, 0, Math.PI / 2]), part(box(0.16, 0.16, 0.16), '#8a8a96', [0, 0.22, 0])], { outline: 0.012 });
    pick.visible = false;
    scene.add(pick);

    const st = { scene, camera, fx, grid: null, depth: 1, miners: [], time: 0, hl: new Set(), shakeCell: null, pickT: 0 };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();

    function baseColor(cell, depth) {
        const tint = Math.min(0.45, depth * 0.025);
        const c = { dirt: '#8a6040', stone: '#8a8590', hard: '#5a5868', bedrock: '#2a2830', ore: '#7a7480', jewel: '#7a7480', chest: '#8a6040', geode: '#7a7480', fossil: '#a89a80', essence: '#6a6878', cache: '#7a7480' }[cell.k] || '#8a8590';
        return shade(c, -tint);
    }

    st.setGrid = (grid, depth, hittable) => {
        st.grid = grid; st.depth = depth;
        decoGroup.clear();
        for (const c of crackMeshes) scene.remove(c);
        crackMeshes.length = 0;
        let i = 0;
        for (let r = 0; r < MINE_H; r++) for (let c = 0; c < MINE_W; c++, i++) {
            const cell = grid[r][c];
            pos.set(cx(c), cy(r), 0);
            sc.setScalar(cell.open ? 0.0001 : 1);
            q.identity();
            m4.compose(pos, q, sc);
            blocks.setMatrixAt(i, m4);
            outlines.setMatrixAt(i, m4);
            col.set(baseColor(cell, depth));
            if (!cell.open && hittable(r, c)) col.offsetHSL(0, 0, 0.1);
            blocks.setColorAt(i, col);
            if (!cell.open) {
                const d = decoFor(cell, depth);
                const g = new THREE.Group(); g.position.set(cx(c), cy(r), 0); g.userData.cell = [r, c];
                if (d.parts.length) g.add(toonMesh(d.parts, { outline: 0.01 }));
                if (d.glow.length) g.add(new THREE.Mesh(merge(d.glow), glowMat()));
                if (g.children.length) decoGroup.add(g);
                if (cell.hp < cell.max && cell.max !== Infinity) {
                    const lv = Math.min(2, Math.floor((1 - cell.hp / cell.max) * 3));
                    const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshBasicMaterial({ map: cracks[lv], transparent: true, depthWrite: false }));
                    cm.position.set(cx(c), cy(r), 0.515);
                    scene.add(cm);
                    crackMeshes.push(cm);
                }
            }
        }
        blocks.instanceMatrix.needsUpdate = true;
        outlines.instanceMatrix.needsUpdate = true;
        blocks.instanceColor.needsUpdate = true;
        back.material.color.set(shade('#2a2030', -Math.min(0.5, depth * 0.03)));
    };

    st.cellAt = (x, y) => {
        const hits = raycast(x, y, [blocks, decoGroup], camera);
        for (const h of hits) {
            if (h.object === blocks && h.instanceId !== undefined) return [Math.floor(h.instanceId / MINE_W), h.instanceId % MINE_W];
            let o = h.object;
            while (o && !o.userData.cell) o = o.parent;
            if (o) return o.userData.cell;
        }
        return null;
    };

    st.cellPos = (r, c, out = new THREE.Vector3()) => out.set(cx(c), cy(r), 0.6);

    /** Pickaxe swing + sparks; when broken, a burst of rubble. */
    st.strikeFx = (r, c, broken, color) => {
        const p = st.cellPos(r, c);
        pick.visible = true;
        st.pickT = 0;
        st.pickAt = p.clone();
        fx.burst(p, '#ffe0a0', 8, { speed: 2.5, size: 0.12 });
        if (broken) {
            fx.burst(p, color || '#8a7a70', 26, { speed: 3.5, size: 0.26, gravity: -6 });
            fx.burst(p, '#ffffff', 10, { speed: 2, size: 0.14 });
        }
        st.shakeCell = { r, c, t: 0.18 };
    };

    st.setMiners = (looks) => {
        for (const m of st.miners) scene.remove(m.rig.root);
        st.miners = looks.map((look, i) => {
            const rig = buildCharacter(look);
            const a = new Actor(rig);
            a.place(new THREE.Vector3(-2.6 + i * 1.3, cy(0) + 1.15, 0.6), 0.2);
            scene.add(rig.root);
            return { rig, actor: a, next: 0.5 + i * 0.4 };
        });
    };

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        camera.fov = portrait ? 50 : 36;
        camera.updateProjectionMatrix();
        const tanH = Math.tan((camera.fov * Math.PI / 180) / 2);
        // the HUD covers the top ~14% and bottom ~26% (portrait); fit the grid + ledge between
        const top = portrait ? 0.15 : 0.12, bot = portrait ? 0.27 : 0.2;
        const vis = 1 - top - bot;
        const w = MINE_W * GAP + 0.8, hgt = MINE_H * GAP + 1.6;
        const distW = (w / 2) / (tanH * camera.aspect);
        const distH = (hgt / 2) / (tanH * vis);
        const d = Math.max(distW, distH);
        // grid centre (slightly above 0 to include the ledge) must land at the centre of the visible band
        const gridC = 0.55;
        const c = top + vis / 2;
        const lookY = gridC + (c - 0.5) * 2 * tanH * d;
        camera.position.set(0, lookY, d);
        camera.lookAt(0, lookY, 0);
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    st.update = (dt) => {
        st.time += dt;
        if (pick.visible) {
            st.pickT += dt;
            const k = Math.min(1, st.pickT / 0.3);
            pick.position.copy(st.pickAt).add(new THREE.Vector3(0.5, 0.5, 0.4));
            pick.rotation.set(0, 0, 0.8 - Math.sin(k * Math.PI) * 1.6);
            if (k >= 1) pick.visible = false;
        }
        if (st.shakeCell) {
            st.shakeCell.t -= dt;
            const { r, c } = st.shakeCell;
            const i = r * MINE_W + c;
            const cell = st.grid && st.grid[r][c];
            if (cell && !cell.open) {
                const a = Math.max(0, st.shakeCell.t) * 0.4;
                pos.set(cx(c) + (Math.random() - 0.5) * a, cy(r) + (Math.random() - 0.5) * a, 0);
                q.identity(); sc.setScalar(1 - a * 0.3);
                m4.compose(pos, q, sc);
                blocks.setMatrixAt(i, m4); outlines.setMatrixAt(i, m4);
                blocks.instanceMatrix.needsUpdate = true; outlines.instanceMatrix.needsUpdate = true;
            }
            if (st.shakeCell.t <= 0) st.shakeCell = null;
        }
        for (const m of st.miners) {
            m.actor.update(dt);
            m.next -= dt;
            if (m.next <= 0) { m.actor.strike(0.3); m.next = 1.2 + Math.random(); fx.burst(m.actor.root.position.clone().add(new THREE.Vector3(0, 0.2, 0.4)), '#ffe0a0', 4, { speed: 1.5, size: 0.08 }); }
        }
        torchLights[0].intensity = 3 + Math.sin(st.time * 13) * 0.4;
        torchLights[1].intensity = 3 + Math.sin(st.time * 11 + 1) * 0.4;
        fx.update(dt);
    };
    st.frame();
    return st;
}
