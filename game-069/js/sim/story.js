/**
 * story.js — the cast and every scene of the story. A scene is a list of [speaker, line, mood];
 * `{name}` is replaced with the player's name. main.js decides when a scene plays (see TRIGGERS)
 * and marks it seen in the profile so it plays once.
 *
 * The plot: thirty years ago Gus Halloway lost the Dirt Crown when Victor Ravenwood cut the infield
 * on the last lap and the judges looked away. Now Ravenwood Motors has bought every dirt track in
 * the county and wants the Crown to be "invitation only". The old charter says whoever wins the Crown
 * sets the rules for the tracks, so Victor needs his son Colt to win. Gus's grandkid pulls the tarp
 * off his first racer, the Bucket: tiny, primer-grey and without a single feature.
 */

export const CAST = {
    you:    { name: '{name}', role: 'Rookie racer', color: '#f5c518' },
    gus:    { name: 'Grandpa Gus', role: 'Gus Halloway, retired legend', color: '#d9a62e' },
    june:   { name: 'June Ortiz', role: 'Mechanic, Halloway\'s Garage', color: '#3bbd9b' },
    colt:   { name: 'Colt Ravenwood', role: 'The rival', color: '#e0b23c' },
    victor: { name: 'Victor Ravenwood', role: 'Owner, Ravenwood Motors', color: '#b0b4bc' },
    rex:    { name: 'Rowdy Rex', role: 'Voice of the dirt', color: '#ff7a3a' },
    earl:   { name: 'Big Earl Pruitt', role: 'King of the Flats', color: '#d8503a' },
    fern:   { name: 'Fern Calloway', role: 'Ranger of the Ridge', color: '#5fbf6a' },
    sal:    { name: '"Sidewinder" Sal', role: 'Canyon daredevil', color: '#ff9a3a' },
    gator:  { name: 'Gator Boudreaux', role: 'Mud King of the Bayou', color: '#9acb4a' },
    ivanka: { name: 'Ivanka Volkova', role: 'The Ice Queen', color: '#8ad0ff' },
    max:    { name: 'Max Volt', role: 'Showman of the Thunderdome', color: '#d07aff' },
};

export const SCENES = {
    prologue: {
        title: 'The Bucket', bg: 'garage',
        lines: [
            ['gus', 'Thirty years that tarp\'s sat in the corner, {name}. Go on. Pull it off.', 'grin'],
            ['june', '...Gus, that is a lawnmower with a seat bolted on.', 'shock'],
            ['gus', 'That is the Bucket. My first racer, before I ever had a sponsor. Featureless as a potato and twice as tough.', 'happy'],
            ['june', 'No paint. No exhaust. Tyres like doughnuts. It hasn\'t got a single feature!', 'neutral'],
            ['gus', 'Features are earned, June. You win races, you win coins, you buy parts. That\'s how the dirt works.', 'grin'],
            ['rex', '...and it\'s official, folks! Ravenwood Motors has bought every dirt track in the county. Victor Ravenwood says this year\'s Dirt Crown is "by invitation only". His boy Colt is the favourite, naturally!', 'happy'],
            ['gus', 'Ravenwood. Thirty years ago Victor cut the infield on the last lap of the Crown Run. The judges looked the other way, and I never raced again.', 'sad'],
            ['gus', 'There\'s an old charter, older than Ravenwood money: whoever wins the Crown sets the rules for every track in the county. That\'s why Victor needs Colt to win.', 'neutral'],
            ['you', 'Then we take it back. Every track, every cup, all the way to the Crown.', 'grin'],
            ['june', 'Then you\'re gonna need a mechanic. And coins. Lots of coins.', 'grin'],
            ['gus', 'The Rookie Cup is out at Dustwater Flats. Anybody can enter there. Even a Bucket.', 'happy'],
        ],
    },
    colt1: {
        title: 'The Heir', bg: 'flats',
        lines: [
            ['colt', 'Nice lawnmower. Does it come in "fast"?', 'smug'],
            ['you', 'It comes in "about to pass you".', 'grin'],
            ['colt', 'Colt Ravenwood. You\'ve seen the billboards. Look, the Rookie Cup is cute, but the Crown is for real racers.', 'smug'],
            ['you', 'See you at the Crown, then.', 'neutral'],
            ['colt', 'Ha! Sure. If you can get that thing past the barnyard.', 'smug'],
            ['rex', 'Welcome to Dustwater, folks! Remember: hold the drift button through the bends to fill your nitro, and fly off those jumps to fill it faster!', 'happy'],
        ],
    },
    'pre-earl': {
        title: 'King of the Flats', bg: 'flats',
        lines: [
            ['earl', 'Well, butter my biscuits. The Halloway kid in Gus\'s old Bucket!', 'happy'],
            ['earl', 'I raced your granddaddy back when these fields were all dirt. They\'re still all dirt. Let\'s see what you\'ve got.', 'grin'],
        ],
    },
    'post-earl': {
        title: 'Fair and Square', bg: 'flats',
        lines: [
            ['earl', 'Hoo-wee! Beat fair and square. Tell Gus that Big Earl says howdy.', 'happy'],
            ['earl', 'Ravenwood men tried to buy my farm last spring. Told \'em where they could park their money. Pinecrest\'ll let you race on my say-so.', 'grin'],
            ['colt', 'So you beat a farmer. Congratulations. Pinecrest won\'t be a hayride.', 'smug'],
            ['june', 'Pinecrest is all loam and mud. Better tyres and suspension would help out there.', 'neutral'],
        ],
    },
    'pre-fern': {
        title: 'Ranger of the Ridge', bg: 'woods',
        lines: [
            ['fern', 'Ranger Calloway. These woods have rules. Stay on the trail. Respect the mud. And never, ever brake on a crest.', 'neutral'],
            ['fern', 'One on one, three laps, Pinecone Trail backwards. Try to keep up.', 'grin'],
        ],
    },
    'post-fern': {
        title: 'The Charter', bg: 'woods',
        lines: [
            ['fern', 'You read the trail like a ranger. I\'m impressed.', 'happy'],
            ['fern', 'Ravenwood wants to log this whole valley for a car factory. If you win the Crown, maybe someone will finally listen.', 'sad'],
            ['gus', 'Fern\'s right. The Crown isn\'t just a trophy. The champion makes the rules, and Victor knows it.', 'neutral'],
            ['rex', 'Next stop: Redrock Canyon, where the jumps are big and the sun never quite sets!', 'happy'],
        ],
    },
    'pre-sal': {
        title: 'Canyon Daredevil', bg: 'canyon',
        lines: [
            ['sal', '"Sidewinder" Sal! Fourteen broken bones and ZERO regrets!', 'grin'],
            ['sal', 'Ever jumped a canyon, kid? Hold the throttle on the lip, hands off the brake, and let the dirt catch you.', 'happy'],
        ],
    },
    'post-sal': {
        title: 'A Loose Fuel Line', bg: 'garage',
        lines: [
            ['sal', 'WOOO! Now THAT was air! Hey, watch your back at the bayou. Some Ravenwood boys have been asking about your car.', 'grin'],
            ['june', 'Someone was in the garage last night. Nothing\'s missing, but the Bucket\'s fuel line had been loosened.', 'angry'],
            ['gus', 'That\'s Victor\'s playbook, all right. We lock the doors from now on.', 'angry'],
            ['you', 'Let him try. We\'re not stopping.', 'angry'],
        ],
    },
    'pre-gator': {
        title: 'Mud King', bg: 'bayou',
        lines: [
            ['gator', 'Mais, look who come down to the bayou! Gator Boudreaux, cher.', 'grin'],
            ['gator', 'Down here the mud decides who wins. Me, I just help it along. Mind the crossroads bridge. She creaks, but she holds.', 'happy'],
        ],
    },
    'post-gator': {
        title: 'Night Practice', bg: 'bayou',
        lines: [
            ['gator', 'You drive that mud like you was born in it! Here\'s a secret for you.', 'happy'],
            ['gator', 'That Ravenwood boy comes down here at night to practise. Alone. Drives like somebody\'s watching him all the time.', 'neutral'],
            ['colt', '...What are you doing here? Dad says you\'re a "nuisance". He\'s never called anybody that who wasn\'t fast.', 'sad'],
            ['colt', 'Forget I said that. See you in the snow.', 'smug'],
        ],
    },
    'pre-ivanka': {
        title: 'The Ice Queen', bg: 'frost',
        lines: [
            ['ivanka', 'Ivanka Volkova. On ice, there is no lying. The car tells the truth, or it slides into the snow.', 'neutral'],
            ['ivanka', 'Show me your truth.', 'smug'],
        ],
    },
    'post-ivanka': {
        title: 'An Offer', bg: 'frost',
        lines: [
            ['ivanka', 'Your truth is fast. Good.', 'happy'],
            ['ivanka', 'Victor Ravenwood offered me a fortune to lose today. I told him nyet. I think he will make you an offer next.', 'neutral'],
            ['victor', '{name}. Victor Ravenwood. Let\'s be adults about this. Name a number.', 'smug'],
            ['victor', 'Walk away from the Crown, and Gus\'s little garage never sees another bill.', 'smug'],
            ['you', 'The garage isn\'t for sale. Neither am I.', 'angry'],
            ['victor', 'Everything is for sale. You just haven\'t heard the right price.', 'angry'],
        ],
    },
    'pre-max': {
        title: 'Night of Thunder', bg: 'dome',
        lines: [
            ['max', 'LADIES AND GENTLEMEN! It\'s MAAAAX VOLT!', 'grin'],
            ['max', 'Twenty thousand fans, kid! Smile for the jumbotron, and try not to land on my pyrotechnics.', 'happy'],
        ],
    },
    'post-max': {
        title: 'Every Champion', bg: 'dome',
        lines: [
            ['max', 'You stole my show! I LOVE it!', 'happy'],
            ['max', 'Next up is the Crown Qualifier at Ravenwood Speedway. Every champion you beat will be on that grid, and we all want to see Ravenwood lose.', 'grin'],
            ['gus', 'Every champion on one grid, and then the Crown Run. Thirty years, {name}. Thirty years.', 'sad'],
            ['june', 'Then let\'s make this the best car in the county. Spend every coin.', 'grin'],
        ],
    },
    'pre-qual': {
        title: 'The Qualifier', bg: 'mesa',
        lines: [
            ['rex', 'Welcome to Ravenwood Speedway for the CROWN QUALIFIER! A grid full of champions, and one Halloway!', 'happy'],
            ['earl', 'No hard feelings out there, kid. But I\'m not giving it to you.', 'grin'],
            ['sal', 'Last one to the first turn buys the tacos!', 'grin'],
            ['rex', 'Finish on the podium and you\'re in the Dirt Crown against Colt Ravenwood!', 'happy'],
        ],
    },
    'post-qual': {
        title: 'Real', bg: 'mesa',
        lines: [
            ['colt', 'So it\'s you and me.', 'neutral'],
            ['colt', 'Listen. Dad\'s had his crew oiling the outside of the bends on the Crown Run and digging out the landing of the big gully jump. Not for me. For you.', 'sad'],
            ['you', 'Why are you telling me this?', 'shock'],
            ['colt', 'Because if I win, I want it to be real. Just once.', 'neutral'],
        ],
    },
    'pre-final': {
        title: 'The Dirt Crown', bg: 'mesa',
        lines: [
            ['gus', 'The Crown Run. I\'ve driven it in my sleep for thirty years. That kicker before the gully is where Victor cut me off.', 'neutral'],
            ['gus', 'Stay on the road, keep it pinned, and {name}... have fun out there.', 'happy'],
            ['june', 'She\'s as good as I can make her. The rest is you.', 'grin'],
            ['rex', 'LADIES AND GENTLEMEN, THE DIRT CROWN! Colt Ravenwood in the Ravenwing, and {name} Halloway in a car that used to be a Bucket!', 'happy'],
        ],
    },
    ending: {
        title: 'The Crown Comes Home', bg: 'mesa',
        lines: [
            ['rex', '{name} HALLOWAY WINS THE DIRT CROWN! The Bucket has done it! I am out of breath, folks!', 'happy'],
            ['colt', 'Good race. The best I\'ve ever had.', 'happy'],
            ['victor', 'This isn\'t over.', 'angry'],
            ['colt', 'Yes, it is, Dad. The charter is clear. The champion sets the rules.', 'neutral'],
            ['you', 'Then here\'s the rule: every track in the county is open to everyone. Rookies, farmers, rangers, daredevils. Even Ravenwoods.', 'happy'],
            ['colt', 'Even Ravenwoods? ...I\'d like that.', 'happy'],
            ['gus', 'Thirty years I waited to see that crown come home. Turns out I was waiting for you, kid.', 'sad'],
            ['june', 'So, same time next season? I\'ve got ideas for a V12.', 'grin'],
        ],
    },
    'lose-final': {
        title: 'Not Yet', bg: 'garage',
        lines: [
            ['gus', 'Shake it off. I lost this race once and quit for thirty years. Don\'t you dare do the same.', 'neutral'],
            ['june', 'Back to the garage. Let\'s find you a few more horses and run it again.', 'grin'],
        ],
    },
};

// When scenes play: before the first attempt at an event, and after its first clear.
export const TRIGGERS = {
    before: { 'flats-1': 'colt1', 'flats-4': 'pre-earl', 'woods-4': 'pre-fern', 'canyon-4': 'pre-sal', 'bayou-4': 'pre-gator', 'frost-4': 'pre-ivanka', 'dome-4': 'pre-max', 'crown-1': 'pre-qual', 'crown-2': 'pre-final' },
    after:  { 'flats-4': 'post-earl', 'woods-4': 'post-fern', 'canyon-4': 'post-sal', 'bayou-4': 'post-gator', 'frost-4': 'post-ivanka', 'dome-4': 'post-max', 'crown-1': 'post-qual', 'crown-2': 'ending' },
    lose:   { 'crown-2': 'lose-final' },
};

// Rowdy Rex on the PA as the race starts.
export const REX_LINES = {
    flats: ['Dust in the air and corn in the stands, folks!', 'Big Earl\'s cows are watching. Don\'t disappoint the cows!', 'The Rookie Cup! Where legends start and mufflers fall off!'],
    woods: ['Mind the mud, and mind the trees: the trees don\'t move!', 'Pinecrest Woods! Smell that pine! Smell that clutch!', 'Blind crests ahead, folks. Fortune favours the brave and the lucky.'],
    canyon: ['Redrock Canyon at sundown! Somebody\'s going to fly today!', 'Big air, red dirt, sore backs!', 'Keep it straight on the lip and let gravity do the rest!'],
    bayou: ['The gators are out tonight, cher! Stay on the road!', 'Lantern light and deep mud! Bayou racing at its finest!', 'Hit that water fast or you\'ll be fishing for your bumper!'],
    frost: ['Frostbite Pass! Ice, snow and frozen eyebrows!', 'On the ice, gentle hands! Gentle hands!', 'It is COLD up here, folks. The engines are the only warm things on the mountain!'],
    dome: ['TWENTY THOUSAND FANS! MAKE SOME NOISE!', 'Under the lights at the Thunderdome! Supercross, baby!', 'Rhythm sections, tabletops and fireworks! What a night!'],
    mesa: ['Ravenwood Mesa! Where the Crown is won and lost!', 'Every kind of dirt, every kind of air! It\'s the Crown Run!', 'The whole county is watching this one!'],
};

export function fillName(text, name) { return text.replace(/\{name\}/g, name); }
