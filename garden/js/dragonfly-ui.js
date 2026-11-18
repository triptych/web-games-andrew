// The dragonfly companion's corner of the screen: its portrait (a little
// drawing in its own colours and accessory) with its name and mood, the
// speech bubble it talks in, the meeting on the dock (with the naming), and
// its panel: Talk, Travel, Care, Look and Memories. companion.js owns the
// state; this file draws it and passes clicks back.

import { esc } from './util.js';
import { BODIES, WINGS, ACCESSORIES, SNACKS, PLAYS, NAME_IDEAS, cleanName, ago } from './dragonfly-talk.js';

const $ = (id) => document.getElementById(id);
let uid = 0;

/** The portrait: a dragonfly seen from above, coloured by CSS variables. */
export function portraitSVG(acc = 'none') {
    const g = `dfw${++uid}`;
    return `<svg class="df-svg" viewBox="0 0 100 100" data-acc="${esc(acc)}" aria-hidden="true" focusable="false">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--df-wing);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--df-tip);stop-opacity:.85"/></linearGradient>
<linearGradient id="${g}r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" style="stop-color:var(--df-wing);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--df-tip);stop-opacity:.85"/></linearGradient></defs>
<g class="df-wing df-wl"><ellipse cx="27" cy="36" rx="23" ry="6.5" transform="rotate(-10 50 36)" fill="url(#${g}r)"/><ellipse cx="28" cy="49" rx="22" ry="7.6" transform="rotate(12 50 46)" fill="url(#${g}r)"/>
<path d="M48 36 L7 32 M48 46 L8 53" stroke="rgba(20,30,40,.35)" stroke-width=".8" fill="none"/></g>
<g class="df-wing df-wr"><ellipse cx="73" cy="36" rx="23" ry="6.5" transform="rotate(10 50 36)" fill="url(#${g})"/><ellipse cx="72" cy="49" rx="22" ry="7.6" transform="rotate(-12 50 46)" fill="url(#${g})"/>
<path d="M52 36 L93 32 M52 46 L92 53" stroke="rgba(20,30,40,.35)" stroke-width=".8" fill="none"/></g>
<line x1="50" y1="46" x2="50" y2="93" stroke="var(--df-a)" stroke-width="5.4" stroke-linecap="round"/>
<line x1="50" y1="48" x2="50" y2="91" stroke="var(--df-b)" stroke-width="5.6" stroke-dasharray="2.4 3.4"/>
<ellipse cx="50" cy="39" rx="7" ry="9.5" fill="var(--df-a)"/>
<ellipse cx="50" cy="27.5" rx="6" ry="4.5" fill="var(--df-b)"/>
<circle cx="44.6" cy="22.5" r="5.6" fill="var(--df-eye)"/><circle cx="55.4" cy="22.5" r="5.6" fill="var(--df-eye)"/>
<circle cx="43" cy="20.6" r="1.6" fill="#fff"/><circle cx="53.8" cy="20.6" r="1.6" fill="#fff"/>
<g class="acc acc-tophat"><rect x="39" y="15" width="22" height="2.6" rx="1" fill="#16161c"/><rect x="43" y="4" width="14" height="12" rx="1" fill="#16161c"/><rect x="43" y="12" width="14" height="2.6" fill="var(--df-b)"/></g>
<g class="acc acc-crown"><circle cx="40" cy="16" r="2.8" fill="#ff8fc8"/><circle cx="45" cy="13.6" r="2.8" fill="#fff27a"/><circle cx="50" cy="12.8" r="2.8" fill="#fff"/><circle cx="55" cy="13.6" r="2.8" fill="#b79bff"/><circle cx="60" cy="16" r="2.8" fill="#ff9a5a"/></g>
<g class="acc acc-scarf"><rect x="42" y="29.5" width="16" height="4.4" rx="2" fill="#d8344a"/><path d="M55 32 l7 9 l-4 1.5 l-5 -8z" fill="#b02238"/></g>
<g class="acc acc-bowtie"><path d="M50 31 l-7 -3.6 v7.2z M50 31 l7 -3.6 v7.2z" fill="#c8203a"/><circle cx="50" cy="31" r="1.6" fill="#a01830"/></g>
<g class="acc acc-glasses" fill="none" stroke="#2a1a0a" stroke-width="1.4"><circle cx="44.6" cy="22.5" r="6.4"/><circle cx="55.4" cy="22.5" r="6.4"/></g>
<g class="acc acc-lantern"><path d="M56 44 L66 55" stroke="#444" stroke-width=".8"/><circle cx="66.5" cy="58.5" r="4.2" fill="#ffd48a"/><circle cx="66.5" cy="58.5" r="8" fill="#ffc060" opacity=".3"/></g>
</svg>`;
}

const TABS = [
    ['talk', 'Talk', '\u{1F4AC}'],
    ['travel', 'Travel', '✨'],
    ['care', 'Care', '\u{1F49A}'],
    ['look', 'Look', '\u{1F3A8}'],
    ['memories', 'Memories', '\u{1F4D6}'],
];

export class DragonflyUI {
    /** `c` is the Companion: its state and what the buttons ask it to do. */
    constructor(c) {
        this.c = c;
        this.tab = 'talk';
        this.acts = new Map();
        this.actId = 0;
        this.bubbleTimer = 0;
        this.hud = $('df-hud');
        this.panel = $('df-panel');
        this.meetEl = $('df-meet');
        $('df-face-art').innerHTML = portraitSVG();
        $('df-panel-art').innerHTML = portraitSVG();
        $('df-meet-art').innerHTML = portraitSVG();
        $('df-face').addEventListener('click', () => this.togglePanel());
        $('df-panel-close').addEventListener('click', () => this.closePanel());
        $('df-tabs').innerHTML = TABS.map(([id, label, icon]) => `<button class="df-tab" role="tab" data-tab="${id}" aria-selected="false" id="df-tab-${id}" aria-controls="df-body"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('');
        $('df-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (b) this.show(b.dataset.tab);
        });
        $('df-tabs').addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const i = TABS.findIndex(([id]) => id === this.tab);
            const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
            this.show(n);
            $(`df-tab-${n}`).focus();
        });
        // one listener for every button the panel and the bubble draw
        for (const root of [$('df-body'), $('df-bubble')]) root.addEventListener('click', (e) => this._click(e));
        $('df-bubble').addEventListener('click', (e) => {
            if (!e.target.closest('button')) this.hush();
        });
        addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.meetEl.hidden) return this.meetLater?.();
                if (!this.panel.hidden) this.closePanel();
                return;
            }
            if (e.target.closest?.('input, textarea, select')) return;
            if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey && this.c.met && this.c.active) this.togglePanel();
        });
    }

    // ------------------------------------------------------------ looks

    setLook(body, wings, acc) {
        for (const el of [this.hud, this.panel, this.meetEl]) {
            el.style.setProperty('--df-a', body.a);
            el.style.setProperty('--df-b', body.b);
            el.style.setProperty('--df-eye', body.eye);
            el.style.setProperty('--df-wing', wings.tint);
            el.style.setProperty('--df-tip', wings.tip);
        }
        document.querySelectorAll('.df-svg').forEach((s) => (s.dataset.acc = acc.id));
    }

    setName(name) {
        $('df-name').textContent = name;
        $('df-panel-title').textContent = name;
        $('df-face').setAttribute('aria-label', `${name}, your dragonfly: open its panel`);
        $('df-face').title = `${name} (K)`;
    }

    setMood(mood, full, joy) {
        $('df-mood').textContent = mood.face;
        $('df-mood').title = mood.word;
        $('df-panel-mood').textContent = `${mood.face} ${mood.word}`;
        this.hud.classList.toggle('hungry', full < 0.15);
        if (!this.panel.hidden && this.tab === 'care') {
            const f = $('df-bar-full'), j = $('df-bar-joy');
            if (f) f.style.width = `${Math.round(full * 100)}%`;
            if (j) j.style.width = `${Math.round(joy * 100)}%`;
        }
    }

    showHud(on) {
        if (this.hud.hidden === !on) return;
        this.hud.hidden = !on;
        document.body.classList.toggle('df-on', on);
        if (!on) this.closePanel();
    }

    // ------------------------------------------------------------ the bubble

    /** Say something. `actions` are [{ label, fn, primary }]; `ms` 0 keeps it up until hushed. */
    say(text, actions = [], ms) {
        const b = $('df-bubble');
        $('df-say').textContent = text;
        $('df-acts').innerHTML = actions.map((a) => this._act(a)).join('');
        b.hidden = false;
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
        clearTimeout(this.bubbleTimer);
        const dur = ms ?? Math.min(16000, 4500 + text.length * 55 + actions.length * 2500);
        if (dur > 0) this.bubbleTimer = setTimeout(() => this.hush(), dur);
    }

    hush() {
        clearTimeout(this.bubbleTimer);
        $('df-bubble').hidden = true;
    }

    get talking() {
        return !$('df-bubble').hidden;
    }

    _act(a) {
        const id = ++this.actId;
        this.acts.set(id, a.fn);
        if (this.acts.size > 200) this.acts.delete(this.acts.keys().next().value);
        return `<button class="btn${a.primary ? ' btn-primary' : ''} df-act" data-act="${id}">${esc(a.label)}</button>`;
    }

    _click(e) {
        const b = e.target.closest('button, [data-act]');
        if (!b) return;
        const d = b.dataset;
        if (d.act) {
            const fn = this.acts.get(Number(d.act));
            if (b.closest('#df-bubble')) this.hush();
            fn?.();
        } else if (d.talk) this.c.talk(d.talk);
        else if (d.go) this.c.travel(d.go);
        else if (d.snack) this.c.feed(d.snack);
        else if (d.play) this.c.play(d.play);
        else if (d.body || d.wings || d.acc) this.c.restyle(d.body, d.wings, d.acc);
        else if (d.chat) this.c.setChat(d.chat);
        else if (d.rename !== undefined) {
            const v = cleanName($('df-rename').value);
            if (v) this.c.rename(v);
        }
    }

    // ------------------------------------------------------------ the panel

    togglePanel(tab) {
        if (!this.panel.hidden && (!tab || tab === this.tab)) this.closePanel();
        else this.openPanel(tab);
    }

    openPanel(tab) {
        this.panel.hidden = false;
        this.show(tab || this.tab);
        this.c.onPanel(true);
    }

    closePanel() {
        if (this.panel.hidden) return;
        this.panel.hidden = true;
        this.c.onPanel(false);
    }

    get panelOpen() {
        return !this.panel.hidden;
    }

    show(tab) {
        this.tab = tab;
        document.querySelectorAll('#df-tabs .df-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
        $('df-body').setAttribute('aria-labelledby', `df-tab-${tab}`);
        this.render();
    }

    /** Redraw the open tab (after anything changes it). */
    render() {
        if (this.panel.hidden) return;
        const body = $('df-body');
        const keep = body.scrollTop;
        body.innerHTML = this[`_${this.tab}`]();
        if (this.tab !== 'talk') body.scrollTop = keep;
        else {
            const log = $('df-log');
            if (log) log.scrollTop = log.scrollHeight;
        }
    }

    _talk() {
        const c = this.c;
        const log = c.log.slice(-12).map((m) => `<li class="df-line${m.me ? ' me' : ''}"><p>${esc(m.text)}</p>${m.actions?.length ? `<div class="df-acts">${m.actions.map((a) => this._act(a)).join('')}</div>` : ''}</li>`).join('');
        return `
            <ul class="df-log" id="df-log" aria-live="polite">${log || `<li class="df-line"><p>${esc(`Ask me anything! Well, anything on this list.`)}</p></li>`}</ul>
            <div class="df-asks" role="group" aria-label="Ask ${esc(c.name)}">
                <button class="chip" data-talk="hint">\u{1F5DD}️ Any hints?</button>
                <button class="chip" data-talk="news">\u{1F4F0} What’s new?</button>
                <button class="chip" data-talk="game">\u{1F3B2} Pick me a game</button>
                <button class="chip" data-talk="here">\u{1F4CD} Where are we?</button>
                <button class="chip" data-talk="secret">\u{1F92B} Tell me a secret</button>
            </div>`;
    }

    _travel() {
        const c = this.c;
        const groups = c.travelList();
        const found = c.placesFound();
        const sec = groups.map((g) => `
            <section class="df-sec"><h3>${esc(g.title)} <small>${g.items.length}</small></h3>
            ${g.items.length ? `<div class="df-places">${g.items.map((it) => `
                <button class="df-place" data-go="${esc(it.key)}"${it.here ? ' disabled aria-disabled="true"' : ''}>
                    <span class="df-pi" aria-hidden="true">${it.iconHTML ?? esc(it.icon)}</span>
                    <span class="df-pt"><strong>${esc(it.label)}</strong>${it.sub ? `<small>${esc(it.here ? 'You are here' : it.sub)}</small>` : it.here ? '<small>You are here</small>' : ''}</span>
                </button>`).join('')}</div>` : `<p class="df-empty">${esc(g.empty)}</p>`}</section>`).join('');
        return `<p class="df-lead">${esc(`Anywhere we’ve been together, I can fly you back to in a blink. We’ve found ${found.n} of ${found.of} places so far.`)}</p>${sec}`;
    }

    _care() {
        const c = this.c, m = c.mem;
        const bar = (id, label, v, cls) => `<div class="df-meter ${cls}"><span>${label}</span><div class="df-track"><i id="${id}" style="width:${Math.round(v * 100)}%"></i></div></div>`;
        return `
            ${bar('df-bar-full', 'Full', m.full, 'full')}
            ${bar('df-bar-joy', 'Happy', m.joy, 'joy')}
            <section class="df-sec"><h3>Give a snack</h3><div class="df-grid">
                ${SNACKS.map((s) => `<button class="df-tile" data-snack="${s.id}"><span aria-hidden="true">${s.icon}</span>${esc(s.name)}${m.fed[s.id] ? `<small>×${m.fed[s.id]}</small>` : ''}</button>`).join('')}
            </div></section>
            <section class="df-sec"><h3>Play</h3><div class="df-grid">
                ${PLAYS.map((p) => `<button class="df-tile" data-play="${p.id}"${c.busyPlaying ? ' disabled' : ''}><span aria-hidden="true">${p.icon}</span>${esc(p.name)}${p.id === 'catch' && m.catchBest ? `<small>Best ${m.catchBest}</small>` : ''}</button>`).join('')}
            </div></section>
            <section class="df-sec"><h3>Name</h3>
                <div class="df-rename"><input id="df-rename" maxlength="18" value="${esc(c.name)}" aria-label="Your dragonfly's name" autocomplete="off" spellcheck="false"><button class="btn" data-rename>Rename</button></div>
            </section>
            <section class="df-sec"><h3>Chattiness</h3><div class="time-buttons" role="group" aria-label="How often it talks">
                ${[['chatty', 'Chatty'], ['quiet', 'Only when it matters'], ['hush', 'Only when asked']].map(([id, l]) => `<button class="chip${m.chat === id ? ' active' : ''}" data-chat="${id}" aria-pressed="${m.chat === id}">${l}</button>`).join('')}
            </div></section>`;
    }

    _look() {
        const c = this.c, L = c.mem.look;
        return `
            <section class="df-sec"><h3>Body</h3><div class="df-swatches" role="group" aria-label="Body colour">
                ${BODIES.map((b) => `<button class="df-swatch${L.body === b.id ? ' on' : ''}" data-body="${b.id}" aria-pressed="${L.body === b.id}" title="${esc(b.name)}" style="--sa:${b.a};--sb:${b.b}"><i></i><span>${esc(b.name)}</span></button>`).join('')}
            </div></section>
            <section class="df-sec"><h3>Wings</h3><div class="df-swatches" role="group" aria-label="Wings">
                ${WINGS.map((w) => `<button class="df-swatch wing${L.wings === w.id ? ' on' : ''}" data-wings="${w.id}" aria-pressed="${L.wings === w.id}" title="${esc(w.name)}" style="--sa:${w.tint};--sb:${w.tip}"${w.iri > 0.9 ? ' data-rainbow' : ''}><i></i><span>${esc(w.name)}</span></button>`).join('')}
            </div></section>
            <section class="df-sec"><h3>Something to wear</h3><div class="df-grid">
                ${ACCESSORIES.map((a) => {
                    const ok = !a.unlock || a.unlock(c.mem);
                    return `<button class="df-tile${L.acc === a.id ? ' on' : ''}" data-acc="${a.id}" aria-pressed="${L.acc === a.id}"${ok ? '' : ' disabled'}><span aria-hidden="true">${ok ? a.icon : '\u{1F512}'}</span>${esc(a.name)}${ok ? '' : `<small>${esc(a.need)}</small>`}</button>`;
                }).join('')}
            </div></section>`;
    }

    _memories() {
        const c = this.c, m = c.mem, now = Date.now();
        const found = Object.entries(m.places).sort((a, b) => b[1] - a[1]);
        const fav = Object.entries(m.fed).sort((a, b) => b[1] - a[1])[0];
        const favSnack = fav ? SNACKS.find((s) => s.id === fav[0]) : null;
        const mins = Math.round(m.together / 60);
        const stat = (n, label) => `<div class="df-stat"><strong>${esc(String(n))}</strong><span>${esc(label)}</span></div>`;
        const topGames = Object.entries(m.games).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ game: c.gameById(id), n })).filter((x) => x.game);
        return `
            <p class="df-lead">${esc(`We met ${ago(m.metAt || now, now)}. I remember everything. Well, nearly everything.`)}</p>
            <div class="df-stats">
                ${stat(m.visits, m.visits === 1 ? 'visit' : 'visits')}
                ${stat(mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h`, 'together')}
                ${stat(found.length, 'places found')}
                ${stat(Object.keys(m.games).length, 'games visited')}
                ${stat(Object.values(m.fed).reduce((a, b) => a + b, 0), 'snacks shared')}
                ${stat(m.plays, 'games played')}
            </div>
            ${favSnack ? `<p class="df-note">${esc(`My favourite snack is the ${favSnack.name.toLowerCase()}. You’ve given me ${fav[1]}!`)}</p>` : ''}
            ${m.catchBest ? `<p class="df-note">${esc(`Your best at Catch me! is ${m.catchBest}.`)}</p>` : ''}
            ${topGames.length ? `<section class="df-sec"><h3>The games we visit most</h3><ol class="df-list">${topGames.map((x) => `<li>${esc(x.game.title)} <small>×${x.n}</small></li>`).join('')}</ol></section>` : ''}
            <section class="df-sec"><h3>Things we’ve found</h3>${found.length ? `<ul class="df-list">${found.map(([id, ts]) => `<li>${esc(c.placeLabel(id))} <small>${esc(ago(ts, now))}</small></li>`).join('')}</ul>` : '<p class="df-empty">Nothing yet. Let’s go exploring!</p>'}</section>`;
    }

    // ------------------------------------------------------------ meeting on the dock

    /** The first meeting: its words, then the naming. */
    meet(lines, onDone, onLater) {
        const el = this.meetEl;
        $('df-meet-text').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
        const ideas = [...NAME_IDEAS].sort(() => Math.random() - 0.5).slice(0, 4);
        $('df-meet-ideas').innerHTML = ideas.map((n) => `<button class="chip" data-name="${esc(n)}">${esc(n)}</button>`).join('');
        const input = $('df-meet-name');
        input.value = '';
        input.placeholder = ideas[0];
        el.hidden = false;
        const go = () => {
            const name = cleanName(input.value) || input.placeholder;
            cleanup();
            onDone(name);
        };
        const later = () => {
            cleanup();
            onLater();
        };
        const pick = (e) => {
            const b = e.target.closest('[data-name]');
            if (b) {
                input.value = b.dataset.name;
                input.focus();
            }
        };
        const key = (e) => {
            if (e.key === 'Enter') go();
        };
        const cleanup = () => {
            el.hidden = true;
            $('df-meet-go').removeEventListener('click', go);
            $('df-meet-later').removeEventListener('click', later);
            $('df-meet-ideas').removeEventListener('click', pick);
            input.removeEventListener('keydown', key);
            this.meetLater = null;
        };
        $('df-meet-go').addEventListener('click', go);
        $('df-meet-later').addEventListener('click', later);
        $('df-meet-ideas').addEventListener('click', pick);
        input.addEventListener('keydown', key);
        this.meetLater = later;
        // no autofocus: the keys still walk you about until you click into the name
    }

    get meeting() {
        return !this.meetEl.hidden;
    }

    /** The catch game's score in the bubble. */
    score(caught, left) {
        $('df-say').textContent = `Caught me ${caught} time${caught === 1 ? '' : 's'}! ${Math.ceil(left)}s left…`;
    }
}
