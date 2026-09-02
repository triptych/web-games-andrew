/**
 * endings.js — the Phase 6 endings.
 *
 * The five Phase 4 endings all closed on the same line — "this is where
 * this slice of your story ends, for now" — because there was no story
 * after them to point at. These eight are actual endings to an actual
 * season, and they differ on the three things the game has been quietly
 * tracking the whole time: whether the ward got lit, how you dealt with
 * the thing that came for it, and whether anybody was there with you.
 *
 * The original five remain reachable as early outs — you can still call
 * the season at the cold door, or after the hedge wolf, or at the edge of
 * the deep wood — so nothing that used to be an ending stopped being one.
 */

export const ENDING_NODES = {
    ending_hearthbound: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'You come out of the Whisperwood at nine in the morning smelling of woodsmoke, with grass seed in your hair and somebody’s arm through yours, and the village is already up and pretending not to have been worried.',
            'The birds came back that week. The boar goes back over the ridge where boars belong. The wolfmother moves her cubs deeper in October, into range that is hers again, and nobody in the village ever knows there was a den at all.',
            'You put a note on the notice board in your own handwriting, next to the weathered one you took down: *Walk out to the stone every spring. If I am not here, someone must.* Underneath it, over the winter, four other people add their names without being asked.',
            'The shop bell goes constantly now, which is exhausting, and the mortar on the workroom bench is the cracked one the wood gave back, and every year around this time you take down a brass lamp and go and sit up all night with a fire the size of a cupped hand.',
            'It is not hard, and it is not brave. It is only that somebody has to be the one who bothers — and this time, she isn’t doing it on her own.',
        ],
        choices: [],
        ending: true,
    },

    ending_ward_alone: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'You walk out of the wood on your own at dawn, and nobody knows where you have been, and you find you cannot explain it to anyone in a way that survives being said in a lit room.',
            'The ward is lit. The birds come back. The wood settles down over the autumn like a dog turning round three times, and the village goes on not knowing it was ever close to anything.',
            'You keep the journal on the workroom bench and add to it, in handwriting that is already getting worse, and you go out again the next spring, and you go alone again, because that is what you have got used to.',
            'On the last page she wrote that she was very lonely doing it and did not recommend that part. You have started, once or twice, to think about who you might ask.',
            'The fire is lit. That is the whole job, and you did it. The rest is next year’s.',
        ],
        choices: [],
        ending: true,
    },

    ending_thorn_broken: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'The ward is lit and the boundary is kept and the Whisperwood is, by every measure anybody in the village can name, safe again. You are the one who did that. There is even a version told in the bakery where you are considerably taller.',
            'What none of them ask about is the long grey mound in the ash ring at the heart of the wood, with grass coming up through it, that was frightened and enormous and had been on its own since June.',
            'Hollow does not say you were wrong. She says, "It was going to go for the fire and you stopped it going for the fire," in the flat voice of a woman putting something in a box.',
            'You go back the next spring with the lamp, and you light the bowl, and you sit up all night beside a mound of thorn, and it is a great deal quieter than you would like.',
            'The wood is kept. You would do it differently, if there were a way, and next year you intend to go looking for one.',
        ],
        choices: [],
        ending: true,
    },

    ending_carried_home: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'You lose the fight and the night both, and the ward is lit anyway, because somebody you asked to come with you sat in the dark for four hours feeding a fire the size of a cupped hand while a thing the size of a barn lay twenty feet away grieving.',
            'They will not let you forget it, and they will not let anyone else hear about it either, which is a particular kind of kindness.',
            'The Whisperwood settles. The birds come back. You spend eight days on a bed in the workroom being brought soup by people who complain the entire time about having to do it.',
            'What you take out of that autumn is not the fight, which you lost, and not the ward, which held. It is the arithmetic: you asked somebody to come, and they came, and that turned out to be the part that mattered.',
            'Next spring, you ask two.',
        ],
        choices: [],
        ending: true,
    },

    ending_guttering_coal: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'You went alone, and you lost, and the fire kept itself alive on a coal the size of a thumbnail for four hours while you were unconscious in the leaf mould, which is either luck or the wood deciding it was owed nothing further.',
            'It is lit. That is the whole of the job and it is, by the narrowest margin in forty-one years of somebody’s records, done.',
            'You walk home slowly, over two days, and do not tell anybody the details. Mira takes one look and asks nothing, which is worse.',
            'The journal now has your handwriting in it as well as hers. The first thing you wrote, on the ride home, was: *Do not go on your own. She was right. Ask somebody. Ask anybody.*',
            'You have all winter to work out who.',
        ],
        choices: [],
        ending: true,
    },

    ending_left_the_fire: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'You get out of the wood alive, and everyone you brought with you gets out alive, and there is a great deal to be said for that and you say all of it, several times, over the following weeks.',
            'The fire burns itself out in the stone bowl some time before morning, unfed, with nobody sitting up with it. The mark is cut and the gift is given and the ember was true, and none of that is the ritual; the ritual is the sitting up.',
            'The Whisperwood does not take revenge, because it was never that sort of thing. It simply goes on the way it has gone on since June: pressed up against a fence, with nothing at the middle holding, and everything in it slowly coming this way.',
            'You have the whole winter to think about it, and a brass lamp on the workroom bench, and a journal that tells you exactly what to do.',
            'There is always next spring. She got forty of them. You have used one.',
        ],
        choices: [],
        ending: true,
    },

    ending_shopkeeper: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_interior',
        text: [
            'You close the ledger on a good season, and it is a good season: the shelves are full, the debts are settled, and there are four people in this village who are markedly less in pain than they were in the spring.',
            'Tobin’s mother uses her arm. Widow Pell gets up the hill. Granny Sessily holds a cup after noon and pretends she always could. The carter’s girl breathes all the way down. That is not nothing. That is, in fact, the job.',
            'The Whisperwood keeps its own counsel at the edge of everything, quieter than it should be, and the birds do not come back, and one night in November something goes through the barley that nobody gets a proper look at.',
            'You keep the brass lamp on the workroom bench where you can see it from the counter. You are not pretending it isn’t there. You are simply, this year, a person who ran a shop very well.',
            'Spring is four months away. The lamp will still be there.',
        ],
        choices: [],
        ending: true,
    },

    ending_watchward: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'The watch stays a fortnight in the end — a picket on the lane and the herb patch, no more beating the hedgerows, and Dorne writing a report that says, in the end, very little and implies a great deal.',
            'Nothing else comes out of the wood that autumn. Nothing goes in, either. The fence line holds because there are four spears on it, which is a way of solving a problem, and the county files it as solved.',
            'Hollow comes into the village twice more that year, both times as far as the bakery door, and both times somebody says good morning to her and both times she is too surprised to answer.',
            'The stone at the heart of the Whisperwood stays cold, and the rainwater sits in the bowl, and everybody in the valley gets through the winter perfectly well by simply not going in there.',
            'Dorne, riding out, says the thing you will think about all winter: "Spears hold a line. They don’t mend one." Then she asks you to write, next spring, and tell her whether you went.',
        ],
        choices: [],
        ending: true,
    },
};
