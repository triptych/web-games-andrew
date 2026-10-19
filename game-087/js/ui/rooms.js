// Room id → view. A view renders into the room element and may return a cleanup function.

import { hallView } from './hall.js';
import { scriptoriumView } from './scriptorium.js';
import { boardView } from './board.js';
import { facesView } from './faces.js';
import { groundsView } from './grounds.js';
import { loomView } from './loom.js';
import { loftView } from './loft.js';
import { wellView } from './well.js';
import { libraryView } from './library.js';
import { binderyView } from './bindery.js';
import { sheetView } from './sheet.js';

export const ROOM_VIEWS = {
    hall: hallView,
    scriptorium: scriptoriumView,
    board: boardView,
    faces: facesView,
    grounds: groundsView,
    loom: loomView,
    loft: loftView,
    well: wellView,
    library: libraryView,
    bindery: binderyView,
    sheet: sheetView,
};
