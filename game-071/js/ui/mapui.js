/**
 * mapui.js — the world map (a parchment hillshade drawn once from the height field, with
 * rivers, roads, location marks and labels, the player, quest targets and a custom marker;
 * pan, zoom, pinch, fast travel) and the Journal (quests, stats, and the system menu).
 */
import { h, Panel, ListView } from './ui.js';
import { WORLD, LOCATIONS, LOC, ROADS, RIVERS, LAKES } from '../sim/geography.js';

const KIND_GLYPH = { city: '◆', village: '◇', fort: '♜', cave: '◖', barrow: '⊓', mine: '⛏', camp: '△', tower: '♖', temple: '⌂', ruin: '⚙', mound: '⌒', landmark: '✧', totem: '▲', shrine: '✦', giant: '☗' };
let baseMap = null;

/** Draw the province once into an offscreen canvas. */
function drawBase(terrain) {
    if (baseMap) return baseMap;
    const N = 768;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const S = WORLD.SIZE, H = WORLD.HALF;
    const hs = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hs[j * N + i] = terrain.heightAt(-H + (i + 0.5) / N * S, -H + (j + 0.5) / N * S);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i, y = hs[k];
        const x = -H + (i + 0.5) / N * S, z = -H + (j + 0.5) / N * S;
        const dx = (hs[j * N + Math.min(N - 1, i + 1)] - hs[j * N + Math.max(0, i - 1)]), dz = (hs[Math.min(N - 1, j + 1) * N + i] - hs[Math.max(0, j - 1) * N + i]);
        let shade = 0.78 + (-dx * 0.6 - dz * 0.4) / (S / N) * 0.35;
        shade = Math.max(0.35, Math.min(1.25, shade));
        const water = terrain.waterAt(x, z) > y + 0.3;
        let r, gg, b;
        if (water) { r = 118; gg = 138; b = 140; shade = 0.95 + Math.sin(i * 0.5 + j * 0.3) * 0.02; }
        else {
            const snow = terrain.maskAt(x, z, 1), forest = terrain.maskAt(x, z, 3);
            r = 205 - forest * 45 + snow * 30; gg = 190 - forest * 30 + snow * 40; b = 150 - forest * 30 + snow * 70;
            const band = Math.abs((y % 60) - 30) < 0.8 && y > 10 ? 0.86 : 1;   // contour lines
            shade *= band;
        }
        img.data[k * 4] = Math.min(255, r * shade); img.data[k * 4 + 1] = Math.min(255, gg * shade); img.data[k * 4 + 2] = Math.min(255, b * shade); img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (x, z) => [(x + H) / S * N, (z + H) / S * N];
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rv of RIVERS) { g.strokeStyle = 'rgba(90,112,120,0.9)'; g.lineWidth = 2.2; g.beginPath(); rv.pts.forEach(([x, z], i) => { const [u, v] = P(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v); }); g.stroke(); }
    for (const rd of ROADS) { if (!rd.pts) continue; g.strokeStyle = 'rgba(110,70,40,0.75)'; g.setLineDash([4, 3]); g.lineWidth = 1.4; g.beginPath(); rd.pts.forEach(([x, z], i) => { const [u, v] = P(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v); }); g.stroke(); }
    g.setLineDash([]);
    // vignette edge like old vellum
    const grd = g.createRadialGradient(N / 2, N / 2, N * 0.35, N / 2, N / 2, N * 0.72);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(60,40,20,0.45)');
    g.fillStyle = grd; g.fillRect(0, 0, N, N);
    baseMap = { c, N };
    return baseMap;
}

export class MapPanel extends Panel {
    constructor(ui) {
        super(ui);
        const w = ui.app.world, p = w.player;
        this.title('Map', h('span.hint2', { text: 'Drag to pan · wheel or pinch to zoom · click a mark to travel · right-click to set a marker' }));
        this.wrap = h('div.mapwrap');
        this.canvas = h('canvas');
        this.labels = h('div');
        this.info = h('div.mapinfo');
        this.wrap.append(this.canvas, this.labels, this.info);
        this.box.appendChild(this.wrap);
        this.base = drawBase(w.terrain);
        const inside = w.cellId !== 'ext';
        const at = inside && w.extReturn ? w.extReturn : p.pos;
        this.view = { x: at.x, z: at.z, scale: 0.6 };   // pixels per metre
        this.bind();
        requestAnimationFrame(() => { this.resize(); this.draw(); });
        this.sel = null;
    }
    resize() { const r = this.wrap.getBoundingClientRect(); this.W = Math.max(100, r.width | 0); this.H = Math.max(100, r.height | 0); const dpr = Math.min(2, devicePixelRatio || 1); this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr; this.canvas.style.width = `${this.W}px`; this.canvas.style.height = `${this.H}px`; this.dpr = dpr; }
    toScreen(x, z) { return [(x - this.view.x) * this.view.scale + this.W / 2, (z - this.view.z) * this.view.scale + this.H / 2]; }
    toWorld(u, v) { return [(u - this.W / 2) / this.view.scale + this.view.x, (v - this.H / 2) / this.view.scale + this.view.z]; }
    draw() {
        const g = this.canvas.getContext('2d'), dpr = this.dpr || 1;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = '#7a6a50'; g.fillRect(0, 0, this.W, this.H);
        const S = WORLD.SIZE, Hh = WORLD.HALF;
        const [x0, y0] = this.toScreen(-Hh, -Hh);
        g.imageSmoothingEnabled = true;
        g.drawImage(this.base.c, x0, y0, S * this.view.scale, S * this.view.scale);
        const w = this.app.world, p = w.player;
        this.labels.innerHTML = '';
        this.hits = [];
        for (const L of LOCATIONS) {
            const known = w.discovered.has(L.id);
            if (!known && !w.flags[`told:${L.id}`]) continue;
            const [u, v] = this.toScreen(L.x, L.z);
            if (u < -20 || v < -20 || u > this.W + 20 || v > this.H + 20) continue;
            g.fillStyle = w.cleared.has(L.id) ? '#4a4030' : '#2a2016';
            g.font = `${L.kind === 'city' ? 18 : 14}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(KIND_GLYPH[L.kind] || '•', u, v);
            if (this.view.scale > 0.35 || L.kind === 'city') this.labels.appendChild(h('div.maplabel', { text: L.name, style: { left: `${u}px`, top: `${v}px` } }));
            this.hits.push({ L, u, v, known });
        }
        for (const lk of LAKES) { if (this.view.scale < 0.4) continue; const [u, v] = this.toScreen(lk.x, lk.z); this.labels.appendChild(h('div.maplabel', { text: lk.name, style: { left: `${u}px`, top: `${v - 14}px`, fontStyle: 'italic', color: '#2c3e44' } })); }
        // quest targets
        for (const q of w.quests?.markers() || []) { if (q.cell && q.cell !== 'ext' && q.cell !== 'any') continue; const [u, v] = this.toScreen(q.x, q.z); g.fillStyle = '#b8892a'; g.font = '18px serif'; g.fillText('▼', u, v - 10); }
        if (p.customMarker) { const [u, v] = this.toScreen(p.customMarker.x, p.customMarker.z); g.fillStyle = '#2a4a8a'; g.font = '18px serif'; g.fillText('✚', u, v); }
        // the player
        const pp = w.cellId === 'ext' ? p.pos : (w.extReturn || p.pos);
        const [pu, pv] = this.toScreen(pp.x, pp.z);
        g.save(); g.translate(pu, pv); g.rotate(-p.camYaw); g.fillStyle = '#a0201a'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    pick(u, v) { let best = null, bd = 18; for (const ht of this.hits || []) { const d = Math.hypot(ht.u - u, ht.v - v); if (d < bd) { bd = d; best = ht; } } return best; }
    showInfo(ht) {
        this.info.innerHTML = '';
        if (!ht) { this.info.classList.remove('on'); return; }
        const w = this.app.world;
        const L = ht.L;
        const d = Math.hypot(L.x - w.player.pos.x, L.z - w.player.pos.z);
        this.info.append(h('b', { text: L.name, style: { fontFamily: 'var(--display)' } }), h('span.dim', { text: L.desc || '' }), h('span.faint', { text: `${Math.round(d)} m away${w.cleared.has(L.id) ? ' · cleared' : ''}` }));
        if (ht.known) this.info.appendChild(h('button.mbtn.gold', { text: 'Travel here', on: { click: () => this.travel(L) } }));
        this.info.classList.add('on');
        this.sel = ht;
    }
    travel(L) {
        const app = this.app;
        const why = app.world.canFastTravel();
        if (why) { this.ui.toast(why); return; }
        this.ui.closeAll();
        app.fade(() => app.world.fastTravel(L.id));
    }
    bind() {
        const el = this.wrap;
        let drag = null, pinch = null, moved = false;
        const pts = new Map();
        el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vz: this.view.z }; else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.view.scale }; drag = null; } });
        el.addEventListener('pointermove', (e) => {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; this.view.scale = Math.max(0.12, Math.min(4, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); moved = true; this.draw(); return; }
            if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) moved = true; this.view.x = drag.vx - dx / this.view.scale; this.view.z = drag.vz - dy / this.view.scale; this.draw(); }
        });
        const up = (e) => {
            const r = el.getBoundingClientRect();
            if (!moved && pts.size === 1 && e.button !== 2) this.showInfo(this.pick(e.clientX - r.left, e.clientY - r.top));
            pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null;
        };
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        el.addEventListener('wheel', (e) => { e.preventDefault(); const k = Math.exp(-Math.sign(e.deltaY) * 0.18); this.view.scale = Math.max(0.12, Math.min(4, this.view.scale * k)); this.draw(); }, { passive: false });
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const r = el.getBoundingClientRect();
            const [x, z] = this.toWorld(e.clientX - r.left, e.clientY - r.top);
            const p = this.app.world.player;
            p.customMarker = p.customMarker && Math.hypot(p.customMarker.x - x, p.customMarker.z - z) < 40 / this.view.scale ? null : { x, z };
            this.draw();
        });
        this.onResize = () => { this.resize(); this.draw(); };
        window.addEventListener('resize', this.onResize);
    }
    onClose() { window.removeEventListener('resize', this.onResize); }
    action(a) {
        const step = 60 / this.view.scale;
        if (a === 'up') this.view.z -= step; else if (a === 'down') this.view.z += step; else if (a === 'left') this.view.x -= step; else if (a === 'right') this.view.x += step;
        else if (a === 'nextTab' || a === 'pgdn') this.view.scale = Math.min(4, this.view.scale * 1.25);
        else if (a === 'prevTab' || a === 'pgup') this.view.scale = Math.max(0.12, this.view.scale / 1.25);
        else if (a === 'ok') { if (this.sel?.known) this.travel(this.sel.L); else { this.showInfo(this.pick(this.W / 2, this.H / 2)); } return true; }
        else return false;
        this.draw();
        return true;
    }
}

// ------------------------------------------------------------------ journal
const JTABS = [['active', 'Quests'], ['done', 'Completed'], ['stats', 'Stats'], ['system', 'System']];
export class JournalPanel extends Panel {
    constructor(ui, tab = 'active') {
        super(ui);
        this.title('Journal');
        this.tabs = h('div.tabs');
        JTABS.forEach(([k, t]) => this.tabs.appendChild(h('button.tab', { text: t, 'data-k': k, on: { click: () => this.setTab(k) } })));
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.activate(r) });
        this.detail = h('div.detail.scroll');
        this.box.append(this.tabs, h('div.split', {}, this.list.el, this.detail));
        this.setTab(tab);
    }
    setTab(k) { this.tab = k; [...this.tabs.children].forEach((t) => t.classList.toggle('on', t.dataset.k === k)); this.refresh(); }
    refresh() {
        const w = this.app.world;
        const rows = [];
        if (this.tab === 'active' || this.tab === 'done') {
            const qs = w.quests?.list(this.tab === 'done') || [];
            let lastKind = null;
            for (const q of qs) {
                if (q.kind !== lastKind) { rows.push({ key: `h${q.kind}`, label: { main: 'Main Quest', side: 'Side Quests', guild: 'Guilds and Lodges', misc: 'Miscellaneous' }[q.kind] || q.kind, head: true }); lastKind = q.kind; }
                rows.push({ key: q.id, label: q.title, mark: w.quests.tracked === q.id ? '◆' : '', data: q });
            }
            if (!rows.length) rows.push({ key: 'none', label: this.tab === 'done' ? 'Nothing completed yet.' : 'No quests. The road is open.', cls: 'dim' });
        } else if (this.tab === 'stats') {
            const s = w.stats, p = w.player;
            const stat = (k, v) => rows.push({ key: k, label: k, value: v });
            stat('Level', p.sheet.level); stat('Days passed', s.days); stat('Locations discovered', w.discovered.size); stat('Dungeons cleared', w.cleared.size);
            stat('Foes slain', s.kills); stat('Dragons slain', s.dragons); stat('Embers absorbed', p.storm.embers); stat('Sigil rings known', Object.values(p.storm.rings).reduce((a, b) => a + b, 0));
            stat('Potions drunk', s.potions); stat('Items crafted', s.crafted); stat('Items stolen', s.stolen); stat('Gold', p.gold);
        } else {
            for (const [k, t] of [['resume', 'Resume'], ['save', 'Save game'], ['load', 'Load game'], ['settings', 'Settings'], ['help', 'Controls'], ['title', 'Quit to title']]) rows.push({ key: k, label: t, data: { sys: k } });
        }
        this.list.set(rows);
    }
    show(r) {
        this.detail.innerHTML = '';
        if (!r?.data) return;
        const q = r.data;
        if (q.sys === 'help') { this.detail.appendChild(helpCard(this.app)); return; }
        if (q.sys) return;
        const card = h('div.card', {}, h('h3', { text: q.title }), h('p', { text: q.text }));
        for (const o of q.objectives) card.appendChild(h('p', { cls: o.done ? 'faint' : '', html: `${o.done ? '☑' : '☐'} ${o.text}` }));
        if (!q.done) card.appendChild(h('div.row', {}, h('button.mbtn', { text: this.app.world.quests.tracked === q.id ? 'Tracked' : 'Track', on: { click: () => { this.app.world.quests.tracked = q.id; this.refresh(); } } })));
        this.detail.appendChild(card);
    }
    activate(r) {
        if (!r?.data) return;
        const k = r.data.sys;
        if (!k) { this.app.world.quests.tracked = r.data.id; this.refresh(); return; }
        if (k === 'resume') this.ui.closeAll();
        else if (k === 'save') this.ui.show('saves', 'save');
        else if (k === 'load') this.ui.show('saves', 'load');
        else if (k === 'settings') this.ui.show('settings');
        else if (k === 'title') { this.ui.closeAll(); this.app.toTitle(); }
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.activate(this.list.current); return true; }
        const i = JTABS.findIndex(([k]) => k === this.tab);
        if (a === 'right' || a === 'nextTab') { this.setTab(JTABS[(i + 1) % JTABS.length][0]); return true; }
        if (a === 'left' || a === 'prevTab') { this.setTab(JTABS[(i - 1 + JTABS.length) % JTABS.length][0]); return true; }
        return false;
    }
}

function helpCard(app) {
    const rows = app.isTouch ? [
        ['Left thumb', 'Move (push to the edge to sprint)'], ['Right thumb', 'Look; tap the world to use'], ['⚔', 'Attack (hold for a heavy swing)'], ['⛨', 'Block / left hand'], ['⤒', 'Jump'], ['ᛟ', 'Trace a sigil (hold for more rings)'], ['✋', 'Use'], ['👁', 'Sneak'], ['◎', 'Camera'], ['☰', 'Menu'],
    ] : [
        ['WASD', 'Move'], ['Mouse', 'Look'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['C / Ctrl', 'Sneak'], ['E / F', 'Use'], ['Left click', 'Right hand (hold: heavy swing)'], ['Right click', 'Left hand / block'], ['Z', 'Trace a sigil (hold for more rings)'], ['R', 'Ready / sheathe'], ['V', 'Camera'], ['Q', 'Favourites'],
        ['Tab', 'Quick menu'], ['I', 'Items'], ['P', 'Magic'], ['K', 'Skills'], ['M', 'Map'], ['J', 'Journal'], ['T', 'Wait'], ['F5 / F9', 'Quicksave / quickload'],
    ];
    const card = h('div.card', {}, h('h3', { text: 'Controls' }));
    for (const [k, v] of rows) card.appendChild(h('p', { html: `<b style="display:inline-block;min-width:110px;color:var(--ink)">${k}</b> ${v}` }));
    return card;
}
