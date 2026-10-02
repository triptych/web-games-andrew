// The fields: sleeping outdoors and hunting other warriors.
import { R, fmt } from '../rng.js';
import { h } from '../engine/ui.js';
import { colorize } from '../colors.js';
import * as S from '../engine/state.js';
import * as W from '../engine/world.js';
import { startFight } from '../engine/combat.js';
import { FIGHTS, leaveFight } from './fight.js';
import { titleFor } from '../data/classes.js';

export function fields(g) {
    const p = g.p;
    g.title('`2The Fields', { view: 'fields', area: 'fields' });
    g.text('Beyond the gate, the fields roll away toward the dark edge of the Gloamwood. Haystacks stand in rows, a few campfires flicker where warriors too poor or too proud for the inn are bedding down, and the stars are coming out one by one.');
    g.text('`7Sleeping here is free, but anyone can find you in the night. `$If you are carrying gold, you could wake up without it — or not wake up at all.`7 A room at the Crooked Antler is safe.');
    if (p.gold > 0) g.note(`\`QYou are carrying \`^${fmt(p.gold)}\`Q gold.`);
    if (g.w.bounties.you) g.note(`\`$There is a ${fmt(g.w.bounties.you)} gold bounty on your head!`);
    if (p.pacing === 'classic') g.note(`\`7Classic pacing: the next day dawns in ${Math.ceil(g.msToDawn() / 60000)} minutes.`);
    g.nav('The Fields', 'Bed down here for the night', async () => {
        if (p.turns > 0 && !(await g.ui.confirm('Sleep now?', `You still have ${p.turns} forest fight${p.turns === 1 ? '' : 's'} left. Sleep anyway?`, 'Sleep'))) return;
        g.sleep('fields');
    }, { key: 's', cls: 'primary' });
    g.nav('The Fields', 'Hunt other warriors', 'pvp', { key: 'h', badge: p.pvp });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

export function pvpTargets(g) {
    const p = g.p;
    const on = new Set(g.online.map((n) => n.id));
    return g.w.npcs.filter((n) => n.alive && !on.has(n.id) && n.sleep === 'fields' && n.level >= p.level - 1 && n.level <= p.level + 2 && !(p.flags.hunted || []).includes(n.id));
}

export function pvp(g) {
    const p = g.p;
    g.title('`4Hunt Other Warriors', { view: 'fields', area: 'fields' });
    g.text('You creep through the fields in the dark, from one sleeping figure to the next, looking for someone worth the trouble. Those who sleep at the inn are out of your reach — and so are those still awake and about.');
    if (p.pvp <= 0) g.text('`7You have no attacks left today.');
    else g.text(`\`7You have \`^${p.pvp}\`7 attack${p.pvp === 1 ? '' : 's'} left today. Warriors from level ${Math.max(1, p.level - 1)} to ${p.level + 2} are fair game.`);
    const t = pvpTargets(g);
    if (!t.length) g.text('`7Nobody suitable is sleeping in the fields tonight.');
    else {
        g.table(['Warrior', 'Lvl', 'Race', 'Bounty', ''], t.sort((a, b) => b.level - a.level).map((n) => {
            const b = g.button('Attack', () => attack(g, n), 'small' + (p.pvp > 0 ? ' danger' : ''));
            if (p.pvp <= 0 || !p.alive) b.disabled = true;
            return [h('button', { type: 'button', class: 'linkbtn', html: colorize(`${n.color}${W.npcFull(n)}`), onclick: () => g.showProfile(n) }), String(n.level), S.race({ race: n.race }).name, g.w.bounties[n.id] ? `\`^${fmt(g.w.bounties[n.id])}` : '—', b];
        }), 'roll');
    }
    g.nav('Leave', 'Back to the fields', 'fields', { key: 'f' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

function attack(g, n) {
    const p = g.p;
    if (p.pvp <= 0) return;
    p.pvp--;
    (p.flags.hunted ||= []).push(n.id);
    const st = W.npcStats(n);
    const foe = { name: n.name, weapon: `their ${W.npcWeapon(n)}`, kind: 'rival', color: 0x8a7a6a, level: n.level, maxhp: st.hp, atk: st.atk, def: st.def, gold: n.gold, exp: 0, death: '', npc: n.id };
    startFight(p, 'pvp', foe, { npc: n.id });
    p.fight.intro = `\`4You find \`^${W.npcFull(n)}\`4 asleep beside a dying fire. They wake just as you draw your weapon!`;
    g.scene?.showFoe(foe);
    g.spend(30);
    return 'fight';
}

FIGHTS.pvp = {
    title: (g, f) => `\`4The Fields — ${f.foe.name}`,
    banner: () => '`4The Fields',
    view: () => 'fieldsfight',
    area: 'fight',
    canRun: false,
    win(g, f) {
        const p = g.p;
        const n = W.findNpc(g.w, f.npc);
        if (!n) return;
        const gold = n.gold; n.gold = 0; n.alive = false; n.deaths++;
        const exp = Math.min(Math.round(n.exp * 0.1), Math.round(S.nextExp(p) * 0.15) || 500);
        p.gold += gold; p.exp += exp; p.stats.pvpWins++;
        f.endLines.push(`\`@${n.name} slumps to the ground.\` \`^You take \`6${fmt(gold)}\`^ gold from their purse and gain \`#${fmt(exp)}\`^ experience.`);
        g.news(`\`%${p.name}\`3 attacked ${n.color}${n.name}\`3 in the fields and \`$slew them\`3!`);
        const b = g.w.bounties[n.id];
        if (b) { p.gold += b; delete g.w.bounties[n.id]; f.endLines.push(`\`^You also collect the \`6${fmt(b)}\`^ gold bounty on their head from Dagny!`); g.news(`\`^${p.name} collected the ${fmt(b)} gold bounty on ${n.name}!`); g.deed('bounty'); }
        g.deed('pvp1'); if (p.stats.pvpWins >= 10) g.deed('pvp10');
        g.react('pvpwin', { who: n.name });
        // revenge
        if (R.chance(0.3 + n.aggression * 0.3)) {
            const amt = R.i(2, 6) * 50 * p.level;
            g.w.bounties.you = (g.w.bounties.you || 0) + amt;
            g.news(`\`$${n.name} has placed a bounty of ${fmt(amt)} gold on ${p.name}'s head!`);
            g.mailLater(R.i(20, 60) * 1000, { from: n.name, fromId: n.id, subject: 'You\'ll regret that', body: n.pers === 'roleplayer' ? 'Thou hast slain me in my sleep, coward. My coin now marks thy head. Sleep lightly.' : `nice cheap shot. there's ${amt} gold on your head now. sleep in the fields, i dare you.` });
        } else if (R.chance(0.4)) {
            g.mailLater(R.i(20, 60) * 1000, { from: n.name, fromId: n.id, subject: 'gg', body: n.pers === 'braggart' ? 'lucky. rematch tomorrow.' : 'Fair fight. Well, mostly. I should have slept at the inn.' });
        }
    },
    lose(g, f) {
        const p = g.p;
        const n = W.findNpc(g.w, f.npc);
        const lostGold = p.gold;
        const lostExp = Math.round(p.exp * 0.05);
        if (n) { n.gold += lostGold; n.pvpWins++; }
        p.gold = 0; p.exp -= lostExp; p.hp = 0; p.alive = false; p.stats.deaths++; p.stats.pvpLosses++; p.buffs = [];
        g.news(`\`%${p.name}\`3 attacked ${n ? n.color + n.name : 'someone'}\`3 in the fields but \`@was slain\`3!`);
        g.deed('died'); g.audio?.sfx('death');
        f.endLines.push(`\`$\`b${f.foe.name} has slain you!\`b`);
        f.endLines.push(`\`4They take the \`^${fmt(lostGold)}\`4 gold you carried. You lose \`^${fmt(lostExp)}\`4 experience.`);
        g.react('pvploss', { who: f.foe.name });
    },
    after(g, f) {
        if (f.result === 'lose') return [{ label: 'Continue to the Pale Shore', action: () => leaveFight(g, 'shades'), key: 'c' }];
        return [
            { label: 'Keep hunting', action: () => leaveFight(g, 'pvp'), key: 'h' },
            { label: 'Return to Hollowmere', action: () => leaveFight(g, 'village'), key: 'r' },
        ];
    },
};
