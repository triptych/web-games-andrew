/**
 * garage.js — Halloway's Garage, the hub: a workshop with a turntable for your car, a pegboard of
 * tools, tyre racks, a workbench, hanging lamps, Grandpa's trophy shelf (with an empty spot for the
 * Dirt Crown, filled when you win it), a neon sign and a roll-up door open on the dusty evening.
 * It is its own THREE.Scene; main.js renders it instead of the race scene while you are in the hub.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvas, bannerTexture } from './textures.js';
import { CarModel } from './carmodel.js';

function concreteTex() {
    const { c, g } = canvas(512, 512);
    g.fillStyle = '#6a6660';
    g.fillRect(0, 0, 512, 512);
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '40,38,34' : '140,136,128'},${0.08 + rnd() * 0.1})`; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let i = 0; i < 9; i++) {
        const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 80;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(20,16,10,0.35)'); gr.addColorStop(1, 'rgba(20,16,10,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(30,28,26,0.6)'; g.lineWidth = 2;
    g.strokeRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
}

function pegboardTex() {
    const { c, g } = canvas(512, 256);
    g.fillStyle = '#a8865a';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(40,28,14,0.7)';
    for (let y = 8; y < 256; y += 16) for (let x = 8; x < 512; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
    // Tool silhouettes.
    const tools = [[60, 70, 'wrench'], [120, 60, 'hammer'], [190, 80, 'saw'], [300, 70, 'wrench'], [360, 90, 'screw'], [420, 60, 'hammer'], [470, 80, 'screw']];
    for (const [x, y, k] of tools) {
        g.save(); g.translate(x, y);
        g.fillStyle = k === 'saw' ? '#c8ccd2' : '#5a5e66';
        if (k === 'wrench') { g.fillRect(-5, 0, 10, 90); g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.fillStyle = '#a8865a'; g.fillRect(-5, -14, 10, 12); }
        if (k === 'hammer') { g.fillStyle = '#8a5a2a'; g.fillRect(-4, 0, 8, 80); g.fillStyle = '#4a4e56'; g.fillRect(-20, -6, 40, 16); }
        if (k === 'saw') { g.beginPath(); g.moveTo(-10, 0); g.lineTo(30, 100); g.lineTo(-10, 100); g.fill(); g.fillStyle = '#c0392b'; g.fillRect(-16, -14, 22, 26); }
        if (k === 'screw') { g.fillStyle = '#e8b33a'; g.fillRect(-7, 0, 14, 36); g.fillStyle = '#c8ccd2'; g.fillRect(-2, 36, 4, 50); }
        g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function photoTex() {
    const { c, g } = canvas(256, 200);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 256, 200);
    const gr = g.createLinearGradient(0, 0, 0, 200);
    gr.addColorStop(0, '#c8a878'); gr.addColorStop(1, '#8a6a48');
    g.fillStyle = gr; g.fillRect(14, 14, 228, 150);
    // A sepia race car and a young driver holding a cup.
    g.fillStyle = '#4a3420'; g.fillRect(40, 110, 110, 30); g.fillRect(70, 92, 50, 20);
    g.beginPath(); g.arc(62, 142, 13, 0, 7); g.arc(128, 142, 13, 0, 7); g.fill();
    g.fillRect(170, 80, 18, 60); g.beginPath(); g.arc(179, 70, 12, 0, 7); g.fill();
    g.fillStyle = '#d8b050'; g.fillRect(190, 52, 18, 16); g.fillRect(196, 68, 6, 10);
    g.fillStyle = '#3a2a1a'; g.font = 'italic 16px Georgia, serif'; g.textAlign = 'center';
    g.fillText('Gus — Dirt Crown runner-up, 1996', 128, 188);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Garage {
    constructor(renderer) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x15110e);
        this.scene.fog = new THREE.Fog(0x15110e, 18, 40);
        const pm = new THREE.PMREMGenerator(renderer);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.45;
        pm.dispose();
        const S = this.scene;

        S.add(new THREE.HemisphereLight(0xffe6c8, 0x2a2018, 0.7));
        const key = new THREE.SpotLight(0xffe2b8, 120, 30, 0.75, 0.5, 1.6);
        key.position.set(2.5, 8, 4);
        key.target.position.set(0, 0, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.bias = -0.0005;
        S.add(key, key.target);
        const rim = new THREE.SpotLight(0x8ab8ff, 40, 30, 0.8, 0.6, 1.6);
        rim.position.set(-5, 5, -6);
        S.add(rim, rim.target);
        const neonLight = new THREE.PointLight(0xff4a6a, 12, 14, 1.6);
        neonLight.position.set(0, 4.6, -6.5);
        S.add(neonLight);

        const concrete = concreteTex();
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.75, metalness: 0.05 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        S.add(floor);
        const wallM = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallM);
        back.position.set(0, 5, -7.5);
        S.add(back);
        for (const s of [-1, 1]) {
            const side = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), wallM);
            side.position.set(s * 9, 5, 4.5);
            side.rotation.y = -s * Math.PI / 2;
            S.add(side);
        }
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = 8;
        S.add(ceil);
        // Roof beams.
        const beamM = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
        for (let x = -8; x <= 8; x += 4) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 24), beamM); b.position.set(x, 7.7, 2); S.add(b); }

        // Turntable.
        const tt = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.4, metalness: 0.7 }));
        tt.position.y = 0.09;
        tt.receiveShadow = true;
        S.add(tt);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.19;
        S.add(ring);
        this.turntable = new THREE.Group();
        this.turntable.position.y = 0.18;
        S.add(this.turntable);

        // Pegboard and workbench along the back wall.
        const peg = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.9 }));
        peg.position.set(-3.6, 3.6, -7.45);
        S.add(peg);
        const benchM = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.8 });
        const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 1.4), benchM);
        bench.position.set(-3.6, 1.1, -6.7);
        bench.castShadow = bench.receiveShadow = true;
        S.add(bench);
        for (const x of [-7.3, 0]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 1.2), benchM); l.position.set(x, 0.55, -6.7); S.add(l); }
        // A vice, a lamp and a coffee can on the bench.
        const vice = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0x2f6be0, roughness: 0.4, metalness: 0.5 }));
        vice.position.set(-6.4, 1.38, -6.5);
        S.add(vice);
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 12), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.4 }));
        can.position.set(-1.2, 1.38, -6.4);
        S.add(can);

        // Tyre rack on the right wall.
        const tireM = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
        for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
            const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.18, 8, 18), tireM);
            t.position.set(8.4, 0.8 + r * 1.2, -4 + k * 1.1);
            t.rotation.y = Math.PI / 2;
            S.add(t);
        }
        // Rolling toolbox.
        const tb = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.4, 0.8, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.35, metalness: 0.4 }));
        tb.position.set(6.2, 0.8, -5.8);
        tb.castShadow = true;
        S.add(tb);
        for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 1, roughness: 0.2 })); d.position.set(6.2, 0.4 + k * 0.3, -5.39); S.add(d); }

        // Trophy shelf with Grandpa's cups and an empty spot for the Crown.
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 0.7), benchM);
        shelf.position.set(4.2, 3.4, -7.1);
        S.add(shelf);
        const goldM = new THREE.MeshStandardMaterial({ color: 0xe8b33a, roughness: 0.25, metalness: 1 });
        const silverM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 });
        const cup = (x, m, s = 1) => {
            const g = new THREE.Group();
            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.1 * s, 0.35 * s, 14), m); bowl.position.y = 0.42 * s;
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.2 * s, 8), m); stem.position.y = 0.15 * s;
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.08 * s, 0.28 * s), new THREE.MeshStandardMaterial({ color: 0x2a1a10 })); base.position.y = 0.04 * s;
            g.add(bowl, stem, base);
            g.position.set(x, 3.48, -7);
            S.add(g);
            return g;
        };
        cup(2.4, goldM); cup(3.1, silverM, 0.85); cup(3.7, goldM, 0.9);
        this.trophies = [];
        // The empty spot, with a little hand-written card, and the Crown that will fill it.
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: bannerTexture('SOMEDAY', 0xf2e6c8, 0x3a2a1a, 256, 96) }));
        card.position.set(5.4, 3.65, -6.74);
        S.add(card);
        this.crownCard = card;
        const crown = new THREE.Group();
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.25, 16, 1, true), goldM);
        band.material.side = THREE.DoubleSide;
        crown.add(band);
        for (let k = 0; k < 8; k++) {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), goldM);
            const a = (k / 8) * Math.PI * 2;
            sp.position.set(Math.cos(a) * 0.31, 0.22, Math.sin(a) * 0.31);
            crown.add(sp);
            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xd8322a : 0x2f6be0, roughness: 0.1, metalness: 0.3 }));
            gem.position.set(Math.cos(a) * 0.33, 0, Math.sin(a) * 0.33);
            crown.add(gem);
        }
        crown.position.set(5.4, 3.75, -7);
        crown.visible = false;
        S.add(crown);
        this.crown = crown;

        // Old photograph of Gus.
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.17), new THREE.MeshStandardMaterial({ map: photoTex(), roughness: 0.6 }));
        photo.position.set(4.2, 5.0, -7.44);
        S.add(photo);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.37, 0.05), beamM);
        frame.position.set(4.2, 5.0, -7.48);
        S.add(frame);

        // Neon sign.
        const neon = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: bannerTexture("HALLOWAY'S GARAGE", 0x1a0a10, 0xff5a7a, 1024, 200, 'EST. 1971  ·  DUSTWATER'), toneMapped: false }));
        neon.position.set(0, 6.4, -7.4);
        S.add(neon);
        this.neon = neon;

        // Hanging lamps.
        for (const x of [-4, 0, 4]) {
            const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
            cord.position.set(x, 7.2, 1);
            S.add(cord);
            const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f5a3a, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 }));
            shade.position.set(x, 6.3, 1);
            S.add(shade);
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe6b0, toneMapped: false }));
            bulb.position.set(x, 6.12, 1);
            S.add(bulb);
        }
        // Open roll-up door: dusk outside.
        const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ color: 0xff9a5a, toneMapped: false, fog: false }));
        door.position.set(0, 3, 16);
        door.rotation.y = Math.PI;
        S.add(door);

        this.car = null;
        this.yaw = 0.6;
        this.spin = 0.18;
        this.drag = 0;
    }

    setCar(look) {
        if (this.car) { this.turntable.remove(this.car.root); this.car.dispose(); }
        this.car = new CarModel(look);
        this.car.root.rotation.y = 0;
        this.turntable.add(this.car.root);
        this.car.blob.visible = true;
    }

    setCrown(won) {
        this.crown.visible = !!won;
        this.crownCard.visible = !won;
    }

    update(dt, t, camera, focusRight = 0) {
        if (this.drag === 0) this.turntable.rotation.y += dt * this.spin;
        if (this.car) {
            this.car.spinA = 0;
            for (const w of this.car.wheels) if (w.front) w.hub.rotation.y = Math.sin(t * 0.7) * 0.3;
            if (this.car.fan) this.car.fan.rotation.z += dt * 6;
        }
        this.crown.rotation.y += dt * 0.8;
        // Camera: a slow, low three-quarter view, offset so the car sits clear of the side panel.
        // Narrow (portrait) screens need the camera further back to fit the car's width.
        const asp = camera.aspect || 1;
        const r = 8.2 + (asp < 1 ? (1 - asp) * 9 : 0), h = 2.4 + (asp < 1 ? (1 - asp) * 1.5 : 0);
        const a = this.yaw + Math.sin(t * 0.15) * 0.15;
        camera.position.set(Math.sin(a) * r + focusRight, h + Math.sin(t * 0.2) * 0.15, Math.cos(a) * r);
        camera.lookAt(focusRight, 0.9, 0);
        if (Math.abs(camera.fov - 42) > 0.05) { camera.fov = 42; camera.updateProjectionMatrix(); }
    }
}
