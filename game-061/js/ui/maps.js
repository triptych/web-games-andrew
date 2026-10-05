// Galaxy map and system map: one full-screen canvas with pan / zoom / pinch and a side panel.

import { $, h, fmt, fmtDist } from './dom.js';
import { STAR_CLASSES, PLANET_TYPES, ECONOMIES, standingBand } from '../config.js';
import { lyDist, route, getSystem } from '../sim/galaxy.js';
import { jumpCost } from '../sim/ship.js';
import { vdist } from '../sim/vec.js';
import { questNav } from '../sim/quests.js';
import { storyNav } from '../sim/story.js';

const PT_COL = { lava: '#ff6a3a', desert: '#e0a860', rocky: '#9a9088', terran: '#5ab86a', ocean: '#3a8ae0', toxic: '#b8d84a', ice: '#cfe6ff', gas: '#e0b080', icegiant: '#7ad0f0' };

export class Maps {
    constructor(audio) {
        this.audio = audio;
        this.cv = $('mapcanvas');
        this.g = this.cv.getContext('2d');
        this.side = $('map-side');
        this.screen = $('mapscreen');
        this.mode = null;
        this.cam = { x: 0, y: 0, z: 6 };
        this.sel = null;
        this.ptrs = new Map();
        this.onWarp = null; this.onClose = null; this.onTarget = null; this.onRecall = null;
        $('map-close').addEventListener('click', () => { this.audio.click(); this.onClose?.(); });
        const c = this.cv;
        let down = null, moved = 0, pinch = null;
        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture?.(e.pointerId);
            this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; moved = 0; }
            if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z }; down = null; }
        });
        c.addEventListener('pointermove', (e) => {
            if (!this.ptrs.has(e.pointerId)) { this.hover = { x: e.clientX, y: e.clientY }; return; }
            this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && this.ptrs.size === 2) {
                const [a, b] = [...this.ptrs.values()];
                this.cam.z = Math.max(this.minZ(), Math.min(this.maxZ(), pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
                return;
            }
            if (down) {
                const dx = e.clientX - down.x, dy = e.clientY - down.y;
                moved = Math.max(moved, Math.hypot(dx, dy));
                this.cam.x = down.cx - dx / this.cam.z;
                this.cam.y = down.cy - dy / this.cam.z;
            }
        });
        const up = (e) => {
            this.ptrs.delete(e.pointerId);
            if (down && moved < 8 && this.ptrs.size === 0) this.click(e.clientX, e.clientY);
            if (this.ptrs.size < 2) pinch = null;
            if (this.ptrs.size === 0) down = null;
        };
        c.addEventListener('pointerup', up);
        c.addEventListener('pointercancel', up);
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const k = Math.exp(-Math.sign(e.deltaY) * 0.15);
            this.cam.z = Math.max(this.minZ(), Math.min(this.maxZ(), this.cam.z * k));
        }, { passive: false });
    }
    minZ() { return this.mode === 'galaxy' ? 2.2 : 0.008; }
    maxZ() { return this.mode === 'galaxy' ? 40 : 1.2; }

    open(mode, game, world) {
        this.mode = mode;
        this.game = game;
        this.world = world;
        this.screen.classList.remove('hidden');
        const here = game.galaxy.systems[game.s.location.system];
        if (mode === 'galaxy') {
            this.cam = { x: here.x, y: here.y, z: Math.min(innerWidth, innerHeight) / 70 };
            this.sel = here.id;
            $('map-title').textContent = 'GALAXY MAP';
            $('map-legend').innerHTML = '<span style="color:#ffb547">◆ Hearth</span><span style="color:#5ef0ff">◯ warp range</span><span style="color:#b48cff">◈ objective</span><span>drag to pan · wheel/pinch to zoom · tap a star</span>';
        } else {
            const sys = world.sys;
            const R = Math.max(...sys.planets.map((p) => p.orbit), ...sys.belts.map((b) => b.radius), 8000) * 1.1;
            this.cam = { x: 0, y: 0, z: Math.min(innerWidth, innerHeight) / (2 * R) };
            this.sel = world.target || null;
            $('map-title').textContent = `${sys.name.toUpperCase()} · SYSTEM MAP`;
            $('map-legend').innerHTML = '<span style="color:#ffb547">■ Hearth</span><span style="color:#6bffb0">■ station</span><span style="color:#b48cff">◆ point of interest</span><span style="color:#ff5470">● hostile</span><span>tap to target</span>';
        }
        this.renderSide();
        const loop = () => { if (!this.mode) return; this.draw(); this.raf = requestAnimationFrame(loop); };
        cancelAnimationFrame(this.raf);
        loop();
    }
    close() { this.mode = null; this.screen.classList.add('hidden'); cancelAnimationFrame(this.raf); }

    toScreen(x, y) { return { x: (x - this.cam.x) * this.cam.z + this.W / 2, y: (y - this.cam.y) * this.cam.z + this.H / 2 }; }

    known(id) {
        const s = this.game.s;
        return s.visited.includes(id) || s.revealed.includes(id) || id === this.game.galaxy.home;
    }

    objective() {
        const G = this.game;
        const out = [];
        const sn = storyNav(G);
        if (sn) out.push(sn);
        for (const q of G.s.quests) out.push(questNav(G, q));
        return out;
    }

    // ---------------------------------------------------------------- draw
    draw() {
        const dpr = Math.min(2, devicePixelRatio || 1);
        this.W = innerWidth; this.H = innerHeight;
        if (this.cv.width !== Math.round(this.W * dpr)) { this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); }
        const g = this.g;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = '#02040a';
        g.fillRect(0, 0, this.W, this.H);
        if (this.mode === 'galaxy') this.drawGalaxy(g); else this.drawSystem(g);
    }

    drawGalaxy(g) {
        const G = this.game, gal = G.galaxy, s = G.s;
        const here = gal.systems[s.location.system];
        const t = performance.now() / 1000;
        const z = this.cam.z;
        // core glow + arms haze
        const c0 = this.toScreen(0, 0);
        const grd = g.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, 90 * z);
        grd.addColorStop(0, 'rgba(180,140,255,0.35)'); grd.addColorStop(0.25, 'rgba(90,70,160,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(0, 0, this.W, this.H);
        // territories (known systems)
        for (const sys of gal.systems) {
            if (sys.owner < 0 || !this.known(sys.id)) continue;
            const p = this.toScreen(sys.x, sys.y);
            const sp = gal.species[sys.owner];
            const r = 7 * z;
            const gg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            gg.addColorStop(0, sp.palette.skin + '44'); gg.addColorStop(1, sp.palette.skin + '00');
            g.fillStyle = gg; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        }
        // warp range
        const range = G.stats().warpRange;
        const hp = this.toScreen(here.x, here.y);
        if (range > 0) {
            g.strokeStyle = 'rgba(94,240,255,0.55)'; g.setLineDash([6, 6]); g.lineWidth = 1.2;
            g.beginPath(); g.arc(hp.x, hp.y, range * z, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            g.fillStyle = 'rgba(94,240,255,0.04)'; g.fill();
        }
        // route to selection
        const sel = this.sel != null ? gal.systems[this.sel] : null;
        if (sel && sel.id !== here.id && range > 0) {
            const r = route(gal, here.id, sel.id, range);
            if (r) {
                g.strokeStyle = '#ffb547'; g.lineWidth = 2;
                g.beginPath();
                r.forEach((id, i) => { const p = this.toScreen(gal.systems[id].x, gal.systems[id].y); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
                g.stroke();
                this.routeLen = r.length - 1;
            } else this.routeLen = null;
        }
        // systems
        const objs = this.objective();
        g.textAlign = 'center';
        for (const sys of gal.systems) {
            const p = this.toScreen(sys.x, sys.y);
            if (p.x < -40 || p.x > this.W + 40 || p.y < -40 || p.y > this.H + 40) continue;
            const known = this.known(sys.id);
            const visited = s.visited.includes(sys.id);
            const sc = STAR_CLASSES[sys.star];
            const col = sys.star === 'core' ? '#e0c8ff' : sc.color;
            const rr = (sys.star === 'core' ? 6 : 1.4 + (sc.radius / 900) * 2.2) * Math.min(1.8, Math.max(0.8, z / 8));
            g.globalAlpha = known ? 1 : 0.45;
            g.fillStyle = col;
            g.beginPath(); g.arc(p.x, p.y, rr, 0, Math.PI * 2); g.fill();
            if (visited) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, rr + 3, 0, Math.PI * 2); g.stroke(); }
            if (known && sys.pirate) { g.strokeStyle = '#ff5470'; g.beginPath(); g.arc(p.x, p.y, rr + 5, 0, Math.PI * 2); g.stroke(); }
            g.globalAlpha = 1;
            if (sys.id === gal.home) { g.fillStyle = '#ffb547'; g.save(); g.translate(p.x, p.y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); }
            if (objs.some((o) => o.system === sys.id)) {
                g.strokeStyle = '#b48cff'; g.lineWidth = 2;
                const k = 9 + Math.sin(t * 4) * 2;
                g.save(); g.translate(p.x, p.y); g.rotate(Math.PI / 4); g.strokeRect(-k, -k, k * 2, k * 2); g.restore();
            }
            const showName = known || sys.id === this.sel || sys.star === 'core' || z > 16;
            if (showName) {
                g.font = `${sys.id === here.id || sys.id === this.sel ? 700 : 600} ${z > 14 ? 13 : 11}px Rajdhani, sans-serif`;
                g.fillStyle = sys.id === here.id ? '#5ef0ff' : known ? '#dbe8ff' : 'rgba(138,160,196,0.8)';
                g.fillText(known || sys.star === 'core' ? sys.name : 'Uncharted', p.x, p.y - rr - 6);
            }
        }
        // scale bar
        const lyPx = 10 * z;
        g.strokeStyle = 'rgba(138,160,196,0.8)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(this.W - 30 - lyPx, this.H - 24); g.lineTo(this.W - 30, this.H - 24); g.moveTo(this.W - 30 - lyPx, this.H - 28); g.lineTo(this.W - 30 - lyPx, this.H - 20); g.moveTo(this.W - 30, this.H - 28); g.lineTo(this.W - 30, this.H - 20); g.stroke();
        g.fillStyle = 'rgba(138,160,196,0.9)'; g.font = '600 11px Rajdhani, sans-serif'; g.fillText('10 ly', this.W - 30 - lyPx / 2, this.H - 30);
        // current + selection markers
        g.strokeStyle = '#5ef0ff'; g.lineWidth = 2;
        g.beginPath(); g.arc(hp.x, hp.y, 9 + Math.sin(t * 3), 0, Math.PI * 2); g.stroke();
        if (sel) {
            const p = this.toScreen(sel.x, sel.y);
            g.strokeStyle = '#ffb547';
            const k = 12;
            g.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(p.x + sx * k, p.y + sy * (k - 5)); g.lineTo(p.x + sx * k, p.y + sy * k); g.lineTo(p.x + sx * (k - 5), p.y + sy * k); }
            g.stroke();
        }
    }

    drawSystem(g) {
        const w = this.world, sys = w.sys, G = this.game;
        const z = this.cam.z;
        const t = performance.now() / 1000;
        const P = (pos) => this.toScreen(pos.x, pos.z);
        // star
        const c = P({ x: 0, z: 0 });
        const sr = Math.max(6, sys.star.radius * z);
        const grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, sr * 3);
        grd.addColorStop(0, sys.star.color); grd.addColorStop(0.3, sys.star.color + '88'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(c.x, c.y, sr * 3, 0, Math.PI * 2); g.fill();
        // orbits
        g.strokeStyle = 'rgba(94,240,255,0.14)'; g.lineWidth = 1;
        for (const p of sys.planets) { g.beginPath(); g.arc(c.x, c.y, p.orbit * z, 0, Math.PI * 2); g.stroke(); }
        // belts
        for (const b of sys.belts) {
            g.strokeStyle = 'rgba(200,184,154,0.25)'; g.lineWidth = Math.max(2, b.width * z);
            g.setLineDash([2, 4]); g.beginPath(); g.arc(c.x, c.y, b.radius * z, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            for (const cl of b.clusters) { const q = P(cl.pos); g.fillStyle = 'rgba(200,184,154,0.6)'; g.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); }
        }
        const items = this.sysItems();
        g.textAlign = 'center';
        g.font = '600 12px Rajdhani, sans-serif';
        for (const it of items) {
            const q = P(it.pos);
            const sel = this.sel === it.id;
            g.fillStyle = it.color;
            if (it.shape === 'circle') { const r = Math.max(4, it.r * z); g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill(); }
            else if (it.shape === 'square') g.fillRect(q.x - 4, q.y - 4, 8, 8);
            else if (it.shape === 'diamond') { g.save(); g.translate(q.x, q.y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); }
            else if (it.shape === 'belt') { g.strokeStyle = it.color; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, 6, 0, Math.PI * 2); g.stroke(); }
            if (it.label) { g.fillStyle = sel ? '#ffb547' : 'rgba(219,232,255,0.85)'; g.fillText(it.name, q.x, q.y - Math.max(8, (it.r || 4) * z) - 5); }
            if (sel) { g.strokeStyle = '#ffb547'; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 12 + Math.sin(t * 4), 0, Math.PI * 2); g.stroke(); }
            if (it.objective) { g.strokeStyle = '#b48cff'; g.lineWidth = 2; g.save(); g.translate(q.x, q.y); g.rotate(Math.PI / 4); const k = 10 + Math.sin(t * 4) * 2; g.strokeRect(-k, -k, 2 * k, 2 * k); g.restore(); }
        }
        for (const e of w.enemies) { const q = P(e.pos); g.fillStyle = '#ff5470'; g.beginPath(); g.arc(q.x, q.y, 3, 0, Math.PI * 2); g.fill(); }
        // player arrow
        const p = w.player;
        const q = P(p.pos);
        g.save(); g.translate(q.x, q.y); g.rotate(Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw)));
        g.fillStyle = '#5ef0ff';
        g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill();
        g.restore();
    }

    sysItems() {
        const w = this.world, G = this.game;
        const objIds = new Set(this.objective().filter((o) => o.system === w.sys.id && o.id).map((o) => o.id));
        const out = [];
        for (const p of w.sys.planets) out.push({ id: p.id, name: p.name, pos: p.pos, r: p.radius, color: PT_COL[p.type], shape: 'circle', label: true, obj: p, objective: objIds.has(p.id) });
        for (const b of w.sys.belts) { const c = b.clusters[0]; out.push({ id: b.id, name: b.name, pos: c.pos, color: '#c8b89a', shape: 'belt', label: true, obj: b, objective: objIds.has(b.id) }); }
        for (const s of w.sys.stations) out.push({ id: s.id, name: s.name, pos: s.pos, color: s.kind === 'hearth' ? '#ffb547' : '#6bffb0', shape: 'square', label: true, obj: s, objective: objIds.has(s.id) });
        for (const o of [...w.visiblePois(), ...w.extra]) out.push({ id: o.id, name: o.name, pos: o.pos, color: o.kind === 'nest' || o.kind === 'bountyZone' || o.kind === 'hoard' ? '#ff5470' : '#b48cff', shape: 'diamond', label: true, obj: o, objective: objIds.has(o.id) });
        return out;
    }

    click(x, y) {
        if (this.mode === 'galaxy') {
            let best = null, bd = 22;
            for (const sys of this.game.galaxy.systems) { const p = this.toScreen(sys.x, sys.y); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = sys.id; } }
            if (best != null) { this.sel = best; this.audio.click(); this.renderSide(); }
        } else {
            let best = null, bd = 26;
            for (const it of this.sysItems()) { const p = this.toScreen(it.pos.x, it.pos.z); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = it.id; } }
            if (best != null) { this.sel = best; this.audio.click(); this.renderSide(); }
        }
    }

    renderSide() {
        const side0 = this.side;
        side0.replaceChildren();
        const side = { append: (...kids) => side0.append(...kids.flat().filter((k) => k != null && k !== false)) };
        const G = this.game;
        if (this.mode === 'galaxy') {
            if (this.sel == null) return;
            const gal = G.galaxy, sys = gal.systems[this.sel];
            const here = gal.systems[G.s.location.system];
            const known = this.known(sys.id);
            const d = lyDist(here, sys);
            const sp = sys.owner >= 0 ? gal.species[sys.owner] : null;
            const wc = G.warpCheck(sys.id);
            const range = G.stats().warpRange;
            const r = range > 0 && sys.id !== here.id ? route(gal, here.id, sys.id, range) : null;
            const sc = STAR_CLASSES[sys.star];
            side.append(
                h('h3', known || sys.star === 'core' ? sys.name : 'Uncharted system'),
                h('div.k', sys.star === 'core' ? 'The galactic core. Something vast hums here.' : `${sc.name} (class ${sys.star})`),
                h('div.k', 'Danger ', h('b', { style: { color: sys.danger >= 3 ? '#ff5470' : sys.danger >= 2 ? '#ffb547' : '#6bffb0' } }, '●'.repeat(sys.danger) + '○'.repeat(5 - sys.danger))),
                known ? h('div.k', 'Territory: ', h('b', sp ? sp.gov : sys.pirate ? 'Reaver haven' : 'Unclaimed'), sp ? h('span', { style: { color: standingBand(G.standing(sp.id)).color } }, ` · ${standingBand(G.standing(sp.id)).name}`) : null) : h('div.k', 'Visit or decode a nav beacon to learn more.'),
                known && sys.star !== 'core' ? h('div.k', 'Economy: ', h('b', ECONOMIES[sys.economy]?.name || '—'), sys.hasStation ? ' · stations' : ' · no stations') : null,
                G.s.visited.includes(sys.id) ? h('div.k', `Planets ${getSystem(gal, sys.id).planets.length} · belts ${getSystem(gal, sys.id).belts.length}`) : null,
                sys.id !== here.id ? h('div.k', 'Distance ', h('b', `${d.toFixed(1)} ly`), wc.cost ? ` · ${wc.cost} Warp Cell${wc.cost > 1 ? 's' : ''}` : '') : h('div.k', h('b.ok', 'You are here')),
                r && r.length > 2 ? h('div.k', `Route: ${r.length - 1} jumps · ${r.slice(1).reduce((a, id, i) => a + jumpCost(lyDist(gal.systems[r[i]], gal.systems[id]), G.s.base.tech), 0)} cells total`) : null,
                range > 0 && !r && sys.id !== here.id ? h('div.k.why', 'No route within your warp range') : null,
            );
            const acts = h('div.acts');
            if (sys.id !== here.id) {
                const nextHop = r && r.length > 2 ? r[1] : null;
                acts.append(h('button.btn.cyan.big', { disabled: !wc.ok || !this.canWarpNow?.(), onclick: () => this.onWarp?.(sys.id) }, wc.ok ? 'ENGAGE WARP' : 'WARP'));
                if (!wc.ok) acts.append(h('div.why', wc.why));
                else if (!this.canWarpNow?.()) acts.append(h('div.why', 'Undock first'));
                if (nextHop != null && !wc.ok) {
                    const hw = G.warpCheck(nextHop);
                    acts.append(h('button.btn', { disabled: !hw.ok || !this.canWarpNow?.(), onclick: () => this.onWarp?.(nextHop) }, `JUMP TO NEXT HOP: ${this.known(nextHop) ? gal.systems[nextHop].name : 'uncharted'}`));
                }
            }
            const rc = G.recallCheck();
            if (rc.ok || G.s.base.modules.some((m) => m.type === 'beacon')) acts.append(h('button.btn.mint', { disabled: !rc.ok || !this.canWarpNow?.(), onclick: () => this.onRecall?.() }, 'RECALL TO HEARTH'));
            side.append(acts);
        } else {
            const it = this.sysItems().find((x) => x.id === this.sel);
            if (!it) return;
            const o = it.obj;
            const d = vdist(o.pos || it.pos, this.world.player.pos);
            side.append(h('h3', it.name));
            if (o.kind === 'planet') side.append(h('div.k', `${PLANET_TYPES[o.type].name} world`), h('div.k', G.s.scanned[o.id] ? h('b.ok', '✓ Surveyed') : `Unsurveyed (~${o.scanValue} data)`));
            if (o.kind === 'belt') side.append(h('div.k', 'Asteroid belt'));
            if (o.species != null) side.append(h('div.k', o.kind === 'hearth' ? 'Your base' : `${G.galaxy.species[o.species]?.gov || ''} · ${o.kind}`));
            side.append(h('div.k', 'Distance ', h('b', fmtDist(d))));
            side.append(h('div.acts',
                h('button.btn.cyan.big', { onclick: () => this.onTarget?.(it.id, true) }, 'TARGET & CRUISE'),
                h('button.btn', { onclick: () => this.onTarget?.(it.id, false) }, 'SET TARGET'),
            ));
        }
    }
}
