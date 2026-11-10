// Every scene the game can play, built from the data files by id and arguments. A save holds only the id, the
// arguments and the line pointer, so the script is rebuilt here after loading and in the album.

import { STORY, COMING_OF_AGE } from './data/story.js';
import { HEART_SCENES, STARFALL } from './data/hearts.js';
import { ENDING, EPILOGUES, WEDDING, SOLO_EPILOGUE, FAREWELL } from './data/endings.js';
import { BIRTHDAY, AUDIENCE, CONTEST, CHAT, TALK, feelLine } from './data/events.js';
import { CAST } from './data/cast.js';
import { PLACE } from './data/places.js';

export const STORY_BY_ID = Object.fromEntries(STORY.map((s) => [s.id, s]));
export const HEART_BY_ID = {};
for (const f in HEART_SCENES) HEART_SCENES[f].forEach((s, i) => { HEART_BY_ID[s.id] = { ...s, friend: f, n: i + 1 }; });

const tier = (age) => (age < 14 ? 'young' : 'grown');

/** { lines, title, kind, album, cg } for a scene id and its arguments. */
export function sceneDef(id, args = {}) {
    if (STORY_BY_ID[id]) { const s = STORY_BY_ID[id]; return { lines: s.lines, title: s.title, kind: 'story', album: true }; }
    if (HEART_BY_ID[id]) { const s = HEART_BY_ID[id]; return { lines: s.lines, title: s.title, kind: 'heart', album: true }; }
    switch (id) {
        case 'birthday': return { lines: BIRTHDAY(args.age), title: 'Hatch-day', kind: 'event' };
        case 'audience': return { lines: AUDIENCE(args.fav), title: 'The Spring Audience', kind: 'event' };
        case 'starfall': {
            const lines = STARFALL[args.friend][args.grown ? 'grown' : 'young'];
            return { lines, title: `Starfall Night with ${CAST[args.friend].name}`, kind: 'starfall', album: !!args.grown };
        }
        case 'festival': return festivalScene(args);
        case 'visit': return visitScene(args);
        case 'talk': return talkScene(args);
        case 'place': return placeScene(args);
        case 'ending': return endingScene(args);
        default: throw new Error('unknown scene ' + id);
    }
}

function festivalScene({ contest, won, rank, rivals = [] }) {
    const C = CONTEST[contest];
    const lines = ['@bg ' + C.bg, '@music festival', `n: The Harvest Festival. ${C.name}.`];
    for (const [name, who] of rivals) {
        if (who && CAST[who]) lines.push(`@show ${who} r`, `${who}: Good luck. You\'ll need it.`, `@hide ${who}`);
        else lines.push(`n: ${name} takes the field.`);
        break;
    }
    lines.push('@show cael l');
    if (won) {
        lines.push('@sfx cheer', '@cg ' + C.cg, 'n: ' + C.win, 'cael.happy: {you}! Did you see? I won!', '@cg');
    } else {
        lines.push(`n: ${C.lose}`, rank === 2 ? 'n: Second place. So close.' : `n: He places ${['', 'first', 'second', 'third', 'fourth'][rank] || 'last'}.`,
            rank <= 2 ? 'cael.happy: Next year. Next year it\'s mine.' : 'cael.sad: ...I\'ll practise more.');
    }
    return { lines, title: `${C.name}${won ? ': Victory' : ''}`, kind: 'festival', album: !!won };
}

function visitScene({ friend, line, gift, giftReact, place }) {
    const lines = ['@bg ' + (PLACE[place]?.bg || 'market'), `@show ${friend} r`, '@show cael l', line];
    if (gift) lines.push(giftReact);
    return { lines, title: `Visiting ${CAST[friend].name}`, kind: 'visit' };
}

function talkScene({ topic, age, line }) {
    const lines = ['@bg study', '@show cael l'];
    const you = { praise: 'you: I\'m proud of you. I want you to know that.', scold: 'you: You\'ve been careless lately. A prince can\'t afford careless.',
        feel: 'you: How are you, really?', mother: 'you: Shall I tell you about your mother again?', future: 'you: What do you want to be, when all this is over?' }[topic];
    lines.push(you, line);
    return { lines, title: 'A talk at Emberhold', kind: 'talk', age };
}

function placeScene({ lines, title }) {
    return { lines, title, kind: 'place' };
}

/** The coming of age, the ending itself, the epilogue (or wedding), the farewell. */
function endingScene({ ending, partner }) {
    const E = ENDING[ending];
    const lines = [...COMING_OF_AGE.lines, `@music ${E.music}`, ...E.lines];
    if (!E.bad) {
        if (ending === 'king' && partner) {
            lines.push(...WEDDING.map((l) => l.replace('{wedcg}', EPILOGUES[partner].king)));
        } else if (partner) {
            lines.push('@cg ' + EPILOGUES[partner].cg, ...EPILOGUES[partner].lines);
        } else {
            lines.push(...SOLO_EPILOGUE);
        }
    }
    lines.push(...FAREWELL);
    return { lines, title: E.title, kind: 'ending', album: true };
}

// helpers the sim uses to build the argument-driven scenes
export function chatLine(friend, age, k) {
    const pool = CHAT[friend][tier(age)];
    return pool[k % pool.length];
}
export function talkLine(G, topic, k) {
    if (topic === 'feel') return feelLine(G);
    const pool = TALK[topic][tier(G.age)];
    return pool[k % pool.length];
}
