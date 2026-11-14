// Pinch & Place — entry point. Boots the view, routes pointer, keyboard and gamepad input into
// commands for the simulation, drains its events into the view, the sound and the HUD, and runs
// the photo mode and share links.
//
// ?debug=1 exposes window.__pp for the dev/ harnesses.

import { MAX_FRAME, PHOTO } from './config.js';
import { KINDS } from './sim/data/catalog.js';
import { LEVELS, LEVEL } from './sim/data/levels.js';
import { newGame, act, step, unlocked, shelf } from './sim/game.js';
import { evaluate } from './sim/rate.js';
import { placementFor, footprint, tilesOf } from './sim/room.js';
import { makeBot, botNext, botPlayRoom } from './sim/bot.js';
import { View, TIMES } from './view/view.js';
import { Bench, Icons } from './view/bench.js';
import { preloadPaintings } from './view/models.js';
import { FILTERS } from './view/post.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadAlbum, addToAlbum, removeFromAlbum } from './save.js';
import { shareURL, fromHash } from './share-link.js';
import { frame as framePhoto, download, share, copyText, thumb, ASPECTS } from './photo.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));
view.setDetail(settings.detail !== 'low');
const icons = new Icons();
let bench = null;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.setDetail(s.detail !== 'low'); },
    onDeleteSave: () => { clearSave(); G = newGame(seed()); if (mode !== 'title') toTitle(); },
});
const seed = () => (Date.now() % 1e9) | 0;

let G = loadGame() || newGame(seed());
let viewG = G;                 // what the view shows: the player's room, the title demo or a visited diorama
let mode = 'title';            // title | build | photo | visit
let photoFrom = 'build';
let placing = null;            // { id, rot, spec, moving }
let selected = null;
let cursor = null;             // keyboard cursor { x, y }
let bot = null, botT = 0;
let last = performance.now(), time = 0;
let lastEval = null;
const seen = {};
const say = (t) => ui.toast(t);

// ------------------------------------------------------------------ the title demo room
function demoRoom() {
    const D = newGame(7, 'cabin');
    D.events.length = 0;
    botPlayRoom(D);
    D.events.length = 0;
    return D;
}

function showRoom(g) { viewG = g; view.setRoom(g); }

// ------------------------------------------------------------------ menus
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'rooms') openRooms();
    else if (a === 'studio') openBrief('studio');
    else if (a === 'album') openAlbum();
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'brief') { ui.closeScreen('pause'); ui.showBrief(G.level); $('brief-go').textContent = 'Back to it'; }
    else if (a === 'clear') { ui.closeScreen('pause'); doAct({ t: 'clear' }); }
    else if (a === 'rooms') { ui.closeAll(); saveGame(G); openRooms(); }
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});

function openRooms() {
    ui.renderRooms(G, (id) => openBrief(id));
    ui.openScreen('rooms');
}
function openBrief(id) {
    briefFor = id;
    ui.showBrief(id);
    $('brief-go').textContent = G.level === id && G.items.some((i) => i.at) && mode !== 'build' ? 'Carry on' : "Let's pinch!";
}
let briefFor = null;
$('brief-go').addEventListener('click', () => {
    audio.ui('click');
    const id = briefFor || G.level;
    if (mode === 'build' && id === G.level) { ui.closeScreen('brief'); return; }
    // carry on with a room in progress, or open it fresh
    if (G.level !== id || G.result) {
        const r = act(G, { t: 'level', id });
        if (!r.ok) { say('That room is still locked.'); return; }
    }
    startBuild();
});

function startBuild() {
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'build';
    placing = null; selected = null; cursor = null;
    view.hide(null);
    showRoom(G);
    $('hud').hidden = false;
    $('photo-ui').hidden = true;
    ui.resetGoals();
    // small screens start with the brief folded away; its summary line still counts the goals
    $('goals').open = innerWidth >= 640 && innerHeight >= 500;
    lastEval = evaluate(G);
    refresh();
    audio.playMusic('build');
    input.flush();
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    placing = null; selected = null;
    $('hud').hidden = true; $('photo-ui').hidden = true; $('visit-back').hidden = true;
    view.exitPhoto?.();
    showRoom(demo);
    ui.openScreen('title');
    audio.playMusic('title');
    audio.setFire(false);
}

function pause() {
    if (mode !== 'build' || ui.anyScreen()) return;
    cancelPlacing();
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ commands
function doAct(cmd) {
    const before = lastEval;
    const r = act(G, cmd);
    if (r.ok) {
        saveGame(G);
        lastEval = evaluate(G);
        // a goal just met: a ding, and a word from the client
        if (before && cmd.t !== 'finish') {
            lastEval.goals.forEach((g, i) => { if (g.ok && before.goals[i] && !before.goals[i].ok) { audio.play('goal', { delay: 0.15 }); say(`✓ ${g.text}`); } });
        }
    }
    return r;
}

const WHY = { clay: 'Not enough clay. Squish something on your shelf back into clay.', taken: 'Something is already there.', door: 'Keep the doorway clear.', window: 'Not over the window.', outside: "That doesn't fit in the room.", blocked: 'The post is in the way.', shelf: 'Your shelf is full. Place or squish something first.', wall: 'Wall things go on the walls.', empty: 'Nothing to undo.' };

// ------------------------------------------------------------------ the bench
function openBench() {
    if (!bench) {
        bench = new Bench($('bench-canvas'));
        ui.buildBench({
            onChange: (r) => bench.setRecipe(r),
            onMake: (r) => {
                const res = doAct({ t: 'craft', recipe: { ...r, colors: [...r.colors] } });
                if (!res.ok) { say(WHY[res.why] || 'Not now.'); return; }
                ui.closeScreen('bench');
                refresh();
                // straight into placing it
                startPlacing(res.id);
            },
        });
        ui.onChange = (r) => bench.setRecipe(r);
    }
    if (G.room.studio && G.clay < 50) G.clay = 400;   // the studio's lump never runs out
    ui.syncBench(G.clay, G.room.studio);
    bench.setRecipe(ui.recipe);
    cancelPlacing();
    audio.ui('open');
    ui.openScreen('bench');
}
$('btn-make').addEventListener('click', () => { if (mode === 'build') openBench(); });

// ------------------------------------------------------------------ placing
const item = (id) => G.items.find((i) => i.id === id);

/** A first spot for a thing picked from the shelf by key or touch: the free spot nearest the middle. */
function firstSpot(it) {
    const K = KINDS[it.kind];
    if (K.layer === 'wall') {
        for (const wall of ['L', 'R']) for (let v = 1; v >= 0; v--) for (let u = 0; u < (wall === 'L' ? G.w : G.d); u++) { const s = { wall, u, v }; if (placementFor(G, it.id, s).at) return s; }
        return { wall: 'L', u: 0, v: 1 };
    }
    const cx = G.w / 2, cy = G.d / 2;
    let best = null, bd = Infinity;
    for (let y = 0; y < G.d; y++) for (let x = 0; x < G.w; x++) {
        const s = { x, y, rot: 0 };
        if (!placementFor(G, it.id, s).at) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bd) { bd = d; best = s; }
    }
    return best || { x: 0, y: 0, rot: 0 };
}

function startPlacing(id) {
    const it = item(id);
    if (!it) return;
    selected = null; view.setSelected(null);
    placing = { id, rot: it.at?.rot || 0, spec: null, moving: !!it.at };
    if (it.at) { view.hide(id); audio.play('lift'); }
    placing.spec = it.at ? (it.at.layer === 'wall' ? { wall: it.at.wall, u: it.at.u, v: it.at.v } : { x: it.at.x, y: it.at.y, rot: it.at.rot }) : firstSpot(it);
    if (input.lastDevice === 'mouse' && lastHover && !it.at) specFromPoint(lastHover.x, lastHover.y);
    updateGhost();
    refresh();
}
function cancelPlacing() {
    if (!placing) return;
    placing = null;
    view.hide(null);
    view.setGhost(null);
    refresh();
}
function updateGhost() {
    if (!placing) { view.setGhost(null); return; }
    const it = item(placing.id);
    const p = placementFor(G, placing.id, placing.spec);
    view.setGhost(it, placing.spec, p.at, !!p.at);
}
function commitPlacing() {
    if (!placing) return false;
    const { id, spec } = placing;
    const r = doAct({ t: 'place', id, ...spec });
    if (!r.ok) { say(WHY[r.why] || "It won't go there."); return false; }
    placing = null;
    view.hide(null);
    view.setGhost(null);
    refresh();
    return true;
}
function turn() {
    if (placing) {
        placing.rot = (placing.rot + 1) % 4;
        if (placing.spec.rot != null) {
            const it = item(placing.id);
            const [fw, fd] = footprint(it, placing.rot);
            placing.spec = { ...placing.spec, rot: placing.rot, x: Math.min(placing.spec.x, Math.max(0, G.w - fw)), y: Math.min(placing.spec.y, Math.max(0, G.d - fd)) };
        }
        audio.play('rotate', { vol: 0.6 });
        updateGhost();
    } else if (selected != null) {
        const r = doAct({ t: 'rotate', id: selected });
        if (!r.ok) say(r.why === 'wall' ? "Pictures hang straight." : "There's no room to turn it.");
        refresh();
    }
}
function select(id) {
    selected = id;
    view.setSelected(id);
    if (id != null) audio.play('click', { rate: 1.2, vol: 0.5 });
    refresh();
}

/** Turn a screen point into a placing spec for the held thing. */
let lastHover = null;
function specFromPoint(x, y) {
    if (!placing) return false;
    const it = item(placing.id), K = KINDS[it.kind];
    const p = view.pick(x, y);
    let spec = null;
    if (K.layer === 'wall') {
        if (!p.wall) return false;
        const [w, h] = K.fp[it.size];
        spec = { wall: p.wall.wall, u: Math.round(p.wall.pu - w / 2), v: Math.round(p.wall.pv - h / 2) };
    } else if (K.layer === 'small' && p.item != null && p.itemPoint && KINDS[item(p.item)?.kind]?.surface) {
        spec = { x: Math.floor(p.itemPoint.x), y: Math.floor(p.itemPoint.z), rot: placing.rot };
    } else if (p.floor) {
        // the pointed tile is always inside the footprint (rounding a centre that sits on a tile edge isn't)
        const [fw, fd] = footprint(it, placing.rot);
        spec = { x: Math.floor(p.floor.px) - Math.floor((fw - 1) / 2), y: Math.floor(p.floor.pz) - Math.floor((fd - 1) / 2), rot: placing.rot };
    }
    if (!spec) return false;
    const same = placing.spec && JSON.stringify(spec) === JSON.stringify(placing.spec);
    placing.spec = spec;
    if (!same) updateGhost();
    return same;
}

// ------------------------------------------------------------------ the pointer on the room
const pointers = new Map();
let pinch = null, drag = null;
const canvas = $('view');
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'title' || ui.anyScreen()) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType, button: e.button });
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        drag = null;
    } else drag = { moved: false, pan: e.button === 1 || e.button === 2 };
});
canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
        // a mouse hovering: the held thing follows it
        if (e.pointerType === 'mouse' && mode === 'build') { lastHover = { x: e.clientX, y: e.clientY }; if (placing) specFromPoint(e.clientX, e.clientY); }
        return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (pinch.d > 10) view.zoomBy(d / pinch.d);
        if (mode === 'build') view.panBy(mx - pinch.mx, my - pinch.my);
        pinch.d = d; pinch.mx = mx; pinch.my = my;
        return;
    }
    if (!drag) return;
    // a press that wandered ~10 px is a drag, never a tap (game-067)
    if (!drag.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 10) drag.moved = true;
    if (!drag.moved) return;
    if (mode === 'photo') view.orbit(-dx * 0.006, dy * 0.005);
    else if (drag.pan || !placing) { if (view.zoom > 1.01 || drag.pan) view.panBy(dx, dy); }
    else specFromPoint(e.clientX, e.clientY);    // drag the held thing around
});
const endPointer = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
    const d = drag;
    drag = null;
    if (e.type !== 'pointerup' || !d || d.pan) return;
    if (!d.moved) tap(e.clientX, e.clientY, p.type);
    else if (placing && p.type !== 'mouse') { /* dragged the ghost: leave it there for ✓ */ }
    else if (placing && p.type === 'mouse') commitPlacing();
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { if (mode === 'build' || mode === 'photo') { e.preventDefault(); view.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); } }, { passive: false });

function tap(x, y, type) {
    if (mode !== 'build') return;
    if (placing) {
        const same = specFromPoint(x, y);
        // mouse: a click puts it down; touch: the first tap moves it there, a second tap (or ✓) puts it down
        if (type === 'mouse' || same) commitPlacing();
        return;
    }
    const p = view.pick(x, y);
    if (p.item != null) {
        if (selected === p.item) startPlacing(p.item);   // tap a selected thing again to pick it up
        else select(p.item);
    } else select(null);
}

// ------------------------------------------------------------------ HUD buttons
$('btn-undo').addEventListener('click', () => { cancelPlacing(); const r = doAct({ t: 'undo' }); if (!r.ok) say(WHY.empty); select(null); });
$('btn-photo').addEventListener('click', () => enterPhoto('build'));
$('btn-finish').addEventListener('click', () => finish());
$('btn-pause').addEventListener('click', () => pause());
$('btn-zin').addEventListener('click', () => view.zoomBy(1.2));
$('btn-zout').addEventListener('click', () => view.zoomBy(1 / 1.2));
$('ctx').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctx]');
    if (!b) return;
    const a = b.dataset.ctx;
    if (a === 'turn') turn();
    else if (a === 'put') commitPlacing();
    else if (a === 'cancel') { if (placing) cancelPlacing(); else select(null); }
    else if (a === 'move' && selected != null) startPlacing(selected);
    else if (a === 'stow' && selected != null) { const r = doAct({ t: 'stow', id: selected }); if (!r.ok) say(WHY[r.why] || 'Not now.'); select(null); }
});
// buttons act on finger-down would close sheets on lift; here plain clicks are fine (no sheet opens under them)

function onShelfPick(id) {
    if (mode !== 'build') return;
    if (placing && placing.id === id) { cancelPlacing(); return; }
    cancelPlacing();
    audio.play('lift', { vol: 0.7 });
    startPlacing(id);
}
function onSquish(id) {
    const r = doAct({ t: 'squish', id });
    if (r.ok) { if (placing?.id === id) cancelPlacing(); refresh(); }
}

function refresh() {
    if (mode !== 'build' && mode !== 'photo') return;
    const ev = lastEval || evaluate(G);
    ui.hud(G, ev);
    ui.renderShelf(G, icons, placing && !placing.moving ? placing.id : null, onShelfPick, onSquish);
    const touch = input.lastDevice === 'touch';
    if (placing) ui.ctx('placing', `${KINDS[item(placing.id).kind].emoji} ${touch ? 'Tap where it goes' : 'Click where it goes'}`, true);
    else if (selected != null && item(selected)?.at) ui.ctx('selected', `${KINDS[item(selected).kind].emoji} ${KINDS[item(selected).kind].name}`);
    else ui.ctx(null);
    audio.setFire(G.items.some((i) => i.at && i.kind === 'fireplace'));
}

// ------------------------------------------------------------------ finishing a room
function finish() {
    if (mode !== 'build') return;
    cancelPlacing(); select(null);
    const wasLocked = LEVELS.map((l) => !unlocked(G, l.id));
    doAct({ t: 'finish' });
    const ev = evaluate(G);
    const i = LEVELS.findIndex((l) => l.id === G.level);
    const next = LEVELS[i + 1];
    const opened = LEVELS.filter((l, k) => wasLocked[k] && unlocked(G, l.id));
    ui.showResults(G, ev, {
        onPhoto: () => { ui.closeScreen('results'); enterPhoto('build'); },
        onKeep: () => { ui.closeScreen('results'); },
        onNext: () => { ui.closeAll(); if (next && unlocked(G, next.id)) openBrief(next.id); else openRooms(); },
        nextLabel: next && unlocked(G, next.id) && !G.room.studio ? 'Next room' : 'Rooms',
    });
    if (opened.length) setTimeout(() => { audio.play('unlock'); say(`New room: ${opened[0].name}!`); }, 2200);
    saveGame(G);
}

// ------------------------------------------------------------------ photo mode
const photo = { time: 'day', filter: 'natural', lens: 'iso', tilt: 0, frame: 'polaroid', aspect: '4:3', shot: null, framed: null };
function chipRow(id, entries, key, apply) {
    const host = $(id);
    if (!host.dataset.built) {
        host.dataset.built = '1';
        if (entries) host.innerHTML = entries.map(([k, n]) => `<button class="chip" data-v="${k}">${n}</button>`).join('');
        host.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            const v = b.dataset.v ?? b.dataset[key];
            audio.play('click', { vol: 0.5 });
            apply(v);
            mark(id, v, key);
        });
    }
}
function mark(id, v, key) { for (const b of $(id).children) b.classList.toggle('on', (b.dataset.v ?? b.dataset[key]) === String(v)); }
chipRow('photo-time', Object.entries(TIMES).map(([k, t]) => [k, t.name]), 'v', (v) => { photo.time = v; view.setTime(v); });
chipRow('photo-filter', Object.entries(FILTERS).map(([k, f]) => [k, f.name]), 'v', (v) => { photo.filter = v; view.post.setFilter(v); });
chipRow('photo-lens', null, 'lens', (v) => { photo.lens = v; view.setLens(v); });
chipRow('photo-tilt', null, 'tilt', (v) => { photo.tilt = +v; view.post.setTilt(+v ? 0.9 : 0, 0.52); });
chipRow('photo-frame', null, 'frame', (v) => { photo.frame = v; });
chipRow('photo-aspect', null, 'aspect', (v) => { photo.aspect = v; });

function enterPhoto(from) {
    if (mode === 'photo') return;
    photoFrom = from;
    cancelPlacing(); select(null);
    ui.closeAll();
    mode = 'photo';
    $('hud').hidden = true; $('visit-back').hidden = true;
    $('photo-ui').hidden = false;
    view.enterPhoto();
    view.setTime(photo.time); view.post.setFilter(photo.filter); view.setLens(photo.lens); view.post.setTilt(photo.tilt ? 0.9 : 0, 0.52);
    mark('photo-time', photo.time, 'v'); mark('photo-filter', photo.filter, 'v');
    audio.ui('open');
    input.flush();
}
function exitPhoto() {
    if (mode !== 'photo') return;
    view.exitPhoto();
    $('photo-ui').hidden = true;
    if (photoFrom === 'visit') { mode = 'visit'; $('visit-back').hidden = false; }
    else { mode = 'build'; $('hud').hidden = false; refresh(); }
    audio.ui('close');
    input.flush();
}
$('photo-done').addEventListener('click', exitPhoto);
$('photo-reset').addEventListener('click', () => view.resetPhoto());
$('photo-zin').addEventListener('click', () => view.zoomBy(1.15));
$('photo-zout').addEventListener('click', () => view.zoomBy(1 / 1.15));
$('photo-shutter').addEventListener('click', () => takePhoto());
$('photo-album').addEventListener('click', () => openAlbum());

const today = () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function captionDefault() {
    if (viewG.visit) return viewG.visit.caption || LEVEL[viewG.level].name;
    return LEVEL[viewG.level].studio ? 'My little room' : `${LEVEL[viewG.level].name}`;
}
function takePhoto() {
    if (mode !== 'photo') return;
    const [w, h] = ASPECTS[photo.aspect] || [PHOTO.w, PHOTO.h];
    $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
    audio.play('shutter');
    photo.shot = view.capture(w, h);
    $('snap-caption').value = captionDefault();
    reframe();
    ui.openScreen('snap');
}
function reframe() {
    const stars = viewG.visit || LEVEL[viewG.level].studio ? null : (viewG.progress[viewG.level]?.stars ?? null);
    photo.framed = framePhoto(photo.shot, photo.frame, { caption: $('snap-caption').value.trim(), room: LEVEL[viewG.level].name, stars, date: today() });
    $('snap-img').src = photo.framed.toDataURL('image/jpeg', 0.9);
}
$('snap-caption').addEventListener('input', () => { if (photo.shot) reframe(); });
const fileName = () => `pinch-and-place-${viewG.level}-${Date.now() % 1e6}.png`;
$('snap-download').addEventListener('click', async () => { audio.ui('click'); say((await download(photo.framed, fileName())) ? 'Saved.' : "Couldn't save the image."); });
$('snap-share').addEventListener('click', async () => {
    audio.ui('click');
    const url = shareURL(viewG, $('snap-caption').value.trim());
    const r = await share(photo.framed, { title: 'Pinch & Place', text: `My clay diorama: ${$('snap-caption').value.trim()}`, url, name: fileName() });
    if (r === 'unsupported') say((await copyText(url)) ? 'Sharing isn’t available here, so the link is copied instead.' : 'Sharing isn’t available here.');
});
$('snap-link').addEventListener('click', async () => {
    audio.ui('click');
    const url = shareURL(viewG, $('snap-caption').value.trim());
    lastLink = url;
    say((await copyText(url)) ? 'Link copied: it opens this diorama.' : 'Couldn’t copy. The link is in the address bar.');
    if (!navigator.clipboard) history.replaceState(null, '', url);
});
let lastLink = null;
$('snap-album').addEventListener('click', () => {
    audio.ui('click');
    const ok = addToAlbum({ src: thumb(photo.framed), caption: $('snap-caption').value.trim(), room: viewG.level, at: Date.now() });
    say(ok ? 'In the album.' : "The album can't be saved in this browser.");
});

function openAlbum() {
    const album = loadAlbum();
    ui.renderAlbum(album, {
        onDownload: (i) => { const a = document.createElement('a'); a.href = album[i].src; a.download = `pinch-and-place-${i + 1}.jpg`; a.click(); },
        onDelete: (i) => { removeFromAlbum(i); openAlbum(); },
    });
    ui.openScreen('album');
}

// ------------------------------------------------------------------ visiting a shared diorama
function visit(v) {
    mode = 'visit';
    showRoom(v.G);
    const n = v.G.items.length;
    $('visit-head').textContent = v.G.visit.caption || 'A diorama for you';
    $('visit-text').textContent = `Someone pinched ${n} thing${n === 1 ? '' : 's'} out of clay for ${LEVEL[v.G.level].name}${v.dropped ? ` (${v.dropped} didn't fit and were left out)` : ''}. Turn it around, change the light, and take a photo of your own.`;
    ui.openScreen('visit');
    audio.playMusic('title');
}
$('visit-look').addEventListener('click', () => { audio.ui('click'); enterPhoto('visit'); });
$('visit-photo').addEventListener('click', () => { audio.ui('click'); enterPhoto('visit'); setTimeout(takePhoto, 60); });
$('visit-play').addEventListener('click', () => { audio.ui('click'); history.replaceState(null, '', location.pathname + location.search); toTitle(); });
$('visit-back').addEventListener('click', () => { $('visit-back').hidden = true; ui.openScreen('visit'); });

// ------------------------------------------------------------------ keys and gamepad
function handlePresses() {
    input.poll();
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const k = press.key;
    if (ui.anyScreen()) {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' && ui.top() !== 'title' && ui.top() !== 'visit') { audio.ui('close'); ui.closeTop(); if (mode === 'visit' && !ui.anyScreen()) $('visit-back').hidden = false; }
        else if (k === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'photo') {
        if (k === 'Escape') exitPhoto();
        else if (k === 'ArrowLeft') view.orbit(0.12, 0); else if (k === 'ArrowRight') view.orbit(-0.12, 0);
        else if (k === 'ArrowUp') view.orbit(0, 0.08); else if (k === 'ArrowDown') view.orbit(0, -0.08);
        else if (k === 'Equal' || k === 'NumpadAdd') view.zoomBy(1.15); else if (k === 'Minus' || k === 'NumpadSubtract') view.zoomBy(1 / 1.15);
        else if ((k === 'Space' || k === 'Enter') && !press.button) takePhoto();
        else if (k === 'KeyT') { const ks = Object.keys(TIMES); photo.time = ks[(ks.indexOf(photo.time) + 1) % ks.length]; view.setTime(photo.time); mark('photo-time', photo.time, 'v'); }
        return;
    }
    if (mode === 'visit') { if (k === 'Escape' || k === 'Enter') { $('visit-back').hidden = true; ui.openScreen('visit'); } return; }
    if (mode !== 'build') return;
    if (press.button && (k === 'Space' || k === 'Enter')) return;   // the browser clicks the focused button itself
    const arrows = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (arrows[k]) {
        const [dx, dy] = arrows[k];
        if (placing) {
            const s = placing.spec;
            if (s.wall) {
                // along the wall as it looks on screen; at the corner, round onto the other wall
                const len = (w) => (w === 'L' ? G.w : G.d);
                if (dy) s.v = Math.max(0, Math.min(2, s.v - dy));
                else if (s.wall === 'L') { if (dx < 0 && s.u === 0) s.wall = 'R'; else s.u = Math.min(len('L') - 1, Math.max(0, s.u + dx)); }
                else { if (dx > 0 && s.u === 0) s.wall = 'L'; else s.u = Math.min(len('R') - 1, Math.max(0, s.u - dx)); }
            } else { s.x = Math.max(0, Math.min(G.w - 1, s.x + dx)); s.y = Math.max(0, Math.min(G.d - 1, s.y + dy)); }
            updateGhost();
        } else {
            cursor = cursor || { x: Math.floor(G.w / 2), y: Math.floor(G.d / 2) };
            cursor.x = Math.max(0, Math.min(G.w - 1, cursor.x + dx)); cursor.y = Math.max(0, Math.min(G.d - 1, cursor.y + dy));
            view.setCursor(cursor.x, cursor.y);
        }
        return;
    }
    if (k === 'Enter' || k === 'Space') {
        if (placing) commitPlacing();
        else if (cursor) {
            const here = G.items.filter((i) => i.at && i.at.layer !== 'wall' && tilesOf(i).some(([x, y]) => x === cursor.x && y === cursor.y));
            const pick = here.find((i) => i.at.layer === 'top') || here.find((i) => i.at.layer === 'floor') || here[0];
            if (pick) { if (selected === pick.id) startPlacing(pick.id); else select(pick.id); } else select(null);
        }
        return;
    }
    if (k === 'KeyR') turn();
    else if (k === 'KeyZ') { cancelPlacing(); const r = doAct({ t: 'undo' }); if (!r.ok) say(WHY.empty); select(null); }
    else if (k === 'Delete' || k === 'Backspace') { if (selected != null) { doAct({ t: 'stow', id: selected }); select(null); } else if (placing && !placing.moving) cancelPlacing(); }
    else if (k === 'KeyC') enterPhoto('build');
    else if (k === 'KeyF') finish();
    else if (k === 'KeyB' || k === 'KeyN') openBench();
    else if (/^Digit[1-9]$/.test(k)) { const it = shelf(G)[+k.slice(5) - 1]; if (it) onShelfPick(it.id); }
    else if (k === 'Escape') { if (placing) cancelPlacing(); else if (selected != null) select(null); else pause(); }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    const g = viewG;
    if (!g.events.length && !G.events.length) return;
    for (const src of new Set([g, G])) {
        if (!src.events.length) continue;
        const ev = src.events.splice(0);
        for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
        if (src === viewG) view.onEvents(src, ev);
        audio.onEvents(src, ev);
        if (ev.some((e) => e.type !== 'nope') && src === G && (mode === 'build' || mode === 'photo')) refresh();
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (mode === 'build' && !ui.anyScreen()) {
        step(G, dt);
        if (bot) {
            botT += dt;
            if (botT > 0.25) {
                botT = 0;
                const cmd = botNext(G, bot);
                if (cmd && cmd.t !== 'finish') doAct(cmd); else { bot = null; if (cmd) finish(); }
            }
        }
        const ctxR = $('ctx').hidden ? null : $('ctx').getBoundingClientRect();
        const top = $('topbar').getBoundingClientRect().bottom + 8, bottom = innerHeight - Math.min($('shelf').getBoundingClientRect().top, ctxR ? ctxR.top : Infinity) + 8;
        view.setInsets(Math.round(top), Math.round(bottom));
    } else if (mode === 'photo') {
        const top = $('photo-top').getBoundingClientRect().bottom + 6, bottom = innerHeight - $('photo-panel').getBoundingClientRect().top + 6;
        view.setInsets(Math.round(top), Math.round(Math.min(bottom, innerHeight * 0.6)));
    } else if (mode === 'title' || mode === 'visit') view.setInsets(40, 40);
    flushEvents();
    if (ui.top() === 'bench' && bench) bench.frame(dt, time);
    view.frame(viewG, dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(G); if (mode === 'build') pause(); } });
window.addEventListener('pagehide', () => saveGame(G));

// ------------------------------------------------------------------ boot
const demo = demoRoom();
const shared = fromHash();
preloadPaintings().then(() => { icons.cache.clear(); if (mode === 'build') refresh(); });
if (shared) visit(shared);
else toTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__pp = {
        get G() { return G; },
        get viewG() { return viewG; },
        get mode() { return mode; },
        get placing() { return placing; },
        get selected() { return selected; },
        seen, view, ui, audio, input, evaluate: () => evaluate(G),
        /** Skip the menus: open a room (unlocking every room first) and start building. */
        start(id = 'pip', seedN = 1) { G = newGame(seedN); for (const l of LEVELS) G.progress[l.id] = G.progress[l.id] || { stars: 0, score: 0 }; if (id !== 'pip') { for (const l of LEVELS) G.progress[l.id].stars = Math.max(1, G.progress[l.id].stars); } act(G, { t: 'level', id }); startBuild(); return G; },
        act(cmd) { const r = doAct(cmd); refresh(); return r; },
        autoplay(on = true) { bot = on ? makeBot() : null; botT = 0; },
        /** The bot decorates the room to the end, at once; events flow to the view as usual. */
        ff() { const b = makeBot(); let c, n = 0; while ((c = botNext(G, b)) && c.t !== 'finish' && n++ < 400) doAct(c); flushEvents(); refresh(); return evaluate(G); },
        finish, takePhoto, enterPhoto, exitPhoto, openBench, startPlacing, commitPlacing,
        save: () => saveGame(G), hasSave, shareURL: () => shareURL(G, 'test'), get lastLink() { return lastLink; },
        photo, icons,
    };
}
