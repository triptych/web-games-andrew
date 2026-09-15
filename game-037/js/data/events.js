// ============================================================
// data/events.js - every event type (GDD §35). Frozen.
// Anything emitted must appear here.
// ============================================================

export const EV = Object.freeze({
  INTENT_MOVE: 'intent:move', INTENT_CONTEXT: 'intent:context', INTENT_TOOL: 'intent:tool',
  INTENT_ITEM: 'intent:item', INTENT_WAIT: 'intent:wait', INTENT_PANEL: 'intent:panel',
  INTENT_VERB: 'intent:verb', INTENT_PATH: 'intent:path',

  ACTION_REQUESTED: 'action:requested', ACTION_ACCEPTED: 'action:accepted',
  ACTION_REJECTED: 'action:rejected', ACTION_RESOLVED: 'action:resolved',

  ACTOR_SPAWNED: 'actor:spawned', ACTOR_MOVED: 'actor:moved', ACTOR_DAMAGED: 'actor:damaged',
  ACTOR_HEALED: 'actor:healed', ACTOR_STATUS: 'actor:status', ACTOR_DIED: 'actor:died',
  ACTOR_AWARENESS: 'actor:awareness',

  PLAYER_LEVELED: 'player:leveled', PLAYER_WOKE: 'player:woke',
  PLAYER_CAPABILITY: 'player:capability', PLAYER_VIGOR: 'player:vigor',

  WORLD_TICK: 'world:tick', WORLD_DAYTICK: 'world:dayTick', WORLD_CHUNKLOADED: 'world:chunkLoaded',
  WORLD_WEATHER: 'world:weather', WORLD_QUIET: 'world:quiet', WORLD_READY: 'world:ready',

  HOLLOW_ENTERED: 'hollow:entered', HOLLOW_FLOORGEN: 'hollow:floorGenerated',
  HOLLOW_LIT: 'hollow:lit', HOLLOW_LEFT: 'hollow:left',

  QUEST_OFFERED: 'quest:offered', QUEST_ACCEPTED: 'quest:accepted', QUEST_BEAT: 'quest:beat',
  QUEST_COMPLETED: 'quest:completed', QUEST_FAILED: 'quest:failed',

  NPC_MET: 'npc:met', NPC_DISPOSITION: 'npc:disposition', NPC_GIFTED: 'npc:gifted',
  NPC_DEPARTED: 'npc:departed',

  ITEM_ACQUIRED: 'item:acquired', ITEM_DROPPED: 'item:dropped', ITEM_IDENTIFIED: 'item:identified',
  ITEM_EQUIPPED: 'item:equipped', ITEM_BROKE: 'item:broke',

  UI_LOG: 'ui:log', UI_TOAST: 'ui:toast', UI_FLOAT: 'ui:float', UI_SHAKE: 'ui:shake',
  UI_PANEL: 'ui:panel', UI_DIALOGUE: 'ui:dialogue', UI_REFRESH: 'ui:refresh',
  UI_DIRTY: 'ui:dirty', UI_CHOICE: 'ui:choice',

  SAVE_REQUESTED: 'save:requested', SAVE_WRITTEN: 'save:written', SAVE_LOADED: 'save:loaded',
  SAVE_ERROR: 'save:error',

  LONG_STATE: 'long:state', GAME_OVER: 'game:over',
});

export const EVENT_TYPES = Object.freeze(new Set(Object.values(EV)));
