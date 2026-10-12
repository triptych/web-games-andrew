// CINDERWING — boot, the fixed-step loop and the mode machine:
//   title ⇄ menus → story → play ⇄ pause → clear → story → … → ending → credits
//   play → continue? → game over;  title (idle) → attract demo.
//
// ?debug=1 exposes window.__cw for tests; &fast=N runs N× simulation per frame.

import { SIM_DT, DIFFICULTY, STAGE_COUNT, W } from './config.js';
import { World, newSession, stockPower } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { STAGES } from './sim/stages.js';
import { SCENES, sceneBefore } from './sim/story.js';
import { View } from './view/view.js';
import { audio, STAGE_TRACKS } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(40, +(params.get('fast') || 1)));

const ui = new UI();
const view = new View(ui.canvas);
const input = new Input(ui);
const data = store.load();

const G = {
    mode: 'boot', world: null, session: null, bot: null, acc: 0, t: 0,
    menuStack: [], story: null, contT: 0, idleT: 0, demoT: 0, god: false,
    fps: 60, fpsN: 0, fpsT: 0, slow: 0, tier: 0,
    seen: {},          // count of every sim event drained (tests read it)
};

// ================================================================== settings
function applySettings() {
    const s = data.settings;
    audio.setSound(s.sound); audio.setMusic(s.music); audio.setVolume(s.volume);
    view.shakeOn = s.shake;
    let tier = { high: 0, medium: 1, low: 2 }[s.quality];
    if (tier === undefined) tier = matchMedia('(pointer: coarse)').matches ? 1 : 0;
    G.tier = tier;
    view.r.setQuality(tier);
    view.fx.quality = tier === 2 ? 0.5 : tier === 1 ? 0.75 : 1;
}

function relayout() {
    const { w, h } = ui.layout();
    view.resize(w, h);
}
addEventListener('resize', relayout);
if (window.visualViewport) visualViewport.addEventListener('resize', relayout);

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'play') pause();
});

// ================================================================== flow
function setMode(m) {
    G.mode = m;
    const playing = m === 'play' || m === 'pause' || m === 'demo' || m === 'continue';
    ui.setPlaying(playing && m !== 'continue');
    if (m !== 'play') audio.chargeStop();
}

function hiScore() { return Math.max(...Object.values(data.best), data.hiscores[0]?.score ?? 0); }

function toTitle() {
    G.world = null; G.session = null; G.bot = null;
    G.menuStack = [];
    view.setMode('cinema');
    view.cinema.stageTitle();
    setMode('title');
    ui.show('s-title');
    ui.hideBanner();
    refreshTitle();
    audio.play('title');
    G.idleT = 0;
}

function refreshTitle() {
    document.getElementById('btn-select').disabled = data.reached <= 0;
}

function openMenu(id) {
    G.menuStack.push(ui.active ? ui.active.id : null);
    if (id === 's-diff') {
        for (const b of document.querySelectorAll('#s-diff button[data-diff]')) {
            b.querySelector('small').textContent = DIFFICULTY[b.dataset.diff].blurb;
            b.dataset.focus = b.dataset.diff === data.settings.difficulty ? '1' : '';
        }
    }
    if (id === 's-select') buildStageList();
    if (id === 's-options') refreshOptions();
    if (id === 's-scores') buildScores();
    ui.show(id);
    audio.ui('select');
}

function backMenu() {
    const prev = G.menuStack.pop();
    audio.ui('back');
    if (G.mode === 'pause' && !prev) { ui.show('s-pause'); return; }
    if (prev) ui.show(prev); else toTitle();
}

function buildStageList() {
    const nav = document.getElementById('stage-list');
    nav.innerHTML = '';
    STAGES.forEach((st, i) => {
        const b = document.createElement('button');
        b.dataset.act = 'stage'; b.dataset.stage = i;
        b.innerHTML = `<span>${i + 1}. ${st.name}</span><small>${st.circle}</small>`;
        b.disabled = i > data.reached;
        b.addEventListener('click', () => !b.disabled && onAction('stage', b));
        nav.appendChild(b);
    });
    const back = document.createElement('button');
    back.dataset.act = 'back'; back.className = 'back'; back.textContent = 'Back';
    back.addEventListener('click', () => onAction('back', back));
    nav.appendChild(back);
}

function buildScores() {
    const t = document.getElementById('score-table');
    t.innerHTML = '';
    if (!data.hiscores.length) { t.innerHTML = '<tr><td>No light yet recorded.</td><td></td></tr>'; return; }
    data.hiscores.forEach((h, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}. ${DIFFICULTY[h.diff]?.name ?? h.diff} · circle ${h.stage}</td><td>${h.score.toLocaleString()}</td>`;
        t.appendChild(tr);
    });
}

const OPT = {
    sound: (d) => { data.settings.sound = !data.settings.sound; },
    music: (d) => { data.settings.music = !data.settings.music; },
    volume: (d) => { data.settings.volume = Math.round(Math.max(0, Math.min(1, data.settings.volume + (d || 1) * 0.1)) * 10) / 10; if (!d && data.settings.volume >= 1) data.settings.volume = 0; },
    quality: (d) => { const q = ['auto', 'high', 'medium', 'low']; data.settings.quality = q[(q.indexOf(data.settings.quality) + (d === -1 ? 3 : 1)) % 4]; },
    shake: () => { data.settings.shake = !data.settings.shake; },
    autofire: (d) => { const q = ['touch', 'always', 'off']; data.settings.autofire = q[(q.indexOf(data.settings.autofire) + (d === -1 ? 2 : 1)) % 3]; },
};
function refreshOptions() {
    const s = data.settings;
    const label = {
        sound: s.sound ? 'On' : 'Off', music: s.music ? 'On' : 'Off', volume: `${Math.round(s.volume * 100)}%`,
        quality: { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' }[s.quality], shake: s.shake ? 'On' : 'Off',
        autofire: { touch: 'Touch only', always: 'Always', off: 'Off' }[s.autofire],
    };
    for (const b of document.querySelectorAll('#s-options button[data-opt]')) b.querySelector('span').textContent = label[b.dataset.opt];
}

// ---------------------------------------------------------------- runs, stages, story
function newRun(diff, stage) {
    data.settings.difficulty = diff;
    store.save(data);
    G.session = newSession(diff, stage);
    if (stage > 0) stockPower(G.session, stage);
    audio.ui('start');
    playStory(sceneBefore(stage), () => startStage(stage));
}

function startStage(i) {
    const S = G.session;
    S.stage = i;
    G.world = new World(S, { seed: (Math.random() * 1e9) | 0, god: G.god });
    G.acc = 0;
    view.setStage(i, G.world);
    view.setMode('game');
    ui.show(null);
    ui.resetHud();
    setMode('play');
    const st = STAGES[i];
    ui.setStageName(`${i + 1} · ${st.name}`);
    ui.banner([st.circle, st.name, st.sub], 'show', 3.6);
    audio.play(STAGE_TRACKS[i]);
    if (i > data.reached) { data.reached = i; store.save(data); }
    input.rebase();
}

function playStory(id, then) {
    const sc = SCENES[id];
    if (!sc) { then(); return; }
    G.story = { sc, i: -1, then };
    view.setMode('cinema');
    view.cinema.stageScene(sc);
    setMode('story');
    ui.show('s-story');
    ui.storyTitle(sc.title);
    audio.play(sc.bg === 7 ? 'ending' : sc.right === 'malphas' || sc.right === 'sammael' ? 'title' : 'title');
    nextLine();
}

function nextLine() {
    const st = G.story;
    if (!st) return;
    if (ui.storyRush()) return;
    st.i++;
    if (st.i >= st.sc.lines.length) { endStory(); return; }
    const [who, text] = st.sc.lines[st.i];
    ui.storyLine(who, text, !!st.sc.vesperFree);
    view.cinema.speak(who);
    audio.blip();
}

function endStory() {
    const st = G.story;
    G.story = null;
    if (st) st.then();
}

function pause() {
    if (G.mode !== 'play') return;
    setMode('pause');
    ui.show('s-pause');
    audio.suspendMusic = true;
    audio.ui('back');
}

function resume() {
    ui.show(null);
    setMode('play');
    input.rebase();
}

function stageCleared() {
    const w = G.world, S = G.session, i = S.stage;
    const clearBonus = 5000 * (i + 1);
    const noMiss = w.stats.noMiss ? 10000 * (i + 1) : 0;
    w.addScore(clearBonus + noMiss);
    const t = document.getElementById('tally');
    t.innerHTML = '';
    const rows = [
        ['Circle', STAGES[i].name], ['Demons laid to rest', `${w.stats.killed} / ${w.stats.spawned}`],
        ['Soul shards', String(w.stats.shards)], ['Clear bonus', `+${Math.round(clearBonus * w.D.score).toLocaleString()}`],
        ['Unfallen bonus', noMiss ? `+${Math.round(noMiss * w.D.score).toLocaleString()}` : '—'], ['Score', S.score.toLocaleString()],
    ];
    rows.forEach(([a, b], k) => { const tr = document.createElement('tr'); if (k === rows.length - 1) tr.className = 'total'; tr.innerHTML = `<td>${a}</td><td>${b}</td>`; t.appendChild(tr); });
    if (i + 1 > data.reached && i + 1 < STAGE_COUNT) data.reached = i + 1;
    store.save(data);
    setMode('clear');
    ui.setPlaying(false);
    ui.hideBanner();
    ui.show('s-clear');
    audio.fanfare();
    audio.play(null);
}

function nextStage() {
    const S = G.session, i = S.stage;
    if (i >= STAGE_COUNT - 1) {
        data.cleared = true;
        const rank = store.record(data, S.score, S.diff, 7);
        store.save(data);
        playStory('ending', () => {
            view.setMode('cinema');
            setMode('credits');
            document.getElementById('final-score').textContent = `Final score ${S.score.toLocaleString()} · ${DIFFICULTY[S.diff].name}${S.continues ? ` · ${S.continues} continue${S.continues > 1 ? 's' : ''}` : ''}${rank === 0 ? ' · the brightest yet' : ''}`;
            ui.show('s-credits');
        });
        return;
    }
    playStory(sceneBefore(i + 1), () => startStage(i + 1));
}

function gameOver() {
    setMode('continue');
    G.contT = 9.99;
    ui.hideBanner();
    ui.show('s-continue');
    audio.gameOver();
    audio.play(null);
}

function finalGameOver() {
    const S = G.session;
    const rank = store.record(data, S.score, S.diff, S.stage + 1);
    store.save(data);
    setMode('over');
    ui.setPlaying(false);
    document.getElementById('over-score').textContent = `Score ${S.score.toLocaleString()} · circle ${S.stage + 1}${rank >= 0 ? ` · #${rank + 1} in the Hall of Light` : ''}`;
    ui.show('s-over');
}

function continueGame() {
    ui.show(null);
    G.world.continueGame();
    setMode('play');
    audio.play(G.world.boss ? (G.world.boss.kind === 'malphas' ? 'malphas' : 'boss') : STAGE_TRACKS[G.session.stage]);
}

// ---------------------------------------------------------------- attract demo
function startDemo() {
    const st = Math.floor(Math.random() * 4);
    G.session = newSession('seraph', st);
    stockPower(G.session, Math.max(2, st));
    G.session.lives = 5;
    G.world = new World(G.session, { seed: (Math.random() * 1e9) | 0 });
    G.world.scroll = 20 + Math.random() * 120;
    G.world.reset(G.world.scroll);
    G.bot = new Bot(0.95);
    view.setStage(st, G.world);
    view.setMode('game');
    ui.show(null);
    ui.resetHud();
    setMode('demo');
    ui.setStageName('Demonstration');
    ui.banner(['', 'Demonstration', 'press any key'], 'show', 4);
    G.demoT = 0;
}

// ================================================================== actions (menus)
function onAction(act, el, dir) {
    audio.init();
    switch (act) {
        case 'start': openMenu('s-diff'); break;
        case 'select': openMenu('s-select'); break;
        case 'howto': openMenu('s-howto'); break;
        case 'options': openMenu('s-options'); break;
        case 'scores': openMenu('s-scores'); break;
        case 'back': backMenu(); break;
        case 'esc': if (G.mode === 'pause') resume(); else backMenu(); break;
        case 'diff': {
            G.menuStack = [];
            newRun(el.dataset.diff, G.pickStage ?? 0);
            G.pickStage = 0;
            break;
        }
        case 'stage': G.pickStage = +el.dataset.stage; openMenu('s-diff'); break;
        case 'opt': OPT[el.dataset.opt](dir); store.save(data); applySettings(); refreshOptions(); audio.ui('move'); break;
        case 'resume': resume(); break;
        case 'restart': {
            const S = G.session;
            G.world = null;
            G.session.score = 0;
            startStage(S.stage);
            break;
        }
        case 'quit': {
            const S = G.session;
            if (S) { store.record(data, S.score, S.diff, S.stage + 1); store.save(data); }
            toTitle();
            break;
        }
        case 'next': nextStage(); break;
        case 'cont-yes': continueGame(); break;
        case 'cont-no': finalGameOver(); break;
        case 'title': toTitle(); break;
        case 'skip': {
            const st = G.story;
            if (st) { G.story = null; ui.storyRush(); st.then(); }
            break;
        }
        case 'story-next': nextLine(); break;
        default: break;
    }
}
ui.onAction = onAction;

// ================================================================== sim events → view, audio, UI
function drain(w) {
    const demo = G.mode === 'demo';
    for (const ev of w.fxq) {
        G.seen[ev.e] = (G.seen[ev.e] || 0) + 1;
        view.event(ev, w);
        switch (ev.e) {
            case 'pshot': audio.pshot(); break;
            case 'hit': audio.hit(ev.boss); break;
            case 'spark': if (ev.armor) audio.armor(); break;
            case 'explode': audio.explode(ev.size); break;
            case 'playerDie': audio.death(); break;
            case 'hurt': audio.hurt(); break;
            case 'aegis': audio.chime([88, 84], 0.1, 0.05); break;
            case 'pickup': audio.pickup(ev.kind); if (!demo) ui.pickupToast(ev.kind, ev.bonus); break;
            case 'extend': audio.extend(); ui.toast('Extra life', '#ffb0d0'); break;
            case 'haloCast': audio.halo('cast'); break;
            case 'haloCall': audio.halo('call'); break;
            case 'haloAttach': audio.halo('attach'); break;
            case 'chargeStart': audio.chargeStart(); break;
            case 'beam': audio.beam(ev.charge); break;
            case 'boss': {
                audio.bossWarning();
                audio.play(ev.kind === 'malphas' ? 'malphas' : 'boss');
                if (!demo) ui.banner(['Warning', ev.name, ev.title], 'warn show', 4.2);
                break;
            }
            case 'bossDie': audio.bigBoom(); break;
            case 'bossGone': audio.bigBoom(); break;
            case 'stageClear': if (!demo) stageCleared(); break;
            case 'say': if (!demo) { ui.comms(ev.who, input.touchMode && ev.touch ? ev.touch : ev.text); audio.blip(); } break;
            case 'warn': case 'dashWarn': case 'handWarn': case 'scytheWarn': audio.alarm(); break;
            case 'laserWarn': audio.laserWarn(); break;
            case 'geyserWarn': audio.rumble(0.15); break;
            case 'geyser': audio.rumble(0.4); break;
            case 'slam': case 'clank': audio.clang(); break;
            case 'beat': audio.heartbeat(); break;
            case 'efire': audio.efire(); break;
            case 'absorb': audio.absorb(); break;
            case 'dawn': audio.dawn(); if (!demo) ui.toast('The Dawn Halo', '#fff4d8'); break;
            case 'phase': audio.rumble(0.6); break;
            case 'groupBonus': if (!demo) ui.toast('Squadron · +1000', '#ffd890'); break;
            case 'blockBreak': audio.explode(1.4); break;
            case 'gameOver': if (!demo) gameOver(); break;
            default: break;
        }
    }
    w.fxq.length = 0;
}

// ================================================================== the loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    try { tick(now); } catch (err) { console.error(err); }
}

function tick(now) {
    const realDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.t += realDt;
    const pxu = ui.fw / W;
    const snap = input.frame(G.world && G.world.player.alive ? G.world.player : null, pxu, data.settings.autofire, G.mode !== 'play' && G.mode !== 'demo');
    if (snap.mute) { data.settings.music = !data.settings.music; store.save(data); applySettings(); }
    ui.tick(realDt);

    // fps → automatic quality tier
    G.fpsN++; G.fpsT += realDt;
    if (G.fpsT >= 1) {
        G.fps = G.fpsN / G.fpsT; G.fpsN = 0; G.fpsT = 0;
        if (data.settings.quality === 'auto' && (G.mode === 'play' || G.mode === 'demo') && !DEBUG) {
            if (G.fps < 42) G.slow++; else G.slow = 0;
            if (G.slow >= 3 && G.tier < 2) { G.tier++; G.slow = 0; view.r.setQuality(G.tier); view.fx.quality = G.tier === 2 ? 0.5 : 0.75; }
        }
    }

    switch (G.mode) {
        case 'title':
            if (ui.nav(snap, audio)) G.idleT = 0;
            G.idleT += realDt;
            if (snap.any) G.idleT = 0;
            if (G.idleT > 32) startDemo();
            break;
        case 'story':
            if (snap.skip) onAction('skip');
            else if (snap.confirm || snap.halo) nextLine();
            break;
        case 'play': {
            if (snap.pause) { pause(); break; }
            const w = G.world;
            G.acc += realDt * FAST;
            let steps = 0, first = true;
            while (G.acc >= SIM_DT && steps < 12 * FAST) {
                const inp = G.bot ? G.bot.think(w) : snap;
                w.step(first ? inp : { ...inp, halo: false }, SIM_DT);
                first = false;
                G.acc -= SIM_DT; steps++;
            }
            if (steps >= 12 * FAST) G.acc = 0;
            drain(w);
            if (G.mode === 'play' || G.mode === 'continue' || G.mode === 'clear') {
                view.sync(w, realDt);
                ui.hudUpdate(w, hiScore());
            }
            break;
        }
        case 'demo': {
            const w = G.world;
            G.acc += realDt;
            let steps = 0;
            while (G.acc >= SIM_DT && steps < 12) { w.step(G.bot.think(w), SIM_DT); G.acc -= SIM_DT; steps++; }
            if (steps >= 12) G.acc = 0;
            drain(w);
            view.sync(w, realDt);
            ui.hudUpdate(w, hiScore());
            G.demoT += realDt;
            if (snap.any || G.demoT > 40 || w.state !== 'play') toTitle();
            break;
        }
        case 'pause':
            if (snap.pause && ui.active && ui.active.id === 's-pause') { resume(); break; }
            ui.nav(snap, audio);
            break;
        case 'continue':
            G.contT -= realDt;
            document.getElementById('cont-count').textContent = String(Math.max(0, Math.floor(G.contT)));
            ui.nav(snap, audio);
            if (G.contT <= 0) finalGameOver();
            if (G.world) view.sync(G.world, realDt * 0.25);
            break;
        default:
            ui.nav(snap, audio);
    }
    view.render(realDt);
}

// ================================================================== boot
relayout();
applySettings();
toTitle();
requestAnimationFrame(frame);

if (DEBUG) {
    window.__cw = {
        G, view, ui, data, audio, STAGES,
        get mode() { return G.mode; },
        get world() { return G.world; },
        start(stage = 0, diff = 'seraph', skipStory = true) {
            G.session = newSession(diff, stage);
            if (stage > 0) stockPower(G.session, stage);
            if (skipStory) startStage(stage); else playStory(sceneBefore(stage), () => startStage(stage));
        },
        story(id) { playStory(id, () => toTitle()); },
        god(on = true) { G.god = on; if (G.world) G.world.god = on; },
        ff(sec, bot = true) {
            const w = G.world; if (!w) return;
            const b = new Bot(1);
            for (let i = 0; i < sec / SIM_DT; i++) { w.step(bot ? b.think(w) : {}, SIM_DT); if (w.fxq.length > 400) { drain(w); } }
            drain(w);
        },
        toBoss() { const w = G.world; if (w) { w.cursor = w.stage.script.length; w.spawnQ.length = 0; w.scroll = w.stage.len - 0.5; } },
        killBoss() { const w = G.world; if (w && w.boss) { for (const p of w.boss.parts) if (p.core) { w.boss.st = 'fight'; w.damageBossPart(p, 1e9, null); } } },
        clearStage() { const w = G.world; if (w) { w.state = 'clear'; w.stateT = 99; w.clearSent = false; } },
        autoplay(on = true) { G.bot = on ? new Bot(1) : null; },
        setMode, toTitle, startDemo, onAction,
    };
}
