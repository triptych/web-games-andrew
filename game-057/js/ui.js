/**
 * ui.js — the DOM side: HUD, radio chatter with typewriter text, banners,
 * the minimap / motion tracker and full map, touch twin-sticks, and every
 * menu screen (title, difficulty, intro, sector cards, pause, field
 * upgrades, data logs, codex, settings, game over, ending).
 */

import { WEAPONS, PERKS, POWERUPS, ENEMIES, ENEMY_ORDER, BOSSES, DIFFICULTY, WEAPON_ORDER, PLAYER, ESCAPE_TIME, SHOP } from './config.js';
import { SPEAKERS, RADIO, LOGS, INTRO, ENDING, DEATH_LINES } from './story.js';
import { objective } from './sim/world.js';
import { drawPortrait, drawWeaponIcon, WEAPON_HEX } from './view/portraits.js';
import { S } from './audio.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const ui = { touchMode: false, settings: null };

// ------------------------------------------------------------------ Screens

export function show(id) { $(id).classList.remove('hidden'); }
export function hide(id) { $(id).classList.add('hidden'); }
export function isShown(id) { return !$(id).classList.contains('hidden'); }

export function fade(on) { $('fade').classList.toggle('on', on); }

let toastT = null;
export function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 1800);
}

export function banner(text, sub = '', color = '#7fe8ff', big = false) {
    const b = el('div', 'banner' + (big ? ' big' : ''), text + (sub ? `<small>${sub}</small>` : ''));
    b.style.color = color;
    $('banners').appendChild(b);
    while ($('banners').children.length > 3) $('banners').firstChild.remove();
    setTimeout(() => b.remove(), 2300);
}

// ------------------------------------------------------------------ Radio

const radio = { queue: [], cur: null, t: 0, shown: 0, hold: 0 };

export function radioPlay(key) {
    const lines = RADIO[key];
    if (!lines) return;
    for (const l of lines) radio.queue.push(l);
}
export function radioClear() { radio.queue.length = 0; radio.cur = null; hide('radio'); }

function updateRadio(dt, time) {
    if (!radio.cur && radio.queue.length) {
        radio.cur = radio.queue.shift();
        radio.shown = 0; radio.hold = 0;
        const sp = SPEAKERS[radio.cur[0]];
        $('radio-name').innerHTML = `${sp.name}<small>${sp.sub}</small>`;
        $('radio-name').style.color = sp.color;
        $('radio-text').textContent = '';
        show('radio');
        S.radio();
    }
    if (!radio.cur) return;
    const text = radio.cur[1];
    const talking = radio.shown < text.length;
    if (talking) {
        radio.shown = Math.min(text.length, radio.shown + dt * 42);
        $('radio-text').textContent = text.slice(0, Math.floor(radio.shown));
    } else {
        radio.hold += dt;
        if (radio.hold > 1.8 + text.length * 0.03) { radio.cur = null; if (!radio.queue.length) hide('radio'); }
    }
    drawPortrait($('portrait'), radio.cur ? radio.cur[0] : 'okoye', talking && (time * 9 % 2) < 1, time);
}

// ------------------------------------------------------------------ Minimap

const map = { w: null, explored: null, canvas: null, g: null, scale: 3, t: 0, ping: 0 };

export function setupMap(w) {
    const lv = w.lv;
    map.w = w;
    map.found = new Uint8Array(lv.w * lv.h);
    map.canvas = document.createElement('canvas');
    map.canvas.width = lv.w * map.scale;
    map.canvas.height = lv.h * map.scale;
    map.g = map.canvas.getContext('2d');
    for (const r of lv.rooms) if (r.visited) revealRoom(r);
    revealAround(w.player.x, w.player.y, 9);
}

function revealTile(x, y) {
    const lv = map.w.lv;
    const i = y * lv.w + x;
    if (map.found[i] || lv.tiles[i] !== 1) return;
    map.found[i] = 1;
    const corridor = lv.flags[i] & 1;
    map.g.fillStyle = corridor ? '#1c3640' : '#24505c';
    map.g.fillRect(x * map.scale, y * map.scale, map.scale, map.scale);
}

function revealRoom(r) {
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (x >= 0 && y >= 0 && x < map.w.lv.w && y < map.w.lv.h) revealTile(x, y);
}

function revealAround(px, py, R) {
    const lv = map.w.lv;
    for (let y = Math.max(0, Math.floor(py - R)); y < Math.min(lv.h, py + R); y++) {
        for (let x = Math.max(0, Math.floor(px - R)); x < Math.min(lv.w, px + R); x++) {
            if ((x - px) ** 2 + (y - py) ** 2 < R * R) revealTile(x, y);
        }
    }
}

const ICON_COL = { shopterm: '#ffd23a', med: '#ff5a5a', terminal: '#6aff8a', chest: '#ffaa3a', elevator: '#7fe8ff', cocoon: '#ffd27a', dropship: '#6affd8' };

function drawMapLayer(c, w, cx, cy, scale, W, H, full) {
    const lv = w.lv;
    c.fillStyle = '#010406';
    c.fillRect(0, 0, W, H);
    const ox = W / 2 - cx * scale, oy = H / 2 - cy * scale;
    c.imageSmoothingEnabled = false;
    c.drawImage(map.canvas, ox, oy, lv.w * scale, lv.h * scale);
    // Doors.
    for (const d of lv.doors) {
        const i = Math.floor(d.cy) * lv.w + Math.floor(d.cx);
        if (!map.found[i]) continue;
        c.fillStyle = d.target ? '#3aff6a' : '#ff2a1a';
        c.fillRect(ox + d.x * scale, oy + d.y * scale, d.w * scale, d.h * scale);
    }
    // Active room outline, boss room marker when known.
    for (const r of lv.rooms) {
        if (r.id === w.activeRoom) { c.strokeStyle = '#ff3a2a'; c.lineWidth = 2; c.strokeRect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale); }
        if (r.type === 'boss' && r.visited !== undefined && map.found[Math.floor(r.cy) * lv.w + Math.floor(r.cx)]) {
            c.fillStyle = '#ff2a6a'; c.font = `${Math.max(10, scale * 4)}px Orbitron, sans-serif`; c.textAlign = 'center';
            c.fillText('☠', ox + r.cx * scale, oy + r.cy * scale + scale * 1.5);
        }
    }
    // Items.
    for (const it of w.items) {
        if (it.used || it.kind === 'pad' || it.kind === 'shopitem') continue;
        const i = Math.floor(it.y) * lv.w + Math.floor(it.x);
        if (!map.found[i] && !full) continue;
        if (!map.found[i]) continue;
        c.fillStyle = ICON_COL[it.kind] ?? '#fff';
        const s = Math.max(4, scale * 1.6);
        c.fillRect(ox + it.x * scale - s / 2, oy + it.y * scale - s / 2, s, s);
    }
    // Ellie.
    if (w.ellie) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(ox + w.ellie.x * scale, oy + w.ellie.y * scale, Math.max(2.5, scale), 0, 7); c.fill(); }
    // Motion tracker: bugs within 22 m.
    const p = w.player;
    const pulse = 0.6 + 0.4 * Math.sin(map.ping * 6);
    c.fillStyle = `rgba(255,60,40,${pulse})`;
    for (const e of w.enemies) {
        if (e.dead || (!full && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > 22 * 22)) continue;
        if (e.type === 'stalker' && e.cloak <= 0 && !full) continue;
        const r = e.boss ? 5 : e.r > 0.6 ? 2.6 : 1.7;
        c.fillRect(ox + e.x * scale - r, oy + e.y * scale - r, r * 2, r * 2);
    }
    // Player arrow.
    const px = ox + p.x * scale, py = oy + p.y * scale;
    c.save();
    c.translate(px, py); c.rotate(p.face);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, 4.5); c.lineTo(-2, 0); c.lineTo(-5, -4.5); c.closePath(); c.fill();
    c.restore();
}

function updateMinimap(w, dt) {
    map.t -= dt;
    map.ping += dt;
    if (map.t > 0) return;
    map.t = 0.1;
    revealAround(w.player.x, w.player.y, 8.5);
    const cv = $('minimap');
    const c = cv.getContext('2d');
    drawMapLayer(c, w, w.player.x, w.player.y, 3, cv.width, cv.height, false);
    // Tracker sweep ring.
    const r = (map.ping * 50) % 90;
    c.strokeStyle = `rgba(127,232,255,${0.35 * (1 - r / 90)})`;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(cv.width / 2, cv.height / 2, r, 0, 7); c.stroke();
}

export function drawBigMap(w) {
    const cv = $('bigmap-c');
    const c = cv.getContext('2d');
    const lv = w.lv;
    const scale = Math.min(cv.width / lv.w, cv.height / lv.h);
    c.fillStyle = '#010406'; c.fillRect(0, 0, cv.width, cv.height);
    drawMapLayer(c, w, lv.w / 2, lv.h / 2, scale, cv.width, cv.height, true);
}

export function mapVisit(room) { if (map.w) revealRoom(map.w.lv.rooms[room]); }

// ------------------------------------------------------------------ HUD

const H = { wpn: null, mk: -1, slotsKey: '', lastHp: -1, hpLagT: 0, bossMax: 0, pw: '' };

export function hudReset() { H.wpn = null; H.mk = -1; H.slotsKey = ''; H.pw = ''; radioClear(); $('banners').innerHTML = ''; }

export function updateHud(w, dt, time) {
    const p = w.player;
    // Health & armour.
    const hpf = Math.max(0, p.hp / p.maxHp);
    $('hp-fill').style.width = (hpf * 100) + '%';
    $('hp-lag').style.width = (hpf * 100) + '%';
    $('hp-txt').textContent = Math.ceil(Math.max(0, p.hp));
    $('hp-box').classList.toggle('low', hpf < 0.3);
    $('ar-fill').style.width = (p.armor / PLAYER.armorMax * 100) + '%';
    $('ar-txt').textContent = Math.round(p.armor);
    // Power-ups.
    const active = Object.keys(p.pow).filter((k) => p.pow[k] > 0 && POWERUPS[k].dur > 0);
    const pkey = active.join(',');
    if (pkey !== H.pw) {
        H.pw = pkey;
        $('powers').innerHTML = active.map((k) => `<span class="pow" data-k="${k}" style="color:#${POWERUPS[k].color.toString(16).padStart(6, '0')}">${POWERUPS[k].name}<i></i></span>`).join('');
    }
    for (const node of $('powers').children) { const k = node.dataset.k; node.lastChild.style.width = (p.pow[k] / POWERUPS[k].dur * 100) + '%'; }
    // Weapon.
    const wp = p.weapons[p.cur];
    const def = WEAPONS[wp.id];
    if (H.wpn !== wp.id || H.mk !== wp.mk) {
        H.wpn = wp.id; H.mk = wp.mk;
        drawWeaponIcon($('wpn-icon'), wp.id);
        $('wpn-name').textContent = def.name.toUpperCase();
        $('wpn-name').style.color = WEAPON_HEX(wp.id);
        $('wpn-mk').textContent = 'MK ' + ['I', 'II', 'III'][wp.mk - 1] + (wp.mk >= 3 ? ' · ' + def.special : '');
    }
    const hyper = p.pow.hyperfire > 0;
    $('mag').textContent = hyper ? '∞' : wp.mag;
    $('mag').classList.toggle('low', !hyper && wp.mag <= Math.ceil(def.mag * 0.2));
    $('reserve').textContent = '/ ' + (wp.reserve === Infinity ? '∞' : wp.reserve);
    const rl = p.reloadT > 0 ? 1 - p.reloadT / p.reloadDur : def.charge ? Math.min(1, p.charge / def.charge) : 0;
    $('reload-fill').style.width = (rl * 100) + '%';
    $('reload-fill').style.background = p.reloadT > 0 ? '' : def.charge ? WEAPON_HEX(wp.id) : '';
    const skey = p.weapons.map((x) => x.id + x.mk).join(',') + ':' + p.cur;
    if (skey !== H.slotsKey) {
        H.slotsKey = skey;
        const slots = $('slots');
        slots.innerHTML = '';
        for (let i = 0; i < PLAYER.slots; i++) {
            const x = p.weapons[i];
            const s = el('div', 'slot' + (i === p.cur ? ' on' : '') + (x ? '' : ' empty'), x ? `${i + 1} ${WEAPONS[x.id].short}${x.mk > 1 ? `<span class="mk">${'+'.repeat(x.mk - 1)}</span>` : ''}` : '—');
            if (x) s.style.color = i === p.cur ? WEAPON_HEX(x.id) : '';
            s.dataset.slot = i;
            slots.appendChild(s);
        }
    }
    $('gren').lastChild.textContent = p.grenades;
    $('puls').lastChild.textContent = p.pulses;
    $('salvage-n').textContent = p.salvage;
    // Objective, timers, boss bar.
    const th = w.theme;
    $('sector-label').textContent = w.mode === 'horde' ? 'INFESTATION PROTOCOL' : w.mode === 'escape' ? 'ESCAPE — FORT KESSLER' : `SECTOR ${th.roman} — ${th.name.toUpperCase()}`;
    $('objective').textContent = objective(w);
    if (w.escape) {
        show('escape-timer');
        const t = Math.max(0, w.escape.t);
        $('escape-timer').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
        $('escape-timer').classList.toggle('urgent', t < 30);
    } else hide('escape-timer');
    const b = w.boss;
    if (b && !b.dead && b.state !== 'intro') {
        if ($('boss-bar').classList.contains('hidden')) {
            show('boss-bar');
            const def = BOSSES[b.type];
            $('boss-name').innerHTML = `${def.name}<small>${def.title}</small>`;
            const ticks = b.type === 'zero' || b.type === 'mother' ? [33, 66] : [50];
            $('boss-ticks').innerHTML = ticks.map((t) => `<i style="left:${t}%"></i>`).join('');
        }
        const f = Math.max(0, b.hp / b.maxHp) * 100;
        $('boss-fill').style.width = f + '%';
        $('boss-lag').style.width = f + '%';
    } else hide('boss-bar');
    // Prompt.
    updatePrompt(w);
    updateRadio(dt, time);
    updateMinimap(w, dt);
}

function updatePrompt(w) {
    const pr = w.prompt;
    const box = $('prompt');
    const useBtn = $('t-use');
    if (!pr) { box.classList.add('hidden'); useBtn.classList.add('hidden'); return; }
    const key = ui.touchMode ? '' : '<kbd>E</kbd>';
    let text = '';
    switch (pr.kind) {
    case 'chest': text = `${key}Open armory crate`; break;
    case 'shopitem':
        if (pr.item === 'weapon') text = `${key}Buy ${WEAPONS[pr.weapon].name}<span class="price ${pr.can ? '' : 'no'}">⬢ ${pr.price}</span>`;
        else text = `${key}Buy ${SHOP[pr.item].name} — ${SHOP[pr.item].desc}<span class="price ${pr.can ? '' : 'no'}">⬢ ${pr.price}</span>`;
        break;
    case 'med': text = `${key}Use med station (+60)`; break;
    case 'terminal': text = `${key}Read data log`; break;
    case 'elevator': text = `${key}Take the elevator down`; break;
    case 'cocoon': text = `${key}Cut Ellie free`; break;
    case 'swap': text = `${key}Swap ${pr.current ? WEAPONS[pr.current].name : 'weapon'} for ${WEAPONS[pr.weapon].name}`; break;
    default: text = `${key}Use`;
    }
    if (box.dataset.t !== text) { box.innerHTML = text; box.dataset.t = text; }
    box.classList.remove('hidden');
    if (ui.touchMode) useBtn.classList.remove('hidden');
}

// ------------------------------------------------------------------ Event reactions

export function onEvent(ev, w) {
    switch (ev.type) {
    case 'lock':
        if (ev.holdout) banner('BULKHEAD JAMMED', 'hold out while Overwatch overrides it', '#ff5a3a');
        else if (!ev.boss) banner('ROOM SEALED', 'clear the room to release the doors', '#ff4a3a');
        break;
    case 'wave':
        if (ev.swarm) banner('SWARM INCOMING', ev.wave > 0 ? `wave ${ev.wave + 1} of ${ev.of}` : '', '#ffa83a');
        else if (ev.wave > 0) banner(`WAVE ${ev.wave + 1} / ${ev.of}`, '', '#ffd23a');
        break;
    case 'clear': banner(ev.holdout ? 'BULKHEAD OPEN' : 'ROOM CLEAR', ev.holdout ? 'move!' : '', '#6aff8a'); break;
    case 'bossIntro': {
        const d = BOSSES[ev.kind];
        banner(d.name, d.title, '#ff6ab4', true);
        break;
    }
    case 'bossPhase': banner('IT\'S ENRAGED', '', '#ff4a8a'); break;
    case 'bossDead': banner('TARGET DOWN', '', '#6aff8a', true); break;
    case 'newWeapon': banner(WEAPONS[ev.weapon].name.toUpperCase(), 'new weapon', WEAPON_HEX(ev.weapon)); break;
    case 'upgrade': banner(`${WEAPONS[ev.weapon].short} MK ${['I', 'II', 'III'][ev.mk - 1]}`, ev.mk >= 3 ? WEAPONS[ev.weapon].special : '+30% damage, faster', '#6aff8a'); break;
    case 'power': banner(POWERUPS[ev.kind].name, POWERUPS[ev.kind].desc, '#' + POWERUPS[ev.kind].color.toString(16).padStart(6, '0')); break;
    case 'hordeWave': banner(`WAVE ${ev.wave}`, ev.swarm ? 'swarm' : '', ev.swarm ? '#ffa83a' : '#ffd23a', true); break;
    case 'hordeClear': banner('WAVE CLEARED', ev.wave % 5 === 0 ? 'armory crate dropped' : '', '#6aff8a'); break;
    case 'denied': toast('Not enough salvage'); break;
    case 'ambush': banner('MOTION DETECTED', '', '#ffa83a'); break;
    case 'radio': radioPlay(ev.key); break;
    case 'perk': banner(PERKS[ev.id].name.toUpperCase(), PERKS[ev.id].desc, '#7fe8ff'); break;
    case 'secondwind': banner('SECOND WIND', '', '#ff4a4a', true); break;
    case 'visit': mapVisit(ev.room); break;
    case 'pickup':
        if (ev.kind === 'mod') toast('Mod chip installed');
        else if (ev.kind === 'pulse') toast('+1 Shock Pulse');
        break;
    default: break;
    }
}

// ------------------------------------------------------------------ Crosshair

export function updateCrosshair(x, y, w) {
    const ch = $('crosshair');
    ch.style.transform = `translate(${x}px, ${y}px)`;
    const p = w?.player;
    let f = 0;
    if (p) {
        const def = WEAPONS[p.weapons[p.cur].id];
        if (p.reloadT > 0) f = 1 - p.reloadT / p.reloadDur;
        else if (def.charge) f = Math.min(1, p.charge / def.charge);
        else if (def.spinup) f = p.spin;
    }
    $('ch-reload').style.strokeDashoffset = String(107 * (1 - f));
}

// ------------------------------------------------------------------ Touch

export const touch = {
    move: { x: 0, y: 0 }, aim: { x: 0, y: 0, active: false, fire: false },
    actions: [], left: null, right: null,
};

export function initTouch() {
    const R = 52;
    const stick = (zone, which, knobEl) => {
        zone.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            e.preventDefault();
            if (touch[which]) return;
            zone.setPointerCapture(e.pointerId);
            touch[which] = { id: e.pointerId, x: e.clientX, y: e.clientY };
            knobEl.style.left = e.clientX + 'px'; knobEl.style.top = e.clientY + 'px';
            knobEl.classList.remove('hidden');
            knobEl.firstChild.style.transform = 'translate(0,0)';
            if (which === 'right') { touch.aim.active = true; }
        });
        zone.addEventListener('pointermove', (e) => {
            const s = touch[which];
            if (!s || s.id !== e.pointerId) return;
            let dx = e.clientX - s.x, dy = e.clientY - s.y;
            const d = Math.hypot(dx, dy);
            // Drag the base along if the thumb wanders far.
            if (d > R * 1.6) { s.x += dx * (1 - R * 1.6 / d); s.y += dy * (1 - R * 1.6 / d); knobEl.style.left = s.x + 'px'; knobEl.style.top = s.y + 'px'; dx = e.clientX - s.x; dy = e.clientY - s.y; }
            const m = Math.min(1, Math.hypot(dx, dy) / R);
            const a = Math.atan2(dy, dx);
            knobEl.firstChild.style.transform = `translate(${Math.cos(a) * m * R}px, ${Math.sin(a) * m * R}px)`;
            if (which === 'left') { touch.move.x = Math.cos(a) * (m < 0.12 ? 0 : m); touch.move.y = Math.sin(a) * (m < 0.12 ? 0 : m); }
            else if (m > 0.15) { touch.aim.x = Math.cos(a); touch.aim.y = Math.sin(a); touch.aim.fire = m > 0.4; touch.aim.mag = m; }
            else touch.aim.fire = false;
        });
        const end = (e) => {
            const s = touch[which];
            if (!s || s.id !== e.pointerId) return;
            touch[which] = null;
            knobEl.classList.add('hidden');
            if (which === 'left') { touch.move.x = 0; touch.move.y = 0; }
            else { touch.aim.active = false; touch.aim.fire = false; }
        };
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
    };
    stick($('zone-left'), 'left', $('stick-l'));
    stick($('zone-right'), 'right', $('stick-r'));
    const btn = (id, action) => {
        const b = $(id);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); touch.actions.push(action); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); });
    };
    btn('t-roll', 'roll'); btn('t-gren', 'grenade'); btn('t-pulse', 'pulse'); btn('t-use', 'interact'); btn('t-reload', 'reload');
}

export function touchButtons(w) {
    const p = w.player;
    $('t-gren').classList.toggle('off', p.grenades <= 0);
    $('t-pulse').classList.toggle('off', p.pulses <= 0);
    $('t-roll').classList.toggle('off', p.rollCd > 0);
}

// ------------------------------------------------------------------ Menus

export function buildDifficulty(onPick) {
    const list = $('diff-list');
    list.innerHTML = '';
    for (const k of ['recruit', 'marine', 'nightmare']) {
        const d = DIFFICULTY[k];
        const b = el('button', 'mbtn' + (k === 'marine' ? ' primary' : ''), `${d.name}<small>${d.desc}</small>`);
        b.addEventListener('click', () => { S.ui(); onPick(k); });
        list.appendChild(b);
    }
}

export function playIntro(onDone) {
    const box = $('intro-text');
    box.innerHTML = '';
    show('intro');
    let i = 0, done = false;
    const timers = [];
    const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); hide('intro'); onDone(); };
    const next = () => {
        if (i >= INTRO.length) { timers.push(setTimeout(finish, 2600)); return; }
        const p = el('p', i === 0 ? 'head' : i === INTRO.length - 1 ? 'final' : '', INTRO[i]);
        box.appendChild(p);
        while (box.children.length > 4) box.firstChild.remove();
        S.typing();
        i++;
        timers.push(setTimeout(next, i === 1 ? 1400 : 2600));
    };
    next();
    $('intro-skip').onclick = () => { S.ui(); finish(); };
    return finish;
}

export function sectorCard(card, roman, onDone, hold = 3.2) {
    const sc = $('sector-card');
    sc.querySelector('.sc-roman').textContent = roman;
    sc.querySelector('.sc-title').textContent = card.title;
    sc.querySelector('.sc-sub').textContent = card.sub;
    sc.querySelector('.sc-text').textContent = card.text;
    show('sector-card');
    let done = false;
    const finish = () => { if (done) return; done = true; hide('sector-card'); sc.onclick = null; window.removeEventListener('keydown', key); onDone(); };
    const key = (e) => { if (e.key !== 'F5') finish(); };
    setTimeout(() => { sc.onclick = finish; window.addEventListener('keydown', key); }, 500);
    setTimeout(finish, hold * 1000);
}

export function buildPerks(options, onPick) {
    const list = $('perk-list');
    list.innerHTML = '';
    options.forEach((id, i) => {
        const pk = PERKS[id];
        const b = el('button', 'perk-card', `<div class="glyph">${pk.glyph}</div><div class="name">${pk.name}</div><div class="desc">${pk.desc}</div><div class="key">${ui.touchMode ? 'tap' : `press ${i + 1}`}</div>`);
        b.addEventListener('click', () => onPick(id));
        list.appendChild(b);
    });
    show('perk');
}

let logTimer = null;
export function showLog(sector, idx) {
    const L = LOGS[sector]?.[idx];
    if (!L) return;
    $('log-title').textContent = '> ' + L.title.toUpperCase();
    $('log-author').textContent = L.author;
    const box = $('log-text');
    box.textContent = '';
    show('log');
    let n = 0;
    clearInterval(logTimer);
    logTimer = setInterval(() => {
        n += 2;
        box.textContent = L.text.slice(0, n);
        S.typing();
        if (n >= L.text.length) clearInterval(logTimer);
    }, 22);
}
export function closeLog() { clearInterval(logTimer); hide('log'); }

export function fillStats(id, run, w, extra = {}) {
    const s = { ...run.stats };
    if (w) for (const k of ['kills', 'shots', 'dmgTaken', 'grazes', 'salvage']) s[k] += w.stats[k];
    const t = s.time + (w ? w.t : 0);
    const rows = [
        ['Bugs killed', s.kills], ['Damage taken', Math.round(s.dmgTaken)],
        ['Shots fired', s.shots], ['Bullets dodged', s.grazes],
        ['Salvage found', s.salvage], ['Time', `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`],
        ...Object.entries(extra),
    ];
    $(id).innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
}

export function gameOver(run, w, onRetry, onQuit) {
    $('go-line').textContent = w.deathCause === 'detonation' ? 'Fort Kessler goes up with you inside it.' : DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    const extra = w.mode === 'horde' ? { 'Wave reached': w.horde.wave } : {};
    fillStats('go-stats', run, w, extra);
    $('go-retry').textContent = w.mode === 'horde' ? 'Try again' : w.mode === 'escape' ? 'Retry the escape' : 'Retry sector';
    $('go-retry').onclick = () => { S.ui(); onRetry(); };
    $('go-quit').onclick = () => { S.ui(); onQuit(); };
    show('gameover');
}

export function playEnding(run, onDone) {
    const box = $('ending-text');
    box.innerHTML = `<h2>${ENDING.title}</h2>`;
    hide('victory-stats'); hide('v-done');
    show('victory');
    ENDING.lines.forEach((line, i) => {
        const p = el('p', '', line);
        p.style.animationDelay = (1.2 + i * 2.4) + 's';
        box.appendChild(p);
    });
    setTimeout(() => {
        fillStats('victory-stats', run, null, { Difficulty: DIFFICULTY[run.difficulty].name, Deaths: run.stats.deaths });
        show('victory-stats'); show('v-done');
    }, 1200 + ENDING.lines.length * 2400);
    $('v-done').onclick = () => { S.ui(); hide('victory'); onDone(); };
}

export function pauseStats(run, w) {
    fillStats('pause-stats', run, w);
    const perks = Object.keys(w.player.perks);
    $('pause-perks').innerHTML = perks.map((k) => `<span class="perk-chip">${PERKS[k].glyph} ${PERKS[k].name}</span>`).join('');
}

// ------------------------------------------------------------------ Codex

export function buildCodex(meta, tab, thumb) {
    document.querySelectorAll('#codex .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const body = $('codex-body');
    body.innerHTML = '';
    if (tab === 'brood') {
        for (const type of ENEMY_ORDER) {
            const seen = meta.seen[type];
            const d = ENEMIES[type];
            const c = el('div', 'cx' + (seen ? '' : ' locked'));
            const img = seen ? thumb(type) : null;
            if (img) { const i = el('img'); i.src = img; i.alt = d.name; c.appendChild(i); } else c.appendChild(el('canvas'));
            c.appendChild(el('div', '', `<div class="n">${seen ? d.name : '???'}</div><div class="d">${seen ? d.desc : 'Not yet encountered.'}</div>`));
            body.appendChild(c);
        }
        for (const k in BOSSES) {
            const seen = meta.seen[k];
            const d = BOSSES[k];
            body.appendChild(el('div', 'cx' + (seen ? '' : ' locked'), `<canvas></canvas><div><div class="n">${seen ? d.name : '???'}</div><div class="d">${seen ? d.title : 'Not yet encountered.'}</div></div>`));
        }
    } else if (tab === 'logs') {
        let any = false;
        LOGS.forEach((list, s) => list.forEach((L, i) => {
            if (!meta.logs[`${s}-${i}`]) return;
            any = true;
            body.appendChild(el('div', 'cx log', `<div class="n">${L.title} — <span style="color:var(--dim)">${L.author}</span></div><div class="d">${L.text}</div>`));
        }));
        if (!any) body.appendChild(el('div', 'cx log', '<div class="d">No logs recovered yet. Look for terminals in archive rooms.</div>'));
    } else {
        for (const id of WEAPON_ORDER) {
            const d = WEAPONS[id];
            const c = el('div', 'cx');
            const cv = el('canvas'); cv.width = 132; cv.height = 44; cv.style.width = '96px'; cv.style.height = '32px'; cv.style.border = 'none'; cv.style.background = 'none';
            drawWeaponIcon(cv, id);
            c.appendChild(cv);
            c.appendChild(el('div', '', `<div class="n" style="color:${WEAPON_HEX(id)}">${d.name}</div><div class="d">Mk III: ${d.special}</div>`));
            body.appendChild(c);
        }
    }
}

export { ESCAPE_TIME };
