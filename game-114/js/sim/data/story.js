// The story: an intro, a briefing before each sector and the endings. Pure data.

export const INTRO = [
    'The colony ark HALCYON left Earth three hundred years ago with 4,000 sleepers aboard.',
    'Your cryo pod opened early. The deck lights are red. Every other pod on your row is empty, torn open from the outside.',
    'Something came aboard while you slept, and it took the others home with it.',
];

/** One briefing per sector, spoken by the ark's ship-mind, KESTREL. */
export const BRIEFS = [
    {
        speaker: 'KESTREL',
        text: 'You are awake. Good. I could not stop them. The Hive boarded us eleven days ago and has been carrying the sleepers off in cocoons. A few are still on this deck, sealed in pods. Cut them free and I will pull them to the shuttle bay. The armoury is two decks down. Go.',
    },
    {
        speaker: 'KESTREL',
        text: 'Hydroponics. The Hive has seeded the gardens; the acid in the troughs will eat through a boot. Something large is nesting in the main dome. It lays the crawlers you have been fighting. If you kill it, the eggs stop coming.',
    },
    {
        speaker: 'KESTREL',
        text: 'The Mother is dead and the crawlers are scattering. The reactor ring vents steam on a timer; watch the grates. Keep moving forward. The Hive ship is docked at the Command Spine, and it is warming its engines.',
    },
    {
        speaker: 'KESTREL',
        text: 'They have taken the security system. WARDEN-9 guards the bridge, and it no longer answers to me. Get past it and the Hive ship is yours to follow. I will fly the shuttle. You will not like the landing.',
    },
    {
        speaker: 'KESTREL',
        text: 'Homeworld. The air is breathable, the ash is not. The cocoons we followed came this way: I count more signals ahead. The Hive grows its young in nests in the ground. Burn them before they wake.',
    },
    {
        speaker: 'KESTREL',
        text: 'These canyons are the ribs of something that died here long ago. The ground is hollow. Something under it is moving towards your footsteps. When the ground shakes, do not stand still.',
    },
    {
        speaker: 'KESTREL',
        text: 'The spires are the Hive\'s city. I can hear the sleepers now, all of them, in one place below the tallest spire. The Queen keeps them in a larder. They are alive. For now.',
    },
    {
        speaker: 'KESTREL',
        text: 'This is the Larder. One hundred and twelve colonists, sealed in the walls, and the Queen between you and them. She has fed on settlers before; her chamber is lined with their ships. End this. Bring them home.',
    },
];

/** The ending, chosen by how many pods were opened along the way. */
export function ending(rescued, total) {
    const all = rescued >= total;
    const most = rescued >= Math.ceil(total * 0.6);
    return {
        title: all ? 'NOBODY LEFT BEHIND' : most ? 'THE ARK FLIES AGAIN' : 'THE LAST COLONISTS',
        text: [
            'The Queen falls, and the walls of the Larder split open. One hundred and twelve sleepers stumble out into the light of the alien sun.',
            all
                ? `Every pod on the way here was opened, too: all ${total}. KESTREL counts them twice, to be sure.`
                : `On the way here you cut ${rescued} of ${total} colonists from their pods. KESTREL marks the names of the rest, and promises to come back for them.`,
            most
                ? 'The shuttle makes trip after trip to the HALCYON. Within a week the ark is under way again, on course for a quieter world.'
                : 'The shuttle makes trip after trip. The ark is very empty, but it is not alone any more.',
            'You were the last colonist awake. You are not the last one any more.',
        ],
    };
}
