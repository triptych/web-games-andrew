// ============================================================
// ui/brood.js - the roster, one dragon in detail, and the Broodwell
// ============================================================
import { el, clear, num, cap } from '../core/util.js';
import { state, dragonById, partyDragons, reserveDragons, togglePartyMember, releaseDragon,
         equipItem, unequip, inventoryList, hasItem, removeItem, itemCount } from '../game/state.js';
import { registerScreen, show, toast, openOverlay, closeOverlay, confirmDialog, infoDialog,
         screenHeader, dragonCard, bar, elementTag, emptyState, refresh } from './shell.js';
import { dragonSprite, drawEgg } from './sprites.js';
import { statsOf, maxHp, describe, moveList, traitList, canBreed, movesAtLevel } from '../gen/dragon.js';
import { lineage, LINEAGES } from '../data/lineages.js';
import { TRAITS } from '../data/traits.js';
import { MOVES, move, surgeFor, TEACHABLE } from '../data/moves.js';
import { ITEMS, item } from '../data/items.js';
import { STAT_LABEL, STAT_SHORT, STATS, stageName, XP, BOND_MAX, MOVE_SLOTS, TEMPERAMENTS, ESSENCE_CAP, PARTY_SIZE } from '../data/constants.js';
import { applyItem, itemUsable } from '../game/effects.js';
import * as adv from '../game/adventure.js';
import { breedingPreview } from '../game/breeding.js';
import { sfx } from '../audio.js';
import { liveRng } from '../game/state.js';

// ------------------------------------------------------------- the roster --
registerScreen('brood', () => {
  const party = partyDragons();
  const reserve = reserveDragons();
  const eggs = state.eggs;

  return el('div', null,
    screenHeader('Your brood', `${state.roster.length} dragon${state.roster.length === 1 ? '' : 's'} · ${eggs.length} egg${eggs.length === 1 ? '' : 's'}`,
      el('button.btn.small', { onclick: () => show('broodex') }, 'Broodex')),
    el('h2', null, `Party (${party.length}/${PARTY_SIZE})`),
    party.length ? el('div', null, ...party.map(d => dragonCard(d, { onClick: showDragon }))) 
                 : emptyState('Nobody in the party. Tap a dragon below to take it with you.'),
    eggs.length ? el('div', null, el('h2', { style: { marginTop: '14px' } }, 'Eggs'), ...eggs.map(eggCard)) : null,
    el('h2', { style: { marginTop: '14px' } }, `The Broodwell (${reserve.length})`),
    reserve.length ? el('div', null, ...reserve.map(d => dragonCard(d, { onClick: showDragon })))
                   : emptyState('Nothing waiting at home.'));
});

function eggCard(egg) {
  const canvas = el('canvas');
  requestAnimationFrame(() => drawEgg(canvas, egg, { scale: 2 }));
  const ready = egg.battlesLeft === 0;
  return el('div.card.egg-row', null,
    canvas,
    el('div.grow', null,
      el('div', null, ready ? 'Ready to hatch' : `${egg.battlesLeft} more battle${egg.battlesLeft === 1 ? '' : 's'}`),
      el('div.faint', null, `${lineage(egg.lineageId).name} · gen ${egg.generation} · ${egg.parents.join(' × ')}`),
      bar(egg.totalBattles - egg.battlesLeft, egg.totalBattles, 'xp')),
    ready ? el('button.btn.small.primary', {
      onclick: () => {
        const res = adv.hatchEgg(egg.id);
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        sfx.hatch();
        showHatchling(res.dragon, egg);
      },
    }, 'Hatch') : null);
}

function showHatchling(d, egg) {
  openOverlay(el('div', null,
    el('h2', null, 'It hatches'),
    el('div.row', null, dragonSprite(d, { scale: 4 }),
      el('div.grow', null,
        el('strong', null, d.name),
        el('div.faint', null, `${lineage(d.lineageId).name} · generation ${d.generation}`),
        el('div.row.wrap', null, elementTag(d.elements[0]), d.elements[1] ? elementTag(d.elements[1]) : null))),
    el('p.dim', null, describe(d)),
    ...(egg.notes || []).map(n => el('p.faint', null, '• ' + n)),
    egg.throwback ? el('p.ember', null, 'A line that had gone out of the family comes back up in it.') : null,
    el('button.btn.wide.primary', { onclick: () => { closeOverlay(); refresh(); } }, 'Welcome')),
    { dismissable: false });
}

// -------------------------------------------------------- one dragon view --
export function showDragon(d) {
  show('dragon', { id: d.id });
}

registerScreen('dragon', ({ id }) => {
  const d = dragonById(id);
  if (!d) { show('brood'); return el('div'); }
  const s = statsOf(d);
  const lin = lineage(d.lineageId);
  const temp = TEMPERAMENTS[d.temperament];
  const inParty = state.party.includes(d.id);
  const surge = surgeFor(d.lineageId, d.stage);

  return el('div', null,
    screenHeader(d.name, `${lin.name} · Lv ${d.level} ${stageName(d.stage)}`,
      el('button.btn.small', { onclick: () => show('brood') }, 'Back')),

    el('div.card', null,
      el('div.row', null,
        dragonSprite(d, { scale: 4 }),
        el('div.grow', null,
          el('div.row.wrap', null,
            elementTag(d.elements[0]), d.elements[1] ? elementTag(d.elements[1]) : null,
            el('span.pill', null, cap(d.broodRole)),
            (d.generation || 0) > 0 ? el('span.pill.gen', null, `Gen ${d.generation}`) : null,
            d.ashbound ? el('span.pill.ash', null, 'Ashbound') : null),
          el('p.faint', { style: { marginTop: '6px' } }, describe(d)),
          temp ? el('p.faint', null, `${temp.name}. ${temp.blurb}`) : null,
          d.parents ? el('p.faint', null, `Out of ${d.parents.join(' and ')}.`) : null)),
      el('div.sep'),
      el('div.row', { style: { gap: '6px' } }, el('span.faint', null, 'HP '), bar(d.hp, s.hp), el('span.faint', null, `${d.hp}/${s.hp}`)),
      el('div.row', { style: { gap: '6px' } }, el('span.faint', null, 'LEY'), bar(d.mp, s.mp, 'mp'), el('span.faint', null, `${d.mp}/${s.mp}`)),
      el('div.row', { style: { gap: '6px' } }, el('span.faint', null, 'XP '), bar(d.xp, XP.toNext(d.level), 'xp'), el('span.faint', null, `${d.xp}/${XP.toNext(d.level)}`)),
      el('div.row', { style: { gap: '6px' } }, el('span.faint', null, 'BND'), bar(d.bond, BOND_MAX, 'bond'), el('span.faint', null, `${d.bond}`))),

    el('div.card', null,
      el('h3', null, 'Stats'),
      el('div.statgrid', null, ...STATS.map(k =>
        el('div', null, el('span.k', null, STAT_SHORT[k]), el('span', null, String(s[k]))))),
      el('div.faint', { style: { marginTop: '6px' } },
        'Essence: ' + STATS.map(k => `${STAT_SHORT[k]} ${d.essence[k] || 0}`).join(' · '))),

    el('div.card', null,
      el('h3', null, `Skills (${d.moves.length}/${MOVE_SLOTS[d.stage] ?? 4})`),
      ...moveList(d).map(m => el('div.move-row', null,
        el('div.mname', null, m.name, el('div.faint', null, m.desc || '')),
        m.element ? elementTag(m.element) : null,
        m.mp ? el('span.cost', null, `${m.mp}`) : el('span.faint', null, 'free'),
        m.power ? el('span.pw', null, `${m.power}`) : null)),
      el('div.sep'),
      el('h3', null, 'Ember Surge'),
      el('div.move-row', null,
        el('div.mname', null, surge.name, el('div.faint', null, surge.desc)),
        elementTag(surge.element), el('span.pw', null, `${surge.power}`))),

    el('div.card', null,
      el('h3', null, 'Traits'),
      ...traitList(d).map(t => el('div.move-row', null,
        el('div.mname', null, t.name, el('div.faint', null, t.desc))))),

    el('div.card', null,
      el('h3', null, 'Gear'),
      gearRow(d, 'harness'),
      gearRow(d, 'relic')),

    el('div.btn-grid', null,
      el('button.btn', { onclick: () => { togglePartyMember(d.id); sfx.ui(); refresh(); } },
        inParty ? 'Leave at home' : 'Take along'),
      el('button.btn', { onclick: () => openFeedMenu(d) }, 'Feed / train'),
      el('button.btn', { onclick: () => openRename(d) }, 'Rename'),
      el('button.btn.danger', { onclick: () => confirmDialog({
        title: `Let ${d.name} go?`,
        body: 'It goes back to where you found it. You will not get it back.',
        danger: true, confirmText: 'Let it go',
        onConfirm: () => { releaseDragon(d.id); toast(`${d.name} goes.`); show('brood'); },
      }) }, 'Release')));
});

function gearRow(d, slot) {
  const g = d.equip[slot];
  return el('div.move-row', null,
    el('div.mname', null, cap(slot), el('div.faint', null, g ? g.desc : 'empty')),
    el('button.btn.small', { onclick: () => g ? doUnequip(d, slot) : openEquipMenu(d, slot) }, g ? g.name : 'Equip'));
}

function doUnequip(d, slot) {
  unequip(d.id, slot);
  sfx.ui();
  refresh();
}

function openEquipMenu(d, slot) {
  const relics = inventoryList(def => def.kind === 'relic' && (def.slot || 'relic') === slot);
  if (!relics.length) { toast(`You have no ${slot} to fit.`); return; }
  const list = el('div.stack');
  for (const entry of relics) {
    list.append(el('button.btn', {
      onclick: () => {
        const res = equipItem(d.id, entry.id);
        closeOverlay();
        if (!res.ok) { toast(res.why, 'bad'); return; }
        sfx.confirm(); refresh();
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, `${entry.def.name} ×${entry.count}`),
        el('div.faint', null, entry.def.desc))));
  }
  openOverlay(el('div', null, el('h2', null, `Fit a ${slot}`), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function openFeedMenu(d) {
  const usable = inventoryList(def => ['food', 'training', 'restorative', 'cure'].includes(def.kind));
  if (!usable.length) { toast('Nothing in the pack for that.'); return; }
  const list = el('div.stack');
  for (const entry of usable) {
    const ok = itemUsable(entry.id, d, { inBattle: false });
    list.append(el('button.btn', {
      disabled: !ok,
      onclick: () => {
        const res = applyItem(entry.id, d, { rng: liveRng('feed') });
        closeOverlay();
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        removeItem(entry.id, 1);
        sfx.confirm();
        if (entry.def.effect && entry.def.effect.teach) return openTeachMenu(d);
        if (entry.def.effect && entry.def.effect.trait) return openTraitMenu(d);
        infoDialog(entry.def.name, el('div', null, ...res.lines.map(l => el('p.dim', null, l))), refresh);
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, `${entry.def.name} ×${entry.count}`),
        el('div.faint', null, entry.def.desc))));
  }
  openOverlay(el('div', null, el('h2', null, `Give ${d.name} something`), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

/** Memory Stone: teach anything, but the belt has a size. */
function openTeachMenu(d) {
  const rng = liveRng('teach');
  const options = rng.sample(TEACHABLE.filter(id => !d.moves.includes(id)), 5);
  const list = el('div.stack');
  for (const id of options) {
    const m = move(id);
    list.append(el('button.btn', {
      onclick: () => {
        const slots = MOVE_SLOTS[d.stage] ?? 4;
        if (d.moves.length < slots) { d.moves.push(id); closeOverlay(); sfx.levelUp(); toast(`${d.name} learns ${m.name}.`, 'good'); refresh(); }
        else { closeOverlay(); openForgetMenu(d, id); }
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, m.name), el('div.faint', null, m.desc))));
  }
  openOverlay(el('div', null, el('h2', null, 'The stone remembers'),
    el('p.faint', null, 'Five things it could teach. It will only teach one.'), list), { dismissable: false });
}

function openForgetMenu(d, newMove) {
  const list = el('div.stack');
  for (const id of d.moves) {
    list.append(el('button.btn', {
      onclick: () => {
        d.moves = d.moves.map(m => m === id ? newMove : m);
        closeOverlay(); sfx.levelUp();
        toast(`${d.name} forgets ${move(id).name} and learns ${move(newMove).name}.`, 'good');
        refresh();
      },
    }, `Forget ${move(id).name}`));
  }
  list.append(el('button.btn.danger', { onclick: () => { closeOverlay(); toast('It keeps what it had.'); refresh(); } }, 'Forget nothing'));
  openOverlay(el('div', null, el('h2', null, `Its belt is full`),
    el('p.faint', null, `To learn ${move(newMove).name} it has to let something go.`), list), { dismissable: false });
}

function openTraitMenu(d) {
  const rng = liveRng('trait');
  const pool = Object.keys(TRAITS).filter(t => !d.traits.includes(t) && t !== 'hollowed');
  const options = rng.sample(pool, 3);
  const list = el('div.stack');
  for (const id of options) {
    const t = TRAITS[id];
    list.append(el('button.btn', {
      onclick: () => { d.traits.push(id); closeOverlay(); sfx.stage(); toast(`${d.name} gains ${t.name}.`, 'good'); refresh(); },
    }, el('div.grow', { style: { textAlign: 'left' } }, el('div', null, t.name), el('div.faint', null, t.desc))));
  }
  openOverlay(el('div', null, el('h2', null, 'The ledger says'), list), { dismissable: false });
}

function openRename(d) {
  const input = el('input', { type: 'text', maxlength: '18', value: d.name, 'aria-label': 'Name' });
  openOverlay(el('div', null,
    el('h2', null, 'Call it something'),
    el('div.seed-row', null, input),
    el('button.btn.wide.primary', {
      onclick: () => {
        const v = input.value.trim();
        if (v) d.name = v;
        closeOverlay(); sfx.confirm(); refresh();
      },
    }, 'That will do'),
    el('button.btn.wide', { onclick: closeOverlay }, 'Leave it')));
  setTimeout(() => input.focus(), 40);
}

// ------------------------------------------------------------ broodwell --
let pairA = null, pairB = null;

registerScreen('broodwell', () => {
  const a = pairA ? dragonById(pairA) : null;
  const b = pairB ? dragonById(pairB) : null;
  const preview = a && b ? breedingPreview(a, b) : null;

  const slot = (d, which) => el(`div.pair-slot${d ? '.filled' : ''}`, {
    onclick: () => openPairPicker(which),
  }, d ? dragonSprite(d, { scale: 2, animate: false }) : el('div', null, '+'),
     el('div', null, d ? d.name : 'pick a parent'),
     d ? el('div.faint', null, `${cap(d.broodRole)} · Lv ${d.level} · bond ${d.bond}`) : null);

  const body = el('div', null,
    el('div.card', null,
      el('h3', null, 'Pair'),
      el('div.pair-slots', null, slot(a, 'a'), el('div.center.ember', null, '×'), slot(b, 'b')),
      preview && !preview.ok ? el('p.bad', { style: { marginTop: '8px' } }, preview.why) : null,
      preview && preview.ok ? el('div', { style: { marginTop: '8px' } },
        el('p.faint', null, `Generation ${preview.generation} · incubates over ${preview.incubation} battles`),
        el('p.faint', null, `Lineage: ${lineage(preview.lineages[0].id).name} ${Math.round(preview.lineages[0].chance * 100)}% / ${lineage(preview.lineages[1].id).name} ${Math.round(preview.lineages[1].chance * 100)}%`),
        preview.fusion ? el('p.ember', null, `These two lines can make ${preview.fusion}.`) : null,
        preview.throwback ? el('p.gold', null, `There is an Elder line close behind them: ${lineage(preview.throwback).name}.`) : null) : null,
      el('button.btn.wide.primary', {
        style: { marginTop: '10px' },
        disabled: !(preview && preview.ok),
        onclick: () => openBreedConfirm(a, b),
      }, 'Pair them')),

    state.eggs.length ? el('div', null, el('h2', null, 'Warm room'), ...state.eggs.map(eggCard)) : null,

    el('div.card', null,
      el('h3', null, 'How it works'),
      el('p.faint', null, 'A pair needs one kindler and one clutcher, both level 10 or better, both bonded to 30 or better. Each egg takes the better of three of its parents’ essences, may carry two of their skills, and adds a generation — which is worth 2% on every stat, up to 10%.'),
      el('p.faint', null, 'An ashbound dragon will not brood until it is cleansed. After that it will \u2014 and one you cleansed before binding starts out trusting you further than one you simply beat.'),
      el('p.faint', null, 'Bond grows by fighting alongside you, by feeding, and a little for everyone at home each time you sleep at the Broodwell.')));

  return el('div', null,
    screenHeader('The Broodwell', 'Maerin’s hatchery, under the hill.',
      el('button.btn.small', { onclick: () => show('place') }, 'Back')),
    body);
});

function openPairPicker(which) {
  const list = el('div.stack');
  for (const d of state.roster) {
    if (d.stage === 'egg') continue;
    list.append(el('button.btn', {
      onclick: () => {
        if (which === 'a') pairA = d.id; else pairB = d.id;
        closeOverlay(); sfx.ui(); refresh();
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, `${d.name} · Lv ${d.level}`),
        el('div.faint', null, `${lineage(d.lineageId).name} · ${cap(d.broodRole)} · bond ${d.bond}${d.ashbound ? ' · ashbound' : ''}`))));
  }
  openOverlay(el('div', null, el('h2', null, 'Which one?'), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function openBreedConfirm(a, b) {
  const helpers = ['warmth_stone', 'lineage_charm', 'prism_dust', 'ember_yolk', 'brood_tithe']
    .filter(id => hasItem(id));
  const chosen = {};
  const list = el('div.stack');
  for (const id of helpers) {
    const def = ITEMS[id];
    const btn = el('button.btn', {
      onclick: () => {
        chosen[id] = !chosen[id];
        btn.style.borderColor = chosen[id] ? 'var(--ember)' : '';
        sfx.ui();
      },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, `${def.name} ×${itemCount(id)}`),
        el('div.faint', null, def.desc)));
    list.append(btn);
  }
  openOverlay(el('div', null,
    el('h2', null, `${a.name} × ${b.name}`),
    helpers.length ? el('div', null, el('p.faint', null, 'Use anything from the pack?'), list) : null,
    el('button.btn.wide.primary', {
      onclick: () => {
        const use = {};
        for (const id of Object.keys(chosen)) if (chosen[id]) use[id] = id === 'lineage_charm' ? 'a' : true;
        const res = adv.layEgg(a.id, b.id, use);
        closeOverlay();
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        sfx.hatch();
        pairA = pairB = null;
        infoDialog('An egg', el('div', null,
          el('p.dim', null, `It will take ${res.egg.battlesLeft} battles. Keep it warm by getting on with things.`),
          ...(res.egg.notes || []).map(n => el('p.faint', null, '• ' + n))), refresh);
      },
    }, 'Pair them'),
    el('button.btn.wide', { onclick: closeOverlay }, 'Not yet')));
}

// ------------------------------------------------------------- broodex --
registerScreen('broodex', () => {
  const rows = Object.entries(lineageTable()).map(([id, e]) => {
    const lin = lineage(id);
    return el(`div.card.dex-cell${e.seen ? '' : '.unseen'}`, null,
      el('strong', null, e.seen ? lin.name : '???'),
      el('div.faint', null, e.seen ? `seen ${e.seen} · held ${e.caught}${e.bred ? ` · bred ${e.bred}` : ''}` : 'not yet met'),
      e.seen ? el('div.faint', null, lin.blurb) : null);
  });
  return el('div', null,
    screenHeader('Broodex', `${Object.values(state.broodex).filter(e => e.caught > 0).length} lineages held of 12`,
      el('button.btn.small', { onclick: () => show('brood') }, 'Back')),
    el('div.stack', null, ...rows));
});

/** Every lineage, not just the ones the player has an entry for. */
function lineageTable() {
  const out = {};
  for (const id of Object.keys(LINEAGES)) out[id] = state.broodex[id] || { seen: 0, caught: 0, bred: 0 };
  return out;
}
