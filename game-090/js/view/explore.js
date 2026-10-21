// The exploration view: a third-person camera on the Agent, the floor built from the generated
// layout, the Hexes with their packs, chests, stairs and the boss dais. Reads G.explore every
// frame and never writes it. World = sim cell × CELL on x and z; the camera sits to the +z side
// of the Agent at yaw 0 and the player can swing it round.

import * as THREE from 'three';
import { buildEnvironment, CELL, themeOf } from './env.js';
import { buildCast } from './humans.js';
import { buildDaemon, hexify } from './daemons3d.js';
import { gateUp, stairsDown, anchor, chest, bossDais, portal, alertSprite } from './markers.js';
import { FX } from './fx.js';
import { TOON, toonMat } from './toon.js';
import { dotTexture } from './tex.js';
import { ZONES, bossAt } from '../sim/data/zones.js';
import { DAEMONS } from '../sim/data/daemons.js';

const facing = (a) => Math.PI / 2 - a;

function blob(r = 0.6) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), new THREE.MeshBasicMaterial({ map: dotTexture(), color: '#000000', transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
    return m;
}

export class ExploreView {
    constructor(quality = 2) {
        this.quality = quality;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(48, 1, 0.3, 160);
        this.fx = new FX(this.scene);
        this.yaw = 0.0; this.pitch = 1.0; this.zoomK = 1;
        this.key = '';
        this.env = null;
        this.player = null;
        this.foes = [];
        this.markers = [];
        this.chests = [];
        this.t = 0;
        this.atk = 0; this.step = 0;
        this.camPos = new THREE.Vector3(); this.look = new THREE.Vector3();
        this.pending = [];
        this.bossModel = null;
    }

    /** World → screen yaw conversion for the player's stick: screen-up becomes the camera's forward. */
    toWorld(ix, iy) {
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        return { x: c * ix + s * iy, y: -s * ix + c * iy };
    }
    orbit(dx) { this.yaw -= dx * 0.006; }
    zoom(f) { this.zoomK = Math.max(0.65, Math.min(1.6, this.zoomK * f)); }

    clear() {
        if (this.env) { this.scene.remove(this.env.group); this.env.dispose(); this.env = null; }
        for (const o of [this.player?.root, ...this.markers.map((m) => m.root), ...this.chests.map((c) => c.m.root), ...this.foes.map((f) => f.root)]) if (o) this.scene.remove(o);
        this.player = null; this.foes = []; this.markers = []; this.chests = []; this.bossModel = null;
        this.fx.clear();
    }

    /** Build everything for the floor the Agent is on. */
    build(G, look = 0) {
        this.clear();
        const X = G.explore;
        const rec = X.floors[X.cur];
        const fl = rec.fl;
        const Z = ZONES[X.zone];
        this.env = buildEnvironment(fl, X.zone, X.theme, this.quality);
        this.scene.add(this.env.group);
        const I = this.env.info;
        this.scene.fog = new THREE.Fog(I.fogColor, I.fogNear, I.fogFar);
        this.scene.background = I.fogColor;
        TOON.uRim.value.set(I.rim); TOON.uRimK.value = I.rimK;
        this.zoneLight = Z.light;

        // the Agent
        this.player = buildCast('agent', { look });
        this.scene.add(this.player.root);
        this.player.shadow = blob(0.55); this.player.root.add(this.player.shadow);

        const w = (c, y = 0) => new THREE.Vector3(c.x * CELL + CELL / 2, y, c.y * CELL + CELL / 2);
        const add = (m, pos, rot = 0) => { m.root.position.copy(pos); m.root.rotation.y = rot; this.scene.add(m.root); this.markers.push(m); return m; };
        this.gate = add(gateUp(), w(fl.up));
        if (fl.down) this.stairs = add(stairsDown(), w(fl.down));
        if (fl.anchor) { this.anchorM = add(anchor(), w(fl.anchor)); }
        if (fl.boss) {
            const dais = add(bossDais(DAEMONS[fl.bossId]?.model.c[2] || '#d24bff'), new THREE.Vector3(fl.boss.x * CELL + CELL / 2, 0, fl.boss.y * CELL + CELL / 2));
            this.dais = dais;
            if (!rec.bossDone && fl.bossId) {
                const bm = hexify(buildDaemon(fl.bossId));
                bm.root.position.set(fl.boss.x * CELL + CELL / 2, 0.3, fl.boss.y * CELL + CELL / 2);
                bm.root.scale.multiplyScalar(1.25);
                bm.root.rotation.y = 0;
                this.scene.add(bm.root);
                this.bossModel = bm;
                dais.bossModel = bm;
            }
        }
        if (fl.exit) { this.exitM = add(portal(), w(fl.exit)); this.exitM.root.visible = false; }
        rec.chests.forEach((c) => {
            const m = chest();
            m.root.position.copy(w(c)); m.root.rotation.y = ((c.x * 7 + c.y * 3) % 4) * Math.PI / 2;
            this.scene.add(m.root);
            this.chests.push({ m, c, open: c.open ? 1 : 0 });
        });
        // the Hexes: each a main body and, for a pack, smaller companions behind it
        rec.foes.forEach((f, i) => {
            const grp = f.grp;
            const lead = grp.reduce((a, b) => (DAEMONS[b.id].lv >= DAEMONS[a.id].lv ? b : a), grp[0]);
            const main = hexify(buildDaemon(lead.id));
            const root = new THREE.Group();
            const scaleK = f.elite ? 1.35 : 1;
            main.root.scale.multiplyScalar(scaleK);
            root.add(main.root);
            const pack = [];
            grp.filter((g) => g !== lead).forEach((g, j) => {
                const m = hexify(buildDaemon(g.id));
                m.root.scale.multiplyScalar(0.75);
                m.root.position.set((j ? 1 : -1) * 0.9, 0, -0.9 - j * 0.2);
                root.add(m.root);
                pack.push(m);
            });
            root.add(blob(0.8 * scaleK));
            const al = alertSprite(); al.position.y = main.h * scaleK + 0.8; al.visible = false; root.add(al);
            if (f.elite) { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.8 * scaleK, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffd86a', toneMapped: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.1; root.add(halo); main.elite = halo; }
            this.scene.add(root);
            this.foes.push({ root, main, pack, al, f, i, gone: false, a: 0, ax: f.x, ay: f.y });
        });
        this.key = this.keyOf(G);
        this.snapCamera(G);
    }

    keyOf(G) { const X = G.explore; return X ? `${X.zone}:${X.run}:${X.cur}:${G.runs}` : ''; }

    snapCamera(G) {
        const p = G.explore.p;
        this.look.set(p.x * CELL, 1.2, p.y * CELL);
        this.placeCamera(1);
    }

    placeCamera(k) {
        const asp = this.camera.aspect || 1.6;
        const dist = (asp < 1 ? 17 : 12.5) * this.zoomK;
        const target = new THREE.Vector3(this.look.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist, this.look.y + Math.sin(this.pitch) * dist, this.look.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist);
        this.camPos.lerp(target, k);
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.look);
    }

    play(e, G) {
        switch (e.type) {
            case 'x_swing': this.atk = 0.3; this.slashFx(G); break;
            case 'x_alert': { const f = this.foes[e.idx]; if (f) f.alertT = 1.2; break; }
            case 'x_chest': { const c = this.chests.find((x) => x.c.x === e.x && x.c.y === e.y); if (c) { const p = c.m.root.position; this.fx.burst(new THREE.Vector3(p.x, 0.8, p.z), '#ffd86a', 30, 3.5, 0.9, 0.3, { grav: 3 }); this.fx.light(new THREE.Vector3(p.x, 1.5, p.z), '#ffd86a', 30, 0.7); } break; }
            case 'x_step': { const p = G.explore.p; this.fx.spawn(p.x * CELL, 0.1, p.y * CELL, (Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4, '#bba88a', 0.18, 0.4, { drag: 2 }); break; }
            case 'x_anchor': { const a = G.explore.floors[G.explore.cur].fl.anchor; if (e.healed) { this.fx.recode(new THREE.Vector3(a.x * CELL + CELL / 2, 0, a.y * CELL + CELL / 2)); } break; }
            case 'x_engage': break;
        }
    }

    slashFx(G) {
        const p = G.explore.p;
        const a = p.face;
        const pos = new THREE.Vector3(p.x * CELL + Math.cos(a) * 1.4, 1.0, p.y * CELL + Math.sin(a) * 1.4);
        this.fx.slash(pos, '#cfffe8', 1.5, 0.25, 0.6);
    }

    update(dt, t, G) {
        const X = G.explore;
        if (!X) return;
        if (this.keyOf(G) !== this.key) this.build(G, G.look || 0);
        this.t = t;
        TOON.uTime.value = t;
        const rec = X.floors[X.cur];
        const fl = rec.fl;
        const p = X.p;
        // the Agent
        const pl = this.player;
        pl.root.position.set(p.x * CELL, 0, p.y * CELL);
        pl.root.rotation.y = facing(p.face);
        this.atk = Math.max(0, this.atk - dt);
        pl.pose({ move: p.moving ? 1 : 0, run: p.run && p.moving, atk: this.atk > 0 ? 1 - this.atk / 0.3 : 0 }, t);
        // the Hexes
        for (const o of this.foes) {
            const f = o.f;
            if (f.dead) {
                if (!o.gone) { o.gone = true; this.fx.death(new THREE.Vector3(o.root.position.x, 0, o.root.position.z), '#d24bff'); o.root.visible = false; }
                continue;
            }
            o.ax += (f.x - o.ax) * Math.min(1, dt * 14); o.ay += (f.y - o.ay) * Math.min(1, dt * 14);
            o.root.position.set(o.ax * CELL, 0, o.ay * CELL);
            o.root.rotation.y = facing(f.face);
            const chasing = f.st === 'chase';
            o.main.pose({ move: chasing || f.moving ? 1 : 0, atk: 0, down: f.st === 'stun' ? 0.6 : 0 }, t + o.i);
            o.pack.forEach((m, j) => m.pose({ move: chasing ? 1 : 0 }, t + o.i + j));
            o.alertT = Math.max(0, (o.alertT || 0) - dt);
            o.al.visible = o.alertT > 0 || (chasing && f.alert > 0);
            if (o.al.visible) o.al.position.y = o.main.h * 1.1 + 0.8 + Math.sin(t * 8) * 0.06;
            o.root.visible = Math.hypot(f.x - p.x, f.y - p.y) < 20;
        }
        // markers and chests
        for (const m of this.markers) m.update(t, m === this.anchorM ? rec.anchorUsed : undefined);
        for (const c of this.chests) { c.open += ((c.c.open ? 1 : 0) - c.open) * Math.min(1, dt * 6); c.m.update(t, c.open); }
        if (this.exitM) this.exitM.root.visible = rec.bossDone || !fl.boss;
        if (this.bossModel) { this.bossModel.pose({ cast: 0 }, t); this.bossModel.root.visible = !rec.bossDone; if (rec.bossDone) this.bossModel = null; }
        // camera
        this.look.lerp(new THREE.Vector3(p.x * CELL, 1.3, p.y * CELL), Math.min(1, dt * 7));
        this.placeCamera(Math.min(1, dt * 6));
        this.env.update(t, p.x * CELL, p.y * CELL, this.camera.position);
        this.fx.update(dt, this.camera);
    }

    /** Screen position of a world point (px), for UI markers. */
    project(v, w, h) {
        const q = v.clone().project(this.camera);
        return { x: (q.x * 0.5 + 0.5) * w, y: (-q.y * 0.5 + 0.5) * h, behind: q.z > 1 };
    }
}
