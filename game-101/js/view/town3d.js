// The town square at night: eight buildings in a ring around a fountain. The camera stands in the
// middle and turns to face whichever place is selected.

import * as THREE from 'three';
import { Pix } from './pix.js';
import { hash3 } from '../rng.js';
import { npcCanvas } from './sprites.js';

export const PLACES = [
    { id: 'dungeon', name: 'The Descent', sign: 'DUNGEON', wall: 8, roof: 0, accent: 12 },
    { id: 'guild', name: "Adventurers' Guild", sign: 'GUILD', wall: 6, roof: 4, accent: 14 },
    { id: 'items', name: 'Item Shop', sign: 'ITEMS', wall: 7, roof: 2, accent: 10 },
    { id: 'smith', name: 'Weaponsmith', sign: 'SMITHY', wall: 8, roof: 7, accent: 12 },
    { id: 'magic', name: 'Magic Emporium', sign: 'MAGIC', wall: 5, roof: 1, accent: 13 },
    { id: 'church', name: 'Church', sign: 'CHURCH', wall: 15, roof: 9, accent: 14 },
    { id: 'tavern', name: 'Hearth & Hound Tavern', sign: 'TAVERN', wall: 6, roof: 4, accent: 14 },
    { id: 'inn', name: 'The Inn', sign: 'INN', wall: 7, roof: 6, accent: 11 },
];
const R = 8.2;
const nearest = (tex) => { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; return tex; };

function wallTex(c, trim) {
    const p = new Pix(32, 32);
    p.rect(0, 0, 32, 32, c);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (hash3(x, y, c) < 0.1) p.px(x, y, c === 0 ? 8 : 8);
    for (let i = 0; i < 4; i++) p.rect(0, i * 8, 32, 1, 8);
    p.rect(0, 0, 2, 32, trim === 14 ? 6 : 0); p.rect(30, 0, 2, 32, trim === 14 ? 6 : 0);
    return nearest(new THREE.CanvasTexture(p.canvas));
}
function roofTex(c) {
    const p = new Pix(32, 32);
    p.rect(0, 0, 32, 32, c);
    for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < 32; x += 8) { p.rect(x, y, 7, 3, c); p.rect(x, y + 3, 8, 1, c === 0 ? 8 : 0); }
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (hash3(x, y, 77 + c) < 0.07) p.px(x, y, c === 0 ? 8 : 15 === c ? 7 : 0);
    return nearest(new THREE.CanvasTexture(p.canvas));
}
function signTex(text, bg, fg) {
    const p = new Pix(64, 16);
    p.rect(0, 0, 64, 16, 6); p.rect(1, 1, 62, 14, bg); p.rect(2, 2, 60, 12, bg === 0 ? 8 : bg);
    p.rect(2, 2, 60, 12, bg);
    const w = text.length * 6;
    p.text(text, Math.max(2, (64 - w) / 2), 2, fg, 10, true);
    return nearest(new THREE.CanvasTexture(p.canvas));
}
function cobbleTex() {
    const p = new Pix(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const bx = ((x + ((y >> 3) & 1) * 4) >> 3), c = hash3(bx, y >> 3, 3) < 0.5 ? 8 : 0;
        p.px(x, y, ((x + ((y >> 3) & 1) * 4) % 8 === 0 || y % 8 === 0) ? 0 : hash3(x, y, 1) < 0.15 ? 7 : c === 0 ? 8 : 8);
    }
    const t = nearest(new THREE.CanvasTexture(p.canvas));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(26, 26);
    return t;
}
function glowTex(c, r = 8) {
    const p = new Pix(16, 16);
    p.ell(8, 8, r, r, c); p.ell(8, 8, r * 0.5, r * 0.5, 15);
    return nearest(new THREE.CanvasTexture(p.canvas));
}

export class TownScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 7, 24);
        this.camera = new THREE.PerspectiveCamera(60, 320 / 200, 0.1, 80);
        this.camera.position.set(0, 1.25, 0);
        this.yaw = 0; this.yawT = 0; this.sel = 0;
        this.flames = [];

        const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ map: cobbleTex(), fog: true }));
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // stars and moon
        const sp = [];
        for (let i = 0; i < 160; i++) {
            const a = hash3(i, 1, 9) * Math.PI * 2, e = 0.12 + hash3(i, 2, 9) * 1.2;
            sp.push(Math.sin(a) * Math.cos(e) * 60, Math.sin(e) * 60, -Math.cos(a) * Math.cos(e) * 60);
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
        this.scene.add(this.stars);
        const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(15, 7), fog: false, transparent: true }));
        moon.scale.set(6, 6, 1); moon.position.set(-26, 28, -38);
        this.scene.add(moon);

        // fountain
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0x555555 }));
        basin.position.y = 0.25; this.scene.add(basin);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0x55ffff }));
        water.position.y = 0.52; this.scene.add(water);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
        col.position.y = 0.9; this.scene.add(col);
        this.spray = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(11, 6), transparent: true }));
        this.spray.scale.set(0.7, 0.7, 1); this.spray.position.y = 1.6; this.scene.add(this.spray);

        PLACES.forEach((pl, i) => this.addBuilding(pl, i));
        // lamps between buildings
        for (let i = 0; i < 8; i++) {
            const a = (i + 0.5) * Math.PI / 4;
            const x = Math.sin(a) * 5.6, z = -Math.cos(a) * 5.6;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5), new THREE.MeshBasicMaterial({ color: 0x555555 }));
            post.position.set(x, 0.8, z); this.scene.add(post);
            const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(14, 7), transparent: true, depthWrite: false }));
            gl.scale.set(0.7, 0.7, 1); gl.position.set(x, 1.7, z); this.scene.add(gl);
            this.flames.push(gl);
        }
        // townsfolk
        this.folk = [];
        for (let i = 0; i < 4; i++) {
            const kinds = ['merchant', 'hermit', 'gambler', 'healer'];
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: nearest(new THREE.CanvasTexture(npcCanvas(kinds[i], i + 3))), transparent: true, alphaTest: 0.4 }));
            s.scale.set(0.75, 0.95, 1);
            this.scene.add(s);
            this.folk.push({ s, a: i * 1.6 + 0.4, r: 4.4 + i * 0.35, v: (i % 2 ? 1 : -1) * (0.05 + i * 0.012) });
        }
    }

    addBuilding(pl, i) {
        const g = new THREE.Group();
        const phi = i * Math.PI / 4;
        g.position.set(Math.sin(phi) * R, 0, -Math.cos(phi) * R);
        g.rotation.y = -phi;
        const M = (map) => new THREE.MeshBasicMaterial({ map, fog: true });
        if (pl.id === 'dungeon') {
            const mound = new THREE.Mesh(new THREE.SphereGeometry(3.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(wallTex(8, 7)));
            mound.scale.set(1.3, 0.9, 1); g.add(mound);
            const arch = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.1), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            arch.position.set(0, 1.05, 2.45); g.add(arch);
            for (const sx of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.5), M(wallTex(7, 7))); pil.position.set(sx * 1.0, 1.2, 2.5); g.add(pil); }
            const lin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.5), M(wallTex(7, 7))); lin.position.set(0, 2.45, 2.5); g.add(lin);
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(12, 8), transparent: true, depthWrite: false }));
            glow.scale.set(2.2, 2.2, 1); glow.position.set(0, 0.9, 2.7); g.add(glow); this.flames.push(glow);
            this.addSign(g, pl, 3.1, 2.9);
        } else {
            const w = 4.0, h = 2.3, d = 3.0;
            const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(wallTex(pl.wall, pl.accent)));
            body.material.map.repeat.set(3, 2); body.material.map.wrapS = body.material.map.wrapT = THREE.RepeatWrapping;
            body.position.y = h / 2; g.add(body);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), M(roofTex(pl.roof)));
            roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.78); roof.position.y = h + 0.8; g.add(roof);
            const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), new THREE.MeshBasicMaterial({ color: 0xaa5500 }));
            door.position.set(0, 0.7, d / 2 + 0.02); g.add(door);
            const knob = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffff55 }));
            knob.position.set(0.25, 0.7, d / 2 + 0.03); g.add(knob);
            for (const sx of [-1.35, 1.35]) {
                const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ color: 0xaa5500 }));
                fr.position.set(sx, 1.35, d / 2 + 0.02); g.add(fr);
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ color: 0xffff55 }));
                win.position.set(sx, 1.35, d / 2 + 0.03); g.add(win);
            }
            if (pl.id === 'church') {
                const tw = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 1.2), M(wallTex(15, 7)));
                tw.position.set(0, 2.1, -0.4); g.add(tw);
                const sp = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.8, 4), M(roofTex(9)));
                sp.rotation.y = Math.PI / 4; sp.position.set(0, 5.1, -0.4); g.add(sp);
                const cr1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), new THREE.MeshBasicMaterial({ color: 0xffff55 })); cr1.position.set(0, 6.3, -0.4); g.add(cr1);
                const cr2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffff55 })); cr2.position.set(0, 6.4, -0.4); g.add(cr2);
            }
            if (pl.id === 'smith') {
                const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), M(wallTex(8, 7))); ch.position.set(1.3, 3.2, -0.6); g.add(ch);
                const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(12, 8), transparent: true, depthWrite: false })); gl.scale.set(1.0, 1.0, 1); gl.position.set(1.3, 4.1, -0.6); g.add(gl); this.flames.push(gl);
            }
            if (pl.id === 'magic') {
                const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xff55ff })); st.position.set(0, 4.0, 0); g.add(st); this.star = st;
            }
            if (pl.id === 'tavern' || pl.id === 'inn') {
                for (let k = 0; k < 2; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xaa5500 })); br.position.set(-1.9 + k * 0.6, 0.3, d / 2 + 0.5); g.add(br); }
            }
            this.addSign(g, pl, 2.15, d / 2 + 0.05);
        }
        this.scene.add(g);
    }
    addSign(g, pl, y, z) {
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: signTex(pl.sign, 0, pl.accent) }));
        sg.position.set(0, y, z + 0.06); g.add(sg);
    }

    select(i) {
        const diff = ((i - this.sel + 12) % 8) - 4;
        this.yawT += -(diff * Math.PI / 4);
        this.sel = i;
    }
    update(dt, time) {
        this.yaw += (this.yawT - this.yaw) * Math.min(1, dt * 7);
        this.camera.rotation.set(-0.04, this.yaw + Math.sin(time * 0.3) * 0.035, 0);
        this.camera.position.y = 1.25 + Math.sin(time * 0.7) * 0.015;
        this.flames.forEach((f, i) => { const k = 0.85 + Math.sin(time * 9 + i * 2.3) * 0.12 + Math.sin(time * 17 + i) * 0.06; f.material.opacity = 0.7 + 0.3 * k; });
        this.spray.position.y = 1.55 + Math.sin(time * 3) * 0.08;
        if (this.star) this.star.rotation.y = time;
        for (const f of this.folk) {
            f.a += f.v * dt;
            f.s.position.set(Math.sin(f.a) * f.r, 0.47, -Math.cos(f.a) * f.r);
        }
    }
}
