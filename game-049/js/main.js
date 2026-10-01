/**
 * main.js — boot, the mode machine, the frame loop and the juice director.
 *
 * The simulation (js/sim) decides everything; this file feeds it the hero's
 * actions (keys, taps, auto-explore, travel), drains its event queue into
 * sounds, particles, numbers and camera juice, keeps the 3D view in step
 * with the run, and opens whichever screen the run is waiting on.
 */

import * as THREE from 'three';
import { initScene, renderFrame, setAtmosphere, snapCamera, follow, shake, punch, flash, aberrate, setDanger, setDark, setQuality, getQuality, setZoom, getZoom, pickTile, toScreen, lantern, scene, camera, brightness } from './view/scene.js';
import { buildLevelView, updateLevelView, disposeLevel } from './view/level.js';
import { syncActors, clearActors, actorEvent, actorPos } from './view/actors.js';
import { initFx, updateFx, burst, shoot, floatText, setAmbient, clearFx } from './view/fx.js';
import { initAudio, sfx, startMusic, stopMusic, setIntensity, setSoundEnabled, isSoundEnabled } from './audio.js';
import { initInput } from './input.js';
import { saveRun, loadRun, hasRun, clearRun, records, updateRecords, settings, saveSettings } from './save.js';
import { updateHud, drawMap, resetHudMemo, $ } from './ui/hud.js';
import * as UI from './ui/screens.js';
import {
    newRun, act, blocker, storyNext, choosePerk, chooseEnding, rekindle, closeDialog, acceptDialogQuest, buy, sell, buyOil,
    autoExplore, travelStep, visibleHostiles, canTarget, pstats, drainEvents, enterFloor, alive, updateFov, refresh,
} from './sim/game.js';
import { botStep, itemScore } from './sim/bot.js';
import { CLASSES, SKILLS } from './sim/classes.js';
import { WORLDS, worldOf, LAST_FLOOR } from './sim/worlds.js';
import { T, cheb } from './sim/tiles.js';
import { SPECIES, ELITE_AFFIXES } from './sim/monsters.js';
import { STATUS, damage as simDamage, gainXp, canEnter } from './sim/combat.js';
import { makeMonster } from './sim/monsters.js';
import { makeRng } from './sim/rng.js';
import { lineOfFire } from './sim/path.js';
import { CONSUMABLES } from './sim/items.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const clock = new THREE.Clock();
const S = settings();

const G = {
    run: null, attract: null, mode: 'boot', targeting: null, auto: null, lastAct: 0, queued: null, lastFloor: 0, lastLevel: null,
    actsSinceSave: 0, deathTimer: 0, pickedClass: 'warden', helpFrom: null, hover: null, holdDir: null, tipTimer: 0,
    records, hasSave: hasRun, itemScore: (it) => (G.run ? itemScore(G.run, it) : 0),
};

// ------------------------------------------------------------------ Boot

function boot() {
    initScene();
    initFx();
    if (S.quality !== null && S.quality !== undefined) setQuality(S.quality);
    setZoom(S.zoom || 1);
    setSoundEnabled(S.sound !== false);
    $('mute-btn').classList.toggle('off', !isSoundEnabled());
    UI.initScreens(G);
    initInput({ onKey, onTap, onInspect, onInspectEnd: hideTip, onHover, onZoom, onGesture: () => initAudio() });
    initButtons();
    initMarkers();
    window.addEventListener('pointerdown', () => initAudio(), { once: false, passive: true });
    window.addEventListener('keydown', () => initAudio(), { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
    window.addEventListener('pagehide', persist);
    startAttract();
    UI.showTitle(G);
    G.mode = 'title';
    setTimeout(() => $('fade').classList.remove('on'), 60);
    requestAnimationFrame(frame);
    if (DEBUG) exposeDebug();
}

function initButtons() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); initAudio(); fn(); });
    document.querySelectorAll('#skill-row .skill').forEach((b) => b.addEventListener('click', () => { initAudio(); pressSkill(+b.dataset.skill); }));
    on('btn-heal', quickHeal);
    on('btn-wait', () => playerAct({ t: 'wait' }));
    on('btn-explore', startExplore);
    on('btn-stairs', goStairs);
    on('btn-bag', () => openPanel('inventory'));
    on('btn-journal', () => openPanel('journal'));
    on('btn-map', () => openPanel('map'));
    on('minimap', () => openPanel('map'));
    on('pause-btn', () => openPanel('pause'));
    on('mute-btn', () => { setSoundEnabled(!isSoundEnabled()); S.sound = isSoundEnabled(); saveSettings(S); $('mute-btn').classList.toggle('off', !isSoundEnabled()); });
}

// ------------------------------------------------------------------ Runs

G.newRun = (cls, mode) => {
    stopAttract();
    clearRun();
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    G.run = newRun({ seed, cls, mode });
    updateRecords((r) => { r.runs++; });
    beginPlay();
};
G.continueRun = () => {
    const run = loadRun();
    if (!run) { UI.showTitle(G, records(), false); return; }
    stopAttract();
    G.run = run;
    beginPlay();
    if (run.over && run.dead) G.deathTimer = 0.01;
};
function beginPlay() {
    G.mode = 'play';
    G.lastFloor = 0;
    G.targeting = null; G.auto = null;
    resetHudMemo();
    $('hud').hidden = false;
    $('pause-btn').hidden = false;
    $('games-link').style.display = 'none';
    UI.hideAll();
    initAudio();
    syncFloor(true);
    checkBlockers();
    persist();
}
G.toTitle = () => {
    persist();
    if (G.run && G.run.over && !G.run.dead) clearRun();
    G.run = null;
    G.mode = 'title';
    $('hud').hidden = true;
    $('pause-btn').hidden = true;
    $('games-link').style.display = '';
    hideTip();
    startAttract();
    UI.showTitle(G);
};

function persist() {
    if (!G.run || G.mode !== 'play') return;
    if (G.run.over && G.run.mode === 'ironwick' && G.run.dead) { clearRun(); return; }
    if (G.run.won) { clearRun(); return; }
    if (!saveRun(G.run) && !G.saveWarned) { G.saveWarned = true; G.run.log.push({ text: 'Your browser refused to save — progress will not be kept.', cls: 'bad' }); }
    G.actsSinceSave = 0;
}

// ------------------------------------------------------------------ Attract mode (behind the title)

function startAttract() {
    const w = 1 + Math.floor(Math.random() * 10);
    const run = newRun({ seed: (Math.random() * 1e9) >>> 0, cls: ['warden', 'ranger', 'witch'][w % 3] });
    run.story = [];
    run.flags.god = true;
    const f = (w - 1) * 10 + 2 + Math.floor(Math.random() * 6);
    run.p.lvl = Math.max(1, Math.round(f * 0.4)); run.p.embers = w - 1;
    enterFloor(run, f);
    run.story = [];
    drainEvents(run);
    G.attract = { run, t: 0 };
    G.lastLevel = null;
    syncFloor(true, run);
}
function stopAttract() {
    if (!G.attract) return;
    G.attract = null;
    disposeLevel(); clearActors(); clearFx();
    G.lastLevel = null;
}

// ------------------------------------------------------------------ Floors

function syncFloor(snap, run = G.run) {
    if (!run) return;
    if (G.lastLevel === run.lv) return;
    G.lastLevel = run.lv;
    G.lastFloor = run.floor;
    const W = WORLDS[run.lv.world];
    clearActors(); clearFx();
    buildLevelView(run);
    setAtmosphere(W.look, run.lv.boss);
    setAmbient(W.look.particles);
    snapCamera(run.p.x, run.p.y);
    if (run !== (G.attract && G.attract.run)) {
        startMusic(run.lv.world);
        if (!snap) { $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 120); }
        updateRecords((r) => { r.deepest = Math.max(r.deepest, run.floor); });
        persist();
    } else startMusic(run.lv.world);
}

// ------------------------------------------------------------------ Acting

function playerAct(a) {
    const run = G.run;
    if (!run || G.mode !== 'play' || UI.openScreen() || blocker(run)) return false;
    const ok = act(run, a);
    if (ok) afterAct();
    return ok;
}

function afterAct() {
    const run = G.run;
    G.lastAct = clock.elapsedTime;
    hideTip();
    handleEvents(run, drainEvents(run), false);
    if (run.lv !== G.lastLevel) { G.auto = null; G.targeting = null; syncFloor(false); }
    if (++G.actsSinceSave >= 25) persist();
    checkBlockers();
}

/** Open whatever the run is waiting on: story, perk choice, dialog, death, victory. */
function checkBlockers() {
    const run = G.run;
    if (!run) return;
    const b = blocker(run);
    if (!b) { if (UI.openScreen() && ['story', 'perk', 'dialog', 'shop'].includes(UI.openScreen())) UI.hideAll(); return; }
    G.auto = null;
    cancelTargeting(true);
    if (b === 'over') {
        if (run.won) { UI.showVictory(G, run); updateRecords((r) => { r.wins++; if (!r.endings.includes(run.won)) r.endings.push(run.won); }); clearRun(); sfx.victory(); stopMusic(); }
        else if (run.dead && !G.deathTimer) G.deathTimer = 1.4;
        return;
    }
    if (b === 'story') { UI.showStory(G, run); if (run.story[0].k === 'defeat') sfx.victory(); return; }
    if (b === 'perk') { UI.showPerks(G, run); return; }
    if (b === 'dialog') { if (run.dialog.k === 'shop') UI.showShop(G, run); else UI.showDialog(G, run); }
}

G.act = (a) => { const ok = playerAct2(a); return ok; };
// Panel actions (equip, drink…) are allowed while the pack is open.
function playerAct2(a) {
    const run = G.run;
    if (!run || blocker(run)) return false;
    const ok = act(run, a);
    if (ok) {
        G.lastAct = clock.elapsedTime;
        handleEvents(run, drainEvents(run), false);
        if (run.lv !== G.lastLevel) syncFloor(false);
        if (blocker(run)) { UI.hideAll(); checkBlockers(); }
    }
    return ok;
}
G.storyNext = () => { storyNext(G.run); UI.hideAll(); checkBlockers(); persist(); };
G.choosePerk = (id) => { choosePerk(G.run, id); sfx.levelUp(); UI.hideAll(); checkBlockers(); };
G.chooseEnding = (id) => { if (chooseEnding(G.run, id)) { drainEvents(G.run); UI.hideAll(); checkBlockers(); } };
G.closeDialog = () => { closeDialog(G.run); UI.hideAll(); checkBlockers(); };
G.acceptQuest = () => { acceptDialogQuest(G.run); handleEvents(G.run, drainEvents(G.run)); UI.hideAll(); checkBlockers(); };
G.buy = (o, i) => { const ok = buy(G.run, o, i); if (ok) sfx.coin(); drainEvents(G.run); return ok; };
G.sell = (i) => { const ok = sell(G.run, i); drainEvents(G.run); return ok; };
G.buyOil = () => { const ok = buyOil(G.run); if (ok) sfx.oil(); drainEvents(G.run); return ok; };
G.rekindle = () => {
    if (!rekindle(G.run)) return;
    G.deathTimer = 0;
    drainEvents(G.run);
    G.lastLevel = null;
    UI.hideAll();
    syncFloor(false);
    sfx.levelUp();
    checkBlockers();
    persist();
};
G.closePanel = () => {
    const run = G.run;
    UI.hideAll();
    if (run && run.dialog) closeDialog(run);
    checkBlockers();
};
G.quality = () => getQuality();
G.cycleQuality = () => { setQuality((getQuality() + 1) % 3); S.quality = getQuality(); saveSettings(S); };

function openPanel(which) {
    const run = G.run;
    if (!run || G.mode !== 'play' || blocker(run)) return;
    G.auto = null;
    cancelTargeting(true);
    if (UI.openScreen()) { UI.hideAll(); if (UI.openScreen() === which) return; }
    if (which === 'inventory') UI.showInventory(G, run);
    else if (which === 'journal') UI.showJournal(G);
    else if (which === 'map') UI.showBigMap(G);
    else if (which === 'pause') UI.showPause(G);
}

// ------------------------------------------------------------------ Commands

function onKey(cmd, e) {
    initAudio();
    const run = G.run;
    if (G.mode !== 'play' || !run) return false;
    const scr = UI.openScreen();
    if (scr) {
        if (cmd.c === 'cancel' || (cmd.c === 'bag' && scr === 'inventory') || (cmd.c === 'journal' && scr === 'journal') || (cmd.c === 'map' && scr === 'bigmap')) {
            if (['inventory', 'journal', 'bigmap', 'pause', 'help', 'shop'].includes(scr) || (scr === 'dialog' && run.dialog && run.dialog.k === 'talk')) { G.closePanel(); return true; }
        }
        return false;
    }
    if (blocker(run)) { checkBlockers(); return false; }
    hideTip();
    if (G.targeting) {
        if (cmd.c === 'cancel') { cancelTargeting(); return true; }
        if (cmd.c === 'cycle') { cycleTarget(cmd.back ? -1 : 1); return true; }
        if (cmd.c === 'confirm' || (cmd.c === 'skill' && G.targeting.skill === CLASSES[run.p.cls].skills[cmd.i]) || cmd.c === 'fire') { confirmTarget(); return true; }
        if (cmd.c === 'move') { moveTargetCursor(cmd.d); return true; }
    }
    G.auto = null;
    switch (cmd.c) {
        case 'move': return queueMove(cmd.d), true;
        case 'wait': playerAct({ t: 'wait' }); return true;
        case 'explore': startExplore(); return true;
        case 'stairs': case 'confirm': goStairs(); return true;
        case 'bag': openPanel('inventory'); return true;
        case 'journal': openPanel('journal'); return true;
        case 'map': openPanel('map'); return true;
        case 'heal': quickHeal(); return true;
        case 'oil': { const o = run.p.inv.find((it) => it.b === 'oil'); if (o) playerAct({ t: 'use', id: o.id }); return true; }
        case 'pickup': playerAct({ t: 'pickup' }); return true;
        case 'skill': pressSkill(cmd.i); return true;
        case 'fire': case 'cycle': fireNearest(); return true;
        case 'cancel': openPanel('pause'); return true;
        case 'help': G.helpFrom = 'play'; UI.show('help'); return true;
        case 'zoom': onZoom(cmd.f); return true;
    }
    return false;
}

const STEP = 0.1;
function queueMove(d) {
    if (clock.elapsedTime - G.lastAct < STEP) { G.queued = { t: 'move', dx: d[0], dy: d[1] }; return; }
    playerAct({ t: 'move', dx: d[0], dy: d[1] });
}

function quickHeal() {
    const run = G.run;
    if (!run) return;
    const s = pstats(run);
    const inv = run.p.inv;
    const pick = run.p.hp < s.hpMax * 0.35 ? inv.find((it) => it.b === 'heal2') || inv.find((it) => it.b === 'heal') : inv.find((it) => it.b === 'heal') || inv.find((it) => it.b === 'heal2');
    if (!pick) { floatText(run.p.x, run.p.y, 'No potions', 'info', 1.6); return; }
    if (run.p.hp >= s.hpMax) { floatText(run.p.x, run.p.y, 'Already healthy', 'info', 1.6); return; }
    playerAct({ t: 'use', id: pick.id });
}

function startExplore() {
    const run = G.run;
    if (!run || blocker(run)) return;
    G.auto = { kind: 'explore' };
    $('explore-hint').hidden = true;
}

function goStairs() {
    const run = G.run;
    if (!run || blocker(run)) return;
    const { down } = run.lv;
    const p = run.p;
    if (p.x === down.x && p.y === down.y && run.lv.tiles[down.y * run.lv.w + down.x] === T.STAIRS_DOWN) { sfx.stairs(); playerAct({ t: 'descend' }); return; }
    if (!run.lv.seen[down.y * run.lv.w + down.x] || run.lv.tiles[down.y * run.lv.w + down.x] !== T.STAIRS_DOWN) {
        floatText(p.x, p.y, run.lv.boss ? 'The stairs are sealed' : 'Stairs not found yet', 'info', 1.6);
        hint(run.lv.boss ? 'Defeat the Warden to open the way down.' : 'Explore (🧭 / X) to find the stairs.');
        return;
    }
    G.auto = { kind: 'travel', x: down.x, y: down.y, descend: true };
}

function hint(text, ms = 2600) {
    const e = $('explore-hint');
    e.textContent = text; e.hidden = false;
    clearTimeout(G.hintT);
    G.hintT = setTimeout(() => { e.hidden = true; }, ms);
}

// ------------------------------------------------------------------ Auto travel / explore

function autoTick() {
    const run = G.run;
    if (!G.auto || !run || UI.openScreen() || blocker(run)) return;
    if (clock.elapsedTime - G.lastAct < 0.085) return;
    const p = run.p;
    run._t.threat = false;
    const hp = p.hp;
    let a = null;
    if (G.auto.kind === 'explore') {
        const r = autoExplore(run);
        if (r.stop === 'enemy') { G.auto = null; hint('Enemies in sight.'); return; }
        if (r.stop === 'trap') { G.auto = null; hint('The only way on is past a known trap. Walk over it yourself.', 3600); return; }
        if (r.done) {
            G.auto = null;
            const st = run.lv.seen[run.lv.down.y * run.lv.w + run.lv.down.x] && run.lv.tiles[run.lv.down.y * run.lv.w + run.lv.down.x] === T.STAIRS_DOWN;
            hint(st ? 'Floor explored. Press ⤵ (>) to go to the stairs.' : 'Nothing more to explore here.', 3200);
            return;
        }
        a = r;
    } else {
        a = travelStep(run, G.auto.x, G.auto.y);
        if (!a) {
            const arrived = p.x === G.auto.x && p.y === G.auto.y;
            const desc = G.auto.descend && arrived;
            G.auto = null;
            if (desc) { sfx.stairs(); playerAct({ t: 'descend' }); }
            else if (!arrived) hint('No known way there.');
            return;
        }
        // Never walk into a fight by accident: the last step onto a monster is the player's call.
        const tx = p.x + a.dx, ty = p.y + a.dy;
        if (run.mons.some((m) => alive(m) && m.x === tx && m.y === ty && !m.ally)) { G.auto = null; return; }
    }
    const ok = playerAct(a);
    if (!ok) { G.auto = null; return; }
    if (run._t.threat || p.hp < hp) {
        G.auto = null;
        const foe = visibleHostiles(run)[0];
        if (foe) hint(`You see ${foe.elite || foe.boss ? '' : 'a '}${foe.name}.`);
    }
}

// ------------------------------------------------------------------ Tap / inspect / hover

function tileFromScreen(sx, sy) {
    const run = G.run;
    // Monsters stand up: try the tile under the pointer at body height first.
    for (const h of [0.55, 0]) {
        const t = pickTile(sx, sy, h);
        if (!t) continue;
        const m = run.mons.find((o) => alive(o) && o.x === t.x && o.y === t.y && run._t.vis[o.y * run.lv.w + o.x] && !o.dormant);
        if (m || h === 0) return { ...t, m };
    }
    return null;
}

function onTap(sx, sy) {
    initAudio();
    const run = G.run;
    if (G.mode !== 'play' || !run || UI.openScreen() || blocker(run)) return;
    hideTip();
    const t = tileFromScreen(sx, sy);
    if (!t || t.x < 0 || t.y < 0 || t.x >= run.lv.w || t.y >= run.lv.h) return;
    if (G.targeting) { tapTarget(t); return; }
    G.auto = null;
    const p = run.p;
    const d = cheb(t.x, t.y, p.x, p.y);
    if (d === 0) {
        if (run.lv.tiles[p.y * run.lv.w + p.x] === T.STAIRS_DOWN) { sfx.stairs(); playerAct({ t: 'descend' }); }
        else if (run.items.some((f) => f.x === p.x && f.y === p.y)) playerAct({ t: 'pickup' });
        else playerAct({ t: 'wait' });
        return;
    }
    const s = pstats(run);
    if (t.m && !t.m.ally) {
        if (d === 1) { playerAct({ t: 'move', dx: t.x - p.x, dy: t.y - p.y }); return; }
        if (s.range > 1 && canTarget(run, t.m, s.range)) { playerAct({ t: 'fire', id: t.m.id }); return; }
    }
    if (d === 1) { playerAct({ t: 'move', dx: t.x - p.x, dy: t.y - p.y }); return; }
    if (!run.lv.seen[t.y * run.lv.w + t.x]) return;
    G.auto = { kind: 'travel', x: t.x, y: t.y };
    setMarkerFlash(t.x, t.y);
}

function onInspect(sx, sy) {
    const run = G.run;
    if (G.mode !== 'play' || !run || UI.openScreen()) return;
    const t = tileFromScreen(sx, sy);
    if (!t) return;
    const info = describeTile(run, t.x, t.y);
    if (!info) { hideTip(); return; }
    showTip(info, sx, sy);
    G.tipTimer = 4;
}

function onHover(sx, sy) {
    const run = G.run;
    if (G.mode !== 'play' || !run || sx < 0) { G.hover = null; hideTip(); return; }
    const t = tileFromScreen(sx, sy);
    G.hover = t;
    if (t && t.m && !UI.openScreen()) { showTip(describeTile(run, t.x, t.y), sx, sy); G.tipTimer = 0; }
    else if (G.tipTimer <= 0) hideTip();
}

function onZoom(f) { setZoom(getZoom() * f); S.zoom = getZoom(); clearTimeout(G.zoomSave); G.zoomSave = setTimeout(() => saveSettings(S), 500); }

function describeTile(run, x, y) {
    const lv = run.lv;
    const i = y * lv.w + x;
    if (!lv.seen[i]) return null;
    const m = run.mons.find((o) => alive(o) && o.x === x && o.y === y && run._t.vis[i]);
    if (m && !(m.dormant && m.disguise === 'burrow')) {
        if (m.dormant && m.disguise === 'chest') return '<b>Chest</b><br>A sturdy chest. Bump it to open.';
        const sp = SPECIES[m.sp];
        const arch = m.boss ? 'Warden' : m.ally ? 'Ally' : sp ? sp.a : '';
        let s = `<b>${m.name}</b> <small>lv ${m.lvl} · ${arch}</small><br>Health ${m.hp}/${m.hpMax} · damage ${m.dmg[0]}–${m.dmg[1]} · armour ${m.arm}`;
        if (m.elite) s += '<br>' + m.aff.map((a) => `<span class="elite">${ELITE_AFFIXES[a].n.replace('the ', '')}</span>: ${ELITE_AFFIXES[a].d}`).join('<br>');
        const st = Object.keys(m.st).map((k) => (STATUS[k] ? STATUS[k].n : k)).join(', ');
        if (st) s += `<br><i>${st}</i>`;
        if (!m.awake && !m.ally && !m.boss) s += '<br><i>It has not noticed you.</i>';
        if (sp && sp.r && !m.boss) s += `<br>Attacks from range ${sp.r}.`;
        return s;
    }
    const lines = [];
    if (x === run.p.x && y === run.p.y) lines.push('<b>You</b>');
    for (const f of run.items) if (f.x === x && f.y === y) lines.push(f.it.k === 'gold' ? `<b>${f.it.n} gold</b>` : `<b class="r${f.it.r}">${f.it.name}</b>`);
    const o = run.objs.find((o) => o.x === x && o.y === y && !o.gone && !(o.k === 'trap' && o.hidden));
    if (o) lines.push({
        chest: o.open ? 'An empty chest.' : '<b>Chest</b> — bump to open.', brazier: o.lit ? '<b>Brazier</b> (lit)' : '<b>Unlit brazier</b> — bump to light it.',
        shrine: o.used ? 'A silent shrine.' : '<b>Shrine</b> — bump to pray. Usually kind.', fountain: o.used ? 'A dry fountain.' : '<b>Fountain</b> — drink to heal.',
        merchant: `<b>${o.name}</b>, a merchant. Bump to trade.`, npc: `<b>${o.name}</b>, ${o.title}. Bump to talk.`, captive: `<b>${o.name}</b>, caged. Bump to free them.`,
        trap: `<b>${o.trap} trap</b> — avoid it.`,
    }[o.k] || o.k);
    const t = lv.tiles[i];
    const TN = { [T.STAIRS_DOWN]: '<b>Stairs down</b>', [T.STAIRS_UP]: 'Stairs up (no way back)', [T.DOOR]: 'A closed door', [T.VAULT_DOOR]: '<b>Vault door</b> — needs this floor\'s key',
        [T.SHALLOW]: 'Shallow water — puts out flames', [T.DEEP]: 'Deep water', [T.LAVA]: 'Lava', [T.CHASM]: 'A chasm', [T.PILLAR]: 'A pillar', [T.ICE]: 'Ice', [T.BRIDGE]: 'A bridge', [T.MOSS]: 'Moss' };
    if (TN[t]) lines.push(TN[t]);
    const hz = run.hazards.some((h) => h.tiles.includes(i));
    if (hz) lines.push('<span style="color:#ff8a6a">Something is about to strike here!</span>');
    return lines.length ? lines.join('<br>') : null;
}

function showTip(html, sx, sy) {
    if (!html) return;
    const tip = $('tooltip');
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, sx + 14))}px`;
    tip.style.top = `${Math.max(6, Math.min(window.innerHeight - h - 6, sy - h - 12))}px`;
}
function hideTip() { $('tooltip').hidden = true; }

// ------------------------------------------------------------------ Skills & targeting

function pressSkill(i) {
    const run = G.run;
    if (!run || G.mode !== 'play' || UI.openScreen() || blocker(run)) return;
    const id = CLASSES[run.p.cls].skills[i];
    const S = SKILLS[id];
    if (G.targeting && G.targeting.skill === id) { confirmTarget(); return; }
    if (run.p.lvl < S.lvl) { floatText(run.p.x, run.p.y, `${S.n}: level ${S.lvl}`, 'info', 1.6); return; }
    if (run.p.cds[id] > 0) { floatText(run.p.x, run.p.y, `${S.n}: ${run.p.cds[id]} turns`, 'info', 1.6); return; }
    G.auto = null;
    if (S.tgt === 'self') { playerAct({ t: 'skill', s: id }); return; }
    beginTargeting({ skill: id, tgt: S.tgt, range: S.tgt === 'adj' ? 1 : S.range, label: S.n });
}

G.beginThrow = (it) => { UI.hideAll(); beginTargeting({ item: it.id, tgt: 'tile', range: 6, label: `Throw ${CONSUMABLES[it.b].n}`, bomb: true }); };

function validTargets(run, T0) {
    const p = run.p;
    const foes = visibleHostiles(run).filter((m) => cheb(m.x, m.y, p.x, p.y) <= T0.range && (T0.tgt !== 'enemy' || canTarget(run, m, T0.range)));
    return foes.sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y));
}

function beginTargeting(T0) {
    const run = G.run;
    G.targeting = { ...T0, list: validTargets(run, T0), idx: 0, cursor: null };
    const tg = G.targeting;
    if ((tg.tgt === 'enemy' || tg.tgt === 'adj') && !tg.list.length) { floatText(run.p.x, run.p.y, 'No target in reach', 'info', 1.6); G.targeting = null; return; }
    if (tg.tgt === 'tile') tg.cursor = tg.list.length && !['tumble', 'blink'].includes(tg.skill) ? { x: tg.list[0].x, y: tg.list[0].y } : { x: run.p.x, y: run.p.y };
    $('target-hint').hidden = false;
    $('target-text').textContent = `${tg.label}: ${tg.tgt === 'tile' ? 'tap a tile' : 'tap a target'} · Tab cycles · Enter confirms`;
}

function cancelTargeting(silent) {
    G.targeting = null;
    $('target-hint').hidden = true;
}
G.cancelTargeting = () => cancelTargeting();

function cycleTarget(dir) {
    const tg = G.targeting;
    if (!tg.list.length) return;
    tg.idx = (tg.idx + dir + tg.list.length) % tg.list.length;
    if (tg.tgt === 'tile') tg.cursor = { x: tg.list[tg.idx].x, y: tg.list[tg.idx].y };
}
function moveTargetCursor(d) {
    const tg = G.targeting;
    if (tg.tgt !== 'tile') { cycleTarget(d[0] + d[1] >= 0 ? 1 : -1); return; }
    tg.cursor = { x: tg.cursor.x + d[0], y: tg.cursor.y + d[1] };
}

function confirmTarget() {
    const tg = G.targeting;
    const run = G.run;
    if (tg.tgt === 'tile') return fireTargeting(tg.cursor.x, tg.cursor.y);
    const m = tg.list[tg.idx];
    if (m) fireTargeting(m.x, m.y, m);
}

function tapTarget(t) {
    const tg = G.targeting;
    if (tg.tgt === 'tile') { fireTargeting(t.x, t.y); return; }
    const m = tg.list.find((o) => o.x === t.x && o.y === t.y);
    if (m) fireTargeting(m.x, m.y, m);
    else cancelTargeting();
}

function fireTargeting(x, y, m) {
    const tg = G.targeting;
    cancelTargeting(true);
    if (tg.item) { playerAct({ t: 'use', id: tg.item, x, y }); return; }
    const ok = playerAct({ t: 'skill', s: tg.skill, x, y, id: m ? m.id : undefined });
    if (!ok) floatText(G.run.p.x, G.run.p.y, "Can't do that there", 'info', 1.6);
}

function fireNearest() {
    const run = G.run;
    const s = pstats(run);
    const foes = visibleHostiles(run).filter((m) => (s.range > 1 ? canTarget(run, m, s.range) : cheb(m.x, m.y, run.p.x, run.p.y) <= 1)).sort((a, b) => cheb(a.x, a.y, run.p.x, run.p.y) - cheb(b.x, b.y, run.p.x, run.p.y));
    if (!foes.length) { floatText(run.p.x, run.p.y, 'No target', 'info', 1.6); return; }
    if (s.range > 1) playerAct({ t: 'fire', id: foes[0].id });
    else playerAct({ t: 'move', dx: foes[0].x - run.p.x, dy: foes[0].y - run.p.y });
}

// ------------------------------------------------------------------ Target markers

let markers = null, cursorRing = null, flashRing = null;
function initMarkers() {
    const g = new THREE.RingGeometry(0.36, 0.46, 28).rotateX(-Math.PI / 2);
    markers = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.4), transparent: true, opacity: 0.9, depthWrite: false }), 40);
    markers.count = 0; markers.frustumCulled = false; markers.renderOrder = 6;
    scene.add(markers);
    cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.5, depthWrite: false }));
    cursorRing.renderOrder = 6;
    scene.add(cursorRing);
    flashRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.2), transparent: true, opacity: 0, depthWrite: false }));
    scene.add(flashRing);
}
function setMarkerFlash(x, y) { flashRing.position.set(x, 0.05, y); flashRing.material.opacity = 0.9; flashRing.scale.setScalar(1.6); }
const _mm = new THREE.Matrix4();
function updateMarkers(dt, time) {
    const run = G.run;
    flashRing.material.opacity = Math.max(0, flashRing.material.opacity - dt * 1.5);
    flashRing.scale.multiplyScalar(1 - dt * 1.2);
    let n = 0;
    const tg = G.targeting;
    if (tg && run) {
        const pulse = 1 + Math.sin(time * 8) * 0.08;
        for (const m of tg.list) { if (n >= 40) break; _mm.compose(new THREE.Vector3(m.x, 0.06, m.y), new THREE.Quaternion(), new THREE.Vector3(pulse, 1, pulse)); markers.setMatrixAt(n++, _mm); }
        if (tg.tgt === 'tile' && tg.cursor) {
            cursorRing.visible = true;
            cursorRing.position.set(tg.cursor.x, 0.07, tg.cursor.y);
            cursorRing.material.color.setRGB(2, 1.2, 0.4);
            cursorRing.material.opacity = 0.9;
            const big = tg.skill === 'meteor' || tg.bomb;
            cursorRing.scale.setScalar(big ? 3.2 : 1);
        }
    } else if (G.hover && run && G.mode === 'play' && !UI.openScreen()) {
        cursorRing.visible = true;
        cursorRing.position.set(G.hover.x, 0.06, G.hover.y);
        cursorRing.scale.setScalar(1);
        cursorRing.material.color.setRGB(1.5, 1.5, 1.5);
        cursorRing.material.opacity = 0.35;
    } else cursorRing.visible = false;
    markers.count = n;
    markers.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ Juice director

const KIND_COL = { phys: 0xffe0c0, fire: 0xff7020, cold: 0x9ae0ff, poison: 0x80ff50, magic: 0xd080ff, thorns: 0x80ff80 };
const BOOM_COL = { fire: 0xff6010, meteor: 0xff8020, ice: 0x9ae0ff, poison: 0x70ff40, void: 0xa050ff, beam: 0xff50d0, rune: 0x7090ff, slam: 0xffb080, burrow: 0xa08060, charge: 0xffb080, arcane: 0xd080ff };

function handleEvents(run, evs, quiet) {
    const W = run.lv.w;
    let hurt = 0;
    for (const e of evs) {
        actorEvent(e);
        if (quiet && e.t !== 'shot') continue;
        switch (e.t) {
            case 'move': if (e.id === 0) sfx.step(); break;
            case 'atk': if (!e.ranged) sfx.swing(); break;
            case 'dmg': {
                const isHero = e.id === 0;
                floatText(e.x, e.y, String(e.n), isHero ? 'hurt' : e.crit ? 'crit' : e.kind, 1.3);
                burst({ x: e.x, y: 0.7, z: e.y, n: e.crit ? 16 : 8, color: isHero ? 0xff3040 : KIND_COL[e.kind] || 0xffe0c0, vel: 2.4, size: 0.12, life: 0.4 });
                if (isHero) { hurt += e.n; } else { sfx.hit(e.crit); if (e.crit) { shake(0.12); punch(0.5); } }
                break;
            }
            case 'miss': floatText(actorPos(e.id) ? actorPos(e.id).x : run.p.x, actorPos(e.id) ? actorPos(e.id).z : run.p.y, 'miss', 'miss', 1.3); sfx.miss(); break;
            case 'heal': if (!e.quiet) { floatText(e.x, e.y, '+' + e.n, 'heal', 1.4); if (e.id === 0) sfx.heal(); burst({ x: e.x, y: 0.6, z: e.y, n: 10, color: 0x60ff90, vel: 0.6, vy: 1.4, grav: 0, size: 0.14, life: 0.7, spread: 0.5 }); } break;
            case 'die': {
                const sp = run.mons.find((m) => m.id === e.id);
                if (e.id === 0) { sfx.death(); flash(0.5, 0xff0000); shake(0.6); stopMusic(); break; }
                const col = sp && SPECIES[sp.sp] ? SPECIES[sp.sp].c2 : 0xffd0a0;
                burst({ x: e.x, y: 0.5, z: e.y, n: e.boss ? 120 : e.elite ? 40 : 22, color: col, vel: e.boss ? 5 : 3, size: e.boss ? 0.3 : 0.18, life: e.boss ? 1.4 : 0.7 });
                burst({ x: e.x, y: 0.3, z: e.y, n: 10, color: 0x2a2a2a, vel: 1.2, size: 0.4, life: 0.8, bright: 0.6 });
                sfx.kill(e.boss || e.elite);
                if (e.burst) { sfx.boom(false); shake(0.2); }
                if (e.boss) { shake(1); flash(0.45, 0xfff0d0); aberrate(0.012); }
                break;
            }
            case 'shot': {
                shoot(e);
                if (e.kind === 'arrow' || e.kind === 'stone' || e.kind === 'quill' || e.kind === 'bolt') sfx.bow();
                else if (e.kind === 'fire' || e.kind === 'ember' || e.kind === 'bomb') sfx.fire();
                else if (e.kind === 'frost' || e.kind === 'frostbomb') sfx.frost();
                else sfx.magic();
                break;
            }
            case 'hazard': sfx.telegraph(); break;
            case 'boom': {
                const col = e.friendly ? 0xffa030 : BOOM_COL[e.kind] || 0xff6040;
                const step = Math.max(1, Math.floor(e.tiles.length / 28));
                for (let k = 0; k < e.tiles.length; k += step) { const i = e.tiles[k]; burst({ x: i % W, y: 0.3, z: (i / W) | 0, n: 5, color: col, vel: 2.2, vy: 1.5, size: 0.24, life: 0.55, spread: 0.6 }); }
                if (e.kind === 'ice') sfx.frost(); else sfx.boom(e.tiles.length > 12);
                shake(Math.min(0.5, 0.1 + e.tiles.length * 0.012));
                break;
            }
            case 'status': if (e.id === 0 && STATUS[e.st]) floatText(run.p.x, run.p.y, STATUS[e.st].n + '!', 'info', 1.7); if (e.st === 'frozen') sfx.frost(); break;
            case 'spawn': { const m = run.mons.find((o) => o.id === e.id); if (m) burst({ x: m.x, y: 0.4, z: m.y, n: 14, color: e.freed ? 0x80ff90 : 0x8a6aff, vel: 1.5, size: 0.25, life: 0.6 }); break; }
            case 'door': sfx.door(); break;
            case 'chest': { sfx.chest(); const o = run.objs.find((x) => x.id === e.id); if (o) burst({ x: o.x, y: 0.6, z: o.y, n: 24, color: 0xffd060, vel: 2, vy: 2, size: 0.12, life: 0.9 }); break; }
            case 'gold': sfx.coin(); if (e.x !== undefined) floatText(e.x, e.y, `+${e.n}◆`, 'gold', 1.0); break;
            case 'pickup': if (e.r >= 2 || e.b === 'page') sfx.rare(); else sfx.pickup(); break;
            case 'levelup': sfx.levelUp(); floatText(run.p.x, run.p.y, `LEVEL ${e.lvl}`, 'big', 1.8); burst({ x: run.p.x, y: 0.2, z: run.p.y, n: 60, color: 0xffd060, vel: 3, vy: 3, size: 0.16, life: 1, spread: 0.3 }); flash(0.15, 0xffe0a0); break;
            case 'tele': sfx.tele(); burst({ x: e.fx, y: 0.6, z: e.fy, n: 18, color: 0xb080ff, vel: 1.5, size: 0.2, life: 0.6 }); burst({ x: e.x, y: 0.6, z: e.y, n: 18, color: 0xb080ff, vel: 1.5, size: 0.2, life: 0.6 }); break;
            case 'light': { sfx.brazier(); const o = run.objs.find((x) => x.id === e.id); if (o) burst({ x: o.x, y: 1, z: o.y, n: 40, color: 0xff9030, vel: 2, vy: 2.5, size: 0.2, life: 0.9 }); break; }
            case 'skill': skillFx(run, e); break;
            case 'trap': sfx.trap(); shake(0.2); break;
            case 'trapFound': { const o = run.objs.find((x) => x.id === e.id); if (o) floatText(o.x, o.y, 'Trap!', 'info', 0.8); break; }
            case 'quest': sfx.quest(); if (e.state === 'done') { floatText(run.p.x, run.p.y, 'Quest complete!', 'big', 2); burst({ x: run.p.x, y: 0.4, z: run.p.y, n: 40, color: 0x80d0ff, vel: 2.5, vy: 2, size: 0.14, life: 1 }); } break;
            case 'phase': sfx.phase(); shake(0.6); flash(0.25, 0xff8060); aberrate(0.01); break;
            case 'bossWake': sfx.roar(); shake(0.5); break;
            case 'bossDie': sfx.victory(); break;
            case 'stairs': burst({ x: e.x, y: 0.3, z: e.y, n: 60, color: WORLDS[run.lv.world].look.accent, vel: 2, vy: 3, size: 0.2, life: 1.2 }); break;
            case 'descend': sfx.stairs(); break;
            case 'alert': { const m = run.mons.find((o) => o.id === e.id); if (m && run._t.vis[m.y * W + m.x]) { floatText(m.x, m.y, '!', 'info', 1.9); sfx.alert(); } break; }
            case 'oil': case 'oilDrain': sfx.oil(); break;
            case 'use': if (e.b === 'heal' || e.b === 'heal2' || e.b === 'antidote' || e.b === 'haste' || e.b === 'might') sfx.potion(); break;
            case 'shrine': sfx.shrine(); break;
            case 'fountain': sfx.heal(); break;
            case 'burrow': shake(0.4); break;
            case 'emerge': shake(0.5); sfx.boom(false); break;
            case 'reveal': break;
            case 'dark': sfx.hush(); break;
        }
    }
    if (hurt > 0) {
        sfx.hurt();
        const f = hurt / pstats(run).hpMax;
        shake(Math.min(0.6, 0.12 + f * 1.5));
        flash(Math.min(0.16, 0.04 + f * 0.5), 0x801018);
        aberrate(Math.min(0.012, f * 0.04));
    }
}

function skillFx(run, e) {
    const ring = (r, col, n = 40) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; burst({ x: e.x + Math.cos(a) * r, y: 0.4, z: e.y + Math.sin(a) * r, n: 1, color: col, vel: 0.6, vy: 0.8, size: 0.28, life: 0.6, spread: 0.1 }); } };
    if (e.s === 'nova') { ring(1, 0x9ae0ff); ring(e.r || 2, 0xd0f4ff); sfx.frost(); flash(0.12, 0x9ae0ff); }
    else if (e.s === 'cleave') { ring(1, 0xffe0a0, 24); sfx.swing(); }
    else if (e.s === 'warcry') { ring(1.5, 0xffa040); ring(3, 0xff6020); shake(0.3); sfx.roar(); }
    else if (e.s === 'bulwark') { ring(0.7, 0x80c0ff, 30); sfx.magic(); }
    else if (e.s === 'bash') { burst({ x: e.x, y: 0.6, z: e.y, n: 20, color: 0xffe0a0, vel: 3, size: 0.15, life: 0.4 }); shake(0.25); }
    else if (e.s === 'mark') { ring(0.6, 0xff3060, 20); sfx.magic(); }
}

// ------------------------------------------------------------------ Frame

let fpsT = 0, fpsN = 0, slow = 0;
function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    // Adaptive quality: drop a tier after three slow seconds in a row.
    fpsT += dt; fpsN++;
    if (fpsT >= 1) {
        const fps = fpsN / fpsT;
        fpsT = 0; fpsN = 0;
        if (!DEBUG && S.quality === null && fps < 28) { if (++slow >= 3 && getQuality() < 2) { setQuality(getQuality() + 1); slow = 0; } } else slow = 0;
    }
    const run = G.mode === 'play' ? G.run : G.attract && G.attract.run;
    if (run) {
        if (G.mode === 'play') {
            if (G.queued && clock.elapsedTime - G.lastAct >= STEP) { const q = G.queued; G.queued = null; playerAct(q); }
            autoTick();
            if (G.deathTimer > 0) { G.deathTimer -= dt; if (G.deathTimer <= 0) { G.deathTimer = 0; if (run.mode === 'ironwick') { clearRun(); updateRecords((r) => { r.deaths++; }); } UI.showDeath(G, run); } }
            if (G.tipTimer > 0) { G.tipTimer -= dt; if (G.tipTimer <= 0) hideTip(); }
        } else if (G.attract) {
            G.attract.t += dt;
            if (G.attract.t > 0.32) {
                G.attract.t = 0;
                botStep(run);
                if (run.over || run.story.length || run.pending || run.dialog) { run.story = []; run.pending = null; run.dialog = null; run.perkQ = 0; }
                handleEvents(run, drainEvents(run), true);
                if (run.lv !== G.lastLevel) syncFloor(true, run);
            }
        }
        const hero = syncActors(run, dt, time, camera);
        const hp = hero ? hero.g.position : { x: run.p.x, z: run.p.y };
        follow(hp.x, hp.z);
        if (G.camAt && Math.hypot(G.camAt.x - run.p.x, G.camAt.y - run.p.y) > 4) snapCamera(hp.x, hp.z);
        G.camAt = { x: run.p.x, y: run.p.y };
        updateLevelView(run, dt, time, hp);
        updateFx(run, dt, time, hp, actorPos);
        updateMarkers(dt, time);
        // The lantern.
        const s = pstats(run);
        const oilK = run.p.oil <= 0 ? 0.35 : 1;
        const flick = 1 + Math.sin(time * 13) * 0.04 + Math.sin(time * 7.7) * 0.05 + (Math.random() - 0.5) * 0.03;
        lantern.position.set(hp.x + 0.1, 2.1, hp.z + 0.35);
        // Visual falloff matches the gameplay light radius: still ~1 at the edge of sight.
        lantern.decay = 1;
        lantern.intensity = (2.2 + s.light * 1.05) * oilK * flick;
        lantern.distance = s.light * 1.5 + 3;
        if (run.p.oil <= 0) lantern.color.setRGB(1, 0.35, 0.2); else lantern.color.set(WORLDS[run.lv.world].look.light);
        if (G.mode === 'play') {
            const hpf = run.p.hp / s.hpMax;
            setDanger(hpf < 0.3 ? (0.3 - hpf) / 0.3 : 0);
            setDark(run.flags.dark ? 0.55 : run.p.oil <= 0 ? 0.35 : 0);
            const boss = run.mons.some((m) => m.boss && m.awake && alive(m));
            setIntensity(boss ? 2 : visibleHostiles(run).some((m) => m.awake) ? 1 : 0);
            updateHud(run, G);
            if (fpsN % 6 === 0) drawMap($('minimap'), run);
        } else { setDanger(0); setDark(0); setIntensity(0); }
    }
    renderFrame(dt, time);
}

// ------------------------------------------------------------------ Debug

function exposeDebug() {
    window.__ld = {
        G, get run() { return G.run; }, get attract() { return G.attract && G.attract.run; },
        god(on = true) { G.run.flags.god = on; },
        killAll() { for (const m of G.run.mons) if (!m.ally && !m.boss) { m.hp = 0; m.dead = true; } G.run.mons = G.run.mons.filter((m) => !m.dead); },
        damageBoss(f = 0.5) { const b = G.run.mons.find((m) => m.boss); if (b) b.hp = Math.max(1, Math.round(b.hpMax * f)); },
        toFloor(n) { G.camAt = null; const w0 = (Math.floor((n - 1) / 10)) * 10 + 1; if (!G.run.checkpoint || G.run.checkpoint.floor !== w0) G.run.checkpoint = { floor: w0, p: JSON.parse(JSON.stringify(G.run.p)), nextId: G.run.nextId }; G.run.story = []; G.run.pending = null; G.run.dialog = null; G.run.perkQ = 0; enterFloor(G.run, n); G.run.story = []; drainEvents(G.run); G.lastLevel = null; syncFloor(false); UI.hideAll(); },
        reveal() { G.run.lv.seen.fill(1); },
        snap() { G.camAt = null; snapCamera(G.run.p.x, G.run.p.y); },
        quality(q) { setQuality(q); }, brightness, setZoom,
        act: (a) => playerAct(a), step() { botStep(G.run); afterAct(); },
        start(cls = 'warden', mode = 'lantern', seed = 1234) { stopAttract(); clearRun(); G.run = newRun({ seed, cls, mode }); beginPlay(); },
        ui: UI, tile: (x, y) => toScreen(x, y, 0),
        spawnNear(sp = 'rat', d = 3) {
            const r = G.run;
            for (let k = 0; k < 60; k++) {
                const x = r.p.x + Math.round((Math.random() - 0.5) * 2 * d), y = r.p.y + Math.round((Math.random() - 0.5) * 2 * d);
                if (cheb(x, y, r.p.x, r.p.y) < 2 || !r._t.vis[y * r.lv.w + x] || !canEnter(r, { id: -1 }, x, y)) continue;
                if (!lineOfFire(r.lv, r.p.x, r.p.y, x, y)) continue;   // tests aim at it
                const m = makeMonster(r, sp, x, y, r.floor, makeRng(k + 1));
                if (r.lv.tiles[y * r.lv.w + x] !== T.FLOOR) continue;
                m.awake = true; r.mons.push(m); updateFov(r); return m.id;
            }
            return null;
        },
        killBoss() { const r = G.run; const b = r.mons.find((m) => m.boss); if (b) { b.ai.invuln = false; simDamage(r, b, 1e7, { src: r.p }); afterAct(); } },
        hurt(n) { const r = G.run; r.flags.god = false; simDamage(r, r.p, n, { src: 'a test' }); afterAct(); },
        xp(n) { gainXp(G.run, n); afterAct(); },
        clearBlockers() { const r = G.run; r.story = []; r.pending = null; r.dialog = null; r.perkQ = 0; UI.hideAll(); },
    };
}

boot();
