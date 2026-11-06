// Nib, Elowen and the shades. Built from simple shapes with painted faces, posed by code.

import * as THREE from 'three';
import { faceTex, glow } from './tex.js';

const M = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...opts });
const part = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

/** Nib: grey-green, ears like sails, eyes like lamps, a red scarf and a satchel. */
export function makeNib() {
    const g = new THREE.Group();
    const skin = M({ color: 0x7f9a6a }), dark = M({ color: 0x5c7450 });
    const body = new THREE.Group(); g.add(body);
    const torso = part(new THREE.SphereGeometry(0.22, 14, 10), M({ color: 0x6b5338 }), 0, 0.42, 0); torso.scale.set(1, 1.15, 0.9); body.add(torso);
    const scarf = part(new THREE.TorusGeometry(0.15, 0.05, 6, 14), M({ color: 0xb0383a }), 0, 0.62, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
    const tail = part(new THREE.BoxGeometry(0.08, 0.22, 0.03), M({ color: 0xb0383a }), 0.08, 0.5, 0.17); tail.rotation.z = 0.3; body.add(tail);
    const head = new THREE.Group(); head.position.y = 0.82; body.add(head);
    const skull = part(new THREE.SphereGeometry(0.24, 18, 14), skin); skull.scale.set(1.1, 0.95, 1); head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.243, 24, 16, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.25, Math.PI * 0.5), M({ map: faceTex('nib') }));
    face.scale.set(1.1, 0.95, 1); head.add(face);
    const earGeo = new THREE.ConeGeometry(0.11, 0.48, 6); earGeo.rotateZ(Math.PI / 2); earGeo.translate(0.24, 0, 0);
    const earL = part(earGeo, skin, 0.18, 0.04, 0); earL.rotation.z = 0.35;
    const earR = part(earGeo.clone(), skin, -0.18, 0.04, 0); earR.rotation.set(0, Math.PI, 0.35);
    head.add(earL, earR);
    const nose = part(new THREE.SphereGeometry(0.06, 8, 6), dark, 0, -0.02, -0.25); nose.scale.set(1, 0.8, 1.3); head.add(nose);
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(s * 0.09, 0.26, 0); leg.add(part(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 6), skin, 0, -0.13, 0)); leg.add(part(new THREE.BoxGeometry(0.1, 0.05, 0.16), dark, 0, -0.26, -0.03)); body.add(leg); legs.push(leg);
        const arm = new THREE.Group(); arm.position.set(s * 0.22, 0.56, 0); arm.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6), skin, 0, -0.15, 0)); arm.add(part(new THREE.SphereGeometry(0.05, 8, 6), skin, 0, -0.31, 0)); arm.rotation.z = s * 0.25; body.add(arm); arms.push(arm);
    }
    const bag = part(new THREE.BoxGeometry(0.2, 0.18, 0.1), M({ color: 0x8a6a3a }), -0.18, 0.38, 0.12); bag.rotation.y = 0.4; body.add(bag);
    g.userData = { body, head, earL, earR, legs, arms, t: 0, blink: 0 };
    return g;
}

export function poseNib(nib, dt, moving, talk = 0) {
    const u = nib.userData;
    u.t += dt * (moving ? 9 : 2);
    const sw = moving ? Math.sin(u.t) : 0;
    u.legs[0].rotation.x = sw * 0.7; u.legs[1].rotation.x = -sw * 0.7;
    u.arms[0].rotation.x = -sw * 0.6; u.arms[1].rotation.x = sw * 0.6;
    u.body.position.y = moving ? Math.abs(Math.sin(u.t)) * 0.06 : Math.sin(u.t * 0.8) * 0.01;
    u.earL.rotation.z = 0.35 + Math.sin(u.t * 0.7) * 0.06 + talk * 0.2;
    u.earR.rotation.z = 0.35 + Math.cos(u.t * 0.6) * 0.06 + talk * 0.2;
    u.head.rotation.z = Math.sin(u.t * 0.4) * 0.06;
}

/** Elowen: auburn hair in a braid, a green dress, a satchel strap; posed mid-step or standing. */
export function makeElowen() {
    const g = new THREE.Group();
    const skin = M({ color: 0xf2c9a8 }), hair = M({ color: 0x8a3e22, roughness: 0.6 });
    const dress = M({ color: 0x3e6a52, roughness: 0.85 }), apron = M({ color: 0xe6dcc4 }), boot = M({ color: 0x3a2a20 });
    const skirtGeo = new THREE.CylinderGeometry(0.17, 0.36, 0.86, 16, 1, true);
    const skirt = part(skirtGeo, dress, 0, 0.6, 0); skirt.material = dress.clone(); skirt.material.side = THREE.DoubleSide; g.add(skirt);
    const ap = part(new THREE.CylinderGeometry(0.205, 0.345, 0.6, 12, 1, true, -0.75, 1.5), apron, 0, 0.66, 0); ap.rotation.y = Math.PI; ap.material.side = THREE.DoubleSide; g.add(ap);
    const torso = part(new THREE.CylinderGeometry(0.15, 0.18, 0.5, 14), dress, 0, 1.25, 0); torso.scale.set(1, 1, 0.8); g.add(torso);
    const strap = part(new THREE.TorusGeometry(0.2, 0.018, 4, 20), M({ color: 0x6a4a2a }), 0, 1.25, 0); strap.rotation.set(0.2, 0, 0.75); g.add(strap);
    g.add(part(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), skin, 0, 1.55, 0));
    const head = new THREE.Group(); head.position.y = 1.74; g.add(head);
    const skull = part(new THREE.SphereGeometry(0.15, 20, 16), skin); skull.scale.set(0.92, 1.05, 0.95); head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.151, 24, 16, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.25, Math.PI * 0.55), M({ map: faceTex('elowen') }));
    face.scale.set(0.92, 1.05, 0.95); head.add(face);
    const cap = part(new THREE.SphereGeometry(0.163, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hair, 0, 0.018, 0.02); cap.scale.set(0.98, 1.06, 1.04); head.add(cap);
    const back = part(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI, 0, Math.PI * 0.8), hair, 0, 0.0, 0.022); back.scale.set(0.98, 1.05, 1.0); head.add(back);
    const bangs = part(new THREE.SphereGeometry(0.07, 10, 6), hair, 0.04, 0.115, -0.11); bangs.scale.set(1.6, 0.5, 0.6); bangs.rotation.z = 0.25; head.add(bangs);
    for (const s of [-1, 1]) { const side = part(new THREE.SphereGeometry(0.09, 10, 8), hair, s * 0.11, -0.05, 0.03); side.scale.set(0.6, 1.4, 0.9); head.add(side); }
    const braid = new THREE.Group(); braid.position.set(0, -0.02, 0.13); head.add(braid);
    for (let i = 0; i < 6; i++) braid.add(part(new THREE.SphereGeometry(0.05 - i * 0.004, 8, 6), hair, 0, -i * 0.075, 0.03 + i * 0.012));
    braid.add(part(new THREE.SphereGeometry(0.03, 6, 4), M({ color: 0x3e6a52 }), 0, -0.46, 0.1));
    const arms = [], legs = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(s * 0.2, 1.45, 0);
        arm.add(part(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), dress, 0, -0.16, 0));
        arm.add(part(new THREE.CylinderGeometry(0.035, 0.03, 0.28, 8), skin, 0, -0.45, 0));
        arm.add(part(new THREE.SphereGeometry(0.04, 8, 6), skin, 0, -0.6, 0));
        arm.rotation.z = s * 0.12; g.add(arm); arms.push(arm);
        const leg = new THREE.Group(); leg.position.set(s * 0.08, 0.2, 0);
        leg.add(part(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), boot, 0, -0.06, 0));
        leg.add(part(new THREE.BoxGeometry(0.09, 0.06, 0.18), boot, 0, -0.17, -0.04));
        g.add(leg); legs.push(leg);
    }
    g.userData = { head, arms, legs, braid, t: 0 };
    return g;
}

/** Frozen: mid-step, one arm raised toward a circle that isn't there any more. */
export function poseElowen(e, mode, dt) {
    const u = e.userData;
    u.t += dt;
    if (mode === 'frozen') {
        u.arms[0].rotation.set(-1.6, 0, -0.5); u.arms[1].rotation.set(-0.3, 0, 0.6);
        u.legs[0].rotation.x = 0.4; u.legs[1].rotation.x = -0.3;
        u.braid.rotation.x = -0.9; u.head.rotation.set(-0.15, 0, 0.05);
    } else {
        const br = Math.sin(u.t * 1.6) * 0.01;
        u.arms[0].rotation.set(-0.15 + br, 0, -0.12); u.arms[1].rotation.set(0.25, 0, 0.35);
        u.legs[0].rotation.x = 0; u.legs[1].rotation.x = 0;
        u.braid.rotation.x = 0.1 + Math.sin(u.t * 0.8) * 0.05;
        u.head.rotation.set(-0.05 + Math.sin(u.t * 0.5) * 0.03, Math.sin(u.t * 0.3) * 0.15, 0);
    }
}

/** A shade: a hooded smear of dark with two cold points for eyes. */
export function makeShade() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x07030c, transparent: true, opacity: 0.82, depthWrite: false });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 10, 4, true), mat);
    body.position.y = 1.05;
    const p = body.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.15)); if (y < -0.9) p.setY(i, y + Math.sin(i * 2.1) * 0.2); }
    g.add(body);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat); hood.position.y = 2.0; hood.scale.set(1, 1.2, 1); g.add(hood);
    const eyeMat = new THREE.SpriteMaterial({ map: glow(), color: 0xb08aff, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const s of [-1, 1]) { const e = new THREE.Sprite(eyeMat); e.scale.setScalar(0.2); e.position.set(s * 0.1, 2.02, -0.24); g.add(e); }
    g.userData = { body };
    return g;
}
