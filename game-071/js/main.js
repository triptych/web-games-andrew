/**
 * main.js — boot, modes and the frame loop.
 *
 * loading → title → character creation → play ⇄ menus. The simulation ticks at a fixed 60 Hz;
 * once per frame the world's event queue is drained and handed to the view, the audio, the HUD
 * and the app (which opens the right menu for containers, conversations, doors, stations…).
 */
import { DEBUG, FAST, FORCE_Q, IS_TOUCH, SAVE_PREFIX, DEFAULT_SETTINGS, QUALITY } from './config.js';
import { Terrain, terrainFromData } from './sim/terrain.js';
import { World } from './sim/world.js';
import { LOC } from './sim/geography.js';
import { makeSheet, growAttributes } from './sim/stats.js';
import { recalc } from './sim/actor.js';
import { addItem, equip } from './sim/inventory.js';
import { itemDef } from './sim/items.js';
import { WorldView } from './view/worldview.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Saves, serialize, applySave } from './save.js';
import { UI, RingPanel, WaitPanel, DeathPanel, SettingsPanel, CreditsPanel, SavesPanel, CharGenPanel } from './ui/ui.js';
import { Hud } from './ui/hud.js';
import { InventoryPanel, ContainerPanel, BarterPanel, PickpocketPanel } from './ui/inventory.js';
import { MagicPanel, SkillsPanel } from './ui/character.js';
import { MapPanel, JournalPanel } from './ui/mapui.js';
import { StationPanel, AlchemyPanel, RunePanel, LockPanel, BookPanel, FavoritesPanel } from './ui/craftui.js';
import { DialoguePanel } from './ui/dialogue.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;
const SETTINGS_KEY = `${SAVE_PREFIX}:settings`;
const TIPS = [
    'Hold the sigil key longer to trace more rings of a Storm Sigil.',
    'Sneak attacks with a dagger strike for many times their damage.',
    'Eat an ingredient to learn its first property; study it at a still to learn more.',
    'Dragon embers widen your storm: each one raises your Storm Charge.',
    'Sleep in a bed you own or have rented to wake Refreshed.',
    'Guards remember what you did. Pay your fines or find another town.',
    'Innkeepers hear every rumour; ask them about places worth exploring.',
    'Hone weapons at a whetstone and armour at a bench to improve them.',
];

const app = {
    mode: 'loading',
    world: null, view: null, input: null, audio: null, hud: null, ui: null, saves: null,
    settings: { ...DEFAULT_SETTINGS },
    paused: false,
    acc: 0, fps: 60, frames: 0, fpsT: 0,
    isTouch: IS_TOUCH,
    pristine: null,
    lastAutosave: 0,
    loading: false,
    playT: 0,
    get inCombat() { return !!this.world?.player.inCombat; },
    get touchUse() { return $('t-use'); },

    // ------------------------------------------------------------ menu plumbing used by the UI
    setPaused(on, keepRunning = false) {
        this.paused = on && !keepRunning;
        document.body.classList.toggle('menu-open', on);
    },
    openMenu(name) {
        if (this.mode !== 'play') return;
        const map = { inventory: 'inventory', magic: 'magic', skills: 'skills', map: 'map', journal: 'journal', system: 'system' };
        if (name === 'system') this.ui.show('journal', 'system');
        else if (map[name]) this.ui.show(map[name]);
    },
    fade(fn) {
        const f = $('fade');
        f.classList.add('on');
        return new Promise((resolve) => setTimeout(() => {
            try { fn?.(); } catch (e) { console.error(e); }
            requestAnimationFrame(() => requestAnimationFrame(() => { f.classList.remove('on'); resolve(); }));
        }, 460));
    },
    equip(entry, hand = 'right') {
        const p = this.world.player, d = itemDef(entry);
        equip(p, entry, hand);
        if (d?.type === 'weapon' || d?.type === 'torch') p.hands[hand] = null;
        if (d?.two) { p.hands.left = null; p.hands.right = null; }
        p.dirty = true;
        this.audio.ui('equip');
    },
    afterWait() { this.autosave(true); },

    // ------------------------------------------------------------ settings
    loadSettings() {
        try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (s) Object.assign(this.settings, s); } catch { /* storage unavailable */ }
    },
    saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ } },
    applySettings() {
        const s = this.settings;
        this.audio?.setVolumes(s);
        if (this.input) { this.input.sens = s.sensitivity; this.input.invertY = s.invertY; }
        if (this.view) {
            this.view.rig.baseFov = s.fov;
            const tier = s.quality ?? this.autoTier;
            if (tier !== this.view.r.tier) this.view.setTier(tier);
        }
        if (this.world) this.world.difficulty = s.difficulty;
        if (this.hud) this.hud.subtitlesOn = s.subtitles;
        if (this.world && s.thirdPerson != null && this.mode === 'play') this.world.player.third = s.thirdPerson;
    },

    // ------------------------------------------------------------ saving and loading
    autosave(force = false) {
        if (this.mode !== 'play' || this.loading || this.world.player.dead) return;
        const now = performance.now();
        if (!force && now - this.lastAutosave < 300000) return;
        this.lastAutosave = now;
        if (this.saves.save(null, 'auto')) this.hud?.note('Autosaved', 'dim');
    },
    loadSlot(slot) {
        const data = this.saves.load(slot);
        if (!data) { this.ui.toast('That save could not be read.'); return; }
        this.loadData(data);
    },
    loadLatest() {
        const s = this.saves.latest();
        if (s) this.loadSlot(s.slot); else this.toTitle();
    },
    loadData(data) {
        this.loading = true;
        this.fade(() => {
            this.ui.closeAll();
            applySave(this.world, data);
            this.afterWorldChange();
            this.startPlay();
            this.loading = false;
            this.lastAutosave = performance.now();
        });
    },
    afterWorldChange() {
        const w = this.world;
        this.view.rig.override = null;
        this.view.onEvents(w.drain());
        this.view.enterCell(w.cellId !== 'ext');
        this.view.actors.syncAll();
        this.applySettings();
    },
    toTitle() {
        this.ui.closeAll();
        this.fade(() => {
            applySave(this.world, this.pristine);
            this.afterWorldChange();
            this.showTitle();
        });
    },

    // ------------------------------------------------------------ character creation preview
    previewLook(look) {
        const w = this.world, p = w.player;
        if (look.kin !== p.sheet.kin) { p.sheet = makeSheet(look.kin); p.dirty = true; recalc(p); }
        p.look = { ...look };
        this.view.actors.remove(p);
        this.view.actors.add(p);
    },
};
window.__fm = app;

function setLoad(p, msg) {
    $('load-bar').style.width = `${Math.round(p * 100)}%`;
    if (msg) $('load-msg').textContent = msg;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function generateTerrain() {
    return new Promise((resolve) => {
        let worker;
        try { worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' }); } catch { worker = null; }
        if (!worker) { resolve(new Terrain().generate()); return; }
        let done = false;
        worker.onmessage = (e) => {
            if (e.data.progress != null) setLoad(e.data.progress * 0.6, 'Carving the mountains…');
            if (e.data.done) { done = true; worker.terminate(); resolve(terrainFromData(e.data.data)); }
        };
        worker.onerror = () => { if (!done) { worker.terminate(); resolve(new Terrain().generate()); } };
        worker.postMessage('go');
    });
}

async function boot() {
    document.body.classList.toggle('touch', IS_TOUCH);
    $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    app.loadSettings();
    setLoad(0.02, 'Carving the mountains…');
    const terrain = await generateTerrain();
    setLoad(0.62, 'Raising the sky…');
    await nextFrame();
    const world = new World({ terrain, difficulty: app.settings.difficulty });
    app.world = world;
    app.pristine = serialize(world);
    const view = new WorldView($('gl'), world);
    app.view = view;
    app.autoTier = FORCE_Q ?? (IS_TOUCH ? 2 : 1);
    const tier = app.settings.quality ?? app.autoTier;
    view.r.setTier(tier, false);
    let k = 0;
    for (const step of view.buildSteps()) {
        k++;
        setLoad(0.62 + k * 0.1, `Building the ${step}…`);
        await nextFrame();
    }
    view.setTier(tier);
    app.input = new Input($('gl'));
    if (IS_TOUCH) app.input.bindTouch($('touch'));
    app.input.onUnlock = () => { if (app.mode === 'play' && !app.ui.open && !app.world.player.dead) app.openMenu('system'); };
    app.audio = new Audio();
    app.saves = new Saves(app);
    app.ui = new UI(app);
    app.hud = new Hud(app);
    registerPanels();
    app.applySettings();
    // the first gesture anywhere unlocks sound
    const unlock = () => { app.audio.unlock(); app.audio.setVolumes(app.settings); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    bindTitle();
    setLoad(1, 'Ready');
    view.update(0.016);
    await nextFrame();
    $('loading').classList.add('hidden');
    showTitle();
    requestAnimationFrame(frame);
}

function registerPanels() {
    const u = app.ui;
    u.register('ring', (ui) => new RingPanel(ui));
    u.register('wait', (ui, sleep) => new WaitPanel(ui, sleep));
    u.register('death', (ui) => new DeathPanel(ui));
    u.register('settings', (ui) => new SettingsPanel(ui));
    u.register('credits', (ui) => new CreditsPanel(ui));
    u.register('saves', (ui, mode) => new SavesPanel(ui, mode));
    u.register('chargen', (ui, done) => new CharGenPanel(ui, done));
    u.register('inventory', (ui) => new InventoryPanel(ui));
    u.register('container', (ui, src) => new ContainerPanel(ui, src));
    u.register('barter', (ui, npc, m) => new BarterPanel(ui, npc, m));
    u.register('pickpocket', (ui, t) => new PickpocketPanel(ui, t));
    u.register('magic', (ui) => new MagicPanel(ui));
    u.register('skills', (ui) => new SkillsPanel(ui));
    u.register('train', (ui, trainer) => new SkillsPanel(ui, trainer));
    u.register('map', (ui) => new MapPanel(ui));
    u.register('journal', (ui, tab) => new JournalPanel(ui, tab));
    u.register('station', (ui, st) => new StationPanel(ui, st));
    u.register('alchemy', (ui) => new AlchemyPanel(ui));
    u.register('rune', (ui) => new RunePanel(ui));
    u.register('lock', (ui, target) => new LockPanel(ui, target));
    u.register('book', (ui, entry) => new BookPanel(ui, entry));
    u.register('favorites', (ui) => new FavoritesPanel(ui));
    u.register('talk', (ui, actor, arrest) => new DialoguePanel(ui, actor, arrest));
    u.register('trade', (ui, a) => new ContainerPanel(ui, actorSource(a)));
}

/** A corpse or companion seen through the container menu. */
function actorSource(a) {
    return { get inv() { return a.inv; }, get gold() { return a.gold || 0; }, set gold(v) { a.gold = v; }, name: a.name, actor: a, owner: null };
}

// ------------------------------------------------------------------ title and new game
function bindTitle() {
    $('t-new').addEventListener('click', () => { app.audio.unlock(); newGame(); });
    $('t-continue').addEventListener('click', () => { app.audio.unlock(); app.loadLatest(); });
    $('t-load').addEventListener('click', () => app.ui.show('saves', 'load'));
    $('t-settings').addEventListener('click', () => app.ui.show('settings'));
    $('t-credits').addEventListener('click', () => app.ui.show('credits'));
}

function showTitle() {
    app.mode = 'title';
    const w = app.world;
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    $('title').classList.remove('hidden');
    document.body.classList.remove('playing');
    app.input.wantLock = false;
    app.input.exitLock();
    const last = app.saves.latest();
    $('t-continue').classList.toggle('hidden', !last);
    if (last) $('t-cont-info').textContent = `${last.meta.name} · Level ${last.meta.level} · ${last.meta.place}`;
    // a slow flight over Pinebrook toward the mountain
    w.time.hour = 17.2;
    const L = LOC.pinebrook;
    w.placePlayer(L.x, L.z, 0);
    app.titleT = 0;
}

function titleCamera(dt) {
    // a slow glide across Lake Ilinalta toward Mount Hrimgard
    const w = app.world;
    app.titleT += dt;
    const k = (app.titleT * 2.2) % 260;
    const x = -620 + k, z = 1215 - k * 0.35;
    const y = Math.max(w.terrain.heightAt(x, z), w.terrain.waterAt(x, z)) + 24;
    app.view.rig.override = { pos: { x, y, z }, look: { x: 180, y: y + 190, z: 640 }, speed: 3 };
    w.player.pos.x = x; w.player.pos.z = z; w.player.pos.y = y - 20;
}

function newGame() {
    $('title').classList.add('hidden');
    const w = app.world;
    applySave(w, app.pristine);
    app.afterWorldChange();
    const p = w.player;
    // stand on the cart road below Hollowmere at dusk, the keep ahead
    w.placePlayer(-248, 1176, Math.PI);
    w.time.hour = 17.6; w.time.total = 17.6;
    p.third = true;
    app.view.actors.showPlayer = true;
    app.mode = 'chargen';
    const camAt = () => { const f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }; app.view.rig.override = { pos: { x: p.pos.x + f.x * 2.3, y: p.pos.y + 1.55, z: p.pos.z + f.z * 2.3 }, look: { x: p.pos.x, y: p.pos.y + 1.35, z: p.pos.z }, speed: 4 }; };
    camAt();
    app.ui.show('chargen', ({ name, look }) => {
        p.name = name.trim() || 'Courier';
        app.previewLook(look);
        p.sheet.level = 1;
        addItem(p, { id: 'sealed_letter' }, 1);
        addItem(p, { id: 'bread' }, 2);
        addItem(p, { id: 'potion_restoreHealth_0' }, 1);
        p.gold = 25;
        recalc(p); p.hp = p.hpMax; p.mp = p.mpMax; p.sp = p.spMax;
        p.third = app.settings.thirdPerson ?? IS_TOUCH;
        app.view.rig.override = null;
        w.quests.start('mq01');
        app.startPlay();
        app.hud.banner('The Frostmarch', 'Autumn, the last cart of the year');
        app.hud.subtitle('Driver', 'This is as far as the cart goes, courier. Hollowmere Keep is just up the road. Mind the dark.', 6);
        setTimeout(() => app.autosave(true), 4000);
    });
}

app.startPlay = function startPlay() {
    app.mode = 'play';
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (IS_TOUCH) $('touch').classList.remove('hidden');
    document.body.classList.add('playing');
    app.input.wantLock = !IS_TOUCH;
    app.view.rig.override = null;
    app.playT = 0;
};
app.showTitle = showTitle;

// ------------------------------------------------------------------ world events → menus
function onWorldEvent(e) {
    const w = app.world, p = w.player, u = app.ui;
    switch (e.type) {
        case 'openContainer':
            if (e.actor) u.show('container', actorSource(e.actor));
            else { const c = e.container; c.name = e.name || c.name; u.show('container', c); }
            break;
        case 'talk': u.show('talk', e.actor); break;
        case 'arrest': if (!u.open) u.show('talk', e.guard, { guard: e.guard, town: e.town }); break;
        case 'pickpocket': u.show('pickpocket', e.actor); break;
        case 'useDoor':
            app.fade(() => { w.travelDoor(e.door); app.view.onEvents(w.drain()); app.autosave(true); });
            break;
        case 'station': {
            const t = e.station.type;
            if (t === 'alchemy') u.show('alchemy');
            else if (t === 'runetable') u.show('rune');
            else u.show('station', e.station);
            break;
        }
        case 'locked': {
            const target = e.container
                ? { level: e.container.locked, owner: e.container.owner, onOpen: () => { e.container.locked = 0; if (e.container.owner && !w.isOwnerOk(e.container.owner)) w.crime('lockpick', e.container.owner, 0); u.show('container', Object.assign(e.container, { name: e.focus?.name || e.container.name })); } }
                : { level: e.door.locked, owner: e.door.loc, onOpen: () => { w.flags[`unlocked:${e.door.id}`] = true; if (e.door.loc && !w.isOwnerOk(e.door.loc)) w.crime('trespass', e.door.loc, 0); w.emit('useDoor', { door: e.door }); } };
            const key = e.door && p.inv.find((x) => x.id === e.door.key);
            if (key) { target.onOpen(); break; }
            u.show('lock', target);
            break;
        }
        case 'bed': {
            const rented = (w.flags.rented || 0) > w.time.total;
            if (e.owner && !w.isOwnerOk(e.owner) && !rented && !/inn/.test(w.cellId)) { app.hud.note('This bed belongs to someone else.'); break; }
            if (e.owner && /inn/.test(w.cellId) && !rented) { app.hud.note('Rent a room from the innkeeper to sleep here.'); break; }
            u.show('wait', true);
            break;
        }
        case 'readBook': u.show('book', e.entry); break;
        case 'playerDeath': setTimeout(() => { if (p.dead) u.show('death'); }, 2600); break;
        case 'levelUp': { const r = growAttributes(p.sheet); if (r) { p.dirty = true; recalc(p); } break; }
        case 'sign': app.hud.note(`Signpost: ${(e.to || []).map((id) => LOC[id]?.name).filter(Boolean).join(' · ')}`); break;
        case 'mount': app.hud.note('The horse shies away. It is not yours to ride.'); break;
        case 'fastTravel': app.view.onEvents([{ type: 'cellChanged', interior: false }]); app.autosave(true); break;
        case 'questDone': setTimeout(() => app.autosave(true), 1500); break;
        case 'crimeSeen': app.hud.note(`Your crime was seen. Bounty in ${LOC[e.town]?.name || e.town}: ${e.bounty} gold`, 'bad'); break;
        case 'recruit': app.hud.note(`${e.actor.name} is now following you.`); break;
        case 'dismiss': app.hud.note(`${e.actor.name} has stopped following you.`); break;
        case 'mapMarked': app.hud.note(`${LOC[e.loc]?.name} added to your map`, 'quest'); break;
        case 'gameComplete':
            app.hud.banner('The Storm Breaks', 'Vyrthax is no more');
            setTimeout(() => { app.hud.subtitle(null, 'The sky over the Frostmarch is quiet. The roads, the barrows, and the rest of your life are yours to walk.', 9); app.autosave(true); }, 6000);
            setTimeout(() => app.ui.show('credits'), 16000);
            break;
    }
}

function handlePlayKeys(snap) {
    if (app.ui.open || app.mode !== 'play') return;
    const w = app.world, p = w.player, pr = snap.pressed;
    if (p.dead) return;
    if (pr.has('tween')) app.ui.show('ring');
    for (const m of ['inventory', 'map', 'journal', 'magic', 'skills']) if (pr.has(m)) app.openMenu(m);
    if (pr.has('pause') || pr.has('back2')) app.openMenu('system');
    if (pr.has('wait')) { if (app.inCombat) app.hud.note('You cannot wait with enemies nearby.'); else app.ui.show('wait', false); }
    if (pr.has('favorites')) app.ui.show('favorites');
    if (pr.has('quicksave')) { if (app.saves.save(null, 'quick')) app.hud.note('Quicksaved'); }
    if (pr.has('quickload')) { const d = app.saves.load('quick'); if (d) app.loadData(d); else app.hud.note('No quicksave yet.'); }
    if (pr.has('debug') && DEBUG) $('debug-info').classList.toggle('hidden');
    for (let i = 1; i <= 8; i++) {
        if (!pr.has(`hot${i}`)) continue;
        const id = p.favorites[i - 1];
        if (!id) continue;
        if (p.spells.includes(id)) { p.hands.right = id; if (itemDef(p.equip.right)?.type === 'weapon') p.equip.right = null; p.dirty = true; app.hud.note(`Right hand: ${id}`); }
        else { const e = p.inv.find((x) => x.id === id); if (e) { const d = itemDef(e); if (['weapon', 'armor', 'jewelry', 'ammo', 'torch'].includes(d.type)) app.equip(e); else w.useItem(e); } }
    }
}

// ------------------------------------------------------------------ the frame loop
let last = performance.now();
let lowFpsT = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const dt = Math.min(rdt, 0.05);
    const { world, view, input } = app;
    app.frames++; app.fpsT += rdt;
    if (app.fpsT > 0.5) { app.fps = app.frames / app.fpsT; app.frames = 0; app.fpsT = 0; }

    const snap = input.consume(dt);
    app.ui.update(dt, snap);
    const ticking = (app.mode === 'play' || app.mode === 'chargen') && !app.paused;
    if (ticking) {
        handlePlayKeys(snap);
        const control = app.mode === 'play' && !app.ui.open;
        // presses and releases on a frame that runs no sim step (high-refresh screens, jitter) wait
        // for the next step instead of being lost; so does look movement
        const pend = app.pending || (app.pending = { pressed: new Set(), released: new Set(), dx: 0, dy: 0 });
        for (const k of snap.pressed) pend.pressed.add(k);
        for (const k of snap.released) pend.released.add(k);
        pend.dx += snap.look.dx; pend.dy += snap.look.dy;
        app.acc += dt * FAST;
        let first = true, steps = 0;
        while (app.acc >= STEP && steps < 4 * FAST) {
            const inp = first ? { ...snap, pressed: pend.pressed, released: pend.released, look: { dx: pend.dx, dy: pend.dy } } : { ...snap, look: { dx: 0, dy: 0 }, pressed: new Set(), released: new Set() };
            world.tick(STEP, control ? inp : null);
            if (first) app.pending = null;
            first = false;
            app.acc -= STEP; steps++;
        }
        if (!control) app.pending = null;
        if (steps >= 4 * FAST) app.acc = 0;
        app.playT += dt;
    } else if (app.mode === 'title') titleCamera(dt);
    const evs = world.drain();
    view.onEvents(evs);
    for (const e of evs) { app.audio.onEvent(e, world); app.hud.onEvent(e); onWorldEvent(e); }
    view.update(dt, { wheel: snap.wheel });
    if (app.mode === 'chargen') view.actors.showPlayer = true;
    view.render(dt);
    app.audio.update(dt, world, view.camera, !ticking);
    if (app.mode === 'play') app.hud.update(rdt);   // real time: notes and subtitles fade on schedule even when frames are slow
    // automatic quality: step down if the frame rate stays low
    if (app.mode === 'play' && app.settings.quality == null && app.playT > 8) {
        lowFpsT = app.fps < 28 ? lowFpsT + rdt : Math.max(0, lowFpsT - rdt * 0.5);
        if (lowFpsT > 5 && view.r.tier < QUALITY.length - 1) { lowFpsT = 0; app.autoTier = view.r.tier + 1; view.setTier(app.autoTier); app.ui.toast(`Graphics lowered to ${QUALITY[app.autoTier].name} for smoother play.`); }
    }
    if (app.mode === 'play' && world.cellId === 'ext' && app.playT > 30) app.autosave(false);
    if (DEBUG) {
        const p = world.player;
        $('debug-info').classList.remove('hidden');
        $('debug-info').textContent = `${app.fps.toFixed(0)} fps  tier ${view.r.tier}  calls ${view.r.gl.info.render.calls}  tris ${(view.r.gl.info.render.triangles / 1000).toFixed(0)}k\n` +
            `pos ${p.pos.x.toFixed(1)} ${p.pos.y.toFixed(1)} ${p.pos.z.toFixed(1)}  ${world.cellId}  ${world.region}  ${world.time.hour.toFixed(2)}h  ${world.weather.type}`;
    }
}

boot().catch((e) => {
    console.error(e);
    $('load-msg').textContent = 'Something went wrong: ' + e.message;
});
