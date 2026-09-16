// ============================================================
// data/text.js - flavour banks and log templates (GDD §34.5)
// Short, concrete, sensory. Reach for bread before you reach for "ancient".
// ============================================================

/** The `listen` and `sit` pool. These do nothing mechanical and are the point. */
export const OBSERVATIONS = Object.freeze([
  'Wind in something, a long way off.',
  'Water, moving, where you cannot see it.',
  'A bird you do not know the name of, twice.',
  'Your own breathing, and then you stop noticing it.',
  'Somebody a field away, calling a dog.',
  'The particular green of moss on north-facing stone.',
  'Nothing. It is a good nothing.',
  'Bees, working, with no interest in you at all.',
  'A gate, somewhere, on a bad hinge.',
  'The lantern ticks as it cools.',
  'Rooks arguing about rook business.',
  'Grass moving in one direction, all of it.',
  'The smell of rain that has not arrived.',
  'A sheep, and then an answering sheep.',
  'Something small goes under the hedge and does not come out.',
  'Your boots are wet and have been for some time.',
  'Somewhere, a bell, or a cow. Hard to say.',
  'Leaves, a few at a time, deciding.',
  'You could stay here. You are not going to.',
  'Stone holding yesterday\'s warmth, badly.',
  'A gnat in the lantern-light, going round.',
  'The road ticks as it cools too. That cannot be right.',
  'Someone has swept this. Recently.',
  'Woodsmoke, and you cannot see the house it belongs to.',
  'An old wall doing nothing in particular.',
  'The quiet here is only quiet. That is worth knowing.',
]);

export const HOLLOW_OBSERVATIONS = Object.freeze([
  'Cold air coming up, smelling of wet stone.',
  'Water, a long way down, still going.',
  'The dark here has a grain to it.',
  'Your light stops sooner than it should.',
  'Something moved. Something is always moving.',
  'A draught, which means a way out, which means a way in.',
  'Dust, undisturbed, except where it is not.',
  'The walls hold the shape of hands that laid them.',
  'You can hear your own heart and you would rather not.',
  'A smell of cooking, four hundred years stale.',
]);

export const WEATHER_LINES = Object.freeze({
  clear: ['The sky is doing nothing, beautifully.', 'Clear. You can see the next hill.'],
  overcast: ['Cloud, low and grey, with no intention of raining.', 'Flat light. Everything looks further away.'],
  rain: ['Rain, steady, in for the afternoon.', 'Rain finds the gap in your collar immediately.'],
  fog: ['Fog. The world is twelve paces wide.', 'Fog, and things in it that are probably gorse.'],
  snow: ['Snow, small and dry, settling.', 'Snow. Your tracks go back a long way.'],
  still: ['The air has stopped. Nothing is making a sound, including you.', 'Still. Too still. This is the Quiet\'s weather.'],
});

export const QUIET_LINES = Object.freeze([
  'The colour is going out of things here.',
  'You cannot quite hold on to the name of this place.',
  'Something here has forgotten what it was for.',
  'The Quiet is thick enough to see.',
]);

export const WAKE_LINES = Object.freeze([
  'You wake at the hearth. It is later than it was.',
  'You come back to yourself somewhere warm. Something is missing.',
  'Waking. The lantern is out. You are not where you fell.',
]);

/**
 * Combat log verbs, by damage band, in the base form. `conjugate` puts the
 * third-person 's' on for everyone who is not you.
 */
export const HIT_VERBS = Object.freeze({
  light: ['catch', 'clip', 'scrape', 'nick'],
  solid: ['hit', 'strike', 'land on', 'cut'],
  heavy: ['stave in', 'open up', 'break', 'drive through'],
});

/** "you cut" but "the wolf cuts"; "you catch" but "it catches". */
export function conjugate(phrase, isPlayer) {
  if (isPlayer) return phrase;
  const [verb, ...rest] = phrase.split(' ');
  const s = /(ch|sh|s|x|z)$/.test(verb) ? verb + 'es' : verb + 's';
  return [s, ...rest].join(' ');
}

export const DEATH_LINES = Object.freeze({
  beast: ['goes down and stays down.', 'stops.', 'folds up.'],
  folk: ['sits down, and then lies down.', 'says something you do not catch, and is quiet.'],
  drowned: ['comes apart like wet paper.', 'goes back to being water.'],
  stone: ['comes down in pieces.', 'grinds once, and stops.'],
  root: ['unwinds and does not wind back.', 'goes slack.'],
  swarm: ['scatters and does not reform.', 'thins out to nothing.'],
  forgotten: ['forgets the last thing it was holding on to.', 'lets go of the shape it had.'],
  warden: ['kneels, and the kneeling takes a long time.', 'stops being in the way.'],
});

/** Long Thread fragment texts, bound to a generated forgotten settlement. */
export const LEDGER_TEXTS = Object.freeze([
  'A list of names, in one hand, with a line through each. The last line is unfinished.',
  'An account of oil bought, per month, for eleven years. Then nothing.',
  'Instructions for the round: which lantern, in which order, and how long to stand at each.',
  'A note: "They have agreed. We start at the new moon. It will be better for the children."',
  'A page torn from something else. It says only: "and we asked to be let alone, and we were."',
]);

/** Prompts and UI strings. */
export const UI_TEXT = Object.freeze({
  title: 'LANTERNWAKE',
  tagline: 'The lights have been going out.',
  seedHint: 'Seeds ignore punctuation and case.',
  newGame: 'Walk out',
  continueGame: 'Continue',
  noSave: 'No journey in progress',
  darkWarning: 'Your lantern is out. You can still walk.',
  encumbered: 'You are carrying too much.',
  wakeWarn: 'You are badly hurt. Waking costs time you may not have.',
});

/** Reasons a need exists. Bound to a real NPC value. */
export const NEED_REASONS = Object.freeze({
  craft: ['I can\'t work without it.', 'The whole job stops on that one thing.', 'It\'s my hands\' fault, not the tool\'s, but still.'],
  family: ['It was my mother\'s.', 'It\'s for the child.', 'I promised, and I don\'t break those.'],
  safety: ['We can\'t sleep with it out there.', 'Someone will get hurt.', 'I\'ve stopped letting them go that way.'],
  curiosity: ['I want to know. That\'s the whole reason.', 'Nobody will tell me, so I\'ll find out.'],
  custom: ['It\'s how it\'s done here.', 'We\'ve always done it and I\'m not stopping now.', 'The {festival} is coming.'],
  secret: ['Don\'t ask me why.', 'I\'d rather not say what it\'s for.'],
});
