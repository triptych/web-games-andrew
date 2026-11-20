// The DOM: title, HUD, hint, toasts, the menu (party and equipment, items, journal, system), the shop, the ally
// picker, settings, and the battle's party cards, command menu, targets and result. Every change to the game
// goes through `send(cmd)` (main.js → act()). Reads G; never writes it.

import { PARTY } from './sim/data/party.js';
import { ITEMS, SHOPS } from './sim/data/items.js';
import { QUESTS } from './sim/data/quests.js';
import { MAPS } from './sim/data/maps.js';
import { ENEMIES } from './sim/data/enemies.js';
import { stats, abilitiesOf, questProgress } from './sim/rules.js';
import { STATUS_NAMES } from './sim/battle.js';
import { nextGoal, sideGoal } from './sim/guide.js';
import { itemUrl, artUrl } from './view/assets.js';
import { xpToNext, INN_COST } from './config.js';
import { esc } from './vn.js';

const $ = (id) => document.getElementById(id);
const BAD = new Set(['poison', 'stun', 'slow', 'weak', 'mark']);
const face = (id) => artUrl('por', id);
const CHAPTERS = ['', 'The Road to Thornhaven', 'Roots and Oaths', 'The Sealed Sanctum', 'Echoes End'];

export class UI {
    constructor({ audio, send, settings, onSettings }) {
        this.audio = audio;
        this.send = send;
        this.settings = settings;
        this.onSettings = onSettings;
        this.tab = 'party';
        this.shopTab = 'buy';
        this.bsel = null;     // battle selection state
        this.stack = [];      // open sheets, newest last
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => this.closeTop());
        $('menu-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.tab = b.dataset.tab; this.audio.ui('click'); this.renderMenu(); } });
        $('shop-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.shopTab = b.dataset.tab; this.audio.ui('click'); this.renderShop(); } });
        $('shop-close').addEventListener('click', () => this.send({ t: 'close' }));
        // settings
        const S = this.settings;
        for (const k of ['music', 'sfx', 'voice']) { const el = $('set-' + k); el.value = S[k]; el.addEventListener('input', () => { S[k] = +el.value; this.onSettings(); }); }
        for (const k of ['speed', 'bspeed']) { const el = $('set-' + k); el.value = String(S[k]); el.addEventListener('change', () => { S[k] = +el.value; this.onSettings(); }); }
        for (const k of ['narr', 'barks']) { const el = $('set-' + k); el.checked = !!S[k]; el.addEventListener('change', () => { S[k] = el.checked; this.onSettings(); }); }
    }

    // ------------------------------------------------------------ sheets
    open(id) {
        const el = $(id);
        if (!el.hidden) return;
        el.hidden = false;
        el.style.zIndex = 60 + this.stack.length * 2;
        this.stack.push(id);
        this.audio.ui('click');
        const first = el.querySelector('.sheet-body button, .sheet-foot button');
        first?.focus({ preventScroll: true });
    }
    close(id) { $(id).hidden = true; this.stack = this.stack.filter((x) => x !== id); if (id === 'menu') this.G && this.renderHud(this.G); }
    closeTop() {
        const id = this.stack[this.stack.length - 1];
        if (!id) return false;
        if (id === 'shop') { this.send({ t: 'close' }); return true; }
        this.close(id);
        this.audio.ui('page');
        return true;
    }
    get sheetOpen() { return this.stack.length > 0; }

    toast(html, cls = '', icon = null) {
        const t = document.createElement('div');
        t.className = 'toast ' + cls;
        t.innerHTML = (icon ? `<img src="${icon}" alt="">` : '') + `<span>${html}</span>`;
        $('toasts').appendChild(t);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => t.remove(), 2900);
    }

    // ------------------------------------------------------------ HUD
    renderHud(G) {
        this.G = G;
        $('hud-place').textContent = MAPS[G.map].name;
        $('hud-chapter').textContent = `Chapter ${G.chapter} · ${CHAPTERS[G.chapter]}`;
        $('hud-gold').textContent = G.gold;
        $('hud-party').innerHTML = G.party.map((id) => {
            const s = stats(G, id);
            const hp = G.hp[id] / s.mhp, mp = G.mp[id] / Math.max(1, s.mmp);
            return `<div class="pmini" title="${PARTY[id].name}"><img src="${face(id)}" alt="${PARTY[id].name}"><div class="bars"><div class="bar ${hp < 0.3 ? 'low' : ''}"><i style="width:${hp * 100}%"></i></div><div class="bar mp"><i style="width:${mp * 100}%"></i></div></div></div>`;
        }).join('');
    }

    hint(G) {
        const g = nextGoal(G) || sideGoal(G);
        let text = g ? g.text : 'Explore, or rest at the inn.';
        if (g?.level && G.level < g.level) text += ` (The party may want to reach level ${g.level} first; you are level ${G.level}.)`;
        $('hint-text').textContent = text;
        $('hint').hidden = false;
        clearTimeout(this.hintT);
        this.hintT = setTimeout(() => { $('hint').hidden = true; }, 6000);
    }
    say(text) {
        $('hint-text').textContent = text;
        $('hint').hidden = false;
        clearTimeout(this.hintT);
        this.hintT = setTimeout(() => { $('hint').hidden = true; }, 3500);
    }

    // ------------------------------------------------------------ menu
    openMenu(G, tab) { this.G = G; if (tab) this.tab = tab; this.renderMenu(); this.open('menu'); }

    renderMenu() {
        const G = this.G;
        for (const b of $('menu-tabs').children) b.classList.toggle('on', b.dataset.tab === this.tab);
        const body = $('menu-body');
        $('menu-note').textContent = `Level ${G.level} · XP ${G.xp}/${xpToNext(G.level)} · ${G.gold} gold`;
        if (this.tab === 'party') body.innerHTML = G.party.map((id) => this.heroHtml(G, id)).join('');
        else if (this.tab === 'items') body.innerHTML = this.itemsHtml(G);
        else if (this.tab === 'journal') body.innerHTML = this.journalHtml(G);
        else body.innerHTML = this.systemHtml(G);
        body.onclick = (e) => this.menuClick(e);
    }

    heroHtml(G, id) {
        const d = PARTY[id], s = stats(G, id);
        const slot = (k) => {
            const it = G.equip[id][k];
            return `<button class="slot" data-slot="${k}" data-who="${id}">${it ? `<img src="${itemUrl(it)}" alt="">` : ''}<span>${it ? esc(ITEMS[it].name) : `<i>No ${k === 'weapon' ? 'weapon' : 'armour'}</i>`}<small>${k === 'weapon' ? 'Weapon' : 'Armour'} · change</small></span></button>`;
        };
        const ab = abilitiesOf(G, id).map((a) => `<b>${esc(a.name)}</b>${a.mp ? ` (${a.mp} MP)` : ''}`).join(' · ');
        const next = d.abilities.find((a) => (a.lv || 1) > G.level);
        return `<div class="hero"><img src="${face(id)}" alt="${d.name}"><div>
            <h3>${d.name}<small>${d.title}</small></h3>
            <div class="bar ${G.hp[id] / s.mhp < 0.3 ? 'low' : ''}"><i style="width:${G.hp[id] / s.mhp * 100}%"></i></div>
            <div class="bar mp"><i style="width:${G.mp[id] / Math.max(1, s.mmp) * 100}%"></i></div>
            <div class="stats"><span>HP <b>${G.hp[id]}/${s.mhp}</b></span><span>MP <b>${G.mp[id]}/${s.mmp}</b></span><span>ATK <b>${s.atk}</b></span><span>DEF <b>${s.def}</b></span><span>SPD <b>${s.spd}</b></span></div>
            <div class="slots">${slot('weapon')}${slot('armor')}</div>
            <div class="abil">${ab}${next ? ` · <i>learns ${esc(next.name)} at level ${next.lv}</i>` : ''}</div>
        </div></div>`;
    }

    itemsHtml(G) {
        const groups = [['Restoratives', 'use'], ['Weapons', 'weapon'], ['Armour', 'armor'], ['Loot', 'loot'], ['Key items', 'key']];
        let html = '';
        for (const [label, kind] of groups) {
            const ids = Object.keys(G.inv).filter((id) => ITEMS[id].kind === kind);
            if (!ids.length) continue;
            html += `<div class="cat">${label}</div>` + ids.map((id) => {
                const it = ITEMS[id];
                const act = kind === 'use' && it.target !== 'fallen' ? `<button class="btn small" data-use="${id}">Use</button>`
                    : kind === 'weapon' || kind === 'armor' ? `<button class="btn small" data-equip="${id}">Equip</button>` : '';
                return `<div class="item"><img src="${itemUrl(id)}" alt=""><div><div class="nm">${esc(it.name)} <span class="qty">×${G.inv[id]}</span></div><div class="ds">${esc(it.desc)}</div></div><div class="acts">${act}</div></div>`;
            }).join('');
        }
        return html || '<p class="note">Your pack is empty.</p>';
    }

    journalHtml(G) {
        const g = nextGoal(G) || sideGoal(G);
        let html = g ? `<div class="where"><b>Where to next?</b>${esc(g.text)}${g.level && G.level < g.level ? ` <i>(Recommended level ${g.level}.)</i>` : ''}</div>` : '';
        const ids = Object.keys(G.quests).sort((a, b) => (G.quests[a].s === 'done') - (G.quests[b].s === 'done'));
        html += ids.map((id) => {
            const q = QUESTS[id], st = G.quests[id], done = st.s === 'done';
            const objs = questProgress(G, id).map((o) => `<div class="obj ${o.ok ? 'ok' : ''}">${esc(o.label)}${o.count ? ` (${o.have}/${o.need})` : ''}</div>`).join('');
            return `<div class="quest ${done ? 'done' : ''}"><h4>${esc(q.title)}${q.main ? '<span class="tag">Main</span>' : ''}${done ? ' ✓' : ''}</h4>${done ? '' : `<p>${esc(q.desc)}</p>${objs}`}</div>`;
        }).join('');
        return html || '<p class="note">No quests yet.</p>';
    }

    systemHtml(G) {
        return `<div class="cat">Journey</div>
            <div class="stats" style="grid-template-columns:repeat(2,auto)"><span>Chapter <b>${G.chapter}</b></span><span>Level <b>${G.level}</b></span><span>Battles <b>${G.stats.battles}</b></span><span>Steps <b>${G.stats.steps}</b></span></div>
            <div class="cat">Game</div>
            <p class="note">The game saves itself whenever you change place, rest or finish a battle.</p>
            <div style="display:grid;gap:8px;max-width:320px">
                <button class="btn" data-sys="save">Save now</button>
                <button class="btn" data-sys="settings">Settings</button>
                <button class="btn" data-sys="howto">How to Play</button>
                <button class="btn" data-sys="title">Quit to Title</button>
            </div>`;
    }

    menuClick(e) {
        const G = this.G;
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.slot) return this.pickEquip(G, b.dataset.who, b.dataset.slot);
        if (b.dataset.use) return this.pickAlly(G, `Use ${ITEMS[b.dataset.use].name} on…`, (who) => this.send({ t: 'use', item: b.dataset.use, who }), b.dataset.use);
        if (b.dataset.equip) {
            const it = ITEMS[b.dataset.equip];
            return this.pickAlly(G, `Equip ${it.name} on…`, (who) => this.send({ t: 'equip', who, item: b.dataset.equip }), null, (id) => it.who.includes(id));
        }
        if (b.dataset.sys) this.onSystem?.(b.dataset.sys);
    }

    /** Pick an ally: for an item or a piece of equipment. */
    pickAlly(G, title, then, item, allow = () => true) {
        $('picker-title').textContent = title;
        $('picker-body').innerHTML = G.party.map((id) => {
            const s = stats(G, id);
            const ok = allow(id);
            return `<button class="btn pick" data-who="${id}" ${ok ? '' : 'disabled'}><img src="${face(id)}" alt=""><span><b>${PARTY[id].name}</b><br><small>HP ${G.hp[id]}/${s.mhp} · MP ${G.mp[id]}/${s.mmp}${ok ? '' : ' · can\'t use it'}</small></span></button>`;
        }).join('');
        $('picker-body').onclick = (e) => { const b = e.target.closest('[data-who]'); if (!b || b.disabled) return; this.close('picker'); then(b.dataset.who); this.refreshOpen(); };
        this.open('picker');
    }

    pickEquip(G, who, slot) {
        const cur = G.equip[who][slot];
        const opts = Object.keys(G.inv).filter((id) => ITEMS[id].kind === slot && ITEMS[id].who.includes(who));
        const s = stats(G, who);
        const diff = (id) => {
            const a = cur ? ITEMS[cur].stats : {}, b = ITEMS[id].stats;
            return ['atk', 'def', 'spd', 'mp'].map((k) => { const d = (b[k] || 0) - (a[k] || 0); return d ? `<span class="diff ${d > 0 ? 'up' : 'down'}">${k.toUpperCase()} ${d > 0 ? '+' : ''}${d}</span>` : ''; }).filter(Boolean).join(' ');
        };
        $('picker-title').textContent = `${PARTY[who].name}: ${slot === 'weapon' ? 'weapon' : 'armour'}`;
        $('picker-body').innerHTML = (cur ? `<button class="btn pick" data-un="1"><img src="${itemUrl(cur)}" alt=""><span><b>Take off ${esc(ITEMS[cur].name)}</b><br><small>ATK ${s.atk} · DEF ${s.def}</small></span></button>` : '')
            + opts.map((id) => `<button class="btn pick" data-item="${id}"><img src="${itemUrl(id)}" alt=""><span><b>${esc(ITEMS[id].name)}</b> ×${G.inv[id]}<br><small>${diff(id) || esc(ITEMS[id].desc)}</small></span></button>`).join('')
            + (opts.length ? '' : `<p class="note">Nothing in your pack ${PARTY[who].name} can use here. Marta's forge in Thornhaven sells ${slot === 'weapon' ? 'weapons' : 'armour'}.</p>`);
        $('picker-body').onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            this.close('picker');
            if (b.dataset.un) this.send({ t: 'unequip', who, slot }); else this.send({ t: 'equip', who, item: b.dataset.item });
            this.refreshOpen();
        };
        this.open('picker');
    }

    refreshOpen() { if (!$('menu').hidden) this.renderMenu(); if (!$('shop').hidden) this.renderShop(); }

    // ------------------------------------------------------------ shop
    openShop(G) { this.G = G; this.shopTab = 'buy'; this.renderShop(); this.open('shop'); }
    closeShop() { this.close('shop'); this.close('picker'); }

    renderShop() {
        const G = this.G;
        if (!G.shop) return;
        const shop = SHOPS[G.shop];
        $('shop-gold').textContent = G.gold;
        $('shop-name').textContent = shop.name;
        for (const b of $('shop-tabs').children) b.classList.toggle('on', b.dataset.tab === this.shopTab);
        const body = $('shop-body');
        if (this.shopTab === 'buy') {
            body.innerHTML = shop.stock.map((id) => {
                const it = ITEMS[id];
                const who = it.who ? ` · ${it.who.length === 4 ? 'anyone' : it.who.map((w) => PARTY[w].name).join(', ')}` : '';
                return `<div class="item"><img src="${itemUrl(id)}" alt=""><div><div class="nm">${esc(it.name)} ${G.inv[id] ? `<span class="qty">have ${G.inv[id]}</span>` : ''}</div><div class="ds">${esc(it.desc)}${who}</div></div><div class="acts"><button class="btn small ${G.gold >= it.buy ? 'gold' : ''}" data-buy="${id}" ${G.gold >= it.buy ? '' : 'disabled'}>${it.buy} g</button></div></div>`;
            }).join('');
        } else {
            const ids = Object.keys(G.inv).filter((id) => ITEMS[id].kind !== 'key' && ITEMS[id].sell > 0);
            body.innerHTML = ids.map((id) => `<div class="item"><img src="${itemUrl(id)}" alt=""><div><div class="nm">${esc(ITEMS[id].name)} <span class="qty">×${G.inv[id]}</span></div><div class="ds">${esc(ITEMS[id].desc)}</div></div><div class="acts"><button class="btn small" data-sell="${id}">Sell ${ITEMS[id].sell} g</button></div></div>`).join('') || '<p class="note">Nothing to sell. Loot from battles sells here.</p>';
        }
        body.onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.buy) {
                const id = b.dataset.buy;
                const err = this.send({ t: 'buy', item: id });
                if (err) { this.audio.ui('deny'); return; }
                const it = ITEMS[id];
                if ((it.kind === 'weapon' || it.kind === 'armor')) {
                    const can = G.party.filter((w) => it.who.includes(w));
                    if (can.length) { this.pickAlly(G, `Equip ${it.name} now?`, (who) => this.send({ t: 'equip', who, item: id }), null, (w) => it.who.includes(w)); }
                }
            }
            if (b.dataset.sell) this.send({ t: 'sell', item: b.dataset.sell });
            this.renderShop();
        };
    }

    // ------------------------------------------------------------ battle
    battleOpen(G, view) {
        this.G = G; this.view = view;
        $('battle').hidden = false;
        $('b-result').hidden = true;
        $('b-menu').innerHTML = ''; delete $('b-menu').dataset.auto;
        $('b-log').textContent = '';
        this.bsel = null;
        this.renderCards(G, view.disp);
        if (this.autoOn) this.autoBar();
    }

    /** Auto stays on from battle to battle; while it runs the menu is hidden, so this bar says so and hands control back. */
    autoBar() {
        const m = $('b-menu');
        if (m.dataset.auto) return;
        m.dataset.auto = '1';
        this.bsel = null;
        $('b-targets').innerHTML = '';
        for (const c of $('b-party').children) { c.classList.remove('pick'); c.onclick = null; }
        m.innerHTML = `<div class="hintline">Auto battle: the party fights on its own</div>
            <button class="btn gold" data-b="manual" title="Choose the commands yourself from the next turn (Q)">✋ Take control</button>`;
        m.onclick = (e) => { if (e.target.closest('[data-b=manual]')) { this.audio.ui('click'); this.setAuto(false); } };
    }

    /** Turn Auto on or off (the menu's Auto button, the bar's Take control, or Q). */
    setAuto(on) {
        this.autoOn = on;
        this.onAuto?.(on);
        const m = $('b-menu');
        if (on) { if (!$('battle').hidden) this.autoBar(); }
        else if (m.dataset.auto) { delete m.dataset.auto; m.innerHTML = '<div class="hintline">Your commands from the next turn.</div>'; }
    }
    battleClose() { $('battle').hidden = true; $('b-targets').innerHTML = ''; this.bsel = null; }

    renderCards(G, disp) {
        const B = G.battle;
        if (!B) return;
        $('b-party').innerHTML = B.units.map((u, i) => {
            if (u.side !== 'p') return '';
            const d = disp?.[i] || u;
            const hp = Math.max(0, d.hp), mp = Math.max(0, Math.min(d.mmp, d.mp));
            const st = Object.keys(u.st).map((k) => `<span class="st ${BAD.has(k) ? 'bad' : ''}">${STATUS_NAMES[k]}</span>`).join('');
            return `<div class="pcard ${hp <= 0 ? 'ko' : ''} ${B.await === i && !this.view?.busy ? 'now' : ''}" data-u="${i}"><img src="${face(u.id)}" alt=""><div class="info">
                <div class="nm"><span>${u.name}</span><span class="nums">${hp}/${u.mhp}</span></div>
                <div class="bar ${hp / u.mhp < 0.3 ? 'low' : ''}"><i style="width:${hp / u.mhp * 100}%"></i></div>
                <div class="bar mp"><i style="width:${mp / Math.max(1, u.mmp) * 100}%"></i></div>
                <div class="nm"><span class="nums">MP ${mp}/${u.mmp}</span><span class="sts">${st}</span></div></div></div>`;
        }).join('');
    }

    cardEl(i) { return $('b-party').querySelector(`[data-u="${i}"]`); }
    cardFx(i, cls) { const el = this.cardEl(i); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 500); }
    pop(i, text, col) {
        const el = this.cardEl(i); if (!el) return;
        const p = document.createElement('div'); p.className = 'pop'; p.textContent = text; p.style.color = col;
        el.appendChild(p); setTimeout(() => p.remove(), 900);
    }
    cardPos(i) { const el = this.cardEl(i); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; }
    log(text, tell) { $('b-log').textContent = text; $('b-log').classList.toggle('tell', !!tell); }
    order(G, order) {
        const B = G.battle;
        $('b-order').innerHTML = order.map((i) => { const u = B.units[i]; const src = u.side === 'p' ? face(u.id) : ENEMIES[u.id].art ? artUrl('por', ENEMIES[u.id].art.slice(4)) : artUrl('enemy', u.id); return `<img class="${u.side}" data-o="${i}" src="${src}" alt="${esc(u.name)}">`; }).join('');
    }

    /** Show the command menu for the hero whose turn it is. */
    battleMenu(G) {
        const B = G.battle;
        const i = B.await;
        if (this.bsel?.unit === i && this.bsel.shown) return;
        this.bsel = { unit: i, shown: true, stage: 'root' };
        this.renderCards(G, this.view.disp);
        for (const img of $('b-order').children) img.classList.toggle('now', +img.dataset.o === i);
        this.renderBattleMenu(G);
    }

    renderBattleMenu(G) {
        const B = G.battle, S = this.bsel, u = B.units[S.unit];
        const m = $('b-menu');
        delete m.dataset.auto;
        $('b-targets').innerHTML = '';
        for (const c of $('b-party').children) c.classList.remove('pick');
        if (S.stage === 'root') {
            m.innerHTML = `<div class="hintline">${esc(u.name)}'s turn</div>
                <button class="btn gold" data-b="attack">⚔ Attack</button>
                <button class="btn" data-b="skills">✦ Skills</button>
                <button class="btn" data-b="items">◉ Items</button>
                <button class="btn" data-b="defend">⛨ Defend</button>
                ${B.canFlee ? '<button class="btn" data-b="flee">↩ Flee</button>' : ''}
                <button class="btn" data-b="auto" title="Let the party fight on its own, from battle to battle (Q)">⟳ Auto</button>`;
        } else if (S.stage === 'skills') {
            const abs = abilitiesOf(G, u.id).filter((a) => a.mp);
            m.innerHTML = `<div class="sub">${abs.map((a) => `<button class="btn" data-ab="${a.id}" ${a.mp > u.mp ? 'disabled' : ''} title="${esc(a.desc)}"><span>${esc(a.name)}</span><small>${a.mp} MP</small></button>`).join('')}</div><div class="hintline" id="b-desc">${esc(abs[0]?.desc || '')}</div><button class="btn" data-b="back">Back</button>`;
            m.onmouseover = (e) => { const b = e.target.closest('[data-ab]'); if (b) $('b-desc').textContent = abs.find((a) => a.id === b.dataset.ab).desc; };
        } else if (S.stage === 'items') {
            const ids = Object.keys(G.inv).filter((id) => ITEMS[id].kind === 'use');
            m.innerHTML = `<div class="sub">${ids.map((id) => `<button class="btn" data-it="${id}"><span>${esc(ITEMS[id].name)}</span><small>×${G.inv[id]}</small></button>`).join('') || '<p class="note">No items.</p>'}</div><button class="btn" data-b="back">Back</button>`;
        } else if (S.stage === 'target') {
            m.innerHTML = `<div class="hintline">${esc(S.label)}: choose a target</div><button class="btn" data-b="back">Back</button>`;
            this.showTargets(G);
        }
        m.onclick = (e) => this.battleClick(G, e);
        m.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }

    battleClick(G, e) {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        const B = G.battle, S = this.bsel, u = B.units[S.unit];
        this.audio.ui('click');
        const act = b.dataset.b;
        if (act === 'attack') { const ab = abilitiesOf(G, u.id)[0]; this.chooseAbility(G, ab); return; }
        if (act === 'skills') { S.stage = 'skills'; return this.renderBattleMenu(G); }
        if (act === 'items') { S.stage = 'items'; return this.renderBattleMenu(G); }
        if (act === 'back') { S.stage = 'root'; return this.renderBattleMenu(G); }
        if (act === 'defend') return this.commit({ t: 'defend' });
        if (act === 'flee') return this.commit({ t: 'flee' });
        if (act === 'auto') return this.setAuto(!this.autoOn);
        if (b.dataset.ab) return this.chooseAbility(G, abilitiesOf(G, u.id).find((a) => a.id === b.dataset.ab));
        if (b.dataset.it) {
            const it = ITEMS[b.dataset.it];
            S.pending = (t) => ({ t: 'item', item: b.dataset.it, target: t });
            S.targetSide = it.target === 'fallen' ? 'fallen' : 'ally';
            S.label = it.name; S.stage = 'target';
            return this.renderBattleMenu(G);
        }
    }

    chooseAbility(G, ab) {
        const B = G.battle, S = this.bsel;
        if (ab.target === 'foe') {
            const foes = B.units.map((v, i) => [v, i]).filter(([v]) => v.side === 'e' && v.hp > 0);
            if (foes.length === 1) return this.commit({ t: 'fight', ability: ab.id, target: foes[0][1] });
            S.pending = (t) => ({ t: 'fight', ability: ab.id, target: t }); S.targetSide = 'foe'; S.label = ab.name; S.stage = 'target';
            return this.renderBattleMenu(G);
        }
        if (ab.target === 'ally') { S.pending = (t) => ({ t: 'fight', ability: ab.id, target: t }); S.targetSide = 'ally'; S.label = ab.name; S.stage = 'target'; return this.renderBattleMenu(G); }
        this.commit({ t: 'fight', ability: ab.id });
    }

    showTargets(G) {
        const B = G.battle, S = this.bsel;
        const box = $('b-targets');
        box.innerHTML = '';
        if (S.targetSide === 'foe') {
            for (const [i, u] of B.units.entries()) {
                if (u.side !== 'e' || u.hp <= 0) continue;
                const s = this.view.spot(i); if (!s) continue;
                const el = document.createElement('button');
                el.className = 'tgt'; el.dataset.t = i;
                const w = Math.max(90, s.h * 0.75);
                Object.assign(el.style, { left: s.x + 'px', top: (s.foot - s.h / 2) + 'px', width: w + 'px', height: s.h + 'px' });
                el.innerHTML = `<span>${esc(u.name)}</span>`;
                el.addEventListener('click', () => this.commit(S.pending(i)));
                box.appendChild(el);
            }
            box.querySelector('.tgt')?.focus({ preventScroll: true });
        } else {
            for (const c of $('b-party').children) {
                const i = +c.dataset.u, u = B.units[i];
                const ok = S.targetSide === 'fallen' ? u.hp <= 0 : u.hp > 0;
                if (!ok) continue;
                c.classList.add('pick');
                c.onclick = () => { if (c.classList.contains('pick')) this.commit(S.pending(i)); };
            }
        }
    }

    /** Cycle the keyboard's target choice (arrows) and confirm (Enter). */
    targetKey(dir) {
        const els = [...$('b-targets').querySelectorAll('.tgt'), ...$('b-party').querySelectorAll('.pick')];
        if (!els.length) return false;
        let k = els.indexOf(document.activeElement);
        k = (k + (dir === 'left' || dir === 'up' ? -1 : 1) + els.length) % els.length;
        els[k].tabIndex = 0; els[k].focus({ preventScroll: true });
        return true;
    }

    commit(cmd) {
        const err = this.send(cmd);
        if (err) { this.audio.ui('deny'); this.log(err); return; }
        $('b-menu').innerHTML = '';
        $('b-targets').innerHTML = '';
        for (const c of $('b-party').children) { c.classList.remove('pick'); c.onclick = null; }
        this.bsel = null;
    }

    battleResult(G, kind, e) {
        const B = G.battle;
        $('b-menu').innerHTML = '';
        $('b-targets').innerHTML = '';
        const foot = $('b-result-foot'), body = $('b-result-body');
        if (kind === 'win') {
            const r = B?.rewards || e;
            $('b-result-title').textContent = 'Victory';
            const items = Object.entries(r.items || {}).map(([id, n]) => `<div class="result-row"><span><img src="${itemUrl(id)}" alt="" style="width:24px;height:24px;vertical-align:middle"> ${esc(ITEMS[id].name)}</span><b>×${n}</b></div>`).join('');
            body.innerHTML = `<div class="result-row"><span>Experience</span><b>+${r.xp}</b></div><div class="result-row"><span>Gold</span><b>+${r.gold}</b></div>${items}${r.levelTo > r.level ? `<div class="lvl">Level up! The party is level ${r.levelTo}.</div>` : ''}`;
            foot.innerHTML = '<span></span><button class="btn gold" data-r="end">Continue</button>';
        } else if (kind === 'lose') {
            $('b-result-title').textContent = 'The party has fallen';
            body.innerHTML = `<p class="prose">Darkness closes in. Try the battle again from the start, or wake at the Ember Hearth Inn having lost half your gold.</p>`;
            foot.innerHTML = '<button class="btn" data-r="wake">Wake at the inn</button><button class="btn gold" data-r="retry">Retry battle</button>';
        } else { this.send({ t: 'end' }); return; }
        $('b-result').hidden = false;
        foot.querySelector('.gold')?.focus({ preventScroll: true });
        foot.onclick = (ev) => {
            const b = ev.target.closest('[data-r]'); if (!b) return;
            $('b-result').hidden = true;
            if (b.dataset.r === 'end') this.send({ t: 'end' });
            else { this.send({ t: 'end' }); this.send({ t: b.dataset.r }); }
        };
    }

    // ------------------------------------------------------------ ending
    ending(G) {
        $('end-title').textContent = G.ending === 'release' ? 'The scroll burns. The echo fades.' : 'The scroll is kept. The echo is remembered.';
        $('end-stats').innerHTML = [['Level', G.level], ['Battles', G.stats.battles], ['Steps', G.stats.steps], ['Gold', G.gold],
            ['Companions', G.party.length - 1 + ' of 3'], ['Quests', Object.values(G.quests).filter((q) => q.s === 'done').length + ' of ' + Object.keys(QUESTS).length]]
            .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
        $('ending').hidden = false;
        $('btn-end').focus({ preventScroll: true });
    }
}
