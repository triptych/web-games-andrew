// The first-person view: Roxy's gloved hands and the gun, in their own scene and camera (drawn
// over the world with the depth cleared, so the gun never clips into walls). Bob, sway, recoil,
// reload, switching, spinning barrels, muzzle flashes, and the boot that comes up for a kick.

import * as THREE from 'three';
import { buildGun } from './guns.js';

const GLOVE = 0x18141c, SKIN = 0xd9a07c, NAIL = 0xff2a8a, CUFF = 0xff3fa4;

function hand(mirror = 1) {
    const g = new THREE.Group();
    const glove = new THREE.MeshStandardMaterial({ color: GLOVE, roughness: 0.45, metalness: 0.15 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
    const nail = new THREE.MeshStandardMaterial({ color: NAIL, roughness: 0.2, metalness: 0.3 });
    const cuff = new THREE.MeshStandardMaterial({ color: CUFF, roughness: 0.4, emissive: new THREE.Color(0x30001a) });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.09), glove);
    g.add(palm);
    // fingerless gloves: the knuckle half is glove, the tips are skin with pink nails
    for (let k = 0; k < 4; k++) {
        const f = new THREE.Group();
        f.position.set((k - 1.5) * 0.019, -0.005, -0.045);
        f.rotation.x = -1.2;
        const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.02, 4, 8), glove);
        a.position.z = -0.012; a.rotation.x = Math.PI / 2;
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.02, 4, 8), skin);
        b.position.set(0, -0.02, -0.03); b.rotation.x = Math.PI / 2 - 1;
        const n = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.01), nail);
        n.position.set(0, -0.03, -0.042); n.rotation.x = -0.6;
        f.add(a, b, n);
        g.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.035, 4, 8), glove);
    thumb.position.set(0.04 * mirror, 0.005, -0.02); thumb.rotation.set(0.4, 0, 0.9 * mirror);
    g.add(thumb);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 14), cuff);
    wrist.position.set(0, 0, 0.065); wrist.rotation.x = Math.PI / 2;
    g.add(wrist);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 14), skin);
    arm.position.set(0, 0, 0.29); arm.rotation.x = Math.PI / 2;
    g.add(arm);
    // a wristband stud row, very 1987
    for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.012, 4), new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 1, roughness: 0.2 }));
        const a = (k / 6) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.065);
        s.rotation.z = a - Math.PI / 2;
        g.add(s);
    }
    return g;
}

function boot() {
    const g = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.35, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd6, roughness: 0.2, metalness: 1 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 }));
    sole.position.y = -0.04;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.28), leather);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    toe.rotation.x = -Math.PI / 2; toe.position.set(0, 0, -0.14); toe.scale.set(1, 1, 0.7);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.3, 16), leather);
    shaft.position.set(0, 0.16, 0.08);
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16), steel);
    buckle.rotation.x = Math.PI / 2; buckle.position.set(0, 0.22, 0.08);
    g.add(sole, foot, toe, shaft, buckle);
    return g;
}

export class ViewModel {
    constructor(envMap) {
        this.scene = new THREE.Scene();
        this.scene.environment = envMap;
        this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
        this.hemi = new THREE.HemisphereLight(0x9a8aff, 0x2a1020, 0.9);
        this.key = new THREE.DirectionalLight(0xffffff, 1.6);
        this.key.position.set(0.5, 1, 0.4);
        this.rim = new THREE.DirectionalLight(0xff3fa4, 0.6);
        this.rim.position.set(-0.6, 0.3, -1);
        this.flashLight = new THREE.PointLight(0xffc070, 0, 3, 2);
        this.flashLight.position.set(0.2, -0.1, -0.8);
        this.scene.add(this.hemi, this.key, this.rim, this.flashLight);
        this.rig = new THREE.Group();
        this.scene.add(this.rig);
        this.gunHolder = new THREE.Group();
        this.rig.add(this.gunHolder);
        this.rightHand = hand(1);
        this.leftHand = hand(-1);
        this.rig.add(this.rightHand, this.leftHand);
        this.boot = boot();
        this.boot.visible = false;
        this.boot.scale.setScalar(0.85);
        this.scene.add(this.boot);
        // muzzle flash: a star of additive planes
        const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, map: flashTexture() });
        this.flash = new THREE.Group();
        for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), fm); p.rotation.z = k * 1.05; this.flash.add(p); }
        const side = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.32), fm);
        side.rotation.y = Math.PI / 2; side.position.z = -0.12;
        this.flash.add(side);
        this.flash.visible = false;
        this.flashMat = fm;
        this.gun = null;
        this.gunKey = '';
        this.t = 0; this.recoil = 0; this.flashT = 0; this.switchK = 1; this.reloadK = 0; this.kickT = 0;
        this.swayX = 0; this.swayY = 0; this.bob = 0; this.land = 0;
        this.spin = 0;
    }

    setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

    setGun(gun) {
        const key = gun ? `${gun.seed}:${gun.name}` : '';
        if (key === this.gunKey) return;
        this.gunKey = key;
        if (this.gun) {
            this.gunHolder.remove(this.gun.root);
            this.gun.root.traverse((o) => { o.geometry && !o.geometry.parameters && o.geometry.dispose(); });
        }
        this.gun = gun ? buildGun(gun) : null;
        if (this.gun) {
            this.gunHolder.add(this.gun.root);
            this.gun.muzzle.add(this.flash);
            const c = this.gun.glowMat.color;
            this.flashMat.color.setRGB(Math.max(1.5, c.r * 1.2), Math.max(1.2, c.g), Math.max(0.6, c.b));
        }
        this.arch = gun?.arch;
        this.switchK = 0;
    }

    onFire(arch) {
        this.recoil = Math.min(1.4, this.recoil + ({ shotgun: 1, rocket: 1.2, pistol: 0.55, disc: 0.6, ripper: 0.25, photon: 0.3, tesla: 0.08 }[arch] ?? 0.4));
        this.flashT = arch === 'tesla' ? 0.03 : 0.05;
        this.flash.rotation.z = Math.random() * 6;
        this.flash.scale.setScalar(arch === 'shotgun' || arch === 'rocket' ? 1.6 : arch === 'ripper' ? 0.9 : 1);
    }
    onKick() { this.kickT = 0.35; }
    onReload(t) { this.reloadT = t; this.reloadMax = t; }
    onLand(v) { this.land = Math.min(1, v / 15); }

    /** p: the sim player; light: rgb at the player's feet from the lightmap. */
    update(p, dt, lookDX, lookDY, light, spin) {
        this.t += dt;
        const sp = Math.hypot(p.vx, p.vz);
        this.bob += dt * sp * 1.4 * (p.ground ? 1 : 0.2);
        const bx = Math.sin(this.bob) * 0.012 * Math.min(1, sp / 8), by = -Math.abs(Math.cos(this.bob)) * 0.014 * Math.min(1, sp / 8);
        this.swayX += (Math.max(-0.08, Math.min(0.08, -lookDX * 0.6)) - this.swayX) * Math.min(1, dt * 10);
        this.swayY += (Math.max(-0.08, Math.min(0.08, lookDY * 0.6)) - this.swayY) * Math.min(1, dt * 10);
        this.recoil = Math.max(0, this.recoil - dt * 7);
        this.switchK = Math.min(1, this.switchK + dt * 3);
        this.land = Math.max(0, this.land - dt * 4);
        const reload = this.reloadT > 0 ? Math.sin(Math.min(1, 1 - this.reloadT / this.reloadMax) * Math.PI) : 0;
        if (this.reloadT > 0) this.reloadT -= dt;
        const down = (1 - this.switchK) * 0.35 + reload * 0.12 + this.land * 0.05;
        this.rig.position.set(0.25 + bx + this.swayX, -0.25 + by - down + this.swayY * 0.5 + Math.sin(this.t * 1.6) * 0.003, -0.52 + this.recoil * 0.06);
        this.rig.rotation.set(this.recoil * 0.12 - reload * 0.5 + (1 - this.switchK) * -0.6, this.swayX * 0.6, reload * 0.4 + this.swayX * 0.5);
        // hands sit on the grip and the fore-end
        const len = this.gun?.len ?? 0.4;
        this.rightHand.position.set(0.0, -0.08, 0.04);
        this.rightHand.rotation.set(-0.3, 0, -0.15);
        this.leftHand.position.set(-0.02 - reload * 0.06, -0.03 - reload * 0.08, -Math.min(0.42, len * 0.6) + reload * 0.2);
        this.leftHand.rotation.set(-0.1, 0.4, 0.5);
        this.leftHand.visible = this.arch !== 'pistol' || reload > 0;
        if (this.gun?.spin) { this.spin += dt * spin * 40; this.gun.spin.rotation.z = this.spin; }
        if (this.gun?.disc) this.gun.disc.rotation.y += dt * 6;
        if (this.gun) for (const c of this.gun.coils) c.scale.setScalar(1 + Math.sin(this.t * 10 + c.position.z * 30) * 0.05);
        this.flashT -= dt;
        this.flash.visible = this.flashT > 0;
        this.flashLight.intensity = this.flashT > 0 ? 6 : 0;
        // the boot: up from below, out, and back
        if (this.kickT > 0) {
            this.kickT -= dt;
            const u = 1 - this.kickT / 0.35;
            const out = Math.sin(Math.min(1, u * 1.6) * Math.PI);
            this.boot.visible = true;
            // from below the frame, toe first, and back down: only the boot and a little shin show
            this.boot.position.set(0.1, -0.78 + out * 0.38, -0.55 - out * 0.35);
            this.boot.rotation.set(-0.9 + out * 0.5, 0.2, 0.1);
            this.rig.position.y -= out * 0.15;
        } else this.boot.visible = false;
        // light the hands and gun from the room
        const k = 0.5 + Math.min(2, light[0] + light[1] + light[2]) * 0.5;
        this.hemi.intensity = 0.6 * k;
        this.key.intensity = 1.0 * k;
        this.hemi.color.setRGB(0.4 + light[0] * 0.3, 0.35 + light[1] * 0.3, 0.6 + light[2] * 0.3);
    }
}

function flashTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,220,150,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    x.fillStyle = g;
    x.beginPath();
    for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, r = k % 2 ? 12 : 32;
        x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
}
