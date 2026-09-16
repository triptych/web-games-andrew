/**
 * chapter_hollow.js — the wolf, properly, and the witch behind it.
 *
 * Phase 2's wolf questline was three nodes long: Hollow says go, you fight,
 * you come back. The fight was also the only way to resolve it, in a game
 * whose own design doc says battles should be "light danger", not the point.
 *
 * So: the wolf is now tracked, and can be fought, fed, or turned aside with
 * a steady enough hand; it has a den and a reason; and Hollow gets the
 * thirty-year backstory the village kept hinting at, plus the reveal that
 * drives the last act.
 */

export const HOLLOW_NODES = {
    // ------------------------------------------------------------
    // Tracking the wolf
    // ------------------------------------------------------------
    wolf_track_start: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'North of the cottage the path gives up pretending to be a path. Bracken to the knee, and the light going green and strange.',
            'There is sign everywhere once you know to look: a scrape, a pressed hollow of ferns, and prints in the soft ground by the runnel.',
        ],
        choices: [
            {
                label: '(Kneel and actually read the tracks)',
                next: 'wolf_track_read',
                requires: { minStat: { wit: 5 } },
                effects: [],
            },
            { label: 'Something pale is caught in the brambles.', next: 'wolf_track_collar', requires: { flag: 'foundCollar', negate: true }, effects: [] },
            { label: 'Push on toward the fern hollow.', next: 'fern_hollow_arrive', requires: null, effects: [] },
        ],
    },

    wolf_track_read: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'You take your time over it, the way the journal describes taking your time over anything worth getting right.',
            'One adult, and she is thin — the stride is long and the print is shallow. She is not ranging. She goes out and she comes back, out and back, along the same line, which is what an animal does when it has something it cannot leave.',
            'And on the return leg, every time, she carries. There are drag marks. There is a den at the end of this, and there are mouths in it.',
        ],
        effects: [
            { type: 'setFlag', flag: 'wolfTracksRead', value: true },
            { type: 'addLore', lore: 'lore_wolfden' },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: 'Something pale is caught in the brambles.', next: 'wolf_track_collar', requires: { flag: 'foundCollar', negate: true }, effects: [] },
            { label: 'Push on toward the fern hollow.', next: 'fern_hollow_arrive', requires: null, effects: [] },
        ],
    },

    wolf_track_collar: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'A dog’s collar, hanging in the brambles at knee height. Brown leather, cheap brass, the name scratched on by a child with a nail: BISCUIT.',
            'The leather is chewed through, not torn. Whatever else happened here, the dog did this part itself — and then went on, deeper, instead of back toward the smell of home.',
        ],
        effects: [
            { type: 'giveItem', item: 'biscuit_collar', count: 1 },
            { type: 'setFlag', flag: 'foundCollar', value: true },
        ],
        choices: [
            { label: 'Push on toward the fern hollow.', next: 'fern_hollow_arrive', requires: null, effects: [] },
        ],
    },

    fern_hollow_arrive: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: [
            'The fern hollow is a green bowl of a place, close and dim and quieter than the wood around it.',
            'She is standing in the middle of it, and she has been watching you come for some time. Ribs like a hand of cards. Hackles up. A low, continuous sound that is not quite a growl — more the noise of an animal deciding.',
            'She is between you and the far bank, and she is not moving off it.',
        ],
        choices: [
            {
                label: '(Put yourself between her and the village. Fight.)',
                next: 'hedge_wolf_fight',
                requires: null,
                effects: [],
            },
            {
                label: '(Break the Ninebark loaf and roll half of it across the ferns)',
                next: 'wolf_fed',
                requires: { item: 'ninebark_loaf' },
                effects: [],
            },
            {
                label: '(Stand still, look at the ground, and let her decide)',
                next: 'wolf_warded',
                requires: { minStat: { wit: 6 } },
                effects: [],
            },
            {
                label: '(Drink the Steady-Hand Tea and hold your nerve)',
                next: 'wolf_warded',
                requires: { item: 'steady_hand_tea' },
                effects: [ { type: 'removeItem', item: 'steady_hand_tea', count: 1 } ],
            },
            {
                label: '(Back out of the hollow the way you came)',
                next: 'wolf_backed_off',
                requires: null,
                effects: [],
            },
        ],
    },

    wolf_backed_off: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: 'You back out with your hands where she can see them. She does not follow. The problem is exactly where you left it, which is to say: still here, still hungry, still a hundred yards from a village full of children.',
        choices: [
            { label: 'Go back in and settle it.', next: 'fern_hollow_arrive', requires: null, effects: [] },
            { label: 'Go back to Hollow and say you couldn’t.', next: 'hollow_thanks', requires: null, effects: [ { type: 'setFlag', flag: 'lostToHedgeWolf', value: true } ] },
        ],
    },

    wolf_fed: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: [
            'The loaf lands short of her and rocks to a stop in the ferns. Spice root and old grain, and a smell nineteen years out of date, and — apparently — irresistible.',
            'She does not lunge. She comes forward one careful foot at a time with her eyes on you the whole way, takes it, and retreats to the far bank to eat it in four appalling swallows.',
            'Then she stands there looking at you, and the deciding-noise has stopped, and after a moment she turns and goes up the bank — and at the top she stops and looks back, which is the closest thing to an invitation a wild animal ever gives anybody.',
        ],
        effects: [
            { type: 'removeItem', item: 'ninebark_loaf', count: 1 },
            { type: 'setFlag', flag: 'wolfFed', value: true },
            { type: 'setFlag', flag: 'wolfSparedPeacefully', value: true },
            { type: 'giveXp', amount: 24 },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
        ],
        choices: [
            { label: '(Follow her up the bank)', next: 'wolf_den', requires: null, effects: [] },
        ],
    },

    wolf_warded: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: [
            'You stop. You drop your gaze to the ferns in front of her feet, and you make yourself small and slow and profoundly boring, and you wait.',
            'It takes a very long time. Your legs start to shake somewhere in the middle of it and you let them.',
            'The growl thins out. She circles — wide, wary, keeping the distance you gave her — and then she goes past you up the bank at a trot, and does not look back until she is at the top, where she stops. And looks back.',
        ],
        effects: [
            { type: 'setFlag', flag: 'wolfWarded', value: true },
            { type: 'setFlag', flag: 'wolfSparedPeacefully', value: true },
            { type: 'giveXp', amount: 26 },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
        ],
        choices: [
            { label: '(Follow her up the bank)', next: 'wolf_den', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // The den. Reached from every resolution of the fern hollow — winning,
    // losing, feeding, or warding — because the point of the scene is what
    // it does to the meaning of whatever you just did.
    // ------------------------------------------------------------
    wolf_den: {
        speaker: null,
        portrait: 'narrator',
        background: 'wolf_den',
        text: [
            'The den is under a fallen ash on the far side of the bank: a dug-out hollow, roofed with roots, smelling of warm animal and old rain.',
            'There are three of them in it. Blunt-faced, fat-pawed, entirely unimpressed by you. One of them yawns.',
            'The mother stands off at ten paces with her ears flat, doing the arithmetic every parent does — and she does not attack, and she does not run, because she cannot do either.',
        ],
        effects: [ { type: 'addLore', lore: 'lore_wolfden' } ],
        choices: [
            {
                label: '(Leave what food you have at the den mouth)',
                next: 'wolf_den_feed',
                requires: { item: 'ninebark_loaf' },
                effects: [],
            },
            {
                label: '(Leave the honey tonic — it is all you have on you)',
                next: 'wolf_den_feed',
                requires: { item: 'honey_tonic', notItem: 'ninebark_loaf' },
                effects: [ { type: 'removeItem', item: 'honey_tonic', count: 1 } ],
            },
            {
                label: '(You have nothing to give her, and you say so out loud, like an idiot)',
                next: 'wolf_den_empty_handed',
                requires: { noneFlags: ['fedTheCubs'], notItem: 'ninebark_loaf' },
                effects: [],
            },
            {
                label: '(There is a shed tooth at the den mouth. Take it.)',
                next: 'wolf_den_tooth',
                requires: { flag: 'tookWolfTooth', negate: true },
                effects: [],
            },
            { label: '(Back away and leave them be)', next: 'wolf_den_leave', requires: null, effects: [] },
        ],
    },

    wolf_den_empty_handed: {
        speaker: null,
        portrait: 'narrator',
        background: 'wolf_den',
        text: [
            '“I haven’t got anything,” you tell a wolf, in a wood, at some distance from any witnesses. “I came out here to move you on and I didn’t bring so much as a heel of bread.”',
            'She does not care, obviously. She goes on standing at ten paces doing her arithmetic.',
            'You go back the next week with food, and the week after that, and it is not a thing you ever mention to anybody in the village — but you go.',
        ],
        effects: [
            { type: 'setFlag', flag: 'promisedTheCubs', value: true },
            { type: 'giveXp', amount: 8 },
        ],
        choices: [
            { label: '(Back away and leave them be)', next: 'wolf_den_leave', requires: null, effects: [] },
        ],
    },

    wolf_den_feed: {
        speaker: null,
        portrait: 'narrator',
        background: 'wolf_den',
        text: [
            'You set it down at the den mouth and back off further than you need to, and sit on your heels in the wet, and watch her work out whether you are a trick.',
            'She decides you are not. She eats, and then the cubs get at it, and the noise they make is undignified and enormous.',
            'It is not a solution. It is one day’s food and a wood that has stopped feeding her. But it is today, and today is where you live.',
        ],
        effects: [
            { type: 'setFlag', flag: 'fedTheCubs', value: true },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Go)', next: 'wolf_den_leave', requires: null, effects: [] },
        ],
    },

    wolf_den_tooth: {
        speaker: null,
        portrait: 'narrator',
        background: 'wolf_den',
        text: 'A shed canine lying at the den mouth in the leaf litter, root-end worn, dropped rather than lost. You pick it up, and the mother watches you do it, and does not come any closer, and does not object.',
        effects: [
            { type: 'giveItem', item: 'wolfmother_tooth', count: 1 },
            { type: 'setFlag', flag: 'tookWolfTooth', value: true },
        ],
        choices: [
            { label: '(Back away and leave them be)', next: 'wolf_den_leave', requires: null, effects: [] },
        ],
    },

    wolf_den_leave: {
        speaker: null,
        portrait: 'narrator',
        background: 'wolf_den',
        text: [
            'You go the long way round, and you do not look back more than three times.',
            'Whatever else the Whisperwood is doing this season, it pushed a mother and three cubs out of the deep wood and up against a village fence, and it did not do that because it is cruel. It did it because something behind her is worse.',
        ],
        effects: [
            { type: 'setFlag', flag: 'sawTheDen', value: true },
            { type: 'setFlag', flag: 'wolfResolved', value: true },
            { type: 'completeQuest', quest: 'q_wolf' },
        ],
        choices: [
            { label: 'Go and tell Hollow.', next: 'hollow_thanks', requires: null, effects: [] },
        ],
    },

    hedge_wolf_rematch: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: 'You go back to the fern hollow with your knees steadier and your bag heavier, and she is exactly where she was, and this time neither of you wastes any time on deciding.',
        battle: 'hedge_wolf',
        onWin: 'hedge_wolf_won',
        onLose: 'hedge_wolf_lost',
        choices: [],
    },

    // ------------------------------------------------------------
    // Hollow's hub — the thirty years, the stone, the rune.
    // ------------------------------------------------------------
    hollow_hub: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: 'She is on the porch with her knife and a bundle of something, which is how she is always found, and which you are fairly sure is at least partly a performance.',
        choices: [
            { label: 'Sessily told me you were my aunt’s apprentice.', next: 'hollow_history', requires: { allFlags: ['sessilyToldHollow'], flag: 'hollowToldHistory', negate: true }, effects: [] },
            { label: '(Show her the journal page with the stone and the fire)', next: 'hollow_ward_reveal', requires: { allFlags: ['hasJournal'], flag: 'hollowToldWard', negate: true }, effects: [] },
            { label: 'There are cubs. She has cubs.', next: 'hollow_cubs', requires: { allFlags: ['sawTheDen'], flag: 'hollowToldCubs', negate: true }, effects: [] },
            {
                label: 'I need a boundary mark cut into slate.',
                next: 'hollow_cut_rune',
                requires: { questActive: 'q_rune', minAffinity: { hollow: 5 } },
                effects: [],
            },
            {
                label: '(Ask her to teach you to cut it yourself)',
                next: 'hollow_teach_rune',
                requires: { questActive: 'q_rune', minStat: { wit: 7 } },
                effects: [],
            },
            {
                label: 'Is there anything that would make it *listen* instead of fight?',
                next: 'hollow_teach_tea',
                requires: { allFlags: ['hollowToldWard'], flag: 'knowsHearthboundTea', negate: true },
                effects: [],
            },
            {
                label: 'Come with me to the stone.',
                next: 'hollow_asked_along',
                requires: { questActive: 'q_ward', minAffinity: { hollow: 7 }, flag: 'hollowAlly', negate: true },
                effects: [],
            },
            { label: '(Head into the deep wood)', next: 'deep_wood_edge', requires: null, effects: [] },
            { label: '(Take the path back to the village)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    hollow_history: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'witch_cottage',
        text: [
            'The knife stops. “Sessily talks too much and always did.”',
            '“Eleven years. I came to her at fifteen with a burnt hand and no people and she taught me everything she knew and most of what she suspected.” The knife starts again, harder. “We walked out to the stone together every spring. Argued the whole way. Best days of my life, and I would not tell her that under torture.”',
            '“Then a child died in the autumn of the bad year, and this village needed it to be somebody’s fault, and I lived furthest out.” A shrug that has been practised for thirty years. “And she said nothing. Not one word, in the square, where it would have cost her something.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowToldHistory', value: true },
            { type: 'addLore', lore: 'lore_hollow_past' },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            {
                label: 'She was wrong. I’m sorry. It should have been said out loud thirty years ago.',
                next: 'hollow_apology',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 3 } ],
            },
            {
                label: 'And you kept the wood off us anyway. For thirty years.',
                next: 'hollow_apology',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 2 } ],
            },
            {
                label: 'That was a long time ago.',
                next: 'hollow_apology',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: -2 } ],
            },
        ],
    },

    hollow_apology: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: '“Mm.” She works the knife along the root for a while. “She sent me things, you know. Every spring. Never a note. Just — a jar on the step, of something I’d run out of.” The knife stops again. “Thirty years of jars and not one word. Ashgroves.”',
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_cubs: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            '“Cubs,” she repeats, and closes her eyes briefly. “Of course there are cubs. That’s why she wouldn’t move on and that’s why she was bold enough to come at a fence.”',
            '“She’s not the problem, apothecary. She was never the problem. She was a symptom with teeth.” She sets the knife down entirely, which you have not seen her do. “Something has pushed her out of a range her family has held for twenty generations. And I have been telling this village that for four months, and this village does not take letters from me.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowToldCubs', value: true },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
            { type: 'giveXp', amount: 8 },
        ],
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_ward_reveal: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'witch_cottage',
        text: [
            'She takes the journal out of your hands without asking, finds the page, and goes very still.',
            '“She kept it up.” Barely a voice at all. “Thirty years of not speaking to me and she walked out to that stone every single spring on her own and kept it lit.”',
            '“It’s not a spell. Everyone wants it to be a spell.” She turns the book round to show you. “A flat stone with a bowl in it, at the middle of the wood. A live coal off a hearth someone still keeps. The mark cut fresh — it weathers, it has to be cut every year. And a gift the wood gives you, that you did not take.”',
            '“Three things and a night sitting up with a fire. That’s the whole of it. And it has been cold since June, and everything in that wood can feel it, and they are all coming *this way* because the middle has stopped holding.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowToldWard', value: true },
            { type: 'startQuest', quest: 'q_ward' },
            { type: 'startQuest', quest: 'q_ember' },
            { type: 'startQuest', quest: 'q_rune' },
            { type: 'startQuest', quest: 'q_gift' },
            { type: 'addLore', lore: 'lore_unbinding' },
            { type: 'addLore', lore: 'lore_hearthstone' },
            { type: 'giveXp', amount: 20 },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
        ],
        choices: [
            {
                label: 'Then I’ll walk out there and light it.',
                next: 'hollow_ward_accept',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'acceptedTheWalk', value: true },
                    { type: 'addAffinity', npc: 'hollow', amount: 2 },
                ],
            },
            {
                label: 'Why haven’t *you* lit it, if you’ve known all along?',
                next: 'hollow_why_not',
                requires: null,
                effects: [],
            },
        ],
    },

    hollow_why_not: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'witch_cottage',
        text: [
            'It is the first time you have seen her flinch.',
            '“Because the coal has to come off a hearth someone still keeps,” she says, “and there is one hearth in this valley old enough and one baker willing to open his oven, and he is in a village that ran me out of it thirty years ago.”',
            '“I have stood at that fence post four times since June.” She picks the knife back up. “Four times. It is a hundred yards of cobbles and I could not do it. So no, I have not lit it, and yes, I have thought about that every night, thank you.”',
        ],
        effects: [ { type: 'setFlag', flag: 'hollowWhyNot', value: true } ],
        choices: [
            {
                label: 'Then I’ll get the coal. You cut the mark. We do it together.',
                next: 'hollow_ward_accept',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'acceptedTheWalk', value: true },
                    { type: 'addAffinity', npc: 'hollow', amount: 4 },
                ],
            },
        ],
    },

    hollow_ward_accept: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: '“Right.” She says it the way people say a thing they have been holding in their mouth for months. “Right. Ember, mark, gift. And you do not go in there after dark without all three, apothecary, because the middle of that wood is not currently a place that likes company.”',
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_cut_rune: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: [
            'She splits a palm of slate off the pile by the door, sets it on her knee, and cuts the mark into it freehand in about ninety seconds, without once looking at the journal.',
            '“Thirty years,” she says, when you look at her. “You think I forgot it?” She blows the dust off and hands it over, still warm from her hands. “Don’t drop it in a stream. Don’t let anybody helpful *improve* it. And don’t you dare thank me until it’s lit.”',
        ],
        effects: [
            { type: 'giveItem', item: 'ward_rune', count: 1 },
            { type: 'completeQuest', quest: 'q_rune' },
            { type: 'setFlag', flag: 'hasRune', value: true },
            { type: 'setFlag', flag: 'runeFromHollow', value: true },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_teach_rune: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: [
            '“You want to cut it yourself.” She looks at you a long moment. “Good. It ought to be somebody who’ll still be doing it in forty years.”',
            'It takes most of an afternoon and four ruined pieces of slate. The mark is three strokes and a closing turn, and the closing turn is the whole thing, and you get it wrong three times and then you don’t.',
            '“There,” she says, of the fifth one. “Ugly. Correct. Those are different words.”',
        ],
        effects: [
            { type: 'giveItem', item: 'ward_rune', count: 1 },
            { type: 'completeQuest', quest: 'q_rune' },
            { type: 'setFlag', flag: 'hasRune', value: true },
            { type: 'setFlag', flag: 'cutRuneYourself', value: true },
            { type: 'advanceDay', count: 1 },
            { type: 'addAffinity', npc: 'hollow', amount: 3 },
            { type: 'giveXp', amount: 20 },
        ],
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_teach_tea: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            '“Make it *listen*.” She almost laughs. “That was her question too. She was forty-three and furious that everything in her books was about driving things off.”',
            '“Spice root, two moonpetal, a strip of grey ash bark. Steep it long and drink it at the stone and it will not protect you in the slightest.” She holds your eye. “What it does is make you smell like a kept hearth. Like somewhere a frightened thing might be allowed to sit down.”',
            '“She called it hearthbound tea, which is a terrible name, and I have never told anyone else how to make it.”',
        ],
        effects: [
            { type: 'learnRecipe', flag: 'knowsHearthboundTea' },
            { type: 'giveItem', item: 'ash_bark', count: 1 },
            { type: 'addAffinity', npc: 'hollow', amount: 2 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },

    hollow_asked_along: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            'She is quiet for a long time.',
            '“Thirty years I have kept the edge of that wood on my own because nobody in this valley would walk out past the fence posts with me.” She stands, and knocks the dirt off her skirts with two hard slaps. “And now an Ashgrove asks. Again. As if the first one hadn’t.”',
            '“Yes. Obviously yes. Get the coal, and I will meet you at the fern hollow, and if you are late I will start without you.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowAlly', value: true },
            { type: 'addAffinity', npc: 'hollow', amount: 3 },
            { type: 'giveItem', item: 'moonpetal', count: 2 },
            { type: 'giveXp', amount: 16 },
        ],
        choices: [
            { label: '(Back)', next: 'hollow_hub', requires: null, effects: [] },
        ],
    },
};
