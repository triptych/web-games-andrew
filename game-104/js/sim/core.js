// Small helpers shared by the data tables, the story rules and the engine. No imports from them,
// so any of them can import this. Pure: it only reads and writes the game state G.

import { EMBER_BASE, MAX_SCORE } from '../config.js';

/** Filled in by game.js: enter(G, roomId) runs the story's first-visit and arrival logic. */
export const hooks = {};

export const say = (G, text, cls = '') => { G.events.push({ type: 'say', text, cls }); };
export const sfx = (G, name) => { G.events.push({ type: 'sfx', name }); };
export const ev = (G, e) => { G.events.push(e); };

export const flag = (G, k) => G.flags[k];
export const setf = (G, k, v = true) => { G.flags[k] = v; };

export const has = (G, id) => G.loc[id] === 'inv' || G.loc[id] === 'worn';
export const here = (G, id) => G.loc[id] === G.room;
export const give = (G, id) => { G.loc[id] = 'inv'; };
export const drop = (G, id) => { G.loc[id] = 'gone'; };
export const reveal = (G, id) => { G.loc[id] = G.room; };

export const stock = (G, id) => G.stock[id] || 0;
export const addStock = (G, id, n = 1) => { G.stock[id] = (G.stock[id] || 0) + n; };
export const spend = (G, id, n = 1) => {
    if (stock(G, id) < n) return false;
    G.stock[id] -= n;
    return true;
};

export const npcHere = (G, id) => G.npcLoc[id] === G.room;
export const emberMax = (G) => EMBER_BASE + G.level;

/** Score points, once per key. */
export function points(G, key, n) {
    if (G.pts[key] || n <= 0) return;
    G.pts[key] = n;
    G.score = Math.min(MAX_SCORE, G.score + n);
    ev(G, { type: 'score', n, score: G.score });
}

/** A journal entry, once. The text is what the player re-reads with "journal". */
export function clue(G, id, text) {
    if (G.journal.some((j) => j.id === id)) return;
    G.journal.push({ id, text });
    ev(G, { type: 'clue', text });
}

export function evidence(G, id, text) {
    if (G.evidence.includes(id)) return;
    G.evidence.push(id);
    say(G, `[Evidence ${G.evidence.length} of 5: ${text}]`, 'clue');
    sfx(G, 'clue');
}

export function learnHerb(G, id) { if (!G.lore.includes(id)) G.lore.push(id); }
export function learnRecipe(G, id) { if (!G.recipes.includes(id)) G.recipes.push(id); }

export function learnSpell(G, id) {
    if (!G.spells.includes(id)) G.spells.push(id);
}

export function levelUp(G, text) {
    G.level++;
    G.ember = emberMax(G);
    say(G, text || 'Your craft deepens. The ember in your chest burns brighter, and a little hotter.', 'magic');
    sfx(G, 'level');
}

export function addDread(G, n) {
    G.dread = Math.max(0, Math.min(100, G.dread + n));
    ev(G, { type: 'dread', value: G.dread });
}

export function after(G, id, n) { G.timers.push({ id, at: G.turn + n }); }

export function kill(G, title, text) {
    if (G.dead) return;
    G.dead = { title, text };
    ev(G, { type: 'dead', title, text });
    sfx(G, 'death');
}

export function moveTo(G, id) {
    G.prev = G.room;
    G.room = id;
    G.hidden = false;
    ev(G, { type: 'room', id });
    hooks.enter?.(G, id);
}

export const lit = (G) => (has(G, 'lantern') && !!G.flags.lantern_lit) || G.witchlight > 0;
export const disguised = (G) => G.loc.apron === 'worn' && G.loc.cap === 'worn';
