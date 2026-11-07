// The DOM layer: screens, the HUD, the working sheet, placing buildings, toasts. It reads the game
// and changes it only through act(), the same door the bot uses.

import { VERSION, SEASONS } from './config.js';
import { BUILDINGS, nameOf } from './sim/data/buildings.js';
import { ITEMS } from './sim/data/items.js';
import { JOURNAL, JOURNAL_IDS } from './sim/data/journal.js';
import { UPGRADES } from './sim/data/upgrades.js';
import { stock, capOf, hallLv, hall, hourOf, seasonOf, bldById, hById, builtOf } from './sim/core.js';
import { buildInfo, missing, buildCost, upgradeCost } from './sim/commands.js';
import { progress, claimable, activeEntries } from './sim/journal.js';
import { popCap } from './sim/townsfolk.js';
import { readyHeroes } from './sim/quests.js';
import { heroCap } from './sim/heroes.js';
import {
    panelBuild, panelBuilding, panelTown, panelHeroes, panelQuests, panelJournal, panelUpgrades, panelItems, panelMerchant, esc, icon, costHTML,
} from './panels.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- a tiny DOM morph: keeps nodes (and focus, scroll) when the markup only changes a little
function morphAttrs(a, b) {
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
}
function morphNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    morphAttrs(a, b);
    morphKids(a, b);
}
function morphKids(a, b) {
    const ac = a.childNodes, bc = b.childNodes;
    for (let i = 0; i < bc.length; i++) {
        if (i >= ac.length) a.appendChild(bc[i].cloneNode(true));
        else morphNode(ac[i], bc[i]);
    }
    while (a.childNodes.length > bc.length) a.removeChild(a.lastChild);
}
export function morph(el, html) {
    const t = document.createElement(el.tagName === 'TABLE' ? 'table' : 'div');
    t.innerHTML = html;
    morphKids(el, t);
}

const PANELS = { build: panelBuild, building: panelBuilding, town: panelTown, heroes: panelHeroes, quests: panelQuests, journal: panelJournal, upgrades: panelUpgrades, items: panelItems, merchant: panelMerchant };
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${Math.floor(n)}`);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, getG, act, view }) {
        this.audio = audio;
        this.settings = settings;
        this.getG = getG;
        this.doAct = act;
        this.view = view;
        this.stack = [];
        this.panel = null;
        this.selId = null;
        this.history = [];
        this.state = { tabs: {}, picker: null, shelf: null, hero: null, quest: null, party: [], confirm: null };
        this.placing = null;
        this.sheetT = 0; this.hudT = 0; this.bannerT = 0;
        this.lastToast = new Map();
        $('version').textContent = 'v' + VERSION;
        this.speed = 1;

        // a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('.screen [data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), q = $('set-quality'), aw = $('set-autowelcome'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; q.value = settings.quality; aw.value = settings.autowelcome; calm.value = settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, quality: +q.value, autowelcome: aw.value, calm: calm.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, q, aw, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved town deleted.'); });

        // the dock
        for (const b of document.querySelectorAll('#dock .dbtn')) b.addEventListener('click', () => this.togglePanel(b.dataset.open));
        $('sheet-close').addEventListener('click', () => { this.audio.ui('close'); this.close(); });
        $('sheet-back').addEventListener('click', () => { this.audio.ui('click'); this.back(); });
        $('sheet').addEventListener('click', (e) => {
            const el = e.target.closest('[data-a]');
            if (!el || el.classList.contains('off')) { if (el) { this.audio.ui('no'); } return; }
            this.handle(el.dataset.a, el.dataset.p || '');
        });
        $('sheet-tabs').addEventListener('click', (e) => {
            const el = e.target.closest('[data-a="tab"]');
            if (el) { this.state.tabs[this.panel] = el.dataset.p; this.audio.ui('click'); this.render(true); }
        });
        $('tracker').addEventListener('click', () => this.open('journal'));
        $('place-ok').addEventListener('click', () => this.placeConfirm());
        $('place-cancel').addEventListener('click', () => this.cancelPlace());
    }

    // ---------------------------------------------------------------- screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // each screen opens on top of the last: later in the stack, higher z-index
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ---------------------------------------------------------------- the sheet
    togglePanel(id) {
        if (this.panel === id && !this.state.hero && !this.state.quest) { this.audio.ui('close'); this.close(); }
        else { this.audio.ui('open'); this.open(id); }
    }
    open(panel, sel = null) {
        if (this.placing) this.cancelPlace(true);
        if (this.panel && (this.panel !== panel || sel != null)) { this.history.push({ panel: this.panel, selId: this.selId, state: { ...this.state } }); if (this.history.length > 6) this.history.shift(); }
        this.panel = panel;
        if (panel !== 'building') this.selId = null;
        if (sel != null && panel === 'building') this.selId = sel;
        if (panel === 'heroes') { this.state.hero = typeof sel === 'number' ? sel : null; }
        this.state.picker = null; this.state.shelf = null; this.state.confirm = null;
        if (panel !== 'quests') this.state.quest = null;
        $('sheet').hidden = false;
        this.syncSelection();
        this.render(true);
        document.querySelectorAll('#dock .dbtn').forEach((b) => b.classList.toggle('on', b.dataset.open === panel));
        if (panel === 'building' && this.selId != null) {
            const b = bldById(this.getG(), this.selId), d = BUILDINGS[b.type];
            this.view.focusFree(b.x + d.w / 2, b.y + d.h * 0.6, $('sheet').getBoundingClientRect());
        }
    }
    close() {
        this.panel = null; this.selId = null; this.history = [];
        this.state.hero = null; this.state.quest = null; this.state.picker = null; this.state.shelf = null; this.state.confirm = null;
        $('sheet').hidden = true;
        this.syncSelection();
        document.querySelectorAll('#dock .dbtn').forEach((b) => b.classList.remove('on'));
    }
    back() {
        if (this.state.hero != null) { this.state.hero = null; this.render(true); return; }
        if (this.state.quest != null) { this.state.quest = null; this.render(true); return; }
        const h = this.history.pop();
        if (h) { this.panel = h.panel; this.selId = h.selId; this.syncSelection(); this.render(true); } else this.close();
    }
    syncSelection() {
        this.view.selected = this.panel === 'building' && this.selId != null ? { kind: 'building', id: this.selId } : this.state.hero != null && this.panel === 'heroes' ? { kind: 'hero', id: this.state.hero } : null;
    }
    tab(panel, def) { return this.state.tabs[panel] ?? def; }

    render(force = false) {
        if (!this.panel) return;
        const G = this.getG();
        let r;
        if (this.panel === 'building') {
            const b = bldById(G, this.selId);
            if (!b) { this.close(); return; }
            r = panelBuilding(this, G, b);
        } else r = PANELS[this.panel](this, G);
        $('sheet-name').textContent = r.title;
        $('sheet-back').hidden = !(r.back || this.history.length);
        const tabs = $('sheet-tabs');
        tabs.hidden = !(r.tabs && r.tabs.length);
        if (r.tabs) morph(tabs, r.tabs.map((t) => `<button class="tab ${t.on ? 'on' : ''}" data-a="tab" data-p="${t.id}">${esc(t.name)}${t.dot ? `<b class="dot">${t.dot}</b>` : ''}</button>`).join(''));
        morph($('sheet-body'), r.html);
        $('sheet').classList.toggle('tall', this.panel === 'building' || this.panel === 'heroes');
    }

    // ---------------------------------------------------------------- actions from buttons
    fail(r) { if (r && !r.ok) { this.toast(r.why || 'Cannot do that.', 'bad'); this.audio.ui('no'); } return r?.ok; }
    handle(a, p) {
        const G = this.getG();
        const [p0, p1, p2] = p.split('|');
        const act = (cmd) => { const r = this.doAct(cmd); this.fail(r); return r; };
        this.audio.ui('click');
        switch (a) {
            case 'open': this.open(p0); return;
            case 'select': this.open('building', +p0); return;
            case 'locked': this.toast(`Reach Hall level ${BUILDINGS[p0].unlock} to unlock this.`, 'bad'); return;
            case 'place': this.startPlace(p0); return;
            case 'upgrade': act({ t: 'upgrade', id: +p0 }); break;
            case 'cancel': act({ t: 'cancel', id: +p0 }); this.close(); return;
            case 'move': this.startPlace(null, +p0); return;
            case 'confirmdel': this.state.confirm = `del${p0}`; break;
            case 'demolish': { const r = act({ t: 'demolish', id: +p0 }); if (r.ok) { this.close(); return; } break; }
            case 'picker': this.state.picker = this.state.picker === +p0 ? null : +p0; break;
            case 'assign': act({ t: 'assign', vid: +p0, bid: +p1 }); this.state.picker = null; break;
            case 'unassign': act({ t: 'assign', vid: +p0, bid: null }); break;
            case 'autoAssignAll': act({ t: 'autoAssign', all: true }); this.toast('Everyone has been shuffled to the jobs that suit them.'); break;
            case 'queue': act({ t: 'queue', bid: +p0, rid: p1, n: +p2 }); break;
            case 'dequeue': act({ t: 'dequeue', bid: +p0, i: +p1 }); break;
            case 'target': { const b = bldById(G, +p0); const cur = (b && b.auto[p1]) || 0; act({ t: 'target', bid: +p0, rid: p1, n: Math.max(0, cur + +p2) }); break; }
            case 'hire': { const r = act({ t: 'hire', rid: +p0 }); break; }
            case 'hero': this.state.hero = +p0; this.syncSelection(); break;
            case 'auto': { const h = hById(G, +p0); act({ t: 'auto', hid: +p0, on: !h.auto }); break; }
            case 'equip': act({ t: 'equip', hid: +p0, item: p1 }); break;
            case 'confirmfire': this.state.confirm = `fire${p0}`; break;
            case 'dismiss': { const r = act({ t: 'dismiss', hid: +p0 }); if (r.ok) { this.state.hero = null; this.syncSelection(); } break; }
            case 'qsel': this.state.quest = +p0; this.state.party = []; break;
            case 'qback': this.state.quest = null; break;
            case 'qhero': {
                const id = +p0, q = G.board.find((x) => x.id === this.state.quest);
                const i = this.state.party.indexOf(id);
                if (i >= 0) this.state.party.splice(i, 1);
                else if (q && this.state.party.length < q.slots) this.state.party.push(id);
                else this.toast('The party is full.', 'bad');
                break;
            }
            case 'dispatch': { const r = act({ t: 'dispatch', qid: this.state.quest, heroes: this.state.party }); if (r.ok) { this.state.quest = null; this.state.party = []; this.state.tabs.quests = 'out'; } break; }
            case 'recall': act({ t: 'recall', pid: +p0 }); break;
            case 'claim': { const r = act({ t: 'claim', id: p0 }); if (r.ok) this.toast(`Claimed: ${r.text}`, 'good'); break; }
            case 'pin': act({ t: 'pin', id: G.pinned === p0 ? null : p0 }); break;
            case 'research': act({ t: 'research', id: p0 }); break;
            case 'welcome': act({ t: 'welcome', id: +p0, accept: p1 === '1' }); break;
            case 'sell': act({ t: 'sell', item: p0, n: +p1 }); break;
            case 'keep': {
                const cur = G.autoSell[p0], d = +p1;
                if (cur == null) { if (d > 0) act({ t: 'autosell', item: p0, keep: Math.max(10, Math.ceil(stock(G, p0) / 10) * 10) }); }
                else { const n = cur + d; act({ t: 'autosell', item: p0, keep: n < 0 ? null : n }); }
                break;
            }
            case 'shelfpick': this.state.shelf = this.state.shelf === +p0 ? null : +p0; break;
            case 'shelf': act({ t: 'shelf', slot: +p0, item: p1 || null }); this.state.shelf = null; break;
            case 'price': act({ t: 'price', item: p0, mul: (G.priceMul[p0] ?? 1) + +p1 }); break;
            case 'merchant': act({ t: 'merchant', i: +p0, n: +p1 }); break;
            default: break;
        }
        this.render(true);
    }

    // ---------------------------------------------------------------- placing buildings
    startPlace(type, moveId = 0) {
        const G = this.getG();
        const t = type || bldById(G, moveId).type;
        const d = BUILDINGS[t];
        const info = moveId ? null : buildInfo(G, t, 1);
        const cost = moveId ? null : buildCost(G, t, 1);
        if (!moveId) {
            const miss = missing(G, cost);
            if (miss.length) { this.toast(`Needs ${miss.join(', ')}.`, 'bad'); this.audio.ui('no'); return; }
        }
        const c = this.view.stage.cam;
        const b = bldById(G, moveId);
        this.placing = { type: t, moveId, x: Math.round(c.x - d.w / 2), y: Math.round(c.z - d.h / 2) };
        if (b) { this.placing.x = b.x; this.placing.y = b.y; }
        const sheet = $('sheet'); sheet.hidden = true;
        this.panel = null; this.history = [];
        document.querySelectorAll('#dock .dbtn').forEach((x) => x.classList.remove('on'));
        $('placebar').hidden = false;
        this.refreshGhost();
    }
    cancelPlace(quiet = false) {
        if (!this.placing) return;
        this.placing = null;
        this.view.setGhost(this.getG(), null);
        $('placebar').hidden = true;
        if (!quiet) this.audio.ui('close');
    }
    refreshGhost() {
        const p = this.placing;
        if (!p) return;
        const G = this.getG();
        const gh = this.view.setGhost(G, p.type, p.x, p.y, p.moveId);
        const d = BUILDINGS[p.type];
        const cost = p.moveId ? null : buildCost(G, p.type, 1);
        $('place-text').innerHTML = `<b>${p.moveId ? 'Moving' : 'Placing'} ${esc(nameOf(p.type, 1))}</b>${gh && gh.problem ? `<small class="bad">${esc(gh.problem)}</small>` : `<small>${p.moveId ? 'Free to move' : costHTML(G, cost)}</small>`}`;
        $('place-ok').disabled = !gh || !!gh.problem;
        $('place-ok').classList.toggle('off', !gh || !!gh.problem);
    }
    /** Pointer moved while placing: the building follows. Touch lifts the ghost above the finger. */
    placeHover(cx, cy, touch) {
        const p = this.placing;
        if (!p) return;
        const d = BUILDINGS[p.type];
        const r = this.view.canvas.getBoundingClientRect();
        const g = this.view.stage.unproject(cx - r.left, cy - r.top - (touch ? 56 : 0));
        p.x = Math.floor(g.x - d.w / 2 + 0.5);
        p.y = Math.floor(g.z - d.h / 2 + 0.5);
        this.refreshGhost();
    }
    placeConfirm() {
        const p = this.placing;
        if (!p) return;
        const cmd = p.moveId ? { t: 'move', id: p.moveId, x: p.x, y: p.y } : { t: 'build', type: p.type, x: p.x, y: p.y };
        const r = this.doAct(cmd);
        if (!r.ok) { this.toast(r.why, 'bad'); this.audio.ui('no'); return; }
        const d = BUILDINGS[p.type];
        if (p.moveId || d.kind !== 'deco' || missing(this.getG(), buildCost(this.getG(), p.type, 1)).length) { this.cancelPlace(true); if (r.id) this.open('building', r.id); }
        else { this.refreshGhost(); }          // decorations: keep placing more
    }

    // ---------------------------------------------------------------- taps on the world
    worldTap(pick, cx, cy, type) {
        const G = this.getG();
        if (this.placing) {
            this.placeHover(cx, cy, type === 'touch');
            if (type !== 'touch') this.placeConfirm();
            return;
        }
        switch (pick.kind) {
            case 'node': { const r = this.doAct({ t: 'harvest', id: pick.id }); if (!r.ok) { this.toast(r.why, 'bad'); this.audio.ui('no'); } break; }
            case 'building': this.audio.ui('click'); this.open('building', pick.id); break;
            case 'hero': this.audio.ui('click'); this.open('heroes', pick.id); break;
            case 'villager': this.audio.ui('click'); this.state.tabs.town = 'folk'; this.open('town'); break;
            default: if (this.panel) { this.close(); } break;
        }
    }

    // ---------------------------------------------------------------- HUD
    showHud(on) { $('hud').hidden = !on; if (!on) { this.close(); this.cancelPlace(true); } }
    setSpeed(s, paused) { this.speed = s; $('btn-speed').textContent = paused ? '⏸ Paused' : `▶ ${s}×`; }

    /** Called every frame; refreshes the cheap parts often and the rest a few times a second. */
    hud(G, dt) {
        this.hudT -= dt; this.sheetT -= dt;
        const hr = G.hour ?? hourOf(G.t);
        const hh = Math.floor(hr), mm = Math.floor((hr % 1) * 60 / 10) * 10;
        const sun = hr >= 5.5 && hr < 20 ? (G.weather === 'rain' ? '🌧️' : G.weather === 'snow' ? '🌨️' : hr < 8 || hr > 18 ? '🌅' : '☀️') : '🌙';
        const clock = `<span>${sun}</span><span>Day <b>${G.day}</b><span class="hs"> · ${SEASONS[seasonOf(G.day)]}</span>${G.festival ? ' 🎉' : ''}</span><span>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`;
        if ($('clock').dataset.h !== clock) { $('clock').innerHTML = clock; $('clock').dataset.h = clock; }
        if (this.hudT <= 0) { this.hudT = 0.25; this.updateChips(G); this.updateTracker(G); this.updateDock(G); }
        if (this.sheetT <= 0) { this.sheetT = 0.3; this.render(); }
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').hidden = true; }
        if (this.placing) this.refreshGhost();
    }

    updateChips(G) {
        const chip = (ic, n, cap, cls = '', tip = '') => `<span class="chip ${cls}${cap != null && n >= cap ? ' full' : ''}" title="${esc(tip)}"><i>${ic}</i>${fmt(n)}${cap != null ? `<small>/${fmt(cap)}</small>` : ''}</span>`;
        const nextH = hall(G);
        const html = [
            chip('🪙', G.gold, null, 'gold', 'Gold'),
            chip('⭐', G.renown, null, '', 'Renown'),
            `<span class="chip" title="Villagers / homes"><i>👥</i>${G.villagers.length}<small>/${popCap(G)}</small></span>`,
            `<span class="chip" title="Heroes"><i>⚔️</i>${G.heroes.length}<small>/${heroCap(G)}</small></span>`,
            ...['wood', 'stone', 'plank', 'fiber', 'wheat', 'fish', 'ore', 'ingot', 'cloth', 'steel', 'gem', 'lore'].filter((k) => stock(G, k) > 0).map((k) => chip(ITEMS[k].icon, stock(G, k), capOf(G, k), '', ITEMS[k].name)),
        ].join('');
        morph($('res'), html);
    }

    updateTracker(G) {
        const t = $('tracker');
        const ready = claimable(G);
        let e = ready.length ? JOURNAL[ready[0]] : null;
        if (!e) e = G.pinned && JOURNAL[G.pinned] && G.journal[G.pinned] !== 'claimed' ? JOURNAL[G.pinned] : activeEntries(G)[0];
        if (!e) { t.hidden = true; return; }
        t.hidden = false;
        const p = progress(G, e);
        const isReady = G.journal[e.id] === 'ready';
        t.classList.toggle('ready', isReady);
        morph(t, `📜 ${esc(e.title)}${ready.length > 1 ? ` <small>(+${ready.length - 1} more)</small>` : ''}<small>${isReady ? 'Tap to claim your reward!' : esc(e.text)}</small><div class="bar"><i style="width:${Math.min(100, (p.cur / p.need) * 100).toFixed(0)}%"></i></div>`);
    }

    updateDock(G) {
        const set = (name, n) => { const b = document.querySelector(`#dock [data-open="${name}"] .dot`); if (!b) return; b.hidden = !n; b.textContent = n > 9 ? '9+' : n; };
        set('town', G.visitors.filter((v) => v.kind === 'villager').length);
        set('journal', claimable(G).length);
        set('heroes', G.recruits.length && G.heroes.length < heroCap(G) && builtOf(G, 'guild').length ? G.recruits.length : 0);
        set('quests', readyHeroes(G).length && G.board.some((q) => !q.pid) ? readyHeroes(G).length : 0);
        let can = 0;
        for (const u of Object.values(UPGRADES)) if (!G.upgrades[u.id] && hallLv(G) >= u.hall && !u.req.some((r) => !G.upgrades[r]) && missing(G, upgradeCost(G, u.id)).length === 0) can++;
        set('upgrades', can);
    }

    toast(text, kind = '') {
        const now = performance.now();
        if (this.lastToast.get(text) > now - 1500) return;
        this.lastToast.set(text, now);
        const box = $('toasts');
        const el = document.createElement('div');
        el.className = 'toast ' + kind;
        el.textContent = text;
        box.appendChild(el);
        while (box.children.length > 4) box.firstChild.remove();
        setTimeout(() => el.remove(), 3700);
    }
    banner(text, kind = '', secs = 6) {
        const b = $('banner');
        b.textContent = text; b.className = kind; b.hidden = false;
        this.bannerT = secs;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'toast') this.toast(e.text, e.kind === 'good' ? 'good' : e.kind === 'bad' ? 'bad' : '');
            else if (e.type === 'raidWarn') this.banner(`⚠️ ${e.name} is coming tonight (strength ${e.power}).`, 'bad', 9);
            else if (e.type === 'merchant') this.banner('🐪 A travelling merchant has set up in the square. Open Items to browse.', 'good', 8);
            else if (e.type === 'festival') this.banner('🎉 Festival day! The tavern is packed and everybody is in a good mood.', 'good', 8);
            else if (e.type === 'newcomer' && !this.panel) this.banner(`👋 ${e.name} is waiting at the gate. Open Town to welcome them.`, '', 7);
        }
    }

    // ---------------------------------------------------------------- the big screens
    showWelcome(s) {
        $('welcome-away').textContent = `You were away ${durLong(s.away)}${s.capped ? ' (the town can only work for so long unattended)' : ''}. The town kept busy for about ${durLong(s.simulated)}.`;
        const lines = [];
        const line = (ic, text) => lines.push(`<div class="sumline"><i>${ic}</i><span>${text}</span></div>`);
        if (s.gold) line('🪙', `${s.gold > 0 ? '+' : ''}${s.gold.toLocaleString()} gold`);
        const items = Object.entries(s.items).filter(([k, n]) => n > 0 && ITEMS[k]).sort((a, b) => b[1] * ITEMS[b[0]].value - a[1] * ITEMS[a[0]].value).slice(0, 8);
        if (items.length) line('📦', items.map(([k, n]) => `+${n.toLocaleString()} ${ITEMS[k].icon}`).join('  '));
        if (s.quests || s.partial || s.failed) line('🗺️', `${s.quests} quests won${s.partial ? `, ${s.partial} scraped through` : ''}${s.failed ? `, ${s.failed} lost` : ''}`);
        if (s.levels > 0) line('✨', `Heroes gained ${s.levels} levels`);
        if (s.raidsHeld || s.raidsLost) line('🛡️', `${s.raidsHeld} raids held${s.raidsLost ? `, ${s.raidsLost} got through` : ''}`);
        if (s.renown) line('⭐', `+${s.renown} renown`);
        if (s.newVillagers) line('👥', `${s.newVillagers} newcomers moved in`);
        if (s.journal > 0) line('📜', `${s.journal} journal ${s.journal === 1 ? 'entry is' : 'entries are'} ready to claim`);
        if (s.days) line('📆', `${s.days} days passed`);
        const notes = s.notes.slice(0, 6).map((n) => `<li>${esc(n)}</li>`).join('');
        $('welcome-body').innerHTML = lines.join('') + (notes ? `<details><summary>What happened</summary><ul>${notes}</ul></details>` : '');
        this.openScreen('welcome');
    }

    showEnding(G) {
        $('ending-body').innerHTML = `<p>The old dragon Cinderwing lands on the roost, takes one look at the Harvest Feast your cooks sent up with the party, and, after a very long pause, sits down.</p>
            <p>By the time the sun is up, she has agreed to keep to her mountain, and to come to the festival if there are apple pies.</p>
            <p>Hearthwick is no longer a hut and a neighbour. It is <b>${G.villagers.length}</b> townsfolk, <b>${G.heroes.length}</b> heroes, <b>${G.buildings.length}</b> buildings and a very warm tavern, after <b>${G.day}</b> days.</p>
            <p class="dim">You can keep playing as long as you like: the hearth stays lit.</p>`;
        this.openScreen('ending');
    }
}

function durLong(s) {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : m ? `${m} min` : `${s}s`;
}
