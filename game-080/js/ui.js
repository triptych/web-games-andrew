// The DOM layer: screens, the HUD, the dialogue box, the battle menus and their director, the
// satchel, shops, toasts. Reads the sim; changes it only through game.act(cmd).

import { VERSION } from './config.js';
import { ITEMS, SHOPS, SLOTS, sellPrice } from './sim/data/items.js';
import { GRIMOIRE, BOOK_ORDER, COMMON_BOOKS, GENRES, COMMON } from './sim/data/books.js';
import { FOE } from './sim/data/enemies.js';
import { NPCS, speakerName } from './sim/data/npcs.js';
import { QUESTS } from './sim/data/quests.js';
import { ZONES } from './sim/data/world.js';
import { maxHp, maxInk, focus, poise, count, xpFor, wickPower } from './sim/rules.js';
import { liveFoes, elemMul } from './sim/battle.js';
import { objective } from './sim/story.js';
import { getWorld } from './sim/worldgen.js';
import { personFrame, wickFrame, PLAYER_LOOK, icon } from './view/sprites.js';
import { GRASS } from './view/tiles.js';
import { TILES } from './sim/data/tiles.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ELEM_NAME = { light: 'light', wind: 'wind', fire: 'warmth', stone: 'stone', frost: 'frost', water: 'water', small: 'smallness', growth: 'growth', echo: 'echoes', unbind: 'unbinding', sky: 'sky', star: 'stars' };
const ITEM_ICON_COL = { mark: { ribbon: '#c0392b', leather: '#8a5a32', pressed: '#a87ad8', silver: '#c8ccd8', moonsilk: '#d8e0ff' } };
const TEXT_SPEED = { slow: 28, normal: 55, fast: 120, instant: 99999 };

export class UI {
    constructor({ audio, settings, view, game, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.view = view;
        this.game = game;                    // { G, act(cmd) }
        this.stack = [];
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen, #dlg-box, #b-panel'); }, { capture: true });
        for (const s of document.querySelectorAll('.screen, #dlg-box, #b-panel')) {
            s.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), text = $('set-text');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; text.value = settings.text;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, text: text.value });
            onSettings(settings);
        };
        for (const e of [sfx, music, touch, text]) e.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // dialogue: a tap or click anywhere on the box moves it on
        $('dlg-box').addEventListener('click', (e) => { if (!e.target.closest('.choice')) this.dialogPress(); });
        this.dlg = { text: '', shown: 0, who: null, key: null, done: true, choicesShown: false };

        // satchel and shop tabs
        for (const t of document.querySelectorAll('#bag-tabs .tab')) t.addEventListener('click', () => { audio.ui('move'); this.bagTab(t.dataset.tab); });
        for (const t of document.querySelectorAll('#shop-tabs .tab')) t.addEventListener('click', () => { audio.ui('move'); this.shopTab(t.dataset.tab); });
        $('shop-close').addEventListener('click', () => { audio.ui('close'); this.game.act({ type: 'closeShop' }); });
        this.tab = 'books';
        this.shopTabName = 'buy';

        // battle
        this.bat = null;
        this.bannerT = 0;
        this.barkT = 0;
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() {
        const t = this.top();
        if (!t) return;
        if (t === 'shop') { this.game.act({ type: 'closeShop' }); return; }
        this.closeScreen(t);
    }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
    focusFirst(id) {
        const list = this.buttons(id);
        const pref = list.find((b) => b.classList.contains('primary') || b.classList.contains('on')) || list[0];
        pref?.focus({ preventScroll: true });
    }
    /** Arrow keys move focus through a container's controls. */
    moveFocus(dir, id = this.top()) {
        const list = this.buttons(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
        this.audio.ui('move');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        $('hud-buttons').hidden = !on;
        this.setTouch(this.touchOn, on);
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    hud(G) {
        const mh = maxHp(G), mi = maxInk(G);
        $('hud-hp').textContent = `${G.hp}/${mh}`;
        $('hud-ink').textContent = `${G.ink}/${mi}`;
        $('hud-hp-fill').style.width = (100 * G.hp / mh) + '%';
        $('hud-ink-fill').style.width = (100 * G.ink / mi) + '%';
        $('hud-lvl').textContent = 'Lv ' + G.lvl;
        $('hud-coins').textContent = G.coins;
        $('hud-book-n').textContent = G.books.length;
        const ob = objective(G);
        const txt = G.mode === 'explore' ? ob.text : '';
        if ($('hud-goal-text').textContent !== txt) $('hud-goal-text').textContent = txt;
        $('hud-goal').style.display = txt ? '' : 'none';
    }

    banner(name, sub = '') {
        const b = $('zone-banner');
        b.innerHTML = (sub ? `<small>${esc(sub)}</small>` : '') + esc(name);
        b.classList.add('show');
        this.bannerT = 2.6;
    }

    bark(text) {
        const b = $('bark');
        b.textContent = text;
        b.hidden = false;
        this.barkT = 3.2;
        this.placeBark();
    }
    placeBark() {
        const b = $('bark');
        if (b.hidden) return;
        const p = this.view.wickScreen();
        const vw = window.innerWidth;
        if (p) { b.style.left = Math.max(140, Math.min(vw - 140, p.x)) + 'px'; b.style.top = Math.max(90, p.y - 6) + 'px'; }
        else { b.style.left = '50%'; b.style.top = '40%'; }
    }

    toast(text, big = false) {
        const t = el('div', 'toast' + (big ? ' big' : ''));
        t.textContent = text;
        $('toasts').appendChild(t);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => t.remove(), 3100);
    }

    tick(G, dt) {
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('zone-banner').classList.remove('show'); }
        if (this.barkT > 0) { this.barkT -= dt; this.placeBark(); if (this.barkT <= 0) $('bark').hidden = true; }
        this.dialogTick(G, dt);
        this.battleTick(G, dt);
    }

    // ------------------------------------------------------------------ sim events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'zone': this.banner(e.name, e.first ? 'Discovered' : ''); break;
                case 'bark': this.bark(e.text); break;
                case 'gain': if (G.mode !== 'dialog') this.toast(`Got ${ITEMS[e.item].name}${e.n > 1 ? ' × ' + e.n : ''}`); break;
                case 'gainBook': this.toast(`Book: "${COMMON[e.id].title}"`); break;
                case 'quest': this.toast(e.state === 'done' ? `Quest complete: ${QUESTS[e.id].name}` : `New quest: ${QUESTS[e.id].name}`, true); break;
                case 'levelUp': if (G.mode !== 'battle') this.toast(`Level ${e.lvl}! You feel more composed.`, true); break;
                case 'restore': this.toast(`${GRIMOIRE[e.id].title} is home (${e.n}/12)`, true); break;
                case 'used': this.toast(`Used ${ITEMS[e.id].name}`); break;
                case 'equip': this.toast(`Now wearing: ${ITEMS[e.id].name}`); break;
                case 'rest': this.toast('Rested. Composure and ink restored; the wild books are back out.'); break;
                case 'overwhelmed': this.toast('Overwhelmed! Wick led you home for a cup of tea.', true); break;
                case 'shopOpen': this.openShop(G); break;
                case 'shopClose': this.closeScreen('shop'); break;
                case 'buy': case 'sell': this.renderShop(G); break;
                case 'say': this.dialogLine(G, e); break;
                case 'choices': this.dialogChoices(G); break;
                case 'dialogEnd': if (!G.dialog) this.hideDialog(); break;
                case 'b_start': this.battleStart(G, e); break;
                default: if (e.type.startsWith('b_') && this.bat) this.bat.queue.push(e);
            }
        }
        if (this.top() === 'bag') this.renderBag(G);
    }

    // ------------------------------------------------------------------ dialogue
    dialogLine(G, e) {
        $('dialog').hidden = false;
        const who = e.who;
        const D = this.dlg;
        D.text = e.text; D.shown = 0; D.done = false; D.who = who; D.choicesShown = false;
        $('dlg-choices').innerHTML = '';
        $('dlg-text').textContent = '';
        $('dlg-text').className = who === 'note' ? 'note' : '';
        $('dlg-name').textContent = who === 'note' ? '' : speakerName(who);
        $('dlg-more').hidden = true;
        this.portrait(who);
        if (this.settings.text === 'instant') this.finishLine();
    }
    portrait(who) {
        const c = $('dlg-portrait');
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, 32, 32);
        if (who === 'note') { c.classList.add('hide'); return; }
        c.classList.remove('hide');
        g.fillStyle = '#e8d8b8'; g.fillRect(0, 0, 32, 32);
        if (who === 'wick') { g.drawImage(wickFrame(0.3), 2, 0, 28, 32); return; }
        const look = who === 'you' ? PLAYER_LOOK : NPCS[who]?.look;
        if (!look) return;
        const img = personFrame(look, 'down', 0, who === 'you' ? 'player' : who);
        // the head and shoulders, twice the size
        const small = ['mouse', 'cat', 'kid', 'snowman', 'heron', 'scarecrow'].includes(look.k);
        g.drawImage(img, 0, small ? 2 : 0, 16, 16, 0, 2, 32, 32);
    }
    dialogTick(G, dt) {
        const D = this.dlg;
        if (!G.dialog || D.done) return;
        const before = Math.floor(D.shown);
        D.shown += dt * TEXT_SPEED[this.settings.text || 'normal'];
        const n = Math.min(D.text.length, Math.floor(D.shown));
        if (n !== before) {
            $('dlg-text').textContent = D.text.slice(0, n);
            if (n % 3 === 0 && D.text[n - 1] !== ' ') this.audio.blip(D.who);
        }
        if (n >= D.text.length) this.finishLine();
    }
    finishLine() {
        const D = this.dlg;
        D.done = true;
        D.shown = D.text.length;
        $('dlg-text').textContent = D.text;
        const G = this.game.G;
        if (G.dialog?.choices) this.dialogChoices(G);
        else $('dlg-more').hidden = false;
    }
    dialogChoices(G) {
        const D = this.dlg;
        if (!D.done || D.choicesShown || !G.dialog?.choices) return;
        D.choicesShown = true;
        $('dlg-more').hidden = true;
        const box = $('dlg-choices');
        box.innerHTML = '';
        G.dialog.choices.forEach((c, i) => {
            const b = el('button', 'choice', esc(c.label));
            b.addEventListener('click', () => { this.audio.ui('click'); this.game.act({ type: 'choose', i }); });
            box.appendChild(b);
        });
        box.firstChild?.focus({ preventScroll: true });
    }
    /** Space, Enter, A or a tap: finish the line, or move on. */
    dialogPress() {
        const G = this.game.G;
        if (!G.dialog) return;
        if (!this.dlg.done) { this.finishLine(); return; }
        if (G.dialog.choices) return;
        this.audio.ui('click');
        this.game.act({ type: 'advance' });
    }
    hideDialog() { $('dialog').hidden = true; $('dlg-choices').innerHTML = ''; }

    // ------------------------------------------------------------------ battle
    battleStart(G, e) {
        $('battle').hidden = false;
        this.showHud(false);
        this.bat = {
            queue: [], wait: 0.6, busy: true, menu: 'root', target: null, hp: G.hp, ink: G.ink,
            result: null, ended: false, plates: {},
        };
        $('b-log').textContent = e.boss ? (e.final ? 'The Blot rises out of the dark…' : 'A guardian! It\'s one of the grimoires, gone wild.') : this.encounterLine(G);
        this.buildPlates(G);
        this.renderMenu(G);
        this.audio.play(e.final ? 'final' : e.boss ? 'boss' : 'battle');
    }
    encounterLine(G) {
        const fs = G.battle.foes;
        if (fs.length === 1) return `A ${fs[0].name} is making mischief!`;
        return `${fs.map((f) => f.name.replace(/ [ABC]$/, '')).filter((n, i, a) => a.indexOf(n) === i).join(' and ')} — ${fs.length} of them, making mischief!`;
    }
    buildPlates(G) {
        const box = $('b-plates');
        box.innerHTML = '';
        this.bat.plates = {};
        for (const f of this.view.battle.disp.foes) this.addPlate(f);
    }
    addPlate(f) {
        const p = el('div', 'plate', `<div class="nm">${esc(f.name)}</div><div class="mb"><i></i></div><div class="tags"></div>`);
        $('b-plates').appendChild(p);
        this.bat.plates[f.n] = p;
    }
    placePlates() {
        if (!this.bat) return;
        for (const f of this.view.battle.disp.foes) {
            const p = this.bat.plates[f.n];
            if (!p) continue;
            const s = this.view.foeScreen(f.n);
            p.style.left = s.x + 'px';
            p.style.top = Math.max(110, s.y - 6) + 'px';
            p.querySelector('i').style.width = (100 * Math.max(0, f.hp) / f.max) + '%';
            p.classList.toggle('calm', !!f.calm);
            const B = this.game.G.battle;
            const live = B?.foes.find((x) => x.n === f.n);
            const tags = [];
            if (live?.understood) { const d = FOE[f.id]; if (d.weak.length) tags.push('soft for ' + d.weak.map((w) => ELEM_NAME[w]).join(', ')); }
            if (f.charge) tags.push('winding up!');
            if (live?.drowsy) tags.push('drowsy');
            if (live?.shrunk) tags.push('tiny');
            if (live?.guard) tags.push('guarding');
            p.querySelector('.tags').textContent = tags.join(' · ');
            p.classList.toggle('target', this.bat.menu === 'target' && this.bat.hover === f.n);
        }
    }
    float(x, y, text, cls) {
        const f = el('div', 'float ' + cls);
        f.textContent = text;
        f.style.left = x + 'px'; f.style.top = y + 'px';
        $('b-floats').appendChild(f);
        setTimeout(() => f.remove(), 1200);
    }

    battleTick(G, dt) {
        const B = this.bat;
        if (!B) return;
        this.placePlates();
        this.partyBars(G);
        if (B.wait > 0) { B.wait -= dt; return; }
        const e = B.queue.shift();
        if (!e) {
            if (B.busy) {
                B.busy = false;
                B.hp = G.hp; B.ink = G.ink;
                if (B.result) this.showResult(G);
                else this.renderMenu(G);
            }
            return;
        }
        B.busy = true;
        $('b-menu').classList.add('busy');
        this.play(G, e);
    }

    play(G, e) {
        const B = this.bat;
        const V = this.view.battle;
        const A = this.audio;
        switch (e.type) {
            case 'b_say': {
                $('b-log').textContent = e.text;
                B.wait = e.who === 'info' ? 0.85 : 0.75;
                if (e.anim === 'shush') A.battleBeat({ type: 'shush' });
                if (e.anim === 'spell') { V.cast(e.elem, e.foe ?? liveFoes(G.battle)[0]?.n); A.battleBeat({ type: 'spell', book: e.book }); B.ink = G.ink; }
                if (e.anim === 'wickhit') { V.wick(e.foe); A.battleBeat({ type: 'wick' }); }
                if (e.anim === 'wickheal') A.battleBeat({ type: 'heal' });
                if (e.anim === 'charge') { V.charge(e.foe, true); A.battleBeat({ type: 'charge' }); }
                if (e.anim === 'attack' && e.foe != null) { const f = V.disp.foes.find((x) => x.n === e.foe); if (f) f.shake = 0.2; }
                if (e.anim === 'flee') A.battleBeat({ type: 'flee' });
                if (e.anim === 'read' || e.anim === 'item' || e.anim === 'tidy' || e.anim === 'buff') B.wait = 0.9;
                if (e.text.length > 90) B.wait += 0.6;
                break;
            }
            case 'b_hit': {
                const f = V.disp.foes.find((x) => x.n === e.foe);
                if (f) f.hp = Math.max(0, f.hp - e.amount);
                V.hit(e.foe, e.elem, e.weak);
                const s = this.view.foeScreen(e.foe);
                this.float(s.x, s.y + s.size * 0.4, (e.crit ? '✦ ' : '') + e.amount + (e.weak ? '  soft spot!' : e.resist ? '  …shrugs' : ''), 'calm' + (e.weak || e.crit ? '' : ''));
                A.battleBeat({ type: 'hit', crit: e.crit, weak: e.weak });
                B.wait = 0.4;
                break;
            }
            case 'b_calm': {
                V.calm(e.foe, e.book);
                const f = V.disp.foes.find((x) => x.n === e.foe);
                const s = this.view.foeScreen(e.foe);
                this.float(s.x, s.y + s.size * 0.2, 'Calmed!', 'calm');
                const what = e.book ? `the book "${COMMON[e.book].title}"` : e.item ? `a ${ITEMS[e.item].name}` : 'a little pile of coins';
                $('b-log').textContent = `${f?.name || 'It'} settles down and turns back into ${what}.`;
                A.battleBeat({ type: 'calm' });
                B.wait = 1.0;
                break;
            }
            case 'b_ouch': {
                B.hp = Math.max(0, B.hp - e.amount);
                if (e.foe != null) V.charge(e.foe, false);
                V.ouch();
                const s = this.view.youScreen();
                this.float(s.x, s.y, '−' + e.amount + (e.smudge ? ' (smudge)' : e.guard ? ' (guarded)' : ''), 'ouch');
                A.battleBeat({ type: 'ouch' });
                B.wait = 0.45;
                break;
            }
            case 'b_heal': {
                B.hp += e.amount;
                V.heal();
                const s = this.view.youScreen();
                this.float(s.x, s.y, '+' + e.amount, 'heal');
                A.battleBeat({ type: 'heal' });
                B.wait = 0.45;
                break;
            }
            case 'b_ink': { B.ink += e.amount; const s = this.view.youScreen(); this.float(s.x + 30, s.y, '+' + e.amount + ' ink', 'heal small'); B.wait = 0.3; break; }
            case 'b_foeheal': {
                const f = V.disp.foes.find((x) => x.n === e.foe);
                if (f) f.hp = Math.min(f.max, f.hp + e.amount);
                const s = this.view.foeScreen(e.foe);
                this.float(s.x, s.y + s.size * 0.4, '+' + e.amount, 'heal');
                B.wait = 0.4;
                break;
            }
            case 'b_join': {
                const live = G.battle.foes.find((x) => x.n === e.foe);
                V.join(e.foe, e.id, live?.name || FOE[e.id].name);
                const f = V.disp.foes.find((x) => x.n === e.foe);
                f.hp = live?.max || 1; f.max = live?.max || 1;
                this.addPlate(f);
                A.battleBeat({ type: 'join' });
                B.wait = 0.6;
                break;
            }
            case 'b_round': B.wait = 0.05; break;
            case 'b_end': {
                B.result = e;
                B.wait = e.how === 'fled' ? 0.4 : 0.5;
                break;
            }
            default: B.wait = 0.1;
        }
    }

    partyBars(G) {
        const B = this.bat;
        const mh = maxHp(G), mi = maxInk(G);
        const hp = Math.max(0, Math.min(mh, Math.round(B.busy ? B.hp : G.hp)));
        const ink = Math.max(0, Math.min(mi, Math.round(B.busy ? B.ink : G.ink)));
        $('b-hp').textContent = `${hp}/${mh}`;
        $('b-ink').textContent = `${ink}/${mi}`;
        $('b-hp-fill').style.width = (100 * hp / mh) + '%';
        $('b-ink-fill').style.width = (100 * ink / mi) + '%';
        const st = G.battle?.st;
        const tags = [];
        if (st?.muddled) tags.push('muddled');
        if (st?.smudged) tags.push('smudged');
        if (st?.steady) tags.push('steady');
        if (st?.dodge) tags.push('light as a feather');
        if (st?.regen) tags.push('blooming');
        $('b-status').textContent = tags.join(' · ') || `Wick lends a hand (${wickPower(G)})`;
    }

    renderMenu(G) {
        const B = this.bat;
        const box = $('b-menu');
        box.innerHTML = '';
        box.classList.toggle('busy', B.busy);
        const add = (label, sub, fn, cls = '', disabled = false) => {
            const b = el('button', 'cmd ' + cls, `<span>${label}</span>${sub ? `<small>${sub}</small>` : ''}`);
            b.disabled = disabled;
            b.addEventListener('click', () => { if (this.bat?.busy) return; this.audio.ui('click'); fn(); });
            box.appendChild(b);
            return b;
        };
        const Bt = G.battle;
        if (!Bt) return;
        const live = liveFoes(Bt);
        const choose = (act, extra = {}) => {
            if (live.length === 1 || extra.target != null || act === 'tidy' || act === 'flee' || act === 'item') return this.send({ act, ...extra, target: extra.target ?? live[0].n });
            B.pending = { act, ...extra };
            B.menu = 'target';
            this.renderMenu(G);
        };
        if (B.menu === 'root') {
            add('Shush', 'calm one', () => choose('shush'));
            add('Read', 'learn its ways', () => choose('read'));
            add('Grimoires', G.books.length ? `${G.books.length} spell${G.books.length > 1 ? 's' : ''}` : 'none yet', () => { B.menu = 'spells'; this.renderMenu(G); }, '', !G.books.length);
            const treats = Object.keys(G.bag).filter((id) => ITEMS[id].kind === 'use');
            add('Treats', treats.length ? `${treats.reduce((a, id) => a + G.bag[id], 0)} in satchel` : 'none', () => { B.menu = 'items'; this.renderMenu(G); }, '', !treats.length);
            add('Tidy up', 'guard, +3 ink', () => choose('tidy'));
            add('Slip away', Bt.boss ? 'not from a guardian' : 'leave quietly', () => choose('flee'), '', !!Bt.boss);
        } else if (B.menu === 'spells') {
            for (const id of G.books) {
                const b = GRIMOIRE[id], sp = b.spell;
                const tgt = live[0];
                const know = tgt && Bt.foes.find((f) => f.n === tgt.n)?.understood;
                const mul = know && sp.kind === 'calm' ? elemMul(tgt.id, sp.elem) : 1;
                add(`${sp.name}${mul > 1 ? ' <i class="weak">★</i>' : ''}`, `${sp.ink} ink`, () => {
                    if (sp.target === 'one') choose('spell', { id });
                    else this.send({ act: 'spell', id, target: live[0].n });
                }, '', G.ink < sp.ink);
            }
            add('Back', '', () => { B.menu = 'root'; this.renderMenu(G); }, 'back');
        } else if (B.menu === 'items') {
            for (const id of Object.keys(G.bag)) {
                const it = ITEMS[id];
                if (it.kind !== 'use') continue;
                add(it.name, '× ' + G.bag[id], () => this.send({ act: 'item', id, target: live[0].n }), '', it.flee && !!Bt.boss);
            }
            add('Back', '', () => { B.menu = 'root'; this.renderMenu(G); }, 'back');
        } else if (B.menu === 'target') {
            for (const f of live) {
                const b = add(esc(f.name), `${f.hp}/${f.max}`, () => this.send({ ...B.pending, target: f.n }), 'wide');
                b.addEventListener('focus', () => { B.hover = f.n; });
                b.addEventListener('pointerenter', () => { B.hover = f.n; });
            }
            add('Back', '', () => { B.menu = 'root'; this.renderMenu(G); }, 'back');
            B.hover = live[0]?.n;
        }
        if (!B.busy) box.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }

    send(cmd) {
        const B = this.bat;
        B.menu = 'root';
        B.busy = true;
        B.hp = this.game.G.hp; B.ink = this.game.G.ink;
        $('b-menu').classList.add('busy');
        document.activeElement?.blur?.();
        this.game.act({ type: 'battle', ...cmd });
    }

    showResult(G) {
        const B = this.bat;
        const e = B.result;
        const box = $('b-menu');
        box.innerHTML = '';
        box.classList.remove('busy');
        const r = e.result;
        let lines = [];
        if (e.how === 'won') {
            lines.push(r.grimoire ? 'The guardian is calm.' : 'All calm. The pages settle.');
            lines.push(`+${r.xp} wisdom · +${r.coins} coins`);
            if (r.lvlAfter > r.lvlBefore) lines.push(`Level ${r.lvlAfter}! Composure and ink restored.`);
            this.audio.battleBeat({ type: r.grimoire ? 'grimoire' : 'won' });
        } else if (e.how === 'lost') {
            lines = ['It\'s all a bit much. You sit down in a heap.', 'Wick takes your hand and leads you home.'];
        } else {
            this.game.act({ type: 'battleDone' });
            return;
        }
        $('b-log').innerHTML = lines.map(esc).join('<br>');
        const b = el('button', 'cmd wide', '<span>Continue</span>');
        b.addEventListener('click', () => { this.audio.ui('click'); this.game.act({ type: 'battleDone' }); });
        box.appendChild(b);
        b.focus({ preventScroll: true });
        B.ended = true;
    }

    battleEnd() {
        $('battle').hidden = true;
        $('b-floats').innerHTML = '';
        $('b-plates').innerHTML = '';
        this.bat = null;
        this.showHud(true);
    }
    battleIdle() { return !this.bat || (!this.bat.busy && this.bat.queue.length === 0 && this.bat.wait <= 0); }
    battleBack() {
        const B = this.bat;
        if (!B || B.busy || B.menu === 'root') return;
        B.menu = 'root';
        this.renderMenu(this.game.G);
    }

    // ------------------------------------------------------------------ satchel
    openBag(G, tab) {
        if (tab) this.tab = tab;
        this.renderBag(G);
        this.openScreen('bag');
        $('bag-tabs').querySelector(`[data-tab="${this.tab}"]`)?.focus({ preventScroll: true });
    }
    bagTab(tab) { this.tab = tab; this.renderBag(this.game.G); }
    renderBag(G) {
        for (const t of document.querySelectorAll('#bag-tabs .tab')) t.classList.toggle('on', t.dataset.tab === this.tab);
        const body = $('bag-body');
        const keep = document.activeElement?.dataset?.id;
        body.innerHTML = '';
        ({ books: this.bagBooks, items: this.bagItems, gear: this.bagGear, shelves: this.bagShelves, journal: this.bagJournal, map: this.bagMap })[this.tab].call(this, G, body);
        if (keep) body.querySelector(`[data-id="${keep}"]`)?.focus({ preventScroll: true });
    }
    bagBooks(G, body) {
        const grid = el('div', 'grim');
        for (const id of BOOK_ORDER) {
            const b = GRIMOIRE[id];
            const has = G.books.includes(id);
            const c = el('div', 'gcard' + (has ? '' : ' none'));
            c.innerHTML = has
                ? `<h4><span class="sw" style="background:${b.colour}"></span>${esc(b.title)}</h4><div>${esc(b.power)}</div><div><b>${esc(b.spell.name)}</b> (${b.spell.ink} ink): ${esc(b.spell.text)}</div>${G.placed.includes(id) ? '<div class="placed">On its lectern ✓</div>' : '<div><i>Take it home to the Rotunda.</i></div>'}`
                : `<h4><span class="sw" style="background:#c8b8a0"></span>Not yet found</h4><div>${esc(b.short)}…</div>`;
            grid.appendChild(c);
        }
        body.appendChild(grid);
    }
    bagItems(G, body) {
        const list = el('div', 'list');
        const ids = Object.keys(G.bag).filter((id) => ITEMS[id].kind === 'use' || ITEMS[id].kind === 'key');
        if (!ids.length) list.appendChild(el('p', '', 'Your satchel is empty but for a few biscuit crumbs.'));
        for (const id of ids.sort((a, b) => (ITEMS[a].kind > ITEMS[b].kind ? -1 : 1))) {
            const it = ITEMS[id];
            const usable = it.kind === 'use' && !it.flee && G.mode === 'explore';
            const r = this.itemRow(id, it.text, usable ? 'Use' : '× ' + G.bag[id], usable ? () => { this.game.act({ type: 'use', id }); } : null);
            if (usable) r.querySelector('.t b').textContent += '  × ' + G.bag[id];
            list.appendChild(r);
        }
        if (G.keys && Object.values(G.keys).some((n) => n > 0)) list.appendChild(el('p', '', `Dungeon keys: ${Object.entries(G.keys).filter(([, n]) => n > 0).map(([d, n]) => n + ' for ' + getWorld().maps[d].name).join(', ')}`));
        body.appendChild(list);
    }
    itemRow(id, text, right, fn, eq = false) {
        const it = ITEMS[id];
        const b = el('button', 'row-btn' + (eq ? ' eq' : ''));
        b.dataset.id = id;
        const cv = document.createElement('canvas');
        cv.width = 12; cv.height = 12;
        const g = cv.getContext('2d');
        g.drawImage(icon(it.icon, ITEM_ICON_COL.mark[id] || (it.slot === 'knit' ? { wool: '#3f7a5a', patchwork: '#c07a4a', tweed: '#8a7a5a', shawl: '#f0f0f0', starweave: '#3a3a8a' }[id] : null)), 0, 0);
        b.appendChild(cv);
        b.appendChild(el('div', 't', `<b>${esc(it.name)}</b><span>${esc(text)}</span>`));
        b.appendChild(el('div', 'r', esc(right)));
        if (fn) b.addEventListener('click', () => { this.audio.ui('click'); fn(); });
        else b.disabled = false;
        return b;
    }
    bagGear(G, body) {
        const st = el('div', 'stats');
        const need = xpFor(G.lvl);
        st.innerHTML = `<div>Level <b>${G.lvl}</b> (${G.xp}/${need} wisdom)</div><div>Composure <b>${maxHp(G)}</b></div><div>Focus <b>${focus(G)}</b></div><div>Poise <b>${poise(G)}</b></div><div>Ink <b>${maxInk(G)}</b></div><div>Wick's warmth <b>${wickPower(G)}</b></div><div>Quilt patches <b>${G.ups.patch || 0}</b></div><div>Silver inkwells <b>${G.ups.inkwell || 0}</b></div>`;
        body.appendChild(st);
        const list = el('div', 'list');
        for (const slot of ['mark', 'knit', 'charm']) {
            const cur = G.gear[slot];
            if (cur) list.appendChild(this.itemRow(cur, `${SLOTS[slot]} · ${ITEMS[cur].text}`, slot === 'charm' ? 'Take off' : 'Worn', slot === 'charm' ? () => this.game.act({ type: 'unequip', slot }) : null, true));
            else list.appendChild(el('div', 'row-btn', `<div class="t"><b>${SLOTS[slot]}</b><span>Nothing worn.</span></div>`));
        }
        const owned = Object.keys(G.bag).filter((id) => ITEMS[id].kind === 'gear');
        if (owned.length) list.appendChild(el('h3', '', 'In your satchel'));
        for (const id of owned) list.appendChild(this.itemRow(id, `${SLOTS[ITEMS[id].slot]} · ${ITEMS[id].text}`, 'Wear', () => this.game.act({ type: 'equip', id })));
        body.appendChild(list);
    }
    bagShelves(G, body) {
        const carried = COMMON_BOOKS.filter((b) => G.common[b.id] === 1).length;
        const shelved = COMMON_BOOKS.filter((b) => G.common[b.id] === 2).length;
        body.appendChild(el('p', '', `<b>${shelved}</b> of ${COMMON_BOOKS.length} books are back on the shelves. ${carried ? `You're carrying <b>${carried}</b> — take them to the Returns Cart in the library's Reading Room.` : 'Calm runaway books to find more.'} A full shelf hides a gift.`));
        for (const g in GENRES) {
            const row = el('div', 'shelfrow');
            const books = COMMON_BOOKS.filter((b) => b.genre === g);
            row.appendChild(el('div', 'nm', `${esc(GENRES[g].name)}${G.flags['shelf_' + g] ? ' ✓' : ''}`));
            const slots = el('div', 'slots');
            for (const b of books) {
                const i = el('i', G.common[b.id] === 2 ? 'c' : '');
                if (G.common[b.id]) i.style.background = G.common[b.id] === 2 ? GENRES[g].colour : 'transparent';
                if (G.common[b.id] === 1) i.style.borderColor = GENRES[g].colour;
                i.title = G.common[b.id] ? b.title : '???';
                slots.appendChild(i);
            }
            row.appendChild(slots);
            body.appendChild(row);
        }
    }
    bagJournal(G, body) {
        const ob = objective(G);
        if (G.flags.metWick && G.map !== 'library' && G.mode === 'explore') {
            const home = el('button', 'btn small', '🕯️ Wick, take me home');
            home.addEventListener('click', () => { this.audio.ui('click'); this.closeScreen('bag'); this.game.act({ type: 'home' }); });
            body.appendChild(home);
        }
        body.appendChild(el('div', 'quest', `<b>Wick says</b><small>${esc(ob.text)}</small>${ob.hint ? `<small><i>"${esc(ob.hint)}"</i></small>` : ''}`));
        const ids = Object.keys(QUESTS).filter((id) => G.quests[id]);
        if (!ids.length) body.appendChild(el('p', '', 'No side quests yet. People in Vellumvale will ask for your help.'));
        for (const id of ids.sort((a, b) => (G.quests[a] === 'done') - (G.quests[b] === 'done'))) {
            const Q = QUESTS[id];
            const done = G.quests[id] === 'done';
            body.appendChild(el('div', 'quest' + (done ? ' done' : ''), `<b>${esc(Q.name)}</b>${done ? ' ✓' : ''}<small>${esc(Q.giver)}: ${esc(Q.text)}</small>${done ? '' : `<small>→ ${esc(Q.step(G))}</small>`}`));
        }
        const seen = Object.keys(G.seen).length;
        body.appendChild(el('p', '', `Places discovered: <b>${seen}</b> of ${ZONES.length}. Squabbles calmed: <b>${G.stats.calmed}</b>. Chests opened: <b>${G.stats.chests}</b>.`));
    }
    bagMap(G, body) {
        const { maps } = getWorld();
        const W = maps.world;
        const cv = document.createElement('canvas');
        cv.id = 'map-canvas';
        cv.width = W.w; cv.height = W.h;
        const g = cv.getContext('2d');
        const img = g.createImageData(W.w, W.h);
        const COL = {
            water: [64, 136, 200], deep: [64, 136, 200], reef: [90, 110, 120], rapids: [120, 180, 230], cliff: [130, 120, 105], pit: [190, 210, 240],
            tree: [56, 120, 60], pine: [50, 100, 70], snowpine: [80, 120, 100], hedge: [60, 120, 50], bld: [180, 90, 70], door: [240, 200, 120],
            path: [205, 170, 110], cobble: [190, 180, 160], sand: [236, 217, 160], snow: [238, 244, 250], moor: [140, 146, 96], stone: [168, 162, 148],
            farm: [140, 100, 64], crop: [120, 150, 60], bridge: [160, 110, 60], stonewall: [140, 136, 150], rock: [150, 145, 135],
            fog: [230, 236, 242], thorn: [60, 100, 40], boulder: [120, 112, 100], stream: [130, 190, 240], tiny: [90, 60, 40], sprout: [120, 200, 90],
            ghost: [200, 182, 255], rune: [224, 192, 96], chasm: [168, 196, 232], ice: [190, 226, 244],
        };
        for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
            const i = y * W.w + x;
            const z = ZONES[W.zoneOf[i]];
            const known = G.seen[z.id];
            let c;
            if (!known) c = [38, 30, 44];
            else {
                const name = TILE_NAME(W.t[i]);
                c = COL[name];
                if (!c) { const gp = GRASS[z.biome] || GRASS.village; const h = parseInt(gp[0].slice(1), 16); c = [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
            }
            img.data.set([c[0], c[1], c[2], 255], i * 4);
        }
        g.putImageData(img, 0, 0);
        // where you are, and where Wick wants to go
        const here = G.map === 'world' ? G.p : getWorld().maps[G.map].entrance;
        if (here) { g.fillStyle = '#ff4a4a'; g.fillRect(Math.floor(here.x) - 1, Math.floor(here.y) - 1, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(Math.floor(here.x), Math.floor(here.y), 1, 1); }
        const ob = objective(G);
        if (ob.map === 'world' && ob.x != null) { g.strokeStyle = '#ffd86b'; g.lineWidth = 1; g.strokeRect(ob.x - 2.5, ob.y - 3.5, 5, 5); }
        for (const k in W.warps) if (W.warps[k].to === 'library') { g.fillStyle = '#ffd86b'; g.fillRect(k % W.w - 1, Math.floor(k / W.w) - 1, 3, 2); }
        body.appendChild(cv);
        const z = G.map === 'world' ? ZONES[W.zoneOf[Math.floor(G.p.y) * W.w + Math.floor(G.p.x)]] : null;
        body.appendChild(el('p', '', `${z ? 'You are in <b>' + esc(z.name) + '</b>. ' : 'You are in <b>' + esc(getWorld().maps[G.map].name) + '</b>. '}The red dot is you; the gold square is where Wick is pointing; the gold bar is the Lantern Library.`));
    }

    // ------------------------------------------------------------------ shops
    openShop(G) { this.shopTabName = 'buy'; this.renderShop(G); this.openScreen('shop'); }
    shopTab(t) { this.shopTabName = t; this.renderShop(this.game.G); }
    renderShop(G) {
        if (!G.shop) return;
        const shop = SHOPS[G.shop.id];
        $('shop-title').textContent = shop.name;
        $('shop-coins').textContent = G.coins;
        for (const t of document.querySelectorAll('#shop-tabs .tab')) t.classList.toggle('on', t.dataset.tab === this.shopTabName);
        const body = $('shop-body');
        const keep = document.activeElement?.dataset?.id;
        body.innerHTML = '';
        const list = el('div', 'list');
        if (this.shopTabName === 'buy') {
            for (const id of shop.stock) {
                const it = ITEMS[id];
                const owned = count(G, id) + (Object.values(G.gear).includes(id) ? 1 : 0);
                const gearOwned = it.kind === 'gear' && owned;
                const r = this.itemRow(id, it.text + (owned ? `  (you have ${owned})` : ''), gearOwned ? 'Owned' : it.price + ' ◉', () => { if (!this.game.act({ type: 'buy', id })) this.audio.ui('deny'); });
                r.disabled = gearOwned || G.coins < it.price;
                list.appendChild(r);
            }
        } else {
            const ids = Object.keys(G.bag).filter((id) => ITEMS[id].kind !== 'key' && ITEMS[id].price);
            if (!ids.length) list.appendChild(el('p', '', 'Nothing to sell.'));
            for (const id of ids) list.appendChild(this.itemRow(id, `× ${G.bag[id]}`, sellPrice(id) + ' ◉', () => this.game.act({ type: 'sell', id })));
        }
        body.appendChild(list);
        if (keep) body.querySelector(`[data-id="${keep}"]`)?.focus({ preventScroll: true });
    }
}

const TILE_NAME = (id) => TILES[id].name;
