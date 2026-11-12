// Gemheart Saga — the DOM layer: screens, the village, panels, the hero sheet, scenes and the battle HUD.
// Reads G; every change goes through the cmd() callback (act in main.js). Never writes G.

import { VERSION, BATTLE, MANA, GEM, XP_CURVE, HOUR, QUEST_REST } from './config.js';
import { ART, img, iconEl, setCell, ICON, GEM_ICON } from './assets.js';
import { HEROES, HERO, NODE, MAX_RANK } from './sim/data/heroes.js';
import { REGION, FOE, ABILITIES } from './sim/data/world.js';
import { ITEM, SLOTS } from './sim/data/items.js';
import { BUILDINGS, BUILDING, NPC, REQUESTS, RESOURCES, RES_NAMES, PRODUCE } from './sim/data/village.js';
import * as V from './sim/village.js';
import * as St from './sim/stats.js';
import { chapter, regionsOpen, actives, learnBlock, tale } from './sim/game.js';
import { canSkill, canItem } from './sim/battle.js';
import { Ticker } from './ticker.js';
import { Folk } from './folk.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : String(Math.floor(n)));


const POOL_NAME = { r: 'Ruby', s: 'Sapphire', e: 'Emerald', a: 'Amethyst' };
const GEM_TEXT = [['Sword', 'hits the foe'], ['Heart', 'heals you'], ['Ruby', 'red mana'], ['Sapphire', 'blue mana'], ['Emerald', 'green mana'], ['Amethyst', 'violet mana']];

export class UI {
    constructor({ audio, settings, cmd, onSettings, onDeleteSave, onTitle, now, G }) {
        this.audio = audio;
        this.settings = settings;
        this.cmd = cmd;
        this.now = now;
        this.G = G;
        this.ticker = new Ticker(this, $('ticker'));
        this.folk = new Folk($('folk'));
        this.folk.calm = !!settings.calm;
        window.addEventListener('resize', () => this.folk.resize());
        this.stack = [];
        this.panel = null;                 // { kind, id, tab, sel }
        this.typing = null;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        // a resource tip closes on any press outside it
        window.addEventListener('pointerdown', (e) => { if (!e.target.closest('#res-tip, .res')) this.closeTip(); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), text = $('set-text'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; text.value = settings.text; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, text: text.value, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, text, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved tale deleted.'); });
        $('set-title').addEventListener('click', () => onTitle());

        // the gem legend in How to Play
        const leg = $('gem-legend');
        GEM_TEXT.forEach(([n, d], k) => { const li = h('li'); li.append(iconEl(GEM_ICON[k], 'lg')); li.append(h('span', '', `<b>${n}</b>: ${d}`)); leg.append(li); });
    }

    // ------------------------------------------------------------------ screen stack
    openScreen(id) {
        if (this.top() === id) return;
        this.closeTip();
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel') { this.panel = null; if (!$('forge').hidden) { clearTimeout(this.forgeT); for (const t of this.forgeStrikes || []) clearTimeout(t); $('forge').hidden = true; $('forge').innerHTML = ''; } }
        if (this.top()) this.focusFirst(this.top());
        this.onClose?.(id);
    }
    closeTop() { const t = this.top(); if (t && t !== 'title' && t !== 'village' && t !== 'scene') this.closeScreen(t); }
    closeAll() { for (const s of [...this.stack]) this.closeScreen(s); }
    top() { return this.stack[this.stack.length - 1] || null; }
    has(id) { return this.stack.includes(id); }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input, .card')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { const b = this.buttons(id)[0]; if (b) b.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const id = this.top();
        if (!id) return;
        const list = this.buttons(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const n = list[(i + dir + list.length) % list.length];
        n.focus();
        n.scrollIntoView?.({ block: 'nearest' });
    }

    toast(text) {
        const el = h('div', 'toast');
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2900);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    }

    // ------------------------------------------------------------------ hero select
    heroSelect(onPick) {
        const box = $('hero-cards');
        box.innerHTML = '';
        for (const hr of HEROES) {
            const c = h('button', 'card hero-card');
            c.dataset.hero = hr.id;
            const por = h('div', 'por');
            por.style.backgroundImage = `url(${ART.por(hr.id)})`;
            c.append(por, h('h3', '', esc(hr.name)), h('div', 'cls', esc(hr.title)), h('div', 'tale', `“${esc(hr.tale)}”`), h('p', '', esc(hr.pitch)));
            c.addEventListener('click', () => { this.audio.ui('click'); onPick(hr.id); });
            c.addEventListener('focus', () => this.audio.say(`${hr.id}-cry`, { gap: 1.5 }));
            box.append(c);
        }
        this.openScreen('heroes');
    }

    // ------------------------------------------------------------------ scenes
    showScene(G) {
        const S = G.scene;
        if (!S) return;
        const [sp, text] = S.lines[S.i];
        const scr = $('scene');
        const region = G.quest?.region || (S.tag === 'opening' ? null : null);
        scr.querySelector('.scene-bg').style.backgroundImage = `url(${S.tag === 'opening' ? ART.bg('title') : region ? ART.bg(region) : ART.bg('village')})`;
        const por = scr.querySelector('.scene-por');
        const who = speaker(G, sp);
        por.classList.toggle('none', !who.img);
        por.style.display = who.img ? '' : 'none';
        por.style.backgroundImage = who.img ? `url(${who.img})` : '';
        por.style.backgroundSize = who.mon ? 'contain' : 'cover';
        scr.querySelector('.scene-name').textContent = who.name;
        this.typeLine(scr.querySelector('.scene-line'), text);
        if (!this.has('scene')) this.openScreen('scene');
        this.audio.sayLine(text);
    }

    typeLine(el, text) {
        clearInterval(this.typing?.timer);
        const speed = this.settings.text;
        if (speed === 'instant' || this.settings.calm) { el.textContent = text; this.typing = null; return; }
        let n = 0;
        const per = speed === 'fast' ? 2 : 1;
        el.textContent = '';
        const timer = setInterval(() => {
            n += per;
            el.textContent = text.slice(0, n);
            if (n >= text.length) { clearInterval(timer); this.typing = null; }
        }, 16);
        this.typing = { timer, el, text };
    }
    /** If a line is still typing, finish it and return true (the tap that did it doesn't advance). */
    finishTyping() {
        if (!this.typing) return false;
        clearInterval(this.typing.timer);
        this.typing.el.textContent = this.typing.text;
        this.typing = null;
        return true;
    }

    // ------------------------------------------------------------------ village
    renderVillage(G) {
        const now = this.now();
        // the village refreshes every second for its stores: build each part off-page and swap it in only if it changed,
        // so an idle village doesn't repaint (and re-rasterise its atlases) every second
        const fresh = this.villageG !== G;
        this.villageG = G;
        // (compared with what was last put there, so parts updated in place, like the Collect timer, don't count)
        if (fresh) this.vHtml = {};
        const put = (id, kids) => {
            const box = $(id), tmp = document.createElement('div');
            tmp.append(...kids);
            if (fresh || tmp.innerHTML !== this.vHtml[id]) { this.vHtml[id] = tmp.innerHTML; box.replaceChildren(...tmp.childNodes); }
        };
        const bar = [];
        for (const r of RESOURCES) {
            const s = h('button', 'res');
            s.dataset.res = r;
            s.title = `${RES_NAMES[r]}: how to get more`;
            s.addEventListener('click', (e) => { e.stopPropagation(); this.resTip(r, s); });
            const pill = h('span', 'pill');
            pill.append(iconEl(ICON[r]), document.createTextNode(fmt(G.res[r])));
            s.append(pill);
            bar.push(s);
        }
        put('res-bar', bar);
        const hr = HERO[G.hero.id];
        const stats = St.heroStats(G);
        const por = h('div', 'por');
        por.style.backgroundImage = `url(${ART.por(hr.id)})`;
        const xpNeed = XP_CURVE(G.hero.lv);
        put('hero-chip', [por, h('div', 'grow', `<b>${esc(hr.name)}</b><div class="dim">Level ${G.hero.lv} ${esc(hr.title)}${G.hero.sp ? ` · <span class="better">${G.hero.sp} skill point${G.hero.sp > 1 ? 's' : ''}</span>` : ''}</div>
            <div class="dim">♥ ${stats.hp} · ⚔ ${stats.atk} · ⛨ ${stats.def}</div><div class="bar"><i style="width:${Math.min(100, (G.hero.xp / xpNeed) * 100)}%"></i></div>`)]);
        // idle production and the daily gift
        const p = V.pending(G, now);
        const card = document.createElement('div');
        card.append(h('h3', '', 'Village stores'));
        const pend = h('div', 'pend');
        let any = false;
        for (const r of RESOURCES) if (p[r] >= 1) { any = true; const s = h('span'); s.append(iconEl(ICON[r]), document.createTextNode('+' + Math.floor(p[r]))); pend.append(s); }
        if (!any) pend.append(h('span', 'dim', 'Nothing to collect yet.'));
        card.append(pend);
        const rate = V.rates(G);
        card.append(h('div', 'dim', `Per hour: ${RESOURCES.filter((r) => rate[r]).map((r) => `${rate[r]} ${r}`).join(', ')}. Stores hold ${V.capHours(G)} h.`));
        if (now < G.village.boostUntil) card.append(h('div', 'better', `Harvest festival! Production doubled for ${Math.ceil((G.village.boostUntil - now) / 60000)} min.`));
        // the Collect button fills toward the next whole unit; a line under it counts down (v1.2.0)
        const col = h('button', 'btn collect' + (any ? ' primary' : ''), '<span class="prog"><i id="collect-prog"></i></span><span class="lbl">Collect</span>');
        col.id = 'btn-collect';
        col.disabled = !any;
        col.title = any ? 'Collect what the village has made' : 'Nothing whole to collect yet';
        col.addEventListener('click', () => this.cmd({ t: 'collect', now: this.now() }));
        card.append(col, h('div', 'next-tick', '<span id="collect-next"></span>'));
        const day = this.today();
        const gift = h('button', 'btn ' + (V.canDaily(G, day) ? 'primary' : ''), V.canDaily(G, day) ? `🎁 Daily gift (day ${dailyStreakNext(G, day)})` : `Daily gift claimed · streak ${G.village.daily.streak}`);
        gift.id = 'btn-daily';
        gift.disabled = !V.canDaily(G, day);
        gift.addEventListener('click', () => this.cmd({ t: 'daily', day: this.today(), now: this.now() }));
        card.append(gift);
        put('idle-card', [...card.childNodes]);
        this.tickCollect(G, now);
        // buildings
        const box = [];
        for (const b of BUILDINGS) {
            const lv = G.village.lv[b.id];
            const c = h('button', 'card bld' + (lv ? '' : ' unbuilt'));
            c.dataset.b = b.id;
            const art = h('div', 'art');
            setCell(art, ART.buildings, b.icon, 3);
            c.append(art, h('div', 'nm', esc(b.name)), h('div', 'lv', lv ? '★'.repeat(lv) + '☆'.repeat(5 - lv) : 'Not built'));
            if (!V.buildBlock(G, b.id)) c.append(h('span', 'up', lv ? 'Upgrade' : 'Build'));
            c.addEventListener('click', () => { this.audio.ui('open'); this.openPanel({ kind: 'building', id: b.id }, G); });
            box.push(c);
        }
        put('buildings', box);
        const done = REQUESTS.filter((r) => !G.claimed[r.id] && V.requestDone(G, r)).length;
        // green badges: something to do behind the button
        badge('req-badge', done || '');
        badge('hero-badge', G.hero.sp || (betterGear(G) ? '!' : ''));
        const c = chapter(G);
        $('adv-label').textContent = c ? '⚔ Adventure' : '⚔ Patrols';
        badge('adv-badge', c && G.hero.lv >= c.lv - 1 ? '!' : '');
        $('btn-adventure').title = c ? `Next: ${c.title} (level ${c.lv})` : 'Patrols';
    }
    closeTip() { const t = $('res-tip'); if (t && !t.hidden) { t.hidden = true; return true; } return false; }

    /** A tip under a resource chip: where more of it comes from, built from the game's data (v1.2.0). */
    resTip(r, chip) {
        const tip = $('res-tip');
        if (!tip.hidden && tip.dataset.res === r) { tip.hidden = true; return; }
        const G = this.G?.();
        if (!G) return;
        const lines = [];
        for (const [b, prod] of Object.entries(PRODUCE)) {
            if (!prod[r]) continue;
            const lv = G.village.lv[b] || 0, B = BUILDING[b];
            lines.push(lv ? `<b>${esc(B.name)}</b> makes ${prod[r][lv]} an hour while you're away. Upgrade it for more, and collect often.`
                : `Build the <b>${esc(B.name)}</b> to make it while you're away.`);
        }
        const regions = Object.values(REGION).filter((R) => R.res === r);
        if (regions.length) {
            const open = regionsOpen(G);
            const names = regions.map((R) => esc(R.name) + (open.includes(R.id) ? '' : ' <span class="dim">(not reached yet)</span>'));
            lines.push(`Patrol ${names.join(' or ')}: its foes pay the most ${r}.`);
        }
        if (r === 'gold') lines.push('Every battle pays gold. Villagers\' requests pay well, and the Market buys spare gear.');
        else if (r !== 'crystal') lines.push(`Every battle pays a share of ${r}, wherever you fight.`);
        lines.push('The daily gift grows with your streak and the Town Hall.');
        tip.dataset.res = r;
        tip.innerHTML = `<div class="hd">${iconEl(ICON[r]).outerHTML}<b>${RES_NAMES[r]}</b> <span class="dim">${fmt(G.res[r])}</span></div><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
        tip.hidden = false;
        const rc = chip.getBoundingClientRect();
        tip.style.left = `${Math.max(8, Math.min(rc.left, innerWidth - tip.offsetWidth - 8))}px`;
        tip.style.top = `${rc.bottom + 6}px`;
    }

    /** The Collect button's fill and countdown, updated in place every second. */
    tickCollect(G, now) {
        const bar = $('collect-prog'), line = $('collect-next');
        if (!bar || !line) return;
        const n = V.nextTick(G, now);
        if (!n) { bar.style.width = '0%'; line.textContent = 'Build the Inn, Farm, Mill, Mine or Tower to produce while you are away.'; return; }
        if (n.full) { bar.style.width = '100%'; line.textContent = 'Stores full! Collect so the village keeps working.'; return; }
        bar.style.width = `${Math.round(n.frac * 100)}%`;
        const s = Math.ceil(n.secs);
        const t = s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        line.textContent = `Next: +1 ${RES_NAMES[n.res].toLowerCase()} in ${t}`;
    }
    today() {
        const d = new Date(this.now());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // ------------------------------------------------------------------ panels
    openPanel(p, G) {
        this.panel = p;
        this.renderPanel(G);
        this.openScreen('panel');
        if (p.kind === 'building') {
            const npc = BUILDING[p.id].npc;
            if (npc) this.audio.say(npc, { gap: 2 });
        }
    }

    renderPanel(G) {
        const p = this.panel;
        if (!p) return;
        const body = $('panel-body');
        const keep = body.scrollTop;
        body.innerHTML = '';
        if (p.kind === 'building') this.buildingPanel(G, p, body);
        else if (p.kind === 'adventure') this.adventurePanel(G, body);
        else if (p.kind === 'hero') this.heroPanel(G, p, body);
        else if (p.kind === 'requests') this.requestsPanel(G, body);
        body.scrollTop = keep;
    }

    npcBox(id) {
        const n = NPC[id];
        const box = h('div', 'npc');
        const por = h('div', 'por');
        por.style.backgroundImage = `url(${ART.por(id)})`;
        box.append(por, h('div', '', `<b>${esc(n.name)}</b> <span class="dim">· ${esc(n.role)}</span><br><q>${esc(n.greet)}</q>`));
        return box;
    }

    costRow(G, cost) {
        const row = h('div', 'cost');
        for (const r of RESOURCES) {
            if (!cost[r]) continue;
            const s = h('span', G.res[r] < cost[r] ? 'short' : '');
            s.append(iconEl(ICON[r]), document.createTextNode(cost[r]));
            row.append(s);
        }
        return row;
    }

    buildingPanel(G, p, body) {
        const b = BUILDING[p.id];
        const lv = G.village.lv[p.id];
        $('panel-title').textContent = b.name;
        if (b.npc) body.append(this.npcBox(b.npc));
        const head = h('div', 'bld-head');
        const art = h('div', 'art');
        setCell(art, ART.buildings, b.icon, 3);
        head.append(art, h('div', 'grow', `<div class="lv" style="color:var(--gold)">${lv ? 'Level ' + lv + ' of 5' : 'Not built yet'}</div><p>${esc(b.what)}</p><p class="dim">${esc(effectText(G, p.id, lv))}</p>`));
        body.append(head);
        const cost = V.buildCost(G, p.id);
        if (cost) {
            body.append(h('div', '', `<b>${lv ? 'Upgrade to level ' + (lv + 1) : 'Build'}:</b> <span class="dim">${esc(effectText(G, p.id, lv + 1))}</span>`));
            body.append(this.costRow(G, cost));
            const block = V.buildBlock(G, p.id);
            const btn = h('button', 'btn primary', lv ? 'Upgrade' : 'Build');
            btn.id = 'btn-build';
            btn.disabled = !!block;
            if (block) btn.title = block;
            btn.addEventListener('click', () => this.cmd({ t: 'build', id: p.id, now: this.now() }));
            body.append(btn);
            if (block) body.append(h('div', 'dim', esc(block)));
        }
        if (p.id === 'market' && lv) this.marketList(G, p, body);
        if (p.id === 'armory' && lv) this.armoryList(G, body);
        if (p.id === 'hall') { body.append(h('h3', '', 'Requests')); this.requestsList(G, body); }
    }

    marketList(G, p, body) {
        const tabs = h('div', 'tabs');
        for (const [k, label] of [['buy', 'Buy'], ['sell', 'Sell']]) {
            const t = h('button', 'btn small', label);
            t.setAttribute('aria-pressed', String((p.tab || 'buy') === k));
            t.addEventListener('click', () => { p.tab = k; this.renderPanel(G); });
            tabs.append(t);
        }
        body.append(tabs);
        const list = h('div', 'list');
        if ((p.tab || 'buy') === 'buy') {
            for (const id of V.stock(G)) {
                const it = ITEM[id];
                const price = V.price(G, id);
                const li = h('div', 'li');
                li.append(iconEl(it.icon, 'lg'));
                li.append(h('div', 'grow', `<div class="nm">${esc(it.name)}</div><div class="sub">${esc(itemLine(G, { id, plus: 0 }))}</div>`));
                const short = G.res.gold < price;
                const btn = h('button', 'btn small' + (short ? ' short' : ''), `${price}g`);
                btn.dataset.buy = id;
                btn.disabled = short;
                btn.title = short ? `Not enough gold: ${price - Math.floor(G.res.gold)} more` : `Buy ${it.name}`;
                btn.addEventListener('click', () => this.cmd({ t: 'buy', id }));
                li.append(btn);
                list.append(li);
            }
        } else {
            const spare = G.inv.filter((i) => !Object.values(G.hero.eq).includes(i.uid));
            if (!spare.length) list.append(h('div', 'dim', 'Nothing to sell: worn gear stays on.'));
            for (const inv of spare) {
                const it = ITEM[inv.id];
                const li = h('div', 'li');
                li.append(iconEl(it.icon, 'lg'), h('div', 'grow', `<div class="nm">${esc(it.name)}${inv.plus ? ' +' + inv.plus : ''}</div><div class="sub">${esc(itemLine(G, inv))}</div>`));
                const btn = h('button', 'btn small', 'Sell');
                btn.addEventListener('click', () => this.cmd({ t: 'sell', uid: inv.uid }));
                li.append(btn);
                list.append(li);
            }
        }
        body.append(list);
    }

    armoryList(G, body) {
        body.append(h('h3', '', `Upgrades (up to +${V.maxPlus(G)})`));
        const list = h('div', 'list');
        for (const inv of G.inv) {
            const it = ITEM[inv.id];
            const li = h('div', 'li');
            const worn = Object.values(G.hero.eq).includes(inv.uid);
            li.append(iconEl(it.icon, 'lg'), h('div', 'grow', `<div class="nm">${esc(it.name)} +${inv.plus}${worn ? ' <span class="dim">(worn)</span>' : ''}</div><div class="sub">${esc(itemLine(G, inv))}</div>`));
            const c = V.upgradeCost(G, inv.uid);
            const btn = h('button', 'btn small' + (G.res.gold < c.gold || G.res.ore < c.ore ? ' short' : ''), `${c.gold}g · ${c.ore} ore`);
            btn.dataset.upgrade = inv.uid;
            btn.disabled = !!V.upgradeBlock(G, inv.uid);
            btn.title = V.upgradeBlock(G, inv.uid) || 'Upgrade';
            btn.addEventListener('click', () => {
                const before = St.itemStats(inv);
                if (this.cmd({ t: 'upgrade', uid: inv.uid })) this.forge(inv.uid, before);
            });
            li.append(btn);
            list.append(li);
        }
        body.append(list);
    }

    /**
     * The forging moment after an Armory upgrade (v1.4.0): three hammer strikes shake the item and throw sparks while
     * it heats to a glow, a white flash, then a card with its new + and what each stat went from and to. A click or a
     * key skips to the card. Only transforms and opacity animate (the village once crawled under software rendering).
     */
    forge(uid, before) {
        const G = this.G();
        const inv = G?.inv.find((x) => x.uid === uid);
        const box = $('forge');
        if (!inv || !box) return;
        clearTimeout(this.forgeT);
        for (const t of this.forgeStrikes || []) clearTimeout(t);
        const it = ITEM[inv.id];
        const after = St.itemStats(inv);
        const calm = !!this.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
        const rows = [['atk', 'Attack'], ['def', 'Defence'], ['hp', 'Health']]
            .filter(([k]) => before[k] || after[k])
            .map(([k, n]) => `<li><span>${n}</span><span>${before[k]} <b class="arrow">→</b> <b class="better">${after[k]}</b></span></li>`).join('');
        const spark = (g) => Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2 + g;
            const r = 44 + (i % 3) * 10;
            return `<i style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 12)}px"></i>`;
        }).join('');
        box.innerHTML = `<div class="forge-card">
            <div class="forge-stage" aria-hidden="true">
                <div class="glow"></div><div class="flash"></div>
                <div class="sparks s1">${spark(0.2)}</div><div class="sparks s2">${spark(0.65)}</div><div class="sparks s3">${spark(1.1)}</div>
                <div class="hammer"><i class="head"></i><i class="haft"></i></div>
                <div class="item"></div>
            </div>
            <p class="forge-wip">${esc(NPC.garrick?.name?.split(' ')[0] || 'The smith')} is forging…</p>
            <div class="forge-out" aria-live="polite">
                <h3 id="forge-title">${esc(it.name)} <span class="plus">+${inv.plus}</span></h3>
                <p class="dim">Forged at the Armory${Object.values(G.hero.eq).includes(uid) ? ' · worn now' : ''}</p>
                ${rows ? `<ul class="forge-stats">${rows}</ul>` : ''}
                <button class="btn primary" id="forge-done">Done</button>
            </div>
        </div>`;
        box.querySelector('.item').append(iconEl(it.icon, 'forge-ico'));
        box.className = 'forge' + (calm ? ' calm' : '');
        box.hidden = false;
        const done = () => {
            if (box.hidden || box.classList.contains('done')) return;
            for (const t of this.forgeStrikes || []) clearTimeout(t);
            box.classList.add('done');
            this.audio.ui('level');
            $('forge-done').focus({ preventScroll: true });
        };
        // the upgrade itself already rang the anvil once; two more strikes follow it
        this.forgeStrikes = calm ? [] : [400, 800].map((ms) => setTimeout(() => this.audio.ui('anvil'), ms));
        this.forgeT = setTimeout(done, calm ? 350 : 1250);
        $('forge-done').addEventListener('click', (e) => { e.stopPropagation(); this.closeForge(); });
        box.onclick = () => { if (box.classList.contains('done')) this.closeForge(); else done(); };
    }

    /** Close the forging card if it is up. Returns whether it was. */
    closeForge() {
        const box = $('forge');
        if (!box || box.hidden) return false;
        clearTimeout(this.forgeT);
        for (const t of this.forgeStrikes || []) clearTimeout(t);
        box.hidden = true;
        box.innerHTML = '';
        this.audio.ui('close');
        document.querySelector('#panel-body [data-upgrade]')?.focus?.({ preventScroll: true });
        return true;
    }

    requestsPanel(G, body) {
        $('panel-title').textContent = 'Villagers\' requests';
        this.requestsList(G, body);
    }

    requestsList(G, body) {
        const list = h('div', 'list');
        const order = [...REQUESTS].sort((a, b) => (G.claimed[a.id] ? 1 : 0) - (G.claimed[b.id] ? 1 : 0) || (V.requestDone(G, b) ? 1 : 0) - (V.requestDone(G, a) ? 1 : 0));
        for (const rq of order) {
            const [n, of] = V.requestProgress(G, rq);
            const li = h('div', 'li');
            const por = h('i', 'ico lg');
            por.style.backgroundImage = `url(${ART.por(rq.npc)})`;
            por.style.backgroundSize = 'cover';
            por.style.borderRadius = '6px';
            const reward = Object.entries(rq.reward).map(([k, v]) => (k === 'item' ? ITEM[v].name : `${v} ${k}`)).join(', ');
            li.append(por, h('div', 'grow', `<div class="nm">${esc(rq.title)}</div><div class="sub">${esc(rq.text)} (${n}/${of}) · ${esc(reward)}</div>`));
            const btn = h('button', 'btn small' + (V.requestDone(G, rq) && !G.claimed[rq.id] ? ' primary' : ''), G.claimed[rq.id] ? 'Done' : 'Claim');
            btn.dataset.claim = rq.id;
            btn.disabled = !!G.claimed[rq.id] || !V.requestDone(G, rq);
            if (btn.disabled) btn.title = G.claimed[rq.id] ? 'Already claimed' : `Not done yet (${n}/${of})`;
            btn.addEventListener('click', () => this.cmd({ t: 'claim', id: rq.id }));
            li.append(btn);
            list.append(li);
        }
        body.append(list);
    }

    adventurePanel(G, body) {
        $('panel-title').textContent = 'Adventure';
        const c = chapter(G);
        const hr = HERO[G.hero.id];
        if (c) {
            const box = h('div', 'chapter');
            box.append(h('div', 'dim', `${esc(hr.tale)} · Chapter ${G.story.ch + 1} of ${tale(G).length}`), h('h3', '', esc(c.title)),
                h('div', '', `${esc(REGION[c.region].name)} · recommended level ${c.lv}${G.hero.lv < c.lv ? ' <span class="worse">(you are ' + G.hero.lv + ')</span>' : ''}`));
            const foes = h('div', 'foes');
            for (const f of c.fights) { const i = h('i'); i.style.backgroundImage = `url(${ART.mon(f)})`; i.title = FOE[f].name; foes.append(i); }
            box.append(foes);
            const go = h('button', 'btn primary big', 'Begin chapter');
            go.id = 'btn-story';
            go.addEventListener('click', () => { this.closeScreen('panel'); this.cmd({ t: 'story' }); });
            box.append(go);
            body.append(box);
        } else {
            body.append(h('div', 'chapter', `<h3>${esc(hr.tale)}: told</h3><p>The Vale is safe. Patrols, requests and Briarwick go on.</p>`));
        }
        body.append(h('h3', '', 'Patrols'));
        body.append(h('p', 'dim', 'Two quick fights near your level for gold, experience and the region\'s materials.'));
        const list = h('div', 'list');
        for (const rid of regionsOpen(G)) {
            const R = REGION[rid];
            const li = h('div', 'li');
            const art = h('i', 'ico xl');
            art.style.backgroundImage = `url(${ART.bg(rid)})`;
            art.style.backgroundSize = 'cover';
            art.style.borderRadius = '8px';
            li.append(art, h('div', 'grow', `<div class="nm">${esc(R.name)}</div><div class="sub">${esc(R.blurb)}</div>`));
            li.append(iconEl(ICON[R.res]));
            const btn = h('button', 'btn small', 'Patrol');
            btn.dataset.patrol = rid;
            btn.addEventListener('click', () => { this.closeScreen('panel'); this.cmd({ t: 'patrol', region: rid }); });
            li.append(btn);
            list.append(li);
        }
        body.append(list);
    }

    heroPanel(G, p, body) {
        const hr = HERO[G.hero.id];
        $('panel-title').textContent = hr.name;
        const tabs = h('div', 'tabs');
        const marks = { skills: G.hero.sp || '', gear: betterGear(G) ? '!' : '' };
        for (const [k, label] of [['skills', 'Skills'], ['gear', 'Gear'], ['bag', 'Bag'], ['stats', 'Stats']]) {
            const t = h('button', 'btn small', label);
            if (marks[k]) t.append(h('span', 'badge', String(marks[k])));
            t.dataset.tab = k;
            t.setAttribute('aria-pressed', String((p.tab || 'skills') === k));
            t.addEventListener('click', () => { p.tab = k; this.renderPanel(G); });
            tabs.append(t);
        }
        body.append(tabs);
        const tab = p.tab || 'skills';
        if (tab === 'skills') this.skillTree(G, p, body);
        else if (tab === 'gear') this.gearTab(G, body);
        else if (tab === 'bag') this.bagTab(G, body);
        else this.statsTab(G, body);
    }

    skillTree(G, p, body) {
        const hr = HERO[G.hero.id];
        body.append(h('p', 'dim', `Skill points: <b class="better">${G.hero.sp}</b>. One per level. Each skill has ${MAX_RANK} ranks; a tier needs the one above it, and the last tier needs level 6.`));
        const tree = h('div', 'tree');
        hr.tree.forEach((br, bi) => {
            const col = h('div', 'branch');
            col.append(h('h3', '', esc(br.branch)));
            br.nodes.forEach((n, ti) => {
                const r = G.hero.ranks[n.id] || 0;
                const block = learnBlock(G, n.id);
                const btn = h('button', `card node${r ? ' has' : ''}${block && !r ? ' locked' : ''}${!block ? ' can' : ''}`);
                btn.dataset.node = n.id;
                const sk = h('div', 'sk');
                setCell(sk, ART.skills(G.hero.id), bi * 3 + ti, 3);
                btn.append(sk, h('div', 'nm', esc(n.name)), h('div', 'ty', n.type), h('div', 'rk', '◆'.repeat(r) + '◇'.repeat(MAX_RANK - r)));
                btn.addEventListener('click', () => { p.sel = n.id; this.renderPanel(G); });
                col.append(btn);
            });
            tree.append(col);
        });
        body.append(tree);
        const sel = p.sel || hr.tree[0].nodes[0].id;
        const n = NODE[sel];
        const r = G.hero.ranks[sel] || 0;
        const info = h('div', 'node-info');
        info.append(h('div', '', `<b>${esc(n.name)}</b> <span class="dim">· ${n.type}${n.cost ? ' · costs ' + St.costText(n.cost) : ''}</span>`));
        info.append(h('div', '', esc(St.describe(n, Math.max(1, r)))));
        if (r < MAX_RANK) info.append(h('div', 'dim', `Next rank: ${esc(St.describe(n, r + 1))}`));
        const block = learnBlock(G, sel);
        const btn = h('button', 'btn primary small', r ? 'Rank up' : 'Learn');
        btn.id = 'btn-learn';
        btn.disabled = !!block;
        if (block) btn.title = block;
        btn.addEventListener('click', () => this.cmd({ t: 'learn', node: sel }));
        info.append(btn);
        if (block && r < MAX_RANK) info.append(h('span', 'dim', ' ' + esc(block)));
        body.append(info);
    }

    gearTab(G, body) {
        // the whole kit at once (v1.2.0)
        const bar = h('div', 'gear-bar');
        const anyWorn = SLOTS.some((sl) => G.hero.eq[sl]);
        const better = betterGear(G);
        const best = h('button', 'btn small' + (better ? ' primary' : ''), 'Equip best');
        best.id = 'btn-equip-best';
        best.disabled = !better;
        best.title = better ? 'Wear the strongest piece you own in every slot' : 'You are already wearing your best';
        best.addEventListener('click', () => this.cmd({ t: 'equipBest' }));
        const off = h('button', 'btn small', 'Remove all');
        off.id = 'btn-unequip-all';
        off.disabled = !anyWorn;
        off.title = anyWorn ? 'Take off everything you wear' : 'Nothing is worn';
        off.addEventListener('click', () => this.cmd({ t: 'unequipAll' }));
        bar.append(best, off);
        body.append(bar);
        for (const slot of SLOTS) {
            body.append(h('h3', '', slot[0].toUpperCase() + slot.slice(1)));
            const list = h('div', 'list');
            const worn = St.equipped(G, slot);
            const ws = worn ? V.gearScore(worn) : 0;
            const items = G.inv.filter((i) => ITEM[i.id].slot === slot);
            if (!items.length) list.append(h('div', 'dim', 'Nothing yet. The Market sells gear; bosses drop it.'));
            for (const inv of items) {
                const it = ITEM[inv.id];
                const on = worn && worn.uid === inv.uid;
                const li = h('div', 'li');
                const cmp = on ? ' <span class="worn">worn</span>' : V.gearScore(inv) > ws ? ' <span class="better">▲ better</span>' : ' <span class="worse">▼</span>';
                li.append(iconEl(it.icon, 'lg'), h('div', 'grow', `<div class="nm">${esc(it.name)}${inv.plus ? ' +' + inv.plus : ''}${cmp}</div><div class="sub">${esc(itemLine(G, inv))}</div>`));
                const btn = h('button', 'btn small', on ? 'Remove' : 'Equip');
                btn.dataset.equip = inv.uid;
                btn.title = on ? `Take off ${it.name}` : `Wear ${it.name}`;
                btn.addEventListener('click', () => this.cmd(on ? { t: 'unequip', slot } : { t: 'equip', uid: inv.uid }));
                li.append(btn);
                list.append(li);
            }
            body.append(list);
        }
    }

    bagTab(G, body) {
        const list = h('div', 'list');
        const ids = Object.keys(G.bag).filter((k) => G.bag[k] > 0);
        if (!ids.length) list.append(h('div', 'dim', 'Empty. The Market sells potions and scrolls.'));
        for (const id of ids) {
            const it = ITEM[id];
            const li = h('div', 'li');
            li.append(iconEl(it.icon, 'lg'), h('div', 'grow', `<div class="nm">${esc(it.name)} ×${G.bag[id]}</div><div class="sub">${esc(it.desc)}</div>`));
            list.append(li);
        }
        body.append(list);
    }

    statsTab(G, body) {
        const s = St.heroStats(G), m = s.mods;
        const grid = h('div', 'stats');
        const add = (k, v) => grid.append(h('div', 'stat', `${k}<b>${v}</b>`));
        add('Health', s.hp); add('Attack', s.atk); add('Defence', s.def);
        add('Level', G.hero.lv); add('Skill power', `+${Math.round(m.skill * 100)}%`); add('Sword gems', `+${Math.round(m.sword * 100)}%`);
        add('Heart gems', `+${Math.round(m.heart * 100)}%`); add('Critical', `${Math.round(m.crit * 100)}%`); add('Damage taken', `-${Math.round(Math.min(0.6, m.defPct) * 100)}%`);
        add('Foes won', G.stats.battlesWon); add('Longest cascade', G.stats.chainMax); add('Special gems', G.stats.specials);
        body.append(grid);
    }

    // ------------------------------------------------------------------ battle HUD
    buildHud(G, onSkill, onItem) {
        const sk = $('skills'), it = $('items');
        sk.innerHTML = ''; it.innerHTML = '';
        this.prevMana = null;
        actives(G).forEach((id, i) => {
            const n = NODE[id];
            const b = h('button', 'skill');
            b.dataset.skill = id;
            b.title = `${n.name}: ${St.describe(n, G.hero.ranks[id])} (${St.costText(n.cost)})`;
            b.setAttribute('aria-label', n.name);
            setCell(b, ART.skills(G.hero.id), n.bi * 3, 3);
            b.append(h('span', 'key', String(i + 1)), h('div', 'fill'), h('div', 'cost', Object.entries(n.cost).map(([p, c]) => `<span style="color:${poolCol(p)}">${c}</span>`).join('')));
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onSkill(id); });
            b.addEventListener('click', (e) => { if (!e.detail) onSkill(id); });
            b.addEventListener('animationend', (e) => { if (e.animationName === 'feed') b.classList.remove('feed'); });
            sk.append(b);
        });
        ['potion', 'greatpotion', 'tonic', 'bomb', 'scroll'].filter((id) => G.bag[id] > 0).slice(0, 3).forEach((id, i) => {
            const b = h('button', 'itm');
            b.dataset.item = id;
            b.title = `${ITEM[id].name}: ${ITEM[id].desc}`;
            b.setAttribute('aria-label', ITEM[id].name);
            b.append(iconEl(ITEM[id].icon, 'lg'), h('span', 'key', String(i + 4)), h('span', 'n', String(G.bag[id])));
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onItem(id); });
            b.addEventListener('click', (e) => { if (!e.detail) onItem(id); });
            it.append(b);
        });
        this.hudItems = [...it.querySelectorAll('.itm')].map((b) => b.dataset.item);
    }

    placeHud(layout) {
        const bar = $('bhud-bar');
        Object.assign(bar.style, { left: layout.bar.x + 'px', top: layout.bar.y + 'px', width: layout.bar.w + 'px', height: layout.bar.h + 'px' });
    }

    hud(G) {
        const Bt = G.battle;
        if (!Bt) return;
        for (const b of document.querySelectorAll('#skills .skill')) {
            const n = NODE[b.dataset.skill];
            let frac = 1;
            for (const [p, c] of Object.entries(n.cost)) frac = Math.min(frac, Bt.hero.mana[p] / c);
            b.querySelector('.fill').style.height = `${Math.round((1 - Math.min(1, frac)) * 100)}%`;
            const ready = canSkill(G, b.dataset.skill);
            b.classList.toggle('ready', ready);
            // a match fed mana this skill needs: it bounces (once per animation, so a cascade doesn't stutter it)
            const prev = this.prevMana;
            if (prev && !ready && !b.classList.contains('feed') && Object.keys(n.cost).some((p) => Bt.hero.mana[p] > prev[p] + 0.01)) {
                b.classList.add('feed');
            }
        }
        this.prevMana = { ...Bt.hero.mana };
        for (const b of document.querySelectorAll('#items .itm')) {
            b.disabled = !canItem(G, b.dataset.item);
            b.querySelector('.n').textContent = G.bag[b.dataset.item] || 0;
        }
    }

    // ------------------------------------------------------------------ results
    showResult(G) {
        const Bt = G.battle;
        const won = Bt.phase === 'won';
        $('result-title').textContent = won ? 'Victory!' : 'Defeated';
        const body = $('result-body');
        body.innerHTML = '';
        if (won) {
            const r = Bt.rewards;
            body.append(h('p', '', `${esc(Bt.foe.name)} is beaten.`));
            const list = h('div', 'reward-list');
            const add = (icon, text) => { const s = h('span'); s.append(iconEl(icon)); s.append(document.createTextNode(text)); list.append(s); };
            add(ICON.gold, `+${r.gold}`);
            add(ICON.xp, `+${r.xp} xp`);
            for (const [k, v] of Object.entries(r.res)) if (v) add(ICON[k], `+${v}`);
            for (const id of r.items) add(ITEM[id].icon, ITEM[id].name);
            body.append(list);
            const q = G.quest;
            if (q && q.i < q.fights.length - 1) body.append(h('p', 'dim', `Next: ${esc(FOE[q.fights[q.i + 1]].name)}. You catch your breath (+${Math.round(QUEST_REST * 100)}% health); the rest carries over.`));
        } else body.append(h('p', '', 'You fall back to Briarwick to recover. The village keeps everything you earned.'));
        this.openScreen('result');
    }

    showEnding(G, credits) {
        $('ending-text').textContent = `${HERO[G.hero.id].name}'s tale, “${HERO[G.hero.id].tale}”, is told. ${credits}`;
        this.openScreen('ending');
    }
}

/** Show a green badge on a button (text), or hide it (''). */
function badge(id, text) {
    const b = $(id);
    b.hidden = text === '' || text === 0 || text == null;
    b.textContent = b.hidden ? '' : String(text);
}

/** An unworn piece in the bag that beats what is worn in its slot. */
export function betterGear(G) {
    return G.inv.some((inv) => {
        const slot = ITEM[inv.id].slot;
        if (Object.values(G.hero.eq).includes(inv.uid)) return false;
        const worn = St.equipped(G, slot);
        return V.gearScore(inv) > (worn ? V.gearScore(worn) : 0);
    });
}

function poolCol(p) { return { r: '#ff7a7a', s: '#7ab8ff', e: '#6ff0a0', a: '#c9a2ff' }[p]; }

function dailyStreakNext(G, day) {
    const D = G.village.daily;
    return D.day && V.dayNumber(day) - V.dayNumber(D.day) === 1 ? Math.min(7, D.streak + 1) : 1;
}

/** Who is speaking a line: name and picture. */
export function speaker(G, sp) {
    if (sp === 'narrator') return { name: '', img: null };
    if (HERO[sp]) return { name: HERO[sp].name, img: ART.por(sp) };
    if (NPC[sp]) return { name: NPC[sp].name, img: ART.por(sp) };
    if (FOE[sp]) return { name: FOE[sp].name, img: ART.mon(sp), mon: true };
    return { name: sp, img: null };
}

function itemLine(G, inv) {
    const it = ITEM[inv.id];
    if (!it.slot) return it.desc;
    const s = St.itemStats(inv);
    const parts = [];
    if (s.atk) parts.push(`+${s.atk} attack`);
    if (s.def) parts.push(`+${s.def} defence`);
    if (s.hp) parts.push(`+${s.hp} health`);
    const MODN = { crit: 'critical', skill: 'skill power', sword: 'sword gems', heart: 'heart gems', gain: 'mana gain', gain_r: 'ruby mana', gain_s: 'sapphire mana', gain_e: 'emerald mana', gain_a: 'amethyst mana', slow: 'slower foes', loot: 'loot' };
    for (const [k, v] of Object.entries(s.mods)) parts.push(`+${Math.round(v * 100)}% ${MODN[k] || k}`);
    return `Tier ${it.tier} ${it.slot} · ${parts.join(', ')}`;
}

function effectText(G, id, lv) {
    if (lv <= 0) return '';
    if (lv > 5) return '';
    if (PRODUCE[id]) return Object.entries(PRODUCE[id]).map(([r, arr]) => `${arr[lv]} ${r} per hour`).join(', ') + (id === 'inn' ? `, +${5 * lv}% experience` : id === 'farm' ? `, +${5 * lv}% health` : id === 'tower' ? `, +${6 * lv}% skill damage` : '');
    if (id === 'hall') return `Buildings up to level ${lv}; stores hold ${4 + 2 * lv} hours; daily gift ×${lv}.`;
    if (id === 'market') return `Gear up to tier ${lv}; prices -${4 * lv}%.`;
    if (id === 'temple') return `Heart gems +${10 * lv}%${lv >= 3 ? '; +5 starting mana' : ''}${lv >= 5 ? '; rise again once a quest' : ''}.`;
    if (id === 'armory') return `Upgrades up to +${2 * lv}; +${2 * lv} attack.`;
    return '';
}
export { POOL_NAME, ABILITIES, GEM, BATTLE, MANA, HOUR, img };
