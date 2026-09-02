/**
 * chapter_watch.js — the branch that used to be a punishment.
 *
 * Phase 2 made "send for the watch" a real foreclosure: Hollow turns you
 * away, and Phase 4 pointed that straight at an ending, so the safe,
 * sensible, entirely reasonable choice ended the game in about six minutes.
 *
 * Here the spears actually arrive, and having them here is its own story:
 * Sergeant Dorne is not a fool and not a villain, his men beat the
 * hedgerows and push something into the village lane, and the wreckage of
 * that is what finally brings Hollow across the cobbles she has not
 * crossed in thirty years. The cold branch rejoins the main plot with its
 * own scenes rather than dead-ending.
 */

export const WATCH_NODES = {
    // Reached from hollow_cold_end, alongside the original "call it a season"
    // ending choice — you can still stop here, or you can go home and wait
    // for the thing you set in motion to arrive.
    watch_walk_home: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'You walk back through the trees with her door shut behind you and the distinct feeling of having been weighed.',
            'She is wrong about one thing, though, and it takes you the whole walk to work out what: she said *it’s done now*, as though the watch coming were the end of it.',
            'The watch coming is not the end of anything. The watch coming is four men with spears walking into a wood that has been quiet for four months.',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowRefusedYou', value: true },
            { type: 'startQuest', quest: 'q_watch' },
        ],
        choices: [
            { label: 'Go home and get on with the shop.', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    watch_arrives: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_stern',
        background: 'village_square',
        text: [
            'They come in at noon: four horses, four spears, and a woman in the county’s grey with a face like a closed ledger.',
            '“Sergeant Dorne, county watch. Somebody here wrote to me about wolves.” She is already looking past you at the tree line, measuring it. “Bramwell Oake still bake here? Good. Then somebody in this village has sense.”',
            '“We’ll beat the hedgerows from the herb patch to the fern hollow and back. Two days. Anything with teeth gets moved on or gets speared, and either way it stops being your problem.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'watchArrived', value: true },
            { type: 'setFlag', flag: 'metDorne', value: true },
            { type: 'startQuest', quest: 'q_watch' },
        ],
        choices: [
            {
                label: 'Sergeant — the wood isn’t hunting us. Beating it will push things *inward*, toward the village.',
                next: 'dorne_argument',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'dorne', amount: 1 } ],
            },
            {
                label: 'Thank you for coming. Tell me what you need.',
                next: 'dorne_hub',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'dorne', amount: 2 } ],
            },
        ],
    },

    dorne_argument: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_stern',
        background: 'village_square',
        text: [
            'She looks at you properly for the first time.',
            '“That’s the apothecary talking, is it.” Not unkind. Not remotely moved. “I have beaten hedgerows in eleven villages and I have never yet been thanked in advance for it.”',
            '“Here is my difficulty. You are telling me the wood is *upset*. I cannot write ‘upset’ in a report, and I cannot send four men home on ‘upset’, and the letter I have in my saddlebag says tracks at a herb patch.” She dismounts. “Show me something I can put in a report and I will do something else. Otherwise we beat the hedgerows at first light.”',
        ],
        effects: [ { type: 'setFlag', flag: 'dorneChallenged', value: true } ],
        choices: [
            { label: '(Take her the journal page)', next: 'dorne_shown_journal', requires: { item: 'wisteria_journal' }, effects: [] },
            { label: 'I’ll find you something.', next: 'dorne_hub', requires: null, effects: [] },
        ],
    },

    dorne_shown_journal: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_tired',
        background: 'village_square',
        text: [
            'She reads the page twice, and does not laugh, which surprises you.',
            '“I was at Ferny Cross in the spring,” she says at last. “Same treeline. Their old boundary posts have that mark on them and nobody there could tell me what it was for either.” She hands the journal back with more care than she took it. “And Ferny Cross had a bad autumn.”',
            '“I’ll give you a day. One. And my men still stand a watch, because ‘the wood is grieving’ does not stop a boar going through a fence.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'dorneListens', value: true },
            { type: 'addAffinity', npc: 'dorne', amount: 3 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Back)', next: 'dorne_hub', requires: null, effects: [] },
        ],
    },

    dorne_hub: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_stern',
        background: 'village_square',
        text: 'The watch have made a camp of the square in under an hour: picket line, cook fire, and four spears leaned in a neat cone that the village children are already circling like gulls.',
        choices: [
            { label: 'Why did you come yourself, for four wolf tracks?', next: 'dorne_why', requires: { flag: 'dorneWhy', negate: true }, effects: [] },
            {
                label: 'One of your men is favouring his arm.',
                next: 'dorne_wounded',
                requires: { flag: 'healedTheSpearman', negate: true },
                effects: [],
            },
            {
                label: '(Walk the hedgerow line with them at first light)',
                next: 'watch_beat_hedgerows',
                requires: { flag: 'hedgerowsBeaten', negate: true },
                effects: [],
            },
            { label: '(Leave the camp)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    dorne_why: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_tired',
        background: 'village_square',
        text: [
            '“Because it is the fourth letter this year off that treeline and the other three villages did not write a fourth.” She says it flatly, over a cup of something you would not describe as tea.',
            '“Ferny Cross stopped answering in the spring. Not dramatically. No screaming, no fires. They just — stopped sending anything out, and when we went, they were all there, and all fine, and all indoors.” A pause. “They’d taken their boundary posts down for firewood in the winter.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'dorneWhy', value: true },
            { type: 'addLore', lore: 'lore_unbinding' },
            { type: 'giveXp', amount: 8 },
        ],
        choices: [
            { label: '(Back)', next: 'dorne_hub', requires: null, effects: [] },
        ],
    },

    dorne_wounded: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'The youngest of them has taken a spear butt across the forearm on the ride and has been extremely brave about it in the way that makes a thing worse.',
            'It is not serious. It is exactly the kind of not-serious that goes bad in a week on the road, and it is exactly what your shop is for.',
        ],
        choices: [
            {
                label: '(Dress it with burn salve and strap it properly)',
                next: 'dorne_healed',
                requires: { item: 'burn_salve' },
                effects: [ { type: 'removeItem', item: 'burn_salve', count: 1 } ],
            },
            {
                label: '(Give him the vigor draught and strap it properly)',
                next: 'dorne_healed',
                requires: { item: 'vigor_draught', notItem: 'burn_salve' },
                effects: [ { type: 'removeItem', item: 'vigor_draught', count: 1 } ],
            },
            { label: '(You have nothing on you for it — go and brew something)', next: 'dorne_hub', requires: null, effects: [] },
        ],
    },

    dorne_healed: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_tired',
        background: 'village_square',
        text: [
            'Dorne watches the whole thing from ten feet away without saying anything, and then walks over when you’re done and puts something small and metal in your hand.',
            '“My spare. It means nothing and it opens doors with men who think rank is real.” She is already turning away. “Most villages we ride into, the apothecary charges us double and calls it a war levy. Noted.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'healedTheSpearman', value: true },
            { type: 'giveItem', item: 'watch_pin', count: 1 },
            { type: 'giveCoin', amount: 18 },
            { type: 'addAffinity', npc: 'dorne', amount: 3 },
            { type: 'giveXp', amount: 12 },
        ],
        choices: [
            { label: '(Back)', next: 'dorne_hub', requires: null, effects: [] },
        ],
    },

    watch_beat_hedgerows: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: [
            'It is, for four hours, the most boring thing you have ever done: a line of five people walking a hedgerow banging a stick on it.',
            'Then the line reaches the fern hollow, and everything that has been quietly living in the strip between the village and the deep wood decides at once that it would rather be somewhere else — and the only somewhere else is behind you.',
            'Something comes out of the hedge low and fast and *wrong*, thorn-grown and hackled, and it goes past the spears entirely, straight down the lane toward the village.',
        ],
        effects: [
            { type: 'setFlag', flag: 'hedgerowsBeaten', value: true },
            { type: 'advanceDay', count: 1 },
        ],
        choices: [
            { label: 'Run. Get in front of it.', next: 'thorn_hound_fight', requires: null, effects: [] },
        ],
    },

    thorn_hound_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_lane',
        text: 'You get in front of it at the fence line, where the lane bends, where there are chickens and a washing line and — twenty feet behind you and rooted to the spot — Tobin.',
        battle: 'thorn_hound',
        onWin: 'thorn_hound_won',
        onLose: 'thorn_hound_lost',
        choices: [],
    },

    thorn_hound_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_lane',
        text: [
            'It breaks off and goes over the fence into the barley and away, and the whole lane stands there breathing.',
            'Tobin has not moved. Tobin will be telling this story for the rest of his life, and in every version of it he will not have moved, and he will not forgive himself for it, and he is ten.',
            'Dorne arrives at a dead run thirty seconds too late with her spear levelled and takes in the scene: the fence, the boy, the apothecary, no blood.',
        ],
        effects: [
            { type: 'giveXp', amount: 30 },
            { type: 'giveItem', item: 'thornback_quill', count: 2 },
            { type: 'addAffinity', npc: 'tobin', amount: 2 },
            { type: 'addAffinity', npc: 'dorne', amount: 2 },
        ],
        choices: [
            { label: '(Turn round and look at the sergeant)', next: 'dorne_reckoning', requires: null, effects: [] },
        ],
    },

    thorn_hound_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_lane',
        text: [
            'It puts you down in the mud of the lane and goes over you, and it is Dorne’s spear butt and a great deal of shouting that turns it, and it goes over the fence into the barley and away.',
            'Nobody is dead. You have a set of scratches you will keep, the washing line is destroyed, and Tobin has not moved an inch the entire time.',
        ],
        effects: [
            { type: 'setFlag', flag: 'lostToThornHound', value: true },
            { type: 'giveXp', amount: 12 },
        ],
        choices: [
            { label: '(Get up and look at the sergeant)', next: 'dorne_reckoning', requires: null, effects: [] },
        ],
    },

    dorne_reckoning: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_tired',
        background: 'village_lane',
        text: [
            'She looks at the fence for a long moment. Then at the barley. Then she plants the spear butt-down in the lane and leans on it like a woman twenty years older.',
            '“It came *through* us,” she says. “Four spears in a line and it did not care. It was not hunting. It was *running*, and it ran at the village, because the village was the direction that wasn’t the wood.”',
            '“I have beaten hedgerows in eleven villages, apothecary, and I have never once had one run at the houses.” She rubs her face. “Say the thing you have obviously been dying to say.”',
        ],
        effects: [ { type: 'completeQuest', quest: 'q_watch' } ],
        choices: [
            {
                label: 'I’d rather you helped me fix it than heard me say it.',
                next: 'dorne_alliance',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'dorne', amount: 3 } ],
            },
            {
                label: 'I told you. Beating the hedgerows pushed it inward.',
                next: 'dorne_alliance',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'dorne', amount: 1 } ],
            },
        ],
    },

    dorne_alliance: {
        speaker: 'Sergeant Dorne',
        portrait: 'dorne_stern',
        background: 'village_lane',
        text: [
            '“Right.” She is a practical woman having a very bad day and choosing, visibly, to be practical about that too. “No more beating. We stand a picket on the lane and the herb patch and we do not go past the fern hollow.”',
            '“And you.” The spear comes up and points, not entirely as a joke, at your chest. “You go and find me something I can put in a report. Or don’t, and fix it, and tell me afterwards, and I will write down whatever you say happened.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'dorneStandsDown', value: true },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Somebody is standing at the end of the lane)', next: 'hollow_comes_to_town', requires: null, effects: [] },
        ],
    },

    // The scene the cold branch exists for: Hollow crosses the hundred yards
    // of cobbles she has not crossed in thirty years, because a thing came
    // out of her wood at a child.
    hollow_comes_to_town: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'village_lane',
        text: [
            'She is at the end of the lane by the fence post, in the village, on the cobbles, with her arms wrapped round herself and her jaw set like a woman walking into surgery.',
            'Half the lane has noticed. Nobody says anything. Somebody’s mother pulls a child back a step and Hollow sees her do it and keeps walking anyway.',
            '“I felt it go through the edge,” she says, when she reaches you. Her voice is not steady. “From my porch. Like a stitch coming out.” She looks at the wrecked washing line, and the boy, and the barley. “I have made an extremely difficult journey to tell you that I was wrong to send you away, and I would like to do this only once, so please attend.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'hollowThawed', value: true },
            { type: 'setFlag', flag: 'metHollow', value: true },
            { type: 'giveXp', amount: 16 },
            { type: 'addAffinity', npc: 'hollow', amount: 3 },
        ],
        choices: [
            {
                label: 'You didn’t have to walk in here to say that. But thank you.',
                next: 'hollow_town_reply',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 3 } ],
            },
            {
                label: 'Then tell me what’s actually wrong with the wood.',
                next: 'hollow_town_reply',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 1 } ],
            },
        ],
    },

    hollow_town_reply: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'village_lane',
        text: [
            '“What is wrong with the wood is that nobody has sat up with it since June, and I could not be the one to do it, and I have been telling myself that was the village’s fault for four months.”',
            'She glances, once, at the bakery door, where Bramwell is standing with a tray in his hands and an expression like a man watching a bridge come back.',
            '“Come out to the cottage. Bring your aunt’s book — yes, I know you have it, you have had cellar dust on your cuffs for a week. There is a thing at the heart of that wood that needs doing, and it needs doing by an Ashgrove, and I will not do this on your doorstep in front of Ada Pell.”',
        ],
        effects: [ { type: 'setFlag', flag: 'coldBranchRejoined', value: true } ],
        choices: [
            { label: 'Walk out to the cottage with her.', next: 'hollow_hub', requires: null, effects: [] },
            { label: 'Say you’ll come tomorrow — there’s a shop to shut up first.', next: 'village_hub', requires: null, effects: [] },
        ],
    },
};
