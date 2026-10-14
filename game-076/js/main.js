// TALEWRIGHT — boot and wiring. Builds the runtime (TW), opens the meta save
// and the last project, lays out the Atelier and connects the tools, panels,
// dialogs, keyboard shortcuts and the story.
import { h, $, modal, toast, popMenu, promptDialog, confirmDialog, clear, field } from './editor/ui.js';
import { bus } from './editor/bus.js';
import { store } from './editor/store.js';
import { MapView, TOOLS, LAYERS, ZOOMS } from './editor/mapview.js';
import { Palette } from './editor/palette.js';
import { MapList } from './editor/maplist.js';
import { openEventEditor } from './editor/eventedit.js';
import { openDatabase } from './editor/database.js';
import { openForge } from './editor/forge.js';
import { playtest, playtestOpen } from './editor/playtest.js';
import { openExport, downloadProject, buildStandalone, buildPlayer } from './editor/exporter.js';
import { TEMPLATES, makeTemplate } from './editor/templates.js';
import { pageWarning } from './editor/pages.js';
import { sampleProject, SAMPLE_ID } from './editor/sample.js';
import { meta } from './meta/progress.js';
import './meta/shop.js';
import { atelier } from './meta/atelier.js';
import { playScene, portrait } from './meta/mentor.js';

// ── the runtime ──
const TW = {};
for (const [, fn] of window.TW_MODULES) fn(TW);
window.TW = TW;
store.init(TW);
meta.load();
TW.audio.configure({ sound: meta.data.settings.sound, music: meta.data.settings.music, volume: meta.data.settings.volume });
document.body.classList.toggle('reduce-motion', !!meta.data.settings.reduceMotion);

const ed = { mapId: null };
let view, palette, maplist;

// ── layout ──
function build() {
    view = new MapView($('#stage'), {
        onEditEvent: (map, ev) => editEvent(map, ev),
        onNewEvent: (map, x, y) => newEvent(map, x, y),
        onContext: (pt, map, c, ev) => contextMenu(pt, map, c, ev),
        onHover: (c) => { $('#st-cell').textContent = c.inside ? '(' + c.x + ', ' + c.y + ')' : ''; const m = view.map; const t = c.inside && m.layers[Math.min(view.layer, 2)][c.y * m.w + c.x]; const d = t && TW.tiles.def(m.tileset, t); $('#st-tile').textContent = d ? d.n : ''; const ev = c.inside && m.events.find((q) => q.x === c.x && q.y === c.y); const w = ev && pageWarning(ev); if (ev) $('#st-tile').textContent = ev.name + (w ? ' — ⚠ ' + w : ''); },
        onZoom: (z) => { $('#zoom').textContent = Math.round(z * 100) + '%'; },
        onLayer: (li) => setLayer(li),
        onBrush: (b) => palette.show(b.tiles[0]),
        onSelect: () => {},
    });
    palette = new Palette($('#palette'), (brush, def) => {
        view.brush = brush;
        if (view.tool === 'eraser' || view.tool === 'picker' || view.tool === 'event' || view.tool === 'start') setTool('pencil');
        // decor and over tiles go on their own layers
        if (def && brush.w * brush.h === 1) {
            if (def.k === 'd' && view.layer !== 1 && meta.has('layer.decor')) { setLayer(1); hintOnce('decor', 'Decor tiles (marked D) go on the Decor layer, so the ground stays underneath.'); }
            else if (def.k === 'o' && view.layer !== 2) { if (meta.has('layer.over')) { setLayer(2); hintOnce('over', 'Over tiles (marked O) are drawn above characters: treetops, roof edges, archways.'); } else if (view.layer !== 1) setLayer(1); }
            else if ((!def.k || def.k === 'g') && view.layer !== 0) setLayer(0);
        }
        if (view.layer === 3) setLayer(0);
    });
    maplist = new MapList($('#maps'), (id) => openMap(id));

    // tools and layers
    const tools = $('#tools');
    for (const t of TOOLS) tools.appendChild(h('button.tool', { id: 'tool-' + t.id, 'data-tool': t.id, title: t.label + (t.key ? ' (' + t.key.toUpperCase() + ')' : ''), 'aria-label': t.label, on: { click: () => setTool(t.id) } }, h('span', { text: t.icon })));
    const layers = $('#layers');
    for (const l of LAYERS) layers.appendChild(h('button.layer', { id: 'layer-' + l.id, 'data-layer': l.id, role: 'radio', title: l.label + ' layer (' + (l.id + 1) + ')', on: { click: () => setLayer(l.id) } }, l.label));
    refreshLocks();

    $('#btn-undo').onclick = () => store.undo();
    $('#btn-redo').onclick = () => store.redo();
    $('#btn-zoomin').onclick = () => view.zoomStep(1);
    $('#btn-zoomout').onclick = () => view.zoomStep(-1);
    $('#btn-grid').onclick = (e) => { view.grid = !view.grid; e.currentTarget.classList.toggle('on', view.grid); view.render(); };
    $('#btn-dim').onclick = (e) => { view.dim = !view.dim; e.currentTarget.classList.toggle('on', view.dim); view.render(); };

    $('#btn-project').onclick = (e) => projectMenu(e.currentTarget);
    $('#btn-db').onclick = () => openDatabase();
    $('#btn-forge').onclick = () => openForge();
    $('#btn-playtest').onclick = () => startPlaytest();
    $('#btn-export').onclick = () => openExport();
    $('#btn-trophies').onclick = () => atelier.trophies();
    $('#btn-shop').onclick = () => atelier.emporium();
    $('#btn-journal').onclick = () => atelier.journal();
    $('#btn-settings').onclick = () => atelier.settings(() => location.reload());
    $('#proj-title').onclick = async () => {
        const v = await promptDialog('Your game\'s title', 'Title', store.project.system.title);
        if (v) { store.project.system.title = v; store.project.meta.title = v; store.commit('Rename'); }
    };
    for (const b of document.querySelectorAll('#bottombar button')) b.onclick = () => showPanel(b.dataset.panel);

    atelier.init($('#right'), { ink: $('#ink'), rank: $('#rank'), rankbar: $('#rankbar') });
}

function hintOnce(k, text) {
    if (meta.flag('hint.' + k)) return;
    meta.flag('hint.' + k, true);
    atelier.panel.speak('Q', text);
}
function showPanel(which) {
    document.body.classList.toggle('show-left', which === 'left');
    document.body.classList.toggle('show-right', which === 'right');
    for (const b of document.querySelectorAll('#bottombar button')) b.classList.toggle('on', b.dataset.panel === which);
    setTimeout(() => view.render(), 50);
}

function setTool(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (t && !meta.has(t.f)) { toast(t.label + ': ' + meta.why(t.f), 'warn'); return; }
    view.tool = id;
    if (id === 'event') setLayer(3);
    else if (view.layer === 3 && id !== 'start') setLayer(0);
    for (const b of document.querySelectorAll('.tool')) b.classList.toggle('on', b.dataset.tool === id);
    view.render();
}
function setLayer(li) {
    const l = LAYERS[li];
    if (l.f && !meta.has(l.f)) { toast(l.label + ' layer: ' + meta.why(l.f), 'warn'); return; }
    view.layer = li;
    if (li === 3) view.tool = 'event';
    else if (view.tool === 'event' || view.tool === 'start') view.tool = 'pencil';
    for (const b of document.querySelectorAll('.layer')) { b.classList.toggle('on', +b.dataset.layer === li); b.setAttribute('aria-checked', String(+b.dataset.layer === li)); }
    for (const b of document.querySelectorAll('.tool')) b.classList.toggle('on', b.dataset.tool === view.tool);
    view.render();
}
function refreshLocks() {
    for (const b of document.querySelectorAll('.tool')) { const t = TOOLS.find((x) => x.id === b.dataset.tool); const ok = meta.has(t.f); b.classList.toggle('locked', !ok); b.title = t.label + (t.key ? ' (' + t.key.toUpperCase() + ')' : '') + (ok ? '' : ' — ' + meta.why(t.f)); }
    for (const b of document.querySelectorAll('.layer')) { const l = LAYERS[+b.dataset.layer]; b.classList.toggle('locked', !!l.f && !meta.has(l.f)); }
    const lock = (id, f) => { const b = $('#' + id); b.classList.toggle('locked', !meta.has(f)); b.dataset.why = meta.has(f) ? '' : meta.why(f); };
    lock('btn-db', 'db'); lock('btn-forge', 'forge'); lock('btn-export', 'export');
}

// ── projects ──
function openProject(p, opts) {
    store.open(p, opts);
    meta.data.lastProject = p.id;
    meta.save();
    ed.mapId = null;
    openMap((p.maps.find((m) => m.id === p.system.startMap) || p.maps[0]).id);
    titleBar();
}
function openMap(id) {
    const p = store.project;
    const m = p.maps.find((x) => x.id === id) || p.maps[0];
    ed.mapId = m.id;
    maplist.current = m.id;
    maplist.render();
    view.setMap(m);
    palette.setTileset(m.tileset);
    $('#tileset-name').textContent = TW.tiles.TILESETS[m.tileset].name;
    $('#st-map').textContent = m.name + ' · ' + m.w + '×' + m.h;
    $('#zoom').textContent = Math.round(view.zoom * 100) + '%';
}
function curMap() { return store.project.maps.find((m) => m.id === ed.mapId) || store.project.maps[0]; }
function titleBar() {
    const p = store.project;
    $('#proj-title').textContent = p.system.title || 'Untitled Tale';
    document.title = (p.system.title || 'Untitled') + ' — TALEWRIGHT';
}

function projectMenu(anchor) {
    popMenu(anchor, [
        { label: 'New project…', icon: '📄', key: '', onClick: () => newProjectDialog() },
        { label: 'Open…', icon: '📂', onClick: () => openDialog() },
        { label: 'Save', icon: '💾', key: 'Ctrl+S', onClick: () => saveNow() },
        '-',
        { label: 'Download project file', icon: '⬇', onClick: () => downloadProject() },
        { label: 'Import project file…', icon: '⬆', onClick: () => importDialog() },
        '-',
        { label: 'Open the Sample Game', icon: '🏮', onClick: () => openSample() },
        '-',
        { label: 'Database…', icon: '📚', key: 'F9', locked: !meta.has('db'), onClick: () => openDatabase() },
        { label: 'Sprite Forge…', icon: '🧵', locked: !meta.has('forge'), onClick: () => openForge() },
        { label: 'Export…', icon: '📕', locked: !meta.has('export'), onClick: () => openExport() },
    ]);
}
function saveNow() {
    const ok = store.saveNow();
    toast(ok ? 'Saved.' : 'Couldn\'t save to this browser. Use Project ▸ Download to keep your work.', ok ? 'ok' : 'warn', { icon: '💾' });
}
async function newProjectDialog() {
    const title = await promptDialog('New project', 'What is your tale called?', 'Untitled Tale', 'Create');
    if (!title) return;
    store.saveNow();
    const p = TW.schema.newProject({ title });
    openProject(p);
    store.saveNow();
    toast('A fresh page. Paint something!', 'ok', { icon: '📄' });
}
function openDialog() {
    store.saveNow();
    const list = store.list();
    const body = h('div.openlist');
    const draw = () => {
        clear(body);
        body.appendChild(h('div.openrow.sample', h('span.oicon', { text: '🏮' }), h('div.grow', h('b', { text: 'The Lantern of Fernhollow' }), h('span.dim', { text: 'The Atelier\'s sample game: five maps, a quest, shops, battles and a boss. Open a copy and see how it\'s made.' })), h('button.primary.small', { text: 'Open a copy', on: { click: () => { m.close(); openSample(); } } })));
        const items = store.list();
        if (!items.length) body.appendChild(h('p.hint', { text: store.storageOk ? 'No saved projects yet.' : 'This browser is blocking storage, so projects can\'t be kept here. Use Download and Import.' }));
        for (const e of items) {
            body.appendChild(h('div.openrow' + (store.project && e.id === store.project.id ? '.cur' : ''), h('span.oicon', { text: '📘' }), h('div.grow', h('b', { text: e.title }), h('span.dim', { text: new Date(e.modified).toLocaleString() + ' · ' + (e.maps || 1) + ' map(s) · ' + Math.ceil((e.size || 0) / 1024) + ' KB' })),
                h('button.small.primary', { text: 'Open', on: { click: () => { const p = store.load(e.id); if (!p) { toast('That project could not be read.', 'warn'); return; } m.close(); openProject(p); } } }),
                h('button.small.danger', { text: 'Delete', disabled: store.project && e.id === store.project.id, on: { click: async () => { if (await confirmDialog('Delete project', 'Delete "' + e.title + '" from this browser for good?', 'Delete', true)) { store.remove(e.id); draw(); } } } })));
        }
    };
    const m = modal({ title: 'Open a project', wide: true, body, buttons: [{ label: 'Close' }] });
    draw();
    void list;
}
function importDialog() {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.onchange = () => {
        const f = input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const p = store.importText(String(r.result));
                store.saveNow();
                openProject(p);
                store.saveNow();
                bus.emit('edit', { kind: 'import' });
                toast('Imported "' + p.system.title + '".', 'ok', { icon: '⬆' });
            } catch (e) { toast('That file isn\'t a TALEWRIGHT project: ' + e.message, 'err'); }
        };
        r.readAsText(f);
    };
    input.click();
}
function openSample() {
    store.saveNow();
    const p = sampleProject(TW);
    p.id = 'p_' + Math.random().toString(36).slice(2, 9);
    p.meta.created = Date.now();
    p.meta.sample = true;
    openProject(TW.schema.validate(p));
    store.saveNow();
    meta.flag('sample', true);
    atelier.soon();
    toast('A copy of the sample is yours to take apart. Right-click events, open the Database, playtest it.', 'ok', { icon: '🏮', ms: 6000 });
}

// ── events ──
function editEvent(map, ev) {
    if (!meta.has('events')) { toast('Events: ' + meta.why('events'), 'warn'); return; }
    openEventEditor(map, ev, { onSave: () => { view.sel = null; view.render(); } });
}
function newEvent(map, x, y, tpl) {
    if (!meta.has('events')) { toast('Events: ' + meta.why('events'), 'warn'); return; }
    if (map.events.some((e) => e.x === x && e.y === y)) return;
    if (map.events.length >= 500) { toast('A map holds at most 500 events.', 'warn'); return; }
    const place = (ev) => {
        map.events.push(ev);
        store.commit('New event');
        bus.emit('edit', { kind: 'newEvent', event: ev });
        view.sel = ev.id;
        view.render();
        openEventEditor(map, ev, { onSave: () => { view.render(); } });
    };
    if (tpl) makeTemplate(tpl, map, x, y, place);
    else place(TW.schema.event(TW.schema.nextId(map.events), x, y));
}
let evClip = null;
function contextMenu(pt, map, c, ev) {
    const canEv = meta.has('events');
    const items = [];
    if (ev) {
        items.push({ header: ev.name });
        items.push({ label: 'Edit event…', icon: '✎', onClick: () => editEvent(map, ev) });
        items.push({ label: 'Copy event', icon: '⧉', onClick: () => { evClip = JSON.parse(JSON.stringify(ev)); toast('Event copied'); } });
        items.push({ label: 'Delete event', icon: '🗑', onClick: () => { map.events = map.events.filter((e) => e !== ev); store.commit('Delete event'); view.sel = null; view.render(); } });
    } else {
        items.push({ header: 'Tile (' + c.x + ', ' + c.y + ')' });
        items.push({ label: 'New event here…', icon: '★', disabled: !canEv, locked: !canEv, title: canEv ? '' : meta.why('events'), onClick: () => newEvent(map, c.x, c.y) });
        for (const t of TEMPLATES) {
            const ok = meta.has(t.f);
            items.push({ label: t.label, icon: t.icon, disabled: !ok, locked: !ok, title: ok ? 'Quick template' : meta.why(t.f), onClick: () => newEvent(map, c.x, c.y, t.id) });
        }
        if (evClip && canEv) items.push({ label: 'Paste event', icon: '📋', onClick: () => { const e = JSON.parse(JSON.stringify(evClip)); e.id = TW.schema.nextId(map.events); e.x = c.x; e.y = c.y; map.events.push(e); store.commit('Paste event'); bus.emit('edit', { kind: 'newEvent', event: e }); view.render(); } });
    }
    items.push('-');
    items.push({ label: 'Set hero start here', icon: '⚑', onClick: () => view.setStart(c) });
    items.push({ label: 'Playtest from here', icon: '▶', onClick: () => startPlaytest({ at: { map: map.id, x: c.x, y: c.y } }) });
    popMenu(pt, items);
}

function startPlaytest(opts) {
    if (playtestOpen()) return;
    store.saveNow();
    try { playtest(opts); } catch (e) { toast('The playtest couldn\'t start: ' + e.message, 'err'); console.error(e); }
}

// ── keyboard ──
document.addEventListener('keydown', (e) => {
    if (playtestOpen() || document.querySelector('.scene')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); return; }
    if (e.key === 'F5' || (mod && e.key === 'Enter')) { e.preventDefault(); if (!document.querySelector('.modal-back')) startPlaytest(); return; }
    if (e.key === 'F9') { e.preventDefault(); if (!document.querySelector('.modal-back')) openDatabase(); return; }
    if (typing || document.querySelector('.modal-back')) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod && e.key.toLowerCase() === 'c' && view.sel) { const ev = curMap().events.find((x) => x.id === view.sel); if (ev) { evClip = JSON.parse(JSON.stringify(ev)); toast('Event copied'); } return; }
    if (mod && e.key.toLowerCase() === 'v' && evClip && view.selCell && meta.has('events')) { const m = curMap(); if (!m.events.some((x) => x.x === view.selCell.x && x.y === view.selCell.y)) { const ev = JSON.parse(JSON.stringify(evClip)); ev.id = TW.schema.nextId(m.events); ev.x = view.selCell.x; ev.y = view.selCell.y; m.events.push(ev); store.commit('Paste event'); bus.emit('edit', { kind: 'newEvent', event: ev }); view.render(); } return; }
    if (mod) return;
    if (e.key === ' ') { view.spaceDown = true; return; }
    const t = TOOLS.find((x) => x.key && x.key === e.key.toLowerCase());
    if (t) { setTool(t.id); return; }
    if (/^[1-4]$/.test(e.key)) { setLayer(+e.key - 1); return; }
    if (e.key === '+' || e.key === '=') view.zoomStep(1);
    if (e.key === '-' || e.key === '_') view.zoomStep(-1);
    if ((e.key === 'Delete' || e.key === 'Backspace') && view.sel) { const m = curMap(); m.events = m.events.filter((x) => x.id !== view.sel); view.sel = null; store.commit('Delete event'); view.render(); }
    if (e.key === 'Enter' && view.sel) { const m = curMap(); const ev = m.events.find((x) => x.id === view.sel); if (ev) editEvent(m, ev); }
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') view.spaceDown = false; });

// ── bus wiring ──
bus.on('project', () => { if (!view) return; const m = curMap(); view.setMap(m); maplist.current = m.id; maplist.render(); palette.setTileset(m.tileset); titleBar(); });
bus.on('change', (c) => {
    titleBar();
    if (c && (c.label === 'Paint' || c.label === 'Erase' || c.label === 'Move event')) return;
    maplist.render();
    const m = curMap();
    if (view.map !== m) view.setMap(m); else if (c && /Map properties|Database|Sprite|Edit event|New event|Delete|Paste|restore|Set start/.test(c.label)) { if (c.label === 'Map properties' || c.label === 'restore') view.setMap(m); else view.render(); }
    palette.setTileset(m.tileset);
    $('#tileset-name').textContent = TW.tiles.TILESETS[m.tileset].name;
    $('#st-map').textContent = m.name + ' · ' + m.w + '×' + m.h;
});
bus.on('saved', ({ ok }) => { $('#st-save').textContent = ok ? 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not saved (storage blocked)'; });
bus.on('storage-failed', () => toast('This browser won\'t let the Atelier save here. Your work is safe while the page is open: use Project ▸ Download to keep it.', 'warn', { ms: 9000 }));
bus.on('unlocks', () => { refreshLocks(); maplist.render(); view.render(); });
bus.on('db-changed', () => view.render());
bus.on('playtest-end', () => { atelier.soon(); view.render(); });
window.addEventListener('beforeunload', () => { if (store.dirty) store.saveNow(); meta.save(); });

// ── first run ──
function chooseMode(done) {
    const q = portrait(110, 'Q');
    const card = (icon, title, text, onClick) => h('button.modecard', { on: { click: onClick } }, h('span.modeicon', { text: icon }), h('b', { text: title }), h('span', { text }));
    let m;
    const body = h('div.modechoose', h('div.modeq', q.el, h('p', { text: 'Welcome to the Atelier of Unwritten Worlds. How would you like to begin?' })),
        h('div.modecards',
            card('📖', 'Story Mode', 'Start with a blank page and a pencil. Chapter by chapter, Quillon restores the Atelier\'s tools and teaches you to use them. Recommended.', () => { m.close('story'); done('story'); }),
            card('🗝', 'Free Mode', 'Every tool unlocked from the start, for apprentices who already know their way around an RPG maker. Quests and trophies still count.', () => { m.close('free'); done('free'); })));
    m = modal({ title: 'TALEWRIGHT', wide: true, sticky: true, body, cls: 'modemodal' });
}

function boot() {
    build();
    const last = meta.data.lastProject && store.load(meta.data.lastProject);
    const recent = !last && store.list()[0] && store.load(store.list()[0].id);
    const p = last || recent;
    if (p) openProject(p);
    else {
        const fresh = TW.schema.newProject({ title: 'My First Tale' });
        openProject(fresh);
        store.saveNow();
    }
    setTool('pencil'); setLayer(0);
    if (!meta.data.mode) {
        chooseMode((mode) => {
            meta.data.mode = mode;
            if (mode === 'free') meta.data.flags.free = true;
            meta.save();
            refreshLocks();
            atelier.render();
            playScene(mode === 'free' ? 'free-start' : 'ch0-start', () => { atelier.greet(); atelier.soon(); });
        });
    } else {
        atelier.soon();
        setTimeout(() => atelier.greet(), 400);
    }
    if (!store.storageOk) setTimeout(() => bus.emit('storage-failed'), 800);
    const hr = new Date().getHours();
    if (hr >= 0 && hr < 4 && !meta.data.flags.nightowl) { meta.data.flags.nightowl = true; meta.save(); }
    // debug and test hooks
    window.__tal = { TW, store, meta, atelier, view: () => view, ed, openMap, setTool, setLayer, startPlaytest, openSample, curMap, bus, newEvent, buildStandalone, buildPlayer, playtestOpen };
}

boot();
void ZOOMS; void field;
