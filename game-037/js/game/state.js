// ============================================================
// game/state.js - the one mutable state object (GDD §22.3)
// Exactly one instance. Never cloned. Saving serializes a projection.
// ============================================================
import { RNG, deriveWords } from '../core/rand.js';
import { WORLD_GEN_VERSION, DOMAINS, LOG_CAP, START, DIFFICULTY, START_TICK } from '../data/constants.js';

export const State = {
  master: null,
  W: null,                       // the world header (derived, never saved)
  genVersion: WORLD_GEN_VERSION,
  difficulty: 'keeper',
  tick: 0, energyCarry: 0, playtimeMs: 0, wakeCount: 0,
  mode: 'title',                 // title | overworld | hollow | dialogue | menu | dead
  player: null,
  world: {
    chunks: new Map(),
    npcState: new Map(),         // npcId -> mutable bits
    rosters: new Map(),          // settlementId -> [npc records] (derived + patched)
    spawned: new Map(),          // chunkKey -> [monsters]
  },
  hollow: null,                  // { id, depth, descent, floor, floors: Map }
  quests: new Map(),
  knowledge: { identified: new Set(), places: new Set(), facts: new Set(), tonics: new Set(), trinkets: new Set() },
  deltas: { tiles: {}, props: {}, removed: [], placed: [], packs: [], snapshots: {} },
  log: [],
  ledger: [],
  rngStreams: { combat: null, cosmetic: null },
  idMap: null,
  entities: [],                  // live actors on the current map
  weatherCache: new Map(),
  marks: [],                     // Green Flame "remember this tile"
  longThread: null,
  settings: { handedness: 'right', textSize: 1, audio: true, haptics: false, reducedMotion: false, showDev: false },
  stats: { kills: 0, quests: 0, forage: 0, stealth: 0, tools: 0, explore: 0, social: 0, quiet: 0 },
  pendingLevelChoice: null,
  stash: [],
  flags: new Set(),
};

/** Reset and wire the runtime RNG streams. */
export function initState(master, W, difficulty = 'keeper') {
  State.master = master;
  State.W = W;
  State.genVersion = WORLD_GEN_VERSION;
  State.difficulty = DIFFICULTY[difficulty] ? difficulty : 'keeper';
  State.tick = START_TICK; State.energyCarry = 0; State.wakeCount = 0; State.playtimeMs = 0;
  State.mode = 'overworld';
  State.world.chunks = new Map();
  State.world.npcState = new Map();
  State.world.rosters = new Map();
  State.world.spawned = new Map();
  State.hollow = null;
  State.quests = new Map();
  State.knowledge = { identified: new Set(), places: new Set(), facts: new Set(), tonics: new Set(), trinkets: new Set() };
  State.deltas = { tiles: {}, props: {}, removed: [], placed: [], packs: [], snapshots: {} };
  State.log = [];
  State.ledger = [];
  State.entities = [];
  State.marks = [];
  State.stash = [];
  State.flags = new Set();
  State.stats = { kills: 0, quests: 0, forage: 0, stealth: 0, tools: 0, explore: 0, social: 0, quiet: 0 };
  State.pendingLevelChoice = null;
  State.longThread = W.longThread ? JSON.parse(JSON.stringify(W.longThread)) : null;
  State.rngStreams.combat = new RNG(...deriveWords(master, DOMAINS.RT_COMBAT));
  State.rngStreams.cosmetic = new RNG(...deriveWords(master, DOMAINS.RT_COSMETIC));
  return State;
}

export const difficultyMods = () => DIFFICULTY[State.difficulty] || DIFFICULTY.keeper;

/** One line in the log. Silence is a bug; five effects at once is also a bug. */
export function logLine(text, tone = 'plain') {
  if (!text) return;
  const last = State.log[State.log.length - 1];
  if (last && last.text === text && last.tick === State.tick) { last.count = (last.count || 1) + 1; return; }
  State.log.push({ text, tone, tick: State.tick });
  if (State.log.length > LOG_CAP) State.log.shift();
}

export { START };
