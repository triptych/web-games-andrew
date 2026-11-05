// The view: reads G every frame and answers its events. It never changes G. Three modes share one renderer:
//   title - the painted realm drifting past behind the menu
//   map   - the overworld: pan and pinch, towns, the wagon on its road
//   town  - a street of venues
// ui.js places its DOM buttons at the points this view reports.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { World } from './world.js';
import { TownScene } from './town.js';
import { TOWN } from '../sim/data/towns.js';
import { heroTownFor } from '../sim/quest.js';

export class View {
    constructor(canvas) {
        this.stage = new Stage(canvas);
        this.world = new World(this.stage);
        this.town = new TownScene(this.stage);
        this.mode = 'title';
        this.ready = false;
        this.mapCam = { x: 50, z: 36, dist: 66, manual: false };
        this.townSig = '';
        this.canvas = canvas;
        this.pointers = new Map();
        this.pinch = 0;
        this.moved = 0;
        this.lastLoc = null;
        this.stage.resize(true);
        this.bindPointers();
        const onResize = () => this.stage.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    /** Paint the world (a second or two). */
    init() {
        this.world.build();
        this.ready = true;
        this.setMode(this.mode, true);
    }
    setMode(mode, force = false) {
        if (mode === this.mode && !force) return;
        this.mode = mode;
        if (!this.ready) return;
        if (mode === 'map' || mode === 'title') { this.stage.setScene(this.world.scene, 0x2e70a8); this.mapCam.manual = false; }
        if (mode === 'town') this.townSig = '';
    }
    focusMap(x, z, dist) { Object.assign(this.mapCam, { x, z, dist: dist ?? this.mapCam.dist, manual: false }); }

    bindPointers() {
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => {
            if (this.mode !== 'map') return;
            c.setPointerCapture?.(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            this.moved = 0;
            if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
        });
        c.addEventListener('pointermove', (e) => {
            if (this.mode !== 'map' || !this.pointers.has(e.pointerId)) return;
            const p = this.pointers.get(e.pointerId);
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (this.pointers.size === 1) {
                this.moved += Math.abs(dx) + Math.abs(dy);
                const unit = (2 * this.mapCam.dist * Math.tan((28 * Math.PI) / 360)) / this.stage.h;
                this.mapCam.x -= dx * unit;
                this.mapCam.z -= (dy * unit) / Math.sin((48 * Math.PI) / 180);
                this.mapCam.manual = true;
            } else if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (this.pinch) this.mapCam.dist = Math.max(30, Math.min(130, this.mapCam.dist * (this.pinch / d)));
                this.pinch = d;
                this.mapCam.manual = true;
            }
        });
        const up = (e) => { this.pointers.delete(e.pointerId); this.pinch = 0; };
        c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
        c.addEventListener('wheel', (e) => {
            if (this.mode !== 'map') return;
            e.preventDefault();
            this.mapCam.dist = Math.max(30, Math.min(130, this.mapCam.dist * Math.exp(e.deltaY * 0.0012)));
            this.mapCam.manual = true;
        }, { passive: false });
    }
    zoom(f) { this.mapCam.dist = Math.max(30, Math.min(130, this.mapCam.dist * f)); this.mapCam.manual = true; }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'quest-done' || e.type === 'levelup' || e.type === 'ending') this.stage.shake = 0.18;
        }
    }

    /** Screen-space points for the DOM buttons (CSS px). */
    points(G) {
        const st = this.stage;
        if (this.mode === 'map') {
            return Object.entries(this.world.towns).map(([id, t]) => { const p = st.project(t.pos.x, t.pos.y + 0.2, t.pos.z + 2.7); return { id, x: p.x, y: p.y, behind: p.behind }; });
        }
        if (this.mode === 'town' && this.town.scene) {
            return this.town.points().map((v) => { const p = st.project(v.x, v.y, v.z); return { ...v, x: p.x, y: p.y, behind: p.behind }; });
        }
        return [];
    }
    setHover(id) { this.town.setHover(id); }
    get townIsWide() { return this.town.wide; }

    frame(G, dt, time) {
        const st = this.stage;
        st.resize();
        if (!this.ready) return;
        if (this.mode === 'town') {
            const wide = st.w / st.h >= 1.1;
            const heroes = G.towns[G.loc].heroes.filter((h) => h.wants.some((w) => !w.done)).map((h) => h.id).join(',');
            const sig = `${G.loc}|${wide}|${G.wagon}|${heroes}|${heroTownFor(G) === G.loc && !G.ending}`;
            if (sig !== this.townSig || !this.town.scene) {
                this.townSig = sig;
                this.town.build(G, st.w / st.h);
                st.setScene(this.town.scene, 0x9ac8e4);
            }
            const f = this.town.framing();
            st.target.set(f.x, 0, f.z); st.dist = f.dist;
            this.town.update(G, dt, time);
        } else {
            this.world.update(G, dt, time, this.mode === 'title');
            const m = this.mapCam;
            if (this.mode === 'title') {
                st.target.set(50 + Math.sin(time * 0.05) * 24, 0, 36 + Math.cos(time * 0.04) * 9);
                st.dist = 62;
            } else {
                if (G.travel) {
                    const g = this.world.wagonGroup.position;
                    if (!m.manual) { m.x += (g.x - m.x) * Math.min(1, dt * 3); m.z += (g.z - m.z) * Math.min(1, dt * 3); }
                } else if (!m.manual) {
                    const T = TOWN[G.loc];
                    m.x += (T.x - m.x) * Math.min(1, dt * 4); m.z += (T.z + 1 - m.z) * Math.min(1, dt * 4);
                }
                m.x = Math.max(0, Math.min(100, m.x)); m.z = Math.max(-2, Math.min(74, m.z));
                st.target.set(m.x, 0, m.z); st.dist = m.dist;
            }
        }
        st.setLight(G.hour);
        st.render(dt, time);
    }
}
