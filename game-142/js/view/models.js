// Models made in code: the cannon and its plinth, Pip the cannoneer, the little people of the
// castles, the cannonballs, flags and trees. Chunky, rounded and bright: toys, not soldiers.

import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

// ------------------------------------------------------------------ the cannon
export function makeCannon() {
    const root = new THREE.Group();
    const stone = std(0xb7ab98, { roughness: 0.95 });
    const wood = std(0x9a5a2b, { roughness: 0.8 });
    const bronze = std(0xc98a3a, { metalness: 0.75, roughness: 0.32 });
    const dark = std(0x3a2a1e);
    // plinth: a chunky stone platform with a ramp
    const plinth = mesh(new THREE.BoxGeometry(3.6, 1.2, 3.6), stone, 0, 0.6, 0);
    plinth.receiveShadow = true;
    root.add(plinth);
    const lip = mesh(new THREE.BoxGeometry(3.9, 0.25, 3.9), std(0xcfc3ae, { roughness: 0.9 }), 0, 1.22, 0);
    lip.receiveShadow = true;
    root.add(lip);
    // cart, turning with the yaw
    const yaw = new THREE.Group();
    yaw.position.set(0, 1.35, 0);
    root.add(yaw);
    const cart = mesh(new THREE.BoxGeometry(1.3, 0.45, 2.0), wood, 0, 0.35, -0.1);
    yaw.add(cart);
    for (const sx of [-1, 1]) {
        const cheek = mesh(new THREE.BoxGeometry(0.18, 0.75, 1.3), wood, sx * 0.55, 0.75, 0.05);
        yaw.add(cheek);
        for (const z of [-0.65, 0.6]) {
            const wheel = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 18), wood, sx * 0.78, 0.3, z);
            wheel.rotation.z = Math.PI / 2;
            yaw.add(wheel);
            const hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), bronze, sx * 0.8, 0.3, z);
            hub.rotation.z = Math.PI / 2;
            yaw.add(hub);
        }
    }
    // barrel, pitching about the trunnions at the pivot (y 2.3 in the world)
    const pitch = new THREE.Group();
    pitch.position.set(0, 2.3 - 1.35, 0);
    yaw.add(pitch);
    const recoil = new THREE.Group();
    pitch.add(recoil);
    const pts = [[0, -0.75], [0.36, -0.75], [0.42, -0.62], [0.38, -0.5], [0.33, 0.2], [0.27, 1.05], [0.33, 1.15], [0.34, 1.35], [0.22, 1.38], [0.2, 1.2], [0, 1.2]]
        .map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = mesh(new THREE.LatheGeometry(pts, 24), bronze);
    barrel.rotation.x = Math.PI / 2;
    recoil.add(barrel);
    for (const y of [-0.45, 0.35, 0.95]) {
        const band = mesh(new THREE.TorusGeometry(y < 0 ? 0.4 : y < 0.5 ? 0.33 : 0.29, 0.045, 8, 24), bronze);
        band.position.z = y;
        recoil.add(band);
    }
    const knob = mesh(new THREE.SphereGeometry(0.16, 12, 10), bronze, 0, 0, -0.85);
    recoil.add(knob);
    const bore = mesh(new THREE.CircleGeometry(0.2, 18), dark, 0, 0, 1.385);
    recoil.add(bore);
    const trunnion = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 10), bronze);
    trunnion.rotation.z = Math.PI / 2;
    pitch.add(trunnion);
    // a stack of balls beside the cart, and a little flag
    const ballMat = std(0x2c2f36, { metalness: 0.6, roughness: 0.4 });
    for (const [x, y, z] of [[1.25, 1.55, 0.8], [1.55, 1.55, 0.95], [1.4, 1.55, 1.2], [1.4, 1.8, 0.98]]) root.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), ballMat, x, y, z));
    root.userData = { yaw, pitch, recoil };
    return root;
}

// ------------------------------------------------------------------ people
const SKIN = 0xffd3b0, CHEEK = 0xff9a9a;

function face(g, y, r, opts = {}) {
    const eyeMat = std(0x1d1a24, { roughness: 0.3 });
    const head = mesh(new THREE.SphereGeometry(r, 20, 16), std(SKIN, { roughness: 0.7 }), 0, y, 0);
    g.add(head);
    const eyes = [];
    for (const s of [-1, 1]) {
        const e = mesh(new THREE.SphereGeometry(r * 0.16, 10, 8), eyeMat, s * r * 0.36, y + r * 0.08, -r * 0.9);
        e.scale.set(1, 1.3, 0.6);
        g.add(e); eyes.push(e);
        const shine = mesh(new THREE.SphereGeometry(r * 0.05, 6, 6), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), s * r * 0.33, y + r * 0.15, -r * 0.98);
        g.add(shine);
        const cheek = mesh(new THREE.SphereGeometry(r * 0.16, 10, 8), std(CHEEK, { roughness: 0.9 }), s * r * 0.58, y - r * 0.2, -r * 0.74);
        cheek.scale.set(1, 0.6, 0.4);
        g.add(cheek);
    }
    const nose = mesh(new THREE.SphereGeometry(r * 0.12, 8, 8), std(0xffb08a), 0, y - r * 0.05, -r * 1.0);
    g.add(nose);
    // a dizzy face: two little crosses, shown when bonked
    const xs = new THREE.Group();
    for (const s of [-1, 1]) for (const a of [-1, 1]) {
        const bar = mesh(new THREE.BoxGeometry(r * 0.32, r * 0.07, r * 0.05), eyeMat, s * r * 0.36, y + r * 0.08, -r * 0.95);
        bar.rotation.z = a * Math.PI / 4;
        xs.add(bar);
    }
    xs.visible = false;
    g.add(xs);
    g.userData.eyes = eyes; g.userData.xs = xs;
    return head;
}

/** A character model the size of its physics box (h = half sizes). Bottom at y = -h[1]. */
export function makeCharacter(role, h, name = '') {
    const root = new THREE.Group();
    const g = new THREE.Group();          // offset so the model's feet sit on the box bottom
    g.position.y = -h[1];
    root.add(g);
    const H = h[1] * 2, W = h[0] * 2;
    const metal = std(0xd8dde6, { metalness: 0.85, roughness: 0.25 });
    const hash = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const tabards = [0x3d7bff, 0xe8463c, 0x2fb36a, 0xf2a93b, 0x9b5de5];
    const tabard = std(tabards[hash % tabards.length], { roughness: 0.85 });
    const legs = std(0x6b4a2e);
    for (const s of [-1, 1]) g.add(mesh(new THREE.CapsuleGeometry(W * 0.14, H * 0.12, 4, 8), legs, s * W * 0.2, H * 0.12, 0));
    if (role === 'knight') {
        const body = mesh(new THREE.CapsuleGeometry(W * 0.36, H * 0.2, 6, 14), metal, 0, H * 0.4, 0);
        g.add(body);
        const tab = mesh(new THREE.BoxGeometry(W * 0.62, H * 0.32, W * 0.1), tabard, 0, H * 0.4, -W * 0.33);
        g.add(tab);
        face(g, H * 0.72, W * 0.36);
        const helm = mesh(new THREE.SphereGeometry(W * 0.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), metal, 0, H * 0.74, 0.02);
        g.add(helm);
        const plume = mesh(new THREE.SphereGeometry(W * 0.16, 10, 8), std([0xff4a4a, 0xffd23f, 0x4ad4ff][hash % 3], { roughness: 0.9 }), 0, H * 0.98, 0.04);
        plume.scale.set(0.7, 1.4, 1.2);
        g.add(plume);
        const sword = mesh(new THREE.BoxGeometry(W * 0.08, H * 0.42, W * 0.04), std(0xc7a26b), W * 0.45, H * 0.45, -W * 0.15);
        sword.rotation.z = -0.4;
        g.add(sword);
        root.userData.arm = sword;
    } else if (role === 'king') {
        const robe = mesh(new THREE.CylinderGeometry(W * 0.34, W * 0.46, H * 0.48, 16), std(0xd62f3a, { roughness: 0.85 }), 0, H * 0.34, 0);
        g.add(robe);
        const collar = mesh(new THREE.TorusGeometry(W * 0.3, W * 0.08, 8, 16), std(0xffffff, { roughness: 1 }), 0, H * 0.58, 0);
        collar.rotation.x = Math.PI / 2;
        g.add(collar);
        face(g, H * 0.72, W * 0.33);
        const tache = mesh(new THREE.SphereGeometry(W * 0.13, 10, 8), std(0xffffff, { roughness: 1 }), 0, H * 0.67, -W * 0.31);
        tache.scale.set(1.9, 0.6, 0.7);
        g.add(tache);
        const gold = std(0xffc83d, { metalness: 0.8, roughness: 0.25 });
        const crown = mesh(new THREE.CylinderGeometry(W * 0.27, W * 0.25, H * 0.1, 12, 1, true), gold, 0, H * 0.92, 0);
        g.add(crown);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const sp = mesh(new THREE.ConeGeometry(W * 0.06, H * 0.09, 6), gold, Math.sin(a) * W * 0.26, H * 1.0, Math.cos(a) * W * 0.26);
            g.add(sp);
        }
        const gem = mesh(new THREE.SphereGeometry(W * 0.05, 8, 6), std(0xff2244, { emissive: 0x550011 }), 0, H * 0.92, -W * 0.27);
        g.add(gem);
        root.userData.arm = crown;
    } else {
        const robe = mesh(new THREE.ConeGeometry(W * 0.48, H * 0.6, 16), std(0x6a3fd1, { roughness: 0.85 }), 0, H * 0.3, 0);
        g.add(robe);
        face(g, H * 0.66, W * 0.32);
        const beard = mesh(new THREE.ConeGeometry(W * 0.22, H * 0.3, 10), std(0xffffff, { roughness: 1 }), 0, H * 0.5, -W * 0.22);
        beard.rotation.x = Math.PI;
        g.add(beard);
        const hat = mesh(new THREE.ConeGeometry(W * 0.4, H * 0.5, 14), std(0x6a3fd1, { roughness: 0.8 }), 0, H * 0.98, 0);
        hat.rotation.z = 0.15;
        g.add(hat);
        const brim = mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.5, H * 0.03, 16), std(0x5a32b8), 0, H * 0.76, 0);
        g.add(brim);
        const wand = mesh(new THREE.CylinderGeometry(W * 0.03, W * 0.03, H * 0.4, 6), std(0x7a4b25), W * 0.42, H * 0.45, -W * 0.1);
        wand.rotation.z = -0.5;
        g.add(wand);
        const tip = mesh(new THREE.SphereGeometry(W * 0.07, 8, 6), std(0xfff27a, { emissive: 0xfff27a, emissiveIntensity: 1 }), W * 0.53, H * 0.62, -W * 0.1);
        g.add(tip);
        root.userData.arm = wand;
    }
    // dizzy stars circling the head when bonked
    const stars = new THREE.Group();
    const starMat = std(0xffe14d, { emissive: 0xffc400, emissiveIntensity: 0.8 });
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(W * 0.12), starMat);
        s.userData.a = (i / 3) * Math.PI * 2;
        stars.add(s);
    }
    stars.position.y = H * 1.05;
    stars.visible = false;
    g.add(stars);
    root.userData.inner = g;
    root.userData.stars = stars;
    root.userData.H = H;
    return root;
}

/** Pip the Cannoneer, standing beside the cannon: a brass helmet, an orange scarf, a big grin. */
export function makePip() {
    const g = makeCharacter('knight', [0.22, 0.36, 0.2], 'Pip');
    const inner = g.userData.inner;
    inner.traverse((m) => {
        if (!m.isMesh) return;
        if (m.material.metalness > 0.8) m.material = std(0xc9993f, { metalness: 0.7, roughness: 0.35 });
    });
    const scarf = mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16), std(0xff8a2a, { roughness: 0.9 }), 0, 0.42, 0);
    scarf.rotation.x = Math.PI / 2;
    inner.add(scarf);
    return g;
}

// ------------------------------------------------------------------ cannonballs
export function makeBallMaterials() {
    return {
        iron: std(0x2b2e36, { metalness: 0.75, roughness: 0.35 }),
        boom: std(0xe63a2e, { metalness: 0.2, roughness: 0.45, emissive: 0x5a0a00 }),
        triple: std(0xbfc6d4, { metalness: 0.9, roughness: 0.25 }),
        bertha: std(0x3a3340, { metalness: 0.6, roughness: 0.5 }),
        boing: std(0xff6fb5, { roughness: 0.35, emissive: 0x4a0a2a }),
    };
}

// ------------------------------------------------------------------ flags and trees
export function makeFlag(color) {
    const cols = { red: 0xff4a4a, blue: 0x4aa8ff, gold: 0xffc83d };
    const g = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), std(0x7a5a3a), 0, 0.8, 0);
    g.add(pole);
    const geo = new THREE.PlaneGeometry(0.9, 0.5, 8, 2);
    geo.translate(0.45, 0, 0);
    const cloth = new THREE.Mesh(geo, std(cols[color] || 0xff4a4a, { side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.y = 1.32;
    cloth.castShadow = true;
    g.add(cloth);
    g.userData.cloth = cloth;
    g.userData.base = geo.attributes.position.array.slice();
    return g;
}

export function waveFlag(flag, t) {
    const pos = flag.userData.cloth.geometry.attributes.position;
    const base = flag.userData.base;
    for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.array[i * 3 + 2] = Math.sin(t * 5 + x * 5) * 0.12 * x;
    }
    pos.needsUpdate = true;
    flag.userData.cloth.geometry.computeVertexNormals();
}

export function makeTrees(rng, region, avoid) {
    const g = new THREE.Group();
    const trunkMat = std(0x7a4f2c, { roughness: 0.9 });
    const leaf = region === 'frost' ? [0x2f6b4f, 0x3c7d5d] : region === 'sunset' ? [0xe08a2e, 0xc75a2a, 0x9cab3c] : [0x4aa84a, 0x5cc25a, 0x3d9440];
    const snow = std(0xffffff, { roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7);
    const blob = new THREE.IcosahedronGeometry(1.2, 1);
    const cone = new THREE.ConeGeometry(1.1, 2.6, 8);
    for (let i = 0; i < 70; i++) {
        const a = rng() * Math.PI * 2, r = 22 + rng() * 70;
        const x = Math.sin(a) * r, z = 30 + Math.cos(a) * r;
        if (avoid(x, z)) continue;
        const t = new THREE.Group();
        t.position.set(x, 0, z);
        const s = 0.8 + rng() * 0.9;
        t.scale.setScalar(s);
        const trunk = mesh(trunkGeo, trunkMat, 0, 0.8, 0);
        t.add(trunk);
        const mat = std(leaf[Math.floor(rng() * leaf.length)], { roughness: 0.9 });
        if (region === 'frost') {
            const c = mesh(cone, mat, 0, 2.6, 0); t.add(c);
            const cap = mesh(new THREE.ConeGeometry(0.6, 1.0, 8), snow, 0, 3.55, 0); t.add(cap);
        } else {
            const b = mesh(blob, mat, 0, 2.3, 0); b.scale.set(1, 0.9, 1); t.add(b);
            const b2 = mesh(blob, mat, 0.6, 2.0, 0.3); b2.scale.setScalar(0.6); t.add(b2);
        }
        g.add(t);
    }
    return g;
}
