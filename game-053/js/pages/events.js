// Forest events ("specials"). Each has start(g) which sets p.event, and
// render(g, ev) which draws the current step. Choices finish with done().
import { R, fmt, clamp } from '../rng.js';
import * as S from '../engine/state.js';
import { startFight } from '../engine/combat.js';
import { creatureFor } from '../data/creatures.js';
import { expForNext } from '../data/classes.js';
import { FIGHTS, leaveFight } from './fight.js';

function begin(g, id, data = {}) { g.p.event = { id, step: 'start', data }; }
function done(g, text, to = 'forest') { g.p.event = null; if (text) g.flash(text); return to; }
const L = (g) => g.p.level;

export const EVENTS = [
    {
        id: 'gold', w: 10, start: (g) => begin(g, 'gold', { amt: L(g) * R.i(12, 40) + R.i(1, 20) }),
        render(g, ev) {
            g.text(`\`^You stub your toe on something in the leaves: a mouldering leather pouch! Inside, \`6${fmt(ev.data.amt)}\`^ gold coins wink up at you.`);
            g.nav('Event', 'Pocket the gold', () => { g.gainGold(ev.data.amt); g.audio?.sfx('coin'); return done(g, `\`^You pocket \`6${fmt(ev.data.amt)}\`^ gold.`); }, { key: 'p' });
        },
    },
    {
        id: 'gem', w: 7, start: (g) => begin(g, 'gem'),
        render(g) {
            g.text('`%Something glints in the roots of an ancient pine. You dig with your fingers and pull out a perfect, glittering `bgem`b!');
            g.nav('Event', 'Take the gem', () => { g.gainGems(1); return done(g, '`%You tuck the gem away safely. (+1 gem)'); }, { key: 't' });
        },
    },
    {
        id: 'fairy', w: 6, start: (g) => begin(g, 'fairy'),
        render(g, ev) {
            const p = g.p;
            g.text('A tiny light zips out of a foxglove and hovers in front of your nose. It is a `%fairy`0, no bigger than your thumb, with dragonfly wings and an expression of enormous expectation.');
            g.say('`%The fairy:', 'Gem? Gem gem gem? You have a gem? Give fairy a gem?');
            g.nav('Event', 'Give the fairy a gem', () => {
                p.gems--; g.deed('fairy');
                const r = R.i(1, 4); let t;
                if (r === 1) { p.vitality++; p.hp++; t = '`%The fairy kisses your forehead. Warmth floods through you: `^+1 maximum hit point`%, forever!'; }
                else if (r === 2) { p.turns += 2; t = '`%The fairy sprinkles you with glittering dust. You feel like you could fight all day: `^+2 forest fights`%!'; }
                else if (r === 3) { p.hp = S.maxHp(p); p.specLevel++; p.specUses++; t = '`%The fairy sings a tiny song. Your wounds close, and your mind feels sharper: `^full health, +1 specialty skill`%!'; }
                else { p.charm += 2; t = '`%The fairy braids a flower into your hair. You feel irresistible: `^+2 charm`%!'; }
                g.audio?.sfx('magic');
                return done(g, t);
            }, { key: 'g', disabled: p.gems < 1 });
            g.nav('Event', 'Shoo it away', () => done(g, '`7The fairy blows a raspberry at you and zips off. You are fairly sure you have been cursed. You have not. Probably.'), { key: 's' });
        },
    },
    {
        id: 'oldman', w: 5, start: (g) => begin(g, 'oldman', { n: R.i(1, 100), tries: 6, bet: Math.max(10, L(g) * 15) }),
        render(g, ev) {
            const p = g.p, d = ev.data;
            if (ev.step === 'start') {
                g.text('An old man sits on a stump by the path, shuffling a cup and three walnut shells. No — no shells. Just the cup, and a twinkle.');
                g.say('`7Old man:', `I'm thinking of a number between one and a hundred, young'un. Six guesses. Guess it, and I'll pay you handsomely. Costs \`^${d.bet}\`0 gold to play.`);
                g.nav('Event', `Play (${d.bet} gold)`, () => { if (p.gold < d.bet) return; p.gold -= d.bet; ev.step = 'play'; }, { key: 'p', disabled: p.gold < d.bet });
                g.nav('Event', 'Walk on', () => done(g, '`7The old man shrugs. "Your loss."'), { key: 'w' });
                return;
            }
            if (d.last) g.text(d.last);
            g.text(`\`7You have \`^${d.tries}\`7 guess${d.tries === 1 ? '' : 'es'} left.`);
            g.amount({ label: 'Your guess:', placeholder: '1–100', buttons: [{ label: 'Guess', cls: 'primary', fn: (v) => {
                v = clamp(v, 1, 100); d.tries--;
                if (v === d.n) {
                    const win = d.bet * 4; g.gainGold(win); g.gainGems(1); g.audio?.sfx('coin');
                    return done(g, `\`@"${v}! Well I'll be." The old man pays out \`^${fmt(win)}\`@ gold and, grumbling, a gem.`);
                }
                if (d.tries <= 0) return done(g, `\`7"It was \`^${d.n}\`7," the old man cackles, pocketing your gold.`);
                d.last = v < d.n ? `\`7"${v}? Higher," he says.` : `\`7"${v}? Lower," he says.`;
            } }] });
        },
    },
    {
        id: 'outhouse', w: 4, start: (g) => begin(g, 'outhouse'),
        render(g) {
            const p = g.p;
            g.text('In a small clearing stands — of all things — an `6outhouse`0. Two of them, actually. One is freshly painted with a little moon carved in the door and a sign: "`^Clean. 5 gold.`0" The other is listing badly, the door hanging from one hinge, and you can smell it from here.');
            g.nav('Event', 'Use the clean one (5 gold)', () => {
                p.gold -= 5; g.deed('outhouse');
                if (R.chance(0.6)) { p.charm++; return done(g, '`@Scented candles! Fresh rushes! You emerge feeling like nobility. `^+1 charm`@.'); }
                return done(g, '`7It is very clean and entirely uneventful. Worth every copper.');
            }, { key: 'c', disabled: p.gold < 5 });
            g.nav('Event', 'Use the free one', () => {
                g.deed('outhouse');
                const r = R.f();
                if (r < 0.25) { g.gainGems(1); return done(g, '`%Against every instinct you look down — and see a gem glinting. You... retrieve it. Don\'t think about it. `^+1 gem`%.'); }
                if (r < 0.6) { p.charm = Math.max(0, p.charm - 1); return done(g, '`4The smell clings to you all day. People wince. `$-1 charm`4.'); }
                p.hp = Math.max(1, p.hp - Math.ceil(S.maxHp(p) * 0.1)); return done(g, '`4The seat gives way. You will not speak of this. You lose a little health and a lot of dignity.');
            }, { key: 'f' });
            g.nav('Event', 'Hold it and move on', () => done(g, '`7Discipline. You march on.'), { key: 'm' });
        },
    },
    {
        id: 'stones', w: 4, start: (g) => begin(g, 'stones'),
        render(g) {
            const p = g.p;
            g.text('You come upon a ring of moss-covered standing stones. The air inside the ring shimmers, and the birdsong stops at its edge as if afraid to cross.');
            g.nav('Event', 'Step into the ring', () => {
                const r = R.i(1, 6);
                g.audio?.sfx('magic');
                if (r === 1) { p.turns += 2; return done(g, '`#Light rushes up through your feet. You feel tireless: `^+2 forest fights`#.'); }
                if (r === 2) { p.hp = S.maxHp(p); return done(g, '`#Warmth floods through you. Every wound closes.'); }
                if (r === 3) { const x = Math.round((expForNext(p.level, p.dk) - (p.level > 1 ? expForNext(p.level - 1, p.dk) : 0)) * 0.08); p.exp += x; return done(g, `\`#Visions of ancient battles flood your mind. \`^+${fmt(x)} experience\`#.`); }
                if (r === 4) { p.hp = Math.max(1, Math.round(p.hp * 0.5)); return done(g, '`4The stones drink from you. You stagger out, pale and shaking. Half your health is gone.'); }
                if (r === 5) { g.gainGems(1); return done(g, '`%At the centre of the ring a gem rests on a flat stone. It seems... offered. `^+1 gem`%.'); }
                p.turns = Math.max(0, p.turns - 1); return done(g, '`7Time slips. When you step out, the light has changed. You lose `$one forest fight`7.');
            }, { key: 's' });
            g.nav('Event', 'Leave well enough alone', () => done(g, '`7Some things are better left unexplored.'), { key: 'l' });
        },
    },
    {
        id: 'traveller', w: 4, start: (g) => begin(g, 'traveller'),
        render(g) {
            const p = g.p;
            g.text('A merchant in a fine velvet coat sits on an overturned cart, one wheel snapped clean off. "Oh, thank the gods," they say. "Could you possibly help me fix this? I\'d make it worth your while."');
            g.nav('Event', 'Help (costs a forest fight)', () => {
                p.turns = Math.max(0, p.turns - 1);
                const gold = L(g) * R.i(30, 60); g.gainGold(gold); p.charm++;
                g.audio?.sfx('coin');
                return done(g, `\`@An hour of sweat later the wheel is back on. The merchant presses \`^${fmt(gold)}\`@ gold into your hand and tells everyone in the village how kind you are. \`^+1 charm\`@.`);
            }, { key: 'h', disabled: p.turns < 1 });
            g.nav('Event', 'Wish them luck and leave', () => done(g, '`7"Well. Thanks for nothing," the merchant mutters.'), { key: 'l' });
        },
    },
    {
        id: 'snare', w: 4, start: (g) => begin(g, 'snare'),
        render(g) {
            const p = g.p;
            const d = Math.max(1, Math.round(S.maxHp(p) * 0.1));
            g.text(`\`4SNAP! A hunter's snare whips around your ankle and hauls you upside down into the air. It takes ages to cut yourself free, and you bang your head on the way down.`);
            g.nav('Event', 'Untangle yourself', () => { p.hp = Math.max(1, p.hp - d); p.turns = Math.max(0, p.turns - 1); return done(g, `\`4You lose \`$${d}\`4 hit points and \`$one forest fight\`4.`); }, { key: 'u' });
        },
    },
    {
        id: 'mushrooms', w: 4, start: (g) => begin(g, 'mushrooms'),
        render(g) {
            const p = g.p;
            g.text('A perfect ring of glowing violet mushrooms circles an old stump. They smell of honey and thunderstorms. One of them seems to be... humming?');
            g.nav('Event', 'Eat a mushroom', () => {
                const r = R.i(1, 5);
                if (r === 1) { p.buffs.push({ id: 'shroom', name: 'Mushroom Rage', rounds: 15, atk: 1.4, def: 0.85 }); return done(g, '`5Your vision goes purple and you feel like you could wrestle a bear. `^Mushroom Rage`5!'); }
                if (r === 2) { p.hp = S.maxHp(p); return done(g, '`@Delicious! And somehow very healthy. You feel completely restored.'); }
                if (r === 3) { p.hp = Math.max(1, p.hp - Math.round(S.maxHp(p) * 0.3)); return done(g, '`4You spend some time getting very well acquainted with a bush. `$-30% health`4.'); }
                if (r === 4) { p.charm++; return done(g, '`%You start to glow faintly. It\'s rather fetching, actually. `^+1 charm`%.'); }
                p.drunk = Math.min(4, p.drunk + 2); return done(g, '`5The trees are talking to you. They are very rude. You feel... wobbly.');
            }, { key: 'e' });
            g.nav('Event', 'Leave them be', () => done(g, '`7The humming mushroom sounds disappointed.'), { key: 'l' });
        },
    },
    {
        id: 'shrine', w: 4, start: (g) => begin(g, 'shrine'),
        render(g) {
            const p = g.p;
            const cost = L(g) * 20;
            g.text('Half hidden by ivy is a small shrine of white stone, with a worn statue of a woman holding a lantern. Old offerings lie at its feet: coins, dried flowers, a wooden sword.');
            g.nav('Event', 'Kneel and pray', () => {
                if (R.chance(0.65)) { p.buffs.push({ id: 'shrine', name: 'Lantern\'s Blessing', rounds: 20, atk: 1.1, def: 1.1 }); return done(g, '`&A gentle warmth settles on your shoulders. `^Lantern\'s Blessing`&.'); }
                return done(g, '`7You pray for a while. Nothing happens, but you feel a little calmer.');
            }, { key: 'p' });
            g.nav('Event', `Leave an offering (${cost} gold)`, () => { p.gold -= cost; p.hp = S.maxHp(p); p.charm++; return done(g, '`&The statue\'s lantern flickers, just for a moment. Your wounds are gone, and you feel kinder. `^+1 charm`&.'); }, { key: 'o', disabled: p.gold < cost });
            g.nav('Event', 'Move on', () => done(g), { key: 'm' });
        },
    },
    {
        id: 'corpse', w: 4, start: (g) => begin(g, 'corpse', { gold: L(g) * R.i(15, 45), gem: R.chance(0.3) }),
        render(g, ev) {
            const p = g.p;
            g.text('Slumped against a tree is what remains of an adventurer — a skeleton in rusted mail, a cracked shield at their side, a coin purse still on their belt.');
            g.nav('Event', 'Loot the body', () => { g.gainGold(ev.data.gold); let t = `\`6You take \`^${fmt(ev.data.gold)}\`6 gold.`; if (ev.data.gem) { g.gainGems(1); t += ' `%And a gem, sewn into the lining!'; } return done(g, t); }, { key: 'l' });
            g.nav('Event', 'Give them a proper burial', () => { p.charm++; p.favor += 15; p.turns = Math.max(0, p.turns - 1); return done(g, '`&You dig a shallow grave and say a few words. Somewhere far away, a grey figure on a grey shore nods. `^+1 charm, +15 favour with Vorgath`&. (-1 forest fight)'); }, { key: 'b', disabled: p.turns < 1 });
            g.nav('Event', 'Leave them in peace', () => done(g), { key: 'p' });
        },
    },
    {
        id: 'whetstone', w: 4, start: (g) => begin(g, 'whetstone'),
        render(g) {
            const p = g.p;
            g.text('Beside a stream lies a flat grey stone, worn into a smooth dip by countless blades. A dwarven rune on its side reads, roughly, "SHARP."');
            g.nav('Event', 'Sharpen your weapon', () => { p.buffs.push({ id: 'whet', name: 'Keen Edge', rounds: 15, atk: 1.2 }); return done(g, `\`^You hone your ${S.weaponLabel(p)} until it sings. \`&Keen Edge\`^!`); }, { key: 's' });
        },
    },
    {
        id: 'spring', w: 4, start: (g) => begin(g, 'spring'),
        render(g) {
            const p = g.p;
            g.text('Steam rises from a rocky pool tucked among the ferns. A hot spring! The water is milky blue and smells faintly of minerals.');
            g.nav('Event', 'Take a long soak', () => { p.hp = S.maxHp(p); g.spend(40); let t = '`@You soak until your fingers wrinkle. Every ache melts away.'; if (R.chance(0.3)) { p.charm++; t += ' `%You emerge positively glowing (`^+1 charm`%).'; } return done(g, t); }, { key: 't' });
            g.nav('Event', 'No time for that', () => done(g), { key: 'n' });
        },
    },
    {
        id: 'minstrel', w: 3, start: (g) => begin(g, 'minstrel'),
        render(g) {
            const p = g.p;
            g.text('A wandering minstrel sits on a mossy log, picking out a tune on a battered lute. "A song for the road, friend?" they ask, and begin before you can answer — a rousing ballad about a hero who never, ever gets tired.');
            g.nav('Event', 'Listen', () => { p.turns++; return done(g, '`@The song stays in your head all day. `^+1 forest fight`@.'); }, { key: 'l' });
        },
    },
    {
        id: 'runestone', w: 3, start: (g) => begin(g, 'runestone'),
        render(g) {
            const p = g.p;
            const sp = S.spec(p);
            g.text(`A tall stone stands alone in a clearing, carved with spiralling runes that glow faintly ${sp.name === 'Shadow Arts' ? 'violet' : sp.name === 'Arcane Lore' ? 'blue' : 'gold'}. You feel your ${sp.name} stir in response.`);
            g.nav('Event', 'Study the runes', () => { p.specLevel++; p.specUses++; g.audio?.sfx('magic'); return done(g, `\`#Understanding dawns. Your skill in ${sp.name} grows to \`^${p.specLevel}\`#!`); }, { key: 's' });
        },
    },
    {
        id: 'ancestor', w: 3, start: (g) => begin(g, 'ancestor'),
        render(g) {
            const p = g.p;
            const x = Math.round((expForNext(p.level, p.dk) - (p.level > 1 ? expForNext(p.level - 1, p.dk) : 0)) * 0.1);
            g.text('A pale figure steps out from between the trees — an old warrior in a style of armour no one has worn for centuries. They look at you for a long moment, then nod, and raise their sword in a slow, perfect guard.');
            g.say('`&The ancestor:', 'Watch.');
            g.nav('Event', 'Watch and learn', () => { p.exp += x; return done(g, `\`&The spirit moves through a sequence of strikes and parries, then fades like mist. \`^+${fmt(x)} experience\`&.`); }, { key: 'w' });
        },
    },
    {
        id: 'pool', w: 3, start: (g) => begin(g, 'pool'),
        render(g) {
            const p = g.p;
            g.text('A still, dark pool reflects the sky perfectly — but the sky in it is full of stars, though it is day. A carved sign reads: "Drink and be changed."');
            g.nav('Event', 'Drink', () => {
                const r = R.i(1, 5);
                if (r === 1) { p.vitality++; p.hp = Math.min(S.maxHp(p), p.hp + 1); return done(g, '`#Starlight runs down your throat. `^+1 maximum hit point`#, forever.'); }
                if (r === 2) { p.charm++; return done(g, '`%Your reflection smiles at you approvingly. `^+1 charm`%.'); }
                if (r === 3) { p.hp = S.maxHp(p); return done(g, '`@Cold and pure. You feel completely restored.'); }
                if (r === 4) { p.hp = Math.max(1, p.hp - Math.round(S.maxHp(p) * 0.25)); return done(g, '`4It tastes like pondwater, because it is. `$-25% health`4.'); }
                p.gold = Math.max(0, Math.round(p.gold * 0.9)); return done(g, '`4As you lean over, some coins slip from your purse into the dark. They do not come back up. You lose 10% of your gold.');
            }, { key: 'd' });
            g.nav('Event', 'Leave it', () => done(g), { key: 'l' });
        },
    },
    {
        id: 'egg', w: 1, start: (g) => begin(g, 'egg'),
        render(g) {
            const p = g.p;
            g.text('`^Nestled in a hollow log is an egg the size of a melon, warm to the touch and shining like polished gold.');
            g.nav('Event', 'Take the golden egg', () => {
                if (R.chance(0.7)) { g.gainGems(3); return done(g, '`^The egg cracks in your hands — it was a shell of solid gold leaf around three perfect gems! `%+3 gems`^.'); }
                g.gainGold(L(g) * 150); return done(g, `\`^The egg is solid gold all the way through. Grimbold will give you a fortune for it: \`6+${fmt(L(g) * 150)} gold\`^.`);
            }, { key: 't' });
        },
    },
    {
        id: 'bridge', w: 3, start: (g) => begin(g, 'bridge', { toll: L(g) * 25 }),
        render(g, ev) {
            const p = g.p;
            g.text(`A rickety rope bridge crosses a gorge. Squatting at the near end is a warty goblin with a spear and a little wooden sign: "\`^TOL ${ev.data.toll} GOLD\`0".`);
            g.say('`2Goblin:', 'Pay toll! Or fight Grizzik! Grizzik very strong!');
            g.nav('Event', `Pay the toll (${ev.data.toll} gold)`, () => { p.gold -= ev.data.toll; const gold = L(g) * R.i(20, 50); g.gainGold(gold); return done(g, `\`7You pay. On the far side you find a quiet glade and an abandoned campsite with \`^${fmt(gold)}\`7 gold in a pot.`); }, { key: 'p', disabled: p.gold < ev.data.toll });
            g.nav('Event', 'Fight Grizzik', () => {
                const foe = { ...creatureFor(Math.max(1, L(g)), R, p.dk), name: 'Grizzik the Toll Goblin', weapon: 'a very pointy spear', kind: 'humanoid', color: 0x6f9a3b, death: 'Grizzik topples off the bridge with a long, fading "unfaaaaaair".' };
                foe.gold = Math.round(foe.gold * 1.5);
                p.event = null;
                startFight(p, 'forest', foe, { mod: 0 });
                p.fight.intro = '`2Grizzik shrieks a war cry and charges!';
                g.scene?.showFoe(foe);
                return 'fight';
            }, { key: 'f' });
            g.nav('Event', 'Turn back', () => done(g), { key: 't' });
        },
    },
    {
        id: 'chest', w: 4, start: (g) => begin(g, 'chest', { mimic: R.chance(0.3) }),
        render(g, ev) {
            const p = g.p;
            g.text('Half buried under fallen leaves is an iron-bound treasure chest. It looks old. It looks valuable. It looks... very slightly like it is breathing?');
            g.nav('Event', 'Open it', () => {
                if (ev.data.mimic) {
                    const foe = { ...creatureFor(Math.min(16, L(g) + 1), R, p.dk), name: 'Mimic', weapon: 'a lid full of teeth', kind: 'brute', color: 0x8a6a3a, death: 'The mimic\'s lid slams shut one last time. Inside, among the teeth, you find its last meal\'s gold.' };
                    foe.gold *= 2; foe.exp = Math.round(foe.exp * 1.3);
                    p.event = null; startFight(p, 'forest', foe, { mod: 1 });
                    p.fight.intro = '`$The chest sprouts teeth, a tongue, and a terrible appetite! It\'s a MIMIC!';
                    g.scene?.showFoe(foe);
                    return 'fight';
                }
                const gold = L(g) * R.i(40, 90); g.gainGold(gold); let t = `\`^The lid creaks open: \`6${fmt(gold)}\`^ gold!`;
                if (R.chance(0.5)) { g.gainGems(1); t += ' `%And a gem!'; }
                g.audio?.sfx('coin');
                return done(g, t);
            }, { key: 'o' });
            g.nav('Event', 'Poke it with a stick first', () => {
                if (ev.data.mimic) return done(g, '`7You poke it. It growls. You decide that this is not your chest and walk away very quickly.');
                ev.data.mimic = false; ev.step = 'poked';
            }, { key: 'p', disabled: ev.step === 'poked' });
            if (ev.step === 'poked') g.text('`7You poke it. Nothing happens. It\'s just a chest.');
            g.nav('Event', 'Leave it', () => done(g), { key: 'l' });
        },
    },
    {
        id: 'pixies', w: 3, start: (g) => begin(g, 'pixies'),
        render(g) {
            const p = g.p;
            g.text('Giggling fills the air. A cloud of pixies swirls around you, tugging your hair, untying your laces and rummaging in your pockets.');
            g.nav('Event', 'Swat at them', () => {
                if (R.chance(0.5)) { const lost = Math.round(p.gold * 0.15); p.gold -= lost; return done(g, `\`5By the time they scatter, your purse is \`$${fmt(lost)}\`5 gold lighter.`); }
                return done(g, '`5You catch one by the wing. It squeaks and drops a stolen copper before escaping. You feel oddly victorious.');
            }, { key: 's' });
            g.nav('Event', 'Laugh along', () => { p.charm++; return done(g, '`%You laugh, and the pixies love it. They weave flowers into your hair before flitting off. `^+1 charm`%.'); }, { key: 'l' });
        },
    },
    {
        id: 'child', w: 3, start: (g) => begin(g, 'child'),
        render(g) {
            const p = g.p;
            g.text('A small child in a red hood sits crying on a rock. "I followed a rabbit," they sniffle, "and now I don\'t know where the village is."');
            g.nav('Event', 'Walk them home (costs a forest fight)', () => {
                p.turns = Math.max(0, p.turns - 1); p.charm += 2; const gold = L(g) * 20; g.gainGold(gold);
                return done(g, `\`@You carry them home on your shoulders. Their parents weep with relief, press \`^${fmt(gold)}\`@ gold on you and tell the whole village. \`^+2 charm\`@.`);
            }, { key: 'w', disabled: p.turns < 1 });
            g.nav('Event', 'Point the way and move on', () => done(g, '`7You point vaguely toward the village. The child stops crying and stares at you. You feel terrible all day.'), { key: 'p' });
        },
    },
    {
        id: 'scale', w: 2, cond: (g) => g.p.level >= 10, start: (g) => begin(g, 'scale'),
        render(g) {
            const p = g.p;
            g.text('`@Wedged between two boulders is a single scale as large as a shield, translucent green, warm, and humming faintly. It is from the Jade Wyrm. You are sure of it.');
            g.nav('Event', 'Touch the scale', () => {
                if (R.chance(0.5)) { const x = Math.round(expForNext(p.level, p.dk) * 0.05); p.exp += x; return done(g, `\`@Visions of fire and an endless hoard. You understand your enemy a little better. \`^+${fmt(x)} experience\`@.`); }
                p.turns = Math.max(0, p.turns - 1); return done(g, '`2A wave of ancient dread washes over you. You spend a long while sitting very still. `$-1 forest fight`2.');
            }, { key: 't' });
            g.nav('Event', 'Back away slowly', () => done(g), { key: 'b' });
        },
    },
    {
        id: 'peddler', w: 3, start: (g) => begin(g, 'peddler', { price: L(g) * 18 }),
        render(g, ev) {
            const p = g.p;
            g.text(`A peddler with an enormous pack nods to you from the path. Bottles clink. "Healing draught, friend? Fresh this week. Only \`^${ev.data.price}\`0 gold."`);
            g.nav('Event', `Buy a draught (${ev.data.price} gold)`, () => { p.gold -= ev.data.price; p.hp = S.maxHp(p); g.audio?.sfx('heal'); return done(g, '`@It tastes of mint and copper. You feel completely restored.'); }, { key: 'b', disabled: p.gold < ev.data.price || p.hp >= S.maxHp(p) });
            g.nav('Event', 'No thanks', () => done(g), { key: 'n' });
        },
    },
];

export function pickEvent(g) {
    const ok = EVENTS.filter((e) => !e.cond || e.cond(g));
    return R.weighted(ok, (e) => e.w);
}

export function eventPage(g) {
    const p = g.p;
    const ev = p.event;
    if (!ev) return g.goto('forest');
    const E = EVENTS.find((e) => e.id === ev.id);
    g.title('`2The Gloamwood — something unusual', { view: 'forest', area: 'forest', banner: '`2The Gloamwood' });
    E.render(g, ev);
}
