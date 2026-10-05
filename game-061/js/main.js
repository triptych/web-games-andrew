// STARWRIGHT — boot, the mode machine and the fixed-step loop.
//   title → (new voyage | continue) → docked ⇄ flight ⇄ menus/maps → warp → flight …
// The sim (js/sim) runs at 1/60 s; events drain once per frame into the view, audio and HUD.
// ?debug=1 exposes window.__sw for tests; ?seed=TEXT starts a voyage in that universe.

import { SIM_DT, ITEMS } from './config.js';
import { Game } from './sim/game.js';
import { World } from './sim/world.js';
import { storyNav } from './sim/story.js';
import { questNav } from './sim/quests.js';
import { randomSeedText, hashStr } from './rng.js';
import { View } from './view/view.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Maps } from './ui/maps.js';
import { $ } from './ui/dom.js';
import { portrait } from './view/portrait.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(20, parseInt(params.get('fast') || '1', 10) || 1));

const settings = store.loadSettings();
const canvas = $('gl');
const view = new View(canvas);
const input = new Input(canvas);
const hud = new HUD(view, input);
const maps = new Maps(audio);

const app = {
    game: null, world: null, mode: 'title', audio, settings, nav: { kind: 'story' },
    toast: (t, k) => hud.toast(t, k),
};
const menus = new Menus(app);
view.game = null;

// ------------------------------------------------------------------ settings
app.applySettings = () => {
    audio.setVolumes({ music: settings.music, sfx: settings.sfx, muted: settings.muted });
    input.settings.mouseSteer = settings.mouseSteer;
    input.settings.invertY = settings.invertY;
    if (settings.quality === 'auto') { view.r.auto = true; view.r.setTier(input.isTouch ? 2 : 1); }
    else view.r.setTier(parseInt(settings.quality, 10), true);
    view.fx.setBudget(view.r.T.particles);
    store.saveSettings(settings);
};

// ------------------------------------------------------------------ layout
function relayout() { view.resize(innerWidth, innerHeight); }
addEventListener('resize', relayout);
window.visualViewport?.addEventListener('resize', relayout);
relayout();
document.body.classList.toggle('touch', input.isTouch);

const unlock = () => { audio.init(); audio.applyVolume(); };
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ modes
function setMode(m) {
    app.mode = m;
    const flying = m === 'flight';
    hud.show(flying || m === 'warp');
    $('touch').classList.toggle('hidden', !(flying && input.isTouch));
    document.body.classList.toggle('playing', m !== 'title');
    input.blockGame = !flying;
    if (m !== 'flight') { input.keys.clear(); input.mouse.left = input.mouse.right = false; input.touch.buttons.clear(); }
    input.clearEdges();
}

function loadWorld(game, mode) {
    app.game = game;
    view.game = game;
    app.world = new World(game, mode);
    view.enterSystem(app.world);
    view.snapNext = true;
    view.camT = 0;
    audio.setSystem(app.world.sys.sky.seed);
    pickDefaultTarget();
}

app.previewSeed = (seed) => {
    const g = Game.create(seed);
    loadWorld(g, 'docked');
    app.world.dockedId = `${g.galaxy.home}:S0`;
};

app.toTitle = () => {
    setMode('title');
    menus.close();
    maps.close();
    const save = store.loadGame();
    if (!app.game || app.game.saved) app.previewSeed(save?.seed || randomSeedText());
    audio.setMood('title');
    menus.showTitle(save);
};

app.newGame = (seed, name) => {
    const g = Game.create(seed);
    g.s.ship.name = name;
    g.saved = true;
    menus.hideTitle();
    menus.close();
    loadWorld(g, 'docked');
    app.nav = { kind: 'story' };
    save();
    enterDocked(true);
    hud.banner(g.galaxy.systems[g.galaxy.home].name.toUpperCase(), `Seed ${g.s.seed}`, '', 4);
    hud.toast('Welcome aboard, Wright. Check the STORY tracker on the right.', 'info');
};

app.continueGame = () => {
    const s = store.loadGame();
    if (!s) return app.newGame(randomSeedText(), 'Wren');
    let g;
    try { g = new Game(s); } catch (e) { console.warn('Save could not be loaded:', e); return app.newGame(s.seed || randomSeedText(), 'Wren'); }
    g.saved = true;
    menus.hideTitle();
    menus.close();
    loadWorld(g, g.s.location.docked ? 'docked' : 'arrive');
    if (g.s.location.docked) enterDocked(true);
    else { setMode('flight'); audio.setMood('space'); }
};

function save() {
    if (!app.game?.saved) return;
    if (app.world && !app.world.docked && !app.world.player.dead) app.game.s.location.docked = null;
    store.saveGame(app.game.serialize());
}

function enterDocked(quiet = false) {
    setMode('docked');
    const st = app.game.dockedStation();
    if (!st) { setMode('flight'); return; }
    audio.setMood('docked');
    audio.setCombat(false);
    if (st.kind === 'hearth') menus.open('hearth');
    else { menus.open('station'); if (!quiet) audio.comm(app.game.galaxy.species[st.species].voice); }
    save();
}

app.undock = () => {
    menus.close();
    app.world.undock();
    setMode('flight');
    audio.setMood('space');
    audio.undock();
    pickDefaultTarget(true);
    save();
};

app.closeMenu = () => {
    maps.close();
    if (app.world?.docked && app.game?.dockedStation()) { menus.close(); enterDocked(true); return; }
    menus.close();
    setMode('flight');
};

app.openMenu = (kind, opts) => { maps.close(); setMode('menu'); menus.open(kind, opts); };
app.openMap = (kind) => {
    menus.close();
    setMode('map');
    maps.canWarpNow = () => !app.world.docked && !app.world.player.dead && !app.world.warp;
    maps.open(kind, app.game, app.world);
};
maps.onClose = () => app.closeMenu();
maps.onWarp = (id) => {
    const c = app.game.warpCheck(id);
    if (!c.ok) { hud.toast(c.why, 'warn'); audio.error(); return; }
    app.closeMenu();
    app.world.startWarp(id, c.cost);
    app.warpTarget = id;
};
maps.onRecall = () => {
    const c = app.game.recallCheck();
    if (!c.ok) { hud.toast(c.why, 'warn'); return; }
    app.closeMenu();
    app.world.startWarp(app.game.galaxy.home, c.cost, true);
};
maps.onTarget = (id, cruise) => {
    app.closeMenu();
    app.world.setTarget(id);
    if (cruise) app.world.toggleCruise();
};

app.quitToTitle = () => { save(); app.game.saved = true; app.game = null; app.toTitle(); };

app.respawn = () => {
    menus.close();
    loadWorld(app.game, 'docked');
    enterDocked(true);
};

app.track = (nav) => { app.nav = nav; pickDefaultTarget(true); };
hud.onTrack = (nav) => { audio.click(); app.track(nav); };
app.onMenuAction = () => { if (app.world) view.refreshHearth(app.world); };

// Nav objective → current system target.
function navObjective() {
    const G = app.game;
    if (!G) return null;
    let n = null;
    if (app.nav.kind === 'quest') { const q = G.s.quests.find((x) => x.id === app.nav.id); if (q) n = questNav(G, q); else app.nav = { kind: 'story' }; }
    if (!n) n = storyNav(G);
    if (!n) return null;
    return { ...n, kind: app.nav.kind, id2: app.nav.id, here: n.system === G.s.location.system && !!n.id && !!app.world?.findNav(n.id) };
}
function pickDefaultTarget(force = false) {
    const w = app.world;
    if (!w) return;
    const n = navObjective();
    if (n?.here && (force || !w.target)) w.target = n.id;
}

// ------------------------------------------------------------------ events
function handleEvent(e) {
    const G = app.game;
    const w = app.world;
    view.onEvent(e, w);
    switch (e.type) {
        case 'toast': hud.toast(e.text, e.kind || 'info'); break;
        case 'quest': hud.toast(e.text, 'info'); break;
        case 'questDone': hud.toast(e.text, 'good'); hud.banner('MISSION COMPLETE', e.q.title, '', 2.5); audio.quest(); pickDefaultTarget(true); break;
        case 'story':
            audio.story();
            hud.toast(e.text, 'good');
            hud.banner(e.next ? `CHAPTER ${G.s.story.stage + 1}` : 'THE END… AND BEYOND', e.next ? e.next.title : 'The Lattice is awake', 'violet', 4);
            app.nav = { kind: 'story' };
            pickDefaultTarget(true);
            if (e.next?.id === 'echoes') setTimeout(() => hud.banner('THE SIGNAL', 'A chord from the galactic core…', 'violet', 4), 4200);
            break;
        case 'shard': hud.banner('PRECURSOR SHARD', `${e.n} of 3 recovered`, 'violet', 4); audio.shard(); break;
        case 'met': {
            const sp = G.galaxy.species[e.species];
            hud.banner('FIRST CONTACT', sp.gov, '', 3.5);
            hud.toast(e.text, 'data');
            audio.comm(sp.voice);
            portrait(sp, 192);
            break;
        }
        case 'standing': {
            const sp = G.galaxy.species[e.species];
            if (e.delta > 0 && Math.floor(e.value) % 25 < 5 && e.value >= 25) hud.toast(`The ${sp.name} think well of you (${Math.round(e.value)})`, 'good');
            break;
        }
        case 'ambush': hud.alert(e.text, 4); audio.alarm(); if (e.boss) hud.banner('WARNING', e.text, 'danger', 3.5); break;
        case 'interdict': hud.banner('INTERDICTED', 'Hostiles pulled you out of cruise', 'danger', 3); audio.alarm(); break;
        case 'cruise':
            if (e.state === 'charge') audio.cruiseCharge();
            else if (e.state === 'on') audio.cruiseOn();
            else if (e.state === 'off') audio.cruiseOff();
            else if (e.state === 'denied') audio.denied();
            break;
        case 'fire': audio.laser(e.plasma); break;
        case 'efire': audio.elaser(e.faction); break;
        case 'hit': audio.hit(e.shield); break;
        case 'ehit': audio.ehit(); break;
        case 'explode': audio.explosion(e.size); break;
        case 'mine': audio.ore(G.s.stats.minedTotal); break;
        case 'rockBreak': audio.rockBreak(); break;
        case 'pickup': {
            audio.pickup();
            const parts = Object.entries(e.got).map(([k, n]) => (k === 'credits' ? `${n} cr` : `${n} ${ITEMS[k].name}`));
            hud.toast(`Collected ${parts.join(', ')}`, 'ore');
            break;
        }
        case 'scanStart': audio.scanStart(); break;
        case 'scanDone': audio.scanDone(); hud.toast(e.text, e.value ? 'data' : 'good'); w?.refreshExtras?.(); break;
        case 'scoop': hud.toast(e.text, 'info'); break;
        case 'overheat': audio.overheat(); break;
        case 'shieldDown': audio.shieldDown(); hud.alert('SHIELDS DOWN', 2); break;
        case 'upgrade': hud.toast(e.text, 'good'); break;
        case 'built': hud.toast(e.text, 'good'); break;
        case 'research': hud.toast(e.text, 'data'); break;
        case 'dock': audio.dock(); enterDocked(); break;
        case 'warpCharge': audio.warpCharge(); hud.toast('Warp drive charging…', 'info'); break;
        case 'warpGo': startWarpSequence(e.target, e.cost); break;
        case 'death':
            audio.setCombat(false);
            hud.banner('SHIP DESTROYED', '', 'danger', 3);
            setTimeout(() => {
                if (app.world !== w) return;
                const r = G.die();
                save();
                setMode('menu');
                menus.open('death', r);
            }, 2600);
            break;
        case 'ending':
            hud.banner('THE LATTICE AWAKENS', '', 'violet', 5);
            audio.shard();
            view.flash = 1;
            setTimeout(() => { save(); setMode('menu'); menus.open('ending'); }, 3500);
            break;
        default: break;
    }
}

// ------------------------------------------------------------------ warp sequence
let warpSeq = null;
function startWarpSequence(target, cost) {
    if (warpSeq) return;
    warpSeq = { target, cost, t: 0, arrived: false };
    setMode('warp');
    audio.warpJump();
    audio.setMood('warp');
}
function stepWarp(dt) {
    const s = warpSeq;
    s.t += dt;
    if (s.t < 1.6) view.warpK = Math.min(1, s.t / 0.8);
    else if (!s.arrived) {
        s.arrived = true;
        const G = app.game;
        view.flash = 1;
        G.arrive(s.target, s.cost);
        loadWorld(G, 'arrive');
        audio.arrive();
        const meta = G.sysMeta;
        hud.banner(meta.name.toUpperCase(), meta.owner >= 0 ? G.galaxy.species[meta.owner].gov : meta.pirate ? 'Reaver haven: danger' : meta.star === 'core' ? 'The galactic core' : 'Unclaimed space', meta.pirate || meta.danger >= 3 ? 'danger' : '', 4);
        save();
    } else {
        view.warpK = Math.max(0, view.warpK - dt * 1.4);
        if (view.warpK <= 0) { warpSeq = null; setMode('flight'); audio.setMood('space'); }
    }
}

// ------------------------------------------------------------------ tips
function tipFor() {
    if (!settings.tips || !app.game) return null;
    const G = app.game, w = app.world;
    const touch = input.isTouch;
    const st = G.s.story.stage;
    const K = (k, t) => `<b>${touch ? t : k}</b>`;
    if (st === 0) {
        if (G.cargoOf('ferrite') >= 20 || G.cargoFree() === 0) return `Hold loaded! ${K('T', 'TGT')} to target Hearth, ${K('C', 'CRUISE')} to fly home, then ${K('E', 'ACT')} to dock and unload.`;
        if ([...w.rocks()].some((r) => Math.hypot(r.pos.x - w.player.pos.x, r.pos.y - w.player.pos.y, r.pos.z - w.player.pos.z) < 700)) return `Aim at a rock (${touch ? 'drag left side' : 'move the mouse'}), close in and hold ${K('Q / right-click', 'MINE')}. Watch the laser heat.`;
        return `The belt is targeted. Press ${K('C', 'CRUISE')} to fly there on autopilot (fly clear of Hearth first).`;
    }
    if (st === 3 && G.s.stats.planetsScanned < 3 && w.ctx?.kind !== 'scan') return `Target a planet (${K('T', 'TGT')} or the system map), cruise close, then hold ${K('E', 'ACT')} to scan it.`;
    if (st === 4 && G.s.ship.comps.warp >= 1 && G.s.stats.jumps === 0) return `Open the ${K('Galaxy Map (G)', 'MAP')}, tap a star inside the cyan ring and ENGAGE WARP. Fill your tank at Hearth first.`;
    return null;
}

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, saveT = 0, tipT = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(DEBUG ? 0.2 : 0.05, Math.max(0, raw));
    fpsT += raw; fpsN++;
    if (fpsT >= 1) { view.r.sampleFps(fpsN / fpsT); view.fx.setBudget(view.r.T.particles); fpsT = 0; fpsN = 0; }
    try { tick(dt); } catch (err) { console.error(err); }
}

function tick(dt) {
    const G = app.game, w = app.world;
    const m = app.mode;
    // Global hotkeys
    if (input.consume('mute')) { settings.muted = audio.toggleMute(); store.saveSettings(settings); hud.toast(settings.muted ? 'Sound muted' : 'Sound on', 'info'); }
    if (input.edges.has('pause')) {
        input.consume('pause');
        if (m === 'flight') { app.openMenu('pause'); audio.click(); }
        else if (m === 'menu' || m === 'map') { audio.click(); if (menus.kind === 'death' || menus.kind === 'ending') { /* modal */ } else app.closeMenu(); }
        else if (m === 'docked') app.openMenu('pause');
    }
    if (m === 'flight') {
        if (input.consume('map')) app.openMap('galaxy');
        else if (input.consume('sys')) app.openMap('system');
        else if (input.consume('log')) app.openMenu('journal');
        else if (input.consume('warp')) { if (app.warpTarget != null) maps.onWarp(app.warpTarget); else app.openMap('galaxy'); }
    } else if (m === 'map') {
        if (input.consume('map') || input.consume('sys')) app.closeMenu();
    }

    // Sim
    const running = (m === 'flight' || m === 'docked' || m === 'title' || (m === 'warp' && !warpSeq?.arrived)) && w;
    if (running) {
        const snap = input.snapshot(innerWidth, innerHeight, w.player.throttle);
        acc += dt * FAST;
        let steps = 0;
        while (acc >= SIM_DT && steps < 8 * FAST) {
            w.step(snap, SIM_DT);
            snap.interactPressed = false; snap.cruise = false; snap.targetNext = 0; snap.throttleSet = snap.throttleSet ?? null;
            acc -= SIM_DT;
            steps++;
            if (w.warp?.done || w.player.dead && steps > 1) break;
        }
        if (steps >= 8 * FAST) acc = 0;
        input.consume('interact'); input.consume('cruise'); input.consume('target');
    }
    if (warpSeq) stepWarp(dt);

    // Events
    if (G) {
        const evs = G.fx.splice(0);
        if (app.mode !== 'title') for (const e of evs) handleEvent(e);
    }
    // Combat music
    if (w && app.mode !== 'title') audio.setCombat(w.enemies.some((e) => e.state !== 'flee' && Math.hypot(e.pos.x - w.player.pos.x, e.pos.z - w.player.pos.z) < 1800));

    const nav = navObjective();
    if (app.mode === 'flight' && w) {
        hud.update(w, G, dt, nav);
        tipT -= dt;
        if (tipT <= 0) { tipT = 0.4; hud.tip(tipFor()); }
    }
    if (app.mode === 'docked' && menus.kind && Math.floor(G.s.time) !== Math.floor(G.s.time - dt)) {
        // Live-refresh the Hearth panel so production ticks visibly (cheap: once a second).
        if (menus.kind === 'hearth' && ['overview', 'storage', 'refinery', 'research'].includes(menus.tab) && !document.activeElement?.matches?.('input')) menus.refresh();
    }
    view.update(dt, w, app.mode === 'title' ? 'title' : w?.docked ? 'docked' : 'chase', { lowHull: G && w && !w.docked && G.s.ship.hp < G.stats().hullMax * 0.25 });
    if (w && G) {
        const p = w.player;
        const st = G.stats();
        audio.updateEngine({ active: app.mode === 'flight' && !w.docked && !p.dead, thrust: p.cruise.state === 'on' ? 1.2 : p.speed / st.speed, boost: p.boosting, mining: !!p.mining && app.mode === 'flight', heat: p.heat, cruise: p.cruise.state === 'on' && app.mode === 'flight', scoop: !!p.scooping, speed: p.speed });
    }
    // Autosave
    saveT += dt;
    if (saveT > 45 && (app.mode === 'flight' || app.mode === 'docked')) { saveT = 0; save(); }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); if (app.mode === 'flight') app.openMenu('pause'); }
});
addEventListener('pagehide', save);

// HUD buttons
$('btn-map').addEventListener('click', () => { audio.click(); if (app.mode === 'flight') app.openMap('galaxy'); });
$('btn-sys').addEventListener('click', () => { audio.click(); if (app.mode === 'flight') app.openMap('system'); });
$('btn-log').addEventListener('click', () => { audio.click(); if (app.mode === 'flight') app.openMenu('journal'); });
$('btn-pause').addEventListener('click', () => { audio.click(); if (app.mode === 'flight') app.openMenu('pause'); });

// ------------------------------------------------------------------ boot
app.applySettings();
const urlSeed = params.get('seed');
if (urlSeed) app.newGame(urlSeed, 'Wren');
else app.toTitle();
requestAnimationFrame(frame);

if (DEBUG) {
    window.__sw = {
        app, view, hud, menus, maps, input, audio,
        get game() { return app.game; }, get world() { return app.world; }, get mode() { return app.mode; },
        give(id, n = 10) { app.game.s.cargo[id] = (app.game.s.cargo[id] || 0) + n; },
        store(id, n = 100) { app.game.s.base.storage[id] = (app.game.s.base.storage[id] || 0) + n; },
        credits(n = 10000) { app.game.s.credits += n; },
        god(on = true) { app.game.god = on; },
        tp(id) { const o = app.world.findNav(id); if (o) { app.world.player.pos = { x: o.pos.x + 400, y: o.pos.y + 50, z: o.pos.z + 400 }; app.world.updateClusters(true); view.snapNext = true; } return !!o; },
        warpTo(id) { app.game.s.ship.fuel = 99; startWarpSequence(id, 0); },
        snap() { view.snapNext = true; },
        hash: hashStr,
    };
}
