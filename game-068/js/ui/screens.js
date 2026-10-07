/**
 * screens.js — every menu: the title, the story dialogue, the hub (county map and races, the garage's
 * upgrades, the paint shop, the career page), event cards, results, pause, settings, free race,
 * credits and toasts. The DOM lives in index.html; this module fills it and calls back into `app`
 * (main.js) for anything that changes the game.
 */

import { CIRCUITS, EVENTS, eventUnlocked, circuitUnlocked, circuitDone, cleared, nextEvent, upgradeCost, playerRating, buildField, DRIVERS } from '../sim/career.js';
import { CATS, CAT_INFO, MAX_LEVEL, PAINTS, LIVERIES, TRIMS, specFromLevels, paintById } from '../sim/parts.js';
import { TRACKS, ENVS, trackDef } from '../sim/tracks.js';
import { Track } from '../sim/track.js';
import { SCENES, CAST, fillName } from '../sim/story.js';
import { drawPortrait } from './portraits.js';
import { fmtTime, ordinal, escapeHtml as esc } from './hud.js';
import { cssHex } from '../view/textures.js';
import { KIND_NAMES } from '../view/carmodel.js';
import { ENV_LOOK } from '../view/envs.js';
import { sfx } from '../audio.js';

const $ = (id) => document.getElementById(id);
let app = null;
export function bindApp(a) { app = a; }

// ------------------------------------------------------------------ small helpers
export function show(id, on = true) { $(id).classList.toggle('hidden', !on); }
export function toast(html, ms = 2600) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = html;
    $('toasts').appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, ms);
}
function click(el, fn) { el.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); fn(e); }); }
const TYPE_NAME = { race: 'Race', elim: 'Elimination', tt: 'Time Trial', duel: 'Duel' };
const medalIcon = (m) => ({ gold: '🥇', silver: '🥈', bronze: '🥉' }[m] || '');
const placeIcon = (p) => (p === 1 ? '🏆' : p === 2 ? '🥈' : p === 3 ? '🥉' : '');

// ------------------------------------------------------------------ modal
export function modal(html, onBind) {
    const m = $('modal'), p = $('modal-panel');
    p.innerHTML = html;
    m.classList.remove('hidden');
    p.scrollTop = 0;
    if (onBind) onBind(p);
    return p;
}
export function closeModal() { $('modal').classList.add('hidden'); $('modal-panel').innerHTML = ''; }
export const modalOpen = () => !$('modal').classList.contains('hidden');

// ------------------------------------------------------------------ title
export function initTitle() {
    click($('t-new'), () => {
        if (app.profile && !app.profile.fresh) {
            modal(`<h2>Start over?</h2><p>This replaces your current career (${esc(app.profile.name)}, 🪙 ${app.profile.coins}, rating ${playerRating(app.profile)}).</p>
                <div class="actions"><button class="btn ghost" id="m-no">Keep it</button><button class="btn" id="m-yes">New career</button></div>`, (p) => {
                click(p.querySelector('#m-no'), closeModal);
                click(p.querySelector('#m-yes'), () => nameEntry());
            });
        } else nameEntry();
    });
    click($('t-continue'), () => app.continueCareer());
    click($('t-free'), () => freeRace());
    click($('t-settings'), () => settings());
    click($('t-credits'), () => credits());
}
export function refreshTitle() {
    const p = app.profile;
    show('t-continue', !!p);
    if (p) {
        const nx = nextEvent(p);
        $('t-cont-info').textContent = `${p.name} · 🪙 ${p.coins} · ${p.done ? '👑 Dirt Crown champion' : nx ? 'next: ' + nx.name : ''}`;
    }
}

function nameEntry() {
    modal(`<h2>New career</h2><p>Grandpa Gus's first racer is waiting under a tarp. Who's driving it?</p>
        <div class="field"><label for="m-name">Your name</label><input id="m-name" type="text" maxlength="12" value="${esc(app.profile?.name || 'Kit')}" autocomplete="off"></div>
        <div class="field"><label for="m-num">Car number</label><input id="m-num" type="number" min="1" max="99" value="27"></div>
        <div class="actions"><button class="btn ghost" id="m-back">Back</button><button class="btn go" id="m-go">Pull off the tarp</button></div>`, (p) => {
        const inp = p.querySelector('#m-name');
        setTimeout(() => { try { inp.focus(); inp.select(); } catch { /* */ } }, 50);
        click(p.querySelector('#m-back'), closeModal);
        const go = () => {
            const name = (inp.value || '').trim().replace(/[<>]/g, '').slice(0, 12) || 'Kit';
            const num = Math.max(1, Math.min(99, parseInt(p.querySelector('#m-num').value, 10) || 27));
            closeModal();
            app.newCareer(name, num);
        };
        click(p.querySelector('#m-go'), go);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
}

export function credits() {
    modal(`<div class="credits"><h2>Dirt Crown</h2><div class="checker"></div>
        <p>A backroads racing saga, game 068 of the <b>Web Games</b> collection by <b>Andrew Wooldridge</b>.</p>
        <p>Built with <b>three.js</b>. No asset files: every car, track, tree, cow, crowd, portrait, texture, tune and engine note is made in code.</p>
        <h3>The cast</h3>
        <p>${Object.entries(CAST).filter(([k]) => k !== 'you').map(([, c]) => `<b>${esc(c.name)}</b> · ${esc(c.role)}`).join('<br>')}</p>
        <h3>Seven circuits</h3>
        <p>${CIRCUITS.map((c) => `${c.icon} ${c.name}: ${c.cup}`).join('<br>')}</p>
        <div class="actions"><button class="btn" id="m-ok">Back</button></div></div>`, (p) => click(p.querySelector('#m-ok'), closeModal));
}

// ------------------------------------------------------------------ settings
export function settings(onClose) {
    const s = app.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    modal(`<h2>Settings</h2>
        <div class="field"><label>Master volume</label><input type="range" min="0" max="1" step="0.05" data-key="master" value="${s.master}"></div>
        <div class="field"><label>Music</label><input type="range" min="0" max="1" step="0.05" data-key="music" value="${s.music}"></div>
        <div class="field"><label>Sound effects</label><input type="range" min="0" max="1" step="0.05" data-key="sfx" value="${s.sfx}"></div>
        <div class="field"><label>Graphics</label>${seg('quality', [['auto', 'Auto'], [0, 'High'], [1, 'Medium'], [2, 'Low']])}</div>
        <div class="field"><label>Camera</label>${seg('camera', [[0, 'Close'], [1, 'Far'], [2, 'High']])}</div>
        <div class="field"><label>Auto-accelerate (touch)</label>${seg('autoGas', [[true, 'On'], [false, 'Off']])}</div>
        <div class="field"><label>Camera shake</label>${seg('shake', [[true, 'On'], [false, 'Off']])}</div>
        <h3>Controls</h3>
        <p>Drive: W A S D or the arrows · Drift: Space (hold it through bends to fill nitro) · Nitro: Shift or N · Reset to the track: R · Camera: C · Pause: Esc or P · Mute: M. A gamepad works too: triggers to drive, A to drift, X for nitro.</p>
        <div class="actions">${app.profile ? '<button class="btn dark" id="m-reset">Erase career</button>' : ''}<button class="btn" id="m-ok">Done</button></div>`, (p) => {
        p.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { s[r.dataset.key] = Number(r.value); app.applySettings(); }));
        p.querySelectorAll('.seg').forEach((g) => g.querySelectorAll('button').forEach((b) => click(b, () => {
            let v = b.dataset.v;
            if (v === 'true') v = true; else if (v === 'false') v = false; else if (v !== 'auto') v = Number(v);
            s[g.dataset.key] = v;
            g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
            app.applySettings();
        })));
        click(p.querySelector('#m-ok'), () => { closeModal(); onClose?.(); });
        const rb = p.querySelector('#m-reset');
        if (rb) click(rb, () => {
            modal('<h2>Erase career?</h2><p>All progress, coins and upgrades will be lost. This cannot be undone.</p><div class="actions"><button class="btn ghost" id="m-no">Cancel</button><button class="btn" id="m-yes">Erase</button></div>', (q) => {
                click(q.querySelector('#m-no'), () => settings(onClose));
                click(q.querySelector('#m-yes'), () => { closeModal(); app.eraseCareer(); });
            });
        });
    });
}

// ------------------------------------------------------------------ story dialogue
const story = { lines: null, i: 0, typed: 0, full: '', done: null, timer: 0, name: '', paint: '#f5c518' };
export function playScene(id, onDone) {
    const sc = SCENES[id];
    if (!sc) { onDone?.(); return; }
    story.lines = sc.lines; story.i = -1; story.done = onDone;
    story.name = app.profile?.name || 'Kit';
    story.paint = cssHex(paintById(app.profile?.paint).hex);
    $('story-title').textContent = sc.title;
    $('story-title').style.animation = 'none'; void $('story-title').offsetWidth; $('story-title').style.animation = '';
    show('story', true);
    nextLine();
}
export const storyActive = () => !!story.lines;
function nextLine() {
    if (!story.lines) return;
    // First press finishes the typing; the next moves on.
    if (story.i >= 0 && story.typed < story.full.length) { story.typed = story.full.length; $('dlg-text').textContent = story.full; return; }
    story.i++;
    if (story.i >= story.lines.length) return endScene();
    const [who, text, mood] = story.lines[story.i];
    const c = CAST[who] || CAST.rex;
    $('dlg-who').textContent = fillName(c.name, story.name);
    $('dlg-who').style.color = who === 'you' ? story.paint : c.color;
    $('dlg-role').textContent = c.role;
    drawPortrait($('dlg-portrait'), who, mood, story.paint);
    story.full = fillName(text, story.name);
    story.typed = 0;
    story.who = who;
    $('dlg-text').textContent = '';
}
function endScene() {
    const done = story.done;
    story.lines = null; story.done = null;
    show('story', false);
    done?.();
}
export function storyTick(dt) {
    if (!story.lines || story.i < 0) return;
    if (story.typed < story.full.length) {
        story.timer += dt;
        while (story.timer > 0.018 && story.typed < story.full.length) {
            story.timer -= 0.018;
            story.typed++;
            if (story.typed % 3 === 0 && story.full[story.typed - 1] !== ' ') sfx.voice(story.who);
        }
        $('dlg-text').textContent = story.full.slice(0, story.typed);
    }
}
export function storyAdvance() { if (story.lines) { sfx.tick(); nextLine(); } }
export function initStory() {
    $('story').addEventListener('click', (e) => { if (e.target.closest('#dlg-skip')) return; storyAdvance(); });
    click($('dlg-skip'), () => endScene());
}

// ------------------------------------------------------------------ hub
let tab = 'races', selCircuit = 0, paintPreview = null;
export function initHub() {
    document.querySelectorAll('#hub-tabs .tab').forEach((b) => click(b, () => openTab(b.dataset.tab)));
    click($('hub-menu'), () => hubMenu());
}
export function hubMenu() {
    modal(`<h2>Menu</h2><div class="actions" style="flex-direction:column">
        <button class="btn" id="m-res">Back to the garage</button>
        <button class="btn ghost" id="m-set">⚙️ Settings</button>
        <button class="btn ghost" id="m-cred">📜 Credits</button>
        <button class="btn dark" id="m-title">Title screen</button></div>`, (p) => {
        click(p.querySelector('#m-res'), closeModal);
        click(p.querySelector('#m-set'), () => settings());
        click(p.querySelector('#m-cred'), () => credits());
        click(p.querySelector('#m-title'), () => { closeModal(); app.toTitle(); });
    });
}
export function showHub(on, which) {
    show('hub', on);
    if (on) {
        if (which) tab = which;
        const nx = nextEvent(app.profile);
        if (nx && which === 'races') selCircuit = nx.ci;
        refreshHub();
    }
}
export function openTab(t) { tab = t; paintPreview = null; app.previewLook(null); refreshHub(); }
export function refreshHub() {
    const p = app.profile;
    $('hub-name').textContent = p.name;
    $('hub-car').textContent = carName(p);
    $('hub-coins').textContent = p.coins;
    $('hub-rating').textContent = playerRating(p);
    document.querySelectorAll('#hub-tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const panel = $('hub-panel');
    panel.classList.toggle('wide', tab === 'races');
    const keep = panel.scrollTop;
    if (tab === 'races') racesTab(panel);
    else if (tab === 'garage') garageTab(panel);
    else if (tab === 'paint') paintTab(panel);
    else careerTab(panel);
    panel.scrollTop = keep;
    // The big "next race" button.
    const nx = nextEvent(p);
    const nb = $('hub-next');
    nb.innerHTML = nx ? `<button class="btn big go" id="hub-go">▶ ${esc(nx.name)}<small>${esc(CIRCUITS[nx.ci].name)} · ${TYPE_NAME[nx.type]}${nx.boss ? ' · ⭐ ' + esc(DRIVERS[nx.boss].name) : ''}</small></button>` : p.done ? '<button class="btn big" id="hub-go">👑 Champion! Free race<small>Every track is open</small></button>' : '';
    const hg = $('hub-go');
    if (hg) click(hg, () => (nx ? eventCard(nx.id) : freeRace()));
}

export function carName(p) {
    const s = Object.values(p.levels).reduce((a, b) => a + b, 0);
    if (s === 0) return 'The Bucket';
    if (s < 6) return 'The Bucket, souped up';
    if (s < 12) return 'Bucket Mk II';
    if (s < 18) return 'The Dust Devil';
    if (s < 24) return 'The Thunder Bucket';
    if (s < 30) return 'The Crown Chaser';
    return 'The Golden Bucket';
}

// ---------------------------------------------------------------- races tab
function racesTab(panel) {
    const p = app.profile;
    panel.innerHTML = `<div class="map-wrap"><canvas id="map-cv" width="900" height="520"></canvas></div><div id="circ"></div>`;
    const cv = panel.querySelector('#map-cv');
    drawCountyMap(cv, p, selCircuit);
    cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        let best = -1, bd = 0.09;
        MAP_POS.forEach(([mx, my], k) => { const d = Math.hypot((mx - x) * 1.7, my - y); if (d < bd) { bd = d; best = k; } });
        if (best >= 0) { sfx.click(); selCircuit = best; drawCountyMap(cv, p, selCircuit); circuitList(panel.querySelector('#circ')); }
    });
    circuitList(panel.querySelector('#circ'));
}

function circuitList(el) {
    const p = app.profile, c = CIRCUITS[selCircuit];
    const open = circuitUnlocked(p, selCircuit);
    const nx = nextEvent(p);
    let h = `<div class="circuit-head"><span class="em">${c.icon}</span><div><h3>${esc(c.name)} · ${esc(c.cup)}</h3><p>${esc(c.blurb)}</p></div></div>`;
    if (!open) h += `<p style="margin-top:8px">🔒 Beat ${esc(DRIVERS[CIRCUITS[selCircuit - 1].champ].name)} in ${esc(CIRCUITS[selCircuit - 1].name)} to open this circuit.</p>`;
    c.events.forEach((e, k) => {
        const ev = EVENTS[e.id];
        const un = eventUnlocked(p, e.id);
        const res = p.results[e.id];
        const done = cleared(ev, res);
        const resTxt = res ? (ev.type === 'tt' ? (res.medal ? medalIcon(res.medal) + ' ' + fmtTime(res.time) : 'no medal') : `best ${res.pos}${ordinal(res.pos)} ${placeIcon(res.pos)}`) : un ? 'not raced' : '🔒';
        const tr = TRACKS[ev.track];
        h += `<button class="ev ${un ? '' : 'locked'} ${ev.boss ? 'boss' : ''} ${nx && nx.id === e.id ? 'next' : ''}" data-ev="${e.id}">
            <span class="n">${done ? '✓' : k + 1}</span>
            <span class="t">${esc(ev.name)}</span>
            <span class="r"><b>🪙 ${ev.pay}</b>${resTxt}</span>
            <span class="s"><span class="badge ${ev.final ? 'final' : ev.boss ? 'boss' : ev.type}">${ev.final ? 'FINAL' : ev.boss ? 'BOSS' : TYPE_NAME[ev.type]}</span>${esc(tr.name)}${ev.reverse ? ' (reversed)' : ''} · ${ev.laps} lap${ev.laps > 1 ? 's' : ''} · ⚡${ev.rating}</span>
        </button>`;
    });
    el.innerHTML = h;
    el.querySelectorAll('.ev').forEach((b) => click(b, () => {
        if (b.classList.contains('locked')) { sfx.deny(); toast('🔒 Finish the race before it first (a podium, a medal, or a win against a champion).'); return; }
        eventCard(b.dataset.ev);
    }));
}

const MAP_POS = [[0.12, 0.78], [0.2, 0.36], [0.38, 0.7], [0.53, 0.38], [0.66, 0.14], [0.74, 0.64], [0.86, 0.3]];
const MAP_COL = ['#c8b25a', '#3f6a33', '#c8693a', '#4a6a3a', '#e8f0f8', '#3a2a5a', '#2a2b30'];

function drawCountyMap(cv, p, sel) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    // Parchment.
    const bg = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#e8d4a8'); bg.addColorStop(1, '#b8945a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,60,30,${rnd() * 0.08})`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 6, 1 + rnd() * 3); }
    // A river.
    g.strokeStyle = 'rgba(70,120,150,0.55)'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(W * 0.42, 0); g.bezierCurveTo(W * 0.5, H * 0.3, W * 0.62, H * 0.45, W * 0.56, H * 0.62); g.bezierCurveTo(W * 0.5, H * 0.8, W * 0.62, H * 0.92, W * 0.6, H); g.stroke();
    // Region blobs.
    MAP_POS.forEach(([x, y], k) => {
        const un = circuitUnlocked(p, k);
        g.save();
        g.translate(x * W, y * H);
        g.fillStyle = MAP_COL[k];
        g.globalAlpha = un ? 0.85 : 0.35;
        g.beginPath();
        for (let a = 0; a <= 24; a++) {
            const t = (a / 24) * Math.PI * 2, r = 70 + Math.sin(t * 3 + k) * 10 + Math.cos(t * 5 + k * 2) * 6;
            a ? g.lineTo(Math.cos(t) * r * 1.25, Math.sin(t) * r * 0.8) : g.moveTo(Math.cos(t) * r * 1.25, Math.sin(t) * r * 0.8);
        }
        g.closePath(); g.fill();
        g.globalAlpha = 1;
        g.restore();
    });
    // The road between them.
    g.setLineDash([14, 10]);
    g.strokeStyle = '#6a4424'; g.lineWidth = 6;
    g.beginPath();
    MAP_POS.forEach(([x, y], k) => (k ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
    g.stroke();
    g.setLineDash([]);
    // Markers.
    MAP_POS.forEach(([x, y], k) => {
        const c = CIRCUITS[k], un = circuitUnlocked(p, k), done = circuitDone(p, k);
        const X = x * W, Y = y * H;
        if (k === sel) {
            g.strokeStyle = '#ff8a1f'; g.lineWidth = 6;
            g.beginPath(); g.arc(X, Y, 50, 0, 7); g.stroke();
        }
        g.fillStyle = un ? '#f6ecd8' : '#8a7a62';
        g.strokeStyle = '#3a2410'; g.lineWidth = 4;
        g.beginPath(); g.arc(X, Y, 38, 0, 7); g.fill(); g.stroke();
        g.font = '40px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.globalAlpha = un ? 1 : 0.4;
        g.fillText(c.icon, X, Y + 2);
        g.globalAlpha = 1;
        if (!un) { g.font = '26px sans-serif'; g.fillText('🔒', X + 26, Y - 26); }
        if (done) { g.font = '28px sans-serif'; g.fillText('🏆', X + 28, Y - 26); }
        g.font = '900 20px Bungee, Impact, sans-serif';
        g.fillStyle = '#2a1a0c';
        g.fillText(c.name.toUpperCase(), X, Y + 58);
    });
    g.font = '900 22px Bungee, Impact, sans-serif';
    g.fillStyle = 'rgba(42,26,12,0.55)'; g.textAlign = 'left';
    g.fillText('DUSTWATER COUNTY', 18, 32);
}

// ---------------------------------------------------------------- garage tab
const STAT_ROWS = [
    ['Top speed', (s) => s.top * 3.6, 90, 175, (v) => `${Math.round(v)} km/h`],
    ['Acceleration', (s) => s.accel, 8, 19, (v) => v.toFixed(1)],
    ['Grip', (s) => s.turnGrip, 14, 24, (v) => v.toFixed(1)],
    ['Bumps', (s) => s.absorb * 100, 0, 66, (v) => `${Math.round(v)}%`],
    ['Weight', (s) => s.mass * 100, 95, 166, (v) => `${Math.round(v)}`],
    ['Nitro', (s) => s.nitroCap, 1.8, 4.6, (v) => `${v.toFixed(1)} s`],
];
function garageTab(panel) {
    const p = app.profile;
    const spec = specFromLevels(p.levels);
    let h = `<h2>🔧 Halloway's Garage</h2><p>June can bolt on anything you can pay for. Every part shows on the car.</p>`;
    h += '<div class="stats">';
    for (const [n, f, lo, hi, fmt] of STAT_ROWS) {
        const v = f(spec);
        h += `<span>${n}</span><span class="bar"><i style="width:${Math.max(3, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%"></i></span><span>${fmt(v)}</span>`;
    }
    h += '</div>';
    for (const c of CATS) {
        const info = CAT_INFO[c], lv = p.levels[c], cost = upgradeCost(p, c);
        const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
        const nextLook = lv < MAX_LEVEL ? info.look[lv + 1] : '';
        h += `<div class="upg"><span class="ic">${info.icon}</span>
            <span class="nm">${info.name}<small>${info.stat}</small></span>
            <button class="btn buy ${lv >= MAX_LEVEL ? 'off' : cost > p.coins ? 'off' : 'go'}" data-cat="${c}">${lv >= MAX_LEVEL ? 'MAXED' : `🪙 ${cost}`}</button>
            <span class="pips">${pips}</span>
            <span class="part">Now: <b>${esc(info.levels[lv])}</b>${lv < MAX_LEVEL ? ` → <b>${esc(info.levels[lv + 1])}</b>` : ''}${nextLook ? `<br><small>Adds: ${esc(nextLook)}</small>` : ''}</span></div>`;
    }
    panel.innerHTML = h;
    panel.querySelectorAll('.buy').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = b.dataset.cat;
        if (p.levels[c] >= MAX_LEVEL) return;
        if (upgradeCost(p, c) > p.coins) { sfx.deny(); toast(`Not enough coins. Win a few races first! (🪙 ${upgradeCost(p, c) - p.coins} short)`); return; }
        if (app.buyUpgrade(c)) {
            sfx.buy();
            toast(`${CAT_INFO[c].icon} <b>${esc(CAT_INFO[c].levels[p.levels[c]])}</b> fitted! Rating ⚡${playerRating(p)}`);
            refreshHub();
        }
    }));
}

// ---------------------------------------------------------------- paint tab
function paintTab(panel) {
    const p = app.profile;
    const cur = paintPreview || { paint: p.paint, livery: p.livery, trim: p.trim };
    const owned = (kind, id) => p.owned[kind].includes(id);
    let h = '<h2>🎨 Paint Shop</h2><p>Click a colour or a livery to try it on. Trim colours and your number are free.</p>';
    h += '<h3>Body colour</h3><div class="swatches">';
    for (const c of PAINTS) {
        const metal = c.metal ? `background:linear-gradient(135deg, ${cssHex(c.hex)}, #fff 45%, ${cssHex(c.hex)} 60%, #555);` : `background:${cssHex(c.hex)};`;
        h += `<button class="sw ${cur.paint === c.id ? 'on' : ''}" data-paint="${c.id}" title="${esc(c.name)}" style="${metal}">${owned('paint', c.id) ? '' : `<span class="price">🪙${c.cost}</span>`}</button>`;
    }
    h += '</div><h3>Livery</h3><div class="liv">';
    for (const l of LIVERIES) {
        if (l.unlock === 'final' && !p.done) continue;
        h += `<button class="${cur.livery === l.id ? 'on' : ''}" data-liv="${l.id}">${esc(l.name)}<small>${owned('livery', l.id) || !l.cost ? 'owned' : '🪙 ' + l.cost}</small></button>`;
    }
    h += '</div><h3>Trim</h3><div class="swatches">';
    for (const t of TRIMS) h += `<button class="sw ${cur.trim === t.id ? 'on' : ''}" data-trim="${t.id}" title="${esc(t.name)}" style="background:${cssHex(t.hex)}"></button>`;
    h += `</div><div class="field" style="margin-top:12px"><label for="m-numb">Car number</label><input id="m-numb" type="number" min="1" max="99" value="${p.num}"></div>`;
    const cost = (!owned('paint', cur.paint) ? PAINTS.find((x) => x.id === cur.paint).cost : 0) + (!owned('livery', cur.livery) ? LIVERIES.find((x) => x.id === cur.livery).cost : 0);
    const dirty = cur.paint !== p.paint || cur.livery !== p.livery || cur.trim !== p.trim;
    if (dirty) h += `<div class="actions" style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="pp-cancel" style="flex:1">Cancel</button><button class="btn ${cost > p.coins ? 'off' : 'go'}" id="pp-buy" style="flex:2">${cost ? `Buy for 🪙 ${cost}` : 'Apply'}</button></div>`;
    panel.innerHTML = h;
    const set = (k, v) => { paintPreview = { ...cur, [k]: v }; app.previewLook(paintPreview); sfx.paint(); paintTab(panel); };
    panel.querySelectorAll('[data-paint]').forEach((b) => b.addEventListener('click', () => set('paint', b.dataset.paint)));
    panel.querySelectorAll('[data-liv]').forEach((b) => b.addEventListener('click', () => set('livery', b.dataset.liv)));
    panel.querySelectorAll('[data-trim]').forEach((b) => b.addEventListener('click', () => set('trim', b.dataset.trim)));
    const nb = panel.querySelector('#m-numb');
    nb.addEventListener('change', () => { const n = Math.max(1, Math.min(99, parseInt(nb.value, 10) || p.num)); app.setNumber(n); nb.value = n; });
    const cb = panel.querySelector('#pp-cancel');
    if (cb) click(cb, () => { paintPreview = null; app.previewLook(null); paintTab(panel); });
    const bb = panel.querySelector('#pp-buy');
    if (bb) bb.addEventListener('click', () => {
        if (cost > p.coins) { sfx.deny(); toast(`Not enough coins (🪙 ${cost - p.coins} short).`); return; }
        app.buyLook(cur, cost);
        sfx.buy();
        toast('🎨 Fresh paint! June says it looks "almost professional".');
        paintPreview = null;
        refreshHub();
    });
}

// ---------------------------------------------------------------- career tab
function careerTab(panel) {
    const p = app.profile;
    let h = `<h2>🏆 ${esc(p.name)}'s career</h2>`;
    h += `<div class="career-stats"><div><b>${p.stats.races}</b><small>races</small></div><div><b>${p.stats.wins}</b><small>wins</small></div><div><b>${p.stats.coins}</b><small>coins earned</small></div>
        <div><b>${playerRating(p)}</b><small>rating</small></div><div><b>${Object.values(p.results).filter((r) => r.medal === 'gold').length}</b><small>gold medals</small></div><div><b>${p.done ? '👑' : CIRCUITS.filter((c, k) => circuitDone(p, k)).length + '/7'}</b><small>${p.done ? 'champion' : 'cups'}</small></div></div>`;
    h += '<h3>Trophy shelf</h3><div class="cups">';
    CIRCUITS.forEach((c, k) => { h += `<div class="cup ${circuitDone(p, k) ? 'won' : ''}"><span class="e">${c.icon}</span><b>${esc(c.cup)}</b>${circuitDone(p, k) ? 'won' : circuitUnlocked(p, k) ? 'in progress' : 'locked'}</div>`; });
    h += '</div><h3>Story so far</h3><div class="liv">';
    for (const [id, sc] of Object.entries(SCENES)) if (p.seen[id]) h += `<button data-scene="${id}">▶ ${esc(sc.title)}</button>`;
    h += '</div>';
    h += '<div class="actions" style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn ghost" id="c-free" style="flex:1">🏎️ Free race</button><button class="btn ghost" id="c-set" style="flex:1">⚙️ Settings</button></div>';
    panel.innerHTML = h;
    panel.querySelectorAll('[data-scene]').forEach((b) => click(b, () => app.replayScene(b.dataset.scene)));
    click(panel.querySelector('#c-free'), () => freeRace());
    click(panel.querySelector('#c-set'), () => settings());
}

// ------------------------------------------------------------------ event card
export function eventCard(id) {
    const ev = EVENTS[id];
    const p = app.profile;
    const tr = TRACKS[ev.track];
    const field = buildField(ev, p);
    const my = playerRating(p);
    const rc = my >= ev.rating ? 'rate-ok' : my >= ev.rating - 40 ? 'rate-near' : 'rate-low';
    const res = p.results[id];
    const look = ENV_LOOK[CIRCUITS[ev.ci].env];
    const rule = ev.type === 'tt' ? 'Beat the clock for a medal. Bronze or better to move on.'
        : ev.type === 'elim' ? 'Whoever is last when the leader finishes a lap is knocked out. Finish top three to move on.'
            : ev.boss ? `Beat ${DRIVERS[ev.boss].name} to win the ${CIRCUITS[ev.ci].cup}. Only first place counts.`
                : 'Finish in the top three to move on. First place pays the full purse.';
    modal(`<div class="evcard">
        <h2>${esc(ev.name)}</h2>
        <p><span class="badge ${ev.final ? 'final' : ev.boss ? 'boss' : ev.type}">${ev.final ? 'THE FINAL' : ev.boss ? 'CHAMPION' : TYPE_NAME[ev.type]}</span> ${esc(CIRCUITS[ev.ci].name)} · ${esc(look.time)}</p>
        <div class="checker"></div>
        <div class="row2">
            <canvas class="track-cv" width="260" height="260"></canvas>
            <div>
                <div class="facts">
                    <span>Track</span><b>${esc(tr.name)}${ev.reverse ? ' ↺' : ''}</b>
                    <span>Laps</span><b>${ev.laps}</b>
                    <span>Field</span><b class="${rc}">⚡${ev.rating}</b>
                    <span>You</span><b class="${rc}">⚡${my}</b>
                    <span>Purse</span><b>🪙 ${ev.pay}</b>
                    ${res ? `<span>Best</span><b>${ev.type === 'tt' ? (medalIcon(res.medal) || '–') + ' ' + fmtTime(res.time) : res.pos + ordinal(res.pos)}</b>` : ''}
                </div>
                <p style="margin-top:8px;font-size:13px">${esc(tr.blurb)}</p>
            </div>
        </div>
        <p style="margin-top:10px;font-size:14px">${esc(rule)}${my < ev.rating - 40 ? ' <b class="rate-low">Your car is behind the field: upgrades would help.</b>' : ''}</p>
        ${field.length > 1 ? `<h3>On the grid</h3><div class="grid">${field.slice(1).map((e) => `<div>${e.champ ? '⭐ ' : ''}<b>${esc(e.name)}</b> · ${KIND_NAMES[e.look.kind] || ''}</div>`).join('')}</div>` : ''}
        <div class="actions"><button class="btn ghost" id="m-back">Back</button><button class="btn go big" id="m-race">🏁 Race!</button></div>
    </div>`, (pnl) => {
        drawTrackPreview(pnl.querySelector('.track-cv'), ev.track, ev.reverse, look);
        click(pnl.querySelector('#m-back'), closeModal);
        click(pnl.querySelector('#m-race'), () => { closeModal(); app.startEvent(ev); });
    });
}

export function drawTrackPreview(cv, trackId, reverse, look) {
    const t = new Track(trackDef(trackId, reverse));
    const g = cv.getContext('2d'), W = cv.width;
    g.clearRect(0, 0, W, W);
    const b = t.bounds, pad = 22;
    const s = (W - pad * 2) / Math.max(b.x1 - b.x0, b.z1 - b.z0);
    const ox = (W - (b.x1 - b.x0) * s) / 2, oz = (W - (b.z1 - b.z0) * s) / 2;
    const P = (i) => [ox + (t.px[i] - b.x0) * s, oz + (t.pz[i] - b.z0) * s];
    g.fillStyle = cssHex(look.ground[0]); g.globalAlpha = 0.25; g.fillRect(0, 0, W, W); g.globalAlpha = 1;
    g.lineJoin = g.lineCap = 'round';
    const path = () => { g.beginPath(); for (let i = 0; i <= t.N; i++) { const [x, y] = P(i % t.N); i ? g.lineTo(x, y) : g.moveTo(x, y); } };
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 14; path(); g.stroke();
    g.strokeStyle = cssHex(look.road); g.lineWidth = 9; path(); g.stroke();
    // Features: jumps orange, patches by type.
    for (const p of t.patches) {
        g.strokeStyle = { mud: '#4a3420', water: '#4ab0ff', ice: '#c8f0ff', gravel: '#9a9488', sand: '#f0d6a4', plank: '#8a6038', oil: '#202024', snow: '#ffffff' }[p.type] || '#888';
        g.lineWidth = 9;
        g.beginPath();
        for (let j = 0; j <= p.n; j++) { const [x, y] = P((p.i0 + j) % t.N); j ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
    }
    for (const f of t.def.features || []) {
        const i = Math.round(f.u * t.N) % t.N;
        const [x, y] = P(i);
        g.font = '16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(f.type === 'whoops' ? '〰️' : '⛰️', x, y);
    }
    // Start and direction arrow.
    const [sx, sy] = P(t.startI), [ax, ay] = P((t.startI + 8) % t.N);
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2;
    g.beginPath(); g.arc(sx, sy, 7, 0, 7); g.fill(); g.stroke();
    const an = Math.atan2(ay - sy, ax - sx);
    g.fillStyle = '#5fd06a';
    g.beginPath(); g.moveTo(ax + Math.cos(an) * 10, ay + Math.sin(an) * 10); g.lineTo(ax + Math.cos(an + 2.5) * 9, ay + Math.sin(an + 2.5) * 9); g.lineTo(ax + Math.cos(an - 2.5) * 9, ay + Math.sin(an - 2.5) * 9); g.fill();
    g.fillStyle = '#f6ecd8'; g.font = '700 12px Rubik, sans-serif'; g.textAlign = 'right';
    g.fillText(`${Math.round(t.L)} m`, W - 8, W - 10);
}

// ------------------------------------------------------------------ free race
export function freeRace() {
    const p = app.profile;
    const avail = Object.keys(TRACKS).filter((id) => {
        if (!p) return TRACKS[id].env === 'flats';
        if (p.done) return true;
        const ci = CIRCUITS.findIndex((c) => c.env === TRACKS[id].env);
        return ci >= 0 && circuitUnlocked(p, ci);
    });
    let sel = avail[0], laps = 3, rev = false;
    const draw = () => modal(`<h2>🏎️ Free race</h2><p>Any track you've reached, against a field built like your car. No coins at stake: just for fun.</p>
        <div class="liv" style="margin-top:10px">${avail.map((id) => `<button data-t="${id}" class="${id === sel ? 'on' : ''}">${esc(TRACKS[id].name)}<small>${esc(ENVS[TRACKS[id].env].name)}</small></button>`).join('')}</div>
        <div class="field"><label>Laps</label><div class="seg" id="fr-l">${[1, 2, 3, 4, 5].map((n) => `<button data-v="${n}" class="${n === laps ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Direction</label><div class="seg" id="fr-r"><button data-v="0" class="${!rev ? 'on' : ''}">Normal</button><button data-v="1" class="${rev ? 'on' : ''}">Reversed</button></div></div>
        <div class="actions"><button class="btn ghost" id="m-back">Back</button><button class="btn go" id="m-go">🏁 Race!</button></div>`, (pn) => {
        pn.querySelectorAll('[data-t]').forEach((b) => click(b, () => { sel = b.dataset.t; draw(); }));
        pn.querySelectorAll('#fr-l button').forEach((b) => click(b, () => { laps = Number(b.dataset.v); draw(); }));
        pn.querySelectorAll('#fr-r button').forEach((b) => click(b, () => { rev = b.dataset.v === '1'; draw(); }));
        click(pn.querySelector('#m-back'), closeModal);
        click(pn.querySelector('#m-go'), () => { closeModal(); app.freeRace(sel, laps, rev); });
    });
    draw();
}

// ------------------------------------------------------------------ results
export function showResults(r, ev, pay, colors, onCont, onRetry, onGarage) {
    const p = app.profile;
    const isTT = ev.type === 'tt';
    const won = isTT ? r.medal === 'gold' : r.pos === 1;
    const ok = cleared(ev, r);
    const head = isTT ? (r.medal ? medalIcon(r.medal) : '⏱️') : `${r.pos}<small style="font-size:0.4em">${ordinal(r.pos)}</small>`;
    const title = isTT ? (r.medal ? `${r.medal[0].toUpperCase() + r.medal.slice(1)} medal!` : 'No medal this time')
        : r.pos === 1 ? (ev.final ? 'CHAMPION OF THE DIRT CROWN!' : ev.boss ? `You beat ${DRIVERS[ev.boss].name}!` : 'Victory!')
            : ok ? 'On the podium!' : ev.type === 'elim' ? 'Knocked out!' : 'Better luck next time';
    let rows = '';
    if (isTT) {
        rows += `<tr class="me"><td>⏱️</td><td>${esc(p?.name || 'You')}</td><td>${fmtTime(r.time)}</td></tr>`;
        if (ev.targets) ['gold', 'silver', 'bronze'].forEach((m, k) => { rows += `<tr><td>${medalIcon(m)}</td><td>${m} time</td><td>${fmtTime(ev.targets[k])}</td></tr>`; });
    } else {
        r.order.forEach((row, k) => {
            const gap = k === 0 ? fmtTime(row.time) : row.out ? 'out' : `+${(row.time - r.order[0].time).toFixed(2)}${row.done ? '' : ' (est.)'}`;
            rows += `<tr class="${row.k === 0 ? 'me' : ''}"><td>${k + 1}</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cssHex(colors[row.k])};margin-right:6px"></span>${esc(row.name)}</td><td>${gap}</td></tr>`;
        });
    }
    const purse = pay ? `<div class="purse"><span>Purse (${isTT ? (r.medal || 'no medal') : r.pos + ordinal(r.pos)})</span><b>🪙 ${pay.purse}</b>${pay.bonus ? `<span>First ${isTT ? 'gold' : 'win'} bonus</span><b>🪙 ${pay.bonus}</b>` : ''}<span>Coins picked up</span><b>🪙 ${r.coins}</b><span class="total">Total</span><b class="total" id="res-total">🪙 0</b></div>` : '';
    $('results-panel').innerHTML = `<div class="res-head"><div class="big ${won || ok ? '' : 'lost'}">${head}</div><div><h2>${esc(title)}</h2><p>${esc(ev.name)} · best lap ${fmtTime(r.best)}</p></div></div>
        <div class="checker"></div>
        <table class="res-table">${rows}</table>${purse}
        ${!ok && ev.id !== 'free' ? `<p style="margin-top:10px;font-size:14px">${ev.boss ? 'Only a win counts against a champion.' : isTT ? 'Bronze or better unlocks the next race.' : 'A podium finish unlocks the next race.'} ${playerRating(p) < ev.rating ? 'Upgrading the car would help.' : 'Try drifting through the bends to fill your nitro.'}</p>` : ''}
        <div class="actions">
            <button class="btn ghost" id="r-retry">↻ Retry</button>
            ${ev.id !== 'free' ? '<button class="btn ghost" id="r-garage">🔧 Garage</button>' : ''}
            <button class="btn go" id="r-cont">Continue ▶</button>
        </div>`;
    show('results', true);
    click($('r-cont'), onCont);
    click($('r-retry'), onRetry);
    const gb = $('r-garage');
    if (gb) click(gb, onGarage);
    if (pay) {
        const total = pay.total + r.coins;
        let shown = 0;
        const el = $('res-total');
        const step = () => {
            if (!el.isConnected) return;
            shown = Math.min(total, shown + Math.max(1, Math.ceil(total / 40)));
            el.textContent = `🪙 ${shown}`;
            if (shown % 3 === 0) sfx.coin();
            if (shown < total) setTimeout(step, 30);
        };
        setTimeout(step, 500);
    }
}

// ------------------------------------------------------------------ pause
export function pauseMenu(onResume, onRestart, onQuit, free) {
    modal(`<h2>Paused</h2><div class="actions" style="flex-direction:column">
        <button class="btn go" id="p-res">▶ Resume</button>
        <button class="btn ghost" id="p-rst">↻ Restart race</button>
        <button class="btn ghost" id="p-set">⚙️ Settings</button>
        <button class="btn dark" id="p-quit">${free ? 'Quit' : 'Quit to garage'}</button></div>`, (p) => {
        click(p.querySelector('#p-res'), () => { closeModal(); onResume(); });
        click(p.querySelector('#p-rst'), () => { closeModal(); onRestart(); });
        click(p.querySelector('#p-set'), () => settings(() => pauseMenu(onResume, onRestart, onQuit, free)));
        click(p.querySelector('#p-quit'), () => { closeModal(); onQuit(); });
    });
}
