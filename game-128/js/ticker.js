// Gemheart Saga — the village ticker (v1.2.0): an MMO-style feed along the bottom of Briarwick. Every few seconds a
// villager speaks: a hint about what to do next (clickable: it takes you there), or a bit of village chatter.
// Hints are read from G; it never changes G itself (an action goes through ui.cmd or opens a panel).

import { NPC, BUILDINGS, REQUESTS, RES_NAMES } from './sim/data/village.js';
import { ITEM } from './sim/data/items.js';
import { REGION } from './sim/data/world.js';
import { ART } from './assets.js';
import { chapter } from './sim/game.js';
import * as V from './sim/village.js';
import * as St from './sim/stats.js';

const EVERY = 7;            // seconds between lines
const KEEP = 3;             // lines shown
const COL = { maren: '#ffcf5a', bess: '#ff9f7a', pell: '#7fd4ff', ilse: '#e9e4ff', garrick: '#ffb067', tobin: '#9be37a' };

const CHATTER = {
    maren: ['The well bucket came up full of moonwater again. I\'m choosing not to worry about it.',
        'Every lantern in Briarwick is a promise. Keep them lit for us.',
        'When I was a girl, the Gemheart sang at harvest. You could hear it in the stones.'],
    bess: ['Stew\'s on! Don\'t ask what\'s in it. It\'s mostly turnip. Mostly.',
        'A traveller swore he saw a boar wearing a crown out on the meadow road. I gave him a second pint.',
        'Somebody\'s been sleeping in the hayloft again. If it\'s you, love, at least fold the blanket.'],
    pell: ['Fresh stock! Well, fresh-ish. Freshly dusted.',
        'A Phoenix Feather: for when the fight goes badly. Which, let\'s be honest, it sometimes does.',
        'Buy two potions, get the third at full price! It\'s a very honest deal.'],
    ilse: ['The lantern flickers when the east wind blows. Something out there is hungry for light.',
        'Rest is not weakness, child. Even the sun goes down.',
        'Hearts on the board are the Vale\'s own healing. Do not scorn them.'],
    garrick: ['Steel remembers every blow. So should you.',
        'Ore. More ore. That\'s all I\'ve got to say.',
        'A blade\'s only as good as the arm. Get stronger, I\'ll handle the rest.'],
    tobin: ['The chickens are plotting. I\'ve seen the look.',
        'Grain\'s looking grey at the edges this year. You noticed that too?',
        'Ma says if I keep feeding the slimes, they\'ll follow me home. One already has.'],
};

/** What the player could usefully do now, most pressing first: [{ id, npc, text, go }] (go: an action, or null). */
export function hints(G, ui, now, day) {
    const out = [];
    const add = (id, npc, text, go = null) => out.push({ id, npc, text, go });
    const open = (p) => () => ui.openPanel(p, G);
    if (G.hero.sp > 0) add('sp', 'ilse', `You have ${G.hero.sp} skill point${G.hero.sp > 1 ? 's' : ''} waiting. Open Hero & Skills and learn something new.`, open({ kind: 'hero', tab: 'skills' }));
    const best = V.bestGear(G);
    const better = Object.entries(best).find(([slot, inv]) => inv && G.hero.eq[slot] !== inv.uid);
    if (better) add('gear', 'garrick', `You've a better ${better[0]} in your bag than the one you're wearing: ${ITEM[better[1].id].name}. Gear → Equip best.`, open({ kind: 'hero', tab: 'gear' }));
    if (V.canDaily(G, day)) add('daily', 'maren', 'Your daily gift is waiting, and it starts a harvest festival. Claim it!', () => ui.cmd({ t: 'daily', day: ui.today(), now: ui.now() }));
    const tick = V.nextTick(G, now);
    const p = V.pending(G, now);
    const whole = Object.entries(p).filter(([, v]) => v >= 1).map(([k, v]) => `${Math.floor(v)} ${RES_NAMES[k].toLowerCase()}`);
    if (tick?.full) add('full', 'bess', 'The stores are full to the rafters! Collect, or the village stops working.', () => ui.cmd({ t: 'collect', now: ui.now() }));
    else if (whole.length) add('collect', 'tobin', `The stores have ${whole.join(', ')} for you. Hit Collect!`, () => ui.cmd({ t: 'collect', now: ui.now() }));
    const done = REQUESTS.find((rq) => !G.claimed[rq.id] && V.requestDone(G, rq));
    if (done) add('req', done.npc, `You did it! Come and claim your reward for "${done.title}".`, open({ kind: 'requests' }));
    const c = chapter(G);
    if (c && G.hero.lv >= c.lv) add('story', 'maren', `"${c.title}" is waiting: chapter ${G.story.ch + 1} of your tale. To adventure!`, open({ kind: 'adventure' }));
    else if (c) add('grind', 'bess', `Folk say ${REGION[c.region].name} is rough for anyone under level ${c.lv}. A few patrols would toughen you up.`, open({ kind: 'adventure' }));
    for (const b of BUILDINGS) {
        if (V.buildBlock(G, b.id)) continue;
        const lv = G.village.lv[b.id] || 0;
        add('build', b.npc || 'maren', lv ? `You've everything the ${b.name} needs for level ${lv + 1}. Shall we?` : `We could build the ${b.name} now. You have all it needs!`, open({ kind: 'building', id: b.id }));
        break;
    }
    for (const slot of ['weapon', 'armor', 'charm']) {
        const inv = St.equipped(G, slot);
        if (inv && !V.upgradeBlock(G, inv.uid)) { add('enhance', 'garrick', `Bring me your ${ITEM[inv.id].name}. I can make it +${inv.plus + 1} with what you've got.`, open({ kind: 'building', id: 'armory' })); break; }
    }
    if ((G.bag.potion || 0) < 2 && (G.village.lv.market || 0) > 0 && V.stock(G).includes('potion') && G.res.gold >= V.price(G, 'potion')) {
        add('potion', 'pell', `Only ${G.bag.potion || 0} health potion${G.bag.potion === 1 ? '' : 's'} in your bag? Mine are ${V.price(G, 'potion')}g, and they work. Mostly.`, open({ kind: 'building', id: 'market' }));
    }
    return out;
}

export class Ticker {
    constructor(ui, el) {
        this.ui = ui;
        this.el = el;
        this.t = EVERY - 1.5;       // the first line comes soon after arriving
        this.n = 0;
        this.said = new Map();      // hint id -> when it was last said (seconds)
        this.clock = 0;
        this.last = {};             // npc -> last chatter index
    }

    /** Call about once a second while the village is on top. */
    tick(G, dt, now, day) {
        this.clock += dt;
        this.t += dt;
        if (this.t < EVERY) return;
        this.t = 0;
        this.say(this.pick(G, now, day));
    }

    pick(G, now, day) {
        this.n++;
        // hints and chatter take turns; a hint isn't repeated within 40 s unless nothing else is pressing
        const hs = hints(G, this.ui, now, day);
        const fresh = hs.filter((x) => this.clock - (this.said.get(x.id) ?? -1e9) > 40);
        if (hs.length && (this.n % 2 === 1 || !fresh.length) && (fresh[0] || hs[0])) {
            const x = fresh[0] || hs[0];
            this.said.set(x.id, this.clock);
            return { ...x, hint: true };
        }
        const ids = Object.keys(CHATTER).filter((id) => !BUILDINGS.some((b) => b.npc === id) || (G.village.lv[BUILDINGS.find((b) => b.npc === id).id] || 0) > 0);
        const npc = ids[Math.floor(Math.random() * ids.length)];
        const lines = CHATTER[npc];
        let i = Math.floor(Math.random() * lines.length);
        if (i === this.last[npc]) i = (i + 1) % lines.length;
        this.last[npc] = i;
        if (G.village.boostUntil > now && Math.random() < 0.3) return { npc: 'tobin', text: 'Festival\'s on! Everything grows twice as fast for a bit. Best time to collect!' };
        return { npc, text: lines[i] };
    }

    say(x) {
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

