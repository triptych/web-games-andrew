// Actor views: the hero, townsfolk and every monster, built from the fruit kit, with a small
// procedural animation rig (bob, squash, walking feet, swinging hands, casting, hit flash).
// One ActorView per sim entity; js/view/view.js creates and syncs them.

import * as THREE from 'three';
import { FRUIT, bodyGeo, bodyMaterial, addFace, addHat, makeHand, makeFoot, makeWeapon, mat, mesh, radiusAt, isRanged, candyMat, disposeModel } from './fruitkit.js';
import { blobTex, jackFaceTex, glowTex } from './textures.js';

const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export const ACTOR_SCALE = 1.15;
let blobMat = null;

export class ActorView {
    constructor(spec) {
        this.spec = spec;
        this.root = new THREE.Group();
        this.bob = new THREE.Group();
        this.root.add(this.bob);
        this.body = new THREE.Group();
        this.bob.add(this.body);
        this.flashMats = [];
        this.walkT = Math.random() * 6;
        this.hit = 0;
        this.squash = 0;
        this.dying = 0;
        this.scale = (spec.scale || 1) * (spec.model === 'hero' ? ACTOR_SCALE : 1);
        this.handR = new THREE.Group(); this.handL = new THREE.Group();
        this.footL = null; this.footR = null;
        this.blink = 2 + Math.random() * 3;
        this.spin = 0;
        this.swing = null;
        this.flying = !!spec.flying;
        this.extra = [];
        if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.y = 0.012;
        blob.scale.setScalar(0.9 * this.scale);
        blob.renderOrder = 1;
        this.blob = blob;
        this.root.add(blob);
        build(this, spec);
        this.root.scale.setScalar(this.scale);
        this.blob.scale.setScalar(0.9);
        this.root.traverse((o) => { if (o.isMesh && o !== blob) o.castShadow = true; });
    }

    /** Body material(s) that light up when hit. */
    trackFlash(m) { this.flashMats.push(m); m.userData.baseEmissive = m.emissive ? m.emissive.clone() : new THREE.Color(0); return m; }

    setFace(face) { this.face = face; }

    trigger(kind, data = {}) {
        if (kind === 'hit') { this.hit = 0.14; this.squash = Math.max(this.squash, data.big ? 0.35 : 0.2); }
        if (kind === 'swing') this.swing = { t: 0, dur: data.dur || 0.5, kind: data.kind || 'melee' };
        if (kind === 'cast') this.swing = { t: 0, dur: data.dur || 0.5, kind: 'cast' };
        if (kind === 'shoot') this.swing = { t: 0, dur: data.dur || 0.4, kind: 'shoot' };
        if (kind === 'windup') this.windup = { t: 0, dur: data.dur || 0.5, kind: data.kind };
    }

    /** ent: the sim entity. dt: seconds. */
    update(dt, ent, time) {
        // Facing: sim angle a points along (cos a, sin a) in XZ; models face +Z.
        if (ent.face !== undefined) {
            const want = Math.PI / 2 - ent.face;
            let d = want - this.root.rotation.y;
            while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
            this.root.rotation.y += d * Math.min(1, dt * 14);
        }
        const moving = !!ent.moving;
        this.walkT += dt * (moving ? 11 : 2.2);
        // Hit flash and squash.
        this.hit = Math.max(0, this.hit - dt);
        this.squash = Math.max(0, this.squash - dt * 2.2);
        const frozen = ent.status && ent.status.freeze > 0;
        const stunned = ent.status && ent.status.stun > 0;
        const flash = this.hit > 0 ? 1 : 0;
        for (const m of this.flashMats) {
            if (!m.emissive) continue;
            if (flash) m.emissive.setRGB(1.2, 1.2, 1.2);
            else if (frozen) m.emissive.setRGB(0.04, 0.12, 0.28);
            else if (ent.hitFlash === undefined && ent.status && ent.status.burn) m.emissive.setRGB(0.4, 0.12, 0);
            else m.emissive.copy(m.userData.baseEmissive);
        }
        const anim = frozen ? 0 : 1;
        // Bob / walk.
        const lift = this.flying ? 0.75 + Math.sin(time * 3 + this.walkT * 0.2) * 0.12 : 0;
        const bounce = moving ? Math.abs(Math.sin(this.walkT)) * 0.07 : Math.sin(time * 2.4 + this.walkT) * 0.012;
        this.bob.position.y = lift + bounce * anim + (ent.z || 0);
        const sq = this.squash;
        const breathe = 1 + Math.sin(time * 2.2 + this.walkT * 0.1) * 0.015;
        this.bob.scale.set(1 + sq * 0.5, (1 - sq) * breathe, 1 + sq * 0.5);
        this.bob.rotation.x = moving ? 0.12 : 0;
        if (stunned) this.bob.rotation.z = Math.sin(time * 9) * 0.15; else this.bob.rotation.z *= 0.8;
        // Spin (Blender).
        if (ent.spin) { this.spin += dt * 22; this.bob.rotation.y = this.spin; } else { this.spin = 0; this.bob.rotation.y *= 0.7; }
        // Feet.
        if (this.footL) {
            const ph = this.walkT;
            this.footL.position.z = this.footBase.z + (moving ? Math.sin(ph) * 0.13 : 0);
            this.footR.position.z = this.footBase.z + (moving ? -Math.sin(ph) * 0.13 : 0);
            this.footL.position.y = this.footBase.y + (moving ? Math.max(0, Math.cos(ph)) * 0.06 : 0);
            this.footR.position.y = this.footBase.y + (moving ? Math.max(0, -Math.cos(ph)) * 0.06 : 0);
        }
        // Hands: idle sway / walk swing; then any action overrides.
        if (this.handBaseR) {
            const sw = moving ? Math.sin(this.walkT) * 0.5 : Math.sin(time * 2) * 0.08;
            this.handR.rotation.set(sw * anim, 0, 0);
            this.handL.rotation.set(-sw * anim, 0, 0);
            this.handR.position.copy(this.handBaseR);
            this.handL.position.copy(this.handBaseL);
        }
        if (this.swing && !this.handBaseR) {
            // Limbless monsters lunge instead.
            const w = this.swing;
            w.t += dt;
            const k = Math.min(1, w.t / w.dur);
            this.bob.position.z = Math.sin(k * Math.PI) * 0.18;
            if (k >= 1) { this.swing = null; this.bob.position.z = 0; }
        } else if (this.swing) {
            const w = this.swing;
            w.t += dt;
            const k = Math.min(1, w.t / w.dur);
            if (w.kind === 'melee') {
                // Wind back, then a fast diagonal slash across the body.
                const a = k < 0.45 ? -k / 0.45 : -1 + (k - 0.45) / 0.55 * 2.6;
                this.handR.rotation.set(-0.6 - a * 0.9, a * 1.3, 0);
                this.body.rotation.y = -a * 0.25;
            } else if (w.kind === 'shoot') {
                const r = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
                this.handR.rotation.set(-1.4 * (1 - r * 0.2), 0, 0);
                this.handL.rotation.set(-1.4, 0, 0);
                this.handR.position.z = this.handBaseR.z - r * 0.08;
            } else {
                const up = Math.sin(k * Math.PI);
                this.handR.rotation.set(-2.2 * up, 0, -0.3 * up);
                this.handL.rotation.set(-2.2 * up, 0, 0.3 * up);
            }
            if (k >= 1) { this.swing = null; this.body.rotation.y = 0; }
        }
        if (this.windup) {
            const w = this.windup;
            w.t += dt;
            const k = Math.min(1, w.t / w.dur);
            if (w.kind === 'swell') { const p = 1 + k * 0.45 + Math.sin(w.t * 40) * 0.05 * k; this.bob.scale.set(p, p, p); }
            else if (w.kind === 'charge') { this.bob.rotation.x = -0.3 * k; this.bob.position.y += Math.sin(w.t * 50) * 0.02; }
            else { this.bob.rotation.x = -0.35 * Math.sin(k * Math.PI * 0.5); }
            if (w.t > w.dur + 0.2) this.windup = null;
        }
        // Blink.
        this.blink -= dt;
        if (this.face && this.face.eyes) {
            const closed = this.blink < 0.12;
            this.face.eyes.scale.y = closed ? 0.12 : 1;
            if (this.blink < 0) this.blink = 2 + Math.random() * 4;
        }
        if (this.update2) this.update2(dt, ent, time);
    }

    dispose() {
        this.blob.material = null;   // the blob material is shared by every actor
        this.root.remove(this.blob);
        disposeModel(this.root);
    }
}

// --------------------------------------------------------------------------- builders
function fruitBody(av, kind, { tint = 0, rotten = false, seed = 1, face = {}, hat = null, hatColor = null, matOverride = null } = {}) {
    const m = matOverride || bodyMaterial(kind, { tint, rotten, seed });
    av.trackFlash(m);
    const b = mesh(bodyGeo(kind), m);
    av.body.add(b);
    const f = face === false ? null : addFace(av.body, kind, face);
    if (f) av.setFace(f);
    const h = addHat(av.body, kind, hat, hatColor);
    if (!hat || hat === 'none' || hat === 'flower' || hat === 'bandana') addTopFor(av, kind);
    return { mesh: b, mat: m, hat: h };
}
function addTopFor(av, kind) {
    // Tops are part of the kit; re-use via a tiny helper so hats can suppress them.
    const def = FRUIT[kind];
    if (!def.top || def.top === 'none') return;
    const g = new THREE.Group();
    av.body.add(g);
    TOPS(g, kind, def.top);
}
// Delay import of addTop to avoid exporting internals: re-implement via fruitkit's addHat path.
import * as KIT from './fruitkit.js';
const TOPS = (g, kind, top) => KIT.__addTop(g, kind, top);

function limbs(av, kind, { hands = 'glove', feet = true, handScale = 1, shoe = null, handY = null, spread = 1 } = {}) {
    const def = FRUIT[kind];
    const hy = handY ?? def.h * 0.42;
    const r = radiusAt(kind, hy);
    av.handBaseR = new THREE.Vector3(-(r + 0.1) * spread, hy, 0.06);
    av.handBaseL = new THREE.Vector3((r + 0.1) * spread, hy, 0.06);
    av.handR.position.copy(av.handBaseR); av.handL.position.copy(av.handBaseL);
    av.bob.add(av.handR); av.bob.add(av.handL);
    if (hands) {
        const mk = () => { const h = hands === 'glove' ? makeHand('glove', 0.082 * handScale) : mesh(new THREE.SphereGeometry(0.075 * handScale, 10, 8), hands); return h; };
        av.handMeshR = mk(); av.handMeshL = mk();
        av.handR.add(av.handMeshR); av.handL.add(av.handMeshL);
        av.handMeshL.scale.x *= -1;
    }
    if (feet) {
        av.footBase = new THREE.Vector3(0, 0.05, 0.02);
        av.footL = makeFoot(shoe); av.footR = makeFoot(shoe);
        av.footL.position.set(0.13, 0.05, 0.02); av.footR.position.set(-0.13, 0.05, 0.02);
        av.root.add(av.footL); av.root.add(av.footR);
        av.body.position.y = 0.07;
    }
}

function holdWeapon(av, item, hand = 'R') {
    const w = makeWeapon(item);
    const fam = w.userData.family;
    const h = hand === 'R' ? av.handR : av.handL;
    if (!fam) return w;
    if (['potlid', 'pietin', 'board', 'wok'].includes(fam)) { w.position.set(0.06, 0, 0.06); w.rotation.y = Math.PI / 2; w.scale.setScalar(0.9); }
    else if (fam === 'pouch') { w.position.set(0.04, -0.12, -0.02); w.scale.setScalar(0.8); }
    else if (fam === 'gumball' || fam === 'globe') { w.position.set(0.08, 0.16, 0.08); av.orb = w; }
    else if (isRanged(fam)) { w.rotation.x = Math.PI / 2; w.position.set(0, 0, 0.05); }
    else { w.rotation.x = Math.PI / 2 * 0.85; w.position.set(0, 0.02, 0.03); }
    h.add(w);
    return w;
}

function build(av, spec) {
    const B = BUILDERS[spec.model] || BUILDERS.hero;
    B(av, spec);
}

const glowSprite = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size);
    return s;
};

const BUILDERS = {
    hero(av, s) {
        const L = s.look;
        fruitBody(av, L.fruit, { tint: L.tint, face: { eyes: L.eyes, mouth: L.mouth, scale: 1.2, lift: FRUIT[L.fruit].h * 0.1 }, hat: L.hat });
        limbs(av, L.fruit, { shoe: s.shoeMat });
        av.weapon = holdWeapon(av, s.weapon, 'R');
        av.offhand = holdWeapon(av, s.offhand, 'L');
        av.update2 = (dt, ent, time) => {
            const p = av.body.getObjectByName('propeller'); if (p) p.rotation.y += dt * 14;
            if (av.orb) av.orb.position.y = 0.16 + Math.sin(time * 3) * 0.04;
        };
    },

    // ----------------------------------------------------------------- townsfolk
    cane(av) {
        // Deckard Cane: a striped candy cane with a cotton-candy beard and spectacles.
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0.1, 1.16, 0), new THREE.Vector3(0.26, 1.12, 0), new THREE.Vector3(0.3, 0.96, 0)]);
        const m = candyMat().clone(); m.userData = {}; av.trackFlash(m);
        av.body.add(mesh(new THREE.TubeGeometry(curve, 48, 0.17, 14, false), m));
        av.body.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), m, 0, 0.05, 0));
        const face = new THREE.Group(); face.position.set(0, 0.78, 0.13); av.body.add(face);
        for (const sx of [-1, 1]) {
            face.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('eyeWhite'), sx * 0.06, 0.04, 0.04));
            face.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('pupil'), sx * 0.06, 0.04, 0.075));
            const ring = mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 16), mat('gold'), sx * 0.06, 0.04, 0.09); face.add(ring);
        }
        for (let i = 0; i < 9; i++) face.add(mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.015, 8, 6), mat('pink'), (i % 3 - 1) * 0.06, -0.08 - Math.floor(i / 3) * 0.06, 0.05 - Math.floor(i / 3) * 0.01));
        av.setFace({ eyes: face });
        limbs(av, 'pear', { handY: 0.55 });
        const book = mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), mat('red'), 0, 0, 0.08); av.handL.add(book);
    },
    granny(av) {
        fruitBody(av, 'apple', { matOverride: (() => { const m = bodyMaterial('apple'); m.map = null; m.color = new THREE.Color(0x8fd13e); return m; })(), face: { eyes: 'happy', mouth: 'smile' } });
        av.body.add(mesh(new THREE.SphereGeometry(0.13, 12, 10), mat('white'), 0, 0.86, -0.08));
        const shawl = mesh(new THREE.TorusGeometry(0.38, 0.07, 8, 24), mat('purple'), 0, 0.42, 0); shawl.rotation.x = Math.PI / 2; av.body.add(shawl);
        for (const sx of [-1, 1]) av.body.add(mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), mat('gold'), sx * 0.1, 0.42, 0.41));
        limbs(av, 'apple');
        av.handR.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat('glowPink'), 0, 0.05, 0.05));
    },
    grapeswold(av) {
        const r = fruitBody(av, 'grape', { face: { eyes: 'round', mouth: 'grin', brows: true } });
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; av.body.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), r.mat, Math.cos(a) * 0.3, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.22 - 0.12)); }
        av.body.add(mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), mat('darkwood'), 0, 0.28, 0.36));
        for (let i = 0; i < 6; i++) av.body.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('black'), (i % 3 - 1) * 0.06, 0.2 - Math.floor(i / 3) * 0.05, 0.4));
        limbs(av, 'grape', { handScale: 1.25 });
        const ham = new THREE.Group(); ham.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), mat('wood'), 0, 0.15, 0)); ham.add(mesh(new THREE.BoxGeometry(0.2, 0.11, 0.11), mat('darksteel'), 0, 0.36, 0)); ham.rotation.x = 1.3; av.handR.add(ham);
        av.root.scale.setScalar(1.15);
    },
    olivia(av) {
        fruitBody(av, 'plum', { matOverride: (() => { const m = bodyMaterial('plum'); m.map = null; m.color = new THREE.Color(0x56622a); return m; })(), face: { eyes: 'sleepy', mouth: 'smirk' }, hat: 'wizard', hatColor: 0x5a2a88 });
        limbs(av, 'plum');
        const ball = mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('glowBlue'), 0, 0.2, 0.08); av.handL.add(ball);
        av.extra.push(ball);
        av.update2 = (dt, ent, time) => { ball.position.y = 0.2 + Math.sin(time * 2) * 0.04; };
    },
    kiwirt(av) {
        fruitBody(av, 'kiwi', { face: { eyes: 'round', mouth: 'smirk' }, hat: 'propeller' });
        limbs(av, 'kiwi');
        av.footL.visible = false;
        const peg = mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.18, 6), mat('wood'), 0.13, 0.09, 0.02); av.root.add(peg);
        av.root.scale.setScalar(0.85);
        av.update2 = (dt) => { const p = av.body.getObjectByName('propeller'); if (p) p.rotation.y += dt * 9; };
    },

    // ----------------------------------------------------------------- monsters
    grape(av, s) {
        const r = fruitBody(av, 'grape', { rotten: true, seed: s.seed, face: { eyes: 'round', mouth: 'teeth', angry: true } });
        for (let i = 0; i < 3; i++) av.body.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), r.mat, (i - 1) * 0.15, 0.78, -0.05 - (i % 2) * 0.05));
        limbs(av, 'grape', { hands: r.mat, feet: false });
        av.handBaseR.z = av.handBaseL.z = 0.32; av.handBaseR.y = av.handBaseL.y = 0.42;
        av.zombie = true;
    },
    fly(av) {
        const bodyM = new THREE.MeshPhysicalMaterial({ color: 0x5a3a20, roughness: 0.5, clearcoat: 0.6 }); av.trackFlash(bodyM);
        const b = mesh(new THREE.SphereGeometry(0.17, 12, 10), bodyM, 0, 0.0, 0); b.scale.set(1, 0.9, 1.3); av.body.add(b);
        const eyeM = new THREE.MeshPhysicalMaterial({ color: 0xd81818, roughness: 0.2, clearcoat: 1 });
        for (const sx of [-1, 1]) av.body.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), eyeM, sx * 0.1, 0.06, 0.15));
        const wingM = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
        const wings = [];
        for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.08, 0.13, -0.02); const p = mesh(new THREE.CircleGeometry(0.2, 12), wingM, sx * 0.18, 0, 0); p.rotation.x = -Math.PI / 2; p.scale.set(1, 0.5, 1); w.add(p); av.body.add(w); wings.push(w); }
        av.flying = true;
        av.update2 = (dt, ent, time) => { const f = Math.sin(time * 60) * 0.6; wings[0].rotation.z = f; wings[1].rotation.z = -f; };
    },
    peelton(av, s) {
        const peelM = bodyMaterial('banana', { rotten: true, seed: s.seed }); av.trackFlash(peelM);
        // Body: a peeled banana with three flaps hanging down.
        const b = mesh(bodyGeo('banana'), peelM); b.scale.set(0.8, 0.85, 0.8); av.body.add(b);
        for (let i = 0; i < 3; i++) {
            const flap = mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 0.55, 0, Math.PI * 0.62), peelM, 0, 0.62, 0);
            flap.rotation.y = (i / 3) * Math.PI * 2 + Math.PI; flap.scale.set(1, 1.5, 1);
            av.body.add(flap);
        }
        const face = new THREE.Group(); face.position.set(0, 0.62, 0.17); av.body.add(face);
        for (const sx of [-1, 1]) { face.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('black'), sx * 0.06, 0.05, 0)); face.add(mesh(new THREE.SphereGeometry(0.018, 6, 6), mat('glowOrange'), sx * 0.06, 0.05, 0.04)); }
        face.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), mat('black'), 0, -0.04, 0.01));
        limbs(av, 'banana', { hands: mat('bone'), handScale: 0.8 });
        if (s.archer) { const boom = mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI * 0.8), peelM, 0, 0.1, 0.05); boom.rotation.x = Math.PI / 2; av.handR.add(boom); }
        else if (s.thief) { const tp = mesh(new THREE.CylinderGeometry(0.02, 0.005, 0.7, 6), mat('wood'), 0, 0.25, 0.02); tp.rotation.x = 1.4; av.handR.add(tp); }
        else { const club = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.42, 8), mat('bone'), 0, 0.18, 0.02); club.rotation.x = 1.3; av.handR.add(club); }
    },
    worm(av, s) {
        const m = new THREE.MeshPhysicalMaterial({ color: 0xe88aa0, roughness: 0.4, clearcoat: 0.5 }); av.trackFlash(m);
        const segs = [];
        for (let i = 0; i < 4; i++) { const seg = mesh(new THREE.SphereGeometry(0.16 - i * 0.012, 12, 10), m, 0, 0.12 + i * 0.17, -i * 0.04); av.body.add(seg); segs.push(seg); }
        const head = new THREE.Group(); head.position.set(0, 0.72, 0.02); av.body.add(head);
        for (const sx of [-1, 1]) { head.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('eyeWhite'), sx * 0.06, 0.03, 0.1)); head.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), mat('pupil'), sx * 0.06, 0.03, 0.14)); }
        head.add(mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 10, Math.PI), mat('mouth'), 0, -0.04, 0.12)).rotation.z = Math.PI;
        // Bowler hat: a very polite worm.
        head.add(mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('black'), 0, 0.08, 0));
        head.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 14), mat('black'), 0, 0.08, 0));
        const mound = mesh(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 1 }), 0, 0, 0);
        mound.scale.y = 0.4; av.root.add(mound);
        av.update2 = (dt, ent, time) => {
            const under = !!ent.burrowed;
            av.bob.visible = !under || ent.dead;
            mound.visible = under && !ent.dead;
            mound.position.y = Math.sin(time * 12) * 0.02;
            segs.forEach((sg, i) => { sg.position.x = Math.sin(time * 4 + i) * 0.04; });
            head.position.x = Math.sin(time * 4 + 4) * 0.04;
        };
    },
    eggplant(av, s) {
        fruitBody(av, 'eggplant', { rotten: true, seed: s.seed, face: { eyes: 'sleepy', mouth: 'smirk', angry: true, lidMat: mat('purple') } });
        limbs(av, 'eggplant', { hands: mat('green') });
        const st = new THREE.Group(); st.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mat('darkwood'), 0, 0.3, 0)); st.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('glow'), 0, 0.78, 0)); st.rotation.x = 0.25; av.handR.add(st);
    },
    tomato(av, s) {
        fruitBody(av, 'tomato', { rotten: true, seed: s.seed, face: { eyes: 'goggle', mouth: 'fangs', angry: true } });
        limbs(av, 'tomato', { hands: false });
    },
    lemon(av, s) {
        fruitBody(av, 'lemon', { rotten: false, face: { eyes: 'sleepy', mouth: 'o', angry: true, lidMat: mat('brow') } });
        limbs(av, 'lemon', { hands: 'glove' });
    },
    cactus(av, s) {
        const r = fruitBody(av, 'cactus', { face: { eyes: 'fierce', mouth: 'frown', angry: true } });
        const spineM = new THREE.MeshStandardMaterial({ color: 0xfff3c0, roughness: 0.4 });
        const g = new THREE.ConeGeometry(0.012, 0.09, 4);
        for (let i = 0; i < 40; i++) {
            const y = 0.12 + (i % 8) * 0.09, a = i * 2.39996;
            const rr = radiusAt('cactus', y);
            const sp = mesh(g, spineM, Math.cos(a) * rr, y, Math.sin(a) * rr);
            sp.lookAt(Math.cos(a) * 5, y, Math.sin(a) * 5); sp.rotateX(Math.PI / 2);
            av.body.add(sp);
        }
        for (const sx of [-1, 1]) { const arm = mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), r.mat, sx * 0.44, 0.52, 0); arm.rotation.z = sx * 0.3; av.body.add(arm); }
    },
    crab(av, s) {
        fruitBody(av, 'coconut', { face: { eyes: 'goggle', mouth: 'grin', angry: true } });
        const shell = new THREE.MeshStandardMaterial({ color: 0xc8502a, roughness: 0.5 });
        const legs = [], pincers = [];
        for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1, k = i % 3; const leg = mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6), shell, sx * 0.42, 0.14, (k - 1) * 0.18); leg.rotation.z = sx * 1.0; av.bob.add(leg); legs.push(leg); }
        for (const sx of [-1, 1]) {
            // A rounded palm with two curved pincers that snap open and shut.
            const claw = new THREE.Group(); claw.position.set(sx * 0.44, 0.4, 0.28); claw.rotation.y = -sx * 0.4;
            const palm = mesh(new THREE.SphereGeometry(0.11, 12, 10), shell, 0, 0, 0); palm.scale.set(1, 0.8, 1.3); claw.add(palm);
            const top = new THREE.Group(); top.position.set(0, 0.04, 0.1); claw.add(top);
            const bot = new THREE.Group(); bot.position.set(0, -0.03, 0.1); claw.add(bot);
            const p1 = mesh(new THREE.ConeGeometry(0.06, 0.24, 8), shell, 0, 0, 0.1); p1.rotation.x = Math.PI / 2; p1.scale.set(1, 1, 0.6); top.add(p1);
            const p2 = mesh(new THREE.ConeGeometry(0.045, 0.18, 8), shell, 0, 0, 0.08); p2.rotation.x = Math.PI / 2; p2.scale.set(1, 1, 0.6); bot.add(p2);
            av.bob.add(claw);
            pincers.push([top, bot]);
        }
        av.update2 = (dt, ent, time) => {
            legs.forEach((l, i) => { l.rotation.x = ent.moving ? Math.sin(time * 18 + i * 1.7) * 0.4 : 0; });
            const snap = 0.15 + Math.abs(Math.sin(time * (ent.act ? 14 : 3))) * 0.35;
            for (const [t, b] of pincers) { t.rotation.x = -snap; b.rotation.x = snap * 0.6; }
        };
    },
    pumpkin(av) {
        const m = bodyMaterial('pumpkin'); m.emissiveMap = jackFaceTex(); m.emissive = new THREE.Color(1.4, 0.8, 0.2);
        av.trackFlash(m);
        // The carved face is drawn centred on u = 0.5, which bodyGeo() maps to −X; a quarter turn brings it to the front (+Z).
        const b = mesh(bodyGeo('pumpkin'), m); b.rotation.y = Math.PI / 2; av.body.add(b);
        KIT.__addTop(av.body, 'pumpkin', 'pumpkinstem');
        addHat(av.body, 'pumpkin', 'wizard', 0x2a1a3a);
        const g = glowSprite(0xff9a3a, 1.4); g.position.set(0, 0.4, 0.3); av.body.add(g);
        av.flying = true;
        limbs(av, 'pumpkin', { hands: mat('glowOrange'), feet: false, handScale: 0.8 });
    },
    chili(av, s) {
        fruitBody(av, 'chili', { face: { eyes: 'fierce', mouth: 'fangs', angry: true } });
        for (const sx of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.035, 0.12, 6), mat('black'), sx * 0.09, 0.9, 0.02); h.rotation.z = -sx * 0.4; av.body.add(h); }
        limbs(av, 'chili', { hands: mat('red'), handScale: 0.8 });
        const g = glowSprite(0xff5a1a, 0.9); g.position.set(0, 0.5, 0); av.body.add(g);
        av.root.scale.multiplyScalar(0.9);
    },
    durian(av, s) {
        const r = fruitBody(av, 'durian', { rotten: true, seed: s.seed, face: { eyes: 'round', mouth: 'teeth', angry: true } });
        addSpikes(av, 'durian', 46, 0.05, 0.14);
        limbs(av, 'durian', { hands: r.mat, handScale: 1.5 });
    },
    mimic(av) {
        const crust = new THREE.MeshStandardMaterial({ color: 0xd99846, roughness: 0.7 }); av.trackFlash(crust);
        av.body.add(mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.26, 20), crust, 0, 0.13, 0));
        const lid = new THREE.Group(); lid.position.set(0, 0.26, -0.36); av.body.add(lid);
        lid.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 20), crust, 0, 0.0, 0.36));
        for (let i = -2; i <= 2; i++) { lid.add(mesh(new THREE.BoxGeometry(0.8, 0.04, 0.07), crust, 0, 0.04, 0.36 + i * 0.15)); }
        const jam = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 20), mat('red'), 0, 0.26, 0); av.body.add(jam);
        const teeth = [];
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI - Math.PI; const t = mesh(new THREE.ConeGeometry(0.035, 0.1, 5), mat('teeth'), Math.cos(a) * 0.36, 0.3, Math.sin(a) * -0.36 + 0.0); t.rotation.x = Math.PI; teeth.push(t); av.body.add(t); }
        const eyes = new THREE.Group(); lid.add(eyes);
        for (const sx of [-1, 1]) { eyes.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('eyeWhite'), sx * 0.12, 0.05, 0.62)); eyes.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), mat('pupil'), sx * 0.12, 0.05, 0.68)); }
        av.update2 = (dt, ent, time) => {
            const awake = ent.state !== 'disguised';
            lid.rotation.x = awake ? -0.5 - Math.abs(Math.sin(time * 6)) * 0.4 : 0;
            teeth.forEach((t) => (t.visible = awake)); eyes.visible = awake;
        };
    },
    juicer(av) {
        // The Juicer: a giant angry juicer on stubby legs, blades spinning in a jar of juice.
        const steel = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, roughness: 0.25, metalness: 0.85 }); av.trackFlash(steel);
        const base = mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.5, 24), steel, 0, 0.3, 0); av.body.add(base);
        av.body.add(mesh(new THREE.BoxGeometry(0.22, 0.12, 0.05), mat('black'), 0, 0.38, 0.58));
        for (let i = 0; i < 3; i++) av.body.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10), mat(i === 1 ? 'glowPink' : 'red'), -0.1 + i * 0.1, 0.38, 0.6)).rotation.x = Math.PI / 2;
        const jar = mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.95, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.32, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), 0, 1.02, 0);
        av.body.add(jar);
        const juice = mesh(new THREE.CylinderGeometry(0.44, 0.4, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.2, emissive: 0x401000 }), 0, 0.85, 0); av.body.add(juice);
        const blade = new THREE.Group(); blade.position.y = 0.7; av.body.add(blade);
        for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(0.62, 0.02, 0.1), mat('steel'), 0, 0, 0); b.rotation.y = (i * Math.PI) / 4; blade.add(b); }
        av.body.add(mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 24), steel, 0, 1.52, 0));
        const face = new THREE.Group(); face.position.set(0, 1.1, 0.46); av.body.add(face);
        for (const sx of [-1, 1]) { face.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), mat('eyeWhite'), sx * 0.16, 0.08, 0)); face.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('pupil'), sx * 0.16, 0.08, 0.08)); const b = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mat('black'), sx * 0.16, 0.22, 0.04); b.rotation.z = sx * 0.45; face.add(b); }
        face.add(mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14, Math.PI), mat('mouth'), 0, -0.12, 0.02));
        av.setFace({ eyes: face });
        limbs(av, 'watermelon', { handScale: 1.7, handY: 0.9, spread: 1.6, shoe: mat('black') });
        for (const h of [av.handR, av.handL]) { const k = mesh(new THREE.BoxGeometry(0.12, 0.5, 0.02), mat('steel'), 0, 0.25, 0.08); k.rotation.x = 1.2; h.add(k); }
        av.update2 = (dt, ent, time) => { blade.rotation.y += dt * (ent.act ? 40 : 14); juice.position.y = 0.85 + Math.sin(time * 9) * 0.02; };
    },
    mango(av) {
        const r = fruitBody(av, 'mangoboss', { face: { eyes: 'fierce', mouth: 'grin', angry: true }, hat: 'crown' });
        const cape = mesh(new THREE.CylinderGeometry(0.35, 0.6, 0.9, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0x8a1020, roughness: 0.7, side: THREE.DoubleSide }), 0, 0.45, 0);
        cape.rotation.y = Math.PI; av.body.add(cape);
        limbs(av, 'mangoboss', { hands: mat('glowOrange'), feet: false, handScale: 1.3 });
        for (const h of [av.handR, av.handL]) { const g = glowSprite(0xff7a1a, 0.8); h.add(g); }
        av.flying = true;
    },
    durianlord(av) {
        const r = fruitBody(av, 'durian', { rotten: true, seed: 9, face: { eyes: 'fierce', mouth: 'fangs', angry: true, pupilMat: mat('glowPink') }, hat: 'crown' });
        addSpikes(av, 'durian', 70, 0.06, 0.2);
        for (const sx of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.08, 0.42, 8), mat('black'), sx * 0.28, 0.98, 0); h.rotation.z = -sx * 0.6; av.body.add(h); }
        limbs(av, 'durian', { hands: r.mat, handScale: 1.8 });
        const aura = glowSprite(0x9a3aff, 3.2); aura.position.y = 0.5; av.body.add(aura);
        av.update2 = (dt, ent, time) => { aura.material.opacity = 0.35 + Math.sin(time * 3) * 0.15; };
    },
};

function addSpikes(av, kind, n, r, len) {
    const g = new THREE.ConeGeometry(r, len, 5);
    const m = mat('spike');
    const def = FRUIT[kind];
    for (let i = 0; i < n; i++) {
        const y = def.h * (0.1 + 0.85 * ((i * 0.618) % 1)), a = i * 2.39996;
        const rr = radiusAt(kind, y);
        const sp = mesh(g, m, Math.cos(a) * rr, y, Math.sin(a) * rr);
        sp.lookAt(Math.cos(a) * 9, y + (y / def.h - 0.5) * 6, Math.sin(a) * 9); sp.rotateX(Math.PI / 2);
        av.body.add(sp);
    }
}

/** Spec for a monster entity from the sim. */
export function monsterSpec(m) {
    const model = m.def.model;
    const base = { model, seed: m.id, scale: 1 };
    if (model === 'archer') { base.model = 'peelton'; base.archer = true; }
    if (m.type === 'thief') { base.thief = true; }
    if (m.def.flying) base.flying = true;
    // Visual radius ≈ 1.25 × the sim radius; fruit bodies are ~0.42 across at scale 1.
    const sizeK = m.boss ? (model === 'juicer' ? 1.35 : model === 'mango' ? 2.0 : 2.3) : (m.r * 1.25) / 0.42;
    base.scale = sizeK;
    if (model === 'fly') base.scale = 1.0;
    if (model === 'worm') base.scale = 1.0;
    return base;
}
