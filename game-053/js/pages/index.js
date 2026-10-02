// Page registry: id -> page function(g, arg).
import { fightPage } from './fight.js';
import { forest, healer, wyrm, dkwin } from './forest.js';
import { eventPage } from './events.js';
import { village } from './village.js';
import { training, mastersList } from './training.js';
import { weapons, armor, bank } from './shops.js';
import { inn, bar, flirt, bard, room, bounty } from './inn.js';
import { stables, gypsy, seance, lethe, gardens, stone } from './places.js';
import { shades, graveyard, mausoleum } from './shades.js';
import { news, hof, list, lodge, mail } from './info.js';
import { fields, pvp } from './pvp.js';
import { guilds, newday, prefs, help } from './misc.js';

export const PAGES = {
    village, forest, fight: fightPage, event: eventPage, healer, wyrm, dkwin,
    training, masters: mastersList, weapons, armor, bank,
    inn, bar, flirt, bard, room, bounty,
    stables, gypsy, seance, lethe, gardens, stone,
    shades, graveyard, mausoleum,
    news, hof, list, lodge, mail,
    fields, pvp, guilds, newday, prefs, help,
};
