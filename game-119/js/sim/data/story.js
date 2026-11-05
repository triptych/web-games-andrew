// The story: Kaelen Dawnward, the Hero, and the merchant who outfits the end of the world.
// Chapters are story quests (see quests.js); this file holds the words and the final rating.

export const HERO = { name: 'Kaelen Dawnward', title: 'the Dawn Hero' };

export const INTRO = [
    { who: 'narrator', text: 'Gran Mirabel kept a ledger for sixty years. Every coin, every bargain, every promise. When she died, the ledger and her battered handcart were all she left you.' },
    { who: 'narrator', text: 'Hearthmere is small. The realm is not. Beyond the hills are forges, groves and bazaars, and a Dusk Wyrm stirring beneath the northern mountains.' },
    { who: 'narrator', text: 'Somewhere out there walks the Hero who will face it. Heroes need swords, and potions, and boots, and bread. Someone has to sell them. Perhaps that someone is you.' },
];

// Dialogue for story quests: intro (on accept), done (on turn-in). Keyed by quest id.
export const STORY_TEXT = {
    s0: {
        intro: [
            { who: 'Gran Mirabel', text: "(from the first page of the ledger) \"Rule one, my darling: buy where it's cheap, sell where it's dear, and never carry what you cannot sell.\"" },
            { who: 'Pim', text: "Oh, you're Mirabel's grandchild! She always said the cart would find its way to you. Here: I need grain in Willowbrook, they're short. Six sacks. Mind the weight, that cart's no donkey." },
        ],
        done: [{ who: 'Pim', text: 'Six sacks, on the dot. Your gran would be proud. There is a lot of road out there, and every coin on it is waiting for someone clever.' }],
    },
    s1: {
        intro: [
            { who: 'Kaelen Dawnward', text: "Forgive me, merchant. Goblins at the ford; my sword broke on the third one. I'm told Hearthmere has a forge that is still lit." },
            { who: 'Kaelen Dawnward', text: "I'm Kaelen. I travel north to a fight I may not walk away from, and I would rather not walk it with a stick. A sword, if you can find one. Any honest blade." },
        ],
        done: [
            { who: 'Kaelen Dawnward', text: 'Balanced. Honest. Better than I hoped for in a farming village. What is your name? ... Remember it, I will ask for it again.' },
            { who: 'Kaelen Dawnward', text: "When you can, come find me. I make camp at Stonebridge. A hero's road is long, and I've never had anyone to supply it." },
        ],
    },
    s2: {
        intro: [
            { who: 'Kaelen Dawnward', text: "You came! Good. The Greenmarch was only the beginning. My company needs healing draughts and trail rations for the Heartland roads, and I'd rather buy from someone I trust." },
            { who: 'Dame Vesper', text: 'The Hero buys from a travelling cart? Remarkable. Very well, merchant: if Kaelen trusts you, so does the Stonebridge guild. Consider your rank raised.' },
        ],
        done: [{ who: 'Kaelen Dawnward', text: 'Exactly what we needed. The guild is whispering your name. Armor next, I think. They say the dwarves of Emberforge forge the finest in the realm.' }],
    },
    s3: {
        intro: [
            { who: 'Thorgrim Ironbeard', text: "Kaelen's merchant, eh? Hah! Hero's been banging on about ye for weeks. He needs a proper cuirass and a helm, and I've no time to forge for every wandering swordsman." },
            { who: 'Thorgrim Ironbeard', text: "Bring me the steel and the leather and I'll lend ye my forge. Do it right and the Hero marches out of here dressed like a legend." },
        ],
        done: [{ who: 'Kaelen Dawnward', text: "Thorgrim cried. I'm not supposed to tell you that. Thank you. Mistwood next; the elves know something about the Dusk that they will only tell to someone who brings gifts." }],
    },
    s4: {
        intro: [
            { who: 'Elowen', text: 'The mist told us you would come. Kaelen needs a draught for the dark ahead, and an amulet to hold light. Moonlit things, merchant. Not mined, not forged: grown.' },
            { who: 'Elowen', text: 'The Dusk Wyrm sleeps beneath Frostpeak. It wakes when the sun is eaten, the Eclipse. I do not know the day. But the stars do, and they say it is within the year.' },
        ],
        done: [{ who: 'Elowen', text: 'It is true, then: the Hero has a merchant, and the merchant has become a part of the prophecy. Go north to Frostpeak; the cold is coming.' }],
    },
    s5: {
        intro: [
            { who: 'Jarl Hrolf', text: "Kaelen winters here before the pass opens. I'll feed him, but I won't clothe him. Hide boots for the ice, a shield that has met a wolf, and a camp kit that does not leak." },
            { who: 'Sigrid', text: "You came through the pass in this weather? Ha. Then you might do. The Jarl is not easily impressed; I've seen him smile twice." },
        ],
        done: [{ who: 'Jarl Hrolf', text: 'Good steel, honest stitching. Kaelen can face the winter with this. Go to Dragonwatch: Rhea has been waiting for someone who can read a ledger and a dragon.' }],
    },
    s6: {
        intro: [
            { who: 'Captain Rhea', text: 'Three dragons have slept under these ruins, and one has not. I want great healing draughts for the wounded and a blade that can bite scale, for Kaelen. This is not a request.' },
            { who: 'Captain Rhea', text: 'You should know what is coming. When the Eclipse arrives the Wyrm wakes and Kaelen goes to meet it. After that there is only one chance to equip him: Aurelion, the Hero\'s Camp.' },
        ],
        done: [{ who: 'Captain Rhea', text: "Good. Kaelen's ready for the worst of the road. Get yourself to Aurelion, merchant. The Hero will ask you for something he has never asked anyone." }],
    },
    s7: {
        intro: [
            { who: 'Kaelen Dawnward', text: "Merchant. Look at us, a year ago I was a swordsman with a broken blade and you were a girl or boy with a cart. Now there's a Wyrm, a prophecy, and a whole kingdom looking at us." },
            { who: 'Kaelen Dawnward', text: "I won't ask for charity. I'll ask for your best. The Ultimate Kit: a weapon, armor, helm, shield, boots, an amulet, a healing draught, an elixir, provisions and a camp kit. The finest you can make or find." },
            { who: 'Kaelen Dawnward', text: 'Offer me what you have. The Eclipse is coming: Day 360. After that, the Dawn Camp breaks, and whatever you have not put into my hands, I will not carry into the dark.' },
        ],
        done: [{ who: 'Kaelen Dawnward', text: 'Whenever you are ready, the Dawn Camp is yours. Make your Offer: one gift per slot, the best you can bring. It is final.' }],
    },
};

// The offer is rated on the levels of the ten items (each 1-10). 100 is the perfect, Ultimate kit.
export const RANKS = [
    { min: 96, id: 'S', title: "Legend: The Hero's Merchant", text: 'Ten masterpieces, all at the height of the craft. The Hero rides out in armor that will be sung about for a thousand years.' },
    { min: 80, id: 'A', title: "The Hero's Merchant", text: 'A near-perfect kit. Kaelen carries your name into the dark, and the realm will remember who equipped its saviour.' },
    { min: 60, id: 'B', title: 'Master Merchant', text: 'A fine kit, and a fine merchant. Kaelen goes forth well equipped. Whether it is enough, only the Wyrm can say.' },
    { min: 35, id: 'C', title: 'Journeyman Merchant', text: 'Serviceable. The Hero thanks you, and goes into the dark carrying more courage than steel.' },
    { min: 0, id: 'D', title: 'Peddler', text: 'Kaelen takes what he is given with grace. The kit is thin. He will need a great deal of luck.' },
];
export const rankFor = (score) => RANKS.find((r) => score >= r.min);

export const EPILOGUE = {
    S: 'The Dusk Wyrm fell at dawn on the plains of Aurelion. In every tavern of the realm they tell of the merchant whose ten perfect gifts turned the war. Gran Mirabel\'s ledger sits in a glass case in the royal library, open to your first, tiny entry: six sacks of grain.',
    A: 'The Wyrm fell, though the battle was long. Kaelen came home with a scar, a crown he did not want, and a standing order for everything you could make. The realm bought from no one else for a hundred years.',
    B: 'It was a close and terrible fight. The Wyrm fell, barely, and Kaelen limped home to a merchant he never forgot. The Guild rewrote its charter in your honour.',
    C: 'The Hero fell back, and the Wyrm was driven off rather than slain. The realm is safe for now. Merchants who knew your name say you could have done more, and you know it.',
    D: 'The Eclipse passed over a thinly armed Hero. Whether the dawn that followed was won or only delayed, the songs do not say. You go back to the road, knowing what a ledger is for.',
};
export const NO_OFFER_TEXT = 'The Eclipse came and the Dawn Camp broke, and you were not there. Kaelen marched into the dark with what he had. The songs do not mention a merchant.';
