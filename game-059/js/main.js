/**
 * main.js — Sister Circuit entry point: boot (bake sprites), title with an
 * attract demo, story / arcade / boss rush / survival sessions, the fixed
 * 60 Hz sim loop, and every screen transition between them.
 *
 * Modes: boot → title → (prologue) → card → play ⇄ dialog / bosscard / pause
 *        → results → shop → card ... → ending → title;   play → continue → gameover
 */

import { View } from './view/view.js';
import { World, STEP } from './sim/world.js';
import { LEVELS } from './sim/levels.js';
import { DIFFICULTY } from './sim/items.js';
import { makeBot } from './sim/bot.js';
import { bakeChar } from './art/bake.js';
import { CHARS } from './art/chars.js';
import { Input } from './input.js';
import { UI, $, drawFace } from './ui.js';
import * as audio from './audio.js';
import * as save from './save.js';
import { PROLOGUE, ENDING, STAGE_END, GAMEOVER_LINES } from './story.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const data = save.load();

// ---------------------------------------------------------------- setup
const canvas = $('game');
const view = new View(canvas);
const input = new Input();
input.bindTouch($('touch'));
const ui = new UI();
let lowW = 427;
let isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

let mode = 'boot';
let S = null;            // session: { mode, difficulty, stage, profile, continues, character }
let world = null, demo = null, demoBot = null, demoT = 0;
let acc = 0, last = performance.now();
const EDGES = ['atk', 'jump', 'spec', 'ovr'];
let carry = {}; // button presses waiting for the next sim step
let pendingBoss = null, clearTimer = 0, rotateHintShown = 0;
const flags = {};        // per-stage one-shot barks

// ---------------------------------------------------------------- layout
function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W * 1.05;
    let sw = W, sh = H;
    if (portrait) sh = Math.round(Math.min(H * 0.6, W * 0.92));
    const root = document.documentElement.style;
    root.setProperty('--sw', sw + 'px'); root.setProperty('--sh', sh + 'px');
    root.setProperty('--sx', '0px'); root.setProperty('--sy', '0px');
    root.setProperty('--u', Math.max(sh / 100, portrait ? W / 88 : 0, isTouch ? 4.4 : 0) + 'px');
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('touch', isTouch);
    const t = $('touch');
    t.style.top = portrait ? sh + 'px' : '0px';
    lowW = view.resize(sw, sh, window.devicePixelRatio || 1);
    if (world) world.setViewWidth(lowW);
    if (demo) demo.setViewWidth(lowW);
    const rh = $('rotate-hint');
    rh.style.top = (portrait ? sh + 10 : 8) + 'px';
    rh.classList.toggle('hidden', !(portrait && isTouch && (mode === 'play' || mode === 'card')) || rotateHintShown > 2);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; layout(); } audio.initAudio(); }, { capture: true });
window.addEventListener('keydown', () => audio.initAudio(), { capture: true });
layout();

// ---------------------------------------------------------------- settings
function applySettings() {
    const s = data.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    view.r.crt = s.crt; view.r.bloomOn = s.bloom;
    document.documentElement.style.setProperty('--tsize', s.touchSize);
}
function bindSettings() {
    const s = data.settings;
    const rng = (id, key) => { const el = $(id); el.value = s[key]; el.addEventListener('input', () => { s[key] = +el.value; applySettings(); save.save(); }); };
    const chk = (id, key) => { const el = $(id); el.checked = s[key]; el.addEventListener('change', () => { s[key] = el.checked; applySettings(); save.save(); }); };
    rng('s-master', 'master'); rng('s-music', 'music'); rng('s-sfx', 'sfx'); rng('s-touch', 'touchSize');
    chk('s-crt', 'crt'); chk('s-bloom', 'bloom'); chk('s-shake', 'shake');
}
bindSettings(); applySettings();

// ---------------------------------------------------------------- boot
async function boot() {
    const keys = Object.keys(CHARS);
    for (let i = 0; i < keys.length; i++) {
        $('boot-msg').textContent = `BAKING SPRITES · ${keys[i].toUpperCase()}`;
        $('boot-fill').style.width = `${((i + 1) / keys.length) * 100}%`;
        bakeChar(keys[i]);
        await new Promise((r) => setTimeout(r, 0));
    }
    view.actors.preload(keys);
    $('boot').classList.add('hidden');
    toTitle();
}

// ---------------------------------------------------------------- title & attract demo
function startDemo() {
    demo = new World({ stage: 0, difficulty: 'normal', seed: (Math.random() * 1e9) | 0, profile: { upgrades: { power: 1 }, credits: 0, score: 0, lives: 9 }, viewW: lowW, mode: 'demo' });
    demoBot = makeBot();
    demoT = 0;
    view.loadStage(LEVELS[0]);
}

function toTitle() {
    mode = 'title';
    world = null; S = null;
    document.body.classList.remove('playing');
    ui.closeAll(); ui.showHUD(false); ui.go(false);
    $('touch').classList.add('hidden');
    $('title').classList.remove('hidden');
    ui.stack = [$('title')];
    ui.titleArt();
    const d = save.get();
    $('m-continue').classList.toggle('hidden', !d.run);
    if (d.run) $('m-continue').textContent = `Continue Story · Stage ${d.run.stage + 1}`;
    $('m-bossrush').classList.toggle('locked', !d.unlocked.bossrush);
    $('m-survival').classList.toggle('locked', !d.unlocked.survival);
    $('best-line').textContent = d.best.story ? `HIGH SCORE ${d.best.story}` : '';
    ui.focusIdx = 0; ui.paintFocus();
    startDemo();
    audio.playMusic('title');
}

for (const b of document.querySelectorAll('#title-menu .mbtn')) {
    b.addEventListener('click', () => {
        audio.initAudio(); audio.sfx('confirm');
        const act = b.dataset.act;
        const d = save.get();
        if (act === 'continue' && d.run) { resumeRun(d.run); return; }
        if (act === 'story' || act === 'arcade') { pickDifficulty(act); return; }
        if (act === 'bossrush' || act === 'survival') {
            if (!d.unlocked[act]) { ui.toast(act === 'bossrush' ? 'Clear Story mode to unlock Boss Rush.' : 'Clear Story mode to unlock Survival.'); audio.sfx('denied'); return; }
            pickDifficulty(act); return;
        }
        if (act === 'moves') ui.moves({ pulse: true, rising: true, counter: true, aircombo: true }, isTouch);
        if (act === 'settings') ui.open('modal-settings');
        if (act === 'credits') ui.open('modal-credits');
    });
}

let pickChar = 'juno', pickStage = 0, pickMode = 'story';
function pickDifficulty(m) {
    pickMode = m;
    const d = save.get();
    $('diff-title').textContent = { story: 'Story — choose difficulty', arcade: 'Arcade — no story, no shop', bossrush: 'Boss Rush — all seven bosses', survival: 'Survival — endless waves' }[m];
    const cp = $('char-pick');
    cp.classList.toggle('hidden', !d.unlocked.mika);
    if (d.unlocked.mika) {
        drawFace($('pick-juno'), 'juno'); drawFace($('pick-mika'), 'mikaFree');
        for (const b of cp.querySelectorAll('.cbtn')) { b.classList.toggle('sel', b.dataset.char === pickChar); b.onclick = () => { pickChar = b.dataset.char; for (const o of cp.querySelectorAll('.cbtn')) o.classList.toggle('sel', o === b); audio.sfx('select'); }; }
    } else pickChar = 'juno';
    const sp = $('stage-pick');
    const showStages = (m === 'story' || m === 'arcade') && d.stageReached > 0;
    sp.classList.toggle('hidden', !showStages);
    pickStage = 0;
    if (showStages) {
        const list = $('stage-list'); list.innerHTML = '';
        for (let i = 0; i <= Math.min(6, d.stageReached); i++) {
            const b = document.createElement('button'); b.textContent = i + 1; b.title = LEVELS[i].name;
            b.classList.toggle('sel', i === 0);
            b.onclick = () => { pickStage = i; for (const o of list.children) o.classList.toggle('sel', o === b); audio.sfx('select'); };
            list.appendChild(b);
        }
    }
    ui.open('modal-diff');
}
for (const b of document.querySelectorAll('#diff-menu .mbtn')) {
    b.addEventListener('click', () => { audio.sfx('confirm'); ui.close('modal-diff'); newSession(pickMode, b.dataset.diff, pickChar, pickStage); });
}

// ---------------------------------------------------------------- sessions
function freshProfile(diff, character) {
    return { upgrades: {}, credits: 0, score: 0, lives: DIFFICULTY[diff].lives, character, livesBought: 0 };
}

function newSession(m, diff, character, startAt = 0) {
    S = { mode: m, difficulty: diff, stage: startAt, profile: freshProfile(diff, character), continues: DIFFICULTY[diff].continues, character, deathsStage: 0, totalTime: 0 };
    if (startAt > 0) { S.profile.credits = 600 * startAt; S.profile.upgrades = { power: Math.min(3, Math.floor(startAt / 2)), armor: Math.min(3, Math.floor(startAt / 2)) }; }
    if (m === 'story' && startAt === 0) playStory(PROLOGUE, () => startStage(0));
    else if (m === 'bossrush') startStage(6);
    else if (m === 'survival') startStage(0);
    else startStage(startAt);
}

function resumeRun(run) {
    S = { mode: 'story', difficulty: run.difficulty, stage: run.stage, profile: run.profile, continues: run.continues ?? DIFFICULTY[run.difficulty].continues, character: run.profile.character || 'juno', deathsStage: 0, totalTime: run.totalTime || 0 };
    startStage(run.stage);
}

async function startStage(i) {
    mode = 'loading';
    S.stage = i;
    ui.closeAll(); ui.showHUD(false); ui.go(false);
    $('title').classList.add('hidden');
    document.body.classList.add('playing');
    const level = LEVELS[i];
    for (const k of View.charsFor(level)) bakeChar(k);
    S.profile.lives = S.profile.lives ?? DIFFICULTY[S.difficulty].lives;
    world = new World({ stage: i, difficulty: S.difficulty, seed: (Math.random() * 1e9) | 0, profile: S.profile, viewW: lowW, mode: S.mode });
    if (S.mode === 'bossrush') { world.player.x = world.camX; }
    if (S.mode === 'survival') { world.camX = 2350; world.player.x = 2300; world.lock.camX = 2350; }
    demo = null;
    view.loadStage(level);
    pendingBoss = null; clearTimer = 0; S.deathsStage = 0;
    for (const k of Object.keys(flags)) delete flags[k];
    ui.setPlayerFace(S.character === 'mika' ? 'mikaFree' : 'juno', S.character === 'mika' ? 'MIKA' : 'JUNO');
    if (S.mode === 'story') save.update((d) => { d.run = { stage: i, difficulty: S.difficulty, profile: structuredClone(S.profile), continues: S.continues, totalTime: S.totalTime }; d.stageReached = Math.max(d.stageReached, i); });
    else if (S.mode === 'arcade') save.update((d) => { d.stageReached = Math.max(d.stageReached, i); });
    mode = 'card';
    audio.playMusic(S.mode === 'bossrush' ? 'boss7' : level.music);
    if (S.mode === 'bossrush') { $('sc-num').textContent = 'BOSS RUSH'; }
    const cardLevel = S.mode === 'bossrush' ? { name: 'BOSS RUSH', sub: 'Seven fights. No breaks.' } : S.mode === 'survival' ? { name: 'SURVIVAL', sub: 'How long can the suit hold?' } : level;
    await ui.stageCard(cardLevel, i);
    if (S.mode === 'bossrush' || S.mode === 'survival') $('sc-num').textContent = '';
    beginPlay();
}

function beginPlay() {
    mode = 'play';
    rotateHintShown++;
    setTimeout(() => $('rotate-hint').classList.add('hidden'), 4000);
    ui.showHUD(true);
    $('touch').classList.toggle('hidden', !isTouch);
    layout();
    acc = 0; carry = {};
}

// ---------------------------------------------------------------- story cards (prologue / ending)
function playStory(cards, done) {
    mode = 'story';
    view.actors.clear(); view.fx.clear();
    demo = null;
    let i = -1, typed = 0, text = '';
    const el = $('story'), txt = $('story-text');
    el.classList.remove('hidden');
    ui.stack = [el];
    const next = () => {
        i++;
        if (i >= cards.length) { el.classList.add('hidden'); el.onclick = null; $('story-skip').onclick = null; storyTick = null; done(); return; }
        const c = cards[i];
        const idx = LEVELS.findIndex((l) => l.key === c.scene);
        if (idx >= 0 && (!view.level || view.level.key !== c.scene)) view.loadStage(LEVELS[idx]);
        text = c.text; typed = 0; txt.textContent = '';
    };
    const advance = () => { if (typed < text.length) { typed = text.length; txt.textContent = text; } else { audio.sfx('select'); next(); } };
    el.onclick = advance;
    $('story-skip').onclick = (e) => { e.stopPropagation(); i = cards.length; next(); };
    storyTick = (dt, menu) => {
        if (typed < text.length) { const n0 = Math.floor(typed); typed = Math.min(text.length, typed + dt * 40); if (Math.floor(typed) !== n0) { txt.textContent = text.slice(0, Math.floor(typed)); if (n0 % 4 === 0) audio.sfx('blip'); } }
        for (const m of menu) if (m === 'ok') advance(); else if (m === 'back') { i = cards.length; next(); }
    };
    storyCam = 0;
    next();
}
let storyTick = null, storyCam = 0;

// ---------------------------------------------------------------- world events
function handleEvent(e) {
    view.handle(e, world);
    const shake = data.settings.shake;
    if (!shake) view.r.shakeT = 0;
    switch (e.t) {
        case 'sfx': audio.sfx(e.id, e.x); break;
        case 'hit':
            audio.sfx(e.sfx || 'hitL');
            if (e.team === 'enemy') { audio.sfx('hurtJ'); if (navigator.vibrate && isTouch) try { navigator.vibrate(20); } catch { /* ignore */ } }
            ui.onHit(e, world);
            break;
        case 'block': audio.sfx('clang'); break;
        case 'dialog':
            if (S && S.mode === 'story') {
                mode = 'dialog';
                ui.showDialog(e.id, () => { world.resume(); mode = 'play'; if (pendingBoss) showBossCard(); });
            } else world.resume();
            break;
        case 'bossIntro':
            pendingBoss = e;
            if (world.level.bossMusic && S.mode !== 'bossrush') audio.playMusic(e.id === 'magnus2' ? 'boss7' : world.level.bossMusic);
            if (mode === 'play') showBossCard();
            break;
        case 'stageClear': clearTimer = 2.4; ui.showHUD(true); audio.jingle('clear'); break;
        case 'gameOver': onGameOver(); break;
        case 'banner': ui.banner(e.text, e.kind); break;
        case 'go': ui.go(true); audio.sfx('go'); setTimeout(() => ui.go(false), 3000); break;
        case 'lock': ui.go(false); break;
        case 'combo': ui.combo(e.n); if (e.n === 25 && !flags.c25) { flags.c25 = 1; ui.bark('echo', 'Twenty-five hits. Show-off.'); } break;
        case 'odReady': ui.banner('OVERDRIVE READY', 'small'); if (!flags.od) { flags.od = 1; ui.bark('echo', isTouch ? 'Overdrive charged. Hit OVR!' : 'Overdrive charged. Press I!'); } break;
        case 'odEnd': ui.toast('Overdrive spent', 1); break;
        case 'lowEnergy': ui.lowEnergy(); break;
        case 'extraLife': ui.banner('1 UP', 'small'); break;
        case 'pickup': if (['pipe', 'katana', 'baton', 'knives'].includes(e.type)) ui.toast(`${e.name} — SPECIAL throws it`); break;
        case 'heal': audio.sfx('heal'); break;
        case 'break': audio.sfx('break'); break;
        case 'weaponBreak': audio.sfx('break'); ui.toast('Weapon broke!', 1); break;
        case 'bossDown': audio.stopMusic(1.6); audio.sfx('boom'); ui.flash('#fff', 0.8); break;
        case 'bossPhase': ui.banner('ENRAGED', 'boss'); break;
        case 'playerDown': audio.sfx('playerDown'); if (S) S.deathsStage++; break;
        case 'respawn': ui.banner(world.lives > 0 ? 'GET UP!' : '', 'small'); break;
        case 'bark': ui.bark(e.who, e.text); break;
        case 'assist': audio.sfx('rail'); break;
        case 'hazardWarn': ui.banner(e.kind === 'gantry' ? '⚠ GANTRY — JUMP!' : '⚠ FORKLIFT!', 'small'); break;
        case 'hpcost': if (!flags.hp) { flags.hp = 1; ui.bark('echo', 'Battery\'s flat — that Arc Burst came out of your health.'); } break;
        default: break;
    }
}

function showBossCard() {
    const e = pendingBoss;
    pendingBoss = null;
    if (!e || !world) return;
    world.paused = true;
    mode = 'bosscard';
    audio.jingle('boss');
    ui.bossCard(e.name, e.title).then(() => { if (world) world.resume(); if (mode === 'bosscard') mode = 'play'; });
}

// ---------------------------------------------------------------- stage end
function rankFor(w) {
    const s = w.stats;
    const par = 70 + w.level.length / 16;
    let pts = 0;
    pts += s.time < par ? 2 : s.time < par * 1.4 ? 1 : 0;
    pts += s.dmgTaken < 30 ? 2 : s.dmgTaken < 100 ? 1 : 0;
    pts += s.maxCombo >= 25 ? 2 : s.maxCombo >= 12 ? 1 : 0;
    pts += S.deathsStage === 0 ? 1 : 0;
    const rank = pts >= 7 ? 'S' : pts >= 5 ? 'A' : pts >= 3 ? 'B' : pts >= 1 ? 'C' : 'D';
    const timeBonus = Math.max(0, Math.round((par * 1.5 - s.time) * 40));
    const dmgBonus = s.dmgTaken === 0 ? 20000 : Math.max(0, Math.round(5000 - s.dmgTaken * 30));
    return { rank, timeBonus, dmgBonus };
}

function onStageClear() {
    mode = 'clearing';
    const i = S.stage;
    const finish = () => {
        const r = rankFor(world);
        world.score += r.timeBonus + r.dmgBonus;
        S.totalTime += world.stats.time;
        Object.assign(S.profile, world.snapshotProfile());
        save.update((d) => { const k = `${i}-${S.difficulty}`; const order = 'DCBAS'; if (!d.ranks[k] || order.indexOf(r.rank) > order.indexOf(d.ranks[k])) d.ranks[k] = r.rank; });
        mode = 'results';
        ui.showHUD(false);
        audio.playMusic('results');
        ui.results(world, S.mode === 'bossrush' ? 'BOSS RUSH COMPLETE' : S.mode === 'survival' ? 'SURVIVAL' : `${i + 1} · ${world.level.name}`, { ...r, kicker: S.mode === 'bossrush' ? 'ALL BOSSES DOWN' : 'STAGE CLEAR' });
    };
    if (S.mode === 'story' && STAGE_END[i]) { mode = 'dialog'; ui.showDialog(STAGE_END[i], finish); }
    else finish();
}

$('modal-results').querySelector('[data-act="next"]').addEventListener('click', () => {
    audio.sfx('confirm');
    ui.close('modal-results');
    if (S.mode === 'bossrush') { recordBest('bossrush', world.score); toTitle(); return; }
    if (S.stage >= LEVELS.length - 1) { ending(); return; }
    if (S.mode === 'story') openShop();
    else startStage(S.stage + 1);
});

function openShop() {
    mode = 'shop';
    audio.playMusic('shop');
    ui.shop(S.profile, (u, cost) => {
        if ((S.profile.credits || 0) < cost) return;
        S.profile.credits -= cost;
        if (u.consumable) { S.profile.lives = (S.profile.lives || 0) + 1; S.profile.livesBought = (S.profile.livesBought || 0) + 1; }
        else S.profile.upgrades[u.id] = (S.profile.upgrades[u.id] || 0) + 1;
        audio.sfx('equip');
        ui.toast(`${u.name} installed`);
    });
}
$('shop-go').addEventListener('click', () => { audio.sfx('confirm'); ui.close('modal-shop'); startStage(S.stage + 1); });

function recordBest(kind, score) { save.update((d) => { d.best[kind] = Math.max(d.best[kind] || 0, score); }); }

function ending() {
    recordBest(S.mode, world.score);
    const finalScore = world.score;
    save.update((d) => { d.run = null; if (S.mode === 'story') { d.cleared[S.difficulty] = true; d.unlocked.bossrush = true; d.unlocked.survival = true; d.unlocked.mika = true; } });
    world = null;
    document.body.classList.remove('playing');
    $('touch').classList.add('hidden');
    audio.playMusic('ending');
    const cards = S.mode === 'story' ? ENDING : [{ text: 'ARCADE CLEAR.\nThe Spire is dark. Port Solace breathes.', scene: 'zenith' }];
    playStory([...cards, { text: `FINAL SCORE ${finalScore}\nTIME ${Math.floor(S.totalTime / 60)}:${String(Math.floor(S.totalTime % 60)).padStart(2, '0')}\n\nUNLOCKED: BOSS RUSH · SURVIVAL · PLAY AS MIKA\n\nTHANK YOU FOR PLAYING`, scene: 'zenith' }], () => toTitle());
}

// ---------------------------------------------------------------- game over / continue
let contT = 0;
function onGameOver() {
    if (S.mode === 'survival') { recordBest('survival', world.score); save.update((d) => { d.bestWave = Math.max(d.bestWave, world.survivalWave); }); gameOverScreen(`You held out for ${world.survivalWave} waves.`); return; }
    if (S.continues > 0) {
        mode = 'continue';
        contT = 10;
        $('cont-line').textContent = GAMEOVER_LINES[Math.floor(Math.random() * GAMEOVER_LINES.length)];
        $('cont-left').textContent = S.continues > 50 ? 'Unlimited continues' : `${S.continues} continue${S.continues === 1 ? '' : 's'} left · score resets`;
        ui.open('modal-continue');
        audio.jingle('over');
    } else gameOverScreen();
}
$('modal-continue').querySelector('[data-act="yes"]').addEventListener('click', () => {
    audio.sfx('confirm'); ui.close('modal-continue');
    S.continues--; world.continueGame(); mode = 'play';
    audio.playMusic(world.boss && !world.boss.remove ? (world.level.bossMusic || 'boss1') : world.level.music);
});
$('modal-continue').querySelector('[data-act="no"]').addEventListener('click', () => { audio.sfx('back'); ui.close('modal-continue'); gameOverScreen(); });

function gameOverScreen(line) {
    mode = 'gameover';
    recordBest(S.mode, world ? world.score : 0);
    $('go-title').textContent = line || 'The Spire keeps Mika tonight.';
    $('go-stats').textContent = world ? `Score ${world.score} · Stage ${S.stage + 1}` : '';
    ui.open('modal-gameover');
    audio.jingle('over');
}
$('modal-gameover').querySelector('[data-act="title"]').addEventListener('click', () => { audio.sfx('confirm'); toTitle(); });

// ---------------------------------------------------------------- pause
function pause() {
    if (mode !== 'play') return;
    mode = 'pause';
    audio.sfx('pause');
    $('pause-info').textContent = `${world.level.name} · Score ${world.score}`;
    ui.open('modal-pause');
}
function resume() { ui.close('modal-pause'); mode = 'play'; acc = 0; carry = {}; }
$('pause-btn').addEventListener('click', (e) => { e.stopPropagation(); pause(); });
for (const b of document.querySelectorAll('#modal-pause .mbtn')) {
    b.addEventListener('click', () => {
        audio.sfx('confirm');
        const act = b.dataset.act;
        if (act === 'resume') resume();
        if (act === 'moves') ui.moves(world.player.unlocks, isTouch);
        if (act === 'settings') ui.open('modal-settings');
        if (act === 'restart') { ui.close('modal-pause'); startStage(S.stage); }
        if (act === 'quit') toTitle();
    });
}
ui.onBack = (id) => { if (id === 'modal-pause') { resume(); return true; } if (id === 'modal-shop') return true; return false; };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

// ---------------------------------------------------------------- loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const snap = input.poll(dt);
    const menu = input.takeMenu();

    if (mode === 'story') { if (storyTick) storyTick(dt, menu); storyCam += dt * 30; view.frame(null, dt, { camX: 400 + storyCam }); return; }
    if (mode === 'dialog') {
        ui.updateDialog(dt);
        if (snap.atk || snap.jump || menu.includes('ok')) ui.advanceDialog();
        if (menu.includes('back')) ui.endDialog();
    } else if (mode !== 'play') {
        for (const m of menu) ui.nav(m);
    }

    if (mode === 'title' && demo) {
        demoT += dt;
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 4) { if (demo.paused) { if (demo.state === 'gameover') demo.continueGame(); else demo.resume(); } demo.step(STEP, demoBot(demo, STEP)); for (const e of demo.drainEvents()) view.handle(e, demo); acc -= STEP; n++; }
        if (demo.state === 'clear' || demoT > 100) startDemo();
        view.frame(demo, dt);
        return;
    }

    if (mode === 'play' && world && world.state === 'clear') {
        // keep stepping for the victory pose and falling bodies, then wrap up
        world.step(STEP, {});
        for (const e of world.drainEvents()) view.handle(e, world);
        clearTimer -= dt;
        if (clearTimer <= 0) onStageClear();
    } else if (mode === 'play' && world) {
        if (snap.pause) { pause(); }
        else {
            acc += dt;
            // a frame shorter than STEP runs no sim step; carry its presses to the next one
            for (const k of EDGES) if (carry[k]) snap[k] = true;
            carry = {};
            let first = true, n = 0;
            while (acc >= STEP && n < 5 && mode === 'play') {
                world.step(STEP, first ? snap : { ...snap, atk: false, jump: false, spec: false, ovr: false });
                first = false; acc -= STEP; n++;
                for (const e of world.drainEvents()) handleEvent(e);
                if (world.paused && mode === 'play' && world.state !== 'gameover') mode = 'held';
            }
            if (n === 0) for (const k of EDGES) if (snap[k]) carry[k] = true;
            if (mode === 'held') mode = 'play';
            if (acc > STEP * 5) acc = 0;
            // ambient barks
            const p = world.player;
            if (p.hp < p.maxHp * 0.25 && p.hp > 0 && !flags.low) { flags.low = 1; ui.bark('echo', 'Suit integrity critical. Find food — or stop getting hit.'); }
        }
    }
    if (mode === 'continue') {
        contT -= dt;
        $('cont-count').textContent = Math.max(0, Math.ceil(contT));
        if (contT <= 0) { ui.close('modal-continue'); gameOverScreen(); }
    }

    if (world) { ui.updateHUD(world, dt); view.frame(world, dt); }
    else if (demo) view.frame(demo, dt);
    else view.frame(null, dt, { camX: 400 });
}
requestAnimationFrame(frame);

boot();

// ---------------------------------------------------------------- debug hooks (?debug=1)
if (DEBUG) {
    window.__sc = {
        get mode() { return mode; }, get world() { return world; }, get session() { return S; }, ui, view, input,
        start(m = 'story', diff = 'normal', stage = 0, character = 'juno') { ui.closeAll(); newSession(m, diff, character, stage); },
        killAll() { if (!world) return; for (const f of world.fighters) if (f.team === 'enemy') { f.hp = 1; } },
        god(on = true) { if (world) world.player.armorMul = on ? 0 : 1; },
        warp(x) { if (!world) return; world.player.x = x; world.camX = Math.max(world.camX, x - lowW / 2 + 40); },
        skipDialog() { if (ui.inDialog) ui.endDialog(); },
        clearStage() { if (world) world.stageClear(); },
    };
}
