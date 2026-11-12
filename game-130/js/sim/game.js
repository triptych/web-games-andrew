// Starbase Spooky — the simulation. Pure: no DOM, no rendering, no Math.random, no clock.
//
// The game is a point-and-click adventure, so it is driven by commands, not a stick:
//   act(G, cmd)    — everything the player (or the bot, or a test) does: tap a spot, go to a room, advance the
//                    dialogue, answer a question, tap a puzzle piece, solve the mystery, ask Orby for a hint.
//   step(G, dt)    — the only things that take time: Kit walking, the memory puzzles' lights, spooky moments.
// Everything that happens is pushed to G.events for the view, the audio and the UI to answer.
//
// The story runs through G.queue, a list of steps played in order. Blocking steps wait for the player:
//   { say: lineId }  a line of dialogue until 'next'      { ask: questionId }  a visitor's question until answered
//   { ded: n }       a mystery question until answered     { puzzle: kind }    a repair puzzle until solved
//   { night: true }  the end-of-day card until 'next'     { end: true }       the certificate (the game is over)
// and { do: ... } steps run at once (finish a job, hand over an item, find a clue, change room, raise an event).

import { WALK_SPEED, SPOOK_FIRST, SPOOK_AGAIN, STICKERS } from '../config.js';
import { makeRng } from '../rng.js';
import { ROOMS, neighbor } from './data/rooms.js';
import { DAYS, DAYS_TOTAL, FIXES, CLUES, CLUE_ORDER, DEDUCE, LINES } from './data/story.js';
import { QUESTIONS, QUESTION, ASKS_PER_VISIT } from './data/questions.js';
import { makePuzzle, pickPuzzle, tickPuzzle, shuffle } from './puzzles.js';

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        day: 0,
        room: 'deck',
        kit: { x: ROOMS.deck.entry, tx: null, face: -1, pending: null },
        queue: [],
        puzzle: null,
        wrong: [],              // wrong answers tried on the current question
        stickers: 0,
        clues: [],
        items: [],
        facts: [],              // question ids answered (their facts go in the Space Book)
        firstTry: 0,
        asked: {},              // visitor -> the question ids they ask this game
        done: {},               // today's finished jobs
        fixed: {},              // systems repaired, ever
        broken: {},             // systems broken right now
        flags: {},
        spook: { t: 0, n: 0 },
        over: false,
        events: [],
    };
    // each visitor asks three of their four questions, chosen by the seed
    for (const day of DAYS) {
        const mine = QUESTIONS.filter((q) => q.who === day.visitor).map((q) => q.id);
        G.asked[day.visitor] = shuffle(G.rng, mine).slice(0, ASKS_PER_VISIT).sort();
    }
    startDay(G, 1);
    return G;
}

const today = (G) => DAYS[G.day - 1];
export const busy = (G) => G.queue.length > 0;

function startDay(G, d) {
    G.day = d;
    G.done = {};
    G.room = 'deck';
    G.kit = { x: ROOMS.deck.entry, tx: null, face: -1, pending: null };
    G.flags.sleepSaid = false;
    G.spook = { t: G.rng.range(...SPOOK_FIRST), n: 0 };
    const day = today(G);
    G.broken = {};
    if (day.fix) G.broken[day.fix] = true;
    G.events.push({ type: 'day', day: d });
    for (const id of day.brief) G.queue.push({ say: id });
    if (day.fix) G.queue.push({ do: 'event', ev: { type: 'break', sys: day.fix } }, { say: FIXES[day.fix].broke });
    G.queue.push({ do: 'event', ev: { type: 'dock', who: day.visitor } });
    advance(G);
}

// ------------------------------------------------------------------------------------------------ jobs
/** Today's jobs with whether each is done and whether it can be done yet. */
export function jobs(G) {
    return today(G).jobs.map((j) => ({ ...j, done: !!G.done[j.id], ready: (j.after || []).every((a) => G.done[a]) }));
}
export const allDone = (G) => jobs(G).every((j) => j.done);

/** What to do next: the first unfinished job that is ready, or bed. Orby's hints and the bot both use this. */
export function objective(G) {
    const j = jobs(G).find((x) => !x.done && x.ready);
    if (j) return j;
    if (G.day < DAYS_TOTAL) return { id: 'sleep', room: 'quarters', spot: 'bed', hint: 'orby.hint.sleep' };
    return null;
}

function finishJob(G, id) {
    if (G.done[id]) return;
    G.done[id] = true;
    G.events.push({ type: 'job', id });
    if (allDone(G) && G.day < DAYS_TOTAL && !G.flags.sleepSaid) {
        G.flags.sleepSaid = true;
        G.queue.push({ say: 'orby.hint.sleep' });
    }
}

// ------------------------------------------------------------------------------------------------ the queue
function advance(G) {
    while (G.queue.length) {
        const s = G.queue[0];
        if (s.do) { G.queue.shift(); run(G, s); continue; }
        if (s.puzzle && !G.puzzle) {
            G.puzzle = makePuzzle(s.puzzle, G.rng);
            G.events.push({ type: 'puzzle', kind: s.puzzle });
        }
        if (s.say) G.events.push({ type: 'say', id: s.say, who: LINES[s.say].who });
        if (s.ask) G.events.push({ type: 'ask', id: s.ask });
        if (s.night) G.events.push({ type: 'night', day: G.day });
        if (s.end && !G.over) { G.over = true; G.events.push({ type: 'end' }); }
        return;
    }
}

function run(G, s) {
    switch (s.do) {
        case 'job': finishJob(G, s.id); break;
        case 'stickers': G.stickers += s.n; G.events.push({ type: 'sticker', n: s.n }); break;
        case 'give':
            if (!G.items.includes(s.item)) G.items.push(s.item);
            G.events.push({ type: 'item', id: s.item });
            break;
        case 'clue':
            if (!G.clues.includes(s.id)) {
                G.clues.push(s.id);
                G.stickers += STICKERS.clue;
                G.events.push({ type: 'clue', id: s.id });
            }
            break;
        case 'fix':
            G.fixed[s.sys] = true;
            delete G.broken[s.sys];
            G.stickers += STICKERS.fix;
            G.events.push({ type: 'fixed', sys: s.sys });
            break;
        case 'room': goRoom(G, s.id); break;
        case 'flag': G.flags[s.id] = true; break;
        case 'event': G.events.push({ ...s.ev }); break;
        default: throw new Error('unknown step ' + s.do);
    }
}

/** The step the player is looking at, or null when Kit is free to walk around. */
export const front = (G) => G.queue[0] || null;

/** Enter a room: by the map at its usual spot, or through a side door (dir = the way Kit was walking) at the
 * opposite edge, so walking right out of one room walks right into the next. */
function goRoom(G, id, dir = 0) {
    if (!ROOMS[id]) return;
    G.room = id;
    G.kit.x = dir > 0 ? EDGE_IN : dir < 0 ? W_ROOM - EDGE_IN : ROOMS[id].entry;
    if (dir) G.kit.face = dir;
    G.kit.tx = null;
    G.kit.pending = null;
    G.events.push({ type: 'room', id, dir });
}
const W_ROOM = 640, EDGE_OUT = 14, EDGE_IN = 46;

// ------------------------------------------------------------------------------------------------ spots
/** Is this spot in the current room shown and tappable right now? */
export function spotVisible(G, spot) {
    if (spot.visitor) return !!today(G).visitor;
    if (spot.clue) return clueReady(G, spot.clue) || false;
    return true;
}

/** A clue can be found once its job is on today's list (or an earlier day's) and the job is ready. */
export function clueReady(G, id) {
    if (G.clues.includes(id)) return false;
    for (let d = 1; d <= G.day; d++) {
        const j = DAYS[d - 1].jobs.find((x) => x.id === 'clue:' + id);
        if (!j) continue;
        if (d < G.day) return true;
        return (j.after || []).every((a) => G.done[a]);
    }
    return false;
}

export function roomSpots(G, room = G.room) {
    return ROOMS[room].spots.filter((s) => spotVisible(G, s));
}

function say(G, ...ids) { for (const id of ids) G.queue.push({ say: id }); }

function interact(G, spot) {
    const day = today(G);
    G.events.push({ type: 'look', spot: spot.id });
    if (spot.map) { G.events.push({ type: 'map' }); return; }
    if (spot.book) { G.events.push({ type: 'book' }); say(G, 'orby.book'); return; }

    if (spot.visitor) {
        const who = day.visitor;
        if (G.done.greet) { say(G, 'orby.visitor.done'); return; }
        say(G, `${who}.hello`);
        for (const q of G.asked[who]) G.queue.push({ say: `${who}.${q}` }, { ask: q });
        say(G, `${who}.bye`);
        if (who === 'quasar') G.queue.push({ do: 'give', item: 'meter' });
        G.queue.push({ do: 'job', id: 'greet' });
        return;
    }

    if (spot.clue) {
        const id = spot.clue;
        if (id === 'goo' && G.broken.garden) { say(G, 'orby.dark'); return; }
        if (!clueReady(G, id)) { say(G, 'orby.notyet'); return; }
        say(G, `orby.clue.${id}`);
        G.queue.push({ do: 'clue', id }, { do: 'job', id: 'clue:' + id });
        return;
    }

    if (spot.id === 'comms') {
        if (clueReady(G, 'hum')) {
            say(G, 'orby.clue.hum');
            G.queue.push({ do: 'event', ev: { type: 'hum' } }, { do: 'clue', id: 'hum' }, { do: 'job', id: 'clue:hum' });
            return;
        }
        if (G.day === DAYS_TOTAL && G.done.find && !G.done.home) {
            say(G, 'wisp.song', 'orby.pz.song');
            G.queue.push({ puzzle: 'song' });
            say(G, 'orby.signal');
            G.queue.push({ do: 'event', ev: { type: 'signal' } }, { do: 'flag', id: 'mama' }, { do: 'event', ev: { type: 'mama' } });
            say(G, 'mama.arrive', 'wisp.bye', 'mama.gift');
            G.queue.push({ do: 'give', item: 'star' }, { do: 'flag', id: 'wispHome' }, { do: 'stickers', n: STICKERS.home }, { do: 'job', id: 'home' });
            say(G, 'ada.end', 'orby.end');
            G.queue.push({ end: true });
            return;
        }
        say(G, 'orby.comms');
        return;
    }

    if (spot.fix) {
        const sys = spot.fix;
        if (G.broken[sys]) {
            say(G, FIXES[sys].intro);
            G.queue.push({ puzzle: FIXES[sys].puzzle }, { do: 'fix', sys });
            say(G, ['orby.fixed1', 'orby.fixed2', 'orby.fixed3'][Object.keys(G.fixed).length % 3]);
            G.queue.push({ do: 'job', id: 'fix' });
            return;
        }
        if (sys === 'galley' && G.day === DAYS_TOTAL && G.done.solve && !G.done.cookie) {
            say(G, 'orby.cookie');
            G.queue.push({ do: 'event', ev: { type: 'cookie' } }, { do: 'give', item: 'cookie' }, { do: 'job', id: 'cookie' });
            return;
        }
        if (sys === 'observatory' && G.fixed.observatory) { say(G, 'orby.scope.ok'); return; }
        say(G, 'orby.fixed.ok');
        return;
    }

    if (spot.bed) {
        if (G.day < DAYS_TOTAL && allDone(G)) {
            say(G, 'orby.night');
            G.queue.push({ night: true });
            return;
        }
        say(G, 'orby.bed');
        return;
    }

    if (spot.vent) {
        if (G.day === DAYS_TOTAL && G.done.cookie) {
            G.queue.push({ do: 'event', ev: { type: 'door' } }, { do: 'room', id: 'vents' });
            return;
        }
        say(G, G.day === DAYS_TOTAL && G.done.solve ? 'orby.vent.cookie' : 'orby.vent');
        return;
    }

    if (spot.nest) {
        if (!G.done.find) {
            say(G, 'orby.vents');
            G.queue.push({ do: 'event', ev: { type: 'wisp' } }, { do: 'flag', id: 'wispFound' });
            say(G, 'wisp.hello', 'wisp.sorry', 'orby.wisp', 'wisp.yay');
            G.queue.push({ do: 'job', id: 'find' });
            return;
        }
        say(G, 'orby.hint.home');
        return;
    }

    if (spot.say) say(G, spot.say);
}

// ------------------------------------------------------------------------------------------------ commands
/**
 * Everything the player can do. Returns true if the command was accepted.
 *   { t: 'tap', spot }        walk to a spot in this room and use it     { t: 'walk', x }      walk to a point
 *   { t: 'go', room }         travel by the station map                  { t: 'next' }         advance a line or card
 *   { t: 'answer', i }        answer the visitor's (or the mystery's) question with option i
 *   { t: 'pick', ... }        tap a puzzle piece (see puzzles.js)        { t: 'solve' }        solve the mystery
 *   { t: 'hint' }             ask Orby what to do next   { t: 'exit', dir }   walk out the left (-1) or right (+1) side
 */
export function act(G, cmd) {
    if (G.over && cmd.t !== 'next') return false;
    const f = front(G);
    switch (cmd.t) {
        case 'next':
            if (!f || !(f.say || f.night)) return false;
            G.queue.shift();
            if (f.night) startDay(G, G.day + 1);
            else advance(G);
            return true;
        case 'answer': return answer(G, f, cmd.i);
        case 'pick': {
            if (!f || !f.puzzle || !G.puzzle) return false;
            const ev = pickPuzzle(G.puzzle, cmd);
            G.events.push(...ev);
            if (ev.some((e) => e.what === 'nope' && e.first)) G.queue.unshift({ say: 'orby.pz.planet.no' });
            else if (ev.some((e) => e.what === 'oops') && !G.flags.oopsSaid) { G.flags.oopsSaid = true; G.queue.unshift({ say: 'orby.pz.oops' }); }
            else if (ev.some((e) => e.what === 'toomuch') && !G.flags.tooSaid) { G.flags.tooSaid = true; G.queue.unshift({ say: 'orby.pz.toomuch' }); }
            if (G.puzzle.solved) {
                G.events.push({ type: 'solved', kind: G.puzzle.kind });
                G.queue.splice(G.queue.indexOf(f), 1);
                G.puzzle = null;
            }
            advance(G);
            return true;
        }
        case 'tap': {
            if (f) return false;
            const spot = roomSpots(G).find((s) => s.id === cmd.spot);
            if (!spot) return false;
            G.kit.pending = spot.id;
            G.kit.tx = spot.walk;
            return true;
        }
        case 'walk':
            if (f) return false;
            G.kit.pending = null;
            G.kit.tx = Math.max(20, Math.min(620, cmd.x));
            return true;
        case 'exit': {
            // walk to the left or right edge of the room and through to the next room round the ring
            if (f) return false;
            const to = neighbor(G.room, cmd.dir < 0 ? -1 : 1);
            if (!to) return false;
            G.kit.pending = 'exit:' + (cmd.dir < 0 ? -1 : 1);
            G.kit.tx = cmd.dir < 0 ? EDGE_OUT : W_ROOM - EDGE_OUT;
            return true;
        }
        case 'go':
            if (f || !ROOMS[cmd.room] || cmd.room === G.room) return false;
            G.events.push({ type: 'door' });
            goRoom(G, cmd.room);
            return true;
        case 'solve': {
            if (f) return false;
            if (G.day !== DAYS_TOTAL || G.done.solve) { say(G, 'orby.notyet'); advance(G); return true; }
            if (CLUE_ORDER.some((c) => !G.clues.includes(c))) { say(G, 'orby.ded.notyet'); advance(G); return true; }
            say(G, 'orby.ded.intro');
            DEDUCE.forEach((d, i) => G.queue.push({ say: d.say }, { ded: i }));
            say(G, 'orby.ded.solved');
            G.queue.push({ do: 'stickers', n: STICKERS.solve }, { do: 'job', id: 'solve' });
            advance(G);
            return true;
        }
        case 'hint': {
            if (f) return false;
            const o = objective(G);
            say(G, o ? o.hint : 'orby.notyet');
            G.events.push({ type: 'hint', id: o?.id || null });
            advance(G);
            return true;
        }
        default: return false;
    }
}

function answer(G, f, i) {
    if (!f || !(f.ask || f.ded !== undefined)) return false;
    const q = f.ask ? QUESTION[f.ask] : DEDUCE[f.ded];
    if (!Number.isInteger(i) || i < 0 || i >= q.a.length || G.wrong.includes(i)) return false;
    const who = f.ask ? q.who : 'orby';
    if (i === q.ok) {
        G.queue.shift();
        const first = G.wrong.length === 0;
        G.events.push({ type: 'right', first });
        if (f.ask) {
            const n = first ? STICKERS.first : STICKERS.retry;
            G.stickers += n;
            if (first) G.firstTry++;
            if (!G.facts.includes(f.ask)) G.facts.push(f.ask);
            G.events.push({ type: 'sticker', n }, { type: 'fact', id: f.ask });
            G.queue.unshift({ say: `${who}.right` }, { say: `orby.fact.${f.ask}` });
        } else G.queue.unshift({ say: 'orby.ded.right' });
        G.wrong = [];
    } else {
        G.wrong.push(i);
        G.events.push({ type: 'wrong' });
        G.queue.unshift({ say: f.ask ? `${who}.wrong` : 'orby.ded.wrong' });
    }
    advance(G);
    return true;
}

// ------------------------------------------------------------------------------------------------ time
export function step(G, dt) {
    if (G.over) return;
    G.t += dt;
    if (G.puzzle) G.events.push(...tickPuzzle(G.puzzle, dt));
    const k = G.kit;
    if (k.tx !== null && !front(G)) {
        const d = k.tx - k.x;
        const s = WALK_SPEED * dt;
        if (Math.abs(d) <= s) {
            k.x = k.tx;
            k.tx = null;
            if (k.pending && k.pending.startsWith('exit:')) {
                const dir = +k.pending.slice(5);
                k.pending = null;
                const to = neighbor(G.room, dir);
                if (to) { G.events.push({ type: 'door' }); goRoom(G, to, dir); }
            } else if (k.pending) {
                const spot = roomSpots(G).find((x) => x.id === k.pending);
                k.pending = null;
                if (spot) { interact(G, spot); advance(G); }
            }
        } else {
            k.x += Math.sign(d) * s;
            k.face = Math.sign(d);
        }
    }
    // spooky moments while the mystery is unsolved: the clock runs all day (listening counts), but a moment only
    // happens when Kit is free, never in the middle of someone talking
    if (!G.done.solve && G.room !== 'vents') {
        if (G.spook.t > 0) G.spook.t -= dt;
        if (G.spook.t <= 0 && !front(G) && G.kit.tx === null) {
            const kind = ['ghost', 'flicker', 'moan'][G.rng.int(0, 2)];
            G.events.push({ type: 'spook', kind, y: G.rng.int(60, 180), dir: G.rng.chance(0.5) ? 1 : -1 });
            if (G.spook.n === 0) G.queue.push({ say: kind === 'ghost' ? 'orby.spook3' : kind === 'flicker' ? 'orby.spook2' : 'orby.spook1' });
            G.spook.n++;
            G.spook.t = G.rng.range(...SPOOK_AGAIN);
            advance(G);
        }
    }
}

// ------------------------------------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    // a save made mid-line puts the line back on screen
    if (G.queue.length) {
        const f = G.queue[0];
        if (f.say) G.events.push({ type: 'say', id: f.say, who: LINES[f.say].who });
        if (f.ask) G.events.push({ type: 'ask', id: f.ask });
        if (f.night) G.events.push({ type: 'night', day: G.day });
    }
    return G;
}

export { CLUES, CLUE_ORDER };
