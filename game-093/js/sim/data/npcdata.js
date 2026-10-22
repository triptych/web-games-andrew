// Villager flavour: names, looks, personalities, town talk, and the templates for the storylines NPCs carry.

export const FIRST = ['Anselm', 'Brynn', 'Cora', 'Dacey', 'Edric', 'Fenna', 'Gilda', 'Hob', 'Ilsa', 'Joren', 'Kestrel', 'Lenna', 'Marek', 'Nessa', 'Orrin', 'Perrin', 'Quill', 'Rosalind', 'Silas', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Xander', 'Yara', 'Zeb',
    'Alder', 'Bessa', 'Corwin', 'Delphine', 'Emmet', 'Faye', 'Garrow', 'Hester', 'Isolde', 'Jory', 'Kit', 'Lorcan', 'Maren', 'Nolan', 'Odette', 'Pip', 'Rhosyn', 'Soren', 'Tilda', 'Umber', 'Vance', 'Willa', 'Yves', 'Zinnia'];
export const LAST = ['Applewood', 'Brightwater', 'Coldforge', 'Dunmore', 'Everhart', 'Fairweather', 'Greywick', 'Hallow', 'Ironbrook', 'Juniper', 'Kettle', 'Lanternly', 'Marlowe', 'Nettlefield', 'Oakhand', 'Pennywhistle', 'Quickwater', 'Redfern', 'Saltmarsh', 'Thistle', 'Underhill', 'Vale', 'Wickham', 'Yarrow'];

export const SKINS = ['#f4d0b0', '#e8b890', '#d8a878', '#c89868', '#a87850', '#8a5a3a', '#f8dcc0'];
export const HAIRS = ['#2a2018', '#5a3220', '#8a5a30', '#c8a050', '#e8d890', '#a83a2a', '#c8c8c8', '#3a3a4a', '#6a3a7a'];
export const STYLES = ['short', 'long', 'spiky', 'braid', 'ponytail', 'bald'];
export const CLOTHS = {
    village: [['#6a8a4a', '#e8d8a8'], ['#8a5a3a', '#d8c098'], ['#4a6a9a', '#e8e0d0'], ['#9a4a4a', '#f0e0c0']],
    river: [['#4a6a9a', '#e0e8f0'], ['#6a5a8a', '#f0e0e8'], ['#3a8a8a', '#e8f0e0'], ['#8a6a4a', '#f0e8d0']],
    harbor: [['#2a6a8a', '#f0f0e0'], ['#8a3a3a', '#f0e8d8'], ['#e8c06a', '#4a3a2a'], ['#3a4a6a', '#e8d8c0']],
    oasis: [['#d89a4a', '#f8f0d8'], ['#a8503a', '#f0e0b0'], ['#3a8a6a', '#f8f0d8'], ['#e8e0c0', '#8a5a3a']],
    snow: [['#6a4a3a', '#d8c8b0'], ['#4a5a7a', '#e0e0e8'], ['#8a8a9a', '#c8c0b0'], ['#7a3a3a', '#e0d8d0']],
};
export const PERSONALITIES = ['cheerful', 'gloomy', 'gossip', 'gruff', 'scholar', 'dreamer', 'child', 'elder'];

/** Town talk by personality; {town} and {rumor} are filled in. */
export const TALK = {
    cheerful: ['What a day! Even with the sky the colour of bruised plums, I say today is a good one.', 'Lovely to see travellers! {town} always has room for another pair of boots on the road.', 'I made too many pies. Take... well, I can\'t actually give you one, I\'m a villager. But I\'m thinking about it warmly.', 'Have you tried the inn? The beds are soft and the innkeeper only snores a little.'],
    gloomy: ['The light isn\'t right. It hasn\'t been right since the sky broke.', 'My knees say rain. My knees are never wrong, and it never rains. I don\'t trust either.', 'Nothing good comes of heroes. They break things and leave the bill.', 'Another day, another shadow longer than it should be.'],
    gossip: ['Have you heard? {rumor}', 'I don\'t like to talk about folk — but did you know the baker waters his flour? It\'s true. {rumor}', 'Word is {rumor} I heard it from someone who heard it from someone very reliable.', 'Not that I listen at windows, but {rumor}'],
    gruff: ['Move along, or buy something.', 'The roads are bad and the monsters are worse. Watch your back, traveller.', 'I\'ve seen things. Wolves the size of ponies. Worse, taxes. Mind yourself.', 'Hmph. You look capable enough. Don\'t die in my square.'],
    scholar: ['Fascinating. The aether in {town} has a different grain from the next valley\'s. Don\'t ask me to explain.', 'Did you know the Dawn Crystal was said to be the first thing ever to cast a shadow? Neither did I, I just made that up.', 'Books say the Hollow is not evil, merely absent. Absence is a dreadful housemate.', '{rumor}'],
    dreamer: ['I dream of the sea, though I\'ve never seen it. Isn\'t that odd?', 'I think the stars are lanterns lit by someone far away. I hope they\'re still lit.', 'When I grow up I\'m going to carry a sword and a very big hat.', 'Sometimes I think the wind says my name. Is that silly?'],
    child: ['Are you a hero? You look like a hero! Do you have a sword? Can I touch it?', 'I found a really good stick. It\'s a sword now.', 'Mama says I can\'t go beyond the gate, but monsters aren\'t REALLY that scary, right?', 'Tag! You\'re it! ...You have to chase me. That\'s the rules.'],
    elder: ['In my day the sun rose on time and the soup was hot.', 'I remember when this was all fields. And then it was fields with a road. And then... more road.', 'The Order used to light a thousand lanterns on the festival night. Now we light as many as we can afford.', 'You carry yourself like someone I used to know. He was stubborn, too.'],
};
export const THEME_TALK = {
    village: ['Emberfield forges the best horseshoes this side of Silverbrook. Ask any horse.', 'The forge never goes cold in Emberfield. We\'re proud of that, and slightly warm.'],
    river: ['Silverbrook\'s river has never frozen. Not once. The old folk say it\'s the Order\'s blessing.', 'Market day is the best day in Silverbrook. Unless it\'s a dull market day. Then it\'s the second best.'],
    harbor: ['Port Azura\'s lamps are sea-glass, lit by the tide itself. Doesn\'t work when the sea\'s unhappy.', 'Watch your purse down at the docks. I\'m not saying anything. I\'m saying watch your purse.'],
    oasis: ['The spring beneath Dunehaven has never run dry. That\'s why we call it the Oasis of Last Resort.', 'The library holds ten thousand scrolls and exactly one working lamp.'],
    snow: ['Hoarhold keeps the gate against the ice wolves. We keep it with spears, stubbornness and a lot of soup.', 'Winter in Hoarhold has two seasons: Cold and More Cold.'],
};

/** Storylines: three stages, each with a spoken offer, a task and a spoken thank-you. */
export const ARCS = [
    { id: 'fiddle', title: 'The Missing Fiddle', who: 'a street musician', stages: [
        { say: ['{n}: I used to play every evening in the square. But my fiddle — my mother\'s fiddle — was lost in {place}. I can\'t play a note without it.'], task: { type: 'recover', item: 'fiddle' }, done: ['{n}: My fiddle! A bit chewed, but oh... listen, it still sings.'] },
        { say: ['{n}: It needs new strings, and the best are woven from {mat}. Could you bring {need}?'], task: { type: 'fetch' }, done: ['{n}: Perfect. Hear that? It\'s coming back.'] },
        { say: ['{n}: One more favour. My old teacher, {m}, in {town2}, should hear this tune first. Could you take her a letter?'], task: { type: 'courier' }, done: ['{n}: She wept for an hour, I hear. Take this — a thank-you from two old friends and one fiddle.'] },
    ] },
    { id: 'apprentice', title: 'The Apprentice\'s Trial', who: 'a young smith', stages: [
        { say: ['{n}: I\'m supposed to forge my first proper blade, but the monsters keep scaring off the ore carriers. Could you thin out some {mon}?'], task: { type: 'hunt' }, done: ['{n}: Safe roads at last! The ore\'s on its way.'] },
        { say: ['{n}: My master wants {need} for the quench. Don\'t ask what for. He won\'t tell me either.'], task: { type: 'fetch' }, done: ['{n}: Hah! He nodded. He NODDED at me.'] },
        { say: ['{n}: Last thing. A rival smith in {town2}, {m}, scoffed at my work. Take this blade to prove them wrong?'], task: { type: 'courier' }, done: ['{n}: They called it "serviceable". That\'s how smiths say "genius". Take your pay!'] },
    ] },
    { id: 'recipe', title: 'Grandmother\'s Recipe', who: 'an anxious cook', stages: [
        { say: ['{n}: I\'m cooking my grandmother\'s soup for the festival, but the herbs only grow where {mon} roam. Could you fetch {need}?'], task: { type: 'fetch' }, done: ['{n}: Fresh! Smell that. That\'s the smell of childhood.'] },
        { say: ['{n}: Wonderful. But the {mon} keep eating my garden. Could you take care of them?'], task: { type: 'hunt' }, done: ['{n}: My garden is safe. I could kiss you. I won\'t, but I could.'] },
        { say: ['{n}: Please take a bowl to my cousin {m} in {town2}. She\'s been ill and it\'s the only thing that works.'], task: { type: 'courier' }, done: ['{n}: She\'s up and dancing, they say! Here, with my thanks.'] },
    ] },
    { id: 'runaway', title: 'The Runaway', who: 'a worried parent', stages: [
        { say: ['{n}: My boy ran off to {place} to find the "hero\'s treasure". He dropped his tin knight on the road. Please find his toy — he won\'t come home without it.'], task: { type: 'recover', item: 'toyKnight' }, done: ['{n}: His knight! Oh, thank the dawn. He\'s home now — sulking, but safe.'] },
        { say: ['{n}: He wants to be a knight. I told him knights hunt {mon} first. Could you show him how?'], task: { type: 'hunt' }, done: ['{n}: He watched from the wall with his mouth open. He\'s decided to be a baker instead.'] },
        { say: ['{n}: One last thing — a letter to his aunt {m} in {town2}. He\'s written it himself.'], task: { type: 'courier' }, done: ['{n}: She wrote back already. It says "tell the hero thank you". Take this, with love.'] },
    ] },
    { id: 'debt', title: 'A Debt of Honour', who: 'a retired soldier', stages: [
        { say: ['{n}: I owe an old comrade my life. He lived near {place}. I\'d like his old signet back before I die. It\'s somewhere in there.'], task: { type: 'recover', item: 'heirloom' }, done: ['{n}: His ring. Thirty years. Thank you.'] },
        { say: ['{n}: His killers still roam. {mon}, they say. Would you end them?'], task: { type: 'hunt' }, done: ['{n}: He can rest now. And so, perhaps, can I.'] },
        { say: ['{n}: Take the ring to his daughter, {m}, in {town2}. She should have it.'], task: { type: 'courier' }, done: ['{n}: She cried and then she laughed. Take this — he would have wanted it.'] },
    ] },
    { id: 'rival', title: 'The Merchant\'s Rival', who: 'a scheming merchant', stages: [
        { say: ['{n}: My rival undercuts me with cheap {mat}. If I corner the supply — only {need} — I\'ll be rich.'], task: { type: 'fetch' }, done: ['{n}: Marvellous. Heh heh heh. I mean — pleasant. Pleasant business.'] },
        { say: ['{n}: Now the {mon} are raiding my caravans. Dispatch some, and I\'ll make it worth your while.'], task: { type: 'hunt' }, done: ['{n}: A clean road is good business. Here.'] },
        { say: ['{n}: One more. A letter to {m} in {town2}. A... proposal. A fair one. I swear.'], task: { type: 'courier' }, done: ['{n}: She accepted! Partnership! Profit! Take this share, hero.'] },
    ] },
    { id: 'well', title: 'The Haunted Well', who: 'a frightened washerwoman', stages: [
        { say: ['{n}: The old well hums at night. Something down there is wailing. I think it\'s a poor soul, not a monster... could you find what it wants?'], task: { type: 'recover', item: 'heirloom' }, done: ['{n}: The humming stopped the moment you came back. I think she\'s at rest.'] },
        { say: ['{n}: Lights still creep around the lane. Would you chase away the {mon}?'], task: { type: 'hunt' }, done: ['{n}: Quiet nights again. Bless you.'] },
        { say: ['{n}: Her name was {m}, I\'ve learned, and she has family in {town2}. Will you tell them her story?'], task: { type: 'courier' }, done: ['{n}: They\'ll hold a vigil. Thank you for carrying her name. Take this.'] },
    ] },
    { id: 'stars', title: 'The Star-Gazer', who: 'a dreamy astronomer', stages: [
        { say: ['{n}: The stars have moved. The sky is different since the Crystal broke! I need {need} to grind a new lens.'], task: { type: 'fetch' }, done: ['{n}: Oh, look at that — look at THAT. They\'re all still there, just... further.'] },
        { say: ['{n}: The {mon} chewed through my observatory cables. Could you...?'], task: { type: 'hunt' }, done: ['{n}: Peace and starlight. Wonderful.'] },
        { say: ['{n}: My charts must reach {m} in {town2} before the next new moon. Could you deliver them?'], task: { type: 'courier' }, done: ['{n}: A new constellation will carry your name. Don\'t tell anyone it\'s a goat.'] },
    ] },
];
