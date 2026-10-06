// Every line of dialogue. A scene is a list of [speaker, mood, text]; {name} is the hero's name.
// Speakers map to characters in the view (portraits and voices). Moods: normal, happy, surprised,
// angry, sad, smug.
//
// Triggers (checked by main.js against profile.flags):
//   prologue        after the hero creator
//   intro:<realm>   before the first hole of a realm
//   boss:<realm>    before the boss hole
//   win:<realm>     after beating the boss hole
//   phase2          mid-hole, when Lord Bogey transforms
//   ending          after the last hole

export const SPEAKERS = {
    hero: { name: '{name}', voice: 1.0 },
    wedge: { name: 'Wedgewick', voice: 0.7 },
    queen: { name: 'Queen Birdie', voice: 1.25 },
    eagle: { name: 'Old Man Eagle', voice: 0.6 },
    bogey: { name: 'Lord Bogey', voice: 0.5 },
    fescue: { name: 'Fescue', voice: 1.2 },
    zeph: { name: 'Zephyrine', voice: 1.1 },
    yodel: { name: 'Yodel', voice: 0.75 },
    cinder: { name: 'Cinder', voice: 0.95 },
    albatross: { name: 'Lady Albatross', voice: 1.05 },
    gopher: { name: 'Grubbins', voice: 0.85 },
    worm: { name: 'Duneborn', voice: 0.4 },
    yeti: { name: 'Big Frosty', voice: 0.45 },
    ogre: { name: 'Double Bogey', voice: 0.55 },
    dragon: { name: 'Triple Bogey', voice: 0.35 },
};

export const SCENES = {
    prologue: {
        title: 'The Club in the Stone', stage: 'clubhouse', cast: ['queen', 'bogey', 'hero', 'wedge'],
        lines: [
            ['queen', 'happy', 'Welcome, one and all, to the Festival of the First Tee! Today we celebrate the shot that started the world!'],
            ['queen', 'happy', 'And our Golden Tee has never looked shinier. {name}, dear, a little to the left with that polish.'],
            ['hero', 'happy', 'Yes, Your Majesty! Shiny as a sunrise!'],
            ['bogey', 'angry', 'HOW TOUCHING. A festival. For a game nobody can play properly.'],
            ['queen', 'surprised', 'Lord Bogey! You were banned from the Clubhouse three hundred years ago!'],
            ['bogey', 'smug', 'And I have been practising ever since. Not golf. Curses.'],
            ['bogey', 'angry', 'If I can never make par, then NOBODY shall! Golden Tee — SHATTER!'],
            ['queen', 'sad', 'The Tee! Five shards, flying to the five realms… and every hole in the land is cursed!'],
            ['bogey', 'smug', 'My champions guard the shards. Do enjoy your bogeys. Mwahaha— ow, my hat.'],
            ['hero', 'surprised', 'Whoa — I tripped on… a golf club? Stuck in a rock?'],
            ['wedge', 'angry', 'Do you MIND? Three centuries of peace and quiet, and now somebody pulls me out by the grip!'],
            ['hero', 'surprised', 'The club is talking!'],
            ['wedge', 'smug', 'Wedgewick the Wise, formerly Archmage of the Greens. I lost a bet. Long story. Bad lie.'],
            ['queen', 'happy', 'A talking wedge from the stone! It is a sign! {name}, I dub you Royal Caddie-Knight!'],
            ['hero', 'happy', 'Me? I have never played a real round!'],
            ['wedge', 'normal', 'Then you will learn on the way. Five shards, five realms. Try not to slice me into a pond.'],
            ['wedge', 'happy', 'One more thing: I still know a spell. MULLIGAN. If you botch a shot, I can rewind it. For a little magic.'],
        ],
    },
    'intro:0': {
        title: 'Meadowmere', stage: 'meadow', cast: ['fescue', 'hero', 'wedge'],
        lines: [
            ['fescue', 'sad', 'Oh, thank goodness, a golfer! My meadows are full of holes — and not the nice kind with flags in.'],
            ['fescue', 'normal', 'The Gopher King has taken over the old course. Grubbins. He says a sorcerer promised him all the golf balls he could eat.'],
            ['wedge', 'normal', 'Let us start gently, {name}. Aim, choose a club, then the swing: press once to start, again for power, and once more in the sweet spot.'],
            ['wedge', 'happy', 'Hit it in the glowing zone for a PERFECT strike. Bonk the slimes for experience. Roll through coins. Simple!'],
        ],
    },
    'boss:0': {
        title: 'Burrow Royale', stage: 'meadow', cast: ['gopher', 'hero', 'wedge'],
        lines: [
            ['gopher', 'angry', 'WHO dares tee off on MY royal green? I am Grubbins, King of Gophers, Lord of the Underlawn!'],
            ['hero', 'normal', 'Please give back the Tee Shard. The whole kingdom needs it.'],
            ['gopher', 'smug', 'Never! Lord Bogey promised me ALL the golf balls I can eat! Which is a lot! I have a big tummy!'],
            ['wedge', 'normal', 'The cup is sealed by Bogey magic, {name}. Bonk the king with your ball when he pops up, and the seal will break.'],
        ],
    },
    'win:0': {
        title: 'The First Shard', stage: 'meadow', cast: ['gopher', 'fescue', 'hero', 'wedge'],
        lines: [
            ['gopher', 'sad', 'Ow. Ow. Okay. You win. Golf balls are actually very hard to chew.'],
            ['gopher', 'sad', 'Here, take the shiny shard. Sorry about the holes. I will fill them in. Mostly.'],
            ['fescue', 'happy', 'The sheep are dancing! Well, they are standing in a happier way. Thank you, {name}!'],
            ['wedge', 'surprised', 'Hold on… the shard is jogging my memory. A spell! GUST WARD — your next shot ignores the wind entirely.'],
            ['wedge', 'normal', 'Next stop, the Sandsea Dunes. Pack sunscreen. I burn easily. I am made of metal.'],
        ],
    },
    'intro:1': {
        title: 'Sandsea Dunes', stage: 'sand', cast: ['zeph', 'hero', 'wedge'],
        lines: [
            ['zeph', 'normal', 'Ho, travellers! Zephyrine, master of the Last Caravan. Our oasis is drying, and the sand moves wrong.'],
            ['zeph', 'sad', 'Something long and hungry coils under the old course. We call it Duneborn.'],
            ['wedge', 'normal', 'Sand traps plug the ball, and quicksand stops it dead. And the wind out here is no joke. Watch the flag.'],
            ['hero', 'happy', 'Watch the flag. Got it. Also: hydrate.'],
        ],
    },
    'boss:1': {
        title: 'The Sunken Coil', stage: 'sand', cast: ['worm', 'hero', 'wedge'],
        lines: [
            ['worm', 'angry', 'SSSSHHHHHRRRRR…'],
            ['hero', 'surprised', 'It is so BIG!'],
            ['wedge', 'normal', 'Its coils will bounce your ball away. Only its head counts. Time your shot as it surfaces!'],
        ],
    },
    'win:1': {
        title: 'The Second Shard', stage: 'sand', cast: ['zeph', 'worm', 'hero', 'wedge'],
        lines: [
            ['worm', 'sad', '…hrrrm. Ssssorry. Bogey sssaid the oasis would be mine. It is very itchy, being cursed.'],
            ['zeph', 'happy', 'The springs are flowing again! The caravan will sing of {name} for a hundred years!'],
            ['wedge', 'happy', 'And another spell comes home: FIREBALL. Your ball burns through trees and ice — and bosses really feel it.'],
        ],
    },
    'intro:2': {
        title: 'Frostpeak', stage: 'frost', cast: ['yodel', 'hero', 'wedge'],
        lines: [
            ['yodel', 'normal', 'Yoo-hoo! Old Yodel, hermit of the high slopes. You will want warmer socks, little knight.'],
            ['yodel', 'sad', 'The Yeti sits on the summit throne and roars at every golfer. Nobody has played through in years.'],
            ['wedge', 'normal', 'Ice: the ball barely stops. Snowdrifts: it barely starts. Hit soft on the ice, {name}.'],
        ],
    },
    'boss:2': {
        title: "Yeti's Throne", stage: 'frost', cast: ['yeti', 'hero', 'wedge'],
        lines: [
            ['yeti', 'angry', 'GO AWAY! THIS IS MY MOUNTAIN! NOBODY PLAYS HERE!'],
            ['hero', 'normal', 'Why not? It is a lovely course.'],
            ['yeti', 'sad', '…BECAUSE NOBODY EVER ASKS ME TO PLAY! GRRAAAH!'],
            ['wedge', 'normal', 'Ice walls guard him. Two hits breaks a wall, a Fireball melts one outright — or lob the ball right over.'],
        ],
    },
    'win:2': {
        title: 'The Third Shard', stage: 'frost', cast: ['yeti', 'yodel', 'hero', 'wedge'],
        lines: [
            ['yeti', 'sad', 'You… you played all the way up here. Just to see me.'],
            ['hero', 'happy', 'Next time we play a round together. Deal?'],
            ['yeti', 'happy', 'DEAL! HERE IS SHINY ROCK! FRIEND!'],
            ['wedge', 'happy', 'FROST STEP! Your ball freezes water and lava beneath it and skates right across. Handy where we are going.'],
        ],
    },
    'intro:3': {
        title: 'Cinder Caldera', stage: 'cinder', cast: ['cinder', 'hero', 'wedge'],
        lines: [
            ['cinder', 'angry', 'My forge is out. Out! Two heads, one ogre, sitting on my lava like a hen on an egg.'],
            ['cinder', 'normal', 'Smith Cinder, by the way. If you get the shard back, I will forge you something nice.'],
            ['wedge', 'normal', 'Lava is a hazard, like water but rude. And the geysers blow on a rhythm. Land on one as it erupts and… whee.'],
        ],
    },
    'boss:3': {
        title: 'Double Trouble', stage: 'cinder', cast: ['ogre', 'hero', 'wedge'],
        lines: [
            ['ogre', 'angry', 'LEFT HEAD: We crush the tiny golfer!'],
            ['ogre', 'smug', 'RIGHT HEAD: We could also just… let them through? I am tired.'],
            ['ogre', 'angry', 'LEFT HEAD: We do NOT agree on this!'],
            ['wedge', 'normal', 'Two heads up on that ledge, {name}. You will need loft. The wedge. That is me. Hello.'],
        ],
    },
    'win:3': {
        title: 'The Fourth Shard', stage: 'cinder', cast: ['ogre', 'cinder', 'hero', 'wedge'],
        lines: [
            ['ogre', 'sad', 'LEFT HEAD: Ow. RIGHT HEAD: Told you.'],
            ['cinder', 'happy', 'The forge is roaring again! I will put the Dragonbone clubs in the Pro Shop for you.'],
            ['wedge', 'happy', 'SEEKER! The ball curves toward the cup as it gets close. Only one shard left, {name}. The one Bogey keeps.'],
        ],
    },
    'intro:4': {
        title: 'The Sky Citadel', stage: 'sky', cast: ['albatross', 'hero', 'wedge'],
        lines: [
            ['albatross', 'normal', 'Lady Albatross of the Sky Guard. I will fly you to the Citadel, but I cannot fight a sorcerer.'],
            ['albatross', 'sad', 'Up there the islands float over nothing. Overshoot and your ball falls right off the world.'],
            ['wedge', 'normal', 'Strange. This place… I know these clouds. I played here once. A long, long time ago.'],
        ],
    },
    'boss:4': {
        title: 'The Final Tee', stage: 'sky', cast: ['bogey', 'hero', 'wedge'],
        lines: [
            ['bogey', 'smug', 'So. The little caddie made it. And brought… is that a WEDGE?'],
            ['wedge', 'surprised', 'Bogart? Little Bogart, my apprentice? You took a fourteen on the first hole and ran off crying!'],
            ['bogey', 'angry', 'They LAUGHED, master! Everyone LAUGHED! So I will make sure nobody ever laughs at a scorecard again!'],
            ['hero', 'normal', 'Golf is not about the score. It is about the walk, and the friends, and the one good shot that brings you back.'],
            ['bogey', 'angry', 'SPARE ME! Break my shield if you can!'],
        ],
    },
    phase2: {
        title: 'Triple Bogey', stage: 'sky', cast: ['dragon', 'hero', 'wedge'],
        lines: [
            ['bogey', 'angry', 'ENOUGH! Shard of the Golden Tee — MAKE ME UNBEATABLE!'],
            ['dragon', 'angry', 'BEHOLD! I AM TRIPLE BOGEY! THREE HEADS! THREE TIMES THE BOGEYS!'],
            ['wedge', 'surprised', 'Fire, frost and storm. Each head gets a turn. Knock them all out, {name}!'],
        ],
    },
    ending: {
        title: 'The Golden Tee', stage: 'clubhouse', cast: ['queen', 'bogey', 'hero', 'wedge', 'eagle'],
        lines: [
            ['bogey', 'sad', 'Ugh. My head. Heads. Head. I lost. Again.'],
            ['hero', 'normal', 'You did not lose. You played! That was the best round of my life.'],
            ['bogey', 'surprised', 'You… enjoyed playing against me?'],
            ['queen', 'happy', 'The Golden Tee is whole again! And look — every flag in Fairhaven is waving!'],
            ['wedge', 'happy', 'Bogart, you were never bad at golf. You were just alone at it. Come and play with us.'],
            ['bogey', 'sad', 'I… would like that. Very much. Could I maybe… mow the greens? I am good with curses. Grass curses. Grows-faster curses.'],
            ['queen', 'happy', 'Then Lord Bogey is our new Royal Greenskeeper! And {name}, our Caddie-Knight, is Champion of Fairhaven!'],
            ['eagle', 'happy', 'Back in my day, a champion got a trophy. Today they get my best stock: the Starforged clubs are in the Pro Shop!'],
            ['wedge', 'smug', 'And I suppose being a club is not so bad. As long as you never, ever use me as a putter.'],
            ['hero', 'happy', 'Deal. Now — who wants to play a round?'],
        ],
    },
};

// Quick in-hole tips from Wedgewick, shown as a toast on the tutorial hole.
export const TIPS = {
    first: 'Aim with ← → (or drag). Press SPACE (or SWING) three times: start, power, accuracy.',
    perfect: 'Stop the marker in the glowing zone for a PERFECT strike!',
    green: 'On the green the putter rolls the ball. Gentle!',
    wind: 'See the flag? The wind pushes the ball in flight. Aim into it.',
    hazard: 'Splash! A stroke penalty, and you play again from where you were.',
    monster: 'Bonk! Monsters give experience and gold.',
    mulligan: 'Bad shot? Press 1 for MULLIGAN to rewind it.',
};

export const REALM_SHARD = ['Meadow Shard', 'Dune Shard', 'Frost Shard', 'Ember Shard', 'Star Shard'];
export const REALM_SPELL = ['ward', 'fire', 'frost', 'seek', null];
