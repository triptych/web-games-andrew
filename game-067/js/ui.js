/**
 * ui.js — every piece of DOM: the title, the toolbar and its trays, the train card, toasts, speech
 * bubbles and the modal panels (new island, my islands, the train workshop, stickers, settings,
 * the pause menu, help). It reads `app` and calls `act.*`; it never touches the simulation directly.
 */

import { PALETTE_CSS, PALETTE, T, N, MAX_CARS } from './config.js';
import { CATS, ITEMS, ITEM } from './sim/catalog.js';
import { ENGINES, CARS, trainLength, capacity, trainName } from './sim/trainsets.js';
import { PRESETS, generateIsland } from './sim/islands.js';
import { STICKERS } from './sim/stickers.js';

export const $ = (id) => document.getElementById(id);

/** Tiny element builder: h('div.cls#id', { onclick, style, ... }, children...) */
export function h(sel, attrs = {}, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
}

let app, act;

export const TOOLS = [
    { id: 'play', emoji: '👆', name: 'Play', c: 'var(--green)' },
    { id: 'track', emoji: '🛤️', name: 'Track', c: 'var(--orange)' },
    { id: 'build', emoji: '🏠', name: 'Build', c: 'var(--red)' },
    { id: 'land', emoji: '🎨', name: 'Land', c: 'var(--teal)' },
    { id: 'trains', emoji: '🚂', name: 'Trains', c: 'var(--blue)' },
    { id: 'bulldoze', emoji: '🧽', name: 'Clear', c: 'var(--lilac)' },
];

export const HINTS = {
    play: 'Tap trains, people and buildings · drag to look around',
    'track:lay': 'Drag to draw track · tap the yellow arrows to switch points',
    'track:station': 'Tap or drag along straight track to add a platform',
    'track:erase': 'Drag over track to take it up',
    build: 'Tap to place · ⟳ turns it round',
    land: 'Drag to paint the ground',
    trains: 'Pick a train, then tap your track to put it on',
    bulldoze: 'Drag to clear things away',
};

export function initUI(appRef, actRef) {
    app = appRef; act = actRef;
    // title logo: bricks for every letter
    const brick = (row, text, cols) => {
        $(row).replaceChildren(...[...text].map((ch, i) => ch === ' ' ? h('span.gap') : h('span', { style: { '--c': cols[i % cols.length], '--i': i } }, ch)));
    };
    brick('logo-a', 'TOOTLE', ['#d8352a', '#f6c21c', '#1f6fd1', '#35a548', '#f57d1f', '#f27bb2']);
    brick('logo-b', 'ISLES', ['#18a8a2', '#9a77d6', '#d8352a', '#f6c21c', '#1f6fd1']);
    $('t-new').onclick = () => { act.ui(); openNewIsland(); };
    $('t-load').onclick = () => { act.ui(); openIslands(); };
    $('t-stickers').onclick = () => { act.ui(); openStickers(); };
    $('t-settings').onclick = () => { act.ui(); openSettings(); };
    $('t-continue').onclick = () => { act.ui(); act.continueLast(); };
    $('b-undo').onclick = () => act.undo();
    $('b-redo').onclick = () => act.redo();
    $('b-time').onclick = () => act.cycleTime();
    $('b-sound').onclick = () => act.toggleMute();
    $('b-menu').onclick = () => { act.ui(); openMenu(); };
    $('c-left').onclick = () => act.cam('left');
    $('c-right').onclick = () => act.cam('right');
    $('c-home').onclick = () => act.cam('home');
    $('c-in').onclick = () => act.cam('in');
    $('c-out').onclick = () => act.cam('out');
    $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal') && app.modalDismiss) closeModal(); });
    renderToolbar();
}

// ------------------------------------------------------------------ title / hud
export function showTitle(lastMeta) {
    $('title').classList.remove('hidden');
    $('hud').classList.add('hidden');
    const c = $('t-continue');
    if (lastMeta) { c.classList.remove('hidden'); $('t-continue-name').textContent = lastMeta.name; }
    else c.classList.add('hidden');
}
export function showPlay() {
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('island-name').textContent = app.world.name;
    const p = PRESETS.find((q) => q.id === app.world.preset);
    $('island-emoji').textContent = p ? p.emoji : '🏝️';
    renderToolbar();
    renderTray();
    setHint();
}

export function setTimeIcon(icon) { $('b-time').textContent = icon; }
export function setMuteIcon(m) { $('b-sound').textContent = m ? '🔇' : '🔊'; }
export function setUndoState(u, r) { $('b-undo').style.opacity = u ? 1 : 0.4; $('b-redo').style.opacity = r ? 1 : 0.4; }
export function updateStats(trains, people, rides) {
    $('stat-trains').textContent = `🚂 ${trains}`;
    $('stat-people').textContent = `🧍 ${people}`;
    $('stat-rides').textContent = `🎟️ ${rides}`;
}

let hintTimer = 0;
export function setHint(text) {
    const el = $('hint');
    const key = app.tool === 'track' ? `track:${app.trackMode}` : app.tool;
    el.textContent = text || HINTS[key] || '';
    el.classList.toggle('hidden', !el.textContent);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.add('hidden'), text ? 3000 : 6000);
}

// ------------------------------------------------------------------ toolbar + trays
export function renderToolbar() {
    $('toolbar').replaceChildren(...TOOLS.map((t, i) => h('button.tool' + (app.tool === t.id ? '.on' : ''), {
        style: { '--c': t.c }, 'data-tool': t.id, title: `${t.name} (${i + 1})`, 'aria-label': t.name,
        onclick: () => act.setTool(t.id),
    }, t.emoji, h('span', {}, t.name))));
    measureDock();
}

export function measureDock() {
    requestAnimationFrame(() => {
        const d = $('dock');
        if (!d) return;
        const hgt = d.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--dockH', `${Math.round(hgt)}px`);
        act.dockChanged(hgt);
    });
}

const opt = (label, on, onclick, extra = {}) => h('button.opt' + (on ? '.on' : ''), { onclick, ...extra }, ...[].concat(label));

export function renderTray() {
    const tray = $('tray');
    const rows = [];
    const t = app.tool;
    if (t === 'play' || t === 'bulldoze') { tray.classList.add('hidden'); measureDock(); return; }
    if (t === 'track') {
        rows.push(h('div.tray-row', {},
            opt('🛤️ Track', app.trackMode === 'lay', () => act.setTrackMode('lay'), { style: { '--c': 'var(--orange)' }, 'data-mode': 'lay' }),
            opt('🚉 Station', app.trackMode === 'station', () => act.setTrackMode('station'), { style: { '--c': 'var(--blue)' }, 'data-mode': 'station' }),
            opt('🧽 Take up', app.trackMode === 'erase', () => act.setTrackMode('erase'), { style: { '--c': 'var(--lilac)' }, 'data-mode': 'erase' }),
            h('div.sep'),
            h('span.tray-tip', {}, app.trackMode === 'lay' ? 'Drag across land, water (bridges!) or hills (tunnels!)' : app.trackMode === 'station' ? 'Platforms go on straight track' : 'Trains must not be on it'),
        ));
    }
    if (t === 'build') {
        rows.push(h('div.tray-row.tabs', {}, ...CATS.map((c) => h('button.tab' + (app.buildCat === c.id ? '.on' : ''), { onclick: () => act.setBuildCat(c.id), style: { '--c': 'var(--red)' }, 'data-cat': c.id }, `${c.emoji} ${c.name}`))));
        rows.push(h('div.tray-row', {},
            h('button.card.turn', { onclick: () => act.rotate(), title: 'Turn (R)', 'data-act': 'rotate', 'aria-label': 'Turn' }, h('div.em', { style: { transform: `rotate(${app.rot * 90}deg)` } }, '⟳'), 'Turn'),
            ...ITEMS.filter((it) => it.cat === app.buildCat).map((it) => itemCard(it))));
    }
    if (t === 'land') {
        const paints = [
            [T.GRASS, '🌱 Grass', '#6cc04a'], [T.MEADOW, '🌼 Meadow', '#8ed85e'], [T.SAND, '🏖️ Sand', '#f0d898'], [T.PATH, '🧱 Path', '#cfc8bc'],
            [T.SNOW, '❄️ Snow', '#eef4fa'], [T.ROCK, '⛰️ Hill', '#8d9399'], [T.WATER, '🌊 Water', '#2fa9dd'],
        ];
        rows.push(h('div.tray-row', {}, ...paints.map(([id, label, col]) => opt([h('span.sw', { style: { background: col } }), label], app.landPaint === id, () => act.setLandPaint(id), { style: { '--c': 'var(--teal)' }, 'data-paint': id })),
            h('div.sep'),
            ...[1, 2, 3].map((b) => opt(['●', '⬤', '⬛'][b - 1] + ' ' + ['Small', 'Medium', 'Big'][b - 1], app.brush === b, () => act.setBrush(b), { style: { '--c': 'var(--teal)' }, 'data-brush': b })),
        ));
    }
    if (t === 'trains') {
        const cards = app.shed.map((d) => {
            const on = app.trainSet === d.id;
            return h('button.card.wide' + (on ? '.on' : ''), { onclick: () => act.pickSet(d.id), 'data-set': d.id, title: d.name },
                d.thumb ? h('img', { src: d.thumb, alt: '' }) : h('div.em', {}, ENGINES[d.engine].emoji),
                h('span', {}, d.name));
        });
        rows.push(h('div.tray-row', {},
            h('button.card.add', { onclick: () => act.openWorkshop(null), 'data-act': 'newtrain' }, h('b', {}, '＋'), 'New train'),
            ...cards));
        const sel = app.shed.find((d) => d.id === app.trainSet);
        rows.push(h('div.tray-row', {},
            sel ? opt('✏️ Edit', false, () => act.openWorkshop(sel.id), { 'data-act': 'edit' }) : null,
            sel ? opt('🗑️ Remove from shed', false, () => confirmBox(`Take "${sel.name}" out of the shed? Trains already running stay on the track.`, 'Remove', () => act.deleteSet(sel.id)), { 'data-act': 'delset' }) : null,
            h('span.tray-tip', {}, sel ? `${sel.name}: tap your track to put it on` : 'Pick a train set, then tap your track'),
        ));
    }
    tray.replaceChildren(...rows);
    tray.classList.remove('hidden');
    // keep the chosen card in view
    const on = tray.querySelector('.card.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measureDock();
}

function itemCard(it) {
    const on = app.buildItem === it.id;
    const img = act.itemThumb(it.id);
    return h('button.card' + (on ? '.on' : ''), { onclick: () => act.pickItem(it.id), 'data-item': it.id, title: it.name },
        img ? h('img', { src: img, alt: '' }) : h('div.em', {}, it.emoji), h('span', {}, it.name));
}

// ------------------------------------------------------------------ train card
export function renderTrainCard(t) {
    const el = $('traincard');
    if (!t) { el.classList.add('hidden'); return; }
    const d = t.design;
    const speeds = [['🐢', 'Slow'], ['🐇', 'Medium'], ['🚀', 'Fast']];
    el.replaceChildren(
        h('h3', {}, ENGINES[d.engine].emoji, h('span', {}, d.name), h('button.x', { onclick: () => act.select(0), 'aria-label': 'Close' }, '✕')),
        h('div.info', {}, h('span#tc-riders', {}, `🧍 ${t.riders}/${t.cap}`), h('span#tc-state', {}, stateText(t))),
        h('div.grid', {},
            opt([t.running ? '⏸️' : '▶️', h('small', {}, t.running ? 'Stop' : 'Go')], false, () => act.trainCmd('go'), { 'data-cmd': 'go' }),
            opt(['📯', h('small', {}, 'Toot!')], false, () => act.trainCmd('toot'), { 'data-cmd': 'toot' }),
            opt(['🔄', h('small', {}, 'Turn round')], false, () => act.trainCmd('reverse'), { 'data-cmd': 'reverse' }),
            ...speeds.map(([e, n], i) => opt([e, h('small', {}, n)], t.level === i, () => act.trainCmd('speed', i), { style: { '--c': 'var(--green)' }, 'data-cmd': 'speed' + i })),
            opt(['🚉', h('small', {}, t.stopStations ? 'Stops: on' : 'Stops: off')], t.stopStations, () => act.trainCmd('stations'), { style: { '--c': 'var(--blue)' }, 'data-cmd': 'stations' }),
            opt(['🎥', h('small', {}, app.follow === t.id ? 'Riding!' : 'Ride along')], app.follow === t.id, () => act.trainCmd('ride'), { style: { '--c': 'var(--orange)' }, 'data-cmd': 'ride' }),
            opt(['🏠', h('small', {}, 'To the shed')], false, () => act.trainCmd('remove'), { 'data-cmd': 'remove' }),
        ),
    );
    el.classList.remove('hidden');
}
function stateText(t) {
    if (t.state === 'dwell') return '🚉 At the station';
    if (t.state === 'turn') return '↩️ Turning round';
    if (!t.running) return '⏸️ Stopped';
    if (t.v < 0.05 && t.waitT > 0) return '🚦 Waiting';
    return '💨 Running';
}
export function updateTrainCard(t) {
    if (!t) return;
    const r = $('tc-riders'), s = $('tc-state');
    if (r) r.textContent = `🧍 ${t.riders}/${t.cap}`;
    if (s) s.textContent = stateText(t);
}

// ------------------------------------------------------------------ toasts + bubbles
export function toast(text, emoji = '', cls = '', sub = '') {
    const el = h('div.toast' + (cls ? '.' + cls : ''), {}, emoji ? h('span.big', {}, emoji) : null, h('div', {}, text, sub ? h('small', {}, sub) : null));
    $('toasts').append(el);
    while ($('toasts').children.length > 2) $('toasts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, cls === 'sticker' ? 3600 : 2400);
}

const bubbles = [];
export function bubble(text, wx, wy, wz, ms = 2400) {
    const el = h('div.bubble', {}, text);
    $('bubbles').append(el);
    const b = { el, wx, wy, wz, until: performance.now() + ms };
    bubbles.push(b);
    return b;
}
export function updateBubbles(toScreen, now) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.track) { const p = b.track(); if (p) { b.wx = p[0]; b.wy = p[1]; b.wz = p[2]; } }
        const s = toScreen(b.wx, b.wy, b.wz);
        if (now > b.until || !s) { b.el.remove(); bubbles.splice(i, 1); continue; }
        b.el.style.left = `${s.x}px`; b.el.style.top = `${s.y}px`;
    }
}
export function clearBubbles() { for (const b of bubbles) b.el.remove(); bubbles.length = 0; }

// ------------------------------------------------------------------ modals
export function openModal(title, color, body, foot = [], dismiss = true) {
    app.modalDismiss = dismiss;
    const panel = $('modal-panel');
    panel.replaceChildren(
        h('div.panel-head', { style: { '--c': color } }, h('h2', {}, title), dismiss ? h('button.x', { onclick: () => { act.ui(); closeModal(); }, 'aria-label': 'Close' }, '✕') : null),
        h('div.panel-body', {}, ...[].concat(body)),
        foot.length ? h('div.panel-foot', {}, ...foot) : null,
    );
    $('modal').classList.remove('hidden');
    app.modal = true;
}
export function closeModal() {
    $('modal').classList.add('hidden');
    app.modal = false;
    if (app.onModalClose) { const f = app.onModalClose; app.onModalClose = null; f(); }
}

export function confirmBox(text, yes, onYes, color = 'var(--red)') {
    openModal('Are you sure?', color, [h('p', {}, text)], [
        h('button.brick.b-white', { onclick: () => { act.ui(); closeModal(); } }, 'No, keep it'),
        h('button.brick.b-red', { onclick: () => { act.ui(); closeModal(); onYes(); }, 'data-act': 'confirm' }, yes),
    ]);
}

/** Draw an island's tiles into a small canvas (for the island picker). */
function islandMap(world, size = 150) {
    const c = h('canvas', { width: size, height: size });
    const g = c.getContext('2d');
    const cols = { [T.WATER]: '#3fa2df', [T.SAND]: '#f0d898', [T.GRASS]: '#6cc04a', [T.PATH]: '#cfc8bc', [T.MEADOW]: '#8ed85e', [T.SNOW]: '#f4f8fc', [T.ROCK]: '#8d9399' };
    const grassBy = { spring: '#88d46a', autumn: '#b8be4e', tropical: '#7fd052', pine: '#5aa846' };
    const s = size / N;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const t = world.tiles[z * N + x];
        g.fillStyle = t === T.GRASS && grassBy[world.season] ? grassBy[world.season] : cols[t];
        g.fillRect(x * s, z * s, s + 0.5, s + 0.5);
    }
    for (const o of world.objs.values()) {
        const it = ITEM[o.type];
        g.fillStyle = it.cat === 'nature' ? 'rgba(20,90,40,0.55)' : it.cat === 'water' ? 'rgba(255,255,255,0.7)' : '#d8352a';
        g.fillRect(o.x * s + s * 0.2, o.z * s + s * 0.2, s * 0.6, s * 0.6);
    }
    g.fillStyle = '#5b4a3a';
    for (let i = 0; i < N * N; i++) if (world.track[i]) g.fillRect((i % N) * s + s * 0.25, ((i / N) | 0) * s + s * 0.25, s * 0.5, s * 0.5);
    return c;
}

export function openNewIsland() {
    let pick = 'sunny', starter = true;
    const seeds = Object.fromEntries(PRESETS.map((p) => [p.id, Math.floor(Math.random() * 1e9)]));
    const name = h('input', { type: 'text', value: 'Sunny Cove', maxlength: 28, 'aria-label': 'Island name', id: 'ni-name' });
    let nameTouched = false;
    name.addEventListener('input', () => { nameTouched = true; });
    const grid = h('div.isle-grid');
    const draw = () => {
        grid.replaceChildren(...PRESETS.map((p) => {
            const w = generateIsland({ preset: p.id, seed: seeds[p.id], starter });
            return h('button.isle' + (pick === p.id ? '.on' : ''), {
                'data-preset': p.id,
                onclick: () => { act.ui(); pick = p.id; if (!nameTouched) name.value = p.name; draw(); },
            }, islandMap(w), h('b', {}, `${p.emoji} ${p.name}`), h('small', {}, p.desc));
        }));
    };
    const tog = h('input', { type: 'checkbox', checked: true, id: 'ni-starter' });
    tog.addEventListener('change', () => { starter = tog.checked; draw(); });
    draw();
    openModal('Choose your island', 'var(--teal)', [
        grid,
        h('div.field', {}, h('span', { style: { fontWeight: 600 } }, 'Name:'), name, h('button.opt', { onclick: () => { act.ui(); seeds[pick] = Math.floor(Math.random() * 1e9); draw(); }, title: 'A different shape' }, '🎲 New shape')),
        h('label.toggle', {}, tog, 'Start with a little town, a loop of track and a train'),
    ], [
        h('button.brick.b-green.big', { 'data-act': 'create', onclick: () => { act.ui(); closeModal(); act.createIsland({ preset: pick, seed: seeds[pick], name: name.value.trim() || PRESETS.find((p) => p.id === pick).name, starter }); } }, '🏝️ Let\'s go!'),
    ]);
}

export function openIslands() {
    const list = act.listWorlds();
    const fmt = (t) => { try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
    const rows = list.map((w) => {
        const p = PRESETS.find((q) => q.id === w.preset);
        const c = w.counts || {};
        return h('div.save', { 'data-world': w.id },
            w.thumb ? h('img', { src: w.thumb, alt: '' }) : h('div.noimg', {}, p ? p.emoji : '🏝️'),
            h('div.meta', {}, h('b', {}, w.name), h('small', {}, `${p ? p.emoji + ' ' + p.name : ''} · ${fmt(w.updated)}`), h('small', { style: { display: 'block' } }, `🛤️ ${c.track || 0}  🚂 ${c.trains || 0}  🏠 ${c.homes || 0}  🌳 ${c.trees || 0}`)),
            h('div.acts', {},
                h('button.opt', { style: { '--c': 'var(--green)' }, class: 'opt on', 'data-act': 'play', onclick: () => { act.ui(); closeModal(); act.loadWorld(w.id); } }, '▶ Play'),
                h('button.opt', { onclick: () => promptBox('Rename island', w.name, (v) => { act.renameWorld(w.id, v); openIslands(); }) }, '✏️ Rename'),
                h('button.opt', { onclick: () => { act.ui(); act.duplicateWorld(w.id); openIslands(); } }, '📄 Copy'),
                h('button.opt', { onclick: async () => { act.ui(); const code = await act.shareWorld(w.id); openShare(code); } }, '🔗 Share'),
                h('button.opt', { onclick: () => confirmBox(`Delete "${w.name}" for ever?`, '🗑️ Delete', () => { act.deleteWorld(w.id); openIslands(); }) }, '🗑️'),
            ));
    });
    const code = h('input', { type: 'text', placeholder: 'Paste an island code here', 'aria-label': 'Island code' });
    openModal('My Islands', 'var(--blue)', [
        rows.length ? h('div.saves', {}, ...rows) : h('p', {}, 'No islands yet. Make your first one!'),
        h('h4', {}, 'Got an island code from a friend?'),
        h('div.field', {}, code, h('button.opt', { onclick: async () => { act.ui(); const ok = await act.importWorld(code.value); if (ok) closeModal(); else toast('That code didn\'t work', '🤔'); } }, '📥 Open')),
    ], [h('button.brick.b-yellow', { onclick: () => { act.ui(); openNewIsland(); } }, '🏝️ New Island')]);
}

function openShare(code) {
    const ta = h('textarea', { readonly: true, style: { width: '100%', height: '110px', borderRadius: '12px', border: '3px solid #e7dcc6', padding: '8px', fontSize: '12px', userSelect: 'text', WebkitUserSelect: 'text' } });
    ta.value = code;
    openModal('Share your island', 'var(--teal)', [
        h('p', {}, 'Copy this code and send it to a friend. They can open it from My Islands.'),
        ta,
    ], [
        h('button.brick.b-teal', { onclick: () => { ta.select(); try { navigator.clipboard.writeText(code).then(() => toast('Copied!', '📋'), () => toast('Select the text and copy it', '📋')); } catch { toast('Select the text and copy it', '📋'); } } }, '📋 Copy'),
        h('button.brick.b-white', { onclick: () => { act.ui(); openIslands(); } }, 'Back'),
    ]);
}

export function promptBox(title, value, ok) {
    const inp = h('input', { type: 'text', value, maxlength: 28 });
    openModal(title, 'var(--orange)', [h('div.field', {}, inp)], [
        h('button.brick.b-white', { onclick: () => { act.ui(); closeModal(); } }, 'Cancel'),
        h('button.brick.b-green', { 'data-act': 'ok', onclick: () => { act.ui(); const v = inp.value.trim(); closeModal(); if (v) ok(v.slice(0, 28)); } }, 'OK'),
    ]);
    setTimeout(() => inp.focus(), 50);
}

export function openStickers() {
    const got = app.profile.stickers || {};
    const n = STICKERS.filter((s) => got[s.id]).length;
    openModal(`Sticker Book · ${n}/${STICKERS.length}`, 'var(--pink)', [
        h('p', {}, 'Stickers are little celebrations of things you\'ve done. Nothing is locked: just play!'),
        h('div.stickers', {}, ...STICKERS.map((s) => h('div.stk' + (got[s.id] ? '.got' : ''), {}, h('div.e', {}, s.emoji), h('b', {}, s.name), h('small', {}, s.desc)))),
    ]);
}

export function openSettings() {
    const s = app.settings;
    const slider = (label, key) => {
        const out = h('span', {}, Math.round(s[key] * 100));
        const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], 'aria-label': label });
        inp.addEventListener('input', () => { s[key] = Number(inp.value); out.textContent = Math.round(s[key] * 100); act.applySettings(); });
        return h('div.slider', {}, h('span', {}, label), inp, out);
    };
    const q = (v, label) => h('button.opt' + (String(s.quality) === String(v) ? '.on' : ''), { style: { '--c': 'var(--blue)' }, onclick: () => { s.quality = v; act.applySettings(); openSettings(); } }, label);
    const cyc = h('input', { type: 'checkbox', checked: s.cycle });
    cyc.addEventListener('change', () => { s.cycle = cyc.checked; act.applySettings(); });
    openModal('Settings', 'var(--ink2)', [
        h('h4', {}, 'Sound'),
        slider('🎵 Music', 'music'),
        slider('🔔 Sounds', 'sfx'),
        h('h4', {}, 'Graphics'),
        h('div.field', {}, q('auto', '✨ Auto'), q(0, 'High'), q(1, 'Medium'), q(2, 'Low')),
        h('label.toggle', {}, cyc, '🌗 Day and night go round by themselves'),
        h('h4', {}, 'Everything'),
        h('div.field', {}, h('button.opt', { onclick: () => { act.ui(); openHelp(); } }, '❓ How to play'),
            h('button.opt', { onclick: () => confirmBox('Delete every island, train set and sticker? This cannot be undone.', 'Delete everything', () => act.wipe()) }, '🧹 Start fresh')),
    ]);
}

export function openMenu() {
    openModal(app.world ? app.world.name : 'Menu', 'var(--green)', [
        h('div.field', { style: { flexDirection: 'column', alignItems: 'stretch' } },
            h('button.brick.b-green', { 'data-act': 'resume', onclick: () => { act.ui(); closeModal(); } }, '▶ Back to my island'),
            h('button.brick.b-yellow', { 'data-act': 'save', onclick: () => { act.ui(); act.saveNow(true); closeModal(); } }, '💾 Save now'),
            h('button.brick.b-lilac', { 'data-act': 'photo', onclick: () => { closeModal(); setTimeout(() => act.photo(), 60); } }, '📷 Take a photo'),
            h('button.brick.b-orange', { onclick: () => promptBox('Rename island', app.world.name, (v) => act.renameCurrent(v)) }, '✏️ Rename island'),
            h('button.brick.b-blue', { onclick: () => { act.ui(); act.saveNow(true); openIslands(); } }, '📂 My Islands'),
            h('button.brick.b-pink', { onclick: () => { act.ui(); openStickers(); } }, '⭐ Stickers'),
            h('button.brick.b-teal', { onclick: () => { act.ui(); openHelp(); } }, '❓ How to play'),
            h('button.brick.b-white', { onclick: () => { act.ui(); openSettings(); } }, '⚙️ Settings'),
            h('button.brick.b-grey', { 'data-act': 'title', onclick: () => { act.ui(); closeModal(); act.toTitle(); } }, '🏁 Save and go to the title'),
        ),
    ]);
}

export function openHelp() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    openModal('How to play', 'var(--teal)', [
        h('div.help', {},
            h('div.step', {}, h('b', {}, '🛤️'), h('span', {}, 'Tap Track, then drag across the island to lay railway. Join it up into a loop! Track over water makes a bridge, and track through a hill makes a tunnel.')),
            h('div.step', {}, h('b', {}, '🚂'), h('span', {}, 'Tap Trains, pick a train set, then tap your track. Make your own trains with ＋ New train.')),
            h('div.step', {}, h('b', {}, '🚉'), h('span', {}, 'Put a Station on straight track. People walk to the platform and hop on.')),
            h('div.step', {}, h('b', {}, '🏠'), h('span', {}, 'Tap Build to add homes, shops, farms, fun fair rides, trees and boats. Every home brings new people to your island.')),
            h('div.step', {}, h('b', {}, '👆'), h('span', {}, 'In Play, tap anything: trains, people, sheep, windmills, the whale... Tap the yellow arrows to switch the points.')),
            h('div.step', {}, h('b', {}, '💾'), h('span', {}, 'Your island saves by itself. Make as many islands as you like from the menu.')),
        ),
        h('p.keys', {}, touch
            ? 'Move around with two fingers: slide to move, pinch to zoom, twist to turn. In Play, one finger moves too.'
            : h('span', { html: '<kbd>Right-drag</kbd> turn · <kbd>Wheel</kbd> zoom · <kbd>WASD</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> turn · <kbd>1</kbd>–<kbd>6</kbd> tools · <kbd>R</kbd> rotate · <kbd>T</kbd> time of day · <kbd>Space</kbd> toot · <kbd>Ctrl+Z</kbd> undo' })),
    ], [h('button.brick.b-green', { 'data-act': 'helpok', onclick: () => { act.ui(); closeModal(); } }, 'Off we go! 🚂')]);
}

// ------------------------------------------------------------------ the train workshop
export function openWorkshop(design, mini, isNew) {
    const d = JSON.parse(JSON.stringify(design));
    let sel = -1;   // −1 = engine, otherwise car index
    const nameIn = h('input', { type: 'text', value: d.name, maxlength: 24, 'aria-label': 'Train name', id: 'ws-name' });
    nameIn.addEventListener('input', () => { d.name = nameIn.value; });
    const preview = h('div.preview', {}, h('div.len', { id: 'ws-len' }));
    const engines = h('div.engines');
    const consist = h('div.consist');
    const swatchBox = h('div.swatches');
    const trimBox = h('div.swatches');
    const trimWrap = h('div.col', {}, h('h4', {}, 'Trim colour'), trimBox);
    const faceWrap = h('label.toggle');
    const addcars = h('div.addcars');
    const colTitle = h('h4');

    const refresh = () => {
        mini.show(d);
        $('ws-len') && ($('ws-len').textContent = `📏 ${trainLength(d).toFixed(1)} tiles · 🧍 ${capacity(d)} seats`);
        engines.replaceChildren(...Object.entries(ENGINES).map(([id, e]) => h('button.opt' + (d.engine === id ? '.on' : ''), { style: { '--c': 'var(--blue)' }, 'data-engine': id, onclick: () => { act.ui(); d.engine = id; if (!(id === 'steam' || id === 'tank')) d.face = false; sel = -1; refresh(); } }, h('b', {}, e.emoji), e.name)));
        consist.replaceChildren(
            h('button.veh' + (sel === -1 ? '.on' : ''), { onclick: () => { act.ui(); sel = -1; refresh(); } }, h('span.dot', { style: { background: PALETTE_CSS[d.body] } }), ENGINES[d.engine].emoji, ' Engine'),
            ...d.cars.map((c, i) => h('span.veh' + (sel === i ? '.on' : ''), { onclick: () => { act.ui(); sel = i; refresh(); }, 'data-car': i },
                h('span.dot', { style: { background: PALETTE_CSS[c.color] } }), CARS[c.type].emoji, ' ', CARS[c.type].name,
                h('button.rm', { 'aria-label': 'Remove car', onclick: (e) => { e.stopPropagation(); act.ui(); d.cars.splice(i, 1); sel = Math.min(sel, d.cars.length - 1); refresh(); } }, '✕'))),
        );
        const cur = sel === -1 ? d.body : d.cars[sel].color;
        colTitle.textContent = sel === -1 ? 'Engine colour' : `${CARS[d.cars[sel].type].name} colour`;
        swatchBox.replaceChildren(...PALETTE.map((p, i) => h('button.swatch' + (cur === i ? '.on' : ''), { title: p.name, 'aria-label': p.name, style: { background: PALETTE_CSS[i] }, onclick: () => { if (sel === -1) d.body = i; else d.cars[sel].color = i; act.ui(); refresh(); } })));
        trimWrap.classList.toggle('hidden', sel !== -1);
        trimBox.replaceChildren(...PALETTE.map((p, i) => h('button.swatch' + (d.trim === i ? '.on' : ''), { title: p.name, 'aria-label': p.name, style: { background: PALETTE_CSS[i] }, onclick: () => { d.trim = i; act.ui(); refresh(); } })));
        const canFace = d.engine === 'steam' || d.engine === 'tank';
        const cb = h('input', { type: 'checkbox', checked: d.face });
        cb.addEventListener('change', () => { d.face = cb.checked; act.ui(); refresh(); });
        faceWrap.replaceChildren(cb, '😊 Friendly face');
        faceWrap.classList.toggle('hidden', !canFace || sel !== -1);
        addcars.replaceChildren(...Object.entries(CARS).map(([id, c]) => h('button.opt', { 'data-addcar': id, disabled: d.cars.length >= MAX_CARS, style: { opacity: d.cars.length >= MAX_CARS ? 0.5 : 1 }, onclick: () => { if (d.cars.length >= MAX_CARS) return; act.ui(); d.cars.push({ type: id, color: sel >= 0 ? d.cars[sel].color : (d.cars.length ? d.cars[d.cars.length - 1].color : d.body) }); sel = d.cars.length - 1; refresh(); } }, `${c.emoji} ${c.name}`)));
    };

    app.onModalClose = () => mini.detach();
    openModal(isNew ? 'Train Workshop · new train' : 'Train Workshop', 'var(--blue)', [
        h('div.shop', {},
            preview,
            h('div.col', {}, h('h4', {}, 'Name'), h('div.field', {}, nameIn, h('button.opt', { title: 'Another name', onclick: () => { act.ui(); d.name = trainName(Math.random); nameIn.value = d.name; } }, '🎲')),
                h('h4', {}, 'Engine'), engines),
            h('div.col', {}, h('h4', {}, `Your train (up to ${MAX_CARS} cars) · tap one to colour it`), consist, colTitle, swatchBox, trimWrap, faceWrap),
            h('div.col', { style: { gridColumn: '1 / -1' } }, h('h4', {}, 'Add a car'), addcars),
        ),
    ], [
        isNew ? null : h('button.brick.b-white', { onclick: () => { act.ui(); act.saveDesign({ ...d, id: '' }); closeModal(); } }, '📄 Save as new'),
        h('button.brick.b-green', { 'data-act': 'savetrain', onclick: () => { act.ui(); act.saveDesign(d); closeModal(); } }, isNew ? '🚂 Add to my shed' : '💾 Save'),
    ].filter(Boolean));
    mini.attach(preview, d);
    refresh();
}
