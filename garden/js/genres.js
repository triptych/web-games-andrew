// The garden's districts. Each genre gets its own path out of the hub, a gate,
// a pavilion at the end, and a family of statues. Add a genre here and set
// `genre` on games in js/gamedata.js; the island regrows to fit.

export const GENRES = [
    {
        id: 'arcade',
        name: 'The Starfire Arcade',
        short: 'Arcade & Shooters',
        emoji: '\u{1F680}',
        accent: '#ff5fd2',
        accent2: '#5fe8ff',
        roof: 'crystal',
        columns: 8,
        statues: ['orrery', 'comet', 'sentinel'],
        flowers: ['#ff6ad5', '#7a5cff', '#5fe8ff', '#ffffff'],
    },
    {
        id: 'puzzle',
        name: 'The Puzzle Grove',
        short: 'Puzzles',
        emoji: '\u{1F9E9}',
        accent: '#ffd23f',
        accent2: '#ff9f1c',
        roof: 'pagoda',
        columns: 6,
        statues: ['cubes', 'knot', 'sage'],
        flowers: ['#ffd23f', '#ffffff', '#ff9f1c', '#f7e18c'],
    },
    {
        id: 'dungeon',
        name: "The Delvers' Descent",
        short: 'Dungeons & Roguelikes',
        emoji: '\u{1F5DD}\u{FE0F}',
        accent: '#ff7a33',
        accent2: '#ffcf6b',
        roof: 'cone',
        columns: 8,
        statues: ['knight', 'lantern', 'knight'],
        flowers: ['#e84a2a', '#ffb347', '#a3203a', '#ffd9a0'],
    },
    {
        id: 'rpg',
        name: "The Heroes' Walk",
        short: 'RPG & Adventure',
        emoji: '\u{2694}\u{FE0F}',
        accent: '#5d9bff',
        accent2: '#a6e1ff',
        roof: 'dome',
        columns: 8,
        statues: ['mage', 'knight', 'archer'],
        flowers: ['#4f7cff', '#c9d8ff', '#ffffff', '#8fb3ff'],
    },
    {
        id: 'story',
        name: "The Storytellers' Bower",
        short: 'Stories & Narrative',
        emoji: '\u{1F4D6}',
        accent: '#c08cff',
        accent2: '#ffd6f5',
        roof: 'onion',
        columns: 6,
        statues: ['reader', 'book', 'sage'],
        flowers: ['#b57bff', '#ffd6f5', '#e3b5ff', '#ffffff'],
    },
    {
        id: 'strategy',
        name: "The Strategists' Court",
        short: 'Strategy & Cards',
        emoji: '\u{265F}\u{FE0F}',
        accent: '#3fe0a0',
        accent2: '#d7ffef',
        roof: 'dome',
        columns: 10,
        statues: ['chess', 'chess', 'tower'],
        flowers: ['#2fd18c', '#ffffff', '#f5e663', '#a5f2d1'],
    },
    {
        id: 'cozy',
        name: 'The Hearthgarden',
        short: 'Cozy & Sims',
        emoji: '\u{1F33F}',
        accent: '#ff9ec4',
        accent2: '#fff1a8',
        roof: 'pagoda',
        columns: 6,
        statues: ['urn', 'gardener', 'urn'],
        flowers: ['#ff8fb8', '#fff1a8', '#ffc4dd', '#ffffff'],
    },
    {
        id: 'misc',
        name: "The Wanderers' Glade",
        short: 'Curiosities',
        emoji: '\u{2728}',
        accent: '#9fffd8',
        accent2: '#ffffff',
        roof: 'cone',
        columns: 6,
        statues: ['sage', 'orrery', 'urn'],
        flowers: ['#9fffd8', '#ffffff', '#ffe28a', '#b9a8ff'],
    },
];

const BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));

// Tag keywords used to place a game that has no `genre` yet.
const TAG_HINTS = [
    ['dungeon', /dungeon|rogue|crawler|blobber|delve/i],
    ['puzzle', /puzzle|logic|picross|nonogram|sokoban|match/i],
    ['strategy', /strategy|tower defen|deck|card|gacha|slots|chess|tactic/i],
    ['cozy', /cozy|idle|pet|village|city|farm|sim|sandbox/i],
    ['story', /story|narrative|novel|fiction|point & click|exploration/i],
    ['rpg', /rpg|adventure|quest/i],
    ['arcade', /arcade|shoot|shmup|bullet|runner|platform|breakout|pinball|action/i],
];

export function genreOf(game) {
    if (game.genre && BY_ID[game.genre]) return BY_ID[game.genre];
    const text = game.tags.map((t) => t.label).join(' ') + ' ' + game.title;
    for (const [id, re] of TAG_HINTS) if (re.test(text)) return BY_ID[id];
    return BY_ID.misc;
}

/**
 * Groups games by genre in the order GENRES lists them, newest game first
 * in each group (closest to the hub). Empty genres are left out.
 */
export function groupGames(games) {
    const groups = new Map(GENRES.map((g) => [g.id, { genre: g, games: [] }]));
    for (const game of games) groups.get(genreOf(game).id).games.push(game);
    const out = [];
    for (const g of groups.values()) {
        if (!g.games.length) continue;
        g.games.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
        out.push(g);
    }
    return out;
}
