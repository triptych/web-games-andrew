// Assemble the Game from its systems.
import { Game } from './game.js';
import { ActionMethods } from './actions.js';
import { FarmMethods } from './farm.js';
import { VillageMethods } from './village.js';
import { BoardMethods } from './board.js';
import { CraftMethods } from './craft.js';
import { DayMethods } from './days.js';
import { CombatMethods } from './combat.js';
import { EntityMethods } from './entities.js';
import { DungeonMethods } from './dungeon.js';
import { StoryMethods } from './story.js';

Object.assign(Game.prototype, ActionMethods, FarmMethods, VillageMethods, BoardMethods, CraftMethods, DayMethods, CombatMethods, EntityMethods, DungeonMethods, StoryMethods);

export { Game };
