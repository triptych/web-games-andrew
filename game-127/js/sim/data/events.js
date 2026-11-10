// Recurring events and conversation: birthdays, the spring audience, the Harvest Festival, Free Day chat
// with friends, and talking with the prince himself.

// ------------------------------------------------------------------ birthdays (Hatchmoon, age 11..17)
export const BIRTHDAY = (age) => [
    '@bg study', '@music manor', '@show cael.happy l',
    `n: Hatchmoon again. The prince is ${['', '', '', '', '', '', '', '', '', '', '', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen'][age]} today.`,
    ...(age === 11 ? ['cael.happy: Eleven! That\'s nearly twelve! Hobb, is it two cakes this year?', 'hobb: It is one cake, Your Highness, as every year, and as every year I shall be ignored.']
        : age === 12 ? ['cael.happy: Twelve. Lumi says that\'s ninety-one in dragon years. I feel ninety-one.', 'hobb: You look twelve, sir. Mostly in the frosting.']
        : age === 13 ? ['cael: Thirteen. My horns are getting heavy. Do you think they\'ll stop growing?', 'you: Your mother\'s didn\'t.', 'cael.happy: Then I\'ll need taller doors.']
        : age === 14 ? ['cael: Fourteen. Something\'s happening with my back. It itches all the time.', 'hobb: Growing pains, sir. I had them myself, though not, I think, of the same kind.']
        : age === 15 ? ['cael.happy: Fifteen! Can I have wine? Rowan\'s allowed wine. Pip has always been allowed wine. Pip allowed himself.', 'you: One cup.', 'hobb: Watered.']
        : age === 16 ? ['cael: Sixteen. Two years left before they judge me.', 'cael.happy: Let\'s not talk about it today. Let\'s just have cake.']
        : ['cael: Seventeen. One year. One more year, {you}, and then they decide.', 'cael: Whatever they say... I\'m glad it was you who raised me. I wanted to say it before. Just in case.']),
    '@fx sts-6 bond+2',
];

// ------------------------------------------------------------------ the spring audience (Bloommoon, age 11..16)
export const AUDIENCE = (fav) => [
    '@bg throne', '@music court', '@show king r', '@show cael l',
    'n: The spring audience. The prince stands before the King and the court, as he does every year, to be looked at.',
    ...(fav >= 55 ? ['king: Grandson. Come closer. The court tells me remarkable things about you this year. For once, I believe them.', 'n: There is applause. Real applause. The Duke does not join it.', '@fx fav+3 sts-4']
        : fav >= 30 ? ['king: The prince has grown. The court tells me he is diligent, and polite, and mostly does not set things on fire.', 'king: Continue.', '@fx fav+2']
        : ['king: The court has... concerns, Warden. I hear them every week. I cannot keep hearing them forever.', 'duke: Nor should you, Majesty.', 'n: The prince stares at the floor until it is over.', '@fx fav+1 sts+6']),
];

// ------------------------------------------------------------------ the Harvest Festival (Harvestmoon)
// Score = sum(stat * weight) + age bonus + luck; rivals have fixed scores that grow each year.
export const CONTESTS = [
    { id: 'tourney', name: 'The Squires\' Tourney', stats: { cmb: 0.6, str: 0.25, vit: 0.15 }, bg: 'festival', cg: 'fest-tourney',
        rivals: [['Rowan Hale', 'rowan', 14], ['Sir Gareth\'s nephew', null, 12], ['Isolde Varre', 'isolde', 16]],
        win: 'He unhorses the last challenger and the crowd chants for the dragon. Even the Duke\'s men clap.', lose: 'He is knocked from the saddle in the final pass, and climbs back up laughing.' },
    { id: 'arts', name: 'The Bards\' Contest', stats: { art: 0.65, cha: 0.35 }, bg: 'festival', cg: 'fest-arts',
        rivals: [['Saffi al-Rashid', 'saffi', 15], ['The Moonlit Theatre\'s prodigy', null, 14], ['Brother Aldo\'s choir', null, 11]],
        win: 'His song is about a boy who hatched from a coal. Nobody in the square has dry eyes when it ends.', lose: 'His voice cracks on the high note. The crowd is kind. Mostly.' },
    { id: 'ball', name: 'The Harvest Ball', stats: { grc: 0.6, cha: 0.4 }, bg: 'ballroom', cg: 'fest-ball',
        rivals: [['Isolde Varre', 'isolde', 16], ['Lord Penhallow\'s twins', null, 13], ['Saffi al-Rashid', 'saffi', 15]],
        win: 'He dances the Lantern Waltz with his wings half-spread like a cloak, and is crowned King of the Ball.', lose: 'His tail trips a duchess. She forgives him. The judges do not.' },
    { id: 'arcane', name: 'The Arcane Exhibition', stats: { mag: 0.65, int: 0.35 }, bg: 'spire', cg: 'fest-arcane',
        rivals: [['Theo Marchbank', 'theo', 15], ['An apprentice from the East', null, 13], ['The Spire\'s senior class', null, 14]],
        win: 'He paints a dragon of living fire across the night sky. It roars, and bows, and bursts into a thousand stars.', lose: 'His illusion is lovely, and also, unfortunately, on fire.' },
    { id: 'debate', name: 'The Lords\' Debate', stats: { elo: 0.6, int: 0.4 }, bg: 'court', cg: 'fest-debate', minAge: 12,
        rivals: [['Isolde Varre', 'isolde', 15], ['The Chancellor\'s clerk', null, 14], ['A Qasiri envoy', 'saffi', 13]],
        win: 'He argues that dragons should pay taxes. The dragons in the audience roar with laughter. He wins by acclaim.', lose: 'He loses the thread halfway through and never quite finds it again.' },
];
export const CONTEST = Object.fromEntries(CONTESTS.map((c) => [c.id, c]));

// ------------------------------------------------------------------ Free Day chat with friends
// Picked by age tier (young < 14 <= grown) and at random within the tier.
export const CHAT = {
    isolde: {
        young: ['isolde: Your posture is atrocious. Shoulders back. Tail... wherever tails go.', 'isolde: Father says I\'m not to speak to you. So I\'m not. This isn\'t speaking. This is criticising.', 'isolde: I beat three older boys at fencing today. They cried. I didn\'t gloat. Much.', 'isolde.happy: You can watch me practise. Quietly. From over there. ...A bit closer is fine.'],
        grown: ['isolde: The court has been saying things about you again. I\'ve been saying things back. With my sword, mostly.', 'isolde.happy: You came. Good. I was bored. I\'m always bored when you\'re not here, it\'s very inconvenient.', 'isolde: Don\'t look at me like that. People will talk. ...Let them.', 'isolde: Teach me to fly. No, I know I can\'t. Just... describe it again.'],
    },
    rowan: {
        young: ['rowan.happy: I did a hundred push-ups! Then I fell over! Then I did ten more!', 'rowan: Da says a knight should be brave, true and kind. I\'m working on kind. Brave\'s easy.', 'rowan.happy: Let\'s race to the castle gate! Loser carries the winner\'s shield!', 'rowan: Want to see my new bruise? It\'s shaped like a duck.'],
        grown: ['rowan: Patrolled the east wall all night. Saw you fly over at midnight. Showing off?', 'rowan.happy: My armour finally fits! Well, it fits better than the last one. That was Da\'s.', 'rowan: Whatever the court decides, you know where I\'ll be standing. Right behind you. Or in front. Depending on the arrows.', 'rowan.happy: I wrote a poem. It\'s terrible. You\'re in it. Don\'t ask.'],
    },
    pip: {
        young: ['pip: Look what I found! Don\'t ask where. Okay, it was a pocket.', 'pip.happy: The little ones made you a crown out of tin cans. You have to wear it. It\'s the law.', 'pip: Rich people never look up. That\'s how you know they\'re rich.', 'pip.happy: Race you over the rooftops! No flying! ...You don\'t even have wings yet, so, fine.'],
        grown: ['pip: Got a job. A real one. Don\'t laugh. Running numbers for Orsolo. Legit numbers. Mostly.', 'pip.happy: You\'re the only noble I\'ve never robbed. Sentimental, me.', 'pip: The Rookery kids are learning letters now. Some posh prince keeps sending books. Can\'t think who.', 'pip: Things are getting weird at court, horn-head. Watch your back. Better yet, let me watch it.'],
    },
    theo: {
        young: ['theo: Did you know there are forty-one kinds of fire? I\'ve only set nineteen of them on purpose.', 'theo.happy: I wrote you a list of books. It\'s two hundred long. Start at the top.', 'theo: Velis says I think too much. I\'ve been thinking about that a lot.', 'theo.happy: Can I measure your horns? For science. They\'re growing at a fascinating rate.'],
        grown: ['theo: I\'ve been reading about the Heartstone. If the magic holds, your mother isn\'t dead, just... paused. Like a held breath.', 'theo.happy: I made you something. It\'s a lantern that lights when you breathe on it. That\'s it. That\'s all it does. I like it.', 'theo: Velis says I could have a seat on the Council of the Spire. I said I\'d think about it. I\'m thinking about you instead. I mean. About it.', 'theo: If they try to put you in a tower, I\'ll take the tower apart. I\'ve worked out how. It\'s mostly the mortar.'],
    },
    saffi: {
        young: ['saffi.happy: I sold a merchant his own hat today. Father was so proud!', 'saffi: In Qasirah there are dragons too, did you know? Little ones. They live in the sand and eat scorpions.', 'saffi.happy: Teach me a word in Dragon, and I\'ll teach you a word in Qasiri. Fair trade!', 'saffi: Everybody here wears grey. Why does everybody here wear grey? I\'m going to fix it.'],
        grown: ['saffi.happy: Father\'s letting me run a ship\'s accounts. The whole ship! If I lose money they\'ll throw me overboard. Ha. Probably.', 'saffi: Do you ever think about leaving? Just going? I think about it every time a ship sails. Then I think about you and I don\'t.', 'saffi.happy: Dance with me. Right here. Who cares who\'s watching.', 'saffi: I heard what they say about you at court. In Qasirah, they\'d have made you a god. Your loss, Aurelmere.'],
    },
    lumi: {
        young: ['lumi.happy: I ate a whole goat! Well, half. Okay, a leg. It was a big leg.', 'lumi: The elders say humans smell like onions. You don\'t. You smell like campfire. I like campfire.', 'lumi.happy: Teach me a human game! Is it the one with the stick and the hoop? I broke the hoop. Sorry.', 'lumi: Why do humans wear so many clothes? Don\'t you get tangled?'],
        grown: ['lumi: Grandfather says you\'re the most important dragon alive. I told him you\'re also the silliest. He didn\'t laugh.', 'lumi.happy: Race me to the summit! Loser has to eat snow! You always lose, so, bring a spoon.', 'lumi: I keep wearing this human shape more and more. I think it\'s because you have one. Is that strange?', 'lumi.happy: I found a cave full of crystals that sing. I haven\'t shown anyone. Want to be the first?'],
    },
};

// ------------------------------------------------------------------ talking with the prince
export const TALK_TOPICS = [
    { id: 'praise', name: 'Praise him', desc: 'Tell him how proud you are.' },
    { id: 'scold', name: 'Scold him', desc: 'Remind him of his duties. Raises Morality and Stress.' },
    { id: 'feel', name: 'Ask how he feels', desc: 'Listen. Eases Stress a little.' },
    { id: 'mother', name: 'Talk about his mother', desc: 'Stories of Ysolde. Stirs the dragon in him.' },
    { id: 'future', name: 'Ask about the future', desc: 'What does he want to become?' },
];

export const TALK = {
    praise: {
        young: ['cael.happy: Really? You really think so? I\'m going to tell Hobb!', 'cael.happy: I did good? I did good! I knew it!'],
        grown: ['cael.happy: ...Thanks, {you}. I don\'t always feel like I\'m doing well. It helps to hear it.', 'cael.happy: You\'re going to make me blush. Dragons can blush, did you know? It\'s mostly smoke.'],
    },
    scold: {
        young: ['cael.sad: I know, I know. I\'ll do better. I promise.', 'cael.angry: That\'s not fair! ...Fine. You\'re right. It\'s still not fair.'],
        grown: ['cael.sad: ...You\'re right. I\'ve been careless. I\'ll fix it.', 'cael.angry: I\'m not a child anymore, {you}. ...But you\'re right. Sorry.'],
    },
    mother: {
        young: ['cael: What was she like? Was she big? Was she bigger than the castle?', 'cael.happy: Did she really breathe fire so hot it made glass? I want to do that!'],
        grown: ['cael: Sometimes I hear her when I fly. Singing. Is that real, do you think?', 'cael.sad: I wish I could remember her. Even a little. All I have are your stories.'],
    },
};

// What he says when asked how he feels: picked from his state.
export function feelLine(G) {
    const s = G.stats;
    if (s.sts >= 70) return 'cael.sad: I\'m tired, {you}. Really tired. Can I rest for a while? Please?';
    if (s.sts >= 45) return 'cael: I\'m all right. A bit worn out. Maybe a day off soon?';
    if (s.drc >= 70) return 'cael.angry: The fire\'s loud today. It\'s always loud lately. Like it wants out.';
    if (s.mor <= 25) return 'cael: Why should I care what the court thinks? They never cared about me.';
    if (s.bond >= 70) return 'cael.happy: I\'m good. Really good. I like our life, {you}.';
    return 'cael.happy: I\'m fine! Busy. Good busy. Mostly.';
}
