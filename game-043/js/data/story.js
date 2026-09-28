// ============================================================
// The main quest: "The Heartwood". Each step has an objective line,
// a completion check (evaluated by sim/story.js) and what the Mayor
// and Glim say while it is current. Templates use {player}, {mayor},
// {glim}, {glen}, {aunt}, {region}, {dungeon}, {gate}, {title}, {k}.
// ============================================================

export const GATE_TEXT = { thorn: 'the thornwall', boulder: 'the boulders', shallows: 'the shallows', dark: 'the dark hollow' };

export const PROLOGUE = [
    { id: 'talk_mayor', goal: 'Talk to the old-timer by the great tree.',
      mayor: ["Oh! A visitor? Nobody's come down that road in… goodness, years.", "Wait — you're {aunt}'s kin, aren't you? I'd know that stubborn chin anywhere. They wrote that you'd come.", "I'm {mayor}. I suppose I'm the Mayor, if a village of one needs one. Welcome to {glen}.", "It's not much now. Forty years ago this was the happiest little village in the valley. Then the Heartwood's heart shattered, and the magic went to sleep, and people drifted away.", "That cabin with the red door is yours. And there's a little light by the Heartwood that's been waiting for you. Go and say hello."] },
    { id: 'meet_glim', goal: 'Meet the little light by the Heartwood.',
      mayor: ["Go on, the little light by the tree. It doesn't bite. I don't think it can."],
      glim: ["…!", "You can SEE me? Oh, oh, oh! Nobody has seen me in forty years!", "I'm {glim}. I'm what's left of the Heartwood's magic. A crumb of it. A sparkle.", "The Heartwood's heart broke into five Heart Shards. They fell into the five wild lands around the Glen. Without them the magic sleeps — shrines, fairy rings, secret things, all faded to nothing.", "But magic follows warmth. If people come back and the Glen feels like home again, the old seals will wake up. And the shards can come home.", "Start small. Make the Glen yours. Clear your field, plant something. I'll be right here!"] },
    { id: 'clear_farm', goal: 'Clear 10 weeds, rocks or stumps from your field. (Face them and press A.)',
      glim: ["Your field is south of your cabin. Weeds come up by hand; rocks need the pickaxe, stumps the axe. The A button picks the right tool for you!"] },
    { id: 'plant', goal: 'Till the soil (select the Hoe) and plant 5 seeds. Water them!',
      glim: ["Select the Hoe on your hotbar and use it on the cleared soil. Then select your seeds and plant. Then water with the can — the pond by the field refills it."] },
    { id: 'board', goal: 'Gather 15 wood and build the Job Board by the plaza.',
      mayor: ["You know what this place needs? A job board. When there were folk here, the board was the heart of the plaza. Postings, requests, gossip.", "Bring 15 wood to the old board posts east of the Heartwood and put it back together. People passing through will see it and know somebody lives here again."] },
    { id: 'sleep', goal: 'Go home and sleep. Tomorrow is a new day.',
      mayor: ["The board looks wonderful! Get some rest, {player}. I've a feeling someone will be along tomorrow."] },
];

export const CHAPTER1 = [
    { id: 'welcome', goal: 'Build a home for one of the newcomers. (Clear a lot, then use its sign.)',
      mayor: ["We have visitors! Two travellers saw the board and want to stay. They each need a proper place to work and live.", "Clear one of the overgrown lots, then use its sign to build. The Carpenter would want a Workshop; the Farmer a Farmhouse. Talk to them — they'll tell you."] },
    { id: 'explore', goal: 'Explore {region}.',
      glim: ["I can feel the first shard! It's in {region}, through the path past the thicket. Someone's already warming the Glen — the first seal is loosening!"] },
    { id: 'dungeon', goal: 'Find the Heart Shard in {dungeon}.',
      glim: ["The shard is deep in {dungeon}. There'll be wild things down there who've grown fond of it. Bring food. Guard when they wind up a big hit!"] },
    { id: 'return', goal: 'Bring the Heart Shard home to the Heartwood.',
      glim: ["You found it! I can feel it from here! Bring it to the Heartwood!"] },
];

export const CHAPTER_N = [   // chapters 2..5, templated by k
    { id: 'level', goal: 'Grow {glen} into a {title} (village level {k}).',
      mayor: ["The seal on {dungeon} is waking — but it wants more warmth than we have yet. The Glen needs to be a {title} before it'll open.", "More folk, more buildings, happier neighbours. Finish board postings, ship goods, build what people need."] },
    { id: 'gate', goal: 'Get past {gate} into {region}.',
      glim: ["The next shard is in {region}. The way in is blocked by {gate} — but the relic you found will get you through!"] },
    { id: 'dungeon', goal: 'Find the Heart Shard in {dungeon}.',
      glim: ["It's in {dungeon}. Deeper than the last. Stock up — and maybe ask a friend to come along?"] },
    { id: 'return', goal: 'Bring the Heart Shard home to the Heartwood.',
      glim: ["Another shard! Bring it home, bring it home!"] },
];

export const FINALE = [
    { id: 'festival', goal: 'At dusk (after 6pm), gather everyone at the Heartwood.',
      mayor: ["All five shards… I never thought I'd see it. Tonight, at dusk, we gather at the Heartwood. Everyone. It's what we used to do."],
      glim: ["The heart is whole. But a heart needs people around it. Come back at dusk — when the lanterns are lit."] },
    { id: 'after', goal: 'The Glen is awake. Keep building, farming and exploring!', final: true },
];

export const SHARD_BLESSINGS = [
    null,
    { text: 'Crops grow a little faster: a 10% chance to grow twice overnight.', key: 'farm1' },
    { text: 'Your maximum energy rises by 20.', key: 'energy' },
    { text: 'Tool upgrades and building costs are 10% cheaper.', key: 'cheap' },
    { text: 'Companions hit 25% harder, and every villager is happier.', key: 'companion' },
    { text: 'Every hidden glimmer in the land is awake.', key: 'allmagic' },
];

export const RETURN_LINES = [
    ["The shard slides into the hollow of the Heartwood like it never left.", "Green light runs up the trunk. Something in the air feels… warmer."],
];

export const FESTIVAL_LINES = [
    "As the sun goes down, lanterns come on one by one around the plaza.",
    "{mayor} steps up to the Heartwood and lays a hand on the bark.",
    "\"Forty years ago I stood right here and watched this tree go dark. I stayed because I couldn't bear to leave it alone.\"",
    "\"I don't have to be alone with it anymore.\"",
    "The five shards glow. The glow spreads up through the trunk, along every branch, out to every leaf —",
    "— and the Heartwood blooms.",
    "Blossoms open all at once, pink and gold, and drift down over the plaza like warm snow.",
    "{glim} spins in delighted circles. \"LOOK AT IT! LOOK AT US!\"",
    "Somebody starts playing music. Somebody else brings food. Nobody goes home until very, very late.",
    "{glen} is awake.",
];
