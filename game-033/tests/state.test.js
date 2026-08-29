import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js reads/writes localStorage directly (save/load); Node has no
// global localStorage, so provide a minimal in-memory shim before importing.
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

// state is a module-level singleton, so every test resets it explicitly to
// avoid leaking mutations across tests (mirrors what main.js does on New Game).
beforeEach(() => {
    state.reset();
    events.clearAll();
    globalThis.localStorage.clear();
});

describe('effectiveStats — equip slots (Phase 3: trinket + charm)', () => {
    test('with nothing equipped, effectiveStats matches base stats', () => {
        const eff = state.effectiveStats;
        assert.equal(eff.strength, state.stats.strength);
        assert.equal(eff.wit, state.stats.wit);
        assert.equal(eff.charm, state.stats.charm);
    });

    test('a flat-bonus trinket item adds its bonus with no penalty', () => {
        state.addItem('silver_thimble', 1);
        state.equip('trinket', 'silver_thimble');
        assert.equal(state.effectiveStats.wit, state.stats.wit + 2);
    });

    test('a trade-off charm item applies both its bonus and its penalty', () => {
        const baseStrength = state.stats.strength;
        const baseWit = state.stats.wit;
        state.addItem('thornback_bracer', 1);
        state.equip('charm', 'thornback_bracer');
        assert.equal(state.effectiveStats.strength, baseStrength + 3);
        assert.equal(state.effectiveStats.wit, baseWit - 1);
    });

    test('trinket and charm slots stack independently', () => {
        state.addItem('silver_thimble', 1);
        state.addItem('thornback_bracer', 1);
        state.equip('trinket', 'silver_thimble');
        state.equip('charm', 'thornback_bracer');
        const eff = state.effectiveStats;
        assert.equal(eff.wit, state.stats.wit + 2 - 1); // +2 thimble, -1 bracer penalty
        assert.equal(eff.strength, state.stats.strength + 3);
    });

    test('unequipping a slot removes only that slot’s bonus/penalty', () => {
        state.addItem('silver_thimble', 1);
        state.addItem('thornback_bracer', 1);
        state.equip('trinket', 'silver_thimble');
        state.equip('charm', 'thornback_bracer');
        state.unequip('charm');
        const eff = state.effectiveStats;
        assert.equal(eff.wit, state.stats.wit + 2);
        assert.equal(eff.strength, state.stats.strength);
    });

    test('equipping a second item in the same slot replaces the first', () => {
        state.addItem('silver_thimble', 1);
        state.addItem('oak_charm', 1);
        state.equip('trinket', 'silver_thimble');
        state.equip('trinket', 'oak_charm');
        assert.equal(state.equipped.trinket, 'oak_charm');
        assert.equal(state.effectiveStats.wit, state.stats.wit); // thimble bonus gone
        assert.equal(state.effectiveStats.strength, state.stats.strength + 2); // oak_charm bonus present
    });
});

describe('brewing', () => {
    // The player starts with 3 Dried Mintleaf (STARTING_INVENTORY); strip it
    // out so each test controls its own exact material counts.
    beforeEach(() => {
        state.removeItem('dried_mintleaf', state.inventory.find(i => i.id === 'dried_mintleaf')?.count || 0);
    });

    test('canBrew is false when materials are missing', () => {
        assert.equal(state.canBrew('vigor_draught'), false);
    });

    test('canBrew is true once all required materials are present', () => {
        state.addItem('dried_mintleaf', 2);
        state.addItem('river_root', 1);
        assert.equal(state.canBrew('vigor_draught'), true);
    });

    test('brew() consumes materials and grants the result item', () => {
        state.addItem('dried_mintleaf', 2);
        state.addItem('river_root', 1);
        const ok = state.brew('vigor_draught');
        assert.equal(ok, true);
        assert.equal(state.hasItem('dried_mintleaf'), false);
        assert.equal(state.hasItem('river_root'), false);
        assert.equal(state.hasItem('vigor_draught', 1), true);
    });

    test('brew() fails and does not consume partial materials when insufficient', () => {
        state.addItem('dried_mintleaf', 1); // vigor_draught needs 2
        state.addItem('river_root', 1);
        const ok = state.brew('vigor_draught');
        assert.equal(ok, false);
        assert.equal(state.hasItem('dried_mintleaf', 1), true);
        assert.equal(state.hasItem('river_root', 1), true);
        assert.equal(state.hasItem('vigor_draught'), false);
    });

    test('brew() returns false for an unknown recipe id', () => {
        assert.equal(state.brew('not_a_real_recipe'), false);
    });

    test('brewing emits an itemBrewed event', () => {
        state.addItem('dried_mintleaf', 2);
        state.addItem('river_root', 1);
        let emitted = null;
        events.on('itemBrewed', (recipeId, resultItem) => { emitted = { recipeId, resultItem }; });
        state.brew('vigor_draught');
        assert.deepEqual(emitted, { recipeId: 'vigor_draught', resultItem: 'vigor_draught' });
    });

    test('leftover extra materials remain after brewing exact amounts', () => {
        state.addItem('dried_mintleaf', 3); // needs 2, should have 1 left
        state.addItem('river_root', 1);
        state.brew('vigor_draught');
        assert.equal(state.hasItem('dried_mintleaf', 1), true);
        assert.equal(state.hasItem('dried_mintleaf', 2), false);
    });
});

describe('save/load round-trips Phase 3 state', () => {
    test('equipment across both slots and brewed items survive a real save/load cycle', () => {
        state.addItem('dried_mintleaf', 2);
        state.addItem('river_root', 1);
        state.brew('vigor_draught');
        state.addItem('thornback_bracer', 1);
        state.equip('charm', 'thornback_bracer');
        state.equip('trinket', 'oak_charm'); // not owned, but equip() doesn't validate — still round-trips
        state.setFlag('canBrew', true);

        state.save();
        state.reset(); // wipe in-memory state to prove load() actually restores it
        assert.equal(state.hasItem('vigor_draught'), false);

        const loaded = state.load();
        assert.equal(loaded, true);
        assert.equal(state.equipped.charm, 'thornback_bracer');
        assert.equal(state.equipped.trinket, 'oak_charm');
        assert.equal(state.hasItem('vigor_draught', 1), true);
        assert.equal(state.getFlag('canBrew'), true);
    });

    test('hasSave reflects whether a save exists', () => {
        assert.equal(state.hasSave(), false);
        state.save();
        assert.equal(state.hasSave(), true);
    });

    test('load() returns false when no save exists', () => {
        assert.equal(state.load(), false);
    });
});
