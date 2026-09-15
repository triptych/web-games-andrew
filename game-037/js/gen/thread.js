// ============================================================
// gen/thread.js - region Threads (GDD §14.4)
// Ten shapes, each a generated situation with a cost/cost choice.
// Casting fails loudly and falls back through the shape list in order.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { threadId } from '../core/ids.js';
import { DOMAINS, QUIET_THREAD_DROP } from '../data/constants.js';
import { generateRoster } from './npc.js';
import { layoutForThread } from './threadutil.js';

/** The ten shapes, in a fixed fallback order. */
export const SHAPES = [
  {
    key: 'the-well-that-lies', stake: 'the water, and everyone who drinks it',
    roles: { anchor: { any: true }, antagonist: { notSame: true }, victim: { any: true } },
    premise: a => `${a.anchor.shortName} says the water has gone wrong, and is right.`,
    hidden: a => `${a.antagonist.shortName} knows why, and has a reason you will not enjoy hearing.`,
    choice: {
      question: 'Say what you found, or keep it?',
      a: 'Tell the village', aCost: 'They will not forgive {antagonist}.',
      b: 'Keep it', bCost: '{anchor} will go on not knowing, and drinking.',
    },
  },
  {
    key: 'two-roofs', stake: 'a winter, and which house gets through it',
    roles: { anchor: { any: true }, antagonist: { notSame: true }, victim: { any: true } },
    premise: a => `${a.anchor.shortName} and ${a.antagonist.shortName} need the same thing before the season turns.`,
    hidden: a => `There is only enough for one roof.`,
    choice: {
      question: 'Which roof?',
      a: 'Give it to {anchor}', aCost: '{antagonist} will not be able to stay.',
      b: 'Give it to {antagonist}', bCost: '{anchor} will remember that you chose.',
    },
  },
  {
    key: 'the-returned', stake: 'somebody who came back, mostly',
    roles: { anchor: { any: true }, victim: { notSame: true }, antagonist: { notSame: true } },
    premise: a => `${a.victim.shortName} came up out of the Hollow and is not entirely ${a.victim.shortName}.`,
    hidden: a => `${a.anchor.shortName} would rather have them wrong than not at all.`,
    choice: {
      question: 'What do you tell them?',
      a: 'The truth', aCost: '{anchor} will have to grieve properly.',
      b: 'Let it stand', bCost: 'Something that is not {victim} will keep living in their house.',
    },
  },
  {
    key: 'the-debt', stake: 'an old obligation, and two people who are both right',
    roles: { anchor: { any: true }, antagonist: { notSame: true } },
    premise: a => `${a.antagonist.shortName} is owed, and ${a.anchor.shortName} cannot pay.`,
    hidden: a => `The debt is older than either of them and was never fair.`,
    choice: {
      question: 'Whose claim stands?',
      a: 'Settle it for {anchor}', aCost: '{antagonist} loses what they were promised.',
      b: 'Settle it for {antagonist}', bCost: '{anchor} leaves the village owing nothing and having nothing.',
    },
  },
  {
    key: 'lantern-out', stake: 'the road, and the Quiet coming up it',
    roles: { anchor: { any: true }, victim: { notSame: true } },
    premise: a => `The keeper died. Nobody has walked their round since.`,
    hidden: a => `${a.anchor.shortName} has been pretending to, so nobody panics.`,
    choice: {
      question: 'Who walks the round now?',
      a: 'Take it on yourself', aCost: 'You will be expected back. Often.',
      b: 'Teach {anchor} to do it', bCost: 'They will be out on the road at night, for years.',
    },
  },
  {
    key: 'the-wrong-name', stake: 'a name that was changed to hide something',
    roles: { anchor: { any: true }, antagonist: { notSame: true } },
    premise: a => `${a.anchor.shortName} says this place used to be called something else.`,
    hidden: a => `The old name is on a plate at the bottom of the Hollow.`,
    choice: {
      question: 'Put the name back?',
      a: 'Restore it', aCost: 'What the name was hiding comes back with it.',
      b: 'Leave it', bCost: 'The Quiet keeps a foothold here that it did not earn.',
    },
  },
  {
    key: 'harvest-and-hunger', stake: 'the fields, and what is eating them',
    roles: { anchor: { any: true }, antagonist: { any: true } },
    premise: a => `Something has moved up out of the dark and into the fields.`,
    hidden: a => `It is not hunting. It is running from something further down.`,
    choice: {
      question: 'Kill it, or move it on?',
      a: 'Kill them', aCost: 'What they were running from still has room to spread.',
      b: 'Drive them back down', bCost: 'The fields lose a season, and somebody goes hungry.',
    },
  },
  {
    key: 'the-quiet-child', stake: 'a child who has stopped speaking',
    roles: { anchor: { any: true }, victim: { band: 'child' }, antagonist: { any: true } },
    premise: a => `${a.victim.shortName} has not said anything for eleven days.`,
    hidden: a => `They saw something in a place adults do not go.`,
    choice: {
      question: 'What do you do with what they saw?',
      a: 'Take it seriously', aCost: 'The whole village has to look at it.',
      b: 'Let them forget it', bCost: 'It will still be down there, and it will still be true.',
    },
  },
  {
    key: 'the-bell-that-cracked', stake: 'a custom that has been keeping the dark off',
    roles: { anchor: { any: true }, antagonist: { notSame: true } },
    premise: a => `The bell cracked, and nobody has rung anything since.`,
    hidden: a => `The metal for a new one is three regions away.`,
    choice: {
      question: 'Mend the old custom, or make a new one?',
      a: 'Recast the bell', aCost: 'It costs what the village has left.',
      b: 'Start a different custom', bCost: '{anchor} will never accept it, and says so.',
    },
  },
  {
    key: 'guest-of-the-hollow', stake: 'something down there that is not hostile',
    roles: { anchor: { any: true }, victim: { any: true } },
    premise: a => `There is a thing in the Hollow that has not attacked anybody.`,
    hidden: a => `It wants one specific, small, achievable thing.`,
    choice: {
      question: 'Kill it or listen to it?',
      a: 'Kill it', aCost: 'It works. It works immediately. You will think about it.',
      b: 'Listen', bCost: 'It asks for something, and it is not nothing.',
    },
  },
];

/**
 * @pure One Thread per settled region, cast from its roster.
 * Falls back through shapes in order when a role cannot be cast.
 */
export function generateThread(W, region) {
  const rng = deriveRNG(W.master, DOMAINS.REGION_THREAD, region.rx, region.ry, W.attempt || 0);
  const roster = layoutForThread(W, region);
  if (roster.length < 3) return null;

  const order = rng.shuffle(SHAPES.slice());
  for (const shape of order) {
    const cast = castRoles(rng, shape, roster);
    if (!cast) continue;

    const hollowId = region.hollows.length ? rng.pick(region.hollows) : null;
    const reward = pickReward(W, region, rng);

    return {
      id: threadId(region.id), regionId: region.id, shape: shape.key,
      anchor: cast.anchor.id, anchorName: cast.anchor.shortName,
      antagonist: cast.antagonist ? cast.antagonist.id : null,
      antagonistName: cast.antagonist ? cast.antagonist.shortName : null,
      victim: cast.victim ? cast.victim.id : null,
      victimName: cast.victim ? cast.victim.shortName : null,
      stake: shape.stake,
      hollow: hollowId,
      premise: shape.premise(cast),
      hidden: shape.hidden(cast),
      beats: buildBeats(shape, cast, region, hollowId),
      choicePoint: bindChoice(shape.choice, cast),
      reward, quietFloor: Math.max(0.05, region.quietBase * 0.4),
      quietDrop: QUIET_THREAD_DROP,
      // mutable, saved:
      state: 'unknown', current: 0, chosen: null,
    };
  }
  return null;
}

function castRoles(rng, shape, roster) {
  const alive = roster.filter(n => n.state === 'alive');
  if (!alive.length) return null;
  const cast = {};
  for (const role of Object.keys(shape.roles)) {
    const spec = shape.roles[role];
    let pool = alive.filter(n => !Object.values(cast).some(c => c.id === n.id));
    if (spec.band) pool = pool.filter(n => n.ageBand === spec.band);
    if (!pool.length) return null;
    cast[role] = rng.pick(pool);
  }
  return cast;
}

function buildBeats(shape, cast, region, hollowId) {
  const beats = [
    { kind: 'talk', target: { npc: cast.anchor.id }, hint: `${cast.anchor.shortName} will tell you what is wrong.`, done: false },
    { kind: 'goto', target: { region: region.id }, hint: `Walk ${region.name} and see it for yourself.`, done: false },
  ];
  if (cast.antagonist) {
    beats.push({ kind: 'talk', target: { npc: cast.antagonist.id }, hint: `${cast.antagonist.shortName} knows more than they say.`, done: false });
  }
  if (hollowId) {
    beats.push({ kind: 'descend', target: { hollow: hollowId, depth: 2 }, hint: 'The answer is under the ground.', done: false });
  }
  beats.push({ kind: 'choose', target: { thread: threadId(region.id) }, hint: 'Decide. Both ways cost something.', done: false });
  beats.push({ kind: 'talk', target: { npc: cast.anchor.id }, hint: `Tell ${cast.anchor.shortName} what you did.`, done: false });
  return beats;
}

function bindChoice(choice, cast) {
  const bind = s => s
    .replace(/\{anchor\}/g, cast.anchor ? cast.anchor.shortName : 'them')
    .replace(/\{antagonist\}/g, cast.antagonist ? cast.antagonist.shortName : 'them')
    .replace(/\{victim\}/g, cast.victim ? cast.victim.shortName : 'them');
  return {
    question: bind(choice.question),
    a: bind(choice.a), aCost: bind(choice.aCost),
    b: bind(choice.b), bCost: bind(choice.bCost),
  };
}

function pickReward(W, region, rng) {
  // Threads pay a Vigor shard by default; the gate solver may upgrade one to a
  // capability when a Hollow cannot carry it.
  return rng.chance(0.4)
    ? { kind: 'vigor_shard', value: 2 }
    : { kind: 'gear', ilvl: 6 + region.tier * 5 };
}
