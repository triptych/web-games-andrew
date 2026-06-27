/**
 * skilltree.js — Passive power-up node graph (game-plan §10).
 *
 * Three branches:
 *   Efficiency — Tile Swap, Steady Hand, Catalyst Affinity
 *   Insight    — Deep Sight, Surveyor, Vein Sense
 *   Power      — Surge, Overflow, Reclaim
 *
 * Each node: { id, name, glyph, desc, flavor, branch, xpCost, prereqs[], type }
 *   type: 'always-on' | 'activated'
 *   For 'activated': cooldown (# placements before usable again), targetType ('cell'|'shape'|'none')
 *
 * API:
 *   SKILL_DEFS             — array of all skill node definitions
 *   isUnlocked(id)         — true if skill has been unlocked
 *   canUnlock(id)          — true if prereqs met and XP sufficient
 *   unlock(id)             — spend XP, mark unlocked, emit skillUnlocked
 *   getActivated()         — array of activated-type skills that are unlocked
 *   tickCooldown(skillId)  — decrement cooldown by 1; emits passiveCooldownChanged
 *   resetCooldown(skillId) — set to full cooldown (called on use)
 *   isReady(skillId)       — true if cooldown === 0
 *   getCooldown(skillId)   — remaining placements before ready
 */

import { events } from './events.js';
import { state }  from './state.js';

export const SKILL_DEFS = [
    // ─── Efficiency branch ────────────────────────────────────────────────────
    {
        id:       'tile_swap',
        name:     'Tile Swap',
        glyph:    '⇄',
        branch:   'efficiency',
        desc:     'Swap a held tray shape\'s ingredient type with another unlocked type.',
        flavor:   '"A little transmutation never hurt anyone."',
        xpCost:   80,
        prereqs:  [],
        type:     'activated',
        cooldown: 6,         // placements before usable again
        targetType: 'shape',
    },
    {
        id:       'steady_hand',
        name:     'Steady Hand',
        glyph:    '✋',
        branch:   'efficiency',
        desc:     'Every 5th set dealt is guaranteed to contain at least one 1-cell or 2-cell tile.',
        flavor:   '"Patience shapes the perfect form."',
        xpCost:   120,
        prereqs:  ['tile_swap'],
        type:     'always-on',
    },
    {
        id:       'catalyst_affinity',
        name:     'Catalyst Affinity',
        glyph:    '♺',
        branch:   'efficiency',
        desc:     'Catalyst consumable cooldown is reduced by 2 placements.',
        flavor:   '"Speed is the other half of precision."',
        xpCost:   150,
        prereqs:  ['tile_swap'],
        type:     'always-on',
    },

    // ─── Insight branch ───────────────────────────────────────────────────────
    {
        id:       'deep_sight',
        name:     'Deep Sight',
        glyph:    '👁',
        branch:   'insight',
        desc:     'See a deposit\'s hidden ingredient before harvest.',
        flavor:   '"The lattice hides nothing from a trained eye."',
        xpCost:   100,
        prereqs:  [],
        type:     'always-on',
    },
    {
        id:       'surveyor',
        name:     'Surveyor',
        glyph:    '🔭',
        branch:   'insight',
        desc:     'Preview the next set of 3 shapes before the current set is fully placed.',
        flavor:   '"Plan two moves ahead, lose none to chance."',
        xpCost:   160,
        prereqs:  ['deep_sight'],
        type:     'always-on',
    },
    {
        id:       'vein_sense',
        name:     'Vein Sense',
        glyph:    '✨',
        branch:   'insight',
        desc:     'Deposits glow when exactly one line-clear away from full harvest.',
        flavor:   '"You feel the vein before you see it."',
        xpCost:   130,
        prereqs:  ['deep_sight'],
        type:     'always-on',
    },

    // ─── Power branch ─────────────────────────────────────────────────────────
    {
        id:       'surge',
        name:     'Surge',
        glyph:    '⚡',
        branch:   'power',
        desc:     'Each combo clear grants +5 bonus XP on top of normal XP.',
        flavor:   '"Power follows intention."',
        xpCost:   90,
        prereqs:  [],
        type:     'always-on',
    },
    {
        id:       'overflow',
        name:     'Overflow',
        glyph:    '◎',
        branch:   'power',
        desc:     'Clearing 3+ lines in one placement grants a bonus +20 score per extra line.',
        flavor:   '"Let it spill — there is always more."',
        xpCost:   140,
        prereqs:  ['surge'],
        type:     'always-on',
    },
    {
        id:       'reclaim',
        name:     'Reclaim',
        glyph:    '↺',
        branch:   'power',
        desc:     'Once per level, activate to refund the current tray set back to the supply.',
        flavor:   '"Nothing is truly spent. Only transformed."',
        xpCost:   200,
        prereqs:  ['surge'],
        type:     'activated',
        cooldown: 0,         // 0 = once per level (resets at level start, does not tick down)
        targetType: 'none',
        oncePerLevel: true,
    },
];

// Quick lookup map
const SKILL_MAP = new Map(SKILL_DEFS.map(s => [s.id, s]));

// ── Cooldown tracker (in-memory, resets each level) ──────────────────────────
// skillId → remaining placements (0 = ready)
const _cooldowns = new Map();

function _initCooldowns() {
    for (const skill of SKILL_DEFS) {
        if (skill.type === 'activated') {
            _cooldowns.set(skill.id, 0); // start ready
        }
    }
}
_initCooldowns();

// ── Public API ────────────────────────────────────────────────────────────────

/** Reset activated-skill cooldowns at level start (ready from turn 1). */
export function resetAllCooldowns() {
    for (const skill of SKILL_DEFS) {
        if (skill.type === 'activated') {
            _cooldowns.set(skill.id, 0);
        }
    }
}

/** Is skillId unlocked by the player? Delegates to state._unlockedSkills. */
export function isUnlocked(skillId) {
    return state.isSkillUnlocked(skillId);
}

/**
 * Can the player unlock skillId right now?
 * Prereqs must all be unlocked AND player must have enough XP.
 */
export function canUnlock(skillId) {
    const def = SKILL_MAP.get(skillId);
    if (!def) return false;
    if (isUnlocked(skillId)) return false;
    if (state.xp < def.xpCost) return false;
    return def.prereqs.every(pid => isUnlocked(pid));
}

/**
 * Unlock a skill: spend XP, mark in state, emit events.
 * Returns true on success.
 */
export function unlock(skillId) {
    if (!canUnlock(skillId)) return false;
    const def = SKILL_MAP.get(skillId);
    state.spendXP(def.xpCost);
    state.unlockSkill(skillId);
    events.emit('skillUnlocked', { skillId, xpSpent: def.xpCost });
    return true;
}

/** Array of activated-type skills the player has unlocked. */
export function getActivated() {
    return SKILL_DEFS.filter(s => s.type === 'activated' && isUnlocked(s.id));
}

/** Array of always-on skills the player has unlocked. */
export function getAlwaysOn() {
    return SKILL_DEFS.filter(s => s.type === 'always-on' && isUnlocked(s.id));
}

/** True if the activated skill is ready to use (cooldown === 0). */
export function isReady(skillId) {
    return (_cooldowns.get(skillId) || 0) === 0;
}

/** Remaining placements before skillId is usable. */
export function getCooldown(skillId) {
    return _cooldowns.get(skillId) || 0;
}

/**
 * Called after each placement; ticks down all active cooldowns by 1.
 * Emits passiveCooldownChanged for each skill whose cooldown changed.
 */
export function tickCooldowns() {
    for (const skill of getActivated()) {
        if (skill.oncePerLevel) continue; // once-per-level don't tick
        const cur = _cooldowns.get(skill.id) || 0;
        if (cur > 0) {
            const next = cur - 1;
            _cooldowns.set(skill.id, next);
            events.emit('passiveCooldownChanged', { skillId: skill.id, remaining: next });
            if (next === 0) {
                events.emit('passiveReady', { skillId: skill.id });
            }
        }
    }
}

/**
 * Start the cooldown for a skill (called immediately after it is used).
 * For oncePerLevel skills, sets to Infinity so they never become ready again this level.
 */
export function startCooldown(skillId) {
    const def = SKILL_MAP.get(skillId);
    if (!def) return;
    const cd = def.oncePerLevel ? Infinity : def.cooldown;
    _cooldowns.set(skillId, cd);
    events.emit('passiveCooldownChanged', { skillId, remaining: cd });
}

/** Get a skill def by id. */
export function getSkillDef(skillId) {
    return SKILL_MAP.get(skillId) || null;
}
