/**
 * phase6.test.js — the Phase 6 season: coin, days, quests, lore, the
 * expanded requires/effects vocabulary, and the integrity of the much
 * larger story graph (chapter modules, 13 endings, re-enterable hubs).
 */
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
const { choiceIsAvailable, selectChoice } = await import('../js/dialogueEngine.js');
const { STORY, BACKGROUNDS, PORTRAITS } = await import('../js/story.js');
const {
    ITEM_DEFS, BREW_RECIPES, QUEST_DEFS, LORE_DEFS, TRADE_STOCK,
    buyPrice, sellPrice, recipeIsKnown, STARTING_DAY,
} = await import('../js/config.js');

beforeEach(() => {
    state.reset();
    events.clearAll();
    globalThis.localStorage.clear();
});

// ============================================================
// State: coin, days, quests, lore
// ============================================================
describe('coin', () => {
    test('starts at the configured amount and can be added to', () => {
        const start = state.coin;
        state.addCoin(10);
        assert.equal(state.coin, start + 10);
    });

    test('spendCoin fails and changes nothing when short', () => {
        state.addCoin(-state.coin); // empty the purse
        assert.equal(state.spendCoin(5), false);
        assert.equal(state.coin, 0);
    });

    test('spendCoin succeeds and deducts when affordable', () => {
        state.addCoin(-state.coin);
        state.addCoin(20);
        assert.equal(state.spendCoin(12), true);
        assert.equal(state.coin, 8);
    });

    test('coin never goes negative', () => {
        state.addCoin(-9999);
        assert.equal(state.coin, 0);
    });

    test('emits coinChanged', () => {
        let seen = null;
        events.on('coinChanged', v => { seen = v; });
        state.addCoin(3);
        assert.equal(seen, state.coin);
    });
});

describe('days and rest', () => {
    test('the season starts on the configured day', () => {
        assert.equal(state.day, STARTING_DAY);
    });

    test('advanceDay moves the day on and emits dayChanged', () => {
        let seen = null;
        events.on('dayChanged', v => { seen = v; });
        state.advanceDay();
        assert.equal(state.day, STARTING_DAY + 1);
        assert.equal(seen, state.day);
    });

    test('rest advances a day and restores HP to full', () => {
        state.setHp(3);
        state.rest();
        assert.equal(state.day, STARTING_DAY + 1);
        assert.equal(state.stats.hp, state.stats.maxHp);
    });
});

describe('quests', () => {
    test('startQuest marks a quest active, once', () => {
        assert.equal(state.startQuest('q_ward'), true);
        assert.equal(state.questIsActive('q_ward'), true);
        assert.equal(state.startQuest('q_ward'), false);
    });

    test('completeQuest moves it to done and it stops being active', () => {
        state.startQuest('q_ward');
        state.completeQuest('q_ward');
        assert.equal(state.questIsActive('q_ward'), false);
        assert.equal(state.questIsDone('q_ward'), true);
    });

    test('a completed quest cannot be restarted', () => {
        state.startQuest('q_ward');
        state.completeQuest('q_ward');
        assert.equal(state.startQuest('q_ward'), false);
        assert.equal(state.questIsDone('q_ward'), true);
    });

    test('activeQuestCount counts only open quests', () => {
        state.startQuest('q_ward');
        state.startQuest('q_ember');
        state.completeQuest('q_ember');
        assert.equal(state.activeQuestCount, 1);
    });
});

describe('lore', () => {
    test('addLore collects an entry once and preserves order', () => {
        state.addLore('lore_hearthstone');
        state.addLore('lore_unbinding');
        assert.equal(state.addLore('lore_hearthstone'), false);
        assert.deepEqual(state.lore, ['lore_hearthstone', 'lore_unbinding']);
    });
});

describe('save/load round-trips the Phase 6 fields', () => {
    test('day, coin, quests and lore all survive a save and load', () => {
        state.advanceDay(4);
        state.addCoin(37);
        state.startQuest('q_ward');
        state.completeQuest('q_ember');
        state.addLore('lore_thorn');
        const coin = state.coin;
        state.save();

        state.reset();
        assert.equal(state.day, STARTING_DAY);

        state.load();
        assert.equal(state.day, STARTING_DAY + 4);
        assert.equal(state.coin, coin);
        assert.equal(state.questIsActive('q_ward'), true);
        assert.equal(state.questIsDone('q_ember'), true);
        assert.ok(state.hasLore('lore_thorn'));
    });

    test('an old save with no Phase 6 fields still loads', () => {
        globalThis.localStorage.setItem('hearthbound-save-v1', JSON.stringify({
            stats: { ...state.stats }, inventory: [], equipped: {},
            flags: {}, affinity: {}, currentNodeId: 'start', visitedNodes: [],
        }));
        assert.equal(state.load(), true);
        assert.equal(state.day, STARTING_DAY);
        assert.deepEqual(state.quests, {});
        assert.deepEqual(state.lore, []);
    });
});

// ============================================================
// Recipe gating
// ============================================================
describe('recipe knowledge gating', () => {
    test('a recipe with no flag is known from the start', () => {
        assert.equal(state.knowsRecipe('vigor_draught'), true);
    });

    test('a flagged recipe is unknown until the story teaches it', () => {
        assert.equal(state.knowsRecipe('hearthbound_tea'), false);
        state.setFlag('knowsHearthboundTea', true);
        assert.equal(state.knowsRecipe('hearthbound_tea'), true);
    });

    test('canBrew and brew both refuse an untaught recipe even with the materials', () => {
        state.addItem('dried_mintleaf', 5);
        state.addItem('beeswax', 5);
        assert.equal(state.canBrew('burn_salve'), false);
        assert.equal(state.brew('burn_salve'), false);
        assert.equal(state.hasItem('burn_salve'), false);

        state.setFlag('knowsBurnSalve', true);
        assert.equal(state.canBrew('burn_salve'), true);
        assert.equal(state.brew('burn_salve'), true);
        assert.equal(state.hasItem('burn_salve'), true);
    });

    test('recipeIsKnown matches state.knowsRecipe', () => {
        assert.equal(recipeIsKnown('hearthbound_tea', () => false), false);
        assert.equal(recipeIsKnown('hearthbound_tea', () => true), true);
        assert.equal(recipeIsKnown('vigor_draught', () => false), true);
    });
});

// ============================================================
// Trading prices
// ============================================================
describe('trade pricing', () => {
    test('sell price is half the buy price, floored, never below 1', () => {
        for (const id of Object.keys(ITEM_DEFS)) {
            const buy = buyPrice(id);
            if (buy == null) continue;
            assert.equal(sellPrice(id), Math.max(1, Math.floor(buy * 0.5)), id);
            assert.ok(sellPrice(id) >= 1, id);
        }
    });

    test('items with no trade value are not tradeable', () => {
        assert.equal(buyPrice('wisteria_journal'), null);
        assert.equal(sellPrice('cellar_key'), null);
    });

    test('every entry in the peddler stock is a real, priced item', () => {
        for (const entry of TRADE_STOCK) {
            assert.ok(ITEM_DEFS[entry.item], `stock references unknown item "${entry.item}"`);
            assert.ok(buyPrice(entry.item) > 0, `stock item "${entry.item}" has no price`);
        }
    });
});

// ============================================================
// The expanded requires/effects vocabulary
// ============================================================
describe('choiceIsAvailable — Phase 6 gates', () => {
    test('minStat reads effectiveStats, so equipment can unlock a choice', () => {
        const choice = { requires: { minStat: { wit: 5 } } };
        assert.equal(choiceIsAvailable(choice), false);
        state.addItem('silver_thimble', 1);   // +2 Wit
        state.equip('trinket', 'silver_thimble');
        assert.equal(choiceIsAvailable(choice), true);
    });

    test('minCoin gates on the purse', () => {
        state.addCoin(-state.coin);
        assert.equal(choiceIsAvailable({ requires: { minCoin: 40 } }), false);
        state.addCoin(40);
        assert.equal(choiceIsAvailable({ requires: { minCoin: 40 } }), true);
    });

    test('minDay gates on the day counter', () => {
        assert.equal(choiceIsAvailable({ requires: { minDay: 3 } }), false);
        state.advanceDay(2);
        assert.equal(choiceIsAvailable({ requires: { minDay: 3 } }), true);
    });

    test('questActive and questDone are distinct gates', () => {
        const active = { requires: { questActive: 'q_ward' } };
        const done = { requires: { questDone: 'q_ward' } };
        assert.equal(choiceIsAvailable(active), false);
        state.startQuest('q_ward');
        assert.equal(choiceIsAvailable(active), true);
        assert.equal(choiceIsAvailable(done), false);
        state.completeQuest('q_ward');
        assert.equal(choiceIsAvailable(active), false);
        assert.equal(choiceIsAvailable(done), true);
    });

    test('allFlags / anyFlags / noneFlags', () => {
        state.setFlag('a', true);
        assert.equal(choiceIsAvailable({ requires: { allFlags: ['a', 'b'] } }), false);
        assert.equal(choiceIsAvailable({ requires: { anyFlags: ['a', 'b'] } }), true);
        assert.equal(choiceIsAvailable({ requires: { noneFlags: ['a', 'b'] } }), false);
        assert.equal(choiceIsAvailable({ requires: { noneFlags: ['b', 'c'] } }), true);
        state.setFlag('b', true);
        assert.equal(choiceIsAvailable({ requires: { allFlags: ['a', 'b'] } }), true);
    });

    test('notItem hides a choice once you are carrying the thing', () => {
        const choice = { requires: { notItem: 'cellar_key' } };
        assert.equal(choiceIsAvailable(choice), true);
        state.addItem('cellar_key', 1);
        assert.equal(choiceIsAvailable(choice), false);
    });

    test('visited gates on having been through a node', () => {
        const choice = { requires: { visited: 'deep_wood_edge' } };
        assert.equal(choiceIsAvailable(choice), false);
        state.currentNodeId = 'deep_wood_edge';
        assert.equal(choiceIsAvailable(choice), true);
    });
});

describe('Phase 6 effects', () => {
    test('coin, day, quest, lore and recipe effects all apply through selectChoice', () => {
        state.addCoin(-state.coin);
        selectChoice({
            next: 'start',
            effects: [
                { type: 'giveCoin', amount: 25 },
                { type: 'takeCoin', amount: 5 },
                { type: 'advanceDay', count: 2 },
                { type: 'startQuest', quest: 'q_ward' },
                { type: 'completeQuest', quest: 'q_ember' },
                { type: 'addLore', lore: 'lore_thorn' },
                { type: 'learnRecipe', flag: 'knowsCordial' },
            ],
        });
        assert.equal(state.coin, 20);
        assert.equal(state.day, STARTING_DAY + 2);
        assert.equal(state.questIsActive('q_ward'), true);
        assert.equal(state.questIsDone('q_ember'), true);
        assert.ok(state.hasLore('lore_thorn'));
        assert.equal(state.knowsRecipe('deepwood_cordial'), true);
    });

    test('the rest effect heals and advances the day', () => {
        state.setHp(1);
        selectChoice({ next: 'start', effects: [ { type: 'rest' } ] });
        assert.equal(state.stats.hp, state.stats.maxHp);
        assert.equal(state.day, STARTING_DAY + 1);
    });
});

// ============================================================
// The bigger graph
// ============================================================
describe('Phase 6 story graph', () => {
    const reachable = (() => {
        const seen = new Set();
        const queue = ['start'];
        while (queue.length) {
            const id = queue.shift();
            if (seen.has(id) || !STORY[id]) continue;
            seen.add(id);
            const node = STORY[id];
            for (const c of node.choices || []) queue.push(c.next);
            if (node.onWin) queue.push(node.onWin);
            if (node.onLose) queue.push(node.onLose);
        }
        return seen;
    })();

    const endingIds = Object.keys(STORY).filter(id => STORY[id].ending);

    test('every node in the merged graph is reachable from start', () => {
        const orphans = Object.keys(STORY).filter(id => !reachable.has(id));
        assert.deepEqual(orphans, [], `unreachable nodes: ${orphans.join(', ')}`);
    });

    test('no node is a dead end — everything offers a choice, a battle, or an ending', () => {
        const dead = Object.keys(STORY).filter(id => {
            const n = STORY[id];
            return !n.ending && !n.battle && !(n.choices || []).length;
        });
        assert.deepEqual(dead, [], `dead-end nodes: ${dead.join(', ')}`);
    });

    test('all thirteen endings exist, are terminal, and are reachable', () => {
        assert.equal(endingIds.length, 13);
        for (const id of endingIds) {
            assert.equal(STORY[id].ending, true, id);
            assert.equal((STORY[id].choices || []).length, 0, id);
            assert.ok(reachable.has(id), `${id} is unreachable`);
        }
    });

    test('the Phase 4 endings all survived as early outs', () => {
        for (const id of ['ending_cold', 'ending_humbled_wolf', 'ending_cautious',
                          'ending_triumphant', 'ending_bested']) {
            assert.ok(STORY[id] && STORY[id].ending, `${id} should still be an ending`);
            assert.ok(reachable.has(id), `${id} should still be reachable`);
        }
    });

    test('every quest referenced by an effect is defined', () => {
        for (const [id, node] of Object.entries(STORY)) {
            const all = [...(node.effects || []), ...(node.choices || []).flatMap(c => c.effects || [])];
            for (const eff of all) {
                if (eff.type === 'startQuest' || eff.type === 'completeQuest') {
                    assert.ok(QUEST_DEFS[eff.quest], `node "${id}" references unknown quest "${eff.quest}"`);
                }
            }
        }
    });

    test('every quest referenced by a requires is defined', () => {
        for (const [id, node] of Object.entries(STORY)) {
            for (const c of node.choices || []) {
                const q = c.requires && (c.requires.questActive || c.requires.questDone);
                if (q) assert.ok(QUEST_DEFS[q], `node "${id}" gates on unknown quest "${q}"`);
            }
        }
    });

    test('every lore entry referenced by an effect is defined', () => {
        for (const [id, node] of Object.entries(STORY)) {
            const all = [...(node.effects || []), ...(node.choices || []).flatMap(c => c.effects || [])];
            for (const eff of all) {
                if (eff.type === 'addLore') {
                    assert.ok(LORE_DEFS[eff.lore], `node "${id}" references unknown lore "${eff.lore}"`);
                }
            }
        }
    });

    test('every learnRecipe effect sets a flag some recipe actually gates on', () => {
        const recipeFlags = new Set(
            Object.values(BREW_RECIPES).map(r => r.flag).filter(Boolean)
        );
        for (const [id, node] of Object.entries(STORY)) {
            const all = [...(node.effects || []), ...(node.choices || []).flatMap(c => c.effects || [])];
            for (const eff of all) {
                if (eff.type === 'learnRecipe') {
                    assert.ok(recipeFlags.has(eff.flag),
                        `node "${id}" teaches flag "${eff.flag}", which no recipe gates on`);
                }
            }
        }
        // ...and every gated recipe is taught somewhere, or it's unbrewable.
        const taught = new Set();
        for (const node of Object.values(STORY)) {
            const all = [...(node.effects || []), ...(node.choices || []).flatMap(c => c.effects || [])];
            for (const eff of all) if (eff.type === 'learnRecipe') taught.add(eff.flag);
        }
        for (const flag of recipeFlags) {
            assert.ok(taught.has(flag), `no story node ever teaches recipe flag "${flag}"`);
        }
    });

    test('re-enterable hub nodes never grant items, coin or XP on entry', () => {
        // Hubs are entered dozens of times over a season; anything granted in
        // their node-level effects would be granted again on every loop.
        const hubs = ['village_hub', 'shop_hub', 'counter_open', 'mira_hub',
                      'bramwell_hub', 'hollow_hub', 'sessily_hub', 'tobin_hub',
                      'ock_hub', 'whisperwood_gate', 'heart_approach'];
        const farmable = new Set(['giveItem', 'giveCoin', 'giveXp']);
        for (const id of hubs) {
            assert.ok(STORY[id], `hub node "${id}" should exist`);
            for (const eff of STORY[id].effects || []) {
                assert.ok(!farmable.has(eff.type),
                    `hub "${id}" grants ${eff.type} on entry, which repeats every visit`);
            }
        }
    });

    test('every background and portrait added in Phase 6 resolves', () => {
        for (const [id, node] of Object.entries(STORY)) {
            assert.ok(BACKGROUNDS[node.background], `node "${id}": unknown background "${node.background}"`);
            if (node.portrait) {
                assert.ok(PORTRAITS[node.portrait], `node "${id}": unknown portrait "${node.portrait}"`);
            }
        }
    });

    test('the "called the watch" branch reaches the ward plot instead of dead-ending', () => {
        // The cold branch used to end the game; it now walks home, meets the
        // watch, and rejoins at Hollow's hub.
        const coldContinue = STORY.hollow_cold_end.choices.find(c => c.next === 'watch_walk_home');
        assert.ok(coldContinue, 'hollow_cold_end should offer a continuation past the ending');
        assert.equal(STORY.hollow_cold_end.choices[0].next, 'ending_cold',
            'the original early ending should still be the first option');

        const rejoin = (() => {
            const seen = new Set(); const queue = ['watch_walk_home'];
            while (queue.length) {
                const id = queue.shift();
                if (seen.has(id) || !STORY[id]) continue;
                seen.add(id);
                const n = STORY[id];
                for (const c of n.choices || []) queue.push(c.next);
                if (n.onWin) queue.push(n.onWin);
                if (n.onLose) queue.push(n.onLose);
            }
            return seen;
        })();
        assert.ok(rejoin.has('hollow_hub'), 'the watch branch should rejoin Hollow’s questline');
        assert.ok(rejoin.has('heart_arrival'), 'the watch branch should reach the hearth-stone');
        assert.ok(rejoin.has('ending_hearthbound'), 'the watch branch should reach the best ending');
    });

    test('the three ward components each have a route that no earlier choice can lock out', () => {
        // Ember: two hearths. Rune: Hollow, your own hand, or the journal.
        // Gift: four routes, one of which has no requirements at all.
        const ungated = (nodeId, targets) => {
            const node = STORY[nodeId];
            return targets.some(t => node.choices.some(c => c.next === t && !c.requires));
        };
        assert.ok(ungated('woods_gift', ['gift_patience']),
            'waiting on the wood for the gift must always be available');
        assert.ok(STORY.rune_by_the_book, 'a no-requirements route to the cut rune must exist');
        const heartChoices = STORY.heart_approach.choices.map(c => c.next);
        assert.ok(heartChoices.includes('rune_by_the_book'));
        assert.ok(heartChoices.includes('woods_gift'));
    });

    test('losing the cellar slime no longer strands the player without the key', () => {
        const retry = STORY.cellar_slime_lost.choices.some(c => c.next === 'cellar_slime_fight');
        assert.ok(retry, 'cellar_slime_lost should offer a rematch');
        const backDown = STORY.shop_hub.choices.find(c => c.next === 'cellar_entry');
        assert.ok(backDown, 'the shop hub should offer a way back to the cellar');
        assert.deepEqual(backDown.requires, { notItem: 'cellar_key' });
    });
});
