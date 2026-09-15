// ============================================================
// game/longthread.js - the world plot as a six-state machine (GDD §14.5)
// Entry conditions are checked on world:dayTick and on the events that matter.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { State, logLine } from './state.js';
import { grantXP } from './player.js';
import { findNpc } from './quests.js';
import { rosterOf } from '../world/entities.js';

export function litHollowCount(state) {
  let n = 0;
  for (const h of state.W.hollows.values()) if (h.lit) n++;
  return n;
}

export function threadsDone(state) {
  let n = 0;
  for (const t of state.W.threads.values()) if (t.state === 'done') n++;
  return n;
}

/** Advance the state machine if its entry conditions are met. */
export function checkLongThread(state) {
  const lt = state.longThread;
  if (!lt || lt.state === 'done') return;

  switch (lt.state) {
    case 'notice':
      if (litHollowCount(state) >= 2) {
        lt.state = 'ledger';
        const keeper = keeperNpc(state);
        logLine(keeper
          ? `${keeper.shortName} stops you on the way past. "You know what the keepers were for? It was a job. There was a rota."`
          : 'Somebody tells you what the lantern-keepers were for. It was a job. There was a rota.', 'flavour');
        learn(state, lt.facts[0]);
        bus.emit(EV.LONG_STATE, { state: lt.state });
      }
      break;

    case 'ledger':
      if (lt.fragmentsFound.length >= 3) {
        lt.state = 'wrong_year';
        learn(state, lt.facts[1]);
        learn(state, lt.facts[3]);
        logLine(`Three pages together say the same thing. ${lt.forgottenName} chose to be forgotten — ${lt.forgottenWhy}.`, 'flavour');
        state.ledger.push({ tick: state.tick, text: `Worked out what ${lt.forgottenName} did, and why.` });
        bus.emit(EV.LONG_STATE, { state: lt.state });
      }
      break;

    case 'wrong_year': {
      lt.state = 'walk';
      const h = state.W.hollows.get(lt.hollowId);
      if (h) {
        h.discovered = true;
        state.knowledge.places.add(h.id);
        logLine(`${lt.hollowName} is open. You have walked past its mouth a dozen times.`, 'flavour');
      }
      bus.emit(EV.LONG_STATE, { state: lt.state });
      break;
    }

    case 'walk': {
      const h = state.W.hollows.get(lt.hollowId);
      if (h && (h.deepest || 0) >= h.depth) {
        lt.state = 'the_one';
        logLine(`Somebody is down here who has been down here a long time.`, 'warn');
        bus.emit(EV.LONG_STATE, { state: lt.state });
      }
      break;
    }

    case 'the_one':
      // resolved by killing or by talking; see resolveTheOne
      break;

    case 'choice':
      break;
  }
}

function keeperNpc(state) {
  const region = state.W.regions.get(state.W.startRegionId);
  if (!region || !region.settlements.length) return null;
  for (const sid of region.settlements) {
    const roster = rosterOf(state, sid);
    const elder = roster.find(n => n.ageBand === 'elder' && n.state === 'alive');
    if (elder) return elder;
  }
  return null;
}

export function learn(state, fact) {
  if (!fact) return;
  const lt = state.longThread;
  if (lt && !lt.factsKnown.includes(fact)) lt.factsKnown.push(fact);
  state.knowledge.facts.add(fact);
}

/** Four specific facts open the dialogue route. Combat always works too. */
export function canTalkDown(state) {
  const lt = state.longThread;
  return !!lt && lt.factsKnown.length >= 4;
}

export function resolveTheOne(state, how) {
  const lt = state.longThread;
  if (!lt || lt.state === 'choice' || lt.state === 'done') return;
  lt.state = 'choice';
  lt.resolvedBy = how;
  logLine(how === 'talk'
    ? 'They listen. It takes a long time, and then they stop.'
    : 'They kneel, and the kneeling takes a long time.', 'flavour');
  grantXP(state.player, 600);
  state.ledger.push({ tick: state.tick, text: `Met ${lt.bossName} at the bottom of ${lt.hollowName}, and ${how === 'talk' ? 'talked' : 'fought'}.` });
  bus.emit(EV.LONG_STATE, { state: lt.state });
  bus.emit(EV.UI_CHOICE, {
    kind: 'ending',
    question: 'Remember, or let be?',
    a: 'Remember them', aCost: lt.endings.remember,
    b: 'Let them be', bCost: lt.endings.let_be,
  });
}

/** Both endings continue into free play. Neither is the good one. */
export function chooseEnding(state, which) {
  const lt = state.longThread;
  if (!lt || lt.chosen) return;
  lt.chosen = which;
  lt.state = 'done';
  if (which === 'remember') {
    for (const r of state.W.regions.values()) {
      r.quiet = Math.max(0.02, r.quiet - 0.5);
      r.quietFloor = 0.02;
    }
    logLine(lt.endings.remember, 'flavour');
    state.ledger.push({ tick: state.tick, text: `Chose to remember ${lt.forgottenName}. The Quiet lifted.` });
  } else {
    for (const r of state.W.regions.values()) r.quietFloor = r.quiet;
    logLine(lt.endings.let_be, 'flavour');
    state.ledger.push({ tick: state.tick, text: `Chose to let ${lt.forgottenName} be. The Quiet stopped where it was.` });
  }
  state.flags.add('ending:' + which);
  bus.emit(EV.LONG_STATE, { state: 'done', ending: which });
  bus.emit(EV.GAME_OVER, { reason: 'ending', ending: which, free: true });
}
