// The Pale Shore: where the dead wait. Torment souls for Vorgath's favour.
import { R, fmt } from '../rng.js';
import * as S from '../engine/state.js';
import { startFight } from '../engine/combat.js';
import { soulFor } from '../data/creatures.js';
import { FIGHTS, leaveFight } from './fight.js';

export const RESURRECT = 100;

export function shades(g) {
    const p = g.p;
    if (p.alive) return g.goto('village');
    g.title('`7The Pale Shore', { view: 'shades', area: 'shades' });
    g.text('You stand on a grey beach under a grey sky. The sea makes no sound. All around you, the shades of the dead drift along the shore, some weeping, some arguing, some just staring at the water. Far out, a black boat with a single lantern waits beside a barrow-mound — the domain of `&Vorgath the Ferryman`0.');
    g.text(`\`7You are dead. A new day will bring you back to life. Or you could earn Vorgath's favour and ask him to return you early. You have \`^${p.favor}\`7 favour; resurrection costs \`^${RESURRECT}\`7.`);
    g.nav('The Shore', 'The Barrow Field (torment souls)', 'graveyard', { key: 't' });
    g.nav('The Shore', 'Vorgath\'s Barrow', 'mausoleum', { key: 'v' });
    g.nav('The Shore', p.pacing === 'classic' ? 'Drift into the long sleep (log out)' : 'Drift into the long sleep (new day)', () => g.sleep('shades'), { key: 's' });
    g.nav('Information', 'The Hollowmere Herald', 'news', { key: 'n' });
    g.nav('Information', 'Hall of Heroes', 'hof', { key: 'h' });
    g.nav('Information', 'The Rookery (mail)', 'mail', { key: 'm' });
    g.nav('Other', 'Preferences & saves', 'prefs', { key: 'p' });
    g.chat('shades', '`7The dead murmur among themselves');
}

export function graveyard(g) {
    const p = g.p;
    if (p.alive) return g.goto('village');
    g.title('`7The Barrow Field', { view: 'graveyard', area: 'shades' });
    g.text('Leaning headstones and grassy barrows stretch away into the mist. Restless souls wander here, unable to cross over — shades who did wrong in life, or were wronged. Vorgath rewards those who torment them back into their graves.');
    g.text(`\`7You have \`^${p.gravefights}\`7 torment${p.gravefights === 1 ? '' : 's'} left today. Favour: \`^${p.favor}\`7.`);
    g.nav('The Barrow Field', 'Torment a restless soul', () => {
        if (p.gravefights <= 0) return;
        p.gravefights--;
        const foe = soulFor(p.level, R);
        const soulMax = 10 * p.level + 10;
        startFight(p, 'soul', foe, { soulMax });
        p.hp = p.soulHp ?? soulMax;
        p.fight.intro = `\`7A ${foe.name.toLowerCase()} rises from the mist, wailing.`;
        g.scene?.showFoe(foe);
        return 'fight';
    }, { key: 't', disabled: p.gravefights <= 0 });
    g.nav('Leave', 'Back to the shore', 'shades', { key: 'b' });
}

FIGHTS.soul = {
    title: (g, f) => `\`7The Barrow Field — ${f.foe.name}`,
    view: () => 'graveyardfight',
    area: 'shades',
    canRun: true,
    win(g, f) {
        const p = g.p;
        p.favor += f.foe.favor; p.stats.souls++;
        p.soulHp = p.hp; p.hp = 0;
        f.endLines.push('`7' + f.foe.death);
        f.endLines.push(`\`&Vorgath is pleased. \`^+${f.foe.favor}\`& favour (now ${p.favor}).`);
        if (p.stats.souls >= 20) g.deed('souls20');
    },
    lose(g, f) {
        const p = g.p;
        p.gravefights = 0; p.soulHp = 0; p.hp = 0;
        f.endLines.push(`\`$${f.foe.name} overwhelms your weary soul.`);
        f.endLines.push('`7You are too exhausted to torment anything else today.');
    },
    fled(g, f) { g.p.soulHp = g.p.hp; g.p.hp = 0; f.endLines.push('`7You drift away into the mist.'); },
    after: (g) => [
        { label: 'Torment another soul', action: () => { leaveFight(g); return 'graveyard'; }, key: 't' },
        { label: 'Back to the shore', action: () => leaveFight(g, 'shades'), key: 'b' },
    ],
};

export function mausoleum(g) {
    const p = g.p;
    if (p.alive) return g.goto('village');
    g.title('`&Vorgath\'s Barrow', { view: 'mausoleum', area: 'shades' });
    g.text('Inside the barrow it is colder than the grave. `&Vorgath the Ferryman`0 sits on a throne of driftwood and bone, a hooded figure taller than any living thing, holding an oar of black iron. Two pale lights burn where his eyes should be.');
    g.say('`&Vorgath:', p.favor >= RESURRECT ? 'You have served me well. I could send you back... for a price.' : `You have ${p.favor} favour. Hardly enough to interest me. Return when you have ${RESURRECT}.`);
    g.nav('Vorgath', `Ask to be returned to life (${RESURRECT} favour)`, () => {
        if (p.favor < RESURRECT) return;
        p.favor -= RESURRECT; p.alive = true; p.hp = Math.round(S.maxHp(p) * 0.5); p.soulHp = null;
        g.news(`\`&${p.name}\`7 has been returned to the world of the living by Vorgath the Ferryman.`);
        g.deed('resurrect');
        g.audio?.sfx('magic');
        g.flash('`&Vorgath raises his oar. The world rushes back in a roar of colour and noise, and you wake gasping in the Hollowmere graveyard, very much alive.');
        return 'village';
    }, { key: 'a', disabled: p.favor < RESURRECT });
    g.nav('Vorgath', 'Ask him to restore your soul (10 favour)', () => {
        if (p.favor < 10) return;
        p.favor -= 10; p.soulHp = null; g.flash('`&Vorgath breathes on you. Your soul feels whole again.');
    }, { key: 'r', disabled: p.favor < 10 || p.soulHp == null });
    g.nav('Leave', 'Back to the shore', 'shades', { key: 'b' });
}
