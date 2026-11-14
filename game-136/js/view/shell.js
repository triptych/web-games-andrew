// The room itself: a clay plinth with a name plate, a floor of lumpy tiles, two back walls with
// the door and windows cut out of them, skirting, curtains, a doormat and any posts. Rebuilt when
// the room changes. Sim tile (x, y) is world (x + 0.5, 0, y + 0.5); wall L is the plane z = 0,
// wall R the plane x = 0, both facing into the room.

import * as THREE from 'three';
import { clay, rbox, blob, capsule, mesh } from './clay.js';
import { ROW, ROW0, WALL_H } from './models.js';

export const T = 0.22;               // wall thickness
const TILE_H = 0.12;
const DOOR_TOP = ROW0 + ROW * 2, WIN_LO = ROW0 + ROW, WIN_HI = ROW0 + ROW * 3;
const shadeHex = (h, k) => { const c = new THREE.Color(h); c.multiplyScalar(k); return c.getHex(); };

/** Window panes: one material per room, recoloured by the time of day. */
export const paneMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0xbfe6ff, emissiveIntensity: 0.9, roughness: 0.3 });

function nameplate(text, hex) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#f3e6cc'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#' + new THREE.Color(hex).getHexString();
    let size = 52;
    const font = (s) => `700 ${s}px "Fredoka", "Trebuchet MS", system-ui, sans-serif`;
    g.font = font(size);
    while (g.measureText(text).width > 470 && size > 18) g.font = font(--size);   // shrink to fit
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Build the shell for a room (G.room + G.w, G.d and the level's look). */
export function buildShell(G, look) {
    const root = new THREE.Group();
    const W = G.w, D = G.d;
    const wallM = clay(look.wall, { rough: 0.9 }), trimM = clay(look.trim), baseM = clay(look.base);

    // plinth and name plate
    const plinth = mesh(rbox(W + T + 0.5, 0.55, D + T + 0.5, 0.14, 2, 3), baseM, (W - T) / 2, -TILE_H - 0.275, (D - T) / 2);
    root.add(plinth);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.2, W * 0.6), 0.32), new THREE.MeshStandardMaterial({ map: nameplate(G.room.name, look.base), roughness: 0.85 }));
    plate.position.set((W - T) / 2 + 0.5, -TILE_H - 0.28, D + 0.25 - T / 2 + 0.005);
    root.add(plate);
    const plateBack = mesh(rbox(Math.min(3.2, W * 0.6) + 0.1, 0.4, 0.05, 0.02, 0.5, 1), trimM, plate.position.x, plate.position.y, plate.position.z - 0.03);
    root.add(plateBack);

    // floor tiles: one instanced mesh, each tile a slightly different shade
    const tileGeo = rbox(0.95, TILE_H, 0.95, 0.04, 0.8, 1);
    const tiles = new THREE.InstancedMesh(tileGeo, clay(0xffffff, { rough: 0.85 }), W * D);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let i = 0;
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
        m4.makeTranslation(x + 0.5, -TILE_H / 2, y + 0.5);
        tiles.setMatrixAt(i, m4);
        col.setHex((x + y) % 2 ? look.floor : look.floor2);
        col.multiplyScalar(0.94 + ((x * 7 + y * 13) % 5) * 0.03);
        tiles.setColorAt(i, col);
        i++;
    }
    tiles.receiveShadow = true;
    root.add(tiles);
    const under = mesh(rbox(W + T, 0.1, D + T, 0.03, 1, 2), clay(shadeHex(look.floor, 0.6)), (W - T) / 2, -TILE_H - 0.03, (D - T) / 2);
    root.add(under);

    // walls, cut around the door and windows
    const openings = (wall) => {
        const len = wall === 'L' ? W : D;
        const cols = [];
        for (let u = 0; u < len; u++) {
            if (G.room.door.wall === wall && G.room.door.u === u) cols.push([[DOOR_TOP, WALL_H]]);
            else if (G.room.windows.some((wi) => wi.wall === wall && u >= wi.u && u < wi.u + wi.w)) cols.push([[0, WIN_LO], [WIN_HI, WALL_H]]);
            else cols.push([[0, WALL_H]]);
        }
        return cols;
    };
    const putWall = (wall) => {
        const cols = openings(wall);
        let start = 0;
        for (let u = 1; u <= cols.length; u++) {
            if (u < cols.length && JSON.stringify(cols[u]) === JSON.stringify(cols[start])) continue;
            const len = u - start;
            for (const [lo, hi] of cols[start]) {
                const h = hi - lo, c = start + len / 2;
                const m = mesh(rbox(len + 0.02, h, T, 0.05, 1.4, start + (wall === 'R' ? 7 : 0)), wallM, 0, lo + h / 2, 0);
                if (wall === 'L') m.position.set(c, lo + h / 2, -T / 2);
                else m.position.set(-T / 2, lo + h / 2, c), m.rotation.y = Math.PI / 2;
                root.add(m);
            }
            start = u;
        }
        // skirting
        const len = cols.length;
        for (let u = 0; u < len; u++) {
            if (G.room.door.wall === wall && G.room.door.u === u) continue;
            const sk = mesh(rbox(1.0, 0.12, 0.05, 0.02, 0.6, u), trimM, 0, 0.06, 0);
            if (wall === 'L') sk.position.set(u + 0.5, 0.06, 0.02); else { sk.position.set(0.02, 0.06, u + 0.5); sk.rotation.y = Math.PI / 2; }
            root.add(sk);
        }
    };
    putWall('L'); putWall('R');
    const corner = mesh(rbox(T, WALL_H, T, 0.05, 1.2, 5), wallM, -T / 2, WALL_H / 2, -T / 2);
    root.add(corner);
    // a cap along the wall tops
    const capL = mesh(rbox(W + T, 0.08, T + 0.06, 0.03, 1, 1), trimM, (W - T) / 2, WALL_H + 0.02, -T / 2);
    const capR = mesh(rbox(D, 0.08, T + 0.06, 0.03, 1, 2), trimM, -T / 2, WALL_H + 0.02, D / 2); capR.rotation.y = Math.PI / 2;
    root.add(capL, capR);

    // door, in its opening
    const dr = G.room.door;
    const door = new THREE.Group();
    door.add(mesh(rbox(0.86, DOOR_TOP - 0.03, 0.08, 0.04, 1.2, 4), clay(0x8a5a3c), 0, (DOOR_TOP - 0.03) / 2, -T * 0.55));
    for (const [pw, ph, py] of [[0.62, 0.55, 0.45], [0.62, 0.55, 1.12]]) door.add(mesh(rbox(pw, ph, 0.03, 0.03, 0.5, 2), clay(0x9a6a48), 0, py, -T * 0.55 + 0.05));
    door.add(mesh(blob(0.05, 0.3, 1), clay(0xf6cf57), 0.3, 0.85, -T * 0.55 + 0.08));
    for (const sx of [-1, 1]) door.add(mesh(rbox(0.08, DOOR_TOP + 0.04, T + 0.08, 0.03, 0.8, sx + 3), trimM, sx * 0.46, DOOR_TOP / 2, -T / 2));
    door.add(mesh(rbox(1.0, 0.09, T + 0.08, 0.03, 0.8, 3), trimM, 0, DOOR_TOP + 0.02, -T / 2));
    if (dr.wall === 'L') door.position.set(dr.u + 0.5, 0, 0); else { door.position.set(0, 0, dr.u + 0.5); door.rotation.y = Math.PI / 2; }
    root.add(door);
    // the doormat on the tile in front of it
    const mat = mesh(rbox(0.7, 0.025, 0.45, 0.02, 0.6, 3), clay(0xb08850, { rough: 1 }), 0, 0.012, 0);
    if (dr.wall === 'L') mat.position.set(dr.u + 0.5, 0.012, 0.32); else { mat.position.set(0.32, 0.012, dr.u + 0.5); mat.rotation.y = Math.PI / 2; }
    mat.castShadow = false;
    root.add(mat);

    // windows: pane, frame, cross, sill and curtains
    for (const wi of G.room.windows) {
        const win = new THREE.Group();
        const ww = wi.w, wh = WIN_HI - WIN_LO;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), paneMat);
        pane.position.set(0, WIN_LO + wh / 2, -T * 0.6);
        win.add(pane);
        for (const [bw, bh, bx, by] of [[ww + 0.1, 0.08, 0, WIN_HI], [ww + 0.1, 0.08, 0, WIN_LO], [0.08, wh, ww / 2, WIN_LO + wh / 2], [0.08, wh, -ww / 2, WIN_LO + wh / 2], [0.06, wh, 0, WIN_LO + wh / 2], [ww, 0.06, 0, WIN_LO + wh / 2]]) {
            win.add(mesh(rbox(bw, bh, 0.1, 0.025, 0.6, bx * 3), trimM, bx, by, -T * 0.5));
        }
        win.add(mesh(rbox(ww + 0.2, 0.07, 0.24, 0.03, 0.8, 2), trimM, 0, WIN_LO - 0.02, 0.04));
        for (const sx of [-1, 1]) {
            const cur = mesh(capsule(0.1, wh * 0.85, 1.6, sx + 2), clay(shadeHex(look.trim, 1.08)), sx * (ww / 2 + 0.02), WIN_LO + wh / 2, 0.06);
            cur.scale.set(1, 1, 0.55);
            win.add(cur);
        }
        const rod = mesh(capsule(0.025, ww + 0.4, 0.3, 1), clay(0x8a5a3c), 0, WIN_HI + 0.08, 0.06); rod.rotation.z = Math.PI / 2;
        win.add(rod);
        if (wi.wall === 'L') win.position.set(wi.u + ww / 2, 0, 0); else { win.position.set(0, 0, wi.u + ww / 2); win.rotation.y = Math.PI / 2; }
        root.add(win);
    }

    // posts on blocked tiles
    for (const [bx, by] of G.room.blocked) {
        root.add(mesh(rbox(0.36, WALL_H + 0.3, 0.36, 0.06, 1.4, bx + by), clay(0x8a6a4a), bx + 0.5, (WALL_H + 0.3) / 2, by + 0.5));
        root.add(mesh(rbox(0.6, 0.12, 0.6, 0.04, 1, bx), clay(0x6e523a), bx + 0.5, 0.06, by + 0.5));
    }
    root.traverse((o) => { if (o.isMesh && o !== tiles) o.receiveShadow = true; });
    return root;
}
