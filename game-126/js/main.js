// EMBERSPIRE — entry point. Boots the UI, runs the sim, routes input and events, and moves between the title,
// the town and the tower.
//
// ?debug=1 exposes window.__es for the dev/ harnesses; &fast=N runs N x battle pacing (and animation) per frame.

import { STEP, MAX_FRAME, VERSION } from './config.js';
import { Stage, W, H } from './view/stage.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { preload, ART } from './assets.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, step, autoResolve, joined } from './sim/game.js';
import { startBattle } from './sim/battle.js';
import { makeBot, playDay, dayString } from './sim/bot.js';
import { HERO, CLASSES } from './sim/data/heroes.js';
import { BLESSINGS } from './sim/data/story.js';
import { gearName, rankOfFloor } from './sim/stats.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const stage = new Stage($('stage'), $('floaters'));
stage.hitSound = (e) => audio.hit(e);
stage.onBanner = (text) => { const b = $('battle-banner'); b.hidden = false; b.textContent = text; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; setTimeout(() => { b.hidden = true; }, 1700); };

let G = null;
let mode = 'title';            // title | town | tower
const seen = {};               // a count of every sim event drained, for the tests
let lastBattleKey = '';
let acc = 0;
let last = performance.now();
let idleTimer = 0;

const ui = new UI({
    audio, settings,
    send: (cmd) => send(cmd),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); stage.speed = s.speed * FAST; },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onQuit: () => { if (G) saveGame(G); toTitle(); },
});
ui.stage = stage;
ui.onSpeed = (s) => { saveSettings(settings); stage.speed = s * FAST; };
stage.speed = settings.speed * FAST;

preload([ART.bg('title'), ART.bg('town'), ART.bg('tavern'), ART.bg('tavern-night')]);

// ------------------------------------------------------------------ title
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        if (hasSave() && !confirm('Start a new game? Your saved game will be replaced.')) return;
        startGame(newGame((Date.now() % 1e9) | 0), true);
    } else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g, false); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startGame(g, fresh) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    input.flush();
    act(G, { t: 'idle', now: Date.now() });
    G.events.length = 0;
    if (G.mode === 'tower' && G.battle) { toTower(); }
    else toTown();
    if (fresh && !G.flags.intro) {
        act(G, { t: 'flag', k: 'intro' });
        ui.story([
            { por: 'watcher', who: 'The Watcher', voice: 'watcher-intro', lines: ['Thirty years ago, a tower of black stone rose over Hearthmere in a single night.', 'It has no top that anyone has seen. Every floor is stronger than the last. Every tenth floor, something terrible keeps the stair.'] },
            { por: 'arin', who: 'Arin', lines: ['My father led the last patrol up those stairs. He never came down.', 'I\'m going up. As far as it goes.'] },
            { por: 'mira', who: 'Mira', lines: ['Not alone, you\'re not. I\'ve packed bandages, a lantern, and an extremely stern expression.', 'Let\'s see Old Bram first. If anyone knows who else is mad enough to come, it\'s him.'] },
            { por: 'bram', who: 'Old Bram', lines: ['Two more for the tower, eh? Then here\'s the way of it: climb by day, come home by night.', 'The town pays a tithe for every floor you clear, even while you sleep. Spend your evenings here with your friends. You\'ll need them.'], end: 'Into Hearthmere' },
        ], () => afterTownEnter());
    } else afterTownEnter();
    save();
}

function afterTownEnter() {
    if (!G || G.mode !== 'town') return;
    if (act(G, { t: 'daily', day: today() })) flushEvents();
    else G.events.length = 0;
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    G = null;
    $('battle').hidden = true;
    ui.showTopbar(false);
    ui.setBg(null);
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function toTown() {
    mode = 'town';
    $('battle').hidden = true;
    stage.setPick(null);
    for (const id of ['victory', 'title']) if (ui.stack.includes(id)) ui.closeScreen(id);
    ui.showTopbar(true);
    ui.renderTown(G);
    if (!ui.stack.includes('town')) ui.openScreen('town');
    if (ui.place) ui.renderPlace(G);
    ui.topbar(G);
    audio.play(G.phase === 'evening' ? 'evening' : 'town');
}

function toTower() {
    mode = 'tower';
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.place = null;
    $('town').style.visibility = '';
    ui.bmenu = 'root';
    $('battle').hidden = false;
    ui.showTopbar(false);
    layout();
    if (G.battle) { stage.setBattle(G); stage.sync(G); }
    // The theme normally starts with the battle's 'battle' event. Continuing a saved fight (a reload mid-battle)
    // has no such event, and the title music played on through the fight.
    const B = G.battle;
    if (B) audio.play(['won', 'lost', 'fled'].includes(B.phase) ? null : B.rank === 'boss' ? 'boss' : 'battle');
    ui.renderBattle(G, stage);
    ui.topbar(G);
}

// ------------------------------------------------------------------ commands
function send(cmd) {
    if (!G) return false;
    const okay = act(G, cmd);
    if (!okay) { audio.ui('no'); return false; }
    if (['buy', 'buyGear', 'buyShard', 'coreTrade', 'recruit'].includes(cmd.t)) audio.ui('buy');
    flushEvents();
    refresh();
    if (G.mode === 'town') save();
    return true;
}

function refresh() {
    if (!G) return;
    if (G.mode === 'tower') {
        if (mode !== 'tower') toTower();
        else { ui.renderBattle(G, stage); ui.topbar(G); }
        return;
    }
    if (mode !== 'town') toTown();
    ui.topbar(G);
    if (G.scene) { ui.renderScene(G); return; }
    if (ui.stack.includes('scene') && $('scene').dataset.kind === 'eve') { ui.closeScreen('scene'); ui.setBg('town', G.phase === 'evening'); }
    if (ui.place) ui.renderPlace(G); else ui.renderTown(G);
    audio.play(G.phase === 'evening' ? 'evening' : 'town');
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (G.mode === 'tower' || ev.some((e) => e.type === 'battle')) stage.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            case 'battle': ui.levelled = {}; ui.bmenu = 'root'; if (ui.stack.includes('victory')) ui.closeScreen('victory'); break;
            case 'levelup': if (ui.levelled) ui.levelled[e.id] = true; if (G.mode === 'town') ui.toast(`${HERO[e.id].name} reached level ${e.lv}!`); break;
            case 'evolve-ready': ui.toast(`${HERO[e.id].name} can evolve! Visit the Temple.`); break;
            case 'recruit': ui.toast(`${HERO[e.id].name} joins your company!`); break;
            case 'upgrade': ui.toast(`Upgraded to +${e.plus}!`); break;
            case 'reforge': ui.toast(`Reforged to item level ${e.lvl}.`); break;
            case 'learn': ui.toast(`Learned ${e.rank > 1 ? 'rank ' + e.rank + ' ' : ''}${skillName(e.skill)}.`); break;
            case 'evolve': ui.popup(`${HERO[e.id].name} becomes a ${CLASSES[e.cls].name}!`, ui.para(`New skills await at the Temple: ${CLASSES[e.cls].skills.map((s) => s.name).join(', ')}. At level 40, ${CLASSES[e.cls].name}s can ascend.`)); break;
            case 'ascend': ui.toast(`${HERO[e.id].name} ascends: ${e.name}!`); break;
            case 'equipBest': ui.toast(e.n ? `${e.auto ? 'Auto-equip: ' : ''}${e.n} piece${e.n === 1 ? '' : 's'} of gear changed hands. Everyone wears their best.` : 'Everyone already wears their best.'); break;
            case 'salvage': ui.toast(`Salvaged for ${e.ore} ore.`); break;
            case 'trade': ui.toast(`Zephyrine hands over ${gearName(G.gear[e.uid])}.`); break;
            case 'claim': ui.popup('Bounty paid', ui.rewardChips(G, e.got)); break;
            case 'daily': {
                const bl = BLESSINGS.find((b) => b.id === e.blessing);
                ui.popup(`Daily bonus · day ${e.streak} of your streak`, ui.para('Welcome back to Hearthmere. Old Bram has kept something aside for you.', ui.rewardChips(G, e.got), bl ? ui.para(`Today's blessing — ${bl.name}: ${bl.desc}`, null, 'gold') : null));
                break;
            }
            case 'collect': ui.popup('While you were away', ui.rewardChips(G, { gold: e.gold, ore: e.ore })); break;
            case 'keepsake': ui.toast(`${HERO[e.id].name} gave you ${gearName(G.gear[e.uid])}!`); break;
            case 'bond-sp': ui.toast(`${HERO[e.id].name} gains 2 skill points from your friendship.`); break;
            case 'watcher': pendingWatcher = e; break;
            case 'home': if (e.run) ui.toast(`Home again. ${e.run.floors} floor${e.run.floors === 1 ? '' : 's'} climbed, ${e.run.gold} gold found.`); break;
            case 'defeat': if (e.loss) ui.toast(`Lost ${e.loss} gold on the way home.`); break;
            case 'rest': ui.toast(`Day ${e.day}. The sun rises over the Emberspire.`); afterTownEnter(); break;
        }
    }
}
let pendingWatcher = null;
function skillName(id) { for (const c of Object.values(CLASSES)) for (const s of c.skills) if (s.id === id) return s.name; return id; }

// ------------------------------------------------------------------ layout
function layout() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
    const wrap = $('stage-wrap');
    let sw, sh;
    const side = w / h >= 1 && h < 560;
    $('battle').classList.toggle('side', side);
    if (side) {
        sw = Math.min(w - 320, Math.round(h * 16 / 9));
        sh = Math.round(sw * 9 / 16);
    } else if (w / h < 1) { sw = w; sh = Math.round(w * 9 / 16); }
    else {
        const panelH = Math.max(150, Math.min(240, Math.round(h * 0.34)));
        sh = Math.min(h - panelH - 10, Math.round(w * 9 / 16));
        sw = Math.round(sh * 16 / 9);
        if (sw > w) { sw = w; sh = Math.round(w * 9 / 16); }
    }
    wrap.style.width = sw + 'px';
    wrap.style.height = sh + 'px';
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const p = input.next();
    if (!p) return;
    const k = p.key;
    const top = ui.top();
    const modal = top && document.getElementById(top).classList.contains('modal');
    const clickFocused = () => { if (p.pad) document.activeElement?.click?.(); };
    if (modal || (top && mode !== 'tower')) {
        if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && false)) ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' || k === 'KeyX') {
            if (top === 'place') { audio.ui('back'); ui.closePlace(G); }
            else if (['howto', 'settings', 'popup'].includes(top)) { audio.ui('back'); ui.closeTop(); }
        } else if (k === 'Enter' || k === 'KeyZ') clickFocused();
        return;
    }
    if (mode === 'tower') {
        if (/^Digit[1-5]$/.test(k)) document.querySelector(`#cmds [data-k="c-${k.slice(5)}"]`)?.click();
        else if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1, 'battle');
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1, 'battle');
        else if (k === 'Escape' || k === 'KeyX') { if (!ui.battleBack()) ui.openScreen('settings'); }
        else if (k === 'KeyA') send({ t: 'auto', on: !G.auto });
        else if (k === 'Enter' || k === 'KeyZ') clickFocused();
    }
}

// ------------------------------------------------------------------ frame loop
function battleKey() {
    const B = G?.battle;
    if (!B) return '';
    return `${B.floor}|${B.phase}|${B.turn}|${stage.busy || G.events.length > 0}|${G.auto}|${G.autoClimb}|${ui.bmenu}`;
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handlePresses();
    if (G && mode === 'tower' && G.mode === 'tower') {
        acc += dt * settings.speed * FAST;
        let n = 0;
        while (acc >= STEP && n < 24 * FAST) {
            step(G, { hold: stage.busy || G.events.length > 0 }, STEP);
            flushEvents();
            acc -= STEP;
            n++;
        }
        stage.update(dt);
        stage.draw();
        ui.renderPartyStatus(G, stage);
        const key = battleKey();
        if (key !== lastBattleKey) { lastBattleKey = key; ui.renderBattle(G, stage); ui.topbar(G); }
        const B = G.battle;
        ui.tickAutoNext(dt * FAST);
        if (B && !stage.busy && ['won', 'lost', 'fled'].includes(B.phase) && !ui.stack.includes('victory')) {
            // auto-climb carries on by itself, except after a defeat and before a mini boss or boss
            const autoOn = G.autoClimb && (B.phase === 'fled' || (B.phase === 'won' && rankOfFloor(B.floor + 1) === 'normal'));
            if (!autoOn) { ui.renderAfter(G); save(); }
        }
        if (B && B.phase === 'won' && !stage.busy && pendingWatcher && !ui.stack.includes('scene')) {
            const w = pendingWatcher; pendingWatcher = null;
            ui.story([{ por: 'watcher', who: 'The Watcher', lines: [w.line] }]);
        }
    } else if (G && G.mode === 'town' && mode === 'tower') {
        // the sim went home by itself (auto-climb turned back)
        refresh();
        save();
    } else if (G && G.mode === 'tower' && mode !== 'tower') refresh();
    if (G && mode === 'town') {
        idleTimer += dt;
        if (idleTimer > 30) { idleTimer = 0; act(G, { t: 'idle', now: Date.now() }); if (ui.place === 'treasury') ui.renderPlace(G); }
    }
}

function save() { if (G) saveGame(G); }
document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else if (G) { act(G, { t: 'idle', now: Date.now() }); if (mode === 'town') { afterTownEnter(); refresh(); } }
});
window.addEventListener('pagehide', save);
setInterval(() => { if (G && mode === 'tower') save(); }, 15000);

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__es = {
        get G() { return G; },
        get mode() { return mode; },
        seen, stage, ui, audio, input, VERSION,
        /** New game, no intro, straight to town. */
        start(seed = 1) { const g = newGame(seed); g.flags.intro = true; startGame(g, false); return G; },
        send,
        act: (cmd) => { const r = act(G, cmd); flushEvents(); refresh(); return r; },
        /** The bot plays n whole days in a blink (town, a climb, an evening, rest). */
        days(n = 1) { const b = makeBot(); for (let i = 0; i < n; i++) playDay(G, b, dayString(100 + i), Date.now()); G.events.length = 0; refresh(); return G.best; },
        /** Start a fight on any floor, skipping the climb (screenshots, tests). */
        fight(f) { G.mode = 'tower'; G.scene = null; G.run = { start: f, floor: f, gold: 0, xp: 0, kills: 0, floors: 0 }; startBattle(G, f); flushEvents(); refresh(); return G.battle.units.map((u) => u.name); },
        /** Resolve the current battle with the AI. */
        resolve() { const r = autoResolve(G); flushEvents(); return r; },
        give(gold = 1e6) { G.gold += gold; G.inv.ore += 200; G.inv.shard += 40; G.inv.core += 9; refresh(); },
        get busy() { return stage.busy || (G?.events.length ?? 0) > 0; },
        save: () => saveGame(G), hasSave,
    };
}
