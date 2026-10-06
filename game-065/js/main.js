/**
 * main.js — Worldroot entry point.
 *
 * The simulation (js/sim) decides everything and knows nothing of the screen.
 * This file feeds it time and input, reads its events, and hands them to the
 * 3D world (js/view), the DOM UI (js/ui) and the sound (js/audio.js). It also
 * owns saving, offline catch-up, and the debug hooks behind ?debug=1.
 *
 * Library: three.js r165 via the import map in index.html.
 */

import { initStage, updateStage, render, setQuality, getQuality, orbitBy, zoomBy, setAutoRotate, snapCamera, setInsets, renderer, cameraState } from './view/stage.js';
import { World } from './view/world.js';
import { Grove, newState } from './sim/game.js';
import { GENERATORS, UPGRADE_BY_ID, STAGES, SPELLS, REALM_BY_ID, TRIAL_BY_ID, ACH_BY_ID, SEASONS, HEARTWOOD_BY_ID, REBIRTH_STAGE } from './sim/data.js';
import { Bot, ACTIVE } from './sim/bot.js';
import * as ui from './ui/ui.js';
import { fmt, fmtTime, setNumberStyle } from './ui/format.js';
import { initAudio, sfx, setSound, setMusic, setVolume, setSeason } from './audio.js';
import { loadGame, saveGame, clearGame, loadSettings, saveSettings, exportCode, importCode } from './save.js';

const $ = ui.$;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ------------------------------------------------------------------ settings + quality
const settings = loadSettings();
setNumberStyle(settings.sci ? 'sci' : 'short');
const coarse = window.matchMedia('(pointer: coarse)').matches;
let quality = settings.quality === 'auto' ? (coarse ? 1 : 0) : Number(settings.quality);
if (params.has('q')) quality = Number(params.get('q'));

initStage($('stage'), quality);
setAutoRotate(settings.rotate);
const world = new World();

// ------------------------------------------------------------------ load
let grove;
let away = null;           // offline summary to show after the title
const saved = loadGame();
if (saved) {
    grove = new Grove(saved.state);
    const secs = (Date.now() - saved.savedAt) / 1000;
    if (secs > 60) away = grove.offline(secs);
} else {
    grove = new Grove(newState((Math.random() * 2 ** 31) >>> 0));
}
let seq = grove.seq;
world.snap(grove);

// ------------------------------------------------------------------ actions (the UI calls these)
const act = {
    ui: () => sfx.ui(),
    saveSettings: () => saveSettings(settings),
    layout: () => layout(),
    buyGen(i, amt) {
        const n = grove.buyGen(i, amt);
        if (!n) { if (grove.genVisible(i)) sfx.error(); return; }
        sfx.buy(i);
        ui.refresh();
    },
    buyUpgrade(id) {
        if (!grove.buyUpgrade(id)) return;
        sfx.upgrade();
        ui.refresh();
    },
    buyAllUpgrades() {
        const n = grove.autoBuyUps();
        if (n) { sfx.upgrade(); ui.toast('✨', 'Upgrades', `Bought ${n} upgrade${n > 1 ? 's' : ''}.`); }
        ui.refresh();
    },
    nourish(quiet) {
        if (!grove.nourish()) { if (!quiet) sfx.error(); return; }
        const p = world.treeScreen(0.5);
        ui.floater(p.x, p.y, `🌱 Level ${grove.s.tree}`, 'big');
        ui.refresh();
    },
    cast(id) {
        if (!grove.cast(id)) { sfx.error(); return; }
        ui.refresh();
    },
    buyHeartwood(id) {
        if (!grove.buyHeartwood(id)) return;
        sfx.upgrade();
        ui.toast(HEARTWOOD_BY_ID[id].icon, 'Heartwood', `${HEARTWOOD_BY_ID[id].name} ${grove.hwLevel(id) > 1 ? `level ${grove.hwLevel(id)}` : 'awakened'}.`);
        ui.refresh(true);
    },
    setAuto(k, v) { grove.s.auto[k] = v; ui.refresh(); },
    askRebirth() {
        const gain = grove.hwGain();
        ui.modal(`<h2>Be reborn?</h2>
            <p>The ${STAGES[grove.stage].name} lets fall a single seed. The grove sleeps, and wakes again.</p>
            <div class="big-num">+${fmt(gain)} 🪵 heartwood</div>
            <p class="small dim">You keep heartwood, its gifts, achievements, trials and realms. Motes, spirits, upgrades and the tree begin again.</p>`,
        [{ label: 'Not yet' }, { label: 'Be reborn', cls: 'purple', fn: () => doRebirth(() => grove.rebirth()) }]);
    },
    askAbandon() {
        const t = TRIAL_BY_ID[grove.s.trial];
        const done = grove.s.trialsDone[t.id];
        ui.modal(`<h2>${done ? 'Trial complete' : 'Leave the trial?'}</h2><p>${done ? `You passed <b>${t.name}</b>. Its reward is yours: ${t.reward}` : `Leaving <b>${t.name}</b> now gives no reward, but it still counts as a rebirth.`}</p>`,
            [{ label: 'Stay' }, { label: done ? 'Be reborn' : 'Leave', cls: done ? 'green' : '', fn: () => doRebirth(() => grove.rebirth()) }]);
    },
    askTrial(id) {
        const t = TRIAL_BY_ID[id];
        ui.modal(`<h2>${t.name}</h2><p>${t.rule}</p><p>Grow a <b>${STAGES[t.goal].name}</b> to pass.</p><p class="mint small">Reward: ${t.reward}</p>
            <p class="small dim">Beginning a trial is a rebirth${grove.canRebirth() ? ` (worth ${fmt(grove.hwGain())} heartwood now)` : ''}. You can leave at any time.</p>`,
        [{ label: 'Not now' }, { label: 'Begin the trial', cls: 'purple', fn: () => doRebirth(() => grove.startTrial(id)) }]);
    },
    askRealm(id) {
        const r = REALM_BY_ID[id];
        ui.modal(`<h2>Bind ${r.name}?</h2><p>${r.desc}</p><p class="small dim">Binding is a rebirth worth ${fmt(grove.hwGain())} heartwood. The realm floats in the World Tree's crown forever, and every later tree is ×30 hungrier.</p>`,
            [{ label: 'Not yet' }, { label: `Bind ${r.name}`, cls: 'purple', fn: () => doRebirth(() => grove.bindRealm(id)) }]);
    },
};

function doRebirth(fn) {
    const before = grove.s.tree;
    if (!fn()) return;
    world.growth = Math.min(world.growth, before);
    ui.flash();
    saveGame(grove.s);
    ui.refresh(true);
}

// ------------------------------------------------------------------ events → audio, UI, world
function handleEvents() {
    const evs = grove.eventsSince(seq);
    if (!evs.length) return;
    seq = evs[evs.length - 1].seq;
    world.feed(evs, grove);
    for (const e of evs) {
        switch (e.type) {
            case 'buyGen':
                if (e.first) ui.toast(GENERATORS[e.gen].icon, 'A new spirit', `${GENERATORS[e.gen].name} joins the grove.`);
                if (e.milestone) { sfx.milestone(); ui.toast('⭐', 'Milestone', `${e.milestone} ${GENERATORS[e.gen].plural}: they shine twice as bright.`); }
                break;
            case 'nourish': sfx.nourish(); break;
            case 'stage': {
                sfx.stage();
                const st = STAGES[e.stage];
                ui.lore(st.name, st.lore);
                ui.flash();
                if (e.stage === REBIRTH_STAGE && !grove.s.rebirths) ui.toast('🌀', 'Rebirth', 'The tree could now drop a seed and begin again, stronger. See the Rebirth tab.', 6000);
                if (e.stage === 2 && !grove.s.rebirths) ui.toast('🔮', 'Spells', 'Sap is flowing. Spells are in the Magic tab.', 5000);
                break;
            }
            case 'reveal': ui.toast(GENERATORS[e.gen].icon, 'Something stirs', `${GENERATORS[e.gen].plural} can now join the grove.`); break;
            case 'wispSpawn': sfx.wispAppear(); break;
            case 'wispCatch': {
                sfx.wispCatch();
                const p = world.wispScreen() || world.treeScreen(0.6);
                ui.floater(p.x, p.y, `${e.name}${e.value ? `: +${fmt(e.value)}` : '!'}`, 'gift');
                if (e.auto) ui.toast('🕸️', 'Wisp Catcher', `${e.name}${e.value ? `: +${fmt(e.value)} motes` : ''}`);
                break;
            }
            case 'wispMiss': sfx.wispMiss(); break;
            case 'spell': sfx.spell(); break;
            case 'gift': { const p = world.treeScreen(0.6); ui.floater(p.x, p.y, `+${fmt(e.value)}`, 'gift'); break; }
            case 'ach': { const a = ACH_BY_ID[e.id]; sfx.achievement(); ui.toast('🏆', 'Achievement', a.name); break; }
            case 'rebirth': sfx.rebirth(); if (e.gain) ui.toast('🪵', 'Reborn', `+${fmt(e.gain)} heartwood.`, 5000); break;
            case 'trialStart': ui.toast('⚖️', 'Trial begun', TRIAL_BY_ID[e.id].rule, 6000); break;
            case 'trialDone': sfx.stage(); ui.toast('🏅', 'Trial passed', `${TRIAL_BY_ID[e.id].name}: ${TRIAL_BY_ID[e.id].reward}`, 7000); break;
            case 'realm': ui.lore(`${REALM_BY_ID[e.id].name} is bound`, REALM_BY_ID[e.id].desc); break;
            case 'season': {
                const se = SEASONS[e.season];
                setSeason(e.season);
                ui.toast(se.icon, se.name, se.desc);
                break;
            }
            default: break;
        }
    }
    ui.refresh();
}

// ------------------------------------------------------------------ input on the canvas
const canvas = renderer.domElement;
const pointers = new Map();
let pinch0 = 0, dragging = false;

function tryWisp(x, y) {
    const w = world.wispScreen();
    if (!w || !grove.s.wisp.active) return false;
    const r = Math.max(48, Math.min(90, window.innerHeight * 0.07));
    if (Math.hypot(w.x - x, w.y - y) > r) return false;
    grove.catchWisp();
    return true;
}

function tapTree(x, y) {
    const p = world.hitTree(x, y);
    if (!p) return false;
    clickAt(x, y, p);
    return true;
}

function clickAt(x, y, p) {
    const v = grove.click(1);
    const big = grove.s.buffs.some((b) => b.kind === 'click');
    if (v > 0) ui.floater(x, y - 20, `+${fmt(v)}`, big ? 'big' : '');
    world.clickBurst(p, big);
    sfx.click(big);
    if (grove.s.stats.clicks >= 6) $('hint').hidden = true;
}

canvas.addEventListener('pointerdown', (e) => {
    if (!started) return;
    initAudio();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        return;
    }
    dragging = false;
    if (tryWisp(e.clientX, e.clientY)) return;
    tapTree(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) zoomBy(pinch0 / d);
        pinch0 = d;
        return;
    }
    if (!dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) dragging = true;
    if (dragging) orbitBy(dx, dy);
});
const endPointer = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
    if (!started || e.target.closest?.('input, textarea, select')) return;
    if (ui.modalOpen()) { if (e.key === 'Escape') ui.closeModal(); return; }
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
        if (e.target.closest?.('button')) return;
        e.preventDefault();
        initAudio();
        const p = world.treeScreen(0.5);
        clickAt(p.x, p.y, world.tree.group.position.clone().setY(world.size.height * 0.5));
    } else if (k === 'n') act.nourish();
    else if (k === 'w') { if (grove.s.wisp.active) grove.catchWisp(); }
    else if (k >= '1' && k <= '5') act.cast(SPELLS[Number(k) - 1].id);
    else if (k === 'm') { settings.music = !settings.music; setMusic(settings.music); $('set-music').checked = settings.music; saveSettings(settings); }
});

// ------------------------------------------------------------------ layout: keep the tree in the visible part of the screen
function layout() {
    const panel = $('panel').getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const side = panel.left > 40 && panel.height > h * 0.6;
    const top = $('hud-top').getBoundingClientRect().bottom;
    if (side) setInsets(w - panel.left, 0, Math.min(h * 0.25, top));
    else setInsets(0, Math.max(0, h - panel.top), Math.min(h * 0.22, top));
}
window.addEventListener('resize', () => setTimeout(layout, 50));
$('panel').addEventListener('transitionend', layout);

// ------------------------------------------------------------------ settings pane
function wireSettings() {
    const bind = (id, key, fn) => { const el = $(id); el.checked = !!settings[key]; el.addEventListener('change', () => { settings[key] = el.checked; fn?.(el.checked); saveSettings(settings); }); };
    bind('set-sound', 'sound', setSound);
    bind('set-music', 'music', setMusic);
    bind('set-sci', 'sci', (v) => { setNumberStyle(v ? 'sci' : 'short'); ui.refresh(true); });
    bind('set-rotate', 'rotate', setAutoRotate);
    bind('set-floaters', 'floaters');
    const vol = $('set-volume'); vol.value = settings.volume;
    vol.addEventListener('input', () => { settings.volume = Number(vol.value); setVolume(settings.volume); saveSettings(settings); });
    const q = $('set-quality'); q.value = String(settings.quality);
    q.addEventListener('change', () => {
        settings.quality = q.value; saveSettings(settings);
        setQuality(q.value === 'auto' ? (coarse ? 1 : 0) : Number(q.value));
        ui.toast('⚙️', 'Graphics', 'Reload the page for grass and particle counts to change too.');
    });
    $('btn-save').addEventListener('click', () => { $('save-msg').textContent = saveGame(grove.s) ? 'Saved.' : 'This browser is not letting the page save.'; });
    $('btn-export').addEventListener('click', () => {
        const t = $('save-text'); t.hidden = false; t.value = exportCode(grove.s); t.select();
        $('save-msg').textContent = 'Copy the code above.';
        try { navigator.clipboard?.writeText(t.value).then(() => { $('save-msg').textContent = 'Save code copied.'; }, () => {}); } catch { /* no clipboard */ }
    });
    $('btn-import').addEventListener('click', () => { $('save-text').hidden = false; $('save-text').value = ''; $('btn-import-go').hidden = false; $('save-text').focus(); });
    $('btn-import-go').addEventListener('click', () => {
        const data = importCode($('save-text').value);
        if (!data) { $('save-msg').textContent = 'That code did not work.'; return; }
        replaceGrove(new Grove(data.state));
        $('save-msg').textContent = 'Save loaded.';
        $('btn-import-go').hidden = true;
    });
    $('btn-help').addEventListener('click', showHelp);
    $('btn-wipe').addEventListener('click', () => ui.modal('<h2>Erase this grove?</h2><p>Everything will be lost: the tree, every spirit, heartwood, trials and realms. This cannot be undone.</p>',
        [{ label: 'Keep it' }, { label: 'Erase', cls: '', fn: () => { clearGame(); replaceGrove(Grove.fresh((Math.random() * 2 ** 31) >>> 0)); } }]));
}

function replaceGrove(g) {
    grove = g;
    seq = grove.seq;
    world.snap(grove);
    snapCamera();
    ui.setGrove(grove);
    saveGame(grove.s);
}

function showHelp() {
    ui.modal(`<h2>How to grow a World Tree</h2><ul>
        <li><b>Touch the tree</b> (or the seed) to gather motes of light.</li>
        <li><b>Spirits</b> (Grove tab) gather motes for you, all the time, even while you are away.</li>
        <li><b>Nourish</b> the tree with motes: each level makes everything stronger, and every ten levels it grows into a new stage that wakes new spirits and magic.</li>
        <li><b>Upgrades</b> multiply your spirits and touches. Owning 50, 100, 150… of a spirit doubles it.</li>
        <li><b>Golden wisps</b> drift by every few minutes: catch them for gifts. <b>Spells</b> spend sap for bursts of power. <b>Seasons</b> turn every five minutes.</li>
        <li>At the <b>Grove Tree</b> stage you can be <b>reborn</b> for heartwood: lasting power, automation, and trials. At the <b>World Tree</b>, bind the nine realms.</li>
        </ul><p class="small dim">Drag to look around, pinch or scroll to zoom. Keys: Space touch · N nourish · W catch wisp · 1–5 spells · M music.</p>`,
    [{ label: 'Let it grow', cls: 'green' }]);
    settings.seenHelp = true; saveSettings(settings);
}

function showAway(a) {
    if (!a || a.motes <= 0) return;
    const bits = [];
    if (a.gens > 0) bits.push(`${fmt(a.gens)} spirits joined`);
    if (a.ups > 0) bits.push(`${a.ups} upgrades bought`);
    if (a.tree > 0) bits.push(`the tree grew ${a.tree} level${a.tree > 1 ? 's' : ''}`);
    ui.modal(`<h2>While you were away…</h2>
        <p>You were gone for <b>${fmtTime(a.seconds)}</b>. The grove kept gathering light${a.eff < 1 ? ` at ${Math.round(a.eff * 100)}%` : ''}.</p>
        <div class="big-num">+${fmt(a.motes)} ✨</div>
        ${bits.length ? `<p class="small">${bits.join(' · ')}.</p>` : ''}
        ${a.capped ? `<p class="small dim">Only the first ${fmtTime(a.counted)} counted. Heartwood (Long Sleep) lets the grove dream longer.</p>` : ''}`,
    [{ label: 'Wonderful', cls: 'green' }]);
}

// ------------------------------------------------------------------ title
let started = false;
if (saved) {
    $('btn-start').textContent = 'Return to the Grove';
    document.querySelector('.tagline').innerHTML = `Your ${STAGES[grove.stage].name.toLowerCase()} is waiting.`;
}
$('btn-start').addEventListener('click', start);
function start() {
    if (started) return;
    started = true;
    initAudio();
    setSound(settings.sound); setMusic(settings.music); setVolume(settings.volume); setSeason(grove.seasonIndex());
    $('title').classList.add('gone');
    setTimeout(() => { $('title').hidden = true; }, 900);
    if (!saved && !settings.seenHelp) setTimeout(showHelp, 600);
    else if (away) setTimeout(() => showAway(away), 500);
    if (grove.s.stats.clicks < 6 && grove.s.tree === 0) { $('hint').textContent = 'Touch the seed to gather light'; $('hint').hidden = false; }
    layout();
}

// the Nourish button: tap, or hold to keep nourishing
{
    const nb = $('nourish-btn');
    let hold = null, rep = null;
    const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = null; };
    nb.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !started) return;
        initAudio();
        act.nourish();
        hold = setTimeout(() => { rep = setInterval(() => act.nourish(true), 160); }, 450);
    });
    nb.addEventListener('pointerup', stop);
    nb.addEventListener('pointerleave', stop);
    nb.addEventListener('pointercancel', stop);
    nb.addEventListener('click', (e) => { if (e.detail === 0) act.nourish(); });
    nb.addEventListener('contextmenu', (e) => e.preventDefault());
}

ui.initUI(grove, act, settings);
wireSettings();
if (!coarse && window.innerWidth >= 900) ui.togglePanel(true);
else if (window.matchMedia('(orientation: portrait)').matches && window.innerHeight < 700 && !saved) ui.togglePanel(false);
layout();

// ------------------------------------------------------------------ save + visibility
setInterval(() => { if (started) saveGame(grove.s); }, 10000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); saveGame(grove.s); return; }
    if (!hiddenAt) return;
    const secs = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (secs > 20) {
        const a = grove.offline(secs);
        seq = grove.seq;
        world.snap(grove);
        if (started) showAway(a);
        ui.refresh(true);
    }
    last = performance.now();
});
window.addEventListener('pagehide', () => saveGame(grove.s));

// ------------------------------------------------------------------ loop
let last = performance.now();
let uiT = 0, fpsT = 0, fpsN = 0, slow = 0, frames = 0;
let speed = 1;
let bot = null;
function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, DEBUG ? 0.25 : 0.1);
    last = now;
    try {
        if (started) {
            const simDt = dt * speed;
            const steps = Math.max(1, Math.ceil(simDt / 0.25));
            for (let i = 0; i < steps; i++) grove.tick(simDt / steps);
            if (bot) bot.play(Math.max(1, Math.round(simDt)));
            handleEvents();
        }
        world.update(dt, grove);
        updateStage(dt);
        render();
        frames++;
        ui.refreshHUD();
        uiT += dt;
        if (uiT > 0.15) { uiT = 0; ui.refresh(); $('wisp-hint').hidden = !(grove.s.wisp.active && grove.s.stats.wisps < 3); }
        // adaptive quality: step down after a few slow seconds
        fpsT += dt; fpsN++;
        if (fpsT > 1) {
            const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
            if (settings.quality === 'auto' && !DEBUG && fps < 32) { if (++slow >= 3 && getQuality() < 2) { setQuality(getQuality() + 1); slow = 0; } } else slow = 0;
        }
    } catch (err) {
        console.error(err);
    }
}
world.update(0.016, grove);
snapCamera();
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => { $('loading').classList.add('gone'); setTimeout(() => { $('loading').hidden = true; }, 700); }, 150);

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__wr = {
        get grove() { return grove; },
        state: () => ({
            started, motes: grove.s.motes, mps: grove.mps(), tree: grove.s.tree, stage: grove.stage, gens: grove.s.gens.slice(),
            ups: Object.keys(grove.s.ups).length, wisp: !!grove.s.wisp.active, rebirths: grove.s.rebirths, hw: grove.s.hw, realms: grove.s.realms.slice(),
            trial: grove.s.trial, frames, quality: getQuality(), growth: world.growth, modal: ui.modalOpen(), tab: ui.currentTab(), clicks: grove.s.stats.clicks,
        }),
        give: (n) => { grove.gain(n, 'debug'); ui.refresh(true); },
        tree: (L) => { grove.s.tree = L; grove.s.bestStage = Math.max(grove.s.bestStage, grove.stage); grove.mark(); world.snap(grove); ui.refresh(true); },
        gens: (arr) => { arr.forEach((n, i) => { grove.s.gens[i] = n; if (n) grove.s.seen[i] = true; }); grove.mark(); ui.refresh(true); },
        wisp: () => { grove.spawnWisp(); },
        wispScreen: () => world.wispScreen(),
        treeScreen: (f = 0.5) => world.treeScreen(f),
        offline: (sec) => { const a = grove.offline(sec); seq = grove.seq; world.snap(grove); showAway(a); return a; },
        speed: (n) => { speed = n; },
        autoplay: (on = true) => { bot = on ? new Bot(grove, ACTIVE) : null; },
        season: (si) => { grove.s.t = si * 300 + 1; },
        save: () => saveGame(grove.s),
        snap: () => { world.snap(grove); world.update(0.001, grove); updateStage(0.001); snapCamera(); },
        closeModal: () => ui.closeModal(),
        debugCam: () => ({ ...cameraState(), size: world.size, growth: world.growth }),
        /** Burst pool health: a dead spark must never stay visible (it used to linger as a 1 px dot). */
        bursts: () => {
            const b = world.bursts;
            let alive = 0, dead = 0, deadVisible = 0;
            for (let i = 0; i < b.max; i++) {
                if (b.life[i] > 0) alive++;
                else if (b.age[i] > 0) { dead++; if (b.alpha[i] > 0 || b.size[i] > 0) deadVisible++; }
            }
            return { alive, dead, deadVisible };
        },
        brightness: () => {
            render();       // read back in the same task as the draw, before the buffer is presented and cleared
            const c = renderer.domElement;
            const g = c.getContext('webgl2') || c.getContext('webgl');
            const px = new Uint8Array(4);
            g.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
            return px[0] + px[1] + px[2];
        },
    };
}
