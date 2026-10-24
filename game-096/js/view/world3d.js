// The level as a scene: slabs, scenery, props and every moving thing, all following the sim's state.

import { THREE, G, Merger, toon, vcMat, mesh, inked, shade, mix, glowSprite, clamp, damp, lerp, smooth } from './kit.js';
import { hash3 } from '../rng.js';
import { buildDecor } from './decor.js';
import * as P from './props.js';
import * as M from './models.js';
import { groundBelow } from '../sim/world.js';
import { SLAB, FWD, RGT } from '../sim/levels.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- slabs
function buildSlabs(level, theme) {
    const Mg = new Merger(), foam = new Merger();
    const wy = level.waterY;
    const deep = mix(theme.water[1], 0x1a2a4a, 0.5);
    level.solids.forEach((b, i) => {
        const look = b.look || 'ground';
        const [body0, cap0] = theme.slab[look] || theme.slab.ground;
        const v = 0.93 + hash3(Math.round(b.x0 * 10), Math.round(b.z0 * 10), i) * 0.14;
        const body = shade(body0, v), cap = shade(cap0, v);
        const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const capH = 0.42;
        const bottom = (look === 'raft' || look === 'crumble') ? b.y0 : Math.min(b.y0, wy - 0.7);
        const bodyTop = b.y1 - capH;
        // the body, with a darker, wetter foot
        const wet = Math.min(bodyTop - 0.3, wy + 0.5);
        if (wet > bottom) Mg.put(G.box(w, wet - bottom, d), mix(body, deep, 0.45), cx, (wet + bottom) / 2, cz);
        const upper0 = Math.max(bottom, wet);
        if (bodyTop > upper0) Mg.put(G.box(w, bodyTop - upper0, d), body, cx, (bodyTop + upper0) / 2, cz);
        // the cap, a little wider than the body so the edge reads as a lip
        const tile = look === 'stone' || look === 'plank' || look === 'arena' || look === 'coral';
        if (!tile) Mg.put(G.box(w + 0.14, capH, d + 0.14), cap, cx, b.y1 - capH / 2, cz);
        else if (look === 'plank') {
            const alongX = w >= d, len = alongX ? w : d, n = Math.max(1, Math.round(len / 1.1)), step = len / n;
            for (let k = 0; k < n; k++) {
                const c = shade(cap, 0.94 + hash3(k, i, 7) * 0.12);
                const p = (alongX ? b.x0 : b.z0) + step * (k + 0.5);
                if (alongX) Mg.put(G.box(step - 0.06, capH, d + 0.14), c, p, b.y1 - capH / 2, cz);
                else Mg.put(G.box(w + 0.14, capH, step - 0.06), c, cx, b.y1 - capH / 2, p);
            }
        } else {
            const ts = 2.0, nx = Math.max(1, Math.round(w / ts)), nz = Math.max(1, Math.round(d / ts));
            for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
                const sx = w / nx, sz = d / nz;
                const col = shade(cap, ((a + c) & 1) ? 0.95 : 1.04);
                Mg.put(G.box(sx - 0.04 + (a === 0 || a === nx - 1 ? 0.08 : 0), capH, sz - 0.04 + (c === 0 || c === nz - 1 ? 0.08 : 0)), col, b.x0 + sx * (a + 0.5), b.y1 - capH / 2, b.z0 + sz * (c + 0.5));
            }
        }
        if (look === 'arena') {
            const R = Math.min(w, d) / 2;
            Mg.put(G.cyl(R * 0.82, R * 0.82, 0.05, 40), shade(cap, 0.88), cx, b.y1 + 0.02, cz);
            Mg.put(G.cyl(R * 0.74, R * 0.74, 0.07, 40), shade(cap, 1.08), cx, b.y1 + 0.03, cz);
            Mg.put(G.cyl(R * 0.3, R * 0.3, 0.09, 24), shade(cap, 0.9), cx, b.y1 + 0.04, cz);
        }
        // pebbles and a shaded rim
        if (!tile || look === 'coral') for (let k = 0; k < Math.min(10, Math.floor(w * d / 14)); k++) {
            const px = b.x0 + 0.5 + hash3(i, k, 1) * (w - 1), pz = b.z0 + 0.5 + hash3(i, k, 2) * (d - 1);
            Mg.put(G.sphere(0.12 + hash3(i, k, 3) * 0.1, 5, 4), shade(cap, 0.9 + hash3(i, k, 4) * 0.2), px, b.y1 + 0.01, pz, 1, 0.5, 1);
        }
        // foam where the sea meets the stone
        if (look !== 'raft' && look !== 'crumble') {
            const f = 0.95, fy = wy + 0.04, c = 0xffffff;
            foam.put(G.box(w + f * 2, 0.04, f), c, cx, fy, b.z0 - f / 2 - 0.1);
            foam.put(G.box(w + f * 2, 0.04, f), c, cx, fy, b.z1 + f / 2 + 0.1);
            foam.put(G.box(f, 0.04, d), c, b.x0 - f / 2 - 0.1, fy, cz);
            foam.put(G.box(f, 0.04, d), c, b.x1 + f / 2 + 0.1, fy, cz);
        }
    });
    const mg = Mg.build();
    const slabMesh = new THREE.Mesh(mg, vcMat());
    slabMesh.castShadow = true; slabMesh.receiveShadow = true;
    const fg = foam.build();
    const foamMesh = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false }));
    foamMesh.renderOrder = 1;
    return { slabMesh, foamMesh };
}

function raftModel(w, d, theme) {
    const g = new THREE.Group();
    const n = Math.max(3, Math.round(Math.min(w, d) / 0.9));
    const alongX = w >= d;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const geo = alongX ? G.cyl(0.46, 0.46, d + 0.4, 8) : G.cyl(0.46, 0.46, w + 0.4, 8);
        const log = inked(geo, toon(shade(0xb8743a, 0.9 + (i % 3) * 0.08)), 0.03);
        if (alongX) { log.rotation.x = Math.PI / 2; log.position.set((t - 0.5) * w, -0.46, 0); }
        else { log.rotation.z = Math.PI / 2; log.position.set(0, -0.46, (t - 0.5) * d); }
        g.add(log);
    }
    for (const s of [-1, 1]) {
        const rope = mesh(G.torus(0.5, 0.04, 5, 14), toon(0xe8d5a0), { cast: false });
        rope.rotation.x = Math.PI / 2;
        if (alongX) { rope.position.set(s * w * 0.3, -0.46, 0); rope.rotation.set(0, Math.PI / 2, 0); rope.scale.set(d / 1.0, 1, 1); }
        else { rope.position.set(0, -0.46, s * d * 0.3); rope.scale.set(w / 1.0, 1, 1); rope.rotation.x = 0; rope.rotation.y = 0; }
        g.add(rope);
    }
    g.add(mesh(G.box(w, 0.1, d), toon(0xd9a86e), { cast: false, receive: true }));
    g.children[g.children.length - 1].position.y = -0.04;
    // a little flag so it reads as a ride
    const pole = mesh(G.cyl(0.04, 0.04, 1.4, 5), toon(0xf6f0e0), { cast: false });
    pole.position.set(w / 2 - 0.3, 0.7, d / 2 - 0.3); g.add(pole);
    const fl = mesh(G.box(0.5, 0.3, 0.03), toon(0xff6b6b), { cast: false }); fl.position.set(w / 2 - 0.05, 1.2, d / 2 - 0.3); g.add(fl);
    return g;
}

function crumbleModel(w, d, theme) {
    const g = new THREE.Group();
    const c = theme.slab.crumble;
    g.add(inked(G.box(w, 1.0, d), toon(c[0]), 0.03, { receive: true }));
    g.children[0].position.y = -0.5;
    g.add(mesh(G.box(w + 0.1, 0.22, d + 0.1), toon(c[1]), { receive: true }));
    g.children[1].position.y = -0.11;
    // cracks
    for (let i = 0; i < 3; i++) {
        const cr = mesh(G.box(0.05, 0.02, d * 0.5), toon(shade(c[0], 0.55)), { cast: false });
        cr.position.set((i - 1) * w * 0.28, 0.005, (i - 1) * 0.15); cr.rotation.y = 0.5 * (i - 1); g.add(cr);
    }
    return g;
}

// ---------------------------------------------------------------- shots
function shotModel(kind) {
    if (kind === 'coconut') {
        const g = new THREE.Group();
        g.add(inked(G.sphere(0.34, 12, 9), toon(0x6b4426), 0.03));
        for (let i = 0; i < 3; i++) { const a = i * 2.1; g.add(mesh(G.sphere(0.05, 5, 4), toon(0x2a1810), { cast: false })); g.children[g.children.length - 1].position.set(Math.cos(a) * 0.14, 0.2, Math.sin(a) * 0.14 - 0.14); }
        return g;
    }
    if (kind === 'ball') return inked(G.sphere(0.42, 12, 9), toon(0x2a2f3a), 0.03);
    if (kind === 'rock') return inked(G.sphere(0.44, 8, 6), toon(0xe2c07a), 0.03);
    // fish
    const g = new THREE.Group();
    g.add(inked(G.sphere(0.34, 10, 8), toon(0xbfe8ff, { emissive: 0x405a70 }), 0.025));
    g.children[0].scale.set(0.6, 0.8, 1.4);
    const tail = mesh(G.cone(0.2, 0.4, 4), toon(0x8ad0ff), { cast: false }); tail.rotation.x = -Math.PI / 2; tail.position.z = 0.55; g.add(tail);
    g.add(glowSprite(0xdff6ff, 1.3, 0.5));
    return g;
}

const ENEMY = { flea: M.makeFlea, starfish: M.makeStarfish, jelly: M.makeJelly, monkey: M.makeMonkey, cannon: M.makeCannon, gull: () => M.makeGull(1), knight: M.makeKnight };

// ================================================================ the whole thing
export class WorldView {
    constructor(level, theme, G0) {
        this.level = level; this.theme = theme;
        this.root = new THREE.Group();
        const { slabMesh, foamMesh } = buildSlabs(level, theme);
        this.slabMesh = slabMesh; this.foamMesh = foamMesh;
        this.root.add(slabMesh, foamMesh);

        this.decor = buildDecor(level, theme);
        this.root.add(this.decor.group);

        // movers and crumbles
        this.movers = level.movers.map((m) => {
            const g = raftModel(m.x1 - m.x0, m.z1 - m.z0, theme);
            this.root.add(g); return g;
        });
        this.crumbles = level.crumbles.map((c) => {
            const g = crumbleModel(c.x1 - c.x0, c.z1 - c.z0, theme);
            g.position.set((c.x0 + c.x1) / 2, c.y1, (c.z0 + c.z1) / 2);
            this.root.add(g); return g;
        });

        // props
        this.pearls = new P.Pearls(G0.pearlL);
        this.curios = new P.Curios(level.curios);
        this.crates = new P.Crates(level.crates);
        this.springs = new P.Springs(level.springs);
        this.barrels = new P.Barrels(level.launchers);
        this.vents = new P.Vents(level.vents);
        this.switches = new P.Switches(level.switches);
        this.gates = new P.Gates(level.gates, theme);
        for (const o of [this.pearls, this.curios, this.crates, this.springs, this.barrels, this.vents, this.switches, this.gates]) this.root.add(o.root);

        if (level.goal) {
            this.goal = P.makeGoal(theme);
            this.goal.root.position.set(level.goal.x, level.goal.y, level.goal.z);
            const near = level.sections.find((s) => level.goal.x >= s.x0 && level.goal.x <= s.x1 && level.goal.z >= s.z0 && level.goal.z <= s.z1);
            this.goal.root.rotation.y = (near && near.h != null ? near.h : 0) * Math.PI / 2;
            this.root.add(this.goal.root);
        }
        this.signs = level.signs.map((s) => {
            const g = P.makeSign(s.key); g.position.set(s.x, s.y, s.z); g.rotation.y = s.yaw; this.root.add(g); return g;
        });
        this.hazards = level.hazards.map((h) => {
            const g = h.kind === 'spinner' ? P.makeSpinner(h) : P.makeUrchin();
            g.position.set(h.x, h.y, h.z); this.root.add(g); return { g, h };
        });
        this.flags = [];
        this.startFlag = null;

        // enemies, with a stump under anyone who stands above the slab
        this.enemies = G0.enemies.map((e) => {
            const maker = ENEMY[e.kind];
            const mdl = maker();
            this.root.add(mdl.root);
            if (e.kind === 'monkey' && e.hy > 0.2 + this._slabTop(e.hx, e.hz, e.hy)) {
                const base = this._slabTop(e.hx, e.hz, e.hy);
                const st = inked(G.cyl(0.55, 0.7, e.hy - base + 0.1, 10), toon(0x9a6a3c), 0.03);
                st.position.set(e.hx, base + (e.hy - base) / 2, e.hz);
                this.root.add(st);
            }
            return { mdl, e };
        });
        this.boss = null;
        if (G0.boss) {
            const mk = { coco: M.makeCoco, sandy: M.makeSandy, squawk: M.makeSquawk }[G0.boss.kind]();
            this.root.add(mk.root);
            this.boss = mk;
            this.bossMark = mesh(new THREE.RingGeometry(0.9, 1.4, 32), new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }), { cast: false });
            this.bossMark.rotation.x = -Math.PI / 2; this.root.add(this.bossMark);
        }
        // at Home Reef the family waits by the arch
        this.family = [];
        if (level.meta.final && level.goal) {
            const g = level.goal, sec = level.sections.find((s) => g.x >= s.x0 && g.x <= s.x1 && g.z >= s.z0 && g.z <= s.z1);
            const h = (sec && sec.h) || 0, f = FWD[h], r = RGT[h];
            const cast = [
                { name: 'ma', a: -1.6, b: 3.6, o: { body: 0xff8a6b, belly: 0xffc9b0, dark: 0xd95a3a, goggles: false, scale: 1.15 }, shell: 0 },
                { name: 'pa', a: 1.8, b: 4.0, o: { body: 0xd63a2a, belly: 0xff9a80, dark: 0xa02418, goggles: false, scale: 1.3 }, shell: 1 },
                { name: 'dot', a: -0.3, b: 5.2, o: { body: 0xff9ec4, belly: 0xffd6e6, dark: 0xe06a9a, goggles: true, scale: 0.7 }, shell: 3 },
                { name: 'granny', a: 3.8, b: 5.4, o: { body: 0xb49be0, belly: 0xe0d4f8, dark: 0x8a6ac0, goggles: false, scale: 1.05 }, shell: 0 },
            ];
            cast.forEach((c, i) => {
                const pn = M.makePinch(c.o); pn.setShell(c.shell);
                const x = g.x + r[0] * c.a + f[0] * c.b, z = g.z + r[1] * c.a + f[1] * c.b;
                pn.root.position.set(x, g.y, z);
                this.root.add(pn.root);
                this.family.push({ pn, x, y: g.y, z, i, yaw: Math.atan2(f[0], f[1]) });
            });
        }
        this.ringMeshes = [];
        this.shotMeshes = new Map();

        // company: gulls wheeling far away, and fish that leap near the path
        this.birds = [];
        const b0 = level.bounds, bcx = (b0.x0 + b0.x1) / 2, bcz = (b0.z0 + b0.z1) / 2, bspan = Math.max(b0.x1 - b0.x0, b0.z1 - b0.z0, 70);
        for (let i = 0; i < 4; i++) {
            const g = M.makeGull(0.55); this.root.add(g.root);
            this.birds.push({ g, a: i * 1.7, r: bspan * (0.35 + 0.2 * i / 3), y: level.waterY + 20 + i * 5, cx: bcx, cz: bcz, sp: 0.12 + i * 0.02 });
        }
        this.fish = [];
        this.fishT = 2;

        // shadow blobs
        this.blobN = 48;
        this.blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), this.blobN);
        this.blobs.frustumCulled = false; this.blobs.renderOrder = 2;
        this.root.add(this.blobs);
        this.tm = new THREE.Matrix4(); this.tq = new THREE.Quaternion(); this.tp = new THREE.Vector3(); this.ts = new THREE.Vector3();

        // the chase wave
        if (level.chase) {
            const w = new THREE.Group();
            const body = inked(G.cyl(7, 7, 80, 20), toon(theme.water[1]), 0.05);
            body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 1); body.position.y = 2;
            w.add(body);
            const crest = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 80, 20, 1, true, 0, Math.PI), toon(0xffffff, { side: THREE.DoubleSide })); crest.rotation.z = Math.PI / 2; crest.position.y = 2.6;
            const eyes = new THREE.Group();
            for (const s of [-1, 1]) { const e = M.eye(1.6, [0, 0, -1]); e.position.set(s * 4.5, 7, -6); eyes.add(e); const brow = mesh(G.box(3.2, 0.5, 0.5), toon(0x14325a), { cast: false }); brow.position.set(s * 4.5, 9.4, -6.6); brow.rotation.z = s * -0.35; eyes.add(brow); }
            w.add(eyes);
            const mouth = mesh(G.torus(2.6, 0.3, 6, 16, Math.PI), toon(0x14325a), { cast: false }); mouth.position.set(0, 3.4, -6.6); mouth.rotation.z = 0; w.add(mouth);
            this.wave = w; this.root.add(w);
        }
    }

    _slabTop(x, z, y) {
        let best = -Infinity;
        for (const b of this.level.solids) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.01 && b.y1 > best) best = b.y1;
        return best === -Infinity ? y : best;
    }

    addFlag(x, y, z) {
        const f = P.makeFlag();
        f.position.set(x, y, z); f.scale.y = 0.01; f.userData.grow = 0;
        this.root.add(f); this.flags.push(f);
    }

    update(G0, dt, t, fx, player) {
        const p = G0.p;
        this.pearls.update(G0, t);
        this.curios.update(G0, t);
        this.crates.update(G0, t, fx);
        this.springs.update(G0, t);
        this.barrels.update(G0, t);
        this.vents.update(G0, t, fx, dt, p.x, p.z);
        this.switches.update(G0, t);
        this.gates.update(G0, t, dt);

        G0.mbox.forEach((b, i) => { this.movers[i].position.set((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2); });
        G0.crumbs.forEach((c, i) => {
            const g = this.crumbles[i], b = this.level.crumbles[i];
            if (c.state === 0) { g.visible = true; g.position.y = b.y1; g.position.x = (b.x0 + b.x1) / 2; g.scale.setScalar(Math.min(1, g.scale.x + dt * 4)); }
            else if (c.state === 1) { g.position.x = (b.x0 + b.x1) / 2 + Math.sin(t * 70) * 0.05; g.position.y = b.y1 - c.t * 0.1; if (Math.random() < dt * 20) fx.dust((b.x0 + b.x1) / 2 + (Math.random() - 0.5) * (b.x1 - b.x0), b.y1, (b.z0 + b.z1) / 2 + (Math.random() - 0.5) * (b.z1 - b.z0), 1, 0xe8d6a8, 0.6, 0.35); }
            else { g.position.y = b.y1 - 0.4 - c.t * c.t * 22; g.visible = c.t < 0.7 || c.t > 3.2; if (c.t > 3.2) { g.position.y = b.y1; g.scale.setScalar(Math.max(0.01, (c.t - 3.2) * 2.5)); } }
        });

        if (this.goal) {
            this.goal.spin.rotation.y = t * 1.4;
            this.goal.spin.position.y = 1.5 + Math.sin(t * 2) * 0.12;
            this.goal.glow.material.opacity = 0.4 + Math.sin(t * 3) * 0.1;
            this.goal.banner.rotation.y = Math.sin(t * 0.9) * 0.05;
        }
        for (const hz of this.hazards) {
            if (hz.h.kind === 'spinner') hz.g.userData.arms.rotation.y = -((hz.h.phase || 0) + G0.t * (hz.h.speed || 1.6));
            else hz.g.rotation.y = t * 0.3;
        }
        for (const f of this.flags) {
            f.userData.grow = Math.min(1, f.userData.grow + dt * 2);
            f.scale.y = smooth(f.userData.grow);
            f.userData.cloth.rotation.y = Math.sin(t * 5 + f.position.x) * 0.25;
        }

        // enemies
        for (const { mdl, e } of this.enemies) {
            const ge = G0.enemies[e.id];
            if (!ge.alive) {
                const k = ge.dieT / 0.45;
                if (k >= 1) { mdl.root.visible = false; continue; }
                mdl.root.visible = true;
                mdl.update(ge, dt, t);
                mdl.root.scale.setScalar(Math.max(0.01, 1 - k * k));
                mdl.root.position.y += k * 1.4; mdl.root.rotation.y += k * 12;
                continue;
            }
            mdl.root.visible = true; mdl.root.scale.setScalar(1);
            mdl.update(ge, dt, t);
        }
        if (this.boss && G0.boss) {
            this.boss.update(G0.boss, dt, t);
            const B = G0.boss;
            if (this.bossMark) {
                const on = B.kind === 'squawk' && (B.state === 'mark' || B.state === 'dive');
                this.bossMark.material.opacity = on ? 0.5 + Math.sin(t * 20) * 0.25 : 0;
                if (on) { this.bossMark.position.set(B.state === 'dive' ? B.dx : B.mx, G0.level.arena.y + 0.08, B.state === 'dive' ? B.dz : B.mz); const k = B.state === 'mark' ? 1.4 - Math.min(1, B.t / 1.35) * 0.6 : 0.8; this.bossMark.scale.setScalar(k * 2.2); }
            }
        }

        // boss rings
        const rings = G0.rings || [];
        while (this.ringMeshes.length < rings.length) {
            const m = mesh(new THREE.TorusGeometry(1, 0.12, 6, 40), toon(0xffa14d, { emissive: 0x803010 }), { cast: false });
            m.rotation.x = Math.PI / 2; this.root.add(m); this.ringMeshes.push(m);
        }
        this.ringMeshes.forEach((m, i) => {
            const r = rings[i];
            m.visible = !!r;
            if (r) { m.position.set(r.x, r.y + 0.28, r.z); m.scale.set(r.r, r.r, 1.6); }
        });

        // shots
        const live = new Set();
        for (const s of G0.shots) {
            live.add(s.id);
            let m = this.shotMeshes.get(s.id);
            if (!m) { m = shotModel(s.kind); this.root.add(m); this.shotMeshes.set(s.id, m); }
            m.position.set(s.x, s.y, s.z);
            m.rotation.y += dt * 8; m.rotation.x += dt * 6;
            if (s.kind === 'fish') m.rotation.set(0, Math.atan2(-s.vx, -s.vz), 0);
            if (Math.random() < dt * 30) fx.glow.emit(s.x, s.y, s.z, 0, 0, 0, 0.3, 0.22, s.owner === 'p' ? 0xfff0a0 : 0xffffff, { alpha: 0.5 });
        }
        for (const [id, m] of this.shotMeshes) if (!live.has(id)) { this.root.remove(m); this.shotMeshes.delete(id); }

        // the family cheers when he gets close
        for (const fm of this.family) {
            const near = Math.hypot(p.x - fm.x, p.z - fm.z) < 16 || G0.status === 'won';
            const hop = near ? Math.abs(Math.sin(t * 3.2 + fm.i * 1.3)) * 0.45 : 0;
            fm.pn.update({ x: fm.x, y: fm.y + hop, z: fm.z, vx: 0, vy: hop > 0.05 ? 3 : 0, vz: 0, yaw: fm.yaw, grounded: hop < 0.05, spinT: near && Math.sin(t * 1.1 + fm.i) > 0.85 ? 0.3 : 0, rollT: 0, brace: false, glide: false, slam: 0, charge: 0, hurtT: 0, dead: 0, shell: fm.pn.state.shell, launch: null }, dt, t);
        }

        // gulls and fish
        for (const b of this.birds) {
            b.a += dt * b.sp;
            const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
            b.g.update({ x, y: b.y + Math.sin(t * 0.7 + b.a * 3) * 1.5, z, face: Math.atan2(Math.sin(b.a), -Math.cos(b.a)) * -1 + Math.PI, id: b.a, state: 0 }, dt, t);
        }
        this.fishT -= dt;
        if (this.fishT <= 0 && G0.status === 'play') {
            this.fishT = 2.5 + Math.random() * 3;
            const a = Math.random() * TAU, d = 5 + Math.random() * 9;
            const m = shotModel('fish'); m.scale.setScalar(1.1); this.root.add(m);
            this.fish.push({ m, x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, t: 0, vx: Math.cos(a + 1.5) * 1.2, vz: Math.sin(a + 1.5) * 1.2, wy: this.level.waterY });
        }
        for (let i = this.fish.length - 1; i >= 0; i--) {
            const f = this.fish[i];
            f.t += dt;
            const k = f.t / 1.1;
            if (k >= 1) { fx.splash(f.x, f.wy, f.z, 8); this.root.remove(f.m); f.m.traverse((o) => { if (o.isSprite) o.material.dispose(); }); this.fish.splice(i, 1); continue; }
            const y = f.wy + Math.sin(k * Math.PI) * 2.6 - 0.2;
            f.m.position.set(f.x + f.vx * f.t, y, f.z + f.vz * f.t);
            f.m.rotation.set(Math.cos(k * Math.PI) * 0.9, Math.atan2(-f.vx, -f.vz), 0);
            if (f.t < 0.04) fx.splash(f.x, f.wy, f.z, 8);
        }

        // wave
        if (this.wave) {
            this.wave.position.set(this.level.start.x, this.level.waterY - 1, G0.waveZ + 7);
            this.wave.children[0].position.x = 0;
        }

        // shadow blobs under the player and everything near
        let n = 0;
        const put = (x, y, z, r) => {
            if (n >= this.blobN) return;
            const gy = groundBelow(G0, x, z, y + 0.3, 0.25);
            if (gy === -Infinity) return;
            const h = Math.max(0, y - gy);
            const sc = r * Math.max(0.35, 1 - h * 0.09);
            this.tp.set(x, gy + 0.04, z); this.ts.set(sc * 2, 1, sc * 2);
            this.tm.compose(this.tp, this.tq, this.ts);
            this.blobs.setMatrixAt(n++, this.tm);
        };
        if (p.dead <= 0) put(p.x, p.y, p.z, 0.62);
        for (const e of G0.enemies) if (e.alive && Math.abs(e.x - p.x) < 36 && Math.abs(e.z - p.z) < 36 && e.kind !== 'jelly') put(e.x, e.y + (e.kind === 'gull' ? 0 : 0.02), e.z, e.kind === 'cannon' ? 0.95 : e.kind === 'knight' ? 0.85 : 0.6);
        for (const s of G0.shots) put(s.x, s.y, s.z, 0.36);
        if (G0.boss && G0.boss.alive) put(G0.boss.x, G0.boss.y, G0.boss.z, G0.boss.kind === 'squawk' ? 1.6 : 2.2);
        for (const c of this.decor.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > c.userData.cx + c.userData.span * 1.3) c.position.x -= c.userData.span * 2.6; }
        this.blobs.count = n;
        this.blobs.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.root.traverse((o) => {
            if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose?.();
            if (o.isSprite) o.material.dispose?.();
            for (const m of [].concat(o.material || [])) if (m.map && m.map.userData.own && !m.map.userData.keep) m.map.dispose();
        });
    }
}
