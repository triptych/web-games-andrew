// The dock's six panels. Each has sig(G) — a string that changes only when the panel's structure does — and
// html(G). The panel is rebuilt only when its sig changes, so a button never vanishes under a finger; the
// numbers that tick every second are filled in place through data attributes (see LIVE below).

import { CLASSES, UPGRADES, GOODS, GOOD, MATS, TOWN, REGIONS, SLOTS, SLOT_NAME, cartUpCost, cartCap, STORY } from '../sim/data.js';
import { RARITY, QUESTS, xpForLevel, caravanXpFor } from '../config.js';
import { memberStats, maxHp, partySlots, partyHealth, partyPower, upgradeCost, itemScore, canWear, cartLevel } from '../sim/party.js';
import { buyPrice, sellPrice, cargoCap, cargoUsed, larderCap, rationPrice } from '../sim/economy.js';
import { dijkstra, speed, nextWarden, regionOpen, miles } from '../sim/world.js';
import { wardenHere } from '../sim/game.js';
import { cookTime, forgeTime, brewTime } from '../sim/data.js';
import { esc, fmtTime, fmtNum, LOG_ICON } from './fmt.js';

const mem = (G, id) => G.party.find((m) => m.id === +id);
const rar = (it) => `rar${it.rarity}`;
export function itemStats(it) {
    const s = it.stats, o = [];
    if (s.atk) o.push(`⚔${s.atk}`); if (s.def) o.push(`🛡${s.def}`); if (s.hp) o.push(`❤${s.hp}`); if (s.spd) o.push(`💨${s.spd}`);
    return o.join(' ');
}
const costHtml = (gold, mats = {}) => [`${fmtNum(gold)}g`, ...Object.entries(mats).map(([k, n]) => `${n} ${MATS.find((m) => m.id === k).icon}`)].join(' + ');

// ------------------------------------------------------------------ live values
export const LIVE = {
    hp: (G, id) => { const m = mem(G, id); return m ? m.hp / maxHp(m) : 0; },
    hpText: (G, id) => { const m = mem(G, id); return m ? (m.down ? 'resting' : `${Math.round(m.hp)}/${maxHp(m)}`) : ''; },
    xp: (G, id) => { const m = mem(G, id); return m ? m.xp / xpForLevel(m.level) : 0; },
    cxp: (G) => G.xp / caravanXpFor(G.level),
    craft: (G, id) => { const m = mem(G, id); if (!m) return 0; const t = m.cls === 'cook' ? cookTime(m.cart) : m.cls === 'smith' ? forgeTime(m.cart) : brewTime(m.cart); return m.timer / t; },
    gold: (G) => fmtNum(G.gold),
    rations: (G) => `${G.rations}/${larderCap(G)}`,
    potions: (G) => String(G.potions),
    cargo: (G) => `${cargoUsed(G)}/${cargoCap(G)}`,
    buy: (G, g) => (G.at ? `${buyPrice(G, G.at, g)}` : '–'),
    sell: (G, g) => (G.at ? `${sellPrice(G, G.at, g)}` : '–'),
    have: (G, g) => String(G.cargo[g]?.n || 0),
    mat: (G, k) => String(G.mats[k]),
    health: (G) => partyHealth(G),
    buffs: (G) => buffText(G),
    power: (G) => fmtNum(partyPower(G)),
    offer: (G, id) => { const o = G.offers.find((x) => x.m.id === +id); return o ? `waits ${fmtTime(o.until - G.t)}` : ''; },
    odds: (G) => (G.oddsCache ? `${Math.round(G.oddsCache.p * 100)}%` : '?'),
    ration: (G) => (G.at ? `${rationPrice(G, G.at)}g each` : ''),
};

function buffText(G) {
    const o = [];
    if (G.buffs.rally > G.t) o.push(`🐂 Rally ${G.buffs.rally - G.t}s`);
    if (G.buffs.shrine && G.buffs.shrine.until > G.t) o.push(`⛩️ ${({ xp: '+25% xp', might: '+15% attack', swift: '+25% speed' })[G.buffs.shrine.kind]} ${fmtTime(G.buffs.shrine.until - G.t)}`);
    if (G.buffs.storm > G.t) o.push(`🌧️ storm ${G.buffs.storm - G.t}s`);
    if (G.rations <= 0) o.push('😖 hungry: slow and weak');
    else if (cartLevel(G, 'cook')) o.push('🍲 well fed');
    if (G.camp) o.push('🔥 camping');
    return o.join(' · ') || 'No effects.';
}

// ------------------------------------------------------------------ Road
const ROUTES = [['quests', '📜 Quests'], ['trade', '⚖️ Trade'], ['explore', '🧭 Explore'], ['hold', '⚓ Hold']];
const ROUTE_HELP = { quests: 'Drive towards quest targets, Wardens it can beat, then the best trade.', trade: 'Chase the best prices for the goods in the hold.', explore: 'Visit the towns it has seen least.', hold: 'Stay in town until you set a course.' };

export const road = {
    sig: (G) => [G.at, G.road?.to, G.camp, G.orders.route, G.orders.camp, G.party.map((m) => m.id + (m.down ? 'd' : '')).join(','), G.course].join('|'),
    html(G) {
        const parts = [];
        parts.push(`<div class="sec"><h3>Standing orders</h3><div class="chips">${ROUTES.map(([k, l]) => `<button class="chipbtn${G.orders.route === k ? ' on' : ''}" data-act="route" data-v="${k}">${l}</button>`).join('')}</div>
            <p class="dim">${ROUTE_HELP[G.orders.route]}${G.course ? ` Heading for <b>${esc(TOWN[G.course].name)}</b> first. <button class="btn small" data-act="clearCourse">Cancel course</button>` : ''}</p>
            <div class="row2"><span class="dim grow">Make camp when health falls below</span>${[0.3, 0.5, 0.7].map((v) => `<button class="chipbtn${Math.abs(G.orders.camp - v) < 0.01 ? ' on' : ''}" data-act="campAt" data-v="${v}">${v * 100}%</button>`).join('')}</div>
            ${G.road ? `<div class="btns"><button class="btn small" data-act="rest">${G.camp ? '⛺ Break camp' : '🔥 Make camp now'}</button></div>` : ''}</div>`);
        parts.push(`<div class="sec"><h3>The party <span>health <i class="bar hp" style="display:inline-block;width:80px;vertical-align:middle"><i data-w="health"></i></i></span></h3>
            ${G.party.map((m) => `<div class="row2" style="margin-bottom:6px"><span class="ico">${CLASSES[m.cls].icon}</span><div class="grow"><div class="small"><b>${esc(m.name)}</b> <span class="dim">${CLASSES[m.cls].name} ${m.level}</span> <span class="tiny" data-t="hpText:${m.id}"></span></div><div class="bar hp"><i data-w="hp:${m.id}"></i></div></div></div>`).join('')}
            <p class="dim small" data-t="buffs"></p></div>`);
        parts.push(`<div class="sec"><h3>Journal</h3><ul class="log" data-html="journal"></ul></div>`);
        return parts.join('');
    },
};

export function journalHtml(G) {
    return G.log.slice(-60).reverse().map((e) => `<li class="${e.hi ? 'hi' : ''}"><span class="t">${fmtTime(G.t - e.t)}</span><span>${LOG_ICON[e.k] || '•'}</span><span>${esc(e.s)}</span></li>`).join('') || '<li class="dim">Nothing yet. The road is long.</li>';
}

// ------------------------------------------------------------------ Caravan
export const caravan = {
    sig: (G) => [G.level, JSON.stringify(G.up), G.party.map((m) => `${m.id}:${m.level}:${m.cart}:${SLOTS.map((s) => m.gear[s]?.id || 0).join('.')}`).join(','), G.offers.map((o) => o.m.id).join(','), G.at].join('|'),
    html(G) {
        const slots = partySlots(G.level), full = G.party.length >= slots;
        const p = [];
        p.push(`<div class="sec"><div class="card"><div class="row2"><span class="ico">🏮</span><div class="grow"><div class="name">The Wanderwain · level ${G.level}</div>
            <div class="bar xp"><i data-w="cxp"></i></div><div class="tiny">${G.party.length}/${slots} travellers · power <span data-t="power"></span> · carts up to level ${cartCap(G.level)}</div></div></div></div></div>`);
        if (G.offers.length) {
            p.push(`<div class="sec"><h3>Met on the road</h3>${G.offers.map((o) => {
                const c = CLASSES[o.m.cls];
                return `<div class="card hi"><div class="row2"><span class="ico">${c.icon}</span><div class="grow"><div class="name">${esc(o.m.name)}</div><div class="dim small">${c.name} ${o.m.level} with a ${c.cart}. <span data-t="offer:${o.m.id}"></span></div><div class="tiny">${esc(c.role)} ${esc(c.text(1))}</div></div></div>
                <div class="btns"><button class="btn primary small" data-act="acceptOffer" data-id="${o.m.id}"${full ? ' disabled' : ''}>${full ? 'No room' : 'Welcome aboard'}</button><button class="btn small" data-act="declineOffer" data-id="${o.m.id}">Send on their way</button></div></div>`;
            }).join('')}</div>`);
        }
        p.push(`<div class="sec"><h3>The Wanderwain</h3>${Object.entries(UPGRADES).map(([k, u]) => {
            const l = G.up[k], cost = upgradeCost(G, k);
            return `<div class="card"><div class="row2"><span class="ico">${u.icon}</span><div class="grow"><div class="name small">${u.name} <span class="dim">${l}/${u.max}</span></div><div class="tiny">${u.text(l)}${cost !== null ? ` → <b>${u.text(l + 1)}</b>` : ''}</div></div>
                ${cost !== null ? `<button class="btn small" data-act="upgrade" data-k="${k}" data-gold="${cost}">${fmtNum(cost)}g</button>` : '<span class="dim">max</span>'}</div></div>`;
        }).join('')}</div>`);
        p.push(`<div class="sec"><h3>Travellers and their carts</h3>${G.party.map((m) => memberCard(G, m)).join('')}</div>`);
        return p.join('');
    },
};

function memberCard(G, m) {
    const c = CLASSES[m.cls], s = memberStats(m);
    const crafts = m.cls === 'cook' || m.cls === 'smith' || m.cls === 'alchemist';
    const up = m.cls !== 'captain' ? cartUpCost(m.cls, m.cart) : null;
    const capped = m.cart >= cartCap(G.level);
    const gear = SLOTS.map((sl) => {
        const it = m.gear[sl];
        return `<button class="slot" data-act="slot" data-id="${m.id}" data-slot="${sl}"><span class="tiny">${SLOT_NAME[sl]}</span><span class="r ${it ? rar(it) : 'dim'}">${it ? esc(it.name) : '—'}</span><span class="tiny">${it ? itemStats(it) : 'empty'}</span></button>`;
    }).join('');
    return `<div class="card"><div class="row2"><span class="ico">${c.icon}</span><div class="grow"><div class="name">${esc(m.name)} <span class="dim">${c.name} · level ${m.level}</span></div>
        <div class="bar hp"><i data-w="hp:${m.id}"></i></div><div class="bar xp"><i data-w="xp:${m.id}"></i></div>
        <div class="stats"><span>❤ <b>${s.hp}</b></span><span>⚔ <b>${s.atk}</b></span><span>🛡 <b>${s.def}</b></span><span>💨 <b>${s.spd}</b></span></div></div></div>
        <div class="tiny" style="margin-top:4px">${esc(c.role)}</div>
        <div class="gear">${gear}</div>
        <div class="card" style="margin:8px 0 0;background:rgba(0,0,0,0.18)"><div class="small"><b>${c.cart}</b>${m.cls !== 'captain' ? ` · level ${m.cart}` : ''}</div><div class="tiny">${esc(c.text(m.cart))}</div>
        ${crafts ? `<div class="bar"><i data-w="craft:${m.id}"></i></div>` : ''}
        ${up ? `<div class="btns"><button class="btn small" data-act="cartUp" data-id="${m.id}" data-gold="${up.gold}" data-need='${JSON.stringify(up.mats)}'${capped ? ' disabled' : ''}>${capped ? `Caravan level ${m.cart * 3} for more` : `Upgrade: ${costHtml(up.gold, up.mats)}`}</button>
            <button class="btn small danger" data-act="dismiss" data-id="${m.id}">Part ways</button></div>` : ''}</div></div>`;
}

// ------------------------------------------------------------------ Pack
const TOGGLES = [['autoTrade', 'Trade automatically in towns'], ['autoEquip', 'Wear better gear as it comes'], ['autoSell', 'Sell gear nobody needs (Common, Fine)'], ['autoQuests', 'Take quests from notice boards'], ['autoChallenge', 'Challenge Wardens when the odds are good']];

export const pack = {
    sig: (G) => [G.pack.map((i) => i.id).join(','), Object.keys(G.cargo).join(','), JSON.stringify(G.orders), G.party.map((m) => m.level + ':' + SLOTS.map((s) => m.gear[s]?.id || 0).join('.')).join(','), !!G.at].join('|'),
    html(G) {
        const p = [];
        p.push(`<div class="sec"><h3>Supplies</h3><div class="stat-grid"><div>🍞 Rations<b data-t="rations"></b></div><div>🧪 Potions<b data-t="potions"></b></div><div>📦 Hold<b data-t="cargo"></b></div></div>
            <div class="stat-grid">${MATS.map((m) => `<div>${m.icon} ${m.name}<b data-t="mat:${m.id}"></b></div>`).join('')}</div></div>`);
        const cargo = Object.entries(G.cargo);
        p.push(`<div class="sec"><h3>Cargo</h3>${cargo.length ? `<table class="market">${cargo.map(([g, c]) => `<tr><td>${GOOD[g].icon} ${GOOD[g].name}</td><td class="n">${c.n} × ~${Math.round(c.cost / c.n)}g</td>${G.at ? `<td class="n">sells <b data-t="sell:${g}"></b></td><td class="n"><button class="btn small" data-act="sell" data-g="${g}" data-n="999">Sell all</button></td>` : ''}</tr>`).join('')}</table>` : '<p class="dim">The hold is empty.</p>'}</div>`);
        const items = [...G.pack].sort((a, b) => b.rarity - a.rarity || itemScore(b) - itemScore(a));
        p.push(`<div class="sec"><h3>Gear <span class="btns" style="margin:0"><button class="btn small" data-act="equipBest">Wear best</button><button class="btn small" data-act="sellJunk">Sell junk</button></span></h3>
            ${items.length ? items.map((it) => {
                const who = G.party.filter((m) => canWear(m, it));
                return `<div class="card"><div class="row2"><div class="grow"><div class="small ${rar(it)}"><b>${esc(it.name)}</b></div><div class="tiny">${RARITY[it.rarity].name} ${SLOT_NAME[it.slot].toLowerCase()} · item level ${it.ilvl} · ${itemStats(it)}</div></div>
                <button class="btn small" data-act="give" data-item="${it.id}"${who.length ? '' : ' disabled'}>${who.length ? 'Give' : `Level ${it.ilvl - 2}`}</button><button class="btn small" data-act="sellItem" data-item="${it.id}">${it.value}g</button></div></div>`;
            }).join('') : '<p class="dim">Nothing spare in the pack.</p>'}</div>`);
        p.push(`<div class="sec"><h3>Quartermaster</h3><div class="card">${TOGGLES.map(([k, l]) => `<label class="toggle"><span>${l}</span><input type="checkbox" data-act="toggle" data-k="${k}"${G.orders[k] ? ' checked' : ''}></label>`).join('')}</div></div>`);
        return p.join('');
    },
};

// ------------------------------------------------------------------ Quests
function questLine(G, q) {
    const prog = q.kind === 'bounty' ? `${q.have}/${q.n}` : q.kind === 'deliver' ? `${Math.min(q.n, G.cargo[q.good]?.n || 0)}/${q.n} carried` : 'deliver';
    const where = q.town ? ` → ${esc(TOWN[q.town].name)}` : q.region !== undefined ? ` · ${REGIONS[q.region].name}` : '';
    return { prog, where };
}

export const quests = {
    sig: (G) => [G.quests.map((q) => q.id + ':' + q.have).join(','), G.daily.day, G.daily.claimed, G.daily.contracts.map((q) => q.done + ':' + q.have).join(','), G.lit.join(''), G.ended, G.tier, Object.keys(G.cargo).map((k) => G.cargo[k].n).join(',')].join('|'),
    html(G) {
        const p = [];
        const w = nextWarden(G), W = REGIONS[w].warden;
        p.push(`<div class="sec"><h3>The Waystones</h3><div class="card"><div class="chips" style="font-size:22px">${G.lit.map((l, i) => `<span title="${REGIONS[i].name}">${l ? '🔥' : '🪨'}</span>`).join('')}</div>
            <p class="small">${G.ended ? `Every Waystone burns. <b>The Night Roads</b> (Night ${G.tier}): beat ${W.name} again at ${TOWN[W.town].name} to go darker and richer.` : `Next: light the Waystone of <b>${TOWN[W.town].name}</b> in ${REGIONS[w].name}. ${W.name}, ${W.title}, level ${W.level}.`}</p></div></div>`);
        const d = G.daily;
        p.push(`<div class="sec"><h3>Morning post</h3><div class="card${d.claimed ? '' : ' hi'}"><div class="row2"><span class="ico">📬</span><div class="grow small">${d.day < 0 ? 'The first post comes tomorrow.' : d.claimed ? `Opened today. Come back tomorrow: ${d.streak} day${d.streak === 1 ? '' : 's'} in a row.` : `A parcel from Hearthford is waiting. Day ${d.streak} in a row: bigger every day.`}</div>
            ${d.claimed ? '' : '<button class="btn primary small" data-act="claimPost">Open</button>'}</div></div>
            ${d.contracts.map((q) => { const l = questLine(G, q); return `<div class="card"><div class="small"><b>${q.done ? '✅ ' : '📜 '}${esc(q.title)}</b>${l.where}</div><div class="tiny">Contract: ${q.done ? 'done' : l.prog} · ${q.gold}g, ${q.xp} xp and a rare piece of gear</div></div>`; }).join('')}</div>`);
        p.push(`<div class="sec"><h3>Quests <span class="dim">${G.quests.length}/${QUESTS.active}</span></h3>${G.quests.length ? G.quests.map((q) => {
            const l = questLine(G, q);
            return `<div class="card"><div class="row2"><div class="grow"><div class="small"><b>${esc(q.title)}</b>${l.where}</div><div class="tiny">${l.prog} · ${q.gold}g, ${q.xp} xp · from ${esc(TOWN[q.from].name)}</div></div><button class="btn small" data-act="abandon" data-id="${q.id}">Drop</button></div></div>`;
        }).join('') : '<p class="dim">No quests. Notice boards in every town have more.</p>'}</div>`);
        return p.join('');
    },
};

// ------------------------------------------------------------------ Map
export const map = {
    sig: (G, ui) => [ui.mapSel, G.at, G.course, G.lit.join(''), G.road?.to].join('|'),
    html(G, ui) {
        const sel = ui.mapSel && TOWN[ui.mapSel];
        let info = '<p class="dim">Tap a town to see it, and to set a course.</p>';
        if (sel) {
            const here = G.at || G.road?.to;
            const { dist } = dijkstra(G, here);
            const open = regionOpen(G, sel.region);
            const d = dist[sel.id];
            const eta = d !== undefined ? fmtTime(d / speed(G)) : null;
            info = `<div class="card"><div class="name">${esc(sel.name)} ${sel.capital ? (G.lit[sel.region] ? '🔥' : '🪨') : ''}</div><div class="dim small">${REGIONS[sel.region].name}${sel.capital ? ' · a Waystone town' : ''}</div>
                <p class="small">${esc(sel.blurb)}</p>
                <div class="tiny">Makes: ${sel.produces.map((g) => GOOD[g].icon + ' ' + GOOD[g].name).join(', ')} · Wants: ${sel.wants.map((g) => GOOD[g].icon + ' ' + GOOD[g].name).join(', ')}</div>
                <div class="btns">${G.at === sel.id ? '<span class="dim">You are here.</span>' : !open ? `<span class="dim">The roads here are dark. Light the Waystone of ${esc(TOWN[REGIONS[sel.region - 1].warden.town].name)} first.</span>` : d === undefined ? '<span class="dim">No open road there yet.</span>' : `<button class="btn primary small" data-act="course" data-town="${sel.id}">Set course · ${Math.round(d)} mi · ${eta}</button>`}</div></div>`;
        }
        return `<div class="mapwrap"><canvas id="map" aria-label="Map of the realm"></canvas></div><div class="sec" style="margin-top:10px">${info}</div>`;
    },
};

// ------------------------------------------------------------------ Town
export const town = {
    sig: (G) => [G.at, G.tavern.map((o) => o.m.id).join(','), G.board.map((q) => q.id).join(','), Object.keys(G.cargo).join(','), wardenHere(G), G.oddsCache?.p, G.party.length, partySlots(G.level), G.quests.length, G.lit.join('')].join('|'),
    html(G) {
        if (!G.at) {
            const r = G.road;
            return `<div class="sec"><div class="card"><p class="small">On the road${r ? ` to <b>${esc(TOWN[r.to].name)}</b>, ${Math.max(0, Math.round(r.miles - r.done))} miles on.` : '.'}</p><p class="dim small">Markets, taverns, notice boards and Wardens are in towns.</p></div></div>`;
        }
        const T = TOWN[G.at], p = [];
        p.push(`<div class="sec"><div class="card"><div class="name">${esc(T.name)}</div><div class="dim small">${REGIONS[T.region].name} · ${esc(T.blurb)}</div></div></div>`);
        const w = wardenHere(G);
        if (w !== null) {
            const W = REGIONS[w].warden;
            p.push(`<div class="sec"><h3>The Waystone</h3><div class="card hi"><div class="row2"><span class="ico">🗿</span><div class="grow"><div class="name">${W.name}</div><div class="dim small">${W.title} · level ${W.level + 10 * (G.tier + (G.ended ? 1 : 0))}</div><div class="small">Your odds: <b data-t="odds"></b></div></div></div>
                <div class="btns"><button class="btn small" data-act="odds">Check the odds</button><button class="btn primary small" data-act="challenge">Challenge</button></div></div></div>`);
        }
        const free = cargoCap(G) - cargoUsed(G);
        p.push(`<div class="sec"><h3>Market <span class="dim">hold <span data-t="cargo"></span></span></h3><table class="market"><tr class="tiny"><td>Good</td><td class="n">buy</td><td class="n">sell</td><td class="n">have</td><td></td></tr>
            ${GOODS.filter((g) => regionOpen(G, g.region)).map((g) => {
                const cls = T.produces.includes(g.id) ? 'cheap' : T.wants.includes(g.id) ? 'dear' : '';
                return `<tr><td class="${cls}">${g.icon} ${g.name}${T.produces.includes(g.id) ? ' <span class="tiny">made here</span>' : T.wants.includes(g.id) ? ' <span class="tiny">wanted</span>' : ''}</td><td class="n" data-t="buy:${g.id}"></td><td class="n" data-t="sell:${g.id}"></td><td class="n" data-t="have:${g.id}"></td>
                <td class="n"><button class="btn" data-act="buy" data-g="${g.id}" data-n="5"${free > 0 ? '' : ' disabled'}>+5</button> <button class="btn" data-act="sell" data-g="${g.id}" data-n="5"${G.cargo[g.id] ? '' : ' disabled'}>−5</button></td></tr>`;
            }).join('')}</table>
            <div class="row2" style="margin-top:8px"><span class="grow small">🍞 Rations <span data-t="rations"></span> <span class="tiny" data-t="ration"></span></span><button class="btn small" data-act="rations">Fill the larder</button></div></div>`);
        const full = G.party.length >= partySlots(G.level);
        p.push(`<div class="sec"><h3>Tavern</h3>${G.tavern.length ? G.tavern.map((o, i) => {
            const c = CLASSES[o.m.cls];
            return `<div class="card"><div class="row2"><span class="ico">${c.icon}</span><div class="grow"><div class="name">${esc(o.m.name)}</div><div class="dim small">${c.name} ${o.m.level} · ${c.cart}</div><div class="tiny">${esc(c.role)} ${esc(c.text(1))}</div></div></div>
                <div class="btns"><button class="btn primary small" data-act="hire" data-idx="${i}" data-gold="${o.cost}"${full ? ' disabled' : ''}>${full ? 'No room in the caravan' : `Hire for ${fmtNum(o.cost)}g`}</button></div></div>`;
        }).join('') : '<p class="dim">Nobody looking for a road today.</p>'}</div>`);
        p.push(`<div class="sec"><h3>Notice board</h3>${G.board.length ? G.board.map((q) => {
            const l = questLine(G, q);
            return `<div class="card"><div class="row2"><div class="grow"><div class="small"><b>${esc(q.title)}</b>${l.where}</div><div class="tiny">${q.gold}g, ${q.xp} xp</div></div><button class="btn small" data-act="accept" data-id="${q.id}"${G.quests.length >= QUESTS.active ? ' disabled' : ''}>Take it</button></div></div>`;
        }).join('') : '<p class="dim">The board is bare.</p>'}</div>`);
        return p.join('');
    },
};

export const PANELS = { road, caravan, pack, quests, map, town };
export { STORY, miles };
