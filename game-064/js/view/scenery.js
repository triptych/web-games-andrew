// scenery.js — everything around the board: the wooden dock frame with its
// painted coordinates, pilings, ropes, lanterns and cargo; palm islands, a
// great lighthouse on the horizon, toon clouds, circling gulls and passing ships.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, TEX, NO_OUTLINE } from './toon.js';
import { place, rod, createPiece } from './ships.js';
import { addIsland, finalizeIslands } from './stage.js';
import { ROOK, QUEEN, KNIGHT, BISHOP } from '../sim/chess.js';

const R = (() => { let s = 1234567; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

function mergeTo(group, geos, mat) {
    const list = geos.map((g) => {
        let x = g.index ? g.toNonIndexed() : g;
        for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n);
        return x;
    });
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    group.add(m);
    return m;
}

export class Scenery {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.gulls = [];
        this.sailers = [];
        this.lanterns = [];
        this.buildDock();
        this.buildIslands();
        this.buildClouds();
        this.buildGulls();
        this.buildSailers();
        finalizeIslands();
    }

    buildDock() {
        const g = this.group;
        const W = 0.78, top = 0.1, inner = 4.0, outer = inner + W;
        const planks = [];
        // Four plank borders; UVs repeat along the length.
        const sides = [
            { x: 0, z: inner + W / 2, w: outer * 2, d: W },
            { x: 0, z: -(inner + W / 2), w: outer * 2, d: W },
            { x: inner + W / 2, z: 0, w: W, d: inner * 2, rot: true },
            { x: -(inner + W / 2), z: 0, w: W, d: inner * 2, rot: true },
        ];
        for (const s of sides) {
            const b = new THREE.BoxGeometry(s.rot ? s.d : s.w, 0.24, s.rot ? s.w : s.d);
            const uv = b.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (s.rot ? s.d : s.w) / 2.2);
            place(b, { x: s.x, y: top - 0.12, z: s.z, ry: s.rot ? Math.PI / 2 : 0 });
            planks.push(b);
        }
        const tex = TEX.dockPlanks();
        mergeTo(g, planks, toon(0xffffff, { map: tex }));
        // Inner lip (a darker beam where planks meet the water)
        const lips = [];
        for (const [x, z, w, d] of [[0, inner + 0.03, inner * 2 + 0.12, 0.06], [0, -inner - 0.03, inner * 2 + 0.12, 0.06], [inner + 0.03, 0, 0.06, inner * 2], [-inner - 0.03, 0, 0.06, inner * 2]]) {
            lips.push(place(new THREE.BoxGeometry(w, 0.3, d), { x, y: top - 0.1, z }));
        }
        mergeTo(g, lips, toon(0x7a4d2b));

        // Pilings with rope wraps and caps
        const posts = [], caps = [], wraps = [];
        const postAt = [];
        for (const c of [-1, 1]) for (const d of [-1, 1]) postAt.push([c * (outer - 0.06), d * (outer - 0.06)]);
        for (const k of [-2, 0, 2]) {
            postAt.push([k, outer - 0.06], [k, -(outer - 0.06)], [outer - 0.06, k], [-(outer - 0.06), k]);
        }
        for (const [x, z] of postAt) {
            const h = 0.55 + R() * 0.15;
            posts.push(place(new THREE.CylinderGeometry(0.11, 0.12, h + 1.2, 12), { x, z, y: (h - 1.2) / 2 + top }));
            caps.push(place(new THREE.CylinderGeometry(0.125, 0.11, 0.05, 12), { x, z, y: top + h + 0.0 }));
            wraps.push(place(new THREE.TorusGeometry(0.12, 0.022, 6, 16), { x, z, y: top + h * 0.55, rx: Math.PI / 2 }));
            wraps.push(place(new THREE.TorusGeometry(0.12, 0.022, 6, 16), { x, z, y: top + h * 0.55 + 0.05, rx: Math.PI / 2 }));
        }
        mergeTo(g, posts, toon(0x8b5a33));
        mergeTo(g, caps, toon(0x6c4426));
        mergeTo(g, wraps, toon(0xd9b77a));

        // Ropes sagging between the pilings along each side
        const ropes = [];
        const sidesPosts = [
            postAt.filter(([, z]) => z > outer - 0.1).sort((a, b) => a[0] - b[0]),
            postAt.filter(([, z]) => z < -(outer - 0.1)).sort((a, b) => a[0] - b[0]),
            postAt.filter(([x]) => x > outer - 0.1).sort((a, b) => a[1] - b[1]),
            postAt.filter(([x]) => x < -(outer - 0.1)).sort((a, b) => a[1] - b[1]),
        ];
        for (const list of sidesPosts) {
            for (let i = 0; i + 1 < list.length; i++) {
                const a = new THREE.Vector3(list[i][0], top + 0.45, list[i][1]);
                const b = new THREE.Vector3(list[i + 1][0], top + 0.45, list[i + 1][1]);
                const pts = [];
                for (let k = 0; k <= 12; k++) {
                    const t = k / 12;
                    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(Math.PI * t) * 0.16, 0)));
                }
                ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 5));
            }
        }
        mergeTo(g, ropes, toon(0xc9a265, { outline: { thickness: 0.002, color: [0.25, 0.18, 0.1] } }));

        // Coordinates painted on brass plaques: files along the near and far edges, ranks down the sides.
        const files = 'abcdefgh';
        for (let i = 0; i < 8; i++) {
            for (const zSide of [1, -1]) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36).rotateX(-Math.PI / 2), this.labelMat(files[i]));
                m.position.set(i - 3.5, top + 0.005, zSide * (inner + 0.36));
                if (zSide < 0) m.rotation.y = Math.PI;
                g.add(m);
            }
            for (const xSide of [1, -1]) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36).rotateX(-Math.PI / 2), this.labelMat(String(i + 1)));
                m.position.set(xSide * (inner + 0.36), top + 0.005, 3.5 - i);
                g.add(m);
            }
        }

        // Corner lanterns on posts
        for (const [x, z] of postAt.slice(0, 4)) {
            const lamp = new THREE.Group();
            lamp.position.set(x, top + 0.75, z);
            lamp.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), toon(0xffe9a8, { emissive: 0xffc850, emissiveIntensity: 0.8 })));
            lamp.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 4), toon(0x2a2228)), {}));
            lamp.children[1].position.y = 0.15; lamp.children[1].rotation.y = Math.PI / 4;
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.18), toon(0x2a2228));
            base.position.y = -0.11;
            lamp.add(base);
            g.add(lamp);
            this.lanterns.push(lamp);
        }

        // Cargo: barrels, crates, a coil of rope, an anchor
        const barrelProf = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10; barrelProf.push(new THREE.Vector2(0.13 + Math.sin(t * Math.PI) * 0.035, t * 0.34)); }
        const barrels = [], hoops = [], crates = [];
        const cargoSpots = [[-4.4, 4.4], [4.42, -4.38], [-4.45, -4.2], [4.2, 4.5]];
        cargoSpots.forEach(([x, z], i) => {
            const n = 1 + (i % 2);
            for (let k = 0; k < n; k++) {
                const ox = x + (k ? (x > 0 ? -0.32 : 0.32) : 0), oz = z + (k ? 0.05 : 0);
                barrels.push(place(new THREE.LatheGeometry(barrelProf, 14), { x: ox, z: oz, y: top }));
                for (const hy of [0.06, 0.28]) hoops.push(place(new THREE.TorusGeometry(0.152, 0.012, 5, 16), { x: ox, z: oz, y: top + hy, rx: Math.PI / 2 }));
            }
        });
        crates.push(place(new THREE.BoxGeometry(0.34, 0.34, 0.34), { x: 4.4, z: 4.05, y: top + 0.17, ry: 0.3 }));
        crates.push(place(new THREE.BoxGeometry(0.3, 0.3, 0.3), { x: -4.38, z: -4.55, y: top + 0.15, ry: -0.2 }));
        mergeTo(g, barrels, toon(0xb4743f));
        mergeTo(g, hoops, toon(0x3b3438));
        mergeTo(g, crates, toon(0xffffff, { map: TEX.crate() }));
        // rope coil
        const coil = [];
        for (let i = 0; i < 4; i++) coil.push(place(new THREE.TorusGeometry(0.18 - i * 0.035, 0.022, 6, 20), { x: -4.4, z: 3.9, y: top + 0.02 + i * 0.012, rx: Math.PI / 2 }));
        mergeTo(g, coil, toon(0xd9b77a));
        // anchor leaning on the dock
        const anchor = [];
        anchor.push(place(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), { y: 0.3 }));
        anchor.push(place(new THREE.TorusGeometry(0.06, 0.018, 6, 14), { y: 0.64 }));
        anchor.push(place(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), { y: 0.48, rz: Math.PI / 2 }));
        anchor.push(place(new THREE.TorusGeometry(0.22, 0.025, 6, 18, Math.PI), { y: 0.2, rz: Math.PI }));
        const am = mergeTo(g, anchor, toon(0x4b4f58));
        am.position.set(4.95, top - 0.2, 0.9);
        am.rotation.set(0, 0, 0.35);
    }

    labelMat(text) {
        const m = new THREE.MeshBasicMaterial({ map: TEX.label(text), transparent: true, depthWrite: false });
        m.userData.outlineParameters = NO_OUTLINE;
        return m;
    }

    palm(group, x, y, z, h, lean) {
        const pts = [];
        for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            pts.push(new THREE.Vector3(x + Math.sin(lean) * t * t * h * 0.35, y + t * h, z + Math.cos(lean) * t * t * h * 0.35));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        group.push({ g: new THREE.TubeGeometry(curve, 10, 0.09 * h / 2, 7), m: 'trunk' });
        const top = pts[6];
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + R() * 0.3;
            const leaf = new THREE.PlaneGeometry(1.3 * h / 2, 0.36 * h / 2, 8, 1);
            const p = leaf.attributes.position;
            for (let k = 0; k < p.count; k++) {
                const lx = p.getX(k) / (1.3 * h / 2) + 0.5;
                p.setY(k, p.getY(k) * (1 - lx * 0.8));
                p.setZ(k, -lx * lx * 0.45 * h / 2);
            }
            leaf.translate(0.65 * h / 2, 0, 0);
            leaf.rotateX(-Math.PI / 2 + 0.25);
            leaf.rotateY(a);
            leaf.translate(top.x, top.y, top.z);
            leaf.computeVertexNormals();
            group.push({ g: leaf, m: 'leaf' });
        }
        group.push({ g: place(new THREE.SphereGeometry(0.11 * h / 2, 8, 6), { x: top.x + 0.08, y: top.y - 0.08, z: top.z }), m: 'nut' });
    }

    buildIslands() {
        const spots = [
            { x: -15, z: -13, r: 3.4, palms: 3, hut: true },
            { x: 17, z: -19, r: 4.2, palms: 4, lighthouse: true },
            { x: 19, z: 7, r: 2.4, palms: 2 },
            { x: -21, z: 9, r: 3.0, palms: 3 },
            { x: -6, z: -32, r: 5.0, palms: 5 },
            { x: 34, z: -6, r: 3.2, palms: 2 },
        ];
        const parts = [];
        for (const s of spots) {
            addIsland(s.x, s.z, s.r);
            const sand = new THREE.SphereGeometry(s.r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            place(sand, { x: s.x, z: s.z, y: -0.5, sy: 0.32 });
            parts.push({ g: sand, m: 'sand' });
            const grass = new THREE.SphereGeometry(s.r * 0.62, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
            place(grass, { x: s.x + 0.3, z: s.z - 0.2, y: -0.05, sy: 0.55 });
            parts.push({ g: grass, m: 'grass' });
            for (let i = 0; i < s.palms; i++) {
                const a = R() * Math.PI * 2, d = R() * s.r * 0.45;
                this.palm(parts, s.x + Math.cos(a) * d, 0.35, s.z + Math.sin(a) * d, 2.2 + R() * 1.2, a + 1);
            }
            for (let i = 0; i < 3; i++) {
                const a = R() * Math.PI * 2;
                const rock = new THREE.DodecahedronGeometry(0.4 + R() * 0.5, 0);
                place(rock, { x: s.x + Math.cos(a) * s.r * 0.95, z: s.z + Math.sin(a) * s.r * 0.95, y: 0, ry: R() * 3 });
                parts.push({ g: rock, m: 'rock' });
            }
            if (s.hut) {
                parts.push({ g: place(new THREE.CylinderGeometry(0.6, 0.6, 0.7, 10), { x: s.x - 0.8, y: 0.8, z: s.z + 0.6 }), m: 'hut' });
                parts.push({ g: place(new THREE.ConeGeometry(0.95, 0.75, 10), { x: s.x - 0.8, y: 1.5, z: s.z + 0.6 }), m: 'thatch' });
            }
            if (s.lighthouse) {
                const lh = createPiece(ROOK);
                lh.root.position.set(s.x - 0.6, 0.3, s.z + 0.4);
                lh.root.scale.setScalar(5.2);
                this.group.add(lh.root);
                this.bigLight = lh;
            }
        }
        // Lone sea stacks with gulls' perches
        for (const [x, z, h] of [[9, -11, 1.4], [-10, 15, 1.0], [12, 16, 1.8], [-27, -4, 2.1]]) {
            const st = new THREE.CylinderGeometry(0.35, 0.9, h * 2, 7);
            place(st, { x, z, y: h - 0.6 });
            parts.push({ g: st, m: 'rock' });
            addIsland(x, z, 0.7);
        }
        const mats = {
            sand: toon(0xffffff, { map: TEX.sand() }),
            grass: toon(0x6fcf6a),
            trunk: toon(0xa77a4c),
            leaf: toon(0x3fae5a, { side: THREE.DoubleSide }),
            nut: toon(0x6b4a2b),
            rock: toon(0xffffff, { map: TEX.rock() }),
            hut: toon(0xd9a066),
            thatch: toon(0xe8c56a),
        };
        const by = {};
        for (const p of parts) (by[p.m] ||= []).push(p.g);
        for (const k of Object.keys(by)) mergeTo(this.group, by[k], mats[k]);
    }

    buildClouds() {
        const geos = [];
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + R() * 0.3;
            const d = 70 + R() * 70;
            const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 14 + R() * 18;
            const n = 4 + Math.floor(R() * 4);
            for (let k = 0; k < n; k++) {
                const r = 3 + R() * 4;
                geos.push(place(new THREE.IcosahedronGeometry(r, 2), { x: cx + (k - n / 2) * r * 0.9, y: cy + R() * 2, z: cz + (R() - 0.5) * 4, sy: 0.65 }));
            }
        }
        this.clouds = mergeTo(this.group, geos, toon(0xffffff, { soft: true, outline: { thickness: 0.0025, color: [0.55, 0.65, 0.78] } }));
    }

    buildGulls() {
        const wing = new THREE.BufferGeometry();
        wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0, 0, -0.06, 0.45, 0.04, 0], 3));
        wing.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0.5], 2));
        wing.computeVertexNormals();
        const mat = toon(0xffffff, { side: THREE.DoubleSide, outline: { thickness: 0.003, color: [0.2, 0.2, 0.25] } });
        for (let i = 0; i < 7; i++) {
            const bird = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8).rotateX(Math.PI / 2), mat);
            const l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat);
            r.scale.x = -1;
            const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 5).rotateX(-Math.PI / 2), toon(0xffb43a));
            beak.position.z = -0.19;
            bird.add(body, l, r, beak);
            bird.userData = { l, r, rad: 6 + R() * 9, h: 3.5 + R() * 3, sp: (0.18 + R() * 0.15) * (R() < 0.5 ? -1 : 1), ph: R() * 6, cx: (R() - 0.5) * 8, cz: (R() - 0.5) * 8 };
            this.group.add(bird);
            this.gulls.push(bird);
        }
    }

    buildSailers() {
        const kinds = [QUEEN, KNIGHT, BISHOP];
        for (let i = 0; i < 3; i++) {
            const p = createPiece(kinds[i] * (i % 2 ? -1 : 1));
            p.root.scale.setScalar(3.2);
            p.root.userData = { rad: 42 + i * 14, sp: 0.012 + i * 0.004, ph: i * 2.1 };
            this.group.add(p.root);
            this.sailers.push(p);
        }
    }

    update(dt, t, camera) {
        for (const b of this.gulls) {
            const u = b.userData;
            const a = t * u.sp + u.ph;
            b.position.set(u.cx + Math.cos(a) * u.rad, u.h + Math.sin(t * 0.7 + u.ph) * 0.4, u.cz + Math.sin(a) * u.rad);
            b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
            b.rotation.z = Math.sign(u.sp) * 0.25;
            const flap = Math.sin(t * 7 + u.ph) * 0.5;
            u.l.rotation.z = flap; u.r.rotation.z = -flap;
            // A gull right in front of the lens is a white blob: hide it while it passes.
            if (camera) b.visible = b.position.distanceTo(camera.position) > 4.5;
        }
        for (const s of this.sailers) {
            const u = s.root.userData;
            const a = t * u.sp + u.ph;
            s.root.position.set(Math.cos(a) * u.rad, 0, Math.sin(a) * u.rad);
            s.root.rotation.y = -a + Math.PI;
            s.body.rotation.z = Math.sin(t * 0.8 + u.ph) * 0.05;
        }
        if (this.bigLight) this.bigLight.beam.rotation.y = t * 0.8;
        for (const l of this.lanterns) l.children[0].material.emissiveIntensity = 0.75 + Math.sin(t * 3.1 + l.position.x) * 0.15;
    }
}
