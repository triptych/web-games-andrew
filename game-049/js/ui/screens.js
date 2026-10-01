/**
 * screens.js — every overlay: title, hero select, story cards, perk choice,
 * pack, merchant, Wayfarer dialog, journal, big map, pause, help, death and
 * the endings. One screen is open at a time; G is main.js's controller.
 */

import { $ , drawMap } from './hud.js';
import { CLASSES, SKILLS, PERKS } from '../sim/classes.js';
import { WORLDS, PROLOGUE, ENDINGS, FLOORS_PER_WORLD, worldOf } from '../sim/worlds.js';
import { RARITY, describeItem, isGear, CONSUMABLES, BASES } from '../sim/items.js';
import { pstats, price, sellPrice, oilPrice, distinctPages } from '../sim/game.js';
import { QUEST_TITLES } from '../sim/quests.js';
import { sfx } from '../audio.js';

let open = null;
export const openScreen = () => open;

export function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    open = id;
    const first = $(id) && $(id).querySelector('.btn.primary, button');
    if (first && !matchMedia('(pointer: coarse)').matches) setTimeout(() => first.focus({ preventScroll: true }), 0);
}
export function hideAll() {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    open = null;
}

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const btn = (label, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), label); b.addEventListener('click', () => { sfx.click(); fn(); }); return b; };

export function initScreens(G) {
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { sfx.click(); G.closePanel(); }));
    $('btn-new').addEventListener('click', () => { sfx.click(); showClassPick(G); });
    $('btn-continue').addEventListener('click', () => { sfx.click(); G.continueRun(); });
    $('btn-help').addEventListener('click', () => { sfx.click(); G.helpFrom = 'title'; show('help'); });
    $('help-close').addEventListener('click', () => { sfx.click(); G.helpFrom === 'title' ? showTitle(G) : G.helpFrom === 'pause' ? show('pause') : G.closePanel(); });
    $('class-back').addEventListener('click', () => { sfx.click(); showTitle(G); });
    $('class-go').addEventListener('click', () => {
        sfx.click();
        const mode = document.querySelector('input[name="mode"]:checked').value;
        G.newRun(G.pickedClass || 'warden', mode);
    });
    $('pause-resume').addEventListener('click', () => { sfx.click(); G.closePanel(); });
    $('pause-help').addEventListener('click', () => { sfx.click(); G.helpFrom = 'pause'; show('help'); });
    $('pause-quality').addEventListener('click', () => { sfx.click(); G.cycleQuality(); $('pause-quality').textContent = `Graphics: ${['High', 'Medium', 'Low'][G.quality()]}`; });
    $('pause-title').addEventListener('click', () => { sfx.click(); G.toTitle(); });
    $('death-title-btn').addEventListener('click', () => { sfx.click(); G.toTitle(); });
    $('victory-title-btn').addEventListener('click', () => { sfx.click(); G.toTitle(); });
    $('target-cancel').addEventListener('click', () => G.cancelTargeting());
    document.querySelectorAll('#journal .tab').forEach((t) => t.addEventListener('click', () => { sfx.click(); journalTab = t.dataset.tab; renderJournal(G); }));
}

// ------------------------------------------------------------------ Title & hero pick

export function showTitle(G, recs = G.records(), canContinue = G.hasSave()) {
    $('btn-continue').hidden = !canContinue;
    const parts = [];
    if (recs.runs) parts.push(`Deepest floor: <b>${recs.deepest}</b>`);
    if (recs.wins) parts.push(`Lanterns relit: <b>${recs.wins}</b>`);
    if (recs.endings && recs.endings.length) parts.push(`Endings: ${recs.endings.map((e) => ENDINGS[e].title).join(', ')}`);
    $('records').innerHTML = parts.join(' · ');
    show('title');
}

function showClassPick(G) {
    const wrap = $('class-cards');
    wrap.innerHTML = '';
    G.pickedClass = G.pickedClass || 'warden';
    for (const C of Object.values(CLASSES)) {
        const c = h('button', 'class-card' + (C.id === G.pickedClass ? ' on' : ''));
        c.innerHTML = `<span class="swatch" style="background:#${C.col.toString(16).padStart(6, '0')}"></span><h3>${C.name}</h3><div class="tag">${C.tag}</div><p>${C.blurb}</p>
            <div class="skills">${C.skills.map((s) => `<b>${SKILLS[s].icon} ${SKILLS[s].n}</b> <small>(lv ${SKILLS[s].lvl})</small> — ${SKILLS[s].d}`).join('<br>')}</div>`;
        c.addEventListener('click', () => { sfx.click(); G.pickedClass = C.id; wrap.querySelectorAll('.class-card').forEach((x) => x.classList.remove('on')); c.classList.add('on'); });
        wrap.appendChild(c);
    }
    show('classpick');
}

// ------------------------------------------------------------------ Story

export function showStory(G, run) {
    const s = run.story[0];
    const kicker = $('story-kicker'), title = $('story-title'), text = $('story-text'), buttons = $('story-buttons');
    buttons.innerHTML = '';
    const paras = (arr) => arr.map((p) => `<p>${esc(p)}</p>`).join('');
    const W = WORLDS[s.w];
    let next = 'Continue';
    if (s.k === 'prologue') { kicker.textContent = 'Prologue'; title.textContent = 'Lastlight Goes Dark'; text.innerHTML = paras(PROLOGUE); next = 'Take up the lantern'; }
    else if (s.k === 'world') {
        kicker.textContent = `World ${s.w} · Floors ${(s.w - 1) * FLOORS_PER_WORLD + 1}–${s.w * FLOORS_PER_WORLD}`;
        title.textContent = W.chapter; text.innerHTML = `<p><b>${esc(W.name)}.</b> ${esc(W.intro)}</p>`; next = 'Descend';
    } else if (s.k === 'page') {
        kicker.textContent = `Maren's Journal · ${W.short}`; title.textContent = `Page ${s.w} of 10`;
        text.innerHTML = `<div class="page">${esc(W.page)}</div>`;
    } else if (s.k === 'warden') {
        kicker.textContent = `Floor ${s.w * 10} · ${W.warden.title}`; title.textContent = W.warden.name;
        text.innerHTML = `<p>${esc(W.warden.intro)}</p><p style="font-size:14px;opacity:.8">Wardens telegraph their attacks: <b style="color:#ff8a6a">glowing tiles</b> are struck after your next move.</p>`;
        next = 'Face the Warden';
    } else if (s.k === 'defeat') {
        kicker.textContent = 'Warden defeated'; title.textContent = W.warden.name;
        text.innerHTML = `<p>${esc(W.warden.defeat)}</p>` + (s.w < 10 ? `<p style="color:#ffcf6a">✹ Ember reclaimed — your lantern burns wider. The Warden's relic lies where it fell.</p>` : '');
    } else if (s.k === 'ending') {
        kicker.textContent = 'The First Lantern'; title.textContent = 'Maren';
        const pages = distinctPages(run);
        text.innerHTML = `<p>The Hush is gone. The cage stands open. Inside, wrapped in the Lantern's light like a wick in a flame, Maren opens her eyes and smiles at you.</p><p>"You came all this way," she says. "Then you know what the Lantern needs."</p>`;
        const wrap = h('div', 'ending-choice');
        const opt = (id, sub, enabled = true) => { const b = btn(`${ENDINGS[id].title}<small>${sub}</small>`, '', () => G.chooseEnding(id)); b.disabled = !enabled; wrap.appendChild(b); };
        opt('vigil', 'Take her place as the wick.');
        opt('rest', 'Let her keep burning; carry her words home.');
        opt('dawn', pages >= 10 ? 'Set the ten Embers in the cage. Her pages showed you how.' : `You need all ten of Maren's pages to know how (${pages}/10).`, pages >= 10);
        buttons.appendChild(wrap);
        show('story');
        return;
    }
    const nb = btn(next, 'primary', () => G.storyNext());
    nb.id = 'story-next';
    buttons.appendChild(nb);
    show('story');
}

// ------------------------------------------------------------------ Perks

export function showPerks(G, run) {
    $('perk-lvl').textContent = run.p.lvl;
    const wrap = $('perk-cards');
    wrap.innerHTML = '';
    for (const id of run.pending.opts) {
        const P = PERKS[id];
        const rank = run.p.perks[id] || 0;
        const c = h('button', 'perk-card' + (P.cls ? ' cls' : ''), `<h3>${P.n}</h3><div class="rank">${P.cls ? CLASSES[P.cls].name + ' · ' : ''}rank ${rank + 1}/${P.max}</div><p>${P.d}</p>`);
        c.addEventListener('click', () => { sfx.click(); G.choosePerk(id); });
        wrap.appendChild(c);
    }
    const sk = CLASSES[run.p.cls].skills.find((s) => SKILLS[s].lvl === run.p.lvl);
    $('perk-skill').textContent = sk ? `New skill unlocked: ${SKILLS[sk].icon} ${SKILLS[sk].n} — ${SKILLS[sk].d}` : '';
    show('perk');
}

// ------------------------------------------------------------------ Inventory

const GLYPH = (it) => {
    if (it.k === 'weapon') return it.style === 'ranged' ? '🏹' : it.style === 'magic' ? '🪄' : '⚔️';
    return { armor: '🛡️', ring: '💍', amulet: '📿', potion: '⚗️', scroll: '📜', bomb: '💣', key: '🗝️', page: '📄', heirloom: '🎁', trinket: '🎁' }[it.k] || '•';
};
let selItem = null;

export function showInventory(G, run) {
    selItem = null;
    renderInventory(G, run);
    show('inventory');
}

function renderInventory(G, run) {
    const p = run.p;
    const s = pstats(run);
    $('inv-count').textContent = `${p.inv.length}/20`;
    const slots = $('equip-slots');
    slots.innerHTML = '';
    for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
        const it = p.eq[slot];
        const d = h('button', 'slot' + (it ? ' filled' : ''), `<div class="lbl">${slot}</div>${it ? `<span class="r${it.r}">${GLYPH(it)} ${esc(it.name)}</span>` : '<span style="opacity:.4">empty</span>'}`);
        d.addEventListener('click', () => { if (it) { sfx.click(); selItem = { it, slot }; renderInventory(G, run); } });
        slots.appendChild(d);
    }
    $('hero-stats').innerHTML = [
        ['Might', s.might], ['Agility', s.agi], ['Will', s.will], ['Damage', `${s.dmg[0]}–${s.dmg[1]}`], ['Accuracy', s.acc], ['Evasion', s.eva],
        ['Armour', s.arm], ['Crit', s.crit + '%'], ['Spell', Math.round(s.spell)], ['Light', s.light], ['Range', s.range],
    ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
    const grid = $('inv-grid');
    grid.innerHTML = '';
    for (const it of p.inv) {
        const better = isGear(it) && G.itemScore(it) > G.itemScore(p.eq[it.k]) + 0.5;
        const d = h('button', `item${selItem && selItem.it === it ? ' sel' : ''}${better ? ' better' : ''}`, `<span class="glyph">${GLYPH(it)}</span><span class="nm r${it.r}">${esc(it.name)}</span>${it.n > 1 ? `<span class="n">×${it.n}</span>` : ''}`);
        d.addEventListener('click', () => { sfx.click(); selItem = { it }; renderInventory(G, run); });
        grid.appendChild(d);
    }
    if (!p.inv.length) grid.innerHTML = '<div style="opacity:.5;padding:8px">Your pack is empty.</div>';
    const det = $('item-detail');
    if (!selItem) { det.hidden = true; return; }
    det.hidden = false;
    const it = selItem.it;
    const lines = describeItem(it);
    let cmp = '';
    if (isGear(it) && !selItem.slot) {
        const cur = p.eq[it.k];
        cmp = cur ? `<div class="cmp">Replaces <span class="r${cur.r}">${esc(cur.name)}</span>: ${compare(it, cur)}</div>` : '<div class="cmp up">Slot is empty.</div>';
    }
    const kindName = isGear(it) ? (BASES[it.b] ? BASES[it.b].n : it.k) : it.k === 'trinket' ? 'Keepsake' : (CONSUMABLES[it.b] ? CONSUMABLES[it.b].k : it.k);
    det.innerHTML = `<h4 class="r${it.r}">${GLYPH(it)} ${esc(it.name)}</h4><div class="meta">${isGear(it) ? RARITY[it.r] + ' · ' : ''}${esc(kindName)}${it.il > 1 ? ' · item level ' + it.il : ''}</div>
        <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}${it.k === 'trinket' ? '<li>A keepsake. A merchant will give you something for it.</li>' : ''}</ul>${cmp}`;
    const row = h('div', 'btn-row');
    if (selItem.slot) row.appendChild(btn('Unequip', '', () => { G.act({ t: 'unequip', slot: selItem.slot }); selItem = null; renderInventory(G, run); }));
    else if (isGear(it)) row.appendChild(btn('Equip', 'primary', () => { G.act({ t: 'equip', id: it.id }); selItem = null; renderInventory(G, run); }));
    else if (CONSUMABLES[it.b] && CONSUMABLES[it.b].throwable) row.appendChild(btn('Throw', 'primary', () => G.beginThrow(it)));
    else if (it.k === 'page') row.appendChild(btn('Read', 'primary', () => { G.act({ t: 'use', id: it.id }); }));
    else if (it.k === 'potion' || it.k === 'scroll') row.appendChild(btn(it.k === 'potion' ? 'Drink' : 'Read', 'primary', () => { G.act({ t: 'use', id: it.id }); G.closePanel(); }));
    if (!selItem.slot && it.k !== 'page' && !it.quest) row.appendChild(btn('Drop', 'ghost', () => { G.act({ t: 'drop', id: it.id }); selItem = null; renderInventory(G, run); }));
    det.appendChild(row);
}

function compare(a, b) {
    const out = [];
    const dv = (x, y, label, inv) => { const d = (x || 0) - (y || 0); if (!d) return; out.push(`<span class="${(d > 0) !== !!inv ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} ${label}</span>`); };
    if (a.dmg && b.dmg) dv(Math.round((a.dmg[0] + a.dmg[1]) / 2), Math.round((b.dmg[0] + b.dmg[1]) / 2), 'avg damage');
    if (a.k === 'armor') { dv(a.arm, b.arm, 'armour'); dv(a.eva, b.eva, 'evasion'); }
    const keys = new Set([...Object.keys(a.aff), ...Object.keys(b.aff)]);
    for (const k of keys) dv(a.aff[k], b.aff[k], k);
    return out.join(', ') || 'no difference in numbers';
}

// ------------------------------------------------------------------ Shop

export function showShop(G, run) {
    const o = run.objs.find((x) => x.id === run.dialog.obj);
    if (!o) { G.closeDialog(); return; }
    $('shop-title').textContent = `${o.name}, oil-trader`;
    $('shop-greet').textContent = `"Light's dear this deep. Gold's cheap. Let's trade."`;
    const render = () => {
        $('shop-gold').innerHTML = `◆ <b>${run.p.gold}</b>`;
        const oc = oilPrice(run);
        const ob = $('shop-oil');
        ob.textContent = oc > 0 ? `Fill your lantern — ${oc} gold` : 'Your lantern is full';
        ob.disabled = oc <= 0 || run.p.gold < oc;
        ob.onclick = () => { sfx.click(); if (G.buyOil()) render(); };
        const st = $('shop-stock');
        st.innerHTML = '';
        for (const it of o.stock) {
            const d = h('div', 'item', `<span class="glyph">${GLYPH(it)}</span><span class="nm r${it.r}">${esc(it.name)}<br><small style="opacity:.7">${esc(describeItem(it).slice(0, 2).join(' · '))}</small></span>`);
            const b = h('button', 'mini', `<span class="price">${price(it)}</span>`);
            b.disabled = run.p.gold < price(it);
            b.addEventListener('click', () => { sfx.click(); if (G.buy(o.id, it.id)) render(); });
            d.appendChild(b);
            st.appendChild(d);
        }
        if (!o.stock.length) st.innerHTML = '<div style="opacity:.5">Sold out.</div>';
        const sl = $('shop-sell');
        sl.innerHTML = '';
        for (const it of run.p.inv) {
            if (it.k === 'page' || it.k === 'key' || it.quest) continue;
            const d = h('div', 'item', `<span class="glyph">${GLYPH(it)}</span><span class="nm r${it.r}">${esc(it.name)}${it.n > 1 ? ` ×${it.n}` : ''}</span>`);
            const b = h('button', 'mini', `sell <span class="price">${sellPrice(it)}</span>`);
            b.addEventListener('click', () => { sfx.coin(); if (G.sell(it.id)) render(); });
            d.appendChild(b);
            sl.appendChild(d);
        }
    };
    render();
    show('shop');
}

// ------------------------------------------------------------------ Wayfarer dialog

export function showDialog(G, run) {
    const d = run.dialog;
    const o = run.objs.find((x) => x.id === d.obj);
    $('dialog-who').textContent = o ? `${o.name}${o.title ? ', ' + o.title : ''}` : d.name;
    const buttons = $('dialog-buttons');
    buttons.innerHTML = '';
    if (d.k === 'quest') {
        const q = run.quests.find((x) => x.id === d.q);
        $('dialog-text').textContent = q.text;
        $('dialog-goal').textContent = `${QUEST_TITLES[q.kind]}: ${q.goal}`;
        $('dialog-reward').textContent = `Reward: ${q.reward.gold} gold, experience${q.reward.item ? ', an item' : ''}${q.reward.oil ? ', lantern oil' : ''}`;
        buttons.appendChild(btn('Decline', 'ghost', () => G.closeDialog()));
        buttons.appendChild(btn('Accept', 'primary', () => G.acceptQuest()));
    } else {
        $('dialog-text').textContent = d.text;
        $('dialog-goal').textContent = '';
        $('dialog-reward').textContent = '';
        buttons.appendChild(btn('Farewell', 'primary', () => G.closeDialog()));
    }
    show('dialog');
}

// ------------------------------------------------------------------ Journal

let journalTab = 'quests';
export function showJournal(G) { renderJournal(G); show('journal'); }
function renderJournal(G) {
    const run = G.run;
    document.querySelectorAll('#journal .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === journalTab));
    const body = $('journal-body');
    if (journalTab === 'quests') {
        const w = worldOf(run.floor);
        const main = run.floor >= 100 ? 'Defeat the Hush and reach the First Lantern.' : `Descend to floor ${w * 10} and defeat ${WORLDS[w].warden.name}.`;
        let html = `<div class="q"><div class="t">The Hundred Stairs</div><div class="g">${esc(main)}</div><div style="font-size:12px;opacity:.8">Embers ${run.p.embers}/9 · Maren's pages ${distinctPages(run)}/10</div></div>`;
        const qs = run.quests.slice().reverse().slice(0, 25);
        if (!qs.length) html += '<div style="opacity:.6;padding:6px">No side quests yet. Wayfarers marked with <b style="color:#ffd040">!</b> have work for you.</div>';
        for (const q of qs) html += `<div class="q ${q.state}"><div class="t">${esc(q.title)} · floor ${q.floor} <small>(${q.state})</small></div><div class="g">${esc(q.goal)}${q.need > 1 && q.state === 'active' ? ` — ${q.have}/${q.need}` : ''}</div><div style="font-size:12px;opacity:.7">for ${esc(q.giverName)}</div></div>`;
        body.innerHTML = html;
    } else if (journalTab === 'pages') {
        let html = '';
        for (let w = 1; w <= 10; w++) {
            if (run.p.pages.includes(w)) html += `<div class="page-entry"><b>${esc(WORLDS[w].short)}.</b> ${esc(WORLDS[w].page)}</div>`;
            else html += `<div class="page-missing">— a page lost somewhere in ${w <= worldOf(run.floor) ? esc(WORLDS[w].name) : 'the dark below'} —</div>`;
        }
        body.innerHTML = html;
    } else {
        body.innerHTML = run.log.slice(-60).reverse().map((l) => `<div class="${l.cls}" style="padding:1px 0">${esc(l.text)}</div>`).join('');
    }
}

// ------------------------------------------------------------------ Map

export function showBigMap(G) {
    const run = G.run;
    $('map-title').textContent = `Floor ${run.floor} — ${WORLDS[run.lv.world].name}`;
    drawMap($('bigmap-canvas'), run, { big: true });
    show('bigmap');
}

// ------------------------------------------------------------------ Pause / death / victory

export function showPause(G) {
    const run = G.run;
    $('pause-info').innerHTML = `<p style="font:15px var(--serif)">Floor ${run.floor} · ${esc(WORLDS[run.lv.world].name)}<br>${CLASSES[run.p.cls].name}, level ${run.p.lvl} · ${run.mode === 'ironwick' ? 'Ironwick (permadeath)' : 'Lantern mode'}<br><small style="opacity:.7">Seed ${run.seed} · turn ${run.turn}</small></p>`;
    $('pause-quality').textContent = `Graphics: ${['High', 'Medium', 'Low'][G.quality()]}`;
    show('pause');
}

const statsHtml = (run) => [
    ['Floor reached', run.stats.deepest], ['Level', run.p.lvl], ['Monsters slain', run.stats.kills], ['Wardens', run.stats.bosses],
    ['Quests done', run.stats.quests], ['Gold found', run.stats.gold], ['Turns', run.turn], ['Falls', run.stats.deaths],
].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');

export function showDeath(G, run) {
    const d = run.dead;
    $('death-title').textContent = run.mode === 'ironwick' ? 'The wick is spent' : 'You have fallen';
    $('death-text').innerHTML = `<p>On floor ${d.floor} of the Hundred Stairs, ${esc(d.cause)} put out your light.</p>` +
        (run.mode === 'lantern' ? `<p>But Maren taught you to keep a spare wick. The lantern can be rekindled at the top of ${esc(WORLDS[worldOf(run.checkpoint.floor)].name)} (floor ${run.checkpoint.floor}), as you were when you first arrived there.</p>` : '<p>In Ironwick there are no second chances. Lastlight waits for another lantern.</p>');
    $('death-stats').innerHTML = statsHtml(run);
    const rk = $('death-rekindle');
    rk.hidden = run.mode !== 'lantern';
    rk.textContent = `Rekindle at floor ${run.checkpoint ? run.checkpoint.floor : 1}`;
    rk.onclick = () => { sfx.click(); G.rekindle(); };
    show('death');
}

export function showVictory(G, run) {
    const E = ENDINGS[run.won];
    $('victory-title').textContent = E.title;
    $('victory-text').innerHTML = E.text.map((p) => `<p>${esc(p)}</p>`).join('');
    $('victory-stats').innerHTML = statsHtml(run);
    show('victory');
}
