import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, BACKGROUNDS, PORTRAITS } from '../js/story.js';
import { ITEM_DEFS, ENEMY_DEFS } from '../js/config.js';

describe('story graph integrity', () => {
    test('every choice.next target exists as a node', () => {
        for (const [id, node] of Object.entries(STORY)) {
            for (const choice of node.choices || []) {
                assert.ok(STORY[choice.next], `node "${id}" has a choice pointing to missing node "${choice.next}"`);
            }
        }
    });

    test('every onWin/onLose battle target exists as a node', () => {
        for (const [id, node] of Object.entries(STORY)) {
            if (node.onWin) assert.ok(STORY[node.onWin], `node "${id}".onWin points to missing node "${node.onWin}"`);
            if (node.onLose) assert.ok(STORY[node.onLose], `node "${id}".onLose points to missing node "${node.onLose}"`);
        }
    });

    test('every node.battle references a real enemy id', () => {
        for (const [id, node] of Object.entries(STORY)) {
            if (node.battle) {
                assert.ok(ENEMY_DEFS[node.battle], `node "${id}" battles unknown enemy "${node.battle}"`);
            }
        }
    });

    test('a node with a battle has both onWin and onLose defined', () => {
        for (const [id, node] of Object.entries(STORY)) {
            if (node.battle) {
                assert.ok(node.onWin, `battle node "${id}" is missing onWin`);
                assert.ok(node.onLose, `battle node "${id}" is missing onLose`);
            }
        }
    });

    test('every node background key resolves in BACKGROUNDS', () => {
        for (const [id, node] of Object.entries(STORY)) {
            assert.ok(BACKGROUNDS[node.background], `node "${id}" has unknown background "${node.background}"`);
        }
    });

    test('every node portrait (when set) resolves in PORTRAITS', () => {
        for (const [id, node] of Object.entries(STORY)) {
            if (node.portrait) {
                assert.ok(PORTRAITS[node.portrait], `node "${id}" has unknown portrait "${node.portrait}"`);
            }
        }
    });

    test('every giveItem/removeItem effect (node-level or choice-level) references a real item', () => {
        for (const [id, node] of Object.entries(STORY)) {
            const allEffects = [
                ...(node.effects || []),
                ...(node.choices || []).flatMap(c => c.effects || []),
            ];
            for (const eff of allEffects) {
                if (eff.type === 'giveItem' || eff.type === 'removeItem') {
                    assert.ok(ITEM_DEFS[eff.item], `node "${id}" has ${eff.type} effect referencing unknown item "${eff.item}"`);
                }
            }
        }
    });

    test('the graph is reachable from "start" (no orphaned dead-end islands from the entry point)', () => {
        // Not every node needs to be reachable from start via choices alone —
        // battle onWin/onLose transitions count as edges too.
        const visited = new Set();
        const queue = ['start'];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id) || !STORY[id]) continue;
            visited.add(id);
            const node = STORY[id];
            for (const choice of node.choices || []) queue.push(choice.next);
            if (node.onWin) queue.push(node.onWin);
            if (node.onLose) queue.push(node.onLose);
        }
        assert.ok(visited.has('end_preview'), 'end_preview should be reachable from start');
        // Phase 3 deep-wood content must be reachable too.
        assert.ok(visited.has('deep_wood_edge'), 'deep_wood_edge should be reachable from start');
        assert.ok(visited.has('thornback_boar_fight'), 'thornback_boar_fight should be reachable from start');
    });
});

describe('Phase 3 story content', () => {
    test('Mira teaches brewing and grants starter materials', () => {
        const node = STORY.mira_teaches_brewing;
        assert.ok(node, 'mira_teaches_brewing node should exist');
        const setsCanBrew = node.effects.some(e => e.type === 'setFlag' && e.flag === 'canBrew' && e.value === true);
        assert.ok(setsCanBrew, 'mira_teaches_brewing should set the canBrew flag');
    });

    test('the Thornback Boar and Deep-Wood Stalker fights use their matching enemy defs', () => {
        assert.equal(STORY.thornback_boar_fight.battle, 'thornback_boar');
        assert.equal(STORY.deep_wood_stalker_fight.battle, 'deep_wood_stalker');
    });

    test('winning the Thornback Boar fight grants thornback quills for brewing', () => {
        const gives = STORY.thornback_boar_won.effects.find(e => e.type === 'giveItem' && e.item === 'thornback_quill');
        assert.ok(gives, 'thornback_boar_won should grant thornback_quill');
        assert.ok(gives.count >= 1);
    });
});
