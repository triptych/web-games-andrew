// The DOM layer: the HUD, the dock, every sheet, toasts and story beats. It reads the sim and sends commands through
// `cmd`; it never changes G itself.

import { VERSION, DAY, SHOP, ECON } from './config.js';
import {
    KINDS, KIND_IDS, RARITY, VIRTUES, VIRTUE_IDS, SKILLS, MATERIALS, MATERIAL_IDS, MASTERWORK, FURNITURE, FURNITURE_IDS,
    FOLK, HEROES, HERO_IDS, PLACES, PLACE_IDS, INSPIRATIONS, CHAPTERS, VELLUM_TIPS,
} from './sim/data.js';
import {
    book, isFree, shelfBooks, section, cap, cell, cozy, priceOf, describeReq, candidates, heroPower, chanceOf, partySkills,
    placeOpen, heroAvailable, canUsePattern, craftPreview, upChance, hasMats, traderPrice, bindingLevel, chapterProgress,
    knows, visitorsToday, has,
} from './sim/game.js';
import { describe } from './sim/books.js';
import { coverThumb } from './view/covers.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (k === 'style') el.style.cssText = v;
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
}
const matIcon = (id) => {
    const i = MATERIALS[id].icon;
    return h('span', { class: 'mat', title: MATERIALS[id].name, style: `background-position:${-(i % 4) * 40}px ${-Math.floor(i / 4) * 40}px` });
};
const vchips = (stats) => Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([v, n]) => h('span', { class: 'vchip', style: `background:${VIRTUES[v].color}` }, `${VIRTUES[v].icon} ${n}`));
const rarity = (r) => h('span', { class: 'rar', style: `color:${RARITY[r].color}` }, RARITY[r].name);
const where = (G, b) => {
    if (!b.loc) return 'Back room';
    if (b.loc.adv) return `Carried by ${HEROES[b.loc.adv].name}`;
    if (b.loc.held) return 'In a customer\'s hands';
    return cell(G, b.loc.row, b.loc.slot)?.type === 'table' ? `On display table ${b.loc.slot + 1}` : `On shelf ${b.loc.slot + 1}`;
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, cmd, inspect, shelves3d, onClose }) {
        this.audio = audio;
        this.settings = settings;
        this.cmd = cmd;
        this.inspect = inspect;
        this.shelves3d = shelves3d;
        this.onClose = onClose;
        this.stack = [];
        this.dialogs = [];
        this.bookFilter = 'all';
        this.binderyTab = 'craft';
        this.townTab = 'town';
        this.recipe = { kind: 'cookbook', cover: null, ink: null, accents: [] };
        this.party = [];
        this.place = null;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeScreen(b.closest('.screen').id); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; calm.checked = !!settings.calm;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, calm: calm.checked }); onSettings(settings); };
        for (const el of [sfx, music, voice, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        $('books-tabs').addEventListener('click', (e) => { const p = e.target.closest('[data-f]'); if (!p) return; this.bookFilter = p.dataset.f; this.audio.ui('click'); this.refresh(); });
        $('bindery-tabs').addEventListener('click', (e) => { const p = e.target.closest('[data-b]'); if (!p) return; this.binderyTab = p.dataset.b; this.audio.ui('click'); this.refresh(); });
        $('town-tabs').addEventListener('click', (e) => { const p = e.target.closest('[data-t]'); if (!p) return; this.townTab = p.dataset.t; this.audio.ui('click'); this.refresh(); });
        $('story-next').addEventListener('click', () => this._nextDialog());
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack in the order they were opened, not page order
        el.style.zIndex = 50 + this.stack.length;
        this.focusFirst(id);
    }
    closeScreen(id) {
        const el = $(id);
        if (!el || el.hidden) return;
        el.hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.onClose?.(id);
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll(except = []) { for (const id of [...this.stack]) if (!except.includes(id)) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    isOpen(id) { return this.stack.includes(id); }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { const foot = $(id).querySelector('.sheet-foot .primary') || this.buttons(id)[0]; foot?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text) {
        const el = h('div', { class: 'toast' }, text);
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 3300);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }
    caption(text, secs = 4) {
        const c = $('caption');
        c.textContent = text;
        c.hidden = false;
        clearTimeout(this.capT);
        this.capT = setTimeout(() => { c.hidden = true; }, secs * 1000);
    }
    tip(text) { const t = $('tip'); t.textContent = text || ''; t.hidden = !text; }

    // ------------------------------------------------------------------ story beats
    /** Queue a beat: { por, name, text, voice, art, then }. Beats show one after another. */
    say(beat) {
        this.dialogs.push(beat);
        if (!this.isOpen('story')) this._nextDialog();
    }
    _nextDialog() {
        const prev = this.curDialog;
        this.curDialog = null;
        prev?.after?.();
        const d = this.dialogs.shift();
        if (!d) { this.audio.hush(); this.closeScreen('story'); return; }
        this.curDialog = d;
        $('story-por').src = d.por || 'art/por-vellum.webp';
        $('story-por').alt = d.name || '';
        $('story-name').textContent = d.name || 'Old Vellum';
        $('story-text').textContent = d.text;
        const art = $('story-art');
        art.hidden = !d.art;
        if (d.art) art.style.backgroundImage = `url(${d.art})`;
        $('story-next').textContent = this.dialogs.length ? 'Next ›' : (d.button || 'Continue');
        if (!this.isOpen('story')) { this.audio.ui('open'); this.openScreen('story'); } else this.focusFirst('story');
        if (d.voice) this.audio.say(d.voice, null, { force: true });
        d.then?.();
    }
    get talking() { return this.isOpen('story') || this.dialogs.length > 0; }

    // ------------------------------------------------------------------ HUD, ribbon, dock
    hud(G) {
        $('hud-day').textContent = `Day ${G.day}`;
        const hour = DAY.open + (DAY.close - DAY.open) * Math.min(1, G.clock / DAY.seconds);
        const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
        $('hud-phase').textContent = G.phase === 'open' ? `Open · ${hh}:${String(mm).padStart(2, '0')}` : G.phase === 'morning' ? 'Morning' : 'Evening';
        $('hud-clock-wrap').hidden = G.phase !== 'open';
        $('hud-clock').style.width = `${Math.min(100, G.clock / DAY.seconds * 100)}%`;
        $('hud-gold').textContent = G.gold;
        $('hud-renown').textContent = Math.floor(G.renown);
        $('hud-cozy').textContent = cozy(G);
        $('btn-speed').hidden = G.phase !== 'open';
        const waiting = G.customers.filter((c) => c.state === 'ask' && c.want).length;
        $('btn-waiting').hidden = !waiting;
        $('waiting-n').textContent = waiting;
    }
    goal(G) {
        const p = chapterProgress(G);
        const g = $('goal');
        if (!p) {
            $('goal-ch').textContent = 'The Shop';
            $('goal-text').textContent = `Larkspur reads on. ${G.inspired.length}/10 inspirations · ${G.stats.sold} books sold`;
            g.classList.remove('done');
            return;
        }
        $('goal-ch').textContent = `Ch. ${p.ch.n}`;
        $('goal-text').textContent = `${p.ch.name}: ${p.ch.goal} (${p.n}/${p.ch.target})`;
    }
    dock(G) {
        const open = G.phase === 'open';
        const main = $('btn-main');
        main.textContent = G.phase === 'morning' ? 'Open ☀️' : open ? 'Close 🌙' : 'Sleep 🌙';
        main.classList.toggle('primary', !open);
        $('tab-bindery').classList.toggle('locked', !G.flags.bindery);
        $('tab-heroes').classList.toggle('locked', !G.flags.exp);
        $('tab-trader').hidden = !G.trader;
        $('badge-books').hidden = !G.books.some((b) => !b.loc && !b.masterwork) || open;
        $('badge-heroes').hidden = !(G.flags.exp && HERO_IDS.some((hId) => G.heroes[hId].hired && !G.heroes[hId].away)) || open;
        $('badge-town').hidden = !G.commissions.some((c) => candidates(G, c.req).length);
    }

    /** Re-render whatever sheet is showing (after a command or an event). */
    refresh(G = this.G) {
        this.G = G;
        if (!G) return;
        const top = this.stack;
        if (top.includes('books')) this.renderBooks(G);
        if (top.includes('column')) this.renderColumn(G);
        if (top.includes('furniture')) this.renderFurniture(G);
        if (top.includes('bindery')) this.renderBindery(G);
        if (top.includes('heroes')) this.renderHeroes(G);
        if (top.includes('town')) this.renderTown(G);
        if (top.includes('trader')) this.renderTrader(G);
        if (top.includes('serve')) this.renderServe(G);
        if (top.includes('evening')) this.renderEvening(G);
        if (top.includes('picker') && this.pick) this.renderPicker(G);
    }

    bookCard(G, b, acts = [], { note = null } = {}) {
        const cover = h('img', { class: 'cover', src: coverThumb(b), alt: `Cover of ${b.title}`, on: { click: () => this.inspect(b.id) } });
        const tags = [];
        if (b.skill) tags.push(h('span', { class: 'tag', title: SKILLS[b.skill].desc }, `🎓 ${SKILLS[b.skill].name}`));
        if (b.talk) tags.push(h('span', { class: 'tag' }, '💬 talks'));
        if (b.read) tags.push(h('span', { class: 'tag' }, '✓ read'));
        if (b.crafted) tags.push(h('span', { class: 'tag' }, '🔨 bound by Tam'));
        return h('div', { class: 'card' + (b.loc && b.loc.adv ? ' dim' : '') },
            cover,
            h('div', { class: 'info' },
                h('div', { class: 't' }, b.title, b.plus ? ` +${b.plus}` : ''),
                h('div', { class: 's' }, rarity(b.rarity), ` ${KINDS[b.kind].icon} ${KINDS[b.kind].name} · ${b.value} 🪙 · ${where(G, b)}`),
                h('div', {}, vchips(b.stats), tags),
                note ? h('div', { class: 's' }, note) : null),
            h('div', { class: 'acts' }, acts));
    }

    // ------------------------------------------------------------------ the library
    openBooks(G) { this.G = G; this.renderBooks(G); this.openScreen('books'); }
    renderBooks(G) {
        for (const p of $('books-tabs').children) p.classList.toggle('on', p.dataset.f === this.bookFilter);
        const f = this.bookFilter;
        const list = G.books.filter((b) => f === 'all' || (f === 'back' && !b.loc) || (f === 'shelf' && b.loc?.row) || (f === 'carried' && b.loc?.adv));
        list.sort((a, b) => (!!a.loc - !!b.loc) || a.kind.localeCompare(b.kind) || b.rarity - a.rarity);
        $('books-count').textContent = `${G.books.length} owned · ${G.books.filter((b) => b.loc?.row).length} on display`;
        const box = $('books-list');
        box.replaceChildren();
        if (!list.length) box.append(h('p', { class: 'hint' }, f === 'back' ? 'The back room is empty. Every book is out on display.' : 'No books here yet.'));
        for (const b of list) {
            const acts = [];
            if (!b.masterwork) {
                if (!b.loc) acts.push(h('button', { class: 'btn small', on: { click: () => this.shelveBook(G, b) } }, 'Shelve'));
                if (b.loc?.row) acts.push(h('button', { class: 'btn small', on: { click: () => this.cmd({ t: 'unshelve', book: b.id }) } }, 'Take down'));
            }
            if (G.phase === 'evening' && !b.read && !G.player.readToday) acts.push(h('button', { class: 'btn small primary', on: { click: () => this.cmd({ t: 'read', book: b.id }) } }, 'Read'));
            if (b.talk) acts.push(h('button', { class: 'btn small', on: { click: () => this.cmd({ t: 'talk', book: b.id }) } }, '💬'));
            box.append(this.bookCard(G, b, acts));
        }
        $('btn-autoshelve').onclick = () => this.cmd({ t: 'autoShelve' });
        $('btn-books3d').onclick = () => this.shelves3d();
    }
    /** Choose a shelf or table with room for a book. */
    shelveBook(G, b) {
        const opts = [];
        for (const row of ['wall', 'floor']) for (let s = 0; s < G.shop.width; s++) {
            const k = cap(G, row, s);
            if (!k) continue;
            const n = shelfBooks(G, row, s).filter(Boolean).length;
            if (n < k) opts.push({ row, s, n, k, type: cell(G, row, s).type, sec: section(G, row, s) });
        }
        if (!opts.length) { this.audio.ui('nope'); this.toast('Every shelf is full. Buy a bookshelf in Furnish.'); return; }
        // prefer the shelf whose section matches
        opts.sort((a, c) => (c.sec === b.kind) - (a.sec === b.kind) || a.n - c.n);
        if (opts.length === 1 || opts[0].sec === b.kind) { this.cmd({ t: 'shelve', book: b.id, row: opts[0].row, slot: opts[0].s }); return; }
        this.pickFrom({
            title: `Where should “${b.title}” go?`,
            note: 'Four of one kind on a shelf make a section.',
            items: opts.map((o) => h('div', { class: 'card' },
                h('div', { class: 'info' }, h('div', { class: 't' }, `${FURNITURE[o.type].name} ${o.s + 1}`), h('div', { class: 's' }, `${o.n}/${o.k} books${o.sec ? ` · ${KINDS[o.sec].name} section` : ''}`)),
                h('button', { class: 'btn small primary', on: { click: () => { this.closeScreen('picker'); this.cmd({ t: 'shelve', book: b.id, row: o.row, slot: o.s }); } } }, 'Here'))),
        });
    }

    // ------------------------------------------------------------------ a picker of books (or anything)
    /** pickBook({ title, note, books, label, onPick }) shows book cards with one action each. */
    pickBook(G, opts) { this.pick = { ...opts, kind: 'books' }; this.renderPicker(G); this.openScreen('picker'); }
    pickFrom(opts) { this.pick = { ...opts, kind: 'items' }; this.renderPicker(this.G); this.openScreen('picker'); }
    renderPicker(G) {
        const p = this.pick;
        $('picker-head').textContent = p.title;
        $('picker-note').textContent = p.note || '';
        const box = $('picker-list');
        box.replaceChildren();
        if (p.kind === 'items') { box.append(...p.items); return; }
        const books = typeof p.books === 'function' ? p.books(G) : p.books;
        if (!books.length) box.append(h('p', { class: 'hint' }, p.empty || 'No book fits.'));
        for (const b of books) {
            box.append(this.bookCard(G, b, [h('button', { class: 'btn small primary', on: { click: () => { this.closeScreen('picker'); p.onPick(b); } } }, p.label || 'Choose')], { note: p.note2?.(b) }));
        }
    }

    // ------------------------------------------------------------------ one column of the shop
    openColumn(G, slot) { this.G = G; this.col = slot; this.renderColumn(G); this.openScreen('column'); }
    renderColumn(G) {
        const s = this.col;
        const open = G.phase === 'open';
        $('column-head').textContent = `Spot ${s + 1}`;
        const body = $('column-body');
        body.replaceChildren();
        if (open) body.append(h('p', { class: 'hint' }, 'The shop is open: you can restock shelves, but furniture stays put until closing.'));
        for (const row of ['wall', 'floor']) {
            const c = cell(G, row, s);
            body.append(h('h3', {}, row === 'wall' ? 'On the wall' : 'On the floor'));
            if (!c) {
                const stored = FURNITURE_IDS.filter((t) => FURNITURE[t].row === row && G.stored[t] > 0);
                if (!stored.length) body.append(h('p', { class: 'hint' }, `Nothing to put here. ${row === 'wall' ? 'Shelves, paintings and ivy' : 'Tables, armchairs, lamps, ferns and cats'} can be bought in Furnish.`),
                    h('button', { class: 'btn small', on: { click: () => { this.closeScreen('column'); this.openFurniture(G); } } }, '🪑 Furnish'));
                else body.append(h('div', { class: 'grid' }, stored.map((t) => h('div', { class: 'fcard' },
                    h('img', { src: `art/furn-${t}.webp`, alt: '' }), h('div', { class: 't' }, `${FURNITURE[t].name} ×${G.stored[t]}`),
                    h('button', { class: 'btn small primary', disabled: open || null, on: { click: () => this.cmd({ t: 'place', type: t, row, slot: s }) } }, 'Place here')))));
                continue;
            }
            const F = FURNITURE[c.type];
            const moves = [];
            if (s > 0) moves.push(h('button', { class: 'btn small', disabled: open || null, 'aria-label': 'Move left', on: { click: () => { this.col = s - 1; this.cmd({ t: 'move', row, from: s, to: s - 1 }); } } }, '◀ Move'));
            if (s < G.shop.width - 1) moves.push(h('button', { class: 'btn small', disabled: open || null, 'aria-label': 'Move right', on: { click: () => { this.col = s + 1; this.cmd({ t: 'move', row, from: s, to: s + 1 }); } } }, 'Move ▶'));
            moves.push(h('button', { class: 'btn small', disabled: open || null, on: { click: () => this.cmd({ t: 'pickup', row, slot: s }) } }, 'Put away'));
            body.append(h('div', { class: 'card' }, h('img', { class: 'cover', style: 'object-fit:contain;box-shadow:none', src: `art/furn-${c.type}.webp`, alt: '' }),
                h('div', { class: 'info' }, h('div', { class: 't' }, F.name), h('div', { class: 's' }, F.desc), F.cap ? h('div', { class: 's' }, `Appeal ×${(1 + (section(G, row, s) ? 0.6 : 0)).toFixed(1)}${section(G, row, s) ? ` · ${KINDS[section(G, row, s)].name} section` : ''}`) : null),
                h('div', { class: 'acts' }, moves)));
            if (F.cap) {
                const on = shelfBooks(G, row, s);
                const n = on.filter(Boolean).length;
                body.append(h('div', { class: 'row-actions' },
                    h('button', { class: 'btn small primary', disabled: n >= F.cap || null, on: { click: () => this.pickBook(G, {
                        title: `Add a book to ${F.name.toLowerCase()} ${s + 1}`, note: `${n}/${F.cap} books`, label: 'Shelve',
                        books: (g) => g.books.filter((b) => !b.loc && !b.masterwork).sort((a, c) => (c.kind === section(g, row, s)) - (a.kind === section(g, row, s)) || c.value - a.value),
                        empty: 'The back room is empty.', onPick: (b) => this.cmd({ t: 'shelve', book: b.id, row, slot: s }),
                    }) } }, `＋ Add a book (${n}/${F.cap})`)));
                for (const b of on.filter(Boolean)) body.append(this.bookCard(G, b, [h('button', { class: 'btn small', on: { click: () => this.cmd({ t: 'unshelve', book: b.id }) } }, 'Take down')]));
            }
        }
    }

    // ------------------------------------------------------------------ furniture shop
    openFurniture(G) { this.G = G; this.renderFurniture(G); this.openScreen('furniture'); }
    renderFurniture(G) {
        const box = $('furniture-list');
        box.replaceChildren();
        const placed = (t) => ['wall', 'floor'].reduce((n, r) => n + G.shop[r].filter((x) => x && x.type === t).length, 0);
        for (const t of FURNITURE_IDS) {
            const F = FURNITURE[t];
            const own = placed(t) + (G.stored[t] || 0);
            const can = G.gold >= F.cost && !(F.unique && own) && G.phase !== 'open';
            box.append(h('div', { class: 'fcard' },
                h('img', { src: `art/furn-${t}.webp`, alt: '' }),
                h('div', { class: 't' }, F.name),
                h('div', { class: 's' }, F.desc),
                h('div', { class: 's' }, `${F.row === 'wall' ? 'Wall' : 'Floor'} · cozy +${F.cozy}${own ? ` · own ${own}${G.stored[t] ? ` (${G.stored[t]} unplaced)` : ''}` : ''}`),
                h('button', { class: 'btn small primary', disabled: !can || null, on: { click: () => {
                    if (this.cmd({ t: 'buyFurniture', type: t }).ok) { this.toast(`Bought a ${F.name.toLowerCase()}. Tap a ＋ in the shop to place it.`); this.closeScreen('furniture'); this.onBought?.(t); }
                } } }, F.unique && own ? 'Have one' : `Buy · ${F.cost} 🪙`)));
        }
        const i = SHOP.widths.indexOf(G.shop.width);
        const eb = $('expand-box');
        eb.replaceChildren(h('h3', {}, 'Renovate'));
        if (i >= 0 && i < SHOP.expand.length) eb.append(h('div', { class: 'card' }, h('div', { class: 'info' }, h('div', { class: 't' }, `Knock through to the next room`), h('div', { class: 's' }, `${G.shop.width} → ${G.shop.width + 2} spots on the wall and floor.`)),
            h('button', { class: 'btn small primary', disabled: G.gold < SHOP.expand[i] || G.phase === 'open' || null, on: { click: () => this.cmd({ t: 'expand' }) } }, `${SHOP.expand[i]} 🪙`)));
        else eb.append(h('p', { class: 'hint' }, 'The shop is as big as the building allows. It is perfect.'));
    }

    // ------------------------------------------------------------------ the bindery
    openBindery(G) {
        this.G = G;
        if (!G.flags.bindery) { this.audio.ui('nope'); this.toast('The bindery is still asleep. Old Vellum will wake it soon.'); return; }
        this.renderBindery(G); this.openScreen('bindery');
    }
    renderBindery(G) {
        for (const p of $('bindery-tabs').children) p.classList.toggle('on', p.dataset.b === this.binderyTab);
        $('binding-lv').textContent = `· Binding Lv ${bindingLevel(G)}`;
        const body = $('bindery-body');
        body.replaceChildren();
        const open = G.phase === 'open';
        if (open) body.append(h('p', { class: 'hint' }, 'The press is cold while the shop is open. Bind books in the morning or the evening.'));
        if (this.binderyTab === 'rebind') return this._rebind(G, body, open);
        // the masterwork
        if (G.story.ch >= 7 && !G.stats.masterwork) {
            const need = [MASTERWORK.cover, MASTERWORK.ink, ...MASTERWORK.accents];
            body.append(h('div', { class: 'preview' }, h('h3', { style: 'margin-top:0' }, '✨ The Book of Larkspur'),
                h('p', {}, 'Elowen\'s last story, waiting to be bound.'),
                h('div', { class: 'slot-row' }, need.map((m) => h('div', { class: 'mslot' + ((G.mats[m] || 0) > 0 ? ' on' : '') }, matIcon(m), h('small', {}, MATERIALS[m].name), h('b', {}, `×${G.mats[m] || 0}`)))),
                h('button', { class: 'btn primary', disabled: !hasMats(G, need) || open || null, on: { click: () => this.cmd({ t: 'craft', masterwork: true }) } }, 'Bind the Book of Larkspur')));
        }
        const R = this.recipe;
        if (!canUsePattern(G, R.kind)) R.kind = G.patterns[0];
        body.append(h('h3', {}, '1 · Pattern'));
        body.append(h('div', { class: 'slot-row' }, KIND_IDS.map((k) => {
            const okk = canUsePattern(G, k);
            return h('button', { class: 'mslot' + (R.kind === k ? ' on' : ''), disabled: !okk || null, title: okk ? KINDS[k].name : 'Not learned yet', on: { click: () => { R.kind = k; this.audio.ui('click'); this.refresh(); } } },
                h('span', { style: 'font-size:24px' }, okk ? KINDS[k].icon : '🔒'), h('small', {}, KINDS[k].name));
        })));
        const slots = (type, key, multi = false) => MATERIAL_IDS.filter((m) => MATERIALS[m].type === type).map((m) => {
            const n = G.mats[m] || 0;
            const on = multi ? R.accents.includes(m) : R[key] === m;
            return h('button', { class: 'mslot' + (on ? ' on' : ''), disabled: (!n && !on) || null, title: MATERIALS[m].desc || MATERIALS[m].name, on: { click: () => {
                if (multi) R.accents = on ? R.accents.filter((a) => a !== m) : [...R.accents, m].slice(-2);
                else R[key] = on ? null : m;
                this.audio.ui('click'); this.refresh();
            } } }, matIcon(m), h('small', {}, MATERIALS[m].name), h('b', {}, `×${n}`));
        });
        body.append(h('h3', {}, '2 · Cover', h('small', { class: 'hint' }, ' sets the rarity')), h('div', { class: 'slot-row' }, slots('cover', 'cover')));
        body.append(h('h3', {}, '3 · Ink', h('small', { class: 'hint' }, ' sets its main virtue')), h('div', { class: 'slot-row' }, slots('ink', 'ink')));
        body.append(h('h3', {}, '4 · Accents', h('small', { class: 'hint' }, ' up to two')), h('div', { class: 'slot-row' }, slots('accent', 'accents', true)));
        for (const k of ['cover', 'ink']) if (R[k] && !(G.mats[R[k]] > 0)) R[k] = null;
        R.accents = R.accents.filter((a) => G.mats[a] > 0);
        const ready = R.cover && R.ink;
        const prev = h('div', { class: 'preview' });
        if (ready) {
            const p = craftPreview(G, R);
            const v = MATERIALS[R.ink].virtue;
            prev.append(h('div', {}, h('b', {}, `${KINDS[R.kind].icon} ${KINDS[R.kind].name}`), ' · ', rarity(p.lo), p.hi > p.lo ? [' → ', rarity(p.hi), ` (${Math.round(p.chance * 100)}% a step)`] : ''),
                h('div', { class: 's' }, `Main virtue: ${VIRTUES[v].icon} ${VIRTUES[v].name}. ${R.accents.map((a) => MATERIALS[a].desc).join(' ')}`));
        } else prev.append(h('span', { class: 'hint' }, 'Choose a cover and an ink.'));
        body.append(prev, h('button', { class: 'btn primary', disabled: !ready || open || null, on: { click: () => this.cmd({ t: 'craft', kind: R.kind, cover: R.cover, ink: R.ink, accents: R.accents }) } }, '🔨 Bind!'));
    }
    _rebind(G, body, open) {
        body.append(h('p', { class: 'hint' }, `Like tempering a blade: +1 to every virtue, up to +3. Costs a Silver Thread (you have ${G.mats.thread || 0})${knows(G, 'gilding') ? '' : ` and ${ECON.rebindGold} 🪙 × the new level`}.`));
        const list = G.books.filter((b) => !b.masterwork && b.plus < 3 && !(b.loc && b.loc.held)).sort((a, c) => c.value - a.value);
        for (const b of list) {
            const gold = knows(G, 'gilding') ? 0 : ECON.rebindGold * (b.plus + 1);
            body.append(this.bookCard(G, b, [h('button', { class: 'btn small primary', disabled: open || !(G.mats.thread > 0) || G.gold < gold || null, on: { click: () => this.cmd({ t: 'rebind', book: b.id }) } }, `+${b.plus + 1} · ${gold} 🪙`)]));
        }
    }

    // ------------------------------------------------------------------ adventurers
    openHeroes(G) {
        this.G = G;
        if (!G.flags.exp) { this.audio.ui('nope'); this.toast('No adventurers yet. Sell a few books first. Old Vellum knows someone.'); return; }
        this.renderHeroes(G); this.openScreen('heroes');
    }
    renderHeroes(G) {
        const body = $('heroes-body');
        body.replaceChildren();
        const open = G.phase === 'open';
        this.party = this.party.filter((x) => G.heroes[x].hired && !G.heroes[x].away);
        if (this.place && !placeOpen(G, this.place)) this.place = null;
        body.append(h('h3', {}, 'Your adventurers'));
        for (const id of HERO_IDS.filter((x) => G.heroes[x].hired)) {
            const H = HEROES[id], st = G.heroes[id];
            const b = st.book ? book(G, st.book) : null;
            const sel = this.party.includes(id);
            const exp = st.away ? G.exps.find((e) => e.id === st.away) : null;
            const stats = ['valor', 'wit', 'wonder'].map((v) => h('span', { class: 'vchip', style: `background:${VIRTUES[v].color}` }, `${VIRTUES[v].icon} ${(H.stats[v] || 0) + (b ? b.stats[v] || 0 : 0)}`));
            body.append(h('div', { class: 'hero' + (sel ? ' sel' : '') },
                h('img', { src: `art/hero-${id}.webp`, alt: H.name }),
                h('div', { class: 'info', style: 'flex:1;min-width:0' },
                    h('div', { class: 't' }, h('b', {}, H.name), ` · ${H.role} · Lv ${st.lv}`),
                    h('div', { class: 'bar', style: 'margin:4px 0' }, h('i', { style: `width:${Math.min(100, st.xp / (10 * st.lv) * 100)}%;background:#7b5cc4` })),
                    h('div', {}, stats, H.skill ? h('span', { class: 'tag' }, `🎓 ${SKILLS[H.skill].name}`) : null),
                    h('div', { class: 's' }, b ? `Carrying “${b.title}”${b.skill && SKILLS[b.skill].who === 'adv' ? ` (🎓 ${SKILLS[b.skill].name})` : ''}` : 'Carrying no book.'),
                    exp ? h('div', { class: 's' }, `🧭 At ${PLACES[exp.place].name}. Home in ${exp.left} day${exp.left > 1 ? 's' : ''}.`) : null),
                h('div', { class: 'acts', style: 'flex-direction:column' },
                    !st.away ? h('button', { class: 'btn small' + (sel ? ' primary' : ''), disabled: open || null, on: { click: () => { this.party = sel ? this.party.filter((x) => x !== id) : [...this.party, id].slice(-3); this.audio.ui('click'); this.refresh(); } } }, sel ? '✓ In party' : 'Add to party') : null,
                    !st.away ? h('button', { class: 'btn small', on: { click: () => this.pickBook(G, {
                        title: `A book for ${H.name} to carry`, note: 'Its virtues become their courage; a skill book teaches them on the road.', label: 'Give',
                        books: (g) => g.books.filter((k) => isFree(k) && !k.masterwork).sort((a, c) => (this.place ? (c.stats[PLACES[this.place].virtues[0]] || 0) - (a.stats[PLACES[this.place].virtues[0]] || 0) : 0) || c.value - a.value),
                        note2: (k) => this.place ? `Power at ${PLACES[this.place].name}: ${heroPower(G, id, this.place).toFixed(1)} → ${previewPower(G, id, this.place, k).toFixed(1)}` : null,
                        onPick: (k) => this.cmd({ t: 'equip', hero: id, book: k.id }),
                    }) } }, b ? 'Change book' : 'Give a book') : null,
                    !st.away && b ? h('button', { class: 'btn small', on: { click: () => this.cmd({ t: 'equip', hero: id, book: null }) } }, 'Take it back') : null)));
        }
        const hire = HERO_IDS.filter((x) => heroAvailable(G, x));
        if (hire.length) {
            body.append(h('h3', {}, 'Looking for work'));
            for (const id of hire) {
                const H = HEROES[id];
                body.append(h('div', { class: 'hero' }, h('img', { src: `art/hero-${id}.webp`, alt: H.name }),
                    h('div', { class: 'info', style: 'flex:1' }, h('div', { class: 't' }, h('b', {}, H.name), ` · ${H.role}`), h('div', { class: 's' }, `“${H.line}”`), h('div', {}, ['valor', 'wit', 'wonder'].map((v) => h('span', { class: 'vchip', style: `background:${VIRTUES[v].color}` }, `${VIRTUES[v].icon} ${H.stats[v] || 0}`)), H.skill ? h('span', { class: 'tag' }, `🎓 ${SKILLS[H.skill].name}`) : null)),
                    h('button', { class: 'btn small primary', disabled: G.gold < H.hire || open || null, on: { click: () => this.cmd({ t: 'hire', hero: id }) } }, `Hire · ${H.hire} 🪙`)));
            }
        }
        body.append(h('h3', {}, 'Where to?'));
        const grid = h('div', { class: 'places' });
        for (const p of PLACE_IDS) {
            const P = PLACES[p];
            const okk = placeOpen(G, p);
            const lock = P.unlock.renown != null ? `Needs ${P.unlock.renown} renown` : 'Old Vellum hasn\'t told you about it yet';
            grid.append(h('button', { class: 'place' + (okk ? '' : ' locked') + (this.place === p ? ' sel' : ''), style: `background-image:url(art/place-${p}.webp)`, disabled: !okk || null, on: { click: () => { this.place = p; this.audio.ui('click'); this.refresh(); } } },
                h('div', { class: 't' }, P.name), h('div', { class: 's' }, okk ? `${P.blurb} · ${P.days} day${P.days > 1 ? 's' : ''} · needs ${P.need} power (${P.virtues.map((v) => VIRTUES[v].name).join(', ')})` : `🔒 ${lock}`)));
        }
        body.append(grid);
        if (this.place && this.party.length) {
            const P = PLACES[this.place];
            const ch = chanceOf(G, this.party, this.place);
            const days = Math.max(1, P.days - (partySkills(G, this.party).has('pathfinding') ? 1 : 0));
            body.append(h('div', { class: 'preview' },
                h('div', {}, h('b', {}, `${this.party.map((x) => HEROES[x].name).join(', ')} → ${P.name}`)),
                h('div', { class: 's' }, `Chance of a full haul: ${Math.round(ch * 100)}% · back in ${days} day${days > 1 ? 's' : ''}. Even a poor trip brings something home.`),
                h('div', { class: 's' }, `Might find: ${P.kinds.map((k) => KINDS[k].name).join(', ')} · `, [...new Set(P.mats)].map(matIcon)),
                h('button', { class: 'btn primary', disabled: open || null, on: { click: () => { if (this.cmd({ t: 'send', heroes: this.party, place: this.place }).ok) { this.party = []; } } } }, '🧭 Send them')));
        } else body.append(h('p', { class: 'hint' }, 'Choose a place and add one to three adventurers to the party.'));
    }

    // ------------------------------------------------------------------ the town
    openTown(G) { this.G = G; this.renderTown(G); this.openScreen('town'); }
    renderTown(G) {
        for (const p of $('town-tabs').children) p.classList.toggle('on', p.dataset.t === this.townTab);
        const body = $('town-body');
        body.replaceChildren();
        if (this.townTab === 'town') {
            body.append(h('p', { class: 'hint' }, 'Every book you sell pours its virtues into Larkspur. Wishes granted count double.'));
            for (const v of VIRTUE_IDS) {
                const n = G.town[v], max = 220;
                body.append(h('div', { style: 'margin:6px 0' }, h('div', { class: 'row', style: 'min-height:0' }, h('span', {}, `${VIRTUES[v].icon} ${VIRTUES[v].name}`), h('b', {}, Math.floor(n))),
                    h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, n / max * 100)}%;background:${VIRTUES[v].color}` }), h('b', { style: `left:${70 / max * 100}%` }), h('b', { style: `left:${200 / max * 100}%` }))));
            }
            const grid = h('div', { class: 'insp' });
            for (const I of INSPIRATIONS) {
                const done = G.inspired.includes(I.id);
                const art = ['guild', 'school', 'bakery', 'theatre', 'tower', 'garden'][I.art];
                grid.append(h('div', { class: 'icard' + (done ? '' : ' locked') }, h('div', { class: 'pic', style: `background-image:url(art/town-${art}.webp)` }),
                    h('div', { class: 't' }, done ? I.name : '???'), h('div', { class: 's' }, done ? I.text : `${VIRTUES[I.virtue].icon} ${Math.floor(G.town[I.virtue])}/${I.need} ${VIRTUES[I.virtue].name}`)));
            }
            body.append(h('h3', {}, `Inspirations ${G.inspired.length}/${INSPIRATIONS.length}`), grid);
        } else if (this.townTab === 'commissions') {
            body.append(h('p', { class: 'hint' }, `Wishes you promised to find. They pay ${ECON.commissionBonus}× a book's price. Up to ${SHOP.maxCommissions} at a time; nobody minds if one lapses.`));
            if (!G.commissions.length) body.append(h('p', { class: 'hint' }, 'No commissions. When a customer asks for something you don\'t have, take it as a commission.'));
            for (const c of G.commissions) {
                const fits = candidates(G, c.req);
                body.append(h('div', { class: 'card' }, h('img', { class: 'cover', style: 'object-fit:contain;box-shadow:none', src: `art/folk-${c.folk}.webp`, alt: '' }),
                    h('div', { class: 'info' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, `Wants ${describeReq(c.req)}, ${c.reason}. Until day ${c.until}.`)),
                    h('button', { class: 'btn small primary', disabled: !fits.length || null, on: { click: () => this.pickBook(G, {
                        title: `For ${c.name}`, note: `They want ${describeReq(c.req)}.`, label: 'Deliver', books: (g) => candidates(g, c.req),
                        note2: (b) => `Pays ${Math.round(priceOf(G, b, c.folk) * ECON.commissionBonus)} 🪙`,
                        onPick: (b) => this.cmd({ t: 'fulfill', com: c.id, book: b.id }),
                    }) } }, fits.length ? 'Deliver' : 'No book yet')));
            }
        } else {
            body.append(h('p', { class: 'hint' }, `${G.stats.sold} books sold, ${G.stats.earned} 🪙 earned, ${G.stats.requests} wishes granted.`));
            for (const l of G.ledger) body.append(h('div', { class: 'card', style: 'min-height:44px' }, h('div', { class: 'info' }, h('div', { class: 't' }, l.title), h('div', { class: 's' }, `Day ${l.day} · to a ${FOLK[l.folk]?.name.toLowerCase() || 'reader'}`)), h('b', {}, `${l.price} 🪙`)));
        }
    }

    // ------------------------------------------------------------------ the trader
    openTrader(G) { this.G = G; if (!G.trader) return; this.renderTrader(G); this.openScreen('trader'); }
    renderTrader(G) {
        const box = $('trader-list');
        box.replaceChildren();
        if (!G.trader) { box.append(h('p', { class: 'hint' }, 'Ottoline has moved on.')); return; }
        G.trader.stock.forEach((it, i) => {
            const p = traderPrice(G, it);
            const buy = h('button', { class: 'btn small primary', disabled: it.sold || G.gold < p || G.phase === 'open' || null, on: { click: () => this.cmd({ t: 'buy', i }) } }, it.sold ? 'Sold' : `${p} 🪙`);
            if (it.book) {
                const b = it.book;
                box.append(h('div', { class: 'card' + (it.sold ? ' dim' : '') }, h('img', { class: 'cover', src: coverThumb({ ...b, id: `t${i}-${b.seed}` }), alt: '', on: { click: () => this.inspect(b) } }),
                    h('div', { class: 'info' }, h('div', { class: 't' }, b.title), h('div', { class: 's' }, rarity(b.rarity), ` ${KINDS[b.kind].icon} ${KINDS[b.kind].name}`), h('div', {}, vchips(b.stats), b.skill ? h('span', { class: 'tag' }, `🎓 ${SKILLS[b.skill].name}`) : null, b.talk ? h('span', { class: 'tag' }, '💬 talks') : null)), buy));
            } else {
                box.append(h('div', { class: 'card' + (it.sold ? ' dim' : '') }, matIcon(it.mat), h('div', { class: 'info' }, h('div', { class: 't' }, `${MATERIALS[it.mat].name} ×${it.n}`), h('div', { class: 's' }, MATERIALS[it.mat].type === 'accent' ? MATERIALS[it.mat].desc : `A ${MATERIALS[it.mat].type} for the bindery. You have ${G.mats[it.mat] || 0}.`)), buy));
            }
        });
    }

    // ------------------------------------------------------------------ a wish at the counter
    openServe(G, custId) { this.G = G; this.serving = custId; this.renderServe(G); this.openScreen('serve'); }
    renderServe(G) {
        const cu = G.customers.find((c) => c.id === this.serving);
        if (!cu || !cu.want || cu.state === 'out') { this.closeScreen('serve'); return; }
        $('serve-por').src = `art/folk-${cu.folk}.webp`;
        $('serve-name').textContent = `${cu.name}, ${FOLK[cu.folk].name.toLowerCase()}`;
        $('serve-text').textContent = `“Do you have ${describeReq(cu.want)}? It's ${cu.reason}.”`;
        const box = $('serve-list');
        box.replaceChildren();
        const fits = candidates(G, cu.want);
        if (!fits.length) box.append(h('p', { class: 'hint' }, 'Nothing in the shop fits. Take it as a commission and find one later, from an expedition, Ottoline or the bindery.'));
        for (const b of fits.slice(0, 12)) {
            const p = Math.round(priceOf(G, b, cu.folk) * ECON.requestBonus);
            box.append(this.bookCard(G, b, [h('button', { class: 'btn small primary', on: { click: () => { if (this.cmd({ t: 'serve', cust: cu.id, book: b.id }).ok) this.closeScreen('serve'); } } }, `Give · ${p} 🪙`)]));
        }
        $('serve-commission').disabled = G.commissions.length >= SHOP.maxCommissions;
        $('serve-commission').textContent = G.commissions.length >= SHOP.maxCommissions ? 'Board full' : '📜 Commission';
        $('serve-commission').onclick = () => { if (this.cmd({ t: 'commission', cust: cu.id }).ok) { this.toast(`${cu.name}'s wish is on the commission board.`); this.closeScreen('serve'); } };
        $('serve-decline').onclick = () => { this.cmd({ t: 'decline', cust: cu.id }); this.closeScreen('serve'); };
    }

    // ------------------------------------------------------------------ the evening
    openEvening(G) { this.G = G; this.renderEvening(G); this.openScreen('evening'); }
    renderEvening(G) {
        const T = G.today || { visitors: 0, sold: 0, earned: 0, requests: 0 };
        $('evening-head').textContent = `Day ${G.day}: Closing Time`;
        const body = $('evening-body');
        body.replaceChildren(
            h('div', { class: 'stats', style: 'gap:8px;margin-bottom:6px' },
                h('span', { class: 'chip', style: 'color:var(--ink);border-color:#c9a873' }, `🚶 ${T.visitors} visitors`),
                h('span', { class: 'chip', style: 'color:var(--ink);border-color:#c9a873' }, `📕 ${T.sold} sold`),
                h('span', { class: 'chip', style: 'color:var(--ink);border-color:#c9a873' }, `🪙 +${T.earned}`),
                h('span', { class: 'chip', style: 'color:var(--ink);border-color:#c9a873' }, `💛 ${T.requests} wishes`)),
            h('p', { class: 'hint' }, `Old Vellum: “${VELLUM_TIPS[G.day % VELLUM_TIPS.length]}”`));
        const away = G.exps.map((e) => `${e.heroes.map((x) => HEROES[x].name).join(' & ')} (${PLACES[e.place].name}, ${e.left - 1 ? `${e.left - 1} more day${e.left - 1 > 1 ? 's' : ''}` : 'home tomorrow'})`);
        if (away.length) body.append(h('p', { class: 'hint' }, `🧭 Away: ${away.join('; ')}.`));
        if (G.flags.trader && (G.day + 1) % 3 === 0) body.append(h('p', { class: 'hint' }, '🧳 Ottoline\'s caravan is due tomorrow.'));
        body.append(h('h3', {}, G.player.readToday ? 'Tam read tonight' : 'Read one book tonight'));
        if (!G.player.readToday) {
            const unread = G.books.filter((b) => !b.read && !b.masterwork);
            const teach = (b) => b.skill && SKILLS[b.skill].who === 'player' && !knows(G, b.skill);
            unread.sort((a, b) => teach(b) - teach(a) || b.rarity - a.rarity);
            if (!unread.length) body.append(h('p', { class: 'hint' }, 'Tam has read everything in the shop. Twice.'));
            for (const b of unread.slice(0, 8)) body.append(this.bookCard(G, b, [h('button', { class: 'btn small primary', on: { click: () => this.cmd({ t: 'read', book: b.id }) } }, 'Read')], { note: teach(b) ? `Teaches Tam ${SKILLS[b.skill].name}: ${SKILLS[b.skill].desc}` : null }));
        }
        if (G.player.skills.length) body.append(h('p', { class: 'hint' }, `Tam knows: ${G.player.skills.map((s) => SKILLS[s].name).join(', ')}.`));
        body.append(h('p', { class: 'hint' }, `Tomorrow: about ${visitorsToday(G)} visitors.`));
    }

    // ------------------------------------------------------------------ an expedition comes home
    showLoot(G, e) {
        const P = PLACES[e.place];
        $('loot-art').style.backgroundImage = `url(art/place-${e.place}.webp)`;
        $('loot-head').textContent = e.win ? `${P.name}: a fine haul!` : `${P.name}: back with a little`;
        const body = $('loot-body');
        body.replaceChildren(h('p', {}, `${e.heroes.map((x) => HEROES[x].name).join(' and ')} ${e.win ? 'came home grinning' : 'came home soggy but cheerful'}. +${e.xp} experience each.${e.ups.length ? ` ${[...new Set(e.ups)].map((x) => HEROES[x].name).join(', ')} levelled up!` : ''}`));
        const mats = Object.entries(e.loot.mats);
        if (mats.length) body.append(h('div', { class: 'slot-row' }, mats.map(([m, n]) => h('div', { class: 'mslot' }, matIcon(m), h('small', {}, MATERIALS[m].name), h('b', {}, `×${n}`)))));
        for (const id of e.loot.books) { const b = book(G, id); if (b) body.append(this.bookCard(G, b, [])); }
        this.audio.ui('open');
        this.openScreen('loot');
    }
}

/** What a hero's power would be carrying another book (for the picker's note). Reads a copy; G is never touched. */
function previewPower(G, hid, place, b) {
    const G2 = { ...G, heroes: { ...G.heroes, [hid]: { ...G.heroes[hid], book: b.id } } };
    return heroPower(G2, hid, place);
}

export { h, matIcon, vchips, where };
