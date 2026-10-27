// The optional storyline: the Lantern saga. The Chronicler at the Guild offers nine chapters, each one
// an objective the dungeon already contains (reach a floor, fell a guardian, find lore tablets), each
// with a scene and a reward. Ignore it and nothing changes; follow it and the dungeon starts talking.
// Pure: state is G.story = { on, ch, tabs, total }.

import { seeded } from '../rng.js';
import { say, ev } from './core.js';
import { genUnique, UNIQUE_BY_ID } from './uniques.js';
import { give } from './inv.js';
import { distMap, cellIdx } from './dungeon.js';
import { misc } from './journal.js';

export const newStory = () => ({ on: false, ch: 0, tabs: 0, total: 0, done: false });

/** Named guardians the saga is about. Other fifth floors get random ones. */
export const STORY_BOSSES = {
    15: { name: 'The Hollow King', fam: 'lich' },
    30: { name: 'The Pale Queen', fam: 'vampire' },
    45: { name: 'The Choir Beneath', fam: 'hydra' },
};

// obj: reach (deepest floor), boss (guardian of that floor beaten), tablets (n found since the chapter began, on floors lo..hi)
export const CHAPTERS = [
    {
        title: 'The Light Goes Out', obj: { type: 'reach', floor: 3, text: 'Reach the third floor.' }, gold: 300,
        intro: 'The Chronicler is old enough to have forgotten her own name and young enough to still be afraid. "The lantern over the Descent went out last night," she says. "It has burned since before the town. Someone must go down and see why. Go as far as the third floor. Look at the walls."',
        outro: '"The walls were written on," she says, when you describe them. "Of course they were. Take this for your trouble. Then we shall find out who was writing."',
    },
    {
        title: 'Letters in Stone', obj: { type: 'tablets', n: 3, lo: 3, hi: 12, text: 'Find 3 lore tablets on floors 3 to 12.' }, gold: 500,
        intro: '"They are tablets," she says. "Stone slabs, set into the walls of the old halls, left by the people who first lit the lantern. Find three. Read them all, and bring me what they say."',
        outro: 'She sets the three readings side by side and goes very quiet. "Wicks. The lantern had wicks, and each wick was a king. They fed the dark so that it would not feed on us." She pushes a small lantern across the desk. "Take this one. It is not the first."',
        reward: 'lanterncharm',
    },
    {
        title: 'The First Guardian', obj: { type: 'boss', floor: 5, text: 'Defeat the guardian of the fifth floor.' }, gold: 800,
        intro: '"The guardians are not monsters, not at first," she says. "They are keepers, and keepers go sour when no one comes. Beat the one on the fifth floor, and see whether it has anything of the old king left in it."',
        outro: '"It said something? What did it say?" You tell her: *at last*. She does not speak for a while.',
    },
    {
        title: 'What the Dead Remember', obj: { type: 'tablets', n: 5, lo: 6, hi: 18, text: 'Find 5 lore tablets on floors 6 to 18.' }, gold: 1500,
        intro: '"There are more tablets below. Deeper ones are about the kings themselves, the ones who gave their light. Five of them. I want their names."',
        outro: '"Five kings," she reads, "and the sixth never wrote anything down, because the sixth was not a king at all." She hands you a circlet that has been in a drawer since before she was born.',
        reward: 'crownash',
    },
    {
        title: 'The Hollow King', obj: { type: 'boss', floor: 15, text: 'Defeat the guardian of the fifteenth floor.' }, gold: 3000,
        intro: '"The fifteenth floor is where the first wick burned out. What is left of him is called the Hollow King, which is rude, but accurate. End it kindly if you can. End it anyway if you cannot."',
        outro: '"Did he thank you?" She does not wait for an answer. "They always do, at the end. It is the only thing that makes it bearable."',
    },
    {
        title: 'The Lantern\'s Heart', obj: { type: 'tablets', n: 5, lo: 16, hi: 28, text: 'Find 5 lore tablets on floors 16 to 28.' }, gold: 4000,
        intro: '"Below the Hollow King the writing changes. It is not a record any more. It is instructions. Find five more tablets. If I am right about what they say, I would like very much to be wrong."',
        outro: '"The lantern was never a lamp. It was a lock. Each king was a turn of the key, and what is locked in is the Queen who made the first light, to put out the dark, and who could not stop." She gives you a ring. "For the next part, you will want second chances."',
        reward: 'secondchances',
    },
    {
        title: 'The Pale Queen', obj: { type: 'boss', floor: 30, text: 'Defeat the guardian of the thirtieth floor.' }, gold: 8000,
        intro: '"The Pale Queen is on the thirtieth floor. She is not angry. She is very tired. Please remember that when you are fighting her."',
        outro: 'The light in the Chronicler\'s window steadies. "I can feel the lantern," she says. "Not lit. But no longer going out." She gives you the shield from above the door. "It was waiting for someone who would bring it back to the dawn."',
        reward: 'aegis',
    },
    {
        title: 'The Light Returns', obj: { type: 'reach', floor: 35, text: 'Reach the thirty-fifth floor, and look back up.' }, gold: 20000,
        intro: '"One more thing. Go down to the thirty-fifth floor, and look up. I would go myself, but I have a lantern to mind."',
        outro: 'She is smiling when you come back. "Above the thirty-fifth floor there is an opening that was never a window, and from there you can see the lantern. You are the first person in a thousand years to see it burn." The town bell rings. It has not rung in your lifetime. *Here ends the story of the Lantern. The dungeon, naturally, goes on.*',
        reward: 'deepamulet',
    },
    {
        title: 'Afterword: The Choir Beneath', obj: { type: 'boss', floor: 45, text: 'Defeat the guardian of the forty-fifth floor.' }, gold: 50000,
        intro: '"There is a last thing, and it is not part of the story, only the footnote. Something is singing on the forty-fifth floor. It has been singing since before the lantern. I would like to know what it wants."',
        outro: '"Just to be heard," she says. "Of course. It is always just that." *Fin.*',
        final: true,
    },
];

export const chapter = (G) => CHAPTERS[G.story.ch] || null;

/** [have, need] for the current chapter. */
export function storyProgress(G) {
    const c = chapter(G);
    if (!c) return [1, 1];
    const o = c.obj;
    if (o.type === 'reach') return [Math.min(o.floor, G.maxDepth), o.floor];
    if (o.type === 'boss') return [G.cleared >= o.floor ? 1 : 0, 1];
    return [Math.min(o.n, G.story.tabs), o.n];
}
export const storyReady = (G) => { if (!G.story.on || G.story.done) return false; const [a, b] = storyProgress(G); return a >= b; };
export function startStory(G) {
    if (G.story.on) return false;
    G.story.on = true;
    say(G, 'The Chronicler opens her book. The Lantern saga begins.', 13);
    ev(G, 'story');
    return true;
}
export function claimChapter(G) {
    if (!storyReady(G)) return false;
    const c = chapter(G);
    G.gold += c.gold; G.stats.goldEarned += c.gold;
    say(G, `Chapter complete: ${c.title}. +${c.gold}g`, 14);
    if (c.reward && !G.uniques[c.reward]) {
        G.uniques[c.reward] = true;
        const it = genUnique(G.rng, c.reward, Math.max(1, G.maxDepth));
        give(G, it, 'reward');
        say(G, `The Chronicler gives you ${UNIQUE_BY_ID[c.reward].name}.`, 13);
    }
    misc(G, 'chapters');
    G.story.ch++;
    G.story.tabs = 0;
    if (c.final || !chapter(G)) G.story.done = true;
    ev(G, 'story');
    return true;
}

// ------------------------------------------------------------------ lore tablets
const LORE = [
    'WE LIT IT TO KEEP THE DARK OUT. WE DID NOT ASK WHAT THE DARK WOULD DO WHEN IT WAS KEPT.',
    'THE FIRST WICK BURNS THE BRIGHTEST. THE FIRST WICK IS ALSO THE FIRST TO GO.',
    'THE KINGS WERE NOT ASKED. THE KINGS WERE TOLD, AND THEY SAID YES, WHICH IS WHY WE REMEMBER THEM.',
    'IF YOU ARE READING THIS THE LIGHT HAS GONE OUT AGAIN. I AM SORRY. IT IS NOT YOUR FAULT. IT NEVER WAS.',
    'EACH FLOOR IS A TURN OF THE KEY. DO NOT COUNT THEM. THE COUNTING IS HOW IT KNOWS.',
    'A QUEEN GAVE THE FIRST LIGHT. SHE WAS THANKED BY NO ONE, WHICH IS HOW SHE BECAME LONELY, WHICH IS HOW SHE BECAME PALE.',
    'THE GUARDIANS KEEP THE STAIRS BECAUSE THEY WERE TOLD TO KEEP SOMETHING, AND NOBODY SAID WHEN TO STOP.',
    'IF THE LANTERN GOES OUT, GO DOWN, NOT UP. UP IS WHERE IT WILL FOLLOW YOU.',
    'WE BUILT A TOWN ON TOP OF THE DOOR AND CALLED IT SAFE. IT WAS. THAT WAS THE TERRIBLE PART.',
    'THE CHOIR WAS A GIFT FROM A KING WHO COULD NOT SING. IT HAS BEEN PRACTISING EVER SINCE.',
    'THE SIXTH WICK WAS NOT A KING. THE SIXTH WICK WAS THE ONE WHO TRIMMED THE OTHERS. SHE HAS NOT BEEN ASKED.',
    'THE DEEP DOES NOT HATE YOU. THE DEEP IS A LARGE ANIMAL THAT HAS BEEN FED SO LONG IT CANNOT REMEMBER HUNGER.',
    'SOMEONE HAS SCRATCHED BELOW THIS: *TELL THE CHRONICLER THERE IS A WINDOW.*',
    'DRINK FROM THE SPRINGS. THEY ARE THE ONLY HONEST WATER LEFT.',
    'THE WALLS ARE WRITTEN ON BECAUSE THE PEOPLE WHO WROTE ON THEM WERE AFRAID OF BEING FORGOTTEN. YOU ARE DOING THEM A KINDNESS.',
    'I HAVE COUNTED THE FLOORS. THERE IS NO BOTTOM. I FOUND THAT OUT SOMEWHERE AROUND FLOOR TWO HUNDRED, AND THEN I FOUND OUT I COULD KEEP GOING.',
];
export const loreLine = (n) => LORE[n % LORE.length];

/** Put a tablet on this floor when the saga wants one here (or, a quarter of the time, a plain bit of lore). */
export function injectTablet(G, f) {
    if (Object.values(f.feat).some((x) => x.type === 'tablet')) return;
    const c = G.story.on && !G.story.done ? chapter(G) : null;
    const wanted = c && c.obj.type === 'tablets' && f.depth >= c.obj.lo && f.depth <= c.obj.hi;
    const r = seeded(G.seed, f.depth, 61);
    if (!wanted && r() > 0.25) return;
    const dm = distMap(f, f.start.x, f.start.y);
    for (let tries = 0; tries < 200; tries++) {
        const i = r.int(0, f.w * f.h - 1), k = `${i % f.w},${(i / f.w) | 0}`;
        if (dm[i] > 1 && !f.feat[k]) { f.feat[k] = { type: 'tablet', read: false, line: r.int(0, 999) }; return; }
    }
    void cellIdx;
}
export function readTablet(G, ft) {
    ft.read = true;
    G.story.total++;
    misc(G, 'tablets');
    const c = G.story.on && !G.story.done ? chapter(G) : null;
    if (c && c.obj.type === 'tablets' && G.depth >= c.obj.lo && G.depth <= c.obj.hi) G.story.tabs++;
    return loreLine(ft.line + G.story.total);
}
