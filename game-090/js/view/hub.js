// Arbor Station: the rooftop greenhouse where the Wardens live, over the ruins of Meridian City.
// One diorama with a station for each thing to do (briefing table, splice pod, market stall,
// lounge, infirmary), the party standing about, a skyline of drowned towers, and a camera that
// moves between them. The title screen and every hub-side cutscene use it as a backdrop.

import * as THREE from 'three';
import { TEX, dotTexture } from './tex.js';
import { TOON, toonMat, K, merge, part, glow } from './toon.js';
import { buildCast } from './humans.js';
import { buildDaemon } from './daemons3d.js';
import { hash3 } from '../rng.js';
import { Motes } from './env.js';
import { DAEMONS } from '../sim/data/daemons.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PRESETS = {
    overview: { pos: [0, 9.5, 17], look: [0, 1.6, -1] },
    title: { pos: [-8, 5.5, 13], look: [4, 5, -30] },
    briefing: { pos: [2.2, 3.6, -0.5], look: [0, 1.6, -6] },
    greenhouse: { pos: [-1, 3.4, 1.5], look: [-7, 1.6, -0.5] },
    market: { pos: [1.5, 3.4, 2.2], look: [7, 1.6, 0] },
    lounge: { pos: [1, 3.2, 8.5], look: [5.5, 1.3, 5] },
    infirmary: { pos: [-1, 3.2, 8.5], look: [-5.5, 1.3, 5] },
    talk: { pos: [0, 2.6, 6], look: [0, 1.8, -2] },
};
export const STATIONS = {
    dov: [0, 0, -7.5, 0], maple: [-8, 0, -1, Math.PI / 2], quill: [8, 0, 0.5, -Math.PI / 2], wren: [5.5, 0, 5.5, Math.PI + 0.5], ilsa: [-4, 0, 7.5, Math.PI - 0.3],
};
const MOON = [0.12, 0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35];

export class HubView {
    constructor(quality = 2) {
        this.quality = quality;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(46, 1.6, 0.3, 400);
        this.cam = { pos: V3(0, 9.5, 17), look: V3(0, 1.6, -1), pp: V3(0, 9.5, 17), pl: V3(0, 1.6, -1), speed: 2.2 };
        this.mode = 'overview';
        this.t = 0;
        this.people = {};
        this.partyModels = [];
        this.partyKey = '';
        this.speaker = null;
        this.orbit = 0;
        this.build();
    }

    build() {
        const sc = this.scene;
        sc.fog = new THREE.Fog('#7a8aa8', 40, 220);
        sc.background = new THREE.Color('#7a8aa8');
        // --- sky: dawn gradient and a low sun
        const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 20, 12), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color('#2a3a7a') }, uMid: { value: new THREE.Color('#ff9a7a') }, uBot: { value: new THREE.Color('#ffd8a0') } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(uBot, uMid, smoothstep(-0.05, 0.25, h)); c = mix(c, uTop, smoothstep(0.2, 0.8, h)); gl_FragColor = vec4(c, 1.0); }',
        }));
        this.sky = sky; sc.add(sky);
        const sun = glow(new THREE.CircleGeometry(16, 28), '#fff0c0', { opacity: 0.9, p: [-80, 28, -200] }); sun.lookAt(0, 0, 0); sc.add(sun);
        this.sun = sun;
        this.moon = glow(new THREE.CircleGeometry(7, 24), '#e8f0ff', { opacity: 0.0, p: [90, 70, -180] }); this.moon.lookAt(0, 0, 0); sc.add(this.moon);
        // --- lights
        this.hemi = new THREE.HemisphereLight('#ffe0c0', '#2a3a2a', 1.3); sc.add(this.hemi);
        this.key = new THREE.DirectionalLight('#ffd0a0', 2.4); this.key.position.set(-24, 22, 14);
        this.key.castShadow = this.quality > 0; this.key.shadow.mapSize.set(2048, 2048);
        const s = this.key.shadow.camera; s.left = -20; s.right = 20; s.top = 20; s.bottom = -20; s.far = 90; this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.04;
        sc.add(this.key);
        // --- the deck
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.6, 0.8, 40), toonMat({ map: TEX.wood('#8a6a4a', 3), color: 0xffffff }));
        deck.position.y = -0.4; deck.receiveShadow = true; deck.material.map.repeat.set(10, 1); sc.add(deck);
        const inner = new THREE.Mesh(new THREE.CircleGeometry(9, 36), toonMat({ map: TEX.grass('#4a7a4a', '#8ad05a', 9), color: 0xffffff }));
        inner.rotation.x = -Math.PI / 2; inner.position.y = 0.012; inner.material.map.repeat.set(14, 14); inner.receiveShadow = true; sc.add(inner);
        // path rings
        const pathRing = glow(new THREE.TorusGeometry(9, 0.05, 6, 64), '#7affd0', { p: [0, 0.05, 0], opacity: 0.7 }); pathRing.rotation.x = Math.PI / 2; sc.add(pathRing);
        // railing
        const rail = new THREE.InstancedMesh(merge([K.box(0.14, 1.1, 0.14, { c: '#c8c0b0', p: [0, 0.55, 0] }), K.box(2.5, 0.08, 0.1, { c: '#e8e0d0', p: [1.2, 1.08, 0] })]), toonMat({ vertexColors: true }), 32);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; m4.compose(V3(Math.cos(a) * 13.8, 0, Math.sin(a) * 13.8), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), -a - Math.PI / 2 + 0.098), V3(1, 1, 1)); rail.setMatrixAt(i, m4); }
        sc.add(rail);
        this.dome = new THREE.Group();
        // --- vegetation: bushes, tomato vines and flowers in the planter beds
        const bushGeo = merge([K.sph(0.9, { c: '#2f7a3a', g: '#6ac04a', p: [0, 0.5, 0] }), K.sph(0.6, { c: '#3a8a3a', p: [0.7, 0.35, 0.2] }), K.sph(0.15, { c: '#ff6a5a', p: [0.3, 0.9, 0.5] }), K.sph(0.13, { c: '#ffd84a', p: [-0.4, 0.8, 0.4] })]);
        const bushes = new THREE.InstancedMesh(bushGeo, toonMat({ vertexColors: true }), 64);
        let bi = 0;
        for (let i = 0; i < 64; i++) {
            const a = hash3(i, 1, 40) * 6.283, r = 10 + hash3(i, 2, 40) * 3.2;
            m4.compose(V3(Math.cos(a) * r, 0, Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), hash3(i, 3, 40) * 6), V3(0.8 + hash3(i, 4, 40) * 0.9, 0.8 + hash3(i, 5, 40) * 0.8, 0.8 + hash3(i, 4, 40) * 0.9));
            bushes.setMatrixAt(bi++, m4);
        }
        sc.add(bushes);
        // --- stations
        this.stations = {};
        this.buildBriefing(); this.buildPod(); this.buildMarket(); this.buildLounge(); this.buildInfirmary();
        // --- the skyline over the water of mist
        this.buildSkyline();
        // --- people
        for (const [id, st] of Object.entries(STATIONS)) {
            const h = buildCast(id, { weapon: id === 'ilsa' });
            if (!h) continue;
            h.root.position.set(st[0], st[1], st[2]); h.root.rotation.y = st[3];
            sc.add(h.root);
            this.people[id] = h;
        }
        this.motes = new Motes(120, '#fff4c0', 'spores'); sc.add(this.motes.points);
        // the Spire in the far distance: a pulsing magenta needle
        this.spireGlow = glow(new THREE.CylinderGeometry(1.5, 3, 160, 6), '#ff4ad8', { p: [60, 80, -230], opacity: 0.55 }); sc.add(this.spireGlow);
        const light = new THREE.PointLight('#ff4ad8', 0, 100, 1.2); light.position.set(60, 40, -200); sc.add(light);
    }

    buildBriefing() {
        const g = new THREE.Group(); g.position.set(0, 0, -6);
        g.add(part(merge([K.cyl(2.0, 2.2, 0.8, { c: '#3a4a44', g: '#2a3a34', p: [0, 0.4, 0] }, 12), K.cyl(2.3, 2.3, 0.12, { c: '#5a6a60', p: [0, 0.86, 0] }, 12)]), { outline: 0.03 }));
        const holo = new THREE.Group(); holo.position.y = 1.4;
        const disc = glow(new THREE.CircleGeometry(1.7, 6), '#7affd0', { opacity: 0.25, side: THREE.DoubleSide }); disc.rotation.x = -Math.PI / 2;
        holo.add(disc);
        const towers = [];
        for (let i = 0; i < 9; i++) { const t = glow(new THREE.BoxGeometry(0.16, 0.2 + hash3(i, 1, 4) * 0.8, 0.16), i === 3 ? '#ff4ad8' : '#7affd0', { opacity: 0.8, p: [Math.cos(i * 0.7) * (0.3 + i * 0.13), 0.2, Math.sin(i * 0.7) * (0.3 + i * 0.13)] }); holo.add(t); towers.push(t); }
        g.add(holo);
        const l = new THREE.PointLight('#7affd0', 8, 10, 1.6); l.position.y = 2; g.add(l);
        this.scene.add(g);
        this.stations.briefing = { g, update: (t) => { holo.rotation.y = t * 0.3; disc.material.opacity = 0.2 + Math.sin(t * 2) * 0.05; towers.forEach((m, i) => { m.scale.y = 1 + Math.sin(t * 2 + i) * 0.2; }); } };
    }
    buildPod() {
        const g = new THREE.Group(); g.position.set(-7.5, 0, -2);
        g.add(part(merge([K.cyl(1.4, 1.6, 0.5, { c: '#4a5a4a', p: [0, 0.25, 0] }, 10), K.cyl(0.9, 1.2, 0.35, { c: '#6a7a60', p: [0, 0.65, 0] }, 10)]), { outline: 0.03 }));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.4, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#9dffb0', transparent: true, opacity: 0.2, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
        glass.position.y = 2.0; g.add(glass);
        const core = glow(new THREE.SphereGeometry(0.4, 12, 10), '#bfffcc', { p: [0, 1.8, 0] }); g.add(core);
        const seeds = [];
        for (let i = 0; i < 10; i++) { const s = glow(new THREE.SphereGeometry(0.07, 6, 5), i % 2 ? '#fff0a0' : '#9dffb0'); g.add(s); seeds.push(s); }
        g.add(part(K.cone(0.9, 0.3, { c: '#3a8a4a', p: [0, 3.35, 0], r: [Math.PI, 0, 0] }, 12), { outline: 0.02 }));
        const l = new THREE.PointLight('#9dffb0', 12, 12, 1.5); l.position.y = 2; g.add(l);
        this.scene.add(g);
        this.stations.pod = { g, update: (t) => { core.scale.setScalar(1 + Math.sin(t * 2) * 0.1); seeds.forEach((s, i) => { const a = t * (0.7 + i * 0.05) + i; s.position.set(Math.cos(a) * 0.55, 1.1 + ((t * 0.3 + i * 0.1) % 1) * 1.8, Math.sin(a) * 0.55); }); } };
    }
    buildMarket() {
        const g = new THREE.Group(); g.position.set(8, 0, 2.5); g.rotation.y = -Math.PI / 2 + 0.2;
        const stripes = [];
        for (let i = 0; i < 7; i++) stripes.push(K.box(0.62, 0.08, 2.4, { c: i % 2 ? '#f4ecd8' : '#d8483a', p: [-1.9 + i * 0.63, 2.6 - Math.abs(i - 3) * 0.02, 0.1], r: [0.18, 0, 0] }));
        g.add(part(merge([K.box(4.6, 0.9, 1.4, { c: '#7a5a3a', g: '#5a4028', p: [0, 0.45, 0] }), K.box(4.8, 0.1, 1.6, { c: '#9a7a4a', p: [0, 0.95, 0] }), K.box(0.12, 2.6, 0.12, { c: '#4a3a28', p: [-2.2, 1.3, -0.5] }), K.box(0.12, 2.6, 0.12, { c: '#4a3a28', p: [2.2, 1.3, -0.5] }), ...stripes,
            K.box(0.5, 0.4, 0.5, { c: '#a8742a', p: [-1.4, 1.2, 0] }), K.box(0.4, 0.3, 0.4, { c: '#6a4a2a', p: [-0.9, 1.15, 0.1] }), K.sph(0.2, { c: '#e0482a', p: [0.4, 1.12, 0] }), K.sph(0.2, { c: '#ffd84a', p: [0.8, 1.12, 0.1] }), K.sph(0.18, { c: '#9ad84a', p: [1.2, 1.1, -0.1] })]), { outline: 0.03 }));
        const bulbs = [];
        for (let i = 0; i < 7; i++) { const b = glow(new THREE.SphereGeometry(0.09, 6, 5), i % 2 ? '#ffd86a' : '#ff9a6a', { p: [-2.1 + i * 0.7, 2.35, 0.9] }); g.add(b); bulbs.push(b); }
        const l = new THREE.PointLight('#ffb060', 9, 11, 1.5); l.position.set(0, 2, 1); g.add(l);
        this.scene.add(g);
        this.stations.market = { g, update: (t) => { bulbs.forEach((b, i) => { b.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.2); }); } };
    }
    buildLounge() {
        const g = new THREE.Group(); g.position.set(6.5, 0, 6.5); g.rotation.y = -2.2;
        g.add(part(merge([K.box(2.8, 0.45, 1.0, { c: '#7a3a5a', g: '#a8527a', p: [0, 0.3, 0] }), K.box(2.8, 0.8, 0.3, { c: '#6a2a4a', p: [0, 0.7, -0.45] }), K.box(0.3, 0.7, 1.0, { c: '#6a2a4a', p: [-1.4, 0.45, 0] }), K.box(0.3, 0.7, 1.0, { c: '#6a2a4a', p: [1.4, 0.45, 0] }), K.cyl(0.5, 0.5, 0.45, { c: '#5a4a3a', p: [0, 0.22, 1.4] }, 10), K.cyl(0.14, 0.1, 0.25, { c: '#f4ecd8', p: [0.1, 0.55, 1.4] })]), { outline: 0.03 }));
        const strings = [];
        for (let i = 0; i < 9; i++) { const b = glow(new THREE.SphereGeometry(0.07, 6, 5), ['#ff9ad8', '#9affd8', '#ffe27a'][i % 3], { p: [-2 + i * 0.5, 2.5 - Math.sin((i / 8) * Math.PI) * 0.35, 0.2] }); g.add(b); strings.push(b); }
        const l = new THREE.PointLight('#ff9ad8', 7, 9, 1.6); l.position.set(0, 2, 0.6); g.add(l);
        this.scene.add(g);
        this.stations.lounge = { g, update: (t) => { strings.forEach((b, i) => b.scale.setScalar(1 + Math.sin(t * 2.5 + i * 0.8) * 0.25)); } };
    }
    buildInfirmary() {
        const g = new THREE.Group(); g.position.set(-5.5, 0, 6.5); g.rotation.y = 2.4;
        g.add(part(merge([K.box(2.2, 0.35, 1.0, { c: '#e8f0ec', p: [0, 0.5, 0] }), K.box(2.4, 0.3, 1.1, { c: '#8aa098', p: [0, 0.18, 0] }), K.box(0.5, 0.2, 0.9, { c: '#f8fcff', p: [-0.8, 0.78, 0] }), K.box(0.22, 1.5, 0.22, { c: '#c8d0d0', p: [1.3, 0.75, -0.6] })]), { outline: 0.03 }));
        const cross = new THREE.Group(); cross.position.set(0, 2.2, -0.6);
        cross.add(glow(new THREE.BoxGeometry(0.9, 0.28, 0.06), '#9dffb0'), glow(new THREE.BoxGeometry(0.28, 0.9, 0.06), '#9dffb0'));
        g.add(cross);
        const l = new THREE.PointLight('#9dffb0', 6, 9, 1.6); l.position.set(0, 2.2, 0.4); g.add(l);
        this.scene.add(g);
        this.stations.infirmary = { g, update: (t) => { cross.rotation.y = Math.sin(t * 0.8) * 0.5; } };
    }
    buildSkyline() {
        const geo = merge([K.box(1, 1, 1, { c: '#586070', g: '#788090', p: [0, 0.5, 0] }), K.box(1.04, 0.05, 1.04, { c: '#4a8a4a', p: [0, 1.0, 0] })]);
        const n = 90;
        const im = new THREE.InstancedMesh(geo, toonMat({ vertexColors: true, emissive: 0x151a24 }), n);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
            const a = hash3(i, 1, 90) * 6.283, r = 60 + hash3(i, 2, 90) * 120;
            const w = 6 + hash3(i, 3, 90) * 14, hgt = 20 + hash3(i, 4, 90) * 80 * (1 - r / 260);
            m4.compose(V3(Math.cos(a) * r, -4, Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), hash3(i, 5, 90) * 3), V3(w, hgt, w * (0.7 + hash3(i, 6, 90) * 0.6)));
            im.setMatrixAt(i, m4);
        }
        this.scene.add(im);
        // a drowned-street mist
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: '#cfd8e8', transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
        mist.rotation.x = -Math.PI / 2; mist.position.y = -3; this.scene.add(mist);
    }

    // ------------------------------------------------------------ control
    preset(name) {
        const p = PRESETS[name] || PRESETS.overview;
        this.mode = name;
        this.cam.pos.set(...p.pos); this.cam.look.set(...p.look);
        this.cam.speed = name === 'title' ? 0.8 : 2.4;
    }
    snap() { this.cam.pp.copy(this.cam.pos); this.cam.pl.copy(this.cam.look); }

    setTide(i) {
        const b = MOON[i % 8];
        this.moon.material.opacity = 0.15 + b * 0.55;
        this.moon.scale.setScalar(0.6 + b * 0.6);
        const dark = i === 0;
        this.sky.material.uniforms.uTop.value.set(dark ? '#0a1030' : '#2a3a7a');
        this.sky.material.uniforms.uMid.value.set(dark ? '#4a3a6a' : '#ff9a7a');
        this.sky.material.uniforms.uBot.value.set(dark ? '#8a6a8a' : '#ffd8a0');
        this.hemi.intensity = dark ? 0.9 : 1.3;
        this.key.intensity = dark ? 1.4 : 2.4;
        this.key.color.set(dark ? '#a0a8ff' : '#ffd0a0');
        this.scene.background.set(dark ? '#4a4a7a' : '#7a8aa8'); this.scene.fog.color.set(dark ? '#4a4a7a' : '#7a8aa8');
    }

    /** The daemons standing about the deck: the party, and a few from the stock if the party is thin. */
    syncParty(G) {
        const key = G.party.map((uid) => G.stock.find((u) => u.uid === uid)?.sp).join(',');
        if (key === this.partyKey) return;
        this.partyKey = key;
        for (const m of this.partyModels) this.scene.remove(m.root);
        this.partyModels = [];
        const ids = G.party.map((uid) => G.stock.find((u) => u.uid === uid)?.sp).filter(Boolean);
        ids.forEach((sp, i) => {
            const m = buildDaemon(sp);
            const a = -0.9 + i * 0.9;
            m.root.position.set(Math.sin(a) * 4.2, 0, 2.5 + Math.cos(a) * 1.2);
            m.home = m.root.position.clone();
            m.root.rotation.y = a * 0.6 + 0.3;
            this.scene.add(m.root);
            this.partyModels.push(m);
        });
    }

    update(dt, t, G) {
        this.t = t;
        TOON.uTime.value = t;
        for (const s of Object.values(this.stations)) s.update(t);
        for (const [id, h] of Object.entries(this.people)) {
            const talking = this.speaker === id;
            h.pose({ talk: talking }, t + id.length);
            if (talking) { const st = STATIONS[id]; h.root.rotation.y += (Math.atan2(this.camera.position.x - h.root.position.x, this.camera.position.z - h.root.position.z) - h.root.rotation.y) * Math.min(1, dt * 4); }
        }
        for (const m of this.partyModels) { m.pose({ move: 0 }, t); }
        if (this.mode === 'title') {
            this.orbit += dt * 0.05;
            this.cam.pos.set(Math.sin(this.orbit) * 14 - 4, 5 + Math.sin(this.orbit * 0.8) * 0.8, 12 + Math.cos(this.orbit) * 3);
            this.cam.look.set(6, 6.5, -40);
        }
        const k = Math.min(1, dt * this.cam.speed);
        this.cam.pp.lerp(this.cam.pos, k); this.cam.pl.lerp(this.cam.look, k);
        this.camera.position.copy(this.cam.pp);
        this.camera.lookAt(this.cam.pl);
        this.motes.update(t, V3(0, 0, 0));
        this.spireGlow.material.opacity = 0.35 + Math.sin(t * 1.2) * 0.12;
        this.dome.rotation.y = Math.sin(t * 0.05) * 0.02;
    }
}
