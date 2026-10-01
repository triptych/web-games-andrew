/**
 * skilltext.js — readable descriptions generated from skill templates, so
 * the text always matches what the battle sim actually does.
 */

import { STATUS, STAT_NAME } from '../data/core.js';

const P = (v) => Math.round(v * 100) + '%';
const st = (id) => STATUS[id].name;
const turns = (d) => `${d} turn${d > 1 ? 's' : ''}`;

function scaling(m, mult) {
    const parts = [];
    if (m.atk) parts.push(`${P(m.atk * mult)} ATK`);
    if (m.def) parts.push(`${P(m.def * mult)} DEF`);
    if (m.hp) parts.push(`${P(m.hp * mult)} of max HP`);
    if (m.spd) parts.push(`${Math.round(m.spd * mult * 100) / 100}× SPD`);
    return parts.join(' + ');
}

export function skillDescription(tpl, lvl = 1) {
    if (tpl.kind === 'passive') return passiveDescription(tpl.p, lvl);
    const mult = 1 + 0.06 * (lvl - 1);
    const lines = [];
    if (tpl.m) {
        const sc = scaling(tpl.m, mult);
        if (tpl.tgt === 'enemies') lines.push(`Deals ${sc} damage to all enemies.`);
        else if (tpl.tgt === 'random') lines.push(`Strikes random enemies ${tpl.hits} times for ${sc} each.`);
        else if (tpl.hits > 1) lines.push(`Hits an enemy ${tpl.hits} times for ${sc} each.`);
        else lines.push(`Deals ${sc} damage to an enemy.`);
    }
    const lv = 1 + 0.05 * (lvl - 1);
    for (const e of tpl.eff || []) {
        switch (e.t) {
            case 'debuff': lines.push(`${P(Math.min(1, e.c * lv))} chance to inflict ${st(e.s)} for ${turns(e.d)}.`); break;
            case 'buff': lines.push(`Grants ${st(e.s)} to ${e.to === 'self' ? 'itself' : 'all allies'} for ${turns(e.d)}.`); break;
            case 'heal': lines.push(`Heals ${e.to === 'allies' ? 'all allies' : e.to === 'lowest' ? 'the weakest ally' : 'itself'} for ${P(e.p * lv)} of their max HP.`); break;
            case 'shield': lines.push(`Shields ${e.to === 'allies' ? 'all allies' : 'itself'} for ${P(e.p * lv)} of its max HP for ${turns(e.d)}.`); break;
            case 'atb': lines.push(`Fills ${e.to === 'self' ? 'its own' : "all allies'"} attack bar by ${P(e.v * lv)}.`); break;
            case 'atbDown': lines.push(`${P(Math.min(1, e.c * lv))} chance to drain the target's attack bar by ${P(e.v)}.`); break;
            case 'cleanse': lines.push(`Removes ${e.n} harmful effect${e.n > 1 ? 's' : ''} from ${e.to === 'allies' ? 'each ally' : 'itself'}.`); break;
            case 'strip': lines.push(`${P(e.c)} chance to remove ${e.n} beneficial effect${e.n > 1 ? 's' : ''} from the target.`); break;
            case 'revive': lines.push(`Revives a fallen ally with ${P(e.p)} HP.`); break;
            case 'lifesteal': lines.push(`Heals for ${P(e.p)} of damage dealt.`); break;
            case 'extra': lines.push(e.onKill ? `Gains another turn if it defeats an enemy.` : `${P(e.c)} chance to gain another turn.`); break;
            case 'bonus': lines.push({ debuffed: `+${P(e.v)} damage against targets with harmful effects.`, lowHp: `Up to +${P(e.v)} damage the lower the target's HP.`, perDebuff: `+${P(e.v)} damage per harmful effect on the target.`, boss: `+${P(e.v)} damage to bosses.` }[e.cond] || ''); break;
            case 'pierce': lines.push(`Ignores ${P(e.v)} of the target's DEF.`); break;
            default: break;
        }
    }
    const cd = tpl.cd ? Math.max(0, tpl.cd - (lvl >= 5 ? 1 : 0)) : 0;
    if (cd) lines.push(`Cooldown: ${turns(cd)}.`);
    return lines.join(' ');
}

export function passiveDescription(p, lvl = 1) {
    const v = p.v * (1 + 0.15 * (lvl - 1));
    switch (p.type) {
        case 'stat': return p.stat === 'spd' ? `+${Math.round(v)} SPD.` : `+${P(v)} ${STAT_NAME[p.stat.replace('P', '')] || p.stat}.`;
        case 'teamStat': return p.stat === 'spd' ? `Allies gain +${Math.round(v)} SPD.` : `Allies gain +${P(v)} ${STAT_NAME[p.stat.replace('P', '')] || p.stat}.`;
        case 'reduceDmg': return `Takes ${P(v)} less damage.`;
        case 'counter': return `${P(v)} chance to counterattack when hit.`;
        case 'lowHpAtk': return `+${P(v)} ATK while below half HP.`;
        case 'lifesteal': return `Heals for ${P(v)} of damage dealt.`;
        case 'revenge': return `When an ally falls, gains ${P(v)} attack bar and ATK Up.`;
        case 'critAtb': return `Critical hits fill its attack bar by ${P(v)}.`;
        case 'execute': return `+${P(v)} damage to enemies below 35% HP.`;
        case 'onHitDebuff': return `Attacks have a ${P(p.c)} chance to inflict ${st(p.s)}.`;
        case 'firstStrike': return `Starts every wave with ${P(v)} attack bar.`;
        case 'healBoost': return `Healing done +${P(v)}.`;
        case 'cleanseTurn': return `${P(v)} chance to shake off a harmful effect each turn.`;
        case 'turnHeal': return `Recovers ${P(v)} HP each turn.`;
        case 'thorns': return `Reflects ${P(v)} of damage taken.`;
        case 'onKillHeal': return `Heals ${P(v)} HP after defeating an enemy.`;
        default: return '';
    }
}
