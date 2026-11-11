// Gemheart Saga — the village ticker: an MMO-style feed along the bottom of Briarwick. Every few seconds a villager
// speaks: a hint about what to do next (clickable: it takes you there), or a bit of village chatter.
// Hints are read from G; it never changes G itself (an action goes through ui.cmd or opens a panel).
//
// v1.2.1: every hint has several phrasings from different villagers, chatter has many more lines (some about your tale,
// your level, the village and the weather of the day), and no line is said again while it could still be on screen.

import { NPC, BUILDINGS, REQUESTS, RES_NAMES } from './sim/data/village.js';
import { HERO } from './sim/data/heroes.js';
import { ITEM } from './sim/data/items.js';
import { REGION } from './sim/data/world.js';
import { ART } from './assets.js';
import { chapter } from './sim/game.js';
import * as V from './sim/village.js';
import * as St from './sim/stats.js';

const EVERY = 7;            // seconds between lines
const KEEP = 3;             // lines shown
const HINT_GAP = 45;        // seconds before the same hint comes round again
const MEMORY = 12;          // recent lines never repeated
const COL = { maren: '#ffcf5a', bess: '#ff9f7a', pell: '#7fd4ff', ilse: '#e9e4ff', garrick: '#ffb067', tobin: '#9be37a' };

const CHATTER = {
    maren: ['The well bucket came up full of moonwater again. I\'m choosing not to worry about it.',
        'Every lantern in Briarwick is a promise. Keep them lit for us.',
        'When I was a girl, the Gemheart sang at harvest. You could hear it in the stones.',
        'The council meets on Thursdays. The council is me and a goat. The goat has opinions.',
        'Briarwick has burned twice and flooded once. We rebuild. That is what we do.',
        'I keep a list of everyone who has helped this village. You are on it. In ink.',
        'Don\'t let Pell sell you a "genuine" dragon scale. It\'s a painted roof tile.',
        'The road east used to be busy with traders. Now only the wind uses it.'],
    bess: ['Stew\'s on! Don\'t ask what\'s in it. It\'s mostly turnip. Mostly.',
        'A traveller swore he saw a boar wearing a crown out on the meadow road. I gave him a second pint.',
        'Somebody\'s been sleeping in the hayloft again. If it\'s you, love, at least fold the blanket.',
        'Tobin ate three bowls and asked for a fourth. That boy is half well.',
        'Garrick sang last night. Nobody\'s talking about it. Nobody.',
        'Fresh bread at dawn, gossip at noon, cider at dusk. That\'s the Goose\'s whole timetable.',
        'You\'re looking peaky, love. Sit by the fire a minute. The world can wait.',
        'Pell owes me nine silver and a cheese. I\'m keeping count.'],
    pell: ['Fresh stock! Well, fresh-ish. Freshly dusted.',
        'A Phoenix Feather: for when the fight goes badly. Which, let\'s be honest, it sometimes does.',
        'Buy two potions, get the third at full price! It\'s a very honest deal.',
        'Fire Bombs: not to be lit indoors. I learned that so you don\'t have to.',
        'Shuffle Scrolls! For when the board looks at you and you look back and nobody blinks.',
        'Everything\'s a bargain if you squint. Squint harder.',
        'A Mana Tonic tastes like blueberries and lightning. Mostly lightning.',
        'Sell me your old swords! I\'ll give you a price so fair it\'s nearly suspicious.'],
    ilse: ['The lantern flickers when the east wind blows. Something out there is hungry for light.',
        'Rest is not weakness, child. Even the sun goes down.',
        'Hearts on the board are the Vale\'s own healing. Do not scorn them.',
        'Every gem holds a little of the Gemheart\'s light. Match them kindly.',
        'I pray for the travellers on the road, and for the ones who never come back to it.',
        'Fear is a candle too. It shows you where the dark is.',
        'The temple bell rang by itself at midnight. I have decided it was the wind.',
        'Light given away is never lost. Remember that out there.'],
    garrick: ['Steel remembers every blow. So should you.',
        'Ore. More ore. That\'s all I\'ve got to say.',
        'A blade\'s only as good as the arm. Get stronger, I\'ll handle the rest.',
        'Hit the line gems. A good blow goes all the way through.',
        'My da forged nails. I forge swords. My lad will forge something better.',
        'Don\'t thank me. Come back with that armour in one piece. That\'s thanks.',
        'Swords up front. Hearts for the hurt. Simple.',
        'Hmph.'],
    tobin: ['The chickens are plotting. I\'ve seen the look.',
        'Grain\'s looking grey at the edges this year. You noticed that too?',
        'Ma says if I keep feeding the slimes, they\'ll follow me home. One already has.',
        'I named the scarecrow Sir Hayward. He\'s doing a grand job. Better than the dog.',
        'Rained on the barley, sunned on the wheat. Can\'t complain! I will, though.',
        'Saw a wisp out past the marsh last night. Waved at it. It waved back. I went home.',
        'Pumpkins this year are the size of Bess\'s stew pot. Nearly.',
        'One day I\'m going adventuring like you! After harvest. And after planting.'],
};

const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** What the player could usefully do now, most pressing first: [{ id, says: [[npc, text], …], go }] (go: an action). */
export function hints(G, ui, now, day) {
    const out = [];
    const add = (id, says, go = null) => out.push({ id, says, go });
    const open = (p) => () => ui.openPanel(p, G);
    const hero = HERO[G.hero.id];
    const first = hero.name.split(' ')[0] === 'Brother' ? 'Brother' : hero.name.split(' ')[0];
    if (G.hero.sp > 0) {
        const n = plural(G.hero.sp, 'skill point');
        add('sp', [['ilse', `You have ${n} waiting. Open Hero & Skills and learn something new.`],
            ['maren', `${first}, you've ${n} to spend. Don't hoard them; they do nothing in your pocket.`],
            ['garrick', `${n} unspent? A tool you don't use is just weight. Go learn something.`],
            ['bess', `Level ${G.hero.lv}, love! That's ${n} to put to use in Hero & Skills.`]], open({ kind: 'hero', tab: 'skills' }));
    }
    const best = V.bestGear(G);
    const better = Object.entries(best).find(([slot, inv]) => inv && G.hero.eq[slot] !== inv.uid);
    if (better) {
        const nm = ITEM[better[1].id].name;
        add('gear', [['garrick', `You've a better ${better[0]} in your bag than the one you're wearing: ${nm}. Gear → Equip best.`],
            ['pell', `That ${nm} you bought is doing nothing in a bag! Put it on: Hero & Skills, Gear.`],
            ['bess', `Why's the ${nm} in your pack and not on you, love? Equip best, it's one button.`]], open({ kind: 'hero', tab: 'gear' }));
    }
    if (V.canDaily(G, day)) {
        const st = G.village.daily.streak;
        add('daily', [['maren', 'Your daily gift is waiting, and it starts a harvest festival. Claim it!'],
            ['tobin', 'Gift day! Claim it and the whole village works double for two hours!'],
            ['bess', st ? `Don't break your ${st}-day streak, love. The daily gift's ready.` : 'The village has a gift for you. Every day, if you keep coming back.']],
        () => ui.cmd({ t: 'daily', day: ui.today(), now: ui.now() }));
    }
    const tick = V.nextTick(G, now);
    const p = V.pending(G, now);
    const whole = Object.entries(p).filter(([, v]) => v >= 1).map(([k, v]) => `${Math.floor(v)} ${RES_NAMES[k].toLowerCase()}`);
    const collect = () => ui.cmd({ t: 'collect', now: ui.now() });
    if (tick?.full) {
        add('full', [['bess', 'The stores are full to the rafters! Collect, or the village stops working.'],
            ['tobin', 'The barns are bursting! Nothing more fits till you collect.'],
            ['maren', 'Our storehouses are full. Every hour you wait is an hour of work wasted.']], collect);
    } else if (whole.length) {
        const list = whole.join(', ');
        add('collect', [['tobin', `The stores have ${list} for you. Hit Collect!`],
            ['maren', `${list} waiting in the storehouse. It's yours, take it.`],
            ['bess', `Your share's piling up: ${list}. Collect before the mice do.`]], collect);
    }
    const done = REQUESTS.find((rq) => !G.claimed[rq.id] && V.requestDone(G, rq));
    if (done) {
        add('req', [[done.npc, `You did it! Come and claim your reward for "${done.title}".`],
            [done.npc, `"${done.title}": done! I owe you. Come and collect.`],
            ['maren', `${NPC[done.npc].name.split(' ')[0]} wants to thank you for "${done.title}". See the requests.`]], open({ kind: 'requests' }));
    }
    const c = chapter(G);
    if (c && G.hero.lv >= c.lv) {
        const R = REGION[c.region].name;
        add('story', [['maren', `"${c.title}" is waiting: chapter ${G.story.ch + 1} of your tale. To adventure!`],
            ['bess', `They're talking about ${R} again. Sounds like your next chapter, love.`],
            ['ilse', `The lantern turns toward ${R}. Your road goes on there, ${first}.`],
            ['garrick', `You're ready for ${R}. Go.`],
            ['tobin', `Are you off to ${R} next? Can I come? No? Can you bring me back a rock?`]], open({ kind: 'adventure' }));
    } else if (c) {
        const R = REGION[c.region].name;
        add('grind', [['bess', `Folk say ${R} is rough for anyone under level ${c.lv}. A few patrols would toughen you up.`],
            ['garrick', `Level ${G.hero.lv} won't cut it in ${R}. Patrol. Get to ${c.lv}.`],
            ['ilse', `Patience, child. Patrol a while; ${R} will still be there at level ${c.lv}.`]], open({ kind: 'adventure' }));
    }
    for (const b of BUILDINGS) {
        if (V.buildBlock(G, b.id)) continue;
        const lv = G.village.lv[b.id] || 0;
        const who = b.npc || 'maren';
        add('build', lv
            ? [[who, `You've everything the ${b.name} needs for level ${lv + 1}. Shall we?`],
                ['maren', `The ${b.name} could grow to level ${lv + 1}. You have the materials.`],
                ['tobin', `Ooh, you could upgrade the ${b.name}! I'll carry planks!`]]
            : [[who, `We could build the ${b.name} now. You have all it needs!`],
                ['maren', `There's room by the green for the ${b.name}, and you can pay for it.`],
                ['bess', `A ${b.name} in Briarwick? Go on, you can afford it!`]], open({ kind: 'building', id: b.id }));
        break;
    }
    for (const slot of ['weapon', 'armor', 'charm']) {
        const inv = St.equipped(G, slot);
        if (inv && !V.upgradeBlock(G, inv.uid)) {
            const nm = ITEM[inv.id].name;
            add('enhance', [['garrick', `Bring me your ${nm}. I can make it +${inv.plus + 1} with what you've got.`],
                ['garrick', `That ${nm} could take another fold of steel. +${inv.plus + 1}. Armory.`],
                ['pell', `Garrick says your ${nm} is "adequate". From him, that means bring it in for +${inv.plus + 1}.`]], open({ kind: 'building', id: 'armory' }));
            break;
        }
    }
    if ((G.bag.potion || 0) < 2 && (G.village.lv.market || 0) > 0 && V.stock(G).includes('potion') && G.res.gold >= V.price(G, 'potion')) {
        const n = G.bag.potion || 0, pr = V.price(G, 'potion');
        add('potion', [['pell', `Only ${plural(n, 'health potion')} in your bag? Mine are ${pr}g, and they work. Mostly.`],
            ['ilse', 'Carry a potion or two, child. Courage does not close wounds.'],
            ['bess', `You're heading out with ${n ? 'one potion' : 'no potions'}? Pell's got them at ${pr}g. Go on.`]], open({ kind: 'building', id: 'market' }));
    }
    return out;
}

/** Chatter that notices the game: the hero, the tale, the village, the time of day. */
function aware(G, now) {
    const hero = HERO[G.hero.id];
    const first = hero.name.split(' ')[0] === 'Brother' ? 'Brother Odo' : hero.name.split(' ')[0];
    const out = [];
    const hour = new Date(now).getHours();
    if (hour < 11) out.push(['tobin', `Morning, ${first}! Up before the rooster, same as me.`], ['bess', 'Porridge and honey this morning. First bowl\'s on the house.']);
    else if (hour >= 18) out.push(['bess', 'Evening crowd\'s coming in. Pull up a stool by the fire.'], ['ilse', 'The lanterns are lit for the night. Rest well when you can.']);
    else out.push(['maren', 'A fine afternoon for keeping a village standing.']);
    out.push(['maren', `"${hero.tale}". The bards will want that one, ${first}.`]);
    if (G.stats.battlesWon >= 5) out.push(['bess', `${G.stats.battlesWon} fights won! They're starting to tell stories about you at the bar.`]);
    if (G.stats.chainMax >= 4) out.push(['garrick', `Heard you chained ${G.stats.chainMax} matches in one go. Not bad.`]);
    if (G.hero.lv >= 5) out.push(['tobin', `Level ${G.hero.lv}! When I grow up I want to be level ${G.hero.lv + 1}.`]);
    if ((G.village.lv.hall || 0) >= 2) out.push(['maren', `A level ${G.village.lv.hall} Town Hall. My grandmother wouldn't recognise the place.`]);
    if ((G.village.lv.inn || 0) >= 2) out.push(['bess', 'The new rooms at the Goose are lovely. Only one leaks. A bit.']);
    if (G.village.daily.streak >= 3) out.push(['tobin', `${G.village.daily.streak} days running you've come home! The chickens are getting used to you.`]);
    if (G.res.gold >= 500) out.push(['pell', `${G.res.gold} gold? My, my. My shop is right over there. Just saying.`]);
    if (G.village.boostUntil > now) out.push(['tobin', 'Festival\'s on! Everything grows twice as fast for a bit. Best time to collect!'], ['bess', 'Festival cider\'s flowing! The whole village is working double.']);
    return out;
}

export class Ticker {
    constructor(ui, el) {
        this.ui = ui;
        this.el = el;
        this.t = EVERY - 1.5;       // the first line comes soon after arriving
        this.n = 0;
        this.said = new Map();      // hint id -> when it was last said (seconds)
        this.recent = [];           // the last lines said, never repeated
        this.clock = 0;
    }

    /** Call about once a second while the village is on top. */
    tick(G, dt, now, day) {
        this.clock += dt;
        this.t += dt;
        if (this.t < EVERY) return;
        this.t = 0;
        this.say(this.pick(G, now, day));
    }

    /** A line nobody said lately, from [[npc, text], …], or null. */
    fresh(says) {
        const ok = says.filter(([, t]) => !this.recent.includes(t));
        return ok.length ? pick(ok) : null;
    }

    pick(G, now, day) {
        this.n++;
        // hints and chatter take turns. A hint comes round again only after HINT_GAP seconds and in a new phrasing;
        // when no hint is due, it's chatter (v1.2.1: a single pending hint used to be said every turn)
        if (this.n % 2 === 1) {
            for (const h of hints(G, this.ui, now, day)) {
                if (this.clock - (this.said.get(h.id) ?? -1e9) < HINT_GAP) continue;
                const s = this.fresh(h.says);
                if (!s) continue;
                this.said.set(h.id, this.clock);
                return { npc: s[0], text: s[1], go: h.go, hint: true };
            }
        }
        const here = Object.keys(CHATTER).filter((id) => { const b = BUILDINGS.find((x) => x.npc === id); return !b || (G.village.lv[b.id] || 0) > 0; });
        const pool = [...aware(G, now), ...here.flatMap((id) => CHATTER[id].map((t) => [id, t]))].filter(([id]) => here.includes(id));
        const s = this.fresh(pool) || pick(pool);
        return { npc: s[0], text: s[1] };
    }

    say(x) {
        this.recent.push(x.text);
        if (this.recent.length > MEMORY) this.recent.shift();
        const n = NPC[x.npc];
        const line = document.createElement(x.go ? 'button' : 'div');
        line.className = 'tl' + (x.hint ? ' hint' : '');
        const por = document.createElement('i');
        por.className = 'tp';
        por.style.backgroundImage = `url(${ART.por(x.npc)})`;
        const name = document.createElement('b');
        name.textContent = n ? n.name.replace(/^(Elder|Mother) /, '').split(' ')[0] : 'Villager';
        name.style.color = COL[x.npc] || '#ffcf5a';
        const text = document.createElement('span');
        text.textContent = x.text;
        line.append(por, name, text);
        if (x.go) {
            const go = document.createElement('span');
            go.className = 'go';
            go.textContent = 'Go ›';
            line.append(go);
            line.title = 'Take me there';
            line.addEventListener('click', () => { this.ui.audio.ui('open'); x.go(); });
        }
        this.el.append(line);
        while (this.el.children.length > KEEP) this.el.firstChild.remove();
    }

    /** Say something now (arriving in the village, or a test). */
    now(G, now, day) { this.t = 0; this.say(this.pick(G, now, day)); }
}
