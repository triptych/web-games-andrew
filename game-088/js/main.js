// Curio Cove — entry point. Boots the stage and both views, runs the fixed-step museum clock,
// routes input and sim events, and moves between the title, the museum and the dig.
//
// ?debug=1 exposes window.__cc for the dev/ harnesses; &fast=N runs the dig's animations and the
// museum clock N× faster.

import { STEP, MAX_FRAME, BOOSTER_MOVES } from './config.js';
import { Stage } from './view/stage.js';
import { DigView } from './view/board3d.js';
import { MuseumView } from './view/museum3d.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import * as Gm from './sim/game.js';
import * as Bd from './sim/board.js';
import { makeBot, botMove, playGame } from './sim/bot.js';
import { levelSpec, CHAPTER_OF, STORY_LEVELS } from './sim/levels.js';
import { SCENES, CHAPTERS, TASK, ITEM, DINOS, PEOPLE, CHATTER, TASKS, ITEMS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const stage = new Stage(document.getElementById('view'), settings.quality);

let G = showcase();          // the title screen shows a finished museum
let mode = 'title';          // title | museum | dig
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let pending = null;          // a dig result waiting for the board to finish animating
let hammerOn = false;
let autoplay = null;
let gullT = 5;
let cursor = null;
const seen = {};

const sfx = (name, o) => audio.play2(name, o);
const digView = new DigView(stage, {
    ui: null, sfx,
    onSwap: (r1, c1, r2, c2) => doSwap(r1, c1, r2, c2),
    onHammer: (r, c) => doHammer(r, c),
    hintMove: () => (G.dig && G.dig.B.state === 'play' ? Bd.findMoves(G.dig.B, 1)[0] : null),
    onIdle: () => afterScript(),
});
const museum = new MuseumView(stage, {
    appeal: () => Gm.appeal(G),
    onTap: (hit) => museumTap(hit),
});

const ui = new UI({
    audio, settings,
    cb: {
        onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); stage.setQuality(s.quality); applyEffects(); },
        onDeleteSave: () => { clearSave(); location.reload(); },
        onDig: () => startDig(Gm.nextLevel(G)),
        onReplay: (n) => startDig(n),
        onMenu: () => openMenu(),
        onTill: () => { if (Gm.collectTill(G)) afterAction(); },
        onTask: (id) => { if (Gm.doTask(G, id)) afterAction(); },
        onBuyDecor: (id) => { if (Gm.buyDecor(G, id)) afterAction(); },
        onBuyBooster: (k) => { if (Gm.buyBooster(G, k)) afterAction(); },
        onHammer: (on) => toggleHammer(on),
        onShuffle: () => doShuffle(),
        onWinContinue: () => leaveDig(),
        onMoreMoves: () => { if (Gm.buyMoves(G)) { ui.closeScreen('lose'); flushEvents(); } },
        onRetry: () => { const n = G.dig.n; ui.closeScreen('lose'); Gm.leaveDig(G); flushEvents(true); startDig(n); },
        onQuitDig: () => { ui.closeScreen('lose'); leaveDig(); },
        onScreensChanged: () => {},
        onLabel: (l) => {
            if (l.kind === 'dig') { audio.ui('click'); const n = Gm.nextLevel(G); if (n) startDig(n); else { museum.focus('dig'); ui.toast('Finish this chapter’s tasks to open the next dig.'); } }
            else { audio.ui('page'); museum.focus(l.at); }
        },
    },
});
// the dig view's UI hooks
Object.assign(digView.hooks, {
    ui: {
        moves: (n, added) => ui.moves(n, added),
        goal: (e, from) => ui.goal(e, from),
        popup: (t, p, c, b) => { ui.popup(t, p, c, b); if (G.dig) ui.score(G.dig.B.score); },
        praise: (c) => { ui.praise(c); audio.play2('combo'); },
        praiseText: (t, k) => ui.praiseText(t, k),
        banner: (t, k) => ui.banner(t, k),
        specialMade: (tile, p) => ui.specialMade(tile, p),
    },
});
stage.onResize = () => { digView.fit(); setInsets(); };

/** Calm effects and screen shake, from the settings. */
function applyEffects() {
    stage.calm = !!settings.calm;
    digView.fx.calm = !!settings.calm;
    digView.shakeOn = settings.shake && !settings.calm;
}
applyEffects();

// ------------------------------------------------------------------ title
function showcase() {
    const S = Gm.newGame(1, 'Rowan');
    S.introDone = true;
    S.tasks = TASKS.map((t) => t.id);
    S.items = ITEMS.map((i) => i.id);
    S.staff = ['moss', 'penny', 'ledger', 'kit', 'rosa'];
    S.decor = ['bench', 'flowers', 'lamps', 'fountain', 'balloon', 'lighthouse'];
    S.finished = true;
    return S;
}
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
museum.refresh(G);
museum.enabled = false;
// the title flies slowly round the whole island
Object.assign(museum.rig, { wantDist: 235, dist: 235, pitch: 0.72, tx: 0, tz: -70, cx: 0, cz: -70, spin: 0.035 });
ui.openScreen('title');
audio.play('title');

const unlock = () => { audio.init(); if (mode !== 'dig') audio.ambience(true); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') { ui.openScreen('newgame'); document.getElementById('name-input').select?.(); }
    else if (act === 'continue') {
        const s = loadGame();
        if (!s) { ui.toast('That save could not be read.'); return; }
        begin(s.G, Math.max(0, (Date.now() - s.savedAt) / 1000));
    } else ui.openScreen(act);
});
document.getElementById('name-go').addEventListener('click', () => {
    audio.ui('click');
    begin(Gm.newGame((Date.now() % 1e9) | 0, document.getElementById('name-input').value), 0);
});
document.getElementById('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('name-go').click(); });
document.getElementById('menu-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('menu');
    else if (act === 'quitdig') { ui.closeScreen('menu'); leaveDig(); }
    else if (act === 'title') { save(); location.href = location.pathname + location.search; }
    else ui.openScreen(act);
});

/** Start playing a game (new or loaded). awaySec fills the till for time spent away. */
function begin(g, awaySec) {
    G = g;
    G.events.length = 0;
    ui.closeAll();
    input.flush();
    document.activeElement?.blur?.();
    Object.assign(museum.rig, { wantDist: 46, pitch: 0.8, tx: 0, tz: 1, spin: 0 });
    if (G.dig) Gm.leaveDig(G);          // a dig in progress when the game closed is abandoned
    G.events.length = 0;
    if (awaySec > 60) Gm.away(G, awaySec);
    toMuseum();
    if (!G.introDone) {
        museum.focus('entrance');
        ui.scene(SCENES.intro, G.name, () => { Gm.finishIntro(G); flushEvents(); ui.chapterCard(0, CHAPTERS[0].title); pulseDig(); save(); });
    }
    flushEvents();
    save();
}

function toMuseum() {
    mode = 'museum';
    ui.showDig(false);
    ui.showMuseum(true);
    museum.enabled = true;
    digView.enabled = false;
    museum.refresh(G);
    ui.museum(G);
    audio.play(G.finished ? 'title' : 'museum');
    audio.ambience(true);
    setInsets();
}

/** The 🗺 button: out to the whole island, or back home to the museum. */
function toggleMap() {
    audio.ui('page');
    if (museum.rig.wantDist > 120) museum.focus('museum'); else museum.focus('all');
}
document.getElementById('m-map').addEventListener('click', toggleMap);

function pulseDig() {
    const b = document.getElementById('m-dig');
    b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 600, iterations: 3 });
}

function openMenu() {
    if (mode === 'title' || ui.anyScreen()) return;
    audio.ui('open');
    document.getElementById('menu-title').textContent = mode === 'dig' ? 'Paused' : 'Menu';
    document.getElementById('menu-quitdig').hidden = mode !== 'dig';
    document.querySelector('#menu-list [data-act="resume"]').textContent = mode === 'dig' ? 'Resume' : 'Back to the museum';
    ui.openScreen('menu');
}

function setInsets() {
    if (mode === 'dig') digView.setInsets(ui.digInsets());
    else museum.setInsets(ui.museumInsets());
}

// ------------------------------------------------------------------ museum
function museumTap(hit) {
    if (ui.anyScreen()) return;
    if (hit.kind === 'dig') { const n = Gm.nextLevel(G); if (n) startDig(n); else ui.toast('Finish this chapter’s tasks to open the next dig.'); return; }
    if (hit.kind === 'site') {
        audio.ui('click');
        ui.toast(hit.state === 'locked' ? `${hit.name}: this dig site opens in Chapter ${hit.chapter}.` : `${hit.name}: all dug! Replay its digs from the Journal.`);
        return;
    }
    if (hit.kind === 'booth') { if (Gm.collectTill(G)) afterAction(); return; }
    if (hit.kind === 'person') {
        museum.poke(hit.id);
        const lines = CHATTER[hit.id] || ['Hello!'];
        const line = lines[Math.floor(Math.random() * lines.length)];
        ui.toast(`${PEOPLE[hit.id].name}: “${line}”`);
        audio.voice(hit.id);
    }
}

/** After a museum action: show its events, refresh and save. */
function afterAction() {
    flushEvents();
    museum.refresh(G);
    ui.museum(G);
    save();
}

// ------------------------------------------------------------------ dig
function startDig(n) {
    if (!n || ui.inScene()) return;
    if (G.dig) Gm.leaveDig(G);
    if (!Gm.startDig(G, n)) return;
    ui.closeAll();
    mode = 'dig';
    pending = null;
    hammerOn = false;
    input.flush();
    document.activeElement?.blur?.();
    const spec = levelSpec(n);
    ui.showMuseum(false);
    ui.showDig(true);
    ui.setupDig(G);
    museum.enabled = false;
    digView.load(G.dig.B, spec, n > STORY_LEVELS ? 5 : CHAPTER_OF(n));
    setInsets();
    audio.play(n > STORY_LEVELS ? 'night' : 'dig');
    audio.ambience(false);
    cursor = null;
    const goalText = G.dig.B.goals.map((g) => (g.kind === 'color' ? `${g.n} ${['amphorae', 'coins', 'leaves', 'ammonites', 'amethysts', 'bones'][g.c]}` : `${g.n} ${{ soil: 'dirt', fossil: 'fossils', rock: 'boulders', crust: 'crusts', relic: 'relics' }[g.kind]}`)).join(' · ');
    setTimeout(() => { if (mode === 'dig') ui.banner(`${n > STORY_LEVELS ? 'Night dig ' + (n - STORY_LEVELS) : 'Dig ' + n}: ${goalText}`, 'intro'); }, 700);
    if (spec.tip && !G.seenTips[n]) {
        Gm.seeTip(G, n);
        setTimeout(() => { if (mode === 'dig' && !ui.anyScreen() && G.dig && G.dig.B.movesUsed === 0) ui.scene([[G.staff.includes('moss') ? 'moss' : 'gus', spec.tip]], G.name, () => {}); }, 1500);
    }
    flushEvents();
    save();
}

function canPlay() { return mode === 'dig' && G.dig && !G.dig.result && G.dig.B.state === 'play' && !digView.busy() && !ui.anyScreen(); }

function doSwap(r1, c1, r2, c2) {
    if (!canPlay()) return;
    if (r2 < 0 || c2 < 0 || r2 >= G.dig.B.R || c2 >= G.dig.B.C) return;
    digView.idle = 0;
    Gm.digSwap(G, r1, c1, r2, c2);
    flushEvents();
}

function toggleHammer(on = !hammerOn) {
    if (mode !== 'dig' || !G.dig || G.dig.result) return;
    if (on && G.boosters.hammer <= 0) {
        if (Gm.buyBooster(G, 'hammer')) { ui.toast('Bought a Rock Hammer'); ui.boosters(G); }
        else { ui.toast('Not enough coins for a hammer.'); return; }
    }
    hammerOn = on;
    digView.hammerMode = on;
    ui.hammer(on);
    audio.ui(on ? 'open' : 'close');
}
function doHammer(r, c) {
    if (!hammerOn || mode !== 'dig' || digView.busy()) return;
    if (Gm.digHammer(G, r, c)) { toggleHammer(false); ui.boosters(G); flushEvents(); }
    else ui.toast('Nothing to smash there.');
}
function doShuffle() {
    if (!canPlay()) return;
    if (G.boosters.shuffle <= 0) {
        if (!Gm.buyBooster(G, 'shuffle')) { ui.toast('Not enough coins for a shuffle.'); return; }
    }
    Gm.digShuffle(G);
    ui.boosters(G);
    flushEvents();
}

/** The board finished animating: show a result that was waiting for it. */
function afterScript() {
    if (G.dig) ui.score(G.dig.B.score);
    if (!pending) return;
    const p = pending;
    pending = null;
    if (p.type === 'digwon') {
        setTimeout(() => {
            if (mode !== 'dig') return;
            audio.fanfare(true);
            ui.showWin(p, G);
        }, 350);
    } else if (p.type === 'diglost') {
        setTimeout(() => { if (mode !== 'dig') return; audio.fanfare(false); ui.showLose(G, p.goals); }, 300);
    }
}

function leaveDig() {
    const won = !!G.dig?.result?.won;
    const r = G.dig?.result;
    ui.closeAll();
    Gm.leaveDig(G);
    digView.clear();
    digView.enabled = false;
    toMuseum();
    flushEvents();
    if (won && r?.item) {
        const it = ITEM[r.item];
        museum.focus(it.hall);
        ui.toast(it.kind === 'bone' ? `${it.name} added to the journal` : `${it.name} is now on show!`);
    }
    if (Gm.openTasks(G).some((t) => !Gm.taskBlock(G, t.id))) {
        const b = document.getElementById('m-tasks');
        b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-4deg)' }, { transform: 'scale(1)' }], { duration: 500, iterations: 2 });
    }
    save();
}

// ------------------------------------------------------------------ events
function flushEvents(silent = false) {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (silent) return;
    for (const e of ev) {
        switch (e.type) {
            case 'board': digView.play(e.list); for (const b of e.list) seen['b:' + b.type] = (seen['b:' + b.type] || 0) + 1; break;
            case 'digwon': pending = e; break;
            case 'diglost': pending = e; break;
            case 'moremoves': ui.moves(G.dig.B.moves, BOOSTER_MOVES); break;
            case 'till': audio.ui('coin'); ui.popup(`+${e.coins}`, museum.anchor('till'), '#ffd56a', true); break;
            case 'away': ui.toast(`While you were away, visitors left ${e.coins} coins in the till.`); break;
            case 'task': {
                audio.ui('task');
                const t = TASK[e.id];
                museum.focus(['entrance', 'ancients', 'fossils', 'sea', 'great'][t.ch]);
                const lines = SCENES[e.id];
                if (lines) queueScene(lines);
                break;
            }
            case 'staff': audio.ui('hire'); queueAfter(() => ui.toast(`${PEOPLE[e.id].name} joined the museum! ${PEOPLE[e.id].perk}`)); break;
            case 'chapter': queueAfter(() => { const ch = e.ch + 1; if (ch < CHAPTERS.length) ui.chapterCard(ch, CHAPTERS[ch].title); pulseDig(); }); break;
            case 'finale': queueScene(SCENES.finale, () => ui.chapterCard('end', 'Thank you for playing!')); break;
            case 'decor': audio.ui('task'); ui.toast('Placed on the island!'); break;
            case 'booster': audio.ui('coin'); break;
            case 'dinoready': ui.toast(`Every ${DINOS.find((d) => d.id === e.dino).name} bone found! Build it from the Tasks list.`); break;
            default: break;
        }
    }
}

// scenes play one after another
const sceneQ = [];
function queueScene(lines, after) { sceneQ.push({ lines, after }); }
function queueAfter(fn) { sceneQ.push({ fn }); }
function pumpScenes() {
    if (ui.inScene() || !sceneQ.length || mode === 'title') return;
    const s = sceneQ.shift();
    if (s.fn) { s.fn(); return; }
    ui.scene(s.lines, G.name, () => { s.after?.(); museum.refresh(G); ui.museum(G); });
}

// ------------------------------------------------------------------ keys and pads
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const k = press.key;
    if (ui.inScene()) { if (k === 'Enter' || k === 'Space' || k === 'KeyZ') ui.advance(); else if (k === 'Escape') ui.endScene(); return; }
    if (ui.anyScreen()) {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' && !['title', 'win', 'lose'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (k === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'museum') {
        if (k === 'Escape' || k === 'KeyP') openMenu();
        else if (k === 'Enter' || k === 'KeyD') document.getElementById('m-dig').click();
        else if (k === 'KeyT') document.getElementById('m-tasks').click();
        else if (k === 'KeyJ') document.getElementById('m-journal').click();
        else if (k === 'KeyS') document.getElementById('m-shop').click();
        else if (k === 'KeyC') ui.cb?.onTill?.();
        else if (k === 'ArrowLeft') museum.pan(60, 0);
        else if (k === 'ArrowRight') museum.pan(-60, 0);
        else if (k === 'ArrowUp') museum.pan(0, 60);
        else if (k === 'ArrowDown') museum.pan(0, -60);
        else if (k === 'KeyQ') museum.rig.yaw += 0.2;
        else if (k === 'KeyE') museum.rig.yaw -= 0.2;
        else if (k === 'Equal' || k === 'NumpadAdd') museum.zoom(-0.15);
        else if (k === 'Minus' || k === 'NumpadSubtract') museum.zoom(0.15);
        else if (k === 'KeyM') toggleMap();
        else if (k === 'KeyH') museum.focus('museum');
        return;
    }
    if (mode === 'dig' && G.dig) {
        const B = G.dig.B;
        if (k === 'Escape' || k === 'KeyP') { if (hammerOn) toggleHammer(false); else openMenu(); return; }
        if (k === 'KeyH') { toggleHammer(); return; }
        if (k === 'KeyX') { doShuffle(); return; }
        const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
        if (!cursor) { cursor = firstCell(B); digView.setCursor(cursor); if (!dirs[k]) return; }
        if (dirs[k]) {
            const [dr, dc] = dirs[k];
            if (digView.selected) {
                const s = digView.selected;
                digView.select(null);
                doSwap(s.r, s.c, s.r + dr, s.c + dc);
                cursor = { r: s.r + dr, c: s.c + dc };
            } else {
                let r = cursor.r + dr, c = cursor.c + dc;
                while (r >= 0 && c >= 0 && r < B.R && c < B.C && !B.mask[r * B.C + c]) { r += dr; c += dc; }
                if (r >= 0 && c >= 0 && r < B.R && c < B.C) cursor = { r, c };
            }
            digView.setCursor(cursor);
        } else if (k === 'Space' || k === 'Enter' || k === 'KeyZ') {
            if (hammerOn) { doHammer(cursor.r, cursor.c); return; }
            digView.select(digView.selected ? null : { ...cursor });
        }
    }
}
function firstCell(B) { for (let r = Math.floor(B.R / 2); r < B.R; r++) for (let c = Math.floor(B.C / 2); c < B.C; c++) if (B.mask[r * B.C + c]) return { r, c }; return { r: 0, c: 0 }; }

// ------------------------------------------------------------------ the frame
function save() { if (mode !== 'title') saveGame(G); }

function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const dt = real * FAST;
    time += real;
    handlePresses();
    pumpScenes();
    ui.tick(real);
    if (mode !== 'title') {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) { Gm.step(G, null, STEP); acc -= STEP; n++; }
        if (n >= 12 * FAST) acc = 0;
        saveT += real;
        if (saveT > 15) { saveT = 0; save(); }
    }
    if (autoplay && canPlay() && !hammerOn) {
        const m = botMove(G.dig.B, autoplay);
        if (m) doSwap(m[0][0], m[0][1], m[1][0], m[1][1]);
    }
    if (mode === 'dig') {
        digView.frame(dt, time);
    } else {
        museum.frame(real, time);
        if (mode === 'museum') {
            ui.till(G, museum.anchor('till'));
            ui.mapLabels(museum.labels());
            if (Math.floor(time * 2) !== Math.floor((time - real) * 2)) ui.museum(G);
            gullT -= real;
            if (gullT < 0) { gullT = 8 + Math.random() * 14; audio.gull(); }
        }
    }
}

// the page itself never scrolls (scrollIntoView or a focused field can scroll the root even with overflow hidden)
window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'dig' && !ui.anyScreen()) openMenu(); save(); } });
window.addEventListener('pagehide', () => save());

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__cc = {
        get G() { return G; },
        get mode() { return mode; },
        get busy() { return digView.busy(); },
        get frames() { return digView.frames; },
        seen, digView, museum, ui, audio, input, stage,
        /** Skip the title: a new game (intro done unless keepIntro). */
        start(seed = 1, name = 'Tester', keepIntro = false) {
            const g = Gm.newGame(seed, name);
            if (!keepIntro) g.introDone = true;
            begin(g, 0);
            return G;
        },
        dig(n) { startDig(n ?? Gm.nextLevel(G)); return !!G.dig; },
        autoplay(on = true, skill = 1) { autoplay = on ? makeBot({ skill, seed: 5 }) : null; },
        /** Win the current dig in the sim at once, then let the view catch up. */
        win() {
            const b = makeBot({ skill: 1, seed: 9 });
            const B = G.dig.B;
            for (let i = 0; i < 300 && B.state === 'play'; i++) { const m = botMove(B, b); Bd.trySwap(B, ...m[0], ...m[1]); B.ev.length = 0; if (B.moves <= 1 && B.state === 'play') B.moves += 5; }
            Gm.digSwap(G, -1, -1, -1, -1);
            G.events = G.events.filter((e) => e.type !== 'board');
            digView.sync(B);
            flushEvents();
            afterScript();
            return G.dig.result;
        },
        /** Play the story ahead in the sim: n digs with tasks done between them. */
        story(digs) { playGame(G, { skill: 1, seed: 4, limit: digs }); G.events.length = 0; museum.refresh(G); ui.museum(G); save(); return G.level; },
        give(stars = 0, coins = 0) { G.stars += stars; G.coins += coins; ui.museum(G); },
        task: (id) => { const ok = Gm.doTask(G, id); afterAction(); return ok; },
        ff(sec) { Gm.step(G, null, sec); },
        save: () => saveGame(G),
        hasSave,
        cell: (r, c) => digView.toScreenCell(r, c),
        setCursor(r, c) { cursor = { r, c }; digView.setCursor(cursor); },
        moves: () => (G.dig ? Bd.findMoves(G.dig.B) : []),
    };
}
