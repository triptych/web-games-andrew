/**
 * dialogueEngine.js — the generic story-graph traversal engine.
 * All actual writing lives in story.js as data; this file only knows
 * how to evaluate conditions, apply effects, and move between nodes.
 *
 * Emits 'nodeEntered' with the resolved node so vnRenderer can display it.
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

    if (req.minAffinity) {
        for (const [npc, min] of Object.entries(req.minAffinity)) {
            if (state.getAffinity(npc) < min) return false;
        }
    }

    if (req.item) {
        const need = typeof req.item === 'string' ? { id: req.item, count: 1 } : req.item;
        if (!state.hasItem(need.id, need.count || 1)) return false;
    }

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
            default:
                console.warn('Unknown effect type:', eff.type);
        }
    }
}
