/**
 * main.js — Tootle Isles entry point.
 *
 * The simulation (js/sim) owns the island, its track, trains and people, and knows nothing of the
 * screen. This file runs it on a fixed step, turns pointer and keyboard input into tool actions,
 * feeds the 3D view (js/view) and the DOM UI (js/ui.js), plays sounds for the simulation's events,
 * hands out stickers, keeps the undo stack and saves islands. Debug hooks live behind ?debug=1.
 *
 * Library: three.js r165 via the import map in index.html.
 */

import { initStage, updateCamera, render, setQuality, getQuality, applyTime, rig, tod, resize, orbitBy, zoomBy, panBy, snapCamera, groundAt, toScreen, renderer, scene, camera } from './view/stage.js';
import { Ground } from './view/ground.js';
import { TrackView } from './view/trackview.js';
import { ObjectView, objCentre } from './view/objects.js';
import { TrainView, RAIL_Y } from './view/trainview.js';
import { PeopleView } from './view/peopleview.js';
import { FX } from './view/fx.js';
import { Ambient } from './view/ambient.js';
import { Mini } from './view/mini.js';
import { N, T, LAND_H, MAX_TRAINS } from './config.js';
import { World } from './sim/world.js';
import { generateIsland, PRESET } from './sim/islands.js';
import { ITEM, ITEMS, footprint } from './sim/catalog.js';
import { DEFAULT_SETS, ENGINES, cleanDesign, trainName } from './sim/trainsets.js';
import { STICKERS } from './sim/stickers.js';
import { idx, inb, tileLine } from './sim/grid.js';
import { initInput } from './input.js';
import * as ui from './ui.js';
import { initAudio, sfx, setVolumes, setMuted, setNight } from './audio.js';
import * as save from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Number(params.get('fast')) || 1);

// ------------------------------------------------------------------ settings + stage
const settings = save.loadSettings();
const coarse = window.matchMedia('(pointer: coarse)').matches;
const chooseQuality = () => (settings.quality === 'auto' ? (coarse ? 1 : 0) : Number(settings.quality));
let quality = params.has('q') ? Number(params.get('q')) : chooseQuality();
const canvas = document.getElementById('gl');
initStage(canvas, quality);
const ground = new Ground(scene);
const trackView = new TrackView(scene);
const objView = new ObjectView(scene);
const fx = new FX(scene);
const trainView = new TrainView(scene, fx);
const peopleView = new PeopleView(scene);
const ambient = new Ambient(scene);
let mini = null;
const getMini = () => mini || (mini = new Mini());

// ------------------------------------------------------------------ app state
const app = {
    mode: 'title', world: null, worldId: '', tool: 'play', trackMode: 'lay',
    buildCat: 'homes', buildItem: 'house_red', rot: 0, landPaint: T.GRASS, brush: 1, trainSet: '',
    selected: 0, follow: 0, undo: [], redo: [], dirty: false, saveT: 0, modal: false,
    shed: save.loadShed(), profile: save.loadProfile(), settings, frameNo: 0, dockH: 0,
};
if (!app.shed.length) app.shed = DEFAULT_SETS.map((d) => ({ ...d, thumb: '' }));
app.trainSet = app.shed[0]?.id || '';

const TIMES = [[0.3, '🌅', 'Morning'], [0.45, '☀️', 'Midday'], [0.735, '🌇', 'Sunset'], [0.93, '🌙', 'Night'], [-1, '🔄', 'Day and night go round']];

// ------------------------------------------------------------------ worlds
function centreCamera(world, snap = true) {
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < N * N; i++) if (world.tiles[i] !== T.WATER) { sx += i % N; sz += (i / N) | 0; n++; }
    rig.gx = n ? sx / n - N / 2 + 0.5 : 0;
    rig.gz = n ? sz / n - N / 2 + 0.5 + 2 : 0;
    rig.gdist = coarse ? 30 : 28; rig.gpitch = 0.85; rig.gyaw = 0.55;
    if (snap) snapCamera();
}

function setWorld(world, id) {
    app.world = world;
    app.worldId = id;
    app.undo = []; app.redo = [];
    app.selected = 0; app.follow = 0; rig.follow = null;
    trainView.selected = 0;
    ui.clearBubbles();
    ui.setUndoState(false, false);
}

function titleWorld() {
    const w = generateIsland({ preset: 'sunny', seed: 4242, starter: true, name: 'Title' });
    for (let i = 0; i < N * N && w.trains.list.length < 3; i += 37) if (w.track[i]) w.trains.place(DEFAULT_SETS[w.trains.list.length === 1 ? 4 : 3], i % N, (i / N) | 0);
    for (let k = 0; k < 400; k++) w.step(1 / 10);
    return w;
}

function toTitle() {
    if (app.world && app.mode === 'play') saveNow(true);
    app.mode = 'title';
    app.tool = 'play';
    setWorld(titleWorld(), '');
    centreCamera(app.world);
    rig.gdist = 34; rig.gpitch = 0.62; rig.auto = 0.05; rig.insetBottom = 0;
    snapCamera();
    ui.renderTrainCard(null);
    const last = save.listWorlds().find((w) => w.id === app.profile.last);
    ui.showTitle(last);
}

function enterPlay(world, id) {
    setWorld(world, id);
    app.mode = 'play';
    rig.auto = 0;
    centreCamera(world);
    ui.showPlay();
    ui.setTimeIcon(currentTimeIcon());
    app.profile.last = id;
    save.saveProfile(app.profile);
    if (!settings.help) { settings.help = true; save.saveSettings(settings); setTimeout(() => ui.openHelp(), 400); }
    checkStickers(null);
}

const act = {
    ui: () => { initAudio(); sfx.ui(); },
    dockChanged: (hgt) => { app.dockH = hgt; rig.insetBottom = app.mode === 'play' ? Math.min(hgt, window.innerHeight * 0.4) : 0; },
    itemThumb: (id) => { try { return getMini().itemThumb(id); } catch { return ''; } },
    listWorlds: () => save.listWorlds(),
    continueLast() {
        const id = app.profile.last;
        if (id) act.loadWorld(id);
    },
    createIsland(o) {
        initAudio();
        const w = generateIsland({ ...o, created: Date.now() });
        const id = save.newId();
        app.profile.islands = (app.profile.islands || 0) + 1;
        enterPlay(w, id);
        saveNow(true);
        ui.toast(`Welcome to ${w.name}!`, PRESET[w.preset]?.emoji || '🏝️');
        sfx.sticker();
    },
    loadWorld(id) {
        initAudio();
        const data = save.loadWorldData(id);
        const w = data && World.deserialize(data);
        if (!w) { ui.toast('That island could not be opened', '😟'); return; }
        enterPlay(w, id);
        ui.toast(`Back on ${w.name}`, PRESET[w.preset]?.emoji || '🏝️');
    },
    renameWorld(id, name) {
        save.renameWorld(id, name);
        if (app.worldId === id && app.world) { app.world.name = name; ui.$('island-name').textContent = name; }
    },
    renameCurrent(name) { app.world.name = name; ui.$('island-name').textContent = name; saveNow(true); },
    duplicateWorld(id) { if (app.worldId === id) saveNow(true); save.duplicateWorld(id); ui.toast('Island copied', '📄'); },
    deleteWorld(id) {
        save.deleteWorld(id);
        if (app.profile.last === id) { app.profile.last = ''; save.saveProfile(app.profile); }
        if (app.worldId === id && app.mode === 'play') { app.worldId = ''; toTitle(); }
    },
    async shareWorld(id) {
        if (app.worldId === id) saveNow(false);
        return save.exportCode(save.loadWorldData(id));
    },
    async importWorld(code) {
        const data = await save.importCode(code);
        const w = data && World.deserialize(data);
        if (!w) return false;
        const id = save.newId();
        w.name = (w.name || 'Island').slice(0, 26) + ' ✉';
        enterPlay(w, id);
        saveNow(true);
        ui.toast(`Opened ${w.name}`, '📥');
        return true;
    },
    saveNow: (thumb) => { saveNow(thumb); ui.toast('Saved!', '💾'); },
    photo() {
        try {
            render();   // read back in the same task as the render (no preserveDrawingBuffer)
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(app.world?.name || 'island').replace(/[^\w -]+/g, '').trim() || 'island'}.png`;
            document.body.append(a); a.click(); a.remove();
            sfx.click();
            ui.toast('Snap! Photo saved', '📷');
        } catch { ui.toast('Photos don\'t work in this browser', '📷'); }
    },
    toTitle: () => toTitle(),
    wipe() { save.wipeAll(); location.reload(); },
    applySettings() {
        setVolumes(settings.music, settings.sfx);
        setMuted(settings.muted);
        const q = params.has('q') ? Number(params.get('q')) : chooseQuality();
        if (q !== getQuality()) setQuality(q);
        tod.cycle = settings.cycle;
        save.saveSettings(settings);
        ui.setTimeIcon(currentTimeIcon());
    },
    toggleMute() { initAudio(); settings.muted = !settings.muted; act.applySettings(); ui.setMuteIcon(settings.muted); if (!settings.muted) sfx.pop(); },
    cycleTime() {
        initAudio();
        let k = TIMES.findIndex((t) => (settings.cycle ? t[0] < 0 : Math.abs(t[0] - tod.t) < 0.02));
        k = (k + 1) % TIMES.length;
        const [t, icon, name] = TIMES[k];
        settings.cycle = t < 0;
        tod.cycle = settings.cycle;
        if (t >= 0) { tod.target = t; settings.tod = t; }
        save.saveSettings(settings);
        ui.setTimeIcon(icon);
        ui.toast(name, icon);
        sfx.tab();
        if (t === 0.93) checkStickers({ type: 'night' });
    },
    cam(what) {
        if (what === 'left') orbitBy(-Math.PI / 4, 0);
        if (what === 'right') orbitBy(Math.PI / 4, 0);
        if (what === 'in') zoomBy(0.8);
        if (what === 'out') zoomBy(1.25);
        if (what === 'home') { stopFollow(); centreCamera(app.world, false); }
        sfx.tab();
    },
    setTool(t) {
        initAudio();
        if (app.tool === t) t = 'play';
        app.tool = t;
        objView.hideGhost();
        ui.renderToolbar(); ui.renderTray(); ui.setHint();
        sfx.tab();
    },
    setTrackMode(m) { app.trackMode = m; ui.renderTray(); ui.setHint(); sfx.tab(); },
    setBuildCat(c) {
        app.buildCat = c;
        const first = ITEMS.find((it) => it.cat === c);
        if (first && ITEM[app.buildItem]?.cat !== c) app.buildItem = first.id;
        ui.renderTray(); sfx.tab();
    },
    pickItem(id) { app.buildItem = id; ui.renderTray(); sfx.tab(); ui.setHint(`${ITEM[id].emoji} ${ITEM[id].name}: tap the island to place it`); },
    rotate() { app.rot = (app.rot + 1) & 3; sfx.tab(); if (lastHover) hover(lastHover); if (app.tool === 'build') ui.renderTray(); ui.setHint(['Facing you', 'Facing right', 'Facing away', 'Facing left'][app.rot] + ' ⟳'); },
    setLandPaint(t) { app.landPaint = t; ui.renderTray(); sfx.tab(); },
    setBrush(b) { app.brush = b; ui.renderTray(); sfx.tab(); },
    pickSet(id) { app.trainSet = id; ui.renderTray(); sfx.tab(); },
    openWorkshop(id) {
        initAudio();
        const base = id ? app.shed.find((d) => d.id === id) : { id: '', name: trainName(Math.random), engine: 'steam', body: Math.floor(Math.random() * 8), trim: 9, face: Math.random() < 0.4, cars: [{ type: 'coach', color: 1 }, { type: 'coach', color: 1 }] };
        ui.openWorkshop(base, getMini(), !id);
    },
    saveDesign(d) {
        const clean = cleanDesign({ ...d, id: d.id || 'set-' + Date.now().toString(36) });
        if (!clean) return;
        if (!d.id) clean.id = 'set-' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        clean.name = (d.name || '').trim() || trainName(Math.random);
        let thumb = '';
        try { thumb = getMini().trainThumb(clean); } catch { /* no webgl */ }
        const k = app.shed.findIndex((s) => s.id === clean.id);
        if (k >= 0) app.shed[k] = { ...clean, thumb }; else app.shed.unshift({ ...clean, thumb });
        save.saveShed(app.shed);
        app.trainSet = clean.id;
        app.profile.designs = (app.profile.designs || 0) + 1;
        if (app.tool !== 'trains') act.setTool('trains'); else ui.renderTray();
        ui.toast(`${clean.name} is in the shed!`, '🚂', '', 'Tap your track to put it on');
        sfx.trainPlaced();
        checkStickers({ type: 'designSaved' });
    },
    deleteSet(id) {
        app.shed = app.shed.filter((d) => d.id !== id);
        save.saveShed(app.shed);
        if (app.trainSet === id) app.trainSet = '';
        ui.renderTray();
    },
    select(id) {
        app.selected = id;
        trainView.selected = id;
        if (!id) stopFollow();
        ui.renderTrainCard(id ? app.world.trains.get(id) : null);
    },
    trainCmd(cmd, arg) {
        const W = app.world, t = W && W.trains.get(app.selected);
        if (!t) return;
        initAudio();
        if (cmd === 'go') { t.running = !t.running; sfx.tab(); }
        if (cmd === 'speed') { t.level = arg; t.running = true; sfx.tab(); }
        if (cmd === 'stations') { t.stopStations = !t.stopStations; sfx.tab(); }
        if (cmd === 'toot') toot(t);
        if (cmd === 'reverse') { if (t.state !== 'dwell') W.trains.reverse(t); else t.timer = 0; sfx.switch(); }
        if (cmd === 'ride') {
            if (app.follow === t.id) stopFollow();
            else { app.follow = t.id; checkStickers({ type: 'follow' }); ui.toast('All aboard! Drag the view or tap 🎥 again to hop off', '🎥'); }
        }
        if (cmd === 'remove') {
            W.trains.remove(t.id);
            act.select(0);
            ui.toast(`${t.design.name} went back to the shed`, '🏠');
            sfx.erase();
            app.dirty = true;
            return;
        }
        app.dirty = true;
        ui.renderTrainCard(t);
    },
    undo() {
        if (!app.undo.length || !app.world) return;
        initAudio();
        app.redo.push(JSON.stringify(app.world.snapshot()));
        restoreSnap(app.undo.pop());
        sfx.erase();
    },
    redo() {
        if (!app.redo.length || !app.world) return;
        initAudio();
        app.undo.push(JSON.stringify(app.world.snapshot()));
        restoreSnap(app.redo.pop());
        sfx.place();
    },
};

function restoreSnap(s) {
    const gone = app.world.restore(JSON.parse(s));
    for (const name of gone) ui.toast(`${name} went back to the shed`, '🏠');
    if (app.selected && !app.world.trains.get(app.selected)) act.select(0);
    app.dirty = true;
    ui.setUndoState(app.undo.length > 0, app.redo.length > 0);
}

function stopFollow() {
    if (!app.follow) return;
    app.follow = 0;
    rig.follow = null;
    rig.gpitch = 0.8; rig.gdist = 16;
    if (app.selected) ui.renderTrainCard(app.world.trains.get(app.selected));
}

function toot(t) {
    sfx.whistle(t.design.engine);
    trainView.whistle(t.id);
    app.world.stats.whistles++;
    checkStickers({ type: 'whistle' });
}

function currentTimeIcon() {
    if (settings.cycle) return '🔄';
    let best = TIMES[0], bd = 9;
    for (const t of TIMES) if (t[0] >= 0 && Math.abs(t[0] - tod.t) < bd) { bd = Math.abs(t[0] - tod.t); best = t; }
    return best[1];
}

// ------------------------------------------------------------------ saving
function thumbnail() {
    try {
        render();
        const c = document.createElement('canvas');
        c.width = 224; c.height = 144;
        const g = c.getContext('2d');
        const sw = canvas.width, sh = canvas.height;
        const aspect = c.width / c.height;
        let w = sw, hh = sw / aspect;
        if (hh > sh) { hh = sh; w = sh * aspect; }
        g.drawImage(canvas, (sw - w) / 2, (sh - hh) / 2, w, hh, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.72);
    } catch { return ''; }
}

function saveNow(withThumb) {
    if (!app.world || !app.worldId || app.mode !== 'play') return;
    const W = app.world;
    const prev = save.listWorlds().find((w) => w.id === app.worldId);
    const thumb = withThumb ? thumbnail() : prev?.thumb || '';
    const c = W.counts();
    save.saveWorld(app.worldId, W.serialize(), { name: W.name, preset: W.preset, season: W.season, created: W.created, thumb, counts: c });
    app.profile.last = app.worldId;
    save.saveProfile(app.profile);
    app.dirty = false;
    app.saveT = 0;
}

// ------------------------------------------------------------------ stickers
function checkStickers(ev) {
    const W = app.world;
    if (!W || app.mode !== 'play') return;
    const counts = W.counts();
    const has = (type) => { for (const o of W.objs.values()) if (o.type === type) return true; return false; };
    const c = { counts, world: W, profile: app.profile, ev, has };
    const got = app.profile.stickers || (app.profile.stickers = {});
    for (const s of STICKERS) {
        if (got[s.id]) continue;
        let ok = false;
        try { ok = s.check(c); } catch { ok = false; }
        if (ok) {
            got[s.id] = Date.now();
            save.saveProfile(app.profile);
            ui.toast(`Sticker: ${s.name}${s.name.endsWith('!') ? '' : '!'}`, s.emoji, 'sticker', s.desc);
            sfx.sticker();
            fx.confetti(rig.tx, LAND_H, rig.tz, 30);
        }
    }
}

// ------------------------------------------------------------------ tools
const tileAt = (p) => {
    const g = groundAt(p.x, p.y);
    if (!g) return null;
    const x = Math.floor(g.x + N / 2), z = Math.floor(g.z + N / 2);
    return { x, z, wx: g.x, wz: g.z };
};

let stroke = null;   // { kind, path, before, last, placed }
let lastHover = null;

function beginOp() { return JSON.stringify(app.world.snapshot()); }
function endOp(before) {
    const after = JSON.stringify(app.world.snapshot());
    if (after !== before) {
        app.undo.push(before);
        if (app.undo.length > 40) app.undo.shift();
        app.redo = [];
        app.dirty = true;
        ui.setUndoState(true, false);
        const gone = app.world.trains.validate();
        for (const name of gone) ui.toast(`${name} went back to the shed`, '🏠');
        checkStickers(null);
        return true;
    }
    return false;
}

/** Which end of an existing straight the pointer is nearer, for branching off it (or −1). */
function sideHint(x, z, w) {
    const W = app.world;
    if (!inb(x, z) || !w) return -1;
    const bits = W.track[idx(x, z)];
    const c = worldPos(x, z);
    if (bits === 1) return w.wz - c.z >= 0 ? 2 : 0;
    if (bits === 2) return w.wx - c.x >= 0 ? 1 : 3;
    return -1;
}

function brushTiles(x, z) {
    const r = app.brush - 1, out = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, z + dz)) out.push([x + dx, z + dz]);
    return out;
}

const worldPos = (x, z) => ({ x: x - N / 2 + 0.5, z: z - N / 2 + 0.5 });

function applyAt(t, first) {
    const W = app.world;
    const tool = app.tool;
    const wp = worldPos(t.x, t.z);
    if (tool === 'track' && app.trackMode === 'station') {
        if (!inb(t.x, t.z)) return;
        const i = idx(t.x, t.z);
        if (first && W.station[i]) { stroke.removing = true; }
        if (stroke.removing) { if (W.setStation(t.x, t.z, false)) { sfx.erase(); fx.dust(wp.x, LAND_H, wp.z, 4); } }
        else if (W.setStation(t.x, t.z, true)) { sfx.place(); fx.confetti(wp.x, LAND_H + 0.1, wp.z, 8); }
        else if (first && W.track[i] && !W.straightOnly(i)) { sfx.error(); ui.setHint('Stations need straight track'); }
        else if (first && !W.track[i]) { sfx.error(); ui.setHint('Lay some straight track first, then add a station'); }
    } else if (tool === 'track' && app.trackMode === 'erase') {
        const r = W.eraseTrack(t.x, t.z);
        if (r === 'train') { if (first) { sfx.error(); ui.setHint('A train is on that track!'); } }
        else if (r) { sfx.erase(); fx.dust(wp.x, LAND_H, wp.z, 5); }
    } else if (tool === 'bulldoze') {
        const r = W.bulldoze(t.x, t.z);
        if (r === 'train') { if (first) { sfx.error(); ui.setHint('A train is on that track!'); } }
        else if (r) { sfx.dust(); fx.dust(wp.x, LAND_H, wp.z, 12); }
    } else if (tool === 'land') {
        let changed = 0;
        for (const [x, z] of brushTiles(t.x, t.z)) if (W.paintTerrain(x, z, app.landPaint)) changed++;
        if (changed) { sfx.paint(); fx.sparkle(wp.x, LAND_H + 0.1, wp.z, app.landPaint === T.WATER ? 0x9be0ff : 0xffffff, 4); }
    } else if (tool === 'build') {
        const it = ITEM[app.buildItem];
        const [w, d] = footprint(it, app.rot);
        const ox = t.x - Math.floor((w - 1) / 2), oz = t.z - Math.floor((d - 1) / 2);
        if (it.small || first) {
            const why = W.canPlace(it.id, ox, oz, app.rot);
            if (!why) {
                W.place(it.id, ox, oz, app.rot);
                if (it.cat === 'homes') W.stats.homesBuilt++;
                if (it.id.startsWith('tree_')) W.stats.treesPlanted++;
                sfx.place();
                const c = objCentre({ type: it.id, x: ox, z: oz, rot: app.rot });
                fx.confetti(c.x, LAND_H + 0.2, c.z, it.small ? 8 : 18);
                stroke.placed++;
            } else if (first && !it.small) { sfx.error(); ui.setHint(reason(why)); }
        }
    }
}

function reason(why) {
    return { 'needs water': 'Boats and ducks go on the water', 'needs land': 'That needs dry land', hill: 'Too hilly here: paint it flat with 🎨 Land first', track: 'There\'s track in the way', taken: 'Something is already there', edge: 'Too close to the edge' }[why] || 'Can\'t go there';
}

const handler = {
    mode() {
        if (app.mode !== 'play' || app.modal) return 'pan';
        if (app.tool === 'play') return 'pan';
        if (app.tool === 'trains') return 'pan';
        return 'tool';
    },
    gesture() { if (app.follow) stopFollow(); },
    down(p) {
        initAudio();
        const t = tileAt(p);
        if (!t || !app.world) return;
        const W = app.world;
        stroke = { kind: app.tool, path: [[t.x, t.z]], before: beginOp(), last: t, placed: 0, clacks: 0, startW: t };
        if (app.tool === 'track' && app.trackMode === 'lay') {
            W.beginStroke();
        } else applyAt(t, true);
        if (app.tool === 'build') hover(p);
    },
    move(p) {
        if (!stroke) return;
        const t = tileAt(p);
        if (!t) return;
        const W = app.world;
        if (t.x === stroke.last.x && t.z === stroke.last.z) { if (app.tool === 'build') hover(p); return; }
        const seg = tileLine(stroke.last.x, stroke.last.z, t.x, t.z).slice(1);
        stroke.last = t;
        if (app.tool === 'track' && app.trackMode === 'lay') {
            for (const s of seg) {
                const k = stroke.path.length;
                if (k >= 2 && stroke.path[k - 2][0] === s[0] && stroke.path[k - 2][1] === s[1]) stroke.path.pop();   // stepping back un-draws
                else stroke.path.push(s);
            }
            W.rewindStroke();
            const first = stroke.path[0], lastT = stroke.path[stroke.path.length - 1];
            const used = W.layTrack(stroke.path, sideHint(first[0], first[1], stroke.startW), sideHint(lastT[0], lastT[1], t));
            if (used < stroke.path.length) { stroke.path.length = Math.max(1, used); stroke.last = { x: stroke.path[stroke.path.length - 1][0], z: stroke.path[stroke.path.length - 1][1] }; ui.setHint('Something\'s in the way!'); }
            if (stroke.path.length > stroke.clacks) { sfx.clack(stroke.path.length); stroke.clacks = stroke.path.length; const e = stroke.path[stroke.path.length - 1]; const wp = worldPos(e[0], e[1]); fx.sparkle(wp.x, LAND_H + 0.1, wp.z, 0xd9d2c2, 2); }
            stroke.clacks = stroke.path.length;
        } else if (app.tool === 'build' && !ITEM[app.buildItem].small) {
            hover(p);
        } else for (const s of seg) applyAt({ x: s[0], z: s[1] }, false);
        if (app.tool === 'build') hover(p);
    },
    up(p, tap) {
        const W = app.world;
        if (!W || app.mode !== 'play') return;
        if (!stroke) {
            // Play (and Trains) taps
            if (tap) tapAt(p);
            return;
        }
        if (app.tool === 'track' && app.trackMode === 'lay') {
            W.endStroke();
            if (stroke.path.length >= 2) W.stats.trackLaid += stroke.path.length;
            if (stroke.path.length < 2) {
                const t = stroke.path[0];
                if (W.toggleSwitch(t[0], t[1])) { sfx.switch(); checkStickers({ type: 'switch' }); }
                else if (tap && !W.track[idx(t[0], t[1])]) ui.setHint('Drag to draw track');
            }
        }
        endOp(stroke.before);
        stroke = null;
    },
    cancel() {
        if (!stroke) return;
        const W = app.world;
        if (app.tool === 'track' && app.trackMode === 'lay') { W.rewindStroke(); W.endStroke(); }
        else W.restore(JSON.parse(stroke.before));
        stroke = null;
        objView.hideGhost();
    },
    hover(p) { lastHover = p; hover(p); },
    pan(dx, dy) {
        if (app.follow) stopFollow();
        const k = (rig.dist * 2 * Math.tan((camera.fov * Math.PI) / 360)) / window.innerHeight;
        panBy(-dx * k, -dy * k / Math.max(0.35, Math.sin(rig.pitch)));
    },
    orbit(dx, dy) { orbitBy(-dx * 0.008, dy * 0.006); },
    zoom(f) { zoomBy(f); },
    twist(da) { orbitBy(-da, 0); },
};

function hover(p) {
    if (!p || app.mode !== 'play' || !app.world) { objView.hideGhost(); return; }
    const t = tileAt(p);
    if (!t) { objView.hideGhost(); return; }
    if (app.tool === 'build') {
        const it = ITEM[app.buildItem];
        const [w, d] = footprint(it, app.rot);
        const ox = t.x - Math.floor((w - 1) / 2), oz = t.z - Math.floor((d - 1) / 2);
        objView.showGhost(it.id, ox, oz, app.rot, !app.world.canPlace(it.id, ox, oz, app.rot));
    } else if (app.tool === 'track' || app.tool === 'bulldoze' || app.tool === 'trains') {
        objView.hideGhost();
        const col = app.tool === 'bulldoze' || app.trackMode === 'erase' ? 0xff8a7a : app.tool === 'trains' ? 0x7ab8ff : 0xffe680;
        if (inb(t.x, t.z)) objView.showCursor(t.x, t.z, 1, 1, col);
    } else if (app.tool === 'land') {
        objView.hideGhost();
        const r = app.brush - 1;
        objView.showCursor(t.x - r, t.z - r, r * 2 + 1, r * 2 + 1, 0xffffff);
    } else objView.hideGhost();
}

const SAYINGS = ['Hello!', 'Choo choo!', 'I love trains!', 'What a lovely day!', 'Toot toot!', 'Hi there! 👋', 'Is that my train?', 'Off to the seaside!', 'Wheee!', 'Nice island!', 'Ice cream time? 🍦', 'All aboard!', 'La la la ♪', '*waves*'];

function tapAt(p) {
    const W = app.world;
    initAudio();
    // trains first (big and important), then people, then the tile
    const trainId = trainView.pick(W, p.x, p.y, toScreen);
    if (trainId && app.tool !== 'trains') {
        if (app.selected === trainId) { const t = W.trains.get(trainId); toot(t); }
        else { act.select(trainId); sfx.pop(); }
        return;
    }
    const t = tileAt(p);
    if (app.tool === 'trains') {
        if (trainId) { act.select(trainId); sfx.pop(); return; }
        const set = app.shed.find((d) => d.id === app.trainSet);
        if (!t || !inb(t.x, t.z)) return;
        if (!set) { ui.setHint('Pick a train set first'); sfx.error(); return; }
        if (!W.track[idx(t.x, t.z)]) { ui.setHint('Tap on some track'); sfx.error(); return; }
        if (W.trains.list.length >= MAX_TRAINS) { ui.toast(`That's ${MAX_TRAINS} trains: the island is full up!`, '🚦'); sfx.error(); return; }
        const r = W.trains.place(set, t.x, t.z);
        if (typeof r === 'string') {
            sfx.error();
            ui.setHint(r === 'busy' ? 'Another train is in the way' : r === 'short' ? 'This track is too short for that train: build more!' : 'Can\'t put a train there');
            return;
        }
        sfx.trainPlaced();
        setTimeout(() => sfx.whistle(set.engine), 250);
        const wp = worldPos(t.x, t.z);
        fx.confetti(wp.x, RAIL_Y, wp.z, 24);
        act.select(r.id);
        app.dirty = true;
        checkStickers({ type: 'trainPlaced', cars: set.cars.length });
        return;
    }
    const pid = peopleView.pick(W, p.x, p.y, toScreen);
    if (pid) {
        const person = W.people.wave(pid);
        if (person) {
            const b = ui.bubble(SAYINGS[Math.floor(Math.random() * SAYINGS.length)], 0, 0, 0, 2200);
            b.track = () => [person.x - N / 2, LAND_H + 0.45, person.z - N / 2];
            sfx.hello();
        }
        return;
    }
    if (!t || !inb(t.x, t.z)) { act.select(0); return; }
    if (W.isSwitch(t.x, t.z)) { W.toggleSwitch(t.x, t.z); sfx.switch(); checkStickers({ type: 'switch' }); app.dirty = true; return; }
    const o = W.objectAt(t.x, t.z);
    if (o) {
        const it = ITEM[o.type];
        objView.boop(o.id);
        const c = objCentre(o);
        const kind = { sheep: 'sheep', cow: 'cow', ducks: 'duck', whale: 'whale', clocktower: 'bell', school: 'bell', windmill: 'whirl', ferris: 'fun', carousel: 'fun', balloon: 'whirl' }[o.type]
            || (it.cat === 'nature' ? 'tree' : it.cat === 'water' ? 'splash' : it.cat === 'homes' ? 'house' : it.cat === 'town' ? 'shop' : '');
        sfx.boop(kind);
        if (o.type === 'windmill' || o.type === 'ferris' || o.type === 'carousel') objView.whirl(o.id);
        fx.sparkle(c.x, LAND_H + 0.6, c.z, 0xfff1a0, 6);
        const says = { sheep: 'Baa!', cow: 'Moo!', ducks: 'Quack!', whale: 'Wooo!', snowman: 'Brrr! ⛄', tree_fruit: '🍎', icecream: '🍦 Yum!', bakery: '🥐 Fresh bread!', cafe: '☕', toyshop: '🧸', fountain: '💦', lighthouse: '💡', castle: '👑', balloon: '🎈 Up, up!' }[o.type];
        if (says) ui.bubble(says, c.x, LAND_H + 1.0, c.z, 1600);
        return;
    }
    const i = idx(t.x, t.z);
    if (W.station[i]) {
        const wp = worldPos(t.x, t.z);
        const waiting = W.people.list.filter((q) => q.state === 'wait' && W.stationBlock(i).includes(q.station)).length;
        ui.bubble(`🚉 ${W.stationNames.get(i)} · ${waiting} waiting`, wp.x, LAND_H + 0.9, wp.z, 2200);
        sfx.arrive();
        return;
    }
    act.select(0);
}

initInput(canvas, handler);

// ------------------------------------------------------------------ keyboard
const keys = new Set();
window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    initAudio();
    const k = e.key.toLowerCase();
    if (app.modal) { if (k === 'escape' && app.modalDismiss) ui.closeModal(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) act.redo(); else act.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); act.redo(); return; }
    if (app.mode !== 'play') return;
    keys.add(k);
    if (k >= '1' && k <= '6') act.setTool(ui.TOOLS[Number(k) - 1].id);
    else if (k === 'r') act.rotate();
    else if (k === 'q') act.cam('left');
    else if (k === 'e') act.cam('right');
    else if (k === 'h') act.cam('home');
    else if (k === '+' || k === '=') act.cam('in');
    else if (k === '-' || k === '_') act.cam('out');
    else if (k === 't') act.cycleTime();
    else if (k === 'm') act.toggleMute();
    else if (k === ' ') { e.preventDefault(); const t = app.world.trains.get(app.selected); if (t) toot(t); }
    else if (k === 'delete' || k === 'backspace') { if (app.selected) act.trainCmd('remove'); }
    else if (k === 'escape') {
        if (app.follow) stopFollow();
        else if (app.selected) act.select(0);
        else if (app.tool !== 'play') act.setTool('play');
        else ui.openMenu();
    }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function keyPan(dt) {
    if (app.mode !== 'play' || app.modal) return;
    let x = 0, z = 0;
    if (keys.has('w') || keys.has('arrowup')) z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) z += 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (x || z) { if (app.follow) stopFollow(); const s = rig.dist * 0.9 * dt; panBy(x * s, z * s); }
}

// ------------------------------------------------------------------ events from the simulation
function onScreen(x, z) { const s = toScreen(x, LAND_H, z); return s && s.x > 0 && s.y > 0 && s.x < window.innerWidth && s.y < window.innerHeight; }

function drainEvents() {
    const W = app.world;
    const evs = W.events.splice(0);
    if (app.mode !== 'play') return;
    for (const ev of evs) {
        if (ev.type === 'arrive') {
            const t = W.trains.get(ev.id);
            const p = t && trainView.engine(t.id);
            if (p && (t.id === app.selected || onScreen(p.x, p.z))) {
                sfx.arrive();
                if (ev.station) ui.bubble(`🚉 ${ev.station}`, p.x, RAIL_Y + 0.9, p.z, 1800);
            }
        } else if (ev.type === 'depart') {
            const t = W.trains.get(ev.id);
            if (t && t.id === app.selected) sfx.whistle(t.design.engine);
        } else if (ev.type === 'board') {
            const p = trainView.engine(ev.id);
            if (p && onScreen(p.x, p.z) && ev.on) { sfx.board(ev.on); fx.sparkle(p.x, RAIL_Y + 0.5, p.z, 0xffe680, 4 + ev.on); }
            checkStickers(ev);
        } else if (ev.type === 'switch' || ev.type === 'buffer') {
            checkStickers(ev);
        }
    }
}

// ------------------------------------------------------------------ frame loop
let last = performance.now(), acc = 0, time = 0, statT = 0, chuffOdo = 0;
let fpsT = 0, fpsN = 0, slow = 0;

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    app.frameNo++;
    try {
        const W = app.world;
        if (W) {
            acc += dt * FAST;
            let steps = 0;
            while (acc >= 1 / 30 && steps < 8 * FAST) { W.step(1 / 30); acc -= 1 / 30; steps++; }
            if (steps >= 8 * FAST) acc = 0;
            drainEvents();
        }
        // time of day
        if (tod.cycle) tod.t = (tod.t + dt * tod.speed) % 1;
        else if (tod.target !== undefined) {
            let d = tod.target - tod.t;
            if (d < -0.5) d += 1;
            if (d > 0.5) d -= 1;
            tod.t = (tod.t + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35) + 1) % 1;
        }
        const nf = applyTime(tod.t);
        setNight(nf);
        if (W) {
            ground.sync(W); trackView.sync(W); objView.sync(W);
            trainView.update(W, dt, time);
            peopleView.update(W);
            // ride along
            if (app.follow) {
                const p = trainView.engine(app.follow);
                const t = W.trains.get(app.follow);
                if (p && t) {
                    rig.follow = { x: p.x, z: p.z, yaw: p.yaw };
                    if (t.design.engine === 'steam' || t.design.engine === 'tank') {
                        chuffOdo += t.v * dt;
                        if (chuffOdo > 0.42) { chuffOdo = 0; sfx.chuff(t.v); }
                    }
                } else stopFollow();
            }
            if (app.selected && !W.trains.get(app.selected)) act.select(0);
        }
        if (W) ambient.setSeason(W.season);
        ground.update(time, 1 - nf);
        objView.update(dt, time);
        fx.update(dt);
        ambient.update(dt, time, camera);
        keyPan(dt);
        updateCamera(dt);
        render();
        ui.updateBubbles(toScreen, now);
        statT -= dt;
        if (statT <= 0 && W && app.mode === 'play') {
            statT = 0.5;
            ui.updateStats(W.trains.list.length, W.people.list.length, W.stats.riders);
            if (app.selected) ui.updateTrainCard(W.trains.get(app.selected));
            app.saveT += 0.5;
            if (app.saveT > 25 && app.dirty && !stroke) saveNow(app.saveT > 120);
            if (app.saveT > 120) app.saveT = 0;
            if (Math.floor(time * 2) % 6 === 0) checkStickers(null);
        }
        // automatic quality: drop a tier after several slow seconds
        fpsN++; fpsT += dt;
        if (fpsT >= 2) {
            const fps = fpsN / fpsT;
            fpsN = 0; fpsT = 0;
            if (settings.quality === 'auto' && !params.has('q') && document.visibilityState === 'visible') {
                if (fps < 32) slow++; else slow = 0;
                if (slow >= 3 && getQuality() < 2) { setQuality(getQuality() + 1); slow = 0; }
            }
            app.fps = fps;
        }
    } catch (err) {
        console.error(err);
    }
}

window.addEventListener('resize', () => { resize(); ui.measureDock(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && app.dirty) saveNow(false); });
window.addEventListener('pagehide', () => { if (app.dirty) saveNow(false); });

// ------------------------------------------------------------------ boot
ui.initUI(app, act);
ui.setMuteIcon(settings.muted);
setVolumes(settings.music, settings.sfx);
setMuted(settings.muted);
tod.t = settings.cycle ? 0.42 : settings.tod;
tod.target = settings.cycle ? undefined : settings.tod;
tod.cycle = settings.cycle;
toTitle();
requestAnimationFrame(frame);

// Fill in missing shed thumbnails a moment after start.
setTimeout(() => {
    let changed = false;
    for (const d of app.shed) if (!d.thumb) { try { d.thumb = getMini().trainThumb(d); changed = true; } catch { /* no webgl */ } }
    if (changed) { save.saveShed(app.shed); if (app.tool === 'trains') ui.renderTray(); }
}, 600);

if (DEBUG) {
    window.__tt = {
        app, act, rig, tod, ui, save, scene, renderer, camera,
        get world() { return app.world; },
        handler,
        tileScreen(x, z) { const p = worldPos(x, z); return toScreen(p.x, LAND_H, p.z); },
        step(n = 30) { for (let i = 0; i < n; i++) app.world.step(1 / 30); },
        tiles: { T, idx },
        ENGINES,
    };
}
