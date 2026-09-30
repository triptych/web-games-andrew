/**
 * screens.js — every full-screen and modal UI outside the combat table.
 * Each function renders into its section and wires buttons to callbacks
 * supplied by main.js, which owns the flow.
 */

import { $, el, icon, cardImg, attachTip, toast } from './dom.js';
import * as R from '../sim/run.js';
import { HEROES, HERO_KEYS } from '../sim/heroes.js';
import { RELICS, ELIXIRS, relicName, healAmt } from '../sim/relics.js';
import { HANDS, HAND_ORDER, SUIT_INFO, NODE, FLOORS } from '../sim/rules.js';
import { WORLD_DEFS } from '../sim/worlds.js';
import { OPENING, CHAPTERS, ENDINGS, DEATH_LINES, CHECKPOINT_LINE } from '../sim/story.js';
import { cardName, cardSortKey } from '../sim/cards.js';
import { sfx } from '../audio/audio.js';

const SCREENS = ['scr-title', 'scr-heroes', 'scr-story', 'scr-map', 'scr-panel'];
export function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}
export function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); }
export function closeModal() { $('scr-modal').classList.add('hidden'); }
export function modalOpen() { return !$('scr-modal').classList.contains('hidden'); }

function btn(label, onclick, cls = 'menu-btn') { return el('button', { class: cls, onclick: (e) => { sfx.click(); onclick(e); } }, label); }
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ------------------------------------------------------------------ title

export function titleScreen({ hasSave, saveInfo, meta, onContinue, onNew, onHow, onSettings }) {
    show('scr-title');
    const c = $('t-continue');
    c.classList.toggle('hidden', !hasSave);
    if (hasSave) c.textContent = `Continue — ${saveInfo}`;
    c.onclick = () => { sfx.click(); onContinue(); };
    $('t-new').onclick = () => { sfx.click(); onNew(); };
    $('t-how').onclick = () => { sfx.click(); onHow(); };
    $('t-settings').onclick = () => { sfx.click(); onSettings(); };
    const bits = [];
    if (meta.best) bits.push(`Deepest level reached: ${meta.best} / 100`);
    if (meta.wins) bits.push(`Hands finished: ${meta.wins}`);
    const ends = Object.keys(meta.endings ?? {});
    if (ends.length) bits.push(`Endings seen: ${ends.length} / 3`);
    $('t-meta').textContent = bits.join('  ·  ');
}

// ------------------------------------------------------------------ hero select

export function heroScreen({ onPick, onBack, onGo, onReroll, current, ident }) {
    show('scr-heroes');
    const box = $('hero-cards');
    box.innerHTML = '';
    for (const k of HERO_KEYS) {
        const h = HEROES[k];
        const r = RELICS[h.relic];
        const card = el('div', { class: `hero-card ${k === current ? 'sel' : ''}`, onclick: () => { sfx.click(); onPick(k); } },
            el('h3', { text: h.name }),
            el('div', { class: 'hb', text: h.blurb }),
            el('div', { class: 'hs', html: `<b>${h.hp}</b> HP · <b>${h.gold}</b> gold · deck leans ${h.bias.map((s) => SUIT_INFO[s].glyph + ' ' + SUIT_INFO[s].name).join(', ')}` }),
            el('div', { class: 'hs', html: `<b>${r.name}:</b> ${r.text}` }),
            h.extra.length ? el('div', { class: 'hs', html: `Starts with: <b>${h.extra.map((x) => (x[0] === 'joker' ? 'a Joker' : 'the Arcana ' + x[1][0].toUpperCase() + x[1].slice(1))).join(', ')}</b>` }) : null,
        );
        box.append(card);
    }
    $('hero-ident').innerHTML = `${ident.name} <i>${ident.epithet}</i>`;
    $('h-back').onclick = () => { sfx.click(); onBack(); };
    $('h-reroll').onclick = () => { sfx.click(); onReroll(); };
    $('h-go').onclick = () => { sfx.click(); onGo(); };
}

// ------------------------------------------------------------------ story book

function paras(lines, cls = '') {
    return lines.map((t, i) => el('p', { class: (t.startsWith('"') || t.startsWith('“') ? 'speech ' : '') + cls, text: t, style: `animation-delay:${Math.min(i * 0.12, 0.8)}s` }));
}

export function book({ kicker = '', title = '', lines = [], choices = null, next = 'Continue', onNext = null, extra = null }) {
    show('scr-story');
    $('story-kicker').textContent = kicker;
    $('story-title').textContent = title;
    const body = $('story-body');
    body.innerHTML = '';
    body.append(...paras(lines));
    if (extra) body.append(extra);
    const ch = $('story-choices');
    ch.innerHTML = '';
    if (choices) {
        for (const c of choices) {
            const b = el('button', { class: 'choice', disabled: c.disabled ? true : null, onclick: () => { sfx.click(); c.onclick(); } }, el('b', { text: c.label }), el('span', { text: c.desc }));
            ch.append(b);
        }
    }
    const n = $('story-next');
    n.classList.toggle('hidden', !onNext);
    n.textContent = next;
    n.onclick = () => { sfx.page(); onNext?.(); };
    $('scr-story').querySelector('.book').scrollTop = 0;
}

/** Story beats queued by the run (opening, chapters, interludes, Wardens, epilogues). */
export function storyBeat(run, item, done) {
    const w = item.world ?? run.world;
    const C = CHAPTERS[w];
    switch (item.kind) {
        case 'opening':
            sfx.chapter();
            return book({ kicker: 'Prologue', title: OPENING.title, lines: OPENING.lines, onNext: done, next: 'Take up the deck' });
        case 'chapter':
            sfx.chapter();
            return book({ kicker: `Chapter ${C.numeral} · ${WORLD_DEFS[w].name}`, title: C.title, lines: [...C.prologue, ...(w > 0 ? [CHECKPOINT_LINE] : [])], onNext: done, next: 'Into the realm' });
        case 'rekindle':
            return book({ kicker: `Chapter ${C.numeral}`, title: 'The Ember Catches', lines: [DEATH_LINES[run.stats.deaths % DEATH_LINES.length], `You stand again at the edge of ${WORLD_DEFS[w].name}, with the deck you carried when you first arrived.`], onNext: done });
        case 'interlude': {
            const I = C.interlude;
            if (item.log) return book({ kicker: `Chapter ${C.numeral} · Interlude`, title: I.title, lines: [...I.text, ...item.log.map((l) => l)], onNext: done });
            return book({
                kicker: `Chapter ${C.numeral} · Interlude`, title: I.title, lines: I.text,
                choices: I.choices.map((c, i) => ({ label: c.label, desc: c.desc + (c.cost && run.gold < c.cost ? ' (not enough gold)' : ''), disabled: c.cost && run.gold < c.cost, onclick: () => item.choose(i) })),
            });
        }
        case 'bossIntro':
            return book({ kicker: `Chapter ${C.numeral} · The Warden`, title: WORLD_DEFS[w].warden, lines: C.bossIntro, onNext: done, next: 'Deal' });
        case 'bossDefeat':
            return book({ kicker: `Chapter ${C.numeral} · Victory`, title: w === 9 ? 'The Last Hand' : `${WORLD_DEFS[w].warden} Falls`, lines: C.bossDefeat, onNext: done });
        case 'epilogue':
            return book({ kicker: `Chapter ${C.numeral} · Epilogue`, title: 'On the River of Ash', lines: C.epilogue, onNext: done });
        default: done();
    }
}

// ------------------------------------------------------------------ map

const NODE_ICON = { battle: 'battle', elite: 'elite', event: 'event', shop: 'shop', rest: 'rest', treasure: 'treasure', boss: 'boss' };

export function mapScreen(run, onEnter) {
    show('scr-map');
    const map = R.mapOf(run);
    const C = CHAPTERS[run.world];
    $('map-chapter').textContent = `Chapter ${C.numeral} · ${C.title}`;
    $('map-world').textContent = `${WORLD_DEFS[run.world].name} — Levels ${run.world * 10 + 1}–${run.world * 10 + 10} of 100`;
    const scroll = $('map-scroll');
    const cv = $('map-canvas');
    const W = scroll.clientWidth || 600;
    const rowH = Math.max(78, Math.min(100, window.innerHeight / 8));
    const H = rowH * FLOORS + rowH * 0.7;
    cv.style.height = H + 'px';
    const pos = (n) => ({ x: ((n.col + 0.5) / 5) * W * 0.86 + W * 0.07, y: H - rowH * 0.55 - (n.floor - 1) * rowH });
    const svg = $('map-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const avail = new Set(R.availableNodes(run));
    const taken = new Set(run.path);
    const ns = 'http://www.w3.org/2000/svg';
    for (const id in map.nodes) {
        const n = map.nodes[id];
        for (const nx of n.next) {
            const a = pos(n), b = pos(map.nodes[nx]);
            const line = document.createElementNS(ns, 'path');
            const mx = (a.x + b.x) / 2 + (a.x === b.x ? 0 : 6);
            line.setAttribute('d', `M${a.x},${a.y} Q${mx},${(a.y + b.y) / 2} ${b.x},${b.y}`);
            const onPath = taken.has(id) && (taken.has(nx) || avail.has(nx));
            line.setAttribute('stroke', onPath ? '#f0c860' : 'rgba(240,210,160,0.28)');
            line.setAttribute('stroke-width', onPath ? '3.5' : '2');
            line.setAttribute('fill', 'none');
            if (!onPath) line.setAttribute('stroke-dasharray', '5 6');
            svg.append(line);
        }
    }
    const nodes = $('map-nodes');
    nodes.innerHTML = '';
    for (const id in map.nodes) {
        const n = map.nodes[id];
        const p = pos(n);
        const isAvail = avail.has(id);
        const d = el('button', {
            class: `mnode ${n.type === 'boss' ? 'boss' : ''} ${isAvail ? 'avail' : ''} ${taken.has(id) ? 'done' : ''} ${run.nodeId === id ? 'cur' : ''} ${!isAvail && !taken.has(id) ? 'locked' : ''}`,
            style: `left:${p.x}px;top:${p.y}px`, html: icon(NODE_ICON[n.type]), 'aria-label': `${NODE[n.type].name}: ${n.name}`,
        });
        d.append(el('span', { class: 'lvl', text: `Lv ${run.world * 10 + n.floor}` }));
        const colors = { battle: '#e8d8c0', elite: '#ff7a6a', event: '#9ad0ff', shop: '#ffd35a', rest: '#ff9a40', treasure: '#ffe080', boss: '#ff5050' };
        if (isAvail || taken.has(id)) d.style.color = colors[n.type];
        attachTip(d, `<b>${NODE[n.type].name}</b> — ${n.name}<br><span class="dim">Level ${run.world * 10 + n.floor} of 100</span>`);
        if (isAvail) d.addEventListener('click', () => { sfx.step(); onEnter(id); });
        nodes.append(d);
    }
    const legend = $('map-legend');
    legend.innerHTML = '';
    for (const k of ['battle', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss']) legend.append(el('span', { html: icon(NODE_ICON[k]) + NODE[k].name }));
    // scroll so the next floor is in view
    requestAnimationFrame(() => {
        const f = Math.max(1, run.floor + 1);
        scroll.scrollTop = Math.max(0, H - rowH * 0.55 - (f - 1) * rowH - scroll.clientHeight * 0.6);
    });
}

// ------------------------------------------------------------------ generic panel

function panel(title, sub, body, foot) {
    show('scr-panel');
    $('panel-title').textContent = title;
    $('panel-sub').innerHTML = sub ?? '';
    const b = $('panel-body');
    b.innerHTML = '';
    b.append(...[].concat(body).filter(Boolean));
    const f = $('panel-foot');
    f.innerHTML = '';
    f.append(...[].concat(foot).filter(Boolean));
    $('scr-panel').querySelector('.panel').scrollTop = 0;
}

function relicItem(run, id, extra = {}) {
    const r = RELICS[id];
    const b = el('button', { class: 'item', disabled: extra.disabled ? true : null, onclick: extra.onclick },
        el('div', { class: 'ic', html: icon(r.icon), style: `color:${r.rarity === 'crown' ? '#ffe080' : '#e8d8b0'}` }),
        el('div', {}, el('b', { text: relicName(id, run.seed) }), el('small', { text: r.text })),
        extra.price !== undefined ? el('div', { class: 'price', html: `<span class="coin"></span> ${extra.price}` }) : null);
    return b;
}

function elixirItem(run, id, extra = {}) {
    const E = ELIXIRS[id];
    return el('button', { class: 'item', disabled: extra.disabled ? true : null, onclick: extra.onclick },
        el('div', { class: 'ic' }, el('div', { class: 'flask', style: `width:16px;height:22px;border-radius:3px 3px 8px 8px;background:${E.color};box-shadow:0 0 10px ${E.color}` })),
        el('div', {}, el('b', { text: E.name }), el('small', { text: E.text(run.world) })),
        extra.price !== undefined ? el('div', { class: 'price', html: `<span class="coin"></span> ${extra.price}` }) : null);
}

// ------------------------------------------------------------------ rewards

export function rewardScreen(run, { onChange, onDone }) {
    const r = run.pending;
    const body = [];
    body.push(el('div', { class: 'suitline', html: `<span style="color:var(--coin)"><span class="coin"></span> +${r.gold} gold</span>` }));
    if (r.crown) body.push(el('div', { class: 'meta-line', text: 'The Warden\'s Crown is yours:' }), relicItem(run, r.crown, { onclick: () => { R.takeRewardRelic(run); sfx.relic(); onChange(); } }));
    if (r.relic) body.push(relicItem(run, r.relic, { onclick: () => { R.takeRewardRelic(run); sfx.relic(); onChange(); } }));
    if (r.elixir) {
        const full = !run.elixirs.includes(null) && run.elixirs.length >= R.elixirSlots(run);
        body.push(elixirItem(run, r.elixir, { disabled: full, onclick: () => { if (R.takeRewardElixir(run)) { sfx.elixir(); onChange(); } } }));
        if (full) body.push(el('div', { class: 'meta-line', text: 'Your elixir belt is full.' }));
    }
    if (!r.cardTaken) {
        body.push(el('div', { class: 'meta-line', text: 'Choose a card to add to your deck — or skip it. A lean deck draws its best cards more often.' }));
        const row = el('div', { class: 'row' });
        r.cards.forEach((c, i) => {
            row.append(el('div', { class: 'cardbox', onclick: () => { R.takeRewardCard(run, i); sfx.draw(); toast(`${cardName(c)} added to your deck.`); onChange(); } }, cardImg(c), el('div', { class: 'cname', text: cardName(c) })));
        });
        body.push(row);
    }
    const foot = [];
    if (!r.cardTaken) foot.push(btn('Skip the card', () => { R.skipRewardCard(run); onChange(); }));
    foot.push(btn(r.cardTaken ? 'Continue' : 'Leave', () => onDone(), 'menu-btn primary'));
    panel(r.kind === 'boss' ? 'The Warden Falls' : r.kind === 'elite' ? 'A Mighty Foe Defeated' : 'Victory', null, body, foot);
}

export function cardOfferModal(run, onDone) {
    const p = run.pending;
    const row = el('div', { class: 'row' });
    p.cardOffer.forEach((c, i) => row.append(el('div', { class: 'cardbox', onclick: () => { R.takeOfferCard(run, i); sfx.draw(); closeModal(); onDone(); } }, cardImg(c), el('div', { class: 'cname', text: cardName(c) }))));
    modal('Choose a Card', '', [row], [btn('Take nothing', () => { R.takeOfferCard(run, null); closeModal(); onDone(); })]);
}

// ------------------------------------------------------------------ event

export function eventScreen(run, { onChoose, onFight, onDone }) {
    const p = run.pending;
    const ev = p.ev;
    if (!p.done) {
        return book({
            kicker: `Level ${run.world * 10 + R.mapOf(run).nodes[run.cur].floor} · Mystery`, title: ev.title, lines: ev.text,
            choices: ev.choices.map((c, i) => ({ label: c.label, desc: c.desc + (c.cost && run.gold < c.cost ? ' (not enough gold)' : ''), disabled: c.cost && run.gold < c.cost, onclick: () => onChoose(i) })),
        });
    }
    const ch = ev.choices[p.choice];
    return book({
        kicker: 'Mystery', title: ev.title, lines: [...ev.text, `You chose: ${ch.label}.`, ...(p.log ?? [])],
        onNext: p.after ? onFight : onDone, next: p.after ? 'Fight!' : 'Continue',
    });
}

// ------------------------------------------------------------------ shop

export function shopScreen(run, { onChange, onDone, onPurge }) {
    const s = run.pending.stock;
    const body = [];
    const row = el('div', { class: 'row' });
    s.cards.forEach((it, i) => {
        const poor = run.gold < it.price;
        row.append(el('div', {
            class: `cardbox ${it.sold ? 'sold' : ''}`,
            onclick: () => { if (it.sold) return; if (R.buyCard(run, i)) { sfx.gold(); toast(`Bought ${cardName(it.card)}.`); onChange(); } else toast('Not enough gold.'); },
        }, cardImg(it.card), el('div', { class: 'cname', text: cardName(it.card) }), el('div', { class: `price ${poor ? 'poor' : ''}`, html: it.sold ? 'sold' : `<span class="coin"></span> ${it.price}` })));
    });
    body.push(row);
    for (const [i, it] of s.relics.entries()) body.push(relicItem(run, it.id, { price: it.sold ? 'sold' : it.price, disabled: it.sold || run.gold < it.price, onclick: () => { if (R.buyRelic(run, i)) { sfx.relic(); onChange(); } } }));
    for (const [i, it] of s.elixirs.entries()) body.push(elixirItem(run, it.id, { price: it.sold ? 'sold' : it.price, disabled: it.sold || run.gold < it.price, onclick: () => { if (R.buyElixir(run, i)) { sfx.elixir(); onChange(); } else toast('No room, or not enough gold.'); } }));
    body.push(el('button', { class: 'item', disabled: s.purged || run.gold < s.purge ? true : null, onclick: () => { if (R.buyPurge(run)) { sfx.gold(); onPurge(); } } },
        el('div', { class: 'ic', html: icon('flame'), style: 'color:#ff9a60' }),
        el('div', {}, el('b', { text: 'Card Removal' }), el('small', { text: 'Burn one card out of your deck forever.' })),
        el('div', { class: 'price', html: s.purged ? 'done' : `<span class="coin"></span> ${s.purge}` })));
    const node = R.mapOf(run).nodes[run.cur];
    panel(`The Merchant of ${node.name.replace(/^The /, '')}`, `“Everything has a price, Cardbound. Most of it is fair.” — you have <b style="color:var(--coin)">${run.gold}</b> gold`, body, [btn('Leave', onDone, 'menu-btn primary')]);
}

// ------------------------------------------------------------------ rest

export function restScreen(run, { onRest, onTemper, onDone }) {
    const p = run.pending;
    const heal = R.restHeal(run);
    const body = [];
    if (!p.done) {
        body.push(el('button', { class: 'item', onclick: onRest }, el('div', { class: 'ic', html: icon('rest'), style: 'color:#ff9a40' }), el('div', {}, el('b', { text: 'Rest' }), el('small', { text: `Heal ${heal} HP (${run.hp}/${run.maxHp}).` }))));
        body.push(el('button', { class: 'item', disabled: !run.deck.some(R.canUpgrade) ? true : null, onclick: onTemper }, el('div', { class: 'ic', html: icon('sword'), style: 'color:#ffd35a' }), el('div', {}, el('b', { text: 'Temper' }), el('small', { text: 'Upgrade a card: +1 rank (an Ace gains Keen); Arcana grow stronger.' }))));
    } else {
        body.push(el('div', { class: 'meta-line', text: p.done === 'rest' ? `You sleep by the fire and wake mended. (${run.hp}/${run.maxHp})` : 'You work your deck by firelight until it hums.' }));
    }
    panel('A Campfire', 'The fire crackles. For a while, nothing is burning that should not be.', body, p.done ? [btn('Continue', onDone, 'menu-btn primary')] : []);
}

// ------------------------------------------------------------------ treasure

export function treasureScreen(run, { onOpen, onDone }) {
    const p = run.pending;
    const body = [];
    if (!p.opened) body.push(el('div', { class: 'meta-line', text: 'An old chest, bound in iron and sealed with a wax Ace.' }));
    else {
        body.push(el('div', { class: 'suitline', html: `<span style="color:var(--coin)"><span class="coin"></span> +${p.gold} gold</span>` }));
        if (p.relic) body.push(relicItem(run, p.relic, {}));
    }
    panel('Treasure', null, body, p.opened ? [btn('Continue', onDone, 'menu-btn primary')] : [btn('Open the Chest', onOpen, 'menu-btn primary')]);
}

// ------------------------------------------------------------------ modals

export function modal(title, sub, body, foot) {
    $('scr-modal').classList.remove('hidden');
    $('modal-title').textContent = title;
    $('modal-sub').innerHTML = sub ?? '';
    const b = $('modal-body');
    b.innerHTML = '';
    b.append(...[].concat(body).filter(Boolean));
    const f = $('modal-foot');
    f.innerHTML = '';
    f.append(...[].concat(foot).filter(Boolean));
}

const PICK_TITLE = { remove: 'Remove a Card', upgrade: 'Upgrade a Card', enchant: 'Enchant a Card', duplicate: 'Duplicate a Card' };
export function pickerModal(run, onDone) {
    const pk = run.picks[0];
    const cands = R.pickable(run).sort((a, b) => cardSortKey(a) - cardSortKey(b));
    const grid = el('div', { class: 'grid-cards' });
    for (const c of cands) {
        grid.append(el('div', { class: 'cardbox', onclick: () => { R.resolvePick(run, c.uid); sfx.page(); if (pk.kind === 'enchant' && pk.result) toast(`${cardName(c)}`); closeModal(); onDone(); } }, cardImg(c)));
    }
    const left = (pk.count ?? 1) > 1 ? ` (${pk.count} left)` : '';
    modal(PICK_TITLE[pk.kind] + left, cands.length ? '' : 'Nothing in your deck can be chosen.', [grid], [btn(cands.length ? 'Skip' : 'Continue', () => { R.skipPick(run); closeModal(); onDone(); })]);
}

export function deckModal(cards, title = 'Your Deck', extra = '') {
    const sorted = [...cards].sort((a, b) => cardSortKey(a) - cardSortKey(b));
    const grid = el('div', { class: 'grid-cards' });
    for (const c of sorted) grid.append(el('div', { class: 'cardbox' }, cardImg(c)));
    const tally = { S: 0, C: 0, D: 0, H: 0 };
    let arc = 0;
    for (const c of cards) { if (c.kind === 'arcana') arc++; else if (c.suit) tally[c.suit]++; }
    const sub = `${cards.length} cards · ` + Object.entries(tally).map(([s, n]) => `<span style="color:${SUIT_INFO[s].color}">${SUIT_INFO[s].glyph} ${n}</span>`).join(' · ') + ` · ${arc} Arcana ${extra}`;
    modal(title, sub, [grid], [btn('Close', closeModal, 'menu-btn primary')]);
}

export function ranksModal() {
    const t = el('table', { class: 'ranks' });
    const ex = { royalFlush: '10 J Q K A, one suit', fiveKind: 'needs a Joker', straightFlush: 'five in a row, one suit', fourKind: 'four of one rank', fullHouse: 'three + a pair', straight: 'five in a row (A high or low)', flush: 'five of one suit', threeKind: 'three of one rank', twoPair: 'two pairs', pair: 'two of one rank', high: 'anything else' };
    for (const k of HAND_ORDER) t.append(el('tr', {}, el('td', { text: HANDS[k].name }), el('td', { class: 'ex', text: ex[k] }), el('td', { class: 'm', text: `×${HANDS[k].mult}` })));
    const suits = el('div', { class: 'suitline' });
    for (const s of ['S', 'C', 'D', 'H']) suits.append(el('span', { style: `color:${SUIT_INFO[s].color}`, text: `${SUIT_INFO[s].glyph} ${SUIT_INFO[s].name}: ${SUIT_INFO[s].verb} ×${SUIT_INFO[s].scale}` }));
    modal('Hand Ranks', 'Every card\'s chips flow into its suit; every suit is multiplied by the hand. A Cross (one card finishing two lines) gives each ×1.5; diagonals ×1.25.', [suits, t], [btn('Close', closeModal, 'menu-btn primary')]);
}

export function howModal() {
    const h = el('div', {
        class: 'howto', html: `
        <h3>The table</h3>
        <p>Every fight is poker solitaire on a 5×5 table. Each turn you draw up to 5 cards and have <b>3 Deals</b>: placing a card on an empty cell costs one. Cards you don't place stay in your hand.</p>
        <p>When a <b>row, column or diagonal</b> fills, it is scored as a poker hand and <b>fires</b>, then its cards go to your discard pile. A card that finishes two lines at once is a <b>Cross</b> — both lines get ×1.5.</p>
        <h3>What a line does</h3>
        <p>Each card is worth its rank in chips (faces 10, aces 11). Chips flow into the card's suit, and each suit is multiplied by the hand:</p>
        <ul><li><b style="color:var(--blade)">♠ Blades</b> — damage to your target</li><li><b style="color:var(--stave)">♣ Staves</b> — damage to every enemy (×0.6)</li><li><b style="color:var(--coin)">♦ Coins</b> — Ward, which blocks damage until your next turn (×0.8)</li><li><b style="color:var(--heart)">♥ Hearts</b> — healing (×0.35)</li></ul>
        <p>So a Flush of Blades is pure murder, and a Flush of Hearts heals you but kills nothing. Plan rows for one suit, or for pairs and straights, and plant crosses where lines meet.</p>
        <h3>Enemies</h3>
        <p>Every monster shows what it will do next. Some attack; some seal cells, steal your best card, scramble a row, frost cells so they score nothing, or shuffle dead <b>Ash</b> into your deck.</p>
        <h3>Controls</h3>
        <ul><li><b>Drag</b> a card onto a cell, or <b>tap</b> a card then tap a cell.</li><li><b>Tap an enemy</b> to target it. <b>Redraw</b> swaps the selected card for a new one once per turn.</li><li>Arcana (spell cards): select, then tap <b>Cast</b> or a table card if it needs one.</li><li>Keys: <b>1–8</b> pick a card · <b>arrows</b> move · <b>Enter</b> place · <b>Tab</b> target · <b>R</b> redraw · <b>E</b> end turn · <b>D</b> deck · <b>H</b> hand ranks · <b>Esc</b> menu · <b>M</b> mute.</li></ul>
        <h3>The journey</h3>
        <p>Ten realms of ten levels each — a hundred in all. Pick your path on each realm's map: battles, elites, mysteries, merchants, campfires and treasure, then the realm's Warden. Your run saves after every step; if you fall, you can rekindle at the start of the realm.</p>` });
    modal('How to Play', '', [h], [btn('Got it', closeModal, 'menu-btn primary')]);
}

export function settingsModal({ settings, onChange, onAbandon, inRun, onResume, onTitle }) {
    const mk = (label, input) => el('div', { class: 'setting' }, el('span', { text: label }), input);
    const range = (key) => {
        const i = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings[key] });
        i.addEventListener('input', () => onChange({ [key]: Number(i.value) }));
        return i;
    };
    const sel = (key, opts) => {
        const s = el('select', {});
        for (const [v, l] of opts) { const o = el('option', { value: v, text: l }); if (String(settings[key]) === String(v)) o.selected = true; s.append(o); }
        s.addEventListener('change', () => onChange({ [key]: s.value }));
        return s;
    };
    const body = [
        mk('Music', range('music')),
        mk('Sound effects', range('sfx')),
        mk('Graphics', sel('quality', [['auto', 'Auto'], ['0', 'High'], ['1', 'Medium'], ['2', 'Low']])),
        mk('Animation speed', sel('speed', [['1', 'Normal'], ['1.5', 'Fast'], ['2.2', 'Very fast']])),
    ];
    const foot = [];
    if (inRun) {
        foot.push(btn('Return to Title', onTitle));
        foot.push(btn('Abandon Run', () => { if (confirm('Abandon this journey? Your save will be deleted.')) onAbandon(); }));
    }
    foot.push(btn(inRun ? 'Resume' : 'Close', () => { closeModal(); onResume?.(); }, 'menu-btn primary'));
    modal(inRun ? 'Paused' : 'Settings', '', body, foot);
}

export function chronicleModal(run) {
    const box = el('div', { class: 'chron' });
    let lastW = -1;
    for (const e of run.chronicle) {
        if (e.w !== lastW) { box.append(el('div', { class: 'cw', text: `${ROMAN[e.w]} · ${WORLD_DEFS[e.w].name}` })); lastW = e.w; }
        box.append(el('div', { text: e.text }));
    }
    modal('The Chronicle', `The story of ${run.name} ${run.epithet}, as the cards remember it.`, [box], [btn('Close', closeModal, 'menu-btn primary')]);
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function statsBlock(run) {
    const s = run.stats;
    const best = s.bestHand ? HANDS[s.bestHand].name : '—';
    return el('div', { class: 'meta-line', html: `Level reached <b>${Math.min(100, run.world * 10 + run.floor)}</b> · foes felled ${s.kills} · lines fired ${s.lines} · crosses ${s.crosses} · best hand <b>${best}</b> · deaths ${s.deaths}` });
}

export function deadScreen(run, { onRekindle, onNew, onTitle }) {
    book({
        kicker: `Level ${run.world * 10 + run.floor + 1} · ${WORLD_DEFS[run.world].name}`, title: 'You Have Fallen',
        lines: [DEATH_LINES[run.stats.deaths % DEATH_LINES.length], run.chronicle[run.chronicle.length - 1]?.text ?? ''],
        extra: statsBlock(run),
        choices: [
            { label: `Rekindle at the edge of ${WORLD_DEFS[run.world].name}`, desc: 'Restart this realm with the deck, relics and gold you carried into it.', onclick: onRekindle },
            { label: 'Begin a new journey', desc: 'A new Cardbound, a new deck, the first realm.', onclick: onNew },
            { label: 'Return to the title', desc: 'Your ember will wait.', onclick: onTitle },
        ],
    });
}

export function endingChoice(run, onChoose) {
    const keys = R.availableEndings(run);
    book({
        kicker: 'The End of the Last Hand', title: 'The Table and the Empty Chair',
        lines: ['The Ace of Hearts lies face-up on the black stone, beating softly. The Dealer\'s chair waits. The Ferryman waits, far below.', 'How do you finish it?'],
        choices: keys.map((k) => ({ label: ENDINGS[k].label, desc: ENDINGS[k].desc, onclick: () => onChoose(k) })),
    });
}

export function endingScreen(run, onTitle, onChron) {
    const E = ENDINGS[run.ending];
    book({ kicker: 'Epilogue', title: E.title, lines: E.text, extra: statsBlock(run), onNext: onTitle, next: 'Return to the Title' });
    const extra = el('button', { class: 'menu-btn', onclick: onChron }, 'Read the Chronicle');
    $('story-choices').append(extra);
}

export { healAmt };
