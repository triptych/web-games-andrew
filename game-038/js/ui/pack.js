// ============================================================
// ui/pack.js - the inventory, the shop and the forge
// ============================================================
import { el, num, cap } from '../core/util.js';
import { state, inventoryList, itemCount, removeItem, partyDragons, dragonById, hasItem } from '../game/state.js';
import { registerScreen, show, toast, openOverlay, closeOverlay, confirmDialog, infoDialog,
         screenHeader, itemRow, emptyState, refresh } from './shell.js';
import { ITEMS, item, KIND_LABEL, KIND_ORDER, RECIPES } from '../data/items.js';
import { applyItem, itemUsable } from '../game/effects.js';
import * as adv from '../game/adventure.js';
import { liveRng } from '../game/state.js';
import { maxHp, statsOf } from '../gen/dragon.js';
import { sfx } from '../audio.js';
import { itemIconEl } from './sprites.js';

let filter = 'all';

registerScreen('items', () => {
  const all = inventoryList();
  const kinds = ['all', ...KIND_ORDER.filter(k => all.some(e => e.def.kind === k))];
  const shown = filter === 'all' ? all : all.filter(e => e.def.kind === filter);

  const filters = el('div.filter-row', null, ...kinds.map(k =>
    el('button', {
      'aria-pressed': String(filter === k),
      onclick: () => { filter = k; sfx.ui(); refresh(); },
    }, k === 'all' ? 'Everything' : KIND_LABEL[k] || cap(k))));

  const groups = [];
  let lastKind = null;
  for (const entry of shown) {
    if (entry.def.kind !== lastKind) {
      lastKind = entry.def.kind;
      groups.push(el('div.kind-head', null, KIND_LABEL[lastKind] || cap(lastKind)));
    }
    groups.push(itemRow(entry.def, {
      count: entry.count,
      onClick: () => openItemActions(entry.def, entry.count),
    }));
  }

  return el('div', null,
    screenHeader('Your pack', `${all.reduce((n, e) => n + e.count, 0)} things · ●${num(state.coin)}`),
    filters,
    shown.length ? el('div.stack', null, ...groups) : emptyState('Nothing of that sort in here.'));
});

function openItemActions(def, count) {
  const actions = el('div.stack');
  const usableOnDragon = ['restorative', 'cure', 'food', 'training'].includes(def.kind);
  if (usableOnDragon) actions.append(el('button.btn.wide.primary', { onclick: () => { closeOverlay(); pickDragonFor(def); } }, 'Use on a dragon'));
  if (def.kind === 'relic') actions.append(el('button.btn.wide', { onclick: () => { closeOverlay(); show('brood'); toast('Fit it from a dragon’s page.'); } }, 'Fit to a dragon'));
  if (def.kind === 'battle' || def.kind === 'binding') actions.append(el('p.faint', null, 'For use in a fight.'));
  if (def.kind === 'breeding') actions.append(el('p.faint', null, 'Offer it when you pair two dragons at the Broodwell.'));
  if (def.kind !== 'key') {
    actions.append(el('button.btn.wide', {
      onclick: () => confirmDialog({
        title: `Throw away a ${def.name}?`,
        body: 'It is gone for good.', danger: true, confirmText: 'Throw it out',
        onConfirm: () => { removeItem(def.id, 1); closeOverlay(); refresh(); },
      }),
    }, 'Throw one away'));
  }
  actions.append(el('button.btn.wide', { onclick: closeOverlay }, 'Back'));

  openOverlay(el('div', null,
    el('div.row', null, itemIconEl(def, 3), el('div.grow', null, el('h2', null, def.name), el('div.faint', null, `×${count}`))),
    el('p.dim', null, def.desc || ''),
    actions));
}

function pickDragonFor(def) {
  const list = el('div.stack');
  for (const d of state.roster) {
    const ok = itemUsable(def.id, d, { inBattle: false });
    list.append(el('button.btn', {
      disabled: !ok,
      onclick: () => {
        const res = applyItem(def.id, d, { rng: liveRng('use') });
        closeOverlay();
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        removeItem(def.id, 1);
        sfx.confirm();
        infoDialog(def.name, el('div', null, ...res.lines.map(l => el('p.dim', null, l))), refresh);
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, d.name),
        el('div.faint', null, `Lv ${d.level} · ${d.hp}/${maxHp(d)} hp · bond ${d.bond}`))));
  }
  openOverlay(el('div', null, el('h2', null, `Use ${def.name} on`), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

// ------------------------------------------------------------------ shop --
let shopMode = 'buy';

registerScreen('shop', () => {
  const stock = adv.shopStock();
  const mine = inventoryList(def => def.kind !== 'key');

  const tabs = el('div.filter-row', null,
    el('button', { 'aria-pressed': String(shopMode === 'buy'), onclick: () => { shopMode = 'buy'; refresh(); } }, 'Buy'),
    el('button', { 'aria-pressed': String(shopMode === 'sell'), onclick: () => { shopMode = 'sell'; refresh(); } }, 'Sell'));

  const rows = shopMode === 'buy'
    ? stock.map(s => itemRow(s.def, {
        price: s.price,
        sub: s.def.desc,
        disabled: state.coin < s.price,
        onClick: () => openBuy(s),
      }))
    : mine.map(entry => itemRow(entry.def, {
        count: entry.count,
        price: adv.sellPrice(entry.id),
        onClick: () => {
          const res = adv.sell(entry.id, 1);
          if (!res.ok) { toast(res.why, 'bad'); return; }
          sfx.coin();
          toast(`Sold for ●${res.gain}.`, 'gold');
          refresh();
        },
      }));

  return el('div', null,
    screenHeader('Shop', `●${num(state.coin)} in your purse`,
      el('button.btn.small', { onclick: () => show('place') }, 'Back')),
    tabs,
    rows.length ? el('div.stack', null, ...rows) : emptyState(shopMode === 'buy' ? 'Sold out.' : 'Nothing to sell.'));
});

function openBuy(s) {
  let qty = 1;
  const max = Math.max(1, Math.min(20, Math.floor(state.coin / s.price)));
  const label = el('div.center', null, `×${qty} — ●${s.price * qty}`);
  const update = () => { label.textContent = `×${qty} — ●${s.price * qty}`; };
  openOverlay(el('div', null,
    el('h2', null, s.def.name),
    el('p.dim', null, s.def.desc || ''),
    el('div.row', { style: { justifyContent: 'center', gap: '14px', margin: '10px 0' } },
      el('button.btn', { onclick: () => { qty = Math.max(1, qty - 1); update(); } }, '−'),
      label,
      el('button.btn', { onclick: () => { qty = Math.min(max, qty + 1); update(); } }, '+')),
    el('button.btn.wide.primary', {
      onclick: () => {
        const res = adv.buy(s.id, qty);
        closeOverlay();
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        sfx.coin();
        toast(`Bought ${qty} × ${s.def.name}.`, 'gold');
        refresh();
      },
    }, 'Buy'),
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

// ----------------------------------------------------------------- forge --
registerScreen('forge', () => {
  const rows = RECIPES.map(r => {
    const out = ITEMS[r.out];
    const check = adv.canForge(r);
    const parts = Object.entries(r.parts)
      .map(([p, n]) => `${ITEMS[p].name} ${itemCount(p)}/${n}`).join(' · ');
    return el('div.card', null,
      el('div.row', null,
        itemIconEl(out, 2),
        el('div.grow', null,
          el('div', null, out.name),
          el('div.faint', null, out.desc || ''),
          el('div.faint', null, `${parts} · ●${r.cost}`)),
        el('button.btn.small.primary', {
          disabled: !check.ok,
          onclick: () => {
            const res = adv.forge(r);
            if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
            sfx.confirm();
            toast(`Darrow hands you a ${out.name}.`, 'good');
            refresh();
          },
        }, 'Make')));
  });
  return el('div', null,
    screenHeader('The Forge', 'Darrow will make anything once, for parts.',
      el('button.btn.small', { onclick: () => show('place') }, 'Back')),
    el('div.stack', null, ...rows));
});
