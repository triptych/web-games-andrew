// The game: where the story is, and every command the player can give. Pure: no DOM, no clock, no Math.random.
// The UI, the bot and the tests all go through act(G, cmd), and react to G.events.
//
// Phases: 'scene' (a script is running), 'ward' (a ward-lock is on screen), 'camp' (choosing who to sit with),
// 'map' (the road to the next chapter), 'end' (the story is over).

import { CHAPTERS, WARDS, CAMP_TALKS } from './data/chapters.js';
import { SCENES } from './data/story.js';
import { TALKS, CAMP_INTRO, CAMP_WHO, CAMP_IF } from './data/camps.js';
import { COMPANIONS } from './data/cast.js';
import { beginScene, advance, choose } from './scene.js';
import { evalCond } from './rules.js';
import { makeWard, turn, isSolved, hint } from './ward.js';
import { makeRng } from '../rng.js';

export const SAVE_V = 1;

export function newGame(seed = 1, name = 'Wren') {
    const G = {
        v: SAVE_V, seed: seed >>> 0, name,
        ch: 0, seg: 0, phase: 'scene',
        scene: null, stage: null, ward: null, camp: null,
        hues: [0, 0, 0, 0, 0, 0, 0],
        hope: 0, mercy: 0,
        bond: Object.fromEntries(COMPANIONS.map((c) => [c, 0])),
        talk: Object.fromEntries(COMPANIONS.map((c) => [c, 0])),
        flags: {},
        seenCg: [],
        stats: { choices: 0, turns: 0, hints: 0, unsealed: 0, lines: 0 },
        rngState: 0,
        events: [],
    };
    G.rngState = makeRng(G.seed).state();
    startSeg(G);
    return G;
}

export const chapter = (G) => CHAPTERS[G.ch];
export const segment = (G) => CHAPTERS[G.ch]?.segs[G.seg];

/** The script lines of the scene now running (rebuilt from its id after a load). */
export function sceneLines(G) {
    const S = G.scene;
    if (!S) return null;
    if (S.kind === 'story') return SCENES[S.id];
    if (S.kind === 'talk') return TALKS[S.who][S.n];
    if (S.kind === 'campIntro') return CAMP_INTRO[S.night];
    throw new Error('unknown scene kind ' + S.kind);
}

function startSeg(G) {
    const s = segment(G);
    if (typeof s === 'string') {
        G.phase = 'scene';
        if (!SCENES[s]) throw new Error('unknown scene ' + s);
        if (G.seg === 0) G.events.push({ type: 'chapter', ch: G.ch, title: CHAPTERS[G.ch].title });
        if (!beginScene(G, { id: s, kind: 'story' }, SCENES[s])) sceneEnded(G);
    } else if (s.ward) {
        G.phase = 'ward';
        G.scene = null;
        G.ward = makeWard(s.ward, G.seed);
        G.events.push({ type: 'wardStart', id: s.ward });
    } else if (s.camp) {
        G.camp = { night: s.camp, left: CAMP_TALKS, done: [] };
        G.phase = 'scene';
        G.events.push({ type: 'camp', night: s.camp });
        if (!beginScene(G, { id: 'camp' + s.camp, kind: 'campIntro', night: s.camp }, CAMP_INTRO[s.camp])) sceneEnded(G);
    } else throw new Error('bad segment');
}

function nextSeg(G) {
    G.seg++;
    if (G.seg < CHAPTERS[G.ch].segs.length) return startSeg(G);
    G.scene = null;
    if (G.ch === CHAPTERS.length - 1) {
        G.phase = 'end';
        G.events.push({ type: 'end' });
        return;
    }
    G.phase = 'map';
    G.events.push({ type: 'map', next: G.ch + 1 });
}

function sceneEnded(G) {
    const kind = G.scene?.kind;
    G.scene = null;
    if (kind === 'talk' || kind === 'campIntro') {
        G.phase = 'camp';
        if (!campChoices(G).length || G.camp.left <= 0) return endCamp(G);
        return;
    }
    nextSeg(G);
}

function endCamp(G) {
    G.camp = null;
    G.events.push({ type: 'campEnd' });
    nextSeg(G);
}

/** Who the apprentice can sit with tonight: [{ who, n, topic }]. */
export function campChoices(G) {
    if (!G.camp) return [];
    return CAMP_WHO[G.camp.night]
        .filter((w) => !G.camp.done.includes(w))
        .filter((w) => !CAMP_IF[w] || evalCond(G, CAMP_IF[w]))
        .filter((w) => G.talk[w] < TALKS[w].length)
        .map((w) => ({ who: w, n: G.talk[w] }));
}

/** The number of hues restored. */
export const huesRestored = (G) => G.hues.reduce((a, b) => a + b, 0);

/**
 * Apply one command. Returns true if it did something. Commands:
 *   { t: 'advance' }  { t: 'choose', i }                        in a scene
 *   { t: 'turn', ring, dir }  { t: 'hint' }  { t: 'unseal' }     at a ward
 *   { t: 'sit', who }  { t: 'sleep' }                            at camp
 *   { t: 'travel' }                                              on the map
 */
export function act(G, cmd) {
    switch (cmd.t) {
        case 'advance': {
            if (G.phase !== 'scene' || !G.scene) return false;
            const r = advance(G, sceneLines(G));
            if (r === null) return false;
            G.stats.lines++;
            if (!r) sceneEnded(G);
            return true;
        }
        case 'choose': {
            if (G.phase !== 'scene' || !G.scene) return false;
            const r = choose(G, sceneLines(G), cmd.i);
            if (r === null) return false;
            if (!r) sceneEnded(G);
            return true;
        }
        case 'turn': {
            const w = G.ward;
            if (G.phase !== 'ward' || !w) return false;
            if (!(cmd.ring >= 0 && cmd.ring < w.rings.length) || (cmd.dir !== 1 && cmd.dir !== -1)) return false;
            turn(w, cmd.ring, cmd.dir);
            w.moves++;
            G.stats.turns++;
            G.events.push({ type: 'turn', ring: cmd.ring, dir: cmd.dir });
            if (isSolved(w)) wardOpened(G, false);
            return true;
        }
        case 'hint': {
            if (G.phase !== 'ward' || !G.ward) return false;
            const h = hint(G.ward);
            if (!h) return false;
            G.ward.hints++;
            G.stats.hints++;
            G.events.push({ type: 'hint', ...h });
            return true;
        }
        case 'unseal': {
            if (G.phase !== 'ward' || !G.ward) return false;
            const w = G.ward;
            for (let h = hint(w), n = 0; h && n < 200; h = hint(w), n++) turn(w, h.ring, h.dir);
            G.stats.unsealed++;
            wardOpened(G, true);
            return true;
        }
        case 'sit': {
            if (G.phase !== 'camp') return false;
            const c = campChoices(G).find((x) => x.who === cmd.who);
            if (!c) return false;
            G.camp.done.push(c.who);
            G.camp.left--;
            G.talk[c.who]++;
            G.events.push({ type: 'talk', who: c.who, n: c.n });
            if (!beginScene(G, { id: `talk-${c.who}-${c.n}`, kind: 'talk', who: c.who, n: c.n }, TALKS[c.who][c.n])) sceneEnded(G);
            else G.phase = 'scene';
            return true;
        }
        case 'sleep': {
            if (G.phase !== 'camp') return false;
            endCamp(G);
            return true;
        }
        case 'travel': {
            if (G.phase !== 'map') return false;
            G.ch++;
            G.seg = 0;
            startSeg(G);
            return true;
        }
        default: return false;
    }
}

function wardOpened(G, unsealed) {
    const w = G.ward;
    const hue = WARDS[w.id].hue;
    G.hues[hue] = 1;
    G.events.push({ type: 'wardOpen', id: w.id, hue, moves: w.moves, par: w.par, unsealed });
    G.events.push({ type: 'hue', hue, n: huesRestored(G) });
    G.ward = null;
    nextSeg(G);
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    if (!CHAPTERS[d.ch]) throw new Error('bad chapter');
    const G = { ...JSON.parse(JSON.stringify(d)), events: [] };
    if (G.scene && !sceneLines(G)) throw new Error('bad scene');
    return G;
}

/** A one-line summary for a save slot. */
export function describe(G) {
    const c = CHAPTERS[G.ch];
    return `${c.id === 'prologue' ? 'Prologue' : c.id === 'epilogue' ? 'Epilogue' : 'Chapter ' + G.ch}: ${c.title}`;
}
