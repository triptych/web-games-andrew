/**
 * chapter_deepwood.js — the Whisperwood as a place, not a corridor.
 *
 * Phase 3's deep wood was four nodes in a straight line ending in "head
 * home". Hollow's own line — "something in the deep wood is changing what
 * lives there, I don't know what yet" — was left hanging, and every ending
 * shrugged at it.
 *
 * This chapter answers it: the wood has a middle, the middle has a cold
 * hearth-stone in it, and getting there takes an ember, a cut rune, and a
 * gift the wood decides to give you.
 */

export const DEEPWOOD_NODES = {
    // ------------------------------------------------------------
    // The tree line, as a place you can come back to.
    // ------------------------------------------------------------
    whisperwood_gate: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: 'The last fence post, and then the wood: cool, green, enormously patient, and — this season — far too quiet.',
        choices: [
            { label: 'Take the path to Hollow’s cottage.', next: 'hollow_hub', requires: { flag: 'metHollow' }, effects: [] },
            { label: 'Follow the smoke to the cottage.', next: 'whisperwood_first_look', requires: { flag: 'metHollow', negate: true }, effects: [] },
            {
                label: 'North to the fern hollow, where the wolf is.',
                next: 'wolf_track_start',
                requires: { allFlags: ['hollowSentYou'], flag: 'wolfResolved', negate: true },
                effects: [],
            },
            {
                label: 'North to the fern hollow — try the wolf again.',
                next: 'hedge_wolf_rematch',
                requires: { allFlags: ['lostToHedgeWolf'], flag: 'wolfSparedPeacefully', negate: true },
                effects: [],
            },
            { label: 'Past the ferns, into the deep wood.', next: 'deep_wood_edge', requires: null, effects: [] },
            {
                label: 'Work the deep-wood shade for moonpetal and bark.',
                next: 'deepwood_gather',
                requires: { visited: 'deep_wood_edge' },
                effects: [],
            },
            {
                label: 'Look for Bramwell’s spice root past the ferns.',
                next: 'spice_root_patch',
                requires: { questActive: 'q_spice_root', flag: 'gotSpiceRoot', negate: true },
                effects: [],
            },
            {
                label: 'Search the ferns for Tobin’s dog.',
                next: 'biscuit_search',
                requires: { questActive: 'q_biscuit' },
                effects: [],
            },
            {
                label: 'Walk in toward the heart of the wood.',
                next: 'heart_approach',
                requires: { questActive: 'q_ward' },
                effects: [],
            },
            { label: 'Back to the village.', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    deepwood_gather: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'A day’s careful work in the deep shade: moonpetal where the light never quite lands, and grey ash bark peeled from the trunks that have already shed it.',
            'You take only what has been dropped, because there is a line in the journal, underscored twice, that says *TAKE THE FALLEN. THE WOOD KEEPS ACCOUNTS.*',
        ],
        effects: [
            { type: 'advanceDay', count: 1 },
            { type: 'giveItem', item: 'moonpetal', count: 2 },
            { type: 'giveItem', item: 'ash_bark', count: 2 },
        ],
        choices: [
            { label: 'Work another day at it.', next: 'deepwood_gather', requires: null, effects: [] },
            { label: '(Back to the tree line)', next: 'whisperwood_gate', requires: null, effects: [] },
        ],
    },

    spice_root_patch: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: [
            'Past the ferns, on a south-facing bank where the light gets in, the spice root grows exactly where a sixty-one-year-old baker’s knees cannot go.',
            'You dig up two good ones and backfill the holes, and the smell that comes off the broken end is peppery and warm and belongs, unmistakably, in a kitchen.',
        ],
        effects: [
            { type: 'giveItem', item: 'spice_root', count: 2 },
            { type: 'setFlag', flag: 'gotSpiceRoot', value: true },
            { type: 'advanceDay', count: 1 },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back to the tree line)', next: 'whisperwood_gate', requires: null, effects: [] },
        ],
    },

    biscuit_search: {
        speaker: null,
        portrait: 'narrator',
        background: 'fern_hollow',
        text: [
            'You spend the better part of a day calling a stupid name into a wood that does not answer.',
            'And then, at the top of the fern bank where the ground starts to rise toward the deep wood, something brown and filthy and shaking comes out of a hollow log at a dead run and hits you in the shins.',
        ],
        effects: [
            { type: 'setFlag', flag: 'foundBiscuit', value: true },
            { type: 'completeQuest', quest: 'q_biscuit' },
            { type: 'advanceDay', count: 1 },
            { type: 'giveXp', amount: 16 },
            { type: 'addAffinity', npc: 'tobin', amount: 3 },
        ],
        choices: [
            { label: '(Sit down in the ferns and let the dog have its moment)', next: 'biscuit_found', requires: null, effects: [] },
        ],
    },

    biscuit_found: {
        speaker: null,
        portrait: 'biscuit',
        background: 'fern_hollow',
        text: [
            'He is thin, and one ear is torn, and he has been eating something he should not have been eating. He is also entirely, extravagantly delighted, which goes on for some minutes.',
            'When it stops he turns and looks — uphill, into the deep wood, toward the middle of it — and makes a sound in his chest that is not quite a whine.',
            'Then he takes three steps that way and looks back at you. Whatever chewed him out of that collar and sent him further in, he has apparently decided to go back with company.',
        ],
        effects: [ { type: 'setFlag', flag: 'biscuitFollows', value: true } ],
        choices: [
            { label: 'Take him home to Tobin first.', next: 'village_hub', requires: null, effects: [] },
            { label: '(Back to the tree line)', next: 'whisperwood_gate', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Walking in. The three requirements are enforced as gated choices
    // rather than a check, so a player who's missing one is told exactly
    // what they're missing instead of just having the option vanish.
    // ------------------------------------------------------------
    heart_approach: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'Inward is a direction the Whisperwood has opinions about. The path such as it is stops pretending after half a mile, and after that it is bearings, and slope, and the sense of going deliberately toward something.',
            'Everything living gets out of your way well ahead of you. That is new, and it is worse than being watched.',
        ],
        choices: [
            {
                label: '(Go on to the stone — you have the ember, the rune, and the wood’s gift)',
                next: 'heart_arrival',
                requires: { allFlags: ['hasEmber', 'hasRune', 'hasGift'] },
                effects: [],
            },
            {
                label: '(You have no fire. The lamp has to be lit from a hearth someone keeps.)',
                next: 'whisperwood_gate',
                requires: { flag: 'hasEmber', negate: true },
                effects: [],
            },
            {
                label: '(You have no mark. Sit down with the journal and cut one yourself.)',
                next: 'rune_by_the_book',
                requires: { allFlags: ['hasEmber'], flag: 'hasRune', negate: true },
                effects: [],
            },
            {
                label: '(Something has to be given, and nothing has been. Wait on the wood.)',
                next: 'woods_gift',
                requires: { allFlags: ['hasEmber', 'hasRune'], flag: 'hasGift', negate: true },
                effects: [],
            },
            { label: '(Turn back for now)', next: 'whisperwood_gate', requires: null, effects: [] },
        ],
    },

    // The last-resort route to the second requirement: no affinity, no Wit,
    // no teacher — just the journal, a lot of slate, and a bad night. It is
    // worse than Hollow's and the story says so, but it means no earlier
    // choice can lock a player out of finishing the season.
    rune_by_the_book: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'You do it out of the book, by firelight, on a flat rock, with a knife meant for roots.',
            'Three strokes and a closing turn. The strokes are easy. The closing turn defeats you eleven times, and the twelfth is not good — it is shallow where it should bite and it wanders at the end — but it is the mark, and it is cut fresh, and the journal does not anywhere say it has to be *pretty*.',
            'Your hands are a mess. It has cost you a day and most of your temper. Hollow, if she ever sees it, is going to have a great deal to say.',
        ],
        effects: [
            { type: 'giveItem', item: 'ward_rune', count: 1 },
            { type: 'setFlag', flag: 'hasRune', value: true },
            { type: 'setFlag', flag: 'runeCutRough', value: true },
            { type: 'advanceDay', count: 1 },
            { type: 'giveXp', amount: 12 },
        ],
        choices: [
            { label: '(On, then)', next: 'heart_approach', requires: null, effects: [] },
        ],
    },

    // The third requirement. Several routes in, all of them earned earlier
    // in the season — plus a slow one that always works, so nobody can be
    // hard-locked out of the ending by an earlier choice.
    woods_gift: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'It cannot be taken. The journal is emphatic about this in a way it is emphatic about nothing else: *THE THIRD THING IS NOT A COMPONENT. IT IS A CONSENT.*',
            'So you sit down against an ash with your back to the trunk, and you put your hands where they can be seen, and you wait for the wood to make up its mind about you.',
        ],
        choices: [
            {
                label: '(The wolfmother comes to the edge of the clearing)',
                next: 'gift_wolf',
                requires: { flag: 'wolfSparedPeacefully' },
                effects: [],
            },
            {
                label: '(Something pale-eyed drops a feather from the canopy)',
                next: 'gift_owl',
                requires: { flag: 'sparedTheStalker' },
                effects: [],
            },
            {
                label: '(The dog digs at the ash roots and will not stop)',
                next: 'gift_dog',
                requires: { flag: 'biscuitFollows' },
                effects: [],
            },
            {
                label: '(Just wait. However long it takes.)',
                next: 'gift_patience',
                requires: null,
                effects: [],
            },
        ],
    },

    gift_wolf: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'She comes out of the bracken at forty feet and stops, and you do not move, and this has happened before and you both know how it goes.',
            'She has something in her jaws. She sets it down in the leaf mould — a knot of ash root, worn smooth, that no animal has any use for whatsoever — and backs away from it three steps, and waits, pointedly, until you pick it up.',
            'Then she goes, unhurried, the way an animal goes when it has finished a piece of business.',
        ],
        effects: [
            { type: 'giveItem', item: 'woods_gift', count: 1 },
            { type: 'setFlag', flag: 'hasGift', value: true },
            { type: 'setFlag', flag: 'giftFromWolf', value: true },
            { type: 'completeQuest', quest: 'q_gift' },
            { type: 'giveXp', amount: 18 },
        ],
        choices: [
            { label: '(On to the stone)', next: 'heart_arrival', requires: null, effects: [] },
        ],
    },

    gift_owl: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'You do not hear it arrive, because you never do.',
            'A single primary feather comes down through the green light, turning over and over, and lands across your open hands as precisely as if it had been aimed — which, you are increasingly certain, it was.',
            'When you look up there is nothing on the branch, and there has not been for some time.',
        ],
        effects: [
            { type: 'giveItem', item: 'woods_gift', count: 1 },
            { type: 'setFlag', flag: 'hasGift', value: true },
            { type: 'setFlag', flag: 'giftFromOwl', value: true },
            { type: 'completeQuest', quest: 'q_gift' },
            { type: 'giveXp', amount: 18 },
        ],
        choices: [
            { label: '(On to the stone)', next: 'heart_arrival', requires: null, effects: [] },
        ],
    },

    gift_dog: {
        speaker: null,
        portrait: 'biscuit',
        background: 'deep_whisperwood',
        text: [
            'Biscuit digs at the ash roots with the single-minded idiocy of his kind for a full ten minutes, and you let him, because it is better than sitting still.',
            'What he pulls out is a mortar — small, stone, cracked across the base, the sort of thing a person carries out into a wood once a year for forty years and finally leaves behind because their hands have got too stiff.',
            'It is hers. The wood kept it, and it has decided, via the offices of an extremely stupid dog, to give it back.',
        ],
        effects: [
            { type: 'giveItem', item: 'woods_gift', count: 1 },
            { type: 'setFlag', flag: 'hasGift', value: true },
            { type: 'setFlag', flag: 'giftFromDog', value: true },
            { type: 'completeQuest', quest: 'q_gift' },
            { type: 'giveXp', amount: 18 },
        ],
        choices: [
            { label: '(On to the stone)', next: 'heart_arrival', requires: null, effects: [] },
        ],
    },

    gift_patience: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'You sit against the ash for the rest of that day, and the night, and most of the next day, and it is cold and dull and your legs go to sleep and nothing happens at all for a very long time.',
            'And then, at about the hour when you have genuinely started composing an apology to Hollow, a hazel drops a nut into your lap. One. From a hazel with nothing else on it.',
            'It is a joke, obviously. It is the wood being funny at your expense. It is also, unmistakably, given.',
        ],
        effects: [
            { type: 'giveItem', item: 'woods_gift', count: 1 },
            { type: 'setFlag', flag: 'hasGift', value: true },
            { type: 'setFlag', flag: 'giftFromPatience', value: true },
            { type: 'completeQuest', quest: 'q_gift' },
            { type: 'advanceDay', count: 2 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(On to the stone)', next: 'heart_arrival', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // The Hollow Heart
    // ------------------------------------------------------------
    heart_arrival: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'The middle of the Whisperwood is a clearing about the size of a barn floor, ringed with ash so old they have gone grey and thin at the top, and it is the most silent place you have ever stood in.',
            'And there it is. A flat stone the size of a table, with a shallow bowl cut into the top of it, and the boundary mark cut around the rim in three strokes and a closing turn, weathered nearly smooth.',
            'The bowl has four months of rainwater in it, and a skin of leaf rot, and a dead moth. Nobody has been here since June.',
        ],
        effects: [
            { type: 'setFlag', flag: 'foundTheStone', value: true },
            { type: 'addLore', lore: 'lore_thorn' },
            { type: 'giveXp', amount: 24 },
        ],
        choices: [
            { label: '(Kneel down and start clearing the bowl)', next: 'heart_clearing_bowl', requires: null, effects: [] },
        ],
    },

    heart_clearing_bowl: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'You tip out the water and scrape the rot and set the dead moth on the grass, and lay the cut rune in the notch on the rim where a cut rune has evidently gone for a very long time.',
            'And the clearing changes its mind about you.',
            'Not violently. The light goes a shade further from green. Every ash around the ring leans in about an inch, which is not a thing that ashes do, and out beyond the ring something enormous begins moving through the bracken without hurrying at all.',
        ],
        choices: [
            { label: '(Keep working. Light the bowl.)', next: 'bramble_wight_fight', requires: null, effects: [] },
        ],
    },

    bramble_wight_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: 'What comes out of the bracken first is not the enormous thing. It is a knot of thorn and dead ash and old bramble, walking, and it comes across the clearing at the stone — not at you, at the *stone* — with its whole intent on knocking your fire over before you can light it.',
        battle: 'bramble_wight',
        onWin: 'bramble_wight_won',
        onLose: 'bramble_wight_lost',
        choices: [],
    },

    bramble_wight_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'It comes apart into what it was made of — thorn, and dead ash, and a great deal of old bramble — and lies there being nothing but garden waste.',
            'You are bleeding in four places and the stone is untouched, which is the trade you would have taken.',
        ],
        effects: [ { type: 'giveXp', amount: 40 } ],
        choices: [
            { label: '(Set the lamp on the stone)', next: 'ward_relight', requires: null, effects: [] },
        ],
    },

    bramble_wight_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'It puts you on your back across the roots and goes for the stone, and you get a hand on the lamp — just the lamp — and roll, and it comes apart against the rim in a shower of thorn instead of taking your head off.',
            'The lamp is intact. The shutter held. You lie in the leaf mould laughing in a way that is not entirely under your control, and then you get up, because the light is going.',
        ],
        effects: [
            { type: 'setFlag', flag: 'wightBestedYou', value: true },
            { type: 'giveXp', amount: 16 },
        ],
        choices: [
            { label: '(Set the lamp on the stone)', next: 'ward_relight', requires: null, effects: [] },
        ],
    },

    ward_relight: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'Ember, mark, gift. You lay the wood’s gift in the bowl — the root knot, the feather, the cracked mortar, the absurd hazelnut — and open the shutter of the lamp and tip four months of somebody’s kept fire onto it.',
            'It takes. Small, and blue at the edges, and then properly: a fire the size of a cupped hand, burning in a stone bowl in the middle of a wood, which is the entire ritual and always was.',
            'The journal says the rest in six words, in handwriting that got worse every year she wrote it: *AND THEN YOU SIT UP WITH IT.*',
        ],
        effects: [
            { type: 'removeItem', item: 'lit_hearth_lamp', count: 1 },
            { type: 'removeItem', item: 'woods_gift', count: 1 },
            { type: 'setFlag', flag: 'wardLit', value: true },
            { type: 'completeQuest', quest: 'q_ward' },
            { type: 'giveXp', amount: 30 },
        ],
        choices: [
            { label: '(Sit down by the fire)', next: 'camp_night', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // The long sit. Four variants depending on who, if anyone, came with
    // you — this is what the whole affinity system has been for.
    // ------------------------------------------------------------
    camp_night: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: 'The light goes out of the clearing from the bottom up, the way it does in a wood, and the little fire in the stone bowl becomes the only argument against the dark.',
        choices: [
            { label: '(The night with Hollow)', next: 'camp_night_hollow', requires: { flag: 'hollowAlly' }, effects: [] },
            { label: '(The night with Bramwell)', next: 'camp_night_bramwell', requires: { flag: 'bramwellAlly' }, effects: [] },
            { label: '(The night with Mira)', next: 'camp_night_mira', requires: { flag: 'miraAlly' }, effects: [] },
            {
                label: '(The night alone)',
                next: 'camp_night_alone',
                requires: { noneFlags: ['hollowAlly', 'bramwellAlly', 'miraAlly'] },
                effects: [],
            },
        ],
    },

    camp_night_hollow: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'night_camp',
        text: [
            'She sits down on the other side of the stone with her back to a root and does not say anything for an hour and a half, and it is the least uncomfortable silence you have ever been in.',
            '“Eleven years,” she says eventually, to the fire. “We did this eleven times together and every single time she brought the wrong food and complained about mine.”',
            '“The last one, she said — ” Hollow stops. Starts again. “She said, ‘One of us should teach somebody, or this dies with the pair of us.’ And I said, ‘Teach them yourself, you have a shop full of people who’d walk in front of a cart for you,’ and she said nothing, and the next spring the village had its bad autumn and that was that.”',
            'She looks up. The fire is in her eyes and something else is too. “She meant *you*. Thirty years early, and she meant *you*, and she was too proud to write and ask.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'nightWithHollow', value: true },
            { type: 'addAffinity', npc: 'hollow', amount: 4 },
            { type: 'giveXp', amount: 20 },
        ],
        choices: [
            {
                label: 'Then teach me. Properly. Every spring, until I can do it without you.',
                next: 'camp_night_end',
                requires: null,
                effects: [
                    { type: 'addAffinity', npc: 'hollow', amount: 3 },
                    { type: 'setFlag', flag: 'promisedToKeepIt', value: true },
                ],
            },
            { label: 'She was proud. So are you. It skipped a generation, apparently.', next: 'camp_night_end', requires: null, effects: [] },
        ],
    },

    camp_night_bramwell: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'night_camp',
        text: [
            'He sits with the oiled cloth bundle across his knees, unopened, and feeds the little fire twig by twig with enormous care, the way a man does when he needs his hands occupied.',
            '“Last time I sat up in a wood in the dark,” he says, “there were nine of us and we were waiting for morning to do something stupid.”',
            '“This is better. Bit cold. Better.” The fire pops. “Do you know what I keep thinking? Ivar would have loved this. Sitting out all night keeping a fire alight so a wood doesn’t get lonely. He’d have thought it was the funniest thing he ever heard and he’d have come every year.”',
            'A long pause. “Nineteen years I’ve had that name in my mouth. Said it twice this month. That’s your doing.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'nightWithBramwell', value: true },
            { type: 'addAffinity', npc: 'bramwell', amount: 4 },
            { type: 'giveXp', amount: 20 },
        ],
        choices: [
            {
                label: 'Then bring him next year. Bring the loaf, and say all eight of the others.',
                next: 'camp_night_end',
                requires: null,
                effects: [
                    { type: 'addAffinity', npc: 'bramwell', amount: 3 },
                    { type: 'setFlag', flag: 'promisedToKeepIt', value: true },
                ],
            },
            { label: 'Get some sleep, Bramwell. I’ll take the first watch.', next: 'camp_night_end', requires: null, effects: [] },
        ],
    },

    camp_night_mira: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'night_camp',
        text: [
            'She is frightened, and is dealing with it by reorganising the entire contents of both your bags twice.',
            '“Nine years,” she says, on the second pass. “Nine years of watching her walk out that door with the brass lamp and never once telling me where she was going.” She stops, with a jar in each hand. “I thought she didn’t trust me.”',
            '“And it turns out it was *this*. Sitting up all night in the cold minding a fire the size of a pudding basin.” Her voice goes thin. “I would have come. Every year. She only had to say.”',
            'She puts the jars down and sits, finally, and looks at the little fire in the stone. “Don’t you dare do that to me. If you’ve got a thing that needs doing, you say so, and I’ll get my boots.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'nightWithMira', value: true },
            { type: 'addAffinity', npc: 'mira', amount: 4 },
            { type: 'giveXp', amount: 20 },
        ],
        choices: [
            {
                label: 'Every year. You and me, and I’ll teach you the whole of it.',
                next: 'camp_night_end',
                requires: null,
                effects: [
                    { type: 'addAffinity', npc: 'mira', amount: 3 },
                    { type: 'setFlag', flag: 'promisedToKeepIt', value: true },
                ],
            },
            { label: 'I’ll say so. I promise.', next: 'camp_night_end', requires: null, effects: [] },
        ],
    },

    camp_night_alone: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'Nobody came, and that was your choice, and it turns out to be a long way from the village at two in the morning.',
            'You read the journal by the light of the bowl fire — the whole of it, front to back, forty-one years of a woman being rude about weather.',
            'On the last written page, under an entry about her hands, in handwriting that has come apart: *If anyone reads this who is minded to keep it up — it is not hard and it is not brave. It is only that somebody has to be the one who bothers. I was very lonely doing it and I do not recommend that part.*',
        ],
        effects: [
            { type: 'setFlag', flag: 'nightAlone', value: true },
            { type: 'addLore', lore: 'lore_wisteria_end' },
            { type: 'giveXp', amount: 20 },
        ],
        choices: [
            { label: '(Sit with that a while)', next: 'camp_night_end', requires: null, effects: [] },
        ],
    },

    camp_night_end: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'Somewhere past the middle of the night the wood goes quiet in a new way — not the held-breath quiet of the last four months, but the ordinary quiet of a place where things have gone to sleep.',
            'And then, from the dark beyond the ash ring, something very large stands up.',
        ],
        choices: [
            { label: '(Get up)', next: 'tobin_in_the_dark', requires: { flag: 'tobinWarned' }, effects: [] },
            { label: '(Get up)', next: 'long_night_start', requires: { flag: 'tobinWarned', negate: true }, effects: [] },
        ],
    },

    // The boy followed you in. Set up back in the village, paid off here.
    tobin_in_the_dark: {
        speaker: 'Tobin',
        portrait: 'tobin_scared',
        background: 'night_camp',
        text: [
            'It is not the large thing that comes into the firelight first. It is a ten-year-old boy with a stick, white to the lips, who has been following you since the fern hollow and has clearly been lost for several hours.',
            '“I wanted to *see*,” he says, and his voice goes to pieces in the middle of it. “Everyone always — I only wanted to see it once—”',
            'Behind him, out past the ash ring, the enormous thing takes one step and stops, and the whole clearing feels it through the ground.',
        ],
        effects: [
            { type: 'setFlag', flag: 'tobinFollowed', value: true },
            { type: 'startQuest', quest: 'q_tobin_lost' },
        ],
        choices: [
            {
                label: '(Put him behind the stone, in the light, and stand in front of both)',
                next: 'long_night_start',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'tobinBehindTheStone', value: true },
                    { type: 'addAffinity', npc: 'tobin', amount: 3 },
                ],
            },
            {
                label: '(Send him back down the path at a run, alone, right now)',
                next: 'long_night_start',
                requires: null,
                effects: [ { type: 'setFlag', flag: 'tobinSentAway', value: true } ],
            },
        ],
    },
};
