/**
 * names.js — who people are, what the aid stations say to them, and the letters they write home.
 * Letters are built from the care each person actually got on the road, so a letter about a
 * splint is from someone who really was splinted.
 */

export const FIRST = [
    'Ada', 'Amir', 'Bea', 'Bram', 'Cora', 'Dev', 'Elsie', 'Emeka', 'Farah', 'Finn', 'Greta', 'Hana', 'Hugo', 'Ines', 'Ivo',
    'Jun', 'Kasia', 'Kofi', 'Lena', 'Luis', 'Mara', 'Mateo', 'Nell', 'Noor', 'Olu', 'Oskar', 'Priya', 'Quinn', 'Rosa', 'Ravi',
    'Sana', 'Sol', 'Tilde', 'Tomas', 'Uma', 'Vik', 'Wren', 'Yara', 'Yusuf', 'Zoe', 'Aiko', 'Bo', 'Chiara', 'Dara', 'Esme',
    'Femi', 'Gus', 'Ilse', 'Joss', 'Kit', 'Lior', 'Mina', 'Nico', 'Odette', 'Pia', 'Rafa', 'Signe', 'Teo', 'Vera', 'Wim',
];
export const LAST = [
    'Abara', 'Bell', 'Castillo', 'Dunmore', 'Eklund', 'Fairweather', 'Greaves', 'Hart', 'Ibarra', 'Jansen', 'Kaur', 'Lindqvist',
    'Mbeki', 'Novak', 'Okafor', 'Pell', 'Quill', 'Rowan', 'Sato', 'Thorne', 'Underhill', 'Varga', 'Webb', 'Yilmaz', 'Zhou',
    'Ashby', 'Brook', 'Cole', 'Darrow', 'Ember', 'Frost', 'Gale', 'Holt', 'Ivers', 'Kerr', 'Lark', 'Moss', 'Nash', 'Orr', 'Penn',
];
const KID = ['Pip', 'Tam', 'Lulu', 'Moe', 'Bix', 'Dot', 'Kiki', 'Rue', 'Ozzie', 'Fen', 'Juno', 'Milo', 'Nia', 'Sunny', 'Tiko', 'Wren'];

export function personName(rng, kind) {
    if (kind === 'child') return { first: rng.pick(KID), last: rng.pick(LAST), age: rng.int(5, 11) };
    return { first: rng.pick(FIRST), last: rng.pick(LAST), age: kind === 'elder' ? rng.int(68, 91) : rng.int(19, 62) };
}

// What the aid stations say as they work. One is shown now and then over the person treated.
export const SAY = {
    medic: ['We\'ve got you.', 'Hold still, nearly done.', 'There. Keep walking.', 'You\'re going to be fine.', 'Pressure, and breathe.'],
    remedy: ['Drink this. It helps.', 'The fever\'s breaking.', 'You\'re clear. Go!', 'Deep breath. That\'s it.'],
    kitchen: ['Hot soup! Eat while you walk.', 'Have some bread for the road.', 'Here, warm your hands on this.', 'Eat. You\'ll need it.'],
    fire: ['Come by the fire a moment.', 'Take a blanket!', 'Feel your fingers again?', 'Warm up, then onward.'],
    stretcher: ['Up you come.', 'We\'ll carry you.', 'Not today. Up!', 'Lean on me.'],
    splint: ['Lean on this.', 'Splinted. Easy steps.', 'Bone\'s set. Off you go!', 'One foot, then the other.'],
    song: ['You\'re not alone.', 'Sing with us!', 'Listen. You\'re safe here.', 'Breathe with the music.'],
    lantern: ['Follow the light.', 'Stay in the light!'],
    saved: ['Made it!', 'Safe!', 'Welcome home.', 'You\'re safe now.', 'Someone get them a blanket!', 'Welcome to the Haven.'],
    revive: ['Still with us!', 'Come on, up!', 'Not alone. Never alone.'],
    cured: ['...where am I?', 'I can see again.', 'It\'s over. I\'m me.', 'Thank you. Thank you.', 'Is it morning?'],
    vol: ['For the Haven!', 'Hold the line!', 'Bring them back!', 'We were helped. Now we help.', 'Together!'],
};

const OPEN = ['Dear Haven,', 'To whoever was at the tents,', 'Dear friends on the road,', 'To the people with the lanterns,', 'Dear Haven folk,'];
const BY_CARE = {
    medic: [
        'I was bleeding and I honestly thought that was the end of it. Then someone knelt in the road and bandaged me like there was all the time in the world.',
        'You stitched me up with dead coming down the lane and your hands never shook. I don\'t know how.',
        'The bandage you tied is still on my arm. I keep it there to remember someone stopped for me.',
    ],
    remedy: [
        'The fever had me. I could hear it in my own head. One bitter little bottle later, I could hear birds again.',
        'You gave me the cure without asking who I was. I want to do that for someone one day.',
        'I was sure the blight was going to take me. It didn\'t. Your medicine is the reason.',
    ],
    kitchen: [
        'I hadn\'t eaten in four days. That soup was the best thing I have ever tasted, and I\'m including my mother\'s cooking.',
        'You handed me bread on the run and said "you\'ll need it." I did. Thank you.',
        'Hot soup in a cold world. That\'s all. That was everything.',
    ],
    fire: [
        'I couldn\'t feel my feet. You sat me by your fire for one minute and put a blanket on my shoulders, and I could walk again.',
        'The blanket smelled of woodsmoke. I\'ve kept it.',
    ],
    splint: [
        'My leg was broken and I knew I\'d be left behind. Someone stopped. Someone splinted it. I walked the rest of the way.',
        'I was so slow. They kept getting closer. Then you set my leg and I ran. I didn\'t know I still could.',
    ],
    song: [
        'I was too frightened to move. Then I heard your fiddle, and somebody singing badly but loudly, and my feet started on their own.',
        'Your song is stuck in my head. I don\'t mind at all.',
    ],
    stretcher: [
        'I fell down. I\'m told I wasn\'t breathing well. I\'m told two of you carried me. I don\'t remember, but I\'m alive to say thank you.',
        'You came out into the road for me when I couldn\'t get up. Into the road!',
    ],
    lantern: [
        'I followed your lights all the way. Every time I thought I was lost there was another one.',
    ],
    none: [
        'I came through the valley on my own two feet, but every station I passed waved and cheered. It helped more than you know.',
        'It was a long road. Thank you for being at the end of it.',
    ],
};
const CLOSE_TRADE = {
    firefighter: 'When you need a hose and a steady pair of hands, call me.',
    nurse: 'I was a nurse before all this. I\'ll be one again here. Put me to work.',
    gardener: 'I\'ve started a garden behind the tents. There\'ll be greens by spring.',
    athlete: 'I can still run. If there\'s anything that needs fetching, I\'m your runner.',
    musician: 'I play a little. I think we could all use some music tonight.',
    mechanic: 'Your generator is making a noise. I\'ll have it sorted by morning.',
    storyteller: 'Come and sit by the fire tonight. I\'ll tell the young ones a story with a happy ending.',
};
const KID_LINES = [
    'I drew you a picture of the tent with the red cross. The sun is smiling because it is happy we got here.',
    'Thank you for the soup. I had two bowls. Mum said that\'s allowed today.',
    'I was scared but the music man played a song and I wasn\'t scared as much.',
    'This is a picture of you. You have a cape because you are a hero.',
    'I am going to be a doctor when I grow up. Like you.',
    'We made it!!! I am drawing all the stars because it is night and we are safe.',
];
const SIGN = ['With love,', 'Gratefully,', 'Yours, always,', 'With all my heart,', 'Thank you,', 'Still here because of you,'];

/** A letter from someone saved. `p` is { name, kind, trade, care, thriving }. */
export function letterFor(rng, p) {
    const n = p.name;
    if (p.kind === 'child') {
        return { from: `${n.first}, age ${n.age}`, kind: 'child', body: [rng.pick(KID_LINES)], sign: 'Love from' };
    }
    const cares = Object.entries(p.care || {}).filter(([k, v]) => v > 0 && BY_CARE[k]).sort((a, b) => b[1] - a[1]);
    const lines = [];
    const first = cares.length ? cares[0][0] : 'none';
    lines.push(rng.pick(BY_CARE[first]));
    if (cares.length > 1 && rng.chance(0.6)) lines.push(rng.pick(BY_CARE[cares[1][0]]));
    if (p.trade && CLOSE_TRADE[p.trade] && p.thriving) lines.push(CLOSE_TRADE[p.trade]);
    else if (!p.thriving) lines.push('I\'m resting now. I\'ll be on my feet soon, and I\'ll pay it forward.');
    return { from: `${n.first} ${n.last}`, trade: p.trade, kind: p.kind, open: rng.pick(OPEN), body: lines, sign: rng.pick(SIGN) };
}

/** Pick up to n letters for the results screen, preferring people who got the most care. */
export function lettersFor(rng, savedList, n = 3) {
    const pool = savedList.slice().sort((a, b) => careTotal(b) - careTotal(a));
    const out = [];
    const kid = pool.find((p) => p.kind === 'child');
    for (const p of pool) {
        if (out.length >= n - (kid ? 1 : 0)) break;
        if (p === kid) continue;
        out.push(letterFor(rng, p));
    }
    if (kid) out.push(letterFor(rng, kid));
    return out;
}
const careTotal = (p) => Object.values(p.care || {}).reduce((s, v) => s + v, 0);

export const REMEMBER = ['Their lantern rose over the valley.', 'We will carry their name to the Haven.', 'A light in the sky tonight.'];
