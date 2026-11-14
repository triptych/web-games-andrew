// Pocket Garden: the games collection as a retro handheld. This file is the
// console itself: the screen stack, the click wheel and keyboard, swipes,
// favorites (shared with the Garden), the cartridge launch, shuffle, the
// boot screen, and the box-art sleeve and backdrop beside the device on
// wide screens.

import games from '../../js/gamedata.js';
import { GENRES, genreOf } from '../../garden/js/genres.js';
import { Store, FAV_KEY } from './store.js';
import { sfx, unlockAudio, setSound } from './sound.js';
import { attachWheel } from './wheel.js';
import { ICONS } from './icons.js';
import { ListView, DetailView, CoverFlowView, SearchView, TextView, gameArt } from './views.js';
import { esc, excerpt, gameNo, thumbUrl, playUrl, sortKey, timeAgo, shuffled } from './util.js';

/** Shown in About; bump it with any change to the console. */
export const CONSOLE_VERSION = '1.0.0';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wide = matchMedia('(min-width: 760px) and (min-height: 560px)');

const ALL = games.filter((g) => g && g.id && g.folder);
const NEWEST = [...ALL].sort((a, b) => gameNo(b) - gameNo(a));
const ALPHA = [...ALL].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || gameNo(a) - gameNo(b));
const byId = new Map(ALL.map((g) => [g.id, g]));
const GENRE_GROUPS = GENRES.map((genre) => ({ genre, games: NEWEST.filter((g) => genreOf(g).id === genre.id) })).filter((x) => x.games.length);
const genreText = (g) => {
    const x = genreOf(g);
    return `${x.short} ${x.name} ${x.id}`;
};

const SHELLS = [
    ['mint', 'Mint', '#9fdcc0'],
    ['charcoal', 'Charcoal', '#2b3033'],
    ['tangerine', 'Tangerine', '#ffad73'],
    ['lilac', 'Lilac', '#c7b5ff'],
    ['atomic', 'Atomic Purple', '#6a4fa8'],
];
const GLOWS = [
    ['mint', 'Mint glow'],
    ['amber', 'Amber'],
    ['ice', 'Ice blue'],
    ['paper', 'Pocket LCD'],
];

class App {
    constructor() {
        this.store = new Store(ALL);
        this.stack = [];
        this.views = $('views');
        this.device = $('device');
        this.lcd = $('lcd');
        this.base = location.pathname + location.search;
        this.lastPointer = 'mouse';

        $('model').textContent = `PG-${ALL.length}`;
        $('boot-count').textContent = ALL.length;
        this.applySettings();
        this.bindWheel();
        this.bindKeys();
        this.bindScreen();
        this.bindChrome();
        this.initBattery();

        const deep = decodeURIComponent(location.hash.slice(1));
        history.replaceState({ d: 1 }, '', this.base);
        this.push(this.homeView(), { animate: false });
        const g = byId.get(deep);
        if (g) this.openGame(NEWEST, NEWEST.indexOf(g), { animate: false });
        this.boot(!g);

        addEventListener('popstate', (e) => this.onPop(e));
        // a #game-NNN link followed while the console is already open
        addEventListener('hashchange', () => {
            const g = byId.get(decodeURIComponent(location.hash.slice(1)));
            if (!g || this.launching || this.top.currentGame?.() === g) return;
            history.replaceState({ d: this.stack.length }, '', this.base);
            this.openGame(NEWEST, NEWEST.indexOf(g));
        });
        addEventListener('storage', (e) => {
            if (e.key === FAV_KEY || e.key === null) {
                this.store.reload();
                this.favsChanged();
            }
        });
        addEventListener('pageshow', (e) => {
            if (e.persisted) this.endLaunch();
        });
        let rt = 0;
        addEventListener('resize', () => {
            cancelAnimationFrame(rt);
            rt = requestAnimationFrame(() => this.top?.layout());
        });
        wide.addEventListener?.('change', () => this.focused && this.paintFocus(this.focused));
        document.documentElement.classList.add('ready');
    }

    // ------------------------------------------------------------ screen stack

    get top() {
        return this.stack[this.stack.length - 1];
    }

    push(view, { animate = true, url = null } = {}) {
        const prev = this.top;
        const el = view.mount();
        this.views.append(el);
        view.build();
        this.stack.push(view);
        if (this.stack.length > 1) history.pushState({ d: this.stack.length }, '', url ?? this.base);
        if (prev) {
            prev.hidden();
            prev.el.inert = true;
            this.slide(prev.el, 'out-l', animate, () => (prev.el.hidden = true));
        }
        this.slide(el, 'in-r', animate && !!prev);
        this.updateStatus();
        requestAnimationFrame(() => view.shown());
    }

    popTo(depth) {
        depth = Math.max(1, depth);
        if (this.stack.length <= depth) return;
        const leaving = this.stack.splice(depth);
        leaving.forEach((v, i) => {
            v.destroy();
            if (i === leaving.length - 1) this.slide(v.el, 'out-r', true, () => v.el.remove());
            else v.el.remove();
        });
        const top = this.top;
        top.el.inert = false;
        this.slide(top.el, 'in-l', true);
        top.refresh();
        this.updateStatus();
        requestAnimationFrame(() => top.shown());
    }

    slide(el, anim, animate, done) {
        clearTimeout(el._slide);
        el.hidden = false;
        if (!animate) {
            el.dataset.anim = '';
            done?.();
            return;
        }
        el.dataset.anim = anim;
        el._slide = setTimeout(() => {
            el.dataset.anim = '';
            done?.();
        }, 270);
    }

    back() {
        if (this.launching || this.busy) return;
        this.wake();
        if (this.top.onBack?.()) {
            sfx.back();
            return;
        }
        if (this.stack.length <= 1) return this.deny();
        sfx.back();
        this.buzz(6);
        if (history.state?.d === this.stack.length) history.back();
        else this.popTo(this.stack.length - 1);
    }

    onPop(e) {
        if (this.launching) return;
        const d = e.state?.d ?? 1;
        if (d < this.stack.length) this.popTo(d);
    }

    replaceUrl(url) {
        history.replaceState({ d: this.stack.length }, '', url);
    }

    updateStatus() {
        const t = this.top;
        if (!t) return;
        for (const v of this.stack) v.el.classList.toggle('is-top', v === t);
        $('st-title').textContent = t.statusTitle();
        $('st-back').hidden = this.stack.length <= 1;
        $('st-fav').textContent = `★${this.store.favs.length}`;
        $('st-fav').setAttribute('aria-label', `${this.store.favs.length} favorites`);
        $('st-play').classList.toggle('on', t.type === 'detail');
        this.lcd.dataset.view = t.type;
    }

    // ------------------------------------------------------------ input

    bindWheel() {
        attachWheel($('wheel'), $('wheel-center'), {
            down: () => {
                this.lastPointer = 'wheel';
                this.wake();
            },
            tick: (d) => this.tick(d),
            press: (b) => this.button(b),
            select: () => this.select(),
            hold: () => this.hold(),
        });
        // remember whether the last touch was a finger, so haptics only buzz for fingers
        $('wheel').addEventListener('pointerdown', (e) => (this.touch = e.pointerType === 'touch'), true);
        $('wheel-center').addEventListener('pointerdown', (e) => (this.touch = e.pointerType === 'touch'), true);
    }

    wake() {
        unlockAudio();
        this.skipBoot();
    }

    tick(d) {
        if (this.launching || this.busy) return;
        this.skipBoot();
        const now = performance.now();
        this.ticks = (this.ticks || []).filter((t) => now - t < 280);
        this.ticks.push(now);
        const fast = this.ticks.length >= 6;
        if (this.top.onTick(d, fast) !== false) {
            sfx.tick();
            this.buzz(4);
            this.blink();
        }
    }

    button(b) {
        if (this.launching || this.busy) return;
        this.wake();
        if (b === 'menu') return this.back();
        sfx.press();
        this.buzz(8);
        this.blink();
        if (b === 'prev') this.top.onPrev();
        else if (b === 'next') this.top.onNext();
        else if (b === 'play') this.top.onPlay();
    }

    select() {
        if (this.launching || this.busy) return;
        this.wake();
        this.feedback();
        this.top.onSelect();
    }

    hold() {
        if (this.launching || this.busy) return;
        this.top.onHold();
    }

    /** The sound and buzz of a press made on the screen rather than the wheel. */
    feedback(kind = 'select') {
        if (kind === 'tick') sfx.tick();
        else if (kind === 'press') sfx.press();
        else sfx.select();
        this.buzz(kind === 'tick' ? 4 : 10);
        this.blink();
    }

    bindKeys() {
        addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key;
            const typing = e.target.closest?.('input, textarea');
            this.touch = false;
            if (typing) {
                if (k === 'ArrowDown' || k === 'ArrowUp') {
                    e.preventDefault();
                    if ('zone' in this.top) this.top.zone = 'list';
                    this.top.renderZone?.();
                    this.tick(k === 'ArrowDown' ? 1 : -1);
                } else if (k === 'Enter') {
                    e.preventDefault();
                    this.wake();
                    this.top.enterFromInput?.();
                } else if (k === 'Escape') {
                    e.preventDefault();
                    e.target.blur();
                    this.back();
                }
                return;
            }
            // a focused real button or link activates itself
            if ((k === 'Enter' || k === ' ') && e.target.closest?.('button, a')) return;
            const t = this.top;
            const horizontal = t.type === 'cover';
            let handled = true;
            switch (k) {
                case 'ArrowDown':
                    this.tick(1);
                    break;
                case 'ArrowUp':
                    this.tick(-1);
                    break;
                case 'ArrowRight':
                    if (horizontal) this.tick(1);
                    else if (t.type === 'detail') this.button('next');
                    else this.select();
                    break;
                case 'ArrowLeft':
                    if (horizontal) this.tick(-1);
                    else if (t.type === 'detail') this.button('prev');
                    else this.back();
                    break;
                case 'Enter':
                    this.select();
                    break;
                case 'Escape':
                case 'Backspace':
                    this.back();
                    break;
                case ' ':
                    this.button('play');
                    break;
                case 'PageDown':
                    this.button('next');
                    break;
                case 'PageUp':
                    this.button('prev');
                    break;
                case 'Home':
                    t.onHome();
                    break;
                case 'End':
                    t.onEnd();
                    break;
                case 'f':
                case 'F':
                case '*':
                    this.wake();
                    this.hold();
                    break;
                case '/':
                    this.wake();
                    this.openSearch('');
                    break;
                default:
                    if (/^[a-z0-9]$/i.test(k) && !this.launching && !this.busy) {
                        this.wake();
                        this.openSearch(k);
                    } else handled = false;
            }
            if (handled) e.preventDefault();
        });
    }

    /** Swipes on the screen: right to go back (left/right flips cartridges). */
    bindScreen() {
        const v = this.views;
        let s = null;
        v.addEventListener('pointerdown', (e) => {
            this.touch = e.pointerType === 'touch';
            this.wake();
            s = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
        });
        v.addEventListener('pointerup', (e) => {
            if (!s || e.pointerId !== s.id) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            const dt = performance.now() - s.t;
            s = null;
            if (this.launching || this.busy) return;
            if (dt < 700 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6) {
                this.swiped = true;
                setTimeout(() => (this.swiped = false), 80);
                this.top.onSwipe(dx > 0 ? 'right' : 'left');
            }
        });
        v.addEventListener('pointercancel', () => (s = null));
    }

    bindChrome() {
        $('st-back').addEventListener('click', () => this.back());
        $('sleeve').addEventListener('click', (e) => {
            const g = this.sleeveGame;
            if (!g) return;
            if (e.target.closest('.sl-play')) {
                e.preventDefault();
                this.wake();
                this.play(g);
            } else if (e.target.closest('.sl-star')) {
                this.wake();
                this.toggleFav(g);
            } else if (e.target.closest('.sl-open')) {
                this.wake();
                this.feedback();
                if (this.top.type === 'detail' && this.top.currentGame() === g) return;
                const list = this.top.gameList?.() || NEWEST;
                const i = list.indexOf(g);
                this.openGame(i >= 0 ? list : NEWEST, i >= 0 ? i : NEWEST.indexOf(g));
            }
        });
    }

    // ------------------------------------------------------------ feedback

    deny() {
        sfx.deny();
        this.buzz([10, 30, 10]);
        this.lcd.classList.remove('deny');
        void this.lcd.offsetWidth;
        this.lcd.classList.add('deny');
    }

    bump(el, dir = 1) {
        sfx.bump();
        if (!el || reduceMotion.matches || !el.animate) return;
        el.animate([{ transform: 'none' }, { transform: `translateY(${-dir * 7}px)` }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }

    buzz(p) {
        if (!this.touch || !this.store.settings.haptics || !navigator.vibrate) return;
        try {
            navigator.vibrate(p);
        } catch {
            /* not allowed */
        }
    }

    blink() {
        const led = $('led');
        led.classList.remove('blink');
        void led.offsetWidth;
        led.classList.add('blink');
    }

    say(text) {
        clearTimeout(this.sayT);
        this.sayT = setTimeout(() => ($('live').textContent = text || ''), 140);
    }

    toast(text) {
        const t = $('toast');
        t.textContent = text;
        t.classList.remove('on');
        void t.offsetWidth;
        t.classList.add('on');
        clearTimeout(this.toastT);
        this.toastT = setTimeout(() => t.classList.remove('on'), 1900);
    }

    azFlash(letter) {
        const el = $('az');
        el.textContent = letter;
        el.classList.add('on');
        clearTimeout(this.azT);
        this.azT = setTimeout(() => el.classList.remove('on'), 520);
    }

    burst() {
        if (reduceMotion.matches) return;
        const b = document.createElement('div');
        b.className = 'burst';
        b.setAttribute('aria-hidden', 'true');
        b.innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg;--d:${0.55 + (i % 3) * 0.18}">★</i>`).join('');
        this.lcd.append(b);
        setTimeout(() => b.remove(), 900);
    }

    // ------------------------------------------------------------ actions

    openGame(list, index, { animate = true } = {}) {
        if (index < 0 || !list[index]) return this.deny();
        this.push(new DetailView(this, { list, index }), { animate, url: `#${list[index].id}` });
    }

    openSearch(initial = '') {
        if (this.top.type === 'search') {
            if (initial) this.top.typeChar(initial);
            else this.top.input.focus();
            return;
        }
        this.push(new SearchView(this, { query: initial.toLowerCase(), all: ALL, genreText }));
    }

    toggleFav(g, row) {
        const on = this.store.toggleFav(g.id);
        sfx.fav(on);
        this.buzz(on ? [8, 50, 14] : 12);
        this.blink();
        this.toast(on ? `★ ${g.title} added to Favorites` : `☆ ${g.title} removed`);
        this.say(on ? `${g.title} added to favorites` : `${g.title} removed from favorites`);
        if (on) this.burst();
        if (row && !reduceMotion.matches) {
            row.classList.remove('pop');
            void row.offsetWidth;
            row.classList.add('pop');
        }
        this.favsChanged();
    }

    favsChanged() {
        for (const v of this.stack) v.favChanged();
        this.updateStatus();
        if (this.sleeveGame) this.renderSleeve(this.sleeveGame);
    }

    play(g) {
        if (this.launching) return;
        this.store.played(g.id);
        const url = playUrl(g);
        if (this.store.settings.newTab) {
            const w = window.open(url, '_blank');
            if (w) {
                try {
                    w.opener = null;
                } catch {
                    /* cross-origin */
                }
                sfx.select();
                this.toast(`▶ ${g.title} opened in a new tab`);
                return;
            }
        }
        this.launching = true;
        sfx.insert();
        this.buzz([14, 70, 24]);
        const cart = this.top.type === 'detail' ? this.top.el.querySelector('.cart') : null;
        cart?.classList.add('inserting');
        const quick = reduceMotion.matches;
        this.loadT = setTimeout(() => this.showLoad(g), cart && !quick ? 430 : 0);
        this.launchT = setTimeout(() => location.assign(url), quick ? 450 : 1700);
        this.say(`Loading ${g.title}`);
    }

    showLoad(g) {
        const L = $('load');
        const gen = genreOf(g);
        L.style.setProperty('--accent', gen.accent);
        L.querySelector('.ld-icon').textContent = g.icon;
        L.querySelector('.ld-title').textContent = g.title;
        L.querySelector('.ld-sub').textContent = `${gen.emoji} ${gen.short} · No.${String(gameNo(g)).padStart(3, '0')}`;
        L.hidden = false;
        L.classList.remove('go');
        void L.offsetWidth;
        L.classList.add('go');
        this.device.classList.add('busy');
        sfx.boot();
    }

    endLaunch() {
        this.launching = false;
        clearTimeout(this.loadT);
        clearTimeout(this.launchT);
        $('load').hidden = true;
        this.device.classList.remove('busy');
        this.top?.el.querySelector('.cart.inserting')?.classList.remove('inserting');
    }

    /** Spin a reel of cartridges and land on one at random. */
    shuffle() {
        if (this.busy) return;
        const pick = ALL[Math.floor(Math.random() * ALL.length)];
        const open = () => this.openGame(NEWEST, NEWEST.indexOf(pick));
        if (reduceMotion.matches) return open();
        this.busy = true;
        const R = $('reel');
        R.hidden = false;
        const pool = [...shuffled(ALL.filter((g) => g !== pick)).slice(0, 11), pick];
        let i = 0;
        const step = () => {
            const g = pool[i];
            R.style.setProperty('--accent', genreOf(g).accent);
            R.innerHTML = `<div class="reel-card${i === pool.length - 1 ? ' land' : ''}"><div class="reel-art">${gameArt(g)}</div><p>${esc(g.title)}</p></div><p class="reel-label">Shuffling…</p>`;
            sfx.reel(i);
            this.blink();
            i++;
            if (i < pool.length) setTimeout(step, 34 + i * i * 1.1);
            else {
                sfx.fav(true);
                setTimeout(() => {
                    R.hidden = true;
                    this.busy = false;
                    open();
                }, 620);
            }
        };
        step();
    }

    // ------------------------------------------------------------ focus: backdrop + sleeve

    focusGame(g) {
        if (!g || this.focused === g) return;
        this.focused = g;
        clearTimeout(this.focusT);
        this.focusT = setTimeout(() => this.paintFocus(g), 150);
    }

    paintFocus(g) {
        if (!wide.matches) return;
        const amb = $('ambient');
        if (amb.lastElementChild?.dataset.id !== g.id) {
            const layer = document.createElement('div');
            layer.className = 'amb';
            layer.dataset.id = g.id;
            layer.style.backgroundImage = `url("${thumbUrl(g)}")`;
            layer.style.setProperty('--accent', genreOf(g).accent);
            amb.append(layer);
            requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
            while (amb.children.length > 2) amb.firstElementChild.remove();
        }
        this.renderSleeve(g);
    }

    renderSleeve(g) {
        const S = $('sleeve');
        if (getComputedStyle(S).display === 'none') return;
        const same = this.sleeveGame === g;
        this.sleeveGame = g;
        const gen = genreOf(g);
        const fav = this.store.isFav(g.id);
        S.style.setProperty('--accent', gen.accent);
        S.style.setProperty('--accent2', gen.accent2);
        S.innerHTML = `
            <article class="sl-case${same ? '' : ' fresh'}" aria-label="${esc(g.title)}">
                <div class="sl-spine" aria-hidden="true"><span>POCKET GARDEN</span><b>No.${String(gameNo(g)).padStart(3, '0')}</b></div>
                <div class="sl-front">
                    <figure class="sl-art">${gameArt(g)}<span class="sl-badge">${gen.emoji} ${esc(gen.short)}</span></figure>
                    <div class="sl-body">
                        <p class="sl-kicker">${esc(gen.name)}</p>
                        <h2>${esc(g.title)}</h2>
                        <p class="sl-meta">${g.version ? `Version ${esc(g.version)} · ` : ''}${esc(g.id)}</p>
                        <div class="sl-tags">${g.tags.map((t) => `<span class="tag">${t.emoji} ${esc(t.label)}</span>`).join('')}</div>
                        <p class="sl-desc">${esc(excerpt(g.description, 360))}</p>
                        <div class="sl-actions">
                            <a class="sl-play" href="${esc(playUrl(g))}">▶ Play</a>
                            <button type="button" class="sl-star${fav ? ' on' : ''}" aria-pressed="${fav}">${fav ? '★ Favorite' : '☆ Favorite'}</button>
                            <button type="button" class="sl-open">Cartridge</button>
                        </div>
                    </div>
                </div>
            </article>`;
    }

    // ------------------------------------------------------------ menus

    favGames() {
        return [...this.store.favs]
            .reverse()
            .map((id) => byId.get(id))
            .filter(Boolean);
    }

    recentGames() {
        return this.store.recent.map((r) => byId.get(r.id)).filter(Boolean);
    }

    homeView() {
        return new ListView(this, {
            title: 'Pocket Garden',
            preview: 'hero',
            favDriven: true,
            onPlay: () => {
                const last = this.recentGames()[0];
                if (last) {
                    this.toast(`▶ Resuming ${last.title}`);
                    this.play(last);
                } else this.shuffle();
            },
            getItems: () => {
                const favs = this.favGames();
                const recent = this.recentGames();
                return [
                    {
                        label: 'All Games',
                        icon: ICONS.all,
                        meta: ALL.length,
                        hero: { pool: () => shuffled(ALL).slice(0, 14), caption: `${ALL.length} games, A to Z` },
                        action: () => this.push(this.gamesList('All Games', ALPHA, { az: true })),
                    },
                    {
                        label: 'New Arrivals',
                        icon: ICONS.new,
                        hero: { pool: () => NEWEST.slice(0, 8), caption: 'Newest games first' },
                        action: () => this.push(this.gamesList('New Arrivals', NEWEST)),
                    },
                    {
                        label: 'Genres',
                        icon: ICONS.genres,
                        meta: GENRE_GROUPS.length,
                        hero: { pool: () => GENRE_GROUPS.map((x) => x.games[0]), caption: GENRE_GROUPS.map((x) => x.genre.emoji).join(' ') },
                        action: () => this.push(this.genresView()),
                    },
                    {
                        label: 'Favorites',
                        icon: ICONS.fav,
                        meta: favs.length,
                        hero: { pool: () => favs, glyph: ICONS.fav, caption: favs.length ? 'Shared with the Garden' : 'Hold ● on a game to star it' },
                        action: () => this.push(this.favoritesView()),
                    },
                    {
                        label: 'Recently Played',
                        icon: ICONS.recent,
                        meta: recent.length || '',
                        hero: { pool: () => recent.slice(0, 8), glyph: ICONS.recent, caption: recent.length ? `Last: ${recent[0].title}` : 'Nothing played yet' },
                        action: () => this.push(this.recentView()),
                    },
                    {
                        label: 'Cover Flow',
                        icon: ICONS.cover,
                        hero: { pool: () => shuffled(ALL).slice(0, 10), caption: 'Flip through the box art' },
                        action: () => this.push(new CoverFlowView(this, { list: ALPHA, index: 0 })),
                    },
                    { label: 'Search', icon: ICONS.search, hero: { glyph: ICONS.search, caption: 'By title or description' }, action: () => this.openSearch('') },
                    { label: 'Shuffle', icon: ICONS.shuffle, chev: false, hero: { glyph: ICONS.shuffle, caption: 'Let the console pick' }, action: () => this.shuffle() },
                    { label: 'Settings', icon: ICONS.settings, hero: { glyph: ICONS.settings, caption: 'Shell, screen and sound' }, action: () => this.push(this.settingsView()) },
                    { label: 'About', icon: ICONS.about, hero: { glyph: ICONS.about, caption: `Firmware ${CONSOLE_VERSION}` }, action: () => this.push(this.aboutView()) },
                ];
            },
        });
    }

    gamesList(title, list, { az = false } = {}) {
        return new ListView(this, { title, preview: 'game', az, getItems: () => list.map((g) => ({ game: g })) });
    }

    genresView() {
        return new ListView(this, {
            title: 'Genres',
            preview: 'hero',
            items: GENRE_GROUPS.map(({ genre, games: list }) => ({
                label: genre.short,
                say: `${genre.short}, ${list.length} games`,
                icon: `<span class="emo">${genre.emoji}</span>`,
                meta: list.length,
                accent: genre.accent,
                hero: { pool: () => list.slice(0, 10), caption: genre.name },
                action: () => this.push(this.gamesList(genre.short, list)),
            })),
        });
    }

    favoritesView() {
        return new ListView(this, {
            title: 'Favorites',
            preview: 'game',
            favDriven: true,
            getItems: () => this.favGames().map((g) => ({ game: g })),
            empty: `<div class="empty-art">${ICONS.fav}</div><p><b>No favorites yet.</b></p><p>Hold the center button, long-press a game, or press F to star it. Stars are shared with the Garden of Games.</p>`,
        });
    }

    recentView() {
        return new ListView(this, {
            title: 'Recently Played',
            preview: 'game',
            getItems: () => this.store.recent.filter((r) => byId.has(r.id)).map((r) => ({ game: byId.get(r.id), meta: timeAgo(r.t) })),
            empty: `<div class="empty-art">${ICONS.recent}</div><p><b>Nothing played yet.</b></p><p>Games you start from the console show up here, newest first.</p>`,
        });
    }

    settingsView() {
        const s = this.store.settings;
        let view;
        const cycle = (key, opts) => (dir) => {
            const i = Math.max(0, opts.findIndex((o) => o[0] === s[key]));
            this.store.set(key, opts[(i + dir + opts.length) % opts.length][0]);
            this.applySettings();
            sfx.toggle();
            view.refresh();
            this.say(`${key}: ${opts.find((o) => o[0] === s[key])[1]}`);
        };
        const flip = (key, label) => () => {
            this.store.set(key, !s[key]);
            this.applySettings();
            sfx.toggle();
            view.refresh();
            this.say(`${label} ${s[key] ? 'on' : 'off'}`);
        };
        view = new ListView(this, {
            title: 'Settings',
            getItems: () =>
                [
                    { label: 'Click sound', icon: ICONS.sound, meta: s.sound ? 'On' : 'Off', cycle: flip('sound', 'Click sound') },
                    'vibrate' in navigator ? { label: 'Haptics', icon: ICONS.haptics, meta: s.haptics ? 'On' : 'Off', cycle: flip('haptics', 'Haptics') } : null,
                    { label: 'Shell', icon: ICONS.shell, meta: SHELLS.find((x) => x[0] === s.shell)?.[1] ?? 'Mint', cycle: cycle('shell', SHELLS) },
                    { label: 'Screen', icon: ICONS.screen, meta: GLOWS.find((x) => x[0] === s.glow)?.[1] ?? 'Mint glow', cycle: cycle('glow', GLOWS) },
                    { label: 'Open games', icon: ICONS.tab, meta: s.newTab ? 'New tab' : 'This tab', cycle: flip('newTab', 'Open games in a new tab') },
                    {
                        label: 'Clear play history',
                        icon: ICONS.trash,
                        meta: `${this.store.recent.length}`,
                        chev: false,
                        action: () => {
                            if (!this.store.recent.length) return this.deny();
                            this.store.clearRecent();
                            this.toast('Play history cleared');
                            view.refresh();
                        },
                    },
                ].filter(Boolean),
        });
        return view;
    }

    aboutView() {
        return new ListView(this, {
            title: 'About',
            items: [
                { label: 'Pocket Garden', icon: ICONS.chip, meta: `v${CONSOLE_VERSION}`, chev: false, action: () => this.toast('Vanilla HTML, CSS and JS. No cartridges were harmed.') },
                { label: 'Games', icon: ICONS.all, meta: ALL.length, action: () => this.push(this.gamesList('All Games', ALPHA, { az: true })) },
                { label: 'Newest', icon: ICONS.new, meta: NEWEST[0]?.title, action: () => this.openGame(NEWEST, 0) },
                { label: 'Controls', icon: ICONS.keys, action: () => this.push(this.helpView()) },
                { label: 'Walk the Garden', icon: ICONS.garden, href: '../index.html' },
                { label: 'Classic list', icon: ICONS.list, href: '../classic.html' },
                { label: 'About Andrew', icon: ICONS.person, href: 'https://linktr.ee/triptych', ext: true },
            ],
        });
    }

    helpView() {
        return new TextView(this, {
            title: 'Controls',
            html: `
                <h3>Click wheel</h3>
                <ul>
                    <li><b>Turn</b> the ring to scroll. Spin fast to fly through long lists.</li>
                    <li><b>●</b> center selects. <b>Hold ●</b> to star or unstar a game.</li>
                    <li><b>MENU</b> goes back. <b>⏮ ⏭</b> page through lists or flip cartridges.</li>
                    <li><b>⏯</b> plays the highlighted game. On the main menu it resumes your last game.</li>
                </ul>
                <h3>Touch</h3>
                <ul>
                    <li>Tap a row to open it, scroll lists with your finger.</li>
                    <li>Long-press a game to star it.</li>
                    <li>Swipe right to go back. On a cartridge, swipe to flip to the next one.</li>
                    <li>In Cover Flow, drag or fling the covers and tap the middle one.</li>
                </ul>
                <h3>Keyboard</h3>
                <ul>
                    <li><kbd>↑</kbd> <kbd>↓</kbd> scroll · <kbd>Enter</kbd> or <kbd>→</kbd> select · <kbd>Esc</kbd> or <kbd>←</kbd> back</li>
                    <li><kbd>Space</kbd> play · <kbd>F</kbd> star · <kbd>PgUp</kbd> <kbd>PgDn</kbd> page</li>
                    <li>Start typing anywhere to search titles and descriptions; <kbd>/</kbd> opens search.</li>
                </ul>
                <h3>Favorites</h3>
                <p>Your stars are the same ones the Garden of Games uses, so a game starred on the island is starred here too.</p>`,
        });
    }

    // ------------------------------------------------------------ settings, boot, battery

    applySettings() {
        const s = this.store.settings;
        this.device.dataset.shell = SHELLS.some((x) => x[0] === s.shell) ? s.shell : 'mint';
        this.device.dataset.glow = GLOWS.some((x) => x[0] === s.glow) ? s.glow : 'mint';
        setSound(s.sound);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = matchMedia('(max-width: 560px)').matches ? SHELLS.find((x) => x[0] === this.device.dataset.shell)[2] : '#141719';
    }

    boot(show) {
        const B = $('boot');
        this.device.classList.add('on');
        if (!show || reduceMotion.matches) {
            B.remove();
            return;
        }
        B.classList.add('run');
        this.bootT = setTimeout(() => this.skipBoot(), 2100);
    }

    skipBoot() {
        const B = $('boot');
        if (!B || B.dataset.gone) return;
        B.dataset.gone = '1';
        clearTimeout(this.bootT);
        B.classList.add('gone');
        setTimeout(() => B.remove(), 420);
    }

    initBattery() {
        const el = $('battery');
        el.style.setProperty('--lvl', '0.92');
        navigator
            .getBattery?.()
            .then((b) => {
                const upd = () => {
                    el.style.setProperty('--lvl', String(b.level));
                    el.classList.toggle('charging', b.charging);
                    el.classList.toggle('low', b.level < 0.2 && !b.charging);
                };
                upd();
                b.addEventListener('levelchange', upd);
                b.addEventListener('chargingchange', upd);
            })
            .catch(() => {});
    }
}

const app = new App();
// handy for the browser test and for poking around in the console
window.pocketGarden = app;
