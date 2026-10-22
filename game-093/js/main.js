// Boot, the mode machine (title / play), the fixed-step loop, input routing and the fan-out of sim events to the view, audio and UI.

import { View } from './view/view.js';
import { newGame, step, act, enterMap, curMap, serialize, deserialize } from './sim/game.js';
import { nearestInteractable } from './sim/field.js';
import * as Q from './sim/quests.js';
import { objective } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LOCS } from './sim/world/locations.js';
import { ITEMS } from './sim/data/items.js';
import { CHARS } from './sim/data/classes.js';
import { STEP, MAX_FRAME } from './config.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui/ui.js';
import { $ } from './ui/dom.js';
import { loadSettings, saveSettings, hasSave, saveInfo, saveGame, loadGame, clearSave } from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = Math.max(1, +params.get('fast') || 1);
const settings = loadSettings();
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = params.get('q') === 'low' || settings.quality === 'low' || (settings.quality === 'auto' && coarse && Math.min(innerWidth, innerHeight) < 700) ? 1 : 2;

const input = new Input();
const audio = new Audio();
const view = new View($('view'), { quality });
let G = newGame(+params.get('seed') || 7);
let mode = 'title';            // 'title' | 'play'
let acc = 0, last = performance.now(), time = 0, aPress = false;
let autoplay = null;
const counts = {};
let autosaveT = 0, wantSave = false;

// ------------------------------------------------------------------ the UI's window onto the game
const env = {
    G: () => G, act: (a) => act(G, a), audio, view, lib: view.lib, settings, fast: FAST,
    saveSettings: () => saveSettings(settings), applySettings, hasSave, saveInfo,
    deleteSave: () => { clearSave(); if (mode === 'title') ui.title(hasSave(), saveInfo()); },
    doSave: () => saveGame(G), doLoad, toTitle, titleAct,
    nearest: (g) => (g.scene ? null : nearestInteractable(g)),
    confirmKey: () => (input.lastDevice === 'keys' ? 'Z' : 'A'),
    objMapTarget: (g) => { const o = objective(g); return o && curMap(g).kind === 'over' ? o : null; },
    onMenuClosed: () => {},
};
const ui = new UI(env);

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    view.reduced = !!settings.reduced; view.stage.shakeOn = settings.shake !== false;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    $('touch').hidden = !on || mode !== 'play';
    document.body.classList.toggle('reduced', !!settings.reduced);
}
input.onTouch = () => applySettings();
input.bindStick($('stick-zone'), $('stick'), $('stick').querySelector('.knob'));
input.bindButton($('btn-a'), 'Enter'); input.bindButton($('btn-b'), 'Escape');
input.bindButton($('btn-cam-l'), 'KeyQ'); input.bindButton($('btn-cam-r'), 'KeyE'); input.bindButton($('btn-menu'), 'KeyP');

// ------------------------------------------------------------------ view hooks
const bu = ui.battle;
Object.assign(view.hooks, {
    popup: (x, y, t, c) => bu.popup(x, y, t, c),
    banner: (t, c) => (['break', 'warn', 'boost'].includes(c) ? bu.bigBanner(t, c) : bu.skillBanner(t, c)),
    banner2: (t, c) => bu.skillBanner(t, c),
    sfx: (n, e) => audio.play(n, e),
    turn: (e) => bu.turn(e),
    ended: (e) => { if (!autoplay) bu.ended(e); },
    victory: () => { audio.playMusic('silence'); audio.jingle('victory'); },
    battleStart: (ev) => { bu.begin(ev); ui.showHud(false); audio.play('encounter'); audio.playMusic(ev.music || (ev.boss ? 'boss' : 'battle')); },
    battleEnd: () => { bu.end(); ui.showHud(mode === 'play'); audio.playMusic(mapMusic()); },
    area: (map, e) => { ui.area(map, e); },
    marks: (g, map) => {
        const out = {};
        for (const n of map.npcs || []) {
            if (n.kind === 'story') { out[n.id] = 'story'; continue; }
            if (!n.arc) continue;
            const act = g.quests.active.find((q) => q.arc?.npc === n.id);
            if (act) { if (Q.status(g, act).ready) out[n.id] = 'ready'; } else if ((g.quests.arcStage[n.id] || 0) < 3) out[n.id] = 'quest';
        }
        return out;
    },
});

function mapMusic() {
    if (!G) return 'title';
    if (G.mode === 'ending') return 'ending';
    const m = curMap(G);
    return m.music || (m.kind === 'over' ? 'over' : m.kind === 'dungeon' ? 'dungeon' : 'town');
}

// ------------------------------------------------------------------ sim events -> UI and audio
function dispatch(events) {
    for (const e of events) {
        counts[e.type] = (counts[e.type] || 0) + 1;
        switch (e.type) {
            case 'map': if (mode === 'play') audio.playMusic(mapMusic()); wantSave = !e.silent || e.first; break;
            case 'music': audio.playMusic(e.name); break;
            case 'say': ui.showLine(e); break;
            case 'say_end': ui.endLine(); break;
            case 'choice': ui.showChoices(e.options); break;
            case 'choice_end': ui.hideChoices(); break;
            case 'banner': ui.banner(e.text, e.sub); break;
            case 'toast': ui.toast(e.text); break;
            case 'get': {
                if (e.gold) ui.toast(`Found ${e.gold} G`, 'gold'); else ui.toast(`Obtained ${ITEMS[e.item]?.name || e.item}${e.n > 1 ? ' ×' + e.n : ''}`, e.key ? 'key' : '');
                audio.play(e.key ? 'key' : e.gold ? 'get' : 'chest'); break;
            }
            case 'recruit': ui.toast(`${CHARS[e.id].name} joins the party!`, 'key'); audio.play('recruit'); break;
            case 'quest': ui.toast(e.what === 'accept' ? `Quest accepted: ${e.title}` : `Quest complete: ${e.title}`); break;
            case 'shop': if (!autoplay) ui.shop.open(); break;
            case 'board': if (!autoplay) ui.board.open(); break;
            case 'rest': audio.play('rest'); ui.toast('The party feels fully rested.'); break;
            case 'save_point': audio.play('save'); saveGame(G); ui.toast('Progress saved.'); break;
            case 'heal_all': audio.play('heal'); break;
            case 'chest': audio.play('chest'); break;
            case 'crack': audio.play('crack'); break;
            case 'shake': audio.play('shake'); break;
            case 'flash': audio.play('flash'); break;
            case 'alert': audio.play('alert'); break;
            case 'encounter': audio.play('encounter'); break;
            case 'gameover': audio.playMusic('sad'); audio.jingle('defeat'); if (!autoplay) bu.gameOver(); break;
            case 'ending': audio.playMusic('ending'); G.endingShown = true; if (!autoplay) setTimeout(() => ui.credits(G, () => act(G, { type: 'endingDone' })), 2500); break;
            case 'item_used': audio.play('heal'); break;
        }
    }
}

// ------------------------------------------------------------------ title, new game, load
function toTitle() {
    ui.closeAll(); bu.end(); ui.endLine(); ui.hideChoices(); resetView();
    G = newGame(Math.floor(Math.random() * 1e6));
    mode = 'title'; autoplay = null; ui.showHud(false); $('touch').hidden = true;
    audio.playMusic('title'); ui.title(hasSave(), saveInfo());
}
function resetView() { if (view.mode === 'battle') { view.finishReturn(G); view.trans = null; view.stage.pix = 0; view.stage.swirl = 0; } }
function titleAct(a) {
    if (a === 'new') { ui.closeTitle(); startPlay(newGame(Math.floor(Math.random() * 1e6))); }
    else if (a === 'continue') doLoad();
    else if (a === 'howto') ui.howTo();
    else if (a === 'settings') ui.settingsSheet();
}
function startPlay(g) {
    resetView(); bu.end(); ui.closeAll(); ui.endLine(); ui.hideChoices();
    G = g; mode = 'play'; input.flush(); document.activeElement?.blur?.(); acc = 0; aPress = false;
    ui.showHud(true); applySettings(); audio.init(); audio.playMusic(mapMusic());
}
function doLoad() {
    const g = loadGame();
    if (!g) { ui.toast('No saved game found.'); return false; }
    ui.closeTitle(); startPlay(g); return true;
}

// ------------------------------------------------------------------ input routing
function route(p) {
    if (mode === 'title' || G.mode === 'ending' && ui.blocking) { ui.press(p); return; }
    if (ui.press(p)) return;
    if (autoplay || G.mode !== 'field' || G.scene || G.pending || G.warp || ui.blocking) return;
    switch (p.key) {
        case 'Enter': case 'KeyZ': case 'Space': aPress = true; break;
        case 'Escape': case 'KeyX': case 'KeyP': ui.menus.open(); break;
        case 'KeyM': ui.menus.open('quests'); break;
        case 'KeyQ': view.rotate(-1); break;
        case 'KeyE': view.rotate(1); break;
    }
}
// camera keys also work during scenes and when walking with the menu closed
function worldInput(s) {
    const yaw = view.yaw, c = Math.cos(yaw), n = Math.sin(yaw);
    return { x: s.x * c + s.y * n, y: -s.x * n + s.y * c, run: s.run };
}

// ------------------------------------------------------------------ the loop
function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000)); last = now;
    const dt = raw * FAST; time += raw;
    // one press per frame, in order
    const p = input.next(); if (p) route(p);

    if (mode === 'play') {
        const blocked = ui.blocking && !['credits'].includes(ui.top?.id) && G.mode !== 'scene';
        if (!blocked || autoplay) {
            acc += dt; let n = 0;
            while (acc >= STEP && n < 12 * FAST) {
                let inp;
                if (autoplay) inp = botInput(G, autoplay);
                else { const s = input.state(); inp = worldInput(s); inp.a = aPress; if (aPress) aPress = false; }
                step(G, inp, STEP); acc -= STEP; n++;
            }
            if (n >= 12 * FAST) acc = 0;
        } else acc = 0;
        autosaveT += raw;
        if (wantSave && autosaveT > 4 && !G.scene && !G.battle && G.mode === 'field' && !G.warp) { wantSave = false; autosaveT = 0; saveGame(G); }
    } else {
        view.yawGoal += raw * 0.08;
    }
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    dispatch(ev);
    view.frame(G, dt, time);
    ui.updateDialogue(raw);
    if (mode === 'play') { ui.updateHud(G, raw, time); bu.update(G, raw); }
    audio.step?.();
}

// ------------------------------------------------------------------ lifecycle
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') saveGame(G); });
addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
view.onEvents(G, G.events.splice(0));
applySettings();
ui.title(hasSave(), saveInfo());
audio.playMusic('title');
// the first gesture unlocks audio
addEventListener('pointerdown', () => audio.init(), { once: true, capture: true });
addEventListener('keydown', () => audio.init(), { once: true, capture: true });
requestAnimationFrame((t) => { last = t; frame(t); });

if (DEBUG) {
    window.__ds = {
        get G() { return G; }, get mode() { return mode; }, view, ui, audio, input, step, act, newGame, enterMap, counts, settings,
        start(seed = 7) { ui.closeTitle(); startPlay(newGame(seed)); return G; },
        load(g) { ui.closeTitle(); startPlay(g); return G; },
        autoplay(on = true) { autoplay = on ? makeBot({ skill: 1 }) : null; return !!autoplay; },
        ff(sec) { let n = 0; while (sec > 0 && n++ < 1e7) { step(G, autoplay ? botInput(G, autoplay) : { x: 0, y: 0, a: false }, STEP); sec -= STEP; } return G.t; },
        save: () => saveGame(G), serialize: () => serialize(G), deserialize,
    };
}
