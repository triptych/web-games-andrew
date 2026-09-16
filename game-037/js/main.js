// ============================================================
// main.js - boot, wiring, and the render loop (GDD §22)
// The loop runs only while something is animating. A turn-based game is idle
// most of the time; do not redraw sixty times a second at a still screen.
// ============================================================
import { bus } from './core/bus.js';
import { EV } from './data/events.js';
import { makeMasterSeed } from './core/seed.js';
import { DIRS8, dirIndex } from './core/coords.js';
import { astar } from './core/grid.js';
import { TICKS_PER_DAY } from './data/constants.js';
import { tileDef } from './data/tiles.js';
import { BIOMES } from './data/biomes.js';
import { createWorld } from './world/world.js';
import { streamAround, prewarm } from './world/chunks.js';
import { refreshNpcActors, spawnAmbient, rosterOf, whereIs } from './world/entities.js';
import { moveCost, groundAt } from './world/access.js';
import { buildIdentityMap } from './gen/item.js';
import { biomeAt, regionAt } from './gen/fields.js';
import { State, initState, logLine } from './game/state.js';
import { makePlayer, recomputePlayer, knackOptions } from './game/player.js';
import { act, tryMove, doContext, doVerb, doWait, doShove, doDouse, updateFOV, doRestUntil, contextVerb, placeName, regionForPlayer } from './game/actions.js';
import { runUntilPlayerInput } from './game/scheduler.js';
import { wake, wakeWarning, expirePacks } from './game/wake.js';
import { weatherAt, advanceTime } from './game/time.js';
import { checkLongThread, resolveTheOne, chooseEnding, canTalkDown } from './game/longthread.js';
import { refreshNeeds, questContext } from './game/quests.js';
import { buildQuest } from './gen/quest.js';
import { closeDialogue } from './game/dialogue.js';
import { checkLitCondition } from './game/hollowrun.js';
import { buildAtlas } from './render/atlas.js';
import { initRenderer, render, updateCamera, snapCamera, markDirty, view } from './render/renderer.js';
import { effects, push as pushEffect, tick as tickEffects, fastForward, addShake } from './render/effects.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, openPanel, closePanel, applySettings } from './ui/panels.js';
import { initDialogue, showDialogue, hideDialogue } from './ui/dialoguebox.js';
import { initMapScreen, openMap } from './ui/mapscreen.js';
import { initTitle, showTitle, hideTitle } from './ui/titlescreen.js';
import { initToast, toast } from './ui/toast.js';
import { wireEvents, wireControls, bindRuntime, showEndingChoice, showGameOver, updateWeather } from './ui/wiring.js';
import { requestSave, readSave, deserialize, restoreQuestProgress, checkVersion } from './world/save.js';
import { startAudio, sfx, setAmbience, setEnabled, audio } from './audio.js';

const el = id => document.getElementById(id);
let atlas = null, running = false, lastFrame = 0;

boot();

function boot() {
  bindRuntime(refresh, ensureLoop);
  initToast(el('toasts'));
  initTitle(el('title'));
  initPanels(el('panel'), refresh);
  initDialogue(el('dialogue'), refresh);
  initMapScreen(el('mapscreen'), refresh);
  initHud({
    hearts: el('hearts'), hp: el('hp'), oil: el('oil'), clock: el('clock'), coin: el('coin'),
    place: el('place'), statuses: el('statuses'), contextBtn: el('context'), tools: el('tools'),
    log: el('log'), minimap: el('minimap'),
  });
  wireEvents();
  showTitle({ onNew: startNewGame, onContinue: continueGame });
}

// ---------------------------------------------------------------------------
// starting
// ---------------------------------------------------------------------------

async function startNewGame(seedString, difficulty) {
  hideTitle();
  await withLoading('Growing a country…', async () => {
    const master = makeMasterSeed(seedString);
    const W = createWorld(master);
    initState(master, W, difficulty);
    State.idMap = buildIdentityMap(master);
    State.player = makePlayer(master, W.start);
    recomputePlayer(State.player);
    State.player.hp = State.player.maxHp;
    await finishBoot();
    logLine('You wake at a cold hearth with a lantern and not much oil.', 'flavour');
    const settle = W.settlements.get(W.startSettlementId);
    if (settle) {
      State.knowledge.places.add(settle.id);
      logLine(`${settle.name}. Somebody is up: there is smoke.`, 'flavour');
    }
    requestSave(State, 'auto', true);
  });
}

async function continueGame(header) {
  hideTitle();
  await withLoading('Finding your place…', async () => {
    const save = await readSave('auto');
    if (!save) { showTitle({ onNew: startNewGame, onContinue: continueGame }); return; }
    const status = checkVersion(save);
    if (status === 'migrate') {
      toast('That journey was made by an older build.', '⚠');
    }
    const master = makeMasterSeed(save.seed);
    const W = createWorld(master);
    initState(master, W, save.difficulty);
    State.idMap = buildIdentityMap(master);
    State.player = makePlayer(master, W.start);
    deserialize(State, save);
    recomputePlayer(State.player);
    await finishBoot();
    restoreQuestProgress(State);
    logLine('Back where you were.', 'plain');
  });
}

async function finishBoot() {
  if (!atlas) {
    const t0 = performance.now();
    atlas = buildAtlas(State.master);
    State.atlasMs = Math.round(performance.now() - t0);
  }
  initRenderer(el('world'), atlas);
  applySettings(State);
  effects.reducedMotion = !!State.settings.reducedMotion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  streamAround(State, State.player.x, State.player.y);
  refreshNpcActors(State);
  spawnAmbient(State);
  updateFOV(State);
  snapCamera();
  updateWeather();
  primeStartSettlement();
  el('game').hidden = false;
  wireControls();
  refresh();
  requestAnimationFrame(loop);
}

/** The opening ten minutes are arranged, not random: make sure work exists. */
function primeStartSettlement() {
  const known = new Set([State.W.startSettlementId]);
  // On a reload, every settlement the player has been to needs its quests back:
  // needs are saved, quests are derived from them.
  for (const id of State.knowledge.places) if (State.W.settlements.has(id)) known.add(id);
  for (const id of known) {
    if (!id) continue;
    for (const npc of rosterOf(State, id)) refreshNeeds(State, npc);
  }
  guaranteeFirstErrand();
}

/**
 * §4.7: within a minute of waking, somebody near the hearth has to want
 * something. If the roll did not produce that, plant one - a fetch, no combat.
 */
function guaranteeFirstErrand() {
  const settleId = State.W.startSettlementId;
  if (!settleId || State.tick > 400) return;
  const roster = rosterOf(State, settleId).filter(n => n.state === 'alive');
  const near = roster.filter(n => {
    const at = whereIs(State, n, State.tick);
    return at && Math.max(Math.abs(at.x - State.player.x), Math.abs(at.y - State.player.y)) <= 10;
  });
  const givers = new Set([...State.quests.values()]
    .filter(q => q.state !== 'complete' && q.state !== 'failed').map(q => q.giver));
  if (near.some(n => givers.has(n.id))) return;

  const npc = (near[0] || roster[0]);
  if (!npc) return;
  const ctx = questContext(State, settleId);
  if (!ctx) return;
  const need = {
    id: `${npc.id}#start`, npcId: npc.id, kind: 'supply', urgency: 0.6,
    beneficiary: npc.id, reason: 'It is a small thing and I would be glad of it.',
    blockedBy: null, expiresTick: null, epoch: 0,
    object: { item: 'nettle' }, count: 2,
    where: { settlement: settleId }, placeName: ctx.settlementName,
  };
  const q = buildQuest(State.W, need, npc, ctx);
  if (!q || State.quests.has(q.id)) return;
  q.settlementId = settleId;
  q.regionId = ctx.region.id;
  q.needKind = 'supply';
  State.quests.set(q.id, q);
  npc.needs = (npc.needs || []).concat(need);
}

function withLoading(text, fn) {
  const overlay = el('loading');
  overlay.hidden = false;
  overlay.querySelector('p').textContent = text;
  return new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(async () => {
      try { await fn(); } catch (e) { console.error(e); toast('Something went wrong loading.', '⚠'); }
      overlay.hidden = true;
      resolve();
    }, 30));
  });
}

// ---------------------------------------------------------------------------
// frame
// ---------------------------------------------------------------------------

function ensureLoop() { if (!running) { running = true; requestAnimationFrame(loop); } }

function loop(now) {
  const dt = now - (lastFrame || now);
  lastFrame = now;
  if (State.player) State.playtimeMs += dt;

  updateCamera(State);
  const animating = tickEffects(now);
  if (animating || view.dirty || Math.abs(view.cx - view.targetCx) > 0.01 || Math.abs(view.cy - view.targetCy) > 0.01) {
    render(State, now);
    if (State.settings.showDev) renderDev(now);
  }
  running = animating || view.dirty;
  if (running) requestAnimationFrame(loop);
  else requestAnimationFrame(idleCheck);
}

function idleCheck(now) {
  // a cheap heartbeat so the camera settles and the loop can restart
  updateCamera(State);
  if (view.dirty || effects.queue.length) { ensureLoop(); return; }
  requestAnimationFrame(idleCheck);
}

export function refresh() {
  if (!State.player) return;
  State.placeLabel = placeName(State, State.player.x, State.player.y);
  updateWeather();
  renderHud(State);
  markDirty();
  ensureLoop();
  requestSave(State, 'auto');
  if (State.travelPending) {
    const t = State.travelPending;
    State.travelPending = 0;
    advanceTime(t * 100);
    streamAround(State, State.player.x, State.player.y);
    refreshNpcActors(State);
    updateFOV(State);
    snapCamera();
    logLine('A long walk, and then a hearth.', 'plain');
    renderHud(State);
  }
}




// --- dev overlay ----------------------------------------------------------
let frameTimes = [];
function renderDev(now) {
  const dev = el('dev');
  if (!dev) return;
  dev.hidden = false;
  frameTimes.push(performance.now() - now);
  if (frameTimes.length > 60) frameTimes.shift();
  const p95 = [...frameTimes].sort((a, b) => a - b)[Math.floor(frameTimes.length * 0.95)] || 0;
  const region = regionForPlayer(State);
  dev.textContent = [
    `seed ${State.master.string}`,
    `tick ${State.tick} day ${Math.floor(State.tick / TICKS_PER_DAY)}`,
    `tile ${State.player.x},${State.player.y}`,
    `chunks ${State.world.chunks.size} actors ${State.entities.length}`,
    `region ${region ? region.name + ' t' + region.tier + ' q' + region.quiet.toFixed(2) : '-'}`,
    `atlas ${State.atlasMs}ms frame p95 ${p95.toFixed(1)}ms`,
  ].join(' · ');
}

// expose for the test harness
window.LW = { State, act, refresh, get atlas() { return atlas; } };
