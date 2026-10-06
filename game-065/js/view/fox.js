/**
 * fox.js — the Fox Spirit: a small stylised kitsune.
 *
 * Built from smooth tapered tubes (body, neck, muzzle, legs, a bushy tail) and
 * a few shaped parts, all in one fur material with vertex colours: russet on
 * top, cream on the belly, chest, cheeks and tail tip, near-black socks and ear
 * tips. A sheen term gives the fur a soft rim. Foxfire burns at the tail tip
 * and two little flames circle the fox.
 *
 * The model faces +x, stands on y = 0 and is ~0.6 units tall at the ears.
 * animateFox() trots it (legs in diagonal pairs), and now and then it stops,
 * sits back a little, and looks at the tree.
 */

import * as THREE from 'three';
import { bake, featureMat, featureDark, colorize as kitColorize } from './kit.js';

const RUSSET = new THREE.Color(0xe0773a);
const RUSSET_DARK = new THREE.Color(0xa8471c);
const CREAM = new THREE.Color(0xfff1df);
const SOCK = new THREE.Color(0x2a1a14);

let furMat = null, flameMap = null;
/** The foxfire flame from the critter atlas (bottom-left cell), shared by every fox. */
function foxfireMap(textures) {
    if (!textures.critters) return textures.glow;
    if (!flameMap) {
        flameMap = textures.critters.clone();
        flameMap.repeat.set(0.5, 0.5);
        flameMap.offset.set(0, 0);
        flameMap.needsUpdate = true;
    }
    return flameMap;
}
function fur() {
    if (!furMat) {
        furMat = new THREE.MeshPhysicalMaterial({
            vertexColors: true, roughness: 0.78, metalness: 0,
            sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffd2a8),
            emissive: 0xffffff, emissiveIntensity: 0.16,
        });
        // A spirit glows faintly in its own colours: emissive × vertex colour, so the
        // fox still reads as russet and cream away from the tree's light and in fog.
        furMat.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace(
                'vec3 totalEmissiveRadiance = emissive;',
                'vec3 totalEmissiveRadiance = emissive * vColor.rgb;');
        };
    }
    return furMat;
}

/**
 * A tube along a smooth curve through `pts`, with radius radiusAt(t) (t 0..1,
 * ends should go to ~0 so they close) and colour colorAt(t, normal).
 */
function tube(pts, radiusAt, colorAt, seg = 24, radial = 14, squash = null) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [], col = [], idx = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        curve.getPointAt(t, p);
        const r = radiusAt(t);
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
            const sx = squash ? squash(t, a) : 1;
            pos.push(p.x + n.x * r * sx, p.y + n.y * r * sx, p.z + n.z * r);
            colorAt(t, n, c);
            col.push(c.r, c.g, c.b);
        }
    }
    for (let i = 0; i < seg; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * (radial + 1) + j, b = a + radial + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    fixWinding(g, pts[0], pts[pts.length - 1]);
    return g;
}

/** Make sure a closed-ish tube faces outward (Frenet frames can flip handedness). */
function fixWinding(g, a, b) {
    const pos = g.attributes.position, nor = g.attributes.normal;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    let out = 0;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nor, i);
        out += Math.sign(nn.dot(v.sub(mid)));
    }
    if (out < 0) {
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        g.index.needsUpdate = true;
        g.computeVertexNormals();
    }
}

/** A sphere-ish part with per-vertex colour from its normal. */
function blob(r, sx, sy, sz, colorAt, w = 20, h = 14) {
    const g = new THREE.SphereGeometry(r, w, h);
    g.scale(sx, sy, sz);
    const n = g.attributes.normal, col = [];
    const c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) { colorAt(v.fromBufferAttribute(n, i), c); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

const mix = (a, b, t, out) => out.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const bellyColor = (n, c, lo = -0.2, hi = -0.65) => mix(RUSSET, CREAM, smooth(lo, hi, n.y), c);

export function makeFox(textures) {
    const g = new THREE.Group();
    const body = new THREE.Group();       // everything that bobs with the gait
    body.position.y = -0.055;             // legs are 0.055 shorter than the part positions assume
    g.add(body);
    const M = fur();
    const add = (geo, parent = body) => { const m = new THREE.Mesh(geo, M); parent.add(m); return m; };

    // ---- torso: hips to chest, deeper at the chest, cream underneath
    add(tube(
        [new THREE.Vector3(-0.21, 0.335, 0), new THREE.Vector3(-0.05, 0.345, 0), new THREE.Vector3(0.1, 0.36, 0), new THREE.Vector3(0.2, 0.37, 0)],
        (t) => (0.095 + 0.03 * t) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.45) + 0.004,
        (t, n, c) => bellyColor(n, c, -0.15 + t * 0.25, -0.6 + t * 0.2),
        26, 16,
    ));
    // chest ruff
    add(blob(0.085, 1, 1.05, 1.05, (n, c) => mix(RUSSET, CREAM, smooth(0.1, 0.6, n.x) + smooth(-0.1, -0.5, n.y), c)))
        .position.set(0.21, 0.33, 0);

    // ---- neck + head (head group turns to look at things)
    add(tube(
        [new THREE.Vector3(0.16, 0.38, 0), new THREE.Vector3(0.25, 0.45, 0), new THREE.Vector3(0.3, 0.5, 0)],
        (t) => 0.072 - t * 0.012 + 0.012 * Math.sin(Math.PI * t),
        (t, n, c) => bellyColor(n, c, 0, -0.5), 10, 14,
    ));
    const head = new THREE.Group();
    head.position.set(0.31, 0.52, 0);
    body.add(head);
    // skull: a little wider than tall, cream jaw
    add(blob(0.095, 1.05, 0.9, 1.08, (n, c) => mix(RUSSET, CREAM, smooth(-0.15, -0.55, n.y) + smooth(0.55, 0.9, n.x) * smooth(0.2, -0.4, n.y), c)), head)
        .position.set(0.0, 0.01, 0);
    // muzzle: tapers to the nose, cream underneath and at the tip
    add(tube(
        [new THREE.Vector3(0.03, -0.005, 0), new THREE.Vector3(0.1, -0.022, 0), new THREE.Vector3(0.18, -0.04, 0)],
        (t) => (0.058 - t * 0.04) * Math.pow(Math.sin(Math.PI * (0.5 + t * 0.5)), 0.25) + 0.003,
        (t, n, c) => mix(RUSSET, CREAM, smooth(0.05, -0.45, n.y) + smooth(0.6, 0.95, t) * 0.5, c),
        12, 14, (t, a) => 0.85 + 0.15 * Math.abs(Math.cos(a)),
    ), head);
    const nose = new THREE.Mesh(kitColorize(new THREE.SphereGeometry(0.017, 12, 8).scale(1, 0.8, 1.15), featureDark), featureMat());
    nose.position.set(0.18, -0.035, 0);
    head.add(nose);
    // cheek ruffs: soft cream tufts pointing back and out
    for (const s of [-1, 1]) {
        const ruff = add(new THREE.ConeGeometry(0.032, 0.075, 12).rotateZ(Math.PI / 2 + 0.6), head);
        colorize(ruff.geometry, CREAM);
        ruff.position.set(-0.025, -0.045, s * 0.07);
        ruff.rotation.y = s * 0.45;
    }
    // eyes: almond, glowing spirit-cyan with a dark rim
    const F = featureMat();
    const tint = (geo, hex) => kitColorize(geo, new THREE.Color(hex));
    for (const s of [-1, 1]) {
        // out from the skull's centre along the eye direction, so both sit on the surface
        const dir = new THREE.Vector3(0.8, 0.14, s * 0.58).normalize();
        const at = (k) => new THREE.Vector3(0, 0.01, 0).addScaledVector(dir, k);
        // flat axis (local z) along the surface normal, long axis level, tilted up at the outer corner
        const look = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)))
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * 0.3));
        const rim = new THREE.Mesh(tint(new THREE.SphereGeometry(0.022, 16, 10).scale(1.35, 0.75, 0.35), 0x120a08), F);
        rim.position.copy(at(0.092)); rim.quaternion.copy(look);
        const eye = new THREE.Mesh(tint(new THREE.SphereGeometry(0.0165, 16, 10).scale(1.3, 0.7, 0.35), 0x8ff6ff), F);
        eye.position.copy(at(0.097)); eye.quaternion.copy(look);
        const pupil = new THREE.Mesh(tint(new THREE.SphereGeometry(0.0075, 10, 8).scale(0.55, 1.2, 0.3), 0x120a08), F);
        pupil.position.copy(at(0.1006)); pupil.quaternion.copy(look);
        const glint = new THREE.Mesh(tint(new THREE.SphereGeometry(0.0035, 8, 6), 0xffffff), F);
        glint.position.copy(at(0.1025)).add(new THREE.Vector3(0.002, 0.005, 0));
        head.add(rim, eye, pupil, glint);
    }
    // ears: tall triangles, russet with black tips and a cream inner face
    const ears = [];
    for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(-0.015, 0.075, s * 0.05);
        ear.rotation.set(s * -0.32, 0, -0.12);
        const outer = add(new THREE.ConeGeometry(0.044, 0.13, 4, 3).scale(1, 1, 0.55).rotateY(Math.PI / 4).translate(0, 0.065, 0), ear);
        colorByHeight(outer.geometry, (y, c) => mix(RUSSET, SOCK, smooth(0.075, 0.105, y), c));
        const inner = add(new THREE.ConeGeometry(0.028, 0.09, 4).scale(1, 1, 0.35).rotateY(Math.PI / 4).translate(0.012, 0.05, 0), ear);
        colorize(inner.geometry, CREAM);
        head.add(ear);
        ears.push(ear);
    }

    // ---- legs: hinge at the top, slender, dark socks, a paw
    const legs = [];
    const legSpec = [[0.15, 0.055, 0], [0.15, -0.055, 1], [-0.16, 0.06, 1], [-0.16, -0.06, 0]];   // x, z, gait phase (diagonal pairs)
    for (const [x, z, ph] of legSpec) {
        const hip = new THREE.Group();
        hip.position.set(x, 0.32, z);
        const back = x < 0;
        const top = back ? 0.05 : 0.035;
        add(tube(
            [new THREE.Vector3(0, 0, 0), new THREE.Vector3(back ? -0.025 : 0.01, -0.125, 0), new THREE.Vector3(0.005, -0.235, 0)],
            (t) => top * (1 - t * 0.55) + 0.006,
            (t, n, c) => mix(back ? RUSSET : RUSSET_DARK, SOCK, smooth(0.42, 0.62, t), c),
            12, 10,
        ), hip);
        const paw = add(blob(0.028, 1.4, 0.65, 1, (n, c) => c.copy(SOCK), 12, 8), hip);
        paw.position.set(0.018, -0.242, 0);
        body.add(hip);
        legs.push({ hip, ph, back });
    }

    // ---- tail: big and bushy, cream tip, hinged at the base
    const tail = new THREE.Group();
    tail.position.set(-0.2, 0.36, 0);
    body.add(tail);
    add(tube(
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.12, -0.035, 0), new THREE.Vector3(-0.27, 0.0, 0), new THREE.Vector3(-0.39, 0.09, 0), new THREE.Vector3(-0.45, 0.2, 0)],
        (t) => (0.03 + 0.088 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.85)) * (t > 0.93 ? Math.sqrt(Math.max(0, (1 - t) / 0.07)) : 1) + 0.004,
        (t, n, c) => mix(mix(RUSSET, RUSSET_DARK, 0.25 * smooth(0.1, -0.6, n.y), c), CREAM, smooth(0.72, 0.8, t), c),
        30, 16,
    ), tail);
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: foxfireMap(textures), color: 0x9fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.scale.set(0.22, 0.3, 1);
    fire.position.set(-0.46, 0.33, 0);
    tail.add(fire);


    // ---- two little foxfires circling the fox
    const wisps = [];
    for (let k = 0; k < 2; k++) {
        const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0x9ff0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        w.scale.setScalar(0.16);
        g.add(w);
        wisps.push(w);
    }

    g.userData = { body, head, ears, legs, tail, fire, wisps, walk: 0, pause: 0, twitch: 0 };
    return bake(g);
}

function colorize(geo, color) {
    const n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
function colorByHeight(geo, fn) {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(p.getY(i), c); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/**
 * Trot or pause. `moving` says whether the fox is travelling this frame;
 * `lookYaw` is the head turn (radians) to face the tree while paused.
 */
export function animateFox(f, t, dt, moving, lookYaw, i = 0) {
    const u = f.userData;
    u.pause += ((moving ? 0 : 1) - u.pause) * Math.min(1, dt * 4);
    const run = 1 - u.pause;
    const cyc = t * 9 + i;
    // legs: diagonal pairs swing together; paused legs settle, back legs fold a little to sit
    for (const L of u.legs) {
        const swing = Math.sin(cyc + L.ph * Math.PI) * 0.62 * run;
        L.hip.rotation.z = swing + (L.back ? -0.55 : 0.1) * u.pause;
    }
    // body bobs twice per stride, tilts back when sitting
    u.body.position.y = -0.055 + Math.abs(Math.sin(cyc)) * 0.016 * run - 0.035 * u.pause;
    u.body.rotation.z = 0.2 * u.pause + Math.sin(cyc * 2) * 0.015 * run;
    // head: steady while trotting, turns to look while paused
    u.head.rotation.y = lookYaw * u.pause;
    u.head.rotation.z = -0.1 * u.pause + Math.sin(cyc * 2 + 0.6) * 0.03 * run;
    // ears twitch now and then
    u.twitch = Math.max(0, u.twitch - dt);
    if (u.twitch === 0 && Math.random() < dt * 0.4) u.twitch = 0.25;
    const tw = u.twitch > 0 ? Math.sin((0.25 - u.twitch) * 40) * 0.25 : 0;
    u.ears[0].rotation.x = 0.32 + tw; u.ears[1].rotation.x = -0.32;
    // tail: swishes, lifts while running, curls down when sitting
    u.tail.rotation.y = Math.sin(t * 2.6 + i) * (0.28 + 0.2 * u.pause);
    u.tail.rotation.z = 0.12 * run - 0.25 * u.pause + Math.sin(cyc) * 0.05 * run;
    // flames
    u.fire.material.opacity = 0.75 + Math.sin(t * 7 + i) * 0.25;
    u.fire.scale.set(0.22, 0.3 + Math.sin(t * 9 + i) * 0.04, 1);
    u.wisps.forEach((w, k) => {
        const a = t * (1.4 + k * 0.5) + k * Math.PI + i;
        w.position.set(Math.cos(a) * 0.32, 0.5 + Math.sin(t * 2.3 + k * 2) * 0.08, Math.sin(a) * 0.32);
        w.material.opacity = 0.6 + Math.sin(t * 6 + k * 3) * 0.3;
    });
}
