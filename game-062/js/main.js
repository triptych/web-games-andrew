// ROTTEN TO THE CORE — boot, the mode machine and the fixed-step loop.
//   title (town flyover) → creator (live preview) → play ⇄ panels / map → dead → play … → victory
// The sim (js/sim) runs at 1/60 s; its events drain once per frame into the view, audio and HUD.
// ?debug=1 exposes window.__rt for tests; ?fast=N runs N× simulation per frame;
// ?quick=knight|ranger|mage skips the menus with a fresh hero; ?seed=N fixes the hero seed.

import { SIM_DT } from './config.js';
import { Game, loadHero } from './sim/game.js';
import { createHero, addToInv } from './sim/hero.js';
import { makeItem } from './sim/items.js';
import { SKILLS, CLASSES } from './sim/data/classes.js';
import { floorName, actOf, TIPS, LEVELUP_LINES } from './sim/data/story.js';
import { View } from './view/view.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { HUD } from './ui/hud.js';
import { Panels } from './ui/panels.js';
import { Screens } from './ui/screens.js';
import { drawAutomap } from './ui/automap.js';
import { $, tooltip } from './ui/dom.js';
import { RNG } from './rng.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(30, parseInt(params.get('fast') || '1', 10) || 1));

const settings = store.loadSettings();
const canvas = $('gl');
const view = new View(canvas, { labels: $('labels'), floaters: $('floaters'), bars: $('bars') });
const input = new Input(canvas);
document.body.classList.toggle('touch', input.isTouch);

const app = {
    game: null, mode: 'boot', view, input, audio, settings, slot: null, demo: null,
    get world() { return this.game ? this.game.world : null; },
    toast: (t, k) => hud.toast(t, k),
};
view.loot.onClick = (id) => { if (app.mode === 'play' && !panels.any() && app.world.itemById(id)) app.world.heroInteract(id); };
const hud = new HUD(app);
const panels = new Panels(app);
const screens = new Screens(app);
app.hud = hud; app.panels = panels; app.screens = screens;

// ------------------------------------------------------------------ settings & layout
app.applySettings = () => {
    audio.setVolumes({ music: settings.music, sfx: settings.sfx, muted: settings.muted });
    if (settings.quality === 'auto') { view.r.auto = true; view.r.setTier(input.isTouch ? 2 : 1); }
    else view.r.setTier(parseInt(settings.quality, 10), true);
    view.loot.showAll = settings.labels === 'always';
    $('floaters').classList.toggle('hidden', !settings.numbers);
    store.saveSettings(settings);
};
function relayout() { view.resize(innerWidth, innerHeight); }
addEventListener('resize', relayout);
window.visualViewport?.addEventListener('resize', relayout);
relayout();
app.applySettings();
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => { audio.init(); audio.applyVolume(); }, { capture: true });

// ------------------------------------------------------------------ hero visuals
const heroSpec = (h) => ({ look: h.look, weapon: h.equip.weapon, offhand: h.equip.offhand });
app.heroChanged = () => {
    if (!app.game) return;
    app.world.refreshStats();
    view.refreshHero(heroSpec(app.game.hero));
    saveSoon();
};

// ------------------------------------------------------------------ modes
function setMode(m) {
    app.mode = m;
    const playing = m === 'play' || m === 'dead' || m === 'victory';
    hud.show(playing);
    document.body.classList.toggle('playing', m !== 'title');
    $('touch').classList.toggle('hidden', !(m === 'play' && input.isTouch));
    view.camMode = m === 'title' ? 'orbit' : m === 'creator' ? 'preview' : 'play';
    if (!playing) { $('automap').classList.add('hidden'); view.setHover(null); }
}

function demoGame() {
    const g = new Game(createHero({ name: 'Pip', cls: 'knight' }, 1));
    return g;
}

app.toTitle = () => {
    panels.closeAll();
    if (!app.demo) app.demo = demoGame();
    app.game = app.demo;
    app.world.events.length = 0;
    view.enter(app.world, heroSpec(app.game.hero));
    setMode('title');
    screens.showTitle();
    audio.music('title');
};

app.previewHero = (opts) => {
    if (!app.demo) app.demo = demoGame();
    if (app.game !== app.demo) { app.game = app.demo; view.enter(app.world, heroSpec(app.game.hero)); }
    const fresh = createHero(opts, 1);
    Object.assign(app.demo.hero, { cls: fresh.cls, look: fresh.look, equip: fresh.equip, skills: fresh.skills, bar: fresh.bar });
    app.world.refreshStats();
    const h = app.world.hero;
    h.x = 26.5; h.y = 11.6; h.intent = null; h.path = null;
    view.refreshHero(heroSpec(app.demo.hero));
    setMode('creator');
    audio.music('town');
};

app.startNew = (opts) => {
    const seed = params.get('seed') ? parseInt(params.get('seed'), 10) : (Math.random() * 2 ** 31) >>> 0;
    const hero = createHero(opts, seed);
    app.slot = store.newSlotId();
    begin(new Game(hero));
    setTimeout(() => { hud.banner('Tristrawberry', 'A sweet little town with a rotten little problem', '', 3.5); }, 200);
    setTimeout(() => hud.toast('Talk to Deckard Cane (the candy cane by the well). He always has something to say.', 'quest'), 2600);
    if (input.isTouch) setTimeout(() => hud.toast('Move with the stick. Tap things to use them. ⚔️ attacks.'), 5200);
    saveNow();
};

app.loadSlot = (id) => {
    const json = store.loadHeroJson(id);
    if (!json) { hud.toast('That save is missing.', 'warn'); return; }
    let hero;
    try { hero = loadHero(json); } catch (e) { console.warn('bad save', e); hud.toast('That save is unreadable.', 'warn'); return; }
    app.slot = id;
    begin(new Game(hero, { fresh: false }));
    hud.toast(`Welcome back, ${hero.name}.`);
};

function begin(game) {
    screens.hideAll();
    panels.closeAll();
    app.game = game;
    worldChanged();
    setMode('play');
    acc = 0;
}

app.quitToTitle = () => { saveNow(); app.slot = null; app.toTitle(); };
app.respawn = () => { app.game.respawn(); worldChanged(); setMode('play'); };
app.resume = () => setMode('play');
app.travel = (f) => { if (app.game.travel(f)) { audio.sfx('portal'); worldChanged(); } };
app.drink = (k) => { if (app.mode === 'play' && app.world.drink(k)) audio.sfx('gulp'); else if (app.game && app.game.hero.potions[k] <= 0) hud.toast(`No ${k === 'hp' ? 'Strawberry Jam' : 'Orange Juice'} left!`, 'warn'); };
app.pie = () => { if (app.mode === 'play' && app.game.usePie()) audio.sfx('portal'); };
app.toggleMap = () => { if (app.mode === 'play') $('automap').classList.toggle('hidden'); };
app.onPanels = () => { tooltip.hide(); document.body.classList.toggle('panel-open', panels.any()); };
app.worldChanged = worldChanged;

function worldChanged() {
    const w = app.world;
    view.enter(w, heroSpec(app.game.hero));
    view.camMode = app.mode === 'creator' ? 'preview' : 'play';
    const a = w.town ? null : actOf(w.floor);
    hud.setArea(floorName(w.floor), w.town ? 'Home sweet home' : `Monster level ${w.lvl}`);
    audio.music(w.town ? 'town' : a.theme);
    lastWorld = w;
    saveSoon();
}
let lastWorld = null;

// ------------------------------------------------------------------ saving
let saveT = 0, saveDirty = false;
function saveNow() {
    if (!app.game || app.game === app.demo || !app.slot) return;
    store.saveHero(app.slot, app.game.hero, app.game.serialize());
    saveDirty = false; saveT = 30;
}
function saveSoon() { saveDirty = true; if (saveT > 2) saveT = 2; }
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// ------------------------------------------------------------------ input → world
let hold = null, holdT = 0, repeatT = {}, lastNoJuice = 0, autoT = 0;
const castSlots = { Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5 };

function cursorTarget(touch = false) {
    const p = touch ? null : input.mouse;
    return p ? view.pick(p.x, p.y, app.world) : null;
}

function castAt(slot, sx, sy, hovered) {
    const w = app.world;
    const mon = hovered && hovered.kind === 'mon' ? hovered.ent : null;
    const gp = view.groundPoint(sx, sy);
    const x = mon ? mon.x : gp ? gp.x : w.hero.x, y = mon ? mon.y : gp ? gp.z : w.hero.y;
    w.heroSkill(slot, x, y, mon ? mon.id : 0);
}

/** Touch / pad auto-aim: nearest visible enemy within range, else straight ahead. */
function castAuto(slot) {
    const w = app.world, h = w.hero, g = app.game.hero;
    const id = g.bar[slot];
    if (!id) return;
    const sk = SKILLS[id];
    const range = sk.kind === 'melee' ? 6 : sk.kind === 'nova' || sk.kind === 'buff' || sk.kind === 'spin' ? 4 : 10;
    const m = nearestEnemy(range);
    if (m) { w.heroSkill(slot, m.x, m.y, m.id); return; }
    if (sk.kind === 'teleport' || sk.kind === 'dash' || sk.kind === 'leap') {
        const mv = input.moveVec();
        const a = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : h.face;
        w.heroSkill(slot, h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6, 0);
        return;
    }
    w.heroSkill(slot, h.x + Math.cos(h.face) * 4, h.y + Math.sin(h.face) * 4, 0);
}
function nearestEnemy(r) {
    const w = app.world, h = w.hero;
    let best = null, bd = r * r;
    for (const m of w.mons) {
        if (m.dead || m.burrowed || m.state === 'disguised' || m.state === 'sleep') continue;
        if (!w.visibleTile(m.x, m.y)) continue;
        const d = (m.x - h.x) ** 2 + (m.y - h.y) ** 2;
        if (d < bd && w.canSee(h, m)) { bd = d; best = m; }
    }
    return best;
}

function useTarget(t) {
    const w = app.world;
    if (!t) return null;
    if (t.kind === 'mon') { w.heroAttack(t.id, 0); return 'attack'; }
    if (t.kind === 'npc' || t.kind === 'obj' || t.kind === 'item') { w.heroInteract(t.id); return null; }
    if (t.kind === 'ground') { w.heroMoveTo(t.x, t.y); return 'move'; }
    return null;
}

function handleInput(dt) {
    const w = app.world, h = w.hero;
    // Hotkeys that work even with panels open.
    if (input.hit('Escape')) { if (panels.any()) panels.closeAll(); else if (!$('automap').classList.contains('hidden')) app.toggleMap(); else panels.open('menu'); }
    if (input.hit('Space')) panels.closeAll();
    if (input.hit('KeyI')) panels.toggle('inv');
    if (input.hit('KeyC')) panels.toggle('char');
    if (input.hit('KeyK')) panels.toggle('skills');
    if (input.hit('KeyJ')) panels.toggle('quests');
    if (input.hit('Tab')) app.toggleMap();
    if (input.hit('KeyM')) { settings.muted = !settings.muted; app.applySettings(); hud.toast(settings.muted ? 'Muted' : 'Sound on'); }
    view.loot.altHeld = input.key('AltLeft') || input.key('AltRight');
    if (input.wheel) view.zoom = Math.max(0.7, Math.min(1.45, view.zoom + input.wheel * 0.06));
    if (panels.any()) { w.heroDirect(0, 0); return; }
    if (h.dead) return;
    if (input.hit('KeyQ')) app.drink('hp');
    if (input.hit('KeyE')) app.drink('juice');
    if (input.hit('KeyR')) app.pie();

    // Direct movement (WASD / stick).
    const mv = input.moveVec();
    w.heroDirect(mv.x, mv.y);

    if (!input.isTouch) {
        const hov = input.mouse.moved || input.mouse.left || true ? cursorTarget() : null;
        view.setHover(hov && hov.kind !== 'ground' ? hov : null);
        canvas.style.cursor = hov && hov.kind === 'mon' ? 'crosshair' : hov && hov.kind !== 'ground' ? 'pointer' : 'default';
        const shift = input.key('ShiftLeft') || input.key('ShiftRight');
        if (input.mouse.leftPressed) {
            if (shift) { castAt(0, input.mouse.x, input.mouse.y, hov); hold = 'stand'; }
            else hold = useTarget(hov);
            holdT = 0.15;
        }
        if (input.mouse.left) {
            holdT -= dt;
            if (holdT <= 0) {
                holdT = 0.14;
                if (hold === 'move') { const gp = view.groundPoint(input.mouse.x, input.mouse.y); if (gp) w.heroMoveTo(gp.x, gp.z); }
                else if (hold === 'stand') castAt(0, input.mouse.x, input.mouse.y, hov);
                else if (hold === 'attack' && hov && hov.kind === 'mon' && (!h.intent || h.intent.id !== hov.id)) w.heroAttack(hov.id, 0);
            }
        } else hold = null;
        // Right button and number keys: cast at the cursor, repeating while held.
        const rep = (key, down, pressed, slot) => {
            repeatT[key] = (repeatT[key] || 0) - dt;
            if (pressed || (down && repeatT[key] <= 0)) { repeatT[key] = 0.12; castAt(slot, input.mouse.x, input.mouse.y, hov); }
        };
        rep('rmb', input.mouse.right, input.mouse.rightPressed, 1);
        for (const [code, slot] of Object.entries(castSlots)) rep(code, input.key(code), input.hit(code), slot);
    } else {
        for (const t of input.taps) {
            const tg = view.pick(t.x, t.y, w, { touch: true });
            useTarget(tg);
        }
        const atk = input.tbtn.get('attack');
        autoT -= dt;
        if (atk.down && autoT <= 0) {
            autoT = 0.2;
            const m = nearestEnemy(9);
            if (m) { if (!h.intent || h.intent.id !== m.id) w.heroAttack(m.id, 0); }
            else {
                // Nothing to hit: grab the nearest loot, or open the nearest chest / shrine / breakable.
                const near = (list, r) => list.filter((o) => Math.hypot(o.x - h.x, o.y - h.y) < r).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
                const loot = near(w.items.filter((i) => !i.dropped && w.visibleTile(i.x, i.y)), 4);
                const obj = !loot && near(w.objs.filter((o) => (o.breakable && o.state !== 'broken') || ((o.type === 'chest' || o.type === 'bigchest' || o.type === 'shrine' || o.type === 'lectern' || o.type === 'anvil') && o.state === 'idle')), 3);
                if (loot) { if (!h.intent || h.intent.id !== loot.id) w.heroInteract(loot.id); }
                else if (obj) { if (!h.intent || h.intent.id !== obj.id) w.heroInteract(obj.id); }
                else castAuto(0);
            }
        }
        for (let s = 1; s <= 5; s++) {
            const b = input.tbtn.get('slot' + s);
            repeatT['t' + s] = (repeatT['t' + s] || 0) - dt;
            if (b.pressed || (b.down && repeatT['t' + s] <= 0)) { repeatT['t' + s] = 0.15; castAuto(s); }
        }
    }
}

// ------------------------------------------------------------------ events → audio / HUD / panels
let deathT = -1, victoryT = -1;
function handleEvent(e) {
    const w = app.world, g = app.game;
    const playing = app.mode === 'play' || app.mode === 'dead' || app.mode === 'victory';
    view.onEvent(e, w);
    const S = (n, o) => audio.sfx(n, o);
    switch (e.type) {
        case 'hit': if (!e.dot) { S('squish', { pitch: 0.8 + Math.random() * 0.5, vol: 0.7 }); if (e.crit) S('crit'); } break;
        case 'death': S(e.boss ? 'boom' : 'splat', { pitch: 0.8 + Math.random() * 0.4 }); break;
        case 'heroHit': S('hurt'); if (e.big) S('oof'); break;
        case 'swing': S(e.skill === 'bigslice' || e.skill === 'bash' ? 'bigswing' : 'swing'); break;
        case 'cast': {
            const k = { seedshot: 'seed', pipspray: 'seed', pomegranate: 'pop', zestbolt: 'zest', caramelize: 'fire', brainfreeze: 'freeze', limening: 'zap', peelport: 'teleport', melonmeteor: 'whistle', juiceup: 'buff', roll: 'swing', peeltrap: 'trap', raisinrain: 'rain', leap: 'bigswing', blender: 'spin' }[e.skill];
            if (k) S(k);
            break;
        }
        case 'spin': S('spin'); break;
        case 'explode': S('boom', { vol: e.big ? 1 : 0.6 }); break;
        case 'land': S('thud'); break;
        case 'monSwing': if (e.big) S('thud'); break;
        case 'levelup': S('levelup'); if (playing) { hud.banner(`Level ${e.level}!`, LEVELUP_LINES[e.level % LEVELUP_LINES.length], '', 2.5); hud.toast('+5 attribute points and +1 skill point. Press C and K to spend them.'); saveSoon(); } break;
        case 'pickup':
            if (e.what === 'sugar') S('sugar');
            else S('pickup');
            if (e.what === 'item' && (e.item.rarity === 'rare' || e.item.rarity === 'legendary')) hud.toast(`Picked up ${e.item.identified ? e.item.name : 'an unidentified ' + e.item.base}`, e.item.rarity === 'legendary' ? 'loot' : '');
            if (panels.isOpen('inv')) panels.refresh();
            break;
        case 'drop': if (!e.quiet) S(e.rarity === 'legendary' ? 'legendary' : e.rarity === 'rare' ? 'raredrop' : 'drop'); if (e.rarity === 'legendary') hud.toast('Something GOLDEN dropped!', 'loot'); break;
        case 'drink': S('gulp'); break;
        case 'open': S('chest'); break;
        case 'break': S(e.obj === 'jar' ? 'glass' : e.obj === 'keg' ? 'boom' : 'crate'); break;
        case 'shrine': S('shrine'); hud.toast(e.text); break;
        case 'pie': S('portal'); hud.toast('A Portal Pie! It smells like home.'); break;
        case 'stairsOpen': S('portal'); hud.toast('The way down has opened.', 'quest'); break;
        case 'telegraph': S('telegraph'); break;
        case 'mimicWake': S('mimic'); break;
        case 'nojuice': if (performance.now() - lastNoJuice > 1500) { lastNoJuice = performance.now(); hud.toast('Not enough Juice!', 'warn'); S('nope'); } break;
        case 'toast': hud.toast(e.text, e.kind || ''); break;
        case 'quest': hud.toast(e.text, 'quest'); S('shrine'); saveSoon(); break;
        case 'waypoint': if (e.floor) hud.toast(`New waypoint: ${floorName(e.floor)}. The Wishing Well in town can bring you back here.`); break;
        case 'npc': { if (app.mode !== 'play') break; const d = g.talk(e.npc); panels.showDialog(d); if (d.reward) { S('levelup'); app.heroChanged(); } break; }
        case 'ui': if (app.mode !== 'play') break; panels.open(e.panel); if (e.panel === 'stash') panels.open('inv'); S('portal'); break;
        case 'enter': {
            hud.banner(e.name, e.boss ? 'Something big lives down here…' : e.how === 'death' ? '' : '', '', 2.6);
            if (e.floor > 0 && app.game !== app.demo && Math.random() < 0.6) { const tips = input.isTouch ? TIPS.filter((t) => !/click|Click|Alt|Tab|Q |E |R |1–4/.test(t)) : TIPS; setTimeout(() => hud.toast('Tip: ' + tips[Math.floor(Math.random() * tips.length)]), 3000); }
            S('stairs');
            break;
        }
        case 'bossWake': S('roar'); hud.banner(e.name, `“${e.line}”`, 'boss', 3.5); audio.music('boss'); break;
        case 'bossPhase': hud.banner('', `“${e.line}”`, 'boss', 2.2); S('roar'); break;
        case 'bossDead': hud.banner(`${w.monById ? (w.boss()?.name || 'Boss') : 'Boss'} squashed!`, 'Victory tastes sweet.', '', 3.5); audio.music(actOf(w.floor).theme); saveSoon(); break;
        case 'heroDeath': S('death'); deathT = 1.4; saveSoon(); break;
        case 'victory': victoryT = 3.0; audio.music('victory'); S('victory'); break;
        case 'cooldown': break;
        case 'alert': break;
        case 'healed': S('shrine'); break;
    }
}

// ------------------------------------------------------------------ the loop
let last = performance.now(), acc = 0, time = 0, fpsFrames = 0, fpsT = 0;
function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, DEBUG ? 0.2 : 0.1);
    time += dt;
    fpsFrames++; fpsT += dt;
    if (fpsT >= 1) { if (app.mode === 'play') view.r.sampleFps(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
    try {
        const g = app.game;
        if (!g) { view.r.render(dt); input.clearEdges(); return; }
        if (app.mode === 'play') handleInput(dt);
        else if (app.mode === 'title' || app.mode === 'creator') { g.world.hero.face = Math.PI / 2; g.world.heroDirect(0, 0); }
        const paused = (app.mode === 'play' && panels.any()) || app.mode === 'victory';
        if (!paused) {
            if (view.hitStop > 0) view.hitStop -= dt;
            else {
                acc += dt * FAST;
                let steps = 0;
                while (acc >= SIM_DT && steps < 10 * FAST) { g.update(SIM_DT); acc -= SIM_DT; steps++; }
                if (steps >= 10 * FAST) acc = 0;
            }
        }
        if (g.world !== lastWorld) { panels.closeAll(); worldChanged(); }
        const evs = g.world.events.splice(0);
        if (app.mode === 'title' || app.mode === 'creator') { for (const e of evs) if (e.type !== 'npc' && e.type !== 'enter') view.onEvent(e, g.world); }
        else for (const e of evs) handleEvent(e);
        if (deathT > 0) { deathT -= dt; if (deathT <= 0 && app.world.hero.dead) { setMode('dead'); screens.showDeath('the rot'); } }
        if (victoryT > 0) { victoryT -= dt; if (victoryT <= 0) { setMode('victory'); screens.showVictory(); saveNow(); } }
        if (app.mode !== 'play') view.setHover(null);
        if (!settings.shake) view.shake = 0;
        view.frame(g.world, dt, time);
        if (app.mode === 'play' || app.mode === 'dead') hud.update(dt);
        if (!$('automap').classList.contains('hidden')) drawAutomap($('automap'), g.world);
        if (app.mode === 'play') { saveT -= dt; if (saveT <= 0 || (saveDirty && saveT <= 0)) saveNow(); }
    } catch (err) {
        console.error(err);
    }
    input.clearEdges();
}

// ------------------------------------------------------------------ boot
function boot() {
    const quick = params.get('quick');
    if (quick && CLASSES[quick]) {
        app.demo = demoGame();
        app.startNew({ name: 'Tester', cls: quick, look: { fruit: CLASSES[quick].defaultFruit } });
    } else app.toTitle();
    requestAnimationFrame(frame);
}
boot();

// ------------------------------------------------------------------ debug hooks
if (DEBUG) {
    window.__rt = {
        app, view, panels, screens, hud, input,
        get game() { return app.game; }, get world() { return app.world; }, get mode() { return app.mode; },
        god(on = true) { app.game.god = on; },
        give(kind, rarity = 'rare', lvl = null) { const g = app.game; const it = makeItem(new RNG(Date.now() >>> 0), kind, lvl || g.hero.level, rarity, { identified: true }); it.identified = true; addToInv(g.hero, it); return it; },
        level(n) { const g = app.game; while (g.hero.level < n) { g.hero.level++; g.hero.statPts += 5; g.hero.skillPts++; } app.heroChanged(); },
        floor(f) { app.game.enter(f, 'waypoint'); },
        killAll() { const w = app.world; for (const m of w.mons) if (!m.dead && w.visibleTile(m.x, m.y)) w.damageMon(m, 99999, 'phys', { src: 'hero' }); },
        snap() { view.snap = true; },
        tp(x, y) { const h = app.world.hero; h.x = x; h.y = y; h.intent = null; h.path = null; view.snap = true; },
        save: saveNow,
    };
}
