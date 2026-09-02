/**
 * dialogueEngine.js — the generic story-graph traversal engine.
 * All actual writing lives in story.js as data; this file only knows
 * how to evaluate conditions, apply effects, and move between nodes.
 *
 * Emits 'nodeEntered' with the resolved node so vnRenderer can display it.
 *
 * Supported `requires` keys (all must pass; omit the key to skip the check):
 *   flag / negate      — a story flag is (or, with negate, is not) set
 *   allFlags: [..]     — every listed flag is set
 *   anyFlags: [..]     — at least one listed flag is set
 *   noneFlags: [..]    — none of the listed flags are set
 *   minAffinity: {npc:n}
 *   minStat: {wit:n}   — checked against effectiveStats, so equipment counts
 *   item / notItem     — an item id, or { id, count }
 *   minCoin: n
 *   minDay: n
 *   questActive / questDone — a quest id
 *   visited: nodeId    — the player has already been through that node
 *
 * Supported effect types:
 *   setFlag, addAffinity, giveItem, removeItem, giveXp,
 *   giveCoin, takeCoin, advanceDay, rest, healFull,
 *   startQuest, completeQuest, addLore, learnRecipe, openTrade
 */

import { STORY } from './story.js';
import { state } from './state.js';
import { events } from './events.js';

let k; // reserved for future canvas hookup if needed; unused for the DOM VN layer

export function initDialogueEngine() {
    // Jump to whatever node state currently points at (fresh game = 'start')
    goToNode(state.currentNodeId);
}

export function getNode(id) {
    const node = STORY[id];
    if (!node) {
        console.error(`Unknown story node: "${id}"`);
    }
    return node;
}

export function goToNode(id) {
    const node = getNode(id);
    if (!node) return;

    state.currentNodeId = id;
    applyEffects(node.effects);

    if (node.battle) {
        events.emit('battleRequested', {
            enemyId: node.battle,
            onWin: node.onWin,
            onLose: node.onLose,
        });
        return;
    }

    events.emit('nodeEntered', node);

    if (node.ending) {
        events.emit('storyEnded', node);
    }
}

export function choiceIsAvailable(choice) {
    if (!choice.requires) return true;
    const req = choice.requires;

    if (req.flag) {
        const flagIsSet = !!state.getFlag(req.flag);
        if (req.negate ? flagIsSet : !flagIsSet) return false;
    }

    if (req.allFlags && !req.allFlags.every(f => !!state.getFlag(f))) return false;
    if (req.anyFlags && !req.anyFlags.some(f => !!state.getFlag(f))) return false;
    if (req.noneFlags && req.noneFlags.some(f => !!state.getFlag(f))) return false;

    if (req.minAffinity) {
        for (const [npc, min] of Object.entries(req.minAffinity)) {
            if (state.getAffinity(npc) < min) return false;
        }
    }

    // Stat gates read effectiveStats, not base stats, so a choice can be
    // unlocked by what you're wearing as well as by what you've spent points on.
    if (req.minStat) {
        const eff = state.effectiveStats;
        for (const [stat, min] of Object.entries(req.minStat)) {
            if ((eff[stat] || 0) < min) return false;
        }
    }

    if (req.item) {
        const need = typeof req.item === 'string' ? { id: req.item, count: 1 } : req.item;
        if (!state.hasItem(need.id, need.count || 1)) return false;
    }

    if (req.notItem) {
        const avoid = typeof req.notItem === 'string' ? { id: req.notItem, count: 1 } : req.notItem;
        if (state.hasItem(avoid.id, avoid.count || 1)) return false;
    }

    if (req.minCoin !== undefined && state.coin < req.minCoin) return false;
    if (req.minDay !== undefined && state.day < req.minDay) return false;

    if (req.questActive && !state.questIsActive(req.questActive)) return false;
    if (req.questDone && !state.questIsDone(req.questDone)) return false;

    if (req.visited && !state.hasVisited(req.visited)) return false;

    return true;
}

export function selectChoice(choice) {
    applyEffects(choice.effects);
    goToNode(choice.next);
}

function applyEffects(effects) {
    if (!effects || !effects.length) return;
    for (const eff of effects) {
        switch (eff.type) {
            case 'setFlag':
                state.setFlag(eff.flag, eff.value !== undefined ? eff.value : true);
                break;
            case 'addAffinity':
                state.addAffinity(eff.npc, eff.amount);
                break;
            case 'giveItem':
                state.addItem(eff.item, eff.count || 1);
                events.emit('itemReceived', eff.item, eff.count || 1);
                break;
            case 'removeItem':
                state.removeItem(eff.item, eff.count || 1);
                break;
            case 'giveXp':
                state.addXp(eff.amount);
                break;
            case 'giveCoin':
                state.addCoin(eff.amount);
                break;
            case 'takeCoin':
                state.spendCoin(eff.amount);
                break;
            case 'advanceDay':
                state.advanceDay(eff.count || 1);
                break;
            case 'rest':
                // A night's sleep: the day advances and HP comes back full.
                state.rest();
                break;
            case 'healFull':
                state.setHp(state.stats.maxHp);
                break;
            case 'heal':
                state.setHp(state.stats.hp + (eff.amount || 0));
                break;
            case 'startQuest':
                state.startQuest(eff.quest);
                break;
            case 'completeQuest':
                state.completeQuest(eff.quest);
                break;
            case 'addLore':
                state.addLore(eff.lore);
                break;
            case 'openTrade':
                // Opens Peddler Ock's cart straight from a dialogue choice.
                events.emit('openTrade');
                break;
            case 'learnRecipe':
                // Recipes are gated by a flag named on the recipe itself
                // (see BREW_RECIPES in config.js) — this just sets it.
                state.setFlag(eff.flag, true);
                break;
            default:
                console.warn('Unknown effect type:', eff.type);
        }
    }
}
