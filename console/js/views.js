// The screens the console can show. The app keeps them on a stack, like the
// menus of a music player: push slides a screen in from the right, MENU slides
// it back out. Each one answers the same handful of inputs (tick, select,
// prev/next, play, hold) whether they came from the click wheel, the
// keyboard, a tap or a swipe.

import { genreOf } from '../../garden/js/genres.js';
import { esc, clamp, excerpt, gameNo, thumbUrl, playUrl, azLetter, markText, descSnippet, searchGames } from './util.js';
import { ICONS } from './icons.js';
import { gameIcon } from '../../js/gamedata.js';

let uid = 0;
const HOLD_MS = 520;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/** A game's painted icon (game-NNN/icons/, made with fal), as a little tile. */
export function gameIconHTML(g, size = 96) {
    return `<i class="gi" style="background-image:url('${gameIcon(g, size)}')"></i>`;
}

/** A game's picture over its painted icon, which shows if the picture is missing. */
export function gameArt(g) {
    return `<span class="art-icon" aria-hidden="true">${gameIconHTML(g, 192)}</span><img src="${thumbUrl(g)}" alt="" decoding="async" onload="this.classList.add('in')" onerror="this.remove()">`;
}

const pad3 = (n) => String(n).padStart(3, '0');
const relTop = (el, scroller) => el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

export class View {
    constructor(app, title = '') {
        this.app = app;
        this.title = title;
        this.id = ++uid;
    }
    get type() {
        return 'view';
    }
    /** Make the element; the app puts it in the page and then calls build(). */
    mount() {
        const el = document.createElement('section');
        el.className = `view v-${this.type}`;
        el.setAttribute('aria-label', this.title);
        this.el = el;
        return el;
    }
    build() {}
    /** The view is on top again after the one above it closed. */
    refresh() {}
    /** The view is on top and laid out. */
    shown() {}
    /** Another view covers it (or it is closing). */
    hidden() {}
    destroy() {
        this.hidden();
    }
    layout() {}
    statusTitle() {
        return this.title;
    }
    currentGame() {
        return null;
    }
    onTick() {
        return false;
    }
    onSelect() {
        this.app.deny();
    }
    onPrev() {
        this.app.deny();
    }
    onNext() {
        this.app.deny();
    }
    onPlay() {
        const g = this.currentGame();
        if (g) this.app.play(g);
        else this.app.deny();
    }
    onHold() {
        const g = this.currentGame();
        if (g) this.app.toggleFav(g);
        else this.app.deny();
    }
    onSwipe(dir) {
        if (dir === 'right') this.app.back();
    }
    onHome() {}
    onEnd() {}
    favChanged() {}
}

// ------------------------------------------------------------------ lists

/**
 * A scrolling list of rows: menus, game lists, genres, settings.
 * item: { label, labelHTML?, subHTML?, icon?, meta?, game?, accent?, chev?,
 *         action?(item, view), cycle?(dir), href?, ext?, hero?: { pool(), caption, glyph } }
 */
export class ListView extends View {
    constructor(app, { title, items = [], getItems = null, preview = 'none', az = false, empty = '', favDriven = false, onPlay = null, head = '', cls = '' }) {
        super(app, title);
        Object.assign(this, { getItems, preview, az, empty, favDriven, playFallback: onPlay, head, cls });
        this.items = items;
        this.index = 0;
    }
    get type() {
        return 'list';
    }

    build() {
        if (this.getItems) this.items = this.getItems();
        const el = this.el;
        el.classList.add('v-list');
        if (this.cls) el.classList.add(this.cls);
        el.classList.toggle('has-preview', this.preview !== 'none');
        el.classList.toggle('hero', this.preview === 'hero');
        el.innerHTML = `
            ${this.preview !== 'none' ? '<aside class="preview" aria-hidden="true"></aside>' : ''}
            <div class="list-col">
                ${this.head}
                <div class="list-wrap">
                    <div class="list" role="listbox" aria-label="${esc(this.title)}"></div>
                    <div class="scrollbar" aria-hidden="true"><i></i></div>
                </div>
            </div>`;
        this.listEl = el.querySelector('.list');
        this.pvEl = el.querySelector('.preview');
        this.sbEl = el.querySelector('.scrollbar');
        this.bindRows();
        this.renderRows();
    }

    rowHTML(it, i) {
        const g = it.game;
        const accent = g ? genreOf(g).accent : it.accent;
        const fav = g && this.app.store.isFav(g.id);
        const tag = it.href ? 'a' : 'button';
        const attrs = it.href ? `href="${esc(it.href)}"${it.ext ? ' target="_blank" rel="noopener"' : ''}` : 'type="button"';
        const cls = ['row', g ? 'game' : 'menu', it.subHTML ? 'two' : '', it.cycle ? 'setting' : ''].filter(Boolean).join(' ');
        const meta = it.meta != null && it.meta !== '' ? `<span class="r-meta">${it.cycle ? '◂ ' : ''}${esc(it.meta)}${it.cycle ? ' ▸' : ''}</span>` : '';
        const chev = it.chev === false || it.cycle ? '' : `<span class="r-chev" aria-hidden="true">${it.ext ? '↗' : '›'}</span>`;
        return `<${tag} ${attrs} class="${cls}" role="option" id="r${this.id}-${i}" data-i="${i}" tabindex="-1" aria-selected="false"${accent ? ` style="--accent:${accent}"` : ''}>
            <span class="r-icon" aria-hidden="true">${it.icon ?? (g ? gameIconHTML(g) : '')}</span>
            <span class="r-body"><span class="r-label"><span class="r-text">${it.labelHTML ?? esc(it.label ?? g?.title ?? '')}</span></span>${it.subHTML ? `<span class="r-sub">${it.subHTML}</span>` : ''}</span>
            ${g ? `<span class="r-fav" aria-hidden="true">${fav ? '★' : ''}</span>` : ''}${meta}${chev}
        </${tag}>`;
    }

    row(i) {
        const r = this.listEl.children[i];
        return r && r.classList.contains('row') ? r : null;
    }

    renderRows() {
        const n = this.items.length;
        if (!n) {
            this.listEl.innerHTML = `<div class="empty">${this.empty}</div>`;
            this.listEl.removeAttribute('aria-activedescendant');
            this.pvGame = null;
            this.heroItem = null;
            if (this.pvEl) this.pvEl.innerHTML = '';
            this.updateScrollbar();
            return;
        }
        this.listEl.innerHTML = this.items.map((it, i) => this.rowHTML(it, i)).join('');
        this.index = clamp(this.index, 0, n - 1);
        this.setIndex(this.index, { quiet: true });
    }

    setIndex(i, { quiet = false, scroll = true } = {}) {
        const n = this.items.length;
        if (!n) return;
        i = clamp(i, 0, n - 1);
        const old = this.row(this.index);
        if (old) {
            old.classList.remove('sel', 'marquee');
            old.setAttribute('aria-selected', 'false');
        }
        this.index = i;
        const row = this.row(i);
        if (!row) return;
        row.classList.add('sel');
        row.setAttribute('aria-selected', 'true');
        this.listEl.setAttribute('aria-activedescendant', row.id);
        if (scroll) this.ensureVisible(row);
        this.marquee(row);
        this.renderPreview();
        this.updateScrollbar();
        const it = this.items[i];
        // a view refreshed underneath another one stays quiet
        if (this.app.top !== this) return;
        if (!quiet) this.app.say(it.say || [it.label ?? it.game?.title, it.meta].filter((x) => x != null && x !== '').join(', '));
        if (it.game) this.app.focusGame(it.game);
    }

    ensureVisible(row) {
        const L = this.listEl;
        const top = row.offsetTop;
        const bot = top + row.offsetHeight;
        if (top < L.scrollTop + 2) L.scrollTop = top - 4;
        else if (bot > L.scrollTop + L.clientHeight - 2) L.scrollTop = bot - L.clientHeight + 4;
    }

    /** Long titles on the highlighted row scroll back and forth. */
    marquee(row) {
        requestAnimationFrame(() => {
            if (!row.classList.contains('sel')) return;
            const box = row.querySelector('.r-label');
            const over = box ? box.scrollWidth - box.clientWidth : 0;
            if (over > 3) {
                row.style.setProperty('--mq', `${-over - 8}px`);
                row.style.setProperty('--mqt', `${Math.max(2.4, over / 26).toFixed(2)}s`);
                row.classList.add('marquee');
            }
        });
    }

    updateScrollbar() {
        const L = this.listEl;
        const sb = this.sbEl;
        if (!L || !sb) return;
        const h = L.clientHeight;
        const sh = L.scrollHeight;
        if (!h || sh <= h + 2) {
            sb.classList.remove('on');
            return;
        }
        sb.classList.add('on');
        const track = sb.clientHeight;
        const th = Math.max(16, (track * h) / sh);
        const top = (track - th) * (L.scrollTop / (sh - h));
        sb.style.setProperty('--sb-h', `${th}px`);
        sb.style.setProperty('--sb-top', `${top}px`);
    }

    bindRows() {
        const L = this.listEl;
        let hold = null;
        const cancel = () => {
            if (!hold) return;
            clearTimeout(hold.timer);
            hold.row.classList.remove('touch');
            hold = null;
        };
        L.addEventListener('pointerdown', (e) => {
            this.suppress = false;
            const row = e.target.closest('.row');
            if (!row || e.button > 0) return;
            row.classList.add('touch');
            hold = { x: e.clientX, y: e.clientY, row };
            hold.timer = setTimeout(() => {
                const i = +row.dataset.i;
                const it = this.items[i];
                cancel();
                if (!it?.game) return;
                this.suppress = true;
                this.setIndex(i, { scroll: false, quiet: true });
                this.app.toggleFav(it.game, row);
            }, HOLD_MS);
        });
        L.addEventListener('pointermove', (e) => {
            if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 9) cancel();
            // a mouse moving over the list moves the highlight with it
            if (e.pointerType === 'mouse' && finePointer.matches) {
                const row = e.target.closest('.row');
                if (row && +row.dataset.i !== this.index) this.setIndex(+row.dataset.i, { scroll: false, quiet: true });
            }
        });
        L.addEventListener('pointerup', cancel);
        L.addEventListener('pointercancel', cancel);
        L.addEventListener(
            'scroll',
            () => {
                cancel();
                this.updateScrollbar();
            },
            { passive: true },
        );
        L.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.row')) e.preventDefault();
        });
        L.addEventListener('click', (e) => {
            const row = e.target.closest('.row');
            if (!row) return;
            if (this.suppress || this.app.swiped) {
                e.preventDefault();
                this.suppress = false;
                return;
            }
            const i = +row.dataset.i;
            this.setIndex(i, { scroll: false, quiet: true });
            if (row.tagName === 'A') return; // a real link: let it go
            this.app.feedback();
            this.onSelect();
        });
    }

    // ----- preview pane (side on wide screens, top band for the home menu)

    renderPreview() {
        if (!this.pvEl) return;
        const it = this.items[this.index];
        // the slideshow only runs on the top view; shown() starts it
        if (this.preview === 'hero') return this.app.top === this ? this.hero(it) : undefined;
        const g = it?.game;
        if (!g || g === this.pvGame) return;
        this.pvGame = g;
        clearTimeout(this.pvTimer);
        // wait for the wheel to settle before swapping pictures
        this.pvTimer = setTimeout(() => {
            const gen = genreOf(g);
            this.pvEl.style.setProperty('--accent', gen.accent);
            this.pvEl.innerHTML = `
                <figure class="pv-art">${gameArt(g)}</figure>
                <div class="pv-text">
                    <p class="pv-genre">${gen.emoji} ${esc(gen.short)}</p>
                    <h3>${esc(g.title)}</h3>
                    <p class="pv-meta">No.${pad3(gameNo(g))}${g.version ? ` · v${esc(g.version)}` : ''}${this.app.playersOf(g) ? ` · 👥 ${esc(this.app.playersOf(g))}` : ''}</p>
                    <p class="pv-desc">${esc(excerpt(g.description, 170))}</p>
                </div>`;
        }, 70);
    }

    hero(it) {
        const h = it?.hero;
        if (!h || this.heroItem === it) return;
        this.heroItem = it;
        clearInterval(this.heroTimer);
        const pool = (h.pool ? h.pool() : []).filter(Boolean);
        const caption = typeof h.caption === 'function' ? h.caption() : h.caption || '';
        const P = this.pvEl;
        P.style.removeProperty('--accent');
        if (!pool.length) {
            P.className = 'preview glyph';
            P.innerHTML = `<div class="hero-glyph">${h.glyph || it.icon || ''}</div><p class="hero-cap"><span class="hero-title">${esc(it.label)}</span><small>${esc(caption)}</small></p>`;
            return;
        }
        P.className = 'preview slides';
        P.innerHTML = `<div class="hero-frames"></div><p class="hero-cap"><span class="hero-title"></span><small>${esc(caption)}</small></p>`;
        const frames = P.querySelector('.hero-frames');
        const title = P.querySelector('.hero-title');
        let k = 0;
        const show = () => {
            const g = pool[k++ % pool.length];
            const f = document.createElement('div');
            f.className = 'hero-frame';
            f.style.setProperty('--accent', genreOf(g).accent);
            f.innerHTML = gameArt(g);
            frames.append(f);
            while (frames.children.length > 2) frames.firstElementChild.remove();
            requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('on')));
            title.textContent = g.title;
            this.app.focusGame(g);
        };
        show();
        if (pool.length > 1) this.heroTimer = setInterval(show, 3600);
    }

    // ----- lifecycle

    refresh() {
        if (!this.getItems) return this.favChanged();
        const keep = this.items[this.index];
        this.items = this.getItems();
        if (keep?.game) {
            const i = this.items.findIndex((x) => x.game === keep.game);
            if (i >= 0) this.index = i;
        }
        this.heroItem = null;
        this.pvGame = null;
        this.renderRows();
    }

    shown() {
        this.layout();
        if (this.preview === 'hero' && !this.heroItem) this.renderPreview();
        const it = this.items[this.index];
        if (it?.game) this.app.focusGame(it.game);
    }

    hidden() {
        clearInterval(this.heroTimer);
        this.heroItem = null;
    }

    layout() {
        const row = this.row(this.index);
        if (row) {
            this.ensureVisible(row);
            row.classList.remove('marquee');
            this.marquee(row);
        }
        this.updateScrollbar();
    }

    countsChanged() {
        if (this.preview !== 'game') return;
        this.pvGame = null;
        this.renderPreview();
    }

    favChanged() {
        if (this.favDriven && this.getItems) return this.refresh();
        this.listEl?.querySelectorAll('.row.game').forEach((r) => {
            const g = this.items[+r.dataset.i]?.game;
            const s = r.querySelector('.r-fav');
            if (g && s) s.textContent = this.app.store.isFav(g.id) ? '★' : '';
        });
    }

    // ----- input

    currentGame() {
        return this.items[this.index]?.game || null;
    }

    gameList() {
        return this.items.filter((x) => x.game).map((x) => x.game);
    }

    onTick(d, fast) {
        const n = this.items.length;
        if (!n) {
            this.app.bump(this.listEl, d);
            return false;
        }
        const step = fast && n > 30 ? 3 : 1;
        const next = clamp(this.index + d * step, 0, n - 1);
        if (next === this.index) {
            this.app.bump(this.listEl, d);
            return false;
        }
        this.setIndex(next, { quiet: fast });
        if (this.az && fast && this.items[next].game) this.app.azFlash(azLetter(this.items[next].game));
        return true;
    }

    page(d) {
        const it = this.items[this.index];
        if (it?.cycle) return it.cycle(d);
        if (!this.items.length) return this.app.deny();
        const rh = this.row(0)?.offsetHeight || 44;
        const per = Math.max(1, Math.floor(this.listEl.clientHeight / rh) - 1);
        const next = clamp(this.index + d * per, 0, this.items.length - 1);
        if (next === this.index) return this.app.bump(this.listEl, d);
        this.setIndex(next);
    }
    onPrev() {
        this.page(-1);
    }
    onNext() {
        this.page(1);
    }
    onHome() {
        this.setIndex(0);
    }
    onEnd() {
        this.setIndex(this.items.length - 1);
    }

    onSelect() {
        const it = this.items[this.index];
        if (!it) return this.app.deny();
        if (it.cycle) return it.cycle(1);
        if (it.action) return it.action(it, this);
        if (it.href) {
            if (it.ext) window.open(it.href, '_blank', 'noopener');
            else location.assign(it.href);
            return;
        }
        if (it.game) {
            const list = this.gameList();
            this.app.openGame(list, list.indexOf(it.game));
        }
    }

    onPlay() {
        if (this.currentGame()) return super.onPlay();
        if (this.playFallback) return this.playFallback();
        this.app.deny();
    }
}

// ------------------------------------------------------------------ cartridge

export class DetailView extends View {
    constructor(app, { list, index }) {
        super(app, 'Cartridge');
        this.list = list;
        this.index = clamp(index, 0, list.length - 1);
        this.act = 0;
    }
    get type() {
        return 'detail';
    }
    statusTitle() {
        return `No.${pad3(gameNo(this.currentGame()))}`;
    }
    currentGame() {
        return this.list[this.index];
    }

    build() {
        this.el.innerHTML = '<div class="d-scroll"></div>';
        this.box = this.el.firstElementChild;
        this.render(0);
        this.el.addEventListener('click', (e) => {
            if (this.app.swiped) return e.preventDefault();
            const nav = e.target.closest('[data-nav]');
            if (nav) {
                this.app.feedback('press');
                return this.go(+nav.dataset.nav);
            }
            const a = e.target.closest('[data-act]');
            if (!a) return;
            const i = [...this.el.querySelectorAll('.act')].indexOf(a);
            this.selectAct(i, false);
            if (a.tagName === 'A') {
                this.app.store.played(this.currentGame().id);
                return; // the link opens the new tab itself
            }
            this.app.feedback();
            this.run(a.dataset.act);
        });
        // the cartridge leans towards the mouse
        this.el.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const cart = this.el.querySelector('.cart');
            const stage = e.target.closest('.cart-stage');
            if (!cart) return;
            if (!stage) return cart.style.removeProperty('--rx'), cart.style.removeProperty('--ry');
            const r = stage.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            cart.style.setProperty('--ry', `${(x * 22).toFixed(1)}deg`);
            cart.style.setProperty('--rx', `${(-y * 16).toFixed(1)}deg`);
        });
        this.el.addEventListener('pointerleave', () => {
            const cart = this.el.querySelector('.cart');
            cart?.style.removeProperty('--rx');
            cart?.style.removeProperty('--ry');
        });
    }

    /** On a wide screen the info column scrolls by itself; otherwise the whole view does. */
    get scroller() {
        const info = this.el.querySelector('.d-info');
        return info && getComputedStyle(info).overflowY === 'auto' ? info : this.box;
    }

    actions() {
        const g = this.currentGame();
        const fav = this.app.store.isFav(g.id);
        return [
            { id: 'play', icon: ICONS.play, label: 'Play' },
            { id: 'fav', icon: ICONS.fav, label: fav ? 'In your Favorites' : 'Add to Favorites', on: fav },
            { id: 'tab', icon: ICONS.tab, label: 'Play in a new tab', href: playUrl(g) },
        ];
    }

    actionsHTML() {
        return this.actions()
            .map((a, i) => {
                const tag = a.href ? 'a' : 'button';
                const attrs = a.href ? `href="${esc(a.href)}" target="_blank" rel="noopener"` : 'type="button"';
                return `<${tag} ${attrs} class="row menu act${a.on ? ' on' : ''}" data-act="${a.id}" role="option" id="a${this.id}-${i}" tabindex="-1" aria-selected="false"><span class="r-icon" aria-hidden="true">${a.icon}</span><span class="r-body"><span class="r-label"><span class="r-text">${esc(a.label)}</span></span></span></${tag}>`;
            })
            .join('');
    }

    render(dir) {
        const g = this.currentGame();
        const gen = genreOf(g);
        const fav = this.app.store.isFav(g.id);
        this.el.style.setProperty('--accent', gen.accent);
        this.el.style.setProperty('--accent2', gen.accent2);
        const anim = dir > 0 ? 'swap-next' : dir < 0 ? 'swap-prev' : 'drop';
        this.box.innerHTML = `
            <div class="cart-stage">
                <button type="button" class="cart-nav prev" data-nav="-1" aria-label="Previous game">‹</button>
                <div class="cart ${anim}">
                    <div class="cart-body">
                        <div class="cart-grip" aria-hidden="true"></div>
                        <div class="cart-label">
                            <div class="cart-art">${gameArt(g)}</div>
                            <div class="cart-strip"><span class="cart-title">${esc(g.title)}</span><span class="cart-no">No.${pad3(gameNo(g))}</span></div>
                        </div>
                        <div class="cart-shine" aria-hidden="true"></div>
                    </div>
                </div>
                <button type="button" class="cart-nav next" data-nav="1" aria-label="Next game">›</button>
                <p class="cart-count">${this.index + 1} / ${this.list.length}</p>
            </div>
            <div class="d-info">
                <p class="d-genre">${gen.emoji} ${esc(gen.short)} <span>· ${esc(gen.name)}</span></p>
                <h2 class="d-title"><span class="d-star" aria-label="Favorite">${fav ? '★' : ''}</span>${esc(g.title)}</h2>
                <p class="d-meta">${g.version ? `v${esc(g.version)} · ` : ''}${esc(g.id)}<span class="d-players">${this.playersHTML(g)}</span></p>
                <div class="d-actions" role="listbox" aria-label="Actions">${this.actionsHTML()}</div>
                <div class="d-tags">${g.tags.map((t) => `<span class="tag">${t.emoji} ${esc(t.label)}</span>`).join('')}</div>
                <p class="d-desc">${esc(g.description)}</p>
                <p class="d-hint">⏮ ⏭ or swipe for the next cartridge · hold ● to star</p>
            </div>`;
        this.box.scrollTop = 0;
        this.selectAct(this.act, false);
        this.app.focusGame(g);
        this.app.updateStatus();
    }

    playersHTML(g) {
        const p = this.app.playersOf(g);
        return p ? ` · <span aria-hidden="true">👥</span> ${esc(p)}` : '';
    }

    countsChanged() {
        const el = this.el.querySelector('.d-players');
        if (el) el.innerHTML = this.playersHTML(this.currentGame());
    }

    selectAct(i, scroll = true) {
        const acts = [...this.el.querySelectorAll('.act')];
        this.act = clamp(i, 0, acts.length - 1);
        acts.forEach((a, k) => {
            a.classList.toggle('sel', k === this.act);
            a.setAttribute('aria-selected', String(k === this.act));
        });
        const row = acts[this.act];
        if (scroll && row) {
            const S = this.scroller;
            const top = relTop(row, S);
            if (top < S.scrollTop) S.scrollTop = top - 8;
            else if (top + row.offsetHeight > S.scrollTop + S.clientHeight) S.scrollTop = top + row.offsetHeight - S.clientHeight + 8;
        }
    }

    onTick(d) {
        const acts = this.el.querySelectorAll('.act');
        const S = this.scroller;
        const max = S.scrollHeight - S.clientHeight;
        if (d > 0) {
            if (this.act < acts.length - 1) {
                this.selectAct(this.act + 1);
                this.app.say(acts[this.act].textContent.trim());
                return true;
            }
            if (S.scrollTop < max - 1) {
                S.scrollTop = Math.min(max, S.scrollTop + 40);
                return true;
            }
            this.app.bump(S, 1);
            return false;
        }
        const row = acts[this.act];
        if (row && S.scrollTop > relTop(row, S) - 8) {
            S.scrollTop = Math.max(0, Math.min(S.scrollTop - 40, relTop(row, S) - 8));
            return true;
        }
        if (this.act > 0) {
            this.selectAct(this.act - 1);
            this.app.say(acts[this.act].textContent.trim());
            return true;
        }
        if (S.scrollTop > 0) {
            S.scrollTop = 0;
            return true;
        }
        this.app.bump(S, -1);
        return false;
    }

    run(id) {
        const g = this.currentGame();
        if (id === 'play') this.app.play(g);
        else if (id === 'fav') this.app.toggleFav(g);
        else if (id === 'tab') {
            this.app.store.played(g.id);
            window.open(playUrl(g), '_blank', 'noopener');
        }
    }

    onSelect() {
        const a = this.el.querySelectorAll('.act')[this.act];
        if (a) this.run(a.dataset.act);
    }

    go(d) {
        const n = this.list.length;
        if (n < 2) return this.app.deny();
        this.index = (this.index + d + n) % n;
        this.act = 0;
        this.render(d);
        this.app.replaceUrl(`#${this.currentGame().id}`);
        this.app.say(`${this.currentGame().title}, ${this.index + 1} of ${n}`);
    }
    onPrev() {
        this.go(-1);
    }
    onNext() {
        this.go(1);
    }
    onSwipe(dir) {
        this.app.feedback('press');
        this.go(dir === 'left' ? 1 : -1);
    }

    favChanged() {
        const box = this.el.querySelector('.d-actions');
        if (!box) return;
        box.innerHTML = this.actionsHTML();
        this.selectAct(this.act, false);
        const star = this.el.querySelector('.d-star');
        if (star) star.textContent = this.app.store.isFav(this.currentGame().id) ? '★' : '';
    }

    shown() {
        this.app.focusGame(this.currentGame());
    }
}

// ------------------------------------------------------------------ cover flow

export class CoverFlowView extends View {
    constructor(app, { list, index = 0 }) {
        super(app, 'Cover Flow');
        this.list = list;
        this.pos = index;
        this.target = index;
        this.cards = new Map();
    }
    get type() {
        return 'cover';
    }
    currentGame() {
        return this.list[Math.round(this.target)];
    }

    build() {
        this.el.innerHTML = `<div class="cf-stage"></div><div class="cf-floor" aria-hidden="true"></div><div class="cf-cap" aria-live="off"><p class="cf-title"></p><p class="cf-sub"></p></div>`;
        this.stage = this.el.querySelector('.cf-stage');
        this.bindDrag();
        this.layout();
        this.caption();
    }

    layout() {
        const r = this.stage.getBoundingClientRect();
        if (!r.width) return;
        this.w = Math.max(80, Math.min(r.width * 0.5, r.height * 0.58 * 1.9));
        this.stage.style.setProperty('--cfw', `${this.w}px`);
        this.draw();
    }

    draw() {
        const n = this.list.length;
        const lo = Math.max(0, Math.floor(this.pos) - 6);
        const hi = Math.min(n - 1, Math.ceil(this.pos) + 6);
        for (const [i, el] of this.cards) {
            if (i < lo || i > hi) {
                el.remove();
                this.cards.delete(i);
            }
        }
        const w = this.w || 160;
        for (let i = lo; i <= hi; i++) {
            let el = this.cards.get(i);
            if (!el) {
                const g = this.list[i];
                el = document.createElement('div');
                el.className = 'cf-item';
                el.dataset.i = i;
                el.style.setProperty('--accent', genreOf(g).accent);
                el.innerHTML = gameArt(g);
                this.stage.append(el);
                this.cards.set(i, el);
            }
            const o = i - this.pos;
            const a = Math.abs(o);
            const s = Math.sign(o);
            const near = Math.min(a, 1);
            const x = s * (near * w * 0.6 + Math.max(0, a - 1) * w * 0.22);
            const z = -near * w * 0.55;
            const ry = -s * near * 64;
            el.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg)`;
            el.style.zIndex = String(1000 - Math.round(a * 10));
            el.style.opacity = a > 5.4 ? String(Math.max(0, 6.4 - a).toFixed(2)) : '';
            el.classList.toggle('center', a < 0.5);
        }
    }

    animate() {
        if (this.raf) return;
        const step = () => {
            const d = this.target - this.pos;
            if (Math.abs(d) < 0.002) {
                this.pos = this.target;
                this.draw();
                this.raf = 0;
                return;
            }
            this.pos += d * 0.2;
            this.draw();
            this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
    }

    setTarget(t, quiet) {
        const n = this.list.length;
        t = clamp(Math.round(t), 0, n - 1);
        const changed = t !== this.target;
        this.target = t;
        this.caption();
        this.animate();
        if (changed && !quiet) this.app.say(`${this.list[t].title}, ${t + 1} of ${n}`);
        return changed;
    }

    caption() {
        const i = clamp(Math.round(this.dragging ? this.pos : this.target), 0, this.list.length - 1);
        const g = this.list[i];
        const gen = genreOf(g);
        this.el.style.setProperty('--accent', gen.accent);
        this.el.querySelector('.cf-title').textContent = `${this.app.store.isFav(g.id) ? '★ ' : ''}${g.title}`;
        this.el.querySelector('.cf-sub').textContent = `${gen.emoji} ${gen.short} · ${i + 1} of ${this.list.length}`;
        this.app.focusGame(g);
    }

    bindDrag() {
        const S = this.stage;
        let d = null;
        S.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            try {
                S.setPointerCapture(e.pointerId);
            } catch {
                /* synthetic */
            }
            cancelAnimationFrame(this.raf);
            this.raf = 0;
            d = { id: e.pointerId, x: e.clientX, start: this.pos, moved: false, card: e.target.closest('.cf-item'), hist: [[performance.now(), e.clientX]] };
        });
        // follow the pointer; also called on release, since fast moves are
        // coalesced and the last pointermove can be well short of the release
        const follow = (e) => {
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 6) d.moved = true;
            if (!d.moved) return;
            this.dragging = true;
            const n = this.list.length;
            this.pos = clamp(d.start - dx / ((this.w || 160) * 0.4), -0.45, n - 0.55);
            d.hist.push([performance.now(), e.clientX]);
            if (d.hist.length > 6) d.hist.shift();
            this.draw();
            this.caption();
        };
        S.addEventListener('pointermove', (e) => {
            if (d && e.pointerId === d.id) follow(e);
        });
        const end = (e) => {
            if (!d || e.pointerId !== d.id) return;
            if (e.type === 'pointerup') follow(e);
            const was = d;
            d = null;
            this.dragging = false;
            if (!was.moved) {
                this.pos = this.pos; // stay put
                if (was.card) {
                    const i = +was.card.dataset.i;
                    if (i === this.target) {
                        this.app.feedback();
                        this.onSelect();
                    } else {
                        this.app.feedback('tick');
                        this.setTarget(i);
                    }
                } else this.animate();
                return;
            }
            const [t0, x0] = was.hist[0];
            const [t1, x1] = was.hist[was.hist.length - 1];
            const v = (x1 - x0) / Math.max(16, t1 - t0); // px per ms
            const fling = (-v * 160) / ((this.w || 160) * 0.4);
            const before = Math.round(this.target);
            this.setTarget(this.pos + clamp(fling, -8, 8), true);
            if (this.target !== before) this.app.feedback('tick');
            this.app.say(`${this.list[this.target].title}, ${this.target + 1} of ${this.list.length}`);
        };
        S.addEventListener('pointerup', end);
        S.addEventListener('pointercancel', end);
        let wacc = 0;
        S.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                wacc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                while (Math.abs(wacc) >= 50) {
                    const dir = Math.sign(wacc);
                    wacc -= dir * 50;
                    this.app.tick(dir);
                }
            },
            { passive: false },
        );
    }

    onTick(dir, fast) {
        if (!this.setTarget(this.target + dir * (fast ? 2 : 1), fast)) {
            this.app.bump(this.stage, dir);
            return false;
        }
        return true;
    }
    onPrev() {
        if (!this.setTarget(this.target - 5)) this.app.bump(this.stage, -1);
    }
    onNext() {
        if (!this.setTarget(this.target + 5)) this.app.bump(this.stage, 1);
    }
    onHome() {
        this.setTarget(0);
    }
    onEnd() {
        this.setTarget(this.list.length - 1);
    }
    onSelect() {
        this.app.openGame(this.list, this.target);
    }
    onSwipe() {
        /* dragging handles it */
    }
    refresh() {
        this.caption();
    }
    favChanged() {
        this.caption();
    }
    hidden() {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
    }
    shown() {
        this.layout();
        this.caption();
    }
}

// ------------------------------------------------------------------ search

const KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'SPACE', 'DEL', 'OK'];
const KEY_LABEL = { SPACE: '␣', DEL: '⌫', OK: 'OK' };

/**
 * Search by title and description. Type on a keyboard, or spell it out
 * the old way: turn the wheel along the letter rail and press the center
 * button for each letter. ⏯ (or OK) jumps down to the results.
 */
export class SearchView extends ListView {
    constructor(app, { query = '', all, genreText }) {
        const head = `
            <div class="s-head">
                <label class="s-field">
                    <span class="s-glyph">${ICONS.search}</span>
                    <input type="search" class="s-input" placeholder="Title or description…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search games by title or description">
                    <span class="s-count" aria-hidden="true"></span>
                </label>
                <div class="s-rail" role="toolbar" aria-label="Letter picker">${KEYS.map((k, i) => `<button type="button" class="key${k.length > 1 ? ' wide' : ''}" data-k="${i}" tabindex="-1" aria-label="${k === 'DEL' ? 'Delete' : k === 'SPACE' ? 'Space' : k === 'OK' ? 'Done' : k}">${KEY_LABEL[k] || k}</button>`).join('')}</div>
            </div>`;
        super(app, { title: 'Search', preview: 'game', head, cls: 'v-search' });
        this.all = all;
        this.genreText = genreText;
        this.query = query;
        this.key = 0;
        this.zone = 'rail';
        this.getItems = () => this.results();
        this.empty = this.emptyText();
    }
    get type() {
        return 'search';
    }

    emptyText() {
        if (this.query.trim())
            return `<div class="empty-art">${ICONS.search}</div><p><b>No games match “${esc(this.query.trim())}”.</b></p><p>Try fewer words, or part of a word.</p>`;
        return `<div class="empty-art">${ICONS.search}</div><p><b>Search ${this.all.length} games</b> by title or description.</p><p>Type, or turn the wheel along the letters and press ● to spell.</p>`;
    }

    results() {
        const q = this.query;
        return searchGames(this.all, q, this.genreText).map((g) => {
            const inTitle = q
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .every((t) => g.title.toLowerCase().includes(t));
            const snip = inTitle ? null : descSnippet(g.description, q);
            return { game: g, labelHTML: markText(g.title, q), subHTML: snip ? markText(snip, q) : null, say: g.title };
        });
    }

    build() {
        super.build();
        this.input = this.el.querySelector('.s-input');
        this.rail = this.el.querySelector('.s-rail');
        this.countEl = this.el.querySelector('.s-count');
        this.input.value = this.query;
        this.input.addEventListener('input', () => {
            this.zone = 'list';
            this.setQuery(this.input.value, false);
        });
        this.input.addEventListener('focus', () => {
            this.zone = 'list';
            this.renderZone();
        });
        this.rail.addEventListener('click', (e) => {
            const k = e.target.closest('.key');
            if (!k) return;
            this.zone = 'rail';
            this.key = +k.dataset.k;
            this.app.feedback('press');
            this.applyKey();
        });
        this.setQuery(this.query, false);
        this.renderZone();
    }

    setQuery(q, sync = true) {
        this.query = q;
        if (sync && this.input.value !== q) this.input.value = q;
        this.empty = this.emptyText();
        this.index = 0;
        this.items = this.results();
        this.pvGame = null;
        this.renderRows();
        const n = this.items.length;
        this.countEl.textContent = q.trim() ? `${n}` : '';
        this.el.classList.toggle('has-results', n > 0);
        if (q.trim()) this.app.say(n ? `${n} game${n === 1 ? '' : 's'} found` : 'No games found');
        this.renderZone();
    }

    renderZone() {
        this.el.dataset.zone = this.zone;
        this.rail.querySelectorAll('.key').forEach((k, i) => k.classList.toggle('sel', i === this.key));
        const sel = this.rail.children[this.key];
        if (sel && this.zone === 'rail') {
            const R = this.rail;
            const left = sel.offsetLeft - R.clientWidth / 2 + sel.offsetWidth / 2;
            R.scrollLeft = Math.max(0, left);
        }
    }

    applyKey() {
        const k = KEYS[this.key];
        if (k === 'OK') {
            if (!this.items.length) return this.app.deny();
            this.zone = 'list';
            this.renderZone();
            this.app.say(`${this.items.length} results. ${this.items[this.index].say}`);
            return;
        }
        let q = this.query;
        if (k === 'DEL') {
            if (!q) return this.app.deny();
            q = q.slice(0, -1);
        } else if (k === 'SPACE') {
            if (!q || q.endsWith(' ')) return this.app.deny();
            q += ' ';
        } else q += k.toLowerCase();
        this.setQuery(q);
        this.zone = 'rail';
        this.renderZone();
    }

    /** A key typed while the field isn't focused. */
    typeChar(ch) {
        this.input.focus({ preventScroll: true });
        this.setQuery(this.query + ch.toLowerCase());
        this.zone = 'list';
        this.renderZone();
    }

    enterFromInput() {
        if (!this.items.length) return this.app.deny();
        this.input.blur();
        this.zone = 'list';
        this.renderZone();
        this.app.feedback();
        super.onSelect();
    }

    onTick(d, fast) {
        if (this.zone === 'rail') {
            const n = KEYS.length;
            this.key = (this.key + d + n) % n;
            this.renderZone();
            this.app.say(this.rail.children[this.key].getAttribute('aria-label'));
            return true;
        }
        return super.onTick(d, fast);
    }
    onSelect() {
        if (this.zone === 'rail') return this.applyKey();
        super.onSelect();
    }
    onPlay() {
        if (this.zone === 'rail') {
            if (!this.items.length) return this.app.deny();
            this.zone = 'list';
            this.renderZone();
            return;
        }
        super.onPlay();
    }
    onPrev() {
        if (this.zone === 'rail') {
            this.key = KEYS.indexOf('DEL');
            return this.applyKey();
        }
        super.onPrev();
    }
    onNext() {
        if (this.zone === 'rail') {
            this.key = (this.key + 5) % KEYS.length;
            return this.renderZone();
        }
        super.onNext();
    }
    /** MENU from the results goes back up to the letters first. */
    onBack() {
        if (this.zone === 'list') {
            this.zone = 'rail';
            this.input.blur();
            this.renderZone();
            return true;
        }
        return false;
    }
    refresh() {
        this.favChanged();
    }
    shown() {
        super.shown();
        if (finePointer.matches && !this.focusedOnce) {
            this.focusedOnce = true;
            this.input.focus({ preventScroll: true });
            const n = this.input.value.length;
            this.input.setSelectionRange(n, n);
        }
    }
}

// ------------------------------------------------------------------ text page

export class TextView extends View {
    constructor(app, { title, html }) {
        super(app, title);
        this.html = html;
    }
    get type() {
        return 'text';
    }
    build() {
        this.el.innerHTML = `<div class="t-scroll">${this.html}</div>`;
        this.scroller = this.el.firstElementChild;
    }
    onTick(d) {
        const S = this.scroller;
        const max = S.scrollHeight - S.clientHeight;
        const next = clamp(S.scrollTop + d * 40, 0, max);
        if (next === S.scrollTop) {
            this.app.bump(S, d);
            return false;
        }
        S.scrollTop = next;
        return true;
    }
    onPrev() {
        this.scroller.scrollTop -= this.scroller.clientHeight * 0.8;
    }
    onNext() {
        this.scroller.scrollTop += this.scroller.clientHeight * 0.8;
    }
    onSelect() {
        this.app.back();
    }
}
