/**
 * ui.js — the DOM: title, valley map, briefings, the HUD (chips, the gate button, the tray of
 * stations or volunteers, the selection card, the boss bar, hints), floating words over people,
 * toasts, results with letters, the journal and settings. It never touches three.js; main.js
 * passes it the world and a `act` object of callbacks.
 */

import { STATIONS, STATION_KEYS, AILMENTS, DEAD, BOSSES, TRADES, TRADE_KEYS, KINDS, VOL } from './sim/data.js';
import { LEVELS, ENDLESS, newStations } from './sim/levels.js';
import { THEMES } from './config.js';

const $ = (id) => document.getElementById(id);
export function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
}

let act = null;
const ui = { tab: 'stations', tool: null, card: null, words: [], toastN: 0, lastChip: {} };
export const uiState = ui;

export function initUI(actions) {
    act = actions;
    $('t-play').onclick = () => act.openValley();
    $('t-journal').onclick = () => act.openJournal();
    $('t-settings').onclick = () => act.openSettings();
    $('v-close').onclick = () => act.toTitle();
    $('b-close').onclick = () => act.openValley();
    $('b-start').onclick = () => act.startLevel();
    $('b-gate').onclick = () => act.gate();
    $('b-speed').onclick = () => act.speed();
    $('b-pause').onclick = () => act.pause();
    $('b-sound').onclick = () => act.toggleSound();
    $('b-menu').onclick = () => act.menu();
    for (const b of document.querySelectorAll('#tabs .tab')) b.onclick = () => { setTab(b.dataset.tab); act.sfx('tab'); };
    $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal') && ui.modalClose) ui.modalClose(); });
}

export function showScreen(name) {
    for (const id of ['title', 'valley', 'brief']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', name !== 'play');
    if (name !== 'play') { clearWords(); hideCard(); }
}

// ------------------------------------------------------------------ title & valley
export function renderTitle(progress) {
    const started = progress.stats.played > 0;
    $('t-play').textContent = started ? '▶ Continue the Road' : 'Begin the Road';
}

const ACT_NAMES = { 1: ['Act I', 'Maple Hollow'], 2: ['Act II', 'Frostford'], 3: ['Act III', 'Lantern City'] };
export function renderValley(progress) {
    const box = $('v-acts');
    box.innerHTML = '';
    const s = progress.stats;
    $('v-summary').textContent = s.played ? `${s.saved} brought home · ${Object.values(progress.roster).reduce((a, b) => a + b, 0)} volunteers · ${s.lost} remembered` : 'Twelve roads lead to the Haven.';
    for (const a of [1, 2, 3]) {
        const nodes = h('div', { class: 'nodes' });
        for (const L of LEVELS.filter((l) => l.act === a)) nodes.append(levelNode(L, progress));
        box.append(h('div', { class: 'act' }, h('h3', {}, ACT_NAMES[a][0], h('span', {}, ACT_NAMES[a][1])), nodes));
    }
    if (progress.finished) {
        const nodes = h('div', { class: 'nodes' }, levelNode(ENDLESS, progress));
        box.append(h('div', { class: 'act' }, h('h3', {}, 'Epilogue', h('span', {}, 'the road goes on')), nodes));
    }
}
function levelNode(L, progress) {
    const rec = progress.levels[L.n] || {};
    const locked = !L.endless && L.n > progress.unlocked;
    const next = !L.endless && L.n === progress.unlocked && !rec.stars;
    const cls = ['node', L.boss ? 'boss' : '', rec.stars ? 'done' : '', locked ? 'locked' : '', next ? 'next' : ''].join(' ');
    const stars = L.endless ? h('div', { class: 'st' }, progress.endlessBest ? `Best: ${progress.endlessBest} saved` : 'Endless') :
        h('div', { class: 'st' }, '★'.repeat(rec.stars || 0), h('i', {}, '★'.repeat(3 - (rec.stars || 0))));
    return h('button', { class: cls, 'data-level': L.n, onclick: () => { if (!locked) act.openBrief(L.n); else act.sfx('error'); } },
        h('span', { class: 'num' }, L.endless ? '∞' : L.boss ? '☠' : L.n),
        h('div', { class: 'nm' }, locked ? '???' : L.name),
        stars);
}

export function renderBrief(L, progress) {
    $('b-act').textContent = L.endless ? 'Open Road' : `${ACT_NAMES[L.act][0]} · ${THEMES[['', 'autumn', 'winter', 'city'][L.act]].name}${L.boss ? ' · Boss' : ''}`;
    $('b-name').textContent = L.name;
    $('b-text').textContent = L.brief;
    const box = $('b-new');
    box.innerHTML = '';
    const ns = newStations(L);
    if (ns.length) {
        box.append(h('div', { class: 'section-title' }, 'New aid stations'));
        box.append(h('div', { class: 'cards' }, ns.map((k) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, STATIONS[k].icon), h('div', {}, h('b', {}, STATIONS[k].name, h('span', { class: 'tag' }, 'new')), h('p', {}, STATIONS[k].blurb))))));
    }
    const prev = L.n > 1 && !L.endless ? LEVELS[L.n - 2] : null;
    const newAil = L.ailments.filter((a) => !prev || !prev.ailments.includes(a));
    if (newAil.length && !L.boss) {
        box.append(h('div', { class: 'section-title' }, 'On this road'));
        box.append(h('div', { class: 'cards' }, newAil.map((k) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, AILMENTS[k].icon), h('div', {}, h('b', {}, AILMENTS[k].name), h('p', {}, AILMENTS[k].blurb))))));
    }
    const newDead = L.dead.filter((d) => !prev || !prev.dead.includes(d));
    if (newDead.length && !L.endless) {
        box.append(h('div', { class: 'section-title' }, 'Behind them'));
        box.append(h('div', { class: 'cards' }, newDead.map((k) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, '🧟'), h('div', {}, h('b', {}, DEAD[k].name), h('p', {}, DEAD[k].blurb))))));
    }
    if (L.boss) {
        box.append(h('div', { class: 'section-title' }, `${BOSSES[L.boss].name} · ${L.slots} volunteers at a time`));
        box.append(rosterGrid(progress.roster, true));
    }
    const rec = progress.levels[L.n];
    $('b-start').textContent = rec && rec.stars ? '↻ Walk it again' : 'Set out';
}

function rosterGrid(roster, withNeighbours) {
    const keys = TRADE_KEYS.filter((k) => k !== 'neighbour' || withNeighbours);
    return h('div', { class: 'roster' }, keys.map((k) => {
        const n = k === 'neighbour' ? VOL.neighbours : roster[k] || 0;
        const bonus = k === 'neighbour' ? 0 : Math.round(Math.min(VOL.maxBonus, VOL.perExtra * Math.max(0, n - 1)) * 100);
        return h('div', {}, h('span', { class: 'ic' }, TRADES[k].icon), h('span', {}, `${TRADES[k].name} ×${n}`, h('small', {}, bonus ? `+${bonus}% from training` : TRADES[k].blurb.split('.')[0])));
    }));
}

// ------------------------------------------------------------------ the tray
export function setTab(tab) {
    ui.tab = tab;
    for (const b of document.querySelectorAll('#tabs .tab')) b.classList.toggle('on', b.dataset.tab === tab);
    act.selectTool(null);
    act.rebuildTray();
}

export function buildTray(world, newKeys = []) {
    const tray = $('tray');
    tray.innerHTML = '';
    $('tabs').classList.toggle('hidden', !world.boss);
    if (!world.boss) ui.tab = 'stations';
    if (ui.tab === 'vols') {
        TRADE_KEYS.forEach((k) => {
            const T = TRADES[k];
            tray.append(h('button', { class: 'slot', 'data-vol': k, title: `${T.name}: ${T.blurb}`, onclick: () => act.selectTool({ vol: k }) },
                h('span', { class: 'ic' }, T.icon), h('span', { class: 'nm' }, T.name), h('span', { class: 'cost', 'data-avail': k }, '×0')));
        });
    } else {
        world.open.forEach((k, i) => {
            const S = STATIONS[k];
            tray.append(h('button', { class: `slot${newKeys.includes(k) ? ' new' : ''}`, 'data-station': k, title: `${S.name} (${i + 1}): ${S.blurb}`, onclick: () => act.selectTool({ station: k }) },
                h('span', { class: 'key' }, i + 1), h('span', { class: 'ic' }, S.icon), h('span', { class: 'nm' }, S.name.replace(' Post', '').replace('Field ', '').replace('Warming ', '')), h('span', { class: 'cost' }, `📦${S.cost[0]}`)));
        });
    }
}

export function updateHUD(world, st) {
    setChip('c-hope', `${world.hope}`);
    setChip('c-supplies', `${world.supplies}`);
    setChip('c-wave', world.endless ? `${world.wave}` : `${world.wave}/${world.waveCount}`);
    setChip('c-saved', `${world.stats.saved + world.stats.restored}`);
    $('c-vols').classList.toggle('hidden', !world.boss);
    if (world.boss) setChip('c-vols', `${world.activeVols()}/${world.slots}`);
    // tray
    for (const el of document.querySelectorAll('#tray .slot')) {
        const k = el.dataset.station, v = el.dataset.vol;
        if (k) {
            el.classList.toggle('poor', world.supplies < STATIONS[k].cost[0]);
            el.classList.toggle('sel', ui.tool?.station === k);
        } else if (v) {
            const n = world.available(v);
            const c = el.querySelector('.cost');
            const txt = `×${n}`;
            if (c.textContent !== txt) c.textContent = txt;
            el.classList.toggle('poor', n <= 0 || world.activeVols() >= world.slots);
            el.classList.toggle('sel', ui.tool?.vol === v);
        }
    }
    // the gate
    const g = $('b-gate');
    let txt, cls;
    if (world.state === 'build') {
        if (world.autoT > 0) { txt = `▶ Next wave · ${Math.ceil(world.autoT)}s`; cls = 'wait'; }
        else { txt = world.wave === 0 ? '▶ Open the gate' : '▶ Next wave'; cls = ''; }
    } else if (world.state === 'wave') { txt = world.boss ? `Holding the line… ${world.dead.length} on the road` : `On the road… ${world.people.filter((p) => p.role === 'civ' && p.state !== 'saved').length} walking`; cls = 'busy'; }
    else { txt = '…'; cls = 'busy'; }
    if (g.textContent !== txt) g.textContent = txt;
    g.className = `btn warm gate ${cls}`;
    $('b-speed').textContent = `${st.speed}×`;
    $('b-pause').textContent = st.paused ? '▶' : '❚❚';
    $('b-pause').classList.toggle('on', st.paused);
    $('b-sound').textContent = st.muted ? '🔇' : '🔊';
    // boss bar
    const b = world.bossEnt;
    $('bossbar').classList.toggle('hidden', !b);
    if (b) {
        $('boss-name').textContent = BOSSES[b.kind].name;
        $('bossbar').querySelector('i').style.width = `${Math.max(0, (b.blight / b.blightMax) * 100).toFixed(1)}%`;
    }
}
function setChip(id, txt) {
    const el = $(id);
    const b = el.querySelector('b');
    if (b.textContent === txt) return;
    const prev = ui.lastChip[id];
    b.textContent = txt;
    if (id === 'c-hope' && prev !== undefined && Number(txt) < Number(prev)) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    ui.lastChip[id] = txt;
}

export function hudInsets() {
    const top = $('topbar').getBoundingClientRect();
    const dock = $('dock').getBoundingClientRect();
    const r = document.documentElement.style;
    const dh = `${Math.round(window.innerHeight - dock.top)}px`, th = `${Math.round(top.bottom)}px`;
    if (r.getPropertyValue('--dock-h') !== dh) r.setProperty('--dock-h', dh);
    if (r.getPropertyValue('--top-h') !== th) r.setProperty('--top-h', th);
    return { top: top.bottom + 6, bottom: window.innerHeight - dock.top + 4 };
}

// ------------------------------------------------------------------ hints
export function hint(html) {
    const el = $('hint');
    if (!html) { el.classList.add('hidden'); return; }
    el.innerHTML = html;
    el.classList.remove('hidden');
}

// ------------------------------------------------------------------ the selection card
export function hideCard() { ui.card = null; $('card').classList.add('hidden'); }

export function showCard(sel, world) {
    ui.card = sel;
    renderCard(world, true);
}

export function renderCard(world, force = false) {
    const sel = ui.card;
    const el = $('card');
    if (!sel) { el.classList.add('hidden'); return; }
    let obj;
    if (sel.kind === 'station') obj = world.stations.find((s) => s.id === sel.id);
    else if (sel.kind === 'person') obj = world.people.find((p) => p.id === sel.id);
    else obj = world.dead.find((z) => z.id === sel.id);
    if (!obj || obj.state === 'saved' || obj.state === 'lost' || obj.state === 'cured' || obj.state === 'gone') { hideCard(); act.cardClosed(); return; }
    // rebuilding every frame would eat clicks: rebuild only on change
    const key = cardKey(sel.kind, obj, world);
    if (!force && key === ui.cardKeyStr) return;
    ui.cardKeyStr = key;
    el.innerHTML = '';
    el.classList.remove('hidden');
    el.append(h('button', { class: 'x', 'aria-label': 'Close', onclick: () => { hideCard(); act.cardClosed(); } }, '✕'));
    if (sel.kind === 'station') stationCard(el, obj, world);
    else if (sel.kind === 'person') personCard(el, obj, world);
    else deadCard(el, obj, world);
}
function cardKey(kind, o, world) {
    if (kind === 'station') return `s${o.id}-${o.lv}-${o.treated}-${world.supplies >= world.upgradeCost(o)}`;
    if (kind === 'person') return `p${o.id}-${o.state}-${Math.round(o.hp / 4)}-${Math.round(o.temp / 4)}-${o.wound}-${Math.round(o.sick / 5)}-${o.hunger}-${Math.round(o.cold / 5)}-${o.fracture}-${Math.round(o.fear / 5)}`;
    return `d${o.id}-${Math.round(o.blight / Math.max(1, o.blightMax) * 50)}-${o.mode}`;
}

function stationCard(el, s, world) {
    const S = STATIONS[s.type], L = S.lv[s.lv];
    el.append(h('div', { class: 'sub' }, `Aid station · level ${s.lv + 1}`), h('h3', {}, `${S.icon} ${S.name}`), h('p', {}, S.blurb));
    const dl = h('dl', { class: 'stats' });
    const row = (a, b) => dl.append(h('dt', {}, a), h('dd', {}, b));
    row('Reach', `${L.range} tiles`);
    if (L.every) row('Every', `${L.every}s`);
    if (L.heal) row('Heals', `${L.heal}${L.targets > 1 ? ` × ${L.targets}` : ''}`);
    if (L.cure) row('Cures blight', `−${L.cure}`);
    if (L.temp) row('Temp. health', `+${L.temp}`);
    if (L.slow) row('Slows the dead', `${Math.round(L.slow * 100)}%`);
    if (L.warm) row('Warms', `−${L.warm} cold/s`);
    if (L.revive) row('Revives at', `${Math.round(L.revive * 100)}%`);
    if (L.calm) row('Calms', `−${L.calm} fear/s`);
    if (L.lure) row('Lures for', `${L.lure}s`);
    row('Helped', `${s.treated}`);
    el.append(dl);
    const r = h('div', { class: 'row' });
    if (s.lv < 2) {
        const c = world.upgradeCost(s);
        const nx = S.lv[s.lv + 1];
        const what = s.lv === 1 ? levelThreeNote(s.type) : `reach ${nx.range}`;
        r.append(h('button', { class: `btn small warm${world.supplies < c ? ' off' : ''}`, 'data-act': 'upgrade', onclick: () => act.upgrade(s.id) }, `⬆ Level ${s.lv + 2} · 📦${c}`));
        el.append(h('p', {}, `Next: ${what}.`));
    } else r.append(h('span', { class: 'pips' }, '★★★ Fully set up'));
    r.append(h('button', { class: 'btn small soft', 'data-act': 'sell', onclick: () => act.sell(s.id) }, `Pack up · +${world.sellValue(s)}`));
    el.append(r);
}
function levelThreeNote(type) {
    return {
        medic: 'treats two at once', lantern: 'fires a flare that stuns', remedy: 'leaves people immune for a while', kitchen: 'bigger bowls, 45 temp. health',
        fire: 'warms longer, heals faster', stretcher: 'revives at 70% and carries further', splint: 'mends two at once', song: 'the dead sway and slow', bell: 'rings more often, lures longer',
    }[type];
}

function personCard(el, p, world) {
    const n = p.name;
    const kindLabel = p.role === 'vol' ? `Volunteer · ${TRADES[p.trade].name}` : p.restored ? 'Cured · walking home' : `${{ adult: 'Adult', elder: 'Elder', child: 'Child', carrier: 'Carrier' }[p.kind]}${p.trade && p.kind !== 'child' ? ` · ${TRADES[p.trade].name}` : ''}`;
    el.append(h('div', { class: 'sub' }, kindLabel), h('h3', {}, `${n.first} ${n.last}${p.kind === 'child' ? `, ${n.age}` : ''}`));
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    el.append(h('div', { class: 'meter' }, h('i', { style: { width: `${hpPct}%`, background: hpPct > 60 ? '#5fbf6a' : hpPct > 30 ? '#f2c14e' : '#ef6f6c' } })));
    if (p.temp > 0.5) el.append(h('div', { class: 'meter' }, h('i', { style: { width: `${Math.min(100, (p.temp / p.maxHp) * 100)}%`, background: '#f2c14e' } })));
    const ails = h('div', { class: 'ails' });
    const line = (key, val, txt) => ails.append(h('div', { class: 'ail' }, h('span', { class: 'ic' }, AILMENTS[key].icon), h('span', {}, txt), val != null ? h('div', { class: 'meter' }, h('i', { style: { width: `${val}%`, background: AILMENTS[key].color } })) : null));
    if (p.wound) line('wound', (p.wound / 3) * 100, `Wound ${'●'.repeat(p.wound)}`);
    if (p.sick >= 1) line('sick', p.sick, 'Blight');
    if (p.hunger) line('hunger', null, 'Hungry');
    if (world.ail.has('cold') && p.cold > 1) line('cold', p.cold, 'Cold');
    if (p.fracture) line('fracture', null, 'Broken leg');
    if (p.fear > 5) line('fear', p.fear, 'Fear');
    if (ails.children.length) el.append(ails);
    el.append(h('p', { class: 'mood' }, moodLine(p, world)));
    if (p.role === 'vol') {
        el.append(h('p', {}, TRADES[p.trade].blurb), h('p', {}, `Power ${Math.round(p.power * 100)}%`));
        el.append(h('div', { class: 'row' }, h('button', { class: 'btn small soft', 'data-act': 'recall', onclick: () => act.recall(p.id) }, '↩ Call back to the Haven')));
    }
}
function moodLine(p, world) {
    if (p.state === 'down') return 'Collapsed. Someone, please, quickly…';
    if (p.restored) return '“I remember my name again.”';
    if (p.role === 'vol') return p.fear > 50 ? '“Steady… steady…”' : '“We were helped. Now we help.”';
    if (p.freezeT > 0 || p.fear > 60) return '“I can\'t… I can\'t move…”';
    if (p.hp < p.maxHp * 0.3) return '“So tired. Keep going. Keep going.”';
    if (p.fracture) return '“My leg… they\'re getting closer.”';
    if (p.sick > 60) return '“Burning up. Everything\'s blurry.”';
    if (p.hunger) return '“When did I last eat?”';
    if (world.ail.has('cold') && p.cold > 50) return '“Can\'t feel my fingers.”';
    if (p.temp > 10) return '“I feel stronger. Thank you.”';
    if (p.wound === 0 && p.sick < 10 && !p.hunger) return '“I can see the lantern! We\'re nearly there!”';
    return '“Just a little further.”';
}

function deadCard(el, z, world) {
    if (z.boss) {
        const B = BOSSES[z.kind];
        el.append(h('div', { class: 'sub' }, 'Boss'), h('h3', {}, B.name));
        el.append(h('p', {}, 'Somewhere inside it is a person. Cure the blight and bring them back.'));
    } else {
        const D = DEAD[z.kind];
        el.append(h('div', { class: 'sub' }, 'The dead'), h('h3', {}, `🧟 ${D.name}`), h('p', {}, D.blurb));
        el.append(h('p', {}, world.boss ? 'Cure its blight and it walks home as a person again.' : 'There is no cure on this road yet. Slow it, lure it, and keep the living ahead of it.'));
    }
    if (world.boss) el.append(h('div', { class: 'meter' }, h('i', { style: { width: `${(z.blight / z.blightMax) * 100}%`, background: '#9a7ad8' } })));
    if (z.mode === 'lured') el.append(h('p', {}, '🔔 Wandering toward the bell.'));
}

// ------------------------------------------------------------------ words & toasts
export function word(id, text, cls = '', life = 2.2) {
    const now = performance.now();
    if (!cls && now - (ui.lastWord || 0) < 700) return;
    if (!cls) ui.lastWord = now;
    if (ui.words.length > 5) { const o = ui.words.shift(); o.el.remove(); }
    if (id && ui.words.some((w) => w.id === id && w.t > 0.6)) return;
    const el = h('div', { class: `word ${cls}` }, text);
    $('words').append(el);
    ui.words.push({ id, el, t: life, life, y: 0 });
}
/** Float words up over whoever said them. `at(id)` returns a screen point or null. */
export function updateWords(dt, at) {
    for (const w of ui.words) {
        w.t -= dt;
        w.y += dt * 14;
        const p = at(w);
        if (!p) { w.t = Math.min(w.t, 0.3); continue; }
        if (w.t > 0) { w.el.style.left = `${p.x}px`; w.el.style.top = `${p.y - 28 - w.y}px`; }
        w.el.style.opacity = Math.min(1, w.t / 0.4).toFixed(2);
    }
    const dead = ui.words.filter((w) => w.t <= 0);
    for (const w of dead) w.el.remove();
    ui.words = ui.words.filter((w) => w.t > 0);
}
export function clearWords() { for (const w of ui.words) w.el.remove(); ui.words = []; }

export function toast(text, cls = '', ms = 2600) {
    const el = h('div', { class: `toast ${cls}` }, text);
    const box = $('toasts');
    box.append(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 700);
}

// ------------------------------------------------------------------ modals
export function modal(build, { narrow = false, onClose = null } = {}) {
    const m = $('modal'), p = $('modal-panel');
    p.innerHTML = '';
    p.className = `panel${narrow ? ' narrow' : ''}`;
    build(p);
    m.classList.remove('hidden');
    ui.modalClose = onClose;
}
export function closeModal() { $('modal').classList.add('hidden'); ui.modalClose = null; }
export const modalOpen = () => !$('modal').classList.contains('hidden');

export function pauseMenu({ resume, restart, settings, quit, levelName }) {
    modal((p) => {
        p.append(h('header', { class: 'panel-head' }, h('div', { class: 'sub' }, 'Paused'), h('h2', {}, levelName), h('button', { class: 'x', onclick: resume }, '✕')));
        p.append(h('div', { class: 'scroll' }, h('div', { class: 'menu' },
            h('button', { class: 'btn big warm', 'data-act': 'resume', onclick: resume }, '▶ Back to the road'),
            h('button', { class: 'btn', 'data-act': 'restart', onclick: restart }, '↻ Start this road again'),
            h('button', { class: 'btn', onclick: settings }, '⚙️ Settings'),
            h('button', { class: 'btn soft', 'data-act': 'quit', onclick: quit }, '🗺️ Back to the valley'))));
    }, { narrow: true, onClose: resume });
}

export function results(sum, letters, { next, retry, valley, unlockedText, boss }) {
    modal((p) => {
        const won = sum.state === 'won';
        const head = h('header', { class: 'panel-head' }, h('div', { class: 'sub' }, won ? (boss ? 'The line held' : 'Everyone who made it is safe') : 'The gates closed early'), h('h2', {}, won ? (boss ? 'Cured!' : 'Home at last') : 'Take a breath'));
        p.append(head);
        const body = h('div', { class: 'scroll' });
        if (won) body.append(h('div', { class: 'stars' }, [1, 2, 3].map((i) => h('span', { class: `s${i <= sum.stars ? ' on' : ''}`, style: { animationDelay: `${0.2 + i * 0.25}s` } }, '★'))));
        else body.append(h('p', { class: 'lead' }, 'Everyone who made it is safe. The Haven will open its gates again. Take a breath and try again; maybe a station further up the road, or one more lantern.'));
        const t = sum.stats;
        const tally = boss
            ? [[t.cured, 'cured'], [t.restored, 'walked home'], [`${sum.hope}/${sum.hopeMax}`, 'hope left'], [t.revived, 'revived']]
            : [[t.saved, 'brought home'], [t.thriving, 'thriving'], [t.treated, 'times cared for'], [t.lost, 'remembered']];
        body.append(h('div', { class: 'tally' }, tally.map(([v, l]) => h('div', {}, h('b', {}, v), h('span', {}, l)))));
        if (unlockedText) body.append(h('p', { class: 'lead', style: { textAlign: 'center' } }, unlockedText));
        const joined = sum.saved.filter((s) => (s.thriving || s.restored) && s.trade).length;
        if (joined) body.append(h('p', { class: 'remember' }, `🙋 ${joined} ${joined === 1 ? 'person' : 'people'} joined the volunteers.`));
        if (letters.length) {
            body.append(h('div', { class: 'section-title' }, '✉️ Letters'));
            body.append(h('div', { class: 'letters' }, letters.map((L, i) => letterEl(L, i))));
        }
        if (sum.lost.length) body.append(h('p', { class: 'remember' }, '🏮 Their lanterns rose over the valley: ', h('b', {}, sum.lost.slice(0, 12).join(', ')), sum.lost.length > 12 ? ` and ${sum.lost.length - 12} more` : '', '. We remember them.'));
        p.append(body);
        const foot = h('footer', { class: 'panel-foot' });
        if (won && next) foot.append(h('button', { class: 'btn big warm', 'data-act': 'next', onclick: next }, '▶ Next road'));
        foot.append(h('button', { class: `btn${won ? '' : ' warm big'}`, 'data-act': 'retry', onclick: retry }, '↻ Again'));
        foot.append(h('button', { class: 'btn soft', 'data-act': 'valley', onclick: valley }, '🗺️ The valley'));
        p.append(foot);
    }, { onClose: null });
}

export function letterEl(L, i = 0) {
    const r = `${((i * 37) % 5) * 0.4 - 0.8}deg`;
    if (L.kind === 'child') return h('div', { class: 'letter child', style: { '--r': r } }, h('div', {}, L.body.join(' ')), h('div', { class: 'sign' }, L.sign, h('b', {}, L.from)));
    return h('div', { class: 'letter', style: { '--r': r } }, h('div', { class: 'open' }, L.open), h('div', {}, L.body.join(' ')), h('div', { class: 'sign' }, L.sign, h('b', {}, `${L.from}${L.trade ? `, ${TRADES[L.trade].name.toLowerCase()}` : ''}`)));
}

export function epilogue(onDone) {
    modal((p) => {
        p.append(h('header', { class: 'panel-head' }, h('div', { class: 'sub' }, 'Epilogue'), h('h2', {}, 'Morning')));
        p.append(h('div', { class: 'scroll' },
            h('p', { class: 'lead' }, 'The Blight Heart came apart in the light, and the people inside it walked out blinking into the first sunrise in a long time.'),
            h('p', { class: 'lead' }, 'All over the valley the dead stopped where they stood, and sat down, and asked what day it was. Someone always knew. Someone always had a blanket.'),
            h('p', { class: 'lead' }, 'The Haven is a town now. There is a school, and a garden, and a terrible band that practises every evening. Every lantern on the road still burns, just in case somebody else is walking home.'),
            h('p', { class: 'lead' }, h('b', {}, 'Open Road is open: '), 'a new road every time, for as long as you like.')));
        p.append(h('footer', { class: 'panel-foot' }, h('button', { class: 'btn big warm', 'data-act': 'epilogue-done', onclick: onDone }, 'Thank you')));
    });
}

export function journal(progress, tabName = 'letters') {
    modal((p) => {
        p.append(h('header', { class: 'panel-head' }, h('div', { class: 'sub' }, 'The Haven'), h('h2', {}, 'Journal'), h('button', { class: 'x', onclick: closeModal }, '✕')));
        const tabs = ['letters', 'roster', 'guide', 'remembered'];
        const names = { letters: '✉️ Letters', roster: '🙋 Volunteers', guide: '📗 Field guide', remembered: '🏮 Remembered' };
        p.append(h('div', { class: 'tabs-row' }, tabs.map((t) => h('button', { class: `tab${t === tabName ? ' on' : ''}`, onclick: () => journal(progress, t) }, names[t]))));
        const body = h('div', { class: 'scroll' });
        const s = progress.stats;
        if (tabName === 'letters') {
            body.append(h('div', { class: 'tally' }, [[s.saved, 'brought home'], [s.thriving, 'thriving'], [s.cured, 'cured'], [s.treated, 'cared for']].map(([v, l]) => h('div', {}, h('b', {}, v), h('span', {}, l)))));
            if (!progress.letters.length) body.append(h('p', { class: 'lead' }, 'No letters yet. They come from the people you bring home.'));
            body.append(h('div', { class: 'letters' }, progress.letters.slice(0, 40).map((L, i) => letterEl(L, i))));
        } else if (tabName === 'roster') {
            body.append(h('p', { class: 'lead' }, 'Everyone who reaches the Haven thriving, and everyone cured, joins the volunteers. Each extra person of a trade trains the others: +3% each, up to +60%.'));
            body.append(rosterGrid(progress.roster, true));
        } else if (tabName === 'guide') {
            body.append(h('div', { class: 'section-title' }, 'Ailments'));
            body.append(h('div', { class: 'cards' }, Object.entries(AILMENTS).map(([k, A]) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, A.icon), h('div', {}, h('b', {}, A.name), h('p', {}, `${A.blurb} Treated by the ${STATIONS[A.treat].name}.`))))));
            body.append(h('div', { class: 'section-title' }, 'Aid stations'));
            body.append(h('div', { class: 'cards' }, STATION_KEYS.map((k) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, STATIONS[k].icon), h('div', {}, h('b', {}, `${STATIONS[k].name}`), h('p', {}, `${STATIONS[k].blurb} From road ${STATIONS[k].unlock}.`))))));
            body.append(h('div', { class: 'section-title' }, 'The dead'));
            body.append(h('div', { class: 'cards' }, Object.entries(DEAD).map(([, D]) => h('div', { class: 'card-mini' }, h('div', { class: 'ic' }, '🧟'), h('div', {}, h('b', {}, D.name), h('p', {}, D.blurb))))));
            body.append(h('div', { class: 'section-title' }, 'People'));
            body.append(h('p', {}, `Adults have ${KINDS.adult.hp} health, elders ${KINDS.elder.hp} and walk slower, children ${KINDS.child.hp} and frighten easily, carriers ${KINDS.carrier.hp} and bring extra supplies. Temporary health (gold) soaks up harm before health does, and fades slowly.`));
        } else {
            if (!progress.remembered.length) body.append(h('p', { class: 'lead' }, 'No lanterns have risen. Everyone has come home so far.'));
            else body.append(h('p', { class: 'lead' }, 'Their lanterns rose over the valley. We carry their names to the Haven.'), h('p', { class: 'remember', style: { textAlign: 'left' } }, progress.remembered.join(' · ')));
        }
        p.append(body);
    }, { onClose: closeModal });
}

export function settingsPanel(settings, { change, reset, back }) {
    modal((p) => {
        p.append(h('header', { class: 'panel-head' }, h('div', { class: 'sub' }, 'Haven Road'), h('h2', {}, 'Settings'), h('button', { class: 'x', onclick: back }, '✕')));
        const body = h('div', { class: 'scroll' });
        const range = (label, key) => h('label', { class: 'set' }, label, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings[key], oninput: (e) => change(key, Number(e.target.value)) }));
        body.append(range('🎵 Music', 'music'), range('🔔 Sounds', 'sfx'));
        const q = h('select', { onchange: (e) => change('quality', Number(e.target.value)) },
            [[-1, 'Automatic'], [0, 'High'], [1, 'Medium'], [2, 'Low (no glow, no shadows)']].map(([v, t]) => h('option', { value: v, selected: settings.quality === v ? 'selected' : null }, t)));
        body.append(h('label', { class: 'set' }, '✨ Graphics', q));
        body.append(h('label', { class: 'set' }, '💬 Kind words over people', h('input', { type: 'checkbox', checked: settings.words ? 'checked' : null, onchange: (e) => change('words', e.target.checked) })));
        body.append(h('div', { class: 'section-title' }, 'Keys'));
        body.append(h('p', {}, '1–9 pick a station · click a tile to build · Space opens the gate · F speed · P pause · M sound · Esc cancel / menu · drag to look around, wheel to zoom · H recentre'));
        body.append(h('div', { class: 'row', style: { marginTop: '16px', display: 'flex', justifyContent: 'center' } }, h('button', { class: 'btn danger small', onclick: reset }, 'Forget all progress')));
        p.append(body);
        p.append(h('footer', { class: 'panel-foot' }, h('button', { class: 'btn warm', onclick: back }, 'Done')));
    }, { narrow: true, onClose: back });
}

export function confirm(text, yes, no) {
    modal((p) => {
        p.append(h('div', { class: 'scroll' }, h('p', { class: 'lead', style: { textAlign: 'center', marginTop: '10px' } }, text)));
        p.append(h('footer', { class: 'panel-foot' }, h('button', { class: 'btn danger', onclick: yes }, 'Yes'), h('button', { class: 'btn', onclick: no }, 'No')));
    }, { narrow: true, onClose: no });
}
