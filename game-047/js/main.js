/**
 * main.js — boot, the frame loop, and the flow of a journey.
 *
 * The run (sim/run.js) is the single source of truth and is saved to
 * localStorage after every step. advance() looks at it and shows whatever it
 * is waiting on, in this order: queued story beats → queued card picks → a
 * card offer → the map or the current node (combat, reward, event, shop,
 * campfire, treasure) → death → the ending.
 *
 * three.js gotchas honoured here: dt is capped at 50 ms; resize updates both
 * cameras' projection matrices and the composer (scene.js); geometry shared
 * by many meshes is never disposed (cards3d.js flags it).
 */

import { initScene, renderer, render, onResize, setQuality, view } from './view/scene.js';
import { setMaxAniso } from './view/textures.js';
import * as K from './view/cards3d.js';
import { initFx, updateFx, fxFrame } from './view/fx.js';
import { stage, setWorld, setHero, setMode, updateStage } from './view/stage.js';
import * as R from './sim/run.js';
import { heroIdentity } from './sim/heroes.js';
import { FLOORS } from './sim/rules.js';
import * as S from './ui/screens.js';
import * as H from './ui/hud.js';
import { $, hideTip, toast, fade, wait, ICON } from './ui/dom.js';
import { startBattle, endBattle, updateBattle, battleActive, pointerDown, pointerMove, pointerUp, pointerCancel, battleKey, battleKeyUp, battleApi, battleResize, battleState } from './battle.js';
import { initAudio, setMusic, setVolumes, toggleMute, sfx, audioSettings } from './audio/audio.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const SAVE_KEY = 'ashes-aces-run', META_KEY = 'ashes-aces-meta', SET_KEY = 'ashes-aces-settings';

let run = null;
let screen = 'title';
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const meta = Object.assign({ best: 0, wins: 0, runs: 0, endings: {} }, store.get(META_KEY, {}));
const settings = Object.assign({ music: 0.7, sfx: 0.8, quality: 'auto', speed: '1' }, store.get(SET_KEY, {}));

function saveRun() { if (run) store.set(SAVE_KEY, run); }
function loadRun() { const r = store.get(SAVE_KEY, null); return r && R.validateRun(r) ? r : null; }
function saveMeta() { store.set(META_KEY, meta); }
function saveSettings() { store.set(SET_KEY, settings); }

// ------------------------------------------------------------------ boot

function boot() {
    initScene($('gl'));
    setMaxAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    setQuality(settings.quality === 'auto' ? (coarse ? 1 : 0) : Number(settings.quality));
    K.initCards();
    K.setTableVisible(false);
    initFx();
    setVolumes({ music: settings.music, sfx: settings.sfx });
    onResize(() => {
        K.computeLayout();
        battleResize();
        if (screen === 'map' && run) S.mapScreen(run, enterNode);
    });
    wireInput();
    wireHudButtons();
    showTitle();
    requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ frame loop

let last = performance.now(), T = 0, fpsAcc = 0, fpsN = 0, slow = 0;
function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(0.05, Math.max(0, dt));
    T += dt;
    fxFrame();
    updateStage(dt, T);
    updateBattle(dt);
    K.updateCards(dt, T);
    updateFx(dt);
    render(dt, T);
    // auto quality: a few slow seconds in a row drop one tier
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) {
        const fps = fpsN / fpsAcc;
        fpsAcc = 0; fpsN = 0;
        if (!DEBUG && settings.quality === 'auto' && view.quality < 2) {
            slow = fps < 38 ? slow + 1 : 0;
            if (slow >= 4) { setQuality(view.quality + 1); slow = 0; }
        }
    }
}

// ------------------------------------------------------------------ title & hero select

function showTitle() {
    screen = 'title';
    endBattle();
    S.closeModal();
    H.showHud(false);
    setMode('title');
    setHero(null);
    const w = Math.floor(Math.random() * 10);
    setWorld(w, 7);
    setMusic(w, 'title');
    const saved = loadRun();
    S.titleScreen({
        hasSave: !!saved,
        saveInfo: saved ? `${saved.name}, Level ${Math.min(100, saved.world * FLOORS + saved.floor + 1)}` : '',
        meta,
        onContinue: () => { run = loadRun(); if (run) startRun(); },
        onNew: () => heroSelect(),
        onHow: () => S.howModal(),
        onSettings: () => openSettings(false),
    });
}

function newSeed() { return (Math.random() * 0xffffffff) >>> 0; }

function heroSelect() {
    screen = 'heroes';
    let cls = 'knight', seed = newSeed();
    setWorld(0, 7);
    setMode('map');
    setMusic(0, 'map');
    const draw = () => {
        const ident = heroIdentity(seed, cls);
        setHero(ident.look);
        S.heroScreen({
            current: cls, ident,
            onPick: (k) => { cls = k; draw(); },
            onReroll: () => { seed = newSeed(); draw(); },
            onBack: () => showTitle(),
            onGo: () => {
                run = R.newRun(seed, cls, ident);
                meta.runs++;
                saveMeta();
                startRun();
            },
        });
    };
    draw();
}

function startRun() {
    H.showHud(true);
    setWorld(run.world, run.seed);
    setHero(run.look);
    advance();
}

// ------------------------------------------------------------------ the flow

function advance() {
    if (!run) return showTitle();
    saveRun();
    hideTip();
    H.renderHud(run);
    meta.best = Math.max(meta.best, Math.min(100, run.world * FLOORS + run.floor));
    saveMeta();

    if (run.story.length) return showStory(run.story[0]);
    if (run.picks.length) { screen = 'picker'; return S.pickerModal(run, advance); }
    if (run.pending?.cardOffer) return S.cardOfferModal(run, advance);

    switch (run.phase) {
        case 'map':
            screen = 'map';
            setMode('map');
            setMusic(run.world, 'map');
            return S.mapScreen(run, enterNode);
        case 'node': return showNode();
        case 'dead':
            screen = 'dead';
            setMode('map');
            return S.deadScreen(run, {
                onRekindle: () => { R.rekindle(run); setWorld(run.world, run.seed); advance(); },
                onNew: () => { store.del(SAVE_KEY); run = null; heroSelect(); },
                onTitle: () => { saveRun(); showTitle(); },
            });
        case 'ending':
            screen = 'ending';
            setMusic(run.world, 'map');
            return S.endingChoice(run, (k) => {
                R.chooseEnding(run, k);
                meta.endings[k] = 1;
                meta.wins++;
                meta.best = 100;
                saveMeta();
                sfx.victory();
                advance();
            });
        case 'done':
            screen = 'done';
            setMusic(run.world, 'victory');
            return S.endingScreen(run, () => { store.del(SAVE_KEY); run = null; showTitle(); }, () => S.chronicleModal(run));
        default: return S.mapScreen(run, enterNode);
    }
}

function showStory(item) {
    screen = 'story';
    setMode('map');
    const w = item.world ?? run.world;
    if (item.kind === 'chapter' || item.kind === 'rekindle') setWorld(w, run.seed);
    if (item.kind === 'opening') setMusic(0, 'title'); else setMusic(w, item.kind === 'bossIntro' ? 'boss' : 'map');
    const done = () => { run.story.shift(); advance(); };
    if (item.kind === 'interlude' && !item.log) {
        item.choose = (i) => {
            const log = R.chooseInterlude(run, i);
            if (!log) return;
            item.log = log.length ? log : ['The moment passes.'];
            delete item.choose;
            saveRun();
            H.renderHud(run);
            if (run.picks.length) {
                // resolve card choices first, then show the outcome
                const back = () => (run.picks.length ? S.pickerModal(run, back) : S.storyBeat(run, item, done));
                return back();
            }
            S.storyBeat(run, item, done);
        };
    }
    S.storyBeat(run, item, done);
}

function enterNode(id) {
    if (!R.enterNode(run, id)) return;
    advance();
}

function leave() { R.leaveNode(run); advance(); }

function showNode() {
    const p = run.pending;
    if (!p) { run.phase = 'map'; return advance(); }
    switch (p.type) {
        case 'combat': {
            screen = 'combat';
            S.hideAll();
            S.closeModal();
            fade(false);
            startBattle(run, {
                settings,
                onEnd: (res) => {
                    endBattle();
                    R.finishCombat(run, res);
                    if (!res.won) meta.best = Math.max(meta.best, run.world * FLOORS + run.floor);
                    advance();
                },
            });
            return;
        }
        case 'reward':
            screen = 'reward';
            setMode('map');
            setMusic(run.world, 'map');
            return S.rewardScreen(run, { onChange: () => { saveRun(); H.renderHud(run); S.rewardScreen(run, this_); }, onDone: leave });
        case 'event':
            screen = 'event';
            setMode('map');
            return S.eventScreen(run, {
                onChoose: (i) => { if (R.chooseEvent(run, i)) sfx.page(); advance(); },
                onFight: () => { R.beginEventFight(run); advance(); },
                onDone: leave,
            });
        case 'shop': {
            screen = 'shop';
            setMode('map');
            const h = { onChange: () => { saveRun(); H.renderHud(run); S.shopScreen(run, h); }, onPurge: () => advance(), onDone: leave };
            return S.shopScreen(run, h);
        }
        case 'rest':
            screen = 'rest';
            setMode('map');
            return S.restScreen(run, { onRest: () => { R.rest(run); sfx.heal(); advance(); }, onTemper: () => { R.temper(run); advance(); }, onDone: leave });
        case 'treasure':
            screen = 'treasure';
            setMode('map');
            return S.treasureScreen(run, { onOpen: () => { R.openTreasure(run); sfx.relic(); advance(); }, onDone: leave });
        default: return leave();
    }
}
// rewardScreen re-renders itself with the same handlers
const this_ = { onChange: () => { saveRun(); H.renderHud(run); S.rewardScreen(run, this_); }, onDone: () => leave() };

// ------------------------------------------------------------------ HUD buttons & settings

function wireHudButtons() {
    $('btn-deck').innerHTML = ICON.deck;
    $('btn-ranks').innerHTML = ICON.ranks;
    $('btn-chron').innerHTML = ICON.chron;
    $('btn-menu').innerHTML = ICON.menu;
    $('btn-deck').onclick = () => { sfx.click(); openDeck(); };
    $('btn-ranks').onclick = () => { sfx.click(); S.ranksModal(); };
    $('btn-chron').onclick = () => { sfx.click(); if (run) S.chronicleModal(run); };
    $('btn-menu').onclick = () => { sfx.click(); openSettings(!!run); };
}

function openDeck() {
    if (!run) return;
    const st = battleState();
    if (st) {
        S.deckModal([...st.draw, ...st.hand, ...st.discard, ...st.board.map((b) => b.card).filter(Boolean)], 'Your Deck (this battle)', `· draw ${st.draw.length} · discard ${st.discard.length}`);
    } else S.deckModal(run.deck);
}

function openSettings(inRun) {
    S.settingsModal({
        settings, inRun,
        onChange: (ch) => {
            Object.assign(settings, ch);
            saveSettings();
            setVolumes({ music: settings.music, sfx: settings.sfx });
            if (ch.quality !== undefined) setQuality(settings.quality === 'auto' ? view.quality : Number(settings.quality));
        },
        onAbandon: () => { S.closeModal(); store.del(SAVE_KEY); run = null; showTitle(); },
        onTitle: () => { S.closeModal(); saveRun(); run = null; showTitle(); },
    });
}

// ------------------------------------------------------------------ input

function wireInput() {
    const cv = renderer.domElement;
    let audioStarted = false;
    const startAudio = () => {
        if (audioStarted) return;
        audioStarted = true;
        initAudio();
        setVolumes({ music: settings.music, sfx: settings.sfx });
    };
    window.addEventListener('pointerdown', startAudio, { capture: true });
    window.addEventListener('keydown', startAudio, { capture: true });

    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
        if (!battleActive()) return;
        cv.setPointerCapture?.(e.pointerId);
        pointerDown(e.clientX, e.clientY, e);
    });
    window.addEventListener('pointermove', (e) => {
        if (battleActive()) pointerMove(e.clientX, e.clientY);
        else K.setPointerLight(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', (e) => { if (battleActive()) pointerUp(e.clientX, e.clientY); });
    window.addEventListener('pointercancel', () => pointerCancel());

    window.addEventListener('keydown', (e) => {
        if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
        if (S.modalOpen()) { if (e.key === 'Escape') S.closeModal(); return; }
        if (e.key === 'm' || e.key === 'M') { const m = toggleMute(); toast(m ? 'Sound off' : 'Sound on'); return; }
        if (!run) return;
        if (e.key === 'Escape') { openSettings(true); return; }
        if (e.key === 'd' || e.key === 'D') { openDeck(); return; }
        if (e.key === 'h' || e.key === 'H') { S.ranksModal(); return; }
        if (e.key === 'c' || e.key === 'C') { S.chronicleModal(run); return; }
        if (battleActive() && battleKey(e)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => battleKeyUp(e));
}

// ------------------------------------------------------------------ debug hooks

if (DEBUG) {
    window.__aa = {
        get run() { return run; },
        get screen() { return screen; },
        stage, view, battle: battleApi, settings, meta,
        advance: () => advance(),
        newRun: (cls = 'knight', seed = 1234) => { run = R.newRun(seed, cls); run.story = []; startRun(); },
        /** Jump to world w, floor f (next node to choose is on floor f+1). */
        jump: (w, f = 0) => {
            if (!run) run = R.newRun(1234, 'knight');
            endBattle();
            run.world = w; run.floor = f; run.path = []; run.phase = 'map'; run.pending = null; run.story = []; run.picks = [];
            const m = R.mapOf(run);
            run.nodeId = f > 0 ? m.floors[f - 1][0] : null;
            setWorld(w, run.seed);
            advance();
        },
        enter: (type) => {
            const ids = R.availableNodes(run);
            const m = R.mapOf(run);
            const id = ids.find((x) => m.nodes[x].type === type) ?? ids[0];
            enterNode(id);
            return m.nodes[id].type;
        },
        win: () => battleApi.win(),
        quality: (q) => setQuality(q),
        audio: audioSettings,
        world: (w) => setWorld(w, 1),
    };
}

boot();
export { wait };
