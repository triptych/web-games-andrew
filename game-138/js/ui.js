// The DOM layer: the workbench (shape, elements, themes, tools), the depth rail, the info card, the walk HUD and its
// minimap, sheets and toasts. Reads params, the dungeon and G; asks main.js to change them through callbacks.

import { VERSION, MAX_LEVELS } from './config.js';
import { THEMES, THEME_IDS } from './sim/data/themes.js';
import { ELEMENTS, ELEMENT_IDS, CATEGORIES, CATEGORY_IDS } from './sim/data/elements.js';
import { BRUSHES, BRUSH_IDS } from './sim/tiles.js';
import { LOOKS } from './view/materials.js';
import { thumbUrl } from './view/models.js';
import { totals } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

const MIX = {
    tunnels: { icon: '🕳️', name: 'Tunnels', hint: 'winding passages' },
    chambers: { icon: '🏛️', name: 'Chambers', hint: 'rooms and halls' },
    water: { icon: '💧', name: 'Water', hint: 'pools, streams, waterfalls' },
    pits: { icon: '🪣', name: 'Wells', hint: 'deep shafts in the floor' },
};
const SWATCH = { burrow: '#a8703f', stone: '#a8a092', cellar: '#b0503a', cavern: '#7a6e64', ruins: '#7a9a5a', grotto: '#8a5cc9', frost: '#b8dcf0' };

export class UI {
    constructor({ audio, settings, onParams, onLevel, onTool, onSettings }) {
        Object.assign(this, { audio, settings, onParams, onLevel, onTool, onSettings });
        this.stack = [];
        this.tool = 'look';
        this.brush = 'chamber';
        this.stamp = 'slime';
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION + ' · models made with Meshy';

        // a press that began outside a sheet must not click inside it when it lifts (game-071)
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); return; }
                // a tap on the dimmed backdrop closes the sheet (not the welcome)
                if (e.target === el && el.id !== 'title') { audio.ui('close'); this.closeScreen(el.id); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        this.buildTabs();
        this.buildShape();
        this.buildSliders('els', CATEGORY_IDS.map((k) => [k, CATEGORIES[k]]), (k, v) => this.onParams((p) => { p.el[k] = v; }, CATEGORIES[k].name));
        this.buildTools();
        this.buildSettings();
    }

    // ------------------------------------------------------------------ tabs
    buildTabs() {
        const bench = $('bench');
        for (const t of document.querySelectorAll('.tab')) {
            t.addEventListener('click', () => {
                this.audio.ui('click');
                const same = t.classList.contains('on');
                // on a phone, tapping the open tab folds the sheet away
                if (same && window.innerWidth <= 760) { bench.classList.toggle('closed'); return; }
                bench.classList.remove('closed');
                for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);
                for (const p of document.querySelectorAll('.pane')) p.classList.toggle('on', p.dataset.pane === t.dataset.tab);
                if (t.dataset.tab !== 'tools' && this.tool !== 'look') this.setTool('look');
            });
        }
    }
    showTab(name) { document.querySelector(`.tab[data-tab="${name}"]`)?.click(); }

    // ------------------------------------------------------------------ shape
    buildShape() {
        const seed = $('seed');
        seed.addEventListener('change', () => this.onParams((p) => { p.seed = seed.value; }, 'Seed'));
        seed.addEventListener('keydown', (e) => { if (e.key === 'Enter') seed.blur(); });
        $('btn-dice').addEventListener('click', () => {
            const d = $('btn-dice');
            d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
            this.audio.ui('roll');
            this.onParams((p, rnd) => { p.seed = rnd(); p.pins = []; p.stamps = []; p.erased = []; }, 'New seed');
        });
        for (const b of $('size').querySelectorAll('button')) {
            b.addEventListener('click', () => { this.audio.ui('click'); this.onParams((p) => { p.size = b.dataset.v; p.pins = []; p.stamps = []; p.erased = []; }, 'Size'); });
        }
        $('lv-minus').addEventListener('click', () => { this.audio.ui('click'); this.onParams((p) => { p.levels = Math.max(1, p.levels - 1); }, 'Levels'); });
        $('lv-plus').addEventListener('click', () => { this.audio.ui('click'); this.onParams((p) => { p.levels = Math.min(MAX_LEVELS, p.levels + 1); }, 'Levels'); });
        this.buildSliders('mix', Object.entries(MIX), (k, v) => this.onParams((p) => { p.mix[k] = v; }, MIX[k].name));
    }

    /** A column of 0–9 sliders. Values show while dragging; the dungeon regrows when the thumb is let go. */
    buildSliders(id, rows, onChange) {
        const box = $(id);
        box.innerHTML = '';
        this.sliders ||= {};
        for (const [k, r] of rows) {
            const row = document.createElement('label');
            row.className = 'slider';
            row.innerHTML = `<span class="ico" aria-hidden="true">${r.icon}</span><span><span class="nm">${r.name}</span><span class="ht">${r.hint}</span><input type="range" min="0" max="9" step="1" aria-label="${r.name}"></span><span class="val"></span>`;
            const input = row.querySelector('input'), val = row.querySelector('.val');
            const show = () => { val.textContent = input.value; input.style.setProperty('--fill', `${(input.value / 9) * 100}%`); };
            input.addEventListener('input', show);
            input.addEventListener('change', () => { show(); this.audio.ui('click'); onChange(k, +input.value); });
            box.appendChild(row);
            this.sliders[id + ':' + k] = { input, show };
        }
    }

    // ------------------------------------------------------------------ themes
    buildThemes(params, d, cur) {
        const box = $('theme-list');
        box.innerHTML = '';
        params.themes.forEach((t, k) => {
            const row = document.createElement('div');
            row.className = 'theme-row' + (k === cur ? ' cur' : '');
            const L = d.levels[k];
            row.innerHTML = `<h3><span>${k + 1}. ${L.name}</span><small>${k === 0 ? 'top' : k === params.levels - 1 ? 'deepest' : ''}</small></h3><div class="chips"></div>`;
            row.querySelector('h3').addEventListener('click', () => this.onLevel(k));
            const chips = row.querySelector('.chips');
            for (const id of THEME_IDS) {
                const c = document.createElement('button');
                c.className = 'chip' + (id === t ? ' on' : '');
                c.title = THEMES[id].name;
                c.setAttribute('aria-label', `${THEMES[id].name} for level ${k + 1}`);
                c.innerHTML = `<span class="sw" style="background:${SWATCH[id]}"></span>${THEMES[id].name.split(' ')[1] || THEMES[id].name}`;
                c.addEventListener('click', () => { this.audio.ui('click'); this.onLevel(k); this.onParams((p) => { p.themes[k] = id; }, 'Theme'); });
                chips.appendChild(c);
            }
            box.appendChild(row);
        });
    }

    // ------------------------------------------------------------------ tools
    buildTools() {
        for (const b of document.querySelectorAll('.tool')) b.addEventListener('click', () => { this.audio.ui('click'); this.setTool(b.dataset.tool); });
        const brushes = $('brushes');
        for (const id of BRUSH_IDS) {
            const b = document.createElement('button');
            b.className = 'brush' + (id === this.brush ? ' on' : '');
            b.dataset.b = id;
            b.innerHTML = `<span aria-hidden="true">${BRUSHES[id].icon}</span>${BRUSHES[id].name}`;
            b.addEventListener('click', () => { this.audio.ui('click'); this.brush = id; for (const x of brushes.children) x.classList.toggle('on', x === b); this.onTool(this.tool); });
            brushes.appendChild(b);
        }
        const stamps = $('stamps');
        for (const cat of CATEGORY_IDS.filter((c) => c !== 'windows')) {
            const h = document.createElement('div');
            h.className = 'stamp-cat';
            h.textContent = `${CATEGORIES[cat].icon} ${CATEGORIES[cat].name}`;
            const grid = document.createElement('div');
            grid.className = 'grid';
            for (const id of ELEMENT_IDS.filter((k) => ELEMENTS[k].cat === cat)) {
                const b = document.createElement('button');
                b.className = 'stamp' + (id === this.stamp ? ' on' : '');
                b.dataset.k = id;
                b.title = ELEMENTS[id].name;
                b.innerHTML = `<img alt="" src="${thumbUrl(id)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${ELEMENTS[id].icon}',style:'font-size:30px'}))"><span class="nm">${ELEMENTS[id].name}</span>`;
                b.addEventListener('click', () => {
                    this.audio.ui('click'); this.stamp = id;
                    for (const x of stamps.querySelectorAll('.stamp')) x.classList.toggle('on', x === b);
                    this.onTool(this.tool);
                });
                grid.appendChild(b);
            }
            stamps.append(h, grid);
        }
        $('btn-clear').addEventListener('click', () => { this.audio.ui('erase'); this.onParams((p) => { p.pins = p.pins.filter((e) => e.l !== this.cur); p.stamps = p.stamps.filter((e) => e.l !== this.cur); p.erased = p.erased.filter((e) => e.l !== this.cur); }, 'Cleared this level'); });
    }

    setTool(t) {
        this.tool = t;
        for (const b of document.querySelectorAll('.tool')) b.classList.toggle('on', b.dataset.tool === t);
        $('brushes').hidden = t !== 'paint';
        $('stamps').hidden = t !== 'stamp';
        $('tool-hint').textContent = {
            look: 'Drag to turn the dungeon, right-drag or two fingers to slide it, pinch or scroll to zoom.',
            paint: 'Tap a square to pin it. The rest of the level regrows around what you paint. Dragging still turns the view.',
            stamp: 'Pick something, then tap the floor to put it there.',
            erase: 'Tap anything to tidy it away: monsters, hoards, torches, windows.',
        }[t];
        this.onTool(t);
    }

    // ------------------------------------------------------------------ settings
    buildSettings() {
        const s = this.settings;
        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), pom = $('set-pom'), look = $('set-look');
        sfx.value = s.sfx; music.value = s.music; touch.value = s.touch; pom.checked = s.pom; look.value = s.look;
        for (const el of [sfx, music, look]) el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
        const changed = () => {
            Object.assign(s, { sfx: +sfx.value, music: +music.value, touch: touch.value, pom: pom.checked, look: +look.value });
            for (const el of [sfx, music, look]) el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
            this.onSettings(s);
        };
        for (const el of [sfx, music, touch, pom, look]) el.addEventListener('change', changed);
        for (const el of [sfx, music, look]) el.addEventListener('input', changed);
    }

    // ------------------------------------------------------------------ sync from params
    sync(params, d, cur) {
        this.cur = cur;
        if (document.activeElement !== $('seed')) $('seed').value = params.seed;
        for (const b of $('size').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === params.size);
        $('lv-count').textContent = params.levels;
        $('lv-minus').disabled = params.levels <= 1;
        $('lv-plus').disabled = params.levels >= MAX_LEVELS;
        for (const k of Object.keys(MIX)) { const s = this.sliders['mix:' + k]; s.input.value = params.mix[k]; s.show(); }
        for (const k of CATEGORY_IDS) { const s = this.sliders['els:' + k]; s.input.value = params.el[k]; s.show(); }
        this.buildThemes(params, d, cur);
        this.buildDepth(params, d, cur);
        this.info(params, d, cur);
    }

    buildDepth(params, d, cur) {
        const stops = $('depth-stops');
        stops.innerHTML = '';
        d.levels.forEach((L, k) => {
            const b = document.createElement('button');
            b.className = 'stop' + (k === cur ? ' on' : '');
            b.style.background = k === cur ? '' : `linear-gradient(160deg, ${SWATCH[L.theme]}55, ${SWATCH[L.theme]}22)`;
            b.innerHTML = `${k + 1}<span class="em" aria-hidden="true">${THEMES[L.theme].icon}</span>`;
            b.title = `${L.name} (${THEMES[L.theme].name})`;
            b.setAttribute('aria-label', `Level ${k + 1}: ${L.name}`);
            b.addEventListener('click', () => this.onLevel(k));
            stops.appendChild(b);
        });
        const r = $('depth-range');
        r.max = Math.max(0, d.levels.length - 1);
        r.value = cur;
        r.hidden = d.levels.length < 2;
        if (!r.bound) { r.bound = true; r.addEventListener('input', () => this.onLevel(+r.value)); }
    }

    info(params, d, cur) {
        const L = d.levels[cur];
        if (!L) return;
        let friends = 0, hoards = 0;
        for (const f of L.features) {
            const c = ELEMENTS[f.kind]?.cat;
            if (c === 'monsters') friends++; else if (c === 'hoards') hoards++;
        }
        $('info-title').textContent = `${cur + 1}. ${L.name}`;
        $('info-sub').textContent = `${THEMES[L.theme].name} · ${L.rooms.length} chamber${L.rooms.length === 1 ? '' : 's'} · ${friends} friend${friends === 1 ? '' : 's'} · ${hoards} hoard${hoards === 1 ? '' : 's'}${L.spouts.length ? ` · ${L.spouts.length} waterfall${L.spouts.length === 1 ? '' : 's'}` : ''}`;
        $('dname').textContent = `“${params.seed}” · ${d.levels.length} level${d.levels.length === 1 ? '' : 's'}`;
    }
    hover(text) { $('info-hover').textContent = text || ''; }

    // ------------------------------------------------------------------ walking
    walkHud(G) {
        const t = totals(G);
        const L = G.d.levels[G.lv];
        $('walk-name').textContent = `${G.lv + 1}. ${L.name}`;
        $('walk-friends').textContent = `💛 ${G.friends}/${t.friends}`;
        $('walk-gold').textContent = `💰 ${G.gold}`;
    }

    /** The minimap: the level's micro grid, what's found and the explorer's arrow. */
    minimap(G) {
        const c = $('minimap'), L = G.d.levels[G.lv];
        const w = c.clientWidth || 180, h = c.clientHeight || 140, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const s = Math.min((w - 12) / L.mw, (h - 12) / L.mh), ox = (w - L.mw * s) / 2, oy = (h - L.mh * s) / 2;
        if (this.mapLevel !== L) {
            // cache the floor plan once per level
            this.mapLevel = L;
            const off = document.createElement('canvas');
            off.width = L.mw; off.height = L.mh;
            const og = off.getContext('2d'), img = og.createImageData(L.mw, L.mh);
            for (let y = 0; y < L.mh; y++) for (let x = 0; x < L.mw; x++) {
                const ch = L.grid[y][x], i = (y * L.mw + x) * 4;
                const col = ch === '#' ? [0, 0, 0, 0] : ch === '~' ? [110, 190, 230, 230] : ch === 'o' ? [60, 50, 70, 255] : ch === 'v' || ch === '^' ? [255, 210, 120, 255] : [244, 226, 196, 220];
                img.data.set(col, i);
            }
            og.putImageData(img, 0, 0);
            this.mapImg = off;
        }
        g.imageSmoothingEnabled = false;
        g.drawImage(this.mapImg, ox, oy, L.mw * s, L.mh * s);
        for (const f of L.features) {
            const c2 = ELEMENTS[f.kind]?.cat;
            if (c2 !== 'monsters' && c2 !== 'hoards') continue;
            g.fillStyle = G.found[f.id] ? 'rgba(140,140,140,0.6)' : c2 === 'monsters' ? '#ff8fa8' : '#ffd040';
            g.beginPath(); g.arc(ox + (f.mx + 0.5) * s, oy + (f.my + 0.5) * s, Math.max(2, s * 0.7), 0, Math.PI * 2); g.fill();
        }
        const px = ox + (G.x / 2) * s, py = oy + (G.z / 2) * s;
        g.save(); g.translate(px, py); g.rotate(G.yaw);
        g.fillStyle = '#fff6e5'; g.strokeStyle = '#2b1d2e'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.stroke();
        g.restore();
    }

    setTouch(on, walking) {
        this.touchOn = on;
        $('touch').hidden = !(on && walking);
        document.body.classList.toggle('touchdeck', on && walking);    // the minimap moves out from under the stick
    }

    // ------------------------------------------------------------------ sheets
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });     // a sheet opened from another sits on top (game-088)
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
    }
}

export { LOOKS, hex };
