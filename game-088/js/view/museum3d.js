// Puffin Isle: the sea, the island, and the museum with its roof cut away so you can see in.
// Reads G (tasks done, finds owned, staff, decorations) and rebuilds the parts that changed.
// Staff wander their halls, visitors come by ferry and stroll the open galleries, gulls circle.
// Never changes G.

import * as THREE from 'three';
import { Kit, sphere, box, cyl, cone, torus, bumpy, noise3, shade, glowTexture } from './kit.js';
import { buildArtifact } from './artifacts.js';
import { buildSkeleton } from './skeleton.js';
import { buildAnimal, animate, VISITOR_KINDS } from './animals.js';
import * as P from './props.js';
import * as I from './island.js';
import { islandH, FLOOR_Y, DIG_SITES, LIGHTHOUSE, REGIONS } from './island.js';
import { ITEM, ITEMS, DINOS, BONE_PARTS, STAFF, PEOPLE, CHAPTERS } from '../sim/data.js';

const PI = Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Rooms on the plateau. x0..x1, z0..z1 in world units; doors are [wall, position] gaps.
const ROOMS = {
    entrance: { x0: -4, x1: 4, z0: 2, z1: 10, doors: [['s', 0], ['w', 6], ['e', 6], ['n', 0]] },
    ancients: { x0: -13, x1: -4, z0: -1, z1: 10, doors: [['e', 6], ['n', -8.5]] },
    fossils: { x0: 4, x1: 13, z0: -1, z1: 10, doors: [['w', 6], ['n', 8.5]] },
    sea: { x0: -13, x1: -3, z0: -13, z1: -1, doors: [['s', -8.5], ['e', -7]] },
    great: { x0: -3, x1: 13, z0: -14, z1: -1, doors: [['s', 0], ['s', 8.5], ['w', -7]] },
};
const HALL_OPEN_TASK = { entrance: 'cases', ancients: 'plinths', fossils: 'drawers', sea: 'cabinet', great: 'beams' };
const HALL_START_TASK = { entrance: null, ancients: 'vines', fossils: 'unboard', sea: 'glass', great: 'rubble' };

export class MuseumView {
    constructor(stage, hooks) {
        this.stage = stage;
        this.hooks = hooks;
        const scene = this.scene = new THREE.Scene();
        scene.environment = stage.envMap;
        scene.environmentIntensity = 0.4;
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1800);
        scene.fog = new THREE.Fog(0xbfe0ec, 200, 520);
        this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.7);
        scene.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
        sun.position.set(-30, 45, 25);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 260 });
        this.sunDir = new THREE.Vector3(-30, 45, 25).normalize();
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.04;
        scene.add(sun, sun.target);

        this.U = { uTime: { value: 0 } };
        const quality = stage.quality || 'high';
        scene.add(this.sky = I.skyDome(this.U));
        scene.add(this.island = I.terrainMesh(quality));
        scene.add(this.water = I.seaMesh(this.U, I.heightTexture(quality === 'low' ? 192 : 320)));
        scene.add(this.fresh = I.freshWater(this.U));
        scene.add(this.trees = I.plants(quality));
        scene.add(this.landmarks = I.landmarks());
        const lava = I.lava(this.U);
        scene.add(lava);
        this.smoke = new I.Smoke(scene, lava.position.y + 2);

        this.static = new THREE.Group();
        scene.add(this.static);
        this.buildStatic();
        this.dyn = {};                     // name -> group, rebuilt when its key changes
        this.keys = {};
        this.people = new Map();           // staff id -> { a, x, z, tx, tz, room }
        this.visitors = [];
        this.gulls = [];
        // gulls over the cove, and a few birds over the woods
        for (let i = 0; i < 9; i++) { const g = P.gull(); g.userData.ph = i * 1.3; g.userData.home = i < 5 ? [0, 34, 18] : [-80, -100, 26]; scene.add(g); this.gulls.push(g); }
        this.ferry = P.ferry();
        this.ferry.scale.setScalar(1.3);
        scene.add(this.ferry);

        // camera rig: a map camera that pans over the island, turns and zooms
        this.rig = { yaw: 0.55, pitch: 0.8, dist: 46, tx: 0, tz: 1, wantDist: 46, minD: 14, maxD: 260, spin: 0 };
        this.drag = null;
        this.pinch = null;
        this.time = 0;
        this.enabled = false;
        this.ray = new THREE.Raycaster();
        this.bindInput();
        this.G = null;
    }

    // ------------------------------------------------------------------ the parts that never change
    buildStatic() {
        const s = this.static;
        const place = (g, x, z, ry = 0) => { g.position.set(x, islandH(x, z), z); g.rotation.y = ry; s.add(g); return g; };
        this.lighthousePos = LIGHTHOUSE;
        // a few palms on the museum's own lawn
        [[-20, 12], [-17, 16], [20, 12], [17, 17], [-16, -17], [16, -17]].forEach(([x, z], i) => place(P.palm(i, 4 + (i % 3) * 0.8), x, z));
        // the path from the dock to the door
        const path = new Kit();
        for (let i = 0; i < 9; i++) {
            const z = 11 + i * 0.9;
            path.add(bumpy(new THREE.CylinderGeometry(0.55, 0.6, 0.1, 7), 0.03, 4, i), i % 2 ? '#d8cbb0' : '#cfc0a2', 'flat', { p: [Math.sin(i) * 0.25, islandH(0, z) + 0.04, z] });
        }
        s.add(path.build());
        // the plateau's stone foundation under the museum
        const base = new Kit();
        base.add(box(28, 1.2, 26), (x, y) => (y > 0.4 ? '#d9cfbc' : '#b8ad98'), 'flat', { p: [0, FLOOR_Y - 0.6, -2] });
        base.add(box(3, 0.3, 1.2), '#cfc4ae', 'flat', { p: [0, 0.65, 10.8] });
        base.add(box(3, 0.3, 0.8), '#cfc4ae', 'flat', { p: [0, 0.35, 11.6] });
        s.add(base.build());
    }

    // ------------------------------------------------------------------ the parts that change
    /** Rebuild whatever depends on G and changed. Cheap when nothing did. */
    refresh(G) {
        this.G = G;
        const done = (id) => G.tasks.includes(id);
        const owns = (id) => G.items.includes(id);
        this.part('lighthouse', `${G.decor.includes('lighthouse')}`, () => {
            const g = P.lighthouse(G.decor.includes('lighthouse'));
            g.position.set(this.lighthousePos[0], islandH(...this.lighthousePos), this.lighthousePos[1]);
            return g;
        });
        this.part('dock', `${done('dock')}`, () => dock(done('dock')));
        const site = activeSite(G);
        this.part('sites', `${site}|${G.finished}`, () => this.digSites(G));
        for (const [id, room] of Object.entries(ROOMS)) {
            const started = !HALL_START_TASK[id] || done(HALL_START_TASK[id]);
            const open = done(HALL_OPEN_TASK[id]);
            const look = hallLook(id, G);
            this.part('room-' + id, `${started}|${open}|${look.floor}|${look.wall}`, () => roomShell(id, room, look, started, open));
        }
        this.part('entrance-props', ['door', 'sweep', 'roof', 'sign', 'permits', 'open-entrance', 'banners', 'lights', 'grand'].map(done).join(), () => this.entranceProps(G));
        this.part('booth', `${done('booth')}`, () => {
            const g = P.booth(done('booth'));
            g.position.set(6.2, islandH(6.2, 12.5), 12.5);
            g.rotation.y = -0.5;
            return g;
        });
        this.part('mess', ['vines', 'unboard', 'glass', 'rubble', 'floor'].map(done).join(), () => this.mess(G));
        this.part('garden', `${done('garden')}`, () => {
            const g = new THREE.Group();
            if (!done('garden')) { const s = P.sandPile('#cbb894'); s.position.set(0, FLOOR_Y, 0.5); g.add(s); return g; }
            for (const [x, z] of [[-2.6, 0.5], [2.6, 0.5]]) { const f = P.flowerBed(2.2, 1.4, x > 0 ? 3 : 1); f.position.set(x, FLOOR_Y, z); g.add(f); }
            const f = P.fountain(); f.scale.setScalar(0.6); f.position.set(0, FLOOR_Y, 0.5); g.add(f);
            return g;
        });
        const exKey = G.items.join() + '|' + Object.values(HALL_OPEN_TASK).map(done).join() + G.staff.includes('rosa');
        this.part('exhibits', exKey, () => this.exhibits(G));
        this.part('extras', ['lanterns', 'skylight', 'stand', 'mural', 'waves', 'build-trike', 'build-plesio', 'build-trex', 'beams'].map(done).join() + '|' + DINOS.map((d) => BONE_PARTS.filter((p) => owns(`${d.id}-${p}`)).length).join(), () => this.extras(G));
        this.part('decor', G.decor.join(), () => this.decor(G));
        this.syncPeople(G);
    }

    part(name, key, build) {
        if (this.keys[name] === key) return;
        if (this.dyn[name]) this.scene.remove(this.dyn[name]);
        const g = build();
        g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
        this.dyn[name] = g;
        this.keys[name] = key;
        this.scene.add(g);
    }

    entranceProps(G) {
        const done = (id) => G.tasks.includes(id);
        const g = new THREE.Group();
        const add = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
        if (!done('door')) add(P.boards(2.2), 0, FLOOR_Y, 10.1);
        if (!done('sweep')) {
            add(P.sandPile(), -2, FLOOR_Y, 6); add(P.sandPile(), 2.2, FLOOR_Y, 4); add(P.sandPile('#d9be86'), 1, FLOOR_Y, 8.2);
            const web = P.cobweb(); add(web, -3.9, FLOOR_Y + 1.3, 2.1, 0);
        }
        if (!done('roof')) { add(P.scaffold(3.4, 2.6), -2.2, FLOOR_Y, 9.4); }
        if (done('sign')) add(P.sign('CURIO COVE MUSEUM', 5.2, 1.0), 0, FLOOR_Y + 0.6, 10.3);
        else { const s = P.sign('CU IO  OVE M SEUM', 5.2, 1.0, '#6a6a6a', '#bdb6a8'); s.rotation.z = 0.12; add(s, 0.3, FLOOR_Y - 0.4, 11.4, 0.2); }
        if (done('permits')) add(P.desk(), 2.6, FLOOR_Y, 3.4, PI);
        if (done('open-entrance')) add(P.bunting([[-4, FLOOR_Y + 2.4, 10.2], [-1.4, FLOOR_Y + 2.8, 10.6], [1.4, FLOOR_Y + 2.8, 10.6], [4, FLOOR_Y + 2.4, 10.2]], 0.3), 0, 0, 0);
        if (done('banners')) for (const x of [-3.6, 3.6]) add(P.banner(x < 0 ? '#2f5a8a' : '#8a2f4a', 2.6), x, FLOOR_Y, 10.25);
        if (done('lights')) {
            add(P.stringLights([[-4, FLOOR_Y + 2.2, 10.5], [-1.5, 5, 18], [0, 3.5, 26], [1.5, 2.6, 34]], 0.7), 0, 0, 0);
            add(P.stringLights([[4, FLOOR_Y + 2.2, 10.5], [9, 4.5, 14], [-58, 3, 15]], 0.8), 0, 0, 0);
        }
        if (done('grand')) {
            for (let i = 0; i < 6; i++) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshStandardMaterial({ color: ['#ff6b8a', '#ffd93b', '#5bb8ff', '#6bd96b', '#c77dff', '#ff8a3a'][i], roughness: 0.3 }));
                b.position.set(-4.5 + i * 1.8, FLOOR_Y + 3.5 + (i % 2) * 0.6, 10.6);
                b.userData.float = i;
                g.add(b);
            }
        }
        return g;
    }

    /** Clutter in halls not yet started: vines, boards, dark aquarium, rubble. */
    mess(G) {
        const done = (id) => G.tasks.includes(id);
        const g = new THREE.Group();
        const add = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
        if (!done('vines')) { add(P.vines(8, 1.4), -8.5, FLOOR_Y, 10.05); add(P.vines(6, 1.4), -13.05, FLOOR_Y, 4.5, PI / 2); add(P.crate(), -10, FLOOR_Y, 3); add(P.crate('#8a6a42'), -7, FLOOR_Y, 7, 0.4); }
        if (!done('unboard')) { add(P.boards(2), 4.05, FLOOR_Y, 6, PI / 2); add(P.crate(), 9, FLOOR_Y, 4); add(P.crate(), 10, FLOOR_Y, 5, 0.6); add(P.cobweb(), 12.9, FLOOR_Y + 1.3, -0.9, -PI / 2); }
        if (!done('glass')) { add(P.crate('#7a6a52'), -9, FLOOR_Y, -6); add(P.sandPile('#cfc6b0'), -6, FLOOR_Y, -9); add(P.cobweb(), -12.9, FLOOR_Y + 1.3, -12.9, PI / 2); }
        if (!done('rubble')) { add(P.rubble(1), 2, FLOOR_Y, -8); add(P.rubble(4), 8, FLOOR_Y, -10); add(P.rubble(7), 5, FLOOR_Y, -4); add(P.boards(2.2), 0, FLOOR_Y, -1.05); }
        return g;
    }

    /** Every find on show in its hall: cases in the entrance, plinths, drawers and cabinets. */
    exhibits(G) {
        const g = new THREE.Group();
        const done = (id) => G.tasks.includes(id);
        const shown = G.items.filter((id) => done(HALL_OPEN_TASK[ITEM[id].hall]) && ITEM[id].kind !== 'bone');
        const byHall = {};
        for (const id of shown) (byHall[ITEM[id].hall] ||= []).push(id);
        const slots = SLOTS();
        for (const [hall, ids] of Object.entries(byHall)) {
            const all = ITEMS.filter((it) => it.hall === hall && it.kind !== 'bone');
            for (const id of ids) {
                const i = all.findIndex((it) => it.id === id);
                const s = slots[hall][i];
                if (!s) continue;
                const [x, z, ry] = s;
                const base = hall === 'entrance' ? P.plinth(0.75, '#e8e0d0', true) : hall === 'ancients' ? P.plinth(0.9, '#d9cfbc') : hall === 'great' ? P.plinth(0.8, '#c9b48a') : P.plinth(0.6, '#8a5a33');
                base.position.set(x, FLOOR_Y, z);
                base.rotation.y = ry;
                g.add(base);
                const art = buildArtifact(ITEM[id], 0.75);
                const h = (hall === 'entrance' ? 0.75 : hall === 'ancients' ? 0.9 : hall === 'great' ? 0.8 : 0.6) + 0.04;
                art.position.set(x, FLOOR_Y + h + art.userData.h / 2, z);
                art.rotation.y = ry;
                art.userData.spin = true;
                g.add(art);
            }
        }
        if (done('drawers')) { const c = P.cabinet(); c.position.set(12.4, FLOOR_Y, 4.5); c.rotation.y = -PI / 2; g.add(c); }
        if (done('cabinet')) { const c = P.cabinet('#2f5a6a'); c.position.set(-8, FLOOR_Y, -12.4); g.add(c); }
        return g;
    }

    extras(G) {
        const g = new THREE.Group();
        const done = (id) => G.tasks.includes(id);
        const owned = (dino) => BONE_PARTS.filter((p) => G.items.includes(`${dino}-${p}`));
        const add = (o, x, y, z, ry = 0, s = 1) => { o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };
        if (done('lanterns')) for (let i = 0; i < 4; i++) add(P.paperLantern(['#ff8a5a', '#ffd27a', '#ff6b8a', '#ffd27a'][i]), -12 + i * 2.6, FLOOR_Y + 2.2, 4 + (i % 2) * 2);
        if (done('skylight')) add(P.skylight(), 8.5, FLOOR_Y, 4.5);
        if (done('mural')) add(P.mural('jungle', 8, 1.2), 8.5, FLOOR_Y + 0.8, -0.85);
        if (done('waves')) { add(P.mural('waves', 9, 1.2), -8, FLOOR_Y + 0.8, -0.85, PI); add(P.mural('waves', 11, 1.2), -12.85, FLOOR_Y + 0.8, -7, PI / 2); }
        if (done('glass')) add(P.aquarium(), -12.2, FLOOR_Y, -4, PI / 2);
        if (done('beams')) for (let i = 0; i < 4; i++) add(new Kit().add(box(16.4, 0.4, 0.4), '#7a5232', 'flat').build(), 5, FLOOR_Y + 3.4, -12.5 + i * 3.6);
        const dinoAt = { trike: [8.5, 4.6, -PI / 2 + 0.3, 0.95], plesio: [-8, -7, 0.4, 0.9], trex: [5, -7.5, -0.35, 1.05] };
        const standFor = { trike: 'stand', plesio: 'cabinet', trex: 'beams' };
        for (const d of DINOS) {
            if (!done(standFor[d.id])) continue;
            const [x, z, ry, sc] = dinoAt[d.id];
            add(P.stand(d.id === 'trex' ? 8 : 6.4, 2.6), x, FLOOR_Y, z, ry);
            const sk = buildSkeleton(d.id);
            const has = done(`build-${d.id}`) ? BONE_PARTS : owned(d.id);
            sk.setParts(has);
            add(sk.group, x, FLOOR_Y + 0.34 + (d.id === 'plesio' ? 0.5 : 0), z, ry, sc);
        }
        return g;
    }

    decor(G) {
        const g = new THREE.Group();
        const has = (id) => G.decor.includes(id);
        const place = (o, x, z, ry = 0, s = 1) => { o.position.set(x, islandH(x, z), z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); };
        if (has('bench')) { place(P.bench(), -4.5, 14, 0.3); place(P.bench(), 4.5, 15.5, -0.3); }
        if (has('flowers')) { place(P.flowerBed(3, 1), -5.5, 12); place(P.flowerBed(3, 1, 2), 9, 12.5, -0.4); }
        if (has('lamps')) for (const [x, z] of [[-2, 14], [2, 17], [-2, 20], [2, 23]]) place(P.lampPost(), x, z);
        if (has('fountain')) place(P.fountain(), -10, 15);
        if (has('icecream')) place(P.iceCream(), 10, 17, -0.6);
        if (has('bandstand')) place(P.bandstand(), -16, -14, 0, 0.9);
        if (has('balloon')) place(P.balloon(), 16, 18);
        return g;
    }

    /** One camp per chapter: the current one waits with a sign and an arrow, finished ones fly a
     *  green flag, later ones are roped off with the chapter that opens them. */
    digSites(G) {
        const g = new THREE.Group();
        const now = activeSite(G);
        this.siteMarkers = [];
        DIG_SITES.forEach((s, i) => {
            const y = islandH(s.x, s.z);
            const camp = new THREE.Group();
            camp.position.set(s.x, y, s.z);
            const toMuseum = Math.atan2(-s.x, -s.z);
            const state = i === now ? 'active' : i < now || (G.finished && i < 5) ? 'done' : 'locked';
            const tent = P.tent();
            tent.position.set(-2.4, 0, -2.6);
            tent.rotation.y = toMuseum + 0.6;
            camp.add(tent);
            // the pit: a grid of survey strings, a fence of rope on four posts, a bucket and a sieve
            const k = new Kit();
            k.add(box(5.6, 0.14, 5.6), '#a8814e', 'flat', { p: [1, 0.03, 1] });
            for (let j = 1; j < 4; j++) {
                k.add(box(5.6, 0.02, 0.02), '#f4efe2', 'matte', { p: [1, 0.14, -1.8 + j * 1.4] });
                k.add(box(0.02, 0.02, 5.6), '#f4efe2', 'matte', { p: [-1.8 + j * 1.4, 0.14, 1] });
            }
            const rope = state === 'locked' ? '#d8433a' : '#e8dcc0';
            for (const [px, pz] of [[-2.2, -2.2], [4.2, -2.2], [-2.2, 4.2], [4.2, 4.2]]) k.add(cyl(0.07, 0.08, 1.1, 6), '#b88a5a', 'flat', { p: [px, 0.55, pz] });
            for (const z of [-2.2, 4.2]) k.add(box(6.4, 0.035, 0.035), rope, 'matte', { p: [1, 0.95, z] });
            for (const x of [-2.2, 4.2]) k.add(box(0.035, 0.035, 6.4), rope, 'matte', { p: [x, 0.95, 1] });
            k.add(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 14, 1, true), '#3a8ac4', 'gloss', { p: [5.2, 0.25, 2.6] });
            k.add(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 18, 1, true), '#b07a48', 'flat', { p: [5.4, 0.1, 0.4] });
            if (state !== 'locked') for (let j = 0; j < 4; j++) k.add(bumpy(new THREE.IcosahedronGeometry(0.22, 0), 0.05, 3, j + i * 7), '#8f8a80', 'flat', { p: [-0.4 + j * 0.9, 0.2, 2.2 - (j % 2) * 1.3] });
            camp.add(k.build());
            const sign = P.sign(state === 'locked' ? `Chapter ${i + 1}` : s.name, 3.6, 0.7, state === 'locked' ? '#6a5a4a' : state === 'done' ? '#3f7a4a' : '#8a4a2a', '#ffe9b0');
            sign.position.set(3.2, 0, -2.6);
            sign.rotation.y = toMuseum;
            camp.add(sign);
            if (state === 'done') { const f = P.banner('#4caf50', 2.8); f.position.set(-3.8, 0, 2); camp.add(f); }
            if (state === 'active') {
                const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x8a5000, emissiveIntensity: 0.6, roughness: 0.4, flatShading: true }));
                arrow.rotation.x = PI;
                arrow.position.set(1, 6, 1);
                arrow.userData.bob = true;
                camp.add(arrow);
            }
            const pit = new THREE.Object3D();
            pit.position.set(1, -0.3, 1);          // tap() looks 0.8 above this: the middle of the pit
            camp.add(pit);
            camp.userData = { i, state, site: s, pit };
            g.add(camp);
            this.siteMarkers.push(camp);
        });
        return g;
    }

    /** Map labels for the UI: each place's name and where it is on screen, faded by zoom. */
    labels() {
        const out = [];
        const far = smooth(55, 95, this.rig.dist);
        for (const r of REGIONS) {
            if (far <= 0.02) break;
            const p = this.screenOf(r.x, islandH(r.x, r.z) + r.y, r.z);
            if (p) out.push({ id: 'r:' + r.name, text: r.name, x: p.x, y: p.y, alpha: far, kind: 'region', at: [r.x, r.z] });
        }
        if (this.G) {
            const i = activeSite(this.G);
            const s = DIG_SITES[i];
            const p = this.screenOf(s.x, islandH(s.x, s.z) + 7, s.z, true);
            if (p) out.push({ id: 'dig', text: `⛏ ${s.name}`, x: p.x, y: p.y, alpha: 1, kind: 'dig', at: [s.x, s.z] });
        }
        return out;
    }

    // ------------------------------------------------------------------ people
    syncPeople(G) {
        const want = ['gus', ...G.staff];
        if (G.finished) want.push('marigold');
        for (const id of want) {
            if (this.people.has(id)) continue;
            const a = buildAnimal(PEOPLE[id].animal);
            a.group.scale.setScalar(0.85);
            this.scene.add(a.group);
            const home = HOME[id] || 'entrance';
            const p = randomIn(home);
            a.group.position.set(p[0], FLOOR_Y, p[1]);
            this.people.set(id, { a, x: p[0], z: p[1], tx: p[0], tz: p[1], wait: 1, room: home, id, talk: 0, wave: 0 });
        }
        // visitors: one per eight appeal, up to 14, once the entrance is open
        const open = G.tasks.includes('open-entrance');
        const want2 = open ? Math.min(14, Math.ceil((this.hooks.appeal?.() || 0) / 8)) : 0;
        while (this.visitors.length < want2) {
            const kind = VISITOR_KINDS[this.visitors.length % VISITOR_KINDS.length];
            const tint = this.visitors.length >= VISITOR_KINDS.length ? ['#c9b29a', '#8a5f3e', '#e0a050', '#7d8a94', '#f2efe6', '#2a2a32'][this.visitors.length % 6] : null;
            const a = buildAnimal(kind, tint && kind !== 'puffin' && kind !== 'sheep' ? shade(tint, 0.1) : null);
            a.group.scale.setScalar(0.62);
            this.scene.add(a.group);
            const v = { a, x: 0, z: 26 + this.visitors.length, tx: 0, tz: 12, wait: this.visitors.length * 2.5, room: null, phase: Math.random() * 6 };
            a.group.position.set(v.x, islandH(v.x, v.z), v.z);
            this.visitors.push(v);
        }
        while (this.visitors.length > want2) this.scene.remove(this.visitors.pop().a.group);
    }

    /** Pick where a visitor walks next: through the door, then about the open halls. */
    nextVisitorGoal(v) {
        const G = this.G;
        const open = Object.keys(ROOMS).filter((r) => G.tasks.includes(HALL_OPEN_TASK[r]));
        if (!v.room) { v.tx = 0; v.tz = 9; v.room = 'entrance'; return; }
        if (Math.random() < 0.12) { v.room = null; v.tx = (Math.random() - 0.5) * 6; v.tz = 14 + Math.random() * 6; return; }
        const r = open.length ? open[Math.floor(Math.random() * open.length)] : 'entrance';
        const p = randomIn(r);
        v.tx = p[0]; v.tz = p[1]; v.room = r;
    }

    updatePeople(dt, time) {
        const step = (p, speed, isVisitor) => {
            const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
            let moving = 0;
            if (p.wait > 0) p.wait -= dt;
            else if (d > 0.1) {
                const s = Math.min(d, speed * dt);
                p.x += (dx / d) * s; p.z += (dz / d) * s;
                moving = 1;
                const want = Math.atan2(dx, dz);
                let da = want - p.a.group.rotation.y;
                while (da > PI) da -= PI * 2;
                while (da < -PI) da += PI * 2;
                p.a.group.rotation.y += da * Math.min(1, dt * 8);
            } else {
                p.wait = 1.5 + Math.random() * 4;
                if (isVisitor) this.nextVisitorGoal(p);
                else { const q = randomIn(Math.random() < 0.7 ? p.room : 'entrance'); p.tx = q[0]; p.tz = q[1]; }
            }
            const inside = Math.abs(p.x) < 13.5 && p.z < 10.5 && p.z > -14.5;
            p.a.group.position.set(p.x, inside ? FLOOR_Y : islandH(p.x, p.z), p.z);
            p.talk = Math.max(0, p.talk - dt);
            p.wave = Math.max(0, (p.wave || 0) - dt);
            animate(p.a, time, { speed: moving, talk: p.talk > 0, wave: p.wave > 0 ? 1 : 0, phase: p.phase || 0 });
        };
        for (const p of this.people.values()) step(p, 1.6, false);
        for (const v of this.visitors) step(v, 1.4, true);
    }

    /** A staff member says something (when tapped). */
    poke(id) {
        const p = this.people.get(id);
        if (p) { p.talk = 2; p.wave = 1.2; p.wait = 2.5; }
    }

    // ------------------------------------------------------------------ input
    /**
     * Map controls. One finger or the left mouse button pans; two fingers pinch to zoom, twist to
     * turn and slide to pan; the right mouse button (or Shift + left) turns and tilts; the wheel
     * zooms. A press that hardly moves is a tap.
     */
    bindInput() {
        const cv = this.stage.canvas;
        const pts = new Map();
        cv.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
        cv.addEventListener('pointerdown', (e) => {
            if (!this.enabled) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, turn: e.button === 2 || e.button === 1 || e.shiftKey });
            if (pts.size === 2) this.pinch = this.twoFinger(pts);
            try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            this.idleT = 0;
        });
        cv.addEventListener('pointermove', (e) => {
            const p = pts.get(e.pointerId);
            if (!p || !this.enabled) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (pts.size >= 2 && this.pinch) {
                const now = this.twoFinger(pts);
                this.rig.wantDist = clamp(this.pinch.dist * (this.pinch.d / Math.max(10, now.d)), this.rig.minD, this.rig.maxD);
                let da = now.a - this.pinch.a0;
                while (da > PI) da -= PI * 2;
                while (da < -PI) da += PI * 2;
                this.rig.yaw = this.pinch.yaw + da;
                this.pan(now.mx - this.pinch.mx, now.my - this.pinch.my);
                this.pinch.mx = now.mx; this.pinch.my = now.my;
            } else if (pts.size === 1) {
                if (p.turn) {
                    this.rig.yaw -= dx * 0.006;
                    this.rig.pitch = clamp(this.rig.pitch + dy * 0.004, 0.35, 1.3);
                } else this.pan(dx, dy);
            }
            this.idleT = 0;
        });
        const up = (e) => {
            const p = pts.get(e.pointerId);
            pts.delete(e.pointerId);
            if (pts.size < 2) this.pinch = null;
            if (p && this.enabled && !p.turn && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10) this.tap(e.clientX, e.clientY);
        };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); this.pinch = null; });
        cv.addEventListener('wheel', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            this.zoom(Math.sign(e.deltaY) * 0.12);
        }, { passive: false });
    }
    twoFinger(pts) {
        const [a, b] = [...pts.values()];
        return { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.rig.wantDist, a: Math.atan2(b.y - a.y, b.x - a.x), a0: Math.atan2(b.y - a.y, b.x - a.x), yaw: this.rig.yaw, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    /** Move the view by a screen drag (px): the ground follows the finger. */
    pan(dx, dy) {
        const r = this.rig;
        const k = (2 * r.dist * this.portrait() * Math.tan((this.camera.fov * PI) / 360)) / Math.max(1, this.stage.h);
        const rx = Math.cos(r.yaw), rz = -Math.sin(r.yaw);          // screen right, on the ground
        const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);         // screen up, on the ground
        r.tx = clamp(r.tx - rx * dx * k + fx * dy * k / Math.max(0.35, Math.sin(r.pitch)), -125, 125);
        r.tz = clamp(r.tz - rz * dx * k + fz * dy * k / Math.max(0.35, Math.sin(r.pitch)), -205, 55);
        r.cx = r.tx; r.cz = r.tz;
    }
    zoom(by) { this.rig.wantDist = clamp(this.rig.wantDist * (1 + by), this.rig.minD, this.rig.maxD); }
    portrait() { return Math.max(1, 1.15 / Math.max(0.1, this.camera.aspect)); }

    /** A tap in the world: a person, the dig site, the ticket booth. */
    tap(cx, cy) {
        const rect = this.stage.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
        this.ray.setFromCamera(ndc, this.camera);
        let best = null, bd = 1e9;
        const consider = (obj, id, kind) => {
            const p = obj.getWorldPosition(new THREE.Vector3());
            p.y += 0.8;
            const s = p.clone().project(this.camera);
            const sx = rect.left + (s.x + 1) / 2 * rect.width, sy = rect.top + (1 - s.y) / 2 * rect.height;
            const d = Math.hypot(sx - cx, sy - cy);
            const lim = kind === 'dig' || kind === 'site' ? 80 : 40;
            if (d < lim && d < bd) { bd = d; best = { id, kind }; }
        };
        for (const [id, p] of this.people) consider(p.a.group, id, 'person');
        consider(this.dyn.booth || this.static, 'booth', 'booth');
        for (const camp of this.siteMarkers || []) consider(camp.userData.pit, camp.userData.state === 'active' ? 'dig' : 'site:' + camp.userData.i, camp.userData.state === 'active' ? 'dig' : 'site');
        if (best?.kind === 'site') { const c = this.siteMarkers[+best.id.slice(5)]; best.state = c.userData.state; best.chapter = c.userData.i + 1; best.name = c.userData.site.name; }
        if (best) this.hooks.onTap(best);
    }

    // ------------------------------------------------------------------ screen helpers
    /** Where a point of the world is on screen (client px), or null when behind the camera. */
    screenOf(x, y, z, always = false) {
        const v = new THREE.Vector3(x, y, z).project(this.camera);
        if (v.z > 1 && !always) return null;
        if (v.z > 1) { v.x = -v.x * 50; v.y = -v.y * 50; }       // behind: far off the opposite edge
        const rect = this.stage.canvas.getBoundingClientRect();
        return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
    }
    anchor(name) {
        if (name === 'till') return this.screenOf(6.2, FLOOR_Y + 3.4, 12.5);
        if (name === 'dig' && this.G) { const s = DIG_SITES[activeSite(this.G)]; return this.screenOf(s.x, islandH(s.x, s.z) + 4, s.z); }
        const p = this.people.get(name);
        if (p) return this.screenOf(p.x, FLOOR_Y + 1.6, p.z);
        return null;
    }

    focus(target) {
        let f = { entrance: [0, 6, 34], ancients: [-8.5, 4.5, 30], fossils: [8.5, 4.5, 30], sea: [-8, -7, 32], great: [5, -7.5, 36], museum: [0, 1, 46], all: [0, -75, 240] }[target];
        if (target === 'dig' && this.G) { const s = DIG_SITES[activeSite(this.G)]; f = [s.x, s.z, 34]; }
        if (Array.isArray(target)) f = [target[0], target[1], Math.min(this.rig.wantDist, 60)];
        if (!f) return;
        this.rig.tx = f[0]; this.rig.tz = f[1]; this.rig.wantDist = f[2];
    }

    setInsets(ins) { this.insets = ins; }

    // ------------------------------------------------------------------ the frame
    frame(dt, time) {
        this.time = time;
        this.U.uTime.value = time;
        const r = this.rig;
        this.idleT = (this.idleT || 0) + dt;
        r.yaw += dt * r.spin;
        r.dist += (r.wantDist - r.dist) * Math.min(1, dt * 4);
        r.cx = (r.cx ?? r.tx) + (r.tx - (r.cx ?? r.tx)) * Math.min(1, dt * 3);
        r.cz = (r.cz ?? r.tz) + (r.tz - (r.cz ?? r.tz)) * Math.min(1, dt * 3);
        const cam = this.camera;
        const w = this.stage.w, h = this.stage.h;
        cam.aspect = w / h;
        // portrait screens need more distance to show the same width
        const d = r.dist * this.portrait();
        const gy = Math.max(1, islandH(r.cx, r.cz));
        cam.position.set(r.cx + Math.sin(r.yaw) * Math.cos(r.pitch) * d, gy + Math.sin(r.pitch) * d + 0.5, r.cz + Math.cos(r.yaw) * Math.cos(r.pitch) * d);
        cam.lookAt(r.cx, gy + 0.5, r.cz);
        // shadows cover what is on screen: the sun's box follows the view and grows with distance
        const half = clamp(d * 0.75, 30, 150);
        Object.assign(this.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
        this.sun.shadow.camera.updateProjectionMatrix();
        this.sun.target.position.set(r.cx, gy, r.cz);
        this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 120);
        this.sun.shadow.normalBias = 0.04 * (half / 34);
        this.scene.fog.near = d * 1.4 + 60;
        this.scene.fog.far = d * 3.5 + 420;
        this.water.material.uniforms.fogNear.value = this.scene.fog.near;
        this.water.material.uniforms.fogFar.value = this.scene.fog.far;
        const ins = this.insets || { top: 0, bottom: 0, left: 0, right: 0 };
        const cy = ins.top + (h - ins.top - ins.bottom) / 2, cx = ins.left + (w - ins.left - ins.right) / 2;
        cam.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
        cam.far = d * 6 + 1600;
        cam.updateProjectionMatrix();
        // the sea moves, the ferry bobs at the dock, gulls circle
        this.ferry.position.set(3.6, Math.sin(time * 1.3) * 0.12 + 0.2, 31);
        this.ferry.rotation.set(Math.sin(time * 1.1) * 0.03, PI, Math.sin(time * 0.9) * 0.04);
        for (const g of this.gulls) {
            const ph = g.userData.ph, a = time * 0.25 + ph, [hx, hz, hr] = g.userData.home;
            g.position.set(hx + Math.cos(a) * (hr + (ph % 3) * 4), 14 + Math.sin(time * 0.7 + ph) * 1.5 + (ph % 4), hz + Math.sin(a) * (hr * 0.8 + (ph % 2) * 3));
            g.rotation.y = -a;
            const f = Math.sin(time * 6 + ph * 4) * 0.5;
            g.userData.wings[0].rotation.z = f; g.userData.wings[1].rotation.z = -f;
        }
        if (this.G) this.updatePeople(dt, time);
        this.smoke.update(dt);
        const wm = this.landmarks.userData.windmill;
        if (wm) wm.userData.blades.rotation.z -= dt * 0.6;
        this.landmarks.traverse((o) => { if (o.userData.bob !== undefined && o.userData.bob !== true) { o.position.y = 0.15 + Math.sin(time * 1.2 + o.userData.bob) * 0.12; o.rotation.z = Math.sin(time + o.userData.bob) * 0.05; } });
        for (const c of this.siteMarkers || []) c.traverse((o) => { if (o.userData.bob === true) { o.position.y = 6 + Math.sin(time * 3) * 0.6; o.rotation.y = time * 1.5; } });
        for (const name of ['exhibits']) this.dyn[name]?.traverse((o) => { if (o.userData.spin) o.rotation.y += dt * 0.4; });
        this.dyn['entrance-props']?.traverse((o) => { if (o.userData.float !== undefined) o.position.y += Math.sin(time * 1.5 + o.userData.float) * 0.003; });
        this.stage.render(this.scene, cam, dt, time, { bloom: 0.5, threshold: 1.3, vignette: 0.28, warm: 0.6, exposure: 0.95 });
    }
}

// ------------------------------------------------------------------ where people live
const HOME = { gus: 'dockside', moss: 'entrance', penny: 'entrance', ledger: 'entrance', kit: 'fossils', rosa: 'ancients', marigold: 'entrance' };
function randomIn(room) {
    if (room === 'dockside') return [(Math.random() - 0.5) * 3 + 1.5, 16 + Math.random() * 6];
    const R = ROOMS[room] || ROOMS.entrance;
    return [R.x0 + 1.2 + Math.random() * (R.x1 - R.x0 - 2.4), R.z0 + 1.2 + Math.random() * (R.z1 - R.z0 - 2.4)];
}

/** Display spots per hall: [x, z, rotation]. */
function SLOTS() {
    const ring = (cx, cz, rx, rz, n, start = 0) => Array.from({ length: n }, (_, i) => { const a = start + (i / n) * PI * 2; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz, -a + PI / 2]; });
    return {
        entrance: [...[-3.2, -3.2, -3.2, -3.2].map((x, i) => [x, 3.2 + i * 1.6, PI / 2]), ...[3.2, 3.2, 3.2, 3.2].map((x, i) => [x, 3.2 + i * 1.6, -PI / 2]), [-1.6, 3, 0], [1.6, 3, 0], [-1.6, 5, 0], [1.6, 5, 0]],
        ancients: ring(-8.5, 4.5, 3.4, 3.4, 12, 0.2),
        fossils: [[5, 9, PI], [6.8, 9, PI], [10.2, 9, PI], [12, 9, PI], [5.2, 0, 0], [12, 0, 0]],
        sea: [[-12.2, -9, PI / 2], [-12.2, -11, PI / 2], [-4, -11.5, 0], [-6, -11.5, 0], [-4.2, -2.2, PI], [-11, -2.2, PI]],
        great: [[-1.8, -2.4, PI], [12, -2.4, PI], [-1.8, -12.8, 0], [12, -12.8, 0], [-1.8, -7.5, PI / 2], [12, -7.5, -PI / 2]],
    };
}

/** Floor and wall colours for a hall, from its tasks. */
function hallLook(id, G) {
    const done = (t) => G.tasks.includes(t);
    const shabbyF = '#8a7a66', shabbyW = '#a8a094';
    switch (id) {
        case 'entrance': return { floor: done('sweep') ? '#c9945e' : shabbyF, wall: done('roof') ? '#f2e6cf' : shabbyW, trim: '#2f5a6a' };
        case 'ancients': return { floor: done('floor') ? '#d29a5a' : shabbyF, wall: done('plinths') ? '#efe2c4' : shabbyW, trim: '#8a2f4a' };
        case 'fossils': return { floor: done('unboard') ? '#b98a5a' : shabbyF, wall: done('drawers') ? '#e8dcbc' : shabbyW, trim: '#3f6a3a' };
        case 'sea': return { floor: done('glass') ? '#a8b8c0' : shabbyF, wall: done('waves') ? '#cfe8f0' : done('cabinet') ? '#e6eef0' : shabbyW, trim: '#2f5a8a' };
        default: return { floor: done('rubble') ? '#c8a070' : shabbyF, wall: done('beams') ? '#f2e2c6' : shabbyW, trim: '#8a6a2a' };
    }
}

function roomShell(id, R, look, started, open) {
    const k = new Kit();
    const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const floorCol = (x, y, z) => shade(look.floor, (Math.floor((x - R.x0) * 2.2) % 2) * 0.06 - (started ? 0 : 0.12) + noise3(x * 0.8, 0, z * 0.8) * 0.06);
    k.add(box(w, 0.12, d, Math.ceil(w * 2.2), 1, 1), floorCol, 'gloss', { p: [cx, FLOOR_Y - 0.05, cz] });
    const H = 1.5, T = 0.3;
    const wallSeg = (side) => {
        const doors = R.doors.filter(([s]) => s === side).map(([, p]) => p);
        const horiz = side === 'n' || side === 's';
        const a0 = horiz ? R.x0 : R.z0, a1 = horiz ? R.x1 : R.z1;
        const cuts = [a0, ...doors.flatMap((p) => [p - 1.0, p + 1.0]), a1].sort((x, y) => x - y);
        for (let i = 0; i < cuts.length; i += 2) {
            const s0 = cuts[i], s1 = cuts[i + 1];
            if (s1 - s0 < 0.05) continue;
            const mid = (s0 + s1) / 2, len = s1 - s0;
            const fixed = side === 'n' ? R.z0 : side === 's' ? R.z1 : side === 'w' ? R.x0 : R.x1;
            const p = horiz ? [mid, FLOOR_Y + H / 2, fixed] : [fixed, FLOOR_Y + H / 2, mid];
            const sz = horiz ? [len + T, H, T] : [T, H, len + T];
            k.add(box(...sz), (x, y) => (y > H / 2 - 0.12 ? look.trim : y < -H / 2 + 0.15 ? shade(look.wall, -0.2) : look.wall), 'flat', { p });
        }
    };
    for (const s of ['n', 's', 'w', 'e']) wallSeg(s);
    // pillars at the corners
    for (const [x, z] of [[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1]]) {
        k.add(box(0.55, 2.3, 0.55), look.wall, 'flat', { p: [x, FLOOR_Y + 1.15, z] });
        k.add(box(0.7, 0.18, 0.7), look.trim, 'flat', { p: [x, FLOOR_Y + 2.35, z] });
    }
    if (!started) {
        for (let i = 0; i < 5; i++) k.add(cyl(0.6 + (i % 3) * 0.3, 0.7 + (i % 3) * 0.3, 0.02, 10), '#6f6352', 'matte', { p: [cx + Math.cos(i * 2.3) * w * 0.3, FLOOR_Y + 0.02, cz + Math.sin(i * 2.3) * d * 0.3] });
    }
    if (open) {
        // a rug down the middle of an open hall
        k.add(box(Math.min(w, d) * 0.35, 0.02, Math.min(w, d) * 0.7), shade(look.trim, 0.15), 'fur', { p: [cx, FLOOR_Y + 0.02, cz], r: [0, w > d ? PI / 2 : 0, 0] });
    }
    const g = k.build();
    g.userData.room = id;
    return g;
}

function dock(fixed) {
    const k = new Kit();
    for (let i = 0; i < 16; i++) {
        const z = 18 + i * 1.0;
        if (!fixed && (i === 5 || i === 9 || i === 10 || i === 13)) continue;
        k.add(box(2.6, 0.14, 0.9), (x) => shade('#b08a5a', Math.sin(x * 9 + i) * 0.05 - (fixed ? 0 : 0.12)), 'flat', { p: [0, 0.75, z], r: fixed ? [0, 0, 0] : [0, 0, ((i * 7) % 5 - 2) * 0.03] });
        if (i % 3 === 0) for (const x of [-1.3, 1.3]) k.add(cyl(0.12, 0.14, 2.4, 8), '#7a5a3a', 'flat', { p: [x, 0, z] });
    }
    if (fixed) for (const x of [-1.3, 1.3]) k.add(box(0.06, 0.06, 15.5), '#e8dcc0', 'flat', { p: [x, 1.4, 25.5] });
    return k.build();
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** The camp to dig at now: this chapter's, or the Night Digs once the story is done. */
export function activeSite(G) {
    if (G.finished) return 5;
    return Math.min(4, G.tasks.filter((t) => t.startsWith('open-') || t === 'grand').length);
}

export { islandH };
export { ROOMS, FLOOR_Y, glowTexture, sphere, cone, torus, cyl, STAFF };
