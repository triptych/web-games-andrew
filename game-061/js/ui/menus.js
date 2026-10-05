// Every full-screen panel: title, new voyage, station, Hearth, journal, settings, pause, help,
// death and ending. Panels re-render from game state after every action.

import { $, h, fmt, fmtDist, itemName, swatch, costList, pips } from './dom.js';
import { ITEMS, RAW, REFINED, GOODS, COMPONENTS, COMP_ORDER, HULLS, MODULES, MODULE_ORDER, RECIPES, FAB, TECHS, PAINTS, moduleCost, moduleCap, moduleSlots, standingBand, ECONOMIES } from '../config.js';
import * as base from '../sim/base.js';
import { questTypeName, questNav } from '../sim/quests.js';
import { STAGES } from '../sim/story.js';
import { TEMPERAMENTS } from '../sim/species.js';
import { lyDist, generateGalaxy, normSeed } from '../sim/galaxy.js';
import { dataPrice } from '../sim/economy.js';
import { portrait } from '../view/portrait.js';
import { randomSeedText } from '../rng.js';

const KIND_NAME = { hub: 'Trade Hub', outpost: 'Outpost', shipyard: 'Shipyard', refinery: 'Refinery', embassy: 'Embassy', hearth: 'Your base' };

export class Menus {
    constructor(app) {
        this.app = app;
        this.panel = $('panel');
        this.kind = null;
        this.tab = null;
        this.mkFilter = 'all';
    }
    get G() { return this.app.game; }
    get audio() { return this.app.audio; }

    // ---------------------------------------------------------------- framework
    open(kind, opts = {}) {
        this.kind = kind;
        this.opts = opts;
        this.tab = opts.tab || this.defaultTab(kind);
        this.panel.classList.remove('hidden');
        this.panel.classList.toggle('docked', kind === 'station' || kind === 'hearth');
        this.render(true);
    }
    close() { this.kind = null; this.panel.classList.add('hidden'); this.panel.replaceChildren(); }
    isOpen() { return !!this.kind; }
    defaultTab(kind) { return { station: 'market', hearth: 'overview', journal: 'story' }[kind] || null; }
    refresh() { if (this.kind) this.render(false); }
    act(fn) {
        return (e) => {
            e?.stopPropagation?.();
            const r = fn();
            if (r && r.ok === false) { this.audio.error(); if (r.why) this.app.toast(r.why, 'warn'); }
            else if (r !== undefined) this.audio.click();
            this.refresh();
            this.app.onMenuAction?.();
        };
    }

    render(fresh) {
        const scroll = fresh ? 0 : this.panel.querySelector('.win-body')?.scrollTop || 0;
        const fn = this[`render_${this.kind}`];
        if (!fn) return;
        const win = fn.call(this);
        this.panel.replaceChildren(win);
        const body = this.panel.querySelector('.win-body');
        if (body) body.scrollTop = scroll;
        if (fresh) { const f = win.querySelector('[data-focus]') || win.querySelector('button.btn, .tbtn'); f?.focus?.({ preventScroll: true }); }
    }

    win({ head, tabs, body, foot, narrow }) {
        return h(`div.win${narrow ? '.narrow' : ''}`, { role: 'dialog' },
            head,
            tabs ? h('div.tabs', tabs.map(([id, label, dot]) => h(`button${this.tab === id ? '.on' : ''}`, { onclick: () => { this.tab = id; this.audio.click(); this.render(true); } }, label, dot ? h('span.dot') : null))) : null,
            h('div.win-body', body),
            foot ? h('div.win-foot', foot) : null);
    }
    head(title, sub, opts = {}) {
        return h('div.win-head',
            opts.portrait ? h('img.portrait', { src: opts.portrait, alt: '' }) : null,
            h('div.grow', h('h2', title), sub ? h('div.sub', sub) : null, opts.greet ? h('div.greet', `“${opts.greet}”`) : null),
            opts.close !== false ? h('button.x', { 'aria-label': 'Close', onclick: () => { this.audio.click(); opts.onClose ? opts.onClose() : this.app.closeMenu(); } }, '✕') : null);
    }
    walletFoot(extra = []) {
        const G = this.G, st = G.stats();
        return [h('div.row', { style: { marginRight: 'auto' } },
            h('span', h('b', { style: { color: 'var(--amber)' } }, `◆ ${fmt(G.s.credits)}`), ' credits'),
            h('span.muted', ` · Hold ${G.cargoUsed()}/${st.cargo} · Data ${fmt(G.s.data)} · Fuel ${G.s.ship.fuel}/${st.fuelMax}`)), ...extra];
    }

    // ---------------------------------------------------------------- title
    showTitle(hasSave) {
        const menu = $('title-menu');
        const btn = (label, sub, fn, focus) => h('button.tbtn', { onclick: () => { this.audio.click(); fn(); }, onmouseenter: () => this.audio.hover(), 'data-focus': focus ? '' : null }, label, sub ? h('small', sub) : null);
        menu.replaceChildren(...[
            hasSave ? btn('CONTINUE', `Seed ${hasSave.seed} · ${Math.round(hasSave.time / 60)} min played`, () => this.app.continueGame(), true) : null,
            btn('NEW VOYAGE', 'Choose a seed, grow a galaxy', () => this.open('newgame'), !hasSave),
            btn('HOW TO PLAY', null, () => this.open('help')),
            btn('SETTINGS', null, () => this.open('settings')),
        ].filter(Boolean));
        $('title').classList.remove('hidden');
        setTimeout(() => menu.querySelector('[data-focus]')?.focus?.({ preventScroll: true }), 50);
    }
    hideTitle() { $('title').classList.add('hidden'); }

    render_newgame() {
        const st = this.opts;
        st.seed ??= randomSeedText();
        st.name ??= 'Wren';
        const preview = h('div.preview-sp');
        const info = h('p.note');
        const update = () => {
            const g = generateGalaxy(st.seed);
            const H = g.systems[g.home];
            info.textContent = `Home: ${H.name} · ${g.systems.length} stars · ${g.species.length} species · ${g.systems.filter((s) => s.pirate).length} Reaver havens`;
            preview.replaceChildren(...g.species.map((sp) => h('img', { src: portrait(sp, 108), title: `${sp.gov}${sp.hostile ? ' (hostile)' : ''}`, alt: sp.name })));
            this.app.previewSeed?.(st.seed);
        };
        let tmr = 0;
        const input = h('input', { type: 'text', value: st.seed, maxlength: 32, 'aria-label': 'Seed', spellcheck: 'false', autocomplete: 'off',
            oninput: (e) => { st.seed = e.target.value.toUpperCase(); clearTimeout(tmr); tmr = setTimeout(update, 350); },
            onkeydown: (e) => { if (e.key === 'Enter') start(); e.stopPropagation(); } });
        const nameIn = h('input', { type: 'text', value: st.name, maxlength: 16, 'aria-label': 'Ship name', spellcheck: 'false', autocomplete: 'off', oninput: (e) => { st.name = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') start(); e.stopPropagation(); } });
        const start = () => { this.audio.click(); this.app.newGame(normSeed(st.seed), (st.name || 'Wren').trim().slice(0, 16) || 'Wren'); };
        setTimeout(update, 0);
        return this.win({
            narrow: true,
            head: this.head('NEW VOYAGE', 'The seed decides everything: stars, species, ships, quests.', { onClose: () => { this.close(); this.app.toTitle(); } }),
            body: [
                h('h3.sec', 'Universe seed'),
                h('div.seedrow', input, h('button.btn.cyan', { 'aria-label': 'Random seed', onclick: () => { st.seed = randomSeedText(); input.value = st.seed; this.audio.click(); update(); } }, '⚄ RANDOM')),
                info,
                h('h3.sec', 'Species in this universe'),
                preview,
                h('h3.sec', 'Your ship'),
                nameIn,
                h('p.note', { style: { marginTop: '8px' } }, 'Share a seed with a friend and you will fly the same galaxy. Your save keeps what you change in it.'),
            ],
            foot: [h('button.btn.big', { onclick: start, 'data-focus': '' }, 'LAUNCH')],
        });
    }

    render_help() {
        const k = (key, txt) => [h('kbd', key), h('span', txt)];
        return this.win({
            head: this.head('HOW TO PLAY', 'Mine. Trade. Build. Wander.', { onClose: () => (this.app.mode === 'title' ? (this.close(), this.app.toTitle()) : this.app.closeMenu()) }),
            body: [
                h('h3.sec', 'The loop'),
                h('p.lead', 'Mine asteroids and scan planets, bring ore home to Hearth, and build modules: a Refinery turns ore into plate and wafers, the Shipyard turns those into ship upgrades, and the Research Lab turns survey data into new technology. Sell goods at alien stations, take missions, and earn the warp drive that takes you to other stars. Something at the galactic core is calling.'),
                h('h3.sec', 'Flight (keyboard + mouse)'),
                h('div.controls-list',
                    k('Mouse', 'the ship steers toward the cursor (switch off in Settings)'), k('W / S', 'throttle up / down · X full stop · wheel sets throttle'), k('A D ← →', 'turn · ↑ ↓ pitch'),
                    k('Shift', 'boost'), k('Space / L-click', 'fire weapons'), k('Q / R-click', 'mining beam: aim at a rock and hold'), k('E', 'interact: dock, scan, salvage (hold)'),
                    k('T', 'cycle targets'), k('C', 'cruise: fast travel to the target (autopilot)'), k('G', 'galaxy map: warp'), k('Tab', 'system map'), k('J', 'journal'), k('Esc', 'pause'), k('M', 'mute')),
                h('h3.sec', 'Touch'),
                h('p.note', 'Drag anywhere on the left half to steer. The rail on the right sets throttle. FIRE and MINE are held; ACT docks, scans and salvages (hold it for scans); CRUISE fast-travels to the target; TGT cycles targets. Tap markers on the system map to target them.'),
                h('h3.sec', 'Gamepad'),
                h('p.note', 'Left stick steers, right stick or bumpers throttle, RT fire, LT mine, B boost, A interact, X cruise, Y target, Start pause, Back galaxy map.'),
                h('h3.sec', 'Tips'),
                h('p.note', 'Lasers can only cut rock up to their Mk. Overheating locks the beam, so let it cool. Cruise is blocked near stations and hostiles. Prices drop when you flood a market; spread your sales. Hearth keeps refining while you travel. If you are destroyed you lose your hold, never your upgrades.'),
            ],
        });
    }

    // ---------------------------------------------------------------- station
    render_station() {
        const G = this.G;
        const st = G.dockedStation();
        const sp = G.galaxy.species[st.species];
        const band = standingBand(G.standing(sp.id));
        const board = G.board();
        const tabs = [['market', 'MARKET'], ['missions', `MISSIONS (${board.length})`, G.s.quests.some((q) => G.canTurnIn(q))], ['services', 'SERVICES'], ['cargo', 'CARGO']];
        if (st.kind === 'shipyard') tabs.splice(3, 0, ['yard', 'SHIPYARD']);
        const greet = this.opts.greet || (this.opts.greet = sp.greet[Math.floor(Math.random() * sp.greet.length)]);
        const body = this[`station_${this.tab}`]?.(st, sp) || [];
        return this.win({
            head: this.head(st.name, h('span', `${KIND_NAME[st.kind]} · ${sp.gov} · `, h('span', { style: { color: band.color } }, `${band.name} ${Math.round(G.standing(sp.id))}`), ` · ${ECONOMIES[st.economy]?.name || ''} economy`), { portrait: portrait(sp, 128), greet, close: false }),
            tabs, body,
            foot: this.walletFoot([h('button.btn.cyan.big', { onclick: () => this.app.undock(), 'data-focus': '' }, 'UNDOCK')]),
        });
    }

    station_market(st, sp) {
        const G = this.G;
        const rows = [];
        const seg = h('div.seg', [['all', 'ALL'], ['hold', 'IN HOLD'], ['crave', 'IN DEMAND'], ['sale', 'FOR SALE']].map(([id, l]) => h(`button${this.mkFilter === id ? '.on' : ''}`, { onclick: () => { this.mkFilter = id; this.refresh(); } }, l)));
        const cats = [['RAW RESOURCES', RAW], ['REFINED', REFINED], ['TRADE GOODS', GOODS]];
        for (const [label, ids] of cats) {
            const list = ids.map((id) => ({ id, q: G.quote(id, st), have: G.cargoOf(id) })).filter(({ id, q, have }) => {
                if (this.mkFilter === 'hold') return have > 0;
                if (this.mkFilter === 'crave') return q.crave || q.sell > ITEMS[id].price * 1.2;
                if (this.mkFilter === 'sale') return q.stock > 0;
                return true;
            });
            if (!list.length) continue;
            rows.push(h('tr.cat', h('td', { colspan: 6 }, label)));
            for (const { id, q, have } of list) {
                const ratio = q.sell / ITEMS[id].price;
                rows.push(h('tr',
                    h('td', swatch(id), itemName(id), q.crave ? h('span.tag.crave', 'WANTED') : null, q.make ? h('span.tag.make', 'LOCAL') : null, q.taboo ? h('span.tag.taboo', 'TABOO') : null),
                    h(`td.${ratio > 1.15 ? 'hi' : ratio < 0.85 ? 'lo' : ''}`, q.taboo ? '—' : fmt(q.sell)),
                    h('td', q.stock > 0 ? fmt(q.buy) : '—'),
                    h('td.hide-s.muted', q.stock),
                    h('td', have || ''),
                    h('td.acts',
                        h('button.btn.sm', { disabled: !have || q.taboo, onclick: this.act(() => this.sold(G.sell(id, 1))) }, 'SELL 1'),
                        h('button.btn.sm', { disabled: !have || q.taboo, onclick: this.act(() => this.sold(G.sell(id, have))) }, 'ALL'),
                        h('button.btn.sm.cyan', { disabled: q.stock <= 0 || G.cargoFree() <= 0 || G.s.credits < q.buy, onclick: this.act(() => this.bought(G.buy(id, 1))) }, 'BUY 1'),
                        h('button.btn.sm.cyan', { disabled: q.stock <= 0 || G.cargoFree() <= 0 || G.s.credits < q.buy, onclick: this.act(() => this.bought(G.buy(id, 10))) }, '10'))));
            }
        }
        const sellAllRaw = () => { let t = 0; for (const id of RAW) { const n = G.cargoOf(id); if (n && !G.quote(id, st).taboo) { const r = G.sell(id, n); if (r.ok) t += r.total; } } return this.sold({ ok: t > 0, total: t, why: 'No raw resources in the hold' }); };
        return [
            h('div.row.sp', seg, h('button.btn.sm', { onclick: this.act(sellAllRaw) }, 'SELL ALL RAW')),
            h('p.note', { style: { margin: '6px 0' } }, `The ${sp.name} crave `, h('b', sp.craves.map(itemName).join(', ')), ', make ', h('b', sp.makes.map(itemName).join(', ')), ' and consider ', h('b', { style: { color: 'var(--coral)' } }, itemName(sp.taboo)), ' taboo.'),
            h('table.mk', h('thead', h('tr', h('th', 'ITEM'), h('th', 'SELL'), h('th', 'BUY'), h('th.hide-s', 'STOCK'), h('th', 'HOLD'), h('th', ''))), h('tbody', rows)),
        ];
    }
    sold(r) { if (r.ok) { this.audio.buy(); this.app.toast(`Sold for ${fmt(r.total)} cr`, 'good'); } return r.ok ? undefined : r; }
    bought(r) { if (r.ok) this.audio.buy(); return r.ok ? undefined : r; }

    station_missions(st, sp) {
        const G = this.G;
        const out = [];
        const here = G.galaxy.systems[G.s.location.system];
        const turnable = G.s.quests.filter((q) => (q.type === 'procure' || q.type === 'mining') && q.target.station === st.id);
        if (turnable.length) {
            out.push(h('h3.sec', 'HAND OVER'));
            out.push(h('div.grid', turnable.map((q) => h('div.card.mission', h('h4', q.title), h('div.stat', `In hold: ${G.cargoOf(q.target.item)}/${q.need} ${itemName(q.target.item)}`), h('div.rew', `Reward ◆ ${fmt(q.reward.credits)}`),
                h('div.acts', h('button.btn.mint', { disabled: !G.canTurnIn(q), onclick: this.act(() => { const ok = G.turnIn(q); if (ok) this.audio.quest(); return { ok, why: 'Not enough in your hold' }; }) }, 'HAND OVER'))))));
        }
        out.push(h('h3.sec', `MISSION BOARD · ${G.s.quests.length}/6 ACTIVE`));
        const board = G.board();
        if (!board.length) out.push(h('p.note', 'No work posted right now. Boards refresh every few minutes.'));
        out.push(h('div.grid', board.map((q) => {
            const dest = G.galaxy.systems[q.target.system];
            const d = lyDist(here, dest);
            return h('div.card.mission',
                h('h4', h('span.ic', '◇'), questTypeName(q.type).toUpperCase()),
                h('div.stat', h('b', { style: { color: '#fff' } }, q.title)),
                h('p', q.desc),
                h('div.stat.muted', q.target.system === here.id ? 'In this system' : `${dest.name} · ${d.toFixed(1)} ly`, q.cargo ? ` · needs ${q.cargo} cargo` : '', ` · danger ${dest.danger}`),
                h('div.rew', `◆ ${fmt(q.reward.credits)}`, q.reward.data ? ` · ${q.reward.data} data` : '', ` · +standing`),
                h('div.acts', h('button.btn', { onclick: this.act(() => { const r = G.accept(q); if (r.ok) { this.app.toast(`Mission accepted: ${q.title}`, 'info'); this.app.track({ kind: 'quest', id: r.q.id }); } return r; }) }, 'ACCEPT')));
        })));
        return out;
    }

    station_services(st, sp) {
        const G = this.G, sts = G.stats();
        const fp = G.fuelPrice();
        const need = sts.fuelMax - G.s.ship.fuel;
        const rc = G.repairCost();
        const dp = dataPrice(G, st);
        return [
            h('div.grid',
                h('div.card', h('h4', h('span.ic', '⛽'), 'REFUEL'), h('p', `Warp Cells: ${G.s.ship.fuel}/${sts.fuelMax}. Cells in your hold are used first.`), h('div.stat', `◆ ${fp} per cell`),
                    h('div.acts', h('button.btn', { disabled: need <= 0, onclick: this.act(() => { const r = G.refuel(); if (r.ok) this.app.toast(`Refuelled ${r.used} cells${r.cost ? ` for ${r.cost} cr` : ''}`, 'good'); return r; }) }, need > 0 ? `FILL TANK (◆ ${fmt(Math.max(0, need - G.cargoOf('fuelcell')) * fp)})` : 'TANK FULL'))),
                h('div.card', h('h4', h('span.ic', '🔧'), 'REPAIR'), h('p', `Hull ${Math.ceil(G.s.ship.hp)}/${sts.hullMax}.`),
                    h('div.acts', h('button.btn', { disabled: G.s.ship.hp >= sts.hullMax, onclick: this.act(() => G.repair()) }, G.s.ship.hp >= sts.hullMax ? 'HULL INTACT' : `REPAIR (◆ ${fmt(rc)})`))),
                h('div.card', h('h4', h('span.ic', '◈'), 'CARTOGRAPHER'), h('p', `Sell survey and charting data. You hold ${fmt(G.s.data)} data. (Hearth's Research Lab can turn data into research instead.)`), h('div.stat', `◆ ${dp} per data point`),
                    h('div.acts', h('button.btn', { disabled: G.s.data < 1, onclick: this.act(() => { const r = G.sellData(); if (r.ok) { this.audio.buy(); this.app.toast(`Data sold for ${fmt(r.total)} cr`, 'good'); } return r; }) }, `SELL DATA (◆ ${fmt(Math.floor(G.s.data) * dp)})`))),
            ),
            h('h3.sec', 'COMMS'),
            h('p.note', `The ${sp.gov} (${TEMPERAMENTS[sp.temperament].name}) · ${sp.body} · `, h('span', { style: { color: standingBand(G.standing(sp.id)).color } }, `${standingBand(G.standing(sp.id)).name}`), '. Trade, missions and hunting raiders in their space all raise your standing. Friendly standing improves prices; Allied unlocks Mk IV parts at their shipyards.'),
        ];
    }

    station_yard(st, sp) {
        const G = this.G;
        const offers = G.alienOffers();
        return [
            h('p.note', `The ${sp.name} sell parts for credits only, at a mark-up. Their yard offers up to Mk ${G.standing(sp.id) >= 60 ? 'IV' : 'III'}${G.standing(sp.id) >= 60 ? '' : ' (Mk IV when Allied)'}.`),
            h('div.grid', offers.map((o) => h('div.card', h('h4', COMPONENTS[o.id].name.toUpperCase(), h('span.lv', `MK ${o.mk}`)), h('p', COMPONENTS[o.id].desc), h('div.stat', `◆ ${fmt(o.credits)}`),
                h('div.acts', h('button.btn', { disabled: !o.ok, onclick: this.act(() => { const r = G.buyAlien(o.id); if (r.ok) this.audio.upgrade(); return r; }) }, 'BUY & INSTALL'), o.why ? h('span.why', o.why) : null)))),
            !offers.length ? h('p.note', 'Nothing here beats what you already fly.') : null,
        ];
    }

    station_cargo() { return this.cargoList(false); }
    cargoList(atHearth) {
        const G = this.G;
        const ids = Object.keys(G.s.cargo).sort((a, b) => ITEMS[b].price * G.s.cargo[b] - ITEMS[a].price * G.s.cargo[a]);
        const mission = Object.entries(G.s.missionCargo);
        return [
            h('h3.sec', `HOLD · ${G.cargoUsed()}/${G.stats().cargo}`),
            !ids.length && !mission.length ? h('p.note', 'Your hold is empty.') : null,
            h('table.mk', h('tbody',
                ids.map((id) => h('tr', h('td', swatch(id), itemName(id)), h('td', G.s.cargo[id]), h('td.muted.hide-s', `~◆ ${fmt(ITEMS[id].price * G.s.cargo[id])}`),
                    h('td.acts', atHearth ? h('button.btn.sm', { onclick: this.act(() => G.unload(id, G.s.cargo[id])) }, 'UNLOAD') : null,
                        h('button.btn.sm.red', { onclick: this.act(() => { G.take(id, G.s.cargo[id]); return { ok: true }; }) }, 'JETTISON')))),
                mission.map(([qid, n]) => h('tr', h('td', '📦 Mission cargo'), h('td', n), h('td.muted.hide-s', G.s.quests.find((q) => q.id === qid)?.title || ''), h('td', ''))))),
        ];
    }

    // ---------------------------------------------------------------- Hearth
    render_hearth() {
        const G = this.G, b = G.s.base;
        const pw = base.power(b);
        const tabs = [['overview', 'OVERVIEW'], ['build', 'BUILD'], ['refinery', 'REFINERY'], ['fab', 'FABRICATOR'], ['yard', 'SHIPYARD'], ['research', 'RESEARCH'], ['storage', 'STORAGE']];
        const body = this[`hearth_${this.tab}`]?.() || [];
        return this.win({
            head: this.head('HEARTH', h('span', `Command Core Lv ${base.coreLevel(b)} · Power `, h('b', { style: { color: pw.eff < 1 ? 'var(--coral)' : 'var(--mint)' } }, `${pw.use}/${pw.prod}`), ` · Storage ${base.storageUsed(b)}/${base.storageCap(b)} · Modules ${base.usedSlots(b)}/${moduleSlots(base.coreLevel(b))}`), { portrait: hearthEmblem(), close: false }),
            tabs, body,
            foot: this.walletFoot([h('button.btn.cyan.big', { onclick: () => this.app.undock(), 'data-focus': '' }, 'UNDOCK')]),
        });
    }
    have = (k) => (k === 'credits' ? this.G.s.credits : this.G.have(k, 'base'));

    hearth_overview() {
        const G = this.G, b = G.s.base;
        const cargo = G.cargoUsed();
        const pw = base.power(b);
        const core = b.modules.find((m) => m.type === 'core');
        const out = [];
        out.push(h('div.row.sp', h('div', h('h3.sec', 'HOLD'), h('p.note', cargo ? `${cargo} units aboard: ${Object.entries(G.s.cargo).map(([k, n]) => `${n} ${itemName(k)}`).join(', ')}` : 'Your hold is empty.')),
            h('button.btn.mint.big', { disabled: !Object.keys(G.s.cargo).length, onclick: this.act(() => { const r = G.unloadAll(); if (r.moved) this.app.toast(`Unloaded ${r.moved} units to storage${r.full ? ' (storage full!)' : ''}`, r.full ? 'warn' : 'good'); return r.moved ? { ok: true } : { ok: false, why: 'Storage full' }; }) }, 'UNLOAD ALL')));
        if (pw.eff < 1) out.push(h('p.why', `Power shortage: production running at ${Math.round(pw.eff * 100)}%. Build or upgrade Solar Arrays.`));
        if (b.raidLog && G.s.time - b.raidLog.t < 1800) out.push(h('p', { class: b.raidLog.repelled ? 'ok' : 'why' }, b.raidLog.repelled ? 'Your Defense Grid repelled a recent Reaver raid.' : `Reavers raided Hearth: lost ${Object.entries(b.raidLog.lost).map(([k, n]) => `${n} ${itemName(k)}`).join(', ') || 'nothing'}.`));
        out.push(h('h3.sec', 'MODULES'));
        out.push(h('div.grid', [core, ...b.modules.filter((m) => m.type !== 'core')].map((m) => this.moduleCard(m))));
        const prod = Object.entries(b.produced).filter(([, n]) => n > 0);
        if (prod.length) out.push(h('h3.sec', 'PRODUCED SO FAR'), h('div.chips', prod.map(([k, n]) => h('span.chip', swatch(k), `${fmt(n)} ${itemName(k)}`))));
        return out;
    }
    moduleCard(m) {
        const G = this.G, D = MODULES[m.type];
        const uc = base.upgradeCheck(G, m.uid);
        const next = moduleCost(m.type, m.level + 1);
        let stat = '';
        const b = G.s.base;
        if (m.type === 'core') stat = `${moduleSlots(m.level)} slots · module cap Lv ${moduleCap(m.level)} · +${D.power * m.level} power`;
        if (m.type === 'solar') stat = `+${D.power * m.level} power`;
        if (m.type === 'silo') stat = `+${250 * m.level} storage`;
        if (m.type === 'refinery') stat = `every recipe: 1 batch / ${(6 / m.level).toFixed(1)} s`;
        if (m.type === 'drones') stat = `${b.drones}/${m.level * 3} drones (build at the Fabricator)`;
        if (m.type === 'hydro') stat = `${m.level} rations / 20 s`;
        if (m.type === 'lab') stat = `${base.labRate(b).toFixed(2)} RP per data`;
        if (m.type === 'defense') stat = `defense rating ${base.defenseRating(b).toFixed(1)}`;
        if (m.type === 'depot') stat = `sells up to ${15 * m.level} of each marked item / min`;
        return h('div.card',
            h('h4', h('span.ic', D.icon), D.name.toUpperCase(), h('span.lv', `LV ${m.level}`)),
            pips(m.level, D.max),
            h('p', D.desc),
            stat ? h('div.stat', stat) : null,
            uc.maxed || m.level >= D.max ? h('div.stat.ok', 'Maximum level') : next ? costList(next, this.have) : null,
            h('div.acts',
                m.level < D.max ? h('button.btn', { disabled: !uc.ok, onclick: this.act(() => { const r = G.upgradeModule(m.uid); if (r.ok) this.audio.upgrade(); return r; }) }, 'UPGRADE') : null,
                !uc.ok && uc.why && uc.why !== 'Maximum level' ? h('span.why', uc.why) : null));
    }

    hearth_build() {
        const G = this.G, b = G.s.base;
        const free = moduleSlots(base.coreLevel(b)) - base.usedSlots(b);
        return [
            h('p.note', `${free} free module slot${free === 1 ? '' : 's'}. Upgrade the Command Core (Overview) for more slots and higher module levels. Materials are drawn from Hearth storage, then your hold.`),
            h('div.grid', MODULE_ORDER.map((type) => {
                const D = MODULES[type];
                const c = base.buildCheck(G, type);
                const count = base.modulesOf(b, type).length;
                const locked = D.core > base.coreLevel(b);
                return h(`div.card${locked ? '.lock' : ''}${count ? '.on' : ''}`,
                    h('h4', h('span.ic', D.icon), D.name.toUpperCase(), count ? h('span.lv', D.unique ? 'BUILT' : `×${count}`) : null),
                    h('p', D.desc),
                    h('div.stat.muted', `Power ${D.power ? `+${D.power}` : `-${D.use}`}`),
                    costList(moduleCost(type, 1), this.have),
                    h('div.acts', h('button.btn', { disabled: !c.ok, onclick: this.act(() => { const r = G.build(type); if (r.ok) this.audio.upgrade(); return r; }) }, 'BUILD'), !c.ok ? h('span.why', c.why) : null));
            })),
        ];
    }

    hearth_refinery() {
        const G = this.G, b = G.s.base;
        const ref = base.modulesOf(b, 'refinery')[0];
        if (!ref) return [h('p.lead', 'No Refinery yet. Build one in the BUILD tab: it turns raw ore into the materials every upgrade needs.')];
        return [
            h('p.note', `Refinery Lv ${ref.level}: every enabled recipe runs one batch every ${(6 / ref.level).toFixed(1)} s${G.hasTech('refining') ? ' (+30% from Efficient Refining)' : ''}. Inputs come from Hearth storage, so unload your ore first.`),
            h('div.setting', h('span', 'Keep raw in reserve'), h('div.seg', [0, 20, 50, 100, 250].map((v) => h(`button${(b.reserve ?? 20) === v ? '.on' : ''}`, { onclick: this.act(() => { b.reserve = v; return { ok: true }; }) }, String(v))))),
            h('div.setting', h('span', 'Stop each recipe at'), h('div.seg', [[50, '50'], [150, '150'], [400, '400'], [0, 'NO LIMIT']].map(([v, l]) => h(`button${(b.refCap ?? 150) === v ? '.on' : ''}`, { onclick: this.act(() => { b.refCap = v; return { ok: true }; }) }, l)))),
            h('p.note', { style: { marginBottom: '10px' } }, 'The refinery never takes raw resources below the reserve, so ore stays available for building, and it pauses a recipe once that product is stocked, so recipes don\'t starve each other.'),
            h('div.grid', RECIPES.map((r) => {
                const lock = r.minLevel > ref.level;
                const on = !!b.recipes[r.id] && !lock;
                const can = Object.entries(r.in).every(([k, n]) => (b.storage[k] || 0) >= n);
                return h(`div.card${on ? '.on' : ''}${lock ? '.lock' : ''}`,
                    h('h4', Object.keys(r.out).map((k) => [swatch(k), itemName(k)]), h('span.lv', `×${Object.values(r.out)[0]}`)),
                    h('div.cost', Object.entries(r.in).map(([k, n]) => h(`span.${(b.storage[k] || 0) >= n ? 'yes' : 'no'}`, swatch(k), `${n} ${itemName(k)}`, h('small.muted', ` (${b.storage[k] || 0})`)))),
                    h('div.acts', lock ? h('span.why', `Needs Refinery Lv ${r.minLevel}`) : h(`button.btn.sm${on ? '.mint' : ''}`, { onclick: this.act(() => { b.recipes[r.id] = !b.recipes[r.id]; return { ok: true }; }) }, on ? 'ENABLED' : 'DISABLED'), on && !can ? h('span.muted', 'waiting for inputs') : null));
            })),
        ];
    }

    hearth_fab() {
        const G = this.G, b = G.s.base;
        if (!base.hasModule(b, 'fabricator')) return [h('p.lead', 'No Fabricator yet. Build one to craft Warp Cells, hull repairs, trade goods, mining drones and, one day, the Lattice Key.')];
        return [h('div.grid', FAB.filter((f) => !f.story || G.s.story.stage >= 9 || G.s.story.shards >= 3).map((f) => {
            const c = base.fabCheck(G, f.id);
            return h('div.card', h('h4', f.name.toUpperCase()), h('p', f.desc), costList(f.in, this.have),
                h('div.acts', h('button.btn', { disabled: !c.ok, onclick: this.act(() => { const r = G.fabricate(f.id); if (r.ok) { this.audio.upgrade(); this.app.toast(`Fabricated: ${f.name}`, 'good'); } return r; }) }, 'FABRICATE'), !c.ok ? h('span.why', c.why) : null));
        }))];
    }

    hearth_yard() {
        const G = this.G, sh = G.s.ship, st = G.stats();
        const yard = base.modulesOf(G.s.base, 'shipyard')[0];
        const out = [];
        if (!yard) out.push(h('p.why', 'Build a Shipyard (BUILD tab) to upgrade your ship.'));
        const hc = G.hullCheck();
        out.push(h('div.card', { style: { marginBottom: '10px' } },
            h('h4', h('span.ic', '⬢'), `${sh.name.toUpperCase()} · ${HULLS[sh.hull].name.toUpperCase()} HULL`, h('span.lv', `CLASS ${sh.hull}`)),
            h('div.stat', `Hull ${st.hullMax} · Cargo ${st.cargo} · Speed ${Math.round(st.speed)} · Turn ${st.turn.toFixed(2)} · Shield ${Math.round(st.shield)} · Warp ${st.warpRange} ly`),
            h('p', 'The hull class caps every component Mk. A bigger hull means a bigger, more detailed ship.'),
            !hc.maxed ? [h('div.stat', `Next: ${HULLS[sh.hull + 1].name} (hull ${HULLS[sh.hull + 1].hull}, cargo ${HULLS[sh.hull + 1].cargo})`), costList(HULLS[sh.hull + 1].cost, this.have)] : h('div.stat.ok', 'The largest hull in the Guild registry.'),
            h('div.acts', !hc.maxed ? h('button.btn', { disabled: !hc.ok, onclick: this.act(() => { const r = G.upgradeHull(); if (r.ok) this.audio.upgrade(); return r; }) }, 'UPGRADE HULL') : null, !hc.ok && hc.why && !hc.maxed ? h('span.why', hc.why) : null)));
        out.push(h('div.grid', COMP_ORDER.map((id) => {
            const C = COMPONENTS[id];
            const mk = sh.comps[id];
            const c = G.compCheck(id);
            const max = C.max ?? 5;
            const desc = compStat(id, mk);
            const next = mk < max ? compStat(id, mk + 1) : null;
            return h('div.card',
                h('h4', C.name.toUpperCase(), h('span.lv', mk ? `MK ${mk}` : 'NONE')),
                pips(mk, max),
                h('div.stat', desc, next ? h('span', ' → ', h('b', next)) : null),
                mk < max && c.cost ? costList(c.cost, this.have) : mk < max ? null : h('div.stat.ok', 'Maximum Mk'),
                h('div.acts', mk < max ? h('button.btn', { disabled: !c.ok, onclick: this.act(() => { const r = G.upgradeComp(id); if (r.ok) this.audio.upgrade(); return r; }) }, mk ? 'UPGRADE' : 'INSTALL') : null, !c.ok && c.why && !c.maxed ? h('span.why', c.why) : null));
        })));
        out.push(h('h3.sec', 'PAINT & DESIGN'));
        out.push(h('div.chips', PAINTS.map((p, i) => h(`span.chip.click${sh.paint === i ? '.on' : ''}`, { onclick: this.act(() => { G.setPaint(i); return { ok: true }; }) }, h('span.sw', { style: { background: p.a } }), h('span.sw', { style: { background: p.b } }), p.name))));
        out.push(h('div.row', { style: { marginTop: '10px' } },
            h('button.btn.cyan', { onclick: this.act(() => { G.rerollDesign(); return { ok: true }; }) }, '⚄ NEW DESIGN'),
            h('input', { type: 'text', value: sh.name, maxlength: 16, style: { width: '200px' }, 'aria-label': 'Ship name', onchange: (e) => { sh.name = e.target.value.trim().slice(0, 16) || sh.name; }, onkeydown: (e) => e.stopPropagation() }),
            h('span.note', 'Free. Your ship is regenerated from its design seed.')));
        return out;
    }

    hearth_research() {
        const G = this.G, b = G.s.base;
        if (!base.hasModule(b, 'lab')) return [h('p.lead', 'No Research Lab yet. Build one, then fly close to planets and hold E to scan them. Data becomes research.')];
        const rate = base.labRate(b);
        return [
            h('div.row.sp', h('div', h('h3.sec', 'DATA → RESEARCH'), h('p.note', `You hold ${fmt(G.s.data)} data and ${b.rp.toFixed(1)} research points. Lab rate: ${rate.toFixed(2)} RP per data.`)),
                h('div.row', h('button.btn', { disabled: G.s.data < 1, onclick: this.act(() => G.convertData(10)) }, 'CONVERT 10'), h('button.btn.mint', { disabled: G.s.data < 1, onclick: this.act(() => G.convertData(Infinity)) }, 'CONVERT ALL'))),
            h('div.grid', TECHS.map((t) => {
                const done = b.tech.includes(t.id);
                const c = base.researchCheck(G, t.id);
                return h(`div.card${done ? '.on' : ''}`, h('h4', h('span.ic', '⚛'), t.name.toUpperCase(), h('span.lv', done ? 'DONE' : `${t.rp} RP`)), h('p', t.desc),
                    h('div.meter', h('b', { style: { width: `${done ? 100 : Math.min(100, b.rp / t.rp * 100)}%` } })),
                    h('div.acts', done ? h('span.ok', '✓ Researched') : h('button.btn', { disabled: !c.ok, onclick: this.act(() => { const r = G.research(t.id); if (r.ok) this.audio.upgrade(); return r; }) }, 'RESEARCH'), !done && !c.ok ? h('span.why', c.why) : null));
            })),
        ];
    }

    hearth_storage() {
        const G = this.G, b = G.s.base;
        const depot = base.hasModule(b, 'depot');
        const ids = Object.keys(b.storage).filter((k) => b.storage[k] > 0).sort((a, c) => (ITEMS[a].cat + a).localeCompare(ITEMS[c].cat + c));
        return [
            h('h3.sec', `STORAGE · ${base.storageUsed(b)}/${base.storageCap(b)}`),
            depot ? h('p.note', 'Tick AUTO-SELL and the Trade Depot sells surplus above 20 units every minute at 75% of base price.') : null,
            !ids.length ? h('p.note', 'Storage is empty.') : null,
            h('table.mk', h('tbody', ids.map((id) => h('tr', h('td', swatch(id), itemName(id)), h('td', b.storage[id]),
                h('td.acts',
                    h('button.btn.sm.cyan', { onclick: this.act(() => G.load(id, 10)) }, 'LOAD 10'),
                    h('button.btn.sm.cyan', { onclick: this.act(() => G.load(id, b.storage[id])) }, 'LOAD ALL'),
                    depot ? h(`button.btn.sm${b.depot[id] ? '.mint' : ''}`, { onclick: this.act(() => { b.depot[id] = !b.depot[id]; return { ok: true }; }) }, b.depot[id] ? 'AUTO-SELL ✓' : 'AUTO-SELL') : null))))),
            h('div', { style: { marginTop: '14px' } }, this.cargoList(true)),
        ];
    }

    // ---------------------------------------------------------------- journal
    render_journal() {
        const tabs = [['story', 'STORY'], ['missions', `MISSIONS (${this.G.s.quests.length})`], ['codex', 'CODEX'], ['stats', 'STATS']];
        return this.win({ head: this.head("CAPTAIN'S JOURNAL", `${this.G.s.ship.name} · seed ${this.G.s.seed}`), tabs, body: this[`journal_${this.tab}`]() });
    }
    journal_story() {
        const G = this.G;
        const cur = G.stage();
        const out = [];
        if (cur) {
            out.push(h('div.story-box', h('h4', `CHAPTER ${G.s.story.stage + 1}: ${cur.title.toUpperCase()}`), h('p.lead', cur.text(G.galaxy, G.plan)),
                cur.goals(G).map(([t, v, m]) => h(`div.goal${v >= m ? '.done' : ''}`, h('span.box'), t, h('span.n', `${Math.floor(v)}/${m}`))),
                h('div', { style: { marginTop: '12px' } }, h('button.btn', { onclick: () => { this.app.track({ kind: 'story' }); this.app.closeMenu(); } }, 'TRACK'))));
        } else out.push(h('div.story-box', h('h4', 'THE LATTICE IS AWAKE'), h('p.lead', 'The Signal is answered. Every system you have visited is a single jump away. The galaxy is yours to wander.')));
        out.push(h('h3.sec', 'COMPLETED'));
        out.push(h('div.chips', STAGES.slice(0, G.s.story.stage).map((s, i) => h('span.chip.on', `${i + 1}. ${s.title}`))));
        return out;
    }
    journal_missions() {
        const G = this.G;
        const out = [];
        if (!G.s.quests.length) out.push(h('p.note', 'No active missions. Mission boards are on every alien station.'));
        out.push(h('div.grid', G.s.quests.map((q) => {
            const nav = questNav(G, q);
            return h('div.card.mission', h('h4', questTypeName(q.type).toUpperCase()), h('div.stat', h('b', { style: { color: '#fff' } }, q.title)), h('p', q.desc),
                h('div.stat', `Progress ${q.type === 'procure' || q.type === 'mining' ? `${G.cargoOf(q.target.item)}/${q.need} in hold` : `${q.progress}/${q.need}`} · ${G.galaxy.systems[nav.system].name}`),
                h('div.rew', `◆ ${fmt(q.reward.credits)} · from ${q.giver.stationName}`),
                h('div.acts', h('button.btn', { onclick: () => { this.app.track({ kind: 'quest', id: q.id }); this.app.closeMenu(); } }, 'TRACK'), h('button.btn.red.sm', { onclick: this.act(() => { G.abandon(q.id); return { ok: true }; }) }, 'ABANDON')));
        })));
        if (G.s.questLog.length) { out.push(h('h3.sec', 'COMPLETED')); out.push(h('div.chips', G.s.questLog.slice(0, 16).map((l) => h('span.chip', `${l.title} · ◆${fmt(l.credits)}`)))); }
        return out;
    }
    journal_codex() {
        const G = this.G;
        const met = G.galaxy.species.filter((sp) => G.s.met.includes(sp.id));
        const out = [h('h3.sec', `SPECIES · ${met.length}/${G.galaxy.species.length} CONTACTED`)];
        out.push(h('div.grid', G.galaxy.species.map((sp) => {
            if (!G.s.met.includes(sp.id)) return h('div.card.species.lock', h('div.info', h('h4', 'UNKNOWN SPECIES'), h('p', 'Not yet contacted.')));
            const v = G.standing(sp.id);
            const band = standingBand(v);
            return h('div.card.species', h('img', { src: portrait(sp, 192), alt: sp.name }),
                h('div.info', h('h4', sp.gov.toUpperCase()), h('p', `${TEMPERAMENTS[sp.temperament].name} · ${sp.body}${sp.hostile ? ' · HOSTILE' : ''}`),
                    h('p', 'Crave: ', h('b', sp.craves.map(itemName).join(', '))), h('p', 'Make: ', sp.makes.map(itemName).join(', ')), h('p', 'Taboo: ', h('span', { style: { color: 'var(--coral)' } }, itemName(sp.taboo))),
                    h('div.stand', h('i', { style: { left: `${(v + 100) / 2}%` } })), h('p', { style: { color: band.color } }, `${band.name} (${Math.round(v)})`), h('p', `Home: ${G.s.visited.includes(sp.home) || G.s.revealed.includes(sp.home) ? G.galaxy.systems[sp.home].name : 'unknown'}`)));
        })));
        return out;
    }
    journal_stats() {
        const G = this.G, S = G.s.stats;
        const items = [
            ['Play time', `${Math.floor(G.s.time / 3600)}h ${Math.floor(G.s.time / 60) % 60}m`], ['Systems visited', `${G.s.visited.length}/${G.galaxy.systems.length}`], ['Jumps', S.jumps], ['Light-years', S.lyTravelled.toFixed(1)],
            ['Distance flown', fmtDist(S.distance)], ['Ore mined', fmt(S.minedTotal)], ['Planets surveyed', S.planetsScanned], ['Credits earned', fmt(S.earned)],
            ['Missions done', S.quests || 0], ['Raiders destroyed', S.kills], ['Ships lost', S.deaths], ['Species met', G.s.met.length],
        ];
        return [h('div.stats-grid', items.map(([k, v]) => h('div', h('b', v), h('small', k.toUpperCase()))))];
    }

    // ---------------------------------------------------------------- settings / pause
    render_settings() {
        const S = this.app.settings;
        const set = (k, v) => { S[k] = v; this.app.applySettings(); this.refresh(); };
        const seg = (k, opts) => h('div.seg', opts.map(([v, l]) => h(`button${S[k] === v ? '.on' : ''}`, { onclick: () => { this.audio.click(); set(k, v); } }, l)));
        const slider = (k) => h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[k], oninput: (e) => { S[k] = parseFloat(e.target.value); this.app.applySettings(); } });
        return this.win({
            narrow: true,
            head: this.head('SETTINGS', null, { onClose: () => (this.app.mode === 'title' ? (this.close(), this.app.toTitle()) : this.app.closeMenu()) }),
            body: [
                h('div.setting', h('span', 'Music'), slider('music')),
                h('div.setting', h('span', 'Sound effects'), slider('sfx')),
                h('div.setting', h('span', 'Mute'), seg('muted', [[false, 'OFF'], [true, 'ON']])),
                h('div.setting', h('span', 'Graphics'), seg('quality', [['auto', 'AUTO'], ['0', 'HIGH'], ['1', 'MED'], ['2', 'LOW'], ['3', 'POTATO']])),
                h('div.setting', h('span', 'Mouse steering'), seg('mouseSteer', [[true, 'ON'], [false, 'OFF']])),
                h('div.setting', h('span', 'Invert pitch'), seg('invertY', [[false, 'OFF'], [true, 'ON']])),
                h('div.setting', h('span', 'Tutorial tips'), seg('tips', [[true, 'ON'], [false, 'OFF']])),
            ],
        });
    }
    render_pause() {
        const G = this.G;
        const btn = (label, fn, cls = '') => h(`button.tbtn${cls}`, { onclick: () => { this.audio.click(); fn(); }, style: { width: '100%' } }, label);
        return this.win({
            narrow: true,
            head: this.head('PAUSED', `Seed ${G.s.seed} · ${G.sysMeta.name}`),
            body: [h('div.title-menu', { style: { alignItems: 'stretch' } },
                btn('RESUME', () => this.app.closeMenu()),
                btn('JOURNAL', () => this.open('journal')),
                btn('GALAXY MAP', () => this.app.openMap('galaxy')),
                btn('HOW TO PLAY', () => this.open('help')),
                btn('SETTINGS', () => this.open('settings')),
                btn('COPY SEED', () => { navigator.clipboard?.writeText(G.s.seed).then(() => this.app.toast('Seed copied', 'good')).catch(() => this.app.toast(`Seed: ${G.s.seed}`, 'info')); }),
                btn('SAVE & QUIT TO TITLE', () => this.app.quitToTitle()))],
        });
    }

    render_death() {
        const d = this.opts;
        return this.win({
            narrow: true,
            head: this.head('SHIP DESTROYED', 'Your escape pod tumbles home to Hearth.', { close: false }),
            body: [h('p.lead', `The Guild salvage crews put your ship back together. Your upgrades survived; your cargo (${d.lostCargo} units) did not.`), h('p.note', `Recovery fee: ◆ ${fmt(d.fee)}.`)],
            foot: [h('button.btn.big', { onclick: () => this.app.respawn(), 'data-focus': '' }, 'WAKE UP AT HEARTH')],
        });
    }

    render_ending() {
        const G = this.G;
        const lines = [
            'The Key turns in a lock the size of a moon.',
            'Rings of light unfold around the Heart, and the Lattice Signal resolves at last: not a warning, not a weapon, but an invitation: a road between every star its builders ever touched.',
            `Across the galaxy, ${G.galaxy.species.filter((s) => !s.hostile).map((s) => s.name).slice(0, 3).join(', ')} and the rest look up as their skies chime in harmony.`,
            `You came from a cold shell called Hearth with a skiff named ${G.s.ship.name}. Now any star you have visited is one jump away.`,
            `${G.s.visited.length} systems visited · ${fmt(G.s.stats.minedTotal)} ore mined · ${G.s.stats.quests || 0} missions · ${Math.floor(G.s.time / 60)} minutes.`,
        ];
        return this.win({
            head: this.head('THE LATTICE AWAKENS', `Seed ${G.s.seed}`, { close: false }),
            body: [h('div.ending', h('h2', 'HEART OF THE GALAXY'), lines.map((l, i) => h('p', { style: { animationDelay: `${i * 0.9}s` } }, l)))],
            foot: [h('button.btn.big', { onclick: () => this.app.closeMenu(), 'data-focus': '' }, 'KEEP EXPLORING')],
        });
    }
}

function compStat(id, mk) {
    const s = COMPONENTS[id].stats[mk];
    if (!s) return '—';
    switch (id) {
        case 'engine': return `${s.speed} u/s`;
        case 'thrusters': return `${s.turn} rad/s`;
        case 'shield': return `${s.shield} shield`;
        case 'armor': return `×${s.hullMul} hull`;
        case 'cargo': return `+${s.cargo} cargo`;
        case 'mining': return `${s.rate}/s · hard ${s.hard}`;
        case 'weapon': return `${s.dmg} dmg${s.twin ? ' ×2' : ''} · ${s.rate}/s`;
        case 'scanner': return `${(s.range / 1000).toFixed(1)} km`;
        case 'warp': return s.range ? `${s.range} ly` : 'none';
        case 'tank': return `${s.fuel} cells`;
        case 'scoop': return mk === 0 ? 'none' : mk === 1 ? 'fuel' : 'fuel + gas';
        default: return '';
    }
}

let _emblem = null;
function hearthEmblem() {
    if (_emblem) return _emblem;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, '#ffcf7a'); grd.addColorStop(0.35, '#b8641a'); grd.addColorStop(1, '#0a0c14');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffe2a8'; g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const x = 64 + Math.cos(a) * 30, y = 64 + Math.sin(a) * 30; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
    g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 8, 0, Math.PI * 2); g.fill();
    _emblem = c.toDataURL();
    return _emblem;
}
