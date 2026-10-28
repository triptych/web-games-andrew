// The tools you hold: small 3D models that follow the pointer and animate while they work.

import * as THREE from 'three';
import { Builder, mat, accentMat, colorMat } from './kit.js';

const PI = Math.PI;

/** Every tool is built pointing down the -y axis with its tip at the origin. */
function make(id) {
    const b = new Builder();
    const g = new THREE.Group();
    const spin = new THREE.Group();     // the part that turns (bit, socket) or swings
    const extra = {};
    switch (id) {
        case 'driver': {
            const sb = new Builder();
            sb.cyl(mat('chrome'), 0.04, 0.06, 0.2, 6, 0, 0, 0);
            sb.cyl(mat('steel'), 0.07, 0.07, 1.5, 8, 0, 0.2, 0);
            spin.add(sb.build());
            b.cyl(accentMat(0xff8a3d), 0.22, 0.2, 1.3, 12, 0, 1.7, 0);
            b.cyl(mat('rubber'), 0.23, 0.23, 0.12, 12, 0, 1.6, 0);
            break;
        }
        case 'ratchet': {
            const sb = new Builder();
            sb.cyl(mat('chrome'), 0.16, 0.18, 0.4, 6, 0, 0, 0);
            sb.cyl(mat('steel'), 0.26, 0.26, 0.22, 16, 0, 0.4, 0);
            spin.add(sb.build());
            b.box(mat('steel'), 0.18, 0.1, 2.0, 0, 0.78, 1.1);
            b.cylc(mat('rubber'), 0.17, 0.17, 1.0, 10, 0, 0.78, 2.2, PI / 2, 0, 0);
            break;
        }
        case 'pry': {
            b.box(mat('steel'), 0.35, 0.05, 1.8, 0, 0.2, 0.9, 0.25, 0, 0);
            b.box(mat('chrome'), 0.35, 0.05, 0.3, 0, 0.1, -0.1, -0.3, 0, 0);
            b.box(accentMat(0x35e0ff), 0.38, 0.1, 0.6, 0, 0.8, 1.9, 0.25, 0, 0);
            break;
        }
        case 'tweezers': {
            b.box(mat('chrome'), 0.06, 0.04, 2.2, 0.035, 0.7, 1.1, 0.3, -0.015, 0);
            b.box(mat('chrome'), 0.06, 0.04, 2.2, -0.035, 0.7, 1.1, 0.3, 0.015, 0);
            b.box(accentMat(0xff3d8b), 0.2, 0.06, 0.6, 0, 1.2, 2.2, 0.3, 0, 0);
            break;
        }
        case 'solder': {
            b.cyl(mat('chrome'), 0.03, 0.07, 0.5, 8, 0, 0, 0);
            b.cyl(mat('gunmetal'), 0.1, 0.1, 1.0, 8, 0, 0.5, 0);
            b.cyl(colorMat(0xd9641e, { roughness: 0.6 }), 0.2, 0.2, 1.4, 10, 0, 1.5, 0);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6a1e, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
            tip.position.y = 0.06; extra.tip = tip; g.add(tip);
            break;
        }
        case 'brush': {
            b.cyl(colorMat(0xc79a43, { roughness: 0.5 }), 0.17, 0.14, 0.45, 12, 0, 0.0, 0);
            b.cyl(mat('chrome'), 0.18, 0.18, 0.2, 12, 0, 0.45, 0);
            b.cyl(accentMat(0x4dff9a), 0.14, 0.2, 1.3, 10, 0, 0.65, 0);
            for (let i = 0; i < 18; i++) { const a = (i / 18) * PI * 2; b.cyl(colorMat(0xe6d7a8, { roughness: 0.9 }), 0.012, 0.01, 0.28, 3, Math.cos(a) * 0.1, -0.2, Math.sin(a) * 0.1); }
            break;
        }
        case 'oil': {
            b.box(mat('steel'), 0.9, 0.9, 0.6, 0, 1.0, 0.4);
            b.cylc(mat('chrome'), 0.05, 0.05, 1.3, 6, 0.1, 0.5, 0.0, 0, 0, 0.0);
            b.cyl(mat('chrome'), 0.02, 0.07, 1.0, 6, 0, 0.0, 0);
            b.box(accentMat(0xffc24d), 0.92, 0.22, 0.62, 0, 1.1, 0.4);
            break;
        }
        case 'probe': {
            b.cyl(mat('chrome'), 0.015, 0.05, 0.6, 6, 0, 0, 0);
            b.cyl(colorMat(0xd23a3a, { roughness: 0.5 }), 0.1, 0.1, 1.8, 10, 0, 0.6, 0);
            b.cyl(mat('rubber'), 0.04, 0.04, 1.0, 6, 0, 2.4, 0);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x59ffb4, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
            tip.position.y = 0.04; extra.tip = tip; g.add(tip);
            break;
        }
        default: {                       // hands: a small open ring and two pads
            b.tor(accentMat(0x8cd8ff), 0.28, 0.04, 0, 0.05, 0, PI / 2, 0, 0, 6, 22);
            b.cylc(accentMat(0x8cd8ff), 0.05, 0.05, 0.18, 8, 0, 0.06, 0);
            break;
        }
    }
    g.add(b.build());
    g.add(spin);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noPick = true; o.userData.sharedGeo = false; } });
    return { id, group: g, spin, extra };
}

export class ToolRig {
    constructor(scene) {
        this.root = new THREE.Group();
        this.root.visible = false;
        scene.add(this.root);
        this.tools = {};
        this.cur = null;
        this.pos = new THREE.Vector3();
        this.target = new THREE.Vector3();
        this.turn = 0; this.working = 0;
    }
    set(id) {
        if (this.cur && this.cur.id === id) return;
        if (this.cur) this.root.remove(this.cur.group);
        if (!this.tools[id]) this.tools[id] = make(id);
        this.cur = this.tools[id];
        this.root.add(this.cur.group);
    }
    /** target: where the tip is; working: 0..1; heat: 0..1 for the iron; camAz: tool leans toward the camera. */
    update(dt, t, target, visible, st) {
        if (!this.cur) return;
        this.root.visible = visible;
        if (!visible) return;
        this.target.copy(target);
        this.pos.lerp(this.target, 1 - Math.exp(-dt * 30));
        this.root.position.copy(this.pos);
        // lean back toward the camera so the handle points up and away
        this.root.rotation.set(0, st.az, 0);
        this.cur.group.rotation.set(-0.55 - (st.working ? 0.0 : 0.1), 0, 0);
        this.cur.group.position.y = st.working ? 0.0 : 0.25;
        const id = this.cur.id;
        if (id === 'driver' || id === 'ratchet') this.cur.spin.rotation.y += st.turning ? dt * (id === 'driver' ? 22 : 16) * st.dir : 0;
        if (id === 'ratchet') this.cur.group.rotation.z = st.turning ? Math.sin(t * 24) * 0.12 : 0;
        if (id === 'brush') this.cur.group.rotation.z = st.working ? Math.sin(t * 22) * 0.35 : 0;
        if (id === 'oil') this.cur.group.rotation.x = -0.55 - (st.working ? 0.55 : 0);
        if (id === 'solder' || id === 'probe') { this.cur.extra.tip.material.opacity = id === 'solder' ? Math.min(1, st.heat * 1.2) : (st.working ? 0.9 : 0); }
    }
}
