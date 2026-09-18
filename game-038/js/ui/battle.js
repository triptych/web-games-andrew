// ============================================================
// ui/battle.js - the fight screen (GDD 6, 13)
// The engine resolves a whole round and hands back an event list; this
// plays it back. Animation never decides anything, so a fast-forward tap
// skips straight to the end state without changing it.
// ============================================================
import { el, $, clear, num } from '../core/util.js';
import { bus } from '../core/bus.js';
import { state, partyDragons, hasItem, removeItem, itemCount, inventoryList } from '../game/state.js';
import { registerScreen, show, toast, openOverlay, closeOverlay, infoDialog, confirmDialog, bar, statusIcons, elementTag, refresh } from './shell.js';
import { dragonSprite, drawDragon } from './sprites.js';
import * as adv from '../game/adventure.js';
import { SIDE } from '../game/battle.js';
import { MOVES, move, surgeFor } from '../data/moves.js';
import { ITEMS, item } from '../data/items.js';
import { elementMultiplier, matchupLabel, elementColour } from '../data/elements.js';
import { statsOf, maxHp } from '../gen/dragon.js';
import { stageName, TIMING } from '../data/constants.js';
import { itemUsable } from '../game/effects.js';
import { sfx, playMusic } from '../audio.js';
import { lineage } from '../data/lineages.js';

let battle = null;
let onDone = null;
let pendingTarget = null;        // { dragonId, moveId } waiting for a tap
let commandFor = null;           // which ally we are giving orders to
let playing = false;
let wardenUsed = false;

registerScreen('battle', (args) => {
  if (args.existing) battle = args.existing;
  else if (args.encounter) {
    const res = adv.startBattle(args.encounter, args.opts || {});
    if (!res.ok) { toast(res.why, 'bad'); show('place'); return el('div'); }
    battle = res.battle;
  }
  onDone = args.onDone || (() => show('place'));
  pendingTarget = null;
  commandFor = null;
  wardenUsed = false;
  playing = false;

  const root = el('div.battle');
  root.append(
    el('div#intro-line.faint.center', null, (args.encounter && args.encounter.intro) || ''),
    el('div#enemy-row.enemy-row'),
    el('div#queue.queue'),
    el('div.surge-wrap', null, el('span', null, 'SURGE'), el('div#surgebar.bar.surge', null, el('i')), el('span#surgepct', null, '0%')),
    el('div#ally-row.ally-row'),
    el('div#log.battle-log', { role: 'log', 'aria-live': 'polite' }),
    el('div#hint.target-hint'),
    el('div#commands.command-strip'));
  requestAnimationFrame(() => { renderAll(); });
  return root;
});

// ------------------------------------------------------------- rendering --
function renderAll() {
  if (!battle) return;
  renderEnemies();
  renderQueue();
  renderAllies();
  renderSurge();
  renderCommands();
}

function renderEnemies() {
  const host = $('#enemy-row');
  if (!host) return;
  clear(host);
  for (const e of battle.enemies) {
    const pct = e.hp / maxHp(e);
    const cell = el(`div.enemy${e.fainted ? '.down' : ''}`, {
      id: 'foe-' + e.id,
      role: 'button', tabindex: '0',
      'aria-pressed': String(pendingTarget && pendingTarget.targetId === e.id),
      onclick: () => onTargetTap(e),
    },
      dragonSprite(e, { scale: 2, flip: true, animate: !e.fainted }),
      el('div.ename', null, e.name),
      el('div.elvl', null, `Lv ${e.level} ${lineage(e.lineageId).name}${e.ashbound ? ' · ash' : ''}`),
      bar(e.hp, maxHp(e)),
      statusIcons(e.statuses),
      el('div.row', { style: { gap: '3px', justifyContent: 'center', marginTop: '2px' } },
        elementTag(e.elements[0]), e.elements[1] ? elementTag(e.elements[1]) : null));
    host.append(cell);
  }
}

function renderAllies() {
  const host = $('#ally-row');
  if (!host) return;
  clear(host);
  for (const a of battle.allies) {
    const cmd = battle.commands.get(a.id);
    const cell = el(`div.ally${a.fainted ? '.down' : ''}${commandFor === a.id ? '.acting' : ''}`, {
      id: 'ally-' + a.id,
      onclick: () => { if (!a.fainted && !playing) { commandFor = a.id; renderAll(); } },
    },
      el('div.aname', null, el('span.truncate', null, a.name), el('span.hp-num', null, `${a.hp}/${maxHp(a)}`)),
      dragonSprite(a, { scale: 2, animate: !a.fainted }),
      bar(a.hp, maxHp(a)),
      bar(a.mp, statsOf(a).mp, 'mp'),
      statusIcons(a.statuses),
      el('div.cmd', null, cmd ? describeCommand(cmd) : a.fainted ? 'down' : ''));
    host.append(cell);
  }
}

function describeCommand(cmd) {
  if (cmd.type === 'guard') return 'GUARD';
  if (cmd.type === 'surge') return 'SURGE';
  if (cmd.type === 'flee') return 'FLEE';
  return (move(cmd.moveId).name || '').toUpperCase();
}

function renderQueue() {
  const host = $('#queue');
  if (!host) return;
  clear(host);
  const order = battle.previewOrder();
  order.forEach((c, i) => {
    host.append(el(`div.queue-chip.${c.side === SIDE.ALLY ? 'ally' : 'foe'}${i === 0 ? '.now' : ''}`, null,
      `${c.name} ${battle.effStat(c, 'spd')}`));
  });
}

function renderSurge() {
  const b = $('#surgebar');
  if (!b) return;
  b.querySelector('i').style.width = battle.surge + '%';
  $('#surgepct').textContent = Math.round(battle.surge) + '%';
}

function log(text, kind = '') {
  const host = $('#log');
  if (!host) return;
  host.append(el(`p.${kind || 'hit'}`, null, text));
  host.scrollTop = host.scrollHeight;
}

// -------------------------------------------------------------- commands --
function renderCommands() {
  const host = $('#commands');
  const hint = $('#hint');
  if (!host) return;
  clear(host);
  if (!hint) return;
  hint.textContent = '';

  if (playing) { host.append(el('button.btn.wide', { disabled: true }, '…')); return; }
  if (battle.state !== 'input') { renderEndButtons(host); return; }

  const living = battle.living(SIDE.ALLY);
  if (!commandFor || !living.some(a => a.id === commandFor)) {
    const next = living.find(a => !battle.commands.has(a.id));
    commandFor = next ? next.id : (living[0] && living[0].id);
  }
  const actor = battle.byId(commandFor);

  if (pendingTarget) {
    hint.textContent = 'Tap an enemy above to aim.';
    host.append(el('button.btn', { onclick: () => { pendingTarget = null; renderAll(); } }, 'Cancel'));
    return;
  }

  if (actor && !battle.commands.has(actor.id)) {
    hint.textContent = `${actor.name}'s turn to be told.`;
    host.append(
      cmdButton('Strike', () => pickMove(actor, true)),
      cmdButton('Skills', () => pickMove(actor, false)),
      cmdButton('Guard', () => setCommand(actor, { type: 'guard' })),
      cmdButton('Item', () => openItemMenu()),
      cmdButton('Bind', () => openBindMenu()),
      cmdButton(battle.surge >= 100 ? 'SURGE!' : 'Flee', () => battle.surge >= 100 ? doSurge(actor) : setCommand(actor, { type: 'flee' })));
    return;
  }

  // everyone has orders
  hint.textContent = 'Everyone has their orders.';
  host.append(
    el('button.btn.primary', { style: { gridColumn: 'span 2' }, onclick: runRound }, 'Go'),
    cmdButton('Rethink', () => { battle.clearCommands(); wardenUsed = false; commandFor = null; renderAll(); }));
}

function cmdButton(label, onClick) {
  return el('button.btn', { onclick: () => { sfx.ui(); onClick(); } }, label);
}

function setCommand(actor, cmd) {
  battle.setCommand(actor.id, cmd);
  const next = battle.living(SIDE.ALLY).find(a => !battle.commands.has(a.id));
  commandFor = next ? next.id : null;
  renderAll();
}

function pickMove(actor, basicOnly) {
  const rows = battle.availableMoves(actor)
    .filter(o => basicOnly ? !o.move.mp : o.move.mp > 0);
  if (!rows.length) { toast(basicOnly ? 'No plain strike?' : `${actor.name} has no skills yet.`); return; }

  const list = el('div.move-pick');
  for (const o of rows) {
    const m = o.move;
    const foes = battle.living(SIDE.ENEMY);
    const best = m.element && foes.length
      ? Math.max(...foes.map(f => elementMultiplier(m.element, f.elements))) : 1;
    const label = m.element ? matchupLabel(best) : null;
    list.append(el('button.btn', {
      disabled: !o.usable,
      onclick: () => {
        closeOverlay();
        if (m.target === 'all' || m.target === 'self' || m.target === 'allies') {
          setCommand(actor, { type: m.mp ? 'skill' : 'strike', moveId: m.id });
        } else if (m.target === 'ally') {
          pickAllyTarget(actor, m);
        } else {
          // With one enemy on the field there is nothing to choose between,
          // so do not make the player tap it.
          const foes = battle.living(SIDE.ENEMY);
          if (foes.length === 1) setCommand(actor, { type: m.mp ? 'skill' : 'strike', moveId: m.id, targetId: foes[0].id });
          else { pendingTarget = { dragonId: actor.id, moveId: m.id, targetId: null }; renderAll(); }
        }
      },
    },
      el('div', { style: { textAlign: 'left', flex: '1', minWidth: 0 } },
        el('div', null, m.name, m.element ? el('span.el-tag', { style: { marginLeft: '6px', color: elementColour(m.element) } }, m.element) : null),
        el('div.faint', null, m.desc || ''),
        !o.usable ? el('div.bad', { style: { fontSize: '11px' } }, o.why) : null),
      el('div', { style: { textAlign: 'right' } },
        m.mp ? el('div.cost', null, `${o.cost} ley`) : el('div.faint', null, 'free'),
        m.power ? el('div.pw', null, `pow ${m.power}`) : null,
        label ? el('div', { class: 'mult ' + label.cls }, label.text) : null)));
  }
  openOverlay(el('div', null,
    el('h2', null, `${actor.name}: ${basicOnly ? 'strike' : 'skills'}`),
    list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function pickAllyTarget(actor, m) {
  const list = el('div.stack');
  for (const a of battle.living(SIDE.ALLY)) {
    list.append(el('button.btn', {
      onclick: () => { closeOverlay(); setCommand(actor, { type: m.mp ? 'skill' : 'strike', moveId: m.id, targetId: a.id }); },
    }, `${a.name} — ${a.hp}/${maxHp(a)}`));
  }
  openOverlay(el('div', null, el('h2', null, 'On whom?'), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function onTargetTap(enemy) {
  if (playing || enemy.fainted) return;
  if (!pendingTarget) {
    // Tapping an enemy with nothing queued shows what it is.
    return showEnemyInfo(enemy);
  }
  const { dragonId, moveId } = pendingTarget;
  // Clear the aim BEFORE committing: setCommand re-renders, and a stale
  // pendingTarget makes the command strip redraw as "Cancel", so the tap
  // looks like it did nothing at all.
  pendingTarget = null;
  const actor = battle.byId(dragonId);
  const m = move(moveId);
  setCommand(actor, { type: m.mp ? 'skill' : 'strike', moveId: m.id, targetId: enemy.id });
  sfx.confirm();
}

function showEnemyInfo(e) {
  const s = statsOf(e);
  openOverlay(el('div', null,
    el('h2', null, e.name),
    el('div.row', null, dragonSprite(e, { scale: 3, flip: true }),
      el('div.grow', null,
        el('div', null, `${lineage(e.lineageId).name} · Lv ${e.level} ${stageName(e.stage)}`),
        el('div.row.wrap', null, elementTag(e.elements[0]), e.elements[1] ? elementTag(e.elements[1]) : null),
        el('p.faint', null, e.ashbound ? 'Grey, and not answering to anything. Cleanse it to see what it was.' : ''))),
    el('div.statgrid', null, ...Object.entries(s).map(([k, v]) =>
      el('div', null, el('span.k', null, k.toUpperCase()), el('span', null, String(v))))),
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function doSurge(actor) {
  const s = surgeFor(actor.lineageId, actor.stage);
  confirmDialog({
    title: s.name,
    body: `${s.desc} Spends the whole Ember Surge.`,
    confirmText: 'Let it out',
    onConfirm: () => setCommand(actor, { type: 'surge', targetId: (battle.living(SIDE.ENEMY)[0] || {}).id }),
  });
}

// ------------------------------------------------------------ warden acts --
function openItemMenu() {
  if (wardenUsed) { toast('You only get one action a round.', 'bad'); return; }
  const usable = inventoryList((def) => ['restorative', 'cure', 'battle', 'food'].includes(def.kind));
  if (!usable.length) { toast('Your pack has nothing useful in it.'); return; }
  const list = el('div.stack');
  for (const entry of usable) {
    list.append(el('button.btn', {
      onclick: () => { closeOverlay(); pickItemTarget(entry.def); },
    }, el('div.grow', { style: { textAlign: 'left' } },
        el('div', null, `${entry.def.name} ×${entry.count}`),
        el('div.faint', null, entry.def.desc || ''))));
  }
  openOverlay(el('div', null, el('h2', null, 'Your pack'), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function pickItemTarget(def) {
  const e = def.effect || {};
  const toEnemies = !!e.damage || !!e.cleanse;
  const pool = toEnemies ? battle.living(SIDE.ENEMY) : battle.allies;
  if (e.flee || e.surge || e.partyStatus || e.target === 'allies') return useWardenItem(def, null);
  const list = el('div.stack');
  for (const t of pool) {
    const ok = itemUsable(def.id, t, { inBattle: true, battle });
    list.append(el('button.btn', {
      disabled: !ok,
      onclick: () => { closeOverlay(); useWardenItem(def, t); },
    }, `${t.name} — ${t.hp}/${maxHp(t)}${t.fainted ? ' (down)' : ''}`));
  }
  openOverlay(el('div', null, el('h2', null, def.name), el('p.faint', null, def.desc || ''), list,
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

function useWardenItem(def, target) {
  if (!hasItem(def.id)) { toast('You have none.', 'bad'); return; }
  battle.setWardenCommand({ type: 'item', itemId: def.id, targetId: target ? target.id : null });
  removeItem(def.id, 1);
  wardenUsed = true;
  toast(`${def.name} readied.`, 'good');
  renderAll();
}

function openBindMenu() {
  if (wardenUsed) { toast('You only get one action a round.', 'bad'); return; }
  if (!battle.wild) { toast('This one is not yours to take.', 'bad'); return; }
  const bindings = inventoryList(def => def.kind === 'binding');
  if (!bindings.length) { toast('You have no bindings.', 'bad'); return; }
  const foes = battle.living(SIDE.ENEMY);
  const list = el('div.stack');
  for (const entry of bindings) {
    for (const foe of foes) {
      const chance = battle.bindChance(foe, entry.id);
      list.append(el('button.btn', {
        disabled: chance <= 0,
        onclick: () => {
          closeOverlay();
          battle.setWardenCommand({ type: 'bind', targetId: foe.id, itemId: entry.id });
          removeItem(entry.id, 1);
          wardenUsed = true;
          sfx.bind();
          toast('Binding readied.', 'good');
          renderAll();
        },
      }, el('div.grow', { style: { textAlign: 'left' } },
          el('div', null, `${entry.def.name} ×${entry.count} → ${foe.name}`),
          el('div', { class: chance > 0.6 ? 'good' : chance > 0.3 ? 'gold' : 'faint', style: { fontSize: '11px' } },
            chance <= 0 ? (foe.boss ? 'Nothing this size will hold.' : 'It will not hold.')
                        : `about ${Math.round(chance * 100)}% — hurt it more to improve this`))));
    }
  }
  openOverlay(el('div', null,
    el('h2', null, 'Throw a binding'),
    el('p.faint', null, 'A binding holds a hurt dragon, not a healthy one. Chill, stun and soak all help.'),
    list, el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

// ------------------------------------------------------------- playback --
function runRound() {
  if (playing) return;
  const events = battle.resolveRound();
  playing = true;
  renderCommands();
  playEvents(events, 0);
}

function playEvents(events, i) {
  if (i >= events.length) { playing = false; renderAll(); afterRound(); return; }
  const e = events[i];
  const step = () => playEvents(events, i + 1);
  const delay = applyEvent(e);
  if (state.settings.fastText) setTimeout(step, 10);
  else setTimeout(step, delay);
}

/** Returns how long the UI should dwell on this event. */
function applyEvent(e) {
  switch (e.type) {
    case 'round': log(`— Round ${e.round} —`, 'good'); return 160;
    case 'log': log(e.text, e.kind); return e.kind === 'surge' || e.kind === 'boss' ? 520 : TIMING.log;
    case 'damage': {
      floatNumber(e.target, `-${e.amount}`, e.crit ? 'crit' : '');
      shake(e.target);
      updateBars();
      sfx.hit(e.crit || e.amount > 120);
      return 60;
    }
    case 'heal': floatNumber(e.target, `+${e.amount}`, 'heal'); updateBars(); sfx.heal(); return 60;
    case 'miss': sfx.miss(); return 60;
    case 'faint': sfx.faint(); updateBars(); return 240;
    case 'surge': renderSurge(); return 0;
    case 'surgeCast': sfx.surge(); flash('#ff8a3d'); return 420;
    case 'cleansed': sfx.cleanse(); flash('#f2e2a0'); renderEnemies(); return 420;
    case 'bindThrow': sfx.bind(); return 300;
    case 'bound': sfx.bound(); flash('#f2c94c'); return 600;
    case 'bindFail': sfx.bindFail(); return 300;
    case 'windup': flash('#9d7fd0'); return 500;
    case 'status': renderEnemies(); renderAllies(); return 120;
    default: return 40;
  }
}

function updateBars() {
  for (const c of battle.combatants) {
    const host = document.getElementById((c.side === SIDE.ALLY ? 'ally-' : 'foe-') + c.id);
    if (!host) continue;
    const bars = host.querySelectorAll('.bar > i');
    if (bars[0]) bars[0].style.width = (c.hp / maxHp(c) * 100) + '%';
    if (c.side === SIDE.ALLY && bars[1]) bars[1].style.width = (c.mp / statsOf(c).mp * 100) + '%';
    const nums = host.querySelector('.hp-num');
    if (nums) nums.textContent = `${c.hp}/${maxHp(c)}`;
    host.classList.toggle('down', !!c.fainted);
  }
  renderSurge();
}

function floatNumber(id, text, cls) {
  const host = document.getElementById('ally-' + id) || document.getElementById('foe-' + id);
  if (!host) return;
  const n = el(`div.float-num${cls ? '.' + cls : ''}`, null, text);
  host.append(n);
  setTimeout(() => n.remove(), 760);
}

function shake(id) {
  if (state.settings.reducedMotion) return;
  const host = document.getElementById('ally-' + id) || document.getElementById('foe-' + id);
  if (!host) return;
  host.classList.remove('shake');
  void host.offsetWidth;
  host.classList.add('shake');
}

function flash(colour) {
  if (state.settings.reducedMotion) return;
  const f = el('div.flash-overlay', { style: { background: colour } });
  document.body.append(f);
  setTimeout(() => f.remove(), 540);
}

// ------------------------------------------------------------------ end --
function afterRound() {
  if (battle.state === 'input') { commandFor = null; wardenUsed = false; renderAll(); return; }
  renderCommands();
}

function renderEndButtons(host) {
  const label = { won: 'Won', captured: 'Bound', lost: 'Lost', fled: 'Away' }[battle.state] || 'Done';
  host.append(el('button.btn.primary', { style: { gridColumn: 'span 3' }, onclick: finish }, label + ' — carry on'));
}

function finish() {
  const report = adv.finishBattle();
  playMusic('field');
  const done = onDone;
  battle = null;
  showReport(report, () => done && done(report));
}

/** The after-battle screen: what you got, who grew, and what hatched. */
function showReport(report, after) {
  if (!report) { after && after(); return; }
  const body = el('div');

  if (report.state === 'lost') {
    const res = adv.handleDefeat();
    body.append(
      el('p', null, 'You wake at the Broodwell with somebody else’s hands on your shoulders and no clear memory of the walk back.'),
      el('p.dim', null, `Your brood is patched up. You are ${res.lost} coin lighter — somebody had to be paid.`));
    openOverlay(el('div', null, el('h2', null, 'You went down'), body,
      el('button.btn.wide.primary', { onclick: () => { closeOverlay(); show('place'); } }, 'Get up')), { dismissable: false });
    return;
  }

  if (report.state === 'fled') {
    body.append(el('p.dim', null, 'You break off and go. Nothing gained, nothing owed.'));
  } else {
    if (report.coin) body.append(el('div.reward-line.gold', null, `● ${num(report.coin)} coin`));
    if (report.xp) body.append(el('div.reward-line', null, `✦ ${num(report.xp)} experience, split across the brood`));
    for (const d of report.drops || []) body.append(el('div.reward-line', null, `➕ ${ITEMS[d].name}`));
    if (report.captured) {
      sfx.bound();
      body.append(el('div.card', { style: { marginTop: '10px', borderColor: 'var(--ember)' } },
        el('div.row', null, dragonSprite(report.captured, { scale: 3 }),
          el('div.grow', null,
            el('strong', null, report.captured.name),
            el('div.faint', null, `${lineage(report.captured.lineageId).name} · Lv ${report.captured.level}`),
            el('p.faint', null, 'It is yours to keep, and to feed.')))));
    }
    if (report.rosterFull) body.append(el('p.bad', null, 'The Broodwell is full. It slipped away.'));
    for (const rep of report.levels || []) {
      if (rep.levels.length) {
        sfx.levelUp();
        body.append(el('div.reward-line.good', null, `▲ ${rep.dragon.name} reaches level ${rep.dragon.level}`));
      }
      for (const m of rep.moves) body.append(el('div.reward-line', null, `• ${rep.dragon.name} learns ${MOVES[m] ? MOVES[m].name : m}`));
      if (rep.stage) {
        sfx.stage();
        body.append(el('div.reward-line.ember', null, `★ ${rep.dragon.name} grows into a ${stageName(rep.stage)}`));
      }
    }
    if (report.eggsReady) body.append(el('div.reward-line.ember', null, `☁ An egg is ready to hatch at the Broodwell.`));
  }

  openOverlay(el('div', null,
    el('h2', null, report.state === 'captured' ? 'Bound' : report.state === 'fled' ? 'Away' : 'Won'),
    body,
    el('button.btn.wide.primary', { onclick: () => { closeOverlay(); after && after(); } }, 'Carry on')),
    { dismissable: false });
}

export { showReport };
