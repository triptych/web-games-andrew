import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
}

const { state } = await import('../js/state.js');
const { events } = await import('../js/events.js');
const { choiceIsAvailable, selectChoice, goToNode } = await import('../js/dialogueEngine.js');

beforeEach(() => {
    state.reset();
    events.clearAll();
});

describe('choiceIsAvailable', () => {
    test('a choice with no requirements is always available', () => {
        assert.equal(choiceIsAvailable({ requires: null }), true);
    });

    test('flag requirement: unavailable until the flag is set', () => {
        const choice = { requires: { flag: 'metBramwell' } };
        assert.equal(choiceIsAvailable(choice), false);
        state.setFlag('metBramwell', true);
        assert.equal(choiceIsAvailable(choice), true);
    });

    test('negated flag requirement: available only while the flag is unset', () => {
        const choice = { requires: { flag: 'calledTheWatch', negate: true } };
        assert.equal(choiceIsAvailable(choice), true);
        state.setFlag('calledTheWatch', true);
        assert.equal(choiceIsAvailable(choice), false);
    });

    test('minAffinity requirement gates on the numeric threshold', () => {
        const choice = { requires: { minAffinity: { hollow: 3 } } };
        state.addAffinity('hollow', 2);
        assert.equal(choiceIsAvailable(choice), false);
        state.addAffinity('hollow', 1);
        assert.equal(choiceIsAvailable(choice), true);
    });

    test('item requirement (string shorthand) checks possession', () => {
        const choice = { requires: { item: 'cellar_key' } };
        assert.equal(choiceIsAvailable(choice), false);
        state.addItem('cellar_key', 1);
        assert.equal(choiceIsAvailable(choice), true);
    });

    test('item requirement (object form) checks the exact count', () => {
        // Player starts with 3 Dried Mintleaf (STARTING_INVENTORY) — strip it
        // so this test controls the exact count from zero.
        state.removeItem('dried_mintleaf', 3);
        const choice = { requires: { item: { id: 'dried_mintleaf', count: 3 } } };
        state.addItem('dried_mintleaf', 2);
        assert.equal(choiceIsAvailable(choice), false);
        state.addItem('dried_mintleaf', 1);
        assert.equal(choiceIsAvailable(choice), true);
    });
});

describe('goToNode / selectChoice traversal', () => {
    test('goToNode updates state.currentNodeId and emits nodeEntered for non-battle nodes', () => {
        let entered = null;
        events.on('nodeEntered', (node) => { entered = node; });
        goToNode('start');
        assert.equal(state.currentNodeId, 'start');
        assert.ok(entered, 'nodeEntered should have fired');
    });

    test('goToNode on a battle node emits battleRequested instead of nodeEntered', () => {
        let battleReq = null;
        let entered = false;
        events.on('battleRequested', (payload) => { battleReq = payload; });
        events.on('nodeEntered', () => { entered = true; });
        goToNode('cellar_slime_fight');
        assert.deepEqual(battleReq, { enemyId: 'cellar_slime', onWin: 'cellar_slime_won', onLose: 'cellar_slime_lost' });
        assert.equal(entered, false);
    });

    test('goToNode on an ending node emits storyEnded after nodeEntered', () => {
        let order = [];
        events.on('nodeEntered', () => order.push('nodeEntered'));
        events.on('storyEnded', () => order.push('storyEnded'));
        goToNode('ending_triumphant');
        assert.deepEqual(order, ['nodeEntered', 'storyEnded']);
    });

    test('selectChoice applies the choice’s effects before moving to the next node', () => {
        state.currentNodeId = 'mira_intro';
        const choice = {
            label: 'test',
            next: 'mira_grateful',
            requires: null,
            effects: [{ type: 'addAffinity', npc: 'mira', amount: 2 }],
        };
        selectChoice(choice);
        assert.equal(state.getAffinity('mira'), 2);
        assert.equal(state.currentNodeId, 'mira_grateful');
    });

    test('node-level effects apply automatically on entry (e.g. giveXp on mira_thanks)', () => {
        goToNode('mira_thanks');
        assert.ok(state.stats.xp > 0, 'entering mira_thanks should grant XP via its node-level effect');
    });

    test('an unknown node id is a no-op (does not throw, does not change state)', () => {
        const before = state.currentNodeId;
        assert.doesNotThrow(() => goToNode('totally_bogus_node_id'));
        assert.equal(state.currentNodeId, before);
    });
});
