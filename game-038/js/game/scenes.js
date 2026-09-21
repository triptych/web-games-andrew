// ============================================================
// game/scenes.js - the scene runner (GDD 2)
// A scene's *effects* (act advances, key items, flags) are applied here the
// moment it is requested, not when the UI finishes drawing it. The UI plays
// the lines; the story moves whether or not anybody is watching.
// ============================================================
import { bus } from '../core/bus.js';
import { SCENES, scene } from '../data/story.js';
import { state, setAct, addItem, setFlag, flag } from './state.js';
import { ELDER_LINEAGES } from '../data/lineages.js';
import { stageRank } from '../data/constants.js';

const queue = [];
let wired = false;

export const pending = () => queue.slice();
export const hasPending = () => queue.length > 0;

/**
 * Queue a scene and apply everything it changes about the world.
 *
 * The queue push comes FIRST and deliberately so: setting the flag and
 * applying the effects both emit, quests listen to those emissions, and a
 * quest accepted by that cascade can request a scene of its own. Queue this
 * one last and the cascade's scene jumps the line - which is how a new game
 * came to show "here is the dragon she left you" before the opening.
 */
export function requestScene(id, meta = {}) {
  const s = scene(id);
  if (!s) return null;
  if (state.flags[`scene_${id}`] && !meta.replay) return null;   // each scene once
  const entry = { scene: s, meta };
  queue.push(entry);
  setFlag(`scene_${id}`);
  applyEffects(s);
  bus.emit('scene:queued', { scene: s, meta });
  return s;
}

function applyEffects(s) {
  if (s.setAct) setAct(s.setAct);
  for (const it of s.give || []) addItem(it, 1);
  for (const f of s.flags || []) setFlag(f);
  if (s.ending) {
    state.ending = s.id;
    bus.emit('game:ended', { ending: s.id, title: s.title });
  }
}

/** The UI takes scenes off the queue as it gets to them. */
export function nextScene() {
  const entry = queue.shift() || null;
  if (entry) bus.emit('scene:started', entry);
  return entry;
}

export function finishScene(entry) {
  bus.emit('scene:finished', entry);
  if (!queue.length) bus.emit('scene:idle');
}

// ------------------------------------------------------------- endings ----
/** Which endings this save has earned. Checked by the final choice. */
export function endingAvailability() {
  const roster = state.roster.filter(d => d.stage !== 'egg');
  const held = new Set(roster.map(d => d.lineageId));
  const canRekindle = ELDER_LINEAGES.every(l =>
    roster.some(d => d.lineageId === l && stageRank(d.stage) >= stageRank('wyrm')));
  const canSuccession = roster.some(d =>
    (d.generation || 0) >= 3 && d.stage === 'elder' && d.bond >= 100);
  return { canRekindle, canSuccession, canUnbind: true, elderHeld: ELDER_LINEAGES.filter(l => held.has(l)) };
}

export function chooseEnding(choiceId) {
  const avail = endingAvailability();
  if (choiceId === 'rekindle' && !avail.canRekindle) return { ok: false, why: 'Not with the brood you have.' };
  if (choiceId === 'succession' && !avail.canSuccession) return { ok: false, why: 'There is no one among them ready to be asked.' };
  setFlag(`ending_${choiceId}`);
  requestScene(`ending_${choiceId}`);
  return { ok: true, ending: `ending_${choiceId}` };
}

/** Wire quest-driven scene requests once. */
export function wireScenes() {
  if (wired) return;
  wired = true;
  bus.on('scene:request', ({ id }) => requestScene(id));
}
