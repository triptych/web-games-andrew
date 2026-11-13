// The eight vehicles. Each is a Meshy model with a code-built stand-in (shown until the model loads, and for good
// with ?models=0), plus the working parts that have to move and so are built in code: the load in the dump truck,
// the rocks in the loader's bucket, the crane's hook and the wrecking ball. Everything faces +Z.

import * as THREE from 'three';
import { VEHICLES, VEH, RADIUS, WORK } from '../config.js';
import { model } from './models.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const TYRE = mat(0x1c1c1f, { roughness: 0.9 }), STEEL = mat(0xb9bec6, { roughness: 0.35, metalness: 0.5 }), GLASS = mat(0x9fd4f0, { roughness: 0.2 });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; return b; };
const cyl = (r, len, m, x, y, z, axis = 'x') => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m);
    if (axis === 'x') c.rotation.z = Math.PI / 2; else if (axis === 'z') c.rotation.x = Math.PI / 2;
    c.position.set(x, y, z); c.castShadow = true;
    return c;
};

/** How far each Meshy model must be turned for its front to be +Z (checked on dev/gallery.html). */
export const YAW = { dump: Math.PI / 2, dozer: Math.PI / 2, digger: Math.PI / 2, roller: Math.PI / 2, crane: Math.PI / 2, wrecker: Math.PI / 2, loader: Math.PI / 2, mixer: Math.PI / 2 };

/** A blocky toy of each vehicle. */
function standIn(id) {
    const V = VEH[id], g = new THREE.Group(), body = mat(V.color), L = V.len, W = 2.2;
    const wheels = (zs, r = 0.55) => { for (const z of zs) for (const sx of [-1, 1]) g.add(cyl(r, 0.5, TYRE, sx * (W / 2), r, z)); };
    const tracks = () => { for (const sx of [-1, 1]) g.add(box(0.6, 0.8, L * 0.85, TYRE, sx * (W / 2), 0.4, 0)); };
    const cab = (z, h = 1.1) => { g.add(box(W * 0.8, h, 1.2, body, 0, 1.3 + h / 2, z)); g.add(box(W * 0.82, h * 0.5, 0.9, GLASS, 0, 1.45 + h / 2, z + 0.2)); };
    g.add(box(W, 0.6, L * 0.9, body, 0, 1.0, 0));
    if (id === 'dump') { wheels([L * 0.32, -L * 0.1, -L * 0.34]); cab(L * 0.3); g.add(box(W * 1.05, 1.1, L * 0.55, body, 0, 1.85, -L * 0.15)); }
    if (id === 'dozer') { tracks(); cab(-0.3); g.add(box(W * 1.7, 1.1, 0.25, STEEL, 0, 0.6, L / 2 + 0.2)); }
    if (id === 'digger') { tracks(); cab(-0.2); const arm = box(0.35, 0.35, 3, body, 0.5, 2.3, 1.5); arm.rotation.x = 0.5; g.add(arm); g.add(box(0.8, 0.6, 0.6, STEEL, 0.5, 0.9, 2.9)); }
    if (id === 'roller') { wheels([-L * 0.3], 0.75); cab(-0.4, 0.9); g.add(cyl(0.8, W * 1.1, STEEL, 0, 0.8, L * 0.32)); }
    if (id === 'crane') { wheels([L * 0.35, 0, -L * 0.35]); cab(L * 0.33); const boom = box(0.4, 0.4, 6, mat(0xf2b417), 0, 3.4, 0.6); boom.rotation.x = -0.75; g.add(boom); }
    if (id === 'wrecker') { tracks(); cab(-0.5); const boom = box(0.35, 0.35, 6.5, STEEL, 0, 3.8, 0.8); boom.rotation.x = -1.0; g.add(boom); }
    if (id === 'loader') { wheels([-L * 0.28], 0.85); wheels([L * 0.3], 0.5); cab(-0.4, 1.0); g.add(box(W * 1.5, 0.7, 0.7, STEEL, 0, 0.6, L / 2 + 0.3)); }
    if (id === 'mixer') { wheels([L * 0.34, -L * 0.1, -L * 0.34]); cab(L * 0.32); const drum = cyl(1.0, 2.6, mat(0xf07a1a), 0, 2.3, -0.7, 'z'); drum.rotation.x = Math.PI / 2 - 0.25; g.add(drum); }
    return g;
}

export class Vehicles {
    constructor(scene) {
        this.root = new THREE.Group();          // moved and turned to the player's truck
        scene.add(this.root);
        this.body = new THREE.Group();          // bobs and pops inside the root
        this.root.add(this.body);
        this.models = {};
        for (const V of VEHICLES) {
            const g = model('veh-' + V.id, { len: V.len * 1.15 }, standIn(V.id), { yaw: YAW[V.id] });
            g.visible = false;
            this.body.add(g);
            this.models[V.id] = g;
        }
        // the working parts
        this.heap = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x6b5a48, { roughness: 1 }));
        this.heap.scale.set(1.0, 0.55, 1.3); this.heap.position.set(0, 2.15, -0.9); this.heap.castShadow = true;
        this.body.add(this.heap);
        this.bucket = [-0.7, 0, 0.7].map((x) => {
            const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45), mat(0x8d8f94, { roughness: 1 }));
            r.position.set(x, 1.0, 2.5); r.castShadow = true; this.body.add(r);
            return r;
        });
        // crane: a cable, a hook block and the piece it carries, swinging across the mark
        this.hook = new THREE.Group();
        this.cable = box(0.06, 1, 0.06, mat(0x222222));
        this.hookBlock = box(0.5, 0.5, 0.5, mat(0xd9382b));
        this.piece = box(3.2, 0.35, 0.5, mat(0x9a6b3c));
        this.hook.add(this.cable, this.hookBlock, this.piece);
        this.root.add(this.hook);
        // wrecker: a chain and a ball
        this.ballRig = new THREE.Group();
        this.chain = box(0.1, 1, 0.1, mat(0x333333));
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), mat(0x2a2a2e, { roughness: 0.4, metalness: 0.6 }));
        this.ball.castShadow = true;
        this.ballRig.add(this.chain, this.ball);
        this.root.add(this.ballRig);
        this.pop = 0;
        this.shown = null;
    }

    switched() { this.pop = 1; }

    /** lift: the lift step in hand when the crane is the right tool, else null. */
    frame(G, dt, time, { lift = null } = {}) {
        const p = G.p;
        if (this.shown !== G.veh) {
            if (this.shown) this.models[this.shown].visible = false;
            this.models[G.veh].visible = true;
            this.shown = G.veh;
        }
        this.root.position.set(p.x, 0, p.y);
        this.root.rotation.y = Math.PI / 2 - p.a;
        // a little life: an idle shake, a bob with speed, a pop when swapped
        this.pop = Math.max(0, this.pop - dt * 3);
        const k = 1 + Math.sin(this.pop * Math.PI) * 0.25;
        this.body.scale.set(k, 2 - k, k);
        this.body.position.y = Math.abs(Math.sin(time * 14)) * 0.03 + Math.abs(Math.sin(G.odo * 1.3)) * 0.05;
        this.body.rotation.x = -p.v * 0.004;

        this.heap.visible = G.veh === 'dump' && G.cargo.dump > 0;
        this.bucket.forEach((r, i) => { r.visible = G.veh === 'loader' && G.cargo.loader > i; });

        this.hook.visible = G.veh === 'crane';
        if (this.hook.visible) {
            const tipY = 6.2, tipZ = 3.4, swing = lift ? Math.sin(G.hookT) * 3 : Math.sin(time * 1.2) * 0.3;
            const drop = lift ? 3.6 : 1.6;
            this.hook.position.set(0, 0, tipZ);
            this.cable.scale.y = drop; this.cable.position.set(swing * 0.5, tipY - drop / 2, 0);
            this.cable.rotation.z = Math.atan2(swing, drop * 2);
            this.hookBlock.position.set(swing, tipY - drop, 0);
            this.piece.visible = !!lift && G.missCd <= 0;
            this.piece.position.set(swing, tipY - drop - 0.5, 0);
        }
        this.ballRig.visible = G.veh === 'wrecker';
        if (this.ballRig.visible) {
            // rest hanging from the boom tip; a swing pulls back and then flies forward to the wall
            const t = G.swing > 0 ? 1 - G.swing / WORK.swingTime : 0;
            const ang = G.swing > 0 ? (t < 0.45 ? -0.7 * (t / 0.45) : -0.7 + 2.2 * ((t - 0.45) / 0.55)) : Math.sin(time * 1.5) * 0.06;
            const tipY = 6.8, tipZ = 3.0, len = 4.6;
            this.ballRig.position.set(0, tipY, tipZ);
            this.ballRig.rotation.x = -ang;
            this.chain.scale.y = len; this.chain.position.y = -len / 2;
            this.ball.position.y = -len;
        }
    }
}

export const VEH_RADIUS = RADIUS;
