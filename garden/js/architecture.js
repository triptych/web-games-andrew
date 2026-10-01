// Procedural architecture: the hub colonnade and dais, genre gates, pavilions
// (dome, onion, cone, pagoda and crystal roofs), the dock and a sunken wreck,
// lamp posts, benches and the set pieces between the paths — a great gear,
// an observatory, a lighthouse, a fountain, standing stones and a clock tower
// on its own islet. Adds colliders, floors and vine anchors to `world`.

import * as THREE from 'three';
import { Batch, xf, under } from './materials.js';
import { PLAZA_R, PATH_HALF, PAVILION_PLAZA } from './layout.js';
import { HUB_Y } from './terrain.js';
import { rng, TAU, lerp } from './util.js';
import { flagstones, plazaMosaic, canvas, toTexture, glowSprite } from './textures.js';

const V2 = (x, y) => new THREE.Vector2(x, y);

export function lathe(profile, segs = 24, phiStart = 0, phiLength = TAU) {
    return new THREE.LatheGeometry(profile.map(([r, y]) => V2(Math.max(r, 0.0001), y)), segs, phiStart, phiLength);
}

/** Fluted column with base and capital, standing on y=0. */
export function columnGeo(h, r, segs = 16) {
    const p = [
        [0, 0], [r * 1.55, 0], [r * 1.55, h * 0.03], [r * 1.35, h * 0.05], [r * 1.38, h * 0.065], [r * 1.12, h * 0.08],
        [r * 1.05, h * 0.1], [r * 1.0, h * 0.5], [r * 0.9, h * 0.86], [r * 0.95, h * 0.88], [r * 0.92, h * 0.9],
        [r * 1.25, h * 0.94], [r * 1.5, h * 0.955], [r * 1.5, h], [0, h],
    ];
    const g = lathe(p, segs);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (v.y > h * 0.1 && v.y < h * 0.88) {
            const a = Math.atan2(v.z, v.x);
            const k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * (segs / 2))), 0.7);
            v.x *= k;
            v.z *= k;
            pos.setXYZ(i, v.x, v.y, v.z);
        }
    }
    g.computeVertexNormals();
    return g;
}

/** Ring beam (entablature) with a box section, optionally a partial arc. */
function ringBeam(r0, r1, h, segs, phiStart = 0, phiLength = TAU) {
    return lathe([[r0, 0], [r1, 0], [r1 + 0.08, h * 0.15], [r1, h * 0.3], [r1, h * 0.8], [r1 + 0.12, h * 0.9], [r1 + 0.12, h], [r0 - 0.05, h], [r0 - 0.05, h * 0.85], [r0, h * 0.75], [r0, 0]], segs, phiStart, phiLength);
}

/** Canvas sign with an emoji, a title and a subtitle. */
export function signTexture(emoji, title, subtitle, accent, w = 1024, h = 256) {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2a1a');
    g.addColorStop(1, '#22170e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a45c';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `${h * 0.42}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(emoji, h * 0.55, h * 0.52);
    ctx.fillText(emoji, w - h * 0.55, h * 0.52);
    ctx.fillStyle = '#f3e3bf';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.font = `600 ${h * 0.26}px Georgia, "Times New Roman", serif`;
    ctx.fillText(title, w / 2, subtitle ? h * 0.42 : h * 0.52, w - h * 1.4);
    if (subtitle) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#d9c08a';
        ctx.font = `italic ${h * 0.15}px Georgia, serif`;
        ctx.fillText(subtitle, w / 2, h * 0.72, w - h * 1.4);
    }
    return toTexture(c);
}

function signMesh(tex, w, h, emissive = 0.25) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.userData.nightGlow = mat;
    return m;
}

// ------------------------------------------------------------------- the hub

function buildHub(world, mats, batch) {
    const { layout } = world;
    const y = HUB_Y;
    const accents = [ '#d9c79f', ...layout.spokes.map((s) => s.genre.accent)];
    // mosaic disc + rim
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: plazaMosaic(layout.slots, accents), roughness: 0.8, color: 0xcfc6b6 }));
    // the mosaic is drawn with angle 0 = +z (canvas down), matching the layout
    disc.position.y = y + 0.05;
    disc.receiveShadow = true;
    world.root.add(disc);
    batch.add('granite', lathe([[PLAZA_R - 0.05, -0.6], [PLAZA_R + 0.5, -0.6], [PLAZA_R + 0.5, 0.12], [PLAZA_R + 0.35, 0.2], [PLAZA_R - 0.05, 0.2]], 96), xf(0, y, 0));

    // central dais: two steps up to the console
    batch.add('granite', new THREE.CylinderGeometry(5.2, 5.4, 0.3, 48), xf(0, y + 0.2, 0));
    batch.add('marble', new THREE.CylinderGeometry(3.7, 3.9, 0.3, 48), xf(0, y + 0.5, 0));
    world.floors.push({ x: 0, z: 0, r: 5.3, y: y + 0.35 }, { x: 0, z: 0, r: 3.8, y: y + 0.65 });

    // colonnade arcs between the path openings
    const R = PLAZA_R - 1.1, colH = 4.2, open = 0.21;
    for (let i = 0; i < layout.slots; i++) {
        const a0 = (i / layout.slots) * TAU + open, a1 = ((i + 1) / layout.slots) * TAU - open;
        const n = Math.max(2, Math.round(((a1 - a0) * R) / 2.6) + 1);
        for (let k = 0; k < n; k++) {
            const a = lerp(a0, a1, k / (n - 1));
            const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
            batch.add('marble', columnGeo(colH, 0.26), xf(cx, y + 0.18, cz, a));
            world.colliders.push({ x: cx, z: cz, r: 0.45 });
            if (k % 2 === 0) world.vines.push(helixVine(`hub${i}`, cx, y + 0.2, cz, 0.3, colH, 2.2 + (k % 3) * 0.4, i * 7 + k));
        }
        // three.js lathe angle runs from +z toward +x, same as our layout
        batch.add('marble', ringBeam(R - 0.42, R + 0.42, 0.7, 24, a0 - 0.04, a1 - a0 + 0.08), xf(0, y + 0.18 + colH, 0));
        // garland of vine along the beam
        const pts = [];
        for (let k = 0; k <= 24; k++) {
            const a = lerp(a0, a1, k / 24);
            pts.push(new THREE.Vector3(Math.sin(a) * (R + 0.48), y + colH + 0.1 - Math.sin((k / 24) * Math.PI * 4) ** 2 * 0.45, Math.cos(a) * (R + 0.48)));
        }
        world.vines.push({ key: `hub${i}`, pts, radius: 0.03, seed: i });
    }

    // stone planters with topiary inside the colonnade gaps
    for (let i = 0; i < layout.slots; i++) {
        const a = ((i + 0.5) / layout.slots) * TAU;
        const px = Math.sin(a) * (PLAZA_R - 4), pz = Math.cos(a) * (PLAZA_R - 4);
        batch.add('granite', lathe([[0, 0], [0.9, 0], [1.05, 0.1], [0.95, 0.15], [1.0, 0.7], [1.15, 0.78], [1.15, 0.88], [0.9, 0.88], [0.9, 0.6], [0, 0.6]], 20), xf(px, y + 0.05, pz));
        world.topiary.push({ x: px, y: y + 0.85, z: pz, kind: i % 2 ? 'ball' : 'cone' });
        world.colliders.push({ x: px, z: pz, r: 1.15 });
        world.flowerBeds.push({ x: px, z: pz, r0: 0.3, r1: 0.95, y: y + 0.9, colors: ['#ffffff', '#ffd6e8', '#c8e6ff'], n: 22 });
    }

    // lamps flanking every opening
    for (let i = 0; i < layout.slots; i++) {
        const a = (i / layout.slots) * TAU;
        for (const s of [-1, 1]) {
            const aa = a + s * 0.24;
            world.lampSpots.push({ x: Math.sin(aa) * (PLAZA_R + 1.2), z: Math.cos(aa) * (PLAZA_R + 1.2) });
        }
    }
}

// ----------------------------------------------------------------- pavilions

function roofGeo(style, R, segs) {
    switch (style) {
        case 'onion':
            return lathe([[R + 0.5, 0], [R + 0.7, 0.4], [R + 0.9, 1.4], [R + 0.4, 2.6], [R * 0.4, 3.6], [0.25, 4.3], [0.12, 4.9], [0, 5.0]], segs * 3);
        case 'cone':
            return lathe([[R + 0.9, 0], [R + 0.8, 0.12], [R * 0.75, 1.2], [R * 0.4, 2.6], [0.15, 4.4], [0, 4.5]], segs);
        case 'pagoda': {
            const p = [[R + 1.4, 0.35], [R + 1.1, 0.25], [R + 0.4, 0.55], [R * 0.6, 1.3], [R * 0.55, 1.35], [R * 0.55, 1.7], [R * 0.85, 1.9], [R * 0.7, 2.05], [R * 0.35, 2.7], [0.14, 3.5], [0, 3.6]];
            return lathe(p, segs);
        }
        case 'crystal':
            return lathe([[R + 0.45, 0], [R + 0.3, 0.9], [R * 0.82, 1.9], [R * 0.5, 2.7], [0.2, 3.05], [0, 3.1]], segs * 2);
        default: // dome
            return lathe([[R + 0.6, 0], [R + 0.6, 0.25], [R + 0.3, 0.35], [R + 0.2, 1.2], [R * 0.85, 2.0], [R * 0.55, 2.7], [R * 0.2, 3.05], [0, 3.1]], segs * 3);
    }
}

function buildPavilion(world, mats, batch, spoke) {
    const g = spoke.genre;
    const { x, z, y, rot } = { ...spoke.pavilion };
    const R = 3.6, cols = g.columns, colH = 3.4;
    const base = xf(x, y, z, rot);
    // plaza paving
    const fl = flagstones();
    const tex = fl.map.clone();
    tex.repeat.set(5, 5);
    tex.needsUpdate = true;
    const paving = new THREE.Mesh(new THREE.CircleGeometry(PAVILION_PLAZA, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, normalMap: fl.normalMap, roughness: 0.85, color: 0xe8e0d0 }));
    paving.position.set(x, y + 0.045, z);
    paving.receiveShadow = true;
    world.root.add(paving);
    batch.add('granite', lathe([[PAVILION_PLAZA - 0.05, -0.5], [PAVILION_PLAZA + 0.35, -0.5], [PAVILION_PLAZA + 0.35, 0.12], [PAVILION_PLAZA - 0.05, 0.14]], 64), xf(x, y, z));

    // stepped platform
    batch.add('granite', new THREE.CylinderGeometry(R + 1.5, R + 1.6, 0.25, cols * 2), under(base, xf(0, 0.12, 0, Math.PI / cols)));
    batch.add('granite', new THREE.CylinderGeometry(R + 0.9, R + 1.0, 0.25, cols * 2), under(base, xf(0, 0.37, 0, Math.PI / cols)));
    batch.add('marble', new THREE.CylinderGeometry(R + 0.55, R + 0.6, 0.12, cols * 2), under(base, xf(0, 0.55, 0, Math.PI / cols)));
    world.floors.push({ x, z, r: R + 1.5, y: y + 0.25 }, { x, z, r: R + 0.9, y: y + 0.5 }, { x, z, r: R + 0.5, y: y + 0.62 });

    const top = 0.6 + colH;
    for (let k = 0; k < cols; k++) {
        const a = ((k + 0.5) / cols) * TAU + rot;
        const cx = x + Math.sin(a) * R, cz = z + Math.cos(a) * R;
        batch.add('marble', columnGeo(colH, 0.2), xf(cx, y + 0.6, cz, a));
        world.colliders.push({ x: cx, z: cz, r: 0.35 });
        if (k % 2 === 1 || g.roof === 'pagoda') world.vines.push(helixVine(`pav${spoke.index}`, cx, y + 0.6, cz, 0.24, colH + 0.3, 2 + (k % 3) * 0.5, spoke.index * 31 + k));
    }
    batch.add('marble', ringBeam(R - 0.35, R + 0.35, 0.55, cols * 2, Math.PI / cols), under(base, xf(0, top, 0)));

    // roof
    const roofKey = g.roof === 'crystal' ? `crystal_${g.id}` : 'copper';
    if (g.roof === 'crystal') {
        world.mats[roofKey] = new THREE.MeshStandardMaterial({ color: new THREE.Color(g.accent).multiplyScalar(0.35), emissive: g.accent, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, flatShading: true });
        world.glowMats.push({ mat: world.mats[roofKey], day: 0.25, night: 1.2 });
        batch.add(roofKey, roofGeo('crystal', R, cols), under(base, xf(0, top + 0.55, 0)));
        // brass ribs
        for (let k = 0; k < cols; k++) {
            const a = (k / cols) * TAU;
            const curve = new THREE.CatmullRomCurve3([[R + 0.45, 0], [R + 0.3, 0.9], [R * 0.82, 1.9], [R * 0.5, 2.7], [0.2, 3.05]].map(([r, h]) => new THREE.Vector3(Math.sin(a) * r, h, Math.cos(a) * r)));
            batch.add('brass', new THREE.TubeGeometry(curve, 16, 0.06, 5), under(base, xf(0, top + 0.55, 0)));
        }
    } else {
        batch.add('copper', roofGeo(g.roof, R, cols), under(base, xf(0, top + 0.55, 0, Math.PI / cols)));
    }
    const roofH = { onion: 5.0, cone: 4.5, pagoda: 3.6, crystal: 3.1, dome: 3.1 }[g.roof];
    // finial
    batch.add('brass', lathe([[0.18, 0], [0.1, 0.3], [0.22, 0.55], [0.06, 0.9], [0.03, 1.5], [0, 1.6]], 12), under(base, xf(0, top + 0.5 + roofH, 0)));

    // genre crystal floating over an altar inside
    batch.add('marble', lathe([[0, 0], [0.75, 0], [0.75, 0.15], [0.45, 0.3], [0.38, 0.9], [0.6, 1.05], [0.6, 1.15], [0, 1.15]], 20), under(base, xf(0, 0.6, 0)));
    world.colliders.push({ x, z, r: 0.9 });
    const cm = new THREE.MeshStandardMaterial({ color: g.accent, emissive: g.accent, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, flatShading: true });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), cm);
    crystal.scale.set(1, 1.6, 1);
    crystal.position.set(x, y + 2.55, z);
    world.root.add(crystal);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: g.accent, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.6);
    halo.position.copy(crystal.position);
    world.root.add(halo);
    world.updaters.push((t) => {
        crystal.rotation.y = t * 0.6;
        crystal.position.y = y + 2.55 + Math.sin(t * 1.3 + spoke.index) * 0.12;
        halo.position.y = crystal.position.y;
    });

    // name board over the entrance (facing the path) and over the back
    const tex2 = signTexture(g.emoji, g.name, g.short, g.accent);
    for (const side of [0, Math.PI]) {
        const s = signMesh(tex2, 3.6, 0.9);
        const a = rot + side;
        s.position.set(x + Math.sin(a) * (R + 0.48), y + top + 0.28, z + Math.cos(a) * (R + 0.48));
        s.rotation.y = a;
        world.root.add(s);
        world.nightSigns.push(s.userData.nightGlow);
    }

    // a lamp each side of the entrance and flower beds round the plaza
    for (const s of [-1, 1]) {
        const a = rot + s * 0.45;
        world.lampSpots.push({ x: x + Math.sin(a) * (PAVILION_PLAZA - 0.6), z: z + Math.cos(a) * (PAVILION_PLAZA - 0.6) });
    }
    for (let b = 0; b < 4; b++) {
        const a = rot + Math.PI / 4 + (b * Math.PI) / 2;
        world.flowerBeds.push({ x: x + Math.sin(a) * (PAVILION_PLAZA + 1.6), z: z + Math.cos(a) * (PAVILION_PLAZA + 1.6), r0: 0, r1: 1.7, colors: g.flowers, n: 70 });
    }
}

// ---------------------------------------------------------------------- gates

function buildGate(world, mats, batch, spoke) {
    const g = spoke.genre;
    const { x, z, rot } = spoke.gate;
    const y = spoke.gate.y;
    const base = xf(x, y, z, rot);
    const half = PATH_HALF + 0.75;
    for (const s of [-1, 1]) {
        batch.add('granite', new THREE.BoxGeometry(0.9, 0.4, 0.9), under(base, xf(s * half, 0.2, 0)));
        batch.add('granite', new THREE.BoxGeometry(0.72, 3.4, 0.72), under(base, xf(s * half, 2.1, 0)));
        batch.add('granite', new THREE.BoxGeometry(0.95, 0.25, 0.95), under(base, xf(s * half, 3.9, 0)));
        const px = x + Math.cos(rot) * s * half, pz = z - Math.sin(rot) * s * half;
        world.colliders.push({ x: px, z: pz, r: 0.6 });
        world.vines.push(helixVine(`gate${spoke.index}`, px, y + 0.3, pz, 0.45, 3.7, 1.6, spoke.index * 13 + s));
    }
    // the arch
    const shape = new THREE.Shape();
    const ro = half + 0.45, ri = half - 0.3;
    shape.absarc(0, 0, ro, 0, Math.PI, false);
    shape.lineTo(-ri, 0);
    shape.absarc(0, 0, ri, Math.PI, 0, true);
    shape.lineTo(ro, 0);
    const arch = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 24 });
    arch.translate(0, 0, -0.3);
    batch.add('granite', arch, under(base, xf(0, 4.0, 0)));
    batch.add('marble', new THREE.BoxGeometry(0.5, 0.75, 0.75), under(base, xf(0, 4.0 + ro - 0.15, 0)));
    // vine draped along the arch
    const pts = [];
    for (let k = 0; k <= 30; k++) {
        const a = Math.PI * (k / 30);
        const lx = Math.cos(a) * (ro + 0.05), ly = 4.0 + Math.sin(a) * (ro + 0.05);
        const wx = x + Math.cos(rot) * lx + Math.sin(rot) * 0.32, wz = z - Math.sin(rot) * lx + Math.cos(rot) * 0.32;
        pts.push(new THREE.Vector3(wx, y + ly, wz));
    }
    world.vines.push({ key: `gate${spoke.index}`, pts, radius: 0.035, seed: spoke.index });
    // hanging sign, readable from both directions
    const tex = signTexture(g.emoji, g.short, null, g.accent, 1024, 200);
    for (const side of [0, Math.PI]) {
        const s = signMesh(tex, 3.0, 0.6);
        s.position.set(x + Math.sin(rot + side) * 0.33, y + 3.55, z + Math.cos(rot + side) * 0.33);
        s.rotation.y = rot + side;
        world.root.add(s);
        world.nightSigns.push(s.userData.nightGlow);
    }
    // chains
    for (const s of [-1, 1]) batch.add('iron', new THREE.CylinderGeometry(0.018, 0.018, 1.75, 4), under(base, xf(s * 1.3, 4.7, 0)));
    world.lampSpots.push({ x: x + Math.cos(rot) * (half + 0.9), z: z - Math.sin(rot) * (half + 0.9) });
}

// ------------------------------------------------------------- lamps, benches

/** Builds instanced lamp posts at every lamp spot; returns their glass material. */
function buildLamps(world, mats) {
    const spots = world.lampSpots;
    const post = new Batch();
    post.add('iron', new THREE.CylinderGeometry(0.16, 0.22, 0.35, 8), xf(0, 0.17, 0));
    post.add('iron', new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), xf(0, 1.6, 0));
    post.add('iron', new THREE.TorusGeometry(0.12, 0.02, 4, 12), xf(0, 2.2, 0, 0, 1, 1, 1, Math.PI / 2));
    post.add('iron', new THREE.ConeGeometry(0.26, 0.24, 4), xf(0, 3.32, 0, Math.PI / 4));
    post.add('iron', new THREE.CylinderGeometry(0.17, 0.12, 0.06, 4), xf(0, 2.88, 0, Math.PI / 4));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) post.add('iron', new THREE.BoxGeometry(0.025, 0.36, 0.025), xf(dx * 0.105, 3.04, dz * 0.105));
    const postGeo = post.build({ iron: mats.iron }).children[0].geometry;
    const glassGeo = new THREE.BoxGeometry(0.19, 0.32, 0.19).translate(0, 3.04, 0);
    const n = spots.length;
    const posts = new THREE.InstancedMesh(postGeo, mats.iron, n);
    const glass = new THREE.InstancedMesh(glassGeo, mats.glass, n);
    const m = new THREE.Matrix4();
    spots.forEach((s, i) => {
        s.y = world.groundAt(s.x, s.z);
        m.makeTranslation(s.x, s.y, s.z);
        posts.setMatrixAt(i, m);
        glass.setMatrixAt(i, m);
        world.colliders.push({ x: s.x, z: s.z, r: 0.3 });
        s.light = new THREE.Vector3(s.x, s.y + 3.05, s.z);
    });
    posts.castShadow = true;
    world.root.add(posts, glass);
}

function bench(batch, x, y, z, rot) {
    const b = xf(x, y, z, rot);
    batch.add('granite', new THREE.BoxGeometry(1.9, 0.12, 0.55), under(b, xf(0, 0.5, 0)));
    for (const s of [-1, 1]) batch.add('granite', new THREE.BoxGeometry(0.18, 0.45, 0.45), under(b, xf(s * 0.75, 0.23, 0)));
    batch.add('granite', new THREE.BoxGeometry(1.9, 0.5, 0.1), under(b, xf(0, 0.85, -0.25, 0, 1, 1, 1, -0.12)));
}

// ----------------------------------------------------------------- the dock

function buildDock(world, mats, batch) {
    const { dock } = world.layout;
    const y = dock.y;
    const len = dock.end - dock.start;
    const cz = (dock.start + dock.end) / 2;
    const deck = new THREE.BoxGeometry(3.4, 0.16, len);
    // stretch plank texture along the deck
    const uv = deck.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * len * 0.33);
    batch.add('wood', deck, xf(0, y - 0.08, cz));
    for (let zz = dock.start + 1; zz <= dock.end; zz += 3) {
        for (const s of [-1, 1]) {
            batch.add('darkWood', new THREE.CylinderGeometry(0.16, 0.18, 6, 8), xf(s * 1.75, y - 3, zz));
        }
        batch.add('darkWood', new THREE.BoxGeometry(3.7, 0.2, 0.22), xf(0, y - 0.3, zz));
    }
    // bollards with rope rings
    for (const [bx, bz] of [[-1.5, dock.end - 1.2], [1.5, dock.end - 1.2], [1.5, dock.end - 7]]) {
        batch.add('iron', lathe([[0, 0], [0.16, 0], [0.12, 0.3], [0.2, 0.42], [0.2, 0.5], [0, 0.52]], 10), xf(bx, y, bz));
        batch.add('wood', new THREE.TorusGeometry(0.17, 0.03, 5, 12), xf(bx, y + 0.12, bz, 0, 1, 1, 1, Math.PI / 2));
    }
    world.boxFloors.push({ x0: -1.7, x1: 1.7, z0: dock.start - 0.2, z1: dock.end, y });
    world.colliders.push({ x: -1.5, z: dock.end - 1.2, r: 0.25 }, { x: 1.5, z: dock.end - 1.2, r: 0.25 }, { x: 1.5, z: dock.end - 7, r: 0.25 });
    for (const l of dock.lamps) world.lampSpots.push({ ...l });

    // the wreck: two leaning masts and a dark hull under the swell
    const wx = -10.5, wz = dock.end - 3;
    const hull = lathe([[0, -1.2], [1.3, -1.0], [1.8, -0.2], [1.9, 0.4], [0, 0.4]], 12);
    hull.scale(1, 1, 3.2);
    batch.add('darkWood', hull, xf(wx, -1.25, wz, 0.5, 1, 1, 1, 0.18, 0.12));
    batch.add('darkWood', new THREE.CylinderGeometry(0.14, 0.18, 9, 8), xf(wx, 2.2, wz, 0.5, 1, 1, 1, 0.25, -0.2));
    batch.add('darkWood', new THREE.CylinderGeometry(0.1, 0.14, 6, 8), xf(wx - 1.7, 1.2, wz + 3.2, 0.5, 1, 1, 1, -0.35, 0.3));
    batch.add('darkWood', new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), xf(wx + 0.65, 5.4, wz + 0.3, 0.5, 1, 1, 1, 0.25, Math.PI / 2 - 0.25));
}

// ----------------------------------------------------------- the set pieces

function gearShape(R, teeth, toothH, hole) {
    const s = new THREE.Shape();
    const steps = teeth * 4;
    for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * TAU;
        const phase = i % 4;
        const r = phase === 1 || phase === 2 ? R + toothH : R;
        const aa = a + (phase === 1 ? 0.012 : phase === 2 ? -0.012 : 0);
        if (i === 0) s.moveTo(Math.cos(aa) * r, Math.sin(aa) * r);
        else s.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
    }
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, TAU, true);
    s.holes.push(h);
    // spokes as cut-outs
    for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * TAU + 0.18, a1 = ((k + 1) / 6) * TAU - 0.18;
        const p = new THREE.Path();
        p.moveTo(Math.cos(a0) * hole * 1.6, Math.sin(a0) * hole * 1.6);
        p.absarc(0, 0, R * 0.78, a0, a1, false);
        p.lineTo(Math.cos(a1) * hole * 1.6, Math.sin(a1) * hole * 1.6);
        s.holes.push(p);
    }
    return s;
}

function buildGear(world, batch, f) {
    const y = world.groundAt(f.x, f.z);
    const face = Math.atan2(-f.x, -f.z);
    const g = new THREE.ExtrudeGeometry(gearShape(4.2, 18, 0.55, 0.7), { depth: 1.1, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -0.55);
    batch.add('bronze', g, xf(f.x, y + 3.1, f.z, face, 1, 1, 1, 0.08, 0.1));
    const g2 = new THREE.ExtrudeGeometry(gearShape(1.7, 10, 0.35, 0.35), { depth: 0.6, bevelEnabled: false, curveSegments: 4 });
    batch.add('bronze', g2, xf(f.x + Math.cos(face) * 4.6, y + 1.2, f.z - Math.sin(face) * 4.6, face + 0.6, 1, 1, 1, 0.35, 0.4));
    batch.add('brass', new THREE.CylinderGeometry(0.55, 0.55, 1.8, 16), xf(f.x, y + 3.1, f.z, face, 1, 1, 1, Math.PI / 2));
    for (let i = -2; i <= 2; i++) world.colliders.push({ x: f.x + Math.cos(face) * i * 1.8, z: f.z - Math.sin(face) * i * 1.8, r: 1.3 });
    world.landmarks.push({ name: 'The Great Gear', x: f.x, z: f.z });
}

function buildTower(world, batch, f) {
    const y = world.groundAt(f.x, f.z) - 0.4;
    const H = 13;
    batch.add('granite', lathe([[0, 0], [3.4, 0], [3.4, 0.8], [3.0, 1.0], [2.8, H], [3.2, H + 0.2], [3.2, H + 0.9], [0, H + 0.9]], 28), xf(f.x, y, f.z));
    batch.add('copper', lathe([[3.0, 0], [2.9, 0.8], [2.4, 2.0], [1.4, 2.9], [0, 3.2]], 28), xf(f.x, y + H + 0.9, f.z));
    // telescope peeking out of the dome slit
    const face = Math.atan2(-f.x, -f.z) + 2.2;
    batch.add('brass', new THREE.CylinderGeometry(0.28, 0.4, 4.2, 14), xf(f.x + Math.sin(face) * 1.8, y + H + 3.0, f.z + Math.cos(face) * 1.8, face, 1, 1, 1, 0.9));
    // windows and door
    const toHub = Math.atan2(-f.x, -f.z);
    for (let k = 0; k < 4; k++) {
        const a = toHub + k * 1.4 + 0.3;
        const wy = 3 + k * 2.6;
        world.windows.push({ x: f.x + Math.sin(a) * 2.88, y: y + wy, z: f.z + Math.cos(a) * 2.88, rot: a, w: 0.55, h: 1.1 });
    }
    batch.add('darkWood', new THREE.BoxGeometry(1.3, 2.3, 0.2), xf(f.x + Math.sin(toHub) * 3.25, y + 1.95, f.z + Math.cos(toHub) * 3.25, toHub));
    world.colliders.push({ x: f.x, z: f.z, r: 3.6 });
    world.landmarks.push({ name: 'The Observatory', x: f.x, z: f.z });
}

function buildLighthouse(world, batch, f) {
    const y = world.groundAt(f.x, f.z) - 0.3;
    const H = 11;
    batch.add('granite', lathe([[0, 0], [2.6, 0], [2.6, 0.6], [2.2, 0.8], [1.6, H], [2.0, H + 0.2], [2.0, H + 0.45], [0, H + 0.45]], 24), xf(f.x, y, f.z));
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        batch.add('iron', new THREE.BoxGeometry(0.08, 1.7, 0.08), xf(f.x + Math.sin(a) * 1.25, y + H + 1.3, f.z + Math.cos(a) * 1.25));
    }
    batch.add('copper', lathe([[1.6, 0], [1.4, 0.3], [0.6, 1.2], [0.1, 1.7], [0, 1.8]], 16), xf(f.x, y + H + 2.15, f.z));
    batch.add('iron', new THREE.TorusGeometry(1.8, 0.05, 4, 24), xf(f.x, y + H + 1.1, f.z, 0, 1, 1, 1, Math.PI / 2));
    world.colliders.push({ x: f.x, z: f.z, r: 2.8 });
    world.beacons.push({ x: f.x, y: y + H + 1.3, z: f.z });
    world.landmarks.push({ name: 'The Lighthouse', x: f.x, z: f.z });
}

function buildFountain(world, mats, batch, f) {
    const y = world.groundAt(f.x, f.z);
    batch.add('marble', lathe([[0, 0], [3.4, 0], [3.5, 0.15], [3.5, 0.65], [3.25, 0.7], [3.2, 0.25], [0, 0.25]], 40), xf(f.x, y, f.z));
    batch.add('marble', lathe([[0, 0], [0.5, 0], [0.4, 0.6], [0.3, 1.4], [1.5, 1.6], [1.6, 1.75], [1.3, 1.78], [0.3, 1.7], [0.25, 2.3], [0.7, 2.45], [0.6, 2.55], [0.18, 2.5], [0.12, 3.0], [0.25, 3.2], [0, 3.35]], 28), xf(f.x, y + 0.2, f.z));
    const wmat = new THREE.MeshStandardMaterial({ color: 0x2a8fa0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.22, 40).rotateX(-Math.PI / 2), wmat);
    pool.position.set(f.x, y + 0.55, f.z);
    const bowl = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24).rotateX(-Math.PI / 2), wmat);
    bowl.position.set(f.x, y + 1.93, f.z);
    world.root.add(pool, bowl);
    world.updaters.push((t) => {
        wmat.color.setHSL(0.52, 0.55, 0.32 + Math.sin(t * 2) * 0.02);
    });
    world.colliders.push({ x: f.x, z: f.z, r: 3.6 });
    world.fountains.push({ x: f.x, y: y + 3.3, z: f.z, poolY: y + 0.55 });
    for (let b = 0; b < 4; b++) {
        const a = (b / 4) * TAU + 0.4;
        bench(batch, f.x + Math.sin(a) * 5.3, y, f.z + Math.cos(a) * 5.3, a + Math.PI);
        world.colliders.push({ x: f.x + Math.sin(a) * 5.3, z: f.z + Math.cos(a) * 5.3, r: 0.8 });
    }
    world.landmarks.push({ name: 'The Moon Fountain', x: f.x, z: f.z });
}

function buildStones(world, mats, batch, f) {
    const r = rng('stones' + f.angle);
    const y = world.groundAt(f.x, f.z);
    const n = 9;
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const sx = f.x + Math.sin(a) * 5.2, sz = f.z + Math.cos(a) * 5.2;
        const g = new THREE.BoxGeometry(1, 1, 1, 2, 4, 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const yy = p.getY(i);
            const taper = 1 - (yy + 0.5) * 0.35;
            p.setXYZ(i, p.getX(i) * taper + (r() - 0.5) * 0.08, yy + (r() - 0.5) * 0.05, p.getZ(i) * taper + (r() - 0.5) * 0.08);
        }
        g.computeVertexNormals();
        const h = r.range(2.6, 4.2);
        batch.add('granite', g, xf(sx, world.groundAt(sx, sz) - 0.3 + h / 2, sz, a + r.range(-0.2, 0.2), 1.1, h, 0.7, r.range(-0.06, 0.06), r.range(-0.06, 0.06)));
        world.colliders.push({ x: sx, z: sz, r: 0.75 });
        // glowing rune on the inner face
        world.runes.push({ x: f.x + Math.sin(a) * 4.82, y: world.groundAt(sx, sz) + h * 0.55, z: f.z + Math.cos(a) * 4.82, rot: a + Math.PI });
    }
    batch.add('granite', new THREE.CylinderGeometry(1.3, 1.5, 0.9, 7), xf(f.x, y + 0.3, f.z, 0.3));
    world.colliders.push({ x: f.x, z: f.z, r: 1.5 });
    world.altars.push({ x: f.x, y: y + 0.75, z: f.z });
    world.landmarks.push({ name: 'The Standing Stones', x: f.x, z: f.z });
}

function clockFaceTexture() {
    const n = 256;
    const c = canvas(n);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2e6c8';
    ctx.beginPath();
    ctx.arc(n / 2, n / 2, n / 2 - 4, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#3a2a18';
    ctx.stroke();
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    numerals.forEach((s, i) => {
        const a = (i / 12) * TAU;
        ctx.fillText(s, n / 2 + Math.sin(a) * 95, n / 2 - Math.cos(a) * 95);
    });
    return toTexture(c);
}

function buildIslet(world, mats, batch) {
    const { islet } = world.layout;
    const y = world.groundAt(islet.x, islet.z) - 0.5;
    const H = 9;
    const toHub = Math.atan2(-islet.x, -islet.z);
    const base = xf(islet.x, y, islet.z, toHub);
    batch.add('granite', new THREE.BoxGeometry(3.2, H, 3.2), under(base, xf(0, H / 2, 0)));
    batch.add('granite', new THREE.BoxGeometry(3.7, 0.4, 3.7), under(base, xf(0, H, 0)));
    batch.add('copper', new THREE.ConeGeometry(2.7, 3.0, 4, 1), under(base, xf(0, H + 1.7, 0, Math.PI / 4)));
    batch.add('brass', new THREE.SphereGeometry(0.22, 10, 8), under(base, xf(0, H + 3.3, 0)));
    // two clock faces whose hands show the garden's time of day
    const face = new THREE.MeshStandardMaterial({ map: clockFaceTexture(), emissive: 0xffe0a0, emissiveIntensity: 0.1, roughness: 0.6 });
    world.nightSigns.push(face);
    const hands = [];
    for (const side of [0, Math.PI / 2]) {
        const a = toHub + side;
        const cx = islet.x + Math.sin(a) * 1.62, cz = islet.z + Math.cos(a) * 1.62;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), face);
        disc.position.set(cx, y + H - 1.6, cz);
        disc.rotation.y = a;
        world.root.add(disc);
        for (const [len, w] of [[0.65, 0.09], [0.95, 0.05]]) {
            const hand = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.03).translate(0, len / 2 - 0.08, 0), mats.iron);
            hand.position.set(cx + Math.sin(a) * 0.03, y + H - 1.6, cz + Math.cos(a) * 0.03);
            hand.rotation.order = 'YXZ';
            hand.rotation.y = a;
            world.root.add(hand);
            hands.push({ hand, len });
        }
    }
    world.updaters.push((t, sky) => {
        const hours = sky.time * 24;
        for (const { hand, len } of hands) {
            hand.rotation.z = -(len < 0.8 ? (hours % 12) / 12 : (hours % 1)) * TAU;
        }
    });
    world.windows.push({ x: islet.x + Math.sin(toHub) * 1.62, y: y + 3.2, z: islet.z + Math.cos(toHub) * 1.62, rot: toHub, w: 0.5, h: 1.0 });
    world.landmarks.push({ name: 'The Clock Tower', x: islet.x, z: islet.z });
}

/** Glowing windows, runes and the altar flame share one emissive material. */
function buildGlows(world, mats) {
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x110a04, emissive: 0xffb050, emissiveIntensity: 0.3, roughness: 0.5 });
    world.glowMats.push({ mat: glowMat, day: 0.15, night: 2.4 });
    for (const w of world.windows) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), glowMat);
        m.position.set(w.x, w.y, w.z);
        m.rotation.y = w.rot;
        world.root.add(m);
    }
    const runeMat = mats.rune;
    world.glowMats.push({ mat: runeMat, day: 0.6, night: 2.2 });
    for (const r of world.runes) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), runeMat);
        m.position.set(r.x, r.y, r.z);
        m.rotation.y = r.rot;
        world.root.add(m);
    }
}

export function buildArchitecture(world) {
    const { layout, mats } = world;
    const batch = new Batch();
    buildHub(world, mats, batch);
    for (const sp of layout.spokes) {
        buildGate(world, mats, batch, sp);
        buildPavilion(world, mats, batch, sp);
        for (const b of sp.benches) {
            const by = world.groundAt(b.x, b.z);
            bench(batch, b.x, by, b.z, b.rot);
            world.colliders.push({ x: b.x, z: b.z, r: 0.8 });
        }
        world.lampSpots.push(...sp.lamps);
    }
    buildDock(world, mats, batch);
    for (const f of layout.features) {
        if (f.type === 'gear') buildGear(world, batch, f);
        else if (f.type === 'tower') buildTower(world, batch, f);
        else if (f.type === 'lighthouse') buildLighthouse(world, batch, f);
        else if (f.type === 'fountain') buildFountain(world, mats, batch, f);
        else if (f.type === 'stones') buildStones(world, mats, batch, f);
    }
    buildIslet(world, mats, batch);
    world.root.add(batch.build(mats));
    buildLamps(world, mats);
    buildGlows(world, mats);
}

/** A climbing vine spiralling up a column. */
export function helixVine(key, x, y, z, r, h, turns, seed) {
    const rr = rng(seed + 991);
    const pts = [];
    const a0 = rr() * TAU;
    const n = Math.ceil(turns * 18);
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = a0 + t * turns * TAU + Math.sin(t * 9 + seed) * 0.3;
        const rad = r + 0.03 + Math.sin(t * 23 + seed) * 0.015;
        pts.push(new THREE.Vector3(x + Math.cos(a) * rad, y + t * h, z + Math.sin(a) * rad));
    }
    return { key, pts, radius: 0.028, seed };
}
