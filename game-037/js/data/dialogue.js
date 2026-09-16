// ============================================================
// data/dialogue.js - fact-bearing templates (GDD §13.7). APPEND ONLY.
// Organised intent -> warmth tier -> [templates]. Each template declares
// the slots it needs; the binder rejects any whose facts are unavailable.
// Rule 1: every line carries one concrete fact, or is <= 6 words.
// ============================================================

const t = (text, slots = [], verbosity = 2) => ({ text, slots, verbosity });

export const DIALOGUE = {
  greet: [
    [ // tier 0 - a stranger
      t('{greeting}'),
      t('Aye?'),
      t('You\'re not from {settlement}.', ['settlement']),
      t('{greeting} Mind the {decor} by the door.', ['greeting', 'decor']),
      t('I\'m {shortName}. You\'ll be passing through.', ['shortName']),
      t('Lantern-keeper, is it. We\'ve not had one in {settlement} for a while.', ['settlement']),
    ],
    [ // tier 1 - known
      t('{greeting} You again.'),
      t('{shortName}, if you\'ve forgotten. {trade}, when there\'s work.', ['shortName', 'trade']),
      t('Back from {region}, then?', ['region']),
      t('There\'s tea. It\'s not good tea.'),
      t('You look like the {region} road. Sit if you like.', ['region']),
    ],
    [ // tier 2 - warm
      t('Come in. The {prop} is lit.', ['prop']),
      t('I said to {other} you\'d be back.', ['other']),
      t('{greeting} There\'s {food} if you want it.', ['greeting', 'food']),
      t('You keep turning up. I don\'t mind it.'),
    ],
    [ // tier 3 - dear
      t('{playerName}. Sit down before you fall down.', ['playerName']),
      t('{playerName}. I kept you some {food}.', ['playerName', 'food']),
      t('There you are. I was going to send {other} looking.', ['other']),
    ],
  ],

  state_need: [
    [
      t('There\'s {object} wanting fetching out of {place}. I\'d go, but my knees.', ['object', 'place']),
      t('I need {object}. It\'s in {place}, or it was.', ['object', 'place']),
      t('If you\'re going near {place} — {object}. That\'s all.', ['place', 'object']),
      t('{object}, from {place}. I can pay, a little.', ['object', 'place']),
    ],
    [
      t('You\'ll be going past {place}. {object} is there, and it\'s mine.', ['place', 'object']),
      t('{reason} So: {object}, from {place}.', ['reason', 'object', 'place']),
      t('It\'s {object}. {place}. I\'d not ask if there was another way.', ['object', 'place']),
    ],
    [
      t('{reason} I\'d take it as a kindness. {object} — {place}.', ['reason', 'object', 'place']),
      t('You know {place}. {object} went down there with the rest of it.', ['place', 'object']),
    ],
    [
      t('{playerName}. {object}. {place}. You know what it means to me.', ['playerName', 'object', 'place']),
      t('{reason} Bring me {object} and I\'ll not ask you for anything else.', ['reason', 'object']),
    ],
  ],

  remind_need: [
    [
      t('{object}. Still.', ['object']),
      t('You\'ve not been to {place} yet, then.', ['place']),
      t('It\'ll still be in {place}.', ['place']),
    ],
    [
      t('{object}, when you can. No hurry that I can help.', ['object']),
      t('{place} hasn\'t moved.', ['place']),
    ],
    [
      t('{object}. I\'ve been thinking about it, is all.', ['object']),
      t('Whenever. But I do think about it.'),
    ],
    [
      t('{playerName} — {object}. Then I\'ll stop mentioning it.', ['playerName', 'object']),
    ],
  ],

  thank: [
    [
      t('That\'s the {object}. Right. Here.', ['object']),
      t('Well. That\'s that, then. Take this.'),
      t('You went to {place} for this. Take the coin.', ['place']),
    ],
    [
      t('{object}. I didn\'t think you\'d get it out of {place}.', ['object', 'place']),
      t('That\'s a weight off. Here — and tell {other} I said so.', ['other']),
    ],
    [
      t('{object}. Look at that. Look at it.', ['object']),
      t('That is a good turn done. Come by {settlement} again.', ['settlement']),
    ],
    [
      t('{playerName}. Thank you. Properly, I mean.', ['playerName']),
      t('I\'ll remember this when the {festival} comes round.', ['festival']),
    ],
  ],

  refuse: [
    [t('No.'), t('Not today.'), t('I\'ve nothing for you.')],
    [t('Not just now. Ask me after.'), t('I can\'t. Not with the {prop} as it is.', ['prop'])],
    [t('I would. I can\'t.'), t('Ask me tomorrow and I might say yes.')],
    [t('I\'m sorry, {playerName}. Not this.', ['playerName'])],
  ],

  gossip: [
    [
      t('{other} has not been out of the house in four days.', ['other']),
      t('They say the {hollow} is louder than it was.', ['hollow']),
      t('{other} is a {trade}, and a good one, and won\'t be told so.', ['other', 'trade']),
      t('The road to {region} is worse since the rain.', ['region']),
    ],
    [
      t('{other} and {other2} aren\'t speaking. Ask neither of them why.', ['other', 'other2']),
      t('The {hollow} took someone\'s dog. That\'s what they\'re saying.', ['hollow']),
      t('Nobody\'s lit the {hollow} since before I was here.', ['hollow']),
    ],
    [
      t('I\'ll tell you because it\'s you: {other} owes half the village.', ['other']),
      t('{other} goes up to {place} at night. I\'ve seen the light.', ['other', 'place']),
    ],
    [
      t('Between us, {playerName} — {other} is frightened, and hiding it badly.', ['playerName', 'other']),
    ],
  ],

  warn: [
    [
      t('Don\'t go into {hollow} without oil.', ['hollow']),
      t('{region} is older than here. Be careful in it.', ['region']),
      t('There\'s things on the {place} road after dark.', ['place']),
    ],
    [
      t('The air in {hollow} is wrong. Take a light and a way out.', ['hollow']),
      t('Stay on the road through {region}. I mean it.', ['region']),
    ],
    [
      t('If you go down {hollow}, come back up. That\'s the whole of my advice.', ['hollow']),
    ],
    [
      t('{playerName}. {hollow}. Come back out of it.', ['playerName', 'hollow']),
    ],
  ],

  grieve: [
    [t('We lost someone. That\'s all I\'ll say.')],
    [t('{other} is gone. Nobody says where.', ['other'])],
    [t('I keep laying a place for {other}. Force of habit.', ['other'])],
    [t('{playerName} — I can\'t remember their face now. That\'s the worst of it.', ['playerName'])],
  ],

  teach: [
    [
      t('{fact}', ['fact']),
      t('You\'ll want to know this: {fact}', ['fact']),
    ],
    [
      t('{fact} That\'s not common knowledge.', ['fact']),
    ],
    [
      t('I\'ll tell you what I know. {fact}', ['fact']),
    ],
    [
      t('{playerName}, listen. {fact}', ['playerName', 'fact']),
    ],
  ],

  trade: [
    [t('I sell. You look.'), t('Coin first, then talk.')],
    [t('Have a look. I\'ll not push you.'), t('{greeting} Come and see what came in.', ['greeting'])],
    [t('For you, a little off.'), t('Look properly. There\'s good stuff at the back.')],
    [t('{playerName}. Take what you need and we\'ll square it later.', ['playerName'])],
  ],

  smalltalk: [
    [
      t('Weather\'s turning.'),
      t('The {prop} wants mending and won\'t get it.', ['prop']),
      t('Long walk from {region}?', ['region']),
    ],
    [
      t('I was born in {settlement}. Never got further than {region}.', ['settlement', 'region']),
      t('My {trade}\'s slow this season. It\'s slow every season.', ['trade']),
    ],
    [
      t('{other} says I talk too much. {other} is not wrong.', ['other']),
      t('I like this time of day. The light off the {prop}.', ['prop']),
    ],
    [
      t('Sit a minute, {playerName}. Nothing needs doing this second.', ['playerName']),
    ],
  ],

  farewell: [
    [t('Mind how you go.'), t('Aye. Go on, then.')],
    [t('Don\'t be a stranger.'), t('Keep to the road.')],
    [t('Come back through {settlement}.', ['settlement']), t('Keep that lantern in oil.')],
    [t('Come back, {playerName}.', ['playerName']), t('Light it before dark. Promise me.')],
  ],
};

for (const k of Object.keys(DIALOGUE)) { for (const tier of DIALOGUE[k]) Object.freeze(tier); Object.freeze(DIALOGUE[k]); }
Object.freeze(DIALOGUE);

/** Voice tics, applied at most once per conversation. */
export const TICS = Object.freeze([
  'aye?', 'see.', 'mind.', 'is all.', 'that\'s the thing of it.', 'so.', 'as it were.',
  'if you follow.', 'and there it is.', 'more\'s the pity.',
]);

/** Response labels. Intent, not the literal line. */
export const RESPONSES = Object.freeze({
  ask_need: 'Ask what they need',
  accept: 'Take the work',
  decline: 'Not today',
  turn_in: 'Hand it over',
  gossip: 'Ask about the village',
  warn: 'Ask what is out there',
  trade: 'Trade',
  gift: 'Give something',
  teach: 'Ask what they know',
  leave: 'Leave',
  sit: 'Sit with them',
  choiceA: 'A', choiceB: 'B',
});
