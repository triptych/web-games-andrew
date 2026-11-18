// Nights at the fire. After some chapters the party makes camp, and the apprentice can sit with two companions
// (CAMP_TALKS). Each companion has a sequence of talks, heard in order; the last one of each changes their epilogue
// (talk.<id> >= 3 in data/story.js), and Aldwin's third keeps him alive at the Starfall bridge.

export const CAMP_INTRO = {
    1: ["@bg camp", "@music camp", "n: You make camp in the lee of a slag heap outside Cinderhold. The fire Aldwin builds burns orange. Everyone keeps looking at it."],
    2: ["@bg camp", "@music camp", "n: The Magpie is beached in a cove under the cliffs. The sea hushes on the shingle, blue even by firelight."],
    3: ["@bg camp", "@music camp", "n: You sleep in the Eldwood, under green leaves, for the first time in three hundred years anyone has. The birds will not stop singing."],
    4: ["@bg camp", "@music camp", "n: Camp in the gold wheat, under real stars, faint and few. Somewhere far off, farmers are singing in the dark."],
    5: ["@bg camp", "@music camp", "n: The last night. Below, Vael's grey spires. Above, more stars than anyone has seen in three centuries. Nobody can sleep."],
};

/** Who can be found at the fire on a given night (flags permitting). */
export const CAMP_WHO = {
    1: ['edda', 'aldwin'],
    2: ['edda', 'aldwin', 'kestrel'],
    3: ['edda', 'aldwin', 'kestrel', 'ione'],
    4: ['edda', 'aldwin', 'kestrel', 'ione'],
    5: ['edda', 'aldwin', 'kestrel', 'ione', 'caius'],
};
/** A companion who is gone by then is not at the fire. */
export const CAMP_IF = { aldwin: '!flag:aldwinfell', caius: 'flag:caiusturned' };

export const CAMP_TOPIC = {
    edda: ['Ask about her eyes.', 'Ask about Ostrander.', 'Describe the world to her.'],
    aldwin: ['Ask about the Order.', 'Ask what he carries in his pack.', 'Ask what he means to do at the end.'],
    kestrel: ['Ask how she became a smuggler.', 'Ask about the Magpie.', 'Ask about her mother.'],
    ione: ['Ask what the world was like before.', 'Ask about the boy Odrane.', 'Ask what she will do after.'],
    caius: ['Sit with Caius.'],
};

export const TALKS = {
    edda: [
        [
            "@show edda l",
            "edda: You keep looking at my eyes. Go on. Everyone wants to ask.",
            "edda: I wasn't born blind. It came on slowly, the way the grey did. Forty years ago I could still see the ink on the page. Grey ink, on grey paper. Then not even that.",
            "edda: I used to sit at the window every evening, waiting for him. For anybody. Watching the road. I think I wore my eyes out on that road.",
            { choice: [
                { t: "“You don't have to wait any more.”", fx: "b.edda+1 hope+1" },
                { t: "“What do you imagine, when you think of colour?”", fx: "b.edda+1" },
            ] },
            "edda.happy: Red is warm. Blue is cold, but a kind cold, like a cup of water. Green smells of cut grass. Gold is the inside of an apple. That's what my grandmother told me, and I've kept it all this time.",
            "edda: Now go to sleep, child. You talk too much.",
        ],
        [
            "@show edda l",
            "edda: You want to know about him. Ostrander.",
            "edda: I was nineteen. Apprenticed to the old mapmaker in Hollowmere. He came through on his way to somewhere grand and stayed a month, and drew the stars for me on the inside of my wrist with a pen.",
            "edda: He promised to take me to the sea. ‘You've never seen blue, Edda. Real blue. I'll show you.’ Then the Order came for the hedge-witches, and he gave me the map, and he went to his castle, and he never came out again.",
            "codex: She's leaving out the part where she threw an inkpot at me.",
            "edda: He deserved the inkpot.",
            { choice: [
                { t: "“Did you love him?”", fx: "b.edda+1" },
                { t: "“He talked about you, you know. In the book.”", fx: "b.edda+1 hope+1" },
            ] },
            "edda.happy: Oh, child. Sixty years is a long time to be angry with someone. You get tired, and what's left underneath is just the missing.",
        ],
        [
            "@show edda l",
            "edda: Describe it to me. Where we are. The fire, the sky, all of it. Use the colours. I want to hear them out loud.",
            { choice: [
                { t: "Tell her about the fire: orange at the heart, red at the edges, gold in the sparks.", fx: "b.edda+1" },
                { t: "Tell her about the sky: indigo, and the stars like salt.", fx: "b.edda+1" },
                { t: "Tell her about her own coat: green, the green of wet moss.", fx: "b.edda+2" },
            ] },
            "edda.happy: ...Yes. Yes, that's how I'd have drawn it.",
            "edda: Child. When it's done. When the last one opens. I want to see it. Just once. Is that a foolish thing for an old woman to want?",
            "you: No. It isn't.",
            "edda: Well. We'll see. I've waited longer for less.",
            "@fx flag:eddawish hope+1",
        ],
    ],
    aldwin: [
        [
            "@show aldwin l",
            "aldwin: The Order took me at eight. My mother couldn't feed six. They gave her a sack of grey flour for me.",
            "aldwin: It wasn't cruel, mostly. That's what nobody tells you. They were kind to us. They fed us and taught us letters and told us we were keeping the world safe. I believed every word.",
            "aldwin: I'd have died for the Hierarch. I nearly did, three times. And then they gave me a torch and pointed at a library.",
            { choice: [
                { t: "“You were a child. They made you what you were.”", fx: "b.aldwin+1" },
                { t: "“Do you miss it?”", fx: "b.aldwin+1" },
            ] },
            "aldwin.sad: I miss being sure. That's the worst of it. Being sure was very restful.",
        ],
        [
            "@show aldwin l",
            "aldwin: You've been wondering what I keep in that pack. It's not food, you'll have noticed.",
            "n: He unwraps an oilskin bundle, very carefully, the way a man might unwrap a baby. Inside is a small book with a cracked spine.",
            "aldwin: From Saint Ilse. The night of the fire. I put the torch down and I picked this up, and I've carried it eleven years. I never dared open it.",
            "n: It is a children's book: the story of a fox who stole the colours of the sunset. Every page is painted. And now that the wards are opening, the paint is coming back: a smudge of orange on the fox's tail, a little red in the sky.",
            { choice: [
                { t: "Read it to him.", fx: "b.aldwin+2 hope+1" },
                { t: "“Keep carrying it. It's yours.”", fx: "b.aldwin+1" },
            ] },
            "aldwin.sad: ...It's a good story. The fox gives them back, at the end. I always wondered if he would.",
        ],
        [
            "@show aldwin l",
            "aldwin: You want to know what I mean to do at the end. You've seen me looking at bridges and doorways. Narrow places.",
            "aldwin: I'm an old knight, child. There's one thing we're good for. If it comes to it, I mean to be good for it.",
            { choice: [
                { t: "“Promise me you'll come back. Brave people are cowards who stay.”", fx: "b.aldwin+2 flag:aldwinoath" },
                { t: "“I won't let it come to that.”", fx: "b.aldwin+1 flag:aldwinoath" },
            ] },
            "aldwin: ...Edda's line. She'd skin me if I died after that. All right. I promise. I'll hold whatever needs holding, and then I'll come back. That's a new kind of brave for me. I'll have to practise.",
            "@fx hope+1",
        ],
    ],
    kestrel: [
        [
            "@show kestrel l",
            "kestrel: How does anyone become a smuggler? You're hungry, and somebody wants something carried, and you're small enough to fit under a floor.",
            "kestrel: First thing I ever ran was a box of crayons. Real ones, from before. Some lord in Merrowgate wanted them for his daughter. Grey as dust, all of them, but they'd been colours once, and he paid like they still were.",
            { choice: [
                { t: "“What happened to the crayons?”", fx: "b.kestrel+1" },
                { t: "“You could have been anything.”", fx: "b.kestrel+1" },
            ] },
            "kestrel.happy: Kept one. Don't tell the lord. It's in my boot. I think it's going to be blue. I'm very nearly sure it's going to be blue.",
        ],
        [
            "@show kestrel l",
            "kestrel: The Magpie? Won her in a game of cards from a captain who couldn't count. Best ship on the Sound. Ugliest too.",
            "kestrel: When this is over I'm painting her. Every plank a different colour. The sails too. People will see her coming from three miles off and say there goes that mad woman with the rainbow boat.",
            { choice: [
                { t: "“I'll help you paint her.”", fx: "b.kestrel+2" },
                { t: "“The Order will see you from three miles off too.”", fx: "b.kestrel+1" },
            ] },
            "kestrel.happy: There won't be an Order. That's the point, idiot. That's the whole point.",
        ],
        [
            "@show kestrel l",
            "kestrel: Her name's Marra. My mother. Marra Quill. She'd be fifty-one now.",
            "kestrel: The Penitent Houses are where they put people who see colour. Or say they do. They make you stand in a grey room until you stop. Some people never stop. Nobody ever comes out.",
            "kestrel: I've stood outside the wall of the one in Merrowgate every year on her birthday. I don't even know if she's in that one.",
            { choice: [
                { t: "“When the wards break, we open every one of them. I promise.”", fx: "b.kestrel+2 hope+1 flag:penitents" },
                { t: "Take her hand.", fx: "b.kestrel+2" },
            ] },
            "kestrel: ...Don't make me cry, apprentice, I'll push you in the fire.",
        ],
    ],
    ione: [
        [
            "@show ione l",
            "ione: Before? Before was loud. Everything had a voice. The rivers argued. The wind gossiped. People dreamed so loudly that we spirits could hear them from the forest, like music from a house.",
            "ione: Not all of it was kind. People are not always kind, and magic makes them louder. But it was alive.",
            { choice: [
                { t: "“Was the war as bad as they say?”", fx: "b.ione+1" },
                { t: "“I'd like to hear a river argue.”", fx: "b.ione+1 hope+1" },
            ] },
            "ione: It was terrible, child. And it ended. The Hush did not end. That is the difference between a war and a wound.",
        ],
        [
            "@show ione l",
            "ione: You want to know about Odrane. Before he was Hierarch, before he was anything. He used to come to my wood to read.",
            "ione: He was afraid of everything. Thunder. Dogs. Girls. His own magic, most of all. He had more of it than Ostrander, you know. Much more. It frightened him every day of his life.",
            "ione: I think he wanted to put it somewhere it could not hurt anyone. And then he could not stop putting things there.",
            { choice: [
                { t: "“That doesn't excuse him.”", fx: "b.ione+1" },
                { t: "“Then he's been frightened for three hundred years.”", fx: "b.ione+1 hope+1 flag:understoododrane" },
            ] },
            "ione: No. It does not excuse him. But it explains him, and sometimes that is the first step to something better than hatred.",
        ],
        [
            "@show ione l",
            "ione: After? I will go home. The Eldwood needs a great deal of remembering. But first, take this.",
            "n: She opens her hand. In her bark palm lies a seed, the size of a plum stone, warm and faintly green.",
            "ione: From the heart of the great tree. If it all ends as I hope, plant it where the grey was deepest. It will know what to do.",
            { choice: [
                { t: "“I'll plant it in Vael, at the foot of the throne.”", fx: "b.ione+2 flag:seed" },
                { t: "“Keep it. Plant it yourself, after.”", fx: "b.ione+1 flag:seed" },
            ] },
            "ione: We will plant it together, then. Sleep, child. I will watch. I have slept enough.",
            "@fx hope+1",
        ],
    ],
    caius: [
        [
            "@show caius.soft l",
            "caius.soft: Do you mind if I sit? The others still don't quite know where to look when I'm near the fire.",
            "caius.soft: I keep reaching for my lantern. Eleven years I carried it. My hand doesn't know what to do without it.",
            "caius.soft: Tomorrow I'm going to walk into the cathedral where I was raised and help you break the man who raised me. I believed every word he said. I'd have burned you myself, in the forge, if he had asked.",
            { choice: [
                { t: "“But you didn't. You chose. That's the part that counts.”", fx: "b.caius+2 hope+1" },
                { t: "“I know. I'm still glad you're here.”", fx: "b.caius+1" },
            ] },
            "caius.soft: The sky's so loud tonight. All those stars. I don't know what I'll be, after. I've only ever been his.",
            "caius.soft: Maybe I'll learn to paint. Is that foolish?",
            "you: No more foolish than a scavenger opening seven wards.",
            "caius.soft: ...No. I suppose not.",
        ],
    ],
};
