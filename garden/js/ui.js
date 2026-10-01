// DOM overlay: loading/title screen, HUD, hover tooltip, game card, library,
// map, help, time panel, area banners, hints, joystick and fades.

import { esc, excerpt, store } from './util.js';
import { GENRES, genreOf } from './genres.js';

const $ = (id) => document.getElementById(id);

export class UI {
    constructor(games) {
        this.games = games;
        this.handlers = {};
        this.open = null;
        this.cardGame = null;
        this.bannerTimer = 0;
        this.hintTimer = 0;
        this.libFilter = '';
        this.libQuery = '';
        $('game-count').textContent = games.length;

        document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeAll()));
        for (const id of ['library', 'map', 'help']) {
            $(id).addEventListener('pointerdown', (e) => {
                if (e.target.id === id) this.closeAll();
            });
        }
        $('btn-map').addEventListener('click', () => this.toggle('map'));
        $('btn-library').addEventListener('click', () => this.toggle('library'));
        $('btn-help').addEventListener('click', () => this.toggle('help'));
        $('btn-time').addEventListener('click', () => this.toggle('time-panel'));
        $('btn-sound').addEventListener('click', () => this.emit('sound'));
        $('lib-search').addEventListener('input', (e) => {
            this.libQuery = e.target.value.trim().toLowerCase();
            this.renderLibrary();
        });
        $('card-walk').addEventListener('click', () => this.cardGame && this.emit('walk', this.cardGame));
        $('card-link').addEventListener('click', () => this.cardGame && this.emit('link', this.cardGame));
        $('card-play').addEventListener('click', () => this.cardGame && this.emit('play', this.cardGame));

        addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, textarea')) {
                if (e.key === 'Escape') this.closeAll();
                return;
            }
            const k = e.key.toLowerCase();
            if (k === 'escape') this.closeAll();
            else if (!this.entered) return;
            else if (k === 'm') this.toggle('map');
            else if (k === 'l' || k === '/') {
                e.preventDefault();
                this.toggle('library');
            } else if (k === 'h' || k === '?') this.toggle('help');
            else if (k === 't') this.toggle('time-panel');
        });
        this.renderChips();
        this.renderLibrary();
    }

    on(name, fn) {
        this.handlers[name] = fn;
    }
    emit(name, ...args) {
        this.handlers[name]?.(...args);
    }

    // ----------------------------------------------------------- loading

    progress(p, text) {
        $('loader-fill').style.width = `${Math.round(p * 100)}%`;
        if (text) $('loader-text').textContent = text;
    }

    ready() {
        $('loader').hidden = true;
        $('title-actions').hidden = false;
        $('enter').focus({ preventScroll: true });
    }

    enter() {
        this.entered = true;
        $('title').classList.add('gone');
        setTimeout(() => ($('title').hidden = true), 1300);
        $('hud').hidden = false;
    }

    noWebGL() {
        $('title').hidden = true;
        $('nogl').hidden = false;
    }

    // ----------------------------------------------------------- overlays

    toggle(id) {
        if (this.open === id) this.closeAll();
        else this.show(id);
    }

    show(id) {
        this.closeAll(true);
        this.open = id;
        $(id).hidden = false;
        if (id === 'library') {
            this.renderLibrary();
            if (matchMedia('(pointer: fine)').matches) setTimeout(() => $('lib-search').focus(), 30);
        }
        if (id === 'map') this.emit('mapOpen');
        if (id === 'time-panel') this.emit('timeOpen');
        this.emit('overlay', true);
    }

    closeAll(silent) {
        for (const id of ['library', 'map', 'help', 'time-panel', 'card']) $(id).hidden = true;
        const was = this.open || this.cardGame;
        this.open = null;
        this.cardGame = null;
        if (!silent && was) this.emit('overlay', false);
    }

    get blocking() {
        return this.open === 'library' || this.open === 'map' || this.open === 'help';
    }

    // ----------------------------------------------------------- tooltip

    tooltip(game, x, y, cta) {
        const el = $('tooltip');
        if (!game) {
            el.hidden = true;
            this.ttGame = null;
            return;
        }
        if (this.ttGame !== game || this.ttCta !== cta) {
            const g = genreOf(game);
            el.style.setProperty('--accent', g.accent);
            el.innerHTML = `
                <div class="tt-head"><div class="tt-icon">${game.icon}</div>
                <div><p class="tt-genre">${esc(g.emoji)} ${esc(g.short)}</p>
                <h3>${esc(game.title)}${game.version ? `<span class="tt-ver">v${esc(game.version)}</span>` : ''}</h3></div></div>
                <p class="tt-desc">${esc(excerpt(game.description, 230))}</p>
                <div class="tt-tags">${game.tags.map((t) => `<span class="tag">${t.emoji} ${esc(t.label)}</span>`).join('')}</div>
                <p class="tt-cta">${esc(cta || 'Click to play →')}</p>`;
            this.ttGame = game;
            this.ttCta = cta;
        }
        el.hidden = false;
        const w = el.offsetWidth, h = el.offsetHeight;
        let tx = x + 22, ty = y + 18;
        if (tx + w > innerWidth - 10) tx = x - w - 22;
        if (ty + h > innerHeight - 10) ty = innerHeight - h - 10;
        el.style.left = `${Math.max(10, tx)}px`;
        el.style.top = `${Math.max(10, ty)}px`;
    }

    // ----------------------------------------------------------- card

    showCard(game, { fromHologram = false } = {}) {
        this.closeAll(true);
        const g = genreOf(game);
        const card = $('card');
        card.style.setProperty('--accent', g.accent);
        $('card-icon').textContent = game.icon;
        $('card-genre').textContent = `${g.emoji} ${g.short} · ${g.name}`;
        $('card-title').textContent = game.title;
        $('card-meta').textContent = `${game.version ? 'Version ' + game.version + ' · ' : ''}${game.id}`;
        $('card-tags').innerHTML = game.tags.map((t) => `<span class="tag">${t.emoji} ${esc(t.label)}</span>`).join('');
        $('card-desc').textContent = game.description;
        $('card-play').href = `${game.folder}/index.html`;
        $('card-walk').hidden = !fromHologram;
        card.hidden = false;
        card.scrollTop = 0;
        this.cardGame = game;
        this.emit('overlay', true);
    }

    // ----------------------------------------------------------- library

    renderChips() {
        const used = new Set(this.games.map((g) => genreOf(g).id));
        const chips = [`<button class="chip active" data-genre="">All</button>`, ...GENRES.filter((g) => used.has(g.id)).map((g) => `<button class="chip" data-genre="${g.id}">${g.emoji} ${esc(g.short)}</button>`)];
        const wrap = $('lib-chips');
        wrap.innerHTML = chips.join('');
        wrap.addEventListener('click', (e) => {
            const c = e.target.closest('.chip');
            if (!c) return;
            this.libFilter = c.dataset.genre;
            wrap.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c));
            this.renderLibrary();
        });
    }

    renderLibrary() {
        const q = this.libQuery;
        const groups = GENRES.map((g) => ({ g, items: [] }));
        const newest = [...this.games].reverse();
        for (const game of newest) {
            const g = genreOf(game);
            if (this.libFilter && g.id !== this.libFilter) continue;
            if (q) {
                const hay = `${game.title} ${game.description} ${game.tags.map((t) => t.label).join(' ')} ${g.short}`.toLowerCase();
                if (!hay.includes(q)) continue;
            }
            groups.find((x) => x.g.id === g.id).items.push(game);
        }
        const html = groups
            .filter((x) => x.items.length)
            .map(({ g, items }) => `
                <section class="lib-group" style="--accent:${g.accent}">
                    <h3>${g.emoji} ${esc(g.name)} <small>· ${esc(g.short)}</small></h3>
                    ${items.map((game) => `
                        <div class="lib-item">
                            <div class="lib-icon" aria-hidden="true">${game.icon}</div>
                            <div class="lib-text"><strong>${esc(game.title)}</strong>${game.version ? `<span class="ver">v${esc(game.version)}</span>` : ''}
                                <p>${esc(excerpt(game.description, 180))}</p></div>
                            <div class="lib-actions">
                                <a class="btn btn-primary" href="${esc(game.folder)}/index.html" target="_blank" rel="noopener" data-play="${esc(game.id)}">Play</a>
                                <button class="btn" data-find="${esc(game.id)}">Find statue</button>
                            </div>
                        </div>`).join('')}
                </section>`)
            .join('');
        const list = $('lib-list');
        list.innerHTML = html || `<p class="lib-empty">No games match “${esc(q)}”.</p>`;
        list.onclick = (e) => {
            const f = e.target.closest('[data-find]');
            if (f) this.emit('find', this.games.find((g) => g.id === f.dataset.find));
            const p = e.target.closest('[data-play]');
            if (p) this.emit('play', this.games.find((g) => g.id === p.dataset.play));
        };
    }

    // ----------------------------------------------------------- HUD bits

    zone(name, sub, accent) {
        $('hud-zone').textContent = name;
        const b = $('banner');
        b.style.setProperty('--accent', accent || '#d9b46a');
        b.innerHTML = `<span class="b-name">${esc(name)}</span>${sub ? `<span class="b-sub">${esc(sub)}</span>` : ''}<span class="b-rule"></span>`;
        b.classList.add('show');
        clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => b.classList.remove('show'), 3200);
    }

    hint(text, ms = 6000) {
        const h = $('hint');
        h.textContent = text;
        h.hidden = false;
        h.classList.remove('fade');
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => h.classList.add('fade'), ms);
    }

    clock(text, night) {
        $('clock').textContent = text;
        $('clock-icon').textContent = night > 0.5 ? '\u{1F319}' : '☀️';
        if (this.open === 'time-panel') $('time-out').textContent = text;
    }

    sound(muted) {
        $('sound-icon').textContent = muted ? '\u{1F507}' : '\u{1F50A}';
        store.set('muted', muted);
    }

    showJoystick(x, y, dx, dy) {
        const j = $('joystick');
        j.hidden = false;
        j.style.left = `${x}px`;
        j.style.top = `${y}px`;
        j.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    hideJoystick() {
        $('joystick').hidden = true;
    }

    marker(x, y) {
        const m = $('marker');
        m.hidden = true;
        m.style.left = `${x}px`;
        m.style.top = `${y}px`;
        void m.offsetWidth;
        m.hidden = false;
    }

    flash(on) {
        $('fade').classList.toggle('on', on);
    }
}
