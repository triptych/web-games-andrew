// Everyone in the game, built in code from primitives.
//
// Every builder returns a Group standing on y = 0 and facing +x (the sim's "face = 1"), with
// userData.anim(t, s) for its animation (s: { moving, air, angry, frozen, hit }) and
// userData.mats: the materials an angry or frozen tint is applied to.

import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function std(color, o = {}) {
    return new THREE.MeshStandardMaterial({
        color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.05,
        emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
        transparent: !!o.opacity, opacity: o.opacity ?? 1, depthWrite: o.opacity ? false : true,
        side: o.side ?? THREE.FrontSide, flatShading: !!o.flat,
    });
}
const glow = (color, ei = 2) => std(color, { emissive: color, ei, rough: 0.4 });

function mesh(geo, mat, p = [0, 0, 0], s = null, r = null) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    if (s) (typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(...s));
    if (r) m.rotation.set(...r);
    return m;
}

const G = {
    sph: new THREE.SphereGeometry(1, 28, 18),
    sphLo: new THREE.SphereGeometry(1, 14, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    cone: new THREE.ConeGeometry(1, 1, 16),
    torus: new THREE.TorusGeometry(1, 0.22, 10, 28),
    ico: new THREE.IcosahedronGeometry(1, 0),
    oct: new THREE.OctahedronGeometry(1, 0),
};

/** Two eyes looking along +x, at height y, spread in z. */
function eyes(group, x, y, spread, size, pupil = 0x101020) {
    const white = std(0xffffff, { rough: 0.2 });
    const dark = std(pupil, { rough: 0.2 });
    const out = [];
    for (const z of [-spread, spread]) {
        const e = mesh(G.sph, white, [x, y, z], size);
        const p = mesh(G.sph, dark, [x + size * 0.62, y, z * 1.08], size * 0.5);
        group.add(e, p);
        out.push(e, p);
    }
    return out;
}

function finish(group, mats, anim, h) {
    group.userData.mats = mats.map((m) => ({ m, e: m.emissive.clone(), ei: m.emissiveIntensity }));
    group.userData.anim = anim;
    group.userData.height = h;
    group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    return group;
}

/** Apply (or clear) the angry red / frozen blue / hit white tint. */
export function tint(model, kind, k = 1) {
    for (const { m, e, ei } of model.userData.mats || []) {
        if (!kind) { m.emissive.copy(e); m.emissiveIntensity = ei; continue; }
        const c = kind === 'angry' ? 0xff2030 : kind === 'frozen' ? 0x3aa0ff : 0xffffff;
        m.emissive.copy(e).lerp(new THREE.Color(c), k);
        m.emissiveIntensity = Math.max(ei, kind === 'hit' ? 2.2 : 0.75);
    }
}

// ====================================================================== Pip

export function makePip() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    const green = std(0x5fe08a, { rough: 0.45 });
    const cream = std(0xfff1c8, { rough: 0.6 });
    const orange = std(0xff9a3c, { rough: 0.4 });
    const body = mesh(G.sph, green, [0, 0.55, 0], [0.55, 0.52, 0.5]);
    const belly = mesh(G.sph, cream, [0.18, 0.5, 0], [0.4, 0.4, 0.38]);
    const head = new THREE.Group();
    head.position.set(0.15, 1.12, 0);
    head.add(mesh(G.sph, green, [0, 0, 0], [0.42, 0.4, 0.4]));
    head.add(mesh(G.sph, green, [0.32, -0.08, 0], [0.24, 0.2, 0.26]));          // snout
    head.add(mesh(G.sph, std(0x2a6a40), [0.52, -0.04, 0.08], 0.03), mesh(G.sph, std(0x2a6a40), [0.52, -0.04, -0.08], 0.03));
    eyes(head, 0.24, 0.12, 0.17, 0.12);
    const cheek = mesh(G.sph, std(0xff8aa8, { rough: 0.8 }), [0.3, -0.12, 0.26], [0.08, 0.05, 0.03]);
    head.add(cheek, mesh(G.sph, cheek.material, [0.3, -0.12, -0.26], [0.08, 0.05, 0.03]));
    // the fishbowl helmet and its collar
    const glass = new THREE.MeshPhongMaterial({ color: 0x9fe8ff, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.22, depthWrite: false });
    const helmet = mesh(G.sph, glass, [0.05, 0.02, 0], 0.62);
    head.add(helmet);
    const collar = mesh(G.torus, std(0xc8d0e0, { metal: 0.8, rough: 0.25 }), [0, 0.86, 0], [0.38, 0.38, 0.5], [Math.PI / 2, 0, 0]);
    const antenna = new THREE.Group();
    antenna.position.set(-0.05, 0.6, 0);
    antenna.add(mesh(G.cyl, std(0xc8d0e0, { metal: 0.8 }), [0, 0.12, 0], [0.025, 0.25, 0.025]));
    const tip = mesh(G.sph, glow(0xffe066, 3), [0, 0.28, 0], 0.07);
    antenna.add(tip);
    head.add(antenna);
    const spikes = [];
    for (let i = 0; i < 3; i++) {
        const s = mesh(G.cone, orange, [-0.42 + i * 0.05, 0.92 - i * 0.22, 0], [0.09, 0.2, 0.09], [0, 0, 0.9 + i * 0.2]);
        spikes.push(s);
        inner.add(s);
    }
    const tail = mesh(G.cone, green, [-0.58, 0.32, 0], [0.16, 0.42, 0.16], [0, 0, 1.9]);
    const feet = [mesh(G.sph, cream, [0.1, 0.08, 0.25], [0.2, 0.1, 0.14]), mesh(G.sph, cream, [0.1, 0.08, -0.25], [0.2, 0.1, 0.14])];
    const arms = [mesh(G.sph, green, [0.38, 0.62, 0.36], [0.12, 0.16, 0.1]), mesh(G.sph, green, [0.38, 0.62, -0.36], [0.12, 0.16, 0.1])];
    inner.add(body, belly, head, collar, tail, ...feet, ...arms);
    const anim = (t, s) => {
        const step = s.moving && !s.air ? Math.sin(t * 16) : 0;
        inner.position.y = s.moving && !s.air ? Math.abs(step) * 0.08 : 0;
        feet[0].position.x = 0.1 + step * 0.12; feet[1].position.x = 0.1 - step * 0.12;
        const sq = s.air ? (s.vy < 0 ? 1.08 : 0.96) : 1;
        inner.scale.set(1 / Math.sqrt(sq), sq, 1);
        tail.rotation.z = 1.9 + Math.sin(t * 6) * 0.15;
        head.rotation.z = s.blow ? -0.25 : Math.sin(t * 2) * 0.04;
        head.scale.setScalar(s.blow ? 1.08 : 1);
        cheek.scale.set(0.08 + (s.blow ? 0.08 : 0), 0.05 + (s.blow ? 0.05 : 0), 0.03);
        tip.material.emissiveIntensity = 2 + Math.sin(t * 5) * 1;
        arms[0].position.y = arms[1].position.y = 0.62 + (s.air ? 0.15 : step * 0.04);
    };
    return finish(g, [green], anim, 1.7);
}

// ====================================================================== the crew

function makeBlip() {
    const g = new THREE.Group();
    const shell = std(0xb6a8ff, { metal: 0.7, rough: 0.3 });
    const dark = std(0x30305a, { metal: 0.5, rough: 0.4 });
    const visor = glow(0x5ff4ff, 2.2);
    const body = new THREE.Group();
    body.add(mesh(G.box, shell, [0, 0.82, 0], [1.05, 0.9, 0.9]));
    body.add(mesh(G.box, dark, [0.53, 0.86, 0], [0.04, 0.5, 0.72]));
    body.add(mesh(G.box, visor, [0.56, 0.9, 0], [0.02, 0.22, 0.6]));
    body.add(mesh(G.cyl, dark, [0, 1.37, 0], [0.03, 0.22, 0.03]));
    const bulb = mesh(G.sph, glow(0xff5f9a, 2.5), [0, 1.52, 0], 0.09);
    body.add(bulb);
    const key = new THREE.Group();
    key.position.set(-0.62, 0.85, 0);
    key.add(mesh(G.cyl, dark, [0, 0, 0], [0.04, 0.2, 0.04], [0, 0, Math.PI / 2]));
    key.add(mesh(G.torus, std(0xffd24a, { metal: 0.8, rough: 0.3 }), [-0.12, 0, 0.13], 0.12), mesh(G.torus, std(0xffd24a, { metal: 0.8, rough: 0.3 }), [-0.12, 0, -0.13], 0.12));
    body.add(key);
    const legs = [mesh(G.cyl, dark, [0, 0.18, 0.25], [0.09, 0.36, 0.09]), mesh(G.cyl, dark, [0, 0.18, -0.25], [0.09, 0.36, 0.09])];
    g.add(body, ...legs);
    const anim = (t, s) => {
        const k = s.moving ? (s.angry ? 22 : 13) : 0;
        legs[0].position.x = Math.sin(t * k) * 0.14; legs[1].position.x = -Math.sin(t * k) * 0.14;
        body.position.y = Math.abs(Math.sin(t * k)) * 0.05;
        key.rotation.x = t * (s.angry ? 14 : 5);
        bulb.material.emissiveIntensity = 2 + Math.sin(t * 8) * 1.2;
    };
    return finish(g, [shell], anim, 1.5);
}

function makeSpark() {
    const g = new THREE.Group();
    const coil = std(0xffd24a, { metal: 0.85, rough: 0.25 });
    const spring = new THREE.Group();
    for (let i = 0; i < 4; i++) spring.add(mesh(G.torus, coil, [0, 0.12 + i * 0.18, 0], [0.32, 0.32, 0.5], [Math.PI / 2, 0, i * 0.3]));
    const head = new THREE.Group();
    const star = mesh(new THREE.ExtrudeGeometry(starShape(5, 0.55, 0.26), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }), glow(0xffef7a, 1.1), [0, 0, -0.11]);
    head.add(star);
    eyes(head, 0.3, 0.06, 0.14, 0.1);
    g.add(spring, head);
    const anim = (t, s) => {
        const sq = s.air ? 1.25 : 0.75 + Math.abs(Math.sin(t * 9)) * 0.2;
        spring.scale.y = sq;
        head.position.y = 0.2 + 0.72 * sq + 0.35;
        star.rotation.z = Math.sin(t * (s.angry ? 9 : 4)) * 0.3;
    };
    return finish(g, [coil, star.material], anim, 1.5);
}

function makeGlooper() {
    const g = new THREE.Group();
    const jelly = std(0xff7ad8, { opacity: 0.75, emissive: 0xff4fc0, ei: 0.6, rough: 0.2 });
    const dome = mesh(new THREE.SphereGeometry(0.75, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), jelly, [0, 0.75, 0], [1, 0.9, 1]);
    const core = mesh(G.sph, glow(0xffe0f6, 1.8), [0, 0.95, 0], 0.22);
    const tents = [];
    const tmat = std(0xff9ae4, { opacity: 0.8, emissive: 0xff4fc0, ei: 0.4 });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const tt = mesh(G.cyl, tmat, [Math.cos(a) * 0.45, 0.42, Math.sin(a) * 0.45], [0.06, 0.6, 0.06]);
        tents.push(tt);
        g.add(tt);
    }
    g.add(dome, core);
    eyes(g, 0.55, 0.95, 0.2, 0.11);
    const anim = (t, s) => {
        const p = Math.sin(t * (s.angry ? 7 : 4));
        dome.scale.set(1 + p * 0.06, 0.9 - p * 0.06, 1 + p * 0.06);
        tents.forEach((tt, i) => { tt.rotation.z = Math.sin(t * 5 + i) * 0.35; tt.rotation.x = Math.cos(t * 4 + i) * 0.25; });
    };
    return finish(g, [jelly], anim, 1.5);
}

function makeGrunt() {
    const g = new THREE.Group();
    const skin = std(0x7da05a, { rough: 0.6 });
    const armor = std(0x4a4e6a, { metal: 0.6, rough: 0.35 });
    const body = new THREE.Group();
    body.add(mesh(G.cyl, armor, [0, 0.7, 0], [0.48, 0.7, 0.42]));
    body.add(mesh(G.sph, skin, [0.05, 1.25, 0], [0.42, 0.36, 0.38]));
    body.add(mesh(G.sph, std(0x9fd0ff, { opacity: 0.35, rough: 0.1 }), [0.05, 1.3, 0], 0.48));
    const visor = mesh(G.box, glow(0xff3040, 2.4), [0.42, 1.28, 0], [0.04, 0.1, 0.42]);
    body.add(visor);
    const gun = new THREE.Group();
    gun.position.set(0.3, 0.8, 0.42);
    gun.add(mesh(G.cyl, armor, [0.3, 0, 0], [0.11, 0.6, 0.11], [0, 0, Math.PI / 2]));
    const muzzle = mesh(G.sph, glow(0x7dff6a, 2), [0.62, 0, 0], 0.08);
    gun.add(muzzle);
    body.add(gun);
    const legs = [mesh(G.cyl, armor, [0, 0.16, 0.2], [0.13, 0.32, 0.13]), mesh(G.cyl, armor, [0, 0.16, -0.2], [0.13, 0.32, 0.13])];
    g.add(body, ...legs);
    const anim = (t, s) => {
        const k = s.moving ? (s.angry ? 16 : 9) : 0;
        legs[0].position.x = Math.sin(t * k) * 0.13; legs[1].position.x = -Math.sin(t * k) * 0.13;
        body.rotation.z = Math.sin(t * k) * 0.04;
        muzzle.material.emissiveIntensity = 1.5 + Math.sin(t * 6) * 1;
    };
    return finish(g, [skin, armor], anim, 1.7);
}

function makeMoth() {
    const g = new THREE.Group();
    const fur = std(0x8a5ad8, { rough: 0.8 });
    g.add(mesh(G.sph, fur, [0, 0.65, 0], [0.42, 0.32, 0.3]));
    g.add(mesh(G.sph, fur, [0.36, 0.72, 0], 0.24));
    eyes(g, 0.52, 0.76, 0.12, 0.09, 0x400060);
    const wingMat = std(0x7ff4ff, { opacity: 0.6, emissive: 0x3ad8ff, ei: 1.2, side: THREE.DoubleSide });
    const wings = [];
    for (const z of [-1, 1]) for (const x of [0.12, -0.18]) {
        const w = new THREE.Group();
        w.position.set(x, 0.78, z * 0.2);
        w.add(mesh(G.sph, wingMat, [0, 0, z * 0.45], [0.32, 0.03, 0.45]));
        wings.push({ w, z });
        g.add(w);
    }
    const tail = mesh(G.cone, std(0xbff8ff, { opacity: 0.55, emissive: 0x7fe0ff, ei: 2 }), [-0.62, 0.62, 0], [0.18, 0.7, 0.18], [0, 0, Math.PI / 2]);
    g.add(tail);
    const anim = (t, s) => {
        const f = Math.sin(t * (s.angry ? 30 : 18)) * 0.7;
        for (const { w, z } of wings) w.rotation.x = z * f;
        tail.scale.y = 0.7 + Math.sin(t * 12) * 0.15;
    };
    return finish(g, [fur], anim, 1.3);
}

function makeSaucer() {
    const g = new THREE.Group();
    const hull = std(0xc8d0e0, { metal: 0.85, rough: 0.25 });
    g.add(mesh(G.sph, hull, [0, 0.38, 0], [0.95, 0.18, 0.95]));
    g.add(mesh(G.cyl, std(0x404a6a, { metal: 0.7 }), [0, 0.28, 0], [0.55, 0.12, 0.55]));
    const dome = mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x9fffd0, { opacity: 0.4, rough: 0.05 }), [0, 0.46, 0]);
    g.add(dome);
    const alien = mesh(G.sph, std(0x7dff6a), [0, 0.58, 0], 0.18);
    g.add(alien);
    eyes(g, 0.15, 0.62, 0.07, 0.06);
    const lights = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const l = mesh(G.sphLo, glow(i % 2 ? 0xff5f9a : 0xffe066, 2.5), [Math.cos(a) * 0.86, 0.36, Math.sin(a) * 0.86], 0.06);
        lights.push(l);
        g.add(l);
    }
    const beam = mesh(G.cone, std(0x9fffd0, { opacity: 0.18, emissive: 0x9fffd0, ei: 1 }), [0, -0.3, 0], [0.4, 1, 0.4]);
    g.add(beam);
    const anim = (t, s) => {
        lights.forEach((l, i) => { l.material.emissiveIntensity = (Math.floor(t * 8) + i) % 4 === 0 ? 4 : 0.6; });
        g.children[0].rotation.y = t * 2;
        beam.visible = Math.sin(t * 3) > 0.6;
        alien.position.y = 0.58 + Math.sin(t * 4) * 0.03;
    };
    return finish(g, [hull], anim, 1.1);
}

export function makeEnemy(type) {
    const f = { blip: makeBlip, spark: makeSpark, glooper: makeGlooper, grunt: makeGrunt, moth: makeMoth, saucer: makeSaucer }[type];
    return f();
}

// ====================================================================== the Wraith and the Baron

export function makeWraith() {
    const g = new THREE.Group();
    const cloak = std(0x1a1030, { opacity: 0.85, emissive: 0x6a2aff, ei: 0.35, side: THREE.DoubleSide });
    const robe = mesh(new THREE.ConeGeometry(0.8, 1.9, 20, 1, true), cloak, [0, 0, 0], 1, [Math.PI, 0, 0]);
    const hood = mesh(G.sph, cloak, [0, 0.8, 0], [0.55, 0.55, 0.55]);
    const face = mesh(G.sph, std(0x0a0014), [0.24, 0.76, 0], [0.4, 0.42, 0.42]);
    const eyeM = glow(0xff3060, 4);
    const e1 = mesh(G.sph, eyeM, [0.6, 0.82, 0.15], [0.07, 0.11, 0.09]), e2 = mesh(G.sph, eyeM, [0.6, 0.82, -0.15], [0.07, 0.11, 0.09]);
    const hands = [mesh(G.sph, std(0xd8d0ff, { emissive: 0x8a6aff, ei: 0.6 }), [0.6, 0.1, 0.45], 0.13), mesh(G.sph, std(0xd8d0ff, { emissive: 0x8a6aff, ei: 0.6 }), [0.6, 0.1, -0.45], 0.13)];
    g.add(robe, hood, face, e1, e2, ...hands);
    const anim = (t) => {
        robe.rotation.y = t * 0.8;
        hood.position.y = 0.8 + Math.sin(t * 3) * 0.05;
        hands[0].position.y = 0.1 + Math.sin(t * 4) * 0.12; hands[1].position.y = 0.1 + Math.cos(t * 4) * 0.12;
        eyeM.emissiveIntensity = 3 + Math.sin(t * 9) * 1.5;
    };
    return finish(g, [cloak], anim, 1.9);
}

export function makeBaron() {
    const g = new THREE.Group();
    const skin = std(0x5a2a8a, { rough: 0.35, metal: 0.1 });
    const body = mesh(G.sph, skin, [0, 2.45, 0], [2.45, 2.35, 2.2]);
    const belly = mesh(G.sph, std(0x8a5ac8, { rough: 0.5 }), [0.9, 2.2, 0], [1.7, 1.6, 1.6]);
    const hat = new THREE.Group();
    hat.position.set(-0.2, 4.6, 0);
    hat.rotation.z = 0.15;
    const black = std(0x101018, { rough: 0.3, metal: 0.4 });
    hat.add(mesh(G.cyl, black, [0, 0.12, 0], [1.6, 0.12, 1.6]));
    hat.add(mesh(G.cyl, black, [0, 1.0, 0], [1.05, 1.7, 1.05]));
    hat.add(mesh(G.cyl, glow(0xb05aff, 1.6), [0, 0.42, 0], [1.08, 0.3, 1.08]));
    const eyeL = new THREE.Group(), eyeR = new THREE.Group();
    eyeL.position.set(1.9, 3.1, 0.75); eyeR.position.set(1.9, 3.1, -0.75);
    for (const e of [eyeL, eyeR]) {
        e.add(mesh(G.sph, std(0xffffff, { rough: 0.2 }), [0, 0, 0], 0.48));
        e.add(mesh(G.sph, std(0x200030, { rough: 0.2 }), [0.32, -0.05, 0], 0.24));
    }
    const monocle = mesh(G.torus, std(0xffd24a, { metal: 0.9, rough: 0.2 }), [2.3, 3.1, -0.75], 0.55, [0, Math.PI / 2, 0]);
    const chain = mesh(G.cyl, std(0xffd24a, { metal: 0.9 }), [2.2, 2.3, -1.2], [0.03, 1.4, 0.03], [0.3, 0, 0.1]);
    const stache = new THREE.Group();
    stache.position.set(2.3, 2.3, 0);
    for (const z of [-1, 1]) stache.add(mesh(G.torus, black, [0, 0.12, z * 0.55], [0.5, 0.35, 0.8], [0, 0, z * 0.4]));
    const aura = mesh(new THREE.TorusGeometry(1, 0.025, 8, 64), glow(0xc06bff, 2.2), [0, 2.4, 0], 3.1, [Math.PI / 2 - 0.35, 0, 0.2]);
    const orbs = [];
    for (let i = 0; i < 5; i++) { const o = mesh(G.ico, glow(0x8a2aff, 2.5), [0, 0, 0], 0.32); orbs.push(o); g.add(o); }
    g.add(body, belly, hat, eyeL, eyeR, monocle, chain, stache, aura);
    const anim = (t, s) => {
        body.scale.y = 2.35 + Math.sin(t * 3) * 0.06;
        aura.rotation.z = 0.2 + t * 0.8;
        aura.scale.setScalar(3.1 + Math.sin(t * 4) * 0.1);
        stache.rotation.x = Math.sin(t * 5) * 0.1;
        hat.rotation.z = 0.15 + Math.sin(t * 2) * 0.05;
        orbs.forEach((o, i) => { const a = t * 1.4 + (i / 5) * Math.PI * 2; o.position.set(Math.cos(a) * 3.2, 2.4 + Math.sin(a * 2) * 0.4, Math.sin(a) * 3.2); o.rotation.y = t * 3; });
    };
    return finish(g, [skin], anim, 5.2);
}

// ====================================================================== loot

function starShape(n = 5, r1 = 0.5, r2 = 0.22) {
    const s = new THREE.Shape();
    for (let i = 0; i <= n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
        const r = i % 2 ? r2 : r1;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
}
const EXT = { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 };

function heartShape() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.15, -0.3, -0.55, -0.15, -0.55, 0.15);
    s.bezierCurveTo(-0.55, 0.45, -0.2, 0.55, 0, 0.3);
    s.bezierCurveTo(0.2, 0.55, 0.55, 0.45, 0.55, 0.15);
    s.bezierCurveTo(0.55, -0.15, 0.15, -0.3, 0, -0.5);
    return s;
}

export function makeItem(kind) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 0.6;
    g.add(inner);
    const add = (...m) => inner.add(...m);
    switch (kind) {
        case 'candy': add(mesh(new THREE.ExtrudeGeometry(starShape(), EXT), glow(0xffe066, 0.9), [0, 0, -0.09])); break;
        case 'cheese': {
            const s = new THREE.Shape();
            s.absarc(0, 0, 0.5, Math.PI * 0.35, Math.PI * 1.65, false);
            s.absarc(0.22, 0, 0.36, Math.PI * 1.55, Math.PI * 0.45, true);
            add(mesh(new THREE.ExtrudeGeometry(s, EXT), std(0xffd86a, { emissive: 0xffb020, ei: 0.4 }), [0, 0, -0.09]));
            break;
        }
        case 'cone':
            add(mesh(G.cone, std(0xd08a3a), [0, -0.15, 0], [0.26, 0.6, 0.26], [Math.PI, 0, 0]));
            add(mesh(G.sph, std(0xff8ac8, { emissive: 0xff4f9a, ei: 0.3 }), [0, 0.22, 0], 0.3));
            add(mesh(G.sph, glow(0xff2040, 1), [0, 0.52, 0], 0.08));
            break;
        case 'planet':
            add(mesh(G.sph, std(0x4aa8ff, { emissive: 0x1a4aa0, ei: 0.5 }), [0, 0, 0], 0.34));
            add(mesh(G.torus, glow(0xffd8a0, 0.8), [0, 0, 0], [0.55, 0.55, 0.25], [1.2, 0.3, 0]));
            break;
        case 'gem': add(mesh(G.oct, std(0xff5fd2, { emissive: 0xff2fb0, ei: 1.2, metal: 0.3, rough: 0.1, flat: true }), [0, 0, 0], [0.34, 0.48, 0.34])); break;
        case 'crown': {
            const gold = std(0xffd24a, { metal: 0.9, rough: 0.2, emissive: 0x6a4a00, ei: 0.6 });
            add(mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.3, 20, 1, true), gold, [0, -0.1, 0], 1));
            for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(mesh(G.cone, gold, [Math.cos(a) * 0.34, 0.15, Math.sin(a) * 0.34], [0.08, 0.22, 0.08])); }
            add(mesh(G.oct, glow(0x5ff4ff, 1.5), [0.38, -0.08, 0], 0.09));
            break;
        }
        case 'diamond': add(mesh(G.oct, std(0x0a0a14, { metal: 0.9, rough: 0.05, emissive: 0x3ad8ff, ei: 0.7, flat: true }), [0, 0, 0], [0.4, 0.55, 0.4])); break;
        case 'diamond2':
            add(mesh(G.sph, std(0x000000, { rough: 0.1 }), [0, 0, 0], 0.26));
            add(mesh(G.torus, glow(0xffa04a, 2.5), [0, 0, 0], [0.5, 0.5, 0.15], [1.3, 0, 0]));
            break;
        case 'heart': {
            const h = mesh(new THREE.ExtrudeGeometry(heartShape(), { ...EXT, depth: 0.3 }), glow(0xff5fa0, 1.8), [0, 0.2, -0.15], 1.8);
            add(h);
            break;
        }
        case 'p:boots':
            inner.scale.setScalar(1.3);
            for (const z of [-0.18, 0.18]) {
                add(mesh(G.box, std(0xff4040, { metal: 0.4 }), [0, -0.05, z], [0.32, 0.4, 0.2]));
                add(mesh(G.box, std(0xff4040, { metal: 0.4 }), [0.12, -0.22, z], [0.4, 0.14, 0.22]));
                add(mesh(G.cone, glow(0xffa040, 2.5), [-0.02, -0.42, z], [0.1, 0.25, 0.1], [Math.PI, 0, 0]));
            }
            break;
        case 'p:long':
        case 'p:rapid': {
            const c = kind === 'p:long' ? 0xff6ad8 : 0x4ab0ff;
            add(mesh(G.sph, std(c, { emissive: c, ei: 0.6, rough: 0.2 }), [0, 0, 0], [0.3, 0.26, 0.26]));
            for (const x of [-1, 1]) add(mesh(G.cone, std(0xffffff, { emissive: c, ei: 0.3 }), [x * 0.42, 0, 0], [0.16, 0.24, 0.16], [0, 0, x * Math.PI / 2]));
            break;
        }
        case 'p:clock':
            add(mesh(G.cyl, std(0xffd24a, { metal: 0.8, rough: 0.2 }), [0, 0, 0], [0.42, 0.12, 0.42], [Math.PI / 2, 0, 0]));
            add(mesh(G.cyl, glow(0xbff4ff, 1.2), [0, 0, 0.07], [0.34, 0.02, 0.34], [Math.PI / 2, 0, 0]));
            add(mesh(G.box, std(0x202030), [0, 0.1, 0.1], [0.04, 0.24, 0.02]), mesh(G.box, std(0x202030), [0.08, 0, 0.1], [0.18, 0.04, 0.02]));
            break;
        case 'p:bomb':
            add(mesh(G.sph, std(0x202030, { metal: 0.6, rough: 0.3 }), [0, 0, 0], 0.36));
            add(mesh(G.cyl, std(0xd0c090), [0.15, 0.4, 0], [0.04, 0.2, 0.04], [0, 0, -0.5]));
            add(mesh(G.sph, glow(0xffa040, 4), [0.22, 0.52, 0], 0.08));
            break;
        case 'p:warp':
            add(mesh(G.torus, glow(0xb05aff, 2.2), [0, 0, 0], [0.42, 0.42, 0.4]));
            add(mesh(G.torus, glow(0x5ff4ff, 1.8), [0, 0, 0], [0.28, 0.28, 0.4]));
            add(mesh(new THREE.CircleGeometry(0.22, 24), std(0x000000), [0, 0, 0.02]));
            break;
        default: add(mesh(G.ico, glow(0xffffff), [0, 0, 0], 0.3));
    }
    const spin = kind === 'p:warp' || kind === 'heart' ? 0 : 1.6;
    const anim = (t) => {
        inner.rotation.y = spin ? t * spin : Math.sin(t * 2) * 0.3;
        inner.position.y = 0.6 + Math.sin(t * 3) * 0.08;
        if (kind === 'p:warp') inner.rotation.z = -t * 3;
        if (kind === 'heart') inner.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
    };
    return finish(g, [], anim, 1.2);
}
