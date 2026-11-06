// The DOM layer: screens, the HUD and dock, the venue buttons placed over the 3D view, panels, dialogue,
// road encounters and the ending. Reads the sim; it changes it only through the act() it is given.

import { h, $, fmt, clear } from './dom.js';
import { VERSION, WAGONS, REGION_LEVEL, ECLIPSE_DAY, MAX_LEVEL } from './config.js';
import { TOWN, TOWNS, REGIONS, NEIGHBORS, MERCHANT_TITLES } from './sim/data/towns.js';
import { MATS, FAMS, SLOT_ORDER, itemName, keyOf } from './sim/data/items.js';
import { EPILOGUE, HERO } from './sim/data/story.js';
import { burden, canTravel } from './sim/game.js';
import { levelProgress } from './sim/core.js';
import { SEASONS } from './sim/market.js';
import { heroTownFor, questsAt, questReady, questDef } from './sim/quest.js';
import { usedCells } from './sim/inv.js';
import { PANELS, bestKnown } from './panels.js';
import { GLYPH, iconUrl } from './view/icons.js';
import { chibi, npcLook, KAELEN, MERCHANT } from './view/chars.js';
import { canvas, ctx2, cached } from './view/paint.js';

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, getG, act }) {
        this.audio = audio; this.settings = settings; this.getG = getG; this.doAct = act;
        this.stack = [];                   // open screens, top last
        this.panelId = null; this.ps = {}; // panel state survives re-renders
        this.dlgQueue = []; this.dlgCur = null; this.dlgDone = null;
        this.sig = {}; this.placeEls = new Map(); this.placeSig = '';
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen, .layer'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen, .layer')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el && el.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        const sfx = $('set-sfx'), music = $('set-music'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; calm.checked = !!settings.calm;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, calm: calm.checked }); onSettings(settings); };
        for (const el of [sfx, music, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
        $('dialog').addEventListener('click', () => this.advanceDialog());
        this.ctx = {
            ps: this.ps,
            act: (cmd, o) => this.doAct(cmd, o),
            rerender: (o) => this.renderPanel(o),
            toast: (t, k) => this.toast(t, k),
            confirm: (t, b, fn) => this.confirm(t, b, fn),
            panelWidth: () => $('panel').clientWidth || window.innerWidth,
        };
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) { if (this.top() === id) return; $(id).hidden = false; this.stack = this.stack.filter((s) => s !== id).concat(id); $(id).style.zIndex = 60 + this.stack.length; this.focusFirst($(id)); }
    closeScreen(id) { $(id).hidden = true; this.stack = this.stack.filter((s) => s !== id); if (this.top()) this.focusFirst($(this.top())); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    /** The topmost thing that wants the keyboard: modal, screen, dialogue, panel. */
    overlay() {
        if (!$('modal-layer').hidden) return 'modal';
        if (this.stack.length) return 'screen';
        if (this.dlgCur) return 'dialog';
        if (!$('panel-layer').hidden) return 'panel';
        return null;
    }
    root() { const o = this.overlay(); return o === 'modal' ? $('modal-layer') : o === 'screen' ? $(this.top()) : o === 'panel' ? $('panel-layer') : null; }
    focusables(root) { return [...root.querySelectorAll('button, select, input, [tabindex="0"]')].filter((b) => !b.disabled && !b.hidden && b.getClientRects().length && !b.closest('[hidden]') && !b.classList.contains('invitem-x')); }
    focusFirst(root) { this.focusables(root)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const r = this.root() || document.body;
        const list = this.focusables(r);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ panels
    openPanel(id) {
        if (!PANELS[id]) return;
        if (this.panelId !== id) { this.audio.ui('open'); }
        this.panelId = id;
        if (id !== 'market' && id !== 'wagon' && id !== 'workshop') this.ps.sel = 0;
        $('panel-layer').hidden = false;
        document.body.classList.add('panel-open');
        this.renderPanel({ first: true });
    }
    closePanel() { if (this.panelId) { this.audio.ui('close'); } this.panelId = null; $('panel-layer').hidden = true; document.body.classList.remove('panel-open'); this.dock(true); }
    renderPanel(o = {}) {
        if (!this.panelId) return;
        const G = this.getG();
        const body0 = $('panel').querySelector('.panel-body');
        const scroll = body0 ? body0.scrollTop : 0;
        const focusF = o.keepFocus;
        const { title, body, foot } = PANELS[this.panelId](G, this.ctx);
        const panel = clear($('panel'));
        panel.appendChild(h('div.panel-head', [h('h2', { id: 'panel-title' }, title), h('button.btn.small', { type: 'button', onclick: () => this.closePanel(), 'aria-label': 'Close' }, [h('span', { html: GLYPH.close }), 'Close'])]));
        const b = h('div.panel-body', body);
        panel.appendChild(b);
        panel.setAttribute('aria-labelledby', 'panel-title');
        b.scrollTop = scroll;
        if (focusF) { const el = panel.querySelector(`[data-f="${focusF}"]`); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* not a text box */ } } }
        else if (o.first) this.focusFirst(panel);
        this.hud(G, true);
    }

    // ------------------------------------------------------------------ modal / confirm
    modal(title, bodyNodes, buttons) {
        const m = clear($('modal'));
        m.appendChild(h('h2', title));
        m.appendChild(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, bodyNodes));
        m.appendChild(h('div.sheet-foot', { style: { flexWrap: 'wrap' } }, buttons.map((b) => h('button.btn' + (b.cls ? '.' + b.cls : ''), { type: 'button', disabled: !!b.disabled, onclick: () => { b.fn?.(); } }, b.label))));
        $('modal-layer').hidden = false;
        this.focusFirst($('modal-layer'));
    }
    closeModal() { $('modal-layer').hidden = true; this.encounterOpen = false; }
    confirm(title, text, fn) {
        this.modal(title, [h('p', text)], [{ label: 'Cancel', fn: () => this.closeModal() }, { label: 'Yes', cls: 'primary', fn: () => { this.closeModal(); fn(); } }]);
    }

    // ------------------------------------------------------------------ HUD, dock
    hud(G, force) {
        const b = burden(G);
        const sig = [G.gold, G.lv, G.xp, G.day, Math.round(b.w), usedCells(G), G.loc, !!G.travel, G.heroCall, this.panelId].join('|');
        if (sig === this.sig.hud && !force) return;
        this.sig.hud = sig;
        const cells = G.inv.w * G.inv.h;
        const season = SEASONS[Math.floor(((G.day - 1) % 120) / 30)];
        const wClass = b.r > 1.3 ? '.bad' : b.r > 1 ? '.warn' : '';
        const chips = [
            h('div.chip', { title: 'Gold' }, [h('span', { html: GLYPH.coin }), fmt(G.gold)]),
            h('div.chip', { title: `Merchant level ${G.lv}` }, [h('span', { html: GLYPH.star }), `Lv ${G.lv} ${MERCHANT_TITLES[G.lv]}`, G.lv < MAX_LEVEL && h('span.bar', h('i', { style: { width: Math.round(levelProgress(G) * 100) + '%' } }))]),
            h('div.chip', { title: 'Day and season' }, [h('span', { html: GLYPH.sun }), `Day ${G.day}, ${season}`, G.heroCall && !G.ending ? ` (Eclipse in ${Math.max(0, ECLIPSE_DAY - G.day)})` : '']),
            h('div.chip' + wClass, { title: 'Wagon load' }, [h('span', { html: GLYPH.weight }), `${Math.round(b.w)}/${b.cap}`]),
            h('div.chip', { title: 'Cargo cells' }, [h('span', { html: GLYPH.bag }), `${usedCells(G)}/${cells}`]),
        ];
        clear($('hud-stats')).append(...chips);
        const place = $('hud-place');
        if (G.travel) place.innerHTML = `On the road to ${TOWN[G.travel.to].name}<small>${Math.min(G.travel.total, G.travel.ticks + 1)} of ${G.travel.total} days</small>`;
        else place.innerHTML = `${TOWN[G.loc].name}<small>${REGIONS[TOWN[G.loc].region].name}</small>`;
    }
    dock(force, mode = this.mode) {
        const G = this.getG();
        const ready = Object.keys(G.q.active).filter((id) => { const q = questDef(G, id); return q && questReady(G, q); }).length;
        const sig = [mode, ready, Object.keys(G.q.active).length, !!G.travel].join('|');
        if (sig === this.sig.dock && !force) return;
        this.sig.dock = sig;
        const d = clear($('dock'));
        const b = (icon, label, fn, key, badge) => h('button.btn', { type: 'button', onclick: fn, title: `${label} (${key})`, 'aria-label': label }, [h('span', { html: GLYPH[icon] }), label, badge ? h('span.badge', badge) : null]);
        if (G.travel) { d.append(h('button.btn', { type: 'button', onclick: () => this.onHurry?.(), title: 'Speed up the journey (Space)' }, 'Hurry')); return; }
        d.append(
            b('bag', 'Wagon', () => this.openPanel('wagon'), 'I'),
            b('scroll', 'Quests', () => this.openPanel('quests'), 'Q', ready || null),
            b('book', 'Ledger', () => this.openPanel('ledger'), 'L'),
            b('map', mode === 'map' ? 'Town' : 'Map', () => this.onMapToggle?.(), 'M'),
            b('menu', 'Menu', () => this.onMenu?.(), 'Esc'),
        );
        d.hidden = !!G.travel && false;
    }
    showHud(on) { $('hud').hidden = !on; $('dock').hidden = !on; if (on) { this.sig = {}; } }

    // ------------------------------------------------------------------ the buttons over the 3D view
    /** mode: 'map' | 'town'. points: [{id, label, x, y, ...}] screen positions from the view. */
    places(G, mode, points, handlers) {
        this.mode = mode;
        const sig = mode + '|' + G.loc + '|' + G.lv + '|' + G.heroCall + '|' + G.towns[G.loc].heroes.length + '|' + Object.keys(G.q.active).length + '|' + (G.travel ? 1 : 0) + '|' + G.day;
        const layer = $('places');
        if (sig !== this.placeSig) {
            this.placeSig = sig;
            clear(layer); this.placeEls.clear();
            if (!G.travel) for (const p of points) {
                let el;
                if (mode === 'map') {
                    const T = TOWN[p.id], here = p.id === G.loc, need = REGION_LEVEL[T.region], locked = G.lv < need;
                    const road = NEIGHBORS[G.loc].find((n) => n.to === p.id);
                    const sub = here ? 'You are here' : locked ? `Level ${need}` : road ? `${road.days} day${road.days > 1 ? 's' : ''}` : '';
                    el = h('button.place' + (here ? '.here' : '') + (locked ? '.locked' : ''), { type: 'button', dataset: { id: p.id }, onclick: () => handlers.town(p.id), 'aria-label': `${T.name}. ${sub}` }, [locked ? h('span', { html: GLYPH.lock, style: { width: '18px', display: 'inline-block' } }) : null, T.name, sub ? h('small', sub) : null]);
                } else {
                    const info = this.venueInfo(G, p.id);
                    el = h('button.place' + (info.bang ? '.bang' : ''), { type: 'button', dataset: { id: p.id }, onclick: () => handlers.venue(p.id), onpointerenter: () => handlers.hover?.(p.id), onpointerleave: () => handlers.hover?.(null), 'aria-label': p.label }, [p.label, info.sub ? h('small', info.sub) : null, info.pin ? h('span.pin', info.pin) : null]);
                }
                layer.appendChild(el);
                this.placeEls.set(p.id, el);
            }
        }
        if (G.travel) return;
        for (const p of points) {
            const el = this.placeEls.get(p.id);
            if (!el) continue;
            const off = p.behind || p.x < -40 || p.y < -40 || p.x > window.innerWidth + 40 || p.y > window.innerHeight + 40;
            el.style.display = off ? 'none' : '';
            el.style.left = Math.round(p.x) + 'px'; el.style.top = Math.round(p.y) + 'px';
        }
    }
    venueInfo(G, id) {
        const T = TOWN[G.loc];
        const q = questsAt(G, G.loc);
        if (id === 'board') { const n = q.filter((x) => !x.q.story && x.state === 'available').length, r = q.filter((x) => (x.state === 'ready')).length; return { pin: r || n || null, bang: r > 0, sub: r ? `${r} ready` : n ? `${n} open` : '' }; }
        if (id === 'inn') { const n = G.towns[G.loc].heroes.filter((x) => x.wants.some((w) => !w.done)).length; return { pin: n || null, sub: n ? `${n} hero${n > 1 ? 'es' : ''}` : 'Rest' }; }
        if (id === 'hero') { const s = q.some((x) => x.q.story && (x.state === 'available' || x.state === 'ready')); return { bang: s, sub: s ? 'Kaelen waits' : '' }; }
        if (id === 'market') return { sub: `${T.shops.length} shop${T.shops.length > 1 ? 's' : ''}` };
        if (id === 'workshop') return { sub: `${Object.keys(T.stations).length} workshops` };
        if (id === 'guild') return { sub: 'Vault & wagons' };
        return {};
    }

    // ------------------------------------------------------------------ toasts
    toast(text, kind = '') {
        const el = h('div.toast' + (kind ? '.' + kind : ''), text);
        const box = $('toasts');
        box.appendChild(el);
        while (box.children.length > 3) box.firstChild.remove();
        setTimeout(() => el.remove(), 3300);
    }
    float(text, x, y) {
        const el = h('div.float', { style: { left: x + 'px', top: y + 'px' } }, text);
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    // ------------------------------------------------------------------ dialogue
    dialog(lines, done) {
        this.dlgQueue.push({ lines: [...lines], done });
        if (!this.dlgCur) this.nextDialog();
    }
    nextDialog() {
        const cur = this.dlgQueue[0];
        if (!cur) { this.dlgCur = null; $('dialog').hidden = true; this.dock(true); return; }
        const line = cur.lines.shift();
        if (!line) { this.dlgQueue.shift(); cur.done?.(); return this.nextDialog(); }
        this.dlgCur = line;
        const d = clear($('dialog'));
        d.hidden = false;
        d.appendChild(h('div.dlg-face', this.portrait(line.who)));
        d.appendChild(h('div.dlg-box', [h('div.dlg-name', line.who === 'narrator' ? 'Narrator' : line.who), h('div.dlg-text', line.text), h('div.dlg-next', 'Tap or press Enter to continue')]));
        d.setAttribute('aria-label', `${line.who}: ${line.text}`);
        this.audio.ui('click');
    }
    advanceDialog() { if (this.dlgCur) this.nextDialog(); }
    portrait(who) {
        return cached('portrait:' + who, () => {
            let look = null;
            if (/Kaelen/.test(who)) look = KAELEN;
            else if (/Gran Mirabel/.test(who)) look = { hair: '#e6e2da', hairStyle: 'bun', top: '#8a5a8a', glasses: true, skin: '#f6cba2', eye: '#6a4a2a', seed: 5, prop: 'ledger' };
            else if (who === 'narrator') look = MERCHANT;
            else {
                for (const T of TOWNS) for (const [name, role] of T.npcs) if (who.startsWith(name) || name.startsWith(who.split(' ')[0])) look = look || npcLook(role, name);
            }
            look ||= npcLook('villager', who);
            const src = chibi(look);
            const cv = canvas(160, 160), c = ctx2(cv);
            c.drawImage(src, 30, 0, 260, 290, 0, 4, 160, 160 * 290 / 260 > 160 ? 160 : 160);
            return cv;
        });
    }

    // ------------------------------------------------------------------ road encounters
    encounter(G) {
        const p = G.pending;
        if (!p) { if (this.encounterOpen) this.closeModal(); return; }
        if (this.encounterOpen) return;
        this.encounterOpen = true;
        const res = (choice) => { this.closeModal(); this.doAct({ t: 'resolve', choice }, { quiet: true }); };
        if (p.kind === 'bandits') {
            this.modal('Bandits on the road!', [h('p', 'Rough-looking men step out of the bracken and block the way. "Nice wagon," says the biggest. "Be a shame if something happened to it."'), h('p.muted', `They want ${fmt(p.demand)} gold. You think you could take them with a ${Math.round(p.chance * 100)}% chance, and your best gear in the wagon counts.`)], [
                { label: `Pay ${fmt(Math.min(G.gold, p.demand))}g`, fn: () => res('pay') },
                { label: 'Run for it (55%)', fn: () => res('flee') },
                { label: `Fight (${Math.round(p.chance * 100)}%)`, cls: 'primary', fn: () => res('fight') },
            ]);
        } else {
            const unit = p.unit, n = p.n, base = MATS[p.t].price;
            const afford = Math.min(n, Math.floor(G.gold / unit));
            this.modal('A peddler on the road', [h('div.item-row', [h('span.ico', h('img', { src: iconUrl(p.t, 0), alt: '' })), h('div', [h('div.nm', `${n} ${MATS[p.t].name}`), h('div.sub', `${fmt(unit)}g each; worth about ${fmt(base)}g in a market.`)]), h('b', `${fmt(unit * n)}g`)]), h('p.muted', 'A passing peddler is in a hurry to sell, and cheap.')], [
                { label: 'No thanks', fn: () => res('decline') },
                { label: afford ? `Buy ${afford}` : 'Cannot afford', cls: 'primary', disabled: !afford, fn: () => res('accept') },
            ]);
        }
    }

    // ------------------------------------------------------------------ travel details
    travelModal(G, to, go) {
        const T = TOWN[to];
        const info = canTravel(G, to);
        const nodes = [h('p', T.blurb), h('div.muted', `${REGIONS[T.region].name}, ${MATS ? '' : ''}${T.shops.length} shops. ${T.guild ? 'Guild House.' : ''}`)];
        const buttons = [{ label: 'Stay', fn: () => this.closeModal() }];
        if (to === G.loc) { buttons.push({ label: 'Enter town', cls: 'primary', fn: () => { this.closeModal(); go(null); } }); }
        else if (info.ok) {
            const k = G.known[to];
            const carried = [];
            if (k) for (const it of G.inv.items) { const p = k.p[keyOf(it.t, it.lv)]; if (p && p[1] && it.t !== 'parcel') carried.push({ it, p: p[1] }); }
            carried.sort((a, b) => b.p * b.it.n - a.p * a.it.n);
            nodes.push(h('div', [`${info.days} day${info.days > 1 ? 's' : ''} by road`, info.days > info.base ? h('span.bad', ' (slowed by your load)') : '', '.']));
            if (carried.length) nodes.push(h('div.card', [h('b', 'Prices you last saw there'), ...carried.slice(0, 4).map((c) => h('div.sub', `${itemName(c.it.t, c.it.lv)}: ${fmt(c.p)}g each (you carry ${c.it.n})`))]));
            else nodes.push(h('div.muted', k ? 'You have nothing in the wagon they paid well for last time.' : 'You have never been there: prices are a mystery.'));
            buttons.push({ label: `Travel (${info.days}d)`, cls: 'primary', fn: () => { this.closeModal(); go(to); } });
        } else {
            nodes.push(h('p.bad', info.reason));
            const path = this.pathTo(G, to);
            if (path && info.reason.startsWith('No road')) { nodes.push(h('div', `Route: ${path.map((p) => TOWN[p].name).join(' → ')}`)); buttons.push({ label: `Head to ${TOWN[path[1]].name}`, cls: 'primary', fn: () => { this.closeModal(); go(path[1]); } }); }
        }
        this.modal(T.name, nodes, buttons);
    }
    pathTo(G, to) {
        const prev = { [G.loc]: null }, q = [G.loc];
        while (q.length) { const c = q.shift(); if (c === to) break; for (const n of NEIGHBORS[c]) if (!(n.to in prev) && G.lv >= REGION_LEVEL[TOWN[n.to].region]) { prev[n.to] = c; q.push(n.to); } }
        if (!(to in prev)) return null;
        const path = []; for (let c = to; c; c = prev[c]) path.unshift(c);
        return path;
    }

    // ------------------------------------------------------------------ the ending
    ending(G, { again, keep }) {
        const e = G.ending;
        const sheet = clear($('over-sheet'));
        const slots = SLOT_ORDER.map((s) => h('div.kit-slot', [h('img', { src: iconUrl(s, e.slots[s] || 1), alt: '', style: { opacity: e.slots[s] ? 1 : 0.3 } }), h('b', FAMS[s].slot), h('div.sub', e.slots[s] ? `${itemName(s, e.slots[s])} (Lv ${e.slots[s]})` : 'Nothing')]));
        sheet.append(
            h('h2', e.missed ? 'The Eclipse' : 'The Offer'),
            e.missed ? null : h('div.rank', e.rank),
            h('h3', { style: { textAlign: 'center' } }, e.title),
            h('p', e.text),
            e.missed ? null : h('div.kit-grid', slots),
            h('p', { style: { fontStyle: 'italic' } }, e.missed ? '' : EPILOGUE[e.rank]),
            h('div.row', [h('span', `Score ${e.score}/100`), h('span.muted', `Day ${e.day}, level ${G.lv}, ${fmt(G.gold)} gold, ${G.stats.quests} quests`)]),
            h('div.sheet-foot', [h('button.btn', { type: 'button', onclick: keep }, 'Keep trading'), h('button.btn.primary', { id: 'over-again', type: 'button', onclick: again }, 'New Game')]),
        );
        this.openScreen('over');
    }
}
