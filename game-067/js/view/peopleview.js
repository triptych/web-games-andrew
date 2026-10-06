/**
 * peopleview.js — the island's little brick people, drawn with a handful of instanced meshes
 * (legs, hips, torso, arms, head and seven kinds of hat or hair). Each part is posed from the
 * person's position, heading, walk cycle, hop and wave every frame.
 */

import * as THREE from 'three';
import { N, LAND_H, MAX_PEOPLE, PALETTE } from '../config.js';
import { idx } from '../sim/grid.js';
import { Builder } from './builder.js';
import { toyMat } from './materials.js';
import { C } from './models.js';

const PANTS = [9, 10, 2, 11, 14, 12, 3, 6];
const HAIR = [0x5a3a1e, 0x2a2018, 0xe0b040, 0xb8502a, 0x8a8f96];

function part(fn) { const b = new Builder(); fn(b); return b.geometry(); }

const GEO = {
    leg: () => part((b) => { b.box(0.042, 0.085, 0.052, C.white, 0, -0.085, 0); b.box(0.042, 0.02, 0.06, C.white, 0, -0.095, 0.005); }),
    hips: () => part((b) => b.box(0.092, 0.025, 0.052, C.white, 0, 0.085, 0)),
    torso: () => part((b) => { b.cyl(0.062, 0.1, C.white, 0, 0.11, 0, { rt: 0.05, seg: 4, ry: Math.PI / 4, sz: 0.62 }); }),
    arm: () => part((b) => { b.box(0.026, 0.07, 0.03, C.white, 0, -0.065, 0); }),
    head: () => part((b) => {
        b.cyl(0.018, 0.012, C.skin, 0, 0.21, 0, { seg: 8 });
        b.cyl(0.036, 0.05, C.skin, 0, 0.222, 0, { seg: 12 });
        b.sphere(0.006, C.black, -0.014, 0.252, 0.033, { seg: 5, rings: 3 });
        b.sphere(0.006, C.black, 0.014, 0.252, 0.033, { seg: 5, rings: 3 });
        for (let k = 0; k < 3; k++) b.sphere(0.004, C.black, -0.01 + k * 0.01, 0.237 - (k === 1 ? 0.003 : 0), 0.034, { seg: 4, rings: 2 });
    }),
    hats: [
        () => part((b) => { b.sphere(0.04, C.white, 0, 0.255, -0.004, { half: true, seg: 10, sy: 0.8 }); b.box(0.08, 0.035, 0.03, C.white, 0, 0.23, -0.026); }),
        () => part((b) => { b.sphere(0.039, C.white, 0, 0.262, 0, { half: true, seg: 10, sy: 0.6 }); b.box(0.05, 0.008, 0.04, C.white, 0, 0.262, 0.045); }),
        () => part((b) => { b.cyl(0.055, 0.008, C.white, 0, 0.272, 0, { seg: 12 }); b.cyl(0.034, 0.06, C.white, 0, 0.278, 0, { seg: 12 }); }),
        () => part((b) => { b.sphere(0.04, C.white, 0, 0.262, 0, { half: true, seg: 10 }); b.sphere(0.014, C.white, 0, 0.305, 0, { seg: 6 }); }),
        () => part((b) => { b.cyl(0.041, 0.03, C.white, 0, 0.268, 0, { seg: 12 }); b.box(0.05, 0.006, 0.03, C.white, 0, 0.268, 0.04); }),
        () => part((b) => { b.sphere(0.04, C.white, 0, 0.255, -0.004, { half: true, seg: 10, sy: 0.8 }); b.sphere(0.018, C.white, 0, 0.245, -0.05, { seg: 6 }); b.cyl(0.01, 0.05, C.white, 0, 0.19, -0.055, { seg: 6 }); }),
        () => part((b) => { b.sphere(0.044, C.white, 0, 0.262, 0, { half: true, seg: 10, sy: 0.75 }); b.cyl(0.05, 0.006, C.white, 0, 0.262, 0, { seg: 12 }); }),
    ],
};

const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

export class PeopleView {
    constructor(scene) {
        const mk = (geo, n = MAX_PEOPLE, tint = true) => {
            const m = new THREE.InstancedMesh(geo, toyMat, n);
            if (tint) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
            m.count = 0; m.frustumCulled = false; m.castShadow = true;
            scene.add(m);
            return m;
        };
        this.legs = mk(GEO.leg(), MAX_PEOPLE * 2);
        this.hips = mk(GEO.hips());
        this.torso = mk(GEO.torso());
        this.arms = mk(GEO.arm(), MAX_PEOPLE * 2);
        this.head = mk(GEO.head(), MAX_PEOPLE, false);
        this.hats = GEO.hats.map((g) => mk(g()));
        this.screen = [];
    }

    update(world) {
        let n = 0, nl = 0, na = 0;
        const hatN = this.hats.map(() => 0);
        for (const p of world.people.list) {
            if (p.state === 'ride' || n >= MAX_PEOPLE) continue;
            const tx = Math.floor(p.x), tz = Math.floor(p.z);
            let y = LAND_H;
            const i = tx >= 0 && tz >= 0 && tx < N && tz < N ? idx(tx, tz) : -1;
            if (i >= 0 && world.station[i]) {
                const along = world.track[i] === 1;
                const off = along ? Math.abs(p.x - tx - 0.5) : Math.abs(p.z - tz - 0.5);
                if (off > 0.28) y += 0.1;
            }
            if (p.hop > 0) y += Math.sin((p.hop / 0.6) * Math.PI) * 0.12;
            const wx = p.x - N / 2, wz = p.z - N / 2;
            _base.makeRotationY(p.yaw).setPosition(wx, y + 0.095, wz);
            const walking = p.state === 'walk';
            const swing = walking ? Math.sin(p.phase) * 0.6 : 0;
            // legs
            for (const s of [-1, 1]) {
                _loc.makeTranslation(s * 0.022, 0, 0).multiply(_r.makeRotationX(swing * s));
                this.legs.setMatrixAt(nl, _m.multiplyMatrices(_base, _loc));
                _c.setHex(PALETTE[PANTS[p.look.pants % PANTS.length]].hex);
                this.legs.setColorAt(nl, _c);
                nl++;
            }
            _loc.makeTranslation(0, -0.095, 0);
            this.hips.setMatrixAt(n, _m.multiplyMatrices(_base, _loc));
            this.hips.setColorAt(n, _c);
            const shirt = PALETTE[p.look.shirt].hex;
            this.torso.setMatrixAt(n, _m.multiplyMatrices(_base, _loc));
            _c.setHex(shirt);
            this.torso.setColorAt(n, _c);
            // arms swing opposite the legs; a wave lifts the right arm
            const waving = p.state === 'wave' || (p.state === 'wait' && p.hop > 0);
            for (const s of [-1, 1]) {
                let rx = -swing * s * 0.8, rz = 0;
                if (waving && s === 1) { rx = 0; rz = 2.6 + Math.sin(p.phase * 4) * 0.35; }
                _loc.makeTranslation(s * 0.064, 0.1, 0).multiply(_r.makeRotationX(rx)).multiply(new THREE.Matrix4().makeRotationZ(rz * s * 1));
                this.arms.setMatrixAt(na, _m.multiplyMatrices(_base, _loc));
                this.arms.setColorAt(na, _c);
                na++;
            }
            _loc.makeTranslation(0, -0.095, 0);
            this.head.setMatrixAt(n, _m.multiplyMatrices(_base, _loc));
            const h = p.look.hat % this.hats.length;
            const hm = this.hats[h];
            hm.setMatrixAt(hatN[h], _m);
            _c.setHex(h === 0 || h === 5 ? HAIR[p.look.hair % HAIR.length] : PALETTE[(p.look.shirt + 5) % PALETTE.length].hex);
            hm.setColorAt(hatN[h], _c);
            hatN[h]++;
            n++;
        }
        for (const [m, c] of [[this.legs, nl], [this.hips, n], [this.torso, n], [this.arms, na], [this.head, n]]) {
            m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        this.hats.forEach((m, k) => { m.count = hatN[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    }

    /** Person id nearest a screen point. */
    pick(world, sx, sy, toScreen, maxPx = 28) {
        let best = 0, bd = maxPx * maxPx;
        for (const p of world.people.list) {
            if (p.state === 'ride') continue;
            const s = toScreen(p.x - N / 2, LAND_H + 0.18, p.z - N / 2);
            if (!s) continue;
            const d = (s.x - sx) ** 2 + (s.y - sy) ** 2;
            if (d < bd) { bd = d; best = p.id; }
        }
        return best;
    }
}
