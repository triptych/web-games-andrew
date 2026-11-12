// Starbase Spooky — the rooms of Starbase Nine. Each room is one painted backdrop (fal, 640x360 game pixels) with
// hotspots placed by eye on the finished art: x, y, w, h in game pixels, `walk` the x Kit walks to before acting.
// `say` is the line Orby says when you look at something that has no job attached. Pure data.

export const W = 640;
export const H = 360;

export const ROOMS = {
    deck: {
        name: 'Command Deck',
        floor: 322,
        entry: 600,
        art: 'the command deck of a cozy retro-future space station: a huge curved panoramic window in the center showing twinkling stars and the blue planet Earth, a big padded captain\'s chair in front of the window, a chunky comms console with a round green video screen and buttons on the left, a glowing station map screen on the right wall, a small charging pad for a helper robot, warm lights, white and orange panels',
        spots: [
            { id: 'comms', name: 'Comms console', x: 20, y: 150, w: 130, h: 150, walk: 150 },
            { id: 'window', name: 'Big window', x: 200, y: 40, w: 250, h: 150, walk: 320, say: 'orby.window' },
            { id: 'chair', name: 'Captain\'s chair', x: 255, y: 190, w: 120, h: 120, walk: 330, say: 'orby.chair' },
            { id: 'mapscreen', name: 'Station map', x: 480, y: 90, w: 110, h: 110, walk: 530, map: true },
        ],
    },
    dock: {
        name: 'Docking Bay',
        floor: 322,
        entry: 40,
        art: 'the docking bay of a cozy retro-future space station: a huge round airlock door with yellow and black hazard stripes on the right wall, a big round porthole window in the middle of the back wall showing a colourful little alien flying saucer parked outside among the stars, a stack of cargo crates on the left, a landing light strip on the floor, an empty open floor area in the center',
        spots: [
            { id: 'crates', name: 'Cargo crates', x: 10, y: 170, w: 130, h: 140, walk: 140, say: 'orby.crates' },
            { id: 'porthole', name: 'Porthole', x: 220, y: 60, w: 170, h: 150, walk: 300, say: 'orby.porthole' },
            { id: 'airlock', name: 'Airlock', x: 500, y: 60, w: 140, h: 250, walk: 470, say: 'orby.airlock' },
            { id: 'visitor', name: 'Visitor', x: 330, y: 190, w: 110, h: 130, walk: 300, visitor: true },
        ],
    },
    garden: {
        name: 'Star Garden',
        floor: 322,
        entry: 40,
        art: 'the hydroponic greenhouse garden of a cozy retro-future space station: rows of glowing colourful alien plants and flowers in white planters, a giant round silver-green moon melon in a planter in the center, big hanging grow-light lamps from the ceiling, an electrical control panel with a little door and colourful wires on the right wall, stars visible through a glass ceiling, a watering can on the floor',
        spots: [
            { id: 'plants', name: 'Space plants', x: 20, y: 150, w: 170, h: 150, walk: 160, say: 'orby.plants' },
            { id: 'melon', name: 'Moon melon', x: 240, y: 200, w: 130, h: 110, walk: 300, say: 'orby.melon' },
            { id: 'panel', name: 'Light panel', x: 520, y: 120, w: 100, h: 130, walk: 520, fix: 'garden' },
            { id: 'goo', name: 'Something glowing', x: 400, y: 280, w: 60, h: 40, walk: 420, clue: 'goo' },
        ],
    },
    galley: {
        name: 'Galley',
        floor: 322,
        entry: 600,
        art: 'the galley kitchen of a cozy retro-future space station: a big chunky retro food machine with a round screen, colourful buttons and a snack slot on the left side, a round table with three stools in the center, a counter on the right with a cookie jar shaped like a little rocket ship, a rounded fridge, pots and space-food packets on shelves, cheerful lights',
        spots: [
            { id: 'snacker', name: 'Snack-O-Tron', x: 20, y: 110, w: 140, h: 200, walk: 160, fix: 'galley' },
            { id: 'table', name: 'Table', x: 220, y: 210, w: 170, h: 100, walk: 300, say: 'orby.table' },
            { id: 'jar', name: 'Cookie jar', x: 440, y: 140, w: 70, h: 80, walk: 460, clue: 'crumbs' },
            { id: 'fridge', name: 'Fridge', x: 530, y: 90, w: 100, h: 220, walk: 520, say: 'orby.fridge' },
        ],
    },
    engine: {
        name: 'Engine Room',
        floor: 322,
        entry: 40,
        art: 'the engine room of a cozy retro-future space station: a huge glowing blue reactor core cylinder in the center with pipes and rings around it, a fuse box with four big round coloured lights (red, blue, yellow, green) on the left wall, copper pipes and valves and gauges, a thick bundle of power cables running along the floor on the right, warm orange and cool blue light',
        spots: [
            { id: 'fuses', name: 'Fuse box', x: 20, y: 110, w: 130, h: 150, walk: 160, fix: 'engine' },
            { id: 'core', name: 'Reactor core', x: 240, y: 40, w: 160, h: 270, walk: 320, say: 'orby.core' },
            { id: 'cables', name: 'Power cables', x: 450, y: 260, w: 170, h: 60, walk: 500, clue: 'wire' },
            { id: 'pipes', name: 'Pipes', x: 470, y: 60, w: 150, h: 180, walk: 520, say: 'orby.pipes' },
        ],
    },
    observatory: {
        name: 'Observatory',
        floor: 322,
        entry: 600,
        art: 'the observatory of a cozy retro-future space station: a huge white and brass telescope on a round platform in the center pointing up through an open glass dome full of stars and a colourful nebula, a desk with a big rolled star chart and a lamp on the left, a hanging mobile of model planets on the right, a purple and navy colour scheme',
        spots: [
            { id: 'chart', name: 'Star chart', x: 20, y: 170, w: 150, h: 130, walk: 170, clue: 'chart' },
            { id: 'scope', name: 'Telescope', x: 230, y: 60, w: 180, h: 250, walk: 320, fix: 'observatory' },
            { id: 'mobile', name: 'Planet mobile', x: 470, y: 40, w: 150, h: 160, walk: 520, say: 'orby.mobile' },
        ],
    },
    quarters: {
        name: 'Crew Quarters',
        floor: 322,
        entry: 600,
        art: 'a cozy kid\'s bedroom in a retro-future space station: a bunk bed with a blue star-pattern blanket on the left, a round porthole window with stars, a poster of the solar system planets on the back wall, a bookshelf with a big thick book on it, a toy box full of toy rockets, and a small square air vent grate low on the right wall near the floor, a warm night-light glow',
        spots: [
            { id: 'bed', name: 'Your bunk', x: 10, y: 130, w: 170, h: 180, walk: 170, bed: true },
            { id: 'poster', name: 'Planet poster', x: 220, y: 60, w: 120, h: 100, walk: 280, say: 'orby.poster' },
            { id: 'book', name: 'Space Book', x: 360, y: 120, w: 90, h: 90, walk: 400, book: true },
            { id: 'toys', name: 'Toy box', x: 360, y: 230, w: 100, h: 80, walk: 400, say: 'orby.toys' },
            { id: 'vent', name: 'Air vent', x: 540, y: 230, w: 80, h: 70, walk: 520, vent: true },
            { id: 'prints', name: 'Glowing tracks', x: 450, y: 296, w: 100, h: 26, walk: 480, clue: 'prints' },
        ],
    },
    vents: {
        name: 'Air Vents',
        floor: 322,
        entry: 60,
        art: 'inside a cramped round metal air duct tunnel of a space station, dim and a little spooky with soft blue glow coming from the far end, rivets and dust, and on the right a cozy little nest made of stolen socks, blankets and cookie crumbs glowing softly',
        hidden: true,
        spots: [
            { id: 'nest', name: 'Cozy nest', x: 400, y: 200, w: 200, h: 120, walk: 380, nest: true },
        ],
    },
};

/** The rooms on the station map, in the order the map lists them. The vents are reached through Crew Quarters. */
export const MAP_ROOMS = ['deck', 'dock', 'garden', 'galley', 'engine', 'observatory', 'quarters'];

/** Backdrops that aren't rooms. */
export const SCENES = {
    title: 'a cheerful little round space station floating in space, built from white and orange modules with a glass greenhouse dome, an observatory dome, round windows glowing warm yellow, solar panel wings and a docking arm, with the blue Earth and the grey Moon behind it, stars and a colourful nebula, a tiny glowing ghost peeking out of one window, plenty of empty starry sky across the top third for a title',
    station: 'a cute little round space station seen from the side against the stars, built from seven clearly separate modules joined by tubes around a central hub: a command module with a big window at the top, a docking module with a round airlock on the right, a glass greenhouse dome on the upper left, a kitchen module on the lower left, an engine module with glowing blue thrusters at the bottom, an observatory dome on the upper right and a bedroom module with little round windows on the lower right, the blue Earth far below',
};
