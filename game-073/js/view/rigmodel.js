// Thimble: a brass barrel on treads with an auger for a nose, vanes on top and a lantern on a mast.
// Built from primitives; each relic adds a visible part.

import * as THREE from 'three';
import { brassCanvas } from './textures.js';

function tex(cv) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function spiralCanvas(a, b) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = a; ctx.fillRect(0, 0, 64, 128);
    ctx.strokeStyle = b; ctx.lineWidth = 9;
    for (let y = -64; y < 192; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y + 32); ctx.stroke(); }
    return cv;
}

export class RigModel {
    constructor(scene) {
        const root = new THREE.Group();
        this.root = root;
        const brassTex = tex(brassCanvas());
        const brass = new THREE.MeshStandardMaterial({ map: brassTex, metalness: 0.45, roughness: 0.42, color: 0xffffff, emissive: 0x2a1a08, emissiveIntensity: 0.4 });
        const darkBrass = new THREE.MeshStandardMaterial({ color: 0x7a5420, metalness: 0.5, roughness: 0.5, emissive: 0x120800 });
        const iron = new THREE.MeshStandardMaterial({ color: 0x3a3836, metalness: 0.4, roughness: 0.7 });
        const oak = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.85 });
        this.mats = { brass, darkBrass, iron, oak };

        const body = new THREE.Group();
        root.add(body);
        this.body = body;

        // barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.44, 20, 1), brass);
        barrel.position.y = 0.0;
        body.add(barrel);
        for (const y of [-0.2, 0.0, 0.2]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.022, 6, 24), darkBrass);
            ring.rotation.x = Math.PI / 2; ring.position.y = y;
            body.add(ring);
        }
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
        dome.scale.y = 0.6; dome.position.y = 0.22;
        body.add(dome);

        // porthole eye (front-side, toward the camera)
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(0.15, 0.04, 0.2);
        eyeGroup.rotation.y = 0.65;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 8, 20), darkBrass);
        eyeGroup.add(rim);
        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x3fb0e0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0 });
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), this.eyeMat);
        eye.position.z = 0.005;
        eyeGroup.add(eye);
        const glint = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        glint.position.set(-0.03, 0.03, 0.01);
        eyeGroup.add(glint);
        body.add(eyeGroup);

        // treads
        this.wheels = [];
        for (const z of [-0.2, 0.2]) {
            const track = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.15, 0.1), iron);
            track.position.set(0, -0.3, z);
            root.add(track);
            for (const x of [-0.24, 0, 0.24]) {
                const w = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10), darkBrass);
                w.rotation.x = Math.PI / 2; w.position.set(x, -0.3, z + Math.sign(z) * 0.02);
                root.add(w);
                this.wheels.push(w);
            }
        }

        // auger on an arm
        this.drillPivot = new THREE.Group();
        this.drillPivot.position.set(0.0, -0.08, 0);
        root.add(this.drillPivot);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), darkBrass);
        arm.position.set(0.24, 0, 0);
        this.drillPivot.add(arm);
        this.drillMat = new THREE.MeshStandardMaterial({ map: tex(spiralCanvas('#9a9690', '#4a4844')), metalness: 0.7, roughness: 0.35 });
        this.drill = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 14, 1), this.drillMat);
        this.drill.rotation.z = -Math.PI / 2;
        this.drill.position.set(0.5, 0, 0);
        this.drillPivot.add(this.drill);

        // vanes
        this.vanes = [];
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8, side: THREE.DoubleSide });
        this.bladeMat = bladeMat;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16), darkBrass);
        mast.position.set(0, 0.42, 0);
        root.add(mast);
        for (const z of [-0.08, 0.08]) {
            const hub = new THREE.Group();
            hub.position.set(0, 0.5, z);
            for (let i = 0; i < 3; i++) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.07), bladeMat);
                b.position.x = 0.15;
                const arm2 = new THREE.Group();
                arm2.rotation.y = (i / 3) * Math.PI * 2;
                arm2.add(b);
                hub.add(arm2);
            }
            root.add(hub);
            this.vanes.push(hub);
        }

        // lantern on a mast at the back
        const lmast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3), iron);
        lmast.position.set(-0.22, 0.38, 0.1);
        root.add(lmast);
        this.lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.2 });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), this.lampMat);
        lamp.position.set(-0.22, 0.56, 0.1);
        root.add(lamp);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 4), darkBrass);
        cap.position.set(-0.22, 0.65, 0.1); cap.rotation.y = Math.PI / 4;
        root.add(cap);
        this.light = new THREE.PointLight(0xffc880, 6, 7, 1.4);
        this.light.position.set(-0.1, 0.4, 0.8);
        root.add(this.light);

        // exhaust
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22), iron);
        pipe.position.set(-0.3, 0.12, -0.08); pipe.rotation.z = 0.4;
        root.add(pipe);
        this.exhaust = new THREE.Vector3(-0.36, 0.24, -0.08);

        // --- relic parts ---
        this.parts = [];
        // 0 lens: brighter cyan eye (handled by eyeMat), plus a brass lens hood
        const hood = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 6, 16, Math.PI), darkBrass);
        hood.position.copy(eyeGroup.position); hood.rotation.copy(eyeGroup.rotation); hood.position.y += 0.02;
        body.add(hood);
        this.parts[0] = hood;
        // 1 feather: silver feathers on the vanes
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf0f6ff, emissive: 0x8090b0, emissiveIntensity: 0.4, side: THREE.DoubleSide });
        const feathers = new THREE.Group();
        for (const s of [-1, 1]) {
            const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), featherMat);
            f.position.set(s * 0.26, 0.28, 0.12); f.rotation.z = s * 0.5;
            feathers.add(f);
        }
        root.add(feathers);
        this.parts[1] = feathers;
        // 2 gear: a spinning red-gold gear on the side
        const gearMat = new THREE.MeshStandardMaterial({ color: 0xffb040, metalness: 0.8, roughness: 0.3, emissive: 0x803000, emissiveIntensity: 0.5 });
        const gear = new THREE.Group();
        gear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12), gearMat));
        for (let i = 0; i < 8; i++) {
            const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.04), gearMat);
            const a = (i / 8) * Math.PI * 2;
            tooth.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
            tooth.rotation.y = -a;
            gear.add(tooth);
        }
        gear.rotation.x = Math.PI / 2;
        gear.position.set(-0.08, -0.06, 0.29);
        body.add(gear);
        this.gear = gear;
        this.parts[2] = gear;
        // 3 satchel: a purple pouch on the back
        const satchel = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x7a40b0, roughness: 0.9, emissive: 0x2a0a40 }));
        satchel.scale.set(0.8, 1, 0.9);
        satchel.position.set(-0.3, -0.04, 0.05);
        body.add(satchel);
        this.parts[3] = satchel;
        // 4 scale: a red scale plate on the front
        const scale = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff5030, metalness: 0.4, roughness: 0.3, emissive: 0x801000, emissiveIntensity: 0.6 }));
        scale.scale.set(1, 0.35, 1);
        scale.rotation.z = -Math.PI / 2;
        scale.position.set(0.27, -0.12, 0.05);
        body.add(scale);
        this.parts[4] = scale;
        // 5 heart: a rose glow in the dome
        this.heartMat = new THREE.MeshStandardMaterial({ color: 0xff80c0, emissive: 0xff4090, emissiveIntensity: 1.6 });
        const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), this.heartMat);
        heart.position.set(0, 0.3, 0.12);
        body.add(heart);
        this.heart = heart;
        this.parts[5] = heart;
        // 6 lance: a golden star-iron auger (swaps the drill material)
        this.lanceMat = new THREE.MeshStandardMaterial({ map: tex(spiralCanvas('#ffe9a0', '#c09030')), metalness: 0.8, roughness: 0.25, emissive: 0x806020, emissiveIntensity: 0.7 });
        this.parts[6] = null;

        scene.add(root);
        this.face = 1;
        this.faceAnim = 1;
        this.drillAngle = 0;
        this.spin = 0;
        this.vaneSpin = 0;
        this.flash = 0;
    }

    setRelics(relics) {
        for (let i = 0; i < 6; i++) if (this.parts[i]) this.parts[i].visible = !!relics[i];
        this.drill.material = relics[6] ? this.lanceMat : this.drillMat;
        this.drill.scale.setScalar(relics[6] ? 1.25 : 1);
        this.eyeMat.emissive.setHex(relics[5] ? 0xff70b0 : relics[0] ? 0x60e8ff : 0x3fb0e0);
        this.eyeMat.emissiveIntensity = relics[0] ? 1.3 : 0.6;
    }

    /** Lantern radius in tiles drives the point light's reach. */
    setLantern(radius) {
        this.light.distance = radius * 1.7;
    }

    update(rig, dt, time, opts) {
        const { x, y, vx, face, drill, thrust } = rig;
        this.root.position.set(x, y + 0.02, 0);
        // turn around with a quick squash through the middle, keeping the eye toward the camera
        this.faceAnim += (face - this.faceAnim) * Math.min(1, dt * 14);
        const fx = Math.abs(this.faceAnim) < 0.08 ? Math.sign(this.faceAnim || 1) * 0.08 : this.faceAnim;
        this.root.scale.set(fx, 1, 1);
        // drill orientation: forward, or down while boring down
        const wantDown = (drill && drill.dir === 'down') || opts.pressDown;
        const target = wantDown ? -Math.PI / 2 : -0.12;
        this.drillAngle += (target - this.drillAngle) * Math.min(1, dt * 14);
        this.drillPivot.rotation.z = this.drillAngle;
        const spinning = !!drill || opts.pressDown || opts.pressSide;
        this.spin += dt * (drill ? 30 : spinning ? 12 : 0);
        this.drill.rotation.y = this.spin;
        // body: bob, tilt with speed, shudder while drilling
        const shake = drill ? 0.025 : 0;
        this.body.position.y = Math.sin(time * 9) * (Math.abs(vx) > 0.3 && rig.grounded ? 0.015 : 0.004) + (Math.random() - 0.5) * shake;
        this.body.position.x = (Math.random() - 0.5) * shake;
        this.root.rotation.z = -Math.max(-0.25, Math.min(0.25, vx * 0.04)) * (rig.grounded ? 0.3 : 1);
        for (const w of this.wheels) w.rotation.y -= Math.abs(vx) * dt * 6;
        // vanes: idle drift, fast when lifting
        this.vaneSpin += dt * (thrust ? 34 : rig.grounded ? 1.5 : 10);
        this.vanes[0].rotation.y = this.vaneSpin;
        this.vanes[1].rotation.y = -this.vaneSpin * 1.1;
        if (this.gear.visible) this.gear.rotation.y += dt * (drill ? 9 : 1.5);
        if (this.heart.visible) { this.heartMat.emissiveIntensity = 1.3 + Math.sin(time * 3) * 0.5; this.heart.rotation.y += dt * 1.4; }
        this.lampMat.emissiveIntensity = 2 + Math.sin(time * 13) * 0.15;
        this.light.intensity = (opts.lightK ?? 1) * (5.5 + Math.sin(time * 11) * 0.3);
        // hurt flash
        this.flash = Math.max(0, this.flash - dt * 3);
        this.mats.brass.emissive.setRGB(0.16 + this.flash * 0.8, 0.1 + this.flash * 0.05, 0.03);
        this.root.visible = opts.visible !== false;
    }

    exhaustWorld(out) {
        out.copy(this.exhaust);
        this.root.localToWorld(out);
        return out;
    }
    drillTipWorld(out) {
        out.set(0.68, 0, 0);
        this.drillPivot.localToWorld(out);
        return out;
    }
}
