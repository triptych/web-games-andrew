// The DOM layer: screens, the station and mission HUDs, the dialogue box, terminals, toasts, settings and the
// touch deck. Reads the sim; changes it only by sending commands through `send`.

import { VERSION, YEAR_DAYS, EDEN_WIN, BEACON, SPEEDS, BOT } from '../config.js';
import { RES, RES_INFO, ZONES, GENS, SPECIES_BY_ID } from '../sim/data.js';
import { SPEAKERS } from '../sim/story.js';
import { TERM_BY_ID, ROOMS } from '../sim/layout.js';
import { edenIndex, talkLine, talkChoices, currentGoal } from '../sim/game.js';
import { renderPanel, reportHtml, endingHtml, PANEL_TITLES } from './panels.js';
import * as SP from '../view/sprites.js';

const $ = (id) => document.getElementById(id);
const MOODS = ['happy', 'excited', 'think', 'worried', 'sad'];
const ROOM_NAME = Object.fromEntries(ROOMS.map((r) => [r.id, r.name]));
const spriteCache = new Map();
function spriteCanvas(key) {
    if (spriteCache.has(key)) return spriteCache.get(key);
    let s;
    if (key.startsWith('bot')) s = SP.bot(+key.slice(3));
    else if (key.startsWith('sp-')) s = SP.species(key.slice(3));
    else if (key.startsWith('tilly-')) s = SP.tilly(key.slice(6));
    const c = s ? s.px.toCanvas() : null;
    spriteCache.set(key, c);
    return c;
}

/** Patch `el` to match `html` in place: same tags keep their nodes (and focus, scroll and the finger on them). */
export function morph(el, html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    patchChildren(el, t.content);
}
function patchChildren(a, b) {
    const an = [...a.childNodes], bn = [...b.childNodes];
    for (let i = 0; i < bn.length; i++) {
        const x = an[i], y = bn[i];
        if (!x) { a.appendChild(y.cloneNode(true)); continue; }
        if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.dataset?.sprite !== y.dataset?.sprite)) { a.replaceChild(y.cloneNode(true), x); continue; }
        if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
        if (x.nodeType !== 1) continue;
        for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
        for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
        if (x.nodeName === 'CANVAS') continue;
        patchChildren(x, y);
    }
    while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
}
function paintSprites(root) {
    for (const c of root.querySelectorAll('canvas[data-sprite]')) {
        if (c.dataset.done === c.dataset.sprite) continue;
        const src = spriteCanvas(c.dataset.sprite);
        if (!src) continue;
        c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        c.dataset.done = c.dataset.sprite;
    }
}

export class UI {
    constructor({ audio, settings, send, onSettings, onDeleteSave }) {
        this.audio = audio; this.settings = settings; this.send = send;
        this.stack = [];
        this.touchOn = false;
        this.panel = null; this.panelState = {};
        this.typed = 0; this.typeKey = ''; this.talkReadyAt = 0;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when the finger lifts (game-071)
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // terminal buttons
        $('term-body').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b || b.disabled || !this.panel) return;
            if (b.dataset.ui) { Object.assign(this.panelState[this.panel], JSON.parse(b.dataset.ui)); audio.ui('click'); this.refreshPanel(true); return; }
            if (b.dataset.cmd) { const c = JSON.parse(b.dataset.cmd); send(c, (r) => { if (!r.ok) { audio.ui('no'); this.toast(r.why); } else { audio.ui('ok'); if (c.t === 'deploy' || c.t === 'wake') this.closeAll(); } this.refreshPanel(true); }); }
        });
        $('term-close').addEventListener('click', () => { audio.ui('close'); this.closeScreen('term'); });

        // dialogue: a tap first finishes the typing, then goes on (game-121)
        $('talk').addEventListener('click', (e) => {
            const ch = e.target.closest('button[data-choice]');
            if (ch) { if (performance.now() < this.talkReadyAt || ch.disabled) return; send({ t: 'choose', id: ch.dataset.choice }, (r) => { if (!r.ok) { audio.ui('no'); this.toast(r.why); } }); return; }
            this.talkAdvance();
        });

        const sfx = $('set-sfx'), music = $('set-music'), sens = $('set-sens');
        sfx.value = settings.sfx; music.value = settings.music; sens.value = settings.sens;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, sens: +sens.value }); onSettings(settings); };
        for (const el of [sfx, music, sens]) el.addEventListener('change', changed);
        for (const b of document.querySelectorAll('[data-set]')) b.addEventListener('click', () => {
            const [k, v] = b.dataset.set.split('=');
            settings[k] = v === 'true' ? true : v === 'false' ? false : v;
            this.syncSettings(); onSettings(settings);
        });
        this.syncSettings();
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }
    syncSettings() { for (const b of document.querySelectorAll('[data-set]')) { const [k, v] = b.dataset.set.split('='); b.classList.toggle('on', String(this.settings[k]) === v); b.setAttribute('aria-pressed', String(this.settings[k]) === v); } }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'term') this.panel = null;
        if (this.top()) this.focusFirst(this.top());
        else document.activeElement?.blur?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const s of [...this.stack]) this.closeScreen(s); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button:not([disabled]), input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { (this.buttons(id).find((b) => b.classList.contains('primary')) || this.buttons(id)[0])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const n = list[(i + dir + list.length) % list.length];
        n.focus(); n.scrollIntoView({ block: 'nearest' });
    }

    // ------------------------------------------------------------------ terminals
    openPanel(id, G) {
        if (!PANEL_TITLES[id]) return;
        this.panel = id;
        this.G = G;
        this.panelState[id] ||= {};
        $('term-name').textContent = PANEL_TITLES[id];
        $('term-body').innerHTML = '';
        this.refreshPanel(true);
        this.openScreen('term');
    }
    refreshPanel(force = false) {
        if (!this.panel || !this.G) return;
        const now = performance.now();
        if (!force && now - (this.lastRefresh || 0) < 250) return;
        this.lastRefresh = now;
        morph($('term-body'), renderPanel(this.panel, this.G, this.panelState[this.panel]));
        paintSprites($('term-body'));
    }
    showReport(G) { $('report-body').innerHTML = reportHtml(G); this.openScreen('report'); }
    showEnding(G) { $('ending-body').innerHTML = endingHtml(G); this.openScreen('ending'); }

    // ------------------------------------------------------------------ dialogue
    talkAdvance() {
        const G = this.G;
        if (!G?.talk) return;
        const L = talkLine(G);
        if (this.typed < L.t.length) { this.typed = L.t.length; this.talkReadyAt = performance.now() + 200; return; }
        if (talkChoices(G)) return;
        this.send({ t: 'next' });
    }
    talk(G, dt) {
        this.G = G;
        const box = $('talk');
        const L = talkLine(G);
        document.body.classList.toggle('talking', !!L);
        if (!L) { box.hidden = true; this.typeKey = ''; return; }
        box.hidden = false;
        const key = G.talk.id + ':' + G.talk.i;
        if (key !== this.typeKey) {
            this.typeKey = key; this.typed = 0;
            const sp = SPEAKERS[L.w];
            $('talk-name').textContent = sp.name; $('talk-name').style.color = sp.color;
            // painted portraits (art/): TILLY by mood, VESPER; systems and records keep their CSS faces
            $('talk-face').className = 'face ' + L.w + (L.w === 'tilly' ? ' m-' + (MOODS.includes(L.m) ? L.m : 'happy') : '');
            $('talk-choices').innerHTML = '';
            box.dataset.who = L.w;
        }
        const speed = this.settings.text === 'fast' ? 140 : 55;
        const before = Math.floor(this.typed);
        this.typed = Math.min(L.t.length, this.typed + dt * speed);
        if (Math.floor(this.typed) !== before && Math.floor(this.typed) % 3 === 0 && this.typed < L.t.length) this.audio.talk(L.w);
        $('talk-text').textContent = L.t.slice(0, Math.floor(this.typed));
        const done = this.typed >= L.t.length;
        $('talk-more').hidden = !done || !!talkChoices(G);
        const ch = talkChoices(G);
        const wrap = $('talk-choices');
        if (ch && done && !wrap.children.length) {
            this.talkReadyAt = performance.now() + 250;
            wrap.innerHTML = ch.map((c) => `<button class="btn choice" data-choice="${c.id}" ${c.ok ? '' : 'aria-disabled="true"'}>${c.t}${c.ok ? '' : ' <small>(locked)</small>'}</button>`).join('');
            wrap.querySelector('button')?.focus({ preventScroll: true });
        }
    }

    // ------------------------------------------------------------------ HUD
    showHud(mode) {
        $('hud-station').hidden = mode !== 'station';
        $('hud-mission').hidden = mode !== 'mission';
        this.hudMode = mode;
        this.setTouch(this.touchOn);
    }
    hud(G) {
        if (this.hudMode === 'station') {
            $('hud-day').textContent = `Day ${Math.floor(G.day) + 1}`;
            $('hud-left').textContent = `Reveille in ${Math.ceil(YEAR_DAYS - G.day)} d`;
            $('hud-yearbar').style.width = (G.day / YEAR_DAYS * 100).toFixed(2) + '%';
            const eden = edenIndex(G);
            $('hud-eden').textContent = eden.toFixed(1);
            $('hud-edenbar').style.width = Math.min(100, eden / EDEN_WIN * 100).toFixed(1) + '%';
            $('hud-res').textContent = RES.map((k) => `${RES_INFO[k].icon} ${Math.floor(G.res[k])}`).join('  ');
            $('hud-room').textContent = ROOM_NAME[G.me.room] || '';
            for (const b of document.querySelectorAll('#hud-speeds button')) b.classList.toggle('on', +b.dataset.speed === G.speed);
            const goal = currentGoal(G);
            $('hud-goal').textContent = goal.text;
            const near = G.near && !G.talk ? TERM_BY_ID[G.near] : null;
            $('hud-use').hidden = !near;
            if (near) $('hud-use-label').textContent = near.name;
            const bits = [];
            if (G.research.active.length) bits.push(`🔬 ${G.research.active.length}`);
            if (G.vats.length) bits.push(`🧪 ${G.vats.length}`);
            if (G.strains.length) bits.push(`🌱 ${G.strains.length} ready`);
            if (G.bot.busy > 0) bits.push(`🔧 bot ${Math.ceil(G.bot.busy * 24)}h`);
            $('hud-busy').textContent = bits.join('  ');
        } else if (this.hudMode === 'mission' && G.mission) {
            const M = G.mission, p = M.p, S = M.S;
            $('hud-zone').textContent = ZONES[M.zone].name;
            $('hud-hp').style.width = (p.hp / S.hpMax * 100).toFixed(1) + '%';
            $('hud-en').style.width = (p.en / S.enMax * 100).toFixed(1) + '%';
            $('hud-cargo').style.width = (p.carry / S.cargo * 100).toFixed(1) + '%';
            $('hud-hpt').textContent = Math.ceil(p.hp);
            $('hud-ent').textContent = p.limp ? 'EMPTY' : Math.ceil(p.en) + 's';
            $('hud-cargot').textContent = `${p.carry}/${S.cargo}`;
            $('hud-mgoal').textContent = currentGoal(G).text;
            // the beacon compass
            const dx = BEACON.x - p.x, dy = BEACON.y - p.y, a = Math.atan2(dx, -dy) - p.yaw;
            $('hud-arrow').style.transform = `rotate(${a}rad)`;
            $('hud-dist').textContent = Math.round(Math.hypot(dx, dy)) + ' m';
            const prog = p.extract > 0 ? p.extract / BEACON.hold : p.recall > 0 ? p.recall / BOT.recallHold : 0;
            $('hud-lift').hidden = !prog;
            $('hud-liftbar').style.width = (prog * 100).toFixed(0) + '%';
            $('hud-lift-label').textContent = p.recall > 0 ? 'Recalling' : 'Lifting off';
            const onBeacon = Math.hypot(dx, dy) < BEACON.r;
            $('hud-hint').textContent = onBeacon && !prog ? 'Hold Gather (E) to lift off' : p.limp ? 'Battery dead. Hull failing. Get to the beacon!' : '';
            $('btn-r').hidden = !S.recall;
            $('btn-c').hidden = !S.shot;
            const boss = M.enemies.find((e) => e.type === 'rootmother' && e.alive && e.provoked);
            $('hud-boss').hidden = !boss;
            if (boss) $('hud-bossbar').style.width = (boss.hp / boss.hpMax * 100).toFixed(1) + '%';
        }
    }
    setTouch(on) {
        this.touchOn = on;
        const playing = this.hudMode === 'station' || this.hudMode === 'mission';
        $('touch').hidden = !(on && playing);
        $('touch').dataset.mode = this.hudMode || '';
        document.body.classList.toggle('touch', on);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast'; el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3200);
        window.A11Y?.announce?.(text);
    }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'researched') this.toast(`🔬 Research complete`);
            else if (e.type === 'strainReady') this.toast(`🧪 ${e.name} is ready to release`);
            else if (e.type === 'sequenced') this.toast(`🧬 ${SPECIES_BY_ID[e.species].name} sequenced!`);
            else if (e.type === 'sample' && G.mode === 'mission') this.toast(`🧬 ${SPECIES_BY_ID[e.species].name} sample`);
            else if (e.type === 'fabricated') this.toast(`🤖 ${GENS[e.gen].mk} ${GENS[e.gen].name} is ready`);
            else if (e.type === 'release') this.toast(`🌱 ${e.name} released on ${ZONES[e.zone].name}`);
            else if (e.type === 'full') this.toast('📦 The hold is full');
            else if (e.type === 'limp') this.toast('🔋 Battery dead!');
            else if (e.type === 'log') this.toast(`📜 New log in the Archive: ${e.title}`);
            else if (e.type === 'colony') this.toast(`🏠 Colony founded on ${ZONES[e.zone].name}`);
        }
        if (this.panel) this.refreshPanel(true);
    }
}
export { SPEEDS };
