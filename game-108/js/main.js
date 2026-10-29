// Oathstones — entry point. Boots the view, routes input to sim commands, plays the events back,
// and moves between the title, the camp and a battle.
//
// ?debug=1 exposes window.__os for the dev/ harnesses; &fast=N plays animations N× faster.

import { MAX_FRAME, BOARD } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, describeToken } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act } from './sim/game.js';
import { makeBot, botCommand, battleCommand, botResult } from './sim/bot.js';
import { findMoves, adjacent } from './sim/board.js';
import { HERO, ENEMIES, STAGES, REGIONS, OATHS, COLORS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);
const W = BOARD.w, N = BOARD.w * BOARD.h;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();

let G = newGame(1);           // the player's game (replaced by New Game or Continue)
let demo = null;              // the attract board the bot plays behind the title and the camp
let demoBot = null;
let mode = 'title';           // title | camp | battle
let time = 0, last = performance.now();
let bot = null;               // the debug autoplayer
let idleT = 0;                // seconds the battle board has waited for the player
let demoT = 0;
const seen = {};              // a count of every sim event drained, for the tests

const live = () => mode === 'battle';
const view = new View($('view'), {
    floats: $('floats'),
    hooks: {
        battleOpen: () => { if (live()) { ui.battleOpen(G); updatePads(); } },
        enemy: (e) => {
            if (!live()) return;
            ui.setEnemy(e.enemy, e.wave, e.waves);
            ui.banner(ENEMIES[e.enemy.id].name, 'foe', e.waves > 1 ? `Wave ${e.wave + 1} of ${e.waves}` : STAGES[G.B.stage].name);
        },
        arrive: (e) => {
            if (!live()) return;
            const h = HERO[e.hero];
            ui.banner(`${h.name} arrives`, '', `Oath of ${OATHS[h.oath].name} — ${OATHS[h.oath].text}`);
            audio.arrive();
            ui.calling(G);
        },
        change: (e) => { if (live() && e.cause === 'arrive' && e.kind === 'bind') audio.curse(); },
        nope: () => { if (live()) { audio.ui('nope'); ui.info('Those two make no line that every oath accepts. Tap a token to read its oath.'); } },
        combo: (e) => {
            if (!live()) return;
            audio.clear(e.combo, e.cells.length, e.cells.some((c) => c.h));
            ui.combo(e.combo);
        },
        enemyHp: (hp) => { if (live()) { ui.enemyHp(hp); audio.hit(false); } },
        enemyCd: (cd) => { if (live()) ui.enemyCd(cd, G.B?.enemy); },
        partyHit: (e) => {
            if (!live()) return;
            audio.hurt();
            ui.partyHp(e.hp, G.B.maxHp, G.B.shield);
            ui.partyFloat(e.dmg ? `-${e.dmg}` : 'Blocked', 'hurt');
            if (e.blocked) ui.partyFloat(`🛡 ${e.blocked}`, 'info');
        },
        partyHeal: (e) => { if (live()) { audio.heal(); ui.partyHp(e.hp, G.B.maxHp, G.B.shield); ui.partyFloat(`+${e.n}`, 'heal'); } },
        partyShield: (e) => { if (live()) { audio.ward(); ui.partyHp(G.B.hp, G.B.maxHp, e.shield); } },
        banner: (text, kind) => { if (live()) { ui.banner(text, kind); if (kind === 'foe') audio.curse(); } },
        skill: (e) => { if (live()) { audio.skill(); ui.banner(e.name, '', HERO[e.hero].name); ui.updateCharges(G); } },
        charge: () => { if (live()) ui.updateCharges(G); },
        wake: () => { if (live()) audio.ui('select'); },
        recruit: (e) => {
            if (!live()) return;
            const h = HERO[e.hero];
            ui.banner(e.isNew ? `${h.name} is bound to you!` : `${h.name} rises to rank +${e.rank}`, '', e.isNew ? `${h.title} joins your roster` : 'A second oath, deeper than the first');
            audio.recruit();
        },
        defeat: () => { if (live()) audio.defeat(); },
        result: (kind) => {
            if (!live()) return;
            audio.setMood('camp');
            setTimeout(() => { if (live() && G.B?.over) ui.showResult(G); }, 500 / view.speed);
        },
        idle: () => { if (live()) syncHud(); },
        portrait: (id, url) => ui.portraitReady(id, url),
    },
});

const ui = new UI({
    audio, settings, view,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    cmd: (name, arg) => campCmd(name, arg),
});
ui.onSkillButton = (b, k) => input.bindButton(b, () => trySkill(k));

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    view.speed = FAST * (settings.quick ? 1.8 : 1);
    view.setCalm(!!settings.calm);
    document.body.classList.toggle('calm', !!settings.calm);
}
applySettings();

// ------------------------------------------------------------------ layout
function updatePads() {
    if (mode === 'battle') { view.setPad(ui.pads()); return; }
    const top = ui.top();
    const side = top === 'camp' && innerWidth >= 900;
    view.setPad({ top: 40, bottom: 10, left: side ? $('camp').querySelector('.sheet').getBoundingClientRect().right + 10 : 0, right: 0 });
}
ui.on = (name) => { if (name === 'screens' || name === 'pads') updatePads(); };
window.addEventListener('resize', () => requestAnimationFrame(updatePads));
window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updatePads));

// ------------------------------------------------------------------ events
function drain(g = G) {
    if (!g.events.length) return;
    const ev = g.events.splice(0);
    if (g === G) for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (g === G && mode !== 'battle') {
        // camp events (a summon) have nothing to animate on the board
        for (const e of ev) if (e.type === 'summon') onSummon(e);
        return;
    }
    if ((g === G) === live()) view.push(ev);
}

function onSummon(e) {
    const best = Math.max(...e.got.map((id) => HERO[id].r));
    audio.summon(best);
    ui.renderCamp(G);
    ui.showReveal(e.got);
}

// ------------------------------------------------------------------ the attract board
function startDemo() {
    demo = newGame(((Date.now() * 2654435761) >>> 0) % 1e9 | 1);
    demo.progress = STAGES.length - 1;
    for (const h of Object.values(HERO)) if (h.r >= 4 && Object.keys(demo.roster).length < 6) demo.roster[h.id] = { lv: 6, xp: 0, rank: 0 };
    demo.party = Object.keys(demo.roster).slice(-4);
    demoBot = makeBot({ skill: 1, seed: 3 });
    nextDemoBattle();
}
function nextDemoBattle() {
    const st = Math.floor(Math.random() * STAGES.length);
    demo.B = null;
    demo.calls = [Object.keys(HERO)[Math.floor(Math.random() * 21)]];
    act(demo, { t: 'battle', stage: st });
    view.reset();
    view.quiet = true;
    view.push(demo.events.splice(0));
}
function stepDemo(dt) {
    if (!demo || live() || view.busy) return;
    demoT += dt;
    if (demoT < 1.1) return;
    demoT = 0;
    if (demo.B?.over) { nextDemoBattle(); return; }
    const c = battleCommand(demo, demoBot);
    if (c) act(demo, c); else nextDemoBattle();
    view.push(demo.events.splice(0));
}

// ------------------------------------------------------------------ modes
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function goTitle() {
    ui.closeAll();
    ui.showHud(false);
    mode = 'title';
    if (!demo || view.quiet !== true) startDemo();
    refreshTitle();
    audio.setMood('title');
    ui.openScreen('title');
}

function goCamp(tab) {
    ui.closeAll();
    ui.showHud(false);
    const was = mode;
    mode = 'camp';
    if (was === 'battle' || !demo) startDemo();
    if (G.B?.over) act(G, { t: 'leave' });
    saveGame(G);
    if (tab) ui.tab = tab;
    ui.renderCamp(G);
    ui.setTab(ui.tab);
    audio.setMood('camp');
    ui.openScreen('camp');
}

function enterBattle(fresh = true) {
    ui.closeAll();
    mode = 'battle';
    demo = null;
    view.reset();
    view.quiet = false;
    input.flush();
    document.activeElement?.blur?.();
    sel = null;
    cursor = null;
    idleT = 0;
    ui.showHud(true);
    if (fresh) drain();
    else {
        view.syncBoard(G.B);
        ui.battleOpen(G);
        ui.setEnemy(G.B.enemy, G.B.wave, G.B.waves.length);
    }
    const st = STAGES[G.B.stage];
    audio.setMood(st.boss ? 'boss' : 'battle' + REGIONS[st.region].sky);
    updatePads();
    saveGame(G);
}

function fight(stage) {
    if (G.B?.over) act(G, { t: 'leave' });
    const r = act(G, { t: 'battle', stage });
    if (!r.ok) { ui.toast(r.why === 'locked' ? 'That stage is still locked.' : 'You can’t start that battle.'); return; }
    enterBattle(true);
}

function pause() {
    if (mode !== 'battle' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function campCmd(name, arg) {
    if (name === 'title') { saveGame(G); goTitle(); }
    else if (name === 'brief') ui.showBrief(G, arg);
    else if (name === 'fight') fight(arg);
    else if (name === 'summon') {
        const r = act(G, { t: 'summon', n: arg });
        if (!r.ok) { ui.toast(r.why === 'crystals' ? 'Not enough crystals.' : r.why === 'calling full' ? 'The calling is full: bind the heroes waiting first.' : 'The stone is silent.'); return; }
        drain();
        saveGame(G);
    } else if (name === 'hero') ui.showHero(G, arg);
    else if (name === 'toggleParty') {
        const ids = G.party.includes(arg) ? G.party.filter((x) => x !== arg) : [...G.party, arg];
        const r = act(G, { t: 'party', ids });
        if (!r.ok) return;
        audio.ui('click');
        saveGame(G);
        ui.closeScreen('hero');
        ui.renderCamp(G);
        if (ui.stack.includes('brief')) { ui.closeScreen('brief'); ui.showBrief(G, ui.briefStage); }
    } else if (name === 'camp') goCamp('journey');
    else if (name === 'retry') { const s = G.B.stage; act(G, { t: 'leave' }); fight(s); }
    else if (name === 'next') { const s = G.B.stage + 1; act(G, { t: 'leave' }); fight(s); }
}

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        G = newGame(((Date.now() * 2654435761) >>> 0) % 1e9 | 1);
        saveGame(G);
        goCamp('journey');
        ui.showBrief(G, 0);
    } else if (a === 'continue') {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); return; }
        G = g;
        if (G.B && !G.B.over) enterBattle(false); else goCamp('journey');
    } else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'flee') { ui.closeScreen('pause'); act(G, { t: 'flee' }); drain(); }
    else if (a === 'quit') { saveGame(G); goTitle(); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ the board
let sel = null, cursor = null;
const ready = () => live() && !ui.anyScreen() && !view.busy && !G.events.length && G.B && !G.B.over;

function setSel(i) {
    sel = i;
    view.setSel(i);
    ui.info(i == null ? null : describeToken(G.B.g[i]));
}

function trySwap(i, j) {
    view.setHint(null);
    idleT = 0;
    const r = act(G, { t: 'swap', i, j });
    setSel(null);
    if (!r.ok && r.why === 'frozen') { audio.ui('nope'); ui.info('That one is <b>frozen</b>: make a match beside it to thaw it.'); }
    else if (!r.ok && r.why === 'stuck') { audio.ui('nope'); ui.info('<b>Rubble</b> can’t be moved. A match beside it breaks it.'); }
    else if (r.ok) audio.ui('swap');
    drain();
    if (r.ok) saveGame(G);
}

function trySkill(k) {
    if (!ready()) return;
    const p = G.B.party[k];
    if (!p) return;
    const h = HERO[p.id];
    if (p.charge < h.skill.cost) { audio.ui('nope'); ui.info(`<b>${h.skill.name}</b> needs ${h.skill.cost - p.charge} more ${COLORS[h.c].name} stones. ${h.skill.text}`); return; }
    const r = act(G, { t: 'skill', k });
    if (r.ok) { setSel(null); drain(); saveGame(G); }
}

function tapCell(i) {
    if (!ready()) return;
    idleT = 0;
    const t = G.B.g[i];
    if (sel == null) { setSel(i); audio.ui('select'); return; }
    if (sel === i) { setSel(null); return; }
    if (adjacent(sel, i)) { trySwap(sel, i); return; }
    setSel(i);
    audio.ui('select');
    void t;
}

input.bindBoard($('view'), (x, y) => view.stage.pick(x, y), () => view.cellScreen(25).x - view.cellScreen(24).x);
input.onBoard = (e) => {
    if (!ready() || !e.cell) return;
    const i = e.cell.y * W + e.cell.x;
    if (e.kind === 'tap') { cursor = null; view.setCursor(null); tapCell(i); return; }
    const x = e.cell.x + e.dir[0], y = e.cell.y + e.dir[1];
    if (x < 0 || y < 0 || x >= W || y >= BOARD.h) return;
    trySwap(i, y * W + x);
};

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'camp', 'result'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && (press.pad || !press.onButton)) document.activeElement?.click?.();
        return;
    }
    if (!live()) return;
    if (key === 'Escape' || key === 'KeyP') { pause(); return; }
    if (!ready()) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (d) {
        idleT = 0;
        if (cursor == null) cursor = sel ?? 24;
        const x = Math.max(0, Math.min(W - 1, (cursor % W) + d[0])), y = Math.max(0, Math.min(BOARD.h - 1, ((cursor / W) | 0) + d[1]));
        const ni = y * W + x;
        if (sel != null && adjacent(sel, ni) && sel === cursor) { cursor = ni; view.setCursor(ni); trySwap(sel, ni); return; }
        cursor = ni;
        view.setCursor(ni);
        ui.info(describeToken(G.B.g[ni]));
        return;
    }
    if (key === 'Space' || key === 'Enter') { if (cursor != null) tapCell(cursor); return; }
    if (/^Digit[1-4]$/.test(key)) { trySkill(+key.slice(5) - 1); return; }
    if (key === 'KeyH') showHint();
}

function showHint() {
    const m = findMoves(G.B.g, 1)[0];
    if (m) view.setHint(m);
}

function syncHud() {
    const B = G.B;
    if (!B) return;
    if (B.enemy) { ui.foeMax = B.enemy.maxHp; ui.enemyHp(B.enemy.hp); ui.enemyCd(B.enemy.cd, B.enemy); }
    ui.partyHp(B.hp, B.maxHp, B.shield);
    ui.updateCharges(G);
    ui.calling(G);
    if (sel != null) ui.info(describeToken(B.g[sel]));
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (live()) {
        if (bot && ready()) {
            const c = botCommand(G, bot);
            if (c) { act(G, c); botResult(G, bot); drain(); }
        }
        if (ready()) {
            idleT += dt;
            if (settings.hints && idleT > 9 && !view.hint) showHint();
        }
    } else stepDemo(dt * FAST);
    view.frame(dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); saveGame(G); } });
window.addEventListener('pagehide', () => saveGame(G));

startDemo();
goTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__os = {
        get G() { return G; },
        get mode() { return mode; },
        get busy() { return view.busy || G.events.length > 0; },
        get ready() { return ready(); },
        get sel() { return sel; },
        seen, view, ui, audio, input,
        /** A fresh game straight to the camp. */
        start(seed = 1) { G = newGame(seed); goCamp('journey'); return G; },
        fight(stage = 0) { fight(stage); return G.B; },
        act(cmd) { const r = act(G, cmd); drain(); return r; },
        autoplay(on = true) { bot = on ? makeBot({ skill: 1 }) : null; },
        /** The bot plays n battle commands synchronously; the events still reach the view. */
        ff(n = 10) {
            const b = makeBot({ skill: 1 });
            for (let k = 0; k < n && G.B && !G.B.over; k++) { const c = battleCommand(G, b); if (!c) break; act(G, c); }
            drain();
            return G.B?.over || null;
        },
        cellCenter: (i) => view.cellScreen(i),
        moves: () => findMoves(G.B.g),
        save: () => saveGame(G),
        hasSave,
        demo: () => demo,
        N,
    };
}
