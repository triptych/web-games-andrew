/**
 * main.js — PALE ENGINE entry point.
 *
 * States: loading → title (attract demo behind the menu) → difficulty →
 *         briefing → card → playing ⇄ paused / log / map → intermission →
 *         (next level | briefing | ending) ; playing → dead → restart
 *
 * Library: three.js r165 via import map (index.html). Everything else is
 * vanilla JS + DOM.
 */
import { Renderer } from './render/renderer.js';
import { FX } from './render/fx.js';
import { ViewModels } from './render/viewmodels.js';
import { Player } from './game/player.js';
import { Weapons } from './game/weapons.js';
import { Session, bindInputFns } from './game/session.js';
import { rollRoster } from './game/species.js';
import { ARCHETYPES } from './game/bestiary.js';
import { clearTemplates } from './game/models.js';
import { HUD } from './ui/hud.js';
import { input, initInput, initTouch, requestLock, exitLock, pollKeys, consumeLook, clearPressed } from './input.js';
import { initAudio, sfx, music, setVolumes, suspendAudio } from './audio.js';
import { LEVELS, EPISODES, ENDING, LOGS } from './story.js';
import { arsenalFor, descentSpec, descentArsenal } from './campaign.js';
import { DIFFICULTIES, SAVE_KEY, VERSION, WEAPON_BY_ID, QUALITY } from './config.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const FIXED_SEED = DEBUG ? +(new URLSearchParams(location.search).get('seed') ?? 0) : 0;
const newSeed = () => FIXED_SEED || Math.floor(Math.random() * 2 ** 31);
const $ = (id) => document.getElementById(id);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

// ------------------------------------------------------------------ save + settings

const DEFAULT_SETTINGS = {
    sens: 1, touchSens: 1, fov: 80, sfx: 0.8, music: 0.55, invertY: false, alwaysRun: true,
    autoAim: IS_TOUCH ? 2 : 1, bob: 1, shake: 1, quality: 'auto', retro: false, showFps: false,
};
let save = loadSave();
function loadSave() {
    try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s && s.v === 1) { s.settings = { ...DEFAULT_SETTINGS, ...s.settings }; return s; }
    } catch { /* fall through */ }
    return { v: 1, settings: { ...DEFAULT_SETTINGS }, campaign: null, completed: false, descentBest: 0, codex: {} };
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage may be blocked */ } }
const settings = save.settings;

// ------------------------------------------------------------------ engine objects

const R = new Renderer($('app'));
const fx = new FX(R.scene, R);
const vm = new ViewModels(R.renderer, R.vmScene, R.vmCamera);
const player = new Player();
const weapons = new Weapons({ player, time: 0 }, vm);
const hud = new HUD();
bindInputFns(consumeLook, clearPressed);
if (IS_TOUCH) document.body.classList.add('touch');
if (DEBUG) input.bypass = true;

let tier = settings.quality === 'auto' ? (IS_TOUCH ? 1 : 0) : +settings.quality;
R.setQuality(tier, { retro: settings.retro });
fx.setBudget(QUALITY[tier].particles);
R.setFov(settings.fov);

// ------------------------------------------------------------------ game state

const game = {
    state: 'loading',
    mode: 'campaign',       // 'campaign' | 'descent'
    S: null,
    levelIndex: 0,
    depth: 1,
    seed: 1,
    diff: DIFFICULTIES[1],
    species: null,
    seenSpecies: new Set(),
    startLoadout: null,
    mapOpen: false,
    totals: null,
};

function applySettings() {
    input.sensitivity = settings.sens;
    input.touchSensitivity = settings.touchSens;
    input.invertY = settings.invertY;
    input.alwaysRun = settings.alwaysRun;
    setVolumes(settings.sfx, settings.music);
    $('fps').hidden = !settings.showFps;
    if (game.S) game.S.settings = settings;
}
applySettings();

// ------------------------------------------------------------------ screens

const SCREENS = ['s-loading', 's-title', 's-difficulty', 's-options', 's-help', 's-codex', 's-briefing', 's-card', 's-lock', 's-pause', 's-log', 's-inter', 's-death', 's-ending'];
let screenStack = [];
function show(id, push = false) {
    if (push) screenStack.push(SCREENS.find((s) => !$(s).hidden));
    else screenStack = [];
    for (const s of SCREENS) $(s).hidden = s !== id;
    const first = $(id)?.querySelector('button:not([hidden])');
    if (first && !IS_TOUCH) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function back() {
    const prev = screenStack.pop();
    if (prev) show(prev, false), screenStack.length && 0;
    else show(game.state === 'paused' ? 's-pause' : 's-title');
    if (prev === 's-pause') game.state = 'paused';
}
function hideScreens() { for (const s of SCREENS) $(s).hidden = true; }
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { sfx.ui(); back(); }));

function setLoading(text) { $('loading-text').textContent = text; show('s-loading'); }

// ------------------------------------------------------------------ session callbacks

const callbacks = {
    onMessage: (t, c) => hud.message(t, c),
    onComms: (t) => hud.say(t),
    onLog: (log, t) => openLog(log, t),
    onComplete: () => { fade(true); setTimeout(() => { levelComplete(); fade(false); }, 900); },
    onDeath: () => playerDied(),
    onHurtFrom: (x, z, amt) => hud.hurtFrom(x, z, player, amt),
    onHitMarker: (k) => hud.hitMarker(k),
    onNewWeapon: () => hud.grin(),
    onKey: () => hud.grin(),
    onKill: (m, source) => {
        if (source === player) hud.hitMarker(2);
        const k = save.codex[m.arch] ?? (save.codex[m.arch] = { kills: 0 });
        k.kills++;
    },
    onNewSpecies: (sp) => {
        save.codex[sp.arch] = { ...(save.codex[sp.arch] ?? { kills: 0 }), seen: true, name: sp.name, skin: sp.colors.skin };
        writeSave();
    },
};

function makeSession(demo = false) {
    if (game.S) { game.S.dispose(); game.S = null; }
    clearTemplates();
    const S = new Session({ renderer: R, fx, vm, player, weapons, species: game.species, settings, callbacks, seenSpecies: game.seenSpecies });
    S.demo = demo;
    S.touch = IS_TOUCH;
    game.S = S;
    return S;
}

// ------------------------------------------------------------------ title + attract demo

function startTitle() {
    game.state = 'title';
    hud.show(false);
    $('touch').hidden = true;
    game.mapOpen = false; $('automap').hidden = true;
    exitLock();
    const demoSeed = 1000 + Math.floor(Math.random() * 1e6);
    game.species = rollRoster(demoSeed);
    const pick = [0, 3, 6, 7][Math.floor(Math.random() * 4)];
    const S = makeSession(true);
    S.load(LEVELS[pick], demoSeed, { depth: pick + 1, difficulty: DIFFICULTIES[1], arsenal: arsenalFor(pick) });
    // a demo room with monsters in it
    const rooms = S.L.rooms.filter((r) => S.L.things.some((t) => t.type === 'monster' && t.room === r.id && !t.ambush));
    S.demoRoom = rooms.length ? rooms.sort((a, b) => b.w * b.h - a.w * a.h)[0].id : S.L.startRoom;
    vm.show(null);
    R.vmPass.enabled = false;
    $('btn-continue').hidden = !save.campaign;
    $('title-foot').textContent = `v${VERSION}` + (save.descentBest ? ` · Deepest descent: floor ${save.descentBest}` : '') + (save.completed ? ' · Campaign complete' : '');
    show('s-title');
    music.stop();
}

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    initAudio(); sfx.ui();
    const act = b.dataset.act;
    if (act === 'new') { game.mode = 'campaign'; openDifficulty(); }
    else if (act === 'descent') { game.mode = 'descent'; openDifficulty(); }
    else if (act === 'continue') continueCampaign();
    else if (act === 'options') { buildOptions(); show('s-options', true); }
    else if (act === 'help') show('s-help', true);
    else if (act === 'codex') { buildCodex(); show('s-codex', true); }
});

function openDifficulty() {
    const box = $('diff-cards');
    box.innerHTML = '';
    DIFFICULTIES.forEach((d, i) => {
        const c = document.createElement('button');
        c.className = 'dcard';
        c.innerHTML = `<b>${d.name}</b><div class="skulls">${'☠'.repeat(i + 1)}</div><span>${d.blurb}</span>`;
        c.addEventListener('click', () => { sfx.uiConfirm(); game.diff = d; if (game.mode === 'campaign') newCampaign(); else newDescent(); });
        box.appendChild(c);
    });
    show('s-difficulty', true);
}

// ------------------------------------------------------------------ campaign flow

function freshLoadout() {
    player.reset();
    return player.loadout();
}

function newCampaign() {
    game.seed = newSeed();
    game.species = rollRoster(game.seed);
    game.seenSpecies = new Set();
    game.levelIndex = 0;
    game.startLoadout = freshLoadout();
    game.totals = { kills: 0, monsters: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, time: 0 };
    save.campaign = { level: 0, diff: game.diff.id, seed: game.seed, loadout: game.startLoadout, seen: [], totals: game.totals };
    writeSave();
    briefing(0);
}

function continueCampaign() {
    const c = save.campaign;
    if (!c) return;
    game.mode = 'campaign';
    game.seed = c.seed;
    game.species = rollRoster(game.seed);
    game.seenSpecies = new Set(c.seen ?? []);
    game.levelIndex = c.level;
    game.diff = DIFFICULTIES.find((d) => d.id === c.diff) ?? DIFFICULTIES[1];
    game.startLoadout = c.loadout;
    game.totals = c.totals ?? { kills: 0, monsters: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, time: 0 };
    const lv = LEVELS[c.level];
    if (c.level === 0 || LEVELS[c.level - 1].ep !== lv.ep) briefing(lv.ep);
    else levelCard();
}

function newDescent() {
    game.seed = newSeed();
    game.species = rollRoster(game.seed);
    game.seenSpecies = new Set();
    game.depth = 1;
    game.startLoadout = freshLoadout();
    game.totals = { kills: 0, monsters: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, time: 0 };
    levelCard();
}

function currentSpec() {
    return game.mode === 'campaign' ? LEVELS[game.levelIndex] : descentSpec(game.depth, game.seed);
}

function briefing(ep) {
    game.state = 'briefing';
    hud.show(false); $('touch').hidden = true;
    const E = EPISODES[ep];
    $('brief-title').textContent = E.title;
    $('brief-text').innerHTML = E.crawl.map((p, i) => `<p style="animation-delay:${0.3 + i * 1.1}s">${p}</p>`).join('');
    show('s-briefing');
    music.stop();
}
$('brief-go').addEventListener('click', () => { initAudio(); sfx.uiConfirm(); levelCard(); });

function levelCard() {
    const spec = currentSpec();
    game.state = 'card';
    hud.show(false); $('touch').hidden = true;
    $('card-id').textContent = game.mode === 'campaign' ? spec.id : `DESCENT · FLOOR ${game.depth}`;
    $('card-name').textContent = spec.name;
    $('card-obj').textContent = spec.intro;
    $('card-hint').textContent = 'Generating…';
    show('s-card');
    // build the level behind the card
    setTimeout(() => {
        try { loadLevel(spec); } catch (e) { console.error(e); setLoading('Failed to build the level: ' + e.message); return; }
        $('card-hint').textContent = IS_TOUCH ? 'Tap to begin' : 'Click to begin';
        game.cardReady = true;
    }, 60);
}
$('s-card').addEventListener('click', () => {
    if (!game.cardReady) return;
    game.cardReady = false;
    initAudio();
    sfx.uiConfirm();
    beginPlay();
});

function loadLevel(spec) {
    const S = makeSession(false);
    player.applyLoadout(game.startLoadout);
    // keep the weapon you had if you still own it
    if (!player.weapons.has(weapons.current)) weapons.current = 'pistol';
    weapons.pending = null;
    const arsenal = game.mode === 'campaign' ? arsenalFor(game.levelIndex) : descentArsenal(game.depth);
    S.load(spec, game.seed, { depth: game.mode === 'campaign' ? game.levelIndex + 1 : game.depth, difficulty: game.diff, arsenal });
    S.settings = settings;
    R.vmPass.enabled = true;
    vm.show(weapons.current);
    weapons.raise = 0; weapons.phase = 'raising';
    hud.clearComms();
    precompile();
    $('hud-level').textContent = `${game.mode === 'campaign' ? spec.id : 'D' + game.depth} · ${spec.name}`;
}

function fade(on) { $('flash-overlay').classList.toggle('on', on); }

/** Compile every shader now, behind the level card, so the first explosion or
 *  weapon switch doesn't stall a frame. */
function precompile() {
    try {
        R.renderer.compile(R.scene, R.camera);
        const shown = Object.entries(vm.models).map(([k, g]) => [g, g.visible]);
        for (const [g] of shown) g.visible = true;
        R.renderer.compile(R.vmScene, R.vmCamera);
        for (const [g, v] of shown) g.visible = v;
    } catch (e) { console.warn('precompile', e); }
}

function beginPlay() {
    // fade in from black
    const ov = $('flash-overlay');
    ov.style.transition = 'none'; ov.classList.add('on');
    requestAnimationFrame(() => { ov.style.transition = ''; ov.classList.remove('on'); });
    game.state = 'playing';
    hideScreens();
    hud.show(true);
    $('touch').hidden = !IS_TOUCH;
    input.enabled = true;
    if (!IS_TOUCH) requestLock();
    const spec = game.S.spec;
    if (spec.vesper) setTimeout(() => game.S && hud.say(spec.vesper), 900);
    game.S.message(`${spec.name}`, '#ffb347');
}

function levelComplete() {
    if (game.state !== 'playing') return;
    const S = game.S;
    game.state = 'intermission';
    input.enabled = false; input.fire = false;
    exitLock();
    hud.show(false); $('touch').hidden = true;
    const st = S.stats;
    const t = game.totals;
    t.kills += st.kills; t.monsters += st.monsters; t.items += st.items; t.totalItems += st.totalItems; t.secrets += st.secrets; t.totalSecrets += st.totalSecrets; t.time += st.time;
    // carry the loadout forward
    player.keys.clear();
    game.startLoadout = player.loadout();
    const spec = S.spec;
    $('inter-name').textContent = game.mode === 'campaign' ? `${spec.id} · ${spec.name}` : `Floor ${game.depth} · ${spec.name}`;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 100);
    const rows = [
        ['Kills', pct(st.kills, st.monsters), '%'],
        ['Items', pct(st.items, st.totalItems), '%'],
        ['Secrets', pct(st.secrets, st.totalSecrets), '%'],
        ['Time', st.time, 'time'],
        ['Par', spec.par, 'time'],
    ];
    const tbl = $('inter-stats');
    tbl.innerHTML = rows.map(([k], i) => `<tr id="ir${i}"><td>${k}</td><td>—</td></tr>`).join('');
    // count up, DOOM-style
    let i = 0;
    const tick = () => {
        if (i >= rows.length) return;
        const [, v, kind] = rows[i];
        const cell = $('ir' + i).lastChild;
        const tr = $('ir' + i);
        let cur = 0;
        const step = () => {
            cur = Math.min(v, cur + Math.max(1, Math.ceil(v / 18)));
            cell.textContent = kind === '%' ? `${cur}%` : fmtTime(cur);
            sfx.ui();
            if (cur < v) setTimeout(step, 28);
            else { if (kind === '%' && v >= 100) tr.classList.add('perfect'); i++; setTimeout(tick, 260); }
        };
        step();
    };
    setTimeout(tick, 400);
    let note = '';
    if (st.time <= spec.par) note = 'Under par. ';
    if (pct(st.kills, st.monsters) >= 100 && pct(st.secrets, st.totalSecrets) >= 100) note += 'Every demon and every secret. Flawless.';
    $('inter-note').textContent = note;
    show('s-inter');
    music.setCombat(0);
    if (game.mode === 'campaign') {
        save.campaign = { level: game.levelIndex + 1, diff: game.diff.id, seed: game.seed, loadout: game.startLoadout, seen: [...game.seenSpecies], totals: game.totals };
        if (game.levelIndex + 1 >= LEVELS.length) { save.campaign = null; save.completed = true; }
    } else {
        save.descentBest = Math.max(save.descentBest, game.depth);
    }
    writeSave();
}
$('inter-go').addEventListener('click', () => {
    sfx.uiConfirm();
    if (game.mode === 'campaign') {
        game.levelIndex++;
        if (game.levelIndex >= LEVELS.length) return ending();
        const ep = LEVELS[game.levelIndex].ep;
        if (ep !== LEVELS[game.levelIndex - 1].ep) briefing(ep);
        else levelCard();
    } else {
        game.depth++;
        levelCard();
    }
});

function ending() {
    game.state = 'ending';
    hud.show(false); $('touch').hidden = true;
    if (game.S) { game.S.dispose(); game.S = null; }
    const t = game.totals;
    const lines = [...ENDING, `Campaign totals — kills ${t.kills}/${t.monsters}, items ${t.items}/${t.totalItems}, secrets ${t.secrets}/${t.totalSecrets}, time ${fmtTime(t.time)}.`, 'Endless Descent awaits on the title screen.'];
    $('ending-text').innerHTML = lines.map((p, i) => `<p style="animation-delay:${0.4 + i * 1.6}s">${p}</p>`).join('');
    show('s-ending');
}
$('ending-go').addEventListener('click', () => { sfx.uiConfirm(); startTitle(); });

function playerDied() {
    if (game.state !== 'playing') return;
    game.state = 'dead';
    input.enabled = false; input.fire = false;
    exitLock();
    $('touch').hidden = true;
    $('death-note').textContent = game.mode === 'descent' ? `You fell on floor ${game.depth}. Deepest: ${Math.max(save.descentBest, game.depth - 1)}.` : 'The Underneath keeps what it kills. Unless you take it back.';
    if (game.mode === 'descent') { save.descentBest = Math.max(save.descentBest, game.depth - 1); writeSave(); }
    show('s-death');
}
$('s-death').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx.ui();
    if (b.dataset.act === 'restart') { if (game.mode === 'descent') { game.depth = 1; game.startLoadout = freshLoadout(); } levelCard(); }
    else startTitle();
});

// ------------------------------------------------------------------ pause / log / map

function pause() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    input.fire = false;
    game.S.paused = true;
    const st = game.S.stats;
    $('pause-stats').innerHTML = `${game.S.spec.name}<br>Kills ${st.kills}/${st.monsters} · Items ${st.items}/${st.totalItems} · Secrets ${st.secrets}/${st.totalSecrets} · ${fmtTime(st.time)}`;
    show('s-pause');
    exitLock();
}
function resume() {
    if (game.state !== 'paused' && game.state !== 'log') return;
    game.state = 'playing';
    game.S.paused = false;
    hideScreens();
    if (!IS_TOUCH) requestLock();
}
$('s-pause').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx.ui();
    const a = b.dataset.act;
    if (a === 'resume') resume();
    else if (a === 'options') { buildOptions(); show('s-options', true); }
    else if (a === 'map') { resume(); toggleMap(true); }
    else if (a === 'restart') { game.S.paused = false; levelCard(); }
    else if (a === 'quit') { game.S.paused = false; startTitle(); }
});
$('s-lock').addEventListener('click', () => { if (game.state === 'playing') requestLock(); });

function openLog(log, t) {
    game.state = 'log';
    game.S.paused = true;
    input.fire = false;
    const logs = LOGS[game.S.spec.id] ?? [];
    $('log-count').textContent = logs.length ? `${t.log + 1} / ${logs.length}` : '';
    $('log-from').textContent = '> ' + log.from;
    const el = $('log-text');
    el.textContent = '';
    let k = 0;
    clearInterval(openLog.timer);
    openLog.timer = setInterval(() => { k += 3; el.textContent = log.text.slice(0, k); if (k >= log.text.length) clearInterval(openLog.timer); }, 16);
    show('s-log');
    exitLock();
}
function closeLog() {
    clearInterval(openLog.timer);
    // the key that closes the log must not also count as Use, or it reopens at once
    input.pressed.delete('use');
    if (game.S) game.S.logCooldown = 0.4;
    if (game.state === 'log') resume();
}
$('log-close').addEventListener('click', () => { sfx.ui(); closeLog(); });

function toggleMap(on = !game.mapOpen) {
    game.mapOpen = on;
    $('automap').hidden = !on;
    if (game.S) game.S.R.post.uScan.value = on ? 0.6 : 0;
}

// ------------------------------------------------------------------ options + codex

function buildOptions() {
    const box = $('opts');
    box.innerHTML = '';
    const range = (key, label, min, max, step, fmt = (v) => v) => {
        const row = document.createElement('label'); row.className = 'opt';
        row.innerHTML = `<span>${label} <b>${fmt(settings[key])}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}">`;
        const inp = row.querySelector('input'), b = row.querySelector('b');
        inp.addEventListener('input', () => { settings[key] = +inp.value; b.textContent = fmt(settings[key]); applySettings(); if (key === 'fov') R.setFov(settings.fov); writeSave(); });
        box.appendChild(row);
    };
    const toggle = (key, label, onChange) => {
        const row = document.createElement('div'); row.className = 'opt';
        row.innerHTML = `<span>${label}</span><button class="tog">${settings[key] ? 'On' : 'Off'}</button>`;
        const btn = row.querySelector('button');
        btn.classList.toggle('on', !!settings[key]);
        btn.addEventListener('click', () => { settings[key] = !settings[key]; btn.textContent = settings[key] ? 'On' : 'Off'; btn.classList.toggle('on', settings[key]); applySettings(); onChange?.(); writeSave(); sfx.ui(); });
        box.appendChild(row);
    };
    const select = (key, label, options, onChange) => {
        const row = document.createElement('label'); row.className = 'opt';
        row.innerHTML = `<span>${label}</span><select>${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
        const sel = row.querySelector('select');
        sel.value = String(settings[key]);
        sel.addEventListener('change', () => { settings[key] = isNaN(+sel.value) ? sel.value : +sel.value; applySettings(); onChange?.(); writeSave(); });
        box.appendChild(row);
    };
    if (!IS_TOUCH) range('sens', 'Mouse sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2));
    range('touchSens', 'Touch look speed', 0.3, 3, 0.05, (v) => v.toFixed(2));
    range('fov', 'Field of view', 65, 110, 1, (v) => `${v}°`);
    range('sfx', 'Effects volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    range('music', 'Music volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    select('autoAim', 'Auto-aim', [[0, 'Off'], [1, 'Vertical (classic)'], [2, 'Strong']]);
    toggle('invertY', 'Invert look');
    toggle('alwaysRun', 'Always run');
    range('bob', 'View bob', 0, 1, 0.1, (v) => Math.round(v * 100) + '%');
    range('shake', 'Screen shake', 0, 1, 0.1, (v) => Math.round(v * 100) + '%');
    select('quality', 'Graphics', [['auto', 'Auto'], [0, 'High'], [1, 'Medium'], [2, 'Low']], () => { tier = settings.quality === 'auto' ? tier : +settings.quality; R.setQuality(tier, { retro: settings.retro }); fx.setBudget(QUALITY[tier].particles); });
    toggle('retro', 'Retro pixels', () => R.setQuality(tier, { retro: settings.retro }));
    toggle('showFps', 'Show FPS');
}

function buildCodex() {
    const box = $('codex');
    const sp = save.campaign ? rollRoster(save.campaign.seed) : game.species;
    const seen = new Set(save.campaign?.seen ?? [...game.seenSpecies]);
    box.innerHTML = '';
    const notes = {
        husk: 'Station staff, hollowed out and wearing their own uniforms. Burst rifles.',
        imp: 'Small, quick, hurls balls of fire. Comes in packs.',
        hound: 'All jaw. Lunges from range — sidestep the charge.',
        wisp: 'A burning skull that throws itself at you. One good hit drops it.',
        gazer: 'A floating eye that spits plasma orbs. Tougher than it looks.',
        skitter: 'Spider-turret. Rattles off bursts of acid; keep moving.',
        brute: 'Big. Throws fans of energy bolts and slams the ground up close.',
        revenant: 'Skeletal, fast, shoulder launchers with homing missiles.',
        hierophant: 'Raises the dead and calls fire down on your position. Break line of sight before the flame lands.',
        juggernaut: 'A walking artillery piece. Rocket volleys. Bring everything.',
        overseer: 'Kell\'s security chassis — rotary cannon and rocket pods.',
        mother: 'Breeds cinderlings and skulls; jump her shockwaves.',
        archon: 'The thing on the throne. Shields itself with Engine pylons.',
    };
    for (const arch of Object.keys(notes)) {
        const cx = save.codex[arch];
        const known = seen.has(arch) || cx?.seen;
        const A = ARCHETYPES[arch];
        const d = document.createElement('div');
        d.className = 'cx' + (known ? '' : ' unknown');
        // prefer the species from the run in progress, else the last one you met
        const name = (save.campaign && seen.has(arch) ? sp?.[arch]?.name : null) ?? cx?.name ?? sp?.[arch]?.name;
        const skin = (save.campaign && seen.has(arch) ? sp?.[arch]?.colors.skin : null) ?? cx?.skin ?? [0.3, 0.3, 0.3];
        const col = `rgb(${skin.map((v) => Math.round(v * 255)).join(',')})`;
        d.innerHTML = known && name
            ? `<b><span class="sw" style="background:${col}"></span>${name}</b><i>${A.cls} · ${A.hp} HP${cx?.kills ? ` · ${cx.kills} slain` : ''}</i>${notes[arch]}`
            : `<b>??????</b><i>${A.boss ? 'Guardian' : 'Unknown hostile'}</i>Not yet encountered.`;
        box.appendChild(d);
    }
}

// ------------------------------------------------------------------ input wiring

initInput(R.renderer.domElement, {
    onLockChange: (locked) => {
        if (!locked && game.state === 'playing' && !IS_TOUCH) pause();
        $('s-lock').hidden = true;
    },
});
if (IS_TOUCH) {
    initTouch($('touch'), {
        stickBase: $('stick-base'), stickKnob: $('stick-knob'), fire: $('t-fire'), use: $('t-use'), jump: $('t-jump'),
        next: $('t-next'), prev: $('t-prev'), melee: $('t-melee'), map: $('t-map'), pause: $('t-pause'),
    });
}
// clicking the canvas re-locks the pointer while playing
R.renderer.domElement.addEventListener('click', () => { if (game.state === 'playing' && !IS_TOUCH && !input.locked) requestLock(); });
window.addEventListener('keydown', (e) => {
    if (game.state === 'log' && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); closeLog(); return; }
    if (game.state === 'paused' && (e.code === 'KeyP' || e.code === 'Escape') && !screenStack.length && !$('s-pause').hidden) { resume(); return; }
    if (game.state === 'card' && (e.code === 'Enter' || e.code === 'Space') && game.cardReady) $('s-card').click();
    if (e.code === 'Escape' && game.state !== 'playing' && game.state !== 'paused' && screenStack.length) back();
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (game.state === 'playing') pause(); suspendAudio(true); }
    else suspendAudio(false);
});

// ------------------------------------------------------------------ main loop

let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsVal = 60, slow = 0, fpsT = 0;

function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(raw, DEBUG ? 0.2 : 0.05);
    try {
        tick(dt);
    } catch (e) {
        console.error(e);
    }
    // fps + auto quality
    fpsAcc += raw; fpsN++;
    fpsT += raw;
    if (fpsT > 2) {
        fpsVal = fpsN / fpsAcc;
        fpsAcc = 0; fpsN = 0; fpsT = 0;
        if (settings.showFps) $('fps').textContent = `${Math.round(fpsVal)} fps · ${QUALITY[tier].name}`;
        if (settings.quality === 'auto' && !DEBUG && game.state === 'playing') {
            if (fpsVal < 40) slow++; else slow = 0;
            if (slow >= 3 && tier < QUALITY.length - 1) { tier++; slow = 0; R.setQuality(tier, { retro: settings.retro }); fx.setBudget(QUALITY[tier].particles); }
        }
    }
}

function tick(dt) {
    const S = game.S;
    pollKeys(dt);
    if (game.state === 'playing' && S) {
        const P = input.pressed;
        if (P.has('pause')) { if (game.mapOpen) toggleMap(false); else if (IS_TOUCH || input.locked || DEBUG) pause(); }
        if (P.has('map')) toggleMap();
        if (P.has('fps')) { settings.showFps = !settings.showFps; applySettings(); }
        for (let k = 1; k <= 9; k++) if (P.has('slot' + k)) weapons.selectSlot(k);
        if (P.has('next')) weapons.cycle(1);
        if (P.has('prev')) weapons.cycle(-1);
        if (P.has('last')) weapons.select(weapons.last);
        if (P.has('melee')) weapons.quickMelee();
        if (!IS_TOUCH && !input.locked && !DEBUG && game.state === 'playing') $('s-lock').hidden = false;
        else $('s-lock').hidden = true;
        S.update(dt);
        hud.update(dt, S);
        if (game.mapOpen) hud.drawMap($('automap'), S);
    } else if (S && S.demo) {
        S.demoUpdate(dt);
        clearPressed();
    } else if (S && (game.state === 'paused' || game.state === 'log' || game.state === 'dead' || game.state === 'intermission' || game.state === 'card')) {
        // keep the world alive behind menus (no simulation)
        S.time += 0;
        if (game.state === 'dead') { S.update(dt); hud.update(dt, S); }
        clearPressed();
    } else clearPressed();
    if (S || game.state === 'title') R.render(dt);
}

function fmtTime(s) { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ------------------------------------------------------------------ boot

setLoading('Painting textures…');
setTimeout(() => {
    try { startTitle(); } catch (e) { console.error(e); setLoading('Failed to start: ' + e.message); }
    requestAnimationFrame((t) => { last = t; frame(t); });
}, 30);

// unlock audio on the first gesture anywhere
const unlock = () => { initAudio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// ------------------------------------------------------------------ debug hooks

if (DEBUG) {
    window.__pe = {
        game, R, player, weapons, input, settings,
        get S() { return game.S; },
        start(diff = 1, level = 0, mode = 'campaign') {
            initAudio();
            game.mode = mode; game.diff = DIFFICULTIES[diff];
            if (mode === 'campaign') { newCampaign(); game.levelIndex = level; }
            else { newDescent(); game.depth = level + 1; }
            levelCard();
        },
        begin() { if (game.cardReady) { game.cardReady = false; beginPlay(); } },
        god(on = true) { settings.god = on; },
        killAll() { for (const m of game.S.monsters) if (m.alive && !m.static) m.die(9999, player, {}); },
        killBoss() { const b = game.S.boss; if (b?.alive) { b.shielded = false; b.die(9999, player, {}); } },
        giveAll() { for (const w of Object.keys(WEAPON_BY_ID)) player.weapons.add(w); player.ammo = { bullets: 200, shells: 50, rockets: 50, cells: 300 }; for (const k of ['blue', 'yellow', 'red']) player.keys.add(k); },
        toExit() { const L = game.S.L; player.x = (L.exit.cell % L.W + 0.5) * 2; player.z = (Math.floor(L.exit.cell / L.W) + 0.5) * 2; player.y = L.floor[L.exit.cell]; },
        finish() { game.S.exitOpen = true; game.S._exit(); },
        brightness() { R.render(0.016); return R.brightness(); },
        quality(q) { tier = q; R.setQuality(q, { retro: settings.retro }); },
        spawn(arch, d = 6) { const f = player.forward(); return game.S.spawnMonster(arch, player.x + f[0] * d, player.z + f[2] * d, { awake: true }); },
        lookAt(x, z) { player.yaw = Math.atan2(x - player.x, -(z - player.z)); },
        state: () => game.state,
    };
}
