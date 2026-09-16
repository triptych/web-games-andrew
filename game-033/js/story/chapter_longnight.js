/**
 * chapter_longnight.js — the climax the game kept promising.
 *
 * Hollow's Phase 3 line was "something in the deep wood is changing what
 * lives there — I don't know what yet," and the game never found out. This
 * is what: not a monster, but the shape a wood takes when the agreement
 * holding it and a village apart has gone four months untended.
 *
 * Three ways through it, in keeping with a cozy game whose design doc calls
 * its own battles "light danger": you can fight it, you can quiet it with
 * your aunt's last recipe, or you can talk to it — but only if you brought
 * somebody and only if you meant what you said at the fire.
 */

export const LONGNIGHT_NODES = {
    long_night_start: {
        speaker: null,
        portrait: 'thorn_crowned',
        background: 'night_camp',
        text: [
            'It comes into the ash ring the way weather arrives.',
            'The shape is a stag, more or less, if a stag were assembled out of grey deadwood and bramble by someone working from a description. The crown of it goes up and up into thorn. Where its eyes should be there is the same small fire that is burning in the stone bowl, at the same size, exactly.',
            'It is not angry. That is the thing you will have most trouble explaining afterwards. It stands over the little fire and it is *grieving*, hugely and stupidly and without any idea what to do with itself, and it has been grieving in this clearing since June with nobody sitting up with it.',
        ],
        effects: [
            { type: 'setFlag', flag: 'metTheThornCrowned', value: true },
            { type: 'addLore', lore: 'lore_thorn' },
        ],
        choices: [
            {
                label: '(Pour the Hearthbound Tea into the bowl beside the fire)',
                next: 'thorn_calmed',
                requires: { item: 'hearthbound_tea' },
                effects: [ { type: 'removeItem', item: 'hearthbound_tea', count: 1 } ],
            },
            {
                label: '(Say the thing she would have said, out loud, to a wood)',
                next: 'thorn_spoken',
                requires: { allFlags: ['promisedToKeepIt'], minStat: { charm: 6 } },
                effects: [],
            },
            {
                label: '(Stand between it and the fire, and make it come through you)',
                next: 'thorn_fight',
                requires: null,
                effects: [],
            },
            {
                label: '(Take the boy and run. The fire can be relit another year.)',
                next: 'long_night_flee',
                requires: { flag: 'tobinBehindTheStone' },
                effects: [],
            },
            {
                label: '(Back away out of the ring and leave the fire burning)',
                next: 'long_night_flee',
                requires: { flag: 'tobinBehindTheStone', negate: true },
                effects: [],
            },
        ],
    },

    // ------------------------------------------------------------
    // The best road through: the recipe Wisteria spent forty years on,
    // which does not protect you in the slightest.
    // ------------------------------------------------------------
    thorn_calmed: {
        speaker: null,
        portrait: 'thorn_crowned',
        background: 'night_camp',
        text: [
            'You pour it out on the stone beside the flame, and the whole clearing fills with the smell of spice root and moonpetal and the inside of a kitchen at the end of a long day.',
            'The Thorn-Crowned stops.',
            'It lowers that enormous ruined head down to the stone — close enough that you could put your hand on it, close enough that the thorn is going past your face on both sides — and it *breathes in*, the way you do at a door you have not been through in a long time.',
            'And then, with a noise like an entire hedgerow sitting down, it folds its legs under itself and lies down beside the fire.',
        ],
        effects: [
            { type: 'setFlag', flag: 'thornCalmed', value: true },
            { type: 'giveXp', amount: 70 },
        ],
        choices: [
            {
                label: '(Sit down next to it and keep the fire in until dawn)',
                next: 'dawn_together',
                requires: { anyFlags: ['nightWithHollow', 'nightWithBramwell', 'nightWithMira'] },
                effects: [],
            },
            {
                label: '(Sit down next to it and keep the fire in until dawn)',
                next: 'dawn_alone',
                requires: { flag: 'nightAlone' },
                effects: [],
            },
        ],
    },

    thorn_spoken: {
        speaker: null,
        portrait: 'thorn_crowned',
        background: 'night_camp',
        text: [
            'You do not know the words, because there are no words, because it was never a spell. So you say the only true thing you have.',
            '“She’s dead.” Your voice goes out flat across the clearing and does not come back. “Wisteria Ashgrove. She died in June, and she meant to come, and her hands were too stiff, and nobody told you.”',
            '“That’s all that happened. Nobody left. Nobody broke anything. She *died*, and it took us four months to work out that somebody had to be the one who bothers, and I am extremely sorry that you have been out here on your own the whole time.”',
            'The Thorn-Crowned stands over the little fire for a long moment. Then it makes a sound — low, and long, and not remotely a threat — and the bramble across its shoulders comes apart in a rush and falls, and there is grey deadwood under it, and green under that.',
        ],
        effects: [
            { type: 'setFlag', flag: 'thornSpoken', value: true },
            { type: 'giveXp', amount: 70 },
        ],
        choices: [
            {
                label: '(Sit down with it and keep the fire in until dawn)',
                next: 'dawn_together',
                requires: { anyFlags: ['nightWithHollow', 'nightWithBramwell', 'nightWithMira'] },
                effects: [],
            },
            {
                label: '(Sit down with it and keep the fire in until dawn)',
                next: 'dawn_alone',
                requires: { flag: 'nightAlone' },
                effects: [],
            },
        ],
    },

    thorn_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: 'You put yourself between the fire and the thorn, which is the single stupidest thing you have done all season, and which is also — you are fairly sure — the correct thing, and the crown comes down.',
        battle: 'thorn_crowned',
        onWin: 'thorn_fight_won',
        onLose: 'thorn_fight_lost',
        choices: [],
    },

    thorn_fight_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'It comes apart in the end the way the bramble wight did, only far slower and with far more of it: thorn, then deadwood, then a long grey collapse across half the clearing.',
            'The fire in the bowl never goes out. You are standing over it with your arms shaking and blood in your eye and the whole ash ring full of falling bramble, and it is, technically, a victory.',
            'The last of it to go are the two small fires where its eyes were. They go out one after the other, and it is very quiet afterwards, and you sit down harder than you meant to.',
        ],
        effects: [
            { type: 'setFlag', flag: 'thornBroken', value: true },
            { type: 'giveXp', amount: 60 },
        ],
        choices: [
            { label: '(Keep the fire in until dawn)', next: 'dawn_broken', requires: null, effects: [] },
        ],
    },

    thorn_fight_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'night_camp',
        text: [
            'It puts you down across the roots at the edge of the ring, and the world goes a long way away, and the last thing you see clearly is the little fire still burning in the bowl, because it did not come for you at all — it came for the fire, and you were only in the way.',
            'You come round in grey light with a coat over you that is not yours, and the bowl still lit, and somebody feeding it twig by twig.',
        ],
        effects: [
            { type: 'setFlag', flag: 'thornBestedYou', value: true },
            { type: 'giveXp', amount: 24 },
        ],
        choices: [
            {
                label: '(Whoever came with you kept the fire in all night)',
                next: 'dawn_carried',
                requires: { anyFlags: ['nightWithHollow', 'nightWithBramwell', 'nightWithMira'] },
                effects: [],
            },
            {
                label: '(There is nobody. The fire burned down to a coal on its own.)',
                next: 'dawn_guttered',
                requires: { flag: 'nightAlone' },
                effects: [],
            },
        ],
    },

    long_night_flee: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'You go backwards out of the ash ring with your eyes on the crown the whole way, and then you turn, and then you run, and the wood lets you.',
            'It does not follow. It never wanted you. Somewhere behind you the little fire is still burning in the stone bowl, on its own, in the dark, exactly as it has burned on its own every night since June — except that tonight somebody lit it, and then left.',
        ],
        effects: [ { type: 'setFlag', flag: 'leftTheFire', value: true } ],
        choices: [
            { label: '(Keep running)', next: 'ending_left_the_fire', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Dawn
    // ------------------------------------------------------------
    dawn_together: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'Nobody sleeps. The fire gets fed. The enormous thing lying alongside the stone breathes slowly in and out, and by about three in the morning somebody has started, cautiously, to talk over it about something else entirely — bread, or a ledger, or a bad autumn thirty years ago.',
            'By first light there is green coming up through the deadwood of it, and by full dawn there is nothing beside the stone but a long mound of thorn with grass in it, and the ash ring is loud with birds for the first time since June.',
            'The fire in the bowl burns down to a coal, and the coal sits there, quite content, waiting for next spring.',
        ],
        choices: [
            {
                label: '(Walk home)',
                next: 'ending_hearthbound',
                requires: null,
                effects: [ { type: 'giveXp', amount: 30 } ],
            },
        ],
    },

    dawn_alone: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'You keep the fire in on your own until the sky goes grey, which is not difficult, and is one of the longest things you have ever done.',
            'The Thorn-Crowned goes green and then goes quiet and then, some time around first light, is simply a long mound of thorn beside the stone with grass coming through it.',
            'There is nobody to say anything to about it. You find that you say it anyway, out loud, to a wood, exactly the way she used to at the back door.',
        ],
        choices: [
            {
                label: '(Walk home)',
                next: 'ending_ward_alone',
                requires: null,
                effects: [ { type: 'giveXp', amount: 30 } ],
            },
        ],
    },

    dawn_broken: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'You sit up with the fire until dawn beside a clearing full of dead bramble, which is not how the journal describes this night at all.',
            'The wood goes quiet — properly quiet, the sleeping kind — and at first light the birds come back, and the ward is lit, and the boundary is kept, and every part of that is true.',
            'It is also true that there is a long grey ruin lying across the ash ring that was, four hours ago, grieving.',
        ],
        choices: [
            {
                label: '(Walk home)',
                next: 'ending_thorn_broken',
                requires: null,
                effects: [ { type: 'giveXp', amount: 20 } ],
            },
        ],
    },

    dawn_carried: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'They kept it in. All night, while you were somewhere else entirely, whoever came with you sat by a stone bowl in the dark with a thing the size of a barn lying twenty feet off, and fed a fire the size of a cupped hand, twig by twig, until the sky went grey.',
            'The Thorn-Crowned is gone by the time you can sit up. There is a mound of thorn with grass coming through it, and birdsong, and somebody handing you something hot and saying, with enormous scorn to cover something else, that you are an idiot.',
        ],
        choices: [
            {
                label: '(Let them help you up)',
                next: 'ending_carried_home',
                requires: null,
                effects: [ { type: 'giveXp', amount: 20 } ],
            },
        ],
    },

    dawn_guttered: {
        speaker: null,
        portrait: 'narrator',
        background: 'hollow_heart',
        text: [
            'The bowl is still warm when you can finally crawl to it. There is one coal left in it, orange under the ash, about the size of a thumbnail, and it has been keeping itself alive for four hours without any help from you at all.',
            'You feed it. It takes. The Thorn-Crowned is nowhere in the clearing and the birds are back, and the ward is lit, technically, by the narrowest margin anything has ever been anything.',
        ],
        choices: [
            {
                label: '(Get up, eventually)',
                next: 'ending_guttering_coal',
                requires: null,
                effects: [ { type: 'giveXp', amount: 20 } ],
            },
        ],
    },

    // ------------------------------------------------------------
    // The cozy off-ramp: stop the season here, on purpose, having run a
    // good shop. Reachable from the village hub once you've been at it a
    // while — an ending for the player who came for the apothecary.
    // ------------------------------------------------------------
    call_it_a_season: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'There is a version of this where you stop.',
            'The shelves are full. The ledger balances, or nearly. There is a wood out there with something wrong at the middle of it, and there is also a burn to dress on Thursday and a cough that won’t quit and a woman who cannot hold a cup after noon.',
            'Nobody would blame you. Several people would be quietly relieved.',
        ],
        choices: [
            {
                label: '(Close the ledger on a good season — the wood can wait for spring)',
                next: 'ending_shopkeeper',
                requires: null,
                effects: [],
            },
            {
                label: '(Stand the watch down and call the valley safe enough)',
                next: 'ending_watchward',
                requires: { flag: 'dorneStandsDown' },
                effects: [],
            },
            { label: '(No. Not yet.)', next: 'village_hub', requires: null, effects: [] },
        ],
    },
};
