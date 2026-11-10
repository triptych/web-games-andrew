// EMBERSPIRE — the people of Hearthmere, the evening bond scenes, quests and daily rewards. Pure data.

export const NPCS = {
    bram: { name: 'Old Bram', role: 'Tavern keeper', where: 'tavern' },
    hilde: { name: 'Hilde', role: 'Blacksmith', where: 'smithy' },
    corwin: { name: 'Guildmaster Corwin', role: 'Adventurers\' Guild', where: 'guild' },
    zephyrine: { name: 'Zephyrine', role: 'Travelling merchant', where: 'shop' },
    amaya: { name: 'Sister Amaya', role: 'High priestess', where: 'temple' },
    watcher: { name: 'The Watcher', role: 'Keeper of the gate', where: 'gate' },
};

// What each NPC says when you walk in, picked by a hash of the day so it changes daily.
export const GREETINGS = {
    bram: [
        'Sit, sit. The stew\'s hot and the gossip\'s hotter.',
        'Another day, another floor. You lot keep me in business.',
        'Folk at the bar are talking about you. Mostly nice things.',
        'If you\'re hiring, I know a few who\'d follow you up that tower.',
    ],
    hilde: [
        'Bring me ore and I\'ll bring you edges.',
        'That blade\'s seen worse. Not much worse. Hand it over.',
        'Ember shards sing on the anvil. Never heard steel do that before the tower came.',
        'An upgrade a day keeps the slimes away. That\'s not a saying. It should be.',
    ],
    corwin: [
        'The board\'s fresh. Pick something that won\'t kill you. Or will, nicely.',
        'I climbed to the twelfth floor once. Left my eye on the eleventh.',
        'Bring me proof and I\'ll bring you coin.',
        'Every adventurer who ever came back says the same thing: it gets taller.',
    ],
    zephyrine: [
        'Everything has a price, darling. Today, it\'s a reasonable one.',
        'Fresh stock from places you can\'t pronounce.',
        'Monster cores? Oh, I\'ll trade you something lovely for those.',
        'Potions! Bombs! Questionable feathers of rebirth!',
    ],
    amaya: [
        'The light remembers every step you take up there.',
        'Growth is a door. When it opens, walk through.',
        'Kneel if you wish. Most just want their skills.',
        'The tower takes. The temple gives back a little.',
    ],
    watcher: [
        'Up, then. Always up.',
        'It grew from a seed of ember. Every floor is a ring of its years.',
        'I have watched many climb. Fewer than you would think come down.',
        'The summit is not the end. It never was.',
    ],
};

// The Watcher's words after each boss falls for the first time (index by boss number 1..10, then loops).
export const WATCHER_BOSS = [
    'The Colossus was the tower\'s root. You have cut it. Now it will grow toward you.',
    'Crystal remembers. The wyrm\'s song will echo up the stairs ahead of you.',
    'The Archivist wrote every name that ever climbed. Yours is in his book now.',
    'Ignivar forged the stair itself. Mind the heat; the steps are still warm.',
    'Winter keeps. Hrimgard kept many. Some of them may thank you.',
    'The Engine counted the tower\'s days. Without it, time up here runs as it likes.',
    'Mother Bloom fed on the town\'s rain. Tomorrow the wells of Hearthmere will taste sweet.',
    'She fell once from the sky. Now twice. Celestine will not fall a third time.',
    'Malgrath sat on a throne that was never his. The heart of the tower is above.',
    'Aurelion is the Ember. It burned because it was afraid. And yet... the tower still climbs. Higher than before.',
];

// ---------------------------------------------------------------- evening bonds
// Each companion has five scenes, one per bond rank (1..5). A scene plays when the bond xp crosses a rank.
// lines: [speaker, text] where speaker is the hero id or 'arin'. choices: [text, good, reply].
// Ranks: 1 Acquaintance, 2 Friend, 3 Close Friend, 4 Confidant, 5 Soulbound.
export const BOND_RANKS = ['Stranger', 'Acquaintance', 'Friend', 'Close Friend', 'Confidant', 'Soulbound'];
export const BOND_XP = 100;          // per rank
export const BOND_EVENING = 22;      // a quiet evening together
export const BOND_GOOD = 26;         // the reply they hoped for
export const BOND_FIGHT = 2;         // fighting side by side, per battle won

export const SCENES = {
    mira: [
        { lines: [['mira', 'You always sit with your back to the wall. Old habit?'], ['arin', 'Father taught me. Watch the door.'], ['mira', 'Then I\'ll watch the fire. Between us we\'ll see everything.']],
            choices: [['"Deal. Fire\'s yours."', true, 'She smiles and pulls her chair a little closer to the hearth. And to you.'], ['"Nothing comes through that door I can\'t handle."', false, '"I know," she says, gently. "That\'s what worries me."']] },
        { lines: [['mira', 'I lit a candle for the people the tower took. I lit one for your father.'], ['mira', 'I hope that wasn\'t too forward.']],
            choices: [['"Thank you. Nobody else did."', true, 'She takes your hand for a moment. "Then I\'ll keep lighting it."'], ['"He\'s not dead. Not until I find him."', false, 'She nods slowly. "Then I\'ll light one for finding him."']] },
        { lines: [['mira', 'Sister Amaya says the tower is a wound in the world. I think it\'s a fever.'], ['mira', 'Fevers break. If someone climbs to the top and... holds its hand.'], ['arin', 'You want to heal a tower.'], ['mira', 'I want to heal everything. It\'s very inconvenient.']],
            choices: [['"Then I\'ll carry you to the top."', true, '"I\'m holding you to that," she laughs, and her cheeks are pink in the firelight.'], ['"Some things can\'t be healed."', false, '"Maybe," she says. "But I\'ve never once regretted trying."']] },
        { lines: [['mira', 'When you fell on the forty-somethingth floor, I didn\'t think. I just ran to you.'], ['mira', 'A cleric is supposed to tend to everyone the same. I didn\'t. I don\'t.'], ['mira', 'Is that a sin, do you think?']],
            choices: [['"Then we\'re both sinners. I always look for you first."', true, 'She is quiet for a long moment. Then she rests her head on your shoulder, and stays.'], ['"You did your job. You\'re a good cleric."', false, '"Yes," she says, a little too brightly. "Of course."']] },
        { lines: [['mira', 'I made you something. Don\'t laugh.'], ['mira', 'It\'s my sun pendant. The one from the temple. I want you to carry it up there.'], ['mira', 'That way, every floor you climb... I\'m already there. Waiting.']],
            choices: [['"I\'ll bring it back. And you with it."', true, 'Her eyes shine. "You\'d better." Gift received: Mira\'s Sun Pendant.'], ['"I\'ll wear it always."', true, 'She fastens it around your neck herself, and her hands linger. Gift received: Mira\'s Sun Pendant.']] },
    ],
    brakka: [
        { lines: [['brakka', 'Arm wrestle. Now. Loser buys.'], ['arin', 'I just sat down.'], ['brakka', 'Good. Your arm\'s rested.']],
            choices: [['Roll up your sleeve.', true, 'You lose. Badly. She laughs so hard the table shakes, and buys anyway.'], ['"Maybe tomorrow."', false, '"Tomorrow I\'ll be stronger," she grins. "Your loss."']] },
        { lines: [['brakka', 'You don\'t ask about the clan. Everyone asks.'], ['arin', 'You\'ll tell me when you want.'], ['brakka', '...Huh. Strange human.']],
            choices: [['"I\'m in no hurry."', true, 'She grunts, but it\'s a pleased grunt. She refills your mug without asking.'], ['"Alright, I\'m asking."', false, '"Too late," she smirks. "You had your chance."']] },
        { lines: [['brakka', 'They threw me out because I wouldn\'t kill a prisoner. A human boy. Younger than you.'], ['brakka', 'The Ashfang say mercy is a crack in the axe. Maybe they\'re right.'], ['brakka', 'Maybe I\'m cracked.']],
            choices: [['"Then the crack is where the light gets in."', true, 'She stares at you. "That\'s the stupidest, nicest thing anyone\'s said to me."'], ['"They sound like idiots."', true, 'She barks a laugh. "They are! Huge idiots. With very big axes."']] },
        { lines: [['brakka', 'You took that hit for me today. The demon knight. Why?'], ['arin', 'You\'d have done the same.'], ['brakka', 'I would have. That\'s not the point. Nobody does it for me.']],
            choices: [['"I always will."', true, 'She looks away fast. "Fine. Good. Shut up." But she\'s smiling.'], ['"It was tactically sound."', false, '"Tactically," she repeats, flat. "Sure."']] },
        { lines: [['brakka', 'My mother\'s tusk necklace. The only thing I took when they threw me out.'], ['brakka', 'Ashfang give these to their... to the ones they\'d fight beside until the end.'], ['brakka', 'Don\'t make it weird.']],
            choices: [['"I\'m honoured, Brakka."', true, '"Weird," she mutters, and squeezes your hand so hard it hurts. Gift received: Ashfang Tusk Necklace.'], ['Just put it on.', true, 'She nods once, satisfied. "Good. That\'s settled." Gift received: Ashfang Tusk Necklace.']] },
    ],
    sylas: [
        { lines: [['sylas', 'I\'ve been robbed! My purse is gone!'], ['arin', 'It\'s on your belt.'], ['sylas', 'Ah. So it is. Force of habit; I check if anyone\'s better than me.']],
            choices: [['"Anyone ever?"', true, '"Once," he says, wistful. "She stole my heart and my boots. In that order."'], ['"Stop stealing from Bram."', false, '"I never! ...I returned it. Mostly."']] },
        { lines: [['sylas', 'Confession: I owe money to roughly half of Hearthmere.'], ['sylas', 'Second confession: the other half owes money to me.'], ['sylas', 'It\'s an ecosystem.']],
            choices: [['"Pay Bram first. He feeds us."', true, '"Ever the knight," he sighs, and slides a coin across the bar. Bram looks astonished.'], ['"Lend me some?"', false, '"Ha! You\'d never pay me back. I like you, but I\'m not stupid."']] },
        { lines: [['sylas', 'Elves live a long time. Long enough to watch everyone you like get old.'], ['sylas', 'So I stopped liking people. Simpler.'], ['arin', 'How\'s that going?'], ['sylas', 'Terribly. You\'re all very annoying about it.']],
            choices: [['"Then keep liking us. We\'re worth it."', true, 'He laughs, but his eyes are wet. "Unbearable. All of you."'], ['"You don\'t have to stay."', false, '"I know," he says quietly. "That\'s the trouble."']] },
        { lines: [['sylas', 'I could have run on the thirtieth floor. Easy. Window, rope, gone.'], ['sylas', 'I didn\'t. I stood there like a fool with my little knives.'], ['sylas', 'I think that means something. I\'m afraid of what.']],
            choices: [['"It means you\'re one of us."', true, '"Don\'t," he says, but he\'s smiling. "Don\'t make me sentimental. It ruins the cheekbones."'], ['"It means you\'re brave."', true, '"Brave," he tries the word like a stolen wine. "Huh. Not bad."']] },
        { lines: [['sylas', 'My lucky coin. Two heads. I\'ve won every bet I ever made with it.'], ['sylas', 'I want you to have it. Then I can\'t cheat you, even if I wanted to.'], ['sylas', 'And I find I very much don\'t want to.']],
            choices: [['"I\'ll call heads."', true, '"Always," he grins. Gift received: Sylas\'s Lucky Coin.'], ['"Thank you, Sylas."', true, 'He bows, grand and silly, but his hand stays over his heart. Gift received: Sylas\'s Lucky Coin.']] },
    ],
    lyra: [
        { lines: [['lyra', 'You walk like a knight. Loud.'], ['arin', 'I\'m in plate armour.'], ['lyra', 'Excuses. The forest hears you coming a mile off.']],
            choices: [['"Teach me to walk quieter."', true, 'She grins. "Heel first, no, toe... oh, you\'re hopeless. Again."'], ['"The forest can deal with it."', false, 'She rolls her eyes so hard you hear it.']] },
        { lines: [['lyra', 'The oaks in the Greenwood are dying from the roots up. The tower\'s roots.'], ['lyra', 'Everyone thinks I came for glory. I came for the trees.']],
            choices: [['"Then we climb for the trees."', true, 'She looks at you as if seeing you for the first time. "...Thank you."'], ['"Trees grow back."', false, '"Not these," she says quietly. "Not three hundred years of them."']] },
        { lines: [['lyra', 'Look. I\'ve been carving. It\'s a fox.'], ['arin', 'It\'s very good.'], ['lyra', 'It\'s lopsided. But foxes are a bit lopsided. That\'s why I like them.']],
            choices: [['"I like lopsided things."', true, '"Good," she says, and bumps your shoulder. "You\'re a bit lopsided yourself."'], ['"Could you carve a sword?"', false, '"I could carve you a sense of romance," she mutters. "Would take longer."']] },
        { lines: [['lyra', 'On the Summit, above the clouds, I saw the whole Greenwood. Tiny. Like a moss.'], ['lyra', 'I thought: if I fell, nobody down there would know.'], ['lyra', 'Then I thought: you would.']],
            choices: [['"I\'d come and find you."', true, 'She takes your hand and doesn\'t let go for the rest of the evening.'], ['"You won\'t fall. You\'re the best climber here."', true, '"Flatterer," she laughs, and leans against you.']] },
        { lines: [['lyra', 'Here. The fox. I finished it. Well, I gave up on finishing it.'], ['lyra', 'Rangers give carvings to... the people they\'d share a campfire with forever.'], ['lyra', 'That came out more serious than I meant. No it didn\'t.']],
            choices: [['"Forever sounds good."', true, 'She kisses your cheek, quick as a fox, and pretends to study the fire. Gift received: Carved Wooden Fox.'], ['"I\'ll treasure it."', true, '"You\'d better," she says, glowing. Gift received: Carved Wooden Fox.']] },
    ],
    thorne: [
        { lines: [['thorne', 'Statistically, this tavern has a thirty percent chance of catching fire tonight.'], ['arin', 'Because of the hearth?'], ['thorne', 'Because of me.']],
            choices: [['"I\'ll keep a bucket handy."', true, '"Wise," he nods, deeply serious. "Bram already has three."'], ['"Then please go outside."', false, '"Rude," he sniffs. "Accurate. But rude."']] },
        { lines: [['thorne', 'The Academy said I lacked discipline. I prefer "enthusiasm with collateral".'], ['thorne', 'Did you know you\'re the first person who\'s never asked me to be less?']],
            choices: [['"Be as much as you like. Just aim it."', true, '"Aim," he repeats, as if it\'s a revelation. "Huh. Yes."'], ['"Could you be a little less?"', false, '"Ah. Never mind," he says, and sulks into his book.']] },
        { lines: [['thorne', 'My first fire spell was an accident. My little sister was cold.'], ['thorne', 'I set the curtains alight. She laughed so hard. Mother didn\'t.'], ['thorne', 'She\'s at the Academy now. Top of her class. Writes me every month. I never write back. I never know what to say.']],
            choices: [['"Tell her about the tower. She\'d love it."', true, 'He blinks behind his spectacles. "She would, wouldn\'t she." He starts writing at once.'], ['"Some families are better apart."', false, '"Not this one," he says, quietly. "I\'m just bad at it."']] },
        { lines: [['thorne', 'I calculated the odds of us reaching the summit. They\'re dreadful.'], ['thorne', 'Then I recalculated with you as a constant instead of a variable.'], ['thorne', 'Much better odds. Don\'t ask me to show the working.']],
            choices: [['"Show me the working."', true, 'He does. It takes an hour. It\'s mostly about you. He doesn\'t seem to notice.'], ['"Glad to help the maths."', true, '"You are the maths," he says, then turns very red.']] },
        { lines: [['thorne', 'My spare spectacles. Cracked lens. I sat on them in the Haunted Library.'], ['thorne', 'You keep them. Then when you look at the world through them, it\'s... it\'s a little like I\'m there.'], ['thorne', 'That was poetic. I apologise.']],
            choices: [['"Don\'t apologise. It was lovely."', true, 'He beams, and nearly sets his sleeve on fire. Gift received: Thorne\'s Spare Spectacles.'], ['Put them on.', true, '"They don\'t suit you at all," he laughs. "Keep them anyway." Gift received: Thorne\'s Spare Spectacles.']] },
    ],
    pip: [
        { lines: [['pip', 'I need a rhyme for "Emberspire". I\'ve got "liar", "fryer" and "umpire".'], ['arin', '"Higher"?'], ['pip', 'Oh! Oh, you\'re good. Stay right there.']],
            choices: [['"Desire"?', true, '"Scandalous! Perfect!" He scribbles furiously.'], ['"Maybe skip the rhymes."', false, 'He gasps, deeply wounded. "Skip the rhymes. Philistine."']] },
        { lines: [['pip', 'Every great ballad needs a hero. Mine is you, obviously.'], ['pip', 'But it also needs a flaw. What\'s yours? Something tragic, please.']],
            choices: [['"I can\'t sing."', true, '"Perfect! The tragedy! I\'ll sing for you, then. Forever, if need be."'], ['"I have no flaws."', false, '"There it is," he sighs. "Arrogance. Classic. Bit boring."']] },
        { lines: [['pip', 'Halflings don\'t go on adventures. My mum fainted when I left.'], ['pip', 'I write her a letter every week. I tell her I\'m in a quiet library.'], ['pip', 'She thinks I\'m very well read now.']],
            choices: [['"Write her the truth. She\'d be proud."', true, 'He thinks about it. "Maybe. After the summit. Then it\'s a happy ending."'], ['"Lying\'s kinder."', false, '"Is it?" he says, and for once has nothing else to say.']] },
        { lines: [['pip', 'I wrote a verse about you tonight. Not for the ballad. Just for me.'], ['pip', 'I won\'t sing it. It\'s not ready. It might never be ready.'], ['pip', 'But I thought you should know it exists.']],
            choices: [['"I\'ll wait as long as it takes."', true, '"Careful," he says softly. "I might hold you to that."'], ['"Sing it anyway."', false, 'He shakes his head, smiling. "Some songs you earn."']] },
        { lines: [['pip', 'My silver flute. It only plays one tune, the one my dad wrote for my mum.'], ['pip', 'I think it\'s yours now. I think it always was going to be.'], ['pip', 'Play it badly. I\'ll know it\'s you.']],
            choices: [['Play it, badly.', true, 'He laughs until he cries, and then he just cries a little, happily. Gift received: Pip\'s Silver Flute.'], ['"Teach me the tune."', true, 'He does, note by note, until the fire burns low. Gift received: Pip\'s Silver Flute.']] },
    ],
    grimble: [
        { lines: [['grimble', 'Hold this. Don\'t shake it. Don\'t breathe on it.'], ['arin', 'What is it?'], ['grimble', 'If I knew that I wouldn\'t need you to hold it.']],
            choices: [['Hold very, very still.', true, 'Nothing explodes. Grimble looks almost disappointed. "Good hands. Steady."'], ['Put it down carefully.', false, 'It fizzes ominously. "Now look what you\'ve done," he sighs, sweeping it into a bucket.']] },
        { lines: [['grimble', 'My eyebrows were the finest in the Ironhold. Glorious. Like two ginger hedges.'], ['grimble', 'Now look. Science took them. Science takes everything.']],
            choices: [['"They\'ll grow back."', true, '"That\'s what I keep telling them," he grumbles, touched.'], ['"Maybe stop blowing things up?"', false, '"And do what? Knit?" He looks genuinely horrified.']] },
        { lines: [['grimble', 'I\'m not here for research. Not really.'], ['grimble', 'My brother went into the tower thirty years back. Mining expedition. Ember crystals.'], ['grimble', 'If I learn what the crystals do, maybe I learn what happened to him.']],
            choices: [['"We\'ll find out together."', true, 'He nods hard and blows his nose on his apron. "Right. Together. Good."'], ['"Thirty years is a long time."', false, '"Dwarves are patient," he says. "And stubborn. Mostly stubborn."']] },
        { lines: [['grimble', 'Found something on the Clockwork floor. A dwarf-made gear. With my brother\'s mark.'], ['grimble', 'He built part of this place. Or the tower made him. Either way... he was here.'], ['grimble', 'I\'m not sure if I\'m happy or sad. Both, I think.']],
            choices: [['"Both is allowed."', true, 'He laughs, a great wet laugh, and claps you on the back hard enough to bruise.'], ['"Let\'s find him."', true, '"Aye," he says fiercely. "Let\'s."']] },
        { lines: [['grimble', 'Brass compass. Mine and my brother\'s. It points at whatever you want most.'], ['grimble', 'Mine\'s pointed up the tower for thirty years. Tonight it points at the table. At you lot.'], ['grimble', 'So you keep it. I\'ve found what I wanted.']],
            choices: [['"Thank you, old friend."', true, '"Less of the old," he grunts, and hugs you like a bear. Gift received: Grimble\'s Brass Compass.'], ['Check where it points.', true, 'It points at Grimble. He pretends not to see. Gift received: Grimble\'s Brass Compass.']] },
    ],
    nyx: [
        { lines: [['nyx', 'You\'re staring at my horns.'], ['arin', 'I was staring at the fire.'], ['nyx', 'Through my horns. It\'s fine. They\'re very impressive.']],
            choices: [['"They really are."', true, 'She laughs, surprised and genuine. "Well. Honest, at least."'], ['"I wasn\'t, honestly."', false, '"Pity," she says, and turns back to her wine.']] },
        { lines: [['nyx', 'Everyone in town crosses the street when I pass. You don\'t.'], ['nyx', 'Is that courage, or are you just slow?']],
            choices: [['"Bit of both."', true, 'She smirks. "Good answer. I hate pure courage. It\'s so loud."'], ['"I\'m not afraid of you."', false, '"You should be," she says lightly. "A little."']] },
        { lines: [['nyx', 'My patron lives in the Abyss. I signed when I was fourteen and dying of fever.'], ['nyx', 'Power for service. A good deal for a dead girl. A bad one for a living woman.'], ['nyx', 'Every floor we climb, I feel the chain get shorter.']],
            choices: [['"Then we break it. Together."', true, 'She stares at you, as if you\'d said something impossible. "...You mean that."'], ['"Why tell me now?"', false, '"Because I\'m tired," she says. "Don\'t make me regret it."']] },
        { lines: [['nyx', 'When we killed Malgrath, the chain broke. I felt it snap.'], ['nyx', 'For the first time in ten years I am nobody\'s.'], ['nyx', 'It\'s terrifying. I keep looking for someone to belong to.']],
            choices: [['"Belong to yourself. Stay because you want to."', true, 'She is very quiet. Then she takes your hand. "I want to."'], ['"You can belong to the party."', true, '"The party," she laughs softly. "Yes. Let\'s call it that, for now."']] },
        { lines: [['nyx', 'The pact ring. Snapped in half when the chain broke.'], ['nyx', 'A broken ring binds no one. That\'s what makes it worth giving.'], ['nyx', 'Take it. Choose me back, or don\'t. That\'s the point.']],
            choices: [['"I choose you."', true, 'Her golden eyes go very bright. "Idiot," she whispers, and doesn\'t let go. Gift received: The Broken Pact Ring.'], ['Take it, and her hand.', true, 'She lets you. For once, she says nothing clever at all. Gift received: The Broken Pact Ring.']] },
    ],
};

// A quiet evening that isn't a rank-up: one line, picked by a hash of the day.
export const SMALLTALK = {
    mira: ['Mira tells you about the temple cats. There are eleven. She has named all of them after saints.', 'Mira hums while she mends your cloak. You don\'t recognise the song; she made it up.', 'You and Mira count the stars through the window until Bram throws you out.'],
    brakka: ['Brakka teaches you an Ashfang drinking song. You will be hoarse tomorrow.', 'Brakka sharpens her axe and tells you about every scar. Some of the stories are even true.', 'You and Brakka arm wrestle. She wins. Again. She buys. Again.'],
    sylas: ['Sylas teaches you three card tricks and steals your boot while you watch the second.', 'Sylas tells a story about a duke, a goose and a very confused bishop. You laugh until you hiccup.', 'You and Sylas people-watch from the window. He invents scandalous lives for everyone.'],
    lyra: ['Lyra shows you how to fletch an arrow. Yours flies sideways. She laughs, not unkindly.', 'Lyra names every bird you hear on the walk back. You make some up. She notices.', 'You and Lyra share a pot of herb tea and say very little. It\'s nice.'],
    thorne: ['Thorne explains the theory of fireballs with salt cellars. Two catch fire.', 'Thorne reads you a chapter of a terribly romantic novel, then claims it was for research.', 'You and Thorne play chess. He thinks for twenty minutes, then knocks the board over with his elbow.'],
    pip: ['Pip plays the whole tavern a jig. Bram dances. Nobody will ever speak of it.', 'Pip asks you nineteen questions for the ballad. Question twelve was about your favourite soup.', 'You and Pip compose a terrible limerick about Corwin\'s eyepatch.'],
    grimble: ['Grimble shows you a potion that turns ale blue. It also turns your tongue blue.', 'Grimble lectures you on the eleven types of explosion. You remember four.', 'You and Grimble fix the tavern\'s squeaky door. It now opens itself, slightly too fast.'],
    nyx: ['Nyx reads your palm and tells you a fortune so specific it\'s unsettling.', 'Nyx says nothing for an hour, then thanks you for the silence.', 'You and Nyx watch the tower glow from the window. She names its colours like old friends.'],
};

// Recruiting: what each companion says when they join (and Bram's pitch before you can afford them).
export const RECRUIT_LINES = {
    mira: 'I\'m coming with you. Don\'t argue, I\'ve already packed bandages.',
    brakka: 'You need someone to stand in front of you and hit things. I am excellent at both.',
    sylas: 'My rates are reasonable and my morals are flexible. Shall we?',
    lyra: 'The tower\'s roots are killing my forest. I want to see its heart.',
    thorne: 'I promise to only set fire to things that deserve it. Probably.',
    pip: 'An epic needs a chronicler! And possibly someone to hold the torch.',
    grimble: 'Ember crystals, eh? Count me in. Stand back, mind.',
    nyx: 'Something up there owns me. I\'d like to discuss the terms. With a scythe.',
};

// ---------------------------------------------------------------- quests
// Guild board quests are rolled each new day from these templates (seeded); scale with the best floor.
// kind is the counter the sim tracks; need(best) gives the target; reward is gold scaled to the floor plus extras.
export const QUEST_TEMPLATES = [
    { id: 'slay', name: 'Thin the Ranks', text: (n) => `Defeat ${n} monsters in the tower.`, kind: 'kills', need: (b) => 12 + Math.floor(b / 4) * 2, reward: { gold: 1.0, ore: 2 } },
    { id: 'climb', name: 'Higher Ground', text: (n) => `Clear ${n} floors.`, kind: 'floors', need: (b) => 4 + Math.floor(b / 15), reward: { gold: 1.2, potion: 2 } },
    { id: 'elite', name: 'Elite Hunter', text: (n) => `Defeat ${n} elite monsters.`, kind: 'elites', need: (b) => 1 + Math.floor(b / 30), reward: { gold: 1.4, core: 1 } },
    { id: 'skills', name: 'Show of Skill', text: (n) => `Use ${n} skills in battle.`, kind: 'skills', need: (b) => 15 + Math.floor(b / 5), reward: { gold: 0.8, ether: 2 } },
    { id: 'forge', name: 'Hilde\'s Order', text: (n) => `Upgrade gear ${n} times at the forge.`, kind: 'upgrades', need: () => 2, reward: { gold: 0.6, shard: 1 } },
    { id: 'weak', name: 'Know Thy Foe', text: (n) => `Hit ${n} weaknesses.`, kind: 'weakHits', need: (b) => 8 + Math.floor(b / 6), reward: { gold: 1.0, firebomb: 1, frostbomb: 1 } },
    { id: 'gold', name: 'Treasure Seeker', text: (n) => `Earn ${n} gold in the tower.`, kind: 'goldEarned', need: (b) => Math.round(60 * Math.pow(1.06, b)), reward: { gold: 0.5, phoenix: 1 } },
    { id: 'heal', name: 'Field Medic', text: (n) => `Restore ${n} health in battle.`, kind: 'healed', need: (b) => Math.round(150 * Math.pow(1.06, b)), reward: { gold: 0.8, hipotion: 1 } },
];

// Milestones: a fixed chain, always on the board until done.
export const MILESTONES = [
    { id: 'm_f5', name: 'First Steps', text: 'Reach floor 5.', kind: 'best', need: 5, reward: { gold: 150, potion: 3 } },
    { id: 'm_f10', name: 'Root and Branch', text: 'Defeat the boss of floor 10.', kind: 'best', need: 10, reward: { gold: 400, shard: 2 } },
    { id: 'm_r3', name: 'A Proper Party', text: 'Have 4 heroes in your company.', kind: 'roster', need: 4, reward: { gold: 300, phoenix: 1 } },
    { id: 'm_f20', name: 'Crystal Clear', text: 'Defeat the boss of floor 20.', kind: 'best', need: 20, reward: { gold: 1200, shard: 3 } },
    { id: 'm_evo', name: 'Becoming', text: 'Evolve a hero\'s class at the Temple.', kind: 'evolved', need: 1, reward: { gold: 800, core: 2 } },
    { id: 'm_b3', name: 'Kindred', text: 'Reach Close Friend with any companion.', kind: 'bondMax', need: 3, reward: { gold: 600, elixir: 1 } },
    { id: 'm_f30', name: 'Overdue', text: 'Defeat the boss of floor 30.', kind: 'best', need: 30, reward: { gold: 3000, shard: 4 } },
    { id: 'm_r6', name: 'Full Tavern', text: 'Have 6 heroes in your company.', kind: 'roster', need: 6, reward: { gold: 2000, core: 3 } },
    { id: 'm_f50', name: 'Halfway to Heaven', text: 'Defeat the boss of floor 50.', kind: 'best', need: 50, reward: { gold: 15000, shard: 6 } },
    { id: 'm_r9', name: 'Legends of Hearthmere', text: 'Recruit all nine heroes.', kind: 'roster', need: 9, reward: { gold: 10000, elixir: 2 } },
    { id: 'm_b5', name: 'Soulbound', text: 'Reach Soulbound with any companion.', kind: 'bondMax', need: 5, reward: { gold: 8000, core: 5 } },
    { id: 'm_asc', name: 'Ascendant', text: 'Ascend a hero (level 40 at the Temple).', kind: 'ascended', need: 1, reward: { gold: 20000, shard: 8 } },
    { id: 'm_f100', name: 'The Ember Heart', text: 'Defeat Aurelion on floor 100.', kind: 'best', need: 100, reward: { gold: 250000, elixir: 5 } },
];

// ---------------------------------------------------------------- daily rewards
// Day N of a login streak (1..7, then it repeats at 7). gold is multiplied by the floor's gold scale.
export const DAILY = [
    { gold: 3, potion: 2 },
    { gold: 4, ether: 2 },
    { gold: 5, ore: 4 },
    { gold: 6, phoenix: 1 },
    { gold: 8, shard: 2 },
    { gold: 10, hipotion: 2, core: 1 },
    { gold: 15, elixir: 1, gear: 'epic' },
];

// The day's blessing (one per calendar day, chosen by a hash of the date).
export const BLESSINGS = [
    { id: 'gold', name: 'Bram\'s Lucky Day', desc: 'Gold from battles +25% today.', goldPct: 25 },
    { id: 'xp', name: 'Amaya\'s Insight', desc: 'Experience +25% today.', xpPct: 25 },
    { id: 'might', name: 'Hilde\'s Whetstone', desc: 'Party attack +10% today.', atkPct: 10 },
    { id: 'ward', name: 'Temple Ward', desc: 'Party defence +12% today.', defPct: 12 },
    { id: 'loot', name: 'Zephyrine\'s Rumour', desc: 'Loot drops +30% today.', dropPct: 30 },
    { id: 'forge', name: 'Forge Festival', desc: 'Upgrades cost 30% less gold today.', forgeOff: 30 },
    { id: 'bond', name: 'Lantern Night', desc: 'Evening bonds grow twice as fast today.', bondMul: 2 },
];
