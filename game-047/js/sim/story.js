/**
 * story.js — The Last Hand. The authored spine of the story.
 *
 * Every world has: a chapter card, a prologue (read by the Ferryman), an
 * interlude met on floor 6 with a choice, a Warden's challenge before the
 * fight and last words after it, and an epilogue. The hero is always "you".
 *
 * Choice effects use the vocabulary in run.js applyEffects():
 *   gold, hp, maxHp, healPct, card ('random'|'rare'|{rank,suit,ench}|{arcana}),
 *   remove (count to choose), upgrade (count to choose), enchant (enchant key or
 *   'random', chosen card), relic ('random'|'rare'|id), elixir, ash (permanent
 *   Ash cards), flag.
 */

export const OPENING = {
    title: 'The Last Hand',
    lines: [
        'Before there were kings, before there were stars to name, the gods sat down at a table of black stone and played cards for the shape of the world.',
        'The Dealer dealt ten Crowns to ten realms, and the realms bloomed. For an age the game went on, slow and beautiful, one card at a time.',
        'Then the last hand was dealt, and a player at the table — a king with a hollow chest — palmed the Ace of Hearts. The heart of the world. He never played it. He never gave it back.',
        'The hand was never finished. And a world with an unfinished hand begins to burn.',
        'Ash has been falling for a hundred years. The ten realms are sealed behind their Wardens. The gods have left the table.',
        'But the cards remember. And a few people can still hear them.',
        'You are one of the last Cardbound. You carry the Dealer\'s final deck. Somewhere past ten realms, the Hollow King sits on his throne with a hand he will not play.',
        'Go and finish it.',
    ],
};

export const FERRYMAN = 'The Ferryman';

export const CHAPTERS = [
    // 1 — Emberfall Marches
    {
        numeral: 'I', title: 'The Ash Harvest',
        prologue: [
            'The boat grinds onto a bank of cinders. Beyond it, wheat burns without being consumed — gold fields flickering under a sky the colour of a banked forge.',
            '"Emberfall," says the Ferryman, shipping his oars. "The first realm to catch. They say the Baron still walks his fields at harvest, counting sheaves that turned to ash a century ago."',
            '"He holds the first Crown. He will not give it to you. Nobody told him the harvest was over, you see, and he is very good at his job."',
            'He hands you a lantern that is not lit. "Deal carefully. The cards like to be placed where they belong."',
        ],
        interlude: {
            title: 'The Mill That Still Turns',
            text: [
                'In a mill whose sails are made of flame, an old miller grinds ash into flour. He has been doing it so long he no longer remembers why.',
                '"Bread for the Baron\'s table," he says, not looking up. "He likes it fresh. Would you carry a loaf? Or — here. Take a sack of seed. Real seed, from before. I was saving it for when the fire stops."',
            ],
            choices: [
                { label: 'Take the seed', desc: 'Gain a Hearts card enchanted Vampiric. The miller smiles for the first time in a century.', effects: [{ card: { rank: 9, suit: 'H', ench: 'vampiric' } }, { flag: 'seed' }] },
                { label: 'Take the bread', desc: 'Heal 20 HP.', effects: [{ hp: 20 }] },
                { label: 'Grind with him a while', desc: 'Upgrade 2 cards of your choice.', effects: [{ upgrade: 2 }] },
            ],
        },
        bossIntro: [
            'A scarecrow as tall as a church rises from the burning wheat. Crows spill from its sleeves. Its head is a lantern, and in the lantern, a face.',
            '"TRESPASS," says the Baron. "THE HARVEST IS NOT DONE. THE HARVEST IS NEVER DONE. I HAVE COUNTED EVERY SHEAF."',
            '"You have not counted me," you say, and deal.',
        ],
        bossDefeat: [
            'The lantern gutters. The Baron sways, then kneels in the wheat like a man who has finally been allowed to sit down.',
            '"Is it... over, then? The harvest?" A crown of blackened iron slips from the straw. "Good. Good. I was so tired of counting."',
        ],
        epilogue: [
            'Rain falls on Emberfall for the first time in a hundred years. It hisses on the cinders. It will take a long time to put the fire out, but it has begun.',
            '"One," says the Ferryman, and pushes off from the shore.',
        ],
    },
    // 2 — The Drowned Cathedral
    {
        numeral: 'II', title: 'Vespers Under Water',
        prologue: [
            'The river runs underground and comes up inside a cathedral. You drift down the nave between pillars furred with glowing kelp. Somewhere below the water, a choir is singing.',
            '"When the ash came, the sea came with it," the Ferryman says. "The Abbess would not let the choir stop. So they sang while the water rose, and when it closed over their heads, they kept singing."',
            '"She holds the Crown of Tides. She believes that as long as the hymn goes on, nothing is lost. You may find it hard to argue."',
        ],
        interlude: {
            title: 'The Sexton\'s Bell',
            text: [
                'In the bell-tower, the only dry place left, a sexton sits by a bell he is forbidden to ring. "Ring it," he whispers, "and the choir stops. They\'ll hear it and remember they\'re dead. The Abbess will never forgive me."',
                '"But they\'re so tired. Can\'t you hear how tired they are?"',
            ],
            choices: [
                { label: 'Ring the bell', desc: 'The choir falls silent. Gain a rare relic. Lose 8 HP as the tower shakes.', effects: [{ relic: 'rare' }, { hp: -8 }, { flag: 'bell' }] },
                { label: 'Let them sing', desc: 'Listen until dawn. Remove a card from your deck. Heal 10.', effects: [{ remove: 1 }, { hp: 10 }] },
                { label: 'Take the bell-rope', desc: 'Gain a Coins card enchanted Stone and 40 gold.', effects: [{ card: { rank: 10, suit: 'D', ench: 'stone' } }, { gold: 40 }] },
            ],
        },
        bossIntro: [
            'At the altar the Abbess waits, knee-deep in black water, her habit drifting like weed. Her eyes are closed. Her mouth is open. She has never stopped singing.',
            '"You have come to end the hymn," she says, without breaking the note. "Everyone who comes here comes to end the hymn. Kneel. Sing with us. You will not drown if you never stop."',
        ],
        bossDefeat: [
            'The note breaks. For a moment there is only the sound of dripping water.',
            '"Oh," says the Abbess softly, opening her eyes. "It is quiet. I had forgotten what quiet was." She lifts the Crown of Tides from her own head and sets it on the water, where it floats to you.',
        ],
        epilogue: [
            'Behind you, one by one, the drowned choir lie down in the water and sleep.',
            '"Two," says the Ferryman. He does not sound pleased. He sounds like a man doing sums.',
        ],
    },
    // 3 — Thornwild
    {
        numeral: 'III', title: 'The Hedge of Years',
        prologue: [
            'The river narrows until the trees meet overhead, and then the trees are not trees but thorns: a hedge a hundred feet high, grown over the roofs and towers of a sleeping city.',
            '"The Briar Queen\'s court," says the Ferryman. "When the ash came she sealed her people inside the hedge to keep them safe. They are safe. They are also asleep, and have been for ninety years, and the hedge will not let anyone wake them."',
            '"Mind the roses. They bite."',
        ],
        interlude: {
            title: 'The Sleeping Knight',
            text: [
                'Beneath a bower of white roses a knight sleeps in her armour, sword across her knees, thorns grown through the joints of her gauntlets. She is breathing. Her lips move: she is dreaming of a battle she never got to fight.',
                'A fey hare watches you from the grass. "You could wake her," it says. "It would hurt. Or you could take the sword. She won\'t miss it. She\'ll never miss anything again."',
            ],
            choices: [
                { label: 'Wake the knight', desc: 'She pulls free of the thorns and swears to fight beside you. Lose 10 HP. Gain 3 Might in your next combat… and a Blades card enchanted Keen.', effects: [{ hp: -10 }, { card: { rank: 12, suit: 'S', ench: 'keen' } }, { flag: 'knight' }, { nextMight: 3 }] },
                { label: 'Take the sword', desc: 'Gain a King of Blades enchanted Glass.', effects: [{ card: { rank: 13, suit: 'S', ench: 'glass' } }] },
                { label: 'Leave her dreaming', desc: 'The hare approves. Gain a random relic.', effects: [{ relic: 'random' }] },
            ],
        },
        bossIntro: [
            'The hedge parts like a curtain. The Briar Queen sits on a throne of living thorn, beautiful and terrible, her gown made of petals and her crown made of hooks.',
            '"Out there is ash," she says. "In here is sleep. I chose sleep for them. I chose it for myself. Who are you, to choose ash for us instead?"',
            '"Someone who wants to see what grows after the fire," you say.',
        ],
        bossDefeat: [
            'The thorns wither, curling back from the towers like fingers unclenching. Somewhere a bell rings, and a thousand sleepers stir.',
            '"They will wake to ash," the Queen whispers. "Be sure you are right." Her crown drops, and roses grow where it lands.',
        ],
        epilogue: [
            'The city wakes behind you, blinking, into grey light. Someone is laughing. Someone is weeping. Both, perhaps.',
            '"Three," says the Ferryman. And then, almost to himself: "She asked the right question."',
        ],
    },
    // 4 — Glasswind Dunes
    {
        numeral: 'IV', title: 'A Thousand Reflections',
        prologue: [
            'The river spills out into a desert and keeps going, a ribbon of water across dunes of powdered glass. Two suns hang in the sky. One of them is lying.',
            '"The Mirage Sultan," says the Ferryman, squinting. "He bargained with the heat. It gave him the power to be anywhere, anyone, anything. The price was that he could never again be sure which of him was real."',
            '"Trust your cards. Not your eyes. Especially not your eyes."',
        ],
        interlude: {
            title: 'The Glass Merchant',
            text: [
                'A caravan of glass camels, a merchant of glass, a tent of glass with a glass teapot. Only the merchant\'s voice is real, and it sounds very, very old.',
                '"I am the last of him that is honest," he says. "The Sultan cast me out. Buy something. Buy my name back from the dunes, if you like — it costs everything, and it is the only true thing I own."',
            ],
            choices: [
                { label: 'Buy his name', desc: 'Pay all your gold. Gain two rare relics.', effects: [{ goldAll: true }, { relic: 'rare' }, { relic: 'rare' }, { flag: 'merchant' }] },
                { label: 'Buy a mirror', desc: 'Pay 60 gold. Gain the Arcana Mirror, upgraded, and Transmute.', effects: [{ gold: -60 }, { card: { arcana: 'mirror', up: true } }, { card: { arcana: 'transmute' } }], cost: 60 },
                { label: 'Share his tea', desc: 'It tastes of nothing at all. Enchant a card of your choice Wild.', effects: [{ enchant: 'wild' }] },
            ],
        },
        bossIntro: [
            'Nine Sultans rise from the heat-haze, identical, robed in white fire, each holding a scimitar made of noon.',
            '"Which of us will you strike?" they say together. "Choose. We have been choosing for a century. It is harder than it looks."',
        ],
        bossDefeat: [
            'One by one the reflections go out, until a single thin man stands in the sand, blinking at his own hands.',
            '"This one," he says wonderingly. "This one is me. I had quite forgotten." He gives you the Crown of Mirages as if it were a thing of no importance, which, to him, it now is.',
        ],
        epilogue: [
            'One of the suns sets. It does not rise again. The desert is slightly darker and entirely honest.',
            '"Four," says the Ferryman. "You are doing better than the last one."',
            '"The last one?"',
            'He does not answer.',
        ],
    },
    // 5 — Frostmourn Peaks
    {
        numeral: 'V', title: 'The Long Winter',
        prologue: [
            'Past the desert the river freezes and the Ferryman sets his boat on runners. The mountains here are black ice under an aurora that crackles like a card being shuffled.',
            '"When the fire came to the world, a mountain stood up to stop it," he says. "It walked into the flames and lay down on them, and froze them in place. It is still lying there. It is still holding the fire down."',
            '"The Rime Colossus. It will not let you pass. Not because it hates you. Because it is afraid of what happens if it moves."',
        ],
        interlude: {
            title: 'The Frozen Hearth',
            text: [
                'In a cave you find a hearth, and in the hearth a fire frozen solid: flames of orange ice, perfectly still. A family of mountain folk huddle round it, warming their hands at nothing.',
                '"Grandmother says it will thaw when the Colossus wakes," says a child. "Is that true? Will it burn us?"',
            ],
            choices: [
                { label: 'Thaw the hearth', desc: 'Break the ice with your cards. Lose 6 HP. Gain 20 max HP.', effects: [{ hp: -6 }, { maxHp: 20 }, { flag: 'hearth' }] },
                { label: 'Leave them a card', desc: 'Remove 2 cards from your deck — they need them more.', effects: [{ remove: 2 }] },
                { label: 'Sit by the cold fire', desc: 'Upgrade 3 random cards.', effects: [{ upgradeRandom: 3 }] },
            ],
        },
        bossIntro: [
            'The mountain moves. What you took for a ridge is a shoulder; what you took for a glacier, an arm. Two eyes open in the ice, each the size of a house, blue and old and very tired.',
            '"LITTLE ONE," it says, and snow falls from the peaks. "UNDER ME IS THE FIRE. IF I RISE, IT RISES. GO BACK."',
            '"If you never rise," you say, "you never get to see the spring."',
        ],
        bossDefeat: [
            'The Colossus sighs, and the whole range trembles. Meltwater pours from its shoulders.',
            '"THEN LET IT BE SPRING," it says, and lies back down — not on the fire, but beside it, where it can watch it burn low and warm. The Crown of Rime rolls down the slope like a snowball.',
        ],
        epilogue: [
            'Behind you, the frozen hearths of Frostmourn begin, very slowly, to flicker.',
            '"Five," says the Ferryman. "Halfway." He rows in silence for a long time. "You should know that I have rowed this river before."',
        ],
    },
    // 6 — The Gilded Deep
    {
        numeral: 'VI', title: 'All That Glitters',
        prologue: [
            'The river plunges into the earth. Down and down, through dwarf-holds carved with the faces of forgotten kings, until the water turns to molten gold and the Ferryman\'s oars begin to smoke.',
            '"Mammon," he says. "When the world started to burn, he bought up all its warmth. Every hearth, every candle, every summer. Then he ate it, so no one could buy it back."',
            '"He will try to buy you. He will offer a very good price. That is how you will know he is lying."',
        ],
        interlude: {
            title: 'The Last Honest Dwarf',
            text: [
                'In a forge that has been cold for a century, a dwarf smith hammers at an anvil with no fire. "Mammon took the forge-heat," she grunts. "I kept hammering anyway. Old habit."',
                '"You carry cards with some fire left in them. Lend me one. I\'ll give it back better than it was. Or I can melt your purse down into something useful."',
            ],
            choices: [
                { label: 'Lend her a card', desc: 'Enchant a card of your choice with a random enchantment, then upgrade it.', effects: [{ enchant: 'random', upgradeToo: true }] },
                { label: 'Melt the purse', desc: 'Pay 80 gold. Gain a rare relic.', effects: [{ gold: -80 }, { relic: 'rare' }], cost: 80 },
                { label: 'Hammer with her', desc: 'Gain 2 Coins cards enchanted Gilded.', effects: [{ card: { rank: 8, suit: 'D', ench: 'gilded' } }, { card: { rank: 11, suit: 'D', ench: 'gilded' } }, { flag: 'smith' }] },
            ],
        },
        bossIntro: [
            'Mammon fills a cavern the size of a sky. He is made of coins — millions of them, clinking and shifting — and where his heart should be, a furnace glows with a hundred stolen summers.',
            '"A buyer!" he booms. "Everything has a price, little Cardbound. Your deck. Your name. Your quest. I\'ll pay you the Crown for them. I\'ll pay you ten Crowns. Name your figure."',
            '"The warmth," you say. "All of it. Back."',
            '"Ah," says Mammon. "Not for sale."',
        ],
        bossDefeat: [
            'Mammon cracks open like a purse. A hundred summers pour out of him, and the forges of the Deep roar back to life all at once.',
            '"It was mine," he whimpers, dwindling to a single tarnished coin. "I paid for it." You leave the coin where it falls. You take the Crown.',
        ],
        epilogue: [
            'You come up out of the earth into a night that is — just slightly — warmer.',
            '"Six," says the Ferryman. "The last one never got past Mammon. He took the price." He looks at you. "I am glad you did not."',
        ],
    },
    // 7 — Skyreach Aerie
    {
        numeral: 'VII', title: 'Above the Ash',
        prologue: [
            'The river leaves the ground entirely. It pours upward in a braided waterfall, and the boat climbs it into a sky full of floating islands, windmills turning in the storm-light, and banners that snap like whips.',
            '"The Storm Roc flew higher than anything has ever flown," the Ferryman shouts over the wind. "High enough to see the Hollow Throne from above. Whatever it saw there drove it mad."',
            '"It has been screaming ever since. That is the storm. The storm is the screaming."',
        ],
        interlude: {
            title: 'The Windmill Oracle',
            text: [
                'On the highest island a blind oracle lives in a windmill, reading the future in the patterns of the sails. "I know what the Roc saw," she says before you speak. "I can tell you. It will cost you your sleep."',
                '"Or you can choose not to know, and carry a little more luck instead."',
            ],
            choices: [
                { label: 'Learn what the Roc saw', desc: '"The King on his throne, holding a card to his chest. And behind him, an empty chair." Gain 2 random relics. Lose 10 max HP.', effects: [{ relic: 'random' }, { relic: 'random' }, { maxHp: -10 }, { flag: 'oracle' }] },
                { label: 'Choose not to know', desc: 'Gain 2 elixirs and 50 gold.', effects: [{ elixir: 'random' }, { elixir: 'random' }, { gold: 50 }] },
                { label: 'Ask about yourself', desc: '"You will be offered a chair." Upgrade 2 cards of your choice. Heal 15.', effects: [{ upgrade: 2 }, { hp: 15 }] },
            ],
        },
        bossIntro: [
            'The Roc comes out of the thunderhead like a falling mountain, wings wide enough to shade a city, eyes full of lightning and something much worse. It is screaming words.',
            '"THE CHAIR THE CHAIR THE EMPTY CHAIR DO NOT GO DO NOT GO HE IS WAITING FOR YOU HE HAS BEEN WAITING FOR SO LONG"',
        ],
        bossDefeat: [
            'The Roc folds its wings and drops out of the sky. You find it on the edge of an island, small now, shivering, its feathers soaked.',
            '"You will see it too," it whispers. "The chair. Everyone who gets this far sees the chair." It gives you the Crown of Storms with its beak and closes its eyes. The sky, for the first time in a century, is simply blue.',
        ],
        epilogue: [
            '"Seven," says the Ferryman, and for once he does not pick up the oars straight away.',
            '"What chair?" you ask.',
            '"The Dealer\'s," he says. "Ask the fool. The fool always knows."',
        ],
    },
    // 8 — The Umbral Carnival
    {
        numeral: 'VIII', title: 'The House Always Wins',
        prologue: [
            'Night comes down all at once, and with it music: a calliope playing a waltz slightly too slowly. The river becomes a canal lit with paper lanterns, winding through the tents of a carnival that has not closed in a thousand years.',
            '"The Harlequin was the Dealer\'s jester," says the Ferryman. "He sat at the gods\' table and made them laugh. When the gods left, he stayed. He built this place so there would always be a game."',
            '"He cheats. Everyone knows he cheats. That is not the dangerous part."',
            '"What is?"',
            '"He tells the truth."',
        ],
        interlude: {
            title: 'The Fortune-Teller\'s Booth',
            text: [
                'A booth with a painted sign — MADAME FATE, TEN FUTURES FOR A COPPER — and inside, a mechanical fortune-teller whose face is a porcelain Queen of Hearts.',
                'She deals three cards face-down on the velvet. "Pick one," she says, in a voice like a music box winding down. "Or pick none. That is also a future."',
            ],
            choices: [
                { label: 'The first card', desc: 'The Tower. Lose 12 HP. Gain a rare relic.', effects: [{ hp: -12 }, { relic: 'rare' }] },
                { label: 'The second card', desc: 'The Fool. Gain a Joker and the Arcana Gamble, upgraded.', effects: [{ card: { joker: true } }, { card: { arcana: 'gamble', up: true } }, { flag: 'fool' }] },
                { label: 'Pick none', desc: 'The Queen smiles. Remove a card and heal to full.', effects: [{ remove: 1 }, { healPct: 1 }] },
            ],
        },
        bossIntro: [
            'In the big top, under a single spotlight, the Harlequin juggles ten crowns — no, nine — and catches them all on one finger.',
            '"You\'re the eighth to get this far!" he cries. "The seventh was the best. Lovely hands. Clever. Brave. Do you know what became of him? He\'s sitting on a throne of ash, holding a card he can\'t bring himself to play!"',
            '"The Hollow King was a Cardbound," you say.',
            '"The Hollow King was YOU, darling, with a different face. Now: shall we play?"',
        ],
        bossDefeat: [
            'The Harlequin takes his bow even as he fades, grinning to the last. "Oh, well played. Well played! Here — you\'ve earned it."',
            'He tosses you not a crown but a card: a Joker, painted with his own face. "Every deck needs one card that isn\'t in the rules. When you reach the table, remember: you don\'t have to play the game you\'re dealt."',
        ],
        epilogue: [
            'The calliope stops. The lanterns go out one by one. The carnival closes for the first time in a thousand years.',
            '"Eight," says the Ferryman quietly. "Now you know."',
            '"You knew all along."',
            '"I rowed him, too," he says. "I row everyone."',
        ],
    },
    // 9 — The Starless Sea
    {
        numeral: 'IX', title: 'Where the Cards Go',
        prologue: [
            'The river ends. It pours over the edge of the world into a sea with no bottom and no stars, and the Ferryman steers straight over the falls.',
            'You drift on black water under a sky of nothing. Around you, floating, are cards — millions of them, faded, bent, burned at the edges. Every card ever discarded. Some of them have whole worlds painted on their faces.',
            '"The discard pile," the Ferryman says. "Of every game the gods ever played. Every world that was dealt, and folded, and thrown away."',
            '"Something lives down here. It eats what is thrown away. It has been eating for a very long time."',
        ],
        interlude: {
            title: 'The Drowned Deck',
            text: [
                'A card floats past with your face on it. Then another. Then a hundred, all you, all dealt in some other game, some other world, some other try.',
                'One of them is still warm. On it, a version of you sits on a throne, holding a single red card to their chest.',
            ],
            choices: [
                { label: 'Take the warm card', desc: 'An Ace of Hearts, enchanted Echo. It burns in your hand.', effects: [{ card: { rank: 14, suit: 'H', ench: 'echo' } }, { hp: -10 }, { flag: 'warmCard' }] },
                { label: 'Let them all sink', desc: 'Remove 2 cards from your deck. Gain 15 max HP.', effects: [{ remove: 2 }, { maxHp: 15 }] },
                { label: 'Search the drift', desc: 'Gain 3 random cards, one of them rare. Gain 1 Ash.', effects: [{ card: 'random' }, { card: 'random' }, { card: 'rare' }, { ash: 1 }] },
            ],
        },
        bossIntro: [
            'The sea opens. Beneath it there is no floor, only a mouth — a mouth as wide as the sky, ringed with teeth made of broken crowns.',
            '"EVERYTHING ENDS HERE," says the Leviathan, and its voice is the sound of cards being torn. "EVERY GAME. EVERY WORLD. EVERY PLAYER. WHY SHOULD YOURS BE DIFFERENT?"',
            '"Because I haven\'t finished it yet," you say.',
        ],
        bossDefeat: [
            'The Leviathan sinks back into nothing, and as it goes, the drift of discarded cards begins to glow — faintly, then brightly, a sea full of little lights.',
            '"Not ended," it murmurs, almost puzzled. "Only... put down. For a while." It leaves behind a crown made of every colour a world can be.',
        ],
        epilogue: [
            'The Ferryman rows you towards the only light left: a castle of grey stone on an island of ash, where a single window burns.',
            '"Nine," he says. "One more." He will not look at you. "Whatever you decide up there, I will row you home after. That is a promise."',
        ],
    },
    // 10 — The Hollow Throne
    {
        numeral: 'X', title: 'The Last Hand',
        prologue: [
            'The Hollow Throne rises out of the ash like a hand of cards held close. Its towers are shaped like swords and staves; its gates are hammered from coins; its great window is a single burning heart.',
            'Ash falls here like snow. It has been falling since before you were born. It is falling from the King.',
            '"He was brave," the Ferryman says, as the boat touches the shore. "He was clever. He won every Crown, just as you have. And then he sat down at the table, and saw the empty chair, and could not bring himself to finish."',
            '"Whoever finishes the Last Hand takes the Dealer\'s seat, and deals the next world. He could not bear it. So he held the Ace, and the world burned, and he told himself that was kinder."',
            '"Go up. I will wait."',
        ],
        interlude: {
            title: 'The Gallery of Cardbound',
            text: [
                'A long gallery lined with portraits. Each one is a Cardbound who reached this castle. Each one holds a hand of cards. Each one has your eyes.',
                'At the end of the gallery, an empty frame, and beneath it a small brass plate with your name already engraved.',
            ],
            choices: [
                { label: 'Take down the frame', desc: 'Nobody will hang you here. Gain 25 max HP.', effects: [{ maxHp: 25 }, { healPct: 1 }] },
                { label: 'Read their hands', desc: 'Learn from every one of them. Upgrade 4 cards of your choice.', effects: [{ upgrade: 4 }] },
                { label: 'Take their luck', desc: 'Gain a rare relic and 2 elixirs.', effects: [{ relic: 'rare' }, { elixir: 'random' }, { elixir: 'random' }] },
            ],
        },
        bossIntro: [
            'The throne room is empty but for a table of black stone, two chairs, and a king.',
            'He is thin as ash, crowned in iron, and his chest is hollow — a cage of ribs with nothing inside but a single card, face-down, glowing red.',
            '"You came," he says. He sounds relieved. He sounds like the Baron did, at the end. "I hoped someone would. I hoped no one would. Sit."',
            '"I will not give you the Ace," he says. "Not because I want it. Because if you take it, you must finish the hand, and then you must sit in that chair forever and deal. I am saving you. Do you understand? I am SAVING you."',
            '"Deal," you say.',
        ],
        bossDefeat: [
            'The Hollow King falls to his knees. The card slides out from between his ribs and lands face-up on the black table: the Ace of Hearts, beating like a heart.',
            '"Then it is yours," he whispers. "All of it. I am sorry. I was so afraid." He smiles, and crumbles into ash, and the ash — for the first time in a hundred years — stops falling.',
            'You are alone at the table with the Last Hand, the Ace of Hearts, and an empty chair.',
        ],
        epilogue: [],
    },
];

export const ENDINGS = {
    seat: {
        label: 'Take the Seat',
        desc: 'Sit in the Dealer\'s chair. Finish the hand. Deal the next world.',
        title: 'The New Dealer',
        text: [
            'You sit. The chair is warm, as if someone left it a moment ago.',
            'You lay the Ace of Hearts on the table and the Last Hand is finished — a Royal Flush of Hearts, the only hand the Dealer ever wanted. Across the ten realms, the fires go out. The rain comes. The sleepers wake. The frozen hearths catch.',
            'Then you gather the cards, and shuffle, and — because it is what the Dealer does — you begin to deal a new world. Slowly. Carefully. One card at a time. You intend to make it a kind one.',
            'Far below, on a grey river, the Ferryman takes off his hat and bows.',
            '"Well dealt," he says.',
        ],
    },
    return: {
        label: 'Return the Ace',
        desc: 'Give the heart back to the world. Walk away from the table.',
        title: 'The Heart Returned',
        text: [
            'You do not sit. You carry the Ace of Hearts to the great window and hold it up to the light, and then you let it go.',
            'It falls like a red star through the ash-clouds, down past the Starless Sea and the Carnival, past the Aerie and the Deep, the Peaks and the Dunes, the Hedge and the Cathedral, until it lands in a field of burning wheat in Emberfall and sinks into the earth.',
            'The next morning, the wheat is green.',
            'The game of the gods is never finished. There will be no new Dealer, and no new world. There is only this one, broken and healing and yours.',
            'The Ferryman rows you home. When you reach the shore he steps out of the boat, stretches, and says, "I think I shall stop rowing now." And he does.',
        ],
    },
    fold: {
        label: 'Fold',
        desc: 'Play the Harlequin\'s Joker. The card that is not in the rules.',
        title: 'The Fool\'s Gambit',
        requires: 'crownJoker',
        text: [
            'You take out the Harlequin\'s Joker and lay it on the black table, face-up, beside the Ace.',
            'For a moment nothing happens. Then, very faintly, from somewhere far away, you hear someone laughing — delighted, astonished, the laugh of a jester who has waited ten thousand years to see someone do exactly this.',
            'You fold. Not the hand: the table. You fold the gods\' game in half, and in half again, and in half again, until it is small enough to put in your pocket.',
            'There are no more Crowns. No more Wardens. No more Dealer. The worlds will have to deal themselves from now on, one ordinary day at a time.',
            'The Ferryman stares at you for a long moment. Then he begins to laugh too. "Nobody," he says, wiping his eyes, "nobody ever thought of that."',
        ],
    },
};

export const DEATH_LINES = [
    'The Ferryman fishes you out of the river of ash. "Not yet," he says. "Again."',
    '"The cards remember you," says the Ferryman, wringing ash from your cloak. "Deal again."',
    'You wake in the boat. The Ferryman does not look surprised. "Everyone falls once," he says. "The last one fell a great many times."',
    '"You were close," the Ferryman lies kindly. "Rest. Then we row back."',
];

export const CHECKPOINT_LINE = 'An ember catches in your deck. If you fall in this realm, you can rekindle here.';
