// ============================================================
// Villager dialogue templates by personality and topic.
// Vars: {player} {name} {job} {glen} {mayor} {season} {weather}
// {other} (another villager) {town} {item} {they} {their} {them}
// ============================================================

export const GREET = {
    cheerful: ["Morning, {player}! Isn't it a lovely day to be alive?", "Oh, hi hi hi! I was hoping you'd come by!", "There's my favourite neighbour!"],
    shy: ["Oh… h-hello, {player}.", "Um. Hi. Nice weather, I think.", "…Oh! Sorry, I didn't see you there."],
    grumpy: ["Hmph. {player}.", "What is it now?", "If you're here to chat, make it quick. Well. Not TOO quick."],
    dreamy: ["Did you know clouds are just very tired rain? Hello, by the way.", "Oh, {player}. I was just thinking about you. Or about moths. One of those.", "The wind's humming today. Can you hear it?"],
    bookish: ["Ah, {player}. I was just reading about the old Glen.", "Hello! Did you know the Heartwood is mentioned in four separate almanacs?", "Good day. Mind the stack of books."],
    bold: ["{player}! Good to see you on your feet.", "Ha! There's the adventurer!", "Anything out there need punching? Kidding. Mostly."],
};

export const TOPICS = {
    season: [
        ["Spring in {glen} smells like wet earth and new things.", "I love the {season} light here.", "The {season} air makes me want to start something new."],
        ["Summer's here! Don't forget to water your crops, {player}.", "It's warm enough to nap in the shade of the Heartwood.", "Everything grows so fast in summer."],
        ["The leaves are turning. {glen} looks like it's on fire, in a nice way.", "Fall is for soup. I will not be taking questions.", "Pumpkin season!"],
        ["Winter's quiet. Good for thinking.", "Brr. Stay warm out there, {player}.", "The snow makes the whole Glen hush."],
    ],
    weather: {
        rain: ["Rain again! The crops won't mind.", "I love the sound of rain on the roof."],
        storm: ["Stay close to home tonight. Storms bring out the wild things.", "That thunder rattled my teacups."],
        snow: ["Snow! Everything looks brand new.", "Careful, the paths are slippery."],
        sun: ["Not a cloud in the sky.", "Good drying weather."],
    },
    job: {
        carpenter: ["Every board in {glen} has a story. I'm writing the next chapter.", "Measure twice, cut once. Or three times, if you're me.", "If you want something built, you know where I am."],
        farmer: ["The soil here is rich. The old farmers knew what they were doing.", "I watered some of your crops this morning — hope that's alright!", "A turnip is a promise the ground keeps."],
        blacksmith: ["Bring me bars and I'll make your tools sing.", "The forge is warm if you need warming.", "A good edge is patience and heat."],
        rancher: ["Your animals are happy, {player}. I can always tell.", "Hay's in the silo. Don't worry about feeding — I've got it.", "A pet a day keeps the grumpy cow away."],
        cook: ["Try the soup of the day! It's the same as yesterday but I believe in it more.", "Food tastes better when you share it.", "If you find any new recipes, show me!"],
        herbalist: ["Mint for the stomach, clover for luck, and rest for everything else.", "Faint out there and I'll patch you up. But please don't.", "The marsh herbs are especially good this time of year."],
        merchant: ["Business is booming! Well. Business is… present.", "Ship something fine and I'll see you get a fair price.", "Folk from {town} have started asking about {glen}."],
        tailor: ["That outfit suits you. I'd change the hem, but it suits you.", "Wool from our own sheep would make a lovely coat…", "Every thread counts."],
        miner: ["Deeper you go, the better the ore. Also the worse the monsters.", "Brought up a nice lump of ore this morning.", "Nothing like the quiet of a cave."],
        guard: ["The roads are safer with me around. You're welcome.", "If you head out, I'll come along. Just ask.", "Keep your guard up — literally. It halves the hurt."],
        scholar: ["The old texts mention faded things all over the land. I'm mapping them.", "Knowledge is a lantern. Also, lanterns are lanterns.", "Every seal you break teaches me something."],
        bard: ["I wrote a song about you. It's mostly about your hat.", "Come by the tavern tonight! First song's free. So are the rest.", "{glen} deserves a ballad."],
    },
    village: [
        "I heard {other} talking about you. Nice things!", "Have you met {other}? Lovely person.", "{mayor} looks ten years younger since you came.",
        "The Heartwood looks a little greener every day.", "I think {glen} is going to be something special.", "Glim waved at me today. At least I think it was waving.",
    ],
    hearts: {
        low: ["Thanks for stopping by.", "See you around, {player}."],
        mid: ["You're one of the good ones, {player}.", "I'm glad I came to {glen}. I'm glad you're here."],
        high: ["Honestly? You're my best friend here.", "When I left {town}, I never thought I'd find a home again. Then I found {glen}. And you."],
    },
};

export const GIFT_REACT = {
    love: ["Oh!! I LOVE this! How did you know?", "This is perfect. Thank you, {player}.", "You remembered! I could hug you."],
    like: ["Oh, thank you! That's lovely.", "What a nice thought.", "I'll put this to good use."],
    neutral: ["Oh, thanks.", "That's… kind of you.", "I'll find a place for it."],
    hate: ["Oh. Um. Thank you… I guess.", "Why would you give me this?", "…I'll pretend I didn't see it."],
    birthday: ["It's my birthday! You remembered?!"],
};

export const APPLICANT_LINES = [
    "Hello! I saw your board from the road. I'm {name}, a {job}. I've been looking for somewhere to settle.",
    "If {glen} could use a {job}, I'd love to stay. I'd need a {building} to live and work in.",
    "Clear a lot and use its sign to build one, and I'll move in the very next morning!",
];

export const MOVE_IN = ["I'm home! Thank you so much, {player}. I'll start work right away.", "I love it. It's perfect. It even smells new!"];
