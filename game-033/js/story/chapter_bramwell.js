/**
 * chapter_bramwell.js — the baker, expanded.
 *
 * Phase 2 gave Bramwell one enormous line ("buried a few too many friends
 * who didn't stop in time") and then never returned to it. This chapter
 * returns to it: the Ninebark Nine, the loaf he can't bring himself to
 * bake, and the oven that turns out to be the only other hearth in the
 * village old enough to light the boundary stone from.
 */

export const BRAMWELL_NODES = {
    bramwell_hub: {
        speaker: 'Bramwell',
        portrait: 'bramwell_jolly',
        background: 'bakery',
        text: 'The bakery is the warmest room for a mile and he keeps the door open anyway, on the grounds that heat is no good to anybody indoors.',
        choices: [
            { label: 'Tell me about the company you were in.', next: 'bramwell_ninebark', requires: { flag: 'bramwellToldNinebark', negate: true }, effects: [] },
            { label: 'Is there anything you need? Properly, I mean.', next: 'bramwell_spice_request', requires: { allFlags: ['bramwellToldNinebark'], flag: 'bramwellAskedSpice', negate: true }, effects: [] },
            {
                label: '(Put the spice root on the counter)',
                next: 'bramwell_spice_deliver',
                requires: { questActive: 'q_spice_root', item: 'spice_root' },
                effects: [],
            },
            {
                label: 'I need fire from a hearth someone still keeps. Can I take a coal?',
                next: 'bramwell_ember',
                requires: { item: 'hearth_lamp', questActive: 'q_ember' },
                effects: [],
            },
            {
                label: 'What do you actually think is happening out there?',
                next: 'bramwell_theory',
                requires: { allFlags: ['hasJournal'], flag: 'bramwellTheory', negate: true },
                effects: [],
            },
            {
                label: 'I’m walking out to the heart of the wood. Come with me.',
                next: 'bramwell_asked_along',
                requires: { questActive: 'q_ward', minAffinity: { bramwell: 5 }, flag: 'bramwellAlly', negate: true },
                effects: [],
            },
            { label: '(Back out into the square)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    bramwell_ninebark: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: [
            'He doesn’t answer straight away. He puts a tray down, and moves it an inch, and puts his hands flat on the counter.',
            '“The Ninebark Nine. Which was a joke, because there were eleven of us, and by the time anyone thought it was funny there were nine.”',
            '“Four came home. One of them opened a bakery.” He looks at the oven rather than at you. “I can tell you all their names. I have not said them out loud in nineteen years. I find that if I start I’ll have to keep going, and there’s bread on.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'bramwellToldNinebark', value: true },
            { type: 'addLore', lore: 'lore_ninebark' },
            { type: 'addAffinity', npc: 'bramwell', amount: 1 },
        ],
        choices: [
            {
                label: 'Then say one. Just one. I’ll hold the tray.',
                next: 'bramwell_one_name',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'bramwell', amount: 3 } ],
            },
            {
                label: 'You don’t have to. Not today.',
                next: 'bramwell_hub',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'bramwell', amount: 1 } ],
            },
        ],
    },

    bramwell_one_name: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: [
            'The pause goes on long enough that you think he won’t.',
            '“Ivar Bell,” he says. “Captain. Terrible swordsman. Made the best loaf I ever ate, out of ship’s biscuit and spice root and sheer bloody-mindedness, the night before the pass.”',
            'He wipes the counter with a cloth that does not need it. “There. That wasn’t so bad. That was quite bad, actually. Thank you.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'bramwellSaidName', value: true },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back)', next: 'bramwell_hub', requires: null, effects: [] },
        ],
    },

    bramwell_spice_request: {
        speaker: 'Bramwell',
        portrait: 'bramwell_fond',
        background: 'bakery',
        text: [
            '“Properly.” He turns that over. “All right. Properly: I want to bake Ivar’s loaf, once, and I can’t, because it wants spice root and spice root doesn’t grow this side of the fern hollow any more.”',
            '“It used to grow at the *edge*. My grandmother picked it at the edge. Now you have to go past the ferns, and I’m sixty-one, and my knees have opinions about ferns.”',
            'He says the next bit to the oven. “I’d take it as a kindness. That’s all. It’s a root, and it’s daft, and I’d take it as a kindness.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'bramwellAskedSpice', value: true },
            { type: 'startQuest', quest: 'q_spice_root' },
        ],
        choices: [
            { label: 'I’ll bring you your root.', next: 'bramwell_hub', requires: null, effects: [ { type: 'addAffinity', npc: 'bramwell', amount: 2 } ] },
        ],
    },

    bramwell_spice_deliver: {
        speaker: 'Bramwell',
        portrait: 'bramwell_fond',
        background: 'bakery_kitchen',
        text: [
            'He does not say thank you. He takes the root, and smells it, and something goes out of his shoulders that has been in them for nineteen years.',
            'Then he shouts at you to shut the door, and bakes, and talks the entire time — Ivar Bell, and Sella who could not sing, and the one they all called Mouse whose real name was Aldwin, and the pass, and the four who came home.',
            'The loaf comes out dense and dark and smelling of somebody else’s kitchen. He cuts it in half and gives you half and eats his standing up, and neither of you says anything for a while.',
        ],
        effects: [
            { type: 'removeItem', item: 'spice_root', count: 1 },
            { type: 'completeQuest', quest: 'q_spice_root' },
            { type: 'giveItem', item: 'ninebark_loaf', count: 3 },
            { type: 'giveItem', item: 'beeswax', count: 2 },
            { type: 'addAffinity', npc: 'bramwell', amount: 4 },
            { type: 'giveXp', amount: 20 },
            { type: 'setFlag', flag: 'bakedTheLoaf', value: true },
        ],
        choices: [
            { label: '(Back)', next: 'bramwell_hub', requires: null, effects: [] },
        ],
    },

    bramwell_ember: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery_kitchen',
        text: [
            '“A coal.” He looks at the brass lamp in your hands, and then at you, and the jolly falls off him like a coat. “That’s Wisteria’s carrier. She came in every spring for thirty years and asked for a coal and never once said what for.”',
            '“I always gave her one.” He opens the oven door with the long iron and the heat walks out across the room. “I always thought, she’ll tell me when it matters.”',
            'He lifts one out — old fire, banked and fed since before you were born — and sets it in the cage, and shuts the shutter on it.',
        ],
        effects: [
            { type: 'removeItem', item: 'hearth_lamp', count: 1 },
            { type: 'giveItem', item: 'lit_hearth_lamp', count: 1 },
            { type: 'completeQuest', quest: 'q_ember' },
            { type: 'setFlag', flag: 'hasEmber', value: true },
            { type: 'setFlag', flag: 'emberFromBramwell', value: true },
            { type: 'addAffinity', npc: 'bramwell', amount: 2 },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            {
                label: 'It matters. I’ll tell you the whole of it when I’m back.',
                next: 'bramwell_hub',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'bramwell', amount: 2 } ],
            },
            { label: '(Take the lamp and go)', next: 'bramwell_hub', requires: null, effects: [] },
        ],
    },

    bramwell_theory: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: [
            'You put the journal on the counter, open at the page with the flat stone and the bowl of fire and the three marks.',
            'He looks at it for a long time. “I’ve seen that mark. Cut into the boundary posts out east, the old ones, the ones nobody replaces.” He taps the page. “I thought it was a mason’s mark.”',
            '“Right, then. Here’s an old soldier’s opinion, for what it’s worth: nothing in that wood has *attacked* anybody. Tracks at the herb patch. A boar where a boar shouldn’t be. An owl the size of a dog watching folk go by.” He straightens. “That’s not a wood hunting us. That’s a wood *pressed up against the fence*, because something behind it has stopped holding.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'bramwellTheory', value: true },
            { type: 'addLore', lore: 'lore_unbinding' },
            { type: 'giveXp', amount: 8 },
        ],
        choices: [
            { label: '(Back)', next: 'bramwell_hub', requires: null, effects: [] },
        ],
    },

    bramwell_asked_along: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: [
            'He does not say yes straight away, and he does not say no at all, which is its own answer.',
            '“I told myself I’d stopped.” He reaches under the counter — right under, past the flour, to something that has been there a very long time — and comes up with a bundle of oiled cloth the length of his forearm. “I told myself that with this under here the whole time.”',
            '“Nineteen years I’ve been the man who stopped in time. Right.” He puts the cloth on the counter. “Somebody has to carry the lamp and somebody has to watch the dark. I know which one I’m for.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'bramwellAlly', value: true },
            { type: 'addAffinity', npc: 'bramwell', amount: 3 },
            { type: 'giveItem', item: 'ninebark_loaf', count: 1 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Back)', next: 'bramwell_hub', requires: null, effects: [] },
        ],
    },
};
