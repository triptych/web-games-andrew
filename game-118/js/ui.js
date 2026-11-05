// The DOM layer: screens, the HUD, the guest cards, floating numbers, banners, the cookbook, the shop,
// the tables and the Dinner Plan. Reads the sim; every change goes out through `act`.

import { VERSION, TABLES, ECON, GEN, MAX_TIER, COLS, ROWS } from './config.js';
import { CHAINS, CHAIN_KEYS, GUEST_LIST, tierName } from './sim/data/items.js';
import { CHAPTERS, goalLabel } from './sim/data/chapters.js';
import { goalProgress, servePlan, refillCost, chainUnlocked } from './sim/game.js';
import { portrait } from './portraits.js';

const $ = (id) => document.getElementById(id);
const ico = (id) => `<svg class="ico"><use href="#i-${id}"/></svg>`;
const guestName = (id) => GUEST_LIST.find((g) => g.id === id)?.name || 'A guest';

function owned(G, c, t) {
    let n = 0;
    for (const it of G.cells) if (it && it.k === 'item' && it.c === c && it.t === t) n++;
    return n;
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, act, getView }) {
        Object.assign(this, { audio, settings, act, getView });
        this.G = null;
        this.stack = [];                     // open screens, top last
        this.sig = '';
        this.seenGuests = new Set();
        this.lastCoins = null;
        this.lastStars = null;
        this.planDot = false;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), motion = $('set-motion');
        sfx.value = settings.sfx; music.value = settings.music; motion.value = settings.motion;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, motion: motion.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, motion]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the guest cards: a click serves, or says what is missing
        $('guests').addEventListener('click', (e) => {
            const b = e.target.closest('.guest[data-q]');
            if (!b || !this.G) return;
            const q = this.G.guests.find((x) => x && x.id === +b.dataset.q);
            if (!q) return;
            if (servePlan(this.G, q)) act({ t: 'serve', q: q.id });
            else this.say(q);
        });
        // the dock
        $('d-compost').addEventListener('click', () => this.toast('Drag a spare item here to compost it. Free cells keep the table from locking up.'));
        $('d-book').addEventListener('click', () => { audio.ui('open'); this.openScreen('book'); });
        $('d-shop').addEventListener('click', () => { audio.ui('open'); this.openScreen('shop'); });
        $('d-table').addEventListener('click', () => { audio.ui('open'); this.openScreen('tables'); });
        for (const id of ['d-plan', 'plan-pill']) $(id).addEventListener('click', () => { audio.ui('open'); this.planDot = false; this.openScreen('plan'); });
        $('shop-body').addEventListener('click', (e) => { const b = e.target.closest('button[data-buy]'); if (b) { act({ t: b.dataset.buy }); this.refresh(); } });
        $('tables-body').addEventListener('click', (e) => { const b = e.target.closest('button[data-up]'); if (b) { act({ t: 'upgrade' }); this.refresh(); } });
    }

    setGame(G) { this.G = G; this.sig = ''; this.seenGuests.clear(); this.lastCoins = this.lastStars = null; }

    // ------------------------------------------------------------------ screens

    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        el.style.zIndex = String(50 + this.stack.length);     // a screen opened from another lands on top of it
        el.hidden = false;
        this.refresh(id);
        if (id !== 'title') this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button:not(:disabled), select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    /** Re-draw whichever sheet is showing (its numbers change while it is open). */
    refresh(id = this.top()) {
        const G = this.G;
        if (!G) return;
        if (id === 'book') this.renderBook();
        else if (id === 'shop') this.renderShop(G);
        else if (id === 'tables') this.renderTables(G);
        else if (id === 'plan') this.renderPlan(G);
    }

    // ------------------------------------------------------------------ HUD

    showHud(on) { $('hud').hidden = !on; }

    updateHud(G) {
        const set = (id, v, key) => {
            const el = $(id);
            if (this[key] !== null && this[key] !== v) { el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); }
            if (this[key] !== v) el.textContent = String(v);
            this[key] = v;
        };
        set('hud-coins', G.coins, 'lastCoins');
        set('hud-stars', G.stars, 'lastStars');

        const ch = CHAPTERS[G.chapter];
        if (ch) {
            const done = ch.goals.filter((_, i) => G.goalDone[`${G.chapter}.${i}`]).length;
            const part = ch.goals.reduce((s, g, i) => { if (G.goalDone[`${G.chapter}.${i}`]) return s + 1; const p = goalProgress(G, g); return s + p.have / p.need; }, 0) / ch.goals.length;
            $('plan-name').textContent = ch.name;
            $('plan-pill').setAttribute('aria-label', `Dinner Plan, course ${G.chapter + 1} of ${CHAPTERS.length}: ${ch.name}`);
            $('plan-bar').style.width = `${Math.round(part * 100)}%`;
            void done;
        } else {
            $('plan-name').textContent = 'Dinner is served!';
            $('plan-bar').style.width = '100%';
        }
        const next = TABLES[G.table + 1];
        $('d-table').querySelector('.badge').hidden = !(next && G.stars >= next.cost);
        $('d-plan').querySelector('.badge').hidden = !this.planDot;

        // guest cards, redrawn only when something about them changed
        const view = this.getView();
        const sig = G.guests.map((q) => (q ? `${q.id}:${q.wants.map((w) => Math.min(w.n, owned(G, w.c, w.t))).join(',')}:${servePlan(G, q) ? 1 : 0}` : '-')).join('|');
        if (sig !== this.sig && view) { this.sig = sig; this.renderGuests(G, view); }
    }

    renderGuests(G, view) {
        const html = G.guests.map((q, s) => {
            if (!q) return `<div class="guest empty" role="listitem">A guest is arriving...</div>`;
            const ready = !!servePlan(G, q);
            const fresh = !this.seenGuests.has(q.id);
            this.seenGuests.add(q.id);
            const wants = q.wants.map((w) => {
                const have = Math.min(w.n, owned(G, w.c, w.t));
                const badge = w.n > 1 ? `${have}/${w.n}` : have >= 1 ? ico('check') : '';
                return `<span class="want ${have >= w.n ? 'have' : ''}"><img src="${view.icon(w.c, w.t, 64)}" alt="${w.n > 1 ? w.n + ' x ' : ''}${tierName(w.c, w.t)}"><span class="cnt">${badge}</span></span>`;
            }).join('');
            const asks = q.wants.map((w) => `${w.n > 1 ? w.n + ' ' : ''}${tierName(w.c, w.t)}`).join(' and ');
            return `<button class="guest ${ready ? 'ready' : ''} ${fresh ? 'new' : ''}" role="listitem" data-q="${q.id}" data-slot="${s}" aria-label="${guestName(q.guest)} wants ${asks}${ready ? '. Ready to serve' : ''}">
                <span class="g-head"><img class="avatar" src="${portrait(q.guest)}" alt=""><span class="g-name">${guestName(q.guest)}</span></span>
                <span class="g-wants">${wants}</span>
                <span class="g-foot"><span>${ico('coin')}${q.coins}</span>${q.stars ? `<span>${ico('star')}${q.stars}</span>` : ''}${ready ? '<span class="serve">Serve!</span>' : ''}</span>
            </button>`;
        }).join('');
        $('guests').innerHTML = html;
    }

    cardPoint(slot) {
        const el = document.querySelector(`#guests [data-slot="${slot}"]`) || $('guests');
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    /** What a guest said, and what is still missing, as a toast. */
    say(q) {
        const G = this.G;
        const miss = q.wants.map((w) => {
            const lack = w.n - Math.min(w.n, owned(G, w.c, w.t));
            return lack > 0 ? `${lack > 1 ? lack + ' more ' : ''}${tierName(w.c, w.t)}` : null;
        }).filter(Boolean);
        this.audio.ui('denied');
        this.toast(`${guestName(q.guest)}: "${q.say}" Needs ${miss.join(' and ')}.`);
    }

    /** The layout's free rectangle, in px, for the camera: what the HUD panels leave of the screen. */
    layoutRect(w, h) {
        const g = $('guests').getBoundingClientRect(), d = $('dock').getBoundingClientRect(), t = $('hud-top').getBoundingClientRect();
        if (w > h * 1.15) return { l: g.right + 6, r: d.left - 6, t: t.bottom + 2, b: h - 8 };
        return { l: 0, r: w, t: g.bottom + 6, b: d.top - 6 };
    }

    /** The little info bar for what is selected, under the cursor, or hovered. */
    setTip(G, cell) {
        const tip = $('tip');
        const it = cell >= 0 ? G.cells[cell] : null;
        if (!it) { tip.hidden = true; return; }
        let html;
        if (it.k === 'gen') {
            const left = it.ch >= GEN.max ? '' : ` · next charge in ${Math.max(1, Math.ceil(GEN.regen - it.tm))}s`;
            html = `<b>${CHAINS[it.c].name}</b> · ${it.ch}/${GEN.max} charges<small>Tap to harvest${left}. Drag it where its harvest is easy to reach.</small>`;
        } else {
            const nxt = it.t < MAX_TIER ? `Merge with another ${tierName(it.c, it.t)} to make a ${tierName(it.c, it.t + 1)}.` : 'The top of its chain! Serve it, or keep it for a goal.';
            html = `<b>${tierName(it.c, it.t)}</b> · tier ${it.t} of ${MAX_TIER}<small>${nxt}</small>`;
        }
        if (tip.dataset.h !== html) { tip.innerHTML = html; tip.dataset.h = html; }
        tip.hidden = false;
    }

    // ------------------------------------------------------------------ floating text, toasts, banners

    float(text, x, y, cls = '') {
        const el = document.createElement('div');
        el.className = `float ${cls}`;
        el.innerHTML = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        $('floats').appendChild(el);
        setTimeout(() => el.remove(), 1300);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        const box = $('toasts');
        while (box.children.length > 2) box.firstChild.remove();
        box.appendChild(el);
        window.A11Y?.announce?.(text);
        setTimeout(() => el.remove(), 3100);
    }
    banner(title, sub) {
        const old = $('banner');
        const el = old.cloneNode(true);       // a fresh node restarts the CSS animation
        el.querySelector('b').textContent = title;
        el.querySelector('span').textContent = sub;
        el.hidden = false;
        old.replaceWith(el);
        window.A11Y?.announce?.(`${title}. ${sub}`);
    }

    /** Sim events, as floating numbers, toasts and banners. */
    onEvents(G, events, view) {
        for (const e of events) {
            switch (e.type) {
                case 'merge': {
                    const p = view.cellToClient(e.cell, 0.7);
                    if (e.coins > 0) this.float(`+${e.coins}${ico('coin')}`, p.x, p.y);
                    if (e.combo >= 3) this.float(`Combo x${e.combo}!`, p.x, p.y - 34, 'big');
                    break;
                }
                case 'serve': {
                    const p = this.cardPoint(e.slot);
                    this.float(`+${e.coins}${ico('coin')}`, p.x, p.y + 10);
                    if (e.stars) this.float(`+${e.stars}${ico('star')}`, p.x, p.y + 40, 'star');
                    break;
                }
                case 'compost': if (e.coins) { const p = view.cellToClient(e.cell, 0.5); this.float(`+${e.coins}${ico('coin')}`, p.x, p.y); } break;
                case 'goal': this.planDot = true; this.toast(`Goal complete: ${goalLabel(CHAPTERS[e.chapter].goals[e.goal])}`); break;
                case 'chapter': this.planDot = true; this.banner(`Course ${e.chapter + 1} done: ${CHAPTERS[e.chapter].name}`, `+${e.coins} coins, +${e.stars} star${e.stars > 1 ? 's' : ''}`); break;
                case 'upgrade': {
                    const gift = e.gift ? `A ${CHAINS[e.gift.c].name} has arrived.` : 'More room to merge!';
                    this.banner(TABLES[e.table].name, gift);
                    break;
                }
                case 'locked': this.toast('The table is full! Merge something, or drag spares to the compost bin.'); break;
                case 'refill': this.toast('Every generator is full again.'); break;
                case 'denied': {
                    const m = { empty: 'That one is recharging. Give it a moment.', full: 'No room! Merge something, or compost a spare.', coins: `You need ${e.need} coins for that.`, stars: `You need ${e.need} stars for the next table.`, missing: 'You are missing something that guest asked for.' }[e.reason];
                    if (m) this.toast(m);
                    break;
                }
                case 'win': this.showWin(G); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ sheets

    renderBook() {
        const view = this.getView(), G = this.G;
        $('book-body').innerHTML = CHAIN_KEYS.map((c) => {
            const ch = CHAINS[c], open = chainUnlocked(G, c);
            const tiers = ch.tiers.map((n, i) => `<div class="tier"><img src="${view ? view.icon(c, i + 1, 64) : ''}" alt="">${n}</div>`).join('');
            const lock = open ? '' : ` <small>${ico('lock')} arrives with ${TABLES[ch.unlock].name}</small>`;
            return `<div class="chain ${open ? '' : 'locked'}"><h3>${ch.name} <small>${ch.blurb}</small></h3>${lock}<div class="tiers">${tiers}</div></div>`;
        }).join('');
    }

    renderShop(G) {
        $('shop-coins').textContent = G.coins;
        const rc = refillCost(G);
        const needRefill = G.cells.some((it) => it && it.k === 'gen' && it.ch < GEN.max);
        $('shop-body').innerHTML = `
            <div class="shopitem">${ico('basket')}<div><b>Refill the generators</b><small>Every crate, coop and barrel back to full. ${ECON.refillPer} coins per missing charge.</small></div>
                <button class="btn small primary" data-buy="refill" ${needRefill && G.coins >= rc ? '' : 'disabled'}>${needRefill ? rc : 'Full'}${needRefill ? ico('coin') : ''}</button></div>
            <div class="shopitem">${ico('basket')}<div><b>Mystery basket</b><small>A surprise tier 2 or 3 item from any chain you have, put on the table for you.</small></div>
                <button class="btn small primary" data-buy="basket" ${G.coins >= ECON.basket ? '' : 'disabled'}>${ECON.basket}${ico('coin')}</button></div>`;
    }

    renderTables(G) {
        $('tables-stars').textContent = G.stars;
        const next = TABLES[G.table + 1];
        $('tables-body').innerHTML = TABLES.map((t, i) => {
            const r = t.rect, size = `${r.c1 - r.c0 + 1} x ${r.r1 - r.r0 + 1}`;
            const gift = t.gift ? ` Brings the ${CHAINS[t.gift].name}.` : '';
            const state = i <= G.table ? `<b>${i === G.table ? 'Your table' : 'Done'}</b>` : i === G.table + 1 ? `<button class="btn small primary" data-up="1" ${G.stars >= next.cost ? '' : 'disabled'}>${t.cost}${ico('star')}</button>` : `<b>${t.cost}${ico('star')}</b>`;
            return `<div class="tbl ${i === G.table ? 'now' : i > G.table + 1 ? 'locked' : ''}">${ico(i <= G.table ? 'table' : 'lock')}<div><b>${t.name}</b><small>${size} cells.${gift}</small></div>${state}</div>`;
        }).join('') + `<p class="lead">Earn stars by serving guests with bigger dishes and by finishing courses.</p>`;
    }

    renderPlan(G) {
        $('plan-body').innerHTML = CHAPTERS.map((ch, ci) => {
            const state = ci < G.chapter ? 'done' : ci === G.chapter ? 'now' : 'later';
            const head = `<h3><span>${ci + 1}. ${ch.name}</span><span>${state === 'done' ? ico('check') : `${ch.reward.stars}${ico('star')}`}</span></h3>`;
            if (state !== 'now') return `<div class="course ${state}">${head}</div>`;
            const goals = ch.goals.map((g, i) => {
                const done = G.goalDone[`${ci}.${i}`], p = goalProgress(G, g);
                return `<div class="goal ${done ? 'done' : ''}"><span class="tick">${done ? ico('check') : ''}</span><span class="nm">${goalLabel(g)}</span><span class="pr">${done ? '' : p.have + '/' + p.need}</span></div>`;
            }).join('');
            return `<div class="course now">${head}<small>${ch.blurb}</small>${goals}<small>Reward: ${ch.reward.coins} coins and ${ch.reward.stars} star${ch.reward.stars > 1 ? 's' : ''}.</small></div>`;
        }).join('') + (G.won ? '<p class="lead"><b>The kids are at the big table now.</b> Keep serving guests for as long as you like.</p>' : '');
    }

    showWin(G) {
        const mins = Math.max(1, Math.round(G.t / 60));
        $('win-text').textContent = `Grandma pulls out a chair at the big table and the whole family makes room. You served ${G.stats.served} guests and made ${G.stats.merges} merges in ${mins} minute${mins > 1 ? 's' : ''}. The kids' table has a seat at the grown-ups' table at last.`;
        this.openScreen('win');
    }
}
