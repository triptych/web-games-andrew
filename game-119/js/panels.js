// The panels: market, wagon, workshops, notice board, inn, guild house, the Hero's tent, journal, ledger.
// Each builder gets (G, ctx) and returns { title, body, foot? }. ctx.act() runs a sim command and refreshes.

import { h, fmt } from './dom.js';
import { TOWN, TOWNS, SHOP_DEFS, REGIONS, HERO_CLASSES, MERCHANT_TITLES, NEIGHBORS } from './sim/data/towns.js';
import { MATS, FAMS, FAM_IDS, SLOT_ORDER, STATIONS, FILTERS, ALL_RECIPES, itemDef, itemName, basePrice, gearRecipe, recipeById, catOf, keyOf, RARITY, RARITY_COLOR, gradeOf } from './sim/data/items.js';
import { QUESTS, STORY_ORDER } from './sim/data/quests.js';
import { rankFor, RANKS, HERO } from './sim/data/story.js';
import { WAGONS, STASH, REGION_LEVEL, ECLIPSE_DAY, MAX_LEVEL, levelXp } from './config.js';
import { weightOf, usedCells, count, itemById, stashCount } from './sim/inv.js';
import * as M from './sim/market.js';
import { burden, offerOptions, stashUpgradeCost, canTravel } from './sim/game.js';
import { questsAt, reqProgress, questReady, questState, heroTownFor, heroOffer, questDef, nextStoryId } from './sim/quest.js';
import { have, levelProgress, inGuildTown } from './sim/core.js';
import { invGrid } from './invgrid.js';
import { iconUrl, GLYPH } from './view/icons.js';

const ico = (t, lv = 0) => h('img', { src: iconUrl(t, lv), alt: '', draggable: false });
const gold = (n) => h('span.price', fmt(n), ' g');
const nm = (t, lv) => itemName(t, lv) + (FAMS[t] ? ` (Lv ${lv})` : '');
const btn = (label, fn, cls = '', dis = false, title) => h('button.btn.small' + (cls ? '.' + cls : ''), { type: 'button', onclick: fn, disabled: dis, title }, label);

/** Best price known anywhere for selling this item (from the ledger). */
export function bestKnown(G, t, lv = 0, exclude = null) {
    let best = null;
    const key = keyOf(t, lv);
    for (const [town, k] of Object.entries(G.known)) {
        if (town === exclude) continue;
        const p = k.p[key];
        if (p && p[1] && (!best || p[1] > best.price)) best = { price: p[1], town, age: G.day - k.day };
    }
    return best;
}

// ---------------------------------------------------------------- the wagon column (shared)
function wagonColumn(G, ctx, { sellHere = false, stash = false } = {}) {
    const ps = ctx.ps;
    const W = WAGONS[G.wagon], b = burden(G);
    const filter = FILTERS.find((f) => f.id === ps.filter) || FILTERS[0];
    const q = (ps.search || '').toLowerCase();
    const testItem = (it) => filter.test(it.t) && (!q || itemName(it.t, it.lv).toLowerCase().includes(q));
    const width = Math.min(ctx.panelWidth() - 40, 520);
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const cell = Math.max(coarse ? 44 : 32, Math.min(52, Math.floor((width - 8) / G.inv.w)));
    const sel = itemById(G, ps.sel);
    if (!sel) ps.sel = 0;
    const grid = invGrid(G, {
        cell, selected: ps.sel, filter: filter.id === 'all' && !q ? null : testItem,
        onSelect: (id) => { ps.sel = ps.sel === id ? 0 : id; ctx.rerender(); },
        onMove: (id, x, y, r) => ctx.act({ t: 'move', id, x, y, r }, { quiet: true }),
        onMerge: (from, to) => ctx.act({ t: 'merge', from, to }, { quiet: true }),
    });
    const tabs = h('div.tabs', { role: 'tablist' }, FILTERS.map((f) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': (filter.id === f.id) + '', onclick: () => { ps.filter = f.id; ctx.rerender(); } }, f.name)));
    const wClass = b.r > 1.0 ? (b.r > 1.3 ? 'bad' : 'warn') : '';
    const info = h('div.card', [
        h('div.row', { style: { minHeight: '30px' } }, [h('b', W.name), h('span.muted', `${usedCells(G)}/${G.inv.w * G.inv.h} cells`)]),
        h('div.row', { style: { minHeight: '30px' } }, [h('span', { html: GLYPH.weight }), h('div.meter' + (wClass ? '.' + wClass : ''), { style: { flex: 1 } }, h('i', { style: { width: Math.min(100, b.r * 100) + '%' } })), h('b', `${Math.round(b.w)}/${b.cap}`)]),
        b.over && h('div.muted', b.blocked ? 'Too heavy to move! Sell or stash something.' : `Overloaded: travel takes x${b.mult.toFixed(2)} as long.`),
    ]);
    const tools = h('div.btns', { style: { justifyContent: 'flex-start' } }, [
        btn([h('span', { html: GLYPH.sort }), 'Sort'], () => ctx.act({ t: 'sort' }, { quiet: true }), '', false, 'Repack the wagon'),
        h('input', { type: 'search', placeholder: 'Search...', value: ps.search || '', 'aria-label': 'Search cargo', style: { flex: 1, minWidth: '90px', width: 'auto' }, oninput: (e) => { ps.search = e.target.value; ctx.rerender({ keepFocus: 'search' }); }, dataset: { f: 'search' } }),
    ]);
    const detail = sel ? itemDetail(G, ctx, sel, { sellHere, stash }) : h('div.card.muted', 'Tap an item to see it. Drag to rearrange (R turns it). Drop one stack on another to merge.');
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' } }, [info, tabs, tools, h('div', { style: { overflowX: 'auto', paddingBottom: '2px' } }, grid), detail]);
}

function itemDetail(G, ctx, it, { sellHere, stash }) {
    const d = itemDef(it.t, it.lv);
    const loc = G.loc;
    const shop = M.shopFor(loc, it.t);
    const rows = [];
    rows.push(h('div.row', [h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [h('span.ico', { style: { width: '44px', height: '44px' } }, ico(it.t, it.lv)), h('div', [h('div.nm', { style: { font: '700 17px var(--head)' } }, nm(it.t, it.lv)), h('div.sub.muted', `${d.gear ? 'Gear' : catOf(it.t)} - ${d.w}x${d.h} - ${d.wt} wt - stacks ${d.stack}`)])]), h('b', 'x' + it.n)]));
    if (d.price) {
        const bk = bestKnown(G, it.t, it.lv, loc);
        const here = shop ? M.quote(G, loc, it.t, it.lv, 'sell', 1).unit : 0;
        rows.push(h('div.sub', [`Base value ${fmt(d.price)}g. `, shop ? h('b', `Here: ${fmt(here)}g each (${SHOP_DEFS[shop].name}). `) : 'No shop here buys it. ', bk ? `Best known elsewhere: ${fmt(bk.price)}g in ${TOWN[bk.town].name}.` : '']));
    }
    const acts = [];
    if (it.t !== 'parcel') {
        if (shop && sellHere) {
            acts.push(btn('Sell 1', () => ctx.act({ t: 'sell', id: it.id, n: 1 }), 'primary', it.fav));
            if (it.n > 1) acts.push(btn(`Sell ${it.n}`, () => ctx.act({ t: 'sell', id: it.id, n: 'all' }), 'primary', it.fav));
        }
        acts.push(btn([h('span', { html: GLYPH.fav }), it.fav ? 'Unfavourite' : 'Favourite'], () => ctx.act({ t: 'mark', id: it.id, fav: !it.fav }, { quiet: true }), '', false, 'Protected from selling'));
        acts.push(btn([h('span', { html: GLYPH.junk }), it.junk ? 'Not junk' : 'Junk'], () => ctx.act({ t: 'mark', id: it.id, junk: !it.junk }, { quiet: true }), '', false, 'Sold in bulk with Sell Junk'));
        if (d.w !== d.h) acts.push(btn([h('span', { html: GLYPH.rotate }), 'Turn'], () => rotate(G, ctx, it), '', false, 'Rotate (R while dragging)'));
        if (stash && TOWN[loc].guild) acts.push(btn('Store in vault', () => ctx.act({ t: 'stash', id: it.id, n: 'all' }), ''));
    }
    rows.push(h('div.btns', { style: { justifyContent: 'flex-start' } }, acts));
    return h('div.card', rows);
}
function rotate(G, ctx, it) {
    const r = it.r ? 0 : 1;
    // keep the corner if it fits, else try every cell
    for (let y = 0; y < G.inv.h; y++) for (let x = 0; x < G.inv.w; x++) {
        const px = x, py = y;
        if (px === it.x && py === it.y) { const rr = ctx.act({ t: 'move', id: it.id, x: px, y: py, r }, { quiet: true, silent: true }); if (rr.ok) return; }
    }
    for (let y = 0; y < G.inv.h; y++) for (let x = 0; x < G.inv.w; x++) { const rr = ctx.act({ t: 'move', id: it.id, x, y, r }, { quiet: true, silent: true }); if (rr.ok) return; }
    ctx.toast('No room to turn that.', 'bad');
}

// ---------------------------------------------------------------- market
function marketPanel(G, ctx) {
    const T = TOWN[G.loc], ps = ctx.ps;
    if (!T.shops.includes(ps.shop)) ps.shop = T.shops[0];
    const shop = SHOP_DEFS[ps.shop];
    const tabs = h('div.tabs', { role: 'tablist' }, T.shops.map((s) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': (ps.shop === s) + '', onclick: () => { ps.shop = s; ctx.rerender(); } }, [shopIcon(s), SHOP_DEFS[s].name])));
    // stock list
    const q = (ps.mq || '').toLowerCase();
    const gm = M.gearMax(G.loc);
    const rowsData = [];
    for (const id of Object.keys(MATS)) if (id !== 'parcel' && shop.cats.includes(MATS[id].cat) && M.stockCap(G.loc, id, 0) > 0) rowsData.push({ t: id, lv: 0 });
    for (const f of FAM_IDS) if (shop.cats.includes(f)) for (let lv = Math.max(1, gm - 3); lv <= gm; lv++) if (M.stockCap(G.loc, f, lv) > 0) rowsData.push({ t: f, lv });
    const list = h('div.list', rowsData.filter((r) => !q || itemName(r.t, r.lv).toLowerCase().includes(q)).map((r) => {
        const e = M.entry(G, G.loc, r.t, r.lv);
        const stock = M.stockOf(G, G.loc, r.t, r.lv);
        const unit = M.buyUnit(G, G.loc, r.t, r.lv);
        const ratio = unit / (basePrice(r.t, r.lv) * 1.07);
        const dir = ratio > 1.08 ? 'up' : ratio < 0.92 ? 'down' : '';
        const bk = bestKnown(G, r.t, r.lv, G.loc);
        const q1 = M.quote(G, G.loc, r.t, r.lv, 'buy', 1).total;
        const canBuy = (n) => stock >= 1 && G.gold >= q1;
        return h('div.item-row', [
            h('span.ico', ico(r.t, r.lv)),
            h('div', [h('div.nm', nm(r.t, r.lv)), h('div.sub', [`In stock ${stock}. `, dir === 'down' ? h('span.good', 'Cheap here. ') : dir === 'up' ? h('span.bad', 'Dear here. ') : '', bk ? `Sells for ${fmt(bk.price)}g in ${TOWN[bk.town].name}.` : ''])]),
            h('div', { style: { textAlign: 'right' } }, [h('div.price' + (dir ? '.' + dir : ''), fmt(unit) + ' g'), h('div.btns', [btn('Buy 1', () => ctx.act({ t: 'buy', shop: ps.shop, item: r.t, lv: r.lv, n: 1 }), 'primary', !canBuy()), stock > 1 && btn('Buy 5', () => ctx.act({ t: 'buy', shop: ps.shop, item: r.t, lv: r.lv, n: 5 }), '', !canBuy()), stock > 5 && btn('Max', () => ctx.act({ t: 'buy', shop: ps.shop, item: r.t, lv: r.lv, n: 999 }), '', !canBuy())])]),
        ]);
    }));
    const sellsHere = [];
    const left = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
        tabs,
        h('div.muted', `${shop.name} in ${T.name}. It also buys: ${shop.cats.map((c) => (MATS[c] ? c : FAMS[c]?.name || c)).join(', ')}.`),
        h('input', { type: 'search', placeholder: 'Search the shelves...', value: ps.mq || '', 'aria-label': 'Search shop', oninput: (e) => { ps.mq = e.target.value; ctx.rerender({ keepFocus: 'mq' }); }, dataset: { f: 'mq' } }),
        events(G, G.loc),
        rowsData.length ? list : h('div.card.muted', 'Nothing in stock that this shop sells here. It still buys your goods.'),
    ]);
    const junkN = G.inv.items.filter((i) => i.junk && !i.fav && M.shopFor(G.loc, i.t)).length;
    const right = h('div', [wagonColumn(G, ctx, { sellHere: true }), h('div.btns', { style: { marginTop: '8px' } }, btn(`Sell all junk (${junkN})`, () => ctx.act({ t: 'sellJunk' }), 'danger', !junkN))]);
    return { title: `Market - ${T.name}`, body: h('div.cols', [left, right]) };
}
function shopIcon(s) { return h('span', { html: GLYPH.coin }); }
function events(G, town) {
    const ev = G.towns[town].events.filter((e) => e.until >= G.day);
    if (!ev.length) return null;
    return h('div', ev.map((e) => h('div.card', { style: { background: '#ffeab0' } }, [h('b', M.EVENTS[e.k].name), ` (${e.until - G.day + 1} more days): `, M.EVENTS[e.k].text])));
}

// ---------------------------------------------------------------- wagon panel
function wagonPanel(G, ctx) {
    const T = TOWN[G.loc];
    const cols = [h('div', wagonColumn(G, ctx, { sellHere: M.shopFor(G.loc, 'grain') !== undefined && true, stash: true }))];
    if (T.guild) cols.push(stashCard(G, ctx));
    else cols.push(h('div.card.muted', 'Guild Houses keep a vault where goods wait for you without weighing down the wagon. Find one in Hearthmere, Stonebridge, Saltmarsh Quay, Emberforge, Sunspire, Frostpeak Hold or Aurelion.'));
    return { title: 'Your Wagon', body: h('div.cols.even', cols) };
}
function stashCard(G, ctx) {
    const items = G.stash.items;
    return h('div.card', [
        h('h3', `Guild Vault (${items.length}/${G.stash.cap} slots)`),
        h('div.list', items.length ? items.map((s, i) => h('div.item-row', [h('span.ico', ico(s.t, s.lv)), h('div', [h('div.nm', nm(s.t, s.lv)), h('div.sub', 'x' + s.n)]), h('div.btns', [btn('Take 1', () => ctx.act({ t: 'unstash', idx: i, n: 1 }), ''), s.n > 1 && btn('Take all', () => ctx.act({ t: 'unstash', idx: i, n: 'all' }), 'primary')])])) : h('div.muted', 'Empty. Select an item in the wagon and choose "Store in vault".')),
        stashUpgradeCost(G) ? btn(`Enlarge the vault (+${STASH.step} slots) - ${fmt(stashUpgradeCost(G))}g`, () => ctx.act({ t: 'stashUp' }), '', G.gold < stashUpgradeCost(G)) : h('div.muted', 'The vault is as large as it gets.'),
    ]);
}

// ---------------------------------------------------------------- workshop
function workshopPanel(G, ctx) {
    const T = TOWN[G.loc], ps = ctx.ps;
    const stations = Object.keys(T.stations);
    if (!stations.length) return { title: 'Workshops', body: h('div.card', 'There are no workshops in this town.') };
    if (!stations.includes(ps.station)) ps.station = stations[0];
    const lvS = T.stations[ps.station];
    const fams = FAM_IDS.filter((f) => FAMS[f].station === ps.station);
    const groups = ps.station === 'smithy' ? ['ingot', ...fams] : fams;
    if (!groups.includes(ps.fam)) ps.fam = groups[0];
    const tabs = h('div.tabs', { role: 'tablist' }, stations.map((s) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': (ps.station === s) + '', onclick: () => { ps.station = s; ps.fam = null; ctx.rerender(); } }, `${STATIONS[s].name} (Lv ${T.stations[s]})`)));
    const ftabs = h('div.tabs', { role: 'tablist' }, groups.map((f) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': (ps.fam === f) + '', onclick: () => { ps.fam = f; ctx.rerender(); } }, f === 'ingot' ? 'Smelting' : FAMS[f].name)));
    const recipes = ALL_RECIPES.filter((r) => r.fam === ps.fam && r.station === ps.station);
    const list = h('div.list', recipes.map((r) => {
        const d = itemDef(r.out, r.outLv);
        const stOk = lvS >= r.stationLv, lvOk = G.lv >= r.needLv;
        let maxN = 99;
        const needs = r.inputs.map((i) => { const hv = have(G, i.t, 0); maxN = Math.min(maxN, Math.floor(hv / i.n)); return h('span.need' + (hv >= i.n ? '.ok' : '.no'), [ico(i.t), `${Math.min(hv, 999)}/${i.n} ${MATS[i.t].name}`]); });
        const fee = Math.max(1, Math.round(d.price * 0.05));
        const can = stOk && lvOk && maxN > 0 && G.gold >= fee;
        let why = '';
        if (!stOk) { const t2 = TOWNS.find((x) => (x.stations[r.station] || 0) >= r.stationLv); why = `Needs a level ${r.stationLv} ${STATIONS[r.station].name.toLowerCase()}${t2 ? ` (try ${t2.name})` : ''}.`; }
        else if (!lvOk) why = `Needs merchant level ${r.needLv}.`;
        return h('div.item-row' + (can ? '.sel' : ''), { style: { gridTemplateColumns: '44px 1fr auto', opacity: stOk && lvOk ? 1 : 0.65 } }, [
            h('span.ico', ico(r.out, r.outLv)),
            h('div', [h('div.nm', d.name + (FAMS[r.out] ? ` (Lv ${r.outLv})` : '')), h('div', needs), h('div.sub', why || `Worth about ${fmt(d.price)}g. Fee ${fmt(fee)}g.`)]),
            h('div.btns', { style: { flexDirection: 'column', alignItems: 'flex-end' } }, [btn('Craft', () => ctx.act({ t: 'craft', rid: r.rid, n: 1 }), 'primary', !can), maxN > 1 && can && btn(`x${Math.min(maxN, 99)}`, () => ctx.act({ t: 'craft', rid: r.rid, n: maxN }), '')]),
        ]);
    }));
    const body = h('div.cols.even', [h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [tabs, ftabs, h('div.muted', `Workshop level ${lvS}. You are merchant level ${G.lv}. Ingredients come from your wagon${inGuildTown(G) ? ' and the vault' : ''}.`), list]), h('div', wagonColumn(G, ctx, {}))]);
    return { title: `Workshops - ${T.name}`, body };
}

// ---------------------------------------------------------------- quests
function reqChips(G, q) {
    return reqProgress(G, q).map((r) => h('span.need' + (r.have >= r.n ? '.ok' : '.no'), [r.t === 'parcel' ? ico('parcel') : ico(r.t, r.lv || 1), r.t === 'parcel' ? r.label : `${r.have}/${r.n} ${FAMS[r.t] ? FAMS[r.t].name + ' Lv ' + r.lv + '+' : MATS[r.t].name}`]));
}
function questCard(G, ctx, q, state) {
    const rw = q.reward;
    const where = q.turn !== q.town ? `Hand in at ${TOWN[q.turn].name}.` : '';
    const dl = q.gen ? `Due by day ${q.deadline} (${Math.max(0, q.deadline - G.day)} days).` : '';
    const acts = [];
    if (state === 'available') acts.push(btn('Accept', () => ctx.act({ t: 'accept', id: q.id }), 'primary'));
    if (state === 'active' || state === 'ready') {
        acts.push(btn('Hand in', () => ctx.act({ t: 'turnin', id: q.id }), 'primary', !questReady(G, q)));
        if (!q.story) acts.push(btn('Abandon', () => ctx.act({ t: 'abandon', id: q.id }), 'danger'));
    }
    return h('div.quest' + (q.story ? '.story' : '') + (state === 'ready' ? '.ready' : ''), [
        h('h4', [q.title, ' ', q.story && h('span.pill', 'Hero'), state === 'active' && h('span.pill', 'Active'), state === 'ready' && h('span.pill', 'Ready')]),
        h('div.sub.muted', `From ${q.giver}, ${TOWN[q.town].name}. ${where} ${dl}`),
        h('p', q.text),
        q.req.length || q.kind === 'courier' ? h('div', reqChips(G, q)) : null,
        h('div.row', { style: { minHeight: '40px' } }, [h('span', ['Reward: ', h('b', fmt(rw.gold) + ' g'), `, ${fmt(rw.xp)} xp`]), h('div.btns', acts)]),
    ]);
}
function boardPanel(G, ctx) {
    const T = TOWN[G.loc];
    const all = questsAt(G, G.loc).filter((x) => !x.q.story);
    const active = all.filter((x) => x.state === 'active' || x.state === 'ready');
    const avail = all.filter((x) => x.state === 'available');
    const locked = all.filter((x) => x.state === 'locked' && !x.q.after);
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        active.length ? h('h3', 'In progress here') : null, ...active.map((x) => questCard(G, ctx, x.q, x.state)),
        h('h3', 'Open requests'), ...(avail.length ? avail.map((x) => questCard(G, ctx, x.q, x.state)) : [h('div.card.muted', 'Nothing new on the board. A fresh batch is pinned every week.')]),
        locked.length ? h('div.card.muted', `${locked.length} more request${locked.length > 1 ? 's' : ''} here ask for a higher merchant level (${Math.min(...locked.map((x) => x.q.lv))}+).`) : null,
    ]);
    return { title: `Notice Board - ${T.name}`, body };
}
function journalPanel(G, ctx) {
    const act = Object.keys(G.q.active).map((id) => questDef(G, id)).filter(Boolean);
    const story = act.filter((q) => q.story), side = act.filter((q) => !q.story);
    const nid = nextStoryId(G);
    const chain = h('div.card', [h('h3', 'The Hero\'s road'), h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, STORY_ORDER.map((id) => { const q = QUESTS[id]; const st = G.q.done[id] ? 'Done' : G.q.active[id] ? 'Active' : G.lv >= q.lv ? 'Open' : `Lv ${q.lv}`; return h('span.pill', { style: { background: G.q.done[id] ? '#c8eea0' : G.q.active[id] ? '#ffe48a' : '' }, title: q.title }, `${q.title.slice(0, 22)}: ${st}`); })), nid && h('div.sub.muted', { style: { marginTop: '6px' } }, `Next: "${QUESTS[nid].title}" in ${TOWN[QUESTS[nid].town].name}, merchant level ${QUESTS[nid].lv}.`)]);
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [chain, h('h3', `Active quests (${act.length})`), ...(act.length ? [...story, ...side].map((q) => questCard(G, ctx, q, questReady(G, q) ? 'ready' : 'active')) : [h('div.card.muted', 'No active quests. Visit a notice board or talk to the townsfolk.')]), h('div.muted', `${G.stats.quests} quests completed.`)]);
    return { title: 'Journal', body };
}

// ---------------------------------------------------------------- inn: heroes and rest
function innPanel(G, ctx) {
    const T = TOWN[G.loc];
    const heroes = G.towns[T.id].heroes.filter((x) => x.wants.some((w) => !w.done));
    const cards = heroes.map((hr) => h('div.card', [
        h('div.row', { style: { minHeight: '34px' } }, [h('h3', { style: { margin: 0 } }, `${hr.name}`), h('span.pill', { style: { background: HERO_CLASSES[hr.cls].color } }, HERO_CLASSES[hr.cls].name)]),
        h('div.sub.muted', `Leaves in ${Math.max(0, hr.until - G.day + 1)} days. Pays about x${hr.mult.toFixed(1)} the market price.`),
        ...hr.wants.map((w, i) => {
            const cand = G.inv.items.filter((x) => x.t === w.fam && x.lv >= w.minLv && !x.fav).sort((a, b) => a.lv - b.lv)[0];
            const offer = cand ? heroOffer(hr, w, cand.lv) : heroOffer(hr, w, w.minLv);
            return h('div.item-row', { style: { opacity: w.done ? 0.5 : 1 } }, [h('span.ico', ico(w.fam, w.minLv)), h('div', [h('div.nm', `${FAMS[w.fam].name}, level ${w.minLv}+`), h('div.sub', w.done ? 'Delivered.' : cand ? `You have ${nm(cand.t, cand.lv)}.` : 'You have nothing that qualifies.')]), h('div', { style: { textAlign: 'right' } }, [h('div.price', (cand ? '' : '~') + fmt(offer) + ' g'), !w.done && btn('Sell', () => ctx.act({ t: 'hero', hid: hr.id, w: i }), 'primary', !cand)])]);
        }),
    ]));
    const body = h('div.cols.even', [
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [h('h3', 'Heroes at the inn'), ...(cards.length ? cards : [h('div.card.muted', 'No adventurers are in town right now. Heroes come and go every few days, and each pays well for gear they need.')])]),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
            h('div.card', [h('h3', 'A bed for the night'), h('p', 'Rest a night: a day passes, prices drift, new heroes arrive and the notice board may change.'), btn('Rest (6 g)', () => ctx.act({ t: 'rest' }), 'primary', G.gold < 6)]),
            events(G, G.loc) || h('div.card.muted', 'No news in the taproom today.'),
            h('div.card', [h('h3', 'Region'), h('div.sub', `${REGIONS[T.region].name}: ${REGIONS[T.region].blurb}`), h('div.sub.muted', T.blurb)]),
        ]),
    ]);
    return { title: `Inn & Heroes - ${T.name}`, body };
}

// ---------------------------------------------------------------- guild house
function guildPanel(G, ctx) {
    const T = TOWN[G.loc];
    const W = WAGONS[G.wagon], nx = WAGONS[G.wagon + 1];
    const wagonCard = h('div.card', [
        h('h3', 'Wainwright'),
        h('div.row', [h('span', [h('b', W.name), ` - ${W.w}x${W.h} cells, carries ${W.cap}`]), h('span.muted', `Guard ${W.guard}`)]),
        nx ? h('div', [h('div.sub', `Next: ${nx.name} - ${nx.w}x${nx.h} cells, carries ${nx.cap}, safer roads. Needs merchant level ${nx.lv}.`), btn(`Buy the ${nx.name} - ${fmt(nx.cost)}g`, () => ctx.act({ t: 'upgradeWagon' }), 'primary', G.lv < nx.lv || G.gold < nx.cost)]) : h('div.sub.muted', 'You drive the finest wagon in the realm.'),
    ]);
    const title = h('div.card', [h('h3', 'Merchants\' Guild'), h('div.sub', `Rank: ${MERCHANT_TITLES[G.lv]} (level ${G.lv}). Guild Houses are open to every member in good standing.`), h('div.sub.muted', `Next region opens at level ${[...REGION_LEVEL].find((l) => l > G.lv) ?? 'never'}.`)]);
    return { title: `Guild House - ${T.name}`, body: h('div.cols.even', [h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [title, wagonCard, stashCard(G, ctx)]), h('div', wagonColumn(G, ctx, { stash: true }))]) };
}

// ---------------------------------------------------------------- the Hero's tent (story + the Offer)
function heroPanel(G, ctx) {
    const T = TOWN[G.loc];
    const ps = ctx.ps;
    const story = questsAt(G, G.loc).filter((x) => x.q.story && x.state !== 'locked');
    const nodes = [];
    nodes.push(h('div.card', { style: { background: 'linear-gradient(#fff4c0,#f4d878)' } }, [h('h3', `${HERO.name}, ${HERO.title}`), h('div.sub', 'He leans on his sword and listens. Every road he has walked has led to this camp.')]));
    for (const x of story) nodes.push(questCard(G, ctx, x.q, x.state));
    if (!story.length) nodes.push(h('div.card.muted', 'Kaelen nods to you. He has nothing to ask right now. Come back as your reputation grows.'));
    // the Offer
    if (G.loc === 'aurelion' && G.heroCall) {
        if (G.ending) nodes.push(h('div.card', 'You made your Offer. The Dawn Camp has broken.'));
        else nodes.push(offerCard(G, ctx));
    }
    if (G.heroCall && !G.ending) nodes.push(h('div.card', { style: { background: '#ffeab0' } }, `The Eclipse falls on day ${ECLIPSE_DAY}. Today is day ${G.day}: ${Math.max(0, ECLIPSE_DAY - G.day)} days remain.`));
    return { title: `The Hero's Tent - ${T.name}`, body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, nodes) };
}
function offerCard(G, ctx) {
    const ps = ctx.ps;
    ps.offer ||= {};
    const opts = offerOptions(G);
    let total = 0;
    const slots = SLOT_ORDER.map((s) => {
        const lvs = opts[s];
        if (!(ps.offer[s] > 0) && lvs.length) ps.offer[s] = lvs[0];
        if (ps.offer[s] && !lvs.includes(ps.offer[s])) ps.offer[s] = lvs[0] || 0;
        const cur = ps.offer[s] || 0;
        total += cur;
        return h('div.kit-slot', [cur ? ico(s, cur) : ico(s, 1), h('b', FAMS[s].slot), h('select', { 'aria-label': FAMS[s].slot, onchange: (e) => { ps.offer[s] = +e.target.value; ctx.rerender(); } }, [h('option', { value: 0, selected: !cur }, '- nothing -'), ...lvs.map((l) => h('option', { value: l, selected: l === cur }, `${itemName(s, l)} (Lv ${l})`))])]);
    });
    const rank = rankFor(total);
    return h('div.card', [
        h('h3', 'Make your Offer'),
        h('p', 'Choose one piece for each of the ten slots. The Hero rates your gift by item level: ten level 10 pieces is a perfect 100. The Offer is final.'),
        h('div.kit-grid', slots),
        h('div.row', [h('span', ['Score ', h('b', `${total}/100`), ` - ${rank.title}`]), btn('Make the Offer', () => ctx.confirm('Make the Offer?', `You will give ${Object.values(ps.offer).filter((v) => v > 0).length} pieces to the Hero for a score of ${total}/100 (${rank.title}). This cannot be undone.`, () => ctx.act({ t: 'offer', picks: { ...ps.offer } })), 'primary')]),
    ]);
}

// ---------------------------------------------------------------- ledger: prices and routes
function ledgerPanel(G, ctx) {
    const ps = ctx.ps;
    ps.lt ||= 'routes';
    const tabs = h('div.tabs', { role: 'tablist' }, [['routes', 'Trade routes'], ['prices', 'Price book'], ['stats', 'Ledger']].map(([id, n]) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': (ps.lt === id) + '', onclick: () => { ps.lt = id; ctx.rerender(); } }, n)));
    let content;
    if (ps.lt === 'routes') {
        const routes = [];
        for (const t of Object.keys(MATS)) {
            if (t === 'parcel') continue;
            let buy = null, sell = null;
            for (const [town, k] of Object.entries(G.known)) {
                const p = k.p[t];
                if (!p) continue;
                if (p[0] && (!buy || p[0] < buy.p)) buy = { town, p: p[0], age: G.day - k.day };
                if (p[1] && (!sell || p[1] > sell.p)) sell = { town, p: p[1], age: G.day - k.day };
            }
            if (buy && sell && buy.town !== sell.town && sell.p > buy.p * 1.15) routes.push({ t, buy, sell, r: sell.p / buy.p });
        }
        routes.sort((a, b) => (b.sell.p - b.buy.p) * Math.min(1, 40 / b.buy.p) - (a.sell.p - a.buy.p) * Math.min(1, 40 / a.buy.p));
        content = h('div.list', routes.length ? routes.slice(0, 14).map((r) => h('div.item-row', [h('span.ico', ico(r.t)), h('div', [h('div.nm', MATS[r.t].name), h('div.sub', `Buy at ${TOWN[r.buy.town].name} for ${fmt(r.buy.p)}g (${r.buy.age}d old), sell at ${TOWN[r.sell.town].name} for ${fmt(r.sell.p)}g (${r.sell.age}d old).`)]), h('b.good', `+${Math.round((r.r - 1) * 100)}%`)])) : [h('div.card.muted', 'Visit a few towns to learn their prices. Routes appear here as you explore.')]);
    } else if (ps.lt === 'prices') {
        const ids = [...Object.keys(MATS).filter((x) => x !== 'parcel'), ...FAM_IDS.flatMap((f) => [3, 5, 7, 9].map((l) => `${f}:${l}`))];
        ps.pi ||= 'grain';
        const sel = h('select', { 'aria-label': 'Item', onchange: (e) => { ps.pi = e.target.value; ctx.rerender(); }, style: { font: '600 15px var(--head)', padding: '8px', border: '3px solid var(--ink)', borderRadius: '10px', minHeight: '40px' } }, ids.map((id) => { const [t, l] = id.split(':'); return h('option', { value: id, selected: id === ps.pi }, itemName(t, +l || 0) + (l ? ` (Lv ${l})` : '')); }));
        const rows = Object.entries(G.known).map(([town, k]) => ({ town, p: k.p[ps.pi], age: G.day - k.day })).filter((r) => r.p).sort((a, b) => b.p[1] - a.p[1]);
        content = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [sel, h('div.list', rows.length ? rows.map((r) => h('div.item-row', { style: { gridTemplateColumns: '1fr auto auto' } }, [h('div', [h('div.nm', TOWN[r.town].name), h('div.sub', `${r.age} days ago`)]), h('div', [h('div.sub', 'Buy'), h('b', r.p[0] ? fmt(r.p[0]) + ' g' : '-')]), h('div', [h('div.sub', 'Sell'), h('b', r.p[1] ? fmt(r.p[1]) + ' g' : '-')])])) : [h('div.card.muted', 'No town you have visited trades this.')])]);
    } else {
        const s = G.stats;
        const lines = [['Merchant level', `${G.lv} (${MERCHANT_TITLES[G.lv]})`], ['Experience', `${fmt(G.xp)} / ${G.lv >= MAX_LEVEL ? 'max' : fmt(levelXp(G.lv + 1))}`], ['Day', `${G.day} (Eclipse on day ${ECLIPSE_DAY})`], ['Gold', fmt(G.gold)], ['Total earned', fmt(s.earned)], ['Total spent', fmt(s.spent)], ['Quest gold', fmt(s.questGold)], ['Quests done', s.quests], ['Hero sales', `${s.heroes} (${fmt(s.heroGold)} g)`], ['Items crafted', s.crafted], ['Units sold / bought', `${s.sold} / ${s.bought}`], ['Days on the road', s.travelDays], ['Towns visited', `${s.visited} / ${TOWNS.length}`], ['Road events', s.roadEvents]];
        content = h('div', lines.map(([a, b]) => h('div.stat', [h('span', a), h('b', String(b))])));
    }
    return { title: 'Merchant\'s Ledger', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [tabs, content]) };
}

export const PANELS = { market: marketPanel, wagon: wagonPanel, workshop: workshopPanel, board: boardPanel, quests: journalPanel, inn: innPanel, guild: guildPanel, hero: heroPanel, ledger: ledgerPanel };
export { questCard };
