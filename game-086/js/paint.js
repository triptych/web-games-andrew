/**
 * paint.js — the painting screen: wires the Painter (canvas, camera, gestures) to the rules in
 * progress.js, and owns the tool bar and palette. Two modes:
 *   number  colour-by-number on a story or bonus page
 *   free    the Freestyle Studio: repaint a finished mosaic with any colours
 */
import { Painter } from './painter.js';
import { VIEW, LANTERN_AT, STARBURST, GLIMMER } from './config.js';
import { hexToRgb, luma } from './pixelart.js';
import { ART_BY_ID } from './artworks.js';
import { has, brushLevel } from './skills.js';
import {
    pageOf, beginStroke, paintCells, undoStroke, brushCells, pourCells, burstCells, freePourCells, remainingOf,
    remainingCells, nearestRemaining, firstUnfinishedColor, finishIfComplete, canFlourish, useCharge, studioPalette,
} from './progress.js';
import { $, el, toast, greyOf, mix, drawArt, exportPng, sharePng, openModal, closeModal, modalOpen, dialogueOpen } from './ui.js';

const rgbCss = ([r, g, b]) => `rgb(${r},${g},${b})`;
const inkOn = (hex) => (luma(hex) > 0.62 ? '#241a3c' : '#ffffff');

export class PaintScreen {
    constructor(app) {
        this.app = app;
        this.active = false;
        this.stage = $('stage');
        this.painter = new Painter($('paint-canvas'), {
            onStrokeStart: () => this.strokeStart(),
            onStrokeCell: (x, y) => this.strokeCell(x, y),
            onStrokeEnd: () => this.strokeEnd(),
            onStrokeCancel: () => this.strokeCancel(),
            onTap: (x, y) => this.tap(x, y),
            onCamera: () => this.cameraMoved(),
            onFirstTouch: () => app.sound.unlock(),
        });
        this.hudQueued = false;
        this.hintedZoom = false;
        $('zoom-in').addEventListener('click', () => this.painter.zoomBy(1.6));
        $('zoom-out').addEventListener('click', () => this.painter.zoomBy(1 / 1.6));
        $('zoom-fit').addEventListener('click', () => this.painter.fit(true));
        $('paint-back').addEventListener('click', () => this.exit());
        this.bindMinimap();
        document.addEventListener('keydown', (e) => this.key(e));
        document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.painter.spaceHeld = false; });
    }

    get state() { return this.app.state; }

    /* ───────────── opening ───────────── */

    open(artId, mode = 'number') {
        const art = ART_BY_ID[artId];
        this.art = art;
        this.mode = mode;
        this.undo = [];
        this.stroke = null;
        this.active = true;
        $('paint-name').textContent = mode === 'free' ? `${art.title} · Freestyle` : art.title;
        if (mode === 'free') {
            this.freePal = studioPalette(art);
            if (!this.state.free[art.id]) this.state.free[art.id] = Uint8Array.from(art.cells, (c) => c + 1);
            this.cells = this.state.free[art.id];
            this.ps = null;
            this.color = 0;
        } else {
            this.ps = pageOf(this.state, art);
            this.precompute();
            this.color = Math.max(0, firstUnfinishedColor(art, this.ps));
        }
        this.tool = 'brush';
        this.painter.tool = 'brush';
        this.painter.showGrid = this.state.settings.grid;
        this.painter.trail = has(this.state, 'prismheart');
        this.painter.setPicture({ w: art.w, h: art.h, total: art.total, look: (i) => this.look(i) });
        this.buildTools();
        this.buildPalette();
        this.updateGlow();
        this.setupMinimap();
        this.hud();
        $('zoom-hint').hidden = true;
        requestAnimationFrame(() => { this.painter.resize(); this.cameraMoved(); });
    }

    close() {
        this.active = false;
        this.flushSave();
    }

    exit() {
        if (this.stroke) this.strokeEnd();
        this.close();
        this.app.onPaintExit(this.mode, this.art.id);
    }

    precompute() {
        const art = this.art;
        this.hex = art.palette.map((p) => p.hex);
        this.wrongFill = art.palette.map((p) => rgbCss(mix(p.hex, [196, 192, 210], 0.45)));
        this.grey = new Array(art.total);
        this.hi = new Array(art.total);
        for (let i = 0; i < art.total; i++) {
            const h = art.palette[art.cells[i]].hex;
            this.grey[i] = rgbCss(greyOf(h));
            const v = Math.round(92 + 44 * luma(h));
            this.hi[i] = rgbCss([v - 8, v - 14, v + 26]);
        }
        this.numbers = art.palette.map((_, k) => String(k + 1));
    }

    /** How pixel i looks right now: [fill, label, label ink, mistake mark]. */
    look(i) {
        if (this.mode === 'free') return [this.freePal[this.cells[i] - 1], null, '', false];
        const t = this.art.cells[i], c = this.ps.cells[i];
        if (c === t + 1 || this.ps.done) return [this.hex[t], null, '', false];
        if (c) return [this.wrongFill[c - 1], this.numbers[t], '#fff', true];
        if (t === this.color) return [this.hi[i], this.numbers[t], '#fff', false];
        return [this.grey[i], this.numbers[t], 'rgba(36,30,62,0.72)', false];
    }

    /* ───────────── tools and palette ───────────── */

    toolList() {
        const s = this.state;
        if (this.mode === 'free') {
            return [
                { id: 'brush', icon: '✎', label: 'Brush', key: 'B' },
                { id: 'move', icon: '✥', label: 'Move', key: 'M' },
                { id: 'pour', icon: '◉', label: 'Fill', key: 'P' },
                { sep: true },
                { id: 'undo', icon: '↶', label: 'Undo', key: 'Z', action: true },
                { id: 'restore', icon: '⟲', label: 'Original', action: true },
                { id: 'share', icon: '↗', label: 'Save', action: true },
            ];
        }
        return [
            { id: 'brush', icon: '✎', label: 'Brush', key: 'B' },
            { id: 'move', icon: '✥', label: 'Move', key: 'M' },
            has(s, 'pour') && { id: 'pour', icon: '◉', label: 'Pour', key: 'P' },
            has(s, 'burst') && { id: 'burst', icon: '✺', label: 'Burst', key: 'X' },
            has(s, 'seeker') && { id: 'seek', icon: '➶', label: 'Seek', key: 'N', action: true },
            has(s, 'flourish') && { id: 'flourish', icon: '❋', label: 'Finish', action: true },
            { sep: true },
            { id: 'undo', icon: '↶', label: 'Undo', key: 'Z', action: true },
        ].filter(Boolean);
    }

    buildTools() {
        const box = $('tools');
        box.replaceChildren();
        this.toolEls = {};
        for (const t of this.toolList()) {
            if (t.sep) { box.append(el('span', { class: 'tool-sep' })); continue; }
            const b = el('button', {
                class: 'tool', type: 'button', 'data-tool': t.id, title: t.key ? `${t.label} (${t.key})` : t.label, 'aria-label': t.label,
                onclick: () => this.useTool(t),
            }, t.icon, el('small', {}, t.label));
            if (t.id === 'burst') b.append(el('span', { class: 'count' }));
            if (!t.action) b.setAttribute('aria-pressed', 'false');
            this.toolEls[t.id] = b;
            box.append(b);
        }
        this.setTool(this.tool);
    }

    setTool(id) {
        this.tool = id;
        this.painter.tool = id === 'pour' || id === 'burst' ? 'tap' : id;
        this.stage.className = `stage tool-${id}`;
        for (const [k, b] of Object.entries(this.toolEls)) {
            if (b.hasAttribute('aria-pressed')) {
                b.classList.toggle('on', k === id);
                b.setAttribute('aria-pressed', String(k === id));
            }
        }
    }

    useTool(t) {
        this.app.sound.unlock();
        this.app.sound.click();
        if (!t.action) { this.setTool(t.id); return; }
        if (t.id === 'undo') this.undoLast();
        else if (t.id === 'seek') this.seek();
        else if (t.id === 'flourish') this.flourish();
        else if (t.id === 'restore') this.restoreOriginal();
        else if (t.id === 'share') this.shareFree();
    }

    buildPalette() {
        const box = $('palette');
        box.replaceChildren();
        this.swatches = [];
        const colors = this.mode === 'free' ? this.freePal : this.art.palette.map((p) => p.hex);
        colors.forEach((hex, k) => {
            const name = this.mode === 'free' ? `Colour ${k + 1}` : this.art.palette[k].name;
            const b = el('button', {
                class: 'swatch', type: 'button', role: 'radio', title: this.mode === 'free' ? hex : `${k + 1} · ${name}`,
                'aria-label': this.mode === 'free' ? `Colour ${hex}` : `${k + 1}, ${name}`,
                onclick: () => { this.app.sound.unlock(); this.app.sound.click(); this.selectColor(k); },
            }, el('span', { class: 'dot' }, this.mode === 'free' ? '' : String(k + 1)));
            b.style.setProperty('--c', hex);
            b.style.setProperty('--on', inkOn(hex));
            b.style.setProperty('--p', 100);
            if (this.mode !== 'free') b.append(el('span', { class: 'left' }));
            box.append(b);
            this.swatches.push(b);
        });
        this.updatePalette();
    }

    selectColor(k) {
        if (k < 0 || k >= this.swatches.length || k === this.color) return;
        this.color = k;
        if (this.mode === 'number') {
            this.painter.refresh();
            this.updateGlow();
            this.updateMinimapDots();
        }
        this.updatePalette();
        this.swatches[k].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    updatePalette() {
        this.swatches.forEach((b, k) => {
            const sel = k === this.color;
            b.classList.toggle('sel', sel);
            b.setAttribute('aria-checked', String(sel));
            if (this.mode === 'free') return;
            const total = this.art.counts[k], left = remainingOf(this.art, this.ps, k);
            b.style.setProperty('--p', Math.round(((total - left) / total) * 100));
            b.classList.toggle('finished', left === 0);
            b.querySelector('.dot').textContent = left === 0 ? '✓' : String(k + 1);
            b.querySelector('.left').textContent = left === 0 ? '' : String(left);
            b.querySelector('.left').hidden = left === 0;
        });
    }

    /* ───────────── painting ───────────── */

    strokeStart() {
        if (this.mode === 'free') { this.stroke = { changes: [] }; return; }
        if (this.ps.done) return;
        this.stroke = beginStroke(this.state, this.art, this.ps);
    }

    strokeCell(x, y) {
        if (!this.stroke) return;
        if (this.mode === 'free') {
            this.freePaint(brushCells(this.art, x, y, brushLevel(this.state), -1, false));
            return;
        }
        this.apply(brushCells(this.art, x, y, brushLevel(this.state), this.color, true));
    }

    strokeEnd() {
        const st = this.stroke;
        this.stroke = null;
        if (!st || !st.changes.length) return;
        this.undo.push(st);
        if (this.undo.length > 200) this.undo.shift();
        this.afterAction();
    }

    strokeCancel() {
        const st = this.stroke;
        this.stroke = null;
        if (!st) return;
        if (this.mode === 'free') this.revertFree(st);
        else this.painter.refresh(undoStroke(this.state, this.art, this.ps, st));
        this.hud();
    }

    /** Paint indices with the current colour, with all the feedback. */
    apply(indices) {
        const res = paintCells(this.state, this.art, this.ps, indices, this.color, this.stroke);
        if (!res.correct.length && !res.wrong.length) return res;
        this.painter.refresh([...res.correct, ...res.wrong]);
        const hex = this.hex[this.color];
        res.correct.forEach((i, n) => { if (n < 6) this.painter.sparkle(i, hex); });
        if (res.correct.length) this.app.sound.pluck(this.state.streak);
        if (res.wrong.length) this.app.sound.oops();
        this.queueHud();
        return res;
    }

    freePaint(indices) {
        const v = this.color + 1, changed = [];
        for (const i of indices) {
            if (this.cells[i] === v) continue;
            this.stroke.changes.push([i, this.cells[i]]);
            this.cells[i] = v;
            changed.push(i);
        }
        if (changed.length) { this.painter.refresh(changed); this.app.sound.pluck(0); }
    }

    revertFree(st) {
        const changed = [];
        for (let k = st.changes.length - 1; k >= 0; k--) { const [i, b] = st.changes[k]; this.cells[i] = b; changed.push(i); }
        this.painter.refresh(changed);
    }

    tap(x, y) {
        const i = y * this.art.w + x;
        if (this.mode === 'free') {
            if (this.tool !== 'pour') return;
            this.stroke = { changes: [] };
            this.freePaint(freePourCells(this.art.w, this.art.h, this.cells, x, y));
            this.strokeEnd();
            return;
        }
        if (this.ps.done) return;
        if (this.tool === 'pour') {
            if (this.art.cells[i] !== this.color) {
                toast(`Pour needs a pixel numbered ${this.color + 1}. That one is ${this.art.cells[i] + 1}.`);
                this.app.sound.oops();
                return;
            }
            this.stroke = beginStroke(this.state, this.art, this.ps);
            const res = this.apply(pourCells(this.art, x, y));
            if (res.correct.length > 1) this.app.sound.pour();
            this.strokeEnd();
        } else if (this.tool === 'burst') {
            if (this.state.charges <= 0) { toast(`Starburst is recharging: ${STARBURST.pixelsPerCharge - this.state.chargeProgress} more pixels.`); return; }
            const cells = burstCells(this.art, x, y, this.color).filter((j) => this.ps.cells[j] !== this.color + 1);
            if (!cells.length) { toast(`No ${this.color + 1}s left near there. Try somewhere else.`); return; }
            this.stroke = beginStroke(this.state, this.art, this.ps);
            useCharge(this.state);
            this.apply(cells);
            this.app.sound.burst();
            this.strokeEnd();
        }
    }

    undoLast() {
        const st = this.undo.pop();
        if (!st) { toast('Nothing to undo yet.'); return; }
        if (this.mode === 'free') this.revertFree(st);
        else this.painter.refresh(undoStroke(this.state, this.art, this.ps, st));
        this.hud();
        this.updateGlow();
        this.queueSave();
    }

    seek() {
        if (this.ps.done) return;
        let c = this.color;
        if (remainingOf(this.art, this.ps, c) === 0) c = firstUnfinishedColor(this.art, this.ps, c);
        if (c < 0) return;
        if (c !== this.color) this.selectColor(c);
        const mid = this.painter.screenToCell(this.painter.W / 2, this.painter.H / 2);
        const i = nearestRemaining(this.art, this.ps, c, mid.fx, mid.fy);
        if (i < 0) return;
        this.painter.flyTo(i);
        this.painter.glow = [i, ...this.painter.glow.filter((j) => j !== i)];
        setTimeout(() => this.updateGlow(), 1600);
    }

    flourish() {
        if (!canFlourish(this.state, this.art, this.ps)) {
            toast(`Final Flourish wakes up at 90%. You're at ${Math.floor((this.ps.correct / this.art.total) * 100)}%.`);
            return;
        }
        this.stroke = beginStroke(this.state, this.art, this.ps);
        const all = [];
        for (let i = 0; i < this.art.total; i++) if (this.ps.cells[i] !== this.art.cells[i] + 1) all.push(i);
        for (const i of all) {
            const r = paintCells(this.state, this.art, this.ps, [i], this.art.cells[i], this.stroke);
            r.correct.forEach((j) => this.painter.sparkle(j, this.hex[this.art.cells[j]]));
        }
        this.painter.refresh(all);
        this.app.sound.burst();
        this.strokeEnd();
    }

    /** After every stroke: colour finished? picture finished? */
    afterAction() {
        if (this.mode === 'free') { this.queueSave(); return; }
        const res = finishIfComplete(this.state, this.art, this.ps);
        if (res) { this.completed(res); return; }
        if (remainingOf(this.art, this.ps, this.color) === 0) {
            this.app.sound.colorDone();
            const name = this.art.palette[this.color].name;
            const next = firstUnfinishedColor(this.art, this.ps, this.color);
            toast(`${name} is all done ✦`);
            if (next >= 0) this.selectColor(next);
        }
        this.updateGlow();
        this.hud();
        this.queueSave();
    }

    completed(result) {
        this.undo = [];
        this.painter.glow = [];
        this.painter.refresh();
        this.painter.fit(true);
        this.painter.playReveal();
        this.app.sound.complete();
        this.hud();
        this.buildTools();
        this.app.save();
        setTimeout(() => { if (this.active) this.app.onPageComplete(this.art, result); }, 1500);
    }

    /* ───────────── freestyle ───────────── */

    restoreOriginal() {
        openModal((card) => {
            card.append(
                el('h3', {}, 'Back to the original?'),
                el('p', {}, 'Every pixel goes back to the mosaic\'s own colours. You can undo this.'),
                el('div', { class: 'modal-actions' },
                    el('button', { class: 'btn', type: 'button', onclick: closeModal }, 'Keep mine'),
                    el('button', {
                        class: 'btn primary', type: 'button', onclick: () => {
                            closeModal();
                            this.stroke = { changes: [] };
                            const all = [];
                            for (let i = 0; i < this.art.total; i++) if (this.cells[i] !== this.art.cells[i] + 1) { this.stroke.changes.push([i, this.cells[i]]); this.cells[i] = this.art.cells[i] + 1; all.push(i); }
                            this.painter.refresh(all);
                            this.strokeEnd();
                        },
                    }, 'Restore')));
        });
    }

    async shareFree() {
        try {
            const blob = await exportPng(this.art, this.cells, this.freePal);
            const how = await sharePng(blob, `${this.art.title} (remix)`);
            if (how === 'downloaded') toast('Saved as a PNG ✦');
            else if (how === 'shared') toast('Shared ✦');
        } catch { toast('This browser could not make a PNG.'); }
    }

    /* ───────────── HUD ───────────── */

    queueHud() {
        if (this.hudQueued) return;
        this.hudQueued = true;
        requestAnimationFrame(() => { this.hudQueued = false; this.hud(); });
    }

    hud() {
        this.app.updateGlimmer();
        if (this.mode === 'free') { $('paint-prog').style.width = '100%'; $('streak').hidden = true; return; }
        $('paint-prog').style.width = `${(this.ps.correct / this.art.total) * 100}%`;
        this.updatePalette();
        const s = this.state;
        const burst = this.toolEls.burst;
        if (burst) {
            burst.querySelector('.count').textContent = `${s.charges}`;
            burst.classList.toggle('ready', s.charges > 0 && !this.ps.done);
        }
        if (this.toolEls.flourish) {
            const ok = canFlourish(s, this.art, this.ps);
            this.toolEls.flourish.classList.toggle('ready', ok);
        }
        const streakEl = $('streak');
        if (has(s, 'streak') && s.streak >= 10 && !this.ps.done) {
            streakEl.hidden = false;
            streakEl.textContent = `Streak ${s.streak} · ×${(1 + (GLIMMER.streakMax * Math.min(s.streak, GLIMMER.streakCap)) / GLIMMER.streakCap).toFixed(2)}`;
        } else streakEl.hidden = true;
        if (this.minimap) {
            drawArt(this.minimap.base, this.art, this.ps.cells, { grey: 'dark' });
            this.updateMinimapDots();
        }
    }

    updateGlow() {
        if (this.mode !== 'number' || this.ps.done || !has(this.state, 'lantern')) { this.painter.glow = []; return; }
        const left = remainingOf(this.art, this.ps, this.color);
        this.painter.glow = left > 0 && left <= LANTERN_AT ? remainingCells(this.art, this.ps, this.color) : [];
        this.painter.dirty = true;
    }

    cameraMoved() {
        if (!this.active || this.mode !== 'number' || !this.ps || this.ps.done) { $('zoom-hint').hidden = true; return; }
        const small = this.painter.cam.s < VIEW.numbersAt;
        if (!small) this.hintedZoom = true;
        $('zoom-hint').hidden = !small || this.hintedZoom;
    }

    /* ───────────── Star Map ───────────── */

    setupMinimap() {
        const c = $('minimap');
        const want = this.mode === 'number' && has(this.state, 'starmap') && !this.ps.done && this.art.w >= 24;
        c.hidden = !want;
        if (!want) { this.minimap = null; this.painter.minimap = null; return; }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = c.getBoundingClientRect().width || 120;
        c.width = Math.round(size * dpr);
        c.height = Math.round(size * dpr);
        this.minimap = { canvas: c, base: document.createElement('canvas'), dots: [] };
        this.painter.minimap = this.minimap;
        drawArt(this.minimap.base, this.art, this.ps.cells, { grey: 'dark' });
        this.updateMinimapDots();
    }

    updateMinimapDots() {
        if (!this.minimap) return;
        this.minimap.dots = remainingCells(this.art, this.ps, this.color).slice(0, 600);
        this.painter.dirty = true;
    }

    bindMinimap() {
        const c = $('minimap');
        const jump = (e) => {
            if (!this.minimap?.layout) return;
            e.preventDefault();
            const r = c.getBoundingClientRect(), k = c.width / r.width, L = this.minimap.layout;
            const fx = ((e.clientX - r.left) * k - L.ox) / L.k, fy = ((e.clientY - r.top) * k - L.oy) / L.k;
            this.painter.centerOn(fx, fy, Math.max(this.painter.cam.s, 24), true);
        };
        c.addEventListener('pointerdown', jump);
    }

    /* ───────────── saving ───────────── */

    queueSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.app.save(), 700);
    }

    flushSave() {
        if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = 0; }
        this.app.save();
    }

    /* ───────────── keyboard ───────────── */

    key(e) {
        if (!this.active || modalOpen() || dialogueOpen()) return;
        if (e.target.closest?.('input, textarea')) return;
        const k = e.key;
        if (e.code === 'Space') { this.painter.spaceHeld = true; e.preventDefault(); return; }
        if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); this.undoLast(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tools = this.toolList().filter((t) => !t.sep);
        const byKey = tools.find((t) => t.key && t.key.toLowerCase() === k.toLowerCase());
        if (/^[0-9]$/.test(k)) { this.selectColor(k === '0' ? 9 : +k - 1); return; }
        if (byKey) { e.preventDefault(); this.useTool(byKey); return; }
        const pan = 60;
        switch (k) {
            case '+': case '=': this.painter.zoomBy(1.4); break;
            case '-': case '_': this.painter.zoomBy(1 / 1.4); break;
            case 'f': case 'F': this.painter.fit(true); break;
            case '[': this.selectColor((this.color - 1 + this.swatches.length) % this.swatches.length); break;
            case ']': this.selectColor((this.color + 1) % this.swatches.length); break;
            case 'ArrowLeft': this.painter.panBy(pan, 0); break;
            case 'ArrowRight': this.painter.panBy(-pan, 0); break;
            case 'ArrowUp': this.painter.panBy(0, pan); break;
            case 'ArrowDown': this.painter.panBy(0, -pan); break;
            case 'Escape': this.exit(); break;
            default: return;
        }
        e.preventDefault();
    }
}
