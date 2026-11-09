// The Glowing Well, a few paces from the Hearthgarden (the cozy & sims
// pavilion): a round stone well on a paved apron, a little gabled roof on two
// posts, a windlass with a rope that goes down into the dark, a wooden bucket
// on the curb and a small tin watering can on the flagstones. Something green
// shines at the bottom, and wisps of it drift up the shaft after dark.
// Walk up to the curb, or click the well, and you slide down the rope to the
// garden below (grotto.js). Registers itself on `world` as `well`.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { signMesh, signTexture, lathe } from './architecture.js';
import { flagstones, glowSprite, canvas, toTexture } from './textures.js';
import { WELL_APRON } from './terrain.js';
import { rng, TAU, smoothstep } from './util.js';

export const WELL_ACCENT = '#8affc8';
const CURB_IN = 1.0, CURB_OUT = 1.42, CURB_H = 0.92;
const ROOF_Y = 2.55;

/** True while (x, z) is close enough to the curb to climb over it. */
export function atWell(w, x, z) {
    return Math.hypot(x - w.x, z - w.z) < 2.45;
}

/** A twisted-rope texture: diagonal strands that repeat along the tube. */
function ropeTexture() {
    const c = canvas(32, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#9b7b45';
    g.fillRect(0, 0, 32, 128);
    for (let i = -4; i < 12; i++) {
        g.strokeStyle = i % 2 ? '#c9a766' : '#6e5430';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(-4, i * 16);
        g.lineTo(36, i * 16 + 22);
        g.stroke();
    }
    const t = toTexture(c);
    return t;
}

export function ropeMaterial() {
    const t = ropeTexture();
    t.repeat.set(1, 18);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: 0xe6d2a8 });
}

/** The painted dark of the shaft seen from above: stones in rings, a green glow far down. */
function shaftTexture() {
    const n = 256;
    const c = canvas(n);
    const g = c.getContext('2d');
    g.fillStyle = '#010302';
    g.fillRect(0, 0, n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n * 0.5);
    gr.addColorStop(0, 'rgba(150, 255, 210, 0.95)');
    gr.addColorStop(0.18, 'rgba(60, 200, 150, 0.55)');
    gr.addColorStop(0.5, 'rgba(10, 70, 60, 0.35)');
    gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
    // rings of laid stone, closer together towards the glow, as if seen in perspective
    g.strokeStyle = 'rgba(8, 28, 22, 0.8)';
    for (let k = 0; k < 7; k++) {
        const r = n * 0.5 * (1 - k / 8) ** 1.6;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(n / 2, n / 2, r, 0, TAU);
        g.stroke();
    }
    g.lineWidth = 2;
    for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU;
        g.beginPath();
        g.moveTo(n / 2 + Math.cos(a) * n * 0.1, n / 2 + Math.sin(a) * n * 0.1);
        g.lineTo(n / 2 + Math.cos(a) * n * 0.5, n / 2 + Math.sin(a) * n * 0.5);
        g.stroke();
    }
    // the edge goes black so it meets the curb's inner wall without a seam
    const edge = g.createRadialGradient(n / 2, n / 2, n * 0.34, n / 2, n / 2, n * 0.5);
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    g.fillStyle = edge;
    g.fillRect(0, 0, n, n);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A soft vertical column of light, brightest at the foot. */
function beamTexture() {
    const c = canvas(32, 128);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 128);
    const sides = g.createLinearGradient(0, 0, 32, 0);
    sides.addColorStop(0, 'rgba(0,0,0,1)');
    sides.addColorStop(0.5, 'rgba(0,0,0,0)');
    sides.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = sides;
    g.fillRect(0, 0, 32, 128);
    return new THREE.CanvasTexture(c);
}

export function buildWell(world) {
    const site = world.layout.well;
    if (!site) return null;
    const { mats } = world;
    const R = rng('glowing-well');
    const y = world.groundAt(site.x, site.z);
    const face = site.face;
    const root = new THREE.Group();
    root.position.set(site.x, y, site.z);
    root.rotation.y = face;
    world.root.add(root);

    // local (lx, lz) to world, for colliders and the spots people stand on
    const toWorld = (lx, lz) => ({ x: site.x + lx * Math.cos(face) + lz * Math.sin(face), z: site.z - lx * Math.sin(face) + lz * Math.cos(face) });

    // ---- the apron: flagstones in a granite kerb, mossy where the grass comes in
    const fl = flagstones();
    const tex = fl.map.clone();
    tex.repeat.set(2.4, 2.4);
    tex.needsUpdate = true;
    const paving = new THREE.Mesh(new THREE.CircleGeometry(WELL_APRON, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, normalMap: fl.normalMap, roughness: 0.85, color: 0xd6e0cc }));
    paving.position.y = 0.045;
    paving.receiveShadow = true;
    root.add(paving);

    const batch = new Batch();
    const here = (lx, ly, lz, ry = 0, ...rest) => xf(lx, ly, lz, ry, ...rest);
    batch.add('granite', lathe([[WELL_APRON - 0.05, -0.5], [WELL_APRON + 0.3, -0.5], [WELL_APRON + 0.3, 0.1], [WELL_APRON - 0.05, 0.12]], 48), here(0, 0, 0));

    // ---- the curb: two courses of blocks in a ring and a cap of slabs, one worn step round the foot
    batch.add('granite', lathe([[CURB_OUT + 0.38, 0], [CURB_OUT + 0.38, 0.1], [CURB_OUT + 0.2, 0.17], [CURB_OUT, 0.17], [0, 0.17], [0, 0]], 40), here(0, 0, 0));
    const blocks = 18, blockW = (TAU * ((CURB_IN + CURB_OUT) / 2)) / blocks;
    for (let course = 0; course < 2; course++) {
        for (let k = 0; k < blocks; k++) {
            const a = ((k + course * 0.5) / blocks) * TAU;
            const r = (CURB_IN + CURB_OUT) / 2 + R.range(-0.025, 0.025);
            const key = (k + course) % 3 === 0 ? 'sandstone' : 'granite';
            batch.add(key, new THREE.BoxGeometry(blockW * 0.97, 0.38, CURB_OUT - CURB_IN), here(Math.sin(a) * r, 0.17 + 0.19 + course * 0.39, Math.cos(a) * r, a + R.range(-0.03, 0.03)));
        }
    }
    // (neighbouring slabs overlap a little at the inner edge, so every other one stands a hair
    // taller: two coplanar tops would shimmer where their textures disagree)
    for (let k = 0; k < blocks; k++) {
        const a = ((k + 0.25) / blocks) * TAU;
        const r = (CURB_IN + CURB_OUT) / 2 + 0.02;
        const lift = k % 2 ? 0.012 : 0;
        batch.add('marble', new THREE.BoxGeometry(blockW * 1.04, 0.1 + lift, CURB_OUT - CURB_IN + 0.14), here(Math.sin(a) * r, CURB_H + 0.05 + lift / 2, Math.cos(a) * r, a));
    }

    // ---- the frame: two posts out beyond the curb, a ridge beam and a little pitched roof
    const post = (s) => {
        batch.add('darkWood', new THREE.BoxGeometry(0.2, ROOF_Y, 0.2), here(s * 1.62, ROOF_Y / 2, 0));
        batch.add('granite', new THREE.BoxGeometry(0.5, 0.3, 0.5), here(s * 1.62, 0.15, 0));
        // knees bracing the post to the beam
        batch.add('darkWood', new THREE.BoxGeometry(0.1, 0.62, 0.1), here(s * 1.34, ROOF_Y - 0.4, 0, 0, 1, 1, 1, 0, s * 0.8));
    };
    post(-1);
    post(1);
    batch.add('darkWood', new THREE.BoxGeometry(3.7, 0.2, 0.22), here(0, ROOF_Y - 0.1, 0));
    // the roof: two slopes meeting in a ridge along the windlass, copper gone green
    const slope = 0.74;
    for (const s of [-1, 1]) {
        batch.add('copper', new THREE.BoxGeometry(4.3, 0.07, 1.62), here(0, ROOF_Y + 0.45, s * 0.6, 0, 1, 1, 1, s * slope));
    }
    batch.add('darkWood', new THREE.BoxGeometry(4.4, 0.11, 0.11), here(0, ROOF_Y + 1.0, 0));
    for (const s of [-1, 1]) {
        batch.add('darkWood', new THREE.BoxGeometry(0.13, 0.12, 1.9), here(s * 2.1, ROOF_Y + 0.42, 0, 0, 1, 1, 1, 0, 0));
        batch.add('brass', new THREE.ConeGeometry(0.07, 0.34, 6), here(s * 2.2, ROOF_Y + 1.05, 0));
    }
    // gable ends: dark boards under the ridge
    for (const s of [-1, 1]) {
        batch.add('darkWood', new THREE.BoxGeometry(0.05, 0.62, 0.78), here(s * 1.92, ROOF_Y + 0.38, 0));
    }

    // ---- the windlass, the crank at the right-hand end and the coil of rope on the drum
    const WY = ROOF_Y - 0.5;
    batch.add('wood', new THREE.CylinderGeometry(0.13, 0.13, 3.3, 10).rotateZ(Math.PI / 2), here(0, WY, 0));
    for (const s of [-1, 1]) batch.add('iron', new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10).rotateZ(Math.PI / 2), here(s * 1.52, WY, 0));
    batch.add('iron', new THREE.BoxGeometry(0.06, 0.52, 0.06), here(1.86, WY - 0.24, 0));
    batch.add('wood', new THREE.CylinderGeometry(0.045, 0.045, 0.34, 6).rotateZ(Math.PI / 2), here(2.0, WY - 0.5, 0));

    // ---- the wooden bucket on the curb and a tin watering can on the flagstones
    const bx = Math.sin(0.55) * 1.2, bz = Math.cos(0.55) * 1.2;
    batch.add('wood', new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), here(bx, CURB_H + 0.2, bz));
    for (const [ly, rr] of [[0.1, 0.153], [0.26, 0.19]]) batch.add('iron', new THREE.TorusGeometry(rr, 0.014, 4, 14).rotateX(Math.PI / 2), here(bx, CURB_H + ly + 0.05, bz));
    batch.add('iron', new THREE.TorusGeometry(0.19, 0.012, 4, 10, Math.PI).rotateY(0), here(bx, CURB_H + 0.36, bz, 0.5));
    const cx = 1.9, cz = 1.95;
    batch.add('brass', new THREE.CylinderGeometry(0.17, 0.2, 0.34, 12), here(cx, 0.22, cz));
    batch.add('brass', new THREE.CylinderGeometry(0.03, 0.045, 0.5, 6), here(cx - 0.27, 0.42, cz + 0.11, 0, 1, 1, 1, 0, 0.9));
    batch.add('brass', new THREE.CylinderGeometry(0.075, 0.02, 0.05, 8), here(cx - 0.5, 0.64, cz + 0.2, 0, 1, 1, 1, 0.2, 0.9));
    batch.add('brass', new THREE.TorusGeometry(0.17, 0.015, 4, 12, Math.PI).rotateX(Math.PI / 2), here(cx, 0.46, cz));
    batch.add('brass', new THREE.TorusGeometry(0.12, 0.014, 4, 10, Math.PI).rotateZ(Math.PI / 2), here(cx + 0.19, 0.28, cz, 0));

    root.add(batch.build(mats));

    // ---- the inside of the curb, and the shaft seen from above (the terrain runs under it, so it is painted on a disc)
    const wellMat = new THREE.MeshStandardMaterial({ color: 0x20302a, roughness: 1, side: THREE.BackSide });
    // (a little inside the blocks' inner faces, not on them, and no taller than the slabs that cap them)
    const innerH = CURB_H + 0.05 - 0.09;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(CURB_IN - 0.03, CURB_IN - 0.03, innerH, 28, 1, true), wellMat);
    inner.position.y = 0.09 + innerH / 2;
    root.add(inner);
    const shaft = new THREE.Mesh(new THREE.CircleGeometry(CURB_IN + 0.01, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shaftTexture(), polygonOffset: true, polygonOffsetFactor: -4 }));
    shaft.position.y = 0.19;
    root.add(shaft);

    // ---- the rope: from the drum, straight down into the dark; and a knotted loop of it you can see
    const rope = ropeMaterial();
    const ropeGeo = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, WY - 0.02, 0.0), new THREE.Vector3(0, 0.0, 0.0)), 1, 0.034, 8);
    const ropeMesh = new THREE.Mesh(ropeGeo, rope);
    root.add(ropeMesh);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.62, 14).rotateZ(Math.PI / 2), rope);
    coil.position.set(0, WY, 0);
    root.add(coil);
    // knots every half-metre down it, so it reads as something to climb
    const knotGeo = new THREE.SphereGeometry(0.06, 8, 6);
    for (let ky = WY - 0.55; ky > 0.35; ky -= 0.5) {
        const k = new THREE.Mesh(knotGeo, rope);
        k.position.set(0, ky, 0);
        root.add(k);
    }

    // ---- a lantern from the beam, and the name board over the front
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc27a, emissiveIntensity: 0.4, roughness: 0.3 });
    world.glowMats.push({ mat: lampMat, day: 0.35, night: 2.6 });
    const lx = -1.0, lz = 0.2;
    const lantern = new THREE.Group();
    lantern.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mats.iron).translateY(0.35));
    lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.26, 0.17), lampMat));
    lantern.add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 4).rotateY(Math.PI / 4), mats.iron).translateY(0.18));
    lantern.position.set(lx, ROOF_Y - 0.45, lz);
    root.add(lantern);
    const lanternHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffc27a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    lanternHalo.scale.setScalar(1.5);
    lanternHalo.position.copy(lantern.position);
    root.add(lanternHalo);

    const sign = signMesh(signTexture('\u{1F331}', 'The Glowing Well', 'a rope goes down', WELL_ACCENT, 1024, 256), 1.5, 0.375, 0.3);
    // lying in the roof's own plane (its normal is the slab's), a centimetre and a bit above the copper
    sign.position.set(0, ROOF_Y + 0.45 + 0.047 * Math.cos(slope), 0.6 + 0.047 * Math.sin(slope));
    sign.rotation.set(slope - Math.PI / 2, 0, 0);
    root.add(sign);
    world.nightSigns.push(sign.userData.nightGlow);

    // ---- glowing things coming up out of the shaft: a faint column of light and wisps that drift up and fade
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0x7dffc8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.95, 3.6, 20, 1, true), beamMat);
    beam.position.y = 0.2 + 1.8;
    root.add(beam);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x6affc0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.6);
    glow.position.y = 0.35;
    root.add(glow);

    const N = 22;
    const wisp = [];
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) wisp.push({ a: R() * TAU, r: R.range(0.05, 0.75), t: R(), sp: R.range(0.06, 0.14), w: R.range(0.5, 1.4) });
    const wispGeo = new THREE.BufferGeometry();
    wispGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    wispGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const wispPts = new THREE.Points(wispGeo, new THREE.PointsMaterial({ map: glowSprite(), size: 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    wispPts.frustumCulled = false;
    root.add(wispPts);

    // ---- glowing things at the foot of the posts, a hint of what grows below
    const bloomMat = new THREE.MeshStandardMaterial({ color: 0x0a2a24, emissive: 0x7dffc8, emissiveIntensity: 1.0, roughness: 0.5 });
    const bloomMat2 = new THREE.MeshStandardMaterial({ color: 0x2a0a22, emissive: 0xff7ad9, emissiveIntensity: 1.0, roughness: 0.5 });
    world.glowMats.push({ mat: bloomMat, day: 0.5, night: 2.2 }, { mat: bloomMat2, day: 0.5, night: 2.2 });
    const stem = new THREE.MeshStandardMaterial({ color: 0x3b5a3a, roughness: 0.9 });
    const tufts = [[-2.35, -0.9], [-2.6, 0.4], [-2.2, 1.4], [2.45, -1.1], [2.65, 0.1], [0.4, -2.75], [-0.9, -2.7], [1.4, -2.5]];
    tufts.forEach(([tx, tz], i) => {
        for (let k = 0; k < 3; k++) {
            const a = R() * TAU, d = R.range(0.05, 0.28), h = R.range(0.22, 0.5);
            const px = tx + Math.cos(a) * d, pz = tz + Math.sin(a) * d;
            const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 4), stem);
            s.position.set(px, 0.05 + h / 2, pz);
            root.add(s);
            const mat = (i + k) % 2 ? bloomMat : bloomMat2;
            const b = new THREE.Mesh((i + k) % 3 === 0 ? new THREE.SphereGeometry(0.06, 8, 6) : new THREE.ConeGeometry(0.07, 0.11, 7, 1, true).rotateX(Math.PI), mat);
            b.position.set(px, 0.05 + h + 0.03, pz);
            root.add(b);
        }
    });

    // ---- solid: the curb in a ring of circles, the posts, the bucket's side of things left open for the trigger
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const p = toWorld(Math.sin(a) * 1.15, Math.cos(a) * 1.15);
        world.colliders.push({ x: p.x, z: p.z, r: 0.5 });
    }
    for (const s of [-1, 1]) {
        const p = toWorld(s * 1.62, 0);
        world.colliders.push({ x: p.x, z: p.z, r: 0.3 });
    }

    // ---- the pointer's target: the whole well, upright
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.7;
    hit.userData.kind = 'well';
    root.add(hit);
    root.updateMatrixWorld(true);

    const front = toWorld(0, 3.3);
    const stand = toWorld(0, 2.15);
    const out = toWorld(0.6, 2.9);
    const well = {
        x: site.x, y, z: site.z, face, group: root, hit, near: 0,
        front, stand,
        // come back out beside the curb, facing the well
        out: { x: out.x, z: out.z, yaw: face + 0.2 },
        top: y + CURB_H + 0.2,
    };

    const c = new THREE.Color();
    world.updaters.push((t, sky) => {
        const night = sky?.state?.night ?? 0;
        const near = well.near;
        const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
        beamMat.opacity = (0.025 + 0.2 * night + 0.1 * near) * pulse;
        glow.material.opacity = (0.35 + 0.35 * night + 0.15 * near) * pulse;
        lanternHalo.material.opacity = 0.05 + 0.55 * night;
        lantern.rotation.z = Math.sin(t * 0.9) * 0.025;
        for (let i = 0; i < N; i++) {
            const w = wisp[i];
            const u = (w.t + t * w.sp) % 1;
            const sway = Math.sin(t * w.w + i) * 0.14;
            pos[i * 3] = Math.cos(w.a + t * 0.3) * (w.r * (0.5 + u * 0.6)) + sway;
            pos[i * 3 + 1] = 0.25 + u * 3.3;
            pos[i * 3 + 2] = Math.sin(w.a + t * 0.3) * (w.r * (0.5 + u * 0.6)) + sway * 0.6;
            const fade = smoothstep(0, 0.12, u) * (1 - smoothstep(0.55, 1, u)) * (0.45 + 0.55 * night);
            c.setHSL(0.42 + 0.1 * Math.sin(i * 1.7), 0.8, 0.65).multiplyScalar(fade);
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }
        wispGeo.attributes.position.needsUpdate = true;
        wispGeo.attributes.color.needsUpdate = true;
    });

    world.landmarks.push({ name: 'The Glowing Well', x: site.x, z: site.z, stand: { x: front.x, z: front.z, yaw: face } });
    world.well = well;
    return well;
}
