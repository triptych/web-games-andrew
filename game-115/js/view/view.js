// The view: owns the three.js stage, the town and the effects; reads G every frame and answers sim
// events. It never changes G. It also owns the camera (pan and zoom) and turns screen points back
// into things in the world, for the UI to act on.

import { MAP } from '../config.js';
import { BUILDINGS, stat, nameOf } from '../sim/data/buildings.js';
import { ITEMS } from '../sim/data/items.js';
import { hourOf, seasonOf } from '../sim/core.js';
import { slotsOf } from '../sim/townsfolk.js';
import { Stage } from './stage.js';
import { Fx } from './fx.js';
import { Town } from './town.js';
import { placeProblem, ownedAt, inMap, idx, T_GRASS } from '../sim/world.js';

export class View {
    constructor(canvas, { quality = 2 } = {}) {
        this.canvas = canvas;
        this.stage = new Stage(canvas, quality);
        this.floaterEl = document.getElementById('floaters');
        this.badgeEl = document.getElementById('badges');
        this.fx = new Fx(this.stage, this.floaterEl);
        this.town = new Town(this.stage, this.fx, quality);
        this.stage.scene.add(this.town.group, this.fx.group);
        this.quality = quality;
        this.selected = null;
        this.speed = 1;
        this.badges = new Map();
        this.shake = 0;
        this.focusT = null;
        this.camVel = { x: 0, z: 0 };
        this.ghost = null;
        this.G = null;
        const onResize = () => this.stage.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    /** A different game: drop everything remembered about the old one. */
    reset() { this.town.reset(); for (const el of this.badges.values()) el.remove(); this.badges.clear(); this.focusT = null; }

    setQuality(q) {
        this.quality = q;
        this.stage.setQuality(q);
    }

    // ---------------------------------------------------------------- camera
    panScreen(dx, dy) {
        // a drag of dx, dy CSS px moves the world under the finger
        const s = this.stage;
        const a = s.unproject(s.w / 2, s.h / 2), b = s.unproject(s.w / 2 - dx, s.h / 2 - dy);
        s.cam.x += b.x - a.x; s.cam.z += b.z - a.z;
        this.focusT = null;
    }
    panWorld(dx, dz) { this.stage.cam.x += dx; this.stage.cam.z += dz; this.focusT = null; }
    zoomBy(f, px, py) {
        const s = this.stage;
        const before = px != null ? s.unproject(px, py) : null;
        s.cam.zoom *= f;
        s.clampCam();
        s.place(0);
        if (before) { const after = s.unproject(px, py); s.cam.x += before.x - after.x; s.cam.z += before.z - after.z; }
    }
    focus(x, z, zoom) { this.focusT = { x, z, zoom: zoom ?? this.stage.cam.zoom }; }
    /** Bring a world point into the middle of the part of the screen a panel leaves free. */
    focusFree(x, z, rect) {
        const s = this.stage;
        let fx = s.w / 2, fy = s.h / 2;
        if (rect && !rect.hidden) {
            if (rect.width > s.w * 0.8) { fy = (88 + rect.top) / 2; }          // a sheet along the bottom
            else if (rect.left > s.w * 0.4) { fx = rect.left / 2; }            // a side panel on the right
        }
        const g0 = s.unproject(s.w / 2, s.h / 2), g1 = s.unproject(fx, fy);
        this.focus(x + (g0.x - g1.x), z + (g0.z - g1.z), Math.max(0.9, Math.min(1.2, s.cam.zoom)));
    }

    // ---------------------------------------------------------------- placing
    /** Show a ghost of `type` with its top-left at tile (x, y); `moveId` is a building being moved. */
    setGhost(G, type, x, y, moveId = 0) {
        if (!type) { this.town.setGhost(null); this.ghost = null; return null; }
        const d = BUILDINGS[type];
        const tiles = [];
        for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
            const tx = x + i, ty = y + j;
            const ok = inMap(tx, ty) && ownedAt(G, tx, ty) && G.terr[idx(tx, ty)] === T_GRASS && (!G.occ[idx(tx, ty)] || G.occ[idx(tx, ty)] === moveId);
            tiles.push({ x: tx, y: ty, ok });
        }
        const problem = placeProblem(G, type, x, y, moveId);
        this.ghost = { type, x, y, ok: !problem, problem, tiles };
        this.town.setGhost(this.ghost);
        return this.ghost;
    }

    // ---------------------------------------------------------------- picking
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return this.town.pick(clientX - r.left, clientY - r.top, this.G);
    }
    /** Screen rectangle (client px) of an entity, for the tests and the tutorial pointer. */
    screenOf(kind, id) {
        const rect = this.town.screenRect(kind, id, this.G);
        if (!rect) return null;
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (rect.x0 + rect.x1) / 2, y: r.top + (rect.y0 + rect.y1) / 2, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0, x0: r.left + rect.x0, y0: r.top + rect.y0, x1: r.left + rect.x1, y1: r.top + rect.y1 };
    }
    screenOfTile(x, y) {
        const p = this.stage.project(x + 0.5, 0, y + 0.5);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
    }

    // ---------------------------------------------------------------- events
    onEvents(G, events) {
        this.G = G;
        for (const e of events) {
            this.town.onEvent(G, e);
            if (e.type === 'raid' && !e.win) this.shake = 0.5;
        }
    }

    // ---------------------------------------------------------------- badges
    updateBadges(G, dt) {
        const st = this.stage;
        const want = new Map();
        const tmp = {};
        for (const b of G.buildings) {
            const d = BUILDINGS[b.type];
            const e = this.town.bmap.get(b.id);
            if (!e) continue;
            const items = [];
            if (b.bld) items.push({ t: `🔨 ${Math.round((1 - Math.max(0, b.bld.t) / b.bld.total) * 100)}%`, c: 'build' });
            else if (b.lv >= 1) {
                if (d.skill && slotsOf(b) > 0 && b.workers.length === 0) items.push({ t: '👷', c: 'warn', tip: 'needs a worker' });
                else if (b.full) items.push({ t: '📦', c: 'warn', tip: 'storage full' });
                const n = this.town.insideCount.get(b.id) || 0;
                if (n > 0 && b.type !== 'hall' && b.type !== 'house') items.push({ t: `${b.type === 'inn' ? '💤' : b.type === 'tavern' ? '🍴' : b.type === 'itemshop' ? '🛍️' : b.type === 'healer' ? '💗' : '👥'}${n}`, c: 'in' });
            }
            if (!items.length) continue;
            const s = e.sprite;
            const cx = b.x + d.w / 2, cz = b.y + d.h - 0.2;
            const ux = Math.cos(0.5236), uz = -Math.sin(0.5236);
            const p = st.project(cx, s.h * ux * 0.98, cz + s.h * uz * 0.98, tmp);
            if (!p.vis || p.x < -40 || p.x > st.w + 40 || p.y < -40 || p.y > st.h + 40) continue;
            want.set(b.id, { items, x: p.x, y: p.y });
        }
        for (const [id, el] of this.badges) if (!want.has(id)) { el.remove(); this.badges.delete(id); }
        for (const [id, w] of want) {
            let el = this.badges.get(id);
            if (!el) { el = document.createElement('div'); el.className = 'badge'; this.badgeEl.appendChild(el); this.badges.set(id, el); }
            const html = w.items.map((i) => `<span class="${i.c}">${i.t}</span>`).join('');
            if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
            el.style.transform = `translate(${w.x.toFixed(1)}px, ${w.y.toFixed(1)}px) translate(-50%, -100%)`;
        }
    }

    // ---------------------------------------------------------------- the frame
    frame(G, dt, time) {
        this.G = G;
        const st = this.stage;
        st.resize();
        if (this.focusT) {
            const f = this.focusT, k = 1 - Math.pow(0.0015, dt);
            st.cam.x += (f.x - st.cam.x) * k; st.cam.z += (f.z - st.cam.z) * k; st.cam.zoom += (f.zoom - st.cam.zoom) * k;
            if (Math.abs(f.x - st.cam.x) < 0.02 && Math.abs(f.z - st.cam.z) < 0.02) this.focusT = null;
        }
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
        st.setLight(G.hour ?? hourOf(G.t), G.weather, seasonOf(G.day), time);
        st.place(time);
        if (this.shake > 0) { st.camera.position.x += Math.sin(time * 90) * this.shake * 0.12; st.camera.position.y += Math.cos(time * 71) * this.shake * 0.08; }
        this.town.update(G, dt, time, { selected: this.selected, speed: this.speed });
        const c = st.cam;
        this.town.calm = this.calm;
        this.fx.updateWeather(this.calm ? 'clear' : G.weather, c.x, c.z, dt, time);
        this.fx.updateFireflies(this.calm ? 0 : st.shared.uNight.value, c.x, c.z, dt, time);
        this.fx.update(dt);
        this.updateBadges(G, dt);
        st.render(time);
    }
}
