// The two voices' scripts: a TV news reporter who commentates on the rampage, and a military commander
// who barks orders when the army turns up. Pure: it reads the game and the sim's events and hands finished
// lines to say({ ch, text, pri, key }); the speaker decides how and whether to speak them.
//
// Lines are rationed three ways so it never turns into a wall of noise: a per-key cooldown (the same kind of
// remark is not repeated for a while), a gap per channel (one voice does not talk over itself), and a
// priority the speaker uses to decide who interrupts whom.

import { LEVELS, CHARS } from '../sim/data.js';

const REPORTER = 'Tina Torchlight';
const NEWS = 'news', ARMY = 'army';

const WHAT = {
    reptile: 'a very large lizard, curled up into a ball',
    monkey: 'a giant monkey, curled up into a ball and clutching what looks like a banana',
    robot: 'a giant robot of unknown origin, folded into a ball',
};
const BUILDING = {
    house: 'a house', shop: 'a shop', block: 'an office block', tower: 'a tower', sky: 'a skyscraper', spire: 'a spire',
    gas: 'a gas tank', ferris: 'the ferris wheel', statue: 'the statue', pylon: 'a bridge tower', deck: 'the bridge',
};

const L = {
    // ---- the reporter
    floors1: ['Oh my! It is knocking the tops off the buildings!', 'Look at that! Whole floors are just falling away!', 'Folks, I have never seen a building lose its top like that.'],
    floors: ['Another one losing its roof!', 'The floors are coming down like pancakes!', 'Brick and glass everywhere!', 'That building will need a new top. And a new everything.'],
    collapse: ['There goes {b}! Flat as a pancake!', '{B} has collapsed, ladies and gentlemen!', 'And {b} is gone. Just gone.', 'Another one down. That was {b}.', 'The monster has levelled {b}!'],
    ferris: ['The ferris wheel! Not the ferris wheel! The children loved that!', 'It is rolling through the ferris wheel! This is a dark day for fun.'],
    gas: ['A gas tank has gone up! Keep your distance, everyone!', 'Explosion at the gas tank! Oh, that is going to leave a mark!'],
    bridge: ['It has flattened the bridge! Commuters are not going to like this.', 'The bridge is down! Traffic is, frankly, a nightmare.'],
    statue: ['It has knocked over the statue! The city is in mourning.'],
    eatCar: ['It is swallowing cars whole! Cars!', 'A car just stuck to it. A car!'],
    eatBus: ['It has eaten a bus! A whole bus, with the passengers... oh, they got off. Phew.', 'There goes the number nine bus.'],
    eatPizza: ['Is that a pizza truck? It is eating the pizza truck! Lunch is ruined.', 'It ate the pizza truck, and it looks so much happier.'],
    eatTree: ['Even the trees are sticking to it now. Nature is not safe.', 'It is picking up trees like lint.'],
    eatPerson: ['Residents are running, but it is faster. Please, stay calm!', 'Some people are sticking to it, but I am told they are fine. Mostly.'],
    grow1: ['It is getting bigger! The monster is now as tall as a house!', 'It keeps growing! Experts say, do not feed it. Too late.'],
    grow: ['It has grown again! At this rate it will be taller than the tower!', 'Bigger and bigger! I am running out of adjectives!', 'The monster is now the size of a small building. A small, round building.'],
    combo: ['It is on a rampage! {n} smashes in a row!', '{n} in a row! It is not stopping!', 'Unstoppable! That is {n} straight!'],
    pounce1: ['It jumped! Everyone take cover!', 'It is airborne! Look out below!'],
    slam: ['The ground just shook! I felt that at the studio!', 'That landing registered on the seismograph!', 'What a landing! That is going to leave a crater.'],
    pounceHeli: ['It has swatted a helicopter out of the sky! A helicopter!', 'It jumped up and hit a chopper! Folks, I need a moment.'],
    fire: ['Is that fire? The monster is breathing atomic fire! The buildings are melting!', 'It is on fire, and it loves it! Everything near it is burning!'],
    magnet: ['Something is pulling everything toward it! Cars, trees, people! It is like a magnet!', 'It has some sort of magnetic power! Everything is flying toward it!'],
    shield: ['A shield! It has made itself a jelly shield! The army is bouncing off!', 'It has a bubble around it! I have never seen anything like it.'],
    meal: ['It ate a giant burger and grew! Even monsters get hungry.', 'Did it just eat a hamburger the size of a car? And it is bigger for it!'],
    heart: ['It is receiving a big hug from somewhere. How sweet. Please do not hug it back.', 'It looks healthier! Love really is the best medicine.'],
    hurt: ['It has been hit! The army is firing on the monster!', 'A direct hit! Oh, it has got to hurt!', 'The monster is taking fire! Is it going to be alright?'],
    low: ['The monster looks hurt. We might be seeing the end of it.', 'It is wobbling! I think it is in trouble!'],
    die: ['The monster is down! It has been stopped! The city is... wait.', 'It has been stopped! The army has done it! Hang on, I am being told something.'],
    respawn: ['It is back on its feet! Or on its ball. Whatever that part is!', 'It is up again! Nothing can stop this thing!'],
    armyTank: ['The army has arrived! Tanks are rolling into the city!', 'Breaking news: the military has deployed tanks.'],
    armyHeli: ['Helicopters overhead! Residents, please stay indoors!', 'The air force has joined in. That is a lot of helicopters.'],
    armyJet: ['A bomber is making a run on the city! Take cover!', 'Bombers! Everyone get down! Get down!'],
    tankKill: ['It just flattened a tank! A tank! I need a bigger microphone!', 'There goes the army\'s tank. Squashed.'],
    half: ['Half the city is rubble now, folks!', 'We are halfway there. Or halfway gone, depending on who you ask.'],
    quarter: ['A quarter of the city is gone, and counting.', 'The damage is already spreading across the city.'],
    threeq: ['Three quarters of the city is rubble. This is catastrophic!', 'Nearly the whole city has gone down!'],
    close: ['Almost there. There is hardly a building left standing.', 'The city is nearly flat! There is not much left to roll through.'],
    idle: ['Residents are being urged to stay calm, and also to run.', 'Experts say the best defence is to be somewhere else.', 'I am hearing the mayor left town about ten minutes ago.', 'Scientists are baffled. They are also hiding.', 'The monster does not appear to have any plan. That is somehow worse.', 'Local businesses are reporting a slow day. A very slow, round day.'],
    idleReptile: ['Biologists say this is no lizard they recognise.', 'The monster seems very pleased with itself. Look at that smile.'],
    idleMonkey: ['Zoo officials deny any connection to the monkey.', 'It seems to be saving that banana for later.'],
    idleRobot: ['A company spokesperson says this was not a product demonstration.', 'Engineers say the robot was last seen being very polite.'],
    clear: ['And that is the whole of {c}, folks. Flat. Back to you in the studio.', '{c} is rubble. This is {n}, signing off. Please, someone, stop it.', 'That is it for {c}. Nothing left but dust. I am {n}, and this was Kaiju News.'],
    win: ['The army has gone home. Ladies and gentlemen, the monster has won! This is {n}, and I need a lie down.', 'Every city is flat, and the monster is still smiling. For Kaiju News, I am {n}. Goodnight, if there is a night.'],
    over: ['The monster has been stopped. For now. This is {n}, reporting live, from a very safe distance.', 'It is over. The monster is down. Residents are cautiously... applauding.'],
    // ---- the commander
    tankWave: ['All units, this is Command. Monster sighted. Tanks, move to position and engage on sight!', 'Alpha platoon, form up on the main road. Weapons free. Take it down!', 'Command to all armour. Target is a giant ball. Repeat, a giant ball. Open fire!', 'Tank platoon, hold the line. Do not let it reach the city centre!'],
    fire: ['Fire!', 'Gunner, fire at will!', 'Hit it! Keep hitting it!', 'Shells away! Reload!', 'Lock on and fire!', 'Fire on my mark. Mark!', 'Aim for the middle! It is all middle!', 'Steady... fire!', 'Keep firing! Do not let up!'],
    contact: ['Contact! It is coming right at us!', 'It is rolling this way! Fall back, fall back!', 'Brace! Brace! Brace!', 'Close range! Reverse, reverse!'],
    tankDown: ['Tank down! Tank down!', 'We lost Alpha Two! Repeat, we lost Alpha Two!', 'It rolled right over them! Fall back!', 'Medic! Medic! Oh, never mind, it was a tank.'],
    heliWave: ['Air support inbound. Hawk One, you are cleared hot.', 'Hawk One, engage the target. Missiles free.', 'Air units, take position above the target. Do not let it jump!'],
    missile: ['Missile away!', 'Fox three! Missile away!', 'Rockets away! Stand clear!'],
    heliDown: ['Hawk One is down! Mayday, mayday!', 'It swatted a chopper! Is that even allowed?', 'We lost air support! Say again, we lost air support!'],
    jetWarn: ['All personnel, bomber squadron on approach. Danger close. Clear the area!', 'Skyhawk flight, begin your bombing run. Civilians, take cover!', 'Bombers inbound! Lay it on thick!'],
    drop: ['Bombs away!', 'Payload released! Brace for impact!', 'Ordnance away! Shock and awe!'],
    hit: ['Direct hit! Keep firing!', 'That got its attention! Keep it up!', 'Target is hit! It is still rolling!'],
    shield: ['Our shells are bouncing off! Switch ammunition!', 'It has some kind of shield! Adapt! Adapt!'],
    dieA: ['Target down! Target down! Hold your fire!', 'We got it! Cease fire! Cease fire!'],
    respawnA: ['It is still alive! Repeat, it is still alive! Regroup!', 'Negative, negative! The target is back up!', 'It is back! Fall in! Fall in!'],
    clearA: ['All units, the city is lost. Fall back to the next line. Move, move, move!', 'Command to all units. Withdraw to the next city. Fresh orders to follow.'],
};

export class Announcer {
    /** say({ ch, text, pri, key }) is called for each line that should be spoken. */
    constructor(say, rng = Math.random) {
        this.say = say;
        this.rng = rng;
        this.t = 0;
        this.lastIdx = {};
        this.reset();
    }

    reset() {
        this.cool = {};          // key → time it was last said
        this.chan = { news: -99, army: -99 };
        this.seen = {};
        this.mile = 0;
        this.idleAt = this.t;
        this.hpLow = false;
    }

    pick(key) {
        const arr = L[key];
        let i = Math.floor(this.rng() * arr.length);
        if (arr.length > 1 && i === this.lastIdx[key]) i = (i + 1) % arr.length;
        this.lastIdx[key] = i;
        return arr[i];
    }

    /** Say one of the lines under `key` if its cooldown and the channel's gap allow. Returns true when said. */
    talk(ch, key, { pri = 1, cd = 8, gap = ch === NEWS ? 6 : 4, vars = {}, lines = key } = {}) {
        if (this.cool[key] !== undefined && this.t - this.cool[key] < cd) return false;
        if (pri < 3 && this.t - this.chan[ch] < gap) return false;
        let text = this.pick(lines);
        const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        text = text.replace(/\{(\w+)\}/g, (m, k) => (k === 'B' ? cap(String(vars.b)) : vars[k] ?? vars[k.toLowerCase()] ?? m));
        this.cool[key] = this.t;
        this.chan[ch] = this.t;
        if (ch === NEWS) this.idleAt = this.t;
        this.say({ ch, text, pri, key });
        return true;
    }

    // ---------------------------------------------------------------- the news

    /** A city begins (or a saved one resumes). */
    levelStart(G, resumed = false) {
        this.reset();
        const city = LEVELS[G.level].name;
        const what = WHAT[G.char] || WHAT.reptile;
        const nm = CHARS[G.char]?.name || 'the monster';
        let text;
        if (resumed) text = `We are back live in ${city}. The monster is still at large.`;
        else if (G.level === 0) text = `This is ${REPORTER}, live for Kaiju News from ${city}. Residents are reporting ${what}, rolling into town. Authorities say it answers to the name ${nm}. We will bring you every smash as it happens.`;
        else text = `${REPORTER}, live in ${city}. ${nm} has moved on to our next city, and the army is already here. Stay with us.`;
        this.chan.news = this.t;
        this.cool.intro = this.t;
        this.say({ ch: NEWS, text, pri: 3, key: 'intro' });
    }

    onEvents(G, events) {
        const m = G.ball;
        for (const e of events) {
            switch (e.type) {
                case 'floors':
                    if (!this.seen.floors) { if (this.talk(NEWS, 'floors1', { pri: 2, cd: 0 })) this.seen.floors = 1; }
                    else this.talk(NEWS, 'floors', { pri: 0, cd: 24 });
                    break;
                case 'collapse': this.collapse(e); break;
                case 'eat': this.eat(e); break;
                case 'grow': {
                    if (!this.seen.grow) { if (this.talk(NEWS, 'grow1', { pri: 2, cd: 0 })) this.seen.grow = 1; }
                    else this.talk(NEWS, 'grow', { pri: 1, cd: 25 });
                    break;
                }
                case 'combo': this.talk(NEWS, 'combo', { pri: 2, cd: 20, vars: { n: Math.floor(e.n) } }); break;
                case 'pounce': if (!this.seen.pounce) { if (this.talk(NEWS, 'pounce1', { pri: 1, cd: 0 })) this.seen.pounce = 1; } break;
                case 'slam': this.talk(NEWS, 'slam', { pri: 0, cd: 25 }); break;
                case 'power': this.talk(NEWS, e.k === 'fire' ? 'fire' : e.k === 'magnet' ? 'magnet' : e.k === 'shield' ? 'shield' : e.k === 'meal' ? 'meal' : 'heart', { pri: 2, cd: 10 }); break;
                case 'hurt':
                    this.talk(NEWS, 'hurt', { pri: 1, cd: 14 });
                    this.talk(ARMY, 'hit', { pri: 1, cd: 9 });
                    break;
                case 'shield': this.talk(ARMY, 'shield', { pri: 1, cd: 18 }); break;
                case 'die':
                    this.talk(NEWS, 'die', { pri: 3, cd: 0 });
                    this.talk(ARMY, 'dieA', { pri: 2, cd: 0, gap: 0 });
                    break;
                case 'respawn':
                    this.talk(NEWS, 'respawn', { pri: 2, cd: 0 });
                    this.talk(ARMY, 'respawnA', { pri: 2, cd: 0, gap: 0 });
                    break;
                case 'wave': this.wave(e); break;
                case 'warn':
                    this.talk(ARMY, 'jetWarn', { pri: 3, cd: 12, gap: 0 });
                    this.talk(NEWS, 'armyJet', { pri: 1, cd: 25 });
                    break;
                case 'drop': if (!this.seen.drop || this.t - this.seen.drop > 15) { if (this.talk(ARMY, 'drop', { pri: 2, cd: 0, gap: 0 })) this.seen.drop = this.t; } break;
                case 'shot':
                    if (e.k === 'shell') this.talk(ARMY, 'fire', { pri: 1, cd: 4 });
                    else this.talk(ARMY, 'missile', { pri: 1, cd: 6 });
                    break;
                case 'smash':
                    if (e.k === 'tank') {
                        this.talk(ARMY, 'tankDown', { pri: 2, cd: 4, gap: 0 });
                        this.talk(NEWS, 'tankKill', { pri: 1, cd: 12 });
                    } else if (e.k === 'heli') {
                        this.talk(ARMY, 'heliDown', { pri: 2, cd: 4, gap: 0 });
                        this.talk(NEWS, 'pounceHeli', { pri: 2, cd: 10 });
                    }
                    break;
                case 'clear': {
                    const city = LEVELS[e.level].name;
                    this.talk(NEWS, 'clear', { pri: 3, cd: 0, vars: { c: city, n: REPORTER } });
                    this.talk(ARMY, 'clearA', { pri: 2, cd: 0, gap: 0 });
                    break;
                }
                case 'win': this.talk(NEWS, 'win', { pri: 3, cd: 0, vars: { n: REPORTER } }); break;
                case 'over': this.talk(NEWS, 'over', { pri: 3, cd: 0, vars: { n: REPORTER } }); break;
                default: break;
            }
        }
        void m;
    }

    collapse(e) {
        const name = BUILDING[e.t] || 'a building';
        if (e.t === 'ferris') this.talk(NEWS, 'ferris', { pri: 2, cd: 0 });
        else if (e.t === 'gas') this.talk(NEWS, 'gas', { pri: 2, cd: 0 });
        else if (e.t === 'pylon' || e.t === 'deck') this.talk(NEWS, 'bridge', { pri: 2, cd: 20 });
        else if (e.t === 'statue') this.talk(NEWS, 'statue', { pri: 2, cd: 0 });
        else this.talk(NEWS, 'collapse', { pri: 1, cd: 14, vars: { b: name } });
    }

    eat(e) {
        if (e.k === 'rubble') return;
        const key = e.k === 'bus' ? 'eatBus' : e.k === 'pizza' ? 'eatPizza' : e.k === 'car' ? 'eatCar'
            : (e.k === 'tree' || e.k === 'pine' || e.k === 'oak') ? 'eatTree' : e.k === 'person' ? 'eatPerson' : null;
        if (!key) return;
        // the first of each kind in a city gets a remark; after that, only now and then
        if (!this.seen[key]) { if (this.talk(NEWS, key, { pri: 1, cd: 0 })) this.seen[key] = 1; }
        else this.talk(NEWS, key, { pri: 0, cd: 40 });
    }

    wave(e) {
        if (e.k === 'tank') {
            if (!this.seen.tankWave) { this.seen.tankWave = 1; this.talk(ARMY, 'tankWave', { pri: 3, cd: 0, gap: 0 }); this.talk(NEWS, 'armyTank', { pri: 2, cd: 0, gap: 0 }); }
            else this.talk(ARMY, 'tankWave', { pri: 2, cd: 25 });
        } else if (e.k === 'heli') {
            this.talk(ARMY, 'heliWave', { pri: 2, cd: 20 });
            this.talk(NEWS, 'armyHeli', { pri: 1, cd: 40 });
        }
    }

    // ---------------------------------------------------------------- state-driven lines

    /** Called every frame while playing. */
    update(G, dt) {
        this.t += dt;
        if (G.phase !== 'play') return;
        const frac = 1 - G.hpLeft / G.totalHp;
        const goal = LEVELS[G.level].goal;
        if (this.mile < 1 && frac >= 0.25) { this.mile = 1; this.talk(NEWS, 'quarter', { pri: 1, cd: 0 }); }
        else if (this.mile < 2 && frac >= 0.5) { this.mile = 2; this.talk(NEWS, 'half', { pri: 1, cd: 0 }); }
        else if (this.mile < 3 && frac >= 0.75) { this.mile = 3; this.talk(NEWS, 'threeq', { pri: 1, cd: 0 }); }
        else if (this.mile < 4 && frac >= goal - 0.06) { this.mile = 4; this.talk(NEWS, 'close', { pri: 1, cd: 0 }); }
        const low = G.ball.hp < G.ball.maxHp * 0.3;
        if (low && !this.hpLow) this.talk(NEWS, 'low', { pri: 1, cd: 20 });
        this.hpLow = low;
        // a tank close by: "Contact!"
        for (const f of G.foes) {
            if (f.k === 'tank' && Math.hypot(f.x - G.ball.x, f.y - G.ball.y) < 11) { if (this.talk(ARMY, 'contact', { pri: 2, cd: 14 })) break; }
        }
        // a quiet spell: a bit of colour
        if (this.t - this.idleAt > 16 && this.t - this.chan.news > 12) {
            const flavour = G.char === 'monkey' ? 'idleMonkey' : G.char === 'robot' ? 'idleRobot' : 'idleReptile';
            this.talk(NEWS, 'idleX', { pri: 0, cd: 0, lines: this.rng() < 0.45 ? flavour : 'idle' });
        }
    }
}

export { L as LINES, REPORTER };
