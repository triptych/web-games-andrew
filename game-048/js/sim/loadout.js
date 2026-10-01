/**
 * loadout.js — fold the profile (frame systems, pilot skills, equipped modules)
 * into one flat record the combat sim reads. This is the single place where
 * "mech upgrades change the slot machine" happens.
 */

import { SYMBOLS } from './symbols.js';
import { powerMult, hullAt, buildLines } from './mech.js';
import { cascades, expandChance, mirrorMult, modStat } from './mods.js';

export function equippedMods(profile) {
    return profile.equipped.map((uid) => profile.mods.find((m) => m.uid === uid)).filter(Boolean);
}

export function deriveLoadout(profile) {
    const m = profile.mech;
    const sk = profile.pilot.skills;
    const s = (id) => sk[id] ?? 0;
    const mods = equippedMods(profile);
    const ml = {};
    const stat = {};
    for (const mod of mods) {
        ml[mod.id] = Math.max(ml[mod.id] ?? 0, mod.lv);
        stat[mod.stat] = (stat[mod.stat] ?? 0) + modStat(mod);
    }
    const st = (k) => (stat[k] ?? 0) / 100;

    const cols = m.reels + 2;
    const rows = m.matrix >= 4 ? 4 : 3;
    const lines = buildLines(cols, rows, m.matrix);

    const atk = 1 + 0.08 * s('g_disc');
    const ord = 0.15 * s('g_ord');
    const power = {
        blade: SYMBOLS.blade.base * powerMult(m.blade) * (atk + st('blade')),
        cannon: SYMBOLS.cannon.base * powerMult(m.cannon) * (atk + st('cannon')),
        missile: SYMBOLS.missile.base * powerMult(m.missile) * (atk + ord + st('missile')),
        arc: SYMBOLS.arc.base * powerMult(m.arc) * (atk + ord + st('arc')),
        shield: SYMBOLS.shield.base * powerMult(m.shield) * (1 + 0.15 * s('d_defl') + st('shield')),
        repair: SYMBOLS.repair.base * powerMult(m.repair) * (1 + 0.2 * s('d_medic') + st('repair')),
        energy: 1,
        scrap: SYMBOLS.scrap.base * (ml.claw ? 1 + ml.claw * 0.5 : 1),
    };

    // Strip composition: what the Probability Engine writes onto every reel.
    const weights = {
        blade: 5, cannon: 4, shield: 3, repair: 2, energy: 2, scrap: 2,
        missile: m.missile ? 3 : 0,
        arc: m.arc ? 3 : 0,
        wild: m.core + s('l_charm'),
        core: 1 + Math.floor(m.core / 3) + s('l_sense') + (ml.magnet ? Math.ceil(ml.magnet / 2) : 0),
    };

    const maxHp = Math.round(hullAt(m.armor) * (1 + 0.1 * s('d_frame') + st('hp')));
    const maxEnergy = 2 + m.reactor + (ml.capacitor ? Math.ceil(ml.capacitor / 2) : 0);

    return {
        cols, rows, lines, weights, power, maxHp, maxEnergy,
        regen: m.reactor >= 4 ? 2 : 1,
        startFull: !!ml.capacitor,
        freeNudges: (m.servos >= 2 ? 1 : 0) + (m.servos >= 4 ? 1 : 0) + s('l_hands'),
        nudgeCost: 1,
        respinCost: m.servos >= 3 ? 1 : 2,
        holdCost: m.servos >= 5 ? 0 : 1,
        purgeCost: 2,
        crit: 0.05 + 0.05 * s('g_crit') + (ml.daemon ? 0.04 * ml.daemon : 0) + st('crit'),
        chainStep: s('g_storm') ? 0.5 : 0.25,
        focus: s('g_focus') ? 1.5 + 0.25 * (s('g_focus') - 1) : 1,
        hot: 0.2 * s('g_hot'),
        spree: s('g_spree') > 0,
        overkill: s('g_over') > 0,
        memory: s('d_memory') > 0,
        thorns: 0.25 * s('d_thorns') + (ml.thorns ? (20 + 10 * ml.thorns) / 100 : 0),
        emergency: s('d_emerg') > 0,
        hardened: 0.06 * s('d_hard'),
        bastion: s('d_bastion') > 0,
        medic: 0.04 * s('d_medic'),
        nearMiss: s('l_near') > 0,
        streak: 0.08 * s('l_streak'),
        wildAmp: s('l_amp') ? 1.5 + 0.25 * (s('l_amp') - 1) : 1,
        overdriveSpins: 3 + s('l_double'),
        overdriveMult: s('l_house') ? 3 : 2,
        jackpotAt: s('l_house') ? 4 : 5,
        scrapMult: 1 + st('scrap'),
        mods: {
            cascade: ml.cascade ? cascades(ml.cascade) : 0,
            expand: ml.expand ? expandChance(ml.expand) / 100 : 0,
            sticky: ml.sticky ? (ml.sticky >= 4 ? 2 : 1) : 0,
            mirror: ml.mirror ? mirrorMult(ml.mirror) : 0,
            conductor: ml.conductor ? 1 + Math.ceil(ml.conductor / 2) : 0,
            eater: ml.eater ?? 0,
            twin: ml.twin ? 0.4 + 0.1 * ml.twin : 0,
            splitter: ml.splitter ? { n: Math.ceil(ml.splitter / 3), pct: 0.5 + 0.05 * ml.splitter } : null,
            overheat: ml.overheat ? 4 + 2 * ml.overheat : 0,
            cluster: ml.cluster ? (ml.cluster >= 5 ? 4 : 5) : 0,
            seventh: ml.seventh ? 2 + 0.5 * ml.seventh : 0,
            echo: ml.echo ? 0.25 + 0.1 * ml.echo : 0,
            leech: ml.leech ? (2 + ml.leech) / 100 : 0,
        },
    };
}
