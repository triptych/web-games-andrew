// The content of every panel, as HTML strings built from the game. The UI morphs these into the
// page and handles the buttons through data-a / data-p attributes. Nothing here changes the game.

import { BUILDINGS, BUILDING_IDS, SKILLS, costOf, reqHall, stat, nameOf, rateOf } from './sim/data/buildings.js';
import { ITEMS, RECIPES, recipesFor, canEquip, WEAPON_TYPE, DISH_IDS, POTION_IDS } from './sim/data/items.js';
import { HERO_CLASSES, HERO_TRAITS, VILLAGER_TRAITS, SPECIALS, heroXpNeed, SKILL_MAX, skillXpNeed } from './sim/data/people.js';
import { REGIONS, QUEST_TEMPLATES } from './sim/data/quests.js';
import { UPGRADES, BRANCHES } from './sim/data/upgrades.js';
import { JOURNAL, JOURNAL_IDS, CHAPTERS } from './sim/data/journal.js';
import { SEASONS, DAY_LEN } from './config.js';
import {
    stock, has, capOf, hallLv, hall, bldById, bestLv, builtOf, cozyOf, dishPrice, shelfPrice, marketPrice, bedPrice, hourOf, seasonOf, count, vById, hById,
} from './sim/core.js';
import { buildInfo, missing, shelfCount, buildCost, upgradeCost } from './sim/commands.js';
import { outRate, craftSpeed, seasonMul, builderCap, constructions } from './sim/production.js';
import { popCap, slotsOf, freeSlots, skillOf } from './sim/townsfolk.js';
import { heroStats, heroPower, heroCap, recruitFee, guildLv, heroTrait, QUALITY, heroLvCap } from './sim/heroes.js';
import { partyChance, readyHeroes, questTimeMul, boardSize } from './sim/quests.js';
import { progress, isOpen, claimable } from './sim/journal.js';
import { defenseOf } from './sim/events.js';
import { portrait } from './portrait.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${Math.floor(n)}`);
const dur = (s) => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 ? (s % 60) + 's' : ''}`.trim() : `${s}s`; };
const pct = (v) => `${Math.round(v * 100)}%`;
export const icon = (id) => (id === 'gold' ? '🪙' : ITEMS[id]?.icon || '❔');
export const iname = (id) => (id === 'gold' ? 'Gold' : ITEMS[id]?.name || id);

export function costHTML(G, cost) {
    return `<span class="cost">${Object.entries(cost).map(([k, n]) => {
        const have = k === 'gold' ? G.gold : stock(G, k);
        return `<span class="${have >= n ? '' : 'no'}" title="${esc(iname(k))}">${icon(k)} ${fmt(n)}</span>`;
    }).join('')}</span>`;
}
const bar = (v, max, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100)).toFixed(0)}%"></i></div>`;
const btn = (a, p, label, cls = '', dis = false) => `<button class="btn small ${cls}${dis ? ' off' : ''}" data-a="${a}" data-p="${esc(p)}"${dis ? ' aria-disabled="true"' : ''}>${label}</button>`;
const sec = (title, body, extra = '') => `<div class="sec"><h3>${title}${extra}</h3>${body}</div>`;
const pill = (t, c = '') => `<span class="pill ${c}">${t}</span>`;

export function itemStats(it) {
    if (it.cat === 'gear') return [it.atk ? `+${Math.round(it.atk)} atk` : '', it.def ? `+${it.def} def` : '', it.hp ? `+${it.hp} hp` : '', it.luck ? `+${it.luck} luck` : '', `lv ${it.reqLv}+`].filter(Boolean).join(' · ');
    if (it.cat === 'dish') return `food ${it.food}${it.mood ? ` · mood +${it.mood}` : ''}${it.buff ? ` · ${it.buff.stat === 'all' ? 'all stats' : it.buff.stat} +${it.buff.pct}%` : ''}`;
    if (it.cat === 'potion') return `+${Math.round(it.power * 100)}% quest success${it.loot ? ' · +loot' : ''}`;
    return `worth ${it.value}`;
}

// ---------------------------------------------------------------- BUILD
export function panelBuild(ui, G) {
    const hl = hallLv(G);
    const cats = [['all', 'All'], ['gather', 'Gather'], ['craft', 'Craft'], ['service', 'Services'], ['home', 'Homes'], ['deco', 'Decor']];
    const tab = ui.tab('build', 'all');
    const list = BUILDING_IDS.filter((t) => t !== 'hall').filter((t) => {
        const k = BUILDINGS[t].kind;
        if (tab === 'all') return true;
        if (tab === 'service') return k === 'service' || k === 'defense' || k === 'storage';
        return k === tab;
    }).sort((a, b) => BUILDINGS[a].unlock - BUILDINGS[b].unlock);
    const cards = list.map((t) => {
        const d = BUILDINGS[t];
        const locked = hl < d.unlock;
        const own = count(G, t, 0);
        const cost = buildCost(G, t, 1);
        const afford = missing(G, cost).length === 0;
        return `<button class="card-btn ${locked ? 'locked' : ''}" data-a="${locked ? 'locked' : 'place'}" data-p="${t}">
            <span class="t"><i>${d.icon}</i>${esc(nameOf(t, 1))}</span>
            <span class="dim">${locked ? `🔒 Hall level ${d.unlock}` : `${d.w}×${d.h} tiles${own ? ` · you have ${own}` : ''}`}</span>
            ${locked ? '' : costHTML(G, cost)}
            ${!locked && !afford ? '<span class="dim">Not enough yet</span>' : ''}
        </button>`;
    }).join('');
    return {
        title: '🔨 Build', tabs: cats.map(([id, n]) => ({ id, name: n, on: tab === id })),
        html: `<div class="note">Pick a building, then tap or drag on the map to place it. Trees and boulders under it are cleared for you (and paid back in wood and stone).</div><div class="grid">${cards}</div>`,
    };
}

// ---------------------------------------------------------------- BUILDING
function workersBlock(ui, G, b) {
    const d = BUILDINGS[b.type];
    const n = slotsOf(b);
    if (!d.skill || b.lv < 1) return '';
    const filled = b.workers.map((vid) => {
        const v = vById(G, vid);
        if (!v) return '';
        return `<span class="slot filled">${portraitInline(v)}${esc(v.name.split(' ')[0])} <small class="dim">${SKILLS[d.skill].icon}${skillOf(v, d.skill)}</small><button class="ibtn" style="min-height:44px;min-width:44px;padding:0 8px" data-a="unassign" data-p="${v.id}" aria-label="Remove ${esc(v.name)}">✕</button></span>`;
    }).join('');
    const empty = Array.from({ length: Math.max(0, n - b.workers.length) }, () => `<button class="slot" data-a="picker" data-p="${b.id}">＋ Assign</button>`).join('');
    let picker = '';
    if (ui.state.picker === b.id && freeSlots(b) > 0) {
        const cands = G.villagers.filter((v) => v.job !== b.id).sort((a, c) => skillOf(c, d.skill) - skillOf(a, d.skill));
        picker = `<div class="list" style="margin-top:6px">${cands.length ? cands.map((v) => {
            const cur = v.job != null ? bldById(G, v.job) : null;
            return `<button class="item card-btn" data-a="assign" data-p="${v.id}|${b.id}">${portraitInline(v)}<span class="grow"><span class="ttl">${esc(v.name)}</span><span class="sub">${SKILLS[d.skill].icon} ${SKILLS[d.skill].name} ${skillOf(v, d.skill) || '–'} · ${cur ? 'now at ' + esc(nameOf(cur.type, cur.lv)) : 'no job'}</span></span></button>`;
        }).join('') : '<div class="empty">Nobody to assign. Welcome more newcomers!</div>'}</div>`;
    }
    return sec(`${SKILLS[d.skill].icon} Workers <span class="pill">${b.workers.length}/${n}</span>`, `<div class="slotrow">${filled}${empty}</div>${picker}` + (b.workers.length === 0 ? '<div class="note" style="margin-top:6px">Nobody works here yet, so nothing happens.</div>' : ''));
}
function portraitInline(v) { return `<i class="pt" style="width:28px;height:34px;flex:0 0 28px;background-image:url(${portrait(v, 'v')})"></i>`; }

function gatherBlock(G, b) {
    const d = BUILDINGS[b.type];
    if (!d.out) return '';
    const rows = d.out.filter((o) => !o.minLv || b.lv >= o.minLv).map((o) => {
        const r = outRate(G, b, o) * 60;
        const full = stock(G, o.item) >= capOf(G, o.item);
        return `<div class="item"><i class="ic">${icon(o.item)}</i><span class="grow"><span class="ttl">${esc(iname(o.item))}</span><span class="sub">${r > 0 ? `${r.toFixed(1)} per minute` : 'no workers'} · ${fmt(stock(G, o.item))}/${fmt(capOf(G, o.item))}${full ? ' · storage full' : ''}</span></span>${full ? pill('full', 'warn') : ''}</div>`;
    }).join('');
    const locked = d.out.filter((o) => o.minLv && b.lv < o.minLv).map((o) => `<div class="dim">🔒 ${esc(iname(o.item))} from level ${o.minLv}</div>`).join('');
    const near = d.near ? `<div class="dim" style="margin-top:4px">${d.near === 'tree' ? '🌲' : '🪨'} ${b.near} ${d.near === 'tree' ? 'trees' : 'boulders'} nearby: +${Math.round(Math.min(0.5, b.near * 0.04) * (1 + G.mods.nearMul) * 100)}% speed</div>` : '';
    return sec('Production', `<div class="list">${rows}</div>${locked}${near}`);
}

function craftBlock(ui, G, b) {
    const d = BUILDINGS[b.type];
    const recs = recipesFor(b.type).slice().sort((a, c) => a.lv - c.lv || ITEMS[a.out].value - ITEMS[c.out].value);
    const sp = craftSpeed(G, b);
    const job = b.job ? RECIPES[b.job.rid] : null;
    const status = job
        ? `<div class="item"><i class="ic">${icon(job.out)}</i><span class="grow"><span class="ttl">Making ${esc(iname(job.out))}${job.n > 1 ? ` ×${job.n}` : ''}</span>${bar(b.job.p, b.job.need)}<span class="sub">${dur((b.job.need - b.job.p) / Math.max(0.01, sp))} left</span></span></div>`
        : `<div class="dim">${sp <= 0 ? 'Needs a worker to start.' : 'Idle. Add something to the queue, or set a stock target.'}</div>`;
    const queue = b.queue.length ? `<div class="list" style="margin-top:6px">${b.queue.map((q, i) => `<div class="item"><i class="ic">${icon(RECIPES[q.rid].out)}</i><span class="grow"><span class="ttl">${esc(iname(RECIPES[q.rid].out))} × ${q.n}</span><span class="sub">queued</span></span>${btn('dequeue', `${b.id}|${i}`, '✕', '', false)}</div>`).join('')}</div>` : '';
    const rows = recs.map((r) => {
        const it = ITEMS[r.out];
        const locked = r.lv > b.lv;
        const can = !locked && missing(G, r.in).length === 0;
        const tgt = b.auto[r.id] || 0;
        const step = r.kind === 'process' ? 5 : 1;
        const price = it.cat === 'dish' ? ` · sells ${dishPrice(G, r.out)}🪙` : '';
        return `<div class="item" style="flex-wrap:wrap${locked ? ';opacity:.6' : ''}">
            <i class="ic">${icon(r.out)}</i>
            <span class="grow"><span class="ttl">${esc(it.name)}${r.n > 1 ? ` ×${r.n}` : ''} <small class="dim">have ${fmt(stock(G, r.out))}</small></span>
            <span class="sub">${esc(itemStats(it))}${price}</span>
            ${locked ? `<span class="sub">🔒 needs ${esc(nameOf(b.type, r.lv))}</span>` : `<span style="display:block;margin-top:3px">${costHTML(G, r.in)} <span class="dim">⏱ ${dur(r.time / Math.max(0.3, sp || 1))}</span></span>`}</span>
            ${locked ? '' : `<span style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                <span class="btnrow" style="margin:0">${btn('queue', `${b.id}|${r.id}|1`, '＋1', can ? 'primary' : '')}${btn('queue', `${b.id}|${r.id}|5`, '＋5')}</span>
                <span class="stepper dim">Keep ${btn('target', `${b.id}|${r.id}|${-step}`, '−', '', tgt <= 0)}<b>${tgt || 'off'}</b>${btn('target', `${b.id}|${r.id}|${step}`, '＋')}</span>
            </span>`}
        </div>`;
    }).join('');
    const hint = b.type === 'tavern' ? `<div class="note">Heroes eat and drink here and pay <b>you</b>. Keep a few dishes of each kind in stock with "Keep". Better dishes give heroes a buff for their next quests.</div>` : '';
    return hint + sec('In the kitchen / workshop'.replace('In the kitchen / workshop', b.type === 'tavern' ? 'Kitchen' : 'Workshop'), status + queue) + sec('Recipes', `<div class="list">${rows}</div><div class="dim" style="margin-top:4px">"Keep" is a stock target: this station makes more whenever the stock falls below it, so it works while you are away.</div>`);
}

function guildBlock(ui, G, b) {
    const gl = b.lv;
    const recruits = G.recruits.map((r) => {
        const fee = recruitFee(r);
        const q = QUALITY[r.q];
        const t = HERO_TRAITS[r.trait];
        return `<div class="item"><i class="pt" style="background-image:url(${portrait(r, 'h')})"></i>
            <span class="grow"><span class="ttl">${esc(r.name)}${r.epithet ? ' ' + esc(r.epithet) : ''}</span>
            <span class="sub">${HERO_CLASSES[r.cls].icon} ${HERO_CLASSES[r.cls].name} · lv ${r.lv} · <b style="color:${q.color}">${q.name}</b> · ${t.icon} ${t.name}</span>
            <span class="sub">power ${Math.round(heroPower(G, r))} · leaves in ${Math.max(0, r.exp - G.day)}d</span></span>
            ${btn('hire', r.id, `Hire<br><small>${fee}🪙</small>`, G.gold >= fee && G.heroes.length < heroCap(G) ? 'primary' : '')}</div>`;
    }).join('');
    return sec('Heroes', `<div class="row2"><span class="dim">${G.heroes.length}/${heroCap(G)} heroes · they level up to ${heroLvCap(G)}</span>${btn('open', 'heroes', 'Roster')}</div>`)
        + sec('Looking for work', recruits ? `<div class="list">${recruits}</div>` : '<div class="empty">Nobody new today. New faces arrive each morning.</div>')
        + sec('Quest board', `<div class="row2"><span class="dim">${G.board.filter((q) => !q.pid).length} jobs posted · ${G.parties.length} parties out</span>${btn('open', 'quests', 'Open quests')}</div>`);
}

function innBlock(G, b) {
    let total = 0, used = 0;
    for (const x of builtOf(G, 'inn')) total += stat('inn', x.lv, 'beds');
    for (const h of G.heroes) if (h.st === 'sleep' && h.slp === 'inn') used++;
    return sec('Beds', `${bar(used, total, 'nrg')}<div class="dim">${used}/${total} beds in use · a bed costs ${bedPrice(G, b.lv)}🪙, paid to you by the hero. Heroes with no bed (or no gold) rough it by the hearth, which is slower.</div>`);
}

function shopBlock(ui, G, b) {
    const n = shelfCount(G);
    const slots = [];
    for (let i = 0; i < n; i++) {
        const id = G.shelves[i];
        const it = id && ITEMS[id];
        slots.push(`<button class="card-btn ${ui.state.shelf === i ? 'sel' : ''}" data-a="shelfpick" data-p="${i}">
            ${it ? `<span class="t"><i>${it.icon}</i>${esc(it.name)}</span><span class="dim">${stock(G, id)} in stock · ${shelfPrice(G, id)}🪙</span>` : '<span class="t dim">＋ Empty shelf</span>'}</button>`);
    }
    let pick = '';
    if (ui.state.shelf != null) {
        const opts = Object.keys(G.inv).filter((k) => ['gear', 'potion'].includes(ITEMS[k].cat) && !G.shelves.some((s, i) => s === k && i !== ui.state.shelf)).sort((a, c) => ITEMS[a].cat.localeCompare(ITEMS[c].cat) || (ITEMS[a].tier || 0) - (ITEMS[c].tier || 0));
        pick = `<div class="list" style="margin-top:8px">${G.shelves[ui.state.shelf] ? btn('shelf', `${ui.state.shelf}|`, 'Take it off the shelf') : ''}${opts.length ? opts.map((k) => `<button class="item card-btn" data-a="shelf" data-p="${ui.state.shelf}|${k}"><i class="ic">${ITEMS[k].icon}</i><span class="grow"><span class="ttl">${esc(ITEMS[k].name)} <small class="dim">×${stock(G, k)}</small></span><span class="sub">${esc(itemStats(ITEMS[k]))}</span></span></button>`).join('') : '<div class="empty">Craft some gear or potions first (Carpenter, Smithy, Weaver, Alchemist).</div>'}</div>`;
    }
    const priced = G.shelves.filter(Boolean).map((id) => `<div class="item"><i class="ic">${ITEMS[id].icon}</i><span class="grow"><span class="ttl">${esc(ITEMS[id].name)}</span><span class="sub">price ${shelfPrice(G, id)}🪙 (worth ${ITEMS[id].value})</span></span><span class="stepper">${btn('price', `${id}|-0.1`, '−')}<b>×${(G.priceMul[id] ?? 1).toFixed(1)}</b>${btn('price', `${id}|0.1`, '＋')}</span></div>`).join('');
    return sec('Shelves', `<div class="dim" style="margin-bottom:6px">Heroes buy gear they can use and potions to carry, if they can afford it. Sold: ${G.stats.sold} items, ${fmt(G.stats.soldGold)}🪙.</div><div class="grid">${slots.join('')}</div>${pick}`)
        + (priced ? sec('Prices', `<div class="list">${priced}</div><div class="dim">Heroes only have so much gold: fair prices sell faster.</div>`) : '');
}

function marketBlock(ui, G, b) {
    const rows = Object.keys(G.inv).filter((k) => !ITEMS[k].noSell && ['raw', 'mat'].includes(ITEMS[k].cat) && stock(G, k) > 0).sort((a, c) => ITEMS[c].value - ITEMS[a].value).map((k) => {
        const keep = G.autoSell[k];
        return `<div class="item" style="flex-wrap:wrap"><i class="ic">${icon(k)}</i><span class="grow"><span class="ttl">${esc(ITEMS[k].name)} <small class="dim">×${fmt(stock(G, k))}</small></span><span class="sub">${marketPrice(G, k)}🪙 each</span></span>
            <span class="btnrow" style="margin:0">${btn('sell', `${k}|10`, 'Sell 10')}${btn('sell', `${k}|9999`, 'All')}</span>
            <span class="stepper dim" style="width:100%;justify-content:flex-end">Sell extra above ${btn('keep', `${k}|-10`, '−')}<b style="min-width:44px">${keep == null ? 'off' : keep}</b>${btn('keep', `${k}|10`, '＋')}</span></div>`;
    }).join('');
    return sec('Sell', `<div class="dim" style="margin-bottom:6px">Earned so far: ${fmt(G.stats.marketGold)}🪙. "Sell extra above N" sells anything over N every few seconds, even while you are away.</div><div class="list">${rows || '<div class="empty">Nothing to sell yet.</div>'}</div>`);
}

export function panelBuilding(ui, G, b) {
    const d = BUILDINGS[b.type];
    const lvName = nameOf(b.type, Math.max(1, b.lv));
    const parts = [];
    const status = [];
    if (b.bld) status.push(pill(`🔨 ${b.lv < 1 ? 'Being built' : 'Upgrading'}`, 'blue'));
    if (b.full) status.push(pill('Storage full', 'warn'));
    if (d.skill && b.lv >= 1 && slotsOf(b) > 0 && !b.workers.length) status.push(pill('Needs a worker', 'warn'));
    parts.push(`<div class="note" style="background:#fff;border-color:var(--line)"><b>${d.icon} ${esc(lvName)}</b> ${pill(`Level ${Math.max(1, b.lv)}/${d.maxLv}`)} ${status.join(' ')}<div class="dim" style="margin-top:4px">${esc(d.desc)}</div></div>`);

    // construction or upgrade
    if (b.bld) {
        parts.push(sec('🔨 Construction', `${bar(b.bld.total - Math.max(0, b.bld.t), b.bld.total)}<div class="row2"><span class="dim">${dur(b.bld.t)} left · builders ${Math.min(builderCap(G), constructions(G).length)}/${builderCap(G)}</span>${btn('cancel', b.id, 'Cancel (full refund)')}</div>`));
    } else if (b.lv >= 1 && b.lv < d.maxLv) {
        const info = buildInfo(G, b.type, b.lv + 1);
        const cost = buildCost(G, b.type, b.lv + 1);
        const miss = missing(G, cost);
        let extra = '';
        if (b.type === 'hall') {
            const unlocks = BUILDING_IDS.filter((t) => BUILDINGS[t].unlock === b.lv + 1).map((t) => `${BUILDINGS[t].icon} ${nameOf(t, 1)}`);
            extra = `<div class="dim" style="margin:4px 0">Opens: ${unlocks.join(', ') || 'a grander home'} · more land · ${stat('hall', b.lv + 1, 'house')} homes in the hall${stat('hall', b.lv + 1, 'builders') > stat('hall', b.lv, 'builders') ? ' · another builder' : ''}</div>`;
        }
        parts.push(sec(`⬆️ Upgrade to ${esc(nameOf(b.type, b.lv + 1))}`, `${extra}${costHTML(G, cost)}<div class="row2" style="margin-top:6px"><span class="dim">${info.why ? esc(info.why) : `⏱ ${dur(info.time)}`}</span>${btn('upgrade', b.id, 'Upgrade', !info.why && !miss.length ? 'primary' : '', !!info.why || !!miss.length)}</div>${!info.why && miss.length ? `<div class="dim">Needs ${esc(miss.join(', '))}</div>` : ''}`));
    } else if (b.lv >= d.maxLv && d.maxLv > 1) parts.push(`<div class="note good">Fully upgraded. ${b.type === 'hall' ? 'Your town is as grand as it gets.' : 'A bigger Hall lets other buildings grow too, if there is more to learn.'}</div>`);

    if (b.lv >= 1) {
        parts.push(workersBlock(ui, G, b));
        parts.push(gatherBlock(G, b));
        if (d.kind === 'craft') parts.push(craftBlock(ui, G, b));
        if (b.type === 'guild') parts.push(guildBlock(ui, G, b));
        if (b.type === 'inn') parts.push(innBlock(G, b));
        if (b.type === 'itemshop') parts.push(shopBlock(ui, G, b));
        if (b.type === 'market') parts.push(marketBlock(ui, G, b));
        if (b.type === 'healer') parts.push(sec('Healing', `<div class="dim">Hurt heroes heal ${pct(stat('healer', b.lv, 'heal'))} of their health per second here. A visit costs them 3🪙.</div>`));
        if (b.type === 'storehouse') parts.push(sec('Storage', `<div class="dim">Adds ${stat('storehouse', b.lv, 'cap')} room for raw goods (and a fifth of that for crafted ones).</div>`));
        if (b.type === 'watchtower') parts.push(sec('Defense', `<div class="dim">+${stat('watchtower', b.lv, 'defense')} defense. Town total ${defenseOf(G)} against tonight's ${G.raid ? G.raid.power : '?'}.</div>`));
        if (b.type === 'stables') parts.push(sec('Horses', `<div class="dim">Quests take ${pct(stat('stables', b.lv, 'questTime'))} less time.</div>`));
        if (b.type === 'hall' || b.type === 'house') {
            const cap = b.type === 'hall' ? stat('hall', b.lv, 'house') : stat('house', b.lv, 'house');
            parts.push(sec('Home', `<div class="dim">Holds ${cap} villagers. Town: ${G.villagers.length}/${popCap(G)}.</div>${btn('open', 'town', 'See townsfolk')}`));
        }
        if (b.type === 'hall') {
            parts.push(sec('Town facts', `<dl class="kv"><dt>Land</dt><dd>${G.bounds.x1 - G.bounds.x0 + 1}×${G.bounds.y1 - G.bounds.y0 + 1} tiles</dd><dt>Builders</dt><dd>${builderCap(G)}</dd><dt>Coziness</dt><dd>${G.cozy}</dd><dt>Renown</dt><dd>${G.renown}</dd><dt>Next raid</dt><dd>day ${G.raid ? G.raid.day : '?'} (${G.raid ? G.raid.power : '?'} strong)</dd></dl>`));
        }
        if (d.kind === 'deco') parts.push(sec('Coziness', `<div class="dim">Adds ${d.cozy} to the town's coziness (now ${G.cozy}). A cozier town draws newcomers faster and makes heroes happier.</div>`));
    }
    if (b.type !== 'hall' && !b.bld) parts.push(`<div class="btnrow">${btn('move', b.id, '✋ Move')}${ui.state.confirm === `del${b.id}` ? btn('demolish', b.id, 'Really? Tear it down', 'danger') : btn('confirmdel', b.id, '🗑️ Demolish', 'danger')}</div>`);
    return { title: `${d.icon} ${lvName}`, html: parts.join('') };
}

// ---------------------------------------------------------------- TOWN
export function panelTown(ui, G) {
    const tab = ui.tab('town', 'folk');
    const tabs = [{ id: 'folk', name: `Townsfolk (${G.villagers.length})`, on: tab === 'folk' }, { id: 'info', name: 'Town', on: tab === 'info' }];
    const visitors = G.visitors.filter((v) => v.kind === 'villager');
    if (tab === 'info') {
        const best = (arr) => arr.slice().sort((a, b) => b[1] - a[1])[0];
        const html = sec('Coziness', `<div class="item"><i class="ic">🕯️</i><span class="grow"><span class="ttl">${G.cozy}</span><span class="sub">Newcomers arrive every ~${Math.round(DAY_LEN * 0.45 / (1 + G.cozy / 140) / (1 + G.mods.welcomeRate) / 60 * 10) / 10} minutes while there is room. Hero mood rises with it. Flower beds, lanterns, benches, wells, fountains and cozy buildings all help.</span></span></div>`)
            + sec('Season', `<div class="item"><i class="ic">${['🌸', '☀️', '🍂', '❄️'][seasonOf(G.day)]}</i><span class="grow"><span class="ttl">${SEASONS[seasonOf(G.day)]}, day ${G.day}</span><span class="sub">Weather: ${G.weather}. ${['Farms grow a little faster.', 'Fish bite, fruit ripens.', 'Harvest time: wheat, apples and mushrooms thrive.', 'Farms slow right down; wood is easier to come by.'][seasonOf(G.day)]}${G.festival ? ' <b>Festival today!</b>' : ''}</span></span></div>`)
            + sec('Raiders', `<div class="item"><i class="ic">🛡️</i><span class="grow"><span class="ttl">${G.raid ? esc(G.raid.name) : 'Quiet'} · day ${G.raid ? G.raid.day : '?'}</span><span class="sub">Strength ${G.raid ? G.raid.power : '?'} against your defense of ${defenseOf(G)} (heroes at home, watchtowers, townsfolk). They come at dusk. Held off so far: ${G.stats.raidsHeld}.</span></span></div>`)
            + sec('Specials', Object.entries(SPECIALS).map(([k, s]) => {
                const here = G.villagers.some((v) => v.special === k);
                return `<div class="item" style="${here ? '' : 'opacity:.55'}"><i class="ic">${here ? '⭐' : '❔'}</i><span class="grow"><span class="ttl">${here ? esc(s.name + ' ' + s.title) : '???'}</span><span class="sub">${here ? esc(s.perkText) : 'Someone special may turn up when a journal entry is finished.'}</span></span></div>`;
            }).join(''));
        return { title: '🏘️ Town', tabs, html };
    }
    const waiting = visitors.map((v) => {
        const p = v.person;
        const best = Object.entries(p.skills).sort((a, c) => c[1] - a[1])[0];
        const room = G.villagers.length < popCap(G);
        return `<div class="item"><i class="pt" style="background-image:url(${portrait(p, 'v')})"></i><span class="grow"><span class="ttl">${esc(p.name)}</span><span class="sub">${best ? `${SKILLS[best[0]].icon} ${SKILLS[best[0]].name} ${best[1]}` : ''} · ${VILLAGER_TRAITS[p.trait].icon} ${VILLAGER_TRAITS[p.trait].name}</span><span class="sub">waiting at the gate</span></span>${btn('welcome', `${v.id}|1`, 'Welcome', room ? 'primary' : '')}${btn('welcome', `${v.id}|0`, '✕')}</div>`;
    }).join('');
    const rows = G.villagers.map((v) => {
        const job = v.job != null ? bldById(G, v.job) : null;
        const skills = Object.entries(v.skills).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${SKILLS[k].icon}${n}`).join(' ');
        const t = VILLAGER_TRAITS[v.trait];
        return `<div class="item"><i class="pt" style="background-image:url(${portrait(v, 'v')})"></i><span class="grow"><span class="ttl">${esc(v.name)}${v.special ? ' ⭐' : ''}</span><span class="sub">${skills} · ${t.icon} ${t.name}</span><span class="sub">${job ? `works at ${esc(nameOf(job.type, job.lv))}` : '<b>no job</b>'}</span></span>${job ? btn('select', job.id, 'Go') : ''}</div>`;
    }).join('');
    const html = `<div class="row2" style="margin-bottom:8px"><span class="dim">👥 ${G.villagers.length}/${popCap(G)} homes · coziness ${G.cozy}</span>${btn('autoAssignAll', '', '🔀 Auto-assign all', 'amber')}</div>`
        + (visitors.length ? sec('At the gate', `<div class="list">${waiting}</div>${G.villagers.length >= popCap(G) ? '<div class="note bad" style="margin-top:6px">No room: build a House or upgrade the Hall.</div>' : ''}`) : '')
        + sec('Townsfolk', `<div class="list">${rows}</div>`);
    return { title: '🏘️ Town', tabs, html };
}

// ---------------------------------------------------------------- HEROES
function heroCard(G, h, sel) {
    const s = heroStats(G, h);
    const cls = HERO_CLASSES[h.cls];
    const status = { idle: 'Relaxing', walk: 'Walking', eat: 'Eating', sleep: 'Sleeping', rest: 'Resting', heal: 'Healing', shop: 'Shopping', away: 'On a quest' }[h.st] || h.st;
    return `<button class="item card-btn" data-a="hero" data-p="${h.id}"><i class="pt" style="background-image:url(${portrait(h, 'h', G)})"></i>
        <span class="grow"><span class="ttl">${esc(h.name)} <small class="dim">${cls.icon} lv ${h.lv}</small></span>
        <span class="bars"><span>❤️</span>${bar(h.hp, s.hpMax, 'hp')}<span>🍖</span>${bar(h.hunger, 100, 'food')}<span>💤</span>${bar(h.energy, 100, 'nrg')}</span>
        <span class="sub">${status} · ${Math.round(h.gold)}🪙${h.auto ? '' : ' · manual'}</span></span></button>`;
}

export function panelHeroes(ui, G) {
    const hid = ui.state.hero;
    if (hid != null) return panelHero(ui, G, hById(G, hid));
    const tab = ui.tab('heroes', 'roster');
    const tabs = [{ id: 'roster', name: `Roster (${G.heroes.length}/${heroCap(G)})`, on: tab === 'roster' }, { id: 'recruit', name: `Recruits (${G.recruits.length})`, on: tab === 'recruit' }];
    if (tab === 'recruit') {
        const gl = builtOf(G, 'guild')[0];
        return { title: '⚔️ Heroes', tabs, html: gl ? guildBlock(ui, G, gl) : '<div class="note">Build the Adventurers\' Lodge to recruit heroes.</div>' };
    }
    const html = G.heroes.length ? `<div class="list">${G.heroes.map((h) => heroCard(G, h)).join('')}</div>`
        : `<div class="empty">No heroes yet.<br>${builtOf(G, 'guild').length ? 'Open the Recruits tab to hire your first one.' : 'Build the Adventurers\' Lodge (Hall level 2) to hire some.'}</div>`;
    return { title: '⚔️ Heroes', tabs, html };
}

function panelHero(ui, G, h) {
    if (!h) { ui.state.hero = null; return panelHeroes(ui, G); }
    const s = heroStats(G, h), cls = HERO_CLASSES[h.cls], tr = HERO_TRAITS[h.trait], q = QUALITY[h.q];
    const slotRow = (slot, label) => {
        const it = ITEMS[h.equip[slot]];
        return `<div class="item"><i class="ic">${it ? it.icon : '▫️'}</i><span class="grow"><span class="ttl">${it ? esc(it.name) : label}</span><span class="sub">${it ? esc(itemStats(it)) : 'nothing equipped'}</span></span></div>`;
    };
    // what in storage could they wear
    const gear = Object.keys(G.inv).filter((k) => ITEMS[k].cat === 'gear' && canEquip(h.cls, ITEMS[k]) && ITEMS[k].reqLv <= h.lv && !(ITEMS[h.equip[ITEMS[k].slot]]?.tier >= ITEMS[k].tier));
    const pots = Object.keys(G.inv).filter((k) => ITEMS[k].cat === 'potion');
    const give = gear.map((k) => `<div class="item"><i class="ic">${ITEMS[k].icon}</i><span class="grow"><span class="ttl">${esc(ITEMS[k].name)} <small class="dim">×${stock(G, k)}</small></span><span class="sub">${esc(itemStats(ITEMS[k]))}</span></span>${btn('equip', `${h.id}|${k}`, 'Give', 'primary')}</div>`).join('');
    const givePots = h.pots.length < 2 ? pots.map((k) => `<div class="item"><i class="ic">${ITEMS[k].icon}</i><span class="grow"><span class="ttl">${esc(ITEMS[k].name)} <small class="dim">×${stock(G, k)}</small></span><span class="sub">${esc(itemStats(ITEMS[k]))}</span></span>${btn('equip', `${h.id}|${k}`, 'Give')}</div>`).join('') : '';
    const html = `<div class="item"><i class="pt" style="width:56px;height:68px;flex-basis:56px;background-image:url(${portrait(h, 'h', G)})"></i><span class="grow"><span class="ttl">${esc(h.name)} ${esc(h.epithet || '')}</span><span class="sub">${cls.icon} ${cls.name} · lv ${h.lv} · <b style="color:${q.color}">${q.name}</b></span><span class="sub">${tr.icon} ${tr.name}: ${esc(tr.text)}</span></span></div>`
        + sec('Condition', `<div class="bars" style="font-size:12px"><span>❤️ ${Math.round(h.hp)}/${s.hpMax}</span>${bar(h.hp, s.hpMax, 'hp')}<span>🍖 ${Math.round(h.hunger)}</span>${bar(h.hunger, 100, 'food')}<span>💤 ${Math.round(h.energy)}</span>${bar(h.energy, 100, 'nrg')}<span>😊 ${Math.round(h.mood)}</span>${bar(h.mood, 100)}<span>✨ XP</span>${bar(h.xp, heroXpNeed(h.lv), 'xp')}</div><div class="dim" style="margin-top:4px">Gold ${Math.round(h.gold)}🪙 · ${h.quests} quests done · power ${Math.round(heroPower(G, h))}${h.buffs.length ? ' · ' + h.buffs.map((b) => `${b.stat === 'all' ? 'all' : b.stat} +${Math.round(b.pct)}% (${b.q})`).join(', ') : ''}</div>`)
        + sec('Stats', `<dl class="kv"><dt>Attack</dt><dd>${s.atk.toFixed(1)}</dd><dt>Defense</dt><dd>${s.def.toFixed(1)}</dd><dt>Luck</dt><dd>${s.luck.toFixed(1)}</dd></dl>`)
        + sec('Gear', `<div class="list">${slotRow('weapon', 'Weapon')}${slotRow('armor', 'Armor')}${slotRow('charm', 'Charm')}${h.pots.map((p) => `<div class="item"><i class="ic">${ITEMS[p].icon}</i><span class="grow"><span class="ttl">${esc(ITEMS[p].name)}</span><span class="sub">carried for the next quest</span></span></div>`).join('')}</div><div class="dim" style="margin-top:4px">${h.st === 'idle' ? 'They shop at your Item Shop when they can afford what is on the shelves, or you can give them things from storage.' : ''}</div>`)
        + (give || givePots ? sec('Give from storage', `<div class="list">${give}${givePots}</div>`) : '')
        + `<div class="btnrow">${btn('auto', h.id, h.auto ? '🤖 Auto-quest: on' : '🤖 Auto-quest: off', h.auto ? 'primary' : '')}${ui.state.confirm === `fire${h.id}` ? btn('dismiss', h.id, 'Really? Let them go', 'danger') : btn('confirmfire', h.id, 'Let go', 'danger')}</div>`;
    return { title: `${cls.icon} ${h.name}`, html, back: true };
}

// ---------------------------------------------------------------- QUESTS
function questCard(G, q, mode) {
    const reg = REGIONS[q.region];
    const drops = q.drops.filter((d) => d.chance >= 0.3).map((d) => icon(d.item)).join('');
    const ready = readyHeroes(G).filter((h) => h.auto === undefined || true);
    const best = ready.slice().sort((a, b) => heroPower(G, b) - heroPower(G, a)).slice(0, q.slots);
    const ch = best.length ? partyChance(G, best, q).chance : 0;
    const req = q.req ? ` · needs ${Object.entries(q.req).map(([k, n]) => `${n}× ${icon(k)}`).join(' ')}` : '';
    if (q.pid) {
        const p = G.parties.find((x) => x.id === q.pid);
        return `<div class="item"><i class="ic">${reg.icon}</i><span class="grow"><span class="ttl">${esc(q.name)}</span>${p ? bar(p.dur - p.t, p.dur) : ''}<span class="sub">${p ? `${dur(p.t)} left · ${p.heroes.map((id) => esc(hById(G, id)?.name || '?')).join(', ')} · ${pct(p.chance)} chance` : ''}</span></span>${p && q.kind !== 'boss' ? btn('recall', q.pid, 'Recall') : ''}</div>`;
    }
    return `<button class="item card-btn" data-a="qsel" data-p="${q.id}"><i class="ic">${reg.icon}</i><span class="grow"><span class="ttl">${esc(q.name)} ${q.kind === 'boss' ? pill('BOSS', 'bad') : ''}</span>
        <span class="sub">${esc(reg.name)} · power ${q.need} · up to ${q.slots} hero${q.slots > 1 ? 'es' : ''} · ⏱ ${dur(q.dur)}${req}</span>
        <span class="sub">${q.gold}🪙 · ${q.xp}xp ${q.renown ? `· ${q.renown}⭐ ` : ''}${drops}${q.exp < 1e8 ? ` · ${Math.max(0, q.exp - G.day + 1)}d left` : ''}</span></span>
        ${best.length ? `<span class="pill ${ch >= 0.75 ? 'good' : ch >= 0.5 ? 'warn' : 'bad'}">${pct(ch)}</span>` : ''}</button>`;
}

export function panelQuests(ui, G) {
    const qid = ui.state.quest;
    if (qid != null) {
        const q = G.board.find((x) => x.id === qid);
        if (q && !q.pid) return panelParty(ui, G, q);
        ui.state.quest = null;
    }
    const tab = ui.tab('quests', 'board');
    const out = G.parties.length;
    const tabs = [{ id: 'board', name: 'Board', on: tab === 'board' }, { id: 'out', name: `Out (${out})`, on: tab === 'out' }, { id: 'map', name: 'Map', on: tab === 'map' }];
    if (!builtOf(G, 'guild').length) return { title: '🗺️ Quests', tabs: [], html: '<div class="note">Build the Adventurers\' Lodge (Hall level 2) to post quests and hire heroes.</div>' };
    if (tab === 'map') {
        const rows = Object.entries(REGIONS).map(([id, r]) => {
            const open = guildLv(G) >= r.guild;
            const done = G.stats.regionDone[id] || 0;
            return `<div class="item" style="${open ? '' : 'opacity:.55'}"><i class="ic">${r.icon}</i><span class="grow"><span class="ttl">${esc(r.name)}</span><span class="sub">${open ? esc(r.desc) : `🔒 Lodge level ${r.guild}`}</span><span class="sub">${done} won</span></span></div>`;
        }).join('');
        return { title: '🗺️ Quests', tabs, html: `<div class="list">${rows}</div>` };
    }
    if (tab === 'out') {
        const rows = G.parties.map((p) => questCard(G, { ...p.q, pid: p.id }, 'out')).join('');
        return { title: '🗺️ Quests', tabs, html: rows ? `<div class="list">${rows}</div>` : '<div class="empty">Nobody is out. Heroes on <b>auto</b> will take on jobs by themselves when they are rested, fed and healthy.</div>' };
    }
    const open = G.board.filter((q) => !q.pid);
    const html = `<div class="dim" style="margin-bottom:6px">${readyHeroes(G).length} heroes ready · heroes on auto-quest pick the best job they can do. Tap a job to choose a party yourself.</div><div class="list">${open.length ? open.map((q) => questCard(G, q, 'board')).join('') : '<div class="empty">The board is empty. New jobs are posted each morning.</div>'}</div>`;
    return { title: '🗺️ Quests', tabs, html };
}

function panelParty(ui, G, q) {
    const reg = REGIONS[q.region];
    const sel = ui.state.party.filter((id) => hById(G, id));
    ui.state.party = sel;
    const chosen = sel.map((id) => hById(G, id));
    const { power, chance } = partyChance(G, chosen, q);
    const rows = G.heroes.map((h) => {
        const ready = readyHeroes(G).includes(h);
        const on = sel.includes(h.id);
        const why = h.st === 'away' ? 'away' : !ready ? (h.st !== 'idle' ? 'busy' : h.hunger < 35 ? 'hungry' : h.energy < 32 ? 'tired' : 'hurt') : '';
        return `<button class="item card-btn ${on ? 'sel' : ''}" data-a="qhero" data-p="${h.id}" ${ready || on ? '' : 'style="opacity:.55"'}><i class="pt" style="background-image:url(${portrait(h, 'h', G)})"></i><span class="grow"><span class="ttl">${esc(h.name)} <small class="dim">${HERO_CLASSES[h.cls].icon} lv ${h.lv}</small></span><span class="sub">power ${Math.round(heroPower(G, h))}${h.pots.length ? ' · ' + h.pots.map((p) => ITEMS[p].icon).join('') : ''}${why ? ' · ' + why : ''}</span></span><span class="pill ${on ? 'good' : ''}">${on ? '✔' : ''}</span></button>`;
    }).join('');
    const missingReq = q.req ? Object.entries(q.req).filter(([k, n]) => stock(G, k) < n) : [];
    const html = `<div class="note" style="background:#fff;border-color:var(--line)"><b>${reg.icon} ${esc(q.name)}</b><div class="dim">${esc(q.text)}</div><div class="dim" style="margin-top:4px">Power needed ${q.need} · up to ${q.slots} hero${q.slots > 1 ? 'es' : ''} · ⏱ ${dur(q.dur)} · ${q.gold}🪙 ${q.renown ? `· ${q.renown}⭐` : ''}</div>${q.req ? `<div style="margin-top:4px">Delivers: ${costHTML(G, q.req)}</div>` : ''}</div>`
        + sec('Party', `<div class="row2"><span class="dim">Party power ${Math.round(power)} of ${q.need}</span><span class="pill ${chance >= 0.75 ? 'good' : chance >= 0.5 ? 'warn' : 'bad'}" style="font-size:14px">${chosen.length ? pct(chance) + ' to succeed' : 'pick heroes'}</span></div>${bar(Math.min(power, q.need), q.need)}<div class="dim" style="margin-top:4px">Hunger, mood, health, potions and food buffs all count. A failed quest hurts, but nobody is ever lost.</div>`)
        + `<div class="list">${rows || '<div class="empty">No heroes yet.</div>'}</div>`
        + `<div class="btnrow">${btn('dispatch', '', `Send ${chosen.length || ''} ${chosen.length === 1 ? 'hero' : 'heroes'}`, chosen.length && !missingReq.length ? 'primary' : '', !chosen.length || !!missingReq.length)}${btn('qback', '', 'Back')}</div>${missingReq.length ? `<div class="note bad" style="margin-top:6px">Needs ${missingReq.map(([k, n]) => `${n}× ${esc(iname(k))}`).join(', ')} in storage.</div>` : ''}`;
    return { title: `${reg.icon} ${q.name}`, html, back: true };
}

// ---------------------------------------------------------------- JOURNAL
export function panelJournal(ui, G) {
    const tab = ui.tab('journal', 'now');
    const tabs = [{ id: 'now', name: 'Now', on: tab === 'now', dot: claimable(G).length }, { id: 'done', name: 'Done', on: tab === 'done' }];
    const entry = (e, claimed) => {
        const p = progress(G, e);
        const ready = G.journal[e.id] === 'ready';
        const r = Object.entries(e.reward).map(([k, n]) => (k === 'special' ? `⭐ ${esc(SPECIALS[n].name)}` : k === 'renown' ? `${n}⭐` : `${n}${icon(k)}`)).join(' ');
        return `<div class="item" style="${ready ? 'background:#f1fae6;border-color:var(--leaf-d)' : ''}${claimed ? ';opacity:.6' : ''}"><i class="ic">${claimed ? '✅' : ready ? '🎁' : '📜'}</i><span class="grow"><span class="ttl">${esc(e.title)}</span><span class="sub">${esc(e.text)}</span>${claimed ? '' : bar(p.cur, p.need)}<span class="sub">${claimed ? '' : p.detail ? esc(p.detail) + ' · ' : `${fmt(Math.min(p.cur, p.need))}/${fmt(p.need)} · `}Reward: ${r}</span></span>${ready ? btn('claim', e.id, 'Claim!', 'primary') : claimed ? '' : btn('pin', e.id, G.pinned === e.id ? '📌' : '📍')}</div>`;
    };
    if (tab === 'done') {
        const done = JOURNAL_IDS.filter((id) => G.journal[id] === 'claimed');
        return { title: '📜 Journal', tabs, html: done.length ? `<div class="list">${done.map((id) => entry(JOURNAL[id], true)).join('')}</div>` : '<div class="empty">Nothing finished yet.</div>' };
    }
    let html = '';
    for (const ch of CHAPTERS) {
        const es = JOURNAL_IDS.filter((id) => JOURNAL[id].ch === ch.id && G.journal[id] !== 'claimed' && isOpen(G, JOURNAL[id]));
        const total = JOURNAL_IDS.filter((id) => JOURNAL[id].ch === ch.id).length;
        const done = JOURNAL_IDS.filter((id) => JOURNAL[id].ch === ch.id && G.journal[id] === 'claimed').length;
        if (!es.length) continue;
        html += sec(`Chapter ${ch.id}: ${esc(ch.name)} <span class="pill">${done}/${total}</span>`, `<div class="dim" style="margin-bottom:6px">${esc(ch.blurb)}</div><div class="list">${es.map((id) => entry(JOURNAL[id], false)).join('')}</div>`);
    }
    if (!html) html = G.flags.won ? '<div class="note good">Every entry is complete. You did it. The town is yours to keep cozy forever.</div>' : '<div class="empty">All caught up for now. Grow the town and more entries open up.</div>';
    return { title: '📜 Journal', tabs, html };
}

// ---------------------------------------------------------------- UPGRADES
export function panelUpgrades(ui, G) {
    const tab = ui.tab('upgrades', 'gather');
    const tabs = Object.entries(BRANCHES).map(([id, b]) => ({ id, name: `${b.icon} ${b.name}`, on: tab === id }));
    const cards = Object.values(UPGRADES).filter((u) => u.branch === tab).sort((a, b) => a.hall - b.hall).map((u) => {
        const owned = !!G.upgrades[u.id];
        const lockedHall = hallLv(G) < u.hall;
        const lockedReq = u.req.some((r) => !G.upgrades[r]);
        const cost = upgradeCost(G, u.id);
        const can = !owned && !lockedHall && !lockedReq && missing(G, cost).length === 0;
        return `<div class="item" style="${owned ? 'background:#f1fae6;border-color:var(--leaf-d)' : lockedHall || lockedReq ? 'opacity:.6' : ''}"><i class="ic">${u.icon}</i><span class="grow"><span class="ttl">${esc(u.name)}</span><span class="sub">${esc(u.text)}</span>${owned ? '' : lockedHall ? `<span class="sub">🔒 Hall level ${u.hall}</span>` : lockedReq ? `<span class="sub">🔒 needs ${u.req.map((r) => esc(UPGRADES[r].name)).join(', ')}</span>` : `<span style="display:block;margin-top:3px">${costHTML(G, cost)}</span>`}</span>${owned ? pill('Learned', 'good') : btn('research', u.id, 'Learn', can ? 'primary' : '', !can)}</div>`;
    }).join('');
    return { title: '⭐ Upgrades', tabs, html: `<div class="dim" style="margin-bottom:6px">${Object.keys(G.upgrades).length}/${Object.keys(UPGRADES).length} learned. Upgrades are forever.</div><div class="list">${cards}</div>` };
}

// ---------------------------------------------------------------- ITEMS
export function panelItems(ui, G) {
    const tab = ui.tab('items', 'raw');
    const cats = [['raw', 'Goods'], ['mat', 'Materials'], ['dish', 'Food'], ['gear', 'Gear'], ['potion', 'Potions']];
    const tabs = cats.map(([id, n]) => ({ id, name: n, on: tab === id }));
    const ids = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === tab && (stock(G, k) > 0 || tab === 'raw' || tab === 'mat'));
    const rows = ids.map((k) => {
        const it = ITEMS[k], n = stock(G, k), cap = capOf(G, k);
        return `<div class="item" style="${n ? '' : 'opacity:.5'}"><i class="ic">${it.icon}</i><span class="grow"><span class="ttl">${esc(it.name)}</span><span class="sub">${esc(itemStats(it))}</span></span><span style="text-align:right"><b>${fmt(n)}</b><span class="dim">/${fmt(cap)}</span>${n >= cap ? '<br>' + pill('full', 'warn') : ''}</span></div>`;
    }).join('');
    const m = G.merchant ? `<div class="note">🐪 A travelling merchant is in town. ${btn('open', 'merchant', 'Browse')}</div>` : '';
    return { title: '🎒 Storehouse', tabs, html: `${m}<div class="list">${rows || '<div class="empty">Nothing here yet.</div>'}</div>` };
}

export function panelMerchant(ui, G) {
    const m = G.merchant;
    if (!m) return { title: '🐪 Merchant', html: '<div class="empty">The merchant has packed up and moved on. They come around every few days.</div>' };
    const rows = m.offers.map((o, i) => `<div class="item"><i class="ic">${icon(o.item)}</i><span class="grow"><span class="ttl">${esc(iname(o.item))} × ${o.n}</span><span class="sub">${o.price}🪙 each · you have ${fmt(stock(G, o.item))}</span></span>${btn('merchant', `${i}|1`, 'Buy 1', G.gold >= o.price && o.n > 0 ? 'primary' : '', o.n <= 0)}${btn('merchant', `${i}|${o.n}`, 'All', '', o.n <= 0)}</div>`).join('');
    return { title: '🐪 Travelling merchant', html: `<div class="note">Rare goods at a premium. They leave at dusk.</div><div class="list">${rows}</div>` };
}
