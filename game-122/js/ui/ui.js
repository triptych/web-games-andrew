// The DOM layer: screens, the HUD, toasts, Nib's remarks, the instrument and rest sheets, dialogue,
// pages and the ending. Reads the sim; changes it only through the act() callback it is given.

import { VERSION, ESSENCE_INFO } from '../config.js';
import { REAGENTS, ITEMS } from '../sim/data/reagents.js';
import { PAGES } from '../sim/data/text.js';
import { currentGoal } from '../sim/game.js';
import { dialogNode } from '../sim/story.js';
import { clockText, phaseOf, itemName } from '../sim/util.js';
import { glyphURL } from '../glyphart.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** **bold** and *italic* from the story text, safely. */
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>').split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, act }) {
        this.audio = audio;
        this.settings = settings;
        this.act = act;
        this.stack = [];
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION;
        this.z = 50;

        // A press that began outside a screen must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const s = settings;
        const ids = { sfx: 'set-sfx', music: 'set-music', sens: 'set-sens', invert: 'set-invert', quality: 'set-quality', touch: 'set-touch' };
        for (const k in ids) { const el = $(ids[k]); if (el.type === 'checkbox') el.checked = !!s[k]; else el.value = s[k]; }
        const changed = (e) => {
            Object.assign(s, { sfx: +$('set-sfx').value, music: +$('set-music').value, sens: +$('set-sens').value, invert: $('set-invert').checked, quality: $('set-quality').value, touch: $('set-touch').value });
            if (e?.target?.id === 'set-quality') $('quality-note').hidden = false;
            onSettings(s);
        };
        for (const k in ids) $(ids[k]).addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // slot buttons select; the instrument sheet; rest
        for (const b of document.querySelectorAll('#slots .slot')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.act({ t: 'select', slot: +b.dataset.slot }); });
        $('inst-run').addEventListener('click', () => this.runInstrument());
        for (const b of document.querySelectorAll('#rest-menu [data-until]')) b.addEventListener('click', () => { this.act({ t: 'rest', until: b.dataset.until }); this.closeScreen('rest'); this.fadeFlash(); });
        $('rest-cook').addEventListener('click', () => { const r = this.act({ t: 'cook' }); if (!r?.ok) this.toast(r?.text || 'Nothing to cook.'); this.refreshRest(); });
        // dialogue
        $('dlg-next').addEventListener('click', () => this.act({ t: 'say' }));
        $('dlg-choices').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (b) this.act({ t: 'say', choice: +b.dataset.c }); });
        $('pv-close').addEventListener('click', () => this.act({ t: 'closeDialog' }));
        this.lastGoal = null;
        this.barkT = 0;
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        // a screen opened over another always sits on top of it
        el.style.zIndex = String(++this.z);
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        if (id === 'book') this.onBookClose?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { if (this.touchOn) return; this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        document.body.classList.toggle('touch', on);
        $('touch').hidden = !(on && playing);
    }
    toast(text, tone = 'info') {
        const el = document.createElement('div');
        el.className = 'toast ' + tone;
        el.textContent = text;
        const box = $('toasts');
        box.appendChild(el);
        while (box.children.length > 3) box.firstChild.remove();
        setTimeout(() => el.remove(), 5600);
        window.A11Y?.announce?.(text);
    }
    bark(text) {
        $('bark-text').textContent = text;
        $('bark').hidden = false;
        $('bark').style.animation = 'none'; void $('bark').offsetWidth; $('bark').style.animation = '';
        this.barkT = 4.5 + text.length * 0.03;
    }
    region(name) {
        const el = $('region-card');
        el.textContent = name;
        el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    }
    fadeFlash() { const f = $('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 900); }

    hud(G, dt, focus, colorOf) {
        const p = G.p;
        const setBar = (id, v) => { const el = $(id); el.querySelector('i').style.width = Math.max(0, Math.min(100, v)) + '%'; el.classList.toggle('low', v < 20); };
        setBar('v-health', p.health); setBar('v-warmth', p.warmth); setBar('v-vigor', p.vigor);
        $('clock-time').textContent = clockText(G.tod);
        $('clock-day').textContent = `Day ${G.day} · ${{ dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }[phaseOf(G.tod)]}`;
        this.dial(G.tod);
        // goal
        const g = currentGoal(G);
        if (g.id !== this.lastGoal) {
            this.lastGoal = g.id;
            $('goal-text').textContent = g.text;
            $('goal').classList.remove('flash'); void $('goal').offsetWidth; $('goal').classList.add('flash');
        }
        const sub = g.sub ? g.sub.map((s) => `<li class="${s.done(G) ? 'done' : ''}">${esc(s.text)}</li>`).join('') : '';
        if (sub !== this._sub) { $('goal-sub').innerHTML = sub; this._sub = sub; }
        // slots
        const slotsKey = JSON.stringify([G.wand, G.sel, G.hasWand, Object.keys(G.notes.colors).length]);
        if (slotsKey !== this._slots) {
            this._slots = slotsKey;
            const btns = document.querySelectorAll('#slots .slot');
            G.wand.forEach((s, i) => {
                const b = btns[i];
                b.classList.toggle('sel', i === G.sel);
                b.classList.toggle('spent', !!s.glyphs.length && !s.charges);
                const marks = s.glyphs.map((gid) => `<img alt="" src="${glyphURL(G.laws.glyphs.find((x) => x.id === gid), 48, '#f4ead6')}">`).join('');
                b.innerHTML = `<span class="num">${i + 1}</span>${s.glyphs.length ? marks : '<span class="empty">blank</span>'}${s.glyphs.length ? `<span class="ch">×${s.charges}</span>` : ''}`;
                b.setAttribute('aria-label', `Slot ${i + 1}: ${s.glyphs.length ? s.charges + ' casts' : 'blank'}`);
            });
            $('slots').hidden = !G.hasWand;
        }
        // wards worn
        const wk = Object.keys(p.wards).map((e) => `${e}:${Math.ceil(p.wards[e])}`).join(',');
        if (wk !== this._wards) {
            this._wards = wk;
            $('wards').innerHTML = Object.keys(p.wards).map((e) => {
                const known = G.notes.colors[e] || e === 'unweave';
                return `<span class="ward-chip" style="color:${colorOf(e)}">${known ? (e === 'unweave' ? 'Unwoven' : ESSENCE_INFO[e].name) : 'A ward'} ${Math.ceil(p.wards[e])}s</span>`;
            }).join('');
        }
        const ring = $('ward-ring');
        const we = Object.keys(p.wards)[0];
        ring.style.opacity = we ? '1' : '0';
        if (we) ring.style.boxShadow = `inset 0 0 ${60 + Math.sin(performance.now() / 300) * 10}px ${colorOf(we)}55`;
        // prompt
        const pr = $('prompt');
        const key = this.touchOn ? 'Use' : 'E';
        const verb = focus ? ({ pickup: focus.p?.kind === 'bush' ? 'Pick berries' : 'Gather', page: 'Read', desk: G.hasWand ? 'Read the journal' : 'Take the Focus', inst: 'Use', bed: 'Rest', hearth: G.flags.hearth ? 'Rest & cook' : 'Light the hearth', fire: 'Rest & cook', nib: 'Talk to', carving: 'Study', stone: 'Look at', look: 'Look at', echo: 'Listen to' }[focus.kind] || 'Use') : '';
        const ptxt = focus ? `<kbd>${key}</kbd>${esc(verb)} ${esc(focus.kind === 'desk' && !G.hasWand ? '' : focus.label)}` : '';
        if (ptxt !== this._prompt) { pr.innerHTML = ptxt; this._prompt = ptxt; }
        $('crosshair').classList.toggle('on', !!focus);
        // Nib's bubble
        if (this.barkT > 0) { this.barkT -= dt; if (this.barkT <= 0) $('bark').hidden = true; }
        // the red edge when hurt or freezing
        $('tint').style.opacity = String(Math.max(0, (30 - Math.min(p.health, p.warmth + 10)) / 30) * 0.8 + (this.hurt || 0));
        this.hurt = Math.max(0, (this.hurt || 0) - dt * 1.5);
    }

    dial(tod) {
        const k = Math.round(tod * 200);
        if (k === this._dial) return;
        this._dial = k;
        const a = tod * Math.PI * 2 - Math.PI;
        const night = tod > 0.6 || tod < 0.02;
        $('clock-dial').innerHTML = `<circle cx="20" cy="20" r="18" fill="#1a1530" stroke="rgba(240,220,180,0.4)"/>
            <path d="M2 20 A18 18 0 0 1 38 20 Z" fill="#3d7fd8" opacity="0.55"/>
            <circle cx="${20 + Math.cos(a) * 12}" cy="${20 + Math.sin(a) * 12}" r="4.5" fill="${night ? '#dfe6ff' : '#ffd36a'}"/>
            <line x1="2" y1="20" x2="38" y2="20" stroke="rgba(240,220,180,0.5)"/>`;
    }

    // ------------------------------------------------------------------ instruments
    openInstrument(G, inst) {
        this.inst = inst; this.instPick = [];
        const names = { alembic: 'The Alembic', bells: 'The Bells', orrery: 'The Orrery' };
        const help = {
            alembic: 'Boil a reagent down to what it really is. Watch the vapour. (Uses it up.)',
            bells: 'Hang two reagents on the bells and strike them: do they ring together, apart, or clash?',
            orrery: 'Set a reagent in the cup and see which hour of the day its strength belongs to.',
        };
        $('inst-name').textContent = names[inst];
        $('inst-help').textContent = help[inst];
        $('inst-result').textContent = '';
        this.G = G;
        this.refreshInstrument();
        this.openScreen('inst');
    }
    refreshInstrument() {
        const G = this.G, need = this.inst === 'bells' ? 2 : 1;
        const ids = Object.keys(G.bag).filter((r) => REAGENTS[r] && G.bag[r] > 0);
        const box = $('inst-pick');
        if (!ids.length) { box.innerHTML = '<p class="note">You have no reagents. Things that glow faintly on the shore, in the woods and on the moor are worth picking up.</p>'; $('inst-run').disabled = true; return; }
        box.innerHTML = `<div class="pick">${ids.map((r) => {
            const n = G.notes.reagents[r];
            const tag = n?.essence ? ` <small>· ${ESSENCE_INFO[n.essence].name}</small>` : '';
            return `<button data-r="${r}" class="${this.instPick.includes(r) ? 'on' : ''}">${esc(REAGENTS[r].name)} ×${G.bag[r]}${tag}</button>`;
        }).join('')}</div>`;
        for (const b of box.querySelectorAll('button[data-r]')) b.addEventListener('click', () => {
            const r = b.dataset.r;
            if (this.instPick.includes(r)) this.instPick = this.instPick.filter((x) => x !== r);
            else { this.instPick.push(r); if (this.instPick.length > need) this.instPick.shift(); }
            this.audio.ui('click');
            this.refreshInstrument();
        });
        $('inst-run').disabled = this.instPick.length !== need;
        $('inst-run').textContent = { alembic: 'Distil', bells: 'Strike the bells', orrery: 'Wind the orrery' }[this.inst];
    }
    runInstrument() {
        const [a, b] = this.instPick;
        const r = this.act({ t: 'experiment', inst: this.inst, a, b });
        $('inst-result').textContent = r?.text || '';
        if (this.inst === 'alembic') this.instPick = [];
        this.refreshInstrument();
    }

    // ------------------------------------------------------------------ rest
    openRest(G, at) {
        this.G = G;
        $('rest-name').textContent = at === 'bed' ? 'Elowen\'s Bed' : at === 'hearth' ? 'By the Hearth' : 'By Your Fire';
        this.refreshRest();
        this.openScreen('rest');
    }
    refreshRest() {
        const G = this.G;
        const raw = (G.bag.clam || 0) + (G.bag.chanterelle || 0);
        $('rest-cook').disabled = !raw;
        $('rest-cook').textContent = raw ? `Cook (${raw})` : 'Cook';
    }

    // ------------------------------------------------------------------ dialogue and pages
    showDialog(G) {
        const n = dialogNode(G);
        if (!n) { $('dialog').hidden = true; $('pageview').hidden = true; this.stack = this.stack.filter((s) => s !== 'dialog' && s !== 'pageview'); return; }
        if (n.who === 'page') {
            const id = G.dialog.id.slice(5);
            $('pv-where').textContent = PAGES[id].where;
            $('pv-title').textContent = n.title;
            $('pv-text').innerHTML = md(n.text);
            if (this.top() !== 'pageview') this.openScreen('pageview');
            $('pageview').querySelector('.parchment').scrollTop = 0;
            return;
        }
        const who = { nib: 'Nib', elowen: n.echo ? 'An echo of Elowen' : 'Elowen', you: G.name, sys: '' }[n.who] ?? '';
        $('dlg-who').textContent = who;
        $('dlg-who').className = 'dlg-who ' + (n.echo ? 'echo' : n.who);
        $('dlg-text').innerHTML = md(n.text || (n.choices ? '' : '…'));
        $('dlg-choices').innerHTML = n.choices ? n.choices.map((c, i) => `<button class="btn" data-c="${i}">${esc(c.label)}</button>`).join('') : '';
        $('dlg-next').hidden = !!n.choices;
        if (this.top() !== 'dialog') this.openScreen('dialog');
        else this.focusFirst('dialog');
    }

    ending(G) {
        const E = G.ending;
        $('end-title').textContent = E.title;
        $('end-text').innerHTML = md(E.text);
        const s = G.stats;
        $('end-stats').innerHTML = `Island seed ${G.seed} · ${G.day} days · ${s.experiments} experiments · ${s.casts} spells cast (${s.fizzles} fizzled) · ${G.echoes ? Object.values(G.echoes).filter((x) => x === 'heard').length : 0} of 4 echoes heard`;
        this.openScreen('ending');
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'msg') this.toast(e.text, e.tone);
            else if (e.type === 'bark') this.bark(e.text);
            else if (e.type === 'region') this.region(e.name);
            else if (e.type === 'firstSpell') this.region('The first word');
            else if (e.type === 'glyph') this.toast(`New mark${e.ids.length > 1 ? 's' : ''} copied into your book.`, 'good');
            else if (e.type === 'hint') this.bark(e.text);
            else if (e.type === 'shadeTouch' || e.type === 'scald') this.hurt = 0.6;
            else if (e.type === 'collapse') this.fadeFlash();
            else if (e.type === 'stone') this.region('A stone wakes');
            else if (e.type === 'nibJoin') this.toast('Nib joins you. Talk to him (E) when you are stuck.', 'good');
        }
    }
}

export { esc, itemName, ITEMS };
