/**
 * wilds-ui.js — the Wilds tab (whispers, expeditions and relics, the garden,
 * the peddler) and the Journal's Badges and Codex pages.
 *
 * Same pattern as ui.js: a list is rebuilt only when its key changes, and
 * timers and buttons are patched in place in between, so a tap never lands
 * on an element that was just replaced. Clicks are delegated and go through
 * `act` (main.js); the UI never changes the simulation's state itself.
 */

import { GENERATORS, WISP_KINDS } from '../sim/data.js';
import {
    KIN_MAX, KIN_BONUS, kinCost, EXP_SITES, EXP_SITE_BY_ID, EXP_TIMES, RELICS, RELIC_BY_ID, RELIC_SETS, HERBS, HERB_BY_ID,
    WHISPER_BY_ID, WHISPER_REROLL, SHOP, BADGES, BADGE_TIERS, TITLES, TITLE_BY_ID, DEFAULT_TITLE, CODEX, CODEX_LEVELS,
} from '../sim/wilds-data.js';
import { fmt, fmtTime } from './format.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const amberTxt = (n) => `🟠 ${fmt(Math.floor(n + 1e-9))}`;

let G = null, act = null;
let view = 'whispers';
let selHerb = 'moonpetal';
let selRelic = null;
const keys = {};

export function initWilds(grove, actions) {
    G = grove; act = actions;
    $('wilds-seg').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        view = b.dataset.w; act.ui();
        document.querySelectorAll('#wilds-seg button').forEach((x) => x.classList.toggle('on', x === b));
        resetWilds(); refreshWilds();
    });
    const body = $('wilds-body');
    body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
        const a = t.dataset.a, v = t.dataset.v;
        if (a === 'claimW') act.claimWhisper(Number(v));
        else if (a === 'rerollW') act.rerollWhisper(Number(v));
        else if (a === 'send') { const [site, ti] = v.split(':'); act.sendExpedition(site, Number(ti)); }
        else if (a === 'claimE') act.claimExpedition(Number(v));
        else if (a === 'claimAllE') act.claimAllExpeditions();
        else if (a === 'herb') { selHerb = v; act.ui(); keys.pouch = null; }
        else if (a === 'plot') act.plot(Number(v), selHerb);
        else if (a === 'harvestAll') act.harvestAll();
        else if (a === 'plantAll') act.plantAll(selHerb);
        else if (a === 'relic') { selRelic = v; act.ui(); keys.relics = null; }
        else if (a === 'shop') act.buyShop(v);
        refreshWilds();
    });
}
export function setWildsGrove(grove) { G = grove; resetWilds(); }
export function resetWilds() { for (const k in keys) delete keys[k]; }

/** Things waiting for the player in the Wilds (the tab's badge). */
export function wildsWaiting() {
    if (!G.wildsOpen()) return 0;
    const s = G.s;
    return s.exps.filter((p) => s.t >= p.end).length + s.garden.filter((p) => p && s.t >= p.end).length
        + s.quests.filter((q) => G.whisperProgress(q) >= q.n).length;
}

// ------------------------------------------------------------------ the Wilds tab
export function refreshWilds() {
    const open = G.wildsOpen();
    $('wilds-closed').hidden = open;
    $('wilds-body').hidden = !open;
    $('wilds-seg').hidden = !open;
    $('amber-have').textContent = amberTxt(G.s.amber);
    if (!open) return;
    const counts = { whispers: G.s.quests.filter((q) => G.whisperProgress(q) >= q.n).length,
        travel: G.s.exps.filter((p) => G.s.t >= p.end).length, garden: G.s.garden.filter((p) => p && G.s.t >= p.end).length };
    document.querySelectorAll('#wilds-seg button').forEach((b) => { const n = counts[b.dataset.w]; b.dataset.n = n ? String(n) : ''; });
    if (view === 'whispers') whispers();
    else if (view === 'travel') travel();
    else if (view === 'garden') garden();
    else peddler();
}

function whisperText(q) {
    const w = WHISPER_BY_ID[q.id];
    return q.id === 'motes' ? `Gather ${fmt(q.n)} motes` : w.text(q.n);
}
function whispers() {
    const s = G.s, body = $('wilds-body');
    const key = `wh|${s.quests.map((q) => `${q.id}${q.n}`).join()}|${G.whisperSlots()}`;
    if (keys.view !== key) {
        keys.view = key;
        body.innerHTML = `<div class="card small dim">The grove whispers small wishes. Grant them for amber; a new one comes as soon as you claim.</div>
            <div class="list">${s.quests.map((q, i) => `<div class="row whisper" data-q="${i}"><div class="r-ico">👂</div>
                <div><div class="r-name">${esc(whisperText(q))}</div><div class="r-desc"><span class="wp"></span> · reward ${amberTxt(q.amber)}</div>
                <div class="bar"><i></i></div></div>
                <div class="btn-col"><button class="r-btn" data-a="claimW" data-v="${i}">Claim</button><button class="mini-btn" data-a="rerollW" data-v="${i}" title="Ask for a different whisper">↻ ${WHISPER_REROLL} 🟠</button></div></div>`).join('')}</div>`;
    }
    s.quests.forEach((q, i) => {
        const row = body.querySelector(`[data-q="${i}"]`); if (!row) return;
        const p = G.whisperProgress(q);
        row.querySelector('.wp').textContent = q.id === 'tend' ? `${Math.floor(p / 60)} / ${Math.round(q.n / 60)} min` : `${fmt(p)} / ${fmt(q.n)}`;
        row.querySelector('.bar i').style.width = `${(p / q.n) * 100}%`;
        row.classList.toggle('done', p >= q.n);
        row.querySelector('[data-a="claimW"]').disabled = p < q.n;
        row.querySelector('[data-a="rerollW"]').disabled = s.amber < WHISPER_REROLL;
    });
}

function travel() {
    const s = G.s, body = $('wilds-body');
    const key = `tr|${s.exps.map((p) => `${p.site}${p.ti}${p.start}`).join()}|${G.expSlots()}|${s.bestStage}|${G.relicCount()}|${selRelic}`;
    if (keys.view !== key) {
        keys.view = key;
        const parties = s.exps.map((p, i) => {
            const x = EXP_SITE_BY_ID[p.site];
            return `<div class="row party" data-p="${i}"><div class="r-ico">${x.icon}</div>
                <div><div class="r-name">${esc(x.name)} <span class="dim small">· ${esc(EXP_TIMES[p.ti].name.toLowerCase())}</span></div>
                <div class="r-desc pt"></div><div class="bar"><i></i></div></div>
                <button class="r-btn" data-a="claimE" data-v="${i}">Welcome home</button></div>`;
        }).join('');
        const free = G.expSlots() - s.exps.length;
        const sites = EXP_SITES.map((x) => {
            const openSite = G.siteOpen(x.id);
            const found = RELICS.filter((r) => r.site === x.id && s.relics[r.id]).length;
            return `<div class="site ${openSite ? '' : 'locked'}"><div class="site-head"><span class="r-ico">${openSite ? x.icon : '❔'}</span>
                <div><div class="r-name">${openSite ? esc(x.name) : '???'}</div><div class="r-desc">${openSite ? `${esc(x.desc)} <span class="mint">Relics ${found}/6</span>` : `Found when the tree first reaches stage ${x.stage}.`}</div></div></div>
                ${openSite ? `<div class="seg send">${EXP_TIMES.map((T, ti) => `<button data-a="send" data-v="${x.id}:${ti}" ${free > 0 ? '' : 'disabled'} title="${esc(T.name)}: about ${amberTxt(T.amber * x.amber)}, ${Math.round(T.relic * 100)}% chance of a relic">${fmtTime(G.expDuration(ti)).replace(' 00m', '').replace(' 00s', '')}</button>`).join('')}</div>` : ''}</div>`;
        }).join('');
        body.innerHTML = `<div class="card small dim">Send a party of spirits into the Deepwood. They travel while you are away and come home with amber, a satchel of light, and often a relic. Longer trips find more.</div>
            <h3 class="sub">Out in the wood <span class="dim">${s.exps.length} / ${G.expSlots()}</span></h3>
            <div class="list">${parties || '<div class="empty">Nobody is out. Choose a place and how long to go.</div>'}</div>
            ${s.exps.length > 1 ? '<div class="btn-row"><button class="small-btn" data-a="claimAllE" id="btn-claim-all">Welcome everyone home</button></div>' : ''}
            <h3 class="sub">Set out <span class="dim">${free > 0 ? `${free} part${free > 1 ? 'ies' : 'y'} ready` : 'every party is out'}</span></h3>
            <div class="list">${sites}</div>
            <h3 class="sub">Relics <span class="dim">${G.relicCount()} / ${RELICS.length}</span></h3>
            ${relicGrid()}`;
    }
    s.exps.forEach((p, i) => {
        const row = body.querySelector(`[data-p="${i}"]`); if (!row) return;
        const done = s.t >= p.end;
        row.querySelector('.pt').textContent = done ? 'Home, with a satchel full of light.' : `Back in ${fmtTime(p.end - s.t)}`;
        row.querySelector('.bar i').style.width = `${Math.min(1, (s.t - p.start) / (p.end - p.start)) * 100}%`;
        row.classList.toggle('done', done);
        row.querySelector('[data-a="claimE"]').disabled = !done;
    });
    const all = body.querySelector('#btn-claim-all');
    if (all) all.disabled = !s.exps.some((p) => s.t >= p.end);
}

function relicGrid() {
    const s = G.s;
    const sel = selRelic && RELIC_BY_ID[selRelic];
    const sets = G.relicSets();
    const detail = sel && s.relics[sel.id]
        ? `<b class="gold">${sel.icon} ${esc(sel.name)}</b> <span class="dim small">· ${esc(EXP_SITE_BY_ID[sel.site].name)}${s.relics[sel.id] > 1 ? ` · found ${s.relics[sel.id]}×` : ''}</span><br><span class="mint small">${esc(sel.text)}</span><br><span class="small lore-i">${esc(sel.lore)}</span>`
        : sel ? `<b>An unknown relic</b><br><span class="small dim">Somewhere in ${esc(EXP_SITE_BY_ID[sel.site].name)}.</span>`
            : '<span class="small dim">Tap a relic to read about it. A relic found twice turns into amber. Find all six from one place for a set blessing.</span>';
    return `<div class="card" id="relic-detail">${detail}</div>
        ${RELIC_SETS.map((st) => `<div class="relic-set"><div class="small ${sets.includes(st.site) ? 'gold' : 'dim'}">${EXP_SITE_BY_ID[st.site].icon} ${esc(EXP_SITE_BY_ID[st.site].name)} · <b>${esc(st.name)}</b>: ${esc(st.text)} ${sets.includes(st.site) ? '✓' : ''}</div>
            <div class="relic-row">${RELICS.filter((r) => r.site === st.site).map((r) => `<button class="relic ${s.relics[r.id] ? 'got' : ''} ${selRelic === r.id ? 'sel' : ''}" data-a="relic" data-v="${r.id}" title="${s.relics[r.id] ? esc(r.name) : '?'}">${s.relics[r.id] ? r.icon : '❔'}</button>`).join('')}</div></div>`).join('')}`;
}

function garden() {
    const s = G.s, body = $('wilds-body');
    G.fitGarden();
    if (!G.herbOpen(selHerb)) selHerb = HERBS.filter((h) => G.herbOpen(h.id)).pop()?.id || 'moonpetal';
    const openHerbs = HERBS.filter((h) => G.herbOpen(h.id)).map((h) => h.id).join();
    const key = `gd|${s.garden.map((p) => (p ? `${p.herb}${p.start}` : '-')).join()}|${openHerbs}|${selHerb}`;
    if (keys.view !== key) {
        keys.view = key;
        const h = HERB_BY_ID[selHerb];
        body.innerHTML = `<div class="card small dim">Choose a seed, then tap an empty bed to plant it. Herbs grow while you are away and wait to be picked. Now and then one comes up <span class="gold">glimmering</span>: twice the gift.</div>
            <div class="pouch">${HERBS.map((x) => {
                const open = G.herbOpen(x.id);
                return `<button class="seed ${selHerb === x.id ? 'on' : ''}" data-a="herb" data-v="${x.id}" ${open ? '' : 'disabled'} title="${open ? esc(x.name) : `Harvest ${x.harvests} herbs${x.stage > 1 ? ` and grow a stage ${x.stage} tree` : ''}`}">${open ? x.icon : '🔒'}</button>`;
            }).join('')}</div>
            <div class="card seed-card"><b>${h.icon} ${esc(h.name)}</b> <span class="dim small">· ${fmtTime(G.herbTime(h.id))} · ${amberTxt(h.amber)}</span><br><span class="mint small">${esc(h.text)}</span> <span class="small lore-i">${esc(h.lore)}</span></div>
            <div class="garden">${s.garden.slice(0, G.gardenPlots()).map((p, i) => `<button class="plot" data-a="plot" data-v="${i}">
                <span class="p-ico">${p ? HERB_BY_ID[p.herb].icon : '🟫'}</span><span class="p-txt"></span><i class="p-bar"></i></button>`).join('')}</div>
            <div class="btn-row"><button class="small-btn" data-a="harvestAll" id="btn-harvest-all">Harvest everything ripe</button><button class="small-btn" data-a="plantAll" id="btn-plant-all">Plant ${esc(h.name)} in every empty bed</button></div>
            <h3 class="sub">Herbarium</h3>
            <div class="herbarium">${HERBS.map((x) => `<div class="herb-entry ${s.herbs[x.id] ? '' : 'dim'}"><span>${s.herbs[x.id] ? x.icon : '❔'}</span><span class="small">${s.herbs[x.id] ? esc(x.name) : '???'}</span><span class="small gold">${s.herbs[x.id] ? `×${fmt(s.herbs[x.id])}` : ''}${s.herbGlim[x.id] ? ' 🌟' : ''}</span></div>`).join('')}</div>`;
    }
    body.querySelectorAll('.plot').forEach((el) => {
        const i = Number(el.dataset.v), p = s.garden[i];
        const ripe = p && s.t >= p.end;
        el.classList.toggle('ripe', !!ripe);
        el.classList.toggle('bare', !p);
        el.querySelector('.p-txt').textContent = !p ? 'Plant' : ripe ? 'Harvest!' : fmtTime(p.end - s.t);
        el.querySelector('.p-bar').style.width = p ? `${Math.min(1, (s.t - p.start) / (p.end - p.start)) * 100}%` : '0%';
        el.disabled = !!p && !ripe;
    });
    const hb = body.querySelector('#btn-harvest-all'); if (hb) hb.disabled = !s.garden.some((p) => p && s.t >= p.end);
    const pb = body.querySelector('#btn-plant-all'); if (pb) pb.disabled = !s.garden.slice(0, G.gardenPlots()).some((p) => !p);
}

function peddler() {
    const s = G.s, body = $('wilds-body');
    const key = `pd|${SHOP.map((x) => G.shopLevel(x.id)).join()}|${s.spark}|${s.buffs.some((b) => b.id === 'bottle')}`;
    if (keys.view !== key) {
        keys.view = key;
        const row = (x) => {
            const l = G.shopLevel(x.id);
            const maxed = x.kind === 'up' && l >= x.max;
            const owned = x.kind === 'look' && l;
            const label = maxed ? '✓' : owned ? (s.spark === x.id ? 'Wearing' : 'Wear') : `🟠 ${fmt(G.shopCost(x.id))}`;
            return `<div class="row ${maxed ? 'done' : ''}"><div class="r-ico">${x.icon}</div>
                <div><div class="r-name">${esc(x.name)} ${x.kind === 'up' && x.max > 1 ? `<span class="dim small">${l}/${x.max}</span>` : ''}</div><div class="r-desc">${esc(x.text)}</div></div>
                <button class="r-btn" data-a="shop" data-v="${x.id}">${label}</button></div>`;
        };
        body.innerHTML = `<div class="card small dim">Mab the moth peddler trades in lantern-light. Amber comes from whispers, expeditions, the garden and feats.</div>
            <div class="list">${SHOP.filter((x) => x.kind !== 'look').map(row).join('')}</div>
            <h3 class="sub">Spark colours</h3>
            <div class="list">${SHOP.filter((x) => x.kind === 'look').map(row).join('')}</div>`;
    }
    // an owned spark colour is always tappable: wear it, or tap again to take it off
    body.querySelectorAll('[data-a="shop"]').forEach((el) => { el.disabled = !G.canBuyShop(el.dataset.v); });
}

// ------------------------------------------------------------------ journal: badges and titles
export function badgesView(body) {
    const s = G.s, k = G.wildKeys();
    const key = `bd|${BADGES.map((b) => s.badges[b.id] | 0).join()}|${s.title}`;
    if (keys.badges !== key) {
        keys.badges = key;
        const titles = [[null, DEFAULT_TITLE], ...TITLES.filter((t) => G.titleOpen(t[0])).map((t) => [t[0], t[1]])];
        body.innerHTML = `<div class="card small">Badges mark everything you do in the grove, in four tiers: <span class="tier t1">Bronze</span> <span class="tier t2">Silver</span> <span class="tier t3">Gold</span> <span class="tier t4">Starlit</span>. Gold and starlit badges each grant a title to wear.</div>
            <div class="badge-grid">${BADGES.map((b) => {
                const t = s.badges[b.id] | 0;
                return `<div class="medal t${t}" data-b="${b.id}"><div class="m-ico">${b.icon}</div><div class="m-name">${esc(b.name)}</div>
                    <div class="m-tier">${t ? BADGE_TIERS[t - 1] : 'Not yet'}</div><div class="m-next small dim"></div><div class="bar"><i></i></div></div>`;
            }).join('')}</div>
            <h3 class="sub">Titles <span class="dim">${titles.length} / ${TITLES.length + 1}</span></h3>
            <div class="titles">${titles.map(([id, text]) => `<button class="title-chip ${s.title === id ? 'on' : ''}" data-title="${id ?? ''}">${esc(text)}</button>`).join('')}</div>`;
    }
    for (const b of BADGES) {
        const el = body.querySelector(`[data-b="${b.id}"]`); if (!el) continue;
        const t = s.badges[b.id] | 0, v = b.value(s, k);
        const next = b.at[t];
        el.querySelector('.m-next').textContent = next === undefined ? 'Complete' : `${fmt(Math.floor(v))} / ${fmt(next)} ${b.unit}`;
        const prev = t ? b.at[t - 1] : 0;
        el.querySelector('.bar i').style.width = next === undefined ? '100%' : `${Math.max(0, Math.min(1, (v - prev) / (next - prev))) * 100}%`;
    }
}

// ------------------------------------------------------------------ journal: the codex
export function codexView(body) {
    const s = G.s;
    const key = `cx|${s.kinLv.join()}|${Object.keys(s.stats.wispKinds).map((k) => s.stats.wispKinds[k]).join()}|${s.gens.map((n) => (n > 0 ? 1 : 0)).join('')}`;
    if (keys.codex !== key) {
        keys.codex = key;
        const opened = [...body.querySelectorAll('details[open]')].map((d) => d.dataset.g);
        const spirits = GENERATORS.map((g, i) => {
            const l = s.kinLv[i] | 0;
            const known = l > 0 || s.gens[i] > 0;
            if (!known) return `<div class="codex-entry dim"><b>❔ ???</b><p class="small">A spirit not yet met.</p></div>`;
            const pages = CODEX[g.id].map((txt, j) => (l >= CODEX_LEVELS[j] ? `<p>${esc(txt)}</p>` : `<p class="small dim">Reach kinship ${CODEX_LEVELS[j]} to read more.</p>`)).join('');
            return `<details class="codex-entry" data-g="${g.id}" ${opened.includes(g.id) ? 'open' : ''}><summary><b>${g.icon} ${esc(g.name)}</b> <span class="small mint">Kinship ${l}/${KIN_MAX} · +${(l * KIN_BONUS * 100).toFixed(1)}%</span>
                <div class="bar"><i style="width:${l >= KIN_MAX ? 100 : (s.kin[i] / kinCost(l)) * 100}%"></i></div></summary>${pages}</details>`;
        }).join('');
        body.innerHTML = `<div class="card small dim">Every kind of spirit you keep grows closer to you over time, even while you are away: kinship makes it brighter, and opens its pages here.</div>
            ${spirits}
            <h3 class="sub">Golden wisps</h3>
            <div class="card">${WISP_KINDS.map((w) => `<div class="small">${(s.stats.wispKinds[w.id] | 0) ? '🔮' : '❔'} <b class="mint">${esc(w.name)}</b>: ${esc(w.desc)} <span class="gold">×${fmt(s.stats.wispKinds[w.id] | 0)}</span></div>`).join('')}</div>`;
    }
}

export function titleText() { return G.s.title && TITLE_BY_ID[G.s.title] ? TITLE_BY_ID[G.s.title][1] : null; }
export function wireTitles(body) {
    body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-title]'); if (!b) return;
        act.setTitle(b.dataset.title || null);
        keys.badges = null;
    });
}
