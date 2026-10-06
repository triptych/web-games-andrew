/**
 * models.js — the larger spirits and the grove's furniture, built with kit.js.
 *
 * Every walking model faces +x and stands on y = 0.
 *   Treant        a lumbering walking tree with a carved face, root feet, twig hands and a leafy crown
 *   White Stag    an elegant deer with jointed legs and glowing silver antlers; walks, stops to graze
 *   Dryad         a tree-maiden with a petal skirt, leaf hair and a flower crown; dances
 *   Moonwell      a mossy stone basin of moonlit water with lily pads, a lotus and a beam of light
 *   Standing stone a chiselled, lichen-spotted monolith with glowing runes
 *   Glowcap       mushroom geometry for the instanced fairy rings
 *   Star crystal  geometry for the Star Seeds orbiting the crown
 *   Realm island  a floating island with strata, a grassy top, trees, a shrine and a waterfall
 */

import * as THREE from 'three';
import { U } from './stage.js';
import { tube, blob, lathe, rock, colorize, colorByHeight, spiritMat, eye, glowSprite, mix, smooth, C, mulberry, bake, cachedMat, featureMat, featureDark } from './kit.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

// ================================================================== Treant
const BARK_D = C(0x3d2a1e), BARK_L = C(0x7a5a40), MOSS = C(0x4f8a3c), LEAF_A = C(0x4fae4a), LEAF_B = C(0x86d05a);

/** Bark colour: dark grooves and light ridges around the trunk, moss on the upper faces. */
function barkColor(t, n, c, a, twist = 0) {
    const ridge = 0.5 + 0.5 * Math.sin(a * 7 + t * twist);
    mix(BARK_D, BARK_L, ridge * 0.75, c);
    return c.lerp(MOSS, smooth(0.35, 0.8, n.y) * 0.8);
}

export function makeTreant(variant = 0) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const wood = spiritMat({ key: 'treant-wood', glow: 0.1, roughness: 0.95 });
    const leafMat = spiritMat({ key: 'treant-leaf', glow: 0.16, roughness: 0.85, sheen: 0.6, sheenColor: 0xdfffb0 });
    const r = mulberry(31 + variant);
    const add = (geo, parent = body, m = wood) => { const mesh = new THREE.Mesh(geo, m); parent.add(mesh); return mesh; };

    // ---- legs: thick roots that end in splayed root toes, hinged at the hip
    const legs = [];
    for (const s of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(0, 1.2, s * 0.26);
        add(tube([V(0, 0.15, 0), V(0.03, -0.45, s * 0.04), V(-0.02, -1.05, s * 0.08), V(0.04, -1.16, s * 0.1)],
            (t) => 0.21 - t * 0.09 + Math.sin(t * 9) * 0.012, (t, n, c, a) => barkColor(t, n, c, a, 4), 18, 12), hip);
        for (let k = 0; k < 4; k++) {
            const ang = (k / 3 - 0.5) * 2.2 + (s > 0 ? 0.3 : -0.3);
            add(tube([V(0.02, -1.08, s * 0.1), V(0.02 + Math.cos(ang) * 0.22, -1.17, s * 0.1 + Math.sin(ang) * 0.2), V(0.02 + Math.cos(ang) * 0.36, -1.2, s * 0.1 + Math.sin(ang) * 0.34)],
                (t) => 0.07 * (1 - t) + 0.008, (t, n, c, a) => barkColor(t, n, c, a), 8, 7), hip);
        }
        body.add(hip);
        legs.push(hip);
    }

    // ---- trunk body: gnarled, bulging, twisting a little
    add(tube([V(0, 0.95, 0), V(0.04, 1.5, 0.02), V(-0.02, 2.2, -0.02), V(0.03, 2.95, 0)],
        (t) => (0.44 - t * 0.12) + Math.sin(t * 11) * 0.02 + (t < 0.06 ? -(0.06 - t) * 4 : 0) + (t > 0.94 ? -(t - 0.94) * 3 : 0),
        (t, n, c, a) => barkColor(t, n, c, a, 6), 24, 20));
    // knotted root boss where the legs join
    add(blob(0.36, 1, 0.5, 0.95, (n, c) => mix(BARK_D, BARK_L, 0.3 + n.y * 0.2, c).lerp(MOSS, smooth(0.5, 0.9, n.y) * 0.6), 18, 12, 0.2, 7)).position.set(0, 1.0, 0);

    // ---- face: knotted brows, deep glowing eyes, a nose knot, a mossy beard
    const face = new THREE.Group();
    face.position.set(0, 2.3, 0);
    body.add(face);
    for (const s of [-1, 1]) {
        const dir = V(0.92, 0.1, s * 0.38).normalize();
        // a dark hollow behind each eye
        const hollow = new THREE.Mesh(colorize(new THREE.SphereGeometry(0.11, 14, 10).scale(1.2, 0.8, 0.45), featureDark), featureMat());
        hollow.position.copy(dir.clone().multiplyScalar(0.36));
        hollow.lookAt(dir.clone().multiplyScalar(2));
        face.add(hollow);
        eye(face, V(0, 0, 0), dir, 0.37, 0.058, 0xffc860, s * 0.2, false);
        add(tube([V(0.3, 0.13, s * 0.03), V(0.36, 0.17, s * 0.15), V(0.32, 0.12, s * 0.27)], (t) => 0.035 * Math.sin(Math.PI * t) + 0.01,
            (t, n, c) => c.copy(BARK_D).lerp(MOSS, 0.3), 8, 8), face);
    }
    add(blob(0.08, 1.2, 0.9, 0.9, (n, c) => mix(BARK_L, BARK_D, 0.4, c), 12, 8, 0.4, 3), face).position.set(0.37, -0.08, 0);
    const mouth = new THREE.Mesh(colorize(new THREE.SphereGeometry(0.07, 12, 8).scale(0.4, 0.28, 1.6), featureDark), featureMat());
    mouth.position.set(0.35, -0.24, 0);
    face.add(mouth);
    for (let k = 0; k < 6; k++) {
        const z = (k / 5 - 0.5) * 0.36;
        add(tube([V(0.33, -0.3, z), V(0.38, -0.5 - r() * 0.1, z * 1.1), V(0.33, -0.72 - r() * 0.15, z * 1.2)],
            (t) => 0.035 * (1 - t) + 0.006, (t, n, c) => mix(MOSS, C(0x8fca6a), t, c), 10, 7), face, leafMat);
    }

    // ---- arms: crooked branches with twig fingers and a few leaves, hinged at the shoulder
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = new THREE.Group();
        sh.position.set(0, 2.55, s * 0.36);
        const pts = [V(0, 0, 0), V(0.08, -0.12, s * 0.32), V(0.22, -0.48, s * 0.58), V(0.42, -0.78, s * 0.66)];
        add(tube(pts, (t) => 0.14 - t * 0.085, (t, n, c, a) => barkColor(t, n, c, a, 3), 16, 10), sh);
        // a side twig off the elbow
        add(tube([pts[2], V(0.32, -0.38, s * 0.82), V(0.4, -0.32, s * 0.95)], (t) => 0.035 * (1 - t) + 0.006, (t, n, c, a) => barkColor(t, n, c, a), 8, 6), sh);
        for (let k = 0; k < 3; k++) {
            const sp = (k - 1) * 0.55;
            add(tube([pts[3], V(0.52, -0.9, s * 0.66 + sp * 0.1), V(0.6, -1.0 + Math.abs(sp) * 0.06, s * 0.66 + sp * 0.2)],
                (t) => 0.04 * (1 - t) + 0.006, (t, n, c, a) => barkColor(t, n, c, a), 8, 7), sh);
        }
        for (let k = 0; k < 3; k++) {
            add(blob(0.11, 1, 0.75, 0.9, (n, c) => mix(LEAF_A, LEAF_B, 0.45 + n.y * 0.45, c), 10, 8, 0.35, 50 + k), sh, leafMat)
                .position.set(0.36 + (k - 1) * 0.06, -0.78 + k * 0.05, s * (0.66 + (k - 1) * 0.12));
        }
        add(blob(0.1, 1, 0.75, 0.9, (n, c) => mix(LEAF_A, LEAF_B, 0.45 + n.y * 0.45, c), 10, 8, 0.35, 60), sh, leafMat).position.set(0.4, -0.3, s * 0.95);
        body.add(sh);
        arms.push(sh);
    }

    // ---- crown: a cluster of leafy masses with a few blossoms and glowing berries
    const crown = new THREE.Group();
    crown.position.set(0, 3.05, 0);
    body.add(crown);
    const tint = [C(0x3f8a3a), C(0x4f9a4a), C(0x357a4a)][variant % 3];
    const leafy = (sz, seed) => blob(sz, 1, 0.78, 1, (n, c) => mix(tint.clone().multiplyScalar(0.6), LEAF_B, 0.25 + Math.max(0, n.y) * 0.6, c), 14, 10, 0.45, seed);
    add(leafy(0.42, 11), crown, leafMat).position.set(0, 0.35, 0);
    for (let k = 0; k < 6; k++) {
        const a = k * 1.047 + r() * 0.4, out = 0.55 + r() * 0.25, up = 0.25 + r() * 0.45;
        const tip = V(Math.cos(a) * out, up, Math.sin(a) * out);
        add(tube([V(0, -0.15, 0), V(Math.cos(a) * out * 0.45, up * 0.4, Math.sin(a) * out * 0.45), tip], (t) => 0.07 * (1 - t) + 0.012,
            (t, n, c, ang) => barkColor(t, n, c, ang), 10, 7), crown);
        add(leafy(0.3 + r() * 0.14, 20 + k), crown, leafMat).position.copy(tip).add(V(0, 0.08, 0));
    }
    const FM = featureMat();
    for (let k = 0; k < 14; k++) {
        const a = r() * 6.28, el = 0.2 + r() * 1.1, rad = 0.75 + r() * 0.15;
        const m = new THREE.Mesh(colorize(new THREE.SphereGeometry(k % 3 ? 0.05 : 0.04, 8, 6), C(k % 3 ? 0xffd8ef : 0xffd060)), FM);
        m.position.set(Math.cos(a) * Math.cos(el) * rad, 0.25 + Math.sin(el) * rad * 0.8, Math.sin(a) * Math.cos(el) * rad);
        crown.add(m);
    }
    g.userData = { body, legs, arms, crown, face, blink: 0 };
    return bake(g);
}

export function animateTreant(tr, t, dt, i = 0) {
    const u = tr.userData;
    const step = Math.sin(t * 1.6 + i);
    u.legs[0].rotation.z = step * 0.32;
    u.legs[1].rotation.z = -step * 0.32;
    u.arms[0].rotation.z = -step * 0.22; u.arms[1].rotation.z = step * 0.22;
    u.arms[0].rotation.x = -0.1 + Math.sin(t * 0.7 + i) * 0.06; u.arms[1].rotation.x = 0.1 - Math.sin(t * 0.8 + i) * 0.06;
    u.body.position.y = Math.abs(Math.cos(t * 1.6 + i)) * 0.05;
    u.body.rotation.x = step * 0.05;                     // rolls from foot to foot
    u.crown.rotation.y = Math.sin(t * 0.5 + i) * 0.08;
    u.crown.position.y = 3.05 + Math.sin(t * 3.2 + i) * 0.02;
}

// ================================================================== White Stag
const COAT = C(0xf4f7ff), COAT_SH = C(0xb8c8e0), HOOF = C(0x3a3f4a), NOSE = C(0x2a2e38);

export function makeStag(textures) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const coat = spiritMat({ key: 'stag-coat', glow: 0.16, roughness: 0.65, sheen: 1, sheenColor: 0xcfe6ff });
    const add = (geo, parent = body, m = coat) => { const mesh = new THREE.Mesh(geo, m); parent.add(mesh); return mesh; };
    const coatColor = (n, c, k = 0) => mix(COAT, COAT_SH, smooth(0.0, -0.8, n.y) * 0.8 + k, c);

    // torso: deep chest, slimmer waist, rounded rump
    add(tube([V(-0.6, 1.17), V(-0.25, 1.15), V(0.15, 1.17), V(0.48, 1.22)],
        (t) => (0.28 + 0.05 * smooth(0.5, 0.9, t) - 0.025 * Math.sin(Math.PI * t)) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.01)), 0.4) + 0.01,
        (t, n, c) => coatColor(n, c), 26, 18));

    // neck + head on a pivot at the shoulders (lowers to graze)
    const neck = new THREE.Group();
    neck.position.set(0.42, 1.3, 0);
    body.add(neck);
    add(tube([V(-0.04, -0.06), V(0.12, 0.25), V(0.25, 0.52)], (t) => 0.15 - t * 0.06, (t, n, c) => coatColor(n, c), 14, 14), neck);
    const head = new THREE.Group();
    head.position.set(0.27, 0.57, 0);
    neck.add(head);
    add(blob(0.12, 1.15, 0.92, 0.85, (n, c) => coatColor(n, c)), head);
    add(tube([V(0.06, -0.01), V(0.18, -0.08), V(0.31, -0.15)], (t) => 0.08 - t * 0.045, (t, n, c) => coatColor(n, c),
        12, 14, (t, a) => 0.9 + 0.1 * Math.abs(Math.cos(a))), head);
    const nose = new THREE.Mesh(colorize(new THREE.SphereGeometry(0.03, 12, 8).scale(1, 0.8, 1.2), NOSE), featureMat());
    nose.position.set(0.31, -0.155, 0);
    head.add(nose);
    for (const s of [-1, 1]) {
        eye(head, V(0, 0, 0), V(0.62, 0.32, s * 0.72).normalize(), 0.105, 0.022, 0x8fd8ff, s * 0.15, false);
        const ear = new THREE.Group();
        ear.position.set(-0.05, 0.08, s * 0.08);
        ear.rotation.set(s * -1.1, 0.3 * s, 0.4);
        add(new THREE.ConeGeometry(0.045, 0.17, 10).scale(1, 1, 0.45).translate(0, 0.085, 0), ear);
        colorize(ear.children[0].geometry, COAT);
        head.add(ear);
    }
    // antlers: branching tines of glowing silver
    const antlerMat = cachedMat('stag-antler', () => new THREE.MeshPhysicalMaterial({ color: 0xdfe8f0, emissive: 0x7fb8e0, emissiveIntensity: 0.32, roughness: 0.35, clearcoat: 1 }));
    const antlers = new THREE.Group();
    head.add(antlers);
    const tips = [];
    const branch = (start, dir, len, rad, depth, s) => {
        const end = start.clone().addScaledVector(dir, len);
        const bend = start.clone().lerp(end, 0.5).add(V(-len * 0.12, len * 0.08, s * len * 0.05));
        const m = new THREE.Mesh(tube([start, bend, end], (t) => rad * (1 - t * 0.65) + 0.003, (t, n, c) => c.setRGB(1, 1, 1), 8, 7), antlerMat);
        antlers.add(m);
        if (depth === 0) { tips.push(end); return; }
        // tines grow forward and up off the beam; the beam carries on, sweeping back
        const kids = depth === 2 ? 3 : 1;
        for (let k = 0; k < kids; k++) {
            const at = start.clone().lerp(end, 0.3 + k * 0.28);
            const d = V(0.75, 0.85, s * 0.15).normalize();
            branch(at, d, len * (0.5 - k * 0.06), rad * 0.62, depth - 1, s);
        }
        branch(end, dir.clone().add(V(-0.15, 0.55, s * 0.2)).normalize(), len * 0.62, rad * 0.7, depth - 1, s);
    };
    for (const s of [-1, 1]) branch(V(-0.02, 0.09, s * 0.05), V(-0.45, 0.6, s * 0.65).normalize(), 0.36, 0.03, 2, s);

    // legs: thigh + shin with a knee/hock, hinged at the hip
    const legs = [];
    const spec = [[0.34, 0.12, 0.25, false], [0.34, -0.12, 0.75, false], [-0.48, 0.13, 0, true], [-0.48, -0.13, 0.5, true]];
    for (const [x, z, ph, back] of spec) {
        const hip = new THREE.Group();
        hip.position.set(x, 1.08, z);
        add(tube([V(0, 0.08), V(back ? -0.08 : 0.03, -0.2), V(back ? 0.02 : 0.0, -0.42)], (t) => (back ? 0.11 : 0.08) * (1 - t * 0.55) + 0.012,
            (t, n, c) => coatColor(n, c, 0.05), 10, 10), hip);
        const knee = new THREE.Group();
        knee.position.set(back ? 0.02 : 0, -0.42, 0);
        hip.add(knee);
        add(blob(0.045, 1, 1, 1, (n, c) => mix(COAT, COAT_SH, 0.15, c), 10, 8), knee);
        add(tube([V(0, 0), V(back ? 0.03 : -0.01, -0.3), V(0.01, -0.62)], (t) => 0.042 - t * 0.014,
            (t, n, c) => mix(COAT, COAT_SH, 0.15 + t * 0.35, c), 10, 8), knee);
        add(blob(0.034, 1.3, 0.7, 1, (n, c) => c.copy(HOOF), 10, 8), knee).position.set(0.02, -0.635, 0);
        body.add(hip);
        legs.push({ hip, knee, ph, back });
    }
    // tail tuft
    add(blob(0.07, 0.8, 1.2, 0.7, (n, c) => c.copy(COAT)), body).position.set(-0.66, 1.2, 0);
    // a faint aura
    const aura = glowSprite(textures, 0xbfe0ff, 2.4, 0.16);
    aura.position.set(0, 1.2, 0);
    g.add(aura);
    g.userData = { body, neck, head, legs, ears: head.children.filter((c) => c.isGroup && c !== antlers), aura, graze: 0 };
    return bake(g);
}

export function animateStag(s, t, dt, moving, i = 0) {
    const u = s.userData;
    u.graze += ((moving ? 0 : 1) - u.graze) * Math.min(1, dt * 1.5);
    const run = 1 - u.graze;
    const cyc = t * 5.2 + i;
    for (const L of u.legs) {
        const ph = cyc + L.ph * Math.PI * 2;
        L.hip.rotation.z = Math.sin(ph) * 0.38 * run;
        // knee folds on the forward swing
        const fold = Math.max(0, Math.cos(ph)) * 0.7 * run;
        L.knee.rotation.z = L.back ? fold : -fold;
    }
    u.body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.02 * run;
    u.neck.rotation.z = -1.05 * u.graze + Math.sin(cyc * 2) * 0.03 * run;
    u.head.rotation.z = 0.35 * u.graze + Math.sin(t * 2.1 + i) * 0.05 * u.graze;
    u.ears.forEach((e, k) => { e.rotation.z = 0.4 + Math.sin(t * 3 + k * 2 + i) * 0.12 * (0.3 + u.graze); });
    u.aura.material.opacity = 0.12 + Math.sin(t * 1.5 + i) * 0.04;
}

// ================================================================== Dryad
export function makeDryad(textures, hue) {
    const g = new THREE.Group();
    const fig = new THREE.Group();
    g.add(fig);
    const base = new THREE.Color().setHSL(hue, 0.62, 0.48);
    const deep = new THREE.Color().setHSL(hue + 0.03, 0.7, 0.22);
    const skin = new THREE.Color().setHSL(hue - 0.05, 0.3, 0.82);
    const gold = C(0xffe08a);
    const mat = spiritMat({ key: `dryad-${hue.toFixed(2)}`, glow: 0.2, roughness: 0.6, sheen: 1, sheenColor: 0xeaffea });
    const add = (geo, parent = fig) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

    // skirt: a bell of overlapping leaf petals
    add(lathe([[0.001, 1.08], [0.13, 1.06], [0.2, 0.8], [0.3, 0.45], [0.38, 0.12], [0.001, 0.12]], (y, n, c) => mix(base, deep, smooth(1.0, 0.2, y), c), 28));
    const skirt = new THREE.Group();
    skirt.position.y = 1.0;
    fig.add(skirt);
    for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + (k % 2) * 0.2;
        const leaf = add(tube([V(0.14, 0), V(0.3, -0.45), V(0.42, -0.92)], (t) => 0.11 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)) + 0.004,
            (t, n, c) => mix(base, gold, smooth(0.6, 1, t) * 0.7, c), 14, 10, (t, ang) => (Math.abs(Math.sin(ang)) > 0.7 ? 1 : 0.18)), skirt);
        leaf.rotation.y = -a;
        leaf.position.y = -(k % 2) * 0.12;
    }
    // bodice + neck + head
    add(tube([V(0, 1.02), V(0.01, 1.22), V(0, 1.44)], (t) => 0.12 + Math.sin(t * Math.PI) * 0.015 - t * 0.02, (t, n, c) => mix(base, skin, smooth(0.7, 1, t), c), 12, 14));
    add(tube([V(0, 1.42), V(0.005, 1.5), V(0.01, 1.56)], () => 0.04, (t, n, c) => c.copy(skin), 6, 10));
    const head = new THREE.Group();
    head.position.set(0.01, 1.66, 0);
    fig.add(head);
    add(blob(0.1, 0.95, 1.1, 0.92, (n, c) => c.copy(skin)), head);
    for (const s of [-1, 1]) eye(head, V(0, 0.01, 0), V(0.85, 0.08, s * 0.5).normalize(), 0.095, 0.016, 0xb8ffd8, s * 0.2, false);
    // leaf hair flowing down the back
    for (let k = 0; k < 9; k++) {
        const z = (k / 8 - 0.5) * 0.22;
        add(tube([V(0.02, 0.08, z * 0.6), V(-0.1, 0.02, z), V(-0.16, -0.25, z * 1.4), V(-0.14, -0.55 - (k % 3) * 0.08, z * 1.6)],
            (t) => 0.035 * (1 - t * 0.6) + 0.006, (t, n, c) => mix(deep, base, t, c), 14, 8, (t, a) => (Math.abs(Math.cos(a)) > 0.7 ? 1.4 : 0.7)), head);
    }
    // flower crown
    const flowerCols = [0xffc8e8, 0xffffff, 0xfff0a0, 0xd8b8ff];
    for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const f = new THREE.Mesh(colorize(new THREE.SphereGeometry(0.025, 8, 6), C(flowerCols[k % 4])), featureMat());
        f.position.set(Math.cos(a) * 0.1, 0.07 + Math.sin(a * 2) * 0.01, Math.sin(a) * 0.1);
        head.add(f);
    }
    // arms, hinged at the shoulder, with little leaf hands
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = new THREE.Group();
        sh.position.set(0, 1.4, s * 0.14);
        add(tube([V(0, 0), V(0.03, -0.22, s * 0.04), V(0.06, -0.44, s * 0.05)], (t) => 0.032 - t * 0.012, (t, n, c) => c.copy(skin), 10, 8), sh);
        add(blob(0.04, 1, 1.4, 0.5, (n, c) => mix(skin, base, 0.3, c), 8, 6), sh).position.set(0.06, -0.49, s * 0.05);
        fig.add(sh);
        arms.push(sh);
    }
    const halo = glowSprite(textures, base, 1.8, 0.28);
    halo.position.y = 1.1;
    g.add(halo);
    g.userData = { fig, head, arms, skirt, halo };
    return bake(g);
}

export function animateDryad(d, t, i = 0) {
    const u = d.userData;
    u.fig.rotation.y = Math.sin(t * 0.9 + i) * 0.6;
    u.fig.position.y = 0.06 + Math.sin(t * 2 + i) * 0.06;
    u.arms[0].rotation.x = 2.2 + Math.sin(t * 2 + i) * 0.5;
    u.arms[1].rotation.x = -2.2 - Math.sin(t * 2 + i + 1.2) * 0.5;
    u.arms[0].rotation.z = 0.3; u.arms[1].rotation.z = 0.3;
    u.head.rotation.z = Math.sin(t * 2 + i) * 0.1;
    // the skirt swings out as she turns
    u.skirt.rotation.y = -Math.sin(t * 0.9 + i - 0.5) * 0.25;
    u.skirt.scale.set(1 + Math.abs(Math.sin(t * 0.9 + i)) * 0.06, 1, 1 + Math.abs(Math.sin(t * 0.9 + i)) * 0.06);
    u.halo.material.opacity = 0.22 + Math.sin(t * 1.7 + i) * 0.08;
}

// ================================================================== Moonwell
export function makeWell(textures, seed = 1) {
    const g = new THREE.Group();
    const stone = spiritMat({ key: 'well-stone', glow: 0.06, roughness: 0.95 });
    const r = mulberry(400 + seed);
    // a ring of mossy boulders around the basin
    const n = 12;
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 0.15;
        const m = new THREE.Mesh(rock(0.24 + r() * 0.1, 40 + k + seed * 13, 0x8a948c, 0x4f8a3c, 0.75), stone);
        m.position.set(Math.cos(a) * 1.18, 0.05, Math.sin(a) * 1.18);
        m.rotation.y = r() * 6;
        g.add(m);
    }
    // basin floor and a carved inner lip
    const lip = new THREE.Mesh(lathe([[0.001, 0.0], [0.98, 0.0], [1.08, 0.1], [1.0, 0.16], [0.95, 0.08]], (y, nn, c) => c.set(0x6d766f).multiplyScalar(0.8 + y), 40), stone);
    g.add(lip);
    // moonlit water: ripples, a reflected moon, drifting sparkles
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.96, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main(){
              vec2 p = vUv - 0.5; float r = length(p);
              float rip = sin(r * 46.0 - uTime * 1.8) * 0.5 + 0.5;
              vec3 deep = vec3(0.04, 0.16, 0.34), shallow = vec3(0.16, 0.48, 0.72);
              vec3 col = mix(shallow, deep, smoothstep(0.0, 0.5, r));
              col += vec3(0.2, 0.35, 0.5) * rip * 0.18;
              float moon = smoothstep(0.11, 0.08, length(p - vec2(0.1, -0.08) + 0.006 * vec2(sin(uTime * 1.3), cos(uTime))));
              col += vec3(0.9, 0.95, 1.0) * moon * 0.9;
              vec2 cell = floor(vUv * 26.0);
              float spark = step(0.94, h(cell)) * pow(0.5 + 0.5 * sin(uTime * 3.0 + h(cell + 3.1) * 40.0), 6.0);
              col += vec3(0.7, 0.9, 1.0) * spark * 0.8;
              col *= smoothstep(0.5, 0.46, r) * 0.4 + 0.6;
              gl_FragColor = vec4(col * 1.25, 1.0); }`,
    }));
    water.position.y = 0.1;
    g.add(water);
    // lily pads and a glowing lotus
    const padMat = spiritMat({ key: 'well-pad', glow: 0.18, roughness: 0.6, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
        const pad = new THREE.Mesh(colorize(new THREE.CircleGeometry(0.13 + r() * 0.05, 18, 0.3, Math.PI * 1.8).rotateX(-Math.PI / 2), C(0x4f9a4a)), padMat);
        const a = r() * 6.28, d = 0.35 + r() * 0.45;
        pad.position.set(Math.cos(a) * d, 0.115, Math.sin(a) * d);
        pad.rotation.y = r() * 6;
        g.add(pad);
    }
    const lotus = new THREE.Group();
    const petalMat = spiritMat({ key: 'well-lotus', glow: 0.7, roughness: 0.5, side: THREE.DoubleSide });
    for (let k = 0; k < 8; k++) {
        const p = new THREE.Mesh(colorize(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI).scale(0.5, 1.4, 1), C(k % 2 ? 0xffd8f0 : 0xfff4fb)), petalMat);
        p.rotation.set(0.6, (k / 8) * Math.PI * 2, 0);
        p.position.set(Math.cos((k / 8) * Math.PI * 2) * 0.03, 0.06, Math.sin((k / 8) * Math.PI * 2) * 0.03);
        lotus.add(p);
    }
    const lotusGlow = glowSprite(textures, 0xffd8f0, 0.5, 0.6);
    lotusGlow.position.y = 0.08;
    lotus.add(lotusGlow);
    lotus.position.set(-0.3, 0.1, 0.25);
    g.add(lotus);
    // a soft beam of moonlight and motes rising in it
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.92, 6.5, 28, 1, true).translate(0, 3.25, 0), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ float a = pow(1.0 - vUv.y, 2.2) * (0.6 + 0.4 * sin(vUv.x * 38.0 + uTime * 1.2 + sin(vUv.y * 9.0 + uTime) * 2.0));
              a *= smoothstep(0.0, 0.08, vUv.y);
              gl_FragColor = vec4(vec3(0.5, 0.75, 1.0) * a * 0.15, 1.0); }`,
    }));
    g.add(beam);
    const motes = [];
    for (let k = 0; k < 5; k++) { const m = glowSprite(textures, 0xbfe8ff, 0.18, 0.8); g.add(m); motes.push(m); }
    g.userData = { motes, lotus };
    return bake(g);
}
export function animateWell(w, t, i = 0) {
    w.userData.motes.forEach((m, k) => {
        const life = (t * 0.25 + k / 5 + i * 0.13) % 1;
        const a = k * 1.7 + t * 0.4;
        m.position.set(Math.cos(a) * 0.4, 0.2 + life * 3, Math.sin(a) * 0.4);
        m.material.opacity = Math.sin(life * Math.PI) * 0.9;
    });
    w.userData.lotus.rotation.y = t * 0.2;
    w.userData.lotus.position.y = 0.1 + Math.sin(t * 1.3 + i) * 0.01;
}

// ================================================================== Standing stone
export function makeStone(textures, h, seed = 1) {
    const r = mulberry(900 + seed);
    const geo = new THREE.BoxGeometry(0.72, h, 0.38, 4, 10, 2);
    const p = geo.attributes.position;
    const chips = [0, 1, 2, 3, 4, 5, 6].map(() => [V(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).normalize(), 0.05 + r() * 0.07]);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const y = v.y / h + 0.5;
        // taper, a rounded crown, and chiselled facets
        v.x *= 1 - y * 0.22; v.z *= 1 - y * 0.18;
        if (y > 0.8) { const k = (y - 0.8) / 0.2; v.x *= 1 - k * k * 0.35; v.z *= 1 - k * k * 0.3; v.y -= k * k * 0.08 * h * Math.abs(v.x) * 4; }
        const d = v.clone().setY(v.y * 0.3).normalize();
        for (const [c, s] of chips) v.addScaledVector(d, -Math.max(0, d.dot(c) - 0.6) * s);
        v.x += Math.sin(v.y * 3.1 + seed) * 0.02;
        p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.translate(0, h / 2 - 0.15, 0);
    geo.computeVertexNormals();
    // lichen and moss in the colour
    const n = geo.attributes.normal, col = [];
    const grey = C(0x8a8f8a), dark = C(0x5f6660), lichen = C(0xb8c27a), moss = C(0x4f8a3c), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const noise = 0.5 + 0.5 * Math.sin(v.x * 17 + v.y * 9 + seed) * Math.sin(v.z * 13 - v.y * 7);
        mix(dark, grey, noise, c);
        if (noise > 0.82) c.lerp(lichen, 0.5);
        c.lerp(moss, smooth(0.5, 0.85, n.getY(i)) * 0.85 + smooth(0.6, 0.1, v.y) * 0.35);
        col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uRune: { value: textures.rune }, uMoonDir: U.uMoonDir, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uH: { value: h } },
        vertexColors: true,
        vertexShader: `varying vec3 vN; varying vec2 vUv; varying float vFogDepth; varying vec3 vCol;
            void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vCol = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime; uniform sampler2D uRune; uniform vec3 uMoonDir; uniform vec3 uFogColor; uniform float uFogDensity;
            varying vec3 vN; varying vec2 vUv; varying float vFogDepth; varying vec3 vCol;
            void main(){ vec3 n = normalize(vN);
              vec3 col = vCol * (0.22 + 0.5 * max(dot(n, uMoonDir), 0.0) + 0.12 * (n.y * 0.5 + 0.5));
              float rune = texture2D(uRune, vUv * vec2(0.5, 0.35)).r;
              float face = smoothstep(0.3, 0.6, abs(n.z));      // runes on the broad faces only
              col += vec3(0.4, 0.95, 1.0) * smoothstep(0.55, 1.0, rune) * face * (0.6 + 0.4 * sin(uTime * 1.2 + vUv.y * 4.0)) * 1.3;
              float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
              col = mix(col, uFogColor, fogF);
              gl_FragColor = vec4(col, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
    });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    // a couple of fallen chips at the foot
    const stoneMat = spiritMat({ key: 'well-stone', glow: 0.06, roughness: 0.95 });
    for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(rock(0.1 + r() * 0.07, 70 + seed * 5 + k, 0x7d857c, 0x4f8a3c, 0.6), stoneMat);
        m.position.set((r() - 0.5) * 0.9, 0.02, 0.3 + r() * 0.2);
        g.add(m);
    }
    return bake(g);
}

// ================================================================== Glowcap geometry (instanced)
/** Stem with a skirt ring (aPart 0), domed cap with an upturned rim (1), gills (2). */
export function glowcapGeometry() {
    const stem = new THREE.LatheGeometry([[0.05, 0], [0.042, 0.02], [0.034, 0.08], [0.03, 0.14], [0.045, 0.145], [0.044, 0.155], [0.028, 0.16], [0.026, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const cap = new THREE.LatheGeometry([[0.001, 0.29], [0.05, 0.285], [0.095, 0.265], [0.13, 0.23], [0.148, 0.195], [0.152, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
    const gills = new THREE.LatheGeometry([[0.152, 0.18], [0.11, 0.19], [0.05, 0.198], [0.026, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
    // fluted gills: ridges around the underside
    const gp = gills.attributes.position;
    for (let i = 0; i < gp.count; i++) {
        const x = gp.getX(i), z = gp.getZ(i), a = Math.atan2(z, x), rr = Math.hypot(x, z);
        gp.setY(i, gp.getY(i) - Math.abs(Math.sin(a * 18)) * 0.006 * (rr / 0.15));
    }
    [stem, cap, gills].forEach((g) => g.computeVertexNormals());
    const pos = [], nor = [], part = [], idx = [];
    let base = 0;
    [stem, cap, gills].forEach((g, gi) => {
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); part.push(gi); }
        for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
        base += p.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    out.setIndex(idx);
    return out;
}

// ================================================================== Star crystal geometry (instanced)
/** A cluster: one long hexagonal crystal with pointed ends and two small ones leaning off it. */
export function crystalGeometry() {
    const one = (r, h) => {
        const g = new THREE.CylinderGeometry(r, r, h, 6, 1);
        const top = new THREE.ConeGeometry(r, r * 1.6, 6).translate(0, h / 2 + r * 0.8, 0);
        const bot = new THREE.ConeGeometry(r, r * 1.2, 6).rotateX(Math.PI).translate(0, -h / 2 - r * 0.6, 0);
        return [g, top, bot];
    };
    const parts = [...one(0.16, 0.6)];
    const small = (r, h, rx, rz, x, y, z) => one(r, h).map((g) => g.rotateX(rx).rotateZ(rz).translate(x, y, z));
    parts.push(...small(0.08, 0.26, 0.4, -0.7, 0.16, -0.12, 0.05), ...small(0.07, 0.2, -0.5, 0.8, -0.14, -0.18, -0.04));
    const pos = [];
    for (const g of parts) { const ng = g.toNonIndexed(); pos.push(...ng.attributes.position.array); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
}

// ================================================================== Realm island
export function makeIsland(textures, color, seed) {
    const r = mulberry(100 + seed);
    const g = new THREE.Group();
    const stone = spiritMat({ key: 'island-rock', glow: 0.08, roughness: 0.95 });
    const leaf = spiritMat({ key: 'island-leaf', glow: 0.2, roughness: 0.85 });
    // underside: a rocky cone with strata bands
    const strata = [C(0x6a5e52), C(0x8a7a66), C(0x5a5048), C(0x7a6e60)];
    const under = lathe([[0.001, -1.5], [0.18, -1.3], [0.42, -0.9], [0.72, -0.45], [0.95, -0.12], [1.02, 0.12], [0.001, 0.12]], (y, n, c) => c.copy(strata[Math.floor((y + 2) * 6) % 4]), 18);
    const up = under.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < up.count; i++) {
        v.fromBufferAttribute(up, i);
        const a = Math.atan2(v.z, v.x), k = 1 + Math.sin(a * 5 + seed) * 0.08 + Math.sin(a * 11 + v.y * 4) * 0.05;
        up.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    under.computeVertexNormals();
    g.add(new THREE.Mesh(under, stone));
    // grassy top with a drooping lip
    g.add(new THREE.Mesh(lathe([[0.001, 0.2], [0.85, 0.18], [1.05, 0.13], [1.08, 0.04], [1.0, 0.0]], (y, n, c) => mix(C(0x3f7a34), C(0x6fbf5a), smooth(0, 0.2, y), c), 24), leaf));
    // trees
    for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + r(), d = 0.45 + r() * 0.35;
        const tr = new THREE.Group();
        tr.position.set(Math.cos(a) * d, 0.18, Math.sin(a) * d);
        tr.add(new THREE.Mesh(tube([V(0, 0), V(0.02, 0.18), V(0, 0.34)], (t) => 0.04 - t * 0.02, (t, n, c) => c.set(0x5a4030), 6, 6), stone));
        const crown = new THREE.Mesh(blob(0.17 + r() * 0.06, 1, 1.15, 1, (n, c) => mix(C(0x2f7a40), C(0x7fd06a), 0.4 + n.y * 0.5, c), 12, 10, 0.3, seed + k), leaf);
        crown.position.y = 0.42;
        tr.add(crown);
        g.add(tr);
    }
    // a little shrine: four pillars round the realm's crystal
    const shrine = new THREE.Group();
    shrine.position.set(-0.15, 0.2, -0.1);
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        const pil = new THREE.Mesh(colorize(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8).translate(0, 0.21, 0), C(0xd8d4c8)), stone);
        pil.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
        shrine.add(pil);
    }
    shrine.add(new THREE.Mesh(colorize(new THREE.TorusGeometry(0.24, 0.03, 8, 24).rotateX(Math.PI / 2).translate(0, 0.43, 0), C(0xe8e0d0)), stone));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(0.7, 1.5, 0.7), new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 2, roughness: 0.15, clearcoat: 1, flatShading: true }));
    crystal.userData.keep = true;
    crystal.position.y = 0.32;
    shrine.add(crystal);
    const halo = glowSprite(textures, color, 1.6, 0.75);
    halo.position.y = 0.32;
    shrine.add(halo);
    g.add(shrine);
    // waterfall of light off the edge
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.8).translate(0, -0.9, 0), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            void main(){ float s = 0.55 + 0.45 * sin(vUv.y * 30.0 + uTime * 6.0 + sin(vUv.x * 12.0) * 2.0);
              float a = smoothstep(0.0, 0.3, vUv.y) * smoothstep(0.5, 0.2, abs(vUv.x - 0.5));
              gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.4) * s * a * 0.7, 1.0); }`,
    }));
    fall.position.set(1.0, 0.12, 0);
    fall.rotation.y = Math.PI / 2;
    g.add(fall);
    g.userData = { crystal, halo };
    return bake(g);
}
