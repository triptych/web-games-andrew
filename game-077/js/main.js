// CUE VICE — boot, the frame loop, input and the mode machine:
//   title ⇄ menus → story → brief → play ⇄ pause → result → story → brief → …
//   play → fail → (replay | retry | quit);  episode 10 → ending → credits.
//
// ?debug=1 exposes window.__cv for tests; &fast=N runs N× simulation per frame.

import { World } from './sim/world.js';
import { LEVELS } from './sim/levels.js';
import { CREW, CREW_ORDER, UPGRADES, TEAM_UPGRADES } from './sim/data.js';
import { SCENES, RADIO, TIP_START, sceneBefore, sceneAfter } from './sim/story.js';
import { MOTION } from './config.js';
import { View } from './view/view.js';
import { FRAME } from './view/cinema.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(40, +(params.get('fast') || 1)));

const ui = new UI();
const view = new View(ui.canvas);
const data = store.load();

const G = {
    mode: 'boot', W: null, ep: 1, squad: [], sel: null,
    aim: { on: false, kind: '', a: -Math.PI / 2, power: 0.5, pid: null },
    pointers: new Map(), pan: null, pinch: null,
    story: null, back: [], tips: {}, radioQ: [], radioT: 0, waitHeld: false, endT: 0, ended: false, used: false,
    keys: new Set(), pad: { prev: [] }, pred: null, predKey: '', chosen: [], briefEp: 1, menuReturn: 'title',
    seen: {},
};

// ================================================================== settings
function applySettings() {
    const s = data.settings;
    audio.setSound(s.sound); audio.setMusic(s.music); audio.setVolume(s.volume);
    view.shakeOn = s.shake;
    document.body.classList.toggle('noscan', !s.scanlines);
    view.r.grade.uniforms.uScan.value = s.scanlines ? 0.12 : 0;
    let tier = { high: 0, medium: 1, low: 2 }[s.quality];
    if (tier === undefined) tier = matchMedia('(pointer: coarse)').matches ? 1 : 0;
    view.r.setQuality(tier);
}

function relayout() {
    const w = innerWidth, h = innerHeight;
    view.resize(w, h);
}
addEventListener('resize', relayout);
if (window.visualViewport) visualViewport.addEventListener('resize', relayout);

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') pause(); });

// ================================================================== flow
function setMode(m) {
    G.mode = m;
    ui.setPlaying(m === 'play' || m === 'pause');
    if (m !== 'play') { G.aim.on = false; G.waitHeld = false; }
}

function cinema(bg = 'causeway', opts = {}) {
    view.setMode('cinema');
    view.cinema.setMood(bg);
    view.cinemaOpts = opts;
}

function toTitle() {
    view.unload();
    G.W = null;
    cinema('causeway');
    setMode('title');
    ui.title(data);
    ui.show('s-title');
    audio.play('title');
}

function openMenu(id, from) {
    G.back.push(from ?? (G.mode === 'pause' ? 'pause' : ui.current));
    setMode(G.mode === 'pause' ? 'pause' : 'menu');
    ui.show(id);
    audio.sfx('select');
}

function goBack() {
    const prev = G.back.pop();
    audio.sfx('back');
    if (prev === 'pause' && G.W) { ui.show('s-pause'); setMode('pause'); return; }
    if (prev && prev !== 's-title') { ui.show(prev); setMode(prev === 's-brief' ? 'brief' : 'menu'); return; }
    toTitle();
}

function roster(ep) { return store.rosterFor(ep); }
function maxRoster() { return roster(Math.min(LEVELS.length, Math.max(data.reached, 1))).concat(data.reached > 2 ? ['lola'] : []).concat(data.reached > 5 ? ['jinx'] : []).filter((v, i, a) => a.indexOf(v) === i); }

// ---------------------------------------------------------------- story
function playStory(keys, then) {
    keys = keys.filter((k) => SCENES[k]);
    if (!keys.length) { then(); return; }
    G.story = { keys, si: 0, li: 0, typed: 0, then };
    setMode('story');
    ui.show('s-story');
    cinema(SCENES[keys[0]].bg, { frame: FRAME.story });
    audio.play('story');
    for (const k of keys) data.seen[k] = true;
    store.save(data);
    showLine();
}

function showLine() {
    const st = G.story, sc = SCENES[st.keys[st.si]];
    view.cinema.setMood(sc.bg);
    ui.storyLine(sc, sc.lines[st.li], Math.floor(st.typed));
}

function advanceStory() {
    const st = G.story;
    if (!st) return;
    const sc = SCENES[st.keys[st.si]];
    const line = sc.lines[st.li];
    if (st.typed < line[1].length) { st.typed = line[1].length; showLine(); return; }
    st.li++; st.typed = 0;
    if (st.li >= sc.lines.length) {
        st.si++; st.li = 0;
        if (st.si >= st.keys.length) { endStory(); return; }
        view.vhs = 0.8;
    }
    audio.sfx('click');
    showLine();
}

function endStory() {
    const then = G.story?.then;
    G.story = null;
    then?.();
}

// ---------------------------------------------------------------- brief & squad
function brief(ep) {
    G.briefEp = ep;
    const def = LEVELS[ep - 1];
    const ros = roster(ep);
    const req = (def.need ?? []).filter((w) => ros.includes(w));
    const size = Math.min(def.squad, ros.length);
    let chosen = (data.last?.[def.id] ?? []).filter((w) => ros.includes(w));
    for (const r of req) if (!chosen.includes(r)) chosen.unshift(r);
    for (const w of ros) if (chosen.length < size && !chosen.includes(w)) chosen.push(w);
    chosen = chosen.slice(0, size);
    G.chosen = chosen;
    G.back = [];
    setMode('brief');
    cinema(def.time === 'storm' ? 'storm' : def.time === 'night' || def.time === 'dusk' ? 'night' : def.time === 'dawn' ? 'dawn' : 'sunset', { angle: 1.2, dist: 12, frame: FRAME.brief });
    const tips = {
        1: 'Rico works alone tonight. Hit them from behind; the bay takes care of the rest.',
        2: 'Bumpers on the dance floor kick hard. The office door opens from a switch behind the bar.',
        3: 'Eddie can’t walk: you have to knock him to the ambulance like an object ball.',
        4: 'Dex’s blasts wreck cars, crates and cracked walls. They also wake up the whole block.',
        5: 'Spring Jinx first: only she can crack the secure mainframe.',
        6: 'Tito smashes cracked walls. The red container’s door is cracked.',
        7: 'Nico can take a few hits. Wear him down, then pocket him in the pool.',
        8: 'One alarm and it’s over. Jinx, Dex or Tito can open the safe.',
        9: 'Traffic keeps moving while you roll. Time your shots between cars.',
        10: 'Everything you’ve learned. Sink the Shark.',
    };
    ui.brief(def, ros, chosen, req, size, tips[ep]);
    ui.show('s-brief');
    audio.play('story');
}

function toggleCrew(w) {
    const def = LEVELS[G.briefEp - 1];
    const ros = roster(G.briefEp);
    const req = (def.need ?? []).filter((x) => ros.includes(x));
    const size = Math.min(def.squad, ros.length);
    if (req.includes(w)) { ui.toast('Required for this episode'); audio.sfx('nope'); return; }
    const i = G.chosen.indexOf(w);
    if (i >= 0) G.chosen.splice(i, 1);
    else if (G.chosen.length < size) G.chosen.push(w);
    else { G.chosen.splice(G.chosen.findIndex((x) => !req.includes(x)), 1); G.chosen.push(w); }
    audio.sfx('click');
    ui.pick(ros, G.chosen, req, size);
}

// ---------------------------------------------------------------- play
function startEpisode(ep, squad) {
    const def = LEVELS[ep - 1];
    G.ep = ep;
    G.squad = squad;
    data.last = data.last ?? {};
    data.last[def.id] = squad;
    store.save(data);
    const crewUp = {};
    for (const w of CREW_ORDER) crewUp[w] = data.crewUp[w] ?? { hp: 0, charges: 0 };
    G.W = new World(def, { squad, crewUp, rewinds: data.teamUp.rewind, seed: 1986 + ep });
    G.tips = {}; G.radioQ = []; G.radioT = 1.2; G.ended = false; G.endT = 0; G.pred = null; G.predKey = '';
    view.load(G.W);
    view.vhs = 0.7;
    ui.hideScreens();
    ui.hudInit(G.W, ep);
    setMode('play');
    G.sel = G.W.shooters()[0]?.id ?? null;
    G.aim = { on: false, kind: '', a: -Math.PI / 2, power: 0.5, pid: null };
    audio.play(def.music);
    ui.banner(`EPISODE ${def.ep}<small>${def.title}</small>`, 2400);
    for (const t of def.tips ?? []) for (const k of TIP_START[t] ?? []) tip(k);
}

function restart() { startEpisode(G.ep, G.squad); }

function pause() {
    if (G.mode !== 'play') return;
    setMode('pause');
    ui.show('s-pause');
    audio.sfx('back');
}
function resume() { ui.hideScreens(); setMode('play'); G.back = []; }

function tip(key) {
    if (G.tips[key] || !RADIO[key]) return;
    G.tips[key] = true;
    G.radioQ.push(RADIO[key]);
}

function select(id) {
    const W = G.W;
    if (!W) return;
    const b = W.body(id);
    if (!W.canShoot(b)) { audio.sfx('nope'); return; }
    if (W.S.freeShot != null && W.S.freeShot !== id) { ui.toast('Free shot: Rico first'); audio.sfx('nope'); return; }
    if (G.sel !== id) audio.sfx('select');
    G.sel = id;
    G.aim.on = false;
}

function cycle(dir) {
    const W = G.W;
    if (!W || W.S.phase !== 'aim') return;
    const list = W.shooters();
    if (!list.length) return;
    const i = list.findIndex((b) => b.id === G.sel);
    select(list[(i + dir + list.length) % list.length].id);
}

function shoot() {
    const W = G.W, a = G.aim;
    if (!W || W.S.phase !== 'aim' || G.sel == null) return;
    if (a.power < 0.03) { a.on = false; return; }
    if (W.shoot(G.sel, a.a, a.power)) { G.used = false; audio.sfx('shoot'); }
    a.on = false;
}

function useAbility() {
    const W = G.W;
    if (!W || W.S.phase !== 'motion') return;
    if (W.ability()) G.used = true;
}

function doWait() {
    const W = G.W;
    if (!W || W.S.phase !== 'aim') return;
    W.wait(MOTION.waitStep);
}

function doRewind() {
    const W = G.W;
    if (!W || !W.canRewind()) { audio.sfx('nope'); return false; }
    if (W.S.phase === 'motion') return false;
    W.rewind();
    G.ended = false; G.endT = 0;
    G.sel = W.shooters()[0]?.id ?? null;
    return true;
}

function onWin() {
    const W = G.W, def = W.def, res = W.S.result;
    const prev = data.best[def.id];
    const newBest = !prev || res.score > prev.score;
    if (newBest) data.best[def.id] = { grade: store.betterGrade(res.grade, prev?.grade), score: res.score };
    else data.best[def.id] = { grade: store.betterGrade(res.grade, prev.grade), score: prev.score };
    const tp = data.tapes[def.id] ?? W.L.tapes.map(() => false);
    W.S.tapes.forEach((g, i) => { if (g) tp[i] = true; });
    data.tapes[def.id] = tp;
    data.rep += res.rep;
    data.reached = Math.max(data.reached, Math.min(LEVELS.length, def.ep + 1));
    if (def.ep === LEVELS.length) data.finished = true;
    store.save(data);
    setMode('result');
    ui.result(res, res.rep, newBest && !!prev);
    document.querySelector('#btn-next').textContent = def.ep === LEVELS.length ? 'The End' : 'Next Episode';
    ui.show('s-result');
    audio.play('story');
}

function next() {
    const ep = G.ep;
    view.unload(); G.W = null;
    if (ep >= LEVELS.length) {
        playStory(['ending'], () => { setMode('credits'); cinema('dawn'); ui.show('s-credits'); document.querySelector('#final-score').textContent = `Total score ${Object.values(data.best).reduce((a, b) => a + b.score, 0).toLocaleString()}`; audio.play('title'); });
        return;
    }
    playStory([...sceneAfter(ep), ...sceneBefore(ep + 1)], () => brief(ep + 1));
}

function onLose() {
    const why = G.W.S.result?.why;
    setMode('fail');
    document.querySelector('#fail-why').textContent = {
        down: 'The whole squad is down. Nobody left to take the shot.',
        vip: 'The witness didn’t make it. Without Eddie, the case is dead.',
        made: 'Somebody called it in. Internal Affairs has your badge, and Briggs walks.',
    }[why] ?? 'The job went sideways.';
    document.querySelector('#btn-fail-rewind').disabled = !G.W.canRewind();
    document.querySelector('#btn-fail-rewind').textContent = `Instant Replay (${G.W.S.rewinds})`;
    ui.show('s-fail');
}

// ---------------------------------------------------------------- garage
function buy(btn) {
    let cost;
    if (btn.dataset.team) {
        const k = btn.dataset.k, u = TEAM_UPGRADES[k], lv = data.teamUp[k] ?? 0;
        if (lv >= u.max) return;
        cost = u.cost[lv];
        if (data.rep < cost) return;
        data.rep -= cost; data.teamUp[k] = lv + 1;
    } else {
        const w = btn.dataset.who, k = btn.dataset.k, u = UPGRADES[k];
        const up = data.crewUp[w] ?? (data.crewUp[w] = { hp: 0, charges: 0 });
        if (up[k] >= u.max) return;
        cost = u.cost[up[k]];
        if (data.rep < cost) return;
        data.rep -= cost; up[k]++;
    }
    store.save(data);
    audio.sfx('tape');
    ui.garage(data, maxRoster());
}

// ================================================================== actions
ui.onAction = (act, el) => {
    audio.init();
    switch (act) {
        case 'continue': brief(Math.min(data.reached, LEVELS.length)); audio.sfx('select'); break;
        case 'new':
            if (data.reached > 1 && !confirm('Start again from Episode 1? Unlocked episodes, grades, Rep and upgrades are kept.')) return;
            audio.sfx('select');
            playStory(sceneBefore(1), () => brief(1));
            break;
        case 'episodes': ui.episodes(data); openMenu('s-episodes'); break;
        case 'pick-ep': {
            const ep = +el.dataset.ep;
            audio.sfx('select');
            if (!data.seen[`ep${ep}in`]) playStory(sceneBefore(ep), () => brief(ep));
            else brief(ep);
            break;
        }
        case 'garage': ui.garage(data, maxRoster()); openMenu('s-garage'); break;
        case 'garage-brief': ui.garage(data, roster(G.briefEp)); G.back.push('s-brief'); ui.show('s-garage'); setMode('menu'); break;
        case 'garage-result': ui.garage(data, maxRoster()); G.back.push('s-result'); ui.show('s-garage'); setMode('menu'); break;
        case 'dossier': ui.dossier(maxRoster()); openMenu('s-dossier'); break;
        case 'howto': ui.howtoCrew(maxRoster()); openMenu('s-howto'); break;
        case 'options': ui.options(data.settings); openMenu('s-options'); break;
        case 'back':
            if (ui.current === 's-garage' && G.back[G.back.length - 1] === 's-result') { G.back.pop(); ui.show('s-result'); setMode('result'); audio.sfx('back'); break; }
            if (ui.current === 's-brief') { toTitle(); break; }
            goBack();
            break;
        case 'opt': {
            const s = data.settings, k = el.dataset.opt;
            if (k === 'volume') s.volume = s.volume >= 1 ? 0.2 : Math.round((s.volume + 0.2) * 10) / 10;
            else if (k === 'quality') s.quality = { auto: 'high', high: 'medium', medium: 'low', low: 'auto' }[s.quality];
            else s[k] = !s[k];
            store.save(data); applySettings(); ui.options(s); audio.sfx('click');
            break;
        }
        case 'wipe':
            if (!confirm('Erase all progress, Rep and upgrades?')) return;
            store.wipe();
            Object.assign(data, store.defaults());
            applySettings(); ui.options(data.settings); ui.toast('Progress erased');
            break;
        case 'toggle-crew': toggleCrew(el.dataset.who); break;
        case 'go': audio.sfx('select'); startEpisode(G.briefEp, G.chosen.slice()); break;
        case 'buy': buy(el); break;
        case 'skip': endStory(); break;
        case 'resume': resume(); break;
        case 'restart': audio.sfx('select'); restart(); break;
        case 'quit': toTitle(); break;
        case 'next': audio.sfx('select'); next(); break;
        case 'title': toTitle(); break;
        case 'fail-rewind':
            G.W.S.phase = 'aim';   // undo the loss, then the replay restores the shot before it
            if (doRewind()) { ui.hideScreens(); setMode('play'); }
            break;
        case 'select': if (G.mode === 'play') select(el.id); break;
    }
};

// HUD buttons (pointerdown so they work mid-drag on touch)
const hudBtn = (id, fn) => document.getElementById(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audio.init(); fn(e); });
hudBtn('b-ability', () => useAbility());
hudBtn('b-wait', () => { doWait(); G.waitHeld = true; });
hudBtn('b-rewind', () => doRewind());
hudBtn('b-pause', () => pause());
hudBtn('b-zin', () => view.zoomBy(1 / 1.25));
hudBtn('b-zout', () => view.zoomBy(1.25));
addEventListener('pointerup', () => { G.waitHeld = false; });
addEventListener('pointercancel', () => { G.waitHeld = false; });
document.getElementById('s-story').addEventListener('pointerdown', (e) => { if (!e.target.closest('.skip')) advanceStory(); });

// ================================================================== pointer aiming
const canvas = ui.canvas;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function aimFromPointer(px, py) {
    const W = G.W, b = W.body(G.sel);
    if (!b) return;
    const s = view.screenOf(b.x, b.y, 0);
    const dx = px - s.x, dy = py - s.y;
    const len = Math.hypot(dx, dy);
    const full = Math.min(innerWidth, innerHeight) * 0.3;
    G.aim.power = Math.max(0, Math.min(1, (len - 10) / full));
    const g = view.groundAt(px, py);
    if (g && len > 4) G.aim.a = Math.atan2(b.y - g.y, b.x - g.x);
}

canvas.addEventListener('pointerdown', (e) => {
    audio.init();
    if (G.mode !== 'play') return;
    canvas.setPointerCapture?.(e.pointerId);
    G.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const W = G.W;
    if (G.pointers.size === 2) {
        const [a, b] = [...G.pointers.values()];
        G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        G.aim.on = false; G.pan = null;
        return;
    }
    if (e.button === 2) { G.aim.on = false; return; }
    if (W.S.phase === 'motion') { useAbility(); return; }
    if (W.S.phase !== 'aim') return;
    const g = view.groundAt(e.clientX, e.clientY);
    if (!g) return;
    const ppu = view.pxPerUnit(g.x, g.y);
    const slop = Math.max(0.3, 26 / ppu);
    let b = view.actors.pick(W, g.x, g.y, slop);
    if (b && !W.canShoot(b)) b = null;
    const selB = W.body(G.sel);
    if (b) select(b.id);
    if (b || (selB && W.canShoot(selB) && Math.hypot(selB.x - g.x, selB.y - g.y) < selB.r + Math.max(0.8, 48 / ppu))) {
        if (G.sel == null) return;
        G.aim = { on: true, kind: 'drag', a: G.aim.a, power: 0, pid: e.pointerId };
        return;
    }
    G.pan = { pid: e.pointerId, x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointermove', (e) => {
    if (!G.pointers.has(e.pointerId)) return;
    G.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (G.pinch && G.pointers.size >= 2) {
        const [a, b] = [...G.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (G.pinch.d > 0) view.zoomBy(G.pinch.d / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        G.pinch.d = d;
        return;
    }
    if (G.aim.on && G.aim.kind === 'drag' && G.aim.pid === e.pointerId) { aimFromPointer(e.clientX, e.clientY); return; }
    if (G.pan && G.pan.pid === e.pointerId) {
        view.panBy(e.clientX - G.pan.x, e.clientY - G.pan.y);
        G.pan.x = e.clientX; G.pan.y = e.clientY;
    }
});

function pointerEnd(e) {
    G.pointers.delete(e.pointerId);
    if (G.pointers.size < 2) G.pinch = null;
    if (G.aim.on && G.aim.kind === 'drag' && G.aim.pid === e.pointerId) {
        if (e.type === 'pointercancel') G.aim.on = false;
        else shoot();
    }
    if (G.pan?.pid === e.pointerId) G.pan = null;
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (G.mode === 'play' || G.mode === 'pause') view.zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
}, { passive: false });

// ================================================================== keyboard
addEventListener('keydown', (e) => {
    if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { G.keys.add(e.code); return; }
    G.keys.add(e.code);
    const k = e.key;
    if (G.mode === 'story') {
        if (k === 'Escape') endStory();
        else if (k === ' ' || k === 'Enter') { e.preventDefault(); advanceStory(); }
        return;
    }
    if (G.mode !== 'play') {
        if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'Tab') { e.preventDefault(); ui.navigate(1); }
        else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); ui.navigate(-1); }
        else if (k === 'Enter' || k === ' ') { if (ui.activate()) e.preventDefault(); else if (G.mode === 'title' && k === 'Enter') ui.onAction('continue'); }
        else if (k === 'Escape' || k === 'Backspace') {
            if (G.mode === 'pause') resume();
            else if (G.mode === 'menu' || G.mode === 'brief') ui.onAction('back');
        }
        return;
    }
    const W = G.W;
    switch (e.code) {
        case 'Escape': case 'KeyP':
            if (G.aim.on) { G.aim.on = false; break; }
            pause(); break;
        case 'Space': case 'Enter': case 'NumpadEnter':
            e.preventDefault();
            if (W.S.phase === 'motion') useAbility();
            else if (G.aim.on) shoot();
            else if (G.sel != null) { G.aim.on = true; G.aim.kind = 'kb'; G.aim.power = G.aim.power || 0.5; }
            break;
        case 'KeyF': useAbility(); break;
        case 'KeyT': doWait(); break;
        case 'KeyR': doRewind(); break;
        case 'KeyC': view.resetCamera(); break;
        case 'KeyX': G.aim.on = false; break;
        case 'Tab': e.preventDefault(); cycle(e.shiftKey ? -1 : 1); break;
        case 'KeyQ': cycle(-1); break;
        case 'KeyE': cycle(1); break;
        case 'Equal': case 'NumpadAdd': view.zoomBy(1 / 1.2); break;
        case 'Minus': case 'NumpadSubtract': view.zoomBy(1.2); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': {
            const b = W.crew[+e.code.slice(-1) - 1];
            if (b) select(b.id);
            break;
        }
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': case 'KeyA': case 'KeyD': case 'KeyW': case 'KeyS':
            e.preventDefault();
            if (W.S.phase === 'aim' && G.sel != null && !G.aim.on) { G.aim.on = true; G.aim.kind = 'kb'; G.aim.power = G.aim.power || 0.5; }
            break;
    }
});
addEventListener('keyup', (e) => G.keys.delete(e.code));
addEventListener('blur', () => G.keys.clear());

function keyAim(dt) {
    if (!G.aim.on || G.aim.kind !== 'kb') return;
    const K = G.keys, fine = K.has('ShiftLeft') || K.has('ShiftRight');
    const rot = (fine ? 0.25 : 1.5) * dt;
    if (K.has('ArrowLeft') || K.has('KeyA')) G.aim.a -= rot;
    if (K.has('ArrowRight') || K.has('KeyD')) G.aim.a += rot;
    if (K.has('ArrowUp') || K.has('KeyW')) G.aim.power = Math.min(1, G.aim.power + dt * (fine ? 0.15 : 0.6));
    if (K.has('ArrowDown') || K.has('KeyS')) G.aim.power = Math.max(0.03, G.aim.power - dt * (fine ? 0.15 : 0.6));
    if (K.has('KeyT') && G.W.S.phase === 'aim') doWait();
}

// ================================================================== gamepad
function pollPad(dt) {
    const pads = navigator.getGamepads?.() ?? [];
    const p = [...pads].find((x) => x && x.connected);
    if (!p) return;
    const btn = (i) => !!p.buttons[i]?.pressed;
    const val = (i) => p.buttons[i]?.value ?? 0;
    const prev = G.pad.prev;
    const down = (i) => btn(i) && !prev[i];
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    if (G.mode === 'story') { if (down(0)) advanceStory(); if (down(1) || down(9)) endStory(); }
    else if (G.mode !== 'play') {
        G.pad.navT = (G.pad.navT ?? 0) - dt;
        const v = btn(13) || ay > 0.5 ? 1 : btn(12) || ay < -0.5 ? -1 : btn(15) || ax > 0.5 ? 1 : btn(14) || ax < -0.5 ? -1 : 0;
        if (v && G.pad.navT <= 0) { ui.navigate(v); G.pad.navT = 0.22; }
        if (!v) G.pad.navT = 0;
        if (down(0)) ui.activate();
        if (down(1)) { if (G.mode === 'pause') resume(); else ui.onAction('back'); }
        if (down(9) && G.mode === 'pause') resume();
    } else {
        const W = G.W;
        const mag = Math.hypot(ax, ay);
        if (mag > 0.35 && W.S.phase === 'aim' && G.sel != null) { const A = view.screenAxes(); G.aim.on = true; G.aim.kind = 'kb'; G.aim.a = Math.atan2(A.ry * ax - A.uy * ay, A.rx * ax - A.ux * ay); }
        if (G.aim.on) {
            G.aim.power = Math.max(0.03, Math.min(1, G.aim.power + (val(7) - val(6)) * dt * 0.8));
        }
        if (down(0)) { if (W.S.phase === 'motion') useAbility(); else if (G.aim.on) shoot(); else if (G.sel != null) { G.aim.on = true; G.aim.kind = 'kb'; } }
        if (down(1)) G.aim.on = false;
        if (down(2)) doWait();
        if (btn(2) && W.S.phase === 'aim' && !down(2)) doWait();
        if (down(3)) doRewind();
        if (down(4)) cycle(-1);
        if (down(5)) cycle(1);
        if (down(9)) pause();
        if (down(12)) view.zoomBy(1 / 1.2);
        if (down(13)) view.zoomBy(1.2);
        const rx = p.axes[2] ?? 0, ry = p.axes[3] ?? 0;
        if (Math.hypot(rx, ry) > 0.25) view.panBy(-rx * dt * 600, -ry * dt * 600);
    }
    G.pad.prev = p.buttons.map((b) => b.pressed);
}

// ================================================================== events → sound, radio, music
function handleEvents() {
    const W = G.W;
    const evs = W.drain();
    let clack = 0, thud = 0;
    for (const e of evs) {
        view.on(e);
        switch (e.type) {
            case 'clack': clack = Math.max(clack, e.v); break;
            case 'wall': thud = Math.max(thud, e.v); break;
            case 'bumper': audio.sfx('bumper'); tip('bumper'); break;
            case 'break': audio.sfx(e.tile === 3 ? 'glass' : 'crash'); break;
            case 'pocket':
                audio.sfx(e.where === 'water' ? 'splash' : 'thud', 6);
                if (e.kind === 'crew') tip('splash'); else if (e.kind === 'foe') tip('sunk');
                break;
            case 'takedown': audio.sfx('ko'); tip(e.cop ? 'cops' : 'ko'); if (e.style >= 550) tip('bank'); break;
            case 'bossHit': audio.sfx('bossHit'); break;
            case 'alarm':
                audio.sfx('alarm');
                ui.banner('ALERT!', 1400, 'red');
                tip('alarm');
                if (!W.def.noAlarm) audio.play('alert');
                break;
            case 'evasion': ui.toast('EVASION — they’re searching'); break;
            case 'caution': audio.play(W.def.music); break;
            case 'sneak': audio.play(W.def.music); break;
            case 'suspicious': audio.sfx('suspicious'); tip('spotted'); break;
            case 'bodyFound': tip('body'); break;
            case 'pickup': audio.sfx(e.kind === 'intel' ? 'pickup' : 'tape'); break;
            case 'objective': audio.sfx('objective'); ui.toast(`✓ ${e.text}`); break;
            case 'allClear': tip('allClear'); ui.banner('JOB DONE<small>now get to the car</small>', 2000); break;
            case 'switch': case 'door': audio.sfx('door'); break;
            case 'hack': audio.sfx('hack'); break;
            case 'secure': tip('secure'); audio.sfx('nope'); break;
            case 'target': audio.sfx(e.kind === 'bug' ? 'hack' : e.kind === 'photo' ? 'select' : 'door'); break;
            case 'dart': audio.sfx('dart'); break;
            case 'ricochet': audio.sfx('ricochet'); break;
            case 'camBroken': audio.sfx('crash'); break;
            case 'camOff': audio.sfx('hack'); break;
            case 'gunshot': audio.sfx('gunshot'); break;
            case 'hurt': audio.sfx('hurt'); break;
            case 'downed': audio.sfx('downed'); tip('downed'); break;
            case 'heal': case 'revive': case 'pulse': audio.sfx('heal'); break;
            case 'boom': audio.sfx('boom'); break;
            case 'ghost': audio.sfx('ghost'); break;
            case 'anchor': audio.sfx('anchor'); break;
            case 'boombox': audio.sfx('boombox'); break;
            case 'rebank': audio.sfx('rebank'); tip('rebank'); break;
            case 'extract': audio.sfx('extract'); break;
            case 'exitLocked': tip('exitLocked'); audio.sfx('nope'); break;
            case 'join': audio.sfx('join'); tip(e.who === 'jinx' ? 'jinx' : 'join'); break;
            case 'laser': audio.sfx('laser'); break;
            case 'carHit': audio.sfx('crash'); audio.sfx('honk'); break;
            case 'noCharge': audio.sfx('nope'); ui.toast('Out of charges'); break;
            case 'rewind': audio.sfx('rewind'); view.vhs = 1.2; tip('rewind'); G.pred = null; G.predKey = ''; break;
            case 'turn':
                if (e.free != null) G.sel = e.free;
                else if (!W.canShoot(W.body(G.sel))) G.sel = W.shooters()[0]?.id ?? null;
                break;
            case 'won': G.ended = 'won'; G.endT = 2.2; audio.sfx('win'); ui.banner('CASE CLOSED', 2200); break;
            case 'lost': G.ended = 'lost'; G.endT = 1.6; audio.sfx('lose'); ui.banner('BUSTED', 1600, 'red'); break;
        }
    }
    if (clack > 0.8) audio.sfx('clack', clack);
    if (thud > 1.5) audio.sfx('thud', thud);
    if (W.def.recruit && !G.tips.recruit) {
        const r = W.S.bodies.find((b) => b.kind === 'recruit');
        if (r && W.crew.some((c) => Math.hypot(c.x - r.x, c.y - r.y) < 6)) tip('recruit');
    }
}

// ================================================================== frame
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.min(0.5, Math.max(0, (now - last) / 1000));   // wall clock, for UI timers
    const dt = Math.min(0.05, raw);
    last = now;
    pollPad(dt);
    if (G.mode === 'story' && G.story) {
        const st = G.story, line = SCENES[st.keys[st.si]].lines[st.li];
        if (st.typed < line[1].length) {
            const before = Math.floor(st.typed);
            st.typed = Math.min(line[1].length, st.typed + dt * 48);
            if (Math.floor(st.typed) !== before) { showLine(); if (before % 3 === 0) audio.sfx('type'); }
        }
    }
    let ctx = {};
    if ((G.mode === 'play' || G.mode === 'pause' || G.mode === 'fail') && G.W) {
        const W = G.W;
        if (G.mode === 'play') {
            keyAim(dt);
            if (G.waitHeld && W.S.phase === 'aim' && !G.ended) doWait();
            for (let k = 0; k < FAST; k++) W.update(dt);
            handleEvents();
            if (G.radioQ.length) {
                G.radioT -= raw;
                if (G.radioT <= 0) { const [sp, txt] = G.radioQ.shift(); ui.radio(sp, txt); audio.sfx('radio'); G.radioT = 5.5; }
            }
            if (G.ended) {
                G.endT -= raw;
                if (G.endT <= 0) { const how = G.ended; G.ended = false; if (how === 'won') onWin(); else onLose(); }
            }
        }
        const sel = W.body(G.sel);
        let aim = null;
        if (G.aim.on && sel && W.S.phase === 'aim') {
            const key = `${G.sel}|${G.aim.a.toFixed(3)}|${G.aim.power.toFixed(3)}`;
            if (key !== G.predKey) { G.predKey = key; G.pred = W.predict(G.sel, G.aim.a, Math.max(0.03, G.aim.power), 1 + (data.teamUp.guide ?? 0)); }
            aim = { x: sel.x, y: sel.y, a: G.aim.a, power: G.aim.power, r: sel.r, pred: G.pred };
        }
        const active = W.S.active != null ? W.body(W.S.active) : null;
        ctx = { aim, selected: G.sel, showPatrols: data.settings.patrols && W.S.phase === 'aim', follow: active && !active.gone ? active : null };
        if (G.mode === 'play') ui.hud(W, { selected: G.sel, aiming: G.aim.on, aimPower: G.aim.power, waiting: G.waitHeld, used: G.used });
    }
    view.frame(dt, ctx);
}

// ================================================================== boot
applySettings();
relayout();
const boot = () => { toTitle(); requestAnimationFrame(frame); };
(document.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(boot, 50)).catch(boot);

if (DEBUG) {
    window.__cv = {
        G, view, ui, data, audio, store, LEVELS,
        get W() { return G.W; },
        start(ep = 1, squad) {
            const def = LEVELS[ep - 1];
            const ros = CREW_ORDER.filter((w) => w !== def.recruit?.who);
            squad = squad ?? [...new Set([...(def.need ?? []), ...ros])].slice(0, def.squad);
            startEpisode(ep, squad);
        },
        brief, playStory, onWin, toTitle,
        shoot(id, a, p) { G.sel = id; G.aim = { on: true, kind: 'kb', a, power: p }; shoot(); },
        win() { G.W.win(); },
        lose(why = 'down') { G.W.lose(why); },
        settle(maxSec = 15) { const W = G.W; let t = 0; while (W.S.phase === 'motion' && t < maxSec) { W.step(1 / 120); t += 1 / 120; } handleEvents(); },
        unlockAll() { data.reached = LEVELS.length; store.save(data); },
    };
}
