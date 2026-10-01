/**
 * monster3d.js — procedural, toon-shaded creatures built from a monster's `look`
 * (body plan, hues, eyes, horns, ears, wings, tail, mouth, spots, crown…).
 * The same seed always builds the same creature.
 *
 * MonsterView: root group with the feet at y = 0, about 2.4 units tall. Call
 * update(dt) every frame; attack(), cast(color), hurt(), die(), intro() play one-shots.
 */

import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';

let gradient = null;
function toonGradient() {
    if (gradient) return gradient;
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
    return gradient;
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1a0a2a, side: THREE.BackSide });

export class MonsterView {
    constructor(look) {
        this.look = look;
        this.rng = makeRng(look.seed || 1);
        this.root = new THREE.Group();
        this.pivot = new THREE.Group();       // animated
        this.root.add(this.pivot);
        this.mats = [];
        this.eyes = [];
        this.flappers = [];
        this.swayers = [];
        this.jaw = null;
        this.t = Math.random() * 10;
        this.anim = null;
        this.blinkT = 2;
        this.flashT = 0;
        this.dead = false;
        this.col = new THREE.Color().setHSL(look.hue, look.sat, look.light);
        this.col2 = new THREE.Color().setHSL(look.hue2, Math.min(1, look.sat + 0.1), Math.min(0.75, look.light + 0.12));
        if (look.ink) { this.col.setHSL(0.72, 0.35, 0.16); this.col2.setHSL(0.78, 0.6, 0.5); }
        this.build();
        const s = look.scale || 1;
        this.baseScale = s;
        this.root.scale.setScalar(s);
    }

    mat(color, o = {}) {
        const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive: o.emissive ?? 0x000000, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
        this.mats.push(m);
        return m;
    }

    part(geo, m, pos, o = {}) {
        const mesh = new THREE.Mesh(geo, m);
        if (pos) mesh.position.set(...pos);
        if (o.scale) mesh.scale.set(...o.scale);
        if (o.rot) mesh.rotation.set(...o.rot);
        mesh.castShadow = true;
        (o.parent || this.pivot).add(mesh);
        if (o.outline !== false) {
            const ol = new THREE.Mesh(geo, OUTLINE);
            ol.scale.setScalar(1.06);
            mesh.add(ol);
        }
        return mesh;
    }

    sphere(r, m, pos, o = {}) { return this.part(new THREE.SphereGeometry(r, 20, 14), m, pos, o); }

    addEyes(parent, n, y, z, spread, size) {
        const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupil = new THREE.MeshBasicMaterial({ color: 0x14081e });
        const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const xs = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread, 0, spread];
        xs.forEach((x, i) => {
            const g = new THREE.Group();
            const sz = size * (n === 3 && i === 1 ? 1.2 : 1);
            g.position.set(x, y + (n === 3 && i === 1 ? size * 0.6 : 0), z);
            const w = new THREE.Mesh(new THREE.SphereGeometry(sz, 16, 12), white);
            const ol = new THREE.Mesh(w.geometry, OUTLINE); ol.scale.setScalar(1.12); w.add(ol);
            g.add(w);
            const p = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.55, 12, 10), pupil);
            p.position.z = sz * 0.62;
            g.add(p);
            const s = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.18, 8, 6), shine);
            s.position.set(sz * 0.25, sz * 0.3, sz * 0.95);
            g.add(s);
            parent.add(g);
            this.eyes.push(g);
        });
    }

    addMouth(parent, y, z, w) {
        const dark = new THREE.MeshBasicMaterial({ color: 0x3a0a1e });
        const kind = this.look.mouth;
        if (kind === 'o') {
            const m = new THREE.Mesh(new THREE.CircleGeometry(w * 0.3, 16), dark);
            m.position.set(0, y, z); parent.add(m);
        } else {
            const shape = new THREE.Shape();
            shape.moveTo(-w, 0);
            shape.quadraticCurveTo(0, kind === 'grin' ? -w * 1.1 : -w * 0.8, w, 0);
            shape.quadraticCurveTo(0, -w * 0.25, -w, 0);
            const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), dark);
            m.position.set(0, y, z); parent.add(m);
            if (kind === 'fangs' || kind === 'grin') {
                const tooth = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const n = kind === 'grin' ? 4 : 2;
                for (let i = 0; i < n; i++) {
                    const t = new THREE.Mesh(new THREE.ConeGeometry(w * 0.11, w * 0.3, 4), tooth);
                    t.rotation.z = Math.PI;
                    t.position.set(-w * 0.5 + (i / Math.max(1, n - 1)) * w, y - w * 0.12, z + 0.01);
                    parent.add(t);
                }
            }
        }
    }

    addHorns(parent, y, spread, size, color) {
        const n = this.look.horns;
        if (!n) return;
        const m = this.mat(color);
        const xs = n === 1 ? [0] : [-spread, spread];
        for (const x of xs) {
            const h = this.part(new THREE.ConeGeometry(size * 0.3, size, 8), m, [x, y, 0], { rot: [0, 0, -x * 0.9] , parent });
            h.position.y += size * 0.4;
        }
    }

    addWings(parent, y, z, span, color, kind = 'bat') {
        const m = this.mat(color, { opacity: kind === 'fairy' ? 0.7 : undefined });
        m.side = THREE.DoubleSide;
        const shape = new THREE.Shape();
        if (kind === 'fairy') {
            shape.moveTo(0, 0); shape.bezierCurveTo(span * 0.4, span * 0.9, span * 1.1, span * 0.7, span * 0.9, span * 0.1);
            shape.bezierCurveTo(span * 1.0, -span * 0.4, span * 0.4, -span * 0.5, 0, 0);
        } else {
            shape.moveTo(0, 0); shape.lineTo(span * 0.5, span * 0.6); shape.lineTo(span, span * 0.35);
            shape.lineTo(span * 0.85, 0); shape.lineTo(span * 0.65, span * 0.12); shape.lineTo(span * 0.45, -span * 0.05);
            shape.lineTo(span * 0.25, span * 0.1); shape.closePath();
        }
        const geo = new THREE.ShapeGeometry(shape);
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(0.15 * s, y, z);
            pivot.scale.x = s;
            const w = new THREE.Mesh(geo, m);
            w.rotation.y = 0.25;
            pivot.add(w);
            parent.add(pivot);
            this.flappers.push({ g: pivot, s, speed: kind === 'fairy' ? 9 : 4 });
        }
    }

    addTail(parent, pos, color, len = 0.8) {
        const g = new THREE.Group();
        g.position.set(...pos);
        const m = this.mat(color);
        let prev = g;
        for (let i = 0; i < 4; i++) {
            const seg = new THREE.Group();
            seg.position.z = i ? -len / 4 : 0;
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.14 - i * 0.025, 10, 8), m);
            seg.add(s);
            prev.add(seg);
            prev = seg;
            this.swayers.push({ g: seg, ph: i * 0.6 });
        }
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), m);
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = -0.2;
        prev.add(tip);
        parent.add(g);
    }

    addCrown(parent, y, r) {
        const gold = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.25, emissive: 0x5a3000 });
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, r * 0.5, 10, 1, true), gold);
        c.material.side = THREE.DoubleSide;
        c.position.y = y;
        parent.add(c);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.5, 4), gold);
            sp.position.set(Math.cos(a) * r, y + r * 0.45, Math.sin(a) * r);
            parent.add(sp);
            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.12), new THREE.MeshBasicMaterial({ color: [0xff3b6b, 0x3fe0ff, 0x46e07a][i % 3] }));
            gem.position.set(Math.cos(a) * r * 1.02, y, Math.sin(a) * r * 1.02);
            parent.add(gem);
        }
    }

    addSpots(parent, r, center, color) {
        if (!this.look.spots) return;
        const m = this.mat(color);
        for (let i = 0; i < 6; i++) {
            const a = this.rng.range(-1.2, 1.2), b = this.rng.range(-0.6, 0.9);
            const p = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)).multiplyScalar(r * 0.98);
            const s = new THREE.Mesh(new THREE.SphereGeometry(r * this.rng.range(0.1, 0.18), 10, 8), m);
            s.position.copy(p).add(new THREE.Vector3(...center));
            s.scale.z = 0.4;
            s.lookAt(new THREE.Vector3(...center).add(p.clone().multiplyScalar(2)));
            parent.add(s);
        }
    }

    addSpikes(parent, y, r, color) {
        if (!this.look.spikes) return;
        const m = this.mat(color);
        for (let i = 0; i < 6; i++) {
            const a = -1 + (i / 5) * 2;
            const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), m);
            s.position.set(Math.sin(a) * r, y + Math.cos(a) * r * 0.9, -r * 0.3);
            s.rotation.z = -a;
            parent.add(s);
        }
    }

    build() {
        const L = this.look, P = this.pivot, rng = this.rng;
        const body = this.mat(this.col), acc = this.mat(this.col2);
        const es = 0.17 * L.eyeSize;
        switch (L.plan) {
            case 'blob': {
                const b = this.sphere(0.95, body, [0, 0.82, 0], { scale: [1, 0.86, 0.92] });
                this.bodyMesh = b;
                if (L.ink) {
                    const gloss = this.mat(this.col2);
                    for (let i = 0; i < 5; i++) { const d = this.part(new THREE.ConeGeometry(0.12, 0.4, 8), gloss, [rng.range(-0.7, 0.7), 0.15, rng.range(-0.3, 0.5)], { rot: [Math.PI, 0, 0] }); d.scale.y = rng.range(0.6, 1.4); }
                    this.part(new THREE.TorusGeometry(0.5, 0.06, 8, 24), gloss, [0, 1.55, 0], { rot: [Math.PI / 2, 0, 0] });
                }
                this.addEyes(P, L.eyes, 1.0, 0.72, 0.3, es * 1.2);
                this.addMouth(P, 0.62, 0.83, 0.28);
                this.addSpots(P, 0.9, [0, 0.82, 0], this.col2);
                this.addHorns(P, 1.5, 0.45, 0.45, this.col2);
                this.addSpikes(P, 0.8, 0.95, this.col2);
                if (L.crown) this.addCrown(P, 1.65, 0.38);
                break;
            }
            case 'biped': {
                const legM = this.mat(this.col.clone().multiplyScalar(0.8));
                for (const s of [-1, 1]) this.part(new THREE.CapsuleGeometry(0.16, 0.35, 4, 10), legM, [0.25 * s, 0.32, 0]);
                const torso = this.sphere(0.5, body, [0, 0.95, 0], { scale: [1, 1.1, 0.85] });
                this.bodyMesh = torso;
                for (const s of [-1, 1]) {
                    const arm = this.part(new THREE.CapsuleGeometry(0.11, 0.42, 4, 8), body, [0.55 * s, 0.95, 0.05], { rot: [0, 0, 0.5 * s] });
                    this.sphere(0.13, acc, [0.68 * s, 0.68, 0.1]);
                    this.swayers.push({ g: arm, ph: s, arm: true });
                }
                const head = this.sphere(0.48, body, [0, 1.72, 0.05]);
                this.addEyes(P, L.eyes, 1.78, 0.45, 0.17, es);
                this.addMouth(P, 1.52, 0.48, 0.18);
                if (L.ears || L.family === 'imp') for (const s of [-1, 1]) this.part(new THREE.ConeGeometry(0.12, 0.38, 6), acc, [0.42 * s, 1.95, 0], { rot: [0, 0, -1.2 * s] });
                this.addHorns(P, 2.05, 0.22, 0.4, L.family === 'gargoyle' ? this.col.clone().multiplyScalar(0.7) : 0x3a1a1a);
                if (L.family === 'gargoyle') this.addWings(P, 1.15, -0.3, 1.0, this.col.clone().multiplyScalar(0.75));
                if (L.tail || L.family === 'imp') this.addTail(P, [0, 0.7, -0.35], this.col);
                this.addSpikes(P, 1.0, 0.5, this.col2);
                if (L.crown) this.addCrown(P, 2.2, 0.3);
                void head;
                break;
            }
            case 'flyer': {
                this.floatY = 0.6;
                const b = this.sphere(0.32, body, [0, 0.9, 0], { scale: [1, 1.2, 1] });
                this.bodyMesh = b;
                this.sphere(0.48, body, [0, 1.55, 0.05]);
                this.addEyes(P, L.eyes, 1.6, 0.44, 0.17, es);
                this.addMouth(P, 1.36, 0.47, 0.14);
                this.addWings(P, 1.05, -0.2, 0.95, this.col2, 'fairy');
                for (const s of [-1, 1]) {
                    this.part(new THREE.CylinderGeometry(0.015, 0.015, 0.4), acc, [0.15 * s, 2.1, 0], { rot: [0, 0, -0.3 * s], outline: false });
                    this.sphere(0.07, acc, [0.27 * s, 2.3, 0], { outline: false });
                }
                const glow = new THREE.PointLight(this.col2.getHex(), 2, 3);
                glow.position.set(0, 1.2, 0.5);
                P.add(glow);
                if (L.crown) this.addCrown(P, 2.05, 0.28);
                break;
            }
            case 'crab': {
                const b = this.sphere(0.8, body, [0, 0.75, 0], { scale: [1.25, 0.62, 0.9] });
                this.bodyMesh = b;
                for (const s of [-1, 1]) {
                    for (let i = 0; i < 3; i++) this.part(new THREE.CapsuleGeometry(0.06, 0.45, 3, 6), acc, [(0.7 + i * 0.12) * s, 0.35, -0.2 + i * 0.22], { rot: [0, 0, 0.9 * s] });
                    const arm = new THREE.Group();
                    arm.position.set(0.95 * s, 0.9, 0.3);
                    P.add(arm);
                    this.sphere(0.32, body, [0.15 * s, 0.25, 0.1], { parent: arm, scale: [1, 0.75, 0.8] });
                    this.part(new THREE.ConeGeometry(0.14, 0.4, 6), body, [0.25 * s, 0.5, 0.15], { parent: arm, rot: [0, 0, -0.4 * s] });
                    this.swayers.push({ g: arm, ph: s * 2, claw: true });
                    const stalk = this.part(new THREE.CylinderGeometry(0.05, 0.05, 0.4), body, [0.25 * s, 1.25, 0.35]);
                    void stalk;
                }
                const eyeHolder = new THREE.Group();
                P.add(eyeHolder);
                this.addEyes(eyeHolder, 2, 1.5, 0.38, 0.25, es * 0.95);
                this.addMouth(P, 0.75, 0.72, 0.2);
                this.addSpots(P, 0.7, [0, 0.75, 0], this.col2);
                if (L.crown) this.addCrown(P, 1.35, 0.32);
                break;
            }
            case 'serpent': {
                let prev = null;
                for (let i = 0; i < 6; i++) {
                    const k = i / 5;
                    const seg = this.sphere(0.36 - k * 0.06, i % 2 ? acc : body, [Math.sin(k * 3) * 0.35, 0.3 + k * 1.4, -0.4 + k * 0.4]);
                    this.swayers.push({ g: seg, ph: i * 0.7, serp: true, base: seg.position.x });
                    prev = seg;
                }
                void prev;
                const head = this.sphere(0.48, body, [0, 2.0, 0.15], { scale: [1, 0.9, 1.15] });
                this.bodyMesh = head;
                for (const s of [-1, 1]) this.part(new THREE.ConeGeometry(0.14, 0.45, 4), acc, [0.42 * s, 2.15, 0], { rot: [0, 0, -1.3 * s] });
                this.addEyes(P, L.eyes, 2.1, 0.58, 0.18, es);
                this.addMouth(P, 1.86, 0.66, 0.2);
                if (L.crown) this.addCrown(P, 2.5, 0.3);
                break;
            }
            case 'wisp': {
                this.floatY = 0.5;
                const core = this.sphere(0.55, this.mat(this.col, { emissive: this.col.clone().multiplyScalar(0.8) }), [0, 1.2, 0], { outline: false });
                this.bodyMesh = core;
                const flameM = new THREE.MeshBasicMaterial({ color: this.col2, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
                for (let i = 0; i < 5; i++) {
                    const f = new THREE.Mesh(new THREE.ConeGeometry(0.4 - i * 0.05, 1.1, 10, 1, true), flameM);
                    f.position.set(rng.range(-0.15, 0.15), 1.7 + i * 0.05, -0.1 * i);
                    P.add(f);
                    this.swayers.push({ g: f, ph: i, flame: true });
                }
                this.addEyes(P, L.eyes, 1.3, 0.5, 0.18, es);
                this.addMouth(P, 1.02, 0.52, 0.15);
                const glow = new THREE.PointLight(this.col.getHex(), 4, 4);
                glow.position.set(0, 1.2, 0.6);
                P.add(glow);
                if (L.crown) this.addCrown(P, 2.0, 0.25);
                break;
            }
            case 'golem': {
                const stone = body;
                const glowM = new THREE.MeshBasicMaterial({ color: this.col2 });
                for (const s of [-1, 1]) this.part(new THREE.BoxGeometry(0.35, 0.55, 0.4), stone, [0.3 * s, 0.3, 0]);
                const torso = this.part(new THREE.BoxGeometry(1.2, 0.9, 0.8), stone, [0, 1.0, 0], { rot: [0, 0, 0.02] });
                this.bodyMesh = torso;
                const head = this.part(new THREE.BoxGeometry(0.7, 0.55, 0.6), stone, [0, 1.75, 0.05]);
                void head;
                for (const s of [-1, 1]) {
                    const arm = this.part(new THREE.BoxGeometry(0.35, 0.9, 0.4), acc, [0.85 * s, 0.85, 0.05]);
                    this.swayers.push({ g: arm, ph: s, arm: true });
                    const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), glowM);
                    e.position.set(0.15 * s, 1.8, 0.37);
                    P.add(e);
                }
                const gear = this.part(new THREE.TorusGeometry(0.22, 0.07, 6, 8), this.mat(0xffc23a), [0, 1.0, 0.42]);
                this.swayers.push({ g: gear, gear: true });
                this.eyeGlow = glowM;
                if (L.crown) this.addCrown(P, 2.15, 0.3);
                break;
            }
            case 'book': {
                const cover = body, pages = this.mat(0xfff6e0);
                const base = this.part(new THREE.BoxGeometry(1.5, 0.18, 1.1), cover, [0, 0.35, 0]);
                this.part(new THREE.BoxGeometry(1.38, 0.24, 1.0), pages, [0, 0.55, 0], { outline: false });
                this.bodyMesh = base;
                const lid = new THREE.Group();
                lid.position.set(0, 0.68, -0.5);
                P.add(lid);
                this.part(new THREE.BoxGeometry(1.5, 0.16, 1.1), cover, [0, 0.08, 0.55], { parent: lid });
                this.part(new THREE.BoxGeometry(1.38, 0.1, 1.0), pages, [0, -0.04, 0.55], { parent: lid, outline: false });
                const tooth = new THREE.MeshBasicMaterial({ color: 0xffffff });
                for (let i = 0; i < 6; i++) {
                    const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), tooth);
                    t.position.set(-0.55 + i * 0.22, -0.12, 1.02);
                    t.rotation.x = Math.PI;
                    lid.add(t);
                    const t2 = new THREE.Mesh(t.geometry, tooth);
                    t2.position.set(-0.55 + i * 0.22, 0.75, 0.5);
                    P.add(t2);
                }
                const tongue = this.part(new THREE.BoxGeometry(0.16, 0.02, 0.7), this.mat(0xff3b6b), [0.3, 0.68, 0.7], { outline: false, rot: [0.3, 0, 0] });
                void tongue;
                this.jaw = lid;
                this.addEyes(lid, L.eyes, 0.34, 0.55, 0.3, es * 1.1);
                const gem = this.part(new THREE.OctahedronGeometry(0.12), this.mat(0xffd23a, { emissive: 0x6a4a00 }), [0, 0.17, 1.05], { parent: lid });
                void gem;
                if (L.crown) this.addCrown(lid, 0.6, 0.3);
                break;
            }
            case 'mushroom': {
                const stem = this.part(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 16), this.mat(0xfff0d8), [0, 0.55, 0]);
                this.bodyMesh = stem;
                const cap = this.part(new THREE.SphereGeometry(0.95, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), body, [0, 1.05, 0], { scale: [1, 0.75, 1] });
                void cap;
                const dots = this.mat(0xffffff);
                for (let i = 0; i < 7; i++) {
                    const a = rng.range(0, Math.PI * 2), b = rng.range(0.15, 1.2);
                    const d = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.1, 0.17), 10, 8), dots);
                    d.position.set(Math.cos(a) * Math.sin(b) * 0.92, 1.05 + Math.cos(b) * 0.7, Math.sin(a) * Math.sin(b) * 0.92);
                    d.scale.y = 0.4;
                    P.add(d);
                }
                this.addEyes(P, L.eyes, 0.72, 0.45, 0.17, es * 0.95);
                this.addMouth(P, 0.42, 0.5, 0.16);
                for (const s of [-1, 1]) this.sphere(0.12, this.mat(0xfff0d8), [0.5 * s, 0.4, 0.15]);
                if (L.crown) this.addCrown(P, 1.85, 0.3);
                break;
            }
            case 'ghost': {
                this.floatY = 0.35;
                const gm = this.mat(this.col, { opacity: 0.85 });
                const head = this.sphere(0.7, gm, [0, 1.5, 0]);
                this.bodyMesh = head;
                const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.2, 16, 1, true), gm);
                skirt.position.set(0, 0.85, 0);
                skirt.rotation.x = Math.PI;
                skirt.material.side = THREE.DoubleSide;
                P.add(skirt);
                this.swayers.push({ g: skirt, ph: 0, flame: true });
                for (const s of [-1, 1]) { const a = this.sphere(0.16, gm, [0.75 * s, 1.2, 0.1]); this.swayers.push({ g: a, ph: s, arm: true }); }
                this.addEyes(P, L.eyes, 1.6, 0.62, 0.22, es * 1.1);
                this.addMouth(P, 1.3, 0.66, 0.2);
                if (L.crown) this.addCrown(P, 2.2, 0.32);
                break;
            }
            case 'beast':
            default: {
                const isDrake = L.family === 'drake', isOwl = L.family === 'owlbear';
                const torso = this.sphere(0.75, body, [0, 0.95, -0.1], { scale: [0.95, 0.8, 1.2] });
                this.bodyMesh = torso;
                const legM = this.mat(this.col.clone().multiplyScalar(0.8));
                for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(new THREE.CapsuleGeometry(0.15, 0.35, 4, 8), legM, [0.42 * sx, 0.32, 0.45 * sz - 0.1]);
                const head = this.sphere(0.55, isOwl ? acc : body, [0, 1.55, 0.6]);
                void head;
                this.addEyes(P, L.eyes, 1.65, 1.08, 0.2, es);
                if (isOwl) {
                    this.part(new THREE.ConeGeometry(0.12, 0.3, 4), this.mat(0xffc23a), [0, 1.45, 1.15], { rot: [Math.PI / 2 + 0.4, 0, 0] });
                    for (const s of [-1, 1]) this.part(new THREE.ConeGeometry(0.14, 0.42, 4), body, [0.35 * s, 2.05, 0.55], { rot: [0, 0, -0.4 * s] });
                } else {
                    this.part(new THREE.SphereGeometry(0.3, 14, 10), body, [0, 1.38, 0.98], { scale: [1, 0.7, 1] });
                    this.addMouth(P, 1.33, 1.24, 0.18);
                }
                this.addHorns(P, 1.95, 0.25, isDrake ? 0.5 : 0.35, this.col2);
                if (L.ears && !isOwl) for (const s of [-1, 1]) this.part(new THREE.ConeGeometry(0.13, 0.32, 6), body, [0.4 * s, 1.95, 0.5], { rot: [0, 0, -0.6 * s] });
                if (isDrake) this.addWings(P, 1.35, -0.2, 1.3, this.col2);
                this.addTail(P, [0, 0.95, -0.95], this.col, 1.1);
                this.addSpots(P, 0.7, [0, 0.95, -0.1], this.col2);
                this.addSpikes(P, 1.25, 0.6, this.col2);
                if (L.crown) this.addCrown(P, 2.15, 0.3);
                break;
            }
        }
        // a soft contact shadow
        const sh = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.01;
        this.root.add(sh);
        this.shadow = sh;
        if (L.glow) {
            const aura = new THREE.PointLight(this.col2.getHex(), 3, 5);
            aura.position.set(0, 1.4, 1.5);
            this.root.add(aura);
        }
    }

    // ------------------------------------------------------------------ Animation

    play(kind, o = {}) { this.anim = { kind, t: 0, dur: { attack: 0.42, cast: 0.6, hurt: 0.32, die: 0.9, intro: 0.7 }[kind] || 0.4, ...o }; }
    attack() { this.play('attack'); }
    cast(color) { this.play('cast', { color }); }
    hurt() { this.flashT = 0.22; if (!this.anim || this.anim.kind !== 'die') this.play('hurt'); }
    die() { this.play('die'); this.dead = true; }
    intro() { this.play('intro'); }

    update(dt) {
        this.t += dt;
        const t = this.t, P = this.pivot;
        // idle
        const fy = this.floatY || 0;
        P.position.set(0, fy + Math.sin(t * 2.2) * (fy ? 0.12 : 0.04), 0);
        P.rotation.set(0, Math.sin(t * 0.7) * 0.15, 0);
        const br = 1 + Math.sin(t * 2.2) * 0.025;
        P.scale.set(1 / br, br, 1 / br);
        for (const f of this.flappers) f.g.rotation.y = Math.sin(t * f.speed) * 0.6 - 0.2;
        for (const s of this.swayers) {
            if (s.arm) s.g.rotation.x = Math.sin(t * 2 + s.ph) * 0.25;
            else if (s.claw) s.g.rotation.z = Math.sin(t * 3 + s.ph) * 0.15;
            else if (s.flame) { s.g.scale.y = 1 + Math.sin(t * 9 + s.ph) * 0.15; s.g.rotation.z = Math.sin(t * 5 + s.ph) * 0.1; }
            else if (s.serp) s.g.position.x = s.base + Math.sin(t * 2 + s.ph) * 0.12;
            else if (s.gear) s.g.rotation.z += dt * 2;
            else s.g.rotation.y = Math.sin(t * 3 + s.ph) * 0.35;
        }
        if (this.jaw) this.jaw.rotation.x = -0.25 - Math.max(0, Math.sin(t * 3)) * 0.35;
        // blink
        this.blinkT -= dt;
        let eyeY = 1;
        if (this.blinkT < 0) { eyeY = Math.max(0.1, Math.abs(this.blinkT * 10 + 1) % 2 - 0); if (this.blinkT < -0.15) this.blinkT = 1.5 + Math.random() * 3; }
        for (const e of this.eyes) e.scale.y = this.blinkT < 0 ? 0.15 : eyeY;
        // flash
        if (this.flashT > 0) {
            this.flashT -= dt;
            const k = Math.max(0, this.flashT / 0.22);
            for (const m of this.mats) m.emissive.setRGB(k, k * 0.9, k * 0.9);
        } else if (this._castGlow > 0) {
            this._castGlow -= dt;
        }
        // one-shots
        const a = this.anim;
        let s = this.baseScale;
        if (a) {
            a.t += dt;
            const k = Math.min(1, a.t / a.dur);
            if (a.kind === 'attack') {
                const lunge = Math.sin(k * Math.PI);
                P.position.z += lunge * 0.9;
                P.position.y -= lunge * 0.15;
                P.rotation.x = lunge * 0.3;
            } else if (a.kind === 'cast') {
                const up = Math.sin(k * Math.PI);
                P.position.y += up * 0.35;
                P.rotation.y += k * Math.PI * 2;
                for (const m of this.mats) if (a.color) m.emissive.copy(new THREE.Color(a.color)).multiplyScalar(up * 0.5);
            } else if (a.kind === 'hurt') {
                P.position.x += Math.sin(k * Math.PI * 6) * 0.15 * (1 - k);
                P.rotation.z = Math.sin(k * Math.PI * 4) * 0.1 * (1 - k);
            } else if (a.kind === 'die') {
                s *= Math.max(0.001, 1 - k * k);
                P.rotation.z = k * 1.2;
                P.position.y -= k * 0.4;
            } else if (a.kind === 'intro') {
                const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
                s *= Math.max(0.01, e);
            }
            if (k >= 1 && a.kind !== 'die') { this.anim = null; for (const m of this.mats) m.emissive.setRGB(0, 0, 0); }
        }
        this.root.scale.setScalar(s);
        if (this.shadow) this.shadow.material.opacity = 0.25 / (1 + P.position.y);
    }

    dispose() {
        this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        for (const m of this.mats) m.dispose();
    }
}
