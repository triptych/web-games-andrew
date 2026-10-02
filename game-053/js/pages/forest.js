// The Gloamwood: looking for trouble, the healer, the Jade Wyrm.
import { R, fmt, clamp } from '../rng.js';
import * as S from '../engine/state.js';
import { startFight } from '../engine/combat.js';
import { creatureFor, WYRM } from '../data/creatures.js';
import { MAX_LEVEL } from '../data/classes.js';
import { FIGHTS, leaveFight } from './fight.js';
import { pickEvent } from './events.js';

const FOREST_TEXT = [
    'The Gloamwood closes around you like a held breath. Moss swallows the sound of your boots, old pines lean together overhead, and somewhere out of sight a branch cracks under something heavier than a deer. Bleached bones lie half-sunk in the ferns — a reminder that not everything that walks in here walks out.',
    'Pale light falls in dusty shafts between the pines. The path, if it is a path, winds between roots as thick as your waist. Every few steps you stop and listen. The forest listens back.',
    'Mist curls between the trunks of the Gloamwood. Strange mushrooms glow faintly at the bases of the trees, and the air smells of wet earth, resin and something rotten not far off.',
];

export function forest(g) {
    const p = g.p;
    if (!p.alive) return g.goto('shades');
    g.title('`2The Gloamwood', { view: 'forest', area: 'forest' });
    g.text(R.pick(FOREST_TEXT));
    if (p.turns <= 0) g.text('`7You are too tired to search the forest any longer today. Perhaps a good night\'s sleep would help — or something from the Crooked Antler.');
    else g.text(`\`2You have \`^${p.turns}\`2 forest fight${p.turns === 1 ? '' : 's'} left today.`);
    if (p.hp < S.maxHp(p) * 0.4) g.text('`$Your wounds ache. Mother Nettle\'s hut is not far.');

    const tired = p.turns <= 0;
    g.nav('Gloamwood', 'Look for something to kill', () => search(g, 0), { key: 'l', disabled: tired });
    g.nav('Gloamwood', 'Go slumming', () => search(g, -1), { key: 's', disabled: tired || p.level <= 1, tip: 'Fight something a level below you (less XP)' });
    g.nav('Gloamwood', 'Go thrill-seeking', () => search(g, 1), { key: 't', disabled: tired, tip: 'Fight something a level above you (+25% XP)' });
    if (p.level >= MAX_LEVEL) g.nav('Gloamwood', '`@Seek out the Jade Wyrm', 'wyrm', { key: 'g', cls: 'wyrm' });
    g.nav('Gloamwood', 'Mother Nettle\'s Hut', 'healer', { key: 'h' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

function search(g, mod) {
    const p = g.p;
    if (p.turns <= 0) return;
    p.turns--;
    g.spend(40);
    // forest events
    const eventChance = 0.13 * (S.race(p).events || 1);
    if (R.chance(eventChance)) {
        const ev = pickEvent(g);
        if (ev) { p.stats.events++; ev.start(g); return 'event'; }
    }
    const lvl = clamp(p.level + mod, 1, 16);
    const foe = creatureFor(lvl, R, p.dk);
    if (mod === 1) foe.exp = Math.round(foe.exp * 1.25);
    if (mod === -1) foe.exp = Math.round(foe.exp * 0.75);
    startFight(p, 'forest', foe, { mod });
    const f = p.fight;
    const roll = R.f();
    if (roll < 0.08) {
        f.intro = `\`$${foe.name} ambushes you from the undergrowth!`;
        g.scene?.showFoe(foe);
        // the foe gets a free strike
        const atk = foe.atk; const d = Math.round(R.bell(0, atk) - R.bell(0, S.defense(p)));
        if (d > 0) { p.hp = Math.max(1, p.hp - d); f.taken += d; f.log.push({ r: 0, l: `\`^${foe.name}\`4 strikes before you can react for \`$${d}\`4 damage!` }); }
    } else if (roll < 0.18) {
        f.intro = `\`@You spot ${foe.name} before it spots you, and strike first!`;
        g.scene?.showFoe(foe);
        f.firstStrike = true;
    } else {
        f.intro = `\`2You have encountered \`^${foe.name}\`2, which lunges at you with ${foe.weapon}!`;
        g.scene?.showFoe(foe);
    }
    return 'fight';
}

FIGHTS.forest = {
    title: (g, f) => `\`2The Gloamwood — \`^${f.foe.name}`,
    banner: () => '`2The Gloamwood',
    view: () => 'clearing',
    area: 'fight',
    canRun: true,
    win(g, f) {
        const p = g.p, foe = f.foe;
        g.audio?.sfx('victory');
        f.endLines.push('`7' + foe.death);
        const gold = g.gainGold(foe.gold, true);
        let exp = foe.exp;
        if (f.mod === 1) p.stats.thrill++;
        p.exp += exp;
        p.stats.kills++;
        f.endLines.push(`\`^You receive \`6${fmt(gold)}\`^ gold and \`#${fmt(exp)}\`^ experience!`);
        g.deed('firstblood');
        if (R.chance(1 / 25)) { g.gainGems(1); f.endLines.push('`%You find a GEM among its remains!'); }
        if (f.taken === 0) {
            p.turns++; p.stats.flawless++;
            f.endLines.push('`@`bFlawless!`b You didn\'t take a single scratch. You feel energised: `^+1 forest fight`@.');
            if (p.stats.flawless >= 10) g.deed('flawless10');
        }
        if (p.stats.thrill >= 25) g.deed('thrill25');
        if (p.stats.bestHit >= 100) g.deed('bighit');
        if (p.exp >= S.nextExp(p) && p.level < 15 && !p.flags.toldReady) {
            p.flags.toldReady = true;
            f.endLines.push('`#You feel you have learned enough to challenge your master at the Proving Yard.');
        }
        g.audio?.sfx('coin');
    },
    lose(g, f) {
        const p = g.p, foe = f.foe;
        const r = g.die(foe.name, `\`%${p.name}\`3 was slain in the Gloamwood by \`^${foe.name}\`3.`);
        f.endLines.push(`\`$\`bYou have been slain by ${foe.name}!\`b`);
        f.endLines.push(`\`4${foe.name} stands over your body, then wanders off with \`^${fmt(r.lostGold)}\`4 gold that was in your purse.`);
        f.endLines.push(`\`4You lose \`^${fmt(r.lostExp)}\`4 experience. Your spirit drifts down toward the Pale Shore...`);
    },
    fled(g, f) { f.endLines.push('`7You catch your breath at a safe distance, heart pounding.'); },
    after(g, f) {
        const p = g.p;
        if (f.result === 'lose') return [{ label: 'Continue to the Pale Shore', action: () => leaveFight(g, 'shades'), key: 'c' }];
        return [
            { label: 'Look for something else to kill', action: () => { leaveFight(g); return search(g, 0) || 'forest'; }, key: 'l', disabled: p.turns <= 0 },
            { label: 'Go thrill-seeking', action: () => { leaveFight(g); return search(g, 1) || 'forest'; }, key: 't', disabled: p.turns <= 0 },
            { label: 'Return to the forest', action: () => leaveFight(g, 'forest'), key: 'f' },
            { label: 'Mother Nettle\'s Hut', action: () => leaveFight(g, 'healer'), key: 'h' },
            { label: 'Return to Hollowmere', action: () => leaveFight(g, 'village'), key: 'v' },
        ];
    },
};

// ------------------------------------------------------------- healer
export function healCost(p, amount) {
    return Math.round(Math.log(p.level + 1) * (amount + 10) * (1 + p.dk * 0.03));
}

export function healer(g) {
    const p = g.p;
    g.title('`@Mother Nettle\'s Hut', { view: 'healer', area: 'forest' });
    g.text('A crooked little hut leans against an oak at the forest\'s edge, green smoke curling from its chimney. Inside, bundles of herbs hang from every beam and something bubbles in a black pot. `@Mother Nettle`0, who might be ninety or two hundred, peers at you over her spectacles.');
    const missing = S.maxHp(p) - p.hp;
    if (missing <= 0) {
        g.say('`@Mother Nettle:', 'Not a scratch on you. Off you go, and don\'t track mud in on your way out.');
    } else {
        const full = healCost(p, missing);
        g.say('`@Mother Nettle:', `Hmph. Look at the state of you. I can put that right for \`^${fmt(full)}\`0 gold. Or a little at a time, if you\'re counting your coppers.`);
        for (const pct of [100, 75, 50, 25, 10]) {
            const amt = Math.max(1, Math.round(missing * pct / 100));
            const cost = healCost(p, amt);
            g.nav('Healing', pct === 100 ? `Complete healing (${fmt(cost)} gold)` : `Heal ${pct}% (${fmt(cost)} gold)`, () => {
                if (p.gold < cost) { g.flash('`$Mother Nettle taps the counter. "Gold first, dearie."'); return; }
                p.gold -= cost; p.hp = Math.min(S.maxHp(p), p.hp + amt);
                g.audio?.sfx('heal');
                g.flash(`\`@Mother Nettle smears something green and foul on your wounds. It stings, then tingles, then... you feel much better. (\`^+${amt} HP\`@)`);
                g.spend(5);
            }, { key: { 100: 'c', 75: '7', 50: '5', 25: '2', 10: '1' }[pct], disabled: p.gold < cost });
        }
    }
    g.nav('Leave', 'Back to the forest', 'forest', { key: 'f' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

// ------------------------------------------------------------- the Jade Wyrm
export function wyrm(g) {
    const p = g.p;
    g.title('`@The Lair of the Jade Wyrm', { view: 'lair', area: 'lair' });
    if (p.level < MAX_LEVEL) { g.text('You wander for hours but find no sign of the Wyrm. It does not deign to notice the likes of you. Yet.'); g.nav('Leave', 'Back to the forest', 'forest'); return; }
    g.text('You follow the trail no sane person follows: past the last waymarkers, past the trees that have been burned to glass, up the scorched mountainside to a cave mouth wide enough to swallow the inn. The air shimmers with heat. Jade-green light pulses from somewhere deep inside, slow, like breathing.');
    g.text('Bones carpet the floor of the cave — knights, farmers, adventurers, a few who must have been very brave and very foolish. Then two great eyes open in the dark, each as large as a shield, and the light of them turns your skin green.');
    g.say('`@The Jade Wyrm:', `${p.name}. Another little warrior come to die. Come, then. I have been so very bored.`);
    if (p.hp < S.maxHp(p)) g.text(`\`$You are wounded (${p.hp}/${S.maxHp(p)} HP). It would be wise to heal first.`);
    g.nav('The Lair', '`@Enter the lair and fight', () => {
        const scale = 1 + p.dk * 0.04;
        const foe = { ...WYRM, maxhp: Math.round(WYRM.hp * scale), atk: Math.round(WYRM.atk * scale), def: Math.round(WYRM.def * scale) };
        startFight(p, 'wyrm', foe);
        p.fight.intro = '`@The Jade Wyrm uncoils from its hoard, and the cave fills with jade fire!';
        p.stats.wyrmTries++;
        g.scene?.showFoe(foe);
        g.audio?.sfx('roar');
        return 'fight';
    }, { key: 'e', cls: 'wyrm' });
    g.nav('The Lair', 'Flee back to the forest', 'forest', { key: 'f' });
}

FIGHTS.wyrm = {
    title: () => '`@The Jade Wyrm',
    view: () => 'lairfight',
    area: 'lair',
    canRun: false,
    win(g, f) {
        g.audio?.sfx('fanfare');
        f.endLines.push('`@' + f.foe.death);
        f.dk = true;
    },
    lose(g, f) {
        const p = g.p;
        g.die('The Jade Wyrm', `\`2${p.name} went to face the Jade Wyrm and was burned to ash.\`3 Their screams were heard as far as the village.`);
        f.endLines.push('`$`bThe Jade Wyrm has slain you!`b');
        f.endLines.push('`2Jade fire washes over you, and the last thing you hear is the Wyrm\'s laughter, rolling like thunder through the mountain.');
    },
    after(g, f) {
        if (f.result === 'lose') return [{ label: 'Continue to the Pale Shore', action: () => leaveFight(g, 'shades'), key: 'c' }];
        return [{ label: '`^Claim your victory', action: () => leaveFight(g, 'dkwin'), key: 'c' }];
    },
};

export function dkwin(g) {
    const p = g.p;
    g.title('`^`bVictory over the Jade Wyrm!`b', { view: 'lair', area: 'victory' });
    g.text('You stand in the silent cave, chest heaving, the Wyrm\'s great head at your feet. Its eyes are dark now. Outside, for the first time in living memory, birds begin to sing in the Gloamwood.');
    g.text('You walk back to Hollowmere in a daze. People line the road. Somebody is crying; somebody is ringing the chapel bell. And then, as you pass through the gate, a strange weariness comes over you. You remember the Wyrm\'s blood on your hands, glowing jade, sinking into your skin...');
    g.text('`#You wake in the fields, a farmhand once more, with only half-memories of a great battle. But something of the Wyrm remains in you. You are stronger than you were.');
    g.heading('Choose the gift the Wyrm left in you:');
    const choose = (k, txt) => () => {
        p.dkBonus[k]++;
        p.dk++;
        // reset
        p.level = 1; p.exp = 0; p.weapon = 0; p.armor = 0;
        p.gold = 50 + p.dk * 25; p.flags.toldReady = false;
        p.hp = S.maxHp(p);
        p.buffs = [];
        g.news(`\`&\`b${S.fullName({ ...p, dk: p.dk - 1 })} has slain the Jade Wyrm!\`b\`0 \`@All across the realm, people rejoice. ${p.name} now has \`^${p.dk}\`@ Wyrm kill${p.dk === 1 ? '' : 's'}.`);
        g.deed('dk1'); if (p.dk >= 5) g.deed('dk5'); if (p.dk >= 10) g.deed('dk10');
        g.react('dk');
        g.flash(`\`^${txt}\`0 You are now known as \`%${S.fullName(p)}\`0.`);
        g.ui.toast(`\`^You slew the Jade Wyrm! \`&Wyrm kills: ${p.dk}`, '🐉', 'big');
        return 'village';
    };
    g.nav('The Wyrm\'s Gift', 'Vitality: +5 maximum hit points', choose('hp', 'The Wyrm\'s endurance runs in your veins.'), { key: 'h' });
    g.nav('The Wyrm\'s Gift', 'Stamina: +1 forest fight every day', choose('turns', 'You will never tire as easily again.'), { key: 't' });
    g.nav('The Wyrm\'s Gift', 'Ferocity: +1 attack', choose('atk', 'Your blows carry the Wyrm\'s fury.'), { key: 'a' });
    g.nav('The Wyrm\'s Gift', 'Scales: +1 defence', choose('def', 'Your skin remembers the Wyrm\'s scales.'), { key: 'd' });
}

export { search };
