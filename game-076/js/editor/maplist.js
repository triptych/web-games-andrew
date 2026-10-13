// The map list (open, add, duplicate, delete) and the map properties dialog
// (name, size, tileset, music, battle background, random encounters).
import { h, modal, field, row, section, toast, popMenu, confirmDialog, clear } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';
import { musicField, dbOptions } from './pickers.js';

const TW = () => store.TW;

export class MapList {
    constructor(el, onOpen) {
        this.el = el;
        this.onOpen = onOpen;
        this.current = null;
    }
    render() {
        const p = store.project;
        clear(this.el);
        const head = h('div.panelhead', h('b', { text: 'Maps' }), h('button.small', { title: meta.has('maps.many') || p.maps.length < 1 ? 'New map' : meta.why('maps.many'), text: '+ New', on: { click: () => this.add() } }));
        const list = h('ul.maplist', { role: 'list' });
        for (const m of p.maps) {
            const li = h('li' + (m.id === this.current ? '.on' : ''), { title: m.name + ' — ' + m.w + '×' + m.h + ', ' + (TW().tiles.TILESETS[m.tileset] || {}).name },
                h('button.mapname', { text: (p.system.startMap === m.id && p.system.startSet ? '⚑ ' : '') + m.name, on: { click: () => this.onOpen(m.id) } }),
                h('span.mapsize', { text: m.w + '×' + m.h }),
                h('button.icon.small', { text: '⋯', title: 'Map options', 'aria-label': 'Options for ' + m.name, on: { click: (e) => this.menu(e.currentTarget, m) } }));
            list.appendChild(li);
        }
        this.el.append(head, list);
    }
    menu(anchor, m) {
        const p = store.project;
        popMenu(anchor, [
            { label: 'Properties…', icon: '⚙', onClick: () => editMapProps(m) },
            { label: 'Duplicate', icon: '⧉', disabled: !meta.has('maps.many') || p.maps.length >= 64, locked: !meta.has('maps.many'), onClick: () => this.duplicate(m) },
            { label: 'Delete', icon: '🗑', disabled: p.maps.length < 2, onClick: () => this.remove(m) },
        ]);
    }
    add() {
        const p = store.project;
        if (!meta.has('maps.many') && p.maps.length >= 1) { toast('More maps: ' + meta.why('maps.many'), 'warn'); return; }
        if (p.maps.length >= 64) { toast('That\'s the most maps a project can have (64).', 'warn'); return; }
        const id = TW().schema.nextId(p.maps);
        const ts = this.current && p.maps.find((m) => m.id === this.current);
        const m = TW().schema.map(id, 'Map ' + id, 20, 15, ts && meta.has('tileset.' + ts.tileset) ? ts.tileset : 'meadow');
        p.maps.push(m);
        store.commit('New map');
        bus.emit('edit', { kind: 'mapCreate', map: m });
        this.onOpen(id);
        editMapProps(m, true);
    }
    duplicate(m) {
        const p = store.project;
        const c = JSON.parse(JSON.stringify(m));
        c.id = TW().schema.nextId(p.maps);
        c.name = m.name + ' (copy)';
        p.maps.push(c);
        store.commit('Duplicate map');
        bus.emit('edit', { kind: 'mapCreate', map: c });
        this.onOpen(c.id);
    }
    async remove(m) {
        const p = store.project;
        if (p.maps.length < 2) return;
        if (!(await confirmDialog('Delete map', 'Delete "' + m.name + '" and everything on it? (You can undo this.)', 'Delete', true))) return;
        p.maps = p.maps.filter((x) => x.id !== m.id);
        if (p.system.startMap === m.id) { p.system.startMap = p.maps[0].id; p.system.startSet = false; }
        store.commit('Delete map');
        this.onOpen(p.maps[0].id);
    }
}

/** The map properties dialog. */
export function editMapProps(map, isNew) {
    const p = store.project;
    const d = JSON.parse(JSON.stringify(map));
    const T = TW();
    const can = (f) => meta.has(f);
    const tsOptions = T.tiles.list().map((t) => { const ok = can('tileset.' + t.id) || t.id === map.tileset; return [t.id, t.name + (ok ? '' : ' 🔒'), !ok]; });
    const encBox = h('div.enclist');
    const renderEnc = () => {
        clear(encBox);
        d.encounters.forEach((en, i) => encBox.appendChild(row(
            field('Troop', 'select', en.troop, (v) => { en.troop = v; }, { numeric: true, options: dbOptions(p.troops) }),
            field('Weight', 'number', en.weight, (v) => { en.weight = v; }, { min: 1, max: 100 }),
            h('button.small.danger', { text: '✕', on: { click: () => { d.encounters.splice(i, 1); renderEnc(); } } }))));
        if (!p.troops.length) encBox.appendChild(h('p.hint', { text: 'Make troops in Database ▸ Troops to add random encounters.' }));
        else if (d.encounters.length < 12) encBox.appendChild(h('button.small', { text: '+ Add troop', on: { click: () => { d.encounters.push({ troop: p.troops[0].id, weight: 5 }); renderEnc(); } } }));
    };
    renderEnc();
    const bgs = Object.keys(T.tiles.BACKDROPS).map((b) => [b, b[0].toUpperCase() + b.slice(1)]);
    const body = h('div.form',
        row(field('Name', 'text', d.name, (v) => { d.name = v; }, { max: 48 }), field('Tileset', 'select', d.tileset, (v) => { d.tileset = v; }, { options: tsOptions })),
        can('mapprops') || isNew ? row(field('Width', 'number', d.w, (v) => { d.w = v; }, { min: 10, max: 120 }), field('Height', 'number', d.h, (v) => { d.h = v; }, { min: 10, max: 120 })) : h('p.hint', { text: 'Resizing maps: ' + meta.why('mapprops') }),
        field('Show the map name on entry', 'check', d.showName, (v) => { d.showName = v; }),
        can('mapmusic') || d.music ? musicField('Music', d.music, (v) => { d.music = v; }, '(keep playing)') : h('p.hint', { text: 'Map music: ' + meta.why('mapmusic') }),
        can('encounters') || d.encounters.length ? section('Battles',
            field('Battle background', 'select', d.battleBg || '', (v) => { d.battleBg = v; }, { options: [['', '(from the tileset)']].concat(bgs) }),
            field('Steps between encounters (0 = none)', 'number', d.encRate, (v) => { d.encRate = v; }, { min: 0, max: 999 }),
            encBox) : h('p.hint', { text: 'Random encounters: ' + meta.why('encounters') }));
    modal({
        title: (isNew ? 'New map' : 'Map properties') + ' — ' + map.name, body, wide: true,
        buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: () => {
            const W = Math.max(10, Math.min(120, d.w | 0)), H = Math.max(10, Math.min(120, d.h | 0));
            if (W !== map.w || H !== map.h) {
                const layers = map.layers.map((L, li) => { const out = new Array(W * H).fill(li === 0 ? 1 : 0); for (let y = 0; y < Math.min(H, map.h); y++) for (let x = 0; x < Math.min(W, map.w); x++) out[y * W + x] = L[y * map.w + x]; return out; });
                const lost = map.events.filter((e) => e.x >= W || e.y >= H).length;
                map.layers = layers; map.w = W; map.h = H;
                map.events = map.events.filter((e) => e.x < W && e.y < H);
                if (lost) toast(lost + ' event(s) outside the new size were removed. Undo brings them back.', 'warn');
                if (p.system.startMap === map.id) { p.system.startX = Math.min(p.system.startX, W - 1); p.system.startY = Math.min(p.system.startY, H - 1); }
                bus.emit('edit', { kind: 'mapResize', map });
            }
            if (d.tileset !== map.tileset) {
                const n = T.tiles.TILESETS[d.tileset].tiles.length;
                for (const L of map.layers) for (let i = 0; i < L.length; i++) if (L[i] > n) L[i] = L === map.layers[0] ? 1 : 0;
            }
            Object.assign(map, { name: d.name || map.name, tileset: d.tileset, showName: d.showName, music: d.music, battleBg: d.battleBg, encRate: Math.max(0, d.encRate | 0), encounters: d.encounters.filter((x) => x.troop) });
            store.commit('Map properties', { map: map.id });
            bus.emit('map-props', map);
            bus.emit('edit', { kind: 'mapProps', map });
            T.audio.stopMusic();
        } }],
        onClose: () => T.audio.stopMusic(),
    });
}
