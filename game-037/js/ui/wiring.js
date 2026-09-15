// ============================================================
// ui/wiring.js - the bus subscriptions and the control bindings
// Split out of main.js, which keeps boot and the frame loop.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DIRS8 } from '../core/coords.js';
import { astar } from '../core/grid.js';
import { tileDef } from '../data/tiles.js';
import { moveCost, groundAt } from '../world/access.js';
import { streamAround } from '../world/chunks.js';
import { refreshNpcActors } from '../world/entities.js';
import { rollDrop } from '../gen/monster.js';
import { State, logLine } from '../game/state.js';
import { recomputePlayer } from '../game/player.js';
import {
  act, tryMove, doContext, doVerb, doWait, doShove, doDouse, doRestUntil,
  contextVerb, regionForPlayer, floorItemsAt, setFloorItems,
} from '../game/actions.js';
import { onPlayerAction } from '../game/quests.js';
import { wake, wakeWarning, expirePacks } from '../game/wake.js';
import { checkLongThread, resolveTheOne, chooseEnding } from '../game/longthread.js';
import { checkLitCondition } from '../game/hollowrun.js';
import { snapCamera, markDirty, view } from '../render/renderer.js';
import { push as pushEffect, addShake, fastForward } from '../render/effects.js';
import { openPanel, closePanel } from './panels.js';
import { showDialogue, hideDialogue } from './dialoguebox.js';
import { openMap } from './mapscreen.js';
import { toast } from './toast.js';
import { closeDialogue } from '../game/dialogue.js';
import { initInput, showVerbWheel } from '../input/input.js';
import { requestSave } from '../world/save.js';
import { startAudio, sfx, setEnabled, setAmbience } from '../audio.js';
import { weatherAt } from '../game/time.js';
import { biomeAt } from '../gen/fields.js';
import { advanceTime } from '../game/time.js';
import { updateFOV } from '../game/actions.js';

const el = id => document.getElementById(id);
let refresh = () => {};
let ensureLoop = () => {};

export function bindRuntime(refreshFn, ensureLoopFn) { refresh = refreshFn; ensureLoop = ensureLoopFn; }

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------

export function wireEvents() {
  bus.on(EV.UI_LOG, p => logLine(p.text, p.tone));
  bus.on(EV.UI_TOAST, p => toast(p.text, p.icon));
  bus.on(EV.UI_SHAKE, p => addShake(p.mag, p.ms));
  bus.on(EV.UI_REFRESH, () => refresh());
  bus.on(EV.UI_PANEL, p => openPanel(State, p.name, p));
  bus.on(EV.UI_DIALOGUE, p => {
    if (p.open) showDialogue(State, State.dialogue.npc);
    else hideDialogue();
  });

  bus.on(EV.ACTOR_MOVED, p => {
    if (p.id === 'player') {
      const t = tileDef(groundAt(State, p.to.x, p.to.y));
      sfx.step(t.key);
    }
    pushEffect({ kind: 'lerpMove', actorId: p.id, from: p.from, to: p.to, ms: 110 });
    markDirty(); ensureLoop();
  });

  bus.on(EV.ACTOR_DAMAGED, p => {
    pushEffect({ kind: 'hitFlash', actorId: p.id, ms: 90 });
    pushEffect({ kind: 'float', x: p.x, y: p.y, text: '-' + p.amount, color: p.crit ? '#ffd27a' : '#ffb3a0', ms: 600 });
    if (p.id === 'player') {
      addShake(2, 120);
      sfx.hurt();
      if (State.settings.haptics && navigator.vibrate) navigator.vibrate(12);
      wakeWarning(State);
    } else {
      sfx.hit(p.amount >= 10);
      if (State.settings.haptics && navigator.vibrate) navigator.vibrate(6);
    }
    markDirty(); ensureLoop();
  });

  bus.on(EV.ACTOR_DIED, p => {
    State.stats.kills++;
    onKill(p);
  });

  bus.on(EV.ITEM_ACQUIRED, () => sfx.pickup());
  bus.on(EV.PLAYER_LEVELED, () => {
    sfx.levelUp();
    if (State.pendingLevelChoice) openPanel(State, 'levelup');
  });
  bus.on(EV.PLAYER_CAPABILITY, p => { toast('You can do something new.', '✦'); sfx.levelUp(); });
  bus.on(EV.PLAYER_VIGOR, () => sfx.levelUp());
  bus.on(EV.PLAYER_WOKE, p => {
    if (p && p.pending) { sfx.wake(); wake(State); snapCamera(); refresh(); }
  });
  bus.on(EV.HOLLOW_LIT, () => { sfx.bell(); toast('A Hollow is lit.', '✦'); });
  bus.on(EV.HOLLOW_ENTERED, () => { snapCamera(); updateWeather(); });
  bus.on(EV.HOLLOW_LEFT, () => { snapCamera(); updateWeather(); });
  bus.on(EV.QUEST_COMPLETED, () => { sfx.levelUp(); toast('Done.', '✓'); });
  bus.on(EV.WORLD_DAYTICK, () => { expirePacks(State); checkLongThread(State); });
  bus.on(EV.WORLD_QUIET, () => updateWeather());
  bus.on(EV.SAVE_ERROR, p => toast('Could not save: ' + p.message, '⚠'));
  bus.on(EV.UI_CHOICE, p => showEndingChoice(p));
  bus.on(EV.GAME_OVER, p => {
    if (p.reason === 'noWake') showGameOver();
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && State.player) requestSave(State, 'auto', true);
  });
  window.addEventListener('error', e => console.error('[lanternwake]', e.message));
}

export function onKill(p) {
  const victim = State.entities.find(e => e.id === p.id);
  if (victim) {
    if (victim.isBoss) {
      checkLitCondition(State, 'boss_killed');
      const lt = State.longThread;
      if (lt && State.hollow && State.hollow.id === lt.hollowId && lt.state === 'the_one') resolveTheOne(State, 'fight');
    }
    dropLoot(victim);
  }
  onPlayerAction(State, { kind: 'kill', archetype: p.archetype, id: p.id });
  markDirty();
}

export function dropLoot(victim) {
  const region = regionForPlayer(State);
  const drops = rollDrop(State.master, victim, {
    tier: region ? region.tier : 0,
    depth: State.hollow ? State.hollow.depth : 0,
    extraReagent: State.player.mods.extraReagent || 0,
  });
  const list = floorItemsAt(State, victim.x, victim.y) || [];
  for (const d of drops) {
    if (d.coin) { State.player.coin += d.coin; continue; }
    list.push(d);
  }
  setFloorItems(State, victim.x, victim.y, list);
  if (list.length) logLine(`Something is left where ${victim.name} was.`, 'plain');
  refresh();
}

export function wireControls() {
  initInput({
    canvas: el('world'), pad: el('pad'), contextBtn: el('context'), tools: el('tools'),
    onMove: (dx, dy) => { interact(); act(State, () => tryMove(State, dx, dy)); },
    onContext: () => { interact(); act(State, () => doContext(State)); },
    onWait: () => { interact(); act(State, () => doWait(State)); },
    onRest: () => { interact(); act(State, () => doRestUntil(State)); },
    onPanel: name => {
      interact();
      if (name === 'close') { closePanel(); hideDialogue(); closeDialogue(State); el('mapscreen').hidden = true; refresh(); return; }
      if (name === 'map') { openMap(State); return; }
      openPanel(State, name);
    },
    onVerb: v => handleVerb(v),
    onTapTile: (fx, fy) => tapTile(fx, fy),
  });

  for (const b of document.querySelectorAll('[data-panel]')) {
    b.onclick = () => { interact(); const n = b.dataset.panel; if (n === 'map') openMap(State); else openPanel(State, n); };
  }
  el('waitbtn').onclick = () => { interact(); act(State, () => doWait(State)); };
  el('lanternbtn').onclick = () => { interact(); act(State, () => doDouse(State)); };
  el('log').onclick = () => openPanel(State, 'log');
}

export function interact() {
  startAudio();
  setEnabled(State.settings.audio);
  fastForward();
}

export function handleVerb(v) {
  if (v === 'wheel') {
    const verbs = ['Examine', 'Take', 'Search', 'Listen', 'Sit', 'Douse', 'Wait', 'Shove'];
    showVerbWheel(el('wheel'), verbs, label => {
      const verb = label.toLowerCase();
      if (verb === 'shove') { pickDirection(d => act(State, () => doShove(State, d[0], d[1]))); return; }
      act(State, () => doVerb(State, verb, contextVerb(State)));
    });
    return;
  }
  if (v.startsWith('usetool:')) { useTool(v.slice(8)); return; }
  if (v.startsWith('tool')) {
    const idx = parseInt(v.slice(4), 10) - 1;
    const owned = ['ember_jar', 'grapple_vine', 'bell', 'spade', 'green_flame', 'boat_whistle'].filter(k => State.player.caps.has(k));
    if (owned[idx]) useTool(owned[idx]);
    return;
  }
  act(State, () => doVerb(State, v, contextVerb(State)));
}

/** Tools: each has a gate and at least three other uses. */
export function useTool(key) {
  const p = State.player;
  if (!p.caps.has(key)) return;
  interact();
  const charges = p.toolCharges[key] ?? 0;
  if (charges <= 0) {
    // a tool at zero charges still works, at 5 HP. Never a soft-lock.
    p.hp = Math.max(1, p.hp - 5);
    logLine('It costs you something to make it work.', 'warn');
  } else p.toolCharges[key] = charges - 1;
  State.stats.tools++;

  act(State, () => {
    const c = contextVerb(State);
    switch (key) {
      case 'ember_jar': return doVerb(State, 'light', c) || useEmber(c);
      case 'bell': return doVerb(State, 'ring', c);
      case 'spade': return doVerb(State, 'dig', c);
      case 'green_flame': return toggleGreenFlame();
      case 'grapple_vine': return grapple();
      case 'boat_whistle': return whistle();
      default: return 100;
    }
  });
}

export function useEmber(c) {
  logLine('Heat, held in a jar. It wants something to work on.', 'plain');
  return 100;
}

export function toggleGreenFlame() {
  const p = State.player;
  if (!p.lanternLit) { logLine('Light the lantern first.', 'plain'); return 0; }
  p.greenFlame = !p.greenFlame;
  recomputePlayer(p);
  if (p.greenFlame) {
    logLine('The flame goes green. You can see what is thin here.', 'good');
    // marks: the manual answer to "where was that thing I could not open"
    if (State.marks.length < 12) {
      State.marks.push({ x: p.x, y: p.y });
      logLine('You mark this tile, and will remember it.', 'plain');
    }
  } else logLine('Back to ordinary light.', 'plain');
  return 100;
}

export function grapple() {
  const p = State.player;
  const dirs = DIRS8;
  for (const [dx, dy] of dirs) {
    for (let d = 2; d <= 5; d++) {
      const x = p.x + dx * d, y = p.y + dy * d;
      if (moveCost(State, x, y, p) === null) continue;
      let blocked = false;
      for (let k = 1; k < d; k++) {
        if (moveCost(State, p.x + dx * k, p.y + dy * k, p) !== null) { blocked = false; continue; }
        blocked = true;
      }
      if (!blocked) continue;
      p.x = x; p.y = y;
      logLine('The vine catches. You cross.', 'good');
      snapCamera();
      return 100;
    }
  }
  logLine('Nothing to hook, from here.', 'plain');
  return 0;
}

export function whistle() {
  logLine('A flat note over the water. A boat comes in, unhurried.', 'good');
  return 100;
}

export function pickDirection(cb) {
  toast('Pick a direction with the pad or an arrow key.', '');
  const once = e => {
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!dir) return;
    window.removeEventListener('keydown', once);
    cb(dir);
  };
  window.addEventListener('keydown', once);
}

/** Tap-to-move: A* then auto-walk, interrupted by anything interesting. */
export function tapTile(fx, fy) {
  const p = State.player;
  const canvas = el('world');
  const tilesX = canvas.width / (16 * view.zoom);
  const tilesY = canvas.height / (16 * view.zoom);
  const tx = Math.round(view.cx + (fx - 0.5) * tilesX);
  const ty = Math.round(view.cy + (fy - 0.5) * tilesY);
  if (Math.abs(tx - p.x) <= 1 && Math.abs(ty - p.y) <= 1) {
    interact();
    act(State, () => doContext(State, tx - p.x, ty - p.y));
    return;
  }
  const path = astar(p.x, p.y, tx, ty, {
    cost: (x, y) => {
      const c = moveCost(State, x, y, p);
      if (c === null) return null;
      if (State.mode === 'hollow' && !(State.visible && State.visible.has(x * 4096 + y))) {
        // you cannot plan through what you have not seen
        const explored = (State.hollow.floor.flags[y * State.hollow.floor.w + x] & 1);
        if (!explored) return null;
      }
      return 100 + c;
    },
    maxNodes: 2000,
  });
  if (!path || !path.length) { logLine('No way through that you can see.', 'plain'); return; }
  interact();
  walkPath(path);
}

let walkTimer = null;
export function walkPath(path) {
  if (walkTimer) clearInterval(walkTimer);
  let i = 0;
  const before = State.entities.filter(e => !e.isNpc && e.hp > 0).length;
  walkTimer = setInterval(() => {
    if (i >= path.length) { clearInterval(walkTimer); walkTimer = null; return; }
    const p = State.player;
    const [nx, ny] = path[i++];
    const hpBefore = p.hp;
    act(State, () => tryMove(State, Math.sign(nx - p.x), Math.sign(ny - p.y)));
    const visibleHostiles = State.entities.filter(e =>
      !e.isNpc && e.hp > 0 && e.hostile !== false && State.visible && State.visible.has(e.x * 4096 + e.y));
    if (p.hp < hpBefore || visibleHostiles.length > before || p.x !== nx || p.y !== ny) {
      clearInterval(walkTimer); walkTimer = null;
    }
  }, 90);
}


/** The ending is a choice, not a boss. Both continue into free play. */
export function showEndingChoice(p) {
  const host = el('panel');
  host.hidden = false;
  host.innerHTML = '';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-head"><h2>${p.question}</h2></div>`;
  const body = document.createElement('div');
  body.className = 'sheet-body';
  for (const [which, label, blurb] of [['remember', p.a, p.aCost], ['let_be', p.b, p.bCost]]) {
    const row = document.createElement('div');
    row.className = 'row quest';
    row.innerHTML = `<div class="qmain"><b>${label}</b><small>${blurb}</small></div>`;
    const b = document.createElement('button');
    b.textContent = 'Choose';
    b.onclick = () => { chooseEnding(State, which); closePanel(); openPanel(State, 'ledger'); };
    row.appendChild(b);
    body.appendChild(row);
  }
  sheet.appendChild(body);
  host.appendChild(sheet);
}

/** Only reachable on No Wake, where death really is the end of it. */
export function showGameOver() {
  const host = el('panel');
  host.hidden = false;
  host.innerHTML = '';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-head"><h2>That was the end of it</h2></div>
    <div class="sheet-body"><p>The world keeps your Ledger. You can walk it again with the same seed.</p></div>`;
  const b = document.createElement('button');
  b.className = 'primary';
  b.textContent = 'Back to the title';
  b.onclick = () => { location.reload(); };
  sheet.querySelector('.sheet-body').appendChild(b);
  host.appendChild(sheet);
}


let lastBiome = null;
/** Keep the weather, the ambience and the biome drone in step with the map. */
export function updateWeather() {
  if (!State.player || !State.W) return;
  const region = regionForPlayer(State);
  if (region) State.weather = weatherAt(region.id, State.tick);
  const biome = State.mode === 'hollow' ? 'hollow' : biomeAt(State.W, State.player.x, State.player.y);
  if (biome !== lastBiome) {
    lastBiome = biome;
    setAmbience(biome, region ? region.quiet : 0);
    if (State.mode !== 'hollow' && State.weather) logLine(State.weather.line, 'flavour');
  }
}
