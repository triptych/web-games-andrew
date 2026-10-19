// The Cartographer's Loft: the world's codex (places, factions, magic, creatures, artifacts, lore, cultures)
// and the map table, where the realm is drawn from a seed and places are pinned by tapping.

import { h, toast, confirmBox, debounce, grow, download } from './dom.js';
import { WORLD_KINDS, KIND_BY_ID } from '../sim/data/guild.js';
import { worldFleshed, roomOpen } from '../sim/progress.js';
import { countWords } from '../sim/text.js';
import { FIELD } from '../config.js';
import * as A from '../sim/actions.js';
import { drawMap } from '../view/map.js';
import { fileStem } from '../book/book.js';
import { askThalion } from './hall.js';

export function loftView(app, root) {
    const S = app.S, P = app.P();
    let tab = app.loftTab || 'place';
    let sel = app.loftSel || null;

    const tabs = h('div', { class: 'tabs wrap', role: 'tablist' });
    const body = h('div', { class: 'loft-body' });
    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Cartographer’s Loft'), h('div', { class: 'row-wrap' },
        roomOpen(S, 'well') ? h('button', { class: 'btn small', onclick: () => app.go('well') }, 'Draw a place from the Well') : null,
        h('button', { class: 'btn small ghost', onclick: () => askThalion(app, 'loft') }, 'Ask Thalion'))), tabs, body);

    function paintTabs() {
        tabs.innerHTML = '';
        for (const k of [...WORLD_KINDS, { id: 'map', name: 'Map' }]) {
            const n = k.id === 'map' ? P.map.pins.length : P.world.filter((e) => e.kind === k.id).length;
            tabs.append(h('button', { class: `tab${tab === k.id ? ' on' : ''}`, role: 'tab', 'aria-selected': String(tab === k.id), dataset: { tab: k.id }, onclick: () => { tab = k.id; app.loftTab = tab; sel = null; paint(); } }, k.name, n ? h('span', { class: 'tab-n' }, String(n)) : null));
        }
    }

    function paint() {
        paintTabs();
        body.innerHTML = '';
        if (tab === 'map') { paintMap(); return; }
        const kind = KIND_BY_ID[tab];
        const entries = P.world.filter((e) => e.kind === tab);
        if (!entries.find((e) => e.id === sel)) sel = entries[0]?.id || null;
        const list = h('div', { class: 'entries' },
            h('button', { class: 'btn primary', id: 'world-new', onclick: () => { const e = A.addWorld(S, tab, { name: `New ${kind.name.toLowerCase()}` }, app.ctx()); app.after(); sel = e.id; app.loftSel = sel; paint(); body.querySelector('#wf-name')?.select(); } }, `+ New ${kind.name.toLowerCase()}`),
            h('p', { class: 'hint' }, kind.blurb),
            entries.map((e) => h('button', { class: `entry${e.id === sel ? ' on' : ''}`, dataset: { entry: e.id }, onclick: () => { sel = e.id; app.loftSel = sel; paint(); } },
                h('strong', {}, e.name), h('span', { class: 'muted' }, (e.summary || '').slice(0, 70)), worldFleshed(e) ? h('span', { class: 'ok-dot', title: 'Set down' }, '✓') : null)));
        const e = P.world.find((x) => x.id === sel);
        const ed = h('section', { class: 'card entry-editor', id: 'entry-editor' });
        if (!e) ed.append(h('p', { class: 'muted' }, `No ${kind.name.toLowerCase()} yet.`));
        else {
            const status = h('p', { class: 'hint' });
            const paintStatus = () => {
                const need = [];
                if (!e.summary.trim()) need.push('a summary');
                const dw = countWords(e.details);
                if (dw < FIELD.placeWords) need.push(`details of ${FIELD.placeWords}+ words (${dw} so far)`);
                if (e.kind === 'magic') { if (!e.cost.trim()) need.push('a cost'); if (!e.limits.trim()) need.push('its limits'); }
                status.textContent = worldFleshed(e) ? 'Set down in the codex.' : `To set it down: ${need.join(', ')}.`;
                status.classList.toggle('ok', worldFleshed(e));
            };
            const save = debounce(() => { app.after(); paintStatus(); const b = body.querySelector(`[data-entry="${e.id}"] strong`); if (b) b.textContent = e.name; }, 350);
            const inp = (key, label, { long = false, rows = 3, ph = '' } = {}) => {
                const el = long ? grow(h('textarea', { id: `wf-${key}`, rows, value: e[key] || '', placeholder: ph })) : h('input', { type: 'text', id: `wf-${key}`, value: e[key] || '', placeholder: ph, maxlength: 600 });
                el.addEventListener('input', () => { A.editWorld(S, e.id, { [key]: el.value }, app.ctx()); paintStatus(); save(); });
                return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), el);
            };
            ed.append(
                inp('name', 'Name'),
                inp('summary', 'In a line', { ph: kind.id === 'place' ? 'A walled town where the bells ring on their own at dusk.' : '' }),
                kind.id === 'magic' ? [inp('source', 'Source', { ph: 'Where does the power come from?' }), inp('cost', 'Cost', { long: true, rows: 2, ph: 'What does it take from the one who uses it?' }), inp('limits', 'Limits', { long: true, rows: 2, ph: 'What can it never do?' })] : null,
                inp('details', 'Details', { long: true, rows: 7, ph: 'History, who lives there, what it smells like, what it wants.' }),
                inp('tags', 'Tags', { ph: 'north, ruins, the first war' }),
                status,
                h('div', { class: 'row-wrap' },
                    h('button', { class: 'btn small', onclick: () => { tab = 'map'; app.loftTab = 'map'; app.mapSel = e.id; paint(); } }, P.map.pins.some((p) => p.id === e.id) ? 'Move its pin on the map' : 'Pin it on the map'),
                    h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox(`Remove ${e.name}?`, 'It will be taken out of the codex and off the map.', { ok: 'Remove', danger: true })) { A.deleteWorld(S, e.id, app.ctx()); app.after(); sel = null; paint(); } } }, 'Remove')));
            paintStatus();
        }
        body.append(h('div', { class: 'loft-split' }, list, ed));
    }

    function paintMap() {
        const wrap = h('div', { class: 'map-wrap' });
        const canvas = h('canvas', { class: 'map-canvas', id: 'map-canvas', 'aria-label': 'Map of the realm. Tap to place the chosen pin.' });
        const side = h('div', { class: 'map-side' });
        let selId = app.mapSel || null;
        const draw = () => {
            const r = wrap.getBoundingClientRect();
            const w = Math.max(280, Math.min(1100, Math.floor(r.width)));
            const hh = Math.round(w * 2 / 3);
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.style.width = w + 'px';
            canvas.style.height = hh + 'px';
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(hh * dpr);
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawMap(ctx, w, hh, { seed: P.map.seed, title: P.title, pins: P.map.pins.map((p) => ({ ...p, label: P.world.find((e) => e.id === p.id)?.name || '', on: p.id === selId })) });
        };
        canvas.addEventListener('click', (ev) => {
            if (!selId) { toast('Choose something from the list first, then tap the map.'); return; }
            const r = canvas.getBoundingClientRect();
            A.pin(S, selId, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height, app.ctx());
            app.after();
            app.sound.blip();
            draw();
            paintSide();
        });
        function paintSide() {
            side.innerHTML = '';
            const pinnable = P.world.filter((e) => e.kind === 'place' || e.kind === 'faction' || e.kind === 'creature' || e.kind === 'artifact' || e.kind === 'lore' || e.kind === 'culture');
            side.append(h('h3', {}, 'Pins'), h('p', { class: 'hint' }, 'Choose an entry, then tap the map to pin it (tap again to move it).'),
                pinnable.length ? h('div', { class: 'pin-list' }, pinnable.map((e) => {
                    const pinned = P.map.pins.some((p) => p.id === e.id);
                    return h('div', { class: `pin-row${e.id === selId ? ' on' : ''}` },
                        h('button', { class: 'pin-pick', dataset: { pin: e.id }, 'aria-pressed': String(e.id === selId), onclick: () => { selId = e.id; app.mapSel = selId; paintSide(); draw(); } }, h('span', { class: `pin-dot${pinned ? ' pinned' : ''}` }), `${e.name}`, h('span', { class: 'muted' }, ` ${KIND_BY_ID[e.kind].name.toLowerCase()}`)),
                        pinned ? h('button', { class: 'icon-btn', 'aria-label': `Unpin ${e.name}`, onclick: () => { A.unpin(S, e.id, app.ctx()); app.after(); paintSide(); draw(); } }, '×') : null);
                })) : h('p', { class: 'muted' }, 'Add places to the codex, then pin them here.'),
                h('div', { class: 'row-wrap' },
                    h('button', { class: 'btn small', id: 'map-reroll', onclick: async () => { if (P.map.pins.length && !(await confirmBox('Redraw the land?', 'The coastline changes; your pins stay where they are.', { ok: 'Redraw' }))) return; A.rerollMap(S, app.ctx()); app.after(); draw(); } }, 'Redraw the land'),
                    h('button', { class: 'btn small', onclick: () => {
                        const c = document.createElement('canvas'); c.width = 1800; c.height = 1200;
                        drawMap(c.getContext('2d'), 1800, 1200, { seed: P.map.seed, title: P.title, pins: P.map.pins.map((p) => ({ ...p, label: P.world.find((e) => e.id === p.id)?.name || '' })) });
                        c.toBlob((b) => b && download(`${fileStem(P.title)}-map.png`, b, 'image/png'));
                    } }, 'Download the map')));
        }
        wrap.append(canvas);
        body.append(h('div', { class: 'map-split' }, wrap, side));
        paintSide();
        requestAnimationFrame(draw);
        const ro = new ResizeObserver(() => draw());
        ro.observe(wrap);
        cleanups.push(() => ro.disconnect());
    }

    const cleanups = [];
    paint();
    return () => cleanups.forEach((f) => f());
}
