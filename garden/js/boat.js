// The little rowboat moored beside the dock: the one we arrived in. Climb back
// in and it sprouts wings, lifts off and drifts once around the island in a slow
// pan, then settles back at the dock and lets you step out again.

import * as THREE from 'three';
import { smoothstep, lerp, angleDiff, TAU } from './util.js';
import { EYE } from './controls.js';

// the cut scene: the camera steps out to watch the boat transform (SHOW seconds, the change itself taking MORPH), then drops back into the seat
const SHOW = 8, SHOW_IN = 1.2, MORPH = 3.6, BOARD = 1.8, FLIGHT = 168, UNMORPH = 2.6, LEAVE = 1.6;
const LIFT = 1.4;       // how far it rises on its own before it takes off
const CRUISE = 26;      // height of the circuit above the sea
const SEAT = new THREE.Vector3(0, 0.95, 0.5);

const wrap = (a) => ((a % TAU) + TAU) % TAU;
const mixAngle = (a, b, k) => a + angleDiff(a, b) * k;

/** Pinch the ends of a hull shape into a bow and stern that sweep upward. */
function shape(x, y, z) {
    const zn = Math.abs(z) / 2;
    const w = 1 - 0.6 * smoothstep(0.25, 1, zn);
    return [x * w, y + 0.28 * zn ** 3, z];
}

function hullGeometry() {
    const g = new THREE.SphereGeometry(1, 24, 10, 0, TAU, Math.PI / 2, Math.PI / 2);
    g.scale(0.8, 0.55, 2.0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const [x, y, z] = shape(p.getX(i), p.getY(i), p.getZ(i));
        p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

function gunwale(mat) {
    const pts = [];
    for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU;
        const [x, y, z] = shape(Math.cos(a) * 0.8, 0, Math.sin(a) * 2.0);
        pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 6, true), mat);
}

function oar(mat) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.4, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0), mat);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.2).translate(1.95, 0, 0), mat);
    g.add(shaft, blade);
    return g;
}

/** One wing, spreading along +x: a fan of tapering feathers on a leading spar. */
function wing(mat, sparMat) {
    const g = new THREE.Group();
    const n = 8;
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const len = lerp(4.4, 2.2, t) * (1 - 0.08 * Math.sin(t * 3));
        const w = lerp(0.34, 0.26, t);
        const f = new THREE.Mesh(new THREE.BoxGeometry(len, 0.015, w).translate(len / 2, 0, 0), mat);
        f.rotation.y = 0.3 + t * 0.8; // swept back like a fan
        f.rotation.z = 0.07 - t * 0.05;
        f.position.set(0.05, 0.005 * i, 0.04 + t * 0.06);
        g.add(f);
        // the spar is the leading feather's own edge, so it can't stick out at its own angle
        if (i === 0) {
            const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, len * 0.96, 6).rotateZ(-Math.PI / 2).translate(len * 0.48, 0.02, -w / 2), sparMat);
            f.add(spar);
        }
    }
    return g;
}

// The same Gerstner swells the water shader draws (see water.js), so the hull can ride them.
const SWELLS = [[1.0, 0.35, 24.0, 0.17, 0.6], [0.55, 0.85, 13.0, 0.09, 0.6], [-0.45, 0.9, 7.5, 0.05, 0.5], [0.9, -0.45, 4.1, 0.025, 0.4]].map(([dx, dz, L, A, Q]) => {
    const l = Math.hypot(dx, dz), k = TAU / L;
    return { dx: dx / l, dz: dz / l, k, c: Math.sqrt(9.8 / k), A, Q };
});

/** Height of the sea surface at (x, z); amp is the shader's shallow-water damping. */
export function swellAt(x, z, t, amp) {
    // the shader pushes points sideways as well as up: undo that once to find the surface above (x, z)
    let ox = 0, oz = 0;
    for (const w of SWELLS) {
        const co = Math.cos(w.k * (w.dx * x + w.dz * z - w.c * t));
        ox += w.Q * w.A * amp * w.dx * co;
        oz += w.Q * w.A * amp * w.dz * co;
    }
    const px = x - ox, pz = z - oz;
    let y = 0;
    for (const w of SWELLS) y += w.A * amp * Math.sin(w.k * (w.dx * px + w.dz * pz - w.c * t));
    return y;
}

export class Boat {
    constructor(world, scene, camera, controls) {
        this.world = world;
        this.camera = camera;
        this.controls = controls;
        const { dock, islandR } = world.layout;
        this.home = { x: 2.9, z: dock.end - 5.2 };
        this.stand = { x: 0.9, z: this.home.z };
        this.bollard = { x: 1.5, y: dock.y + 0.3, z: dock.end - 1.2 };
        this.radius = islandR + 22;
        this.phase = 'idle';
        this.t = 0;          // time in the current phase
        this.u = 0;          // flight progress 0..1
        this.rush = 1;       // flight speed-up when the rider asks to land
        this.k = 0;          // transformation 0 (rowboat) .. 1 (flying boat)
        this.flap = 0;
        this._bob = this._bobP = this._bobR = 0;
        this.onDone = null;
        this.onPhase = null;
        this.from = null;    // camera pose at the start of a blend
        this.pose = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0 };

        const m = world.mats;
        const hullMat = m.wood.clone();
        hullMat.side = THREE.DoubleSide;
        hullMat.color.set(0xb98a62);
        const paint = new THREE.MeshStandardMaterial({ color: 0x3f7f86, roughness: 0.6 });
        const feather = new THREE.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.55, emissive: 0x7fffe0, emissiveIntensity: 0 });
        this.featherMat = feather;
        this.haloMat = new THREE.MeshBasicMaterial({ color: 0x8ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd890 });

        const g = (this.group = new THREE.Group());
        g.name = 'rowboat';
        const add = (mesh) => {
            mesh.castShadow = mesh.receiveShadow = true;
            g.add(mesh);
            return mesh;
        };
        const hull = add(new THREE.Mesh(hullGeometry(), hullMat));
        hull.position.y = 0.35;
        const rim = add(gunwale(paint));
        rim.position.y = 0.35;
        const floor = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 1.8), m.darkWood));
        floor.position.y = 0.02;
        for (const z of [-0.85, 0.15, 0.95]) {
            const seat = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.3), m.wood));
            seat.position.set(0, 0.24, z);
        }
        // oars rest in their locks, blades trailing in the water
        for (const s of [-1, 1]) {
            const o = oar(m.wood);
            o.position.set(s * 0.74, 0.5, 0.15);
            o.scale.x = s;
            o.rotation.set(0, 0.5, -0.2);
            g.add(o);
            o.children.forEach((c) => (c.castShadow = true));
            const lock = add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 5, 8), m.iron));
            lock.position.set(s * 0.76, 0.42, 0.15);
        }
        // a bow lantern
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampMat);
        const bowPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), m.iron);
        bowPost.position.set(0, 0.85, 1.72);
        lantern.position.set(0, 1.14, 1.72);
        g.add(bowPost, lantern);

        // wings stay folded away until the transformation
        this.wings = [-1, 1].map((s) => {
            const pivot = new THREE.Group();
            pivot.position.set(s * 0.72, 0.5, -0.5);
            pivot.scale.x = s;
            const w = wing(feather, m.brass);
            w.traverse((o) => (o.castShadow = true));
            pivot.add(w);
            pivot.visible = false;
            g.add(pivot);
            return { pivot, w };
        });
        // a ring of light the boat floats on once it leaves the water
        const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.5, 40).rotateX(-Math.PI / 2).scale(1, 1, 2.1), this.haloMat);
        halo.position.y = -0.35;
        halo.renderOrder = 3;
        g.add(halo);
        this.halo = halo;

        // mooring line from the bow to the dock bollard
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 5), new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 1 }));
        scene.add(rope);
        this.rope = rope;

        scene.add(g);
        this.group.position.set(this.home.x, 0, this.home.z);
        this._pose(0);
        this._place(0, 0, 0, 0, 0);
        this._rope();
    }

    get busy() {
        return this.phase !== 'idle';
    }

    get flying() {
        return this.phase === 'flight';
    }

    /** Climb in (the caller must already be standing on the dock). */
    board() {
        if (this.busy) return;
        const c = this.controls;
        c.enabled = false;
        c.route = null;
        c.vel.set(0, 0);
        c.keys.clear();
        this.from = { pos: this.camera.position.clone(), yaw: c.yaw, pitch: c.pitch };
        this._sparked = false;
        this._go('show');
    }

    /** Ask for an early landing: the circuit speeds up until the dock is reached. */
    skip() {
        if (this.phase === 'flight') this.skipping = true;
    }

    _go(phase) {
        this.phase = phase;
        this.t = 0;
        this.onPhase?.(phase);
    }

    // ------------------------------------------------------------- flight path

    /** Where the boat is at flight progress u: out to the circuit, once round, home again. */
    _path(u, out) {
        const h = this.home;
        const r0 = Math.hypot(h.x, h.z), a0 = Math.atan2(h.x, h.z);
        const a = smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u));
        const r = lerp(r0, this.radius, a);
        const th = a0 + TAU * smoothstep(0.04, 0.96, u);
        out.set(Math.sin(th) * r, LIFT + CRUISE * a, Math.cos(th) * r);
        return out;
    }

    _pose(dt) {
        const g = this.group;
        const pose = this.pose;
        const p = this._p ??= new THREE.Vector3();
        if (this.phase === 'flight') {
            const e = 0.004;
            const a = this._path(Math.max(0, this.u - e), new THREE.Vector3()), b = this._path(Math.min(1, this.u + e), new THREE.Vector3());
            const u = this.u;
            const w = smoothstep(0.02, 0.1, u) * (1 - smoothstep(0.9, 0.98, u));
            const tan = Math.atan2(b.x - a.x, b.z - a.z);
            const yaw = mixAngle(0, tan, w);
            // lean into the turn
            const c = this._path(Math.max(0, u - 0.03), new THREE.Vector3()), d = this._path(Math.min(1, u + 0.03), new THREE.Vector3());
            const bend = angleDiff(Math.atan2(b.x - c.x, b.z - c.z), Math.atan2(d.x - b.x, d.z - b.z));
            this._place(this._path(u, p).x, p.y, p.z, yaw, THREE.MathUtils.clamp(-bend * 6, -0.2, 0.2) * w, 0.04 * w * Math.sin(this.t * 0.7));
        } else {
            const lift = LIFT * smoothstep(0.45, 1, this.k);
            this._place(this.home.x, lift, this.home.z, 0, 0);
        }
        g.updateMatrixWorld(true);
        pose.pos.copy(SEAT);
        g.localToWorld(pose.pos);
        pose.roll = g.rotation.z * 0.5;
    }

    _place(x, y, z, yaw, roll, pitch = 0) {
        const g = this.group;
        const bob = this._bob;
        g.position.set(x, y + bob, z);
        g.rotation.set(pitch + this._bobP, yaw, roll + this._bobR, 'YXZ');
    }

    _rope() {
        const g = this.group;
        const rope = this.rope;
        const bow = new THREE.Vector3(0, 0.55, 1.7);
        g.localToWorld(bow);
        const to = new THREE.Vector3(this.bollard.x, this.bollard.y, this.bollard.z);
        const mid = bow.clone().add(to).multiplyScalar(0.5);
        rope.position.copy(mid);
        rope.scale.y = bow.distanceTo(to);
        rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(bow).normalize());
        rope.visible = this.k < 0.02;
    }

    // ----------------------------------------------------------------- update

    /** Idle bobbing, the wing flap and the transformation; drives the camera while aboard. */
    update(dt, t) {
        this._float(dt, t);
        const fly = this.phase === 'flight' ? 1 : 0;
        this.flap = lerp(this.flap, fly, 1 - Math.exp(-dt * 1.2));
        this._advance(dt);
        this._transform(t);
        this._pose(dt);
        this._rope();
        if (this.busy) this._camera(dt);
    }

    /** Ride the swell: sit on the water at the hull's four corners, and bob gently once airborne. */
    _float(dt, t) {
        const { x, z } = this.home;
        const d = this.world.island.heightAt(x, z);
        const s0 = smoothstep(0, 0.3, THREE.MathUtils.clamp(-d / 12, 0, 1));
        const amp = lerp(0.25, 1, s0);
        const at = (lx, lz) => swellAt(x + lx, z + lz, t, amp);
        const bow = at(0, 1.7), stern = at(0, -1.7), port = at(-0.75, 0), star = at(0.75, 0);
        const rest = 0.1; // the hull floats a little proud of the surface so the swell never washes over the gunwale
        const air = smoothstep(0.3, 1, this.k);
        const wantY = lerp((bow + stern + port + star) / 4 + rest, Math.sin(t * 1.3) * 0.05, air);
        const wantP = lerp(-Math.atan2(bow - stern, 3.4), Math.sin(t * 1.1 + 1) * 0.02, air);
        const wantR = lerp(Math.atan2(star - port, 1.5), Math.sin(t * 0.9) * 0.03, air);
        const f = 1 - Math.exp(-dt * 8);
        this._bob = lerp(this._bob, wantY, f);
        this._bobP = lerp(this._bobP, wantP, f);
        this._bobR = lerp(this._bobR, wantR, f);
    }

    _advance(dt) {
        this.t += dt;
        const ph = this.phase;
        if (ph === 'show') {
            const m = (this.t - SHOW_IN) / MORPH;
            this.k = smoothstep(0, 1, m);
            if (m > 0 && !this._sparked) {
                this._sparked = true;
                this.onPhase?.('transform');
            }
            if (this.t >= SHOW) {
                // the camera drops from where the cut scene left it into the seat
                const r = this.camera.rotation;
                this.from = { pos: this.camera.position.clone(), yaw: r.y, pitch: r.x };
                this._go('board');
            }
        } else if (ph === 'board') {
            if (this.t >= BOARD) {
                this.u = 0;
                this.rush = 1;
                this.skipping = false;
                this._go('flight');
            }
        } else if (ph === 'flight') {
            this.rush = lerp(this.rush, this.skipping ? 6 : 1, 1 - Math.exp(-dt * 1.5));
            this.u = Math.min(1, this.u + (dt * this.rush) / FLIGHT);
            if (this.u >= 1) this._go('unmorph');
        } else if (ph === 'unmorph') {
            this.k = 1 - smoothstep(0, 1, this.t / UNMORPH);
            if (this.t >= UNMORPH) {
                this.k = 0;
                this._go('leave');
            }
        } else if (ph === 'leave' && this.t >= LEAVE) {
            const c = this.controls;
            c.teleport(this.stand.x, this.stand.z, 0);
            c.vel.set(0, 0);
            this.phase = 'idle';
            c.enabled = true;
            this.onDone?.();
        }
    }

    _transform(t) {
        const k = this.k;
        const open = smoothstep(0.1, 0.75, k);
        const beat = Math.sin(t * 1.7) * 0.16 * this.flap;
        for (const { pivot, w } of this.wings) {
            pivot.visible = open > 0.01;
            pivot.scale.y = pivot.scale.z = lerp(0.2, 1, open);
            pivot.scale.x = Math.sign(pivot.scale.x || 1) * lerp(0.2, 1, open);
            // from hanging against the hull out to a gentle upward sweep
            pivot.rotation.z = lerp(-1.5, 0.22, open) + beat;
            w.rotation.y = lerp(0.5, 0, open);
        }
        this.featherMat.emissiveIntensity = k * 0.35;
        this.haloMat.opacity = k * 0.5 * (0.8 + 0.2 * Math.sin(t * 3));
        this.halo.scale.setScalar(1 + 0.04 * Math.sin(t * 3));
    }

    /** Camera from the rider's seat: blends in on boarding, looks inward on the circuit, blends out. */
    _camera(dt) {
        const cam = this.camera;
        const seat = this.pose.pos;
        const g = this.group;
        const bowYaw = g.rotation.y + Math.PI;
        let yaw = bowYaw, pitch = -0.1;
        if (this.phase === 'flight' || this.phase === 'unmorph') {
            // turn to face the island across the water, then back to the bow for landing
            const u = this.phase === 'flight' ? this.u : 1;
            const c = smoothstep(0.05, 0.2, u) * (1 - smoothstep(0.85, 0.97, u));
            const dx = -seat.x, dz = -seat.z;
            const toCentre = Math.atan2(-dx, -dz);
            yaw = mixAngle(bowYaw, toCentre, c);
            const dist = Math.hypot(dx, dz);
            pitch = lerp(-0.1, Math.atan2(5 - seat.y, dist), c);
        }
        let k = 1, from = null, toPos = seat, toYaw = yaw, toPitch = pitch;
        if (this.phase === 'show') {
            // a slow orbit round the boat from the sea side, easing out of the player's own view
            const e = smoothstep(0, 1, this.t / SHOW);
            const a = 0.25 + 1.25 * e; // from the open-water side swinging round to the bow, so the dock isn't in the way
            const hover = LIFT * smoothstep(0.45, 1, this.k);
            const look = new THREE.Vector3(this.home.x, 0.9 + hover, this.home.z);
            const pos = new THREE.Vector3(look.x + Math.cos(a) * 7.5, 3.6 + 1.4 * e + hover * 0.5, look.z + Math.sin(a) * 7.5);
            const dx = look.x - pos.x, dy = look.y - pos.y, dz = look.z - pos.z;
            const sYaw = Math.atan2(-dx, -dz), sPitch = Math.atan2(dy, Math.hypot(dx, dz));
            const kIn = smoothstep(0, 1, this.t / SHOW_IN);
            cam.position.lerpVectors(this.from.pos, pos, kIn);
            cam.rotation.set(lerp(this.from.pitch, sPitch, kIn), mixAngle(this.from.yaw, sYaw, kIn), 0, 'YXZ');
            return;
        }
        if (this.phase === 'board') {
            from = this.from;
            k = smoothstep(0, 1, this.t / BOARD);
        } else if (this.phase === 'leave') {
            from = this.from;
            k = smoothstep(0, 1, this.t / LEAVE);
            const s = this.stand;
            toPos = new THREE.Vector3(s.x, this.world.walkHeight(s.x, s.z) + EYE, s.z);
            toYaw = 0;
            toPitch = -0.05;
            from = { pos: seat.clone(), yaw, pitch }; // the boat is at rest, so the seat is a fixed start
        }
        if (from) {
            cam.position.lerpVectors(from.pos, toPos, k);
            cam.rotation.set(lerp(from.pitch, toPitch, k), mixAngle(from.yaw, toYaw, k), 0, 'YXZ');
            if (this.phase === 'board') {
                // the seat pose is moving with the boat, so blend toward the live one
                cam.position.lerpVectors(from.pos, seat, k);
                cam.rotation.set(lerp(from.pitch, pitch, k), mixAngle(from.yaw, yaw, k), 0, 'YXZ');
            }
        } else {
            cam.position.copy(seat);
            cam.rotation.set(pitch, yaw, this.pose.roll, 'YXZ');
        }
    }
}
