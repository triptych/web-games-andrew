// Cinderpeak as the garden sees it: the mountain out at sea, the cove at its
// foot, the walking world for the cove, and the picking for its few things to
// click (the cart, the dais). main.js owns the comings and goings.

import * as THREE from 'three';
import { Mountain } from './volcano.js';
import { buildCove } from './volcano-cove.js';
import { DAIS, VC, volcanoHeight, volcanoShore } from './volcano-data.js';

const CELL = 4;

export class Cinderpeak {
    /** @param {object} env { world, scene, sky, quality, water } */
    constructor(env) {
        const { world, scene, sky, quality, water } = env;
        this.sky = sky;
        this.mountain = new Mountain({ scene, sky, quality });
        scene.add(this.mountain.group);
        water.addRegion(this.mountain.waterData(quality.tier === 'low' ? 256 : 512));
        this.cove = buildCove({ world, mats: world.mats, mountain: this.mountain, quality });
        this.cart = this.cove.cart;
        this.dais = this.cove.dais;
        this.spawn = this.cove.spawn;
        this.platformStand = this.cove.platformStand;
        this.cartPos = this.cove.cartPos;

        // the walking world for the controls
        const floors = this.cove.boxFloors;
        const grid = new Map();
        for (const c of this.cove.colliders) {
            const i0 = Math.floor((c.x - c.r) / CELL), i1 = Math.floor((c.x + c.r) / CELL);
            const j0 = Math.floor((c.z - c.r) / CELL), j1 = Math.floor((c.z + c.r) / CELL);
            for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
                const k = i * 7919 + j;
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(c);
            }
        }
        const empty = [];
        this.world = {
            ui: world.ui, layout: null,
            island: { heightAt: (x, z) => volcanoHeight(x, z), shoreAt: (x, z) => volcanoShore(x, z) },
            walkHeight: (x, z) => {
                let h = volcanoHeight(x, z);
                for (const f of floors) {
                    if (f.circle ? (x - f.x) ** 2 + (z - f.z) ** 2 < f.r * f.r : x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) if (f.y > h) h = f.y;
                }
                return h;
            },
            onDeck: () => false,
            collidersNear: (x, z) => grid.get(Math.floor(x / CELL) * 7919 + Math.floor(z / CELL)) ?? empty,
            onArrive: null,
        };
        this.ray = new THREE.Raycaster();
    }

    /** What a ray from the camera hits among the cove's few clickable things: { type, t, point }. */
    pick(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        let best = null;
        const hit = ray.intersectObject(this.cart.group, true)[0];
        if (hit && hit.distance < 60) best = { type: 'cart', t: hit.distance };
        // the dais: a disc, with the column of light above it
        const dd = this.dais;
        const dy = dd.y + 1.6;
        if (Math.abs(d.y) > 1e-4) {
            const t = (dy - o.y) / d.y;
            if (t > 0 && t < 60 && Math.hypot(o.x + d.x * t - dd.x, o.z + d.z * t - dd.z) < 1.7 && (!best || t < best.t)) best = { type: 'dais', t };
        }
        // the ground, marched
        for (let t = 0.5; t < 90; t += t < 25 ? 0.4 : 1) {
            const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t;
            if (y < this.world.walkHeight(x, z)) {
                if (best && best.t < t) return best;
                let lo = Math.max(0.5, t - 1), hi = t;
                for (let i = 0; i < 8; i++) {
                    const m = (lo + hi) / 2;
                    if (o.y + d.y * m < this.world.walkHeight(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m;
                }
                return { type: 'ground', t: hi, point: new THREE.Vector3(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi) };
            }
        }
        return best;
    }

    update(dt, t, camPos) {
        this.mountain.update(dt, t, camPos);
    }
}

export { DAIS, VC };
