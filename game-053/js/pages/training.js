// The Proving Yard: masters and levelling up.
import { R, fmt } from '../rng.js';
import * as S from '../engine/state.js';
import { startFight } from '../engine/combat.js';
import { MASTERS, masterStats, MAX_LEVEL } from '../data/classes.js';
import { FIGHTS, leaveFight } from './fight.js';

export function training(g) {
    const p = g.p;
    g.title('`^The Proving Yard', { view: 'training', area: 'village' });
    g.text('Behind a fence of sharpened stakes lies a yard of packed dirt, straw dummies and weapon racks. Young warriors drill in pairs while veterans watch, arms folded, saying nothing kind. A board by the gate lists the masters of the Yard, each one a legend in their own right.');
    if (p.level >= MAX_LEVEL) {
        g.text('`@You have learned everything the masters of the Proving Yard can teach you. Aurelion\'s words echo in your mind: `^"Go into the deep wood, and seek the Jade Wyrm."');
    } else {
        const m = MASTERS[p.level - 1];
        g.text(`Your master is \`^${m.name}\`0, ${m.intro}.`);
        const need = S.nextExp(p);
        if (p.flags.master) g.note('`7You have already challenged your master today. Come back tomorrow.');
        g.nav('Your Master', 'Question your master', () => {
            const left = need - p.exp;
            if (left <= 0) g.flash(`\`^${m.name}\`0 looks you up and down. "You're ready. Show me."`);
            else if (left < need * 0.1) g.flash(`\`^${m.name}\`0 nods slowly. "Close now. Very close. \`^${fmt(left)}\`0 more experience, I'd say."`);
            else g.flash(`\`^${m.name}\`0 snorts. "You need another \`^${fmt(left)}\`0 experience before you're worth my time."`);
        }, { key: 'q' });
        g.nav('Your Master', `Challenge ${m.name}`, () => {
            if (p.exp < need) {
                g.flash(`\`^${m.name}\`0 doesn't even pick up ${m.weapon}. "Not yet. You'd only embarrass us both."`);
                return;
            }
            const st = masterStats(p.level);
            const foe = { name: m.name, weapon: m.weapon, kind: 'master', color: 0xc8a050, level: st.level, maxhp: st.hp, atk: st.atk, def: st.def, gold: 0, exp: 0, death: '' };
            startFight(p, 'master', foe, { master: p.level - 1 });
            p.fight.intro = `\`^${m.name}\`0 picks up ${m.weapon} and steps into the ring. The yard falls silent.`;
            g.scene?.showFoe(foe);
            g.spend(30);
            return 'fight';
        }, { key: 'c', disabled: !!p.flags.master || !p.alive });
    }
    g.nav('The Yard', 'Read the board of masters', 'masters', { key: 'b' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

export function mastersList(g) {
    const p = g.p;
    g.title('`^The Board of Masters', { view: 'training', area: 'village' });
    g.table(['Level', 'Master', 'Weapon', ''], MASTERS.map((m, i) => [String(i + 1), `\`^${m.name}`, m.weapon, i + 1 < p.level ? '`@Defeated' : i + 1 === p.level ? '`#Your master' : '`7—']));
    g.nav('Leave', 'Back to the Yard', 'training', { key: 'b' });
}

FIGHTS.master = {
    title: (g, f) => `\`^The Proving Yard — \`&${f.foe.name}`,
    banner: () => '`^The Proving Yard',
    view: () => 'trainingfight',
    area: 'fight',
    canRun: false,
    win(g, f) {
        const p = g.p;
        const m = MASTERS[f.master];
        f.endLines.push(m.win);
        p.level++;
        p.hp = S.maxHp(p);
        p.specLevel++; p.specUses++;
        p.stats.masters = Math.max(p.stats.masters, p.level - 1);
        p.flags.toldReady = false;
        f.endLines.push(`\`#\`bYou advance to level ${p.level}!\`b`);
        f.endLines.push(`\`#Your maximum hit points rise to \`^${S.maxHp(p)}\`#, your attack and defence each rise by \`^1\`#, and your skill in ${S.spec(p).name} grows to \`^${p.specLevel}\`#.`);
        if (p.level >= 15) f.endLines.push('`@`bThe masters have nothing more to teach you. The Jade Wyrm waits in the Gloamwood.`b');
        g.news(`\`%${p.name}\`3 has defeated their master, \`^${m.name}\`3, to advance to level \`^${p.level}\`3!`);
        g.audio?.sfx('levelup');
        g.ui.toast(`\`#Level up! \`&You are now level ${p.level}.`, '⚔️', 'big');
        g.react('level');
        if (p.level >= 5) g.deed('lvl5'); if (p.level >= 10) g.deed('lvl10'); if (p.level >= 15) g.deed('lvl15');
        if (p.stats.masters >= 14) g.deed('masters');
    },
    lose(g, f) {
        const p = g.p;
        const m = MASTERS[f.master];
        p.flags.master = true;
        p.hp = S.maxHp(p);
        f.endLines.push(`\`$You have been defeated by ${m.name}.`);
        f.endLines.push('`7' + m.lose);
        f.endLines.push('`7Your wounds are bound and you are given a cup of water. No harm done — except to your pride.');
        g.audio?.sfx('fail');
    },
    after: (g) => [
        { label: 'Back to the Proving Yard', action: () => leaveFight(g, 'training'), key: 'b' },
        { label: 'Return to Hollowmere', action: () => leaveFight(g, 'village'), key: 'r' },
    ],
};
