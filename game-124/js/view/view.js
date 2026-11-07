// The view: reads G every frame, turns sim events into effects. Never changes G.

import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { getWorld, SITES, HILLTOP, FEN_FLOOR } from '../sim/world.js';
import { ventActive, ventPos, ECHO_POS, spellColor, evaluate } from '../sim/magic.js';
import { phaseOf, isNight } from '../sim/util.js';
import { REAGENTS } from '../sim/data/reagents.js';
import { Stage } from './stage.js';
import { buildTerrain, buildWaters, updateWaters } from './terrain.js';
import { buildNature } from './nature.js';
import { buildHut, buildCastle, buildThorns, buildLandmarks } from './buildings.js';
import { makeNib, poseNib, makeElowen, poseElowen, makeShade } from './characters.js';
import { FX } from './fx.js';
import { glow, paper, bark } from './tex.js';
import { jitterGeo } from './nature.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });

function pickupModel(kind) {
    const g = new THREE.Group();
    const add = (geo, mat, x = 0, y = 0, z = 0, r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...r); m.castShadow = true; g.add(m); return m; };
    switch (kind) {
        case 'shard': add(jitterGeo(new THREE.OctahedronGeometry(0.11, 0), 0.03, 3), M({ color: 0x9fd8c8, roughness: 0.15, transparent: true, opacity: 0.85 }), 0, 0.06, 0); break;
        case 'kelp': for (let i = 0; i < 3; i++) add(new THREE.CapsuleGeometry(0.03, 0.3, 3, 6), M({ color: 0x5a6a2a }), (i - 1) * 0.07, 0.03, 0, [Math.PI / 2, i * 0.4, 0]); add(new THREE.SphereGeometry(0.045, 8, 6), M({ color: 0x7a7a3a }), 0.05, 0.06, 0.1); break;
        case 'shell': add(new THREE.SphereGeometry(0.09, 12, 8), M({ color: 0xf2e6d4, roughness: 0.25 }), 0, 0.05, 0).scale.set(1, 0.6, 1.4); break;
        case 'mushroom': for (let i = 0; i < 3; i++) { add(new THREE.CylinderGeometry(0.02, 0.025, 0.14, 6), M({ color: 0xeeeedd }), i * 0.08 - 0.08, 0.07, (i % 2) * 0.06); add(new THREE.SphereGeometry(0.06, 10, 6, 0, 6.3, 0, 1.6), M({ color: 0xd8e2ea, emissive: 0x334455, emissiveIntensity: 0.4 }), i * 0.08 - 0.08, 0.14, (i % 2) * 0.06); } break;
        case 'feather': add(new THREE.PlaneGeometry(0.06, 0.3), M({ color: 0x8a6a4a, side: THREE.DoubleSide }), 0, 0.03, 0, [-Math.PI / 2, 0, 0.6]); break;
        case 'drop': add(new THREE.SphereGeometry(0.06, 10, 8), M({ color: 0xd88a1a, roughness: 0.1, transparent: true, opacity: 0.9 }), 0, 0.06, 0).scale.set(1, 1.3, 1); break;
        case 'pearl': add(new THREE.SphereGeometry(0.06, 12, 8), M({ color: 0xf0d24a, roughness: 0.2 }), 0, 0.06, 0); break;
        case 'sprig': for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.03, 0.22, 4), M({ color: 0x6a7a3a }), 0, 0.1, 0, [rnd(), i, rnd()]); break;
        case 'crystal': for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.04, 0.24 - i * 0.04, 6), M({ color: 0xe6f0ff, roughness: 0.1, transparent: true, opacity: 0.8 }), (i - 1) * 0.05, 0.1, 0, [0, 0, (i - 1) * 0.4]); break;
        case 'heather': for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.035, 6, 4), M({ color: 0xa860a8 }), rnd() * 0.12, 0.05 + i * 0.03, rnd() * 0.12); break;
        case 'clam': add(new THREE.SphereGeometry(0.08, 10, 6, 0, 6.3, 0, 1.4), M({ color: 0x8a8274 }), 0, 0.02, 0).scale.set(1, 0.5, 0.8); break;
        case 'chanterelle': for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.06, 0.1, 8, 1, true), M({ color: 0xe8a826, side: THREE.DoubleSide }), i * 0.07 - 0.07, 0.06, (i % 2) * 0.05, [Math.PI, 0, 0]); break;
        case 'driftwood': add(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), M({ map: bark('#b8ab96') }), 0, 0.07, 0, [0, rnd() * 3, Math.PI / 2]); break;
        case 'bush': {
            add(jitterGeo(new THREE.IcosahedronGeometry(0.6, 1), 0.15, 7), M({ color: 0x3e5e2e, flatShading: true }), 0, 0.5, 0).scale.set(1.2, 0.8, 1.2);
            const berries = new THREE.Group(); g.add(berries); g.userData.berries = berries;
            for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M({ color: 0x4a1a4a, roughness: 0.3 })); const a = i * 2.4; b.position.set(Math.cos(a) * 0.6, 0.35 + (i % 4) * 0.12, Math.sin(a) * 0.6); berries.add(b); }
            break;
        }
    }
    return g;
}
const rnd = () => Math.random() - 0.5;
const MODEL = { clam: 'clam', chanterelle: 'chanterelle', driftwood: 'driftwood', berries: 'bush' };

export class View {
    constructor(canvas, G, quality = 'high') {
        this.canvas = canvas;
        this.q = quality;
        this.stage = new Stage(canvas, quality);
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.fx = new FX(this.scene, quality);
        this.flash = 0;
        this.shake = 0;
        this.bob = 0;
        this.castAnim = 0;
        this.build(G);
    }

    /** Build the island for this seed (a new game on a new seed rebuilds it). */
    build(G) {
        if (this.root) this.scene.remove(this.root);
        this.seed = G.seed;
        const W = this.W = getWorld(G.seed);
        const L = this.L = G.laws;
        const root = this.root = new THREE.Group();
        this.scene.add(root);
        root.add(buildTerrain(W));
        this.waters = buildWaters(W);
        for (const w of this.waters.list) root.add(w);
        this.nature = buildNature(W, this.q);
        root.add(this.nature.group);
        this.hut = buildHut(W, L); root.add(this.hut.group);
        this.castle = buildCastle(W); root.add(this.castle.group);
        this.thorns = buildThorns(W); root.add(this.thorns.mesh);
        this.marks = buildLandmarks(W, L); root.add(this.marks.group);
        this.thornOpen = 0; this.gateOpen = 0; this.iceMelt = 0; this.bridgeGrow = 0; this.doorFade = 0;
        // characters
        this.nib = makeNib(); root.add(this.nib);
        this.elowen = makeElowen(); root.add(this.elowen);
        this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), new THREE.MeshStandardMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.22, roughness: 0.05, emissive: 0x6a3aff, emissiveIntensity: 0.5, depthWrite: false }));
        root.add(this.bubble);
        this.shadeMeshes = new Map();
        // pickups
        this.pickups = new Map();
        const glowMat = (c) => new THREE.SpriteMaterial({ map: glow(), color: new THREE.Color(c), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
        for (const k of G.pickups) {
            const kind = REAGENTS[k.item] ? REAGENTS[k.item].model : MODEL[k.item] || k.item;
            const m = pickupModel(kind);
            m.position.set(k.x, W.height(k.x, k.z), k.z);
            m.rotation.y = (k.x * 7.1) % 6.28;
            if (REAGENTS[k.item]) {
                const sp = new THREE.Sprite(glowMat(L.color[L.reagents[k.item].essence]));
                sp.scale.setScalar(0.42); sp.position.y = 0.15; m.add(sp); m.userData.glow = sp;
            }
            root.add(m);
            this.pickups.set(k.id, m);
        }
        // pages: folded paper, glowing a little
        this.pages = new Map();
        const pmat = new THREE.MeshStandardMaterial({ map: paper(), emissive: 0xffe8b0, emissiveIntensity: 0.25, side: THREE.DoubleSide });
        for (const id of ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']) {
            const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.36), pmat);
            root.add(pg);
            this.pages.set(id, pg);
        }
        this.pagePos = {
            p2: () => { const a = W.hutAt('shelf'); return V3(a.x, W.hutFloor + 1.1, a.z + 0.3); },
            p3: () => V3(SITES.boat.x + 0.6, W.height(SITES.boat.x, SITES.boat.z) + 0.75, SITES.boat.z),
            p4: () => V3(SITES.cage.x + 4, W.height(SITES.cage.x + 4, SITES.cage.z - 3) + 0.25, SITES.cage.z - 3),
            p5: () => V3(SITES.seedbed.x + 1.6, W.height(SITES.seedbed.x, SITES.seedbed.z) + 0.95, SITES.seedbed.z - 1.16),
            p6: () => V3(70, W.height(70, 14) + 1.2, 14.2),
            p7: () => V3(SITES.moorcamp.x, W.height(SITES.moorcamp.x, SITES.moorcamp.z) + 0.3, SITES.moorcamp.z),
            p8: () => V3(3.5, W.height(3.5, 68.5) + 1.1, 68.5),
            p9: () => V3(7, HILLTOP + 0.15, 11),
            p10: () => V3(0, HILLTOP + 0.08, -1.2),
        };
        // echoes: a faint girl of light
        this.echoes = new Map();
        for (const id in ECHO_POS) {
            const e = makeElowen();
            e.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }); o.castShadow = false; } });
            const p = ECHO_POS[id]();
            e.position.set(p.x, p.inHut ? W.hutFloor : W.height(p.x, p.z), p.z);
            poseElowen(e, 'stand', 0);
            root.add(e);
            this.echoes.set(id, e);
        }
        // the Focus in your hand
        if (!this.hand) {
            this.hand = new THREE.Group();
            const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.5, 8), M({ map: bark('#7a5a3a'), roughness: 0.8 }));
            wand.rotation.x = -Math.PI / 2; wand.position.z = -0.2;
            const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0x9fd8c8, emissive: 0x9fd8c8, emissiveIntensity: 1.2, roughness: 0.1 }));
            tip.position.z = -0.46;
            const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), M({ color: 0x5a4a6a }));
            sleeve.rotation.x = -Math.PI / 2; sleeve.position.set(0.02, -0.04, 0.12);
            const fist = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M({ color: 0xe0b896 }));
            fist.position.set(0, -0.01, -0.02); fist.scale.set(1, 0.9, 1.3);
            this.tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0x9fd8c8, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
            this.tipGlow.scale.setScalar(0.12); this.tipGlow.position.z = -0.46;
            this.hand.add(wand, tip, sleeve, fist, this.tipGlow);
            this.hand.userData.tip = tip;
            this.hand.position.set(0.24, -0.24, -0.42);
            this.hand.rotation.set(0.25, 0.12, -0.15);
            this.wandLight = new THREE.PointLight(0x9fd8c8, 0, 6, 2);
            this.wandLight.position.set(0, 0, -0.5);
            this.hand.add(this.wandLight);
            this.camera.add(this.hand);
        }
        this.ambT = 0;
    }

    colorOf(e) { return e === 'unweave' ? '#efe8ff' : this.L.color[e]; }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const fx = this.fx, W = this.W;
        for (const e of events) {
            switch (e.type) {
                case 'cast': {
                    this.castAnim = 1;
                    const c = this.colorOf(e.essence);
                    const tipW = this.hand.userData.tip.getWorldPosition(new THREE.Vector3());
                    fx.burst(tipW, c, { n: 18, speed: 1.5, size: 0.12, life: 0.5 });
                    if (e.form === 'bolt') fx.bolt(tipW, V3(e.to.x, e.to.y, e.to.z), c, e.power);
                    if (e.form === 'ward') { this.wardFlash = { c, t: 1 }; fx.burst(V3(e.x, e.y + 0.3, e.z), c, { n: 50, speed: 3.5, size: 0.14, life: 1.0, up: -0.2 }); }
                    if (e.essence === 'unweave') this.shake = 0.5;
                    break;
                }
                case 'fizzle': {
                    const tipW = this.hand.userData.tip.getWorldPosition(new THREE.Vector3());
                    fx.puff(tipW, '#777', { n: 8, size: 0.3, life: 1.2 });
                    fx.burst(tipW, '#ffcc88', { n: 10, speed: 1.2, size: 0.08, life: 0.4, grav: 6 });
                    this.castAnim = 0.5;
                    break;
                }
                case 'experiment': {
                    if (e.inst === 'alembic') { this.vapor = { c: new THREE.Color(e.color), t: 4, pot: e.potency }; }
                    if (e.inst === 'bells') this.bellRing = { t: 2.5, rel: e.rel };
                    if (e.inst === 'orrery') this.orreryTarget = { phase: e.phase, t: 4 };
                    break;
                }
                case 'circle': {
                    if (e.all) { this.circleFlicker = 1; break; }
                    this.circleState = this.circleState || {};
                    this.circleState[e.obj] = 12;
                    break;
                }
                case 'stone': fx.burst(V3(e.x, e.y + 1, e.z), e.color, { n: 120, speed: 6, size: 0.5, life: 1.6 }); fx.light(V3(e.x, e.y + 2, e.z), e.color, 12, 2, 30); this.shake = 0.4; break;
                case 'flag':
                    if (e.name === 'iceWall') { fx.puff(V3(e.x, e.y, e.z), '#cfe4ff', { n: 40, size: 3, life: 4, speed: 3 }); this.shake = 0.6; }
                    if (e.name === 'nibFree') fx.burst(V3(e.x, e.y, e.z), '#ffb070', { n: 80, speed: 4, size: 0.3 });
                    if (e.name === 'thornGap') { fx.burst(V3(e.x, e.y, e.z), '#d8c8ff', { n: 150, speed: 7, size: 0.4, life: 1.6 }); this.shake = 0.5; }
                    if (e.name === 'door') fx.burst(V3(e.x, e.y, e.z), '#fff4d0', { n: 80, speed: 3, size: 0.3 });
                    if (e.name === 'bridge') fx.burst(V3(e.x, e.y + 0.5, e.z), '#8ae06a', { n: 80, speed: 4, size: 0.3 });
                    if (e.name === 'gate') this.shake = 0.3;
                    break;
                case 'shadeDie': fx.burst(V3(e.x, e.y, e.z), '#d6c8ff', { n: 50, speed: 4, size: 0.3 }); fx.puff(V3(e.x, e.y, e.z), '#110818', { n: 14, size: 1.4 }); break;
                case 'win': fx.burst(V3(e.x, e.y, e.z), '#ffffff', { n: 300, speed: 9, size: 0.5, life: 2 }); fx.light(V3(e.x, e.y, e.z), '#ffffff', 30, 3, 40); this.shake = 1; break;
                case 'pickup': {
                    const m = this.pickups.get([...this.pickups.keys()].find((id) => { const k = G.pickups.find((p) => p.id === id); return k && Math.abs(k.x - e.x) < 0.01 && Math.abs(k.z - e.z) < 0.01; }));
                    if (m) fx.burst(m.position.clone().add(V3(0, 0.3, 0)), '#fff2c0', { n: 14, speed: 1.5, size: 0.15, life: 0.6, up: 1 });
                    break;
                }
                case 'echoShown': fx.burst(V3(e.x, (W.height(e.x, e.z) || 0) + 1.2, e.z), '#bfd6ff', { n: 60, speed: 2, size: 0.25, life: 1.5 }); break;
                case 'scald': this.flash = Math.max(this.flash, 0.4); break;
                case 'shadeTouch': this.flash = Math.max(this.flash, 0.3); break;
                case 'plunge': this.shake = 0.3; break;
                case 'land': this.bobLand = Math.min(0.12, e.v * 0.01); break;
            }
        }
    }

    // ------------------------------------------------------------------ every frame
    frame(G, dt, time, opts = {}) {
        if (G.seed !== this.seed) this.build(G);
        this.stage.resize();
        const W = this.W, p = G.p, cam = this.camera, fx = this.fx, F = G.flags;
        // camera: eye height, a walking bob, a little sway, shakes
        const speed = Math.hypot(p.vx, p.vz);
        if (p.ground && speed > 0.5) this.bob += dt * speed * 1.9;
        const bobY = p.ground ? Math.sin(this.bob * 2) * 0.035 * Math.min(1, speed / 4) : 0;
        this.bobLand = Math.max(0, (this.bobLand || 0) - dt * 0.5);
        this.shake = Math.max(0, this.shake - dt);
        const sh = this.shake * 0.08;
        cam.position.set(p.x + rnd() * sh, p.y + PLAYER.eye + bobY - this.bobLand + rnd() * sh, p.z + rnd() * sh);
        cam.rotation.set(p.pitch, -p.yaw, Math.sin(this.bob) * 0.006 * Math.min(1, speed / 4), 'YXZ');
        const focus = { x: p.x, y: p.y, z: p.z };
        this.stage.setTime(G.tod, time, focus, { inside: p.inside });
        updateWaters(this.waters, this.stage, time);
        this.nature.update(time);
        this.fx.setScale(this.stage.renderer.getDrawingBufferSize(new THREE.Vector2()).y, cam.fov);
        const night = isNight(G);

        // the hand: sway, the cast flick, the tip coloured by the selected spell
        this.castAnim = Math.max(0, this.castAnim - dt * 3);
        const ca = Math.sin(this.castAnim * Math.PI);
        this.hand.visible = G.hasWand && !opts.hideHand;
        this.hand.position.set(0.25 + Math.sin(this.bob) * 0.012, -0.25 + Math.abs(Math.cos(this.bob)) * 0.01 - ca * 0.04, -0.46 - ca * 0.12);
        this.hand.scale.setScalar(0.78);
        this.hand.rotation.set(0.25 - ca * 0.6, 0.12, -0.15);
        const slot = G.wand[G.sel];
        let tc = new THREE.Color(0x9fd8c8), lit = 0.3;
        if (slot?.glyphs.length && slot.charges > 0) {
            const known = this.knownSpellColor(G, slot);
            if (known) { tc = new THREE.Color(known); lit = 1; }
            else { tc = new THREE.Color(0xe8e0d0); lit = 0.7; }
        }
        this.tipGlow.material.color.copy(tc);
        this.tipGlow.scale.setScalar(0.1 + lit * 0.06 + Math.sin(time * 5) * 0.01);
        this.hand.userData.tip.material.emissive.copy(tc);
        this.wandLight.color.copy(tc);
        this.wandLight.intensity = night && this.hand.visible ? 0.6 * lit : 0;
        if (this.hand.visible && lit >= 1 && Math.random() < 0.3) {
            const tp = this.hand.userData.tip.getWorldPosition(new THREE.Vector3());
            fx.add.spawn(tp.x, tp.y, tp.z, rnd() * 0.2, 0.3, rnd() * 0.2, tc, 0.06, 0.6, {});
        }

        // the hut: hearth, windows, the instruments
        const H = this.hut;
        H.fill.intensity = (night ? 0.7 : 2.2) * (p.inside || Math.hypot(p.x - SITES.hut.x, p.z - SITES.hut.z) < 14 ? 1 : 0.2);
        H.fireLight.intensity = F.hearth ? 2.4 + Math.sin(time * 13) * 0.3 + Math.sin(time * 5.1) * 0.25 : 0;
        H.winMat.emissiveIntensity = F.hearth ? (night ? 1.6 : 0.2) : 0;
        if (F.hearth) {
            const hp = W.hutAt('hearth');
            const fpos = V3(hp.x + 0.05, W.hutFloor + 0.65, hp.z);
            const fc = new THREE.Color().setHSL(0.06 + Math.random() * 0.05, 1, 0.55);
            for (let i = 0; i < 2; i++) fx.add.spawn(fpos.x + rnd() * 0.4, fpos.y, fpos.z + rnd() * 0.6, rnd() * 0.2, 1.1 + Math.random() * 0.6, rnd() * 0.2, fc, 0.4, 0.6, { grow: -0.3 });
            if (Math.random() < 0.25) fx.soft.spawn(H.chimneyTop.x, H.chimneyTop.y, H.chimneyTop.z, rnd() * 0.3 + 0.4, 1.0, rnd() * 0.3, new THREE.Color(0xb8b0a8), 1.0, 5, { grow: 0.6, drag: 0.1, alpha: 0.35 });
        }
        // the alembic's vapour
        const vap = H.alembic.vapor;
        if (this.vapor && this.vapor.t > 0) {
            this.vapor.t -= dt;
            vap.material.color.copy(this.vapor.c);
            vap.material.opacity = Math.min(0.85, this.vapor.t) * (this.vapor.pot >= 2 ? 1 : 0.6);
            const ap = vap.getWorldPosition(new THREE.Vector3());
            if (Math.random() < 0.6) fx.add.spawn(ap.x + rnd() * 0.1, ap.y + 0.15, ap.z + rnd() * 0.1, rnd() * 0.2, 0.5, rnd() * 0.2, this.vapor.c, this.vapor.pot >= 2 ? 0.35 : 0.2, 1.6, { drag: 0.3 });
        } else vap.material.opacity = 0;
        // the bells
        if (this.bellRing && this.bellRing.t > 0) {
            this.bellRing.t -= dt;
            const k = this.bellRing.t / 2.5, r = this.bellRing.rel;
            H.bells.L.rotation.z = Math.sin(time * 14) * 0.3 * k;
            H.bells.R.rotation.z = (r === 'same' ? Math.sin(time * 14) : r === 'clash' ? Math.sin(time * 31) * (k > 0.6 ? 1 : 0) : Math.sin(time * 9 + 1)) * 0.3 * k;
        } else { H.bells.L.rotation.z *= 0.9; H.bells.R.rotation.z *= 0.9; }
        // the orrery: spins slowly, swings to an hour when asked
        const PH = { dawn: 0, day: Math.PI / 2, dusk: Math.PI, night: Math.PI * 1.5 };
        if (this.orreryTarget && this.orreryTarget.t > 0) {
            this.orreryTarget.t -= dt;
            H.orrery.arm.rotation.y += ((PH[this.orreryTarget.phase] - H.orrery.arm.rotation.y)) * Math.min(1, dt * 3);
        } else H.orrery.arm.rotation.y = (H.orrery.arm.rotation.y + dt * 0.2) % (Math.PI * 2);
        H.orrery.rings.rotation.y += dt * 0.1;
        // the circle's test objects
        const cs = this.circleState || {};
        for (const k in cs) cs[k] = Math.max(0, cs[k] - dt);
        const ob = H.objs;
        const cp = (id) => ob[id].getWorldPosition(new THREE.Vector3());
        if (cs.candle > 0) { const c = cp('candle'); fx.add.spawn(c.x, c.y + 0.25, c.z, 0, 0.4, 0, new THREE.Color(this.L.color.kindle), 0.15, 0.4, {}); }
        if (ob.bowl.userData.water) ob.bowl.userData.water.material.color.set(cs.bowl > 0 ? 0xdff2ff : 0x3a6a8a);
        if (cs.lantern > 0 && Math.random() < 0.5) { const c = cp('lantern'); fx.add.spawn(c.x, c.y + 0.12, c.z, 0, 0, 0, new THREE.Color(this.L.color.lumen), 0.4, 0.3, {}); }
        ob.pot.userData.sprout.scale.setScalar(cs.pot > 0 ? Math.min(1, (12 - cs.pot) * 2) : 0.01);
        ob.pinwheel.userData.wheel.rotation.z += dt * (cs.pinwheel > 0 ? 30 : 0.4);
        ob.pendulum.userData.pend.rotation.z = cs.pendulum > 0 ? 0.35 : Math.sin(time * 3) * 0.35;
        if (this.circleFlicker > 0) { this.circleFlicker -= dt; for (const k in ob) ob[k].visible = Math.random() > 0.4; } else for (const k in ob) ob[k].visible = true;
        H.circle.material.emissiveIntensity = 0.05 + (G.p.inside ? 0.15 : 0) + Math.max(0, Math.sin(time * 1.5)) * 0.05;
        // jars glow in the essences you have seen
        const seen = Object.values(G.notes.colors);
        H.jarMats.forEach((m, i) => { if (seen.length) { m.emissive.set(seen[i % seen.length]); m.emissiveIntensity = 0.35; } });

        // the castle and the curse
        const C = this.castle;
        this.gateOpen = Math.min(1, this.gateOpen + (F.gate ? dt * 0.4 : 0));
        C.doorL.rotation.y = -this.gateOpen * 1.6; C.doorR.rotation.y = this.gateOpen * 1.6;
        C.locks[0].material.emissive.set(F.stoneWood ? this.L.color.bloom : 0x000000);
        C.locks[1].material.emissive.set(F.stoneFen ? this.L.color.gale : 0x000000);
        C.locks[2].material.emissive.set(F.stoneMoor ? this.L.color.still : 0x000000);
        for (const l of C.locks) l.material.emissiveIntensity = 2;
        this.doorFade = Math.min(1, this.doorFade + (F.door ? dt * 0.7 : 0));
        C.hiddenDoor.material.opacity = 1 - this.doorFade;
        C.hiddenDoor.visible = this.doorFade < 0.99;
        C.veil.material.uniforms.uTime.value = time;
        C.veil.material.uniforms.uA.value = G.won ? Math.max(0, C.veil.material.uniforms.uA.value - dt * 0.3) : 1;
        C.keepLight.intensity = G.won ? 1.5 : 3.5 + Math.sin(time * 2) * 0.8;
        if (F.thornGap && this.thornOpen < 1) { this.thornOpen = Math.min(1, this.thornOpen + dt * 0.5); this.thorns.set(this.thornOpen); }
        else if (!F.thornGap && this.thornOpen > 0) { this.thornOpen = 0; this.thorns.set(0); }

        // landmarks: stones, beams, the ice, the bridge, the vents, the cage
        const Mk = this.marks;
        for (const reg of ['wood', 'fen', 'moor']) {
            const awake = F[{ wood: 'stoneWood', fen: 'stoneFen', moor: 'stoneMoor' }[reg]];
            Mk.stones[reg].mat.emissiveIntensity = awake ? 2.2 + Math.sin(time * 2 + reg.length) * 0.4 : 0;
            Mk.beams[reg].material.opacity = awake ? 0.35 + Math.sin(time * 3 + reg.length) * 0.08 : 0;
        }
        this.iceMelt = F.iceWall ? Math.min(1, this.iceMelt + dt * 0.35) : 0;
        Mk.ice.scale.set(1, Math.max(0.001, 1 - this.iceMelt), 1);
        Mk.ice.position.y = FEN_FLOOR + 6 * (1 - this.iceMelt) - 0.5;
        Mk.ice.visible = this.iceMelt < 1;
        if (this.iceMelt > 0 && this.iceMelt < 1 && Math.random() < 0.6) fx.soft.spawn(Mk.ice.position.x + rnd() * 2, FEN_FLOOR + Math.random() * 6, SITES.fen.z + rnd() * 12, rnd(), 1, rnd(), new THREE.Color(0xe0f0ff), 2, 3, { grow: 1, alpha: 0.35 });
        this.bridgeGrow = F.bridge ? Math.min(1, this.bridgeGrow + dt * 0.4) : 0;
        Mk.bridge.visible = this.bridgeGrow > 0;
        Mk.bridge.scale.set(1, 1, Math.max(0.001, this.bridgeGrow));
        Mk.cage.visible = G.nib.mode === 'caged';
        Mk.cage.rotation.y = time * 0.2;
        for (let i = 0; i < 3; i++) {
            const v = Mk.vents[i];
            v.plug.visible = G.vents[i].plugged;
            if (ventActive(G, i) && Math.random() < 0.9) fx.soft.spawn(v.x + rnd() * 0.3, FEN_FLOOR + 1.1, v.z + rnd() * 0.3, rnd() * 0.6, 4 + Math.random() * 2, rnd() * 0.6, new THREE.Color(0xf2f2f2), 0.8, 1.6, { grow: 1.6, drag: 0.4, alpha: 0.6 });
        }
        // the boiling pool and the hot spring steam gently
        if (Math.random() < 0.35) fx.soft.spawn(SITES.pool.x + rnd() * 16, SITES.pool.level + 0.2, SITES.pool.z + rnd() * 16, 0, 0.6, 0, new THREE.Color(0xeeeeee), 1.6, 4, { grow: 0.6, alpha: 0.25 });
        if (Math.random() < 0.15) fx.soft.spawn(SITES.spring.x + rnd() * 6, SITES.spring.level + 0.2, SITES.spring.z + rnd() * 6, 0, 0.4, 0, new THREE.Color(0xeeeeee), 1.2, 4, { grow: 0.5, alpha: 0.2 });

        // pickups and pages
        for (const k of G.pickups) {
            const m = this.pickups.get(k.id);
            if (!m) continue;
            if (k.kind === 'bush') { m.visible = true; m.userData.berries.visible = k.alive; continue; }
            m.visible = k.alive;
            if (m.userData.glow) m.userData.glow.material.opacity = 0.28 + Math.sin(time * 2 + k.x) * 0.12;
        }
        for (const [id, pg] of this.pages) {
            const show = !G.pages.includes(id) && (id !== 'p10' || F.door);
            pg.visible = show;
            if (!show) continue;
            const pp = this.pagePos[id]();
            pg.position.set(pp.x, pp.y + Math.sin(time * 2 + pp.x) * 0.04, pp.z);
            pg.rotation.set(id === 'p10' || id === 'p9' || id === 'p7' || id === 'p4' || id === 'p2' ? -Math.PI / 2 + 0.2 : 0, id === 'p2' ? 0 : time * 0.3 + pp.x, 0);
            if (Math.random() < 0.03) fx.add.spawn(pp.x, pp.y + 0.2, pp.z, 0, 0.3, 0, new THREE.Color(0xffe8b0), 0.12, 1.2, {});
        }

        // Nib
        const n = G.nib;
        this.nib.visible = true;
        this.nib.position.set(n.x, n.y, n.z);
        if (n.mode === 'caged') { this.nib.rotation.y = Math.sin(time * 3) * 0.3; poseNib(this.nib, dt, Math.sin(time * 7) > 0.6, 0.6); this.nib.position.y += 0.35; }
        else { this.nib.rotation.y = -n.yaw; poseNib(this.nib, dt, n.moving, this.nibTalk || 0); }
        this.nibTalk = Math.max(0, (this.nibTalk || 0) - dt);
        if (G.elowen?.where === 'hut' && G.dialog) { this.nib.lookAt(G.elowen.x, n.y, G.elowen.z); }

        // Elowen: frozen in her bubble, then free
        const E = this.elowen, B = this.bubble;
        if (!G.won) {
            E.position.set(SITES.heart.x, HILLTOP + SITES.gallery.up + 0.25 + Math.sin(time * 0.3) * 0.02, SITES.heart.z);
            E.rotation.y = 0.0;
            poseElowen(E, 'frozen', 0);
            B.visible = true;
            B.position.set(SITES.heart.x, HILLTOP + SITES.gallery.up + 1.3, SITES.heart.z);
            B.scale.setScalar(1 + Math.sin(time * 1.3) * 0.01);
            B.material.opacity = 0.18 + Math.sin(time * 0.9) * 0.04;
            if (Math.random() < 0.3) { const a = Math.random() * 6.28, b = Math.random() * 3.14; fx.add.spawn(B.position.x + Math.cos(a) * Math.sin(b) * 1.25, B.position.y + Math.cos(b) * 1.25, B.position.z + Math.sin(a) * Math.sin(b) * 1.25, 0, 0, 0, new THREE.Color(0xc8a8ff), 0.12, 2.5, {}); }
        } else {
            B.visible = false;
            const e = G.elowen || { x: SITES.heart.x, y: HILLTOP + SITES.gallery.up, z: SITES.heart.z };
            E.position.set(e.x, e.y, e.z);
            E.lookAt(p.x, e.y, p.z); E.rotateY(Math.PI);
            poseElowen(E, 'stand', dt);
        }
        // echoes: visible once shown, by night
        for (const [id, e] of this.echoes) {
            const st = G.echoes[id];
            const target = st === 'shown' ? 0.55 : st === 'heard' && night ? 0.12 : 0;
            e.userData.op = (e.userData.op || 0) + (target - (e.userData.op || 0)) * Math.min(1, dt * 2);
            e.visible = e.userData.op > 0.01;
            if (e.visible) {
                e.traverse((o) => { if (o.isMesh) o.material.opacity = e.userData.op * (0.7 + Math.sin(time * 6 + o.id) * 0.3); });
                e.lookAt(p.x, e.position.y, p.z); e.rotateY(Math.PI);
                poseElowen(e, 'stand', dt);
                if (Math.random() < 0.3) fx.add.spawn(e.position.x + rnd() * 0.6, e.position.y + Math.random() * 1.8, e.position.z + rnd() * 0.6, 0, 0.3, 0, new THREE.Color(0xbfd6ff), 0.12, 1.5, {});
            }
        }

        // shades
        const live = new Set();
        for (const s of G.shades) {
            live.add(s.id);
            let m = this.shadeMeshes.get(s.id);
            if (!m) { m = makeShade(); this.root.add(m); this.shadeMeshes.set(s.id, m); }
            m.position.set(s.x, s.y + 0.15 + Math.sin(time * 2 + s.ph) * 0.12, s.z);
            m.lookAt(p.x, m.position.y, p.z); m.rotateY(Math.PI);
            if (Math.random() < 0.4) fx.soft.spawn(s.x + rnd() * 0.6, s.y + 0.3 + Math.random() * 1.5, s.z + rnd() * 0.6, rnd() * 0.3, 0.4, rnd() * 0.3, new THREE.Color(0x0a0410), 0.9, 1.6, { grow: 0.4, alpha: 0.5 });
        }
        for (const [id, m] of this.shadeMeshes) if (!live.has(id)) { this.root.remove(m); this.shadeMeshes.delete(id); }

        // wards worn: motes orbiting you
        for (const e in p.wards) {
            const c = new THREE.Color(this.colorOf(e));
            if (Math.random() < 0.4) { const a = time * 2 + Math.random() * 6.28; fx.add.spawn(p.x + Math.cos(a) * 1.7, p.y + 0.2 + Math.random() * 1.2, p.z + Math.sin(a) * 1.7, -Math.sin(a) * 0.8, 0.2, Math.cos(a) * 0.8, c, 0.06, 1.0, {}); }
            if (e === 'rime' && Math.random() < 0.4) fx.add.spawn(p.x + rnd(), p.y + 0.05, p.z + rnd(), 0, 0.1, 0, new THREE.Color(0xe8f6ff), 0.25, 1.5, {});
        }
        this.fx.syncSeals(G, (e) => this.colorOf(e), time, dt);

        // ambience: fireflies by night, motes in the hut, wind on the moor, leaves in the wood
        const reg = p.region;
        if (night && (reg === 'wood' || reg === 'heath' || reg === 'shore') && Math.random() < 0.35) fx.add.spawn(p.x + rnd() * 30, p.y + 0.5 + Math.random() * 2.5, p.z + rnd() * 30, rnd() * 0.4, rnd() * 0.2, rnd() * 0.4, new THREE.Color(0xd8ff7a), 0.12, 4, {});
        if (p.inside && Math.random() < 0.3) fx.add.spawn(p.x + rnd() * 6, p.y + Math.random() * 2.4, p.z + rnd() * 5, rnd() * 0.05, 0.02, rnd() * 0.05, new THREE.Color(0xffe0a8), 0.04, 6, { alpha: 0.4 });
        if (reg === 'moor' && Math.random() < 0.4) fx.soft.spawn(p.x + rnd() * 30 - 10, p.y + Math.random() * 4, p.z + rnd() * 30, 9, 0, rnd() * 2, new THREE.Color(0xffffff), 0.35, 2.5, { alpha: 0.15 });
        const sd = Math.hypot(p.x - SITES.storm.x, p.z - SITES.storm.z);
        if (sd < 40) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = Math.random() * SITES.storm.wind; fx.soft.spawn(SITES.storm.x + Math.cos(a) * r, W.height(SITES.storm.x, SITES.storm.z) + Math.random() * 6, SITES.storm.z + Math.sin(a) * r, Math.cos(a) * 12 - Math.sin(a) * 6, 0.5, Math.sin(a) * 12 + Math.cos(a) * 6, new THREE.Color(0xe8e8f0), 0.5, 1.2, { alpha: 0.25 }); }
        if (reg === 'wood' && !night && Math.random() < 0.08) fx.soft.spawn(p.x + rnd() * 20, p.y + 6, p.z + rnd() * 20, rnd(), -0.6, rnd(), new THREE.Color(0xa8b04a), 0.15, 8, { alpha: 0.9 });

        fx.update(dt, time);
        this.stage.render();
    }

    /** The colour of a slot's spell, only if the notebook knows what it does. */
    knownSpellColor(G, slot) {
        const N = G.notes;
        const words = slot.glyphs.filter((g) => N.glyphs[g]);
        if (!words.length) return null;
        const es = words.map((g) => N.glyphs[g].essence);
        if (es.some((e) => !e)) return null;
        if (es.length === 2 && es[0] !== es[1]) return '#efe8ff';
        return N.colors[es[0]] || null;
    }

    /** Is the player's eye under water? (for a tint) */
    underwater(G) { const p = G.p; const w = this.W.water(p.x, p.z); return w && p.y + PLAYER.eye < w.level; }
}
