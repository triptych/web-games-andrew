// A sector's blocks and walls as two instanced meshes. Each block is a hull plate with a glowing
// neon frame (an emissive canvas texture, so bloom picks the frame up and not the plate). One
// group per sector, so the next sector can be built while the old one is still on screen.

import * as THREE from 'three';
import { W, H } from '../config.js';
import { buildLevel } from '../sim/levels.js';

function frameTexture(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (kind === 'emit') {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 64, 64);
        g.strokeStyle = '#fff';
        g.lineWidth = 4;
        g.strokeRect(5, 5, 54, 54);
        g.fillStyle = '#fff';
        for (const [x, y] of [[12, 12], [52, 12], [12, 52], [52, 52]]) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'plate') {
        const grd = g.createLinearGradient(0, 0, 64, 64);
        grd.addColorStop(0, '#7a849c'); grd.addColorStop(1, '#3a4258');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.strokeRect(2, 2, 60, 60);
        g.beginPath(); g.moveTo(14, 32); g.lineTo(50, 32); g.stroke();
    } else {
        // wall panel: darker, with vents
        g.fillStyle = '#9aa2b8';
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = 'rgba(0,0,0,0.4)';
        for (let i = 0; i < 4; i++) g.fillRect(14, 12 + i * 11, 36, 4);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 3;
        g.strokeRect(1.5, 1.5, 61, 61);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = kind === 'emit' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

let TEX = null;
const GEO = { block: null, wall: null };

export function buildTiles(idx) {
    if (!TEX) {
        TEX = { emit: frameTexture('emit'), plate: frameTexture('plate'), wall: frameTexture('wall') };
        GEO.block = new THREE.BoxGeometry(1, 1, 1.4);
        GEO.wall = new THREE.BoxGeometry(1, 1, 1.8);
    }
    const L = buildLevel(idx);
    const th = L.theme;
    const group = new THREE.Group();
    const blocks = [], walls = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (L.tiles[r * W + c] !== 1) continue;
        (c < 2 || c >= W - 2 ? walls : blocks).push([c, r]);
    }
    const blockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(th.block).lerp(new THREE.Color(0x202436), 0.45), map: TEX.plate,
        emissive: new THREE.Color(th.block), emissiveMap: TEX.emit, emissiveIntensity: 1.1,
        metalness: 0.55, roughness: 0.38,
    });
    const wallMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(th.wall), map: TEX.wall,
        emissive: new THREE.Color(th.block), emissiveMap: TEX.emit, emissiveIntensity: 0.35,
        metalness: 0.6, roughness: 0.5,
    });
    const m = new THREE.Matrix4();
    const add = (list, geo, mat, z) => {
        const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
        list.forEach(([c, r], i) => { m.makeTranslation(c + 0.5, H - r - 0.5, z); mesh.setMatrixAt(i, m); });
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        return mesh;
    };
    add(blocks, GEO.block, blockMat, 0);
    add(walls, GEO.wall, wallMat, -0.2);
    // a dim back panel so the field reads as a room against the nebula
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 4, H), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.sky[0]).multiplyScalar(0.6), transparent: true, opacity: 0.55, depthWrite: false }));
    back.position.set(W / 2, H / 2, -1.6);
    group.add(back);
    // a soft coloured light per sector
    const glow = new THREE.PointLight(th.edge, 14, 40, 1.6);
    glow.position.set(W / 2, H * 0.7, 9);
    group.add(glow);
    group.userData = { idx, mats: [blockMat, wallMat], back };
    return group;
}

export function disposeTiles(group) {
    for (const mat of group.userData.mats) mat.dispose();
    group.userData.back.geometry.dispose();
    group.userData.back.material.dispose();
    for (const ch of group.children) if (ch.isInstancedMesh) ch.dispose();
}
