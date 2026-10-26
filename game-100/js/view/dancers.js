// Two dancers for the pre-roll and the menus, built from capsules and cones: a white-suit
// pointer with a pompadour and shades, and a magenta jumpsuit with an afro and bell-bottoms. They
// dance on the band's beat (the finger-point, the hip swing, the afro bounce) and only stand on
// the stage while the board isn't on it. Everything is animated from one beat number.

import * as THREE from 'three';

const SKIN = [0xe8b48c, 0x8a5a3a];

function limb(len, r, mat) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.y = -len / 2;
    return m;
}

function makeDancer({ suit, shirt, skin, afro, dress, envMap }) {
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, envMap, envMapIntensity: 0.5, ...extra });
    const suitMat = std(suit, { emissive: new THREE.Color(suit).multiplyScalar(0.12) });
    const shirtMat = std(shirt, { emissive: new THREE.Color(shirt).multiplyScalar(0.2) });
    const skinMat = std(skin, { roughness: 0.7 });
    const shoeMat = std(0xf2f2f6, { metalness: 0.6, roughness: 0.25, envMapIntensity: 1.2 });
    const hairMat = std(0x1a0d08, { roughness: 0.9 });
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 1.2;
    root.add(hips);
    const parts = {};

    // legs: thigh, shin inside a bell-bottom flare, platform shoe
    for (const side of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.13, 0, 0);
        const thigh = limb(0.5, 0.1, suitMat);
        hip.add(thigh);
        const knee = new THREE.Group();
        knee.position.y = -0.62;
        hip.add(knee);
        knee.add(limb(0.42, 0.075, suitMat));
        const flare = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.62, 16, 1, true), suitMat);
        flare.material.side = THREE.DoubleSide;
        flare.position.y = -0.34;
        knee.add(flare);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), shoeMat);
        shoe.position.set(0, -0.68, 0.06);
        knee.add(shoe);
        hips.add(hip);
        parts[side < 0 ? 'hipL' : 'hipR'] = hip;
        parts[side < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    // torso
    const torso = new THREE.Group();
    torso.position.y = 0.05;
    hips.add(torso);
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 12), dress ? suitMat : suitMat);
    chest.position.y = 0.42;
    chest.scale.set(1.1, 1, 0.75);
    torso.add(chest);
    const vee = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 3), shirtMat);
    vee.rotation.x = Math.PI; vee.position.set(0, 0.6, 0.145); vee.scale.set(1, 1, 0.3);
    torso.add(vee);
    for (const side of [-1, 1]) {                       // the big pointed collar
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 3), shirtMat);
        c.position.set(side * 0.12, 0.82, 0.13); c.rotation.set(0.2, 0, side * 0.7); c.scale.z = 0.3;
        torso.add(c);
    }
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), std(0xffc92a, { metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }));
    belt.position.y = 0.04; belt.scale.set(1.1, 1, 0.75);
    torso.add(belt);
    // head
    const head = new THREE.Group();
    head.position.y = 1.05;
    torso.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skinMat));
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.075, 0.07), new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 0.15, metalness: 0.8, envMap, envMapIntensity: 1.5 }));
    shades.position.set(0, 0.03, 0.17);
    head.add(shades);
    if (afro) {
        const a = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), hairMat);
        a.position.set(0, 0.1, -0.06);
        head.add(a);
        parts.afro = a;
    } else {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
        h.position.set(0, 0.04, -0.015);
        head.add(h);
        const pomp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hairMat);
        pomp.position.set(0, 0.2, 0.08); pomp.scale.set(1.2, 0.8, 1.2);
        head.add(pomp);
    }
    // arms
    for (const side of [-1, 1]) {
        const sh = new THREE.Group();
        sh.position.set(side * 0.3, 0.8, 0);
        torso.add(sh);
        sh.add(limb(0.36, 0.065, suitMat));
        const el = new THREE.Group();
        el.position.y = -0.46;
        sh.add(el);
        el.add(limb(0.34, 0.055, suitMat));
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skinMat);
        hand.position.y = -0.46;
        el.add(hand);
        parts[side < 0 ? 'shL' : 'shR'] = sh;
        parts[side < 0 ? 'elL' : 'elR'] = el;
    }
    root.userData = { parts, hips, torso, head };
    return root;
}

export class Dancers {
    constructor(scene, envMap) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.tony = makeDancer({ suit: 0xf4f0e8, shirt: 0x2de2ff, skin: SKIN[0], afro: false, envMap });
        this.donna = makeDancer({ suit: 0xff2fa8, shirt: 0xffd21f, skin: SKIN[1], afro: true, dress: true, envMap });
        this.group.add(this.tony, this.donna);
        this.amount = 0;
        this.group.visible = false;
    }

    /** show: bool; beat: the band's position in beats (a float). camera: to place them at the screen edges. */
    update(dt, time, beat, { show, camera, aspect }) {
        this.amount += ((show ? 1 : 0) - this.amount) * Math.min(1, dt * 3);
        this.group.visible = this.amount > 0.02;
        if (!this.group.visible) return;
        const hv = Math.tan((camera.fov * Math.PI) / 360);
        const depth = 18;
        const place = (d, side) => {
            const ndcX = side * (aspect > 1.9 ? 0.8 : 0.78);
            const v = new THREE.Vector3(ndcX, -0.55, 0.5).unproject(camera).sub(camera.position).normalize();
            const k = (camera.position.z - -2) / -v.z;
            d.position.copy(camera.position).addScaledVector(v, k);
            const s = (0.5 * 2 * hv * (camera.position.z + 2)) / 2.7;
            d.scale.setScalar(s * (0.6 + 0.4 * this.amount));
            d.rotation.y = -side * 0.35;
        };
        place(this.tony, -1);
        place(this.donna, 1);
        void depth;
        this.pose(this.tony, beat, time, 0);
        this.pose(this.donna, beat + 0.5, time, 1);
    }

    pose(d, beat, time, kind) {
        const { parts: p, hips, torso, head } = d.userData;
        const ph = beat * Math.PI;                     // a full swing every two beats
        const s = Math.sin(ph), c = Math.cos(ph);
        const bounce = Math.abs(Math.sin(beat * Math.PI));
        hips.position.y = 1.2 - 0.05 + bounce * 0.07;
        hips.rotation.z = s * 0.09;
        hips.rotation.y = c * 0.22;
        torso.rotation.z = -s * 0.07;
        torso.rotation.y = -c * 0.25;
        head.rotation.z = s * 0.1;
        head.rotation.x = bounce * 0.08;
        // legs: knees pump on the beat, feet take turns
        p.hipL.rotation.x = -0.1 + Math.max(0, s) * 0.5;
        p.kneeL.rotation.x = Math.max(0, s) * 0.8;
        p.hipR.rotation.x = -0.1 + Math.max(0, -s) * 0.5;
        p.kneeR.rotation.x = Math.max(0, -s) * 0.8;
        p.hipL.rotation.z = -0.07; p.hipR.rotation.z = 0.07;
        if (kind === 0) {
            // the finger-point: one arm shoots up and across, then sweeps down; the other hand is on the hip
            const up = 0.5 - 0.5 * c;                 // 0 → 1 → 0
            p.shR.rotation.z = THREE.MathUtils.lerp(0.2, 2.7, up);
            p.shR.rotation.x = THREE.MathUtils.lerp(0, -0.3, up);
            p.elR.rotation.z = THREE.MathUtils.lerp(0.1, 0.0, up);
            p.shL.rotation.z = -0.55; p.elL.rotation.z = -1.3; p.shL.rotation.x = 0.2;
        } else {
            // both arms up and swaying
            p.shL.rotation.z = -2.2 + s * 0.35; p.shR.rotation.z = 2.2 + s * 0.35;
            p.elL.rotation.z = -0.5 + c * 0.3; p.elR.rotation.z = 0.5 + c * 0.3;
            p.shL.rotation.x = p.shR.rotation.x = 0;
            hips.rotation.z = s * 0.16;
            if (p.afro) p.afro.scale.setScalar(1 + bounce * 0.05);
        }
        void time;
    }
}
