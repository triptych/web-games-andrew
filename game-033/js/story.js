/**
 * story.js — the story graph. Pure data: nodes keyed by id.
 *
 * Node shape:
 * {
 *   speaker:    string | null       — name shown above the dialogue box (null = narration)
 *   portrait:   string | null       — key into PORTRAITS (css class / emoji stand-in for art)
 *   background: string              — key into BACKGROUNDS
 *   text:       string | string[]   — one or more lines shown in sequence before choices appear
 *   choices:    Array<{
 *       label:    string
 *       next:     string                              — id of the node to go to
 *       requires: { flag?, negate?: boolean, minAffinity?: {npcId:n}, item? } | null
 *                                                        — negate flips a `flag` check (available only if flag is NOT set)
 *       effects:  Array<{ type, ... }>                — applied when this choice is picked
 *   }>
 *   effects:    Array<...>          — applied automatically on node entry (before choices render)
 *   battle:     string | null       — enemy id from ENEMY_DEFS; if set, entering this node starts a battle first
 *   onWin / onLose: string          — next node id depending on battle outcome (only used if `battle` set)
 * }
 *
 * Effect types:
 *   { type: 'setFlag', flag, value }
 *   { type: 'addAffinity', npc, amount }
 *   { type: 'giveItem', item, count }
 *   { type: 'removeItem', item, count }
 *   { type: 'giveXp', amount }
 */

export const PORTRAITS = {
    mira_neutral:    { emoji: '🧑‍🌾', label: 'Mira' },
    mira_worried:    { emoji: '😟', label: 'Mira' },
    mira_smile:      { emoji: '🙂', label: 'Mira' },
    bramwell_jolly:  { emoji: '🧔', label: 'Bramwell' },
    bramwell_serious:{ emoji: '😐', label: 'Bramwell' },
    bramwell_fond:   { emoji: '😊', label: 'Bramwell' },
    hollow_wary:     { emoji: '🧙‍♀️', label: 'Hollow' },
    hollow_neutral:  { emoji: '🙍‍♀️', label: 'Hollow' },
    hollow_warm:     { emoji: '🥰', label: 'Hollow' },
    narrator:        { emoji: '📖', label: '' },
};

export const BACKGROUNDS = {
    shop_interior: { gradient: 'linear-gradient(180deg, #2b2440, #1a1626)', label: 'The Apothecary' },
    shop_cellar:   { gradient: 'linear-gradient(180deg, #14121c, #0a0910)', label: 'The Cellar' },
    village_square:{ gradient: 'linear-gradient(180deg, #3a4a5c, #1c2733)', label: 'Village Square' },
    bakery:        { gradient: 'linear-gradient(180deg, #4a3222, #241408)', label: 'Bramwell’s Bakery' },
    whisperwood_edge: { gradient: 'linear-gradient(180deg, #1c2c22, #0a120c)', label: 'Edge of the Whisperwood' },
    witch_cottage: { gradient: 'linear-gradient(180deg, #22283a, #0d1018)', label: 'Hollow’s Cottage' },
    deep_whisperwood: { gradient: 'linear-gradient(180deg, #0e1812, #050805)', label: 'The Deep Whisperwood' },
};

export const STORY = {
    start: {
        speaker: null,
        portrait: null,
        background: 'shop_interior',
        text: [
            'The bell above the door hasn’t rung in three days.',
            'You inherited your aunt’s apothecary shop last spring, and you are still learning where everything is kept — and what everything does.',
        ],
        choices: [
            { label: 'Continue.', next: 'mira_intro', requires: null, effects: [] },
        ],
    },

    mira_intro: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_interior',
        text: 'Oh — good, you’re up. Listen, I keep hearing something squelching around down in the cellar. I didn’t want to go alone.',
        choices: [
            {
                label: 'I’ll go take a look right now.',
                next: 'mira_grateful',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'helpedMiraImmediately', value: true },
                    { type: 'addAffinity', npc: 'mira', amount: 2 },
                ],
            },
            {
                label: 'Squelching? That doesn’t sound dangerous. Can it wait?',
                next: 'mira_hesitant',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: -1 } ],
            },
        ],
    },

    mira_grateful: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'Really? Thank you — you didn’t have to say yes so fast. You’re already better at this than your aunt was, some days.',
        choices: [
            { label: 'Head down to the cellar.', next: 'cellar_entry', requires: null, effects: [] },
            {
                label: '(Ask about the herb garden first)',
                next: 'herb_garden_chat',
                requires: { minAffinity: { mira: 2 } },
                effects: [],
            },
        ],
    },

    mira_hesitant: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: 'It can... probably wait. But if it eats through another sack of mintleaf, that’s coming out of your share of the profits.',
        choices: [
            { label: 'Fine, fine — I’ll check the cellar.', next: 'cellar_entry', requires: null, effects: [] },
        ],
    },

    herb_garden_chat: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'The herb garden? It’s doing well, actually — the mintleaf came in early this year. You have a good hand with growing things.',
        choices: [
            { label: '(Head to the cellar)', next: 'cellar_entry', requires: null, effects: [] },
        ],
    },

    cellar_entry: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The cellar stairs creak underfoot. Somewhere in the dark, something wet shifts against a shelf.',
        choices: [
            { label: 'Light the lantern and press on.', next: 'cellar_slime_fight', requires: null, effects: [] },
        ],
    },

    cellar_slime_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'A cellar slime rears up between the shelves, dripping something faintly minty.',
        battle: 'cellar_slime',
        onWin: 'cellar_slime_won',
        onLose: 'cellar_slime_lost',
        choices: [],
    },

    cellar_slime_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The slime splits apart with a wet pop, leaving behind a rust-spotted key and a few scraps of chewed mintleaf.',
        effects: [
            { type: 'giveItem', item: 'cellar_key', count: 1 },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
        ],
        choices: [
            { label: 'Bring the key back up to Mira.', next: 'mira_thanks', requires: null, effects: [] },
        ],
    },

    cellar_slime_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The slime gets the better of you this time. You retreat up the stairs, singed and sticky, to lick your wounds.',
        choices: [
            { label: 'Rest, then try again later.', next: 'mira_thanks', requires: null, effects: [] },
        ],
    },

    mira_thanks: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'You’re back! Oh — is that the old cellar key? I thought we’d lost that years ago. Thank you, truly.',
        effects: [ { type: 'addAffinity', npc: 'mira', amount: 1 }, { type: 'giveXp', amount: 12 } ],
        choices: [
            { label: 'Do you have a moment to show me something?', next: 'mira_teaches_brewing', requires: null, effects: [] },
            { label: 'Step out for some air.', next: 'village_square', requires: null, effects: [] },
        ],
    },

    mira_teaches_brewing: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: [
            'Oh — brewing! Yes, of course. Your aunt kept a little brewing corner behind the counter, see? Nothing fussy. Dried mintleaf, a bit of root, some patience.',
            'Here, take these to start with — I always keep extra on hand. Just mind the proportions, or you’ll end up with something that tastes like a pond.',
        ],
        effects: [
            { type: 'setFlag', flag: 'canBrew', value: true },
            { type: 'giveItem', item: 'river_root', count: 2 },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
        ],
        choices: [
            { label: 'Step out for some air.', next: 'village_square', requires: null, effects: [] },
        ],
    },

    // ============================================================
    // Chapter 2 — Village Square (hub)
    // ============================================================

    village_square: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'The square is quiet at this hour — a few chickens, a cat asleep on a sunny step, and the smell of woodsmoke and baking bread drifting from across the way.',
            'A stout, grey-bearded man waves at you from the bakery doorway. Beyond the last rooftop, the dark line of the Whisperwood watches the village the way it always has.',
        ],
        choices: [
            { label: 'Go say hello to the baker.', next: 'bramwell_intro', requires: null, effects: [] },
            {
                label: '(Head toward the Whisperwood instead)',
                next: 'whisperwood_first_look',
                requires: { flag: 'metBramwell' },
                effects: [],
            },
        ],
    },

    // ============================================================
    // Chapter 2 — Bramwell the baker (retired adventurer)
    // ============================================================

    bramwell_intro: {
        speaker: 'Bramwell',
        portrait: 'bramwell_jolly',
        background: 'bakery',
        text: [
            'Well, if it isn’t your aunt’s heir! I was wondering when you’d finally leave that shop long enough to say hello.',
            'Bramwell — I run the bakery, these days. Used to swing a sword for a living, if you can believe it. Ovens are kinder to the knees.',
        ],
        effects: [ { type: 'setFlag', flag: 'metBramwell', value: true } ],
        choices: [
            {
                label: 'An adventurer? What made you stop?',
                next: 'bramwell_why_stop',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'bramwell', amount: 1 } ],
            },
            {
                label: 'It’s good to finally meet you.',
                next: 'bramwell_wolves',
                requires: null,
                effects: [],
            },
        ],
    },

    bramwell_why_stop: {
        speaker: 'Bramwell',
        portrait: 'bramwell_fond',
        background: 'bakery',
        text: 'Buried a few too many friends who didn’t stop in time. Bread doesn’t bite back — mostly. Ah, but listen, I’m glad you came by, actually.',
        choices: [
            { label: 'What’s wrong?', next: 'bramwell_wolves', requires: null, effects: [] },
        ],
    },

    bramwell_wolves: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: [
            'I found wolf tracks at the edge of the herb patch this morning — bigger than any hedge wolf ought to leave. Whatever it is, it’s been getting bolder.',
            'Now, I could send word to the watch captain in the next town over, get some spears out here in a week or so. Or — there’s a faster way, if you’re willing to hear it.',
        ],
        choices: [
            {
                label: 'Tell me the faster way.',
                next: 'bramwell_suggests_witch',
                requires: null,
                effects: [],
            },
            {
                label: 'Sending for the watch sounds safest. Let’s do that.',
                next: 'bramwell_watch_path',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'calledTheWatch', value: true },
                    { type: 'addAffinity', npc: 'bramwell', amount: 2 },
                ],
            },
        ],
    },

    bramwell_suggests_witch: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: 'There’s a witch out past the tree line — Hollow, she’s called. Keeps to herself, doesn’t think much of the village, but she knows these woods better than anyone living. If anyone can tell you what’s really out there, it’s her.',
        choices: [
            {
                label: 'I’ll go find her.',
                next: 'bramwell_watch_declined',
                requires: null,
                effects: [ { type: 'setFlag', flag: 'seekingHollow', value: true } ],
            },
            {
                label: 'Actually, let’s just send for the watch. Safer.',
                next: 'bramwell_watch_path',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'calledTheWatch', value: true },
                    { type: 'addAffinity', npc: 'bramwell', amount: 2 },
                ],
            },
        ],
    },

    bramwell_watch_declined: {
        speaker: 'Bramwell',
        portrait: 'bramwell_serious',
        background: 'bakery',
        text: 'Her, over the watch? ...Well. It’s your call to make, not mine. Just — be careful. She doesn’t suffer fools, and the wood doesn’t either.',
        effects: [ { type: 'setFlag', flag: 'declinedTheWatch', value: true } ],
        choices: [
            { label: 'Head for the Whisperwood.', next: 'whisperwood_first_look', requires: null, effects: [] },
        ],
    },

    bramwell_watch_path: {
        speaker: 'Bramwell',
        portrait: 'bramwell_fond',
        background: 'bakery',
        text: [
            'Good. I’ll ride out myself and send word today — better a week’s wait than a mauled sheep, or worse.',
            'Here — take this. Carved it myself, years back, from Whisperwood oak. Never did bring me any luck, but maybe it’ll do better by you.',
        ],
        effects: [
            { type: 'giveItem', item: 'oak_charm', count: 1 },
            { type: 'setFlag', flag: 'trustedBramwellOverHollow', value: true },
        ],
        choices: [
            { label: 'Thank you, Bramwell.', next: 'bramwell_after_watch', requires: null, effects: [] },
        ],
    },

    bramwell_after_watch: {
        speaker: 'Bramwell',
        portrait: 'bramwell_jolly',
        background: 'bakery',
        text: 'Go on, get back to that shop before Mira thinks I’ve talked your ear clean off. And come by anytime — the ovens are always warm.',
        choices: [
            {
                label: '(He presses a small locket into your hand before you go)',
                next: 'bramwell_locket_gift',
                requires: { minAffinity: { bramwell: 2 } },
                effects: [],
            },
            { label: '(Return to the square)', next: 'village_square_post_bramwell', requires: null, effects: [] },
        ],
    },

    bramwell_locket_gift: {
        speaker: 'Bramwell',
        portrait: 'bramwell_fond',
        background: 'bakery',
        text: '“Here — for luck, and so you remember there’s a warm oven and a friendly face this side of the wood.” It’s a plain little locket, warm from his pocket.',
        effects: [ { type: 'giveItem', item: 'bakers_locket', count: 1 } ],
        choices: [
            { label: '(Return to the square)', next: 'village_square_post_bramwell', requires: null, effects: [] },
        ],
    },

    village_square_post_bramwell: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: 'With word sent to the watch, there’s little more to do here for now. The Whisperwood still waits at the edge of things, quieter than it should be.',
        choices: [
            { label: 'Head toward the Whisperwood anyway.', next: 'whisperwood_first_look', requires: null, effects: [] },
        ],
    },

    // ============================================================
    // Chapter 3 — The Whisperwood & Hollow the witch
    // ============================================================

    whisperwood_first_look: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: 'The trees close in fast once you leave the last fence post behind. Somewhere off the path, smoke rises in a thin, deliberate line — a chimney, not a wildfire.',
        choices: [
            {
                label: 'Follow the smoke to Hollow’s cottage.',
                next: 'hollow_intro',
                requires: { flag: 'calledTheWatch', negate: true },
                effects: [],
            },
            {
                label: 'Follow the smoke to Hollow’s cottage.',
                next: 'hollow_intro_cold',
                requires: { flag: 'calledTheWatch' },
                effects: [],
            },
        ],
    },

    // Reached only if the watch was already sent for — Hollow finds out and
    // turns the player away. This is the real consequence of trusting Bramwell's
    // "safer" option: it forecloses her whole questline (thimble, wolf hunt,
    // deeper affinity) for this slice of the story.
    hollow_intro_cold: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'witch_cottage',
        text: [
            'She’s waiting on the porch before you clear the tree line, arms folded, and she doesn’t look glad to see you.',
            '“Word travels faster than you’d think, even out here. The watch, apothecary? You didn’t think to ask me first?”',
        ],
        choices: [
            {
                label: 'I didn’t know there was a "first." I’m sorry.',
                next: 'hollow_cold_end',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: -1 } ],
            },
            {
                label: 'It seemed like the safer choice for everyone.',
                next: 'hollow_cold_end',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: -2 } ],
            },
        ],
    },

    hollow_cold_end: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: '“Spears frighten a starving animal into the next farmstead over instead of home. But it’s done now.” She turns back toward the door. “I’ve nothing more to say to you today.”',
        choices: [
            { label: '(Leave quietly, deeper into the wood)', next: 'deep_wood_edge', requires: null, effects: [] },
        ],
    },

    hollow_intro: {
        speaker: 'Hollow',
        portrait: 'hollow_wary',
        background: 'witch_cottage',
        text: [
            'A woman steps out onto the porch before you’ve even knocked, a knife and a bundle of dried root still in her hands.',
            '“The apothecary’s heir. I wondered how long before one of you came knocking. Well? Out with it.”',
        ],
        choices: [
            {
                label: 'There have been wolf tracks near the village. I was hoping you’d know something.',
                next: 'hollow_wolves_direct',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 1 } ],
            },
            {
                label: '(Say nothing about the wolves — just admire the cottage)',
                next: 'hollow_smalltalk',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: -1 } ],
            },
        ],
    },

    hollow_smalltalk: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: '“Admiring it won’t fix the hinges.” She doesn’t look up from her work. “If you’ve nothing useful to say, I have roots to dry before nightfall.”',
        choices: [
            {
                label: 'Fine — there are wolf tracks near the village. Bigger than usual.',
                next: 'hollow_wolves_direct',
                requires: null,
                effects: [],
            },
        ],
    },

    hollow_wolves_direct: {
        speaker: 'Hollow',
        portrait: 'hollow_neutral',
        background: 'witch_cottage',
        text: [
            '“Bigger, you say.” She finally looks at you properly. “There’s a hedge wolf denning too close to the path this season — driven out of the deep wood by something, though I couldn’t say what.”',
            '“It’s not evil. It’s hungry and it’s scared, which is worse in a way. Someone will have to drive it back before a child wanders too far.”',
        ],
        choices: [
            {
                label: 'I’ll do it. Where do I find it?',
                next: 'hollow_sends_you',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'hollow', amount: 2 } ],
            },
        ],
    },

    hollow_sends_you: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            '“Just past the fern hollow, north of here. Take this.” She presses a small silver thimble into your hand, its rim etched with careful, cramped runes.',
            '“Steadies the hand and the nerve, both. My grandmother’s, before she wasn’t needing it anymore. Don’t lose it.”',
        ],
        effects: [
            { type: 'giveItem', item: 'silver_thimble', count: 1 },
            { type: 'setFlag', flag: 'trustedHollowOverBramwell', value: true },
        ],
        choices: [
            { label: 'Head north to the fern hollow.', next: 'hedge_wolf_fight', requires: null, effects: [] },
        ],
    },

    hedge_wolf_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: 'The fern hollow is close and dim. A low growl rolls out of the shadows before you see the wolf itself — ribs showing, hackles up, more afraid than it wants to admit.',
        battle: 'hedge_wolf',
        onWin: 'hedge_wolf_won',
        onLose: 'hedge_wolf_lost',
        choices: [],
    },

    hedge_wolf_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: 'The wolf breaks off and flees deeper into the wood rather than press its luck further. It won’t trouble the herb patch again — not for a good while, anyway.',
        effects: [ { type: 'giveXp', amount: 20 } ],
        choices: [
            { label: 'Return to tell Hollow it’s done.', next: 'hollow_thanks', requires: null, effects: [] },
        ],
    },

    hedge_wolf_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'whisperwood_edge',
        text: 'The wolf gets the better of you and you beat a limping retreat back toward the tree line, pride more wounded than anything else.',
        choices: [
            { label: 'Return to tell Hollow what happened.', next: 'hollow_thanks', requires: null, effects: [] },
        ],
    },

    hollow_thanks: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            'She listens to the whole account without interrupting, which from her feels like high praise.',
            '“Good. Better it runs than either of you bleeds for it.” The faintest smile. “You’re not entirely useless, apothecary. Come back if you like — I don’t say that to everyone.”',
        ],
        effects: [ { type: 'addAffinity', npc: 'hollow', amount: 2 }, { type: 'giveXp', amount: 8 } ],
        choices: [
            {
                label: '(Ask if there’s more to the wood than this)',
                next: 'hollow_deep_wood_hint',
                requires: { minAffinity: { hollow: 3 } },
                effects: [],
            },
            { label: '(Head deeper into the wood alone)', next: 'deep_wood_edge', requires: null, effects: [] },
        ],
    },

    hollow_deep_wood_hint: {
        speaker: 'Hollow',
        portrait: 'hollow_warm',
        background: 'witch_cottage',
        text: [
            '“More than this? Apothecary, you’ve barely seen the hem of it.” She sets down her knife. “There’s a boar past the fern hollow — thornback, they call it, though it wasn’t born with those quills.”',
            '“Something in the deep wood is changing what lives there. I don’t know what yet. If you go looking, take more than nerve with you.”',
        ],
        effects: [ { type: 'addAffinity', npc: 'hollow', amount: 1 } ],
        choices: [
            { label: 'I’ll be careful. Thank you, Hollow.', next: 'deep_wood_edge', requires: null, effects: [] },
        ],
    },

    // ============================================================
    // Chapter 4 — The Deep Whisperwood (Phase 3: scaling encounters,
    // trade-off equipment, brewing materials)
    // ============================================================

    deep_wood_edge: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'Past the fern hollow the trees grow close and old, and the birdsong thins to almost nothing. Something has been digging along the path — deep, deliberate furrows, not the scuffing of rabbits.',
            'Pale flowers grow in the shade here that you don’t recognize from any of your aunt’s books. You gather a few, carefully.',
        ],
        effects: [
            { type: 'giveItem', item: 'moonpetal', count: 2 },
        ],
        choices: [
            { label: 'Follow the furrows.', next: 'thornback_boar_fight', requires: null, effects: [] },
        ],
    },

    thornback_boar_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'The furrows end at a clearing where a boar twice the size it should be roots through the undergrowth — its back bristling with quills that click together like knives.',
        battle: 'thornback_boar',
        onWin: 'thornback_boar_won',
        onLose: 'thornback_boar_lost',
        choices: [],
    },

    thornback_boar_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'The boar finally breaks and crashes off through the brush, shedding quills in its wake. You gather up the sturdiest ones — they might be worth brewing or binding into something useful.',
        effects: [
            { type: 'giveItem', item: 'thornback_quill', count: 3 },
            { type: 'giveXp', amount: 26 },
        ],
        choices: [
            { label: 'Press on, deeper still.', next: 'deep_wood_stalker_intro', requires: null, effects: [] },
        ],
    },

    thornback_boar_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'The boar is too much for you today. You retreat, quill-scratched and humbled, back toward the fern hollow to recover.',
        choices: [
            { label: 'Catch your breath, then press on.', next: 'deep_wood_stalker_intro', requires: null, effects: [] },
        ],
    },

    deep_wood_stalker_intro: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'The trees open onto a hollow so quiet your own footsteps sound rude. Something pale-eyed watches you from a low branch without blinking — an owl, if owls grew to that size.',
            'It doesn’t look hungry so much as curious. That might be worse.',
        ],
        choices: [
            {
                label: 'Hold still and watch it back.',
                next: 'deep_wood_stalker_fight',
                requires: null,
                effects: [],
            },
            {
                label: 'Back away slowly, the way you came.',
                next: 'deep_wood_retreat',
                requires: null,
                effects: [],
            },
        ],
    },

    deep_wood_retreat: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'You back out of the hollow without ever taking your eyes off the branch. Whatever it was, it lets you go. For now, that’s enough of the deep wood.',
        choices: [
            { label: '(End of Phase 3 preview)', next: 'end_preview', requires: null, effects: [] },
        ],
    },

    deep_wood_stalker_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'The stalker drops from the branch without a sound, wings wide, and the hollow goes darker than it has any right to.',
        battle: 'deep_wood_stalker',
        onWin: 'deep_wood_stalker_won',
        onLose: 'deep_wood_stalker_lost',
        choices: [],
    },

    deep_wood_stalker_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: [
            'The stalker breaks off and vanishes back up into the canopy rather than press the fight further, leaving only a scattering of down and a strange quiet behind.',
            'Whatever is changing this part of the wood, you’ve bought yourself — and the village — a little more time to figure out what.',
        ],
        effects: [ { type: 'giveXp', amount: 34 } ],
        choices: [
            { label: '(End of Phase 3 preview)', next: 'end_preview', requires: null, effects: [] },
        ],
    },

    deep_wood_stalker_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'deep_whisperwood',
        text: 'The stalker is more than you bargained for. You retreat all the way back to the village, shaken, already thinking about what you’ll need to come back better prepared.',
        choices: [
            { label: '(End of Phase 3 preview)', next: 'end_preview', requires: null, effects: [] },
        ],
    },

    end_preview: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'That’s the end of this preview slice of Hearthbound.',
            'More of the village, its people, and whatever is stirring deeper in the Whisperwood are still to come.',
        ],
        choices: [],
        ending: true,
    },
};
