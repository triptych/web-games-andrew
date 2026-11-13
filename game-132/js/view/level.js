// Builds an area's floor, walls, features (waystones, exits, chests, lore, town people) and decor from G.
// The floor is one merged mesh with the area's fal texture in world-space UVs; walls are one instanced box per
// wall cell that touches floor. Props are Meshy models (see models.js).

import * as THREE from 'three';
import { AREAS, NPCS } from '../sim/data/world.js';
import { texture } from './view.js';
import { model } from './models.js';

const WALL_H = { town: 1.6, wilds: 1.3, temple: 1.8, crypt: 1.8, vault: 2.0, rift: 1.6 };
const PROP = {
    tree: ['prop-tree', 3.4], column: ['prop-column', 2.6], statue: ['prop-statue', 2.8], brazier: ['prop-brazier', 1.1],
    sarcophagus: ['prop-sarcophagus', 1.0], obelisk: ['prop-obelisk', 3.2],
};

export function buildLevel(G, view) {
    const A = G.area, def = AREAS[A.id];
    const group = new THREE.Group();
    const disposables = [];
    const tex = texture(`tex-${def.tex}`);
    const wallTex = texture('tex-wall');

    // floor: a quad per floor cell, UVs in world units / 4
    const pos = [], uv = [], idx = [];
    let n = 0;
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        if (!A.grid[y * A.w + x]) continue;
        pos.push(x, 0, y, x + 1, 0, y, x + 1, 0, y + 1, x, 0, y + 1);
        uv.push(x / 6, y / 6, (x + 1) / 6, y / 6, (x + 1) / 6, (y + 1) / 6, x / 6, (y + 1) / 6);
        idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
        n += 4;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb8b0a8, roughness: 0.95 });
    group.add(new THREE.Mesh(fg, floorMat));
    disposables.push(fg, floorMat);

    // walls: cells next to floor
    const cells = [];
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        if (A.grid[y * A.w + x]) continue;
        let touch = false;
        for (let oy = -1; oy <= 1 && !touch; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx >= 0 && ny >= 0 && nx < A.w && ny < A.h && A.grid[ny * A.w + nx]) { touch = true; break; }
        }
        if (touch) cells.push([x, y]);
    }
    const H = WALL_H[def.tex] ?? 1.6;
    const wg = new THREE.BoxGeometry(1, H, 1);
    const wm = new THREE.MeshStandardMaterial({ map: wallTex, color: def.tex === 'wilds' ? 0x6a7a62 : def.tex === 'vault' ? 0x8a6a4a : def.tex === 'temple' ? 0xa8b8b8 : 0x8a8090, roughness: 0.9 });
    const walls = new THREE.InstancedMesh(wg, wm, Math.max(1, cells.length));
    const m4 = new THREE.Matrix4();
    const tall = new Float32Array(cells.length);           // each wall's full height factor
    const now = new Float32Array(cells.length);            // its height factor this frame (cut away near the player)
    const at = new Int32Array(A.w * A.h).fill(-1);        // cell → wall instance
    const setWall = (i, f) => { const [x, y] = cells[i]; m4.makeScale(1, f, 1).setPosition(x + 0.5, (H * f) / 2, y + 0.5); walls.setMatrixAt(i, m4); };
    cells.forEach(([x, y], i) => {
        tall[i] = now[i] = def.tex === 'wilds' ? 0.75 + ((x * 7 + y * 13) % 5) * 0.12 : 1;
        at[y * A.w + x] = i;
        setWall(i, tall[i]);
    });
    walls.count = cells.length;
    // wall cut-away: the camera sits south of the player looking north, so walls just south of the player (in a cone
    // that widens toward the camera) sink to a stub while the player is behind them, then rise again
    const STUB = 0.12, cut = new Set();
    const cutAway = (G2, dt) => {
        const P = G2.player, want = new Set();
        const px = P.x, py = P.y;
        for (let y = Math.floor(py); y <= Math.floor(py + 4); y++) {
            const dz = y + 0.5 - py;
            if (dz < -0.2) continue;
            const half = 1.3 + Math.max(0, dz) * 0.35;
            for (let x = Math.floor(px - half); x <= Math.floor(px + half); x++) {
                if (x < 0 || y < 0 || x >= A.w || y >= A.h) continue;
                const i = at[y * A.w + x];
                if (i >= 0 && Math.abs(x + 0.5 - px) <= half + 0.5) want.add(i);
            }
        }
        for (const i of want) cut.add(i);
        const k = 1 - Math.exp(-dt * 10);
        let dirty = false;
        for (const i of cut) {
            const target = want.has(i) ? Math.min(STUB, tall[i]) : tall[i];
            const v = now[i] + (target - now[i]) * k;
            now[i] = Math.abs(v - target) < 0.01 ? target : v;
            setWall(i, now[i]);
            dirty = true;
            if (!want.has(i) && now[i] === tall[i]) cut.delete(i);
        }
        if (dirty) walls.instanceMatrix.needsUpdate = true;
    };
    group.add(walls);
    disposables.push(wg, wm);

    // a dark skirt under everything, so the edges of the world fade into nothing
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(A.w + 80, A.h + 80), new THREE.MeshBasicMaterial({ color: def.sky }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.set(A.w / 2, -0.02, A.h / 2);
    group.add(skirt);
    disposables.push(skirt.geometry, skirt.material);

    // decor props
    for (const d of G.decor || []) {
        const [file, h] = PROP[d.kind] || PROP.column;
        const o = model(file, h * (0.85 + ((d.x * 31) % 3) * 0.1), { color: 0x6a6460 });
        o.position.set(d.x, 0, d.y); o.rotation.y = d.rot;
        group.add(o);
    }

    // features
    const feats = new Map();
    const glow = (color, r = 0.9) => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
        return m;
    };
    for (const f of G.features) {
        let o;
        if (f.kind === 'waystone') { o = model('prop-waystone', 2.6, { color: 0x6a8aa8 }); o.add(glow(0x4aa8ff, 1.2)); }
        else if (f.kind === 'exit' || f.kind === 'portal') { o = model('prop-portal', 3.0, { color: 0x7a5aa8 }); o.add(glow(f.kind === 'portal' ? 0x4aa8ff : 0xa070ff, 1.4)); o.userData.portal = true; }
        else if (f.kind === 'chest') o = model('prop-chest', 0.9, { color: 0x8a6a3a });
        else if (f.kind === 'lore') { o = model('prop-statue', 1.7, { color: 0x9a9a8a }); o.add(glow(0xffd88a, 0.8)); }
        else if (f.kind === 'stash') o = model('prop-chest', 1.0, { color: 0x8a6a3a });
        else if (f.kind === 'obelisk') { o = model('prop-obelisk', 3.6, { color: 0x4a3a6a }); o.add(glow(0xc890ff, 1.6)); }
        else if (f.kind === 'shrine') { o = model('prop-statue', 2.8, { color: 0x9a9a8a }); o.add(glow(0xffd88a, 1.2)); }
        else if (f.kind === 'npc') {
            o = new THREE.Group();
            o.add(model(NPCS[f.id].model, f.id === 'heron' ? 1.95 : 1.65, { color: 0xa08060 }));
            if (f.id === 'ysolde') { const st = model('prop-stall', 2.4, { color: 0x8a5a3a }); st.position.set(0, 0, -1.6); o.add(st); }
        } else continue;
        o.position.set(f.x, 0, f.y);
        // exits and portals face the way back into the level; people face the plaza
        o.rotation.y = f.kind === 'npc' ? Math.PI * 0.05 : f.kind === 'exit' && f.offset ? 0 : 0;
        group.add(o);
        feats.set(f.id, o);
    }
    // town: lanterns on posts around the plaza
    if (A.kind === 'town') {
        for (const [x, y] of [[9, 8], [26, 8], [9, 19], [26, 19], [18, 6], [14, 15], [22, 15]]) {
            const o = model('prop-brazier', 1.1, { color: 0x8a6a3a });
            o.position.set(x + 0.5, 0, y + 0.5);
            const l = new THREE.PointLight(0xffa850, 12, 8, 1.8); l.position.set(x + 0.5, 1.6, y + 0.5);
            group.add(o, l);
        }
    }
    return {
        group, feats,
        walls, cutAway,
        update(G2, dt, time) {
            cutAway(G2, dt);
            for (const f of G2.features) {
                const o = feats.get(f.id);
                if (!o) continue;
                if (f.kind === 'exit') o.visible = true;
                if (f.kind === 'chest' && f.open) o.scale.y = 0.75;
                if (o.userData.portal) for (const c of o.children) if (c.material?.blending === THREE.AdditiveBlending) c.material.opacity = f.locked ? 0.1 : 0.3 + Math.sin(time * 3) * 0.12;
            }
            // a rift's way home is added after the level was built
            for (const f of G2.features) if (!feats.has(f.id) && f.kind === 'exit') {
                const o = model('prop-portal', 3.0, { color: 0x7a5aa8 }); o.add(glow(0xa070ff, 1.4)); o.userData.portal = true;
                o.position.set(f.x, 0, f.y); group.add(o); feats.set(f.id, o);
            }
        },
        dispose() {
            for (const d of disposables) d.dispose?.();
            group.traverse((o) => { o.userData.disposed = true; });
        },
    };
}
