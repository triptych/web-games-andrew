// Tile types. A map stores one id per cell; the sim asks these definitions whether a cell can be
// walked on, and the view asks them how to draw it.
//
//   solid   blocks movement
//   lock    the grimoire that deals with it. mode 'clear': face it and press Action to open the
//           whole connected patch (it becomes `after`). mode 'pass': walkable while you hold the
//           book (deep water to swim, chasms to float over, mouse doors to squeeze through).
//   prop    drawn as an object standing on `ground` (trees, shelves) rather than as flat ground

export const T = {};
export const TILES = [];

function def(name, o = {}) {
    const id = TILES.length;
    T[name] = id;
    TILES.push({ id, name, solid: false, ...o });
    return id;
}

// ------------------------------------------------------------ ground
def('void', { solid: true });
def('grass');
def('flowers');
def('path');
def('sand');
def('snow');
def('moor');
def('farm');
def('cobble');
def('wood');            // plank floor
def('carpet');
def('cave');            // cave floor
def('tile');            // castle / abbey flagstones
def('ash');             // burnt ground, where brambles were
def('ice');             // a frozen stream
def('bridge');
def('rubble');          // where a boulder was
def('stone');           // bare rock plateau
def('moss');
def('rug');
def('door');            // a warp: building doors, cave mouths, stairs
def('stairs');
def('hall');            // dungeon floor (styled per dungeon)
def('mark');            // a rune circle on the floor (decor)
def('vineup');          // a grown vine: walkable cliff
def('ghostfloor');      // where a ghost gate was
def('opendoor');        // an opened locked door / rune seal
def('starfloor');       // an opened star seal

// ------------------------------------------------------------ solid scenery
const S = (name, o) => def(name, { solid: true, prop: true, ...o });
S('tree');
S('pine');
S('snowpine');
S('deadtree');
S('palm');
S('bush');
S('rock');
S('cliff', { prop: false });
S('wall', { prop: false });       // interior wall (style by map)
S('stonewall', { prop: false });  // castle and ruin walls
S('hedge');
S('fence');
S('water', { prop: false, swim: true });      // ponds, lakes, sea (swim with the Tidal Hymnal)
S('rapids', { prop: false });     // never passable
S('reef', { prop: false });       // rocks in water at zone borders
S('shelf');                       // bookshelf
S('table');
S('counter');
S('bed');
S('statue');
S('well');
S('lamp');
S('crate');
S('barrel');
S('sign');
S('chest');
S('lectern');
S('hearth');
S('pillar');
S('pit', { prop: false });
S('bld', { prop: false });        // under a building's sprite
S('crop');
S('clutter');                     // heaps of loose pages in the unrestored library
S('telescope');
S('pedestal');
S('stump');
S('snowman');
S('anvil');
S('flowerbox');
S('mushroom');
S('kiln');

// ------------------------------------------------------------ locks (one per grimoire)
const L = (name, lock, mode, after, o = {}) => def(name, { solid: mode === 'clear', lock, mode, after: after == null ? null : T[after], ...o });
L('fog', 'gust', 'clear', 'moor');
L('thorn', 'ember', 'clear', 'ash');
L('boulder', 'stone', 'clear', 'rubble', { prop: true });
L('stream', 'frost', 'clear', 'ice');
L('tiny', 'small', 'pass', null);       // a mouse door in a hedge or wall
L('sprout', 'verdant', 'clear', 'vineup');
L('deep', 'tide', 'pass', null, { swim: true });
L('ghost', 'echo', 'clear', 'ghostfloor');
L('rune', 'key', 'clear', 'opendoor');
L('chasm', 'feather', 'pass', null);
L('starseal', 'stars', 'clear', 'starfloor');
L('dark', 'lumen', 'pass', null);       // a pitch-black passage
def('locked', { solid: true, keyDoor: true, after: T.opendoor });   // needs a dungeon key

// Water tiles: `water` (ponds, lakes, sea) and `deep` are both swimmable with the Tidal Hymnal.
TILES[T.water].lock = 'tide';
TILES[T.water].mode = 'pass';

export const isGround = (id) => !TILES[id].solid && !TILES[id].lock;
