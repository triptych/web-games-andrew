// The DOM layer: the HUD, the shop and the other tabs, abilities, rooms, visitors, toasts, the ticker and the sheets.
// Reads the sim; never changes it — every button sends a command through `send`.
//
// Panels never rebuild under a finger: each tab has a signature of what its markup depends on and is rebuilt only
// when that changes; numbers that tick are written in place (game-034's lesson).

import { VERSION, DREAD, HENCH } from './config.js';
import {
    HOBBIES, HOBBY, MINIONS, MINION, UPGRADES, UPGRADE, DECOR, DECOR_BY, ABILITIES, ABILITY, VISITOR_BY, SCHEMES, SCHEME_BY,
    HEIRLOOMS, HEIRLOOM, PERKS, PERK, LAIRS, ACHIEVEMENTS, GRAVE,
} from './sim/data.js';
import {
    minionCost, maxAffordable, minionVisible, upgradesOnOffer, henchCost, henchFree, legendGain, legendNext, abilityCd,
    schemeDur, masteryLevel, masteryNext, tierOf, goldScale, roomOpen,
} from './sim/game.js';
import { fmt, fmtTime } from './fmt.js';
import { headline } from './news.js';
import { goalProgress, KINDS } from './sim/match3.js';
import { drawToken } from './view/art.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const BUFF_NAME = { cuddle: '🐈 Cuddle Frenzy ×7', encore: '🪕 Encore: crafting ×13', taste: '🥄 Taste Test: crafting ×10', storm: '⛈️ Thunderstorm', soiree: '💃 Grand Soirée ×3' };

export class UI {
    constructor({ audio, settings, sprites, send, onSettings, onDeleteSave, onOverview, onPlace, m3view }) {
        this.audio = audio;
        this.settings = settings;
        this.sprites = sprites;
        this.send = send;
        this.onOverview = onOverview;
        this.onPlace = onPlace;
        this.place = 'castle';
        this.m3view = m3view;
        this.m3last = null;
        this.tokenIcons = KINDS.map((k) => drawToken(k).toCanvas().toDataURL());
        this.stack = [];
        this.tab = 'minions';
        this.amount = 1;
        this.sel = {};                       // selected tile per tab
        this.sigs = {};
        this.lastNum = 0;
        this.tickerT = 0;
        this.G = null;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen must not click inside it when it lifts. Keyboard clicks have detail 0.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // settings
        const els = { sfx: $('set-sfx'), music: $('set-music'), quality: $('set-quality'), floaters: $('set-floaters'), calm: $('set-calm') };
        for (const [k, el] of Object.entries(els)) el.value = settings[k];
        const changed = () => {
            for (const [k, el] of Object.entries(els)) settings[k] = el.type === 'range' ? +el.value : el.value;
            onSettings(settings);
        };
        for (const el of Object.values(els)) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => this.confirm('Delete your castle?', '<p>Everything goes: charm, minions, legend, heirlooms and trophies. This cannot be undone.</p>', 'Delete', () => { onDeleteSave(); this.toast('Saved game deleted.'); }));

        // tabs
        $('tabs').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-tab]');
            if (!b) return;
            this.setTab(b.dataset.tab);
        });
        // one delegated handler for everything inside the panel
        $('tab-body').addEventListener('click', (e) => this.panelClick(e));
        $('tab-body').addEventListener('pointerover', (e) => {
            if (e.pointerType !== 'mouse') return;
            const t = e.target.closest('[data-pick]');
            if (t) this.showDetail(t.dataset.pick);
        });

        // rooms
        for (const b of document.querySelectorAll('#rooms .room[data-room]')) {
            b.addEventListener('click', () => {
                const id = b.dataset.room;
                if (this.G && !roomOpen(this.G, id)) { this.roomHint(id); return; }
                audio.ui('click');
                this.send({ t: 'room', id });
                this.onOverview(false);
                this.onPlace('castle');
            });
        }
        $('btn-overview').addEventListener('click', () => { audio.ui('click'); this.onOverview('toggle'); });
        $('btn-yard').addEventListener('click', () => { audio.ui('click'); this.onOverview(false); this.onPlace('yard'); });
        // Skull Swap's buttons
        $('m3-again').addEventListener('click', () => { audio.ui('click'); $('m3-end').hidden = true; this.m3last = null; this.send({ t: 'm3start' }); });
        $('m3-back').addEventListener('click', () => { audio.ui('close'); this.closeScreen('m3'); });

        // abilities
        const ab = $('abilities');
        for (const a of ABILITIES) {
            const b = document.createElement('button');
            b.className = 'ab';
            b.dataset.id = a.id;
            b.setAttribute('aria-label', `${a.name} (${a.key})`);
            b.title = `${a.name} [${a.key}${a.id === 'cackle' ? ' or C' : ''}] — ${a.desc}`;
            b.innerHTML = `<span aria-hidden="true">${a.icon}</span><span class="cd"></span><span class="t"></span><span class="key">${a.key}</span>`;
            b.addEventListener('click', () => this.send({ t: 'ability', id: a.id }));
            ab.appendChild(b);
        }
        $('btn-visitor').addEventListener('click', () => {
            const v = this.G?.visitors[0];
            if (v) this.send({ t: 'visitor', vid: v.vid });
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        if (id === 'title') this.fitTitle();
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack by open order, not page order
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        else document.activeElement?.blur?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    confirm(head, html, yes, onYes) {
        $('confirm-head').textContent = head;
        $('confirm-text').innerHTML = html;
        const b = $('confirm-yes');
        b.textContent = yes;
        b.onclick = () => { this.closeScreen('confirm'); onYes(); };
        this.openScreen('confirm');
    }

    // ------------------------------------------------------------------ layout
    /** Pick the layout for this screen and report how much of it the HUD, dock and panel cover. */
    layout() {
        const vv = window.visualViewport;
        const w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
        document.documentElement.style.setProperty('--vvh', h + 'px');
        const portrait = w < 760 && h > w * 0.9;
        const short = !portrait && h < 560;
        document.body.classList.toggle('portrait', portrait);
        document.body.classList.toggle('short', short);
        const playing = !$('panel').hidden;
        if (!playing) return { top: 0, right: 0, bottom: 0, left: 0 };
        const P = $('panel').getBoundingClientRect(), D = $('dock').getBoundingClientRect(), H = $('hud').getBoundingClientRect();
        if (portrait) return { top: H.bottom + 4, right: 56, bottom: h - D.top + 2, left: 0 };
        if (short) return { top: H.bottom + 2, right: w - P.left + 54, bottom: h - D.top + 2, left: 0 };
        return { top: H.bottom + 2, right: w - P.left, bottom: h - D.top + 2, left: 0 };
    }

    /** Shrink a heading until it fits its box (a fallback font can be much wider than the web font). */
    fit(el) {
        if (!el) return;
        el.style.fontSize = '';
        let size = parseFloat(getComputedStyle(el).fontSize);
        for (let i = 0; i < 30 && el.scrollWidth > el.clientWidth + 1 && size > 18; i++) { size *= 0.94; el.style.fontSize = size + 'px'; }
    }
    fitTitle() { this.fit(document.querySelector('.logo')); }

    showPlay(on) {
        for (const id of ['hud', 'dock', 'panel', 'abilities']) $(id).hidden = !on;
        if (!on) { $('btn-visitor').hidden = true; $('buffs').innerHTML = ''; }
        this.sigs = {};
    }

    setTab(tab) {
        this.tab = tab;
        for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
        this.sigs.tab = null;
        $('tab-body').scrollTop = 0;
        if (this.G) this.renderTab(this.G, this.R, true);
    }

    // ------------------------------------------------------------------ every frame
    update(G, R, dt) {
        this.G = G; this.R = R;
        // the big numbers
        this.text('charm', fmt(G.charm, 0));
        this.text('cps', fmt(R.cps));
        this.text('gold', fmt(G.gold, 0));
        $('chip-legend').hidden = !G.legend.total;
        this.text('legend', fmt(G.legend.total, 0));
        // dread
        const tier = R.tier;
        $('dread-fill').style.width = G.dread.toFixed(1) + '%';
        $('dread-meter').setAttribute('aria-valuenow', Math.round(G.dread));
        this.text('dread-label', tier.name);
        this.text('dread-mul', `×${R.tierMul.toFixed(2)} charm${tier.tribute || R.storm ? ' · 🪙 ' + (R.tribute).toFixed(1) + '/s' : ''}`);
        $('dread').classList.toggle('low', tier.id === 'suspected');
        this.text('dread-icon', { suspected: '🫣', unsettling: '☠', feared: '😈', dreaded: '👹' }[tier.id]);

        // abilities
        for (const b of $('abilities').children) {
            const id = b.dataset.id, unlocked = R.M.unlock[id];
            b.classList.toggle('locked', !unlocked);
            const cd = G.cd[id], total = abilityCd(G, id);
            b.querySelector('.cd').style.setProperty('--p', unlocked ? `${(cd / total) * 100}%` : '0%');
            b.querySelector('.t').textContent = unlocked && cd > 0 && total > 10 ? fmtTime(cd) : '';
            b.classList.toggle('ready', unlocked && cd <= 0 && (id !== 'cackle' || G.dread < 50 || G.visitors.some((v) => v.kind === 'hero')));
            b.disabled = !unlocked;
        }
        // rooms
        for (const b of document.querySelectorAll('#rooms .room[data-room]')) {
            const id = b.dataset.room, open = roomOpen(G, id);
            b.classList.toggle('on', G.room === id && !this.overview && this.place !== 'yard');
            if (b.classList.contains('locked') === !open) continue;
            b.classList.toggle('locked', !open);
            const h = HOBBY[id], m = MINIONS.find((x) => x.hobby === id);
            b.title = open ? h.room : `${h.room}: locked. Hire a ${minionVisible(G, m) ? m.name : 'new minion'} to open it.`;
            b.setAttribute('aria-label', open ? h.room : `${h.room} (locked)`);
        }
        $('btn-overview').classList.toggle('on', !!this.overview);
        $('btn-yard').classList.toggle('on', this.place === 'yard' && !this.overview);
        if (this.top() === 'm3') this.m3Update(G);

        // visitors: a button for anyone who misses the sprite
        const v = G.visitors[0];
        const vb = $('btn-visitor');
        vb.hidden = !v;
        if (v) {
            const txt = v.kind === 'hero' ? `🗡️ A hero at the gate! Scare them off · ${Math.ceil(v.t)}s` : `${VISITOR_BY[v.kind].icon} ${VISITOR_BY[v.kind].name}! Tap to greet · ${Math.ceil(v.t)}s`;
            if (vb.textContent !== txt) vb.textContent = txt;
            vb.classList.toggle('hero', v.kind === 'hero');
        }
        // buffs
        const bsig = G.buffs.map((b) => b.id + Math.ceil(b.t)).join();
        if (bsig !== this.sigs.buffs) {
            this.sigs.buffs = bsig;
            $('buffs').innerHTML = G.buffs.map((b) => `<span class="buff ${b.id}">${BUFF_NAME[b.id] || b.id} · ${Math.ceil(b.t)}s</span>`).join('');
        }
        // the ticker
        this.tickerT -= dt;
        if (this.tickerT <= 0) {
            this.tickerT = 11;
            const el = $('ticker-text');
            el.textContent = headline(G, Math.random());
            el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        }

        this.lastNum += dt;
        if (this.lastNum >= 0.1) { this.lastNum = 0; this.renderTab(G, R); this.badges(G, R); }
    }

    text(id, s) { const el = $(id); if (el.textContent !== s) el.textContent = s; }

    badges(G, R) {
        const n = upgradesOnOffer(G).filter((u) => u.cost <= G.charm).length;
        const bu = $('badge-upgrades'); bu.hidden = !n; bu.textContent = n;
        const free = henchFree(G);
        const s = G.board.filter((c) => c && SCHEME_BY[c.id].need <= free).length;
        const bs = $('badge-schemes'); bs.hidden = !s || !G.hench; bs.textContent = s;
        void R;
    }

    // ------------------------------------------------------------------ tabs
    renderTab(G, R, force = false) {
        const fn = this['tab_' + this.tab];
        if (fn) fn.call(this, G, R, force);
    }
    build(sig, html, force) {
        if (!force && this.sigs.tab === sig) return false;
        this.sigs.tab = sig;
        $('tab-body').innerHTML = html;
        return true;
    }
    each(sel, fn) { for (const el of $('tab-body').querySelectorAll(sel)) fn(el); }

    tab_minions(G, R, force) {
        const vis = MINIONS.filter((m) => minionVisible(G, m));
        const next = MINIONS.find((m) => !minionVisible(G, m));
        const sig = `m|${vis.map((m) => m.id).join()}|${next?.id}|${this.amount}`;
        if (this.build(sig, `
            <div class="amounts" role="group" aria-label="Buy how many">${[1, 10, 100, 'max'].map((n) => `<button data-amount="${n}" class="${this.amount === n ? 'on' : ''}">${n === 'max' ? 'Max' : '×' + n}</button>`).join('')}</div>
            ${vis.map((m) => `<button class="item" data-buy="${m.id}" style="--hob:${HOBBY[m.hobby].color}">
                <span class="pic"><img alt="" src="${this.sprites.icon('minion', m.id, 2)}"></span>
                <span><span class="name">${esc(m.name)}</span><span class="desc" data-d="${m.id}"></span></span>
                <span class="side"><span class="count" data-n="${m.id}"></span><span class="cost" data-c="${m.id}"></span></span>
            </button>`).join('')}
            ${next ? `<div class="item mystery no"><span class="pic"><img alt="" src="${this.sprites.icon('minion', next.id, 2)}"></span><span><span class="name">???</span><span class="desc">Make more charm to discover this ${HOBBY[next.hobby].name.toLowerCase()} minion.</span></span><span class="side"><span class="cost">${fmt(next.cost)}</span></span></div>` : ''}
            <p class="note">Each hobby has its own room. Hiring a minion opens its room and fills it, and crafting by hand in a room raises its mastery.</p>
        `, force)) { /* built */ }
        for (const m of vis) {
            let n = this.amount === 'max' ? Math.max(1, maxAffordable(G, m.id)) : this.amount;
            const cost = minionCost(G, m.id, n);
            const each = R.cpsBy[m.id] / Math.max(1, G.owned[m.id]);
            const one = G.owned[m.id] ? each : m.cps * R.global * R.hobbyMul[m.hobby];
            const share = R.cps > 0 ? (R.cpsBy[m.id] / R.cps) * 100 : 0;
            this.set(`[data-n="${m.id}"]`, String(G.owned[m.id]));
            this.set(`[data-c="${m.id}"]`, `${this.amount === 'max' ? `×${n} ` : ''}💗 ${fmt(cost)}`);
            this.set(`[data-d="${m.id}"]`, `${esc(m.desc)} Each makes ${fmt(one)}/s${G.owned[m.id] ? ` · ${share.toFixed(share < 10 ? 1 : 0)}% of all charm` : ''}.`);
            const el = $('tab-body').querySelector(`[data-buy="${m.id}"]`);
            el?.classList.toggle('no', cost > G.charm);
        }
    }
    set(sel, txt, html = false) {
        const el = $('tab-body').querySelector(sel);
        if (!el) return;
        if (html) { if (el.innerHTML !== txt) el.innerHTML = txt; } else if (el.textContent !== txt) el.textContent = txt;
    }

    tab_upgrades(G, R, force) {
        const offer = upgradesOnOffer(G);
        const owned = UPGRADES.filter((u) => G.upg[u.id]);
        const sig = `u|${offer.map((u) => u.id).join()}|${owned.length}`;
        if (!offer.some((u) => u.id === this.sel.upgrades)) this.sel.upgrades = offer[0]?.id;
        this.build(sig, `
            <div class="row-btns"><button class="btn primary" data-act="upgradeAll" id="btn-buy-all">Buy all I can afford</button></div>
            <div class="detail" id="detail"></div>
            ${offer.length ? `<div class="grid">${offer.map((u) => `<button class="tile" data-pick="u:${u.id}" data-upg="${u.id}" aria-label="${esc(u.name)}">${u.icon}</button>`).join('')}</div>` : '<p class="note">Nothing on offer just now. Hire more minions and make more charm, and new upgrades appear.</p>'}
            ${owned.length ? `<h3 class="sec">Owned (${owned.length})</h3><div class="grid">${owned.map((u) => `<button class="tile got" data-pick="u:${u.id}" aria-label="${esc(u.name)}">${u.icon}</button>`).join('')}</div>` : ''}
        `, force);
        this.each('[data-upg]', (el) => {
            const u = UPGRADE[el.dataset.upg];
            el.classList.toggle('can', u.cost <= G.charm);
            el.classList.toggle('no', u.cost > G.charm);
            el.classList.toggle('sel', this.sel.upgrades === u.id);
        });
        const can = offer.filter((u) => u.cost <= G.charm).length;
        const b = $('btn-buy-all');
        if (b) { b.disabled = !can; b.textContent = can ? `Buy all I can afford (${can})` : 'Buy all I can afford'; }
        this.showDetail(this.detailKey || (this.sel.upgrades ? 'u:' + this.sel.upgrades : null), true);
    }

    showDetail(key, quiet = false) {
        const el = $('detail');
        if (!el || !key) { if (el) el.innerHTML = '<span class="dim">Tap an upgrade to see what it does; tap it again to buy it.</span>'; return; }
        if (!quiet) this.detailKey = key;
        const [kind, id] = key.split(':');
        const G = this.G;
        let html = '';
        if (kind === 'u') {
            const u = UPGRADE[id];
            const has = G.upg[id];
            html = `<b>${u.icon} ${esc(u.name)}</b><br>${esc(u.desc)}<br>${has ? '<span class="dim">Owned.</span>' : `<span style="color:${u.cost <= G.charm ? 'var(--good)' : 'var(--bad)'}">💗 ${fmt(u.cost)}</span>`}`;
        } else if (kind === 'a') {
            const a = ACH[id], got = G.ach[id];
            html = `<b>${got ? a.icon : '❔'} ${got ? esc(a.name) : '???'}</b><br>${esc(a.desc)}<br><span class="dim">${got ? 'Unlocked: +1% charm.' : 'Locked.'}</span>`;
        } else if (kind === 'h') {
            const h = HEIRLOOM[id], got = G.heirlooms[id];
            html = got ? `<b>${h.icon} ${esc(h.name)}</b><br>${esc(h.desc)}<br><span class="dim">Kept forever, in every lair.</span>` : '<b>❔ An unknown heirloom</b><br>Found on secret commissions (the pink schemes).';
        }
        if (el.innerHTML !== html) el.innerHTML = html;
    }

    tab_decor(G, R, force) {
        const sig = `d|${DECOR.map((d) => (G.decor[d.id] ? 1 : 0)).join('')}`;
        this.build(sig, `
            <p class="note">Gold comes in as tribute while you're Feared or Dreaded, from frightened heroes and from evil schemes. Every piece of décor appears in the castle; it stays in this lair.</p>
            ${DECOR.map((d) => `<button class="item ${G.decor[d.id] ? 'owned no' : ''}" data-decor="${d.id}" style="--hob:${d.room === 'all' ? 'var(--gold)' : HOBBY[d.room].color}">
                <span class="pic">${d.icon}</span>
                <span><span class="name">${esc(d.name)}</span><span class="desc">${esc(d.desc)} <i class="dim">${d.room === 'all' ? 'Every room.' : HOBBY[d.room].room + '.'}</i></span></span>
                <span class="side"><span class="cost" data-g="${d.id}">${G.decor[d.id] ? '✓ Placed' : '🪙 ' + fmt(d.cost, 0)}</span></span>
            </button>`).join('')}
        `, force);
        this.each('[data-decor]', (el) => { const d = DECOR_BY[el.dataset.decor]; if (!G.decor[d.id]) el.classList.toggle('no', d.cost > G.gold); });
    }

    tab_schemes(G, R, force) {
        const free = henchFree(G);
        const sig = `s|${G.board.map((c) => c?.id).join()}|${G.active.map((a) => a.card.id).join()}|${G.hench}|${free}`;
        const rew = (s) => {
            const out = [];
            if (s.charm) out.push(`💗 ${fmt(Math.max(50, R.cps * s.charm / R.prodBuff))}`);
            if (s.gold) out.push(`🪙 ${fmt(Math.round(s.gold * goldScale(R.cps)), 0)}`);
            if (s.dread) out.push(`☠ ${s.dread > 0 ? '+' : ''}${s.dread}`);
            if (s.heir) out.push(`📿 ${Math.round(s.heir * 100)}% heirloom`);
            return out.join(' · ');
        };
        const hc = henchCost(G);
        this.build(sig, `
            <h3 class="sec">Henchmen</h3>
            <div class="henchmen">${Array.from({ length: G.hench }, (_, i) => `<img alt="" class="${i >= free ? 'busy' : ''}" src="${this.sprites.icon('henchman', 0, 1)}">`).join('') || '<span class="note">No henchmen yet.</span>'}</div>
            <div class="row-btns"><button class="btn" data-act="hench" id="btn-hench" ${G.hench >= HENCH.max ? 'disabled' : ''}>${G.hench >= HENCH.max ? 'A full payroll' : `Hire a henchman · 🪙 ${fmt(hc, 0)}`}</button><span class="note" style="align-self:center">${free} free of ${G.hench}</span></div>
            <h3 class="sec">The scheme board</h3>
            <p class="note">Evil schemes keep up appearances and bring gold. Secret commissions — the Overlord's anonymous craft shop — bring charm and, sometimes, a family heirloom. They finish while you're away, too.</p>
            ${G.board.map((c, i) => { const s = SCHEME_BY[c.id]; return `<div class="card ${s.kind}">
                <div class="name">${s.kind === 'evil' ? '☠' : '💗'} ${esc(s.name)}</div>
                <div class="meta">${s.kind === 'evil' ? 'Evil scheme' : 'Secret commission'} · ${s.need} henchm${s.need > 1 ? 'en' : 'an'} · ${fmtTime(schemeDur(G, s.id))}</div>
                <div class="rew">${rew(s)}</div>
                <button class="btn primary" data-scheme="${i}" ${free >= s.need ? '' : 'disabled'}>${free >= s.need ? 'Send them' : `Needs ${s.need} free henchm${s.need > 1 ? 'en' : 'an'}`}</button>
            </div>`; }).join('')}
            ${G.active.length ? `<h3 class="sec">Under way</h3>${G.active.map((a, i) => { const s = SCHEME_BY[a.card.id]; return `<div class="card ${s.kind}"><div class="name">${esc(s.name)}</div><div class="meta" data-at="${i}"></div><div class="bar"><div data-ab="${i}"></div></div></div>`; }).join('')}` : ''}
        `, force);
        G.active.forEach((a, i) => {
            this.set(`[data-at="${i}"]`, `${fmtTime(a.t)} left`);
            const bar = $('tab-body').querySelector(`[data-ab="${i}"]`);
            if (bar) bar.style.width = `${(1 - a.t / a.dur) * 100}%`;
        });
        const hb = $('btn-hench');
        if (hb && G.hench < HENCH.max) hb.disabled = G.gold < hc;
    }

    tab_lair(G, R, force) {
        const gain = legendGain(G), pts = G.legend.total - G.legend.spent;
        const lair = LAIRS[G.lair], next = LAIRS[(G.runs + 1) % LAIRS.length];
        const sig = `l|${G.lair}|${gain}|${pts}|${Object.keys(G.perks).join()}|${Object.keys(G.heirlooms).join()}|${HOBBIES.map((h) => R.mastery[h.id]).join()}`;
        this.build(sig, `
            <h3 class="sec">${esc(lair.name)}</h3>
            <p class="note">${esc(lair.desc)} ${esc(lair.bonus)}</p>
            <h3 class="sec">Mastery</h3>
            ${HOBBIES.map((h) => `<div class="mastery"><span>${h.icon}</span><span><b>${h.name}</b> · level ${R.mastery[h.id]} <span class="dim">(+${Math.round(R.mastery[h.id] * 3 * R.M.mastery)}%)</span><div class="bar"><div data-mb="${h.id}"></div></div></span><span></span></div>`).join('')}
            <h3 class="sec">Relocate</h3>
            <p class="note">Sooner or later the heroes storm the castle. Be gone by then: move to <b>${esc(next.name)}</b> (${esc(next.bonus)}) and start again. You leave behind charm, minions, upgrades, décor and henchmen; you keep legend, perks, heirlooms and trophies. Each point of ★ legend is +2% charm forever.</p>
            <p class="note" data-leg></p>
            <div class="row-btns"><button class="btn primary" data-act="relocate" ${gain >= 1 ? '' : 'disabled'}>${gain >= 1 ? `Relocate for ★ ${fmt(gain, 0)} legend` : 'Not enough legend yet'}</button></div>
            <h3 class="sec">The Grimoire <span class="dim" style="font-size:15px">· ★ ${fmt(pts, 0)} to spend</span></h3>
            ${PERKS.map((p) => `<button class="item ${G.perks[p.id] ? 'owned no' : ''}" data-perk="${p.id}"><span class="pic">${p.icon}</span><span><span class="name">${esc(p.name)}</span><span class="desc">${esc(p.desc)}</span></span><span class="side"><span class="cost">${G.perks[p.id] ? '✓ Learned' : '★ ' + p.cost}</span></span></button>`).join('')}
            <h3 class="sec">Heirlooms <span class="dim" style="font-size:15px">· ${Object.keys(G.heirlooms).length} / ${HEIRLOOMS.length}</span></h3>
            <div class="detail" id="detail"></div>
            <div class="grid">${HEIRLOOMS.map((h) => `<button class="tile ${G.heirlooms[h.id] ? 'got' : 'locked'}" data-pick="h:${h.id}" aria-label="${G.heirlooms[h.id] ? esc(h.name) : 'Unknown heirloom'}">${G.heirlooms[h.id] ? h.icon : '❔'}</button>`).join('')}</div>
        `, force);
        for (const h of HOBBIES) {
            const lv = R.mastery[h.id], a = lv ? masteryNext(lv - 1) : 0, b = masteryNext(lv);
            const bar = $('tab-body').querySelector(`[data-mb="${h.id}"]`);
            if (bar) bar.style.width = `${Math.min(100, ((G.mastery[h.id] - a) / (b - a)) * 100)}%`;
        }
        this.set('[data-leg]', `Charm made in all lairs: ${fmt(G.charmAll)}. ${gain >= 1 ? `Relocating now earns ★ ${fmt(gain, 0)}.` : ''} The next point of legend at ${fmt(legendNext(G))}.`);
        this.each('[data-perk]', (el) => { const p = PERK[el.dataset.perk]; if (!G.perks[p.id]) el.classList.toggle('no', p.cost > pts); });
        if (!this.detailKey?.startsWith('h:')) this.showDetail(null);
        else this.showDetail(this.detailKey, true);
    }

    tab_trophies(G, R, force) {
        const n = Object.keys(G.ach).length;
        this.build(`a|${n}`, `
            <p class="note">${n} of ${ACHIEVEMENTS.length} trophies · each is +1% charm (now +${n}%).</p>
            <div class="detail" id="detail"></div>
            <div class="grid">${ACHIEVEMENTS.map((a) => `<button class="tile ${G.ach[a.id] ? 'got' : 'locked'}" data-pick="a:${a.id}" aria-label="${G.ach[a.id] ? esc(a.name) : 'Locked trophy'}">${G.ach[a.id] ? a.icon : '❔'}</button>`).join('')}</div>
        `, force);
        if (!this.detailKey?.startsWith('a:')) this.showDetail(null);
        else this.showDetail(this.detailKey, true);
    }

    tab_stats(G, R, force) {
        this.build('st', '<table class="stats" id="stats-table"></table><p class="note" id="stats-note"></p>', force);
        const S = G.stats;
        const rows = [
            ['Charm in hand', fmt(G.charm)], ['Charm per second', fmt(R.cps)], ['Charm per craft', fmt(R.click)],
            ['Charm made in this lair', fmt(G.charmRun)], ['Charm made in all lairs', fmt(G.charmAll)], ['Best charm per second', fmt(S.bestCps)],
            ['Minions', fmt(R.minions, 0)], ['Upgrades', `${Object.keys(G.upg).length} / ${UPGRADES.length}`], ['Crafts by hand', fmt(S.clicks, 0)],
            ['Charm crafted by hand', fmt(S.charmClicked)], ['Cackles', fmt(S.cackles, 0)], ['Visitors greeted', fmt(S.visitors, 0)],
            ['Heroes scared off', fmt(S.heroes, 0)], ['Heroes who saw the doilies', fmt(S.heroMiss, 0)], ['Schemes finished', fmt(S.schemes, 0)],
            ['Gold earned', fmt(S.goldAll, 0)], ['Relocations', fmt(G.runs, 0)], ['Time in this lair', fmtTime(G.runT)], ['Time in all', fmtTime(S.played)],
            ['Dread drift', `${(R.emit - R.decay).toFixed(2)}/s`], ['Production multiplier', `×${R.global.toFixed(2)}`],
        ];
        const html = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
        const t = $('stats-table');
        if (t && t.innerHTML !== html) t.innerHTML = html;
    }

    panelClick(e) {
        const G = this.G;
        if (!G) return;
        const t = e.target;
        const amt = t.closest('[data-amount]');
        if (amt) { const v = amt.dataset.amount; this.amount = v === 'max' ? 'max' : +v; this.audio.ui('click'); this.renderTab(G, this.R, true); return; }
        const buy = t.closest('[data-buy]');
        if (buy) {
            this.send({ t: 'buy', id: buy.dataset.buy, n: this.amount === 'max' ? 'max' : this.amount }, (ok) => { if (!ok) this.audio.ui('no'); else { buy.classList.remove('flash'); void buy.offsetWidth; buy.classList.add('flash'); } });
            return;
        }
        const pick = t.closest('[data-pick]');
        if (pick) {
            const key = pick.dataset.pick;
            const [kind, id] = key.split(':');
            if (kind === 'u' && !G.upg[id]) {
                if (this.sel.upgrades === id && this.detailKey === key) this.send({ t: 'upgrade', id }, (ok) => this.audio.ui(ok ? 'buy' : 'no'));
                this.sel.upgrades = id;
            }
            this.detailKey = key;
            this.showDetail(key);
            this.audio.ui('click');
            this.renderTab(G, this.R);
            return;
        }
        const act = t.closest('[data-act]');
        if (act) {
            const a = act.dataset.act;
            if (a === 'upgradeAll') this.send({ t: 'upgradeAll' });
            else if (a === 'hench') this.send({ t: 'hench' });
            else if (a === 'relocate') {
                const gain = legendGain(G), next = LAIRS[(G.runs + 1) % LAIRS.length];
                this.confirm(`Relocate to ${next.name}?`, `<p>${esc(next.desc)} <b>${esc(next.bonus)}</b></p><p>You'll earn <b>★ ${fmt(gain, 0)} legend</b> (+${fmt(gain * 2, 0)}% charm, forever) and points to spend in the Grimoire.</p><p class="dim">Left behind: charm, minions, upgrades, décor, gold and henchmen. Kept: legend, perks, heirlooms and trophies.</p>`, 'Relocate!', () => this.send({ t: 'relocate' }));
            }
            return;
        }
        const dec = t.closest('[data-decor]');
        if (dec) { this.send({ t: 'decor', id: dec.dataset.decor }, (ok) => { if (!ok) this.audio.ui('no'); }); return; }
        const sch = t.closest('[data-scheme]');
        if (sch) { this.send({ t: 'scheme', i: +sch.dataset.scheme }); return; }
        const perk = t.closest('[data-perk]');
        if (perk) { this.send({ t: 'perk', id: perk.dataset.perk }, (ok) => { if (!ok) this.audio.ui('no'); }); }
    }

    // ------------------------------------------------------------------ events
    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.innerHTML = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3300);
    }
    /** Why a locked room can't be entered, and what opens it. */
    roomHint(id) {
        const h = HOBBY[id], m = MINIONS.find((x) => x.hobby === id);
        const seen = this.G && minionVisible(this.G, m);
        this.audio.ui('no');
        this.toast(`🔒 The <b>${esc(h.room)}</b> opens when you hire a <b>${esc(seen ? m.name : '???')}</b>${seen ? '' : ' (make more charm to discover one)'}.`);
    }
    /** What a gravestone says when it can't be played yet. */
    graveHint(G, R, id) {
        const g = GRAVE[id];
        this.audio.ui('no');
        if (g.soon) { this.toast(`🪦 <i>“${esc(g.epitaph)}”</i> This grave is still being dug: a new mini-game will rest here one day.`); return; }
        const [have, want] = g.need(G, R);
        this.toast(`${g.icon} <b>${esc(g.name)}</b> opens when you ${esc(g.needText.toLowerCase())} (${fmt(Math.min(have, want), 0)} / ${fmt(want, 0)}).`);
    }

    /** The Skull Swap sheet: level, goal, moves, score, and the result once the last move has played out. */
    m3Update(G) {
        const B = G.yard.m3.board;
        if (!B) return;
        const s = B.spec;
        this.text('m3-level', `Level ${B.level}`);
        this.text('m3-moves', String(B.movesLeft));
        this.text('m3-score', fmt(B.score, 0));
        let goal;
        if (s.type === 'score') goal = `<span class="${B.score >= s.target ? 'done' : ''}">Score ${fmt(Math.min(B.score, s.target), 0)} / ${fmt(s.target, 0)}</span>`;
        else if (s.type === 'collect') goal = 'Collect ' + Object.entries(s.need).map(([k, n]) => `<span class="${(B.collected[k] || 0) >= n ? 'done' : ''}"><img alt="${KINDS[k]}" src="${this.tokenIcons[k]}"> ${Math.min(B.collected[k] || 0, n)} / ${n}</span>`).join(' ');
        else goal = `<span class="${B.websLeft <= 0 ? 'done' : ''}">🕸️ Clear the cobwebs: ${s.webs - Math.max(0, B.websLeft)} / ${s.webs}</span>`;
        goal += ` <span class="dim">${Math.round(goalProgress(B) * 100)}%</span>`;
        const el = $('m3-goal');
        if (el.innerHTML !== goal) el.innerHTML = goal;
        const end = $('m3-end');
        const show = B.over && !this.m3view.busy;
        if (show && end.hidden) {
            const e = this.m3last;
            const stars = [1, 2, 3].map((n) => `<span class="${n <= B.stars ? '' : 'off'}">⭐</span>`).join('');
            $('m3-end-text').innerHTML = B.won
                ? `<h3>Level ${B.level} cleared!</h3><div class="stars">${stars}</div><p>💗 +${fmt(e?.charm || 0)} · 🪙 +${fmt(e?.gold || 0, 0)}</p>`
                : `<h3>Out of moves</h3><p>So close. The skulls are giggling.</p>`;
            $('m3-again').textContent = B.won ? `Next level` : 'Try again';
            end.hidden = false;
            $('m3-again').focus({ preventScroll: true });
        } else if (!show && !end.hidden) end.hidden = true;
    }
    ping(room) {
        const b = document.querySelector(`#rooms .room[data-room="${room}"]`);
        if (!b || this.G?.room === room) return;
        b.classList.add('ping');
        clearTimeout(b._ping);
        b._ping = setTimeout(() => b.classList.remove('ping'), 2500);
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'ach': this.toast(`🏆 Trophy: <b>${esc(ACH[e.id].name)}</b> <span class="dim">+1% charm</span>`, 'gold'); break;
                case 'heirloom': this.toast(`📿 Heirloom found: <b>${esc(HEIRLOOM[e.id].name)}</b>`, 'gold'); break;
                case 'schemeDone': {
                    const s = SCHEME_BY[e.id], bits = [];
                    if (e.charm) bits.push(`💗 ${fmt(e.charm)}`); if (e.gold) bits.push(`🪙 ${fmt(e.gold, 0)}`); if (e.dread) bits.push(`☠ ${e.dread > 0 ? '+' : ''}${e.dread}`);
                    this.toast(`${s.kind === 'evil' ? '☠' : '💗'} ${esc(s.name)} — done! ${bits.join(' · ')}`);
                    break;
                }
                case 'buy': this.ping(e.hobby); if (e.owned === e.n) this.toast(`${MINION[e.id].icon} Your first <b>${esc(MINION[e.id].name)}</b>! ${MINIONS.filter((m) => m.hobby === e.hobby).every((m) => m.id === e.id || !G.owned[m.id]) && e.hobby !== 'cook' ? `The ${HOBBY[e.hobby].room} is open.` : ''}`); break;
                case 'decor': if (DECOR_BY[e.id].room !== 'all') this.ping(DECOR_BY[e.id].room); this.toast(`${DECOR_BY[e.id].icon} <b>${esc(DECOR_BY[e.id].name)}</b> placed${DECOR_BY[e.id].room === 'all' ? ' in every room' : ' in the ' + HOBBY[DECOR_BY[e.id].room].room}.`); break;
                case 'tier':
                    if (e.to === 'suspected') this.toast('🫣 <b>Rumours!</b> The village thinks you might be… nice. Cackle!');
                    else if (e.to === 'dreaded') this.toast('👹 <b>Dreaded.</b> The kingdom trembles. Tribute doubles.', 'gold');
                    else if (e.to === 'feared' && e.from === 'unsettling') this.toast('😈 <b>Feared.</b> Tribute begins to arrive.');
                    break;
                case 'heroGossip': this.toast('🗡️ A hero saw the doilies! <b>−15 dread</b>'); break;
                case 'greet': {
                    if (e.kind === 'hero') this.toast(`🗡️ The hero flees in terror! ☠ +18 · 🪙 +${fmt(e.gold, 0)}`);
                    else if (e.kind === 'kitten') this.toast('🐈 <b>Cuddle Frenzy!</b> All charm ×7.', 'gold');
                    else if (e.kind === 'bard') this.toast('🪕 <b>Encore!</b> Crafting ×13.', 'gold');
                    else if (e.kind === 'critic') this.toast(`🧐 A rave review! 💗 +${fmt(e.amount)}`, 'gold');
                    break;
                }
                case 'graveOpen': {
                    this.toast(`${GRAVE[e.id].icon} Something stirs in the cemetery… <b>${esc(GRAVE[e.id].name)}</b> is open! Visit the 🪦 Graves.`, 'gold');
                    const b = $('btn-yard'); b.classList.add('ping'); clearTimeout(b._ping); b._ping = setTimeout(() => b.classList.remove('ping'), 8000);
                    break;
                }
                case 'm3end': this.m3last = e; break;
                case 'm3board': this.m3last = null; $('m3-end').hidden = true; break;
                case 'perk': this.toast(`📖 Learned: <b>${esc(PERK[e.id].name)}</b>`); break;
                case 'relocate': this.toast(`🧳 Welcome to <b>${esc(LAIRS[e.to].name)}</b>! ★ +${fmt(e.gain, 0)} legend.`, 'gold'); this.setTab('minions'); break;
                case 'ability': if (e.id === 'soiree') this.toast('💃 <b>A Grand Soirée!</b> All charm ×3 — the guests are charmed (−20 dread).'); break;
                case 'away': this.showAway(e); break;
                default: break;
            }
        }
    }

    showAway(e) {
        if (e.sec < 60) return;
        const capped = e.counted < e.sec;
        $('away-text').innerHTML = `
            <p>You were away for <b>${fmtTime(e.sec)}</b>${capped ? ` (your minions only remember the last ${fmtTime(e.counted)})` : ''}. While you were gone your minions worked at ${Math.round(e.rate * 100)}% and made <b>💗 ${fmt(e.charm)}</b>.</p>
            ${e.gold >= 1 ? `<p>Tribute: <b>🪙 ${fmt(e.gold, 0)}</b>.</p>` : ''}
            ${e.schemes ? `<p>Your henchmen finished <b>${e.schemes}</b> scheme${e.schemes > 1 ? 's' : ''}.${e.heirlooms ? ` They brought back <b>${e.heirlooms}</b> heirloom${e.heirlooms > 1 ? 's' : ''}!` : ''}</p>` : ''}
            ${e.dread < -10 ? `<p>Without you cackling, your reputation slipped (☠ ${Math.round(e.dread)}). The village has been talking.</p>` : ''}
        `;
        this.openScreen('away');
    }
}

export { tierOf, DREAD, ABILITY, SCHEMES };
