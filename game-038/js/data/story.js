// ============================================================
// data/story.js - authored scenes (GDD 2)
// A scene is a list of lines and (sometimes) a choice. Choices set flags;
// flags are read by quests, by later scenes, and by the ending test.
// `who: null` is narration. `who: 'you'` is the Warden.
// ============================================================

export const SCENES = {
  intro: {
    id: 'intro', music: 'quiet',
    lines: [
      { who: null, text: 'Maerin Colde kept a hatchery under a hill for forty years, and an argument with the Concord of Ash for nearly as long. She lost the argument. She did not stop having it.' },
      { who: null, text: 'She has been dead a fortnight. The house is yours, the hill is yours, and so is the argument.' },
      { who: 'Tolm Brill', text: "She left the ledger open on the table, Warden. Last entry's a week before she went. Says: *the grey ones can be brought back, I have done it twice, nobody will write it down but me.*" },
      { who: 'Tolm Brill', text: "There's an egg in the warm room she never got to hatch. And there's a drake in the Guttering Roost that's been eating the light out of the valley since spring." },
      { who: 'you', text: 'Then I had better get on with it.' },
    ],
  },

  first_dragon: {
    id: 'first_dragon',
    lines: [
      { who: null, text: 'The warm room smells of old straw and hot stone. Something in the nearest nest is watching you with one eye open.' },
      { who: 'Tolm Brill', text: "She raised that one from a clutch out of the Low Fields. It's yours now, if it'll have you. They choose, mostly. She was firm about that." },
    ],
  },

  vale_ashbound: {
    id: 'vale_ashbound',
    lines: [
      { who: null, text: 'The grey dragon in the hollow does not react to you at all. That is the worst part. It is not hunting, or guarding, or angry. It has simply stopped being anything.' },
      { who: 'you', text: 'Maerin said the ash washes off.' },
      { who: null, text: '*Clearwater draught, or a Radiant voice saying the right name*, said the ledger, in handwriting that got worse toward the end. *Either works. Both hurt them. Do it anyway.*' },
    ],
  },

  cinderfang_pre: {
    id: 'cinderfang_pre',
    lines: [
      { who: null, text: 'The Guttering Roost is a chimney of black basalt with eleven hundred years of nesting in it and nothing nesting now.' },
      { who: 'Tolm Brill', text: "This is where she lost the last hatchling. She came back down carrying it and didn't say a word to anyone for four days." },
      { who: null, text: 'Somewhere above you, something drags itself over stone.' },
    ],
  },

  cinderfang_post: {
    id: 'cinderfang_post',
    lines: [
      { who: null, text: 'It lies in the ash it made. Under the grey its scales are the colour of a banked fire, and they have been that colour the whole time.' },
      { who: 'you', text: 'She was right.' },
      { who: null, text: 'A letter comes up from Saltley within the week: the Tide line is failing, the chorus-hall has gone quiet, and does the Broodwell still exist, and if so, would it consider coming.' },
    ],
    setAct: 2,
  },

  kessa_meet: {
    id: 'kessa_meet',
    lines: [
      { who: null, text: 'She is waiting at Tidewatch with her coat buttoned to the throat and a dragon behind her that has clearly been built rather than born.' },
      { who: 'Kessa Vane', text: "Warden of the Broodwell. I read Colde's papers. All of them, twice, which is twice more than the Concord did." },
      { who: 'Kessa Vane', text: "She was right about the ash. She was wrong about what happens if we let the Spire go out. Forty thousand people in Cindermarch heat their houses off that line." },
      { who: 'you', text: 'And the broods?' },
      { who: 'Kessa Vane', text: "Yes. That's the whole of it, isn't it. And the broods." },
    ],
  },

  morvaleth_pre: {
    id: 'morvaleth_pre',
    lines: [
      { who: null, text: 'The chorus-hall is under eleven feet of clear water and still, somehow, singing. The sound comes up through the soles of your boots before it reaches your ears.' },
      { who: null, text: 'They sang the Tide line here every evening for three hundred years, in shifts, so it was never not being sung. Then the Concord drew the line through the Spire, and there was nothing left to sing to, and they kept going anyway until the water came in.' },
    ],
  },

  morvaleth_post: {
    id: 'morvaleth_post',
    lines: [
      { who: null, text: 'The singing stops. In the quiet you can hear the hall dripping, and something under the floor letting go of something it had been holding.' },
      { who: 'Kessa Vane', text: "You'll want to come to Cindermarch now. I'd rather you saw it than imagined it." },
      { who: 'Kessa Vane', text: "I'll sign you through the Slag Gate. Don't thank me. I'm doing it because you're going to go anyway and I'd rather know where you are." },
    ],
    setAct: 3,
    give: ['concord_writ'],
  },

  cindermarch_arrive: {
    id: 'cindermarch_arrive',
    lines: [
      { who: null, text: 'Cindermarch is warm the way a body is warm. Nine furnaces, forty thousand people, and light in every window at three in the morning.' },
      { who: 'Kessa Vane', text: "Good. Now look up." },
      { who: null, text: 'The Spire goes up past where you can comfortably look. All five Emberlines come down out of the sky and into it, and none of them come out.' },
      { who: 'Kessa Vane', text: "That is a dragon in there. I've known since I was twenty-six. I have gone on lighting my kitchen with it every night since." },
    ],
  },

  kessa_fight_pre: {
    id: 'kessa_fight_pre',
    lines: [
      { who: 'Kessa Vane', text: '"You want me to unmake a hundred years of light on the word of a dead woman and a bag of eggs."' },
      { who: 'Kessa Vane', text: "I'm not going to stand aside and I'm not going to pretend that's a moral position. Show me you can hold what you're asking for." },
      { who: null, text: 'Aurex comes forward. It has three kinds of scale on it and none of them agree.' },
    ],
  },

  kessa_fight_post: {
    id: 'kessa_fight_post',
    lines: [
      { who: null, text: 'Aurex kneels. Kessa puts her hand flat on its neck and leaves it there a while.' },
      { who: 'Kessa Vane', text: "Right." },
      { who: 'Kessa Vane', text: "The Gale and the Stone lines are the thinnest. If you're going to do this you need keepers for both, and there aren't any left alive that remember how." },
      { who: 'you', text: 'Then I will make some.' },
      { who: 'Kessa Vane', text: "Yes. I thought you'd say that. Go up to Windward, and take this — the Riven Throne won't let you near it otherwise." },
    ],
    setAct: 4,
    give: ['riven_token', 'emberline_lens'],
  },

  peaks_arrive: {
    id: 'peaks_arrive',
    lines: [
      { who: 'Halla Keld', text: "Warden. You'll be wanting the Throne, and you'll be wanting it in the two hours before the afternoon wind." },
      { who: 'Halla Keld', text: "Ythrax has held that peak alone for ninety years. Not guarding anything. There's nothing up there. It just won't leave." },
    ],
  },

  ythrax_post: {
    id: 'ythrax_post',
    lines: [
      { who: null, text: 'It folds onto the stone, enormous and tired, and lets you get close enough to touch it.' },
      { who: null, text: 'You have a dragon with you that was born in your hatchery, out of two animals you chose, carrying a line that ended before you were born. Ythrax looks at it for a long time.' },
      { who: 'Halla Keld', text: "Well. That's the Gale line stood back up. There's one thing left and it's a hundred years down a stairwell." },
    ],
    setAct: 5,
    give: ['spire_pass'],
  },

  spire_descent: {
    id: 'spire_descent',
    lines: [
      { who: null, text: 'Eleven hundred steps. The light gets older the whole way down: white at the top, then yellow, then the colour of a lamp somebody forgot to put out.' },
      { who: 'Kessa Vane', text: "I've been down here twice. Both times I turned round at the eight hundredth step and told myself it was procedure." },
    ],
  },

  vaelorax_meet: {
    id: 'vaelorax_meet',
    lines: [
      { who: null, text: 'The chamber is not a furnace. It is a room built very carefully around a sleeping animal, and the animal has not been asleep for some time.' },
      { who: 'Vaelorax', text: '"Warden."' },
      { who: 'Vaelorax', text: '"You have been carrying my brood around in your pockets for a season. I have been listening. Some of them are very young. One of them is new — I felt it hatch. That was well done."' },
      { who: 'you', text: 'I came to let you out.' },
      { who: 'Vaelorax', text: '"I know. Say the rest of it."' },
      { who: 'you', text: 'And I do not know what happens to Cindermarch when I do.' },
      { who: 'Vaelorax', text: '"No. Neither do I. Come on, then. We will do this properly, and afterwards you will choose, and I will abide it."' },
    ],
  },

  ending_choice: {
    id: 'ending_choice',
    lines: [
      { who: null, text: 'The fire goes out of it slowly, the way you put down something heavy you have been holding for a hundred years.' },
      { who: 'Vaelorax', text: '"Now. The lines are loose and they will go somewhere. Say where."' },
    ],
    choices: [
      { id: 'unbind', text: 'Let them go. Free Vaelorax and let the cities learn to burn wood again.', flag: 'ending_unbind' },
      { id: 'rekindle', text: 'Split the five lines back out to the five broods I have restored.', flag: 'ending_rekindle', requires: 'canRekindle',
        locked: 'You would need one dragon of each Elder lineage, grown to Wyrm or better.' },
      { id: 'succession', text: 'Offer a dragon of my own brood, willingly, to hold the line in its place.', flag: 'ending_succession', requires: 'canSuccession',
        locked: 'You would need a dragon you bred yourself: third generation, Elder-grown, and bonded to you completely.' },
    ],
  },

  ending_unbind: {
    id: 'ending_unbind', ending: true, title: 'Unbound',
    lines: [
      { who: null, text: 'It takes nine seconds. The Spire does not fall; it simply stops being lit, which turns out to be a different and much quieter thing.' },
      { who: null, text: 'Cindermarch has a hard winter and then a harder one. Forty thousand people learn to bank a fire. Eleven of them write to you, and four of those letters are kind.' },
      { who: null, text: 'Vaelorax goes up through the roof of the world and does not come back for a year. When it does, it brings eleven others, and they nest on the old lines like nothing had happened, which is not the same as nothing having happened.' },
      { who: null, text: 'Maerin would have said you took too long about it. She would have been wrong, and she would have known she was wrong, and she would have said it anyway.' },
    ],
  },

  ending_rekindle: {
    id: 'ending_rekindle', ending: true, title: 'Rekindled',
    lines: [
      { who: null, text: 'You do it the slow way: five lines, five broods, one at a time, with a Warden standing at each and a dragon willing to hold it.' },
      { who: null, text: 'It takes three years. Cindermarch keeps its light at a quarter of what it had, which is enough, and there is a brood on the Ember line above the city that the children get taken up to see.' },
      { who: null, text: 'Kessa Vane runs the Concord now and has made herself extremely unpopular by insisting that dragons be counted in the census.' },
      { who: null, text: 'The Broodwell is full. You have had to dig out the hill.' },
    ],
  },

  ending_succession: {
    id: 'ending_succession', ending: true, title: 'Succession',
    lines: [
      { who: null, text: 'It is not a sacrifice. That is the part nobody outside the Broodwell ever understands. You ask, and it considers the question the way it considers everything, and it says yes, and it means it.' },
      { who: null, text: 'Vaelorax goes out into a sky it has not seen since before your grandmother. Your dragon takes the lines up, all five, the way a thing raised warm and fed by hand and never once lied to can.' },
      { who: null, text: 'The light over Cindermarch changes colour that night and stays changed. People notice within the hour. Within a month there are three separate arguments about what to call it.' },
      { who: null, text: 'You visit. Often. It always knows you are coming.' },
    ],
  },
};

export const scene = id => SCENES[id] || null;

/** People who hand out the authored side quests. */
export const NPCS = {
  tolm:  { id: 'tolm',  name: 'Tolm Brill',  node: 'broodwell',   blurb: "Maerin's neighbour. Feeds your dragons when you forget." },
  bryd:  { id: 'bryd',  name: 'Bryd Ashworth', node: 'hollowbridge', blurb: 'Keeps the inn on the bridge. Keeps the ledger too.' },
  ilsa:  { id: 'ilsa',  name: 'Ilsa Saltley', node: 'saltley',     blurb: 'Fourth Saltley to run the market and the first to admit it.' },
  kessa: { id: 'kessa', name: 'Kessa Vane',   node: 'cindermarch', blurb: 'Concord warden. The most honest person in the story.' },
  halla: { id: 'halla', name: 'Halla Keld',   node: 'windward',    blurb: 'Climbs for a living. Thinks you are being silly.' },
  darrow:{ id: 'darrow',name: 'Darrow Pell',  node: 'cindermarch', blurb: 'Forge-master. Will make anything, once, for parts.' },
};
