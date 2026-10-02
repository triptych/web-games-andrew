// DOM side of the game: page mounting, navigation with hotkeys, the vitals
// panel, the online list, commentary boxes, toasts, modals and drawers.

import { colorize, esc, strip } from '../colors.js';
import { fmt } from '../rng.js';
import * as S from './state.js';
import { SPECIALTIES } from '../data/classes.js';

export function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
}
export const $ = (s, r = document) => r.querySelector(s);

const DESKTOP = window.matchMedia('(min-width: 1100px)');

/** Render a label with its hotkey letter underlined. */
function labelWithKey(label, key) {
    const plain = strip(label);
    if (!key) return colorize(label);
    const i = plain.toLowerCase().indexOf(key.toLowerCase());
    if (i < 0 || /`/.test(label)) return `<kbd>${esc(key.toUpperCase())}</kbd> ${colorize(label)}`;
    return `${esc(plain.slice(0, i))}<u>${esc(plain[i])}</u>${esc(plain.slice(i + 1))}`;
}

export class UI {
    constructor() {
        this.pageEl = $('#page');
        this.pageScroll = $('#page-scroll');
        this.navCol = $('#navcol');
        this.keys = new Map();
        this.navEl = null;
        this.onKey = this.onKey.bind(this);
        document.addEventListener('keydown', this.onKey);
        DESKTOP.addEventListener('change', () => this.placeNav());
        this.toastsEl = $('#toasts');
        this.modalEl = $('#modal');
        this.modalStack = 0;
    }

    /** Mount a built page. page = { title, blocks:[Node], navs:[{section, items}], chatNode } */
    mount(page) {
        this.keys.clear();
        this.pageEl.replaceChildren();
        const head = h('header', { class: 'page-head' }, h('h1', { html: colorize(page.title) }));
        this.pageEl.append(head);
        const body = h('div', { class: 'page-body' }, page.blocks);
        this.pageEl.append(body);
        this.navEl = this.buildNav(page.navs);
        this.chatNode = page.chatNode || null;
        this.navSlot = h('div', { class: 'nav-slot' });
        this.pageEl.append(this.navSlot);
        if (this.chatNode) this.pageEl.append(this.chatNode);
        this.placeNav();
        if (!page.keepScroll) this.pageScroll.scrollTop = 0;
        $('#loc-banner').innerHTML = colorize(page.banner || page.title);
        $('#loc-banner').classList.remove('anim'); void $('#loc-banner').offsetWidth; $('#loc-banner').classList.add('anim');
    }

    placeNav() {
        if (!this.navEl) return;
        if (DESKTOP.matches) { this.navCol.replaceChildren(this.navEl); }
        else if (this.navSlot) { this.navSlot.replaceChildren(this.navEl); }
    }

    buildNav(sections) {
        const wrap = h('nav', { class: 'navlist', 'aria-label': 'Actions' });
        const used = new Set();
        // first pass: explicit keys
        for (const s of sections) for (const it of s.items) if (it.key) used.add(it.key.toLowerCase());
        for (const s of sections) {
            if (!s.items.length) continue;
            const sec = h('div', { class: 'navsec' });
            if (s.section) sec.append(h('div', { class: 'navhead', html: colorize(s.section) }));
            const grid = h('div', { class: 'navgrid' });
            for (const it of s.items) {
                let key = it.key;
                if (!key && !it.disabled) {
                    const plain = strip(it.label).toLowerCase();
                    for (const ch of plain) if (/[a-z0-9]/.test(ch) && !used.has(ch)) { key = ch; break; }
                    if (key) used.add(key);
                }
                const btn = h('button', {
                    type: 'button', class: 'navbtn' + (it.cls ? ' ' + it.cls : ''), disabled: !!it.disabled,
                    title: it.tip || null, 'data-key': key || null,
                    html: `<span class="nl">${labelWithKey(it.label, key)}</span>` + (it.badge != null ? `<span class="badge">${esc(it.badge)}</span>` : ''),
                    onclick: (e) => { e.preventDefault(); if (!it.disabled) this.fire(it); },
                });
                if (key && !it.disabled) this.keys.set(key.toLowerCase(), { it, btn });
                grid.append(btn);
            }
            sec.append(grid);
            wrap.append(sec);
        }
        return wrap;
    }

    fire(it) {
        if (this.busy) return;
        this.onNav?.(it);
    }

    onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (e.key === 'Escape') { if (this.closeTop()) e.preventDefault(); else if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) t.blur(); return; }
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (this.modalStack > 0 || document.body.classList.contains('drawer-open')) return;
        if ($('#title-screen') && !$('#title-screen').classList.contains('hidden')) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : null;
        if (!k) return;
        const hit = this.keys.get(k);
        if (hit) { e.preventDefault(); hit.btn.classList.add('pressed'); setTimeout(() => hit.btn.classList.remove('pressed'), 150); this.fire(hit.it); }
    }

    closeTop() {
        if (this.modalStack > 0) { this.closeModal(); return true; }
        if (document.body.classList.contains('drawer-open')) { this.closeDrawers(); return true; }
        return false;
    }

    // ---------------------------------------------------------- vitals
    renderVitals(p, w, extra = {}) {
        const el = $('#vitals');
        const mh = S.maxHp(p);
        const ne = S.nextExp(p);
        const prevE = p.level > 1 ? (p.level - 1 > 0 ? null : 0) : 0;
        const sp = SPECIALTIES[p.spec];
        const m = S.mount(p);
        const g = S.guild(p);
        const hpPct = Math.max(0, Math.min(100, (p.hp / mh) * 100));
        const xpPct = ne === Infinity ? 100 : Math.max(0, Math.min(100, (p.exp / ne) * 100));
        const spirits = ['Very Low', 'Low', 'Normal', 'High', 'Very High'][Math.max(0, Math.min(4, p.spirits + 2))];
        const row = (k, v, cls = '') => `<div class="vr ${cls}"><span class="vk">${k}</span><span class="vv">${v}</span></div>`;
        const buffs = p.buffs.length ? p.buffs.map((b) => `<li>${esc(b.name)}${b.rounds != null ? ` <small>(${b.rounds})</small>` : ''}</li>`).join('') : '<li class="dim">None</li>';
        el.innerHTML = `
            <div class="v-name">${colorize(S.coloredName(p))}</div>
            ${p.alive ? '' : '<div class="v-dead">☠ You are dead</div>'}
            <div class="vsec">Vital Info</div>
            ${row('Level', `<b>${p.level}</b>`)}
            <div class="vbar hp ${hpPct < 30 ? 'low' : ''}" title="Hit points"><i style="width:${hpPct}%"></i><span>${p.alive ? `${fmt(p.hp)} / ${fmt(mh)} HP` : `Soul: ${p.gravefights} torments`}</span></div>
            ${row('Forest fights', `<b>${p.turns}</b>`)}
            ${row('Spirits', spirits)}
            ${row('Attack', `${S.attack(p)}`)}
            ${row('Defence', `${S.defense(p)}`)}
            ${row('Gold', `<span class="c6b">${fmt(p.gold)}</span>`)}
            ${row('Gems', `<span class="c5b">${fmt(p.gems)}</span>`)}
            <div class="vbar xp" title="Experience"><i style="width:${xpPct}%"></i><span>${fmt(p.exp)} / ${ne === Infinity ? 'MAX' : fmt(ne)} XP</span></div>
            ${p.alive ? '' : row('Favour', `<b>${p.favor}</b>`)}
            <div class="vsec">Personal Info</div>
            ${row('Race', esc(S.race(p).name))}
            ${row('Specialty', `${esc(sp.name)} <small>(${p.specLevel})</small>`)}
            ${row('Skill uses', `${p.specUses} / ${S.maxSpecUses(p)}`)}
            ${row('Charm', p.charm)}
            ${row('Wyrm kills', p.dk)}
            ${row('PvP attacks', p.pvp)}
            ${row('Weapon', `${esc(S.weaponLabel(p))} <small>(${p.weapon})</small>`)}
            ${row('Armour', `${esc(S.armorLabel(p))} <small>(${p.armor})</small>`)}
            ${m ? row('Mount', esc(m.name)) : ''}
            ${p.spouse ? row('Spouse', esc(extra.spouseName || p.spouse)) : ''}
            ${g ? row('Guild', `&lt;${esc(g.tag)}&gt;`) : ''}
            ${row('Bank', `${fmt(p.bank)}`)}
            <div class="vsec">Buffs</div>
            <ul class="buffs">${buffs}</ul>
            <div class="vclock">Day ${p.day} · <span id="v-clock">${extra.clock || ''}</span></div>
        `;
        // mobile bar
        $('#mb-hp i').style.width = hpPct + '%';
        $('#mb-hp span').textContent = p.alive ? `${p.hp}/${mh}` : 'dead';
        $('#mb-gold').textContent = fmt(p.gold);
        $('#mb-gems').textContent = fmt(p.gems);
        $('#mb-turns').textContent = p.turns;
        $('#mb-level').textContent = 'Lv ' + p.level;
    }

    renderOnline(list, onPick) {
        const el = $('#online');
        el.replaceChildren(
            h('div', { class: 'vsec' }, `Warriors Online (${list.length})`),
            h('ul', { class: 'onl' }, list.slice().sort((a, b) => b.dk - a.dk || b.level - a.level).map((n) =>
                h('li', {}, h('button', { type: 'button', class: 'onl-btn', onclick: () => onPick(n) },
                    h('span', { class: 'dot ' + (n.alive ? '' : 'dead') }),
                    h('span', { class: 'onl-name', html: colorize(`${n.color}${n.name}`) }),
                    h('small', {}, `${n.level}${n.dk ? ' ★' + n.dk : ''} · ${n.loc}`))))),
        );
    }

    // ---------------------------------------------------------- commentary
    chatBox(channel, title, opts = {}) {
        const box = h('section', { class: 'chat', 'data-channel': channel },
            h('div', { class: 'chat-head' }, h('span', { html: colorize(title) }), h('small', { class: 'chat-here' })),
            h('ol', { class: 'chat-log', 'aria-live': 'polite' }),
        );
        if (opts.canPost) {
            const input = h('input', { type: 'text', maxlength: 200, placeholder: opts.placeholder || 'Add to the conversation… (try `@colour codes or :emotes)', 'aria-label': 'Say something', enterkeyhint: 'send' });
            const send = () => { const v = input.value.trim(); if (v) { opts.onPost(v); input.value = ''; } };
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
            box.append(h('div', { class: 'chat-form' }, input, h('button', { type: 'button', class: 'btn', onclick: send }, 'Say')));
        } else if (opts.note) box.append(h('div', { class: 'chat-note', html: colorize(opts.note) }));
        return box;
    }

    fillChat(box, entries, meName, hereText) {
        if (!box) return;
        const log = box.querySelector('.chat-log');
        const atBottom = true;
        log.replaceChildren(...entries.slice(-25).map((e) => this.chatEntry(e, meName)));
        if (hereText != null) box.querySelector('.chat-here').textContent = hereText;
        if (atBottom) log.scrollTop = log.scrollHeight;
    }

    chatEntry(e, meName) {
        const tag = e.tag ? `<span class="ctag">&lt;${esc(e.tag)}&gt;</span> ` : '';
        const name = `<span class="cname">${colorize((e.color || '`%') + e.who)}</span>`;
        const text = colorize(e.text);
        const mine = e.who === meName ? ' mine' : '';
        const html = e.sys ? `<span class="csys">${text}</span>` : e.emote ? `${tag}${name} <span class="cemote">${text}</span>` : `${tag}${name} <span class="csays">says,</span> “<span class="ctext">${text}</span>”`;
        const li = h('li', { class: 'cl new' + mine, html, title: new Date(e.t).toLocaleTimeString() });
        setTimeout(() => li.classList.remove('new'), 600);
        return li;
    }

    // ---------------------------------------------------------- toasts & modals
    toast(text, icon = '✦', kind = '') {
        const t = h('div', { class: 'toast ' + kind, role: 'status' }, h('span', { class: 'ti' }, icon), h('span', { html: colorize(text) }));
        this.toastsEl.append(t);
        setTimeout(() => t.classList.add('out'), 3800);
        setTimeout(() => t.remove(), 4400);
        while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
    }

    modal({ title, body, buttons = [{ label: 'Close' }], wide = false, cls = '' }) {
        return new Promise((resolve) => {
            this.modalStack++;
            const card = h('div', { class: 'modal-card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': strip(title) });
            const close = (v) => {
                this.modalStack = Math.max(0, this.modalStack - 1);
                layer.remove();
                if (!this.modalStack) this.modalEl.classList.add('hidden');
                resolve(v);
            };
            const layer = h('div', { class: 'modal-layer', onclick: (e) => { if (e.target === layer) close(null); } }, card);
            card.append(h('h2', { html: colorize(title) }));
            const b = h('div', { class: 'modal-body' });
            if (typeof body === 'string') b.innerHTML = colorize(body); else if (body) b.append(body);
            card.append(b);
            const row = h('div', { class: 'modal-btns' });
            for (const bt of buttons) row.append(h('button', { type: 'button', class: 'btn' + (bt.cls ? ' ' + bt.cls : ''), onclick: () => close(bt.value ?? bt.label) }, bt.label));
            card.append(row);
            layer._close = close;
            this.modalEl.append(layer);
            this.modalEl.classList.remove('hidden');
            setTimeout(() => (card.querySelector('input,textarea') || row.lastChild)?.focus(), 30);
        });
    }
    closeModal() {
        const layers = this.modalEl.querySelectorAll('.modal-layer');
        const top = layers[layers.length - 1];
        if (top && top._close) top._close(null);
    }
    async confirm(title, text, yes = 'Yes', no = 'Cancel') {
        const r = await this.modal({ title, body: text, buttons: [{ label: no, value: false }, { label: yes, value: true, cls: 'primary' }] });
        return r === true;
    }

    // ---------------------------------------------------------- drawers (phones)
    openDrawer(id) {
        this.closeDrawers();
        document.body.classList.add('drawer-open');
        $('#side').dataset.tab = id;
        $('#side').classList.add('open');
        $('#scrim').classList.remove('hidden');
    }
    closeDrawers() {
        document.body.classList.remove('drawer-open');
        $('#side').classList.remove('open');
        $('#scrim').classList.add('hidden');
    }

    setMailBadge(n) {
        for (const el of document.querySelectorAll('.mail-badge')) { el.textContent = n; el.classList.toggle('hidden', !n); }
    }
}
