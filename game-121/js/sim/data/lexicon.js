// The language of the universe: themes, the symbols that show them in the crystal ball, the colours that
// give them a tone, the omens in the room, and the twenty-two cards. Pure data.
//
// A reading's fate is three beats, { theme, tone }. The ball shows each beat as a symbol (its theme) in a
// colour (its tone). A card answers a beat when the beat's theme is one of the card's two themes and the card
// lies the right way up: upright for a boon, reversed for a bane.

export const THEMES = {
    love:      { name: 'Love',      blurb: 'The heart and what it wants.' },
    loss:      { name: 'Loss',      blurb: 'Endings, grief and what is left behind.' },
    wealth:    { name: 'Wealth',    blurb: 'Coin, luck and the price of things.' },
    betrayal:  { name: 'Betrayal',  blurb: 'A false friend, a broken trust.' },
    journey:   { name: 'Journey',   blurb: 'Roads, departures and homecomings.' },
    health:    { name: 'Health',    blurb: 'The body, its mending and its fraying.' },
    family:    { name: 'Family',    blurb: 'Blood, hearth and home.' },
    ambition:  { name: 'Ambition',  blurb: 'The climb, the crown, the wanting more.' },
    secret:    { name: 'Secrets',   blurb: 'What is hidden, and who hides it.' },
    danger:    { name: 'Danger',    blurb: 'A storm, a blade, a thing to flee.' },
    change:    { name: 'Change',    blurb: 'The wheel turning, for good or ill.' },
    hope:      { name: 'Hope',      blurb: 'A light that will not go out.' },
};
export const THEME_IDS = Object.keys(THEMES);

// Two symbols per theme. `glyph` is the drawing id in view/art.js (same as the symbol id).
export const SYMBOLS = {
    heart:     { name: 'Heart',        theme: 'love' },
    rings:     { name: 'Twin Rings',   theme: 'love' },
    tear:      { name: 'Teardrop',     theme: 'loss' },
    wilt:      { name: 'Wilted Rose',  theme: 'loss' },
    coin:      { name: 'Coin',         theme: 'wealth' },
    gem:       { name: 'Gem',          theme: 'wealth' },
    dagger:    { name: 'Dagger',       theme: 'betrayal' },
    mask:      { name: 'Two-faced Mask', theme: 'betrayal' },
    ship:      { name: 'Ship',         theme: 'journey' },
    compass:   { name: 'Compass',      theme: 'journey' },
    leaf:      { name: 'Leaf',         theme: 'health' },
    staff:     { name: 'Serpent Staff', theme: 'health' },
    house:     { name: 'House',        theme: 'family' },
    tree:      { name: 'Rooted Tree',  theme: 'family' },
    crown:     { name: 'Crown',        theme: 'ambition' },
    peak:      { name: 'Mountain',     theme: 'ambition' },
    key:       { name: 'Key',          theme: 'secret' },
    eye:       { name: 'Eye',          theme: 'secret' },
    bolt:      { name: 'Lightning',    theme: 'danger' },
    flame:     { name: 'Wildfire',     theme: 'danger' },
    hourglass: { name: 'Hourglass',    theme: 'change' },
    moth:      { name: 'Moth',         theme: 'change' },
    star:      { name: 'Star',         theme: 'hope' },
    rainbow:   { name: 'Rainbow',      theme: 'hope' },
};
export const SYMBOL_IDS = Object.keys(SYMBOLS);
export const SYMBOLS_OF = Object.fromEntries(THEME_IDS.map((t) => [t, SYMBOL_IDS.filter((s) => SYMBOLS[s].theme === t)]));

// Colours: four bring a boon, four a bane. `hex` is the glow in the ball.
export const COLOURS = {
    gold:    { name: 'Gold',    tone: 'boon', hex: '#ffc94a', note: 'Fortune, warmth, the sun.' },
    emerald: { name: 'Emerald', tone: 'boon', hex: '#2fe39a', note: 'Growth and kindly luck.' },
    azure:   { name: 'Azure',   tone: 'boon', hex: '#4aa8ff', note: 'Calm, clear skies, true words.' },
    pearl:   { name: 'Pearl',   tone: 'boon', hex: '#f1ecff', note: 'Grace and blessing.' },
    crimson: { name: 'Crimson', tone: 'bane', hex: '#ff2e5b', note: 'Blood and burning anger.' },
    ember:   { name: 'Ember',   tone: 'bane', hex: '#ff7a1f', note: 'Trouble that smoulders.' },
    umbra:   { name: 'Umbra',   tone: 'bane', hex: '#8f5bff', note: 'Shadow and dread.' },
    bile:    { name: 'Bile',    tone: 'bane', hex: '#c4e01a', note: 'Sickness, envy, poison.' },
};
export const COLOUR_IDS = Object.keys(COLOURS);
export const COLOURS_OF = { boon: COLOUR_IDS.filter((c) => COLOURS[c].tone === 'boon'), bane: COLOUR_IDS.filter((c) => COLOURS[c].tone === 'bane') };

// One omen per theme: something in the room. `tint` colours the candle flames while it lasts.
export const OMENS = {
    love:     { name: 'Drifting petals',  text: 'Rose petals drift across the table, though no window is open.', tint: '#ff7ab8', sound: 'petals' },
    loss:     { name: 'Gutter and sigh',  text: 'Your candle gutters low, as if it sighed. Rain begins on the roof.', tint: '#7fa0ff', sound: 'rain' },
    wealth:   { name: 'Bright chimes',    text: 'The wind chimes ring bright as a pocketful of coin.', tint: '#ffd35a', sound: 'chimes' },
    betrayal: { name: 'The raven',        text: 'A raven lands on the windowsill and stares at your guest.', tint: '#b04dff', sound: 'raven' },
    journey:  { name: 'The creaking road', text: 'The wagon creaks and sways, as though the road were calling.', tint: '#6fd0ff', sound: 'creak' },
    health:   { name: 'Green smoke',      text: 'A thread of green smoke curls up from the incense.', tint: '#58f0a0', sound: 'hiss' },
    family:   { name: 'The old clock',    text: 'The old clock ticks twice, warm as a hearth.', tint: '#ffb066', sound: 'clock' },
    ambition: { name: 'The tall flame',   text: 'Every candle flame climbs tall and golden, straining upward.', tint: '#ffe070', sound: 'whoosh' },
    secret:   { name: 'Whispering curtains', text: 'The curtains whisper, though the air is perfectly still.', tint: '#a58cff', sound: 'whisper' },
    danger:   { name: 'Far thunder',      text: 'Thunder rolls, far off, and every dog in the village begins to bark.', tint: '#ff5a4a', sound: 'thunder' },
    change:   { name: 'The turning page', text: 'A gust from nowhere turns the pages of the journal.', tint: '#7ff0e0', sound: 'pages' },
    hope:     { name: 'The sunbeam',      text: 'A shaft of light breaks through the clouds and touches the ball.', tint: '#fff0b0', sound: 'sparkle' },
};

// The deck. `themes` are the two matters a card speaks to; upright is a boon, reversed a bane. `pal` colours its art.
export const CARDS = [
    { id: 0,  name: 'The Fool',           themes: ['journey', 'hope'],      pal: ['#2a4a9a', '#ffd25a'], up: 'A bright first step into the unknown.',   rev: 'A reckless leap, or a road wandered blind.' },
    { id: 1,  name: 'The Magician',       themes: ['ambition', 'change'],   pal: ['#8a1d4a', '#ffb347'], up: 'Will and craft remake the world.',       rev: 'Tricks, smoke and a will turned to ill.' },
    { id: 2,  name: 'The High Priestess', themes: ['secret', 'health'],     pal: ['#1c2f7a', '#9fd0ff'], up: 'Hidden truths surface gently.',          rev: 'Secrets kept too long fester.' },
    { id: 3,  name: 'The Empress',        themes: ['love', 'family'],       pal: ['#2c7a46', '#ff9ec4'], up: 'Warmth, plenty and the full table.',     rev: 'Smothering love, a hearth gone cold.' },
    { id: 4,  name: 'The Emperor',        themes: ['ambition', 'wealth'],   pal: ['#8a2418', '#ffd25a'], up: 'Steady power and a full treasury.',      rev: 'A tyrant’s grasp; wealth held in a fist.' },
    { id: 5,  name: 'The Hierophant',     themes: ['family', 'hope'],       pal: ['#5a2a8a', '#ffe9a8'], up: 'Tradition holds and blesses.',           rev: 'Old rules that bind and break.' },
    { id: 6,  name: 'The Lovers',         themes: ['love', 'betrayal'],     pal: ['#a02060', '#ffc2d8'], up: 'A true choice of the heart.',            rev: 'A choice made falsely; a heart divided.' },
    { id: 7,  name: 'The Chariot',        themes: ['journey', 'ambition'],  pal: ['#16507a', '#c9f0ff'], up: 'Victory at speed, the road won.',        rev: 'Wheels without a driver.' },
    { id: 8,  name: 'Strength',           themes: ['health', 'danger'],     pal: ['#b0560e', '#ffe08a'], up: 'Gentle courage tames the beast.',        rev: 'The beast breaks loose.' },
    { id: 9,  name: 'The Hermit',         themes: ['secret', 'loss'],       pal: ['#2b3a55', '#bcd4ff'], up: 'A lamp held up in a lonely place.',      rev: 'Loneliness; a lamp gone out.' },
    { id: 10, name: 'Wheel of Fortune',   themes: ['change', 'wealth'],     pal: ['#6a2a9a', '#ffcf5a'], up: 'The wheel lifts you up.',                rev: 'The wheel drops you down.' },
    { id: 11, name: 'Justice',            themes: ['betrayal', 'wealth'],   pal: ['#1a5a6a', '#f0f4ff'], up: 'Lies are weighed and found out.',        rev: 'A crooked scale and a bought verdict.' },
    { id: 12, name: 'The Hanged Man',     themes: ['loss', 'change'],       pal: ['#1a3f6a', '#8fe0ff'], up: 'Surrender that brings a new sight.',     rev: 'A sacrifice for nothing.' },
    { id: 13, name: 'Death',              themes: ['loss', 'danger'],       pal: ['#2a1038', '#e8e0ff'], up: 'An ending that clears the ground.',      rev: 'An end that will not come, or comes cruelly.' },
    { id: 14, name: 'Temperance',         themes: ['health', 'hope'],       pal: ['#1f6a6a', '#ffe9c0'], up: 'Balance and a slow mending.',            rev: 'Excess; a cure that harms.' },
    { id: 15, name: 'The Devil',          themes: ['danger', 'betrayal'],   pal: ['#5a0a1a', '#ff7a3a'], up: 'A temptation seen for what it is.',      rev: 'Chained to a bargain, and a liar holds the key.' },
    { id: 16, name: 'The Tower',          themes: ['danger', 'change'],     pal: ['#2a1a5a', '#ffb02a'], up: 'A ruin that frees you.',                 rev: 'The fall comes down on your head.' },
    { id: 17, name: 'The Star',           themes: ['hope', 'love'],         pal: ['#0f2a6a', '#bfe6ff'], up: 'Healing light after a long dark.',       rev: 'Hope dims; faith falters.' },
    { id: 18, name: 'The Moon',           themes: ['secret', 'journey'],    pal: ['#241a6a', '#d8c8ff'], up: 'Dreams that guide a night road.',        rev: 'Illusions, and a road that lies.' },
    { id: 19, name: 'The Sun',            themes: ['family', 'hope'],       pal: ['#c26a0a', '#fff0a0'], up: 'Joy at the door and children laughing.', rev: 'Joy that is clouded over.' },
    { id: 20, name: 'Judgement',          themes: ['change', 'loss'],       pal: ['#3a1a6a', '#ffe0a0'], up: 'A calling answered, a past forgiven.',  rev: 'Refusing the call; the past returns.' },
    { id: 21, name: 'The World',          themes: ['wealth', 'journey'],    pal: ['#0f5a4a', '#ffe38a'], up: 'A journey complete, the world at your feet.', rev: 'A goal just out of reach.' },
];
export const NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
export const CARDS_OF = Object.fromEntries(THEME_IDS.map((t) => [t, CARDS.filter((c) => c.themes.includes(t)).map((c) => c.id)]));

// What Madame Orla's journal already taught you: one symbol for each theme, three colours, four omens.
export const START_KNOWN = {
    sym: ['heart', 'tear', 'coin', 'dagger', 'ship', 'leaf', 'house', 'crown', 'key', 'bolt', 'hourglass', 'star'],
    col: ['gold', 'crimson', 'azure'],
    omen: ['love', 'betrayal', 'danger', 'hope'],
};

export const TIME_NAMES = ['What was', 'What is', 'What comes'];
export const TIME_SHORT = ['Past', 'Present', 'Future'];
