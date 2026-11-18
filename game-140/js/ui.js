// The DOM around the stage: the HUD, the ward-lock's words and buttons, the camp and the road map, the journal, the
// save slots, the log and the small screens. It reads G and sends commands through main.js; it never writes G.

import { SLOTS } from './config.js';
import { ART, CGS } from './assets.js';
import { CAST, COMPANIONS, portrait } from './sim/data/cast.js';
import { HUES, WARDS, WARD_ORDER, CHAPTERS, RUNE_HUE } from './sim/data/chapters.js';
import { CAMP_TOPIC } from './sim/data/camps.js';
import { LORE } from './sim/data/lore.js';
import { evalCond } from './sim/rules.js';
import { campChoices, huesRestored } from './sim/game.js';
import { drawRune } from './view/ward.js';
import { esc } from './vn.js';

const $ = (id) => document.getElementById(id);
const NUM = ['Prologue', 'Chapter One', 'Chapter Two', 'Chapter Three', 'Chapter Four', 'Chapter Five', 'Chapter Six', 'Chapter Seven', 'Epilogue'];
export const chapterLabel = (ch) => NUM[ch] || '';
const RUNE_NAME = { kindling: 'Kindling', making: 'Making', seeing: 'Seeing', growing: 'Growing', passage: 'Passage', binding: 'Binding', dreaming: 'Dreaming' };

/** A small canvas with one rune drawn on it, as a data URL (cached). */
const runeCache = new Map();
export function runeImg(id, colour) {
    const k = id + colour;
    if (runeCache.has(k)) return runeCache.get(k);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.strokeStyle = colour;
    drawRune(x, id, 32, 32, 24);
    const url = c.toDataURL();
    runeCache.set(k, url);
    return url;
}

export class UI {
    constructor({ audio, settings, send, onSettings, onSlot }) {
        this.audio = audio;
        this.settings = settings;
        this.send = send;
        this.onSettings = onSettings;
        this.onSlot = onSlot;
        this.stack = [];
        this.G = null;
        this.album = null;
        this.journalTab = 'wards';
        this._wire();
    }

    // ------------------------------------------------------------ screens
    openScreen(id) {
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((x) => x !== id);
        this.stack.push(id);
        el.dataset.opened = String(performance.now());
        requestAnimationFrame(() => {
            const f = el.querySelector('.btn.primary:not([hidden])') || el.querySelector('button:not([hidden])');
            if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true });
        });
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((x) => x !== id);
    }
    closeTop() { const t = this.top(); if (t && t !== 'title' && t !== 'ending') this.closeScreen(t); }
    top() { return this.stack[this.stack.length - 1] || null; }

    _wire() {
        // a sheet ignores the click from a press that began before it opened, so the tap that opened it can't close it
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (performance.now() - (+el.dataset.opened || 0) < 250) return;
                const c = e.target.closest('[data-close]');
                if (c) { this.audio.ui('click'); this.closeScreen(el.id); }
                else if (e.target === el && el.classList.contains('modal')) this.closeScreen(el.id);
            });
        }
        const s = this.settings;
        const bind = (id, key, num = true) => {
            const el = $(id);
            if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = String(s[key]);
            el.addEventListener('input', () => { s[key] = el.type === 'checkbox' ? el.checked : num ? +el.value : el.value; this.onSettings(s, key); });
        };
        bind('set-music', 'music'); bind('set-sfx', 'sfx'); bind('set-voice', 'voice'); bind('set-speed', 'speed'); bind('set-auto', 'auto');
        bind('set-narr', 'narr'); bind('set-puzzle', 'puzzle', false); bind('set-motion', 'motion', false);
        $('journal-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            this.audio.ui('click');
            this.journalTab = b.dataset.tab;
            this.renderJournal();
        });
        $('journal-body').addEventListener('click', (e) => {
            const t = e.target.closest('[data-cg]');
            if (t) this.view(t.dataset.cg);
        });
        $('viewer').addEventListener('click', () => { $('viewer').hidden = true; });
        $('slots-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-slot]');
            if (b) this.onSlot(this.slotMode, +b.dataset.slot);
        });
        $('camp-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-who]');
            if (b) { this.audio.ui('click'); this.send({ t: 'sit', who: b.dataset.who }); }
        });
        $('camp-sleep').addEventListener('click', () => { this.audio.ui('click'); this.send({ t: 'sleep' }); });
        $('map-go').addEventListener('click', () => { this.audio.ui('click'); this.send({ t: 'travel' }); });
    }

    toast(html, cls = '') {
        const t = document.createElement('div');
        t.className = 'toast ' + cls;
        t.innerHTML = html;
        $('toasts').appendChild(t);
        setTimeout(() => t.remove(), 3600);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    }

    /** How grey a DOM picture should be: by the colours restored (or none, once the story is finished). */
    greyness(G) {
        if (this.album?.done && !G) return 0;
        const n = G ? huesRestored(G) : 0;
        return 1 - n / 7;
    }

    // ------------------------------------------------------------ HUD
    hud(G) {
        $('hud').hidden = !G;
        if (!G) return;
        const c = CHAPTERS[G.ch];
        $('hud-ch').textContent = chapterLabel(G.ch);
        $('hud-title').textContent = c.title;
        const pips = HUES.map((h, i) => `<i class="${G.hues[i] ? 'on' : ''}" style="${G.hues[i] ? `--c:${h.css}` : ''}" title="${G.hues[i] ? h.name : 'Still grey'}"></i>`).join('');
        if ($('hud-hues').dataset.k !== pips) { $('hud-hues').innerHTML = pips; $('hud-hues').dataset.k = pips; }
        // the UI's own accent warms as the world does
        const n = huesRestored(G);
        document.documentElement.style.setProperty('--warm', String(n / 7));
    }

    // ------------------------------------------------------------ the ward-lock panel
    ward(G, view) {
        const w = G.ward;
        const el = $('ward-ui');
        el.hidden = !w;
        if (!w) return;
        const W = WARDS[w.id];
        $('ward-name').textContent = W.name;
        $('ward-verse').textContent = W.verse;
        const key = w.key.map((r) => `<img src="${runeImg(r, G.hues[RUNE_HUE[r]] ? HUES[RUNE_HUE[r]].css : '#dfe1ea')}" alt="${RUNE_NAME[r]}" title="${RUNE_NAME[r]}">`).join('<span class="arr">›</span>');
        if ($('ward-key').dataset.k !== w.id) { $('ward-key').innerHTML = key; $('ward-key').dataset.k = w.id; }
        $('ward-moves').textContent = String(w.moves);
        $('ward-hint').disabled = !view.active;
        $('ward-unseal').disabled = !view.active;
    }

    // ------------------------------------------------------------ camp
    camp(G) {
        const el = $('camp-ui');
        const on = G.phase === 'camp';
        el.hidden = !on;
        if (!on) return;
        const ch = campChoices(G);
        const left = G.camp.left;
        $('camp-title').textContent = `Night ${G.camp.night} at the Fire`;
        $('camp-sub').textContent = ch.length
            ? `The fire is low. You can sit with ${left === 1 ? 'one more' : left === 2 ? 'two' : left} of your companions before sleep.`
            : 'Everyone has drifted off to sleep.';
        const grey = this.greyness(G);
        $('camp-list').innerHTML = ch.map((c) => {
            const C = CAST[c.who];
            const topic = CAMP_TOPIC[c.who][c.n] || 'Sit with them.';
            const col = G.hues[C.hue] ? C.color : '#c9ccd6';
            return `<button class="card camp-card" data-who="${c.who}"><span class="face" style="background-image:url('${ART.por(portrait(c.who))}');filter:grayscale(${grey.toFixed(2)})"></span>
                <span class="txt"><b style="color:${col}">${esc(C.name)}</b><span>${esc(topic)}</span>${c.n === 2 || c.who === 'caius' ? '<em>Their last talk</em>' : ''}</span></button>`;
        }).join('');
    }

    // ------------------------------------------------------------ the road map
    map(G, stage) {
        const on = G.phase === 'map';
        $('map-ui').hidden = !on;
        $('map-pins').hidden = !on;
        if (!on) return;
        const next = CHAPTERS[G.ch + 1];
        $('map-kicker').textContent = `The road to ${chapterLabel(G.ch + 1)}`;
        $('map-title').textContent = next.title;
        $('map-sub').textContent = next.id === 'epilogue' ? 'It is over. It is only beginning.' : `Onward to ${next.place}.`;
        this.placePins(G, stage);
    }

    /** Pins over the map painting, mapped through the same fit the stage draws it with. */
    placePins(G, stage) {
        if (!G || G.phase !== 'map') return;
        const r = stage.fit(1280, 720, stage.bgFit);
        const sx = stage.cssW / stage.W, sy = stage.cssH / stage.H;
        const pts = CHAPTERS.slice(0, 8).map((c, i) => ({ i, x: (r.x + c.map[0] * r.w) * sx, y: (r.y + c.map[1] * r.h) * sy, c }));
        const done = (i) => i <= G.ch;
        const path = pts.slice(0, G.ch + 2).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const n = huesRestored(G);
        const html = `<svg class="map-path" width="${stage.cssW}" height="${stage.cssH}"><polyline points="${path}" /></svg>`
            + pts.map((p) => {
                const cls = p.i === G.ch + 1 ? 'next' : done(p.i) ? 'done' : 'far';
                const W = p.c.segs.find((s) => s.ward);
                const col = W && G.hues[WARDS[W.ward].hue] ? HUES[WARDS[W.ward].hue].css : '';
                return `<div class="pin ${cls}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;${col ? `--c:${col}` : ''}"><i></i><span>${esc(p.c.place.replace(/^the /, ''))}</span></div>`;
            }).join('');
        const key = html + n;
        if ($('map-pins').dataset.k !== key) { $('map-pins').innerHTML = html; $('map-pins').dataset.k = key; }
    }

    // ------------------------------------------------------------ journal
    openJournal(G, album) {
        this.G = G; this.album = album;
        this.renderJournal();
        this.openScreen('journal');
    }

    renderJournal() {
        const G = this.G, tab = this.journalTab;
        for (const b of $('journal-tabs').querySelectorAll('[data-tab]')) {
            b.classList.toggle('on', b.dataset.tab === tab);
            b.hidden = !G && b.dataset.tab !== 'gallery';
        }
        const body = $('journal-body');
        if (!G || tab === 'gallery') { body.innerHTML = this._gallery(); return; }
        if (tab === 'wards') {
            body.innerHTML = '<div class="ward-list">' + WARD_ORDER.map((id) => {
                const W = WARDS[id], open = !!G.hues[W.hue], H = HUES[W.hue];
                const known = open || G.ward?.id === id || WARD_ORDER.indexOf(id) <= WARD_ORDER.findIndex((x) => !G.hues[WARDS[x].hue]);
                return `<div class="ward-item ${open ? 'open' : ''}" style="${open ? `--c:${H.css}` : ''}">
                    <img src="${runeImg(W.word, open ? H.css : '#8d909c')}" alt="">
                    <div><b>${known ? esc(W.name) : 'An unknown ward'}</b><span class="dim">${known ? esc(W.place) : '…'}</span>
                    <p>${open ? `Open. The Word <i>${RUNE_NAME[W.word]}</i> is yours, and <b class="hue">${H.name.toLowerCase()}</b> has come back into the world.` : known ? `<i>${esc(W.verse)}</i>` : 'Somewhere ahead.'}</p></div></div>`;
            }).join('') + '</div>';
        } else if (tab === 'people') {
            const MET = { edda: G.ch >= 1, aldwin: G.ch >= 2, kestrel: G.ch >= 3, ione: G.ch > 4 || !!G.flags.wood, caius: !!G.flags.caiusturned };
            const cards = COMPANIONS.filter((c) => MET[c]).map((id) => this._person(G, id));
            if (G.ch >= 1 && !MET.caius) cards.push(this._person(G, 'caius', true));
            if (G.ch >= 1) cards.push(this._person(G, 'odrane', true));
            body.innerHTML = `<div class="people">${cards.join('') || '<p class="dim">You are alone, for now.</p>'}</div>`;
        } else if (tab === 'lore') {
            body.innerHTML = '<div class="lore">' + LORE.filter((l) => !l.if || evalCond(G, l.if)).map((l) => `<h3>${esc(l.title)}</h3><p>${esc(l.text)}</p>`).join('') + '</div>';
        }
    }

    _person(G, id, foe = false) {
        const C = CAST[id];
        const grey = this.greyness(G);
        const fell = id === 'aldwin' && G.flags.aldwinfell;
        const bond = G.bond[id] ?? 0;
        const col = G.hues[C.hue] ? C.color : '#c9ccd6';
        return `<div class="person ${fell ? 'fell' : ''}"><span class="face" style="background-image:url('${ART.por(portrait(id))}');filter:grayscale(${fell ? 1 : grey.toFixed(2)})"></span>
            <div><b style="color:${col}">${esc(C.name)}</b>${foe ? '<span class="dim"> · of the Order</span>' : ''}
            <p>${esc(C.bio)}</p>${!foe && bond ? `<span class="bond">${'✦'.repeat(Math.min(6, bond))}</span>` : ''}${fell ? '<p class="dim"><i>Fell on the Starfall bridge.</i></p>' : ''}</div></div>`;
    }

    _gallery() {
        const seen = new Set([...(this.album?.cgs || []), ...(this.G?.seenCg || [])]);
        const grey = this.album?.done ? 0 : this.greyness(this.G);
        return `<p class="dim">${seen.size} of ${CGS.length} illustrations found.${this.album?.done ? '' : ' They will be in full colour once the world is.'}</p><div class="gallery">`
            + CGS.map((id) => seen.has(id)
                ? `<button class="thumb" data-cg="${id}" style="background-image:url('${ART.cg(id)}');filter:grayscale(${grey.toFixed(2)})" aria-label="View illustration"></button>`
                : '<div class="thumb locked">?</div>').join('') + '</div>';
    }

    view(id) {
        const v = $('viewer');
        const grey = this.album?.done ? 0 : this.greyness(this.G);
        const pic = v.querySelector('.pic');
        pic.style.backgroundImage = `url('${ART.cg(id)}')`;
        pic.style.filter = `grayscale(${grey.toFixed(2)})`;
        v.hidden = false;
    }

    // ------------------------------------------------------------ slots, log, ending
    openSlots(mode, slots) {
        this.slotMode = mode;
        $('slots-title').textContent = mode === 'save' ? 'Save' : 'Load';
        const rows = [];
        for (let i = mode === 'save' ? 1 : 0; i <= SLOTS; i++) {
            const s = slots[i];
            const label = i === 0 ? 'Autosave' : `Slot ${i}`;
            const when = s ? new Date(s.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const desc = s ? `${esc(s.sum.where || '')} · ${esc(s.sum.name || '')} · ${s.sum.hues || 0}/7 colours` : 'Empty';
            const dis = mode === 'load' && !s ? 'disabled' : '';
            rows.push(`<button class="btn slot" data-slot="${i}" ${dis}><b>${label}</b><span>${desc}</span><small class="dim">${when}</small></button>`);
        }
        $('slots-list').innerHTML = rows.join('');
        this.openScreen('slots');
    }

    openLog(log) {
        $('log-body').innerHTML = log.map((l) => l.narr ? `<p class="narr">${esc(l.text)}</p>` : `<p><b>${esc(l.who)}</b> ${esc(l.text)}</p>`).join('') || '<p class="dim">Nothing yet.</p>';
        this.openScreen('log');
        requestAnimationFrame(() => { const b = $('log-body').closest('.sheet'); b.scrollTop = b.scrollHeight; });
    }

    ending(G, album) {
        const lived = [];
        lived.push(G.flags.aldwinfell ? 'Aldwin fell holding the bridge.' : 'Aldwin lived, and keeps a forge where the fire burns orange.');
        lived.push(G.flags.caiusturned ? 'Caius Morrow turned from the Order.' : 'Caius Morrow never turned.');
        lived.push(G.flags.odranemercy ? 'You showed the Hierarch mercy at the very end.' : 'The Hierarch crumbled to ash.');
        const seen = new Set([...album.cgs, ...G.seenCg]);
        $('ending-body').innerHTML = `<p>Seven wards opened. Seven colours returned. ${esc(G.name)}, the Last Apprentice, gave the world back its dreams.</p>
            <ul>${lived.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
            <p class="dim">Hope ${G.hope} · ${G.stats.choices} choices · ${G.stats.turns} turns of the rings${G.stats.unsealed ? ` · ${G.stats.unsealed} opened by the Codex` : ''} · ${seen.size} of ${CGS.length} illustrations</p>`;
        this.openScreen('ending');
    }
}
