// HOLLOWDEEP — entry point. Boots the view, the UI and the audio, sends every player command to the simulation
// through act(), and hands the events that come back to the view, the HUD, the battle screen, the town and the sound.
//
// ?debug=1 exposes window.__hd for the dev/ harnesses (see dev/README.md).

import { VERSION } from './config.js';
import { newGame, act, tileAt, serialize, getFloor } from './sim/game.js';
import { open as isOpen, DX, DY } from './sim/dungeon.js';
import { makeBot, botCommand } from './sim/bot.js';
import { startBattle } from './sim/battle.js';
import { stratumOf, STRATA } from './sim/data/monsters.js';
import { itemDef } from './sim/data/items.js';
import { NPCS } from './sim/data/town.js';
import { DungeonView } from './view/dungeon3d.js';
import { Audio } from './audio.js';
import { Hud } from './ui/hud.js';
import { BattleUI } from './ui/battle.js';
import { TownUI } from './ui/town.js';
import { CampUI } from './ui/camp.js';
import { $, toast, porUrl, itemName } from './ui/common.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { VOICES, NARRATION, HERO_LINE } from './voices.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(20, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const view = new DungeonView($('view'));
view.setRetro(settings.retro === 'on');
fetch('art/sprites.json').then((r) => r.json()).then((j) => { view.spriteSizes = j.sprites; battle.sizes = j.sprites; }).catch(() => {});

const hud = new Hud();
let G = null;
let mode = 'title';            // title | game
const seen = {};
let bot = null;
const stack = [];              // open screens, top last

const send = (cmd) => {
    if (!G) return false;
    const ok = act(G, cmd);
    if (G.mode === 'battle' || cmd.t === 'cmd' || cmd.t === 'auto' || cmd.t === 'back' || cmd.t === 'flee') battle.refresh();
    flush(cmd);
    return ok;
};
const battle = new BattleUI({ audio, hud, send, sizes: {} });
const town = new TownUI({ audio, send, openCamp: () => openScreen('camp') });
const camp = new CampUI({ audio, send, onSystem: (what) => { if (what === 'quit') { save(); toTitle(); } else openScreen(what); } });

$('version').textContent = 'v' + VERSION;

// ------------------------------------------------------------------ subtitles
let dlgTimer = 0;
audio.onSubtitle = (id, text) => {
    const v = VOICES[id];
    if (!v) return;
    const npc = NPCS[id];
    const hero = G?.roster.find((c) => c.por === id);
    const name = id === 'narrator' ? '' : npc ? npc.name : hero ? hero.name : (STRATA.find((s) => s.boss === id) ? '' : id === 'reaper' ? 'The Lantern Reaper' : '');
    const bossName = STRATA.find((s) => s.boss === id) ? id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : '';
    $('dlg-name').textContent = name || bossName;
    $('dlg-line').textContent = text;
    const face = $('dlg-por');
    const url = npc || hero || ['fighter_a', 'fighter_b', 'knight_a', 'knight_b', 'thief_a', 'thief_b', 'mage_a', 'mage_b', 'priest_a', 'priest_b', 'ranger_a', 'ranger_b'].includes(id) ? porUrl(id) : bossName || id === 'reaper' ? `art/mon/${id}.webp` : null;
    face.style.cssText = url ? `background-image:url(${url})` : 'display:none';
    $('dialogue').hidden = false;
    clearTimeout(dlgTimer);
    dlgTimer = setTimeout(() => { $('dialogue').hidden = true; }, 1600 + text.length * 55);
};

// ------------------------------------------------------------------ screens
function openScreen(id) {
    if (stack[stack.length - 1] === id) return;
    $(id).hidden = false;
    if (stack.includes(id)) stack.splice(stack.indexOf(id), 1);
    stack.push(id);
    $(id).style.zIndex = 60 + stack.length;
    if (id === 'camp') camp.open(G);
    if (id === 'mapview' && G?.floor) hud.bigmap(G);
    if (id === 'settings') syncSettings();
    const first = $(id).querySelector('button:not([disabled]), select, input');
    if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
    audio.ui('ok');
}
function closeScreen(id) {
    $(id).hidden = true;
    const i = stack.indexOf(id);
    if (i >= 0) stack.splice(i, 1);
    if (id === 'camp') { if (G?.mode === 'town') town.render(G); }
}
function closeTop() { const t = stack[stack.length - 1]; if (t && t !== 'title') { closeScreen(t); audio.ui('back'); return true; } return false; }
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => closeScreen(b.closest('.screen').id));
// a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
let downIn = null;
window.addEventListener('pointerdown', (e) => { downIn = e.target.closest('.screen'); }, { capture: true });
for (const s of document.querySelectorAll('.screen')) {
    s.addEventListener('click', (e) => { if (e.detail && downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
}

// ------------------------------------------------------------------ settings
function syncSettings() {
    $('set-sfx').value = settings.sfx; $('set-music').value = settings.music; $('set-voice').value = settings.voice;
    $('set-retro').value = settings.retro; $('set-speed').value = String(settings.speed); $('set-touch').value = settings.touch;
}
for (const id of ['set-sfx', 'set-music', 'set-voice', 'set-retro', 'set-speed', 'set-touch']) {
    $(id).addEventListener('change', () => {
        Object.assign(settings, { sfx: +$('set-sfx').value, music: +$('set-music').value, voice: +$('set-voice').value, retro: $('set-retro').value, speed: +$('set-speed').value, touch: $('set-touch').value });
        saveSettings(settings);
        audio.setVolumes(settings.sfx, settings.music, settings.voice);
        view.setRetro(settings.retro === 'on');
        applySpeed();
        updateTouch();
    });
}
$('set-delete').addEventListener('click', () => { clearSave(); refreshTitle(); toast('Saved game deleted.'); });
function applySpeed() { battle.speed = settings.speed * FAST; view.speed = settings.speed * Math.min(FAST, 4); }
applySpeed();

// ------------------------------------------------------------------ title
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
stack.push('title');
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { audio.init(); if (mode === 'title') audio.play('title'); }, { capture: true });
$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g, false); else toast('That save could not be read.'); }
    else openScreen(a);
});

function startGame(g, fresh) {
    G = g;
    mode = 'game';
    closeScreen('title');
    document.activeElement?.blur?.();
    $('party').hidden = false;
    hud.key = null;
    hud.party(G);
    showMode();
    if (fresh) {
        // the opening narration, line by line
        audio.say('narrator', NARRATION.intro[0], { force: true });
        let i = 1;
        const next = () => { if (i < NARRATION.intro.length && G === g) { if (!audio.say('narrator', NARRATION.intro[i])) { setTimeout(next, 600); return; } i++; setTimeout(next, 600); } };
        setTimeout(next, 600);
    }
    save();
}

function toTitle() {
    for (const id of [...stack]) closeScreen(id);
    mode = 'title';
    G = null;
    $('town').hidden = true; $('hud').hidden = true; $('party').hidden = true; $('pad').hidden = true; $('battle').hidden = true;
    stack.push('title'); $('title').hidden = false;
    refreshTitle();
    audio.ambience(false);
    audio.play('title');
}

function musicFor(g) {
    if (g.mode === 'town') return 'town';
    const i = stratumOf(g.floor).idx;
    return i <= 2 ? 'dungeon-1' : i <= 5 ? 'dungeon-2' : 'dungeon-3';
}

/** Show the screens that belong to G.mode. */
let lastShown = null;
function showMode() {
    const m = G.mode;
    $('town').hidden = m !== 'town';
    $('hud').hidden = m === 'town';
    if (m === 'town') { if (lastShown !== 'town') town.place = 'square'; town.show(G, true); audio.play('town'); audio.ambience(false); }
    else {
        view.build(G);
        hud.dungeon(G);
        if (m === 'dungeon') audio.play(musicFor(G));
        audio.ambience(true);
    }
    lastShown = m;
    updateTouch();
}

// ------------------------------------------------------------------ events
const LINES = {
    chest: (e) => (e.gold ? `Found ${e.gold.toLocaleString()} gold.` : `Found ${itemName({ id: e.id, plus: e.plus || 0 })}.`),
    trap: (e) => ({ blade: 'A blade trap! Everyone is cut.', gas: 'Poison gas! The party is poisoned.', bolt: 'A lightning rune! Everyone is burned.' })[e.kind],
    disarm: (e) => `${G.roster.find((c) => c.id === e.cid)?.name} disarms a trap.`,
    fountain: () => 'The fountain\'s cold water restores you.',
    found: (e) => `Found ${itemDef(e.id)?.name}!`,
    rescued: (e) => `${e.name} is safe${e.cid ? ' — they\'ll join the guild.' : '.'}`,
    full: () => 'Your pack is full.',
    quest: (e) => `Quest taken: ${e.title}`,
    reward: (e) => `${e.title} complete! +${e.gold.toLocaleString()} gold${e.item ? ', ' + itemDef(e.item)?.name + (e.n > 1 ? ' ×' + e.n : '') : ''}.`,
    hire: (e) => `${G.roster.find((c) => c.id === e.cid)?.name} joins the guild.`,
    revived: (e) => `${G.roster.find((c) => c.id === e.cid)?.name} is raised by the Dawn.`,
    rest: (e) => (e.stable ? `You sleep in the stables. Day ${e.day}.` : `A new day dawns over Brindlemoor. Day ${e.day}.`),
    guardian: () => 'A guardian bars the way!',
    deny: (e) => e.why,
};

let reaperWarned = null;
function flush(cmd) {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    battle.onEvents(G, ev);
    let modeChanged = false;
    for (const e of ev) {
        const line = LINES[e.type]?.(e);
        if (line && (e.type !== 'deny' || (cmd && !['move', 'turn', 'stairs'].includes(cmd.t)))) toast(line, e.type === 'reward' || e.type === 'guardian');
        switch (e.type) {
            case 'step': audio.fx('step', { vol: 0.5 }); break;
            case 'bump': audio.fx('bump'); break;
            case 'turn': break;
            case 'chest': audio.fx('chest'); if (e.gold) setTimeout(() => audio.fx('coins'), 350); break;
            case 'trap': audio.fx('trap'); break;
            case 'fountain': audio.fx('fountain'); break;
            case 'found': audio.fx('levelup'); break;
            case 'buy': case 'sell': case 'reward': audio.fx('coins'); break;
            case 'rest': audio.fx('heal'); save(); break;
            case 'hire': { const c = G.roster.find((x) => x.id === e.cid); if (c) audio.say(c.por, HERO_LINE.join, { force: true }); break; }
            case 'revived': audio.fx('heal'); break;
            case 'levelup': if (G.mode !== 'battle') { const c = G.roster.find((x) => x.id === e.cid); toast(`${c?.name} reaches level ${e.lv}!${e.learned.length ? ' Learned ' + e.learned.join(', ') + '.' : ''}`); } break;
            case 'floor': audio.fx('stairs'); modeChanged = true; reaperWarned = null; break;
            case 'enter': audio.fx('warp'); audio.say('ansel', 0, { force: true }); modeChanged = true; break;
            case 'town': modeChanged = true; if (e.why === 'thread') audio.fx('warp'); break;
            case 'warp': setTimeout(() => { toast(`The warp stone to B${e.floor}F awakens.`, true); audio.fx('warp'); audio.say('narrator', NARRATION.warp); }, 2600); break;
            case 'rescue_party': setTimeout(() => audio.say('narrator', NARRATION.wipe, { force: true }), 1800); break;
            case 'reaper_move':
                if (reaperWarned !== G.floor) { reaperWarned = G.floor; audio.fx('bell'); toast('A lantern sways in the dark. Something is hunting you.'); }
                break;
            case 'deny': if (cmd?.t !== 'move' && cmd?.t !== 'turn') audio.ui('no'); break;
            default: break;
        }
    }
    if (modeChanged || ev.some((e) => e.type === 'battle_end')) {
        // a mode change waits for the battle screen to finish playing
        if (G.mode !== 'battle' && !battle.active) showMode();
        else if (G.mode === 'town') pendingMode = true;
    }
    if (G.mode === 'town') town.render(G);
    if (!$('camp').hidden) camp.render(G);
    if (G.mode !== 'battle') hud.party(G);
    if (G.mode === 'dungeon') hud.dungeon(G);
    if (ev.some((e) => e.type === 'floor' || e.type === 'town')) save();
}
let pendingMode = false;
battle.onEnd = () => {
    if (!G) return;
    if (G.mode === 'town' || pendingMode) { pendingMode = false; showMode(); return; }
    if (G.mode === 'dungeon') { audio.play(musicFor(G)); hud.dungeon(G); hud.party(G); }
};

function save() { if (G) saveGame(G); }

// ------------------------------------------------------------------ input
const MOVE_KEYS = { KeyW: ['move', 'f'], ArrowUp: ['move', 'f'], KeyS: ['move', 'b'], ArrowDown: ['move', 'b'], KeyQ: ['move', 'l'], KeyE: ['move', 'r'],
    KeyA: ['turn', -1], ArrowLeft: ['turn', -1], KeyD: ['turn', 1], ArrowRight: ['turn', 1] };
const held = new Set();
let lastDevice = 'keys';

window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && e.code !== 'Escape') return;
    lastDevice = 'keys';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (e.code === 'Space' && tag !== 'BUTTON')) e.preventDefault();
    if (e.code === 'Tab') e.preventDefault();
    if (!G || mode !== 'game') return;
    // screens first
    if (stack.length) {
        if (e.code === 'Escape' || e.code === 'Tab' || (e.code === 'KeyM' && stack[stack.length - 1] === 'mapview')) closeTop();
        else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') moveFocus(stack[stack.length - 1], e.code === 'ArrowDown' ? 1 : -1);
        return;
    }
    if (G.mode === 'battle') { if (battle.key(e.code)) e.preventDefault(); return; }
    if (e.code === 'Escape' || e.code === 'Tab') { openScreen('camp'); return; }
    if (G.mode === 'dungeon') {
        if (e.code === 'KeyM') { openScreen('mapview'); return; }
        if ((e.code === 'Enter' || e.code === 'Space') && tag !== 'BUTTON') { const t = tileAt(G, G.pos.x, G.pos.y); if (t === 'up' || t === 'down') send({ t: 'stairs' }); return; }
        const m = MOVE_KEYS[e.code];
        if (m) { held.add(e.code); if (!e.repeat) tryMove(m); }
    } else if (G.mode === 'town' && (e.code === 'ArrowDown' || e.code === 'ArrowUp')) moveFocus('town-body', e.code === 'ArrowDown' ? 1 : -1);
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

function moveFocus(id, dir) {
    const list = [...$(id).querySelectorAll('button:not([disabled]), select, input')].filter((b) => b.offsetParent !== null || getComputedStyle(b).position === 'fixed');
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
    audio.ui('move');
}

function tryMove([t, v]) {
    if (!G || G.mode !== 'dungeon' || view.busy || stack.length) return false;
    send(t === 'move' ? { t: 'move', dir: v } : { t: 'turn', d: v });
    return true;
}

// touch pad: acts on finger-down and repeats while held
let padTimer = null;
for (const b of document.querySelectorAll('#pad button')) {
    const cmd = b.dataset.move ? ['move', b.dataset.move] : ['turn', +b.dataset.turn];
    b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        tryMove(cmd);
        clearInterval(padTimer);
        padTimer = setInterval(() => tryMove(cmd), 230);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearInterval(padTimer));
}
$('btn-camp').addEventListener('click', () => { if (G?.mode === 'dungeon') openScreen('camp'); });
$('btn-map').addEventListener('click', () => { if (G?.mode === 'dungeon') openScreen('mapview'); });
hud.onPrompt = () => send({ t: 'stairs' });

window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || lastDevice === 'touch') return;
    lastDevice = 'touch';
    updateTouch();
}, { capture: true });
function updateTouch() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || lastDevice === 'touch'));
    $('pad').hidden = !(on && G && G.mode === 'dungeon' && mode === 'game');
}

// gamepad: d-pad walks, A confirms, B backs out, Start opens camp
const padPrev = {};
function pollPad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (!gp || !G) return;
    const b = (i) => !!gp.buttons[i]?.pressed;
    const edge = (i) => { const on = b(i); const was = padPrev[i]; padPrev[i] = on; return on && !was; };
    if (edge(9)) { if (stack.length) closeTop(); else openScreen('camp'); }
    if (edge(1)) { if (stack.length) closeTop(); else if (G.mode === 'battle') battle.key('Escape'); }
    if (edge(0)) {
        if (G.mode === 'dungeon' && !stack.length) { const t = tileAt(G, G.pos.x, G.pos.y); if (t === 'up' || t === 'down') send({ t: 'stairs' }); }
        else document.activeElement?.click?.();
    }
    const dirs = [[12, 'ArrowUp'], [13, 'ArrowDown'], [14, 'ArrowLeft'], [15, 'ArrowRight']];
    for (const [i, code] of dirs) {
        if (edge(i)) {
            if (G.mode === 'battle') battle.key(code);
            else if (stack.length || G.mode === 'town') moveFocus(stack[stack.length - 1] || 'town-body', code === 'ArrowDown' || code === 'ArrowRight' ? 1 : -1);
        }
        if (b(i) && G.mode === 'dungeon' && !stack.length) tryMove(MOVE_KEYS[code]);
    }
}

// ------------------------------------------------------------------ frame loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pollPad();
    if (G && mode === 'game') {
        // held keys keep walking once each step's animation ends
        if (G.mode === 'dungeon' && !view.busy) for (const k of held) { if (MOVE_KEYS[k] && tryMove(MOVE_KEYS[k])) break; }
        if (bot && !view.busy && !battle.busy && !stack.length) {
            for (let i = 0; i < FAST; i++) { const c = botCommand(G, bot); send(c); if (G.mode === 'battle' || view.busy) break; }
        }
        battle.frame(G, dt * 1000);
        if (G.mode !== 'town') view.frame(G, dt);
    }
}
requestAnimationFrame((t) => { last = t; frame(t); });

document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); save(); } });
window.addEventListener('pagehide', () => save());

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hd = {
        get G() { return G; },
        get mode() { return mode; },
        get stack() { return stack.slice(); },
        seen, view, battle, town, camp, audio, hud, send, serialize: () => serialize(G),
        start(seed = 1) { startGame(newGame(seed), false); return G; },
        /** Let the bot play n commands synchronously (battles included); events reach the UI as usual. */
        ff(n = 100, opts = {}) { const b = makeBot({ seed: 3, ...opts }); for (let i = 0; i < n; i++) send(botCommand(G, b)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ seed: 5 }) : null; },
        /** Battle playback finished and the menu (if any) is up. */
        get idle() { return !!G && G.events.length === 0 && !battle.busy && !view.busy; },
        save, hasSave, saveNow: () => saveGame(G),
        /** Start a fight here and now: 'random', 'boss' or 'reaper'. */
        fight(kind = 'random') { startBattle(G, kind); flush(); return G.battle.foes.map((f) => f.name); },
        /** Turn to look down the longest open corridor (for screenshots). */
        faceOpen() {
            const f = getFloor(G.seed, G.floor);
            let best = 0, bd = G.pos.d;
            for (let k = 0; k < 4; k++) { let n = 0; while (isOpen(f, G.pos.x + DX[k] * (n + 1), G.pos.y + DY[k] * (n + 1))) n++; if (n > best) { best = n; bd = k; } }
            G.pos.d = bd; view.pos.yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][bd];
            return best;
        },
    };
}
