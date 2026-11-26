// Glimmerglade — tuning and tables. Shared by the sim, the view and the tests. Pure data.

export const VERSION = '1.1.1';
export const SAVE_KEY = 'glimmerglade.v1';

export const STEP = 1 / 60;               // the sim only keeps a clock; every rule is a command (act)
export const MAX_FRAME = 0.05;

export const CAP = 4;                     // a blossom blooms when it holds four wisps of one colour
export const CUP_CAP = 2;                 // an acorn cup holds two and never blooms
export const LEVELS_PER_CHAPTER = 10;
export const HINTS_PER_LEVEL = 3;
export const SOLVER_BUDGET = 60000;       // states the solver may visit before it gives up

// The nine wisps, in the order they join the game. Each one is the heart-light of a creature, and a glyph
// is drawn on it too so no colour has to be told apart by hue alone.
export const WISPS = [
    { id: 'rose',   name: 'Rose',   hex: '#ff7eb6', glow: '#ffc2dc', glyph: 'heart',   creature: 'Petal Fox',    blurb: 'A fox kit with a tail of rose petals. It sneezes pollen when it laughs.' },
    { id: 'gold',   name: 'Gold',   hex: '#ffc533', glow: '#ffe7a3', glyph: 'sun',     creature: 'Amberwing',    blurb: 'A baby dragon no bigger than a plum. It hums like a bee and naps in sunbeams.' },
    { id: 'mint',   name: 'Mint',   hex: '#4fdc9a', glow: '#b6f5d4', glyph: 'leaf',    creature: 'Dewdrop Frog', blurb: 'Wears a lily-pad hat and keeps one perfect dewdrop on it at all times.' },
    { id: 'sky',    name: 'Sky',    hex: '#5fb8ff', glow: '#bfe3ff', glyph: 'cloud',   creature: 'Cloud Hare',   blurb: 'Its fur is made of morning clouds. On windy days it floats a little.' },
    { id: 'lilac',  name: 'Lilac',  hex: '#b48cff', glow: '#e0cfff', glyph: 'moon',    creature: 'Moonmoth',     blurb: 'Carries the crescent moon on its wings and dusts the meadow with sleep.' },
    { id: 'coral',  name: 'Coral',  hex: '#ff8a5c', glow: '#ffcdb6', glyph: 'flame',   creature: 'Ember Newt',   blurb: 'The little flame on its tail is warm, never hot. Perfect for toasting acorns.' },
    { id: 'teal',   name: 'Teal',   hex: '#24c6c8', glow: '#a8f0ee', glyph: 'wave',    creature: 'Ripple Otter', blurb: 'Collects smooth pebbles from the Moonpond and gives the shiniest ones away.' },
    { id: 'pearl',  name: 'Pearl',  hex: '#f3ecff', glow: '#ffffff', glyph: 'star',    creature: 'Starfoal',     blurb: 'A unicorn foal with a horn shaped like a star. Where it steps, clover grows.' },
    { id: 'indigo', name: 'Indigo', hex: '#5a64e8', glow: '#b9bfff', glyph: 'diamond', creature: 'Hush Owlet',   blurb: 'Speckled with tiny stars. It only ever whispers, and it knows every secret.' },
];

// Five chapters of ten levels. `teach` names the new idea a chapter brings; `intro` is Grandmother Willow's
// story line at its start (the voice clip is vo-willow-<n>).
export const CHAPTERS = [
    { id: 'meadow',   name: 'Dawnpetal Meadow', teach: null,
      intro: "The Tumble Wind blew through the glade last night, little one, and every wisp landed in the wrong blossom. Each flower wants four wisps of its own colour. Will you help them home?" },
    { id: 'hollow',   name: 'Mushroom Hollow',  teach: 'mist',
      intro: "Down in Mushroom Hollow the morning mist has settled deep in the blossoms. Some wisps are hiding under it. Clear the ones above, and the mist will lift." },
    { id: 'moonpond', name: 'Moonpond',         teach: 'bramble',
      intro: "Brambles have wrapped some of the Moonpond lilies. They'll loosen once enough flowers bloom nearby. Count the petals on the bramble, dear." },
    { id: 'grotto',   name: 'Crystal Grotto',   teach: 'cup',
      intro: "The grotto gnomes left their acorn cups lying about. A cup can hold two wisps while you think, but it can never bloom." },
    { id: 'canopy',   name: 'Starfall Canopy',  teach: null,
      intro: "Last of all, the Starfall Canopy, at the very top of my branches. Everything you've learned, little light. The whole glade is waiting." },
];

export const ENDING = [
    { who: 'willow', text: "Every wisp is home, and every creature is awake. The glade has never shone so bright. Thank you, Lumi.", vo: 'willow-end' },
    { who: 'lumi', text: "We did it! Goodnight, glade... see you at dawn!", vo: 'lumi-end' },
];

export const TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;
