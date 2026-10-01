/**
 * regions.js — the Library's wings and their procedural maps.
 *
 * A wing map is 7 rows of nodes (2–3 per row except the entrance, the Keeper and the
 * Guardian), each node linked to one or two nodes in the next row. Clearing a node opens
 * its children. Node kinds: battle, elite, treasure, shrine, event, keeper, guardian, final.
 */

import { makeRng, hashSeed } from './rng.js';

export const WINGS = [
    { id: 'atrium', name: 'The Sunlit Atrium', short: 'Atrium', lo: 1, hi: 5, icon: '🌞',
      bestiary: ['slime', 'sprite', 'mushroom', 'slime', 'inkling'], rare: 'owlbear',
      sky: ['#7fe0ff', '#ffe69a'], ground: '#7ad35a', accent: '#ffd23a', mood: 'sunny',
      keeper:   { name: 'Bramblegob, Slime Sovereign', family: 'slime', signature: 'gloop', mods: ['giant'] },
      guardian: { name: 'Grandmother Thornback', family: 'owlbear', signature: 'rallyroar', mods: ['ancient'] },
      blurb: 'Sunbeams, ferns and reading nooks. The friendliest wing — the slimes are mostly just curious.' },
    { id: 'archives', name: 'The Ember Archives', short: 'Archives', lo: 5, hi: 10, icon: '🔥',
      bestiary: ['imp', 'wisp', 'slime', 'imp', 'inkling'], rare: 'drake',
      sky: ['#ff8a5a', '#ffd36a'], ground: '#c95a3a', accent: '#ff5a2a', mood: 'warm',
      keeper:   { name: 'Cinderwick the Imp Archivist', family: 'imp', signature: 'flamedance', mods: ['arcane'] },
      guardian: { name: 'Pyrrhax the Footnote Drake', family: 'drake', signature: 'dragonfire', mods: ['giant'] },
      blurb: 'Lava lamps, toasty stacks and imps who have filed everything under "F" for "Fire".' },
    { id: 'stacks', name: 'The Tidal Stacks', short: 'Stacks', lo: 10, hi: 15, icon: '🌊',
      bestiary: ['crab', 'eel', 'specter', 'crab', 'inkling'], rare: 'slime',
      sky: ['#3fd0ff', '#a6fff0'], ground: '#2a8ad3', accent: '#3fe0ff', mood: 'water',
      keeper:   { name: 'Captain Clatterclaw', family: 'crab', signature: 'tidalslam', mods: ['armored'] },
      guardian: { name: 'The Abyssal Errata', family: 'eel', signature: 'hex', mods: ['frenzied'] },
      blurb: 'The shelves flooded and the books learned to swim. Mind the crabs; they bite and they file.' },
    { id: 'gallery', name: 'The Storm Gallery', short: 'Gallery', lo: 15, hi: 20, icon: '🌩️',
      bestiary: ['sprite', 'wisp', 'gargoyle', 'imp', 'inkling'], rare: 'specter',
      sky: ['#8a7aff', '#ffb8f0'], ground: '#5a58b8', accent: '#d8b8ff', mood: 'storm',
      keeper:   { name: 'Voltessa the Thunder Sprite', family: 'sprite', signature: 'gust', mods: ['swift'] },
      guardian: { name: 'Old Granite Gargantua', family: 'gargoyle', signature: 'quake', mods: ['giant'] },
      blurb: 'Portraits that argue, lightning in the skylights and gargoyles who never blink.' },
    { id: 'scriptorium', name: 'The Clockwork Scriptorium', short: 'Clockwork', lo: 20, hi: 26, icon: '⚙️',
      bestiary: ['golem', 'mimic', 'gargoyle', 'imp', 'inkling'], rare: 'mimic',
      sky: ['#ffb84a', '#ffe9b0'], ground: '#a8743a', accent: '#ffcf6a', mood: 'clock',
      keeper:   { name: 'Tock, the Ten-Ton Golem', family: 'golem', signature: 'stoneskin', mods: ['armored'] },
      guardian: { name: 'The Gilded Mimic Regent', family: 'mimic', signature: 'pagestorm', mods: ['greedy'] },
      blurb: 'Brass pens on brass arms copying books nobody asked for. Something is ticking under the floor.' },
    { id: 'observatory', name: 'The Starlit Observatory', short: 'Observatory', lo: 26, hi: 32, icon: '🔭',
      bestiary: ['specter', 'drake', 'wisp', 'owlbear', 'mimic', 'inkling'], rare: 'sprite',
      sky: ['#3a2a8a', '#ff8ad8'], ground: '#4a3a9a', accent: '#ffe08a', mood: 'stars',
      keeper:   { name: 'The Pale Librarian', family: 'specter', signature: 'wail', mods: ['arcane'] },
      guardian: { name: 'Starmaw, Devourer of Constellations', family: 'drake', signature: 'dragonfire', mods: ['arcane'], resist: 'spark' },
      blurb: 'The top of the Library, open to the sky. The stars here are on loan and overdue.' },
    { id: 'margin', name: 'The Blank Margin', short: 'Margin', lo: 34, hi: 34, icon: '✒️', final: true,
      bestiary: ['inkling'], rare: 'inkling',
      sky: ['#ffffff', '#d8d0ff'], ground: '#e8e4f8', accent: '#2a2040', mood: 'blank',
      final: { name: 'The Unwriter', family: 'inkling', signature: 'unwrite', mods: [] },
      blurb: 'The edge of every page, where nothing has been written yet. The Unwriter waits there with a very large eraser.' },
];

export const ROWS = 7;

export function wingLevel(w, row) {
    return Math.round(w.lo + (w.hi - w.lo) * row / (ROWS - 1));
}

export function generateWingMap(seed, wi) {
    const w = WINGS[wi];
    const rng = makeRng(hashSeed(seed, 'wing', wi));
    if (w.final) {
        return { nodes: [{ id: 0, row: 0, col: 0, x: 0.5, kind: 'final', level: w.lo, next: [] }], rows: 1 };
    }
    const nodes = [];
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
        let n = r === 0 || r === 3 || r === 6 ? 1 : rng.int(2, 3);
        const row = [];
        for (let c = 0; c < n; c++) {
            let kind = 'battle';
            if (r === 3) kind = 'keeper';
            else if (r === 6) kind = 'guardian';
            else if (r > 0) kind = rng.weighted([['battle', 55], ['elite', r === 1 ? 0 : 16], ['treasure', 11], ['shrine', 9], ['event', 9]]);
            const x = n === 1 ? 0.5 : 0.18 + (0.64 * c) / (n - 1) + rng.range(-0.05, 0.05);
            const node = { id: nodes.length, row: r, col: c, x, kind, level: wingLevel(w, r) + (kind === 'elite' ? 1 : 0), next: [] };
            nodes.push(node);
            row.push(node);
        }
        // Each row 1,2,4,5 must contain at least one battle (so XP is always on offer).
        if (r !== 0 && r !== 3 && r !== 6 && !row.some((n2) => n2.kind === 'battle')) row[0].kind = 'battle';
        rows.push(row);
    }
    // Edges: each node to its nearest one or two in the next row; every child gets a parent.
    for (let r = 0; r < ROWS - 1; r++) {
        const cur = rows[r], nxt = rows[r + 1];
        for (const n of cur) {
            const sorted = nxt.slice().sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
            n.next.push(sorted[0].id);
            if (sorted[1] && rng.chance(0.55)) n.next.push(sorted[1].id);
        }
        for (const c of nxt) {
            if (!cur.some((n) => n.next.includes(c.id))) {
                const near = cur.slice().sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
                near.next.push(c.id);
            }
        }
    }
    return { nodes, rows: ROWS };
}

/** Nodes the player may enter: the entrance, and any child of a cleared node. */
export function openNodes(map, cleared) {
    const open = new Set();
    for (const n of map.nodes) {
        if (n.row === 0) open.add(n.id);
        if (cleared[n.id]) for (const c of n.next) open.add(c);
    }
    return open;
}

// ------------------------------------------------------------------ Events ("?" nodes)

export const EVENTS = [
    { id: 'scholar', title: 'A Lost Scholar', icon: '🧐',
      text: 'A scholar in an enormous hat has been reading the same page for a week. "I just need someone to explain chapter four," they sigh.',
      choices: [
          { label: 'Explain chapter four (gain XP)', effect: { xp: 1.0 } },
          { label: 'Sell them a bookmark (gain gold)', effect: { gold: 1.0 } },
      ] },
    { id: 'well', title: 'The Wishing Inkwell', icon: '🪄',
      text: 'An inkwell the size of a bathtub glimmers. A sign reads: "Coins in, wishes out. Results may vary. Results will be fabulous."',
      choices: [
          { label: 'Toss in gold for a blessing', effect: { pay: 0.6, blessing: true } },
          { label: 'Fish out the coins already in it', effect: { gold: 0.7 } },
      ] },
    { id: 'shelf', title: 'A Toppled Bookshelf', icon: '📚',
      text: 'A shelf has fallen across the path, spilling books, planks and a surprising number of pebbles.',
      choices: [
          { label: 'Salvage the planks and pebbles', effect: { wood: 1, stone: 1 } },
          { label: 'Reshelve the books (gain XP)', effect: { xp: 0.8 } },
      ] },
    { id: 'garden', title: 'An Indoor Meadow', icon: '🌼',
      text: 'Somebody planted a meadow between the shelves. It is very pretty and very slightly singing.',
      choices: [
          { label: 'Gather herbs and petals', effect: { herbs: 1, crystal: 0.4 } },
          { label: 'Take a nap (a blessing)', effect: { blessing: true } },
      ] },
    { id: 'tinker', title: 'A Wandering Tinker', icon: '🧳',
      text: 'A tinker with a backpack full of clanking things offers a trade. "Everything must go! Including me, soon."',
      choices: [
          { label: 'Buy a mystery item', effect: { pay: 0.8, item: true } },
          { label: 'Swap travel stories (gain XP)', effect: { xp: 0.6 } },
      ] },
    { id: 'echo', title: 'An Echo of the Old Library', icon: '👂',
      text: 'For a moment the shelves remember how they used to look: tidy, bright, full. A whisper says "thank you".',
      choices: [
          { label: 'Listen closely (gain XP)', effect: { xp: 1.2 } },
          { label: 'Follow the whisper (crystal and ink)', effect: { crystal: 0.8, ink: 0.6 } },
      ] },
];
